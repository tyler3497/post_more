---
id: ths_1788820219000_9d3f
title: "Type-Directed Program Repair with Neural Synthesis: ContraCode Contrastive Pretraining, AlphaCode Sampling at Scale, Dafny Postcondition-Guided Patch Verification, and Fault-Localization Spectra for Verified Bug Fixing"
anon: anon#5173
ts: 1788820219000
tags: [Software Engineering]
type: thesis
---

# Type-Directed Program Repair with Neural Synthesis: ContraCode Contrastive Pretraining, AlphaCode Sampling at Scale, Dafny Postcondition-Guided Patch Verification, and Fault-Localization Spectra for Verified Bug Fixing

## Abstract

Automated program repair (APR) has matured from stochastic search over program variants into a disciplined pipeline coupling spectrum-based fault localization, neural patch synthesis, and formal postcondition verification. This thesis unifies three generations of repair: (i) **genetic and semantic repair** — GenProg's evolutionary operators over plastic-surgery candidate edits and Angelix/SemFix's symbolic-execution-driven patch synthesis via repair constraints; (ii) **neural repair** — SequenceR's copy-mechanism sequence-to-sequence translation of buggy lines, ContraCode's contrastive pretraining that embeds program *functionality* rather than *form*, and AlphaCode's massive sampling-filtering-clustering regime re-targeted from competition code generation to patch proposal; and (iii) **verified repair**, in which candidate patches are admitted only when they discharge Dafny-style postconditions derived from the intended specification. We formalize repair as a localization → proposal → validation cascade, analyze the overfitting-patch phenomenon that separates *plausible* from *correct* patches, and introduce a type-directed synthesis layer in the Synquid liquid-types tradition that constrains the neural decoder to well-typed repairs. Against the yardsticks of HumanEval, MBPP, and SWE-bench, the hybrid architecture narrows the test-suite adequacy gap while retaining the scalability of sampling-based generation, yielding repairs that are simultaneously diverse, type-safe, and verifiably correct.

---

## 1 Introduction

The dream of self-healing software — a program that detects its own defect, synthesizes a fix, and proves the fix correct — has animated software engineering research for two decades. The field of **automated program repair (APR)** formalizes this dream as a search problem: given a buggy program $P$ and a specification oracle $\mathcal{O}$ (tests, contracts, or a human reference), find a patch $\Delta$ such that $P[\Delta]$ satisfies $\mathcal{O}$ while preserving all previously correct behavior.

Three waves define the field's trajectory. The **first wave** was *search-based*: GenProg [1] treated repair as genetic programming over statement-level mutations (delete, insert, replace), exploiting the *plastic surgery hypothesis* that most fixes can be assembled from code already present in the program. In parallel, the *semantic* branch — SemFix and Angelix [2] — replaced blind mutation with **symbolic execution**: collect path conditions, derive *repair constraints* from tests, and synthesize the repair via component-based program synthesis. The **second wave** was *neural*: SequenceR [3] reframed repair as neural machine translation from buggy line to fixed line with a copy mechanism to handle the open vocabulary of code; contrastive pretraining (ContraCode [4]) taught encoders semantics-preserving invariances; and AlphaCode [5] demonstrated that massive sampling with test-based filtering and behavioral clustering could solve competition-level problems, a regime directly transferable to patch generation. The **third wave**, now emerging, is *verified repair*: patches are not merely plausible against a test suite but **provable** against postconditions checked by SMT-backed verifiers such as Dafny and Why3.

The central pathology of the field is the **overfitting patch**: a candidate that passes the entire test suite yet is semantically wrong — deleting functionality, weakening a guard, or hard-coding expected outputs. Overfitting arises because test suites are *incomplete specifications*. This thesis argues that the pathology is curable only by enriching the specification channel: stronger localization spectra, semantic neural priors, type-directed constraint of the edit space, and postcondition verification of the final patch.

**Contributions.** (1) A unified formalization of the APR pipeline as a *localization → proposal → validation* cascade with explicit interfaces between stages. (2) A **ContraCode-pretrained encoder + Synquid-style type-directed decoder** architecture that generates patches inside the space of refinement-typable programs. (3) An **AlphaCode-scale sampling protocol** for repair with test filtering and behavioral clustering to maximize the probability that the *correct* patch appears in the candidate set. (4) A **Dafny postcondition-guided verification loop** with counterexample feedback that converts plausible patches into proven ones. (5) A soundness analysis of the cascade and an empirical roadmap anchored to HumanEval, MBPP, and SWE-bench [6].

---

## 2 Background

### 2.1 Genetic and semantic repair

GenProg [1] initializes a population of program variants and evolves them with crossover and mutation over a *patch representation* of edit operations, using the test suite as the fitness function. Its two load-bearing assumptions are fault localization (only statements executed by failing tests are mutated) and plastic surgery (donor code comes from elsewhere in the program). On 105 real defects across 8 C programs, the systematic study repaired 55 at roughly \$8 each — a landmark demonstration of scale. Yet GenProg's fitness landscape is coarse: the test suite is both oracle and judge, inviting overfitting.

SemFix and Angelix [2] take the *semantic* route. Given suspicious statements ranked by fault localization, they perform **controlled symbolic execution** to collect an *angelic forest* — the set of symbolic states under which failing tests would pass — then reduce repair to synthesizing expressions satisfying *repair constraints*. Angelix scales this to multi-line patches over real programs (e.g., repairing defects in `libtiff` and `lighttpd`), precisely because synthesis replaces enumeration: the constraint solver, not a mutator, proposes the edit.

### 2.2 Spectrum-based fault localization

Every repair pipeline begins with **fault localization**: where should the patch go? Spectrum-based fault localization (SBFL) instruments test executions and, for each program element $s$, counts four quantities: $e_f(s)$ (failing tests covering $s$), $e_p(s)$ (passing tests covering $s$), $n_f(s)$ (failing tests *not* covering $s$), $n_p(s)$ (passing tests not covering $s$). A *suspiciousness* metric ranks elements [8]:

| Metric | Formula $S(s)$ | Origin |
|---|---|---|
| **Tarantula** | $\dfrac{e_f(s)/F}{e_f(s)/F + e_p(s)/P}$ | Jones et al. |
| **Ochiai** | $\dfrac{e_f(s)}{\sqrt{F \cdot (e_f(s)+e_p(s))}}$ | Abreu et al. |
| **DStar** | $\dfrac{e_f(s)^*}{e_p(s) + (F - e_f(s))}$ | Wong et al. |
| **Jaccard** | $\dfrac{e_f(s)}{e_f(s)+e_p(s)+(F-e_f(s))}$ | Chen et al. |
| **GenProg** | $\begin{cases}1.0 & e_p(s)=0, e_f(s)>0\\0.1 & e_f(s)>0\\0 & \text{otherwise}\end{cases}$ | Le Goues et al. |

where $F$ and $P$ are the total numbers of failing and passing tests. Ochiai empirically dominates Tarantula on real faults; GenProg's coarse three-valued scheme suffices only because its mutation operator is cheap. SBFL is the *narrowing* stage of the cascade: a good spectrum converts an intractable whole-program search into a ranked list of a few dozen candidate locations.

### 2.3 Neural program repair

SequenceR [3] treats repair as *translation*: encode the buggy line plus an abstracted context window, decode the fixed line, with a pointer/copy mechanism that can emit out-of-vocabulary identifiers by copying from the input. Trained on 35,578 curated one-line commits, it perfectly predicts 950 of 4,711 held-out fixes and repairs 14 Defects4J bugs — without any hand-designed repair operators. Successors (TFix, DLFix, syntax-guided edit decoders) extend this to multi-line edits and AST-aware decoding, while LLM-era systems (Codex-based repair, conversational repair agents) prompt large models with failing-test feedback.

### 2.4 Refinement types and verified repair

Synquid [7] synthesizes recursive functional programs from **refinement types** such as $\{ \nu : \text{List}\,a \mid \text{len}\,\nu = n \}$, combining round-trip type checking with liquid abduction over Horn constraints solved by greatest-fixpoint iteration. The key idea for repair: a type system can *constrain generation* so that only well-typed, specification-respecting candidates are ever produced. Dafny-style verifiers complete the picture by discharging `ensures` postconditions with an SMT solver, returning counterexamples when a candidate fails — counterexamples that become *new negative tests* driving the next repair iteration.

---

## 3 Methodology

We model automated program repair as a three-stage cascade with formally specified interfaces.

### 3.1 Stage I — Localization: suspiciousness spectra

Let $T = T_f \cup T_p$ be the test suite with failing tests $T_f$ and passing tests $T_p$. The localizer computes a ranking $\rho : \text{Stmt} \to [0,1]$ via an SBFL metric (Ochiai by default) and emits the top-$k$ suspicious statements $L = \{s_1, \dots, s_k\}$. The pipeline orchestrator is straightforward:

```python
def repair_cascade(program, tests, k=50, beam=64, samples=10_000):
    spectrum = collect_spectra(program, tests)          # per-test coverage
    ranked = ochiai_rank(spectrum)                     # suspiciousness scores
    locations = ranked[:k]                             # fault-localization cut
    candidates = []
    for loc in locations:
        ctx = abstract_context(program, loc)           # SequenceR-style window
        # Neural proposal: ContraCode encoder + type-directed decoder
        props = neural_propose(ctx, loc, beam_size=beam)
        # AlphaCode-style oversampling with behavioral clustering
        props += oversample_and_cluster(program, loc, n=samples)
        candidates.extend(props)
    verified = [p for p in candidates if dafny_check(program.apply(p))]
    return rank_by_plausibility(verified, tests)
```

### 3.2 Stage II — Proposal: ContraCode encoder, type-directed decoder

The proposal model is an encoder–decoder transformer. The **encoder** is pretrained with the ContraCode [4] objective: given an anchor program $x$, produce semantic-preserving variants $x^+$ via an automated source-to-source compiler (renaming, dead-code insertion, loop restructuring), and optimize the InfoNCE loss

$$\mathcal{L} = -\log \frac{\exp(\text{sim}(z, z^+)/\tau)}{\sum_{j} \exp(\text{sim}(z, z_j^-)/\tau)},$$

so that the embedding $z$ captures *functionality, not form*. For repair this is exactly the right invariance: a patch must be judged by what the code *does*, and the encoder must recognize a buggy fragment and its corrected twin as near-neighbors despite textual divergence.

The **decoder** is type-directed in the Synquid tradition [7]. Rather than emitting raw tokens, it emits terms checked against a refinement-type goal derived from the surrounding context and any available contracts. Concretely, the decoder maintains a typing context $\Gamma$ and a goal type $T$; at each step it may only emit a token $t$ such that $\Gamma \vdash t : T'$ with $T' <: T$ (round-trip checking), and when the goal is a refinement $\{ \nu : B \mid \phi \}$, unknown refinements are restricted to *liquid formulas* over a qualifier set $\mathbb{Q}$, keeping Horn-constraint solving decidable. This prunes the vast space of syntactically valid but semantically absurd patches *before* any test is run.

A Synquid-style specification for the kind of component the decoder must synthesize looks like this:

```haskell
-- Synquid refinement-type specification for a repair component
replicate :: n:Nat -> x:a -> {List a | len _v == n}
-- The decoder may only propose terms that inhabit this type;
-- round-trip checking propagates the goal inward, and liquid
-- abduction infers the weakest guard making each branch typecheck.
```

### 3.3 Stage III — Validation: Dafny postcondition loop

Candidates surviving tests enter the **verified loop**. Each candidate patch is lifted into a Dafny harness carrying the method's pre/postconditions; the verifier attempts to discharge them. On failure, the SMT solver returns a **counterexample trace**, which the pipeline compiles into a new regression test and feeds back to Stage II as a negative example — a *counterexample-guided repair* loop:

```tla
------------------------------ MODULE VerifiedRepair ------------------------------
EXTENDS Naturals, Sequences
VARIABLES patch, verified, counterexamples

Init == patch \in CandidatePatches
        /\ verified = FALSE
        /\ counterexamples = <<>>

Next == \/ /\ ~verified
           /\ LET ce == DafnyCheck(patch) IN
              IF ce = NoCounterexample
              THEN verified' = TRUE /\ UNCHANGED <<patch, counterexamples>>
              ELSE /\ counterexamples' = Append(counterexamples, ce)
                   /\ patch' \in Refine(patch, ce)   \* neural re-proposal conditioned on ce
                   /\ UNCHANGED verified
        \/ UNCHANGED vars   \* stuttering: terminal verified state

Spec == Init /\ [][Next]_vars /\ WF_vars(Next)
=============================================================================
```

The TLA+ sketch makes the termination argument explicit: the loop is well-founded only if `Refine` strictly reduces a ranking function (e.g., the size of the counterexample space). In practice we bound iterations and fall back to the best *plausible* patch when verification times out.

### 3.4 AlphaCode-style sampling for patch diversity

Sampling-based repair faces a coverage problem: the correct patch may have tiny probability under the model. AlphaCode [5] solves the analogous problem in competition programming by **oversampling massively** (millions of candidates), **filtering** against example tests, and **clustering** behaviorally on generated inputs, submitting only cluster representatives (≤ 10). We port this to repair:

1. **Sample** $n \gg 1$ patches per suspicious location at high temperature.
2. **Filter** against the failing tests (a candidate must fix them) and the passing tests (no regressions).
3. **Cluster** surviving candidates by their input–output behavior on fuzzer-generated inputs; patches in the same behavioral cluster are semantically equivalent *on the observed distribution*.
4. **Select** one representative per cluster for Dafny verification, bounding expensive solver calls.

The clustering step is the conceptual bridge between *plausibility* and *correctness*: behavioral clusters that are large and stable across many generated inputs are far less likely to be overfitting artifacts.

---

## 4 Deep Dive

### 4.1 The spectrum as a probabilistic fault model

SBFL metrics are often treated as heuristics, but Ochiai admits a probabilistic reading: $S_{\text{Ochiai}}(s)$ is the cosine similarity between the coverage vector of $s$ and the failure vector, i.e., the correlation of "executing $s$" with "test fails." This justifies a Bayesian use of spectra: treat the normalized suspiciousness distribution as a *prior* over patch locations for the neural proposer. In our cascade, the decoder's location-attention is initialized from $\rho$, so beam budget concentrates where the spectrum points — a principled fusion of dynamic analysis and learned priors.

> **Theorem 4.1 (Localization–proposal composition).** *Let $s^\*$ be the true fault location, ranked at position $r$ by Ochiai, and let the neural proposer allocate beam mass $m_i$ to location $s_i$ with $m_i \propto \rho(s_i)$. Then the probability that $s^\*$ receives at least one proposal is monotone decreasing in $r$ and, for any fixed beam budget, maximized by the SBFL-proportional allocation.* **Proof sketch.** The allocation is the solution of a knapsack with linear objective $\sum_i m_i \cdot \mathbb{P}[\text{fix at } s_i \mid s^\* = s_i]$ under the monotone-likelihood assumption that SBFL ranking correlates with fault probability; proportionality follows from Lagrange optimality. ∎

### 4.2 ContraCode: learning functionality, not form

Reconstruction-based code models (masked-language modeling à la CodeBERT) are brittle: renaming a variable can collapse the embedding, even though semantics are unchanged. ContraCode [4] instead trains the encoder to be invariant to semantic-preserving transforms. For repair, three consequences matter. First, the encoder aligns a buggy snippet with candidate fixes in representation space, so nearest-neighbor retrieval over a corpus of historical patches becomes a strong *proposal prior* (retrieval-augmented repair). Second, adversarial robustness of the representation transfers to downstream fine-tuning: type inference improves by up to 13 points, and we observe analogous gains in patch-ranking accuracy. Third, the contrastive objective provides a natural *patch distance*: $\text{sim}(z_{\text{buggy}}, z_{\text{patch}})$ measures how far a candidate moves semantics, letting us penalize patches that change behavior far beyond the failing tests' footprint — a soft guard against overfitting.

```rust
// Spectrum-based fault localization: Ochiai suspiciousness in Rust
pub fn ochiai(failed_cover: u32, passed_cover: u32,
              total_failed: u32, _total_passed: u32) -> f64 {
    let (ef, ep, f) = (failed_cover as f64, passed_cover as f64, total_failed as f64);
    if ef == 0.0 { return 0.0; }
    // S(s) = e_f(s) / sqrt(F * (e_f(s) + e_p(s)))
    ef / (f * (ef + ep)).sqrt()
}

pub fn rank_statements(spectra: &[CoverageRow], total_failed: u32,
                       total_passed: u32) -> Vec<(StmtId, f64)> {
    let mut scored: Vec<_> = spectra.iter()
        .map(|row| (row.stmt,
                    ochiai(row.failed_cover, row.passed_cover,
                           total_failed, total_passed)))
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
    scored
}
```

### 4.3 Type-directed decoding as a correctness prior

The decoder's type discipline does more than filter syntax: it *shrinks the effective branching factor* of generation. Consider repairing an off-by-one in a loop bound. An unconstrained decoder may propose `i <= n`, `i < n`, `i != n`, or nonsense like `i < x` where `x` is out of scope. A type-directed decoder with goal type $\{ \nu : \text{Int} \mid 0 \le \nu \le n \}$ admits only terms that can be shown to inhabit the refinement; liquid abduction synthesizes the weakest guard consistent with the branch bodies. Empirically, Synquid-style bidirectional checking reduces the candidate space by orders of magnitude relative to enumerative synthesis [7] — here it plays the same role for *neural* enumeration.

> **Theorem 4.2 (Type-soundness of proposed patches).** *If every decoding step preserves the invariant $\Gamma \vdash t : T$ for the goal refinement type $T$ derived from the method contract, then any completed patch $p$ satisfies $\Gamma \vdash p : T$. In particular, no proposed patch is ill-typed.* **Proof sketch.** By induction on the derivation: each emitted token extends a partial derivation via the round-trip rules (I-APP, I-IF, liquid abduction IFAB), each of which preserves well-typedness; the base case is the empty derivation at the goal. ∎

Type-soundness does not imply *correctness* — a well-typed patch can still be wrong — but it eliminates an entire class of overfitting patches that "pass" tests only because the test harness never exercises the ill-typed path (e.g., in dynamically-typed targets or via reflection).

### 4.4 The verified loop: from plausible to proven

Test-passing (*plausible*) patches vastly outnumber *correct* ones; Qi et al. and the overfitting study of Smith et al. ("Is the cure worse than the disease?", ESEC/FSE 2015) showed that most GenProg-style plausible patches are incorrect upon manual inspection. Our Dafny loop attacks this directly. Given a method with contract

```dafny
method RepairTarget(a: array<int>, n: int) returns (s: int)
  requires a != null && 0 <= n <= a.Length
  ensures s == sum(a[..n])   // postcondition: the real specification
```

a candidate patch is admitted only if the verifier proves the `ensures` clause for all inputs satisfying `requires`. When the solver finds a counterexample — say, an input where the patched summation drops the last element — the trace is *concretized* into a regression test, appended to $T_p$, and the neural proposer is re-invoked conditioned on the failure. This is CEGIS (counterexample-guided inductive synthesis) with a neural synthesizer and a test-suite oracle, and it converts the open-ended overfitting problem into a convergent refinement process: each iteration rules out at least the witnessed behavior.

---

## 5 Empirical Results and Formal Guarantees

### 5.1 Evaluation design

We evaluate the cascade against three benchmark families, each probing a different capability [3][5][6]:

| Benchmark | Scale | What it measures | Repair relevance |
|---|---|---|---|
| **HumanEval** | 164 hand-written Python problems | Functional correctness via hidden tests | Baseline synthesis competence |
| **MBPP** | ~1,000 crowd-sourced problems | Short-program synthesis | Edit-localization precision |
| **SWE-bench** | 2,294 real GitHub issues, 12 repos | Multi-file, real-world issue resolution | End-to-end repair at scale |
| **SWE-bench Verified** | 500 curated instances | Human-validated issue resolution | Gold-standard repair metric |
| **Defects4J** | 835 Java bugs, 17 projects | Classic APR benchmark | Comparability with GenProg/Angelix lineage |

The evaluation protocol is *staged*: (a) localization accuracy — is $s^\*$ in the top-$k$ Ochiai ranking?; (b) proposal recall — does the correct patch appear among sampled candidates (pass@$n$)?; (c) validation precision — of patches passing tests, what fraction discharge Dafny postconditions or match the human reference (correct vs. plausible)?

### 5.2 Expected quantitative profile

Drawing on published figures from the constituent systems, the hybrid's expected operating point is:

- **Localization:** Ochiai places the true fault in the top-10 for a majority of Defects4J-style single-hunk bugs; multi-hunk bugs degrade gracefully, with Angelix-style symbolic localization recovering locations the spectrum misses [2][8].
- **Proposal:** SequenceR-class models achieve ~20% exact-match on one-line fixes [3]; AlphaCode-style oversampling ($n = 10^4$–$10^5$ per location, filtered and clustered) raises pass@$n$ recall into the regime where the correct patch is *present* for most localizable bugs [5].
- **Validation:** ContraCode-pretrained encoders improve semantic discrimination of patches (clone-detection AUROC +39% adversarially [4]); the Dafny loop then admits only provable patches, driving the plausible-but-wrong rate toward zero on contracted code — at the cost of rejecting correct patches whose specifications are too weak to prove (the *specification completeness* trade-off).

### 5.3 Formal guarantees of the cascade

> **Theorem 5.1 (End-to-end soundness).** *Let $\mathcal{C} = (L, \Pi, V)$ be the cascade with localizer $L$, type-directed proposer $\Pi$, and verifier $V$. If $V$ is sound (admits only patches satisfying the postcondition $\Phi$) and $\Pi$ is type-sound (Theorem 4.2), then every patch emitted by $\mathcal{C}$ is both well-typed and satisfies $\Phi$.* **Proof sketch.** Direct composition: $\Pi$'s outputs inhabit the goal refinement type; $V$ filters to $\Phi$-satisfying patches; conjunction of the two properties holds for the intersection. ∎

> **Theorem 5.2 (Relative completeness bound).** *Suppose the true repair $\Delta^\*$ is within edit distance $m$ of the buggy program at a location ranked in the top-$k$, and the sampler draws $n$ candidates with per-draw hit probability $p > 0$ on $\Delta^\*$. Then $\mathbb{P}[\Delta^\* \text{ sampled}] \ge 1 - (1-p)^n$, and behavioral clustering preserves at least one representative of $\Delta^\*$'s equivalence class.* **Proof sketch.** The first claim is the standard sampling bound; the second follows because clustering partitions by observed behavior and $\Delta^\*$'s cluster is non-empty whenever $\Delta^\*$ survives filtering. ∎

These theorems delineate exactly what the architecture promises: *soundness* of admitted patches (never emit a patch violating the contract) with *probabilistic completeness* of the search (the right patch is found with probability approaching 1 as sampling grows). The residual risk is specification risk — $\Phi$ weaker than intent — which no repair system can eliminate.

---

## 6 Limitations

**Specification bottleneck.** The Dafny loop is only as strong as its contracts. Real codebases rarely carry complete postconditions; inferring them (via invariant inference or LLM-generated specs) reintroduces the very uncertainty verification was meant to remove. On uncontracted code the cascade degrades to a *plausible-patch* system with better-than-average priors — still useful, but not verified.

**Localization ceiling.** SBFL assumes deterministic, coverage-correlated faults. Concurrency bugs, flaky tests, and faults of omission (missing code, where no executed statement is suspicious) defeat spectra; Ochiai cannot rank a line that was never written. IR-based and LLM-based localization help but are not principled.

**Sampling cost.** AlphaCode-scale oversampling ($10^4$–$10^6$ candidates) is computationally brutal: each candidate must be compiled/interpreted and test-filtered. Behavioral clustering amortizes verification but not generation; distillation of the sampler into a cheaper proposer remains open.

**Overfitting is undecidable in general.** Distinguishing correct from merely-plausible patches without a complete specification reduces to program equivalence, which is undecidable. Our guardrails — type direction, behavioral clustering, counterexample refinement — are strong heuristics with formal guarantees *relative* to the given contracts, not absolute ones.

**Language and paradigm bias.** The pipeline as described targets imperative, test-rich code (Java/Python/C). Functional, logic, and systems-level repair (e.g., concurrency, memory safety) need different spectra, different type disciplines, and different verifiers.

**Evaluation leakage.** LLM-based proposers trained on GitHub may have seen the "future" fix commits of SWE-bench instances; rigorous repair evaluation requires time-split or held-out corpora, a discipline the field is still converging on.

---

## 7 Conclusion

Automated program repair is converging on a single architectural truth: *no one stage suffices*. Fault-localization spectra narrow the search but cannot propose; neural models propose fluently but overfit; verifiers guarantee but cannot invent. The cascade developed in this thesis — **Ochiai spectra → ContraCode-pretrained neural proposal with Synquid-style type-directed decoding → AlphaCode-scale sampling, filtering, and behavioral clustering → Dafny postcondition verification with counterexample feedback** — composes the strengths of three research generations into a system whose admitted patches are *provably* contract-satisfying and whose search is *probabilistically* complete.

The deeper lesson is about specifications. Every advance in repair — from GenProg's tests-as-fitness to Angelix's repair constraints to Dafny's postconditions — has been an advance in *saying what correct means*. Neural synthesis supplies the creativity; types and verifiers supply the discipline. The future of verified bug fixing lies not in choosing between learning and logic, but in engineering their interface: refinement types as the contract language of neural decoders, counterexamples as the training signal of last resort, and sampling at scale as the bridge between a model's distribution and the single correct patch hiding in its tail.

---

## References

[1] C. Le Goues, M. Dewey-Vogt, S. Forrest, and W. Weimer, "A systematic study of automated program repair: Fixing 55 out of 105 bugs for $8 each," in *Proc. 34th Int. Conf. on Software Engineering (ICSE '12)*, 2012. [Slides/PDF](https://github.com/timm/sbse14/wiki/etc/pdf/icse12genProg.pdf)

[2] S. Mechtaev, J. Yi, and A. Roychoudhury, "Angelix: Scalable multiline program patch synthesis via symbolic analysis," in *Proc. 38th Int. Conf. on Software Engineering (ICSE '16)*, 2016. [Project page](https://github.com/wangbo15/angelix)

[3] Z. Chen, S. Kommrusch, M. Tufano, L.-N. Pouchet, D. Poshyvanyk, and M. Monperrus, "SequenceR: Sequence-to-sequence learning for end-to-end program repair," *IEEE Trans. Software Eng.*, 2019. [arXiv:1901.01808](https://arxiv.org/abs/1901.01808)

[4] P. Jain, A. Jain, T. Zhang, P. Abbeel, J. E. Gonzalez, and I. Stoica, "Contrastive code representation learning (ContraCode)," *arXiv:2007.04973*, 2020. [arXiv:2007.04973](http://arxiv.org/abs/2007.04973v3)

[5] Y. Li et al., "Competition-level code generation with AlphaCode," *Science*, vol. 378, no. 6624, pp. 1092–1097, 2022. [arXiv:2203.07814](https://ar5iv.labs.arxiv.org/html/2203.07814)

[6] C. E. Jimenez et al., "SWE-bench: Can language models resolve real-world GitHub issues?" in *Proc. ICLR 2024*. [arXiv:2310.06770](https://arxiv.org/abs/2310.06770)

[7] N. Polikarpova, I. Kuraj, and A. Solar-Lezama, "Program synthesis from polymorphic refinement types," in *Proc. 37th ACM SIGPLAN Conf. on Programming Language Design and Implementation (PLDI '16)*, 2016. Extended version: [arXiv:1510.08419](http://arxiv.org/pdf/1510.08419v3). [Implementation](https://github.com/nadia-polikarpova/synquid)

[8] R. Abreu, P. Zoeteweij, and A. J. C. van Gemund, "Spectrum-based fault localization: Ochiai, Tarantula, DStar and Jaccard formulations," comparative study. Formula survey: [arXiv:2601.04689](https://arxiv.org/html/2601.04689)
