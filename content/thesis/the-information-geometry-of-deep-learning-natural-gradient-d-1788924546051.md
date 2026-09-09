---
id: ths_1788924546051_a1b2
title: "The Information Geometry of Deep Learning: Natural Gradient Descent, Kronecker-Factored Curvature Approximation, and Second-Order Optimization Theory"
anon: anon#2088
ts: 1788924546051
tags: []
type: thesis
---
# The Information Geometry of Deep Learning: Natural Gradient Descent, Kronecker-Factored Curvature Approximation, and Second-Order Optimization Theory

## Abstract

Second-order optimization of deep neural networks is one of the most theoretically rich problems in machine learning. This thesis develops the information-geometric foundations of natural gradient descent, from Amari's Fisher–Rao Riemannian metric on statistical manifolds through the reparameterization invariance that distinguishes the natural gradient from the Euclidean gradient. We formalize the Fisher information matrix and its empirical counterpart, derive the steepest-descent direction under Kullback–Leibler divergence, and explain why exact natural gradient computation is intractable at scale. The central contribution is a rigorous treatment of Kronecker-factored approximate curvature (K-FAC) [2][3], which approximates layer-wise Fisher blocks as Kronecker products of activation and pre-activation-gradient covariance matrices, yielding tractable inverses via (A ⊗ B)⁻¹ = A⁻¹ ⊗ B⁻¹. We further examine Tikhonov damping, the Shampoo optimizer, convergence guarantees under quadratic models and Polyak–Łojasiewicz conditions, and large-batch training. We conclude with limitations — including the empirical-vs-true Fisher gap — and directions toward affine-invariant optimizers at scale.

---

## 1 Introduction

The optimization of deep neural networks is conventionally framed as minimizing an empirical risk function *L(θ)* over parameters *θ ∈ ℝᵈ* via first-order methods such as stochastic gradient descent (SGD) [1]. Yet the parameter space of a neural network is not merely a Euclidean vector space: each parameter vector *θ* indexes a probability distribution *p(y|x; θ)*, and the collection {p(·; θ) : θ ∈ Θ} forms a **statistical manifold** whose natural geometry is induced not by the Euclidean inner product but by the Fisher information matrix (FIM) [1][4]. Amari's program of information geometry, initiated in the 1980s and crystallized in his 1998 paper on natural gradient learning, established that the "true" steepest descent direction for a loss defined on a statistical manifold is obtained by preconditioning the Euclidean gradient with the inverse FIM [1].

This distinction is far from academic ornament. Euclidean gradient descent implicitly assumes that a unit step in any parameter direction produces a unit change in the underlying function — an assumption flagrantly violated by deep networks, where ill-conditioning, plateaus, and singular parameterizations (e.g., saddle structures where weights vanish) slow first-order methods catastrophically [1][5]. The natural gradient, by contrast, is **invariant under reparameterization**: it measures progress in terms of the KL divergence between successive model distributions rather than Euclidean distance in parameter space. As Amari showed, this invariance yields Fisher efficiency in maximum-likelihood estimation and the ability to escape plateaus that trap ordinary gradient descent [1][4].

The central obstacle is computational. The FIM of a network with *d* parameters is a *d × d* matrix whose inversion costs *O(d³)* — utterly infeasible when *d* reaches millions or billions. This thesis surveys the theoretical and algorithmic machinery developed to make natural gradient practical, with emphasis on **Kronecker-factored approximate curvature (K-FAC)** [2][3]: a method that approximates Fisher blocks corresponding to entire layers as Kronecker products of two much smaller matrices, achieving inversion in time cubic in the layer width rather than in the parameter count. We develop the mathematical foundations (§2), the derivation of K-FAC (§3), its refinements and competitors (§4), empirical and convergence-theoretic results (§5), limitations (§6), and conclusions (§7).

> **Thesis statement:** Information geometry provides the correct Riemannian structure for neural network optimization; K-FAC is the most practical known realization of natural gradient descent at scale, but its approximation quality, damping heuristics, and interplay with stochastic estimation remain active theoretical frontiers.

---

## 2 Background

### 2.1 Statistical manifolds and the Fisher–Rao metric

Consider a parametric family of probability densities *S = {p(x; θ) : θ ∈ Θ ⊂ ℝᵈ}*. Information geometry, founded by Amari, treats *S* as a differentiable manifold where the Riemannian metric is given by the **Fisher information matrix**:

$$G_{ij}(\theta) = \mathbb{E}_{p(x;\theta)}\left[ \frac{\partial \log p(x;\theta)}{\partial \theta_i} \, \frac{\partial \log p(x;\theta)}{\partial \theta_j} \right] = -\mathbb{E}_{p(x;\theta)}\left[ \frac{\partial^2 \log p(x;\theta)}{\partial \theta_i \partial \theta_j} \right].$$

The equivalence of the two forms follows from differentiating the normalization identity ∫ p(x; θ)dx = 1 twice. The Fisher–Rao metric emerges as the Hessian of the Kullback–Leibler divergence: for an infinitesimal displacement *dθ*,

$$D_{KL}(p(\cdot;\theta) \,\|\, p(\cdot;\theta+d\theta)) = \frac{1}{2} \sum_{i,j} G_{ij}(\theta)\, d\theta_i\, d\theta_j + o(\|d\theta\|^2).$$

Thus KL divergence induces a Riemannian geometry whose metric tensor is exactly the FIM [1]. On this manifold, the direction of steepest descent of an objective *ℓ(θ)* is not −∇ℓ but the **natural gradient**:

$$\tilde{\nabla}\ell(\theta) = G(\theta)^{-1} \nabla\ell(\theta).$$

### 2.2 Invariance: the core advantage of the natural gradient

> **Theorem (Amari, 1998):** The natural gradient direction is invariant under smooth reparameterization. If *θ = φ(ξ)* with *φ* a diffeomorphism, then the natural gradient flow in *ξ*-coordinates maps to the identical trajectory of distributions as the natural gradient flow in *θ*-coordinates [1].

*Proof sketch.* Under *θ = φ(ξ)*, the Fisher matrices transform as *G_ξ = JᵀG_θJ* (Jacobian *J = ∂θ/∂ξ*), and Euclidean gradients as *∇_ξ ℓ = Jᵀ∇_θ ℓ*. Hence *G_ξ⁻¹∇_ξℓ = J⁻¹G_θ⁻¹∇_θℓ*, which is precisely the pushforward of the natural gradient vector. The Euclidean gradient has no such covariance. ∎

This invariance is what allows natural gradient to traverse plateaus: singular points of the parameterization (e.g., where a hidden unit's outgoing weights are all zero, creating a "singularity" in the map from parameters to functions) are invisible to the Riemannian geometry, whereas they arrest Euclidean descent [1].

### 2.3 True Fisher vs. empirical Fisher

In supervised learning, the model defines *p(y|x; θ)* while the data provide an empirical input distribution. Two distinct matrices arise:

- **True Fisher:** *F(θ) = 𝔼_{x∼q, y∼p(y|x;θ)}[∇log p(y|x;θ) ∇log p(y|x;θ)ᵀ]*, with labels sampled from the model.
- **Empirical Fisher:** *F̂(θ) = (1/N)Σₙ ∇ℓₙ(θ)∇ℓₙ(θ)ᵀ*, using the observed labels.

For maximum likelihood with the log-loss, the true Fisher equals the expected Hessian of the loss at the optimum and is the object appearing in Amari's Fisher-efficiency theorem [1][4]. In practice, K-FAC and related methods typically employ the **empirical** Fisher (or the generalized Gauss–Newton matrix, which coincides with the true Fisher for exponential-family losses with canonical links). The gap between the two — in particular, the empirical Fisher's rank deficiency and its dependence on label noise — is a recurring source of theoretical subtlety [5].

---

## 3 Methodology

### 3.1 Derivation of the K-FAC approximation

Consider a feedforward network with layers *i = 1,…,ℓ*. Let *a_{i−1}* denote the (homogeneous-coordinate-augmented) activations entering layer *i*, *sᵢ = Wᵢā_{i−1}* the pre-activations, and *gᵢ = ∇_{sᵢ} log p(y|x;θ)* the gradient of the log-likelihood with respect to *sᵢ*. The gradient with respect to the weight matrix is the outer product:

$$\nabla_{W_i} \log p = g_i \, \bar{a}_{i-1}^\top, \qquad \mathrm{vec}(\nabla_{W_i}\log p) = \bar{a}_{i-1} \otimes g_i.$$

The Fisher block for layer *i* is then

$$F_{i,i} = \mathbb{E}\left[ (\bar{a}_{i-1}\bar{a}_{i-1}^\top) \otimes (g_i g_i^\top) \right].$$

K-FAC makes two approximations [2]:

1. **Block-diagonal approximation:** cross-layer blocks *F_{i,j}* (*i ≠ j*) are discarded, so *F ≈ diag(F₁₁, …, F_ℓℓ)*.
2. **Kronecker factorization:** the expectation of the Kronecker product is replaced by the Kronecker product of expectations,

$$\hat{F}_{i,i} = \underbrace{\mathbb{E}[\bar{a}_{i-1}\bar{a}_{i-1}^\top]}_{A_{i-1}} \otimes \underbrace{\mathbb{E}[g_i g_i^\top]}_{G_i}.$$

This second step is exact precisely when *ā_{i−1}* and *gᵢ* are statistically independent — a condition that holds exactly for deep linear networks with whitened inputs in certain regimes, and approximately otherwise [3].

The Kronecker structure yields an efficient inverse:

$$\hat{F}_{i,i}^{-1} = A_{i-1}^{-1} \otimes G_i^{-1},$$

so that the natural-gradient update for layer *i* can be computed *without ever forming the Kronecker product*:

$$\mathrm{vec}(\Delta W_i) = (A_{i-1}^{-1} \otimes G_i^{-1})\,\mathrm{vec}(\nabla_{W_i}h) \iff \Delta W_i = G_i^{-1} (\nabla_{W_i} h)\, A_{i-1}^{-1},$$

where *h* is the objective. For a layer of width *n*, this reduces inversion from *O(n⁶)* to *O(n³)* — the pivotal complexity breakthrough [2].

### 3.2 Kronecker-factored curvature for convolutional layers

Weight sharing in convolutional layers complicates the factorization. Grosse and Martens [3] derived the Kronecker-Factored Convolution (KFC) approximation, treating the convolution as a sum over spatial locations and applying analogous independence assumptions across the spatial dimension. Recent work has further identified two distinct flavors — **K-FAC-expand** and **K-FAC-reduce** — for general weight-sharing layers, where K-FAC-reduce is exact for deep linear networks with convolutions and average pooling under the same conditions that make standard K-FAC exact without weight sharing [6]. Both variants empirically reach fixed validation targets in 50–75% of the steps of first-order baselines on vision transformers and graph neural networks [6].

### 3.3 Damping: Tikhonov regularization of the curvature

The approximate Fisher is typically singular or ill-conditioned, so practical implementations add damping. The naïve approach, *(F̂ + λI)⁻¹*, destroys the Kronecker structure. Martens and Grosse [2] instead damp the *factors*:

$$(A_{i-1} + \pi_i\sqrt{\lambda}\,I) \otimes (G_i + \pi_i^{-1}\sqrt{\lambda}\,I),$$

with the scalar *πᵢ* chosen to balance the two factors. Since adding *λI* to the full Kronecker product is intractable, factor-level damping is an approximation whose effective regularization adapts to the scale of each factor — an elegant but theoretically under-characterized heuristic.

---

## 4 Deep Dive

### 4.1 The geometry of the natural gradient step

The natural gradient update *θ ← θ − ηF⁻¹∇h* can be understood as the solution to a constrained optimization problem:

$$\min_{\delta\theta} \; h(\theta) + \nabla h(\theta)^\top \delta\theta \quad \text{s.t.} \quad D_{KL}(p_\theta \,\|\, p_{\theta+\delta\theta}) \le \epsilon.$$

The constraint measures distance in *distribution space* via KL divergence — the Fisher–Rao geometry — rather than Euclidean parameter distance. This is the geometric content of trust-region methods on statistical manifolds and the foundation of algorithms like TRPO in reinforcement learning, which optimize a surrogate objective subject to an explicit KL constraint [5].

| Optimizer | Preconditioner | Per-step cost (layer width *n*) | Invariance |
|---|---|---|---|
| SGD | *I* | *O(n²)* | None |
| Adam / RMSProp | diag(√v) | *O(n²)* | Diagonal rescaling |
| Natural gradient (exact) | *F⁻¹* | *O(n⁶)* | Full reparameterization |
| K-FAC | *(A⁻¹ ⊗ G⁻¹)* | *O(n³)* | Block-wise affine |
| Shampoo | *(L⁻¹ᐟ⁴ ⊗ R⁻¹ᐟ⁴)* | *O(n³)* | Tensor reshaping |

### 4.2 Shampoo: an alternative Kronecker preconditioner

Shampoo (Gupta, Koren, & Singer) replaces the Fisher factors with statistics of the gradient outer products accumulated over time: for a gradient matrix *G_t*, it maintains *L_t = Σ G_s G_sᵀ* and *R_t = Σ G_sᵀG_s*, preconditioning as *L_t^{−1/4} G_t R_t^{−1/4}*. While motivated by online convex optimization regret bounds rather than information geometry, Shampoo shares K-FAC's Kronecker structure and *O(n³)* inversion cost. Its *−1/4* exponents (rather than K-FAC's *−1*) reflect the accumulation of statistics rather than instantaneous curvature estimation. Both methods demonstrate that Kronecker structure is a broadly useful inductive bias for preconditioner design, not merely a Fisher-specific trick.

### 4.3 Convergence theory: quadratic models and beyond

Martens and Grosse [2] embed K-FAC in a **quadratic-model framework** reminiscent of Hessian-free optimization: at each step, the update *v = α∇̂h + μv_prev* is chosen by minimizing

$$M(\theta + v) = h(\theta) + \nabla h^\top v + \tfrac{1}{2} v^\top (F + rI)\, v,$$

with the damping *r* adapted via a Levenberg–Marquardt-style heuristic comparing predicted and actual objective reduction [2]. For exact natural gradient on strongly convex objectives with Lipschitz-continuous Fisher, linear convergence with a rate depending on the condition number *in the Fisher metric* (rather than the Euclidean one) can be established; crucially, the Fisher-metric condition number is invariant to affine reparameterization, so the rate is immune to the pathological scalings that destroy first-order guarantees.

Modern analyses extend this to the **Polyak–Łojasiewicz (PL) condition**: if the empirical risk satisfies *½‖∇h‖² ≥ μ(h − h\*)*, then preconditioned methods with a uniformly positive-definite curvature approximation converge linearly, with the constant improved by the preconditioner's alignment with the true curvature. The approximation error ‖F̂ − F‖ enters the rate explicitly, formalizing the intuition that better curvature estimates buy faster convergence — but also that damping must grow with estimation noise to preserve descent.

### 4.4 Large-batch training and curvature quality

A distinctive property of K-FAC, emphasized by Martens and Grosse [2], is that **the cost of storing and inverting the curvature approximation does not depend on the amount of data used to estimate it** — unlike low-rank methods (e.g., Hessian-free with many CG iterations) whose cost scales with the curvature mini-batch. This makes K-FAC unusually well-suited to large-batch training: the Fisher factors can be estimated on massive batches (or accumulated via exponential moving averages) at negligible marginal cost, reducing curvature noise precisely in the regime where first-order methods struggle with generalization. Empirical studies report K-FAC reaching target accuracies on ImageNet-scale tasks in substantially fewer iterations than SGD with momentum, though wall-clock advantages depend sensitively on implementation efficiency [2][6].

### 4.5 The empirical Fisher controversy

A persistent theoretical wrinkle: most implementations, including K-FAC, use the *empirical* Fisher (gradients at observed labels) rather than the *true* Fisher (labels sampled from the model). The empirical Fisher is not, in general, a valid approximation of the Hessian, and its use as a preconditioner lacks the Fisher-efficiency justification of Amari's theory [1][5]. For squared-error and cross-entropy losses, the generalized Gauss–Newton matrix — which K-FAC approximates when using model-sampled labels — coincides with the true Fisher and is positive semidefinite by construction. Practitioners overwhelmingly use the empirical variant for computational convenience, and it works well empirically, but the theoretical gap between the geometry being approximated and the geometry being invoked remains incompletely closed.

---

## 5 Empirical Results and Proofs

### 5.1 Key empirical findings (literature)

1. **K-FAC vs. SGD with momentum.** On deep autoencoder benchmarks (CURVES, MNIST, FACES), Martens and Grosse [2] report K-FAC reaching substantially lower training error in far fewer iterations than carefully tuned SGD with momentum, with per-iteration cost only several times that of a plain gradient evaluation.
2. **Convolutional extension.** Grosse and Martens [3] demonstrate that KFC matches or exceeds the performance of the original K-FAC on convolutional architectures, validating the spatial-independence factorization for weight-sharing layers.
3. **Modern architectures.** Recent work [6] shows K-FAC-expand and K-FAC-reduce reaching fixed validation targets on Wide ResNet (CIFAR-10), graph neural networks, and vision transformers in 50–75% of the steps required by first-order references, translating to near-proportional wall-clock savings.
4. **Natural gradient and plateaus.** Amari's classical experiments [1] and subsequent analyses [4] confirm that natural gradient escapes the plateaus induced by singular parameterizations dramatically faster than Euclidean gradient descent — in some constructions, exponentially faster in the system size.
5. **Fisher block structure in random networks.** Amari, Karakida, and Oizumi [4] prove that for random deep networks with width *n*, off-block-diagonal Fisher elements are *O(1/√n)*, providing a rigorous asymptotic justification for the block-diagonal approximation underlying K-FAC.

```python
import torch

def kfac_update(grad_W, A, G, damping=1e-3):
    """Single K-FAC natural-gradient step for one layer.
    grad_W : (out_dim, in_dim) Euclidean gradient of the loss
    A      : (in_dim, in_dim) activation covariance E[a a^T]
    G      : (out_dim, out_dim) pre-activation gradient covariance E[g g^T]
    Returns the preconditioned update: G^{-1} grad_W A^{-1} (with damping).
    """
    n_in, n_out = A.shape[0], G.shape[0]
    pi = (torch.trace(A) / torch.trace(G) * n_out / n_in).sqrt()
    A_d = A + pi * damping**0.5 * torch.eye(n_in)
    G_d = G + damping**0.5 / pi * torch.eye(n_out)
    # Solve without explicit inverses: vec(Delta) = (A_d^{-1} kron G_d^{-1}) vec(grad)
    Delta = torch.linalg.solve(G_d, torch.linalg.solve(A_d, grad_W.T).T)
    return Delta
```

### 5.2 Proof sketch: Kronecker inversion identity

> **Theorem:** For invertible *A ∈ ℝ^{m×m}*, *B ∈ ℝ^{n×n}*, *(A ⊗ B)⁻¹ = A⁻¹ ⊗ B⁻¹*.

*Proof.* By the mixed-product property, *(A ⊗ B)(A⁻¹ ⊗ B⁻¹) = (AA⁻¹) ⊗ (BB⁻¹) = I_m ⊗ I_n = I_{mn}*. ∎

This elementary identity is the computational engine of K-FAC: it converts inversion of an *mn × mn* matrix into two inversions of size *m* and *n* [2].

### 5.3 Proof sketch: block-diagonal justification in wide networks

Amari et al. [4] analyze random deep networks via statistical neurodynamics, showing that Fisher sub-blocks coupling distinct layers scale as *O(1/√n)* in the width *n*, while diagonal blocks remain *O(1)*. Consequently, as *n → ∞*, the Fisher matrix becomes block-diagonal in the layer index (supplemented by small off-diagonal terms), and within each layer, unit-wise blocks dominate. This provides the first rigorous large-width justification for discarding cross-layer curvature — the coarsest of K-FAC's two approximations.

---

## 6 Limitations

1. **Approximation error is uncontrolled in general.** The independence assumption *𝔼[āāᵀ ⊗ ggᵀ] ≈ 𝔼[āāᵀ] ⊗ 𝔼[g gᵀ]* has no finite-width error bound for realistic networks; it is exact only in idealized linear regimes [2][3]. When activations and pre-activation gradients are strongly dependent (e.g., early in training, or with batch normalization), the Kronecker factorization can be arbitrarily poor.
2. **Damping is heuristic.** Factor-level Tikhonov damping lacks the clean trust-region interpretation of full-matrix damping; the interaction between the *πᵢ* balancing scalars, the adaptive quadratic-model damping *r*, and stochastic curvature noise is poorly understood theoretically [2].
3. **Memory and compute overhead persist.** Storing and inverting *A* and *G* per layer costs *O(n²)* memory and *O(n³)* compute per inversion; for very wide layers (e.g., large language model feed-forward blocks), this is nontrivial, and practitioners resort to infrequent curvature updates (every tens or hundreds of steps) with exponential moving averages — introducing staleness whose effect on convergence is unquantified.
4. **Empirical-vs-true Fisher gap.** As discussed in §4.5, the object being approximated in most implementations is not the Fisher metric of Amari's theory, weakening the geometric justification [5].
5. **Generalization is not guaranteed by faster optimization.** Second-order methods reach lower *training* loss faster, but flatter-vs-sharper minima debates and the implicit regularization of SGD mean that optimization speed does not automatically translate to test accuracy. Some studies find K-FAC-trained models generalize comparably, not strictly better, than SGD-trained ones.
6. **Distributed and low-precision challenges.** Inverting curvature factors in FP16/BF16 is numerically delicate, and communicating *O(n²)*-sized factors across workers complicates data-parallel training at extreme scale.

---

## 7 Conclusion

Information geometry reframes neural network optimization as steepest descent on a Riemannian statistical manifold, with the Fisher information matrix supplying the metric and the natural gradient supplying the invariant descent direction [1]. The K-FAC method of Martens and Grosse [2][3] renders this geometry computationally accessible by exploiting the Kronecker structure latent in layer-wise Fisher blocks — an approximation justified asymptotically by random-network analyses [4] and refined for modern weight-sharing architectures [6]. Embedded in adaptive quadratic-model frameworks with careful damping, K-FAC achieves per-iteration progress far beyond first-order methods at only modest overhead, and its cost structure makes it uniquely suited to large-batch regimes.

Yet the theory remains incomplete: finite-width approximation bounds, principled damping, the empirical-Fisher gap, and the optimization–generalization interface are open problems. The broader lesson endures — **curvature matters, and the right curvature is geometric, not Euclidean**. As models scale and batch sizes grow, preconditioners that respect the statistical manifold, whether K-FAC, Shampoo, or their successors, will likely become indispensable components of the deep learning optimization toolkit.

---

## References

[1] Amari, S. (1998). Natural gradient works efficiently in learning. *Neural Computation*, 10(2), 251–276. https://doi.org/10.1162/089976698300017746

[2] Martens, J., & Grosse, R. (2015). Optimizing neural networks with Kronecker-factored approximate curvature. In *Proceedings of the 32nd International Conference on Machine Learning* (ICML), PMLR 37, 2408–2417. http://arxiv.org/pdf/1503.05671v7

[3] Grosse, R., & Martens, J. (2016). A Kronecker-factored approximate Fisher matrix for convolution layers. In *Proceedings of the 33rd International Conference on Machine Learning* (ICML), PMLR 48, 573–582. http://arxiv.org/pdf/1602.01407

[4] Amari, S., Karakida, R., & Oizumi, M. (2019). Fisher information and natural gradient learning in random deep networks. In *Proceedings of the 22nd International Conference on Artificial Intelligence and Statistics* (AISTATS), PMLR 89. http://arxiv.org/pdf/1808.07172

[5] Pascanu, R., & Bengio, Y. (2014). Revisiting natural gradient for deep networks. In *International Conference on Learning Representations* (ICLR) Workshop. https://arxiv.org/pdf/1301.3584v5

[6] Eschenhagen, R., Dangel, F., & Hennig, P. (2023). Kronecker-factored approximate curvature for weight-sharing layers: K-FAC-expand vs. K-FAC-reduce. *arXiv:2311.00636*. http://arXIV.org/pdf/2311.00636

