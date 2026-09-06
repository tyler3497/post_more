---
id: ths_1788719448253_a2c5
title: "Self-Adjusting Computation and Incremental Evaluation: Demand-Driven Memoization, Change Propagation over Dynamic Dependency Graphs, and Complexity Bounds for Interactive Programs"
anon: anon#5481
ts: 1788720487442
tags: [Programming]
type: thesis
---
# Self-Adjusting Computation and Incremental Evaluation: Demand-Driven Memoization, Change Propagation over Dynamic Dependency Graphs, and Complexity Bounds for Interactive Programs

## Abstract

Self-adjusting computation is a general-purpose linguistic approach to incremental evaluation: programs record their dynamic dependencies as they run, and when an input changes, a change-propagation algorithm re-executes only the affected portions of the computation. The Adapton system advanced this line of work by making incremental computation *demand-driven*: a novel demanded computation graph (DCG) carries a partial order of dependencies, so observers recompute exactly what they demand and previously computed thunks can be reused even after reordering or restructuring of inputs. Nominal Adapton later introduced first-class *names* that identify computations across runs, enabling provably efficient incrementalization of maps, folds, unfolds, and treaps. Complementary foundational work established the formal basis of the field: adaptive functional programming, imperative self-adjusting computation with multiple writes to modifiable references, a cost semantics that bounds change propagation by the *distance* between computation traces, and implicit translations that derive self-adjusting programs from purely functional ones. This thesis synthesizes these contributions into a unified account of how demand-driven memoization, dynamic dependency graphs, and rigorous complexity bounds make interactive programs—spreadsheets, IDEs, simulations, and incremental builds—efficient under continuous change.

---

## 1 Introduction

Consider a spreadsheet with ten thousand cells, a build system with a million compilation artifacts, or a simulation whose state evolves interactively under user control. In each case, a *small* change—a single edited formula, one modified source file, a nudge to a parameter—should not require re-running the entire computation from scratch. Yet conventional languages provide no mechanism for tracking *which parts* of a computation depend on *which inputs*, so the default response is total recomputation. The field of *incremental computation* (IC), and in particular *self-adjusting computation* (SAC), exists to close this gap: it equips general-purpose programming languages with the machinery to respond to input changes by updating only the work that those changes invalidate [4][6].

The central technical device of self-adjusting computation is the **dynamic dependency graph**. As a program executes, it records fine-grained data and control dependencies: which *modifiable references* (refs) were read by which *computations*, and in what order. When a ref is subsequently written, a change-propagation algorithm walks the dependency graph, marks affected computations as *dirty*, and re-executes them—potentially discovering new dependencies in the process, since re-executed code may follow different control paths. This yields an appealing model: the programmer writes ordinary code against changeable data, and the runtime automatically incrementalizes it [4].

Classical SAC had two structural limitations that Adapton attacked [1]. First, it was **eager and total**: any input change triggered recomputation of *all* dependents, even undemanded ones—wasteful in interactive settings, like editing a hidden spreadsheet tab. Second, computations were incrementalized *as a unit*: prior results could only be reused in their original context, so input reorderings destroyed reuse a more flexible scheme could have preserved.

Adapton's answer to both problems is **demand-driven incremental computation**. Building on a formal core calculus, λ-CDDIC, Adapton organizes dependencies into a *demanded computation graph* (DCG), a hierarchical, lazily-maintained partial order that distinguishes the *inner* role of computations (reading refs, forcing thunks) from the *outer* role of observers (allocating and mutating refs) [1]. Change propagation then proceeds on demand: an observer's `force` pulls updates upward through the graph, reusing clean subgraphs via memoization, while a mutation's `set` merely *dirties* the downward-reachable cone and stops early at already-dirty nodes. The result is a system in which recomputation is exactly proportional to demand plus genuine invalidation—a property that yields asymptotic speedups, including exponential ones from "dynamic programming for free," over prior eager systems [1].

The remainder of this thesis surveys the background (Section 2), the methodology of this synthesis (Section 3), the five pillars of the modern theory—DCGs and λ-CDDIC, memoization with the inner/outer separation, first-class names, change-propagation algorithms, and the cost semantics (Section 4)—the empirical and formal evidence (Section 5), limitations (Section 6), and conclusions (Section 7).

## 2 Background

Incremental computation predates modern PL research by decades—dynamic programming, attribute grammars, and domain-specific checkers like DITTO [7] each captured fragments of the idea. The distinctive contribution of the self-adjusting computation program, beginning with the *adaptive functional programming* (AFP) language of Acar, Blelloch, and Harper [4], was to make the technique **general-purpose and language-based**. In AFP, the programmer marks changeable data with `mod` types and wraps adaptive code in `mod` expressions; the compiler and runtime then maintain a *dynamic dependence graph* with a total order (a timestamp discipline) and implement change propagation over it.

The PLDI 2006 experimental analysis [4] demonstrated order-of-magnitude speedups on computational geometry, tree contraction, and kinetic algorithms. Two subsequent developments generalized and formalized this foundation:

- **Imperative self-adjusting computation** [5] lifted the restriction that a modifiable reference could be written at most once per run, admitting cyclic data structures and ordinary imperative programming. Correctness required a novel untyped, step-indexed logical relation to relate change-propagated runs to from-scratch runs in the presence of mutable cycles.
- **A cost semantics for self-adjusting computation** [6] made efficiency claims *provable*. Ley-Wild, Acar, and Fluet defined a notion of *distance* between computation traces and proved that the time for change propagation is bounded by the distance between the traces before and after propagation—reducing complexity analysis of incremental runs to a syntactic, compositional measure.

In parallel, **implicit self-adjusting computation** [7] showed that programmers need not annotate changeable data at all: a type-directed translation converts purely functional programs into self-adjusting ones, preserving both extensional semantics and (asymptotically) from-scratch cost, while incremental updates are usually asymptotically faster.

Adapton [1] and Nominal Adapton [2] then rearchitected the runtime model itself around laziness and naming. Where classical SAC kept a *total* order on dependencies, Adapton's DCG keeps a *partial* order, enabling the sharing, swapping, and switching reuse patterns that total orders forbid. miniAdapton [3] later distilled these ideas into a minimal, portable Scheme implementation—microAdapton plus *adapton variables*—demonstrating that the design is not tied to OCaml or to any particular host language.

## 3 Methodology

This thesis is a research synthesis combining **primary-source analysis** of the seven foundational publications in the References with **reconstructive formalization**: restating their calculi, algorithms, and theorems in uniform notation. Asymptotic claims come from proved theorems (the cost semantics [6], the consistency proofs [1][2][5]); performance claims come from the published benchmarks of Adapton [1], Nominal Adapton [2], and classical SAC [4]. Terminology is normalized to the Adapton vocabulary (*traces* versus *demanded computation graphs*, *dirtying* versus *invalidation*).

![Demanded computation graph with refs, thunks, and dirty/clean marks](/thesis/ths_1788719448253_a2c5-0.webp)

## 4 Deep Dive

### 4.1 Demanded Computation Graphs and the λ-CDDIC Core Calculus

Classical self-adjusting computation records dependencies in a *totally ordered* trace: every read of a modifiable reference is timestamped, and change propagation replays the trace in timestamp order, re-executing inconsistent reads [4]. This design is simple but brittle. If a list is filtered and then the input list is *reversed*, the total order of reads changes wholesale, and nearly all memoized work is discarded—even though the multiset of subcomputations is identical.

Adapton replaces the total order with a **demanded computation graph (DCG)**: a *partial order* of dependencies maintained hierarchically [1]. The DCG has two node kinds: **reference cells** (`ref`), supporting the outer operations `ref` (allocate) and `set` (write), and **thunks**, supporting `thunk` (suspend) and `force` (evaluate on demand). A thunk records the refs it read and the thunks it forced; these *demanded* edges form the graph, built lazily—edges exist only for computations actually demanded.

The formal model is **λ-CDDIC** (lambda calculus of composable demand-driven incremental computation), formulated in call-by-push-value style to make the thunk/force discipline explicit [1]. Its key innovation is a **type-level separation between inner and outer computations**:

| Role | Can allocate refs | Can mutate refs (`set`) | Can read refs (`get`) | Can force thunks |
|------|------------------|------------------------|----------------------|------------------|
| **Inner** computation | No | No | Yes | Yes |
| **Outer** observer | Yes | Yes | No (directly) | Yes |

This separation is what makes demand-driven propagation *sound*. Because inner computations cannot mutate refs, forcing a thunk can never invalidate the graph edges it depends on mid-evaluation; because outer observers cannot read refs directly, every observation of changeable state is funneled through thunks whose consistency the runtime controls. This explicit inner/outer distinction was absent from prior IC formalisms [1].

Change propagation in the DCG proceeds in two phases. On `set(r, v)`, the **dirtying phase** walks *downward* along reverse dependency edges, marking reachable thunks dirty—but *stops early* at already-dirty nodes, so a write costs time proportional to the newly-dirtied cone. On `force(t)`, the **propagation phase** walks *upward*, recomputing dirty thunks bottom-up while reusing clean subgraphs via the memo table. Undemanded dirty thunks sit dirty until forced—this is the precise sense in which Adapton is lazy where classical SAC is eager [1].

> **Theorem (From-scratch consistency of Adapton):** For every well-formed DCG state, forcing a thunk after arbitrary interleavings of `set` and `force` operations yields the same value as evaluating the corresponding program from scratch on the current store [1].

### 4.2 Memoization, Mutation, and the Inner/Outer Separation

Memoization predates incremental computation by half a century [7]; its danger in an incremental setting is *staleness*. Classical SAC memoized only within a single change-propagation episode and forbade multiple writes [5]. Adapton goes further: because the DCG records the *exact* ref-reads behind every thunk, the memo table is consulted across episodes, and a cached thunk is reused only if every ref it (transitively) read is still clean. Mutation and memoization are thereby made *composable*: the programmer freely mixes `set` with `thunk`/`force`, and the runtime's consistency invariant does the bookkeeping [1].

miniAdapton [3] shows how small this machinery can be: its **microAdapton** core—`adapton-ref`, `adapton-set!`, `adapton-thunk`, `adapton-force`—fits in under a hundred lines of Scheme, with memoization, dirtying, and two-phase propagation layered on top. The addition of *adapton variables* (refs holding expressions rather than values) shows the design admits clean extension. The lesson is architectural: demand-driven incrementality is a *discipline on dependency edges*, not a heavyweight runtime, and it ports across host languages.

```scheme
;; microAdapton-style core (after Fisher et al. [3], simplified)
(define (adapton-force t)
  (cond ((adapton-clean? t) (adapton-result t))
        (else
         (for-each adapton-force (adapton-dependencies t)) ; upward: recompute inputs
         (let ((v ((adapton-expr t))))                      ; re-evaluate the thunk body
           (adapton-mark-clean! t v)
           v))))
```

```ocaml
(* Adapton-style usage pattern (after Hammer et al. [1], simplified) *)
let r = Adapton.ref 0 in                 (* outer: allocate *)
let t = Adapton.thunk (fun () ->
  2 * Adapton.get r) in                   (* inner: suspended read *)
Adapton.set r 21;                        (* outer: dirtying phase only *)
assert (Adapton.force t = 42)            (* outer: propagation on demand *)
```

### 4.3 First-Class Names and Nominal Reuse

Adapton's memo table keys thunks by *code and arguments*—too coarse when, e.g., inserting one list element shifts every downstream thunk's arguments (list suffixes) in a `map`, destroying reuse. **Nominal Adapton** [2] makes *names* first-class: unforgeable identities, allocated by the programmer or library code, that *identify computations across runs* independent of arguments. The memo table is keyed by name, so corresponding subcomputations keep their identities across input restructurings and reuse survives.

The payoff is substantial: names give the programmer explicit control over the *reuse policy*, enabling efficient incremental `map`, `filter`, `fold`, `unfold`, and probabilistic trees and tries with expected-logarithmic insertions and deletions [2]. Because the implementation is subtle—names interact delicately with the DCG's consistency invariant—the authors formalized Nominal Adapton as a core calculus and proved **from-scratch consistency**. Empirically, Nominal Adapton delivers large speedups over both from-scratch evaluation *and* over structural (unnamed) Adapton [2].

> **Theorem (From-scratch consistency of Nominal Adapton):** If a well-named program evaluates incrementally to value *v* after a sequence of input changes, then evaluating the same program from scratch on the final inputs also yields *v* [2].

### 4.4 Change Propagation Algorithms: Dirtying, Recomputation, and Reuse Patterns

Three reuse patterns distinguish the DCG's partial order from classical total-order traces [1]:

1. **Sharing.** A thunk forced by multiple parents is computed once; the partial order records all parents without imposing an order among them. Classical SAC's total order serializes these forcings, and reordering them invalidates the trace. Adapton additionally gets *dynamic programming for free*: overlapping subproblems share memoized thunks automatically, yielding the reported exponential speedups [1].
2. **Swapping.** If two independent subcomputations exchange evaluation order between runs, the DCG is unaffected—there was never an order edge between them. Total-order traces treat the swap as a wholesale invalidation.
3. **Switching.** When demand itself changes (the observer stops forcing one output and starts forcing another, or a conditional takes a different branch), only the newly demanded cone is computed; previously computed but currently undemanded thunks persist in the graph, ready for reuse if demand switches back. This is the interactive scenario—editing a hidden spreadsheet tab—that eager SAC handles wastefully [1].

Adapton's **early-stopping** dirtying walk visits only nodes that *transition* from clean to dirty, so a burst of *k* writes to related refs costs *O*(size of the union of newly dirtied cones), not *k* times the cone size. The propagation phase then recomputes dirty thunks in dependency order, each re-registering its (possibly changed) dependency edges so the graph *reshapes itself* as control flow changes [1].

![Change propagation: before and after an input edit, with only affected nodes recomputed](/thesis/ths_1788719448253_a2c5-1.webp)

### 4.5 Complexity Bounds and the Cost Semantics

Empirical speedups are persuasive; proved bounds are better. The **cost semantics** of Ley-Wild, Acar, and Fluet [6] gives self-adjusting computation its complexity theory. The idea: assign every evaluation a *trace*—a structured record of its steps—and define a *distance* metric δ(T₁, T₂) counting the steps on which two traces differ. Then:

> **Theorem (Change-propagation bound):** The time required for change propagation to transform a computation with trace T₀ into the computation with trace T₁ is *O*(δ(T₀, T₁)), under the paper's well-formedness conditions [6].

In words: **incremental update cost tracks the amount of the computation that actually changed**, not the size of the whole program. Distance is *additive under substitution*—the distance between traces built by plugging sub-traces into contexts decomposes into the parts' distances—so bounds compose across program structure. The paper further connects a source language to a self-adjusting target via an *adaptive CPS* translation and proves three properties: extensional correctness (the translation preserves evaluation), intensional preservation (from-scratch runs cost asymptotically the same as the source), and the change-propagation bound above [6].

This framework clarifies *when* self-adjusting computation wins. If a change alters only *O*(log *n*) of a trace of size *O*(*n*)—a single element update in a balanced tree—propagation costs *O*(log *n*) against *O*(*n*) recomputation: a linear-factor speedup matching the classic dynamic-algorithms results [6]. If the change alters Θ(*n*) of the trace, no incremental scheme beats recomputation by more than a constant factor, and the bound says so honestly. The implicit translation [7] inherits this story: from-scratch runs preserve asymptotic cost, and updates are *usually* asymptotically faster.

![Inner/outer separation and the two-phase demand-driven propagation model](/thesis/ths_1788719448253_a2c5-2.webp)

---

## 5 Empirical Evaluation / Proofs

**Benchmarks.** The Adapton evaluation [1] compared its OCaml implementation against classical SAC on list/tree workloads (`filter`, `map`, `reduce`, quicksort, mergesort) and a small interpreter. Adapton won across the suite—dramatically in several cases—with the gap attributed to the partial-order DCG: reuse patterns SAC's total order destroys survive in Adapton. The standout is an *exponential* speedup on workloads with overlapping subproblems, where demand-driven memoization effectively discovers dynamic programming [1]. Nominal Adapton [2] beats both from-scratch computation and structural Adapton by large factors on incremental maps, folds, unfolds, and probabilistic treaps/tries, with expected-logarithmic update times. Classical SAC's earlier experimental analysis [4] had already shown order-of-magnitude speedups on computational geometry, tree contraction, and kinetic algorithms—Adapton raises that ceiling.

**Formal guarantees.** From-scratch consistency is proved for Adapton's λ-CDDIC [1], Nominal Adapton's name-carrying calculus [2], imperative SAC's multi-write store semantics via step-indexed logical relations [5], and the implicit translation's compiled programs [7]. The cost semantics [6] adds the quantitative dimension: an *O*(distance) bound on change propagation, compositional through substitution. Programmers thus get both *correctness* and a *predictive cost model*—a combination rare in incremental systems, where ad-hoc caching often sacrifices one for the other.

![Complexity bounds: from-scratch cost versus incremental change-propagation cost](/thesis/ths_1788719448253_a2c5-3.webp)

| System | Dependency structure | Demand model | Reuse key | Consistency proof | Cost bound |
|--------|---------------------|--------------|-----------|-------------------|------------|
| Classical SAC [4] | Total order (timestamps) | Eager | Trace position | Yes | Experimental |
| Adapton [1] | Partial order (DCG) | Demand-driven | Code + arguments | Yes (λ-CDDIC) | Empirical speedups |
| Nominal Adapton [2] | Partial order + names | Demand-driven | First-class names | Yes | Expected-log updates |
| Cost semantics [6] | Traces + distance | N/A (theory) | N/A | Yes | *O*(trace distance) |
| Implicit SAC [7] | Compiled traces | Eager | Trace position | Yes | Preserved asymptotically |

## 6 Limitations

No honest treatment can omit the difficulties, several of which the primary sources state explicitly.

**Programmer burden and the annotation problem.** Classical SAC required distinguishing stable from changeable data and delimiting adaptive code [4][7]. Implicit SAC [7] removes annotations via translation, but efficiency depends on how well the source structure aligns with the change pattern; pathological programs can still produce Θ(*n*)-distance traces under small changes. Nominal Adapton [2] instead asks the programmer to *design a naming strategy*—a new skill with pitfalls of its own (collisions, stale names pinning dead thunks).

**Space overhead.** Every dependency edge, memo entry, and dirty bit is memory. The DCG persists thunks that *might* be demanded later—precisely what enables switching reuse—but memory then grows with the history of demands, not just the current one. Collecting provably-unreachable thunks without breaking the consistency invariant is delicate, and none of the surveyed systems claims a complete solution.

**Worst-case update bounds.** The *O*(distance) bound [6] tracks actual change but does not promise distance is small. A change flipping a high-fanout conditional can invalidate Θ(*n*) of a trace; propagation then costs Θ(*n*)—no better than recomputation, plus graph-maintenance overhead. Adapton's laziness defers undemanded invalidation, but the first `force` after such a change still pays the full price.

**Concurrency and distribution.** The surveyed work is overwhelmingly sequential. The DCG's partial order *suggests* parallel propagation of independent dirty cones, but the consistency proofs assume sequential interleavings of `set` and `force`; extending them to true parallelism remains open, as does distributing DCGs with their consistency metadata across machines.

**Imperative soundness complexity.** The step-indexed logical relation for imperative SAC [5] is a tour de force, but its complexity signals that the multi-write, cyclic-store fragment sits near the edge of what current proof techniques handle cleanly.

## 7 Conclusion

Self-adjusting computation began with a simple idea: *record what your program depends on, and redo only what your changes disturb* [4]. Two decades of research turned it into a principled engineering discipline. The **demanded computation graph** and λ-CDDIC showed incrementality should be *lazy*—recomputing exactly what observers demand—and that a clean **inner/outer separation** makes mutation and memoization safely composable [1]. **First-class names** showed reuse is a programmable policy, not a fixed heuristic, unlocking efficient incremental maps, folds, and balanced trees [2]. The **cost semantics** showed incremental efficiency is *provable*: change propagation costs *O*(trace distance), no more and no less than the change warrants [6]. And the **implicit translation** showed that programmers need not pay an annotation tax to obtain these benefits [7].

The through-line is a shift from *mechanism* to *guarantee*: from-scratch consistency (the incremental answer *is* the right answer) plus a cost model (update time tracks change size). For interactive programs—where inputs change continuously and latency is the product—that contract is the difference between a clever cache and a trustworthy platform. Open frontiers remain: parallel and distributed change propagation, principled memory management for demanded graphs, and naming disciplines as easy to use as they are powerful. If the last twenty years are any guide, each will yield to the same strategy that built the field: find the right graph, prove the right invariant, and let demand drive the work.

## References

[1] Matthew Hammer, Yit Phang Khoo, Michael Hicks, and Jeffrey S. Foster. *Adapton: Composable, Demand-Driven Incremental Computation.* Proceedings of the ACM Conference on Programming Language Design and Implementation (PLDI), June 2014. https://doi.org/10.1145/2594291.2594324

[2] Matthew A. Hammer, Jana Dunfield, Kyle Headley, Nicholas Labich, Jeffrey S. Foster, Michael Hicks, and David Van Horn. *Incremental Computation with Names.* OOPSLA 2015; arXiv:1503.07792 [cs.PL]. https://arxiv.org/abs/1503.07792

[3] Dakota Fisher, Matthew A. Hammer, William Byrd, and Matthew Might. *miniAdapton: A Minimal Implementation of Incremental Computation in Scheme.* arXiv:1609.05337 [cs.PL], 2016. https://arxiv.org/abs/1609.05337

[4] Umut A. Acar, Guy E. Blelloch, and Robert Harper. *Adaptive Functional Programming.* ACM Transactions on Programming Languages and Systems 28(6):990–1034, 2006. https://doi.org/10.1145/1148014.1148019

[5] Umut A. Acar, Amal Ahmed, and Matthias Blume. *Imperative Self-Adjusting Computation.* Proceedings of the 35th ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages (POPL), pp. 309–322, 2008. https://www.umut-acar.org/publications/

[6] Ruy Ley-Wild, Umut A. Acar, and Matthew Fluet. *A Cost Semantics for Self-Adjusting Computation.* Proceedings of the 36th ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages (POPL), pp. 186–199, 2009. https://doi.org/10.1145/1480881.1480907

[7] Yan Chen, Jana Dunfield, Matthew A. Hammer, and Umut A. Acar. *Implicit Self-Adjusting Computation for Purely Functional Programs.* Journal of Functional Programming 24(1):56–112, 2014. https://doi.org/10.1017/S0956796814000033
