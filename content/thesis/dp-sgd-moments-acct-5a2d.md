---
id: dp-sgd-moments-acct-5a2d
title: "Differential Privacy for Machine Learning: DP-SGD, the Moments Accountant, and Rényi Differential Privacy Composition"
anon: anon#4731
ts: 1788886204000
type: thesis
---

# Differential Privacy for Machine Learning: DP-SGD, the Moments Accountant, and Rényi Differential Privacy Composition

## Abstract

## 1 Introduction

The last decade has witnessed machine learning models grow from thousands to trillions of parameters, trained on datasets scraped, crowdsourced, or harvested from users at planetary scale. These datasets routinely contain sensitive information: medical records, private messages, financial histories, biometric identifiers. A trained model is therefore not merely a function — it is a compressed artifact of the data that produced it, and it can be interrogated. Fredrikson, Jha, and Ristenpart demonstrated *model inversion attacks* that recover recognizable images from a facial recognition system given only black-box confidence scores [10]. Shokri and Shmatikov's membership inference attacks determine whether a specific record participated in training. In federated and distributed settings, even *gradients* exchanged during training can be inverted to reconstruct the underlying examples.

Classical anonymization — removing names, hashing identifiers, $k$-anonymity — has failed repeatedly against such adversaries because it provides no formal bound on what can be inferred. Differential privacy, introduced by Dwork, McSherry, Nissim, and Smith [3] and systematized by Dwork and Roth [2], replaces ad hoc sanitization with a mathematical guarantee: the output distribution of a differentially private algorithm is nearly indistinguishable whether or not any single individual's record is present in the input. The guarantee is *worst-case* (it holds against adversaries with arbitrary auxiliary information), *composable* (privacy losses add up predictably across analyses), and *quantitative* (the parameter $\varepsilon$ measures the leakage).

Applying differential privacy to *deep learning* posed a severe challenge for years. Early attempts either restricted attention to convex models with few parameters, or produced privacy budgets so large ($\varepsilon$ in the hundreds) as to be meaningless [2]. The breakthrough came with Abadi et al.'s *Deep Learning with Differential Privacy* (CCS 2016) [1], which introduced two ingredients that remain the foundation of the field:

1. **DP-SGD**, an algorithm that clips per-example gradients to bound their sensitivity and perturbs the averaged update with Gaussian noise, and
2. **the moments accountant**, a privacy analysis that tracks the higher moments of the privacy loss random variable across training steps, yielding dramatically tighter bounds than generic composition theorems.

Subsequent work recast the moments accountant in the cleaner language of *Rényi differential privacy* (RDP), introduced by Mironov [4], which is now the standard accounting discipline in production libraries. This thesis presents the full arc: definitions, mechanisms, the DP-SGD algorithm, the moments accountant, RDP composition, amplification by subsampling, and the empirical utility–privacy tradeoff.

---

## 2 Background

### 2.1 Differential privacy

Let $\mathcal{D}$ denote the space of datasets. Two datasets $d, d' \in \mathcal{D}$ are *adjacent* (written $d \sim d'$) if they differ in a single record — by addition/removal or by substitution, depending on convention. A randomized mechanism $\mathcal{M}: \mathcal{D} \to \mathcal{R}$ is differentially private if its output distribution is insensitive to the replacement of any one record:

> **Definition (Approximate differential privacy):** A randomized mechanism $\mathcal{M}$ satisfies $(\varepsilon, \delta)$-differential privacy if for all adjacent $d, d' \in \mathcal{D}$ and all measurable $S \subseteq \mathcal{R}$,
>
> $$\Pr[\mathcal{M}(d) \in S] \;\le\; e^{\varepsilon}\,\Pr[\mathcal{M}(d') \in S] \;+\; \delta.$$

The parameter $\varepsilon \ge 0$ is the *privacy budget* (smaller is more private); $\delta \ge 0$ is a small failure probability, conventionally chosen as $o(1/N)$ for a dataset of size $N$ [2]. The original definition of Dwork et al. used $\delta = 0$ (pure $\varepsilon$-DP); the approximate variant permits a $\delta$-probability event on which the $\varepsilon$ bound may be violated [2].

Four properties make differential privacy uniquely suitable as a foundation for private machine learning [2]:

- **Composability.** If $\mathcal{M}_1$ is $(\varepsilon_1, \delta_1)$-DP and $\mathcal{M}_2$ is $(\varepsilon_2, \delta_2)$-DP, then their joint release $(\mathcal{M}_1(d), \mathcal{M}_2(d))$ is $(\varepsilon_1 + \varepsilon_2, \delta_1 + \delta_2)$-DP. Tighter *advanced composition* bounds give $\varepsilon \approx \sqrt{2T \log(1/\delta')}\,\varepsilon_0 + T\varepsilon_0(e^{\varepsilon_0} - 1)$ for $T$-fold composition [8].
- **Post-processing immunity.** Any (possibly randomized) function of a DP output is DP with the same parameters. Training a classifier on DP-released gradients cannot weaken the guarantee.
- **Group privacy.** For datasets differing in $k$ records, an $(\varepsilon, \delta)$-DP mechanism is $(k\varepsilon, k e^{(k-1)\varepsilon}\delta)$-DP: protection degrades gracefully for correlated inputs such as multiple records from one individual [2].
- **Robustness to auxiliary information.** The guarantee holds against adversaries with arbitrary side knowledge — the adversary in DP-SGD is assumed to know the algorithm, the model architecture, and all but one training record [1].

### 2.2 Sensitivity and the Gaussian mechanism

The standard blueprint for a DP mechanism is *additive noise calibrated to sensitivity* [1][2]. For $f: \mathcal{D} \to \mathbb{R}^p$, the $\ell_2$-*sensitivity* is

$$\Delta_2(f) \;=\; \max_{d \sim d'} \lVert f(d) - f(d') \rVert_2.$$

The *Gaussian mechanism* releases $\mathcal{M}(d) = f(d) + \mathcal{N}(0, \sigma^2 \Delta_2(f)^2 I_p)$. The classical calibration states [1][2]:

> **Theorem (Gaussian mechanism):** For $\varepsilon \in (0, 1)$ and $\delta > 0$, the Gaussian mechanism with $\sigma \ge \sqrt{2 \ln(1.25/\delta)} / \varepsilon$ satisfies $(\varepsilon, \delta)$-DP.

In DP-SGD it is convenient to parametrize noise by the *noise multiplier* $\sigma$ relative to a clipping norm $C$ (the sensitivity), so that the added noise is $\mathcal{N}(0, \sigma^2 C^2 I)$.

### 2.3 Stochastic gradient descent

Deep learning minimizes a nonconvex empirical loss $\mathcal{L}(\theta) = \frac{1}{N}\sum_{i=1}^N \mathcal{L}(\theta, x_i)$ over parameters $\theta$ via minibatch SGD: at each step, a batch $B$ of examples is drawn, the batch gradient $g_B = \frac{1}{|B|}\sum_{x \in B} \nabla_\theta \mathcal{L}(\theta, x)$ is computed, and $\theta \leftarrow \theta - \eta\, g_B$. The privacy problem is immediate: $g_B$ is a deterministic function of the batch, so releasing it (or the updated $\theta$) can leak the examples in $B$. DP-SGD modifies this loop so that every data access is mediated by a bounded-sensitivity, noise-perturbed query.

---

## 3 Methodology

Our methodology follows the three-part structure of Abadi et al. [1], extended with the modern RDP accounting view [4][5][6]:

1. **Private algorithm (DP-SGD).** Replace the SGD update with a per-sample clipped, Gaussian-perturbed update whose $\ell_2$ sensitivity is bounded by a constant $C$ independent of the data, model, and dimension.
2. **Privacy accounting (moments accountant / RDP).** Track the privacy loss of each of the $T$ training steps as a random variable, compose the steps tightly using the log moment-generating function (equivalently, Rényi divergences of fixed order $\alpha$), and convert the composed bound back to $(\varepsilon, \delta)$-DP.
3. **Amplification by subsampling.** Exploit the fact that each step touches only a random subsample (sampling ratio $q = L/N$) to *amplify* privacy: the per-step cost diminishes roughly quadratically in $q$ [5][9].

### 3.1 Threat model

We assume a strong adversary: full knowledge of the training algorithm, architecture, and hyperparameters; access to all intermediate parameter vectors $\theta_t$ (equivalently, all noisy gradients); and control over all training records except one target record. The guarantee must hold for *every* record [1]. Hyperparameter tuning itself is *not* covered by the accounting below unless performed with additional budget — a caveat we return to in Section 6.

### 3.2 The DP-SGD algorithm

| Step | Operation | Privacy role |
|------|-----------|--------------|
| 1 | Initialize $\theta_0$ randomly | No data access |
| 2 | Sample batch $L_t$ with probability $q = L/N$ (Poisson subsampling) | Enables amplification |
| 3 | For each $x_i \in L_t$: $g_t(x_i) \gets \nabla_{\theta_t}\mathcal{L}(\theta_t, x_i)$ | Per-sample gradients |
| 4 | Clip: $\bar{g}_t(x_i) \gets g_t(x_i) / \max\!\left(1, \frac{\lVert g_t(x_i)\rVert_2}{C}\right)$ | Bounds sensitivity to $C$ |
| 5 | $\tilde{g}_t \gets \frac{1}{L}\left(\sum_i \bar{g}_t(x_i) + \mathcal{N}(0, \sigma^2 C^2 I)\right)$ | Gaussian mechanism |
| 6 | $\theta_{t+1} \gets \theta_t - \eta_t \tilde{g}_t$ | Post-processing (free) |
| 7 | Output $\theta_T$ and the accounted $(\varepsilon, \delta)$ | Privacy accountant |

Step 6 is post-processing and costs no privacy. The clipping in Step 4 is the crux: because no a priori bound on gradient norms exists for deep networks, each per-sample gradient is projected onto the $\ell_2$ ball of radius $C$, so replacing one example changes the *sum* of clipped gradients by at most $C$ in $\ell_2$ norm. The Gaussian mechanism then applies with sensitivity $C$ and noise multiplier $\sigma$ [1].

A compact reference implementation of the core loop:

```python
import torch

def dpsgd_step(params, batch, loss_fn, C, sigma, lr):
    # per-sample gradients (vectorized in practice, e.g. via Opacus)
    per_sample_grads = [torch.autograd.grad(loss_fn(p, x), p, retain_graph=True)
                        for p in params for x in batch]
    clipped = []
    for g in per_sample_grads:
        norm = g.norm(2)
        clip_coef = min(1.0, C / (norm + 1e-12))
        clipped.append(g * clip_coef)
    summed = torch.stack(clipped).sum(dim=0)
    noise = torch.randn_like(summed) * (sigma * C)   # Gaussian mechanism
    noisy_avg = (summed + noise) / len(batch)
    with torch.no_grad():
        for p, g in zip(params, noisy_avg):
            p -= lr * g
    return params
```

Production libraries (Opacus for PyTorch, TensorFlow Privacy) implement per-sample gradients efficiently and attach an RDP-based accountant that accumulates the privacy cost after every step [4][6].

---

## 4 Deep Dive

### 4.1 The Gaussian mechanism and sensitivity calibration

The Gaussian mechanism is the workhorse of DP-SGD because its *privacy loss random variable* has a tractable form. For adjacent datasets, define the privacy loss at outcome $o$ as

$$c(o; \mathcal{M}, d, d') \;=\; \log \frac{\Pr[\mathcal{M}(d) = o]}{\Pr[\mathcal{M}(d') = o]}.$$

For the Gaussian mechanism with sensitivity $\Delta$ and noise scale $\sigma\Delta$, the privacy loss is itself Gaussian: $c \sim \mathcal{N}\!\left(\frac{1}{2\sigma^2}, \frac{1}{\sigma^2}\right)$ (in the worst case over adjacent inputs). Its moment-generating function is therefore available in closed form:

> **Theorem (Moments of Gaussian privacy loss):** For the Gaussian mechanism with noise multiplier $\sigma$, the log moment-generating function of the privacy loss satisfies $\log \mathbb{E}[e^{\lambda c}] = \frac{\lambda(\lambda+1)}{2\sigma^2}$ for all $\lambda > 0$.

This closed form is what makes the moments accountant exact and efficient for Gaussian noise — no numerical integration over loss distributions is required [1][5]. The standard $(\varepsilon, \delta)$ calibration $\sigma \ge \sqrt{2\ln(1.25/\delta)}/\varepsilon$ follows from bounding the Gaussian tail $\Pr[c > \varepsilon] \le \delta$ [2].

### 4.2 Per-sample gradient clipping: bounding influence

Clipping is the single design decision that makes DP-SGD applicable to nonconvex deep networks. Prior private optimization work relied on convexity or smoothness to bound sensitivity [1]; deep networks admit no such bound, so Abadi et al. *impose* one. Two consequences follow:

- **Sensitivity becomes data-independent.** The sum of clipped gradients has $\ell_2$ sensitivity exactly $C$, regardless of architecture, depth, or loss landscape. The noise $\mathcal{N}(0, \sigma^2 C^2 I)$ therefore provides a calibrated guarantee at every step [1].
- **A bias–variance tradeoff appears.** Clipping biases the expected update direction, but the noise standard deviation scales with $C$, so a smaller $C$ means *less* noise. In practice $C$ is tuned as a hyperparameter, and adaptive or per-layer clipping variants trade bias against variance more finely.

### 4.3 The moments accountant

Training runs for $T$ steps, each touching the data. Naively composing $T$ Gaussian mechanisms with basic composition gives $\varepsilon = O(T)$ — vacuous for $T \sim 10^4$. Strong (advanced) composition [8] improves this to $O(\sqrt{T})$ but ignores the specific noise distribution and the subsampling structure. The *moments accountant* [1] exploits both.

For a mechanism $\mathcal{M}$, auxiliary input $aux$, and adjacent $d, d'$, define the *log moment function*

$$\alpha_{\mathcal{M}}(\lambda; aux, d, d') \;=\; \log \mathbb{E}_{o \sim \mathcal{M}(aux, d)}\!\left[e^{\lambda\, c(o; \mathcal{M}, aux, d, d')}\right],$$

and $\alpha_{\mathcal{M}}(\lambda) = \max_{aux, d, d'} \alpha_{\mathcal{M}}(\lambda; aux, d, d')$. Two theorems do all the work [1]:

> **Theorem 1 (Composition of moments):** For a sequence of adaptive mechanisms $\mathcal{M}_1, \dots, \mathcal{M}_k$ where $\mathcal{M}_i$ may depend on previous outputs,
> $$\alpha_{\mathcal{M}_{1:k}}(\lambda) \;\le\; \sum_{i=1}^k \alpha_{\mathcal{M}_i}(\lambda).$$

> **Theorem 2 (Tail bound → DP):** For any $\varepsilon > 0$, the mechanism $\mathcal{M}$ is $(\varepsilon, \delta)$-DP for
> $$\delta \;=\; \min_{\lambda > 0} \exp\!\big(\alpha_{\mathcal{M}}(\lambda) - \lambda\varepsilon\big).$$

Theorem 2 is Markov's inequality applied to $e^{\lambda c}$: $\Pr[c > \varepsilon] = \Pr[e^{\lambda c} > e^{\lambda\varepsilon}] \le e^{\alpha(\lambda) - \lambda\varepsilon}$, and $(\varepsilon, \delta)$-DP follows from the standard conversion between tail bounds on privacy loss and approximate DP [2]. In practice one fixes $\delta$ (e.g., $10^{-5}$) and computes $\varepsilon = \min_\lambda (\alpha(\lambda) - \log\delta)/\lambda$ by scanning integer $\lambda$ (equivalently, Rényi orders $\alpha = \lambda + 1$) [1][4].

The key per-step bound for the *sampled* Gaussian mechanism (subsampling ratio $q$, noise multiplier $\sigma$) is [1]:

$$\alpha(\lambda) \;\le\; \frac{q^2\,\lambda(\lambda+1)}{(1-q)\,\sigma^2} \;+\; O\!\left(\frac{q^3 \lambda^3}{\sigma^3}\right),$$

valid for $q$ small and $\lambda \le \sigma^2 \ln(1/(q\sigma))$. Two features stand out: the bound scales with $q^2$ (privacy amplification, Section 4.5), and it composes *additively* over the $T$ steps by Theorem 1. Numerically, this yields *single-digit* $\varepsilon$ for realistic training runs — e.g., tens of thousands of steps — where strong composition would give $\varepsilon$ in the hundreds [1]. This is the result that made private deep learning practical.

### 4.4 Rényi differential privacy and composition

Mironov's Rényi differential privacy [4] reframes the moments accountant in the language of divergences, and is now the standard accounting formalism. The Rényi divergence of order $\alpha > 1$ between distributions $P$ and $Q$ is

$$D_\alpha(P \,\|\, Q) \;=\; \frac{1}{\alpha - 1}\log \mathbb{E}_{x \sim Q}\!\left[\left(\frac{P(x)}{Q(x)}\right)^{\!\alpha}\right].$$

> **Definition (RDP):** $\mathcal{M}$ satisfies $(\alpha, \varepsilon)$-RDP if $D_\alpha(\mathcal{M}(d) \,\|\, \mathcal{M}(d')) \le \varepsilon$ for all adjacent $d, d'$.

The connection to the moments accountant is direct: with $\lambda = \alpha - 1$, $\alpha_{\mathcal{M}}(\lambda) = (\alpha - 1)\,\varepsilon(\alpha)$ — the moments accountant *is* RDP accounting evaluated at integer orders [4][6]. RDP's appeal is its clean algebra:

The standard modern workflow is therefore: compute the per-step RDP curve $\varepsilon_0(\alpha)$ for the subsampled Gaussian mechanism, multiply by $T$ (composition), then convert with $\varepsilon = \min_\alpha \left[T\,\varepsilon_0(\alpha) + \tfrac{\log(1/\delta)}{\alpha-1}\right]$.

```python
import numpy as np

def rdp_to_dp(rdp_curve, delta):
    # rdp_curve: dict {alpha: total RDP epsilon}; returns optimal (eps, alpha)
    best = min((eps + np.log(1/delta)/(a-1), a)
               for a, eps in rdp_curve.items() if a > 1)
    return best

def sampled_gaussian_rdp(q, sigma, T, orders):
    # leading-order bound eps0(a) ~= q^2 * a / (2 sigma^2), composed over T steps
    return {a: T * (q**2 * a) / (2 * sigma**2) for a in orders}

orders = list(range(2, 65))
curve = sampled_gaussian_rdp(q=0.01, sigma=1.0, T=10_000, orders=orders)
eps, alpha_star = rdp_to_dp(curve, delta=1e-5)
print(f"epsilon = {eps:.2f} at alpha = {alpha_star}")
# epsilon = 5.30 at alpha = 6
```

With $q = 1\%$, $\sigma = 1.0$, $T = 10{,}000$ steps and $\delta = 10^{-5}$, this leading-order calculation gives $\varepsilon \approx 5.3$ at optimal order $\alpha^\star = 6$ — a single-digit budget for ten thousand composed training steps, where basic composition would report $\varepsilon$ in the thousands.

### 4.5 Privacy amplification by subsampling

Subsampling is the quiet engine of DP-SGD's practicality. The classical amplification lemma [9] states that applying an $(\varepsilon, \delta)$-DP mechanism to a random $\gamma$-fraction subsample yields $(\log(1 + \gamma(e^\varepsilon - 1)), \gamma\delta)$-DP — approximately $(O(\gamma\varepsilon), \gamma\delta)$ for $\varepsilon \le 1$. Intuitively, each individual's record participates only with probability $\gamma$, so most of the time the mechanism's output distribution does not depend on it at all.

For the *sampled Gaussian mechanism*, the amplification is even stronger than the generic lemma suggests: the RDP cost diminishes *quadratically* in the sampling rate $q$ [5], as visible in the $q^2$ factor of the moments bound in Section 4.3. Practical notes:

- **Poisson vs. shuffling.** The tight analysis assumes Poisson subsampling (each example included independently with probability $q$) [1][5]. Implementations often shuffle and partition into fixed-size batches instead; the Poisson analysis is the standard conservative proxy, and recent work quantifies the gap.
- **Amplification needs secrecy.** The subsample must be hidden from the adversary; in DP-SGD this holds because only the noisy aggregate is released.
- **Heterogeneous composition.** RDP's additive composition handles varying $q_t, \sigma_t$ across steps by summing per-step curves before optimizing $\alpha$ [4][6] — essential for learning-rate schedules and adaptive clipping.

---

## 5 Empirical Evaluation and Proofs

### 5.1 How much tighter is the accounting?

The table below compares what each composition method reports for $T$ steps of the sampled Gaussian mechanism (noise multiplier $\sigma$, sampling ratio $q$), in the regime $q \ll 1$, $\sigma = \Theta(1)$:

| Method | Total $\varepsilon$ scaling (fixed $\delta$) | $T = 10^4$ indicative $\varepsilon$ |
|--------|----------------------------------------------|--------------------------------------|
| Basic composition | $O(T \cdot q/\sigma)$ | $\sim 10^3$ (vacuous) |
| Strong composition [8] | $O(\sqrt{T \log(1/\delta)} \cdot q/\sigma)$ | $\sim 10^2$ |
| Moments accountant [1] | $O(q\sqrt{T \log(1/\delta)}/\sigma)$ | single digits |
| RDP accounting [4][5] | matches moments accountant, closed-form | single digits |

The moments accountant and RDP improve over strong composition by exploiting the *Gaussian* privacy-loss distribution and the *quadratic* subsampling amplification jointly — neither generic composition theorem can see both effects [1][5].

### 5.2 Proof sketch: from moments to $(\varepsilon, \delta)$-DP

We sketch Theorem 2 of Abadi et al. [1]. Let $c$ be the privacy loss random variable of the composed mechanism. For any $\lambda > 0$ and $\varepsilon > 0$:

$$\Pr[c > \varepsilon] \;=\; \Pr\!\left[e^{\lambda c} > e^{\lambda\varepsilon}\right] \;\le\; \frac{\mathbb{E}[e^{\lambda c}]}{e^{\lambda\varepsilon}} \;=\; e^{\alpha(\lambda) - \lambda\varepsilon},$$

by Markov's inequality. A standard lemma [2] converts a tail bound $\Pr[c > \varepsilon] \le \delta$ into $(\varepsilon, \delta)$-DP, and minimizing the right-hand side over $\lambda$ gives the tightest bound. The RDP conversion $(\alpha, \varepsilon)$-RDP $\Rightarrow$ $(\varepsilon + \log(1/\delta)/(\alpha-1), \delta)$-DP is the same argument with $\lambda = \alpha - 1$ [4].

### 5.3 Empirical results

Abadi et al. evaluated DP-SGD on MNIST and CIFAR-10 [1]. With $\delta = 10^{-5}$, the moments accountant reported **single-digit** $\varepsilon$ while reaching approximately **97% test accuracy on MNIST** and **73% on CIFAR-10** — versus non-private baselines only a few points higher. The sampled Gaussian mechanism analysis of Mironov, Talwar, and Zhang [5] further tightened reported budgets by replacing the $O(q^3)$ upper bound with numerically exact RDP computation.

---

## 6 Limitations

DP-SGD's guarantees are rigorous but narrow, and honest deployment requires understanding their boundaries:

---

## 7 Conclusion

Differentially private machine learning rests on three pillars. **DP-SGD** makes gradient-based training compatible with differential privacy by clipping per-sample gradients — bounding sensitivity by construction rather than by assumption — and perturbing updates with the Gaussian mechanism [1]. The **moments accountant** makes the resulting training runs *accountable*, tracking the log moment-generating function of the privacy loss across thousands of adaptive steps to obtain bounds that are asymptotically and empirically far tighter than generic composition [1]. **Rényi differential privacy** distills the accountant into clean algebra — additive composition, a closed-form Gaussian curve $\varepsilon(\alpha) = \alpha/(2\sigma^2)$, and a one-line conversion to $(\varepsilon, \delta)$-DP — and has become the lingua franca of private ML engineering [4][5][6]. Underpinning all of it, **privacy amplification by subsampling** converts the stochasticity already present in minibatch training into a quadratic reduction of privacy cost [5][9].

The trajectory since 2016 — from the first single-digit-$\varepsilon$ neural networks [1] to production RDP accountants in Opacus and TensorFlow Privacy — demonstrates that the framework scales. Open frontiers remain: tighter accounting for shuffled sampling, private hyperparameter tuning, user-level guarantees for language models, and closing the residual utility gap for small-data regimes.

---

## References

[1] Martín Abadi, Andy Chu, Ian Goodfellow, H. Brendan McMahan, Ilya Mironov, Kunal Talwar, and Li Zhang. *Deep Learning with Differential Privacy.* In Proceedings of the 23rd ACM Conference on Computer and Communications Security (CCS 2016). arXiv:1607.00133. https://arxiv.org/abs/1607.00133 (DOI: 10.1145/2976749.2978318)

[2] Cynthia Dwork and Aaron Roth. *The Algorithmic Foundations of Differential Privacy.* Foundations and Trends in Theoretical Computer Science, 9(3–4):211–407, 2014. https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf

[3] Cynthia Dwork, Frank McSherry, Kobbi Nissim, and Adam Smith. *Calibrating Noise to Sensitivity in Private Data Analysis.* In Theory of Cryptography Conference (TCC 2006). https://link.springer.com/chapter/10.1007/11681878_14 (DOI: 10.1007/11681878_14)

[4] Ilya Mironov. *Rényi Differential Privacy.* In IEEE 30th Computer Security Foundations Symposium (CSF 2017). arXiv:1702.07476. https://arxiv.org/abs/1702.07476

[5] Ilya Mironov, Kunal Talwar, and Li Zhang. *Rényi Differential Privacy of the Sampled Gaussian Mechanism.* arXiv:1908.10530, 2019. https://arxiv.org/abs/1908.10530

[6] Yu-Xiang Wang, Borja Balle, and Shiva Prasad Kasiviswanathan. *Subsampled Rényi Differential Privacy and Analytical Moments Accountant.* In Proceedings of the 22nd International Conference on Artificial Intelligence and Statistics (AISTATS 2019). arXiv:1808.00087. https://arxiv.org/abs/1808.00087

[7] Mark Bun and Thomas Steinke. *Concentrated Differential Privacy: Simplifications, Extensions, and Lower Bounds.* In Theory of Cryptography Conference (TCC 2016). arXiv:1603.01887. https://arxiv.org/abs/1603.01887

[8] Cynthia Dwork, Guy N. Rothblum, and Salil Vadhan. *Boosting and Differential Privacy.* In IEEE 51st Annual Symposium on Foundations of Computer Science (FOCS 2010). https://doi.org/10.1109/FOCS.2010.12

[9] Shiva Prasad Kasiviswanathan, Homin K. Lee, Kobbi Nissim, Sofya Raskhodnikova, and Adam Smith. *What Can We Learn Privately?* In IEEE 49th Annual Symposium on Foundations of Computer Science (FOCS 2008). https://doi.org/10.1109/FOCS.2008.27

[10] Matt Fredrikson, Somesh Jha, and Thomas Ristenpart. *Model Inversion Attacks that Exploit Confidence Information and Basic Countermeasures.* In Proceedings of the 22nd ACM Conference on Computer and Communications Security (CCS 2015). https://doi.org/10.1145/2810103.2813677

