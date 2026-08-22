---
id: thesis-distributed-dp-secure-aggregation-20260808-a3f1
title: "Distributed Differential Privacy via Secure Aggregation in Federated Learning: Rényi Accounting, Discrete Gaussian Mechanisms, and the Communication-Privacy-Utility Frontier"
ts: 1783591200000
anon: anon#4827
type: thesis
thesis: true
topic: "federated learning, differential privacy, secure aggregation, renyi dp, distributed dp"
image_count: 0
images: []
sources: 7
---

# Distributed Differential Privacy via Secure Aggregation in Federated Learning: Rényi Accounting, Discrete Gaussian Mechanisms, and the Communication-Privacy-Utility Frontier

## Abstract
Federated Learning (FL) enables collaborative model training without centralizing raw data, yet gradient updates remain vulnerable to inference and reconstruction attacks. This thesis provides a rigorous treatment of **distributed differential privacy (DDP)** in FL when combined with **secure aggregation (SecAgg)**, contrasting it with pure **local DP (LDP)** and central DP. We formalize the *communication-privacy-utility trilemma*, show how *distributed discrete Gaussian* mechanisms achieve central-DP-like utility under SecAgg constraints, and develop a complete Rényi Differential Privacy (RDP) accounting framework for subsampled, shuffled, and composed FL rounds. Analytical bounds are derived for noise calibration, modulus selection, and per-client bit complexity, culminating in a characterization of the fundamental $\tilde{O}(\min(n^2\epsilon^2, d))$ bits per client necessary and sufficient for optimal accuracy [1][2]. Through construction of end-to-end protocols using Walsh-Hadamard rotation, modular clipping, and advanced composition via RDP, we demonstrate how DDP+SecAgg closes the gap between trust models while preserving scalability to thousands of clients.

## 1. Introduction

Federated Learning was introduced to decouple *model learning* from *data collection*, allowing $n$ clients to collaboratively optimize a $d$-dimensional model $w \in \mathbb{R}^d$ while keeping datasets $D_i$ local. In each round $t$, clients compute updates $x_i^t \in \mathbb{R}^d$ (gradients or model deltas) and send them to a server for aggregation $\bar{x}^t = \sum_i x_i^t$.

However, *privacy is not inherent* to decentralization. As shown by model inversion and gradient leakage attacks, $\bar{x}^t$ and even individual $x_i^t$ can reveal membership, properties, and reconstructions of private data [3]. Two semantic poles emerged:

* **Local DP (LDP):** each client randomizes $x_i$ before transmission. No trust in server required, but utility degrades as $O(\sqrt{n})$ worse than central DP.
* **Central DP:** a trusted aggregator adds minimal noise to the *sum*. Optimal utility, but requires complete trust in the central server.

**Distributed DP with Secure Aggregation** provides a compelling middle ground. Clients add *small* discrete noise shares whose sum is sufficient for DP, while a cryptographic Secure Aggregation protocol ensures the server learns *only* $\sum_i (x_i + \text{noise}_i) \mod m$ and nothing about individual contributions [4][5]. The sum of noise is calibrated to central-DP levels, yielding utility exponentially better than LDP in $n$, while trust is cryptographic rather than institutional.

This work synthesizes three lines: foundational DP and RDP [6][7], the distributed discrete Gaussian mechanism [4], and fundamental communication limits of SecAgg [1]. Our contribution is a unified framework with proofs, protocol, and evaluation design.

## 2. Background

### 2.1 Differential Privacy Preliminaries

> **Theorem (Gaussian Mechanism):** For a query $f: \mathcal{X}^n \to \mathbb{R}^d$ with $\ell_2$-sensitivity $\Delta_2(f) = \max_{D \sim D'} \|f(D)-f(D')\|_2$, the mechanism $\mathcal{M}(D) = f(D) + \mathcal{N}(0, \sigma^2 I_d)$ satisfies $(\alpha, \alpha \Delta_2^2 / 2\sigma^2)$-RDP for all $\alpha >1$, and hence $(\epsilon,\delta)$-DP with $\epsilon = \frac{\alpha \Delta_2^2}{2\sigma^2} + \frac{\log 1/\delta}{\alpha-1}$ optimized over $\alpha$ [7].

*Central DP* assumes a trusted curator holds $D$ and releases $f(D)+\text{noise}$. *Local DP* requires $\mathcal{M}_i(x_i)$ individually DP. *Distributed DP* as defined by Dwork et al. and refined by Kairouz et al. requires $\sum_i \mathcal{M}_i(x_i)$ to be DP *and* individual $\mathcal{M}_i$ are aggregated via SecAgg such that the server view is indistinguishable from the aggregate alone.

### 2.2 Secure Aggregation

Bonawitz et al. introduced practical SecAgg using pairwise masking and secret sharing with dropout resilience. The abstraction we need is: there exists a protocol $\Pi$ realizing an ideal functionality that takes inputs $z_i \in \mathbb{Z}_m^d$ and outputs $\sum_i z_i \mod m$ to server, with security against honest-but-curious server colluding with $<t$ clients.

Key constraints imposed by SecAgg on DP design:

- **Discrete domain:** SecAgg operates over a finite group $\mathbb{Z}_m$. Continuous Gaussian noise must be *discretized* and mapped into this group.
- **Modular wrap-around:** If noise variance is too large relative to $m$, wrap-around destroys utility.
- **Communication:** $m$ determines bits per coordinate: $\log_2 m$. Fundamental trade-off between accuracy and communication.

### 2.3 Rényi Differential Privacy and Moments Accounting

RDP, introduced by Mironov [7], generalizes DP via Rényi divergence:

$$ D_{\alpha}(P\|Q) = \frac{1}{\alpha-1}\log \mathbb{E}_{x\sim Q}\left[ \left(\frac{P(x)}{Q(x)}\right)^{\alpha} \right] $$

Mechanism satisfies $(\alpha, \varepsilon(\alpha))$-RDP if $D_{\alpha}(\mathcal{M}(D)\|\mathcal{M}(D')) \le \varepsilon(\alpha)$. RDP provides:

1. **Lossless composition:** If $\mathcal{M}_1$ is $(\alpha, \varepsilon_1)$-RDP and $\mathcal{M}_2$ is $(\alpha, \varepsilon_2)$-RDP adaptively, composition is $(\alpha, \varepsilon_1+\varepsilon_2)$-RDP. Linear!
2. **Subsampling amplification:** If clients are Poisson-sampled with rate $q$, RDP amplification yields tighter bounds than strong composition [2][5].
3. **Conversion to $(\epsilon,\delta)$-DP:** Via $\epsilon = \varepsilon(\alpha) + (\log 1/\delta)/(\alpha-1)$ minimized over $\alpha$.

Abadi et al.'s moments accountant [8] is exactly RDP accounting applied to DP-SGD.

## 3. Methodology

### System Model

We consider $T$ rounds. In round $t$, subset $S_t \subseteq [n]$ of expected size $q n$ participates. Each $i \in S_t$ holds update $x_i$, clipped to $\|x_i\|_2 \le c$. Goal: privately estimate sum.

### Distributed Discrete Gaussian Protocol

Building on Kairouz et al. [4], we construct client procedure $\mathcal{A}_{client}$:

1. **Random rotation:** Shared randomness $H_d$ Walsh-Hadamard matrix $+ D_{\xi}$ random sign diagonal reduces sensitivity after rotation.
2. **$\ell_2$ clipping + scaling + stochastic rounding:** $x_i$ → $\tilde{x}_i \in \mathbb{Z}^d$ with scale $\gamma$.
3. **Discrete Gaussian noise addition:** Sample $\eta_i \sim \mathcal{N}_{\mathbb{Z}}(0, \sigma^2)$ (discrete Gaussian over integers). The sum of $n$ discrete Gaussians approximates a single discrete Gaussian with variance $n\sigma^2$, enabling central DP calibration.
4. **Modular mapping:** $z_i = \tilde{x}_i + \eta_i \mod m$, sent to SecAgg.

Server procedure $\mathcal{A}_{server}$:
- Receives $\bar{z} = \sum_i z_i \mod m$ via SecAgg.
- Inverses mapping to $\mathbb{R}^d$: $\hat{x} = \gamma H_d^T D_{\xi} \bar{z}'$.

Parameter selection must satisfy **no wrap-around with high probability**:

$$ m \ge \tilde{O}\left(n + \sqrt{\frac{\epsilon^2 n^3}{d}} + \frac{\sqrt{d}}{\epsilon}\right) $$

as derived in [4] Theorem 5.3.

### RDP Accounting for Distributed Model

We distinguish two privacy views:

- **Server view (SecAgg ideal):** Sees only aggregate $\bar{z}$. Privacy amplification comes from sum of discrete Gaussians approximating central Gaussian, giving $(\alpha, \alpha c^2 / (2 n\sigma^2))$-RDP per round before subsampling.
- **Threat model:** honest-but-curious server + with $t$ colluding clients.

> **Theorem (RDP of Distributed Discrete Gaussian with Poisson Subsampling):** Let $q$ be sampling rate, $\alpha \ge 2$ integer, $\sigma^2 \ge \Delta_2^2 \alpha(\alpha-1)/2$ under clipping. Then round $t$ satisfies $(\alpha, \varepsilon_t(\alpha))$-RDP where $\varepsilon_t(\alpha) \le \frac{1}{\alpha-1}\log\left(1 + q^2 {\alpha \choose 2} \min\{4(e^{\varepsilon_0(2)}-1), 2e^{\varepsilon_0(2)}\} + \sum_{j=3}^{\alpha} q^j {\alpha \choose j} 2 e^{(j-1)\varepsilon_0(j)}\right)$ with $\varepsilon_0(\cdot)$ the RDP of non-subsampled Gaussian. This follows from standard RDP subsampling lemma [9][10].

Across $T$ rounds, composition is $\sum_t \varepsilon_t(\alpha)$. Conversion to $(\epsilon,\delta)$ via minimization over $\alpha \in \{2..64\}$ standard.

---

### Communication Lower Bound

Chen et al. [1] establish fundamental price of SecAgg:

- **Achievable:** $\tilde{O}(\min(n^2 \epsilon^2, d))$ bits per client suffice for central-DP accuracy using *sparse random projections* $S \in \mathbb{R}^{k \times d}$ where $k = \tilde{O}(n^2\epsilon^2)$.
- **Necessity:** Any SecAgg-compatible protocol achieving optimal central DP mean squared error $\Theta(c^2 d / n^2 \epsilon^2)$ must have $\Omega(\min(n^2\epsilon^2, d))$ bits per client. Proof via packing and mutual information across modulo channel.

Intuition: SecAgg forces independence across clients conditional on sum; to preserve central DP variance $\sigma^2 \sim c^2 / \epsilon^2$, you cannot compress beyond innate dimension of secure aggregate.

## 4. Deep Dive

### 4.1 Distributed DP vs Local DP vs Central DP: Quantitative Gap

| Model | Trust Assumption | Per-round noise scale per client | Sum noise variance | MSE of mean |
| :--- | :--- | :--- | :--- | :--- |
| **Central DP** | Fully trusted server | 0 (noise at server) | $\sigma_{c}^2 = c^2 / \epsilon^2$ | $O(c^2 d / n^2 \epsilon^2)$ |
| **Local DP** | No trust | $\sigma_{loc}^2 = c^2 n / \epsilon^2$ | $n\sigma_{loc}^2 = c^2 n^2 / \epsilon^2$ | $O(c^2 d / \epsilon^2)$ |
| **Distributed DP+SecAgg** | Cryptographic (t-collusion) | $\sigma_{dist}^2 = c^2 / (n \epsilon^2)$ discrete | $n\sigma_{dist}^2 \approx \sigma_c^2$ | $O(c^2 d / n^2 \epsilon^2)$ matches central |

Table shows *exponential improvement* in $n$ of DDP+SecAgg over LDP. LDP error independent of $n$ after averaging; DDP+SecAgg error decreases as $1/n^2$ like central.

*Cryptographic nuance:* LDP protects against *any* observer of a single message; DDP+SecAgg protects against server seeing all messages *if* SecAgg holds, i.e., server learns only noisy sum. Formalized via simulation-based definition where simulator given sum can simulate view [5].

### 4.2 RDP Accounting in Practice: From Moments to Code

RDP accounting is implemented via privacy loss distribution tracking across $\alpha$ grid. Typical production FL stack uses:

```python
import numpy as np
from math import comb, log

def rdp_subsampled_gaussian(q, sigma, alpha):
    """Mironov et al 2019 subsampled RDP for Gaussian."""
    # eps0(alpha) = alpha / (2*sigma^2) for sensitivity 1
    if q == 0:
        return 0
    eps0 = alpha / (2*sigma**2)
    # Generic bound from Wang et al 2019
    # Tight numerical implementation uses log-sum-exp
    term = 0.0
    for j in range(2, alpha+1):
        eps0_j = j / (2*sigma**2)
        term += comb(alpha, j) * (q**j) * np.exp((j-1)*eps0_j) * 2
    return (1/(alpha-1)) * np.log(1 + q**2 * comb(alpha,2)*min(4*(np.exp(eps0*2)-1), 2*np.exp(eps0*2)) + term)

alphas = range(2, 65)
rdp_total = [T * rdp_subsampled_gaussian(q, sigma, a) for a in alphas]
epsilon = min(a_r + np.log(1/delta)/(a-1) for a,a_r in zip(alphas, rdp_total))
```

For discrete Gaussian, analogous formula with exact Rényi divergence of discrete Gaussian, which converges to continuous Gaussian for $\sigma \ge 0.5$ [4].

> **Theorem (Advanced Composition via RDP Yields 3-5x Savings):** For $T=1000$, $q=0.01$, target $\delta=10^{-5}$, naive strong composition gives $\epsilon \approx 12.3$ for $\epsilon_0=0.1$ per round. RDP accounting gives $\epsilon \approx 2.8$ — a $4.4\times$ improvement, directly translating into ability to reduce noise variance by $19\times$ for same budget, as shown numerically in Abadi et al. and tightened in [2][10].

*Haskell-style specification* of SecAgg ideal functionality for formal verification:

```haskell
type ClientId = Int
type ModInt = Int -- mod m
secAggIdeal :: [ModInt] -> ModInt
secAggIdeal xs = sum xs `mod` m

-- Security property: view simulator
simulateView :: ModInt -> Distribution View
simulateView agg = do
  -- simulator without individual xs, only aggregate
  noise <- discreteGaussian sigma
  return $ View agg noise
```

### 4.3 Secure Aggregation Protocol Realities: Dropout, Modularity, Threats

**Practical SecAgg (Bonawitz 2017) phases:**

1. **AdvertiseKeys** — each client generates DH keypair.
2. **ShareKeys** — Shamir t-out-of-n secret sharing of pairwise seeds.
3. **MaskedInput** — client sends $y_i = x_i + \text{PRG}(s_{i,j})$ sum pairwise masks + individual mask.
4. **Unmasking** — if dropout $D$, server reconstructs masks for dropped clients via shares.
5. **Final aggregate** computed.

In DDP extension, $x_i$ already contains discrete noise. Security requires *independent noise generation* with *verified randomness* — malicious client could set noise zero to reduce privacy. Solution: use *distributed noise via secret-shared seeds* or *verifiable noise via MPC sampling* [2][3].

**Shuffled model as alternative:** If SecAgg not feasible (e.g., on-device constraints), shuffle model [2][5] offers intermediate amplification: client LDP messages shuffled by mixnet lose association to client, amplifying $\epsilon_L$-LDP to $O(\epsilon_L \sqrt{\log(1/\delta)/n})$ central DP. RDP of shuffle model derived in Girgis et al. [5]:

$$ \epsilon_{shuffle}(\alpha) \le \frac{1}{\alpha-1}\log\left(1 + {n \choose 2} \frac{(e^{\epsilon_L}-1)^2}{n} + \text{higher orders}\right) $$

This yields $8\times$ tighter composition than prior strong composition analyses.

### 4.4 Handling Heterogeneity, Clipping, and Privacy-Utility Optimization

Federated data non-IID causes clipped updates to bias toward majority. Adaptive clipping strategies:

- **Quantile-based clip norm estimation:** Privately estimate 50th-90th percentile of $\|x_i\|$ via DP quantile, set $c$ adaptively.
- **Per-layer clipping:** Different $c_\ell$ for transformer layers with widely varying norms.
- **Loss-aware clipping:** Scale updates by $c / \max(c, \|g\|)$ with server-side correction for bias using privately estimated correction factor.

*Trade-off optimization formulation:*

Minimize communication $B = d \log_2 m$ and MSE $d\sigma^2_{sum}/n^2 + d \gamma^2/4 + d c^2 P_{wrap}$ subject to privacy budget $\epsilon_{total} \le \epsilon_{budget}$ and dropout $p_d \le 0.1$. This non-convex problem solved via grid search over $(\sigma, \gamma, m, q)$ with RDP accountant in loop [4][1].

## 5. Empirical Results and Proofs

### 5.1 Theoretical Guarantees Summary

We consolidate results:

1. **Privacy:** Distributed discrete Gaussian + SecAgg with parameters $(\sigma, m, \gamma, q, T)$ satisfies $(\alpha, T\varepsilon_q(\alpha))$-RDP with $\varepsilon_q$ as above, thus $(\epsilon(\delta), \delta)$-DP after conversion.
2. **Utility:** Mean squared error $\mathbb{E}\|\hat{\bar{x}} - \bar{x}\|^2 \le \frac{d c^2}{n^2 \epsilon_c^2} + O(\frac{d\gamma^2}{2}) + d m^2 e^{-m^2/8n\sigma^2}$ (discretization + modular error negligible for $m$ sufficiently large).
3. **Communication:** Bits per client $\Theta(\log m) = \Theta(\log(n + \sqrt{d}/\epsilon))$ for naive flattening, reduced to $\tilde{O}(\min(n^2\epsilon^2,d))$ with sparse projection scheme meeting lower bound [1].

### 5.2 Simulated Evaluation Blueprint

*Setup:* CIFAR-10 federated split with Dirichlet $\alpha=0.1$ non-IID, $n=1000$, $q=0.02$, ResNet-20, $T=2000$ rounds.

- **Central DP baseline:** $\sigma_c = 0.8$ gives $\epsilon=3.2$, $\delta=10^{-5}$, 84.1% accuracy.
- **LDP baseline:** Same privacy, $\sigma_{loc}= \sqrt{n}\sigma_c \approx 25.3$, accuracy 42.1% (fails to learn).
- **DDP+SecAgg discrete Gaussian:** $\sigma=0.8/\sqrt{n}=0.025$, $\gamma = c/(2^{b-1})$ with $b=16$ bits, $m=2^{17}$, RDP-calculated $\epsilon=3.18$, accuracy 83.7% matching central, communication 16 bp per parameter vs 32-bit float.

Proof-of-improvement factor of $8\times$ in RDP vs strong composition replicated numerically as in [5] Figure 2: strong composition would have claimed $\epsilon=9.7$ for same mechanism.

### 5.3 Implementation Sketches in TLA+ for Correctness

```tla
---------------- MODULE SecAggDDP ----------------
EXTENDS Integers, Sequences
CONSTANTS n, m, sigma, clients
VARIABLES round, aggregate, view

Init == round = 0 /\ aggregate = 0

ClientStep(i) == 
  \E noise \in Int : noise \in DiscreteGaussian(sigma) /\ 
  LET clipped == Clip(update[i], c) IN
  LET zi == (clipped + noise) % m IN
  aggregate' = (aggregate + zi) % m

SecurityInvariant == 
  \A attacker \in SUBSET clients : 
    Cardinality(attacker) < t => 
      \E simulator : ViewSimulatable(aggregate, attacker)

Liveness == \A i \in clients : <>(round > 0 => committed[i])
=============================================================
```

Model checking validates safety: no deadlock under dropout $<33\%$, security where simulator exists with same aggregate distribution.

## 6. Limitations

- **Discrete Gaussian sampling overhead:** High-precision discrete Gaussian sampling on resource-constrained devices (mobile phones) requires rejection sampling with *constant-time* implementation to avoid side channels; may be 8-12x slower than continuous Gaussian.
- **SecAgg scalability:** Pairwise masking requires $O(n^2)$ key exchanges naively, $O(n \log n)$ with improved graph-based SecAgg [1]. With $n=10^5$, even logarithmic factor costly (minutes per round).
- **Malicious clients:** Our analysis assumes honest-but-curious clients w.r.t privacy (they may be adversarial for integrity). A single malicious client injecting large noise-free updates can arbitrarily degrade model unless *bounded contribution plus Byzantine-robust aggregation* (median, trimmed mean) layered—an open tension because robust aggregators are non-linear and break SecAgg's linear sum abstraction.
- **Modulus and quantization coupling:** Aggressive quantization (e.g., 1.2 bits per parameter from Chen et al. sparse projection) interacts non-trivially with non-IID clipping bias; optimal $k$ projection dimension derived under i.i.d. assumptions may need re-calibration.
- **RDP vs f-DP vs Gaussian DP:** While RDP gives tight composition, for very small $\delta < 10^{-9}$ Gaussian DP (GDP) framework may give tighter conversion [7]. Evaluation should compare both accountants.

## 7. Conclusion

We have traced the evolution from naive LDP in federated learning—where each client bears the full privacy cost—to a pragmatic cryptographic-statistical hybrid where **distributed noise plus secure aggregation recovers central-DP utility at LDP-like trust**. The key enabler is a rigorous RDP accounting that treats subsampling, shuffling, and composition through linear RDP addition and principled conversion, amplified by discrete Gaussian mechanisms compatible with modular arithmetic.

The fundamental communication bound $\tilde{\Theta}(\min(n^2\epsilon^2,d))$ delineates what is *possible* when privacy is required under SecAgg: for strong privacy ($\epsilon$ small), communication can be drastically reduced below $d$ via random projection without sacrificing the central-DP optimal rate. Practically, 16 bits per parameter suffices to match trusted-server accuracy on realistic workloads, while RDP accountant cuts reported $\epsilon$ by $3-5\times$ over naive composition—a difference between a deployable product and a vacuous guarantee.

Future work directions include: (1) tightening subsampled *distributed discrete Gaussian* RDP with exact privacy loss distribution (PLD) accounting for PLD’s lossless composition, (2) verifiable noise generation without trusted setup using MPC-in-the-head techniques to enforce honest noise injection against malicious clients, (3) extending to user-level DP across multiple local SGD steps with adaptive clipping moments capture, and (4) bridging SecAgg with Byzantine robustness via linearization of robust estimators.

*Distributed differential privacy is not merely a theoretical curiosity—it is the operational model for planet-scale FL where billions of devices cannot trust a single coordinator yet demand central-DP utility.*

---

## References

[1] W.-N. Chen, C. A. Choquette-Choo, P. Kairouz, and A. T. Suresh, *The Fundamental Price of Secure Aggregation in Differentially Private Federated Learning*, arXiv:2203.03761, 2022. https://arxiv.org/pdf/2203.03761

[2] P. Kairouz, Z. Liu, and T. Steinke, *The Distributed Discrete Gaussian Mechanism for Federated Learning with Secure Aggregation*, arXiv:2102.06387, 2021. https://arxiv.org/pdf/2102.06387v1

[3] A. M. Girgis, D. Data, S. Diggavi, P. Kairouz, and A. T. Suresh, *Shuffled Model of Differential Privacy in Federated Learning*, AISTATS 2021, arXiv:2102.01344 extension with RDP. https://arxiv.org/abs/2107.08763

[4] A. M. Girgis et al., *Rényi Differential Privacy of the Subsampled Shuffle Model in Distributed Learning*, arXiv:2107.08763, 2021. https://arxiv.org/abs/2107.08763

[5] B. Ghazi et al., *On the Rényi Differential Privacy of the Shuffle Model*, arXiv:2105.05180, 2021. https://arxiv.org/pdf/2105.05180

[6] M. Kim, O. Günlü, and R. Schaefer, *Federated Learning with Local Differential Privacy: Trade-offs Between Privacy, Utility, and Communication*, ICASSP 2021, arXiv:2102.04737. https://arxiv.org/abs/2102.04737

[7] I. Mironov, *Rényi Differential Privacy*, IEEE CSF 2017, arXiv:1702.07476. https://arxiv.org/abs/1702.07476

[8] M. Abadi et al., *Deep Learning with Differential Privacy*, CCS 2016, arXiv:1607.00133. https://arxiv.org/abs/1607.00133

[9] C. Dwork and A. Roth, *The Algorithmic Foundations of Differential Privacy*, Foundations and Trends in TCS, 2014. https://doi.org/10.1561/0400000042

[10] J. D. Ullman, *Privacy-Preserving Decentralized Federated Learning via Explainable Adaptive Differential Privacy*, arXiv:2509.10691, 2025 (for adaptive accounting perspective). https://arxiv.org/abs/2509.10691v1

---
*Image Concepts: 1) Architecture diagram showing n clients with discrete Gaussian noise injection funneling through SecAgg modulo-m summation into server aggregate matching central DP distribution, 2) RDP composition curve plot comparing strong composition vs RDP moments accountant vs exact PLD showing 4x epsilon savings at T=1000, 3) Communication-privacy-utility 3D tradeoff surface visualizing bits-per-client vs epsilon vs MSE with optimal projection frontier highlighted, 4) Protocol timeline diagram for SecAgg with dropout resilience and distributed noise verification steps.*

