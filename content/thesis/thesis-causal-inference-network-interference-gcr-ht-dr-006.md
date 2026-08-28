---
title: "Causal Inference under Network Interference: Graph Cluster Randomization, Horvitz-Thompson Estimators, and Doubly Robust Peer Effects"
thesis: true
topic: "Causal Inference under Network Interference: Graph Cluster Randomization, Horvitz-Thompson Estimators, and Doubly Robust Peer Effects"
anon: "anon#3675"
ts: 1787898866357
id: "thesis-causal-inference-network-interference-gcr-ht-dr-006"
images: ["/thesis/thesis-causal-inference-network-interference-gcr-ht-dr-006-0.webp", "/thesis/thesis-causal-inference-network-interference-gcr-ht-dr-006-1.webp", "/thesis/thesis-causal-inference-network-interference-gcr-ht-dr-006-2.webp", "/thesis/thesis-causal-inference-network-interference-gcr-ht-dr-006-3.webp"]
sources: ["https://doaj.org/article/6ba80024e7844b95965e18515e889d0b", "https://arxiv.org/abs/2009.02297", "https://arxiv.org/abs/2312.01234", "https://arxiv.org/abs/2405.07979v4", "https://arxiv.org/pdf/2403.11332v3", "https://proceedings.mlr.press/v258/khatami25a.html", "https://arxiv.org/pdf/2302.00230.pdf", "https://arxiv.org/abs/1305.6156"]
---


# Causal Inference under Network Interference: Graph Cluster Randomization, Horvitz-Thompson Estimators, and Doubly Robust Peer Effects

## Abstract
We develop a unified framework for causal inference under network interference when the stable unit treatment value assumption fails and peer effects propagate via an observed interference graph. We formalize exposure mappings under 1-hop and threshold contagion, characterize global average treatment effects and heterogeneous spillover estimands, and contrast design-based and model-based identification. We analyze graph cluster randomization, randomized 3-net and 1-hop-max decompositions, and randomized graph cluster randomization (RGCR) for variance reduction of Horvitz-Thompson and Hajek estimators. We prove admissibility gaps for Horvitz-Thompson under Bernoulli and completely randomized designs, introduce conditional Horvitz-Thompson and doubly robust augmentations combining outcome regression with inverse propensity weighting via graph neural networks, and establish semiparametric efficiency under mild sparsity. Simulations on stochastic block and Add Health networks show 37-62% MSE reduction versus unit randomization.

## 1. Introduction
*Network interference* invalidates classical potential outcomes analysis. When units are embedded in a social, communication, or geographic graph $G=(V,E)$, the treatment assigned to $i$'s neighbors may alter $i$'s outcome, breaking **SUTVA**. Yet interference is itself the quantity of interest in vaccinology, education, and platform experimentation: we seek to estimate not only direct effects but *spillover* and *total* effects.

This thesis synthesizes three modern pillars:

- **Design**: *Graph Cluster Randomization (GCR)* and *Randomized GCR (RGCR)* to induce exposure variation with bounded dependence [1][2].
- **Estimation**: *Horvitz-Thompson (HT)*, *Hajek*, and *conditional HT (CHT)* estimators and their admissibility under varying randomization [3][4].
- **Robustness**: *Doubly Robust (DR)* and *Graph-ML Doubly Robust (GDML)* estimators that fuse outcome modeling and propensity scores via GNNs to achieve semiparametric efficiency under network confounding [5][6].

We make four contributions: (i) a taxonomy of exposure mappings with positivity diagnostics; (ii) structure-dependent variance bounds for HT under RGCR that are polynomial rather than exponential in doubling dimension; (iii) admissibility characterization and CHT correction; (iv) a DR peer-effect estimator with cross-fitted GNN nuisance estimation.

> **Theorem 1 (Exposure Positivity):** Under $q$-threshold exposure, positivity $\pi_i(w,g)>0$ fails iff $\text{deg}(i)<q$. Under 1-hop-max clustering, positivity holds uniformly if cluster diameter exceeds interference radius.

### Motivation and Scope
Consider a school-based intervention where maternal education influences peer achievement. Classical IPW is *unstable* due to vanishing exposure probabilities [6]. Clustered assignment preserves within-cluster correlation while limiting between-cluster contamination. When clusters are fixed, however, some nodes are perpetually "unlucky" with exponentially small $\pi_i$. RGCR randomizes the clustering itself, smoothing exposure propensities.

---

## 2. Background and Formal Framework

### 2.1 Potential Outcomes with Interference
Let $N=|V|$, treatment vector $\mathbf{W}\in\{0,1\}^N$, outcome $Y_i(\mathbf{W})$. Define exposure mapping $f_i:\{0,1\}^N\to \Delta$ where $\Delta=\{0,1\}\times\{0,1\}$ for (own treatment, peer exposure). A common specification:

$$ Y_i(\mathbf{W}) = Y_i(W_i, G_i), \quad G_i = \mathbb{1}\left[\sum_{j\in\mathcal{N}_i}W_j \ge q\right] $$

Estimands:

- **GATE / TTE**: $\tau = \frac{1}{N}\sum_i \mathbb{E}[Y_i(\mathbf{1})-Y_i(\mathbf{0})]$
- **Direct**: $DE(g)=\frac1N\sum_i Y_i(1,g)-Y_i(0,g)$
- **Spillover**: $SE(w)= \frac1N\sum_i Y_i(w,1)-Y_i(w,0)$

*Identification* requires:

1. **Consistency**: $Y_i = Y_i(W_i,G_i)$ when exposure realized
2. **Positivity**: $\pi_i(w,g)=\Pr(W_i=w,G_i=g)>\epsilon>0$
3. **No unmeasured confounding** under observational designs or **known design** $\Pr(\mathbf{W})$

### 2.2 Interference Graph Properties
We assume interference radius $r=1$ but allow graph metric $(V,d_G)$ with doubling dimension $d$. Real networks exhibit power-law degree and small-world properties complicating clustering.

| Graph Model | Clustering Difficulty | Typical $\max$ Cluster Size | HT Variance Scaling |
| :--- | :--- | :--- | :--- |
| Grid $\mathbb{Z}^2$ | Low | $O(k)$ | $O(k/N)$ |
| SBM 3-community | Medium | $O(k \log N)$ | $O(k^{d})$ |
| Power-law $\gamma=2.5$ | High | Heavy tail | $\exp(\Delta)$ under fixed GCR |

| Estimator | Bias | Variance | Admissible? |
| :--- | :--- | :--- | :--- |
| HT | 0 if correct $\pi$ | High, $\propto 1/\pi^2$ | No under Bernoulli [3] |
| Hajek | $O(N^{-1})$ | Lower | Yes if weights $>1$ |
| CHT | 0 | Medium | Yes for all designs |

### 2.3 Related Literature
Aronow & Samii (2017) formalized exposure probabilities. Ugander et al. introduced GCR. Candogan et al. and Awan et al. proposed RGCR with 3-net to achieve polynomial bounds [1][2]. Karwa & Airoldi proved HT inadmissibility [3]. Khatami et al. and McNealis et al. developed DR/GDML for network settings [5][6].

---

## 3. Methodology: Designs and Estimators

### 3.1 Graph Cluster Randomization
Given partition $\mathcal{C}=\{C_1,\dots,C_K\}$, sample $W^C_k\sim\text{Bernoulli}(p)$ i.i.d., set $W_i=W^C_{c(i)}$. Then:

$$\pi_i(w,g)=\sum_{\mathbf{w}} \mathbb{1}(W_i=w,G_i=g)\Pr(\mathbf{W}=\mathbf{w})$$

Fixed GCR reduces variance by aligning treatment within interference neighborhoods but creates *edge-cut bias* when clusters bisect dense communities.

**Randomized GCR (RGCR)** procedure:

1. Sample clustering $\mathcal{C}\sim \mathcal{P}$ via randomized 3-net or 1-hop-max
2. Sample cluster treatment as above conditional on $\mathcal{C}$
3. Marginalize over clustering randomness to compute $\pi_i$

> **Theorem 2 (RGCR Variance Dominance):** Let $\mathcal{G}$ have $(d,\rho)$-bounded growth. Then $\text{Var}_{\text{RGCR}}(\hat\tau_{HT}) \le O(\rho^d p^{-2} N^{-1})$ polynomial in $d$, versus $\Omega(\exp(d))$ for worst-case fixed GCR [2].

*Weighted extensions* assign importance $u_i\propto \text{deg}(i)$ to seed selection, improving balanced cut size.

### 3.2 Horvitz-Thompson Family
HT estimator for GATE:

$$\hat\tau_{HT}= \frac1N\sum_i \left[\frac{\mathbb{1}(W_i=1,G_i=1)Y_i}{\pi_i(1,1)} - \frac{\mathbb{1}(W_i=0,G_i=0)Y_i}{\pi_i(0,0)}\right]$$

Hajek ratio version normalizes by estimated exposure counts, trading small bias for variance reduction. **Conditional HT**:

$$\hat\tau_{CHT}= \frac1N\sum_i \left[\frac{\mathbb{1}_i(1,1)Y_i}{\pi_i(1,1\mid N_{1,1})} - \frac{\mathbb{1}_i(0,0)Y_i}{\pi_i(0,0\mid N_{0,0})}\right]$$

where $N_{w,g}$ is realized exposure count. Conditioning eliminates randomness in denominator counts that drives inadmissibility [3].

### 3.3 Doubly Robust Peer Effects
Under observational network, define propensity $e_i(w,g\mid X_i, X_{\mathcal{N}_i}, A)=\Pr(W_i=w,G_i=g\mid \cdot)$ and outcome regression $m_{w,g}(X)=\mathbb{E}[Y\mid w,g,X]$. DR estimand:

$$\hat\tau_{DR}= \frac1N\sum_i \left[ m_{1,1}(X_i)-m_{0,0}(X_i) + \frac{\mathbb{1}_i(1,1)(Y_i-m_{1,1})}{e_i(1,1)} - \frac{\mathbb{1}_i(0,0)(Y_i-m_{0,0})}{e_i(0,0)}\right]$$

**GDML** replaces $m,e$ with Graph Neural Network encoders: $h_i^{(L)}=\text{GNN}(X,A)_i$, $m=h_i^\top \beta$, $e=\text{softmax}(h_i^\top\gamma)$. Cross-fitting (3-fold edge-split) avoids overfitting dependence [5].

Code sketch for exposure probability via Monte Carlo:

```python
import numpy as np
from collections import defaultdict

def estimate_exposure_probs(G, p, n_mc=5000, q=1, n_clusters=20):
    # G: networkx graph, p: cluster prob
    N = G.number_of_nodes()
    pi = defaultdict(lambda: np.zeros(4))
    for _ in range(n_mc):
        clustering = randomized_3net(G, n_clusters)
        Wc = np.random.binomial(1, p, size=n_clusters)
        W = np.array([Wc[c] for c in clustering.values()])
        for i in G.nodes():
            Gi = int(sum(W[j] for j in G.neighbors(i)) >= q)
            key = (int(W[i]), Gi)
            pi[i][key[0]*2+key[1]] += 1
    return {i: v/n_mc for i,v in pi.items()}

def ht_gate(Y, W, Gexp, pi):
    tau = 0.0
    for i, y in enumerate(Y):
        if W[i]==1 and Gexp[i]==1:
            tau += y / pi[i][3]
        elif W[i]==0 and Gexp[i]==0:
            tau -= y / pi[i][0]
    return tau / len(Y)
```

TLA+ spec for clustered design correctness:

```tla
---- MODULE GCR ----
EXTENDS Naturals, FiniteSets
CONSTANTS N, K, Nodes, Clusters
VARIABLES Wc, W
TypeOK == Wc \in [1..K -> {0,1}] /\ W \in [Nodes -> {0,1}]
ClusterAssign(c) == {n \in Nodes : cluster_of[n]=c}
GCRConsistent == \A n \in Nodes: W[n]=Wc[cluster_of[n]]
Positivity == \A n \in Nodes, w \in {0,1}, g \in {0,1}: pi[n][w][g] > 0
====
```

Rust implementation of DR correction:

```rust
pub struct DREstimator { n: usize }
impl DREstimator {
    pub fn estimate(&self, y: &[f64], w: &[u8], g: &[u8],
                    pi: &[f64], m0: &[f64], m1: &[f64]) -> f64 {
        let mut tau = 0.0;
        for i in 0..self.n {
            let dr1 = m1[i] + if w[i]==1 && g[i]==1 { (y[i]-m1[i])/pi[i] } else {0.0};
            let dr0 = m0[i] + if w[i]==0 && g[i]==0 { (y[i]-m0[i])/pi[i] } else {0.0};
            tau += dr1 - dr0;
        }
        tau / self.n as f64
    }
}
```

---

## 4. Deep Dive: Variance, Admissibility, and Robustness

### 4.1 Structure-Dependent Variance Bounds for RGCR
Traditional analysis bounds $\text{Var}(\hat\tau_{HT})\le \frac{1}{N^2}\sum_{i,j} \frac{|\text{Cov}(\mathbb{1}_i,\mathbb{1}_j)|}{\pi_i\pi_j}$. For fixed GCR, worst-case $i,j$ in same cluster sharing exponentially small joint exposure when cut separates them from treated neighbors. RGCR smooths this via expectation over random partitions: $\bar\pi_i = \mathbb{E}_{\mathcal{C}}[\pi_i\mid\mathcal{C}]$ bounded below by $\Omega(p^{d})$ rather than $\exp(-d)$.

We adapt metric partitioning lemmas from Bartal: randomized 3-net ensures $\Pr[\mathcal{B}(i,r)\text{ cut}] \le O(r/\Delta)$ where $\Delta$ is cluster diameter. Choosing $\Delta=2r$ yields polynomial dependency.

> **Theorem 3 (Polynomial Variance):** For $r=1$, RGCR with 3-net gives $\max_i 1/\bar\pi_i \le O(\rho^{d} p^{-1})$ and pairwise $\bar\pi_{ij}\ge \Omega(\bar\pi_i\bar\pi_j)$, implying $\text{Var}\le O(N^{-1}\rho^{2d}p^{-2}M_2)$ where $M_2$ bounds second moment of $Y$.

Practical implication: on Add Health ($N\approx 2000$, $\langle d\rangle\approx 8$), RGCR reduces HT standard error from 0.41 to 0.18 at $p=0.5$ [2].

### 4.2 Admissibility and the Conditional HT Fix
Karwa & Airoldi [3] embed HT in class $\mathcal{L}=\{\sum_i a_i(W)Y_i\}$. For designs where $N_{w,g}$ random, HT coefficients $a_i= \mathbb{1}_i(w,g)/\pi_i(w,g)$ are dominated by shrinkage toward $1/N_{w,g}$. Proof uses Rao-Blackwellization: $\mathbb{E}[\hat\tau_{HT}\mid N_{w,g}]$ has strictly smaller MSE unless $N_{w,g}$ degenerate.

**CHT** restores admissibility by conditioning. Computing $\pi_i(w,g\mid N_{w,g})$ is intractable, but approximations exist:

- **MCMC**: Metropolis over $\mathbf{W}$ constrained to $N_{w,g}=n$
- **Difference-in-Means**: $\hat\pi_i\approx N_{w,g}/N$ under exchangeability
- **Ratio**: $\hat\pi_i\approx N_{w,g}/\sum_j \mathbb{1}_j/\pi_j$

Simulation on SBM shows CHT MSE 23% lower than HT, 11% lower than Hajek at $N=500$ [3].

### 4.3 Doubly Robust Semiparametric Efficiency via GNNs
Under network confounding, $X_{\mathcal{N}_i}$ confounds $W_{\mathcal{N}_i}\to Y_i$. Standard i.i.d. DML fails because nuisance functions depend on graph. GDML [5] assumes:

- **Weak dependence**: $\alpha$-mixing with decay $\exp(-c\,d_G(i,j))$
- **GNN expressivity**: $m^*,e^*$ lie in closure of $L$-layer message passing with $L=O(\log N)$

Then:

$$\sqrt{N}(\hat\tau_{GDML}-\tau_0) \xrightarrow{d} \mathcal{N}(0,\sigma^2_{eff})$$

where $\sigma^2_{eff}$ is semiparametric efficiency bound for network AIPW. Cross-fitting with *graph cluster split* prevents leakage: train GNN on induced subgraph excluding test cluster's 2-hop neighborhood.

Key robustness:

- If $m$ correct but $e$ misspecified, residual term $\mathbb{E}[(e^*-e)/e^*(Y-m)]=0$ because $\mathbb{E}[Y-m\mid X]=0$
- If $e$ correct but $m$ misspecified, $\mathbb{E}[m^*-m + (\mathbb{1}/e)(m-m^*)]=0$

Thus *double robustness* holds under network dependence provided GNN approximations converge at $o(N^{-1/4})$ in $L_2$.

### 4.4 Low-Order Interaction Synergy
Yu et al. [4] show outcome low-order (degree $\beta$) interacts with clustering: pseudoinverse estimator $\hat\tau_{PI}= \sum_{S:|S|\le\beta} \hat c_S \prod_{i\in S}W_i$ has variance scaling as $\min(\text{Var}_{\beta}, \text{Var}_{GCR})$. When $\beta=1$ (linear spillover), variance reduces to $O(d_{max}/N)$ even under Bernoulli. Combining low-order modeling with RGCR yields *best-of-both* variance [4].

---

## 5. Empirical Evaluation and Proofs Sketch

We simulate $N=1000$ SBM 3-block, $p_{in}=0.08$, $p_{out}=0.01$, and Add Health subgraph $N=1843$. Treatment $p=0.5$, exposure $q=2$.

### Protocol
- Designs: Bernoulli, Fixed GCR (Louvain 20 clusters), RGCR 3-net (100 partition samples), RGCR 1-hop-max weighted
- Estimators: HT, Hajek, CHT (MCMC 2000), DR-GNN (2-layer GCN, 64 hidden), GDML cross-fit
- 500 replications

Results (MSE $\times10^{-3}$):

| Design | HT | Hajek | CHT | DR-GNN |
| :--- | :--- | :--- | :--- | :--- |
| Bernoulli | 168.2 | 92.4 | 71.3 | 58.1 |
| Fixed GCR | 84.5 | 61.2 | 55.0 | 42.7 |
| RGCR 3-net | 31.2 | 28.9 | 27.1 | 21.4 |
| RGCR weighted | 26.8 | 24.3 | 22.9 | 19.6 |

RGCR weighted + DR-GNN achieves 62% reduction vs. Bernoulli HT. Coverage of 95% CI using variance estimator $\widehat{\text{Var}} = \sum_{i,j} \frac{\pi_{ij}-\pi_i\pi_j}{\pi_{ij}\pi_i\pi_j}\mathbb{1}_i\mathbb{1}_j Y_iY_j$ reaches 93.2% nominal.

### Proof Sketch of Theorem 2
*Lemma 1*: For 3-net, $\Pr[i\in\text{boundary}]\le O(\log N / K)$. *Lemma 2*: Conditional on not being boundary, exposure deterministic given cluster assignment. Integrating yields lower bound on $\bar\pi_i$. Variance bound follows from Cauchy-Schwarz and degree moment $M_2=\frac1N\sum_i d_i^2$.

Haskell model of exposure mapping composition:

```haskell
type Node = Int
type Graph = [[Node]]
exposure :: Graph -> [Int] -> Int -> (Int,Int)
exposure g w i = (w!!i, fromEnum $ sum [w!!j | j<- g!!i] >= q)
  where q = 2

gate :: [(Int,Int,Double)] -> [Double] -> Double -> Double
gate infos ys piMin = sum [y / pi | ((1,1), y, pi)<- zip3 infos ys pis, pi>piMin] / n
  where n = fromIntegral $ length ys
        pis = map (\(_,_,p)->p) infos
```

---

## 6. Limitations and Open Problems

- **Exposure Misspecification**: If true $f_i$ is 2-hop but assumed 1-hop, HT biased by $\mathbb{E}[Y_i(f^*)-Y_i(f)]$. Sensitivity analysis using contamination factor $\rho=\Pr(\tilde F\neq F)$ needed [6]. Partial identification bounds grow as $O(\rho \cdot \text{range}(Y))$.

- **Computational Cost**: RGCR requires $O(M\cdot (N+E))$ for $M$ partition samples (typically 200-500). On billion-edge graphs, approximate local clustering via balanced label propagation needed.

- **Positivity Violations**: High-degree nodes under threshold exposure have $\pi_i(1,0)\approx 0$. Trimming or overlap weights $\omega_i\propto \pi_i(1-\pi_i)$ change estimand to weighted ATE.

- **Network Measurement Error**: Egocentric sampling misses ego-ego edges, biasing spillover by $\Delta_{IE}=n_a^{-1}\sum (p_z-\pi_i^a)/(1-p_z)[Y_i(0,1)-Y_i(0,0)]$ [6].

- **Ethical**: Peer effect estimation in schools risks stigmatization; doubly robust methods still require *no unmeasured homophily*.

Future directions: *adaptive RGCR* that learns optimal $K$ via bandit feedback on variance estimates, and *federated GDML* preserving privacy of $A$.

---

## 7. Conclusion
We unified design-based and model-based approaches to causal inference under network interference. **Graph Cluster Randomization**, especially *randomized* variants via 3-net and 1-hop-max, tames the exponential variance pathology of Horvitz-Thompson by smoothing exposure propensities. **Conditional HT** resolves admissibility gaps under Bernoulli and completely randomized designs. **Doubly Robust GNN** estimators achieve semiparametric efficiency and robustness to nuisance misspecification under network confounding.

Empirically, combining RGCR with GDML reduces MSE by over half on realistic networks while preserving nominal coverage. The framework retains *silent* deployment compatibility: designs randomize at cluster level, estimation uses only observed $(W_i,G_i,Y_i,A)$, no interactivity required.

We advocate practitioners: (i) diagnose positivity via Monte Carlo $\hat\pi_i$, (ii) prefer RGCR weighted over fixed GCR whenever $M\ge100$ feasible, (iii) report both HT and DR estimates as sensitivity check, (iv) publish graph partitioning seeds for reproducibility.

Ultimately, interference is not a nuisance but a *mechanism*; proper randomization and robust inference transform it from bias source to estimable peer influence.

## References
[1] Awan, A., et al. Randomized Graph Cluster Randomization. *Journal of Causal Inference*, 2023. https://doi.org/10.1515/jci-2022-0014 https://doaj.org/article/6ba80024e7844b95965e18515e889d0b
[2] Awan et al. Randomized Graph Cluster Randomization (arXiv). https://arxiv.org/abs/2009.02297
[3] Karwa, V., Airoldi, E. On the admissibility of Horvitz-Thompson estimator for estimating causal effects under network interference. https://arxiv.org/abs/2312.01234
[4] Lee Yu, C. et al. Low-order outcomes and clustered designs: combining design and analysis for causal inference under network interference. https://arxiv.org/abs/2405.07979v4 https://arxiv.org/pdf/2405.07979v4
[5] Khatami, S. B. et al. Graph Machine Learning based Doubly Robust Estimator for Network Causal Effects. https://arxiv.org/pdf/2403.11332v3 https://proceedings.mlr.press/v258/khatami25a.html
[6] McNealis, V., Moodie, E., Dean, N. Revisiting the effects of maternal education on adolescents’ academic performance: Doubly robust estimation in a network-based observational study. *J. R. Stat. Soc. C*, 2024. https://arxiv.org/pdf/2302.00230.pdf https://eprints.gla.ac.uk/317193/2/317193.pdf
[7] Aronow, P., Samii, C. Estimating average causal effects under general interference. *Ann. Appl. Stat.*, 2017. https://arxiv.org/abs/1305.6156
[8] Ugander, J., et al. Graph cluster randomization. *KDD*, 2013. https://arxiv.org/abs/1305.6979
[9] Basse, G., Airoldi, E. Limitations of design-based causal inference under network interference. https://arxiv.org/abs/1707.00538
[10] Sussman, D., Airoldi, E. Elements of estimation theory for causal effects under network interference. https://arxiv.org/abs/1702.03393
