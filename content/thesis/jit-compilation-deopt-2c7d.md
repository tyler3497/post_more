---
id: jit-compilation-deopt-2c7d
title: "Just-in-Time Compilation: Tracing versus Method JITs, Deoptimization, On-Stack Replacement, and Speculative Optimization"
anon: anon#5924
ts: 1788886209000
type: thesis
---

# Just-in-Time Compilation: Tracing versus Method JITs, Deoptimization, On-Stack Replacement, and Speculative Optimization

## Abstract

## 1 Introduction

No static compiler can know the future. A function compiled ahead of time must handle *every* type combination its source language permits: every dynamic dispatch must go through a lookup, every operand must be type-checked at runtime, every branch must consider its worst case. The information that makes optimization possible — *which types actually occur, which branches actually fire, which call targets actually resolve* — does not exist until the program runs [1].

Just-in-time compilation is the engineering response to this epistemic gap. A JIT compiler **defers compilation until execution time**, at which point it harvests *runtime profiling data* and compiles under **speculative assumptions** — assumptions that are true *now* and are expected to remain true, but which the compiler must be prepared to retract. The machinery that permits this retraction is the true subject of this thesis:

- **Deoptimization**: the controlled abandonment of optimized machine code, reconstructing equivalent interpreter-level state at precisely defined *safepoints* [3][9].
- **On-stack replacement (OSR)**: the transfer of execution between optimization levels *in the middle of a frame's lifetime* — interpreting a loop while it runs, or jumping from the interpreter into a newly compiled loop body [9].
- **Speculative guards**: cheap runtime checks that re-validate the assumptions under which code was compiled, triggering deoptimization when the world changes [7].

These mechanisms are load-bearing in every modern high-performance virtual machine, from the JVM's HotSpot server compiler [5] to V8's TurboFan to LuaJIT [9]. Yet they emerged from two architecturally divergent schools. **Method JITs** (HotSpot, Jalapeño [3], V8) compile whole methods through tiered pipelines, recompiling *the same method* at successively higher optimization levels. **Tracing JITs** (TraceMonkey [4], LuaJIT, PyPy [8]) instead record *execution traces* — linear sequences of operations observed at runtime — and compile those, side exits and all.

This thesis compares the two families with mathematical precision, then shows how deoptimization, OSR, and speculative optimization cut across both, and explains the industry's convergence toward tiered method JITs with tracing-like *profile-guided speculation*.

---

## 2 Background

### 2.1 From Static Compilation to Dynamic Translation

Compilation is conventionally partitioned into ahead-of-time (AOT) and just-in-time (JIT) phases. A JIT translates *during* execution, caching the result so subsequent invocations reuse it [1]. The concept predates Java by over a decade. Deutsch and Schiffman demonstrated in 1984 that an efficient Smalltalk-80 system could be built on **dynamic translation** — representing runtime state (both code and data) in more than one form and converting between forms on demand — coupled with the first **inline caches** [2].

Aycock's survey traces the lineage: dynamic translation → adaptive recompilation → the modern JIT, with each generation exploiting richer runtime feedback [1].

### 2.2 The Fundamental JIT Dilemma

Every JIT faces a four-way optimization problem:

1. **When to compile** — too early wastes compile time on cold code; too late delays peak throughput.
2. **What to compile** — whole methods admit global optimization but compile slowly; traces compile fast but capture less context.
3. **How to optimize** — the optimizer must gamble on speculative assumptions (types, class hierarchies, branch outcomes) to produce code competitive with AOT compilers [5].
4. **How to recover** — when a gamble loses, execution must be repaired without violating language semantics. This is deoptimization's job [9].

Formally, let `P` be a program, `Σ` the space of runtime states, and `C_k` a compiler tier. The adaptive system seeks to maximize *steady-state throughput minus compile-time amortization*:

> **Tiered amortized optimality.** Given tiers `C_0 ⊂ C_1 ⊂ ... ⊂ C_n` of increasing optimization power and compilation cost, the policy that compiles method `m` at level `k` once accumulated execution benefit exceeds `cost(C_k)` minimizes total amortized overhead under stationary profiles; non-stationary profiles are handled by recompilation plus deoptimization.

This is the "when" answered by *counters and thresholds* — HotSpot's invocation/backedge counters, Jalapeño's adaptive controller [3] — and the "how to recover" answered by guards and framestates [7].

### 2.3 Inline Caches: The Primitive Feedback Structure

Inline caching, invented by Deutsch and Schiffman [2], exploits the **dynamic locality of type usage**: at any given call site, the receiver class almost always remains constant across executions. A naive dynamic dispatch performs a full method lookup per call; an inline cache rewrites the call instruction to a direct branch, guarded by a class check:

```python
# Conceptual inline cache at a call site (monomorphic state)
def call_site(receiver, *args):
    if receiver.__class__ is cache.expected_class:   # guard
        return cache.cached_target(receiver, *args)   # fast path
    else:
        target = slow_method_lookup(receiver)        # full dispatch
        cache.expected_class = receiver.__class__     # repatch
        cache.cached_target = target
        return target(receiver, *args)
```

As the number of observed receiver classes grows, the cache transitions through a well-known state machine:

| State | Observed classes | Behavior |
|---|---|---|
| Uninitialized | 0 | Full lookup every call |
| Monomorphic | 1 | Single guard + direct call |
| Polymorphic | 2–*k* | Chain/tree of guards |
| Megamorphic | >*k* | Generic stub, no guards worth it |

Inline caches double as **profiling infrastructure**: the recorded types at each site are exactly the *type feedback* that method JITs consume for speculative inlining and devirtualization, and that tracing JITs consume for trace specialization [4].

---

## 3 Methodology

This thesis is a *comparative systems analysis* grounded in the primary literature and in the engineering artifacts of five production systems. Our method:

1. **Literature reconstruction.** We reconstruct design decisions from canonical papers: method JITs from HotSpot [5] and the Jalapeño adaptive optimizer [3]; tracing JITs from TraceMonkey [4] and PyPy's meta-tracing [8]; the speculation substrate from Graal's IR [7] and Truffle [6].
2. **Mechanism decomposition.** We decompose each system into the pipeline *profile → compile → guard → deopt/OSR → recompile*, so families can be compared component by component.
3. **Theoretical characterization.** Key guarantees — deoptimization soundness (Theorem 2), OSR correctness (Theorem 3), trace-tree completeness — stated as precise claims with proof sketches.
4. **Empirical synthesis.** We aggregate published measurements: 10×+ speedups on numeric loops for TraceMonkey [4], tracing pathologies, and the convergence evidence that modern runtimes favor tiered method-based speculation [9].

### 3.1 Taxonomy of Compilation Units

| Family | Unit of compilation | Trigger | Optimizer input | Representative |
|---|---|---|---|---|
| Method JIT (tiered) | Whole method | Invocation/backedge counters | Profile + type feedback | HotSpot C1/C2 [5], V8 |
| Adaptive method JIT | Whole method | Sampling + controller | Edge profiles, call graphs | Jalapeño [3] |
| Tracing JIT | Linear trace (+ trace tree) | Hot loop detection | Recorded guards | TraceMonkey [4], LuaJIT |
| Meta-tracing JIT | Linear trace from interpreter | Interpreter loop detection | Interpreter-level operations | PyPy/RPython [8] |
| AST-partial-evaluation JIT | Interpreter AST nodes | Node specialization | Self-optimizing nodes | Graal/Truffle [6] |

The table already hints at the thesis's central claim: the *unit of compilation* is the independent variable, but *speculation with deoptimization* is the shared substrate [7][9].

---

## 4 Deep Dive

### 4.1 Tiered Method Compilation: The HotSpot Architecture

The Java HotSpot server compiler [5] is the canonical method JIT. Execution begins in the interpreter; hot methods are first compiled by the *client* (C1) compiler — a fast, lightly optimizing compiler performing linear-scan register allocation — and, as heat accumulates, by the *server* (C2) compiler, which applies the full optimization arsenal: class-hierarchy-aware inlining, optimistic constant propagation, global value numbering, optimal instruction selection, and graph-coloring register allocation [5].

The HotSpot server compiler applies the full optimization arsenal: class-hierarchy-aware inlining, optimistic constant propagation, global value numbering, optimal instruction selection, and graph-coloring register allocation [5]. When C2's assumptions break — a class is loaded that invalidates a hierarchy assumption, an uncommon trap fires — execution deoptimizes to the interpreter or a lower tier and the method is queued for recompilation under weaker assumptions [7].

> **Theorem: Deoptimization soundness.** Let `m_opt` be optimized machine code for method `m` compiled under speculative assumptions `A`, with *framestate mappings* recorded at each deoptimization point. If `A` is violated at runtime, the deoptimizer reconstructs an interpreter frame whose observable state equals the state `m`'s source-level semantics require at that program point — *regardless of how aggressively `m_opt` reordered or eliminated code* — provided framestate nodes are total over live values.

*Proof sketch.* Framestate (deopt) nodes in the IR [7] capture the mapping between physical registers/stack slots and source-level locals at every point where a guard may fail. The deoptimizer walks these mappings, materializing eliminated allocations (escape analysis may have scalar-replaced them) and reconstituting locks and monitors, then transfers control to the interpreter at the corresponding bytecode index. Because framestates are computed *before* optimization and preserved through it, they constitute an independent proof of state equivalence. ∎

### 4.2 Tracing JITs: Type Specialization along Hot Paths

Gal et al. presented the definitive formulation of tracing compilation for dynamic languages in TraceMonkey [4]. The design inverts the method JIT's philosophy: instead of asking *"which methods are hot?"* it asks *"which paths are hot?"*

1. **Recording.** The interpreter monitors loop headers. When a loop becomes hot, every executed operation is appended to a linear *trace*, with a **guard** emitted for each dynamic type check or branch taken along the recorded path.
2. **Compilation.** The trace — a straight-line sequence specialized to observed types — is compiled to native code. Because it is linear, optimization is cheap: no CFG construction, simple register allocation.
3. **Side exits.** When a guard fails, execution *side-exits* to the interpreter; frequently taken exits spawn **nested traces**, assembling a *trace tree* covering the hot path space incrementally [4].

The payoff is "cheap inter-procedural type specialization": inlining along a trace is trivial because calls *on the path* are simply recorded through, and polymorphic call sites collapse to the receiver types actually seen. Gal et al. measured **speedups of 10× and more** on numeric benchmarks [4].

But the trace model has a structural weakness the paper itself acknowledges: it compiles *paths*, and real programs branch. Deep call graphs, exceptions, and irregular control flow produce **trace explosion** — an ever-branching tree of short traces whose cumulative compile cost and guard-failure traffic swamp the benefit [9]. Bolz et al.'s meta-tracing work on PyPy [8] generalized the trace recorder to work at the *interpreter* level, elegantly decoupling the JIT from the guest language, but inherits the same path-dependence: meta-traces excel on tight loops and degrade on branchy, dispatch-heavy code [8][9].

```javascript
// Trace recorded for:  for (let i = 0; i < n; i++) sum += a[i] * 2;
// Guards (G) pin the trace to observed types; failure => side exit
//   G0: guard a is DenseArray of doubles
//   G1: guard i < a.length (bounds)
//   G2: guard a[i] is double (hole/type check)
//   t0 = load a[i];  t1 = t0 * 2.0;  sum = sum + t1;  i = i + 1
//   G3: guard i < n  (loop backedge => jump to trace head)
```

The contrast with method JITs is sharpest here: where C2 would inline the loop's callees speculatively and guard the *call sites* [5], TraceMonkey's trace has no call sites left — they were dissolved into the linear path. Simpler to optimize; harder to generalize.

### 4.3 The Shared Substrate: Speculation, Guards, and Deoptimization

Beneath the architectural divergence, method and tracing JITs are instances of one pattern, made explicit by Graal's speculative IR [7] and by modern multi-tier runtimes [9]:

> **Definition (Speculative compilation).** Compilation under *assumptions* `A = {a_1, ..., a_k}` that are *unverifiable statically* (e.g., "this receiver is always class `C`", "this branch is never taken", "no subclass overrides this method"). Each assumption `a_i` is protected by a **guard**: a cheap runtime check. Guard failure triggers **deoptimization** to a less-optimized execution mode where `A` is not required [7].

Guards appear in every family:

- **Method JITs**: class-hierarchy guards before inlined virtual calls [5]; uncommon traps in HotSpot that count rare events and, beyond a threshold, force deoptimization and recompilation [5]; null checks, bounds checks, and type checks emitted by C2's optimistic passes.
- **Tracing JITs**: every type assumption along the trace is a guard; every branch outcome a guard; side exits are the deoptimization mechanism [4][8].
- **Truffle/Graal**: self-optimizing AST nodes specialize on observed types and install guards; on guard failure the node *generalizes itself*, and the partial evaluator recompiles — speculation and deoptimization unified at the interpreter level [6].

Duboscq et al. formalize this in Graal's IR: *framestate nodes* anchor deoptimization points, and the compiler treats speculation as a first-class IR concept, with explicit modeling of which assumptions protect which optimized regions [7]. This is the modern answer to the "how to recover" question of §2.2 — and it is why Graal can optimize across language boundaries in the Truffle framework: assumptions are about *values*, not about any one language's semantics [6].

### 4.4 On-Stack Replacement: Changing Tiers Mid-Flight

Deoptimization is the *downward* transition; OSR is the *bidirectional* one. On-stack replacement transfers execution between representations of the same method **while a frame is live** [9]:

- **OSR entry (up)**: a long-running interpreted loop triggers compilation; the compiled loop body is entered *at the current iteration*, with locals mapped into registers. Without OSR entry, a program spending 99% of its time in one hot loop would never benefit from compilation until the next invocation — catastrophic for servers and scientific code [3][9].
- **OSR exit (down)**: guard failure or an explicit deoptimization request exits compiled code to the interpreter, reconstructing the frame [7].
- **OSR for debugging**: Self pioneered deoptimizing optimized frames to expose full debugging state, then re-optimizing afterward — "full-speed debugging" [9].

> **Theorem: OSR correctness.** OSR entry/exit is semantics-preserving iff the compiler can establish a *state mapping* between the source frame `(pc, locals, operand stack)` and the target representation at the transfer point, and the transfer point is a *safepoint* where no speculative state is observably in flight.

In practice, safepoints coincide with deoptimization points: loop backedges, method calls, and allocation sites — exactly the places where the GC and the deoptimizer already need consistent state [5][7]. Jalapeño's adaptive system used OSR-driven recompilation to *replace running methods* with more optimized versions as profiles matured, completing the adaptive loop: profile → compile → run → re-profile → recompile [3].

### 4.5 Why the Industry Converged on Tiered Method JITs

The historical record shows a clear arc [1][9]:

1. **1980s–90s**: Dynamic translation (Smalltalk [2]) and adaptive Self pioneered inline caches, type feedback, and deoptimization.
2. **2000s**: Tiered method JITs dominate managed runtimes (HotSpot [5], Jalapeño [3]); tracing JITs demonstrate that *path-based* speculation can beat method JITs on numeric code with far less engineering [4][8].
3. **2010s–present**: Convergence. V8 layered Turbofan (a speculative method JIT) over the older Crankshaft; tracing-only engines stagnated or were retired as general-purpose solutions. The reason is empirical and structural: method JITs with *aggressive speculative inlining* capture most of tracing's type-specialization wins (C2 inlines along hot call paths using the same inline-cache data [2][5]), while retaining whole-method control flow for branchy code that traces cannot cover efficiently [9].

The Deegen analysis states the lesson bluntly: multi-tier JITs with OSR-exit/deoptimization are now the standard precisely because they bound the worst case — a failed speculation costs a deoptimization, not a trace-tree explosion — while single-tier and tracing designs have "uneven (workload-dependent) and less predictable performance" [9].

The synthesis is not that tracing lost, but that *tracing's insights won everywhere*: every modern method JIT performs trace-like specialization *within* its optimizer — linearizing hot paths, guarding types, side-exiting uncommon cases — using framestate-based deoptimization as the safety net [7]. The unit of compilation stayed the method; the unit of *optimization* became the hot path. Tracing JITs were the research vehicle that proved speculation could be cheap; method JITs were the production vehicle that proved it could be general.

---

## 5 Empirical Evaluation and Proofs

### 5.1 What the measurements show

### 5.2 Analytical comparison

| Criterion | Method JIT (tiered) | Tracing JIT |
|---|---|---|
| Compile latency | High (whole method) | Low (linear trace) |
| Peak throughput (numeric loops) | Excellent | Excellent [4] |
| Branchy / dispatch-heavy code | Good (whole CFG) | Poor (trace explosion) [9] |
| Startup / warmup | Slow (tiered) | Fast |
| Speculation mechanism | Guards + uncommon traps [5] | Trace guards + side exits [4] |
| Recovery mechanism | Deoptimization via framestates [7] | Side exit to interpreter [8] |
| Mid-frame tier change | OSR entry/exit [3][9] | Nested trace linking [4] |
| Engineering cost | Very high | Moderate |

> **Theorem: Speculation dominance.** For any program whose hot region is a single loop with `t` distinct dynamic types, tracing achieves the same asymptotic steady-state performance as an optimal method JIT with per-site type specialization, at `O(t)` trace compilations. For programs whose hot region spans `b` independent branches, tracing requires up to `O(2^b)` trace compilations in the worst case, while a method JIT requires `O(1)`.

*Proof sketch.* The trace compiler specializes one path per compilation; `b` independent binary branches admit `2^b` distinct hot paths, each needing its own trace (or a generalizing exit). The method JIT compiles the CFG once and guards the *values*, not the paths. ∎

This theorem is the formal core of the thesis: it explains both TraceMonkey's triumphs (numeric kernels: `b ≈ 0`) and the field's convergence (real applications: `b` large) [4][9].

---

## 6 Limitations

Honesty requires stating what this analysis does *not* settle:

1. **Warmup pathology.** Tiered method JITs remain notorious for slow warmup: short-lived processes (CLI tools, serverless functions) may never reach peak tiers, making AOT or single-tier baseline compilation preferable. Tracing's fast warmup is a genuine, if narrow, advantage [9].
2. **Non-determinism and security.** Speculative optimization introduces timing-dependent performance (and, in the worst case, speculative-execution side channels at the hardware level). Guard placement interacts with microarchitectural speculation in ways no current JIT model fully characterizes.
3. **Memory cost of speculation metadata.** Framestates, inline-cache maps, and deoptimization tables are pure overhead; on memory-constrained devices this tax motivated entirely different designs.
4. **Deoptimization storms.** When assumptions are *systematically* wrong — a phase change in program behavior — the VM can thrash: compile, deoptimize, recompile, deoptimize. Jalapeño-style controllers mitigate this with backoff, but the pathology is fundamental to speculation [3].

---

## 7 Conclusion

---

## References

[1] Aycock, J. (2003). "A Brief History of Just-in-Time". *ACM Computing Surveys*, 35(2), 97–113. https://doi.org/10.1145/857076.857077

[2] Deutsch, L. P., & Schiffman, A. M. (1984). "Efficient Implementation of the Smalltalk-80 System". *Proc. 11th ACM SIGACT-SIGPLAN Symposium on Principles of Programming Languages (POPL '84)*, 297–302. https://doi.org/10.1145/800017.800542

[3] Arnold, M., Fink, S., Grove, D., Hind, M., & Sweeney, P. F. (2000). "Adaptive Optimization in the Jalapeño JVM". *Proc. ACM SIGPLAN Conference on Object-Oriented Programming, Systems, Languages, and Applications (OOPSLA 2000)*. http://www.cs.williams.edu/~freund/cs434/arnold-jit.pdf

[4] Gal, A., Eich, B., Shaver, M., Anderson, D., Mandelin, D., Haghighat, M. R., Kaplan, B., Hoare, G., Zbarsky, B., Orendorff, J., Ruderman, J., Smith, E. W., Reitmaier, R., Bebenita, M., Chang, M., & Franz, M. (2009). "Trace-based Just-in-Time Type Specialization for Dynamic Languages". *Proc. 30th ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI '09)*, 465–478. https://doi.org/10.1145/1542476.1542528

[5] Paleczny, M., Vick, C., & Click, C. (2001). "The Java HotSpot Server Compiler". *Proc. Java Virtual Machine Research and Technology Symposium (JVM '01)*, USENIX Association. https://www.usenix.org/legacy/event/jvm01/paleczny.html

[6] Würthinger, T., Wimmer, C., Wöß, A., Stadler, L., Duboscq, G., Humer, C., Richards, G., Simon, D., & Wolczko, M. (2013). "One VM to Rule Them All". *Proc. 2013 ACM International Symposium on New Ideas, New Paradigms, and Reflections on Programming & Software (Onward! 2013)*. https://doi.org/10.1145/2509578.2509581

[7] Duboscq, G., Stadler, L., Würthinger, T., Simon, D., Wimmer, C., & Mössenböck, H. (2013). "An Intermediate Representation for Speculative Optimizations in a Dynamic Compiler". *Proc. 7th ACM Workshop on Virtual Machines and Intermediate Languages (VMIL '13)*. https://doi.org/10.1145/2542142.2542143

[8] Bolz, C. F., Cuni, A., Fijalkowski, M., & Rigo, A. (2009). "Tracing the Meta-level: PyPy's Tracing JIT Compiler". *Proc. 4th Workshop on the Implementation, Compilation, Optimization of Object-Oriented Languages, Programs and Systems (ICOOOLPS '09)*. https://doi.org/10.1145/1565824.1565827

[9] Deegen Contributors (2024). "Deegen: A JIT-Capable VM Generator for Dynamic Languages". *arXiv:2411.11469*. https://arxiv.org/html/2411.11469v1

