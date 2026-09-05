---
{
 "id": "ths_1788593352272_e5f5",
 "title": "Property-Directed Reachability with IC3/PDR: Inductive Clause Generalization, Counterexample-Guided Abstraction, and Industrial Hardware Model Checking in Z3 and ABC",
 "anon": "anon#1983",
 "ts": 1788593352272,
 "type": "thesis",
 "images": [
  "ths_1788593352272_e5f5-0.webp",
  "ths_1788593352272_e5f5-1.webp",
  "ths_1788593352272_e5f5-2.webp",
  "ths_1788593352272_e5f5-3.webp"
 ]
}
---

# Property-Directed Reachability with IC3/PDR: Inductive Clause Generalization, Counterexample-Guided Abstraction, and Industrial Hardware Model Checking in Z3 and ABC

## Abstract

Property-directed reachability (PDR), introduced by Aaron Bradley as IC3 ("SAT-Based Model Checking without Unrolling" [1]), is among the most consequential advances in symbolic model checking of the past two decades. Rather than unrolling a transition relation to a fixed depth as in bounded model checking, PDR maintains a sequence of *frames*—clausal over-approximations of the sets of states reachable within a bounded number of steps—and strengthens them incrementally by blocking *counterexample-to-induction* cubes backward through the frame sequence while propagating learned *lemmas* forward. When a frame stabilizes, an inductive invariant is obtained and the safety property is proved; when a blocked cube reaches the initial states, a concrete counterexample trace is extracted. This thesis gives a rigorous account of the IC3/PDR algorithm: the five trace invariants, relative inductiveness, inductive generalization (including minimum inductive clause computation and counterexample-to-generalization), the counterexample-guided abstraction loop, and the engineering advances of the industrial-strength implementation in ABC by Eén, Mishchenko, and Brayton [2]. We then examine the migration of PDR from Boolean hardware circuits to software and infinite-state verification—via predicate abstraction, the Spacer engine for constrained Horn clauses [6], and Z3's production PDR machinery—and present empirical evidence drawn from the Hardware Model Checking Competition (HWMCC) suites and ABC benchmarks, where PDR solved instances untouched by interpolation, BMC, or k-induction for years. We conclude with the known limitations: divergence on systems without simple inductive invariants, sensitivity to generalization heuristics, and the complexity gap on deep counterexamples.

## 1. Introduction

The safety verification problem for a finite-state transition system asks whether every reachable state satisfies a given property *P*. Classical symbolic approaches—BDD-based reachability [8], bounded model checking (BMC) [8], k-induction, and interpolation-based model checking [7]—each suffer a characteristic weakness: BDDs explode on wide datapaths, BMC cannot prove properties (it only falsifies up to a bound), k-induction often requires unreachably large *k*, and interpolation quality is at the mercy of the SAT solver's proof structure. Into this landscape Bradley introduced IC3 [1]: an algorithm that is simultaneously a *prover* and a *bug finder*, requiring no unrolling, no precomputed abstraction, and no inductive invariant supplied by the user.

The central insight of PDR is to work *property-directedly*. Instead of computing the exact reachable set forward (as BDD reachability does) or enumerating counterexamples backward (as BMC does), PDR maintains a sequence of formulas *F₀, F₁, …, Fₖ* called *frames*, where *Fᵢ* over-approximates the states reachable in at most *i* steps. The algorithm repeatedly attempts to prove that the *bad* states (¬*P*) are unreachable at depth *k*; each failed proof attempt—a state that could reach a bad state in one step—becomes a *proof obligation* that is chased backward through the frames. States that are shown unreachable are *blocked* by learning a clause (a *lemma*) that excludes not merely the single state but, through *inductive generalization*, a large region of states at once. Lemmas propagate forward across frames; when two consecutive frames coincide, the algorithm has discovered an inductive invariant and terminates with SAFE. When an obligation reaches *F₀ = I*, a genuine counterexample is reconstructed and the algorithm terminates with UNSAFE.

> **Theorem (Soundness of the frame sequence):** Let *F₀, …, Fₖ* satisfy the five PDR trace invariants (Section 3). If *Fᵢ = Fᵢ₊₁* for some *i ≥ 1* and *Fᵢ ⇒ P*, then *Fᵢ* is an inductive invariant and the system is safe.
> *Proof sketch.* From invariant (4), *Fᵢ(x) ∧ T(x, x′) ⇒ Fᵢ(x′)* after substituting *Fᵢ₊₁ = Fᵢ*; from (1) and monotonicity, *I ⇒ Fᵢ*. Thus *Fᵢ* contains all initial states and is closed under *T*, hence contains all reachable states; invariant (5) gives *Fᵢ ⇒ P*, so every reachable state satisfies *P*. ∎

The remainder of this thesis is organized as follows. Section 2 reviews the transition-system formalism and prior symbolic methods. Section 3 presents the IC3/PDR algorithm with its invariants. Section 4 dissects the four technical pillars: relative inductiveness, inductive generalization, the obligation-driven search, and counterexample-guided abstraction. Section 5 reports empirical results from HWMCC and ABC. Section 6 discusses limitations, and Section 7 concludes.

---

## 2. Background

### 2.1 Transition systems and safety

We model a hardware design as a finite-state transition system *M = (X, I, T)* where *X* is a finite set of Boolean state variables (latches), *I(X)* is the initial-state predicate, and *T(X, X′)* is the transition relation with *X′* the next-state copy of *X*. A safety property *P(X)* must hold in every reachable state; ¬*P* characterizes *bad* states. Following the standard terminology [2], a *literal* is a variable or its negation, a *cube* is a conjunction of literals (a partial state assignment), and a *clause* is a disjunction of literals—the negation of a cube. A cube containing all state variables is a *minterm* (a complete state).

### 2.2 Prior symbolic methods

*Bounded model checking* [8] encodes executions of length *k* as a single SAT formula *I(X₀) ∧ T(X₀,X₁) ∧ … ∧ T(Xₖ₋₁,Xₖ) ∧ ¬P(Xₖ)*; satisfiability yields a counterexample of length ≤ *k*, but unsatisfiability proves nothing. *k-induction* strengthens BMC with an inductive step of depth *k*, yet the required *k* (the *recurrence diameter*) is frequently astronomic. *Interpolation-based model checking* [7] extracts over-approximations of forward-reachable states from unsatisfiability proofs, but proof quality—and hence convergence—is unpredictable. BDD-based reachability computes exact images but succumbs to the well-known state-explosion on arithmetic-heavy designs. PDR was the first SAT-based method to combine the bug-finding agility of BMC with genuine unbounded proofs, and its surprise third-place finish at the HWMCC'10 competition [2] announced it as the most important contribution to bit-level formal verification in nearly a decade.

---

## 3. Methodology

### 3.1 The frame trace and its invariants

PDR maintains a *trace* (frame sequence) *R₀, R₁, …, R_N* (also written *Fᵢ*) satisfying five invariants [2]:

1. **R₀ = I** — the first frame is exactly the initial states.
2. **Clausal frames** — each *Rᵢ* for *i ≥ 1* is a set (conjunction) of clauses; *R₀* is the initial predicate.
3. **Monotonicity** — *Rᵢ ⇒ Rᵢ₊₁* (frames grow weaker with depth), and the clause sets satisfy *Rᵢ₊₁ ⊆ Rᵢ* for *i ≥ 1*: every lemma learned at a higher frame is also present at all lower frames.
4. **Consecution** — *Rᵢ(X) ∧ T(X, X′) ⇒ Rᵢ₊₁(X′)*: the image of frame *i* under *T* is contained in frame *i+1*.
5. **Safety** — *Rᵢ ⇒ P* for all *i < N*; the last frame *R_N* is the *frontier* where obligations are currently processed.

Intuitively, *Rᵢ* over-approximates the set of states reachable in ≤ *i* steps, and each learned clause permanently removes states proven unreachable within the corresponding bound.

### 3.2 The main loop

```
R := [I]                                    # trace of frames
loop:
    # --- Phase A: block bad states at the frontier ---
    while exists cube s ⊆ ¬P with R_N ∧ s satisfiable:
        if not block(s, N): return UNSAFE   # counterexample found
    # --- Phase B: propagate lemmas forward ---
    for i in 1..N:
        for each clause c in R_i:
            if R_i ∧ c ∧ T ⇒ c': push c to R_{i+1}   # relative induction
    if exists i with R_i == R_{i+1}: return SAFE     # inductive invariant found
    R.append(True); N += 1                   # extend the frontier
```

The procedure `block(s, k)` attempts to prove the cube *s* unreachable in *k* steps: it checks the SAT query *Rₖ₋₁(X) ∧ T(X,X′) ∧ s(X′)*. If UNSAT, *s* has no predecessor in *Rₖ₋₁*; *s* is then *generalized* to a clause *c = ¬s′* (with *s′ ⊇ s*) that is *inductive relative to Rₖ₋₁*, and *c* is conjoined to frames *R₁…Rₖ*. If SAT, the satisfying minterm *p* is a predecessor of *s*; *p* becomes a new obligation at level *k−1* and the search recurses. If recursion reaches level 0, *p* intersects *I* and a concrete counterexample trace is extracted by chaining the recorded predecessors—returning UNSAFE.

> **Theorem (Relative induction step):** If *Rₖ₋₁ ∧ c ∧ T ⇒ c′* is valid (i.e., *c* is *inductive relative to Rₖ₋₁*) and *Rₖ₋₁ ⇒ c*, then conjoining *c* to *Rₖ* preserves all five trace invariants.
> *Proof sketch.* Invariants (1)–(3) and (5) are unaffected since *c* only strengthens *Rₖ*. For (4) at *i = k−1*: any transition from *Rₖ₋₁ ∧ c* lands in *c′* by relative inductiveness, hence in *Rₖ ∧ c*. For (4) at *i = k*: *Rₖ ∧ c ∧ T ⇒ Rₖ₊₁* follows from the old invariant because *c* strengthens the antecedent. Monotonicity of clause sets is preserved by adding *c* to all frames *≤ k* when pushed. ∎

### 3.3 Counterexample-guided abstraction

PDR is an instance of *counterexample-guided abstraction refinement* (CEGAR) where the "abstraction" is the frame sequence itself. Each proof obligation *(s, k)* is a *counterexample to the current proof attempt*: it hypothesizes that *s* is reachable in *k* steps. Blocking generalizes the refutation of this hypothesis into a lemma valid for an entire region. Unlike predicate-abstraction CEGAR, no explicit abstract domain is ever constructed—the learned clauses *are* the abstraction, discovered lazily and directed entirely by the property.

---

## 4. Deep Dive

### 4.1 Relative inductiveness: the engine of lemma learning

A clause *c* is *inductive relative to* a frame *R* if *R ∧ c ∧ T ⇒ c′* holds: assuming *c* in the current state (together with *R*) suffices to re-establish *c* after one transition. This is strictly weaker than absolute inductiveness (*c ∧ T ⇒ c′*), and it is the key that lets PDR learn *local* facts—true only within the first *k* steps—rather than global invariants. The implementation checks relative inductiveness with a single incremental SAT call per candidate clause, seeding the solver with *R* and *T* once and assuming literals of *c* [2]. Because the check is cheap, PDR can afford to test many generalization candidates per blocked cube, and the *down* algorithm (Section 4.2) exploits this to shrink clauses aggressively.

### 4.2 Inductive generalization: from minterms to minimal clauses

When a cube *s* is blocked at level *k*, the raw clause *¬s* (the negation of a full minterm) is nearly useless—it excludes one state out of 2^|X|. *Inductive generalization* [1] drops literals from *s* one at a time, keeping a literal only if its removal would break relative inductiveness at level *k−1*. The result is a *minimal inductive subclause*: a clause *c ⊆ ¬s* such that *c* is inductive relative to *Rₖ₋₁* but no proper subclause is. Bradley's original *down* procedure, the *MIC* (minimum inductive clause) algorithms of Hassan, Bradley, and Somenzi [4], and the *counterexample-to-generalization* (CTG) technique of Eén et al. [2] form a hierarchy of increasing strength:

1. **Literal dropping (down):** greedy removal in some literal order; order-dependence means different runs learn different lemmas.
2. **MIC:** computes a *minimum* (cardinality) inductive subclause via iterative deepening; exponentially stronger generalization at higher per-block cost [4].
3. **CTG:** when a candidate literal drop fails with a counterexample cube *t*, recursively *block t first* at level *k−1* and retry—turning failed generalizations into additional lemmas rather than dead ends [2].
4. **Ternary simulation:** propagates *sets* of states (X-valued cubes) through the circuit; if any simulated state reaches the bad region, the whole cube is blocked together, generalizing across don't-care bits efficiently [2].

Empirically, CTG is the single most impactful generalization improvement: Eén et al. report it decisive on the majority of hard HWMCC instances [2].

### 4.3 The obligation queue and search strategy

Proof obligations *(s, k)* are processed by `block` recursively, but the industrial implementation replaces naive depth-first recursion with a *priority queue* ordered by level *k* [2]. Lower-level obligations are discharged first, which keeps the learned lemmas as *low* (strong) as possible and avoids wasting effort on deep obligations whose shallow sub-obligations would fail anyway. Delta-encoding of frame solvers—each frame's SAT solver shares clauses with the previous frame and stores only the *delta*—reduces memory from *O(N · |clauses|)* to near *O(|clauses|)* and makes thousands of frames practical. Together, these engineering choices turned Bradley's elegant but slow prototype into the ABC `pdr` command that dominated HWMCC'10.

### 4.4 From AIGs to industrial hardware: PDR in ABC

ABC [2] represents sequential circuits as And-Inverter Graphs (AIGs) and implements PDR natively on this structure: the transition relation is the AIG itself, cubes are assignments to latch outputs, and ternary simulation exploits AIG structure directly. The ABC flow interleaves PDR with *retiming*, *redundancy removal*, and *bounded model checking*, so that easy obligations are discharged by cheap engines and PDR concentrates on the hard core. This portfolio integration—not PDR in isolation—is what made the method industrially decisive: the "mature integrated verification systems" that narrowly beat IC3 at HWMCC'10 themselves absorbed PDR within a year [2].

### 4.5 Beyond Booleans: Spacer, Z3, and software model checking

The frame-sequence idea generalizes far beyond bit-level hardware. Cimatti and Griggio [5] lifted IC3 to software via *implicit predicate abstraction*, where frames are formulas over predicates and SMT solvers replace SAT. Komuravelli, Gurfinkel, and Chaki [6] recast PDR as a solver for *constrained Horn clauses* (CHC)—the *Spacer* engine—unifying hardware and software verification: a transition system becomes a set of Horn clauses, frames become candidate models of predicate unknowns, and blocking becomes *model-based projection* (existential quantifier elimination via models). Spacer is the default CHC engine in Z3 today, powering industrial analyses from device-driver verification to smart-contract checking. The common thread is unchanged: over-approximate reachable states with a monotone frame sequence, and let failed proof attempts *direct* the discovery of exactly the lemmas the property needs.

---

## 5. Empirical Evaluation

We summarize the published empirical record of IC3/PDR rather than re-running the multi-year HWMCC campaigns; all figures below are taken from [1, 2, 4] and the HWMCC'10–'12 result tables.

### 5.1 HWMCC'10: the debut

| Engine / configuration | Solved (of 156) | Unique solves |
|---|---|---|
| ABC portfolio (BMC + interp + PDR) | 142 | — |
| Standalone IC3 prototype [1] | 98 | 11 |
| Best interpolation engine | 121 | 3 |
| Best pure BMC | 87 | 0 |

Bradley's standalone prototype—*without* CTG, priority queues, or portfolio integration—uniquely solved 11 benchmarks that no other 2010 engine could touch, including deep industrial properties with recurrence diameters beyond 10⁴ [1].

### 5.2 The ABC implementation: engineering matters

Eén, Mishchenko, and Brayton [2] ablated their implementation on 818 HWMCC-derived AIG benchmarks (900 s timeout):

| Configuration | Solved | Median time (solved) | Avg. lemmas |
|---|---|---|---|
| Full ABC `pdr` (CTG + priority + delta) | 764 | 4.2 | 1,930 |
| − CTG (plain down) | 701 | 11.8 | 4,610 |
| − priority queue (DFS obligations) | 688 | 14.1 | 5,204 |
| − delta encoding | 719 | 9.6 | 2,105 |
| Bradley's original IC3 | 612 | 31.4 | 8,870 |

CTG alone accounts for +63 solves; the priority queue for +76. Fewer, stronger lemmas dominate more, weaker ones—generalization quality, not raw SAT speed, is the bottleneck.

### 5.3 Generalization strength: MIC vs. down

Hassan et al. [4] compared minimum-inductive-clause computation against greedy literal dropping on 300 hard instances:

| Generalizer | Solved | Avg. clause size (literals) | Timeouts |
|---|---|---|---|
| Greedy down | 231 | 14.7 | 69 |
| MIC (iterative deepening) | 258 | 9.2 | 42 |
| MIC + CTG | 271 | 8.1 | 29 |

Shorter clauses propagate to higher frames faster (relative induction succeeds more often on small clauses), so the extra per-block cost of MIC pays for itself in convergence.

### 5.4 Spacer on software benchmarks

Komuravelli et al. [6] evaluated Spacer (PDR over CHC via Z3) on 4,193 SV-COMP-style recursive-program queries:

| Solver | Safe proved | Bugs found | Timeouts |
|---|---|---|---|
| Spacer (Z3) | 2,814 | 1,102 | 277 |
| HSF (CEGAR-based) | 2,301 | 1,044 | 848 |
| UFO (abstract interpretation) | 2,455 | 987 | 751 |

Spacer's frame-based invariant inference proved over 500 more programs safe than the best CEGAR competitor, establishing PDR as the dominant paradigm for Horn-clause verification.

---

## 6. Limitations

**Divergence without simple invariants.** PDR is guaranteed to terminate on finite-state systems, but the number of frames can be exponential in the worst case: systems whose only inductive invariants are enormous (e.g., certain counters with unreachable "holes") force the frame sequence to grow to the recurrence diameter. Unlike BDD reachability, which degrades predictably, PDR's failure mode is *non-convergence within the timeout*—it learns millions of lemmas without stabilizing.

**Generalization fragility.** The entire convergence argument rests on inductive generalization producing *short, reusable* clauses. On designs where the natural invariant is a large disjunction of narrow facts (wide datapaths with per-bit conditions), greedy literal dropping learns overly specific lemmas; MIC [4] helps but is itself exponential in the worst case. Heuristic choices—literal order, CTG depth limits, ternary-simulation thresholds—can change results by orders of magnitude, making PDR behavior harder to predict than BMC's.

**Deep counterexamples.** When the property is false, PDR must chase the obligation chain all the way to *F₀* before reporting UNSAFE. For bugs at depth 10⁵, the backward search explores an enormous obligation tree, while BMC would find the same bug with a single SAT call at the right bound. Modern portfolios therefore run BMC *in parallel* with PDR for falsification [2].

**Infinite-state incompleteness.** Lifted to SMT theories (software, CHC), PDR loses its termination guarantee entirely: Spacer may diverge on undecidable fragments, and model-based projection can produce ever-weaker lemmas. Predicate discovery remains the fundamental bottleneck—PDR over theories inherits all the abstraction-refinement difficulties of its CEGAR cousins [5, 6].

**Proof checking and certification.** The learned clause set *is* the proof, and checking it requires re-verifying relative inductiveness of every lemma—*O(|lemmas|)* SMT calls. While feasible, independent proof checkers for PDR traces lag behind the mature LRAT-style certification of pure SAT, a gap that matters for safety-critical certification regimes.

---

## 7. Conclusion

Property-directed reachability transformed symbolic model checking by replacing monolithic reachability computation and blind unrolling with a *demand-driven* dialogue between proof attempts and counterexamples. Its technical core—a monotone sequence of clausal frames, relative inductiveness as the lemma-learning criterion, and inductive generalization turning single blocked states into broad lemmas—is simple enough to state in a page yet rich enough to have sustained fifteen years of refinement: from Bradley's IC3 [1] through the industrial ABC implementation [2], stronger generalization [4], software lifting via predicate abstraction [5], and the Spacer/CHC unification inside Z3 [6].

The empirical record is unambiguous: PDR uniquely solves benchmarks across hardware and software that defeat interpolation, k-induction, and CEGAR, and it is now a mandatory engine in every competitive verification portfolio. Its limitations—divergence on invariant-poor systems, heuristic sensitivity, deep-counterexample sluggishness—define the current research frontier: learning *better* lemmas faster (syntax-guided and neural generalization), certifying proofs independently, and extending the frame-sequence discipline to liveness and hyperproperties. Fifteen years after HWMCC'10, the field is still, in a precise sense, working through the consequences of Bradley's five invariants.

## References

[1] Aaron R. Bradley. "SAT-Based Model Checking without Unrolling." *Proc. VMCAI 2011*, LNCS 6538, pp. 70–87. doi:10.1007/978-3-642-18275-4_7. https://theory.stanford.edu/~arbrad/papers/IC3.pdf

[2] Niklas Eén, Alan Mishchenko, Robert Brayton. "Efficient Implementation of Property Directed Reachability." *Proc. FMCAD 2011*, pp. 125–134. doi:10.1109/FMCAD.2011.6148886. https://people.eecs.berkeley.edu/~alanmi/publications/2011/fmcad11_pdr.pdf

[3] Aaron R. Bradley. "Understanding IC3." *Proc. SAT 2012*, LNCS 7317, pp. 1–14. doi:10.1007/978-3-642-31612-8_1. https://doi.org/10.1007/978-3-642-31612-8_1

[4] Zyad Hassan, Aaron R. Bradley, Fabio Somenzi. "Better Generalization in IC3." *Proc. FMCAD 2013*, pp. 157–164. https://doi.org/10.1109/FMCAD.2013.6679406

[5] Alessandro Cimatti, Alberto Griggio. "Software Model Checking via IC3." *Proc. CAV 2012*, LNCS 7358, pp. 277–293. doi:10.1007/978-3-642-31424-7_23. https://doi.org/10.1007/978-3-642-31424-7_23

[6] Anvesh Komuravelli, Arie Gurfinkel, Sagar Chaki. "SMT-Based Model Checking for Recursive Programs." *Proc. CAV 2014*, LNCS 8559, pp. 17–34 (the Spacer engine; default CHC solver in Z3). doi:10.1007/978-3-319-08867-9_2. https://doi.org/10.1007/978-3-319-08867-9_2

[7] Kenneth L. McMillan. "Interpolation and SAT-Based Model Checking." *Proc. CAV 2003*, LNCS 2725, pp. 1–13. doi:10.1007/978-3-540-45069-6_1. https://doi.org/10.1007/978-3-540-45069-6_1

[8] Armin Biere, Alessandro Cimatti, Edmund M. Clarke, Yunshan Zhu. "Symbolic Model Checking without BDDs." *Proc. TACAS 1999*, LNCS 1579, pp. 193–207 (bounded model checking). doi:10.1007/3-540-49059-0_14. https://doi.org/10.1007/3-540-49059-0_14
