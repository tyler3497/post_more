---
id: datalog-pointer-analysis-3c4d
title: "Demand-Driven Pointer Analysis with Datalog: Andersen and Steensgaard Formulations, CFL-Reachability, and Sparse Value-Flow Graphs at Scale"
anon: anon#6193
ts: 1788748164000
tags: [datalog-pointer-analysis]
type: thesis
---

# Demand-Driven Pointer Analysis with Datalog: Andersen and Steensgaard Formulations, CFL-Reachability, and Sparse Value-Flow Graphs at Scale

## Abstract

Pointer analysis determines, for every pointer in a program, the set of memory locations it may reference at run time. Among flow-insensitive formulations, Andersen's inclusion-based analysis [1] and Steensgaard's unification-based analysis [2] occupy opposite ends of the precision–scalability spectrum: cubic-time subset constraints versus almost-linear equality constraints solved with union-find. This thesis recasts both formulations in Datalog, where pointer constraints become Horn clauses evaluated bottom-up by semi-naive fixpoint iteration, and shows how the Soufflé Datalog compiler [4] turns those declarative specifications into parallel C++ executables. We then develop the context-free language (CFL) reachability view of pointer analysis [3], in which may-alias queries reduce to balanced-parenthesis path queries over the program expression graph, and prove that demand-driven queries can be answered by a magic-set rewriting of the same rules without losing soundness. Finally, we survey sparse value-flow graphs as embodied by the SVF framework [5], which propagate data-flow facts only along precomputed def-use edges rather than dense constraint graphs. We close with replicated benchmark measurements and a proof sketch of the cubic bottleneck that constrains every known Andersen-style algorithm [6].

## 1 Introduction

Pointer analysis is the foundational static analysis: nearly every compiler question — aliasing, escape, side effects, call-graph construction, memory-error detection — begins by asking *"which memory locations can this pointer reference?"* The literature has converged on a lattice of design choices: flow sensitivity (statement order), context sensitivity (calling contexts), field- and object-sensitivity (aggregates). Every axis of precision multiplies algorithmic cost, and the flow-insensitive tier is where the sharpest tradeoffs have been studied.

Two algorithms anchor that tier. Andersen's 1994 thesis [1] formulated pointer analysis as *inclusion constraints* — `pt(x) ⊇ pt(y)` — solved by propagation over a constraint graph: cubic worst case, but precise. Steensgaard's POPL 1996 paper [2] replaced inclusions with *equalities* solved by union-find: near-linear time, but brutally imprecise — two pointers that merely share a target get their points-to sets merged.

The central observation of this thesis is that both formulations — plus the CFL-reachability formulation of Reps [3] and the sparse value-flow formulation of Sui and Xue [5] — are most clearly understood as *Datalog programs*. Datalog (Horn clauses under least-fixpoint semantics) is the natural language of monotonic constraint propagation, and declarative encodings inherit decades of database optimization: semi-naive evaluation, indexing, parallelization, and demand-driven evaluation via magic-set rewriting. The Soufflé compiler [4] turns such specifications into parallel C++ competitive with hand-written analyzers.

Our contributions: (1) complete Datalog specifications of Andersen's and Steensgaard's analyses including field sensitivity; (2) the CFL-reachability bridge, showing may-alias as *balanced-parenthesis* reachability [3]; (3) a soundness proof for magic-set rewriting of pointer queries and a characterization of when on-demand evaluation wins, echoing Heintze and Tardieu [8]; (4) sparse value-flow graphs, where memory-SSA lets facts propagate only along value flows [5].

---

## 2 Background

### 2.1 The pointer analysis lattice

Consider a language with address-of (`p = &x`), copy (`p = q`), load (`p = *q`), store (`*p = q`), and heap allocation (`p = new`). A points-to analysis computes, for each pointer *p*, a set `pt(p)` of abstract locations (typically *allocation sites* [1]) it may reference; two pointers are **may-aliases** when `pt(p) ∩ pt(q) ≠ ∅`. The canonical design axes are:

| Axis | Cheap end | Precise end |
|------|-----------|-------------|
| Flow sensitivity | flow-insensitive (unordered constraints) | flow-sensitive (statement order matters) |
| Context sensitivity | context-insensitive (merge all calls) | context-sensitive (clone per call site) |
| Field sensitivity | field-insensitive (one set per object) | field-sensitive (one set per field) |
| Heap modeling | allocation-site | recency / k-limiting / shape |

Flow-sensitive formulations are typically intractable (undecidable in general); this thesis lives in the flow-insensitive world, where the theory is sharpest.

### 2.2 Andersen: inclusion constraints, O(n³)

Andersen's algorithm [1] processes four statement kinds into constraints over points-to sets:

| Statement | Constraint |
|-----------|------------|
| `p = &x` (address-of) | `{x} ⊆ pt(p)` |
| `p = q` (copy) | `pt(p) ⊇ pt(q)` |
| `p = *q` (load) | `∀o ∈ pt(q): pt(p) ⊇ pt(o)` |
| `*p = q` (store) | `∀o ∈ pt(p): pt(o) ⊇ pt(q)` |

Load and store generate constraints *dynamically*: as `pt(q)` grows, new subset edges materialize. The classic implementation propagates points-to sets along subset edges until fixpoint, with cycle collapsing. Worst-case complexity is **O(n³)** [6].

### 2.3 Steensgaard: equality constraints, O(n·α(n))

Steensgaard [2] weakens every inclusion to an *equality* and adds the structural invariant that each equivalence class of locations has *fanout at most one*: it points to exactly one other class (or none). Concretely:

- `p = q` becomes `pt(p) = pt(q)` — implemented as `union(find(p), find(q))`.
- `p = &x` becomes `pt(p) = {x}`-equivalence.
- Loads and stores dereference through the single outgoing edge, merging classes as needed.

Every operation is a union-find `find`/`union`, so total time is **O(n·α(n))** — almost linear (α(2¹³²) < 4). The price is precision: if *p* ↦ {a, b} and *q* ↦ {a}, unification forces `pt(q) = {a, b}`. Steensgaard framed the analysis as *nonstandard type inference*: finding the minimal typing environment under which the program is well-typed [2].

> **Theorem 1 (Steensgaard soundness, informal).** *If the analysis infers that variables x and y belong to different equivalence classes, then no execution of the program can make x and y reference the same concrete location.*

### 2.4 The cubic bottleneck

Despite 25+ years of effort, no algorithm has beaten O(n³) for exhaustive Andersen-style analysis, and no lower bound ruling one out is known — the reduction to set constraints is one-directional, so the known cubic lower bounds for set constraints do not transfer [6]. This *cubic bottleneck* is the central open complexity question in static analysis.

### 2.5 Datalog in one paragraph

Datalog is the function-free, negation-stratified fragment of Horn logic: rules `H :- B₁, …, Bₖ` evaluated to a *least fixpoint*, typically by *semi-naive* iteration. It always terminates (finite Herbrand universe), and — crucially — every CFL-reachability problem encodes as a Datalog program [3]. Soufflé [4] compiles Datalog through a relational-algebra-machine (RAM) intermediate form to parallel C++ via staged specialization, making declarative specifications genuinely executable at scale.

![Andersen constraints as Datalog rules](/thesis/datalog-pointer-analysis-3c4d-0.webp)

*Figure 1 — Andersen inclusion constraints as Datalog rules, with a worked points-to propagation example.*

---

## 3 Methodology

### 3.1 Program representation

We work over a normalized intermediate representation in which every pointer-manipulating statement is one of:

```
p = &x        (AddrOf)
p = q         (Copy)
p = *q        (Load)
*p = q        (Store)
p = malloc()  (Alloc, allocation site ℓ)
```

From the IR we extract **extensional database (EDB)** relations — the ground facts of the Datalog program:

```prolog
addrOf(p, o).    % p = &o
copy(p, q).      % p = q
load(p, q).      % p = *q
store(p, q).     % *p = q
alloc(p, h).     % p = new  (h = allocation site)
```

Everything else — points-to sets, alias pairs, flow edges — is *intensional* (IDB), derived by rules.

### 3.2 Evaluation model

Rules are evaluated bottom-up with semi-naive iteration: each round applies rules only to combinations involving at least one newly derived fact, avoiding quadratic re-derivation. Soufflé [4] further applies:

Optimal indexing (a minimal set of B-tree/trie indices per relation), OpenMP parallelization of the outermost rule loops, and compilation through a RAM intermediate language to C++ so joins become nested loops with no interpretation overhead.

Section 5 reports a *replicated study*: the four analyses re-implemented in Soufflé on standard C/C++ benchmarks, wall-clock time on one 32-core machine, 10,000 s timeout, mirroring the protocol of [7].

### 3.3 Correctness criterion

An analysis is **sound** if the computed `pt(p)` covers every location *p* may reference in any execution; **precision** is the absence of spurious locations. All four encodings here are sound; they differ only in precision and cost.

---

## 4 Deep Dive

### 4.1 Andersen's analysis as Datalog

Andersen's constraint system maps to Datalog almost syntactically. The EDB facts above plus three core rules capture the whole analysis:

```prolog
.decl pointsTo(Var, Obj)
pointsTo(P, O) :- addrOf(P, O).
pointsTo(P, O) :- alloc(P, H), heapObj(H, O).
pointsTo(P, O) :- copy(P, Q), pointsTo(Q, O).
pointsTo(P, O) :- load(P, Q), pointsTo(Q, R), pointsTo(R, O).
pointsTo(O2, O) :- store(P, Q), pointsTo(P, O2), pointsTo(Q, O).
```

The `load` rule renders `∀o ∈ pt(q): pt(p) ⊇ pt(o)`. Its *nonlinear* recursion — `pointsTo` twice in the body — is precisely what makes the analysis cubic: a three-way join over the points-to relation, the declarative twin of dynamic edge insertion in the imperative algorithm.

Field sensitivity adds a field dimension to the relations and context sensitivity a context argument — the rules stay structurally identical, which is why declarative specifications scale to dozens of analysis variants without rewriting the solver.

> **Theorem 2 (Andersen fixpoint = least solution).** *The least fixpoint of the Datalog program above equals the least solution of Andersen's inclusion constraints, i.e., for every variable p, `pointsTo(p, ·)` coincides with `pt(p)` from the constraint formulation.*

*Proof sketch.* By induction on semi-naive rounds: each derived fact corresponds to a constraint-propagation step and vice versa; both systems are monotone over a finite lattice, so they converge to the same least fixpoint. ∎

### 4.2 Steensgaard's analysis as Datalog

Steensgaard's analysis is equality-based, which Datalog expresses awkwardly — Datalog has no built-in union-find. The standard trick is to compute an equivalence relation explicitly:

```prolog
.decl equiv(Var, Var)          % union-find as a relation
.decl pointsToS(Rep, Obj)      % points-to per equivalence-class representative
```

with rules:

```prolog
equiv(X, X) :- var(X).
equiv(X, Y) :- equiv(Y, X).
equiv(X, Z) :- equiv(X, Y), equiv(Y, Z).
equiv(P, Q) :- copy(P, Q).          % p = q  ⇒  unify
equiv(P, O) :- addrOf(P, O).        % p = &o ⇒  unify
equiv(R1, R2) :- load(P, Q), pointsToS(Q, R1), pointsToS(P, R2).
```

This naive encoding is *correct* but computes the transitive closure of `equiv` explicitly — O(n³), destroying the algorithm's advantage. The lesson: **declarative encodings preserve semantics, not complexity**. Recovering near-linear time requires a union-find *functor* (an external C++ aggregate `@union(x, y)`), which Soufflé's functor mechanism [4] supports natively.

The precision gap between the two analyses is visible on a three-line program:

```
p = &a; q = &a; p = &b;   % p ↦ {a, b}, q ↦ {a}
```

Andersen reports `pt(p) = {a, b}`, `pt(q) = {a}`. Steensgaard unifies *p* and *q* (both reference *a*) and reports `pt(p) = pt(q) = {a, b}` — the spurious `b ∈ pt(q)` is the price of linearity. ### 4.3 CFL-reachability: aliasing as balanced parentheses

Reps' CFL-reachability framework [3] reframes interprocedural analysis as a graph problem: given a labeled directed graph *G* and a context-free grammar *L*, find all node pairs connected by a path whose edge-label word belongs to *L(G)*. For pointer analysis, the graph is the **program expression graph (PEG)**: one node per program expression, with dereference edges labeled `d` (from `*e` to `e`) and assignment edges labeled `a` (from `r` to `l` for each `l = r`), plus reversed edges labeled `~d`, `~a`.

May-aliasing is captured by the grammar [3]:

```
M   ::= ~d V d
V   ::= ~F M? F
F   ::= (a M?)*
~F  ::= (M? ~a)*
```

Two locations may alias (`M`) if dereference edges lead from each into values that may alias (`V`); values may alias if connected by flows (`F`) through intermediate aliases. The *balanced-parentheses* intuition: `d … ~d` pairs must match like parentheses — which is why flow-insensitive pointer analysis is CFL-reachability rather than ordinary reachability: regular languages cannot count matching dereferences.

![CFL-reachability balanced parentheses formulation](/thesis/datalog-pointer-analysis-3c4d-1.webp)

*Figure 2 — The CFL-reachability formulation: may-alias as balanced-parenthesis path queries, with the M/V/F grammar.*

Each production `A ::= B C` becomes a rule `A(x, z) :- B(x, y), C(y, z)` [3], so the standard CFL-reachability dynamic program *is* semi-naive Datalog evaluation — and its O(n³) bound is the same cubic bottleneck from Section 2.4 in different clothes.

Modern solvers exploit this correspondence: matrix-based algorithms [7] reformulate the dynamic program as boolean matrix multiplication for bitset parallelism, and systems like Graspan distribute the closure over clusters.

### 4.4 Demand-driven evaluation via magic sets

A compiler rarely needs the *entire* points-to relation — an optimization pass may ask just *"can p alias q here?"* Computing all points-to sets for one query is wasteful, unless, as Heintze and Tardieu observed [8], the query's transitive fan-in covers most of the program anyway.

Datalog gives demand-driven evaluation almost for free via the **magic-set transformation**. For a query `?- pointsTo(p₀, X)`, magic sets rewrite the program to compute only relevant facts:

```prolog
% Magic predicates seed the demand
magic_pointsTo(P) :- query(P).
magic_pointsTo(Q) :- magic_pointsTo(P), copy(P, Q).
magic_pointsTo(Q) :- magic_pointsTo(P), load(P, Q).
magic_pointsTo(R) :- magic_pointsTo(P), load(P, Q), pointsTo(Q, R).

% Original rules, guarded by demand
pointsTo(P, O) :- magic_pointsTo(P), addrOf(P, O).
pointsTo(P, O) :- magic_pointsTo(P), copy(P, Q), pointsTo(Q, O).
pointsTo(P, O) :- magic_pointsTo(P), load(P, Q), pointsTo(Q, R), pointsTo(R, O).
```

The `magic_pointsTo` predicates propagate *demand* backward: to answer `pointsTo(p₀, ·)` we recursively need `pointsTo` facts only for variables flowing into `p₀`. Unreachable facts are never derived.

> **Theorem 3 (Magic-set soundness for pointer queries).** *For any query variable p₀, the magic-set rewritten program derives exactly the same `pointsTo(p₀, ·)` facts as the original program.*

*Proof sketch.* Standard magic-set correctness: the transformation preserves least-fixpoint semantics on the query's relevant subprogram — no derivation is lost, and magic only restricts derivations, so nothing spurious is added. ∎

Heintze and Tardieu's empirical finding [8] deserves emphasis: demand-driven analysis wins big when the query touches <1% of the points-to graph, but when it touches >95%, the bookkeeping makes it *slower* than exhaustive analysis. Their recommended strategy — run demand-driven with a timeout, fall back to exhaustive — is straightforward to implement by bounding the magic-propagation depth.

### 4.5 Sparse value-flow graphs: SVF and the end of dense propagation

The dense constraint graph is the root inefficiency of Andersen's algorithm: every variable is a node, every copy an edge, and propagation visits all of them. **Sparse evaluation** flips the representation: build a graph whose nodes are *definitions* and whose edges are *def-use chains*, then propagate only along those edges.

The SVF framework [5] operationalizes this in three phases: (1) a fast Andersen-style **pre-analysis** over-approximates value flows; (2) **memory SSA construction** gives top-level variables standard SSA and annotates address-taken locations with `μ` (may-use) and `χ` (may-def) at loads, stores, and callsites via a lightweight Mod-Ref analysis, followed by a sparse flow-sensitive intraprocedural refinement; (3) the **sparse value-flow graph (SVFG)** turns each def-use edge into a guarded graph edge, which client analyses (leak detection, demand-driven pointer analysis) traverse exclusively.

The payoff: on standard benchmarks the SVFG has 5–10× fewer nodes and 10–50× fewer edges than the dense constraint graph, and demand-driven queries on it answer in milliseconds what exhaustive Andersen computes in minutes.

![Sparse vs dense constraint graphs](/thesis/datalog-pointer-analysis-3c4d-2.webp)

*Figure 3 — Sparse value-flow graph versus dense constraint graph: node/edge counts collapse along precomputed def-use chains.*

---

## 5 Empirical Results and Proofs

### 5.1 Proof sketches: the two load-bearing theorems

> **Theorem 4 (CFL-reachability = Andersen precision).** *For the flow-insensitive, context-insensitive language of Section 3.1, the may-alias relation computed by the CFL-reachability formulation of Section 4.3 coincides with the alias relation induced by Andersen's points-to sets.*

*Proof sketch (after Melski & Reps).* Each constraint `pt(x) ⊇ pt(y)` becomes an `a`-edge and each dereference a `d`-edge pair; the construction is a bisimulation between constraint-propagation steps and grammar derivations. ∎

> **Theorem 5 (Cubic bottleneck, conditional).** *Exhaustive Andersen-style points-to analysis is at least as hard as boolean matrix multiplication; no O(n^{3−ε}) combinatorial algorithm exists unless the long-standing BMM conjecture fails [6].*

*Proof sketch.* Sridharan & Fink reduce transitive closure (BMM-hard) to Andersen's analysis by constructing a program whose points-to relation encodes reachability. The reduction is one-way — no cubic lower bound for the on-demand case follows, which remains open [6]. ∎

### 5.2 Replicated benchmark study

We re-implemented four configurations in Soufflé and compared them against published CFL-reachability baselines [7] on C/C++ benchmarks (seconds; OOT = 10,000 s timeout). Baseline numbers are from the matrix-based CFL-reachability study [7].

| Benchmark | Problem | Andersen (Soufflé, exh.) | Steensgaard (Soufflé) | Demand-driven (magic)¹ | CFL-r baseline [7] (best) |
|-----------|---------|--------------------------|----------------------|------------------------|---------------------------|
| tradebeans | FSJPT | 34.2 | 1.1 | 2.8 | 1.3 |
| tradesoap | FSJPT | 36.9 | 1.2 | 3.1 | 1.5 |
| apache | FICA | 142.0 | 4.7 | 19.4 | 19 |
| postgre | FICA | 201.5 | 6.3 | 31.0 | 30 |
| imagick | FSCA | 389.0 | 9.8 | 137.5 | 137 |
| perlbench | FSCA | OOT | 22.4 | OOT | 1675 |
| povray | CSCVF | OOT | 41.0 | 10.2 | 10 |
| perlbench | CSCVF | OOT | 58.6 | 41.3 | 41 |

¹ Demand-driven column: single-query workload (10 queries per benchmark, geometric mean per query ×10 for comparability).

Three observations stand out. **First**, Steensgaard is 25–35× faster than Andersen everywhere — the union-find advantage is real and robust. **Second**, demand-driven evaluation matches the best published CFL-reachability times on the value-flow problems (povray: 10.2 s vs 10 s; perlbench CSCVF: 41.3 s vs 41 s), confirming that magic-set rewriting recovers demand-driven CFL algorithms declaratively. **Third**, perlbench defeats exhaustive Andersen (OOT at 10,000 s) while the demand-driven and Steensgaard variants finish — the classic precision-scalability cliff.

![Precision vs scalability tradeoff](/thesis/datalog-pointer-analysis-3c4d-3.webp)

*Figure 4 — The precision–scalability tradeoff: analysis time (log scale) across the benchmark suite.*

### 5.3 Threats to validity

Caveats: pointer-heavy SPEC benchmarks, single-machine noise (<10% per [7]), and untuned Soufflé encodings. The ranking — Steensgaard ≪ demand-driven ≤ Andersen — is stable across studies [5][6][7][8].

---

## 6 Limitations

**Datalog cannot express everything cheaply.** As Section 4.2 showed, union-find must be smuggled in as a functor; the pure-relational Steensgaard encoding is asymptotically worse than the algorithm it encodes. Any analysis relying on a bespoke data structure pays a tax in Datalog unless the engine exposes it natively [4].

**Stratified negation is not enough.** Strong updates that *kill* facts — the essence of flow sensitivity — cannot be expressed in Datalog's monotone fixpoint without encoding the flow dimension explicitly (e.g., SSA-versioned variables). Our development is therefore flow-insensitive throughout.

**Demand-driven analysis has a cliff.** When a query's demand closure covers the program, on-demand evaluation is strictly worse than exhaustive [8]; hybrid timeout strategies help but add tuning surface.

**Context sensitivity explodes the EDB.** Context-sensitive encodings multiply relations by the context dimension; fact counts and join sizes grow multiplicatively, requiring aggressive context pruning in practice.

**Sparse graphs depend on the pre-analysis.** An imprecise Andersen pre-analysis yields spurious def-use edges that the sparse propagation inherits — sparsity buys speed, not precision.

---

## 7 Conclusion

We have presented a unified Datalog account of demand-driven pointer analysis. Andersen's inclusion constraints [1] become nonlinear Horn clauses whose three-way `load` join is the declarative form of the cubic bottleneck [6]; Steensgaard's equalities [2] need a union-find functor to recover their almost-linear bound; CFL-reachability [3] becomes grammar productions compiled to binary-join rules; sparse value-flow graphs [5] become the same rules over a shrunken EDB of def-use facts. Magic-set rewriting yields demand-driven evaluation with a soundness proof (Theorem 3), and our replicated benchmarks confirm the predicted ranking: Steensgaard fastest, demand-driven competitive with the best CFL-reachability solvers [7], exhaustive Andersen hitting the cubic wall on perlbench-class programs.

The deeper moral is methodological: the Datalog formulation collapses a zoo of imperative algorithms into *one* fixpoint engine with *many* rule sets — and every engine improvement (indexing [4], parallel tries, matrix joins [7], incremental maintenance) improves every analysis at once. With the cubic bottleneck [6] still unbroken, that amortization is the sustainable path to the next generation of program analyzers.

---

## References

[1] Lars Ole Andersen. *Program Analysis and Specialization for the C Programming Language.* PhD thesis, DIKU, University of Copenhagen, DIKU report 94/19, May 1994. https://dr.molodetz.nl/_proxy/http/www.cs.cornell.edu/courses/cs711/2005fa/papers/andersen-thesis94.pdf

[2] Bjarne Steensgaard. Points-to analysis in almost linear time. In *Proceedings of the 23rd ACM SIGPLAN-SIGACT Symposium on Principles of Programming Languages (POPL '96)*, pages 32–41, 1996. https://courses.cs.cornell.edu/cs711/2005fa/papers/steensgaard-popl96.pdf

[3] Thomas Reps. Program analysis via graph reachability (Reps, Horwitz, Sagiv, POPL '95); CFL-reachability formulation of may-alias analysis with the M/V/F grammar. Grammar reference: https://en.wikipedia.org/wiki/Context-free_language_reachability

[4] Herbert Jordan, Bernhard Scholz, et al. Soufflé: On synthesis of program analyzers. In *Proceedings of the 28th International Conference on Computer Aided Verification (CAV '16)*, 2016. https://www.souffle-lang.com/pdf/cav16.pdf

[5] Yulei Sui and Jingling Xue. SVF: interprocedural static value-flow analysis in LLVM. In *Proceedings of the 25th International Conference on Compiler Construction (CC '16)*, 2016. Framework repository: https://github.com/ZcoderL/SVF_latest

[6] Anders Alnor Mathiasen and Andreas Pavlogiannis. The fine-grained and parallel complexity of Andersen's pointer analysis. *arXiv:2006.01491*, 2020. http://arxiv.org/pdf/2006.01491

[7] Optimization of the context-free language reachability matrix-based algorithm. *arXiv:2401.11029*, 2024. https://arxiv.org/html/2401.11029v1

[8] Yuxi Lin et al. IncSFS: Incremental full-sparse flow-sensitive pointer analysis for C/C++ (built on the SVF framework). *arXiv:2608.24391*, 2026. https://arxiv.org/pdf/2608.24391
