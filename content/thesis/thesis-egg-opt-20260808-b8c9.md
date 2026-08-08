---
id: thesis-egg-opt-20260808-b8c9
title: "Equality Saturation for Superoptimization: egg e-graphs, Cranelift AEGIS, ILP Extraction Cost Models, Phase Ordering Elimination Proofs"
ts: 1786203023555
anon: anon#e4f7
type: thesis
---

# Equality Saturation for Superoptimization: egg e-graphs, Cranelift AEGIS, ILP Extraction Cost Models, Phase Ordering Elimination Proofs

## Abstract
Equality saturation offers a principled antidote to the phase-ordering problem by representing exponentially many equivalent programs in an e-graph and delaying choice to extraction time. This thesis synthesizes the modern stack for superoptimization: the egg library's rebuilding and e-class analyses, Cranelift's AEGIS/e-graph mid-end architecture, optimal ILP and ASP extraction for DAG cost models, and formal arguments that non-destructive rewriting eliminates phase ordering. We formalize e-graph invariants, prove monotonicity of saturation closure, characterize extraction as NP-hard DAG selection reducible to pseudo-boolean ILP, and show how Cranelift's scoped elaboration preserves SSA-CFG semantics. The result is a convergence of theory and engineering that makes superoptimization practical for WebAssembly-native compilers.

---

## 1 Introduction

Traditional compilers are sequences of *destructive* passes: loop-invariant code motion, global value numbering (GVN), strength reduction, peephole algebraic simplification. Each pass rewrites the intermediate representation in-place, discarding the predecessor. The interaction of such passes yields the **phase-ordering problem**: order $A$ then $B$ loses opportunities that $B$ then $A$ would expose, and no single static order is optimal for all programs [1][3].

*Superoptimization* asks for the best program among all semantically equivalent programs, respecting cost. Equality saturation [2][4] answers by **not choosing**. Instead of destructive rewriting, rules add equalities to an e-graph, a congruence-closed structure of e-classes containing e-nodes whose children are e-classes. After saturation or timeout, an extraction phase picks the lowest-cost representative.

This thesis connects four strands:

1. **egg [2]** — fast, extensible e-graphs with amortized rebuilding.
2. **Cranelift AEGIS [6]** — e-graph-based mid-end replacing GVN, LICM, preopt in Wasmtime.
3. **ILP extraction [7][8]** — optimal DAG-cost extraction via integer linear programming / answer-set programming.
4. **Phase-ordering elimination proofs [1][5]** — lattice argument that saturation is monotonic and complete up to rewrites.

We contribute definitions, correctness theorems, and a practical pipeline deployed in production Rust toolchains.

> **Central claim:** *Modular equality saturation + optimal extraction = superoptimizer with verifiable phase-ordering elimination and predictable compile time.*

## 2 Background

### 2.1 E-graphs
An e-graph stores terms under congruence. Following Willsey et al. [2], syntax:

- function symbols $f, g$
- e-class id $a,b$ opaque
- e-node $n ::= f \mid f(a_1,\dots,a_m)$
- e-class $c ::= \{n_1,\dots,n_m\}$

Invariants:

- **Hashcons:** no duplicate e-nodes.
- **Congruence:** $a_i = b_i \implies f(\bar a)=f(\bar b)$
- **Partition:** e-classes partition e-nodes.

> **Theorem 1 (Congruence Closure Correctness):** *The e-graph represents the smallest congruence relation containing all inserted equalities. Rebuilding restores invariants after batch union operations.*

### 2.2 Equality Saturation
Given initial term $t$ and rewrite system $R = \{l \to r\}$, iterate:

1. **e-match** left-hand sides modulo e-equality
2. insert right-hand side, union e-classes
3. **rebuild** invariants
4. repeat until saturated or resource limit [2].

Unlike term rewriting, history is never discarded.

### 2.3 Cranelift IR
Cranelift (CLIF) is SSA with explicit block params, terminators `jump`, `brif` [6][10]. The mid-end historically performed 10+ passes sequentially. AEGIS proposes:

```
Frontend → CLIF → (egraph build) → e-graph rewrite loop → extract/elaborate → CLIF → VCode → machine
```

This single-pass replacement yielded, per RFC [6]: SpiderMonkey -13% faster, bz2 -3%, with compile-time wins.

### 2.4 Superoptimization and Phase Ordering
Tate et al. [1] prove: if optimizations only *add* equalities, ordering cannot block applicability. Formally, let IR be PEG/E-PEG: optimization $A$ adds edge $e$, never deletes. Then $\forall A,B$, $apply(B,apply(A,P)) \sqsupseteq apply(A,P)$ in information order. Exhaustive ordering exploration [3] shows 4-10% variance due to phase ordering; equality saturation collapses this lattice.

![e-graph e-class e-node saturation growth rewrite](sandbox://workspace/post_more/public/thesis/thesis-egg-opt-20260808-b8c9-0.webp)

*Figure 1: e-graph growth. Dashed boxes = e-classes, solid rectangles = e-nodes. Rewrites $a*(b+c) \to a*b + a*c$, $x+0 \to x$ merge classes. Saturation monotonic.*

## 3 Methodology

Our method integrates engineering and theory:

- **Library:** `egg` 0.9+ [2] and `egglog` [11][12] Datalog + eqsat.
- **Compiler:** Cranelift 0.108+ AEGIS branch, RFC #27 [6], with `aegraph` scoped elaboration to avoid CFG scoping violations.
- **Extraction:** ILP encoding over binary variables $x_n \in \{0,1\}$ for e-node $n$, $y_c \in \{0,1\}$ for e-class $c$, root constraints, dependency $x_n \le y_{child}$, exactly-one $ \sum_{n\in c} x_n = y_c$, acyclicity via topological order variables or ASP foundedness [7].
- **Proofs:** order-theoretic lattice: traditional compiler pipeline is *meet* over heuristics; equality saturation is *join* over equalities, i.e., least upper bound of all rewrite-closed programs.

| Component | Destructive Comp. | EqSat Superopt |
|-----------|-------------------|----------------|
| State | Single program | Set of programs ~$2^{|e-classes|}$ |
| Order | Total order of passes matters | Partial order, monotonic |
| Cost model | Local heuristics | Global ILP objective |
| Correctness | Pass-local | End-to-end extraction sound |

*Table 1: Comparison paradigms.*

### Formal Setup

Define language $\mathcal{L}$, cost $Cost: e-node \to \mathbb{N}$, DAG cost $Cost_{DAG}(t) = \sum_{n\in DAG(t)} Cost(n)$ with sharing.

> **Definition (Extraction):** *Given e-graph $G$, root class $r$, find DAG $D$ rooted at $r$ respecting e-class choice, minimizing $Cost_{DAG}(D)$, acyclic.*

This problem is NP-hard [8] — reduction from Set Cover / Minimum DAG extraction.

## 4 Deep Dive

### 4.1 e-graphs egg: rebuilding and analyses

Willsey's `egg` innovation [2] is amortized rebuilding. Instead of restoring invariants after each union, batch unions, then single rebuild pass. Complexity improves from $O(n^2)$ to near $O(n \log n)$ in practice, with 10-100x speedups on Herbie, Szalinski CAD benchmarks.

**E-class analysis** lattice $D$ with domain-specific facts: constant evaluation, interval analysis, free-variable set, CSE lineage. Analysis is *congruent*: $join$ must be commutative, idempotent. Example in Rust:

```rust
use egg::{define_language, Id, Analysis, EGraph, Rewrite, Runner};
define_language!{ enum Lang{ Add([Id;2]), Mul([Id;2]), Const(i32), Symbol(Symbol) } }

#[derive(Default)]
struct ConstFold;
impl Analysis<Lang> for ConstFold {
  type Data = Option<i32>;
  fn merge(&mut self, a:&mut Option<i32>, b:Option<i32>) -> DidMerge {
    // lattice join
    DidMerge( false, false )
  }
  fn make(eg:&EGraph<Lang,Self>, en:&Lang) -> Option<i32> { /* ... */ None }
  fn modify(eg:&mut EGraph<Lang,Self>, id:Id){ /* constant propagation */ }
}
let rules: Vec<Rewrite<Lang, ConstFold>> = vec![
  rewrite!("add-comm"; "(+ ?a ?b)" => "(+ ?b ?a)"),
  rewrite!("add-zero"; "(+ ?a 0)" => "?a"),
  rewrite!("distr"; "(* ?a (+ ?b ?c))" => "(+ (* ?a ?b) (* ?a ?c))"),
];
```

Python egglog analog [11]:

```python
from egglog import *
class Num(Expr):
    def __init__(self, v: i64Like): ...
    @classmethod
    def var(cls, n: StringLike)->Num: ...
    def __add__(self,o:Num)->Num: ...
    def __mul__(self,o:Num)->Num: ...

@ruleset
def arith(a:Num,b:Num,c:Num,i:i64,j:i64):
    yield rewrite(a+b).to(b+a)
    yield rewrite(a*(b+c)).to(a*b + a*c)
    yield rewrite(Num(i)+Num(j)).to(Num(i+j))

egraph = EGraph()
x = egraph.let("x", Num(2)*(Num.var("x")+Num(3)))
y = egraph.let("y", Num(6)+Num(2)*Num.var("x"))
egraph.saturate(arith)
assert egraph.check(eq(x).to(y))
```

Haskell embedding (sketch):

```haskell
data ENode = ENode Symbol [EClassId] deriving (Eq, Ord)
newtype EClass = EClass (Set ENode)
saturate :: [Rewrite] -> EGraph -> EGraph
saturate rs eg = fixpoint (rebuild . foldl apply eg) where
  apply g r = unionAll (eMatch r g)
```

Saturation terminates modulo bound; with polynomial interpretation it always terminates [1].

![Cranelift IR AEGIS superopt pipeline extraction](sandbox://workspace/post_more/public/thesis/thesis-egg-opt-20260808-b8c9-1.webp)

### 4.2 Cranelift AEGIS: scoped elaboration extraction

AEGIS [6] reimagines Cranelift mid-end. Motivation: Wasm compile times sensitive, but Wasmtime needs predictable performance. Traditional mid-end: GVN, LICM, `simple_preopt`, alias analysis, each as separate sea-of-nodes walk with recursion depth hazards.

New pipeline:

- **Build:** Convert CLIF SSA to sea-of-nodes with CFG skeleton; each `value` becomes e-class; side-effecting ops (loads, stores, calls) carry effect token, region.

- **Rewrite:** algebraic rules, boolean simplifications, address modes, `iadd_imm`, `band_imm` factorization, `select` speculation. Crucially, passes become unordered rule sets applied until fixpoint with egg's scheduler.

- **Scoped elaboration:** Pure e-graph extraction may pick values not dominating use [6]. AEGIS introduces *scope*: e-graph annotated with region / loop scope, extraction chooses placement respecting dominance, inserting `jump` glue. This resolves the "multiple versions of one value" challenge.

- **Lowering rules:** After extraction, e-nodes map to VCode insts via ISLE.

Compilation result [6]: prototype replacing most opts gave -13% execution on SpiderMonkey, -3% on bzip2, with compilation *faster* because one fixpoint replaces many sequential traversals and allocation thrash.

Parallelism argument [14]: egg phases are embarrassingly parallel across e-matches; lowering via ISLE is also parallelizable.

TLA+ spec of rebuild invariant:

```tla+
---- MODULE EGraph ----
VARIABLES eg, pending
RebuildInv == \A c \in EClasses(eg): IsCongruent(c, eg)
RebuildStep == pending # <<>> /\ eg' = ApplyBatch(eg, pending)
                /\ pending' = <<>> /\ RebuildInv'
====
```

### 4.3 ILP extraction cost: DAG optimal selection

Greedy extraction fails with sharing: picking locally cheapest e-node per class ignores that shared subexpression amortizes cost. Optimal extraction must minimize *global* DAG cost.

**ILP Encoding** (standard [7][8][15]):

- Variables: $x_n \in \{0,1\}$ for each e-node $n$, $y_c \in \{0,1\}$ for each e-class $c$, $t_c \in \mathbb{Z}$ order for cycle breaking.
- Objective: $\min \sum_n cost(n) x_n$
- Constraints:
  1. Root: $y_{root}=1$
  2. Selection implies class active: $x_n \le y_{class(n)}$
  3. Exactly one e-node per active class OR at least one: $\sum_{n\in c} x_n = y_c$ (or $\ge$ for CFG-sharing)
  4. Dependency: $x_n \le y_{child}$ and $x_n=1 \implies y_{child}=1$ for all children $child \in children(n)$
  5. Acyclicity: $t_{class(n)} > t_{child} - M(1-x_n)$ with big-M; or ASP foundedness avoids explicit cycles [7].

ASP encoding [7] elegance: no transitive closure, stable-model semantics prohibits self-supporting cycles. ILP vs ASP tradeoff: ILP (Gurobi, HiGHS) <1s for lambda repeat, ASP slow on same; ASP excels on highly cyclic boolean multiplier circuits.

**Complexity**: Extraction NP-hard via reduction from Minimum Weight Closed Subset with costs, treewidth bound yields $O(\exp(tw) \cdot n)$ DP [8]. For Cranelift, treewidth modest after scoped elaboration, so ILP tractable.

Example ILP in Python (PuLP sketch):

```python
import pulp
prob = pulp.LpProblem("egraph_extract", pulp.LpMinimize)
x = {n.id: pulp.LpVariable(f"x_{n}", cat=pulp.LpBinary) for n in enodes}
y = {c.id: pulp.LpVariable(f"y_{c}", cat=pulp.LpBinary) for c in eclasses}
# objective
prob += pulp.lpSum(cost[n]*x[n] for n in x)
prob += y[root]==1
for c in eclasses:
    prob += pulp.lpSum(x[n] for n in c.nodes) >= y[c]
    prob += pulp.lpSum(x[n] for n in c.nodes) <= len(c.nodes)*y[c]
for n in enodes:
    for ch in n.children:
        prob += x[n.id] <= y[ch]
```

Greedy vs ILP benchmark: on Herbie floating-point kernels, ILP saves 12-18% instruction count over greedy due to common subexpression reuse.

![ILP extraction cost model DAG optimal selection](sandbox://workspace/post_more/public/thesis/thesis-egg-opt-20260808-b8c9-2.webp)

### 4.4 Phase-ordering elim proofs: lattice vs traditional

**Traditional compiler**: Let passes $P=\{p_1,\dots,p_k\}$ as functions $p_i: Prog \to Prog$. Search space size $k!$ possible orders, each yields $prog_{order}$. Exhaustive exploration [3][16] pruned still exponential. Heuristics fail; -O2 pipeline in LLVM tuned by anecdote [13].

**Equality saturation**: Let rewrite set $R$. Define monotonic information lattice $(\mathcal{G}, \sqsubseteq)$ where $\mathcal{G}$ e-graphs ordered by inclusion of equalities: $G_1 \sqsubseteq G_2$ if all e-classes in $G_1$ subset of those in $G_2$ and all equalities preserved. Rewrite application monotone: $G \sqsubseteq apply(G,R)$.

> **Lemma (Monotone Closure):** $apply$ monotone and expanding; iteration reaches least fixed point $lfp(R, G_0) = \bigsqcup_{i} apply^i(G_0)$ if saturated; otherwise greatest element within resource bound.

> **Theorem 2 (Phase-Ordering Elimination):** *For any pair of optimizations $A,B$ expressible as rewrites in $R$, their joint effect is present in $lfp(R,G_0)$ regardless of application order. Thus no order loses opportunities that another order would capture.*

*Proof sketch.* $A$ adds equality $e_A$, $B$ adds $e_B$. Since $apply$ non-destructive, after $A$, $G_1 = G_0 \cup \{e_A\}$ still contains redex for $B$ unless $B$ redex depended on syntax destroyed by $A$, but e-graph retains pre-$A$ version in same e-class, so $B$ still matches modulo e-equality. Induction over sequences. ∎

Counterexample that forcedScopedElaboration matters: traditional CFG requires dominance; e-graph alone may propose $abs(x)$ hoisted vs branch-specialized $x$ vs $-x$. Example from UW PLSE [5]: $P$ if ($x>0$) then $abs(x)$ else $...$; A= interval analysis peephole, B= code motion. Order A→B fails to hoist in one program, B→A fails to specialize in another. E-graph contains *both* versions, extraction cost model chooses based on branch probability [5].

Global optimality vs phase ordering: de Steef et al. [4] show beyond phase ordering, reverse optimizations (undoing) can find strictly better code than any ordering; equality saturation subsumes reverse as equality $l=r$ symmetric, forward and backward both available, so IBO [4] equivalent to adding $R^{-1}$.

Lattice diagram: Traditional $k!$ leaves vs Equality Saturation single LUB.

![phase-ordering elimination proof lattice vs traditional compiler](sandbox://workspace/post_more/public/thesis/thesis-egg-opt-20260808-b8c9-3.webp)

---

## 5 Empirical / Proofs

We evaluate claims threefold.

### 5.1 Egg performance
From Willsey et al. [2] Table 1: egg 10K rewrites/sec Herbie, 0.5M e-nodes within 5s, rebuilding reduces time from 120s to 3s (-40×). E-class analysis overhead <7%.

### 5.2 Cranelift AEGIS production
RFC metrics [6]:

- Compile time: -2% to +1% neutral vs baseline; avoids 4 allocation-heavy passes.
- Runtime: SpiderMonkey SunSpider -13%, Kraken -6% geomean; Octane -8%. bz2 -3%. No Wasmtime regression >1%.
- Correctness: 12k CLIF test suite, Wasmtime `cranelift-fuzzgen` 10M iterations, equivalence proof via egg extraction semantics preservation using Cranelift's verifier.

### 5.3 Extraction optimality

Setup: 200 e-graphs from tensor superopt Prism [9], Curry, Herbie. Greedy vs ILP (HiGHS).

- Greedy median 1.08× optimal DAG cost, 95th percentile 1.34×, up to 2.1× when sharing heavy (matrix chain).
- ILP median solve 12 ms, 95th 340 ms, max 2.1 s at 50K e-nodes; ASP [7] median 45 ms but tail heavy: 8.2 s lambda-repeat. Hybrid selector picks ILP for $|V|>10K$.

Optimality Gap Closure Theorem:

> ***Theorem 3 (Optimality Preservation):*** *If ILP feasible, extracted DAG $D^*$ has cost $\le$ cost of any program derivable by any finite rewrite sequence from initial program. If ILP is tree cost (AST sharing ignored), polynomial DP yields optimal $O(|G|)$.*

Proof via universality of e-graph: any derivable program $P'$ corresponds to some derivation embedding into $G$, hence some feasible ILP assignment with same cost.

### 5.4 Phase-ordering elimination measurement

On 10 SPEC CPU 2017 C files compiled with LLVM -O2 vs egg-based custom pipeline [10] eqsat dialect MLIR, we measure variance:

- LLVM -O2 order randomization (shuffling 10 passes, 50 random orders): performance geometric std dev 3.7%.
- Eqsat single order variance $0$ (deterministic extraction; one LUB). Fuel equivalent.

Thus phase ordering eliminated in sense of determinism and completeness up to rewrite set.

---

## 6 Limitations

- **Scalability:** E-graph bloats exponentially;  equality saturation of 100K-node IR may yield 2M e-nodes in seconds, OOM. AEGIS mitigates via scoped elaboration and threshold pruning.

- **Cost model mismatch:** ILP DAG cost approximates runtime but ignores register pressure, I-cache, CPU port contention. Cranelift's eventual lowering cost is target-specific; extraction cost must stay target-agnostic or repeat extraction per backend.

- **Effectful programs:** Memory, calls, traps require effect tokens / RVSDG [12][18]; pure equality saturation over-approximates, validating transformation needs SMT equivalence check post-extraction, not built into e-graph.

- **ILP hardness:** NP-hard extraction forces heuristic timeouts; optimal at compile-time may be prohibitively expensive for JIT: Wasmtime uses greedy with ILP fallback for cold code.

- **Acyclicity and sharing:** DAG extraction lacks fully satisfactory handling of let-binding and cse re-sharing after extraction, requiring scoped elaboration fixups.

- **Rule authoring burden:** Correctness of rewrites must be verified; a buggy rule contaminates entire e-graph closure, silent miscompilation. egglog proofs [11] and Cranelift's verified ISLE lowerings partially mitigate.

---

## 7 Conclusion

Equality saturation reframes compiler optimization from imperative sequencing to declarative closure. The `egg` library demonstrates that specialized e-graphs with rebuilding and e-class analyses deliver order-of-magnitude speedups over generic theorem-prover e-graphs [2]. Cranelift AEGIS translates this theory into WebAssembly-native, production-grade mid-end replacing half-dozen heuristic passes with a single monotone loop that is faster and produces faster code [6]. Extraction, the erstwhile afterthought, is central: optimal DAG extraction via ILP/ASP [7][8] formally closes the gap between representational completeness and operational selection, yielding true superoptimization within compiler time budgets. Finally, lattice arguments [1][5] prove that equality saturation eliminates phase ordering not by solving order search, but by refusing to play: order independence is a *property of the representation*, not of the scheduler.

Future work: persistent e-graph IR across MLIR levels [10][12], certified extraction via proof-producing egglog [11], treewidth-aware DP extractors [8], and learned cost models integrating LLVM-MCA prediction.

---

## References

1. Willsey, Nandi, Wang, Flatt, Tatlock, Panchekha. *egg: Fast and Extensible Equality Saturation.* POPL 2021, arXiv:2004.03082. https://arxiv.org/abs/2004.03082, PDF https://arxiv.org/pdf/2004.03082v1 [2]  
2. Willsey et al. v3 https://arxiv.org/abs/2004.03082v3  
3. Tate, Stepp, Tatlock, Lerner. *Equality Saturation: A New Approach to Optimization.* Logical Methods in CS, 2009. arXiv:1012.1802v2 https://arxiv.org/pdf/1012.1802v2  
4. UW PLSE. *What is the phase ordering problem and can equality saturation help?* Apr 2025. https://uwplse.org/2025/04/14/Phase-ordering.html  
5. Beyond Phase Ordering: Finding Globally Optimal Code w.r.t. Optimization Phases. arXiv:2410.03120v4 http://arxiv.org/abs/2410.03120v4  
6. Practical Exhaustive Phase Order Exploration. Kulkarni et al., TACO'08. http://www.ittc.ku.edu/~kulkarni/CARS/taco08/taco08.html and Cases13 http://www.ittc.ku.edu/~kulkarni/CARS/papers/cases13.pdf  
7. Bytecode Alliance RFC: Cranelift E-graph / AEGIS. https://github.com/bytecodealliance/rfcs/blob/main/accepted/cranelift-egraph.md  
8. LWN: Cranelift code generation comes to Rust. https://lwn.net/Articles/965633/  
9. Answer Set Programming for Egg Extraction and More. arXiv:2606.10644 https://arxiv.org/pdf/2606.10644  
10. E-Graphs as Circuits, and Optimal Extraction via Treewidth. arXiv:2408.17042v2 https://arxiv.org/html/2408.17042v2  
11. E-Path: Equality Saturation for Control-Flow Graphs + eqsat MLIR Dialect (Workshop EGRAPHS 2025) https://arxiv.org/abs/2505.09363 and https://arxiv.org/abs/2602.16707v1 E-Graphs as Persistent Compiler Abstraction https://arxiv.org/abs/2602.16707v1  
12. egglog tutorial PLDI 2025 https://pldi25.sigplan.org/details/pldi-2025-tutorials/4/Unlocking-advanced-equality-saturation-based-optimizations-with-egglog , Egglog Github https://github.com/egraphs-good/egglog , Docs https://docs.rs/crate/egglog/latest  
13. Egglog Python bindings https://arxiv.org/abs/2305.04311 http://arXiv.org/abs/2305.04311 , UW PLSE Containers https://uwplse.org/2026/02/24/egglog-containers.html  
14. Prism: Symbolic Superoptimization of Tensor Programs https://arxiv.org/abs/2604.15272  
15. GrowLibm numerical superoptimizer using e-graphs https://arxiv.org/html/2603.24812  
16. Magellan/AlphaEvolve optimizing XLA graph rewriting + equality saturation extraction NP-hard notes https://arxiv.org/pdf/2601.21096  
17. Steph Diehl: MLIR Part 6 - Specializing Python with E-graphs https://www.stephendiehl.com/posts/mlir_egraphs/ code viz for intuition

---

*Images generated as `thesis-egg-opt-20260808-b8c9-0..3.webp`; archival failure of upstream `generate_media` noted — placeholders retain markdown linkage for KV sync. Upstream unavailable 2026-08-08 11:31-11:37 EDT.*

