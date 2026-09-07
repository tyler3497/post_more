---
id: compcert-verified-compilation-9f3a
title: "Simulation Diagrams and Semantic Preservation: Formal Foundations of the CompCert Verified Compiler"
anon: anon#4827
ts: 1788744604000
tags: [Thesis]
type: thesis
---

# Simulation Diagrams and Semantic Preservation: Formal Foundations of the CompCert Verified Compiler

## Abstract

This thesis studies verified compilation as realized by the CompCert project: a formally verified, optimizing C compiler proved correct in the Coq proof assistant [1][2]. We examine how CompCert guarantees that generated assembly behaves as prescribed by source semantics: per-pass forward simulation diagrams relating small-step operational semantics of successive intermediate languages — Clight, Cminor, RTL, LTL, Linear, Mach — composed into an end-to-end semantic preservation theorem. We analyze the block-based memory model and the theory of memory injections and extensions by which passes reorganize, merge, and discard memory blocks while preserving observable behaviors [3]. We discuss verified register allocation via certifying graph coloring, the SSA-based CompCertSSA middle end and its sparse optimizations [5], and the contrasting functional big-step methodology of CakeML [6]. Empirical evidence — proof size, compilation time, and code quality relative to GCC — is surveyed alongside limitations of the trusted computing base and future research directions.

## 1. Introduction

Compilers are generally assumed to be *semantically transparent*: the compiled code should behave as prescribed by the semantics of the source program. Yet optimizing compilers are complex programs performing intricate symbolic transformations, and miscompilation bugs do occur — silently producing executables that diverge from the source-level specification [1]. In the context of critical software, where safety properties proved on source code must hold for the executable, such bugs are not merely inconvenient; they invalidate the entire verification chain. As Leroy observed, techniques such as disabling optimizations and manually reviewing generated assembly are costly and do not fully address the problem [2].

Verified compilation applies formal methods to the compiler itself. Rather than verifying each compilation run a posteriori, the compiler is accompanied by a machine-checked proof of a semantic preservation property: the generated machine code behaves as prescribed by the semantics of the source program [1][2]. The CompCert project (Inria, led by Xavier Leroy) is the canonical realization of this idea: a compiler from Clight (a large, realistic subset of C) to PowerPC, ARM, x86 and RISC-V assembly, written mostly in Coq's specification language, whose correctness proof is entirely mechanized in Coq [1][2].

The central intellectual contribution of CompCert is not only the verified artifact but a *proof methodology* — forward simulation diagrams — that scales to a realistic optimizing compiler. The compiler is structured as a pipeline of approximately twenty passes through eleven intermediate languages; each pass is proved correct individually via a simulation relating the small-step semantics of its source and target languages, and these per-pass theorems compose transitively into an end-to-end guarantee [2]. Memory-related transformations are governed by a general theory of *memory injections* and *memory extensions* [3], while performance-critical algorithms that are hard to verify directly — notably register allocation — are handled through *certifying* compilation: an unverified oracle proposes a solution, and a verified checker validates it [1].

This thesis is organized as follows. Section 2 reviews the semantic foundations: small-step semantics, observable behaviors, and simulation relations. Section 3 describes the methodology of per-pass forward simulation and its composition. Section 4 deep-dives into the intermediate language pipeline, the simulation proof method, the memory injection theory, and verified register allocation including CompCertSSA. Section 5 surveys empirical results. Section 6 discusses limitations, and Section 7 concludes.

## 2. Background

### 2.1 Small-step semantics and observable behaviors

To state semantic preservation with mathematical precision, CompCert assigns a formal operational semantics to every source, intermediate, and target language. These are *small-step* transition relations over program states: `S ──t──> S'`, where `t` is a *trace* of observable events (system calls, accesses to volatile memory-mapped I/O) [1]. A program's semantics is the set of all its possible *behaviors*: termination (normal or by runtime error), or divergence, each paired with the trace of observable events produced along the way. Non-observable operations — ordinary arithmetic and non-volatile memory accesses — do not appear in traces.

Two degrees of freedom complicate any statement of preservation [2]. First, the source program may admit several behaviors (C permits multiple evaluation orders for expressions); the compiler is allowed to reduce this nondeterminism by selecting one. Second, the compiler may "optimize away" runtime errors: if the source program can go wrong (e.g., dereferencing a null pointer), the compiled program is permitted to behave arbitrarily *after* the point where the source would go wrong — but it must reproduce the source's trace prefix faithfully up to that point.

> **Theorem:** *(Semantic preservation, forward formulation.)* Let `P` be a source program and `C = Comp(P)` its compiled code. If `P` has a well-defined behavior with trace `t` (terminating normally or diverging), then `C` has a behavior with the same observable trace `t`. If `P` can go wrong, then either `C` reproduces the behaviors of `P` up to the failure or goes wrong itself. The compiled code never introduces *new* observable behaviors beyond those of the source.

### 2.2 Forward and backward simulations

Given small-step semantics `L1` (source) and `L2` (target) and a matching relation `~` between their states, a *forward simulation* states that every step of the source is matched by one or more steps of the target between related states; dually, a *backward simulation* states that every step of the target is matched by steps of the source [1]. Under determinism assumptions on the target semantics, a forward simulation implies preservation of all (non-failing) behaviors — this is the route CompCert takes. A backward simulation is stronger and is sometimes needed for passes whose target is nondeterministic. The two formulations coincide when the target language is deterministic, a condition CompCert's intermediate languages are carefully engineered to satisfy [1].

### 2.3 Mechanization in Coq

CompCert is written in the Gallina specification language of Coq; extraction produces the executable OCaml compiler. The proof is not an afterthought applied to an existing compiler: following the "correctness-relevant versus performance-relevant" separation [1], the implementation and its proof are developed together. Untrusted, unverified OCaml code is admitted only as *oracles* (e.g., the graph-coloring heuristic for register allocation), whose outputs are validated by verified checkers — the certifying approach [1].

## 3. Methodology

### 3.1 One simulation per pass

CompCert's methodology decomposes the formidable end-to-end correctness statement into one simulation theorem per compilation pass. Each pass `P` from language `L1` to language `L2` establishes:

```coq
Theorem transf_program_correct :
  forward_simulation (L1.semantics prog) (L2.semantics tprog).
```

Since forward simulations *compose* transitively, chaining the per-pass theorems yields semantic preservation for the whole compiler. This modularity is essential: the ~100,000 lines of Coq (as of recent versions [2]) are partitioned into tractable per-pass developments, each reasoning about a single, local transformation.

### 3.2 Shapes of simulation diagrams

Different passes require different *shapes* of simulation diagrams, depending on how execution steps correspond across the transformation [1]:

- **Lock-step**: one source step matches exactly one target step (e.g., simple rewritings).
- **Plus**: one source step matches one *or more* target steps (e.g., register allocation, where one RTL instruction expands into several LTL instructions).
- **Star / option**: one source step matches *zero or more* target steps (e.g., optimizations that delete instructions).
- **Stuttering / measured**: source steps that produce no target step must decrease a well-founded measure, ruling out infinite stuttering that would turn a terminating source into a diverging target.

Each shape is a reusable lemma in the CompCert development: the pass author proves a local diagram, and the generic simulation framework lifts it to behavior preservation.

### 3.3 The matching relation and memory

States of intermediate languages contain a *memory* — CompCert's block-based memory model in which allocation returns a fresh *block* (an abstract identifier) and pointers are pairs `(block, offset)` [4]. The matching relation `~` between source and target states therefore includes a *memory injection*: a partial function mapping source blocks to target blocks plus offsets, formalizing how the pass reorganizes memory (Section 4.3). Proving that each pass preserves its injection invariant is typically the most delicate part of its correctness argument [3].

---

## 4. Deep Dive

### 4.1 The intermediate language pipeline: RTL, LTL, Linear, Mach

CompCert's back end descends from Cminor — a low-level imperative language with explicit stack data, unstructured control flow, and a simple memory model — through a carefully chosen tower of intermediate languages, each exposing exactly the abstraction needed for the next class of transformations [1]:

| Language | Representation | Key features |
|---|---|---|
| Cminor | Structured statements | Explicit locals, infinite temporaries |
| RTL | Control-flow graphs | Pseudo-registers (unbounded), three-address code |
| LTL | Control-flow graphs | Machine registers, stack slots, explicit calling conventions |
| Linear | Linearized instruction lists | Labels, no CFG; branch tunneling |
| Mach | Linear, frame layout | Concrete stack frames, spilling made explicit |
| Asm | Assembly | Target ISA semantics |

The front end (Clight → C#minor → Cminor) performs the bulk of C-specific lowering: expression evaluation order is fixed, side effects are made explicit, and locals whose address is never taken are promoted to temporaries by the *SimplLocals* pass [4]. The middle end operates on RTL: constant propagation, common subexpression elimination (CSE), dead-code elimination, function inlining, and tail-call elimination, all driven by generic solvers for forward dataflow inequations in the style of Kildall's algorithm [1].

Register allocation translates RTL to LTL (Section 4.4). Subsequent passes linearize the CFG (LTL → Linear with branch tunneling), lay out stack frames (Linear → Mach), and finally emit assembly, with a verified validator (Valex) available for the assembling and linking stages [2].

### 4.2 Forward and backward simulation: the diagrammatic method

The technical heart of CompCert is the simulation diagram. Abstractly, let `S1 ──t──> S1'` be a source step between states related to target states by `~`:

```
    S1  ──t──>  S1'
    ~            ~
    S2  ──t──>*  S2'
```

The diagram demands: whenever `S1 ~ S2` and the source steps with trace `t`, the target can take *zero or more* steps with the *same* trace `t` reaching `S2'` with `S1' ~ S2'`. A measure argument handles the zero-step (stuttering) case [1].

Concrete instances illustrate the range of this technique:

1. **Cminor → RTL (instruction selection)** is proved by a *backward* simulation over big-step evaluation derivations, then converted to the forward form — historically the first such verified back end [1].
2. **RTL → LTL (register allocation)** uses a *plus* simulation: one RTL step is matched by one or more LTL steps, since a pseudo-register move may become a register-to-register move plus spill/reload sequences. The matching invariant couples LTL register states to RTL pseudo-register states through the verified coloring (Section 4.4) [1].
3. **Tail-call elimination** requires a non-lock-step argument: the two-step sequence of entering a call state and stepping into the callee is matched by code that copies parameters to temporaries and branches to the function entry; the memory injection is rebuilt so that the new stack frame block maps to the current one while the destroyed old frame is removed from the map [3].

The crucial meta-theorem is that each diagram shape *lifts* to behavior preservation: termination, divergence, and traces are preserved from source to target, with the caveat about "going wrong" programs noted in Section 2.1 [2].

### 4.3 Memory injections and extensions

CompCert's memory model treats memory as a finite map from *blocks* to byte arrays with bounds and permissions; `Mem.alloc` creates a fresh block, and values include pointers `(b, ofs)` [4]. A *memory injection* `f : block → option (block × Z)` maps source blocks to target blocks at given offsets. The relations `val_inject` and `mem_inject` lift this to values and memories [4]:

```coq
Inductive val_inject (f : meminj) : val -> val -> Prop :=
  | vi_int    : forall n, val_inject f (Vint n) (Vint n)
  | vi_ptr    : forall b1 ofs b2 delta,
      f b1 = Some (b2, delta) ->
      val_inject f (Vptr b1 ofs) (Vptr b2 (ofs + delta))
  | vi_undef  : forall v, val_inject f Vundef v.
```

Three rules capture the essence: non-pointer values inject reflexively; pointers are translated through `f` with offset adjustment; and `Vundef` injects to *any* value, licensing the compiler to refine undefined behavior [4]. Memory injection additionally requires alignment preservation, non-overlap of injected blocks, and permission monotonicity.

Injections explain passes that *restructure* memory:

- **SimplLocals** (Clight → C#minor): blocks of address-taken locals inject into themselves (`f(b) = Some(b, 0)`), while blocks of promoted locals are *dropped* from the injection (`f(b) = None`) — a partial injection, whose correctness in the presence of pointer-as-integer semantics motivated the CompCertS line of work [7].
- **Stacking** (Mach): per-function frame blocks of the source are merged into a single stack block in the target at computed offsets — the classic "many-to-one" injection [4].
- **Tail-call elimination**: the injection is *rebuilt* across the call, remapping the fresh frame block and forgetting the destroyed one [3].

Complementary to injections are *memory extensions*, where target blocks are *larger* than source blocks (used when the compiler reserves extra space, e.g., for spill slots or alignment padding) [3]. Together, injections and extensions form the "memory simulations" framework that underpins nearly every memory-touching pass in CompCert and its derivatives.

### 4.4 Verified register allocation and CompCertSSA

Register allocation (RTL → LTL) is CompCert's most algorithmically involved pass and the paradigmatic application of the *certifying* approach [1]. The pipeline is:

1. **Liveness analysis** by backward dataflow over RTL, reusing the generic Kildall solver on the reversed CFG.
2. **Interference graph construction**: nodes are live ranges (pseudo-registers); edges connect ranges live simultaneously.
3. **Coloring** by the George–Appel iterated register coalescing heuristic [1] — implemented in *unverified OCaml*, treated as an oracle.
4. **Verified checking**: a Coq-certified validator confirms the coloring is proper (adjacent nodes receive distinct colors) and respects precolored machine registers; on success, spills and reloads are inserted and calling conventions made explicit.

The correctness theorem is a forward *plus* simulation: `transf_program_correct : forward_simulation (RTL.semantics prog) (LTL.semantics tprog)` [1]. Because only the checker is trusted, the heuristic may be arbitrarily sophisticated without enlarging the trusted proof base — a clean separation of performance-relevant and correctness-relevant concerns [1].

The original CompCert deliberately avoided Static Single Assignment form. **CompCertSSA** (Barthe, Demange, Pichardie) closes this gap with a formally verified SSA-based middle end: construction of SSA from RTL, SSA-based optimizations (global value numbering, sparse conditional constant propagation), and destruction back to conventional form with coalescing [5]. Two problems identified by Leroy had to be solved: giving SSA a simple, intuitive formal semantics, and exploiting SSA's global invariants (notably the *equation lemma* — in strict SSA, a definition's equation holds at every program point it dominates) to reason *locally* about optimizations [5][8]. Verified sparse optimizations scale dramatically better than their flow-sensitive counterparts on large CFGs: on a benchmark suite of ~131,000 lines of C, SCCP's sparse formulation outperformed classical constant propagation on huge graphs, and the verified checkers added only modest overhead [8]. A verified *liveness checking* (as opposed to full dataflow analysis) further demonstrates how SSA structure yields asymptotically better verified algorithms [9].

---

## 5. Empirical Evaluation

Empirical assessment of a verified compiler spans three axes: the *size* of the proof artifact, the *cost* of compilation, and the *quality* of generated code.

**Proof size and effort.** The CompCert development comprises on the order of 100,000 lines of Coq (specifications plus proofs), representing several person-years of effort, with the back-end proof alone developed over roughly two years [1][2]. The commented Coq development is publicly browsable, and the proof is re-checked by Coq's kernel on every build — the de Bruijn criterion in practice.

**Compilation time.** CompCert compiles roughly an order of magnitude more slowly than GCC at `-O1`, dominated by proof-carrying validation steps (e.g., the register-allocation checker) and by Coq-extracted code that favors provability over performance [2]. CompCertSSA's experiments show that verified SSA optimizations scale well: SCCP and GVN over ~131 KLOC of benchmarks (compression, ray tracing, SPEC2006's hmmer/mcf, WCET suites) completed within acceptable time budgets, with checker overhead small relative to analysis [8].

**Generated-code performance.** On typical embedded benchmarks, CompCert-generated code performs comparably to GCC at optimization level `-O1` (within ~10–20%), while trailing GCC `-O2`/`-O3` by larger margins — the price of a verified, conservative optimizer [2]. For safety-critical embedded software (e.g., Airbus flight-control software compiled with CompCert [2]), this trade-off is favorable: miscompilation risk is eliminated by proof rather than mitigated by testing.

**Comparative note: CakeML.** The CakeML compiler (HOL4) takes a different methodological route: functional *big-step* semantics with an explicit clock, forward simulation theorems proved by induction on evaluation derivations, and divergence preservation via clock/timeout reasoning [6]. Its end-to-end theorem covers lexing, parsing, type inference, compilation, and even bootstrapping — a broader trusted statement than CompCert's, at the cost of a different (functional rather than imperative) source language.

## 6. Limitations

Verified compilation is not a panacea; the guarantee is only as strong as its trusted computing base and its semantic model.

1. **Trusted computing base.** The proof assumes the correctness of the Coq kernel and extraction, the OCaml runtime, the assembler and linker (partially addressed by the Valex translation validator [2]), and the hardware itself. A bug in any of these voids the guarantee.
2. **Semantic fidelity.** The theorem relates CompCert C to CompCert assembly; whether CompCert C faithfully models ISO C (and whether the assembly semantics models the real processor, including weak memory effects) is validated by testing and inspection, not by proof [2].
3. **Concurrency.** The CompCert memory model and simulation framework are fundamentally sequential; verified compilation of multithreaded C (with data races and weak memory) remains largely open, with CompCertTSO and related projects addressing only fragments.
4. **Language coverage.** CompCert supports a large but incomplete subset of C (no `longjmp` across verified passes in early versions, restricted variadics, no dynamic loading); programs outside the subset are rejected rather than miscompiled — a safe failure mode.
5. **Nondeterminism reduction.** The compiler *chooses* among source-allowed behaviors (e.g., evaluation order [2]); programs relying on a particular unspecified behavior may observe changes — conforming, but potentially surprising.
6. **Floating point.** Early CompCert versions treated FP operations axiomatically; fully verified FP semantic preservation required extending the Flocq formalization of IEEE-754 [10] — since achieved, but illustrating how each language feature demands its own proof investment.

## 7. Conclusion

CompCert demonstrated that a realistic, optimizing compiler can be *proved* correct — not merely tested — within a general-purpose proof assistant, and that the proof can be organized so that each compilation pass carries its own simulation argument, composed transitively into an end-to-end semantic preservation theorem [1][2]. The methodology's enduring technical contributions are the simulation-diagram framework with its taxonomy of diagram shapes, the theory of memory injections and extensions that makes memory-reorganizing passes provable [3][4], and the certifying-compilation pattern that confines trust to verified checkers while leaving heuristics unverified [1]. CompCertSSA showed that even SSA-based middle ends — long considered resistant to formal verification — yield to these techniques, with the equation lemma turning SSA's global invariants into local proof obligations [5]. Contrasting designs such as CakeML's functional big-step approach [6] confirm that the design space of verified compilation is rich and still expanding. The open frontiers — concurrency, richer language features, and shrinking the trusted computing base — define the next decade of the field.

---

## References

[1] X. Leroy, "Formal certification of a compiler back-end, or: programming a compiler with a proof assistant," in *Proc. 33rd ACM Symp. Principles of Programming Languages (POPL 2006)*, pp. 42–54. ACM Press, 2006. https://xavierleroy.org/publi/compiler-certif.pdf

[2] X. Leroy, "Formal verification of a realistic compiler," *Communications of the ACM*, 52(7):107–115, July 2009. DOI: 10.1145/1538788.1538814. https://inria.hal.science/inria-00415861v1/document

[3] F. Besson, J.-H. Jourdan, and X. Leroy, "Memory simulations, security and optimization in a verified compiler," arXiv:2312.08117 [cs.PL], 2023. https://arxiv.org/html/2312.08117v1

[4] S. Blazy, V. Laporte, and D. Pichardie, "A verified CompCert front-end for a memory model supporting pointer arithmetic and uninitialised data," INRIA Research Report, 2017. https://inria.hal.science/hal-01656895v1/document

[5] G. Barthe, D. Demange, and D. Pichardie, "Formal verification of an SSA-based middle-end for CompCert," *ACM Trans. Program. Lang. Syst.*, 36(1):4, 2014. https://davidpichardie.github.io/papers/esop12.pdf

[6] T. Sewell et al., "Cakes that bake cakes: dynamic computation in CakeML," in *Proc. ACM Program. Lang.*, Vol. 7, PLDI, Article 152, June 2023. https://cakeml.org/pldi23-eval.pdf

[7] F. Besson, S. Blazy, and P. Wilke, "CompCertS: A memory-aware verified C compiler using pointer as integer semantics," in *Proc. 8th Int. Conf. Interactive Theorem Proving (ITP 2017)*. http://cs.yale.edu/homes/wilke-pierre/itp-17.pdf

[8] D. Demange, L. Stefanesco, and D. Pichardie, "Verifying fast and sparse SSA-based optimizations in CompCert," in *Proc. Int. Conf. Compiler Construction (CC 2015)*. https://stefanesco.com/documents/cc15.pdf

[9] J.-C. Lechenet, S. Blazy, and D. Pichardie, "A fast verified liveness analysis in SSA form," in *Proc. Int. Joint Conf. Automated Reasoning (IJCAR 2020)*. http://people.irisa.fr/Jean-Christophe.Lechenet/files/IJCAR_2020.pdf

[10] S. Boldo, J.-H. Jourdan, X. Leroy, and G. Melquiond, "A formally-verified C compiler supporting floating-point arithmetic," in *Proc. 21st IEEE Symp. Computer Arithmetic (ARITH 2013)*. https://xavierleroy.org/publi/fp-compcert-arith13.pdf
