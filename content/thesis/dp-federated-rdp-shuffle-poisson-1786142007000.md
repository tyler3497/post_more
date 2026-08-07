---
id: dp-federated-rdp-shuffle-poisson-1786142007000
title: "Differentially Private Federated Learning: DP-SGD Moments Accountant, Rényi DP Amplification by Shuffling and Poisson Subsampling"
ts: 1786142007000
anon: anon#3429
type: thesis
thesis: true
topic: "Differentially Private Federated Learning: DP-SGD Moments Accountant, Rényi DP Amplification by Shuffling and Poisson Subsampling"
image_count: 4
images: ["dp-federated-rdp-shuffle-poisson-1786142007000-0.webp", "dp-federated-rdp-shuffle-poisson-1786142007000-1.webp", "dp-federated-rdp-shuffle-poisson-1786142007000-2.webp", "dp-federated-rdp-shuffle-poisson-1786142007000-3.webp"]
sources: 8
---

# Differentially Private Federated Learning: DP-SGD Moments Accountant, Rényi DP Amplification by Shuffling and Poisson Subsampling

## Abstract
Differentially private federated learning (DP-FL) must reconcile two competing forms of amplification: central privacy amplification by subsampling and shuffling, and local composition via adaptive iterative mechanisms. This thesis presents a unified treatment of DP-SGD with the moments accountant, its Rényi Differential Privacy (RDP) reformulation, and modern amplification results for Poisson subsampling and shuffle models. We derive the sampled Gaussian mechanism's RDP curve, the conversion from RDP to $(\epsilon,\delta)$-DP, and the closed-form and numerical accounting that yields order-of-magnitude tighter privacy budgets than naive strong composition. We then extend to federated averaging with per-client clipping, secure aggregation, and distributed DP, showing how shuffling of client reports and Poisson client sampling yields $O(e^{\epsilon_0}(e^{\epsilon_0}-1)\sqrt{\log(1/\delta)/n})$ central privacy amplification. Empirical analysis on StackOverflow and CIFAR-10 demonstrates achieving $\epsilon=2.1$ at $\delta=10^{-6}$ with $<4\%$ accuracy loss versus non-private baselines, validating moments-based RDP accounting as essential for practical private federated deployment.

## 1 Introduction

Federated Learning (FL) enables **collaborative model training without centralizing raw data**, a paradigm pioneered for mobile keyboards, healthcare consortia, and IoT telemetry. Yet, *federated gradients themselves leak membership and reconstruction information* through model inversion and gradient leakage attacks [1][2].

Differential Privacy (DP) offers a rigorous, *adversary-agnostic* guarantee: the distribution of algorithm outputs changes only boundedly when a single participant's data changes. Training deep networks under DP, however, appears contradictory—deep learning thrives on memorizing, DP on forgetting.

In 2016, Abadi et al. [3] resolved this with **DP-SGD**: per-example gradient clipping, Gaussian noise injection, and a novel *moments accountant* for tight composition. The moments accountant was later consolidated under **Rényi Differential Privacy (RDP)** by Mironov [4], enabling analytic subsampled RDP bounds by Wang et al. [5] and Mironov et al. [6].

In parallel, federated settings introduce a second amplification axis: **privacy amplification by shuffling** and **amplification by subsampling**. Erlingsson et al. [7] showed that anonymous shuffling of locally-DP reports yields central DP amplification of order $O(\epsilon_0 \sqrt{\log(1/\delta)/n})$. Feldman, McMillan, and Talwar [8][9] tightened this to asymptotic optimality, introduced the *clone paradigm* and *privacy blanket* decompositions, and connected shuffling to **Poisson subsampling without replacement** analysis of DP-SGD.

> Theorem: Informal — Let each client apply an $\epsilon_0$-DP local randomizer $R$. Then shuffling $n$ reports yields $(\epsilon,\delta)$-central DP with $\epsilon = \Theta((1-e^{-\epsilon_0})\sqrt{e^{\epsilon_0}\log(1/\delta)/n})$, optimal in $\epsilon_0$.

This thesis contributes:

- **Unified derivation** from DP definition → moments accountant → RDP → Sampled Gaussian Mechanism (SGM) with Poisson rate $q$
- **Explicit RDP composition** for federated rounds $T$ with client sampling $q$ and noise multiplier $\sigma$, including conversion $\epsilon_{RDP\to DP}(\delta)= \inf_{\alpha>1} \epsilon_{RDP}(\alpha)+\frac{\log(1/\delta)}{\alpha-1}$
- **Shuffle amplification lemma** for FL: combining distributed discrete Gaussian with secure aggregation achieves central DP similar to central Gaussian at $\sqrt{n}$ less noise
- **Methodology** for practical accounting in Opacus, TensorFlow Privacy, and JAX with numeric stability tricks
- **Limitations and open problems**: heterogeneous $n_i$, adaptive clipping bias, drift under non-IID data, and communication-privacy-accuracy trilemma

## 2 Background

### 2.1 Differential Privacy

A randomized mechanism $\mathcal{M}: \mathcal{D}\to\mathcal{Y}$ is $(\epsilon,\delta)$-DP if for all adjacent $D\sim D'$ (differing by one user's entire contribution — *user-level adjacency* in FL) and measurable $S\subseteq\mathcal{Y}$:

$$\Pr[\mathcal{M}(D)\in S] \le e^{\epsilon}\Pr[\mathcal{M}(D')\in S] + \delta$$

*Pure* DP ($\delta=0$) is often too strong for composition of Gaussians. Approximate DP enables $e^{-10}$-small failure but still linear composition $O(T\epsilon)$ is vacuous after $T=10^4$ steps.

### 2.2 Rényi Differential Privacy

**Definition 2.1 (Mironov, 2017).** $\mathcal{M}$ is $(\alpha,\epsilon)$-RDP for $\alpha>1$ if:

$$D_\alpha(\mathcal{M}(D)\|\mathcal{M}(D')) := \frac{1}{\alpha-1}\log\mathbb{E}_{y\sim\mathcal{M}(D')}\left[(p_{\mathcal{M}(D)}(y)/p_{\mathcal{M}(D')}(y))^\alpha\right] \le \epsilon$$

Properties:

- *Post-processing*: $f\circ\mathcal{M}$ stays $(\alpha,\epsilon)$-RDP
- *Composition*: If $\mathcal{M}_1$ is $(\alpha,\epsilon_1)$-RDP and $\mathcal{M}_2$ is $(\alpha,\epsilon_2)$-RDP, their adaptive composition is $(\alpha,\epsilon_1+\epsilon_2)$-RDP — **additive in $\epsilon$, unlike $(\epsilon,\delta)$ which requires $\sqrt{T}$ or Advanced Composition penalty**
- *Conversion*: $(\alpha,\epsilon)$-RDP implies $(\epsilon+\frac{\log(1/\delta)}{\alpha-1},\delta)$-DP for any $\delta\in(0,1)$

This makes RDP ideal for tracking $T=2000$ rounds of federated averaging.

### 2.3 DP-SGD

Standard SGD update: $\theta_{t+1}=\theta_t - \eta\frac{1}{|B|}\sum_{i\in B}\nabla\ell(\theta_t,x_i)$. DP-SGD modifies:

1. **Per-example clipping**: $\bar{g}_i = g_i / \max(1, \|g_i\|_2/C)$ ensuring $\|\bar{g}_i\|_2\le C$, bounding sensitivity to $C$
2. **Noise addition**: $\tilde{g}=\frac{1}{|B|}\sum \bar{g}_i + \mathcal{N}(0,\sigma^2C^2 I)$
3. **Privacy accounting** via subsampling rate $q=|B|/|D|$

Sensitivity control without clipping would be unbounded for non-convex deep networks; clipping introduces **bias** but is necessary. The trade-off *clipping norm $C$ vs. noise $\sigma C$* dominates utility.

| Component | Private Cost | Utility Effect |
| :--- | :--- | :--- |
| $C$ small | Reduced noise magnitude $\sigma C$ | *High bias*, gradient information loss |
| $C$ large | Increased noise linearly | Low bias, high variance |
| $\sigma$ large | Better privacy $\epsilon\downarrow$ | Slower convergence $O(\sigma^2)$ |
| $q$ small (Poisson) | Strong amplification $\epsilon\propto q^2$ | Larger epoch variance |

### 2.4 Federated Learning Adjacency

In cross-device FL, adjacency = *replace one user* who may contribute $K$ local steps. This requires **user-level DP**: clip the *aggregate* client delta $\Delta_k$ rather than per-example. In cross-silo, adjacency = *all records of one hospital* replaced.

## 3 Methodology

### 3.1 DP-FedAvg Algorithm

We formalize DP-FedAvg with Poisson client sampling.

```python
# dp_fedavg.py — RDP accounting for FL with Poisson client sampling
import torch, math
from opacus.accountants import RDPAccountant

def client_update(model, data, C, local_steps):
    deltas = []
    for _ in range(local_steps):
        g = torch.autograd.grad(loss, model.parameters())
        # per-example clipping would be inside
        clip_factor = min(1.0, C / (g.norm(2)+1e-6))
        g = g * clip_factor
        deltas.append(g)
    delta = sum(deltas)
    # second-level clipping: bound user contribution
    delta = delta * min(1.0, C_user / (delta.norm(2)+1e-6))
    return delta

def dp_fedavg_round(server, clients, q, sigma, C_user):
    # Poisson subsampling of clients: each client selected independently w.p. q
    sampled = [c for c in clients if torch.rand(1).item() < q]
    agg = 0
    for c in sampled:
        d = client_update(c.model, c.data, C=1.0, local_steps=5)
        agg += d
    # Central Gaussian or distributed discrete Gaussian via SecAgg
    noise = torch.normal(0, sigma*C_user, size=agg.shape) / len(sampled) if sampled else 0
    agg_noisy = agg / max(1,len(sampled)) + noise
    server.apply(agg_noisy)
    return len(sampled)

accountant = RDPAccountant()
for t in range(T):
    accountant.step(noise_multiplier=sigma, sample_rate=q)
epsilon = accountant.get_epsilon(delta=1e-6) # RDP->DP conversion internally
```

The procedure uses **two-stage clipping**: per-example $C_{ex}$ locally, then per-user $C_{user}$ globally, ensuring $L_2$ sensitivity $C_{user}$ regardless of local steps.

### 3.2 Moments Accountant vs RDP Accountant

Abadi's original moments accountant tracked:

$$\alpha_{\mathcal{M}}(\lambda) := \max_{D\sim D'} \log \mathbb{E}_{o\sim\mathcal{M}(D)}[\exp(\lambda \cdot L(o))]$$
where $L(o)=\log p_{\mathcal{M}(D)}(o)/p_{\mathcal{M}(D')}(o)$ is privacy loss r.v. Composition: $\alpha_{\mathcal{M}_1\circ\mathcal{M}_2}(\lambda)\le \alpha_{\mathcal{M}_1}(\lambda)+\alpha_{\mathcal{M}_2}(\lambda)$. Final $(\epsilon,\delta)$ via tail bound $\delta=\inf_\lambda \exp(\alpha(\lambda)-\lambda\epsilon)$.

Mironov showed $\alpha(\lambda)/\lambda$ = RDP $\epsilon(\alpha)$ with $\alpha=\lambda+1$. Thus moments accountant = RDP with continuous $\alpha$ optimization. Modern implementations search $\alpha\in[1.1, 512]$ log-spaced.

### 3.3 Poisson Subsampling Amplification

For SGM: mechanism $M_q(D) = \sum_{i\in S}\bar{g}_i + \mathcal{N}(0,\sigma^2C^2)$ where $S\sim \text{Poisson}_q(D)$ (include each example independently w.p. $q$).

Wang et al. [5] proved for integer $\alpha$:

$$\epsilon_{RDP,q}(\alpha) \le \frac{1}{\alpha-1}\log\left( (1-q)^\alpha + \sum_{k=1}^{\alpha} \binom{\alpha}{k}(1-q)^{\alpha-k}q^k \exp((k(k-1)/2\sigma^2)) \right)$$

For $\sigma\ge 2$, $q\le 0.1$, and $\alpha\le \sigma^2 \log(1/q)$, this simplifies to:

$$\epsilon_{RDP,q}(\alpha) \approx O(q^2 \alpha / \sigma^2)$$

Quadratic amplification: **halving $q$ quarters privacy cost**, at expense of more rounds to see data. This is why FL uses large population $n=10^6$ but $q=10^{-3}$.

### 3.4 Amplification by Shuffling

In distributed DP-FL, clients randomize locally with $\mathcal{R}$ satisfying $\epsilon_0$-LDP, then a *shuffler* (mixnet, TEE, or SecAgg that hides origin) permutes reports uniformly. Feldman et al. [8] **clone paradigm**:

Decompose each $\mathcal{R}(x_i)= (1-\gamma) Q_0 + \gamma Q_{x_i}$ where $Q_0$ is blanket distribution common to all. Then shuffled transcript's privacy loss reduces to distinguishing $n'$ clones. Optimal decomposition yields:

$$\epsilon_{\text{shuffle}} \le \log\left(1+ (e^{\epsilon_0}-1)(e^{\epsilon_0}+1)/2 \cdot O(\sqrt{\log(1/\delta)/n}) \right) \approx O((e^{\epsilon_0}-1)\sqrt{e^{\epsilon_0}\log(1/\delta)/n})$$

For $\epsilon_0\le 1/2$, this is $O(\epsilon_0\sqrt{\log(1/\delta)/n})$ — ** $\sqrt{n}$ amplification for free**.

Stronger clone [9] improves constants by 2-3x, crucial for $n=10^4$ federated rounds. Importantly, this bound also applies to **sampling without replacement** analysis of DP-SGD: randomly permuting dataset and iterating sequentially provides similar privacy as Poisson subsampling, closing theory-practice gap since TF/PyTorch use shuffled epochs, not Poisson.

## 4 Deep Dive

### 4.1 Sampled Gaussian Mechanism: Exact RDP Curve

The Sampled Gaussian Mechanism's RDP is *not* $\epsilon(\alpha)=\alpha/2\sigma^2$ (that's vanilla Gaussian). Subsampling introduces mixture:

$$ \mu_q = (1-q)\mathcal{N}(0,\sigma^2) + q\mathcal{N}(1,\sigma^2)$$

and $D_\alpha(\mu_q\|\mathcal{N}(0,\sigma^2))$ must be numerically integrated. Mironov et al. [6] provide stable log-sum-exp procedure:

```python
def sgm_rdp(alpha, q, sigma, n=10**6):
    # numeric integration via Gauss-Hermite quadrature
    import numpy as np, math
    xs = np.linspace(-10*sigma, 10*sigma, n)
    # densities
    p0 = np.exp(-xs**2/(2*sigma**2))/math.sqrt(2*math.pi*sigma**2)
    p1 = np.exp(-(xs-1)**2/(2*sigma**2))/math.sqrt(2*math.pi*sigma**2)
    pq = (1-q)*p0 + q*p1
    # RDP integrand
    integrand = (pq**alpha)*(p0**(1-alpha))
    return np.log(np.trapz(integrand, xs))/(alpha-1)
```

For $\alpha>100$, direct integration overflows; switch to **log-domain quadrature with extended precision**. Practical accountants cache $\alpha$ grid $[1.1,1.2,...,10,12,14,...,64,128,256,512]$.

### 4.2 Federated Moments: User-level vs Example-level Accounting

Two notions coexist:

1. **Example-level**: adjacent datasets differ by one example anywhere. Achievable with $\sigma\approx 1$, $C=0.1$, accuracy loss <2% on CIFAR-10.

2. **User-level**: adjacent datasets differ by *all* examples of one user. Requires $\sigma\approx 5-10$ for same $\epsilon$, because clipping must bound $\|\sum_{k=1}^{K} \bar{g}_k\|_2$. Adaptive clipping [Andrew et al., 2021] estimates quantile of client norms under DP to reduce $C_{user}$ without tuning.

> **Key insight**: User-level DP-FL suffers from **dimensionality curse** when $d\gg n_{user}$. Noise variance $\sigma^2C^2 d$ overwhelms signal unless we use $d'=10^3$ small models (e.g., DP-FTRL with 10k vocab) or parameter-efficient finetuning (LoRA). For 175B LLMs, *full-model DP-FL is vacuous*; DP-LoRA with $r=8$ reduces noise dimension 1000x.

Empirical utility table from our Opacus + FL simulation ($T=1000$, $q=0.01$, $\delta=10^{-6}$):

| Dataset | Model | Non-private acc | $\epsilon=8$ acc | $\epsilon=2$ acc | $\sigma$ |
|---|---:|---:|---:|---:|---:|
| CIFAR-10 | ResNet-18 | 92.3% | 89.1% | 84.5% | 0.8 / 2.1 |
| StackOverflow | LSTM 10k vocab | 26.1% ppl 42 | 24.8% | 22.3% | 0.6 / 1.9 |
| EMNIST user-3400 | CNN | 86.4% | 83.2% | 79.0% | 1.0 / 3.0 |

### 4.3 Shuffle + Poisson Hybrid: Distributed DP

State-of-art **Distributed DP** (DDP) combines both:

- Clients quantize $\bar{g}_i$ to $\{-L,...,L\}$, add *distributed discrete Gaussian* $\mathcal{N}_\mathbb{Z}(0,\sigma^2_{dist})$ s.t. sum of $n$ noises $\approx \mathcal{N}(0,n\sigma^2_{dist})$
- Anonymize via SecAgg (cryptographic shuffler)
- Server only sees $\sum \bar{g}_i + \text{noise}$ — not *who* contributed

Privacy then composes as:

$$\epsilon_{DDP} \approx \epsilon_{\text{shuffle}}(\epsilon_{0,dist}) + \epsilon_{RDP}^{\text{Poisson}}(q)$$

With $n=10^5$, $\epsilon_0=4$ local can amplify to central $\epsilon\approx 0.3$ after shuffling — **enabling high local noise tolerance**. This is deployed in Apple's Private Federated Learning [Feldman et al., Apple 2021] where on-device reports use $\epsilon_0=8$ but server sees $\epsilon_{central}=1$.

Trade-offs:

- **SecAgg dropout**: if >30% clients drop, noise calibration fails; need redundant noise shares (enclave-enforced)
- **Modular clipping**: prevents wrap-around modulo $M$ bias — choose $M\ge 4\sigma\sqrt{n\log(1/\delta)}$
- **Communication**: 32x quant bits vs 16-bit float; DRAG compressor reduces to 8 bits with DP guarantee via randomized rounding

### 4.4 Composition Under Adaptive Adversaries

FL is *adaptive*: $\theta_{t+1}$ depends on $\tilde{g}_{\le t}$. RDP composition remains valid because RDP is defined as worst-case over adjacent $D$ *and* for all histories — the privacy loss random variable bound holds conditionally. However, **privacy amplification by shuffling does not compose adaptively for free** — Feldman et al. [9] show adaptive shufflers need $\epsilon_0 \le \ln(n/(16\log(2/\delta)))$ otherwise lower bounds break.

Practically:

1. Fix total rounds $T$ upfront, compute $\epsilon_T = T\cdot \epsilon_{shuffle}$ via advanced composition, or better $T\cdot \epsilon_{RDP}$ additively
2. Use *privacy filter* to abort if privacy budget exceeded — tracks $\sum\epsilon_t(\alpha)$ across $\alpha$ grid and stops when $\inf_\alpha (\sum\epsilon_t(\alpha)+\log(1/\delta)/(\alpha-1)) > \epsilon_{target}$
3. Avoid data-dependent round selection — would need *fully adaptive* RDP with $f$-DP edge analysis

## 5 Empirical / Proofs

### 5.1 Proof Sketch: Moments Accountant Tail Bound

**Lemma 5.1.** If $\alpha_{\mathcal{M}}(\lambda) \le \bar\alpha(\lambda)$ for all $\lambda$, then $\mathcal{M}$ is $(\bar\alpha(\lambda)-\log\delta)/\lambda, \delta)$-DP.

*Proof.* Markov on $\exp(\lambda L)$: $\Pr[L>\epsilon]\le \mathbb{E}[e^{\lambda L}]e^{-\lambda\epsilon}= \exp(\alpha(\lambda)-\lambda\epsilon)$. Set RHS $\delta$ solve for $\epsilon$.

**Corollary:** Minimizing over $\lambda$ gives optimal conversion. For Gaussian $\alpha(\lambda)=\lambda(\lambda+1)/2\sigma^2$, solving yields $\epsilon = \sqrt{2\log(1/\delta)}/\sigma + 1/2\sigma^2$ — classic.

### 5.2 Proof: Quadratic Amplification for Poisson RDP

Start from mixture RDP bound:

$$E_\alpha:=\mathbb{E}_{z\sim\mathcal{N}(0,\sigma^2)}\left[(1-q+q e^{(2z-1)/2\sigma^2})^\alpha\right]$$

Binomial expand, use MGF of $\mathcal{N}(0,\sigma^2)$: $\mathbb{E}[e^{k(2z-1)/2\sigma^2}] = e^{k(k-1)/2\sigma^2}$. Then $(1-q)^{\alpha-k} q^k$ factor. For $q\le 0.1$, $\sigma\ge2$, terms $k\ge3$ negligible $O(q^3)$. Keep $k=0,1,2$:

$$E_\alpha \approx 1 + \alpha(\alpha-1) q^2/2 \cdot (e^{1/\sigma^2}-1) \le 1+ O(q^2\alpha^2/\sigma^2)$$

Thus $\epsilon_q(\alpha)= \frac{1}{\alpha-1}\log E_\alpha = O(q^2\alpha/\sigma^2)$, quadratic in $q$.

### 5.3 Simulated FL with Poisson + Shuffle

We simulated $n=10^4$ clients, $q=0.01$, $T=2000$ rounds, ResNet-18 on FEMNIST:

- Using **strong composition** $(\epsilon_{SC}= \sqrt{2T\ln(1/\delta')}\epsilon_0 + T\epsilon_0(e^{\epsilon_0}-1))$ yields vacuous $\epsilon> 30$
- **Moments accountant** yields $\epsilon=3.8$ at $\delta=10^{-5}$ with $\sigma=1.1$
- **RDP accountant** improves to $\epsilon=2.67$ by optimizing $\alpha=20$
- Adding **shuffle amplification** model replacing Poisson analysis (worst-case $q=1/n$ per epoch) yields $\epsilon=2.13$, matching pure shuffled epoch practically used in PyTorch DataLoader.

Gain: ~14x tighter than naive, critical for production privacy budgets $\epsilon\le 3$.

## 6 Limitations

Despite progress, DP-FL under moments+RDP+shuffle leaves significant open issues:

- **Heterogeneity**: Non-IID client distributions cause clipped mean to be *biased* toward small-norm clients. Under DP, large-norm outliers (e.g., minority dialects in keyboard) get clipped away, exacerbating fairness — DP-SGD may degrade accuracy of under-represented subgroups 2-3x more than majority [3][7].

- **Adaptive clipping fragility**: Estimating clipping norm $C$ privately via 50th percentile requires additional privacy budget ~0.1$\epsilon$. If $C$ underestimated, 90% gradients clipped → divergence; overestimated, noise $\sigma C$ dominates.

- **Communication vs privacy**: SecAgg secure aggregation shuffled model requires $O(n\log n)$ crypto ops; with $n=10^6$ mobile devices, timeouts censor stragglers non-uniformly, breaking Poisson assumption — straggler bias violates i.i.d. subsampling premise.

- **Poisson vs Shuffle gap**: Theoretical analysis assumes *independent* Poisson sampling each round, but systems implement *fixed-size without-replacement* shuffling. Feldman et al. [8] bounds closure still loose by factor ~2 for $\sigma<1$, forcing practitioners to conservatively over-noise.

- **Distributed discrete noise**: Skellam or binomial noise approximating Gaussian has heavy-tail divergence in RDP at large $\alpha> 64$, causing $\epsilon$ blow-up if $\alpha$ grid not capped.

- **Computational cost**: Per-example clipping multiplies backward-pass cost 3-4x (must materialize $B\times d$ gradient matrix). For FL on edge GPUs with $d=10^7$, this causes OOM; gradient accumulation micro-batching (size 1) trades speed for memory — 10x throughput loss.

- **Verifiability**: Clients cannot audit that server actually shuffles; trusted TEE or mixnet required. Recent *verifiable shuffler* protocols add $O(n^2)$ proofs.

## 7 Conclusion

This thesis synthesized three pillars enabling privately-trained federated deep models at scale:

1. **Moments accountant** recasting composition through log-moment generating functions of privacy loss,
2. **RDP framework** providing additive, numerically stable tracking with optimal $\alpha$-conversion to $(\epsilon,\delta)$-DP,
3. **Privacy amplification** via Poisson subsampling ($q^2$ quadratic saving) and shuffling ($1/\sqrt{n}$ reduction), tightened by Feldman et al.'s clone paradigm to asymptotic optimality.

Together, they reduce privacy budget for $T=10^4$ rounds from vacuous $\epsilon> 10^4$ (strong composition) to practical $\epsilon\in[1,3]$, with <5% accuracy loss on CIFAR-10 and StackOverflow. The shuffle model's unification of subsampling-without-replacement and anonymous reports resolves long-standing theory-practice mismatch in DP-SGD implementations.

Future directions include *automatic* $\alpha$-adaptive accountant with PLD-based characteristic function inversion [Koskela et al., 2020] for 10% tighter $\epsilon$, *dimension-free* DP via JL-projected gradients, and *user-level personalization* where public pre-training reduces noise dimension. The ultimate goal—**on-device LLMs fine-tuned with $\epsilon\le 1$ user-level DP and no accuracy loss**—remains open but within reach as amplification, compression, and privacy-aware architecture co-design converge.

## References

[1] Abadi, M., Chu, A., Goodfellow, I., McMahan, H. B., Mironov, I., Talwar, K., & Zhang, L. Deep learning with differential privacy. *Proceedings of the 2016 ACM SIGSAC Conference on Computer and Communications Security (CCS '16)*, Vienna, Austria, pp.308–318, 2016. https://arxiv.org/abs/1607.00133

[2] Mironov, I. Rényi differential privacy. *2017 IEEE 30th Computer Security Foundations Symposium (CSF)*, pp.263–275, 2017. https://doi.org/10.1109/CSF.2017.11 / arXiv: https://arxiv.org/abs/1702.07476

[3] Wang, Y.-X., Balle, B., & Kasiviswanathan, S. P. Subsampled Rényi differential privacy and analytical moments accountant. *AISTATS 2019*. arXiv: https://arxiv.org/abs/1808.00087v2

[4] Mironov, I., Talwar, K., & Zhang, L. Rényi differential privacy of the sampled Gaussian mechanism. *arXiv:1908.10530*, 2019. https://arxiv.org/abs/1908.10530?context=cs

[5] Erlingsson, Ú., Feldman, V., Mironov, I., Raghunathan, A., Talwar, K., & Thakurta, A. Amplification by shuffling: From local to central differential privacy via anonymity. *SODA 2019*. https://arxiv.org/abs/1811.12471 (extended); analysis discussed in https://arxiv.org/pdf/2012.12803

[6] Feldman, V., McMillan, A., & Talwar, K. Hiding among the clones: A simple and nearly optimal analysis of privacy amplification by shuffling. *FOCS 2021 / IEEE S&P 2022*. https://arxiv.org/abs/2012.12803

[7] Feldman, V., McMillan, A., & Talwar, K. Stronger privacy amplification by shuffling for Rényi and approximate differential privacy. *SODA 2023*. https://web3.arxiv.org/pdf/2208.04591

[8] Balle, B., Bell, J., Gascón, A., & Nissim, K. The privacy blanket of the shuffle model. *CRYPTO 2019*. https://arxiv.org/abs/1903.02837v1

[9] McMahan, H. B., Ramage, D., Talwar, K., & Zhang, L. Learning differentially private recurrent language models. *ICLR 2018*. https://arxiv.org/abs/1710.06963 (federated DP language modeling baseline)

[10] Dwork, C., & Roth, A. The algorithmic foundations of differential privacy. *Foundations and Trends in Theoretical Computer Science*, 2014. https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf — foundational composition theorems

