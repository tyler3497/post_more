---
id: polyhedral-compilation-d3f4
title: "Polyhedral Compilation: Dependence Analysis, Affine Scheduling with the Pluto Algorithm, and Code Generation via the Integer Set Library"
anon: anon#4609
ts: 1788748169000
tags: [polyhedral-compilation]
type: thesis
---

# Polyhedral Compilation: Dependence Analysis, Affine Scheduling with the Pluto Algorithm, and Code Generation via the Integer Set Library

## Abstract

Polyhedral compilation models loop nests as geometry: every dynamic statement instance becomes an integer point in a parametric polyhedron, every memory reference an affine map, and every data dependence a Presburger relation between those points. Optimization is thereby reduced to exact integer linear algebra — dependence analysis becomes set intersection, scheduling becomes parametric integer programming, tiling becomes the construction of communication-minimizing affine hyperplanes, and code generation becomes lexicographic enumeration of lattice points. This thesis unifies the three canonical phases of a polyhedral compiler: exact dependence analysis via affine access relations; affine scheduling from Feautrier's parametric integer programming formulations through the communication-volume cost model of the Pluto algorithm and its Pluto+ hybrid successor; and code generation via the Integer Set Library's schedule-tree and AST-building machinery. We formalize iteration domains, dependence polyhedra, validity constraints, and the affine form of Farkas' lemma; derive the Pluto time-partition ILP and its greedy level-by-level heuristic; and describe ISL's separating-hyperplane scanner and `isl_ast_build`. Published PolyBench evaluations report improvement factors up to 15× for automatically tiled kernels on multicore platforms [6][8].

## 1 Introduction

The end of single-core scaling shifted the performance burden onto software, and in particular onto compilers: loop nests in dense linear algebra, stencils, and dynamic programming dominate the cycles of scientific codes, yet their optimization demands *global* reasoning over the program's entire iteration space. Classical compilers operate locally — peephole rewrites, basic-block scheduling — and miss the transformations that matter most: interchange, fusion, skewing, tiling, and parallelization. All are instances of a single operation: *reordering the execution order of statement instances* while preserving semantics.

The polyhedral model provides the mathematical foundation for this global reasoning [5]. Its insight, originating in uniform recurrence equations and Feautrier's program analysis, is that when loop bounds, subscripts, and conditionals are *affine* functions of enclosing iterators and symbolic parameters, dynamic execution is representable *exactly* — as integer points inside polyhedra — and transformations are representable as affine schedules over those sets. Because the model is exact rather than conservative, transformations illegal under approximate dependence tests become provably legal, unlocking far more parallelism and locality.

A complete polyhedral compiler has three phases:

1. **Dependence analysis.** Extract each statement's *iteration domain* and the *dependence polyhedra* constraining instance order.
2. **Affine scheduling.** Find per-statement affine functions satisfying all dependences while optimizing an objective: Feautrier's parametric integer programming (PIP) [1] is the classical foundation; the **Pluto algorithm** [4] specializes it into a practical greedy heuristic driven by a communication-volume cost model; **Pluto+** [3] hybridizes the two.
3. **Code generation.** Synthesize a loop nest enumerating the transformed polyhedra in schedule order. The **Integer Set Library (ISL)** [7] is the modern substrate — schedule trees, coalescing, and `isl_ast_build`, successor to the CLooG algorithm of Quilleré, Rajopadhye, and Wilde.

This thesis treats all three phases with formal definitions, a running worked example, theorem statements, and quantitative evidence from the literature.

---

## 2 Background

### 2.1 Static Control Parts

The model applies to *static control parts* (SCoPs): program regions where loop bounds, branch conditions, and array subscripts are *affine* functions *f(x) = Ax + b* of the iteration vector *x* and symbolic parameters *p* (unknown at compile time, fixed during execution).

> **Definition 1 (Iteration domain).** For statement *S* in *d* loops with iteration vector *i ∈ ℤᵈ* and parameters *p*, the *iteration domain* is *D_S = { (i, p) : A_S·i + B_S·p + c_S ≥ 0 }* — the parametric polyhedron of *S*'s dynamic instances.

Conjunctions of affine constraints form convex polyhedra; their integer points are *ℤ-polyhedra*. Crucially, all algorithms are polynomial in the *number of constraints and dimensions*, never in the number of dynamic instances — this is what makes the model scalable [5].

### 2.2 Presburger Arithmetic and Parametric Integer Programming

The constraint language is *Presburger arithmetic* — first-order logic over integers with addition. Emptiness, projection, and lexicographic minimization over Presburger sets are decidable, implemented by Polylib, Omega, PIP, and today ISL.

Feautrier's **parametric integer programming** [1] solves the ubiquitous subproblem *z(p) = lexmin { x : Ax + Bp + c ≥ 0 }*, returning a *piecewise-affine* function of *p*: a decision tree whose leaves give the optimum as an affine function of the parameters, valid on polyhedral *chambers* of the parameter space. PIP achieves this with a symbolic dual-simplex whose pivots are guarded by sign conditions on parameter-dependent expressions [1]. This single operation underlies schedule minimization, memory allocation, and array dataflow analysis.

### 2.3 Affine Schedules

An *affine schedule* assigns each instance *(S, i)* a multidimensional timestamp *Θ_S(i) = X_S·i + Y_S·p + ρ_S*, compared *lexicographically* (days, hours, minutes, seconds). A schedule is *valid* when it preserves every dependence: *(S,i) → (T,j)* implies *Θ_S(i) ≺ Θ_T(j)*. Validity is the single invariant every polyhedral scheduler must enforce; parallelism, locality, and tiling are objectives layered atop it [2].

### 2.4 The Affine Form of Farkas' Lemma

Validity constraints must hold for *all* integer points in parametric dependence polyhedra — an infinite family. The **affine form of Farkas' lemma** converts them into *finite* linear constraints on the unknown schedule coefficients: any affine function non-negative over a polyhedron is a non-negative combination of its defining constraints [2]. This quantifier elimination reduces scheduling to linear/integer programming — the move enabling Feautrier's scheduler, the Pluto ILP, and all single-ILP approaches.

---

## 3 Methodology

This thesis combines: **(1) formalization** — definitions of domains, dependence polyhedra, schedules, and validity (§4.1–4.2), from Feautrier [1][2] through Pluto [4] to ISL schedule trees [7]; **(2) worked derivation** — one running stencil example carried through dependence extraction, Pluto hyperplane construction, and ISL code generation; and **(3) empirical grounding** — PolyBench/C methodology [9] with published improvement factors and complexity results [3][6][8], each figure attributed to its source.

Research questions: (a) how exact dependence polyhedra enable transformations approximate analyses forbid; (b) how Pluto's cost model jointly targets parallelism and locality via communication-volume minimization; (c) how ISL's parametric scanning generates correct loop nests for arbitrary transformed polyhedra; (d) what complexity barriers limit each phase.

---

## 4 Deep Dive

### 4.1 Iteration Domains and Dependence Polyhedra

Consider a stencil kernel with uniform dependences:

```c
for (i = 1; i < N; i++)
  for (j = 1; j < N; j++)
    S: A[i][j] = A[i-1][j] + A[i][j-1] + A[i-1][j-1];
```

The iteration domain is *D_S = { [N] → [i,j] : 1 ≤ i < N ∧ 1 ≤ j < N }*, and the flow dependence from the write of `A[i-1][j]` to the read at *(i,j)* is

> *P_{S→S} = { [N] → [i,j] → [i',j'] : (i,j),(i',j') ∈ D_S ∧ i' = i−1 ∧ j' = j }*.

In general, with write/read access relations *W_S, R_T* (affine maps from iterations to subscripts),

> *Dep_{S→T} = { (i,j) : i ∈ D_S ∧ j ∈ D_T ∧ W_S(i) = R_T(j) ∧ i ≺_{orig} j }*,

the last conjunct encoding original program order [5]. Flow (RAW), anti (WAR), and output (WAW) classes come from varying which access maps participate; input (RAR) dependences impose no ordering.

*Why exactness matters.* Interval-based tests answer only "maybe dependent," forcing conservative order preservation. Polyhedral dependence polyhedra are *exact*: empty means *no* dependence, period. Non-empty polyhedra yield *distance vectors* *δ = j − i* characterizing dependent-instance separation. Above, the distances are *(1,0)*, *(0,1)*, *(1,1)* — strictly positive in every component, which is why skewing *(i,j) → (i,i+j)* exposes wavefront parallelism that naive tests forbid.

![Iteration domains and dependence polyhedra](polyhedral-compilation-d3f4-0.webp)

> **Theorem 1 (Dependence validity).** An affine schedule *Θ* preserves program semantics *iff* for every dependence *(i,j) ∈ Dep_{S→T}*, *Θ_S(i) ≺ Θ_T(j)* lexicographically.
>
> *Proof sketch.* Violating a dependence reorders a producer after its consumer, changing values read. Conversely, any two instances whose relative order affects observable state are linked by a dependence chain (the Bernstein condition lifted to the polyhedral setting [2]); respecting every link yields a topological order of the dynamic dataflow graph, reproducing sequential semantics. ∎

### 4.2 Feautrier's Scheduling via Parametric Integer Programming

Feautrier's scheduling theory [2] seeks affine schedules that are valid *and* latency-minimal. For one-dimensional schedules *Θ_S(i) = u_S·i + v_S*, validity on *(i,j) ∈ P_{S→T}* is *u_T·j − u_S·i ≥ 1* (strict inequality normalized over integers). Farkas linearization (§2.4) converts this infinite family into a finite LP over the coefficients *u, v* plus non-negative multipliers.

Feautrier then *minimizes the dimensionality of time*: find the smallest *k* admitting a valid *k*-dimensional schedule, greedily satisfying as many dependences as possible at each outermost dimension. Outer satisfaction means sequential (loop-carried) structure; dependences satisfied only deeper expose *parallelism* at that level. This outermost-first discipline yields minimal-*latency* schedules — favoring *inner*, fine-grained parallelism that is often impractical on multicores [3][4].

PIP [1] enters whenever the scheduler computes lexicographic minima over parametric domains — e.g., the earliest valid schedule — returning piecewise-affine solutions correct for *all* parameter values, so generated code is correct for every runtime *N*.

Multidimensional schedules generalize directly: a *k*-dimensional schedule is valid iff every dependence is satisfied at *some* dimension — the first differing dimension orders the pair correctly. Feautrier's algorithm iterates: formulate the Farkas LP, minimize the count of *strongly satisfied* dependences at this level, recurse on the residue [2].

### 4.3 The Pluto Algorithm: Communication-Minimizing Affine Tiling

Feautrier optimizes *latency*, but modern architectures are dominated by *locality and communication*: the winning transformation is usually *tiling* — partitioning the iteration space into cache-resident blocks executed atomically, minimizing inter-tile data exchange. The **Pluto algorithm** [4] reformulates affine scheduling around this objective.

Pluto's objects are *tiling hyperplanes*: *d* linearly independent affine hyperplanes *φ₁…φ_d* whose lattice defines tiles. It works *level by level*, outermost first, solving at each level an ILP over hyperplane coefficients subject to:

1. **Validity (time-partition) constraints.** For each dependence polyhedron *P*, *φ(j) − φ(i) ≥ 0* for all *(i,j) ∈ P* (Farkas-linearized). Hyperplanes satisfying this for *all* dependences are fully permutable and tile rectangularly; weaker satisfaction yields pipelined parallelism.
2. **Linear independence** from previously found hyperplanes, guaranteeing an invertible transformation and legal tiling.
3. **The cost objective.** For dependence *e* with distance vectors *δ_e*, the *bounding value* *u_e = φ(j) − φ(i)* measures how far the hyperplane separates dependent instances. The ILP *minimizes the weighted sum of bounding values* across dependences — i.e., the *communication volume* between tiles and *reuse distance* within them [4]. A hyperplane orthogonal to short dependence distances cuts few edges, so tiles exchange little data.

The greedy level-by-level structure is the pragmatic compromise: one monolithic ILP for all dimensions is exponential (optimal tiling is NP-hard), so Pluto finds the best *single* hyperplane, removes strongly satisfied dependences, and recurses. Early hyperplanes expose *outermost*, coarse-grained, synchronization-free parallelism (`omp parallel for`); inner ones target locality and vectorization. Lexicographic objective layering adds fusion-friendliness (prefer hyperplanes parallel to existing ones) and scalar-dimension minimization [4].

Its signature achievement is *diamond (time) tiling*: for 1-D Jacobi with dependences *(1,1)* and *(1,−1)*, no rectangular tiling is legal, but the ILP discovers skewed hyperplanes *φ₁ = t*, *φ₂ = t + i* — a 45° rotation — under which the space tiles into diamonds that are both legal and concurrent [3]. The open-source `pluto` compiler chains Clan/PET extraction → ISL/candl dependence analysis → the Pluto transformer → CLooG code generation, emitting OpenMP C [4].

**Pluto+** [3] fixes the greedy heuristic's latency-blindness by *hybridizing*: it runs both the Pluto cost-driven search and a Feautrier-like latency-minimizing search, selecting per strongly-connected-component whichever wins, plus skew minimization (uncontrolled skewing produces bounds that defeat vectorizers [8]). The TOPLAS evaluation reports Pluto+ recovers Pluto's losses on latency-sensitive nests at only 2.04× polyhedral-optimization time in cases where the hybrid changes the outcome [3].

![Pluto affine scheduling and tiling hyperplanes](polyhedral-compilation-d3f4-1.webp)

### 4.4 The Integer Set Library: Sets, Maps, and Schedule Trees

**ISL** [7] is the modern computational substrate: a thread-safe C library (exact GMP arithmetic) for sets and relations of integer tuples bounded by affine constraints, with parameters and existential variables. Its syntax mirrors our definitions:

```
[N] -> { S[i, j] : 1 <= i < N and 1 <= j < N };
[N] -> { S[i, j] -> S[i - 1, j] : 1 <= i < N and 1 <= j < N };
```

Operations include intersection, union, difference, emptiness, convex hull, projection, transitive closure of maps, PIP-style lexicographic minimization via generalized basis reduction, and Barvinok-style point counting [7]. The `iscc` calculator and `islpy` bindings serve research and production alike — ISL powers GCC's Graphite, LLVM's Polly, and PPCG.

ISL's scheduling contribution is the **schedule tree**: domain nodes (iteration sets), band nodes (groups of permutable schedule dimensions with coincidence/parallelism annotations), filter, sequence, set, and leaf nodes. Pluto-style schedulers construct schedule trees directly — the time-partition ILP becomes constraints on band members — and the tree is *composable*: tiling is a transformation inserted on a band. It is the direct input to code generation.

### 4.5 Code Generation: From Schedule Trees to Loop Nests

Given a schedule tree, code generation must visit each instance exactly once in lexicographic schedule order. The classical Quilleré–Rajopadhye–Wilde algorithm (implemented in **CLooG**) recursively *separates* scheduled polyhedra by hyperplanes, projecting onto the outermost schedule dimension and recursing into slices. Its weakness is *code explosion* — exponential duplication in pathological cases — and bounds that can defeat vectorizers [8].

ISL's **`isl_ast_build`** works directly on the schedule tree:

1. **Coalescing** merges adjacent bands with compatible schedules, normalizing the tree so each band maps to a separable loop level.
2. **Separation** computes, per band dimension, piecewise lower/upper bounds as affine or `min`/`max` expressions in outer iterators and parameters, emitting a single loop per dimension — avoiding CLooG's duplication in the common cases.
3. **Annotation.** Emptiness checks prune dead branches; user callbacks insert `#pragma omp parallel for` on coincident bands or `#pragma ivdep` where analysis proves independence.

A minimal `islpy` sketch:

```python
import islpy as isl
# Iteration domain of S from section 4.1
D = isl.BasicSet("[N] -> { S[i, j] : 1 <= i < N and 1 <= j < N }")
# A skewed, Pluto-style schedule: (i, i + j)
sched = isl.BasicMap("[N] -> { S[i, j] -> [i, i + j] }")
node = isl.ScheduleNode.from_domain(isl.UnionSet.from_set(D))
node = node.child(0).insert_partial_schedule(
    isl.UnionMap.from_map(sched))
bld = isl.AstBuild.from_context(isl.Set("[N]"))
print(bld.node_from_schedule(node.root()).to_C_str())
```

The emitted C has bounds that are exact affine (or piecewise-affine) functions of `N` and outer iterators — correct for every runtime parameter value, with no runtime dependence test. This *static exactness* is the pipeline's payoff: all integer programming happens at compile time; the output is plain loops.

![ISL code generation: scanning parametric polytopes](polyhedral-compilation-d3f4-2.webp)

---

## 5 Empirical Results and Proofs

### 5.1 Validity via Farkas Linearization (Proof)

> **Theorem 2.** Let *P_e* be the dependence polyhedron of *e : S → T* with *A_e·(i,j) + B_e·p + c_e ≥ 0*, and *Θ_S(i) = u_S·i + v_S*, *Θ_T(j) = u_T·j + v_T* one-dimensional schedules. Then *Θ_S(i) < Θ_T(j)* for all *(i,j) ∈ P_e ∩ ℤ* iff there exist *λ₀, λ ≥ 0* with
>
> *(u_T·j − u_S·i − 1) − (λ₀ + λᵀ(A_e·(i,j) + B_e·p + c_e)) ≡ 0*
>
> as an affine identity in *(i, j, p)*.
>
> *Proof.* (⟸) For *(i,j) ∈ P_e*, the parenthesized term is non-negative (*λ ≥ 0*, constraints hold), so *u_T·j − u_S·i ≥ 1 > 0*. (⟹) The affine function *f(i,j) = u_T·j − u_S·i − 1* is non-negative over *P_e*; by the affine Farkas lemma [2], any such function is a non-negative combination of the defining constraints. ∎

This converts the *semantic* requirement (Theorem 1) into a *syntactic* LP over schedule coefficients — the bridge from mathematics to a compilable algorithm, extended dimension-by-dimension for multidimensional schedules [2].

### 5.2 Complexity Landscape

| Problem | Complexity | Consequence |
|---|---|---|
| Emptiness / projection of parametric polyhedra | Polynomial in constraints × dimensions | Dependence analysis never enumerates instances [5] |
| Parametric integer programming (lexmin) | Polynomial in fixed dimension | PIP practical for loop depths ≤ ~6; chambers can proliferate [1] |
| Optimal *k*-dimensional affine scheduling | NP-hard in general | Justifies greedy level-by-level heuristics [2][4] |
| Optimal tiling (shape + size) | NP-hard | Pluto's ILP + empirical tile-size search is the pragmatic answer [4] |
| CLooG/AST code generation | Worst-case exponential code size; polynomial in practice | `isl_ast_build` coalescing keeps output manageable [7] |

### 5.3 Reported Performance on PolyBench

PolyBench/C [9] is the standard suite: ~30 numerical kernels (*gemm*, *syrk*; stencils *jacobi-2d*, *seidel-2d*, *adi*, *fdtd-2d*; solvers *ludcmp*, *cholesky*; *covariance*, *correlation*) with MINI–EXTRALARGE datasets, every kernel a SCoP. Representative published figures (attributed, not reproduced):

- The Polyhedral Compilation Framework evaluation (PoCC, Pluto-family scheduling) reports improvement factors over sequential `-O3` baselines: *doitgen* 15.35×/14.27×, *varcovar* 7.24×/14.83×, *atax* 3.66×/1.88×, *correl* 3.00×/3.44×, *bicg* 1.75×/1.40×, *ludcmp* 1.98×/1.45×, *gemver* 1.34×/1.33× (Intel/AMD) — largest wins where tiling makes kernels cache-resident [6].
- A Single-ILP study on Intel Skylake (10 cores, GCC 7.2) reports e.g. *trmm* at 2.93×, with stencil analysis showing time tiling wins but uncontrolled skewing produces bounds defeating auto-vectorization — motivating Pluto+'s skew minimization [8][3].
- Pluto+ [3] recovers pure-Pluto losses on latency-sensitive nests at only 2.04× polyhedral-optimization time where the hybrid changes the schedule.

![Speedup comparison: polyhedral tiling vs baseline](polyhedral-compilation-d3f4-3.webp)

The consistent qualitative finding across a decade of studies: **automatic affine tiling yields 2–15× speedups on dense linear algebra and stencil kernels on multicores**, with variance explained by memory-boundedness, skewing/vectorization interaction, and dataset choices [3][4][6][8].

---

## 6 Limitations

1. **The affine restriction.** While-loops with data-dependent bounds, indirect accesses (`A[B[i]]`), and dynamic structures fall outside the model. Over-approximations exist but sacrifice the exactness that is the model's chief virtue.
2. **Compile-time cost.** Scheduling ILPs and PIP chamber decomposition grow quickly with loop depth and statement count; production compilers cap effort and fall back to no transformation.
3. **Code-generation quality.** Skewed schedules yield complex `min`/`max` bounds that can defeat vectorizers and bloat instruction caches; skew minimization [3] and bound simplification mitigate but do not eliminate this.
4. **Tile-size selection.** The Pluto ILP finds tile *shapes* (hyperplanes), not *sizes*; sizes come from heuristics or empirical search, and optima are machine- and dataset-dependent.
5. **Target gaps.** Classical cost models target multicore CPUs with coherent caches. GPUs (shared-memory staging, coalescing), distributed memory, and heterogeneous targets need extended models — active research.
6. **Parametric tiling.** Runtime-parametric tile sizes complicate both the ILP and code generation; implementations typically specialize on compile-time-constant sizes.

## 7 Conclusion

Polyhedral compilation remains the most principled framework for automatic loop-nest optimization: it replaces heuristic pattern-matching with *exact* integer geometry, where dependence analysis is set algebra, scheduling is parametric integer programming, and code generation is lattice-point enumeration. This thesis traced the pipeline — Feautrier's PIP [1] and scheduling theory [2], Pluto's communication-minimizing hyperplanes [4], the Pluto+ hybrid [3], and ISL's schedule trees and AST generation [7] — grounding each phase in theorems, a worked example, and published PolyBench evidence [6][8][9].

Open problems: *learned cost models* replacing hand-tuned ILP objectives with hardware-counter-trained predictors; *parametric tiling* with runtime tile sizes; *non-affine extensions* preserving exactness for wider program classes (ISL's piecewise-affine machinery gestures this way); and *verified* code generators emitting machine-checked proofs of semantic preservation. The enduring methodological lesson: when the mathematics is exact, transformations can be *proved* correct rather than merely tested — a standard the rest of compiler optimization would do well to emulate.

---

## References

[1] P. Feautrier. "Parametric integer programming." *RAIRO Recherche Opérationnelle*, 22(3):243–268, 1988. http://www.numdam.org/item/RO_1988__22_3_243_0.pdf

[2] On the optimality of affine schedules — LNCS chapter analyzing Feautrier-style multidimensional time scheduling, validity constraints, and the affine form of Farkas' lemma. https://link.springer.com/content/pdf/10.1007/3-540-45706-2_39.pdf

[3] U. Bondhugula, A. Acharya, and A. Cohen. "The Pluto+ Algorithm: A Practical Approach for Parallelization and Locality Optimization of Affine Loop Nests." *ACM TOPLAS*, 38(3), 2016. DOI: 10.1145/2896389. https://inria.hal.science/hal-01425546

[4] U. Bondhugula, M. Baskaran, S. Krishnamoorthy, J. Ramanujam, A. Rountev, and P. Sadayappan. "Automatic Transformations for Communication-Minimized Parallelization and Locality Optimization in the Polyhedral Model." *ETAPS CC*, Budapest, 2008. Tool and full citation: https://github.com/bondhugula/pluto/blob/HEAD/README.md

[5] T. Grosser et al. "polyhedral.info" — community survey of the polyhedral model's theory, history, and tools (PIP, Polylib, Omega, ISL). https://github.com/tobiasgrosser/polyhedral.info/blob/HEAD/index.md

[6] The Polyhedral Compilation Framework — PoCC/Pluto-family evaluation reporting improvement factors over sequential baselines on Intel/AMD (e.g., doitgen 15.35×/14.27×, atax 3.66×/1.88×). https://wiki.rice.edu/confluence/download/attachments/38735209/comp515-lec22-f11-v1.pdf?api=v2

[7] S. Verdoolaege. "isl: An Integer Set Library for the Polyhedral Model." *ICMS 2010*, LNCS 6327, pp. 299–302, Springer, 2010. Source and manual: https://github.com/Meinersbur/isl — Tutorial: https://libisl.sourceforge.io/tutorial.pdf

[8] "A Performance Vocabulary for Affine Loop Transformations." arXiv:1811.06043. PolyBench evaluation of Single-ILP vs. Pluto-style scheduling on Intel Skylake. https://arxiv.org/pdf/1811.06043

[9] L.-N. Pouchet. PolyBench/C — the polyhedral benchmark suite (30 kernels; MINI–EXTRALARGE datasets). https://www.cs.colostate.edu/~pouchet/software/polybench/
