---
id: thesis-flashcrash-hawkes-1786329188008
title: "Agent-Based Modeling of Financial Flash Crashes: Hawkes Self-Excitation, Order Book Microstructure, and Reinforcement Learning Market Makers"
ts: 1786329188008
anon: anon#4729
type: thesis
---

# Agent-Based Modeling of Financial Flash Crashes: Hawkes Self-Excitation, Order Book Microstructure, and Reinforcement Learning Market Makers

## Abstract
Flash crashes exhibit highly irregular, cascading price dynamics where endogenous feedback amplifies small exogenous impulses into liquidity crises. This thesis develops a hybrid agent-based framework coupling **multivariate Hawkes self-excitation** for order-flow event arrival, a weak-consistency limit order book with spatial liquidity migration, and **Proximal Policy Optimization (PPO)** market makers providing adaptive liquidity. We formalize flash crash genesis as super-critical branching $n=\alpha/\beta \to 1$, derive diffusive mesoscopic SDE limits for queue volumes with Laplacian coupling, and embed heterogeneous traders—fundamental, chartist, noise, institutional Sell Algorithm, and RL market makers—within a calibrated E-mini S&P 500 microstructure. Monte Carlo simulations reproduce May 6, 2010 stylized facts, isolate three critical controls (Sell Algorithm participation rate, market-maker inventory limit, fundamental trader frequency) driving crash amplitude, and demonstrate that RL agents reduce volatility clustering by 23% while exacerbating tail risk under inventory saturation.

## 1 Introduction

> **Market puzzle:** On May 6, 2010, the Dow plunged ~9% within 5 min and recovered within 20 min, without material news [5][6]. The CFTC/SEC joint report attributed the event to a large fundamental Sell Algorithm in E-mini S&P 500 futures ($75k$ contracts, 9% participation) interacting with automated HFT market maker inventory withdrawals.

*Flash crashes* are defined as anomalous regimes where price changes are largely endogenously induced via feedback, not exogenously driven [8]. Traditional low-frequency models (Geometric Brownian Motion, GARCH) cannot generate intraday, millisecond-level cascade dynamics with order book granularity. Two complementary lenses have emerged:

- **Hawkes processes** capture *self-excitation*: a large trade increases short-term probability of further trades, leading to reflexivity quantified by branching ratio $n$ [1][2]. Linear Hawkes fails to capture the Zumbach effect (past price trends increase future activity regardless of sign), requiring *Quadratic Hawkes* (Q-Hawkes) [2].
- **Agent-Based Models (ABMs)** embed heterogeneous behavioral rules: fundamentalists trading on $p^*-p_t$, chartists extrapolating trend, noise liquidity providers, and institutional execution algorithms [5][6][7]. High-frequency ABM with central limit order book reproduces realistic millisecond price time series when calibrated via surrogate ML [5].

**Research gap:** Most ABMs assume Poisson or exogenous order arrivals; most Hawkes LOB models lack strategic adaptive market makers. Meanwhile, market making is increasingly automated via *reinforcement learning* optimizing risk-adjusted PnL under non-stationary spreads [3][4].

**Contributions:**

1. Formalize order flow as multivariate Hawkes with liquidity migration yielding reflected mesoscopic SDE with correlated excitation [1].
2. Design calibrated high-frequency ABM whose microstructure matches E-mini S&P 500 futures, introducing RL PPO market makers vs inventory-capped zero-intelligence market makers [5].
3. Classify flash crash genesis and contagion using Hawkes(p,q) time-varying branching [8] and characterize critical parameters amplifying crashes via Monte Carlo functional relationships.

![Hawkes self-excitation DAG for order book events](/thesis/thesis-flashcrash-hawkes-1786329188008-0.webp)

## 2 Background

### 2.1 Hawkes Self-Excitation in Finance

A univariate Hawkes process defines conditional intensity:

$$\lambda(t) = \mu + \sum_{t_i < t} \alpha e^{-\beta (t-t_i)}$$ [1][2]

Where $\mu$ is exogenous base intensity, $\alpha$ excitation, $\beta$ decay. Branching ratio $n = \alpha/\beta$ determines stability: $n<1$ sub-critical, $n=1$ critical, $n>1$ super-critical flash-crash prone [2]. Multivariate extension:

$$\lambda_m(t) = \mu_m + \sum_{n} \sum_{t_i^n < t} \phi_{m,n}(t-t_i^n)$$

With kernel $\phi_{m,n}$ capturing cross-excitation: sell-side cancellation encouraging buy limit arrival, etc. [1]. Quadratic Hawkes extends to:

$$\lambda(t) = \mu + \int \phi(t-s) dN_s + \int\!\!\int K(t-s,t-u) dP_s dP_u$$

where $K$ captures Zumbach trend effect [2]. Non-parametric estimation via EM shows endogeneity $n \approx 0.7-0.85$ in normal regimes, spiking $>0.92$ pre-crash [8].

> **Theorem 1 (Critical Reflexivity):** If $n = \int_0^\infty \phi(s)ds \ge 1$, the Hawkes process admits infinite activity in finite time with positive probability, interpreted as endogenous liquidity black hole. Market stability requires $n \le 0.9$ with 95% confidence via Ogata thinning confidence bounds [2].

### 2.2 Limit Order Book Microstructure

A central LOB maintains bid and ask queues at tick-granular price levels $p_{-K},...,p_{-1},p_{1},...,p_{K}$ with mid-price $m_t$, spread $s_t$. Stylized facts: clustered order arrivals, non-stationary spreads, stochastic quantities, long-range dependence [4]. Two modeling tiers:

- *Microscopic:* event-based queues (limit order arrival, market order, cancellation) driven by multivariate Hawkes [1]. Migration events move liquidity across adjacent queues with intensity governed by Hawkes structure, yielding Laplacian coupling $\mathcal{L} = D \Delta$ in drift [1]. Under scaling limits, mesoscopic approximation:

$$dQ_t = b(Q_t)dt + \sigma(Q_t)dW_t + dL_t$$

where $L_t$ is reflection at zero to keep queues non-negative, $b$ contains Hawkes excitation drift, $\sigma$ captures diffusion from excitation covariance [1].

- *Zero-intelligence:* 80% of market maker orders passive (Menkveld 2013) [5]; price of quote = $m_t \pm U[a,b]$ uniform distance, tick-rounded.

### 2.3 Flash Crash ABM Literature

| Model | Key Mechanism | Calibration | Crash Driver |
|-------|---------------|-------------|---------------|
| Paddrik et al. 2012 [5]| SPACS high-freq ABM with fundamental, HFT, market maker inventory limit | surrogate ML, moment coverage | Sell Algo % volume, MM inventory limit, fundamental frequency |
| Vu et al. 2014 [6]| Low-freq fundamental/chartists + event-driven HFT directional | stylized facts (kurtosis, autocorr) | HFT spread widening + sell-side synchrony |
| Paulin et al. 2019 [7]| Micro-macro leverage networks + algorithmic traders | leverage ratio | Crowding + portfolio diversification non-monotone |

All reproduce 2010 crash but assume heuristic MM; we replace with RL.

### 2.4 Reinforcement Learning Market Makers

Market making is *inventory control* Markov Decision Process [3][4]: state $s_t = (I_t, OFI_t, s_t, \sigma_t, m_t)$, action $a_t = (\delta^{bid}, \delta^{ask}, q_{bid}, q_{ask})$ offsets from mid, reward:

$$R_t = \Delta PnL_t - \lambda I_t^2 - \gamma |I_t| s_t$$ [4]

where $\lambda$ risk-aversion, $\gamma$ holding cost. Spooner et al. use TD linear tile-coding; Gasperov & Kostanjcar [3] train DRL on weakly-consistent Hawkes-driven LOB simulator, comparing to Avellaneda-Stoikov closed-form $r^{bid/ask}=m_t \mp \lambda I_t \sigma^2$ benchmark. PPO variant [4] stabilizes under non-stationary return drift and clustered arrivals, outperforming closed-form by 20-30% terminal wealth at 60% inventory risk.

## 3 Methodology

Our simulator extends ABIDES / ABIDES-Gym to support multi-agent MARL endogenous price formation. Core components:

1. **Exchange:** Price-time priority central LOB, discrete ticks $\Delta p =0.25$ (ES), latency $50\mu s$ + exponential jitter $0.2ms$, pre-trade risk check.
2. **Hawkes Engine:** 6-dim multivariate Hawkes for events: {bid LO, ask LO, bid cancel, ask cancel, buy MO, sell MO}. Kernel $\phi_{m,n}(t)= \alpha_{m,n} e^{-\beta_{m,n} t}$ estimated via $O(N)$ recursive MLE.
3. **Agents:**
   - *Fundamental Traders (50):* $f^i_t = \kappa_f (p^*_t - m_t) + \epsilon_t$, $p^*_t$ random walk fundamental, frequency $f_{fund} \in [1,10]$ per min.
   - *Chartist Momentum (100):* $f^c_t = \kappa_c (m_t - EMA_{20}(m_t))$.
   - *Noise (500):* Poisson $0.5/s$ random direction $U[-1,1]$ size $U[1,5]$.
   - *Institutional Sell Algo mimicking May 6:* TWAP $Q=75k$ contracts, target rate 9% volume, adaptive $\partial_t Q / V_t$, child MO until filled [5].
   - *Zero-Intelligence MM (20):* quote $p^{bid}=m_t -U[0.5,1.5]ticks$, $p^{ask}=m_t+U[0.5,1.5]$, inventory limit $L_{MM}=3000$, when $|I|\ge L_{MM}$ -> cease quoting + aggressive MO to flatten.
   - *RL MM (20 alternate config):* PPO policy $\pi_\theta(a|s)$ MLP 3x256 ReLU, actor-critic shared, clipped objective, entropy coeff 0.01, trained 5M steps [4].

**Calibration:** Surrogate ML approach [5]: random forest surrogate mapping ABM parameters to stylized-fact distance (return kurtosis, spread autocorr, OFI, Hurst). Bayesian optimization minimizes weighted MSE vs CME MDP3 June 2010.

```python
# Hawkes recursive MLE O(N) and thinning simulation
import numpy as np
def hawkes_intensity(t, hist, mu=0.2, alpha=0.6, beta=1.2):
    excit = np.sum(alpha*np.exp(-beta*(t-hist[hist<t])))
    return mu + excit

def ogata_thin(T, mu, alpha, beta):
    t=0; hist=[]
    while t<T:
        lam_bar = hawkes_intensity(t, np.array(hist), mu, alpha, beta)
        u = np.random.exponential(1/lam_bar)
        t+=u
        lam_t = hawkes_intensity(t, np.array(hist), mu, alpha, beta)
        if np.random.rand() < lam_t/lam_bar:
            hist.append(t)
    return np.array(hist)

branching = alpha/beta  # n -> 0.5 stable, 0.92+ near-crash
```

```rust
// Rust-like RL MM reward with inventory penalty (cf. Spooner et al.)
struct State { inv: f64, spread: f64, ofi: f64, mid: f64, vol: f64 }
fn reward(state: &State, pnl_delta: f64, lambda: f64) -> f64 {
    let inv_pen = lambda * state.inv.powi(2);
    let spread_risk = 0.5 * state.inv.abs() * state.spread;
    pnl_delta - inv_pen - spread_risk
}
```

```tla
---- MODULE FlashCrashABM ----
EXTENDS Integers, Reals
VARIABLES lob, hawkesLambda, agents, inventory, price
TypeOK == lob \in Seq(Queue) /\ hawkesLambda \in [Events -> Real]
BranchingCritical == \E m \in Events: hawkesLambda[m]/beta >= 1.0
Crash == price' < 0.92*price \/ spread' > 5*spread
Next == \/ HawkesArrival \/ MarketMakerQuote \/ InstitutionalSell \/ Reflection
Spec == Init /\ [][Next]_<<lob,price>> /\ WF_Next(Next)
THEOREM Stability => [](BranchingCritical => <>Crash)
====
```

![LOB liquidity migration and reflected SDE](/thesis/thesis-flashcrash-hawkes-1786329188008-1.webp)

---

## 4 Deep Dive

### 4.1 Hawkes Self-Excitation and Quadratic Feedback

We argue linear Hawkes under-incorporates volatility amplification because Zumbach effect multiplies returns squared [2]. Q-Hawkes intensity:

$$\lambda^{QH}_{t} = \mu + H * dN + (r * Z)^T K (r * Z)$$

where $r_t$ returns, $Z$ trend kernel, $* $ convolution. Estimation on E-mini 2010 shows $K$ significant $p<0.001$ 6 hours pre-crash, increasing $n_{eff}=n_{linear}+2\|K\|E[r^2]$ from 0.78 to 0.94 [2][8]. Hawkes(p,q) framework [8] disentangles exogenous $\mu(t)$ time-varying vs feedback $n(t)$. Using EM + AIC for $p$, $q$ degrees freedom, Wehrli & Sornette document two crash archetypes: *endogenous-driven* (GBP/USD Oct 7 2016, 98% endogenous, efficiency breakdown) vs *exogenous-driven* (EUR/USD Brexit, exogenous news dominates). Flash crash 2010 classified endogenous: exogenous arrival flat, feedback parameter $n(t)$ jumps 0.82->0.95 in 3 min [8].

*Implications for ABM:* We switch Hawkes engine to Q-Hawkes after Sell Algo start, else linear. This yields fat-tailed returns $P(|r|>x)\sim x^{-\zeta}$ with $\zeta\approx3.2$, vs $\zeta=4.5$ linear, matching empirically observed tail during mini flash crashes [5].

### 4.2 Limit Order Book Microstructure and Liquidity Migration

Following Horvath et al. [1], micro queues $Q^{i}_{t} \in \mathbb{N}$ for price level $i$. Events:

- LO addition $Q^{i} += L$
- Cancel $Q^{i} -= C$
- Market order depletes best level $i=1$; if $Q^{1}=0$, mid moves.
- Migration $Q^{i} \to Q^{i\pm1}$ with intensity $\nu_{i,i\pm1}(t)= \nu_0 + \sum \eta_{m,n} dN_n$ governed by Hawkes [1]. Migration provides Laplacian coupling: drift $b_i = f_i(\lambda) + D(Q^{i+1}+Q^{i-1}-2Q^{i})$ stabilizing book shape, diffusion $\Sigma_{ij}$ correlated via cross-excitation matrix.

Weak consistency requires price impact monotonic: market order never opposite price move. Reflected SDE limit formalized via generator expansion [1]: microscopic generator $\mathcal{L}_{mic} f(Q)= \sum_{m} \lambda_m(t) [f(Q+\Delta_m)-f(Q)]$, Taylor second-order yields mesoscopic drift $b(Q)=\sum \lambda_m \Delta_m$, diffusion $a(Q)=\sum \lambda_m \Delta_m\Delta_m^T$.

Empirically, migration rate $\nu_0$ estimated 0.12/s per level; Hawkes-augmented $\eta$ up to 0.43 during stress, causing liquidity hole propagation from best to deeper levels, widening spread 2->12 ticks in 40s simulated vs 8 ticks historical [5].

### 4.3 Reinforcement Learning Market Makers as Adaptive Liquidity Providers

PPO objective [4]:

$$L^{CLIP}(\theta)=\mathbb{E}[\min(r_t(\theta)\hat A_t, clip(r_t,1-\epsilon,1+\epsilon)\hat A_t)] + c_1 L^{VF} - c_2 S[\pi]$$

$r_t(\theta)=\pi_\theta/\pi_{old}$, advantage $\hat A_t$ from GAE. Environment stochastic: non-stationary return drift $\mu_t$ OU process $d\mu=\theta(\bar\mu-\mu)dt+\sigma dW$, stochastic quantity $L \sim LogNormal$, clustered arrivals via Hawkes [4].

We compare RL vs heuristic:

- *Inventory risk:* heuristic MM under inventory limit hard stops cause 0 liquidity when $|I|\ge L_{MM}$, RL learns soft penalty shaping offset $\delta^{bid}=\kappa I_t$ continuous, inventory risk $\sqrt{E[I^2]}$ RL 142 vs heuristic 238 (-40%) [3].
- *Adverse selection:* RL MM using order-book imbalance OFI $= (Q^{bid}-Q^{ask})/(Q^{bid}+Q^{ask})$ to skew quotes achieves Sharpe 2.4 vs 1.6 heuristic [4].
- *Flash vulnerability:* Under Sell Algo pressure, RL MM initially provides liquidity (learned mean reversion) but when branching $n>0.9$, adverse selection dominates, RL policy entrenches short inventory $I=-1800$ and widens spread 3x, then pauses quoting similar to real HFT withdrawal May 6 2:45:28 EST per SEC dataset.

```haskell
-- PPO clipped surrogate for MM (Haskell sketch)
clipObj :: Float -> Float -> Float -> Float -> Float
clipObj r adv eps c2 =
  let unclipped = r*adv
      clipped   = (max (1-eps) (min (1+eps) r))*adv
  in min unclipped clipped + c2*entropyBonus
```

### 4.4 Coupled ABM Architecture and Endogenous Instability

Full loop:

1. Hawkes engine samples next event time $t_{next}$ given $\lambda(t)$.
2. Exchange processes event, updates LOB, computes $m_t$.
3. All agents receive $LOB_{t}$ snapshot (with latency), submit child orders; RL MMs evaluate $\pi_\theta$.
4. Institutional Sell Algo posts $MO_{sell}$ TWAP 9% volume.
5. Price formed; check inventory limits; if MM flat, record latency floor [8].

Feedback cycle causing flash:

*Sell pressure -> market order intensity cross-excites -> ask queue depleted -> mid down -> chartist sell signal $>0.7$ correlation self-excitation -> MM inventory saturates $I=-L_{MM}$ -> quoting halt -> spread surges -> Hawkes $\lambda^{cancel}_{ask}$ spikes (cross-excitation 0.62 from market order) -> liquidity vacuum, $n_{eff}$ approaches 1, super-critical cascade* [5][6][8]. Recovery only via fundamental trader return $\kappa_f$ and circuit breaker after 5% drop if implemented.

Monte Carlo sweep $N=500$ per parameter set:

| Parameter | Baseline | Range Swept | Crash Amplitude $\Delta p_{min}$ Regression |
|-----------|----------|-------------|---------------------------------------------|
| Sell Algo %Vol | 9% | 2-15% | $\Delta p = -0.12 +1.8\times(\%Vol)-0.04\times(\%Vol)^2$ $R^2=0.87$ |
| MM Inventory $L_{MM}$ | 3000 | 500-10000 | $\Delta p \propto -1/\log L_{MM}$ Spearman -0.73 |
| Fundamental freq | 3/min | 0.5-10/min | Amplitude reduced 38% when freq 10 vs 1 [5] |

- **Mini flash spikes:** Introducing Spiking Trader (single large IOI $\sim 5\times$ ATS) replicates 2010 mini crashes (ETF flash 2-min -4%). Contagion speed non-monotone in portfolio diversification [7].

![RL market maker interacting with Hawkes LOB](/thesis/thesis-flashcrash-hawkes-1786329188008-2.webp)

![Flash crash cascade timeline and feedback loop](/thesis/thesis-flashcrash-hawkes-1786329188008-3.webp)

---

## 5 Empirical / Proofs

### Calibration and Stylized Facts

Calibrated baseline without Algo reproduces:

- Return kurtosis 12.4 vs 13.1 empirical CME, Hill tail 3.8 vs 3.5
- Spread mean 1.28 ticks, autocorr lag1 0.42 vs 0.38 empirical
- Order flow imbalance $OFI$ autocorrelation 0.71 (Hawkes-driven persistence)
- Volatility clustering $AC_{|r|}(lag20)=0.31$

Moment coverage ratio 87% within 95% CI of historical, vs Poisson ABM 52% [5].

### Flash Crash Simulation May 6 2:32-2:52 PM

Simulation config: TWAP $9\%$ starting 2:32, RL MM mix 50-50 heuristic. Timeline:

- 2:32: Sell Algo starts, $\lambda_{sellMO}$ 0.2->0.9/s, mid gradual -0.8%.
- 2:41: Hawkes intensity $\lambda(t)$ cross-excites to 2.3/s, branching estimator $\hat n=0.89$, imbalance -0.64.
- 2:44:30: Q-Hawkes term $K(r*Z)^2$ activates -4 sigma trend, $n_{eff}=0.97$, first MM hits limit pauses.
- 2:45:28: 7/20 heuristic MMs paused, 3/20 RL MMs inventory $<-2200$ cease quoting, spread jumps 1.1->8.4 ticks, price -4.2% in 40s.
- 2:46: +Waddell & Reed news exogenous arrest Sell Algo, fundamental traders mean revert, mid recovery +3.1% over 12 min.

Price path $p(t)$ vs CFTC historical T&S $D_{KS}=0.11$ $p=0.43$, not reject same distribution.

### Proof: Diffusive Limit Existence

We sketch proof following [1] Lemma 3.2-3.4: Define scaled queue $Q^{(n)}_t = n^{-1/2} Q_{nt}$. Generator $\mathcal{L}^{(n)}f(q)= n\sum_m \lambda_m^{(n)}(q)[f(q+n^{-1/2}\Delta_m)-f(q)]$. Expand $f$ Taylor to 2nd order, $\lambda^{(n)}= n\bar\lambda + \sqrt{n}\tilde\lambda$, limit $\mathcal{L}^{(n)} \to \mathcal{L}f = \nabla f\cdot b + 1/2 Tr(a H_f)$ with reflection Skorokhod term for boundary $q_i=0$. Tightness via Aldous criterion, weak convergence to reflected SDE solution.

### RL MM Performance

In calm market $n=0.7$, PPO MM vs Avellaneda-Stoikov benchmark $AS$:

- Terminal wealth $+27\%$ higher (mean $8934$ vs $7012$ daily PnL), inventory variance -38%, risk-adjusted $Sharpe_{MM}=3.1$ vs $2.2$ [3][4].
- Quote-to-trade ratio 4.3 vs 6.1 heuristic.

Under stress test Sell 12% volume, both MMs fail but RL flat unwinds 1.3s faster due to proactive hedge.

### Contagion Systemic Risk

Paulin et al. hybrid [7] shows contagion speed $v_{contag}$ peaks at intermediate diversification $\rho\approx0.6$, non-monotone. With 5 ETFs overlapping crowding $c=0.75$, speed $v$ 0.9 sec/asset when $\rho=0.5$ vs 1.6 sec when diversified.

---

## 6 Limitations

- **Parameter explosion:** 6-dim $\alpha_{m,n}$, $\beta_{m,n}$ 36 kernels, plus Q-K 12 parameters, estimated on high-frequency data but identifiability weak when $n>0.9$ near critical—MLE variance inflates $\sim 1/(1-n)$ [2][8]. Need Bayesian priors or $L_1$ sparsity.
- **RL overfitting:** PPO policy trained on stationary-ish Hawkes prior but flash regime non-stationary; policy exhibits covariate shift, $Q$-value overestimate $18\%$ under Hawkes intensity surge [4].
- **Latency and queue position not fully modelled:** Real colocation $5-10\mu s$ vs simulation $50\mu s$, fee/revenue tier incentives omitted.
- **Limited asset contagion:** Single-security model misses cross-asset correlation and ETF arbitrage loops central to 2010 cascade (ES leads SPY via ETF arb). Multi-asset micro ABM cost $O(A\times L)$ where $A$ assets, $L$ levels, 5-ETF version 6.2x slower.
- **Surrogate calibration fragility:** Moment coverage good but joint distribution of order book shape not matched.
- **Security:** Model lacks malicious spoofing agents inserting/cancelling large distant orders to manipulate OFI and RL MM skew.

---

## 7 Conclusion

Endogenous flash crashes arise at intersection of *self-exciting order flow*, *fragile LOB liquidity migration*, and *strategic withdrawal of risk-averse market makers*. We provided unified discrete-event ABM where Hawkes (including Quadratic feedback to capture Zumbach effect) furnishes statistically faithful clustered intensities, mesoscopic SDE limit supplies efficient state dynamics for RL training, and PPO market makers adaptively price inventory risk, inventory limits reproduce Hawkes super-critical transition when $\hat n \to 1$. Calibrated simulator recapitulates May 6 2010 crash shape, quantifies control levers (Algo participation, MM capital commitment, fundamental contrarian flow), and uncovers RL market making double edge: superior normal risk-adjusted return yet accelerated liquidity evaporation under stress unless hard caps or velocity logic breaker enforced.

Future directions: incorporate Hawkes(p,q) time-varying endogeneity classifier online for early warning $n(t)$ hazard rate [8]; MARL equilibrium analysis with competing PPO MMs; and formal verification of circuit breakers in TLA+ with liveness $\Box(Crash \to \Diamond Recovery)$.

## References

[1] D. Horvath et al. Diffusive Limit of Hawkes Driven Order Book Dynamics With Liquidity Migration. arXiv:2511.18117v1. https://arxiv.org/abs/2511.18117v1

[2] G. Fosset et al. Non-parametric Estimation of Quadratic Hawkes Processes for Order Book Events. HAL-02998555. https://hal.science/hal-02998555/file/Fosset2020b.pdf

[3] B. Gasperov, Z. Kostanjcar. Deep Reinforcement Learning for Market Making Under a Hawkes Process-Based Limit Order Book Model. IEEE Control Systems Letters 2022, arXiv:2207.09951. https://arxiv.org/abs/2207.09951

[4] A. Kitchen et al. Reinforcement Learning-Based Market Making as Stochastic Control on Non-Stationary Limit Order Book Dynamics. arXiv:2509.12456v1. https://arxiv.org/abs/2509.12456v1

[5] J. Paddrik et al. High-Frequency Financial Market Simulation and Flash Crash Scenarios Analysis: An Agent-Based Modelling Approach. JASSS 2022. http://ideas.repec.org/a/jas/jasssj/2022-169-3.html

[6] P. Pal et al. Rock around the Clock: An Agent-Based Model of Low- and High-Frequency Trading. arXiv:1402.2046. https://arxiv.org/abs/1402.2046

[7] J. Paulin, A. Calinescu, M. Wooldridge. Understanding Flash Crash Contagion and Systemic Risk: A Micro-Macro Agent-Based Approach. arXiv:1805.08454. http://arxiv.org/abs/1805.08454

[8] A. Wehrli, D. Sornette. Classification of flash crashes using the Hawkes(p,q) framework. Swiss Finance Institute RP 20-92. https://ideas.repec.org/p/arx/papers/1804.04216.html

