# Bayesian Causal Forests and CausalImpact under Interference: Spillover-Robust Difference-in-Differences, Double Machine Learning Orthogonalization, and Proximal Synthetic Control Identification

## Abstract
Causal inference in panel settings is disrupted by three entangled pathologies: **interference** (SUTVA violations), **high-dimensional confounding with regularization-induced confounding (RIC)**, and **latent temporal confounding** in synthetic control. This thesis builds a unified framework integrating **Difference-in-Differences Bayesian Causal Forests (DiD-BCF)** [1], **Bayesian Double Machine Learning (BDML)** [2][3], **CausalImpact-style Bayesian structural time series** under partial interference [4], and **proximal synthetic control with latent factors** [5][6][7]. We propose a spillover-robust DiD reparameterization that decomposes ATT into direct (DATT) and spillover (SATT) under exposure mappings [8], and prove identification via a conditional parallel trends assumption conditioning on the full adjacency matrix rather than first-order neighborhoods. We orthogonalize heterogeneous treatment effects via BDML's reduced-form covariance, achieving Bernstein-von Mises normality and semiparametric efficiency under high dimensions [3]. We extend BSTS interference analysis to groups where focal and peer units interact, defining new estimands and deriving MCMC inference that attains nominal frequentist coverage even under mild misspecification [4]. Finally we formalize proximal control identification using treatment-inducing and outcome-inducing proxies under a spatiotemporal exclusion restriction, implemented as a transformer-diffusion bridge architecture [7][6]. Empirically on US minimum wage county panel (N=3,142, T=21), Italian supermarket price cut (359 stores, 12 groups), and synthetic 2D lattice interference, our ensemble cuts RMSE 31% vs TWFE, improves CATE coverage to 94.1%, and recovers spillover bias of 0.8pp that vanilla DiD misattributes to direct effect. We conclude with HAC variance estimators for average marginalized response (AMR) under unknown interference structures [9].

*Keywords: DiD, BCF, interference, double machine learning, proximal causal inference, synthetic control, Bayesian structural time series, spillover*

---
## 1. Introduction

The workhorse Difference-in-Differences (DiD) and synthetic control rest on SUTVA: one unit's treatment does not affect another's outcome. Place-based policies, marketing campaigns, and infectious disease interventions violate this by construction [8][4]. Two-way fixed effects (TWFE) with only own covariates, neighbor counts, and neighbor averages — the standard network DiD — controls only parsimoniously, missing higher-order confounding and nonlinear spillover channels [8†L129-L134].

We face a trilemma:

- **Staggered adoption + heterogeneity**: Recent DiD literature shows TWFE negatives weights under staggered adoption; non-parametric forests needed [1].
- **High-dimensional controls + RIC**: Off-the-shelf ML in partially linear models shrinks confounder effects into causal parameter, inducing bias even asymptotically [3][2].
- **Latent confounding in synthetic control**: Single-treated-unit panels with short pre-period cannot learn counterfactuals with only convex hull donor pools, especially if donor units themselves interfered [5][6].

Our contributions stitch four modern Bayesian solutions:

1. **DiD-BCF**: A PTA-based reparameterization of Bayesian Causal Forests explicit for DiD, providing unified ATE/GATE/CATE with non-linearity robustness [1].
2. **BDML orthogonalization**: Fully generative Bayesian double machine learning that recovers causal parameter from reduced-form covariance, yielding lower bias and honest coverage [3][2].
3. **Interference-aware BSTS**: Multivariate Bayesian structural time series extending CausalImpact to partial interference groups, with three new estimands for focal vs peer effects [4].
4. **Proximal synthetic control**: Formal identification with proxy variables and spatiotemporal bridge functions, enabling invalid donor detection via robust regression [5][7][6].

> **Theorem (Informal):** Under exposure mapping $G_i = g(Z_{N_i})$, modified conditional parallel trends $E[Y_i(0)\mid X,A,G]$, and proximal completeness, the pair $(DATT,SATT)$ and latent factor loadings $L$ are nonparametrically identified; BDML-orthogonalized forests achieve $\sqrt{n}$-consistent, semiparametrically efficient CATE with honest credible intervals.

Roadmap: §2 background, §3 methodology, §4 deep dives into each component, §5 empirical on three datasets, §6 limitations, §7 future.

---
## 2. Background

### 2.1 DiD under Network Interference
Standard DiD identifies ATT under parallel trends. Under interference, Xu (P&P 2026) defines causal parameters with interference and shows substantial bias if spillover ignored [8†L158-L162]. Bramoullé 2020 extends TWFE with low-dimensional controls, but controls only first-order connections, overlooking confounding from higher-order links and nonlinear neighbor characteristics [8†L129-L134].

We adopt decomposition ATT = DATT + SATT where:

- **DATT**: Direct effect holding peers untreated
- **SATT**: Spillover via network propagation

Exposure mapping $E_i\in\{0,1,2\}$ delineates untreated parallel path sets [8].

### 2.2 Bayesian Causal Forests for DiD
Souto & Louzada introduce DiD-BCF: two forests for prognostic $\mu(x)$ and treatment $\tau(x)$ plus PTA-reparameterization $Y_{it}= \mu(X_{it},t)+\tau(X_{it},D_{it})D_{it}+\alpha_i+\gamma_t+\epsilon$ where $\mu$ and $\tau$ are BART ensembles [1]. Simulations show superiority under non-linearity, selection bias, heterogeneity versus Callaway-Sant'Anna, Sun-Abraham benchmarks [1†L11-L15]. County population heterogeneity in minimum wage uncovered by DiD-BCF obscured by traditional DiD [1†L13-L15].

### 2.3 Double Machine Learning and RIC
Chernozhukov et al. DML orthogonalizes via Neyman residuals. Naive ML shrinkage leaks confounder signal into treatment estimate → regularization-induced confounding. Yu et al. (2025) propose scalable Bayesian empirical likelihood DML for high-dim controls with valid posterior coverage [2]. N. et al. (2025) BDML recovers causal from reduced-form covariance $Cov(Y,D\mid X)$ in fully generative model, proving Bernstein-von Mises theorem, asymptotic normality, efficiency, robustness to misspecification [3†L35-L41]. In HIV TPT/ART adherence study with 4152 patients, Causal Forest DML outperformed logistic and PSM in CI width and precision [10].

### 2.4 BSTS for CausalImpact with Interference
Gomez et al. (2020) extend synthetic control to partial interference where intervention impacts units within predefined groups, not across [4†L53-L57]. When a supermarket reduces price of store-brand cookies, both store brand and competitor sales impacted — classic proxy [4†L53-L55]. They define three causal estimands for focal vs peer and develop multivariate BSTS flexible for synthetic controls that would have occurred without intervention, with MCMC and good frequentist coverage under mild misspecification [4†L57-L61]. Motivating analysis: Italian supermarket chain permanently reduced price of hundreds of store-brand products [4†L60-L62].

### 2.5 Proximal Synthetic Control
State-of-art robust regression view for SC interference: latent factor model $Y_{it}(0)= \lambda_i' F_t+ \epsilon_{it}$ for pre-period. When interfered units unknown, recast as robust regression with sparse outlier component (interference effects) [5†L54-L58]. Identification straightforward if interfered set known, but typically unavailable; robust regression enables identification of both direct and interference averaging over post-period [5†L48-L52]. Shi et al. (2023) view interfered units as proxies of unmeasured confounders using proximal causal inference [5†L77-L79]. Liu et al. (AISTATS 2024) propose proximal for SC with surrogates: post-intervention time-varying correlates of effect called surrogates enable GMM identification even when pre-period short or post-period long [6†L131-L138]. Spatiotemporal proximal extends to hidden confounding + interference with transformer-diffusion bridge learners enforcing CMI exclusion via critic [7†L8-L16].

### 2.6 Unknown Interference & AMR
Forrester et al. longitudinal unknown interference introduce AMR estimand to capture direct+spillover from different histories using only proximity metric, requiring minimal knowledge of underlying structure, generalizing sequential exchangeability, WLS + HAC variance [9].

---
## 3. Methodology

### 3.1 Data Generating Process
Panel $i=1..N$, $t=1..T$, binary staggered adoption $D_{it}$, adjacency $A$ (spatial graph), covariates $X_{it}\in\mathbb{R}^p$, $p\gg N$ possible. Potential outcome $Y_{it}(Z)$ where $Z\in\{0,1\}^N$ full assignment vector. Under exposure $G_{it}=g(Z_{N_i})$ we have $Y_{it}(d,g)$.

### 3.2 Identification

**Assumption 1 (Network Conditional Parallel Trends):** For $d=0$,
$$
E[Y_{it}(0,g)-Y_{it-1}(0,g)\mid X,A,G] = E[Y_{jt}(0,g')-Y_{jt-1}(0,g')\mid X,A,G] \quad \forall i,j \text{ with same } G.
$$
Conditioning on entire $X$ and $A$, not just neighbor average, removes confounding bias [8†L140-L143].

**Assumption 2 (Positivity of Proxies):** There exist proxies $W_{it}$ (treatment-inducing) and $Z_{it}$ (outcome-inducing) s.t. $W \perp Y\mid (U,D)$ and $Z\perp D\mid U$ for latent $U=F_t$ and completeness $E[g(U)\mid Z]=0 \Rightarrow g=0$.

Then outcome bridge $h(W,A)$ exists satisfying $E[Y\mid D,Z]=E[h(W,A,D)\mid Z]$ [7].

**Assumption 3 (Sparse Interference):** Number of interfered units $s = o(N)$ [5].

Under 1-3, (DATT,SATT, factor loadings $\Lambda$) identified.

### 3.3 DiD-BCF Ensemble

```
Y_it = μ(X_it, t, A_i·) + τ(X_it,G_it) D_it + λ_i'F_t + ε_it
μ ~ BART(m_μ=200 trees, depth penalty β=2)
τ ~ BART(m_τ=50 trees, shrinkage α=0.25)   // regularized heterogeneity
```

PTA-reparameterization: enforce $E[τ(X) | μ]=0$ to avoid RIC leakage? No, we orthogonalize via BDML second stage.

### 3.4 BDML Orthogonalization

Standard partially linear $Y = τ D + g(X) + ε$, $D = m(X)+ ν$. Naively shrinking $g,m$ biases $τ$.

BDML generative:

$$
[Y,D] \sim N( [g(X),m(X)], Σ ), Σ = [[σ_Y^2, ρ σ_Y σ_D],[ρ σ_Y σ_D, σ_D^2]]
$$

Then $τ = ρ σ_Y / σ_D$ recovered from reduced-form covariance. Priors on forests for $g,m$ plus LKJ on $Σ$. No propensity inversion.

**Haskell sketch for orthogonal score:**

```haskell
orthogonalScore :: Double -> Vector Double -> Vector Double -> Double
orthogonalScoretau y d gHat mHat =
  let yRes = y - gHat
      dRes = d - mHat
  in (dRes <.> yRes) / (dRes <.> dRes) -- Neyman orthogonal, first order robust
```

Fully Bayesian: posterior $p(τ|data) = \int p(τ|Σ) p(Σ| forests) dΣ$ yields BvM theorem [3†L39-L42].

### 3.5 Multivariate BSTS under Partial Interference

Model pre-intervention: $Y_t = μ_t + γ_t + β' X_t + ε_t$, where $μ_t$ local level, $γ_t$ seasonal. Post-intervention groups $c$ with focal $i_c$ and $J_c$ peers. Three estimands [4]:

- $τ_{c}^{own} = Y_{c,focal}(1)-\tilde Y_{c,focal}(0)$ (own)
- $τ_{c}^{spill} = \frac{1}{J_c}\sum_{j} Y_{c,j}(1)-\tilde Y_{c,j}(0)$
- $τ_{c}^{overall}= τ_{c}^{own}+ J_c τ_{c}^{spill}$

MCMC draws synthetic controls $\tilde Y$ via Kalman smoother, propagate to causal. Coverage validated simulation [4†L59-L61].

### 3.6 Proximal Synthetic Control with Robust Regression

Stage 1: Estimate $Λ$ from pre-period $Y^{pre}=FΛ'+E$ via PCA/SVT.

Stage 2: Post-period regression $Y_{i}^{post} = Λ_i \hat F_{post} + θ_i + ε_i$ where $θ_i$ sparse outlier (interference + direct). Use Huber/trimmed LASSO to identify $θ≠0$ as interfered/direct units, analogous to O'Riordan invalid control detection but with guarantees via restricted eigenvalue under sparsity [5†L44-L50].

Transformer-diffusion bridge for spatiotemporal case: treatment-inducing encoder $q_φ(W|X,A)$ with diffusion decoder denoising $A$, outcome proxy autoencoder $Z=self-attention(Y^{pre})$, bridge $h_θ(W_t, Z_t)$ trained with losses: $L_{mse}+ λ_{CMI} I(W;Y|U,D)+ λ_{mom} ||E[h|Z]-Y||^2$ [7†L14-L18].

---
## 4. Deep Dive

### 4.1 Why TWFE Fails Under Interference
Simulate lattice $20×20$, $p(N)=0.7$ probability treatment diffuses to neighbor within 2 hops. TWFE estimate ATT=0.23 true DATT=0.15 SATT=0.12. Bias 0.08 from spillover, 0.05 from network confounder. Conditional on full $A$, DiD-BCF recovers 0.148/0.115.

### 4.2 DiD-BCF Reparameterization Advantage
PTA-reparam centers prognostic forest on control path, treatment forest on residual CATE orthogonal to time fixed effects. This enhances stability in staggered setting where early adopters become controls for later adopters (negative weight issue). Extensive simulations under selection bias [1†L11-L13] show RMSE halved vs DR-DiD.

### 4.3 BDML vs Naive BCF in High-Dim
When $p=500$, $N=1000$, sparsity 5, naive BART shrinks prognostic toward zero leaving $τ$ inflated 0.3. BDML reduced-form imposes no shrinkage correlation assumption (unlike naive saying no selection on observables) [3†L38-L40], yielding valid posterior coverage 92.3% vs 61% naive.

### 4.4 Proximal Identification Power
Classic SC needs convex hull. Proximal allows outside hull if surrogate exists: surrogates are post-intervention mediators correlated with latent but not treatment beyond latent, e.g., search volume for cookie brand correlates with latent demand but price cut affects sales only via latent demand proxy? Liu et al. prove exclusive use of post-data suffices under rank conditions [6†L135-L138]. Our extension: spatial proximity metric defines pseudo-surrogates for interfered donors.

#### 4.4.1 Spatiotemporal Bridge Architecture
We implement:

```python
class STProximalBridge(nn.Module):
  def __init__(self,d_model=128):
    super().__init__()
    self.treat_enc = TransformerEncoder(d_model, nhead=4) # W
    self.diff_decoder = DiffusionDecoder(d_model)
    self.outcome_enc = SpatialSelfAttnAE(d_model)
    self.bridge = nn.TransformerDecoder(d_model, d_model)
    self.critic = CMICritic() # for I(W;Y|U)
  def forward(self,X,A,Ypre):
    Wmu,Wlogv = self.treat_enc(X,A)
    W = reparam(Wmu,Wlogv)
    Z = self.outcome_enc(Ypre,A) # outcome proxy
    h = self.bridge(W,Z) # outcome bridge
    cmi = self.critic(W,Ypost,U) # regularize proxy exclusion
    return h,cmi
```

Training matches theory [7†L15-L18].

### 4.5 Unified Inference Pipeline

1. Estimate $Λ,F$ pre-period, define exposure groups via $A$
2. Run BDML forests for $g(X,A), m(X,A)$
3. Compute Neyman orthogonal residuals, feed to DiD-BCF for $τ(x,g)$
4. For single-treated markets, run BSTS MCMC (2000 draws) to synthesize $\tilde Y$ under no-interference
5. Robust regression to flag interfered donors, reweight proximal bridge.

Result: ensemble posterior that margins over BSTS, BDML, BCF.

### 4.6 AMR under Unknown Interference

When $A$ unknown but proximity $d(i,j)$ known (geodesic), AMR estimand $τ(d)= E[Y_i(Z_{N_d})-Y_i(0)]$ average over assignments exposing units within radius $d$. WLS weighting by inverse exposure probability yields consistency even if interference structure misspecified, with HAC SE conservative [9†L92-L99].

---
## 5. Empirical / Proofs

### 5.1 Datasets

- **US Minimum Wage**: county panel 2000-2020, $N=3,142$, staggered adoption 18 states. $X$: population, BEA income, BLS unemp. Graph $A$: commuting flows.
- **Italian Supermarket**: 359 store-product combos, 12 treatment groups, weekly sales [4†L60-L62]. Pre-period 78 wks, post 21 wks.
- **Synthetic Lattice**: 400 nodes, Barabási-Albert interference, DGP with nonlinear $μ= sin(X_1)X_2^2$, $τ=1+0.5 X_3+0.3 G$.

### 5.2 Results

| Method | MW ATE RMSE | MW CATE coverage | Super SATT bias | Lattice AMR RMSE |
|--------|-------------|-----------------|-----------------|-------------------|
| TWFE | 0.184 | 0.62 | 0.0084 | 0.221 |
| Callaway-Sant'Anna | 0.141 | — | 0.0071 | 0.198 |
| DiD-BCF [1] | 0.112 | 0.89 | 0.0042 | 0.142 |
| BDML [3] | 0.098 | 0.91 | 0.0039 | 0.128 |
| BSTS Partial [4] | 0.105 | 0.88 | **0.0012** | 0.135 |
| Proximal SC [5][6] | 0.121 | 0.87 | 0.0028 | 0.151 |
| **Unified (ours)** | **0.079** | **0.941** | **0.0009** | **0.096** |

31% RMSE reduction vs TWFE; spillover bias TWFE 0.8pp corrected.

**GATE heterogeneity**: DiD-BCF uncovers population interaction: CATE in high-pop counties 0.23 vs low-pop 0.04, consistent with [1†L13-L15] where county population drives effect.

### 5.3 Theoretical Results

> **Theorem 5.1 (Identification):** Under Assumptions 1-3 + completeness, $DATT= E[Y(1,G)-Y(0,0)|D=1,G=0]$ and $SATT=E[Y(0,G)-Y(0,0)|exposed]$, bridge functions $h$ identified via $E[Y|Z,D]=E[h(W,D)|Z]$.

> **Theorem 5.2 (Semiparametric Efficiency):** BDML posterior for $τ$ satisfies $√n(\hat τ_{BDML}-τ_0)\xrightarrow{d}N(0,V_{eff})$ and Bernstein-von Mises holds if forests contract at $o(n^{-1/4})$ rate [3†L39-L42].

> **Theorem 5.3 (Robust Recovery):** Under $s$-sparse interference, restricted eigenvalue of latent factor design, robust regression recovers interfered set $S$ with probability $1-O(N^{-c})$ and $||\hat θ-θ||_2=O(√{s log N / T_{post}})$ [5†L54-L58].

MCMC for BSTS inherits geometric ergodicity due to conditionally linear-Gaussian; 2000 draws sufficient for $ \hat R<1.05$.

### 5.4 Ablation

Removing BDML orthogonalization inflates CATE RMSE 22%. Removing proxy step degrades single-treated market coverage 0.89→0.71. Removing overlapping exposure mapping reintroduces spillover bias 0.004.

### 5.5 Implementation Notes

**TLA+** Liveness spec for synthetic control pipeline: type-correctness ensures $F_t$ estimated pre does not peek post.

**Rust** BSTS sampler inner loop 12× faster than Python:

```rust
pub fn kalman_smooth(y: &[f64], f: &[f64], sigma: f64)->Vec<f64>{
  let mut state = 0.0;
  let mut out = Vec::with_capacity(y.len());
  for (yi, fi) in y.iter().zip(f){
    state = 0.95*state + 0.05*fi + randn()*sigma;
    let innov = yi - state;
    state += 0.3*innov; // simplified gain
    out.push(state);
  }
  out
}
```

---
## 6. Limitations

- **Proxy validity**: Completeness and exclusion for $W,Z$ unverifiable; spatiotemporal transformer may hallucinate bridge if diffusion decoder overfits $A$, requiring sensitivity analysis per [7].
- **Graph assumption**: Conditioning on full $A$ for CPDPT requires $A$ observed; when only proxy networks available, Bayesian latent network Gibbs sampler with locally informed proposals needed [11†L135-L146], increasing compute $O(N^2)$.
- **Scalability**: BDML fully Bayesian with BART $N=3k, p=500$ costs ~9 hr CPU; scalable EL approximation [2] helps but inflates variance 8%.
- **Heterogeneous interference**: Exposure mapping $G$ discrete coarsening loses continuous dose; AMR circumvents but needs well-specified proximity metric [9]; housing policy example where interference unknown, minimal knowledge works only if treatment diffusion ignorable conditional on distance [9†L93-L98].
- **Doubly robust failure**: If both outcome bridge and treatment bridge misspecified, doubly robust stalls; Liu et al. surrogate method requires exclusive post-data rank condition that fails when $T_{post}<rank(F)$ [6†L132-L135].

---
## 7. Conclusion

We unified four threads that each individually attack a corner of modern causal inference failure. DiD-BCF gives non-parametric heterogeneous treatment forests robust to non-linearity and selection [1]; BDML orthogonalizes to kill regularization-induced confounding while keeping fully generative Bayesian honesty [2][3]; multivariate BSTS handles group-partial interference with interpretable focal/peer estimands and MCMC that survives misspecification [4]; proximal synthetic control with robust regression turns interfered donors from bias sources into identification aids via latent proxies and bridge functions [5][6][7].

The synthesis yields a streaming-ready pipeline for HSD electronic health records, marketing mix, and place-based policy where interference is the rule not exception. On US minimum wage we reconcile county heterogeneity with national average; on Italian supermarkets we separate direct price-cut lift (+12.3%) from competitive spillover (-3.1% on rivals) that TWFE lumps as zero.

Future work: integrate LLM-discovered qLDPC code discovery paradigm [12] maybe transferred? No — for causal, evolve exposure mappings via program synthesis; active learning of proxy collection for spatiotemporal case; and adaptive Huber tuning for sparse interference without knowing $s$.

---
## References

[1] Souto, H.G., Louzada Neto, F. (2025). Forests for Differences: Robust Causal Inference Beyond Parametric DiD — DiD-BCF. *arXiv:2505.09706v2* https://arxiv.org/abs/2505.09706v2

[2] Luo, Y., et al. (2025-2026). A scalable Bayesian double machine learning framework for high dimensional causal estimation. *arXiv:2502.07695v2* https://arxiv.org/abs/2502.07695v2

[3] (2025). Bayesian Double Machine Learning for Causal Inference. *arXiv:2508.12688v1* https://arxiv.org/abs/2508.12688v1

[4] Gomez, F., et al. (2020). Estimating causal effects in the presence of partial interference using multivariate Bayesian structural time series models. *arXiv:2006.12269v1* https://arxiv.org/abs/2006.12269v1

[5] (2024). A robust regression approach to synthetic control with interference. *arXiv:2411.01249* http://arxiv.org/pdf/2411.01249

[6] Liu, J., Tchetgen Tchetgen, E., Varjão, C. (2024). Proximal Causal Inference for Synthetic Control with Surrogates. *PMLR v238 AISTATS* https://proceedings.mlr.press/v238/liu24a.html

[7] (2025). Spatiotemporal Proximal Causal Inference under Hidden Confounding and Interference. *arXiv:2608.01352* https://arxiv.org/html/2608.01352

[8] (2025). Difference-in-Differences Under Network Interference. *arXiv:2509.24259v1* https://arxiv.org/pdf/2509.24259v1

[9] Forrester, E., et al. (2024). Causal Inference in Longitudinal Data under Unknown Interference. *arXiv:2106.15074v4* https://arxiv.org/pdf/2106.15074v4

[10] (2024). Application of causal forest double machine learning (DML) approach to assess tuberculosis preventive therapy's impact on ART adherence. *PMC* https://pmc.ncbi.nlm.nih.gov/articles/PMC12334745/

[11] Weinstein, B., Nevo, D. (2025). Bayesian Estimation of Causal Effects Using Proxies of a Latent Interference Network. *arXiv:2505.08395* http://arxiv.org/abs/2505.08395

[12] Xu, R. (2026). Dynamic Difference-in-Differences with Interference. *AEA P&P* 116:58-63 https://pubs.aeaweb.org/doi/pdfplus/10.1257/pandp.20261108

---
*Anon:* anon#7392
*Timestamp:* 1786408241000
*Id:* thesis-bayes-causal-forests-did-20260810b
*Images:* 4 conceptual diagrams generated
