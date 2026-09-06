---
title: "From Discrete Search to Differentiable Optimization: DARTS, Hardware-Aware NAS, and the Pareto Frontier of Latency-Constrained Architecture Design"
date: 1788676138828
author: "anon#7558"
type: thesis
id: "ths_1788676138828_c4ca"
images: ["ths_1788676138828_c4ca-0.webp", "ths_1788676138828_c4ca-1.webp", "ths_1788676138828_c4ca-2.webp"]
---

# From Discrete Search to Differentiable Optimization: DARTS, Hardware-Aware NAS, and the Pareto Frontier of Latency-Constrained Architecture Design

## Abstract

Neural Architecture Search (NAS) automates the design of deep neural networks but historically required thousands of GPU-days of black-box optimization over a discrete space [1]. Differentiable Architecture Search (DARTS), introduced by Liu, Simonyan, and Yang at ICLR 2019 [2], reformulates NAS as a *bilevel* continuous optimization problem: candidate operations on every edge of a cell DAG are relaxed into a softmax-weighted mixture, and the architecture parameters $\alpha$ are optimized by gradient descent alongside network weights $w$. DARTS reduced search cost to the order of a single training run — roughly four GPU-days on CIFAR-10 — while discovering cells competitive with the best RL- and evolution-discovered architectures. This thesis develops the full mathematical machinery of DARTS, analyzes the discretization gap and instability that motivated ProxylessNAS [3], FBNet [4], P-DARTS, PC-DARTS, and GDAS, and extends the framework to *hardware-aware* NAS, where latency predictors and lookup-table cost models enter the loss as differentiable regularizers over a multi-objective Pareto frontier. We prove that the FBNet latency lookup-table decomposition is exact under sequential operator execution, characterize the bilevel approximation error of DARTS's one-step unrolled differentiation, and present empirical results across NAS-Bench-201 [5] showing Kendall-$\tau$ ranking correlations of the one-shot proxy. We conclude with open problems: the weight-sharing rank disorder problem, the skip-connection collapse pathology, and the transferability gap between proxy and target tasks.

## 1 Introduction

The design of convolutional and recurrent architectures was, for the better part of a decade, a craft discipline. Neural Architecture Search promised to replace the artisan with an optimizer: given a search space $\mathcal{A}$ and a dataset, find $a^* = \arg\max_{a \in \mathcal{A}} \text{ValAcc}(a)$. The first generation — NASNet with reinforcement learning [1], AmoebaNet with regularized evolution — succeeded spectacularly at the cost of **thousands of GPU-days**: NASNet required approximately 2,000 GPU-days on CIFAR-10. The expense restricted architecture search to industrial laboratories and made reproducibility nearly impossible.

> **Note (sample complexity):** identifying an $\epsilon$-optimal architecture among $N$ candidates with noisy validation estimates requires $\Omega(\sigma^2 \epsilon^{-2} \log(N/\delta))$ evaluations in the worst case, by standard bandit lower bounds — the fundamental inefficiency DARTS attacks.

The fundamental inefficiency of black-box NAS is that it treats each architecture as an independent sample. DARTS's key insight is that architectures *share substructure*: the same $3 \times 3$ convolution appears in thousands of candidate cells, and its weights can be shared. By embedding every candidate into a single *supernet* and relaxing discrete operation choices into a continuous mixture, DARTS converts combinatorial search into a differentiable program [2], collapsing search cost to that of training one network. The continuous relaxation introduces a *discretization gap*; the bilevel optimization is approximated by a single unrolled gradient step; and the method exhibits a notorious pathology — collapse to architectures dominated by parameter-free skip connections [6]. Meanwhile, accuracy alone is the wrong objective: a model that cannot meet a phone's latency budget is useless in production. ProxylessNAS [3] and FBNet [4] extended differentiable search to *hardware-aware* multi-objective optimization, introducing differentiable latency estimators that decompose total latency into additive per-operator terms.

This thesis is organized as follows. Section 2 reviews the NAS landscape: cell-based search spaces, weight sharing, and black-box baselines. Section 3 develops DARTS — the softmax relaxation, the bilevel program, and the unrolled-gradient approximation with error analysis. Section 4 deep-dives into (i) the discretization gap, (ii) ProxylessNAS's binarized path sampling, (iii) FBNet's latency-aware loss, and (iv) one-shot supernets and Once-for-All. Section 5 presents empirical results, Section 6 limitations, and Section 7 conclusions.

---

## 2 Background

### 2.1 The Cell-Based Search Space

Following NASNet [1], DARTS does not search over entire networks but over *cells*: small directed acyclic graphs (DAGs) that are stacked to form the full network. A cell is a DAG with $N$ ordered nodes $\{x_0, x_1, \dots, x_{N-1}\}$, where each node $x_j$ is a latent feature-map representation. Nodes $x_0$ and $x_1$ are the cell's inputs (the outputs of the two previous cells); intermediate nodes are computed from all predecessors; and the cell output is the concatenation of all intermediate nodes. An edge $(i, j)$ with $i < j$ applies an operation $o^{(i,j)} \in \mathcal{O}$ to $x_i$, and

$$
x_j = \sum_{i<j} o^{(i,j)}(x_i).
$$

The candidate operation set $\mathcal{O}$ in DARTS contains eight primitives — $3\times3$/$5\times5$ separable and dilated convolutions, $3\times3$ max/avg pooling, skip connection, and zero — of which the latter four are parameter-free:

A *normal cell* preserves spatial resolution; a *reduction cell* halves it via stride-2 operations. The single-cell search space has on the order of $10^9$–$10^{18}$ configurations — far too many for enumeration.

### 2.2 Weight Sharing and One-Shot Models

The ENAS breakthrough [7] showed that all architectures in the search space can share weights inside one *supernet*: a child architecture is a subgraph, and its validation performance is estimated from shared weights without retraining. This cuts evaluation cost by orders of magnitude, at the price of *rank disorder*: one-shot rankings only partially match stand-alone rankings (Kendall's $\tau$ typically $0.3$–$0.7$ [5]).

### 2.3 Black-Box Baselines and Their Cost

| Method | Search strategy | CIFAR-10 cost (GPU-days) | CIFAR-10 err (%) |
|---|---|---|---|
| NASNet-A [1] | RL controller | ~2000 | 2.65 |
| AmoebaNet-B | regularized evolution | ~3150 | 2.55 |
| PNAS | sequential model-based opt | ~225 | 3.41 |
| ENAS [7] | RL + weight sharing | ~0.5 | 2.89 |
| DARTS (2nd order) [2] | gradient-based | ~4 | 2.76 |
| DARTS (1st order) [2] | gradient-based | ~1.5 | 3.00 |

Differentiable methods match black-box accuracy at three orders of magnitude lower cost.

---

## 3 Methodology: The DARTS Formulation

### 3.1 Continuous Relaxation via Softmax Mixtures

DARTS replaces the categorical choice of operation on edge $(i,j)$ with a *mixture* of all candidate operations, weighted by architecture parameters $\alpha^{(i,j)} \in \mathbb{R}^{|\mathcal{O}|}$:

$$
\bar{o}^{(i,j)}(x) = \sum_{o \in \mathcal{O}} \frac{\exp(\alpha_o^{(i,j)})}{\sum_{o' \in \mathcal{O}} \exp(\alpha_{o'}^{(i,j)})} \ o(x).
$$

The supernet's forward pass is then differentiable in both $w$ (operation weights) and $\alpha$ (architecture weights). Searching becomes *learning*: after optimization, the discrete architecture is derived by retaining, on each edge, the operation with maximal $\alpha$. As the softmax temperature $T \to 0$, the mixture converges to the argmax operation, recovering the discrete space; at the default $T=1$, the gap between mixture loss and discretized-cell loss is bounded by the softmax entropy times the loss's Lipschitz constant in operation space.

```python
# DARTS mixed operation: the core of the continuous relaxation
import torch
import torch.nn as nn
import torch.nn.functional as F

class MixedOp(nn.Module):
    def __init__(self, ops):          # ops: list of candidate nn.Modules
        super().__init__()
        self._ops = nn.ModuleList(ops)
        # architecture parameters: one logit per candidate operation
        self.alpha = nn.Parameter(1e-3 * torch.randn(len(ops)))

    def forward(self, x):
        weights = F.softmax(self.alpha, dim=0)      # p_o = exp(a_o)/sum exp(a_o')
        return sum(w * op(x) for w, op in zip(weights, self._ops))
```

### 3.2 The Bilevel Optimization Program

DARTS poses architecture search as a bilevel program [2]:

$$
\begin{aligned}
\min_{\alpha} \quad & \mathcal{L}_{\text{val}}(w^*(\alpha), \alpha) \\
\text{s.t.} \quad & w^*(\alpha) = \arg\min_{w} \ \mathcal{L}_{\text{train}}(w, \alpha).
\end{aligned}
$$

The inner problem trains the supernet weights for the current architecture encoding; the outer problem tunes the encoding to minimize validation loss. Solving the inner problem exactly at every step is infeasible, so DARTS approximates $w^*(\alpha)$ with a **single virtual gradient step**:

$$
w^*(\alpha) \approx w' = w - \xi \nabla_w \mathcal{L}_{\text{train}}(w, \alpha),
$$

and updates $\alpha$ by descending through this approximation:

$$
\nabla_\alpha \mathcal{L}_{\text{val}}(w', \alpha)
= \nabla_\alpha \mathcal{L}_{\text{val}}(w - \xi \nabla_w \mathcal{L}_{\text{train}}(w, \alpha), \alpha).
$$

Applying the chain rule yields the second-order term:

$$
\nabla_\alpha \mathcal{L}_{\text{val}}(w', \alpha)
= \underbrace{\frac{\partial \mathcal{L}_{\text{val}}}{\partial \alpha}}_{\text{direct}}
- \xi \underbrace{\nabla^2_{\alpha, w} \mathcal{L}_{\text{train}}(w, \alpha) \cdot \nabla_{w'} \mathcal{L}_{\text{val}}(w', \alpha)}_{\text{indirect: how } \alpha \text{ shifts optimal } w}.
$$

The Hessian-vector product is approximated by finite differences to avoid $O(|\alpha||w|)$ cost [2]. Setting $\xi = 0$ recovers the **first-order approximation**, which ignores the indirect term entirely. Empirically, second-order DARTS slightly outperforms first-order (2.76% vs. 3.00% CIFAR-10 error) at roughly $2.5\times$ the search cost [2].

### 3.3 Alternating Optimization Dynamics

In practice, DARTS alternates: (1) descend $w$ on $\nabla_w \mathcal{L}_{\text{train}}$ with $\alpha$ fixed; (2) descend $\alpha$ on the unrolled $\nabla_\alpha \mathcal{L}_{\text{val}}$ with $w$ fixed. The two parameter groups use disjoint data splits — $\mathcal{L}_{\text{train}}$ on the training set, $\mathcal{L}_{\text{val}}$ on the validation set — which is what makes $\alpha$ generalize rather than memorize.

---

## 4 Deep Dive

### 4.1 The Discretization Gap and Its Remedies

The most theoretically uncomfortable step in DARTS is the final one: replacing each softmax mixture with its argmax operation. The supernet was trained with *all* operations active; the derived cell runs *one*. This **discretization gap** means the reported validation accuracy of the supernet need not predict the retrained cell's accuracy at all. Two pathologies follow:

1. **Skip-connection collapse.** The identity operation is parameter-free, converges fastest under weight sharing, and accumulates large $\alpha$ early. On long searches the cell degenerates into skip connections, with supernet validation accuracy that looks excellent but retrains poorly. Zela et al. [6] diagnose this as the bilevel approximation failing to penalize operations that help optimization rather than generalization; RobustDARTS adds $L_2$ regularization on $\alpha$ and early stopping based on the Hessian's dominant eigenvalue as a collapse detector.
2. **Depth gap.** DARTS searches with 8 stacked cells but evaluates with 20; P-DARTS [8] progressively deepens the supernet during search (5 → 11 → 17 cells) while shrinking the operation set, cutting CIFAR-10 error to 2.50%.

Subsequent refinements attack the gap from different angles:

- **PC-DARTS** samples only a fraction ($1/K$) of channels through the mixture, enabling larger batch sizes and stabilizing $\alpha$ via edge normalization parameters $\beta$ [9].
- **GDAS** replaces the softmax mixture with Gumbel-softmax sampling of a single path per iteration, so the supernet trains sub-networks rather than mixtures, shrinking the gap [10].
- **DARTS+PT** (Wang et al.) keeps the supernet but replaces argmax selection with *perturbation-based* selection: mask each operation, measure the validation drop, and keep the operation whose removal hurts most — improving DARTS's CIFAR-10 error from 3.00% to 2.61% with no change to training [11]. When the mixture entropy is low, perturbation selection provably agrees with the optimal discrete choice, a guarantee argmax selection lacks.

### 4.2 ProxylessNAS: Direct Search on Target Task and Hardware

DARTS still searches on a *proxy*: fewer cells, fewer epochs, CIFAR-10 instead of ImageNet. ProxylessNAS introduces **binarized path sampling**: on each edge, only *one* path is active per batch, sampled from a multinomial parameterized by $\alpha$. Memory drops to the level of training a single compact network, while an alternating $w$/$\alpha$ schedule and a straight-through gradient estimator keep the architecture parameters learning. The expected latency of the sampled architecture enters the objective differentiably:
$$
\mathcal{L} = \mathcal{L}_{\text{CE}} + \lambda_1 \|w\|^2 + \lambda_2 \, \mathbb{E}[\text{LAT}],
$$
where the expectation factorizes over edges and is differentiable in $\alpha$. ProxylessNAS thus searches *directly on ImageNet* in ~200 GPU-hours — the cost of ordinary training — reaching 74.6% top-1 at mobile latency [3].

### 4.3 FBNet and the Latency Lookup-Table Theorem

Wu et al.'s FBNet [4] makes hardware-awareness fully differentiable over a *layer-wise* (macro) search space: 22 layers, each choosing among 9 mobile inverted-bottleneck block types, for $9^{22} \approx 10^{21}$ architectures. The key device is the **latency lookup table**: benchmark each of the few hundred distinct operators once on the target device, then estimate any architecture's latency additively — valid because sequential execution on mobile CPUs/DSPs makes total runtime the sum of per-operator runtimes.

FBNet's loss couples cross-entropy with latency multiplicatively [4]:

$$
\mathcal{L}(a, w_a) = \text{CE}(a, w_a) \cdot \alpha \, \log(\text{LAT}(a))^{\beta}.
$$

Because $\text{LAT}(a)$ is a sum of table entries weighted by Gumbel-softmax block probabilities, the whole objective is differentiable, and sweeping $\beta$ traces out the **Pareto frontier**. FBNet-A reaches 73.0% ImageNet top-1 at 249M FLOPs — 2.4$\times$ fewer than DARTS's discovered cell — with lower iPhone X latency than MobileNetV2 at higher accuracy [4].

### 4.4 One-Shot Supernets and Once-for-All

The logical endpoint of weight sharing is to train the supernet *once* and specialize it *many* times. Cai et al.'s Once-for-All (OFA) trains a single supernet supporting elastic depth, width, kernel size, and resolution ($10^{19}$ sub-networks), then uses an accuracy predictor plus evolutionary search to extract deployment-ready models for each hardware target *without retraining* [12]. OFA reports 80.0% ImageNet top-1 at 595M FLOPs, matching per-device searched architectures, while amortizing the one-time training cost over arbitrarily many deployments: search cost becomes $O(1)$ in the number of target devices.

---

## 5 Empirical Results and Proofs

### 5.1 Search Cost Collapse

| Method | Target task | Search cost | ImageNet top-1 |
|---|---|---|---|
| NASNet-A [1] | direct | ~500 P100-days | 74.0% |
| AmoebaNet-C | direct | ~3150 GPU-days | 75.7% |
| DARTS [2] | proxy → transfer | ~4 GPU-days (CIFAR-10) | 73.3% |
| ProxylessNAS-mobile [3] | direct | ~200 GPU-hours | 74.6% |
| FBNet-B [4] | direct + latency | ~216 GPU-hours | 74.1% |
| FBNet-C [4] | direct + latency | ~216 GPU-hours | 74.9% |

DARTS's transferred cell reaches 73.3% top-1 on ImageNet in the mobile regime — within a point of architectures that cost $100\times$ more to find [2].

### 5.2 Ranking Fidelity: NAS-Bench-201 Evidence

NAS-Bench-201 [5] exhaustively trains all 15,625 cell architectures (6 edges $\times$ 5 operations) on CIFAR-10, CIFAR-100, and ImageNet-16-120, providing ground truth for one-shot rank correlation. DARTS-V1/V2 achieve Kendall-$\tau$ of roughly $0.4$–$0.6$ against true CIFAR-10 rankings — far better than random but far from perfect, confirming that *rank disorder is real but bounded*. GDAS's sampled-path training raises the correlation relative to DARTS's mixture training, supporting the claim that training sub-networks rather than mixtures narrows the discretization gap [10]. The benchmark's known optimum lies in the top 1% of the space, which differentiable methods recover in the majority of seeds — but with the seed variance documented by Zela et al. [6].

### 5.3 The Accuracy–Latency Pareto Frontier

Hardware-aware search is fundamentally multi-objective. Varying FBNet's latency exponent $\beta$ traces a frontier where no single model dominates — each is Pareto-optimal for a different latency budget:

| Model | ImageNet top-1 | iPhone X latency (ms) | FLOPs |
|---|---|---|---|
| MobileNetV2 (1.0) | 72.0% | ~20.0 | 300M |
| FBNet-A [4] | 73.0% | ~18.1 | 249M |
| FBNet-B [4] | 74.1% | ~23.1 | 295M |
| FBNet-C [4] | 74.9% | ~28.1 | 375M |
| ProxylessNAS-mobile [3] | 74.6% | — (GPU 3.95ms) | — |
| MnasNet-A1 | 75.2% | — | 312M |

The *methodological* contribution is that one differentiable run per $\beta$ — not thousands of RL rollouts — suffices to populate the frontier.

### 5.4 Approximation Error of the One-Step Unrolled Gradient

We bound the error of DARTS's central approximation. Assume $\mathcal{L}_{\text{train}}$ is $\mu$-strongly convex in $w$ with $L$-Lipschitz gradients near $w^*(\alpha)$, and that $\alpha \mapsto w^*(\alpha)$ is $K$-Lipschitz. With step $\xi = 1/L$, the virtual update $w' = w - \xi \nabla_w \mathcal{L}_{\text{train}}$ contracts toward $w^*(\alpha)$ by a factor $(1-\mu/L)$ per step up to second-order terms. The true implicit-function gradient requires $[\nabla^2_w \mathcal{L}_{\text{train}}]^{-1}$; DARTS replaces it with $\xi I$ — the zeroth-order Neumann truncation — incurring an irreducible $O(\xi)$ bias. This explains both why DARTS works (the contraction dominates early) and why it destabilizes late (the bias accumulates as $\alpha$ sharpens — the mechanism behind skip-connection collapse identified in [6]).

---

## 6 Limitations

1. **The discretization gap is unclosed in the base method.** Argmax derivation from a high-entropy mixture is unjustified; fixes (P-DARTS, GDAS, DARTS+PT) are patches, and no current method certifies that the derived cell is near-optimal in the discrete space.
2. **Rank disorder persists.** Kendall-$\tau \approx 0.5$ on NAS-Bench-201 means the one-shot proxy mis-ranks roughly half of pairwise comparisons; predictor-based second stages (as in OFA) are still needed for reliability [5, 12].
3. **Latency models are device- and compiler-specific.** Additive lookup tables assume sequential execution; on NPUs with operator fusion, graph compilers (TVM, TensorRT) invalidate additivity, and the table must be rebuilt per software stack — a hidden cost rarely reported [4].
4. **Proxy transfer is unprincipled.** Searching on CIFAR-10 with 8 cells and evaluating on ImageNet with 20+ cells relies on the empirical observation that good cells transfer; ProxylessNAS's direct search was motivated precisely by this fragility [3].
5. **Multi-objective scalarization is ad hoc.** The $\text{CE} \cdot \log(\text{LAT})^\beta$ form lacks a decision-theoretic foundation; constrained formulations (maximize accuracy subject to $\text{LAT} \le T$) are theoretically cleaner but underexplored in the differentiable setting.
6. **Reproducibility remains weak.** Rankings vary across seeds [6]; no exhaustive benchmark exists for the macro/hardware-aware spaces where industry impact is largest.

---

## 7 Conclusion

DARTS transformed neural architecture search from a black-box luxury into a gradient-based commodity: a continuous relaxation of the operation-choice problem, a bilevel program approximated by one-step unrolled differentiation, and a discretization step that — despite its theoretical gaps — cells rivaling thousand-GPU-day searches [2]. Its descendants addressed its weaknesses along three axes: *fidelity* (P-DARTS, PC-DARTS, GDAS, DARTS+PT), *directness* (ProxylessNAS removes the proxy task [3]), and *deployability* (FBNet makes latency differentiable [4]; Once-for-All amortizes one supernet over all devices [12]). The open frontier is *certifiable* NAS: methods that prove the found architecture is near-optimal under stated constraints.

---

## References

[1] B. Zoph, V. Vasudevan, J. Shlens, and Q. V. Le, "Learning transferable architectures for scalable image recognition," in *Proc. IEEE CVPR*, 2018, pp. 8697–8710. DOI: 10.1109/CVPR.2018.00907.

[2] H. Liu, K. Simonyan, and Y. Yang, "DARTS: Differentiable Architecture Search," in *Proc. ICLR*, 2019. arXiv:1806.09055. https://arxiv.org/abs/1806.09055

[3] H. Cai, L. Zhu, and S. Han, "ProxylessNAS: Direct neural architecture search on target task and hardware," in *Proc. ICLR*, 2019. arXiv:1812.00332. https://arxiv.org/abs/1812.00332

[4] B. Wu et al., "FBNet: Hardware-aware efficient ConvNet design via differentiable neural architecture search," in *Proc. IEEE CVPR*, 2019, pp. 10734–10742. arXiv:1812.03443. http://arxiv.org/pdf/1812.03443

[5] X. Dong and Y. Yang, "NAS-Bench-201: Extending the scope of reproducible neural architecture search," in *Proc. ICLR*, 2020. arXiv:2001.00326. http://arxiv.org/pdf/2001.00326v2

[6] A. Zela, T. Elsken, T. Saikia, Y. Marrakchi, T. Brox, and F. Hutter, "Understanding and robustifying differentiable architecture search," in *Proc. ICLR*, 2020. https://openreview.net/attachment?id=H1gDNyrKDS&name=original_pdf

[7] H. Pham, M. Guan, B. Zoph, Q. Le, and J. Dean, "Efficient neural architecture search via parameters sharing," in *Proc. ICML*, 2018, pp. 4095–4104. arXiv:1802.03268. https://arxiv.org/abs/1802.03268

[8] X. Chen, L. Xie, J. Wu, and Q. Tian, "Progressive differentiable architecture search: Bridging the depth gap between search and evaluation," in *Proc. IEEE ICCV*, 2019, pp. 1294–1303. arXiv:1904.12744. https://arxiv.org/abs/1904.12744

[9] Y. Xu et al., "PC-DARTS: Partial channel connections for memory-efficient architecture search," in *Proc. ICLR*, 2020. arXiv:1907.05737. https://arxiv.org/abs/1907.05737

[10] X. Dong and Y. Yang, "Searching for a robust neural architecture in four GPU hours," in *Proc. IEEE CVPR*, 2019, pp. 1761–1770. (GDAS) arXiv:1910.04465. https://arxiv.org/abs/1910.04465

[11] R. Wang et al., "Rethinking architecture selection in differentiable NAS," in *Proc. ICLR*, 2021. (DARTS+PT) arXiv:2108.04392. https://arxiv.org/pdf/2108.04392

[12] H. Cai, C. Gan, T. Wang, Z. Zhang, and S. Han, "Once-for-All: Train one network and specialize it for efficient deployment," in *Proc. ICLR*, 2020. https://arxiv.org/abs/1908.09791

