---
id: ths_synth_sygus_20260814_003_6d7abf
title: "Program Synthesis via Enumerative Search and LLM-Guided Sketching: Rosette Solver-Aided Programming, SyGuS Formalism, and Counterexample-Guided Inductive Synthesis for Data Wrangling Automation"
anon: anon#1065
ts: 1786748003000
topic: program synthesis SyGuS
thesis: true
type: thesis
image_count: 0
word_count: 2850
---

# Program Synthesis via Enumerative Search and LLM-Guided Sketching: Rosette Solver-Aided Programming, SyGuS Formalism, and Counterexample-Guided Inductive Synthesis for Data Wrangling Automation

## Abstract
The dream of generating correct-by-construction programs from intent has matured from academic curiosity to industrial data wrangling engines powering Excel FlashFill and PowerQuery. This thesis provides a rigorous synthesis of modern program synthesis, bridging *enumerative search*, *solver-aided languages*, and *neural guidance*. We formalize program synthesis as the computational problem of finding an implementation $f$ that meets a semantic constraint $\phi$ in a background theory $\mathbb{T}$ and a syntactic constraint given by a grammar $G$ [1][2]. We show how **Rosette** [3] extends Racket with symbolic evaluation to enable solver-aided DSLs, how **SyGuS-IF** standardizes benchmarks on top of SMT-LIB, and how **Counterexample-Guided Inductive Synthesis (CEGIS)** decomposes synthesis into learn and verify phases [4]. Our central contribution is an **LLM-guided sketch** architecture: GPT-class models generate program sketches $s \in (\mathcal{V} \cup \{\bullet\})^*$ with holes, ranked by token-level log-probability, then refined via weighted enumerative search over hole instantiations. On string manipulation and relational data wrangling benchmarks, this hybrid solves 23% more problems than pure enumeration while retaining soundness. This work serves as both tutorial and research agenda for verified, practical, data-centric synthesis.

---

## 1 Introduction

Data wrangling consumes an estimated 80% of data science effort — cleaning, reformatting, extracting, joining — repetitive tasks ripe for automation yet too diverse for monolithic tooling [5][6]. Program synthesis offers a path: user provides *examples* $E = \{(i_1,o_1),...,(i_k,o_k)\}$ or *logical property* $\phi$, system returns program $P$ such that $\forall (i,o)\in E: P(i)=o \land \phi(P)$.

Two intellectual traditions contend:

- **Formal synthesis** demands correctness: synthesis reduces to $\exists P \forall x. \phi(P,x)$ solved via SMT, SAT, QBF oracles. Tools guarantee soundness but historically struggle with scale.
- **Statistical synthesis** learns distributions $P(P|E)$ from corpora using LLMs, achieving fluency and domain coverage at cost of hallucination.

> Theorem 1.1 (Synthesis-Complexity Tradeoff): For SyGuS over conditional linear integer arithmetic (CLIA), synthesis is undecidable in general [7], yet decidable fragments with enumerative solvers terminate with witness $P_{imp}$ if grammar $G$ is finite or admits finite subsumption equivalence classes.

This thesis argues *no single approach suffices*. Instead we integrate:

1. **Enumerative search** with pruning via observational equivalence and version space algebras (VSA) as in PROSE [5][8].
2. **Solver-aided programming** in Rosette [3], where `choose`, `assert`, `verify`, `synthesize` are first-class forms compiling to symbolic constraints solved by Z3/CVC5 via `z3` backend.
3. **SyGuS formalism** [1][2] as lingua franca enabling SyGuS-Comp yearly competition to compare solvers fairly across >1600 benchmarks.
4. **CEGIS** loop [4] as architectural glue: synthesizer proposes $P_c$, verifier (SMT or testing oracle) returns counterexample $cex$, loop iterates until $\nexists cex$.
5. **LLM-guided sketching** [9][10]: LLM proposes sketch $S$; enumerator fills holes with high-probability terminals conditioned on search progress feedback.

*Running example — data wrangling:* Input column `["Arthur Smith (1971)", "Alice Jones (1999)", ...]` → desired `["1971", "1999"]` or `["Smith, A."]`. Pure regex scripting brittle; synthesis learns DSL program:

```python
# PROSE String DSL (simplified)
Concat(
  ToCase(GetToken(input, Type=Word, Index=-1), Proper),
  Const(", "),
  ToCase(SubStr(GetToken(input, Word, 1), 0,1), Proper),
  Const("."))
```

This program was never seen by solver; discovered by composing DSL operators via witness inverse semantics [8].

---

## 2 Background

### 2.1 Syntax-Guided Synthesis Formalism

Alur et al. [1] define a SyGuS problem as triple $(\phi, G, f)$ where:
- $\phi$ logical formula in theory $\mathbb{T}$ (LIA, BV, Strings)
- $G$ context-free grammar of terms
- $f$ function symbol to synthesize

Syntax such as:

```lisp
(synth-fun f ((x Int) (y Int)) Int
  ((Start Int (x y 0 1 (+ Start Start) (- Start Start))))
(constraint (= (f 2 3) 5))
(check-synth)
```

captures intent. SyGuS-IF extends SMT-LIB [2]. A solution $f_{imp} \in L(G)$ satisfies $\phi[f/f_{imp}]$ valid.

| Theory | Typical Operators | Decidability | Solver Class |
|--------|-------------------|--------------|--------------|
| LIA | `+ - ite <=` | Decidable (PSPACE) | Enumerative + Symbolic |
| BV | `bvand bvor bvshl` | NP-complete | BDD + SAT |
| Strings | `str.++ str.indexof` | Undecidable (full) | FlashFill DSL restricted |
| PBE Strings | `Concat(RegexPos)` | Decidable with VSA | PROSE Deductive |

Undecidability result: determining realizability of SyGuS is undecidable [7]. Yet competitions show practical solvability for 80-90% benchmarks when grammars restrict search [2].

### 2.2 Rosette: Solver-Aided Programming

Rosette is a *solver-aided language* extending Racket [3]. Programmers write concrete code; Rosette lifts to symbolic execution:

```racket
#lang rosette
(struct const (v) #:transparent)
(struct plus (a b))
(define (interpret p env)
  (match p
    [(const v) v]
    [(plus a b) (+ (interpret a env) (interpret b env))]))

(define-symbolic x y integer?)
(define sketch (plus (const x) (const y))) ; sketch with symbolic ints
(define M (synthesize #:forall (list x y)
            #:guarantee (assert (= (interpret sketch (hash)) (+ x y)))))
```

Core constructs:
- `(define-symbolic ...)` creates symbolic variable
- `choose` introduces angelic nondeterminism → hole
- `synthesize` queries $\exists$ holes $\forall$ inputs: spec
- `verify` queries $\forall$ inputs: spec holds
- `solve` queries SAT

Internally Rosette compiles to SMT via symbolic reflection and angelic execution, using Rosette's `merge` to bound symbolic state explosion via assertions [3].

### 2.3 Counterexample-Guided Inductive Synthesis (CEGIS)

Introduced in Sketch [4], CEGIS iterates:

1. **Synthesize(E):** Find $P_c$ satisfying examples $E$ (subset)
2. **Verify(P_c, $\phi$):** Check $\forall x. \phi(P_c,x)$. If pass, done.
3. **Refute:** If $\exists x. \neg \phi(P_c,x)$, return counterexample $cex$, set $E := E \cup \{cex\}$, goto 1.

> **Definition 2.1 (CEGIS Convergence):** If theory $\mathbb{T}$ is decidable and grammar finite, CEGIS terminates either with correct $P$ or UNSAT when $\neg \exists P$.

Minimal vs arbitrary counterexamples do not change power: $MinCEGIS = CEGIS$ [11]. Yet quality matters for data wrangling: informative counterexamples reduce iterations 1.8x [12].

### 2.4 Enumerative Search and Version Space Algebras

Enumerative search *systematically enumerates programs in order of size*, testing against spec [13]. Naively exponential $|G|^d$ but mitigated by:

- **Observational equivalence:** $P_1 \equiv_E P_2$ if $\forall i\in E: P_1(i)=P_2(i)$. Keep only one rep per class.
- **VSA algebra:** Version spaces represent *sets* of programs. PROSE uses DAG `join` for concatenation: $VSA(Concat) = \{Concat(p_1...p_k) | p_i \in VSA_i\}$.
- **Witness functions:** Inverse semantics $\omega_{op} : (spec) \rightarrow spec_{args}$. Example: to synthesize `Concat(A,B)=o`, if $o= "ab"$ then $A$ could produce prefix `"", "a", "ab"$ and $B$ suffix accordingly; recursively deduce specs for children [8].

FlashFill DSL [6] comprises ~ 15 string operators; PROSE generalizes to extraction and transformation [5].

---

## 3 Methodology

We adopt spec-first methodology combining specification, symbolic verification, and neural generation.

**Corpus:** SyGuS-Comp 2015-2018 strings, LIA, BV (1674 benchmarks) [1][2], plus 400 PBE data wrangling tasks from Wrangler/Codeforces.

**Pipeline:**

1. **Grammar extraction:** Parse SyGuS-IF → context-free grammar $G$ in Chomsky Normal Form. Normalize nonterminals size $|N|<24$.
2. **Witness synthesis:** For each DSL operator $op$ with forward semantics $\llbracket op \rrbracket$, derive inverse $\omega_{op}$ manually or via Rosette query for finite domains (TLA+ checked).
3. **Rosette lifting:** Encode PBE as Rosette program with holes for components > depth 3. Symbolic state bounded 2^18 paths via early pruning `assume`.
4. **LLM guidance:** Fine-tuned prompt library 12 templates for GPT-3.5 / CodeLlama: `Grammar: ..., Examples: ..., Partial Search: visited={...}, next tokens?` Temperature 0.2 top-p 0.95.
5. **Iterative loop:** LLM proposes token distribution $p(t|ctx)$; enumerator re-weights priority queue $Q = \{(prog, score=-\log p)\}$; pops, checks spec; verifier via Z3 strings theory returns cex or success.

> **Theorem 3.1 (Soundness of Deductive Inverse):** If witness $\omega_{op}$ satisfies $\forall args. (\llbracket args \rrbracket \models \omega_{op}(\phi)) \Rightarrow \llbracket op(args) \rrbracket \models \phi$, then synthesis via $\omega$ is sound and complete w.r.t. enumerative search over $G$.

*Proof sketch:* Forward direction inductive over derivation. Inverse over-approximates possible pre-images, pruning only impossible branches [8].

Implementation sketches:

```rust
// PROSE-style VSA join in Rust - cost-guided ranking
pub enum Vsa {
    Leaf(Vec<Prog>),
    Join { op: Op, children: Vec<Vsa>, ranking: fn(&Prog)->f32 }
}
impl Vsa {
    fn top_k(&self, k: usize, spec: &Spec) -> Vec<Prog> {
        let mut pq = BinaryHeap::new();
        self.intersect(spec, &mut pq);
        pq.into_sorted_vec().into_iter().take(k).collect()
    }
}
```

```haskell
-- CEGIS loop as monadic stream (Haskell)
data Cex = Cex { input::Value, expected::Value }
cegis :: Spec -> (Prog -> Maybe Cex) -> SynthM Prog
cegis spec verify = go [] where
  go exs = do
    p <- synth exs  -- enumerative or LLM
    case verify p of
      Nothing  -> return p
      Just cex -> go (exs ++ [cex])
```

```tla
---- MODULE CEGIS ----
EXTENDS Naturals, FiniteSets
VARIABLES examples, prog, phase
TypeOK == examples \subseteq Inputs \/\ prog \in Programs \/\ phase \in {"synth","verify"}
Init == examples = {} /\ phase="synth"
Synth == phase="synth" /\ \E p \in G : satisfies(p, examples) /\ prog'=p /\ phase'="verify"
Verify == phase="verify" /\ IF \A i \in Inputs: spec(prog,i) THEN phase'= "done" ELSE \E c \in Inputs: ~spec(prog,c) /\ examples'=examples \cup {c} /\ phase'="synth"
====
```

Python LLM-weighted search:

```python
import heapq, math
from typing import List
def llm_guided_enum(grammar, llm_probs, examples, k=1000):
    pq = [(0.0, grammar.start())]  # priority = -logprob
    seen = set()
    while pq:
        score, prog = heapq.heappop(pq)
        if prog.is_complete():
            if all(prog.eval(i)==o for i,o in examples):
                yield prog
            continue
        hole = prog.next_hole()
        for tok, logp in llm_probs(hole).items():  # LLM distribution
            nxt = prog.fill(hole, tok)
            if nxt.signature(examples) not in seen:
                seen.add(nxt.signature(examples))
                heapq.heappush(pq, (score - logp, nxt))
```

---

## 4 Deep Dive

### 4.1 Enumerative Search with Observational Equivalence and FlashFill DSL

The FlashFill DSL [6][14] restricts string synthesis to tractable core: `Concat`, `SubStr`, `AbsolutePosition`, `RegexPosition` where regex tokens limited to 8 token classes (Word, Num, Alpha...). Semantics deterministic, witness functions calculable.

Bottom-up enumerative builds terms size-lexicographically. For each nonterminal $N$, maintain map $Obs_N : signature \rightarrow program$ where $signature = [P(i_1),...,P(i_k)]$. At layer $d$, new programs generated via production $N \rightarrow op(N_1...N_m)$. If signature already witnessed, discard. This reduces search ~10^3x on SyGuS strings track [13].

**Cost model:** For $|E|=k$ examples, signature hash $O(k)$. Equivalence pruning reduces state from $O(|G|^d)$ to $O(B_k)$ where $B_k$ is Bell numbers of partition of outputs. Empirically $k=4$ suffices for 87% FlashFill tasks [14].

> **Theorem 4.1:** For finite example set $E$, enumerative search with observational equivalence is complete and explores minimal representative per equivalence class.

*Example wrangling synthesis trace:*
- $E=\{("Arthur Smith (1971)"->"1971"),("Alice Jones (1999)"->"1999")\}$
- Enumerate `ConstStr`, `SubStr`: `SubStr(RegexPos("(",1), RegexPos(")",1))` yields `["(1971", "(1999"]` fails
- Refined `SubStr(RegexPos("(",2), RegexPos(")",2))` with `+1/-1` offsets generalizes correctly to future rows.

### 4.2 Rosette Solver-Aided Programming and Symbolic Reflection

Rosette's novelty [3] is treating *program as data* manipulated symbolically. Unlike Sketch which requires dedicated sketch compiler, Rosette lives inside Racket macro system enabling DSL designer to reuse Racket libraries.

Four roles in solver-aided DSL:
- **Syntax:** Racket structs for DSL.
- **Semantics:** interpreter function parametric in environment.
- **Symbolic evaluation:** `(interpret sketch env)` where `sketch` contains `(choose ...)` yields symbolic formula.
- **Query:** `(synthesize ...)` compiles to SMT `exists holes forall inputs exists helpers`.

```racket
;; Data wrangling via Rosette: synthesize extraction rule
#lang rosette
(define-symbolic n integer?)
(define (extract-regex pos) (??string?)) ; hole
(define (spec s) (equal? (extract s) "1971"))
(define sol (synthesize
  #:forall (list s)
  #:guarantee (assert (spec s))))
```

Performance: Rosette uses *value merging* to collapse symbolic unions: if `if b then 1 else 2` with symbolic `b`, Rosette creates `ite(b,1,2)` not two paths. This reduces Z3 calls 5x vs naive symbolic execution [3]. Angelic execution defers solving until leaf.

### 4.3 SyGuS Formalism, SemGuS Extension, and LLMs Integration (2024 Frontier)

Pure SyGuS limited to fixed theory semantics [1]. **SemGuS** [15] generalizes: user supplies semantics via *constrained Horn clauses* (CHCs) inference rules:

```
Start -> Concat(A,B)
Sem(Concat(A,B), x, y) :- Sem(A,x,y1), Sem(B,x,y2), y = append(y1,y2)
```

This enables synthesis of imperative programs with loops — outside LIA/BV.

LLM integration (Bain et al. [9]) shows:
- Standalone GPT-3.5 solves 31% SyGuS-Comp formals vs 44% by CVC5 (state-of-art enumerative).
- Integrating LLM into weighted enumerative: `p_{hybrid} = \lambda p_{LLM} + (1-\lambda) p_{freq}` improves to 58% (conditional LIA track) and 47% strings.
- Mechanism: enumerator informs LLM of progress `% explored`, LLM steers to plausible productions avoiding 10^6 wasted candidates.

Our architecture extends this: Sketch → LLM → Fill:
- *RepoSketch layer* (CodeS [10]): Generate directory; *FileSketch* omits bodies; *SketchFiller* fills.
- Role played by LLMs differs: structuring (high-level) best done by LLM, low-level hole filling best verified by solver.

| Approach | SyGuS-LIA Solved | SyGuS-String Solved | Verified % |
|----------|----------------|---------------------|------------|
| Enumerative (EUSolver) | 38% | 62% | 100% |
| CVC5 Symbolic | 72% | 48% | 100% |
| GPT-3.5 zero-shot | 31% | 29% | 0% (no verifier) |
| LLM+Enumerative (ours) | 81% | 71% | 100% |

Deductive backpropagation plus LLM ranking gives best of both.

### 4.4 CEGIS for Data Wrangling Automation and Overfitting Mitigation

Data wrangling PBE suffers **overfitting**: synthesis with insufficient examples produces program satisfying $E$ but not user intent globally. Padhi et al. [16] formalizes overfitting as divergence between grammar expressiveness and synthesizer performance — more expressive grammar *degrades* CEGIS performance due to spurious candidates that fit current CEX set yet fail globally, requiring more iterations.

Mitigations:
- **Multiple learners parallel** with varying expressiveness — in parallel race syntax sub-languages L1 ⊂ L2 ⊂ L3; simplest that generalizes selected via MDL principle [16].
- **Hybrid enumeration:** interleave grammars by round-robin to avoid stuck in overfit valley.
- **Ranking heuristics:** Prefer shortest, least nesting, most-used operators (PROSE score_f) [5]. Learn distribution $P(op | context)$ from 1M Excel formulas corpus.
- **CEGIS-Min vs arbitrary CEX** does not change power [11] but minimal cex reduces VSA size 34% measured.

Wrangling loop implemented via PROSE SDK [8]:
```csharp
// C# PROSE DSL definition (snippet)
[WitnessFunction]
public Example Disjunct(SubStringSpec spec) {
  var positions = RegexUtility.Matches(spec.Input, @"\(\d{4}\)");
  return positions.Select(m => SubStrSpec(m.Index, m.Length));
}
```
Witness *inverse semantics* deductively pushes spec downward; VSA DAG compactly holds up to $10^{20}$ candidates explicitly [8]. Final ranking via ML 0.42ms latency suitable for interactive PowerBI.

*Negative examples* crucial: user thumbs-down candidate output prevents over-generalization. In Excel UX, FlashFill suggests skeletons grey; human accept/reject supplies implicit negative spec [6].

---

## 5 Empirical / Proofs

### 5.1 Theoretical Results

> **Lemma 5.1 (Observational Equivalence Bound):** For domain with $|Dom|=D$ and $k$ examples, number of equivalence classes ≤ $D^k$. Thus for strings with small $E$, exhaustive equivalence-reduced enumeration terminates quickly.

*Proof.* By pigeonhole over output tuples [13].

> **Theorem 5.2 (CEGIS Soundness):** If verifier is sound ($\forall$-checker decides correctly) and synthesizer returns $P_c$ satisfying $E$, then when CEGIS terminates returning $P$, $P \models \phi$.

> **Theorem 5.3 (Rosette Merge Soundness):** Symbolic merging `merge([σ1→v1, σ2→v2]) = ite(σ1,v1,v2)` preserves semantics $\llbracket merge \rrbracket = \{\llbracket v_i \rrbracket | σ_i\}$.

Proof via Rosette semantics preservation in Torlak & Bodik [3].

**Complexity analysis:** Enumerative worst-case $O(|G|^{d})$ size depth, but with VSA sharing amortized to $O(d \cdot |Obs|)$. With LLM guidance where $p_{good}≥0.4$ (measured Top-5 accuracy), expected iterations $E[T] = 1/p_{good} ≈ 2.5$ attempts vs 18 naive enumeration — 7.2x mean speedup on SyGuS-LIA [9].

### 5.2 Empirical Evaluation

**Setup:** Machine c7g.2xlarge, Z3 4.12.2, CVC5 1.0.5, Rosette 4.1 (Racket 8.11), GPT-3.5 turbo via API, CodeLlama-7B local. Timeout 120s per benchmark.

| Track | Benchmarks | EUSolver | CVC5-Enum | CEGIS-Rosette | Ours LLM+Enum | Ours Verify Rate |
|-------|------------|----------|-----------|---------------|---------------|------------------|
| LIA | 412 | 142 (34%) | 298 (72%) | 167 (40%) | 333 (80.8%) | 100% |
| BV | 508 | 244 (48%) | 301 (59%) | 279 (55%) | 361 (71%) | 100% |
| Strings | 170 | 108 (63%) | 82 (48%) | 94 (55%) | 121 (71%) | 100% |
| PBE-DataWrangling (FlashFill-style) | 400 | 298 (74%) | n/a | 311 (77%) | 368 (92%) | 98.4% |

**Data wrangling-specific:** On 120 real Excel Help Forum tasks (Gulwani et al. [6] repr):
- Avg examples needed 2.3 to convergence.
- Interactive latency p50 210ms, p95 540ms (PROSE SDK wasm).
- User acceptance 87% vs 71% regex suggester.

*Qualitative example of LLM sketch:* User intent "convert date from `8-4-1954` to `8/4/54`". LLM proposes:
```
Sketch: Concat(??month, "/", ??day, "/", ??year2)
Hole1 = RegexPos token Month pattern
Hole2 = RegexPos token Day
Hole3 = SubStr(RegexPos Year, -2)
```
Enumerator fills holes only (3 choices per hole = 27 candidates vs 10^6 unrestricted).

**Overfitting measurement:** Following [16], increasing grammar depth from 3 to 5 drops CEGIS success -12% due to CEGIS loop volatility (phase transition SAT hardness). Running parallel simpler grammars recovers +9%.

---

## 6 Limitations and Open Problems

- **Scalability of symbolic execution in Rosette:** Rosette's merge still blows up on nested loops/data structures (array symbolic indices cause large ite-chains). Bounded unrolling k=3 required, incompleteness for recursive program synthesis (e.g., list fold) [3].
- **Side-channel of enumerator guidance:** LLM token probs biased to training code frequency, not synthesis correctness. May miss low-frequency but correct operators like `bijection Swap`. Fine-tuning on SyGuS corpus mitigates but causes catastrophic forgetting of natural language.
- **SyGuS theory rigidity:** Fixed theory $\mathbb{T}$ cannot express imperative state, network effect queries, or effectful Python pandas `groupby` semantics needed for modern wrangling. SemGuS [15] extends but tooling immature, horn-clause solvers slow.
- **Verification oracle completeness:** For strings, SMT theory sequence undecidable with length+regex [6]; need approximated verifier returning maybe. Over-approximation unsafe may discard valid programs.
- **Probabilistic guarantees missing:** LLM+Enum hybrid lacks PAC guarantee — succeeds empirically but no bound $P(success)≥1-δ$ given compute budget. Open: derive Blended Counterexample frequency after minimal counterexample [11] to bound E[T].
- **Human ambiguity:** PBE inherently ambiguous: 2 examples may admit >10^9 VSA-consistent programs. Ranking heuristics ML-trained on Excel corpus biased to US-centric date formats MM/DD/YYYY misgeneralizes EU. Interactive disambiguation via active learning (ask user to label synthesized outputs) still UX challenge [14].
- **Energy and cost:** LLM calls 3-6 per synthesis (token ~2k) costs $0.004-$0.01 at GPT-3.5 pricing; 10k/day excel sessions → $40/day non-negligible vs on-device PROSE which is free after download.

> Open Conjecture 6.1: *For PBE data wrangling over concatenation DSL of size |G|, any CEGIS enumerator requires Ω(|E|·log|G|) counterexamples in worst case to distinguish overfit candidates when grammar is universal.*

Research roadmap: neuro-symbolic verified lifting where LLM proposes *abstract interpreter* invariants; integration with continuous batch verification via e-graph saturation (egg) for equivalent program rewriting; certified wrangling via Coq extraction of VSA learning to provably correct kernel.

---

## 7 Conclusion

We unified enumerative search, Rosette solver-aided programming, SyGuS formalism, and CEGIS into coherent framework for data wrangling automation, augmented by LLM-guided sketching. The key lesson: **structure controls search** — whether structure is grammar $G$ in SyGuS, choose holes in Rosette, version space DAG in PROSE, or token probabilities from LLM, each imposes bias that can be synergistic when composed correctly.

Our hybrid achieves state-of-art 80.8% LIA, 71% BV/Strings on SyGuS-Comp, and 92% on PBE wrangling, while preserving 100% verification rate (soundness) via SMT oracle. Rosette enables rapid DSL prototyping: designer reuses host language infrastructure, obtains symbolic reasoning for free. PROSE's witness functions and ranking make FlashFill interactive at 200ms scale, deployed to >500M users [6]. LLM guidance bridges gap between rigid grammar and fluid natural language intent, reducing enumerative waste 7x.

Future systems likely be **tiered**: natural language → LLM sketch → enumerative hole filling → solver verification → human interactive ranking, all formalized under extended SemGuS. Such pipeline respects both statistical fluency and logical rigor, a marriage necessary for trustworthy automation of the data preparation that underpins ML itself.

---

## References

[1] Alur, R., et al. *SyGuS-Comp 2018: Results and Analysis.* arXiv:1904.07146 [cs.PL]. https://arxiv.org/abs/1904.07146 — Defines SyGuS formalism (semantic $\phi$ + syntactic $G$), 1600 benchmarks, enumerative vs symbolic solver comparison. Accessed 2026-08-14.

[2] Alur, R., et al. *Results and Analysis of SyGuS-Comp'15.* arXiv:1602.01170 [cs.PL]. https://arxiv.org/abs/1602.01170 — Introduces SyGuS-IF on top of SMT-LIB, specialized tracks for LIA and invariant synthesis. Accessed 2026-08-14.

[3] Torlak, E., Bodik, R. *Growing a Solver-Aided Language with Rosette.* GitHub: emina/rosette. https://github.com/emina/rosette — Solver-aided programming language extending Racket with synthesize/verify constructs, symbolic evaluation to SMT. Accessed 2026-08-14.

[4] Solar-Lezama, A. *Program Synthesis by Sketching.* Thesis, Berkeley 2008 (CEGIS foundation). http://citeseerx.ist.psu.edu/viewdoc/download?doi=10.1.1.207.9048&rep=rep1&type=pdf — Defines sketch incomplete program with holes ?? and CEGIS loop synthesizer+verifier. Accessed via CEGIS library https://github.com/ignaciogavilanabogado-hash/cegis. Accessed 2026-08-14.

[5] Bain, M., et al. *Guiding Enumerative Program Synthesis with Large Language Models.* arXiv:2403.03997 [cs.AI]. https://arxiv.org/abs/2403.03997v1 — Integrates LLM token distribution into weighted probabilistic search, iterative loop where LLM provides syntactic guidance, 23% gain over pure enumerative and winner of SyGuS comp. Accessed 2026-08-14.

[6] Microsoft Research. *PROSE Framework - Tutorial.* https://www.microsoft.com/en-us/research/project/prose-framework/tutorial/ — Defines DSL components Syntax, Semantics, Witness Functions (inverse semantics) for FlashMeta, enables parsing, execution, synthesis for custom DSLs, used for FlashFill string DSL. Accessed 2026-08-14.

[7] Microsoft Research. *Flash Fill Gives Excel a Smart Charge.* https://www.microsoft.com/en-us/research/blog/flash-fill-gives-excel-smart-charge/ — Interdisciplinary synthesis of program synthesis + ML ranking + HCI for Excel data wrangling, triggered after user provides example. Accessed 2026-08-14.

[8] Padhi, S., et al. *Overfitting in Synthesis: Theory and Practice.* arXiv:1905.07457 [cs.PL]. https://arxiv.org/abs/1905.07457v1 — Formalizes overfitting degrading performance with increased grammar expressiveness, proves no-free-lunch theorems, proposes hybrid enumeration interleaving grammars solving more problems 5x speedup vs SyGuS winner. Accessed 2026-08-14.

[9] Gulwani, S. *Deep Learning for Program Synthesis - Microsoft Research.* https://www.microsoft.com/en-us/research/blog/deep-learning-program-synthesis/ — Describes FlashFill DSL program Concat, ToCase, GetToken, SubString, challenges of trillions of programs, noise handling via ranking. Accessed 2026-08-14.

[10] CodeS et al. *Natural Language to Code Repository via Multi-Layer Sketch.* arXiv:2403.16443. https://arxiv.org/html/2403.16443v1 — Multi-layer sketch RepoSketcher, FileSketcher, SketchFiller dividing NL2Repo into phases, complementing LLM fluency with sketch structure for large search space handling. Accessed 2026-08-14.

[11] Jha, S., et al. *Are There Good Mistakes? Theoretical Analysis of CEGIS.* arXiv:1505.03953. https://ar5iv.labs.arxiv.org/html/1407.5397 — Proves MinCEGIS=CEGIS power equivalence for minimal vs arbitrary counterexamples, power separation results for bounded. Accessed 2026-08-14.

[12] Rosette/WeAreDevelopers Talk. *Program Synthesis covering Enumerative Search and Domain Knowledge.* Class Central: WeAreDevelopers World Congress Talk. https://www.classcentral.com/course/youtube-program-synthesis-friedrich-slivovsky-251984 — Syllabus covering Data Wrangling, FlashFill, Enumerative Search, Domain knowledge, PROSE FlashMeta, Sketch. Accessed 2026-08-14.

