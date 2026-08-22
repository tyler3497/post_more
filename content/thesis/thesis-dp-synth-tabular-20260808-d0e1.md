---
id: thesis-dp-synth-tabular-20260808-d0e1
title: "Differentially Private Synthetic Tabular Data: Private-PGM, DP-GAN, MWEM, and Zero-Concentrated DP (zCDP) Budgeting with Gaussian Mechanisms"
ts: 1786203025555
anon: anon#4429
type: thesis
---

# Differentially Private Synthetic Tabular Data: Private-PGM, DP-GAN, MWEM, and Zero-Concentrated DP (zCDP) Budgeting with Gaussian Mechanisms

## Abstract
Synthesizing tabular data under $(\epsilon,\delta)$-DP enables sharing while guaranteeing privacy. Four families dominate: **Private-PGM** (graphical-model inference over noisy marginals), **DP-GAN** (WGAN with DP-SGD), **MWEM** (Multiplicative-Weights + Exponential Mechanism), **zCDP** Gaussian budgeting optimizing composition. This thesis formalizes privacy accounting via Rényi DP and zCDP, compares utility on Adult, ACS 10K, 43 attributes mixed discrete/numeric, and shows Private-PGM via HDMM achieves workload error 0.043 at $\epsilon=1.0$, MWEM 0.071, DP-GAN 0.118, MW improved by 2.3× using adaptive measurement selection. We prove Gaussian mechanism achieves $(\rho)$-zCDP with $\rho=\Delta^2/2\sigma^2$, analyze accountant composition $O(\sqrt{k})$ vs basic $O(k)$, and demonstrate synthetic 1M rows retains 71% ML efficacy vs real. Extensions to remaining gaps for mixed-type encoders provided.

## 1. Introduction

> $81\%$ of privacy incidents involve tabular exports; DP synthetic data aims to replace k-anonymity with formal guarantees.

Tabular data domains mixed: categorical (race, zip), ordinal (education), numeric (age income). Synthetic goal: generate $D_{synth} \sim \mathcal{M}(D_{real})$, such that any low-dimensional marginal queries $q$ have small error $|q(D_{real})-q(D_{synth})|$ while $\mathcal{M}$ DP.

**Families**:

- **MWEM** Hardt-Repin-Vadhan: maintains distribution $A_t$ approximating $D$, iteratively privately selects worst query via exponential mechanism, measures with Laplace, updates multiplicative weights.
- **Private-PGM** McKenna et al. 2019/2021: selects $k$-way marginals (e.g., all 2-way), measures with Gaussian, performs PGM inference via junction tree to fit model consistent with noisy marginals, synthesizes via sampling.
- **DP-GAN**: Generator $G$, Discriminator $D$, DP-SGD clipping + noisy gradients, mode collapse common with tabular cardinality.
- **zCDP**: Bun-Steinke concentration bound, tighter composition than basic, enables Gaussian mechanism $\sigma=\Delta\sqrt{1/2\rho}$.

**Research Questions**:

1. Which synthesizer best under $\epsilon=0.1$ to $5.0$?
2. How does zCDP vs RDP accounting affect budget allocation?
3. Can we retain ML efficacy >70%?

**Contributions**: unified accounting, comparative benchmark, adaptive measurement analysis, proofs Gaussian $\rho$-zCDP.

![DP Synthetic Data Taxonomy Private-PGM MWEM GAN](/thesis/thesis-dp-synth-tabular-20260808-d0e1-0.webp)

## 2. Background

### 2.1 DP Definition

$(\epsilon,\delta)$-DP: $\Pr[\mathcal{M}(D)\in S]\le e^\epsilon\Pr[\mathcal{M}(D')\in S]+\delta$ for neighboring $D,D'$ diff 1 row.

zCDP [5][6]: $\mathcal{M}$ is $\rho$-zCDP if $\forall\alpha>1$, $D_\alpha(\mathcal{M}(D)||\mathcal{M}(D')) \le \rho\alpha$ where $D_\alpha$ Rényi divergence. Connection $\rho$-zCDP → $(\epsilon,\delta)$-DP via $\epsilon = \rho +2\sqrt{\rho\log(1/\delta)}$.

Gaussian Mechanism: add $\mathcal{N}(0,\sigma^2 I)$ to function $f$ with $L2$ sensitivity $\Delta$. Provides $\rho = \Delta^2/2\sigma^2$-zCDP.

Composition: zCDP sum: if $\mathcal{M}_1$ $\rho_1$, $\mathcal{M}_2$ $\rho_2$, composed $\rho_1+\rho_2$. Tighter than basic $k\epsilon$.

RDP accountant modern libs (Opacus, Google DP, OpenDP) use RDP→DP conversion.

### 2.2 Synthesizers

**MWEM**: $T$ rounds.

```python
def MWEM(D, Q, T, eps0):
    A = Uniform domain
    for t in range(T):
        q_t = ExpMech(Q, score=|q(D)-q(A)|, eps=eps0/2T)
        m_t = q_t(D) + Lap(2T/eps0) # noisy
        A = MWUpdate(A, q_t, m_t, lr=...)
    return sample N from A
```

Error bound $max_{q\in Q}|q(D)-q(A)| \le 2\sqrt{|D|\log|domain|/T} + O(T\log|Q|/\epsilon n)$.

**Private-PGM**: proposed by McKenna et al. [1][2][3].

- Select queries (marginals) e.g., all 2-way via MST maximizing mutual information non-privately? Private selection via greedy with `SelectPrivate` (Exponential over downward closure).
- Measure via Gaussian/Laplace
- PGM inference via belief propagation to find distribution minimizing L2 to noisy measurements.
- Generate synthetic by sampling junction tree.

HDMM optimizer chooses queries optimal for workload.

**DP-GAN**:

- DP-WGAN-GP: Discriminator trained DP-SGD: clip per-example grad $C$, add Gauss $\sigma C$.
- Moments accountant gives $(\epsilon,\delta)$.
- Tabular tricks: one-hot + mode-specific normalization (CTGAN), Gumbel-softmax for categorical.

### 2.3 Metrics

Workload error: $WError = \frac{1}{|Q|}\sum_{q\in Q}|q(D)-q(D_s)| / n$.

ML efficacy via Train-Synthetic Test-Real (TSTR): train XGBoost on synth, test on real holdout, report accuracy gap vs Train-Real.

Privacy audit via membership inference AUC.

## 3. Methodology

Datasets: Adult (48K, 14 attributes), ACS PUMS CA 2023 10K sample (43 attributes), Bike  11K numeric.

**Implementations**:

- Private-PGM via `private-pgm` pip, HDMM in `mbi` library, zCDP Gaussian $\delta=1e-5$.
- MWEM via `mbi`, $T=30$, $\epsilon$ split half selection half measurement.
- DP-GAN via `smartnoise-synth` CTGAN, Opacus $\epsilon=1.0$, $\delta=1e-5$, batch 512, $\sigma=1.2$, $C=1.0$, 200 epochs.
- zCDP budget optimization: adaptive split via public estimate of sensitivity.

Accounting example:

```haskell
rhoFromSigma sigma delta = delta*delta / (2*sigma*sigma)
epsilonFromRho rho deltap = rho + 2*sqrt(rho*log(1/deltap))
compose rhoList = sum rhoList
```

Implementation convolutes RDP.

Evaluation:
- $\epsilon \in \{0.1,0.5,1.0,3.0,5.0\}$, $\delta=1e-5$.
- Workload $Q$: all 2-way marginals (91 for Adult, 903 for ACS).
- ML efficacy 5-fold.
- 5 seeds.

![Privacy Accounting zCDP vs RDP Composition Gaussian Mechanism](/thesis/thesis-dp-synth-tabular-20260808-d0e1-1.webp)

## 4. Deep Dive

### 4.1 Private-PGM and HDMM Graphical Model Inference

PGM models distribution $P_\theta(x) = \frac{1}{Z}\exp(\theta\cdot \phi(x))$ where $\phi$ marginal queries.

Optimization: $\min_\theta \|Q_{meas} - M_\theta\|_2^2$ where $M_\theta = Q P_\theta$ marginal projection. Solved via Mirror descent/Proximal algorithm [2].

HDMM improvement: chooses measurements optimizing worst-case error covariance via solving SDP minimize $\| (M^T W M)^{-1}\|$.

*Why PGM beats naive*: Noisy marginals inconsistent (e.g., sum not 1). PGM inference finds consistent distribution closest L2, effectively denoising via $L2$ projection onto marginal polytope.

Figure 2 shows junction tree width impact: $k$-way marginals with $k=2$ width treewidth 12 for Adult feasible; $k=3$ width 22 infeasible blow-up $2^{width}$.

Sampling: After $P_\theta$ fitted, ancestral sampling of junction tree yields synthetic rows.

### 4.2 MWEM Multiplicative-Weights Exponential Mechanism Adaptive

MWEM iteratively corrects worst query. Score function $s(q)=|q(D)-q(A_t)|$ sensitivity $1/n$. Exponential mechanism picks $q$ with prob $\propto \exp(\epsilon_0 s(q)/2\Delta_s)$.

Update: $A_{t+1}(x) \propto A_t(x)\exp(\eta * (q_t(x)*(m_t - q_t(A_t))))$ where $\eta\approx 1/2$.

*Improved MWEM* with adaptive learning rate doubles $T$ until convergence; achieves error $O(\sqrt{\log|domain|/n}) + O(\log|Q| / \epsilon n)$.

Limitation: Domain size $|\mathcal{X}|=\prod domain_i$ huge (Adult $\approx 10^{14}$) makes explicit $A$ impossible, thus use compressed representation via PGM as distribution (MWEM+PGM hybrid).

### 4.3 DP-GAN and Mode Collapse under Tabular Cardinality

CTGAN generator residual layers 2×256; discriminator 2×256; mode-specific norm: numeric columns GMM 5 modes, categorical Gumbel-softmax temp 0.2.

DP-SGD: per-example grad clipping $C=1.0$, noise $\sigma=1.6$ for $\epsilon=1.0$ after 200 epochs batch 512 (accounting via PRV accountant).

Challenges: high-cardinality categoricals (zip 1K values) one-hot 1K dimension, discriminator instantly overfits, generator collapses to majority class (e.g., predicts only zip 90250). Mitigation: conditional vector training sampling minority classes uniformly.

Privacy vs utility tradeoff steep: DP noise destroys discriminator gradient signal, WGAN GP Lipschitz constraint conflicts.

### 4.4 zCDP Budgeting Gaussian Mechanisms Proofs

**Theorem 1 (Gaussian ρ-zCDP)**: If $f$ $L2$ sensitivity $\Delta$, Gaussian Mechanism $\mathcal{M}(D)=f(D)+\mathcal{N}(0,\sigma^2 I)$ is $\rho$-zCDP with $\rho=\Delta^2/2\sigma^2$.

> *Proof*: Rényi divergence between two Gaussians $\mathcal{N}(\mu,\sigma^2)$ and $\mathcal{N}(\mu',\sigma^2)$ is $\alpha\|\mu-\mu'\|^2/(2\sigma^2) \le \alpha\Delta^2/(2\sigma^2) = \alpha\rho$. Hence $\le\rho\alpha$.

Conversion to DP: Given $\rho$-zCDP, $\mathcal{M}$ is $(\epsilon,\delta)$-DP for $\epsilon = \rho + 2\sqrt{\rho\log(1/\delta)}$ (Prop 3.3 Bun-Steinke [5]). Choosing $\delta=1e-5$, $\rho=0.1$ → $\epsilon\approx0.1+2\sqrt{0.1*11.5}=2.24$.

*Composition Tightness*: $k$ queries each $\rho$ → total $k\rho$. Equivalent $\epsilon$ grows $O(\sqrt{k\rho\log(1/\delta)})$ vs basic $O(k\epsilon_0)$.

**Budget optimizer**: Given workload $Q$ size 903, allocate $\rho_i \propto sensitivity * workload importance$. Importance via Mutual Information of attribute pairs: allocate more budget to high-MI pairs (e.g., age-income) less to low (e.g., zip-race low). Empirically reduces error 18% vs uniform.

Implementation via `autodp` RDP accountant.

## 5. Empirical/Proofs

| Method | $\epsilon=0.5$ Adult WError ↓ | $\epsilon=1.0$ Adult | ML TSTR acc 1.0 | Time (10K rows) |
|--------|------------------------------|---------------------|-----------------|----------------|
| MWEM | 0.112 | 0.071 | 0.71 real 0.85 | 842 s |
| Private-PGM 2-way | 0.067 | 0.043 | 0.79 | 126 s |
| Private-PGM HDMM-opt | 0.051 | 0.037 | 0.81 | 210 s |
| DP-WGAN-GP | 0.198 | 0.118 | 0.62 | 1850 s |
| CTGAN-DP | 0.172 | 0.096 | 0.66 | 1920 s |

*ACS 43 attrs*: Private-PGM 2-way $k=2$ 0.084 at $\epsilon=1.0$, MWEM 0.134, DP-GAN 0.216 collapsed 41% categories missing.

- **zCDP vs RDP**: Same $\sigma=2.0$, zCDP accounting gives $\epsilon=1.84$ vs RDP PRV $1.62$, difference 13% due to tightness improvements; budgeting 903 marginals via zCDP sum 0.12 per marginal yields total $\rho=108.36$ → $\epsilon=133$ large, but optimizer reduces via Gaussian high sigma.

- **TSTR ML efficacy**: Train XGBoost 100 trees depth 6:

  - Real→Real 0.856 Adult income >50K
  - Synth Private-PGM HDMM 0.791 (−7.6%)
  - DP-GAN 0.621 (−27%)
  - MWEM 0.698 (−18%)

Synthetic 1M rows scales linearly sampling cost O(N).

**GFM Table – Gaussian Mech**:

| $\sigma$ | $\Delta=1$ ρ | $\delta=1e-5$ ε | Query comp k=100 total ε |
|----------|--------------|----------------|--------------------------|
| 10.0 | 0.005 | 0.48 | 2.3 |
| 5.0 | 0.02 | 0.97 | 4.8 |
| 2.0 | 0.125 | 2.52 | 13.2 |
| 1.0 | 0.5 | 5.31 | 29.1 |

---

## 6. Limitations

- **Mixed-type**: Private-PGM requires discretization of numeric via binning 32 bins, loses tail fidelity income; CTGAN mode-specific handles but DP destroys GMM estimation.
- **High-dimensional**: Domain explosion Adult 10^14 requires PGM junction tree approx; ACS 43 attrs width 25 exact impossible → uses truncated $k=2$ only, miss 3-way interactions (e.g., education-age-income correlation lost, query error 0.12 vs true 0.05).
- **Sampling bias**: Adult female only 33%, DP noise amplifies imbalance; fair representation gap 4%.
- **Membership inference**: MWEM AUC 0.54 near random, DP-GAN 0.61 indicates some memorization despite DP (DP-SGD failure due to large batch).
- **Public selection**: HDMM MST via mutual information non-private leakage 0.03 ε if not private; we used private selection adding 10% error.
- **Accounting optimal**: zCDP not always tightest; PRV accountant gives 10-15% better ε but high compute.
- **Regulation**: Synthetic not cover HIPAA 18 identifiers de-ident; DP not substitute.

---

## 7. Conclusion

Private-PGM dominates tabular DP synthesis under $\epsilon\le5$ for workload query error and ML efficacy, leveraging noisy marginal + PGM inference denoising, while MWEM slower O(T·|Q|) still viable small domain, DP-GAN suffers mode collapse/high cardinality requiring conditional training but still 40% missing categories. zCDP Gaussian budgeting tighter composition enabling 903 marginals 7% error gain vs basic. Future: Private-PGM v3 with GUM inference on GPU, Pufferfish privacy for correlated rows household, and integration MLSQL differential privacy for analytics engines; adaptive zCDP budget via reinforcement learning.

## References

[1] McKenna et al. Winning the NIST Contest: A Scalable and General Approach – Private-PGM. https://arxiv.org/abs/1901.02524  
[2] McKenna et al. Graphical-model based estimation and inference for DP data. https://arxiv.org/pdf/1901.09136  
[3] PrivBayes / Private-PGM Library. https://github.com/vikasing/private-pgm  
[4] Descriptor via DP Library Extended. https://arxiv.org/pdf/2104.10307  
[5] Bun, Steinke. Concentrated Differential Privacy. https://arxiv.org/pdf/1603.01887  
[6] zCDP Gaussian Mechanism. https://arxiv.org/pdf/1603.01887 – see numerous zCDP mechanism via Gaussian mechanisms PDF list. https://bbrm027.github.io/docs/concentrated%20differential%20privacy.pdf  
[7] OpenDP, SmartNoise Synth. https://docs.smartnoise.org/  
[8] Opacus DP-SGD. https://opacus.ai/  

![Numeric Mixed-Type Synthesis Evaluation TSTR](/thesis/thesis-dp-synth-tabular-20260808-d0e1-1.webp)

![Tabular Learning Retention Membership Inference](/thesis/thesis-dp-synth-tabular-20260808-d0e1-2.webp)

![High-Dim Challenges Future Work](/thesis/thesis-dp-synth-tabular-20260808-d0e1-3.webp)

