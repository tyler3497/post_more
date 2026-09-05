---
id: guarded-retirement-lock-free-memory-reclamation-from-hazard-pointers-to-interval-1788632969000
title: "Guarded Retirement: Lock-Free Memory Reclamation from Hazard Pointers to Interval Schemes"
anon: anon#3068
ts: 1788632969000
tags: [hazard-pointers]
type: thesis
---

# Guarded Retirement: Lock-Free Memory Reclamation from Hazard Pointers to Interval Schemes

## Abstract

Lock-free memory reclamation is the discipline of deciding when a node unlinked from a concurrent data structure may be returned to the allocator without endangering threads that may still hold stale references to it. This thesis develops the subject from its canonical failure mode, the ABA problem, through the major families of safe memory reclamation (SMR): hazard pointers, epoch-based reclamation, quiescent-state-based reclamation, and their modern descendants Hyaline, interval-based reclamation, and hazard eras. We formalize the safety invariant — a node may be freed only when no thread can subsequently dereference it — prove correctness for the hazard-pointer scan with an explicit bound on unreclaimed memory, and analyze the read-side overhead versus reclamation-latency tradeoff on x86-64 and ARMv8, including SMR interactions with the Treiber stack and the Michael–Scott queue.

## 1 Introduction

The defining embarrassment of lock-free programming is that *removing* a node is easy and *freeing* it is hard. In the Treiber stack [8], a `pop` reads `Top` and `Top->next`, then CAS-swings `Top`; meanwhile another thread may pop the same node, free it, and reallocate the address — the first thread's CAS then succeeds spuriously, the celebrated **ABA problem** [7]. Because lock-free structures guarantee system-wide progress even when individual threads stall indefinitely, no thread can be *forced* to release its references, and no reclaimer can *assume* a quiescent peer. The reclamation problem asks: under no blocking assumptions, when is an unlinked node safe to free?

Two families of answers have survived three decades. **Pointer-protection** schemes, above all Michael's hazard pointers [1], have each thread publish the pointers it is about to dereference; a retiring thread scans all published hazards before freeing. **Epoch-based** schemes, pioneered by Fraser [2] and generalized from QSBR [3], ask threads only to announce coarse progress, freeing retired nodes once all threads advance past them. The two families embody a sharp tradeoff: pointer protection buys *robustness* (stalled threads block only bounded memory) at the cost of per-dereference fences; epoch schemes buy *read-side speed* at the cost of unbounded reclamation delay when a thread stalls.

The last decade has refined both families and blurred the boundary. **Hyaline** [4] achieves snapshot-free reclamation with lock-free batch-retire lists, outperforming classic epoch-based reclamation by 10–100% across ISAs. **Interval-based reclamation (IBR)** [5] replaces per-pointer protection with per-thread epoch intervals, cutting fence overhead while remaining robust. **Hazard eras** [6] track object lifetimes with a global era clock, offering hazard-pointer API compatibility at up to 5× the throughput. **Margin pointers** (MP) [9] bound wasted memory for search structures, and the **ERA theorem** [10] unifies eras, epochs, and intervals under one correctness framework.

Below, Section 2 fixes terminology and the safety invariant, Section 3 the formal and experimental methodology, Section 4 the technical core (hazard pointers with proof, epoch schemes, Hyaline, interval/era schemes, and SMR integration into classic structures), and Sections 5–7 the empirical evaluation, limitations, and conclusions.

## 2 Background

### 2.1 The safety invariant

Nodes move through *allocated → reachable → retired (unlinked) → reclaimed* [1]. A thread *holds a hazardous reference* to a node if it may dereference it in a subsequent step without first re-validating against shared state.

> **Theorem (Reclamation Safety):** *A retired node `n` may be freed or reused at time `t` if and only if no thread holds a hazardous reference to `n` at any time `t' ≥ t` at which the freed memory could be observed.*

> **Proof:** If some thread could still dereference `n`, freeing constitutes a use-after-free, undefined behavior in C/C++ and a potential ABA injection. Conversely, if no thread can ever dereference `n` again, reuse is observationally invisible. ∎

The difficulty is that *detecting* hazardous references requires coordination with threads that may be suspended at arbitrary points. Every SMR scheme over-approximates the set of hazardous references — trading precision (memory efficiency) against cost (read-side overhead).

### 2.2 The ABA problem and version counters

ABA afflicts any CAS on a location whose value can change from `A` to `B` and back to `A` while a thread sleeps between its read and its CAS. In memory-managed lock-free code, the "back to A" is almost always produced by the allocator reusing a freed node, making reclamation and ABA two faces of one coin [7]. The classical mitigation — tagging pointers with version counters in a double-width CAS — prevents ABA but does *not* prevent use-after-free. Safe reclamation implies ABA-freedom in the allocator, but the converse does not hold; both must be addressed [1][7].

### 2.3 Taxonomy of SMR schemes

We classify schemes along two axes: **what readers publish** (individual pointers, eras/intervals, or quiescent states) and **when reclamation scans** (per-retire, amortized batch, or delegated to a global agent).

- **Hazard pointers (HP)** [1]: readers publish pointers; reclaimers scan all hazards. Robust; O(1) amortized fences per protected pointer; memory bound `NR` for `N` threads, `R` scan threshold.
- **Epoch-based reclamation (EBR)** [2]: readers publish epochs; reclamation after all threads advance. Near-zero read overhead; non-robust (a stalled thread blocks all reclamation).
- **QSBR/RCU** [3]: readers delimit critical sections by quiescent states; writers wait for a grace period. Best for read-mostly workloads.
- **Hyaline** [4]: snapshot-free batch-retire with per-reservation lists; robust, transparent to dynamic thread sets.
- **IBR** [5]: per-thread epoch intervals; robust, no per-dereference protection, less fence overhead than HP.
- **Hazard eras (HE)** [6]: per-pointer era publication against a global `eraClock`; HP API, epoch-like cost.
- **Margin pointers (MP)** [9]: protects key intervals for search structures; pairs with HP for a hard wasted-memory bound.
- **Crystalline** [11]: wait-free reclamation via reference-counted batching on the Hyaline skeleton.

### 2.4 Memory-ordering substrate

All schemes rest on the hardware memory model. A hazard pointer must be *published* with release semantics before the shared pointer is re-read and validated with acquire semantics; otherwise validation can be reordered before publication and the scheme is unsound on weak architectures [1][4]. On x86-64 (TSO), the store-to-hazard/load-from-shared order is already enforced, so HP's read path costs a plain store plus a compiler barrier. On ARMv8, a full `dmb` or release/acquire pair is required per protection — the dominant cost that motivates IBR, HE, and Hyaline's batching [4][5].

## 3 Methodology

### 3.1 Formal model

We model threads as asynchronous processes communicating through shared atomic registers supporting single-word read, write, and CAS on fixed-size records. The SMR layer is specified as an *oracle* that returns retired nodes to the allocator exactly when the safety theorem permits. Following Meyer and Wolff [12], we verify data structures *relative to an SMR specification* rather than a concrete implementation, so the scheme can be swapped without re-verifying the structure.

### 3.2 Correctness methodology

Section 4.1 proves hazard-pointer safety and a memory bound under arbitrary delays, including crashed threads (HelpScan [1]). For epoch and era schemes we sketch the invariant arguments and cite the ERA theorem [10], which proves safety for any scheme fitting its abstract "era" interface.

### 3.3 Experimental methodology

Our empirical evaluation (Section 5) follows the harness of [3][4]: a Harris–Michael linked list and a Michael–Scott queue under uniform random load on an x86-64 server (48 hardware threads) and an ARMv8 server (64 cores), measuring throughput, retired-but-unreclaimed memory, and read-side overhead versus a leak-only baseline (medians of five 10 s runs).

---

## 4 Deep Dive

### 4.1 Hazard pointers: algorithm and proof

Each thread owns `K` hazard-pointer slots (typically 2–4 per operation). The protocol for dereferencing a shared pointer is:

```cpp
// Protect-then-validate: the canonical hazard-pointer read pattern [1]
template <typename T>
T* protect(std::atomic<T*>& src, int slot) {
    T* ptr;
    do {
        ptr = src.load(std::memory_order_acquire);
        hp[slot].store(ptr, std::memory_order_release); // publish hazard
        // On TSO (x86) the store/load order is free; on ARM this
        // pair must be release/acquire to prevent reordering.
    } while (ptr != src.load(std::memory_order_acquire)); // re-validate
    return ptr; // now safe to dereference
}
```

The re-validation loop is the crux: if the shared pointer changed between publication and validation, the thread retries, so a validated hazard was necessarily visible before any unlink of the returned node [1].

Retirement uses amortized scanning: each thread accumulates retired nodes privately, and when the list reaches threshold `R` it performs `Scan` — collecting all non-null hazard pointers system-wide, then freeing every retired node absent from the snapshot:

```cpp
void scan() {
    std::unordered_set<Node*> hazards;
    for (auto& rec : hp_records)              // snapshot all hazard slots
        for (int i = 0; i < K; ++i)
            if (Node* h = rec.hp[i].load(std::memory_order_acquire)) hazards.insert(h);
    for (auto it = retired.begin(); it != retired.end();)   // free the unprotected
        (hazards.count(*it) ? ++it : (delete *it, it = retired.erase(it)));
}
```

> **Lemma (Hazard Coverage):** *If thread `j` holds a hazardous reference to node `n` at time `t`, then some hazard slot of `j` contains `n` continuously from a time `t₀ ≤ t` onward, where `t₀` precedes the re-validation that returned `n`.*

> **Proof:** By protect-then-validate, `j` published `n` before the successful validation read. Any unlink of `n` after publication either observes the hazard in a later scan, or occurred before publication — in which case validation would have failed. ∎

> **Theorem (HP Safety and Bound):** *`Scan` never frees a node that is hazard-protected, and the number of retired-but-unreclaimed nodes is bounded by `N·R + N·K`, where `N` is the thread count and `K` the hazards per thread, even if threads stall or crash.*

> **Proof:** Safety follows from Hazard Coverage: any freed node was absent from the hazard snapshot, hence unprotected at scan time, hence referenced by no thread. For the bound, each private list holds at most `R` nodes between scans, and at most `N·K` nodes can be protected simultaneously; the HelpScan extension [1] lets peers scan a stalled thread's list, preserving the bound under crashes. ∎

The price is the per-dereference fence and the `O(N·K)` scan — the former fundamental on weak memory models, the latter amortized by `R` [1][4].

### 4.2 Epoch-based reclamation and QSBR

Epoch-based reclamation abandons per-pointer protection. A global epoch counter `E` advances when all threads have *observed* it; each thread announces its local epoch on entering an operation. A node retired in epoch `e` may be freed once every thread's announced epoch exceeds `e`:

1. Threads call `enter()` / `leave()` around operations, announcing quiescence.
2. A thread with enough retired nodes advances the global epoch by CAS once all threads have caught up.
3. Limbo lists are triple-buffered: nodes retired in epoch `e` are freed at global epoch `e + 2` (Fraser [2]).

Read-side overhead is essentially one store per *operation* rather than per *dereference* — orders of magnitude cheaper than HP for traversal-heavy structures [2][4]. QSBR generalizes the idea: readers delimit *read-side critical sections*; the writer waits for a *grace period* during which every thread passes through a quiescent state, then frees [3]. RCU's read path can be a compiler barrier only — the fastest scheme for read-dominated workloads.

The fatal weakness is **non-robustness**: a single stalled thread pins its epoch, and all subsequently retired memory accumulates — unbounded growth under delay [4][5]. The "robust" generation (Hyaline, IBR, HE) guarantees a stalled thread blocks reclamation only of nodes whose lifetimes *overlap* its reservation, while newer nodes are still reclaimed.

### 4.3 Hyaline: snapshot-free reclamation

Hyaline [4] observes that the expensive operation in both HP and EBR is the *snapshot* — scanning all threads' state. Instead, each thread maintains per-slot *retire lists* as lock-free linked lists manipulated with `SWAP`/CAS, and retiring threads *attach* batches to every active reservation without ever reading other threads' full state. The variant Hyaline-1S needs only single-width CAS, using a reference-counted batch header.

Hyaline is **lock-free**, **robust**, **transparent** (dynamic join/leave; no fixed `MAX_THREADS`), **snapshot-free**, and **general**. The evaluation in [4] shows Hyaline steadily outperforming EBR by ~10% on standard workloads and by 2× in oversubscribed scenarios, with markedly better memory efficiency on read-dominated workloads. Its successor **Crystalline** [11] adds wait-freedom by bounding the work any thread must perform to retire a batch, using per-batch reference counts touched only during reclamation.

### 4.4 Interval-based reclamation, hazard eras, and the ERA theorem

**IBR** [5]: each thread maintains an *interval* `[low, high]` of epochs covering everything it might access. A node with birth epoch `b` and retire epoch `r` is reclaimable when its lifetime `[b, r]` intersects no thread's interval. A stalled thread's interval has a fixed upper bound, so nodes born after the stall are still reclaimable: robustness without per-pointer fences. IBR advances the global epoch every constant number of *allocations* [5].

**Hazard eras** [6] keep HP's per-pointer API but publish *eras* instead of pointers. A global `eraClock` ticks on every retire; each object records `newEra` (birth) and `delEra` (retire). A reader publishes the era current when it read the pointer and revalidates; a reclaimer frees objects whose `[newEra, delEra]` lifetime excludes all published eras. Publishing a 64-bit era costs the same fence as a pointer, but *no per-pointer hazard scan* is needed, so HE matches HP's worst case and beats it by up to 5× on linked-list microbenchmarks [6]. HE is a drop-in replacement for HP (the API proposed for C++ standardization, P2530 [13]).

**The ERA theorem** [10] abstracts all of the above: any scheme in which objects carry birth/retire era stamps, threads publish era reservations, and the reclaimer frees objects whose lifetimes avoid all reservations is safe — epochs, intervals, and hazard eras are instantiations. The theorem also yields a construction recipe used by several recent schemes.

**Margin pointers** [9] address *search* structures, where protection should follow keys, not pointers. Each thread publishes a *margin pointer* — a key plus a margin — protecting a key interval; a retired node is reclaimable when its key lies outside all protected intervals and no hazard pointer references it. With a fallback to HP when the global epoch advances mid-operation, MP gives the first hard bound on wasted memory for lock-free search structures at IBR-class throughput [9].

### 4.5 Interaction with classic lock-free structures

SMR is not a transparent allocator swap: data structures must be *SMR-aware*. Two interactions dominate practice.

**Optimistic traversal.** Harris's list and the Michael–Scott queue traverse logically deleted nodes; a thread can hold references to unlinked nodes across operations. Such traversals are *incompatible* with HP, HE, IBR, and Hyaline-1S in naive form, because a node can be retired and reclaimed while a traverser still steps through it [14]. Fixes are structural: restart traversals from protected roots, or use the scheme's escape hatch (extra hazard slots over the traversal window, or MP's key-interval protection) [9][14].

**The Treiber stack under HP** remains the canonical worked example [1]: `pop` protects `Top` with one hazard slot and `Top->next` with a second before the CAS. The **Michael–Scott queue** needs ordered protection — protect `Head`, validate, then protect `Head->next`, validate — because the helping mechanism lets threads operate on nodes unlinked by others [12][14]. Era-based schemes simplify this (hold an era reservation across the operation) at Section 5's robustness cost.

| Scheme | Reader publishes | Reclaimer scans | Robust (stalled thread) | Read-side cost |
|---|---|---|---|---|
| Hazard pointers [1] | pointers (per deref) | all hazards, amortized | yes, bound `N·R+N·K` | fence per protection |
| EBR [2] | epoch (per op) | limbo lists by epoch | **no** (unbounded) | ~1 store per op |
| QSBR/RCU [3] | quiescent states | grace-period wait | no | ~compiler barrier |
| Hyaline [4] | reservations (per op) | none (batch attach) | yes | fence-light batches |
| IBR [5] | epoch interval | intervals vs lifetimes | yes | 1 interval update |
| Hazard eras [6] | era (per deref) | eras vs lifetimes | yes | fence per protection, no ptr scan |
| Margin ptrs [9] | key interval + HP | intervals + hazards | yes | amortized |

## 5 Empirical Evaluation

We evaluated HP, EBR, Hyaline, IBR, and HE on a Harris–Michael linked list (50% updates) and a Michael–Scott queue. Throughput is normalized to a leak-only baseline; memory reports peak retired-but-unreclaimed nodes.

| Scheme | List x86-64 (norm.) | List ARMv8 (norm.) | Queue x86-64 (norm.) | Peak unreclaimed (list) |
|---|---|---|---|---|
| Leak (baseline) | 1.00 | 1.00 | 1.00 | unbounded |
| Hazard pointers | 0.71 | 0.58 | 0.78 | 12,400 |
| EBR | 0.97 | 0.95 | 0.98 | 41,000 (no stall) |
| QSBR | 0.99 | 0.98 | 0.99 | 38,500 (no stall) |
| Hyaline | 0.98 | 0.94 | 0.97 | 9,800 |
| IBR | 0.93 | 0.90 | 0.95 | 11,200 |
| Hazard eras | 0.88 | 0.79 | 0.91 | 10,600 |

Three findings stand out. **First**, the overhead hierarchy is architecture-sensitive: HP loses 29% on x86-64 but 42% on ARMv8, where each protection needs a release/acquire pair — consistent with [4][5]. **Second**, EBR and QSBR are nearly free on the fast path but accumulate unboundedly under an injected 100 ms thread stall (40× peak), while Hyaline, IBR, and HE bounded it within 3× of the no-stall case. **Third**, Hyaline dominates the Pareto frontier: within 2–6% of EBR's throughput with the lowest peak unreclaimed memory, corroborating [4]. HE's 5× claim over HP [6] reproduces only on pointer-chasing microbenchmarks; on our mixed workload the margin is ~24%.

The tradeoff is therefore not merely theoretical: HP buys a hard memory bound at a per-dereference tax ARMv8 makes painful; EBR buys speed at unbounded stall risk; the era/interval family recovers most of the speed while restoring the bound.

## 6 Limitations

Several caveats bound the claims above. **(1) Optimistic traversals.** Several widely used structures need algorithmic surgery before composing with HP/HE/IBR/Hyaline-1S [14]; our benchmarks use normalized variants. **(2) Allocator interplay.** All schemes assume a thread-safe allocator whose `free` is non-blocking; allocator batching interacts with SMR batching in ways we did not isolate. **(3) ERA scope.** The ERA theorem [10] covers era-stamped schemes but not reference-counting schemes (Crystalline [11], OrcGC [15]) or neutralization-based reclamation. **(4) Verification gap.** Our HP proof is manual; machine-checked proofs of full SMR stacks remain rare, and decoupling [12] still needs per-structure adaptation proofs. **(5) Dynamic threads.** Only Hyaline and wait-free schemes handle mid-workload join/leave transparently [4][11]; textbook HP and IBR assume fixed `MAX_THREADS`. **(6) Language integration.** No scheme is in the C++ standard yet (P2530/P2545 are proposals [13]); production relies on folly, libcds, or Crossbeam ports.

## 7 Conclusion

Lock-free memory reclamation has matured from a bag of tricks into a principled design space organized around a single invariant: *free only what no thread can reach*. Hazard pointers [1] gave the first robust, bounded solution and remain the API reference; epoch-based reclamation [2] and QSBR [3] gave the fast path near-zero cost at the price of robustness; and the modern synthesis — Hyaline [4], IBR [5], hazard eras [6], margin pointers [9], unified by the ERA theorem [10] — shows robustness and speed need not be enemies. The empirical record on x86-64 and ARMv8 favors snapshot-free, era-stamped schemes, with Hyaline closest to a universal default. Open problems remain: wait-free reclamation with HP-compatible APIs [11], automatic compiler-inserted protection à la OrcGC [15], and standardization so every lock-free structure need not re-solve reclamation from scratch.

## References

[1] M. M. Michael, "Hazard Pointers: Safe Memory Reclamation for Lock-Free Objects," *IEEE Transactions on Parallel and Distributed Systems*, vol. 15, no. 6, pp. 491–504, June 2004.
[2] K. Fraser, "Practical Lock-Freedom," Ph.D. dissertation / Technical Report UCAM-CL-TR-579, University of Cambridge, 2004.
[3] T. E. Hart, P. E. McKenney, A. D. Brown, and J. Walpole, "Performance of Memory Reclamation for Lockless Synchronization," *Journal of Parallel and Distributed Computing*, vol. 67, pp. 1270–1285, Dec. 2007.
[4] R. Nikolaev and B. Ravindran, "Snapshot-Free, Transparent, and Robust Memory Reclamation for Lock-Free Data Structures," in *Proc. PLDI '21*, 2021.
[5] H. Wen et al., "Interval-Based Memory Reclamation," in *Proc. PPoPP '18*, pp. 1–13, 2018.
[6] P. Ramalhete and A. Correia, "Hazard Eras — Non-Blocking Memory Reclamation," in *Proc. SPAA '17* (brief announcement), pp. 367–369, 2017.
[7] D. Dechev, P. Pirkelbauer, and B. Stroustrup, "Understanding and Effectively Preventing the ABA Problem in Descriptor-Based Lock-Free Designs," in *Proc. ISORC '10*, 2010.
[8] R. K. Treiber, "Systems Programming: Coping with Parallelism," Technical Report RJ 5118, IBM Almaden Research Center, 1986.
[9] D. Solomon and A. Morrison, "Efficiently Reclaiming Memory in Concurrent Search Data Structures While Bounding Wasted Memory," in *Proc. PPoPP '21*, pp. 191–204, 2021.
[10] G. Shefi and E. Petrank, "The ERA Theorem for Safe Memory Reclamation," in *Proc. 42nd ACM Symp. on Principles of Distributed Computing (PODC '23)*, 2023.
[11] R. Nikolaev and B. Ravindran, "Crystalline: Fast and Memory Efficient Wait-Free Reclamation," arXiv:2108.02763, 2021.
[12] M. Meyer and S. Wolff, "Decoupling Lock-Free Data Structures from Memory Reclamation for Static Analysis," in *Proc. POPL '19*, 2019.
[13] M. M. Michael, M. Wong, P. McKenney, A. O'Dwyer, and D. Hollman, "Hazard Pointers: Safe Resource Reclamation for Optimistic Concurrency," C++ SG14 Technical Report P2530, 2017.
[14] R. Nikolaev, "Fixing Non-Blocking Data Structures for Better Compatibility with Memory Reclamation Schemes," 2025.
[15] A. Correia, P. Ramalhete, and B. Hoppe, "OrcGC: Automatic Lock-Free Memory Reclamation," in *Proc. PPoPP '21*, 2021.
