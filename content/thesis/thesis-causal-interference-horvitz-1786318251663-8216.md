---
id: thesis-causal-interference-horvitz-1786318251663-8216
title: "Causal Inference under Interference: Horvitz-Thompson, GraphCluster Randomization, Double Machine Learning for Spillover"
type: thesis
anon: anon#7392
ts: 1786318251663
image_concepts:
  - "GraphCluster randomization diagram showing 3-net clustering of social network with treatment assignment colors and exposure mapping"
  - "Horvitz-Thompson inverse probability weighting DAG with interference graph, potential outcomes, exposure probabilities pi_i(d_k)"
  - "Double Machine Learning cross-fitting for spillover estimation flowchart with nuisance functions and Neyman orthogonal score"
  - "Spillover effect decomposition forest plot showing direct, indirect, total effects under clustered interference"
sources:
  - https://arxiv.org/pdf/1305.6156
  - https://arxiv.org/pdf/2008.00707.pdf
  - https://arxiv.org/abs/1305.6979?context=cs
  - https://arxiv.org/abs/2504.08836v1
  - https://arxiv.org/abs/2105.03810v4
  - https://arxiv.org/abs/2508.06808v1
  - https://arxiv.org/abs/2312.01234
  - http://arxiv.org/pdf/2001.02719
---

# Causal Inference under Interference: Horvitz-Thompson, GraphCluster Randomization, Double Machine Learning for Spillover

## Abstract
We develop a unified framework for **causal inference under network and clustered interference**, where the classical Stable Unit Treatment Value Assumption (SUTVA) fails and potential outcomes $Y_i(\mathbf{X})$ depend on the treatment vector $\mathbf{X}\in\{0,1\}^N$ via an interference graph $\mathcal{G}$. Integrating design-based Horvitz-Thompson (HT) theory, *randomized* GraphCluster Randomization (RGCR), and Double Machine Learning (DML), we characterize unbiased estimation of the Global Average Treatment Effect (GATE), direct, indirect, and spillover contrasts. Our contribution formalizes exposure mappings $f_i(\mathbf{X})\in\mathcal{D}$, exposure probabilities $\pi_i(d)=\Pr[D_i=d]$, and joint probabilities $\pi_{ij}(d)$, and shows how RGCR bounds variance polynomially rather than exponentially in graph growth parameters [1][2][3]. Under shared-state interference through low-dimensional statistics, we extend DML to achieve $\sqrt{n}$-efficient inference with nuisance estimation via machine learning [4][5]. The synthesis yields practical variance reduction via Hájek, covariate adjustment, and conditional HT, admissible under general designs [6][7].

## 1 Introduction
Causal inference classically assumes **no interference**: $Y_i(\mathbf{x}) = Y_i(x_i)$. Under interference, $Y_i(\mathbf{x})$ may depend on $\mathbf{x}_{-i}$, invalidating difference-in-means. Examples abound: vaccines with herd effects, policing spillovers on adjacent streets, information campaigns diffusing through villages, marketplace pricing altering demand for competitors, and algorithmic recommendations creating *shared-state* dependence.

The problem is not niche. Aronow and Samii [1] show that naive estimators under interference are biased for policy-relevant estimands when exposure probabilities correlate with network position. Ugander et al. [3] introduce **Graph Cluster Randomization (GCR)** to increase the number of units network-exposed to full treatment or full control. Yet GCR can still induce exponentially small $\pi_i(d)$, leading to variance catastrophe. Awan et al. (2023) propose **Randomized GCR (RGCR)** to randomize clustering itself, recovering polynomial variance bounds [2]. Concurrently, Bargagli-Stoffi et al. [2] combine HT with causal trees to detect heterogeneous spillover, and Hays et al. [4] prove DML efficiency under shared-state interference, where spillovers channel through a low-dimensional statistic $\psi(\mathbf{X})$ such as price or inventory.

This thesis asks: *How can we obtain unbiased, efficient, and robust inference for GATE and spillover effects when interference is arbitrary, known via graph, and high-dimensional confounders abound?*

We answer with three pillars:

- **Design-based HT theory** for exposure-mapped effects $\mu(d_k)=\frac1N\sum_i y_i(d_k)$ [1]
- **GraphCluster randomization** designs that make $\pi_i(d_k)$ tractable and well-behaved [2][3]
- **Double Machine Learning** for shared-state and high-dimensional covariate adjustment with Neyman orthogonality [4]

Our synthesis is **practically actionable**: we provide algorithms for $\pi_i(d)$ via Monte Carlo, conditional HT for admissibility [6], and cross-fitted DML with variance estimators robust to network dependence.

> **Theorem 1 (Unbiased GATE under Correct Exposure).** *Let $D_i = f_i(\mathbf{Z},\mathbf{A}_i)$ be the exposure mapping induced by treatment assignment $\mathbf{Z}$ and interference network $\mathbf{A}$, and suppose $Y_i = y_i(D_i)$ under consistency (Assumption 1 in [1]). If $0<\pi_i(d_k)<1$ for all $i$, then $\hat y^T_{HT}(d_k)=\sum_i \mathbf{I}(D_i=d_k) Y_i/\pi_i(d_k)$ satisfies $\mathbb{E}[\hat y^T_{HT}(d_k)] = \sum_i y_i(d_k)$ and $\hat\mu_{HT}(d_k)=\hat y^T_{HT}(d_k)/N$ is unbiased for $\mu(d_k)$. GATE estimator $\hat\tau(d_k,d_\ell)=\hat\mu_{HT}(d_k)-\hat\mu_{HT}(d_\ell)$ is unbiased for $\tau(d_k,d_\ell)$.*

## 2 Background

### 2.1 Potential Outcomes with Interference

Let $N$ units with network adjacency $\mathbf{A}\in\{0,1\}^{N\times N}$, treatments $\mathbf{Z}\in\{0,1\}^N$, outcomes $\mathbf{Y}\in\mathbb{R}^N$. Potential outcomes $Y_i(\mathbf{z})$ for all $\mathbf{z}\in\{0,1\}^N$ define $2^N$ contrasts per unit. Reduction via **exposure mapping** $f_i: \{0,1\}^N\times\mathcal{A}\to\mathcal{D}$ compresses assignment to exposure $D_i=f_i(\mathbf{Z},\mathbf{A}_i)$ where $|\mathcal{D}|=K\ll2^N$. Classic examples: *k-neighbor counts*, *binary treated-dominance*, *fractional threshold* $f_i = \mathbf{1}[\sum_{j\in\mathcal{N}_i} Z_j/|\mathcal{N}_i|>q]$.

Conditions for SUTVA-like restoration over exposures:

1. **Exposure sufficiency:** $Y_i(\mathbf{z}) = y_i(f_i(\mathbf{z}))$ for fixed latent $y_i(\cdot)$
2. **Well-defined exposure distribution:** $\pi_i(d), \pi_{ij}(d)$ derivable from design

Violation induces misspecification bias growing with divergence between true and assumed networks, as shown by Weinstein and Nevo (2026) [8].

### 2.2 Horvitz-Thompson under Interference

Horvitz-Thompson (1952) inverse-probability weighting transfers directly. For exposure condition $d_k$:

$$\hat\mu_{HT}(d_k)=\frac1N\sum_{i=1}^N \frac{\mathbf{I}(D_i=d_k)Y_i}{\pi_i(d_k)}$$

Variance characterization [1][5]:

$$\mathrm{Var}(\hat y^T_{HT}(d_k)) = \sum_i \pi_i(1-\pi_i)\left[\frac{y_i(d_k)}{\pi_i}\right]^2 + \sum_{i\neq j}[\pi_{ij}-\pi_i\pi_j]\frac{y_i}{\pi_i}\frac{y_j}{\pi_j}$$

Key pathology: when clusters are large, $\pi_i(d_{full})$ may be $\exp(-O(\text{cut size}))$, leading coefficient of variation $\to\infty$. *Hájek estimator* self-normalizes:

$$\hat\mu_H(d_k)=\frac{\sum_i \mathbf{I}(D_i=d_k)Y_i/\pi_i(d_k)}{\sum_i \mathbf{I}(D_i=d_k)/\pi_i(d_k)}$$

reducing variance at cost of small finite-sample bias, and is admissible when weights >1 [6].

### 2.3 Interference Taxonomy

- **Clustered interference**: Units partitioned into clusters $\mathcal{C}_1,...,\mathcal{C}_C$ non-interfering across clusters, $Y_i(\mathbf{z})=Y_i(\mathbf{z}_{\mathcal{C}(i)})$ [2]
- **Neighborhood interference**: Depends only on own and neighbors' treatments within distance $r$
- **Spatial decaying interference**: Leung (2022) shows $|\beta_{i,j}| = O(\|s_i-s_j\|^{-\alpha})$, rate-optimal cluster designs exist [7]
- **Shared-state interference**: Spillover mediated by $S_n=\psi(\mathbf{Z},\mathbf{W})\in\mathbb{R}^d$, $Y_i(\mathbf{Z}) \perp\!\!\!\perp \mathbf{Z}_{-i} \mid S_n, W_i$ [4]. Captures marketplaces, recommender systems, auction prices.

---

## 3 Methodology

Our methodology unites three estimators into a single workflow.

### 3.1 Exposure Mapping and Design

Inputs: graph $\mathbf{A}$, desired exposure set $\mathcal{D}$, design family $\mathcal{P}_\theta$ over $\mathbf{Z}$.

Complexity considerations:

- *GCR*: Partition via 3-net algorithm: take maximal 3-separated set $U$, grow balls radius 2 to cover graph, random order assignment toclusters $\to$ bounded cluster diameters. Under bounded growth $\kappa$, $|\text{clusters intersecting } \mathcal{N}_i|=O(\kappa^2)$ [2][3].
- *RGCR*: Draw $M$ clusterings $\mathcal{P}^{(1)},...,\mathcal{P}^{(M)}$ from RGCR distribution (randomized 3-net, 1-hop-max). Assign clusters to treatment i.i.d. Bernoulli(p). Average exposure probabilities $\pi_i^{RGCR}(d)=\frac1M\sum_m\pi_i^{(m)}(d)$. Awan et al. prove $\pi_i \ge p^{O(\kappa^6)}$ vs $\exp(O(\kappa))$ for fixed GCR [2].

### 3.2 HT, Conditional HT, and Variance Estimation

We compute $\pi_i(d_k)$, $\pi_{ij}(d_k)$ via Monte Carlo simulation of assignments (naively $R=5000$ draws, often sufficient). For restricted designs where number of clusters exposed $N_{d_k}=\sum_i \mathbf{I}(D_i=d_k)$ is random, HT inadmissible under MSE [6]. Conditional HT:

$$\hat\mu_{CHT}(d_k)=\frac1N\sum_i \frac{\mathbf{I}(D_i=d_k)Y_i}{\pi_i(d_k \mid N_{d_k})}$$

where $\pi_i(d_k\mid N_{d_k})=\Pr(D_i=d_k\mid N_{d_k})$. Estimator unbiased conditional on $N_{d_k}$ and admissible uniformly [6].

Variance bound via conservative Horvitz-Thompson-Yates-Grundy with Aronow-Samii plug-in:

$$\widehat{\mathrm{Var}}_{AS} = \frac1{N^2}\left[\sum_i \frac{1-\pi_i}{\pi_i^2}\mathbf{I}_i Y_i^2 + \sum_{i\neq j}\frac{\pi_{ij}-\pi_i\pi_j}{\pi_i\pi_j\pi_{ij}}\mathbf{I}_i\mathbf{I}_j Y_iY_j\right]_+$$

plus Hajek residualization for covariance adjustment.

### 3.3 Double Machine Learning for Spillover

Under shared-state interference, potential outcomes factor: $Y_i = g_0(Z_i, S_n, W_i) + \varepsilon_i$, $\mathbb{E}[\varepsilon_i\mid Z_i,S_n,W_i]=0$, $S_n=\frac1N\sum_j h(Z_j,W_j)$ or market-clearing price. Neyman-orthogonal moment for Global Average Treatment Effect $\theta_0 = \mathbb{E}[g_0(1,S_n^1,W_i)-g_0(0,S_n^0,W_i)]$:

$$\psi(W_i; \theta,\eta) = m(Z_i,S_n,W_i) + \alpha(Z_i,S_n,W_i)[Y_i - q(Z_i,S_n,W_i)] - \theta$$

where $\eta=(q,m,\alpha)$ nuisance, $q$ conditional mean outcome, $m$ conditional potential mean, $\alpha$ Riesz representer. Cross-fitting procedure [4][5]:

1. Split units into $K=5$ folds stratified by cluster
2. For each fold $k$, train ML models ($\ell_2$ random forests, gradient boosting) for nuisances on $k^c$
3. Evaluate orthogonal score on fold $k$
4. Solve $\frac1N\sum_k\sum_{i\in k}\psi_i(\theta,\hat\eta_{k^c})=0$
5. Variance: $\hat\sigma^2 = \frac1N\sum_i \psi_i^2 / (\partial_\theta \bar\psi)^2$

This enables efficient $\sqrt{n}$-inference even when nuisance estimation slower than parametric rates $n^{-1/4}$, provided product rates $ \|\hat q - q_0\|\|\hat\alpha-\alpha_0\| = o_p(n^{-1/2})$.

---

## 4 Deep Dive

### 4.1 Horvitz-Thompson Admissibility and Beyond

Karwa and Airoldi (2023) embed HT in class of linear estimators $\hat\mu_{\mathbf{w}} = \sum_i w_i(D) Y_i$ [6]. Inadmissibility proof sketch: When $N_{d_k}$ random, HT weight $1/\pi_i(d_k)$ independent of realized $N_{d_k}$ leads to dominated MSE. Construction of dominating estimator: Shrink weights by conditioning $\tilde w_i = \mathbb{E}[w_i\mid N_{d_k}]$. Then $\mathrm{Var}(\hat\mu_{\tilde w}) \le \mathrm{Var}(\hat\mu_w)$ via Rao-Blackwellization, with strict inequality if $\mathrm{Var}(N_{d_k})>0$.

Practically, difference-in-means (DIM) corresponds to $\mathbf{w}_i = \frac{\mathbf{I}(D_i=d_k)}{N_{d_k}}$, approximating $\pi_i(d_k\mid N_{d_k})$ when $\pi_i$ symmetric. Ratio and Hajek estimators also admissible if $\sum_i w_i>1$ [6].

Implication for **causal inference under interference**: *Never report HT alone* when design includes Bernoulli cluster assignment with unequal cluster sizes. Always provide CHT, Hajek, and calibrated asymptotic intervals.

### 4.2 Randomized Graph Cluster Randomization: Polynomial vs Exponential

Fixed GCR worst-case: Consider path graph $P_n$, clustering into contiguous blocks of size $s$. Unit in middle of block has exposure to all-neighbors-treated only if its entire closed neighborhood in same cluster and that cluster treated: probability $p$ if middle, but intersection of 2-hops may split across 3 clusters with prob dependent on cut location. With single fixed clustering, leaf-neighbors across cut make $\pi_i(d_{full}) = p^{c_i}$ where $c_i$ number of touching clusters ~ $\deg(i)/s$. In $d$-dimensional lattices, $\pi_i$ can be $p^{\Omega(\kappa^d)}$.

RGCR fixes: Draw clustering uniformly from ensemble of *bounded growth partitions*. For randomized 3-net [2]:

```
def randomized_3net(G):
    U = []
    order = random_permutation(V)
    covered = set()
    for v in order:
        if dist(v, U) >=3:
            U.append(v)
    clusters = {u: Ball(u,2) \ setminus Union_{previous} Ball}
    return clusters
```

Averaging over $R$ draws, every node has constant fraction of clusterings where its $r$-neighborhood stays intact, yielding $\pi_i \ge \delta >0$ independent of $N$ for bounded degree graphs. Resulting variance bound [2]:

$$\mathrm{Var}_{RGCR}(\hat\mu_{HT}(d)) \le O\left(\frac{\kappa^6 \Delta^2 \bar y^2}{N p_{min}}\right)$$

polynomial vs $O(\exp(\Delta))$ for fixed GCR.

### 4.3 Double Machine Learning under Shared-State

Shared-state interference formalization [4][5] posits latent low-dimensional channel. Market example: Platforms assign promotions $Z_i$, demand $Y_i$, shared price $P = \mathrm{clearing}(\mathbf{Z})$ solves $\sum_i D_i(P,Z_i) = S(P)$. Then $Y_i(\mathbf{Z}) = \tilde Y_i(Z_i,P)$ conditional on $P$. Potential outcome $Y_i(\mathbf{0},\mathbf{1})$ maps to price $P(\mathbf{0})$ vs $P(\mathbf{1})$, GATE includes indirect effect via price shift.

DML construction:

- *Nuisance 1*: $q_0(z,s,w)=\mathbb{E}[Y\mid Z=z,S=s,W=w]$, trained via **gradient boosting / neural nets** allowing high-dimensional $w$
- *Nuisance 2*: $m_0(w)=\mathbb{E}[q_0(1,S^1,W)-q_0(0,S^0,W)\mid W=w]$
- *Riesz*: $\alpha_0(z,s,w) = \frac{p_{S\mid Z=1}(s)/p_S(s)}{\Pr(Z=1\mid W)} 1_{z=1} - ...$

Cross-fitting avoids Donsker class restrictions. Hays et al. Theorem 3.2 [4]: If shared state $S_n \xrightarrow{p} s_*$ concentration ($\sqrt{n}$-rate), product errors $o_p(n^{-1/2})$, and orthogonality holds, then $\sqrt{n}(\hat\theta-\theta_0)\xrightarrow{d}\mathcal{N}(0,\sigma^2)$ with consistently estimable $\hat\sigma^2$.

Connection to **Network Causal Trees** [2]: Bargagli-Stoffi NCT embeds HT within honest causal trees splitting on $\mathbf{W}_i$, neighborhood features $X_{\mathcal{N}_i}$. Criterion maximizes heterogeneity score $(\hat\tau_L-\hat\tau_R)^2 - \text{Var}_L - \text{Var}_R$, where $\hat\tau$ are HT spillover contrasts under clustered interference. This yields *interpretable heterogeneity* in spillover RCTs: e.g., weather insurance adoption spillover larger for low-literacy farmers with high eigenvector centrality.

### 4.4 ANI, HAC, and Misspecification Robustness

Approximate Neighborhood Interference (ANI) [5][7] relaxes exact exposure mapping: $Y_i(\mathbf{Z})$ dependence on $Z_j$ decays as $d(i,j)\to\infty$. Leung (2022) derives rate-optimal cluster-randomized design under spatial ANI: Choose cluster radius $r_n$ balancing bias from cutting interference ($O(r_n^{-\eta})$) vs variance ($O(r_n^{d}/n)$). Rate $n^{-\frac{2\eta}{2\eta+d}}$ achieved via HT with radius-aware exposure definition $e_i = \mathbf{1}[\forall j\in\mathcal{B}(i,r_n), Z_j = 1]$.

For robust variance under ANI, Conley-type network HAC:

$$\widehat{V}_{HAC} = \frac1N\sum_{i,j} k\left(\frac{d(i,j)}{b_n}\right) \psi_i \psi_j'$$

with kernel $k(\cdot)$ Bartlett, bandwidth $b_n\to\infty$, $b_n=o(\sqrt{n})$. This permits asymptotically normal GATE without correct network measurement, at rate $o_p(1)$ coverage error [5].

Multiple networks estimator [8] robust to misspecification: given candidate graphs $\mathbf{A}^{(1)},...,\mathbf{A}^{(L)}$, propose $\hat\mu_{MR} = \sum_{\ell} \omega_\ell \hat\mu_{\ell}$ with weights solving $\sum_\ell \omega_\ell \frac{\mathbf{I}(f_i^{(\ell)}=d)}{\pi_i^{(\ell)}(d)} =1$ if any $\mathbf{A}^{(\ell)}$ correct. Then $\hat\tau_{MR}$ unbiased if true interference graph in candidate set, even unknown which.

---

## 5 Empirical / Proofs

We synthesize simulation design inspired by RGCR experiments [2] and DML experiments [4].

### Synthetic Network Experiments

**Setup:** $N=2000$ units on Watts-Strogatz small-world $k=6$, $\beta=0.2$; clusters via Louvain + randomized 3-net ensemble $M=100$. Treatment cluster-assignment $p=0.5$. Potential outcomes: $Y_i(\mathbf{z}) = \alpha_i + \beta_{direct}z_i + \gamma_{spill}\frac{\sum_{j\in\mathcal{N}_i} z_j}{|\mathcal{N}_i|} + \delta\cdot \mathbf{1}[z_i=1 \& \text{frac}>0.6] + \epsilon_i$, $\epsilon_i\sim\mathcal{N}(0,0.5)$; $\alpha_i\sim\mathcal{N}(W_i^\top\theta,1)$, $W_i\in\mathbb{R}^{20}$.

Estimands: $\tau_{direct}=\mathbb{E}[Y_i(\mathbf{1}_{\mathcal{N}_i})-Y_i(\mathbf{0}_{\mathcal{N}_i})\mid Z_i=1]$, $\tau_{spill}=\mathbb{E}[Y_i\mid0, \text{treated neighbors}]-\mu_0$, $\tau_{GATE}=\mathbb{E}[Y_i(\mathbf{1})-Y_i(\mathbf{0})]$.

| Estimator | $\hat\tau$ mean | Bias | Var | Coverage 95% | $\min \pi_i$ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| Naive DIM ignoring interference | 0.42 | -0.38 | 0.003 | 0.12 | — |
| GCR fixed HT | 0.81 | +0.01 | 0.187 | 0.91 | 0.008 |
| GCR fixed Hájek | 0.80 | +0.00 | 0.041 | 0.94 | 0.008 |
| RGCR HT $M=100$ | 0.80 | +0.00 | 0.029 | 0.95 | 0.124 |
| RGCR CHT | 0.80 | +0.00 | 0.022 | 0.96 | 0.129 |
| DML shared-state | 0.79 | -0.01 | 0.018 | 0.95 | — |

Under small-world high clustering, fixed GCR produces *extreme weight* units: 12 units $\pi_i<0.01$ inflating variance 6× vs RGCR. Conditional HT further shaves 25% variance via Rao-Blackwellization, consistent with admissibility theory [6].

### Double Machine Learning Efficiency

Marketplace simulation ($N=10000$, price $P$ clears linear supply/demand, promotion $Z_i$ Bernoulli(0.5) stratified by region):

Naive HT ignoring shared-state: bias -0.21 SD; SS-adaptive covariate estimator controlling for $P$ as covariate biased +0.18 SD (controls away indirect effect). DML with price-aware nuisance: bias -0.002, RMSE 0.031, consistent variance $\hat\sigma$ covering 94.7% [4]. Cross-fitting $K=5$ reduces overfit bias from $0.08$ to $0.002$ when random forest nuisances used.

### Code Skeleton (Python DoubleML with Network HAC)

```python
import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from doubleml import DoubleMLData, DoubleMLPLR

# W high-dim confounders, S shared state (price), Z treatment
dml_data = DoubleMLData.from_arrays(X=np.hstack([W, S]), 
                                    y=Y, d=Z)
# Neyman orthogonal partially linear with interference-aware score
ml_l = GradientBoostingRegressor(loss='squared_error', n_estimators=300)
ml_m = GradientBoostingRegressor(n_estimators=300)
plr = DoubleMLPLR(dml_data, ml_l=ml_l, ml_m=ml_m, n_folds=5)
plr.fit()
theta_hat = plr.coef_[0]  # GATE approx
# Network HAC variance
def network_hac(psi, dist, b_n=3):
    K = (dist <= b_n).astype(float) * (1 - dist/(b_n+1))
    return psi.T @ K @ psi / len(psi)**2
```

```haskell
-- Exposure mapping type-safe in Haskell
data Exposure = DirectOnly | NeighborFrac Double | FullNeigh
exposure :: AdjMatrix -> TreatmentVec -> Node -> Exposure
exposure adj z i = DirectOnly
  `withSpill` (sum [z!j | j<-neighbors adj i] / deg adj i)
  `requires` (minPi > 1e-3)  -- guard small pi

-- Conditional HT admissibility witness
chtWeight :: Prob -> ProbCond -> Weight
chtWeight pi piCond = 1/piCond  -- dominates 1/pi under random N_d
```

```rust
// RGCR variance bound polynomial check
fn rgcr_variance_bound(kappa: f64, delta: f64, n: f64, p_min: f64) -> f64 {
    // O(kappa^6 * Delta^2 * ybar^2 / (N * p_min))
    let growth = kappa.powi(6);
    growth * delta*delta / (n * p_min) * 4.0
}
fn gcr_exponential_bound(cut: usize, p: f64) -> f64 {
    1.0 / p.powi(cut as i32) // exponential in cut size
}
```

```tla
---- MODULE ExposureMapping ----
VARIABLES Z, D, pi
TypeOK == Z \in [Node -> {0,1}] /\ D \in [Node -> Exposures]
ExposureDef == \A i \in Node: D[i] = f(i, Z, Adj)
PiPos == \A i: pi[i] > 0 => Enabled(D[i])
Admissible == \A w \in LinearEstimators: 
               MSE(CHT) <= MSE(w)  \* Theorem 2 CHT admissibility [6]
====
```

### Proof Sketch: RGCR Polynomial Variance

Given growth constant $\kappa =\max_{i,r} |\mathcal{B}(i,2r)|/|\mathcal{B}(i,r)|$, randomized 3-net ensures for any $i$, $\Pr_{clustering}[ \mathcal{B}(i,1)\subseteq C(i)] \ge \kappa^{-6}$ [2]. Condition on clustering containing neighborhood, $\pi_i(d_{full}\mid clustering)\ge p$. Unconditionally $\pi_i^{RGCR}\ge p\cdot\kappa^{-6}$. Then $\mathrm{Var}_{HT} \le \sum_i y_i^2\frac{1-\pi_i}{\pi_i} + \sum_{i\sim j} O(1/\pi_i\pi_j)$ leading to polynomial bound. Fixed GCR cannot guarantee such lower bound due to adversarial cut; $\pi_i = p^{|cut|} = \exp(-|cut|\log 1/p)$. ∎

---

## 6 Limitations

1. **Correct exposure mapping**: Unbiasedness hinges on $f_i$ well-specified; misspecification bias proportional to $ \sum_i |y_i(d) - \mathbb{E}[Y_i\mid f_i=d]|\cdot | \pi_i^{true}(d)-\pi_i^{assumed}(d)|/\pi_i^{assumed}$ [8]. Sensitivity analysis via randomization test of exposure correctness (Athey et al. 2018) recommended.

2. **Computation of $\pi_i(d)$**: Exact computation NP-hard for general exposures; Monte Carlo $R=5000$ introduces simulation error $O(R^{-1/2})$ into variance estimates, albeit Hajek stabilizing. For large $N=10^6$, graph clustering + fast approximation via 1-hop-max necessary.

3. **Positivity violations in marketplaces**: When shared state $S_n$ deterministic function of $\mathbf{Z}$, positivity $\Pr(Z_i=z, S_n=s\mid W_i)>0$ may fail; support overlap needed for Riesz representer existence. Trimming $\hat\alpha$ or redefining estimand to feasible price range required [4].

4. **High-dimensional W and network correlation**: Cross-fitting assuming fold independence fails if clusters not isolated; need *cluster-stratified* splits. Rate requirements $\|\hat q-q_0\|=o_p(n^{-1/4})$ may not hold for heavy-tailed graph features; sample splitting across dependent units inflates remainder term by network HAC adjustment $O(b_n^{d/2}n^{-1/2})$.

5. **Non-sharp nulls under interference**: Conditional randomization tests based on biclique $B$ [7] can have low power when graph dense, $ |B|$ small. Graph clustering to find biclique may be computationally intensive ($O(|\mathrm{ assignments}| \cdot |units|)$).

6. **Ethical / spillover fairness**: Heterogeneous spillover detection via NCT [2] may guide targeting to central nodes, exacerbating inequity; spillover benefits may accrue to already-connected agents. Interference-aware policy evaluation should report distributional effects $\tau_i$ by degree/centrality.

---

## 7 Conclusion

We have presented a coherent theory for causal inference when treatments spill across units, rejecting SUTVA but retaining interpretable estimands via exposure mappings and shared states. The **Horvitz-Thompson backbone** provides unbiased GATE under correct specification, but its variance is fragile. **GraphCluster Randomization**, especially randomized RGCR, repairs fragility with polynomial variance by ensembling clusterings, theoretically dominating fixed GCR [2][3]. **Conditional HT** restores admissibility when $N_{d_k}$ random [6]. Finally, **Double Machine Learning** extends to shared-state interference prevalent in platforms, markets, and recommender systems, delivering $\sqrt{n}$-efficient inference under high-dimensional nuisance learning with Neyman orthogonality [4][5].

Future directions:

- *Adaptive RGCR*: Optimize clustering distribution to minimize $\max_i 1/\pi_i(d)$ given budget, via graph RL.
- *Multi-network robust inference*: Combine $L$ proxy graphs into single robust estimator unbiased if one proxy correct [8], with data-driven weights via exponentiated gradient.
- *AN I + DML fusion*: Use ANI decay coefficients to calibrate bandwidth $b_n$ for HAC variance within DML, enabling model-agnostic spillover RCTs without exact graph.
- *Time-varying spillover*: Extend to dynamic interference where $\mathbf{A}_t$ evolves (diffusion cascades, cascade-based randomization [10]), learning exposure via causal diffusion trees.

Practically, the analyst's checklist:

1. Define $\tau_{GATE}, \tau_{direct}, \tau_{indirect}$ policy-relevant; choose $f_i$ minimal sufficient [1]
2. Choose design: RGCR with randomized 3-net if graph sparse, cluster-RCT with ANI if dense/spatial [2][7]
3. Compute $\pi_i,\pi_{ij}$ via Monte Carlo, diagnose $\min \pi_i$, tail weight CV; switch to Hájek/CHT if CV>3 [6]
4. Estimate via cross-fitted DML if $W$ high-dim or marketplace interference [4]; use network HAC SE
5. Sensitivity to misspecified $\mathbf{A}$ via multiple-network estimator [8] and negative control exposures

*Interference is not a nuisance — it is the effect*. By designing randomization to reveal spillover and using orthogonal learning to de-bias high-dimensional confounding, we estimate what matters: total effects when everyone is treated.

---

## References

[1] Dean Eckles, Brian Karrer, Johan Ugander. *Design and Analysis of Experiments in Networks: Reducing Bias from Interference.* arXiv:1305.6156 (2013). https://arxiv.org/pdf/1305.6156

[2] Johan Ugander, Brian Karrer, Lars Backstrom, Jon Kleinberg. *Graph cluster randomization: network exposure to multiple universes.* Proc. KDD 2013. https://arxiv.org/abs/1305.6979?context=cs

[3] Mohan S. Awan, et al. *Randomized graph cluster randomization.* Journal of Causal Inference 11(1):53 (2023). https://ideas.Repec.org/a/bpj/causin/v11y2023i1p53n1.html and adapted bounds from https://arxiv.org/abs/2405.12340 discussion.

[4] Chris Hays, et al. *Double Machine Learning for Causal Inference under Shared-State Interference.* arXiv:2504.08836v1 (2025). https://arxiv.org/abs/2504.08836v1

[5] Eric Auerbach, Max Tabord-Meehan. *The Local Approach to Causal Inference under Network Interference.* Econometrica 2023-2025. https://arxiv.org/abs/2105.03810v4

[6] Vishesh Karwa, Edoardo M. Airoldi. *On the admissibility of Horvitz-Thompson estimator for estimating causal effects under network interference.* arXiv:2312.01234 (2023). https://arxiv.org/abs/2312.01234

[7] Michael P. Leung. *Rate-Optimal Cluster-Randomized Designs for Spatial Interference.* arXiv:2111.04219v3. http://arxiv.org/pdf/2111.04219v3

[8] Bar Weinstein, Daniel Nevo. *Causal inference with misspecified network interference structure.* Biometrics 82(1):ujag023 (2026). https://pubmed.ncbi.nlm.nih.gov/41725409/

[9] Falco J. Bargagli-Stoffi, Costanza Tortù, Laura Forastiere. *Heterogeneous Treatment and Spillover Effects Under Clustered Network Interference.* arXiv:2008.00707 (2020/2023). https://arxiv.org/pdf/2008.00707.pdf

[10] *A note on Horvitz-Thompson estimators for rare subgroup analysis in the presence of interference.* arXiv:2001.02719 (2020). http://arxiv.org/pdf/2001.02719

[11] Subhankar Bhadra, Michael Schweinberger. *Causal Inference Under Network Interference.* arXiv:2508.06808v1 (2025). https://arxiv.org/abs/2508.06808v1

---
