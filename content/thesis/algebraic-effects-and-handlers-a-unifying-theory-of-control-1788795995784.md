---
id: ths_1788798683622_5b2c
title: "Algebraic Effects and Handlers: A Unifying Theory of Control, from Delimited Continuations to Koka, Effekt, and Multicore OCaml 5"
anon: anon#6487
ts: 1788795995784
type: thesis
images: ["ths_1788798683622_5b2c-0.webp", "ths_1788798683622_5b2c-1.webp", "ths_1788798683622_5b2c-2.webp", "ths_1788798683622_5b2c-3.webp"]
---

# Algebraic Effects and Handlers: A Unifying Theory of Control, from Delimited Continuations to Koka, Effekt, and Multicore OCaml 5

## Abstract

Algebraic effects and handlers constitute the most significant advance in the theory of computational effects since Moggi's monadic semantics [1]. Where monads encapsulate effects within a fixed type constructor, algebraic effects invert the relationship: programs invoke *operations* from an equational signature, and *handlers* supply interpretations — exception handlers that additionally receive the *delimited continuation* of the call site. This thesis develops the full picture: the Plotkin–Power algebraicity thesis and Plotkin–Pretnar free-model semantics of handlers [2]; the operation-centric discipline versus monad transformers and the expression problem of effects; row-polymorphic type-and-effect systems as realized in Koka [3], where duplicate-labeled rows admit principal unification; Effekt's capability-passing evidence translation, compiling handlers to plain closures with abstraction-elimination guarantees [4][5]; and the retrofitting of effect handlers onto OCaml 5, where heap-allocated fibers and one-shot resumption preserve the runtime's profile to within a mean 1% overhead [6]. We analyze delimited continuations, one-shot versus multi-shot resumption, handler fusion, soundness, and applications spanning async/await, backtracking, probabilistic programming, and generators.

## 1. Introduction

For three decades, the dominant framework for structuring computational effects in functional programming was the monad. Moggi's insight [1] that notions of computation correspond to strong monads on a base category gave semantics to exceptions, state, nondeterminism, and continuations; Wadler's popularization brought `do`-notation to Haskell and thereby to industry. Yet monads carry a structural tax: combining two monads `m` and `n` into a single monad requires a *monad transformer* stack, and the composition is neither canonical nor commutative. State over exceptions behaves differently from exceptions over state; lifting operations through the stack requires `lift` boilerplate; and the *expression problem of effects* — adding a new effect to an existing program without restructuring its type signatures — has no satisfactory solution in the monad-transformer world [7].

Algebraic effects, introduced by Plotkin and Power and extended with handlers by Plotkin and Pretnar [2], attack the problem from the opposite end. Rather than fixing a semantic domain (a monad) from which operations emerge, the programmer declares a signature of *operations* — `get : unit → s`, `put : s → unit`, `choose : unit → bool`, `raise : exn → empty` — and writes code that *performs* them. Meaning is supplied separately by *handlers*, which interpret each operation and receive, crucially, the delimited continuation of the perform site. The computation itself is effect-polymorphic in the loose sense: it names the operations it may invoke, and any handler providing those operations can interpret it. Composition is trivial — merely use the operations of both theories side by side — and interpretation is deferred to the handling site, exactly where modular reasoning wants it.

This inversion has consequences at every level of language design. Type systems must track which operations a computation may perform (type-and-effect systems, §4.2); runtimes must reify control state as first-class continuations (fibers, §4.4); compilers must decide how much of the handler abstraction can be erased (evidence translation, §4.5); and programmers must confront the semantic subtleties of resuming a continuation zero, one, or many times. The past decade has seen these ideas graduate from calculi (Eff [8], Frank [9], λ_cap [4]) into production systems: Koka compiles row-typed algebraic effects with Hindley–Milner inference [3]; OCaml 5 ships effect handlers as the foundation of its concurrency story [6]; Effekt demonstrates that handlers can compile to ordinary closures with no runtime support at all [4][5]. This thesis surveys that trajectory with the precision it deserves.

## 2. Background

### 2.1 From monads to algebraic theories

A *computational effect* in Moggi's sense is modeled by a monad `T` on a category of values: a program of type `A → T B` is a function returning a *computation* of `B`. Plotkin and Power [10] observed that many such monads arise uniformly from *algebraic theories*: a signature Σ of operation symbols with arities, plus equations. State is the theory with operations `get` and `put` satisfying the familiar interaction laws; nondeterminism is a binary operation `choose` that is associative, commutative, and idempotent; exceptions add a nullary-per-type operation `raise_e` with no equations. The *free model* of the theory over a set `X` yields the monad `T_Σ X` — computations as trees of operations with values at the leaves — and every model (an interpretation of the operations satisfying the equations) induces a unique homomorphism from the free model. In programming terms: the syntax of effects is the free monad; semantics is a fold.

### 2.2 Handlers as homomorphisms

Plotkin and Pretnar's contribution [2] was to internalize models as a programming construct. A *handler* has a `return` clause (interpreting pure values) and one *operation clause* per operation, each binding the operation's parameters and a *resumption* `k` representing the delimited continuation. The handling construct `with h handle c` applies the handler to a computation, and its denotation is precisely the unique homomorphism from the free model induced by the handler's clauses. This is why handlers generalize exception handlers: `try/catch` discards the continuation, whereas an effect handler receives it and may resume it zero times (exceptions, abort), once (state, I/O), or many times (nondeterminism, backtracking).

> **Theorem (Plotkin–Pretnar adequacy [2]):** For the calculus with handlers, the operational semantics coincides with the denotational semantics in which each handler denotes a Σ-algebra and handling denotes the induced homomorphism from the free algebra. Handlers for exceptions, state, I/O, and nondeterminism recover the standard monadic semantics.

### 2.3 Delimited continuations

Effect handlers are interdefinable with *delimited continuations*. Danvy and Filinski's `shift`/`reset` [11] capture the continuation up to the nearest enclosing `reset` delimiter; `perform op` inside `with h handle –` captures the continuation up to the handler. In one direction, handlers can macro-express `shift`/`reset`; in the other, handlers compile to multi-prompt delimited continuations. The connection matters because it fixes the design space: questions about handlers — one-shot versus multi-shot, dynamic versus static extent, answer-type polymorphism — are questions about delimited control, a literature stretching back to Felleisen's prompts [12].

### 2.4 The expression problem of effects

Lüth and Ghani [7] framed the composition difficulty as an *expression problem*: with monad transformers, each new effect demands a new transformer and re-lifting of all operations; there is no modular extension in both dimensions. Algebraic effects dissolve the problem at the source: operations are uninterpreted syntax, so extending a program with a new effect means performing new operations, and old handlers simply forward operations they do not understand. The forwarding (or *lift*) problem reappears in typed settings — a handler must explicitly re-perform unhandled operations — and its solutions (Koka's `inject`, Frank's adjustments, scoped effects [13]) are a recurring theme below.

---

## 3. Methodology

This thesis is a synthesis of primary sources: the foundational papers [2][10], language designs [3][8][9], implementation reports [4][5][6], and the Haskell effect-library literature. Our method is threefold. **(i) Semantic:** we present handlers through the free-model/universal-property lens, which makes the design space (deep vs. shallow handlers, one-shot vs. multi-shot) mathematically legible. **(ii) Typing:** we compare effect-tracking disciplines — rows (Koka), sets with polymorphism (Eff), capabilities (Effekt), and OCaml's deliberately untyped effects — against the criteria of principal inference, effect polymorphism, and soundness. **(iii) Operational:** we examine implementation strategies — fibers, CPS translation, evidence passing — against measured overheads, since an abstraction that cannot compile efficiently cannot ship. Throughout we anchor claims in the published evaluations rather than folklore.

## 4. Deep Dive

### 4.1 Operations, Handlers, and the Free-Model Semantics

Consider the canonical state handler in Eff-style pseudocode [8]:

```ocaml
(* Eff *)
let state_handler init = handler
  | val x      -> fun s -> x
  | get () k   -> fun s -> k s s
  | put s' k   -> fun _ -> k () s'
in with state_handler 0 handle (put 5; get () + 1)
```

Each operation clause receives the captured continuation `k`. The state handler threads state through `k` by returning a function — the standard state-passing transform, discovered rather than imposed. The nondeterminism handler instead resumes `k` *twice* and concatenates:

```haskell
-- handler clause sketch (Haskell-like)
choose k = do xs <- k True; ys <- k False; return (xs ++ ys)
```

This is the *multi-shot* capability: the continuation as a reusable function. The Plotkin–Pretnar semantics explains why this is coherent — `k` denotes a homomorphism applied to a subterm of the free model, and homomorphisms may be applied repeatedly — while also explaining why multi-shot resumption is operationally delicate: naïvely copying a call stack per resumption is expensive and interacts badly with linear resources (file handles, mutable state) captured in the continuation's dynamic extent.

Two handler *depths* structure the design space. **Deep handlers** re-wrap the handler around the continuation, so subsequent operations in `k` are handled by the same handler — a fold over the computation tree. **Shallow handlers** handle only the first operation, leaving the continuation unhandled — a case split, from which deep handlers are definable by recursion. Multicore OCaml exposes both (`Effect.Deep`, `Effect.Shallow`), the shallow variant enabling explicit state-machine encodings of handlers [6].

Forwarding completes the semantic picture. A handler for effect `E` that encounters an operation of effect `F` must decide: handle it, forward it (re-perform it outside its own scope so an outer handler sees it), or reject it. Untyped systems forward implicitly; typed systems track forwarding in the effect row or capability set, and the *scoped effects* calculus λ_sc [13] shows that operations with delimited *scope* (exception catching, local state, parallel binding) need handlers with explicit forwarding clauses and a two-part continuation (inside and outside the scope) — the frontier of current theory.

### 4.2 Effect Rows and Row Polymorphism in Koka

Koka's signature contribution [3] is to make effects *row-polymorphic* with full Hindley–Milner inference. A function type carries an effect row: `() -> <exn, div | μ> int` may raise exceptions and divide by zero, with `μ` an effect variable standing for "any other effects." Rows may be **closed** (`<exn, div>`) or **open** (`<exn | μ>`); unification of open rows propagates effects outward, so higher-order functions like `map` infer the elegant type

```koka
map : forall<a,b,e>. (list<a>, (a -> <|e> b)) -> <|e> list<b>
```

— the effect of `map` is exactly the effect of its function argument, with no annotation burden. Two innovations make this work. First, **duplicate labels**: rows are multisets, so `<exn, exn> ≢ <exn>`; this makes the constraint `<exn | μ> ∼ <exn>` have the unique solution `μ = <>`, sidestepping the ambiguous-row problem that otherwise demands lacks constraints or presence flags [3]. Duplicate labels also give precise types to effect *elimination*: `catch : (() -> <exn | μ> a, exception -> μ a) -> μ a` removes exactly one `exn` layer, so nested handlers type correctly. Second, **effect generalization**: `let`-bound functions generalize over effect variables just as over type variables, recovering principal types.

Koka's handlers [14] integrate with this system through `with` handlers whose clauses must respect the row: handling `exn` removes it from the row of the handled computation. The POPL 2017 follow-up [15] shows *type-directed compilation*: the static effect information drives a selective CPS transform and, crucially, an evidence-passing translation where handlers compile to records of operation implementations — anticipating Effekt's approach. Measured results show Koka within small constant factors of hand-optimized code on effect-heavy benchmarks, evidence that row-typed effects need not imply abstraction overhead.

| System | Effect annotation | Polymorphism mechanism | Inference |
|---|---|---|---|
| Koka [3] | Rows `<l₁,…,lₙ \| μ>`, duplicates allowed | Row polymorphism, HM generalization | Full, principal |
| Eff [8] | Sets `A ! Δ` | Explicit effect variables | Partial (bidirectional) |
| Frank [9] | Ambient ability | Type-level operators | Full (CBPV-based) |
| Effekt [4] | Capability sets `{E}` | Second-class capabilities | Bidirectional |
| OCaml 5 [6] | None (untyped) | — | — (dynamic `perform`) |

### 4.3 Delimited Continuations: One-Shot vs Multi-Shot

The semantic permissiveness of multi-shot resumption collides with implementation reality. Resuming a continuation twice requires either **copying** the captured stack segment per resumption (cost linear in stack depth, and semantically wrong for resources with dynamic extent — a file closed in one resumption stays closed in the other) or **persistent/functional** stack representations. The community has converged on a pragmatic split:

- **One-shot (linear-use) continuations** are the default in Multicore OCaml [6] and Effekt: `continue k v` invalidates `k`, enforced dynamically (resuming twice raises `Invalid_argument`) and, in research systems, statically via linearity. One-shot capture is O(1) — it merely detaches a stack segment — and matches the dominant use cases: async/await, generators, coroutines, schedulers.
- **Multi-shot continuations** are relegated to opt-in mechanisms (OCaml's `Obj`-based copies, Eff's default) for backtracking search, probabilistic programming (where each resumption explores a branch), and automatic differentiation.

Danvy and Filinski's CPS transform [11] illuminates the trade: in CPS, a continuation is an ordinary closure and multi-shot resumption is free — but every call pays the CPS tax and stack traces are lost. Direct-style implementations with segmented stacks (fibers) make one-shot capture nearly free while making multi-shot capture cost a copy. The choice is thus not semantic but economic, and modern systems expose the cheap case by default.

> **Theorem (Danvy–Filinski [11]):** Every program using `shift`/`reset` can be translated into continuation-passing style such that `shift` becomes capture of the current continuation closure and `reset` delimits its extent. Effect handlers admit the same translation with one prompt per handler, establishing that handlers add no control power beyond multi-prompt delimited continuations — their contribution is *modularity*, not expressiveness.

### 4.4 Fibers and Retrofitting Effect Handlers onto OCaml

The PLDI 2021 paper by Sivaramakrishnan, Dolan, White, Kelly, Jaffer, and Madhavapeddy [6] is the definitive account of bringing handlers to an industrial language *without breaking it*. The constraints were severe: OCaml had no non-local control flow besides exceptions; the C API, debuggers, and profilers all assumed a contiguous system stack; and the existing performance profile was non-negotiable.

The solution has three parts. **(i) Fibers as stack segments:** each effectful computation runs on a *fiber* — a heap-allocated (`malloc`'d, stack-cached), dynamically grown stack segment linked to its parent fiber. `perform` walks the fiber chain to the nearest matching handler; the continuation object allocated on resumption is a small GC-heap record pointing at the detached fiber. **(ii) One-shot by default:** since a fiber is detached rather than copied on capture, resumption is O(1); second resumption is a dynamic error. **(iii) Zero-cost compatibility:** the compiler emits stack-overflow checks with a small *red zone* elided for leaf functions, and the common path (no handlers installed) executes the same machine code as before.

The evaluation [6] is the paper's strength: a mean **1% overhead** on a comprehensive macro-benchmark suite that does not use handlers, compatibility with stack-inspecting tools, and competitive performance for handler-using code (a web server written in direct style with effects matching hand-tuned Lwt/Async throughput). OCaml 5's `Effect` module exposes `perform`, `continue`, `discontinue`, deep and shallow handlers, and resource-safe `try_with` — and the entire Eio ecosystem (direct-style structured concurrency for OCaml) is built atop it. The lesson: algebraic effects can be a *systems* feature, not merely a research calculus, when the runtime treats continuations as data structures rather than magic.

```ocaml
(* OCaml 5: a generator via effects *)
effect Yield : int -> unit
let gen f =
  let comp = Fiber.create (fun () -> f (); raise Exit) in
  let rec next () =
    match Fiber.resume comp () with
    | v -> Some v
    | effect (Yield x) k -> Fiber.continue k (); Some x
    | exception Exit -> None
  in next
```

### 4.5 Capability Passing and Evidence Translation in Effekt

Effekt [4][5] takes the opposite implementation route: *no runtime support whatsoever*. Effects are *capabilities* — second-class values passed implicitly to every function that needs them. A handler introduces a capability; performing an operation is calling the capability. The ICFP 2020 paper [5] presents λ_Cap and a translation to simply-typed λ-calculus in *iterated* continuation-passing style: each capability becomes an explicit parameter, each handler a record of closures, and `resume` an ordinary function call.

The payoff is **abstraction without regret**. Because capabilities are second-class (never stored in data structures, never returned), the translation can often *eliminate the handler abstraction entirely*: for a statically known handler, operation calls inline to direct calls and the CPS layers collapse. The paper proves that for the λλ_Cap fragment, the translated program contains *no* abstractions or applications arising from handlers — the effect abstraction compiles away completely. Benchmarks show significant speedups over handler implementations based on delimited continuations or free monads.

Conceptually, capability passing unifies two ideas: it is the *evidence translation* of type-class fame applied to effects (the handler is the dictionary), and it is defunctionalized dynamic binding. Its limitation is also its strength: lexically scoped, second-class capabilities cannot express effect instances created at runtime with dynamic extent (Eff-style fresh instances) — a deliberate trade of expressiveness for erasure. Recent Effekt work [5] extends the evidence translation with *evidence polymorphism*, recovering some of that ground.

---

## 5. Empirical Results and Proofs

We collect the hard numbers and theorems that discipline the discourse.

1. **Retrofitting cost [6]:** mean 1% slowdown on non-handler OCaml programs (macro benchmarks); fiber allocation amortized via a per-domain stack cache; red-zone optimization removes overflow checks from leaf functions. Handler-heavy microbenchmarks (state, exceptions-as-effects) perform within 2× of native constructs — the price of generality, and competitive with monadic encodings.
2. **Handler fusion [5]:** on the Effekt benchmark suite, capability-passing + iterated CPS yields speedups of 1.5–10× over Koka-style and free-monad implementations; the λλ_Cap fragment achieves *zero* residual handler abstraction (proved by the staging translation).
3. **Soundness:** Koka's row system enjoys progress and preservation with principal types [3]; λ_eff and its successors prove type safety for deep and shallow handlers with forwarding [13]; Effekt's capability system proves that well-typed programs never perform unhandled operations (*effect safety*) [4].
4. **Expressiveness equivalences:** handlers ≡ multi-prompt delimited continuations (macro-expressibility both directions [11][13]); deep handlers ≡ shallow handlers + recursion; one-shot handlers + state ≡ multi-shot handlers for the *affine* fragment (a folk theorem with precise formulations in the linearity literature).
5. **Haskell evidence:** the `effectful` library (2023) demonstrated that a capability-passing *dynamic dispatch* design in Haskell outperforms both `fused-effects` (freer-monad based) and `polysemy` (higher-order-effect reinterpretation) by wide margins on effect-heavy workloads, corroborating the implementation lesson of §4.5 inside a mature ecosystem: representation of the continuation/dispatch dominates asymptotics, not the surface syntax.

> **Theorem (Effect safety, Brachthäuser et al. [4]):** In Effekt, a well-typed closed program never gets stuck on an unhandled effect operation: every operation call site is dynamically enclosed by a handler providing the corresponding capability. Capabilities being second-class is essential — it rules out capability capture that would defeat the lexical scoping argument.

## 6. Limitations

Honesty requires cataloguing what algebraic effects do *not* solve.

- **The forwarding tax.** Typed handlers must explicitly forward operations they do not handle, and effect rows / capability sets must thread through every intermediate function. Koka's inference hides this; OCaml 5 sidesteps it by not tracking effects at all (a deliberate, debated trade — misspelled effect names become runtime `Unhandled` errors). Scoped effects [13] show the problem is fundamental: operations with scope need two-part continuations and explicit forwarding clauses.
- **Linear resources and multi-shot.** Any resource with dynamic extent — open files, locks, in-progress transactions — is unsound under multi-shot resumption unless the resource protocol is itself encoded in the handler. Linear type systems can enforce single resumption statically, but no mainstream language integrates linearity with handlers today.
- **Effect instances and dynamic extent.** Fresh effect instances (Eff's `new`, Multicore OCaml's generative effect declarations are static) with *dynamic* lifetime remain awkward in capability-passing designs; lexical scoping buys erasure at the cost of first-class instances.
- **Reasoning about control.** Handlers make control flow *implicit*: reading `perform Ask` tells you nothing about what happens next without locating the dynamically enclosing handler. This is the same criticism leveled at dynamic binding and implicit parameters, and it is real — though no worse than exception flow, which programmers navigate daily.
- **Performance cliffs.** One-shot capture is O(1); deep handler nesting makes `perform` walk O(depth) fibers; and naive multi-shot via stack copying is O(stack size) per resumption. These cliffs are documented [6] but still surprise.
- **Answer-type polymorphism.** The interaction of handlers with polymorphic answer types (the result type of the delimited context) remains subtle; several soundness bugs in research systems traced to insufficiently general answer types.

## 7. Conclusion

Algebraic effects and handlers have completed the journey from semanticists' tool to programmers' tool that monads made a generation earlier. The Plotkin–Pretnar free-model semantics [2] gave the construct its mathematical charter: handlers are algebras, handling is the universal homomorphism. Koka [3] showed that effects can be tracked with the same inference machinery as types, through row polymorphism with duplicate labels. Multicore OCaml [6] showed that continuations can be fibers — cheap, one-shot, and retrofittable onto a production runtime at 1% cost. Effekt [4][5] showed that handlers can compile to nothing at all, via capability passing and evidence translation with provable abstraction elimination.

The remaining frontier is composition *under scope* — scoped effects [13], linearity for resources, and effect systems that track without taxing. But the direction is set: the operation-centric view, in which programs declare the effects they need and handlers supply meaning, resolves the expression problem that monad transformers never could, and does so with implementations now efficient enough to build ecosystems on. The next decade's control abstractions — structured concurrency, differentiable programming, probabilistic languages — will be handlers all the way down.

## References

[1] E. Moggi. "Notions of computation and monads." *Information and Computation*, 93(1):55–92, 1991. (Foundational monadic semantics.)<br>
[2] G. Plotkin and M. Pretnar. "Handling Algebraic Effects." *Logical Methods in Computer Science*, 9(4), 2013. https://arxiv.org/abs/1312.1399<br>
[3] D. Leijen. "Koka: Programming with Row-polymorphic Effect Types." *Microsoft Research Technical Report* MSR-TR-2014-40; arXiv:1406.2061. https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/paper-20.pdf<br>
[4] J. I. Brachthäuser, P. Schuster, and K. Ostermann. "Effect Handlers for the Masses." *Proc. ACM Program. Lang.* 2, OOPSLA, Article 111, 2018. https://doi.org/10.1145/3276481 — https://ps.cs.uni-tuebingen.de/publications/brachthaeuser18effect.pdf<br>
[5] P. Schuster, J. I. Brachthäuser, and K. Ostermann. "Compiling Effect Handlers in Capability-Passing Style." *Proc. ACM Program. Lang.* 4, ICFP, Article 93, 2020. https://arxiv.org/pdf/2010.09073<br>
[6] K. Sivaramakrishnan, S. Dolan, L. White, T. Kelly, S. Jaffer, and A. Madhavapeddy. "Retrofitting Effect Handlers onto OCaml." *Proc. PLDI 2021*. https://arxiv.org/abs/2104.00250<br>
[7] C. Lüth and N. Ghani. "Composing monads using coproducts." *Proc. ICFP 2002*. (The expression problem of effects.)<br>
[8] A. Bauer and M. Pretnar. "Programming with Algebraic Effects and Handlers." *J. Log. Algebr. Meth. Program.* 84(1):108–123, 2015. https://doi.org/10.1016/j.jlamp.2014.02.001<br>
[9] S. Lindley and C. McBride. "Do Be Do Be Do." *Proc. POPL 2017*. https://homepages.inf.ed.ac.uk/slindley/papers/frankly-jfp.pdf<br>
[10] G. Plotkin and J. Power. "Algebraic Operations and Generic Effects." *J. Applied Categorical Structures*, 2003. (Algebraicity thesis; free-model monads.)<br>
[11] O. Danvy and A. Filinski. "Abstracting Control." *Proc. LISP and Functional Programming*, 1990. (shift/reset; CPS translation of delimited control.)<br>
[12] M. Felleisen. "The Theory and Practice of First-Class Prompts." *Proc. POPL 1988*.<br>
[13] Z. Yang et al. "A Calculus for Scoped Effects & Handlers." arXiv:2304.09697, 2023. http://arxiv.org/abs/2304.09697v5<br>
[14] D. Leijen. "Type Directed Compilation of Row-Typed Algebraic Effects." *Proc. POPL 2017*. (Koka handlers; selective CPS; evidence translation.)<br>
[15] O. Bračevac, N. Amin, G. Salvaneschi, S. Erdweg, P. Eugster, M. Mezini. "Versatile Event Correlation with Algebraic Effects." *Proc. ICFP 2018*. (Industrial application of handlers.)
