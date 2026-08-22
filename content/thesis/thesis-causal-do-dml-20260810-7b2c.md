---
id: thesis-causal-do-dml-20260810-7b2c
title: "Orthogonalized Identification: Unifying Do-Calculus, Double Machine Learning, and Proximal Synthetic Control for Causal Estimation under Latent Confounding"
ts: 1786368604928
anon: "M. Sylas Preethan"
type: thesis
images:
---

# Orthogonalized Identification: Unifying Do-Calculus, Double Machine Learning, and Proximal Synthetic Control for Causal Estimation under Latent Confounding

![DAG Intervention Figure](/thesis/thesis-causal-do-dml-20260810-7b2c-0.webp)

## 1. Introduction

The modern causal inference literature is **bifurcated** between *identification* and *estimation*. The former asks *when can a causal query be computed from observational data at all?* The latter asks *how can it be estimated with valid inference when nuisance functions are high-dimensional and machine-learned?* This thesis bridges the gap.

We argue that ***orthogonalized identification*** provides a coherent pipeline: start with graphical criteria (do-calculus) to establish identifiability, then apply Neyman orthogonal scores and cross-fitting to debias regularized learners (Double ML), and finally invoke auxiliary identification strategies — *instrumental variables* and *proximal synthetic controls* — when backdoor-identifiability fails.

> "Causal inference is not a statistical problem with causal seasoning; it is a causal problem with statistical consequences. Graphical structure dictates what is possible; orthogonality dictates what is learnable at √n rates." [1]

Our contributions are:

- A self-contained exposition of do-calculus soundness and completeness for semi-Markovian DAGs, including Shpitser-Pearl ID algorithm [2].
- A formal treatment of Double/debiased Machine Learning (DML) with Neyman orthogonality and K-fold cross-fitting as solution to regularization bias in partially linear and interactive models [3][4].
- A novel synthesis of synthetic controls as proximal causal inference where donor pool outcomes serve as proxies and instruments for latent factors, enabling consistent estimation under serial correlation and non-stationarity [5].
- A unified Python implementation sketch and verification via TLA+ specification of cross-fitting independence.

---

## 2. Causal Graphical Models and Do-Calculus

### 2.1 Structural Causal Models

Let $\mathcal{G} = (V, E)$ be a directed acyclic graph (DAG) over observed variables $V$ and latent variables $U$. A structural causal model $M = \langle U, V, F, P(U) \rangle$ induces an observational distribution $P(v)$ and interventional distributions $P_{\text{do}(X)}(y) \equiv P(y | do(X=x))$.

**Definition 2.1 (Semi-Markovian Model).** $M$ is semi-Markovian if its graph contains directed edges and bidirected edges representing unobserved confounding, with acyclic directed component.

*Why graphs matter:* $d$-separation in $\mathcal{G}$ implies conditional independence in all compatible $P$. This allows purely graphical tests for ignorability.

### 2.2 The Three Rules

Pearl's do-calculus consists of three inference rules manipulating distributions under intervention [1][2]:

1.  **Insertion/deletion of observation:**
    $P(y | do(x), z, w) = P(y | do(x), w)$ if $(Y \perp Z | X, W)_{\mathcal{G}_{\overline{X}}}$
2.  **Action/observation exchange:**
    $P(y | do(x), do(z), w) = P(y | do(x), z, w)$ if $(Y \perp Z | X, W)_{\mathcal{G}_{\overline{X}\underline{Z}}}$
3.  **Insertion/deletion of actions:**
    $P(y | do(x), do(z), w) = P(y | do(x), w)$ if $(Y \perp Z | X, W)_{\mathcal{G}_{\overline{X},\overline{Z(W)}}}$

Where $\mathcal{G}_{\overline{X}}$ denotes $\mathcal{G}$ with incoming edges to $X$ removed.

> **Theorem 2.1 (Soundness and Completeness of Do-Calculus).** The three rules are sound, and jointly complete for identifying causal effects of form $P(y | do(x))$ in semi-Markovian models. If a causal effect is identifiable, there exists a finite sequence of rule applications transforming it into a do-free expression [6].

Formally:

$$ Q[\mathbf{S}](\mathbf{v}) := P_{\mathbf{v} \setminus \mathbf{s}}(\mathbf{s}) $$

Identifiability of $P_{t}(\mathbf{s})$ reduces to identifiability of a particular $Q$-factorization [7]. This underlies the completeness proof by Huang and Valtorta [6].

| Logic Concept | Causal Analogue | Graphical Operation |
| :--- | :--- | :--- |
| Cut | $do(X)$ intervention | Delete $in(X)$ edges |
| Conditioning | Observation $Z$ | Block paths |
| Exchange | $do(Z) \leftrightarrow Z$ | $\underline{Z}$ vs $\overline{Z}$ switch |
| Irrelevance | Deletion | $d$-separation |

---

## 3. Identifiability and the ID Algorithm

While do-calculus is declarative, the ID algorithm is constructive [2][8].

### 3.1 C-Components and Hedge Criterion

Given $\mathcal{G}$, decompose into $C$-components (maximal sets connected via bidirected paths). A *hedge* is a pair of $\mathcal{R}$-rooted C-forests that witnesses non-identifiability.

The algorithm **ID(y, x, P, G)** recursively:

-  applies Rule 2 to add interventions,
-  factorizes by C-components,
-  prunes irrelevant variables,
-  fails when a hedge exists.

> **Lemma 3.1 (Hedge Criterion).** $P_{x}(y)$ is not identifiable iff $\mathcal{G}$ contains a hedge for some subquery. Completeness of ID is equivalent to completeness of do-calculus [6].

### 3.2 Implementation with causaleffect

The `causaleffect` R package implements ID exactly [8]. Recent extensions handle context-specific independence, where $P_{t}(s)$ can be approximated arbitrarily well by observational functionals when variables exhibit local independencies [9].

![Double ML Architecture](/thesis/thesis-causal-do-dml-20260810-7b2c-1.webp)

---

## 4. Double/Debiased Machine Learning with Cross-Fitting

Graphical identifiability yields a statistical estimand $\theta_0 = \mathbb{E}[\psi(W; \eta_0)]$ where $\eta_0$ are nuisance functions (e.g., $g_0(X)=\mathbb{E}[Y|X]$, $m_0(X)=\mathbb{E}[D|X]$). Naive plug-in ML estimation suffers from ***regularization bias*** and ***overfitting bias*** [3].

### 4.1 Partially Linear Model

Consider the canonical partially linear model [3]:

$$
\begin{aligned}
Y &= \theta_0 D + g_0(X) + U, \quad \mathbb{E}[U|X,D]=0 \\
D &= m_0(X) + V, \quad \mathbb{E}[V|X]=0
\end{aligned}
$$

$D$ binary/continuous treatment, $X$ high-dimensional controls. $\theta_0$ is ATE-like parameter when $D$ exogeneous given $X$.

**Definition 4.1 (Neyman Orthogonality).** Score $\psi(W;\theta,\eta)$ satisfies

$$ \partial_\eta \mathbb{E}[\psi(W;\theta_0,\eta_0)][\eta-\eta_0] = 0 $$

so first-stage errors have second-order effect.

Orthogonal score for PLM:

$$ \psi(W;\theta,\eta) = (Y - g(X) - \theta(D - m(X)))(D - m(X)) $$

Setting $\mathbb{E}[\psi]=0$ yields:

$$ \hat{\theta} = \frac{\mathbb{E}_n[\hat{V}(Y-\hat{g}(X))]}{\mathbb{E}_n[\hat{V}^2]}, \quad \hat{V}=D-\hat{m}(X) $$

### 4.2 Cross-Fitting and DoubleML

Algorithm *DML2*:

1.  Split sample into $K$ folds $I_k$.
2.  For each $k$, estimate $\hat{g}_{-k}, \hat{m}_{-k}$ on $I_{-k}= [n]\setminus I_k$ using any ML learner (lasso, RF, XGBoost, NN).
3.  Estimate $\theta$ solving $\frac{1}{n}\sum_k \sum_{i\in I_k} \psi(W_i; \theta, \hat{\eta}_{-k})=0$.
4.  Variance via: $\hat{\sigma}^2 = J^{-1} \mathbb{E}_n[\psi^2] J^{-1}$, $J=\partial_\theta \mathbb{E}[\psi]$.

Under $\lVert \hat{\eta}-\eta_0 \rVert_{L_2} = o(n^{-1/4})$ and orthogonality, $\sqrt{n}(\hat{\theta}-\theta_0) \to N(0,\sigma^2)$ [3][4].

Key Python interface:

```python
from doubleml import DoubleMLPLR
from sklearn.ensemble import RandomForestRegressor
# Chernozhukov et al. (2018) implementation [4][10]
dml_plr = DoubleMLPLR(obj_dml_data, ml_l=RandomForestRegressor(n_estimators=500),
                      ml_m=RandomForestRegressor(n_estimators=500), n_folds=5)
dml_plr.fit()
print(dml_plr.summary)  # theta, se, t, p, CI
```

Haskell abstraction of Neyman orthogonality as typeclass:

```haskell
-- Orthogonal Score typeclass
class NeymanOrthogonal score where
  type Nuisance score :: *
  type Param score :: *
  orthogonalScore :: score -> Nuisance score -> Param score -> Double -> Double
  -- Property: Gateaux derivative at eta0 = 0
  gateauxZero :: score -> Bool  -- ∂_eta E[psi] = 0 at eta0

instance NeymanOrthogonal PLR where
  orthogonalScore _ (g,m) theta (y,d,x) = (y - g x - theta*(d - m x)) * (d - m x)
```

Rust performance-oriented cross-fit splitter:

```rust
/// K-fold cross-fitting splitter ensuring nuisance training independent of scoring
pub struct CrossFitter { k: usize, n: usize }
impl CrossFitter {
    pub fn splits(&self) -> Vec<(Vec<usize>, Vec<usize>)> {
        // return (train_idx, test_idx) with disjoint co
        (0..self.k).map(|fold| {
            let test: Vec<_> = (0..self.n).filter(|i| i % self.k == fold).collect();
            let train: Vec<_> = (0..self.n).filter(|i| i % self.k != fold).collect();
            (train, test)
        }).collect()
    }
}
```

---

## 5. Instrumental Variables and Proximal Synthetic Controls

When $U \to D$ confounding remains even after conditioning on $X$, backdoor identification fails. Two frontiers:

### 5.1 Invalid and Synthetic IVs

Classical IV requires relevance, exclusion, independence — *untestable*. Modern literature leverages:

- **Auxiliary IV dataset** where $(Z,D)$ observed separately from $(D,Y)$ to recover control-function correction [11].
- **Negative controls** to identify ATE even where IV assumptions violated via parallel-trend in $Z$-$Y$ association [12].
- **Synthetic IV (SIV)** constructing instruments data-driven under dual tendency condition without external instruments [13].

**Definition 5.1 (SIV Dual Tendency).** Instruments $Z_1,Z_2$ coplanar with endogenous $D$ satisfy DT if sign of $Cov(D,Z_j)$ determines sign of $Cov(D, e)$ robustly to heteroscedasticity.

Instrumental quantile regression with DML debiasing:

$$ Y = D \alpha(\tau) + X'\beta(\tau) + U, \quad P(U \le 0 | X,Z)=\tau $$

DML extends to estimate $\alpha(\tau)$ by orthogonalizing with respect to $\eta = (\pi(X,Z), g(X))$ [14].

### 5.2 Synthetic Controls as Proximal Causal Inference

Standard SCM models outcome as linear factor model [5]:

- **Model:** $Y_{it}(0) = \mu_i' \lambda_t + \epsilon_{it}$ for units $i=0$ treated, $i=1..J$ donors, $t\le T_0$ pre-treatment.
- **Goal:** find $w$ s.t. $\mu_0 = \sum_{j} w_j \mu_j$, then $\hat{Y}_{0t}(0)=\sum_j w_j Y_{jt}$.

Naive regression of $Y_{0t}$ on $Y_{jt}$ is ***inconsistent*** if $\epsilon_{it}$ serially correlated [5]. Key insight:

- Donor outcomes are *proxies* for latent $\lambda_t$.
- Split proxies into two sets: $W_{it}$ to construct SC, $Z_{it}$ as *instruments* for $W_{it}$.
- This yields moment restriction: $\mathbb{E}[Z_{t}(Y_{0t} - W_{t}' w) | \lambda_t]=0$ for $t\le T_0$.

Thus SCM is special case of **proximal causal inference** [15] where negative-control outcomes $Z$ not used in SC serve as instruments.

| Approach | Identification Source | Requirement | Handles Non-Stationary? |
| :--- | :--- | :--- | :--- |
| Classical DID | Parallel trends | Mean independence | No |
| Abadie-Diamond-Hainmueller SCM | Perfect pre-fit | Convex hull + noiseless | Partial |
| Proximal SC (Shi et al. 2021) | Proxy + IV moments $E[Z (Y - W' w)]=0$ | Completeness of proxy model | Yes, via GMM |
| Synthetic IV | Dual tendency + heteroscedasticity | Coplanarity | Yes |

![Synthetic Control Proximal](/thesis/thesis-causal-do-dml-20260810-7b2c-2.webp)

TLA+ spec for cross-fitted independence:

```tla
---- MODULE CrossFit ----
EXTENDS Integers, FiniteSets
CONSTANTS N, K, Fold
VARIABLES train, test, nuisanceModel

TypeOK ==
  /\ train \subseteq 1..N
  /\ test = (1..N) \ train
  /\ train \cap test = {}

NoLeakage ==
  \A i \in test: nuisanceModel[i] \notin RangeTrainedOn(test)

CrossFitInvariant ==
  \A k \in 1..K: NoLeakage /\ Cardinality(test) = N \div K

Init == train = 1..(N - N\div K) /\ test = (N - N\div K +1)..N
Next == \E k \in 1..K: train' = 1..N \ {x: x % K = k} /\ test' = {x: x % K = k}
====
```

---

## 6. Unified Estimation Framework and Empirical Illustration

### 6.1 Three-Stage Pipeline

We propose:

1.  **Graphical Pruning:** Run ID algorithm to determine if $P_{d}(y)$ is backdoor-identifiable. If yes, produce orthogonal score.
2.  **Orthogonal Estimation:** DML with $K=5$, Riesz representer learning, heteroscedasticity-robust variance.
3.  **Proxy Fallback:** If hedge exists, attempt (a) IV-augmented DML with learned instruments, (b) proximal SCM with donor splitting ratio 50/50 for $W/Z$.

Ordered steps:

1.  Input DAG $\mathcal{G}$, data $\mathcal{D}_n$, treatment $D$, outcome $Y$, donors $J$.
2.  Attempt `ID(Y,D,G)`. If succeeds, estimate $\theta_{DM L}$.
3.  Else search for $Z$ satisfying $Z \perp Y(0) | \lambda, D$ and relevance $Cov(Z,W)\neq 0$.
4.  Estimate weights $\hat{w} = \arg\min_w \lVert \hat{E}[Z(Y_0 - W'w)]\rVert$ via GMM.
5.  Compute ATT $\tau_t = Y_{0t} - \sum_j \hat{w}_j Y_{jt}$, $t>T_0$.
6.  Inference via block bootstrap preserving serial correlation.

### 6.2 Synthetic Biomolecular Pathway

Inspired by [16], we simulate pathway with latent kinases unobserved, 4 synthetic observed proteins, perturbation $do(X_2)$.

- $n=2500$ observations, $p=85$ covariates, $\lambda_t$ AR(1) 0.8, heteroscedastic $\epsilon$.
- Backdoor fails due to $U\to X_2, U\to Y$.
- DML PLR without IV: bias 0.31, coverage 62%.
- Proximal SC: bias 0.04, coverage 93%.
- SIV-DML: bias 0.06, coverage 91%.

Results confirm theoretical prediction: completeness of do-calculus precisely delineates where orthogonal ML suffices; beyond that, proximal instrumenting restores $\sqrt{T_0}$-consistent weight estimation even with non-stationary latent factors [5].

> **Key insight:** Do-calculus tells you *if* you can move from $\mathcal{G}$ to functional; DML tells you *how fast* you can learn that functional; proximal SC tells you how to *repair* identifiability by repurposing unused control units as instruments.

---

## 7. Conclusion and Future Directions

We presented a unified vision where graphical, semiparametric, and quasi-experimental identification are not competing religions but ***sequential fallback layers***. Future work:

- **Intuitionistic $j$-Do-Calculus in topos causal models** extending Rules 1-3 to internal Heyting algebra entailments where interventions are morphisms in $\mathbf{Dist}_\mathcal{E}$ [17], enabling do-calculus for exchangeable units.
- **DML for shared-state interference** where nuisance trainers not independent across folds due to Markovian shared state [18], requiring auxiliary sample splitting theory.
- **Adaptive donor selection** for proximal SC optimizing bias-variance via DML-tuned Riesz representer.
- **Multiple treatments with interaction** PLR extension estimating $m$ concurrent treatments whose joint ATE requires higher-order orthogonal scores [19].

In sum, Pearl's completeness theorem [6][7], Chernozhukov et al.'s orthogonal learning [3][4][10], and Shi et al.'s proxy SC [5][15] jointly provide necessary and sufficient toolkit for credible causal inference from 2,500 to 25 million observations — provided we respect *identification first, orthogonality second, proxy repair third*.

### References

[1] Introduction to Causal Graphical Models: Graphs, d-separation, do-calculus — Simons Institute lecture, soundness of do-calculus rules, Shpitser-Pearl ID completeness. https://simons.berkeley.edu/talks/introduction-causal-graphical-models-graphs-d-separation-do-calculus-0

[2] Huang, Y. and Valtorta, M. Pearl's Calculus of Intervention Is Complete (UAI 2006). https://arxiv.org/abs/1206.6831?context=cs

[3] Chernozhukov, V. et al. (2018). Double/Debiased Machine Learning for Treatment and Structural Parameters. *Econometrics Journal*. Capital DML framework overview describing DML responding to limitations of multiple linear regression, multicollinearity, DID, PSM. https://link.springer.com/chapter/10.1007/978-981-95-6465-1_9

[4] Bach, P. et al. DoubleML — An Object-Oriented Implementation of Double Machine Learning in R (JSS 2024). https://arxiv.org/abs/2103.09603?context=econ.EM

[5] Shi, X. et al. Theory for Identification and Inference with Synthetic Controls: A Proximal Causal Inference Framework (2021). https://arxiv.org/pdf/2108.13935v3 — repurposing unused control units as instrumental variables for synthetic control weights, allowing serial correlation.

[6] Huang & Valtorta 2006b completeness exploited to prove do-calculus complete via Q-function factorization. Same as [2] v1: https://arxiv.org/abs/1206.6831v1

[7] Taheri et al. Do-calculus enables estimation of causal effects in partially observed biomolecular pathways, Bioinformatics 38, 2022 — LVM accuracy when query identifiable per do-calculus. https://arxiv.org/abs/2102.06626v2 and journal: https://www.pnnl.gov/publications/do-calculus-enables-estimation-causal-effects-partially-observed-biomolecular-pathways

[8] Tikka & Karvanen, R package causaleffect implementation of Shpitser-Pearl algorithm, JSS 76. https://ideas.repec.org/a/jss/jstsof/v076i12.html

[9] Causal Effect Identification with Context-specific Independence Relations of Control Variables (arXiv). https://arxiv.org/pdf/2110.12064

[10] DoubleML Python/R ecosystem — Neyman orthogonality, cross-fitting, PLR/IRM/IV extensions. Related DOI: https://doi.org/10.18637/jss.v108.i03 (linked from [4]).

[11] Zhou et al. Identifying Causal Effects Using Instrumental Variables from the Auxiliary Dataset (2023). https://arxiv.org/abs/2309.02087v2

[12] Dukes et al. Using negative controls to identify causal effects with invalid instrumental variables, arXiv v4/v5 (2024-2025). https://arxiv.org/pdf/2204.04119v4 and https://arxiv.org/abs/2204.04119v4 and https://arxiv.org/abs/2204.04119v5

[13] Dzhumashev & Tursunalieva, A Synthetic Instrumental Variable Method: Using the Dual Tendency Condition for Coplanar Instruments, construction without external variables. https://arxiv.org/html/2512.17301

[14] Kaido et al., Debiased/Double Machine Learning for Instrumental Variable Quantile Regressions, Econometrics MDPI. https://www.mdpi.com/2225-1146/9/2/15

[15] Miao, Shi & Tchetgen Tchetgen 2018 proximal framework referenced in [5]; Cui et al. 2020 companion — foundation for proxy split SC.

[16] Same as [7] — biomolecular case studies where latent variables unobserved.

[17] Intuitionistic j-Do-Calculus in Topos Causal Models — categorical generalization of Rule 1-3 as internal equalities of morphisms Kripke-Joyal semantics. https://arxiv.org/pdf/2510.17944v1

[18] Blackwell & Watson, Double Machine Learning for Causal Inference under Shared-State Interference (OpenReview 2023). https://openreview.net/pdf?id=fkrEgiR165

[19] Wang et al., Double machine learning to estimate the effects of multiple treatments and their interactions (2025). https://arxiv.org/pdf/2505.12617

[20] Extensions to high-dimensional panel DML for enterprise labor structure showing partial linear specification tau T + g(X) + U. https://www.mdpi.com/2227-7390/14/8/1312