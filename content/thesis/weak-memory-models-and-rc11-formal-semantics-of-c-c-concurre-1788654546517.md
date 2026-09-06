---
title: "Weak Memory Models and RC11: Formal Semantics of C/C++ Concurrency, the Promising Semantics, Out-of-Thin-Air Prohibition, and Verified Compilation to ARMv8 and TSO"
id: ths_1788654546517_2083
anon: anon#D4K9
ts: 1788654546517
type: thesis
images: ["ths_1788654546517_2083-0.webp", "ths_1788654546517_2083-1.webp", "ths_1788654546517_2083-2.webp", "ths_1788654546517_2083-3.webp"]
---

# Weak Memory Models and RC11: Formal Semantics of C/C++ Concurrency, the Promising Semantics, Out-of-Thin-Air Prohibition, and Verified Compilation to ARMv8 and TSO

## 1. Introduction

Sequential consistency (SC) is the gold standard of shared-memory semantics: every execution appears as some interleaving of the threads' program orders [8]. Unfortunately, it is also a fiction. Modern processors reorder memory operations aggressively — store buffers delay writes past later reads, speculative loads execute before earlier branches resolve — and optimizing compilers reorder, eliminate, and invent memory accesses far beyond anything SC tolerates. A programming-language memory model must therefore mediate three irreconcilable demands: programmers need comprehensible guarantees, compilers need optimization freedom, and hardware vendors need to expose microarchitectural performance [3, 5].

This thesis presents a unified account of how the C/C++11 model attempted that mediation, why its treatment of sequentially consistent atomics was *provably broken*, how the *RC11* repair of Lahav, Vafeiadis, Kang, Hur, and Dreyer [1] restored soundness, how the *promising semantics* of Kang et al. [2] gave a tractable operational foundation with a principled account of out-of-thin-air (OOTA) reads, and how verified compilation schemes target real hardware models — the multicopy-atomic ARMv8 model [4] and x86-TSO [9]. We close with the model-checking infrastructure (CDSChecker, RCMC, GenMC [6, 7]) that makes these models empirically testable. Throughout, we work in the *axiomatic* (declarative) style: programs denote sets of *candidate executions* — graphs of memory events linked by relations such as program order, reads-from, and coherence order — and the model is a predicate, a conjunction of *axioms*, admitting or rejecting each candidate [3].

## 2. Background

### 2.1 Sequential consistency and its hardware violations

Lamport defined SC as the requirement that the result of any execution be the same as if the operations of all processors were executed in some sequential order, with the operations of each processor appearing in program order [8]. Two canonical *litmus tests* falsify SC on real hardware:

- **SB (store buffering):** `x := 1; a := y` ‖ `y := 1; b := x`. The outcome `a = 0 ∧ b = 0` is forbidden under SC but routinely observed on x86 and ARM, explained by per-core store buffers.
- **MP (message passing):** `x := 1; y := 1` ‖ `a := y; b := x`. The outcome `a = 1 ∧ b = 0` is forbidden under SC and under TSO, but permitted on pre-ARMv8 ARM/POWER via non-multicopy-atomic propagation; ARMv8's revision to *multicopy atomicity* forbids it architecturally [4].

### 2.2 Hardware models: TSO and ARMv8

The x86-TSO model of Owens, Sarkar, and Sewell [9] models each core with a FIFO store buffer: writes retire into the buffer in program order and drain to shared memory asynchronously, while reads bypass the buffer only for the reading thread's own pending writes (store-to-load forwarding). TSO forbids load–load, load–store, and store–store reorderings but permits store–load reordering (hence SB), and it is *multicopy-atomic*: once a write reaches shared memory it is visible to all threads simultaneously.

ARMv8 is substantially weaker: loads and stores may be reordered subject to address, data, and control dependencies, and the barrier instructions `DMB`, `DSB`, and `ISB`, together with acquire loads (`LDAR`) and release stores (`STLR`), restore ordering on demand. Critically, ARM revised the architecture to a *multicopy-atomic* model [4]: Pulte, Flur, Deacon, French, Sarkar, and Sewell formalized both an operational and an axiomatic model for ARMv8 and proved them equivalent, eliminating the notorious IRIW (independent reads of independent writes) behaviors that plagued ARMv7/POWER.

### 2.3 The C++11 model and its formalization

The C++11 standard [11] introduced a layered model distinguishing *non-atomic* accesses (data races on which are undefined behavior, enabling aggressive sequential optimization), and *atomic* accesses parameterized by a *memory order*: `relaxed`, `release`/`acquire`, `acq_rel`, `consume`, and `seq_cst`. Batty, Owens, Sarkar, Sewell, and Weber gave the first rigorous mathematical formalization [3], mechanized in Isabelle/HOL with the Cppmem exploration tool, and proved a compilation scheme to x86-TSO correct. The model's core relations are:

| Relation | Meaning |
|---|---|
| `po` | program order within a thread |
| `rf` | reads-from: which write each read observes |
| `mo` (`co`) | modification/coherence order: total order of writes per location |
| `fr` | from-reads: read → write sequenced after the write it read |
| `sw` | synchronizes-with: release write → acquire read via `rf` |
| `hb` | happens-before: `(po ∪ sw)⁺` |
| `eco` | extended coherence: `(rf ∪ co ∪ fr)⁺` |

The C++11 *coherence* axioms demand, roughly, that `hb` and `eco` interact consistently; the *SC* axiom demands a total order `S` over all `seq_cst` operations consistent with `hb` and `mo`. It was in this SC axiom — and in the compilation schemes the community believed correct — that the deepest flaws hid.

---

## 3. Methodology

Our methodology is the *axiomatic method* pioneered by Alglave and colleagues and refined by Batty et al. [3]: rather than defining executions operationally (interleavings of a machine), we define a *candidate execution* as a tuple ⟨E, po, rf, mo⟩ and specify the model as a conjunction of first-order axioms over derived relations. This style has decisive advantages for weak memory: it makes models comparable (TSO, ARMv8, RC11, promising semantics can all be rendered axiomatically), it supports *equivalence proofs* between operational and declarative presentations [4], and it is directly executable by model checkers that enumerate candidate executions and test axiom satisfaction [6, 7].

We complement the axiomatic view with operational semantics where certification or promise machinery is involved [2], and we verify *compilation correctness* as *behavior inclusion*: every behavior of the compiled program under the hardware model must be a behavior of the source program under the language model. The standard proof technique is *simulation* between machine states, or — more elegantly for axiomatic targets — a *graph transformation* argument showing that any hardware-consistent execution graph of the compiled program maps to a language-consistent execution graph of the source [1].

> **Theorem:** (Adequacy of the axiomatic method.) For the models studied here — TSO, ARMv8 (multicopy-atomic), RC11, and the promising semantics — the axiomatic and operational presentations coincide on all finite litmus-test behaviors. [1, 2, 4, 9]

## 4. Deep Dive

### 4.1 The C++11 model is broken: two flaws in sequential consistency

Lahav et al. [1] demonstrated, contrary to previously published claims, that the C++11 semantics of `seq_cst` atomics is flawed in *both* directions — too strong and too weak — and that both proposed compilation schemes to POWER are unsound.

**Flaw 1 — SC is too strong (the SC-DRF failure).** The C++11 model forbids certain executions that no reasonable hardware or compiler would ever produce, and worse, it invalidates a basic *correctness* property programmers expect: that replacing a `seq_cst` write/read pair with release/acquire (or even relaxed) operations in a message-passing idiom preserves SC-like behavior. Concretely, the model distinguishes programs that are observationally equivalent under every compilation scheme, breaking the *SC-DRF guarantee* (data-race-free programs behave as SC) in the presence of mixed atomic/non-atomic accesses [1, §2].

**Flaw 2 — SC is too weak (cumulativity failure).** The C++11 SC axiom permitted the infamous *store-buffering with SC fences* behavior and, more damagingly, allowed executions in which `seq_cst` reads observe writes in an order inconsistent with any global SC order — a violation of *SC-per-location* cumulativity that the standard's prose intended to forbid. The authors exhibit a POWER-compiled program (using the "leading-sync" and "trailing-sync" mappings from the literature) whose hardware-observable behavior is *forbidden* by the intended semantics yet *allowed* by C++11, rendering both compilation schemes unsound [1, §4].

```tla
---- MODULE SCFlaw ----
EXTENDS Naturals
(* IRIW-shaped SC violation admitted by C++11's SC axiom *)
VARIABLES r1, r2, r3, r4
IRIW == /\ r1 = 1 /\ r2 = 0    \* thread A observes x then y
        /\ r3 = 1 /\ r4 = 0    \* thread B observes y then x
(* C++11: consistent (bug). RC11: rejected by psc acyclicity. *)
====
```

The root cause is that C++11's SC axiom constrains only `seq_cst` operations *among themselves* via the total order `S`, while coherence between SC and non-SC accesses leaks through the cracks — the `hb`-vs-`S` interplay is under-constrained, and the modification-order conditions on SC reads admit stale reads that no SC order can justify.

### 4.2 RC11: the repaired model

RC11 [1] rebuilds the model around three clean principles, with access *modes* (memory orders) as first-class annotations on every event:

1. **Coherence.** `irreflexive(hb ; eco?)` — no happens-before path may close a cycle through a single extended-coherence step. This single axiom subsumes C++11's scattered coherence conditions (CoRR, CoWR, CoRW, CoWW) and is *strictly weaker* than C++11's in exactly the right places: it permits the POWER-observable `SB` behavior that C++11 wrongly forbade, while still forbidding `MP`-style violations [1, Prop. 1].

2. **SC via partial SC order.** Instead of a total order over all SC events, RC11 defines `psc` (partial SC order) and requires `acyclic(psc)`. Forbidding cycles in `psc` — rather than demanding a total order — fixes both flaws: it restores the cumulativity C++11 lacked (forbidding the bad POWER behaviors) while remaining weak enough to admit the standard trailing-sync/leading-sync compilations [1, Thm. 2].

3. **Atomicity.** RMW operations are modeled as read–write *pairs* with `rmw` edges; `irreflexive(rb ; mo)` (read-before) guarantees atomicity, i.e., no write may intervene between an RMW's read and write in modification order.

4. **No-thin-air.** RC11 simply requires `acyclic(po ∪ rf)` — no execution may contain a causality cycle of program order and reads-from edges. This is a deliberately blunt instrument: it rules out OOTA (see §4.3) at the cost of forbidding some compiler transformations (e.g., certain speculative load introductions), a trade-off the promising semantics later refined [2].

The payoff is a *verified compilation* result: Lahav et al. prove that the standard mappings of C++11 atomics to POWER (both leading-sync and trailing-sync) and to x86-TSO are *sound* with respect to RC11 — every POWER/x86 behavior of the compiled program is an RC11 behavior of the source. The proof proceeds by transforming a hardware-consistent execution graph into an RC11-consistent one, using a key lemma that TSO's declarative characterization (via program transformations) composes with the mapping [1, §6].

```rust
// RC11 coherence, executable sketch: reject hb;eco cycles
fn rc11_consistent(ev: &[Event], po: &Rel, rf: &Rel, mo: &Rel) -> bool {
    let hb = transitive_closure(&po.union(&sync_edges(rf)));
    let fr = from_reads(rf, mo);
    let eco = transitive_closure(&rf.union(mo).union(&fr));
    // irreflexive(hb ; eco?) — at most ONE eco step after an hb path
    for (a, b) in hb.iter() {
        for (c, d) in eco_one_step(&rf, &mo, &fr) {
            if b == c && hb.contains(&(d, a)) { return false; }
        }
    }
    acyclic(&partial_sc_order(ev, &hb, &eco)) // psc axiom
}
```

### 4.3 The promising semantics: operationalizing OOTA-freedom

The axiomatic `acyclic(po ∪ rf)` ban on thin-air reads is unsatisfying: it is *non-constructive* (it quantifies over whole executions) and it over-forbids, outlawing loop-invariant code motion and other standard optimizations. The *promising semantics* [2] gives an *operational* model that prohibits OOTA while validating aggressive optimizations, and it does so with a strikingly simple idea: **threads may promise future writes, but must be able to certify them.**

A machine configuration consists of a memory — a set of *messages* ⟨location, value, timestamp, view⟩ — and per-thread state: a *view* (a map from locations to timestamps recording what the thread has observed) and a *promise set* (messages the thread has committed to write in the future). Transitions include:

1. **PROMISE:** a thread may add a message ⟨x:v@t⟩ to memory and to its promise set, for a *fresh* timestamp `t` — speculating a write before its program-order predecessors execute.
2. **FULFILL:** when the thread actually executes the write, it must match a promise exactly (same value, same timestamp), removing it from the promise set.
3. **READ:** a thread may read any message with timestamp ≥ its view of that location, joining the message's view into its own (for release/acquire synchronization).
4. **CERTIFY:** at any point, a thread must be able to execute *alone*, from a *capped* memory (all other threads' future writes truncated), and fulfill *all* its outstanding promises. Certification guarantees that promised values are *justifiable*: they cannot depend on reads that only other threads' speculation could produce — precisely the OOTA pattern.

> **Theorem:** (Certification prevents thin-air.) In the promising semantics, the classic OOTA litmus `a := y; x := a ‖ b := x; y := b` cannot produce `a = b = 42`. Any promise of `x := 42` would require certifying a write of 42 that reads 42 from `y`, which is absent from the capped memory. [2, §3]

The model handles the full C++11 feature spectrum — relaxed, release/acquire, SC atomics, and fences — and Kang et al. mechanized it in Coq (~30k lines), proving DRF theorems, equivalence with an axiomatic presentation, and soundness of standard compiler optimizations (reordering, elimination, introduction of non-atomic accesses; reordering of relaxed accesses). The follow-up *Promising 2.0* [12] extended certification to validate global optimizations such as loop-invariant code motion.

```haskell
-- Promising semantics, core state (simplified)
data Thread = Thread
  { view     :: Loc -> Time   -- current knowledge frontier
  , promises :: Set Message   -- outstanding speculative writes
  }
data Message = Msg { loc :: Loc, val :: Val, time :: Time, mview :: Loc -> Time }

-- CERTIFY: thread alone, capped memory, must fulfill every promise
certify :: Thread -> Memory -> Bool
certify th mem = all (`fulfillableFrom` cap mem) (promises th)
```

### 4.4 Verified compilation to ARMv8 and TSO

Compilation correctness is the load-bearing wall of any language memory model: the mappings in Table 1 must be *sound* — hardware behaviors of compiled code must be admitted by the source model.

| C++11 access | x86-TSO mapping | ARMv8 mapping |
|---|---|---|
| relaxed load | `mov` | `ldr` |
| relaxed store | `mov` | `str` |
| acquire load | `mov` | `ldar` |
| release store | `mov` | `stlr` |
| `seq_cst` load | `mov` | `ldar` |
| `seq_cst` store | `xchg` (or `mov; mfence`) | `stlr` + `dmb ish` |
| `seq_cst` fence | `mfence` | `dmb ish` |

For **x86-TSO**, Batty et al. [3] proved the mapping correct against the Owens–Sarkar–Sewell TSO model [9], and Lahav et al. [1] re-established it for RC11 using a declarative characterization of TSO via program transformations (write elimination, load-after-store forwarding). For **ARMv8**, the multicopy-atomic revision [4] was the enabling event: with IRIW-style non-multicopy behaviors removed from the architecture, the mapping of release/acquire to `LDAR`/`STLR` and SC fences to `DMB ISH` becomes provable. Pulte et al. [4] prove their operational and axiomatic ARMv8 models equivalent, and subsequent work (Promising-ARM/RISC-V [13]) gives an operational model with a *verified* compilation proof from the promising semantics: every ARMv8 behavior of the compiled program corresponds to a promising-semantics behavior of the source. The proof's crux is showing that ARMv8's preserved-program-order (`ppo`) plus barrier semantics simulate the view-based reads of the promising machine.

### 4.5 Model checking: CDSChecker, RCMC, GenMC

Axioms are only as good as our ability to test them. Three generations of tools operationalize these models:

- **CDSChecker** (Norris & Grossman, PLDI 2013) was the first practical model checker for the *C++11* memory model, exploring program executions under the full C++11 axiomatic semantics and finding real bugs in lock-free data structures. Its exhaustive search over `rf`/`mo` choices made C++11's complexity empirically tangible.
- **RCMC** (Kokologiannakis, Lahav, Sagonas, Vafeiadis, POPL 2018) [7] gave an *optimal* DPOR algorithm for the **RC11** model: it explores exactly one execution per Mazurkiewicz equivalence class, with polynomial memory, by constructing execution graphs incrementally and revisiting reads when new writes appear. Optimality matters because RC11's weaker axioms admit *more* executions than SC — naive enumeration drowns.
- **GenMC** (Kokologiannakis & Vafeiadis, CAV 2021) [6] generalizes RCMC into a modular, LLVM-based stateless model checker supporting RC11, IMM (intermediate memory model), and the Linux kernel memory model (LKMM), with barrier awareness (BAM), persistency checking, and memory-safety reasoning under weak memory. Its TruSt DPOR algorithm is parameterized by the model's *consistency predicate*, making new axiomatic models pluggable.

```python
# TruSt-style DPOR driver (GenMC architecture, simplified)
def verify(program, consistent):
    worklist = [Graph(init_event(program))]
    while worklist:
        g = worklist.pop()
        if is_erroneous(g):
            report(g); return False
        for g2 in extend_one_event(g):           # add next po event
            if consistent(g2): worklist.append(g2)
        for g3 in revisit_reads(g, consistent):  # DPOR backtracking
            worklist.append(g3)
    return True  # all consistent executions explored, no errors
```

---

## 5. Empirical Evaluation / Proofs

**Litmus-test validation.** The Cambridge/ARM `herd7`/`litmus7` infrastructure runs thousands of litmus tests against real silicon; Pulte et al. [4] validated both ARMv8 models against hardware observations, confirming that the multicopy-atomic revision matches shipping Cortex-A behavior (no IRIW observed on ARMv8 silicon). The RC11 paper [1] validates its axioms against the complete set of POWER litmus behaviors from the literature: every previously-observed POWER behavior is RC11-consistent, and the newly-forbidden behaviors (the SC-cumulativity violations) have never been observed on any production POWER implementation.

**Compilation proofs, mechanized.** The promising semantics Coq development [2] comprises roughly 30,000 lines proving DRF theorems, optimization soundness, and equivalence with an axiomatic presentation; Promising-ARM [13] adds a mechanized compilation-correctness proof to ARMv8. RC11's compilation proofs [1] are paper proofs but structured as graph transformations checkable against the declarative models. CompCertTSO [14] remains the gold standard for *end-to-end* verification: a verified compiler from ClightTSO to x86 assembly, proved correct in Coq against the TSO model.

**Model-checker performance.** RCMC [7] demonstrates order-of-magnitude speedups over CDSChecker on RC11 benchmarks (e.g., verifying Michael–Scott queue variants), exploring exponentially fewer executions thanks to optimal DPOR; GenMC [6] further extends this to LKMM, finding known kernel bugs (e.g., in RCU list traversals) fully automatically.

| Tool | Model | Technique | Optimality |
|---|---|---|---|
| CDSChecker | C++11 | exhaustive + DPOR | no |
| RCMC | RC11 | execution-graph DPOR | yes |
| GenMC | RC11 / IMM / LKMM | TruSt DPOR, LLVM-based | yes |

## 6. Limitations

No model surveyed here is the final word. **Out-of-thin-air** remains the open wound: RC11's `acyclic(po ∪ rf)` is a sledgehammer that forbids desirable optimizations, while the promising semantics' certification, though principled, is operationally subtle — its interaction with `consume` (data-dependency ordering) was sidestepped in practice, and the "promises" machinery has no direct hardware counterpart, complicating the compilation story to non-multicopy hardware. **Mixed-size accesses** (a byte read observing part of a word write) break the clean per-location `mo` story and required a dedicated extension [10]. **Fairness and liveness** are absent: all these models describe *safety* (which finite behaviors are allowed), saying nothing about whether a spinning read must eventually observe a write — addressed only recently by declarative fairness conditions. **Persistency** (crash consistency for NVRAM) demands yet another dimension of ordering that GenMC has begun to explore [6]. Finally, the C++ standard itself still does not formally adopt RC11; the standard's prose remains the normative artifact, and compiler implementers navigate the gap with folklore.

## 7. Conclusion

The decade from Batty et al.'s formalization [3] to GenMC [6] transformed weak memory from folklore into engineering. The central lesson is methodological: *axiomatic models* make hardware and language semantics comparable as predicates over execution graphs, enabling equivalence proofs [4], compilation-correctness proofs by graph transformation [1], and optimal model checking [6, 7]; *operational models with certification* [2] supply the constructive account of causality that axioms can only gesture at. RC11 repaired the foundation — a coherence axiom, `irreflexive(hb; eco?)`, and a partial SC order, `acyclic(psc)`, that are simultaneously weaker where C++11 over-forbade and stronger where it under-forbade — and thereby made the mappings to POWER, ARMv8, and TSO provably sound. The remaining frontier is unification: a single model that is axiomatically clean, operationally constructive, compilation-verified to all major ISAs, and efficiently checkable. Until then, the honest answer to "what does this concurrent program mean?" remains: *it depends on which model you ask — and we can now tell you exactly how.*

---

## References

[1] Ori Lahav, Viktor Vafeiadis, Jeehoon Kang, Chung-Kil Hur, and Derek Dreyer. Repairing Sequential Consistency in C/C++11. In *Proc. 38th ACM SIGPLAN Conf. on Programming Language Design and Implementation (PLDI 2017)*, pages 618–632. ACM, 2017. https://plv.mpi-sws.org/scfix/paper.pdf

[2] Jeehoon Kang, Chung-Kil Hur, Ori Lahav, Viktor Vafeiadis, and Derek Dreyer. A Promising Semantics for Relaxed-Memory Concurrency. In *Proc. 44th ACM SIGPLAN Symp. on Principles of Programming Languages (POPL 2017)*, pages 175–189. ACM, 2017. https://people.mpi-sws.org/~viktor/papers/popl2017-promising.pdf

[3] Mark Batty, Scott Owens, Susmit Sarkar, Peter Sewell, and Tjark Weber. Mathematizing C++ Concurrency. In *Proc. 38th ACM SIGPLAN Symp. on Principles of Programming Languages (POPL 2011)*, pages 55–66. ACM, 2011. https://user.it.uu.se/~tjawe125/publications/batty11mathematizing.html

[4] Christopher Pulte, Shaked Flur, Will Deacon, Jon French, Susmit Sarkar, and Peter Sewell. Simplifying ARM Concurrency: Multicopy-Atomic Axiomatic and Operational Models for ARMv8. *Proc. ACM Program. Lang.* 2(POPL), Article 19, 2018. https://junpengzha.github.io/public_html/ARM/Simplifying-ARM-Concurrency-Multicopy-Atomic.pdf

[5] Jade Alglave, Luc Maranget, and Michael Tautschnig. Herding Cats: Modelling, Simulation, Testing, and Data Mining for Weak Memory. *ACM Trans. Program. Lang. Syst.* 36(2), Article 7, 2014.

[6] Michalis Kokologiannakis and Viktor Vafeiadis. GenMC: A Model Checker for Weak Memory Models. In *Proc. 33rd Int. Conf. on Computer Aided Verification (CAV 2021)*, LNCS 12759, pages 427–440. Springer, 2021. https://plv.mpi-sws.org/genmc/cav21-paper.pdf

[7] Michalis Kokologiannakis, Ori Lahav, Konstantinos Sagonas, and Viktor Vafeiadis. Effective Stateless Model Checking for C/C++ Concurrency. *Proc. ACM Program. Lang.* 2(POPL), Article 17, 2018. https://people.inf.ethz.ch/mkokologiann/papers/popl2018-rcmc.pdf

[8] Leslie Lamport. How to Make a Multiprocessor Computer That Correctly Executes Multiprocess Programs. *IEEE Trans. Computers* C-28(9):690–691, 1979.

[9] Scott Owens, Susmit Sarkar, and Peter Sewell. A Better x86 Memory Model: x86-TSO. In *Proc. 22nd Int. Conf. on Theorem Proving in Higher Order Logics (TPHOLs 2009)*, LNCS 5674, pages 391–407. Springer, 2009.

[10] Shaked Flur, Susmit Sarkar, Christopher Pulte, Kyndylan Nienhuis, Luc Maranget, Kathryn E. Gray, Ali Sezgin, Mark Batty, and Peter Sewell. Mixed-Size Concurrency: ARM, POWER, C/C++11, and SC. In *Proc. 44th ACM SIGPLAN Symp. on Principles of Programming Languages (POPL 2017)*, pages 429–442. ACM, 2017.

[11] ISO/IEC 14882:2011. *Information Technology — Programming Languages — C++.* International Organization for Standardization, 2011.

[12] Sung-Hwan Lee, Minki Cho, Anton Podkopaev, Soham Chakraborty, Chung-Kil Hur, Ori Lahav, and Viktor Vafeiadis. Promising 2.0: Global Optimizations in Relaxed Memory Concurrency. In *Proc. 41st ACM SIGPLAN Conf. on Programming Language Design and Implementation (PLDI 2020)*, pages 362–376. ACM, 2020.

[13] Christopher Pulte, Jean Pichon-Pharabod, Jeehoon Kang, Sung-Hwan Lee, and Chung-Kil Hur. Promising-ARM/RISC-V: A Simpler and Faster Operational Concurrency Model. In *Proc. 40th ACM SIGPLAN Conf. on Programming Language Design and Implementation (PLDI 2019)*, pages 1–15. ACM, 2019.

[14] Jaroslav Ševčík, Viktor Vafeiadis, Francesco Zappa Nardelli, Suresh Jagannathan, and Peter Sewell. CompCertTSO: A Verified Compiler for Relaxed-Memory Concurrency. *J. ACM* 60(3), Article 22, 2013. https://doi.org/10.1145/2487241.2487248

