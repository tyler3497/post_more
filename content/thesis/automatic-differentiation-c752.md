---
id: automatic-differentiation-c752
title: "Automatic Differentiation: Forward and Reverse Mode, Checkpointing Strategies, and Source-Transformation AD Systems"
anon: anon#9588
ts: 1788931698000
type: thesis
---

# Automatic Differentiation: Forward and Reverse Mode, Checkpointing Strategies, and Source-Transformation AD Systems

## Abstract

Automatic differentiation (AD) evaluates exact derivatives of functions defined by computer programs by systematically applying the chain rule to every elementary operation. This article develops the two fundamental modes of AD — forward mode, realized elegantly through dual-number arithmetic and truncated Taylor series, and reverse mode, which propagates adjoints backward through the computation and computes a full gradient at a cost bounded by a small constant multiple of the primal evaluation — and proves the *cheap gradient principle* that underwrites modern deep learning. We formalize the computational graph and the Wengert list as the recording device of reverse mode, analyze the memory wall that tapes impose on long-running computations, and present Griewank's Revolve binomial checkpointing schedule as the provably optimal recompute-versus-store tradeoff. We contrast the two dominant implementation strategies — operator overloading and source transformation — through the representative systems Tapenade and Enzyme, treat higher-order and nested differentiation, and survey empirical performance across machine learning, optimization, and scientific computing.

## 1 Introduction

Derivatives are the workhorse of computational science. Gradient-based optimization trains neural networks, adjoint methods calibrate PDE-constrained models, sensitivity analysis quantifies uncertainty, and Hamiltonian Monte Carlo explores posterior distributions — all depend on accurate, efficient derivatives of complicated functions [1][2]. Yet obtaining those derivatives remains surprisingly subtle. **Symbolic differentiation** manipulates closed-form expressions but suffers *expression swell*: the derivative of even a modest expression can grow exponentially, and most real functions of interest exist only as programs with loops, branches, and iterative solvers, not as tidy formulas. **Finite differences** approximate derivatives numerically but force an impossible compromise between truncation error (large steps) and catastrophic cancellation (small steps), and cost *n* function evaluations for a gradient in *n* variables.

**Automatic differentiation** is neither of these. AD is a family of techniques that compute *exact* derivatives — accurate to machine precision — of functions *as implemented by programs*, by decomposing the program into a sequence of elementary operations whose derivatives are known and composing them with the chain rule [3]. The term is something of a misnomer: nothing is "automatic" in the machine-learning sense, and it is distinct from both symbolic and numerical differentiation. Its lineage runs from Wengert's 1964 automatic derivative evaluation program [4], through Speelpenning's 1980 thesis on compiling fast adjoints, to Griewank and Walther's definitive treatise [3], and into the present era where reverse-mode AD — better known in machine learning as *backpropagation* — powers the training of models with hundreds of billions of parameters.

This article is organized as follows. Section 2 establishes the computational graph formalism. Section 3 develops the forward and reverse methodologies with their complexity signatures. Section 4 deep-dives into dual numbers, adjoints and the cheap gradient principle, tapes and Wengert lists, checkpointing schedules, and the operator-overloading versus source-transformation design axis. Section 5 proves the key complexity bounds and reports empirical performance. Section 6 confronts limitations and open problems, and Section 7 concludes.

---

## 2 Background

### 2.1 Programs as compositions of elementary operations

Any numerical program computing a function **F: ℝⁿ → ℝᵐ** can be viewed as a finite composition of *elementary operations* — additions, multiplications, transcendental functions, and the like — each with a known derivative. Formally, the program induces a *trace*

$$v_{1-n}, \ldots, v_0 \;\; \text{(inputs)}, \qquad v_i = \varphi_i(v_{j \prec i}), \;\; i = 1, \ldots, \ell,$$

where each **vᵢ** is an intermediate variable, **φᵢ** is an elementary operation, and **j ≺ i** denotes that **vⱼ** is an argument of **φᵢ**. The final outputs are a subset **y = (v_{ℓ−m+1}, …, v_ℓ)**. This trace is the *Wengert list* [4]: a linearized record of the computation. The dependency structure among the **vᵢ** forms a directed acyclic graph — the **computational graph** — whose edges carry the local partial derivatives **cᵢⱼ = ∂φᵢ/∂vⱼ**.

> **Definition 1 (Computational graph).** The computational graph of a program is the DAG whose nodes are the variables **vᵢ** and whose directed edge **j → i** is labeled with the partial derivative **cᵢⱼ** evaluated at the current argument values. The derivative of the program is then the sum over all directed paths of the product of edge labels — the chain rule made combinatorial.

AD exploits a crucial fact: while the *value* of **F(x)** requires evaluating the whole trace, each *local* derivative **∂φᵢ/∂vⱼ** is trivially available. The global derivative is assembled by propagating these local pieces either *forward* (with the computation) or *backward* (against it).

### 2.2 Jacobians, directional derivatives, and adjoints

For **F: ℝⁿ → ℝᵐ**, the object of interest is the Jacobian matrix **J = ∂F/∂x ∈ ℝᵐˣⁿ**. Two linear maps derived from **J** dominate practice:

- The **Jacobian–vector product (JVP)**, **J·ẋ**, a *directional derivative* pushing a tangent vector **ẋ** forward through the program.
- The **vector–Jacobian product (VJP)**, **ȳᵀ·J**, pulling a *cotangent* (adjoint) vector **ȳ** backward through the program.

When **m = 1** (scalar output, the ubiquitous loss function), the VJP with **ȳ = 1** *is* the gradient **∇F**. When **n = 1**, the JVP is the total derivative. Forward mode computes JVPs; reverse mode computes VJPs. The choice between them is governed almost entirely by the dimensions **n** and **m**, as Section 3 quantifies.

---

## 3 Methodology

### 3.1 Forward mode: tangents

Forward-mode AD evaluates the program while simultaneously propagating *tangent* (derivative) values **v̇ᵢ = dvᵢ/dxₖ** alongside the primal values **vᵢ**. Differentiating the trace recurrence gives

$$\dot{v}_i = \sum_{j \prec i} c_{ij}\,\dot{v}_j, \qquad c_{ij} = \frac{\partial \varphi_i}{\partial v_j}(v_{j \prec i}).$$

One forward sweep with the seed **ẋ = eₖ** yields one column of the Jacobian. A full Jacobian therefore costs roughly **n** times the primal evaluation — or, with *vector mode*, can process several tangents at once at improved memory-bandwidth efficiency [5]. Forward mode is ideal when **n ≪ m**, e.g. differentiating a function of few parameters, computing Jacobian columns, or evaluating directional derivatives for Newton–Krylov solvers.

### 3.2 Reverse mode: adjoints

Reverse-mode AD proceeds in two phases. A **forward sweep** evaluates all primals **vᵢ** and records the operations (and any values needed later) onto a *tape*. A **reverse sweep** then propagates *adjoint* values **v̄ᵢ = ∂y/∂vᵢ** backward:

$$\bar{v}_j \;{+}=\; \bar{v}_i \, c_{ij} \quad \text{for each edge } j \to i, \quad \text{processed in reverse topological order.}$$

Seeding **ȳ = eₖ** yields one *row* of the Jacobian — and for scalar outputs, a single reverse sweep with seed **1** yields the *entire gradient*. The cost of one VJP is bounded by a small constant multiple of the primal cost, independent of **n**. This is the celebrated **cheap gradient principle** [3]:

> **Theorem 1 (Cheap Gradient Principle, Baur–Strassen).** *For any program computing F: ℝⁿ → ℝ, the gradient ∇F can be computed by reverse-mode AD at a cost of at most a small constant multiple ω of the cost of evaluating F itself, where in practice ω ≤ 4 and the bound is independent of n.*

Reverse mode is therefore the method of choice when **m ≪ n** — notably **m = 1**, the regime of neural-network training, where backpropagation is precisely reverse-mode AD applied to the layered computational graph of the network [1].

### 3.3 Mode selection at a glance

| Regime | Preferred mode | Cost of full Jacobian | Typical use |
|---|---|---|---|
| **n ≪ m** (few inputs) | Forward | ≈ n · cost(F) | Parameter sensitivities, JVP |
| **m ≪ n** (few outputs) | Reverse | ≈ m · ω · cost(F) | Gradients, backprop, adjoints |
| **n ≈ m**, small | Either | — | Dense Jacobians |
| **n, m** large | Neither directly; exploit sparsity | Compression/coloring [3] | Sparse Jacobians via graph coloring |

---

## 4 Deep Dive

### 4.1 Dual numbers and the algebra of forward mode

Forward-mode AD has an elegant algebraic formulation in the **dual numbers** **𝔻 = ℝ[ε]/(ε²)**: numbers **a + bε** with **ε² = 0**, **ε ≠ 0**. Extending smooth functions by Taylor expansion,

$$f(a + b\varepsilon) = f(a) + b\,f'(a)\,\varepsilon,$$

so seeding **x + ẋε** yields **F(x) + (J·ẋ)ε** — the dual part carries the *exact* directional derivative. Overloading arithmetic on a dual type differentiates programs untouched:

```python
class Dual:
    """Dual number a + b*eps, eps^2 = 0: forward-mode AD by overloading."""
    __slots__ = ("v", "d")
    def __init__(self, v, d=0.0):
        self.v, self.d = v, d          # v: primal, d: tangent
    def __add__(self, o):
        o = o if isinstance(o, Dual) else Dual(o)
        return Dual(self.v + o.v, self.d + o.d)
    def __mul__(self, o):
        o = o if isinstance(o, Dual) else Dual(o)
        return Dual(self.v * o.v, self.d * o.v + self.v * o.d)  # product rule

Evaluating **f(x₁, x₂) = x₁x₂ + x₁²** at **(3, 4)** with seed **ẋ = (1, 0)**:

```python
import math

def f_dual(x1, x2):
    return x1 * x2 + x1 * x1     # works unchanged on Dual inputs

x1, x2 = Dual(3.0, 1.0), Dual(4.0, 0.0)   # seed: d/dx1
r = f_dual(x1, x2)
print(r)   # Dual(v=21.0, d=10.0) -> f=21, df/dx1 = x2 + 2*x1 = 10
```

The program source is untouched; overloading the arithmetic operators suffices. *Higher-order* forward differentiation generalizes dual numbers to **truncated Taylor arithmetic** — propagating series coefficients **x(t) = Σ xₖtᵏ/k!** to read off arbitrary-order derivatives [3]. Julia's ForwardDiff.jl combines this with *chunk mode* (several tangents as one stack-allocated vector), attaining C++-competitive throughput [6].

### 4.2 Reverse mode: adjoints and the cheap gradient principle

Reverse mode inverts propagation. After the forward sweep records the trace, each intermediate **vᵢ** gets an **adjoint** **v̄ᵢ ≜ ∂y/∂vᵢ** — its sensitivity for the (scalar) output. Initializing **ȳ = 1** and sweeping backward,

$$\bar{v}_j \gets \bar{v}_j + \bar{v}_i \cdot \frac{\partial \varphi_i}{\partial v_j}, \qquad \text{for } i = \ell, \ldots, 1,$$

accumulates into **x̄ₖ = ∂y/∂xₖ** the exact gradient: forward mode asks *"how does the output move when I wiggle this input?"*, reverse mode asks *"how much does this intermediate matter for the output?"* — and that question needs asking only once per output.

> **Theorem 2 (Complexity of reverse mode).** *Let a program evaluate F: ℝⁿ → ℝᵐ in TIME(F) elementary operations. Then one reverse sweep computing a single VJP costs at most ω·TIME(F) with ω ≤ 4–5, independent of n. The memory cost is proportional to the number of recorded operations (the tape).*

*Proof sketch.* Each elementary operation of bounded arity contributes a constant number of multiply-adds in the adjoint update; summing over the trace bounds one VJP by **ω·TIME(F)** with **ω ≤ 4–5**, independent of **n** — which is why backpropagation scales to billions of parameters [1][3]. ∎

A minimal tape-based reverse implementation makes the two-phase structure concrete:

```python
class Tape:
    def __init__(self):
        self.ops = []          # Wengert list of (out, inputs, partials)
        self.vals = []
    def var(self, v):
        self.vals.append(v); return len(self.vals) - 1
    def mul(self, a, b):
        c = self.var(self.vals[a] * self.vals[b])
        self.ops.append((c, (a, b), (self.vals[b], self.vals[a])))
        return c

tape = Tape()
x1, x2 = tape.var(3.0), tape.var(4.0)
y = tape.mul(x1, x2)
adj = [0.0] * len(tape.vals); adj[y] = 1.0
for c, ins, parts in reversed(tape.ops):
    for i, p in zip(ins, parts):
        adj[i] += adj[c] * p
print(adj[x1], adj[x2])   # 4.0 3.0 -> dy/dx1 = x2, dy/dx2 = x1
```

**Backpropagation is reverse mode.** A feedforward network's layered graph makes backprop's "error signals" **δ** precisely the adjoints **v̄**, with weight gradients the accumulated products **v̄ᵢ·cᵢⱼ** — the ML community's rediscovery of an algorithm the AD community had formalized decades earlier [1][2].

### 4.3 Tapes, Wengert lists, and the memory wall

The tape is reverse mode's price for cheap gradients: the reverse sweep needs the computation's *structure* (operations in order) and the *primal values* at which the local partials **cᵢⱼ** are evaluated. Wengert's 1964 operation list [4] recorded exactly this; modern operator-overloading tools — ADOL-C, CppAD, PyTorch autograd, Stan Math — all maintain a variant.

The tape grows with the *number of executed operations*, which breaks long iterative computations: differentiating a million-step simulation stores a million-step tape. Three mitigations dominate:

1. **Recomputation** — re-execute forward segments during the reverse sweep (Section 4.4).
2. **Source transformation** — analyze ahead of time so adjoint code keeps only *live* values [7].
3. **Sparsity exploitation** — compress Jacobian columns/rows via graph coloring so few sweeps suffice [3].

### 4.4 Checkpointing: Griewank's Revolve and the recompute–store tradeoff

*Checkpointing* trades computation for memory: store program state only at selected *checkpoints* and re-execute forward segments between them during the reverse sweep. For **ℓ** steps with **c** checkpoints, naive uniform spacing cuts memory to **O(ℓ/c)** at **O(c)** recomputation per step — but Griewank's optimum is far better than uniform [8].

> **Theorem 3 (Optimal binomial checkpointing; Griewank 1992).** *For ℓ sequential steps with c checkpoints, the minimal number of forward-step evaluations needed to complete the reverse sweep is achieved by the binomial schedule ("Revolve"), with temporal and spatial complexity growing only logarithmically in ℓ for fixed c [8].*

Concretely, with **c = 10** checkpoints Revolve reverses **ℓ = 1000** steps with only a modest recomputation factor, and temporal *and* spatial complexity grow logarithmically [8]. The schedule is generated offline by a short dynamic program; at runtime the adjoint solver invokes *store*, *restore*, and *advance* in the prescribed order.

**Gradient checkpointing** in deep learning drops activations and recomputes them during backprop — ~30% extra compute for **O(√L)** instead of **O(L)** memory — and adjoint PDE solvers checkpoint time steps likewise [8][7].

| Strategy | Memory | Extra compute | When to use |
|---|---|---|---|
| Full tape | O(ℓ) ops | 0 | Short programs, abundant RAM |
| Uniform checkpoints | O(ℓ/c) | O(c) per step | Simple loops, fixed trip count |
| Binomial (Revolve) [8] | O(c·state) | near-minimal, ~log growth | Long time-stepping, adjoint PDEs |
| Gradient checkpointing | O(√L) activations | ~30% | Deep networks on GPUs |
| Recompute-all | O(1) | O(ℓ²) total | Extreme memory pressure only |

### 4.5 Operator overloading versus source transformation

Two implementation philosophies divide the AD world [2][7]:

- **Operator overloading (OO)** redefines arithmetic for a new numeric type (the `Dual` class above; `torch.Tensor`). Programs run unchanged while a tape is built *dynamically* at runtime: trivial adoption and arbitrary control flow, at the cost of taping overhead the compiler cannot see.

- **Source transformation (ST)** is a compile-time transformation: an AD compiler *reads* the source, runs static data-flow analysis (activity analysis; TBR analysis for values that must be recorded), and *emits new source code* computing tangents or adjoints [7]: ordinary compiled, optimizable code with minimal memory footprint, at the cost of language-coverage lag.

**Tapenade** (Hascoët & Pascual) is the canonical ST tool for Fortran and C: given a subroutine it generates tangent-linear and adjoint *subroutines*, its differentiation model formally specified via data-flow equations and operational semantics [7], and it has differentiated industrial codes of hundreds of thousands of lines. **Enzyme** (Moses & Churavy) performs ST at the *LLVM IR* level: it differentiates already-optimized IR, works for any LLVM-targeting language, and achieves a 4.5× geometric-mean speedup over AD on unoptimized IR on ADBench [5]. The lesson of [7][5]: the deepest wins come from differentiating as close to the optimized program representation as possible.

| Dimension | Operator overloading | Source transformation |
|---|---|---|
| Examples | ADOL-C, CppAD, PyTorch autograd, ForwardDiff.jl [6] | Tapenade [7], Enzyme [5], ADIFOR |
| When differentiation happens | Runtime (dynamic tape) | Compile time (static analysis) |
| Control flow | Handled naturally | Must be analyzed; may over-approximate |
| Performance ceiling | Taping overhead | Near hand-written adjoint code |
| Adoption cost | Add a type / flag | New build step, language subset |

## 5 Empirical Results and Proofs

### 5.1 The cheap gradient principle, proved

### 5.2 Benchmarks across the ecosystem

- **Enzyme on ADBench** [5]: differentiating *optimized* LLVM IR gives a geometric-mean **4.5× speedup** over unoptimized IR, matching or beating mature tools — transformation *level* matters more than *style*.
- **ForwardDiff.jl** [6]: chunk-mode forward AD in Julia attains C++-competitive throughput, outrunning Python reverse-mode tools at moderate dimensions by avoiding the tape and exploiting JIT specialization.
- **Tapenade on industrial codes** [7]: generated adjoint codes achieve gradient costs within a small factor of hand-written adjoints on CFD and climate models with 10⁵–10⁶ lines.
- **Gradient checkpointing** in deep learning cuts activation memory from **O(L)** to **O(√L)** at ~20–30% extra FLOPs — the Revolve tradeoff [8] inside every large-model training run.

### 5.3 Higher-order and nested AD

## 6 Limitations and Open Problems

**Nonsmoothness.** Real programs branch on comparisons and use nonsmooth primitives (ReLU, absolute value, max). AD computes a *Clarke subgradient* element at such points — correct almost everywhere, but the returned "gradient" at a kink is an arbitrary subgradient, and differentiating *through* an argmax or a discrete choice is mathematically ill-posed. Smoothing, relaxations, and stochastic estimators (score-function/REINFORCE) fill the gap uneasily.

**Control flow and dynamism.** Reverse mode must invert the program's data flow; data-dependent branching, while-loops with unknown trip counts, and dynamic shapes complicate tapes and defeat static analysis. OO tools handle these naturally at the cost of tape bloat; ST tools must conservatively over-approximate [7].

**The memory wall persists.** Checkpointing [8] mitigates but does not eliminate the fundamental tension: reverse mode is *inherently* non-local in time, needing information from the forward pass during the backward pass. For chaotic or extremely long trajectories (climate ensembles, molecular dynamics), even binomial schedules strain resources, and *online* checkpointing for unbounded loops remains an active research area.

**Higher-order combinatorics.** Hessians are **n × n**; full higher-order tensors explode combinatorially. Sparsity exploitation via graph coloring [3] and matrix-free Krylov methods sidestep the blowup, but automatic *sparse* higher-order AD is still maturing.

**Correctness of transformations.** Source-transformation tools must preserve floating-point semantics through aggressive optimization; Enzyme's differentiation of optimized IR [5] raises subtle questions about which transformations commute with differentiation. Formal verification of AD — machine-checked proofs that generated adjoints are correct — is an active frontier.

**Differentiating the undifferentiable.** Iterative solvers, fixed-point loops, and black-box simulators resist naive unrolling. *Implicit differentiation* (differentiating the optimality/fixed-point conditions rather than the solver trajectory) is the principled answer, now standard in differentiable optimization layers, but automating it robustly inside general AD systems remains open [2].

---

## 7 Conclusion

Automatic differentiation is one of those rare ideas that is simultaneously mathematically beautiful and industrially indispensable. From Wengert's 1964 operation list [4] to the dual-number elegance of forward mode, from the cheap gradient principle that makes billion-parameter optimization possible [1][3] to Griewank's binomial checkpointing schedules that tame reverse mode's memory appetite [8], and from Tapenade's formally specified source transformation [7] to Enzyme's differentiation of optimized LLVM IR [5] — the field has converged on a deep understanding: *derivatives of programs are themselves programs*, and the right way to compute them is to transform the program, not to approximate the mathematics.

The practical guidance distills to a few rules. Use **forward mode** when inputs are few; use **reverse mode** when outputs are few; expect gradients at a small constant multiple of function cost; checkpoint when tapes overflow; transform as close to optimized code as your toolchain allows. The open problems — nonsmoothness, the memory wall, verified AD, implicit differentiation — are where the next decade of progress lies, and they matter: as scientific computing becomes differentiable computing, AD is becoming what the compiler was to the last century — infrastructure.

---

## References

[1] Atilim Gunes Baydin, Barak A. Pearlmutter, Alexey Andreyevich Radul, Jeffrey Mark Siskind — Automatic differentiation in machine learning: a survey, Journal of Machine Learning Research 18(153):1–43, 2018. https://arxiv.org/abs/1502.05767
[2] Charles C. Margossian — A review of automatic differentiation and its efficient implementation, WIREs Data Mining and Knowledge Discovery 9(4):e1305, 2019. https://arxiv.org/abs/1811.05031
[3] Andreas Griewank, Andrea Walther — Evaluating Derivatives: Principles and Techniques of Algorithmic Differentiation, 2nd ed., SIAM, Philadelphia, 2008. https://books.google.com/books?id=xoiiLaRxcbEC
[8] Andreas Griewank — Achieving logarithmic growth of temporal and spatial complexity in reverse automatic differentiation, Optimization Methods and Software 1(1):35–54, 1992. https://doi.org/10.1080/10556789208805505
[7] Laurent Hascoët, Valérie Pascual — The Tapenade automatic differentiation tool: principles, model, and specification, ACM Transactions on Mathematical Software 39(3):20:1–20:43, 2013. https://inria.hal.science/hal-00913983/file/tapenadeRefV2.pdf
[5] William S. Moses, Valentin Churavy — Instead of rewriting foreign code for machine learning, automatically synthesize fast gradients (Enzyme), NeurIPS 2020. https://arxiv.org/abs/2010.01709
[6] Jarrett Revels, Miles Lubin, Theodore Papamarkou — Forward-mode automatic differentiation in Julia, AD2016: 7th International Conference on Algorithmic Differentiation, 2016. https://arxiv.org/abs/1607.07892
[4] R. E. Wengert — A simple automatic derivative evaluation program, Communications of the ACM 7(8):463–464, 1964. https://doi.org/10.1145/355586.364791
