---
id: symbolic-execution-klee-7e3b
title: "Symbolic Execution and Concolic Testing: Constraint Solving, Path Explosion Mitigation, and the KLEE Architecture"
anon: anon#2944
ts: 1788886202000
type: thesis
---

# Symbolic Execution and Concolic Testing: Constraint Solving, Path Explosion Mitigation, and the KLEE Architecture

## Abstract

Symbolic execution treats program inputs as algebraic symbols rather than concrete values, systematically enumerating the space of feasible execution paths and generating test inputs by discharging path constraints through a decision procedure. This thesis presents a rigorous treatment of *dynamic* symbolic execution — **concolic testing**, in which a concrete execution shadows the symbolic one — tracing the lineage from King's foundational 1976 formalization [1] through the modern tooling era inaugurated by DART [3], CUTE [4], and EXE [6], and culminating in a deep architectural analysis of KLEE [2], the open-source LLVM-based engine that demonstrated high-coverage test generation on 89 GNU Coreutils programs. We formalize the path-condition calculus, analyze the complexity of constraint solving over the theory of bit-vectors and arrays, taxonomize path-explosion countermeasures — search heuristics, state merging, constraint independence, and read-write set analysis [7] — and examine SAGE's generational search that scaled whitebox fuzzing to over one billion constraints [5]. Empirical results, soundness theorems, and a frank account of the method's limits in the presence of environment interactions, floating-point arithmetic, and cryptographic code complete the treatment.

---

## 1 Introduction

Testing is the dominant quality-assurance practice in industrial software, yet the inputs that trigger real failures inhabit vanishingly small regions of the input space. Random testing samples this space blindly; a buffer overflow guarded by a four-byte magic constant is found by a uniform random fuzzer with probability $2^{-32}$, effectively never. *Symbolic execution* attacks this problem from the opposite direction: rather than guessing inputs, it reasons about them.

The classical formulation, due to King [1], replaces concrete inputs with *symbolic variables* $\alpha_1, \dots, \alpha_n$ and executes over a symbolic store $\sigma : \mathrm{Var} \rightarrow \mathrm{Expr}$. At each branch on a symbolic predicate $c$, execution forks: one successor assumes $c$, the other $\neg c$. The conjunction of branch predicates along a path — the **path condition** $\pi$ — is a formula whose models are exactly the inputs driving execution down that path. A constraint solver then inverts the mapping from paths to inputs.

Pure ("static") symbolic execution suffers from two chronic ailments: it cannot cope with *uninstrumentable* operations (system calls, floating-point transcendentals, inline assembly), and its symbolic store diverges from the semantics of complex environment interactions. **Concolic testing** — a portmanteau of *concrete* and *symbolic* introduced by Sen, Marinov, and Agha in the CUTE system [4] — remedies this by maintaining a concrete execution that the symbolic one shadows. When the symbolic engine encounters an operation it cannot model precisely, it *concretizes*: it substitutes the observed concrete value, preserving soundness of the *current* path at the cost of completeness elsewhere. This single maneuver made symbolic execution practical enough to ship: Microsoft's SAGE whitebox fuzzer ran 24/7 on over a hundred cores and processed more than a billion constraints, finding roughly one-third of all file-fuzzing bugs during Windows 7 development [5].

## 2 Background

### 2.1 Classical Symbolic Execution

King's 1976 paper defined symbolic execution as an extension of ordinary operational semantics [1]. Given a program $P$ and symbolic inputs $\vec{\alpha}$, a *symbolic state* is a triple $(\ell, \sigma, \pi)$ where $\ell$ is the program location, $\sigma$ maps variables to symbolic expressions, and $\pi$ is the path condition. The transition rules are deterministic except at branches:

> **Theorem (Path-condition characterization).** *For a loop-free program with decidable branch predicates, an input $\vec{v}$ follows symbolic path $\rho$ with final path condition $\pi_\rho$ if and only if $\vec{v} \models \pi_\rho$.*

Proved by induction on the length of $\rho$: each branch appends precisely its taken condition to $\pi$. The corollary drives test generation — to execute path $\rho$, solve for any $\vec{v} \models \pi_\rho$ — and the field's history is largely the engineering of this corollary.

### 2.2 The Dynamic Turn: DART, CUTE, EXE

Three systems, developed independently around 2005, defined modern dynamic symbolic execution:

- **DART** (Directed Automated Random Testing) [3] combined automatic interface extraction via static parsing, a generated test driver performing random testing, and *dynamic* analysis collecting constraints along the executed path, systematically negating them to steer toward alternative paths (default solver: `lp_solve`).
- **CUTE** [4] extended the idea to *memory graphs*: C unit inputs may be linked data structures, so CUTE built a novel solver for arithmetic *and pointer constraints*, generating heap shapes lazily. The paper coined *concolic testing*.
- **EXE** (Cadar and Engler; KLEE's ancestor) [6] modeled the *entire environment* symbolically — files, sockets, arguments — introducing mixed concrete-symbolic execution with under-constrained symbolic variables.

| System | Year | Venue | Key innovation |
|--------|------|-------|----------------|
| DART [3] | 2005 | PLDI | Directed search from random seeds; interface extraction |
| CUTE [4] | 2005 | ESEC/FSE | Coined "concolic"; memory-graph / pointer constraints |
| EXE [6] | 2006 | CCS | "Inputs of death"; symbolic environment; STP solver |
| KLEE [2] | 2008 | OSDI | LLVM-based; query optimization; 90%+ Coreutils coverage |
| SAGE [5] | 2008 | NDSS | x86 binary tracing; generational search; 1B+ constraints |

### 2.3 Constraint Solving Foundations

Path conditions are formulas in a *decidable fragment* of first-order logic. Bit-precise reasoning about machine integers demands the theory **QF_ABV** — quantifier-free bit-vectors and arrays. The canonical solver lineage runs through STP [8], later joined by Z3. Deciding QF_ABV is NP-complete, so the solver is the throughput bottleneck of every symbolic engine — motivating the query-optimization apparatus of Section 4.

---

## 3 Methodology

### 3.1 The Concolic Execution Loop

Concolic testing interleaves one concrete run with its symbolic shadow. Let $P$ be the program under test and $\vec{x}_0$ an initial concrete input (random or well-formed). The algorithm proceeds as follows:

1. **Execute concretely** on $\vec{x}_i$, instrumenting operations on input-derived values.
2. **Collect the path constraint** $\Phi = \langle \phi_1, \dots, \phi_k \rangle$: symbolic branch predicates encountered, each paired with its concrete truth value.
3. **Negate systematically**: for some $j \le k$, form $\Phi_j = \phi_1 \land \dots \land \phi_{j-1} \land \neg\phi_j$.
4. **Solve**: query the SMT solver for $\vec{x}_{i+1} \models \Phi_j$. If satisfiable, the new input follows the path diverging at branch $j$ (modulo concretization, §3.2).
5. **Iterate** until a coverage criterion, time budget, or path bound is exhausted; report crashes, assertion violations, and hangs.

```python
def concolic_loop(program, seed, budget):
    worklist = [seed]
    explored, crashes = set(), []
    while worklist and budget > 0:
        x = worklist.pop()
        trace, pcs = execute_shadowed(program, x)
        for j, phi in enumerate(pcs):
            cand = solve(pcs[:j] + [Not(phi)])
            if cand is not None and cand not in explored:
                worklist.append(cand)
        if trace.crashed:
            crashes.append(x)
        budget -= 1
    return crashes
```

The loop is *sound for bug-finding on explored paths*: any crash observed on the concrete run is a genuine defect, reproducible by re-running the crashing input. It is *incomplete* in general — the search space is infinite for programs with unbounded loops — so practical systems bound loop iterations and rely on search heuristics (§4.3).

### 3.2 Concretization and the Symbolic/Concrete Boundary

The defining engineering move of concolic testing is **concretization**: when the symbolic engine cannot model an operation $f$ (a system call, `sin()`, inline assembly), it replaces the symbolic expression with the concrete value observed during execution. Formally, if the symbolic state maps $v \mapsto e(\vec{\alpha})$ and the concrete store has $v = c$, the engine substitutes $e := c$ for subsequent reasoning. This keeps execution *locally consistent* — the symbolic path condition still describes the concrete path taken — but sacrifices the ability to generate inputs that steer *through* the unmodeled operation. CUTE [4] and DART [3] both concretize aggressively at library boundaries; KLEE [2] instead models a substantial POSIX subset (files, sockets, environment) symbolically to push the boundary outward.

### 3.3 The Solver Pipeline

Raw path conditions contain redundant conjuncts and repeated subexpressions. KLEE's pipeline [2] transforms them before any query reaches the solver:

1. **Expression rewriting** — constant folding and algebraic simplification, applied canonically so structurally equal expressions hash identically.
2. **Constraint-set simplification** — dropping implied or duplicate conjuncts from $\pi$.
3. **Implied-value concretization** — if $\pi \models (x = c)$, substitute $c$ for $x$ everywhere.
4. **Constraint independence** — partition $\pi$ into independent subsets; a query about branch $j$ needs only the subset mentioning $\phi_j$'s variables. This is the single most effective optimization: most queries touch a tiny slice of $\pi$.
5. **Counter-example cache** — memoize solver results; a *superset* hit yields UNSAT immediately, a *subset* hit yields a cached model.

The KLEE authors report these optimizations reduce solver time to roughly **one-fifteenth** of the unoptimized baseline [2].

---

## 4 Deep Dive

### 4.1 The Theory of Bit-Vectors and Arrays

All precision in symbolic execution of C binaries flows from one logical theory: **QF_ABV**, quantifier-free bit-vectors with extensional arrays. A machine integer of width $w$ is a vector $\langle b_{w-1}, \dots, b_0 \rangle$; arithmetic is modular ($x + y \bmod 2^w$), matching two's-complement hardware exactly. Memory is an array $M : \mathrm{BV}_{32} \rightarrow \mathrm{BV}_8$ governed by McCarthy's axioms: $\mathrm{read}(\mathrm{write}(M, i, v), i) = v$, and $i \neq j \implies \mathrm{read}(\mathrm{write}(M, i, v), j) = \mathrm{read}(M, j)$.

STP [8] decides this theory by *bit-blasting*: translating bit-vector operations into propositional circuits and delegating to a SAT solver, with array axioms handled by eager or lazy instantiation. The translation is worst-case exponential in formula size — which is why path conditions must be *sliced* (§3.3, item 4) before solving. Modern engines additionally exploit *incremental solving*: successive queries $\Phi_j$ and $\Phi_{j+1}$ share a large common prefix, so push/pop solver scopes reuse learned clauses across the concolic loop.

### 4.2 Path Explosion: Taxonomy of Countermeasures

The fundamental complexity barrier is **path explosion**: $n$ sequential symbolic branches admit up to $2^n$ paths, and loops multiply this further. The field's response is a taxonomy of *search-space reductions*, each trading completeness for tractability:

| Countermeasure | Mechanism | Completeness cost |
|----------------|-----------|-------------------|
| Loop bounding | Unroll loops at most $k$ times | Misses bugs requiring $>k$ iterations |
| State merging | Join states at merge points; $\pi = \pi_1 \lor \pi_2$ | Disjunctions burden the solver; may blow up formulas |
| Constraint independence | Solve per-query minimal subsets | None (pure optimization) |
| RWset analysis [7] | Skip branches provably irrelevant to assertions | None for targeted properties |
| Veritesting / merging | Static symbolic execution of straight-line regions | Path merging loses per-path precision |
| Search heuristics (§4.3) | Prioritize promising states under a budget | Incomplete by design |

**State merging** is the most theoretically elegant countermeasure: when two symbolic states reach the same program point, they are replaced by one state whose store maps each variable to an `ite` expression over the disjoined path conditions. Solver queries drop, but formulas grow — merging pays only when the merged constraints stay solver-friendly [2].

**RWset** (read-write set) analysis [7] attacks explosion from the property side: given a target assertion, it computes the set of memory locations the assertion's outcome can depend on, and prunes any branch that cannot affect those locations. For assertion-directed testing this is *lossless* — pruned paths cannot reveal new violations of the target — and the TACAS'08 paper demonstrated order-of-magnitude reductions on systems code.

> **Theorem (RWset pruning soundness).** *Let $A$ be an assertion and $\mathcal{R}(A)$ its read-write set. If symbolic branch $b$ writes no location in $\mathcal{R}(A)$ and reads none, then exploring only one successor of $b$ preserves the set of assertion violations reachable on all paths.*

The proof follows from a straightforward non-interference argument: the two successors agree on all state observable by $A$, so their violation behaviors coincide.

### 4.3 Search Heuristics: Choosing Which State Lives

Because exhaustive exploration is impossible, every engine is really a *scheduler* over a frontier of symbolic states. KLEE [2] pioneered a portfolio of competing heuristics, run in round-robin fashion so that no single strategy's pathology dominates:

1. **Random path selection** — descend the execution tree choosing randomly at each fork, defeating the systematic starvation of depth-first search.
2. **Coverage-guided (closest-to-uncovered)** — prioritize states nearest uncovered code in the static CFG; greedily maximizes new coverage per solver query.
3. **Counter-based** — prefer states at rarely-visited instructions; approximates novelty search.
4. **Depth / BFS interleaving** — bounded breadth-first waves exhaust shallow behaviors before the frontier drifts deep.

SAGE [5] replaced this portfolio with **generational search**, designed for a different economy: symbolic execution of a 100M-instruction trace is so expensive that each run must yield *thousands* of new inputs, not one. Given path constraint $\langle \phi_1, \dots, \phi_k \rangle$, generational search negates *every* $\phi_j$, conjoins each negation with its prefix, and solves all of them — producing a whole *generation* of children per parent. A coverage-maximizing heuristic then orders the next generation. This single algorithmic choice scaled dynamic test generation from units to full Windows applications [5].

### 4.4 The KLEE Architecture

KLEE [2] is an *interpreter* over LLVM bitcode — buying type information and SSA form at the cost of requiring source. Its components:

- **Executor**: the core interpreter loop. Maintains active `ExecutionState` objects — $(\ell, \sigma, \pi)$ triples with copy-on-write memory for cheap forking. On a symbolic branch it queries the solver for each successor's feasibility, forking only feasible ones: *infeasible paths are never explored*.
- **Memory model**: allocations are the unit of symbolic reasoning; pointers are `(object, offset)` pairs, so out-of-bounds accesses are detected precisely.
- **Searcher portfolio**: the §4.3 heuristics, implemented as composable `Searcher` classes.
- **Solver chain**: `TimingSolver` → `CachingSolver` → `IndependentSolver` → `STP`/`Z3` — decorator layers physically embodying §3.3.
- **POSIX runtime model**: a symbolic file system, sockets, and environment variables linked with the bitcode, so `open`/`read` on symbolic paths yield symbolic contents rather than forcing concretization.

```c
/* KLEE-style symbolic input declaration (klee_make_symbolic) */
#include <klee/klee.h>
int main() {
    char buf[8];
    klee_make_symbolic(buf, sizeof(buf), "buf");
    if (buf[0]=='b' && buf[1]=='a' && buf[2]=='d' && buf[3]=='!')
        klee_assert(0);   /* reachable iff input starts with "bad!" */
    return 0;
}
```

The empirical headline of [2]: on 89 Coreutils programs, KLEE-generated tests averaged **over 90% line coverage** (median over 94%), beating the developers' hand-written suites, and found 56 serious bugs across 452 applications — including three Coreutils defects latent for 15 years.

### 4.5 Compositional and Whitebox-Fuzzing Extensions

Two extensions generalized the single-program concolic loop. **Compositional dynamic test generation** [10] computes *function summaries* — disjunctions of path constraints relating inputs to outputs — so callees are analyzed once and reused at every call site, taming interprocedural explosion.

**Whitebox fuzzing** [5] starts from a *well-formed seed input*, traces the program at the x86 instruction level (no source needed), and applies generational search. The reported scale — hundreds of applications, 100+ cores continuously since 2008, over a billion SMT constraints — made concolic techniques *infrastructure*, and the NDSS'08 paper received the 2022 Test of Time award.

---

## 5 Empirical Evaluation and Proofs

### 5.1 Soundness Properties

> **Theorem (Bug soundness).** *Any crash, assertion violation, or hang observed during a concolic run is reproducible: re-executing the program on the reported concrete input reproduces the failure deterministically (for deterministic programs).*

> **Theorem (Path-condition fidelity).** *In the absence of concretization, the set of inputs satisfying path condition $\pi_\rho$ is exactly the set of inputs executing path $\rho$.*

> **Theorem (Relative completeness).** *For loop-free programs over decidable theories with no concretization, systematic negation of all path constraints enumerates all feasible paths.*

The third theorem is the theoretical ceiling; practical deployments violate its hypotheses, so the field reports *coverage achieved*, not *coverage guaranteed*. The honest metric, used by KLEE [2] and SAGE [5] alike, is line/branch coverage attained within a fixed time budget versus a baseline (human tests, random fuzzing).

### 5.2 Quantitative Landscape

| System / study | Target | Result |
|----------------|--------|--------|
| KLEE [2] | 89 Coreutils utilities | >90% mean line coverage; 56 bugs in 452 apps |
| KLEE [2] | 75 BusyBox utilities | 100% coverage on 31 tools |
| SAGE [5] | Windows 7 file parsers | ~1/3 of all file-fuzzing bugs; 1B+ constraints |
| SAGE ANI case [5] | `ani` parser | Crashing input in 7h36m, 7,706 test cases |
| CUTE [4] | C data-structure units | Memory-graph inputs; branch coverage vs. random |
| DART [3] | C examples (oSIP etc.) | Detected crashes/assertion violations automatically |

The ANI-parser case study is instructive about cost: 7.6 hours of single-core symbolic execution to find one crashing input — cheap compared to a security bulletin, expensive compared to a fuzzer's millions of executions per hour. This cost asymmetry is why modern practice *hybridizes*: coverage-guided greybox fuzzers for breadth, concolic engines for the narrow guarded branches fuzzers cannot penetrate.

---

## 6 Limitations

1. **Environment and system calls.** Interactions the engine cannot model — network I/O with timing dependence, GPU kernels, proprietary syscalls — force concretization, silently blinding the search beyond that point. KLEE's POSIX model [2] covers files and sockets but not `ioctl` dispatch tables or thread interleavings.

2. **Floating-point arithmetic.** QF_FP is decidable but dramatically more expensive than QF_ABV; most engines concretize float operations, so control flow depending on floats (scientific code, graphics) is poorly served.

3. **Cryptographic and hash-dependent code.** A branch on `sha256(input) == target` yields a path constraint no SMT solver will invert. Concolic testing degrades to random testing on such guards — a fundamental limitation: inverting the constraint *is* breaking the hash.

4. **Path explosion is managed, not solved.** Loop bounding, merging, and heuristics (§4.2–4.3) are incomplete by design; deeply nested state machines and unbounded protocol sessions remain hard.

5. **Solver unpredictability.** A single pathological query can stall the engine for minutes; timeouts convert these to implicit concretization with unpredictable coverage consequences, and solver performance is version-sensitive, complicating reproducibility.

6. **Concurrency.** Symbolically reasoning about thread interleavings multiplies path explosion by the schedule space; industrial-strength handling of weak memory models remains an open frontier.

7. **Interpretation overhead.** KLEE interprets LLVM IR; SAGE traces and replays x86. Both pay 10–1000× slowdowns versus native execution — which is why concolic engines are deployed *after* cheap fuzzers, on the hardened remainder.

---

## 7 Conclusion

Symbolic execution has traveled from King's elegant 1976 formalization [1] — a semantics paper with no solver to call — to industrial infrastructure processing billions of constraints [5]. The pivotal steps were the *dynamic turn* (DART [3], CUTE [4], EXE [6]), which traded unattainable precision for engineering-real bug-finding through concretization; the *solver pipeline* (KLEE [2]), which made SMT throughput match systems-code scale; the *search-strategy revolution* (generational search [5]), which scaled the technique from units to applications; and the *theory work* (STP [8], QF_ABV) grounding it all in bit-precise logic.

The central tension remains: symbolic execution is the only testing technique that *reasons* about which inputs reach which code, yet the reasoning is exponential in the worst case and the solver is an unpredictable oracle. The pragmatic resolution — hybrid fuzzing pipelines where concolic engines solve exactly the narrow constraints that blind mutation cannot — is now the industry standard, and the frontier has moved to compositional summaries, solver-friendly state merging, and learned search guidance. The path condition, fifty years on, is still the sharpest lens we have on the relationship between inputs and behavior.

---

## References

[1] James C. King. "Symbolic Execution and Program Testing." *Communications of the ACM*, 19(7):385–394, 1976. https://doi.org/10.1145/360248.360252

[2] Cristian Cadar, Daniel Dunbar, Dawson Engler. "KLEE: Unassisted and Automatic Generation of High-Coverage Tests for Complex Systems Programs." *Proc. 8th USENIX Symposium on Operating Systems Design and Implementation (OSDI'08)*, pp. 209–224, San Diego, CA, 2008. https://www.usenix.org/legacy/event/osdi08/tech/full_papers/cadar/cadar.pdf

[3] Patrice Godefroid, Nils Klarlund, Koushik Sen. "DART: Directed Automated Random Testing." *Proc. ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI'05)*, pp. 213–223, Chicago, IL, 2005. https://doi.org/10.1145/1065010.1065036

[4] Koushik Sen, Darko Marinov, Gul Agha. "CUTE: A Concolic Unit Testing Engine for C." *Proc. 10th European Software Engineering Conference / 13th ACM SIGSOFT Symposium on Foundations of Software Engineering (ESEC/FSE'05)*, pp. 263–272, Lisbon, Portugal, 2005. https://doi.org/10.1145/1081706.1081750

[5] Patrice Godefroid, Michael Y. Levin, David Molnar. "Automated Whitebox Fuzz Testing." *Proc. Network and Distributed System Security Symposium (NDSS'08)*, San Diego, CA, 2008. https://www.ndss-symposium.org/ndss2008/automated-whitebox-fuzz-testing/

[6] Cristian Cadar, Vijay Ganesh, Peter M. Pawlowski, David L. Dill, Dawson R. Engler. "EXE: Automatically Generating Inputs of Death." *Proc. 13th ACM Conference on Computer and Communications Security (CCS'06)*, pp. 322–335, Alexandria, VA, 2006. https://doi.org/10.1145/1180405.1180445

[7] Peter Boonstoppel, Cristian Cadar, Dawson Engler. "RWset: Attacking Path Explosion in Constraint-Based Test Generation." *Proc. 14th International Conference on Tools and Algorithms for the Construction and Analysis of Systems (TACAS'08)*, LNCS 4963, pp. 351–366, Budapest, Hungary, 2008. https://link.springer.com/chapter/10.1007/978-3-540-78800-3_27

[8] Vijay Ganesh, David L. Dill. "A Decision Procedure for Bit-Vectors and Arrays." *Proc. 19th International Conference on Computer Aided Verification (CAV'07)*, LNCS 4590, pp. 519–531, Berlin, Germany, 2007. https://doi.org/10.1007/978-3-540-73368-3_52

[9] Cristian Cadar, Koushik Sen. "Symbolic Execution for Software Testing: Three Decades Later." *Communications of the ACM*, 56(2):82–90, 2013. https://doi.org/10.1145/2408776.2408795

[10] Patrice Godefroid. "Compositional Dynamic Test Generation." *Proc. 34th ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages (POPL'07)*, pp. 47–54, Nice, France, 2007. https://doi.org/10.1145/1190216.1190226

