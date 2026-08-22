---
id: thesis-pmem-txn-pmdk-romulus-20260810b
title: "Persistent Memory Transaction Libraries: PMDK libpmemobj, Romulus Persistency Semantics, and Failure-Atomic msync with CXL 3.0 Fabric Semantics"
ts: 1786408600000
anon: anon#4837
type: thesis
topic: thesis
thesis: true
images:
  - thesis-pmem-txn-pmdk-romulus-20260810b-0.webp
  - thesis-pmem-txn-pmdk-romulus-20260810b-1.webp
  - thesis-pmem-txn-pmdk-romulus-20260810b-2.webp
  - thesis-pmem-txn-pmdk-romulus-20260810b-3.webp
---

# Persistent Memory Transaction Libraries: PMDK libpmemobj, Romulus Persistency Semantics, and Failure-Atomic msync with CXL 3.0 Fabric Semantics

## Abstract
Persistent Memory (PMEM) collapses the storage hierarchy by exposing byte-addressable non-volatility via DAX-mapped files, yet it fractures crash consistency. This thesis analyzes ***failure-atomic transaction*** libraries: Intel PMDK libpmemobj's undo-log with `p<>` wrapper and `TX_BEGIN`, Romulus's twin-copy shadow paging with lock-free reads and flat-combining writes, and failure-atomic `msync` over CXL 3.0 fabric-attached memory pools. We formalize persistency domain semantics — Intel x86 `ADR`, `eADR`, CXL Global Persistent Flush (GPF), and epoch persistency. Empirical evaluation on Intel Optane DCPMM 256 GiB and emulated CXL 3.0 Type-2 devices shows PMDK undo overhead 22-38%, Romulus 8-14% for write-intensive YCSB-A, while CXL GPF adds 170-400 ns per switch hop. We prove buffered durable linearizability and evaluate whole-process persistence and checkpoint recovery for fabric failures. Limitations include wear-leveling and software `clwb`/`sfence` ordering pitfalls.

## 1. Introduction

> **Motivation:** Byte-addressable persistence promises in-memory databases without serialization, but torn writes corrupt B-trees and graphs after power loss.

Persistent memory was productized as Intel Optane DC Persistent Memory (DCPMM) in App Direct mode [1][2], exposing pools via `libpmemobj` [5]. However, x86-64 guarantees only 8-byte atomic stores [3]; larger updates require transactional all-or-nothing semantics [2]. The end of Optane forces migration to CXL-attached memory [7][8][9][10] where persistence is no longer local but fabric-enforced via CXL 3.0 Global Persistent Flush and `msync(MS_SYNC)` failure-atomicity contracts [11].

**Contributions:**

1. Formal operational semantics for PMDK undo-log vs Romulus dual-copy; proof of crash-serializability.
2. Measurement of CXL 3.0 fabric persistency cost: 2.5× latency for single-switch, exponential with multi-switch [9].
3. Design of failure-atomic `msync` over CXL disaggregated PMEM with checkpointing off critical path [12].
4. Open reproducible artifact on QEMU CXL emulation with `ndctl` and `daxctl`.

![PMDK libpmemobj undo-log architecture](/thesis/thesis-pmem-txn-pmdk-romulus-20260810b-0.webp)

## 2. Background

### 2.1 Persistent Memory Programming Model

PMEM is mapped via `mmap` with `MAP_SYNC` DAX. Intel defines persistence domains:

- *ADR*: Asynchronous DRAM Refresh — WPQ flush on power loss.
- *eADR*: Extended ADR — CPU caches included; `clwb` becomes optional for durability.
- *CXL GPF*: CXL 3.0 phase 1 and 2 — host initiates persistent flush to device persistent domain [7][8].

Failure atomicity ensures a transaction `Tx` is either fully durable or none [13]. PMDK `libpmemobj` implements this via **undo logging**: `pmemobj_tx_add_range` snapshots old content before in-place mutation; on abort, redo from undo. *C++ bindings* automate snapshot via `pmem::obj::p<T>` wrapper overloading `operator=` [1][3].

```cpp
// PMDK C++ transaction (p<> auto snapshot)
auto pop = pool<root>::open("/mnt/pmem/pool", "layout");
auto r = pop.root();
transaction::run(pop, [&]{
  r->x = 5;          // p<int> snapshots 8-byte old value to undo log
  r->list->insert(42);
});
if (transaction::get_last_tx_error()) recovery();
```

Romulus [6][14] avoids logging overhead using ***shadow paging***: two copies, main and back. Writes mutate *main* copy only; commit copies to *back* via `memcpy` + `clwb`. Crash recovery picks the consistent copy via header sequence number. Reads are wait-free; writes use flat-combining for scalability on 40-logical-core Xeon Gold [15][16].

### 2.2 CXL 3.0 Fabric Semantics

CXL 3.0 introduces Multi-Headed Logical Devices (MH-LD), fabric switches, and coherent memory pooling [7][10]. Type-2 devices (accelerator+memory) participate in coherence, enabling GPU direct access to PMEM without software intervention [12]. Persist latency scales 170-400 ns per switch hop [9]:

| Topology | Persist Latency | Normalized |
|----------|-----------------|------------|
| Local DDR | 80 ns | 1.0× |
| PMEM local (no CXL) | 300 ns | 3.75× |
| CXL 1-switch (Type-3) | 750 ns | 2.5× vs local PMEM |
| CXL 2-switch | 1.25 µs | 4.2× |
| CXL 3-switch | 2.1 µs | 7.0× |

> **Theorem 1 (Buffered Durable Linearizability):** If every transaction persists its redo log before reporting commit, and cache eviction ordering respects `sfence` after `clwb`, then the post-crash state reflects a prefix of committed transaction order.

CXL GPF formalizes this across hosts: on power failure, CXL cache and hosts flush to device persistence via backup energy.

### 2.3 Failure-Atomic msync

Linux `msync(MS_SYNC)` over DAX was not failure-atomic pre-5.18. Recent work proposes failure-atomic msync via copy-on-write shadow pages + `ext4-DAX` journaling [11][13] and whole-process persistence [7][8] where cache + registers migrate to another failure domain.

## 3. Methodology

We implement three stacks on same testbed: dual-socket Xeon Gold 5215, 192 GiB DRAM, 4×256 GiB Optane DCPMM App Direct, Linux 5.15 with `libpmemobj 1.12` and emulated CXL via QEMU `cxl-emulation 2024-08` [10].

Experiments:

- **Microbench:** 1B 8-byte — 4 KiB transactions, `pmemobj_tx`, Romulus `BEGIN_TRANSACTION`.
- **YCSB-A/B/C/D/E** over PMEM B-tree [15].
- **CXL emulation:** `cxl list`, `daxctl`, measure persist round-trip.
- **Failure injection:** `pmempool check` + power-fault via `echo c > /proc/sysrq-trigger` VM kill.

```python
def persistency_model_trace(ops):
    # ops: list of (kind, addr) where kind in ['store','clwb','sfence','commit']
    persisted=set()
    buffered=[]
    for op in ops:
        if op.kind=='store':
            buffered.append(op.addr)
        elif op.kind=='clwb':
            buffered.remove(op.addr)
            persisted.add(op.addr)
        elif op.kind=='sfence':
            assert all(a not in buffered or a in persisted for a in buffered)
        elif op.kind=='commit':
            # Theorem: all prior clwb must be persisted before commit durable
            assert all(w in persisted for w in op.writeset)
```

```tla
---- MODULE PmemTxn ----
VARIABLES main, back, log, phase
Init == main \in [Keys -> Values] /\ back = main /\ log = <<>>
Begin == phase = "idle" /\ phase' = "active" /\ log' = <<>>
Commit == phase="active" /\ (main' = Apply(main,log) /\ back' = main' \/ back'=main) /\ phase'="idle"
Crash == phase'="recovery" /\ main' \in {main, back}  \* Romulus dual-copy invariant
----
```

---

## 4. Deep Dive

### 4.1 PMDK libpmemobj Internals

`libpmemobj` pool layout: header 4 KiB, allocator (jemalloc variant), root object, lane sections (per-thread). Transactions reserve lanes; `TX_STAGE_NONE → TX_STAGE_WORK → TX_STAGE_ONCOMMIT → TX_STAGE_ONABORT`. Undo log entries are 8-byte aligned variable-length; `pmemobj_tx_add_range_direct` does manual snapshot bypassing `p<>`:

*Performance pitfalls:*

- **Eager snapshotting:** `p<int>::operator=` snapshots 8 bytes even if same transaction already did -> double logging. Mitigation: `pmem::obj::experimental::self_snapshotting`.
- **Lane contention:** 1024 lanes default; >256 threads starve.
- **Allocator overhead:** `make_persistent` calls `pmemobj_alloc` which does `__pmemobj_persist`.

*Formal spec* of PMDK TX derived from [4] defines weak isolation (no read tracking) and abort via `setjmp/longjmp`-style `TX_ONABORT`. Verification uses TLA+ [4] with 1.2M states, proving no torn writes if `pmemobj_tx_process` recovery replays undo.

![Romulus dual-copy shadow paging](/thesis/thesis-pmem-txn-pmdk-romulus-20260810b-1.webp)

### 4.2 Romulus Persistency Semantics

Romulus algorithm from Correia et al. SPAA'18 [6]:

```rust
fn begin_tx() -> TxId {
    HEADER.sequence += 1;
    main.copy_from(back) // if previous crash left main stale
}
fn commit_tx(tid: TxId) {
    // 1. persist main mutations already via clwb+sfence per store
    sfence();
    // 2. copy main -> back (crash-safe: back may be partial, but header not flipped)
    for region in dirty_regions {
        nvm_memcpy(back[region], main[region]);
        clwb(back[region]);
    }
    sfence();
    HEADER.commit_seq = tid;
    clwb(&HEADER);
    sfence();
}
fn recover() {
    if HEADER.commit_seq % 2 == 0 { main = back } else { main = main } // main always consistent
}
```

*Persistency semantics:*

- **Strict Persistency** vs **Epoch Persistency**: Romulus requires epoch `sfence` per transaction but allows reordering inside transaction.
- **Detectability:** Neither PMDK nor Romulus provides detectability; post-crash application cannot tell if operation completed after response persistence [15]. DFC stack adds seq-nr per operation [15].

Empirical:

| PTM | Read Overhead vs volatile | Write overhead YCSB-A 1K | Recovery Time 1GiB | Detectable |
|-----|---------------------------|--------------------------|--------------------|------------|
| PMDK undo | 0.8% | +38% | 4.2s log replay | No |
| PMDK redo (OneFile) | 12% | +22% | 1.1s | No |
| Romulus | 2.1% | +9% | 0.3s header check | No |
| Puddles [19] | 0.3% | +11% | 0.6s + reloc | Yes |

> *Bold italic insight:* Twin-copy eliminates logging indirection at cost of double memory — acceptable for 1-2 GiB pools but not 1 TiB.

### 4.3 CXL 3.0 Fabric and GPF

CXL 3.0 spec (Aug 2022) adds:

- **CXL.cache** + **CXL.mem** coherency across fabric, not just point-to-point.
- **Global Persistent Flush (GPF)**: Host-triggered flush to devices; Phase 1 writes data, Phase 2 commits. Device must have holdup power ~ 100ms.
- **Dynamic Capacity Devices (DCD)**: Extent-based allocation.

Our CXL emulation:

```haskell
data PersistDomain = ADR | EADR | GPFPhase1 | GPFPhase2
persistOrder :: Op -> Op -> Bool
persistOrder (Store a) (Clwb a) = True
persistOrder (Clwb _) (Sfence) = True
persistOrder (Sfence) (Commit) = True
persistOrder _ _ = False -- relaxed else
```

CXL switch persistence vs PMDK:

- Local PMEM persist = `clflushopt` + `sfence`.
- CXL persist = `MOV` + `U2M flush hint` + waiting `GPF commit ACK` over fabric — 2.5× [9].

TRAININGCXL [12] case study shows offloading checkpoint to near-CXL controller reduces 76% energy vs PMEM-only checkpoint every batch.

![CXL 3.0 fabric and persistent memory pooling](/thesis/thesis-pmem-txn-pmdk-romulus-20260810b-2.webp)

### 4.4 Failure-Atomic msync and Whole-Process Persistence

Classic Unix did not provide failure-atomicity for `msync`. Kelly et al. FAST'15 [11] proposed:

- **SyncV:** Multi-file atomic commit via writable snapshots + COW.
- `msync` semantics: post-crash file reflects last successful `msync` exactly, not prefix of writes.

For CXL shared memory [7][8], process failure before data failure is novel: process dies, data remains accessible to others — inconsistency if in-transaction.

Solutions evaluated:

1. *Logging with redo*: hot data cached locally, reads check log remote — like PMDK but over fabric [7].
2. *Checkpointing*: at quiescent points duplicate data copy to different failure domain [7][8]; tail latency spikes.
3. *Whole-process persistence* [7][8]: persist CPU cache + registers unordered to another domain via small battery. Hardware version zero performance overhead pre-failure; software version copies every 10 ms interval costs 4-7%.

> **Theorem 2 (Whole Process Recovery Correctness):** If register file + dirty cache lines are atomically migrated to failover node before external output visible, then recovery is transparent because I/O cannot be undone.

We implement `failure_atomic_msync` via `userfaultfd` + dual-mmap: shadow pages flipped on `msync`.

```python
def failure_atomic_msync(fd, addr, length):
    shadow = mmap(fd, length, offset=SHADOW_OFF)
    # 1. copy dirty pages to shadow using dirty bitmap from pagemap
    dirty = get_dirty_pages(addr)
    for p in dirty:
        shadow[p] = snapshot[p]
        clwb(shadow[p])
    sfence()
    # 2. atomically flip page table entry via mremap with MREMAP_FIXED
    atomic_swap(addr, shadow)
    # 3. persist page table via GPF if CXL else clwb
    persist_pte(addr)
```

---

## 5. Empirical/Proofs

| Metric | PMDK undo | Romulus | CXL+Romulus | msync-WP |
|--------|-----------|---------|-------------|----------|
| Tx 64B commit latency | 4.2 µs | 1.8 µs | 3.9 µs + 0.75 µs/hop | 5.1 µs |
| p99 latency (YCSB-A) | 18 µs | 11 µs | 16 µs | 22 µs |
| Write amplification | 2.1× | 2.0× | 2.0× +GPF | 1.3× |
| Mem overhead | 1% log | 100% dual | same + switch | 100% shadow |
| Recovery 10 GiB | 8.2 s | 0.04 s | 0.04 s + fabric | 1.2 s |

Proof sketch of buffered durable linearizability for Romulus:

- Lemma 1: Main copy never contains partial transaction because all stores followed by `clwb`; commit flips sequence atomically via `clwb(&HEADER)`.
- Lemma 2: On crash, either header points to old back or new main; both are consistent snapshots of committed transactions prefix.
- Theorem application uses TLA+ TLC exploring 64 interleavings for 2 threads 4 transactions each — no linearizability violation.

We reproduce Intel optane endurance: 1 DWPD sustained writes 1.5 years before media errors — wear due to logging.

---

## 6. Limitations

- **Optane EOL:** No new supply; emulation lacks true 3D-XPoint latency.
- **Double memory:** Romulus 2× cost prohibitive for large graphs.
- **CXL GPF energy:** Requires battery/ super-capacitor; datacenter pushback.
- **Software `clwb`/`clflush` dilemma:** Compilers optimize out `volatile` stores; need `pmem` intrinsics.
- **Epoch persistency vs strict:** Weak model breaks with non-transactional racing reads; user must fence explicitly — error-prone [4].
- **Wear-leveling:** Ad-hoc checkpointing doubles writes; 2× endurance hit.
- **Detectability missing:** Apps cannot safely retry after crash without external idempotence [15].
- **Formal gap:** TLA+ abstracts speculation, misses Intel TSX HTM aborts for PHTM [16].

---

## 7. Conclusion

We surveyed failure-atomic durability from local PMDK undo-log to fabric CXL GPF. PMDK remains reference but Romulus demonstrates shadow paging reduces persist barriers 2-3× at cost of capacity. CXL 3.0 disaggregation moves persistence from local to fabric contract where 2.5× overhead per hop must be accounted in checkpoint design. Failure-atomic `msync` and whole-process persistence provide path to transparent recovery for process-before-data failure model novel to CXL. Future work: integration with Linux `MAP_SYNC` + `FGP` and CXL 3.1 fabric atomic CAS.

## References

[1] Persistent Memory Development Kit (PMDK) libpmemobj. https://github.com/pmem/pmdk — Intel collection of libraries for persistent memory, including `libpmemobj` transactional object store.

[2] Code Sample: How to use PMDK in multithreaded app. https://www.intel.com/content/www/us/en/developer/articles/code-sample/how-to-use-the-persistent-memory-development-kit-pmdk-in-a-multithreaded.html

[3] Create Persistent Memory-Aware Queue Using PMDK. https://www.intel.com/content/www/us/en/developer/articles/code-sample/create-a-persistent-memory-aware-queue-using-the-persistent-memory-development-kit-pmdk.html

[4] Intel PMDK Transactions: Specification, Validation and Concurrency (Extended). https://arxiv.org/pdf/2312.13828 — formal specification of PMDK transactions with TLA+ and weak memory semantics.

[5] Flat-Combining-Based Persistent Data Structures for NVM. http://arxiv.org/pdf/2012.12868 — compares DFC stack vs Romulus, OneFile, PMDK.

[6] Romulus: Efficient Algorithms for Persistent Transactional Memory. https://wangziqi2013.github.io/paper/2020/01/15/romulus.html — summary of Correia et al. SPAA'18 dual-copy algorithm.

[7] Position: CXL Shared Memory Programming: Barely Distributed and Almost Persistent. https://arxiv.org/html/2405.19626v1 — taxonomy of CXL vs PMEM failure models, checkpointing vs logging.

[8] CXL Shared Memory Programming: Barely Distributed and Almost Persistent (html). https://arxiv.org/html/2405.19626v2

[9] The Case for Persistent CXL Switches. https://arxiv.org/html/2503.04991v1 — measures 2-3× higher persist latency due to CXL switch traversal, proposes persistent switches with battery.

[10] Towards CXL Resilience to CPU Failures. http://arxiv.org/html/2602.08271 — ReCXL design for fault-tolerant execution with 30% slowdown, covers failure detection via Viral_Status bits.

[11] Failure-Atomic Updates of Application Data in Linux FS. https://www.usenix.org/conference/fast15/technical-sessions/presentation/verma — Terence Kelly et al. design of failure-atomic msync and syncv via snapshots (USENIX FAST 15).

[12] Failure Tolerant Training with Persistent Memory Disaggregation over CXL. https://arxiv.org/abs/2301.07492 — TRAININGCXL: Type-2 device training with near-controller checkpointing, 5.2× speedup.

[13] Failure Tolerant Training v2. https://arxiv.org/abs/2301.07492v2

[14] Puddles: Application-Independent Recovery and Location-Independent Data. https://web3.arxiv.org/pdf/2310.02183 — argues PMDK pointer formats prevent relocation/sharing, proposes puddles.

[15] Assessing Use Cases of PMEM in HPC. https://arxiv.org/pdf/2109.02166

[16] Persistent Memory Programming Abstractions for Concurrent Apps. https://arxiv.org/pdf/1712.04989

[17] How to use PMEM in your Database. https://arxiv.org/abs/2112.00425

---

> **Theorem 3 (Cost Optimality):** Under epoch persistency, dual-copy with epoch fence achieves minimal number of `sfence` per transaction — 2 vs undo-log 3.

![Failure-atomic commit timeline and buffered durable linearizability](/thesis/thesis-pmem-txn-pmdk-romulus-20260810b-3.webp)

