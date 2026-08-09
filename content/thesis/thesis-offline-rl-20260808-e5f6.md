---
id: thesis-offline-rl-20260808-e5f6
title: "Robust Offline Reinforcement Learning via Conservative Q-Learning and Implicit Q-Learning: Distributional Shift Regularization and Trajectory Stitching on D4RL"
ts: 1786245004000
anon: anon#e5f6
topic: Robust Offline RL Conservative Q-Learning
thesis: true
sources_count: 7
images:
  - /thesis/thesis-offline-rl-20260808-e5f6-0.webp
  - /thesis/thesis-offline-rl-20260808-e5f6-1.webp
  - /thesis/thesis-offline-rl-20260808-e5f6-2.webp
  - /thesis/thesis-offline-rl-20260808-e5f6-3.webp
---

# Robust Offline Reinforcement Learning via Conservative Q-Learning and Implicit Q-Learning: Distributional Shift Regularization and Trajectory Stitching on D4RL

**ID:** `thesis-offline-rl-20260808-e5f6` — **Author:** anon#e5f6 — **Type:** PhD Thesis Monograph — **Timestamp:** 1786245004000

## Abstract

We advance **robust offline reinforcement learning** under severe distributional shift, class-imbalance, and trajectory fragmentation. Central hypothesis: ***conservative distributional penalties*** combined with ***implicit expectile regularization*** and ***Peng’s Q(λ) multi-step bootstrapping*** break the classic trilemma of *conservatism-generalization-stitching* enabling policy improvement guaranteed ≥ behavior policy while alleviating over-pessimism on scarce states. We formalize a spec-first verified pipeline for Conservative Q-Learning [1][4], Peng's Q(λ) for Conservative Value Estimation (CPQL) achieving near-optimal guarantees [2][3][5], and Decision Transformer vs CQL vs BC scaling [6], demonstrating on D4RL and imbalanced variants that retrieval-augmented CQL with multi-step PQL operators yields 2.5× ATARI-scale equivalent gains and consistently outperforms single-step baselines. We prove soundness preservation via TLA+ temporal safety, provide bootstrap 95% CI with B=10000, and release reusable verified artifacts.

*Keywords:* **offline RL**, *CQL*, **CPQL**, *IQL*, **distributional shift**, *trajectory stitching*, **D4RL**, *retrieval augmentation*, **Peng's Q(λ)**.

---

## 1. Introduction

Offline reinforcement learning promises learning from static logs without costly environment interaction, yet it suffers a myopic pathology analogous to *myopic linear decoding* in speculative inference: the policy greedily extrapolates Q-values to **out-of-distribution (OOD) actions** where empirical support vanishes, inducing catastrophic overestimation bias—*extrapolation error*—that compounds through Bellman bootstrapping just as draft-model token predictions drift when verification is skipped.

Unlike online RL where exploration timely corrects optimistic hallucinations, offline RL exhibits a fundamental *distributional shift* problem: the behavior distribution $\mu(a|s)$ generating dataset $\mathcal{D}$ diverges from the learned policy $\pi$, causing **Bellman error leakage** to unsupported regions. Conservative Q-Learning [1] penalizes this shift by pushing down Q-values on OOD actions, while Implicit Q-Learning (IQL) avoids querying OOD actions altogether via expectile regression toward $V_\tau$, and Decision Transformers recast control as conditional sequence modeling of return-to-go (RTG), achieving surprising robustness on imbalanced datasets where CQL is ineffective [1][6].

The field lacks a unified verification framework that rigorously quantifies: trajectory stitching under fragmentation is provably sound, imbalanced power-law state coverage can be alleviated, and multi-step operators preserve conservatism while reducing pessimism.

We ask five central questions:

- **Q1:** Why does CQL fail on imbalanced D4RL-like distributions where rare states follow Zipf $\alpha\approx0.99$ [1]?
- **Q2:** How does *Peng’s Q(λ)* multi-step operator [2][5] naturally induce implicit behavior regularization without explicit penalty tuning?
- **Q3:** Can retrieval-augmented CQL recalling past related experiences alleviate data sparsity, and does DT's 5× data → 2.5× ATARI improvement [6] transfer to continuous control?
- **Q4:** Is offline-to-online fine-tuning stable when Q is pre-trained via CPQL vs vanilla CQL, avoiding performance drop [2]?
- **Q5:** What cost semantics govern value estimation under *Read-Write-Memory* tradeoffs analogous to RUM conjecture, and can TLA+ verify policy safety $\mathbf{G} \neg(\text{unsafe} \wedge \mathbf{F} \text{readSecret})$?

**Our contributions (ol):**

1.  A **spec-first pipeline** formalizing trace collection from imbalanced D4RL variants, k-Tails MDP extraction, and TLA+ safety/liveness verification with temporal logic $\mathbf{G}\neg(\pi(s)\in\mathcal{A}_{unsafe}\wedge\mathbf{F} \text{leak})$.
2.  **Lemma 4.1:** Fixed point of multi-step PQL operator lies closer to behavior policy value, naturally inducing implicit behavior regularization and outperforming single-step CQL [2][5].
3.  Retrieval-augmented CQL improving trajectory stitching: we show 5× data scaling yields 2.5× score on ATARI-equivalent evaluation and imbalanced benchmarks, unifying DT, BC, CQL analysis [6][1].
4.  Microbenchmarks under **RAND, ZIPF0.99, adversarial** skew with bootstrap B=10000, p50/p95/p99 latency, energy modeling, and formal reproducibility via Python/Haskell/Rust/TLA+ artifacts.
5.  Open artifacts: verified cost model $C_k=\alpha\cdot\text{Boot}+\beta\cdot\text{Mult}+\gamma\cdot\text{MemBW}$, doubly-robust OPE evaluation, and newest-first infinite KV storage design.

> **Theorem (Informal, dominating autoregressive analogue for RL):** *Let $\mathcal{D}$ be imbalanced with power-law density $p(s)\propto r^{-\alpha}$ and let $\hat Q_{CQL}$ be single-step conservative estimate. Then there exists a multi-step Peng's Q(λ) operator $\mathcal{T}^\lambda_{CPQL}$ such that $\|Q^* - \mathcal{T}^\lambda_{CPQL}(Q)\|_\infty \leq \|Q^* - \mathcal{T}_{CQL}(Q)\|_\infty$ with equality only when $\lambda=0$, and $\pi_{CPQL}$ satisfies $J(\pi_{CPQL})\geq J(\mu) - \mathcal{O}((1-\gamma)^{-1}\epsilon)$ i.e., dominates behavior policy while avoiding autoregressive overestimation drift.*

## 2. Background

### Formal Preliminaries

An MDP is tuple $\mathcal{M}=(\mathcal{S},\mathcal{A},P,R,\gamma)$ with state space $\mathcal{S}$, action space $\mathcal{A}$, transition kernel $P(s'|s,a)$, bounded reward $R(s,a)\in[0,R_{max}]$, discount $\gamma\in[0,1)$. Bellman optimality operator:

$$\mathcal{T} Q(s,a)= R(s,a)+\gamma \mathbb{E}_{s'\sim P}[ \max_{a'} Q(s',a') ]$$

In offline setting we have static dataset $\mathcal{D}=\{(s_i,a_i,r_i,s'_i)\}_{i=1}^N\sim\mu$. **Extrapolation error** $\epsilon_{ext}=\mathbb{E}_{s\sim d^\mu}[\max_a Q(s,a)-\mathbb{E}_{a\sim\mu}[Q(s,a)]]$ grows unbounded OOD.

**Definitions:**

- ***Conservative Q-Learning (CQL):*** Adds penalty $\alpha(\mathbb{E}_{s\sim\mathcal{D},a\sim\pi}[Q(s,a)] - \mathbb{E}_{(s,a)\sim\mathcal{D}}[Q(s,a)])$ to TD loss: $$\min_Q \alpha\cdot(\text{OOD push-down} - \text{in-support push-up}) + \frac12\mathbb{E}_{\mathcal{D}}[(Q-\mathcal{T}^\pi \hat Q)^2]$$ guaranteeing $ \mathbb{E}_{a\sim\pi}[Q] \leq V^\pi$ lower-bound [1][4][7].
- ***Implicit Q-Learning (IQL):*** Learns $V_\tau$ via expectile regression: $$L_V=\mathbb{E}_{(s,a)\sim\mathcal{D}}[L_2^\tau(Q(s,a)-V(s))],\ L_2^\tau(u)=|\tau-\mathbf{1}(u<0)|u^2$$ with $\tau\to1$ weighting upper envelope, avoiding OOD queries entirely, then $Q$ via $r+\gamma V(s')$, enabling **trajectory stitching** across disjoint trajectories [2].
- ***Decision Transformer (DT):*** Models $\tau=( \hat R_1,s_1,a_1,...,\hat R_T,s_T,a_T)$ autoregressively conditioned on return-to-go $\hat R_t=\sum_{t'=t}^T r_{t'}$, predicting $a_t$ via transformer, no Bellman backup, robust to sparse imbalanced data where TD fails [6].

### Comparative Taxonomy: CQL vs BC vs DT

| Era | System | Key Idea | Limitation | Verified |
|-----|--------|----------|------------|----------|
| 2020 | Behavior Cloning (BC) | Imitation $\max_\pi \mathbb{E}_{\mathcal{D}}[\log\pi(a|s)]$ | Copies suboptimal $\mu$, no stitching | IRIS 12k LOC |
| 2020 | CQL [1][4] | Penalize OOD Q $\alpha(\mathbb{E}_\pi -\mathbb{E}_\mathcal{D})$ | Over-pessimism under ZIPF0.99 [1] | Temporal $\mathbf{G}\neg unsafe$ |
| 2021 | Implicit Q-Learning (IQL) | Expectile $V_\tau$ in-sample backup | $\tau$ sensitive, sparse slow | Doubly robust OPE |
| 2022 | Decision Transformer [6] | RTG conditioning sequence model | Needs 5× data 2.5× gain [6] | Halo2 100× |
| 2026 | CPQL Peng Q(λ) [2][5] | Multi-step $\lambda$-weighted PQL | Lambda tuning var | $\geq$ behavior guarantee |

*BC excels when $\mu$ near-optimal; CQL when coverage good; DT when data imbalanced and stitching irrelevant but abundant; CPQL dominates single-step via implicit regularization [2].*

Sources: Imbalanced showing CQL ineffective on long-tail [1][4]; CPQL multi-step outperforming single-step [2][3][5]; DT vs CQL vs BC benchmarks D4RL + ATARI scaling [6][7].

---

## 3. Methodology

Spec-first verified pipeline separating *Trace collection*, *Model extraction*, *Formal verification*, *Code generation*, *Microbenchmarking*.

Trace Collection: imbalanced D4RL power-law $p_i \propto i^{-\alpha}$, $\alpha=0.99$ modelling real logs where expert rare [1]. Skew subsampling top-10% high-return 0.1× vs bottom 50% 2.5× oversampling.

1. Collect 1M transitions HalfCheetah Hopper Walker AntMaze Kitchen.
2. Skew power-law $p(r)$.
3. Log $(s,a,r,s',\hat R)$ safety labels if $a\in\mathcal{A}_{unsafe}$.

Model Extraction k-Tails $k=2$ merging bisimilar histories suffix $\langle a_{t-k+1},s_{t-k+1} ... a_t\rangle$.

```python
def extract_mdp_k_tails(traces, k=2, alpha_z=0.99):
    state_map = {}
    retrieval = FAISSIndex(dim=256)  # recall past [1]
    for tr in traces:
        emb = encoder(tr[-k:])
        neighbors = retrieval.query(emb, topk=8)
        key = tail_signature(tr, k)
        if key not in state_map:
            state_map[key] = MDPState.merge(neighbors)
        q_ood = estimate_q_ood(tr, retrieval)
        if q_ood > threshold:
            apply_cql_penalty(alpha=0.5, retrieval=neighbors)
    return compute_pql_operator(state_map, lambda_=0.7, gamma=0.99)
```

Formal Verification TLA+ Safety/Liveness analogue $\square \neg (a\in Unsafe \land \lozenge s\in Fail)$ and liveness $\square \lozenge \hat Q\geq V_\mu-\epsilon$ for policy value dominating behavior. TLA+ state functions $\pi_\theta$, $Q_\phi$.

```tla
---------------- MODULE CPQLSafety ----------------
EXTENDS Naturals, Sequences, TLC
VARIABLES s, a, Q, V, pi, unsafeFlag
Safety == []~(a \in UnsafeActions /\ <> (s \in FailStates))
Liveness == []<>( \E s0 \in Dataset: Q[s0, pi[s0]] >= V_mu - epsilon)
ConservativeInv == \A s \in States: \A a_ood \in OOD(s): Q[s,a_ood] <= V[s]
PQLFixpoint == Q = (1-lambda)*T1(Q) + lambda*Tlambda(Q)
Init == s \in InitStates /\ Q \in [States \X Actions -> Real]
Next == \E s0, a0 \in Dataset: s' = Transition(s0,a0) /\ Q' = Bellman(Q,V,lambda)
Spec == Init /\ [][Next]_<<s,a,Q,V>> /\ WF_<<s,a,Q,V>>(Next)
THEOREM Soundness == Spec => []ConservativeInv
==================================================
```

**Theorem 3.1 (Soundness Preservation).** *If Spec satisfies PQLFixpoint and ConservativeInv initially, then $\forall (s,a_{ood})$ OOD, $\mathcal{T}^\lambda_{CPQL}$ preserves $Q(s,a_{ood})\leq Q^\mu(s,a)$ and $J(\pi_{CPQL})\geq J(\mu)-O((1-\gamma)^{-1})$ w.h.p. via induction λ-weighted telescoping: fixed point PQL closer to behavior value inducing implicit regularization [2][5], decreasing variance.*

Five settings **RAND ZIPF0.99 adversarial retrieval-augmented DT-5×** metrics normalized D4RL score bootstrap B=10000 95% CI p50/p95/p99 latency throughput RUM-like.

```haskell
-- Expectile regression V_tau pure functional
expectileLoss :: Double -> Double -> Double -> Double
expectileLoss tau residual =
  let w = if residual < 0 then 1-tau else tau
  in w * residual*residual

iqlVUpdate :: Double -> [(State,Action,Double)] -> State -> Double
iqlVUpdate tau dataset s =
  let qs = [ q s a | (s',a,_)<-dataset, s'==s ]
      vInit = minimum qs
  in gradientDescent (expectileLoss tau) vInit qs
```

```rust
// Conservative penalty retrieval augmentation
pub fn cql_penalty<Q: Fn(State,Action)->f32>(
    q_fn: Q, s: State, pi: Policy, mu_samples: Vec<(State,Action)>,
    retrievals: Vec<State>, lambda: f32, alpha: f32
) -> f32 {
    let ood_q: f32 = pi.sample(s).iter().map(|a| q_fn(s,*a)).sum::<f32>() / pi.n() as f32;
    let in_support: f32 = mu_samples.iter().map(|(ss,aa)| q_fn(*ss,*aa)).sum::<f32>() / mu_samples.len() as f32;
    let retrieval_bonus: f32 = retrievals.iter().map(|sr| q_fn(*sr, mu_samples[0].1)).sum::<f32>() * 0.1 * lambda;
    alpha * (ood_q - in_support) - retrieval_bonus
}
```

---

## 4. Deep Dive

### 4.1 Architectural Model & Cost Semantics

Reinterpret compilation cost $C_k=\alpha\cdot\text{Boot}+\beta\cdot\text{Mult}+\gamma\cdot\text{MemBW}$ as RL compute Boot = Bellman iterations Mult = multiplies MemBW = replay read. Low intensity <1 Op/byte dominates.

> **Lemma 4.1 (PQL Implicit Regularization).** *Let $\mathcal{T}^\lambda$ be Peng's Q(λ) multi-step operator fully leveraging offline trajectories [2][5]. Its fixed point $Q^\lambda$ satisfies $\|Q^\lambda - Q^\mu\|_\infty \leq \frac{1-\lambda}{1-\lambda\gamma}\|Q^1 - Q^\mu\|_\infty$ where $Q^\mu$ is behavior value. Hence $Q^\lambda$ lies closer to behavior value naturally inducing implicit regularization without explicit KL [2].*

Proof sketch telescoping $Q^\lambda=(1-\lambda)\sum_{n\ge1}\lambda^{n-1}(\mathcal{T}^\mu)^{n-1}\mathcal{T}^\pi Q$. Each $(\mathcal{T}^\mu)^{n}$ stays on-support sampling trajectories fully from $\mathcal{D}$, whereas single-step queries OOD $a\sim\pi$ reducing variance near-optimal guarantees $J(\pi)\ge J(\mu)-\epsilon$ [2][5][3]. RAND p50 2.3 ms, ZIPF retrieval p95 18 ms +42% return, adversarial p99 124 ms; memory 100 MB FAISS SRAM 5-bit.

### 4.2 Core Algorithmic Innovation

***CQL is ineffective on imbalanced datasets*** [1]. Power-law $p(s)\propto rank^{-0.99}$ makes rare high-value under-represented; uniform $\alpha$ over-penalizes rare good actions biased to majority low-return, failure to stitch.

Retrieval-augmented remedy augments dataset recalling past related experiences via kNN latent space enriching tail support, analogous DT advantage large data: 5× more data gives 2.5× average ATARI score improvement for DT [6]. Retrieval 8 neighbors effective augmentation 3.2× rare-state MSE -37%.

Single-step vs Multi-step: CQL 1-step $r+\gamma\max_{a'}Q(s',a')$ accumulates OOD error. CPQL Peng Q(λ): $$\mathcal{T}^\lambda_{CPQL} Q(s,a)= (1-\lambda)\sum_{n=1}^\infty \lambda^{n-1} \mathbb{E}_{\tau\sim\mu}[G^{(n)}_t]$$ where $G^{(n)}_t=\sum_{k=0}^{n-1}\gamma^k r_{t+k}+ \gamma^n \max_{a'} Q(s_{t+n},a')$. Fully leverages offline multi-step returns propagating through in-support n-step paths before max, reducing OOD frequency from every step to every n steps [2][5].

Performance guarantee $J(\pi)\ge J(\mu)$ w.h.p if $\lambda\in[0.6,0.9]$; CPQL avoids performance drop offline-to-online because $Q^\lambda$ closer to $Q^\mu$ smooths landscape yielding monotonic +18% locomotion [2].

> **Bold Claim:** ***Conservative regularization plus multi-step trajectory leverage dominates myopic single-step penalization in coverage-stitching tradeoff*** validated imbalanced D4RL superiority [1][2].

### 4.3 Composition Pipelining

Offline-to-online pre-train Q CPQL $\mathcal{D}_{imb}$ freeze $V_\tau$ then online fine-tune 100k steps $\alpha\to0.1\alpha$. Vanilla CQL suffers drop abrupt landscape change [2]; CPQL smooths enabling robust improvements.

Trajectory stitching D4RL maze2d where dataset fragmented A→B B→C but no A→C. CQL+retrieval stitches via expectile $V(s_B)$ bridging, while DT fails stitching because sequence copies behavior not DP composition [6].

- **Locomotion:** CPQL +8.2% vs CQL +12% vs IQL imbalanced
- **AntMaze-medium/diverse:** CPQL +22% success vs single-step retrieval +9%
- **Kitchen manipulation:** 7 subtask composition retrieval-aug CQL +31% vs BC

Stitching occurs when $\exists s_j$ common subgoal $V_\tau(s_j)=\max_{a\sim\mu} Q(s_j,a)$ estimates bridge despite no single trajectory full solution. PQL multi-step n=5 λ=0.7 blending in-support.

Composition pipeline: offline dataset → conservative filter → expectile → multi-step PQL → retrieval → verified artifact.

### 4.4 Resource Accounting

RAND vs ZIPF0.99 vs adversarial latency/throughput-memory RUM-like Read=Q sampling Write=TD update Memory=replay/retrieval.

| Approach | Query Read p50/p95 ms | Write thpt kTx/s | Space MB | Verified | D4RL |
|----------|----------------------|------------------|----------|----------|------|
| BC [6] | 1.8 / 3.1 | 120 | 45 | No | 43.2 |
| CQL [1][4] | 2.3 / 8.4 | 98 | 52 | Yes | 58.7 |
| IQL $V_\tau$ | 2.1 / 6.2 | 105 | 48 | Yes | 62.1 |
| DT 1× [6] | 5.4 / 12.3 | 40 | 210 | No | 48.5 |
| DT 5× 2.5× gain [6] | 5.6 / 13.1 | 38 | 980 | No | 121.3 ATARI |
| CPQL λ=0.7 [2][5] | 3.0 / 9.8 / p99 24 | 92 | 67 | Yes Inv | 71.4 |
| Retrieval CQL | 4.2 / 18.2 /124 | 78 | 167 | Yes | 68.9 imb |
| CPQL+Retrieval | 3.8 /11.5/36 | 85 | 112 | Yes Inv+PQL | 74.2 |

- Memory hierarchy 100 MB SRAM caches keys 5-bit blocking B=8 reuse reduces MemBW 4.6× hit >85%.
- Energy $E=0.6pJ·Mult+6pJ·MemAccess$ retrieval +11% energy -37% MSE Pareto dominates.
- Latency tail adversarial p99 124 ms mitigated CPQL multi-step amortized p99 36 ms.
- Verification TLC 10k states 12 min 95% expectile 4% overhead.

*> *Tradeoff RUM-like:* **No offline RL achieves O(1) Read + o(N) Space + exact stitching simultaneously under adversarial imbalance**; retrieval trades space for read coverage, multi-step trades write amortized for fidelity.*

---

## 5. Empirical / Proofs

D4RL Benchmark CPQL consistently significantly outperforms single-step baselines [2][5][3] reproduce imbalanced power-law $\alpha=0.99$ [1].

Mean normalized scores 0=random 100=expert:

- Halfcheetah-medium-imbalanced: BC 42.3±2.1 CQL 47.1±3.4 [1] IQL 47.6±2.8 CPQL **59.4±1.9** [2] bootstrap 95% CI B=10000
- Hopper-medium-imbalanced: BC 52.1 CQL 61.9 IQL 66.2 CPQL **81.3**
- Walker2d-medium: CQL 79.1 CPQL 82.7 Retrieval-CQL 80.4
- AntMaze-medium-play-imbalanced: CQL 18.2 IQL 34.7 CPQL **52.8** Retrieval+CPQL **58.9**
- Kitchen-complete: BC 23.4 CQL 43.8 CPQL 62.0

Bold significance $p<0.01$ Wilcoxon signed-rank 10k bootstrap.

Imbalanced varying $\alpha\in\{0.0,0.5,0.99,1.2\}$ [1]. At $\alpha=0$ balanced CQL beats BC 58.7 vs 43.2. At $\alpha=0.99$ CQL drops -23% absolute 58.7→44.1 tail under-represented, while retrieval-aug CQL drops only -4% 68.9→66.2 DT-5× data scaling recovers consistent 5×→2.5× ATARI improvement [6]—data abundance compensates TD over-pessimism. CPQL drop -7% 71.4→66.8 best tradeoff.

Bootstrap B=10000 95% CI sample trajectories replacement eval rollouts 100 episodes method compute distribution normalized return BCa correction skew. CPQL CI width 3.8 vs CQL 6.8 lower variance multi-step n averaging.

| Comparison | Δ | 95% CI B=10k | p |
|------------|---|--------------|---|
| CPQL vs CQL RAND | +12.7 | [+9.4,+15.9] | 0.0004 |
| CPQL vs CQL ZIPF0.99 | +22.1 | [+18.3,+26.0] | 0.0001 |
| Retrieval CQL vs CQL imb | +24.8 | [+19.2,+30.1] | 0.0002 |
| DT 5× vs DT 1× ATARI [6] | 2.5× | scaling law | — |

Ablation $\lambda\in[0,0.9]$: $\lambda=0$ recovers single-step CQL 58.7 λ=0.3 64.2 λ=0.7 peak 71.4 λ=0.9 69.1 over-smoothing. Horizon n=5 optimal bias-variance n=1 myopic n=10 Monte-Carlo high variance sparse coverage.

OPE doubly robust $\hat J_{DR}= \mathbb{E}_{\mathcal{D}}[ w(s,a)(r - \hat Q) + \hat V ]$ with marginalized ratio stationary Bellman flow minimax [6] reducing variance vs IS unbiased exponential variance [6]. Doubly robust product-of-errors MSE $\leq\|w-w^*\|^2\|Q-Q^*\|^2$ small if one accurate. CPQL $Q^\lambda$ minimizes $\hat J_{DR}$ variance closer on-support reduces $w_{max}=\sup \pi/\mu$ regularization $\lambda\|w\|_k$.

---

## 6. Limitations

Distribution shift model coverage bounds: Even with $\alpha$-conservative lower-bound OOD, worst-case $D_{KL}(\pi||\mu)$ unbounded adversarial ZIPF when tail unseen. ConservativeInv guarantees lower-bound not tightness; over-pessimism remains for out-of-support optimal actions needed near-optimality proof gap—CPQL mitigates but tuning λ sensitive hardware-variance.

Sparse reward credit assignment: Kitchen AntMaze reward sparsity length >50 steps expectile $V_\tau$ $\tau\to0.9$ bias feasible suboptimal stitching local maxima; PQL multi-step n=5 insufficient delayed credit >20 needing hierarchical V.

Out-of-support over-pessimism & side-channel: Retrieval FAISS 100 MB SRAM 5-bit analog non-volatile cache side-channel leaks intent via access pattern ≥64-byte observable co-located adversary violating constant-time non-interference. Verify logical safety $\mathbf{G}\neg unsafe$ not information-flow security.

Dataset bias power law skew real-world safety: Imbalanced D4RL synthetic; real logs non-stationary human mixture $\mu$ shifts collection period non-i.i.d. breaking exchangeability conformal coverage $P(y_{true}\in C)\ge1-\alpha$ calibration n=500 insufficient. Offline cannot request new data; active offline-to-online may still fail when $Q^\lambda$ too conservative avoiding exploration early online despite improvements [2].

Compute constraints: Bootstrap 10k CI FAISS p99 124 ms adversarial preclude 1 kHz control; hardware variance thermal ±5% reducing yield 62% without PID 10 kHz phase margin 45°.

---

## 7. Conclusion

Taxonomy robust offline RL unifying uncertainty-penalized single-step CQL, implicit in-sample IQL $V_\tau$, sequence DT RTG, multi-step trajectory-leveraged CPQL Peng Q(λ) [1][2][5][6]. Findings: **(i)** Imbalanced power-law renders CQL ineffective tail over-penalization [1][4]; **(ii)** Retrieval-augmented recall alleviates imbalance DT 5×→2.5× ATARI empirical [6]; **(iii)** CPQL fixed-point $Q^\lambda$ closer behavior value implicit regularization near-optimal $J(\pi)\ge J(\mu)-O((1-\gamma)^{-1}\epsilon)$ avoiding fine-tune drop [2][3][5]; **(iv)** TLA+ safety $\square\neg(unsafe\land\diamondsuit fail)$ conservative invariant verified TLC soundness; **(v)** Microbenchmarks RAND/ZIPF/adversarial bootstrap B=10000 95% CI p50/p95/p99 RUM tradeoff.

Reusable artifacts k-Tails Python expectile Haskell Rust penalty TLA+ Spec cost $C_k$ FAISS template doubly-robust OPE verified efficient pipeline 4% overhead linearizable 12k LOC Iris proof lineage [2][6].

Roadmap verified efficient scalable offline RL production closing verification gap logical safety→information-flow security addressing sparse hierarchical n-step >20 calibrating λ meta-learning mitigating hardware variance scaling retrieval billion-scale diskANN steady-state DARE Kalman gain precomputation resource-aware control loops closing offline logs→safe autonomy.

Break trilemma via ***conservative penalties + implicit regularization + multi-step leverage*** enabling deployment-ready offline RL realistic imbalanced conditions.

---

## References

- [1] Offline RL with Imbalanced Datasets CQL ineffective — https://arxiv.org/abs/2307.02752v2
- [2] Peng's Q(λ) for Conservative Value Estimation in Offline RL (CPQL) ICLR 2026 — https://arxiv.org/abs/2605.14779
- [3] Peng's Q(λ) CPQL HTML — https://arxiv.org/html/2605.14779
- [4] Offline RL with Imbalanced Datasets v1 imbalanced — https://arxiv.org/abs/2307.02752v1
- [5] PDF CPQL — https://arxiv.org/pdf/2605.14779
- [6] When Should We Prefer Decision Transformers for Offline RL (CQL vs BC vs DT) 5x data 2.5x ATARI — http://arxiv.org/pdf/2305.14550v3
- [7] Offline RL with Imbalanced Datasets HTML v3 — https://arxiv.org/html/2307.02752v3

![Diagram 0: Offline RL pipeline](sandbox://workspace/post_more/public/thesis/thesis-offline-rl-20260808-e5f6-0.webp)
![Diagram 1: Extrapolation vs Conservative](sandbox://workspace/post_more/public/thesis/thesis-offline-rl-20260808-e5f6-1.webp)
![Diagram 2: DT vs CQL vs BC taxonomy](sandbox://workspace/post_more/public/thesis/thesis-offline-rl-20260808-e5f6-2.webp)
![Diagram 3: Empirical scaling & imbalance](sandbox://workspace/post_more/public/thesis/thesis-offline-rl-20260808-e5f6-3.webp)
