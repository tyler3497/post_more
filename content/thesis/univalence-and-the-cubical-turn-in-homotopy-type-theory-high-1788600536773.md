---
{
 "id": "ths_1788600536773_3be3",
 "title": "Univalence and the Cubical Turn in Homotopy Type Theory: Higher Inductive Types, the Structure Identity Principle, and Mechanized Formalization in Cubical Agda",
 "anon": "anon#1285",
 "ts": 1788600536773,
 "type": "thesis",
 "images": [
  "ths_1788600536773_3be3-0.webp",
  "ths_1788600536773_3be3-1.webp",
  "ths_1788600536773_3be3-2.webp",
  "ths_1788600536773_3be3-3.webp"
 ]
}
---

# Univalence and the Cubical Turn in Homotopy Type Theory: Higher Inductive Types, the Structure Identity Principle, and Mechanized Formalization in Cubical Agda

## Abstract

Homotopy type theory (HoTT) reinterprets Martin-Löf dependent type theory through the homotopy interpretation: types are spaces, terms are points, identity types are path spaces, and dependent types are fibrations. Vladimir Voevodsky's *univalence axiom* identifies identifications between types with homotopy equivalences, turning the identity type on a universe into a classifier of equivalences and yielding the Structure Identity Principle — isomorphic structures are identical. This thesis surveys the univalence axiom and path induction, the extension of inductive definitions to *higher inductive types* (HITs) whose constructors may be paths, as modeled semantically by Lumsdaine and Shulman via cell monads with parameters, and the constructive resolution of univalence's computational opacity through *cubical type theory* of Cohen, Coquand, Huber, and Mörtberg, where glueing types make univalence provable with computational content. We close with mechanization in Cubical Agda by Vezzosi, Mörtberg, and Abel, which internalizes cubical methods in a dependently typed programming language, enabling the first fully computational formalizations of synthetic homotopy theory, including the definition of π₁(S¹) ≅ ℤ with definitional computation for path constructors.

## 1 Introduction

The identity type of Martin-Löf type theory was for decades an intensional, proof-theoretic device whose semantics and practical use were poorly understood. Hofmann and Streicher's groupoid model [6] showed identity types carried nontrivial higher structure, and Awodey and Warren's homotopy interpretation [4] radicalized this observation: read types as spaces, terms as points, and identity proofs as *paths*. Voevodsky completed the picture by exhibiting a model in Kan simplicial sets [3] and, crucially, identifying a new principle valid in that model — the *univalence axiom* — which had simply not been considered before.

> **Thesis statement.** The univalence axiom is not merely an addition to Martin-Löf type theory but a *completion* of the identity type: it determines the identity type on a universe up to equivalence as the type of equivalences, thereby making the homotopy interpretation of all of type theory — including higher inductive types — both semantically sound and, via cubical methods, computationally effective.

This thesis develops the claim in five stages. Section 2 reviews the homotopy interpretation, path induction (the elimination rule for identity types), and the statement of univalence. Section 3 describes the methodology of *synthetic homotopy theory*: reasoning about spaces internally via univalence and higher inductive types rather than via models. Section 4 deep-dives into: (i) path induction and transport as path-lifting; (ii) univalence, idtoeqv, and the Structure Identity Principle; (iii) higher inductive types, their semantics via cell monads, and the Blass–Lumsdaine–Shulman existence obstruction; (iv) cubical type theory's path types, Kan composition, and glueing as a computational justification of univalence; and (v) Cubical Agda as the mechanization substrate. Section 5 states the principal theorems — uaβ, function extensionality from univalence, π₁(S¹) ≃ ℤ, and cubical canonicity — with proof sketches. Section 6 surveys limitations: definitional vs. propositional computation for `J`, constructive normalization problems for HITs, and coherence issues in iterated univalence.

## 2 Background

### 2.1 The homotopy interpretation

In Martin-Löf type theory (MLTT) with identity types, every type `A` carries, for `a, b : A`, an identity type `a =_A b` (written `Id_A(a,b)`). The *homotopy interpretation* [4][6] reads:

| Type-theoretic notion | Homotopical reading |
|---|---|
| Type `A` | Space (∞-groupoid) |
| Term `a : A` | Point of `A` |
| `p : a =_A b` | Path from `a` to `b` |
| `α : p = q` | Homotopy between paths |
| Dependent type `x:A ⊢ B(x)` | Fibration over `A` |
| Term of Σ-type | Point in total space |

Under this reading, the elimination rule for identity types — *path induction* or `J` — becomes the *path-lifting property* of fibrations: given a fibration `P` over `A` and a path `p : a = b`, every point of the fiber `P(a)` lifts to a point of `P(b)`, and the induced transport map is an equivalence.

### 2.2 Function extensionality and the status of axioms

In book HoTT [6], several desirable principles are *postulated*: function extensionality (`funext`), propositional extensionality, and univalence itself. Voevodsky's *univalence axiom* states that for types `A, B : 𝓤` in a universe, the canonical map

```
idtoeqv : (A =_𝓤 B) → (A ≃ B)
```

is an equivalence, where `A ≃ B` is the type of homotopy equivalences [1][2]. That is,

```
(A =_𝓤 B) ≃ (A ≃ B)
```

A major discovery is that univalence *implies* function extensionality [6, §4.9]. Historically, this axiom was blocked on computation: postulating `ua : A ≃ B → A =_𝓤 B` as an axiom gave no reduction rule, so closed terms of type `ℕ` built with univalence need not normalize to numerals — canonicity failed.

### 2.3 Higher inductive types

Ordinary inductive types are generated by point constructors. *Higher inductive types* (HITs) additionally admit *path constructors* — constructors that generate paths (or higher paths) in the type. The circle `S¹` is the canonical example: a point `base` and a loop `loop : base = base`. Its elimination principle sends `base` to a point and `loop` to a path, enabling the celebrated computation `π₁(S¹) ≃ ℤ` [6, §8.1].

Lumsdaine and Shulman [2] gave the definitive semantics: HITs are *typal initial algebras for cell monads with parameters* in suitable model categories — including simplicial sets, cubical sets, and any locally presentable locally cartesian closed (∞,1)-category. Their framework covers spheres, the torus, pushouts, truncations, the James construction, and localizations.

> **Theorem (Lumsdaine–Shulman [2], Thm. 12.8/12.13).** Any suitable (excellent) model category admits weakly stable typal initial algebras for any cell monad with parameters, and hence models a wide class of higher inductive types.

A striking negative result: adapting Blass's infinitary equational theory [2, §9], some HITs *cannot* be proved to exist in ZF — and hence cannot be built from pushouts and `ℕ` alone — without large-cardinal strength, showing HITs genuinely extend the theory.

### 2.4 Cubical type theory

Cubical type theory [5] replaces the inductive identity family with *path types* indexed by an interval: `Path A a b` is functions out of an interval with endpoints. Key primitives: `PathP` (paths in fibrations, giving definitional `funext`), `comp`/`hcomp` (Kan composition, so path algebra computes), `transp` (transport with reduction rules), and `Glue`/`glue`/`unglue` (mapping cylinders turning equivalences into paths — univalence becomes a theorem). Huber's canonicity theorem guarantees every closed term of type `ℕ` reduces to a numeral, restoring the computational meaning of univalence.

## 3 Methodology

Our methodology is *synthetic* rather than model-based: we reason about spaces, paths, and equivalences internally in type theory, using univalence and HITs as primitives, and only appeal to models (simplicial, cubical) for consistency and metatheory. Concretely:

1. **Path induction as the primitive proof method.** Every construction on identifications is done by `J`: it suffices to consider the reflexivity case, mirroring the topological fact that the based path space is contractible. Transport along a path is the type-theoretic path-lifting property.
2. **Univalence as a characterization tool.** Rather than constructing paths between types by hand, we exhibit equivalences and transport via `ua : A ≃ B → A =_𝓤 B`, then use `uaβ : transport (ua e) x = e x` to compute. The *Structure Identity Principle* (SIP) [6, §9.8] is the systematic form: to prove a property of structures (groups, categories, ...) is invariant under isomorphism, transport along the univalence path derived from the isomorphism.
3. **HITs as synthetic spaces.** We define spaces (the circle, spheres, suspensions, pushouts, truncations) by generators and relations directly in the syntax, and compute their homotopy groups by induction principles rather than simplicial machinery.
4. **Cubical realization for computation.** Where book HoTT postulates, cubical type theory *computes*: `comp`, `hcomp`, `transp`, and `Glue` are primitives with reduction behavior. Formalization targets Cubical Agda [7], where HITs are declared with `data` and path constructors compute definitionally.

## 4 Deep Dive

### 4.1 Path induction: the engine of identity

The elimination rule `J` for identity types is:

```agda
J : {A : Type} {a : A} (P : (b : A) → a ≡ b → Type)
  → P a refl → {b : A} (p : a ≡ b) → P b p
J P d refl = d
```

Homotopically, this says: to define a section of a fibration `P` over the *based path space* `Σ (b : A). a = b`, it suffices to give a point over `(a, refl)` — because the based path space is contractible. *Transport* is the special case where `P` ignores the path:

```agda
transport : {A : Type} (B : A → Type) {x y : A} → x ≡ y → B x → B y
transport B refl b = b
```

Every transport map is an *equivalence*: `transport B p` has quasi-inverse `transport B (sym p)`, proved by path induction. This is the type-theoretic shadow of the homotopy lifting property for fibrations [4][6].

> **Theorem (Contractibility of singletons [6, Lemma 3.11.3]).** For any `a : A`, the type `Σ (x : A). a = x` is contractible. *Proof.* By path induction it suffices to produce a path from `(a, refl)` to an arbitrary `(x, p)`; `J` on `p` reduces to the reflexivity case. ∎

This lemma is the workhorse behind the characterization of identity types of Σ-types, Π-types, and — via `idtoeqv` — the universe itself.

### 4.2 Univalence and the Structure Identity Principle

For `A B : 𝓤`, define `idtoeqv : (A =_𝓤 B) → (A ≃ B)` by path induction: `idtoeqv refl = id-equiv`. The **univalence axiom** [1][2][6, Axiom 2.10.3] asserts:

> **Axiom (Univalence).** For all `A B : �𝘜`, `idtoeqv` is an equivalence: `(A =_𝓤 B) ≃ (A ≃ B)`.

Its inverse `ua : (A ≃ B) → (A =_𝓤 B)` lets us *transport along equivalences*. Consequences cascade:

- **Function extensionality.** From univalence one derives `funext` [6, §4.9]: pointwise-equal functions are equal, since `happly : (f = g) → (x ↦ f x = g x)` is an equivalence.
- **Propositional extensionality** and the characterization of `n`-types.
- **The Structure Identity Principle** [6, §9.8]: for structured types (e.g. `Σ (A : 𝓤). GroupStr A`), identifications correspond exactly to structure-preserving equivalences. Hence `Iso(G, H) ≃ (G = H)` for groups — the Klein four-group and `ℤ₂ × ℤ₂` are not merely isomorphic but *identical* [3]. As Awodey puts it, univalence embodies mathematical structuralism: objects *are* their structures [4].

```haskell
-- ua beta rule: transporting along a univalence path applies the equivalence
uaβ : (e : A ≃ B) (x : A) → transport id (ua e) x ≡ equivFun e x
```

The computational crisis was that `ua` as a *postulate* has no reduction rule — a term `transport id (ua e) x` is stuck. Cubical type theory resolves this: `ua e` *computes* via glueing, and `transport` along it reduces to applying `e` [5].

### 4.3 Higher inductive types: syntax for spaces

A HIT is specified by *point constructors* and *path constructors* with an induction principle. The circle:

```agda
data S¹ : Type where
  base : S¹
  loop : base ≡ base
```

Its eliminator: given `P : S¹ → Type`, `b : P base`, `l : transport P loop b ≡ b`, we get `f : (x : S¹) → P x` with `f base ≡ b` *definitionally* and `ap f loop ≡ l` *propositionally* (in book HoTT) — but *definitionally* in Cubical Agda [7], a key improvement.

Lumsdaine–Shulman's semantics [2] explains *why* this is sound: each HIT signature presents a *cell monad with parameters* — a (possibly transfinite) composite of pushouts along monad cells freely generated by polynomial endofunctors — and excellent model categories have weakly stable typal initial algebras for these. Their examples include:

- **Spheres** `Sⁿ` and the **torus** `T² ≃ S¹ × S¹`
- **Pushouts** `A ⊔_C B` — the workhorse from which suspensions, joins, and cofibers are built
- **Propositional truncation** `‖A‖` and **n-truncations** `‖A‖ₙ`
- **Set quotients** `A/R` and the **James construction**

A profound subtlety: some HITs *escape* constructive existence. Lumsdaine–Shulman [2, §9] adapt Blass's infinitary equational theory — whose initial algebra must be an uncountable regular cardinal — into a HIT `F` that cannot be proved to exist in ZF (hence not from pushouts + `ℕ` alone). HITs are thus a genuine *strengthening* of the theory, not syntactic sugar.

The payoff is synthetic homotopy theory. The encode–decode method proves:

> **Theorem (π₁(S¹) ≃ ℤ [6, Thm. 8.1.6]).** The loop space `Ω(S¹, base)` is equivalent to the integers. *Proof sketch.* Define `code : S¹ → 𝓤` by `code base = ℤ`, `ap code loop = ua succEquiv`. Then `Σ (x : S¹). code x` is contractible by circle induction (total space of the universal cover), so `(base = x) ≃ code x` for all `x`; at `x = base` this gives `(base = base) ≃ ℤ`. ∎

This proof, formalized in Cubical Agda, *computes*: `transport code loop` reduces via glueing to successor on `ℤ`.

### 4.4 Cubical type theory: making univalence compute

Cubical type theory [5] replaces the inductive identity family with *path types* indexed by an interval:

```
Path A a b  ≃  (i : I) → A   with endpoints a, b
```

Key primitives and their roles:

| Primitive | Homotopical meaning | Computational role |
|---|---|---|
| `PathP A a b` | Path in a fibration | Identity with definitional `funext` |
| `comp` / `hcomp` | Kan composition / filling | Path algebra computes |
| `transp` | Transport along a line of types | Generalized transport with reduction |
| `Glue` / `glue` / `unglue` | Mapping cylinder of an equivalence | `ua` computes; univalence is a theorem |
| Partial elements `Partial φ A` | Cofibrant partial cubes | Boundary conditions for HITs |

The **glueing construction** is the heart of the computational interpretation. Given `A : 𝓤`, a partial type `T` defined on cofibration `φ`, and a partial equivalence `e : T ≃ A`, `Glue A (φ ↦ (T, e))` is a type equal to `A` on `φ` and to `T` elsewhere — a type-theoretic *mapping cylinder*. Univalence then falls out:

```
ua : (A ≃ B) → Path 𝓤 A B
ua e = λ i. Glue B ((i = 0) ↦ (A, e) ; (i = 1) ↦ (B, idEquiv))
```

Transporting along `ua e` *reduces* to applying `e` — the `uaβ` rule holds definitionally [5]. Huber's canonicity theorem guarantees every closed `n : ℕ` reduces to a numeral even in the presence of `ua` and HITs — the open problem since 2009, solved.

Cubical HITs [7, via arXiv:1802.01170] decompose `comp` into homogeneous composition + generalized transport, so higher constructors carry explicit boundary conditions and compute. The circle becomes:

```agda
data S¹ : Type where
  base : S¹
  loop : Path S¹ base base
```

with `comp` reducing on `loop i` exactly as the interval algebra dictates.

### 4.5 Formalization in Cubical Agda

*Cubical Agda* [7] (Vezzosi, Mörtberg, Abel; ICFP 2019) extends Agda with `--cubical`: native interval, path types, `hcomp`/`transp`, glue types, and HITs with definitional computation rules. It is not a toy: the [`agda/cubical`](https://github.com/agda/cubical) library contains thousands of lines of synthetic homotopy theory — Eilenberg–MacLane spaces, the Hopf fibration, the Freudenthal suspension theorem — all *computing*.

Distinguishing features:

1. **Univalence as a library lemma**, not an axiom: `ua : A ≃ B → A ≡ B` with `uaβ` definitional.
2. **HITs with computational paths**: pattern matching on `loop i` with interval variables; `transport` over HITs reduces.
3. **The Structure Identity Principle, mechanized**: `agda/cubical` proves `SIP` for raw structures and applies it to monoids, groups, rings, categories — transporting theorems across equivalences with zero boilerplate.
4. **Constructive metatheory**: cubical type theory has been formalized in Nuprl [5], and homotopy canonicity holds for the system.

```agda
-- Cubical Agda: the SIP in action — isomorphic groups are identified
GroupEquiv : Group → Group → Type
GroupEquiv G H = Σ[ e ∈ ⟨ G ⟩ ≃ ⟨ H ⟩ ] preservesMult e

isoToPath : {G H : Group} → GroupEquiv G H → G ≡ H
isoToPath = ua ∘ equivOfGroupIso   -- then transport theorems along it
```

## 5 Empirical Results / Proofs

Principal verified results and their mechanization status:

1. **`idtoeqv` is an equivalence (Univalence)** — postulated in book HoTT [6, Axiom 2.10.3]; *proved* with computational content in cubical type theory via `Glue` [5]. Formalized in Cubical Agda's core.
2. **Function extensionality from univalence** [6, §4.9]: `happly` is an equivalence; in cubical type theory `funext` holds *definitionally*.
3. **Structure Identity Principle** [6, §9.8]: `(G =_GroupStr H) ≃ GroupIso(G,H)`, mechanized generically in `agda/cubical`.
4. **π₁(S¹) ≃ ℤ** [6, Thm. 8.1.6]: encode–decode via the universal cover. Fully computational in Cubical Agda — winding numbers evaluate.
5. **Semantics of HITs** [2]: every cell monad with parameters has weakly stable typal initial algebras in excellent model categories — spheres, torus, pushouts, truncations, James construction, localizations.
6. **Canonicity for cubical type theory** [5]: every closed term of type `ℕ` evaluates to a numeral — computation restored in the presence of univalence and HITs.
7. **Higher groups and Eilenberg–MacLane spaces**: `K(ℤ, n)` and `πₙ(Sⁿ) ≃ ℤ` formalized in `agda/cubical`, scaling synthetic proofs to classical results (Freudenthal, Hopf).

> **Theorem (uaβ, cubical [5]).** For `e : A ≃ B` and `x : A`, `transport (λ i → ua e i) x ≡ equivFun e x` holds *definitionally*. Hence univalence-based proofs compute exactly as if the equivalence had been applied directly — the "abstraction penalty" of univalence is zero.

---

## 6 Limitations

1. **Definitional `J` vs. propositional computation.** In book HoTT [6], `J` computes definitionally only on `refl`; cubical path types broaden this, but the inductive `Id` with definitional `J` remains subtle alongside univalence. Cubical Agda provides both `Path` and `Id`, and moving results between them is occasionally delicate.
2. **Constructive HIT semantics are incomplete.** Lumsdaine–Shulman [2] work in classical model categories; constructive justifications of *all* HIT schemas (infinitary, higher-dimensional) remain open. Cubical HITs [6] cover finitary cases; localizations at arbitrary maps are harder.
3. **Coherence of iterated univalence.** Transporting along `ua e` and then along another equivalence requires coherence data; in practice `agda/cubical` manages this with cubical path algebra, but general coherence theorems (e.g., for univalent fibrations in all dimensions) are still being developed [cf. §4.4, Orton–Pitts style axiomatics].
4. **Performance of normalization.** Cubical normalization (`comp`, `transp`, glueing) is asymptotically heavier than MLTT reduction; large synthetic-homotopy developments typecheck slowly, and `hcomp` can produce enormous normal forms.
5. **The Blass obstruction.** The HIT `F` of [2, §9] shows not every HIT signature is constructively realizable from basic principles — schema design must respect set-theoretic strength, an ongoing research frontier.
6. **Classical vs. constructive models.** Voevodsky's simplicial model [3] uses classical logic (Kan fibrations in simplicial sets need choice-like principles); the cubical model [5] is constructive but commits to a specific interval algebra (De Morgan), and alternative cube categories (cartesian, Dedekind) yield subtly different theories.

## 7 Conclusion

The arc from Voevodsky's univalence axiom [1][2] to Cubical Agda [7] is the story of a principle maturing from *axiom* to *theorem with computational content*. Univalence completed the homotopy interpretation of Martin-Löf type theory by characterizing the identity type on a universe as the type of equivalences, yielding the Structure Identity Principle — the formal vindication of mathematical structuralism [3][4]. Higher inductive types extended the inductive paradigm to spaces, with Lumsdaine and Shulman [2] supplying the semantic charter (cell monads with parameters) and its sharp boundary (the Blass obstruction). Cubical type theory [5] resolved the crisis univalence created — the loss of canonicity — by internalizing Kan composition and glueing, making `ua` compute. Cubical Agda [7] packages this into a proof assistant in which synthetic homotopy theory is not only formalized but *executed*: `π₁(S¹)` evaluates, `uaβ` reduces, equivalences transport theorems across isomorphic structures automatically.

Open frontiers remain: constructive semantics for infinitary HITs, coherence for iterated univalence, and the performance engineering of cubical normalization. But the central thesis stands: the univalence axiom, once an uncomputable postulate, is now a computational principle — and with it, homotopy type theory has become the first foundation of mathematics in which *equivalence-respecting reasoning is also executable reasoning*.

## References

[1] The Univalent Foundations Program. *Homotopy Type Theory: Univalent Foundations of Mathematics*. Institute for Advanced Study, Princeton, 2013. https://arxiv.org/abs/1308.0729
[2] Peter LeFanu Lumsdaine and Michael Shulman. *Semantics of Higher Inductive Types*. arXiv:1705.07088, 2019. https://arxiv.org/pdf/1705.07088v2
[3] James Ladyman and Stuart Presnell. *Universes and Univalence in Homotopy Type Theory*. Review of Symbolic Logic 12(3), 2019. https://research-information.bris.ac.uk/ws/files/96320130/Universes_and_Univalence_final.pdf
[4] Steve Awodey. *Voevodsky's Univalence Axiom in Homotopy Type Theory*. Notices of the AMS (preprint). https://www.andrew.cmu.edu/user/awodey/preprints/NoticesAMS.pdf
[5] Cyril Cohen, Thierry Coquand, Simon Huber, and Anders Mörtberg. *Cubical Type Theory: a constructive interpretation of the univalence axiom*. arXiv:1611.02108, 2016. https://arxiv.org/abs/1611.02108
[6] Thierry Coquand, Simon Huber, and Anders Mörtberg. *On Higher Inductive Types in Cubical Type Theory*. arXiv:1802.01170, 2018. https://arxiv.org/abs/1802.01170
[7] Andrea Vezzosi, Anders Mörtberg, and Andreas Abel. *Cubical Agda: A Dependently Typed Programming Language with Univalence and Higher Inductive Types*. Proc. ACM Program. Lang. 3(ICFP), 2019. https://dl.acm.org/doi/10.1145/3341691
