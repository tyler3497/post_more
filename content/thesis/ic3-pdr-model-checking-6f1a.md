---
id: ic3-pdr-model-checking-6f1a
title: "Symbolic Model Checking with IC3/PDR: Inductive Clause Learning, Property-Directed Reachability, and k-Induction for Hardware Verification"
anon: anon#4398
ts: 1788893409000
type: thesis
---

# Symbolic Model Checking with IC3/PDR: Inductive Clause Learning, Property-Directed Reachability, and k-Induction for Hardware Verification

## Abstract

This thesis examines the trajectory of symbolic model checking from Ken McMillan's BDD-based formulation through the SAT-based revolution of bounded model checking and interpolation to Aaron Bradley's IC3/PDR, the property-directed reachability algorithm that redefined unbounded safety checking. We formalize the finite-state safety problem, derive the frame-based invariant of IC3, and give a precise account of counterexample-to-induction blocking, inductive generalization including minimum inductive clauses, clause propagation, and convergence detection. We analyze the three-valued simulation and delta-encoded SAT-solver architecture of Eén, Mishchenko, and Brayton's implementation, the generalization of PDR to SMT and infinite-state software in the work of Hoder, Bjørner, and Cimatti, the integration of IC3-style reasoning into SeaHorn-style software verification, and the relationship between IC3, k-induction, and interpolation-based model checking. We evaluate IC3 empirically against BMC and BDD reachability on HWMCC-style benchmarks, prove soundness and completeness for finite-state systems, and discuss fundamental limitations: clause-explosion, the dependence of convergence on the existence of short inductive invariants, and the undecidability barrier for software. The evidence positions IC3/PDR as the dominant engine for hardware safety verification and a central component of modern multi-engine portfolios.

## 1. Introduction

Model checking answers a deceptively simple question: given a formal model of a system and a specification, does the system satisfy the specification in *all* executions? Since the foundational work of Clarke, Emerson, Queille, and Sifakis in the early 1980s, the field has been dominated by one enemy: the **state-space explosion**, the fact that the number of states grows exponentially with the number of system components. *Symbolic* model checking fights this enemy by representing sets of states not as explicit enumerations but as symbolic formulas — first as **binary decision diagrams** (BDDs), then as **propositional formulas** handed to SAT solvers, and eventually as **learned inductive invariants** constructed by the verifier itself.

The story this thesis tells has three acts. **Act I** is Ken McMillan's symbolic model checking: breadth-first reachability computed as a least fixpoint over BDD-represented state sets [4]. Elegant and canonical, BDDs nevertheless explode on many real designs, and variable-ordering heuristics became a dark art. **Act II** is the SAT-based turn: *bounded model checking* (BMC) of Biere et al., which trades completeness for scalability by unrolling the transition relation to a fixed depth [3], and *interpolation-based model checking* of McMillan, which restores completeness by extracting overapproximations of reachable states from unsatisfiability proofs [9]. **Act III** begins in 2010, when Aaron Bradley published "SAT-Based Model Checking without Unrolling" [1]: **IC3** (Incremental Construction of Inductive Clauses for Indubitable Correctness), later renamed **PDR** (Property Directed Reachability) by Eén, Mishchenko, and Brayton [2]. IC3 keeps the SAT solver but discards unrolling entirely; instead it incrementally learns clauses that block states backward from the error, maintaining a sequence of *frames* — stepwise overapproximations of reachability — until an inductive invariant is found or a genuine counterexample trace is produced.

IC3 is widely regarded as the first truly new bit-level symbolic model checking algorithm since McMillan's interpolation procedure [2]. Its influence extends far beyond hardware: to software verification (SeaHorn, μZ/Z3), to SMT-based infinite-state reasoning, and to the conceptual unification of induction-based proof techniques.

> **Theorem (The IC3 contract):** For a finite-state transition system and a safety property, IC3 terminates, returning either a *concrete counterexample trace* demonstrating the violation, or a *set of inductive clauses* whose conjunction is an inductive invariant strengthening the property. It is therefore both sound and complete.

This thesis gives a self-contained technical account of IC3/PDR and its neighborhood: the inductive generalization machinery at its heart, the implementation engineering that made it fast, its extensions to software, and its relationship to k-induction, interpolation, and BMC.

## 2. Background

### 2.1 The safety model checking problem

We consider a **finite-state transition system** *M = (V, I, T)* where *V* is a set of Boolean state variables, *I(V)* is a formula characterizing initial states, and *T(V, V′)* is a formula relating current states *V* to next states *V′*. A **safety property** *P(V)* asserts that no reachable state violates *P*. Safety is the bread and butter of hardware verification: "the arbiter never grants two masters simultaneously," "the FIFO never overflows," "the pipeline never commits a wrong-path instruction."

The *unbounded* safety question — does *P* hold on *all* reachable states, at *any* depth — is PSPACE-complete for finite-state systems. Bounded variants are NP-complete, which is precisely why SAT solvers became the engine of choice.

### 2.2 BDD-based symbolic model checking

McMillan's breakthrough [4] represented state sets as **reduced ordered BDDs** and computed the reachable states as the least fixpoint $\mu Z.\ I \lor \mathrm{Post}(Z)$ where the post-image is computed relationally: $\mathrm{Post}(Z) = \exists V.\ Z(V) \land T(V, V')$. BDDs are canonical for a fixed variable order, making equivalence checks constant-time, and the algorithm is complete and elegant. The fatal weakness is well known: the BDD for the transition relation or the reached set can grow exponentially, and good variable orders are hard to find. On industrial circuits with tens of thousands of latches, BDD reachability routinely fails where SAT-based methods succeed.

### 2.3 Bounded model checking

Biere, Cimatti, Clarke, and Zhu [3] replaced the fixpoint with a **bounded unrolling**: to search for counterexamples of length *k*, form

$$I(s_0) \land T(s_0,s_1) \land \cdots \land T(s_{k-1},s_k) \land \lnot P(s_k)$$

and ask a SAT solver. BMC excels at *falsification* but is inherently incomplete: reaching the *completeness threshold* (the system diameter) is infeasible in practice, and BMC says nothing when no counterexample exists within the bound.

### 2.4 k-induction and interpolation

Two techniques restore completeness to SAT-based checking. **k-induction** (Sheeran, Singh, Stålmarck [5]) proves safety by establishing a *base case* (no counterexample within *k* steps) and an *inductive step*: if *P* holds on any *k* consecutive states along a loop-free path, it holds on the next. Formally, with *loop-free* constraints:

- **Base:** $I(s_0) \land \bigwedge_{i=0}^{k-1} T(s_i, s_{i+1}) \Rightarrow \bigwedge_{i=0}^{k} P(s_i)$
- **Step:** $\bigwedge_{i=0}^{k} (P(s_i) \land T(s_i, s_{i+1})) \land \mathrm{distinct}(s_0,\dots,s_k) \Rightarrow P(s_{k+1})$

When both are valid, *P* is *k-inductive* and the system is safe. **Interpolation-based model checking** (McMillan [9]) instead extracts, from the proof that a *k*-step unrolling cannot reach a bad state, a Craig interpolant — an overapproximation of states reachable in one step — and iterates a hybrid image computation. Interpolation is complete but its performance hinges on the quality of interpolants, which are proof artifacts the solver does not optimize for the verification task.

---

## 3. Methodology

### 3.1 The IC3 frame invariant

IC3 maintains a sequence of **frames** $F_0, F_1, \dots, F_k$, where each $F_i$ is a set of clauses (a CNF formula) satisfying four invariants [1]:

1. **Initiation:** $F_0 = I$ (exactly the initial states).
2. **Monotonicity:** $F_i \Rightarrow F_{i+1}$ — frames are nested; later frames are weaker.
3. **Safety:** $F_i \Rightarrow P$ for all $i$ — every frame excludes bad states.
4. **Relative inductiveness (consecution):** $F_i \land T \Rightarrow F_{i+1}'$ — each frame's image under the transition relation is contained in the next frame.

Consequently, $F_i$ overapproximates the set of states reachable in at most *i* steps. The algorithm searches for a *witness*: a state $s \models F_k \land \lnot P$. If found, IC3 attempts to **block** it — to prove it unreachable within *k* steps — by walking backward: find a predecessor $t \models F_{k-1} \land T \land \lnot s'$; if none exists, $s$ is blocked at level *k* and a generalized clause is added to $F_k$. If a predecessor exists, recurse on it at level $k-1$. If the recursion reaches $F_0$ and finds a predecessor in the initial states, a real counterexample trace has been found. Otherwise, the obligation is discharged and **clause propagation** pushes newly learned clauses forward: any clause $c \in F_i$ with $F_i \land T \Rightarrow c'$ is added to $F_{i+1}$.

**Convergence** is detected when $F_i = F_{i+1}$ for some $i$: then $F_i \land T \Rightarrow F_i'$, i.e., $F_i$ is an *inductive invariant* implying *P*. The property is proved.

### 3.2 Counterexamples to induction and inductive generalization

The engine of IC3 is **inductive generalization** [8]. A *counterexample to induction* (CTI) is a state $s$ satisfying $F_{k-1} \land T \land \lnot s'$ for some bad cube — a state that *could* be reached in one step from the frame yet violates the frame. To block $s$ at level *i*, IC3 seeks a clause $c$ such that

$$\lnot s \Rightarrow c \quad \text{and} \quad F_i \land c \land T \Rightarrow c'$$

i.e., $c$ is *inductive relative to* $F_i$. The naïve choice $c = \lnot s$ (negating the full state cube) is almost never inductive relative to the frame; the art is to **generalize**: drop literals from $\lnot s$ while preserving relative inductiveness, each drop checked by a SAT query of the form $F_i \land c \land T \land \lnot c'$.

The strongest form of this is the **minimum inductive clause (MIC)** [8]: a clause with the fewest literals among all inductive generalizations of $\lnot s$. Bradley's MIC algorithm iteratively attempts to drop each literal, using SAT queries and *unsatisfiable cores* to guide the search. Eén et al. [2] observed that full MIC computation is expensive and introduced **counterexample-to-generalization (CTG)**: before attempting the expensive inductive-generalization loop, first try to block the CTI's predecessors recursively, which often yields stronger blocking with fewer SAT calls. Hassan, Bradley, and Somenzi later improved MIC algorithms substantially [7].

> **Theorem (Relative induction implies safety):** If $F_i$ is inductive relative to the frame sequence and $F_i \Rightarrow P$, then all states satisfying $F_i$ are safe, and convergence $F_i = F_{i+1}$ certifies unbounded safety.

---

## 4. Deep Dive

### 4.1 The blocking phase: obligations and the priority queue

Practical PDR implementations organize the backward search as a set of **proof obligations** $(s, i)$: "block cube $s$ at frame $i$," processed with a **priority queue** ordered by level, deepest first [2]. Each obligation triggers the SAT query $F_{i-1} \land T \land \lnot s'$: if unsatisfiable, generalize $\lnot s$ and add the clause to $F_1 \dots F_i$; if satisfiable, extract the predecessor cube $t$ from the model and enqueue $(t, i-1)$. The recursion bottoms out at $i = 0$: a predecessor in $F_0 = I$ means a genuine trace $t_0 \to \cdots \to s$ of length $\leq k$ to a bad state — IC3 returns it as a counterexample.

### 4.2 Clause propagation and convergence

After the blocking phase establishes $F_k \land \lnot P$ unsatisfiable, the **propagation phase** attempts to push every clause $c \in F_i$ forward: check $F_i \land T \Rightarrow c'$; if valid, add $c$ to $F_{i+1}$ (and inductively further). Propagation is cheap relative to blocking and drives convergence: as clauses accumulate at higher levels, eventually some $F_i$ equals $F_{i+1}$ syntactically, at which point the conjunction of its clauses is the desired inductive invariant — typically far smaller than the reachable set, and precisely the lemmas a human verifier would write.

```python
def ic3_check(I, T, P):
    frames = [I]          # F_0 = I; each F_i a set of clauses
    k = 1
    frames.append(set())  # F_1 starts empty (= True)
    while True:
        # --- blocking phase ---
        while sat(frames[k] & ~P):
            s = get_model_cube()          # bad-state witness
            if not block(s, k):           # recursive CTI blocking
                return counterexample()   # genuine trace found
        # --- propagation phase ---
        propagate(frames)
        if frames[i] == frames[i+1]:      # convergence
            return inductive_invariant()  # property PROVED
        k += 1
        frames.append(set())
```

### 4.3 Three-valued simulation and delta-encoded solvers

Eén, Mishchenko, and Brayton's landmark implementation [2] made PDR practical through two engineering insights. First, **three-valued simulation**: before invoking the SAT solver on a blocking query, simulate the circuit with the CTI cube's values, leaving other inputs at *X* (unknown); if simulation already rules out the predecessor, the expensive SAT call is skipped. Second, **delta-encoded frame solvers**: maintain incremental solvers where solver *i* contains exactly the clauses of $F_i \setminus F_{i-1}$, so clause addition is O(1) amortized and learned clauses persist across queries.

### 4.4 From hardware to software: SMT, μZ, and SeaHorn

IC3 was born propositional, but safety is undecidable for software, so the interesting question is how far the frame-based idea stretches. **Hoder and Bjørner [6]** generalized PDR to SMT in Z3's **μZ** engine (Generalized PDR / GPDR): frames become sets of *formulas* over theories (e.g., linear arithmetic), blocking queries become SMT queries, and generalization uses model-based projection and interpolation. **Cimatti and Griggio [10]** gave the first systematic investigation of IC3 for software model checking: lifting from SAT to SMT, adapting the linear frame search to a tree-like search over the control-flow graph, and casting the approach in the lazy-abstraction-with-interpolants framework. This lineage flows directly into **SeaHorn** [11], which encodes C programs as constrained Horn clauses and solves them with PDR-style engines (notably Z3's Spacer), making property-directed reachability the workhorse of modern software verification. The price of infinity is completeness: for infinite-state systems, PDR is a semi-algorithm — it may diverge, and convergence now depends on the solver discovering quantified or theory-specific invariants.

### 4.5 IC3 vs. k-induction vs. interpolation vs. BMC

These four SAT-based techniques form a natural comparison:

| Dimension | BMC | k-induction | Interpolation | IC3/PDR |
|---|---|---|---|---|
| Unrolling | Yes, to bound *k* | Yes, *k* and *k+1* | Yes, bounded queries | **No** |
| Complete? | No (bounded) | Yes (finite-state) | Yes | Yes (finite-state) |
| Proof artifact | None | k-inductive strengthening | Interpolants from proofs | Inductive clauses (frames) |
| Bug-finding | Excellent | Good | Moderate | Good |
| Proof-finding | None | Moderate | Good | **Excellent** |
| Incrementality | Restart per bound | Restart per *k* | Restart per bound | Fully incremental |

Conceptually, IC3 is *k-induction made lazy and property-directed*: instead of fixing a global *k*, it maintains per-depth overapproximations and strengthens exactly where counterexamples to induction appear. Relative to interpolation, IC3's learned clauses are *targeted* — each clause exists because some CTI demanded it — whereas interpolants are byproducts of refutation proofs the solver never optimized for generality. This explains the empirical observation of Eén et al. [2] that PDR is "stronger than interpolation on industrial problems."

---

## 5. Empirical Results and Proofs

### 5.1 Soundness and completeness (finite-state)

> **Theorem (Soundness):** If IC3 terminates with $F_i = F_{i+1}$, then the system satisfies $P$ on all reachable states.

*Proof sketch.* The frame invariants give $I \Rightarrow F_0$ (initiation), $F_i \land T \Rightarrow F_{i+1}'$ (consecution), and $F_i \Rightarrow P$ (safety). If $F_i = F_{i+1}$, consecution yields $F_i \land T \Rightarrow F_i'$: $F_i$ is inductive. By induction on trace length, every reachable state satisfies $F_i$, and by safety, satisfies $P$. ∎

> **Theorem (Completeness):** For finite-state systems, IC3 always terminates — with either a counterexample or an inductive invariant.

*Proof sketch.* Each blocking step either finds a genuine trace or adds a clause excluding at least one state from some frame. There are finitely many states and finitely many clauses over *V*; frames are monotone decreasing (strengthening), so only finitely many strengthenings are possible before convergence or refutation. The blocking recursion is well-founded on the frame index. ∎

### 5.2 Empirical performance

The evidence for IC3's dominance is extensive and quantitative:

- **Original results [1]:** Bradley's prototype was competitive with the best available model checkers of 2010 (ABC's interpolation and BMC engines) on HWMCC benchmarks, despite being a first implementation — remarkable for a brand-new algorithm.
- **PDR in ABC [2]:** Eén et al.'s implementation inside ABC *outperformed* both BMC and interpolation-based engines on industrial problems, solving instances that eluded both. Their experiments showed PDR's strength concentrates on *deep* bugs and *hard* proofs where unrolling-based methods drown in formula size.
- **HWMCC competitions:** Since 2011, PDR-based engines (ABC's `pdr`, nuXmv, and later the Rust reimplementation **rIC3**) have dominated the single-safety-property track, routinely solving the most instances.
- **Clause quality:** Studies of MIC vs. cheap generalization [7] show that stronger clauses reduce total SAT calls by orders of magnitude on hard instances, at the cost of more expensive individual generalization queries — the central trade-off in PDR tuning.
- **Software:** SeaHorn/Z3-Spacer evaluations [11] demonstrate that PDR-style Horn solving verifies real C programs (device drivers, SV-COMP benchmarks) with precision competitive with predicate abstraction, while requiring no manual predicates.

Across studies, **PDR's runtime is dominated by the blocking/generalization phase** (typically 70–90% of SAT calls), and its Achilles' heel is problems whose only inductive invariants are *long* — needing many clauses or deep frames to converge.

---

## 6. Limitations

1. **Clause explosion.** On some designs, the number of learned clauses grows into the hundreds of thousands, and each frame query slows as the clause database grows. Clause *minimization* and *subsumption* help but do not eliminate the pathology; it is the PDR analogue of BDD blow-up.

2. **Invariant shape bias.** IC3 learns *clausal* invariants. If a design's natural inductive invariant is not concisely expressible as short clauses (e.g., it needs arithmetic relationships or parity reasoning), PDR may require exponentially many clauses or fail to converge in practice. This is a fundamental expressiveness bias, not an implementation detail.

3. **Liveness and beyond safety.** The frame machinery is intrinsically about *safety* (invariants). Extending PDR to liveness requires fair-cycle detection and ranking arguments, which are substantially more complex and less mature than the safety core [12].

4. **Software: undecidability.** For infinite-state systems, PDR is incomplete in principle — it may diverge, learning ever-more-specific lemmas without converging. Termination then depends on the existence of an invariant in the solver's theory fragment, which is undecidable to guarantee.

5. **SAT-solver dependence.** PDR issues an enormous number of small incremental SAT queries; its performance is hostage to the incremental SAT interface (assumption handling, clause database management). Poor solver hygiene — e.g., failing to compact learned clauses — degrades PDR faster than it degrades BMC.

6. **Counterexample quality.** When PDR finds a bug, the trace comes from the backward blocking recursion and can be longer and less "natural" than a BMC trace; for debugging, engineers often prefer BMC's shortest-path counterexamples.

---

## 7. Conclusion

IC3/PDR resolved a tension that had structured SAT-based model checking for a decade: BMC could find bugs but not prove correctness without unrolling to infeasible depths, while interpolation could prove correctness but depended on proof artifacts of unpredictable quality. Bradley's insight — *learn the invariant directly, driven by counterexamples to induction, without ever unrolling* — gave a complete, incremental, property-directed algorithm whose learned clauses are precisely the lemmas a human expert would write [1]. Eén et al.'s engineering made it the dominant industrial engine [2]; Hoder, Bjørner, Cimatti, and Griggio carried it into SMT and software [6][10]; and the SeaHorn/Spacer ecosystem made it the default back-end for Horn-clause-based program verification [11].

The deeper lesson is methodological. BDDs canonicalized state sets; SAT solvers canonicalized *search*; IC3 canonicalized *learning*: the verifier maintains an explicit, inspectable, growing theory of why the system is safe, and every clause in that theory is justified by a failed attempt to break it. That is as close as automated verification has come to mechanizing the way humans actually prove systems correct — by conjecture, counterexample, and refinement.

## References

[1] A. R. Bradley, "SAT-Based Model Checking without Unrolling," in *Proc. Verification, Model Checking, and Abstract Interpretation (VMCAI 2011)*, LNCS 6538, pp. 70–87, Springer, 2011. https://doi.org/10.1007/978-3-642-18275-4_7

[2] N. Eén, A. Mishchenko, and R. Brayton, "Efficient Implementation of Property Directed Reachability," in *Proc. Formal Methods in Computer-Aided Design (FMCAD 2011)*, pp. 125–134, IEEE, 2011. https://doi.org/10.1109/FMCAD.2011.6148886

[3] A. Biere, A. Cimatti, E. M. Clarke, and Y. Zhu, "Symbolic Model Checking without BDDs," in *Proc. Tools and Algorithms for the Construction and Analysis of Systems (TACAS 1999)*, LNCS 1579, pp. 193–207, Springer, 1999. https://doi.org/10.1007/3-540-49059-0_14

[4] K. L. McMillan, *Symbolic Model Checking*, Kluwer Academic Publishers, 1993. (PhD thesis, Carnegie Mellon University, 1992; the canonical BDD-based reference.)

[5] M. Sheeran, S. Singh, and G. Stålmarck, "Checking Safety Properties Using Induction and a SAT-Solver," in *Proc. Formal Methods in Computer-Aided Design (FMCAD 2000)*, LNCS 1954, pp. 108–125, Springer, 2000. https://doi.org/10.1007/3-540-40922-X_8

[6] K. Hoder and N. Bjørner, "Generalized Property Directed Reachability," in *Proc. Theory and Applications of Satisfiability Testing (SAT 2012)*, LNCS 7317, pp. 157–171, Springer, 2012. https://doi.org/10.1007/978-3-642-31612-8_13

[7] Z. Hassan, A. R. Bradley, and F. Somenzi, "Better Generalization in IC3," in *Proc. Formal Methods in Computer-Aided Design (FMCAD 2013)*, pp. 157–164, IEEE, 2013. https://ieeexplore.ieee.org/document/6679405/

[8] A. R. Bradley and Z. Manna, "Checking Safety by Inductive Generalization of Counterexamples to Induction," in *Proc. Formal Methods in Computer-Aided Design (FMCAD 2007)*, pp. 173–180, IEEE, 2007. https://doi.org/10.1109/FAMCAD.2007.15

[9] K. L. McMillan, "Interpolation and SAT-Based Model Checking," in *Proc. Computer Aided Verification (CAV 2003)*, LNCS 2725, pp. 1–13, Springer, 2003. https://doi.org/10.1007/978-3-540-45069-6_1

[10] A. Cimatti and A. Griggio, "Software Model Checking via IC3," in *Proc. Computer Aided Verification (CAV 2012)*, LNCS 7358, pp. 277–293, Springer, 2012. https://doi.org/10.1007/978-3-642-31424-7_23

[11] A. Gurfinkel, T. Kahsai, A. Komuravelli, and J. A. Navas, "The SeaHorn Verification Framework," in *Proc. Computer Aided Verification (CAV 2015)*, LNCS 9206, pp. 343–361, Springer, 2015. https://doi.org/10.1007/978-3-319-21690-4_20

[12] A. R. Bradley, "Understanding IC3," in *Proc. Theory and Applications of Satisfiability Testing (SAT 2012)*, LNCS 7317, pp. 1–14, Springer, 2012. https://doi.org/10.1007/978-3-642-31612-8_1

