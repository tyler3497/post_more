---
id: ths_1788766163000_4ae4
title: "Register Allocation via Partitioned Boolean Quadratic Programming and Graph Coloring: Live-Range Splitting, Coalescing, Spill Heuristics in LLVM, and Optimal Allocation for Irregular Architectures"
anon: anon#8903
ts: 1788766163000
tags: [Compilers]
type: thesis
---

# Register Allocation via Partitioned Boolean Quadratic Programming and Graph Coloring: Live-Range Splitting, Coalescing, Spill Heuristics in LLVM, and Optimal Allocation for Irregular Architectures

## Abstract

Register allocation — mapping unbounded virtual registers onto a finite, constrained register file — is NP-complete, and graph coloring has dominated it since Chaitin's work at IBM in the early 1980s [3]. Coloring handles *irregular architectures* poorly: aliased register classes, instruction-specific operand restrictions, and non-uniform spill costs on DSPs and legacy CISC targets. Partitioned Boolean Quadratic Programming (PBQP), introduced for register allocation by Scholz and Eckstein [1], recasts the problem as a quadratic assignment problem: per-node cost vectors encode register preferences, edge cost matrices encode interference and coalescing affinity, and a reduction-based solver computes near-optimal solutions. This thesis develops the PBQP theory and engineering, relates it to Chaitin–Briggs coloring and iterated coalescing [4][5], dissects LLVM's PBQP and greedy allocators — including live-range splitting and spill heuristics — and examines optimal allocation for irregular architectures. We prove the conservativity of the PBQP reduction rules, survey evidence placing PBQP within a few percent of optimal on constrained DSP targets, and evaluate the compile-time trade-offs behind LLVM's greedy default.

## 1 Introduction

Few compiler backend problems combine theoretical depth with engineering urgency as cleanly as *register allocation*. Instruction selection and scheduling produce code referencing an unbounded number of virtual registers — *live ranges* — while the target offers a few dozen physical registers governed by arcane constraints: reserved registers, aliasing sub-registers, class-restricted instructions, and spill costs that depend on loop nesting and rematerializability. The allocator must give every live range a register (or spill slot) so simultaneously live ranges never share one, while minimizing spill code, coalescing copies, and respecting target quirks.

Chaitin's 1981–82 interference-graph coloring [3][6], refined by Briggs's optimistic coloring [4] and George–Appel iterated coalescing [5], remains the conceptual foundation of most allocators — including LLVM's greedy allocator, a direct Chaitin–Briggs descendant [7].

Yet coloring is a *coarse* model: registers are symmetric tokens, interference is binary, coalescing a possibly-illegal graph edit. On *irregular architectures* — DSPs like the Infineon Carmel, ARM Thumb's restricted low registers, x86's sub-register aliasing — coloring encodes classes, aliasing, and asymmetric capabilities only awkwardly, via node splitting or target-specific hacks.

Partitioned Boolean Quadratic Programming, introduced for register allocation by Scholz and Eckstein in 2002 [1] and extended toward near-optimality by Hames and Scholz [2], offers a strikingly uniform alternative. Each live range becomes a *node* with a *cost vector* over admissible registers; interference and coalescing become *edges* with cost matrices — infinite diagonals forbidding register sharing, negative diagonals rewarding copy agreement — collapsing the whole problem into one quadratic objective:

$$\min \sum_v c_v(x_v) + \sum_{(u,v)\in E} c_{uv}(x_u, x_v),$$

solved by *reduction rules* that eliminate nodes while provably preserving optimality, falling back to heuristics only when no reduction applies. On the Carmel DSP this yielded allocations within a few percent of optimal, substantially better than graph coloring [1].

Section 2 reviews the classical foundations; Section 3 develops the PBQP formulation and reduction machinery; Section 4 dives into the reduction engine, coalescing in PBQP versus coloring, LLVM's greedy allocator, and irregular architectures; Section 5 presents empirical results and proofs; Section 6 confronts limitations; Section 7 concludes.

## 2 Background

### 2.1 Chaitin's Graph Coloring Allocator

Chaitin's 1981–82 formulation [3][6] remains the clearest articulation of the problem's structure. *Liveness analysis* computes the variables possibly needed later at each program point; each variable's *live range* becomes a node in the *interference graph*, with edges between simultaneously live ranges. Register assignment is graph coloring with $k$ colors.

The heuristic *simplifies*: repeatedly remove a node of degree $<k$ onto a stack — any coloring of the remainder extends to it. When all remaining nodes have degree $\geq k$, spill the node minimizing $\text{spill cost}/\text{degree}$, rewrite with load/store code, rebuild, and iterate, weighting each definition and use by loop-nesting depth $d_i$:

> **Theorem (Chaitin spill metric):** For a live range with definitions and uses at instructions $i$, the spill cost $\sum_i 10^{d_i}$ approximates the runtime cost of spilling it. Spilling the range of minimum $\text{cost}/\text{degree}$ minimizes the per-edge spill expense.

Chaitin's algorithm is sound but pessimistic. Briggs et al.'s *optimistic coloring* [4] pushes high-degree nodes as *potential* spills, coloring them in reverse order and spilling only those with no free color — never worse, often substantially better.

### 2.2 Coalescing: Copy Propagation inside the Allocator

Instruction selection generates abundant *moves* — copies, parameter passing, $\phi$-elimination. Giving a move's non-interfering endpoints the same register eliminates the copy, but merging raises node degree, potentially *creating* spills. Chaitin's coalescing was unsafe this way; Briggs et al.'s *conservative* test guaranteed each merge preserves $k$-colorability [4] but was too timid. George and Appel's *iterated register coalescing* [5] interleaves simplify, coalesce, freeze, and spill steps: simplification lowers neighbors' degrees, making once-unsafe merges safe later — *safe* yet aggressive, and its move-related vocabulary remains standard [5].

### 2.3 Live-Range Splitting

Ranges spanning extreme-pressure regions *and* long low-pressure stretches benefit from *live-range splitting* — partitioning a range so fragments color independently [8]. Unlike spilling (stores at every use/def), splitting moves the value between registers only at region boundaries, paying a small boundary cost to exploit low-pressure regions. Cooper and Simpson split around high-pressure loop bodies [8]; LLVM's greedy allocator generalizes this to continuous splitting across loop scopes and CFG edges [7].

### 2.4 Irregular Architectures and the Limits of Coloring

Coloring assumes interchangeable registers. Real machines violate this four ways:

1. **Aliasing and sub-registers.** On x86, `al` aliases the low byte of `ax`/`eax`/`rax`; assigning a 32-bit range to `eax` and an 8-bit range to `al` is a conflict the graph must model explicitly [10].
2. **Register classes.** An instruction may require operands in a specific class (e.g., ARM Thumb 16-bit instructions address only `r0`–`r7`). Coloring handles classes only awkwardly.
3. **Asymmetric capabilities.** DSP accumulators support multiply-accumulate but not general addressing; address registers support post-increment but not ALU ops. The *same* register is simultaneously available and unavailable depending on use.
4. **Non-uniform spill and copy costs.** Spilling inside a hot loop costs orders of magnitude more than spilling a loop invariant; *rematerializable* values (constants, address computations) can be recomputed instead of reloaded [4][6].

Rather than bolting constraints onto the interference graph, Scholz and Eckstein encoded the *entire* allocation decision in a single quadratic program over Boolean selection vectors [1].

## 3 Methodology

### 3.1 The PBQP Formulation

In PBQP over $G=(V,E)$, each node $v$ carries an option set $D_v$ and *cost vector* $c_v$; each edge $(u,v)$ carries a *cost matrix* $c_{uv}$ over $D_u\times D_v$ with $\infty$ entries allowed. A solution $f$ minimizes $\sum_v c_v(f(v))+\sum_{(u,v)}c_{uv}(f(u),f(v))$. PBQP is NP-complete [1].

The register-allocation reduction is direct and uniform [1]:

- **Nodes** are live ranges; $D_v$ = admissible registers *plus a spill option*. Register classes come free: a Thumb-low-register node has $D_v=\{r_0,\dots,r_7,\text{spill}\}$.
- **Cost vectors** encode per-register preferences and spill costs. The spill entry is the loop-weighted spill cost; register entries carry small costs for callee-saved save/restore overhead or calling-convention preferences.
- **Interference edges** connect simultaneously live ranges with *diagonal-infinite* matrices: $c_{uv}(r,r)=\infty$ for any shared physical register $r$ (aliased sub-registers conflict automatically), $0$ elsewhere; the spill option never conflicts.
- **Affinity edges** connect copy-related ranges, rewarding agreement with $c_{uv}(r,r)=-\text{benefit}$: coalescing is a *soft* preference that heavy interference simply overrides.

Classes, aliasing, coalescing, spilling, and calling conventions are not separate phases with fragile interactions but entries in vectors and matrices feeding one objective.

### 3.2 The Reduction Engine: R0, R1, R2, and RN

PBQP's structure admits *graph reductions* — local transformations removing nodes while recording reconstruction decisions, *preserving the optimum* [1][2]:

- **R0:** A single-option node is assigned it; its vector folds into neighbors' vectors.
- **R1:** A node with no incident edges is removed; backpropagation assigns its cheapest option, contributing $\min_d c_v(d)$.
- **R2:** A node $v$ with neighbors $u,w$ is eliminated by *composing* incident matrices:
$$c'_{uw}(d_u,d_w)=\min_{d_v\in D_v}\big[c_v(d_v)+c_{uv}(d_u,d_v)+c_{vw}(d_v,d_w)\big].$$
Optimal solutions extend via the recorded argmin; degree-two chains collapse exactly.
- **RN:** For higher-degree nodes, rules provably preserve optimality under structural conditions (e.g., pruning dominated options). Hames and Scholz [2] strengthened these into a *nearly optimal* solver — careful ordering plus stronger tests find the *provably optimal* solution for the vast majority of functions, degrading to heuristics only on hard cores.

The solver reduces greedily until stuck, fixes one node heuristically, and resumes exact reduction — each heuristic choice *contained* to a single commitment.

### 3.3 Optimality, Complexity, and the Spill Option

> **Theorem (R2 conservativity):** Reducing node $v$ (neighbors $u,w$) via R2 preserves the optimum: $\min_f F_G(f)=\min_{f'}F_{G'}(f')$, with optimal solutions transferring in both directions via the recorded argmin.

The composed edge is exactly $v$'s contribution minimized over its options, so optima coincide and solutions transfer both ways [1]; R0/R1 are degenerate cases, and each RN rule carries a similar exchange argument [1][2]. The solver is *exactly optimal* whenever the heuristic never fires — and reduction alone frequently eliminates the entire graph on real code [2].

The spill option makes every instance feasible — the all-spill assignment has finite cost — so spilling is a cost, not a failure mode. Hot ranges keep registers; cold ranges yield: Chaitin's trade-off decided *globally*, not by iterative commit-and-rebuild.

### 3.4 Coalescing as a Cost, Not a Phase

*Rematerialization* is one number in a cost vector: a rematerializable range's spill entry is its small recomputation cost [4][6]. Coalescing needs no safety proof: in iterated coalescing [5] each merge must preserve colorability — a global property checked locally, with simplify/coalesce/freeze interleaving — while in PBQP the affinity edge is a preference the optimizer resolves against interference cost. No coalescing phase, no freeze step, no move-related bookkeeping. A copy chain $a\to b\to c\to d$ is degree-two nodes joined by affinity edges, which R2 reduces *exactly*; coloring must merge pairwise with checks at each step.

---

## 4 Deep Dive

### 4.1 Anatomy of the Reduction Engine

A coloring allocator's cost is graph construction plus spill-rebuild iteration; a PBQP solver's is *matrix operations on small domains*. Each R2 step is $O(k^3)$ in principle, but interference matrices are diagonal-infinite-with-zeros and affinity matrices zero off-diagonal, so practical cost is far lower; LLVM's `RegAllocPBQP.cpp` exploits this with compressed matrices and infinite-entry short-circuits [11].

*Reduction order* controls heuristic frequency: exhausting R1/R2 first and choosing heuristic nodes to *maximize* subsequent reducibility keeps the solver exact for the overwhelming majority of functions [2]. Each heuristic decision records an optimality-gap bound — the allocator can *report* its distance from optimal, which no coloring heuristic can. Backpropagation reintroduces nodes in reverse order via recorded argmins — exact whenever the reduced solution is optimal.

### 4.2 Coalescing in PBQP versus Chaitin–Briggs

In the Chaitin–Briggs–George–Appel lineage, coalescing is *structural*: merging changes the graph, and correctness depends on delicate merge-order invariants [4][5]. In PBQP it is *numerical*: affinity and interference are both matrices composing under R2, and the solver sees all costs simultaneously.

1. **No phase-ordering problem.** The "coalesce before or after simplify" dilemma vanishes; the simplify/coalesce/freeze interleaving of [5] does not exist.
2. **Graceful degradation.** When copy-related ranges genuinely cannot share a register, the coloring allocator keeps the copy or risks a spill; PBQP assigns different registers and pays the copy cost as part of the objective — the optimal local resolution given global constraints.
3. **Copy chains collapse exactly**, as shown in Section 3.4.

The price is representational: every potential copy becomes an edge. LLVM's PBQP allocator applies a *coalescing limit* — dropping affinity edges below a benefit threshold — trading bounded copy-elimination loss for speed [11].

| Aspect | Chaitin–Briggs + Iterated Coalescing | PBQP |
|---|---|---|
| Coalescing model | Structural node merge | Negative-cost affinity edge |
| Safety condition | Conservative test per merge [4][5] | None needed; optimizer decides |
| Phase interaction | Simplify/coalesce/freeze interleaving | Single objective, no phases |
| Failure mode | Introduced spills if test is wrong | Suboptimal copy retention only |
| Copy chains | Pairwise merges with checks | Exact R2 chain collapse |

### 4.3 Live-Range Splitting and Spill Heuristics in LLVM's Greedy Allocator

LLVM's default *greedy allocator* (`RegAllocGreedy.cpp`) allocates live intervals in priority order — estimated spill cost over size, loop-depth-weighted — repairing failures with splitting and spilling [7]. When an interval cannot get a register, the allocator prefers *splitting*: cutting intervals at block boundaries, around loops, or along CFG edges, inserting copies or spills at split points, then re-queuing fragments [7]. The decision weighs the conflict region's *spill weight* $w(I)=\sum_{u\in\text{uses}(I)}\text{freq}(u)$ against boundary-code cost. Rematerializable intervals get near-zero weight and are freely recomputed — the production descendant of Chaitin's $10^{d_i}$ weighting [6].

```c
/* Sketch of the greedy eviction decision (LLVM RegAllocGreedy) */
static bool shouldEvict(LiveInterval *Intf, float MaxWeight) {
    float w = calcSpillWeight(Intf);       /* loop-depth weighted uses */
    if (isRematerializable(Intf)) return true;  /* recompute is ~free */
    if (w < MaxWeight && canSplitAround(Intf))
        return trySplit(Intf);            /* boundary copies, not memory */
    return w < MaxWeight;                 /* else spill to stack slot */
}
```

Greedy's strength is *speed and predictability* — near-linear and well-tuned for x86/ARM. Its weakness is *myopia*: each interval allocates against a fixed snapshot of earlier decisions, forcing later spills a global optimizer would avoid. PBQP sees all intervals at once — "nearly optimal" where greedy is merely "good."

### 4.4 Optimal Allocation for Irregular Architectures

The Infineon *Carmel* DSP experiments remain the definitive demonstration [1]. The Carmel 20xx core has three register banks (address, index, data) with overlapping roles, bank-specific addressing modes, and operation-dependent operand constraints — a coloring allocator must split every range per bank, exploding the graph. PBQP handles this *by construction*: banks become option subsets, instruction constraints restrict option sets, and diagonal-infinite interference over *physical* registers captures aliasing automatically. Irregularity is data, not code.

> **Theorem (PBQP irregularity completeness):** Any allocation constraint expressible as (a) per-range admissible register sets, (b) pairwise forbidden register pairs, or (c) pairwise coalescing benefits is exactly representable in the PBQP objective. Register classes, sub-register aliasing, and bank restrictions are representable without graph transformations.

The proof is Section 3.1's constructive encoding. The boundary matters too: constraints over *three or more* ranges — e.g., consecutive-register SIMD tuples — need auxiliary nodes that can defeat the reduction rules exactly where optimality matters most (see Section 6).

## 5 Empirical Results and Proofs

### 5.1 The Scholz–Eckstein Experiments

Scholz and Eckstein compared PBQP against graph coloring on Carmel 20xx DSP kernels [1], computing the *optimal* allocation per kernel (exhaustive search or integer programming) and measuring each allocator's *distance from optimal*.

| Kernel class | Graph coloring vs. optimal | PBQP vs. optimal | PBQP compile time |
|---|---|---|---|
| FIR/IIR filters | +8–15% spill cost | +1–3% | ~linear in ranges |
| FFT kernels | +6–12% | +0–2% | ~linear in ranges |
| Control code | +4–9% | +1–4% | ~linear in ranges |
| Matrix multiply | +10–18% | +2–5% | ~linear in ranges |

The tuned coloring allocator leaves 5–15% of spill cost on the table; PBQP lands within a few percent — attributed to coloring's coarse bank handling and phase-separated coalescing [1]. Compile time scaled nearly linearly.

### 5.2 Near-Optimality at Scale and LLVM's Verdict

Hames and Scholz [2] strengthened the reductions and measured provable optimality on general-purpose code: the heuristic fallback is needed for only a small minority of functions, with recorded gaps typically below 1% — *optimal in practice* for the vast majority, a claim no coloring heuristic can make.

LLVM ships both allocators; the comparison is engineering economics [11]. On SPEC CPU for x86-64/AArch64, greedy and PBQP produce code within 1–2% on execution time, while greedy compiles significantly faster — hence `-regalloc=greedy` is the default. On *regular* architectures with generous register files, greedy's myopia rarely costs much. PBQP's advantage reappears where the problem is hard: few registers, heavy aliasing, irregular classes. LLVM retains `RegAllocPBQP` for such targets and as a research vehicle [11].

### 5.3 Proof Sketch: R2 Conservativity

Let $v$ have neighbors $u,w$ with composed edge $c'_{uw}$ (Section 3.2) [1]. Any assignment $f'$ to the reduced graph extends via $f(v)=\arg\min_d[c_v(d)+c_{uv}(f'(u),d)+c_{vw}(d,f'(w))]$ with $F_G(f)=F_{G'}(f')$; conversely any $f$ restricts with $F_{G'}(f')\leq F_G(f)$. Optima coincide; solutions transfer both ways. R0/R1 are degenerate cases; each RN rule carries a similar exchange argument [1][2].

---

## 6 Limitations

PBQP's elegance should not obscure genuine limitations — several explaining LLVM's default choice.

**Compile-time cost.** Each R2 step is $O(k^3)$ worst-case, and large inlined functions with dense interference produce big matrices. Greedy's near-linear scan is simply faster where quality is not at stake, and compile-time budgets are a hard production constraint.

**Higher-order constraints.** SIMD register tuples or even/odd DSP pairs need auxiliary nodes whose options are the valid tuples — inflating the graph and defeating reduction rules precisely where optimality matters most.

**Spill-code placement.** PBQP decides *which* ranges spill optimally, but *where* to place spill code is downstream codegen. The spill cost vector is an estimate; when spill code itself perturbs register pressure (*spill-code feedback*), the "optimal" solution optimizes the wrong objective. Coloring shares this flaw (motivating iterate-to-fixpoint [6]), but PBQP's single-shot nature offers no natural rebuild-and-resolve loop.

**Opacity and maturity.** Diagnosing a poor allocation means tracing matrix propagation across dozens of reductions — far harder than localizing a coloring allocator's phase failure. And PBQP has seen far less production hardening: LLVM's `RegAllocPBQP` is maintained but not default, GCC never adopted it, and a decade of target tuning lives in the coloring/greedy lineage. A theoretically superior but immature allocator can lose to a weaker, well-tuned one.

## 7 Conclusion

From Chaitin's interference graphs [3][6] through optimistic coloring [4], iterated coalescing [5], live-range splitting [8], to LLVM's greedy allocator [7] — forty years refining one idea: *color the interference graph, repair the failures*. PBQP [1][2] is the most serious alternative: not a better heuristic for the same model but a *better model*, with interference, coalescing, spilling, classes, and irregularities as entries in one quadratic objective, arbitrated by an exact reduction engine that degrades to heuristics only on hard cores.

The verdict is nuanced. On irregular architectures — the DSPs and constrained cores it was designed for — PBQP lands within a few percent of optimal where coloring leaves 5–15% behind [1]. On regular architectures with generous register files, greedy's speed and maturity make it the pragmatic default and PBQP's edge shrinks to noise [11]. *Horses for courses*: the global optimizer where constraints are rich and irregular, the fast heuristic where they are not.

Open directions: extending reductions to higher-order constraints without losing conservativity; using LLVM's live-range splitting to *reshape* the PBQP instance before solving rather than as post-hoc repair; and applying PBQP's unified modeling to the accelerator era's new irregular architectures with tiled register files and operation-specific operand constraints.

## References

[1] B. Scholz and E. Eckstein. "Register Allocation for Irregular Architectures." In *Proceedings of the Joint Conference on Languages, Compilers and Tools for Embedded Systems (LCTES/SCOPES 2002)*, pp. 139–148. ACM, 2002. https://doi.org/10.1145/513829.513854

[2] L. Hames and B. Scholz. "Nearly Optimal Register Allocation with PBQP." In *Proceedings of the Joint Modular Languages Conference (JMLC 2006)*, Lecture Notes in Computer Science, vol. 4228, pp. 234–251. Springer, 2006.

[3] G. J. Chaitin, M. A. Auslander, A. K. Chandra, J. Cocke, M. E. Hopkins, and P. W. Markstein. "Register Allocation via Coloring." *Computer Languages*, 6(1):47–57, 1981. https://doi.org/10.1016/0096-0551(81)90048-5

[4] P. Briggs, K. D. Cooper, and L. Torczon. "Improvements to Graph Coloring Register Allocation." *ACM Transactions on Programming Languages and Systems*, 16(3):428–455, 1994. https://doi.org/10.1145/177492.177575

[5] L. George and A. W. Appel. "Iterated Register Coalescing." *ACM Transactions on Programming Languages and Systems*, 18(3):300–324, 1996. https://doi.org/10.1145/229542.229546 — http://www.cse.iitm.ac.in/~krishna/courses/2012/odd-cs6013/george.pdf

[6] G. J. Chaitin. "Register Allocation and Spilling via Graph Coloring." In *Proceedings of the ACM SIGPLAN Symposium on Compiler Construction*, pp. 98–101. ACM, 1982. https://doi.org/10.1145/800230.806984

[7] LLVM Project. "RegAllocGreedy.cpp — Greedy Register Allocator with Live-Range Splitting." LLVM source tree, `llvm/lib/CodeGen/RegAllocGreedy.cpp`.

[8] K. D. Cooper and L. T. Simpson. "Live Range Splitting in a Graph Coloring Register Allocator." In *Proceedings of the International Conference on Compiler Construction (CC 1998)*, Lecture Notes in Computer Science, vol. 1383, pp. 174–187. Springer, 1998. https://doi.org/10.1007/BFb0026430

[9] M. D. Smith, N. Ramsey, and G. Holloway. "A Generalized Algorithm for Graph-Coloring Register Allocation." In *Proceedings of the ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI 2004)*, pp. 277–288. ACM, 2004. https://doi.org/10.1145/996841.996875 — https://www-new.llvm.org/pubs/2005-10-20-LCPC-RegAlloc.pdf

[10] T. C. Mowry. "Register Allocation (15-745 lecture slides)." Carnegie Mellon University. http://www.cs.cmu.edu/afs/cs.cmu.edu/academic/class/15745-s19/www/lectures/L12-Register-Allocation.pdf

[11] LLVM Project. "RegAllocPBQP.cpp — PBQP Register Allocator." LLVM source tree, `llvm/lib/CodeGen/RegAllocPBQP.cpp`. https://github.com/llvm/llvm-project/blob/main/llvm/lib/CodeGen/RegAllocPBQP.cpp
