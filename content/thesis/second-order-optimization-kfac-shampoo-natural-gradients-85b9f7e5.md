---
id: second-order-optimization-kfac-shampoo-natural-gradients-85b9f7e5
title: "Second-Order Optimization for Deep Learning: K-FAC, Shampoo, and the Geometry of Natural Gradients"
anon: anon#8215
ts: 1788970004000
type: thesis
---

# Second-Order Optimization for Deep Learning: K-FAC, Shampoo, and the Geometry of Natural Gradients

## Abstract

First-order stochastic optimizers dominate deep learning, yet their trajectories follow the *Euclidean* geometry of parameter space — a geometry inherited from an arbitrary coordinate choice rather than from anything the model means. Second-order methods correct this by preconditioning gradients with curvature, yielding parameterization-invariant, Fisher-efficient updates, but the exact Hessian or Fisher information matrix of a neural network is a dense $p \times p$ object with $p$ in the millions, whose inversion is hopelessly intractable. This thesis unifies two landmark scalable second-order optimizers — *Kronecker-Factored Approximate Curvature* (K-FAC) and *Shampoo* — under the natural gradient and Riemannian information geometry. K-FAC exploits the identity $\mathrm{vec}(\nabla_W \ell) = \bar{a} \otimes g$ to approximate per-layer Fisher blocks by Kronecker products of two small covariance matrices; Shampoo generalizes AdaGrad's full-matrix preconditioner to tensor-structured parameters via per-mode Gram matrices and fractional matrix powers. We derive the Fisher–Rao geometry, compare the methods' derivations, complexity, convergence guarantees, and large-scale empirical behavior, and close with the open problems that still separate second-order theory from practice.

## 1 Introduction

Deep neural networks are optimized over high-dimensional, non-convex loss landscapes whose local geometry varies by *orders of magnitude* across directions: a handful of sharp directions coexist with vast flat plateaus and saddle-rich ravines. First-order methods step along the negative gradient, which is steepest only with respect to the *Euclidean* metric on parameter space. As Amari observed in 1998 [1], when a parameter space has an underlying geometric structure, the ordinary gradient does not represent the steepest direction, but the *natural* gradient does.

The classical remedy is Newton's method, preconditioning by the inverse Hessian — but it is unusable at deep-learning scale: the Hessian is $p \times p$ with $p \sim 10^6$–$10^9$, indefinite away from minima (so the Newton step need not be a descent direction), and prohibitive to form. Quasi-Newton methods (BFGS, L-BFGS) capture only coarse low-rank curvature and degrade in highly stochastic regimes; Hessian-free optimization requires many conjugate-gradient iterations and large batches, making it impractical at scale.

A more principled curvature object is the **Fisher information matrix** $F(\theta)$, always positive semidefinite and coincident with the Generalized Gauss–Newton matrix for standard losses. Preconditioning by $F^{-1}$ yields the **natural gradient**: steepest descent under the Kullback–Leibler divergence, invariant to reparameterization. The obstacle is again computational — $O(p^3)$ inversion. Two algorithms broke this impasse by exploiting the *algebraic structure* of network gradients rather than settling for diagonal approximations:

1. **K-FAC** (Martens & Grosse [2]): for a linear layer $s = W\bar{a}$, the gradient factorizes as $\nabla_W \ell = g\bar{a}^\top$, so the layer's Fisher block is an expectation of a Kronecker product. Under block-diagonality and the *independence of activations and derivatives* (IAD) assumption, it splits into $\bar{A} \otimes G$ with $\bar{A} = \mathbb{E}[\bar{a}\bar{a}^\top]$, $G = \mathbb{E}[gg^\top]$ — each cheap to invert — giving the two-sided update $W \leftarrow W - \eta\, G^{-1}\nabla_W h\,\bar{A}^{-1}$.
2. **Shampoo** (Gupta, Koren & Singer [3]): generalizes AdaGrad's full-matrix preconditioner to tensor parameters, maintaining left/right Gram matrices $L_t = \sum G_sG_s^\top$, $R_t = \sum G_s^\top G_s$ and applying fractional powers, $\tilde{G}_t = L_t^{-1/4} G_t R_t^{-1/4}$, extending to order-$k$ tensors by contracting each mode with $(H_t^i)^{-1/2k}$.

This thesis derives the natural gradient from first principles, develops both methods algebraically, and compares their approximations, theory, empirics, and open problems.

## 2 Background

### 2.1 Curvature and the failure of Euclidean steepest descent

Steepest descent solves $\Delta\theta = \arg\min_{\|d\|_B \le 1} h(\theta+d) \approx -\tfrac{1}{2\lambda}B^{-1}\nabla h(\theta)$ for a norm induced by $B \succ 0$. Setting $B = I$ gives gradient descent; $B = \nabla^2 h$ gives Newton. The choice of $B$ is a choice of *geometry*: Euclidean descent declares a unit change in any parameter equally significant — transparently false in deep networks, where rescaling one layer's weights can be compensated by rescaling the next, leaving the *function* unchanged while the gradient changes wildly. The Hessian's condition number $\kappa = \lambda_{\max}/\lambda_{\min}$ controls first-order convergence (iteration complexity $O(\kappa \log 1/\epsilon)$ on quadratics); in deep networks $\kappa$ routinely exceeds $10^6$, producing *plateaus* where progress stalls [1] and *ravines* whose sharp directions force tiny step sizes.

### 2.2 The Fisher information matrix

For least-squares-type objectives, the **Generalized Gauss–Newton** matrix $G(\theta) = \mathbb{E}_x[J_f^\top H_L J_f]$ is a PSD surrogate for the Hessian ($J_f$ the network Jacobian, $H_L$ the loss Hessian w.r.t. outputs). When the loss is the negative log-likelihood of an exponential-family predictive distribution — squared error (Gaussian) or cross-entropy (multinomial) — the GGN *coincides* with the **Fisher information matrix** [2]:

$$F(\theta) = \mathbb{E}_{x \sim Q_x,\, y \sim P_{y|x}(\theta)}\left[\nabla_\theta \log p(y|x,\theta)\,\nabla_\theta \log p(y|x,\theta)^\top\right].$$

Crucially, the expectation over $y$ is under the *model's own* predictive distribution — the distinction between the true Fisher and the *empirical* Fisher $\hat{F} = \frac{1}{n}\sum_i \nabla\ell_i\nabla\ell_i^\top$ used by AdaGrad-style methods. The two coincide only at perfect model fit, and conflating them is a persistent source of error [6].

### 2.3 The natural gradient

Because the network defines a conditional model $P_{y|x}(\theta)$, its parameter space is a statistical manifold with the Fisher–Rao metric. The **natural gradient** $\tilde{\nabla}h = F(\theta)^{-1}\nabla h(\theta)$ is the true steepest-descent direction in the Riemannian geometry induced by the KL divergence, and online natural-gradient learning is *Fisher efficient* — asymptotically matching the optimal batch estimator [1]. It is invariant to smooth reparameterization and coincides with the GGN for standard losses, sidestepping Newton's indefiniteness. We develop this geometry fully in §4.1.

### 2.4 Adaptive methods as diagonal curvature proxies

AdaGrad accumulates $S_t = \sum_{s \le t} g_s g_s^\top$ and preconditions by $S_t^{-1/2}$ — a full-matrix preconditioner requiring $O(p^2)$ memory, hence the diagonal variant used in practice. RMSProp and Adam use exponential moving averages of *diagonal* second moments: diagonal approximations to the *empirical* Fisher. They adapt to per-coordinate scale but capture *no* off-diagonal curvature — they rescale axes but cannot rotate the update. K-FAC and Shampoo occupy the middle ground, richer than diagonal and cheaper than full, by imposing *Kronecker structure* on the preconditioner.

---

*Notation.* Layer $i$ computes $s_i = W_i\bar{a}_{i-1}$, $a_i = \phi_i(s_i)$, with augmented activation $\bar{a}_{i-1} = [1; a_{i-1}]$ absorbing the bias and $W_i \in \mathbb{R}^{d_i \times (d_{i-1}+1)}$. Backpropagation gives $g_i = \nabla_{s_i}\ell$ and $\mathcal{D}W_i = g_i\bar{a}_{i-1}^\top$. Kronecker identities used throughout: $(A\otimes B)^{-1} = A^{-1}\otimes B^{-1}$ and $(A\otimes B)\mathrm{vec}(X) = \mathrm{vec}(BXA^\top)$.

## 3 Methodology

We proceed from the exact Fisher and natural-gradient update, identify the two sources of intractability — the dense $p \times p$ inverse and inter-layer coupling — and derive K-FAC and Shampoo as principled relaxations:

1. **Geometric foundation** (§4.1): derive the Fisher–Rao metric from the KL divergence and show $F^{-1}\nabla h$ is steepest descent on the statistical manifold — the *target* update both methods approximate.
2. **Kronecker factorization** (§4.2): from $\mathrm{vec}(\mathcal{D}W_i) = \bar{a}_{i-1} \otimes g_i$, each Fisher block is an expectation of a Kronecker product; block-diagonality plus the IAD assumption yields $\tilde{F} = \mathrm{diag}(\bar{A}_{i-1} \otimes G_i)$, invertible via small matrix operations.
3. **Tensor preconditioning** (§4.3): Shampoo accumulates per-mode Gram matrices of stochastic gradients and contracts the gradient tensor with fractional inverse powers, generalizing AdaGrad without forming any $p \times p$ object.

We assume negative log-likelihood losses of exponential-family predictive models (Fisher = GGN, PSD); expectations are estimated by minibatches with exponential moving averages; and damping $\gamma I$ on each factor interpolates between the natural-gradient and Euclidean directions, as in Levenberg–Marquardt.

## 4 Deep Dive

### 4.1 The natural gradient as steepest descent on the statistical manifold

Let $\mathcal{M} = \{P_{y|x}(\theta)\}$ be the statistical manifold of the model's predictive distributions. The KL divergence expands as

$$D_{\mathrm{KL}}\big(P_\theta \,\|\, P_{\theta + d}\big) = \tfrac{1}{2}\, d^\top F(\theta)\, d + o(\|d\|^2),$$

so $F(\theta)$ is the Riemannian metric tensor — the Hessian of the KL divergence at coincidence. Steepest descent under the constraint $D_{\mathrm{KL}}(P_\theta \| P_{\theta+d}) = c$ gives $\Delta\theta \propto -F(\theta)^{-1}\nabla h(\theta)$:

> **Theorem.** *(Amari, 1998 [1].)* $F(\theta)^{-1}\nabla h(\theta)$ is the direction of steepest descent of $h$ under the Riemannian metric induced by the KL divergence. Moreover, online natural-gradient learning is *Fisher efficient*: its asymptotic covariance attains the Cramér–Rao bound, matching the optimal batch estimator.

Consequences: **reparameterization-invariance** (the distribution-space trajectory is unchanged by smooth reparameterization); escape from the MLP *plateau phenomenon* (the inverse Fisher compensates degenerate directions at singularities like neuron duplication [1]); and, for wide random networks, a Fisher that is *unitwise block-diagonal* up to $O(1/\sqrt{n})$ [5] — justifying layerwise approximations. The price is the $O(p^3)$ inversion; everything below is an attempt to pay less.

### 4.2 K-FAC: from Fisher blocks to Kronecker factors

Since $\mathcal{D}W_i = g_i\bar{a}_{i-1}^\top$ and $\mathrm{vec}(uv^\top) = v \otimes u$, we have $\mathrm{vec}(\mathcal{D}W_i) = \bar{a}_{i-1} \otimes g_i$, and the $(i,j)$-th Fisher block is

$$F_{i,j} = \mathbb{E}\big[(\bar{a}_{i-1}\bar{a}_{j-1}^\top) \otimes (g_i g_j^\top)\big].$$

Two approximations follow. **(A1) Block-diagonality:** $F_{i,j} \approx 0$ for $i \neq j$, supported by the $O(1/\sqrt{n})$ cross-layer analysis of [5]. **(A2) Independence of activations and derivatives (IAD):** $\bar{a}_{i-1} \perp\!\!\!\perp g_i$ within a layer, so the expectation factors:

$$F_{i,i} \;\approx\; \underbrace{\mathbb{E}[\bar{a}_{i-1}\bar{a}_{i-1}^\top]}_{\bar{A}_{i-1}} \otimes \underbrace{\mathbb{E}[g_i g_i^\top]}_{G_i} \;=:\; \hat{F}_{i,i}.$$

IAD is the bolder assumption — the expectation of a Kronecker product is not generally the Kronecker product of expectations, and no asymptotic regime makes it exact [2]. Its defense is cumulant-based: the error is controlled by third- and higher-order joint cumulants of $(\bar{a}, g)$, which vanish for jointly Gaussian statistics, and empirically the approximation captures the Fisher's "coarse structure" well (cf. Figure 1 of [2], comparing the exact Fisher to $\tilde{F}$ on a 256-20-20-20-20-10 tanh network). Koroko et al. [6] relax IAD by minimizing $\|F_{i,i} - A \otimes G\|_F$ directly via Kronecker-product SVD, improving both approximation quality and optimization speed.

The payoff of (A1)+(A2): with $(A\otimes G)^{-1} = A^{-1}\otimes G^{-1}$,

$$\mathrm{vec}(\Delta W_i) = \hat{F}_{i,i}^{-1}\,\mathrm{vec}(\nabla_{W_i} h) = \mathrm{vec}\!\left(G_i^{-1}\, \nabla_{W_i} h\, \bar{A}_{i-1}^{-1}\right).$$

Inverting a $d_i(d_{i-1}+1) \times d_i(d_{i-1}+1)$ block reduces to inverting $\bar{A}_{i-1}$ and $G_i$ — $O(d_i^3 + d_{i-1}^3)$ instead of $O(d_i^3d_{i-1}^3)$ — and the cost is *independent of batch size*, since the factors are moving averages: unlike Hessian-free methods, K-FAC thrives in stochastic regimes [2].

```python
def kfac_layer_update(W, A, G, grad_W, lr, damping=1e-3):
    """One K-FAC natural-gradient step for a linear layer (bias absorbed in W).
    A, G   : E[a_bar a_bar^T], E[g g^T] covariances (exponential moving averages)
    grad_W : Euclidean minibatch gradient of the loss
    """
    A_inv = np.linalg.inv(A + damping * np.eye(A.shape[0]))  # O(d_in^3), amortized
    G_inv = np.linalg.inv(G + damping * np.eye(G.shape[0]))  # O(d_out^3), amortized
    nat_grad = G_inv @ grad_W @ A_inv   # vec form of (A^-1 x G^-1) vec(grad_W)
    return W - lr * nat_grad
```

In practice inverses are recomputed every $T_{\text{inv}} \gg 1$ steps, amortizing the cubic cost to a small multiple of SGD per step [2, 4]. Grosse and Martens extended K-FAC to convolutions with spatial-homogeneity assumptions [4].

### 4.3 Shampoo: structure-aware preconditioning over tensor spaces

Shampoo [3] generalizes **AdaGrad's full-matrix preconditioner** to tensor parameters. AdaGrad's vector update $\theta_{t+1} = \theta_t - \eta S_t^{-1/2} g_t$ with $S_t = \sum_{s \le t} g_s g_s^\top$ is near-optimal for online convex optimization but needs $O(p^2)$ memory. For a matrix parameter with gradient $G_t$, Shampoo uses the Kronecker-structured surrogate $R_t^{1/2} \otimes L_t^{1/2}$ with

$$L_t = \sum_{s=1}^t G_s G_s^\top + \epsilon I, \qquad R_t = \sum_{s=1}^t G_s^\top G_s + \epsilon I,$$

costing only $O(m^2+n^2)$ memory. The update is

$$\tilde{G}_t = L_t^{-1/4} G_t R_t^{-1/4} \quad\Longleftrightarrow\quad \mathrm{vec}(\tilde{G}_t) = \big(R_t^{-1/4} \otimes L_t^{-1/4}\big)\mathrm{vec}(G_t),$$

the $-1/4$ powers arising because $\big(R^{1/2}\otimes L^{1/2}\big)^{-1/2} = R^{-1/4}\otimes L^{-1/4}$: Shampoo is the matrix square root of the Kronecker-factored full AdaGrad preconditioner. For order-$k$ tensors, each mode's Gram matrix $H_t^i$ contracts the gradient via $(H_t^i)^{-1/2k}$ [3].

```python
def shampoo_matrix_update(W, L, R, G, lr, eps=1e-8):
    """One Shampoo step for a matrix parameter (Gupta et al., 2018)."""
    L = L + G @ G.T                      # left Gram statistics
    R = R + G.T @ G                      # right Gram statistics
    eL, UL = np.linalg.eigh(L + eps*np.eye(L.shape[0]))  # infrequent, amortized
    eR, UR = np.linalg.eigh(R + eps*np.eye(R.shape[0]))
    precond = (UL * eL**-0.25) @ UL.T @ G @ (UR * eR**-0.25) @ UR.T
    return W - lr * precond, L, R
```

Gupta et al. prove, via matrix trace inequalities, a regret bound for the convex stochastic setting:

> **Theorem.** *(Gupta, Koren & Singer, 2018 [3].)* With per-mode gradient ranks bounded by $r_i$ and $r = (\prod_i r_i)^{1/k}$, Shampoo's regret satisfies $\sum_t f_t(W_t) - \sum_t f_t(W^\star) \le \sqrt{2r}\,D\prod_{i=1}^k \mathrm{Tr}\big((H_T^i)^{1/2k}\big)$.

Since deep-learning gradients are approximately low-rank (batch gradients are sums of few outer products), the trace terms grow slowly and the bound improves substantially over diagonal AdaGrad. Production Shampoo adds EMA statistics, asynchronous eigendecompositions, and *grafting* to Adam's step magnitude — the engineering behind billion-parameter deployments.

### 4.4 A unifying view: two Kronecker preconditioners, two philosophies

Both methods compute $\mathrm{vec}(\Delta W) = \big(R^{-1/2\alpha} \otimes L^{-1/2\alpha}\big)\mathrm{vec}(\nabla_W h)$:

| Aspect | K-FAC [2] | Shampoo [3] |
|---|---|---|
| **Target** | Natural gradient $F^{-1}\nabla h$ (Fisher geometry) | Full-matrix AdaGrad preconditioner (regret) |
| **Left factor** | $\bar{A} = \mathbb{E}[\bar{a}\bar{a}^\top]$, activation covariance | $L_t = \sum G_sG_s^\top$, gradient Gram |
| **Right factor** | $G = \mathbb{E}[gg^\top]$, derivative covariance | $R_t = \sum G_s^\top G_s$, gradient Gram |
| **Exponent** | $-1$ (inverse Fisher) | $-1/4$ per side (sqrt of AdaGrad) |
| **Statistics** | Model distribution (forward/backward passes) | Empirical stochastic gradients |
| **Key assumption** | Block-diagonal Fisher + IAD | Low-rank gradients; Kronecker-factorable preconditioner |
| **Invariance** | Approx. reparameterization-invariant | Not parameterization-invariant in general |

K-FAC is *model-centric* — covariances of quantities the model computes, targeting steepest descent in distribution space. Shampoo is *data-centric* — covariances of observed gradients, justified by regret. Where the model is correct the views converge, but transiently they differ: K-FAC tracks the model's evolving geometry, Shampoo the gradient-noise history. The shared lesson: *the Kronecker product is the right language for neural-network curvature* — turning an intractable $p\times p$ inversion into small amortizable operations.

## 5 Empirical Results and Theoretical Guarantees

### 5.1 K-FAC in supervised learning

Martens and Grosse [2] evaluated K-FAC on the deep autoencoder benchmarks (CURVES, MNIST, FACES) previously used for Hessian-free optimization: K-FAC reached lower training error in fewer updates than well-tuned SGD with momentum, while remaining *stable in the stochastic regime* — the property Hessian-free lacks, since its curvature estimates demand large batches. Koroko et al. [6] confirmed K-FAC's edge over first-order baselines on the same benchmarks and showed their KPSVD refinements both approximate the Fisher more accurately (Frobenius norm against a subsampled exact Fisher) and optimize faster than K-FAC. Notably, methods ranked by Fisher-approximation quality ranked identically by optimization speed — evidence that *better curvature approximation translates directly into faster optimization*. At scale, distributed K-FAC with asynchronous inverse computation achieved 2–3× wall-clock speedups on large convolutional classifiers [4].

### 5.2 Natural gradients in RL: ACKTR

Wu et al. [4] built **ACKTR** (Actor-Critic using Kronecker-Factored Trust Region), the first scalable trust-region natural-gradient method for deep RL: the Fisher metric is defined w.r.t. the policy $\pi_\theta(a|s)$ (plus a Gauss–Newton metric for the critic), factorized à la K-FAC, with trust-region-constrained updates on both. Per-update cost is only 10–25% above A2C, yet ACKTR improved sample efficiency **2–3×** on average across six Atari games and MuJoCo tasks — e.g., 2M on *Atlantis* in 1.3 hours versus 10 hours for A2C [4]. Trust regions in *distribution* space prevent the catastrophic policy collapses of first-order policy gradients.

### 5.3 Shampoo at scale

The original Shampoo paper [3] showed considerably faster convergence than SGD, AdaGrad, and Adam on 2018-era state-of-the-art models, with per-step runtime comparable to first-order baselines once eigendecompositions were amortized. Later large-scale deployments (large language and translation models, with EMA statistics, grafting, and block partitioning) established Shampoo as one of the few second-order methods to survive billion-parameter training. The pattern is consistent: Shampoo's advantage grows with *ill-conditioning* — exactly where Adam's diagonal rescaling is insufficient and gradient Gram matrices capture meaningful low-rank curvature.

### 5.4 Computational complexity

Per-step costs for a $d_{\text{in}}\times d_{\text{out}}$ layer ($p = d_{\text{in}}d_{\text{out}}$ parameters), ignoring amortization:

| Method | Memory | Time per step | Inversion |
|---|---|---|---|
| SGD / Adam | $O(p)$ | $O(p)$ | — |
| Full natural gradient | $O(p^2)$ | $O(p^3)$ | every step |
| Hessian-free (CG) | $O(p)$ | $O(p \times \text{CG iters})$ | implicit, every step |
| **K-FAC** | $O(d_{\text{in}}^2+d_{\text{out}}^2)$ | $O(p)$ + small matmuls | $O(d_{\text{in}}^3+d_{\text{out}}^3)$ every $T_{\text{inv}}$ steps |
| **Shampoo** | $O(d_{\text{in}}^2+d_{\text{out}}^2)$ | $O(p)$ + small matmuls | eigendecompositions every $T_{\text{inv}}$ steps |

Both reduce the $O(p^3)$ curse to *cubic in layer width*, and with $T_{\text{inv}} \sim 20$–$500$ the per-step overhead over Adam is a modest constant factor.

### 5.5 Theoretical guarantees

Theory comes in two flavors matching the two philosophies. **Regret/convergence (Shampoo):** the bound of [3] (§4.3) gives $O(\sqrt{r}\,D\prod_i\mathrm{Tr}((H_T^i)^{1/2k}))$ regret in the convex stochastic setting, improving over diagonal AdaGrad for low-rank gradients; later work extended Shampoo-style analysis to nonconvex smooth objectives and stationarity convergence. **Fisher efficiency/invariance (K-FAC):** K-FAC approximately inherits the natural gradient's reparameterization invariance and Fisher efficiency [1]; exact non-asymptotic rates remain open since IAD resists clean analysis, though the approximation-quality program of [6] offers a path via $\|\tilde{F}^{-1}-F^{-1}\|$ bounds.

## 6 Limitations

**The IAD assumption is uncontrolled.** K-FAC's factorization $\mathbb{E}[\bar{a}\bar{a}^\top \otimes gg^\top] \approx \mathbb{E}[\bar{a}\bar{a}^\top]\otimes\mathbb{E}[gg^\top]$ has no asymptotic justification; Martens and Grosse [2] bound the error by higher-order cumulants, which are small in practice but not by theorem. That [6]'s relaxation of IAD helps simultaneously validates K-FAC and indicts its central approximation.

**Block-diagonality discards inter-layer curvature.** Both methods precondition each parameter tensor independently, ignoring $F_{i,j}$, $i \neq j$. Trained networks with residuals, normalization, and attention create precisely the cross-layer couplings that block-diagonal methods miss; two-level coarse-space corrections are a first step, not a solution.

**Damping and hyperparameters.** Too little damping amplifies noise along flat directions; too much degenerates to SGD — and both methods add hyperparameters (adaptive damping [2], grafting, update frequencies) that first-order methods avoid.

**Architectural generality.** K-FAC leans on the linear-layer structure $s = W\bar{a}$; extensions to convolutions [4], RNNs, and attention pile on further assumptions (spatial homogeneity, weight-sharing factorizations). Shampoo is more architecture-agnostic but reintroduces block-diagonal approximations when partitioning huge embedding or attention matrices.

**Stochastic Fisher estimation.** The *exact* Fisher samples $y \sim P_{y|x}(\theta)$; most implementations substitute the empirical Fisher (true labels), which can point in unhelpful directions. The gap between estimated and true curvature is rarely quantified.

**Wall-clock vs. iteration efficiency.** Second-order methods win decisively in iteration count; in wall-clock time the contest hinges on amortization, distribution, and hardware (matmuls favor GPUs; eigendecompositions less so). For well-conditioned problems, Adam's simplicity still wins.

## 7 Conclusion

The natural gradient is the right update — steepest descent on the statistical manifold, invariant to parameterization, Fisher efficient — and it has been computationally out of reach for as long as we have known this. K-FAC and Shampoo are the two most successful attempts to reach it, converging remarkably on one algebraic structure: a Kronecker-factored preconditioner on the vectorized gradient. K-FAC derives it from the Fisher's layerwise outer-product structure under block-diagonality and IAD; Shampoo from tensorizing AdaGrad's full-matrix preconditioner. One is geometry-first, the other regret-first; one accumulates model covariances, the other gradient Grams; one inverts, the other takes fourth roots. Yet both reduce $O(p^3)$ to amortized cubic-in-width, both thrive stochastically where Hessian-free methods falter, and both have shown 2–3× speedups from autoencoders to Atari agents to billion-parameter models [2, 3, 4].

Open problems remain. *First*, non-asymptotic theory quantifying IAD and block-diagonal errors along real trajectories. *Second*, curvature approximations for modern architectures without piling assumption upon assumption. *Third*, the *true* (model-sampled) Fisher versus the empirical Fisher routinely substituted for it. *Fourth*, the engineering of amortized second-order updates — asynchronous inverses, matrix-root iterations, hardware-aware scheduling — the difference between a beautiful method and a used one.

Amari [1] suggested the plateau phenomenon "might disappear or might not be so serious" under the natural gradient. K-FAC and Shampoo have made that suggestion practical. The Euclidean gradient was never the steepest direction — only the cheapest. The ongoing project of second-order deep learning is to make the steepest direction cheap enough.

## References

[1] Shunichi Amari. "Natural Gradient Works Efficiently in Learning." *Neural Computation*, 10(2):251–276, 1998. https://doi.org/10.1162/089976698300017746

[2] James Martens and Roger Grosse. "Optimizing Neural Networks with Kronecker-factored Approximate Curvature." *Proceedings of the 32nd International Conference on Machine Learning (ICML)*, PMLR 37, 2015. http://proceedings.mlr.press/v37/martens15.pdf

[3] Vineet Gupta, Tomer Koren, and Yoram Singer. "Shampoo: Preconditioned Stochastic Tensor Optimization." *arXiv:1802.09568*, 2018. https://arxiv.org/abs/1802.09568

[4] Yuhuai Wu, Elman Mansimov, Shun Liao, Roger Grosse, and Jimmy Ba. "Scalable Trust-Region Method for Deep Reinforcement Learning Using Kronecker-Factored Approximation." *Advances in Neural Information Processing Systems 30 (NeurIPS)*, 2017. http://arxiv.org/pdf/1708.05144v1

[5] Shunichi Amari, Ryo Karakida, and Masafumi Oizumi. "Fisher Information and Natural Gradient Learning in Random Deep Networks." *Proceedings of the 22nd International Conference on Artificial Intelligence and Statistics (AISTATS)*, PMLR 89, 2019. http://proceedings.mlr.press/v89/amari19a/amari19a.pdf

[6] Abdoulaye Koroko, Ani Anciaux-Sedrakian, Ibtihel Ben Gharbia, Valérie Garès, Mounir Haddou, and Quang Huy Tran. "Efficient Approximations of the Fisher Matrix in Neural Networks Using Kronecker Product Singular Value Decomposition." *arXiv:2201.10285*, 2022. https://arxiv.org/pdf/2201.10285

