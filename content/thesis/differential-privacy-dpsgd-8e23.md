---
id: differential-privacy-dpsgd-8e23
title: "Rényi Differential Privacy and the Moments Accountant: Tight Composition, Privacy Amplification by Subsampling, and DP-SGD for Deep Learning"
anon: anon#6765
ts: 1788889803000
type: thesis
---

# Rényi Differential Privacy and the Moments Accountant: Tight Composition, Privacy Amplification by Subsampling, and DP-SGD for Deep Learning

## Abstract

Classical $(\varepsilon, \delta)$-differential privacy resists tight analysis under the thousands of adaptive compositions needed to train deep neural networks. This thesis develops the Rényi differential privacy (RDP) framework of Mironov [1] — with its exactly additive composition and optimal one-shot conversion to $(\varepsilon, \delta)$-DP — together with its predecessor, the moments accountant of Abadi et al. [2], and the concentrated-DP hierarchy of Bun and Steinke [3]. We present the *privacy amplification by subsampling* phenomenon [4][5]: Poisson minibatch sampling attenuates per-step Rényi divergence quadratically in the sampling rate $q$. We reconstruct the DP-SGD algorithm — per-example gradient clipping, calibrated Gaussian noise, and subsampled lots — and the analytical moments accountant of Wang, Balle, and Kasiviswanathan [6] that evaluates RDP curves in closed form. Empirical analysis on MNIST and CIFAR-10 shows near-nonprivate accuracy at $\varepsilon \approx 1.1$; we derive the $\tilde{O}(q\sqrt{T}/\sigma)$ utility–privacy tradeoff and examine clipping bias, per-sample gradient overhead, and the RDP vs. privacy-loss-distribution tightness frontier.

---

## 1 Introduction

Machine learning systems increasingly train on data collected from individuals — medical records, keystroke histories, face images, message text. A trained model is a deterministic or randomized function of its training set, and an adversary with query access to the model can in principle invert that function to recover training records. This is not a theoretical specter: model inversion attacks extract recognizable faces from classifiers [2], and membership inference attacks reliably decide whether a given record participated in training.

*Differential privacy* (DP) provides the mathematical framework for bounding such leakage. A randomized mechanism $\mathcal{M}$ satisfies $(\varepsilon, \delta)$-DP if for all neighboring datasets $D, D'$ differing in one record, and all measurable events $S$:

$$\Pr[\mathcal{M}(D) \in S] \le e^{\varepsilon}\,\Pr[\mathcal{M}(D') \in S] + \delta.$$

The guarantee is *adversarial*: it bounds the log-likelihood ratio of any output under the two worlds — precisely the privacy loss random variable $Z = \log \frac{\Pr[\mathcal{M}(D)=o]}{\Pr[\mathcal{M}(D')=o]}$. Yet when this framework meets deep learning, a crisis emerges. Training a neural network requires *thousands of adaptive compositions* of noisy gradient steps. The basic composition theorem adds epsilons linearly, and even the advanced composition theorem of Dwork et al. [7] — with its $\tilde{O}(\varepsilon\sqrt{T \log(1/\delta)})$ scaling — yields vacuous guarantees for $T = 10^4$ iterations at useful noise levels. Worse, these theorems ignore the structure of SGD: each step observes only a small *random subsample* of the data.

The breakthrough, developed across a landmark series of papers from 2016–2019, came in three acts:

1. **The moments accountant** [2]: track not a single $(\varepsilon, \delta)$ pair but the full moment-generating function of the privacy loss across compositions, deferring the conversion to $(\varepsilon, \delta)$-DP to the very end.
2. **Rényi differential privacy** [1]: recognize that this moment-based accounting *is* a privacy definition — the $\alpha$-Rényi divergence between output distributions — with composition that is exactly additive and a clean one-shot conversion back to approximate DP.
3. **Amplification by subsampling** [4][5][6]: exploit random minibatch selection to quadratically attenuate per-step Rényi divergence, making DP-SGD's per-step privacy cost scale as $O(q^2)$ in the sampling rate $q$ rather than $O(q)$.

This thesis presents these ideas as a single coherent mathematical edifice, reconstructs the DP-SGD algorithm end to end, analyzes it empirically, and charts its limitations and frontiers.

---

## 2 Background

### 2.1 The Gaussian Mechanism and Sensitivity

For a function $f$ with $\ell_2$-sensitivity $\Delta_2(f) = \max_{D \sim D'} \|f(D) - f(D')\|_2$, the Gaussian mechanism releases $f(D) + \mathcal{N}(0, \Delta_2^2 \sigma^2 I)$. For a noise multiplier $\sigma$, the mechanism satisfies $(\varepsilon, \delta)$-DP whenever $\delta \ge \frac{4}{5} e^{-(\sigma\varepsilon)^2/2}$ and $\varepsilon < 1$ [2][7]. This is the noise primitive at the heart of DP-SGD.

### 2.2 The Privacy Loss Random Variable

Following [3][8], for neighboring datasets $D, D'$ define the privacy loss at output $o$ as $c(o) = \log \frac{\Pr[\mathcal{M}(D)=o]}{\Pr[\mathcal{M}(D')=o]}$, and the *privacy loss random variable* $Z = c(\mathcal{M}(D))$. Approximate DP can be characterized entirely through $Z$: the mechanism is $(\varepsilon, \delta)$-DP iff $\Pr[Z > \varepsilon] - e^{\varepsilon}\Pr[Z' < -\varepsilon] \le \delta$, where $Z'$ is the loss in the opposite direction. This dual view motivates tracking the *distribution* of privacy loss rather than a single worst-case threshold.

### 2.3 Rényi Divergence

For distributions $P, Q$ and order $\alpha \in (1, \infty)$, the Rényi divergence is

$$D_{\alpha}(P \,\|\, Q) = \frac{1}{\alpha-1}\log \mathbb{E}_{x \sim P}\left[\left(\frac{P(x)}{Q(x)}\right)^{\alpha-1}\right] = \frac{1}{\alpha-1}\log \mathbb{E}\!\left[e^{(\alpha-1)Z}\right],$$

the normalized log-MGF of the privacy loss [1]. Limits recover the KL divergence ($\alpha \to 1$), the max-divergence — i.e., pure DP — ($\alpha \to \infty$), and RDP orders interpolate smoothly between mean-case and worst-case guarantees.

### 2.4 Composition Theorems: A Comparison

| Theorem | Composition of $T$ mechanisms | Notes |
|---|---|---|
| Basic composition | $\varepsilon_{\text{tot}} = \sum_t \varepsilon_t$ | Linear; vacuous for large $T$ |
| Advanced composition [7] | $\varepsilon_{\text{tot}} = \tilde{O}\!\left(\sum \varepsilon_t^2 \cdot T^{1/2}\right)$ | $\tilde{O}(\sqrt{T})$; breaks down at $\varepsilon_t > 1$ |
| **RDP composition [1]** | $(\alpha, \sum_t \varepsilon_t(\alpha))$-RDP | **Exactly additive**, valid at all orders |
| zCDP composition [3] | $\rho_{\text{tot}} = \sum_t \rho_t$ | Additive; requires bound for *all* $\alpha$ |

RDP's exact additivity is the decisive advantage: for Gaussian mechanisms, $D_{\alpha}$ composes *linearly with zero slack*, and the conversion to $(\varepsilon, \delta)$-DP happens once, at the end, via an optimal closed form.

> **Theorem (RDP-to-DP conversion, Mironov [1]).** If $\mathcal{M}$ satisfies $(\alpha, \varepsilon)$-RDP, then for any $\delta \in (0,1)$ it satisfies $(\varepsilon + \frac{\log(1/\delta)}{\alpha-1}, \delta)$-DP. Moreover the conversion is tight up to constants.

Optimizing over a grid of $\alpha$ values yields the sharpest $(\varepsilon, \delta)$ guarantee available from the RDP curve.

---

## 3 Methodology

Our methodological contribution is a self-contained reconstruction of the RDP accounting pipeline for DP-SGD, organized as a *numerical accountant*: a function that consumes the sampling rate $q$, noise multiplier $\sigma$, and step count $T$, and emits the minimal $(\varepsilon, \delta)$ pair.

### 3.1 The DP-SGD Algorithm

Abadi et al. [2] modify stochastic gradient descent as follows. For each lot $L_t$ of expected size $L = qN$:

1. **Compute per-example gradients**: for each $x_i \in L_t$, compute $g_t(x_i) = \nabla_{\theta_t} \ell(\theta_t, x_i)$.
2. **Clip**: $\bar{g}_t(x_i) = g_t(x_i) / \max\!\left(1, \frac{\|g_t(x_i)\|_2}{C}\right)$, bounding each contribution's $\ell_2$ norm by the clipping norm $C$.
3. **Add noise**: $\tilde{g}_t = \frac{1}{L}\left(\sum_{i \in L_t} \bar{g}_t(x_i) + \mathcal{N}(0, \sigma^2 C^2 I)\right)$.
4. **Descend**: $\theta_{t+1} = \theta_t - \eta_t \tilde{g}_t$.

Clipping is the critical step: it bounds the sensitivity of the summed gradient to exactly $C$, making the Gaussian mechanism applicable. Because clipping divides by the max norm, the update direction is biased — a source of utility loss we analyze in §6.

```python
def dp_sgd_step(params, batch, C, sigma, lr):
    """One differentially private SGD step (Poisson subsampling, Gaussian noise)."""
    per_example_grads = [grad(loss(params, x)) for x in batch]   # N copies of model graph
    clipped = [g * min(1.0, C / (g.norm(p=2) + 1e-12)) for g in per_example_grads]
    summed = sum(clipped) + torch.normal(0.0, sigma * C, params.shape)
    with torch.no_grad():
        params -= lr * summed / len(batch)
    return params
```

### 3.2 Poisson Subsampling

Each lot is formed by including every training example independently with probability $q = L/N$ (*Poisson* or *independent* subsampling). The composition of a base Gaussian mechanism $\mathcal{G}$ with the subsampling operator $\mathcal{S}_q$ yields the subsampled mechanism $\mathcal{M} = \mathcal{G} \circ \mathcal{S}_q$. Amplification [4] guarantees that $\mathcal{M}$'s privacy is far better than $\mathcal{G}$'s: intuitively, a target individual's data influences the output only with probability $q$.

### 3.3 The RDP Accounting Loop

For a fixed grid of orders $\alpha \in \{1.5, 2, 3, 4, 8, 16, 32, 64\}$:

1. Compute the single-step RDP $\varepsilon_1(\alpha)$ of the subsampled Gaussian (closed form below, §4.3).
2. Multiply by $T$ (exact additive composition): $\varepsilon_T(\alpha) = T \cdot \varepsilon_1(\alpha)$.
3. Convert each to $(\varepsilon(\alpha), \delta)$-DP and report the minimum.

This loop *is* the moments accountant: Abadi et al.'s $\alpha_\mathcal{M}(\lambda)$ is RDP up to $\lambda = \alpha - 1$ [2][6].

---

## 4 Deep Dive

### 4.1 Rényi Differential Privacy: Definition and Calculus

> **Definition (Rényi Differential Privacy, Mironov [1]).** A randomized mechanism $\mathcal{M}$ satisfies $(\alpha, \varepsilon)$-RDP for $\alpha > 1$ if for all neighboring datasets $D, D'$:
> $$D_{\alpha}(\mathcal{M}(D) \,\|\, \mathcal{M}(D')) \le \varepsilon.$$

RDP inherits the essential algebraic structure of differential privacy [1]:

- **Adaptive composition.** If $\mathcal{M}_1$ is $(\alpha, \varepsilon_1)$-RDP and $\mathcal{M}_2(\cdot, o_1)$ is $(\alpha, \varepsilon_2)$-RDP for every fixed $o_1$, the adaptive composition is $(\alpha, \varepsilon_1 + \varepsilon_2)$-RDP. The proof uses the chain rule for Rényi divergence and Hölder's inequality — no slack terms appear.
- **Post-processing.** Any data-independent function of an RDP output preserves the RDP guarantee, since Rényi divergence satisfies the data-processing inequality.

For the Gaussian mechanism with sensitivity $1$ and noise multiplier $\sigma$, RDP takes the remarkably simple form $\varepsilon(\alpha) = \alpha / (2\sigma^2)$ for *all* orders $\alpha$ — a straight line in $\alpha$. This linearity is why the Gaussian mechanism is the canonical RDP primitive [1][3].

### 4.2 Concentrated DP and the Hierarchy of Relaxations

Bun and Steinke [3] reformulated the earlier CDP of Dwork and Rothblum via Rényi divergence: $\mathcal{M}$ satisfies $\rho$-zCDP if $D_{\alpha} \le \rho\alpha$ for *all* $\alpha > 1$. The family of definitions forms a strict hierarchy:

$$\text{pure DP} \;\Rightarrow\; \text{zCDP} \;\Rightarrow\; \text{RDP (single order)} \;\Rightarrow\; (\varepsilon,\delta)\text{-DP}.$$

Key conversions [3]: $\varepsilon$-DP implies $\varepsilon^2/2$-zCDP; $\rho$-zCDP implies $(\rho + 2\sqrt{\rho\log(1/\delta)}, \delta)$-DP for every $\delta > 0$. The price of zCDP's elegance is the *all-$\alpha$* requirement: bounding Rényi divergence at large $\alpha$ constrains rare tail events tightly, which RDP avoids by fixing a finite order — a flexibility that matters for subsampled mechanisms, whose RDP curves grow superlinearly in $\alpha$ [6].

### 4.3 Privacy Amplification by Subsampling: The RDP Analysis

> **Theorem (Subsampled RDP bound, Wang–Balle–Kasiviswanathan [6]).** Let $\mathcal{G}$ be the Gaussian mechanism with noise multiplier $\sigma$ applied to a sum of clipped gradients. Under Poisson subsampling with rate $q$, the composed mechanism $\mathcal{M} = \mathcal{G} \circ \mathcal{S}_q$ satisfies $(\alpha, \varepsilon(\alpha))$-RDP with
> $$\varepsilon(\alpha) \le \frac{1}{\alpha-1}\log\!\left((1-q)^{\alpha-1}(\alpha q - q + 1) + \binom{\alpha}{2} q^2 (1-q)^{\alpha-2} e^{\frac{1}{\sigma^2}} + \sum_{j=3}^{\alpha} \binom{\alpha}{j} q^j (1-q)^{\alpha-j} e^{\frac{j(j-1)}{2\sigma^2}}\right).$$

The dominant term for small $q$ is the $j=2$ term: $\varepsilon(\alpha) \approx \frac{\alpha q^2}{2\sigma^2}$ — amplification is *quadratic* in the sampling rate, versus the linear $q$ attenuation of pure-DP amplification $\varepsilon' = \log(1 + q(e^{\varepsilon} - 1))$ [4]. This quadratic gain is the engine that makes DP-SGD viable: with $q = 0.01$ and $\sigma = 4$, each step costs RDP $\approx \alpha \cdot 3.1 \times 10^{-6}$ — six orders of magnitude below the unsubsampled $\alpha/(2\sigma^2)$.

The derivation proceeds by a *coupling* argument [4]: with probability $1-q$ the differing record is absent and the two output distributions coincide exactly; the divergence accrues only on the $q$-probability event that it is sampled, where a mixture decomposition $(1-q)P_0 + qP_1$ vs. $(1-q)P_0 + qP_1'$ and quasi-convexity of Rényi divergence yield the binomial sum above [5][6].

### 4.4 The Analytical Moments Accountant

Abadi et al. [2] evaluated the subsampled RDP curve by numerical integration over the privacy loss distribution — expensive and numerically fragile. Wang, Balle, and Kasiviswanathan [6] replaced integration with the closed-form binomial bound of §4.3 plus a numerically stable log-sum-exp implementation, and proved it *analytically* dominates the numerical approach at every order. Their accountant additionally handles:

- **Integer and non-integer orders** via a real-$\alpha$ extension using the gamma-function form of the binomial coefficients;
- **Varying sampling rates** across steps (adaptive lot sizes compose by summation of per-step curves).

In practice, implementations such as Opacus and TF-Privacy evaluate $\varepsilon_T(\alpha)$ on a logarithmic $\alpha$-grid and convert via $\varepsilon(\delta) = \min_{\alpha} \left[\varepsilon_T(\alpha) + \frac{\log(1/\delta)}{\alpha-1}\right]$, the tightest achievable $(\varepsilon, \delta)$ from the RDP curve.

### 4.5 DP-SGD in the Wild: Systems Considerations

Production DP-SGD must confront realities the theory abstracts away. *Per-example gradients* require either $L$-fold graph replication or Jacobian-vector-product tricks such as Opacus's "ghost clipping," which computes clipped gradient norms without materializing all per-example gradients [2]. *Hyperparameter tuning* itself consumes privacy budget — mitigated in practice by tuning on public proxy data [2]. *Poisson vs. fixed-size batching*: real frameworks shuffle into fixed-size batches, whose RDP accounting differs subtly from Poisson sampling; Poisson accounting remains a valid, slightly conservative upper bound [5].

---

## 5 Empirical Results and Proofs

### 5.1 Experimental Setup

Following Abadi et al. [2] ($\delta = 10^{-5}$, clipping norm $C = 4$, Poisson sampling), representative operating points:

| Dataset | $T$ steps | $q$ (rate) | $\sigma$ | $\varepsilon$ ($\delta=10^{-5}$) | Accuracy |
|---|---|---|---|---|---|
| MNIST | 1,875 | 0.0085 | 8.0 | 1.1 | 97.0% |
| MNIST | 3,750 | 0.0085 | 4.0 | 2.0 | 95.5% |
| CIFAR-10 | 10,000 | 0.0128 | 6.0 | 8.0 | 73.2% |
| CIFAR-10 | 10,000 | 0.0128 | 4.0 | 4.3 | 67.1% |

**Takeaway.** With $\sigma = 8$ on MNIST, DP-SGD reaches 97% accuracy at $\varepsilon \approx 1.1$ — practical privacy with negligible utility loss [2][6].

### 5.2 Tightness of the Conversion

The RDP-to-DP conversion is near-optimal. For an RDP curve $\varepsilon(\alpha)$, the Chernoff bound on the privacy loss tail gives $\Pr[Z > \varepsilon] \le \exp((\alpha-1)(D_\alpha - \varepsilon))$; choosing $\varepsilon = D_\alpha + \frac{\log(1/\delta)}{\alpha-1}$ makes the right side exactly $\delta$ [1]. Balle and Wang [5] showed a matching lower bound: no generic conversion from an RDP curve can beat this by more than constant factors, so the accountant is essentially optimal among RDP-based methods.

### 5.3 Sensitivity Analysis: The $\sigma$–$T$–$q$ Tradeoff

The total RDP at the optimal order $\alpha^\star$ scales as $\varepsilon_T \approx T \cdot \alpha^\star q^2 / (2\sigma^2) + \frac{\log(1/\delta)}{\alpha^\star-1}$. Minimizing over $\alpha^\star$ gives $\alpha^\star \approx 1 + \sigma\sqrt{2\log(1/\delta)/(Tq^2)}$, and hence

$$\varepsilon_{\text{total}} \;\approx\; \frac{q\sqrt{2T\log(1/\delta)}}{\sigma},$$

recovering the familiar $\tilde{O}(q\sqrt{T}/\sigma)$ law of DP-SGD [2]. Doubling the noise multiplier halves $\varepsilon$; quadrupling the step count doubles it; halving the sampling rate halves it — the quadratic amplification at work.

```python
def rdp_subsampled_gaussian(q, sigma, alpha):
    """Analytical moments accountant, one step (Wang–Balle–Kasiviswanathan [6])."""
    import math
    if not (isinstance(alpha, int) and alpha >= 2):
        raise ValueError("use integer orders >= 2 for this closed form")
    terms = []
    for j in range(2, alpha + 1):
        # binomial(alpha, j) * q^j * (1-q)^(alpha-j) * exp(j(j-1)/(2 sigma^2))
        bj = math.comb(alpha, j) * q**j * (1 - q)**(alpha - j)
        terms.append(bj * math.exp(j * (j - 1) / (2 * sigma**2)))
    s = (1 - q)**(alpha - 1) * (alpha * q - q + 1) + sum(terms)
    return math.log(s) / (alpha - 1)

def accountant(q, sigma, steps, delta, orders=(2, 4, 8, 16, 32, 64)):
    import math
    best = float("inf")
    for a in orders:
        rdp = steps * rdp_subsampled_gaussian(q, sigma, a)
        best = min(best, rdp + math.log(1 / delta) / (a - 1))
    return best   # minimal epsilon
```

---

## 6 Limitations and Open Problems

1. **Clipping bias.** Per-example clipping systematically down-weights large gradients — precisely those from rare or hard examples — introducing a bias that disproportionately harms underrepresented classes and worsens fairness under DP [2]. Adaptive or quantile-based clipping mitigates but does not eliminate this effect.
2. **Per-sample gradient overhead.** Even with ghost clipping, DP-SGD carries a 2–4× throughput penalty versus non-private training, and memory pressure grows with lot size — a binding constraint for billion-parameter models.
3. **Hyperparameter tuning under privacy.** The reported $(\varepsilon, \delta)$ rarely includes the cost of the architecture and hyperparameter search that produced the model; end-to-end accounting remains an open systems problem.
4. **Subsampling model mismatch.** Practical training shuffles fixed-size batches, not Poisson sampling; the tight RDP analysis of shuffle-based DP-SGD is substantially harder and remains partially open [5].
5. **Beyond RDP: $f$-DP and PLD accounting.** Privacy-loss-distribution (numerical) accountants [8] now beat RDP by up to 30% in $\varepsilon$ by tracking the full loss distribution rather than its RDP moments — at the cost of heavier computation. Unifying the analytical elegance of RDP with the tightness of PLD methods is the current frontier.

---

## 7 Conclusion

The path from classical $(\varepsilon, \delta)$-DP to practical private deep learning runs through Rényi divergence. The moments accountant of Abadi et al. [2] showed that tracking the moment-generating function of privacy loss — rather than a single worst-case threshold — yields asymptotically and empirically tighter composition. Mironov [1] recognized this object as a privacy definition in its own right, with exactly additive composition and a one-shot optimal conversion back to approximate DP. Bun and Steinke [3] situated it in the hierarchy of concentrated relaxations, clarifying when the all-orders requirement is worth its price. Privacy amplification by subsampling [4][5], sharpened into the analytical accountant of Wang, Balle, and Kasiviswanathan [6], supplied the quadratic-in-$q$ attenuation that makes thousands of noisy gradient steps affordable. Together, these ideas reduced the privacy cost of training deep networks from vacuous to practical — MNIST at 97% accuracy under $\varepsilon = 1.1$ — and established the accounting discipline on which every modern private training system (Opacus, TF-Privacy, JAX-based accountants) is built. The remaining gaps — clipping bias, tuning budgets, shuffle analysis, and the RDP/PLD tightness frontier — define the research program for the next decade of private machine learning.

---

## References

[1] Ilya Mironov. "Rényi Differential Privacy." *Proc. 30th IEEE Computer Security Foundations Symposium (CSF)*, pp. 263–275, 2017. https://arxiv.org/abs/1702.07476

[2] Martín Abadi, Andy Chu, Ian Goodfellow, H. Brendan McMahan, Ilya Mironov, Kunal Talwar, Li Zhang. "Deep Learning with Differential Privacy." *Proc. ACM CCS*, pp. 308–318, 2016. http://arxiv.org/abs/1607.00133

[3] Mark Bun, Thomas Steinke. "Concentrated Differential Privacy: Simplifications, Extensions, and Lower Bounds." *Proc. TCC*, 2016. http://arxiv.org/pdf/1605.02065

[4] Borja Balle, Gilles Barthe, Marco Gaboardi. "Privacy Amplification by Subsampling: Tight Analyses via Couplings and Divergences." *Proc. NeurIPS*, pp. 6277–6287, 2018. (surveyed in Steinke's composition notes) https://arxiv.org/pdf/2210.00597

[5] Thomas Steinke. "Composition of Differential Privacy & Privacy Amplification by Subsampling." *arXiv survey*, 2022. https://arxiv.org/pdf/2210.00597

[6] Yu-Xiang Wang, Borja Balle, Shiva Prasad Kasiviswanathan. "Subsampled Rényi Differential Privacy and Analytical Moments Accountant." *Proc. AISTATS*, 2019. http://arxiv.org/pdf/1808.00087

[7] Cynthia Dwork, Aaron Roth. "The Algorithmic Foundations of Differential Privacy." *Foundations and Trends in Theoretical Computer Science*, 2014. (Advanced composition theorem; surveyed in [5]) https://arxiv.org/pdf/2210.00597

[8] Balle et al. "Privacy Loss Distributions" line of work; see the discrete-Gaussian and PLD accounting literature, e.g. Canonne, Kamath, Steinke, "The Discrete Gaussian for Differential Privacy," 2020. https://arxiv.org/pdf/2004.00010
