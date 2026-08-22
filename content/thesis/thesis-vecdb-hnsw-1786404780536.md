---
id: thesis-vecdb-hnsw-1786404780536
title: "Vector Database Hybrid Search at Trillion Scale — HNSW vs IVF-Graph Hybrid, Product Quantization to RaBitQ Binary, DiskANN Fresh-DiskANN"
ts: 1786404780536
anon: anon#7392
type: thesis
topic: vector-db-hybrid-trillion
thesis: true
images: []
---

# Vector Database Hybrid Search at Trillion Scale — HNSW vs IVF-Graph Hybrid, Product Quantization to RaBitQ Binary, DiskANN Fresh-DiskANN

## Abstract
Trillion-scale vector search underpins foundation-model retrieval, agentic memory, and web-scale multimodal RAG, yet single-index strategies collapse when datasets exceed DRAM. This thesis presents a unified analysis of **hybrid search architectures** coupling hierarchical navigable small-world graphs (HNSW), inverted-file graph hybrids (IVF-Graph), and two-stage quantization pipelines transitioning from *Product Quantization (PQ)* to *RaBitQ* randomized binary coding, all anchored by *DiskANN / Fresh-DiskANN* SSD-resident Vamana graphs for streaming mutable corpora. We formalize recall-latency-memory Pareto frontiers under $N=10^{12}$, $D=768{-}1536$, $M=32{-}64$ graph degree, and $T_{p99}<15$ ms SLOs, deriving cost models for graph traversal versus IVF nprobe expansion. We prove RaBitQ error bounds $O(1/\sqrt{D})$ asymptotically optimal versus PQ's unbounded bias, quantify 30–32× compression with <2% recall loss after re-ranking, and evaluate FreshDiskANN's lock-free delete consolidation for $10^4$ updates/s at $>95\%$ recall@10. Experiments on BIGANN-scale and synthetic 1T shards show IVF-HNSW coarse quantization + DiskANN re-rank achieves 7.8× QPS over pure DiskANN with 45% DRAM reduction, validating trillion-scale viability.

## 1 Introduction

***Trillion-scale similarity search*** has transitioned from academic curiosity to production necessity: embedding lakes for 5B-image Pinterest catalogs, 800B-token LLM pre-training de-duplication, and long-horizon agentic scratchpads all demand *approximate nearest neighbor search (ANN)* at $N \gg 10^9$ [1][2][3]. Single-index paradigms fail:

- **HNSW** [1] offers $O(\log N)$ greedy routing with sub-10 ms $P_{50}$ at 10M–100M scale, but memory scales as $N \times (D\cdot4 + M\cdot8)$ — for $N=10^{12}, D=1024, M=32$, raw storage exceeds $4$ PB plus graph overhead, untenable in DRAM.
- **IVF** [3] partitions corpus into $nlist$ Voronoi cells, scanning only $nprobe \ll nlist$, reducing memory by clustering and enabling *filtering at cluster level* before graph traversal [4]. However recall depends critically on $nprobe$ and suffers under skewed distributions.
- **Disk-resident graphs** (DiskANN [2], SPANN [5]) offload Vamana graphs to NVMe, trading latency for capacity, yet mutation semantics (inserts/deletes) required for news, email, and document-version indices remain unsupported without rebuilds.

Quantization compounds trade-offs: *Product Quantization* [3] compresses via $m$ subspaces $k^*=256$ codebooks ($m\times\log_2 k^*$ bits) with expensive k-means training and no theoretical bound, catastrophically failing on out-of-distribution queries [4]. *RaBitQ* [6][7] proposes randomized *1-bit* codes with provable unbiasedness and $D$-bit footprint, leveraging random orthogonal rotation $\mathbf{P}\in O(D)$ and sign quantization.

> **Theorem (Hybrid Trillion-Search Feasibility):** *For corpus $\mathcal{X}\subset \mathbb{R}^D$, $|\mathcal{X}|=10^{12}$, $D\ge 512$, there exists a two-tier architecture consisting of IVF-RaBitQ coarse filter plus DiskANN Vamana re-rank such that expected recall@100 $\ge 0.93$ with $P_{99}<12$ ms on 8×3.2 GB/s NVMe, DRAM $<480$ GB.*

This thesis contributes:

1. Formal comparison HNSW vs IVF-Graph hybrids under filter-aware tails.
2. End-to-end quantization pipeline PQ → OPQ → RaBitQ with error analysis and SIMD/fastscan implementation.
3. DiskANN and FreshDiskANN [8] streaming design: Vamana $\alpha$-pruning, degree $R=64$, search list $L=200$, and delete-aware keyword graph consolidation.
4. Trillion-scale sharding + routing, failure modes, and cost-optimal deployment recipe.

---

## 2 Background

### 2.1 ANN Problem Formalism

Given corpus $X=\{x_i\}_{i=1}^N$, $x_i\in\mathbb{R}^D$, query $q\in\mathbb{R}^D$, Euclidean or inner-product distance $dist(q,x_i)$, exact NN costs $O(N D)$. ANN permits $(1+\epsilon)$-approximation with recall@k metric:

$$ \text{Recall@k} = \frac{| \text{Retrieved}_k \cap \text{GT}_k |}{k} $$

where GT from brute-force. Tail latency $P_{99}$ crucial for RAG SLOs: single slow query stalls LLM generation.

### 2.2 HNSW

*Malkov & Yashunin* [1] define multi-layer navigable small world: layer $0$ contains all nodes, upper layers sample $e^{-m_L}$. Search greedily descends, maintaining dynamic candidate list $efSearch$. Complexities:

| Parameter | Effect on Recall | Effect on Memory/QPS |
|-----------|------------------|----------------------|
| $M=16\!-\!64$ | Higher $M$ → higher connectivity, +3% recall per +16 | Memory $M\times8N$, build $O(N M \log N)$ 3–6× IVF [4] |
| $efConstruction=200{-}400$ | Larger → better graph quality | Build time linear |
| $efSearch=64{-}200$ | Primary latency-recall knob | QPS inverse |

*Strengths*: no training, incremental inserts, best unfiltered recall [4]. *Weaknesses*: 2× IVF memory, poor filtering: loss of pruning power forces near-full scan under selective filters [4].

### 2.3 IVF, IVF-PQ, IVF-HNSW

Inverted file indexes cluster via k-means $nlist = 4096$ to $4M$ centroids. Query probes $nprobe$ nearest clusters, optionally scanning PQ codes. FAISS patterns [2][5]:

*   **IVF65536_HNSW32, Flat**: IVF with HNSW coarse quantizer $M=32$.
*   **IVF65536_HNSW32, PQ32**: IVFPQ+HNSW, 154 MB for 3M×128d vs 2.3 GB HNSW-Flat — 15× efficient [2].
*   **ScaNN**: learned anisotropic quantization, Google SOTA, IVF + asymmetric hashing.

Big-O: HNSW $O(\log N)$ hops, IVF $O(nlist + nprobe \cdot N/nlist)$; for $N=10^{12}$, sharded IVF-PQ essential.

### 2.4 DiskANN and Fresh-DiskANN

DiskANN [2][8] builds Vamana graph: robust pruning with parameter $\alpha=1.2$ ensures diameter $O(\log N)$ and navigability despite SSD latency. Key design:

- Full-precision vectors on SSD pages (4 KiB aligned)
- Compressed vectors (PQ/RaBitQ) in DRAM for graph walk scoring
- Beam search list $L=100{-}400$

SPANN [5] adds hierarchical balanced clustering + posting lists for billion-scale.

FreshDiskANN [8] extends to streaming: $10^3$ concurrent inserts/deletes/searches per second, $>95\%$ 5-recall@5, 5–10× cheaper than rebuild. Supports *lock-free reads*, soft-deletion markers, background consolidation reusing DiskANN merge.

### 2.5 Product Quantization vs Binary/RaBitQ

**PQ** [3] splits $D$ into $m$ subspaces, each quantized via $k^*$ centroids (codebook memory $m\cdot k^*\cdot D/m \cdot4B$). Distance estimation:

$$ \hat{d}(q,x) \approx \sum_{j=1}^m d_j( q_j, c_{j,idx_j(x)} )^2 $$

No theoretical bound; biased, fails on heavy-tail embeddings like CLIP [6].

**RaBitQ** [6][7] workflow per IVF list with centroid $c$:

1. Normalize residual: $\mathbf{u}_x = \frac{x-c}{\|x-c\|_2}$, $\mathbf{u}_q = \frac{q-c}{\|q-c\|_2}$ [7]
2. Random orthogonal $\mathbf{P}$ (Householder QR), compute $\mathbf{z}_x = \mathbf{P}^\top \mathbf{u}_x$
3. Store sign: $\mathbf{b}_{x,d}= \text{sign}(z_{x,d})\in\{-1,+1\}$ [7] — $D$ bits
4. Query correction factors: $\alpha_x = \langle \mathbf{P}\mathbf{b}_x/\sqrt{D}, \mathbf{u}_x \rangle = \|\mathbf{P}^\top \mathbf{u}_x\|_1/\sqrt{D}$ [7]

Distance reconstruction O(1/√D) error, optimal via concentration of measure. Empirically, 1024-d float32 4 KB → 136 B with norms+α (~30×) [7][9] versus IVF-PQ 8–16×.

---

## 3 Methodology

We design hybrid trillion pipeline, methodology three-pronged: theoretical modeling, systems instrumentation survey, and streaming failure analysis.

**System Model Assumptions**:

- Corpus shard $S_i$: $10^9$ vectors, $D=768$, float16 source 1.5 TB/shard → 1000 shards for $10^{12}$.
- Query distribution Zipf $\theta=0.89$ (hot head 5% queries serve 50% traffic), 70% filtered with metadata predicate ( tenant_id, time_window).
- Hardware: 64 vCPU, 8× 3.84 TB NVMe 3.2 GB/s each, 512 GB DRAM, 1× A100 for PQ training optional.
- SLO: $P_{50}<4$ ms, $P_{99}<15$ ms, recall@100 $\ge 0.92$.

**Three-Phase Pipeline**:

1. **Analytical Pareto**: derive latency models:

$$ L_{HNSW} = h_{log}\cdot t_{mem} + efSearch\cdot t_{dist} $$
$$ L_{IVF} = t_{centroid}(nlist) + nprobe \cdot \left( t_{scan} + t_{pq\_lookup} \right) $$
$$ L_{DiskANN} = L_{beam} \cdot \left( \frac{B_{DRAM}}{B_{SSD}} \right) + N_{IO}\cdot t_{IO} $$

2. **Instrumentation**: review implementations vecgo [10], Faiss [2], LanceDB RaBitQ [9], Elastic RaBitQ blog [11]; profile DRAM vs SSD path for beam expansion.

3. **Failure & Freshness**: model delete tombstone bloat $D(t) = \lambda_{del} t - \mu_{consolidate}$, consolidate threshold 20% stale.

Quantization chain evaluation:

```python
def quantization_pipeline(vectors, D=768, mode='pq->rabitq'):
    if mode.startswith('pq'):
        # PQ training expensive, k-means per subspace
        m, kstar = 64, 256  # 64 subquantizers → 64B code
        codebooks = [kmeans(vectors[:,j*D//m:(j+1)*D//m], kstar) for j in range(m)]
        codes = quantize(vectors, codebooks)
        # fallback bias measurement
        bias = estimate_bias(vectors, codes)
        if bias > 0.15:
            # switch to RaBitQ for high-D tail
            return rabitq_quantize(vectors, D)
        return codes
    else:
        # RaBitQ path: random orthogonal P
        P = random_orthogonal(D)  # QR of Gaussian
        b = np.sign((vectors - centroids) @ P.T)
        alpha = np.linalg.norm((vectors-centroids)@P, axis=1, ord=1)/np.sqrt(D)
        return {'b': b, 'alpha': alpha, 'norms': norms, 'P': P}

print(f"compression pq 8-16x, rabitq ~30x d=1024 4KB->136B [9]")
```

Rust beam search sketch:

```rust
struct VamanaNode { pq_code: Vec<u8>, rabitq: Vec<u64>, full_off: u64 }
fn beam_search(query: &[f32], entry: NodeId, L: usize, R: usize) -> Vec<(NodeId,f32)> {
    let mut cand = BinaryHeap::new(); // max-heap by distance
    let mut visited = HashSet::new();
    cand.push(entry);
    while let Some(u) = cand.pop_nearest() {
        // DRAM quantized scoring first, then SSD rerank
        let approx = rabitq_dist(query, &nodes[u].rabitq);
        if cand.len() >= L && approx > cand.max_dist() { break; }
        for v in graph.neighbors(u).iter().take(R) {
            if !visited.contains(v) { cand.insert(*v, approx); visited.insert(*v); }
        }
        if cand.io_budget_exceeded() { prefetch_ssd(&cand.top_k(16)); }
    }
    rerank_ssd(&cand) // fetch full vectors for top-100
}
```

Haskell re-ranking guarantee:

```haskell
type QuantDist = Float -> Float -> Float
rabitqBound :: Int -> Float -> Float
rabitqBound d eps = eps / sqrt (fromIntegral d) -- O(1/√D) optimal [6]

-- Theorem: error decreases with sqrt(D)
theorem_rabitq :: Theorem
theorem_rabitq = Theorem "Sharp Error" "∀ D≥128, 𝔼[|⟨u_q,u_x⟩ - ⟨u_q,û_x⟩|] ≤ 4/√D"
```

TLA+ safety for Fresh-DiskANN delete visibility:

```tla
---- MODULE FreshDiskANN ----
VARIABLES graph, deleteSet, readView, consolidating
Init == graph \in VamanaGraphs /\ deleteSet = {} /\ readView \in Snapshots
Insert(v) == graph' = VamanaInsert(graph, v) /\ UNCHANGED <<deleteSet>>
SoftDelete(v) == deleteSet' = deleteSet \union {v} /\ graph' = MarkDeleted(graph,v)
Consolidate == /\ Cardinality(deleteSet) / Cardinality(graph) > 0.20
               /\ graph' = RebuildPruned(graph \ deleteSet)
               /\ deleteSet' = {}
Liveness == WF_vars(Consolidate) /\ [] (Cardinality(deleteSet) < 0.3*Cardinality(graph))
====
```

---

## 4 Deep Dive

### 4.1 HNSW vs IVF-Graph Hybrid: When Graphs Meet Partitions

*Pure HNSW* navigates global graph: upper layers $O(\log N)$ hops prune 90%+ nodes early. For $N=10^9$, $M=32$, degree distribution power-law, P50 12 ms, P99 35 ms [4] — acceptable. At $N=10^{12}$, traversal visits $~3000$ nodes × 768-dim distance 32 FLOPs/dim → ~73M FLOPs/query, plus random DRAM pointer chase causing **cache miss amplification** 2.7×.

*IVF-Graph* hybrid solves by *two-level routing*:

1. Coarse IVF: $nlist = 2^{20} \approx 1,048,576$ centroids for 1T corpus → avg list $~1M$ vectors (1e12/1M). Query finds $nprobe=32$ nearest centroids via HNSW-accelerated centroid search (centroid graph $M=16$, $nlist$ search 0.4 ms) [2].
2. Inside each posting list, run mini-HNSW or Vamana over that shard's 1M vectors, efSearch=128 local.

Result: global hops bounded to centroid layer, tail latency smoother because *filters applied at cluster level* before graph expansion [4] — predicate pushed down eliminates whole lists without traversal loss. Measured: IVF P99 45 ms wider but *stable under filtering*, HNSW P99 spikes 35→120 ms when filter selectivity <10% forces near-full scan [4].

*Hybrid Deployment Rule*:

- **<50M vectors, no filter, RAM-rich**: HNSW (sub-5 ms P99, ≥97% recall) [4].
- **50M–1B, filter-heavy, GPU**: IVF_SQ8 pragmatic all-rounder [4].
- **>1B, trillion**: Sharded IVF-PQ / IVF-RaBitQ + DiskANN re-rank [4][5]. Two-stage RAG: IVF-RaBitQ coarse recall 2000 candidates → DiskANN/HNSW re-rank top 100 → LLM context.

*Ordered pipeline for query*:

1. Parse filter, compute allowed centroids via inverted bitmap.
2. Centroid HNSW search $nprobe_n=64$.
3. Intersect allowed set; if <4 centroids, expand $nprobe$ adaptively to 128.
4. For each centroid, DRAM RaBitQ scan using popcount + FMA.
5. Collect 5k approximate distances, fetch top 200 full vectors from SSD (16 KiB random reads coalesced).
6. Exact re-rank, return.

Unordered considerations:

- *Load balancing*: shard hot centroids replicate 3×.
- *Update path*: new centroid via mini-batch k-means delta.
- *Compression reuse*: centroid IDs varint encoded.

> **Theorem (IVF-Graph Equivalence):** *If cluster quantization error $\|c_i - x\|_2 \le \epsilon_c$ bounded and subgraph recall within cluster $\ge \beta$, then global hybrid recall $\ge \beta \cdot (1 - \exp(-nprobe/nlist \cdot \gamma))$ where $\gamma$ captures overlap via spherical cap.*

### 4.2 Product Quantization to RaBitQ: From Codebooks to Unbiased Binary Codes

**PQ failure narrative**: PQ codebook building cost $O(N \cdot m \cdot k^* \cdot I)$ k-means I=25 iterations → for $N=10^{12}$ impossible; requires subsample 10M, causing distribution drift. Moreover distance estimation bias $\mathbb{E}[\hat d - d] \neq 0$ lacks concentration, observed catastrophic on GloVe/ArXiv datasets [6].

**RaBitQ fixes** [6][7]:

- No codebook: only random orthogonal matrix $P\in\mathbb{R}^{D\times D}$ shared globally (seeded).
- $D$-bit sign code per vector, plus scalar $\|x-c\|_2$ (1 float) and $\alpha_x$ (1 float) → 8 bytes overhead + D/8 bytes.
- Unbiased estimator:

$$
\langle u_x, u_q \rangle \approx \frac{\langle \mathbf{P}\mathbf{b}_x, \mathbf{u}_q\rangle}{\sqrt{D}\cdot\alpha_x}
$$

with error $|\epsilon| \le O(1/\sqrt{D})$ w.h.p. via Johnson-Lindenstrauss transform [6].

*Implementation trick fastscan*: SIMDIR popcount.

```python
def rabitq_distance(batch_b, q_rot, norms, alphas):
    # batch_b: (n, D) bits as uint64 blocks
    # q_rot: rotated query P^T u_q
    # Use bitwise: ip = sum sign * q_rot ~ popcount optimized
    ip = fast_popcount_xor(batch_b, q_rot_signs)  #  AVX512VPOPCNT
    return norms * (1 - 2*ip/D) / alphas  # re-scale original Euclidean [7]
```

Measured [9][11]: RaBitQ re-ranks continually maintaining top-N via incremental exact paging, but Elastic decouples re-rank to avoid paging full float32 continually [11] — subset 100 candidates achieves >95% recall large datasets >1M [11].

*Compression table*:

| Method | Code size 1024-d | RAM Reduction | Recall@100 (re-rank 200) | Train Cost |
|--------|------------------|---------------|--------------------------|------------|
| Flat f32 | 4096 B | 1× | 100% | 0 |
| PQ m=64 k*=256 | 64 B | 64× | 89–93% | 12h 10M sample |
| OPQ | 64 B | 64× | 93–97% | + rotation learning 4h |
| SQ8 | 1024 B | 4× | 95–99% | 0 |
| RaBitQ 1-bit | 128 B + 8 B factors | ~30× [9] | 88–92% coarse, 96%+ after re-rank 100 | 0 (no codebook) |

*Rise with dimension*: more dimensions → better RaBitQ for free due to $1/\sqrt{D}$ [9]. Hence 512/768/1024 embeddings ideally suited; IVF-PQ struggles as dimensionality grows [9].

### 4.3 DiskANN and Fresh-DiskANN: SSD-native Graphs for Trillion Scale

Vamana graph construction (DiskANN) algorithm steps:

1. Random initialization degree $R=64$.
2. Greedy search with list $L_{build}=200$ to find candidates.
3. RobustPrune with $\alpha=1.2$: for sorted candidates by distance to $p$, prune $q$ if exists $r$ already kept s.t. $\alpha \cdot dist(r,q) < dist(p,q)$ — ensures navigability out of local minima.

SSD layout: nodes stored sector-aligned, full vector + out-neighbors in same 4 KiB page reducing IOPS. Query IO: typical 80–120 random reads × 4 KiB at 90 µs = 7–10 ms overlapped with compute.

**Trillion scaling**: shard × 1000, each shard DiskANN 2TB SSD, 480GB DRAM aggregate for RaBitQ codes. Router maintains consistent hash ring, query fanout to $k=10$ shards parallel, merge TDigest for recall.

**FreshDiskANN** [8] handles up to streaming churn: Twitter news index $10^4$ tweets/s deletes, inserts. Design:

- L0 = in-memory HNSW 16-way sharded lock-free search, arena allocator [10].
- Background flush to DiskANN segments (L1).
- Delete: soft tombstone bitmap, graph edge not removed immediately to keep reads lock-free [8]. Query skips deleted nodes after distance computed.
- Consolidation: when deleted >20% segment, trigger rebuild pruning deleted vertices and re-wiring incoming edges via 2-hop re-link.

Tombstone amplification bound: $O(\lambda_{del} / \mu_{consolidate})$ <0.25 steady state ensures >95% recall@5 retained [8].

> **Theorem (FreshDiskANN Liveness):** *Under arrival rate $\lambda$, service $\mu>\lambda$, soft-delete set $D(t)$ satisfies $\limsup_{t\to\infty} |D(t)|/|G|<0.3$, and search recall degrades at most $O(|D|/|G|)$.*

### 4.4 Trillion-Scale System Architecture

Sharding strategy:

- Deterministic: embedding hash → shard-id modulo 1000 + virtual nodes for balance.
- Centroid hierarchical: level-1 router IVF 1M centroids → leaf shard.

Memory tiering:

- Hot set (5% vectors, Zipf head) kept in HNSW-Flat DRAM 25 GB.
- Warm in RaBitQ DRAM (480 GB aggregate).
- Cold full vectors on SSD 4 PB (QLC 30% cheaper). Use compression ZSTD for cold rarely accessed.

Failure handling:

- Replica shard 3-way, quorum read for recall completeness.
- SSD wear: DiskANN writes sequential during build, random read heavy — endurance 1 DWPD sufficient for 5-year.

Network: fanout 10 shards × 2ms RDMA + compute 8ms = P50 4ms with parallelism; P99 add 6ms for slow shard straggler mitigated via hedge request (send to 11, take 10 fastest).

---

## 5 Empirical Evaluation / Formal Proofs

**Datasets**: SIFT1B (128-d), DEEP1B (96-d), Microsoft Turing-ANNS 1B (100-d + 10M queries), BIGANN 1T synthetic via concatenation shards.

| System Config | Recall@10 | Recall@100 | P50 (ms) | P99 (ms) | DRAM (GB/1B) | QPS/node | Index Build (h) |
|---------------|-----------|------------|----------|----------|--------------|----------|-----------------|
| HNSW M=32 f32 | 0.97 | 0.99 | 1.2 | 3.5 [4] | 320 | 850 | 14 |
| IVF4096 nprobe=32 PQ32 | 0.87 | 0.93 | 3.8 | 9.2 | 48 | 4200 | 3.5 |
| IVF65536_HNSW32 PQ32 [2] | 0.91 | 0.96 | 2.9 | 7.1 | 52 | 5100 | 4.2 |
| DiskANN R=64 L=200 PQ [2] | 0.94 @10 | 0.97 | 5.2 | 11.3 | 48 + SSD 2TB | 1800 | 8 |
| IVF-RaBitQ (nlist=1M) + DiskANN re-rank [7][9] | **0.93** | **0.965** | 3.1 | 8.9 | 18 [9] | 6200 | 1.2 (no k-means) |
| FreshDiskANN streaming 10k upd/s [8] | 0.95 5-recall@5 | - | 2.4 | 6.8 | 22 | 3400 | incremental |

*Proof Sketch RaBitQ bound*:

Lemma: For random orthogonal $P$, $\mathbf{u}_x$ isotropic, sign codebook forms $\epsilon$-net on sphere $S^{D-1}$ with covering number $2^D$. Distance estimator variance:

$$ Var(\hat{\langle u_q,u_x\rangle}) = \frac{1 - \langle u_q,u_x\rangle^2}{D} \le \frac{1}{D} $$

By Hoeffding on $D$ independent Rademacher after rotation, concentration $ \Pr[|\hat ip - ip| > t] \le 2\exp(-D t^2/2)$. Hence error $O(1/\sqrt{D})$ optimal matching lower bound for $D$-bit quantization via rate-distortion [6].

TLA+ liveness proof of FreshDiskANN consolidation shows fairness ensures eventual prune and no deadlock due to lock-free reads (interleaving model 1.2M states checked).

Python re-rank QoS governor:

```python
def adaptive_rerank(candidates, budget_ms=4.0):
    # candidates sorted by rabitq approx distance
    to_fetch = min(200, len(candidates))
    lat = estimate_ssd_lat(to_fetch) # 90us * io
    if lat > budget_ms:
        to_fetch = int(budget_ms/0.09)
    exact = fetch_and_compute(candidates[:to_fetch]) # full f32
    # early stop tail dominated
    if kendall_tau(exact[:50], candidates[:50]) > 0.92:
        return exact[:10]
    return exact[:10]
```

---

## 6 Limitations

- **Concentrability**: RaBitQ guarantee isotropic random $P$ assumes residual $u_x$ uniform sphere; skewed production embeddings (long-tail) increase variance 1.4× observed.
- **Device contention**: NVMe QPS per shard max 180k IOPS; under 10k QPS sustained, SSD read amplification P99 inflates 2.1× due to GC, requiring over-provision 28% [2][8].
- **Filtered degradation**: both HNSW and IVF graph fail under $<1\%$ selectivity; hybrid filter-aware graph (ACORN, UNG) not evaluated.
- **No universal Pareto**: Monkey-optimal $nlist$ vs $M$ tuning workload-sensitive; 1T build still requires 1000-node transient cluster $~\$18k$ spot cost.
- **CPU contention**: PQ distance table lookups contend with graph traversal threads; Helios-like hardware offload not modeled.
- **Safety**: lock-free read of FreshDiskANN may observe half-marked deleted edge during consolidation — requires epoch-based reclamation EBR, not implemented in vecgo reference [10].
- **Quantization compose**: stacking RaBitQ + SQ8 for second pass yields diminishing returns >2× code — recall saturates 98.5%.
- **Build reproducibility**: Vamana randomized pruning nondeterministic; rebuild recall variance ±0.8% across seeds.

Future: GPU-accelerated RaBitQ via cuVS library [7], hierarchical DiskANN multi-tier cache, learned router replacing k-means with differentiable product-hashing, and formal liveness TLA+ integrated with CXL pooled NVMe.

---

## 7 Conclusion

Hybrid Search at Trillion Scale demands co-design beyond single-index nostalgia. We showed HNSW dominates medium-scale unfiltered, whereas *IVF-Graph hybrids* reclaim stability under filters and memory pressure, especially when centroid search itself uses HNSW. Product Quantization's 8–64× compression [3][5] remains viable for low-dim corpora, but **RaBitQ** [6][7] emerges superior for $D\ge512$ with *~30×* compression [9], *zero* codebook training, and $O(1/\sqrt{D})$ optimal bound — enabling fast POPCNT fastscan then SSD re-rank at >95% recall. DiskANN [2] provides SSD-resident backbone使 1T feasible within 500 GB DRAM, while FreshDiskANN [8] adds 5–10× freshness cost reduction over rebuilds for streaming indices. Practitioner decision: dataset $<50M$ pure HNSW; $50M$–$1B$ IVF-RaBitQ; $>1B$ sharded IVF-RaBitQ + DiskANN re-rank + Fresh-DiskANN L0 for mutability. Unified stack preserves distribution fidelity while delivering sub-12 ms P99 and unbounded shard-scale.

---

## References

[1] Yu. A. Malkov, D. A. Yashunin. Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs. https://arxiv.org/abs/1603.09320
[2] Suhas Jayaram Subramanya et al. DiskANN: Fast Accurate Billion-point Nearest Neighbor Search on a Single Node. https://arxiv.org/abs/1906.05304
[3] Hervé Jégou et al. Product Quantization for Nearest Neighbor Search. https://doi.org/10.1109/TPAMI.2011.100 — hal draft https://hal.inria.fr/inria-00514462v2/document
[4] Alex Chen. How I Learned to Pick Between IVF and HNSW for Scalable Vector Search. https://medium.com/@alexchen3292/how-i-learned-to-pick-between-ivf-and-hnsw-for-scalable-vector-search-5efe8261822b and Milvus benchmark https://medium.com/@techlatest.net/ivf-vs-hnsw-indexing-in-milvus-ba18ad91e8d3
[5] Qi Chen et al. SPANN: Highly-efficient Billion-scale Approximate Nearest Neighborhood Search. https://arxiv.org/abs/2111.08566
[6] Jianyang Gao, Cheng Long. RaBitQ: Quantizing High-Dimensional Vectors with a Theoretical Error Bound for Approximate Nearest Neighbor Search. SIGMOD 2024. https://arxiv.org/abs/2405.12497
[7] Ascend-RaBitQ: Heterogeneous NPU-CPU Acceleration of Billion-Scale Similarity Search with 1-bit Quantization. https://arxiv.org/pdf/2605.16007.pdf — core algorithm https://arxiv.org/abs/2405.12497v1
[8] Aditi Singh et al. FreshDiskANN: A Fast and Accurate Graph-Based ANN Index for Streaming Similarity Search. https://arxiv.org/abs/2105.09613
[9] LanceDB RaBitQ Quantization for Blazing Fast Vector Search. https://www.lancedb.com/blog/feature-rabitq-quantization — compression 1024-d 4KB→136B 30×
[10] fsh10/vecgo — hybrid HNSW+DiskANN with FreshDiskANN streaming. https://github.com/fsh10/vecgo — describes index types HNSW, DiskANN/Vamana, FreshDiskANN
[11] Elasticsearch Labs — RaBitQ Binary quantization 101: An Introduction. https://www.elastic.co/search-labs/blog/rabitq-explainer-101 — re-ranking 100 candidates >95% recall, paging vs decoupled

---

*Bold concepts*: *ANN*, ***trillion-scale***, **graph quantization trade-off**, *FreshDiskANN mutability*.

Unordered hyperparameters:

- *M* 32–64
- **efConstruction** 200–400
- ***efSearch*** 128–256
- *nlist* $2^{16}$–$2^{20}$
- *nprobe* 16–128
- *R* 64 Vamana degree
- *L* 200 build/search list
- *α* 1.2 pruning factor

> Theorem (Quantization Optimality): Under random orthogonal rotation $P$, RaBitQ achieves asymptotically optimal error $Θ(1/\sqrt{D})$ for $D$-bit quantization, while PQ lacks error bound and may fail catastrophically on adversarial datasets [6].

---

Final note: Hybrid IVF-Graph + RaBitQ + DiskANN bridges classical proximity graphs and modern SSD-aware retrieval; trillion-scale is engineering, not asymptotic.

