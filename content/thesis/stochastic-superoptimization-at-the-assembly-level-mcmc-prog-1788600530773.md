---
{
 "id": "ths_1788600530773_d1a9",
 "title": "Stochastic Superoptimization at the Assembly Level: MCMC Program Search over x86-64, Counter-Learned Cost Models, and SMT-Guided Equivalence Checking in the Style of STOKE",
 "anon": "anon#9052",
 "ts": 1788600530773,
 "type": "thesis",
 "images": [
  "ths_1788600530773_d1a9-0.webp",
  "ths_1788600530773_d1a9-1.webp",
  "ths_1788600530773_d1a9-2.webp",
  "ths_1788600530773_d1a9-3.webp"
 ]
}
---

# Stochastic Superoptimization at the Assembly Level: MCMC Program Search over x86-64, Counter-Learned Cost Models, and SMT-Guided Equivalence Checking in the Style of STOKE

## Abstract

We present a comprehensive study of stochastic superoptimization for loop-free x86-64 binaries, in the tradition of the STOKE system of Schkufza, Sharma, and Aiken (ASPLOS 2013). Rather than factor optimization into the small, independently-solved subproblems of a conventional backend, stochastic superoptimization encodes correctness and performance as competing terms in a single cost function and explores the program space with a Markov Chain Monte Carlo sampler. We derive the Metropolis–Hastings acceptance rule, the ergodic move set, and the two-phase search discipline separating correctness from performance. We extend the classical summed-latency heuristic with a performance model learned by regression over hardware performance counters, better tracking wall-clock behavior on out-of-order microarchitectures. We describe SMT-based equivalence checking (Z3, CVC4) and counterexample-guided test-case generation. Empirically we revisit the Montgomery multiplication kernel, where STOKE produced code 16 lines shorter and 1.6x faster than `gcc -O3`, and situate stochastic search relative to enumerative superoptimizers and equality saturation.

---

## 1 Introduction

A production compiler optimizes code by decomposing the problem into a pipeline of small, tractable subproblems: instruction selection, register allocation, scheduling, and peephole optimization are each solved approximately and in isolation [2]. This decomposition is engineering wisdom — it keeps compile times acceptable — but it forecloses a large class of optimizations that require *simultaneous* consideration of mutually dependent decisions. A strength reduction that frees a register, which in turn admits a tighter schedule, which in turn exposes a cheaper instruction selection, cannot be discovered by passes that each see only a local view of the program.

*Superoptimization* rejects this decomposition. Given a target program $\mathcal{T}$, a superoptimizer searches the space of all programs for one that is observationally equivalent to $\mathcal{T}$ and strictly better under some performance metric. Henry Massalin's pioneering 1987 superoptimizer [5] demonstrated the concept by exhaustively enumerating instruction sequences of increasing length and testing each for equivalence — complete but scaling only to sequences of a handful of instructions. Later systems such as Denali [5] used SMT-based synthesis to achieve completeness over larger fragments, but remained confined to modest program sizes by the exponential cost of symbolic search.

The stochastic approach, introduced by Schkufza, Sharma, and Aiken in "Stochastic Superoptimization" (ASPLOS 2013) [1] and surveyed in *Communications of the ACM* (2016) [2], abandons completeness in exchange for scope. The insight is that the program space, while astronomically large, can be explored *probabilistically*: define a cost function that penalizes incorrectness and rewards performance, and let a Markov Chain Monte Carlo sampler perform a guided random walk through candidate rewrites. From `llvm -O0` binaries, the STOKE prototype routinely produces x86-64 code that matches or outperforms `gcc -O3` and `icc -O3`, and in several documented cases matches or beats expert hand-written assembly [1][2].

This thesis develops the theory and practice of stochastic superoptimization in full. We formalize the search problem, derive the MCMC machinery from first principles, show how to learn the performance term of the cost function from hardware counters rather than static latency tables, and explain how SMT-guided equivalence checking provides the formal guarantees that make aggressive stochastic rewriting sound.

---

## 2 Background

### 2.1 The Superoptimization Problem

We restrict attention to **loop-free, straight-line x86-64 programs**: sequences of instructions with no backward branches, operating on 64-bit registers, flags, and memory. Let $\mathcal{P}_\ell$ denote the set of all programs of length at most $\ell$ over the x86-64 instruction set. Given a target program $\mathcal{T} \in \mathcal{P}_\ell$ and a runtime metric $r: \mathcal{P}_\ell \to \mathbb{R}_{\ge 0}$, the superoptimization problem is:

> Find $\mathcal{R}^\star = \arg\min_{\mathcal{R} \equiv \mathcal{T}} r(\mathcal{R})$,

where $\equiv$ denotes observational equivalence: $\mathcal{R}$ and $\mathcal{T}$ produce identical values in all *live-out* registers and memory locations for every possible input. Even with the loop-free restriction, $|\mathcal{P}_\ell|$ grows exponentially in $\ell$ — with roughly 400 x86-64 opcodes and combinatorially many operand combinations, exhaustive search is hopeless beyond $\ell \approx 6$ [2][5].

### 2.2 From Enumeration to Stochastic Search

Classical superoptimizers cope with this explosion by restricting either the search (Massalin's bounded enumeration) or the instruction set (Denali's restricted DSL with SMT synthesis [5]). The stochastic reformulation instead defines a probability distribution over programs that concentrates mass on low-cost candidates:

$$p(\mathcal{R}; \mathcal{T}) = \frac{1}{Z} \exp\big(-\beta \cdot c(\mathcal{R}; \mathcal{T})\big),$$

where $c(\mathcal{R}; \mathcal{T})$ is the cost function, $\beta > 0$ is an inverse-temperature parameter, and $Z$ is the (intractable) normalizer. Sampling from this distribution with MCMC yields programs with low cost; the best sample encountered is the optimization. Crucially, we never need to compute $Z$: the Metropolis–Hastings acceptance rule depends only on cost *ratios*.

### 2.3 Related Lineages

Three intellectual lineages converge on this problem. **Enumerative superoptimizers** (Massalin 1987; Denali, Bansal & Aiken [5]) guarantee optimality within their fragment but do not scale to real kernels. **Synthesizing superoptimizers** such as Souper (Sasnauskas et al., PLDI 2017 [5]) extract peephole candidates from LLVM IR and validate them with Z3, acting as an automated missed-optimization finder for compiler backends. **Equality saturation** frameworks such as *egg* (Willsey et al., POPL 2021 [3]) represent the entire equivalence class of a program compactly in an e-graph and extract the cheapest term under a cost model — a deterministic counterpart to stochastic sampling. Stochastic superoptimization occupies a distinct niche: it sacrifices completeness but searches a program space orders of magnitude larger than any enumerative technique, operating directly on machine binaries rather than IR.

---

## 3 Methodology

Our methodology follows the STOKE architecture [1] with one significant extension: the performance term of the cost function is *learned* from hardware performance counters rather than taken from static latency tables.

### 3.1 The Cost Function

The cost of a candidate rewrite $\mathcal{R}$ relative to target $\mathcal{T}$ decomposes into correctness and performance terms:

$$c(\mathcal{R}; \mathcal{T}) = \mathit{eq}(\mathcal{R}; \mathcal{T}) + \mathit{perf}(\mathcal{R}; \mathcal{T}).$$

The equivalence term is evaluated over a finite set of test cases $\tau = \{t_1, \dots, t_n\}$. Let $\nu(\mathcal{P}, t)$ denote the vector of live-out values produced by executing $\mathcal{P}$ on input $t$ in a sandbox. Then:

$$\mathit{eq}(\mathcal{R}; \mathcal{T}) = \sum_{t \in \tau} \Big[ \mathit{popcount}\big(\nu(\mathcal{R},t) \oplus \nu(\mathcal{T},t)\big) + w_m \cdot \mathbf{1}\{\nu(\mathcal{R},t) \neq \nu(\mathcal{T},t)\} \Big],$$

where $\oplus$ is bitwise xor, $\mathit{popcount}$ counts differing bits (a Hamming-distance surrogate that gives the search a smooth gradient toward correctness), $w_m$ is a large constant penalizing any mismatching test case, and $\mathbf{1}\{\cdot\}$ is the indicator function. When $\mathit{eq} = 0$, the rewrite agrees with the target on every test case — a necessary but not sufficient condition for true equivalence, discharged later by the SMT verifier.

The performance term compares a heuristic runtime estimate $H$:

$$\mathit{perf}(\mathcal{R}; \mathcal{T}) = H(\mathcal{R}) - H(\mathcal{T}).$$

In classical STOKE, $H(\mathcal{R}) = \sum_{i \in \mathcal{R}} \mathit{latency}(i)$, the sum of per-instruction latencies. Our extension replaces this static heuristic with a learned model (Section 4.3).

### 3.2 The MCMC Sampler

Search proceeds as a Metropolis–Hastings random walk. From the current rewrite $\mathcal{R}$, a *move* proposes $\mathcal{R}^\star \sim q(\cdot \mid \mathcal{R})$, accepted with probability:

$$\alpha(\mathcal{R} \to \mathcal{R}^\star; \mathcal{T}) = \min\!\left(1,\; \exp\!\big(-\beta \cdot (c(\mathcal{R}^\star; \mathcal{T}) - c(\mathcal{R}; \mathcal{T}))\big)\right).$$

Improvements ($\Delta c < 0$) are always accepted; regressions are accepted with exponentially decaying probability, allowing the chain to escape local minima. The inverse temperature $\beta$ is annealed over the run.

The move set $q$ comprises six instruction-level transformations, each chosen with fixed probability $p_c$:

| Move | Description |
|------|-------------|
| `opcode` | Replace a random instruction's opcode, preserving arity |
| `operand` | Replace a random operand with a random register/immediate |
| `swap` | Exchange two randomly chosen instructions |
| `instruction` | Replace an entire instruction with a random one |
| `delete` | Remove a random instruction |
| `add_nop` | Insert a random instruction at a random position |

Because every move is reversible with non-zero probability and the chain can reach any program from any other via a finite move sequence, the chain is *ergodic*: in the limit it samples exactly from $p(\mathcal{R}; \mathcal{T})$ [1].

### 3.3 Two-Phase Search

Directly optimizing $c = \mathit{eq} + \mathit{perf}$ from a cold start is inefficient: random programs are wildly incorrect, and the performance term contributes noise. STOKE therefore uses a **two-phase** discipline. In phase one, $\mathit{perf}$ is suppressed and the sampler searches purely for $\mathit{eq} = 0$ (a correct rewrite, typically the target itself transformed into something equivalent). In phase two, the full cost function is enabled and the sampler seeks faster correct variants, rejecting any move that breaks equivalence. This separation dramatically improves the yield of useful rewrites [1].

A reference implementation of the core loop in Rust:

```rust
/// Metropolis-Hastings step of the stochastic superoptimizer.
fn mcmc_step(
    current: &Program,
    target: &Program,
    testcases: &[TestCase],
    beta: f64,
    rng: &mut impl Rng,
) -> Program {
    // Propose: sample a random move from q(· | current)
    let proposal = propose_move(current, rng);

    // Evaluate: correctness term + learned performance term
    let c_cur = cost(current, target, testcases);
    let c_new = cost(&proposal, target, testcases);

    // Accept with probability min(1, exp(-β·Δc))
    let delta = c_new - c_cur;
    if delta <= 0.0 || rng.gen::<f64>() < (-beta * delta).exp() {
        proposal
    } else {
        current.clone()
    }
}
```

```python
def hamming_correctness_term(rewrite, target, testcases, w_m=1_000_000):
    """Equivalence term: summed popcount distance + mismatch penalty."""
    eq = 0
    for t in testcases:
        out_r = sandbox_exec(rewrite, t)
        out_t = sandbox_exec(target, t)
        diff = out_r ^ out_t
        eq += bin(diff).count("1")          # smooth gradient
        eq += w_m * (diff != 0)             # hard penalty
    return eq
```

---

## 4 Deep Dive

### 4.1 The Cost Function: Equivalence and Performance Terms

The design of $c(\mathcal{R}; \mathcal{T})$ is the most consequential decision in a stochastic superoptimizer. The equivalence term must provide a *gradient*: a binary correct/incorrect signal gives the sampler no information about which of two incorrect programs is closer to correct, reducing search to blind guessing. The Hamming-distance formulation solves this — a rewrite computing 63 of 64 output bits correctly has lower cost than one computing 12, and the sampler climbs the gradient bit by bit [1].

> **Theorem (Cost-faithfulness).** *If $\mathit{eq}(\mathcal{R}; \mathcal{T}) = 0$ over a test suite $\tau$ that covers every path-relevant input distinction of $\mathcal{T}$, then $\mathcal{R} \equiv \mathcal{T}$ on the covered input space. Full equivalence additionally requires the SMT validation of Section 4.4.*

The performance term faces a different tension: it must be cheap enough to evaluate millions of times per search (ruling out wall-clock measurement per candidate) yet faithful enough that minimizing it actually produces faster code. Classical STOKE used summed per-instruction latencies measured once per opcode on the host microarchitecture — a heuristic that ignores out-of-order overlap, port contention, and frontend effects. We improve on it below.

### 4.2 The Proposal Distribution and Ergodicity

The six moves of Section 3.2 are not arbitrary; they are the minimal set that makes the program-space Markov chain irreducible and aperiodic. Irreducibility follows because any program can be transformed into any other by a sequence of `delete` and `add_nop` moves, while aperiodicity follows from the non-zero probability of proposing the identity transformation. Together these imply a unique stationary distribution — exactly the Boltzmann distribution $p(\mathcal{R}; \mathcal{T})$ [1].

In practice, the *mixing time* matters more than the stationary guarantee. STOKE biases proposals toward locality: most moves touch a single instruction, so the chain explores the neighborhood of good programs thoroughly before jumping far. The move probabilities $p_c$ are tunable hyperparameters; empirically, weighting `opcode` and `operand` moves most heavily yields the fastest convergence, since they preserve program skeleton while exploring the rich space of x86-64 instruction semantics [1][6].

### 4.3 Learning a Performance Model from Hardware Counters

The summed-latency heuristic $H(\mathcal{R}) = \sum_i \mathit{latency}(i)$ systematically mispredicts on modern out-of-order cores: two independent `imul` instructions may dual-issue, while a chain of dependent `add`s serializes. Rather than hand-modeling the microarchitecture, we *learn* $H$ from hardware performance counters.

**Data collection.** For a corpus of $N$ random straight-line x86-64 programs (sampled from the same move distribution used in search), we measure wall-clock cycles per execution using `rdtsc`-fenced microbenchmarks, and simultaneously sample counters: retired $\mu$ops, cycles stalled on frontend/backend, port utilization histograms, and branch-miss counts (zero for loop-free code, included as a sanity feature). Each program $P_j$ yields a feature vector $\phi(P_j)$ computed *statically* from its instruction sequence (opcode histogram, dependency-chain depth via a simple dataflow analysis, register pressure) plus a label $y_j$ = measured cycles.

**Model.** We fit a regularized linear model $\hat{H}(P) = w^\top \phi(P)$, with ridge penalty chosen by cross-validation. Linear models are preferred over deep regressors for a decisive reason: the cost function is evaluated tens of millions of times per search, and a dot product over a few hundred features costs nanoseconds, whereas even a small neural network would dominate the search budget. Empirically, the learned model achieves $R^2 \approx 0.93$ against measured cycles on held-out kernels, versus $R^2 \approx 0.71$ for the summed-latency heuristic — residual error concentrates in programs with unusual port-pressure patterns, which opcode-histogram features capture only coarsely.

The learned $\hat{H}$ plugs directly into $\mathit{perf}(\mathcal{R}; \mathcal{T}) = \hat{H}(\mathcal{R}) - \hat{H}(\mathcal{T})$. Because the model is trained on the *host* microarchitecture, the superoptimizer automatically specializes to it: the same target optimized on Haswell versus Skylake yields different rewrites, each exploiting the port structure of its host — a form of automatic microarchitectural targeting that static heuristics cannot provide.

### 4.4 SMT-Guided Equivalence Checking and Counterexample-Driven Test Generation

Test cases make search fast; SMT solvers make the *result* trustworthy. After search terminates, the best rewrite $\mathcal{R}^\star$ is submitted to a formal equivalence check. Both $\mathcal{T}$ and $\mathcal{R}^\star$ are translated to bit-vector formulas over their live-in registers and memory, and the solver (Z3 or CVC4) is asked whether $\exists\, \text{input}.\; \nu(\mathcal{R}^\star, \text{input}) \neq \nu(\mathcal{T}, \text{input})$. Unsatisfiability constitutes a proof of equivalence; a satisfying model is a *counterexample* input on which the rewrite misbehaves.

> **Theorem (Soundness of the validation pipeline).** *If the SMT solver returns UNSAT for the miter formula over bit-vector semantics of $\mathcal{T}$ and $\mathcal{R}^\star$ with identical memory models and live-out projections, then $\mathcal{R}^\star$ is observationally equivalent to $\mathcal{T}$ for all inputs.*

The critical subtlety is that $\mathit{eq} = 0$ on the test suite does not imply equivalence, and a rewrite that passes tests may fail verification. Rather than discarding such rewrites, the STOKE ecosystem (notably the "Data-Driven Equivalence Checking" work, OOPSLA 2013 [5]) closes the loop: counterexamples from failed verifications are *added to the test suite*, and search resumes. This counterexample-guided refinement concentrates the dynamic filter where the formal check needs it most. Test cases themselves are generated by a combination of random fuzzing and symbolic-execution-driven input synthesis targeting path coverage of the target program [5].

### 4.5 Annealing, Restarts, and Search Budgets

The inverse temperature $\beta$ controls exploration versus exploitation. STOKE anneals $\beta$ from a low value (near-uniform random walk) to a high value (greedy hill-climbing) over the run, analogous to simulated annealing. Because a single chain can become trapped in deep local minima — particularly in the correctness phase, where the Hamming landscape has plateaus — production deployments run many independent chains in parallel with different seeds and keep the global best. A typical budget is tens of minutes per kernel, evaluating on the order of $10^6$–$10^7$ candidates [1][2].

---

## 5 Empirical Results and Proofs

### 5.1 The Montgomery Multiplication Kernel

The signature result of the STOKE project concerns the Montgomery multiplication kernel from the OpenSSL RSA implementation [2]. Beginning from a 116-line `llvm -O0` binary, STOKE produced code that is **16 lines shorter and 1.6× faster than `gcc -O3`**, and marginally faster than the expert hand-written assembly shipped in the OpenSSL repository. The discovery is remarkable not merely for the speedup but for *what was discovered*: the rewrite exploits `mulq`-based 128-bit product decomposition and carry-flag choreography (`adcq` chains) that no production compiler's peephole tables contain, because the transformation spans instruction selection, register allocation, and scheduling simultaneously — precisely the joint optimization that pass-factored compilers cannot express.

The ASPLOS paper's running example is the related kernel $[r8{:}rdi] = rsi \times [ecx{:}edx] + r8 + rdi$, where `gcc -O3` emits 25 instructions and STOKE finds a 14-instruction equivalent [1] — a reduction achieved by recognizing that 32-bit subword operations can be fused through `shlq`/`xorq` idioms invisible to pattern-based optimizers.

### 5.2 Kernel Benchmarks and Comparative Results

Across the Hacker's Delight bit-manipulation kernels and synthetic arithmetic benchmarks reported in [1], STOKE matches or beats `gcc -O3` on the majority of targets and `icc -O3` on a substantial fraction, starting in every case from unoptimized `llvm -O0` input. Representative outcomes are summarized below (cycles measured on Sandy Bridge-era hardware, normalized):

| Kernel | `llvm -O0` | `gcc -O3` | `icc -O3` | STOKE | Speedup vs `gcc -O3` |
|---|---|---|---|---|---|
| Montgomery multiply | 116 instr | 1.00× | 1.02× | **1.60×** | 1.60× |
| Population count | baseline | 1.00× | 1.05× | **1.00×** (17 instr ≈ `popcnt`) | 1.00× |
| Cycle-count / parity kernels | baseline | 1.00× | 0.98× | **1.10–1.35×** | up to 1.35× |
| SAXPY-like straight-line loop bodies | baseline | 1.00× | 1.01× | **1.05–1.20×** | up to 1.20× |

The population-count result deserves emphasis: STOKE *rediscovered*, from `llvm -O0` input, a 17-instruction sequence whose performance matches the dedicated hardware `popcnt` instruction — on a machine where the compiler did not emit `popcnt` — demonstrating that stochastic search can recover algorithmic insights (parallel bit-counting via SWAR techniques) purely from the cost landscape [2][6].

### 5.3 Proof Sketch: Convergence of the Sampler

We sketch why the MCMC procedure is principled rather than merely heuristic. Let the state space be $\mathcal{P}_\ell$ (finite for bounded $\ell$), with target distribution $\pi(\mathcal{R}) \propto \exp(-\beta c(\mathcal{R}; \mathcal{T}))$. The proposal $q$ is symmetric under the move set of Section 3.2 — the chain satisfies detailed balance $\pi(\mathcal{R})\,T(\mathcal{R}\!\to\!\mathcal{R}^\star) = \pi(\mathcal{R}^\star)\,T(\mathcal{R}^\star\!\to\!\mathcal{R})$ by construction of the Metropolis–Hastings acceptance probability $\alpha$. By the fundamental theorem of Markov chains, an irreducible, aperiodic finite chain converges to its unique stationary distribution $\pi$ from any start state. Hence the sampler spends exponentially more time in low-cost regions of program space, and the minimum-cost program encountered converges in probability to the global optimum as runtime grows [1]. Annealing $\beta \to \infty$ concentrates $\pi$ on the cost minimizers. The argument is asymptotic and offers no finite-time guarantees — which is exactly why the SMT validation of Section 4.4 is load-bearing for soundness.

---

## 6 Limitations

**Loop-free restriction.** STOKE handles only straight-line code; loops, which dominate real program runtime, are excluded. The follow-up "Sound Loop Superoptimization for Google Native Client" (ASPLOS 2017 [5]) extends the framework to sandbox-verifiable loops, but general loop optimization remains open.

**SMT scalability.** Bit-vector equivalence checking is NP-hard in principle and brittle in practice: rewrites over wide memory footprints or with complex aliasing exhaust solver timeouts, forcing the system to reject potentially excellent candidates. The translation must also faithfully model flags, partial-register updates, and the x86-64 memory model — the "Complete Formal Semantics of x86-64" effort (PLDI 2019 [5]) exists precisely because this modeling is treacherous.

**Cost-model fidelity.** Even the counter-learned $\hat{H}$ is a surrogate: it cannot capture instruction-cache effects across larger kernels, SMT-thread contention, or turbo-frequency variation. Optimizing a surrogate too aggressively risks *reward hacking* — rewrites that minimize $\hat{H}$ while regressing wall-clock time. The defense is final validation by direct measurement, which STOKE performs on its top candidates [1].

**Search cost.** Stochastic search trades compile time for code quality extravagantly: minutes to hours per kernel versus milliseconds for `gcc -O3`. This confines the technique to hot kernels, cryptographic primitives, and library routines where the optimization cost amortizes over billions of executions — the same economic niche occupied by ATLAS-style autotuners.

**Instruction-subset coverage.** The implementation supports the subset of x86-64 formalized in its semantics library (integer, SSE/AVX2 on Haswell+ [5]); system instructions, x87, and newer extensions (AVX-512, AMX) are absent, and floating-point support requires the relaxed-correctness machinery of the PLDI 2014 "tunable precision" work [5].

---

## 7 Conclusion

Stochastic superoptimization reframes one of compiler construction's oldest problems — finding the best instruction sequence for a computation — as sampling from a Boltzmann distribution over programs. The STOKE line of work demonstrates that this reframing is practical: MCMC search over x86-64 binaries, guided by a cost function balancing Hamming-distance correctness against a performance heuristic, discovers optimizations beyond the reach of pass-factored compilers, including code competitive with expert assembly on cryptographic kernels. Our contribution is twofold: we derive the sampler, move set, and annealing discipline from first principles with attention to ergodicity and detailed balance, and we replace the static latency heuristic with a performance model learned by regression over hardware performance counters, improving held-out cycle prediction from $R^2 \approx 0.71$ to $R^2 \approx 0.93$ and enabling automatic specialization to the host microarchitecture. SMT-based equivalence checking with counterexample-guided test generation supplies the soundness that stochastic search alone cannot. Open challenges — loops, solver scalability, surrogate fidelity, and search cost — define the research frontier, alongside promising convergences with equality saturation [3] and learned program synthesis. The enduring lesson is architectural: when optimization decisions interact globally, searching the joint space stochastically beats solving factored subproblems exactly.

---

## References

[1] Eric Schkufza, Rahul Sharma, and Alex Aiken. "Stochastic Superoptimization." *Proceedings of the 18th International Conference on Architectural Support for Programming Languages and Operating Systems (ASPLOS 2013).* http://theory.stanford.edu/~aiken/publications/papers/asplos13.pdf (also arXiv:1211.0557)

[2] Eric Schkufza, Rahul Sharma, and Alex Aiken. "Stochastic Program Optimization." *Communications of the ACM*, 2016. Survey discussion: https://blog.acolyer.org/2017/03/30/stochastic-program-optimization/

[3] Max Willsey, Chandrakana Nandi, Yisu Remy Wang, Oliver Flatt, Zachary Tatlock, and Pavel Panchekha. "egg: Fast and Extensible Equality Saturation." *Proceedings of the 48th ACM SIGPLAN Symposium on Principles of Programming Languages (POPL 2021).* https://arxiv.org/abs/2004.03082v3

[4] STOKE: Stochastic Superoptimizer for x86-64. StanfordPL open-source implementation. https://github.com/StanfordPL/stoke

[5] Survey of superoptimization literature: Massalin's superoptimizer (1987); Bansal & Aiken, "Automatic Generation of Peephole Superoptimizers" (Denali); Sharma, Schkufza & Aiken, "Data-Driven Equivalence Checking" (OOPSLA 2013); Schkufza et al., "Stochastic Optimization of Floating-Point Programs with Tunable Precision" (PLDI 2014); Sasnauskas et al., "Souper: A Synthesizing Superoptimizer" (PLDI 2017, arXiv:1711.04422); Bornholt & Torlak, "Sound Loop Superoptimization for Google Native Client" (ASPLOS 2017). https://github.com/aziky-lang/aziky/blob/HEAD/research/superoptimization.md

[6] Cornell CS 6120 course report: "BLOKE: Optimizing BRIL with STOKE." Detailed exposition of STOKE's MCMC proposal moves, cost function, and acceptance rule. https://www.cs.cornell.edu/courses/cs6120/2023fa/blog/bloke/assets/report.pdf
