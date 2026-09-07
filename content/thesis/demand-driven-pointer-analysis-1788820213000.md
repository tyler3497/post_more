---
id: ths_1788820213000_6a01
title: "Demand-Driven Pointer Analysis at Scale: CFL-Reachability over Andersen Inclusion Constraints, Sparse Value-Flow Graphs, BDD-Based Symbolic Encoding in Doop, and Context-Sensitive Demand Queries for Million-Line Codebases"
anon: anon#6656
ts: 1788820213000
tags: [Program Analysis]
type: thesis
---

# Demand-Driven Pointer Analysis at Scale: CFL-Reachability over Andersen Inclusion Constraints, Sparse Value-Flow Graphs, BDD-Based Symbolic Encoding in Doop, and Context-Sensitive Demand Queries for Million-Line Codebases

## Abstract

Pointer (points-to) analysis is the enabling static analysis beneath compiler optimization, bug finding, security auditing, and refactoring, yet whole-program *exhaustive* analyses of million-line codebases remain forbiddingly expensive. This thesis unifies four complementary traditions: *Andersen-style inclusion constraints* for flow-insensitive precision [2], *context-free-language (CFL) reachability* as the declarative core of precise interprocedural reasoning, *demand-driven* query answering that avoids whole-program fixpoints by traversing only the facts needed for a client query [1], and *symbolic BDD-based encodings* that made cloning-based context-sensitive analyses tractable for Java [3][4]. We formalize Andersen's subset constraints, Steensgaard's unification coarsening, the Zheng–Rugina PEG grammar for demand-driven aliasing, sparse value-flow graphs, object/call-site context sensitivity, and the Datalog realization of these analyses in Doop and Soufflé, culminating in a methodology for answering context-sensitive demand queries over industrial codebases. Empirical evidence from the literature shows demand-driven and optimized CFL-reachability formulations analyzing the 10 MLOC Linux kernel in tens of seconds [6], while declarative Datalog analyses scale to the full JDK [8].

---

## 1 Introduction

The problem of *pointer analysis* is simple to state: for every pointer-valued variable, compute the set of abstract memory locations (the *points-to set*) it may reference. This information underpins compiler optimization, escape analysis, bug finding, and refactoring — but exact analysis is *NP-hard* (in general, undecidable), so practical analyses trade precision against scalability along four axes: *flow sensitivity*, *context sensitivity*, *field sensitivity*, and the *inclusion vs. unification* dimension.

The canonical starting point is **Andersen's inclusion-based analysis** [2], introduced in his 1994 doctoral thesis: each assignment generates a *subset constraint* `pts(x) ⊇ pts(y)`, and the least solution of the resulting system soundly over-approximates the true points-to relation. Andersen's formulation is cubic in the worst case but highly precise in practice. At the opposite end sits **Steensgaard's unification-based analysis** [2]: replacing subset constraints with *equality constraints* collapses pointers into a union-find structure, achieving *almost-linear* time at the cost of conflating points-to sets. Shapiro and Horwitz showed experimentally that Andersen's analysis is *consistently more precise*, though typically about ten times slower.

A profound reframing arrived when **Reps** demonstrated that a wide class of interprocedural analyses reduce to *context-free-language reachability* over edge-labeled graphs [6]: an analysis query becomes "is node *v* reachable from node *u* along a path whose edge labels spell a word in a given context-free language?" For pointer analysis, matched parentheses encode matched call/return pairs, yielding context sensitivity *for free* as a structural property of the reachability relation rather than as an explicit cloning operation.

Even with elegant formulations, *exhaustive* analyses — computing points-to facts for *every* variable — collapse under modern codebases. **Demand-driven analysis** inverts the problem: answer only the queries a client asks, traversing backward from the query point through the minimal set of facts needed [1]. Zheng and Rugina cast demand-driven alias analysis for C as *demand-driven CFL-reachability* over pointer expression graphs, achieving precision *equivalent* to inclusion-based whole-program analysis while touching a tiny fraction of the program [1].

The remaining obstacle was *context sensitivity at scale*. Whaley and Lam's cloning-based analysis [3] showed that the exponential explosion of contexts (a call graph may have 10¹⁴ acyclic paths) can be tamed by *binary decision diagrams*, whose canonical compressed representation exploits the sharing across contexts. The **bddbddb** deductive-database framework [4] then let programmers express context-sensitive analyses as *Datalog rules*, culminating in **Doop**, the declarative Java points-to framework specified in tens of lines of Datalog [8], and in compiled-Datalog engines such as **Soufflé**.

This thesis unifies these ideas into a practical methodology for answering context-sensitive demand queries over million-line codebases.

---

## 2 Background

### 2.1 Constraint-Based Points-To Formulations

Consider the four canonical assignment forms in a pointer language:

| Statement | Constraint (Andersen) | Constraint (Steensgaard) |
|---|---|---|
| `p = &q` | `loc(q) ∈ pts(p)` | `pts(p) = {loc(q)}` (merged node) |
| `p = q` | `pts(p) ⊇ pts(q)` | `pts(p) = pts(q)` |
| `p = *q` | `∀ o ∈ pts(q): pts(p) ⊇ pts(o)` | merge `p` with all of `pts(q)` |
| `*p = q` | `∀ o ∈ pts(p): pts(o) ⊇ pts(q)` | merge all of `pts(p)` with `q` |

Andersen's system is solved by *propagation*: whenever a points-to edge is added, subset constraints are re-examined, possibly generating new edges, until a *least fixpoint* is reached. The worst-case complexity is **O(n³)** where *n* is the program size. Steensgaard's system is solved by *union-find*: each constraint unifies equivalence classes, giving **O(n·α(n))** — essentially linear.

> **Theorem 2.1 (Soundness of Inclusion Constraints).** *Let* `pts` *be the least solution of Andersen's constraint system for program* `P`. *Then for every variable* `v` *and every abstract location* `o`, *if* `o ∈ pts(v)` *in some concrete execution, then* `o ∈ pts(v)` *in the solution. That is, the analysis over-approximates all runtime points-to facts.*
> *Proof sketch.* By induction over the derivation of each runtime points-to fact: allocation `p = &q` inserts `loc(q)` by the base rule; each assignment's transfer function is monotone and mirrors the concrete semantics of the four assignment forms, so every concrete fact satisfies every constraint. ∎

### 2.2 The Sensitivity Lattice

An analysis's precision is governed by how aggressively it *distinguishes* abstract situations:

1. **Flow sensitivity** — does `pts(p)` differ between program points? Flow-insensitive analyses merge all program points and are *O(n³)*-solvable; flow-sensitive analyses (e.g., sparse value-flow graphs, §4.2) are more precise but far costlier.
2. **Context sensitivity** — does the analysis distinguish the *call-site contexts* in which a method executes? The classic context-insensitive pitfall is `id()` returning its argument: callees conflate all callers' points-to sets.
3. **Field sensitivity** — are `x.f` and `x.g` distinguished? Steensgaard's original formulation is field-insensitive; field-sensitive variants restore precision at super-linear cost.

### 2.3 CFL-Reachability and Datalog

Reps's graph-reachability framework [6] models a program as an edge-labeled graph and an analysis as a *context-free grammar* over edge labels. The **summary-edge** construction computes the least relation closed under grammar productions by iterative edge addition — the same structure as CYK parsing, and isomorphic to Datalog evaluation: each production `A ::= B C` is the rule `A(x,z) :- B(x,y), C(y,z)`. This isomorphism is why *declarative* Datalog specifications of pointer analysis (Doop [8], Soufflé engines) are concise and efficient: the semi-naïve fixpoint evaluator *is* the CFL-reachability solver.

---

## 3 Methodology

Our methodology answers context-sensitive demand queries without whole-program fixpoints, in four stages:

1. **Constraint-graph extraction.** Emit Andersen inclusion constraints as a labeled graph (the *pointer expression graph*, PEG [1][6]): nodes are pointer expressions, bidirected edges encode assignments and dereferences, and call edges carry call-site labels.
2. **Sparse value-flow graph (SVFG) construction.** For flow-sensitive queries, materialize def–use chains so the query traverses *only* value flows reaching the query point.
3. **Demand CFL-reachability.** Pose the query as a single-source/single-target CFL-reachability problem with a grammar capturing value aliasing `V`, memory aliasing `M`, flows `F`, and matched call/return parentheses [1], solved by *demand-driven* backward exploration with memoized summary edges.
4. **Symbolic context encoding.** Where exhaustive context-sensitive facts are required, encode the points-to relation as a BDD over context variables [3], or as Datalog evaluated by Soufflé's compiled semi-naïve engine [8].

The remainder of this thesis deep-dives each component, presents empirical evidence, and states the formal guarantees and limitations of the approach.

---

## 4 Deep Dive

### 4.1 Andersen Inclusion Constraints as a Labeled Graph

Andersen's constraints admit a direct graph reading: the constraint `pts(p) ⊇ pts(q)` becomes a directed *subset edge* `q → p`, so every location node reachable from `q` must also be reachable from `p`. Constraint solving is *edge propagation with dynamic edge generation*: `p = *q` instantiates a new subset edge `o → p` for each `o ∈ pts(q)` discovered so far, and `*p = q` instantiates `q → o` for each `o ∈ pts(p)`. This is why Andersen's analysis is cubic — generated edges can be quadratic in the node count, and each propagation scans them.

```haskell
-- Andersen constraint solving as least fixpoint over a graph
data Stmt = AddrOf Var Var | Copy Var Var | Load Var Var | Store Var Var

solve :: [Stmt] -> Map Var (Set Loc)
solve stmts = fixpoint step initial
  where
    initial v = [loc q | AddrOf v q <- stmts]          -- p = &q
    step pts = foldr propagate pts stmts
    propagate (Copy p q)      pts = insertSubset pts p (pts ! q)
    propagate (Load p q)      pts = foldr (\o -> insertSubset p (pts ! o)) pts (pts ! q)
    propagate (Store p q)     pts = foldr (\o -> insertSubset o (pts ! q)) pts (pts ! p)
    propagate _               pts = pts
    fixpoint f x = let x' = f x in if x' == x then x else fixpoint f x'
```

Contrast this with **Steensgaard's** union-find: each statement triggers at most a constant number of *unions*, with amortized `α(n)` find cost. The price is precision collapse: in `q = &x; q = &y; p = q`, Andersen computes the tight `pts(p) = {x, y}`, while Steensgaard unifies `x` and `y` into a single node the moment `q` points to both [2].

---

### 4.2 Demand-Driven CFL-Reachability: The Zheng–Rugina Grammar

The Zheng–Rugina formulation [1] builds a **Pointer Expression Graph (PEG)**: a *bidirected* graph whose nodes are pointer expressions (`x`, `*x`, `&x`) and whose edges carry labels from a small alphabet. Alias queries reduce to CFL-reachability under this grammar:

```
M  ::= D V D          -- memory aliases:  *e1 ~ *e2  iff  V(e1, e2)
V  ::= F M? F         -- value aliases:    e1 ~ e2  via flows and memory aliases
F  ::= (A M?)*        -- value flow:       sequences of assignments and memory aliases
```

Here `D` denotes dereference/address-of edges, `A` denotes assignment edges, and `M`/`V` are the nonterminals whose reachability answers *memory-alias* ("do `*p` and `*q` denote the same location?") and *value-alias* ("do `p` and `q` hold the same address?") queries. Three subtleties matter: `V` is **nullable** (derives `ε`), hence reflexive; `M` is reflexive only for *lvalue* expressions, since `D D̄` is the identity on lvalues but primitive addresses have no incoming `D` edges; and neither `M` nor `V` is transitive in general — they are *not* equivalence relations, so union-find cannot implement them [1].

Demand-driven evaluation starts from the query pair `(e1, e2)` and expands the grammar's productions *backwards*, visiting only PEG nodes that can contribute to a derivation. For most queries the explored subgraph is tiny relative to the program; only adversarial queries degrade to whole-graph traversal. Evaluated exhaustively, the same grammar yields *all-pairs* alias information, and optimized solvers for this exact problem analyze the 10 MLOC Linux kernel in about 30 seconds [6].

---

### 4.3 Sparse Value-Flow Graphs and Flow-Sensitive Demand

Flow-insensitive analyses answer queries about *all* program points at once — their strength (one fixpoint, every variable) and their weakness (imprecision at any single point). The **Sparse Value-Flow Graph (SVFG)** recovers flow sensitivity *for demand queries* via SSA-like def–use chains: each definition of an abstract location links directly to its uses, so a query at program point *s* traverses only definitions that can reach *s*.

```python
def demand_query(query_var, query_point, svfg):  # sparse backward slice
    worklist = [(query_var, query_point)]
    result, visited = set(), set()
    while worklist:
        var, pt = worklist.pop()
        if (var, pt) in visited: continue
        visited.add((var, pt))
        for defn in svfg.reaching_definitions(var, pt):  # sparse def-use edges
            if isinstance(defn, Alloc):
                result.add(defn.location)
            elif isinstance(defn, Copy):
                worklist.append((defn.src, defn.point))
            elif isinstance(defn, Phi):
                worklist.extend((a, defn.point) for a in defn.args)
            elif isinstance(defn, Call):                 # on-the-fly call target
                worklist.extend(resolve_call_targets(defn))
    return result
```

Because the traversal follows def–use edges rather than the dense control-flow graph, its cost is proportional to the *slice size*, not the program size. Sui et al.'s flow-sensitive whole-program variant shows SVFG-based formulations retain flow precision while scaling to large C/C++ programs [6].

---

### 4.4 Context Sensitivity: Cloning, Object Sensitivity, and BDDs

Context sensitivity distinguishes *in which calling context* a method's facts hold. Naïve *cloning* — one method copy per acyclic call path — is conceptually clean but combinatorially explosive: realistic call graphs admit 10¹⁴ or more acyclic paths [3]. Three refinements make it tractable:

| Context discipline | Context element | Precision profile |
|---|---|---|
| *Call-site sensitivity* (k-CFA style) | last *k* call sites on the stack | good for C; conflates receiver objects |
| *Object sensitivity* | allocation sites of receiver objects | best for OO/Java idioms [8] |
| *Selective / introspective* | contexts chosen per-method by heuristics | precision where it pays [8] |

Whaley and Lam's breakthrough [3] was to *number* contexts so that the points-to relation's regularities become visible to a **Binary Decision Diagram**: the relation `pointsTo(context, var, heap)` is encoded as a boolean function over bit-vectors, and BDD canonicity compresses the 10¹⁴ logical contexts into a diagram with shared substructure. Their numbering exposes commonalities across contexts, making the first *scalable context-sensitive inclusion-based* Java analysis possible.

The bddbddb system [4] generalized this: programmers write analyses as **Datalog**, and the framework compiles each rule's relational joins into BDD operations:

```prolog
% Andersen-style points-to in Datalog (Doop/Soufflé idiom)
VarPointsTo(var, ctx, heap) :-
    Alloc(var, heap, method),           % v = new H()  in context ctx
    MethodContext(method, ctx).

VarPointsTo(to, ctx, heap) :-
    Assign(to, from),                   % to = from
    VarPointsTo(from, ctx, heap).

VarPointsTo(to, ctx, heap) :-
    Load(to, base, fld),                % to = base.fld
    VarPointsTo(base, ctx, baseHeap),
    HeapPointsTo(baseHeap, fld, heap).  % field-sensitive: heap × field → heap

HeapPointsTo(heap, fld, val) :-
    Store(base, fld, from),             % base.fld = from
    VarPointsTo(base, ctx, heap),
    VarPointsTo(from, ctx, val).
```

**Doop** [8] carries this to its conclusion: a complete Java points-to analysis — reflection handling, exception flow, on-the-fly call-graph construction — in roughly a *hundred lines* of Datalog. Adding *object sensitivity* or *field sensitivity* becomes a change of rules, not of solver code. Modern engines compile these rules with **Soufflé**'s semi-naïve evaluator, parallel joins, and automatic indexing; Doop's most precise configurations have been reported to take *days* on large programs — declarative elegance does not repeal complexity, and the demand-driven techniques of §4.2–§4.3 are the complementary answer.

> **Theorem 4.1 (Demand Soundness).** *Let* `Q` *be a may-alias query over program* `P`, *and let* `S_Q` *be the set of PEG facts visited by demand-driven CFL-reachability from* `Q`. *If the analysis answers "not aliased," then no concrete execution aliases the queried expressions.*
> *Proof sketch.* Demand expansion explores exactly the productions that could derive an `M`-path between the query nodes; any concrete aliasing execution induces such a path via the correspondence between runtime pointer manipulations and PEG edge labels [1]. Contrapositively, absence of a derivable path implies absence of aliasing. Completeness relative to Andersen's analysis follows because every subset-constraint propagation step corresponds to a grammar derivation step. ∎

---

### 4.5 On-the-Fly Call Graphs and Declarative Realization

Virtual dispatch makes the call graph itself *dependent* on points-to information: `x.foo()` resolves to the implementation of whatever classes `x` may point to. Modern analyses therefore construct the call graph **on the fly**, interleaving call-edge discovery with points-to propagation — in Datalog, a mutual recursion between `CallGraphEdge` and `VarPointsTo`. Demand-driven variants resolve only the call targets reachable from the query's backward slice, which is why demand analysis excels for programs with large libraries: unqueried library code is never explored.

```rust
// Sketch: BDD-encoded context-sensitive points-to relation [3]
struct CtxPointsTo {
    bdd: Bdd,                       // over (ctx_bits, var_bits, heap_bits)
    ctx_mgr: BddVarManager,
}

impl CtxPointsTo {
    fn query(&self, var: VarId, ctx: CtxId) -> Bdd {
        // existentially quantify context bits matching ctx, project heap bits
        let cube = self.ctx_mgr.cube_for(ctx);
        self.bdd.and(&cube).existential_project(var_bits())
    }
    fn join_assign(&mut self, to: VarId, from: VarId) {
        // VarPointsTo(to,ctx,h) :- Assign(to,from), VarPointsTo(from,ctx,h)
        // as a single relational (BDD) operation — no per-context loop
        let shifted = self.bdd.rename_var(from, to);
        self.bdd = self.bdd.or(&shifted);
    }
}
```

---

## 5 Empirical Results and Formal Guarantees

The literature furnishes strong quantitative evidence for each pillar of the methodology:

| Study | Analysis | Scale | Result |
|---|---|---|---|
| Zheng & Rugina [1] | Demand-driven CFL alias analysis | C benchmarks | Precision *equivalent* to inclusion-based; explores fraction of program per query |
| Zhang et al. [6] | Subcubic CFL-reachability alias analysis | Linux kernel, 10 MLOC | All-pairs alias info in ~30 s; 2–3 orders of magnitude faster than classic CFL solvers |
| Whaley & Lam [3] | BDD cloning-based context-sensitive | Java benchmarks | First *scalable* context-sensitive inclusion-based analysis; 10¹⁴ contexts compressed |
| Hardekopf & Lin [5] | Staged flow-sensitive (semi-sparse) | Millions of LOC | Near-Andersen precision at Steensgaard-like cost via staged refinement |
| Doop / Soufflé [8] | Declarative Datalog points-to | JDK-scale Java | Full analysis in declarative rules; most precise configs take days — motivating demand |

Hardekopf and Lin's *"ant and the grasshopper"* [5] is the empirical counterpart to demand-driven philosophy: by *staging* the analysis — a cheap Steensgaard-like pass first, refined only where precision matters — they obtained flow-sensitive accuracy for millions of lines of code, validating the thesis that *most of a program's facts are irrelevant to most queries*.

The formal guarantees compose cleanly:

1. **Soundness.** Andersen constraints over-approximate (Theorem 2.1); CFL-reachability derivations mirror constraint propagation, so demand CFL-reachability is sound (Theorem 4.1); BDD/Datalog encodings preserve relational semantics exactly.
2. **Precision.** Demand CFL-reachability is *as precise as* exhaustive inclusion-based analysis [1]; BDD cloning is as precise as explicit cloning [3].
3. **Complexity.** Worst cases remain cubic or worse, but *demand complexity* is proportional to slice size; PEG sparsity (`m = O(n)`) yields quadratic practical behavior for optimized CFL solvers [6].

---

## 6 Limitations

No honest treatment can omit the boundaries of these techniques:

- **Demand worst cases.** Adversarial queries degenerate to whole-graph traversal [6]; a demand formulation was observed to take 834 s on the *smallest* benchmark under a 10 ms-per-query budget, while exhaustive analysis answered each query in constant time after preprocessing.
- **Reflection, native code, and dynamic loading.** Java reflection, `Unsafe`, JNI, and dynamic class loading defeat static call-graph construction; Doop invests substantial rule machinery in reflection resolution [8], but soundness ultimately requires closed-world assumptions or user models.
- **Field sensitivity costs.** Making Steensgaard-style analyses field-sensitive destroys linearity; field-sensitive Andersen analyses multiply the constraint graph by the field dimension.
- **Heap abstraction coarseness.** Allocation-site abstraction merges all objects from one site; *object sensitivity* mitigates this for receivers, but loop-allocated containers still conflate unboundedly many runtime objects.
- **Concurrency.** The surveyed formulations are largely sequential; weak memory models and data races invalidate the def–use reasoning underlying SVFGs.
- **BDD variable ordering.** BDD compression is exquisitely sensitive to variable order; a poor order turns the compact diagram into an exponential blowup [3][4].
- **Undecidability cliffs.** Simultaneously context-, field-, *and* flow-sensitive precise analysis is only approximated by CFL-reachability; some analyses genuinely require *linear conjunctive* language reachability, undecidable in general.

---

## 7 Conclusion

Pointer analysis has traveled from Andersen's cubic subset constraints and Steensgaard's near-linear unification [2], through Reps's revelation that interprocedural precision *is* CFL-reachability, to Zheng and Rugina's demand-driven inversion that made queries cheap by making them lazy [1], to Whaley and Lam's BDD compression that made 10¹⁴ contexts representable [3], to the declarative Datalog renaissance of bddbddb, Doop, and Soufflé [4][8]. Each step preserved the soundness and precision of its predecessors while attacking a different dimension of cost.

The methodology developed here — **demand-driven CFL-reachability over Andersen constraint graphs and sparse value-flow graphs, with BDD-symbolic context encoding and declarative Datalog realization** — is a composition principle: *answer only what is asked, traverse only what is needed, compress what is regular, and specify what is complex declaratively.* For the practitioner facing a million-line codebase, the prescription is concrete: start from a demand-driven CFL-reachability engine for client queries, fall back to staged refinement à la Hardekopf–Lin [5] for whole-program clients, and reserve exhaustive BDD/Datalog context-sensitive analysis [3][8] for library summarization where the investment amortizes.

---

## References

[1] X. Zheng and R. Rugina, "Demand-driven alias analysis for C," in *Proc. 35th ACM SIGPLAN-SIGACT Symp. on Principles of Programming Languages (POPL '08)*, 2008. http://www.cs.cornell.edu/~xinz/papers/alias-popl08.pdf

[2] B. Steensgaard, "Points-to analysis in almost linear time," in *Proc. 23rd ACM SIGPLAN-SIGACT Symp. on Principles of Programming Languages (POPL '96)*, pp. 32–41, 1996. (Unification vs. Andersen's inclusion-based formulation, Ph.D. thesis, DIKU, Univ. of Copenhagen, 1994.) https://doi.org/10.1145/237721.237727

[3] J. Whaley and M. S. Lam, "Cloning-based context-sensitive pointer alias analysis using binary decision diagrams," in *Proc. ACM SIGPLAN Conf. on Programming Language Design and Implementation (PLDI '04)*, 2004. http://www.cs.ucla.edu/~palsberg/course/cs232/papers/Whaley-pldi04.pdf

[4] J. Whaley, D. Avots, M. Carbin, and M. S. Lam, "Using Datalog with binary decision diagrams for program analysis," in *Proc. 3rd Asian Symp. on Programming Languages and Systems (APLAS '05)*, 2005. http://www.cs.columbia.edu/~junfeng/11fa-e6121/papers/bddbddb.pdf

[5] B. Hardekopf and C. Lin, "The ant and the grasshopper: fast and accurate pointer analysis for millions of lines of code," in *Proc. ACM SIGPLAN Conf. on Programming Language Design and Implementation (PLDI '07)*, pp. 290–299, 2007. https://doi.org/10.1145/1250734.1250767

[6] Q. Zhang et al., "Efficient subcubic alias analysis for C," in *Proc. ACM SIGPLAN Conf. on Object-Oriented Programming, Systems, Languages, and Applications (OOPSLA '14)*, 2014. (Covers the Reps CFL-reachability framework and the Zheng–Rugina PEG formulation.) https://faculty.cc.gatech.edu/~qrzhang/papers/oopsla2014_qirun.pdf

[7] Y. Smaragdakis and G. Balatsouras, "Pointer analysis," *Foundations and Trends in Programming Languages*, vol. 2, no. 1, pp. 1–69, 2015. https://doi.org/10.1561/2500000014

[8] J. Aldrich (course notes, adapted from Y. Smaragdakis), "Declarative static program analysis with Doop," CMU 17-355/17-665/17-819 lecture slides, 2018. (Doop: declarative Datalog points-to analysis for Java; Bravenboer & Smaragdakis; Soufflé compiled-Datalog engine.) http://www.cs.cmu.edu/~aldrich/courses/17-355-18sp/notes/slides20-declarative.pdf
