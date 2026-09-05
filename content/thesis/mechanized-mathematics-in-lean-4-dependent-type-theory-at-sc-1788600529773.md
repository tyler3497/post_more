---
{
 "id": "ths_1788600529773_b046",
 "title": "Mechanized Mathematics in Lean 4: Dependent Type Theory at Scale \u2014 Universe Polymorphism, Tabled Typeclass Inference, Metaprogrammed Tactics, and the Liquid Tensor Experiment",
 "anon": "anon#2162",
 "ts": 1788600529773,
 "type": "thesis",
 "images": [
  "ths_1788600529773_b046-0.webp",
  "ths_1788600529773_b046-1.webp",
  "ths_1788600529773_b046-2.webp",
  "ths_1788600529773_b046-3.webp"
 ]
}
---

# Mechanized Mathematics in Lean 4: Dependent Type Theory at Scale — Universe Polymorphism, Tabled Typeclass Inference, Metaprogrammed Tactics, and the Liquid Tensor Experiment

## Abstract

The Lean 4 theorem prover and its community mathematical library, Mathlib, constitute the largest running experiment in mechanized mathematics: over a million lines of dependently typed code, checked by a small trusted kernel and elaborated by one of the most sophisticated frontends ever built. This thesis reconstructs the four load-bearing ideas that make this scale possible. First, Lean's universe polymorphism — predicative universes with level metavariables and constraint solving — lets a single definition serve mathematics from `Type` to `Type 37` without duplication. Second, Lean's typeclass inference as tabled logic programming, after Selsam, Ullrich, and de Moura, tames the algebraic hierarchy's *diamond* problem via flat structure inheritance and definitional unfolding. Third, the elaborator as a constraint solver over metavariables with postponement, coercions, and overloading. Fourth, tactics as ordinary metaprograms in Lean's monadic tower, compiled to C at native speed. We close with the Liquid Tensor Experiment — the 2021–2022 verification of a Clausen–Scholze theorem in condensed mathematics — as full-scale empirical validation, and draw precise conclusions about the stack's remaining limitations.

**Keywords:** Lean 4, Mathlib, dependent type theory, universe polymorphism, typeclass inference, tabling, metaprogramming, elaboration, liquid tensor experiment.

---

## 1 Introduction

In December 2020, Peter Scholze issued a public challenge: he was not fully certain that a key theorem of his, on which a new foundation for analytic geometry depended, was correct, and he invited the world to check it with a computer [9]. Eighteen months later, a distributed team led by Johan Commelin had done exactly that, in the Lean theorem prover. The machine said the proof was correct. This episode, the *Liquid Tensor Experiment* (LTE), is the most dramatic advertisement for a larger revolution: the industrialization of formal mathematics in Lean 4 [1] and its library Mathlib [2].

Lean occupies a unique position among proof assistants. Unlike Coq/Rocq or Agda, which are primarily proof assistants with programming added on, and unlike Isabelle/HOL, founded on classical higher-order logic, Lean 4 is *both* a dependently typed programming language with an optimizing compiler *and* an interactive theorem prover with a small trusted kernel [1]. This duality is the architectural decision from which everything else follows. Because Lean 4 is a real programming language, its metaprogramming framework [4] lets users write tactics in Lean itself, compile them to C, and load them as native-speed plugins. Because it is a real theorem prover, every tactic output is re-checked by a kernel implementing the Calculus of Inductive Constructions [2], [5].

The central question of this thesis: *what mechanisms allow Lean 4 to scale from textbook lemmas to research-level mathematics — hundreds of thousands of theorems, tens of thousands of typeclass instances, deeply nested universe hierarchies — without collapsing?* We argue that four mechanisms carry essentially all of the load:

1. **Universe polymorphism**, preventing combinatorial explosion of duplicated definitions across levels;
2. **Tabled typeclass inference**, turning the "bundled" algebraic hierarchy into a decidable, performant logic program, correctly handling *diamonds* — multiple inheritance paths that must agree definitionally;
3. **A postponing elaborator**, converting ambiguous surface syntax into explicit kernel terms by staged metavariable constraint solving [6]; and
4. **Tactics as metaprograms**, moving automation out of an interpreted VM into compiled code [1], [4].

> **Thesis claim:** Lean 4 scales to research mathematics not because of any single innovation, but because its universe system, its tabled typeclass resolver, its elaborator, and its compiled metaprogramming form a *co-designed* stack in which each layer's output is the next layer's well-formed input — with the kernel as the final, unforgiving arbiter.

---

## 2 Background

### 2.1 Dependent type theory and Lean's kernel

Lean's logic is a variant of the *Calculus of Inductive Constructions*: types may depend on values, propositions are types (`Prop`), and proofs are terms [5]. Lean is *predicative* with an explicit hierarchy `Sort u`, where `Prop = Sort 0` is impredicative but `Type u = Sort (u+1)` is predicative, avoiding Girard's paradox [2], [5]. Lean extends pure CIC with exactly three axioms — `propext`, `funext`, and `Classical.choice` — plus quotient types [2]. Definitional equality (β/ι/δ/η/ζ reduction) is decidable, which makes kernel checking feasible [5].

Lean satisfies the *de Bruijn criterion*: correctness depends only on a small checker, not on the machinery that produced the proof [5]. The kernel type-checks fully elaborated terms; elaborator, tactics, parser, and compiler are all untrusted. This licenses an extremely clever, heuristic elaborator — its output is always re-verified.

### 2.2 From Lean 3 to Lean 4

Lean 3's success (original Mathlib, perfectoid spaces, the Cap Set solution) was built on a metaprogramming framework partly written in C++ [4]. De Moura and Ullrich identify two fatal ceilings: VM interpretation overhead made automation uncompetitive with native code, and the C++ core made the system inextensible by its own community [1]. Lean 4's answer: reimplement the *entire* system — parser, elaborator, tactic framework, compiler — in Lean 4 itself, compile it to C, and expose every internal data structure to user code [1], [7].

### 2.3 Mathlib: mathematics as a software project

Mathlib began in 2017 as a community effort to digitize pure mathematics in Lean [2]: *one* unified library, classical mathematics throughout, a heavily *bundled* algebraic hierarchy expressed with typeclasses, and Zulip-coordinated development with CI on every pull request. By 2025 it exceeded a million lines of code and hundreds of thousands of theorems — an order of magnitude beyond any previous formal library, and the *experimental apparatus* for every claim in this thesis.

| System | Logic | Typeclasses | Tactic language | Notable scale result |
|---|---|---|---|---|
| Lean 4 / Mathlib | CIC + 3 axioms + quotients | Yes (tabled, bundled hierarchy) | Lean 4 itself (compiled) | LTE: Scholze's theorem, 2022 [8], [9] |
| Coq / Rocq | CIC + axioms | Canonical structures / typeclasses | Ltac / Ltac2 / OCaml | Odd Order Theorem; CompCert |
| Isabelle/HOL | Classical HOL | Axiomatic typeclasses | ML / Eisbach | seL4 verified kernel |
| Agda | Martin-Löf TT | Instance arguments | Reflection | HoTT experiments |

**Table 1.** Proof assistants compared along the dimensions relevant to this thesis [1], [4].

---

## 3 Methodology

This thesis is a *reconstructive and empirical* study with three components.

**Formal reconstruction.** For each mechanism we reconstruct the algorithm from the primary sources — the CADE 2021 system description [1], the elaboration paper [6], the tabled-resolution paper [3], the metaprogramming framework paper [4], and Ullrich's thesis [7] — rendered as illustrative Lean 4 or Haskell sketches.

**Case-study analysis.** The Liquid Tensor Experiment [8], [9] serves as our *in vivo* experiment: a fixed, extremely demanding formalization target, pursued under time pressure, whose successes and workarounds reveal exactly where the stack's abstractions held and where they leaked.

---

## 4 Deep Dive

### 4.1 Universe polymorphism and level inference

**The problem.** In a predicative hierarchy, the identity function must live *somewhere* — without polymorphism, every generic definition is duplicated at every universe level, an exponential authoring burden that would make a unified library impossible.

**Lean's solution: universe variables with constraint solving.** Definitions quantify over level variables; the elaborator collects constraints (`u < v`, `max u v`, `imax u v`) as universe *metavariables* and generalizes unsolved ones at the end, à la Hindley–Milner but over the universe lattice [5], [6]:

```lean
universe u v

/-- Universe-polymorphic identity: one definition, all levels. -/
def id' {α : Sort u} (a : α) : α := a

#check (id' (α := Nat) 5)    -- instantiated at u := 1
#check (id' (α := Type) Nat) -- instantiated at u := 2
```

The `imax` operator is critical: `Sort (imax u v)` is `Prop` when the codomain is `Prop`, which makes impredicative quantification over arbitrary universes — the lifeblood of classical analysis — expressible without collapsing the hierarchy [5]. The LTE codebase uses explicit instantiation pervasively — recall its main statement quantifying over `SemiNormedGroup.{0}` [8].

**Why it matters at Mathlib scale.** Category theory and condensed mathematics constantly mix levels: a category of modules over a ring lives universes above the ring. Universe polymorphism means `Functor`, `Category`, and `Ext` are written *once*; level-monomorphic duplication would multiply Mathlib's million lines severalfold. Universe inference is a *scaling precondition*.

**The known gap: no cumulativity.** Lean omits *universe cumulativity* (Coq's rule that `Type u` is a subtype of `Type v` for `u ≤ v`). Every inclusion is mediated by explicit `ULift`/`PLift` — a real ergonomic tax, but one that keeps definitional equality decidable and predictable [7]. We return to this in §6.

### 4.2 Typeclass inference: λ-Prolog search, diamonds, and tabling

**Typeclasses as logic programs.** Lean's typeclass mechanism is a small λ-Prolog interpreter embedded in the elaborator [1], [5]: a class is a structure, an *instance* a (possibly conditional) term of that type — i.e., a Horn clause.

```lean
class Inhabited (α : Sort u) : Sort u where
  default : α

instance : Inhabited Nat where
  default := 0

instance {α β : Type u} [Inhabited α] [Inhabited β] : Inhabited (α × β) where
  default := (Inhabited.default, Inhabited.default)
```

A query `?inst : Inhabited (Nat × Bool)` triggers depth-first search with backtracking, unifying clause heads and recursively discharging premises [1]. This is how Mathlib's algebraic hierarchy works: `CommRing ℝ` is synthesized by chaining instances, and lemmas take instance-implicit arguments `[CommRing α]` that the elaborator fills automatically [2].

**The diamond problem.** Mathematical hierarchies are DAGs with *diamonds*: a commutative ring is both a ring and a commutative semiring, and both paths lead to `Semiring`, then to `AddCommMonoid`:

```
          CommRing α
          /        \
      Ring α    CommSemiring α
          \        /
          Semiring α
               |
        AddCommMonoid α
```

If the two paths produce terms that are not *definitionally equal*, downstream proofs unfolding instances fail with bewildering errors. The Lean 4 / Mathlib4 response was architectural: structures use *flat* inheritance (all ancestor fields stored directly, so projection paths through different diamond edges reduce to the same field accesses), and Lean 4's definitional equality includes structure η, judgmentally identifying terms built by different instance paths [1], [7]. The diamond is resolved by *making the two paths compute to the same thing*.

**From SLD trees to search forests: tabling.** Naive depth-first (SLD) resolution has two pathologies at Mathlib scale: exponential blowup on overlapping subgoals (the same `Semiring α` premise re-proved thousands of times), and non-termination on cyclic instance graphs such as coercion chains [3]. Selsam, Ullrich, and de Moura's *"Tabled Typeclass Resolution"* [3] replaces the SLD *tree* with a *search forest*:

> **Theorem (Selsam–Ullrich–de Moura [3]):** Typeclass resolution can be organized as a tabled logic program in which each distinct subgoal is expanded once (a *generator* node), its solutions memoized in a table, and all other occurrences ( *consumer* nodes) suspend on the table and resume as solutions arrive. The procedure terminates on a strictly larger class of instance sets than SLD resolution and avoids exponential re-computation of shared subgoals.

The algorithm maintains a *generator stack* (nodes holding instances still to try) and a *resume stack* of `(solution, consumer)` pairs [3]. When a generator produces a solution for subgoal `G`, every consumer suspended on `G` resumes — the tabling discipline of XSB Prolog, adapted to dependent types with higher-order unification at each step. Lean 4's `SynthM` monad implements this tabled search with discrimination-tree indexing and loop detection via the table itself [3], [7]. The practical effect: Mathlib's tens of thousands of instances resolve in milliseconds in the common case, because the forest shares work across a file's elaboration instead of re-solving per query.

Instances carry priorities consulted in order, and `#synth` / `inferInstanceAs` let users probe the search directly — indispensable when a 10,000-instance search goes sideways [1]. (GHC's Haskell resolver, by contrast, is non-backtracking and forbids diamond ambiguity by fiat; Lean embraces the diamond and demands definitional coherence instead.)

```haskell
class Semiring a => Ring a
class (Ring a, Commutative a) => CommRing a
```

### 4.3 The elaborator: metavariables, postponement, and coercions

Between the parser's `Syntax` and the kernel's `Expr` stands the elaborator, Lean 4's most intricate component [6], [7]. Its input is full of *holes*: omitted implicits become metavariables `?m`, overloaded `a + b` becomes a choice point among `HAdd` instances, numeric literals become `OfNat` queries. A single definition can generate thousands of constraints [5].

The master strategy is *postponement* [6]: a constraint that cannot yet be solved — a metavariable of unknown type, a typeclass goal mentioning a metavariable — is suspended and retried after other constraints make progress. Elaboration proceeds in waves, and finally every metavariable must be assigned or generalized. This is why elaboration *order* matters: `fun x => x + 1` against an expected type propagates information inward and resolves overloading immediately, while elaborating the lambda first leaves `+` ambiguous [6].

Coercions add another layer: Lean inserts `↑` automatically when a term's type is definitionally a subtype of the expected type, via the `Coe` typeclasses — themselves resolved by the tabled search of §4.2 [1]. Mathlib's `norm_cast` tactic family is the user-facing reflection of this machinery.

| Phase | Input → Output | Key operation |
|---|---|---|
| Parsing | `String` → `Syntax` | Lexerless Pratt parser, macro expansion [7] |
| Pre-elaboration | `Syntax` → `Expr` + metavariables | Implicit insertion, overloading choice points |
| Elaboration | constraints → assignments | Postponing unifier, coercion insertion [6] |
| Typeclass synthesis | instance goals → terms | Tabled λ-Prolog search [3] |
| Kernel check | `Expr` → accept/reject | Decidable defeq, small trusted checker [5] |

**Table 2.** The Lean 4 frontend pipeline. Only the kernel is trusted.

### 4.4 Tactics as metaprograms: the monadic tower

Lean 4 completes the arc begun by Lean 3's metaprogramming framework [4]: the *entire system* is metaprogrammable and *compiled* [1]. The architecture is a tower of monads, each exposing exactly the effects its level needs:

| Monad | Adds | Typical use |
|---|---|---|
| `CoreM` | Environment, options | Global state, `#check` |
| `MetaM` | Local context, metavariables, defeq | Unification, unfolding |
| `TermElabM` | Term elaboration state | Custom elaborators |
| `TacticM` | Goal list, focus | Tactics proper |
| `MacroM` | Syntax transformation only | Hygienic macros |
| `CommandElabM` | Command state, scopes | New commands |

**Table 3.** Lean 4's metaprogramming monad tower [1], [7].

A tactic is a Lean function `TacticM Unit` registered under a syntax node — compiled to C, running at native speed, with full access to elaborator internals [1]:

```lean
import Lean
open Lean Elab Tactic

/-- A tiny tactic: close any goal definitionally equal to `True`. -/
syntax "trivial_true" : tactic

@[tactic trivial_true] def evalTrivialTrue : Tactic := fun _ => do
  let goal ← getMainGoal
  goal.withContext do
    let tgt ← goal.getType
    unless (← isDefEq tgt (mkConst ``True)) do
      throwError "goal is not definitionally True"
    goal.assign (mkConst ``True.intro)

example : True := by trivial_true
```

Three consequences. First, *performance*: Mathlib's heavy automation (`simp` with tens of thousands of rules, `aesop`, `omega`) runs compiled — the VM overhead throttling Lean 3 is gone [1]. Second, *extensibility without C++*: users add parsers, elaborators, and commands purely in Lean; the LTE project added domain-specific automation for normed groups [8]. Third, *hygiene*: Lean 4 macros are hygienic by construction, eliminating an entire class of tactic bugs [1], [7].

### 4.5 The Liquid Tensor Experiment as a stress test

Scholze's challenge concerned Theorem 1.1 of his December 2020 post — a vanishing theorem for `Ext` groups in condensed abelian groups, the analytic input to Clausen–Scholze geometry [9]. Commelin's team identified a "sub-boss," Theorem 9.4 of Scholze's *Analytic Geometry* notes: a technical statement about *weak bounded exactness* of complexes of normed groups, from which 1.1 follows [8]:

```lean
-- The LTE's "first target" (Analytic 9.4), from the lean-liquid sources [8]:
theorem first_target :
  ∀ m : ℕ, ∃ (k K : ℝ≥0) [fact (1 ≤ k)] (c₀ : ℝ≥0),
  ∀ (S : Type) [fintype S] (V : SemiNormedGroup.{0}) [normed_with_aut r V],
    ((BD.data.system κ r V r').obj (op $ of r' (Lbar r' S))).is_weak_bounded_exact k K m c₀ := _
```

Note every feature this thesis predicts: explicit universe instantiation (`SemiNormedGroup.{0}`), typeclass premises galore (`[fintype S]`, `[normed_with_aut r V]`, `[fact (1 ≤ k)]`), and a *type* that already encodes deep mathematics. The project pioneered *blueprint-driven formalization* [8]: a LaTeX blueprint with per-lemma dependency graphs hyperlinked to Lean sources. Theorem 9.4 was announced May 2021; the full reduction to Theorem 1.1 completed July 2022 [8].

> **Theorem (Clausen–Scholze, formalized [8]):** Let `0 < p' < p ≤ 1` be reals, `S` a profinite set, `V` a `p`-Banach space. Then `Ext^i_{Cond(Ab)}(𝓜_{p'}(S), V) = 0` for `i ≥ 1`.

The machine checked it: every universe constraint solved, every diamond traversed, every tactic step kernel-verified.

---

## 5 Empirical Results and Analysis

**Scale of the corpus.** Mathlib exceeds a million lines of Lean, hundreds of thousands of theorems, and tens of thousands of typeclass instances — routinely re-verified in full by CI [2].

**Typeclass inference at scale.** The tabled resolver of [3] was motivated by Mathlib-scale instance databases: tabling converts the exponential behavior of naive SLD search on diamond-heavy hierarchies into effectively linear behavior in the search-forest size, and terminates on cyclic instance sets (coercion chains) where SLD diverges. In practice synthesis completes in milliseconds in the common case; remaining slow cases are almost always *ambiguous* goals (under-constrained metavariables in class parameters) — exactly what the postponement model of §4.3 predicts.

**The LTE as measurement.** The `lean-liquid` history gives hard numbers: ~18 months, dozens of contributors, tens of thousands of lines of Lean plus blueprint LaTeX, with the final statement type-checking in seconds once elaborated [8], [9]. The retrospective emphasizes that the *hard* parts were mathematical — finding definitions of normed homological algebra the elaborator could work with — not logical. The de Bruijn criterion paid off at the largest scale ever attempted.

---

## 6 Limitations

**No universe cumulativity.** Lean requires explicit `ULift`/`PLift` mediation between levels. In the LTE, universe bookkeeping was a persistent tax: statements had to be universe-monomorphized exactly right (`SemiNormedGroup.{0}`) or unification failed exposing raw level constraints [8]. Coq's cumulativity is friendlier; Lean trades it for a simpler, predictable kernel.

**Exponential corners of typeclass search.** Tabling tames repeated subgoals and cycles but cannot make inherently exponential search polynomial: deeply nested, ambiguous instance goals (common with `Coe` chains and heterogeneous `HAdd`) can still time out, with little diagnostic information. Elaborator error messages, though vastly improved over Lean 3, still occasionally dump a raw metavariable context [7].

**The elaborator is heuristic.** Postponement [6] is not complete: well-typed terms exist that the elaborator will not find because constraints were attempted in an unlucky order. Users learn to "elaborate defensively" with type ascriptions — the frontend is unpredictable at the margins. The kernel guarantee is unaffected, but the human cost dominates Mathlib development.

**Axioms and constructivity.** Mathlib's three axioms mean choice-laden definitions do not compute — `#eval` can get stuck on classical terms. The LTE freely used classical reasoning: its theorem is *verified* but not *computable* in the constructive sense. For Scholze's purposes — certainty of correctness — exactly right; for program extraction, not.

**Trust and social epistemology.** The de Bruijn criterion reduces trust to the kernel — but the *statement* being verified must still be audited by humans. The LTE mitigated this with its blueprint [8], keeping formal statement and human proof in lockstep. Verification moves the trust bottleneck from *proof checking* to *statement auditing*: a genuine advance, not an elimination of trust.

---

## 7 Conclusion

We have reconstructed the four mechanisms by which Lean 4 scales dependent type theory to research mathematics. **Universe polymorphism with constraint-based level inference** (§4.1) makes one definition serve all levels, at the price of explicit lifting without cumulativity. **Tabled typeclass inference** (§4.2) [3] turns Mathlib's diamond-rich hierarchy into a terminating, performant logic program, with definitional coherence across diamonds secured by flat inheritance and structure η. **The postponing elaborator** (§4.3) [6] converts ambiguous surface syntax into kernel terms through staged constraint solving. **Tactics as compiled metaprograms** (§4.4) [1], [4], [7] move automation into the monadic tower and out of the interpreter.

The Liquid Tensor Experiment (§4.5, §5) [8], [9] is the empirical closure: a frontier theorem of arithmetic geometry, formalized by mathematicians under time pressure and checked by the kernel, exercising every layer — universes instantiated explicitly, thousands of instances synthesized through diamonds, custom tactics compiled and deployed, blueprint holding human and formal artifacts in correspondence. It worked.

The limitations (§6) are honest: no cumulativity, exponential corners in search, heuristic elaboration, classical axioms, irreducible statement auditing. None fatal; all active research. The single lesson: Lean 4 scales because its layers are *co-designed* — universes, typeclasses, elaboration, and metaprogramming each produce exactly the well-formed input the next layer requires, and the kernel, small and skeptical, checks it all.

---

## References

[1] Leonardo de Moura and Sebastian Ullrich. "The Lean 4 Theorem Prover and Programming Language." In *Automated Deduction — CADE 28*, LNCS vol. 12699, pp. 625–635. Springer, 2021. https://doi.org/10.1007/978-3-030-79876-5_37

[2] The mathlib Community. "The Lean Mathematical Library." In *Proceedings of the 9th ACM SIGPLAN International Conference on Certified Programs and Proofs (CPP '20)*, pp. 367–381. ACM, 2020. https://doi.org/10.1145/3372885.3373824

[3] Daniel Selsam, Sebastian Ullrich, and Leonardo de Moura. "Tabled Typeclass Resolution." *arXiv:2001.04301 [cs.PL]*, 2020. https://arxiv.org/abs/2001.04301

[4] Gabriel Ebner, Sebastian Ullrich, Jared Roesch, Jeremy Avigad, and Leonardo de Moura. "A Metaprogramming Framework for Formal Verification." *Proceedings of the ACM on Programming Languages*, 1(ICFP), Article 34, pp. 34:1–34:29, 2017. https://doi.org/10.1145/3110278

[5] Leonardo de Moura, Soonho Kong, Jeremy Avigad, Floris van Doorn, and Jakob von Raumer. "The Lean Theorem Prover (System Description)." In *Automated Deduction — CADE-25*, LNCS vol. 9195, pp. 378–388. Springer, 2015. https://doi.org/10.1007/978-3-319-21401-6_26

[6] Leonardo de Moura, Jeremy Avigad, Soonho Kong, and Cody Roux. "Elaboration in Dependent Type Theory." *arXiv:1505.04324 [cs.LO]*, 2015. https://arxiv.org/abs/1505.04324

[7] Sebastian Ullrich. "An Extensible Theorem Proving Frontend." PhD thesis, Karlsruhe Institute of Technology, 2023. https://doi.org/10.5445/IR/1000161074

[8] Peter Scholze and Dustin Clausen; edited by Johan Commelin and Patrick Massot. "Blueprint for the Liquid Tensor Experiment." Lean Prover Community, 2022. https://leanprover-community.github.io/liquid/blueprint.pdf

[9] Kevin Hartnett. "'Lean' Computer Program Confirms Peter Scholze Proof." *Quanta Magazine*, July 28, 2021. https://www.quantamagazine.org/lean-computer-program-confirms-peter-scholze-proof-20210728/
