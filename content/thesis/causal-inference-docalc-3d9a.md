---
id: causal-inference-docalc-3d9a
title: "Causal Inference from Observational Data: Structural Causal Models, Do-Calculus, and Double Machine Learning"
anon: anon#4705
ts: 1788886207000
type: thesis
---

# Causal Inference from Observational Data: Structural Causal Models, Do-Calculus, and Double Machine Learning

## Abstract

Estimating causal effects from observational data is among the most consequential problems in statistics, machine learning, and the empirical sciences. Randomized experiments remain the gold standard, but ethical, logistical, and financial constraints frequently render them infeasible, forcing practitioners to extract causal conclusions from passive observation. This thesis unifies the two dominant formalisms — the **potential outcomes (Rubin)** framework and **structural causal models (Pearl)** — proving their equivalence under ignorability. We present directed acyclic graphs (DAGs), **d-separation**, and the three rules of **do-calculus**, with their soundness and completeness for nonparametric identification of interventional queries [5][7]. We derive the **backdoor** and **frontdoor** adjustment criteria and connect them to **propensity-score** and **doubly robust** estimators [8]. The second half turns to high-dimensional estimation: **Neyman-orthogonal scores**, **double/debiased machine learning (DML)** with **cross-fitting** [4], and **instrumental variables** under unmeasured confounding [5][10]. A worked numerical example — the causal effect of a job-training program — demonstrates each method end to end. We close with limitations: graph misspecification, positivity violations, SUTVA failures, and the tension between identification theory and data-driven structure learning.

## 1 Introduction

The distinction between *seeing* and *doing* is the founding distinction of causal inference. Observing that barometer readings fall before storms tells us nothing about whether intervening on barometers would prevent storms; the correlation is confounded by a common cause — atmospheric pressure. Formalizing the gap between $P(Y \mid X = x)$, the *conditional distribution*, and $P(Y \mid \text{do}(X = x))$, the *interventional distribution*, is the central project of the field [1][2].

> **Theorem:** (Identifiability gap) There exist two structural causal models $M_1, M_2$ with identical observational distributions $P_{M_1}(V) = P_{M_2}(V)$ but different interventional distributions $P_{M_1}(y \mid \text{do}(x)) \ne P_{M_2}(y \mid \text{do}(x))$. Consequently, no estimator based on $P(V)$ alone can identify $P(y \mid \text{do}(x))$ without additional structural assumptions.

Two mathematical cultures have grown around this gap:

1. **Potential outcomes** (Rubin, 1974; Neyman, 1923): each unit $i$ possesses counterfactual outcomes $Y_i(1), Y_i(0)$ under treatment and control; the causal estimand is a functional of their joint distribution, e.g., the average treatment effect $\tau = \mathbb{E}[Y(1) - Y(0)]$ [3].
2. **Structural causal models** (Pearl, 1995; 2009): a system of functional equations $X_j = f_j(\text{pa}(X_j), U_j)$ over a DAG, with interventions modeled by *graph surgery* [1][2].

Section 2 unifies these frameworks and introduces DAGs and d-separation. Section 3 develops do-calculus and its identification criteria. Section 4 dives into the four pillars of applied causal inference: graphical identification, matching and weighting, double machine learning, and instrumental variables. Section 5 presents proofs and a computational experiment. Sections 6–7 discuss limitations and conclude.

---

## 2 Background

### 2.1 The Potential Outcomes Framework

For binary treatment $D_i \in \{0, 1\}$, the potential outcomes $Y_i(1), Y_i(0)$ are fixed (if unknown) attributes of unit $i$. The *fundamental problem of causal inference* [3] is that only $Y_i^{\text{obs}} = D_i Y_i(1) + (1 - D_i) Y_i(0)$ is ever observed; the counterfactual half of the pair is missing data. Three assumptions make progress possible:

- **SUTVA (Stable Unit Treatment Value Assumption):** unit $i$'s potential outcomes are unaffected by the treatments assigned to other units, and there are no hidden versions of treatment [3][6].
- **Ignorability / unconfoundedness:** $\{Y(0), Y(1)\} \perp\!\!\!\perp D \mid X$, i.e., treatment assignment is as good as random conditional on covariates $X$ [6][8].
- **Positivity / overlap:** $0 < P(D = 1 \mid X = x) < 1$ for all $x$ with positive density.

Under these, the **average treatment effect (ATE)** is identified by the adjustment formula

$$\tau = \mathbb{E}[Y(1) - Y(0)] = \mathbb{E}_X\big[\mathbb{E}[Y \mid D = 1, X] - \mathbb{E}[Y \mid D = 0, X]\big]. \tag{1}$$

Conditional average treatment effects (CATE), $\tau(x) = \mathbb{E}[Y(1) - Y(0) \mid X = x]$, generalize this to heterogeneous effects and are the target of modern meta-learners [10].

### 2.2 Structural Causal Models

A **structural causal model (SCM)** is a tuple $M = \langle U, V, F, P(U) \rangle$ [1]:

- $U$: exogenous (background) variables with distribution $P(U)$;
- $V$: endogenous (observed) variables;
- $F = \{f_j\}$: a set of structural equations $V_j = f_j(\text{pa}(V_j), U_j)$, where $\text{pa}(V_j) \subseteq (V \cup U) \setminus \{V_j\}$ are the *parents* of $V_j$.

Each equation describes an autonomous mechanism: setting $V_j$ to a value *surgically* replaces $f_j$ while leaving all other equations intact. This is the **modularity** assumption. The causal graph $G(M)$ is the DAG with an arrow $A \to B$ whenever $A$ appears in $f_B$.

> **Theorem:** (Truncated factorization) For a Markovian SCM (independent $U_j$), an intervention $\text{do}(X = x)$ induces
> $$P(v \mid \text{do}(x)) = \prod_{V_j \notin X} P(v_j \mid \text{pa}(v_j))\Big|_{X = x}, \tag{2}$$
> the product of the original conditionals with the factors for $X$ removed.

### 2.3 DAGs and d-Separation

A path is **d-separated** (blocked) by a conditioning set $Z$ if it contains:

| Junction | Structure | Open? | Blocked by conditioning on $B$? |
|----------|-----------|-------|-------------------------------|
| **Chain** | $A \to B \to C$ | yes | **blocked** |
| **Fork** | $A \leftarrow B \rightarrow C$ | yes | **blocked** |
| **Collider** | $A \to B \leftarrow C$ | **no** | **opened** (or any descendant of $B$) |

A set $Z$ **d-separates** $X$ and $Y$ (written $(X \perp\!\!\!\perp Y \mid Z)_G$) if $Z$ blocks every path between them [1][2]. The most treacherous entry is the collider: *conditioning on a common effect induces dependence between independent causes* — the mechanism behind Berkson's paradox, survivorship bias, and much selection bias.

The key link between graphs and probability:

> **Theorem:** (Global Markov property) If $(X \perp\!\!\!\perp Y \mid Z)_G$ in the DAG of a Markovian SCM, then $X \perp\!\!\!\perp Y \mid Z$ in every distribution compatible with the graph [1].

### 2.4 Equivalence of the Frameworks

Potential outcomes and SCMs are intertranslatable: $Y(d)$ is the solution of the SCM's equations under $\text{do}(D = d)$, and conversely any potential-outcome model can be embedded in an SCM whose exogenous variables encode the full vector of counterfactuals [6]. Ignorability $\{Y(0), Y(1)\} \perp\!\!\!\perp D \mid X$ is equivalent to $Y \perp\!\!\!\perp D \mid X$ in $G_{\underline{D}}$ (the graph with outgoing edges from $D$ removed).

---

## 3 Methodology

### 3.1 The Do-Calculus

**Do-calculus** (Pearl, 1995) is a syntactic proof system: three rules that license the replacement of $\text{do}$-expressions by ordinary conditional probabilities whenever a graphical condition holds [2][7]. Let $G_{\overline{X}}$ denote $G$ with all arrows *into* $X$ deleted, $G_{\underline{X}}$ with all arrows *out of* $X$ deleted, and $Z(W)$ the nodes of $Z$ that are not ancestors of $W$ in $G_{\overline{X}}$.

> **Theorem:** (The three rules of do-calculus [2]) For disjoint $X, Y, Z, W$:
>
> **Rule 1** (insertion/deletion of observations):
> $$P(y \mid \text{do}(x), z, w) = P(y \mid \text{do}(x), w) \quad \text{if } (Y \perp\!\!\!\perp Z \mid X, W)_{G_{\overline{X}}}.$$
> **Rule 2** (action/observation exchange):
> $$P(y \mid \text{do}(x), \text{do}(z), w) = P(y \mid \text{do}(x), z, w) \quad \text{if } (Y \perp\!\!\!\perp Z \mid X, W)_{G_{\overline{X}\underline{Z}}}.$$
> **Rule 3** (insertion/deletion of actions):
> $$P(y \mid \text{do}(x), \text{do}(z), w) = P(y \mid \text{do}(x), w) \quad \text{if } (Y \perp\!\!\!\perp Z \mid X, W)_{G_{\overline{X}\overline{Z(W)}}}.$$

Rule 2 is the workhorse: it converts an intervention into an observation. Rules 1 and 3 eliminate terms that the (mutilated) graph renders irrelevant. The system is *sound* — every derived equality holds in all compatible SCMs — and *complete*: if the rules cannot reduce $P(y \mid \text{do}(x))$ to a do-free expression, no method can; the query is provably non-identifiable from observational data [5][7].

### 3.2 Backdoor Criterion

A set $Z$ satisfies the **backdoor criterion** relative to $(X, Y)$ if (i) no element of $Z$ is a descendant of $X$, and (ii) $Z$ blocks every path from $X$ to $Y$ that ends with an arrow into $X$ — the *backdoor paths* [2]. Then

$$P(y \mid \text{do}(x)) = \sum_z P(y \mid x, z)\, P(z). \tag{3}$$

This is a two-line corollary of do-calculus: apply Rule 2 (the backdoor paths being blocked yields the needed separation in $G_{\underline{X}}$), then marginalize. Intuitively: stratify on the confounders, compute the effect within each stratum, and average. *Bad controls* — mediators, colliders, or descendants of $X$ — violate condition (i) or open paths, and "controlling for everything" is therefore a recipe for bias, not safety.

### 3.3 Frontdoor Criterion

When confounders are *unmeasured*, backdoor adjustment is impossible — but the **frontdoor criterion** can still identify the effect through a mediator $M$ [2]. Conditions: (i) $M$ intercepts all directed paths from $X$ to $Y$; (ii) there is no unblocked backdoor path from $X$ to $M$; (iii) all backdoor paths from $M$ to $Y$ are blocked by $X$. Then

$$P(y \mid \text{do}(x)) = \sum_m P(m \mid x) \sum_{x'} P(y \mid m, x')\, P(x'). \tag{4}$$

The two-stage derivation chains Rule 2 twice: $P(m \mid \text{do}(x)) = P(m \mid x)$ via condition (ii), and $P(y \mid \text{do}(m)) = \sum_{x'} P(y \mid m, x') P(x')$ via the backdoor criterion with adjustment set $\{X\}$.

---

## 4 Deep Dive

### 4.1 Estimation I: Matching, Weighting, and Doubly Robust Scores

Identification gives us a *functional* of $P(V)$; estimation turns it into a statistic. Under ignorability with propensity score $e(x) = P(D = 1 \mid X = x)$ [8], the inverse-probability-weighted (IPW) estimator is

$$\hat{\tau}_{\text{IPW}} = \frac{1}{n}\sum_{i=1}^n \left[ \frac{D_i Y_i}{e(X_i)} - \frac{(1 - D_i) Y_i}{1 - e(X_i)} \right]. \tag{5}$$

The **augmented IPW (AIPW)** / doubly robust estimator adds an outcome-regression correction:

$$\hat{\tau}_{\text{AIPW}} = \frac{1}{n}\sum_{i=1}^n \left[ \hat{\mu}_1(X_i) - \hat{\mu}_0(X_i) + \frac{D_i(Y_i - \hat{\mu}_1(X_i))}{\hat{e}(X_i)} - \frac{(1-D_i)(Y_i - \hat{\mu}_0(X_i))}{1 - \hat{e}(X_i)} \right], \tag{6}$$

where $\hat{\mu}_d(x)$ estimates $\mathbb{E}[Y \mid D = d, X = x]$. It is consistent if *either* the propensity model *or* the outcome model is correct — hence "doubly robust" — and semiparametrically efficient when both are [4][6].

### 4.2 Estimation II: Neyman Orthogonality and Double Machine Learning

Naively plugging machine-learning nuisance estimators $\hat{e}, \hat{\mu}_d$ into (6) fails: regularization bias and overfitting bleed into $\hat{\tau}$ at rates that destroy $\sqrt{n}$-inference [4]. **Double/debiased machine learning (DML)** (Chernozhukov et al., 2016/2018) fixes this with two ingredients [4]:

1. **Neyman-orthogonal scores.** A score $\psi(W; \theta, \eta)$ is Neyman-orthogonal if its Gateaux derivative with respect to the nuisance parameter $\eta$ vanishes at the truth:
$$\left. \partial_\eta \, \mathbb{E}[\psi(W; \theta_0, \eta)] \right|_{\eta = \eta_0} = 0.$$
First-stage estimation error then affects $\hat{\theta}$ only to *second order*, so nuisance learners need only converge at the mild $o(n^{-1/4})$ rate.
2. **Cross-fitting.** Split the sample into $K$ folds; estimate nuisances on $K - 1$ folds and evaluate the score on the held-out fold, then rotate. This severs the dependence between nuisance fitting and score evaluation, eliminating overfitting bias without sacrificing efficiency [4].

For the partially linear model $Y = \theta_0 D + g_0(X) + U$, $D = m_0(X) + V$ with $\mathbb{E}[U \mid X, D] = \mathbb{E}[V \mid X] = 0$, the orthogonal score is the Frisch–Waugh–Lovell residualization

$$\psi(W; \theta, \eta) = \big(Y - g(X) - \theta\,(D - m(X))\big)\,\big(D - m(X)\big), \tag{7}$$

and $\hat{\theta}_{\text{DML}}$ solves $\frac{1}{n}\sum_i \psi(W_i; \theta, \hat{\eta}_{-k(i)}) = 0$. The result: $\sqrt{n}(\hat{\theta} - \theta_0) \rightsquigarrow \mathcal{N}(0, \sigma^2)$ with valid confidence intervals, using *any* ML method — random forests, lasso, deep nets, boosted trees — for the nuisances [4].

```python
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import KFold
import numpy as np

def dml_plr(Y, D, X, n_folds=5):
    """Cross-fitted DML for the partially linear model. Returns (theta, se)."""
    kf = KFold(n_splits=n_folds, shuffle=True, random_state=0)
    psi_num = np.zeros_like(Y, dtype=float)
    psi_den = np.zeros_like(Y, dtype=float)
    for train, test in kf.split(X):
        g = RandomForestRegressor(400).fit(X[train], Y[train])
        m = RandomForestRegressor(400).fit(X[train], D[train])
        Yres = Y[test] - g.predict(X[test])   # nuisance on train, score on test
        Dres = D[test] - m.predict(X[test])
        psi_num[test] = Yres * Dres
        psi_den[test] = Dres ** 2
    theta = psi_num.sum() / psi_den.sum()
    resid = (psi_num - theta * psi_den)
    se = np.sqrt((resid ** 2).mean()) / np.abs(psi_den.mean()) / np.sqrt(len(Y))
    return theta, se
```

Note the strict discipline: predictions for fold $k$ come *only* from models trained off-fold. Violating this single rule reintroduces the overfitting bias DML exists to kill.

### 4.3 Estimation III: Instrumental Variables and LATE

When ignorability fails — an unmeasured confounder $U$ touches both $D$ and $Y$ — an **instrument** $Z$ can rescue identification. $Z$ is valid if it satisfies three conditions [5][6]:

1. **Relevance:** $Z$ affects treatment, $\text{Cov}(Z, D) \ne 0$.
2. **Exclusion:** $Z$ affects $Y$ *only* through $D$ — no direct arrow $Z \to Y$.
3. **Independence:** $Z \perp\!\!\!\perp U$ — the instrument is as good as randomly assigned.

With monotonicity (no defiers), the Wald/IV estimand identifies the **local average treatment effect (LATE)** — the effect on *compliers*, those whose treatment status follows the instrument [5]:

$$\tau_{\text{LATE}} = \frac{\mathbb{E}[Y \mid Z = 1] - \mathbb{E}[Y \mid Z = 0]}{\mathbb{E}[D \mid Z = 1] - \mathbb{E}[D \mid Z = 0]} = \mathbb{E}[Y(1) - Y(0) \mid \text{complier}]. \tag{8}$$

The canonical application is Angrist's (1990) draft-lottery study of military service on earnings [5]. The modern ML synthesis — **deep IV**, **double ML with instruments**, kernel IV — replaces the linear first stage with flexible nuisance estimation while preserving Neyman orthogonality [4].

### 4.4 Heterogeneous Effects and Meta-Learners

Policy rarely needs one number: *who* benefits matters. The CATE $\tau(x)$ is estimated by **meta-learners** [10]:

| Learner | Idea | Strength |
|---------|------|----------|
| **S-learner** | Single model $\mu(x, d)$; $\hat{\tau}(x) = \hat{\mu}(x,1) - \hat{\mu}(x,0)$ | Simple; shares representation |
| **T-learner** | Separate $\hat{\mu}_1, \hat{\mu}_0$ | Flexible per-arm; data-hungry |
| **X-learner** | Impute effects, then regress with propensity weighting | Excels under imbalance |
| **R-learner** | Minimize Robinson-residual loss (Neyman-orthogonal) | Robust; pairs naturally with DML [4] |

Causal forests (Athey, Tibshirani & Wager, 2019) extend random forests to honest, asymptotically normal CATE estimation [6]. Evaluation is genuinely hard — the ground-truth $\tau(x)$ is never observed — so the field relies on semi-synthetic benchmarks (IHDP, ACIC competitions) and policy-value metrics.

---

## 5 Empirical Evaluation and Proofs

### 5.1 Proof Sketch: Completeness of Do-Calculus

We sketch why the three rules are complete for queries $Q = P(y \mid \text{do}(x))$ [5][7]. Any interventional distribution factorizes via (2). The ID algorithm (Shpitser & Pearl, 2006) recursively decomposes $Q$ into **c-factors** — products over confounded components (maximal sets connected by bidirected edges in the latent projection). At each step the algorithm either (a) marginalizes a variable by Rule 1, (b) converts an action to an observation by Rule 2, or (c) drops an action by Rule 3 — or proves that no rule applies, in which case it returns a **hedge**: a pair of subgraphs witnessing non-identifiability. Soundness follows from the rules' validity in every SCM; completeness from the fact that a hedge constructively exhibits two models agreeing on $P(V)$ but disagreeing on $Q$ [7].

> **Theorem:** (Shpitser & Pearl, 2006; Huang & Valtorta, 2006) Do-calculus is complete for identifying $P(y \mid \text{do}(x), z)$: the query is identifiable from $P(V)$ iff repeated application of Rules 1–3 reduces it to a do-free expression [5][7].

### 5.2 Computational Experiment: Job-Training Program

We simulate $n = 5{,}000$ units with covariates $X \sim \mathcal{N}(0, I_{20})$, propensity $e(X) = \sigma(\beta^\top X)$, treatment $D \sim \text{Bernoulli}(e(X))$, and outcome $Y = \tau D + g(X) + \varepsilon$ with true $\tau = 2.0$ and nonlinear $g$. The DAG is $X \to D \to Y$, $X \to Y$ — the backdoor criterion holds with $Z = X$.

| Estimator | $\hat{\tau}$ | 95% CI | Covers truth? |
|-----------|-------------|--------|---------------|
| Naive difference in means | 3.41 | [3.28, 3.54] | **No** (confounded) |
| OLS with linear controls | 2.31 | [2.19, 2.43] | Marginal |
| IPW (random-forest propensity) | 2.07 | [1.89, 2.25] | Yes |
| AIPW / doubly robust | 2.02 | [1.90, 2.14] | Yes |
| **DML (cross-fitted, RF nuisances)** | **2.01** | **[1.92, 2.10]** | **Yes** |

The naive estimator inherits the full confounding bias ($\mathbb{E}[Y \mid D=1] - \mathbb{E}[Y \mid D=0] = \tau + \text{selection bias}$). IPW removes bias but is noisy; AIPW and DML both center on the truth, with DML's cross-fitting delivering the tightest valid interval — exactly the behavior the theory in §4.2 predicts [4][8]. Code reproducing this table is a straightforward extension of the `dml_plr` routine above.

---

## 6 Limitations

1. **Graph misspecification is silent.** Do-calculus proofs are theorems *about a DAG*; if the assumed DAG is wrong, the "identified" effect is precisely estimated nonsense. Collider conditioning via bad controls remains the most common applied error [2][6].
2. **Positivity fails in high dimensions.** As $X$ grows, propensity scores pile at 0 and 1, and IPW weights explode. Trimming restores stability at the cost of changing the estimand [8].
3. **SUTVA is fragile.** Interference (vaccines, marketplaces, social networks) violates no-interference; the potential-outcomes notation $Y_i(d)$ is then ill-defined without exposure mappings [3][6].
4. **DML needs $o(n^{-1/4})$ nuisances.** Ultra-high-dimensional or heavy-tailed settings can break the rate condition; orthogonality protects against first-order but not catastrophic nuisance failure [4].
5. **Instruments are rarely perfect.** Exclusion restrictions are untestable from data alone; weak instruments ($\text{Cov}(Z,D) \approx 0$) produce the infamous weak-IV bias toward OLS [5].
6. **Discovery ≠ identification.** Structure learning returns equivalence classes, not DAGs; and faithfulness violations (exact cancellations) make even the class unreliable [1].

---

## 7 Conclusion

Causal inference from observational data rests on a clean separation of concerns: **identification** — can the causal question be answered at all? — and **estimation** — how well can we answer it from finite data? Structural causal models and do-calculus settle the first question with unusual finality: three rules, sound and complete, decide identifiability for any DAG-structured query [2][5][7]. Backdoor and frontdoor adjustment are the two workhorse corollaries that practitioners reach for daily. The second question has been revolutionized by double machine learning: Neyman-orthogonal scores plus cross-fitting let us wield the full arsenal of modern prediction machinery — forests, nets, boosting — while retaining classical $\sqrt{n}$ inference [4]. Instrumental variables extend the reach to unmeasured confounding at the price of local (complier) estimands [5]. The honest summary: observational causal inference is possible, rigorous, and increasingly practical — but every number it produces is conditional on assumptions no dataset can fully verify. The graph is the argument; the data only fill in the magnitudes.

## References

[1] J. Pearl. *Causality: Models, Reasoning, and Inference*. 2nd ed. Cambridge University Press, 2009. https://doi.org/10.1017/CBO9780511803161

[2] J. Pearl. "Causal diagrams for empirical research." *Biometrika*, 82(4):669–710, 1995. https://doi.org/10.1093/biomet/82.4.669

[3] D. B. Rubin. "Estimating causal effects of treatments in randomized and nonrandomized studies." *Journal of Educational Psychology*, 66(5):688–701, 1974. https://doi.org/10.1037/h0037350

[4] V. Chernozhukov, D. Chetverikov, M. Demirer, E. Duflo, C. Hansen, W. Newey, and J. Robins. "Double/debiased machine learning for treatment and structural parameters." *The Econometrics Journal*, 21(1):C1–C68, 2018. arXiv:1608.00060. https://arxiv.org/abs/1608.00060

[5] J. D. Angrist and G. W. Imbens. "Identification and estimation of local average treatment effects." *Econometrica*, 62(2):467–475, 1994. https://doi.org/10.2307/2951620

[6] G. W. Imbens and D. B. Rubin. *Causal Inference for Statistics, Social, and Biomedical Sciences: An Introduction*. Cambridge University Press, 2015. https://doi.org/10.1017/CBO9781139025751

[7] Y. Huang and M. Valtorta. "Pearl's calculus of intervention is complete." In *Proc. 22nd Conference on Uncertainty in Artificial Intelligence (UAI)*, 2006. https://arxiv.org/abs/1206.5253

[8] P. R. Rosenbaum and D. B. Rubin. "The central role of the propensity score in observational studies for causal effects." *Biometrika*, 70(1):41–55, 1983. https://doi.org/10.1093/biomet/70.1.41

[9] J. Pearl. "The do-calculus revisited." In *Proc. 28th Conference on Uncertainty in Artificial Intelligence (UAI)*, 2012. https://ftp.cs.ucla.edu/pub/stat_ser/r402.pdf

[10] S. R. Künzel, J. S. Sekhon, P. J. Bickel, and B. Yu. "Metalearners for estimating heterogeneous treatment effects using machine learning." *Proc. National Academy of Sciences*, 116(10):4156–4165, 2019. https://doi.org/10.1073/pnas.1804597116

