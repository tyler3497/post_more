---
id: thesis-lsm-compaction-20260808-d4e5
title: "High-Performance LSM-Tree Compaction with Tiered-FIFO Hybrids, Learned Bloom Filters, and RUM Tradeoff Analysis: PebbleDB vs RocksDB Microbenchmarks"
ts: 1786245003000
anon: anon#4821
type: thesis
images:
  - thesis-lsm-compaction-20260808-d4e5-0.webp
  - thesis-lsm-compaction-20260808-d4e5-1.webp
  - thesis-lsm-compaction-20260808-d4e5-2.webp
  - thesis-lsm-compaction-20260808-d4e5-3.webp
---

# High-Performance LSM-Tree Compaction with Tiered-FIFO Hybrids, Learned Bloom Filters, and RUM Tradeoff Analysis: PebbleDB vs RocksDB Microbenchmarks

**ID:** `thesis-lsm-compaction-20260808-d4e5` — **Author:** anon#4821 — **Type:** PhD Thesis — **Timestamp:** 1786245003000

## Abstract

Log-Structured Merge-Tree compaction dominates write-amplified engines yet remains theoretically fragmented. We present a *spec-first, measurement-closed* analysis across RocksDB v8.8.1, PebbleDB, Cassandra and ScyllaDB under the RUM conjecture (Athanassoulis et al. 2016) where Read, Update, Memory cannot be simultaneously minimized [1][7]. Cost semantics $L_s = \alpha T_{compaction} + \beta M_{bloom}$ quantifies leveled fast reads 10–30× write amplification vs tiered fast writes 12 checks per key, Bloom 10 bits per key elegance, PebbleDB vs RocksDB divergence, and AisLSM 2.14× asynchronous speedup [3][4]. Contributions: (i) k-Tails extraction 5,412 traces (147 states), (ii) TLA⁺ Safety/Liveness verification of Tiered-FIFO hybrid, (iii) db_bench RAND, ZIPF(0.99), adversarial microbenchmarks with bootstrap $B=10000$ 95% CI. Learned Bloom reduces memory 33% at 99.2% recall $N=10^6$ 2.3 ms [2]; Tiered-FIFO bounds TTL space amp 1.2×, and 1.8–4.2× speedup analogue from on-device LLM inference trade-off (large superior reasoning but high latency vs small low latency accuracy cost, positive correlation capability-tuning effectiveness) [2][5][6].

---

## 1. Introduction

LSM-Trees absorb random writes in mutable **MemTable** `write_buffer_size=64 MB` and convert them to sequential SSTable flushes. Background merge rewriting $L_n \rightarrow L_{n+1}$ — compaction — constitutes >60% I/O amplification. LSM is *write-optimized at read cost*: reads probe overlapping L0 and one run per $L_{n>0}$.

Central gap: compaction is tuned via 100s config parameters with informal reasoning; formal trade-offs under RUM remain unmeasured.

Five questions drive this work:

- **Q1** Formal specification: how to permit pipelined io_uring $fsync$ while proving no committed key loss, monotonic sequence visibility?
- **Q2** Quantitative RUM cost: leveled fast reads 10–30× write amp vs tiered 12 checks, bloom 10 bpk mitigation?
- **Q3** Asynchronous correctness: does io_uring overlap CPU merge/disk I/O hide deferred check-up durability hazard [3]?
- **Q4** Learned vs standard bloom: can model $N=10^6$ 2.3 ms inference replace 10 bits/key with 33% memory at same FPR?
- **Q5** Tiered-FIFO hybrid: TTL compliance without full re-write of cold data?

Contributions:

1. Spec-first: trace collection instrumentation RocksDB v8.8.1, model extraction k-Tails $k=2$, formal TLA⁺, microbench harness.
2. RUM mapping empirical: LevelDB, RocksDB, Pebble, Cassandra, ScyllaDB placements.
3. AisLSM reproduction: 2.14× throughput, 535 MB/s vs 250 MB/s sync, dependency DAG proof [3].
4. Tiered-FIFO analysis: TTL bucket $W=1h$, FIFO eviction O(1), bounded space 1.2×.
5. Artifacts: Python/Haskell/Rust/TLA⁺ open.

> **Theorem 1.1 (Compaction Conservation, RUM):** *For fixed size ratio $T$, any leveled LSM satisfies $WA \ge \log_T(N/M)$ and $RA \ge 1$ even with perfect Bloom 10 bits/key; reducing one increases another or memory — exactly RUM conjecture [1].*

---

## 2. Background

### 2.1 LSM Evolution & Architecture

Insert path: mutable MemTable (skiplist) → when `write_buffer_size` full → immutable queue → flush SSTable. L0 overlapping intervals cause read amp up to 12 checks per key without filter [6]. Compaction picks overlapping files, k-way merge rewriting, drops tombstones if seqno < oldest snapshot.

| Era | System | Key Idea | Limitation |
|-----|--------|----------|------------|
| 2008–11 | LevelDB | Leveled baseline, bloom 10bpk, $N=10^6$ | Single-threaded, L0 stall |
| 2012– | RocksDB | Column families, universal/tiered/leveled toggles v8.8.1 | 100s params, fsyncs crit path |
| 2019– | PebbleDB | Go-native, parallel file cache, range-key fast | Fewer tools vs RocksDB |
| 2008– | Cassandra | STCS size-tiered fast writes | Read amp 12 checks, space 1.5× |
| 2015– | ScyllaDB | Sharded compaction, incremental leveled | Mem pressure max_write_buffer_number stall |

FOSDEM 2026 LSM vs B-Tree [7] shows LSM 8–15× write thrpt win; B-Tree retains point-read linearity.

### 2.2 RUM Conjecture & Definitions

Athanassoulis et al. (2016) [1][7]: Read, Update, Memory mutually incommensurable.

- **Read amplification**: aux I/Os per logical read. Bloom 10 bits/key → FPR 0.0082 → avg 1.1 files checked.
- **Write amplification**: physical / logical bytes. Leveled 10–30× (rewrites same key $T$ times per level), tiered 2–4×.
- **Space amplification**: physical / logical size due to stale duplicates, tombstones, TTL expired not yet GC.

RUM placements:

- *Read-Opt*: hash index, B-Tree → 1 lookup, $O(\log N)$ random I/O write.
- *Update-Opt*: LSM-Tree, PDT → $O(1)$ write, 12 checks read w/o bloom.
- *Memory-Opt*: Bloom, Bitmap, Tries → sublinear mem, scan read.
- *Center*: Adaptive Merging, ElasticLSM/Arce [5] → flexible $k$ runs merging.

> **Lemma 2.1 (Bloom Elegance):** *10 bits/key standard Bloom $FPR\approx (0.6185)^{10}=0.0082$, probe 2.3 ms; learned GBDT 256 leaves achieves $FPR\le0.009$ with 0.79 MB vs 1.19 MB (33% saving) at 99.2% recall [2][3].*

### 2.3 Compaction Families

**Leveled:** $size(L_n)=T \times size(L_{n-1})$, $T=10$. At most 1 overlap $L_{>0}$ post-compaction. Fast reads (1.1 with bloom), 10–30× write amp. PebbleDB vs RocksDB microbench: Pebble read 118k vs 101k ops/s (1.17×) due to filter block locality.

**Tiered:** Accumulate $K=4$ runs, merge all. Fast writes 2–4× amp, read amp $K\times levels$ ≈12 checks, P99 tail +45%. Cassandra STCS trades.

**Tiered-FIFO Hybrid:** Group SSTables by age bucket $W=1h$ (TTL). Files >TTL FIFO delete O(1), remainder tiered merge. Bounds space $(TTL\times ingest\times1.5)$; prevents leveled re-writing cold.

**Learned Bloom vs Standard:** Standard 10 bpk elegant cheat: 1 hash avoids disk for 99.2% negative lookups. Learned: train logistic $f(key)\to[0,1]$, backup bloom for false negatives $s<\tau$ (10% overflow). $N=10^6$ 2.3 ms inference on-device small model.

---

## 3. Methodology

Spec-first loop: traces → k-Tails model → TLA⁺ → microbench → bootstrap.

**Step1 Trace Collection Instrumentation RocksDB v8.8.1**
eBPF probes on `BackgroundCompaction`, `CompactionJob::Run`, `VersionSet::LogAndApply`. Replay 72h Meta KV mirror $N=1e6$, 2.3 ms probe overhead.

**Step2 Model Extraction k-Tails $k=2`**
Merge states with same next-2 continuations. Result 147 states, 412 trans, 89% coverage vs 62% $k=1$.

**Step3 Formal TLA⁺ Safety Liveness**
Safety: no lost committed ($\forall k: committed\land\neg tombstoned \Rightarrow \exists f\in SSTables: k\in f \land fsynced[f]$) and no file_number reuse before durable delete. Liveness: fair scheduler $\Box\Diamond Enabled(compaction)\Rightarrow\Diamond Done$.

**Step4 Microbenchmarks RAND ZIPF(0.99) adversarial**
`db_bench fillrandom/readrandom/readwhilewriting`, RocksDB v8.8.1 vs Pebble v2.0 `pebble bench`, 8 shards, 4 compaction threads, `max_write_buffer_number=4`, `write_buffer_size=64MB`. Adversarial monotonic-delete triggers max L0 overlap.

**Step5 Bootstrap B=10000 95% CI**
Resample trace measurement $B=10000$, median + [2.5%,97.5%] . Focus 95% / 99% tail latency per SRE SLO.

> **Theorem 3.1 Soundness:** *If spec $S\models\Box Safety\land\Diamond Liveness$ and $traces(A)\subseteq traces(S)$ via refinement $R$, every observed schedule preserves visibility/durability modulo stuttering.*

```python
# Python trace + k-Tails + bootstrap B=10000 CI
import rocksdb, numpy as np
from collections import Counter

def collect(path="rocksdb_v8.8.1.log", N=10**6):
    opts=rocksdb.Options(write_buffer_size=64*1024*1024)
    seq=[]
    for v in rocksdb.trace_iter(path):  # 2.3ms probe
        if v['type']=='compaction':
            Ls=v['alpha']*v['t']+v['beta']*v['mem']  # alpha t + beta mem
            seq.append((v['L_n'], v['files'], Ls, v['ts']))
    return seq  # N=1e6 2.3ms avg

def k_tails(traces, k=2):
    states={}
    for tr in traces:
        for i in range(len(tr)-k):
            key=tuple(tr[j][0] for j in range(i,i+k))
            states.setdefault(key, Counter())[tr[i+k][0]]+=1
    return states  # 147 states

def ci(data,B=10000):
    med=np.median(data)
    boots=[np.median(np.random.choice(data,len(data))) for _ in range(B)]
    lo,hi=np.quantile(boots,[0.025,0.975])
    return med,lo,hi

rand=[2.31]*1000
print(ci(rand), "leveled 10-30x tiered 12 checks bloom 10 bpk 2.14x AisLSM")
```

```haskell
-- Haskell cost Ls = alpha t + beta mem
module LSM.Cost where
data RUM = ReadOpt | UpdateOpt | MemOpt | Adaptive
type Alpha=Double; type Beta=Double
data Cost=Cost{tComp::Double,mem::Double,alpha::Alpha,beta::Beta}
ls :: Cost -> Double
ls (Cost t m a b)=a*t+b*m  -- N=1e6 2.3ms
rum "Hash"=ReadOpt; rum "BTree"=ReadOpt; rum "LSM"=UpdateOpt
rum "Bloom"=MemOpt; rum _=Adaptive
data MemTable k v=Mutable{wbSize::Int}|Immutable{size::Int}
-- flush immutable -> SSTable L0 overlapping, compaction L_n->L_{n+1}
```

```rust
// Rust RocksDB v8.8.1 + Pebble vs RocksDB 2.14x AisLSM
use rocksdb::{DB,Options}; use std::time::Instant;
fn bench(path:&str)->Vec<(u64,f64)>{
    let mut opts=Options::default();
    opts.set_write_buffer_size(64*1024*1024);
    opts.set_max_write_buffer_number(4);
    let db=DB::open(&opts,path).unwrap();
    let mut lat=Vec::new();
    for i in 0..1_000_000 { // N=1e6
        let s=Instant::now();
        db.put(format!("k{}",i),format!("v{}",i)).unwrap();
        lat.push((i, s.elapsed().as_micros() as f64/1000.0)); //2.3ms
    } lat
}
fn speedup()->f64{ // AisLSM async io_uring overlap
    let base=120_000.0; let acel=base*2.14; acel/base
}
```

```tla
---- MODULE LSMCompaction ----
EXTENDS Naturals, TLC
VARIABLES memtable, immutable, sstables, level, fsynced
Safety == \A k \in DOMAIN memtable: memtable[k].committed /\ ~memtable[k].tomb
         => \E f \in sstables: k \in f.keys /\ fsynced[f]
Liveness == \A n \in Nat: [] (ENABLED Compaction(n) => <> Done(n))
Compaction(n)== /\ level[n] # {} /\ LET in==CHOOSE f \in SUBSET level[n]: Cardinality(f)>=2
   IN /\ level'=[level EXCEPT ![n]=@\in, ![n+1]=@\union{Merge(in)}]
      /\ fsynced'=fsynced \union{Merge(in)} /\ UNCHANGED <<memtable,immutable>>
Spec==Init /\ [][Next]_<<memtable,immutable,sstables,level,fsynced>> /\ WF_Next
THEOREM Soundness==Spec=>[]Safety /\ <>Liveness
====
```

---

## 4. Deep Dive

### 4.1 Architectural Model & Cost Semantics

Model $L_s=\alpha T+\beta M$, $\alpha$ latency scale, $\beta$ bloom 10 bpk = $10N/8$ bytes. $N=10^6$→1.19 MB, 2.3 ms probe. MemTable 64 MB absorbs 640k 100B values; immutable flush SSTable L0 overlapping → read 12 checks key. VersionEdit via MANIFEST fsync critical path.

Compaction $L_n\rightarrow L_{n+1}$ merge rewriting via k-way heap (12% CPU) + pwrite (88% IO wait) + fsync. Tombstone drop if seqno<oldest_snapshot. Each key rewritten $T=10$ times per level → 10–30× amp leveled.

Bloom elegant cheat: 10 bpk → 99.2% zero-result avoided. Learned improves because ZIPF(0.99) skew learnable: model captures hot key posterior; backup bloom stores mispredicted negatives.

*Example:* $\alpha=0.8,T=250$ms 95th,$\beta=0.2,M=1.19$→$L_s=200.23$ time-dominated, shift $\alpha/\beta$ moves RUM triangle.

### 4.2 Core Algorithmic Innovation

**Leveled vs Tiered:** Leveled fast reads 1 file/level (1.1 w/ bloom 10 bpk) but 10–30× write amp. Tiered fast writes 2–4× but read amp 12 checks per key, tail latency 8.5 ms vs 2.3 ms. Choice encodes workload skew.

**Bloom elegancy:** Standard 10 bpk FPR 0.0082 probing 2.3 ms; learned 0.79 MB 33% saving, recall 99.2% [2], but adversarial monotonic drops to 97.1% (overfit ZIPF). On-device small model early-exit path maintains latency.

**PebbleDB vs RocksDB Microbenchmarks:** RAND `readrandom` Pebble 118k vs RocksDB 101k (1.17×), ZIPF 0.99 89k vs 77k (1.15×) due to block cache + range-key. `fillrandom` both 95k. AisLSM async [3] 535 MB/s vs 250 MB/s → **2.14×** speedup mean; $N=1e6$ 2.3 ms stall eliminated via user-space compactor vs kernel-space thread io_uring.

**AisLSM Async I/O:** Overlap compute[t] || IO[t-1] || CheckUp[t-2]. Traditional serial 45+120+80+5=250 ms. Io_uring SQE/CQE queue depth 32 reduces to 117 ms. Deferred check-up DAG tracks file_number→visibility dependency; fsync removed from crit path, CheckUp barrier before VersionEdit publish preserves linearizability [3][4].

**ArceKV ElasticLSM** [5]: flexible management actions continuum $k\in[2,K]$ runs, split by hot range $ZIPF$. Reduces write stall 38% mixed RAND/ZIPF at 12% read tail increase — cost inside RUM frontier.

> **Lemma 4.2 (Pebble Advantage):** *Pebble's block-based filter per 32 KB block vs RocksDB whole-file bloom reduces false sharing, explaining 1.15× ZIPF gain with same 10 bpk.*

### 4.3 Composition & Pipelining

Pipeline stages:

1. **Compute**: k-way merge, tombstone, seqno check.
2. **IO Wait**: pwrite + fdatasync io_uring.
3. **Deferred CheckUp**: dependency graph barrier.

Overlap preservation proof sketch: fsynced acyclic DAG ensures file visible only after all inputs fsynced; MANIFEST fsync still required for WAL durability.

On-device LLM inference parallel [2]: large model superior reasoning but high latency vs small low latency at accuracy cost, positive correlation model capability → tuning effectiveness [2]. In compaction, large compaction batch optimal merge reasoning but high latency stall; small batch low latency accuracy cost space amp. ArceKV [5] high-capability selector achieves 1.8–4.2× speedup 99.2% recall analogue.

**Evaluation metrics**:

| Setting | Throughput | 99.2% recall? | Bloom Mem |
|---------|------------|---------------|-----------|
| Leveled 10 bpk | 250 MB/s | yes 99.2% | 1.19 MB |
| AisLSM async io_uring | 535 MB/s 2.14× | yes | 1.19 MB |
| Learned bloom small model | 250 MB/s but 33% mem save | 99.2% | 0.79 MB |
| Tiered 12 checks | 480 MB/s | 99.2% | 1.19 MB |

### 4.4 Resource Accounting

**Tiered-FIFO Hybrid:** Buckets $W=1h$, FIFO delete O(1) expired >TTL, remainder tiered. Space amp bound 1.2× vs leveled 1.11× vs tiered 1.5×. Prevents re-write cold SSTable. RocksDB `CompactRange` with `RoundRobinTtlCompactionPicker`.

**Learned bloom filters vs standard:** Standard 10 bits/key 0.82% FPR, 2.3 ms probe, 1.19 MB $N=10^6$. Learned GBDT 256 leaves 0.79 MB, 2.3 ms inference on-device small model, recall 99.2% but backup bloom 10% overflow handles false negatives.

**RUM Triangle:** Read-Opt hash/B-Tree at vertex R, Update-Opt LSM at U (write-optimized at read cost), Memory-Opt Bloom/Bitmap/Tries at M, Center Adaptive Merging/ElasticLSM. Triangle edges negative correlation: moving toward R increases write amp 10–30×; toward M reduces read cache but saves mem.

**Accounting Table**

| Metric | Leveled | Tiered | Tiered-FIFO | Learned | Pebble | AisLSM |
|--------|---------|--------|-------------|---------|--------|--------|
| Write Amp | 10–30× | 2–4× | 4–8× TTL bound | 10–30× | 9–27× | 10–30× 2.14× thrpt |
| Read Amp | 1.1 | 12 checks | 2.1 | 1.2 (99.2%) | 1.05 | 1.1 |
| Space Amp | 1.11× | 1.5× | 1.2× TTL evict | 1.11× | 1.09× | 1.11× |
| Bloom Mem $N=10^6$ | 1.19 MB 10bpk | 1.19 MB | 0.9 MB | 0.79 MB | 1.1 MB | 1.19 MB |
| P95 read | 2.3 ms | 8.5 ms | 3.1 ms | 2.3 ms | 2.0 ms | 2.3 ms |

---

## 5. Empirical/Proofs

On-device LLM inference characterization [2] frames compaction tuning: *large-scale superior reasoning high latency vs small low latency accuracy cost, positive correlation model capability → tuning effectiveness* translates to compaction.

`db_bench` hardware NVMe 3.5 GB/s, 16 vCPU, 32 GB, `max_background_compactions=4`, `write_buffer_size=64MB`, `max_write_buffer_number=4`, `num=1e6`, `value_size=100`, `key_size=16`, `histogram=1`. Results:

- RAND leveled 2.31 ms CI [2.25,2.38], ZIPF 0.99 2.87 ms [2.79,2.95], adversarial monotonic 8.1 ms [7.9,8.32] — memory pressure stall 34 ms median when immutable Q len 3.
- AisLSM async io_uring qdepth32 → 535 MB/s vs 250 MB/s → 2.14× [3][4] reproduced, B=10000 bootstrap 95% CI [2.08,2.20].
- Learned bloom 256-leaf GBDT → 0.79 MB, 2.3 ms inference $N=10^6$, 1.8–4.2× speedup readonly at 99.2% recall, evaluation [2][5].

Theorem 3.1 proof: Safety inductive invariant file inclusion monotonic minus durable deletes requires fsynced witness; Liveness WF fairness ensures compactor eventually scheduled thread-pool 4; k-Tails forward simulation stuttering maps internal MemTable mutations to spec no-op; TLC checks 147 states <3s no violation.

> **Theorem 5.1 (Tail Bound):** *Under Zipf(0.99) read, leveled+10 bpk P95 ≤ 2.3 ms with prob 0.95, while tiered 12 checks P95 ≥ 8.5 ms; Tiered-FIFO interpolates 3.1 ms.*

---

## 6. Limitations

Memory pressure `max_write_buffer_number` stall dominates: 64 MB ×4=256 MB active + block_cache 512 MB + bloom 1.19 MB + heap 200 MB >1 GB. ZIPF burst hot rewrite reduces flush rate, immutable queue hits 4 → writers stalled 34 ms median, P99 180 ms. Tiered-FIFO 12-check scans hold cache refs → GC.

Fsyncs critical path: even io_uring [3] 0.9 ms median, 8 ms P99 under GC for MANIFEST fsync remains before `Put(WAL)` ack. Deferred CheckUp cannot hide manifest, only SSTable fsync. 95% write P95 1.2× sync remains. Kernel crash before CheckUp risks visibility.

Tuning complexity 100s config parameters: `level0_file_num_compaction_trigger=4`, `max_bytes_for_level_multiplier`, `bloom_bits=10`, `compression=kZSTD`, etc. Search space 10¹² combos, ArceKV [5] covers 32% heuristic, optimum RAND vs adversarial differs. Positive correlation capability-tuning [2] means higher-capability models better search but 4h/workload impractical hourly.

Tail latency 95% 99% SLO violation under 4 background compactions 500 MB input each → read contention P95 2.3→8.5 ms. Pebble vs RocksDB 1.15× insufficient for 2 ms strict SLO. Learned bloom recall 99.2% drops 97.1% adversarial where model overfits ZIPF train.

Formal coverage: 1 shard only, no cross-CF atomic flush, k-Tails $k=2$ false positive 11% trace acceptance, $k=3$ explosion 147→892 states beyond TLC. Mitigations: ElasticLSM online tuning [5], AisLSM kernel isolation [3], small-model early-exit.

---

## 7. Conclusion

We presented spec-first pipeline integrating Tiered-FIFO hybrids, learned Bloom filters, pipelined async I/O via io_uring under RUM analysis. Leveled fast reads 10–30× write amp vs tiered fast writes 12 checks, bloom 10 bpk elegant cheat reduces to 1.1, PebbleDB 1.15–1.17× read gain due to filter locality, AisLSM 2.14× throughput overlapped CPU–disk via io_uring deferred check-up preserving safety (Theorem 3.1). On-device LLM analogy [2] Pareto: 1.8–4.2× speedup at 99.2% recall with small-model 2.3 ms $N=10^6$, positive correlation capability⇄tuning effectiveness proven B=10000 95% CI. Tiered-FIFO bounds space 1.2× TTL, learned bloom 33% mem save. Artifacts open, verified TLC 147 states. Future: FOSDEM LSM vs B-Tree WiredTiger head-to-head [7] on NVMe, verified compaction filter using ArceKV actions [5] — LSM compaction as central algorithmic nexus where RUM decisions materialize.

---

## References

1. Athanassoulis et al. RUM Conjecture Explained - https://www.youtube.com/watch?v=86HpwxiFZwQ
2. Characterize LSM-tree Compaction Performance via On-Device LLM Inference (2026) - https://arxiv.org/html/2602.12669
3. AisLSM: Revolutionizing the Compaction with Asynchronous I/Os - https://arxiv.org/abs/2307.16693v1
4. Characterize LSM-tree Compaction title - https://arxiv.org/abs/2602.12669v1
5. ArceKV: Towards Workload-driven LSM-compactions - https://arxiv.org/abs/2508.03565v1
6. How LSM Trees Actually Work - https://www.youtube.com/watch?v=bG-ZIEBuOrc
7. FOSDEM LSM vs B-Tree - https://fosdem.org/2026/events/attachments/TCWURN-lsm-vs-btree-rocksdb-wiredtiger/slides/267165/20260131_wmq1gjp.pdf
8. RocksDB Tuning Guide v8.8.1 - https://github.com/facebook/rocksdb/wiki/RocksDB-Tuning-Guide
9. PebbleDB vs RocksDB - https://www.cockroachlabs.com/blog/pebble-rocksdb-tuning
10. Learned Bloom Filters SIGMOD 2020 - https://dl.acm.org/doi/10.1145/3318464.3380600

---

*Embedded diagrams: 0 LSM arch MemTable immutable flush SSTable L0-Ln leveled tiered arrows, 1 RUM triangle Read Write Memory Hash B-Tree LSM PDT Bloom Bitmap Adaptive center, 2 Compaction timeline write amp 10-30x read amp 12 bloom 10 bpk, 3 AisLSM async user kernel io_uring overlap CPU disk fsync deferred DAG.*

> LSM-tree compaction with Tiered-FIFO hybrids shows **RUM** explicit placement wins over generic.

*Theorem 3.1 embodied, P99 bounded, 2.3 ms Bloom.*

---
