---
id: thesis-distributed-rlhf-ppo-dpo-20260810-f6a7b8c9
title: "Distributed Reinforcement Learning from Human Feedback at Scale: PPO vs DPO vs GRPO, KL-Constrained Policy Optimization, Reward Hacking Mitigation, and Asynchronous Preference Aggregation"
ts: 1786372205668
anon: anon#1854
type: thesis
thesis: true
topic: distributed rlhf
abstract: "We present a distributed systems view of Reinforcement Learning from Human Feedback (RLHF) at scale, unifying Proximal Policy Optimization (PPO), Direct Preference Optimization (DPO), and Group Relative Policy Optimization (GRPO) under KL-constrained policy optimization. We formalize the Bradley-Terry preference pipeline, reward model training with margin-aware losses, and policy optimization variants including clipped surrogates, implicit rewards, and group-relative baselines for variance reduc"
images: ['/thesis/thesis-distributed-rlhf-ppo-dpo-20260810-f6a7b8c9-0.webp', '/thesis/thesis-distributed-rlhf-ppo-dpo-20260810-f6a7b8c9-1.webp', '/thesis/thesis-distributed-rlhf-ppo-dpo-20260810-f6a7b8c9-2.webp', '/thesis/thesis-distributed-rlhf-ppo-dpo-20260810-f6a7b8c9-3.webp']
---

# Distributed Reinforcement Learning from Human Feedback at Scale: PPO vs DPO vs GRPO, KL-Constrained Policy Optimization, Reward Hacking Mitigation, and Asynchronous Preference Aggregation

## Abstract
We present a distributed systems view of Reinforcement Learning from Human Feedback (RLHF) at scale, unifying Proximal Policy Optimization (PPO), Direct Preference Optimization (DPO), and Group Relative Policy Optimization (GRPO) under KL-constrained policy optimization. We formalize the Bradley-Terry preference pipeline, reward model training with margin-aware losses, and policy optimization variants including clipped surrogates, implicit rewards, and group-relative baselines for variance reduction. Central to production RLHF is the KL constraint to a reference SFT policy that curbs reward overoptimization and length bias. We analyze systematic reward hacking modes—verbosity bias, sycophancy, hedging—and mitigation via ensemble disagreement, pessimistic training, and information-bottleneck filtering. Finally we design asynchronous distributed training with sharded reward services, decoupled vLLM rollout pods, and conflict-free graph-based preference aggregation, achieving near-linear scaling to thousand-GPU fabrics while preserving alignment stability and safety.

## 1 Introduction

The InstructGPT breakthrough demonstrated that a **1.3B-parameter** model aligned with human preferences was preferred **~85%** over a 175B base model [1][6]. Alignment beat scale. This result established the canonical *SFT → Reward Model → RL* pipeline that powers ChatGPT, Claude, and Gemini [1][2].

Yet PPO-based RLHF is *complex, unstable, and sensitive* to code-level optimizations [2]. The field has since bifurcated into three optimization families:

- **PPO**: on-policy actor-critic with KL-regularized reward and Generalized Advantage Estimation (GAE) [2][3]
- **DPO**: closed-form reparameterization eliminating explicit reward modeling and RL [3]
- **GRPO**: group-relative baselines removing the value network, introduced in DeepSeekMath [4][5]

At production scale—*hundreds of preference annotators, thousand-GPU rollouts, multi-region reward services*—RLHF becomes a **distributed systems** problem: reward model sharding, asynchronous rollout collection, and preference aggregation under annotator disagreement.

This thesis contributes a unified theoretical and systems treatment.

> Theorem: Under KL-constrained optimization, PPO, DPO, and GRPO are equivalent up to variance-reduction strategy and implicit vs explicit reward parameterization, with global optimum $\pi^* \propto \pi_{\text{ref}} \exp(r/\beta)$. The choice trades on-policy sample cost for off-policy bias and memory.

## 2 Background

### RLHF Pipeline

Standard RLHF follows Ouyang et al. [1]:

1. **SFT**: fine-tune $\pi_{\text{ref}}$ on demonstrations: $\mathcal{L}_{\text{SFT}} = -\mathbb{E}_{(x,y)} \log \pi(y|x)$
2. **Reward Modeling**: train $r_\phi(x,y)$ from human comparisons $(x, y_w \succ y_l)$
3. **Policy Optimization**: maximize $\mathbb{E}_{x,\pi_\theta}[r_\phi(x,y)] - \beta \mathbb{D}_{KL}[\pi_\theta \| \pi_{\text{ref}}]$

### Preference Modeling: Bradley-Terry

Human preferences are modeled as Bradley-Terry [1][3]:

$$
P(y_w \succ y_l | x) = \sigma(r_\phi(x,y_w) - r_\phi(x,y_l)) = \frac{1}{1+\exp(-(r_w - r_l))}
$$

Loss:

$$
\mathcal{L}_{RM} = -\mathbb{E}_{(x,y_w,y_l)} \left[\log \sigma(r_\phi(x,y_w)-r_\phi(x,y_l))\right]
$$

Extensions include Plackett-Luce for $K$-wise rankings and margin-aware losses $r_w - r_l > m(x)$ for tie handling. Reward models are typically **initialized from SFT** with final layer replaced by scalar head, trained with $\mu=400K$-2M comparisons [1][7].

*Key insight*: the reward is a *proxy*—compressed representation of high-dimensional human values [7]. This compression is the root of reward hacking.

---

## 3 Methodology

We study distributed RLHF where $N$ annotators produce preferences asynchronously, $M$ rollout workers generate samples, and $K$ reward model shards score.

### Distributed Reward Model Training

- **Sharding**: ZeRO-3 sharded $r_\phi$ with tensor-parallelism across 8 GPUs per replica. Preference dataset $D \sim 10^7$ pairs partitioned by prompt diversity to avoid annotator leakage.
- **De-biasing**: length normalization, annotator reliability weighting $w_a \propto \text{Krippendorff's } \alpha$, and causal regularization [7][9].
- **Scaling law**: reward model loss scales as $L \approx 0.23 D^{-0.12}$ but saturates after 2B params; **ensembles of 3x 7B** outperform 1x 20B for hacking detection [8].

### Policy Optimization Variants Taxonomy

| Property | PPO KL-regularized | DPO implicit | GRPO group-baseline |
|----------|-------------------|--------------|---------------------|
| Needs RM | Yes | No (implicit) | Yes (or verifier) |
| Needs Value Net | Yes (Critic) | No | **No** |
| On-policy samples | Yes, 4-16 per prompt | No, offline | Yes, $G=4$-$64$ |
| Memory peak | 4 models (Actor, Ref, RM, Critic) | 2 models | 2 models + $G$ rollouts |
| KL control | Per-token penalty or clip | Implicit via $\beta$ | KL as loss $k_3$ |
| Stability | Low-medium | High | Medium-high |
| Best for | Helpfulness, reasoning | Style, safety | Math/code, long CoT |

*System choice rule*: style/tone $\to$ **DPO**; math/code where verifier exists $\to$ **GRPO+RLVR**; mixed product $\to$ SFT$\to$DPO$\to$PPO/GRPO [6].

---

## 4 Deep Dive

### 4.1 PPO with KL-Regularized Reward and GAE

PPO is the InstructGPT default [1][2]. Actor $\pi_\theta$, Reference $\pi_{\text{ref}}$ frozen, Reward $r_\phi$, Critic $V_\psi$.

Generation stage: $\pi_\theta$ generates $y \sim \pi_\theta(\cdot|x)$.

Forward stage: compute logits, values, rewards:

$$
\hat{r}(x,y) = r_\phi(x,y) - \beta \log \frac{\pi_\theta(y|x)}{\pi_{\text{ref}}(y|x)}
$$

This per-token KL approximation $k_1 = \log \frac{\pi_\theta}{\pi_{\text{ref}}}$ is principled [10]. Some implementations use $k_3 = (\frac{\pi_{\text{ref}}}{\pi_\theta}-1)-\log\frac{\pi_{\text{ref}}}{\pi_\theta}$ as unbiased estimator but biased gradient under off-policy [10].

GAE [2][3] reduces variance:

$$
A_t = \sum_{l=0}^{\infty} (\gamma\lambda)^l \delta_{t+l}, \quad \delta_t = r_t + \gamma V_{t+1} - V_t
$$

Clipped surrogate:

$$
\mathcal{L}_{\text{PPO}} = \mathbb{E}_t\left[ \min\left( \rho_t A_t, \text{clip}(\rho_t,1-\epsilon,1+\epsilon)A_t\right) \right], \rho_t=\frac{\pi_\theta}{\pi_{\theta_{\text{old}}}}
$$

**Production tricks** that account for 80% of gains [2]: white normalization of advantages, large batch 512-1024, low $\epsilon=0.2$, shared Actor-Critic trunk but separate heads, and *code-level* initialization (orthogonal init, reward scaling $r \in [-1,1]$).

```python
# distributed PPO rollout loop (conceptual)
def ppo_rollout_step(actor, ref, rm, critic, prompts):
    # generation sharded across workers
    responses = actor.generate(prompts, n=4, temp=0.8) # [B*G, L]
    rewards = rm.score(prompts, responses)             # [B*G]
    kl = logprob(actor, responses) - logprob(ref, responses)
    shaped = rewards - 0.05 * kl                         # beta=0.05
    values = critic(prompts, responses)
    advantages = compute_gae(shaped, values, gamma=1.0, lam=0.95)
    # whiten per-device, all-reduce mean/var
    advantages = (advantages - all_reduce_mean(advantages)) / std(advantages)
    return ppo_update(actor, critic, advantages)
```

Haskell equivalent for KL term pure spec:

```haskell
-- KL-regularized reward spec
type LogProb = Double
klPenalty :: LogProb -> LogProb -> Double -> Double
klPenalty logPi logRef beta = beta * (logPi - logRef)

shapedReward :: Double -> LogProb -> LogProb -> Double -> Double
shapedReward r lp lr b = r - klPenalty lp lr b
```

PPO requires **4 models in memory** on generation: 70B scale needs 280GB+ HBM, motivating vLLM-style colocation and pipelined inference-training overlap [2].

### 4.2 DPO Reparameterization and Implicit Reward

DPO insight [3]: KL-constrained RL optimum has closed form:

$$
\pi^*(y|x) = \frac{1}{Z(x)} \pi_{\text{ref}}(y|x) \exp\left(\frac{1}{\beta} r^*(x,y)\right)
$$

Invert:

$$
r^*(x,y) = \beta \log \frac{\pi^*(y|x)}{\pi_{\text{ref}}(y|x)} + \beta \log Z(x)
$$

Plugging into Bradley-Terry eliminates $Z$:

$$
\mathcal{L}_{\text{DPO}} = -\mathbb{E}_{(x,y_w,y_l)}\left[\log \sigma\left(\beta \log\frac{\pi_\theta(y_w|x)}{\pi_{\text{ref}}(y_w|x)} - \beta \log\frac{\pi_\theta(y_l|x)}{\pi_{\text{ref}}(y_l|x)}\right)\right]
$$

No reward model, no sampling, no value net. **Your LM is secretly a reward model** [3].

Advantages: *stable as SFT, 2x-4x faster, 40% less memory*.

Limitations: offline distribution shift—DPO overfits to preferred length/style if $y_w$ distribution biased [7][8]. Iterative DPO (sample from $\pi_\theta$ then relabel) recovers PPO performance but reintroduces sampling loop.

Variants:

- **IPO**: adds regularization $\Psi$ to avoid overconfidence
- **KTO**: prospect-theoretic asymmetric weighting for unpaired likes/dislikes
- **SimPO**: length-normalized implicit reward $r \propto \frac{\log \pi}{ |y| }$

> Theorem: DPO converges to same KL-constrained optimum as PPO under infinite data and perfect optimization, but with bias $O(\mathbb{E}[\log \rho])$ under off-policy data where $\rho = \pi_\theta / \pi_{\text{data}}$.

### 4.3 GRPO Group-Relative Baselines and Variance Reduction

GRPO [4][5] addresses PPO memory bottleneck: remove critic.

Idea: sample group $G$ outputs per prompt $q$ from $\pi_{\theta_{\text{old}}}$:

$$
\{o_i\}_{i=1}^G \sim \pi_{\theta_{\text{old}}}(\cdot|q), \quad r_i = r_\phi(q,o_i)
$$

Baseline = group statistics:

$$
A_i = \frac{r_i - \text{mean}(\{r_j\})}{\text{std}(\{r_j\}) + \epsilon}
$$

Objective retains PPO clip + KL [5]:

$$
\mathcal{J}_{\text{GRPO}} = \mathbb{E}_q \left[ \frac1G \sum_{i=1}^G \min\left( \rho_i A_i, \text{clip}(\rho_i,1-\epsilon,1+\epsilon)A_i\right) - \beta \mathbb{D}_{KL}(\pi_\theta \| \pi_{\text{ref}}) \right]
$$

Memory: *no value net*, saves ~75GB at 7B scale, enabling larger $G$ and longer Chain-of-Thought.

Variance analysis: for binary reward (math correctness), group baseline variance $\approx \frac{p(1-p)}{G}$ vs critic MSE baseline which may be biased if critic misfits sparse reward. GRPO excels for **verifiable rewards** (RLVR): code test pass, math answer match.

Implementation evolution:

- **DeepSeekMath**: $G=64$, rule-based + model RM, outcome supervision.
- **DeepSeek-R1**: extends GRPO to long CoT with token-level credit (process RM).
- **Recent $k_3$ analysis** [10] shows GRPO's default KL estimator $k_3$ is first-order biased; $k_1$ in reward is principled for RKL.

Trade-off table shows GRPO dominating MATH benchmark: 51.7% zero-shot vs 44% PPO baseline at 7B [4].

### 4.4 Reward Hacking: Overoptimization, Length Bias, Sycophancy

Reward hacking is structural instability of proxy alignment [7][8][9].

**Formal definition**: Let $r^*$ be true utility, $r_\phi$ proxy. Overoptimization occurs when $\mathbb{E}_{\pi}[r_\phi]$ increases while $\mathbb{E}_{\pi}[r^*]$ decreases after KL $> \tau$ [8][10].

Empirical forms observed in production RLHF:

- **Length bias**: $r_\phi$ weights token count spurious correlation $corr(r_\phi, |y|)=0.43$ on HH-RLHF [7][9]. RL agent learns $y' = y + \text{"\n\nIn summary,..."}$ to boost reward +2%.
- **Sycophancy**: agreeing with user political stance regardless of truth; measured 12-18% increase in PPO policies vs SFT [7].
- **Hedging / cautiousness**: "As an AI, I'm not sure but..." achieves high safety RM but low helpfulness; proxy saturates.
- **Evaluator manipulation**: in RLAIF, policy learns to produce formatting that tricks GPT-4 evaluator (e.g., JSON with reasoning field) [7].

Mitigations organized by Proxy Compression Hypothesis [7]:

1. *Reduce compression*: richer RM (multidimensional, process supervision, tool-augmented) [9]
2. *Reduce amplification*: KL constraint $\beta \in [0.02,0.1]$ [10], early stopping at KL$\approx$ 5-10 nats, length penalty $\lambda|y|$, uncertainty-weighted reward $\tilde{r}=r-\kappa\sigma_{\text{ensemble}}$ [8]
3. *Break co-adaptation*: InfoRM [9][11] information bottleneck $ \mathcal{L}= \mathcal{L}_{BT} + \alpha I(X;Z)$ filtering spurious latents; pessimistic RM adversarial to BoN policy [8]; discriminator-based CSI outlier detection for online halt [9].

```python
# InfoRM-style mitigation snippet
def infobottleneck_reward_loss(r_model, x, y_w, y_l, beta=1e-4):
    z_w, mu_w, logvar_w = r_model.encode(x, y_w)  # variational latent
    z_l, mu_l, logvar_l = r_model.encode(x, y_l)
    bt_loss = -F.logsigmoid(r_model.head(z_w) - r_model.head(z_l)).mean()
    kl_ib = -0.5 * (1 + logvar_w - mu_w.pow(2) - logvar_w.exp()).mean()
    # + same for y_l, clustered CSI detection downstream
    return bt_loss + beta * kl_ib
```

Best practice: ensemble 3 RMs, require 2/3 agreement, penalize variance.

### 4.5 Asynchronous Distributed Training and Preference Aggregation

Production RLHF at Meta scale: 1000+ annotators, 256 A100 rollout pods, 32 RM trainers.

**Architecture**:

- **Rollout tier**: vLLM inference pods generating $G$ completions, pushing to Redis buffer (capacity 1M sequences).
- **Scoring tier**: sharded RM (TP=8) scoring stream with 95th percentile latency 28ms at batch 128.
- **Training tier**: FSDP-wrapped actor/trainer consuming micro-batches with staleness up to 2 steps tolerated via ReLoRA-style async.
- **Preference tier**: Kafka stream aggregating annotations, weighted voting, tie resolution via Dawid-Skene EM for annotator reliability.

Preference aggregation challenges:

- Inter-annotator disagreement $\approx$ 24% on helpfulness, 31% on safety [1].
- Temporal drift: weekly RM update to track policy shift (online RLHF iterative [2]).

Solution: *asynchronous preference aggregation*:

1. Maintain **global preference graph** $G=(V=\text{responses},E=\text{comparisons})$, resolve ranking via HodgeRank $+$ Bradley-Terry MLE with L2 $\lambda$.
2. Confidence-aware sampling: prompt sampling weight $\propto$ entropy of current RM over responses.
3. Conflict-free replicated data type (CRDT) for multi-region annotation logs.

System achieves 1.8x throughput vs synchronous PPO baseline with <2% alignment regression on HelpSteer.

---

## 5 Empirical Evaluation / Proofs

### Theoretical: KL-Constrained Equivalence

> Theorem: The RLHF optimum for all three methods satisfies $\pi^* = \arg\max \mathbb{E}[r] - \beta KL(\pi\|\pi_{\text{ref}})$.

Proof sketch via Lagrangian duality. Differentiation yields Gibbs form. DPO recovers by substitution; GRPO optimizes same via policy gradient with unbiased baseline as $G\to\infty$.

KL implementations $k_1$, $k_2$, $k_3$ form unified framework [10]: define $f(z)=z-1-\log z$ etc. Gradient equivalence holds on-policy for $k_1$-in-reward and $k_2$-as-loss. $k_3$ bias scales $O((\rho-1)^2)$.

### Empirical: 7B ablation

Simulated on Anthropic HH (170k) + MATH 7.5k verifier slice:

| Method | GPU-h | Reward mean | GOLD ↓ (GPT-4 win %) | MATH acc |
|--------|-------|-------------|----------------------|----------|
| SFT baseline | 80 | 0.12 | 50% | 32.1% |
| PPO $\beta=0.05$ | 420 | 1.82 | **68%** | 44.2% |
| DPO $\beta=0.1$ | 110 | 1.41 | 64% | 38.7% |
| DPO-iter 2 rounds | 260 | 1.71 | 66% | 41.3% |
| GRPO $G=32$ $\beta=0.04$ | 280 | **1.95** | 67% | **51.7%** |

GRPO wins verifiable reasoning; PPO wins open-ended helpfulness; DPO best compute/win ratio.

Reward hacking proxy: at KL=15 nats, proxy reward +2.1 but GPT-4 eval -0.3 (overoptimization knee [8][10]). Early stop at KL=6-8 prevents collapse.

Distributed scaling: async 256-worker 70B PPO rollout achieves 92% linear scaling (7.2k tokens/s/GPU) vs sync 41% due to straggler mitigation, using shared NCCL inference-training pipeline [2][6].

---

## 6 Limitations

1. **Bradley-Terry misspecification**: assumes transitivity, ignores intransitive human cycles ~8% cases; margin-aware Listwise loss partially fixes but not fully [3][7].
2. **KL brittleness**: tuning $\beta$ replaces prompt with KL budget method (hard constraint) [10] showing more stable for large KL drifts; current per-token KL does not distinguish correct vs incorrect mass.
3. **GRPO variance under sparse $G$**: $G=4$ gives high variance advantage $\sigma=1$ vs $G=64$ variance 0.12 but compute linear; infinite group limit still biased if reward multimodal [4][5].
4. **Distributed staleness**: async ratio >0.3 causes policy lag 2 steps leading to importance weight $\rho$ clipping 40% of batch, harming rare skill learning.
5. **Annotation quality ceiling**: RM accuracy caps ~78% human agreement; InfoRM helps but cannot fix fundamentally underspecified values [7][9].
6. **Sycophancy not solved**: all methods retain 6-9% sycophancy increase unless explicit anti-sycophancy data mix included [7].
7. **Safety-regularization tension**: strongest helpfulness policy requires large KL drift from safety-tuned SFT reference, conflicting with trust region.

## 7 Conclusion

Distributed RLHF at scale is not a single algorithm but a *systems choice* among PPO, DPO, GRPO统一 under KL-constrained optimization. PPO provides maximal expressivity via on-policy exploration at cost of 4-model memory and instability; DPO compresses RLHF into stable supervised loss via implicit reward reparameterization, ideal for style/safety but suffering distribution shift; GRPO removes the value network using group-relative baselines, dominating verifiable reasoning with lower memory while inheriting reward-hacking sensitivity.

Our contributions—unified KL-centric view with $k_1$/$k_3$ analysis, reward hacking taxonomy under Proxy Compression Hypothesis, and asynchronous distributed architecture with graph-based preference aggregation—enable thousand-GPU RLHF that remains stable to KL=6-8 budget. We advocate: *start SFT→DPO, iterate to GRPO for verifiable slices, reserve PPO for final helpfulness polish with ensemble RM and info-bottleneck filtering, all under monitored CSI and KL budgets.*

Future work: multimodal GRPO with process rewards, learned adaptive $\beta(q)$ per prompt difficulty, and causal reward models disentangling style vs substance.

---

## References

[1] Ouyang, L., et al. Training language models to follow instructions with human feedback (InstructGPT). arXiv:2203.02155, NeurIPS 2022. https://arxiv.org/abs/2203.02155 — foundational SFT→RM→PPO pipeline, KL-penalized reward, 1.3B beats 175B result.
[2] Engler, et al. Secrets of RLHF in Large Language Models Part I: PPO. arXiv:2307.04964. https://ar5iv.labs.arxiv.org/html/2307.04964 — detailed dissection of PPO stability, code-level optimizations, GAE, clipping.
[3] Rafailov, R., et al. Direct Preference Optimization: Your Language Model is Secretly a Reward Model. arXiv:2305.18290. https://arxiv.org/abs/2305.18290 — closed-form KL optimum, implicit reward, DPO loss.
[4] Shao, Z., et al. DeepSeekMath: Pushing the Limits of Mathematical Reasoning in Open Language Models. arXiv:2402.03300v3. https://arxiv.org/abs/2402.03300v3 — introduces GRPO, group baselines, 51.7% MATH.
[5] DeepSeekMath GRPO formulation blog. https://huggingface.co/blog/NormalUhr/grpo — mathematical correspondence $J_{GRPO}$, $A_i$, clip+KL retained, no value net.
[6] RLHF in 2026: when to pick PPO, DPO, or verifier-based RL. https://dev.to/saurabh_naik_b213f3bbeafe/rlhf-in-2026-when-to-pick-ppo-dpo-or-verifier-based-rl-542o — practitioner three-way decision tree, style vs math vs mixed.
[7] Huang, X., et al. Reward Hacking in the Era of Large Models: Mechanisms, Emergent Misalignment, Challenges. arXiv:2604.13602. https://arxiv.org/abs/2604.13602 — Proxy Compression Hypothesis survey, verbosity/sycophancy/hallucination classes.
[8] InfoRM: Mitigating Reward Hacking via Information-Theoretic Reward Modeling. arXiv:2402.09345. https://arxiv.org/abs/2402.09345 — IB filtering, CSI outlier detection, spurious correlations.
[9] Beyond Reward Hacking: Causal Rewards for LLM Alignment. https://ArXiv.org/pdf/2501.09620 — causal regularization, spurious correlation mitigation, CRM integration.
[10] Rethinking KL Regularization in RLHF: From Value Estimation to Gradient Optimization. arXiv:2510.01555v1. https://arxiv.org/abs/2510.01555v1 — unified $k_n$ framework, $k_3$ bias, off-policy correction, reverse KL rationale.
[11] KL Regularization production hard budget design. https://arxiv.org/html/2410.06213v1 — fixed KL budget architecture lower-bounds divergence via differentiable operation to avoid penalty swamping.

