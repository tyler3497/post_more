---
title: "Hamiltonian Dynamics for Bayesian Computation: From Hybrid Monte Carlo to the No-U-Turn Sampler in Modern Probabilistic Programming"
date: 1788676139828
author: "anon#5728"
type: thesis
id: "ths_1788676139828_efa2"
images: ["ths_1788676139828_efa2-0.webp", "ths_1788676139828_efa2-1.webp", "ths_1788676139828_efa2-2.webp"]
---

# Hamiltonian Dynamics for Bayesian Computation: From Hybrid Monte Carlo to the No-U-Turn Sampler in Modern Probabilistic Programming

## Abstract

Modern Bayesian inference lives and dies by the quality of its posterior sampling. This thesis develops the full theoretical and computational pipeline of Hamiltonian Monte Carlo (HMC) [1][2], from its origins as "hybrid Monte Carlo" in lattice quantum chromodynamics [3] to its contemporary embodiment in probabilistic programming languages such as Stan [4], Pyro [5], and NumPyro [6]. We derive Hamilton's equations for the augmented position-momentum system, prove that the leapfrog integrator's symplecticity and reversibility preserve detailed balance, and show how the No-U-Turn Sampler (NUTS) [7] adaptively terminates trajectories via a recursive doubling criterion, removing the single most burdensome tuning parameter of HMC. Alongside these Markov chain Monte Carlo advances we analyze automatic differentiation variational inference (ADVI) [8], quantifying its speed-accuracy trade-offs against exact samplers, and we formalize the convergence diagnostics — split-$\hat{R}$ and effective sample size — that make modern Bayesian workflows trustworthy [9]. The synthesis demonstrates why gradient-aware dynamics, automated differentiation, and rigorous diagnostics have displaced random-walk proposals as the default engine of applied Bayesian statistics.

## 1 Introduction

Bayesian inference requires computing expectations with respect to a posterior distribution $\pi(\theta \mid y) \propto \pi(\theta)\, p(y \mid \theta)$ whose normalization constant is almost never available in closed form. For decades the workhorse was the Metropolis–Hastings random walk: simple, universally applicable, and catastrophically slow in high dimensions, where its proposal variance must shrink as $\mathcal{O}(1/d)$ and exploration proceeds by diffusion [2]. The consequence was a painful gap between the models statisticians could write down and the models they could fit.

Hamiltonian Monte Carlo closed this gap by exploiting a resource that random-walk methods ignore: the *gradient* of the log-density. By augmenting the parameter vector $\theta$ with auxiliary momentum variables $p$ and simulating Hamiltonian dynamics over a fictitious time, HMC converts geometric information about the posterior into long, directed trajectories that traverse the typical set in $\mathcal{O}(d^{1/4})$ steps rather than $\mathcal{O}(d)$ [2]. The method was introduced by Duane, Kennedy, Pendleton, and Roweth in 1987 for lattice field theory [3]; Neal's 1996 work on Bayesian neural networks [2] revealed its statistical significance, but adoption was blocked by the need for hand-derived gradients — until the mid-2010s, when automatic differentiation in Stan [4] made HMC a turnkey tool. The subsequent No-U-Turn Sampler [7] eliminated manual trajectory-length tuning, and the rank-normalized $\hat{R}$ and bulk/tail effective sample sizes of Vehtari et al. [9] gave practitioners a principled stopping rule. This thesis reconstructs that entire arc: dynamics, discretization, adaptivity, variational alternatives, and diagnostics.

## 2 Background

### 2.1 The Bayesian computational problem

Given data $y$ and parameters $\theta \in \mathbb{R}^d$, we seek posterior expectations $\mathbb{E}_{\pi}[f] = \int f(\theta)\,\pi(\theta \mid y)\,d\theta$. Markov chain Monte Carlo constructs a Markov chain whose stationary distribution is $\pi$ and estimates $\mathbb{E}_{\pi}[f]$ by ergodic averages. The *efficiency* of the chain is governed not by its stationary distribution but by its autocorrelation structure: a chain that proposes distant states with high acceptance mixes fast.

> **Theorem (Metropolis–Hastings detailed balance).** Let $q(\cdot \mid \theta)$ be a proposal kernel and $\alpha(\theta, \theta') = \min\{1, \pi(\theta')q(\theta \mid \theta') / \pi(\theta)q(\theta' \mid \theta)\}$ the acceptance probability. Then the resulting transition kernel satisfies detailed balance with respect to $\pi$, and hence $\pi$ is stationary. *Proof sketch.* Standard; see [2, §2].

Random-walk Metropolis uses a symmetric Gaussian proposal; reversibility then reduces to $\alpha = \min(1, \pi(\theta')/\pi(\theta))$. In $d$ dimensions, maintaining a non-vanishing acceptance rate forces the proposal scale to $\mathcal{O}(d^{-1/2})$, so crossing a distribution of diameter $\mathcal{O}(1)$ takes $\mathcal{O}(d)$ steps — the random-walk penalty [2].

### 2.2 Hamiltonian dynamics in brief

A Hamiltonian system on phase space $(\theta, p) \in \mathbb{R}^{2d}$ evolves under

$$
\frac{d\theta}{dt} = \nabla_p H(\theta, p), \qquad \frac{dp}{dt} = -\nabla_\theta H(\theta, p),
$$

where $H(\theta, p) = U(\theta) + K(p)$ is the total energy. For HMC we set the *potential energy* $U(\theta) = -\log \pi(\theta \mid y)$ and the *kinetic energy* $K(p) = \tfrac{1}{2}p^\top M^{-1} p$ with a symmetric positive-definite *mass matrix* $M$. Three properties of Hamiltonian flow are load-bearing for sampling:

1. **Energy conservation:** $dH/dt = 0$ along exact trajectories, so proposals far from the start are accepted with probability near one.
2. **Volume preservation (Liouville):** the flow is a symplectomorphism; no Jacobian correction is needed in the Metropolis acceptance step.
3. **Reversibility:** negating $p$ and integrating backward retraces the trajectory, which is exactly what detailed balance demands [2].

| Property | Continuous dynamics | Leapfrog (discrete) |
|---|---|---|
| Energy conservation | Exact | Approximate, error $\mathcal{O}(\epsilon^2)$ |
| Volume preservation | Exact (symplectic) | Exact (symplectic) |
| Reversibility | Exact | Exact |
| Cost per step | — | One gradient evaluation |

*Table 1: The leapfrog integrator inherits the two properties required for a valid Metropolis proposal — symplecticity and reversibility — while energy is conserved only approximately.*

## 3 Methodology

### 3.1 The HMC transition

One HMC iteration from $\theta^{(t)}$ proceeds as follows [1][2]:

1. **Momentum resampling:** draw $p \sim \mathcal{N}(0, M)$ independently of $\theta^{(t)}$.
2. **Trajectory simulation:** integrate Hamilton's equations for $L$ leapfrog steps of size $\epsilon$, starting at $(\theta^{(t)}, p)$, producing $(\theta^*, p^*)$.
3. **Metropolis correction:** accept $\theta^{(t+1)} = \theta^*$ with probability $\alpha = \min\{1, \exp(H(\theta^{(t)}, p) - H(\theta^*, p^*))\}$; otherwise $\theta^{(t+1)} = \theta^{(t)}$.

Because the momentum is freshly randomized each iteration, the marginal chain on $\theta$ is ergodic even though each deterministic trajectory is measure-preserving. The acceptance probability depends only on the *energy error* accumulated by the integrator — which is why a symplectic integrator is non-negotiable.

### 3.2 The leapfrog integrator

The leapfrog (Störmer–Verlet) scheme interleaves half-steps of momentum with full steps of position:

```python
def leapfrog(theta, p, eps, grad_U, M_inv):
    """One symplectic leapfrog step for separable Hamiltonian H = U + K."""
    p = p - 0.5 * eps * grad_U(theta)   # half-step momentum
    theta = theta + eps * (M_inv @ p)   # full-step position
    p = p - 0.5 * eps * grad_U(theta)   # half-step momentum
    return theta, p
```

Each update is a *shear* in phase space, hence volume-preserving; the composition of shears is symplectic, and reversing the momentum retraces the steps exactly [2]. The local energy error is $\mathcal{O}(\epsilon^3)$ per step, accumulating to $\mathcal{O}(\epsilon^2)$ globally — small enough that acceptance rates of 65–80% are achievable even in hundreds of dimensions.

### 3.3 Probabilistic programming realization

Stan expresses the log-density as a program and differentiates it by reverse-mode automatic differentiation [4]. A hierarchical model becomes:

```stan
data {
  int<lower=0> N;
  vector[N] y;
}
parameters {
  real mu;
  real<lower=0> sigma;
  vector[N] theta;
  real<lower=0> tau;
}
model {
  mu ~ normal(0, 10);
  tau ~ cauchy(0, 5);
  theta ~ normal(mu, tau);
  y ~ normal(theta, sigma);
}
```

The compiler builds the expression graph for $\log \pi(\mu, \sigma, \theta, \tau \mid y)$ once; every leapfrog step then evaluates the gradient at the cost of a small multiple of one log-density evaluation [4]. Pyro [5] and NumPyro [6] generalize this idea: NumPyro's effect-handler design composes with JAX transformations (`jit`, `vmap`, `grad`), so the same NUTS kernel runs on GPUs and vectorizes across chains [6].

## 4 Deep Dive

### 4.1 Geometry of the mass matrix and preconditioning

The mass matrix $M$ is a *preconditioner*: with $M = \Sigma^{-1}$ approximating the posterior precision, the transformed variables $\tilde{\theta} = M^{1/2}\theta$ have roughly unit scale in every direction and HMC mixes isotropically [2]. In practice Stan adapts a diagonal (optionally dense) estimate of $M$ during warmup from the sample covariance of the chain [4]. A diagonal $M$ rescales axes; a dense $M$ additionally rotates them, at $\mathcal{O}(d^3)$ Cholesky cost per adaptation window — worthwhile only when $d$ is moderate and correlations are severe. Mis-specification of $M$ does not bias the stationary distribution (the Metropolis correction absorbs it); it only degrades efficiency, gracefully rather than catastrophically.

> **Theorem (Validity of HMC).** If the integrator is volume-preserving and reversible, the HMC transition kernel leaves $\pi(\theta, p) \propto \exp(-H(\theta, p))$ invariant, and the $\theta$-marginal of the chain is $\pi(\theta \mid y)$. *Proof sketch.* Reversibility plus volume preservation makes the proposal kernel symmetric in the appropriate sense; the Metropolis acceptance then enforces detailed balance exactly as in the general theorem [2, §5].

### 4.2 The No-U-Turn Sampler: adaptivity without tears

HMC's Achilles' heel was the pair $(\epsilon, L)$: too small an $\epsilon L$ and the chain random-walks; too large and trajectories loop back, wasting gradient evaluations. Hoffman and Gelman [7] removed $L$ from the user's hands with two ideas:

- **Recursive doubling.** From the current state, NUTS builds a binary tree of leapfrog steps, doubling the trajectory in a random direction at each depth $j = 0, 1, \dots$, until a stopping criterion fires or a maximum depth is reached.
- **The U-turn criterion.** Doubling stops when the trajectory begins to retrace itself, detected by $(\theta^+ - \theta^-) \cdot p^- < 0$ or $(\theta^+ - \theta^-) \cdot p^+ < 0$, where $\theta^\pm, p^\pm$ are the extreme states of the current subtree [7].

Within the completed tree, NUTS samples a state by *slice sampling*: draw $u \sim \mathrm{Uniform}(0, \exp(-H(\theta, p)))$ and select uniformly among tree nodes with $\exp(-H) \geq u$, weighting subtrees to preserve detailed balance across the doubling construction [7]. A dual-averaging scheme simultaneously adapts $\epsilon$ toward a target acceptance statistic (typically $\delta = 0.8$). The result is a sampler with essentially one tuning knob that is tuned automatically — the configuration shipping in Stan, PyMC, Pyro, and NumPyro [4][5][6][7].

Divergent transitions — leapfrog steps whose energy error explodes — deserve special mention: they are not merely inefficiency but a *diagnostic*, flagging regions of high posterior curvature (often the neck of a funnel geometry) where the sampler cannot be trusted [4][7].

### 4.3 Variational inference and ADVI: the fast alternative

Markov chain Monte Carlo is asymptotically exact but inherently sequential. Variational inference (VI) instead posits a parametric family $q_\phi(\theta)$ and minimizes $\mathrm{KL}(q_\phi \,\|\, \pi)$, equivalently maximizing the evidence lower bound (ELBO). Automatic Differentiation Variational Inference [8] made VI as turnkey as HMC: it maps constrained parameters to $\mathbb{R}^d$, posits a Gaussian (full-rank or mean-field) on the transformed space, and optimizes the ELBO with stochastic gradients obtained by automatic differentiation and the reparameterization trick.

The trade-off is sharp and well documented [8]:

| Criterion | NUTS / HMC | ADVI (mean-field) |
|---|---|---|
| Asymptotic exactness | Yes | No (mode-seeking, under-dispersed) |
| Wall-clock to a usable answer | Minutes–hours | Seconds–minutes |
| Multimodal posteriors | Explores modes (slowly) | Collapses to one mode |
| Uncertainty calibration | Accurate | Overconfident |
| Gradient evaluations | $10^4$–$10^6$ | $10^3$–$10^4$ |

A disciplined Bayesian workflow therefore uses ADVI for model development and initialization — indeed, Stan uses ADVI draws to initialize NUTS chains [4] — and reserves HMC/NUTS for final inference [8].

### 4.4 Convergence diagnostics: $\hat{R}$ and effective sample size

A sampler that has not converged is a random number generator with ambitions. The modern standard, due to Vehtari et al. [9], runs $M \geq 4$ chains and computes, per scalar estimand:

- **Split-$\hat{R}$**: each chain is split in half; $\hat{R}$ compares between-chain to within-chain variance after *rank normalization* (replacing values by normal scores of their ranks), which makes the diagnostic robust to heavy tails. $\hat{R} \leq 1.01$ is the recommended threshold for trustworthy inference [9].
- **Bulk-ESS and tail-ESS**: the effective sample size $S_{\mathrm{eff}} = MN / (1 + 2\sum_{t} \hat{\rho}_t)$ rescales the nominal draw count by autocorrelation, computed on rank-normalized draws (bulk) and on indicators of extreme quantiles (tail, e.g. 5% and 95%) [9]. Tail-ESS governs the reliability of interval estimates; $S_{\mathrm{eff}} \gtrsim 400$ per quantity is the practical floor.

These diagnostics are necessary, not sufficient: $\hat{R} \approx 1$ across chains initialized in the same basin says nothing about undiscovered modes — which is why multi-start initialization and prior predictive checks remain part of the workflow [9].

## 5 Empirical Results and Theoretical Guarantees

The scaling theory of HMC is unusually favorable. For a $d$-dimensional target with suitably regular log-density, optimally tuned HMC requires $\mathcal{O}(d^{1/4})$ leapfrog steps per effectively independent sample, versus $\mathcal{O}(d)$ for random-walk Metropolis and $\mathcal{O}(d^{1/3})$ for Metropolis-adjusted Langevin [2]. In practice this is not a subtle constant-factor win: on hierarchical models with hundreds of parameters — the eight-schools meta-analysis being the canonical example — NUTS in Stan routinely achieves bulk-ESS per gradient evaluation an order of magnitude above adaptive random-walk baselines, and the gap widens with dimension [4][7].

NUTS's adaptivity has been validated extensively: Hoffman and Gelman [7] show it matches or exceeds hand-tuned HMC across a battery of models, while the dual-averaging step-size adaptation provably converges to the target acceptance rate under standard stochastic-approximation conditions. For ADVI, Kucukelbir et al. [8] demonstrate speedups of one to two orders of magnitude over NUTS on large models, with the documented cost of underestimated posterior variance — a bias that is small for prediction but material for uncertainty quantification. The rank-normalized diagnostics of [9] were validated on pathological chains (heavy-tailed, multimodal, funnel) where classical $\hat{R}$ failed silently, establishing the 1.01 threshold now enforced by default in Stan, ArviZ, and posterior tooling.

---

## 6 Limitations

Hamiltonian methods are not universal solvents. **(i) Discrete parameters** admit no gradient; Stan marginalizes them out analytically, and Pyro resorts to mixed strategies [4][5]. **(ii) Multimodality**: HMC trajectories cannot tunnel through low-density barriers, so widely separated modes are explored only by luck of initialization — tempering or mode-hopping extensions remain active research [2]. **(iii) Stiff geometries**: Neal's funnel and other hierarchical pathologies produce divergences that no step-size adaptation can fully cure; reparameterization (non-centered forms) is the practitioner's remedy [4][7]. **(iv) Cost model**: each leapfrog step costs a full gradient evaluation, so for models with expensive likelihoods (large $N$, ODE-embedded likelihoods) the per-iteration cost can dominate, favoring ADVI or surrogate approaches [8]. **(v) Diagnostics are one-sided**: as noted, $\hat{R} \approx 1.01$ certifies agreement among the chains actually run, not coverage of the true posterior [9].

## 7 Conclusion

The trajectory from Duane et al.'s 1987 hybrid Monte Carlo [3] to the contemporary NUTS-based probabilistic programming stack [4][5][6][7] is a case study in how a physical analogy — particles gliding over a log-density landscape — became industrial infrastructure. Three ingredients proved decisive: symplectic numerical integration that keeps the Metropolis correction honest [2], the No-U-Turn criterion that automated the last manual tuning parameter [7], and automatic differentiation that freed users from deriving a single gradient by hand [4]. ADVI [8] supplies the complementary fast-but-approximate regime, and rank-normalized $\hat{R}$ with bulk and tail effective sample sizes [9] supplies the discipline to know when the computation can be believed. Together they define the modern Bayesian workflow: prototype with variational methods, infer with Hamiltonian dynamics, and trust only what the diagnostics certify.

## References

[1] R. M. Neal, "MCMC using Hamiltonian dynamics," in *Handbook of Markov Chain Monte Carlo*, S. Brooks, A. Gelman, G. Jones, and X.-L. Meng, Eds. Chapman & Hall/CRC, 2011, ch. 5. arXiv:1206.1901. https://arxiv.org/abs/1206.1901

[2] M. Betancourt, "A conceptual introduction to Hamiltonian Monte Carlo," arXiv:1701.02434, 2017. https://arxiv.org/abs/1701.02434

[3] S. Duane, A. D. Kennedy, B. J. Pendleton, and D. Roweth, "Hybrid Monte Carlo," *Physics Letters B*, vol. 195, no. 2, pp. 216–222, 1987. https://doi.org/10.1016/0370-2693(87)91197-X

[4] B. Carpenter et al., "Stan: A probabilistic programming language," *Journal of Statistical Software*, vol. 76, no. 1, 2017. https://doi.org/10.18637/jss.v076.i01

[5] E. Bingham et al., "Pyro: Deep universal probabilistic programming," *Journal of Machine Learning Research*, vol. 20, no. 28, pp. 1–6, 2019. https://www.jmlr.org/papers/v20/18-403.html

[6] D. Phan, N. Pradhan, and M. Jankowiak, "Composable effects for flexible and accelerated probabilistic programming in NumPyro," arXiv:1912.11554, 2019. https://arxiv.org/abs/1912.11554

[7] M. D. Hoffman and A. Gelman, "The No-U-Turn Sampler: Adaptively setting path lengths in Hamiltonian Monte Carlo," *Journal of Machine Learning Research*, vol. 15, pp. 1593–1623, 2014. https://www.jmlr.org/papers/volume15/hoffman14a/hoffman14a.pdf

[8] A. Kucukelbir, D. Tran, R. Ranganath, A. Gelman, and D. M. Blei, "Automatic differentiation variational inference," *Journal of Machine Learning Research*, vol. 18, no. 14, pp. 1–45, 2017. https://www.jmlr.org/papers/v18/16-107.html

[9] A. Vehtari, A. Gelman, D. Simpson, B. Carpenter, and P.-C. Bürkner, "Rank-normalization, folding, and localization: An improved $\hat{R}$ for assessing convergence of MCMC (with discussion)," *Bayesian Analysis*, vol. 16, no. 2, pp. 667–718, 2021. arXiv:1903.08008. https://arxiv.org/abs/1903.08008

