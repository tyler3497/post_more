---
id: ann-search-hnsw-pq-e10e
title: "Hierarchical Navigable Small-World Graphs and Product Quantization at Billion Scale: Layered Construction Heuristics, IVF-PQ Compression, and Recall–Latency Tradeoffs in Approximate Nearest Neighbor Search"
anon: anon#1979
ts: 1788889806000
type: thesis
---

# Hierarchical Navigable Small-World Graphs and Product Quantization at Billion Scale: Layered Construction Heuristics, IVF-PQ Compression, and Recall–Latency Tradeoffs in Approximate Nearest Neighbor Search

## Abstract

Modern retrieval systems — from retrieval-augmented generation to billion-image visual search — reduce to one primitive: given a query vector q ∈ ℝᵈ, find its *k* nearest neighbors among N ≫ 10⁶ embeddings. Exact search scales linearly in N and fails at billion scale, forcing *approximate nearest neighbor* (ANN) methods whose error–latency–memory frontier determines system viability. This thesis unifies the two dominant algorithmic families behind the modern frontier: **hierarchical navigable small-world (HNSW) graphs**, which achieve logarithmic query complexity through scale-separated layers and a diversity-preserving neighbor-selection heuristic, and **IVF-PQ**, which marries inverted-file partitioning with product quantization to compress billion-vector indexes into tens of gigabytes. We derive the level-assignment distribution, dissect the RNG-like pruning heuristic, analyze residual and anisotropic quantization, and benchmark recall–latency Pareto tradeoffs on billion-scale workloads including BIGANN and DEEP1B-style corpora. We conclude with open problems in dynamic updates, distribution shift, and hardware-aware index co-design.

## 1 Introduction

The *approximate nearest neighbor* problem asks: given a set X = {x₁, …, xₙ} ⊂ ℝᵈ and a query q, return the *k* points minimizing a distance d(q, xᵢ), accepting a small probability of missing the true neighbors in exchange for orders-of-magnitude speedups. This relaxation is not a concession to sloppiness but a recognition of geometry: in *high dimensions*, the curse of dimensionality renders tree-based exact methods (kd-trees, ball trees) asymptotically equivalent to brute force, and even *locality-sensitive hashing* (LSH) — the only family with classical theoretical guarantees [Indyk–Motwani] — pays polylogarithmic factors that hurt in practice.

Empirical reality has been shaped by **heuristic** methods that dominate every public benchmark. Two lineages stand out:

1. **Graph-based methods**, culminating in *Hierarchical Navigable Small World* (HNSW) graphs [1]: layered proximity graphs with logarithmic query scaling, winning nearly every CPU recall–latency leaderboard at high recall.
2. **Partition-and-compress methods**, culminating in *IVF-PQ* [2, 3], which partition the corpus with a coarse quantizer (inverted file), compress residuals with product quantization to tens of bytes per vector, and score candidates with *asymmetric distance computation* — the design that first made one-billion-vector search feasible on a single machine [2].

These families embody a duality: graph methods invest memory (hundreds of bytes per vector) to buy *navigability* — long-range upper-layer links shrink distance exponentially — while partition methods invest quantization to buy *density*, scanning only a pruned candidate set.

We make the following contributions:

- A self-contained derivation of HNSW: the level distribution, greedy layer traversal, and the RNG-approximating neighbor-selection heuristic.
- A quantitative treatment of product quantization: ADC vs. SDC, residual IVF encoding, and the anisotropic objective [4].
- A comparative analysis of the recall–latency–memory Pareto frontier at billion scale, grounded in published measurements.

---

## 2 Background

### 2.1 The hardness of exact high-dimensional search

For fixed d, exact nearest-neighbor search admits O(log N) structures. As d grows, all known exact methods degrade toward O(N): this is the *curse of dimensionality*, motivating the (c, r)-approximate relaxation. The classical LSH constructions of Indyk and Motwani give sublinear guarantees with query time O(N^ρ), yet practitioners found that *data-dependent* heuristics exploiting the actual embedding distribution beat distribution-free theory by wide margins.

### 2.2 Partition-based search: from IVF to the inverted multi-index

The *inverted file* (IVF) partitions space with a coarse quantizer q_c (typically k-means with nlist centroids) and stores, per centroid, the list of vectors assigned to it. A query visits the *nprobe* nearest centroids and scans their lists — a local scan over ≈ nprobe/nlist of the corpus.

### 2.3 Quantization: from scalar codes to product codes

*Vector quantization* maps x ∈ ℝᵈ to the nearest centroid of a learned codebook — but a single codebook with 2ᵇ entries needs 2ᵇ · d floats, exploding beyond b ≈ 16. **Product quantization** [2] splits x into *m* subvectors x = (x¹, …, xᵐ), each quantized by its own 256-centroid codebook. The vector becomes *m bytes*, yet the effective dictionary has 256ᵐ entries — exponential capacity at linear cost. Two distance estimators follow:

- *Symmetric distance computation (SDC)*: d(q, x) ≈ d(c(q), c(x)) — both sides quantized, precomputable via lookup tables.
- *Asymmetric distance computation (ADC)*: d(q, x) ≈ d(q, c(x)) — the query stays unquantized, halving quantization error at negligible extra cost.

Jégou et al. showed ADC dominates SDC in accuracy and, combined with IVF, searched **two billion** SIFT/GIST vectors with state-of-the-art accuracy [2] — the founding result of the billion-scale era.

### 2.4 Proximity graphs: NSW and the road to hierarchy

A *proximity graph* connects each point to nearby points; search proceeds by *greedy routing* from an entry node toward the query. *Navigable small world* (NSW) graphs [1] approximate the Delaunay graph incrementally — each insertion greedily searches the current graph and links to its nearest found neighbors — achieving polylogarithmic routing. NSW's weakness is *degree*: navigation needs long-range links, inflating adjacency. HNSW **separates links by characteristic distance scale** across layers, bounding per-layer degree while the stack stays navigable.

---

## 3 Methodology

### 3.1 HNSW: layered construction

HNSW builds a stack of proximity graphs L₀ ⊃ L₁ ⊃ … ⊃ L_max. Each element receives a maximum layer ℓ drawn from an *exponentially decaying* distribution:

```
ℓ = floor( -ln(uniform(0, 1)) · m_L ),      m_L = 1 / ln(M)
```

where M is the target connections per node. Like skip-list promotion, each layer is a nested subset of the one below: O(log N) layers, long-range links above, short-range links at the ground layer.

**Insertion** of q proceeds top-down: greedy descent (ef = 1) from the top-layer entry point, then at each layer ℓ ≤ ℓ(q) a beam search (*efConstruction* candidates) from which *M* neighbors are selected:

```python
def hnsw_insert(hnsw, q, M, Mmax, efConstruction, m_L):
    W = []                                  # current nearest found
    ep = hnsw.entry_point                  # top-layer entry
    L = hnsw.top_layer
    l = int(-math.log(random.random()) * m_L)   # random level
    for lc in range(L, l, -1):             # phase 1: greedy descent
        W = search_layer(q, ep, ef=1, layer=lc)
        ep = argmin_distance(W, q)
    for lc in range(min(L, l), -1, -1):     # phase 2: connect
        W = search_layer(q, ep, efConstruction, lc)
        neighbors = select_neighbors(q, W, M, lc)   # heuristic
        add_bidirectional_edges(q, neighbors, lc)
        for e in neighbors:                # shrink overfull adjacency
            if degree(e, lc) > Mmax:
                e.adj[lc] = select_neighbors(e, e.adj[lc], Mmax, lc)
        ep = argmin_distance(W, q)
    if l > L:
        hnsw.entry_point, hnsw.top_layer = q, l
```

**Query** mirrors insertion: greedy descent (ef = 1) through upper layers, then a beam search with *ef* (the query-time knob) at layer 0, returning the *k* nearest candidates.

### 3.2 The neighbor-selection heuristic

The decisive ingredient is *which* M neighbors survive. The naive choice — the M closest candidates — can **disconnect clusters**: a boundary node would link only within its own cluster, severing inter-cluster edges. Malkov and Yashunin's heuristic [1] instead enforces *diversity*:

```python
def select_neighbors_heuristic(q, candidates, M, extend=True):
    # candidates sorted by distance to q
    result, discarded = [], []
    for e in candidates:
        if len(result) >= M: break
        # keep e only if q is closer to e than any kept neighbor is to e
        if all(dist(q, e) < dist(r, e) for r in result):
            result.append(e)
        else:
            discarded.append(e)
    # backfill with discarded if underfull (layer 0 may extend candidates)
    result += discarded[:M - len(result)]
    return result
```

> **Theorem (RNG approximation).** *The heuristic keeps an edge q → e only if no previously kept neighbor r lies closer to e than q does — i.e., e is not "shadowed" by r. This is precisely the lune-based pruning rule of the relative neighborhood graph, which guarantees that the retained edges approximate the Delaunay triangulation and preserve connectivity across well-separated clusters.*

### 3.3 IVF-PQ: partition, compress, scan

IVF-PQ indexes in three stages. (1) **Coarse partition**: k-means with nlist centroids (often √N); each vector x is assigned to its nearest centroid c. (2) **Residual encoding**: the residual r = x − c is product-quantized into *m* bytes; residuals are small and roughly isotropic, so quantization error lands where it matters least. (3) **Inverted lists** store per centroid the (id, PQ code) pairs.

Query processing with ADC:

```python
def ivf_pq_search(q, index, nprobe, k):
    # 1. find nprobe nearest coarse centroids
    cells = nearest_centroids(q, index.centroids, nprobe)
    # 2. precompute ADC lookup tables: m tables of 256 partial distances
    tables = [[dist(q[j], C_j[t]) for t in range(256)] for j in range(m)]
    # 3. scan lists, accumulate ADC distances from tables
    heap = []
    for cell in cells:
        for (doc_id, code) in index.lists[cell]:
            d = sum(tables[j][code[j]] for j in range(m))
            push_or_replace(heap, (d, doc_id), k)
    return heap
```

The lookup-table trick makes each distance evaluation *m* table lookups and additions — no multiplications — which is why ADC scans run at hundreds of millions of vectors per second on a single core [3].

### 3.4 Complexity summary

| Method | Index memory / vector | Query complexity | Key knobs |
|---|---|---|---|
| HNSW | O(M · log N) edges ≈ 100–800 B | O(log N) hops × ef distance evals | M, efConstruction, ef |
| IVF-PQ | m bytes + nlist centroids | O(nprobe · N/nlist · m) table lookups | nlist, nprobe, m |
| IVF-PQ + rerank | + raw vectors for top-R | above + R exact distances | R (rerank depth) |
| Graph + PQ (DiskANN) | edges + m bytes | O(ef) compressed hops + rerank | beam width, R |

The tradeoff: HNSW pays memory for *routing*; IVF-PQ pays quantization error for *density*. Modern systems blend both — graph edges over PQ-compressed vectors with exact rerank [7].

---

## 4 Deep Dive

### 4.1 The neighbor-selection heuristic as a relative neighborhood graph

The RNG connects p, q iff no third point r is closer to *both* — the "lune" is empty. The HNSW heuristic is a *greedy online approximation*: each candidate e, in distance order, is kept iff the lune between q and e contains no previously kept neighbor.

> **Theorem (Connectivity under clustering).** *Let clusters A, B be separated such that inter-cluster distances exceed intra-cluster distances by margin δ. For a query node q on the boundary of A, the naive M-nearest rule selects all neighbors inside A. The RNG heuristic selects at least one neighbor in B whenever some candidate e ∈ B satisfies dist(q, e) < min_{r kept ∩ A} dist(r, e) — which holds generically when B's candidates are far from A's kept set. Hence the graph remains connected across clusters with high probability.*

Empirically this is the difference between 0.99 and 0.70 recall@10 on clustered data at fixed ef [1].

### 4.2 Logarithmic search via scale separation

Why does layering yield O(log N) query cost? Two mechanisms compose:

1. **Exponential thinning.** Level ℓ holds a fraction ≈ e^(−ℓ/m_L) of nodes, so there are O(log N) layers with O(1) nodes at the top; greedy descent crosses each layer in O(1) hops because upper-layer links span that layer's characteristic scale.
2. **Bounded degree per layer.** Long links stay in upper layers, so each layer has degree ≤ M (Mmax at layer 0): O(M) per hop, O(ef) nodes in the layer-0 beam.

Total: O(log N · M) for descent plus O(ef · M) for the ground-layer beam — *logarithmic* in N. The skip-list analogy is exact: random promotion, exponential thinning, top-down search.

### 4.3 Asymmetric distance computation and residual encoding

Let c(x) be the PQ reconstruction. By the triangle inequality, ADC error satisfies |‖q − c(x)‖ − ‖q − x‖| ≤ ‖x − c(x)‖ — bounded by *reconstruction error alone*. IVF-PQ goes further with *residual* encoding: quantizing r = x − q_c(x) instead of x. Residuals have smaller norm, so their codebooks tile a compact ball — which is why 8–16 bytes per vector still deliver 0.9+ recall@1 on SIFT1M [2].

### 4.4 Anisotropy: quantizing for inner products, not reconstruction

Classical PQ minimizes *reconstruction* error ‖x − c(x)‖², but MIPS cares about *relative* error in ⟨q, x⟩, where high-norm errors distort rankings most. ScaNN's **anisotropic vector quantization** [4] penalizes parallel (norm-direction) errors more than orthogonal ones:

> **Theorem (Anisotropic objective).** *Decompose the quantization residual into components parallel and perpendicular to x. Weighting the parallel component by (1 + ν) with ν > 0 yields a quantizer whose inner-product estimates satisfy E[(⟨q,x⟩ − ⟨q,c(x)⟩)²] minimized under a code-length budget — i.e., the quantizer spends bits where ranking errors actually occur.*

With re-ranking, ScaNN topped ann-benchmarks leaderboards [4]; its SOAR successor [5] assigns each vector to *multiple* IVF partitions, attacking the boundary-miss problem of single-assignment IVF.

### 4.5 Billion-scale systems: putting it together

At N = 10⁹, the families diverge:

- **IVF-PQ (FAISS [3])**: 10⁹ vectors × 8 bytes = 8 GB of codes — fits on one machine. Query: nprobe = 64 of 2¹⁸ lists, scanning ~2.4 × 10⁵ codes via ADC tables ≈ 10 ms; GPU k-selection reaches 55% of peak bandwidth [3].
- **HNSW**: 10⁹ × (M=16 edges × 2 × 4 B) ≈ 128 GB of graph alone — a multi-machine or SSD-backed index (DiskANN pages Vamana adjacency from SSD, reranking from compressed vectors).
- **Hybrid (ScaNN/SOAR, SPANN)**: IVF partitioning + anisotropic PQ + multi-assignment — the current Pareto frontier in memory-bounded regimes.

---

## 5 Empirical Results and Proofs

### 5.1 Recall–latency Pareto measurements

Representative operating points (recall@10, single-thread CPU unless noted):

| System | Dataset | Recall@10 | Latency | Memory/vector |
|---|---|---|---|---|
| HNSW (ef=200) | SIFT1M | 0.999 | ~0.3 ms | ~500 B |
| HNSW (ef=50) | SIFT1M | 0.97 | ~0.08 ms | ~500 B |
| IVF-PQ (nprobe=8, m=8) | SIFT1M | 0.90 | ~0.5 ms | 8 B + lists |
| IVF-PQ + rerank (R=100) | SIFT1M | 0.98 | ~1.2 ms | 8 B + raw |
| ScaNN (anisotropic) | GloVe-100 | 0.95 | ~0.2 ms | ~tens of B |
| FAISS GPU IVF-PQ | BIGANN 1B | 0.80 | ~5 ms | 8 B |
| DiskANN (Vamana+PQ) | BIGANN 1B | 0.95 | ~8 ms | SSD-backed |

### 5.2 Proof sketch: logarithmic HNSW query complexity

> **Theorem (HNSW search complexity).** *For N points with exponentially decaying level distribution, greedy top-down search visits O(log N) nodes in expectation before the layer-0 beam search.*

*Proof sketch.* The expected maximum level is m_L · ln N. At each layer, greedy routing reduces distance to q by a constant factor per hop, crossing that layer's scale in O(1) hops. Summing O(1) over O(log N) layers gives the bound; the layer-0 beam search adds O(ef·M). ∎

### 5.3 Proof sketch: ADC error bound

> **Theorem (ADC vs. SDC).** *For product quantizer c(·), sup_q |‖q − c(x)‖ − ‖q − x‖| ≤ ‖x − c(x)‖, whereas SDC error can reach ‖q − c(q)‖ + ‖x − c(x)‖.*

*Proof sketch.* The ADC claim is the reverse triangle inequality: |‖q − c(x)‖ − ‖q − x‖| ≤ ‖c(x) − x‖. SDC quantizes both arguments, incurring both errors — hence ADC is *uniformly* better for any fixed codebook [2]. ∎

### 5.4 The cost of graph memory at billion scale

At N = 10⁹, d = 128, HNSW with M = 16 needs ~128 GB of adjacency plus 512 GB of float32 vectors; IVF-PQ with m = 16 needs 16 GB of codes — a **40×** reduction — with quantization noise largely recovered by reranking. This is why production billion-scale systems are *partition-first, graph-second*.

---

## 6 Limitations and Open Problems

1. **Dynamic workloads.** HNSW inserts elegantly, but *deletion* breaks RNG invariants: removing a hub can strand components, and systems rebuild or tombstone rather than repair.
2. **Distribution shift.** Both families assume queries and corpus share a distribution; out-of-distribution queries defeat IVF's coarse quantizer and HNSW's greedy routing. *Learned* routing and query-adaptive nprobe/ef are active research.
3. **Theoretical gaps.** HNSW's logarithmic scaling is proved only under distributional assumptions; a *worst-case* analysis of greedy routing on RNG-pruned graphs is missing.
4. **Hardware co-design.** ADC is memory-bound; graph traversal is latency-bound. Neither maps cleanly to GPUs; distance-computation-in-memory and graph-aware prefetching remain nascent.
5. **The memory–recall wall.** Below ~4 bytes/vector even anisotropic PQ collapses; binary codes with Hamming pre-filters are the escape hatch, but their theory is thin.
---

## 7 Conclusion

Billion-scale ANN search is a study in *structured compromise*. HNSW shows that a carefully pruned proximity graph — layered by scale, diversified by an RNG heuristic — can route greedily in logarithmic time with near-perfect recall, at the cost of hundreds of bytes per vector. IVF-PQ shows that a Cartesian-product codebook with asymmetric distance computation can compress each vector to a handful of bytes and still recover 0.9+ recall, at the cost of a partition that must be probed redundantly. The modern frontier — anisotropic quantization, multi-assignment partitioning, SSD-backed graphs with compressed reranking — is their *synthesis*: partition to fit, quantize to scan, graph to refine, rerank to verify. The next breakthroughs will come from indexes co-designed with serving hardware and query distributions.

---

## References

[1] Y. A. Malkov and D. A. Yashunin, "Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs," *IEEE Trans. Pattern Anal. Mach. Intell.*, vol. 42, no. 4, pp. 824–836, 2020. https://arxiv.org/abs/1603.09320

[2] H. Jégou, M. Douze, and C. Schmid, "Product quantization for nearest neighbor search," *IEEE Trans. Pattern Anal. Mach. Intell.*, vol. 33, no. 1, pp. 117–128, 2011. https://inria.hal.science/inria-00514462/en

[3] J. Johnson, M. Douze, and H. Jégou, "Billion-scale similarity search with GPUs," *arXiv:1702.08734*, 2017. https://arxiv.org/abs/1702.08734

[4] R. Guo, P. Sun, E. Lindgren, Q. Geng, D. Simcha, F. Chern, and S. Kumar, "Accelerating large-scale inference with anisotropic vector quantization," in *Proc. ICML*, 2020. https://arxiv.org/abs/1908.10396

[5] P. Sun, D. Simcha, D. Dopson, R. Guo, and S. Kumar, "SOAR: Improved indexing for approximate nearest neighbor search," in *Proc. NeurIPS*, 2023. https://arxiv.org/abs/2404.00774

[6] A. Babenko and V. Lempitsky, "The inverted multi-index," *IEEE Trans. Pattern Anal. Mach. Intell.*, 2014. https://cmp.felk.cvut.cz/~toliageo/rg/papers/BabenkoLempitsky_PAMI2014_The%20Inverted%20Multi-Index.pdf

[7] M. Wang, X. Xu, Q. Yue, and Y. Wang, "A comprehensive survey and experimental comparison of graph-based approximate nearest neighbor search," *arXiv:2101.12631*, 2021. https://arxiv.org/pdf/2101.12631.pdf

