---
id: superoptimization-egraphs-d1c5
title: "Superoptimization and Equality Saturation: Stochastic Search in STOKE, Harvesting with Souper, and E-Graph Rewriting for Peephole Optimization"
anon: anon#2084
ts: 1788893404000
type: thesis
---

# Superoptimization and Equality Saturation: Stochastic Search in STOKE, Harvesting with Souper, and E-Graph Rewriting for Peephole Optimization

## Abstract

Peephole optimization — replacing a small window of instructions with a cheaper, equivalent sequence — is the most error-prone corner of a compiler backend, and the most rewarding: a single missed identity wastes cycles on every execution. This thesis traces how the field moved from *searching harder* to *searching smarter* and finally to *searching correctly*. It begins with Massalin's 1987 superoptimizer, which exhaustively enumerated instruction sequences to find the provably shortest program, and follows the idea through Bansal and Aiken's automatic peephole synthesis, the stochastic Markov-chain Monte Carlo search of Schkufza, Sharma, and Aiken's STOKE, and the harvest-and-synthesize pipeline of Sasnauskas et al.'s Souper for LLVM IR. In parallel, it develops the equality-saturation program: Tate, Stepp, Tatlock, and Lerner's e-graph-based optimizer that defeats the phase-ordering problem by representing *all* equivalent programs simultaneously, its modern high-performance incarnation in Willsey et al.'s *egg*, and the automated discovery of the rewrite rules themselves by Nandi et al.'s Ruler. The thread closes on correctness: Lopes et al.'s Alive and its successor Alive2, which turn peephole patterns into SMT-checked refinement obligations, and CompCert's verified validators, which show what full machine-checked assurance costs. The result is a unified account of how synthesis, search, and verification converged on the peephole.

---

## 1. Introduction

A compiler is a pipeline of bets. Each pass wagers that its transformation improves the program; the *phase-ordering problem* is that these bets interact: an optimization enabled by pass *A* may be destroyed by pass *B*, and no fixed ordering of passes is best for all programs [4]. Peephole optimizers sit at the end of this pipeline, where mistakes are most expensive: they rewrite tiny instruction windows — two to six instructions — so a single wrong rewrite corrupts the entire program, while a missed identity taxes every execution.

The historical response to this difficulty has been *superoptimization*: rather than hand-writing pattern-matching rules, find the optimal replacement by searching the space of all programs. Henry Massalin's 1987 system enumerated instruction sequences in order of increasing length and tested each for equivalence with the target, yielding programs that were optimal by construction — albeit only for programs of a handful of instructions [1]. The idea was intoxicating and impractical in equal measure: the search space grows exponentially in sequence length, so exhaustive search collapses beyond toy kernels.

Three decades of research attacked this wall from three directions, and this thesis is organized around them: **better search** (stochastic MCMC in STOKE [2], enumerative synthesis with SMT pruning in Souper [3]); **better representation** (equality saturation over e-graphs holding every equivalent program at once [4], made fast and extensible by *egg* [5]); and **automated rules and proofs** (rule inference in Ruler [6], SMT refinement checking in Alive [7], mechanized proof in CompCert [8]).

The central claim is that these are not three separate stories but one: a convergence in which the optimizer is simultaneously a *synthesizer* (it discovers new code), a *searcher* (it explores an enormous space), and a *verifier* (it certifies what it found).

![STOKE's stochastic search over instruction sequences](/thesis/superoptimization-egraphs-d1c5-0.webp)

## 2. Background

### 2.1 Massalin's superoptimizer and the cost of exhaustiveness

Massalin [1] framed compilation of a straight-line kernel as a *search problem*: given a specification *f* over machine states, enumerate all instruction sequences of length 0, 1, 2, … and test each for equivalence until one implements *f*. The first found is the shortest possible — optimal by construction, famously yielding non-obvious bit-level identities such as compact signum implementations. The method's brilliance and limitation are the same: it is complete but exponential. Bansal and Aiken [9] relaxed the goal from "shortest program" to "better than the compiler," introducing *peephole superoptimizers* generated automatically from a processor description. Their key insight was *generalization by fingerprinting*: concrete superoptimized instances were abstracted into reusable rules by observing which parts of the rewrite were essential.

### 2.2 Congruence closure and e-graphs

Independently, the theorem-proving community had built the data structure that would unlock the second direction. Nelson and Oppen's congruence closure algorithm [10] maintains a partition of terms into equivalence classes closed under congruence: if *a ≡ b* then *f(a) ≡ f(b)*. An *e-graph* compactly represents this partition — a set of *e-classes*, each containing *e-nodes* — encoding exponentially many equivalent terms in polynomial space.

> **Theorem (Congruence closure).** *Given a set of ground equations, the e-graph's merge operation computes the smallest congruence relation containing them, and any two terms in the same e-class are provably equal under the equations.*

The e-graph was a theorem-prover's tool for thirty years before compiler writers noticed it could hold not just facts, but *choices*: every equivalent version of a program, simultaneously.

### 2.3 Instruction selection as rewriting: BURS

The connection between rewriting and code generation predates all of this. *Bottom-up rewrite systems* (BURS) — Pelegrí-Llopart and Graham's formalization of the technology behind BURG [11] — treat instruction selection as tree pattern matching: machine instructions are rewrite rules from IR trees to assembly, each with a cost, and a dynamic program tiles the expression tree with minimum total cost in linear time. BURS is superoptimization's well-behaved sibling: optimal, but only within a fixed, finite rule set. The systems in this thesis ask what happens when the rule set itself is *discovered*.

| System | Year | Search strategy | Correctness mechanism | Scope |
|---|---|---|---|---|
| Massalin | 1987 | Exhaustive enumeration | Exhaustive input testing | Tiny kernels |
| Bansal–Aiken | 2006 | Enumerative + fingerprinting | Equivalence checking | Peephole windows |
| STOKE | 2013 | MCMC stochastic search | Tests + SMT (data-driven EC) | Loop-free x86-64 |
| Souper | 2017 | Enumerative synthesis + Z3 | SMT translation validation | LLVM IR integer DAGs |
| Equality saturation | 2009 | Saturation to fixpoint | Trusted rewrite rules | Whole functions (PEGs) |
| egg | 2021 | Saturation + e-class analyses | Trusted rules + validation | General-purpose library |
| Ruler | 2021 | Enum. modulo cvec equivalence | SMT / fuzz / model check | Domain rule inference |
| Alive | 2015 | — (DSL, no search) | SMT refinement checking | LLVM peepholes |
| Alive2 | 2021 | Bounded unrolling | SMT refinement + UB model | LLVM incl. memory |

## 3. Methodology

This thesis reconstructs the design decisions of eight systems from the primary literature and evaluates them on three axes: **search power**, **representation power**, and **assurance**. The methodology has four components.

First, a careful reading of each system's core algorithm, recast in a common notation: a *rewrite* is a directed or bidirectional equation *l → r* over terms; a *cost model* *c* maps terms to reals; the optimizer seeks min{c(t)} over the equivalence class of the input.

Second, a complexity analysis of the search procedures: exhaustive enumeration (Massalin), Metropolis–Hastings MCMC (STOKE), enumerative CEGIS with SMT oracles (Souper), and saturation with rebuilding (*egg*).

Third, a comparison of correctness disciplines, ordered by strength: testing, SMT-based *refinement* checking modulo undefined behavior (Alive/Alive2), per-compilation translation validation (Souper), and full mechanized proof (CompCert).

Fourth, an assessment of *rule provenance*: hand-written rules (BURS, InstCombine), harvested-and-synthesized rules (Souper), and fully inferred rulesets (Ruler).

---

## 4. Deep Dive

### 4.1 STOKE: superoptimization as stochastic search

Schkufza, Sharma, and Aiken's STOKE [2] made the decisive break from exhaustive search. The problem is formulated as optimization over a *cost function* with two terms:

$$c(\mathcal{R}; \mathcal{T}) = \text{eq}(\mathcal{R}; \mathcal{T}) + \omega \cdot \text{perf}(\mathcal{R})$$

where $\mathcal{T}$ is the target program, $\mathcal{R}$ the rewrite candidate, $\text{eq}$ measures incorrectness (initially via test cases), and $\text{perf}$ measures expected runtime (a static latency model over the x86-64 instruction mix). Search proceeds by *Markov Chain Monte Carlo*: from the current rewrite, propose a random mutation — an opcode substitution, an operand swap, an instruction deletion or insertion, a rotation of the sequence — and accept it with the Metropolis–Hastings probability, which favors downhill moves but permits uphill ones, allowing escape from local minima.

The sampler's genius is that it never enumerates the space; it walks it, spending time proportional to a Boltzmann distribution over cost. Correctness is handled in two stages: fast *test-case* filtering discards the overwhelmingly many incorrect proposals, and only promising candidates reach the *data-driven equivalence checker* of Sharma et al. [12], which combines concrete execution traces with an SMT solver. On Hacker's Delight-style kernels compiled by LLVM at `-O0`, STOKE routinely matched or beat `gcc -O3` and `icc -O3`, and famously synthesized a software population-count competitive with the hardware `popcnt` instruction [2].

> **Theorem (MCMC stationarity, informal).** *Under the Metropolis–Hastings acceptance rule, STOKE's random walk is an ergodic Markov chain whose stationary distribution assigns probability proportional to $\exp(-\beta \cdot c(\mathcal{R}; \mathcal{T}))$ to each rewrite — i.e., the sampler spends exponentially more time near low-cost programs.*

The theorem explains the method's power and its honest limitation: convergence to the stationary distribution is guaranteed *asymptotically*, but the mixing time on real instruction spaces is unknown. STOKE is a superb optimizer and an unsound-by-construction one without its verification stage — which is exactly why the equivalence checker, not the sampler, is the load-bearing wall.

```haskell
-- STOKE's search loop, idealized
mcmc :: Cost -> Rewrite -> IO Rewrite
mcmc cost current = do
  proposal <- mutate current          -- opcode/operand/delete/insert/rotate
  let delta = cost proposal - cost current
  accept  <- bernoulli (min 1 (exp (-beta * delta)))
  let next = if accept then proposal else current
  best  <- if eqTest next target then verify next else return current
  mcmc cost next                       -- walk on; verification gates acceptance
```

### 4.2 Souper: harvesting missed optimizations from the wild

Souper [3] attacked a different bottleneck: *where do optimization opportunities come from?* Rather than superoptimizing fixed benchmarks, Sasnauskas et al. built a pipeline that *harvests* candidates from real LLVM bitcode. The harvester extracts dataflow DAGs rooted at integer-typed SSA values — the peephole-shaped fragments of real programs — converts each to an SMT formula, and asks the synthesizer: is there a cheaper instruction sequence computing the same value?

Synthesis is enumerative but solver-guided: candidate right-hand sides are enumerated in order of increasing cost, and each is checked against the specification with Z3; counterexamples from failed candidates prune the search (a CEGIS loop). Every accepted rewrite carries a *translation-validation* proof. Souper can run as an LLVM pass, and its practical payoff was discovering optimizations that LLVM's hand-written `InstCombine` had missed for years, alongside miscompilation reports when the *compiler's* existing rewrites failed Souper's validation.

Souper reasons about loop-free, side-effect-free integer DAGs — the fragment where SMT bitvector reasoning is decisive — and its harvest is bounded by DAG size and instruction width to keep solver queries tractable.

![Souper's harvest-to-synthesis pipeline from LLVM IR](/thesis/superoptimization-egraphs-d1c5-2.webp)

### 4.3 Equality saturation: defeating phase ordering with e-graphs

Tate, Stepp, Tatlock, and Lerner [4] observed that the phase-ordering problem is an artifact of *destructive* rewriting: each pass commits to a transformation, erasing the alternatives. Equality saturation inverts the model. Optimizations become *equality analyses* that *add* equivalences to a shared e-graph instead of rewriting the program: applying the rule $x + 0 \to x$ does not delete the $+$-node; it merges its e-class with that of $x$. The e-graph is *saturated* — rules applied until fixpoint or resource bound — and now compactly represents *every* program reachable by any ordering of the rules. A single global *extraction* step then selects the minimum-cost term from each e-class, making the profitability decision once, with all alternatives visible.

Their IR of choice, the *Program Expression Graph* (PEG), rendered even loops and branches as pure functions (via $\theta$, $\phi$, and $\text{eval}$/$\text{pass}$ nodes), so saturation could range over control flow — something superoptimizers, confined to straight-line code, could never do. The saturated e-graph doubles as a *translation validator*: two programs are equivalent iff their e-classes merge.

> **Theorem (Saturation soundness).** *If every rewrite rule is a valid equality, then every term extractable from the saturated e-graph is semantically equal to the input program; extraction of the minimum-cost term therefore yields an optimal program relative to the ruleset.*

Note the careful qualifier: *relative to the ruleset* — the problem Ruler (§4.5) was built to solve.

### 4.4 egg: making e-graphs fast and extensible

E-graphs were designed for theorem provers in the 1970s, not for equality saturation's workload — rapid, repeated merging driven by syntactic rewriting. Willsey et al.'s *egg* [5] specialized the data structure with two contributions.

First, **rebuilding**: the classical e-graph restores its congruence invariant eagerly after every merge, which is asymptotically wasteful when thousands of merges arrive in a burst. *egg* defers invariant restoration and performs it once per saturation iteration in a deduplicated, worklist-driven pass — an amortized technique that yields asymptotic speedups on real workloads.

Second, **e-class analyses**: a general mechanism for attaching domain data (constant values, free-variable sets, cost bounds, characteristic vectors) to e-classes, maintained automatically across merges. Analyses enable *conditional* rewriting — rules that fire only when analysis data justifies them, such as constant folding — without ad-hoc e-graph surgery. This turned *egg* into a platform: Herbie (floating-point accuracy), Szalinski (CAD decompilation), and Diospyros (DSP code generation) all build on it.

```rust
// egg: rewrite rules as first-class values; analyses gate conditional rules
let rules: &[Rewrite<Math, ConstantFold>] = &[
    rewrite!("commute-add"; "(+ ?a ?b)" => "(+ ?b ?a)"),
    rewrite!("assoc-add"; "(+ ?a (+ ?b ?c))" => "(+ (+ ?a ?b) ?c)"),
    rewrite!("fold-add"; "(+ ?a ?b)" => "?c"
        if is_const(?a) && is_const(?b) ),  // conditional via e-class analysis
];
let runner = Runner::default().with_expr(&expr).run(rules);
let best = Extractor::new(&runner.egraph, AstSize).find_best(runner.roots[0]);
```

![E-graph congruence classes merged by rewrite rules during saturation](/thesis/superoptimization-egraphs-d1c5-1.webp)

### 4.5 Ruler: synthesizing the rules themselves

Every system above assumes a ruleset; Nandi et al.'s Ruler [6] *learns* it. Given a grammar and an interpreter for a domain, Ruler enumerates terms and groups them by *characteristic vectors* (cvecs) — the vector of a term's values on a fixed set of sample inputs, maintained as an e-class analysis in *egg*. Terms with matching cvecs are observationally equivalent candidates; a validator (SMT, model checking, or fuzzing) promotes candidates to rules; and a final *ruleset minimization* keeps a small, orthogonal, general set.

The paper's headline result: for rational arithmetic, Ruler learned 50 rules in 18 seconds — every one proven sound by an SMT post-pass — and the learned ruleset measurably improved Herbie's accuracy/size trade-off when substituted for six years of hand-written expert rules [6]. Equality saturation *amplifies* unsoundness: a single bad rule quickly merges distinct constants, so fuzzing-based validation becomes surprisingly reliable — bogus rules crash loudly instead of slipping through.

### 4.6 Alive, Alive2, and CompCert: the correctness endgame

Hand-written peephole rules are a persistent source of miscompilations, largely because of *undefined behavior*: an optimization valid for mathematical integers may be wrong for LLVM's `undef`, `poison`, and wrapping arithmetic. Lopes, Menendez, Nagarakatte, and Regehr's Alive [7] gave LLVM developers a DSL in which a transform is written once — source pattern, target pattern, precondition — and the tool encodes *refinement* (the target must be defined wherever the source is, and agree there) as SMT queries over LLVM's UB semantics. Counterexamples are generated automatically; verified transforms are compiled to C++ for `InstCombine`. Alive translated over 300 existing optimizations and found multiple previously unknown miscompilations among them.

Alive2 [13] extended the approach to memory, function calls, and loops (via bounded unrolling), becoming a *bounded translation validator* for arbitrary LLVM functions. At the far end of assurance sits CompCert [8]: a C compiler whose passes are proved correct in Coq or paired with proved-sound *verified validators* — full assurance at person-years of proof cost.

![Alive's translation validation with inferred preconditions](/thesis/superoptimization-egraphs-d1c5-3.webp)

---

## 5. Empirical Results and Proofs

**Search power.** STOKE's headline result remains the benchmark for stochastic methods: from unoptimized LLVM output on Hacker's Delight kernels, MCMC search with data-driven equivalence checking matched or exceeded `gcc -O3`/`icc -O3`, occasionally beating expert assembly [2]. Souper showed that *harvested* synthesis finds real missed optimizations in production code — and that re-validating the compiler's own rewrites surfaces latent miscompilations [3]. Ruler's 50-rules-in-18-seconds for rationals [6] reset expectations for how cheaply a domain's equational theory can be learned.

**Representation power.** Equality saturation's payoff is qualitative: Tate et al. [4] showed saturation discovering intricate optimizations requiring cooperating passes that no fixed pass ordering finds, while *egg*'s rebuilding made saturation fast enough to become infrastructure [5]. Global extraction is the principled answer to phase ordering.

**Assurance.** Alive's translation of 300+ InstCombine patterns into verified transforms, with counterexamples for the buggy ones [7], is the strongest evidence that SMT refinement checking scales to a production peephole corpus. CompCert's machine-checked validators [8] remain the gold standard, at a proof-engineering cost no production compiler has paid twice.

The load-bearing proofs are small: congruence closure's correctness [10], MCMC stationarity [2], saturation soundness [4], and refinement checking [7]. Each is a contract between components: the search may be heuristic, but the *gate* — the equivalence check, the validator, the refinement query — is where soundness lives.

## 6. Limitations

Honesty requires listing what none of these systems do.

* **Loops and memory.** STOKE and Souper are confined to loop-free, side-effect-free fragments; Alive2 handles loops only by bounded unrolling. Whole-program superoptimization of stateful code remains out of reach — the SMT queries explode, and the search space with it.
* **Cost models are lies.** STOKE's latency model, Souper's instruction-count proxy, and e-graph AST-size extraction are all approximations of true runtime. A "provably optimal" rewrite under a wrong cost model is a fast way to be wrong about performance; none of these systems closes the loop with measured execution.
* **Rule soundness is assumed, not proven, in saturation.** Equality saturation amplifies both good rules and bad ones (§4.5). *egg* trusts its ruleset; a single unsound rule poisons every extraction. Ruler mitigates this with validation, but fuzzing-based validation is probabilistic assurance wearing a solver's clothes.
* **Scalability cliffs.** Without rule curation and iteration bounds, e-graphs grow explosively; Souper's harvest must be aggressively bounded; STOKE's mixing time is uncharacterized. Each system works because its authors carefully fenced the search space.
* **The human is still in the loop.** Alive needs written preconditions; Ruler needs a grammar and interpreter; Souper needs bounding parameters. The dream of a fully automatic "optimize my backend" button remains unrealized.

## 7. Conclusion

The arc from Massalin to CompCert is the arc from *exhaustiveness* to *judgment*. Massalin proved optimal code could be found by searching everything; STOKE proved searching *cleverly* beats searching everything; Souper proved the search should start from code the world writes; equality saturation proved the search need not commit until every alternative is visible; Ruler proved the rules can be learned; Alive proved what is found can be checked.

The deepest lesson is architectural: in every successful system, the *heuristic* component (the sampler, the enumerator, the saturation engine) is separated from the *soundness* component (the equivalence checker, the SMT validator, the refinement query) by a clean interface. Search proposes; proof disposes. That separation is what lets STOKE be gloriously unsound in its wanderings yet trustworthy in its output, and what lets *egg* saturate aggressively while extraction remains semantics-preserving.

Looking forward, the open problems sit at the interfaces: cost models grounded in measurement rather than static tables, rule synthesis co-designed with its extraction cost model, and validators expressive enough for concurrency and speculation.

---

## References

[1] Henry Massalin. "Superoptimization: A Look at the Smallest Program." *ACM SIGPLAN Notices* 22(4), 1987. https://dl.acm.org/doi/10.1145/512529.512566

[2] Eric Schkufza, Rahul Sharma, and Alex Aiken. "Stochastic Superoptimization." *Proc. ASPLOS 2013*. https://arxiv.org/abs/1211.0557

[3] Raimondas Sasnauskas, Yang Chen, Peter Collingbourne, Jeroen Ketema, Gratian Lup, Jubi Taneja, and John Regehr. "Souper: A Synthesizing Superoptimizer." *arXiv:1711.04422*, 2017. https://arxiv.org/abs/1711.04422

[4] Ross Tate, Michael Stepp, Zachary Tatlock, and Sorin Lerner. "Equality Saturation: A New Approach to Optimization." *Proc. POPL 2009* (journal version, LMCS 2010). https://www.cs.cornell.edu/~lerner/papers/lmcs11-eqsat.pdf

[5] Max Willsey, Chandrakana Nandi, Yisu Remy Wang, Oliver Flatt, Zachary Tatlock, and Pavel Panchekha. "egg: Fast and Extensible Equality Saturation." *Proc. ACM Program. Lang.* 5(POPL), 2021. https://doi.org/10.1145/3434304

[6] Chandrakana Nandi, Max Willsey, Amy Zhu, Yisu Remy Wang, Brett Saiki, Adam Anderson, Adriana Schulz, Dan Grossman, and Zachary Tatlock. "Rewrite Rule Inference Using Equality Saturation." *Proc. ACM Program. Lang.* 5(OOPSLA), 2021. Distinguished Paper. https://cnandi.com/docs/oopsla21-cr.pdf

[7] Nuno P. Lopes, David Menendez, Santosh Nagarakatte, and John Regehr. "Provably Correct Peephole Optimizations with Alive." *Proc. PLDI 2015* (CACM Research Highlight version). https://web.ist.utl.pt/nuno.lopes/pubs/alive-cacm18.pdf

[8] Xavier Leroy. "Formal Verification of a Realistic Compiler." *Communications of the ACM* 52(7), 2009. https://doi.org/10.1145/1538788.1538814

[9] Sorav Bansal and Alex Aiken. "Automatic Generation of Peephole Superoptimizers." *Proc. ASPLOS 2006*.

[10] Greg Nelson and Derek C. Oppen. "Fast Decision Procedures Based on Congruence Closure." *Journal of the ACM* 27(2), 1980.

[11] Eduardo Pelegrí-Llopart and Susan L. Graham. "Optimal Code Generation for Expression Trees: An Application of BURS Theory." *Proc. POPL 1988*.

[12] Rahul Sharma, Eric Schkufza, Bertrand Churchill, and Alex Aiken. "Data-Driven Equivalence Checking." *Proc. OOPSLA 2013*.

[13] Nuno P. Lopes, Juneyoung Lee, Chung-Kil Hur, Zhengyang Liu, and John Regehr. "Alive2: Bounded Translation Validation for LLVM." *Proc. PLDI 2021*.

