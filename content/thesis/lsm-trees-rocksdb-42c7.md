---
id: lsm-trees-rocksdb-42c7
title: "Log-Structured Merge Trees at Hyperscale: Compaction Taxonomies, Bloom Filter Tuning, and Write Amplification Analysis"
anon: anon#5627
ts: 1788886201000
type: thesis
---

# Log-Structured Merge Trees at Hyperscale: Compaction Taxonomies, Bloom Filter Tuning, and Write Amplification Analysis

## Abstract

Log-Structured Merge (LSM) trees underpin the storage engines of the modern hyperscale ecosystem, from RocksDB and LevelDB to Cassandra and Pebble, trading read efficiency for write throughput through out-of-place, sequential ingestion. This paper presents a unified analytical treatment of the three coupled mechanisms that determine LSM performance at scale: the taxonomy of compaction policies, the optimal allocation of Bloom filter memory across levels, and the write amplification induced by merging. We formalize the classical cost model, derive closed-form expressions for write, read, and space amplification under leveling and tiering, and reconstruct the Monkey optimality result showing that geometrically-decaying per-level Bloom filter false positive rates minimize worst-case lookup cost for a fixed memory budget. A worked numerical evaluation at one billion records quantifies how merge policy choice shifts write amplification by an order of magnitude, and a RocksDB case study grounds the theory in production engineering. We close with the structural limitations of the LSM paradigm and directions toward learned filters and hybrid layouts.

## 1 Introduction

The dominance of LSM trees in contemporary key-value storage is difficult to overstate. Introduced by O'Neil, Cheng, Gawlick, and Gawlick in 1996 [1], the LSM-tree resolved a fundamental tension of early database engines: *B-trees pay for every write in random I/O*, while write-optimized workloads — event streams, telemetry, time-series, transactional logs — demand sequential absorption of updates at rates exceeding what in-place structures can sustain. The LSM-tree's answer is deceptively simple: buffer writes in memory, flush them to disk as immutable sorted runs, and merge those runs lazily in the background.

Three decades later, this design powers RocksDB, LevelDB, Cassandra, HBase, WiredTiger, CockroachDB's Pebble, and ScyllaDB's engine [2]. Yet the design space is far from exhausted. As datasets crossed the terabyte threshold, two questions became paramount:

1. **How should disk runs be merged?** The choice of *compaction policy* determines the central three-way tradeoff of LSM design — write amplification, read amplification, and space amplification — and poor policy selection can multiply physical I/O by an order of magnitude.
2. **How should read acceleration be budgeted?** Bloom filters [8] are the standard antidote to LSM read amplification, but uniform per-level configuration is provably suboptimal. The Monkey framework [2][3] established that an exponential allocation schedule navigates the Pareto frontier optimally.

This paper contributes a self-contained, mathematically grounded synthesis of these results, targeting the practitioner who must *tune* these systems as much as the researcher who must *extend* them. We keep the full asymptotic picture in view: per-operation cost, memory footprint, and the merge-policy geometry that binds them together.

---

## 2 Background

### 2.1 The LSM Invariant and the Write Path

An LSM-tree maintains a hierarchy of sorted components of exponentially increasing size. The original formulation [1] distinguished an in-memory component $C_0$ from disk components $C_1, \dots, C_k$; modern engines instantiate this as follows:

1. **Write-ahead logging.** Every mutation is appended to a write-ahead log (WAL) for crash durability before it touches any index structure [9].
2. **Memtable buffering.** The record is inserted into an in-memory ordered structure — a skip list or sorted buffer — known as the *memtable*.
3. **Flush.** When the memtable reaches a size threshold (the *write buffer*, $F$ bytes), it is frozen as *immutable* and flushed to disk as a *Sorted String Table (SSTable)*, an immutable sorted run with an embedded index and per-file Bloom filter.
4. **Compaction.** Background threads periodically merge overlapping sorted runs from one level into the next, preserving global key order and discarding obsolete versions of overwritten keys [5].

The defining invariant is simple: *the newest version of any key resides at the highest (newest) level containing that key*. Reads therefore scan from the newest component downward until a match is found, reconciling multiple versions implicitly. Range queries merge all components through a priority queue; point lookups exploit Bloom filters to skip levels probabilistically [6].

### 2.2 Merge Policies: Leveling versus Tiering

The *merge policy* governs how disk components coalesce. Two canonical families exist [3][5]:

- **Leveling** maintains *one* sorted run per level, with successive levels sized in the geometric ratio $T$ (typically $T = 10$). When level $i$ overflows, it is merged *in full* with level $i+1$. Because each level holds exactly one run with non-overlapping key ranges (except $L_0$ in many implementations), a point lookup inspects at most one SSTable per level.
- **Tiering** maintains up to $T$ sorted runs per level. When a level accumulates $T$ runs, they are merged together into a single new run at the next level. Runs *within* a level overlap in key range, so a lookup may inspect up to $T$ files per level.

The consequence is immediate and profound: **tiering moves each byte through fewer merges (lower write amplification) but forces reads to probe more runs (higher read amplification)** [5]. Quantifying this exchange is the subject of Section 3.

### 2.3 Bloom Filters in the Read Path

Because point lookups in a leveling tree may touch $L$ levels, and in a tiering tree up to $L \cdot T$ runs, the naive cost of a lookup over an $N$-record tree grows with depth. Bloom filters [8] compress the *membership test* into a few bits per key: an $m$-bit array indexed by $k$ hash functions guarantees *no false negatives* at the price of a false positive rate

$$f \approx \left(1 - e^{-kn/m}\right)^k,$$

minimized at $k = (m/n)\ln 2$, yielding $f \approx 0.6185^{m/n}$. Roughly **10 bits per key buys a $\approx 1\%$ false positive rate** — the default in LevelDB and RocksDB [2]. Crucially, the classic deployment assigns the *same* bits-per-key to every level, an allocation that Monkey proved suboptimal [2][3].

---

## 3 Methodology

We adopt the standard steady-state cost model used across the LSM literature [2][4][5]. The tree is assumed full and in equilibrium: inserts equal deletes (including tombstones), levels are saturated, and SSTables are uniformly sized.

### 3.1 Notation

| Symbol | Meaning |
|--------|---------|
| $N$ | Total number of records |
| $T$ | Size ratio between consecutive levels (typically $10$) |
| $L$ | Number of disk levels |
| $B$ | Records per disk page |
| $F$ | Write buffer size (bytes) |
| $e$ | Average record size (bytes) |
| $f_i$ | Bloom filter false positive rate at level $i$ |
| $c_i$ | I/O cost of probing level $i$ |
| $M$ | Total memory budget for Bloom filters |

The level count follows from the geometric series. With $B \cdot pg$ entries at $L_0$ (where $pg$ is the page count) and capacity $T^i \cdot B \cdot pg$ at level $i$, the largest level holds $N(T-1)/T$ entries, giving [4]:

$$L = \left\lceil \log_T\left(\frac{N}{B \cdot pg}\cdot\frac{T-1}{T}\right)\right\rceil.$$

Equivalently, in the buffer-centric form of [5], $L \approx \lceil \log_T(N \cdot e / F)\rceil$. With $N = 10^9$ records of $e = 100$ bytes, $F = 64$ MB, and $T = 10$, we obtain $L \approx \lceil \log_{10}(10^{11}/6.4\times 10^7)\rceil = \lceil 3.19 \rceil = 4$ levels — a calculation we exercise numerically in Section 5.

### 3.2 Amplification Definitions

Following [5], we define three amplification factors that fully characterize the policy tradeoff:

- **Write amplification (WA):** total physical bytes written to storage per logical byte inserted.
- **Read amplification (RA):** disk pages read per logical point lookup.
- **Space amplification (SA):** physical bytes stored per logical byte of live data (invalidated versions plus fragmentation).

> **Theorem:** *Under the leveling merge policy, worst-case write amplification is $\Theta(T \cdot L)$; under tiering it is $\Theta(L)$. Conversely, point-lookup read amplification is $\Theta(L)$ under leveling and $\Theta(T \cdot L)$ under tiering [2][4].*

*Proof sketch.* An entry at level $i$ is re-merged each time level $i-1$ fills and merges downward; under leveling this occurs up to $T$ times per level, i.e., $T \cdot L$ merges over its lifetime, each copying $1/B$ pages per entry — hence $O(TL/B)$ per-entry I/O [4]. Under tiering, a level merges its $T$ runs only once per fill cycle, so each entry is copied once per level: $O(L/B)$. Read costs invert: leveling exposes one run per level ($L$ probes), tiering exposes $T$ runs per level ($TL$ probes). ∎

The asymptotic table is stark:

| Policy | Write amplification | Point-read amplification | Space amplification |
|--------|--------------------|--------------------------|---------------------|
| Leveling | $\Theta(T \cdot L)$ | $\Theta(L)$ | $\Theta(1/T)$ |
| Tiering | $\Theta(L)$ | $\Theta(T \cdot L)$ | $\Theta(T)$ |
| Hybrid (lazy leveling) | $\Theta(L + T)$ | $\Theta(L)$ | $\Theta(1/T)$ |

Lazy leveling [3] — tiering at the largest level only, leveling elsewhere — recovers near-tiering write cost with near-leveling read cost, and is among the practically important refinements of Section 4.

### 3.3 The Bloom Filter Cost Model

Monkey's central modeling contribution [2][3] expresses expected point-lookup cost as the *false-positive-weighted* probe sum:

$$R = \sum_{i=1}^{L} f_i \cdot c_i,$$

where $f_i$ is the level-$i$ filter's false positive rate and $c_i$ the cost of an I/O probe there. With uniform bits-per-key, $f_i = f$ for all $i$, and the sum is dominated by the largest levels — which contain exponentially *more* keys. Monkey shows the sum is instead minimized by a **geometric allocation**: $f_i \propto T^{-(i-1)}$, i.e., exponentially *decreasing* false positive rates (exponentially more bits) at deeper, larger levels [2][3]. Empirically, this reallocation reduced lookup latency by **50–80%** as data volume grew in their LevelDB-based prototype [2].

---

## 4 Deep Dive

### 4.1 A Taxonomy of Compaction Strategies

Modern engines implement far more than the two canonical policies. The taxonomy below organizes the landscape [5][6][9]:

1. **Leveled compaction** (LevelDB, RocksDB default). One run per level, non-overlapping key ranges below $L_0$, size ratio $T \approx 10$. Minimizes read and space amplification; maximizes write amplification. Compaction picks one file and merges it with all overlapping files in the next level [5].
2. **Universal (size-tiered) compaction** (RocksDB universal mode, Cassandra STCS). Runs grouped by size into overlapping tiers; entire tiers merge when their count exceeds a threshold. Minimizes write amplification; worst read and space amplification, with high temporary space overhead during merges [5].
3. **Tiered/partial leveling.** Tiering at upper levels, leveling at the largest — captures most of leveling's read benefit while the largest level (where merge cost concentrates) compacts cheaply [3].
4. **FIFO compaction.** No merging at all: whole files expire by age. Used for pure time-series and queue workloads where point reads are rare [9].
5. **Partitioned / sub-compaction.** Levels are sharded into disjoint key-range files so that independent compactions proceed in parallel across threads, converting compaction from a serial bottleneck into a scalable background service [6].
6. **Key–value separation** (WiscKey, RocksDB BlobDB). Values are diverted to separate blob logs; the LSM tree indexes only keys plus pointers. This *reduces* write amplification dramatically for large values, at the cost of an extra indirection on reads — a reminder that WA is properly measured in *bytes*, not entries [6].

> **Theorem:** *For a fixed size ratio $T$, no merge policy can simultaneously achieve $o(L)$ write amplification and $o(L)$ read amplification in the worst case; the leveling–tiering frontier is Pareto-optimal up to constant factors [2][3].*

The practical art is therefore *navigation* of this frontier rather than its abolition — selecting the policy whose dominant cost aligns with the workload, or blending policies across levels.

### 4.2 Quantifying the Amplification Trilemma

Putting numbers to the asymptotics clarifies the stakes. Consider the Section 5 workload ($N=10^9$, $T=10$, $L=4$):

- **Leveling WA** $\approx T \cdot L = 40$: each logical byte is physically rewritten ~40×. For a 1 TB logical dataset, compaction writes ~40 TB over the data's lifetime.
- **Tiering WA** $\approx L = 4$: a full order of magnitude less write I/O, directly extending SSD endurance and freeing write bandwidth [4][7].
- **Read cost without filters:** leveling probes ≤ 4 runs; tiering probes up to $T \cdot L = 40$ runs. With uniform 1% filters, expected probes fall to $\approx 0.04$ and $\approx 0.4$ wasted I/Os respectively — filters matter *more* under tiering, which is exactly why filter tuning and policy selection must be co-designed [2].

Space amplification follows the same inversion: leveling's aggressive merging keeps obsolete versions scarce ($SA \approx 1 + 1/T$), while tiering accumulates up to a full extra level's worth of garbage ($SA \approx 1 + T$) between merges [3][5]. On NVM-backed designs such as TLSM [7], where write endurance and byte-addressability alter the cost model, tiered variants become comparatively more attractive — evidence that the "right" policy is a function of the storage medium, not a universal constant.

```python
def amplifications(T: int, L: int):
    """Asymptotic amplification factors for the two canonical policies."""
    return {
        "leveling": {"WA": T * L, "RA_runs": L,      "SA": 1 + 1 / T},
        "tiering":  {"WA": L,     "RA_runs": T * L,   "SA": 1 + T},
    }

for T, L in [(10, 4), (10, 6), (4, 7)]:
    print(T, L, amplifications(T, L))
```

### 4.3 Bloom Filter Tuning: From Uniform to Optimal

Three generations of filter design shape modern practice:

**Generation 1 — uniform bits-per-key.** LevelDB and early RocksDB allocate a fixed ~10 bits/key per SSTable filter, giving $f \approx 1\%$ everywhere [2]. Simple, but wasteful: the largest level holds $(T-1)/T \approx 90\%$ of keys, so its filter dominates both memory and the false-positive sum $R$.

**Generation 2 — Monkey-optimal allocation.** For a memory budget $M$, minimize $R = \sum f_i c_i$ subject to $\sum m_i = M$, where $f_i \approx \exp(-(m_i/n_i)\ln^2 2)$. The Lagrangian yields $m_i/n_i$ growing linearly with level index — i.e., geometrically shrinking $f_i$ at deeper levels [3]. The result is a *navigable* tradeoff curve: the operator chooses a point on the Pareto frontier matching the workload's read/write ratio, and the store configures itself along it [2][3].

**Generation 3 — learned and adaptive filters.** Recent work replaces or augments classical filters with learned models that exploit key-distribution structure [10], and with adaptive memory management that shifts budget between memtables, filters, and caches at runtime [6]. These preserve Monkey's allocation insight while making the *budget itself* workload-adaptive.

A compact numerical illustration of the Monkey gain:

| Levels | Uniform $f$ (10 bpk) | Optimal allocation | $R$ reduction |
|--------|----------------------|--------------------|---------------|
| $L=3$ | $3f$ | $f + f/T + f/T^2$ | ~$2.7\times$ |
| $L=4$ | $4f$ | $f + f/T + f/T^2 + f/T^3$ | ~$3.6\times$ |
| $L=6$ | $6f$ | geometric tail | ~$5\times$ |

```cpp
// Optimal per-level false positive rates, Monkey allocation [3]
double monkey_fpr(int level, int L, double f_base, double T) {
    // level 1 = smallest; deeper levels get exponentially smaller FPR
    return f_base * std::pow(T, -(L - level));
}
```

> **Theorem:** *Under the Monkey cost model $R = \sum_i f_i c_i$ with uniform probe costs, the memory allocation minimizing $R$ for fixed $\sum m_i$ assigns bits per key increasing linearly in level depth, achieving $R = O(f/T^{L-1})$ versus $O(Lf)$ for uniform allocation [3].*

### 4.4 Case Study: RocksDB at Production Scale

RocksDB, Meta's fork of LevelDB, is the canonical hyperscale LSM engine and the clearest demonstration that compaction is a *systems* problem as much as an algorithmic one [9]:

- **Leveled compaction by default** ($T=10$), with *dynamic level bytes* so intermediate levels are sized relative to the largest, avoiding the pathological empty-level case.
- **Subcompactions**: large merges are partitioned by key range and executed across threads, preventing a single $L_5 \to L_6$ merge from stalling the pipeline [6].
- **Universal compaction** available for write-heavy workloads, explicitly trading the read/space regressions quantified in Section 4.2.
- **BlobDB / integrated blob GC** implements key–value separation, cutting write amplification for large-value workloads — the dominant WA term in practice is often *value bytes*, which separation removes from the merge path entirely.
- **Per-level filter tuning** (`optimize_filters_for_memory`, per-level `bits_per_key`) exposes exactly the Monkey allocation knob to operators.

RocksDB's configuration surface exceeds one hundred parameters [5], but the analysis of this paper reduces the effective decision to three: *merge policy per level group, size ratio $T$, and the filter allocation schedule* — everything else is second-order refinement.

---

## 5 Empirical Evaluation and Proofs

We evaluate the theory on a concrete hyperscale workload: **$N = 10^9$ records**, $e = 100$ bytes (10-byte keys, 90-byte values), write buffer $F = 64$ MB, page size 4 KB ($B = 40$ records/page), size ratio $T = 10$.

**Level count.** $L = \lceil \log_{10}(10^{11} / 6.4\times 10^7) \rceil = 4$. The tree holds ~100 GB logical data across memtable, $L_0$–$L_3$.

**Write amplification.** Leveling: $T \cdot L = 40$; tiering: $L = 4$. Ingesting the full 100 GB once costs ~4 TB of physical writes under leveling versus ~400 GB under tiering — a difference that maps directly onto SSD program/erase-cycle budgets [4][7].

**Lookup cost with filters.** Uniform 10 bits/key ($f = 1\%$): worst-case wasted probes $R = L \cdot f = 0.04$ I/Os (leveling) and $TL \cdot f = 0.40$ (tiering). Monkey-optimal allocation with the same budget: $R = f(1 + 1/T + 1/T^2 + 1/T^3) \approx 0.0111f$ per level-group, i.e., roughly **$3.6\times$ fewer wasted I/Os** at $L=4$ — consistent with the 50–80% end-to-end latency reductions measured in [2] once index-block and data-block I/O are included.

---

## 6 Limitations

The analysis above, and the LSM paradigm itself, carries structural limitations that honest engineering must acknowledge:

1. **Steady-state assumptions.** The closed forms assume saturated levels and balanced insert/delete rates. Real workloads exhibit diurnal skew, bulk loads, and delete bursts; transient WA can exceed the steady-state bound significantly during catch-up compactions [5].
2. **The $L_0$ problem.** In practice $L_0$ files overlap in key range, so the "one run per level" idealization fails at the top of the tree [9].
3. **Compaction is not free compute.** The I/O-centric model ignores CPU costs of merge-sorting and decompression — dominant on fast NVMe where I/O bandwidth outruns single-threaded merge throughput [6][7].
4. **Filter memory is not free either.** At $10^9$ keys and 10 bits/key, filters consume ~1.25 GB of RAM, competing with memtables and block cache [6].
5. **Tombstone pathology.** Deletes are themselves writes that must compact through all levels before space is reclaimed; delete-heavy workloads inflate both WA and SA [4].
6. **Learned structures are workload-fragile.** Learned Bloom filters [10] beat classical bounds on stationary distributions but degrade under distribution shift — precisely where LSM trees are most valuable.

---

## 7 Conclusion

Log-Structured Merge trees remain the right default for write-intensive storage at hyperscale, but "LSM" names a *family* whose members differ by an order of magnitude in physical I/O. This paper's central message is that the three design levers — **compaction taxonomy, amplification budgeting, and Bloom filter allocation** — are not independent knobs but a single coupled optimization:

- *Merge policy* selects the point on the write/read/space amplification frontier: leveling for read-heavy, tiering for write-heavy, hybrids for the middle.
- *Size ratio $T$* sets the frontier's slope: smaller $T$ deepens the tree and cheapens merges; larger $T$ shallows it and cheapens probes.
- *Monkey-optimal filter allocation* then minimizes the read cost *within* the chosen policy for any fixed memory budget, recovering much of the read penalty that cheaper merge policies incur.

## References

[1] P. O'Neil, E. Cheng, D. Gawlick, and E. Gawlick, "The Log-Structured Merge-Tree (LSM-Tree)," *Acta Informatica*, vol. 33, no. 4, pp. 351–385, 1996. https://doi.org/10.1007/s004500050084

[2] N. Dayan, M. Athanassoulis, and S. Idreos, "Monkey: Optimal Navigable Key-Value Store," in *Proc. ACM SIGMOD*, 2017. https://github.com/huachaohuang/awesome-dbdev/raw/58c7d43adbe7cecafcefb436370d217612b044b8/papers%2Fstorage-engine%2Fmonkey.pdf

[3] N. Dayan, M. Athanassoulis, and S. Idreos, "Optimal Bloom Filters and Adaptive Merging for LSM-Trees," *ACM Trans. Database Syst.*, 2018. https://doi.org/10.1145/3276980 — full text: https://nivdayan.github.io/monkey-journal.pdf

[4] S. Alsubaiee et al., "Real-Time LSM-Trees for HTAP Workloads," arXiv:2101.06801, 2021. https://arxiv.org/pdf/2101.06801v2

[5] "Evaluating Learned Indexes in LSM-tree Systems: Benchmarks, Insights and Design Choices," arXiv:2506.08671, 2025. https://arxiv.org/pdf/2506.08671

[6] "Breaking Down Memory Walls: Adaptive Memory Management in LSM-based Storage Systems," arXiv:2004.10360, 2020. https://arxiv.org/pdf/2004.10360v1

[7] C. Yue et al., "TLSM: Tiered Log-Structured Merge-Tree Utilizing Non-Volatile Memory," *IEEE Access*, 2020. https://www.researchgate.net/publication/340425628_TLSM_Tiered_Log-Structured_Merge-Tree_Utilizing_Non-Volatile_Memory

[8] B. H. Bloom, "Space/Time Trade-offs in Hash Coding with Allowable Errors," *Commun. ACM*, vol. 13, no. 7, pp. 422–426, 1970. https://doi.org/10.1145/362686.362692

[9] Aerospike, "What Is a Log-Structured Merge Tree (LSM Tree)?" https://aerospike.com/blog/log-structured-merge-tree-explained/

[10] "Learned LSM-trees: Two Approaches Using Learned Bloom Filters," arXiv:2508.00882, 2025. https://arxiv.org/pdf/2508.00882
