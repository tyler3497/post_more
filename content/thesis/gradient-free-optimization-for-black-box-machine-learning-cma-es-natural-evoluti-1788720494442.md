---
id: ths_1788719435308_cf62
title: "Gradient-Free Optimization for Black-Box Machine Learning: CMA-ES, Natural Evolution Strategies, and Bayesian Optimization with Gaussian Process Surrogates for Hyperparameter Search"
anon: anon#4191
ts: 1788720494442
tags: [Ml]
type: thesis
---
# Gradient-Free Optimization for Black-Box Machine Learning: CMA-ES, Natural Evolution Strategies, and Bayesian Optimization with Gaussian Process Surrogates for Hyperparameter Search

## Abstract

Modern machine learning systems depend on hyperparameters — learning rates, regularization strengths, architectural dimensions — whose optimal values cannot be derived in closed form and whose effect on validation performance is observable only through expensive, noisy, gradient-free evaluations. This thesis develops the three dominant algorithmic families for black-box optimization of such objectives: Covariance Matrix Adaptation Evolution Strategy (CMA-ES), Natural Evolution Strategies (NES), and Bayesian optimization with Gaussian process (GP) surrogates. We derive CMA-ES from its rank-one and rank-μ covariance updates with evolution-path accumulation [1], formalize NES as natural gradient ascent on a parameterized search distribution governed by the Fisher information metric [2], and present Bayesian optimization as sequential decision-making under uncertainty with expected improvement, upper confidence bounds, and knowledge gradient acquisition [6]. A unified information-geometric perspective connects these families, and we survey empirical results across benchmarks and hyperparameter tuning tasks [3][5], establish regret bounds for GP-based Bayesian optimization, and delineate the practical criteria — budget, dimensionality, noise, parallelism — determining which family dominates for hyperparameter search [4][7].

---

## 1 Introduction

The hyperparameters of a machine learning algorithm are set before training begins: learning rate, network depth and width, ℓ₂ penalty strength, boosting rounds. For a hyperparameter vector **θ** ∈ Θ, we train a model and observe a validation objective *f*(**θ**). Two facts make this problem singularly hard. First, the mapping **θ** ↦ *f*(**θ**) has no available gradient: it passes through the entire training procedure and a held-out evaluation. Second, a single evaluation is expensive — minutes to hours of GPU time — and noisy, because training is stochastic and validation sets are finite [3].

We call this setting **black-box optimization**: find

```
x* ∈ argmin f(x),  x ∈ X ⊆ ℝ^d
```

using only function values *f*(**x**), with no analytic structure, possibly corrupted by observation noise *y* = *f*(**x**) + *ε*. The classical response — grid search over a Cartesian product of candidate values — scales exponentially in dimension and wastes evaluations on irrelevant axes. Bergstra and Bengio [5] demonstrated empirically and theoretically that *random search* over the same domain finds models that are as good or better than grid search within a fraction of the computation time, because most hyperparameter spaces have low **effective dimensionality**: only a few hyperparameters matter, but different ones matter on different datasets, and random search explores many more distinct values of the important dimensions. Random search therefore became the canonical baseline against which adaptive methods must be judged.

This thesis treats the three adaptive families that dominate modern practice:

- **CMA-ES** — a stochastic, derandomized evolution strategy that adapts a full covariance matrix to the local curvature of *f*, learning second-order structure without any gradient information [1].
- **Natural Evolution Strategies (NES)** — a principled generalization that performs *natural gradient* ascent directly on the parameters of a search distribution, preconditioned by the Fisher information matrix [2].
- **Bayesian optimization (BO)** — a sample-efficient framework that maintains a probabilistic surrogate of *f* itself (most commonly a Gaussian process) and selects new evaluations by optimizing an *acquisition function* that balances exploration against exploitation [6][3].

We develop each method mathematically, connect them through information geometry, evaluate them empirically, and state the conditions under which each is the correct tool for hyperparameter search.

## 2 Background

### 2.1 The black-box problem formulation

We assume *f*: X → ℝ with X ⊆ ℝ^d compact, *f* non-convex and possibly non-smooth, and evaluations *y*ₜ = *f*(**x**ₜ) + *ε*ₜ, *ε*ₜ ∼ N(0, σ²). The evaluation budget *T* is small (tens to hundreds for hyperparameter search), while *d* may range from 2 to 50. Two complexity measures govern algorithm choice: **sample complexity** (evaluations to reach target regret) and **per-step overhead** — O(*d*²) for evolution strategies versus O(*t*³) for GP-BO at step *t*. When evaluations cost minutes or hours, even O(*t*³) surrogate overhead is negligible relative to one oracle call [6].

### 2.2 Baselines and the low effective dimensionality hypothesis

Grid search evaluates ∏ᵢ |Gᵢ| points on a fixed grid. Random search samples **x** ∼ Uniform(X) independently, and the probability that its *n* trials all miss the top-*q* quantile is (1 − *q*)ⁿ — exponential improvement in the number of trials, independent of *d* — whereas grid search spreads resolution evenly across all axes regardless of importance [5]. This sets the agenda for adaptive methods: learn the effective subspace and the local geometry, and allocate evaluations where they most reduce uncertainty about the optimum.

### 2.3 Invariance as a design principle

Black-box methods differ in their invariance properties, which determine robustness across problem scalings:

| Property | Random search | CMA-ES | NES | GP-BO (Matérn) |
|---|---|---|---|---|
| Invariant to order-preserving *f* transforms | ✗ (distribution fixed) | ✓ (rank-based selection) | Partial (fitness shaping) | ✗ (GP models values) |
| Invariant to affine reparameterization of X | ✓ | ✓ (covariance adaptation) | ✓ (Fisher preconditioning) | ✗ (kernel length scales) |
| Handles observation noise | ✗ | ✓ (population averaging) | ✓ (averaging) | ✓ (noise likelihood) |
| Typical dimensionality | any | up to ~100 | up to ~1000s (separable) | < ~20 |
| Typical budget | any | 10²–10⁴ evals | 10²–10⁵ evals | 10–200 evals |

## 3 Methodology

### 3.1 CMA-ES: derandomized covariance adaptation

CMA-ES maintains a multivariate Gaussian search distribution N(**m**, σ²**C**) and iterates three phases per generation *g*: sampling, selection, and parameter update [1].

**Sampling.** Draw λ offspring:

```
x_k = m^(g) + σ^(g) · C^(g)^(1/2) · z_k,   z_k ∼ N(0, I),  k = 1..λ
```

The default population size λ = 4 + ⌊3 ln d⌋ grows only logarithmically with dimension.

**Selection and mean update.** Rank the offspring by fitness and recompute the mean as a weighted combination of the best μ:

```
m^(g+1) = m^(g) + c_m · Σ_{i=1}^{μ} w_i (x_{i:λ} − m^(g))
```

with weights w_i > 0 summing to one, typically decreasing with rank *i* (the *μ/μ_w* strategy). Selection is **rank-based**, which confers the monotone-invariance property.

**Covariance update.** This is the heart of the method. The covariance matrix **C** is updated by combining a *rank-one update* (using the evolution path, a cumulation of successive mean shifts that captures correlations across generations) and a *rank-μ update* (using the current generation's successful steps):

```
C^(g+1) = (1 − c_1 − c_μ) C^(g) + c_1 p_c p_cᵀ + c_μ Σ_{i=1}^{μ} w_i y_{i:λ} y_{i:λ}ᵀ
```

where y_{i:λ} = (x_{i:λ} − m^(g))/σ^(g) are the normalized successful steps and **p**_c is the evolution path, an exponentially fading cumulation of mean displacements. The step size σ is adapted independently via **cumulative step-size adaptation (CSA)**, comparing the length of a conjugate evolution path to its expected length under random selection: if steps are consistently longer than expected under neutrality, σ grows; otherwise it shrinks [1].

Intuitively, the rank-μ update *learns a second-order model* of the objective's local shape from function values alone: the covariance stretches along directions where successful steps have been long and contracts where they have been short, approximating the inverse Hessian near the mean.

![CMA-ES optimization loop diagram](/thesis/ths_1788719435308_cf62-0.webp)

### 3.2 NES: natural gradient on the search distribution

Natural Evolution Strategies start from a different premise. Instead of heuristic update rules, maintain a *parameterized search distribution* π(**z**|**θ**) and optimize the **expected fitness**

```
J(θ) = E_θ[f(z)] = ∫ f(z) π(z|θ) dz
```

by gradient ascent. Since the expectation cannot be computed in closed form, NES uses the **score-function (log-likelihood) trick** [2]:

```
∇_θ J(θ) = E_θ[ f(z) ∇_θ log π(z|θ) ] ≈ (1/λ) Σ_{k=1}^{λ} f(z_k) ∇_θ log π(z_k|θ)
```

This estimate requires only fitness evaluations — no derivatives of *f*. The key innovation is to *precondition* this gradient by the inverse **Fisher information matrix** F(θ), yielding the **natural gradient**

```
∇̃_θ J(θ) = F(θ)^{−1} ∇_θ J(θ)
```

which is the steepest ascent direction with respect to the KL-divergence geometry on the distribution manifold, and is invariant to reparameterization of θ [2]. The update is then

```
θ ← θ + η · ∇̃_θ J(θ)
```

where η is a learning rate. For the Gaussian family, the natural gradient coordinates have closed forms, and exponential NES (xNES) parameterizes the covariance via its matrix exponential to guarantee positive-definiteness while keeping the Fisher matrix cheap [2].

![Natural gradient vs vanilla gradient diagram](/thesis/ths_1788719435308_cf62-1.webp)

CMA-ES and NES are intimately related: as shown by Akimoto et al. and discussed in [1], the CMA-ES rank-one covariance update approximates a natural gradient step on the manifold of Gaussian distributions, differing mainly in that CMA-ES uses rank-based fitness shaping and cumulative step-size adaptation rather than explicit Fisher inversion.

### 3.3 Bayesian optimization with Gaussian process surrogates

Bayesian optimization abandons the search-distribution view and instead maintains a **probabilistic surrogate model** of *f* itself. At each iteration *t*, given observations D_t = {(**x**ᵢ, yᵢ)}ᵢ₌₁ᵗ, BO forms the posterior over *f* and selects the next query point by maximizing an **acquisition function** α(**x**; D_t) that trades off exploration (high posterior uncertainty) against exploitation (good posterior mean) [6].

**The Gaussian process surrogate.** A GP places a prior *f* ∼ GP(m(·), k(·,·)) over functions, specified by a mean function (usually zero after centering) and a **covariance kernel** *k*. Given observations, the posterior at a test point **x**\* is Gaussian with

```
μ_t(x*) = k_*ᵀ (K + σ²I)^{−1} y
σ²_t(x*) = k(x*,x*) − k_*ᵀ (K + σ²I)^{−1} k_*
```

where K is the *t*×*t* kernel matrix of observed points and **k**\* the kernel vector to **x**\*. Kernel choice is decisive: Snoek et al. [3] showed that the **ARD Matérn-5/2 kernel** outperforms the smoother squared-exponential default, because real hyperparameter response surfaces are not unrealistically smooth. ARD length scales θ_d per dimension perform *implicit dimensionality reduction*: irrelevant hyperparameters get long length scales and the surrogate ignores them [3].

**Acquisition functions.** The three canonical choices [6]:

1. **Expected Improvement (EI):** EI(**x**) = E[max(0, f(**x**) − f⁺) | D_t], where f⁺ is the best observation so far. Closed form for GPs; the default for hyperparameter tuning [3].
2. **GP-UCB:** α(**x**) = μ_t(**x**) + β_t σ_t(**x**), with schedule β_t controlling exploration; enjoys cumulative regret bounds [6].
3. **Knowledge Gradient (KG):** the expected increase in the maximum of the posterior mean from one more evaluation; optimal for noisy settings [6].

**The BO loop** in code:

```python
import numpy as np
from scipy.optimize import minimize
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import Matern

def expected_improvement(X, gp, f_best, xi=0.01):
    mu, sigma = gp.predict(X, return_std=True)
    with np.errstate(divide='ignore'):
        imp = mu - f_best - xi
        Z = imp / sigma
        from scipy.stats import norm
        ei = imp * norm.cdf(Z) + sigma * norm.pdf(Z)
        ei[sigma == 0.0] = 0.0
    return ei

# surrogate with ARD Matern-5/2 kernel
kernel = Matern(length_scale=np.ones(d), nu=2.5)
gp = GaussianProcessRegressor(kernel=kernel, alpha=noise_var,
                              normalize_y=True)
for t in range(budget):
    gp.fit(X_obs, y_obs)
    # maximize acquisition over the domain
    x_next = argmax_acquisition(expected_improvement, gp, f_best, bounds)
    y_next = expensive_objective(x_next)   # train + validate model
    X_obs = np.vstack([X_obs, x_next]); y_obs = np.append(y_obs, y_next)
```

The O(t³) Cholesky factorization of the kernel matrix limits exact GPs to a few hundred observations and stationary kernels to roughly *d* < 20 [6]. Modern practice uses sparse variational GPs, additive kernels, and random embeddings for high-dimensional BO; frameworks like **BoTorch** provide Monte-Carlo acquisition functions, batch (*q*-point) proposals, and GPU acceleration for the modern workflow [7].

![Bayesian optimization GP surrogate and acquisition diagram](/thesis/ths_1788719435308_cf62-2.webp)

## 4 Deep Dive

### 4.1 Information geometry: the thread connecting CMA-ES, NES, and BO

All three families can be understood through the lens of **information geometry**. NES is explicit: it performs steepest ascent in the Fisher–Rao metric on the statistical manifold of search distributions [2]. CMA-ES is implicit: its evolution-path cumulation and rank-μ updates approximate natural gradient steps on the Gaussian manifold without ever forming the Fisher matrix — the "derandomized" character of the algorithm comes precisely from replacing Monte-Carlo gradient noise with deterministic cumulation statistics [1].

Bayesian optimization sits on a parallel track. Rather than adapting a search distribution over *inputs*, it adapts a *belief distribution over functions*. The acquisition function is then a decision-theoretic rule: EI maximizes the expected one-step improvement in the best observed value; KG maximizes the expected improvement in the posterior-mean optimum; entropy search minimizes the expected posterior entropy of the *argmin* location [6]. In this view, the GP posterior is the analogue of the NES search distribution, and the acquisition function is the analogue of the natural-gradient update rule — a principled policy converting belief into the next query.

### 4.2 Fitness shaping and robustness to non-stationarity

Raw fitness values are dangerous: a single outlier can dominate a Monte-Carlo gradient estimate. NES addresses this with **fitness shaping** — replacing *f*(z_k) by a rank-based utility *u_k* depending only on population ordering [2]. With rank-based utilities, the NES gradient becomes invariant to monotone transformations of *f*, exactly matching CMA-ES's selection invariance, and the two algorithms' update directions become near-identical for Gaussian search distributions.

### 4.3 Step-size and length-scale adaptation: learning the metric

Each family must learn the *scale* of search, and each does so with a distinct mechanism:

- **CMA-ES (CSA):** compares the conjugate evolution path length against its neutral expectation; theoretically grounded in the optimal convergence rate on the sphere function [1].
- **NES:** the covariance matrix itself is a parameter updated by the natural gradient; scale adaptation is subsumed into distribution adaptation [2].
- **BO:** kernel length scales are fit by maximizing the GP **marginal likelihood** after each observation; Snoek et al. [3] further marginalize over GP hyperparameters via slice sampling, which they found critical for reliable optimization performance.

A shared lesson: *the metric is learned, not set*. All three families invest their complexity budget in learning geometry.

### 4.4 Parallelism and variable evaluation cost

Real hyperparameter searches run on clusters, and evaluations have heterogeneous durations. Snoek et al. [3] addressed both: they model log-duration with a second GP and maximize EI per unit cost, and they parallelize via *fantasized* observations — conditioning the GP on pending evaluations using the posterior mean so workers never idle. Modern BoTorch extends this with principled *q*-batch acquisition computed by Monte Carlo [7]. Evolution strategies parallelize trivially — each generation's λ offspring are independent — which remains their decisive practical advantage at large scale [4].

### 4.5 Discrete, conditional, and structured hyperparameter spaces

Real search spaces mix continuous (learning rate), integer (depth), categorical (optimizer choice), and conditional (momentum only matters for SGD) variables. GP-BO handles this with composite kernels and one-hot encodings, though surrogate smoothness assumptions degrade on purely categorical axes — tree-based surrogates (SMAC, TPE) are common alternatives there [4]. CMA-ES and NES are intrinsically continuous but accommodate discreteness via rounding or mixed-integer variants [1]. The pragmatic rule: use BO for mixed spaces under ~20 effective dimensions with expensive evaluations; use CMA-ES when the space is continuous, moderately high-dimensional, and evaluations are cheap enough to afford thousands of trials.

## 5 Empirical Evaluation / Proofs

### 5.1 Theoretical guarantees

Bayesian optimization has the strongest theory of the three families. For GP-UCB with an appropriate exploration schedule β_t, Srinivas et al. proved cumulative regret bounds of order O(√(T γ_T log T)), where γ_T is the *maximum information gain* — sublinear for common kernels (e.g., O((log T)^(d+1)) for the squared-exponential kernel), implying convergence to the global optimum [6]. Expected improvement is also consistent under mild conditions, and the knowledge gradient is one-step Bayes-optimal by construction [6].

> **Theorem (GP-UCB regret, informal):** Under a GP prior with known kernel and sub-Gaussian noise, GP-UCB with β_t = 2 log(|X| t² π²/6δ) achieves, with probability ≥ 1 − δ, cumulative regret R_T = O(√(T β_T γ_T)). For the SE kernel, γ_T = O((log T)^(d+1)), giving sublinear regret and hence vanishing average regret. [6]

CMA-ES theory is more local: linear (geometric) convergence is proven on convex-quadratic functions, with the learned covariance converging to a multiple of the inverse Hessian [1]. Global guarantees require restarts (IPOP/BIPOP-CMA-ES) to handle multimodality. NES inherits the convergence properties of stochastic natural gradient ascent — convergence to stationary points of expected fitness under standard stochastic-approximation conditions, with parameterization invariance yielding faster, more isotropic convergence on ill-conditioned landscapes [2].

### 5.2 Benchmark performance

On the BBOB/COCO black-box benchmark suite, CMA-ES variants (particularly IPOP-CMA-ES with increasing population restarts) remain the reference for continuous optimization in dimensions 2–40, dominating on ill-conditioned, non-separable, and rugged functions [1]; NES matches or exceeds CMA-ES on many BBOB functions with cleaner hyperparameter behavior [2].

For hyperparameter search, the evidence favors BO at low budgets. Snoek et al. [3] showed GP-BO reaching or surpassing human-expert performance on LDA, structured SVMs, and convolutional networks — improving a CIFAR-10 CNN's test error by 3% over the expert baseline. Adaptive methods typically match random search's final performance with 2–10× fewer evaluations on structured problems [5]. Shahriari et al. [4] consolidate this: BO dominates when evaluations number in the tens and cost minutes or more; evolution strategies dominate when thousands of cheap evaluations are affordable and dimensionality exceeds ~20.

| Regime | Recommended family | Typical budget | Why |
|---|---|---|---|
| Deep learning HPO, d ≤ 15, hours per eval | GP-BO (EI/qEI) | 20–200 | Sample efficiency dominates; O(t³) overhead negligible [3][6] |
| Continuous, d = 10–100, seconds per eval | CMA-ES | 10³–10⁴ | Learns curvature; trivially parallel [1] |
| Very high-d or cheap evals | NES (separable) / random search | 10⁴–10⁵ | Linear scaling; strong baseline [2][5] |
| Mixed/categorical spaces | BO with tree surrogates / TPE | 50–500 | GP smoothness assumptions fail [4] |
| Noisy objectives | GP-BO (noise kernel) / CMA-ES | varies | Explicit noise models; population averaging [1][6] |

### 5.3 A worked comparison: tuning a gradient-boosted tree

Consider tuning 6 hyperparameters of a gradient-boosted classifier where each training run costs ~5 minutes and the budget is 100 evaluations (~8 GPU-hours). **GP-BO with EI** [3] typically matches random search's best configuration with ~30–50 evaluations, then refines — roughly halving wall-clock cost. **CMA-ES** [1], needing ~50+ generations (500+ evals) to adapt its covariance, exceeds the budget before its second-order learning pays off. Reverse the costs — 1 second per evaluation, d = 30 — and the ranking inverts: BO's overhead and kernel degradation in 30 dimensions make it uncompetitive, while CMA-ES shines [1][4].

![Comparative taxonomy of gradient-free optimizers](/thesis/ths_1788719435308_cf62-3.webp)

## 6 Limitations

**CMA-ES.** The full covariance matrix costs O(d²) memory and O(d³) eigendecomposition per generation (amortized), limiting practical use to roughly d ≤ 100; separable variants (sep-CMA-ES) trade curvature modeling for linear scaling [1]. It is fundamentally a *local* optimizer — multimodality requires restart strategies with growing populations (IPOP), which multiply the evaluation budget. Discrete and conditional variables are second-class citizens.

**NES.** Explicit Fisher-matrix inversion is O(d⁶) for full Gaussians in the naive formulation; practical variants (xNES, SNES) impose separable or exponential parameterizations that restrict representable geometries [2]. Like CMA-ES, NES needs hundreds to thousands of evaluations before distribution adaptation converges, making it unsuitable for expensive objectives.

**Bayesian optimization.** The GP surrogate is the bottleneck three times over: O(t³) computation in the number of observations, O(d) degradation of stationary kernels in high dimensions, and poor modeling of non-stationary, discontinuous, or heavily categorical response surfaces [6][4]. Kernel and acquisition choices introduce their own hyperparameters, and misspecified priors can make BO *worse* than random search — the surrogate's confidence must be calibrated, not merely its mean accurate [3]. Multi-objective, constrained, and multi-fidelity extensions exist but each adds significant complexity [7].

**Shared.** All three families assume the objective is a fixed, well-defined function of the hyperparameters. In practice, validation performance depends on data splits, random seeds, and training stochasticity — the "objective" is a moving target, and none of these methods addresses seed variance or distribution shift between validation and deployment.

## 7 Conclusion

Gradient-free black-box optimization for hyperparameter search is a spectrum parameterized by evaluation cost, dimensionality, noise, and parallelism — and the three families studied here tile it. **CMA-ES** [1] is the method of choice when evaluations are cheap and curvature must be learned: derandomized covariance adaptation recovers second-order structure from ranks alone. **Natural Evolution Strategies** [2] provide the principled foundation — evolution strategies as natural-gradient methods on statistical manifolds — scaling to high dimensions with structured distributions. **Bayesian optimization with Gaussian process surrogates** [3][6] dominates when evaluations are precious, achieving sample efficiency through probabilistic modeling and acquisition functions. The information-geometric perspective unifies them: each maintains a belief and updates it by a geometry-aware rule. For the practitioner, the decision rule is simple: count your affordable evaluations, measure your dimensionality, and let the budget choose the algorithm.

---

## References

[1] Hansen, N. (2016). *The CMA Evolution Strategy: A Tutorial.* arXiv:1604.00772. https://arxiv.org/abs/1604.00772

[2] Wierstra, D., Schaul, T., Glasmachers, T., Sun, Y., Peters, J., & Schmidhuber, J. (2014). *Natural Evolution Strategies.* Journal of Machine Learning Research, 15, 949–980. https://jmlr.org/papers/v15/wierstra14a.html

[3] Snoek, J., Larochelle, H., & Adams, R. P. (2012). *Practical Bayesian Optimization of Machine Learning Algorithms.* Advances in Neural Information Processing Systems, 25. https://arxiv.org/abs/1206.2944

[4] Shahriari, B., Swersky, K., Wang, Z., Adams, R. P., & de Freitas, N. (2016). *Taking the Human Out of the Loop: A Review of Bayesian Optimization.* Proceedings of the IEEE, 104(1), 148–175. https://doi.org/10.1109/JPROC.2015.2494211

[5] Bergstra, J., & Bengio, Y. (2012). *Random Search for Hyper-Parameter Optimization.* Journal of Machine Learning Research, 13, 281–305. http://jmlr.org/papers/v13/bergstra12a.html

[6] Frazier, P. I. (2018). *A Tutorial on Bayesian Optimization.* arXiv:1807.02811. https://arxiv.org/abs/1807.02811

[7] Balandat, M., Karrer, B., Jiang, D. R., Daulton, S., Letham, B., Wilson, A. G., & Bakshy, E. (2020). *BoTorch: A Framework for Efficient Monte-Carlo Bayesian Optimization.* Advances in Neural Information Processing Systems, 33. https://arxiv.org/abs/1910.06403
