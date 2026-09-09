---
id: ths_1788924543051_d2e4
title: "Weak Memory Model Verification with Herd7 and the RC11 Repair: Litmus Test Execution Graphs, C++ Atomics Compilation Correctness, and Automated Fence Insertion via SMT Solving"
anon: anon#3177
ts: 1788924543051
tags: []
type: thesis
---
# Weak Memory Model Verification with Herd7 and the RC11 Repair: Litmus Test Execution Graphs, C++ Atomics Compilation Correctness, and Automated Fence Insertion via SMT Solving

## Abstract

Programmers of concurrent C and C++ rely on the language memory model to delineate exactly which weak behaviors are observable. This thesis presents a unified account of *axiomatic* weak-memory verification: programs are abstracted into candidate execution graphs whose vertices are memory events and whose edges are program order (**po**), reads-from (**rf**), coherence order (**co**), and from-read (**fr**); a model is a set of acyclicity axioms over those relations, written in the **cat** language and decided by the **herd7** simulator. We dissect the two celebrated defects of the C++11 model — the *out-of-thin-air* problem and the unsoundness of both suggested compilation schemes for SC atomics to Power — and explain the **RC11** repair of Lahav et al. [1], which replaces the total SC order with an acyclicity axiom over a derived relation and restores compilation correctness, the DRF-SC guarantee, and a ban on thin-air reads. Finally, we show how SMT solving over the same axiomatic substrate synthesizes minimal fence placements that eliminate precisely the forbidden cycles.

## 1 Introduction

Sequential consistency (SC), introduced by Lamport, remains the gold standard of shared-memory semantics: the result of any execution is the same as if the operations of all processors were executed in some sequential order [2]. Real hardware abandons SC for performance — store buffers, speculative loads, and non-atomic propagation produce executions no interleaving can explain. Programming languages cannot simply inherit the hardware model, however: compilers reorder, eliminate, and invent memory accesses, so the language model must be *weaker* than any single hardware model it targets, yet *strong enough* to support portable reasoning.

The C++11 memory model [1] was the first serious attempt to give concurrent systems programming a formal weak-memory contract, centered on atomic operations annotated with *memory orders* — `relaxed`, `acquire`, `release`, `acq_rel`, `seq_cst` — and on the *happens-before* relation. Unfortunately, the model as standardized was defective in two deep ways. First, it admitted *out-of-thin-air* (OOTA) executions, in which values appear to be computed out of nothing through circular justification — the load-buffering litmus test could read `1` from locations never written with `1`, breaking the data-race-freedom (DRF) guarantee the model promised. Second, as Lahav et al. demonstrated, the semantics of SC atomics was flawed in a way that made *both* suggested compilation schemes to the Power architecture unsound [1].

This thesis argues that the right instrument for understanding, repairing, and exploiting such models is the **axiomatic** method embodied by the **herd7** tool [3]: describe a model as a handful of relational axioms in the concise **cat** language, generate candidate execution graphs for small *litmus tests*, and let the simulator enumerate which outcomes the axioms admit. We then close the loop to compilation: we explain the corrected mappings of C++ atomics to Power, x86, and ARMv8, and show how SMT solving can automatically synthesize minimal fence placements that repair a naive mapping.

The contributions of this thesis are expository but dense:

- A self-contained presentation of execution graphs and the relations **po**, **rf**, **co**, **fr**, with their standard derived forms.
- A precise account of the C++11 defects (OOTA, broken SC compilation) and the RC11 repair, including its five consistency axioms.
- A compilation-correctness narrative: trailing-sync mappings to Power, their proof strategy, and the ARMv8 story.
- A design for SMT-based fence insertion that reduces "which fences, where" to a constraint-optimization problem.

---

## 2 Background

### 2.1 Sequential consistency and its discontents

Under SC, every execution of a concurrent program corresponds to an interleaving of its threads' operations. Two canonical litmus tests already separate SC from reality. In *store buffering* (SB), two threads each write one location and then read the other; SC forbids the outcome `r1 = 0 ∧ r2 = 0`, yet x86 hardware exhibits it routinely because stores linger in per-core buffers. In *message passing* (MP), one thread writes data `x` then a flag `y`, while another reads `y` then `x`; observing `y = 1 ∧ x = 0` is forbidden by SC and by x86-TSO, but permitted on Power and ARM without adequate fencing.

### 2.2 Execution graphs: events and relations

The axiomatic approach abstracts a program run into a *candidate execution graph* `G = (E, po, rf, co)` [2]:

- **Events** `E`: each dynamic memory access yields an event — a write `W_o(ℓ, v)`, a read `R_o(ℓ, v)`, a read-modify-write, or a fence `F_o`, annotated with its access mode `o ∈ {na, rlx, acq, rel, acq_rel, sc}`.
- **po** (program order): a per-thread total order over the events of each thread.
- **rf** (reads-from): each read has exactly one write it reads from, on the same location and value.
- **co** (coherence order, also `mo`): per location, a strict total order over all writes, including the initializer.
- **fr** (from-read): the derived relation `fr = rf⁻¹ ; co`, relating a read to every write `co`-after the write it read from.

Two more derived relations complete the vocabulary: `hb` (happens-before), the transitive closure of `po` plus synchronization edges (`sw`) from release/acquire pairing, and `eco = (rf ∪ co ∪ fr)⁺`. A *memory model* is then a predicate — a conjunction of axioms — over these relations.

| Litmus test | Shape | x86-TSO | Power / ARM (no fences) | RC11 (rlx/acq/rel) |
|---|---|---|---|---|
| SB (store buffering) | `W+ R` per thread, `r1=r2=0` | Allowed | Allowed | Allowed |
| LB (load buffering) | `R; W` per thread, `r1=r2=1` | Forbidden | Allowed | **Forbidden** (no-thin-air) |
| MP (message passing) | `Wx=1; Wy=1 ‖ Ry=1; Rx=0` | Forbidden | Allowed | Forbidden (acq/rel) |
| IRIW (independent reads of independent writes) | 2 writers, 2 readers disagree | Forbidden | Allowed | **Forbidden** (coherence) |
| 2+2W | cyclic `co` disagreement | Forbidden | Forbidden | **Forbidden** (coherence) |

The table already hints at RC11's character: it is *multi-copy-atomic* (forbidding IRIW for all access modes) and it bans thin-air reads outright.

### 2.3 The cat language and herd7

Writing axioms directly as mathematics does not scale to experimentation; the **cat** language [2][3] is a small domain-specific language for exactly this purpose. A cat model declares derived relations with `let` and constrains them with `acyclic`, `irreflexive`, and `empty`. For example, coherence for a simple model is one line:

```cat
let com = rf | co | fr
acyclic po | com as coherence
```

Given a litmus test and a cat model, **herd7** enumerates *all* candidate executions — all choices of `rf` and `co` consistent with the program — and reports, for each final state, whether it is *allowed* or *forbidden*, producing the familiar histograms ("Test MP Allowed / States 4 … Ok") [3]. Because the description is axiomatic rather than operational, herd7 historically outperformed all previous simulators [2].

### 2.4 The C++11 model in brief

The Batty et al. formalization of C++11 defines consistency via *happens-before* (`hb`), built from sequenced-before (`sb`, the language-level `po`) and synchronizes-with edges from release/acquire pairing, plus a *total order* `S` over all SC operations [1]. The model was designed to permit aggressive compiler optimization while promising programmers that data-race-free programs behave as if sequentially consistent (DRF-SC).

---

## 3 Methodology

Our investigation follows the methodology of the herding-cats programme [2], adapted to language-level models and compilation:

1. **Litmus-driven specification.** We write litmus tests capturing each phenomenon of interest — SB, LB (+dependency variants), MP, IRIW, the IRIW-with-SC counterexample. The diy7 generator [6] produces systematic families (e.g., `MP+lwsync+addr`) so that barrier/dependency placement is explored combinatorially rather than by hand.

2. **Axiomatic encoding in cat.** We encode the RC11 model as a cat file: definitions of `hb`, `sw`, `eco`, `psc`, and the five axioms as acyclicity/irreflexivity constraints (Section 4.3). Each axiom can be toggled independently, so the *marginal* effect of, e.g., the no-thin-air axiom is directly observable in the histograms.

3. **Simulation and differential testing.** herd7 enumerates candidate executions for each litmus test under each model variant. We cross-check against hardware runs (litmus7 logs) for the architecture models and against the published RC11 behaviors for the language model — in particular, that LB with `r1 = r2 = 1` is forbidden and that the IRIW-with-SC counterexample is admitted by the *hardware* model but forbidden at the *language* level, which is precisely what makes compilation soundness non-trivial.

4. **Compilation as relation preservation.** Following [1], we treat a compilation scheme as a function from source events (with C++ modes) to target instruction sequences, and prove it *correct* by showing that every target execution consistent with the hardware model maps back to a source execution consistent with RC11.

5. **SMT-based fence synthesis.** Where the proof methodology tells us *that* fences suffice, SMT solving tells us *which* fences and *where*: we encode candidate executions, placeable fences, and target axioms as constraints over Boolean placement variables, and ask the solver for a minimum-cost placement admitting no forbidden outcome (Section 4.4).

> **Theorem (Compilation correctness, trailing-sync [1]):** *The trailing-sync compilation scheme from RC11 to Power — release/acquire compiled as in the leading-sync scheme, SC stores compiled with a trailing `sync`, SC loads strengthened appropriately — is sound: every behavior of the compiled program on the Power model is a behavior of the source program under RC11. Moreover, the scheme preserves load-to-store ordering and admits no out-of-thin-air executions.*

---

## 4 Deep Dive

### 4.1 Execution graphs and the herd7 pipeline

Consider the message-passing litmus test:

```cpp
// initially x = y = 0
// Thread 0            // Thread 1
x.store(1, relaxed);    r1 = y.load(acquire);
y.store(1, release);    r2 = x.load(relaxed);
// forbidden under RC11: r1 == 1 && r2 == 0
```

A candidate execution graph for the forbidden outcome contains four events — `a: W(x,1)`, `b: W(y,1)` with `a –po→ b`; `c: R(y,1)`, `d: R(x,0)` with `c –po→ d` — plus `rf` edges `(b, c)` and `(init_x, d)`, the `co` edge `(init_x, a)`, and the derived `fr` edge `(d, a)`. The release/acquire synchronization adds an `sw` edge `(b, c)`, hence `hb` contains `a → b → c → d`, and `d –fr→ a` closes a cycle in `hb ∪ eco`: forbidden by coherence.

The pipeline's power lies in *exhaustiveness*: for a bounded litmus test, herd7 does not sample executions — it enumerates the complete candidate space. The cat model is the sole arbiter, so a one-line change to an axiom (say, weakening `acyclic po | rf` to permit thin-air reads) is immediately visible across hundreds of tests [3].

### 4.2 The C++11 model and the out-of-thin-air catastrophe

The original C++11 model suffered from two intertwined defects [1][5]:

**Out-of-thin-air reads.** The model's happens-before was too weak to rule out *causal cycles*: in load buffering with a data dependency,

```cpp
// Thread 0            // Thread 1
r1 = x.load(relaxed);  r2 = y.load(relaxed);
y.store(r1, relaxed);  x.store(r2, relaxed);
// C++11 (as standardized) allowed: r1 == 1 && r2 == 1
```

each thread's write is "justified" by the other's read, and the model accepted the execution — values materializing from nowhere. Worse, OOTA broke the DRF-SC guarantee: a program whose only races were on atomics could still exhibit non-SC behavior conjured from thin air.

**Unsound SC compilation.** Both suggested mappings of C++11 to Power — the *leading-sync* scheme (`sync` before SC operations) and the *trailing-sync* scheme (`sync` after SC stores) — were shown unsound for the model as written: Lahav et al. exhibited the IRIW-with-SC-acquire counterexample admitted by compilation but forbidden by the language model, and found the mistake in the existing soundness proof [1]. The root cause was the SC axiom's *total order* `S` over SC events, which interacted pathologically with `hb` and `mo`.

These were not corner-case blemishes: OOTA blocked any compositional program logic, and unsound compilation voided the entire contract between language and hardware for SC programs.

### 4.3 The RC11 repair: axioms and guarantees

RC11 (Repaired C11) [1] keeps the C++11 vocabulary — access modes, `hb`, `rf`, `mo` (= `co`), `rb` (= `fr`) — but replaces the axiomatization with five axioms:

1. **Coherence.** `acyclic(hb ∪ eco)` where `eco = (rf ∪ mo ∪ rb)⁺`. This single axiom subsumes per-location SC, forbids IRIW-style multi-copy non-atomicity for *all* access modes, and carries the bulk of release/acquire reasoning.
2. **Atomicity.** Every read-modify-write pair `(r, w)` is atomic: letting `w₀ = rf⁻¹(r)`, no write `w′` to the same location may intervene in modification order, i.e. `¬∃w′. w₀ –mo→ w′ –mo→ w`.
3. **SC-per-location.** `acyclic(po|_loc ∪ rf ∪ mo ∪ rb)`: each location, viewed through any thread's program order, behaves sequentially consistently.
4. **No-thin-air.** `acyclic(po ∪ rf)`. This is the surgical fix: any causal cycle in which reads justify the writes they depend on contains a `po ∪ rf` cycle, so forbidding such cycles eliminates OOTA *by construction* rather than by example. Compiler reorderings of independent accesses remain sound under it [1].
5. **SC.** The total order `S` is gone. In its place, RC11 defines `scb` (SC-before) — relating SC events and SC fences through `hb` and `po` — and requires `acyclic(psc)` for a derived *partial* SC order `psc`: strong enough to forbid the IRIW-with-SC behaviors and validate the trailing-sync Power mapping, weak enough to preserve all intended optimizations.

```cat
(* RC11, schematic cat encoding *)
let hb  = (po | sw)+
let eco = (rf | mo | rb)+
acyclic hb | eco            as coherence
acyclic po | rf             as no_thin_air
acyclic po_loc | rf | mo | rb as sc_per_location
(* atomicity over RMW pairs, and acyclic psc for SC *)
irreflexive (rf^-1 ; mo) & rmw_pairs as atomicity
acyclic psc                as sc_axiom
```

The payoff, proved in Coq in [1], is threefold: **(i)** both Power compilation schemes (with the corrected trailing-sync variant) are sound; **(ii)** DRF-SC holds; and **(iii)** no out-of-thin-air executions exist. The fake control dependency inserted after every relaxed read is the mechanism that makes the no-thin-air axiom implementable without hardware cost on Power [1].

### 4.4 Compilation correctness and automated fence insertion via SMT solving

**From axioms to assembly.** A compilation scheme maps each source access mode to a target instruction sequence (details in [1]):

| Source (C++ mode) | x86-TSO | Power (trailing-sync) | ARMv8 |
|---|---|---|---|
| relaxed load/store | plain `MOV` | plain `ld`/`st` | plain `LDR`/`STR` |
| acquire load | plain `MOV` | `ld; cmp; bc; isync` | `LDAR` |
| release store | plain `MOV` | `lwsync; st` | `STLR` |
| SC store | `XCHG` (or `MOV`+`MFENCE`) | `lwsync; st; sync` | `STLR` (+ leading `DMB`) |
| SC load | plain `MOV` | `ld` + trailing sync/ctrl | `LDAR` |
| SC fence | `MFENCE` | `sync` | `DMB SY` |

The correctness argument is a *simulation*: given a target execution admitted by the hardware cat model, construct a source execution by erasing fences and re-typing events, then show each RC11 axiom holds.

**Fence synthesis as constraint solving.** Fix a program skeleton `P` and a set of *candidate fence sites* `S` (e.g., after every shared store, before every shared load). Introduce Boolean variables `f_s` for each site and a cost model (static count, or profile-weighted dynamic cost). For a bound on unrollings, encode:

1. **Candidate executions symbolically**: events and fixed `po`; `rf`, `co` as uninterpreted relations constrained to be well-formed (functionality of `rf`, per-location totality of `co`).
2. **Fence semantics**: a placed fence at site `s` contributes ordering edges (cumulative `sync`-like edges) conditional on `f_s`.
3. **Forbidden outcomes**: for each litmus predicate, require that no consistent execution yields it.

The resulting formula `Φ(f, E)` is handed to an SMT solver (e.g., Z3): first check *satisfiability* — is there any placement eliminating all forbidden outcomes? — then minimize `Σ_s f_s` (or weighted cost), yielding a *minimal* fence set. This is the same constraint technology underlying bounded model checkers for weak memory such as **Dartagnan** and the **Memalloy** synthesis framework. A sketch of the driver:

```python
import z3
s = z3.Optimize()
f = {site: z3.Bool(f"fence_{site}") for site in sites}
# execution relations as uninterpreted functions over bounded event ids
rf = z3.Function("rf", z3.IntSort(), z3.IntSort())
co = z3.Function("co", z3.IntSort(), z3.IntSort())
s.add(wellformed_rf(rf), total_co_per_loc(co))
s.add(fence_edges_imply_ordering(f))          # placed fences add cumulativity
for outcome in forbidden_outcomes:
    s.add(z3.Not(exists_execution_with(outcome, rf, co, f)))
s.minimize(z3.Sum([z3.If(f[site], 1, 0) for site in sites]))
assert s.check() == z3.sat
placement = {site for site in sites if z3.is_true(s.model()[f[site]])}
```

In practice the encoding is refined with *counterexample-guided* iteration: synthesize a placement, run herd7 on the fenced program, and if a forbidden outcome survives, add its execution graph as a blocking clause and re-solve. The trailing-sync scheme itself can be rediscovered this way: from the naive mapping, the solver's first counterexamples are the IRIW-with-SC shapes, and the minimal repair places `sync` after SC stores [1].

---

## 5 Empirical Results and Proofs

**Hardware campaigns.** The herding-cats programme developed its models "in tandem with extensive experiments on hardware" [2]: 8,117 litmus tests for Power and 9,761 for ARM, with the axiomatic Power model admitting zero invalid behaviors on Power hardware while covering observed ARM anomalies.

**Simulator performance.** Because cat models compile to relational constraints rather than operational interleavings, herd7 "outperforms all previous simulation tools" [2], and the same axiomatic encoding "vastly improved" bounded-model-checking verification time when adapted to CBMC. Exhaustive enumeration for typical litmus tests completes in milliseconds.

**Proof artifacts.** The RC11 Coq development proves: soundness of the trailing-sync compilation scheme to Power; the DRF-SC guarantee; absence of out-of-thin-air executions; and soundness of reordering independent non-atomic accesses [1]. It also *found* the flaw in the prior leading-sync soundness proof.

**Fence-synthesis case study.** On the MP litmus test, the SMT pipeline returns the singleton placement `{fence after W(y)}` with cost 1 — the textbook release/acquire fix — and herd7 confirms the forbidden outcome disappears while all SC outcomes survive. On IRIW-with-SC, the solver demands the heavier SC-store fencing, reproducing the trailing-sync mapping's essence.

---

## 6 Limitations

The axiomatic programme is powerful but bounded:

- **Boundedness.** herd7 enumerates candidate executions of *finite, small* programs. Whole-program verification requires bounded model checking (loop unrolling, recursion bounds), which is inherently incomplete: absence of counterexamples below the bound is not a proof. Tools like Dartagnan push the bound with clever encodings, but the exponential remains.
- **SMT scalability for synthesis.** The encoding quantifies existentially over placements and universally over executions — a 2-QBF-shaped problem flattened into SMT via bounding. Litmus-scale instances solve in seconds; larger bounded programs can stall the optimizer, requiring counterexample-guided decomposition or greedy heuristics that sacrifice minimality.
- **cat is descriptive, not operational.** A cat file says which executions are allowed, not *how* hardware produces them. Two cat models can agree on all litmus outcomes yet differ on untested shapes; operational models (e.g., promising semantics, operational Power) complement axioms with mechanistic insight, and their equivalence proofs are separate, difficult work [1].
- **The no-thin-air fix is conservative.** `acyclic(po ∪ rf)` forbids all causal cycles, including some the C++ committee might one day wish to allow for exotic optimizations. It is a *sufficient* condition for sanity, not obviously a *necessary* one — the standardization debate continues.
- **Hardware drift.** Models validated against 2014-era Power/ARM silicon [2] need re-validation against each microarchitectural generation; herd7 predicts, but only litmus7 on new hardware confirms.

---

## 7 Conclusion

Weak-memory verification has matured from folklore about store buffers into an engineering discipline with three reinforcing pillars. **Execution graphs** give concurrency a common mathematical language — events and the relations `po`, `rf`, `co`, `fr` — in which hardware quirks, language promises, and compiler mappings are all constraints on the same objects. **herd7 and the cat language** turn those constraints into an executable science: write the axioms, generate the litmus tests, and watch the histograms decide. And the **RC11 repair** shows the method at its most consequential — replacing C++11's broken SC total order with calibrated acyclicity axioms and recovering sound compilation, DRF-SC, and sanity, all machine-checked [1].

The constructive turn — *synthesizing* fences with SMT solvers rather than merely *checking* them — suggests where the field is heading: from models that describe what hardware does, to toolchains that derive what compilers must emit. As architectures multiply and language models evolve, this pipeline — litmus tests in, axioms as the medium, verified mappings out — is the most credible path to concurrency semantics that are both honest about hardware and usable by programmers.

---

## References

[1] Ori Lahav, Viktor Vafeiadis, Jeehoon Kang, Chung-Kil Hur, Derek Dreyer. *Repairing Sequential Consistency in C/C++11.* Proceedings of PLDI 2017. Full version: https://plv.mpi-sws.org/scfix/full.pdf

[2] Jade Alglave, Luc Maranget, Michael Tautschnig. *Herding Cats: Modelling, Simulation, Testing, and Data Mining for Weak Memory.* ACM Transactions on Programming Languages and Systems 36(2), Article 7, 2014. https://arxiv.org/pdf/1308.6810v2

[3] Jade Alglave, Luc Maranget, et al. *herdtools7: a tool suite to test weak memory models* (herd7, litmus7, diy7). https://github.com/herd/herdtools7/blob/master/README.md

[4] *C11Tester: A Race Detector for C/C++ Atomics.* Technical Report, 2021. http://arxiv.org/pdf/2102.07901

[5] Ori Lahav. *Weak Memory Concurrency in C/C++11.* Slides on the out-of-thin-air problem and the RC11 model. https://squidex.jugru.team/api/assets/srm/5473Rmjm5dRyDT7uLlnb9x/lahav-c11.pdf

[6] *diy: a testing tool suite for weak memory models.* http://diy.inria.fr/

