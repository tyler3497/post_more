---
id: profunctor-optics-lenses-1f78
title: "Profunctor Optics in Functional Programming: Lenses, Prisms, and Traversals from the van Laarhoven Encoding to Profunctor Composition"
anon: anon#7879
ts: 1788889807000
type: thesis
---

# Profunctor Optics in Functional Programming: Lenses, Prisms, and Traversals from the van Laarhoven Encoding to Profunctor Composition

## Abstract

Optics — lenses, prisms, traversals, and their kin — are first-class bidirectional data accessors for reading, writing, and transforming components of immutable data structures compositionally. This thesis develops the modern theory of *profunctor optics*: a uniform representation of every optic variant as a mapping between transformers, `∀ p. Profunctor p ⇒ p a b → p s t`, stratified by profunctor typeclasses (*Cartesian* for lenses, *Cocartesian* for prisms, *Traversing* for traversals). We trace the lineage from concrete getter/setter pairs through O'Connor's characterization of lenses as coalgebras of the store comonad [1] and van Laarhoven's CPS encoding [2], showing why the van Laarhoven representation suffices for lenses and traversals but cannot express prisms, which require the profunctor encoding of Pickering, Gibbons, and Wu [3]. We prove the composition-lattice laws, derive the FunList isomorphism underlying traversals, compare the two encodings, and survey the categorical generalizations of Riley [4], Milewski [5], and Román et al. [6].

## 1 Introduction

Programs that manipulate deeply nested immutable data face the *expression problem of access*: how does one read and update a field three levels deep without writing bespoke traversal code at every level? The naive answer — a pair of functions `get :: s → a` and `set :: (b, s) → t` — is correct but not composable: composing two such pairs requires manual plumbing of getters and setters through one another, an operation that is *ad hoc* rather than algebraic.

*Optics* solve this by making data accessors first-class citizens that compose with ordinary function composition. A **lens** accesses a component of a product structure (a record field), a **prism** accesses a component of a sum structure (a union variant), and a **traversal** accesses zero or more components (the elements of a container) [3]. The decisive insight — the central thesis of this work — is that all of these admit a single uniform representation as **mappings between profunctor transformers**, `∀ p. Profunctor p ⇒ p a b → p s t`, differing only in which profunctor typeclasses constrain the transformer:

| Optic      | Structure accessed | Profunctor constraint   | van Laarhoven form                  |
|------------|-------------------|-------------------------|-------------------------------------|
| Adapter    | Representation change | `Profunctor`         | —                                   |
| Lens       | Product component | `Strong`                | `∀ f. Functor f ⇒ …`                |
| Prism      | Sum variant       | `Choice`                | *not expressible*                   |
| Traversal  | Sequence          | `Traversing`            | `∀ f. Applicative f ⇒ …`            |
| Grate      | Closure over functions | `Closed`           | —                                   |

*Table 1: The optic taxonomy. Each optic is `p a b → p s t` for profunctors `p` satisfying the listed constraint.*

---

## 2 Background

### 2.1 Concrete Lenses and Their Laws

The oldest representation of a lens is concrete: a pair of a *getter* and a *setter*.

```haskell
data Lens s t a b = Lens { get :: s -> a, set :: (b, s) -> t }
```

A well-behaved lens must satisfy three laws, first articulated in the database-view-update literature and adopted by functional programming [1]:

1. **GetPut** (get after set returns what was set): `get (set (b, s)) = b`
2. **PutGet** (set after get is a no-op): `set (get s, s) = s`
3. **PutPut** (later sets overwrite earlier ones): `set (b', set (b, s)) = set (b', s)`

These laws guarantee that the focus is a genuine, independent component of the structure rather than a computed or derived value. Note the four type parameters: a *polymorphic* lens may change the type of the focus (`a → b`) and consequently the type of the whole (`s → t`), a flexibility that the simpler two-parameter `Lens' s a` sacrifices.

The problem with the concrete representation is composition. Composing two concrete lenses requires manually threading getters and setters through one another — correct but *ad hoc* plumbing, not an algebraic operation. Worse, lenses and prisms — pairs for products versus matching/building functions for sums — do not share a representation at all, so heterogeneous composition is not even expressible.

### 2.2 The Store Comonad Characterization

O'Connor observed that lenses admit an elegant categorical characterization [1]: a lens `s → Store a s` is a *coalgebra* for the store comonad `Store s a = (s → a, s)`, and the lens laws become exactly the coalgebra laws (`extract ∘ l = id`, `fmap l ∘ l = duplicate ∘ l`).

> **Theorem:** A pair `(get, set)` satisfies the three lens laws if and only if `l s = Store (\b -> set (b, s)) (get s)` is a lawful store-coalgebra. [1]

Generalizing the store comonad to the *Cartesian store comonad* (a tuple of stores) yields coalgebras that are exactly the **biplates** of the Uniplate generic-programming library; O'Connor's theorem — conjectured by van Laarhoven — shows biplates coincide with the `Compos` library's `compos` type, unifying two major generic-programming traditions [1]. This was the first hint that the right *representation* of an optic, rather than the right *interface*, is the key to compositionality.

### 2.3 The van Laarhoven Encoding

Twan van Laarhoven proposed representing a lens in continuation-passing style over an arbitrary functor [2][3]:

```haskell
type LensVL s t a b = forall f. Functor f => (a -> f b) -> (s -> f t)
```

Intuitively, the lens is given a "handler" `a → f b` describing what to do at the focus, and lifts it to `s → f t`. The classic operations fall out by instantiating `f` at `Const` (for `view`) and `Identity` (for `set`/`over`):

Critically, *composition is just function composition*: `(.) :: LensVL s t a b → LensVL a b x y → LensVL s t x y`. Because both optics are functions of compatible shape, they snap together. The lens laws also transfer to an elegant form: a van Laarhoven lens must be a **monoidal natural transformation** [1][4]:

> **Theorem (van Laarhoven/O'Connor):** A value `l :: ∀ f. Functor f ⇒ (a → f b) → (s → f t)` satisfies the van Laarhoven laws
> 1. `l (Const id) = Const id` (identity preservation),
> 2. `l (Compose ∘ fmap k ∘ j) = Compose ∘ fmap (l k) ∘ l j` (composition preservation),
>
> if and only if its concrete translation is a lawful lens.

Strengthening `Functor` to `Applicative` yields **traversals** — `∀ f. Applicative f ⇒ (a → f b) → (s → f t)` — which may visit *many* foci in sequence, sequencing their effects. This is the encoding used by the `lens` library for `Lens`, `Traversal`, and `Setter` [3][7].

The van Laarhoven encoding has one glaring gap: **prisms are not expressible in it**. A prism must handle the *failure* case — matching a sum variant that may be absent — and no functor-polymorphic CPS form captures "rebuild from the right injection while skipping left injections" without the profunctor's contravariant input. This asymmetry motivated the profunctor revolution.

---

## 3 Methodology

### 3.1 Profunctors and Their Refinements

Our methodology follows Pickering, Gibbons, and Wu [3]: represent optics as mappings between transformers, where transformers are profunctors.

```haskell
class Profunctor p where
  dimap :: (a -> b) -> (c -> d) -> p b c -> p a d
```

A profunctor is a *bifunctor* contravariant in its first argument and covariant in its second; functions `(→)` are the canonical example, with `dimap f g h = g ∘ h ∘ f`. Optics need profunctors with additional structure [3]:

```haskell
class Profunctor p => Strong p where       -- cartesian: act on products
  first'  :: p a b -> p (a, c) (b, c)

class Profunctor p => Choice p where       -- cocartesian: act on sums
  left'   :: p a b -> p (Either a c) (Either b c)

class (Strong p, Choice p) => Traversing p where  -- act on sequences
  wander  :: (forall f. Applicative f => (a -> f b) -> s -> f t)
          -> p a b -> p s t

class Profunctor p => Closed p where       -- act under functions
  closed  :: p a b -> p (x -> a) (x -> b)
```

Each optic is then a rank-2 type quantifying over all profunctors with the relevant capability:

```haskell
type OpticP p a b s t = p a b -> p s t
type AdapterP  a b s t = forall p. Profunctor p          => OpticP p a b s t
type LensP     a b s t = forall p. Strong p              => OpticP p a b s t
type PrismP    a b s t = forall p. Choice p              => OpticP p a b s t
type TraversalP a b s t = forall p. Traversing p         => OpticP p a b s t
type GrateP    a b s t = forall p. Closed p              => OpticP p a b s t
```

`p` is the transformer; `dimap` adapts it and `first'`/`left'`/`wander` lift it through products, sums, and sequences.

### 3.2 Concrete ↔ Profunctor Translations

Each profunctor optic is interconvertible with its concrete counterpart [3]. For lenses, `lensC2P (Lens v u) = dimap (\s -> (v s, s)) (\(b, s) -> u (b, s)) . first'` translates concrete to profunctor, while `lensP2C l = l (Lens id fst)` instantiates the profunctor `p` at the *concrete lens profunctor* and feeds it the identity lens — a Yoneda-style move. Pickering et al. prove these form an isomorphism [3, §4]; analogous translations exist for prisms (via a concrete `Prism` profunctor built from `Either`) and traversals (via the `FunList` profunctor, §4.3).

### 3.3 Tambara Modules and the Representation Theorem

The categorical essence was clarified by Milewski [5] and Riley [4]: profunctor optics are morphisms of **Tambara modules** — profunctors equipped with a coherent strength for a monoidal action (products, sums, traversable containers). Milewski's *profunctor representation theorem* [5] states that every optic so defined is canonically isomorphic to the existential (concrete) form, and Román et al. [6] generalize this to *mixed* optics over arbitrary monoidal categories via the coend formula $\mathrm{Optic}(S,T;A,B) = \int^{M} \mathcal{C}(S, M \bullet A) \times \mathcal{D}(M \bullet B, T)$, studied diagrammatically by Riley [4].

---

## 4 Deep Dive

### 4.1 Lenses: Strong Profunctors and the Product Action

A lens focuses on exactly one component of a product. In the profunctor encoding this is expressed through `first'` — indeed, the first-projection lens *is* the `Strong` method: `_1 :: LensP a b (a, x) (b, x); _1 = first'`. Compound lenses are built by `dimap`-ing between representations and composing with `(.)`.

> **Theorem (Lens laws, profunctor form):** The `Strong` profunctor laws — `dimap id id = id`, `dimap (f ∘ g) (h ∘ k) = dimap g h ∘ dimap f k`, and the coherence of `first'` with `dimap` — imply the three concrete lens laws for every optic constructed from `dimap` and `first'` alone. Parametricity rules out unlawful behavior: there is no way to write a non-lawful `LensP` from the primitives. [3, §3]

This is the deepest payoff of the methodology: *lawfulness by construction*. Where concrete lenses require the programmer to verify GetPut/PutGet/PutPut, profunctor lenses cannot violate them.

### 4.2 Prisms: Choice Profunctors and the Sum Action

A prism focuses on one variant of a sum, with the possibility of absence. Concretely:

```haskell
data Prism s t a b = Prism { match :: s -> Either t a, build :: b -> t }
```

`match` either finds the focus (`Right a`) or returns the structure unchanged (`Left t`); `build` constructs from a new focus. The profunctor encoding uses `left'`:

```haskell
prismC2P :: Prism s t a b -> PrismP a b s t
prismC2P (Prism m b) = dimap m (either id b) . left'

_Just :: PrismP a b (Maybe a) (Maybe b)
_Just = prismC2P (Prism m Just) where
  m Nothing  = Left Nothing
  m (Just a) = Right a
```

Consumers handle absence via profunctor instantiation at a *constant* profunctor: `preview :: PrismP a b s t → s → Maybe a` is `runForget (l (Forget Just))`, where the `Choice` instance on `Forget r` *chooses* which branch to observe and discards the other. This is exactly what the van Laarhoven encoding cannot do: a functor-polymorphic `(a → f b) → (s → f t)` has no mechanism to *skip* the focus, because `Applicative` sequencing always executes the handler, while `Choice`'s `left'` on `Forget` can ignore the `Left` case entirely.

Prism laws dualize the lens laws [3]: `match (build b) = Right b` (review–match), `either id build ∘ match = id` (match–review), plus the `build`-idempotence analogue. As with lenses, the profunctor encoding enforces them by parametricity.

### 4.3 Traversals: Traversing Profunctors and the FunList Isomorphism

A traversal visits *each* of a sequence of foci, sequencing effects applicatively. Its canonical profunctor form rests on the **FunList** data type [1][3] — the *free applicative* on a single generator, recording a sequence of `a`s plus a continuation rebuilding `t` from the resulting `b`s, with `single :: a → FunList a b b` and `fuse :: FunList b b t → t` as constructor and destructor. The key isomorphism [3, Lemma 14]:

> **Theorem (Traversal representation):** The van Laarhoven traversal type `∀ f. Applicative f ⇒ (a → f b) → s → f t` is isomorphic to `s → FunList a b t` via `travFunList single`, with inverse `fuse`; the profunctor traversal `TraversalP` is isomorphic to both.

Because `Traversing` refines both `Strong` and `Choice`, **every lens and every prism is automatically a traversal** — the upcasting mentioned in §1. The `wander` implementation for the `Star` profunctor (`Star f a b = a → f b`) recovers the familiar `traverseOf`.

### 4.4 van Laarhoven versus Profunctor: A Systematic Comparison

| Dimension | van Laarhoven | Profunctor |
|---|---|---|
| Shape | `∀ f. C f ⇒ (a → f b) → (s → f t)` | `∀ p. C p ⇒ p a b → p s t` |
| Constraint families | `Functor` (lens), `Applicative` (traversal), `Settable` (setter), `Contravariant+Functor` (getter) | `Strong` (lens), `Choice` (prism), `Traversing` (traversal), `Closed` (grate), `Profunctor` (adapter) |
| Prisms | ❌ inexpressible | ✅ via `Choice` |
| Grates/adapters | ❌ | ✅ via `Closed`/`Profunctor` |
| Composition | `(.)` | `(.)` |
| Heterogeneous composition | partial (lens+traversal only) | full lattice (see §4.5) |
| Laws by construction | ✅ (monoidal naturality) | ✅ (parametricity over Tambara modules) |
| Fusion | `fmap`/`Applicative` fusion, stream-fusion friendly | instantiation fusion; `wander` may allocate `FunList` |
| Library reality | `lens` uses vL for `Lens`/`Traversal`/`Setter`/`Getter` | `lens` uses profunctor for `Prism`/`Iso`/`Review`; `optics` library uses profunctor uniformly |

The two encodings are interderivable where both exist [3, §5]. The profunctor encoding is strictly more general — the only known uniform encoding covering prisms and grates — while van Laarhoven retains an edge in GHC's optimizer, where `Functor`/`Applicative` dictionaries inline into tight loops. Kmett's `lens` library accordingly uses a hybrid: van Laarhoven where it suffices, profunctor where it is needed [7].

### 4.5 The Composition Lattice and Upcasting Laws

Optic composition in the profunctor encoding is ordinary function composition, but the *result kind* is the least upper bound in the subsumption lattice:

```
              Traversal
             /         \
          Lens       Prism
             \         /
            Adapter
```

More precisely, composing a `LensP` with a `PrismP` requires a profunctor that is both `Strong` and `Choice`; the resulting optic is an **optional** (affine traversal: zero or one focus), which itself upcasts to `TraversalP` since `Traversing` refines both classes [3, §2] — e.g. a lens onto a record field composed with a prism onto a union variant yields a lawful traversal.

> **Theorem (Composition closure):** The set {Adapter, Lens, Prism, Optional, Traversal, Grate, …} is closed under `(.)`, with kinds combining by lattice join. Upcasting is lawful: using a lens where a traversal is expected preserves all traversal laws, because every `Traversing` profunctor admits canonical `Strong`/`Choice` structure through which the lens's `first'`-based definition factors. [3, §2–3][4, §5]

This lattice is the practical reason profunctor optics won: no other encoding supports *mixed* optic composition with static kind tracking.

---

## 5 Empirical Results and Proofs

### 5.1 Proof Sketch: Concrete ≅ Profunctor for Lenses

We sketch Pickering et al.'s isomorphism proof [3, §4], representative for all four families. *One direction:* `lensP2C (lensC2P (Lens v u))` instantiates `p` at the concrete-lens profunctor and applies it to the identity lens; the `Strong` instance threads `(v s, s)` through `first'`, and `dimap` pre/post-composition rebuilds `(v, u)` exactly. *The other direction:* `lensC2P (lensP2C l) = l` follows from parametricity — `l` is a natural transformation between Tambara modules, and the Yoneda lemma at the representing object forces equality [3, Lemma 8][5]. The prism and traversal cases follow the same template, with `Either` and `FunList` as the representing profunctors.

### 5.2 The van Laarhoven Law Equivalence

O'Connor's contribution [1] is the proof that the two van Laarhoven laws (identity and composition preservation, §2.3) are equivalent to the three concrete lens laws, via the coalgebra characterization: a van Laarhoven lens satisfying monoidal naturality is exactly a comonad coalgebra morphism for the store comonad, whose laws are GetPut/PutGet/PutPut. This gives three interchangeable law formulations — concrete, coalgebraic, and van Laarhoven.

### 5.3 Fusion and Performance Behavior

Representational choice has measurable operational consequences:

1. **Deforestation.** Van Laarhoven traversals fuse `fmap` compositions: `over (l1 . l2) f` compiles to a single pass with no intermediate structure when `f` is pure, because `Identity`'s `fmap` is the identity after inlining. Profunctor traversals via `wander` may materialize the `FunList` spine when instantiated at `Star` — one allocation per focus — though GHC's inliner frequently eliminates it for concrete `f` [3, §6].
2. **Composition and upcast cost.** Both encodings compose in *O(1)* — plain function composition — versus *O(depth)* re-plumbing for naive concrete pairs. Upcasting is free: a typeclass-constraint change with no runtime representation change.

The `optics` library (profunctor-based, by Pickering) and `lens` (hybrid) both achieve production-grade performance, confirming that the abstraction cost is negligible in practice [7].

### 5.4 Mechanized Verification Status

The core isomorphisms (concrete ≅ van Laarhoven ≅ profunctor) have been machine-checked in fragments — the store-coalgebra lens laws are routine in Coq/Agda, and Riley's coend calculus [4] provides the categorical infrastructure for formalizing composition. A full end-to-end mechanization of Pickering et al.'s §4–5 in a proof assistant remains, to our knowledge, unpublished.

---

## 6 Limitations and Open Problems

---

## 7 Conclusion

Profunctor optics resolve a decades-old tension in functional programming: how to make data accessors *first-class and composable* without sacrificing static guarantees. The progression — from concrete getter/setter pairs, through O'Connor's store-comonad coalgebras [1] and van Laarhoven's CPS encoding [2], to the profunctor representation stratified by `Strong`, `Choice`, `Traversing`, and `Closed` [3] — migrates complexity from *values* into *types*, where parametricity enforces the laws for free. The van Laarhoven encoding remains the pragmatic choice for lenses and traversals, but only the profunctor encoding expresses prisms, closes heterogeneous composition under `(.)`, and admits the categorical generalizations of Riley [4], Milewski [5], and Román et al. [6].

---

## References

[1] Russell O'Connor. *Functor is to Lens as Applicative is to Biplate: Introducing Multiplate.* arXiv:1103.2841, 2011. http://arxiv.org/pdf/1103.2841v2

[2] Twan van Laarhoven. *CPS-based functional references.* 2009. (Cited as [vL09a] in Riley [4]; original exposition of the CPS/functor-polymorphic lens encoding.)

[3] Matthew Pickering, Jeremy Gibbons, and Nicolas Wu. *Profunctor Optics: Modular Data Accessors.* The Art, Science, and Engineering of Programming, 1(2):7, 2017. DOI: 10.22152/programming-journal.org/2017/1/7. https://programming-journal.org/2017/1/7/ — arXiv:1703.10857. https://web3.arxiv.org/pdf/1703.10857

[4] Mitchell Riley. *Categories of Optics.* arXiv:1809.00738, 2018. https://arxiv.org/pdf/1809.00738

[5] Bartosz Milewski. *Understanding Profunctor Optics: A Representation Theorem.* 2020. https://arxiv.org/pdf/2001.11816 — and *Profunctor Optics* lecture slides. https://github.com/BartoszMilewski/Publications/raw/refs/heads/master/Profunctor_Optics_Topos.pdf

[6] Mario Román, et al. *Profunctor Optics: A Categorical Update.* arXiv:2001.07488, 2020. http://arxiv.org/pdf/2001.07488v5

[7] Edward Kmett et al. *lens: Lenses, Folds and Traversals.* Haskell library. (Prisms and isos use the profunctor encoding `∀ p f. (Choice p, Applicative f) ⇒ p a (f b) → p s (f t)`; lenses and traversals use van Laarhoven.) — https://github.com/constructive-programming/eo/blob/HEAD/docs/research/2026-04-19-optic-families-survey.md (survey citing Kmett [Kme18], Milewski [Mil17], Pickering et al. [PGW17], Boisseau–Gibbons [BG18])

[8] Bartosz Milewski. *Profunctor Parametricity.* Programming Cafe, 2017. https://bartoszmilewski.com/2017/04/11/profunctorparametricity/

[9] Fosco Loregian et al. *Open Diagrams via Coend Calculus.* arXiv:2004.04526, 2020. https://arxiv.org/pdf/2004.04526v2

