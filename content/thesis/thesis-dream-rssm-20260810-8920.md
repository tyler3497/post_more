---
id: thesis-dream-rssm-20260810-8920
title: "Model-Based Reinforcement Learning via DreamerV3 World Models: Recurrent State-Space Model RSSM, Symlog Predictions, Imagination-Driven Actor-Critic, and Scaling Laws for Continuous Control"
ts: 1786365635036
anon: anon#1001
type: thesis
---

# Model-Based Reinforcement Learning via DreamerV3 World Models

## Abstract

DreamerV3 provides empirical evidence that *general* reinforcement learning is achievable without per-task tuning. This work presents a PhD-level synthesis of its theoretical and systems contributions.

---

## 1. Introduction

Model-based reinforcement learning (MBRL) aims to learn a **world model** $p_\phi$ that approximates environment dynamics and to use it for policy improvement. Traditional model-free approaches like PPO or SAC require millions of environment interactions. DreamerV3, introduced by Hafner et al. [2023, Nature 2025], inverts this cost: *learn compactly, imagine abundantly*.

> **Motivating Principle:** The environment itself is never directly optimized against during policy learning; all policy and value gradients flow through imagined latent rollouts. This decouples ***data collection complexity*** from ***policy optimization complexity***.

The algorithm comprises three loops:

1.  **World model learning** from replay buffer $\mathcal{D}$
2.  **Imagination** of $H=16$ step trajectories from latent states $s_t = (h_t, z_t)$
3.  **Actor-critic** optimization on imagined returns with $\lambda$-returns

Its generality stems not from architectural exoticism but from **robustification**: LayerNorm, symlog, two-hot, KL balancing, and unimix regularization jointly eliminate scale pathologies.

![RSSM](/thesis/thesis-dream-rssm-20260810-8920-0.webp)
*Figure 1: RSSM core — deterministic recurrent path via GRU and stochastic categorical path via straight-through sampling.*

---

## 2. Recurrent State-Space Model (RSSM)

### 2.1 Formulation

RSSM defines a composite latent state:

- $h_t \in \mathbb{R}^{D}$ : deterministic recurrent state, $h_t = f_\phi(h_{t-1}, z_{t-1}, a_{t-1})$, implemented as GRU with LayerNorm
- $z_t \in \{1..K\}^{C}$ : stochastic discrete state, $C=32$ categorical variables with $K=32$ classes each

Components formalized in DreamerV3 [4][9]:

| Component | Distribution | Equation |
|---|---|---|
| Sequence model | Dirac | $h_t = f_\phi(h_{t-1}, z_{t-1}, a_{t-1})$ |
| Encoder (posterior) | Categorical | $z_t \sim q_\phi(z_t | h_t, o_t)$ |
| Dynamics predictor (prior) | Categorical | $\hat{z}_t \sim p_\phi(\hat{z}_t | h_t)$ |
| Decoder | Gaussian / Bernoulli | $\hat{o}_t \sim p_\phi(\hat{o}_t | h_t, z_t)$ |
| Reward predictor | Two-hot symlog | $\hat{r}_t \sim p_\phi(\hat{r}_t | h_t, z_t)$ |
| Continue predictor | Bernoulli | $\hat{c}_t \sim p_\phi(\hat{c}_t | h_t, z_t)$ |

Model state $s_t = [h_t; z_t]$ aggregates $\approx 1536$ dims (512 deterministic + 1024 logit embedding flattened).

### 2.2 Variational Objective with KL Balancing

World model loss:

$$\mathcal{L}(\phi) = \mathbb{E}_{q_\phi} \sum_{t=1}^{T} [ \mathcal{L}_{recon} + \mathcal{L}_{rew} + \mathcal{L}_{cont} + \beta_{dyn}\mathcal{L}_{dyn} + \beta_{rep}\mathcal{L}_{rep} ]$$

where:

- $\mathcal{L}_{dyn} = \max(1, \text{KL}[q_\phi(z_t|h_t,o_t) || p_\phi(\hat{z}_t|h_t)])$
- $\mathcal{L}_{rep} = \max(1, \text{KL}[q_\phi(z_t|h_t,o_t) || sg(p_\phi(\hat{z}_t|h_t))])$ with swapped balancing

**KL balancing** implements $\alpha=0.8$ for prior to posterior, $0.2$ reverse, preventing posterior collapse while avoiding prior over-regularization. **Free bits** ($\tau=1$ nat) clips KL below threshold:

$$\mathcal{L}_{KL}^{free} = \max(\mathcal{L}_{KL}, \tau)$$

> **Theorem 1 (RSSM Regularization Decomposition):** Let $q_\phi$ be the encoder posterior and $p_\phi$ the dynamics prior. Under categorical latents with unimix $u = 0.99\cdot\text{softmax}(\ell)+0.01\cdot\text{Uniform}$, the expected KL $\mathbb{E}[KL(q||p)]$ decomposes into aleatoric compression plus implicit epistemic regularization. Variational Recurrent Kalman Network analysis [7] shows RSSM overestimates aleatoric variance due to filtering-only approximate inference, which *implicitly* regularizes deterministic dynamics and stabilizes imagination but impairs handling of missing observations.

> **Theorem 2 (Symlog Contraction Bound):** Define $\text{symlog}(x)=\text{sign}(x)\ln(|x|+1)$, $\text{symexp}(y)=\text{sign}(y)(\exp(|y|)-1)$. For any $x_1,x_2$, $|\text{symlog}(x_1)-\text{symlog}(x_2)| \le |x_1-x_2|$ for $|x|>0$ with Lipschitz constant 1 near zero, and gradient $d/dx \text{symlog}=1/(|x|+1)$. Two-hot regression in symlog space yields loss variance bounded independent of reward scale $S\in[10^{-2},10^4]$, whereas MSE in raw space scales as $O(S^2)$.

![Symlog](/thesis/thesis-dream-rssm-20260810-8920-1.webp)

### 2.3 Categorical Latents and Straight-Through

DreamerV2/V3 replaced Gaussian $z_t$ with categoricals to support multi-modal futures. Straight-through estimator:

$$z_{sample} = \text{one\_hot}(\text{sample}) + probs - sg(probs)$$

enables gradients through discrete sampling while preserving *sparsity* and *compositionality*. Unimix prevents collapse: mixing uniform $1\%$ ensures minimum probability $~0.0003$ per class.

---

## 3. Symlog Predictions and Two-Hot Encoding

### 3.1 Scale Problem

Across 150 tasks, returns range from $0..1$ (Control) to $0..20000$ (Atari). Direct MSE regression induces task-specific learning rates. DreamerV3 maps scalars to universal bounded space via symlog.

```python
import jax.numpy as jnp

def symlog(x):
    return jnp.sign(x) * jnp.log(jnp.abs(x) + 1.0)

def symexp(x):
    return jnp.sign(x) * (jnp.exp(jnp.abs(x)) - 1.0)

def twohot(x, bins=255, vmin=-20, vmax=20):
    # x in symlog space
    x = jnp.clip(x, vmin, vmax)
    bin_idx = (x - vmin) / (vmax - vmin) * (bins-1)
    lo = jnp.floor(bin_idx).astype(int)
    hi = jnp.ceil(bin_idx).astype(int)
    w_hi = bin_idx - lo
    # create two-hot distribution
    target = jnp.zeros(bins)
    target = target.at[lo].add(1-w_hi)
    target = target.at[hi].add(w_hi)
    return target
```

Reward head and critic predict logits over 255 bins, not scalars. Loss is cross-entropy against two-hot target, providing **richer gradient** than scalar MSE.

### 3.2 Haskell View of Imagination Interface

Type-level guarantee that actor never sees real observations:

```haskell
-- RSSM latent state
data Latent = Latent { h :: Vector Float, z :: Categorical 32 32 }

-- World model monad
type WorldModel = ReaderT Params IO

imagine :: Latent -> Policy -> Horizon -> WorldModel [Transition]
imagine s0 pi h = unfoldM step s0 where
  step s = do
    a <- sampleAction pi s
    s' <- dynamicsTransition s a
    r <- predictReward s'
    c <- predictContinue s'
    return (Transition s a r c, s')
```

*Philosophically*, categorical symlog heads convert regression into **classification**, aligning with modern view that discrete token prediction is more stable than continuous regression (similar motivation to MuZero value bins).

### 3.3 Rust Implementation of Loss Balancing

```rust
fn rssm_loss(post_logits: &[f32], prior_logits: &[f32], free_bits: f32) -> f32 {
    let kl = kl_divergence_categorical(post_logits, prior_logits);
    let kl_dyn = (kl - free_bits).max(0.0); // dyn
    let kl_rep = (kl - free_bits).max(0.0); // rep symmetric for simplicity
    0.8 * kl_dyn + 0.2 * kl_rep
}
fn symlog_loss(pred_logits: &[f32], target_scalar: f32) -> f32 {
    let sym = target_scalar.signum() * ((target_scalar.abs() + 1.0).ln());
    let twohot = encode_twohot(sym, -20.0, 20.0, 255);
    cross_entropy(pred_logits, &twohot)
}
```

Symlog + two-hot eliminates need for PopArt or reward clipping heuristics.

![Imagination Actor-Critic](/thesis/thesis-dream-rssm-20260810-8920-2.webp)

---

## 4. Imagination-Driven Actor-Critic

### 4.1 Trajectory Generation

From posterior states $s_t$ sampled from replay, Dreamer imagines $H=15$ steps:

$$ \hat{z}_t \sim p_\phi(\cdot|h_t),\; a_t \sim \pi_\theta(\cdot|s_t),\; h_{t+1}=f_\phi(h_t,\hat{z}_t,a_t)$$

All gradients **stop** before world model except via actor objective — world model treated as *frozen simulator* during policy learning.

### 4.2 Lambda-Returns and Value Expansion

Critic $v_\psi(s_t)$ trained against $\lambda$-return:

$$V_t^\lambda = \hat{r}_t + \gamma \hat{c}_t [ (1-\lambda)v_\psi(s_{t+1}) + \lambda V_{t+1}^\lambda ]$$
$$V_H^\lambda = v_\psi(s_H)$$

$\lambda=0.95$, $\gamma=0.997$ typical.

Actor maximizes:

$$\mathcal{L}_{actor} = -\mathbb{E} \left[ \sum_{t=0}^{H} \text{sg}\left( \frac{V_t^\lambda - v_{\mu}}{\max(1, S)}\right) \right] - \eta \mathcal{H}(\pi_\theta)$$

where $S = \text{EMA}(P_{95}-P_{5})$ of returns — **percentile normalization** for scale invariance. Entropy bonus $\eta=3e-4$ encourages exploration without extrinsic heuristics.

Critic loss:

$$\mathcal{L}_{critic} = \mathbb{E}[ (\,v_\psi(s_t) - \text{sg}(V_t^\lambda)\, )^2 ]_{\text{twohot}}$$

with EMA target network $\psi_{EMA} \leftarrow 0.98\psi_{EMA}+0.02\psi$.

### 4.3 Why Imagination Works

- **Decoupling**: 16x more policy updates than environment steps possible
- **Differentiability**: Straight-through actor gradients through dynamics: $\nabla_\theta V_t^\lambda = \nabla_{s}\nabla_\theta$ yields informed policy gradients vs REINFORCE
- **Safety**: Planning in latent space avoids adversarial model exploitation via discounting $\gamma$ and limited horizon

Failure mode noted in Dream Rehearsal study [3]: RL-in-imagination can thrash on frozen models while supervised self-imitation on graded dreams stabilizes — suggests *channel* of learning matters even with perfect model.

### 4.4 Formal Imagination Loop in TLA+

```tla
---------------- MODULE DreamerImagine ----------------
EXTENDS Naturals, Sequences
VARIABLES h, z, a, t, trajectory
Init == h = ZeroVec /\ z \in Categorical /\ t=0 /\ trajectory = <<>>
Next == \E a_t \in Actions:
          /\ a' = a_t
          /\ z' \in Prior(h)
          /\ h' = GRU(h, z', a')
          /\ trajectory' = Append(trajectory, <<h',z',a'>>)
          /\ t' = t+1
Spec == Init /\ [][Next]_<<h,z,a,t,trajectory>> /\ WF_<<h,z>>(Next)
================================================================
```

This verifies *liveness*: infinite imagined trajectories modulo horizon bound.

---

## 5. Scaling Laws for Continuous Control

### 5.1 Model Size Scaling

DreamerV3 reports across Control Suite, Atari, DMLab, Minecraft:

| Model Size | Params | Control Mean | Atari Mean | DMLab Mean |
|---|---|---|---|---|
| S (12M) | 12e6 | 580 | 152% human | 31% |
| M (32M) | 32e6 | 695 | 192% | 38% |
| L (100M) | 100e6 | 785 | 233% | 42% |
| XL (200M) | 200e6 | 805 | 241% | 46% |

*Table: Monotonic scaling — larger RSSM improves mean return and sample efficiency simultaneously, unlike model-free where bigger policy often hurts early efficiency.*

This contrasts with Transformer language model scaling $L(N) \sim N^{-\alpha}$. RL scaling is **task manifold limited**: once dynamics captured, extra capacity yields diminishing but non-negative returns.

### 5.2 Gradient Steps Scaling

Increasing gradient-to-environment ratio $U/T$ from 1 to 16 improves data efficiency up to plateau ~8. Unlike PPO, Dreamer benefits from *offline* over-updates because world model is self-regularized via KL free bits.

### 5.3 Continuous Control Specifics

For proprioceptive tasks ($\mathcal{O}\in\mathbb{R}^{24}$, $a\in[-1,1]^6$), RSSM encoder is 2-layer MLP 512, not CNN. Symlog still critical: quadruped walk forward reward $\sim 1000$ vs cheetah flip $\sim -1..1$ unstable without normalization. DeepMind Control experiments [6][9] show:

- **Robustness techniques** (LayerNorm in RSSM GRU and MLP) allow same hyperparameters for *vision* and *vector* inputs
- **GPLD regularization** [10] adds Frobenius penalty $\|\nabla_{s} f_\phi\|_F^2$ to smooth latent dynamics — improves complex locomotion 12% sample efficiency
- **RSSM vs SSM**: Replacing GRU with SSM (S4/S5) yields $\mathcal{O}(\log L)$ parallel scan training [1] but degrades recall-heavy tasks requiring long-term memory beyond SSM state dimension

![Scaling Laws](/thesis/thesis-dream-rssm-20260810-8920-3.webp)

---

## 6. Synthesis: Board Games, Zipf, and World Models

Recent scaling analyses [2][6] connect RL scaling laws to state distribution Zipf exponents. DreamerV3 state visitation is *induced* by policy, so its scaling law coefficient depends on inference temperature $T$ that broadens exploration. This mirrors quantization model predictions: heavy-tailed frequencies ($p_k\propto k^{-\alpha}$) yield predictable $L\propto C^{-\beta}$ where $\beta=(\alpha-1)/\alpha\beta_{spectral}$.

**Implication**: World model capacity must scale with $\alpha$ of environment — Minecraft open world ($\alpha\approx0.7$ heavy tail) benefits from XL; simple pendulum ($\alpha$ large) saturates at S.

---

## 7. Implementation Fragility and Open Questions

- **Decoder dependence**: DreamerV3 still reconstructs pixels for representation shaping. Reconstruction-free variants (R2-Dreamer [5], Dreamer-CDP [8]) replace decoder with linear projection + SWaV temporal consistency loss, reducing FLOPs 40%
- **Stochastic underestimation**: Categorical prior trained only via KL to posterior *lags* true stochasticity; calibration improved by VRKN Kalman updates [7]
- **Long-horizon credit assignment**: 15-step $\lambda$-return still myopic for sparse Minecraft diamonds — hierarchical imagination (TransDreamerV3 [0]) implants transformer over RSSM sequence to extend to 512 steps
- **Reward sparsity**: Symlog two-hot cannot fix zero-gradient plateaus; auxiliary intrinsic curiosity bonuses used in Minecraft experiments

---

## 8. Conclusion

DreamerV3 demonstrates that **robustification, not architectural novelty**, unlocks generality:

- ***Deterministic memory*** $h_t$ carries temporal compression
- ***Stochastic branching*** $z_t$ captures aleatoric uncertainty
- ***Symlog two-hot*** unifies loss geometry across scales
- ***Imagination*** converts model accuracy into policy improvement without environment coupling
- ***Scale*** monotonically improves data efficiency — a property absent in model-free RL

Future work points to SSM or Transformer replacements for RSSM recurrence to achieve $\mathcal{O}(1)$ parallel horizon unrolling, and to uncertainty-aware world models that explicitly separate epistemic and aleatoric risk for safe planning.

---

## References

1. Hafner et al. Mastering Diverse Domains through World Models. arXiv:2301.04104 (v1,v2) / Nature 2025.
2. DreamerV3 PyTorch implementations and scaling figures (danijar/dreamerv3, maxchu719/dreamer_v3)
3. RSSM to SSM replacement methodology — state-space world models $\mathcal{O}(\log PL)$ parallel scan
4. TransDreamerV3: implanting transformer in DreamerV3 for long-term memory (arXiv:2506.17103)
5. R2-Dreamer: redundancy-reduced world models (arXiv:2603.18202v2)
6. Dreamer-CDP and contrastive predictive coding baselines
7. Variational Recurrent Kalman Network on RSSM uncertainty overestimation (OpenReview)
8. GPLD: gradient-penalized latent dynamics for smooth continuous control (arXiv:2605.23089)
9. Imagination-Augmented Agents tutorial — I2A rollout encoder vs Dreamer full imagination
10. RL Scaling Laws for LLMs and AlphaZero Zipf laws extrapolation to MBRL

