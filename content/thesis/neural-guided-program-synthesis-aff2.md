---
id: neural-guided-program-synthesis-aff2
title: "Neural-Guided Program Synthesis from Sketches: Refinement-Type Decomposition in Synquid, Symbolic Evaluation in Rosette, Enumerative CEGIS for SyGuS, and Verified Lifting of LLM Sketch Completion"
anon: anon#1730
ts: 1788740927000
images: 2
---

# Neural-Guided Program Synthesis from Sketches: Refinement-Type Decomposition in Synquid, Symbolic Evaluation in Rosette, Enumerative CEGIS for SyGuS, and Verified Lifting of LLM Sketch Completion

## Abstract

This thesis develops a unified account of neural-guided program synthesis from program sketches, integrating four traditions: refinement-type-directed synthesis in **Synquid** [1], symbolic evaluation and solver-aided programming in **Rosette** [4], enumerative counterexample-guided inductive synthesis (CEGIS) for **syntax-guided synthesis (SyGuS)** [2][3], and verified lifting of legacy code into high-performance DSLs [5]. We argue that a *sketch* — a partial program with holes — is the natural meeting point of logical specification and statistical learning: the sketch encodes programmer intent and search-space structure, while a learned neural model supplies a probabilistic prior over hole completions. Our methodology formalizes neural-guided synthesis as Bayesian inference over a grammar-constrained program space, where the likelihood is given by an SMT-backed verifier and the posterior by a transformer conditioned on specifications and counterexamples. Deep dives derive Synquid's round-trip typing, Rosette's merge-based symbolic evaluation, the enumerative CEGIS fixed point for SyGuS grammars, and a verified-lifting pipeline certifying LLM-completed sketches. Empirical evidence [5][6][7] shows learned guidance yields order-of-magnitude search reductions while preserving machine-checkable correctness.

## 1. Introduction

Program synthesis promises a reversal of the ordinary burden of proof: instead of writing a program and then establishing that it satisfies its specification, the programmer writes the specification — or a *sketch* of the program — and the synthesizer constructs a program that is correct by construction [2]. Over two decades, this vision has fragmented into schools that agree on the goal but diverge on the mechanism:

1. **Type-directed synthesis**: Synquid [1] synthesizes recursive functional programs from polymorphic refinement types via goal decomposition and SMT-backed Horn solving.
2. **Solver-aided programming**: Rosette [4] embeds symbolic values in a host language, lifting concrete execution to symbolic evaluation and reducing synthesis to satisfiability.
3. **Syntax-guided synthesis (SyGuS)** [3]: the grammar specifies the search space; enumerative or SMT-based CEGIS solvers explore candidates modulo a semantic specification.
4. **Verified lifting** [5]: legacy low-level code is the specification — synthesis discovers a provably equivalent high-level summary, retargeted to a DSL such as Halide.

The recent arrival of large language models [6] has added a fifth ingredient: a statistical prior over programs that can propose sketch completions, guide enumerators [7], and repair its own outputs through dialogue. Yet LLM outputs are *probable*, not *proven*. The central thesis of this work is that **sketches are the bridge between probable and proven**: a sketch constrains the neural prior to a decidable, solver-checkable hypothesis class, and verification closes the loop. Neural guidance explores; logical machinery certifies.

> **Theorem (Soundness of sketch-constrained neural synthesis).** Let $S$ be a sketch with holes $\mathcal{H}$, let $\mathcal{G}$ be the SyGuS grammar induced by $S$, and let $\mathcal{V}$ be a verifier deciding a specification $\varphi$. If the synthesis procedure returns a completion $p$ such that $p \in \mathcal{L}(\mathcal{G})$ and $\mathcal{V}(p) \models \varphi$, then $p$ satisfies $\varphi$ *regardless of the prior used to propose $p$*. The neural model affects only *which* $p$ is found and *how fast*, never *whether* it is correct.

This separation — learning for *search*, logic for *truth* — is the architectural principle of the entire thesis.

---

## 2. Background

### 2.1 Sketches and the CEGIS loop

A *sketch* [2] is a partial program containing *holes* ($\mathtt{??}$) left for the synthesizer to fill. The Sketch system of Solar-Lezama et al. introduced the **counterexample-guided inductive synthesis (CEGIS)** loop [2]: a *synthesizer* proposes a candidate consistent with a finite set of examples, and a *verifier* either certifies it or returns a counterexample that refines the example set, until the fixed point — a candidate consistent with the full specification — is reached.

### 2.2 Refinement types and liquid type inference

A *refinement type* $\{ \nu : T \mid p(\nu) \}$ decorates a base type $T$ with a decidable predicate $p$, checked by an SMT solver [1]. Synquid extends this idea to synthesis: the refinement type *is* the specification, and the synthesis algorithm is type checking run backwards — from goal type to program term.

### 2.3 Solver-aided languages

Rosette [4] observes that ordinary programs already contain a virtual machine for concrete evaluation; by making symbolic values first-class citizens, the same interpreter performs *symbolic evaluation*, producing symbolic expressions that an SMT solver can reason about. The `solve`, `verify`, and `synthesize` queries of Rosette are then thin wrappers over satisfiability.

### 2.4 Syntax-guided synthesis

SyGuS [3] standardizes the synthesis problem as: given a background theory $\mathcal{T}$, a correctness specification $\varphi$, and a context-free grammar $G$ of candidate terms, find $f \in \mathcal{L}(G)$ such that $\varphi[f]$ is $\mathcal{T}$-valid. The grammar restriction is what makes the problem *syntax-guided* — it encodes domain knowledge about plausible solutions and bounds the search.

### 2.5 Verified lifting

Verified lifting [5] inverts the usual direction: given low-level code $c$, synthesize a summary $\sigma$ in a high-level predicate language with $\forall \vec{x}.\ \sigma(\vec{x}) \equiv c(\vec{x})$, then translate $\sigma$ into a DSL (Halide) for retargeting to GPUs. The equivalence proof is discharged by Z3 within a CEGIS loop.

### 2.6 Neural program synthesis

Austin et al. [6] showed that LLMs from 244M to 137B parameters synthesize short Python programs from natural language with few-shot accuracy up to 59.6% on MBPP, scaling log-linearly with size. Recent work [7] integrates LLMs into CEGIS itself: incorrect LLM proposals seed a probabilistic CFG guiding an enumerative synthesizer, outperforming cvc5 on SyGuS benchmarks.

---

## 3. Methodology

Our methodology treats neural-guided sketch synthesis as **Bayesian program induction with a logical likelihood**. Concretely, we define the following pipeline, instantiated once per paradigm in §4:

1. **Sketch elaboration.** The programmer supplies a sketch $S$ with holes $h_1, \dots, h_n$, each annotated with a hole type (refinement type, Rosette symbolic type, or SyGuS nonterminal), inducing a grammar $\mathcal{G}_S$ of completions.
2. **Prior construction.** A transformer $M_\theta$ conditioned on the specification, sketch text, and accumulated counterexamples yields $P_\theta(p \mid S, \varphi, \mathcal{E})$; for enumerative integration [7] this is projected onto a probabilistic CFG over $\mathcal{G}_S$.
3. **Guided search.** Candidates are drawn in decreasing posterior order (best-first enumeration), exactly as in classical enumerative SyGuS [3], but with the LLM-derived pCFG replacing the uniform prior.
4. **Verification.** Each candidate is checked by the paradigm's verifier: Synquid's Horn-constraint solver [1], Rosette's symbolic assertion store [4], a SyGuS semantic check, or Z3-based equivalence for lifting [5]. On failure, the verifier emits a counterexample $e$ appended to $\mathcal{E}$, and the loop repeats — this is CEGIS with a learned proposal distribution.
5. **Certification.** The accepted program carries a machine-checkable artifact: a refinement-type derivation, an SMT proof of the Rosette assertions, or a verified-lifting equivalence proof. The neural model is an *oracle*, never a *judge*.

> **Definition (Neural CEGIS).** A *neural CEGIS* procedure is a tuple $(\mathcal{G}, M_\theta, \mathcal{V})$ where $\mathcal{G}$ is a grammar, $M_\theta$ a probabilistic oracle over $\mathcal{L}(\mathcal{G})$, and $\mathcal{V}$ a sound verifier. The loop maintains a counterexample set $\mathcal{E}$; at each iteration it queries $M_\theta(\cdot \mid \mathcal{E})$ for the most likely candidate not yet refuted, checks it with $\mathcal{V}$, and either returns it or adds the counterexample to $\mathcal{E}$. *Soundness follows from $\mathcal{V}$ alone; completeness is relative to $\mathcal{L}(\mathcal{G})$ and the fairness of $M_\theta$.*

---

## 4. Deep Dive

### 4.1 Refinement-Type-Directed Synthesis in Synquid

Synquid [1] synthesizes recursive functions from polymorphic refinement types. The key innovation is an algorithm for **refinement type inference on partial programs**, which enables *goal decomposition*: given a goal type $T$, the synthesizer picks a program shape (e.g., $\lambda$-abstraction, application, match) justified by the *round-trip* typing rules, and generates subgoals for the subterms.

Consider synthesizing `replicate :: n:Nat → x:α → {List α | len ν = n}`. Synquid decomposes the goal: the head must be a function symbol whose result shape unifies with `List α`; the recursive call receives the weakened type `m:{Int | 0 ≤ ν < n}` for termination. Unknown refinements become **predicate unknowns** $\kappa$, solved later by *greatest-fixpoint Horn solving* over the qualifier lattice.

```haskell
-- Synquid-style sketch: goal refinement type drives synthesis
replicate :: n:Nat -> x:a -> {List a | len v = n}
replicate = ??  -- hole: decomposition picks fold/match on n

-- After decomposition, Synquid derives subgoals:
--   subgoal1 :: {List a | len v = 0}        -- base case
--   subgoal2 :: n':{Int|0<=v<n} -> x:a
--            -> {List a | len v = n'+1}     -- step case
```

The abduction step is where Synquid synthesizes **branch conditions**: it computes the *weakest* qualifier-conjunction making the goal refinement valid under the path condition — which is why Synquid synthesizes conditionals with no examples at all [1].

Neural guidance enters naturally: the *choice* of which function symbol to apply at each decomposition step is a ranking problem, and a transformer conditioned on the goal type can score candidate components while the Horn solver retains its role as arbiter.

| Mechanism | Synquid (classical) | Neural-augmented Synquid |
|---|---|---|
| Component selection | Syntactic shape matching | Transformer scoring of $\Gamma$ |
| Predicate unknowns $\kappa$ | Greatest-fixpoint Horn solving | Learned qualifier proposals, Horn-checked |
| Branch guards | Logical abduction | Abduction over neurally-ranked qualifiers |
| Termination argument | Well-founded order weakening | Unchanged (must remain provable) |
| Soundness basis | SMT validity of Horn clauses | Unchanged |

### 4.2 Symbolic Evaluation and Solver-Aided Synthesis in Rosette

Rosette [4] implements a **lightweight symbolic virtual machine**: Racket values are extended with *symbolic constants* created by `define-symbolic`, and ordinary evaluation is lifted so that operations on symbolic values build symbolic terms rather than computing concrete results. Because Racket is homoiconic and Rosette's evaluator is a *shallow embedding*, the full power of the host language — macros, higher-order functions, modules — is available to solver-aided programs.

Synthesis in Rosette is expressed as a query:

```racket
#lang rosette
(define-symbolic a b integer?)
(define sketch
  (choose a b (+ a b) (* a b)))   ; sketch: hole over 4 alternatives
(define (spec x) (= (sketch-fn x) (* 2 x)))
(define sol (synthesize #:forall (list a b)
                        #:guarantee (assert (spec a))))
```

Operationally, `synthesize` performs symbolic evaluation of the sketch, collecting path conditions and assertions into an *assertion store* handed to Z3; the satisfying assignment maps each hole to a concrete choice. The critical performance device is **merging**: branches on symbolic conditions are merged with `ite` terms rather than forked, keeping formulas linear in program size for straight-line code.

For neural guidance, Rosette's architecture offers a unique hook: a learned model can predict likely hole assignments from the sketch source and seed the SMT solver's decision stack, pruning search without changing satisfiability — while every accepted artifact remains backed by an SMT proof, not by the model's confidence.

> **Theorem (Merge soundness in symbolic evaluation).** Let $\Downarrow$ be Rosette's symbolic evaluation with state merging. For every program $p$ and symbolic store $\sigma$, the merged symbolic value $v = \llbracket p \rrbracket_\sigma$ satisfies: for all concrete assignments $\rho$ to the symbolic constants, $\rho(v)$ equals the concrete evaluation of $p$ under $\rho(\sigma)$. Hence any model of the assertion store corresponds to a genuine program behavior, and `synthesize` is sound [4].

### 4.3 Enumerative CEGIS for Syntax-Guided Synthesis (SyGuS)

SyGuS [3] casts synthesis as grammar-constrained search: find $f \in \mathcal{L}(G)$ with $\varphi[f]$ valid in theory $\mathcal{T}$. The **enumerative** solver strategy — the workhorse of the SyGuS competition — enumerates terms of $G$ in increasing size, checking each against the specification, and accelerates with *observational equivalence* pruning: terms indistinguishable on all examples are collapsed, since only a counterexample can separate them.

The CEGIS loop for SyGuS has a clean fixed-point semantics:

```python
def cegis(G, phi, oracle):          # oracle: LLM proposal model
    E = []                          # counterexamples
    pcfg = uniform(G)               # initial prior
    while True:
        p = best_first_enumerate(G, pcfg, E)  # guided by neural prior
        cex = verify(p, phi)                   # SMT check
        if cex is None:
            return p                           # certified
        E.append(cex)
        pcfg = oracle.update(pcfg, p, cex)     # LLM re-weights grammar
```

The neural integration of [7] is the `oracle.update` step: the LLM is prompted with the grammar, the failed candidate, and the counterexample, and asked for *helper functions* likely to appear in the true solution. These seed a probabilistic CFG biasing `best_first_enumerate`. Empirically, prompting alone solved ~50% of SyGuS competition benchmarks, and the full neural CEGIS **outperformed cvc5** [7]. The lesson is sharp: *enumerative synthesis is not yet obsolete* — but its future is as the verification backbone of a learned proposal mechanism.

A subtle theoretical point concerns **completeness**: classical enumerative CEGIS is complete relative to $\mathcal{L}(G)$. Neural guidance preserves this iff the proposal distribution has *full support* — enforced in practice by mixing the learned pCFG with a uniform component ($\epsilon$-smoothing), so no term is ever permanently starved.

| Solver style | Search order | Pruning | Neural hook |
|---|---|---|---|
| Pure enumerative | Increasing term size | Observational equivalence | None |
| Stochastic / pCFG | Decreasing likelihood | Equivalence + likelihood cutoff | Static learned weights |
| Neural CEGIS [7] | Adaptive likelihood | Counterexample-driven + re-prompting | Inline LLM oracle |
| SMT-based (cvc5) | Solver decision order | Theory lemmas | Phase seeding |

### 4.4 LLM-Guided Sketch Completion with Verified Lifting

Verified lifting [5] is the most demanding integration point: the "specification" is the legacy program itself, and the synthesis target is a *summary* $\sigma$ in a predicate language over arrays. STNG [5] lifts Fortran stencil kernels to Halide via *inductive template generation* (combined concrete and symbolic execution), then proves $\forall \vec{i}.\ \sigma(\vec{i}) = c(\vec{i})$ with Z3 in a CEGIS loop; the largest reported stencil required five loop invariants with five universally quantified variables and 457 AST nodes.

Where does the neural model fit? Three places:

1. **Template proposal.** Instead of fixed inductive templates, an LLM trained on stencil corpora proposes candidate summaries $\sigma$ directly from the loop nest — a *sketch completion* task where the hole is the entire summary expression.
2. **Invariant ranking.** A learned model ranks candidate invariant shapes before the expensive Z3 quantifier-instantiation phase.
3. **DSL retargeting.** Once $\sigma$ is verified, translating the predicate summary into Halide schedules is itself a sketch-completion problem, with Halide's autoscheduler semantics as the verifier.

Crucially, verified lifting *already* embodies the thesis architecture: the summary is a guess, the equivalence proof is the certificate. The LLM merely upgrades the guesser from hand-written templates to a learned distribution — the SMT proof obligation is unchanged. Stencil-Lifting [8] shows the complementary direction: hierarchical recursive lifting theory for 31.6× speedups over STNG, proving the *verification* side advances independently of the *proposal* side. The two compose: faster verifiers make more aggressive neural proposals affordable.

```python
# Neural verified lifting: sketch completion + equivalence proof
def neural_verified_lift(kernel_src, llm, z3):
    summary = llm.complete(                       # probable
        prompt=sketch_prompt(kernel_src),
        grammar=predicate_language)
    proof = z3.prove(ForAll(idx, summary(idx) == eval(kernel_src, idx)))
    if proof:                                     # proven
        return halide_emit(summary)               # retarget
    cex = proof.counterexample()
    return neural_verified_lift(kernel_src, llm.condition(cex), z3)
```

---

## 5. Empirical Results and Proofs

We consolidate the quantitative evidence across the four paradigms. All figures are reported from the cited primary sources [1][5][6][7], not reproduced experiments; we present them as the empirical grounding for the architectural claims.

**Synquid [1].** On functional synthesis benchmarks (list/tree manipulations, sorting, arithmetic), Synquid synthesized programs from the refinement type alone — including conditional-heavy programs where abduction inferred all guards. Each synthesis step reduces the goal to strictly smaller subgoals, so search depth tracks program depth rather than program size.

**Rosette [4].** The PLDI'14 symbolic virtual machine demonstrated order-of-magnitude speedups over prior solver-aided embeddings; solver-aided DSLs built on Rosette inherit the host language's expressiveness and the solver's guarantees, with the assertion-store encoding keeping formula growth manageable.

**SyGuS + LLM [7].** The headline result: prompting an off-the-shelf LLM solves ~50% of SyGuS competition benchmarks outright; the integrated neural CEGIS (pCFG seeded by LLM proposals, inline oracle re-prompted with counterexamples) **outperforms cvc5** on the competition suite. This is a direct measurement of the thesis claim: the learned prior compresses the effective search space, while the CEGIS verifier preserves soundness.

**LLM synthesis scaling [6].** On MBPP (974 tasks) and MathQA-Python (23,914 tasks), synthesis accuracy scales log-linearly with model size from 244M to 137B parameters; the largest model reaches 59.6% few-shot on MBPP and 83.8% fine-tuned on MathQA-Python, with natural-language feedback halving the error rate. These numbers bound what the *proposal* side can contribute: strong enough to make sketch completion practical, weak enough that verification remains non-negotiable.

**Verified lifting [5][8].** STNG lifted real Fortran stencil kernels — including invariants with five quantified variables and 457 AST nodes — to GPU-ready Halide with full equivalence proofs; Stencil-Lifting [8] later achieved 31.6× and 5.8× speedups over STNG and Dexter via hierarchical recursive lifting, preserving semantic equivalence.

> **Theorem (Neural CEGIS relative completeness).** Let $(\mathcal{G}, M_\theta, \mathcal{V})$ be a neural CEGIS procedure with $\mathcal{V}$ sound and complete for $\varphi$ over $\mathcal{L}(\mathcal{G})$, and let $M_\theta$ assign positive probability to every $p \in \mathcal{L}(\mathcal{G})$ ($\epsilon$-smoothed full support). Then if $\exists p \in \mathcal{L}(\mathcal{G}).\ \mathcal{V}(p) \models \varphi$, the loop terminates with such a $p$. *Proof sketch.* Each iteration either returns a verified program or refutes the candidate with a counterexample; full support plus fair best-first enumeration eventually proposes every $p \in \mathcal{L}(\mathcal{G})$, and $\mathcal{V}$-completeness accepts the true solution when proposed. ∎

The proof is deliberately boring — that is the point. Learning changes the *order* of enumeration; logic decides the *outcome*.

---

## 6. Limitations and Threats to Validity

**Distributional fragility of the prior.** The LLM prior is trained on public code, over-representing imperative languages and under-representing refinement-typed Haskell, Rosette DSLs, and Halide schedules. A prior that has never seen a SyGuS grammar proposes syntactically invalid candidates, wasting verifier calls. Grammar-constrained decoding and $\epsilon$-smoothing recover completeness but not efficiency, and the gains of [7] are measured on benchmarks whose idioms overlap the pretraining distribution; generalization to novel DSLs is unproven.

**The abduction completeness burden.** Synquid's Horn solving is complete only relative to the qualifier set $\mathbb{Q}$ [1]; if the true invariant needs a qualifier outside $\mathbb{Q}$, synthesis fails regardless of neural ranking. Neural *predicate invention* — inventing logical vocabulary, not merely ranking terms — is an open problem.

**Verifier scalability as the true bottleneck.** Neural guidance reduces the *number* of candidates, but each still pays the full verification cost — quantified SMT for lifting [5], Horn fixpoints for Synquid [1]. On the hardest STNG stencils a single verification call dominates the run; the 31.6× speedup of [8] came from the *verification* side, a reminder that both halves of the architecture must advance together.

**Specification bottleneck.** None of these techniques dissolve the fundamental problem: someone must write the refinement type, the Rosette assertions, the SyGuS grammar, or the equivalence criterion. LLM-generated *specifications* are themselves unverified artifacts; sketch-based interaction — the human supplies structure, the machine supplies detail — remains the honest division of labor.

**Evaluation validity.** The cited results [6][7] measure different quantities (few-shot accuracy vs. verified synthesis success) on different distributions; they are converging evidence, not a single controlled experiment. A unified benchmark — sketches with paired natural-language intents, SyGuS grammars, and machine-checked specifications — does not yet exist and is the most important missing infrastructure for this research program.

---

## 7. Conclusion

We have presented a unified architecture for **neural-guided program synthesis from sketches**, grounded in four mature traditions — Synquid's refinement-type decomposition [1], Rosette's symbolic evaluation [4], enumerative CEGIS for SyGuS [2][3], and verified lifting [5] — and extended with LLM proposal oracles [6][7]. The architecture rests on a single invariant: *the neural model proposes, the logical verifier disposes* — the prior compresses search by orders of magnitude (outperforming cvc5 on SyGuS benchmarks [7]), while every accepted artifact carries a machine-checkable certificate.

The deep dives show that each paradigm already contains the hooks for neural integration: Synquid's component ranking and qualifier proposal, Rosette's solver decision heuristics and sketch generation, SyGuS's probabilistic grammar weights with an inline LLM oracle, and verified lifting's summary-template proposal. In each case the soundness argument is untouched, because soundness never depended on *how* candidates were found.

Looking forward, the critical investments are: (i) grammar-constrained neural decoding so priors respect sketch structure by construction; (ii) learned qualifier invention to attack Synquid's abduction completeness boundary; (iii) faster quantified verification to keep pace with aggressive proposal oracles; and (iv) a unified sketch benchmark pairing natural language, grammars, and checked specifications. The probable and the proven need not be enemies: with sketches as the contract between them, they become the two halves of a single, trustworthy synthesis engine.

---

## References

[1] N. Polikarpova, I. Kuraj, and A. Solar-Lezama. *Program Synthesis from Polymorphic Refinement Types.* In Proc. ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI), pp. 522–538, 2016. https://arxiv.org/pdf/1510.08419v3

[2] A. Solar-Lezama, L. Tancau, R. Bodík, S. A. Seshia, and V. A. Saraswat. *Combinatorial Sketching for Finite Programs.* In Proc. 12th International Conference on Architectural Support for Programming Languages and Operating Systems (ASPLOS), pp. 404–415, ACM, 2006. https://doi.org/10.1145/1168857.1168907

[3] E. Frankel et al. *Syntax-Guided Synthesis.* Survey, 2025. https://www.pure.ed.ac.uk/ws/portalfiles/portal/564446902/FrankelEtalSMT2025Syntax-GuidedSynthesis.pdf

[4] E. Torlak and R. Bodík. *Growing Solver-Aided Languages with Rosette.* In Proc. ACM International Symposium on New Ideas, New Paradigms, and Reflections on Programming & Software (Onward! 2013), pp. 135–152, 2013. http://doi.acm.org/10.1145/2509578.2509586

[5] S. Ahmad et al. *Verified Lifting of Stencil Computations.* In Proc. ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI), 2016. (STNG system.) https://people.csail.mit.edu/shachari/dl/pldi2016.pdf

[6] J. Austin et al. *Program Synthesis with Large Language Models.* arXiv:2108.07732, 2021. https://arxiv.org/pdf/2108.07732

[7] *Guiding Enumerative Program Synthesis with Large Language Models.* arXiv:2403.03997, 2024. https://arxiv.org/html/2403.03997

[8] *Stencil-Lifting: Hierarchical Recursive Lifting System for Extracting Summary of Stencil Kernel in Legacy Codes.* arXiv:2509.10236, 2025. https://arxiv.org/pdf/2509.10236v2
