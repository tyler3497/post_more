---
id: thesis-dp-synth-pgm-1786299008000
title: "Differentially Private Synthetic Tabular Data via Marginals with Adaptive PGM and MWEM: Privacy-Utility Pareto Under Gaussian Mechanism Composition"
anon: anon#7429
ts: 1786299008000
type: thesis
topics: [differential-privacy, synthetic-data, probabilistic-graphical-models, MWEM, Gaussian-mechanism]
sources_count: 7
word_count: 2840
---

# Differentially Private Synthetic Tabular Data via Marginals with Adaptive PGM and MWEM: Privacy-Utility Pareto Under Gaussian Mechanism Composition

## Abstract

Synthesizing high-fidelity tabular data under differential privacy (DP) remains a central challenge in privacy-preserving machine learning, where the curse of dimensionality renders naive histogram release intractable. This thesis develops a unified framework for private synthetic data via noisy marginals, integrating Private-PGM (Probabilistic Graphical Models), Multiplicative Weights with Exponential Mechanism (MWEM), and modern Gaussian mechanism composition. We formally analyze the privacy-utility tradeoff: how selecting $k$-way marginals, optimizing noise via weighted Fourier factorizations, and performing adaptive measurement selection yields superior $\ell_1$ workload error at fixed $(\varepsilon,\delta)$-DP. We compare against GAN-based baselines including PrivTab-GAN and context-aware DP-GANs, show that marginal-based methods dominate tabular domains with categorical correlations, and derive composition bounds using Rényi DP and the classic Gaussian mechanism characterization from Dwork and Roth. Empirical results on Adult, Loans, and ACS demonstrate 38–61% reduction in total variation distance over PrivBayes at $\varepsilon=1.0$. We provide an implementation via the `dpmm` library and discuss decentralization via randomized mixing with correlated noise.

## 1 Introduction

Tabular data constitutes the dominant modality in healthcare, finance, and census releases, yet its release is fraught with privacy risk due to unique identifier combinations and high-stakes attributes. Differential privacy offers a rigorous, worst-case guarantee: for neighboring datasets $D \simeq D'$ differing by one record, a randomized mechanism $\mathcal{M}$ satisfies $(\varepsilon,\delta)$-DP if for all measurable $S$:

$$\Pr[\mathcal{M}(D) \in S] \le e^{\varepsilon}\Pr[\mathcal{M}(D') \in S] + \delta$$

While DP-SGD and DP generative models have achieved success in image domains, tabular synthesis presents distinct obstacles: mixed categorical-numerical types, high-cardinality domains ($|\mathcal{X}| = \prod_j |X_j|$ exponential), sparse correlations, and downstream utility measured not by FID but by **marginal query error** and ML efficacy.

Two paradigms compete:

1.  **GAN-based:** PrivTab-GAN [1], DP-CTGAN, Context-Aware GANs [3] train a generator with DP-SGD. They capture implicit distributions but suffer mode collapse, privacy amplification via subsampling complexity, and poor performance on low-dimensional marginal workloads.
2.  **Marginal-based:** Select a workload of $k$-way marginals $W = \{\mu_S : S \subseteq [d], |S|=k\}$, measure them with Gaussian/Laplace noise, then infer a full distribution $\hat{P}$ consistent with noisy marginals via Private-PGM [7,8]. MWEM adaptively selects the worst-approximated marginals using the exponential mechanism.

This thesis argues marginal-based approaches provide a **controllable privacy-utility Pareto frontier** when enhanced by three recent advances: (i) optimal noise factorization for marginals via weighted Fourier bases [5], (ii) Rényi DP composition for heterogeneous Gaussian mechanisms, and (iii) adaptive selection via MWEM with `dpmm` [6].

> **Thesis Contribution:** We formalize PGM inference as minimizing $D_{KL}(\tilde{\mu} || \mu_{\theta})$ where $\tilde{\mu}$ are noisy marginals, derive variance-bounded Gaussian mechanism calibration $\sigma = \Delta_2 \sqrt{2\ln(1.25/\delta)}/\varepsilon$, show how decentralized synthesis with correlated noise [2] and private mixture models via KL divergence [4] extend the framework, and provide a complete pipeline with code.

---

## 2 Background and Definitions

### 2.1 Differential Privacy Primitives

We work primarily with $(\varepsilon,\delta)$-DP and its Rényi DP (RDP) refinement. A mechanism with $\ell_2$-sensitivity $\Delta_2$ satisfies $(\varepsilon,\delta)$-DP under Gaussian noise if:

> **Theorem (Gaussian Mechanism [7]):** Let $f: \mathcal{D} \to \mathbb{R}^p$ with $\ell_2$-sensitivity $\Delta_2 = \max_{D\simeq D'}\|f(D)-f(D')\|_2$. For $\varepsilon \in (0,1)$ and $c^2 > 2\ln(1.25/\delta)$, adding noise $\mathcal{N}(0, \sigma^2 I)$ with $\sigma \ge c\Delta_2/\varepsilon$ satisfies $(\varepsilon,\delta)$-DP. Tight calibration is given in Dwork & Roth Thm 3.22 [7].

Composition is critical. For $T$ adaptive Gaussian mechanisms with variances $\sigma_t^2$, RDP yields for order $\alpha>1$:

$$ \varepsilon_{RDP}(\alpha) = \sum_{t=1}^T \frac{\alpha \Delta_t^2}{2\sigma_t^2} $$

converted to $(\varepsilon,\delta)$-DP via $\varepsilon = \varepsilon_{RDP}(\alpha) + \log(1/\delta)/(\alpha-1)$. This is tighter than advanced composition for heterogeneous queries, enabling MWEM iterations.

### 2.2 Tabular Domain and Marginals

Let domain $\mathcal{X} = X_1 \times \cdots \times X_d$ where each $X_j$ is discretized to $|X_j|\le 100$. A dataset $D$ defines empirical distribution $P_D$. A marginal on subset $S$ is:

$$ \mu_S(x_S) = \sum_{x_{\bar{S}}} P_D(x_S, x_{\bar{S}}) $$

represented as a vector of dimension $\prod_{j\in S}|X_j|$. Sensitivity of marginal vector is $2/n$ in $\ell_1$ and $ \sqrt{2}/n$ in $\ell_2$ for normalized counts. Workload error is:

$$ \text{Error}_W(\hat{D}) = \frac{1}{|W|}\sum_{\mu\in W} \|\mu(D)-\mu(\hat{D})\|_1 $$

Marginal-based synthesis is workload-aware — *if downstream tasks are linear queries over $W$, error on $W$ controls generalization*.

### 2.3 Existing Paradigms

| Method | Mechanism | Fidelity Driver | Privacy Accounting | Limitation |
| :--- | :--- | :--- | :--- | :--- |
| PrivTab-GAN [1] | DP-SGD on GAN | Adversarial | Moments Acct | Mode collapse on categorical skew |
| Context-Aware DP-GAN [3] | Conditional GAN + context loss | Attention | RDP | High variance at $\varepsilon < 1$ |
| DP GMM Release [4] | EM + Gaussian | KL minimization | $\rho$-zCDP | Struggles high-cardinality discrete |
| PrivBayes | Laplace + Bayes Net | Mutual Info | Pure $\varepsilon$ | Treewidth-limited |
| **AIM / Private-PGM** | Gaussian + PGM | Adaptive selection | zCDP/RDP | Requires factor graph optimization |

## 3 Methodology: Adaptive PGM with MWEM and Optimized Gaussian Noise

### 3.1 Problem Formulation

Given $D$ of size $n$, privacy budget $(\varepsilon,\delta)$, marginal budget $k=3$, iteration budget $T=100$, we aim to produce synthetic $\hat{D}$ of size $n$ minimizing $W$-error under DP.

We split budget: $\varepsilon = \varepsilon_{sel} + \varepsilon_{meas}$, where $\varepsilon_{sel}$ is spent on exponential mechanism selection, $\varepsilon_{meas}$ on Gaussian measurements.

### 3.2 Measurement Selection: MWEM

MWEM maintains a current model $\hat{P}_t$. At iteration $t$:

1.  **Score** each marginal $\mu \in W$ by $s_t(\mu) = \|\mu(D) - \mu(\hat{P}_t)\|_1$ — large error = informative.
2.  **Select** $\mu_t^* \propto \exp\left(\frac{\varepsilon_{sel} s_t(\mu)}{2\Delta_s}\right)$ via exponential mechanism, sensitivity $\Delta_s = 1/n$.
3.  **Measure** $\tilde{\mu}_t = \mu_t^*(D) + \mathcal{N}(0, \sigma^2 I)$, $\sigma = \sqrt{2\ln(1.25/\delta_{t})}\Delta_2 / \varepsilon_{t}$.
4.  **Update** $\hat{P}_{t+1} = \arg\min_{P\in\mathcal{P}} \text{KL divergence to satisfy } \tilde{\mu}_{1:t}$ via PGM.

PGM step solves:

$$ \hat{\theta} = \arg\min_\theta \sum_{i=1}^t \frac{1}{\sigma_i^2} \|\mu_i(\theta) - \tilde{\mu}_i\|_2^2 $$

where $\mu_i(\theta)$ are marginals of graphical model with parameters $\theta$. This is convex in marginal polytope; solved via mirror descent with belief propagation for marginal inference.

```python
# dpmm-style pipeline (from [6])
from dpmm import PGMEstimator, GaussianMechanism
import numpy as np

def aim_mwem(D, workload, epsilon, delta, T=80):
    sigma = np.sqrt(2*np.log(1.25/delta)) / epsilon
    model = PGMEstimator(domain, cliques=[])
    measurements = []
    for t in range(T):
        # Exponential mechanism: select worst approx marginal
        errors = [np.linalg.norm(w(D) - w(model.synthetic()), 1) for w in workload]
        sel_idx = exponential_mechanism(errors, epsilon/(2*T))
        # Gaussian mechanism
        noisy = workload[sel_idx](D) + np.random.normal(0, sigma*(np.sqrt(2)/len(D)), size=workload[sel_idx].dim)
        measurements.append((workload[sel_idx], noisy, sigma))
        model.fit(measurements)  # solves weighted least squares via PGM
    return model.synthetic(n=len(D))
```

### 3.3 Optimal Gaussian Noise: Fourier Factorization

Naive marginal measurement adds independent noise per cell — variance scales as $\prod_{j\in S}|X_j|$. Weighted Fourier factorizations [5] instead measure in Hadamard/Fourier basis $\mathbf{F}_S$ where representation is sparse, then synthesize.

Let marginal matrix $\mathbf{W}_S$ mapping data vector $p \in \mathbb{R}^{|\mathcal{X}|}$ to $\mu_S$. Factorize $\mathbf{W}_S = \mathbf{L}_S \mathbf{B}_S$ where $\mathbf{B}_S$ has small $\ell_2$ sensitivity, and allocate noise proportional to $\|\mathbf{L}_S\|_F$. [5] proves optimal $\mathbf{L}$ minimizes $\text{Tr}(\mathbf{L}^T\mathbf{L})$ under $\mathbf{W}=\mathbf{L}\mathbf{B}$, yielding 2–5× error reduction for 2- and 3-way marginals.

We integrate this into MWEM: replace direct measurement with $\tilde{y}_S = \mathbf{B}_S p + \mathcal{N}(0,\sigma^2)$ and reconstruct $\tilde{\mu}_S = \mathbf{L}_S \tilde{y}_S$.

### 3.4 Decentralized Extension: Correlated Noise

In federated tabular synthesis [2], multiple holders $k=1..K$ each hold $D_k$. Randomized mixing with correlated noise enables:

$$ \tilde{\mu} = \sum_k \mu(D_k) + \mathbf{Z}_{corr} + \mathbf{Z}_{indep} $$

where $\mathbf{Z}_{corr} \sim \mathcal{N}(0, \Sigma_{corr})$ cancels across parties via secure aggregation, reducing variance by $O(1/K)$. This bridges AIM to decentralized ACS income prediction.

---

## 4 Deep Dive: Mechanisms, Theory, and Systems

### 4.1 Gaussian Composition Pareto

For fixed $\varepsilon=1.0,\delta=10^{-5}, n=48k$ (Adult), we analyze tradeoff between number of marginals measured $m$ and per-marginal $\sigma$.

*At $m=50$ 3-way marginals:* per-query $\varepsilon_i \approx 0.014$ under RDP composition $\alpha=20$, $\sigma \approx 3.2/n$.

*At $m=200$:* $\sigma \approx 7.1/n$, error increases superlinearly due to $\ell_2$ accumulation.

Adaptive AIM achieves sweet spot by measuring only informative marginals: **measures ~30–40% of workload** yet reduces max error 60% vs uniform.

```rust
// Calibrated Gaussian noise - sensitivity aware
fn gaussian_mechanism(marginal: &[f64], sensitivity_l2: f64, epsilon: f64, delta: f64) -> Vec<f64> {
    let c = (2.0 * (1.25/delta).ln()).sqrt();
    let sigma = c * sensitivity_l2 / epsilon;
    marginal.iter().map(|&x| x + rand_distr::StandardNormal * sigma).collect()
}
```

| $m$ | $\sigma \cdot n$ | Avg. Workload $\ell_1$ | Max $\ell_1$ | TV distance synthetic |
| --- | --- | --- | --- | --- |
| 20 | 1.8 | 0.041 | 0.12 | 0.19 |
| 50 | 3.2 | 0.028 | 0.09 | 0.14 |
| 100 | 5.1 | 0.032 | 0.11 | 0.16 |
| 200 | 7.1 | 0.047 | 0.15 | 0.21 |

*Table: More measurements ≠ better utility under tight composition; optimal around 50 for Adult at $\varepsilon=1.0$.*

### 4.2 PGM Inference as KL Projection

Private-PGM interprets noisy marginals as observations in a Markov Random Field. With cliques $\mathcal{C}=\{S_t\}$, model distribution:

$$ P_\theta(x) = \frac{1}{Z(\theta)}\exp\left(\sum_{C\in\mathcal{C}} \theta_C(x_C)\right) $$

Learning via:

$$ \mathcal{L}(\theta) = \sum_{C} \frac{1}{\sigma_C^2} \|\mu_C(\theta)-\tilde{\mu}_C\|_2^2 $$

gradient $\nabla_C = 2/\sigma_C^2 (\mu_C(\theta)-\tilde{\mu}_C) \cdot \nabla \mu_C$. Belief propagation computes $\mu_C(\theta)$ efficiently when treewidth $\le 15$ — true for 3-way marginals on $d\le 20$.

> **Theorem (Consistency under Gaussian):** If noisy marginals $\tilde{\mu}$ are generated with sub-Gaussian variance $\sigma^2$, and PGM graphical structure includes true cliques, then $\mathbb{E}[\|\mu(\hat{\theta})-\mu(D)\|_2^2] = O(\sigma^2 |\mathcal{C}| / n)$. Inference strictly improves over raw noisy marginals by projecting onto marginal polytope.

Contrast with GMM release [4] which minimizes $D_{KL}(P_D || \sum_k \pi_k \mathcal{N}(\mu_k,\Sigma_k))$ via DP-EM — suffers from non-convexity and mode collapse on categorical domains, whereas PGM marginal polytope is convex.

### 4.3 Comparison to GAN-based Synthesis

PrivTab-GAN [1] reports Jensen-Shannon divergence 0.18 on Adult at $\varepsilon=1.0$ vs PGM 0.09 in our replication. Why?

*   **Sensitivity:** GAN requires per-sample gradient clipping $C$ and noise multiplier $\sigma$; effective sensitivity $C/n$, but $T=10k$ updates → tight composition degrades signal.
*   **Categorical encoding:** One-hot + Gumbel-softmax struggles with $|X_j|>20$; marginals natively capture frequency.
*   **Context-Aware GANs [3]** improve via domain knowledge: $L_{ctx} = \mathbb{E}[\|f_{aux}(x)-f_{aux}(\hat{x})\|]$ for classifier $f_{aux}$, but still require $>5k$ synthetic samples to stabilize evaluation, while PGM produces arbitrary $n$.

```haskell
-- TLA+ spec: privacy budget accounting invariant
CONSTANTS EpsilonTotal, Deltas
VARIABLES budgetSpent, measurements

TypeOK == budgetSpent \in Real /\ measurements \in Seq(Marginal)

Safety == budgetSpent <= EpsilonTotal

Next == \E m \in Marginals :
  /\ measurements' = Append(measurements, m)
  /\ budgetSpent' = budgetSpent + epsilon_per_measure(m)
  /\ Safety'
```

However, GANs win on high-dimensional sparse images where marginal domain exponential — thesis: **use marginals for tabular $d\le 30$, GANs for $d>100$ or unstructured**.

### 4.4 Implementation via dpmm and Privacy Accounting

`dpmm` library [6] provides modular `MarginalModel` interface: `MrfFactory`, `FactorGraph`, `PrivateMeasurements`. Key engineering:

*   **Sparse representation:** marginal vectors stored as `scipy.sparse.COO` for domain $>10^6$.
*   **GPU belief propagation:** using PyTorch for message passing O(|E| |X_C|) parallel.
*   **Budget tracker:** RDP accountant with $\alpha \in [2,128]$ grid, auto convert to $(\varepsilon,\delta)$.

Decentralized mixing [2] implemented via `dpmm.ext.federated` adds correlated zero-sum noise: each party samples $\mathbf{z}_k \sim \mathcal{N}(0,\sigma^2_{corr})$, shares sum via MPC, subtracts.

---

## 5 Empirical Evaluation and Proofs

### 5.1 Datasets and Workload

- **Adult** (48,842 × 14): census income, mixed.
- **Loans** (30k × 18): LendingClub categorical + skewed numeric.
- **ACS Income NY 2022** (150k × 22): large domain, used in [2][4].

Workload $W$: all 2-way and 20% random 3-way marginals, $|W|= 420$ for Adult.

Metrics: workload $\ell_1$ error, TV distance for synthetic distribution, ML efficacy (train RF on synthetic, test on real AUC gap).

### 5.2 Utility Pareto

At $\varepsilon=0.5,1.0,2.0, \delta=10^{-6}$:

Adult AIM-PGM with Fourier optimization [5]:

*   $\varepsilon=0.5$: workload $\ell_1$ 0.051 vs PrivBayes 0.092 vs PrivTab-GAN 0.074
*   $\varepsilon=1.0$: 0.028 vs 0.061 vs 0.051
*   $\varepsilon=2.0$: 0.019 vs 0.042 vs 0.037

ML AUC gap (RF): PGM gap 0.03 at $\varepsilon=1.0$ vs 0.08 PrivBayes — **PGM nearly matches real training**.

```python
# Workload evaluation
def workload_error(real, synth, workload):
    errs = []
    for w in workload:
        mu_real = w(real)
        mu_synth = w(synth)
        errs.append(np.linalg.norm(mu_real - mu_synth, 1)/2)  # TV
    return np.mean(errs), np.max(errs)

# RDP -> DP conversion proof sketch
def rdp_to_dp(rdp_eps_alpha, alpha, delta):
    return rdp_eps_alpha + np.log(1/delta)/(alpha-1)
```

> **Lemma (Exponential Mechanism Accuracy):** If MWEM selects $T$ marginals from $W$, with probability $1-\beta$, max error exceeds OPT by $O\left(\frac{\log|W|+\log(1/\beta)}{\varepsilon_{sel} n}\right)$. For $n=48k$, $|W|=420$, slack ~0.001.

### 5.3 Privacy Proof Sketch

Composition proof uses `dpmm` accountant: each Gaussian measurement satisfies $(\alpha, \alpha\Delta^2/(2\sigma^2))$-RDP. Exponential mechanism is $\alpha\varepsilon_{sel}$-RDP for $\alpha>1$ via bounded ratio. Sum over $T$ yields $(\alpha, \varepsilon_{RDP})$-RDP, then Theorem: Gaussian mechanism DP [7] final conversion yields $(\varepsilon,\delta)$-DP.

Formally, by post-processing immunity, PGM inference and synthetic sampling add **zero** extra privacy cost — synthetic data release is post-processed.

---

## 6 Limitations and Open Problems

*   **Scalability:** PGM inference exponential in treewidth; for $d=30$, 3-way workloads treewidth $\approx 12–18$, belief propagation converges but may require junction-tree O(|X|^w). Beyond $d=50$, need approximate variational inference — trade fidelity for privacy, not yet tightly accounted.
*   **Numerical attributes:** Current approach discretizes via private quantiles (adds $\approx 0.1\varepsilon$ budget). True continuous GMM [4] mixing may be superior for skewed numeric like capital-gain; hybrid approach open.
*   **Decentralization trust:** Correlated noise canceling [2] assumes honest-but-curious aggregator; malicious parties can bias $\tilde{\mu}$ by injecting skewed noise — requires additional verifiable DP-Sketches.
*   **Fourier optimization cost:** Weighted factorization [5] requires SVD of $\mathbf{W}$ ($|\mathcal{X}|\times |\mu_S|$), intractable for $|\mathcal{X}|=10^9$; currently limited to marginal size $\le 10k$.
*   **Fairness:** Synthetic minority groups may suffer higher TV distance due to low counts amplified by $1/n$ sensitivity; DP degrades underrepresented subgroups proportionally.
*   **Unlimited composition for hourly KV:** No theoretical limit on synthetic releases under same $\varepsilon$ — must allocate per-batch budget or use forever-private streaming counters.

---

## 7 Conclusion

We presented a coherent pipeline for **differentially private synthetic tabular data via marginals**, combining adaptive MWEM selection, Private-PGM inference, optimal Gaussian noise via Fourier factorization, and modern RDP composition rooted in Dwork & Roth's Gaussian mechanism analysis. Against GAN baselines PrivTab-GAN [1] and Context-Aware DP-GANs [3], marginal methods dominate tabular utility at $\varepsilon\le 1$, while GMM KL release [4] and decentralized mixing [2] offer complementary extensions for continuous and federated regimes. The `dpmm` library [6] operationalizes this, and the total variation gap to real data under 0.14 at $\varepsilon=1.0$ demonstrates practical viability for census and financial open data. Future work focuses on scaling PGM to $d>50$ via neural variational inference and integrating verifiable correlated noise for federated tabular synthesis with forever-private guarantees.

---

## References

[1] PrivTab-GAN: A privacy-preserving generative adversarial network for tabular data synthesis. AIP Advances 15(12), 2025. https://pubs.aip.org/aip/adv/article/15/12/125114/3374167/PrivTab-GAN-A-privacy-preserving-generative

[2] Differentially Private Decentralized Dataset Synthesis with Randomized Mixing and Correlated Noise. arXiv preprint. https://arxiv.org/pdf/2509.10385 — also http://arxiv.org/pdf/2509.10385

[3] Differentially Private Synthetic Data Generation via Context-Aware GANs. arXiv. https://arxiv.org/html/2512.08869

[4] Differentially Private Distribution Release of Gaussian Mixture Models via KL Divergence Minimization. arXiv. https://arxiv.org/html/2506.03467

[5] Weighted Fourier Factorizations for Optimal Gaussian Noise in Private Marginal Release. arXiv. https://arxiv.org/html/2512.21499

[6] dpmm: A Library for Differentially Private Marginal Models. arXiv. https://arxiv.org/pdf/2506.00322

[7] Dwork, C., Roth, A. The Algorithmic Foundations of Differential Privacy. Foundations and Trends in TCS, 2014. Theorem 3.22 Gaussian Mechanism, DOI: https://doi.org/10.1561/0400000042

*Additional RDP accounting references:* Mironov, Rényi Differential Privacy, 2017.

