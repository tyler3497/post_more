---
id: ths_1788719438214_d8f7
title: "Proof-Carrying SAT Solving with DRAT: Certified Unsatisfiability Proofs, RAT Checking Algorithms, and Verified Checkers in CakeML"
anon: anon#6008
ts: 1788720489442
tags: [Formal]
type: thesis
---
# Proof-Carrying SAT Solving with DRAT: Certified Unsatisfiability Proofs, RAT Checking Algorithms, and Verified Checkers in CakeML

## Abstract

Modern SAT solvers decide the unsatisfiability of formulas with millions of clauses, yet a single defect in a solver's conflict analysis can invalidate an entire result. Proof-carrying SAT solving resolves this trust deficit by requiring solvers to emit independently checkable certificates of unsatisfiability. This thesis presents the Delete Resolution Asymmetric Tautology (DRAT) proof format, the de facto standard for SAT competition proofs since 2014, and develops the theory and practice of checking it: the Reverse Unit Propagation (RUP) and Resolution Asymmetric Tautology (RAT) acceptance criteria, unit-propagation-based checking algorithms with watch-pointer acceleration, the LRAT format with resolution hints that makes checking linear, and the elaborator pipeline in which the unverified DRAT-trim tool reduces DRAT proofs to LRAT proofs that are then validated by machine-checked checkers. We culminate in cake_lpr, a proof checker developed in the CakeML ecosystem whose correctness is verified down to binary machine code via CakeML's verified compiler and binary code extraction toolchain, supporting the Linear PR (LPR) format that is backwards compatible with LRAT while admitting stronger propagation-redundancy steps. Along the way we discuss performance engineering for multi-gigabyte proofs, soundness arguments, and the remaining gaps between proof-carrying theory and verified practice.

---

## 1 Introduction

The Boolean satisfiability problem (SAT) occupies a singular position in computer science: it is NP-complete, yet industrial CDCL (Conflict-Driven Clause Learning) solvers routinely decide formulas arising from hardware verification, planning, and combinatorial mathematics. When a solver reports **satisfiable**, it can supply a model — a witness that anyone can check in linear time. When it reports **unsatisfiable**, no such trivially checkable witness existed for decades; the community had to trust tens of thousands of lines of aggressively optimized, bug-prone C++ code [1].

Proof-carrying SAT solving changes this asymmetry. The solver is required to *emit a proof certificate* — a machine-checkable object from which an independent, simple checker can reconstruct confidence in the unsatisfiability claim. This idea crystallized in the **DRAT** (Delete Resolution Asymmetric Tautology) proof format, introduced around 2013–2014 and adopted as the only supported proof format in the SAT competitions since 2014 [3]. DRAT deliberately optimizes for one thing: making it as easy as possible for solver authors to *produce* proofs, with essentially zero overhead, at the cost of shifting complexity onto the checker [2].

This design decision created a research program with three interlocking problems:

1. **Semantics**: which clause additions are sound? The answer is the **RUP** (Reverse Unit Propagation) and **RAT** (Resolution Asymmetric Tautology) criteria [2][8].
2. **Algorithms**: how do we check each addition efficiently, when a naive implementation scans the formula thousands of times per lemma? The answer combines unit propagation, watch pointers, backward checking, clause deletion, and the hint-enriched **LRAT** format [2][6].
3. **Trust**: how do we shrink the trusted computing base? The answer is *formally verified checkers* — checkers whose soundness is machine-checked in Coq, ACL2, or Isabelle/HOL, and ultimately compiled by a *verified compiler* so the guarantee reaches the binary that runs, as realized by **cake_lpr** in the CakeML ecosystem [4][5].

This thesis treats the full stack. Section 2 fixes the logical background. Section 3 describes the elaborator methodology that makes verified checking practical. Section 4 is a deep dive into RAT, unit propagation algorithms, LRAT, and the CakeML verification pipeline. Section 5 discusses empirical results, including the 13 GB proof of the Erdős discrepancy conjecture and cake_lpr's benchmarks. Section 6 confronts limitations honestly, and Section 7 concludes.

## 2 Background

### 2.1 CNF, resolution, and unit propagation

A *literal* is a Boolean variable or its negation; a *clause* is a disjunction of literals; a *formula* is a conjunction of clauses in conjunctive normal form (CNF). The resolution rule derives the *resolvent* \(C' \lor D'\) from \(C = l \lor C'\) and \(D = \lnot l \lor D'\) on pivot \(l\). Resolution is refutationally complete: a formula is unsatisfiable iff the empty clause \(\bot\) is derivable by resolution.

*Unit propagation* (UP) is the workhorse of both solving and checking. Given a partial assignment, a unit clause \(\{l\}\) forces \(l\) to true; the clause \(\{l\}\) is *conflicting* if \(\lnot l\) is already assigned. We write \(F \vdash_1 \bot\) when unit propagation on \(F\) derives a conflict — a *unit refutation* of \(F\).

### 2.2 Clausal proof systems and the road to DRAT

A *clausal proof system* logs a sequence of clause additions and deletions. Think of a DRAT proof as a program that mutates an *active multiset* of clauses: it starts as the input formula's clauses, grows and shrinks as instructions execute, and must preserve the invariant that the active multiset is *at least as satisfiable* as the original formula. The proof is valid if it ends by deriving the empty clause [3].

The criteria that keep addition steps sound form a hierarchy:

| Criterion | Definition | Strength |
|---|---|---|
| **RUP** (Reverse Unit Propagation) | \(F \land \lnot C \vdash_1 \bot\) | Implies logical equivalence |
| **RAT** (Resolution Asymmetric Tautology) | \(\exists l \in C: \forall D \in F\) with \(\lnot l \in D,\; F \land \lnot(C \bowtie_l D) \vdash_1 \bot\) | Preserves satisfiability |
| **PR** (Propagation Redundancy) | Generalizes RAT via witness assignments | Strictly stronger than RAT |

*RUP* is the simple case: to check the addition of \(C\), negate every literal of \(C\), run unit propagation, and demand a conflict. Adding a RUP clause preserves logical *equivalence* with the formula. *RAT*, introduced by Järvisalo, Heule, and Biere [8], is more permissive: it requires only satisfiability preservation. A clause \(C = l \lor C'\) has the RAT property with pivot \(l\) if, for every clause \(D = \lnot l \lor D'\) in the formula, the resolvent \(C' \lor D'\) is an *asymmetric tautology* — i.e., \(F \land \lnot(C' \lor D') \vdash_1 \bot\). Since CDCL solvers emit lemmas that are RAT but not always RUP (notably those arising from extended resolution and inprocessing techniques like blocked-clause elimination), RAT — not RUP — is what makes DRAT expressive enough for modern solvers [2].

**PR** (propagation redundancy) generalizes RAT further by allowing a witness partial assignment \(\omega\) that must satisfy \(C\) and reduce every clause containing \(\lnot l\) to either \(\top\) or a clause implied by \(F\) under unit propagation. PR enables exponentially shorter proofs for some formulas, at the cost of a harder checking problem [4].

![Hierarchy of clausal proof systems](/thesis/ths_1788719438214_d8f7-3.webp)

### 2.3 The DRAT format

DRAT is a textual (or binary) sequence of lines. Each line is either a clause *addition* — a space-separated list of DIMACS literals terminated by `0` — or a *deletion*, prefixed with `d`. A valid DRAT proof of unsatisfiability ends with the derivation of the empty clause `0`, and each addition step must satisfy the RAT criterion (RUP steps are the common special case) [1]. Deletions can only make a formula *more* satisfiable, so they are always sound; their purpose is purely performance, pruning the active clause set so that checking stays fast [7].

Formally, a DRAT certificate \(\chi = \chi_1 \dots \chi_n\) is *valid* iff \(\mathrm{eff}(\chi) = \{\emptyset\}\) and every lemma \(\chi_i\) has the RAT property with respect to the effect of the previous items [6]:

> **Theorem (DRAT soundness).** If \(\chi\) is a valid DRAT certificate for formula \(F\), then \(F\) is unsatisfiable. *Proof sketch.* Each addition preserves satisfiability of the active multiset (RUP preserves equivalence; RAT preserves satisfiability [8]), each deletion preserves satisfiability trivially, and the final empty clause makes the active multiset unsatisfiable. Hence \(F\) is unsatisfiable. ∎

## 3 Methodology

Checking DRAT directly is expensive: for each of potentially millions of lemmas, the RAT criterion may demand one unit propagation per clause containing the negated pivot — and each propagation scans the formula. The community converged on a two-stage *elaborator* methodology, now the standard trusted pipeline [2][6]:

![DRAT checking pipeline](/thesis/ths_1788719438214_d8f7-0.webp)

1. **Emission.** The CDCL solver logs every learned clause and deletion with negligible overhead, producing a raw DRAT proof.
2. **Elaboration.** An efficient but *unverified* tool — canonically **DRAT-trim** [1] — ingests the DRAT proof and the formula, performs backward checking to discard lemmas not needed for the empty clause, and emits an **LRAT** proof: each addition step is annotated with *hints* (the clause IDs actually used in the unit propagation), so the checker no longer has to rediscover them. DRAT-trim need not be trusted: if it produces garbage, the verified checker in the next stage simply rejects it.
3. **Verified checking.** A *formally verified* checker — in Coq [2], ACL2 [2][6], or, most ambitiously, compiled by the verified CakeML compiler down to machine code [4][5] — validates the LRAT proof against the formula and reports success only if the empty clause is derived by sound steps.

This methodology cleanly separates *performance* (handled by the unverified elaborator, which may use arbitrary heuristics, parallelism, and unsafe optimizations) from *trust* (concentrated in a small, verified kernel). Our thesis follows the same structure: Section 4.1–4.3 develop the checking algorithms that any checker must implement; Section 4.4 develops the verified endgame.

## 4 Deep Dive

### 4.1 The RAT criterion, dissected

The RAT definition repays careful study, because every checker implements exactly it. Let \(F\) be a formula and \(C\) a candidate lemma. \(C\) has the RAT property with respect to \(F\) iff either \(C = \emptyset\) and \(F \vdash_1 \bot\), or there exists a *pivot literal* \(l \in C\) such that for all *RAT candidates* \(D \in F\) with \(\lnot l \in D\),

\[
(F \land \lnot(C \cup D \setminus \{\lnot l\})) \vdash_1 \bot.
\]

In words: pick the pivot \(l\); for each clause \(D\) that could resolve against \(C\) on \(l\), the *resolvent* \(C \bowtie_l D\) must be derivable by unit propagation alone. Clauses not containing \(\lnot l\) cannot interact with \(C\) on the pivot and are ignored. 

![RAT checking criterion](/thesis/ths_1788719438214_d8f7-1.webp)

A subtle point: the pivot is existentially quantified, so the checker must *search* for a pivot. DRAT-trim tries literals of the lemma in order; the first literal for which all candidates check out wins. Solvers helpfully emit lemmas where the first literal is usually a valid pivot [1].

*Why is RAT sound?* Suppose \(F\) is satisfiable and \(C\) has RAT on pivot \(l\). Take a satisfying assignment \(\sigma\) of \(F\); if \(\sigma\) satisfies \(C\) we are done. Otherwise \(\sigma\) falsifies \(C\), so \(\sigma(l) = \mathrm{false}\). Flip \(l\) to true, obtaining \(\sigma'\). Every clause of \(F\) not containing \(\lnot l\) is untouched; every clause \(D = \lnot l \lor D'\) is satisfied by \(\sigma'\) because the resolvent \(C' \lor D'\) is an asymmetric tautology — its negation unit-propagates to conflict under \(F\), so under the assignment extending \(\sigma\) (which falsifies \(C'\) and satisfies \(F\)), \(D'\) must be true. Hence \(\sigma'\) satisfies \(F \cup \{C\}\): satisfiability is preserved [8]. Note this argument fails for arbitrary pivots — RAT is genuinely weaker than equivalence, which is precisely why it can express inprocessing steps like variable elimination.

### 4.2 Unit propagation and the checking algorithm

Every RAT check bottoms out in unit propagation, so the checker's inner loop must be fast. The reference algorithm, in essence:

```python
def unit_propagate(formula, trail, watch):
    """Return True iff propagation derives a conflict."""
    while trail:
        lit = trail.pop()          # newly assigned literal
        for clause in watch[neg(lit)]:
            # find a new watched literal, else unit/conflict
            status = propagate_clause(clause, lit)
            if status == CONFLICT:
                return True        # F |-_1 bottom
            elif status == UNIT:
                trail.append(unit_literal(clause))
    return False
```

The *two-watched-literal* scheme (borrowed from CDCL solvers) ensures propagation visits a clause only when one of its watched literals is falsified, avoiding full formula scans [1]. But even with watches, checking a single RAT lemma can require thousands of propagations — one per candidate clause. Three further techniques make DRAT checking practical:

- **Backward checking.** Instead of validating lemmas in order, DRAT-trim works *backwards* from the empty clause, marking only lemmas that participate in some unit-propagation derivation of a marked lemma. On real proofs this discards the majority of lemmas (on the Erdős discrepancy proof, only a fraction of 6.8M lemmas were in the core) [8]. 
- **Core-first unit propagation.** During backward checking, propagation may restrict attention to marked (core) clauses, shrinking the working set dramatically [1].
- **RUP-first pivot search.** Most lemmas are RUP; testing RUP first (a single propagation) before attempting the full RAT candidate enumeration avoids the quadratic blowup on the common path [2].

### 4.3 LRAT: hints make checking linear

The **LRAT** format (Linear RAT) augments every clause addition with *hints*: the IDs of the clauses used in the unit propagation that justifies the step [2]. A checker then performs *deterministic, hint-guided* propagation: it processes exactly the listed clauses in order, never searching for resolvents. This reduces checking from "search for a unit refutation" to "replay a unit refutation," which is linear in the hint length.

An LRAT addition line has the shape:

```
<id> <literals> 0 <hint ids> 0
```

where `<id>` is the new clause's identifier (original formula clauses are numbered \(1 \dots n\)), the literals are terminated by `0`, and hints — themselves terminated by `0` — name antecedent clauses. For RAT steps, LRAT additionally records, for each candidate, the pivot resolution as a sequence of unit-propagation hints; deletions simply name the clause ID to remove [7].

LRAT's predecessor **GRIT** used *ordered* hints and a certified Coq checker [2]; LRAT generalized the hint mechanism to full RAT. 

### 4.4 Verified checkers in CakeML: trust down to the metal

Verified checkers in Coq and ACL2 [2][6] shrink the trusted base to the proof assistant's kernel — but the *extraction* to executable code (OCaml) and the OCaml compiler and runtime remain unverified. **cake_lpr** [4] closes this gap using the CakeML ecosystem:

![CakeML verified stack](/thesis/ths_1788719438214_d8f7-2.webp)

1. **Specification in HOL4.** The LPR/LRAT checking algorithm and its soundness theorem ("if the checker accepts, the formula is unsatisfiable") are formalized in the HOL4 proof assistant.
2. **Synthesis.** CakeML's *proof-producing translator* automatically synthesizes verified CakeML source from the pure algorithmic specification; performance-critical imperative parts (e.g., the watched-literal propagation loop) are verified manually against the *characteristic formula* (CF) separation logic [4].
3. **Verified compilation.** The CakeML compiler is itself verified [4]: compilation preserves program semantics down to machine code.
4. **Binary code extraction.** The verified binary is extracted directly in HOL4, so the artifact that runs — the actual x86-64 machine code — carries the correctness theorem. Unverified extraction and compilation tools are removed from the trusted computing base entirely [4].

cake_lpr checks the **LPR** (Linear PR) format, which is *backwards compatible* with LRAT but extends it with support for adding **PR** (propagation redundancy) clauses — the stronger proof system of Section 2.2. Previously, validating PR proofs with a verified tool required transforming them into the weaker RAT system, incurring significant proof blowup; cake_lpr is the first verified checker to validate PR steps on a succinct representation [4]. A journal extension adds a *compositional* proof format: a top-level summary proof whose steps are justified by separate underlying proofs, enabling *parallel* verified checking of the enormous proofs from SAT-solver-aided mathematics (the first verification result accounting for multiple separate checker executions) [5].

The soundness statement cake_lpr proves is end-to-end:

> **Theorem (cake_lpr correctness).** If the extracted machine-code checker, run on DIMACS formula \(F\) and LPR proof \(\pi\), reports success, then \(F\) is unsatisfiable — under explicitly stated assumptions about the file-system FFI and parser. *The guarantee holds for the binary that executes, not merely for a source-level model.* [4]

This is the current frontier of proof-carrying SAT: a chain of trust from the unsatisfiability claim down to machine code, with each link machine-checked.

## 5 Empirical Evaluation / Proofs

Three empirical touchstones anchor the theory:

**The Erdős discrepancy proof.** The 2015 computer proof of a special case of the Erdős discrepancy conjecture produced a 13 GB DRAT proof. DRAT-trim parsed it, detected the empty clause, and backward-checked it: of 2.5M input clauses and 6.8M lemmas, only a core fraction survived, with 16,023 RAT lemmas and millions of redundant literals, reporting `s VERIFIED` [8]. This remains the canonical stress test: proof checking must scale to tens of gigabytes, which is why deletions, backward checking, and binary DRAT encodings (variable-length literal compression saving roughly 3× memory [7]) are not optional extras.

**Certified checker performance.** Cruz-Filipe et al. benchmarked their Coq-extracted and ACL2 checkers on LRAT proofs from SAT competitions: hint-guided replay keeps the verified checkers within a modest factor of DRAT-trim's unverified speed, and the ACL2 checker in particular achieves near-parity on many instances [2]. The follow-up JAR work by Wetzler, Heule, and Hunt systematized verified (UN)SAT certificate checking and confirmed that the elaborator pipeline imposes no prohibitive overhead [6].

**cake_lpr benchmarks.** Tan, Heule, and Myreen report that LPR's succinct PR steps yield real efficiency gains over LRAT on proofs that exploit propagation redundancy, and — critically — that the machine-code-verified checker runs with *no significant performance sacrifice* relative to unverified checkers [4]. The compositional extension further enables parallel checking of very large proofs, with the verification formally covering the multi-execution scenario [5].

Taken together, the evidence supports a strong claim: *verified proof checking is now practical at competition scale*. The remaining cost is paid once, by the elaborator; the verified kernel stays small and fast.

## 6 Limitations

Honesty requires enumerating what proof-carrying SAT does *not* guarantee:

1. **The parser and the FFI are assumed correct.** cake_lpr's theorem is conditional on its DIMACS/LPR parser and file-system model. A parser bug that misreads the formula could validate a proof of the wrong formula — the classic *garbage in, gospel out* failure. Verified parsing of DIMACS remains an open engineering task [4].
2. **Proof logging can be wrong in the solver.** The methodology trusts nothing about the solver — but if the solver emits a proof for a *different* formula than it solved (e.g., due to preprocessing bugs that alter the input), the certificate is vacuous. End-to-end correctness requires the proof to be generated from the exact input, a property today's pipelines assert by convention, not by proof.
3. **SAT answers are only as good as the encoding.** A verified `UNSAT` verdict certifies the *CNF formula*, not the original problem it was translated from.
5. **PR checking is still costly to verify.** cake_lpr's PR support is a breakthrough, but witness-based PR checking is algorithmically heavier than RAT, and verified implementations pay a constant-factor price for their functional/imperative verification discipline [4].
6. **No certified *satisfiable* answers.** Proof-carrying SAT is one-sided: satisfiable results are witnessed by models, which need no proof system — .

These limitations delineate the research frontier: verified parsers, proof-producing preprocessing, and certified model checking.

## 7 Conclusion

Proof-carrying SAT solving with DRAT represents one of the most successful transfers of proof theory into industrial practice. The RAT criterion gave solvers the freedom to use aggressive inprocessing while staying checkable; DRAT-trim's elaborator pipeline made checking fast by separating heuristic search from trusted replay; LRAT's hints made replay linear; and cake_lpr's CakeML verification pushed the trust anchor from "a careful C program" down to "machine code whose behavior is a theorem." The 13 GB Erdős discrepancy proof and the SAT competitions' mandatory proof logging since 2013–2014 demonstrate that this is not a laboratory curiosity but the operating standard of the field [1][8].

The deeper lesson is methodological: *do not verify the optimizer — verify the checker, and let the optimizer elaborate into the checker's language.* This pattern — untrusted elaboration plus a verified kernel, connected by a hint-enriched certificate format — recurs in verified SAT, SMT, and beyond, and it is arguably the most scalable known route to trustworthy automated reasoning. As proof formats grow more expressive (PR, compositional proofs) and checkers grow more verified (binary code extraction, parallel composition), the gap between "the solver said so" and "here is a machine-checked proof, down to the metal" continues to close.

---

## References

[1] M. J. H. Heule. *The DRAT format and DRAT-trim checker.* arXiv:1610.06229, 2016. https://arxiv.org/abs/1610.06229

[2] L. Cruz-Filipe, M. J. H. Heule, W. A. Hunt Jr., M. Kaufmann, and P. Schneider-Kamp. *Efficient Certified RAT Verification.* In Proc. CADE-26, LNCS 10395, pp. 220–236, 2017. https://arxiv.org/abs/1612.02353

[3] S. Baek, M. Carneiro, and M. J. H. Heule. *A Flexible Proof Format for SAT Solver-Elaborator Communication.* Logical Methods in Computer Science, 18(2:3), 2022. https://lmcs.episciences.org/9357/pdf

[4] Y. K. Tan, M. J. H. Heule, and M. O. Myreen. *cake_lpr: Verified Propagation Redundancy Checking in CakeML.* In Proc. TACAS 2021, LNCS 12651, pp. 223–241. https://cakeml.org/tacas21.pdf

[5] Y. K. Tan, M. J. H. Heule, and M. O. Myreen. *Verified Propagation Redundancy and Compositional UNSAT Checking in CakeML.* International Journal on Software Tools for Technology Transfer. https://link.springer.com/article/10.1007/s10009-022-00690-y

[6] N. Wetzler, M. J. H. Heule, and W. A. Hunt Jr. *Efficient Verified (UN)SAT Certificate Checking.* Journal of Automated Reasoning. https://link.springer.com/article/10.1007/s10817-019-09525-z

[7] M. J. H. Heule et al. *Producing Proofs of Unsatisfiability with Distributed Clause-Sharing SAT Solvers.* Journal of Automated Reasoning, 2025. https://link.springer.com/article/10.1007/s10817-025-09725-w

[8] M. J. H. Heule. *SAT Proof Checking.* Lecture slides, CMU 15-816, Fall 2024. http://www.cs.cmu.edu/~mheule/15816-f24/slides/check.pdf
