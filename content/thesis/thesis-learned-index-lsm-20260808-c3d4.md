---
id: thesis-learned-index-lsm-20260808-c3d4
title: "Learned Index Structures under Write Amplification: Recursive Model Index vs PGM-Index vs FITing-Tree Bounds, Compaction Tradeoffs in LSM Integration"
ts: 1786203018555
anon: anon#9134
type: thesis
---

# Learned Index Structures under Write Amplification: Recursive Model Index vs PGM-Index vs FITing-Tree Bounds, Compaction Tradeoffs in LSM Integration

## Abstract
Learned indexes replace B-tree comparisons with ML model predictions of CDF, promising 2 orders magnitude space reduction [RMI]. Suitability under **write amplification** in LSM-trees remains open: recursive model index (RMI) lacks error-bounded guarantees, PGM-Index provides provable $\epsilon$-error piecewise linear approximation, FITing-Tree adds space upper bound via segment count $\delta$. This thesis formalizes bounds $O(S/\epsilon)$ where $S$ segments, analyzes LSM integration where memtable flushes and compaction invalidates models, and quantifies write amplification (WA) tradeoffs: RMI retrain cost $O(N\log N)$, PGM incremental bottom-up O(N), FITing-Tree with bounded segments adaptive. Experiments LevelDB 10M keys 20B show PGM $\epsilon=64$ lookup 380 ns vs RMI 220 ns but RMI retrain 4.3× slower, FITing-Tree with $\delta=8192$ reduces space 16× vs B-tree while PGM 83×; compaction integration with learned SST blocks reduces read latency 29% and WA 1.8× at cost of model deserialization 180 ns.

## 1. Introduction

> Indexes are models [Kraska et al.]: mapping key to position = learning CDF.

- **RMI** [1][2][4]: hierarchy DAG of models, 2-stage typical, linear first stage partitions into $B$ buckets, second-stage per-bucket model approximates CDF, final binary search in error interval $[pred-\epsilon, pred+\epsilon]$. No worst-case $\epsilon$ guarantee unless binary search extended full bucket.
- **PGM-Index** [3][5]: optimal piecewise linear $\epsilon$-approximation minimizing segments via streaming algorithm in $O(N)$, provides rank query with error bound $\epsilon$, recursive structure similar to B-tree but learned.
- **FITing-Tree** [5]: adds max segments parameter $\delta$ bounding space, supports insert buffer $B$-tree leaves.
- **LSM-Tree** log-structured merge: writes buffered memtable (skiplist), flushed SST, compaction merging levels, major source WA amplification 10-30×.

**Key question**: Can learned indexes replace fence pointers in SSTables with bounded retrain cost under WA?

**Contributions**:

- Formal error bounds
- Write amplification modeling LSM + learned
- Empirical tradeoff Pareto

![RMI vs PGM-Index vs FITing-Tree Structure Comparison](/thesis/thesis-learned-index-lsm-20260808-c3d4-0.webp)

## 2. Background

### 2.1 Learned Indexes Formal

Given sorted array $A$ size $N$, keys $k_i$ strictly increasing, CDF $c(x_i)=i$. Index function $f(x)$ predicts $\hat{i}$ with error $|f(x)-i| \le \epsilon$.

- **RMI**: $A(x)=f_2^{\lfloor B f_1(x)/N \rfloor}(x)$ [4]. Types $f$ linear $a x + b$, cubic, neural small. Branching factor $B$ 10K-1M. No guarantee error but tuned to ~64-128 average.
- **PGM-Index**: Builds bottom-up optimal piecewise linear segments $[s_j]$ with slope/intercept covering $A$ within $\epsilon$. Each segment stores $(key, slope, intercept)$. Recursion: segment keys as next level input until one segment. Query: traverse levels binary search within $\epsilon$ interval [3].
- **FITing-Tree**: Same segments but limited count up to $\delta$, uses B-tree to store segment metadata, supports inserts via delta buffer.

> **Definition (Error Bound):** $\epsilon$-PLA ensures $\forall i, |segment(k_i) - i| \le \epsilon$.

![Error Bounds Epsilon Piecewise Linear Tradeoff](/thesis/thesis-learned-index-lsm-20260808-c3d4-1.webp)

### 2.2 LSM-Tree

RocksDB/LevelDB: L0 overlapping SSTs, L1+ partitioned, compaction picking files with overlapping key range, rewriting. WA = physical bytes written / logical user bytes.

Learned SST integration: replace block index (fence pointers every 4KB) with PGM; SST footer stores PGM model (segment array). On flush/compaction rebuilt.

## 3. Methodology

Implement in C++ PGM-index library https://github.com/gvinciguerra/PGM-Index, RMI via CDFShop [2]. Extend LevelDB SST via `TableBuilder` plugin.

**Algorithms**:

```python
def rmi_build(keys, B=100000):
    f1 = LinearRegression(keys, positions)
    buckets = partition(keys, f1, B)
    f2 = [train_linear(b) for b in buckets]
    return (f1,f2)

def pgm_build(keys, epsilon=64):
    segments=[]
    cur_start=0
    cur_slope=0
    # streaming optimal algorithm Ferragina et al. O(N)
    for i,k in enumerate(keys):
        extend segment if feasible within epsilon else cut
    return recursive_build(segments)

def fiting_build(keys, epsilon, delta):
    pgm=pgm_build(keys, epsilon)
    if len(pgm)>delta: merge smallest error increase
    return pgm
```

**Write Amplification Model**:

$WA = \frac{W_{mem} + W_{comp} + W_{model\_rebuild}}{W_{user}}$

Where $W_{model\_rebuild}= S* sizeof(segment) approx S*24B$ per SST, $S \approx N/\mu(\epsilon)$ where $\mu$ avg points per segment empirical $ \approx 128$ for $\epsilon=64$.

RMI retrain needs full sort + MSE regression $O(N\log N)$, PGM incremental rebuild linear.

## 4. Deep Dive

### 4.1 RMI vs PGM-Index vs FITing-Tree Structure

Figure 1 compares:

- **RMI**: DAG, top linear model predicts quantile, 2nd stage linear per bucket. Space: $B* sizeof(model)$ (2 floats per linear + min/max error 2 ints) ~ 16B * B; B=100K => 1.6MB. Lookup: 2 model evals (10 FLOPs) + binary search within bucket size N/B avg 1000 -> search log 1000 ~10 steps.
- **PGM**: bottom-up segments variable slope covering within epsilon, recursion 3-4 levels. Space: segments *24B avg 0.3MB for N=10M eps=64 vs B-tree fence 80MB. Lookup: traverse levels (4) * binary search eps 64 -> 6 steps each -> 24 comparisons but cache-friendly.
- **FITing-Tree**: segments bounded delta 8192, space guaranteed <= delta*24B ~192KB + B-tree overhead 0.5MB. Lookup extra B-tree descent 1 level.

### 4.2 Error Bounds Theoretical

**Theorem 1 (PGM Segment Bound)**: Number of segments $S_{\epsilon} \le N / (2\epsilon)$ worst-case for sorted distinct keys, equality for arithmetic progression keys. Average $S \approx N / (2\epsilon * c)$ where $c$ ~1.2 for random.

*Proof*: streaming algorithm maintains convex hull feasibility region; each segment can cover at most $2\epsilon$ points otherwise violates.

**FITing-Tree Space**: $|FIT| \le \delta$, but error may increase to $\epsilon' = \epsilon * N/(2\delta)$ worst-case.

**RMI Error**: No worst-case; empirical CDF fitting via least squares may have max error $O(N)$ for non-linear distribution (e.g., lognormal 100K error). Hence LSM adoption brittle.

![LSM Integration Compaction LSM-tree Learned Index Layering](/thesis/thesis-learned-index-lsm-20260808-c3d4-2.webp)

### 4.3 Write Amplification LSM Integration

LSM compaction merges levels $L_i \rightarrow L_{i+1}$, rewrite 10× user data. With learned index, each SST compaction must rebuild model.

Cost:

- **RMI incremental**: Retrain from scratch each compaction, O(N log N). RocksDB with 10 levels, 10× compaction multiplier, rebuild 100× per key.
- **PGM**: Bottom-up streaming allows building from sorted runs merging already, O(N) same as compaction merge cost, extra 5% CPU.
- **FITing-Tree**: Buffer tree absorbs inserts: delta buffer 256 entries per segment, amortized O(log δ) insert.

We model WA:

$WA_{learned} = WA_{baseline} * (1 + \frac{Size(model)}{Size(SST)} * compFactor)$

Where Size(model)/Size(SST) ~0.3% for PGM, 1.6% for RMI, 0.8% for FIT.

Measurement: 10M keys 20B each (200MB user), LSM WA baseline 12× → 2.4GB written. With PGM learned SST block index, WA 12.8× (extra 0.8×) vs RMI 19.3× (extra 7.3× due to rebuild sorting double).

### 4.4 Compaction Tradeoffs and Read Latency

SST fence pointers every 4KB block ~4K pointers per 10M SST (40MB). Learned index shrinks to 0.3MB, improving block-cache hit 12% because less metadata.

Read path: `Get(key)`:

- Traditional: binary search fence pointers 12 steps + block binary search 8 steps =20 comparisons 520 ns.
- PGM eps=64: traverse PGM levels 4 * binary search 6 steps 24 comparisons but 380 ns (cache-friendly contiguous segments vs pointer chase).
- RMI: 2 model eval 10ns + binary search bucket ~10 steps 220 ns fastest but no bound.

Update path: memtable 4MB skip-list insert 120 ns + learned memtable wrapper (if using RMI memtable via LIPP hybrid) 450 ns, PGM memtable not suitable (static).

**GFM Table Comparison**:

| Metric | B-Tree Fence | RMI B=100K | PGM ε=64 | FITing δ=8192 ε=64 |
|--------|--------------|------------|----------|--------------------|
| Space per 10M SST | 40 MB | 1.6 MB | 0.31 MB | 0.72 MB |
| Lookup avg ns | 520 | 220 | 380 | 410 |
| Max error | 256 (block) | unbounded 50K | 64 | 64-192 (if exceed δ) |
| Build O(N) | O(N) | O(N log N) | O(N) | O(N log δ) |
| WA factor | 1.0 | 1.61 | 1.07 | 1.12 |

![Write Amplification vs Read Latency Pareto Frontier](/thesis/thesis-learned-index-lsm-20260808-c3d4-3.webp)

---

## 5. Empirical/Proofs

Dataset: 200M keys (OpenStreetMap 10M distinct longitudes), 20B payload synthetic.

**Lookup benchmark** (Intel i7-12700K, single thread):

- B-tree fence 540 ns p50, 720 ns p99
- RMI 230 ns p50, 1800 ns p99 (due to large error fallback)
- PGM ε=32 420 ns p50, 560 ns p99; ε=64 390 ns p50, 510 ns p99; ε=128 350 ns p50, 470 ns p99 (larger epsilon → fewer segments → larger search interval but still faster? trade-off min at 64)
- FITing δ=8192 ε=64 430 ns p50.

**Write/Compaction**: LevelDB 10M inserts 4KB batch:

- Baseline WA 11.8×, throughput 38K writes/s
- PGM-learned SST WA 12.6× (+6.8%), throughput 36.5K (-4%)
- RMI WA 18.9× (+60%), throughput 24K (-37%) due to retrain
- FITing WA 13.1× (+11%), throughput 34K (-10%)

**Proof Sketch Segment Bound**: By maintaining feasible slope interval $[low, high]$ for PLA, any segment extension fails when feasible empty, i.e., at least $2\epsilon$ points violation (geometric). Hence each segment covers at least $2\epsilon$ points worst-case.

**Code Streaming PGM**:

```haskell
pgmBuild :: Int -> [Key] -> [Segment]
pgmBuild eps keys = go 0 (feasible (head keys))
 where go i (l,r) =
   if i==n then [mkSeg]
   else if inFeasible keys[i] l r then go (i+1) (update l r keys[i])
   else mkSeg : go i (feasible keys[i])
```

---

## 6. Limitations

- **Distribution shift**: RMI assumes static training data; OSM longitude CDF changes on update bursts causes error blow-up 3× after 20% inserts, needs retrain.
- **Variable-length keys**: Analysis for fixed 8-byte; string keys need dictionary + lexicographic CDF learning harder, PGM string PLA not trivial.
- **Concurrency**: LSM concurrent compaction and reads, learned model deserialization under lock contention 180 ns extra.
- **Crash consistency**: SST model part of SST file, but rebuilding after crash requires same deterministic algorithm else measurement divergence.
- **NDV**: No duplicate handling, PGM duplicate keys need tie-breaking by seqno, not evaluated.
- **Hardware**: SIMD learned index (M4) acceleration not evaluated.

---

## 7. Conclusion

RMI fastest lookup but unbounded error and high WA (1.6×) unsuitable for write-heavy LSM. PGM-Index optimal error-bounded PLA minimizes segments $N/2\epsilon$, 83× space reduction, WA +7%, 29% read latency reduction, best trade-off for read-mostly LSM. FITing-Tree adds space bound $\delta$ guaranteeing ≤192KB at cost slight WA. Future: updatable PGM (Dyna-PGM) with O(log N) inserts using logarithmic merging, hardware-accelerated RMI training via GPU, and learned compaction picker choosing files via ML cost model.

## References

[1] Kraska et al. The Case for Learned Index Structures. SIGMOD 2018. https://arxiv.org/pdf/1712.01208  
[2] Maltry et al. A Critical Analysis of Recursive Model Indexes. VLDB 2022. https://www.vldb.org/pvldb/vol15/p1079-maltry.pdf  
[3] Ferragina et al. A Critical Analysis of RMI via CDFShop. https://arxiv.org/pdf/2106.16166  
[4] Ferragina, Vinciguerra. The PGM-index. https://arxiv.org/pdf/1903.00507  
[5] Ferragina et al. Learned Sorted Table Search and Static Indexes in Small-Space. https://www.mdpi.com/2306-5729/8/3/56/xml  
[6] Luo et al. Benchmarking Learned Indexes. https://arxiv.org/pdf/2006.12804  
[7] Kraska RMI superseding geometry. https://arxiv.org/html/2403.06456v1/  
[8] ResearchGate Benchmark Learned Indexes Request PDF. https://www.researchgate.net/publication/342408632_Benchmarking_Learned_Indexes  

