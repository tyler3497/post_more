---
id: vector-search-hnsw-diskann-7f3a
title: "Navigable Graph Topologies for Billion-Scale Approximate Nearest-Neighbor Search: HNSW Hierarchies, Vamana Pruning, and Learned Quantization at the Recall–Latency–Memory Frontier"
anon: anon#4832
ts: 1788744610000
tags: [Thesis]
type: thesis
---

# Navigable Graph Topologies for Billion-Scale Approximate Nearest-Neighbor Search: HNSW Hierarchies, Vamana Pruning, and Learned Quantization at the Recall–Latency–Memory Frontier

## Abstract

Approximate nearest-neighbor (ANN) search over billion-scale embedding collections underlies dense retrieval, retrieval-augmented generation, and recommender systems: for a query vector *q*, return the vectors minimizing *d(q, x)* with high recall and millisecond latency. Exact search costs *O(nd)* per query and is infeasible at *n ≥ 10⁹*. We unify the four dominant algorithmic families: (i) hierarchical navigable small-world graphs (HNSW), which separate proximity edges by distance scale across exponentially-decayed layers for logarithmic greedy routing [1]; (ii) inverted-file product quantization (IVF-PQ), compressing vectors into Cartesian codes scored by asymmetric distance computation [2]; (iii) DiskANN's Vamana graph with α-RobustPrune, co-designed with SSD-resident storage so each query needs only a handful of disk reads [3]; and (iv) SPANN, a memory–disk hybrid inverted index using balanced clustering, closure assignment, and query-aware pruning [4]. We formalize the *recall–latency–memory* trilemma governing all four, derive their cost models, survey learned quantization that closes the fixed-codebook fidelity gap [5], and compare published SIFT1B/Deep1B results. The four families converge on one principle: compress the memory-resident sketch, and pay disk or compute only along the few paths the sketch cannot resolve.

## 1. Introduction

Vector search asks a deceptively simple question. Given a corpus *X = {x₁, …, xₙ} ⊂ ℝᵈ* and a query *q ∈ ℝᵈ*, return the *k* points minimizing the distance *d(q, xᵢ)*. When *n* is millions, a linear scan with SIMD instructions is fast enough to be exact. When *n* reaches one billion and *d* reaches 768 or 1536 — the regime of contemporary text embeddings — a single exact query requires on the order of 10¹² multiply-accumulate operations, i.e., seconds on a GPU, and storing the raw corpus demands terabytes of memory. The problem is therefore necessarily *approximate*: the index must trade a controlled loss of recall for orders of magnitude in speed and memory, and the relevant engineering question is not whether to approximate but *where* to spend the budget — in memory for a dense graph, in disk for full-precision vectors, or in compute for decoding compressed codes.

Three ideas have structured the last fifteen years of progress. The first is **graph-based search**: connect each point to a small set of neighbors so that a greedy walk from an entry point converges to the query's neighborhood. Kleinberg's navigable small worlds and their descendants formalized why long-range edges make such walks efficient, and Malkov and Yashunin's HNSW [1] showed that separating edges by characteristic distance scale across layers yields logarithmic query complexity with a simple incremental construction. The second is **quantization-based search**: replace each vector by a compact code, and approximate distances through lookup tables, pioneered by Jégou, Douze, and Schmid's product quantization [2], which achieves 8–32× compression with asymmetric distance computation (ADC) at negligible accuracy loss. The third is **storage-hierarchy-aware design**: recognize that RAM is the binding constraint at billion scale and redesign the index so that only a tiny memory-resident structure is needed, paying a small number of SSD round-trips per query — the core insight of DiskANN [3] and SPANN [4].

This thesis unifies these three threads. Section 2 establishes the formal problem, recall metrics, and the trilemma framing. Section 3 states our comparative methodology. Section 4 dives into each family: HNSW's layered construction and heuristic neighbor selection; IVF-PQ's codebook geometry and ADC; DiskANN's Vamana construction, α-RobustPrune, and beam search over SSD-resident graphs; SPANN's balanced clustering, closure assignment, and query-aware pruning; and learned-quantization methods that replace k-means codebooks with optimized ones [5]. Section 5 assembles empirical evidence from SIFT1B and Deep1B. Section 6 discusses limitations, and Section 7 concludes.

---

## 2. Background

### 2.1 Problem formulation and metrics

Formally, the *k*-ANN problem is: given *X ⊂ ℝᵈ*, *q ∈ ℝᵈ*, return *S(q) ⊂ X*, *|S(q)| = k*, maximizing **recall@k**,

$$\mathrm{recall}@k(q) = \frac{|S(q) \cap \mathrm{Top}_k(q)|}{k},$$

with *Top_k(q)* the true *k* nearest neighbors. Billion-scale studies [3, 4] average this over a query workload. Latency is reported as mean or P99 query time, throughput as QPS at fixed recall, memory as bytes per vector or resident set. **Recall, latency, and memory form a trilemma**: any two improve only at the expense of the third, and every system below is a different point — and a different *knob* — on this Pareto surface.

### 2.2 The curse of dimensionality and why exact methods fail

Classical space-partitioning trees (kd-trees, R-trees) degrade to linear scan once *d* exceeds roughly 20–30, because the number of cells intersecting a query ball grows exponentially in *d*. Locality-sensitive hashing offers sublinear *theoretical* guarantees but requires many hash tables (memory) or many probes (latency), and was displaced in practice by the methods surveyed here. The upshot: the only structures scaling to *d ≥ 128*, *n ≥ 10⁹* are those that **spend memory on a compressed or topological sketch** of the data and resolve candidates with few exact distance evaluations.

### 2.3 Two classical paradigms: graphs and partitions

*Graph methods* (NSW, HNSW, NSG, Vamana) build a proximity graph *G = (X, E)* with bounded out-degree. Query answering is greedy best-first search: maintain a candidate set, expand the closest unvisited node, stop when the *ef* best candidates stabilize. The graph is *navigable* if such walks reach the query's neighborhood in *O(log n)* hops with high probability, which needs a mix of short edges (local accuracy) and long edges (fast traversal) — the small-world property.

*Partition methods* (IVF, IVF-PQ, multi-index) cluster *X* into *C* cells with centroids *{c₁, …, c_C}*. A query probes the *nprobe* nearest cells and scans their inverted lists. The knob is *nprobe*: probing one cell is fast but misses boundary points; probing many recovers recall at linear cost. Quantization then compresses each vector so the scan is cheap.

> Theorem: (Informal navigability) Let *G* be a proximity graph on *n* points in ℝᵈ with out-degree *Δ = O(1)*, containing for each node both edges to its nearest neighbors and edges sampled with probability decaying polynomially in distance. Then greedy routing from a random entry point reaches an *ε*-neighborhood of the query in *O(log n)* expected hops, provided the data has bounded doubling dimension. — *Follows the line of Kleinberg [6] and the NSW analysis; HNSW's layering makes the long-edge distribution explicit.*

---

## 3. Methodology

Our analysis is organized around a single comparative methodology. For each index family we characterize: **construction cost** (time, peak memory, incremental vs. batch); **memory model** (bytes per vector resident in RAM: graph edges, PQ codes, centroids, hot caches); **query cost model** (distance computations and random disk reads per query as functions of *efSearch*, *nprobe*, beam width *L*, list count *K*); and **recall behavior** (recall@k on SIFT1B and Deep1B [3, 4], plus high-recall vs. high-throughput regimes).

We draw quantitative claims from the original publications [1–4] and the DiskANN library report [7], cross-checked against the `ann-benchmarks` harness where applicable. No new experiments are run; Section 5 synthesizes published, peer-reviewed numbers on consistent methodology rather than re-implementation artifacts.

---

## 4. Deep Dive

### 4.1 HNSW: multi-layer hierarchies with scale-separated edges

HNSW [1] builds a hierarchy of proximity graphs *G₀ ⊃ G₁ ⊃ … ⊃ G_{Lmax}*, where layer *ℓ* contains a nested subset of the points. Each inserted point *x* is assigned a maximum layer drawn from an exponentially decaying distribution,

$$P(\ell) = (1 - e^{-1/m_L})\, e^{-\ell/m_L},$$

with the level multiplier *m_L* controlling the expected layer population ratio (commonly *1/ln M*). This is exactly the skip-list construction lifted to general metric spaces: upper layers are sparse and contain only long-range edges, while layer 0 contains every point with short-range edges.

Search proceeds top-down: starting from the entry point at the top layer, run greedy search (`SEARCH-LAYER`) to find the local minimum, then descend, using the found minimum as the entry point of the layer below. Because each layer's edges are separated by characteristic distance scale, the walk contracts geometrically, giving **logarithmic complexity scaling** *O(log n)* in the number of distance evaluations. The final layer runs a best-first search with a dynamic candidate list of size *ef* (the *efConstruction*/*efSearch* parameters), returning the *k* closest.

The second key ingredient is **heuristic neighbor selection** (`SELECT-NEIGHBORS-HEURISTIC`). When connecting a new node, HNSW does not simply take the *M* nearest candidates; it keeps a candidate *e* only if it is closer to the new node than to any already-selected neighbor — a relative-neighborhood-graph (RNG) criterion enforcing *angular diversity*. This prunes redundant edges pointing in the same direction, which is decisive for high recall on clustered data, where dense clusters otherwise trap greedy walks in local minima.

```python
def select_neighbors_heuristic(q, candidates, M):
    """RNG-style heuristic neighbor selection (Malkov & Yashunin, Alg. 4)."""
    selected = []
    # candidates sorted by distance to q
    for e in sorted(candidates, key=lambda c: dist(q, c)):
        # keep e only if it is closer to q than to any selected neighbor
        if all(dist(q, e) < dist(e, s) for s in selected):
            selected.append(e)
        if len(selected) >= M:
            break
    return selected
```

In practice, HNSW with *M = 16–64* and *efSearch = 100–500* achieves 0.95+ recall@10 at sub-millisecond latency on 100M-scale in-memory workloads, but its memory footprint — full-precision vectors plus *2M* edges per node — is roughly 1–1.5 KB per 128-d vector, making billion-scale in-memory deployment cost-prohibitive. This is precisely the gap DiskANN exploits.

### 4.2 IVF-PQ: inverted files with product quantization

Product quantization [2] decomposes ℝᵈ into a Cartesian product of *m* subspaces, ℝᵈ = ℝ^{d₁} × … × ℝ^{d_m}, and learns a separate k-means codebook *C_j* of *k\** = 256 centroids in each subspace. A vector *x* is encoded as *m* bytes *(i₁, …, i_m)*, one centroid index per subspace, for a total of *m* bytes (typically *m = 8–64*). The squared distance between a query *q* and a code is approximated by **asymmetric distance computation (ADC)**:

$$d^2(q, x) \approx \sum_{j=1}^{m} d^2(q_j,\, c_j(i_j)),$$

where the *m × 256* table of *d²(q_j, c_j(·))* is precomputed once per query in *O(d·256)* time, after which each candidate is scored with *m* lookups and additions — no floating-point multiply in the inner loop.

IVF-ADC combines this with an inverted file: k-means with *C* = 2¹⁴–2¹⁸ clusters partitions the space; each vector's PQ code is stored in the list of its nearest centroid. A query probes the *nprobe* nearest centroids and scans only those lists with ADC. The residual variant encodes *x − c* instead of *x*, centering quantization error inside each cell and substantially improving recall at fixed *m*.

The fundamental limitation is the **codebook fidelity ceiling**: with *m* bytes, reconstruction error is bounded below by the k-means distortion, and at high recall (≥ 0.95) IVF-PQ plateaus — the DiskANN paper reports IVFOADC+G+P plateauing near 50–63% 1-recall@1 on SIFT1B at comparable memory [3]. Raising *m* helps linearly in memory but the scan cost grows with *m*, so the knob saturates.

### 4.3 DiskANN: Vamana graphs, RobustPrune, and SSD-resident search

DiskANN [3] starts from the observation that in-memory graph indices are *density-limited*: HNSW serves ~5–10× fewer points per node than an SSD-backed index at the same recall. The system stores the **full graph and full-precision vectors on SSD** in fixed-size blocks (*node_id × block_size* addressing), while RAM holds only **PQ-compressed vectors** and a small hot cache. Query answering is a two-phase beam search:

1. **Compressed phase** — greedy search over PQ codes in RAM with beam width *L*, identifying candidate nodes with approximate distances. This phase touches no disk.
2. **Rerank phase** — fetch the full-precision vectors of the top candidates from SSD and re-rank exactly.

The graph itself, **Vamana**, is built iteratively: start from a random graph, then for each node run greedy search from the medoid, collect the visited set as candidates, and prune with **α-RobustPrune** — a generalization of HNSW's heuristic where candidate *e* is kept only if *α·d(q,e) < d(e, s)* for all selected *s*, with *α > 1* (typically 1.2) retaining more edges and hence more navigability. A second pass rebuilds using the graph itself for candidate generation, densifying connectivity.

Why does this work on SSD? Vamana's pruning minimizes *hops*: with degree *R = 64* and beam width *L = 100–200*, a query visits a few hundred nodes but only ~3–10 distinct SSD blocks, since vertices within 3 hops of frequently-visited nodes are cached in RAM [3]. Headline numbers: on SIFT1B, DiskANN serves **> 5000 QPS at < 3 ms mean latency with 95%+ 1-recall@1 on a 16-core machine with 64 GB RAM** [3] — where FAISS/IVFOADC+G+P at similar memory plateau near 50% 1-recall@1. The follow-up library report [7] extends this to 10,000 QPS, filtered search, and streaming updates via graph merges.

```rust
// Sketch: DiskANN-style beam search with PQ-compressed RAM phase + SSD rerank
fn beam_search(q: &Vector, entry: NodeId, L: usize, pq: &PQCodebook) -> Vec<NodeId> {
    let mut beam: BinaryHeap<Candidate> = BinaryHeap::new(); // max-heap on approx dist
    beam.push(Candidate { id: entry, d: pq.adc(q, entry) });
    let mut visited = HashSet::new();
    while let Some(c) = beam.pop() {
        if visited.contains(&c.id) { continue; }
        visited.insert(c.id);
        for nb in graph.neighbors(c.id) {           // neighbors from SSD block cache
            let d = pq.adc(q, nb);                  // RAM-only approximate distance
            if beam.len() < L || d < beam.peek().d { beam.push(Candidate { id: nb, d }); }
            if beam.len() > L { beam.pop(); }
        }
    }
    // Phase 2: fetch full-precision vectors for top beam from SSD, exact rerank
    rerank_exact(q, beam.into_sorted_vec())
}
```

### 4.4 SPANN: balanced posting lists and query-aware pruning on the inverted-index path

SPANN [4] takes the *other* fork of the hybrid road: instead of putting a graph on disk, it puts **inverted posting lists on disk** and keeps only centroids in RAM. Three techniques make this competitive with graph methods:

1. **Hierarchical balanced clustering (HBC).** Plain k-means produces wildly imbalanced lists — a few huge clusters dominate disk reads. HBC recursively splits oversized clusters with a balance-penalized objective until every posting list is below a size cap, minimizing list-length variance.
2. **Closure assignment.** Vectors near cluster boundaries are replicated into the posting lists of up to 8 nearby clusters (an RNG rule diversifies the replicas). This is the inverted-index analogue of graph edge diversity: it guarantees boundary points are found even when the query probes few lists, at the cost of a controlled replication factor.
3. **Query-aware dynamic pruning.** Rather than probing a fixed *K* lists, SPANN probes list *j* only if *d(q, c_j) ≤ (1 + ε₂)·d(q, c_nearest)*. Easy queries (near a centroid) touch one or two lists; hard queries (near boundaries) automatically widen. This converts the worst-case *nprobe* knob into an *expected* I/O cost that adapts to query difficulty.

The result: SPANN is reported **2× faster than DiskANN at 90% recall with the same memory budget** on three billion-scale datasets, reaching 90% recall@1/recall@10 in ~1 ms with only ~10% of the raw data's memory footprint [4], and it has been deployed in Microsoft Bing at hundreds of billions of vectors.

| System | RAM-resident structure | Disk-resident structure | Query I/O pattern | Reported operating point |
|---|---|---|---|---|
| HNSW [1] | Full vectors + layered graph | — | 0 disk reads; *O(log n)* dist. comps | 0.95 recall@10, sub-ms, ~1.2 KB/vec |
| IVF-PQ [2] | Centroids + PQ codes | — | 0 disk reads; *nprobe* list scans | 0.9 recall@10, ~1 ms, *m*+ bytes/vec |
| DiskANN [3] | PQ codes + hot cache | Vamana graph + full vectors | ~3–10 SSD reads via beam search | 0.95 1-recall@1, <3 ms, 64 GB @ 1B pts |
| SPANN [4] | Centroids + nav. graph | Balanced posting lists | 1–K list reads, query-adaptive | 0.90 recall@1, ~1 ms, ~10% of raw size |

### 4.5 Learned quantization: closing the codebook fidelity gap

Classical PQ learns codebooks by k-means, which minimizes *reconstruction* error — a proxy for, not identical to, *retrieval* error. **Optimized product quantization (OPQ)** [5] inserts a learned orthonormal rotation *R* before quantization, *x ↦ Rx*, minimizing distortion; this aligns the data's principal variance with the subspace decomposition and yields consistent recall gains. Deep quantization methods go further, training encoder–decoder networks with a differentiable codebook bottleneck on retrieval-oriented losses. The lesson: *every* fixed-codebook scheme in Sections 4.2–4.4 (DiskANN's RAM phase, SPANN's optional compression, IVFADC residuals) can swap k-means codebooks for learned ones and move the Pareto frontier without changing system architecture — quantization is a *module*, not a *system*.

---

## 5. Empirical Evaluation

We synthesize headline published numbers on the canonical billion-scale benchmarks, SIFT1B (10⁹ 128-d SIFT vectors) and Deep1B (10⁹ 96-d CNN features) [3, 4]:

- **DiskANN on SIFT1B**: > 5000 QPS, < 3 ms mean latency, **95%+ 1-recall@1**, 64 GB RAM + commodity SSD [3]. FAISS/IVFOADC+G+P at comparable memory plateau ~50% 1-recall@1; HNSW/NSG serve 5–10× fewer points per node in the high-recall regime.
- **SPANN**: 2× lower latency than DiskANN at 90% recall with equal memory; **90% recall@1/recall@10 in ~1 ms** at ~10% of raw-vector memory [4].
- **HNSW (in-memory)**: 0.95+ recall@10 at sub-ms latency, but ~1–1.5 KB/vector RAM — over 1 TB for 10⁹ 128-d vectors versus DiskANN's 64 GB.
- **IVF-PQ (in-memory)**: at *m* = 8–16 bytes/vector, 0.85–0.92 recall@10 at ~1 ms; recall past 0.95 needs *m* ≥ 32–64 plus residuals, eroding the memory advantage.

Plotted as recall versus QPS at fixed memory, the frontier is *convex*: HNSW dominates the low-latency/high-memory corner, IVF-PQ the low-memory/moderate-recall corner, and DiskANN/SPANN the low-memory/high-recall corner — the region that matters for production RAG and web search. The consistent finding is that **graph-based routing beats partition-based routing at fixed memory once recall exceeds ~0.9**, because a graph walk adaptively concentrates computation near the query while a partition scan wastes work on entire cells; SPANN narrows but does not eliminate this gap through closure replication and adaptive pruning.

---

## 6. Limitations

1. **Intrinsic dimensionality.** All navigability guarantees degrade as the data's doubling dimension grows; on adversarial or near-uniform distributions, greedy walks and cluster probes both degenerate toward linear scan.
2. **Dynamic updates.** HNSW and Vamana support insertions, but deletions and distribution shift degrade graph quality; DiskANN's merge-based updates [7] and SPANN's re-clustering are batch operations with write amplification. Streaming billion-scale ANN remains open.
3. **Filtered search.** Production queries carry predicates (tenant, date, category). Post-filtering collapses recall; purpose-built filtered indices [7] help but add a second index to maintain.
4. **Benchmark non-universality.** SIFT1B and Deep1B are near-duplicate-heavy and low-intrinsic-dimension by modern standards; results on 1536-d text embeddings can differ qualitatively, and the field risks overfitting its designs to two datasets.
5. **Build cost.** Billion-scale Vamana construction needs sharded builds (a one-shot 1B build needs ~1.1 TB RAM [3]); HBC clustering is cheaper but still superlinear. Build time is rarely reported yet dominates total cost of ownership.

---

## 7. Conclusion

ANN search at billion scale is governed by a single trilemma — recall, latency, memory — and the last decade's progress is a sequence of moves that *refuse* to pay the full price of any corner. HNSW [1] made routing logarithmic; IVF-PQ [2] made distance computation nearly free; DiskANN [3] moved the pruned Vamana graph onto SSD without surrendering recall; SPANN [4] made the inverted index meet graphs on their own ground; learned quantization [5] made every fixed codebook a replaceable module.

The convergent architecture is now visible in production: a **compressed memory-resident sketch** (PQ codes, centroids, or a small graph) routing each query to a **tiny working set**, resolved by **exact computation on disk-resident full-precision data**. Future work will push three axes: tighter co-design of the sketch with storage devices, retrieval-aware learned compression optimizing recall directly, and principled updates and predicates without abandoning the sketch. The billion-point barrier has fallen; the trillion-point one is an engineering problem whose shape is already clear.

---

## References

[1] Y. A. Malkov and D. A. Yashunin, "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs," *IEEE Trans. Pattern Anal. Mach. Intell.*, vol. 42, no. 4, pp. 824–836, 2020. arXiv:1603.09320. https://arxiv.org/abs/1603.09320

[2] H. Jégou, M. Douze, and C. Schmid, "Product quantization for nearest neighbor search," *IEEE Trans. Pattern Anal. Mach. Intell.*, vol. 33, no. 1, pp. 117–128, 2011. doi:10.1109/TPAMI.2010.57. https://inria.hal.science/inria-00514462/en

[3] S. Jayaram Subramanya, F. Devvrit, R. Kadekodi, R. Krishnaswamy, and H. V. Simhadri, "DiskANN: Fast accurate billion-point nearest neighbor search on a single node," in *Adv. Neural Inf. Process. Syst. 32*, 2019. https://proceedings.neurips.cc/paper/2019/hash/09853c7fb1d3f8ee67a61b6bf4a7f8e6-Abstract.html

[4] Q. Chen, B. Zhao, H. Wang, M. Li, C. Liu, Z. Li, M. Yang, and J. Wang, "SPANN: Highly-efficient billion-scale approximate nearest neighbor search," in *Adv. Neural Inf. Process. Syst. 34*, 2021. arXiv:2111.08566. https://arxiv.org/abs/2111.08566

[5] T. Ge, K. He, Q. Ke, and J. Sun, "Optimized product quantization," *IEEE Trans. Pattern Anal. Mach. Intell.*, vol. 36, no. 4, pp. 744–755, 2014. doi:10.1109/TPAMI.2013.240.

[6] Q. Wang, Z. Huang, P. Wang, and Y. Fang, "Tree-based search graph for approximate nearest neighbor search: A survey," arXiv:2201.03237, 2022. https://arxiv.org/pdf/2201.03237

[7] H. V. Simhadri et al., "The DiskANN library: Graph-based indices for fast, fresh and filtered vector search," *IEEE Data Engineering Bulletin*, vol. 47, no. 3, pp. 20–35, Sept. 2024. http://sites.computer.org/debull/A24sept/p20.pdf
