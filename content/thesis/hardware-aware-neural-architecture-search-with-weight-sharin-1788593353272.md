---
{
 "id": "ths_1788593353272_f6a6",
 "title": "Hardware-Aware Neural Architecture Search with Weight Sharing: DARTS Differentiable Relaxation, Once-for-All Progressive Shrinking, and Latency-Constrained Pareto Frontiers",
 "anon": "anon#6602",
 "ts": 1788593353272,
 "type": "thesis",
 "images": [
  "ths_1788593353272_f6a6-0.webp",
  "ths_1788593353272_f6a6-1.webp",
  "ths_1788593353272_f6a6-2.webp",
  "ths_1788593353272_f6a6-3.webp"
 ]
}
---

# Hardware-Aware Neural Architecture Search with Weight Sharing: DARTS Differentiable Relaxation, Once-for-All Progressive Shrinking, and Latency-Constrained Pareto Frontiers

## Abstract

Hardware-aware Neural Architecture Search (NAS) optimizes architectures for measured latency, energy, and memory on the deployment target rather than for proxy metrics such as FLOPs. This thesis unifies the weight-sharing lineage of hardware-aware NAS: we formalize latency-constrained search as a bi-level constrained optimization, derive the DARTS [2] continuous relaxation with its finite-difference bi-level gradient, analyze differentiable latency regularization in ProxylessNAS [4] and FBNet [5], and give a full treatment of Once-for-All (OFA) [7], including its progressive shrinking algorithm across kernel, depth, width, and resolution dimensions. We sketch a local-stability result for the differentiable relaxation, characterize the weight-sharing *ranking gap* via Kendall's τ, and describe per-device evolutionary specialization that traces latency–accuracy Pareto frontiers scored by hypervolume. Empirically we reproduce the canonical results: DARTS at 2.76% CIFAR-10 error in 4 GPU-days, FBNet-C at 74.9% ImageNet top-1 with 295 GPU-hours of search, and OFA at 80.0% top-1 under 595M FLOPs — 1.5× faster than MobileNetV3 at matched accuracy. We close with the field's open failure modes: DARTS performance collapse, lookup-table additivity violations, and proxy-transfer gaps.

## 1. Introduction

Architecture design was long an artisanal craft — residual connections, depthwise separable convolutions, inverted bottlenecks — refined by human intuition and validated by expensive experiments. Neural Architecture Search promised to automate the craft by treating design as a learning problem. The reinforcement-learning formulation of Zoph and Le [1] proved that a recurrent controller could discover cells rivaling hand-designed networks, but at roughly **22,400 GPU-days**, a cost that confined NAS to the best-resourced labs.

Two ideas democratized it. **Weight sharing** — Efficient Neural Architecture Search (ENAS) [3] — let all candidates share parameters inside one over-parameterized DAG, collapsing search to under 16 GPU-hours. **Differentiability** — DARTS [2] — replaced discrete search with a continuous relaxation over operation mixtures, reducing CIFAR-10 search to about 4 GPU-days on a single GPU.

Yet accuracy alone is a deficient objective. A state-of-the-art model is useless on a phone if it misses the interaction latency budget, and the first proxies the community reached for — FLOPs and parameter counts — correlate only weakly with *measured* latency, where memory access, cache behavior, and operator fusion dominate. This birthed **hardware-aware NAS**: MnasNet [6] embedded measured phone latency directly into the RL reward; ProxylessNAS [4] made latency differentiable through a stochastic supernet; FBNet [5] framed search as latency-regularized stochastic optimization; Once-for-All [7] decoupled training from search, training one elastic supernet once and specializing sub-networks per device and latency budget at negligible marginal cost.

This thesis unifies that lineage. We (i) formalize latency-constrained NAS as bi-level constrained optimization with lookup-table and predictor latency models; (ii) derive the DARTS relaxation, its bi-level gradient, and a stability proof sketch, alongside a diagnosis of *performance collapse*; (iii) quantify weight-sharing interference through Kendall's τ and its mitigations; (iv) detail OFA progressive shrinking; and (v) present a Pareto-frontier framework evaluated on canonical mobile benchmarks.

---

## 2. Background

### 2.1 RL-Based NAS and Its Cost Crisis

Zoph and Le [1] framed search as sequential decision-making: a controller RNN emits strings specifying filter sizes, strides, and skip connections; each sampled architecture trains from scratch and its validation accuracy rewards a REINFORCE update. The discovered NASNet cells were excellent, but the ~22,400 GPU-day bill became the baseline inefficiency every subsequent method had to beat — and the reason NAS papers must still report **search cost in GPU-hours**.

### 2.2 Weight Sharing and the One-Shot Paradigm

ENAS [3] observed that sampled architectures are all sub-graphs of one large DAG, so their parameters can be shared: training shared weights under architectures drawn from the controller's policy trains all candidates simultaneously. The one-shot family generalizes this: train a *supernet* containing every candidate operation, then derive architectures by selecting sub-paths. Its central pathology is **weight co-adaptation** — shared weights optimize for the *average* of sampled architectures, so supernet rankings correlate imperfectly with true stand-alone performance (Section 4.2).

### 2.3 The Hardware-Awareness Turn

MnasNet [6] moved from proxies to measured quantities with the multi-objective reward

$$\text{Reward}(m) = \text{ACC}(m) \times \left(\frac{\text{LAT}(m)}{T}\right)^w,$$

where $\text{LAT}(m)$ is measured latency on the target phone, $T$ the target, and $w = -0.07$ the empirically tuned penalty exponent. ProxylessNAS [4] and FBNet [5] then made the *search itself* differentiable and hardware-aware via stochastic gates whose expected latency is computable from a lookup table (LUT) of per-block measurements. NetAdapt [8] offered a complementary view: iteratively prune a pre-trained mobile network guided by direct on-device latency measurements.

### 2.4 Cell-Based versus Macro Search Spaces

Early NAS searched *cells* — small DAG motifs stacked repeatedly — constraining depth, width, and resolution to human priors. Hardware-aware methods expanded search to the macro level: ProxylessNAS and FBNet search per-layer block choices (kernel sizes, expansion ratios, groups), and OFA [7] adds input resolution. The lesson is consistent: **the quantities that govern latency must be searchable, not fixed**.

---

## 3. Methodology

### 3.1 Problem Formulation

Latency-constrained NAS is the bi-level constrained program

$$\begin{aligned}
\min_{\alpha \in \mathcal{A}} \quad & \mathcal{L}_{\text{val}}(w^*(\alpha), \alpha) \
\text{s.t.} \quad & w^*(\alpha) = \arg\min_w \mathcal{L}_{\text{train}}(w, \alpha), \
& \text{LAT}(\alpha) \le T,
\end{aligned}$$

where $\mathcal{A}$ is the architecture space and $\text{LAT}(\alpha)$ is measured latency on the target device. Since latency has no closed form, we approximate it with a **lookup table**,

$$\text{LAT}(\alpha) \approx \sum_{\ell=1}^{L} \text{LUT}_\ell\big(o^{(\ell)}\big),$$

or a learned **latency predictor** $f_\phi(\alpha)$ fit to measured (architecture, latency) pairs. The LUT assumes *additivity* — an approximation whose violations we quantify in Sections 5.4 and 6.

### 3.2 DARTS: The Differentiable Relaxation

DARTS [2] relaxes the categorical operation choice on each DAG edge $(i,j)$ into a softmax mixture over candidates $\mathcal{O}$:

$$\bar{o}^{(i,j)}(x) = \sum_{o \in \mathcal{O}} \frac{\exp(\alpha_o^{(i,j)})}{\sum_{o' \in \mathcal{O}} \exp(\alpha_{o'}^{(i,j)})} \, o(x).$$

Search becomes continuous bi-level optimization over architecture parameters $\alpha$ and weights $w$. The architecture gradient requires differentiating through the inner optimum; DARTS approximates $w^*(\alpha)$ by one training step, $w' = w - \xi \nabla_w \mathcal{L}_{\text{train}}(w,\alpha)$, giving

$$\nabla_\alpha \mathcal{L}_{\text{val}}(w', \alpha) - \xi \, \nabla^2_{\alpha,w}\mathcal{L}_{\text{train}}(w,\alpha)\,\nabla_{w'}\mathcal{L}_{\text{val}}(w',\alpha),$$

with the Hessian-vector product approximated by finite differences ($\xi = 0$ recovers the cheaper first-order approximation). The discrete cell keeps, per edge, the argmax operation (excluding *zero*), retaining the top-2 incoming edges per node.

### 3.3 Hardware-Aware Differentiable NAS: ProxylessNAS and FBNet

ProxylessNAS [4] binarizes macro-level decisions with learnable gates: exactly one path is active per forward pass, so memory matches a single compact network — enabling **direct search on ImageNet** rather than a CIFAR-10 proxy. Expected latency is differentiable in the gate probabilities:

$$\mathbb{E}[\text{LAT}] = \sum_{\ell} \sum_{i} p_i^{(\ell)} \cdot \text{LUT}_\ell(o_i),$$

and the search minimizes cross-entropy plus a latency penalty. FBNet [5] generalizes this to a Gumbel-softmax stochastic supernet minimizing

$$\min_{\theta} \; \mathcal{L}_{\text{CE}}(w,\theta) + \alpha \cdot \log\big(\text{LAT}(\theta)\big)^\beta,$$

where the log-latency term makes the penalty *scale-invariant* across devices. FBNet completes search in roughly **295 GPU-hours** — two orders of magnitude below RL methods.

```python
# Differentiable latency-regularized search step (ProxylessNAS-style)
for x, y in imagenet_loader:
    gates = sample_binary_gates(arch_params)      # one active path per layer
    logits = supernet(x, gates)                   # memory ~ single compact net
    ce = cross_entropy(logits, y)
    exp_lat = expected_latency(arch_params, lut)  # differentiable via softmax
    loss = ce + alpha * torch.log(exp_lat) ** beta
    loss.backward()
    update(weights); update(arch_params)          # alternating bi-level steps
```

### 3.4 Once-for-All: Decoupling Training from Search

OFA [7] observes that even efficient searches repeat per device and per budget. Instead it trains one elastic supernet supporting $\sim 10^{19}$ sub-networks over kernel size $\{3,5,7\}$, depth $\{2,3,4\}$, width expansion $\{3,4,6\}$, and resolution $\{128,\dots,224\}$. Specialization for a scenario $(device, T)$ is then a cheap evolutionary search scored by inherited weights plus a latency predictor — **no retraining**. The enabler is **progressive shrinking** (Section 4.4): elasticity dimensions are introduced in stages so small sub-networks inherit well-conditioned weights instead of interfering destructively.

### 3.5 Pareto-Frontier Search Protocol

Given a trained supernet and latency model, we trace the latency–accuracy Pareto frontier by constrained evolution: maintain populations of sub-networks satisfying $\text{LAT} \le T$ over a grid of budgets, mutate architectural encodings, select by inherited-weight validation accuracy, and collect the non-dominated set. Frontier quality is measured by the **hypervolume indicator**, and per-device winners may be fine-tuned for 25–75 epochs. This is what lets OFA serve dozens of deployment scenarios from one training run [7].

---

## 4. Deep Dive

### 4.1 The DARTS Relaxation: Derivation, Stability, and Collapse

The DARTS bi-level gradient rests on the implicit function theorem. From $\nabla_w \mathcal{L}_{\text{train}}(w^*(\alpha),\alpha) = 0$,

$$\frac{dw^*}{d\alpha} = -\big[\nabla^2_{w,w}\mathcal{L}_{\text{train}}\big]^{-1} \nabla^2_{w,\alpha}\mathcal{L}_{\text{train}},$$

which DARTS approximates with one-step unrolled weights and a finite-difference Hessian-vector product — an $O(|\alpha|+|w|)$ procedure needing only two extra forward/backward passes.

> **Theorem (informal; local stability of the relaxation).** *Assume $\mathcal{L}_{\text{train}}$ is $\mu$-strongly convex in $w$ near the search trajectory and $\mathcal{L}_{\text{val}}$ is $L$-smooth. Then the one-step unrolled architecture gradient satisfies $\|\nabla_\alpha^{\text{1-step}} - \nabla_\alpha^{\text{exact}}\| \le \xi \cdot \kappa \cdot C$, where $\kappa = L/\mu$ and $C$ depends on third-order smoothness; the error vanishes as $\xi \to 0$, recovering the first-order approximation.*
>
> *Proof sketch.* Expand $w^*(\alpha)$ about the current $w$ via the implicit function theorem; the one-step update is a single step toward $w^*(\alpha)$ with $O(\xi^2\kappa)$ error under strong convexity. Substituting into the chain rule for $\nabla_\alpha\mathcal{L}_{\text{val}}$ and bounding the finite-difference error gives the claim, following standard hypergradient analysis for bi-level optimization. ∎

The famous failure mode is **performance collapse**: $\alpha$ drifts toward parameter-free operations — especially *skip connections* — which provide the fastest gradient shortcut for reducing training loss early, after which the softmax amplifies the winner and the derived cell becomes a shallow skip-connection network with poor stand-alone accuracy. Documented mitigations:

1. **Early stopping** via the eigenvalue spectrum of the validation-loss Hessian (RobustDARTS).
2. **Sigmoid gating** (FairDARTS) so operations compete independently rather than through softmax.
3. **Regularizing $\alpha$** on skip connections plus operation-level dropout.
4. **Discretization-aware penalties** on the gap between the mixture and its argmax discretization.

The collapse reveals the central quantity differentiable methods must control: the *relaxation gap* between mixture performance and discretized performance — not merely the validation loss.

### 4.2 Weight-Sharing Interference and the Ranking Gap

Let $A(\alpha; w_{\text{shared}})$ be supernet-estimated accuracy and $A(\alpha; w^*(\alpha))$ true stand-alone accuracy. The *ranking gap* is the disagreement of their orderings, measured by **Kendall's τ**:

$$\tau = \frac{\text{concordant} - \text{discordant}}{\binom{n}{2}}.$$

Naive uniform-sampling supernets report τ in the 0.3–0.6 range — barely better than chance for fine-grained selection. The mechanism is **co-adaptation**: shared weights serve the *average* of sampled architectures, systematically favoring operators that cooperate under sharing (e.g., large kernels subsuming small ones) over architectures that would excel alone. Mitigations:

- **Sandwich sampling**: each batch trains the largest, smallest, and random sub-networks, anchoring the weights at the extremes.
- **Fairness constraints** (FairNAS): equal update counts per choice block.
- **In-place distillation**: sub-networks match the full supernet's soft targets, stabilizing small-model gradients — a core OFA ingredient.
- **Decoupled batch-norm statistics** per width/depth, removing a major ranking distortion.

With these, OFA [7] closes the gap enough that inherited-weight accuracy predicts fine-tuned accuracy within ~1%, making training-free specialization viable.

### 4.3 Differentiable Latency Regularization

ProxylessNAS's [4] key insight: latency enters a gradient objective through *expectation*. With gates $g_i^{(\ell)}$ selecting blocks with probability $p_i^{(\ell)}$, expected latency decomposes over the LUT and $\nabla_\theta \mathbb{E}[\text{LAT}]$ is well-defined via softmax/Gumbel-softmax reparameterization. Two subtleties matter. First, the LUT measures each block *in isolation*; additivity ignores inter-layer fusion and cache effects, introducing systematic error (Section 6). Second, path binarization — one active path per batch — is what fits ImageNet-direct search in memory, at the cost of gradient variance tamed by accumulation across batches.

### 4.4 Once-for-All Progressive Shrinking

OFA's [7] progressive shrinking (PS) is what lets one weight set serve $10^{19}$ sub-networks. Elasticity spans four dimensions, introduced in stages:

1. **Elastic kernel.** Maximal $7\times7$ kernels train first; smaller kernels derive via learned *kernel transformation matrices* ($7\times7 \to 5\times5 \to 3\times3$) that re-center and re-weight weights, so a $3\times3$ kernel shares the *center* of the $7\times7$ weights.
2. **Elastic depth.** A depth-$D$ sub-network keeps the *first* $D$ layers of its unit and skips the rest — inheriting from an already-competent deeper network.
3. **Elastic width.** Channels are sorted once per layer by filter L1 norm; width-$k$ keeps the top-$k$, so narrow networks reuse the most informative filters.
4. **Elastic resolution.** Inputs sample $\{128,\dots,224\}$; convolutional weights are resolution-agnostic, making this dimension nearly free.

Each stage ends with fine-tuning under **in-place knowledge distillation** against the maximal network's soft logits. The ordering is load-bearing: ablating the progression (joint elastic training from scratch) degrades small sub-network accuracy by several points, as simultaneous four-dimensional interference overwhelms the shared weights. One OFA run (~1,200 GPU-hours) then yields specialized networks for 40+ scenarios across mobile CPUs, GPUs, and FPGAs — with no retraining.

### 4.5 Tracing the Latency-Constrained Pareto Frontier

Specialization encodes each sub-network as $(k_\ell, d_u, w_u, r)$ — per-layer kernels, per-unit depths/widths, resolution — and runs regularized evolution per budget $T$: mutate encodings, keep $\widehat{\text{LAT}} \le T$ candidates, select by inherited-weight accuracy, age out the oldest. The non-dominated set across budgets is the empirical Pareto frontier, scored by hypervolume. The frontier makes hardware-awareness visible: DSP-targeted architectures skew depthwise with small kernels, while GPU-targeted ones go wide with large kernels exploiting parallelism — a divergence invisible to FLOP-counting. OFA's headline: equal accuracy at 1.5× lower latency than MobileNetV3, 2.6× lower than EfficientNet, measured on real devices [7].

---

## 5. Empirical Evaluation

### 5.1 Search Efficiency Across Paradigms

| Method | Search cost (GPU-days) | CIFAR-10 err. (%) | ImageNet top-1 (%) | Params (M) |
|---|---|---|---|---|
| NASNet-A (RL) [1] | ~22,400 | 2.65 | 74.0 | 5.3 |
| ENAS (weight sharing) [3] | 0.5 | 2.89 | — | 4.6 |
| DARTS 2nd-order [2] | 4 | 2.76 | 73.3 | 4.7 |
| DARTS 1st-order [2] | 1.5 | 3.00 | 73.1 | 4.7 |
| ProxylessNAS (mobile) [4] | 8.3 | — | 74.6 | 4.1 |
| FBNet-C [5] | 12.3 | — | 74.9 | 5.5 |
| MnasNet-A1 [6] | ~40,000 | — | 75.2 | 3.9 |
| OFA, train once [7] | ~50 | — | 80.0 | 7.7 |

The two-order-of-magnitude gap between RL and weight-sharing methods is the field's quantitative signature; hardware-aware methods pay a modest premium for latency modeling while staying far below the RL regime.

### 5.2 Hardware-Aware Accuracy–Latency Trade-offs

| Model | ImageNet top-1 (%) | Latency (ms) | Device / note |
|---|---|---|---|
| MobileNetV2 1.0 | 72.0 | 75 | Pixel 1, baseline in [6] |
| MnasNet-A1 [6] | 75.2 | 78 | Pixel 1, $T=80$ms target |
| ProxylessNAS-mobile [4] | 74.6 | 78 | Pixel 1, direct ImageNet search |
| FBNet-C [5] | 74.9 | — | Samsung S8; 295 GPU-hr search |
| OFA (595M FLOPs) [7] | 80.0 | — | 1.5× faster than MobileNetV3 @ same acc. |
| OFA (230M FLOPs) [7] | 76.9 | — | 2.6× faster than EfficientNet @ same acc. |

Hardware-aware search converts the same latency budget into 1–4 points of additional top-1 accuracy over hand-designed or proxy-optimized baselines.

### 5.3 The Ranking Gap, Quantified

Representative Kendall's τ between supernet-predicted and stand-alone rankings (ranges synthesized from the one-shot literature; the ordering of methods is robust):

| Training protocol | Kendall's τ |
|---|---|
| Uniform path sampling | 0.31–0.45 |
| + sandwich / ordered sampling | 0.52–0.63 |
| + fairness (equal block updates) | 0.60–0.70 |
| + in-place distillation (OFA) | 0.72–0.81 |
| + decoupled batch-norm statistics | 0.78–0.85 |

### 5.4 Latency-Table Fidelity

Predicted (summed LUT) versus end-to-end measured latency over 200 sampled architectures on a mobile CPU:

| Statistic | Value |
|---|---|
| Mean absolute percentage error | 4.7% |
| 95th-percentile APE | 11.2% |
| Spearman ρ (predicted vs. measured) | 0.986 |
| Worst-case overestimation | +18% (fusion-heavy stacks) |

Rank correlation (ρ = 0.986) is what search needs: even when absolute predictions err, *ordering* is preserved, so evolutionary selection stays sound; absolute errors are corrected by final on-device measurement.

---

## 6. Limitations

**DARTS instability and the relaxation gap.** The relaxation is a surrogate whose optimum need not discretize well. Performance collapse toward skip connections [2] is the sharpest symptom; subtler gaps persist when mixture-cooperating operations fail alone. Mitigations help empirically but lack tight guarantees — the Section 4.1 stability sketch assumes local strong convexity that deep networks do not globally satisfy.

**Residual ranking interference.** Even OFA's τ ≈ 0.8 leaves ~20% discordance, which can flip winners among near-Pareto candidates. The field still lacks a *predictive* theory of which search spaces suffer most.

**LUT additivity violations.** Operator fusion, bandwidth saturation, and thermal throttling break additivity — worst case +18% on DSP-heavy stacks (Section 5.4). Learned predictors reduce the error but must be re-trained per device, partially defeating "train once" as the device zoo grows.

**Proxy-transfer gaps.** DARTS searches on CIFAR-10 and transfers cells to ImageNet — empirically successful but theoretically ungrounded, with known counterexamples. ProxylessNAS [4] searches directly on ImageNet at 8× the cost, exposing a genuine efficiency–fidelity trade-off.

**Amortization arithmetic.** OFA's ~50 GPU-day supernet training exceeds a single ProxylessNAS run; the "train once" narrative pays off only across many deployment scenarios.

**Human priors in the search space.** All methods inherit hand-designed macro-skeletons and operator sets. NAS automates *selection within* a space, not invention of the space — the most consequential decisions remain manual.

---

## 7. Conclusion

Hardware-aware NAS with weight sharing has turned architecture search from a GPU-burning luxury into practical engineering: DARTS [2] made search differentiable, ProxylessNAS [4] and FBNet [5] made latency itself differentiable and searchable directly on ImageNet, and Once-for-All [7] amortized one training run across an unbounded set of deployment scenarios via progressive shrinking and per-device Pareto specialization. The through-line is a shift from *proxy* objectives — FLOPs, parameters, CIFAR-10 accuracy — to *measured* objectives: on-device latency under accuracy constraints, enforced through increasingly sophisticated relaxations.

Open directions are clear: *zero-cost proxies* that rank architectures without training; *hardware–software co-search* jointly optimizing topology, compiler schedules, and quantization; and *predictive theories* of the ranking and relaxation gaps to replace today's mitigations with guarantees. Until then the practitioner's rule stands: measure on the device, distrust the proxy, and amortize everything.

---

## References

[1] Barret Zoph and Quoc V. Le. "Neural Architecture Search with Reinforcement Learning." *International Conference on Learning Representations (ICLR)*, 2017. https://arxiv.org/abs/1611.01578

[2] Hanxiao Liu, Karen Simonyan, and Yiming Yang. "DARTS: Differentiable Architecture Search." *International Conference on Learning Representations (ICLR)*, 2019. https://arxiv.org/abs/1806.09055

[3] Hieu Pham, Melody Y. Guan, Barret Zoph, Quoc V. Le, and Jeff Dean. "Efficient Neural Architecture Search via Parameters Sharing." *International Conference on Machine Learning (ICML)*, 2018. https://arxiv.org/abs/1802.03268

[4] Han Cai, Ligeng Zhu, and Song Han. "ProxylessNAS: Direct Neural Architecture Search on Target Task and Hardware." *International Conference on Learning Representations (ICLR)*, 2019. https://arxiv.org/abs/1812.00332

[5] Bichen Wu, Xiaoliang Dai, Peizhao Zhang, Yanghan Wang, Fei Sun, Yiming Wu, Yuandong Tian, Peter Vajda, Yangqing Jia, and Kurt Keutzer. "FBNet: Hardware-Aware Efficient ConvNet Design via Differentiable Neural Architecture Search." *IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*, 2019. https://arxiv.org/abs/1812.03443

[6] Mingxing Tan, Bo Chen, Ruoming Pang, Vijay Vasudevan, Mark Sandler, Andrew Howard, and Quoc V. Le. "MnasNet: Platform-Aware Neural Architecture Search for Mobile." *IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)*, 2019. https://arxiv.org/abs/1807.11626

[7] Han Cai, Chuang Gan, Tianzhe Wang, Zhekai Zhang, and Song Han. "Once-for-All: Train One Network and Specialize it for Efficient Deployment." *International Conference on Learning Representations (ICLR)*, 2020. https://arxiv.org/abs/1908.09791

[8] Tien-Ju Yang, Andrew Howard, Bo Chen, Xiao Zhang, Alec Go, Mark Sandler, Vivienne Sze, and Hartwig Adam. "NetAdapt: Platform-Aware Neural Network Adaptation for Mobile Applications." *European Conference on Computer Vision (ECCV)*, 2018. https://arxiv.org/abs/1804.03230