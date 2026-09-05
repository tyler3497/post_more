---
{
 "id": "ths_1788600527773_cd1a",
 "title": "Transient Semantics and the Blame Calculus for Gradual Typing: Guarded versus Monotonic References, the Gradual Guarantee, and Space-Efficient Coercions",
 "anon": "anon#1649",
 "ts": 1788600527773,
 "type": "thesis",
 "images": [
  "ths_1788600527773_cd1a-0.webp",
  "ths_1788600527773_cd1a-1.webp",
  "ths_1788600527773_cd1a-2.webp",
  "ths_1788600527773_cd1a-3.webp"
 ]
}
---

# Transient Semantics and the Blame Calculus for Gradual Typing: Guarded versus Monotonic References, the Gradual Guarantee, and Space-Efficient Coercions

## Abstract

Gradual typing promises seamless interoperability between statically and dynamically typed program fragments, yet the *runtime semantics* of the boundary between them remains one of the most contested design spaces in programming languages research. This thesis compares the three principal enforcement strategies — **guarded** (proxy-based), **transient** (use-site check insertion), and **monotonic** (runtime-type-information-carrying references) semantics — grounded in the **blame calculus** of Wadler and Findler [2], the **gradual guarantee** of Siek et al. [4], and the **space-efficient coercions** of Herman et al. as refined by Siek and Wadler's threesomes [3]. We reconstruct the blame-safety theorem, locate precisely where each reference discipline allocates blame on cast failure, show how naive casts break tail-call behavior and how coercion composition restores constant-space guarantees, and review the empirical performance-lattice methodology of Takikawa et al. [7][8]. No single semantics dominates: guarded proxies preserve the guarantee at the cost of object identity, transient checks recover identity at the cost of blame precision, and monotonic references recover both at the cost of pervasive runtime type information.

---

## 1. Introduction

The integration of static and dynamic typing within a single language — *gradual typing* — was given its first systematic formulation by Siek and Taha [1], who introduced the unknown type `?` (also written `★` or `Dyn`) and replaced type *equality* with type *consistency*: a symmetric, reflexive, but deliberately non-transitive relation in which `?` is consistent with every type. A term such as `λx:?. x + 1` type-checks because `? ~ Int` at the use site of `+`, and the elaborator inserts a runtime cast wherever consistency, rather than equality, justifies a typing rule. The static semantics is only half the story. The dynamic semantics — *what those casts do when they execute* — determines soundness, asymptotic space behavior, blame precision, and whether programmers can trust the system at scale [4][10].

Three enforcement strategies have emerged, each answering a different question about where runtime checking should live: **guarded** semantics installs *proxies* (higher-order contracts) at cast boundaries that transitively enforce target types [5][6]; **transient** semantics inserts *shallow checks at use sites* and never wraps values [5][6]; and **monotonic** semantics attaches *runtime type information* (RTTI) to heap cells, refining cell types monotonically toward the greatest lower bound of all ascribed types [10].

Orthogonal to enforcement strategy is *blame*: when a cast fails, which component is at fault? Findler and Felleisen's contracts [2] introduced blame labels distinguishing the *positive* party (the term) from the *negative* party (its context); Wadler and Findler's **blame calculus** λB [2] imported this machinery into gradual typing and proved **blame safety** — *well-typed programs can't be blamed*: when a cast between a less-precise and a more-precise type fails, blame always falls on the less-precisely-typed side.

Two further constraints shape the design space. First, the **gradual guarantee** [4]: making annotations *more precise* must not change behavior except by turning silent successes into loud cast errors — the property that makes incremental migration predictable. Second, **space efficiency**: naive casts accumulate wrappers at each recursive call, degrading tail calls into non-tail calls and inflating space from constant to linear in call depth [3][9]; Herman et al.'s coercion calculus and Siek and Wadler's *threesome* factorization [3] compress arbitrary cast chains into constant space.

This thesis unifies these threads: (i) a side-by-side reconstruction of guarded, transient, and monotonic reference semantics in a common cast-calculus framework; (ii) a precise account of how blame labels propagate — and where blame precision is lost — under each strategy; (iii) the gradual guarantee and its interaction with heap-allocated RTTI; (iv) space-efficient coercions via threesome factorization; and (v) a critical review of the empirical performance methodology that revealed sound gradual typing's performance crisis [8].

---

## 2. Background

### 2.1 Gradual types, consistency, and precision

The gradually typed lambda calculus (GTLC) of Siek and Taha [1] extends the simply typed lambda calculus with the unknown type `?`. The *consistency* relation `~` makes `?` consistent with every type; base types are consistent only with themselves. Crucially, consistency is **not transitive** — a fact that rules out the naive "dynamic is both top and bottom" designs of earlier work [10].

*Precision*, written `⊑`, orders types by information content with `?` the least element, and lifts to terms: `e ⊑ e′` when `e′` replaces some annotations of `e` with more precise ones. Migration — the raison d'être of gradual typing — is the search for `e′` with `e ⊑ e′` that type-checks. Siek et al. [4] elevated this into the **gradual guarantee**:

> **Theorem (Gradual Guarantee, static part [4]):** If `⊢ e : T` and `e ⊑ e′`, then `⊢ e′ : T′` for some `T′` with `T ⊑ T′`. Adding precision never breaks typeability.
>
> **Theorem (Gradual Guarantee, dynamic part [4]):** If `e ⊑ e′` and `e ⟶* v`, then either `e′ ⟶* v′` with `v ⊑ v′`, or `e′ ⟶* blame`, or `e′` diverges. Adding precision can only *reveal* errors, never change successful outcomes.

The dynamic part is the subtle one: it must hold *despite* the new runtime casts that elaboration of the more precise program inserts.

### 2.2 The blame calculus

Wadler and Findler [2] observed that the cast-insertion translations of Siek and Taha [1] discarded *blame* — the contract system's answer to "who is at fault?" Their **blame calculus** makes casts explicit as `⟨T₁ ⇒^ℓ T₂⟩ e`, labeled with blame label `ℓ`. Reduction decomposes higher-order casts *contravariantly*, negating the label on the argument position:

```haskell
-- Cast reduction in the blame calculus (λB), call-by-value
⟨? ⇒^ℓ Int⟩ n            ⟶  n              -- n an integer literal
⟨? ⇒^ℓ Int⟩ b            ⟶  blame^ℓ        -- b not an integer: positive blame
⟨(T₁→T₂) ⇒^ℓ (S₁→S₂)⟩ v  ⟶  λx. ⟨T₂ ⇒^ℓ S₂⟩ (v (⟨S₁ ⇒^ℓ̄ T₁⟩ x))
```

The label `ℓ` denotes the *positive* party (the term under cast); `ℓ̄` denotes the *negative* party (its context). To avoid infinite decomposition through `?`, casts factor through *ground types* `G ::= Int | Bool | ? → ?` [2][3].

Blame safety rests on *blame subtyping*: decomposing naive subtyping into *positive* and *negative* subtyping such that a cast is *safe* exactly when the source is a positive subtype of the target. The payoff:

> **Theorem (Blame Safety [2]):** If `⟨S ⇒^ℓ T⟩` with `S ⊑ T` (less precise to more precise) reduces to blame, the blame is `blame^ℓ̄` — allocated to the *less precisely typed* side. *Well-typed programs can't be blamed.*

This generalizes the contract-correctness result of Tobin-Hochstadt and Felleisen: typed code is never at fault for boundary failures [2][9].

### 2.3 The space problem

Naive cast semantics wraps values, and wrappers *accumulate*. Herman et al. showed that the innocent-looking mutually recursive program below, tail-recursive in the source, runs in *linear* space after elaboration, because each recursive call stacks another cast [3][9]:

```python
# Source (gradual): tail-recursive, constant-space intent
def even(n: int) -> ?: return True if n == 0 else odd(n - 1)
def odd(n: int) -> bool: return False if n == 0 else even(n - 1)
# Elaborated: casts accumulate in tail position
# even(n) = if n==0 then ⟨? ⇐ Bool⟩ True else ⟨? ⇐ Bool⟩ odd(n-1)
# odd(n)  = if n==0 then False else ⟨Bool ⇐ ?⟩ even(n-1)
```

Each call through the `?`-boundary adds a pending cast frame, so a tail call becomes a non-tail call and space grows with recursion depth. The fix is to compose casts *semantically* rather than *syntactically* — the subject of §4.5.

---

## 3. Methodology

Our method is *comparative formal reconstruction*: we place the three reference disciplines in a single cast-calculus framework [2] and evaluate each against four criteria — (C1) type soundness, (C2) the gradual guarantee [4], (C3) blame precision, and (C4) asymptotic space behavior of casts. We draw operational details from the primary sources — guarded and transient from [5][6], monotonic from [10][11], blame from [2], coercions from [3][9], and the empirical lens from [7][8] — restating the key theorems and marking which claims are proved, which are measured, and which remain conjectural.

---

## 4. Deep Dive

### 4.1 The blame calculus and the polarity of failure

The blame calculus earns its keep at *higher order*, where a single source-level cast unfolds into a tree of runtime checks. When typed `f : Int → Int` flows into untyped code via `⟨Int→Int ⇒^ℓ ?→?⟩`, reduction yields `λx. ⟨Int ⇒^ℓ ?⟩ (f (⟨? ⇒^ℓ̄ Int⟩ x))`: the argument cast carries the *negated* label `ℓ̄` because the argument is supplied by the context — the negative party. Applying `f` to `"boom"` reduces the inner cast to `blame^ℓ̄`, blaming the untyped caller exactly as blame safety demands [2]. The polarity discipline is compositional: casts the elaborator inserts from *more* precise to *less* precise types are *safe* (their positive label can never be blamed), and casts in the opposite direction blame only their negative label on failure. A blame error therefore names the *boundary* and the *side* responsible — a genuine debugging aid. Extending blame to *mutable references* is where the three semantics diverge, because a reference cell is both a value and a capability, and the two roles admit different checking strategies.

### 4.2 Guarded references: proxies, soundness, and the identity crisis

In **guarded** semantics, casting a reference installs a *proxy*: `⟨Ref T ⇒^ℓ Ref S⟩ r` allocates a reference-like object whose reads apply `⟨T ⇒^ℓ S⟩` and whose writes apply `⟨S ⇒^ℓ̄ T⟩`. Like function proxies, reference proxies enforce the target type *transitively*: even if the proxy escapes into untyped code that writes a string into what typed code believes is a `Ref Int`, the write is intercepted and raises `blame^ℓ̄` [5][6].

This transitivity buys full soundness and blame precision, but at two prices. First, **space**: proxies compose by stacking, reintroducing the §2.3 blowup unless coercion compression (§4.5) is applied. Second and more damaging in practice, **identity**: a proxy is *not* the object it guards. Vitousek et al. [5] and New et al. [6] document that Python's `is` operator, `type()` reflection, and `id()`-based memoization all observe the proxy rather than the underlying object — in Reticulated Python's evaluation, these discrepancies were judged a "significant problem," preventing many real programs from running correctly under guarded semantics [5][6].

```python
class Foo: bar = 42
def g(x): x.bar = 'hello'          # untyped mutator
def f(y: {'bar': int}):            # typed client
    g(y)                           # y is a proxy here, not the original
    return y.bar                   # write intercepted: blame, not silent corruption
f(Foo())
```

The example (adapted from [6]) shows guarded soundness working *as designed* — the illicit write is caught — but the proxying that catches it also means `y is not` the object `f` received and `type(y)` is a synthetic proxy class. Guarded semantics thus satisfies C1–C3 cleanly and C4 only with coercion compression, but fails a criterion the formal literature rarely states: *observational transparency* of the heap.

### 4.3 Transient semantics: checks at use sites, nothing wrapped

**Transient** semantics abandons proxies entirely: the elaborator inserts *shallow tag checks at every elimination form* in typed code — application, dereference, projection — and values flow across the boundary unwrapped [5][6].

The wins are identity preservation (nothing is ever wrapped, so `is` and `type()` behave exactly as in the untyped language) and per-operation constant space. The costs:

- **Delayed detection.** A mistyped value circulating *within* untyped code is never checked; the error surfaces only when the value re-enters typed code and is consumed. Soundness (C1) holds because no *typed* operation observes the ill-typed value, but the invariant "the heap is well-typed" is abandoned.
- **Coarse blame (C3).** Checks are shallow and local, so a transient failure identifies the *use site* but cannot reconstruct the flow that delivered the bad value — a strictly weaker diagnostic than the blame calculus provides, and an acknowledged open problem [6][10].
- **Check redundancy.** Every typed elimination pays for a check, including in fully-typed regions where static reasoning already guarantees safety.

Despite these costs, transient semantics satisfies the gradual guarantee [4] and has proven the most *deployable*: Reticulated Python's transient dialect runs real Python programs that guarded proxies break [5][6].

| Criterion | Guarded (proxies) | Transient (use-site checks) | Monotonic (RTTI refs) |
|---|---|---|---|
| Soundness (C1) | Full, transitive | Full, at use sites | Full, via cell RTTI |
| Gradual guarantee (C2) | Holds [4] | Holds [5] | Holds in the ESOP'15 calculus [10] |
| Blame precision (C3) | Fine-grained (± polarity) [2] | Coarse (use-site only) [6] | Fine-grained, cell-attributed |
| Space (C4) | Needs compression [3] | Constant, no wrappers | Constant, no wrappers |
| Object identity | Broken (`is`, `type()`) [6] | Preserved | Preserved |
| Per-op cost | Proxy alloc + indirection | Check at every elimination | RTTI check at every access |

### 4.4 Monotonic references: types that only get more precise

**Monotonic** semantics keeps the heap honest without proxies by storing a *runtime type* in every reference cell. Allocation `ref_T v` creates a cell tagged `T`; a cast `⟨Ref T ⇒^ℓ Ref S⟩ r` *refines the cell's tag* to the greatest lower bound `T ⊓ S` (defined when `T ~ S`), re-verifying contents against `S`:

```rust
// Monotonic cast on a reference cell (pseudocode)
fn cast_ref(cell: &Cell, s: Type, blame: Label) {
    let t = cell.rtti;
    let m = meet(t, s).unwrap_or_else(|| raise(blame)); // T ⊓ S
    for v in cell.contents { check(v, m, blame); }       // re-verify contents
    cell.rtti = m;                                       // monotonic: m ⊑ t
}
```

Because `⊓` only moves *down* the precision order, a cell's tag is monotonically refined, and reads/writes are checked against the accumulated tag. No wrappers accumulate, identity is preserved, and blame stays precise: a failed write blames the writer's label against the cell's recorded type [10][11].

The price is *pervasive runtime type information*: every reference carries a tag and every access consults it. The interaction of precision with heap state is subtle for the gradual guarantee: refining a cell's tag in the more-precise program can cause a write to fail (with blame, which the dynamic guarantee permits) where the less-precise program succeeds [4][10]. Monotonic references thus trade *uniform* runtime cost for the combination of soundness, identity, and blame that neither guarded nor transient achieves alone.

### 4.5 Space-efficient coercions and threesome factorization

Whether proxies or casts, the space problem of §2.3 is solved the same way: *compose casts as data, not as wrappers*. Herman, Tomb, and Flanagan's coercion calculus [9] represents each cast as a first-class *coercion* `c : T₁ ⇒ T₂` drawn from a grammar including identity, injection/projection through `?`, function coercions `c₁ → c₂`, and — crucially — *sequencing* `c₁ ; c₂` with an associative composition operator that normalizes eagerly. Applying a coerced value `⟨c⟩ v` where `c` is already a composition merges the new cast into the existing coercion *in place*, so the even/odd program's tail calls carry a single bounded-size coercion rather than a growing stack of frames [3][9].

Siek and Wadler's **threesomes** [3] give this idea its sharpest form. Any cast `T₁ ⇒ T₂` factors through the greatest lower bound, and any chain of threesomes collapses to a single threesome by taking the greatest lower bound of the intermediate types — computed *statically* from the types alone:

> **Theorem (Threesome collapse [3]):** `⟨T₁ ⇒ T₂⟩ ; ⟨T₂ ⇒ T₃⟩` normalizes to one threesome with middle type `(T₁ ⊓ T₂) ⊓ (T₂ ⊓ T₃)`. Corollary: at most one coercion per cast site, regardless of recursion depth — tail calls stay tail calls. Blame labels survive the translation, so the failing threesome maps blame back to the offending source twosome, and the Fundamental Property of Casts follows from full abstraction between the blame, coercion, and space-efficient calculi [9].

---

## 5. Empirical Results and Formal Proofs

### 5.1 The performance-lattice methodology

Their methodology: take a benchmark of `n` modules, measure all `2ⁿ` typed/untyped configurations (the *performance lattice*) against the fully-untyped baseline, and plot the overhead distribution. The headline finding [8] was stark: for Typed Racket, the overwhelming majority of partially-typed configurations suffered *order-of-magnitude* slowdowns — many exceeding 10× — with usable performance confined to the lattice's extremes. The culprit was the boundary machinery analyzed here: higher-order casts installed at every typed/untyped module boundary.

Follow-up work applied the same lattice methodology to Reticulated Python's three semantics [5]: guarded proxies incurred the identity breakage of §4.2 *and* the worst overheads; transient checks scaled far more gracefully by avoiding proxy allocation on the boundary; monotonic references sat between, their RTTI checks cheaper than proxies but more pervasive than transient's use-site checks. Parallel work on *blame* performance showed that full blame tracking can dominate even the checking cost, motivating current research into transient blame and lazy blame strategies [10].

### 5.2 What is proved

The metatheory forms an unusually complete tower: **blame safety** (Wadler & Findler [2], mechanized — casts from less-precise to more-precise types blame only the less-precise side); **the gradual guarantee** (Siek et al. [4], mechanized in Coq for the GTLC, both static and dynamic parts); **threesome collapse** (Siek & Wadler [3] — every cast chain normalizes to a single threesome with blame preserved); and **full abstraction λB → λC → λS** (Siek et al. [9] — coercions introduce no observable behavioral difference, and the Fundamental Property of Casts follows from the translations).

The empirical and the formal meet at a single point: the lattice measurements of [8] are *explained* by the calculi of [2][3] — proxies cost what the blame calculus says they must, and threesomes save what the coercion calculus promises.

---

## 6. Limitations

This analysis inherits the limits of its sources. **First**, the comparison is at the level of *core calculi*; production systems add objects, classes, generics, and exceptions, each perturbing the trade-offs (width subtyping for mutable objects is statically unsound [6]). **Second**, the gradual guarantee is a *relative* property — it says nothing about absolute performance or blame-message usability; user studies suggest programmers often cannot act on blame information even when precise [10]. **Third**, transient blame is still open: no agreed calculus gives transient semantics the diagnostics of [2] without reintroducing proxies [6][10]. **Fourth**, monotonic references assume a runtime willing to tag every heap cell — a non-starter for fixed object models (stock Python or JavaScript VMs), which partly explains transient's practical dominance. **Fifth**, the lattice counts *configurations*, not *programmer-hours*, so a 100× slowdown on a configuration no human would write is a weaker indictment than it appears — though [8] argues realistic migration paths do traverse the slow region. Finally, this thesis proves no new theorems; it systematizes, and systematization can flatten genuine disagreements over whether the gradual guarantee is even the *right* criterion [10].

---

## 7. Conclusion

Gradual typing's runtime semantics is a three-cornered negotiation between **soundness**, **diagnosability**, and **efficiency**, and the blame calculus is the instrument that keeps it honest. Guarded proxies deliver transitive soundness and the finest blame at the cost of object identity and — without coercion compression — asymptotic space. Transient checks recover identity and constant space but surrender blame precision and heap invariants. Monotonic references recover all three formal properties by tagging the heap, but demand a runtime built to carry types at every cell. The gradual guarantee [4] disciplines the negotiation from above, blame safety [2] from below, and threesome coercions [3][9] remove what looked like a fundamental space tax. The empirical record [7][8] is sobering — sound gradual typing, naively implemented, is "dead" on performance — but also *diagnostic*: every order of magnitude in those lattice plots is attributable to a specific formalized mechanism, which means each is, in principle, optimizable.

---

## References

[1] Jeremy G. Siek and Walid Taha. *Gradual Typing for Functional Languages*. Scheme and Functional Programming Workshop, 2006. http://scheme2006.cs.uchicago.edu/scheme2006.pdf

[2] Philip Wadler and Robert Bruce Findler. *Well-Typed Programs Can't Be Blamed*. ESOP 2009, LNCS 5502, pp. 1–16. https://www.pure.ed.ac.uk/ws/portalfiles/portal/18384119/Wadler_Findler_2009_Well_Typed_Programs_Can_t_Be_Blamed.pdf

[3] Jeremy G. Siek and Philip Wadler. *Threesomes, With and Without Blame*. POPL 2010, pp. 365–376. https://doi.org/10.1145/1706299.1706342 — https://homepages.inf.ed.ac.uk/wadler/papers/threesomes-popl/threesomes-popl.pdf

[4] Jeremy G. Siek, Michael M. Vitousek, Matteo Cimini, and John Tang Boyland. *Refined Criteria for Gradual Typing*. SNAPL 2015, LIPIcs 32, pp. 274–293. https://doi.org/10.4230/LIPIcs.SNAPL.2015.274

[5] Michael M. Vitousek, Andrew M. Kent, Jeremy G. Siek, and Jim Baker. *Design and Evaluation of Gradual Typing for Python* (Reticulated Python). DLS 2014, pp. 45–56. https://jsiek.github.io/home/dls28-vitousekA.pdf

[6] Max S. New, Daniel Jamner, and Amal Ahmed. *Gradual Typing in an Open World*. arXiv:1610.08476. https://arxiv.org/pdf/1610.08476

[7] Asumu Takikawa, Daniel Feltey, Ben Greenman, Max S. New, Jan Vitek, and Matthias Felleisen. *Towards Practical Gradual Typing*. ECOOP 2015. http://www.ccs.neu.edu/scheme/pubs/ecoop2015-takikawa-et-al.pdf

[8] Asumu Takikawa, Daniel Feltey, Ben Greenman, Max S. New, Jan Vitek, and Matthias Felleisen. *Is Sound Gradual Typing Dead?* POPL 2016, pp. 456–468. https://doi.org/10.1145/2837614.2837630

[9] Jeremy G. Siek et al. *Blame and Coercion: Together Again for the First Time*. J. Functional Programming. https://homepages.inf.ed.ac.uk/wadler/papers/coercions-jfp/coercions-jfp.pdf

[10] Jeremy G. Siek et al. *The Dynamic Practice and Static Theory of Gradual Typing*. SNAPL 2019, LIPIcs 136. https://drops.dagstuhl.de/storage/00lipics/lipics-vol136-snapl2019/LIPIcs.SNAPL.2019.6/LIPIcs.SNAPL.2019.6.pdf

[11] Ningning Xie et al. *What Is Decidable about Gradual Types?* POPL 2020. http://web.cs.ucla.edu/~palsberg/paper/popl20.pdf
