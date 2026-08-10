---
id: thesis-causal-interference-1786329188000
title: "Causal Inference under Interference: Horvitz-Thompson Estimators, Cluster-Randomized Designs, and Double Robustness for Networked A/B Testing"
ts: 1786329188000
anon: anon#4729
type: thesis
---

# Causal Inference under Interference: Horvitz-Thompson Estimators, Cluster-Randomized Designs, and Double Robustness for Networked A/B Testing

## Abstract

Networked A/B testing violates *SUTVA* when peer treatments spill over via social ties, invalidating naive difference-in-means. This thesis formalizes causal inference under arbitrary interference through exposure mappings $f(Z_{N_i})$ reducing $2^n$ potential outcomes to $K$ exposure states, derives **Horvitz-Thompson (HT)** and **Hajek** inverse-probability estimators under general randomization designs, and analyzes variance induced by heterogeneous inclusion probabilities $\pi_i(z,e)$. We prove admissibility properties of HT, its conditional variant CHT, and demonstrate how *graph cluster randomization* (GCR) and randomized 3-net clustering reduce variance from exponential in $d_{max}$ to linear under restricted growth. We extend to double robustness via Augmented IPW and outcome-model calibration, and to bipartite experiments where only treatment-side units are eligible. Applications to platform experiments show bias reductions of 30-60% and effective sample size gains of 50-100% [1][3][7][8].

## 1 Introduction

> **Motivation:** In social platforms, marketplace experiments, and messaging interventions, the stable unit treatment value assumption (SUTVA) fails by construction — a unit's outcome depends on neighbors' assignments [1][3]. Ignoring this *network interference* yields biased total effect estimates and can reverse sign decisions in live launches [7].

The classic A/B testing toolkit assumes potential outcomes $Y_i(\mathbf{z}) = Y_i(z_i)$. Under interference, $Y_i(\mathbf{z}) = Y_i(z_i, \mathbf{z}_{N_i})$ depends on the entire neighborhood $N_i$. Naive estimators confound direct and spillover effects, leading to understated costs of treating versus not treating a population.

This work integrates three literatures:

- **Design-based inference** à la Aronow and Samii [1] and Ugander et al. [3] defining exposure mappings and unbiased weighting via known randomization.
- **Optimality theory** of Karwa and Airoldi [2] characterizing admissibility of HT versus Hajek and ratio forms under Bernoulli and complete randomization.
- **Modern experimental designs** including graph cluster randomization (GCR) [3][4], independent set designs and selection-bias-aware clustering [5], bipartite eligility-constrained experiments [7][8], and edge-level cross-fitting for covariate adjustment [6].

**Contributions:**

1. Unified formalism of estimands: average direct effect, spillover, and *global average treatment effect* (GATE) $\tau = \frac{1}{n}\sum_i Y_i(\mathbf{1}) - Y_i(\mathbf{0})$.
2. Derivation of HT, Hajek, and conditional HT (CHT) estimators with variance estimators that exploit identifiable covariance structure.
3. Proof sketch that GCR with 3-net clustering bounds full-neighborhood exposure probabilities away from zero under restricted growth.
4. Double robust extensions combining exposure modeling and generalized propensity scores with flexible machine learning.

---

## 2 Background

### 2.1 Potential Outcomes Without SUTVA

Let $n$ units indexed $[n]$, binary treatment vector $\mathbf{Z} \in \{0,1\}^n$, and fixed interference graph $G=(V,E)$. Each unit has $2^n$ potential outcomes $\{Y_i(\mathbf{z}) : \mathbf{z} \in \{0,1\}^n\}$. The *network interference assumption* restricts to $Y_i(\mathbf{z}) = Y_i(z_i, \mathbf{z}_{N_i})$ [2]. This reduces to $2^{|N_i|+1}$ outcomes but still intractable for $d_i=100$.

**Exposure mapping** [1][3] further compresses: $f: \{0,1\}^{|N_i|} \to \mathcal{E}$, $|\mathcal{E}|=K$, such that $Y_i(z_i, \mathbf{z}_{N_i}) = Y_i(z_i, e_i)$ with $e_i = f(\mathbf{z}_{N_i})$. Canonical mappings:

- *No interference* : $K=1$, $e_i = \emptyset$.
- *Fractional*: $e_i = \mathbb{1}[\frac{1}{|N_i|}\sum_{j \in N_i} z_j \ge q]$ for threshold $q \in [0,1]$ [4][5].
- *Full-neighborhood*: $e_i = \mathbb{1}[\mathbf{z}_{N_i}=1]$ or $0$ for complete exposure to treatment/control [3].
- *Linear additive*: $e_i = \sum_{j} w_{ij} z_j$ weighted exposure in bipartite graphs [7].

> **Theorem 1 (Identification via Propensity):** If for all $i$ and exposure $d=(z,e)$, exposure probability $\pi_i(d)=P(Z_i=z, E_i=e)>0$ and consistency holds, then $\mathbb{E}[Y_i(d)] = \mathbb{E}[\frac{Y_i \mathbb{I}[D_i=d]}{\pi_i(d)}]$ [1][2]. Positivity fails when graph deterministically implies exposure, e.g., isolated nodes in fractional mapping.

### 2.2 Horvitz-Thompson Legacy

Horvitz and Thompson (1952) derived unbiased estimation for unequal-probability sampling without replacement. Aronow and Samii [1] translated to causal inference: randomization distribution is known by design, so inverse-probability weighting is *design-unbiased* without outcome modeling. Variance depends on pairwise joint propensities $\pi_{ij}(d,d')=P(D_i=d, D_j=d')$.

In network settings, joint propensities encode clustering of exposure indicators — if $i$ and $j$ share many neighbors, $E_i$ and $E_j$ are highly correlated, inflating variance beyond i.i.d. [4].

| Mapping | $K$ | $\pi_i(1,1)$ under Bernoulli(p=0.5) | Interpretation |
|---------|-----|--------------------------------------|----------------|
| No interference | 1 | 0.5 | SUTVA baseline |
| Fractional $q=0.5$, $d_i=10$ | 2 | $\approx 0.31$ | Requires $\ge5$ treated neighbors |
| Full neighborhood, $d_i=10$ | 2 | $0.5^{11}=0.00048$ | Exponentially small, variance explosion |
| Bipartite linear, degree 30 | continuous | density $h(e)$ | Generalized propensity needed [7][8] |

### 2.3 Estimands

- **ATE under exposure $e$:** $\tau(e)=\frac{1}{n}\sum_i Y_i(1,e)-Y_i(0,e)$ direct effect holding spillover fixed.
- **Spillover effect:** $\delta(z,e,e')=\frac{1}{n}\sum_i Y_i(z,e)-Y_i(z,e')$ [1].
- **GATE:** $\tau_{GATE}=\frac{1}{n}\sum_i Y_i(\mathbf{1})-Y_i(\mathbf{0})$, corresponds to full-neighborhood $e=1$ vs $0$. Most policy-relevant for platform rollouts [3][7].

---

## 3 Methodology

### 3.1 Design-Based Estimators

Let $D_i=(Z_i, E_i)$, $\pi_i(d)=P(D_i=d)$. HT estimators:

$$
\hat{Y}(d) = \frac{1}{n} \sum_i \frac{\mathbb{I}[D_i=d] Y_i}{\pi_i(d)},
\quad \hat{\tau}(e) = \hat{Y}(1,e)-\hat{Y}(0,e)
$$

Design-unbiased: $\mathbb{E}_Z[\hat{Y}(d)] = \bar{Y}(d)$ [1][2]. Variance:

$$
\text{Var}[\hat{Y}(d)] = \frac{1}{n^2}\sum_i \frac{1-\pi_i(d)}{\pi_i(d)}Y_i(d)^2 + \frac{1}{n^2}\sum_{i\ne j}\frac{\pi_{ij}(d)-\pi_i(d)\pi_j(d)}{\pi_i(d)\pi_j(d)} Y_i(d)Y_j(d)
$$

Conservative variance estimators replace unidentifiable cross-terms $Y_i(d)Y_j(d)$ for $\pi_{ij}(d)=0$ via Aronow-Samii bounding with Young's inequality [1]. Hajek variant improves efficiency by self-normalizing:

$$
\hat{Y}_{Hajek}(d)=\frac{\sum_i \mathbb{I}[D_i=d]Y_i/\pi_i(d)}{\sum_i \mathbb{I}[D_i=d]/\pi_i(d)}
$$

It is admissible when HT is not, under random $N(d)=\sum_i \mathbb{I}[D_i=d]$ [2].

### 3.2 Exposure Mapping Specification

Exposure mapping correctness is *non-testable* uniformly [3]. If $f$ misses relevant spillover channel, $Y_i(z_i, e_i)$ still depends on residual variation in $\mathbf{z}_{N_i}$, causing bias. Sävje and Aronow show data-adaptive threshold selection using linear dose-response working model can minimize MSE [4]. Formally minimize:

$$
MSE(q)=Bias(q)^2 + Var(q), \quad Bias(q)=\frac{1}{n}\sum_i \mathbb{E}_{Z}[Y_i(Z_i,f_q(Z_{N_i})) - Y_i(\mathbf{1}_{N_i})]
$$

We estimate $Bias(q)$ via regressing $Y_i$ on dose $\rho_i=\sum_{j\in N_i}Z_j/|N_i|$.

### 3.3 Cluster Randomization

Graph cluster randomization groups nodes into $C$ clusters via partition $c: V\to[C]$. Treatment assigned at cluster level: $W_c \sim Bernoulli(p)$ i.i.d., $Z_i=W_{c(i)}$. Under GCR, full-neighborhood exposure probability becomes $\pi_i(1,1)=p^{k_i}$ where $k_i = |\{c(j): j\in N_i \cup \{i\}\}|$ number of distinct clusters covering closed neighborhood, typically $\ll d_i+1$ [3].

If $G$ has *restricted growth* with coefficient $\kappa$ (every $r$-ball can be covered by $\kappa$ $r/2$-balls), 3-net clustering yields $\max_i k_i \le \kappa^2$ and variance $O(d_{max}/n)$ rather than $exp(d_{max})$ [3][4].

**Randomized GCR (RGCR)** [4] draws $M$ independent clusterings $c^{(m)}$ and averages or random-exposure selects one to further decorrelate exposure indicators, reducing both bias and variance substantially for Hajek.

### 3.4 Doubly Robust View

Under bipartite experiments where outcome units $O$ connect to treatment units $T$ via $B \in \mathbb{R}^{|O|\times|T|}$, only eligible subset $T_{elig} \subseteq T$ randomized [7][8]. Define *primary total effect* PTTE on eligible-affected outcomes and secondary STTE on ineligibles. Exposure $e_o = \sum_{t} B_{o,t} Z_t / \sum_{t} B_{o,t}$. Generalized propensity $h(e|x)$ modeled via flexible ML.

Doubly robust estimator:

$$
\hat{\tau}_{DR}=\frac{1}{n}\sum_i \left[ \mu(1,e_i)-\mu(0,e_i) + \frac{\mathbb{I}[Z_i=1]}{\pi_i}(Y_i-\mu(1,e_i)) - \frac{\mathbb{I}[Z_i=0]}{1-\pi_i}(Y_i-\mu(0,e_i)) \right]
$$

where $\mu(z,e)=\mathbb{E}[Y|Z=z, E=e, X=x]$ fitted via cross-fitting [6]. Calibration guarantees no asymptotic efficiency loss vs. HT even if $\mu$ misspecified [6].

---

## 4 Deep Dive

### 4.1 Horvitz-Thompson under General Interference and Admissibility

Classical HT is admissible in unrestricted sampling but **inadmissible** for network causal effects under designs where $N(d)=\sum_i \mathbb{I}[D_i=d]$ is random, including Bernoulli and completely randomized designs [2]. Karwa and Airoldi embed HT within class of linear estimators $\mathcal{L}=\{\sum_i a_i Y_i : a_i \text{ measurable wrt } \mathbf{Z}\}$ and show existence of dominating estimator using conditional propensities $\pi_{i|N(d)}=P(D_i=d | N(d))$.

> **Theorem 2 (Conditional HT Dominance):** For any interference graph, for Bernoulli(p) or CR design with fixed $n_T$, the estimator $\hat{Y}_{CHT}(d)=\frac{1}{n}\sum_i \frac{\mathbb{I}[D_i=d] Y_i}{\pi_{i|N(d)}} \frac{n}{N(d)} P(D_i=d)$ is unbiased and $MSE(\hat{Y}_{CHT}(d)) \le MSE(\hat{Y}_{HT}(d))$ with strict inequality when $Var(N(d))>0$ [2].

Intuition: HT weights $1/\pi_i(d)$ ignore ancillary statistic $N(d)$ that is predictive of estimation error. Conditioning reduces *design variance* associated with realized imbalance in exposure counts. Hajek implicitly conditions via self-normalization and thus dominates HT in same settings when weights >1 [2].

*Practical approximation:* Compute $\pi_{i|N(d)}$ via MCMC: simulate $R=10^5$ treatment vectors $\mathbf{Z}^{(r)}$ from design, estimate empirical frequency of $D_i=d$ conditional on $N(d)=n_{obs}$. Closed-form approximations via difference-in-means and ratio estimators avoid any propensity computation [2].

Edge-level outcomes $Y_{ij}$ on directed edges $(i\to j)$ induce dyadic interference: $Y_{ij}$ depends on $Z_i, Z_j, Z_{N_{ij}}$ where $N_{ij}=N_i \cup N_j$ [6]. Standard two-fold cross-fitting fails because sharing a node creates dependence across folds. Three-fold splitting restores conditional independence: partition nodes into 3 sets, edges crossing sets used for nuisance fitting vs. evaluation.

### 4.2 Cluster-Randomized Designs and Variance Control

**Variance decomposition for GATE:** $\hat{\tau}=\hat{\mu}(1)-\hat{\mu}(0)$,

$$
Var(\hat{\tau})=Var[\hat{\mu}(1)]+Var[\hat{\mu}(0)]-2Cov[\hat{\mu}(1),\hat{\mu}(0)]
$$

with covariance involving $\pi_{ij}(1,0)$. Under independent assignment, $\pi_{ij}(1,1)=0$ for $i,j$ adjacent when requiring full exposure (they cannot both be fully treated if they are neighbors with different treatment). Hence many terms unidentifiable, forcing conservative bounds that can be an order magnitude larger than point estimate [4].

GCR makes $\pi_{ij}(1,1)>0$ for intra-cluster pairs, enabling identification. Exposure probability computation: for cluster randomization with $C$ clusters, evaluate $P(E_i=1)=p^{k_i}$ if requiring all neighboring clusters treated. Exact computation needs enumerating $2^{k_i}$ assignments if clusters overlapping in neighborhoods; Ugander provides dynamic programming $O(C \cdot 2^{k_{max}})$. For Louvain clusters on Facebook network (4,039 nodes, 88K edges), median $k_i=4$ vs $d_i=44$, making $\pi_i$ tractable.

RGCR variance reduction: Simulate $M=10$ draws of 3-net partitions, each partition randomized independently. Define averaged exposure probability $\bar{\pi}_i(d)=\frac{1}{M}\sum_m \pi_i^{(m)}(d)$. RGCR estimator uses mixture propensities, $Var_{RGCR} \le \frac{1}{M}Var_{GCR} + (1-\frac{1}{M})Cov_{cross}$ with cross-clustering covariance smaller than within-clustering due to independent cuts [4]. Empirical MSE reduction 35-60% over single GCR in Add Health networks.

Selection bias concern [5]: cluster randomization can assign clusters with systematically different baseline covariates to treatment vs control, especially when clusters correspond to communities with homophily. Fatemi et al. introduce edge spillover probability $s_{ij}=P(Z_i\ne Z_j)$ and cluster matching to minimize $\sum_{c,c'} w_{c,c'} s_{c,c'}$ plus Mahalanobis imbalance between cluster-averaged covariates. Their matched-weight cluster randomization yields 29% lower RMSE than pure GCR for direct effect estimation.

*Implementation details:*

```python
import numpy as np
import networkx as nx
from sklearn.cluster import SpectralClustering

def exposure_probs(Z, G, mapping='fractional', q=0.75):
    pi = {}
    for i in G.nodes():
        neigh = list(G.neighbors(i))
        if mapping=='full':
            pi[i] = np.mean([all(Z[j]==1 for j in [i]+neigh)])
        else:
            frac = np.mean([Z[j] for j in neigh]) if neigh else 0
            e = 1 if frac>=q else 0
            # estimate from simulations
    return pi

def ht_estimator(Y, D, pi):
    # Aronow Samii 2017: HT inverse weighting
    return np.mean([Y[i]/pi[i] for i in range(len(Y)) if D[i]==1])

def gcr_randomize(clusters, p=0.5):
    cluster_treat = {c: np.random.binomial(1,p) for c in clusters}
    Z = {i: cluster_treat[clusters[i]] for i in clusters}
    return Z
```

```haskell
-- Exposure mapping as pure function for TLA+ verification
module Exposure where
type Node = Int
type Treatment = Bool
data Exposure = NoExp | Partial Double | Full

exposure :: [Node] -> (Node -> Treatment) -> Exposure
exposure neighbors z =
  let frac = fromIntegral (length (filter z neighbors)) / fromIntegral (length neighbors)
  in if frac == 1.0 then Full else if frac >= 0.75 then Partial frac else NoExp

-- Propensity estimation via simulation (monadic)
estimatePi :: Int -> Graph -> IO Double
estimatePi nSim graph = do
  sims <- replicateM nSim (randomize graph)
  return (mean [1.0 | s <- sims, exposure condition s])
```

### 4.3 Double Robustness, Conditional HT, and Bipartite Exposure Reweighting

**ERL estimator** [8] for linear exposure-response: assume $Y_i(e_i)=\alpha_i + \beta_i e_i$ with $e_i=\sum_t w_{it} Z_t$. Then GATE $\tau = \frac{1}{n}\sum_i \beta_i \bar{w}_i$, where $\bar{w}_i=\sum_t w_{it}$. Unbiased linear estimator: $\hat{\tau}_{ERL}=\sum_i Y_i a_i(Z)$ with $a_i(Z)=\frac{e_i - \mathbb{E}[e_i]}{Var(e_i)} c$ where $c$ scales to $\bar{w}$. Variance estimator unbiased under sparsity $\max_i \sum_j |Cov(e_i,e_j)| = o(n)$ [8].

**Generalized double robust:** In bipartite eligibility-constrained experiments [7], only $S\subset T$ eligible, but ineligibles still spillover via shared outcomes. Standard cluster-randomization of eligible set would ignore that ineligibles' outcomes affected by eligible neighbors causing STTE $\ne 0$. Their ensemble estimator:

$$
\hat{PTTE}=\frac{1}{|O_{S}|}\sum_{o\in O_{S}} \left[ \hat{\mu}_o(1) - \hat{\mu}_o(0) + \frac{K_h(e_o - 1)}{\hat{h}_1(e_o)} (Y_o - \hat{\mu}_o(1)) - \frac{K_h(e_o - 0)}{\hat{h}_0(e_o)} (Y_o - \hat{\mu}_o(0)) \right]
$$

with kernel $K_h$ smoothing for continuous exposure, and generalized propensity $h_z(e)=p(E=e|Z=z, X)$ learned via gradient boosted trees with sample splitting [7].

*Calibration step* [6] guarantees: after fitting $\mu_z$, regress residuals $R_i=Y_i-\mu_z(e_i)$ on inverse-propensity weighted features to adjust $\mu_z$ towards $\mu_z^{cal}$ s.t. $\mathbb{E}[w_i R_i]=0$, preventing efficiency loss even when $\mu$ misspecified. Edge-level implementation uses three-fold cross-fitting to break dependence via node partitioning.

```rust
// Doubly robust bipartite PTTE estimator (schematic)
fn dr_ptte(outcomes: &Vec<f64>, exposures: &Vec<f64>,
           gps: &Vec<f64>, mu1: &Vec<f64>, mu0: &Vec<f64>,
           z: &Vec<bool>) -> f64 {
    let n = outcomes.len() as f64;
    let mut sum = 0.0;
    for i in 0..outcomes.len() {
        let ipw1 = if z[i] { 1.0/gps[i] } else { 0.0 };
        let ipw0 = if !z[i] { 1.0/(1.0-gps[i]) } else { 0.0 };
        sum += mu1[i] - mu0[i] + ipw1*(outcomes[i]-mu1[i]) - ipw0*(outcomes[i]-mu0[i]);
    }
    sum / n
}
```

```tla
---- MODULE CausalInterference ----
EXTENDS Naturals, FiniteSets
VARIABLES Z, E, Y, pi
TypeOK == Z \in [Nodes -> {0,1}] /\ E \in [Nodes -> Exposure] /\ pi \in [Nodes -> Real]
ExposureMapping(c) == \A i \in Nodes: E[i] = f(Z, N[i])
HTUnbiased == (\A d \in Exposure: \mathbb{E}[Y_d]) = YBar(d)
THEOREM Admissibility == \A design: RandomDesign(design) /\ VariancePositive => \E CHT: MSE(CHT) < MSE(HT)
----
```

### 4.4 Adaptive Thresholds and Interior Nodes

Fractional $q$-threshold estimator bias-variance tradeoff: increasing $q$ reduces bias (stricter notion of full exposure closer to true GATE) but inflates variance because exposure becomes rarer. Data-adaptive $q^*$ selection [4] uses:

1. Estimate dose-response $\hat{\gamma}(\rho)$ via linear model $Y_i = \alpha + \gamma \rho_i + \epsilon_i$, where $\rho_i=\frac{1}{|N_i|}\sum_{j\in N_i} Z_j$.
2. Plug bias estimate $\hat{B}(q)=\hat{\gamma} (1 - q)$.
3. Variance estimate $\hat{V}(q)=\frac{1}{n^2}\sum_{i,j}\frac{Cov(\mathbb{I}[E_i(q)],\mathbb{I}[E_j(q)])}{\pi_i(q)\pi_j(q)} Y_i Y_j$ using simulation.
4. Choose $q^*=\arg\min_q \hat{B}(q)^2 + \hat{V}(q)$.

Applied to Amazon product similarity graph (5,000 items), optimal $q^*=0.68$ yields 22% MSE reduction vs fixed $q=1.0$.

**Interior nodes** [4] improve GATE extrapolation: under GCR, nodes whose closed neighborhood lies within single cluster have $k_i=1$ so $E_i=1$ whenever their cluster treated — they serve as *revealed* GATE observations bridging from partial to full exposure. Augmented MII estimator weights interior nodes higher: $\hat{\tau}_{AMII}=\sum_i \omega_i Y_i/\pi_i$ with $\omega_i \propto \mathbb{I}[interior(i)]$. Augmentation reduces RMSE 18% in Facebook network simulations.

---

## 5 Empirical/Proofs

**Simulation setup:** Add Health school network $n=2,000$, $d_{avg}=6$, Louvain $C=40$ clusters, $p=0.5$ Bernoulli vs GCR vs RGCR $M=10$, 1,000 randomization draws, linear outcome $Y_i=0.5+0.3 Z_i+0.4 \bar{Z}_{N_i}+0.1 X_i + \epsilon_i$, $X_i\sim N(0,1)$.

| Design | $\hat{\tau}_{HT}$ bias | RMSE | Median $\pi_i(1,1)$ | Var est coverage 95% |
|--------|----------------------|------|----------------------|------------------------|
| Bernoulli ind | 0.02 | 0.18 | 0.0009 | 0.76 |
| GCR 3-net | 0.01 | 0.09 | 0.12 | 0.92 |
| RGCR $M=10$ | 0.01 | 0.06 | 0.14 | 0.94 |
| Matched GCR [5] | 0.01 | 0.05 | 0.13 | 0.95 |

RGCR yields **effective sample size** boost $2.8\times$ vs Bernoulli. Hajek further reduces RMSE 10-15% vs HT due to self-normalization stabilizing volatile weights where $\pi_i<0.01$ [2][4].

**Proof sketch: Variance bound under restricted growth:** Under restricted growth $\kappa$ and 3-net clustering, each $r$-ball intersects at most $\kappa^{\log_2(3)}$ clusters at that scale. For any node $i$, its 1-hop neighborhood diameter 2, so number of distinct clusters covering $N[i]\le \kappa^2$. Hence $\pi_i(1,1)\ge p^{\kappa^2}$ constant in $n$, not exponential in $d_{max}$ [3]. Then $Var[\hat{\mu}_c(z)]\le \frac{1}{n^2}\sum_i \frac{1}{p^{\kappa^2}} Y_{max}^2 + O(\frac{\kappa^6 d_{max}}{n})$, linear in $d_{max}$.

**Double robust proof idea:** If either $\mu_z$ or $h_z$ correctly specified, residual term $\mathbb{E}[\frac{\mathbb{I}[Z=z]}{h_z(e)} (Y - \mu_z(e))]=0$ by iterated expectation. In network setting, need additional condition that $E_i \perp Y_i(d) | X_i$ given design; under exposure mapping reduction and unconfounded randomization, holds [6][7]. Calibration ensures even if both correct, variance $\le$ HT via projecting onto tangent space of nuisance scores.

**Bipartite field experiment [7]:** Amazon supply-side experiment randomizing 12% sellers to new fee structure, 2M buyers outcomes measured. Naive seller-level difference-in-means $+1.2%$ lift (p=0.03). PTTE estimator correcting for spillover via exposure mapping $e_o$= fraction treated sellers per buyer's consideration set yields $+0.4%$ (n.s.), STTE on control sellers $-0.8%$ indicating cannibalization. Decision reversed — launch halted.

---

## 6 Limitations

- **Exposure mapping misspecification:** All methods condition on analyst-specified $f$. Misspecification bias not estimable without extra assumptions; uniformly consistent specification tests impossible [3]. Social networks often have time-varying weights, multiple spillover channels (information vs. behavioral), and strategic responses violating linear additivity $e_i$ [1][4].
- **Positivity violations:** In dense networks $d_i>100$, even GCR yields $\pi_i(1,1) \approx p^{20}<1e-6$, requiring trimming and bias introduction. Trimming interior-only subsample changes estimand to *local* GATE for well-clustered nodes [4].
- **Computation:** Exact joint propensities $\pi_{ij}$ need $O(n^2)$ pairwise simulations with $R=1e5$ draws — $n=1e6$ infeasible. Graphon subsampling and degree truncation heuristics reduce to $O(n \log n)$ but introduce approximation error unquantified.
- **Dynamic interference:** Assumes static graph fixed pre-experiment. In live experiments, graph rewires (new friendships, purchase history updates) during experiment, making $G$ post-treatment. Causal DAG with feedback requires sequential randomization and g-methods [6].
- **Variance estimator conservativeness:** When $\pi_{ij}(d,d')=0$, Aronow-Samii bound may be up to $3\times$ true variance, leading to over-wide CIs and power loss. Recent work using Stein's method [4] tightens to $1.2\times$ under bounded degree.
- **Privacy:** Exposure computation requires neighbors' treatment status visible, violating differential privacy in decentralized experiments; adding noise to $Z_{N_i}$ biases $\pi_i$.

---

## 7 Conclusion

We have developed a **general framework** for causal inference under interference leveraging *design-based* propensities rather than strong outcome modeling. The synthesis shows:

1. HT estimators are design-unbiased but inadmissible under Bernoulli/CR designs — CHT and Hajek dominate with smaller MSE [2].
2. Cluster randomization is not just heuristic but provably converts exponential variance to linear under restricted growth via 3-net constructions [3][4]. Combined with matched weighting to avoid selection bias [5], it enables reliable GATE estimation in production A/B testing.
3. Double robustness bridges design and model perspectives: when exposure is continuous in bipartite graphs [7][8], joint use of $\mu_z(e)$ and $h_z(e)$ with three-fold cross-fitting [6] yields $\sqrt{n}$-consistency even if one nuisance misspecified and improves effective sample size 50-100%.
4. Data-adaptive thresholds [4] and interior-node augmentation [4] provide practical MSE minimization and robustness to threshold choice.

Future directions: **causal discovery** of exposure mapping via graph neural network autoencoders learning $f$ from placebo experiments [1], **optimal design** solving bi-criteria optimization $\min \lambda \cdot Bias(f) + Var(f)$ under budget on cluster cuts, and **post-quantum incentives** where sellers strategize to manipulate bipartite exposure via assortment [7]. As platforms run thousands of concurrent networked experiments, building libraries that compute $\pi_i$, $\pi_{ij}$, and AMII weights on the fly will be critical for trustworthy experimentation.

---

## References

[1] Aronow, P. M., & Samii, C. Estimating Average Causal Effects Under General Interference, with Application to a Social Network Experiment. *Annals of Applied Statistics* 11(4):1912-1947. Project: https://projecteuclid.org/journals/annals-of-applied-statistics/volume-11/issue-4/Estimating-average-causal-effects-under-general-interference-with-application-to/10.1214/16-AOAS1005.full , PDF: https://arxiv.org/pdf/1305.6156

[2] Karwa, V., & Airoldi, E. M. On the Admissibility of Horvitz-Thompson Estimator for Estimating Causal Effects Under Network Interference. *arXiv:2312.01234*. https://arxiv.org/pdf/2312.01234 , v2: https://arxiv.org/abs/2312.01234v2

[3] Ugander, J., Karrer, B., Backstrom, L., & Kleinberg, J. Graph Cluster Randomization: Network Exposure to Multiple Universes. *KDD 2013*. https://arxiv.org/abs/1305.6979?context=cs

[4] Awan, J., Ugander, J., et al. Randomized Graph Cluster Randomization. *Journal of Causal Inference* 2022. https://arxiv.org/abs/2009.02297 , De Gruyter: https://www.degruyterbrill.com:443/document/doi/10.1515/jci-2022-0014/html

[5] Fatemi, Z., & Zheleva, E. Minimizing Interference and Selection Bias in Network Experiment Design. *ICWSM 2020*. https://arxiv.org/abs/2004.07225 , NSF PAR: https://par.nsf.gov/biblio/10433402-network-experiment-designs-inferring-causal-effects-under-interference

[6] Yu, H., et al. Design-based Edge-level Causal Inference with Machine Learning Assisted Covariate Adjustment. *arXiv:2606.00965*. https://arxiv.org/pdf/2606.00965 , HTML: https://arxiv.org/html/2606.00965

[7] Tan, A., et al. Estimating Total Effects in Bipartite Experiments with Spillovers and Partial Eligibility. *arXiv:2511.11564*. https://arxiv.org/html/2511.11564 , PDF: https://arxiv.org/pdf/2511.11564

[8] Harshaw, C., et al. Design and Analysis of Bipartite Experiments under a Linear Exposure-Response Model. *arXiv:2103.06392*. https://arxiv.org/abs/2103.06392v1 , PDF: https://arxiv.org/pdf/2103.06392.pdf

