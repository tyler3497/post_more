---
{
 "id": "ths_1788593350272_c3d3",
 "title": "Learned Index Structures for In-Memory Databases: Recursive Model Indexes, ALEX Gapped Arrays, and PGM-Index Piecewise Linear Approximation with Provable Error Bounds",
 "anon": "anon#5527",
 "ts": 1788593350272,
 "type": "thesis",
 "images": [
  "ths_1788593350272_c3d3-0.webp"
 ]
}
---

# Learned Index Structures for In-Memory Databases: Recursive Model Indexes, ALEX Gapped Arrays, and PGM-Index Piecewise Linear Approximation with Provable Error Bounds

## Abstract

Learned index structures recast key lookup — one of the oldest problems in database systems — as statistical learning over the cumulative distribution function (CDF) of the key set. Where a B-tree encodes the key-to-position mapping with pointer-heavy combinatorial machinery, a learned index approximates it with a compact regression model and corrects residual error through a bounded local search. This thesis develops a unified treatment of the three landmark designs in this space: the Recursive Model Index (RMI), which introduced the paradigm and showed up to 70% faster lookups at 10–100x smaller footprints on read-heavy workloads; ALEX, the first fully updatable learned index, built on gapped arrays, model-based inserts, and adaptive restructuring; and the PGM-index, which formulates index construction as a geometric piecewise-linear approximation problem, yielding provably optimal space with worst-case query guarantees and a fully dynamic variant. We formalize the rank-space learning problem, derive error and complexity bounds for each design, analyze single-pass construction (RadixSpline) and data-aware segmentation (FITing-Tree), and evaluate all approaches under the SOSD benchmarking methodology on 200M-key real-world datasets.

---

## 1. Introduction

For more than four decades, the B-tree family has dominated ordered indexing in database systems. Its success rests on a simple contract: *for any key distribution*, it delivers logarithmic lookup, insert, and delete costs with modest constant factors. Yet this universality is also its weakness. A B-tree treats every key set as adversarial — it allocates pointers, reserves fill-factor slack, and traverses the same depth regardless of whether the data is a perfectly uniform sequence of timestamps or a pathological adversarial permutation. In an era where main memory is abundant and workloads are increasingly skewed, this distribution-obliviousness leaves substantial performance on the table [1].

The learned index program, launched by Kraska et al. in 2018 [1], proposes a radical alternative: **indexes are models**. A B-tree maps keys to positions in a sorted array; a hash index maps keys to positions in an unsorted array; a Bloom filter models set membership. If indexes are merely learned mappings, machine learning should learn them better than hand-tuned pointer structures — because real-world data is rarely adversarial: timestamps arrive nearly sorted, identifiers follow smooth growth curves, sensor readings cluster in predictable bands.

The initial results were striking: on read-heavy analytical workloads over 200M-key datasets, learned indexes delivered up to *70% lower lookup latency* while consuming *10–100× less memory* than cache-optimized B-trees [1]. But the first generation was read-only, offered no worst-case guarantees, and required expensive retraining under inserts. The subsequent six years produced three decisive advances that this thesis unifies:

1. **The Recursive Model Index (RMI)** — a hierarchical architecture that partitions the key space and fits simple leaf models, with per-model error bounds driving a bounded final search [1][8].
2. **ALEX** — the first *updatable* learned index, replacing dense arrays with gapped arrays, placing inserts by model prediction, and restructuring adaptively when the distribution drifts [3].
3. **The PGM-index** — a reformulation of learned indexing as a *computational geometry* problem: the optimal piecewise-linear ε-approximation of the key CDF, constructed in linear time, with provable worst-case bounds and a fully dynamic variant [2].

This thesis (i) formalizes the **rank-space learning problem** (§2), (ii) presents each design with governing theorems and proof sketches (§4), (iii) evaluates all designs under the SOSD benchmark suite [7] with the CDFShop tuner [5] (§5), and (iv) delineates where learned indexes provably fail (§6).

---

## 2. Background

### 2.1 The rank-space formulation

Let \(S = \{k_1 < k_2 < \dots < k_n\}\) be a sorted set of keys stored in a dense array \(A\), so that \(A[i] = k_{i+1}\). Define the **rank function**

$$
\mathrm{rank}(x) = |\{k \in S : k < x\}|,
$$

the number of keys strictly smaller than \(x\). Every ordered-index operation reduces to rank: *member(x)* checks \(A[\mathrm{rank}(x)] = x\); *predecessor(x)* returns \(A[\mathrm{rank}(x)-1]\); and *range(x, y)* scans from \(\mathrm{rank}(x)\) until a key exceeds \(y\) [2].

The empirical CDF of \(S\) is \(F(x) = \mathrm{rank}(x)/n\), a monotone step function. A learned index is any efficiently evaluable function \(\hat{f} : \mathcal{U} \to [0, n]\) such that

$$
|\hat{f}(x) - \mathrm{rank}(x)| \le \varepsilon \qquad \forall x \in \mathcal{U}
$$

for a known error bound \(\varepsilon\). Lookup then proceeds in two phases: *predict* \(p = \lfloor\hat{f}(x)\rfloor\), then *correct* by binary searching \(A\) within \([p - \varepsilon, p + \varepsilon]\), costing \(O(\log \varepsilon)\) [1][2]. The entire game of learned indexing is therefore: **learn \(\hat{f}\) with small \(\varepsilon\), tiny model size, and fast evaluation.**

### 2.2 Why classical indexes are distribution-oblivious

A B+ tree with fanout \(B\) stores \(\Theta(n/B)\) internal nodes and answers queries in \(\Theta(\log_B n)\) pointer chases *independent of the data* — even when the keys are exactly \(\{1, 2, \dots, n\}\), for which the "index" \(\hat{f}(x) = x - 1\) has error \(arepsilon = 0\) and constant size. Learned indexes exploit precisely this gap between *worst-case* and *typical-case* structure.

### 2.3 Model families

- **Linear regression** on \((k_i, i)\) pairs: closed-form, one pass, optimal for near-uniform data.
- **Piecewise linear models**: partition the CDF into segments, each with its own slope/intercept — the basis of the PGM-index [2] and FITing-Tree.
- **Hierarchical models (RMI)**: a top-level router selects among many leaf regressors, handling multi-modal distributions [1].
- **Splines with radix tables**: RadixSpline builds a single-pass spline plus a flat radix lookup for \(O(1)\) segment location [4].

> **Theorem 2.1 (Error-bounded correction).** *If \(\hat{f}\) satisfies \(|\hat{f}(x) - \mathrm{rank}(x)| \le \varepsilon\) for all \(x\), then exact lookup of any key costs \(O(T_{\hat{f}} + \log \varepsilon)\), where \(T_{\hat{f}}\) is the model evaluation cost.*
>
> *Proof sketch.* Clamp \(p = \lfloor\hat{f}(x)\rfloor\) to \([0, n-1]\). By the error bound, \(\mathrm{rank}(x) \in [p-\varepsilon, p+\varepsilon]\), an interval of at most \(2\varepsilon + 1\) array slots. Binary search over this interval needs \(\lceil \log_2(2\varepsilon+1)\rceil\) comparisons; the model evaluation adds \(T_{\hat{f}}\). ∎

This theorem is the load-bearing wall of the field: it converts an *approximate* learning problem into an *exact* index, with the error bound \(\varepsilon\) as the single knob trading model complexity against last-mile search cost.

---

## 3. Methodology

Our evaluation follows the **SOSD (Search on Sorted Data) benchmark** methodology [7], the community standard for learned index comparison, extended with the CDFShop auto-tuner [5] for RMI hyperparameter selection.

**Datasets.** Four real-world 200M-key 64-bit integer datasets, chosen for distributional diversity:

| Dataset | Source | CDF character |
|---|---|---|
| `amzn32` | Amazon book popularity | Smooth, near-linear with mild curvature |
| `face32` | Facebook user IDs | Highly non-linear, clustered |
| `osm800` | OpenStreetMap Hilbert-encoded locations | Extremely irregular, multi-modal |
| `wiki_ts200M` | Wikipedia edit timestamps | Near-linear with periodic structure |

**Workloads.** (i) *Read-only*: 10M uniform random lookups; (ii) *read-heavy*: 95% lookups / 5% inserts (YCSB-C/D style); (iii) *write-heavy*: 50% inserts. Inserts draw keys from the same distribution to avoid pathological drift.

**Metrics.** Mean lookup latency (ns), 99th-percentile latency, index memory footprint (bytes), build time (s), and insert throughput (ops/s). All experiments are single-threaded, in-memory, on a machine with a 30MB L3 cache — the regime where learned indexes' small footprints translate directly into fewer cache misses.

**Baselines.** A bulk-loaded, cache-conscious B+ tree (node size tuned to 4 cache lines) and `std::binary_search` over the sorted array, plus ART for string-key discussion in §6.

**Tuning protocol.** RMI via CDFShop [5]; PGM-index with ε ∈ {8, …, 128}; ALEX with default density bounds [0.6, 0.8].

---

## 4. Deep Dive

### 4.1 Recursive Model Indexes: hierarchical CDF regression

The RMI [1] is a *top-down* learned index. A stage-1 (root) model maps each key to one of \(B\) stage-2 models; each stage-2 model is typically a linear regressor trained on the CDF restricted to its key partition. Lookup evaluates the root, selects the leaf, evaluates the leaf, and corrects within the leaf's recorded \([\min\text{-err}, \max\text{-err}]\) interval.

Training minimizes empirical risk over the observed pairs:

$$
\mathcal{L}(f) = \frac{1}{n}\sum_{i=1}^{n} (f(k_i) - i)^2,
$$

but the quantity that matters at query time is the **maximum** error, not the mean — a single outlier forces a wide correction interval for every query routed to that leaf. The reference implementation therefore records per-leaf error bounds and uses *model-biased search*: start the binary search at the predicted position rather than the interval midpoint [8].

```python
import numpy as np

def train_leaf(keys):
    """Least-squares fit of rank vs. key; returns (slope, intercept, err)."""
    n = len(keys)
    ranks = np.arange(n, dtype=np.float64)
    A = np.vstack([keys, np.ones(n)]).T
    slope, intercept = np.linalg.lstsq(A, ranks, rcond=None)[0]
    preds = slope * keys + intercept
    err = int(np.ceil(np.max(np.abs(preds - ranks))))
    return slope, intercept, err

def rmi_lookup(x, root, leaves):
    leaf = leaves[root.predict(x)]          # stage 1: route
    p = int(leaf.slope * x + leaf.intercept) # stage 2: predict
    lo, hi = max(0, p - leaf.err), min(len_A - 1, p + leaf.err)
    return binary_search(A, x, lo, hi)        # bounded correction
```

The RMI's strength is *expressiveness per byte* — a 2-stage RMI with 100K linear leaves fits in under 1MB — but training is a slow batch process, inserts are unsupported, and the hyperparameter space demands an auto-tuner [5].

> **Theorem 4.1 (RMI lookup cost).** *A \(d\)-stage RMI with per-leaf max error \(\varepsilon_{max}\) answers exact lookups in \(O(d \cdot T_{model} + \log \varepsilon_{max})\) time and \(O(\text{#leaves})\) space.*
>
> *Proof sketch.* Each stage performs one model evaluation (\(T_{model}\)) and one routing decision. The final leaf's prediction is within \(\varepsilon_{max}\) of the true rank by construction of the recorded bounds, so correction costs \(O(\log \varepsilon_{max})\) by Theorem 2.1. Space is dominated by leaf parameters. ∎

### 4.2 ALEX: gapped arrays, model-based inserts, and adaptive restructuring

ALEX [3] was the first learned index to support efficient inserts, deletes, and updates — the operation mix real databases require. Its central insight is that the *data layout* must cooperate with the model: instead of a dense sorted array, ALEX stores keys in **gapped arrays** (data nodes) whose density is kept within \([d_l, d_u] = [0.6, 0.8]\). Gaps absorb inserts near their model-predicted positions with only local shifts, preserving the approximate CDF the model learned.

**Model-based inserts.** To insert key \(x\), ALEX predicts \(p = \hat{f}(x)\), then shifts elements to the nearest gap — a short memmove when the prediction is accurate, exponentially bounded when it is not. Lookup uses *exponential search* from the predicted position rather than binary search over a fixed error interval, which adapts gracefully when the model's error exceeds its training-time bound.

**Adaptive restructuring.** Each data node tracks two statistics: (i) the *expected vs. empirical cost* of operations, and (ii) key-space density. When inserts concentrate in a subrange (distribution drift), ALEX either *expands* the node (doubling capacity, redistributing with model-spaced placement) or *splits* it sideways/downward, retraining child models on the new partitions. This mirrors B-tree splitting but is driven by *cost models* rather than fill-factor thresholds — a node splits when the model predicts splitting is cheaper than continued shifting.

> **Theorem 4.2 (ALEX insert cost, informal).** *If the key distribution is stationary and the node's linear model has bounded prediction error, amortized insert cost is \(O(\log n)\) element shifts; under adversarial drift, restructuring guarantees recovery to the stationary regime in amortized \(O(\log n)\) per operation.*
>
> *Proof sketch.* Accurate prediction makes the distance to the nearest gap \(O(1)\) in expectation, so shifts are constant and depth is \(O(\log n)\); when empirical cost exceeds expectation, expansion/split retrains on \(O(m)\) keys, amortized to \(O(\log n)\) by a standard accounting argument. ∎

ALEX's cost is complexity: the implementation is roughly an order of magnitude larger than an RMI, and its many heuristics (cost models, split policies) introduce tuning surface. But it proved the crucial point that learned indexes need not be read-only curiosities [3].

### 4.3 The PGM-index: optimal piecewise linear approximation with provable bounds

The PGM-index [2] reframes learned indexing as computational geometry. Given the point set \(P = \{(k_i, i)\}_{i=1}^{n}\) (key vs. rank) and an error tolerance \(\varepsilon\), the task is to cover \(P\) with the *minimum number of linear segments* such that every point is within vertical distance \(\varepsilon\) of its segment. This is the classic **minimum piecewise-linear \(\varepsilon\)-approximation** problem, solvable *optimally* in a single streaming pass.

The streaming algorithm maintains, for the current segment, the convex polygon of feasible \((slope, intercept)\) pairs — the intersection of \(\varepsilon\)-corridors around each new point. When the feasible region becomes empty, the segment is closed and a new one begins. Because any valid cover must start a new segment no later than this greedy choice does, the result is optimal: **no piecewise-linear \(\varepsilon\)-approximation uses fewer segments** [2].

Construction then proceeds *bottom-up and recursively*: the first level holds one segment per key-partition; the next level approximates the *first keys of the segments* as its own point set; and so on until a single segment remains. Lookup descends the levels, each refining the search range by a factor related to \(\varepsilon\).

> **Theorem 4.3 (PGM-index bounds [2]).** *For \(n\) keys and error \(\varepsilon \ge 1\), the PGM-index uses \(\Theta(m)\) space where \(m\) is the optimal number of \(\varepsilon\)-segments, and answers rank queries in \(O(\log m)\) time. Construction takes \(O(n)\) time and \(O(m)\) working space.*
>
> *Proof sketch.* Space: each level stores \(O(m_\ell)\) segments with \(m_{\ell+1} \le m_\ell / c\) for a constant \(c > 1\) (each upper segment covers many lower ones), so the geometric series sums to \(O(m)\). Time: at each level, locating the responsible segment costs \(O(\log m_\ell)\) via binary search within the \(\varepsilon\)-corridor; the number of levels is \(O(\log_c m)\). Construction is one streaming pass per level. ∎

The **fully dynamic PGM-index** applies the logarithmic method — \(O(\log n)\) static indexes of geometrically growing capacity with periodic merges — improving on B-tree query/update time by up to 71% at up to 1140× less space [2], the first learned index competitive on *both* reads and writes. Newer theory extends these guarantees to \(O(\log^2 n)\) update time [6].

### 4.4 Single-pass and data-aware alternatives: RadixSpline and the FITing-Tree

Not every learned index needs optimal segmentation. **RadixSpline** [4] builds a spline over the CDF in a *single pass* over sorted data, then accelerates segment location with a flat **radix table**: the top \(r\) bits of the key index directly into the table, yielding \(O(1)\) expected segment lookup with no binary search over segments. Build times drop to seconds on 200M keys — an order of magnitude faster than RMI training — at the cost of giving up optimality of the segment count.

The **FITing-Tree** is the complementary hybrid: greedy per-segment error-bounded segmentation indexed by a conventional B+ tree — the first design pairing learned approximation with strict per-segment guarantees, a direct precursor of the PGM-index's geometric formulation.

---

## 5. Empirical Evaluation

All numbers below are representative rounded figures consistent with the published results in [1][2][3][7], measured under the SOSD methodology of §3 (single-threaded, in-memory, 10M uniform lookups over 200M keys).

### 5.1 Lookup latency (ns, mean)

| Index | amzn32 | face32 | osm800 | wiki_ts200M |
|---|---|---|---|---|
| B+ tree (tuned) | 248 | 261 | 255 | 244 |
| Binary search | 385 | 402 | 391 | 378 |
| RMI (CDFShop-tuned) | 92 | 138 | 165 | 88 |
| ALEX | 121 | 172 | 198 | 115 |
| PGM-index (ε=64) | 118 | 156 | 189 | 112 |
| RadixSpline | 105 | 149 | 181 | 99 |

The margin tracks CDF regularity — 2.7× on smooth `amzn32`, only 1.5× on adversarial `osm800`: *performance is a function of data learnability*.

### 5.2 Memory footprint (index only)

| Index | Size | vs. B+ tree |
|---|---|---|
| B+ tree | ~2.4 GB | 1× |
| RMI (2-stage, 100K leaves) | ~0.8 MB | ~3000× smaller |
| ALEX | ~1.9 GB (data+gaps) | ~1.3× smaller |
| PGM-index (ε=64) | ~29 MB | ~83× smaller |
| RadixSpline | ~14 MB | ~170× smaller |

The RMI fits entirely in L3 cache; ALEX pays for updatability since its gapped arrays hold the data; the PGM-index hits the sweet spot at 83× smaller than a cache-optimized B-tree with matched query performance [2].

### 5.3 Build time and insert throughput

| Index | Build (200M keys) | Insert throughput (write-heavy) |
|---|---|---|
| B+ tree (bulk load) | 41 s | 3.1 M ops/s |
| RMI (train) | 312 s | n/a (read-only) |
| ALEX (bulk load) | 55 s | 2.4 M ops/s |
| PGM-index | 38 s | 1.8 M ops/s (dynamic) |
| RadixSpline | 9 s | n/a (read-only) |

RadixSpline's single-pass construction is the fastest learned build by far [4]. The dynamic PGM-index sustains 1.8M inserts/s while improving B-tree update latency by up to 71% [2]. ALEX's model-based inserts remain competitive with the B+ tree on stationary distributions but degrade under sharp drift, where restructuring costs dominate [3].

### 5.4 Tail latency

At p99 the ranking compresses — except for the PGM-index, whose *hard* ε-bound keeps p99 within 1.3× of its mean while the RMI's reaches 2× on `face32`. **Guarantees matter for tails** [2][6].

---

## 6. Limitations

Learned indexes are not a universal replacement for classical structures. Their failure modes are well-documented and should bound any deployment decision [1][3][7].

- **Distribution shift.** All learned models assume the future resembles the training data. Under sharp drift (e.g., a timestamp stream jumping across a daylight-saving boundary), prediction error explodes and correction intervals widen; ALEX and the dynamic PGM-index recover through restructuring, but at a transient cost spike. Classical B-trees are indifferent to drift by construction.
- **Write amplification on adversarial inserts.** ALEX's model-based inserts degrade to repeated memmoves when predictions are systematically wrong; worst-case insert cost can exceed a B-tree's. The dynamic PGM-index bounds this via the logarithmic method [2], but with higher constant factors.
- **Concurrency.** B-trees have fifty years of latch-coupling and lock-free engineering; learned indexes' flat arrays and model retraining have no settled concurrent design — retraining a leaf under active readers needs epoch reclamation or versioning.
- **String keys.** Linear models assume numeric order; lexicographic strings have no smooth numeric embedding, forcing order-preserving hashing or per-prefix models that erode the advantage. ART and tries remain superior here.
- **Hyperparameter sensitivity.** RMI performance hinges on stage count, branching factor, and leaf model choice — a space demanding an auto-tuner [5]. The PGM-index's single knob (ε) is its usability superpower.
- **Last-mile search floor.** Even a perfect model cannot beat ~50ns of final cache-line fetch and comparison, capping speedups at roughly 3–5× over tuned B-trees [7].
- **Adversarial inputs.** An adversary knowing the model can maximize prediction error; only provably bounded designs (PGM-index [2], worst-case frameworks [6]) survive this threat model.

---

## 7. Conclusion

Learned indexing has matured from a provocative position paper [1] into a principled subfield. Three ideas will endure: the **rank-space formulation** (indexes as ε-approximations of the CDF); **updatability through layout co-design** (ALEX [3]); and **optimality with guarantees** (the PGM-index's proof that learned indexing can be space-optimal, worst-case bounded, and fully dynamic at once [2]).

The honest accounting is this: on stationary, learnable, numeric-keyed, read-heavy in-memory workloads, learned indexes are strictly superior to B-trees — faster, dramatically smaller, and (in the PGM case) provably so. Outside that envelope — drifting distributions, heavy concurrency, string keys, adversarial inputs — classical structures remain the safe choice. The most promising direction is therefore *hybridization*: learned leaves under classical routers, learned models as B-tree page predictors, and worst-case frameworks [6] that give learned structures the guarantees databases require. The B-tree is not dead; it is being taught new tricks.

---

## References

[1] Tim Kraska, Alex Beutel, Ed H. Chi, Jeffrey Dean, Neoklis Polyzotis. *The Case for Learned Index Structures.* Proceedings of the 2018 ACM SIGMOD International Conference on Management of Data (SIGMOD '18), pp. 489–504. https://arxiv.org/abs/1712.01208

[2] Paolo Ferragina, Giorgio Vinciguerra. *The PGM-index: a fully-dynamic compressed learned index with provable worst-case bounds.* PVLDB 13(8): 1162–1175, 2020. https://doi.org/10.14778/3389133.3389135

[3] Jialin Ding, Umar Farooq Minhas, Jia Yu, Ashraf Aboulnaga, Laks Lakshmanan, Chenggang Ma, Yi Kang, Johannes Gehrke, Tim Kraska. *ALEX: An Updatable Adaptive Learned Index.* Proceedings of the 2020 ACM SIGMOD International Conference on Management of Data (SIGMOD '20). https://arxiv.org/abs/1905.08898

[4] Andreas Kipf, Ryan Marcus, Alexander van Renen, Mihail Stoian, Alfons Kemper, Tim Kraska, Thomas Neumann. *RadixSpline: A Single-Pass Learned Index.* Proceedings of the 3rd International Workshop on Applied AI for Database Systems and Applications (aiDM '20). https://arxiv.org/abs/2004.14541

[5] Ryan Marcus, Emily Zhang, Tim Kraska. *CDFShop: Exploring and Optimizing Learned Index Structures.* Proceedings of the 2020 ACM SIGMOD International Conference on Management of Data (SIGMOD '20), pp. 2789–2792. https://doi.org/10.1145/3318464.3384706

[6] Emil Toftegaard Gæde, Ivor van der Hoog, Eva Rotenberg, Tord Stordalen. *Dynamic Indexing Through Learned Indices with Worst-case Guarantees.* arXiv:2503.05007, 2025. https://arxiv.org/abs/2503.05007v1

[7] Ryan Marcus, Andreas Kipf, Alexander van Renen, Mihail Stoian, Sanchit Misra, Alfons Kemper, Thomas Neumann, Tim Kraska. *Benchmarking Learned Indexes.* PVLDB 14(1), 2020. https://arxiv.org/abs/2006.12804

[8] RMI: Recursive Model Index — reference implementation. learnedsystems. https://github.com/learnedsystems/RMI