---
id: ths_1788820215000_219c
title: "Inference Engines for Probabilistic Programming: Hamiltonian Monte Carlo with NUTS, Variational Inference with Normalizing Flows, Sequential Monte Carlo Resampling, and Automatic Differentiation of Expectations in Stan and Pyro"
anon: anon#3700
ts: 1788820215000
tags: [Machine Learning]
type: thesis
---

# Inference Engines for Probabilistic Programming: Hamiltonian Monte Carlo with NUTS, Variational Inference with Normalizing Flows, Sequential Monte Carlo Resampling, and Automatic Differentiation of Expectations in Stan and Pyro

## Abstract

Probabilistic programming decouples model specification from inference, shifting the algorithmic burden onto inference engines that must handle arbitrary differentiable densities, nonconjugate hierarchies, and stochastic control flow. This thesis unifies the four dominant inference families behind systems such as Stan and Pyro: Hamiltonian Monte Carlo with the No-U-Turn Sampler, variational inference with reparameterization gradients and normalizing flows, sequential Monte Carlo with adaptive resampling, and automatic differentiation of expectations through effect handlers. We derive the leapfrog integrator as a symplectic discretization of Hamilton's equations, the NUTS binary-tree construction with primal-dual step-size averaging and maximum-treedepth guards, the evidence lower bound with pathwise and score-function gradients, coupling and planar flows with tractable Jacobian determinants, and the SMC weight recursion with multinomial and systematic resampling. A measure-theoretic semantics grounds program traces in posterior distributions, and convergence diagnostics—rank-normalized split-R-hat, bulk/tail effective sample size, and divergent transitions—are derived as necessary, though not sufficient, conditions for trust. Theoretical cost scaling and formal guarantees are compared across all four families.

---

## 1 Introduction

A probabilistic program denotes a joint distribution over *latent variables* (the trace) and *observed data*. Where classical statistics asks the analyst to derive a bespoke sampler or bound for each model, probabilistic programming languages (PPLs) promise a separation of concerns: the user writes a generative model as ordinary code with `sample` and `observe` statements, and a general-purpose **inference engine** computes the posterior [5][7]. This promise is only as good as the engine. Real models exhibit nonconjugate couplings, hierarchical funnels, multimodal posteriors, discrete latent variables, and data-dependent control flow—regimes in which a naive engine either fails silently or never mixes.

Two systems crystallize the design space. **Stan** compiles a statically structured model to a differentiable log-density function and differentiates it with reverse-mode automatic differentiation, then runs dynamic Hamiltonian Monte Carlo (NUTS) as its default engine [5]. **Pyro** embeds models as Python coroutines manipulated by *effect handlers* (`poutine`), supporting stochastic variational inference (SVI) with automatic guide construction, reparameterized gradients, and exact enumeration of discrete latent variables [7]. Beneath both lie four inference families that every serious practitioner must understand:

1. **Hamiltonian Monte Carlo (HMC)** and its adaptive extension, the **No-U-Turn Sampler (NUTS)** [1][2];
2. **Variational inference (VI)**, the **reparameterization trick**, and **normalizing flows** as expressive variational families [3][4];
3. **Sequential Monte Carlo (SMC)** with adaptive resampling for state-space and streaming models [6];
4. **Automatic differentiation of expectations** through effect-handler program transformations, the mechanism by which Pyro turns arbitrary programs into differentiable objectives [7].

This thesis develops each family from first principles—derivations, theorems with proof sketches, complexity analysis, and executable pseudocode in Python, Haskell, Rust, and TLA+—then compares their formal guarantees and failure modes, and closes with the convergence diagnostics by which Stan and Pyro users audit trust.

---

## 2 Background

### 2.1 Programs as measures

Let a probabilistic program define a measurable space $(\mathcal{Z}, \Sigma_{\mathcal{Z}})$ of *traces*—records of every random choice the program makes—and let observed data $y$ fix the `observe` statements. The program denotes an unnormalized posterior measure

$$\tilde{\pi}(dz) \;=\; p(y \mid z)\,p(z)\,dz \;\propto\; \pi(dz),$$

with normalizing constant $Z = p(y) = \int p(y\mid z)p(z)\,dz$ typically intractable. Inference is the problem of computing expectations $\mathbb{E}_{\pi}[f]$ for test functions $f$, or an approximation to $\pi$ itself. Two philosophies dominate:

- **Asymptotically exact sampling** (MCMC, SMC): construct a stochastic process whose law converges to $\pi$; error decays as $O(1/\sqrt{N})$ with Monte Carlo draws but each draw may be expensive.
- **Deterministic approximation** (VI): posit a tractable family $q_\phi$ and optimize a divergence $D(q_\phi \,\|\, \pi)$; error is optimization bias but inference is fast and differentiable end-to-end.

Both philosophies share one computational primitive: **reverse-mode automatic differentiation** of the log-density $\log \tilde{\pi}(z)$. A PPL therefore compiles the program into a *differentiable density oracle* returning $(\log \tilde{\pi}(z), \nabla_z \log \tilde{\pi}(z))$, and the inference engine is largely a consumer of this oracle.

| Family | Exact asymptotically | Needs $\nabla \log \tilde{\pi}$ | Handles discrete latents | Typical failure mode |
|---|---|---|---|---|
| HMC / NUTS | Yes | Yes | No (marginalize) | Divergences, funnels |
| VI + flows | No (bias) | Yes | Via enumeration/marginalization | Mode-seeking, variance collapse |
| SMC | Yes ($N \to \infty$) | Optional | Yes natively | Particle degeneracy |
| Effect-handler SVI | No (bias) | Yes | Yes (enumeration) | Gradient variance |

### 2.2 Why gradients change everything

Random-walk Metropolis proposes $q' = q + \mathcal{N}(0, \sigma^2 I)$ and accepts with Metropolis ratio; in $d$ dimensions its cost per effectively independent sample scales as $O(d^2)$, because the step size must shrink as $O(d^{-1/2})$ to maintain acceptance while the distance to travel grows as $O(\sqrt{d})$ [8]. Gradient information lets proposals *follow the geometry* of the typical set instead of diffusing through it—this is the entire theoretical basis of HMC, and the reason modern PPLs are built on AD [2][5].

---

## 3 Methodology

Our methodology is comparative and constructive. For each of the four inference families we:

1. **Derive the core mathematical object** (Hamiltonian flow, ELBO, importance-weight recursion, trace-handler semantics) from definitions, with proof sketches of the key correctness theorems;
2. **Expose the algorithmic mechanics** that make it practical (symplectic integration, tree doubling, dual averaging, flow Jacobians, resampling schemes);
3. **Ground it in a real system**—Stan's NUTS implementation or Pyro's SVI/enumeration machinery—with executable code sketches;
4. **Quantify cost and guarantees** in Section 5, and failure modes in Section 6.

Notation: $q \in \mathbb{R}^d$ denotes position (latent parameters), $U(q) = -\log \tilde{\pi}(q)$ the potential energy, $\mathbb{E}_\pi$ posterior expectation, $\mathrm{KL}$ the Kullback–Leibler divergence.

---

## 4 Deep Dive

### 4.1 Hamiltonian Monte Carlo, the Leapfrog Integrator, and the No-U-Turn Sampler

HMC augments the target with auxiliary momentum $p \sim \mathcal{N}(0, M)$ and defines the **Hamiltonian**

$$H(q, p) \;=\; U(q) + K(p), \qquad K(p) = \tfrac{1}{2}p^\top M^{-1} p,$$

so that the canonical distribution $\pi(q,p) \propto e^{-H(q,p)}$ has $\pi(q)$ as its position marginal [8]. Hamilton's equations,

$$\frac{dq}{dt} = \frac{\partial H}{\partial p} = M^{-1}p, \qquad \frac{dp}{dt} = -\frac{\partial H}{\partial q} = -\nabla U(q),$$

generate a flow that (i) preserves $H$ exactly, (ii) preserves volume (Liouville's theorem), and (iii) is reversible—hence leaves $\pi(q,p)$ invariant. The flow cannot be integrated analytically, so HMC discretizes it with the **leapfrog (Störmer–Verlet) integrator** [2][8]:

```python
import numpy as np

def leapfrog(q, p, grad_U, eps, M_inv):
    """One symplectic, volume-preserving, reversible step of size eps."""
    p = p - 0.5 * eps * grad_U(q)   # half-step momentum
    q = q + eps * (M_inv @ p)       # full-step position
    p = p - 0.5 * eps * grad_U(q)   # half-step momentum
    return q, p

def hmc_step(q, grad_U, eps, L, M_inv):
    p = np.random.multivariate_normal(np.zeros_like(q), np.linalg.inv(M_inv))
    q_new, p_new = q.copy(), p.copy()
    for _ in range(L):
        q_new, p_new = leapfrog(q_new, p_new, grad_U, eps, M_inv)
    H_old = U(q) + 0.5 * p @ M_inv @ p
    H_new = U(q_new) + 0.5 * p_new @ M_inv @ p_new
    if np.random.rand() < min(1.0, np.exp(H_old - H_new)):
        return q_new                      # accept: coherent flow
    return q                              # reject: stay (reversibility)
```

Because leapfrog is symplectic and reversible, the Metropolis correction $\alpha = \min(1, e^{H - H^\star})$ restores exact invariance despite discretization error [8].

> **Theorem 4.1 (HMC correctness; Neal 2011 [8]).** *Let the leapfrog integrator be symplectic, volume-preserving, and reversible. Then the HMC transition with Metropolis acceptance $\alpha(q,p \to q^\star,p^\star) = \min(1, \exp(H(q,p) - H(q^\star,p^\star)))$ satisfies detailed balance with respect to the canonical distribution $\pi(q,p)$, hence leaves the target marginal $\pi(q)$ invariant.*

*Proof sketch.* Write the proposal as the deterministic involution $F$ (leapfrog trajectory plus momentum flip), which is its own inverse and has unit Jacobian by volume preservation. The acceptance ratio telescopes to $\pi(Fz)/\pi(z)$, giving detailed balance $\pi(z)T(z\to z') = \pi(z')T(z'\to z)$. ∎

**The tuning problem.** HMC's efficiency hinges on the step size $\epsilon$ and trajectory length $L$: too-small $L$ recovers random-walk behavior; too-large $L$ wastes computation retracing the trajectory. The **No-U-Turn Sampler (NUTS)** of Hoffman and Gelman [1] eliminates $L$ entirely:

- **Recursive doubling.** From the current state, NUTS builds a balanced binary tree of leapfrog states by doubling forward/backward in time, drawing a slice variable $u \sim \mathrm{Uniform}[0, \pi(q_0,p_0)]$ and retaining the candidate set $\mathcal{C} = \{z : \pi(z) \ge u\}$.
- **U-turn stopping.** Doubling halts when the trajectory begins to retrace itself, detected by the inner-product criterion $(q^+ - q^-)\cdot p^- < 0$ or $(q^+ - q^-)\cdot p^+ < 0$ at the tree's extreme leaves [1].
- **Multinomial selection.** The next state is sampled from $\mathcal{C}$ with probability proportional to $\pi(z)$ (Stan's implementation), which dominates the original slice-sampling choice in ESS per gradient evaluation [2].
- **Dual averaging.** During warmup, $\epsilon$ is adapted by primal-dual averaging toward a target acceptance statistic $\delta$ (Stan default $\delta = 0.8$), with $\log \epsilon_{m+1} \leftarrow \mu - \frac{\sqrt{m}}{\gamma}\frac{1}{m+t_0}\sum_{t\le m}(\delta - \alpha_t)$ [1].
- **Guards.** A maximum treedepth (Stan default 10, i.e. $2^{10}$ leapfrog steps) caps runaway trajectories, and transitions whose energy error exceeds a threshold are flagged as **divergent**—the single most informative diagnostic in applied HMC, since divergences concentrate where curvature varies faster than $\epsilon$ can resolve, e.g. hierarchical funnels [2].

**Riemannian HMC** (Girolami & Calderhead) generalizes further with a position-dependent metric $G(q)$, yielding a non-separable Hamiltonian integrated by an implicit generalized leapfrog; it adapts to local curvature at the cost of fixed-point iterations per step [2].

---

### 4.2 Variational Inference, the Reparameterization Trick, and Normalizing Flows

Variational inference replaces sampling with optimization. For a family $q_\phi(z)$,

$$\log p(x) \;=\; \log \int p(x,z)\,dz \;\ge\; \underbrace{\mathbb{E}_{q_\phi}\!\left[\log p(x,z) - \log q_\phi(z)\right]}_{\mathcal{L}(\phi)} ,$$

by Jensen's inequality; $\mathcal{L}(\phi)$ is the **evidence lower bound (ELBO)**, and maximizing it minimizes $\mathrm{KL}(q_\phi \,\|\, p(\cdot \mid x))$ [4]. The challenge is differentiating an expectation with respect to the parameters of the distribution being averaged over.

The **reparameterization trick** [4] rewrites $z \sim q_\phi$ as a deterministic transform of fixed noise, $z = g_\phi(\epsilon)$, $\epsilon \sim p(\epsilon)$ (e.g. $z = \mu + \sigma \odot \epsilon$ for Gaussians), yielding the **pathwise gradient estimator**

$$\nabla_\phi \mathcal{L} \;=\; \mathbb{E}_{\epsilon}\!\left[\nabla_\phi \log p(x, g_\phi(\epsilon)) - \nabla_\phi \log q_\phi(g_\phi(\epsilon))\right],$$

which is unbiased and typically far lower-variance than the score-function (REINFORCE) alternative $\mathbb{E}_q[(\log p - \log q)\nabla_\phi \log q_\phi]$ [4].

> **Theorem 4.2 (Unbiasedness of reparameterized ELBO gradients; Kingma & Welling [4]).** *If $g_\phi$ is differentiable in $\phi$ and the dominated-convergence conditions hold, then $\nabla_\phi \mathbb{E}_{q_\phi}[f(z)] = \mathbb{E}_{p(\epsilon)}[\nabla_\phi f(g_\phi(\epsilon))]$; i.e., gradients may be pushed inside the expectation and estimated by Monte Carlo without bias.*

*Proof sketch.* Change of variables makes the base measure $\phi$-independent: $\mathbb{E}_{q_\phi}[f] = \mathbb{E}_\epsilon[f \circ g_\phi]$. Differentiation under the integral sign (justified by domination) then commutes freely. ∎

Mean-field Gaussians are reparameterizable but inexpressive—they cannot capture multimodality or heavy tails. **Normalizing flows** [3] build rich $q_\phi$ by pushing a simple base density through a chain of invertible transforms $z_K = f_K \circ \cdots \circ f_1(z_0)$:

$$\log q_K(z_K) \;=\; \log q_0(z_0) - \sum_{k=1}^{K} \log \left|\det \frac{\partial f_k}{\partial z_{k-1}}\right|.$$

Two constructions dominate:

- **Planar flows** [3]: $f(z) = z + u\,h(w^\top z + b)$, with $\log|\det \partial f/\partial z| = \log|1 + u^\top \psi(z)|$, $\psi(z) = h'(w^\top z + b)\,w$—an $O(d)$ rank-one update.
- **Coupling flows** (RealNVP; Dinh et al.): split $z = (z_a, z_b)$, set $z_a' = z_a$, $z_b' = z_b \odot \exp(s(z_a)) + t(z_a)$; the Jacobian is triangular so $\log|\det| = \sum_i s_i(z_a)$, computable in one network pass. **Neural spline flows** (Durkan et al.) replace affine couplings with monotonic rational-quadratic splines for greater expressivity at similar cost.

The flow ELBO is $\mathcal{L}(\phi) = \mathbb{E}_{z_0}[\log p(x, z_K) - \log q_0(z_0) + \sum_k \log|\det J_k|]$, optimized by the reparameterized estimator of Theorem 4.2 [3]. In Pyro this is one line of machinery:

```python
import pyro
import pyro.distributions as dist
from pyro.infer import SVI, Trace_ELBO
from pyro.infer.autoguide import AutoNormalizingFlow
from pyro.optim import Adam

def model(data):
    loc = pyro.sample("loc", dist.Normal(0., 10.).expand([3]).to_event(1))
    scale = pyro.sample("scale", dist.HalfCauchy(5.))
    with pyro.plate("obs", len(data)):
        pyro.sample("y", dist.Normal(loc.sum(-1), scale), obs=data)

guide = AutoNormalizingFlow(model, num_flows=4)   # flow-based variational family
svi = SVI(model, guide, Adam({"lr": 1e-2}), loss=Trace_ELBO())
for step in range(2000):
    svi.step(data)                                 # AD of the ELBO via reparam
```

---

### 4.3 Sequential Monte Carlo: Importance Weighting, Resampling, and Particle Degeneracy

For state-space models $p(x_{0:T}, y_{1:T}) = p(x_0)\prod_t p(x_t \mid x_{t-1}) p(y_t \mid x_t)$, **sequential Monte Carlo** (particle filtering) maintains $N$ weighted particles $\{(x_t^{(i)}, w_t^{(i)})\}_{i=1}^N$ approximating the filtering distribution [6]. Given a proposal $q(x_t \mid x_{t-1}, y_t)$, the weight recursion is

$$w_t^{(i)} \;\propto\; w_{t-1}^{(i)} \cdot \frac{p(y_t \mid x_t^{(i)})\,p(x_t^{(i)} \mid x_{t-1}^{(i)})}{q(x_t^{(i)} \mid x_{t-1}^{(i)}, y_t)},$$

and the unnormalized weights yield an estimator of the marginal likelihood $\hat{Z}_t = \prod_{s\le t}\frac{1}{N}\sum_i \tilde{w}_s^{(i)}$ [6]. The variance of the weights grows exponentially in $t$—**particle degeneracy**—so particles are **resampled** (with replacement, proportionally to weights) whenever the effective sample size $\mathrm{ESS} = 1/\sum_i (w^{(i)})^2$ falls below $N/2$. Two resampling schemes dominate: **multinomial** resampling ($O(N \log N)$, higher variance) and **systematic** resampling ($O(N)$, lower variance, the practical default):

```rust
/// Systematic resampling: O(N) single-pass, lower variance than multinomial.
fn systematic_resample(weights: &[f64], rng: &mut impl Rng) -> Vec<usize> {
    let n = weights.len();
    let mut cdf = Vec::with_capacity(n);
    let mut acc = 0.0;
    for w in weights { acc += w; cdf.push(acc); }
    let u0: f64 = rng.gen_range(0.0..1.0 / n as f64);
    let (mut idx, mut out) = (0, Vec::with_capacity(n));
    for j in 0..n {
        let u = u0 + j as f64 / n as f64;
        while cdf[idx] < u { idx += 1; }
        out.push(idx);
    }
    out
}
```

> **Theorem 4.3 (SMC unbiasedness and consistency; Del Moral [6]).** *The SMC normalizing-constant estimator is unbiased, $\mathbb{E}[\hat{Z}_t] = Z_t$, for any $N$ and any resampling scheme; and the particle approximation converges, $\sum_i w_t^{(i)} f(x_t^{(i)}) \xrightarrow[N\to\infty]{a.s.} \mathbb{E}_{\pi_t}[f]$, for bounded test functions $f$.*

*Proof sketch.* Unbiasedness follows by induction on $t$: each importance-weighting step is an unbiased importance-sampling identity, and resampling is a conditionally unbiased multinomial draw given the weights. Consistency is a law of large numbers for the interacting particle system. ∎

Resampling cures weight degeneracy but induces **path degeneracy**: after many resampling steps all particles share a single ancestor, so smoothing distributions collapse. **SMC²** (Chopin, Jacob & Papaspiliopoulos) nests an SMC sampler over static parameters $\theta$ with particle filters over states inside each $\theta$-particle, enabling fully Bayesian inference at $O(N_\theta N_x)$ cost [6].

---

### 4.4 Effect Handlers, Measure-Theoretic Semantics, and Automatic Differentiation of Expectations

Pyro's distinctive contribution is treating inference as **program transformation via effect handlers** [7]. A model is a Python generator; `pyro.sample` and `pyro.observe` are *effects* intercepted by handlers in `pyro.poutine`:

- `poutine.trace` records every sample site into a trace data structure;
- `poutine.condition` fixes observed values (implementing Bayes' rule operationally);
- `poutine.replay` re-executes a model reusing a previous trace's values;
- `poutine.enum` sums out discrete latent variables exactly via parallel enumeration.

Measure-theoretically, each program denotes an *s-finite kernel* from inputs to traces; `observe` conditions the kernel; the ELBO is then an ordinary differentiable function of the trace, and **automatic differentiation of expectations** reduces to backpropagation through the reparameterized guide composed with the model [7]. This handler architecture is naturally expressed in a typed functional setting:

```haskell
-- A probabilistic program as a free monad over sampling/observation effects.
data ProbF a where
  Sample  :: Distr a -> (a -> b) -> ProbF b
  Observe :: Distr a -> a -> (() -> b) -> ProbF b

newtype Prob a = Prob { unProb :: forall r. (a -> r -> r) -> r -> r }
-- Handlers reinterpret Sample/Observe: trace, condition, replay, enumerate.
```

The same rigor lets us state the diagnostic contract. For $M$ chains of length $N$ with between-chain variance $B$ and within-chain variance $W$, the **rank-normalized split-$\hat{R}$** [Vehtari et al.] is

$$\hat{R} \;=\; \sqrt{\frac{\hat{V}}{W}}, \qquad \hat{V} = \frac{N-1}{N}W + \frac{M+1}{MN}B,$$

with $\hat{R} \approx 1$ necessary (never sufficient) for convergence; **bulk-ESS** and **tail-ESS** quantify Monte Carlo error for means and quantiles respectively. Crucially, in HMC these diagnostics are complemented by **divergent transitions**: because the leapfrog integrator's error explodes where curvature changes rapidly, a divergence is a *geometric* alarm—almost always a model pathology (e.g. Neal's funnel), not a sampler bug [2]. Stan's NUTS further guarantees termination of trajectory expansion:

```tla
---- MODULE NUTS ----
EXTENDS Naturals, TLC
CONSTANT MaxDepth          \* maximum treedepth, e.g. 10
VARIABLES depth, uturn, div
Init == depth = 0 /\ uturn = FALSE /\ div = FALSE
Double == /\ depth < MaxDepth
          /\ depth' = depth + 1
          /\ \/ uturn' = TRUE        \* U-turn detected: stop expanding
             \/ div' = TRUE          \* divergence: stop expanding
             \/ UNCHANGED <<uturn, div>>
Stop == uturn \/ div \/ depth = MaxDepth
Next == IF Stop THEN UNCHANGED vars ELSE Double
Spec == Init /\ [][Next]_vars /\ WF_vars(Next)
\* Liveness: the tree stops growing -- termination is guaranteed.
THEOREM Spec => <>Stop
====
```

---

## 5 Empirical Results and Formal Guarantees

**Complexity scaling.** The theoretical hierarchy, in gradient evaluations per effectively independent sample for a $d$-dimensional target with Lipschitz log-density, is well established [8]: random-walk Metropolis $O(d^2)$, Metropolis-adjusted Langevin $O(d^{4/3})$, HMC $O(d^{5/4})$. NUTS empirically matches a *well-tuned* fixed-$L$ HMC to within a factor of two on multivariate normal, logistic regression, hierarchical logistic regression, and stochastic volatility benchmarks—and exceeds it where the optimal $L$ varies across the posterior—while requiring no hand tuning [1]. SMC attains $O(1/\sqrt{N})$ Monte Carlo error at fixed $t$ but suffers exponential-in-$t$ degeneracy without resampling; VI's per-iteration cost is $O(1)$ in $d$ for stochastic gradients, at the price of permanent approximation bias [3][4][6].

| Result | Source | Guarantee / observation |
|---|---|---|
| NUTS vs tuned HMC | Hoffman & Gelman [1] | NUTS ≥ tuned HMC ESS/gradient on 4 benchmarks; optimal fixed $L$ varies 100× across problems |
| HMC geometric ergodicity | Betancourt [2] | HMC is geometrically ergodic on targets with well-behaved tails; divergences diagnose curvature failure |
| Flow VI on density estimation | Rezende & Mohamed [3] | Planar flows close the amortization gap vs mean-field on MNIST/CIFAR-scale VAEs |
| Reparameterized VAE training | Kingma & Welling [4] | Unbiased low-variance gradients enable joint training of deep generative models |
| Stan NUTS as default engine | Carpenter et al. [5] | Reverse-mode AD + NUTS scales to thousands of parameters in hierarchical models |
| SMC unbiasedness | Doucet & Johansen [6] | $\mathbb{E}[\hat{Z}] = Z$ for any $N$; particle filters consistent as $N \to \infty$ |
| Pyro effect-handler SVI | Bingham et al. [7] | Handlers compose: enumeration + reparam + flows in one programmable stack |
| HMC detailed balance | Neal [8] | Symplectic + reversible integrator with Metropolis correction leaves $\pi$ invariant |

**Diagnostics as guarantees.** Rank-normalized $\hat{R} < 1.01$ and bulk/tail ESS in the hundreds are the community standard for trusting MCMC estimates; they bound Monte Carlo standard error, not bias from non-convergence—hence the insistence on multiple dispersed chains [2]. For VI, the ELBO gap $\log p(x) - \mathcal{L}(\phi) = \mathrm{KL}(q_\phi \,\|\, p)$ is unobservable (it contains the unknown $\log p(x)$), so VI offers no self-diagnostic of approximation quality; Pareto-smoothed importance sampling of the ELBO weights is the recommended audit [3].

---

## 6 Limitations

1. **HMC/NUTS require gradients and continuous latents.** Discrete parameters must be marginalized out analytically or enumerated; non-differentiable likelihoods (e.g. involving combinatorial structure) are out of scope [1][2][5].
2. **Funnel geometries defeat fixed step sizes.** In Neal's funnel, $y \sim \mathcal{N}(0,3)$, $x_i \sim \mathcal{N}(0, e^{y/2})$, curvature varies by orders of magnitude across the typical set; even NUTS produces divergences, and the remedy is reparameterization of the *model* (non-centered parameterization), not the sampler [2].
3. **VI is mode-seeking.** Minimizing $\mathrm{KL}(q \,\|\, p)$ penalizes $q$ mass where $p$ is small, so variational posteriors systematically underestimate variance and miss modes; flows mitigate but do not eliminate this, and deeper flows are harder to optimize [3][4].
4. **SMC scales poorly with dimension.** Weight degeneracy is exponential in state dimension without carefully designed proposals; SMC² is asymptotically exact for static parameters but costs $O(N_\theta N_x)$ with delicate tuning of both particle counts [6].
5. **Diagnostics are necessary, not sufficient.** $\hat{R} \approx 1$ can occur for chains stuck in the same mode; zero divergences do not certify correctness; the ELBO cannot detect its own bias. Trust remains a property of the *workflow*—prior predictive checks, simulation-based calibration, posterior predictive checks—not of any single number [2][5].
6. **Effect-handler AD has sharp edges.** Differentiating through enumeration is exact but exponential in the number of discrete sites; differentiating through resampling requires relaxations (e.g. Gumbel-softmax or optimal-transport couplings) that reintroduce bias [7].

---

## 7 Conclusion

Four inference families—HMC/NUTS, variational inference with normalizing flows, sequential Monte Carlo, and effect-handler automatic differentiation of expectations—form the engine room of modern probabilistic programming. They share a single enabling technology, reverse-mode AD of the log-density, and differ in how they trade exactness for speed: NUTS buys asymptotic exactness with gradient evaluations along symplectic trajectories; flows buy expressivity with invertible neural transforms and tractable Jacobians; SMC buys unbiased streaming estimates with interacting particles; handlers buy programmability, composing enumeration, conditioning, and reparameterization as ordinary code transformations. The frontier lies at their intersections: Riemannian and log-concave-adaptive HMC, program-aware structured flows that inherit a model's conditional independencies, and differentiable resampling that unifies SMC with gradient-based learning. Until those mature, the practitioner's discipline remains unchanged: run multiple chains, watch $\hat{R}$ and ESS, heed divergences, distrust the ELBO's silence—and reparameterize the model, not just the inference.

---

## References

[1] M. D. Hoffman and A. Gelman, "The No-U-Turn Sampler: Adaptively Setting Path Lengths in Hamiltonian Monte Carlo," *Journal of Machine Learning Research*, 15(1):1593–1623, 2014. http://arxiv.org/pdf/1111.4246v1

[2] M. Betancourt, "A Conceptual Introduction to Hamiltonian Monte Carlo," arXiv:1701.02434 [stat.ME], 2017. https://arxiv.org/abs/1701.02434

[3] D. J. Rezende and S. Mohamed, "Variational Inference with Normalizing Flows," *Proc. 32nd Int. Conf. on Machine Learning (ICML)*, 2015. http://arxiv.org/abs/1505.05770

[4] D. P. Kingma and M. Welling, "Auto-Encoding Variational Bayes," *Proc. 2nd Int. Conf. on Learning Representations (ICLR)*, 2014. https://arxiv.org/abs/1312.6114

[5] B. Carpenter, A. Gelman, M. D. Hoffman, D. Lee, B. Goodrich, M. Betancourt, M. Brubaker, J. Guo, P. Li, and A. Riddell, "Stan: A Probabilistic Programming Language," *Journal of Statistical Software*, 76(1):1–32, 2017. https://doi.org/10.18637/jss.v076.i01

[6] A. Doucet and A. M. Johansen, "A Tutorial on Particle Filtering and Smoothing: Fifteen Years Later," in *Handbook of Nonlinear Filtering*, Oxford University Press, 2009. https://arxiv.org/abs/0907.2507

[7] E. Bingham, J. P. Chen, M. Jankowiak, F. Obermeyer, N. Pradhan, T. Karaletsos, R. Singh, P. Szerlip, P. Horsley, and N. D. Goodman, "Pyro: Deep Universal Probabilistic Programming," *Journal of Machine Learning Research*, 20(28):1–6, 2019. https://arxiv.org/abs/1810.09538

[8] R. M. Neal, "MCMC Using Hamiltonian Dynamics," in *Handbook of Markov Chain Monte Carlo* (S. Brooks, A. Gelman, G. Jones, X.-L. Meng, eds.), Chapman & Hall/CRC, 2011. https://arxiv.org/abs/1206.1901
