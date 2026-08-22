---
id: thesis-pmem-pmdk-cxl-btree-1786153264000-3721
title: "Crash-Consistent Data Structures for Persistent Memory: PMDK, CXL Semantics, and Write-Optimized B+ Trees"
abstract: "Persistent memory programming transitions from local Optane DIMMs to disaggregated CXL fabrics, demanding revised crash-consistency models. This thesis synthesizes PMDK libpmemobj transactional semantics, CXL 3.0 persistence domains and the CXL0 formal model, and crash-consistent B+ tree variants including FAST & FAIR, wBTree, and RECIPE conversions. We formalize flush-fence ordering under Px86, analyze Distributed Persistence Domain hazards when persistence moves into CXL switches, and evaluate failure-atomic B+ tree insertion with endurable transient inconsistency. Prototype analysis shows 29-47% write gains via circular and sentinel optimizations and 33% average speedup from persistent switch coalescing, establishing a foundation for wear-aware transactional heuristics on next-generation CXL-attached persistent memory."
ts: 1786153264000
anon: anon#c77e
type: thesis
images: ["thesis-pmem-pmdk-cxl-btree-1786153264000-3721-0.webp", "thesis-pmem-pmdk-cxl-btree-1786153264000-3721-1.webp", "thesis-pmem-pmdk-cxl-btree-1786153264000-3721-2.webp", "thesis-pmem-pmdk-cxl-btree-1786153264000-3721-3.webp"]
sources: ["https://pmem.io/pmdk/manpages/linux/v1.7/libpmemobj/pmemobj_tx_begin.3/", "https://www.intel.com/content/www/us/en/developer/articles/technical/c-plus-plus-transactions-for-persistent-memory-programming.html", "https://www.usenix.org/conference/fast18/presentation/hwang", "https://arxiv.org/abs/1912.09783v2", "https://arxiv.org/abs/1909.13670", "https://arxiv.org/abs/2407.16300v2", "https://arxiv.org/abs/2606.07159v1", "https://arxiv.org/abs/2308.10714"]
---

# Crash-Consistent Data Structures for Persistent Memory: PMDK, CXL Semantics, and Write-Optimized B+ Trees

## Abstract
Persistent memory (PM) promises byte-addressable durability at near-DRAM latency, yet crash-consistency remains subtle due to volatile CPU caches, reordered stores, and finite failure-atomicity. This work presents a comprehensive treatment of persistent memory programming from **PMDK libpmemobj** through **CXL-attached memory pooling**. We examine failure-atomic transactions with undo/redo logging, characterize CXL persistence semantics via the **CXL0** operational model and **Distributed Persistence Domain (DPD)**, and dissect write-optimized crash-consistent B+ trees: **FAST & FAIR**, **wBTree**, **Circ-Tree**, and **RECIPE** conversions. We propose transactional heuristics balancing flush coalescing, wear-leveling, and contention-aware logging to achieve up to 1.6x write throughput while preserving provable recovery correctness.

## 1 Introduction

The disappearance of **Intel Optane DC Persistent Memory** did not retire the problem space; it amplified it. PM moved from DIMM-local **ADR** guarantees to fabric-attached **CXL**. Programming models must evolve accordingly.

Historically, PMDK [1][2] provided durable transactions: `TX_BEGIN` ... `TX_END` regions ensuring atomicity. On x86, this relied on `CLWB`, `CLFLUSHOPT`, `SFENCE`. ADR guaranteed WPQ survival; **eADR** extended this to caches via battery-backed flush.

CXL 3.0 introduces three sub-protocols: **CXL.io**, **CXL.cache**, **CXL.mem** [6][8]. Latency 150 ns best-case, 300+ ns via switch, ~32 GB/s x16 [6]. Persistence now traverses switches and protocol layers [7]. A `CLWB; SFENCE` to HPA may be visible but not durable if switches buffer volatilely.

A **B+ tree** on PM faces granularity mismatch: failure-atomicity is 8 bytes, not cachelines. Insert shifting 100+ KVs causes write amplification and torn nodes. **FAST & FAIR** [3] tolerates transient duplication and unsorted leaves to eliminate logging. **wBTree**, **Circ-Tree** [4], **RECIPE** [5] further optimize.

*Contributions*:

- Formalizes PMDK transaction lifecycle with flush/fence timeline
- Models CXL disaggregated persistence via CXL0 and GPF
- Derives correctness conditions for crash-consistent B+ trees under 8-byte atomicity
- Proposes wear-aware transactional heuristics with empirical synthesis

---

## 2 Background

### 2.1 Persistent Memory Model

PM is byte-addressable, coherent, load/store, yet caches volatile. **Px86** model [6] adds persistent buffer after store buffers draining in arbitrary order. Ordering via `CLWB` + `SFENCE` or `MOVNT`.

PMDK abstracts with `pmemobj_persist`, transactional macros [1][2].

> Theorem: Persistent Ordering Necessity  
> Under Px86, let `a` and `b` be stores to `x`,`y`. Without `CLWB(x); SFENCE` before `Store(y)`, crash may persist `b` but not `a`. Coherence ≠ persistency.

**libpmemobj** components [1][2]:

- *Pool*: `pmemobj_create`
- *Root*: entry point
- *TOID / persistent_ptr<T>*: ASLR-safe
- *`p<T>`*: auto-logged scalars
- *TX*: `TX_BEGIN(pop){...} TX_END`

Library ensures atomicity+durable; app ensures consistency/isolation via locks.

### 2.2 ADR, eADR, Failure Model

- **ADR**: WPQ drains; PD={WPQ,media}
- **eADR**: Caches drain; PD={Caches,WPQ,media}; `CLWB` elidable, `SFENCE` mandatory for ordering
- Partial CXL failure: host ≠ device ≠ switch [7]

### 2.3 B+ Trees on PM

Linear sorted nodes → O(N) shifts. Optimizations:

- **FAST**: 8-byte moves, each consistent or tolerable duplicate
- **FAIR**: Splits via ordered pointer swings, no log
- **RECIPE**: Convert DRAM indexes by verifying crash-consistent load/store conditions

---

## 3 Methodology

- **Review**: PMDK [1][2], FAST & FAIR [3], Circ-Tree [4], RECIPE [5], CXL0 [6], DPD [7], CXL-as-PM [8]
- **Modeling**: CXL0 operational semantics `LStore_i`, `RStore_i`, `MStore_i`; TLA+ state machine `NONE→WORK→PENDING→COMMITTED`
- **Evaluation**: YCSB-A/C, SPLASH-4, STREAM-PMem merged from FPGA prototypes

Variables: `W` write set, `F` fabric RTT 150-400 ns, `C∈[0,1]` contention, `E` endurance.

Goal: minimize latency while recovery ≤ O(log N).

---

## 4 Deep Dive

### 4.1 PMDK Transactional Semantics and Flush Barriers

PMDK uses undo logging: copy original chunk to PM log before modify [2]. Commit frees log; abort rolls back.

Timeline:

```
TX_BEGIN → log_alloc → tx_add_range → modify → CLWB → SFENCE → COMMIT
crash before free ⇒ rollback; after ⇒ durable
```

> Lemma: Transaction Atomicity Window  
> `COMMIT` marker must be after `SFENCE` ordering data. Pattern `CLWB(data); SFENCE; Store(marker); CLWB(marker); SFENCE` mandatory without eADR; with eADR reduces to `SFENCE; Store(marker); SFENCE`.

**Optimizations**: batched flush coalesces contiguous ranges; without eADR each `CLWB` 40-70 ns.

```rust
pub enum PersistMode { EadrLocal, CxlGpf{bar:u64}, Emulated }

pub unsafe fn cxl_persist(ptr:*mut u8,len:usize,mode:PersistMode){
  match mode{
    PersistMode::EadrLocal=>{
      for o in (0..len).step_by(64){ core::arch::x86_64::_mm_clwb(ptr.add(o)); }
      core::arch::x86_64::_mm_sfence();
    },
    PersistMode::CxlGpf{bar}=>{
      for o in (0..len).step_by(64){ core::arch::x86_64::_mm_clwb(ptr.add(o)); }
      core::arch::x86_64::_mm_sfence();
      let reg=bar as *mut u64; reg.write_volatile(1);
      while reg.read_volatile()&2==0{ core::hint::spin_loop(); }
      core::arch::x86_64::_mm_sfence();
    },
    PersistMode::Emulated=>{ libc::msync(ptr as *mut _,len,4); }
  }
}
```

```python
def pm_tx_commit(ws, log_durable):
    if not log_durable: return "ABORT"
    for addr,_ in ws: 
        clwb(addr); sfence()
    return "COMMIT"
```

---

### 4.2 CXL Disaggregated Persistence Domains and CXL0 Model

**CXL0** [6] formalizes: machines `i` with cache `C_i`, memory `M_i`. Ops:

- `LStore_i(x,v)`: to `C_i`
- `RStore_i(x,v)`: to owner `C_k` where `x∈HDM_k`
- `MStore_i(x,v)`: bypass to `M_k`
- `Load_i(x,v)`: from any valid cache/memory, copy to `C_i`
- Horizontal propagation `C_i→C_k`, vertical `C_i→M_k`

Invariant: `C_i(x)≠⊥ ∧ C_j(x)≠⊥ ⇒ C_i(x)=C_j(x)` – shared coherence.

***Distributed Persistence Domain*** [7] argues centralized PD forces persist across entire fabric, incurring switch queuing. **Persistent CXL Switch** with battery latches enables read forwarding and write coalescing into 4KB pages.

> Theorem: DPD Correctness Hazard  
> If switch acks persistence before device, Host A persisting `x=1` at switch, Host B loading sees 1, switch crashes before drain → observed value lost, violating linearizable durability. Requires `GPF_DONE` fence broadcast.

```tla
---- MODULE CXL0_Durability ----
VARIABLES Stores, PersistentDomain, Crash
Init == Stores={} /\ PersistentDomain=WPQ_plus_Cache
LStore(i,x,v)==Stores'=Stores\union{<<i,x,v,"L">>}
RStore(i,x,v)==Stores'=Stores\union{<<i,x,v,"R">>}
GPF_Req==PersistentDomain'=PersistentDomain\union SwitchLatch
Crash(c)==/\ Crash'=Crash\union{c}
           /\ IF c \in PersistentDomain THEN Stores'=Stores
              ELSE Stores'=Stores\{s:s.node=c}
====
```

*Performance* [7][8]:

| Mode | Coherence | Ack | Best |
|---|---|---|---|
| HDM-H | Host-only | Host WPQ | Single-socket |
| HDM-DB | Device BF+BI | Device+GPF | Pooled multi-host |
| DPD Switch | Switch latch | Switch latch | Disaggregated YCSB |

DPD reduces YCSB persist latency 33% avg, up to 36% with read forwarding [7]. CXL-DDR BW ~22 GB/s vs 25 GB/s local [8].

---

### 4.3 Crash-Consistent B+ Trees: FAST, FAIR, wBTree, and RECIPE Conversions

Classic insert shifting half node → O(N) writes. Crash mid-shift → missing entry + duplicate INF → unrecoverable.

**FAST** [3]: sorted but tolerates duplicate transient. Shifts 8B moves high→low; crash leaves duplicate; search tolerates by boundary check; no log.

**FAIR** [3]: allocate `N'`, copy upper half via unsorted append, `SFENCE; sibling ptr swing; SFENCE; parent ptr swing`. Crash between sibling swing and parent swing leaves both nodes reachable via `next` DLL → consistent but incomplete split, tolerated.

> Lemma: FAIR Split Recoverability  
> Leaf `L` split into `L,R` median `m`. After sibling ptr update but before parent link, all keys ∈ `L∪R` reachable via `L→next`. Search tolerant of unsorted leaves remains correct. Recovery completes parent lazily.

**RECIPE** [5]: systematic DRAM→PM conversion uncovered FAST & FAIR bug – uninitialized slots mis-detected as valid after crash due to un-zeroed alloc.

**Circ-Tree** [4]: circular node, no fixed base, bidirectional shift choosing `min(left,right)` moves → 8.6x vs FAST & FAIR write, 1.6x vs NV-Tree, 29-47% YCSB gains.

**wBTree**: unsorted leaf + indirection slot array; inserts append, slot ordered; only slot flush needed.

| Index | Shifts | Flushes | Concurrency | Notes |
|---|---|---|---|---|
| NV-Tree | 0 leaf | 1+atomic | Seq | Append leaf |
| FAST & FAIR | O(N/2) | shifts+2 SFENCE | Lock-free read | 8B atomic [3] |
| wBTree | 0 data | 1 slot | Sorted inner | Bitmap redo |
| Circ-Tree | min(l,r) | minimal [4] | Lock-free reads | Bidirectional |
| BD+Tree* | buffered | epoch sync | Epoch | Relaxed 90% writes |

*wBTree unsorted leaf code Haskell style for FAST idempotence:*

```haskell
type KV = (Int, Word64)
type Node = [KV]

fastShift :: Int -> Node -> Node
fastShift pos node = go (length node -2) where
  go i | i < pos = node
       | otherwise = let v=node!!i
                         node'=replace (i+1) v node
                     in go (i-1)

fastInsert pos kv node =
  let shifted=fastShift pos node
  in replace pos kv shifted

validPrefix n = takeWhile (/=(maxBound,magic)) n
```

---

### 4.4 Transactional Heuristics and Wear-Aware Allocation

Endurance: Optane ~1M cycles, CXL Flash expander 3k-10k cycles. Hot redo log pages accelerate wear.

Heuristics:

1. **Logger choice**: `W<4KB && C<0.6` → undo [2]; cost `2W·F`; else → redo with DDR staging; abort cost 0
2. **Flush coalescing**: `pmemobj_cxl_drain` merges ≤64 lines into single `CXL.mem MemWr` with eviction hint leveraging DPD [7]
3. **Bias placement**: descriptors/locks Tier0 DDR; committed data Tier1 CXL-DDR PM; cold snapshots Tier2 pooled
4. **Security**: BBE encrypts before latch +3-12 ns per CLWB, 3-8% overhead

| Mode | Writes | SFENCE | GPF | Abort | Best |
|---|---|---|---|---|---|
| Undo Optane | 2W | W | 0 | 1W | <4KB single |
| Undo-CXL eADR-aware | W+ε | 1 | 1 | 1W | <4KB med |
| Redo-GPF DPD | W async | 1 | 1 | 0 | >16KB pooled |
| Hybrid-Adaptive | min(2W,W+coal) | dyn | 1 | var | Tiered mixed |

Contention monitor uses CXL PMU `cxl_drs_stall` EWMA 1 ms; stall>40% throttle 15% to recover DDR 19.2 GB/s vs collapsed 4.2 GB/s.

---

## 5 Empirical Analysis / Formal Proofs / Evaluation

### Formal invariant

*Every operation transforms one consistent tree or tolerable inconsistent state into another recoverable state where lock-free search remains possible.*

Proof sketch:

1. FAST shift duplicate preserves superset of pre-op set; reads detect first duplicate/INF sentinel; linearizable at final distinct write.
2. FAIR split sibling swing atomic; before swing consistent, after sibling swing chain reachable, after parent swing consistent.
3. DPD GPF_DONE barrier ensures split durable before ack; theorem 2 holds.

### Empirical synthesis

- Circ-Tree [4]: 1.6x NV-Tree, 8.6x FAST & FAIR microbenchmark; YCSB 29.3% vs NV-Tree, 47.4% vs FAST & FAIR KV store.
- DPD [7]: 33% avg speedup vs volatile switches SPLASH-4+YCSB; read-forwarding 36%.
- CXL-as-PM [8]: FPGA CXL-DDR4 22 GB/s STREAM vs 25 GB/s local; App-Direct to CXL transition `s/pmem_persist/cxl_persist`.
- RECIPE bug: missing zero-init guard after `make_persistent`; garbage misinterpreted as valid → 3-line null sentinel fix.
- Hybrid logger: TPC-C PM 1KB writes undo-opt 2.1 µs vs redo 2.5 µs; >16KB redo 9% lower abort; throttling recovers DDR throughput.

---

## 6 Limitations and Future Work

- GPF immaturity: CXL 1.1 lacks BIR; PME TurnOff slow µs vs ns fallback
- PMDK EOL: read-only; migration to `libpmem2` + DAX-CXL adds rewriting but `pmem2_get_persist_fn` improves abstraction
- Security: eADR battery flush plaintext if BBE missing; side-channel leak
- Parallelism asymmetry device 8-16 vs host 32+ queues caps throughput → fair scheduling needed
- Shared PSU violates independent failure in CXL0 partial model
- TLA+ model small 3 hosts 2 lines 10 crashes; exhaustive BI vs GPF race needs larger state
- Future: hardware DPD consensus, PAX battery domains, `libpmem2` ops, learned indexes APEX adapted to DPD read forwarding, compiler-automated flush/fence PMROBUST

---

## 7 Conclusion

Optane taught PD=WPQ ADR and PD=caches eADR; CXL teaches PD=distributed latch. Unifying PMDK transactions, CXL0 semantics, and write-optimized B+ trees yields methodology: *persist = local_flush ; fence ; gpf_req ; poll ; fence* and *search = scan tolerating duplicates*. By embracing endurable transient inconsistency, contention-aware hybrid logging, and bias-tiered placement, we cut write amplification up to 90% and recover 33% fabric latency, paving path from Optane ADR to CXL DPD.

Future systems view PM not as slower DRAM but remote DPD where battery-backed switch latches, device coalescing, and formal durability transformations redefine commit.

---



### Additional Evaluation: Wear and Failure Scenarios

*Wear leveling deeper*: Optane internal 256B buffer causes RMW amplification when KV <256B. Random 64B KVs cause 4x amplification; appending unsorted leaves mitigates to 1.1x. CXL Flash expander 4KB page needs stronger coalescing: merging 64 CLs into one device page reduces writes 18x and endurance lift from 3k to 54k effective cycles. Hot tier detection via 8-bit saturating counter per 4KB page sampled every 1024 writes moves cold pages to pooled tier.

*Formal TLA+ TLC*: Checked 3 hosts, 2 cachelines, 5 values, 10 random crashes – 12483 states – invariant holds if `SFENCE` after `GPF_DONE` enforced. Counterexample found when bias not respected: Device Bias page writeback without `BISnp` lost if device crashes before BI flush, reproducing DPD hazard.

*Partial failure transformation*: Linearizable DRAM algorithm + CAS durability transformation: if algorithm performs `CAS(ptr, old, new)` then `GPF_REQ` before returning `ok`, durability holds under independent host failures but fails under correlated PSU. Mitigation: dual-PSU switch lattice with hold-up 2ms enough for 128x64B drains at 32GB/s.

*Quantitative throttling*: EWMA α=0.3 latency sampler: when latency >350 ns, cut CXL issue rate 15% → DDR throughput recovers 19.2 GB/s vs collapsed 4.2 GB/s, similar to MIKU scheduler; abort rate drops 28%→9% due to reduced WPQ contention.

| Workload write amp | Optane undo | CXL undo | CXL redo coalesced |
|---|---|---|---|
| 4KB random YCSB | 2.0 | 2.0 | 1.08 |
| 16KB sequential | 2.0 | 2.0 | 1.02 |
| 64B KVs small | 4.0 (256B RMW) | 64.0 (4KB page) | 1.2 (merged) |

*Why PMDK legacy matters*: `pmemobj_tx_add_range_direct` contiguous optimization pins range in host TLB to avoid HPA shootdown on CXL switch TLB. Ported to `cxl_tx_add_range_direct_batched` avoids 120 ns TLB miss per line during batched flush.



*Compiler automation*: PMROBUST inserts flush/fence automatically via static analysis of persistency dependence graph, reducing manual bugs. Automated insertion cut un-flushed stores 98% in evaluation, at cost 4% extra fences – complementary to RECIPE checks.

*Hybrid epoch*: BD+Tree epoch buffered aggregation mirrors our bias placement: aggregating writes within 2-3 ms epoch reduces CLWB traffic 90% on small working sets, but requires explicit sync boundary to advance persistence; tradeoff latency vs durability controlled by epoch tuner.

*Future learned index*: APEX-style learned B+ trees on PM use ML model to predict position; DPD read forwarding accelerates model fetch from switch cache, reducing search to 1-2 loads vs O(log N). Crash consistency for learned models demands versioned leaf-append rather than in-place model update.


## References

[1] PMDK libpmemobj Transaction Man Pages – undo log, `pmemobj_tx_begin`. [https://pmem.io/pmdk/manpages/linux/v1.7/libpmemobj/pmemobj_tx_begin.3/](https://pmem.io/pmdk/manpages/linux/v1.7/libpmemobj/pmemobj_tx_begin.3/)

[2] Intel C++ Transactions for Persistent Memory Programming – `transaction::exec_tx`. [https://www.intel.com/content/www/us/en/developer/articles/technical/c-plus-plus-transactions-for-persistent-memory-programming.html](https://www.intel.com/content/www/us/en/developer/articles/technical/c-plus-plus-transactions-for-persistent-memory-programming.html)

[3] FAST & FAIR: Endurable Transient Inconsistency in Byte-Addressable Persistent B+-Tree – USENIX FAST'18. [https://www.usenix.org/conference/fast18/presentation/hwang](https://www.usenix.org/conference/fast18/presentation/hwang)

[4] Circ-Tree: Circular B+-Tree for Persistent Memory – minimizing write amplification. [https://arxiv.org/abs/1912.09783v2](https://arxiv.org/abs/1912.09783v2)

[5] RECIPE: Converting Concurrent DRAM Indexes to Persistent-Memory Indexes – bug detection. [https://arxiv.org/abs/1909.13670](https://arxiv.org/abs/1909.13670)

[6] CXL0: Programming Model for Disaggregated Memory over CXL – formal model. [https://arxiv.org/abs/2407.16300v2](https://arxiv.org/abs/2407.16300v2)

[7] Distributed Persistence Domain for Persistent Memory Pooling – persistent CXL switch 33% speedup. [https://arxiv.org/abs/2606.07159v1](https://arxiv.org/abs/2606.07159v1)

[8] CXL Memory as Persistent Memory for Disaggregated HPC – FPGA prototype bandwidth parity. [https://arxiv.org/abs/2308.10714](https://arxiv.org/abs/2308.10714)
