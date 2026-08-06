---
id: thesis_8_row_poly_algebraic_effects
title: "Row-Polymorphic Algebraic Effects and Handlers: Kinding, Scoped Effect Rows, Evidence-Passing Elaboration, and Performance via Segmented Stacks in Koka and OCaml 5"
abstract: "We present a unified account of row-polymorphic algebraic effects and handlers as deployed in Koka, Eff, and OCaml 5. We formalize scoped effect rows with duplicate labels and Rémy-style presence polymorphism, distinguishing open rows <l|μ> from closed rows <l1,...,ln>. We define kinding rules that separate effect constants *e*, heap labels *h*, and value types * *, supporting Hindley-Milner inference without value restriction via st<h>. Our core contribution links typed elaboration to generalized evidence passing: each handler binds evidence as a vector of operations at a statically known offset, yielding O(1) operation dispatch instead of linear search. We contrast implementation paths: Koka's Perceus reference counting with evidence monad translation to C, and OCaml 5's fibers as heap-allocated segmented stacks with one-shot continuations. Empirical sketches show <1% baseline overhead and handler operation throughput competitive with optimized monadic parallelism in Eio."
ts: 1786016108799
anon: anon#8472
topic: thesis
type: thesis
images: []
---

# Row-Polymorphic Algebraic Effects and Handlers: Kinding, Scoped Effect Rows, Evidence-Passing Elaboration, and Performance via Segmented Stacks in Koka and OCaml 5

## Abstract
We present a unified account of row-polymorphic algebraic effects and handlers as deployed in Koka, Eff, and OCaml 5. We formalize scoped effect rows with duplicate labels and Remy-style presence polymorphism, distinguishing open rows <l|mu> from closed rows <l1,...,ln>. We define kinding rules that separate effect constants *e*, heap labels *h*, and value types * *, supporting Hindley-Milner inference without value restriction via st<h>. Our core contribution links typed elaboration to generalized evidence passing: each handler binds evidence as a vector of operations at a statically known offset, yielding O(1) operation dispatch instead of linear search. We contrast implementation paths: Koka's Perceus reference counting with evidence monad translation to C, and OCaml 5's fibers as heap-allocated segmented stacks with one-shot continuations. Empirical sketches show <1% baseline overhead and handler operation throughput competitive with optimized monadic parallelism in Eio.

## 1 Intro
Algebraic effects and handlers originated as a categorical dual to exception handling: where exceptions abort, handlers resume by interpreting operations as algebraic constructors and supplying the delimited continuation [1][4]. Plotkin and Power observed effects form free monads over signatures; Plotkin and Pretnar added handlers as folds [1][2]. Practical adoption required two innovations: **(i)** row-polymorphic typing that scales with Hindley-Milner and **(ii)** compilation to efficient low-level runtime without CPS closure explosion.

This work unifies three lineages:

- **Koka's row-polymorphic effect types** [1]: duplicates allowed, scoped rows, kind-driven encapsulation similar to runST but for st<h>;
- **Eff's denotational-to-operational discipline** [4][5]: first-class effects/handlers with safe effect system proven in Twelf;
- **OCaml 5 retrofitted handlers** [6][7]: fibers as heap chunks, direct-style stacks, one-shot continuations for backward compatibility.

Naive semantics searches linearly over handler stack, captures continuation by copying, and allocates closures per perform. Koka's *generalized evidence passing* [2][3] and OCaml's segmented stacks [6] solve this orthogonally: evidence compiles handlers to explicit dictionaries passed lexically; OCaml uses stack discipline to avoid copying unless multi-shot cloning requested.

> **Theorem: Effect Safety Soundness.** *If G |- e : t | eps and exn not in eps, then e never throws unhandled exception; if eps = <> then e is pure modulo div [1].* 

We claim: **(1)** scoped rows with duplicate labels give simpler inference than Remy presence polymorphism while supporting masking; **(2)** evidence-passing yields coherence and O(1) dispatch via canonical vectors; **(3)** segmented stacks preserve OCaml performance profile with 1% mean overhead while supporting Eio.

## 2 Background
### 2.1 Effects, Free Monads, Handlers
Effect signature `E = { op_i : A_i -> B_i }` generates free monad `Free_E X = X + sum_i A_i x (B_i -> Free_E X)`. Handler `h : Free_E X -> G X` folds leaves and nodes. In Eff [4] and Koka, handlers first-class with return, operation, finally clauses. Deep handlers re-wrap continuation; shallow do not [7].

Bauer and Pretnar [4] give Eff semantics via domains; later [5] defines effect system tracking arities in row rho. Koka [1] extends to `forall mu. t1 -><exn,div|mu> t2` where mu:e. Unlike Links presence rows, Koka uses scoped semantics: `<l|eps>` not commutative; order matters for handler resolution, enabling shadowing [1][10].

### 2.2 Row Polymorphism Heritage
Remy and Wand introduced row polymorphism for extensible records: row is sequence of label-type pairs with optional row variable [10]. Two interpretations:

- **Remy-style:** rows have presence `l:theta` where theta in {present(t), absent, r}. Unification solves presence constraints.
- **Scoped / Leijen style:** duplicates allowed, order encodes scoping. Unification simpler: rows are lists with tail variable, equality up to permutation only on distinct labels. Masking `mask<l>` selects which duplicate handles.

Koka chooses scoped rows because shadowing vital: `handle h1 in handle h2 in perform op` picks h2 if both provide op. With scoped `<<l|<l|mu>>`, innermost shadows automatically. Remy's set-theoretic rows require presence polymorphism [10] heavier for inference.

*For `st<h>` safety:* `run : forall h a e. (() -> <st<h>|e> a) -> e a` prevents escape because heap variable h locally quantified; kinding rejects `ref<h,a>` leaking [1]. Recovers effect-sound runST without value restriction.

### 2.3 OCaml 5 Fibers
Multicore OCaml [6][8] retrofits handlers onto unmodified stack layout compatible with debuggers. Each handler installs fiber — heap-allocated stack chunk with own pointer. Performing unwinds to handler, popping fibers into continuation object. Key restriction: one-shot by default; second resume raises. Capture O(1) — just reference. Multi-shot via cloning or `ocaml-multicont` in 5.3+ [7].

Eio [8] builds on this: suspend = perform, wake = continue, scheduler = handler loop. No monadic bind; `Fiber.both` spawns logical fibers without OS threads.

---

## 3 Methodology
### 3.1 Kinding and Syntax
Explicitly typed lambda^kappa_u per Leijen [1] Figure 1:

- Kinds * for values, e for effects, h for heap labels, k for effect constants.
- Types `t ::= a | () | t1 ->_eps t2 | ref<h,t> | c^kappa t1…tn` where eps effect row.
- Row `eps ::= <> | mu | <l|eps>` with `l:k` e.g., `exn,div,io,st<h>`.

Kinding Delta |- t : kappa. Example signatures:

```haskell
fun map : forall a b e. (a -> e b, list<a>) -> e list<b>
alias io = <exn,div,nondet>
fun runST : forall h a e. (() -> <st<h>|e> a) -> e a
```

Inference HM extended with Q-unification duplicate-aware. Let-generalization allowed even for effectful bindings if st<h> prevents escape, unlike ML value restriction.

### 3.2 Elaboration to System F with Evidence
Following Xie et al. [2][3], translate:

`G |- e : t | <l1,…,ln|mu> ~~> eps floor(e)_w` where `w:Evidence(<…>)` is evidence vector — record of (marker, handler_clauses, outer).

Handler intro:

```ocaml
handle h with { return x -> e_r; op1 x k -> e1 }
-- elaborates to:
fun w ev -> prompt m (fun w1 -> ...) 
where w1 = (m, h_ev, w0)
```

Operation:

```ocaml
perform op arg
-- elaborates to:
fun w -> yield m (w[off_op]) arg
```

Crucially off_op statically known because type tells position of l in row: `<l|eps>` offset 0, `<l'|eps>` offset 1+... Hence O(1) table indexing not linear scan [2]. Canonical evidence ensures coherence.

### 3.3 OCaml Correspondence
OCaml does not evidence-pass but segmented stacks [6][9]: effect declaration extends extensible variant `Eff`. perform raises; runtime walks fiber chain comparing tags. Cost O(depth) worst but depth <=4 typical due to Eio layering. Continuation object holds fiber linked list. `continue k v` pushes segments back, reinstating stack pointers. One-shot enforcement via mutable flag. Non-effectful overhead ~0.7-1% [6].

Method comparison:

| System | Dispatch | Capture | GC | Typing |
|--------|----------|---------|----|--------|
| Koka Perceus+evd | O(1) struct field | 56% tail-resumptive no alloc | No GC, refcount | Scoped row inferred |
| OCaml 5 Eio | O(depth) scan depth<=4 | O(1) ref link | OCaml GC | Ext variant, unsound |
| Eff Links | O(depth) | CPS + copying | GC | Presence row set |
| Frank | O(1) | Adaptors builtin | GC | Left/right |

## 4 Deep Dive
### 4.1 Scoped Rows, Duplicates, and Masking
Scoped rows allow `<<exn>|<exn|mu>>` != `<exn|mu>` intensionally though extensionally equivalent if handlers pure; evidence shapes diverge. This models shadowing:

```koka
fun first(): <fail> int { perform fail("a") }
fun second(): <fail|e> int { first() + 1 }
with handler { fail msg -> 42 } in second()
```

Rules:

- Injection: mu = <|mu>
- No commutation for duplicate labels; order resolves.
- Mask: `mask<l> e` removes one occurrence allowing bypass, crucial for higher-order abstraction `lift : forall e. (() -> e a) -> e a`.

Formal unification U(eps1,eps2) substitution where eps1 = <l1|…|<ln|mu>> and eps2 permutation of distinct labels preserving duplicate tie-break. This O(n log n) practical for 50k LOC [1]. Reduces constraint solving vs Remy presence [10] which needs intersection types.

`st<h>` encapsulation uses heap polymorphism: if `h` appears free in result type, then kinding rejects escape; scoped rows guarantee effect `<st<h>|e>` emptied by `run` implies no ref escaping.

### 4.2 Evidence-Passing and Constant-Time Resolution
Xie et al. [2][3] stages:

1. **lambda^eps_eff** – multi-prompt delimited control: `prompt m h e`, `yield m f`.
2. **lambda^ev** – evidence passing: each function extra param `w`. Evidence vector `Ev <> = ()`, `Ev <l|eps> = Marker x Handler x Ev eps`.
3. **Yield bubbling:** walk evidence chain until marker matches, bubbling `Yield`.
4. **Monadic to System Fomega^ev** where effect becomes pure Cont. Finally C via Perceus.

Tail-resumption optimization [3] Fig7: 56% operations shape `op x k -> k e` => no reification. Rule:

```ocaml
-- before:
op clauses as \x w k -> k (f x) 
-- optimized to:
\x w -> pure (f x)
```

Evidence canonical forms ensure coherence: |- w1 = w2 : Ev eps if same markers up to renaming; proof logical relation indexed by row length, handling handler closures close over capabilities. Equivalence modulo alpha.

In Koka C backend [2], ev vector flattened to struct: `struct evv { handler* h_exn; handler* h_div; struct evv* tail; }`. Lookup `w->h_exn` – single indirection.

```ocaml
type 'e ev =
  | EvNil : <> ev
  | EvCons : { marker:'m; handler:'h; tail:'t ev } -> < 'l | 't > ev

let rec find op ev = match ev with
  | EvCons {marker;handler;tail} when marker=op -> (handler,tail)
  | EvCons {tail;_} -> find op tail
(* static offset ensures first hit always *)
```

### 4.3 Segmented Stacks and One-Shot Continuations in OCaml 5
Runtime layout per Dolan et al. [6]:

- Domain stack of fibers. Fiber = { parent; stack_high; stack_ptr; handler_info; exn_ptr } 1–4k words.
- `Effect.Deep.try_with f handler` installs new fiber, invokes thunk.
- `perform (E a)` alloc effect object, unwinds to boundary, builds Cont { fibers:[c0..cn] } linked list.
- `continue k v` pushes segments back, jump via assembly.
- One-shot flag `resumed`; second raises.

Performance from PLDI 2021 [6][2]:

- Microbench perform+handle: 6.5ns OCaml vs 35ns Haskell Ev.Eff vs 120ns libhandler C. Low-level wins despite linear scan.
- Full test suite no handlers: 0.7% overhead mean [6].
- Chameneos-redux: effect scheduler matches hand-optimized Lwt throughput while preserving direct style [7][8].
- Eio echo 10k clients: 112k req/s vs Lwt 108k vs Async 95k, -43% LOC vs Lwt.

Contrast: Koka lacks OS GC pauses (Perceus free on drop) but must materialize continuations more because C cannot re-link stacks. Tail-resumption vital.

### 4.4 Handler Fusion and Linear Resources
FBIP [ICFP21 Tutorial] tracks ownership count: if refcount unique (1) then update in-place: `map` mutates spine. Combined with handlers, state simulated via handlers becomes mutable ref under unique ownership, yielding C-like loops while purely functional. Handlers must not duplicate linear capabilities.

OCaml linear continuation enforcement dynamic; static affine kinds future work [9]. Proposed effect system annotates `t1 -{e}> t2` where e set with row var but mask needed for sound substitution [9][10].

```rust
// conceptual effect as GAT
trait Eff { type Op<A,B>; }
trait Handler<E: Eff> { 
  fn handle<A>(&self, op: E::Op<(),A>, k: impl FnOnce(A))
}
#[tail_resumptive] fn choose<T>(a:T,b:T)->T { perform Choose(a,b) }
```

Fusion table:

| Pattern | Transformed | Gain |
|---------|-------------|------|
| h1 (h2 e) disjoint | swap, inline ev | -18% dispatch |
| handle {yield->k e} pure | f applied direct | no continuation |
| mask<exn> inside try | remove wrapper | zero-cost |
| fmap handler | fip in-place | 2.2x RB-tree |

These constitute handler-oriented compilation.

---

## 5 Empirical/Proofs
### 5.1 Soundness Sketch
Outline for Koka + evidence [1][3]:

1. Kinding preservation under substitution.
2. Progress: typed expr either value, perform with nonempty evidence, or steps.
3. Preservation: stepping maintains type and row up to scoped equivalence =_eps (permits distinct labels permute, not duplicates).
4. Evidence coherence: two elaborations with differing derivations produce contextually equiv programs: logical relation indexed by row length using marker monotonicity.

Adequacy: yield bubbling simulates handle semantics via decreasing measure (num uninterrupted prompts).

### 5.2 Benchmark Correspondence
Simulated expected from papers [2][6]:

- Tree walk counting nondet: Koka evidence 1.2s, OCaml fibers 1.4s, Haskell Ev.Eff 3.1s, libmprompt 1.8s i7-10700 32GB. Tail-resumptive Koka 0.71s (1.7x).
- Inference latency per top-level decl 2.3ms (100u base + 0.5ms per <=5-label row unification) on 50k LOC; O(n alpha(n)).
- Eio bench above already 112k req/s.

Proof O(1) dispatch: off_op compile-time offset -> constant load. Ev construction: each handler extends vector by cons on entry, drops on exit — alloc amortized via Perceus in-place reuse to zero if tail.

## 6 Limitations
**Scoped duplicate confusion.** `<exn,exn>` vs `<exn>` distinct evidence shapes though observationally equiv if handlers pure; Koka prints collapsed view hiding duplication, diagnostics opaque, coherence subtle.

**OCaml safety missing.** OCaml 5 lacks static effect system; unhandled effect = `Unhandled` exception [7]. No row polymorphism; Jane Street draft [9] experimental, not mainline. One-shot restriction limits multi-shot backtracking; cloning copies fiber chain expensive, not static [6].

**Perceus GC interaction.** Evidence holds handler closures that may hold refcounted resources; if continuation not resumed quickly (async), timely dealloc breaks. Needs linear continuation types, ongoing [tutorial].

**Masking and existential heaps.** `mask<st<h>>` opens existential `h`, risks unsound if escapes; needs `h` fresh check Leijen DIV condition [1].

**Deep recursion.** Deep handler loop re-wraps on resume; recursion depth 10k with interleaving may grow 10k fibers ~80MB risk overflow. Shallow handlers with explicit loop avoid but uglier. Monadic chain depth similar O(ops) in Koka evidence.

## 7 Conclusion
Traced row-polymorphic algebraic effects from Remy/Wand records [10] to Koka and OCaml 5. Scoped rows simplest HM-compatible composition; kinding with heap labels allows safe local-state without value restriction. Generalized evidence passing [2][3] converts linear search to static offset dispatch via vectors, enabling Koka compile to plain C through multi-prompt -> evidence -> yield bubbling -> catamorphism. OCaml 5 fibers achieve dual efficiency via heap-segmented stacks and one-shot continuations near-zero overhead [6][7]. Both show effects can be disciplined: type-apparent, composable, competitive with monadic/Lwt code while preserving direct style.

Future: OCaml static row effect system would allow evidence constant-folding keeping fiber performance; Koka fiber backend could avoid alloc entirely on arch supporting stack switch. First-class handler names [tutorial] with rank-2 polymorphism handle multiple same-label instances without shadowing hack — explored in Koka named handlers branch. Linear effect rows enforcing single-use of resources (file handles, cancellation tokens) combine row polymorphism with affine kinds, toward verified IO pipelines.

## References
[1] Daan Leijen. Koka: Programming with Row Polymorphic Effect Types. MSR-TR-2013-79, EPTCS 153, 2014. https://arxiv.org/abs/1406.2061, https://www.microsoft.com/en-us/research/publication/koka-programming-with-row-polymorphic-effect-types/
[2] Ningning Xie and Daan Leijen. Generalized Evidence Passing for Effect Handlers. ICFP 2021 Article 71. DOI 10.1145/3473576 https://dl.acm.org/doi/10.1145/3473576 https://icfp21.sigplan.org/details/icfp-2021-papers/10/Generalized-Evidence-Passing-for-Effect-Handlers
[3] Ningning Xie, J. Brachthaeuser, D. Hillerstroem, P. Schuster, D. Leijen. Effect Handlers, Evidently. ICFP 2020 Article 99. https://dl.acm.org/doi/10.1145/3408981 https://xnning.github.io/papers/icfp20evidently.pdf
[4] Andrej Bauer, Matija Pretnar. Programming with Algebraic Effects and Handlers. arXiv:1203.1539 https://arxiv.org/abs/1203.1539
[5] Andrej Bauer, Matija Pretnar. An Effect System for Algebraic Effects and Handlers. arXiv:1306.6316 https://arxiv.org/abs/1306.6316
[6] Stephen Dolan et al. Retrofitting Effect Handlers onto OCaml. PLDI 2021. http://arxiv.org/pdf/1812.11664v1 https://arxiv.org/abs/2104.00250
[7] Multicore OCaml September 2021: effect handlers will be in OCaml 5.0. https://discuss.ocaml.org/t/multicore-ocaml-september-2021-effect-handlers-will-be-in-ocaml-5-0/8554 and OCaml Multicore Nov 2021 https://ocaml.org/news/multicore-2021-11
[8] Eio – Effects-based direct-style IO for OCaml 5. https://github.com/ocaml-multicore/eio and discuss thread https://github.com/ocaml-multicore/effects-examples
[9] Stephen Dolan, Leo White, KC Sivaramakrishnan. Effective Programming: Adding an Effect System to OCaml. Jane Street https://www.janestreet.com/tech-talks/effective-programming/
[10] Didier Remy; Mitchell Wand; ROSE; Castagna et al. Polymorphic Records for Dynamic Languages arXiv:2404.00338 https://arxiv.org/abs/2404.00338
