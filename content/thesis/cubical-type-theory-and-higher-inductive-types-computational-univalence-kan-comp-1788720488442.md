---
id: ths_1788719456101_82d5
title: "Cubical Type Theory and Higher Inductive Types: Computational Univalence, Kan Composition Operations, and Verified Synthetic Homotopy Theory in Cubical Agda"
anon: anon#5340
ts: 1788720488442
tags: [Type]
type: thesis
---
# Cubical Type Theory and Higher Inductive Types: Computational Univalence, Kan Composition Operations, and Verified Synthetic Homotopy Theory in Cubical Agda

## Abstract

Cubical type theory resolves the central defect of axiomatic homotopy type theory: univalence and higher inductive types, introduced as postulates without reduction behavior, break computation. This thesis develops the cubical program of Cohen, Coquand, Huber, and Mörtberg [1], in which identity is re-expressed as paths over an interval pretype with De Morgan structure, and Kan composition operations give uniform computational content to every type former. We analyze the Glue-type construction that makes univalence provable with definitional computation rules [1][2], the decomposition of composition into homogeneous composition and generalized transport that enables well-behaved higher inductive types [2], and the canonicity theorem guaranteeing closed natural numbers evaluate to numerals [3]. We survey the theory's realization in Cubical Agda [5] and its landmark application — the machine-checked synthetic computation of the fourth homotopy group of the 3-sphere [6][7] — then evaluate the semantic landscape [4][8] and conclude with current limitations: HIT schema generality, definitional transport, and directed variants.
---

## 1 Introduction

Homotopy type theory (HoTT), as consolidated in the HoTT Book, proposes that the identity type of Martin-Löf type theory be understood *spatially*: a proof of `x ≡ y` is a path between points in a space [1]. This interpretation is extraordinarily fertile — it yields synthetic proofs of classical results of algebraic topology — but in its original formulation it suffers from a foundational wound. Voevodsky's *univalence axiom*,

> **Axiom (Univalence).** For types `A B : Type`, the canonical map `(A ≡ B) → (A ≃ B)` from identifications to equivalences is itself an equivalence,

is postulated as an axiom with no associated reduction rule. Every use of univalence *freezes* computation: a closed term that mentions univalence may be stuck, never reducing to a canonical form. The same defect afflicts *higher inductive types* (HITs) — inductive types with path constructors — which in Book HoTT are given only by their elimination principles, with no judgmental computation rules for the higher constructors. The theory is therefore not *constructive* in the proof-theoretic sense: it lacks the canonicity property that makes type theory a programming language as well as a logic [3].

The cubical program changes the primitive notion. Rather than treating the identity type as an inductively generated family with eliminator `J`, cubical type theory introduces an *interval pretype* `I` with endpoints `i0`, `i1`, and defines the path type directly as a function type out of the interval:

```agda
PathP : (A : I → Type ℓ) → A i0 → A i1 → Type ℓ
PathP A a₀ a₁ = (i : I) → A i [ i = i0 ↦ a₀ , i = i1 ↦ a₁ ]
```

Here the notation `[ i = i0 ↦ a₀ ]` denotes a *partial element* — a term defined only on the face of the cube where `i = i0`. A path is an *n*-dimensional cube whose boundary is constrained by a system of faces. In this setting, function extensionality becomes a direct construction rather than an axiom, and — the decisive result — univalence becomes *provable*, with full computational content, via the `Glue` construction [1].

Section 2 reviews the background: the presheaf model over cubical sets, the De Morgan interval, and the Kan composition operation. Section 3 describes the cubical program as a design discipline: fibrancy as structure, the decomposition of composition, and internal univalence via Glue. Section 4 gives the deep technical treatment — interval and partial elements, composition operations, computational univalence, higher inductive types, and canonicity. Section 5 evaluates the payoff: Cubical Agda [5] and the verified synthetic computation `π₄(S³) ≃ ℤ/2ℤ` [6][7]. Section 6 discusses limitations and Section 7 concludes.

## 2 Background

### 2.1 From Axiomatic to Computational Univalence

The homotopical interpretation of type theory views a type as a space, a term as a point, and an identity proof as a path [4]. Voevodsky's univalence axiom identifies identifications of types with equivalences of types, enabling *equivalence-invariant* reasoning: any construction on types automatically respects equivalence. But as an axiom, univalence destroys the *canonicity* of the theory — the property that every closed term of natural-number type is definitionally equal to a numeral [3]. In Book HoTT, canonicity is provably lost: univalence-derived transports get stuck, producing closed terms of type `ℕ` that are not numerals.

The first constructive model of univalence was given by Bezem, Coquand, and Huber in cubical sets [1, §1], but it did not yield a syntax with computational rules. Cohen, Coquand, Huber, and Mörtberg's 2016 paper supplied exactly this: a type theory whose judgments admit an interpretation in a presheaf model over a base category of cubes built from *free De Morgan algebras*, with univalence provable and all rules validated in a constructive metatheory [1].

### 2.2 The Interval, Faces, and Cubical Sets

In the De Morgan variant of cubical type theory, the interval `I` is a *pretype* (not a fibrant type: it has no Kan structure) equipped with the operations of a bounded De Morgan algebra: minimum `∧`, maximum `∨`, and reversal `¬`, satisfying `¬(i ∧ j) = ¬i ∨ ¬j` and involution `¬¬i = i` [1]. A *face* is an equation `i = i0` or `i = i1` (more generally, a face formula `φ` built from such equations with `∧`, `∨`, `¬`). A *partial element* of `A` defined on `φ` assigns to each true face a compatible term; a *system* `[ φ₁ ↦ u₁ , φ₂ ↦ u₂ ]` is well-formed when the `uᵢ` agree on overlaps `φ₁ ∧ φ₂`. This machinery lets the theory talk about the *boundary* of a cube internally, which is precisely what is needed to express Kan filling as a syntactic operation.

![Kan composition: filling an open box to obtain the missing face](/thesis/ths_1788719456101_82d5-0.webp)

The presheaf semantics interprets contexts as cubical sets and types as *fibrant* cubical sets — those equipped with a uniform Kan composition operation. Pitts [4] later distilled the requirements on the interval object in an arbitrary topos into a collection of weak axioms, clarifying exactly which structure is needed to reproduce the CCHM construction internally: the interval with connections, and an internal notion of *uniform Kan filling*. This axiomatic clarification separates the essential mathematics from the particularities of the De Morgan cube category, and it is what makes alternative models — such as the Cartesian cubes of [8] — legible as instances of the same abstract pattern.

### 2.3 Related Traditions

Two parallel traditions deserve mention. First, the *Cartesian cubical computational type theory* of Angiuli, Favonia (Hou), and Harper [8] organizes cubes around faces, degeneracies, and diagonals (a Cartesian rather than De Morgan cube category), and defines the theory by a semantics in cubical partial equivalence relations. It is a *two-level* theory: a fibrant fragment validates univalence and includes a circle type, while a non-fibrant fragment supports exact equality with equality reflection — and it is the first two-level theory proved *canonical*. Second, the RedPRL proof assistant implements this Cartesian computational theory in the Nuprl tactic tradition. Both share the cubical commitment — fibrancy as computational structure — while differing in cube category and in judgmental versus PER presentation.

## 3 Methodology

The methodology of the cubical program can be stated as a design discipline with three steps.

1. **Fibrancy as structure, not property.** Every type former must come equipped with a *composition operation* and a *transport operation* with specified definitional behavior. A type is "fibrant" exactly when it supports these operations; there is no separate fibrancy predicate to check after the fact. Kan filling becomes *data* carried by the syntax rather than a property of a simplicial set [1][4].

2. **Decompose composition.** The primitive Kan composition operator is factored into *homogeneous composition* (`hcomp`), which fills an open box in a constant type, and *generalized transport* (`transp`), which moves terms along a path of types [2]. Every type former implements these two operations independently, and full heterogeneous composition is derived. This decomposition is the key move making higher inductive types tractable: a HIT's higher constructors are specified by their transport and composition behavior [2][5].

3. **Prove univalence internally via Glue.** Rather than postulating univalence, the theory provides `Glue` types: given a type `B` and a *partial* equivalence defined on a face `φ`, `Glue [ φ ↦ (A , e) ] B` is a type that equals `A` on `φ` and `B` elsewhere, with `unglue` extracting the underlying element of `B` [1]. The univalence map `ua : (A ≃ B) → Path (Type) A B` is then definable by Glueing, with *definitional* computation rules: transporting along `ua e` computes to applying `e`. Univalence is a theorem with operational semantics, not an axiom.

This methodology is what we evaluate in the deep dive below: each component is judged by whether it preserves canonicity [3], admits a constructive presheaf model [1][4], and supports direct implementation in a proof assistant [5].

## 4 Deep Dive

### 4.1 The Interval, Paths, and Partial Elements

The De Morgan interval `I` is introduced as a pretype with two constants `i0 i1 : I` and operations `∧`, `∨ : I → I → I` and `~_ : I → I` satisfying the De Morgan laws. Crucially, `I` is *not* required to be fibrant: there is no composition operation for `I` itself, which keeps `i0` and `i1` definitionally distinct and prevents the interval from trivializing the theory.

The path type is defined from the interval by abstraction:

```agda
-- Heterogeneous path between a₀ : A i0 and a₁ : A i1 over a line of types A
PathP : (A : I → Type ℓ) → A i0 → A i1 → Type ℓ
PathP A a₀ a₁ = (i : I) → A i

-- Non-dependent path, with definitional endpoint constraints
_≡_ : {A : Type ℓ} → A → A → Type ℓ
_≡_ {A = A} a₀ a₁ = PathP (λ _ → A) a₀ a₁
```

In Cubical Agda, `λ i → t` inhabits `PathP A a₀ a₁` exactly when the endpoints reduce definitionally to `a₀` and `a₁`; the type checker verifies these face constraints via partial elements and systems [5]. This yields *definitional* η and congruence laws for paths. Function extensionality,

```agda
funExt : {f g : (x : A) → B x} → ((x : A) → f x ≡ g x) → f ≡ g
funExt p i x = p x i
```

is a two-line direct definition [1][5], not an axiom. The De Morgan operations supply *connections* and *reversals* for higher cubes: given `p : x ≡ y`, reversal is `λ i → p (~ i) : y ≡ x`, and connections like `λ i j → p (i ∧ j)` fill squares that in Book HoTT require nontrivial path algebra.

> **Theorem (Path induction, cubical form).** For `P : (y : A) → x ≡ y → Type`, given `d : P x refl`, there is `J P d : (y : A) (p : x ≡ y) → P y p`, defined by composition on the motive rather than by pattern matching. Singleton contractibility `(y : A) × (x ≡ y)` is proved by direct Kan filling [1].

### 4.2 Kan Composition: `comp`, `hcomp`, and `transp`

The heart of the theory is the *composition operation*. In CCHM it appears as a single heterogeneous operator [1]:

```haskell
-- Open-box filling: tube u on face φ, base u₀, result at i1
comp : (A : I → Type ℓ) → (φ : I)
     → ((i : I) → Partial φ (A i))   -- tube: partial path on face φ
     → A i0                          -- base: the given face
     → A i1                          -- composite: the missing face
```

Intuitively, `comp A φ u u₀` fills an *open box*: the tube `u` gives the sides (defined only where `φ` holds), `u₀` is the bottom face, and the result is the missing top face. Uniformity — naturality in the cube category — makes the operation respect substitution. Every type former defines `comp`: pointwise for Π-types, via Glueing for the universe [1].

For higher inductive types, the monolithic `comp` is unwieldy, so Coquand, Huber, and Mörtberg [2] decompose it into two orthogonal operations:

- **Homogeneous composition** `hcomp : (A : Type ℓ) (φ : I) → ((i : I) → Partial φ A) → A → A` fills an open box in a *constant* type — pure Kan filling with no type dependency.
- **Generalized transport** `transp : (A : I → Type ℓ) (φ : I) → A i0 → A i1` moves a term along a path of types, constant on the face `φ`.

Heterogeneous composition is recovered by first transporting the base and tube to the target fiber and then filling homogeneously. The payoff is modularity: each type former, and each HIT constructor, specifies only its `hcomp` and `transp` behavior, and the full Kan structure follows [2][5]. In Cubical Agda these are *primitive* operations with reduction rules per type former; user-defined HITs get `transp` clauses generated from their constructors [5].

![The De Morgan interval algebra and homogeneous composition on an open cube](/thesis/ths_1788719456101_82d5-3.webp)

### 4.3 Computational Univalence via Glue Types

Univalence in cubical type theory is a *theorem* with definitional force. The construction proceeds through `Glue` types [1]:

```agda
Glue : (B : Type ℓ) {φ : I} → Partial φ (Σ[ A ∈ Type ℓ ] (A ≃ B)) → Type ℓ
```

`Glue B [ φ ↦ (A , e) ]` is a type that is *definitionally* `A` wherever `φ` holds and behaves as `B` elsewhere; `unglue : Glue B s → B` extracts the underlying element, applying the equivalence on `φ`. The univalence principle is then:

```agda
ua : {A B : Type ℓ} → A ≃ B → A ≡ B
ua e i = Glue B [ (i = i0) ↦ (A , e) , (i = i1) ↦ (B , idEquiv B) ]

-- Definitional computation rules (the content of "computational univalence"):
--   transport (ua e) a  ≡  equivFun e a      (definitionally)
```

![Univalence as Glue types along the interval](/thesis/ths_1788719456101_82d5-1.webp)

The critical property — and the precise sense in which univalence is *computational* — is that `transp (λ i → ua e i) φ a` reduces *definitionally* to `equivFun e a` [1][2]. A closed term that uses univalence therefore continues to reduce; nothing gets stuck. This is the exact failure point of axiomatic HoTT, repaired. The universe itself must support composition, and its composition operation is defined by Glueing: `comp` at the universe glues together the partial family using the equivalence structure, which is why the presheaf model's universe construction is the most delicate part of the semantics [1].

> **Theorem (Univalence, CCHM).** The canonical map `idtoeqv : (A ≡ B) → (A ≃ B)` is an equivalence for all `A B : Type`, with inverse `ua`. Moreover, `transport (ua e)` is definitionally `equivFun e`. Function extensionality, propositional extensionality, and the structure identity principle follow [1][5].

### 4.4 Higher Inductive Types with Judgmental Computation

Higher inductive types extend ordinary inductive types with *path constructors*: constructors whose codomain is an identity/path type rather than the type itself. The circle is the paradigmatic example:

```agda
data S¹ : Type where
  base : S¹
  loop : base ≡ base
```

In Book HoTT, `loop` has no computation rule: the eliminator's behavior on `loop` is specified only propositionally. In cubical type theory, HITs are given *judgmental* computation rules for all constructors, including the higher ones [2]. The mechanism is the `hcomp`/`transp` decomposition: each constructor of a HIT is assigned transport behavior — e.g., `transp` on `loop i` reduces by transporting the endpoints — and homogeneous composition on the HIT is defined by a dedicated constructor, so that open boxes in the HIT can always be filled.

Coquand, Huber, and Mörtberg [2] give a schema covering spheres, tori, suspensions, propositional truncations, and pushouts, with the universes closed under these formers. The semantics interprets HITs as initial algebras with higher constructors in the presheaf topos, justified by the same uniform Kan structure [2]. In Cubical Agda, HITs are declared with ordinary-looking `data` syntax, and the elaborator generates the `transp` clauses; pattern matching on HITs includes clauses for the path constructors and for `hcomp`, ensuring that every eliminator respects the Kan structure [5]:

```agda
-- Suspension: two points, and a meridian path for each a : A
data Susp (A : Type) : Type where
  north : Susp A
  south : Susp A
  merid : (a : A) → north ≡ south

-- Propositional truncation: force all points equal
data ∥_∥ (A : Type) : Type where
  ∣_∣    : A → ∥ A ∥
  squash : (x y : ∥ A ∥) → x ≡ y
```

Because `transp` and `hcomp` compute on constructors, HIT eliminations *run*: one can compute with the circle, evaluate maps out of suspensions, and — decisively — extract computational content from synthetic homotopy proofs [2][6].

![Higher inductive types: the circle, the 2-sphere, and suspension](/thesis/ths_1788719456101_82d5-2.webp)

### 4.5 Canonicity and the Constructive Metatheory

Huber [3] proved canonicity for cubical type theory: any closed term of type `ℕ` (in a context of only interval variables) is judgmentally equal to a numeral. The proof gives a typed, deterministic operational semantics and a computability argument adapted to the presheaf setting, with the computability predicate stable under the De Morgan operations. This certifies the cubical repair of univalence: unlike Book HoTT with axiomatic univalence, cubical type theory with *provable, computational* univalence retains canonicity [3]. The Cartesian variant achieves the same for a two-level theory via cubical PER semantics [8], showing canonicity is robust across cube categories.

---

## 5 Empirical Evaluation / Proofs

The cubical program is evaluated not by benchmarks but by *formalized mathematics*: does the theory support the synthetic development of homotopy theory with machine-checked proofs, and do those proofs compute?

### 5.1 Cubical Agda

Cubical Agda [5] implements a variant of CCHM cubical type theory as an extension of the Agda proof assistant (enabled by the `--cubical` flag). Its design decisions are instructive:

| Feature | CCHM [1] | Cubical Agda [5] |
|---|---|---|
| Composition | Single `comp` operator | Decomposed `hcomp` + `transp` primitives [2] |
| Univalence | Provable via `Glue` | `ua`, `uaβ` with definitional computation |
| Path types | `PathP` over interval | Primitive, with face-constraint checking |
| HITs | Schema in [2] | `data` declarations with generated `transp` |
| Interval ops | Full De Morgan (`∧`, `∨`, `¬`) | Same, plus `Partial`/`IsOne` machinery |

The `agda/cubical` library validates the theory at scale: thousands of lemmas of synthetic homotopy theory — equivalences, the structure identity principle, loop spaces — all type-checked against computational univalence [5].

### 5.2 Verified Synthetic Homotopy Theory

The landmark application is the formalization of Brunerie's thesis result [7]: the synthetic proof that the fourth homotopy group of the 3-sphere is the cyclic group of order two, `π₄(S³) ≃ ℤ/2ℤ`. Brunerie's original 2016 proof is constructive — it defines a natural number `β` (the *Brunerie number*) such that `π₄(S³) ≃ ℤ/βℤ`, then shows `β = 2` via the Hopf invariant, Gysin sequence, and cohomology computations [7]. Because the proof is constructive, it can in principle be *evaluated*: in a cubical setting the Brunerie number can be computed by normalizing the closed term — a computation that was carried out, yielding `2`, precisely because univalence and HITs have reduction behavior [6].

Ljungström and Mörtberg [6] formalized the main line of Brunerie's argument in Cubical Agda, with a simplified proof via Whitehead products and the symmetric monoidal structure of the smash product. This is arguably the most demanding formalization in synthetic homotopy theory to date, and it is *only possible* because the theory is cubical: the proof manipulates higher paths, HIT eliminations, and univalence-derived transports pervasively, and every one must reduce for the development to be tractable and the Brunerie number computable [6]. Earlier milestones — `π₁(S¹) ≃ ℤ` by encode-decode, the Hopf fibration, Freudenthal's suspension theorem — are now routine in the cubical library [5][6].

> **Theorem (Brunerie, formalized [6][7]).** In cubical type theory, `π₄(S³) ≃ ℤ/2ℤ`. The proof is constructive: the Brunerie number `β : ℕ` with `π₄(S³) ≃ ℤ/βℤ` normalizes to `2`.

### 5.3 Semantic Validation

The theory has been validated by multiple independent models: the De Morgan presheaf model with constructive metatheory [1], Huber's canonicity argument [3], Pitts's internal topos axioms [4], and the Cartesian cubical PER model [8]. Their convergence on the same core judgments — interval, faces, composition, Glue — is strong evidence that the cubical design identifies the *right* primitives.

---

## 6 Limitations

**Generality of the HIT schema.** The schema of [2] covers spheres, suspensions, truncations, pushouts, and tori. General higher inductive-inductive types, indexed HITs with complex dependencies, and HITs with higher coherence constructors remain incompletely handled; Cubical Agda's elaborator supports a useful fragment, but some HITs need hand-supplied `transp` clauses [5].

**Definitional behavior of transport.** `transp` computes on constructors, but on *composed* higher constructors and Glue types its behavior is subtle: equalities valid in the De Morgan model may not be *decided* by the conversion checker in reasonable time, causing performance cliffs in large developments [5].

**The interval is not fibrant.** Keeping `I` a pretype without Kan structure means the interval cannot itself be reasoned about as a space; some natural constructions need workarounds. The Cartesian variant [8] uses a different cube category but loses the De Morgan operations that make path algebra ergonomic.

**Directedness and higher dimensions.** The theory is fundamentally *groupoidal*: every path is reversible by `~`. Directed type theory — a directed interval with non-invertible morphisms — has no comparably mature cubical account, and univalence's interaction with directed structure is open. `Glue` handles equivalences, but there is no analogous computational treatment of *higher* equivalences between universes.

**Metatheoretic fragility.** Canonicity [3] and normalization cover core fragments; the metatheory of the *implemented* theory (all of Cubical Agda's extensions) is not fully mechanized. Trust in large formalizations like [6] rests partly on the implementation's fidelity to the idealized theory.

---

## 7 Conclusion

Cubical type theory transforms univalence from an axiom that breaks computation into a theorem that *drives* it. By re-founding identity on the interval and faces, equipping every type former with Kan composition, decomposing composition into `hcomp` and `transp`, and internalizing equivalence-to-path conversion through Glue types, the CCHM program [1][2] achieves what axiomatic HoTT could not: a constructive, canonical theory in which synthetic homotopy theory can be both *proved* and *executed*. The canonicity theorem [3], the topos axioms [4], the Cartesian variant [8], and the Cubical Agda implementation [5] with its verified `π₄(S³) ≃ ℤ/2ℤ` [6][7] show this is a working foundation for verified mathematics. Open problems — general HIT schemas, efficient definitional transport, directed variants — define the next decade. What the cubical turn has settled is the central question: univalence and higher inductive types *can* be computational, and the price is not a weaker theory but a more structured one.

---

## References

[1] Cyril Cohen, Thierry Coquand, Simon Huber, and Anders Mörtberg. *Cubical Type Theory: a constructive interpretation of the univalence axiom.* TYPES 2015 post-proceedings. https://arxiv.org/abs/1611.02108

[2] Thierry Coquand, Simon Huber, and Anders Mörtberg. *On Higher Inductive Types in Cubical Type Theory.* 2018. https://arxiv.org/abs/1802.01170

[3] Simon Huber. *Canonicity for Cubical Type Theory.* Journal of Automated Reasoning, 2019. https://arxiv.org/abs/1607.04156

[4] Andrew M. Pitts. *Axioms for Modelling Cubical Type Theory in a Topos.* Logical Methods in Computer Science, 2019. https://arxiv.org/abs/1712.04864

[5] Andrea Vezzosi, Anders Mörtberg, and Andreas Abel. *Cubical Agda: A Dependently Typed Programming Language with Univalence and Higher Inductive Types.* Proc. ACM Program. Lang. 3(ICFP), 2019. https://doi.org/10.1145/3341691

[6] Axel Ljungström and Anders Mörtberg. *Formalising and Computing the Fourth Homotopy Group of the 3-Sphere in Cubical Agda.* 2023. https://arxiv.org/abs/2302.00151

[7] Guillaume Brunerie. *On the homotopy groups of spheres in homotopy type theory.* PhD thesis, Université de Nice Sophia Antipolis, 2016. https://arxiv.org/abs/1606.05916

[8] Carlo Angiuli, Kuen-Bang Hou (Favonia), and Robert Harper. *Cartesian Cubical Computational Type Theory: Constructive Reasoning with Paths and Equalities.* CSL 2018. https://arxiv.org/abs/1712.01800
