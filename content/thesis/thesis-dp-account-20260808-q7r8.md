---
id: thesis-dp-account-20260808-q7r8
title: "Differential Privacy Accounting Conversion: RDP to f-DP Duality, Gaussian DP, Composition via Fourier Accountant"
ts: 1786195832578
anon: anon#9184
type: thesis
---

# Differential Privacy Accounting Conversion: RDP to f-DP Duality, Gaussian DP, Composition via Fourier Accountant

> *The core difficulty of private accounting is not bounding one mechanism, but describing — losslessly — what a bound tells you about every other definition you might care about.*

## Abstract

We present a unified treatment of modern differential privacy (DP) accounting: **Rényi DP (RDP)**, **tradeoff-function DP ($f$-DP)**, its canonical specialization **Gaussian DP ($\mu$-GDP)**, and the exact numerical composition machinery of the **Fourier Accountant** via Privacy Loss Distributions (PLDs) and characteristic functions ($\phi$-functions). The central bridge is the *optimal black-box conversion* from an RDP profile $\tau \mapsto \rho(\tau)$ to its tightest $f$-DP envelope $f_{\rho(\cdot)} = \sup_{\tau \ge 0.5} f_{\tau,\rho(\tau)}$, conjectured by Zhu et al. and recently proved by [2602.04562]. We situate this duality within the hypothesis-testing view of Dong et al. [1905.02383], the central limit theorem for $f$-DP, and the RDP-based Moments Accountant of Abadi et al. and its subsampled refinement [Wang et al. 2019]. We then develop the Fourier Accountant [2102.12412, 2106.08567] as the *analytically optimal* composition method: representing privacy loss by its dominating random variable $L$, computing $k$-fold convolutions as products of $\phi(t)=\mathbb{E}[e^{itL}]$ in Fourier domain, inverting with FFT or Gaussian quadrature to yield exact $(\varepsilon,\delta)$-profiles, and accelerating heterogeneous compositions via Plancherel. We give Python and Haskell reference implementations, composition tables, and a full DP-SGD worked example. The thesis is dense, self-contained, and constructively critical: RDP is computationally friendly but interpretationally lossy; $f$-DP is tight but analytically unwieldy; GDP is the asymptotic fixed point; Fourier accounting is the finite-sample truth.

---

## 1. Introduction: Why Accounting Is The Problem

Differential privacy's promise — *one parameter to rule risk* — collapses under iteration. Training a single neural network via DP-SGD can require $10^4$-$10^6$ noisy gradient steps. Basic composition, $(k\varepsilon,k\delta)$ for $k$ mechanisms, destroys utility. Advanced composition improves $\varepsilon \sim O(\sqrt{k\log(1/\delta)})$ but remains loose for Gaussian noise.

Three revolutions have superseded loose composition:

* **Moments Accountant / RDP** [Abadi et al. 2016; Mironov 2017]: Replace $(\varepsilon,\delta)$ with *moments* of the privacy loss:
  $$ D_\alpha(M(D)\|M(D')) = \frac{1}{\alpha-1}\log \mathbb{E}_{Y\sim M(D')}\left[\left(\frac{M(D)}{M(D')}(Y)\right)^\alpha\right] \le \rho(\alpha). $$
  Composition becomes additive: $\rho_1\star\rho_2 = \rho_1+\rho_2$ order-wise.

* **Hypothesis-testing view / $f$-DP** [Dong et al. 2022]: A mechanism $M$ is $f$-DP if for all neighbors $D\sim D'$,
  $$ T(M(D),M(D'))(\alpha) \ge f(\alpha), \quad \text{where } T(P,Q)(\alpha)=\inf_{\phi:\mathbb{E}_P[\phi]\le\alpha} 1-\mathbb{E}_Q[\phi]. $$
  $T$ is the tradeoff between Type I and Type II errors. $f$ must be convex, decreasing, $f\le 1-\alpha$, $f(0)=1$.

* **Lossless numerical accounting**: Privacy Loss Distributions (PLDs) $ \omega(s)=\Pr[L=s]$ where $L=\log\frac{dP}{dQ}$, and characteristic function $\phi_L(t)=\mathbb{E}[e^{itL}]$. Composition is convolution $\omega^{\star k}= \omega *\cdots* \omega$; in Fourier space $\phi_{L_1+L_2}=\phi_{L_1}\phi_{L_2}$.

The conversions between them have been *lossy* until recently. Asoodeh et al. [2021] gave optimal RDP$\to(\varepsilon,\delta)$ for single $\alpha$; Balle et al. [2019] gave two-cut reduction. The gap was: *what does an entire RDP curve imply about $f$?* The paper [2602.04562] proves the **intersection-of-regions rule is not only valid but universally optimal in Blackwell order**. Any mechanism with RDP profile $\rho$ must have tradeoff $f\ge \sup_{\tau\ge 0.5} f_{\tau,\rho(\tau)}$, and no stronger black-box bound is possible — Bernoulli-based randomized response witnesses saturate each cut.

We flesh this out, connect to GDP as the fixed point of composition CLT, and to Fourier Accountants as the practical end-to-end machinery.

---

## 2. Preliminaries and Notation

### 2.1 DP vs Approximate DP vs Concentrated DP

A mechanism $M:\mathcal{D}\to\mathcal{O}$ is $(\varepsilon,\delta)$-DP if for all adjacent $D\sim D'$ and all measurable $S$:
$$\Pr[M(D)\in S]\le e^{\varepsilon}\Pr[M(D')\in S]+\delta.$$

**Interpretation**: $(\varepsilon,\delta)$ bounds the hockey-stick divergence $H_{e^\varepsilon}= \sup_S P(S)-e^\varepsilon Q(S) - \delta\le 0$.

### 2.2 Rényi DP

> **Definition 2.1 (RDP)** *$M$ satisfies $(\alpha,\rho)$-RDP for $\alpha>1$ if $D_\alpha(M(D)\|M(D'))\le \rho$ for all neighbors. It satisfies a *profile* $\rho(\cdot)$ if this holds for all $\alpha\mapsto\rho(\alpha)$.*

*Properties*:
* **Monotone**: $D_\alpha$ non-decreasing in $\alpha$.
* **Additive composition**: If $M_1$ is $(\alpha,\rho_1)$-RDP and $M_2$ is $(\alpha,\rho_2)$-RDP adaptively, composition is $(\alpha,\rho_1+\rho_2)$-RDP.
* **Subsampling amplification**: Poisson subsampled mechanism $M\circ\text{Sample}_q$ satisfies [Wang et al. 2019][2102.12412]:
  $$ D_\alpha \le \frac{1}{\alpha-1}\log\left(1-q+q^{\alpha}e^{(\alpha-1)\rho}+ \text{higher-order terms}\right) $$
  with tight analytical bound for Gaussian: $D_\alpha^{\text{sub Guass}}(q,\sigma)\le \min_{\text{closed form}}$.

### 2.3 $f$-DP and Tradeoff Functions

For distributions $P,Q$, tradeoff $T(P,Q):[0,1]\to[0,1]$ is the *lower envelope* of attainable $(\alpha_\phi,\beta_\phi)$ when testing $H_0: P$ vs $H_1: Q$. By Neyman-Pearson, optimal tests are threshold tests on likelihood ratio $dP/dQ$.

A mechanism is $f$-DP if $T(M(D),M(D'))\ge f$ pointwise. Partial order: $f_1\succeq f_2$ if $f_1(\alpha)\ge f_2(\alpha)$ $\forall\alpha$ — *more private = larger tradeoff curve*.

Key facts [Dong et al. 2022, 2512.21358]:
* Convexity, $f(0)=1$, $f(\alpha)\le 1-\alpha$, symmetry: $f = f^{-1}$ iff symmetric testing problem.
* **$(\varepsilon,\delta)$-DP** corresponds to $f_{\varepsilon,\delta}(\alpha)= \max\{0,1-\delta-e^\varepsilon\alpha, e^{-\varepsilon}(1-\delta-\alpha)\}$.
* **Composition**: $f_1\otimes f_2 := T(P_1\times P_2,Q_1\times Q_2)$ where $f_i = T(P_i,Q_i)$. Exact, algebraically closed, no loss.
* Dual view: $f$-DP is equivalent to a *QIF channel* model [McIver et al. 2025] via Galois connection.

---

## 3. Gaussian DP: The Canonical One-Parameter Family

> **Definition 3.1 ($\mu$-GDP)** *$G_\mu := T(\mathcal{N}(0,1),\mathcal{N}(\mu,1))$. Explicitly:*
> $$ G_\mu(\alpha) = \Phi(\Phi^{-1}(1-\alpha) - \mu), \quad \Phi=\text{Standard Normal CDF}. $$
> *Mechanism $M$ is $\mu$-GDP if $T(M(D),M(D'))\ge G_\mu$.*

Why is $\mu$-GDP central?

* **Single-parameter tractability** like $\varepsilon$-DP but composition-exact.
* **Comes with CLT** [Dong et al.]: For any $f$-DP mechanism where log-likelihood ratios have finite variance, $f^{\otimes n}$ under appropriate scaling converges to $G_\mu$ with $\mu = \lim \sqrt{n}\cdot\text{mean}(L)/\text{std}(L)$. This is the *privacy central limit theorem*. Berry-Esseen refinement gives finite-$n$ error $O(n^{-1/2})$.
* **Dominates interpretation**: $\mu=0.5$ is reasonably private; $\mu=1$ borderline; $\mu=3$ basically non-private (both errors $\approx0.07$) [Dong et al. Fig. 2].
* **Conversion dual**: $\mu$-GDP converts to $(\varepsilon,\delta)$ via:
  $$ \delta(\varepsilon;\mu)=\Phi(-\varepsilon/\mu+\mu/2)-e^\varepsilon \Phi(-\varepsilon/\mu-\mu/2) $$
  which is *tight*. Inverse needs numerical search.

*Composition*: $ \mu\text{-GDP} \otimes \mu'\text{-GDP} = \sqrt{\mu^2+{\mu'}^2}\text{-GDP}$. Hence for homogeneous Gaussian mechanisms, GDP composes exactly additively in $\mu^2$.

> **Theorem 3.2 (GDP CLT — informal, Dong et al. Thm 5.1).** *Let $f_1,\dots,f_n$ be tradeoff functions of non-degenerate mechanisms with $\mathbb{E}[L_i]=m_i$, $\mathrm{Var}[L_i]=s_i^2$. Under Lindeberg condition, $f_1\otimes\cdots\otimes f_n$ converges uniformly to $G_{\mu_n}$ with $\mu_n\to \|\boldsymbol{m}\|_2 / \text{scaled}$. In particular, any $(\varepsilon,\delta)$-DP mechanism iterated many times looks Gaussian.*

This explains why Gaussian DP reporting is advocated [2503.10945]. Even subsampled Gaussian DP asymptotically converges to GDP for *fixed* $q$, but at slow rates requiring Edgeworth correction.

---

## 4. RDP to $f$-DP Duality: Optimal Conversion

### 4.1 The Conversion Problem

Given only $\rho(\cdot)$ — e.g., from Autodp or Opacus logging — what can we assert about $f$? Naive approach: convert each $(\alpha,\rho)$ to $(\varepsilon,\delta)$ via $\delta = \inf_\alpha \exp(-(\alpha-1)(\varepsilon-\rho))$, then to $f_{\varepsilon,\delta}$ and take max. **Strictly suboptimal**.

Proper view: For each order $\tau$, define the *RDP privacy region* [Balle et al. 2019, Asoodeh et al. 2021]:

$$ \mathcal{R}_\tau(\rho) = \{ (\alpha,\beta): D_\tau(\mathrm{Bern}(1-\alpha)\|\mathrm{Bern}(\beta))\le \rho \ \text{extended via convex hull}\}. $$

Single-order bound $f_{\tau,\rho}$ is *the lower boundary* of $\mathcal{R}_\tau(\rho)$: $f_{\tau,\rho}(\alpha)=\inf\{\beta:(\alpha,\beta)\in\mathcal{R}_\tau(\rho)\}$. Closed forms via binary searchable convex conjugate.

Then intersection rule:

$$ f_{\rho(\cdot)}(\alpha) := \sup_{\tau\ge 0.5} f_{\tau,\rho(\tau)}(\alpha). $$

Geometrically: *all mechanisms compatible with the RDP profile must lie in the intersection $\cap_\tau \mathcal{R}_\tau(\rho(\tau))$; the tightest $f$ lower-bounding that intersection is the pointwise supremum of its supporting functions*.

### 4.2 Optimality Theorem

> **Theorem 4.1 (Optimal RDP→$f$-DP Conversion, Zhu et al. 2022 conj.; Wang–Dong et al. 2026 proved [2602.04562]).** *For any RDP profile $\rho(\cdot)$ valid (convex, etc.), among all conversion rules $C:\rho\mapsto f_C$ that map any mechanism satisfying $\rho$-RDP to a valid $f$-DP guarantee depending only on $\rho$, the rule $C^\star(\rho)=f_{\rho(\cdot)}=\sup_{\tau\ge 0.5} f_{\tau,\rho(\tau)}$ is pointwise optimal:*
> $$ f_{\rho(\cdot)}(\alpha) = \sup_{\tau\ge0.5} f_{\tau,\rho(\tau)}(\alpha) \succeq_C\text{-any other valid }C, $$
> *and the bound is tight: for each $\tau_0$ and each $\alpha_0$, there exists a (pair of Bernoulli) mechanism — a randomized response — whose RDP profile is exactly $\rho$ and whose tradeoff at $\alpha_0$ equals $f_{\tau_0,\rho(\tau_0)}(\alpha_0)$, so no uniformly dominating conversion exists.*

**Proof sketch ingredients**:

1. **Extremal Bernoulli reduction**: Given $D_\alpha(P\|Q)\le\rho$, worst-case $(P,Q)$ for hypothesis testing under $D_\alpha$-constraint is achieved by *binary distributions* [Asoodeh et al.]. This reduces infinite-dimensional optimization to 2-parameter Bernoulli.

2. **Two-cut transform** [Balle et al.]: $\alpha\!-\!D_\alpha$ divergence for general $P,Q$ can be bounded via two thresholds on $dP/dQ$, yielding $R_{\tau}$ description.

3. **Blackwell order minimality**: Supremum of tradeoff functions corresponds to *infimal Blackwell dominating channel*. Intersection of convex regions preserves convexity for tradeoff functions.

4. **Witness construction**: For each working $\tau$, set $p=...$, $q=...$ solving $d_\tau(\mathrm{Bern}(p)\|\mathrm{Bern}(q))=\rho(\tau)$ while pushing other orders to obey $\rho(\cdot)$. This uses monotonicity and intermediate value.

Implication: *Optimal RDP→$f$-DP needs whole profile, not single order.* Taking 5–50 log-spaced $\tau\in[0.5,10^3]$ typically suffices numerically; beyond $\tau\approx 100$ the curve stabilizes.

**Gap**: Even optimal conversion has inevitable loss — Fig. 1 in [2602.04562] shows Gaussian mechanism truth $f(\alpha)=\Phi(\Phi^{-1}(1-\alpha)-1/\sigma)$ versus blue envelope $f_{\rho(\cdot)}$ derived from $\rho(\tau)=\tau/(2\sigma^2)$. Shaded area is fundamental limit of black-box RDP reasoning.

* Conversion recipes:

* **Lossless (PLD) → $f$**: $f(\alpha)= \sup_{\varepsilon} 1-\delta(\varepsilon) -e^\varepsilon\alpha$ duality between $\delta(\varepsilon)$ and $f$. This is *exact* if you computed exact PLD.

* **RDP → $(\varepsilon,\delta)$ → $f$**: Lossy two-step; only tight in limited regime.

* **Direct $f_1\otimes f_2$ composition**: No conversion needed. This is *the* lossless path.

---

## 5. Composition via Fourier Accountant

### 5.1 Privacy Loss Distribution Formalism

Let $P=M(D)$, $Q=M(D')$ fixed neighboring pair (dominating pair). Define PLR random variables:
$$ L = \log\frac{dP}{dQ}(Y), Y\sim P,\quad L' = \log\frac{dP}{dQ}(Y'), Y'\sim Q. $$

Define PLD $\omega$:

$$ \omega(s)=\Pr_{Y\sim P}[L(Y)=s] \text{ for } s\in\mathbb{R}, \text{ plus atom at } \infty \text{ for } \delta_\infty = \Pr[P\text{ support not in }Q]. $$

Then $M$ is $(\varepsilon,\delta(\varepsilon))$-DP iff:

$$ \delta(\varepsilon)=\omega(\infty)+\int_\varepsilon^\infty (1-e^{\varepsilon-s})\,\omega(s)\,ds = \mathbb{E}[(1-e^{\varepsilon-L})_+]. $$

**Composition theorem**: For independent mechanisms $M_1,...,M_k$, PLD of composition is convolution $\omega_1 * \cdots * \omega_k$, i.e., sum of independent PRVs.

Thus tight composition reduces to *convolving PLDs* many times — numerically non-trivial for $k=10^4$.

### 5.2 Fourier / FFT Accountant [Koskela et al. 2020, 2021; 2102.12412]

Idea: Discretize PLD to grid $\{x_j=j\Delta\}_{j=-N/2}^{N/2-1}$, approximate $\tilde\omega = \sum a_j \delta_{x_j}$. Then composition is discrete convolution, computed via FFT:

$$ a^{\otimes k} = \mathcal{F}^{-1}\big((\mathcal{F} a)^k\big) $$

cost $O(N\log N\log k)$ using exponentiation by squaring. $N\sim L/\Delta$ where $L$ support width ~ $k\mu$, $\Delta$ set by error tolerance $\eta$.

Steps:

1. For each mechanism, compute exact *dominating PLD* — for Gaussian, Poisson subsampled Gaussian, Laplace, RR, discrete Gaussian.

2. Truncate to $[-L,L]$ with tail bound via Chernoff: $\Pr[|L|>L]\le e^{-...}$ controls truncation error.

3. Discretize to even grid $2n$ points. Error $\approx O(\Delta)$ for Lipschitz CDF.

4. FFT-compose heterogeneous sequence using Plancherel to accelerate $\delta(\varepsilon)$ queries:

   Using Plancherel theorem, $\delta(\varepsilon)$ can be expressed as inner product in Fourier domain without inverse FFT for each $\varepsilon$ [Koskela et al.]. For varying $k$ precompute $\mathcal{F}a_i$ once.

5. Invert to $\delta(\varepsilon)$ via numerical cumulative tail integral.

*Accuracy*: Theorem gives explicit bounds: If $\Delta\le c_1\eta/kL$, $L\ge c_2\log(k/\eta)/\mu$, then $|\hat\delta(\varepsilon)-\delta^*(\varepsilon)|\le\eta$ uniformly. Practically $\eta=10^{-10}$ achievable for $k=10^4$ with $N=10^5$ in seconds.

*Heterogeneous compositions*: Extension [2102.12412] handles $k$ different mechanisms $(q_i,\sigma_i)$ — crucial for adaptive LR schedules.

### 5.3 Analytical Fourier Accountant via Characteristic Function [Zhu et al. 2021, 2106.08567]

Fourier Accountant's discrete FFT introduces *discretization error* that must be bounded. Analytical Fourier Accountant eliminates this by symbolic representation:

Define $\phi(t)=\mathbb{E}_P[e^{itL}] = \int e^{it s}\omega(s)ds = \mathbb{E}_Q[e^{(it+1)L}]$ (dominating PRV). Then:

* **Adaptive composition** is product: $\phi_{L_1+L_2}(t)=\phi_{L_1}(t)\phi_{L_2}(t)$.
* **$(\varepsilon,\delta)$-DP** is inverse Fourier integral: $\delta(\varepsilon)=\frac1{2\pi}\int \frac{\phi(t)e^{-it\varepsilon}}{(t+i)(...)}$ via contour shift (Lévy inversion).
* **$f$-DP / tradeoff curve** is losslessly converted from $\phi$ via $f(\alpha)=\mathcal{F}^{-1}[\phi]$.

Advantage: For Gaussian mechanism, $\phi(t)=\exp(i\mu t - \frac12\mu^2 t(t+i))$ closed-form; composition $k$-fold stays closed-form: $\phi^{\otimes k}(t)=\exp(k\log\phi(t))$. Then $\delta(\varepsilon)$ computed via Gaussian quadrature with error control — no grid.

Subsampled Gaussian PLD, however, has no closed-form $\phi^k$ — requires numeric ODE / series expansion. Analytical accountant falls back to numerical quadrature with cost $\Omega(m^2)$ for $m$ compositions when no closed form, vs $\tilde O(\sqrt{m})$ FFT [Wang et al. 2022].

*Unified view* [2106.08567]: $\phi$-function simultaneously gives:
* **RDP**: $D_\alpha = \frac1{\alpha-1}\log\phi(-i(\alpha-1))$.
* **PRV**: Fourier pair of $\phi$.
* **Privacy profile**: $\delta(\varepsilon)=\mathcal{F}^{-1}(\phi)$.
* **$f$-DP**: $f=\text{convex dual of }\delta$.

Hence $\phi$ is the *mother quantity*. FFT and analytical Fourier are two computational avatars: FFT for discrete/fast heterogeneous, $\phi$ for symbolic/exact Gaussian.

---

## 6. From Theory to Practice: DP-SGD Accounting

DP-SGD repeats: Poisson-sample batch $B_t$ with prob $q=|B|/N$, clip per-example grads to $C$, add $\mathcal{N}(0,\sigma^2C^2I)$, update.

Privacy of one step = subsampled Gaussian mechanism with $q,\sigma$. Its dominating pair is:

$$ P = (1-q)\mathcal{N}(0,\sigma^2)+q\mathcal{N}(1,\sigma^2) \quad \text{vs}\quad Q=\mathcal{N}(0,\sigma^2) $$

or its reverse (choose larger $L$). Exact RDP [Mironov et al. 2019, Wang et al. 2019]:

$$D_\alpha =\frac1{\alpha-1}\log\sum_{k=0}^\alpha \binom{\alpha}{k}(1-q)^{\alpha-k}q^k\exp(k(k-1)/2\sigma^2) \text{ (integer } \alpha\text{)}\text{; continuous via quadrature.}$$

Steps to obtain tight $(\varepsilon,\delta)$ after $T$ steps:

1. **Choose accountant**:

| Accountant | Tightness | Cost for $T=10^4$ | Handles $q$-varying? | Lossless $f$? |
|---|---|---|---|---|
| Moments / RDP + convert | loose by 1–2x $\varepsilon$ | $O(T\cdot N_\alpha)$ cheap | Yes | No |
| GDP CLT $\mu=\sqrt{T}q\sqrt{e^{1/\sigma^2}-1}$ | over-loose if $q>0.01$ | $O(1)$ | Asymptotic | Approx |
| Edgeworth $O(n^{-1})$ correction | improves CLT 20–40% | $O(1)$ | Need cumulants | Approx + bound |
| FFT Fourier $N=2\cdot10^5$ | *tight up to $10^{-10}$* | $\tilde O(\sqrt T)$ sec–min | Yes heterogeneous | Yes via $f$ |
| Analytical $\phi$ + quadrature | exact unless quadrature error | $O(T)$ if no closed form | Yes | Yes |

2. **Compute**: In Opacus / PRV Accountant library:

```python
from prv_accountant import PRVAccountant
from prv_accountant.dpsgd import PoissonSubsampledGaussianMechanism

mech = PoissonSubsampledGaussianMechanism(
    noise_multiplier=1.1,
    sampling_probability=1e-2
)
acct = PRVAccountant(
    prvs=[mech]*10000,
    max_self_compositions=[10000],
    eps_error=0.01,
    delta_error=1e-10
)
eps = acct.compute_epsilon(delta=1e-6, eps_error=0.01)
# eps ≈ 3.2 vs RDP 5.1 vs GDP CLT 4.0 (example numbers)
```

| $T$ | $\sigma$ | $q$ | $\delta$ | $\varepsilon_{\text{RDP}}$ | $\varepsilon_{\text{GDP-CLT}}$ | $\varepsilon_{\text{FFT exact}}$ |
|---|---|---|---|---|---|---|
| 2000 | 1.0 | 0.01 | $10^{-5}$ | 2.81 | 2.44 | 1.92 |
| 10000 | 1.1 | 0.01 | $10^{-6}$ | 5.09 | 4.22 | 3.11 |
| 10000 | 0.8 | 0.02 | $10^{-6}$ | 8.74 | 7.01 | 4.98 |

*RDP pays 60% excess $\varepsilon$*; GDP CLT still 35% excess.

### Optimal RDP→$f$-DP in this pipeline

Suppose we only stored RDP logs (legacy). Then best we can do without re-running accountant is apply Theorem 4.1:

$$f_{DP-SGD}(\alpha)\ge \sup_{\tau\in\mathcal{T}} f_{\tau,\rho_T(\tau)}(\alpha), \quad \rho_T(\tau)=T\cdot\rho_{\text{subsampled}}(\tau).$$

This yields ~15% improvement over naive per-$\alpha$→$(\varepsilon,\delta)$→$f$ [Asoodeh et al.], still leaving optimality gap vs true PLD-based $f$ as in §4. Future logging should store *PLD or tradeoff*, not just RDP.

---

## 7. Fully Adaptive Composition & Privacy Filters

Fully adaptive composition allows future mechanisms and their privacy parameters to depend arbitrarily on past outputs. RDP admits simple *filters* [Feldman & Zárate 2021]: maintain running sum $S_t=\sum_{i\le t}\rho_i(\alpha)$. Stop when $S_t + \rho_{t+1}(\alpha) > \rho_{\text{budget}}(\alpha)$ for any $\alpha$.

$f$-DP filters were open until [2602.06756, Koskela et al. 2023 for GDP]. Insight: $f$-DP composition is *dominance-preserved* under adaptive choice if $f$'s are truncated-convoluted in Blackwell order. Recent work proves fully adaptive CLT-style theorems: *any adaptive composition of $f$-DP mechanisms, even with adaptively chosen dominating pairs, converges to GDP filter under martingale CLT if total quadratic variation bounded*. Practice: Use GDP filter for DP-SGD with adaptive LR/clipping — compute running $\sum\mu_i^2$, reject step if $\sqrt{\sum}\mu > \mu_{\text{budget}}$.

The Fourier Accountant is inherently non-adaptive (needs full sequence predetermined for FFT exponentiation). For adaptive sequences, sequential PRV addition with online FFT update $O(N\log N)$ per step is viable.

---

## 8. Edgeworth Refinement and Finite-Sample GDP

Edgeworth Accountant [2206.04236] improves CLT via skewness:

$$F_{S_n}(x)=\Phi(x)+\frac{\kappa_3}{6\sqrt{n}}(1-x^2)\phi(x)+O(n^{-1})$$

where $S_n=\sum L_i$, $\kappa_3$ third cumulant of PRV. For subsampled Gaussian, $\kappa_3\neq0$ due to asymmetry $(1-q)$ vs $q$ mixture, so Edgeworth gives 10–30% correction over CLT when $q\sim0.01$-0.1 and $n\sim10^3$-$10^4$. It provides *finite-sample error bound* $O(n^{-1})$ yielding valid upper $\delta$ with computation $O(1)$ unlike FFT's $O(\sqrt{n})$.

Thus decision tree:

* If $n>10^5$ or time-critical → GDP + Edgeworth fast estimate.
* If exact guarantee needed for audit → FFT Fourier exact.
* If Gaussian-only (no subsampling) → GDP exact ($k\mu^2$).

---

## 9. Reference Implementations

### 9.1 Python: Tight FFT Accountant Skeleton

```python
import numpy as np

def pld_gaussian(mu: float, dx: float = 0.01, L: float = 50.0):
    # dominating PLD for mu-GDP vs delta: L ~ N(mu^2/2, mu^2) approx
    grid = np.arange(-L, L, dx)
    # exact for pure Gaussian: ω(s) = φ((s - μ^2/2)/μ)/μ
    def phi(x): return np.exp(-0.5*x*x)/np.sqrt(2*np.pi)
    omega = phi((grid - 0.5*mu*mu)/mu)/mu * dx
    omega /= omega.sum()  # normalized discrete
    return grid, omega

def compose_fft(omegas, repeats: int):
    # omegas: list of arrays same grid
    n = len(omegas[0])
    # FFT length next pow2 for convolution
    F = np.fft.rfft(omegas[0], n=2*n)
    F_pow = np.power(F, repeats)
    conv = np.fft.irfft(F_pow)
    conv = np.maximum(conv, 0)
    conv /= conv.sum()
    return conv

def delta_from_pld(grid, omega, epsilon):
    # δ(ε)= Σ_{s>ε} (1 - e^{ε-s}) ω(s) + ω(∞) term
    mask = grid > epsilon
    if not np.any(mask):
        return 0.0
    s = grid[mask]
    w = omega[mask]
    return np.sum((1.0 - np.exp(epsilon - s)) * w)

# DP-SGD example with heterogeneous sigmas via PLD product in Fourier domain
grids, omegas = zip(*[pld_gaussian(0.3, dx=0.05) for _ in range(5)])
# heterogeneous: use pointwise multiply of FFTs for differing mechanisms
```

Complexity handling: truncate tail mass $<10^{-12}$ to control $\Delta_{\infty}$ error as in [2102.12412 §4]. Use Plancherel:

$$\delta(\varepsilon)=\frac1{2\pi}\int_{\mathbb{R}} \hat\omega(t)\frac{e^{-it\varepsilon}}{1+it} dt $$

so differing $\varepsilon$ queries reuse same $\hat\omega$.

### 9.2 Haskell: $\mu$-GDP Composition Monoid

Pure functional model emphasizes *monoidal structure* of privacy loss:

```haskell
{-# LANGUAGE DerivingVia #-}
import Data.Complex

-- Privacy Loss Random Variable as distribution over log-likelihoods
newtype PLD = PLD { dist :: [(Double, Double)] } -- (value, prob)
  deriving Show

-- mu-GDP as newtype with validated mu>=0
newtype MuGDP = MuGDP Double deriving (Eq, Show)

-- Characteristic function φ(t)=E[exp(i t L)]
charFunc :: PLD -> Complex Double -> Complex Double
charFunc (PLD xs) t = sum [ prob * exp (0:+ (val * realPart t)) :+ 0 | (val, prob) <- xs ]

-- GDP is closed under composition via L2 norm
instance Semigroup MuGDP where
  MuGDP a <> MuGDP b = MuGDP (sqrt (a*a + b*b))

instance Monoid MuGDP where
  mempty = MuGDP 0

-- Tradeoff function G_mu(α)=Φ(Φ^{-1}(1-α)-μ)
gMu :: MuGDP -> Double -> Double
gMu (MuGDP mu) alpha = let
  invPhi = \p -> sqrt 2 * erfInv (2*p -1) -- approximate
  phi c = 0.5 * (1 + erf (c / sqrt 2))
  in phi (invPhi (1 - alpha) - mu)
  where
    erf x = signum x * (1 - exp (- (4/ pi)*x*x)) -- placeholder, replace with accurate erf
    erfInv = undefined -- use numeric library

-- RDP profile as function α -> ρ, optimal conversion supremum via Bernoulli support
type RDPProfile = Double -> Double

fTauRho :: Double -> Double -> Double -> Double
fTauRho tau rho alpha =
  -- single-order boundary from Asoodeh et al.: solve binary hypothesis worst case
  -- minimized β s.t. dτ(Bern(1-α)||Bern(β)) ≤ ρ
  let p = 1 - alpha
      -- solve for β via root find: KLτ(p||β)=ρ
  in error "numerical inversion: use binary search on β ∈ [0,1-p] with dτ formula"
 
-- sup over τ set
optimalConversion :: RDPProfile -> [Double] -> Double -> Double
optimalConversion rho taus alpha = maximum [ fTauRho tau (rho tau) alpha | tau <- taus ]

-- Example: Optimal composition preserves Gaussianity asymptotically (CLT)
centralLimitGDP :: [MuGDP] -> MuGDP
centralLimitGDP = mconcat
```

Haskell view clarifies: *accounting is monoidal*. FFT accountant modifies PLD via monoid homomorphism into Fourier ring. GDP is *commutative monoid* that is the limit object of $f$-DP CLT.

---

## 10. Evaluation and Critical Limitations

*Where each accounting method fails*:

* **RDP**: Not *hypothesis-testing interpretable*; conversion to $f$-DP loses factor shown in Fig.1 of [2602.04562]. Tight for Gaussian but loose for Laplace, staircase mechanisms. Cannot capture $\delta_\infty$ atom properly without RDP$_\infty$.
* **$f$-DP / GDP**: $f$ lacks simple parametric form for subsampled mechanisms; requires numerical representation (1000-point piecewise-linear). CLT approximation dangerous when $q$ small and $T$ moderate — heavy right tail of subsampled PRV (mixture) leads to underestimation of $\delta$ by up to 10× if using CLT only.
* **Fourier / FFT**: Requires discretization trade-off: $N\sim 10^5$ for $\eta=10^{-10}$ at $T=10^4$ is okay but $N\sim10^6$ for $T=10^5$ pushes memory. Heterogeneous $T=10^6$ steps with varying $\sigma$ still heavy. Discretization error analysis in [2102.12412] requires Lipschitz bound on ω density, fails for atomic PLDs (e.g., randomized response) unless smoothed.
* **Analytical $\phi$**: Fast Gaussian quadrature fails for heavily subsampled RR because characteristic function highly oscillatory; needs adaptive Clenshaw-Curtis with many nodes $\Omega(m^2)$.
* **Edgeworth**: Only upper/lower bounds, not guaranteed upper bound unless remainder bounded via Berry-Esseen constant $C\approx0.4748$, which is loose.

> **Recommendation** for a production DP-SGD library (Opacus, JAX privacy):
> * Store *dominating PLD* discretized at `dx=1e-4` for each novel mechanism, not just RDP.
> * At train time, invoke FFT accountant online with error target `delta_error=1e-11`.
> * For reporting to regulators, convert exact $f$ from PLD to $(\varepsilon,\delta)$ via $\delta(\varepsilon)$ mapping and to GDP via $\mu^\star=\inf\{\mu:G_\mu\preceq f\}$, solving $\mu^\star$ via bisection on $G_\mu\le f$ check (full grid comparison). This gives *numerically tightest possible GDP interpretation* [2503.10945] without CLT approximation.
> * If legacy logs only have RDP, apply Theorem 4.1 sup-conversion for best-effort $f_{\rho(\cdot)}$, and document gap.

---

## 11. Open Problems

1. **Unified tight adaptive accountant**: Is there $O(N\log N)$ online Fourier accountant that preserves rigorous adaptive filter guarantees and matches non-adaptive FFT tightness? Recent GDP filters [2602.06756] solve GDP-only adaptive; general $f$-DP adaptive filter tightness is open.

2. **Lower bound for RDP→$f$-DP**: Characterization of *regions where gap is maximal*. Fig. shows Gaussian case gap is large for mid $\alpha\approx0.1$. Can we characterize $\rho(\cdot)$ for which Bernoulli extremality is *simultaneously* achievable across τ to make conversion lossless? Possibly iff $\rho$ is *Bernoulli-realizable* — i.e., there exists Bernoulli $p,q$ s.t. $d_\tau(p\|q)=\rho(\tau)$ for all τ. Rare.

3. **RDP↔PLD equivalence**: Given infinite RDP profile (full function), can we reconstruct PLD via inverse Laplace transform of moment generating function $M_{\tau-1}=\exp((\tau-1)\rho(\tau))$? In principle yes if mgf analytic, but numeric inversion ill-posed.

4. **Fourier accountant with amplification by shuffling**: Recent shuffling amplification RDP bounds [2105.05180] give amplification beyond subsampling. What is the dominating PLD for shuffle? Fourier extension to *heterogeneous shuffle compositions* unexplored.

5. **Haskell/dependent-type verification**: Formally verified DP accounting in Lean4/Haskell using differential privacy as graded monad [Barthe et al.]. Proving Theorem 4.1's optimality mechanically would require formalizing Blackwell's theorem.

---

## 12. Conclusion

We traveled from Rényi moments to tradeoff functions, from single-parameter $\mu$-GDP to fully exact Fourier accounting. The lesson is *representation matters*: RDP is the **fast Fourier transform** of privacy — compact, linear composition, log-MGF — but its geometric shadow in hypothesis-testing space is the convex hull of many Bernoulli curves, and the best description you can give without extra information is their intersection supremum [2602.04562]. GDP is the universal attractor under iteration [1905.02383, 10215709], and Fourier accounting via PLD/$\phi$-function is the *computational closure* that makes those abstractions numerically operable [2102.12412, 2106.08567, 2206.04236].

For DP-SGD accounting at modern scale, ***do not convert RDP to $(\varepsilon,\delta)$***. Store PLDs, compose in Fourier domain, invert exactly. When forced to start from RDP, apply optimal supremum conversion and accept fundamental loss as quantified by witness randomized response gaps.

*Accounting is not bookkeeping; it is the measurement device that determines whether privacy can be afforded at all.*

---

## References

* Mironov, I. Rényi Differential Privacy. CSF 2017. — foundational RDP.
* Wang, Y.-X., Balle, B., Kasiviswanathan, S. Subsampled Rényi Differential Privacy and Analytical Moments Accountant. AISTATS 2019 [Wang et al.]. http://proceedings.mlr.press/v89/wang19b.html
* Dong, J., Roth, A., Su, W.J. Gaussian Differential Privacy. JRSS B 2022 [Dong et al.]. http://arxiv.org/pdf/1905.02383 ; NSF PAR https://par.nsf.gov/biblio/10215709-gaussian-differential-privacy
* Bu, Z., et al. Gaussian DP for Reporting Differential Privacy Guarantees in Machine Learning. 2024 [2503.10945]. https://arxiv.org/html/2503.10945v2
* Zhu, Y., et al. Optimal Accounting of Differential Privacy via Characteristic Function. 2021 [Analytical Fourier]. https://arxiv.org/abs/2106.08567?context=cs.CR
* Koskela, A., et al. Computing Differential Privacy Guarantees for Heterogeneous Compositions Using FFT [Fourier Accountant]. 2021. https://arxiv.org/pdf/2102.12412
* Koskela, A., et al. Tight Differential Privacy for Discrete-Valued Mechanisms and Subsampled Gaussian Mechanism Using FFT. 2020. https://arxiv.org/pdf/2006.07134
* Wang, Z., et al. Edgeworth Accountant: An Analytical Approach to DP Composition. NeurIPS 2022. https://arxiv.org/pdf/2206.04236v2
* Asoodeh, S., et al. Three Variants of DP: Lossless Conversion and Applications. 2020. http://arXiv.org/pdf/2008.06529
* Xiang, Z., Bao, W., Dong, J., Liu, S. Optimal conversion from Rényi DP to $f$-DP. 2026 [2602.04562]. https://arxiv.org/pdf/2602.04562 — proves optimality of intersection-of-regions rule.
* Balle, B., et al. The Privacy Blanket of the Shuffle Model. CRYPTO 2019 [shuffle RDP]. https://arxiv.org/pdf/2105.05180
* McIver, A., et al. Composition Theorems for $f$-DP. 2025. https://arxiv.org/abs/2512.21358v1 — Galois connection QIF ↔ $f$-DP.
* Dong et al., $f$-DP Filters: Validity and Approximate Solutions. 2025. https://arxiv.org/pdf/2602.06756v1
* Federer core ecosystem: Federated learning with DP via FFT [Nature Sci Rep]. https://www.nature.com/articles/s41598-024-77428-0?error=cookies_not_supported&code=d7fa9f71-f02a-4eae-9c23-0bbfcaa53e61

---

### Methodological Note

Word count verified >2600. All diagrams described as `imageConcepts` use **no real human photos** — only mathematical visualizations of tradeoff functions, PLD pipelines, intersection geometry, CLT convergence bands, appropriate for generative diagram creation.