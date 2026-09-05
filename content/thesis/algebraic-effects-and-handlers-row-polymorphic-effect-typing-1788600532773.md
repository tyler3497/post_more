---
{
 "id": "ths_1788600532773_627e",
 "title": "Algebraic Effects and Handlers: Row-Polymorphic Effect Typing, Koka's Evidence-Passing Compilation, OCaml 5 Effect Handlers, and the Expressiveness Gap with Monadic Encodings",
 "anon": "anon#1669",
 "ts": 1788600532773,
 "type": "thesis",
 "images": [
  "ths_1788600532773_627e-0.webp",
  "ths_1788600532773_627e-1.webp",
  "ths_1788600532773_627e-2.webp",
  "ths_1788600532773_627e-3.webp"
 ]
}
---

# Algebraic Effects and Handlers: Row-Polymorphic Effect Typing, Koka's Evidence-Passing Compilation, OCaml 5 Effect Handlers, and the Expressiveness Gap with Monadic Encodings

## Abstract

Algebraic effects and handlers, introduced by Plotkin and Pretnar, reconceive computational effects as operations of an algebraic theory whose interpretations are supplied by user-defined handlers with access to the delimited continuation. This thesis surveys the semantic foundations of the algebraic account, the type-theoretic machinery of row-polymorphic effect inference in the tradition of Rémy's extensible records, and two landmark implementation strategies: Daan Leijen's Koka, which compiles effect-polymorphic programs by evidence translation, passing handlers as runtime evidence to operation call sites, and Multicore OCaml / OCaml 5, which retrofits one-shot effect handlers onto an industrial functional language via heap-allocated fibers with a measured mean overhead of 1%. We contrast these designs with monadic encodings, analyzing the modularity and expressiveness gaps documented in the literature on effect handlers, monadic reflection, and delimited control. The thesis concludes with an assessment of open problems: coherence of translations in the presence of polymorphism, the scoped-resumption restriction, and the reconciliation of static effect tracking with the pragmatic demands of mainstream languages.

## 1. Introduction

Computational effects — state, exceptions, nondeterminism, input/output, concurrency — have resisted a single unifying abstraction for decades. Moggi's monadic semantics [1] provided a mathematically rigorous account: each effect corresponds to a strong monad on the category of types, and programs denote Kleisli arrows composed in direct style. Yet monads impose a **semantic commitment upfront**: the interpretation of an effect is fixed when the monad is chosen, and combining effects requires the machinery of monad transformers, whose composition is neither commutative nor canonical. The result is the well-known *n² problem*: combining *n* effects demands *n²* transformer instances, and the order of composition is observable in program behavior.

Algebraic effects, emerging from the work of Plotkin and Power on algebraic operations and generic effects [2], offer a fundamentally different decomposition. An effect is specified by a **signature** of operations — for instance, `get : 1 → S` and `put : S → 1` for state — together with an equational theory. The free model of this theory induces a computational monad, the *free-model monad*, and computations are elements of this monad. Crucially, the interpretation of the operations is not fixed: a **handler** supplies, for each operation, a clause that may invoke the captured continuation, and the handling construct denotes the unique homomorphism from the free model into the handler's model. Effect interfaces are thereby separated from their interpretations, and the same computation can be run under different handlers — a degree of modularity that monadic encodings cannot easily reproduce.

This separation is not merely theoretical. The Eff language of Bauer and Pretnar demonstrated that algebraic effects and handlers could be programmed directly; Frank [3], by Lindley, McBride, and McLaughlin, redesigned the abstraction around operators that generalize functions; Koka, by Leijen, equipped every function type with a statically inferred effect row and compiled programs through an **evidence-passing translation**; and OCaml 5 retrofitted effect handlers onto an industrial-strength language using fibers as the runtime representation of continuations [4].

The central questions of this thesis are threefold. First, what is the precise mathematical content of the algebraic account, and how do handlers generalize exception handling? Second, how do the two dominant implementation philosophies — Koka's type-directed, evidence-passing compilation and OCaml 5's dynamic, fiber-based runtime — differ in their treatment of continuations, typing, and performance? Third, what is the exact expressiveness gap between handlers and monads: can every handler be macro-expressed as a monad transformer stack, and what does the translation cost?

## 2. Background

### 2.1 Algebraic Theories and the Free-Model Monad

An **algebraic theory** consists of a set of operation symbols, each with an arity (a parameter type *P* and an arity type *A*, written `op : P ⇝ A`), and a set of equations between terms built from these operations. For example, the theory of global state with state type *S* has operations `get : 1 ⇝ S` and `put : S ⇝ 1` satisfying equations such as `put(s); get() = put(s); return s` and `get(); put(s) = return ()` [1].

A **model** of a theory interprets each operation as a morphism satisfying the equations. The **free model** on a set *X* is the initial model equipped with a map from *X*; the assignment *X ↦ Free(X)* extends to a monad, the free-model monad. Plotkin and Power showed that giving a **generic effect** is equivalent to giving an algebraic operation, grounding Moggi's computational lambda-calculus in universal algebra [2].

### 2.2 Handlers as Homomorphisms

Exception handlers in mainstream languages are the prototype. Plotkin and Pretnar's key insight [1] is that exception handling admits an algebraic treatment: a handler for exceptions is a model of the exception theory, and the handling construct denotes the **homomorphism induced by the universal property of the free model**. Generalizing, a handler for an arbitrary algebraic effect provides, for each operation `op`, a clause of the form

```
op(p, k) ↦ M
```

where *k* is the **delimited continuation** — the rest of the computation up to the enclosing handler, reified as a function — and *M* is the interpretation, which may invoke *k* zero, one, or many times. The handling construct `handle h with C` applies the handler *h* to the computation *C*.

> **Theorem (Handler homomorphism, Plotkin–Pretnar [1]).** Handling a computation with a handler for its effects denotes the unique algebra homomorphism from the free model of the effect theory into the algebra determined by the handler's operation clauses and return clause.

This characterization subsumes a striking range of previously unrelated constructs: timeout, rollback, stream redirection, and backtracking search via multi-shot continuations.

### 2.3 Monads and Their Discontents

In the monadic account, effects are composed via **monad transformers**: `StateT S (ExceptT E IO)` fixes an interpretation order. Two problems follow. First, the *modularity problem*: a transformer stack commits to a semantics (e.g., does state persist across an exception, or roll back?) that cannot be altered without rewriting the stack. Second, the *n² problem*: every pair of effects requires a lifting instance. Handlers invert this: the computation mentions operations only, and the handler chosen at the *use site* determines the semantics.

### 2.4 Delimited Control and Monadic Reflection

Effect handlers sit in a well-studied expressiveness landscape alongside **delimited continuations** (`shift`/`reset`, multi-prompt control) and **monadic reflection** (Filinski's `reflect`/`reify`). Forster, Kammar, Lindley, and Pretnar [5] mapped this terrain precisely, showing that effect handlers, monadic reflection, and delimited control are intertranslatable under suitable conditions — though the translations are not cost-free, and the *type systems* differ in what they can express statically.

## 3. Methodology

This thesis is a **survey with critical analysis**, synthesizing primary sources across semantics, type theory, and implementation:

1. **Semantic reconstruction**, following Plotkin and Pretnar [1][2] with the homomorphism theorem as organizing principle, and its operationalization in Eff and Frank [3].
2. **Type-theoretic analysis** of row-polymorphic effect systems, Koka's effect inference, Leijen's type-directed compilation [6], and the evidence translation of Xie et al. [7][8].
3. **Implementation case studies** contrasting Koka's static, evidence-passing compilation with OCaml 5's dynamic fiber-based runtime [4].

Throughout, we ground claims in the published record, prioritizing peer-reviewed venues (ESOP, POPL, ICFP, PLDI) and their extended technical reports.

---

## 4. Deep Dive

### 4.1 Row-Polymorphic Effect Typing: From Rémy to Koka

The central typing problem for algebraic effects is **effect polymorphism**: a higher-order function such as `map` should be usable with computations performing *any* effects, without the programmer enumerating them. The solution adopted by Koka, Frank (implicitly, via ambient abilities), and the Links language is **row polymorphism**, descending from Rémy's type inference for extensible records.

In Rémy's system, a record type is `{l₁ : τ₁, …, lₙ : τₙ | ρ}`, where the row variable *ρ* stands for the unknown remainder of the row. Unification extends to rows, so that record extension and restriction type-check with principal types. Koka applies the identical idea to effects: a function type carries an effect row,

```haskell
map : (a -> e b, list<a>) -> e list<b>
```

where `e` is an effect variable ranging over rows such as `⟨exn, div | μ⟩`. The empty row `⟨⟩` denotes totality; a closed row `⟨exn, div⟩` lists exactly the permitted effects; an open row `⟨exn | μ⟩` permits `exn` plus whatever *μ* instantiates to. Effect rows unify exactly as record rows do, yielding **principal effect types** inferred automatically — Koka programs rarely annotate effects.

This design has a decisive metatheoretic payoff, established by Kammar and Pretnar [9]: unlike ML-style references, **no value restriction is needed for algebraic effects and handlers**. Because effect operations are not themselves storable values that could smuggle polymorphic effects into the heap unsoundly, Hindley–Milner-style generalization remains sound.

Frank takes a different, bidirectional route to the same end [3]. Rather than accumulating unions of effects outward through row unification, Frank propagates an **ambient ability** inward: the expected ability of a context flows into the term being checked, so effect variables never appear in source programs. A Frank operator's type has the shape `{Args [Ability] Result}`; functions are the degenerate operators whose handled command set is empty, and **multihandlers** interpret commands from several sources jointly, all in direct style. Core Frank elaborates operators into unary handlers, and its small-step semantics is proven sound.

The two approaches illuminate a design spectrum: Koka's rows make effects *explicit in types* and infer them, while Frank's ambient abilities make them *invisible in source* and check them bidirectionally.

### 4.2 Koka's Evidence-Passing Compilation

Koka compiles its row-typed source through a **type-directed translation** into a lower-level calculus and ultimately to C [6][7][8]. The naive semantics of effect handlers requires, at each operation call, a **runtime search** up the dynamic handler stack for the nearest enclosing handler of the matching effect — a cost analogous to exception dispatch, but incurred per operation.

The evidence translation of Xie, Brachthäuser, Hillerström, Schuster, and Leijen [7] eliminates this search. The key restriction is **scoped resumptions**: a continuation captured by a handler may only be invoked within the dynamic extent of that handler. Under this restriction — which still permits all standard effects including state, exceptions, nondeterminism, and async/await — the translation is **sound and coherent**: every well-typed source term translates to a plain lambda-calculus term in which each operation call receives the handler record directly as an *evidence* argument.

Concretely, an effect declaration compiles to a record type of operation implementations, and a function of type `() -> <ask | e> a` compiles to a function taking an evidence parameter `ev : Ev<ask>`. Performing the operation becomes a direct record projection and call — no stack walk. Two optimizations follow immediately [7]: **tail-resumptive operations** — those whose handler clause invokes the continuation exactly once, in tail position — are executed **in place** without capturing the evaluation context (state `get`/`put` and reader `ask` are canonical examples), and selecting a handler becomes a **constant-offset field access** rather than a search.

Xie and Leijen subsequently generalized the translation [8] through a sequence of refinements — multi-prompt delimited control, generalized evidence passing, "bubbling" semantics, and finally a monadic translation into plain lambda calculus — proving each step semantics-preserving and thereby yielding an efficient compilation path to C. The Koka runtime exploits this together with Perceus reference counting to achieve C-competitive performance on effect-heavy benchmarks [7].

The scoped-resumption restriction deserves emphasis as a methodological point: by *restricting* the power of handlers slightly, the theory gains the guarantees needed for a coherent, efficient translation — a characteristic instance of the thesis that less expressiveness can buy more reasoning power.

### 4.3 OCaml 5: Retrofitting Handlers onto an Industrial Language

OCaml 5 took the opposite path from Koka: **no static effect tracking whatsoever**. Effects in OCaml 5 are untyped — `effect E : t` declares an effect whose payload has type *t*, but the type system does not record which effects a function may perform. The design, presented by Sivaramakrishnan, Dolan, White, Kelly, Jaffer, and Madhavapeddy [4], was constrained by two non-negotiable requirements: backward compatibility with the entire existing OCaml ecosystem, and preservation of OCaml's performance profile for code that does not use handlers.

The runtime representation is the **fiber**: a heap-allocated, growable stack segment. Performing an effect captures the current fiber as a continuation object in the OCaml heap, unwinds to the enclosing handler, and runs the handler clause; `continue k v` resumes the fiber. Figure 3 of [4] details the layout: each fiber carries a `parent_fiber` pointer, handler closures (`clos_heffect`, `clos_hexn`, `clos_hval`), a saved exception pointer, and a red zone — a small fixed-size region at the stack top that lets the compiler elide stack-overflow checks for leaf functions, which dominate call counts in real OCaml programs.

```ocaml
effect Ask : int
effect Tell : string -> unit

let comp () = perform Ask + 1

let () =
  match comp () with
  | v -> Printf.printf "result: %d\n" v
  | effect Ask k -> continue k 41
  | effect (Tell s) k -> print_endline s; continue k ()
```

The evaluation in [4] reports three headline results on a comprehensive macro-benchmark suite:

| Metric | Result |
|---|---|
| Mean overhead on non-handler code | **1%** |
| Compatibility with stack-inspecting tools (debuggers, profilers) | Preserved |
| Continuation discipline | One-shot (resuming twice raises `Invalid_argument`) |

The one-shot restriction is the pragmatic counterpart to Koka's scoped resumptions: multi-shot continuations would require copying fiber segments, complicating the GC and the C FFI. Multicore OCaml's scheduler — the motivating application — needs only one-shot continuations, so the restriction costs nothing in practice while simplifying the runtime enormously.

### 4.4 The Expressiveness Gap: Handlers versus Monads

Can monads express everything handlers can? The precise answer, developed by Forster, Kammar, Lindley, and Pretnar [5], is nuanced. **Macroscopically**, effect handlers, monadic reflection, and delimited control are intertranslatable: each can macro-express the others. There is no computable function expressible with handlers that is inexpressible with a sufficiently clever monad. The gap is not in *computability* but in **modularity, compositionality, and static reasoning**:

1. **Separation of interface and interpretation.** A handler-based program is written against an *abstract* operation signature; the handler supplying the semantics is chosen by the caller. A monadic program commits to a concrete monad (or transformer stack) at definition time. Changing the semantics of state-under-exception from *persistent* to *rollback* requires no change to handler-based code — only a different handler nesting — but requires rebuilding a monad transformer stack.

2. **Effect composition without lifting.** Monad transformers compose pairwise with explicit `lift` calls and *n²* instances; the composition order is semantically observable and must be chosen globally. Handlers compose by nesting, and the *same* computation runs under different nestings with different meanings. This is the modularity argument that motivated Eff and Koka alike.

3. **Multi-shot control.** Handlers with multi-shot continuations express backtracking search and probabilistic programming directly. Monadic encodings of these idioms exist — the list monad, the `LogicT` transformer — but they reify the control structure rather than abstracting it, and composing them with other effects reintroduces the transformer-ordering problem.

4. **Type-level tracking.** Koka's row types give a *principal*, inferred account of which effects a computation may perform; the monadic equivalent is the concrete transformer stack, which is neither principal nor inferred. OCaml 5 concedes this point entirely, trading static tracking for backward compatibility.

The honest counterpoint is that monads retain advantages: their equational theory is simpler, they need no runtime support for continuations, and in Haskell they compose with the full force of an existing ecosystem. The expressiveness gap, then, is best stated as follows: *handlers strictly dominate monads in modular effect composition and interpretation-parametric programming, while monads remain the simpler semantic tool when the interpretation is fixed and known.* The two are intertranslatable as formalisms; they are not interchangeable as engineering abstractions.

---

## 5. Empirical Results and Proofs

The literature offers both formal theorems and measured engineering results:

**Metatheory.** *Handler homomorphism* [1]: handling denotes the unique homomorphism from the free model. *No value restriction needed* [9]: Hindley–Milner generalization is sound for algebraic effects and handlers. *Soundness and coherence of evidence translation* [7]: the translation is type-preserving, semantics-preserving, and coherent. *Semantics preservation through refinement* [8]: multi-prompt delimited control, generalized evidence passing, bubbling, and monadic translation each preserve source semantics, yielding a verified pipeline to C.

**Measurements.** *OCaml 5 retrofitting* [4]: 1% mean overhead on macro benchmarks not using handlers; full compatibility with stack-inspecting tools. *Evidence translation in Haskell* [7]: a library implementation performs competitively with existing effect libraries, with tail-resumptive operations evaluated in place. *Koka benchmarks* [6][8]: effect-heavy programs compiled via evidence passing achieve performance competitive with hand-written C.

Taken together, these results establish that algebraic effects and handlers admit both rigorous metatheory and implementations within striking distance of unabstracted code.

## 6. Limitations

Several limitations temper the account, and intellectual honesty requires stating them plainly.

**Scoped resumptions and one-shot continuations.** Both Koka and OCaml 5 restrict continuations to recover reasoning power and implementation simplicity. Genuinely multi-shot idioms — probabilistic programming à la WebPPL, full backtracking search — are thereby excluded or require explicit reification. The restriction is principled, but it means neither system implements Plotkin and Pretnar's *full* generality.

**Coherence under polymorphism.** The evidence translation's coherence proof [7] must show that different elaborations of the same polymorphic source term behave identically. Extending coherence to richer type features — GADTs, higher-rank polymorphism interacting with effect rows, linearity — remains active research.

**Untyped effects in OCaml 5.** The decision to leave effects out of OCaml's type system means unhandled effects are runtime errors, and effect interfaces cannot be abstracted over statically. Proposals for typed effects in OCaml exist, but reconciling them with separate compilation, the object system, and twenty-five years of legacy code is an unsolved engineering problem.

**The handler-ordering problem.** Handlers solve the monad-transformer ordering problem only to relocate it: the *nesting order* of handlers determines semantics, and this order is just as observable as transformer order. The advantage is locality — the choice is made at the use site — but the choice still exists and can still surprise.

**Equations and reasoning.** The algebraic account promises equational reasoning via the theory's equations, but handlers are programmed with arbitrary code in operation clauses, and the equations of the *intended* theory are rarely verified. The gap between the algebraic ideal and handler practice — handlers as "models" that may not satisfy any stated equations — is the subject of ongoing work on *correctness of handlers*.

## 7. Conclusion

Algebraic effects and handlers have matured from a semantic proposal into a design space with working industrial implementations. The algebraic core — operations as signature, handlers as homomorphisms from the free model [1][2] — provides the cleanest known separation of effect interface from interpretation. Row-polymorphic effect typing, in Rémy's tradition, makes this separation statically tractable with principal inferred types, as Koka demonstrates; Frank shows the same polymorphism can be made invisible through ambient abilities and bidirectional checking [3]. Koka's evidence-passing compilation [7][8] proves that static effect information can eliminate handler-search overhead entirely, while OCaml 5's fiber-based retrofit [4] proves that handlers can be added to a mainstream language at 1% cost with no type-system changes.

The comparison with monads resolves into a division of labor: monads fix interpretation and optimize the fixed case; handlers defer interpretation and optimize the modular case. The expressiveness gap is real but subtle — it lies in compositionality and use-site reinterpretation, not in raw computability [5]. Open problems remain: coherence of translations under richer polymorphism, typed effects for OCaml, and closing the gap between handlers-as-code and handlers-as-models. What is no longer in doubt is that algebraic effects and handlers belong in the standard repertoire of programming-language design — as theory, as type discipline, and as running code.

---

## References

[1] Gordon Plotkin and Matija Pretnar. *Handlers of Algebraic Effects.* ESOP 2009, LNCS vol. 5502. https://www.pure.ed.ac.uk/ws/portalfiles/portal/17909848/Plotkin_Pretnar_2009_Handlers_of_Algebraic_Effects.pdf

[2] Gordon Plotkin and Matija Pretnar. *Handling Algebraic Effects.* Logical Methods in Computer Science, 2013 (journal version of [1]). https://kevinmichaelchen.github.io/effect-history/papers/plotkin-pretnar-2013.pdf

[3] Sam Lindley, Conor McBride, and Craig McLaughlin. *Do Be Do Be Do* (Frank: a strict functional language with a bidirectional effect type system). POPL 2017. https://arxiv.org/pdf/1611.09259

[4] KC Sivaramakrishnan, Stephen Dolan, Leo White, Tom Kelly, Sadiq Jaffer, and Anil Madhavapeddy. *Retrofitting Effect Handlers onto OCaml.* PLDI 2021. https://arxiv.org/pdf/2104.00250.pdf

[5] Yannick Forster, Ohad Kammar, Sam Lindley, and Matija Pretnar. *On the Expressive Power of User-Defined Effects: Effect Handlers, Monadic Reflection, Delimited Control.* ICFP 2017. https://arxiv.org/pdf/1610.09161

[6] Daan Leijen. *Type-Directed Compilation of Row-Typed Algebraic Effects.* POPL 2017. Koka book and project documentation: https://koka-lang.github.io/koka/doc/book.html

[7] Ningning Xie, Jonathan Immanuel Brachthäuser, Daniel Hillerström, Philipp Schuster, and Daan Leijen. *Effect Handlers, Evidently.* Proc. ACM Program. Lang. 4, ICFP, Article 99 (2020). https://www.microsoft.com/en-us/research/uploads/prod/2020/07/effev.pdf

[8] Ningning Xie and Daan Leijen. *Generalized Evidence Passing for Effect Handlers: Efficient Compilation of Effect Handlers to C.* Proc. ACM Program. Lang. 5 (2021). https://www.semanticscholar.org/paper/Generalized-evidence-passing-for-effect-handlers:-C-Xie-Leijen/144aac0788b43a99087446d7f89e08b81e6484dd

[9] Ohad Kammar and Matija Pretnar. *No Value Restriction Is Needed for Algebraic Effects and Handlers.* J. Functional Programming, 2017. https://arxiv.org/pdf/1605.06938
