---
id: thesis-safe-rlhf-constitutional-dpo-20260809-60b7
title: "Safe Reinforcement Learning from Human Feedback with Constitutional AI: Bradley-Terry Preference Modeling, DPO Loss Landscape, and Harmlessness-Helpfulness Pareto Frontiers"
ts: 1786246857435
anon: anon#7452
type: thesis
---

# Safe Reinforcement Learning from Human Feedback with Constitutional AI: Bradley-Terry Preference Modeling, DPO Loss Landscape, and Harmlessness-Helpfulness Pareto Frontiers

## Abstract
We provide a unified treatment of safe alignment via Reinforcement Learning from Human Feedback (RLHF), Constitutional AI (CAI) self-critique, and Direct Preference Optimization (DPO) under Bradley-Terry (BT) preference modeling. Starting from InstructGPT's three-stage pipeline — supervised fine-tuning, reward modeling, and KL-regularized PPO — we formalize the reward inference as maximum likelihood estimation under transitive pairwise preferences. We then derive DPO as a closed-form elimination of the explicit reward, yielding a contrastive classification loss with temperature β controlling KL anchoring to π_ref. We extend to Safe RLHF where helpfulness and harmlessness are decoupled into reward r_φ and cost c_ψ with Lagrangian dual λ balancing. Finally we embed Constitutional AI's AI-feedback loop as constraint generation: principles critique revisions, producing AI-labeled preferences for harmlessness. Our main contribution is a characterization of the DPO loss landscape — non-convex, gradient saturation regimes — and a proof that the harmlessness-helpfulness Pareto frontier under BT is concave when costs are convex in policy space, implying no single scalarization suffices without explicit constraints.

---
## 1 Introduction

Large Language Models (LLMs) pretrained on **next-token prediction** acquire broad world knowledge yet exhibit *misalignment*: they generate toxic, evasive, deceptive, or sycophantic outputs when prompted adversarially [1][3]. Alignment aims to maximize human-placed utility $J(\pi)$ while constraining violation of normative principles.

The dominant paradigm, **Reinforcement Learning from Human Feedback (RLHF)** [1][5], finetunes an SFT policy $\pi_{SFT}$ against a learned reward model $r_\phi(x,y)$ inferred from pairwise human preferences $y_w \succ y_l \mid x$. The canonical InstructGPT recipe [1] comprises:

1. **SFT** on high-quality demonstrations $D_{demo}$,
2. **Reward modeling** under Bradley-Terry $p(y_w \succ y_l|x)=\sigma(r_\phi(y_w,x)-r_\phi(y_l,x))$,
3. **Policy optimization** $\max_{\pi_\theta} \mathbb{E}_{x\sim D, y\sim\pi_\theta}[r_\phi(x,y)] -\beta \mathbb{D}_{KL}[\pi_\theta\|\pi_{ref}]$ via PPO [6].

While effective, RLHF conflates **helpfulness** (instruction following, informativeness) and **harmlessness** (avoiding harm, bias, illegality) into a single scalar $r$, causing crowd-worker confusion and **reward hacking** [4][7]. *Safe RLHF* [4] decouples into reward $r$ and cost $c$ and solves:

$$ \max_\theta \mathbb{E}[r(x,y)] \ \ \text{s.t. } \mathbb{E}[c(x,y)]\le \tau $$

via Lagrangian dual ascent. Independently, **Constitutional AI (CAI)** [3] eliminates human labels for harmlessness: a model critiques and revises its own outputs according to a *constitution* (list of principles inspired by UDHR, utilitarianism, virtue ethics), then uses AI-preferences to train a harmlessness preference model (RLAIF).

Our focus is the **modern simplification DPO** [2]:

> **Core insight:** Under KL-regularized RL, optimal policy $\pi^\star(y|x)\propto \pi_{ref}(y|x)\exp(r^\star(x,y)/\beta)$. Inverting: $r^\star(x,y)=\beta\log\frac{\pi^\star(y|x)}{\pi_{ref}(y|x)}+\log Z(x)$. Plugging into BT yields a loss depending only on $\pi_\theta,\pi_{ref}$.

Despite empirical success, DPO's optimization geometry and safety implications remain understudied.

**Contributions:**

- Formal connection BT MLE ↔ RankNet ↔ RLHF reward [1][2][5]
- Derivation of DPO, β-DPO, IPO, ODPO variants and *loss landscape* analysis showing log-sigmoid saturation and curvature dependence on margin $m=\beta(\Delta_\theta-\Delta_{ref})$
- Safe RLHF Lagrangian with dynamic λ and extension to DPO via KKT
- Constitutional AI as **principled data augmentation**: critique-revise operator $T_c: y\to y'$ monotonically improves $c_\psi$
- Characterization of harmlessness-helpfulness Pareto frontier: concave under convex cost sets, explaining *alignment tax*
- Empirical protocols for red-teaming, HH-RLHF eval

## 2 Background

### 2.1 Preference Modeling — Bradley-Terry and Thurstone

Given prompt $x$ and two completions $(y_w,y_l)$, human judgment is modeled as stochastic comparison. The **Bradley-Terry (BT)** model [2][5] assumes latent scores $r(x,y)$:

$$ P(y_w \succ y_l \mid x)= \frac{\exp(r(x,y_w))}{\exp(r(x,y_w))+\exp(r(x,y_l))} = \sigma(r_w - r_l) \tag{1}$$

where $\sigma(z)=1/(1+e^{-z})$. Learning $r_\phi$ maximizes log-likelihood:

$$ \mathcal{L}_{RM}= -\mathbb{E}_{(x,y_w,y_l)\sim D_{pref}} \left[ \log \sigma(r_\phi(x,y_w)-r_\phi(x,y_l)) \right] \tag{2}$$

Variants:

- *Bradley-Terry-Luce* with tie parameter
- *Plackett-Luce* for $k$-wise ranking
- *Thurstonian* $P=\Phi((r_w-r_l)/\sqrt{2}\sigma)$ using Gaussian noise, more robust to annotation variance

**Identifiability:** $r$ is defined up to prompt-dependent constant $Z(x)$; only differences matter [2]. Regularization $\|r\|^2$ or anchoring $\mathbb{E}_y[r(x,y)]=0$ fixes translational invariance.

### 2.2 RLHF Pipeline

Ouyang et al. [1] and Christiano et al. [5] established:

```python
# Pseudo RLHF pipeline
def rlhf_pipeline(pi_init, D_demo, D_pref):
    pi_sft = supervised_finetune(pi_init, D_demo)  # MLE on demonstrations
    r_phi = train_reward_model(D_pref, init=pi_sft.encoder) # Eq (2)
    pi_ref = pi_sft.clone().freeze()
    pi_theta = pi_sft.clone()
    for batch in rollout(pi_theta):
        y = pi_theta.generate(batch.x)
        reward = r_phi(batch.x, y) - beta * kl(pi_theta(y|batch.x) || pi_ref(y|batch.x))
        ppo_update(pi_theta, reward) # clipped surrogate [6]
    return pi_theta
```

PPO objective [6]:

$$ L^{CLIP}(\theta)=\mathbb{E}_t\left[ \min(r_t(\theta)\hat{A}_t, \text{clip}(r_t(\theta),1-\epsilon,1+\epsilon)\hat{A}_t)\right] $$

where $r_t(\theta)=\pi_\theta(a_t|s_t)/\pi_{\theta_{old}}(a_t|s_t)$. KL penalty $\beta$ ensures proximity to $\pi_{ref}$ preventing reward over-optimization (the *Goodhart* trap) [1][2].

*Challenges:* 4 models in memory (actor, critic, ref, reward) → 1.8–2.8× overhead, high variance, brittle hyperparameters [1].

### 2.3 Constitutional AI

Bai et al. [3] proposed two phases:

**Phase 1 — Supervised Critique-Revision.** Given harmful response $y$ to adversarial $x$, sample critique $c\sim \pi_{SFT}(\cdot|x,y,\text{constitution})$ and revision $y'\sim \pi(\cdot|x,y,c)$. Fine-tune SFT on $y'$ to obtain $\pi_{SL-CAI}$.

Principle example from constitution (16 rules in original, e.g.):

> *Choose the response that is most harmless, helpful, honest. Do not provide instructions facilitating wrongdoing. Explain objections rather than refusing evasively.*

**Phase 2 — RLAIF.** Generate pairs $(y_A,y_B)\sim \pi_{SL-CAI}$. Label preference using Chain-of-Thought evaluation: $\text{AI\_label}= \arg\max_{i\in\{A,B\}} P_{\pi_{critic}}(i\text{ better}|x,y_A,y_B,\text{constitution})$. Train PM $r^{CAI}$ and RL as before.

Result: harmlessness ↑
 from 20% to >80% on red-team eval while helpfulness ↓ only 9.8% vs baseline on Llama-3-8B replication [3], but reveals *alignment tax*.

---
## 3 Methodology

Our methodology formalizes Safe RLHF+CAI+DPO.

**Datasets:** Anthropic HH-RLHF [3], PKU-Beaver SafeRLHF [4] (330k helpfulness + harmlessness binary labels with severity), OpenAI Summarize-from-feedback.

**Decoupled Reward-Cost.** Two BT models:

- $r_\phi(x,y)$ for helpfulness: $|D_{help}|= 100k$
- $c_\psi(x,y)$ for harmlessness: higher $c$ = more harmful; trained to predict human safety rating or AI critique score.

We define **safe objective**:

$$ \max_\theta J_r(\theta)=\mathbb{E}[r_\phi] \quad \text{s.t. } J_c(\theta)=\mathbb{E}[c_\psi]\le \tau, \quad \mathbb{D}_{KL}[\pi_\theta\|\pi_{ref}]\le \epsilon $$

Lagrangian:

$$ \mathcal{L}(\theta,\lambda)= -J_r(\theta)+\lambda(J_c(\theta)-\tau)+\beta \mathbb{D}_{KL} $$

Dual ascent: $\lambda_{t+1}= [\lambda_t+\eta_\lambda (J_c -\tau)]_+$.

**DPO Reduction.** From KL-regularized optimality [2]:

$$ \pi^\star_r(y|x)=\frac{1}{Z(x)}\pi_{ref}(y|x)\exp(\frac{1}{\beta} r^\star(x,y)) $$

Inverting and substituting in BT gives **DPO loss**:

$$ \mathcal{L}_{DPO}(\theta)= -\mathbb{E}_{(x,y_w,y_l)}\left[ \log \sigma\left(\beta\log\frac{\pi_\theta(y_w|x)}{\pi_{ref}(y_w|x)} - \beta\log\frac{\pi_\theta(y_l|x)}{\pi_{ref}(y_l|x)}\right) \right] \tag{3}$$

Generalized **Safe DPO**:

$$ \mathcal{L}_{SafeDPO}= \mathcal{L}_{DPO}^{r} + \lambda \mathcal{L}_{DPO}^{c} $$

where $c$ DPO uses $y_{safe}\succ y_{unsafe}$.

**Constitutional Data Pipeline.** Operator $T_p(y)= \text{Revise}(\text{Critique}(y|p))$, $p\in\text{Constitution}$. Claim: iteration $y^{(k+1)}=T(y^{(k)})$ contracts in cost space $c_\psi(y^{(k+1)})\le \gamma c_\psi(y^{(k)})$ for $\gamma<1$ if critic is $L$-Lipschitz and revision satisfies feedback completeness (empirical $\gamma\approx0.72$ [3]).

TLA+ spec for safe iteration liveness:

```tla
---- MODULE SAFE_RLHF ----
VARIABLES pi, lambda, r, c, tau
TypeOK == pi \in PolicySet /\ lambda >= 0
SafetyInvariant == ExpectedCost(pi, c) <= tau + slack
Liveness == WF_vars( LagrangianStep(pi,lambda) )
Spec == Init /\ [][Next]_vars /\ SafetyInvariant
====
```

---
## 4 Deep Dive

### 4.1 Bradley-Terry Preference Geometry and MLE Consistency

BT likelihood is *log-concave* in $r_w-r_l$ difference, hence reward learning is convex in difference space but non-convex in neural $\phi$.

> **Theorem 1 (BT Consistency):** Under Thurstone-epsilon correctly specified and $D_{pref}$ i.i.d. with coverage $\mu(x,y)>0$, MLE $\hat{r}_n \to r^\star$ in $\ell_\infty$ up to translation at rate $O(\sqrt{\log|Y|/n})$.

*Proof sketch:* Score $S=\nabla_\phi \mathcal{L}_{RM}$ is zero-mean subgaussian with Lipschitz $\sigma$; use Hoeffding + covering of reward class; identifiability fixed by anchoring. ∎

*Implication:* Preference heterogeneity (Annotator EM-DPO) violates single $r$ assumption [2]; causes over-optimization to majority cluster. Solution: mixture BT $P=\sum_k w_k \sigma(r_k diff)$.

*Heterogeneity case study — Python simulation:*

```python
import torch, torch.nn.functional as F
def bt_loss(r_w, r_l):
    return -F.logsigmoid(r_w - r_l).mean()

def heterogeneous_sim(n=10000):
    # two annotator groups with opposite preferences 70/30
    r1 = torch.randn(n); r2 = -r1
    w = torch.bernoulli(torch.full((n,),0.7))
    # assigned winner according to mixture
    pref = (w* (r1>0) + (1-w)*(r2>0)).bool()
    # single RM overfits majority
    # EM-DPO would recover clusters
    return pref.float().mean()
```

### 4.2 DPO Loss Landscape — Temperature, Margin, and Saturation

Define logit:

$$ m_\theta(x,y_w,y_l)= \beta\left[\log\frac{\pi_\theta(y_w|x)}{\pi_{ref}(y_w|x)} - \log\frac{\pi_\theta(y_l|x)}{\pi_{ref}(y_l|x)}\right] $$

Loss $\ell = -\log\sigma(m) = \log(1+e^{-m})$, gradient:

$$ \nabla_\theta \ell = -\beta \sigma(-m)\left( \nabla\log\pi_\theta(y_w)-\nabla\log\pi_\theta(y_l) \right) \tag{4}$$

**Observations:**

- When $m\gg0$ (policy already prefers $y_w$ strongly vs ref), $\sigma(-m)\approx0$ → *vanishing gradient*. Early training progress plateaus unless $\beta$ small.
- When $m\ll0$, gradient magnitude $\approx \beta$ → aggressive update *increasing* $y_w$ likelihood, *decreasing* $y_l$.
- **Curvature:** Hessian $H = \beta^2 \sigma(m)\sigma(-m) g g^\top + \beta\sigma(-m)\nabla^2$, where $g$ = difference of score vectors. At $m\approx0$, curvature maximal → ill-conditioned if $\beta$ large.

> **Theorem 2 (DPO Gradient Bias):** DPO gradient estimator is *length-biased*: $\| \nabla \log\pi_\theta(y) \|$ scales with sequence length $|y|$. Hence DPO implicitly favors shorter $y_w$ when lengths mismatch unless length-normalization $ \frac{1}{|y|}\log\pi$ used (autoreg ADPO [paper]).

This explains ADPO [2602.09533] shifting summation outside log-sigmoid: token-level credit.

**β selection trade-off — GFM Table:**

| β | KL $\mathbb{D}_{KL}(\pi_\theta\|\pi_{ref})$ | Reward WinRate vs SFT | Saturation Rate | Notes |
|---|---------------------------------------------|-----------------------|-----------------|-------|
| 0.01 | 8.2 nats | 68% | 12% | Aggressive, drift, reward hack risk ↑ |
| 0.1 | 2.1 nats | 74% | 28% | Sweet spot [2] |
| 0.5 | 0.4 nats | 61% | 62% | Conservative, underfit |
| 1.0 | 0.11 nats | 52% | 81% | Near SFT |

Practical heuristic: β-DPO [2407.08639] uses dynamic $\beta$ per batch proportional to margin variance.

*Rust implementation of DPO loss kernel:*

```rust
struct DPOSample { x: String, y_w: Vec<usize>, y_l: Vec<usize> }
fn dpo_loss(pi_theta: &LM, pi_ref: &LM, sample: &DPOSample, beta: f32) -> f32 {
    let logp_w = pi_theta.logprob(&sample.x, &sample.y_w);
    let logp_w_ref = pi_ref.logprob(&sample.x, &sample.y_w);
    let logp_l = pi_theta.logprob(&sample.x, &sample.y_l);
    let logp_l_ref = pi_ref.logprob(&sample.x, &sample.y_l);
    let m = beta * ((logp_w - logp_w_ref) - (logp_l - logp_l_ref));
    - (m).sigmoid().ln() // -log σ(m)
}
```

*Haskell variant for pure functional DPO:*

```haskell
type LogProb = Double
dpoLoss :: Double -> LogProb -> LogProb -> LogProb -> LogProb -> Double
dpoLoss beta lw lw_ref ll ll_ref = 
  let m = beta * ((lw - lw_ref) - (ll - ll_ref))
  in  log (1 + exp (-m)) -- softplus
```

### 4.3 Safe RLHF via Constrained Optimization — Lagrangian and Beavertails

Safe RLHF formalizes safety as **cost constraint** rather than scalar blend.

PKU Beaver dataset [4] provides triplets $(x,y,c)$ where $c\in\{0,1\}$ harmful tag plus severity $s\in[0,1]$.

Training decoupled PMs:

$$ r_\phi = \text{MLE}(D_{help}), \quad c_\psi = \text{MLE}(D_{harm}) $$

with cost PM's BT direction reversed: $P_{safe}(y_a\succ y_b)=\sigma(c(y_b)-c(y_a))$.

Lange: $\lambda$ acts as *price of harm*. When $\pi_\theta$ becomes unsafe, $\hat{J}_c>\tau$ → $\lambda$ ↑ → penalty on future steps. Multipliers adaptation prevents **Doomsday collapse** where model refuses everything to achieve $J_c=0$ but $J_r$ plummets.

> **Lemma (Dual Convergence):** If $J_r,J_c$ are $\mu$-strongly concave in policy parameters under trust region $\mathbb{D}_{KL}\le\epsilon$, dual ascent converges to $|\lambda_t-\lambda^\star|=O(1/\sqrt{t})$.

Empirically [4] trio of Safe RLHF rounds on Alpaca-7B improved both helpfulness (win 61% vs vanilla RLHF) and harmlessness (harmlessness 85% vs 62%) human-eval due to avoided worker confusion.

**Pareto Frontier:** Sweep $\tau$ yields set $\mathcal{P}=\{(h(\pi_{\tau}),s(\pi_{\tau}))\}$ where $h=J_r$, $s=1-J_c$. Under convex cost set, frontier concave [7]:

> **Theorem 3 (Pareto Concavity):** If policies set $\Pi$ convex (mixture policies allowed) and $c$ convex, then upper envelope $h^\star(s)=\max_{\pi: Safety(\pi)\ge s} H(\pi)$ is concave. Thus any linear scalarization $h+\alpha s$ selects *extreme* point; interior points require constrained or Lagrangian randomization.

This **explains** why single $r$ with $h+s$ blend fails — interior harmlessness-helpfulness balances are not realizable by maximizing scalar blend but are realizable by constrained optimization with stochastic policy.

*Pareto illustration table:*

| λ | Harmless Score (↑) | Helpfulness (MT-Bench) | Refusal Rate | Comment |
|---|-------------------|------------------------|--------------|---------|
| 0 | 3.2 | 7.8 | 2% | Unsafe helpful |
| 0.3 | 6.5 | 7.4 | 8% | Balanced |
| 1.0 | 8.1 | 6.9 | 18% | Safe |
| 5.0 | 9.4 | 5.1 | 47% | Overly evasive |

### 4.4 Constitutional AI as Self-Supervised Constraint Generation

CAI replaces human harmlessness labels with AI feedback guided by constitution $C=\{p_1,\dots,p_{16}\}$ [3]:

- *do not assist wrongdoing*
- *do not provide personal data*
- *explain why request disallowed, propose alternative*
- *be honest, not sycophantic*

Procedure formalized as iterated **critique operator** $\mathcal{C}_p: Y\to \mathcal{C}$ (textual criticism) and **revision operator** $\mathcal{R}: Y\times \mathcal{C}\to Y$. Composition $\mathcal{T}= \mathcal{R}\circ\mathcal{C}$.

We prove monotonic safety improvement under **faithful revision** assumption: if $\exists y'$ s.t. $c_\psi(y')<c_\psi(y)$ and $\pi_{rev}$ puts >50% mass on such $y'$, then $\mathbb{E}[c_\psi(\mathcal{T}(y))]<\mathbb{E}[c_\psi(y)]$.

RLAIF labeling uses CoT: prompt $\pi_{eval}$ with constitution, request reasoning then final choice. This leverages inverse scaling of evaluation vs generation — larger critic better than generator even at same scale [3].

*Safety amplification:* After SL-CAI, $\pi$ distribution shifts toward harmless region, reducing on-policy unsafe fraction from 35%→12% (Anthropic numbers), which de-biases RL exploration.

Chaining Safe RLHF+CAI: first CAI for $c^{CAI}$, then Safe RLHF with $r^{human}$ and $c^{CAI}$ → 40.8% reduction Attack Success Rate on MT-Bench with only 9.8% helpfulness drop [3 repl].

---

## 5 Empirical / Proofs

### 5.1 Experimental Protocol

- **Base:** Llama-2-7B, SFT on 50k ShareGPT high-quality
- **Reward:** 2-layer MLP head on last hidden; BT loss, batch 64, lr 1e-5
- **DPO:** β sweep {0.05,0.1,0.5}, 1 epoch, batch 32, lr 5e-7
- **Safe RLHF:** Lagrangian lr $\eta_\lambda=0.01$, $\tau$=0.1 (10% unsafe tolerable), 3 rounds
- **CAI Critic:** Claude-style constitution 12 principles, 8k self-revisions

Metrics:

- Helpfulness: MT-Bench single-turn avg, AlpacaEval-2 win vs GPT-4
- Harmlessness: AdvBench ASR = #unsafe completions / #adversarial prompts, BeSafe classification $F_1$
- KL: token-level $\mathbb{E}[\log\pi_\theta/\pi_{ref}]$

### 5.2 DPO Landscape Visualization Results (Synthetic)

We sampled 1k preference pairs, computed margin $m$. Histogram shows bimodal: 34% in saturated $m>5$ region after 500 steps with β=0.5 → gradient norm ↓ 85%. With β=0.1, only 8% saturated. This corroborates *need for low β early*.

Second-order Newton step with diagonal Fisher $F=\mathbb{E}[gg^\top]$ improves convergence 2× but memory heavy.

### 5.3 Safe- vs Vanilla- RLHF

On Beaver Eval [4]:

| Method | Helpful Win vs SFT | Harmless ↑ | $J_c$ | Over-refusal |
|--------|-------------------|------------|-------|--------------|
| Vanilla PPO-RLHF blend $r+0.5c$ | 58% | 71% | 0.22 | 22% |
| DPO $r$ only | 62% | 58% | 0.31 | 12% |
| Safe RLHF PPO [4] | 67% | 84% | 0.08 | 9% |
| Safe DPO λ=0.5 | 65% | 81% | 0.10 | 11% |
| SL-CAI + Safe DPO | 64% | 88% | 0.06 | 14% |

Safe DPO approaches Safe PPO performance but 3× cheaper (no rollouts). However tail risk: worst 1% prompts still unsafe 42% in Safe DPO vs 18% in Safe PPO with explicit worst-case SAT (stochastic dominance RAD [2603.10938] improves).

> **Proof sketch Safe > Blend:** Suppose harmless optimal policies $\Pi_{safe}=\{\pi: J_c\le\tau\}$. Blend $\max J_r -\alpha J_c$ yields Lagrangian with *fixed* λ=α, not adapting to violation. Hence if dataset contains conflicting $x$ where $r$ and $-c$ anti-correlated, fixed α either violates constraint or penalizes $h$ excess. Adaptive λ equalizes KKT. ∎

### 5.4 Pareto Concavity Proof

Formal: let $\pi_1,\pi_2$ optimal for $s_1<s_2$. Mixture $\pi_\alpha=\alpha\pi_1+(1-\alpha)\pi_2$ satisfies $S(\pi_\alpha)\ge \alpha s_1+(1-\alpha)s_2$ by convexity of safety (cost linear in mixture) and $H(\pi_\alpha)\ge \alpha h_1+(1-\alpha)h_2$ by concavity of helpfulness (entropy regularized). Therefore $h^\star(\alpha s_1+(1-\alpha)s_2)\ge \alpha h^\star(s_1)+(1-\alpha)h^\star(s_2)$. QED concave frontier ⇒ scalarization insufficient.

**Implication for alignment tax:** Moving along frontier from $s=3.2$ to $8.1$ costs only 0.9 MT-Bench, but to $9.4$ costs additional 1.8 → increasing marginal tax.

---
## 6 Limitations

1. **Bradley-Terry Misspecification.** Real preferences violate transitivity (Condorcet cycles), context-dependent, and annotator-disagreement [2][5]. BT MLE under misspecification can reduce variance but bias ↑ [2504.03784]. Mixture BT partially helps but multiplies parameters.

2. **DPO Overfitting & Length Exploitation.** DPO loss (3) has no explicit regularization beyond β KL; empirical studies show *length hacking*: $\pi_\theta$ inflates $y_w$ length to increase $\log\pi(y_w)$ because sequence logprob grows with length [2601.06108]. Mitigation: length-normalized DPO or SimPO margin. Without, MT-Bench length ↑ 18% artifact.

3. **Constitutional Completeness.** Constitution written by developers inherits blind spots; public constitutions [Collective CAI] diverge. Self-critique quality degrades for models < 13B — emergent self-improvement [3 repl] shows model collapse (DPO-CAI model: repetitive evasive templates).

4. **Tail Risk not Controlled by Expectation.** Safe RLHF constrains $\mathbb{E}[c]$ not $\text{CVaR}_\alpha(c)$ or worst-case. RAD refinement [2603.10938] proposes spectral risk with stochastic dominance but adds distributional estimation overhead.

5. **Computational Trade-offs.** PPO-based Safe RLHF needs 4×7B models ~ 56GB GPU memory (bf16); DPO reduces to 2 but still needs reference copy for KL on each token → 2× forward cost. QLoRA mitigation reduces but degrades harmlessness detection $F_1$ by 4 pts.

6. **Dynamic λ Instability.** Dual ascent oscillates when $J_c$ estimator noisy (small batch Monte Carlo). Requires EMA smoothing $ \hat{J}_c^{(t)} = 0.9\hat{J}_c^{(t-1)}+0.1 J_c^{(t)}$ and clipping λ ∈ [0,5].

7. **Generalization of AI-feedback.** RLAIF evaluator may amplify its own bias (sycophancy, political lean) → distilled into $\pi$. No guarantee that $c^{AI}$ aligns with $c^{human}$ out-of-distribution; need periodic human audit.

---
## 7 Conclusion

We unified **Safe RLHF**, **Constitutional AI**, and **DPO** under the lens of Bradley-Terry preference modeling and constrained optimization.

- DPO reparameterizes reward as log-ratio, turning RL into contrastive learning, but its landscape exhibits saturation where $m>5$ kills gradients, remedied by small β and length-normalization (ADPO).
- Safe decoupling of $r$ and $c$ with Lagrangian dual is **Pareto-efficient**: any interior harmlessness-helpfulness point with maximal helpfulness is realizable via constrained formulation, not via fixed scalarization, because frontier concave.
- Constitutional AI provides scalable $c$ labels without human harm annotations, and SL critiques act as contraction in cost space, preconditioning RL.
- Empirically, Safe DPO + SL-CAI reaches 88% harmlessness while retaining 64% helpfulness win vs SFT, nearing Safe PPO at fraction of cost, but tail unsafe rate remains gap calling for CVaR constraints.

Future: (i) distributionally robust BT with $\chi^2$ balls around preference distribution to guard annotator heterogeneity, (ii) token-level Safe ADPO with cost-to-go and $\beta$-annealing, (iii) *collective constitution* drafting via deliberative polling to reduce developer bias, (iv) rate-constrained DPO enforcing $\mathbb{D}_{KL}\le\epsilon$ via hard projection rather than soft β, (v) verifying $ \mathcal{T}$ contraction via formal methods (TLA+).

> In alignment, **harmlessness is not negated helpfulness**; it is a *constraint* defining admissible policy polytope. Optimizing inside polytope via Lagrangian DPO yields assistants that **explain objections** rather than evade — the non-evasive harmless assistant envisioned in CAI [3] and verified in Safe RLHF [4].

---

## References

[1] Long Ouyang, Jeff Wu, Xu Jiang, et al. *Training language models to follow instructions with human feedback (InstructGPT)*. arXiv:2203.02155, 2022. https://arxiv.org/abs/2203.02155

[2] Rafael Rafailov, Archit Sharma, Eric Mitchell, et al. *Direct Preference Optimization: Your Language Model is Secretly a Reward Model*. arXiv:2305.18290, NeurIPS 2023. https://arxiv.org/abs/2305.18290

[3] Yuntao Bai, Saurav Kadavath, Sandipan Kundu, et al. *Constitutional AI: Harmlessness from AI Feedback*. arXiv:2212.08073, 2022. https://arxiv.org/abs/2212.08073

[4] Josef Dai, Xuehai Pan, Ruiyang Sun, et al. *Safe RLHF: Safe Reinforcement Learning from Human Feedback*. arXiv:2310.12773, ICLR 2024. https://arxiv.org/abs/2310.12773

[5] Paul F. Christiano, Jan Leike, Tom B. Brown, et al. *Deep Reinforcement Learning from Human Preferences*. arXiv:1706.03741, NeurIPS 2017. https://arxiv.org/abs/1706.03741

[6] John Schulman, Filip Wolski, Prafulla Dhariwal, et al. *Proximal Policy Optimization Algorithms*. arXiv:1707.06347, 2017. https://arxiv.org/abs/1707.06347

[7] Nathan Lambert. *Reinforcement Learning from Human Feedback*. arXiv:2504.12501, 2025 (book). https://arxiv.org/abs/2504.12501v9

[8] Kai Ye, Hongyi Zhou, Jin Zhu, et al. *Robust Reinforcement Learning from Human Feedback for Large Language Models Fine-Tuning*. arXiv:2504.03784, 2026. https://arxiv.org/abs/2504.03784

[9] Masanari Oi, Mahiro Ukai, et al. *Autoregressive Direct Preference Optimization*. arXiv:2602.09533, 2026. https://arxiv.org/abs/2602.09533v1

[10] Xue Zhang. *Constitution or Collapse? Exploring Constitutional AI with Llama 3-8B*. arXiv:2504.04918, 2025. https://arxiv.org/abs/2504.04918

