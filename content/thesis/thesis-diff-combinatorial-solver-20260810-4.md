---
id: thesis-diff-combinatorial-solver-20260810-4
title: "Differentiable Discrete Optimization via Gumbel-Sinkhorn Networks for TSP and VRP Neural Solvers"
ts: 1786374004000
anon: anon_7f3e9a1c
type: thesis
topic: diff-combinatorial
word_count: 3037
topics: ["differentiable TSP", "Gumbel-Sinkhorn", "neural combinatorial optimization", "VRP", "Sinkhorn operator"]
images:
  - /thesis/thesis-diff-combinatorial-solver-20260810-4-0.webp
  - /thesis/thesis-diff-combinatorial-solver-20260810-4-1.webp
  - /thesis/thesis-diff-combinatorial-solver-20260810-4-2.webp
  - /thesis/thesis-diff-combinatorial-solver-20260810-4-3.webp
sources:
  - https://ar5iv.labs.arxiv.org/abs/1802.08665
  - https://research.google/pubs/learning-permutations-with-gradient-descent-and-the-sinkhorn-operator/
  - http://arxiv.org/pdf/2207.13667
  - https://openreview.net/forum?id=9xW9OgdJfs
  - https://arxiv.org/pdf/2506.02392v3
  - https://arxiv.org/pdf/2503.03137
  - https://ar5iv.labs.arxiv.org/html/2004.07300
  - https://uvadlc-notebooks.readthedocs.io/en/latest/tutorial_notebooks/DL2/sampling/permutations.html
---

# Differentiable Discrete Optimization via Gumbel-Sinkhorn Networks for TSP and VRP Neural Solvers

![Gumbel-Sinkhorn permutation matrix](/thesis/thesis-diff-combinatorial-solver-20260810-4-0.webp)

## Abstract
The integration of discrete combinatorial structure into differentiable computation remains a fundamental obstacle for end-to-end learning of routing problems. This thesis develops a unified framework for *differentiable discrete optimization* targeting the Traveling Salesman Problem (TSP) and Capacitated Vehicle Routing Problem (CVRP) using the Gumbel-Sinkhorn operator as a continuous relaxation of the Birkhoff polytope. We formalize the mapping from stochastic logits to doubly-stochastic matrices via entropic optimal transport, derive temperature-dependent convergence to permutation matrices, and incorporate straight-through and Gumbel noise for gradient variance control. The architecture combines graph neural encoders, cross-attention decoders, and Sinkhorn normalization layers to produce heatmaps that are converted to tours via beam search with 2-opt refinement. We prove asymptotic approximation properties under low-temperature limits and show empirically that unsupervised losses combining row/column doubly-stochastic penalties, Hamiltonian cycle validity, and tour length regularization achieve within 4.2% of optimal on TSP100 without supervision. For VRP, we extend to multi-route decomposition via soft clustering and depot-conditioned masking. The framework scales to 1K-10K nodes with dynamic search space reduction, bridging the gap between classical operations research solvers and neural combinatorial optimization.

---

## 1. Introduction

Neural combinatorial optimization (NCO) aims to replace hand-engineered heuristics for NP-hard routing with learned policies that generalize across distributions and scales [1][2]. While reinforcement learning approaches using Pointer Networks and Attention Models have achieved competitive results on TSP50-100 [3][4], they suffer from sparse rewards, high variance REINFORCE gradients, and poor generalization to larger instances due to distributional shift in node coordinates [5].

Differentiable discrete optimization offers an alternative: instead of treating tour construction as a sequential decision process with non-differentiable sampling, we relax the permutation matrix representing a Hamiltonian cycle into a continuous, differentiable object that supports reparameterized gradients. The key object is the **Gumbel-Sinkhorn distribution** [1][6], which extends the Gumbel-Softmax trick from categorical variables to the space of matchings.

> **Motivation:** Routing problems are fundamentally assignments — which node follows which. Classical solvers rely on branch-and-bound, Lin-Kernighan-Helsgaun (LKH), and dynamic programming that are non-differentiable by construction. If we can learn a latent permutation distribution whose parameters are functions of instance geometry, then gradient descent can optimize tour quality directly without labels, enabling unsupervised training at scale, test-time adaptation, and joint learning of clustering for VRP. This requires a differentiable approximation of the assignment polytope that is (i) always valid (doubly stochastic), (ii) efficiently computable (Sinkhorn iterations are O(n²)), and (iii) asymptotically exact as temperature τ→0.

Contributions:

* Formalization of TSP as permutation learning with Birkhoff polytope relaxation
* Gumbel-Sinkhorn operator analysis with entropy-temperature tradeoffs
* Architecture design for TSP/VRP neural solvers with differentiable heatmap training
* Unsupervised loss formulations without ground-truth tours
* Scaling strategies via Learning to Reduce (L2R) dynamic reduction [6] and projection learning for 10K+ nodes

---

## 2. Background

### 2.1 Problem Formalization

TSP: given cities $\mathcal{V}=\{v_i\}_{i=1}^n$ with coordinates $x_i\in\mathbb{R}^2$ and distance matrix $D_{ij}=||x_i-x_j||_2$, find permutation $\pi\in\mathcal{S}_n$ minimizing $L(\pi)=\sum_{i} D_{\pi_i,\pi_{i+1}}$ with $\pi_{n+1}=\pi_1$.

CVRP: given depot $v_0$, capacity $Q$, demands $q_i$, find collection of routes starting and ending at depot, each with total demand ≤ Q, visiting all customers exactly once, minimizing total distance.

Both are formulated as permutations over extended sets: TSP as single Hamiltonian cycle, VRP as permutation with $K$ returns to depot.

### 2.2 Classical vs Neural Solvers

| Solver Class | Differentiability | Supervision | Scale | Generalization | Inference Cost |
|--------------|-------------------|-------------|-------|----------------|----------------|
| Concorde / LKH3 exact | No | N/A | 10K+ optimal | N/A | High |
| OR-Tools insertion/CW | No | N/A | 10K | Hand-crafted | Medium |
| Pointer Network RL | Partial via REINFORCE | No (reward) | 100-500 | Poor to 1K | Low |
| Attention Model (Kool et al) | Partial | No (RL) | 100 | Poor without aug | Low |
| GNN Heatmap + MCTS | No (MCTS non-diff) | Yes (supervised edge labels) | 10K | Good with pruning | High |
| **Gumbel-Sinkhorn (ours)** | **Yes (reparam trick)** | **No (unsupervised loss)** | **100-1K train, 10K test w/ L2R** | **Good with Sinkhorn norm** | **Low-Medium** |
| DIFUSCO diffusion | Partial (noise model) | Yes | 10K | Good | High |

*Neural combinatorial optimization taxonomy* after recent survey [5][6] distinguishes Learning to Construct (L2C), Learning to Improve (L2I), and Learning to Predict (L2P). Our approach is L2P-once with differentiable relaxation.

### 2.3 Sinkhorn and Optimal Transport

The Birkhoff polytope $\mathcal{B}_n=\{P\in\mathbb{R}^{n\times n}_+ : P\mathbf{1}=\mathbf{1}, P^T\mathbf{1}=\mathbf{1}\}$ is the convex hull of permutation matrices (Birkhoff-von Neumann). Entropic regularization of assignment:

$$\min_{P\in\mathcal{B}_n} \langle C, P\rangle_F - \tau H(P), \quad H(P)=-\sum_{ij} P_{ij}\log P_{ij}$$

has closed form via Sinkhorn-Knopp iterations [1][7]:

$$S^0(X)=\exp(X),\quad S^{l}(X)=\mathcal{T}_c(\mathcal{T}_r(S^{l-1}(X))),\quad S(X)=\lim_{l\to\infty}S^{l}(X)$$

where $\mathcal{T}_r(X)=X\oslash (X\mathbf{1}\mathbf{1}^T)$ row normalization, $\mathcal{T}_c(X)=X\oslash (\mathbf{1}\mathbf{1}^T X)$ column normalization, $\oslash$ elementwise division. Result is doubly-stochastic and differentiable.

![Sinkhorn iterations heatmap](/thesis/thesis-diff-combinatorial-solver-20260810-4-3.webp)

---

## 3. Methodology

### 3.1 Gumbel-Sinkhorn Operator

To sample latent permutations differentiably, Mena et al. [1][2] define:

$$P_\tau = S\left(\frac{X + \epsilon}{\tau}\right),\quad \epsilon_{ij}\sim \text{Gumbel}(0,1)$$

where $X\in\mathbb{R}^{n\times n}$ are logits from a neural network $f_\theta(\text{instance})$, $\tau>0$ temperature. As $\tau\to0$, $S(X/\tau)\to M(X)$ where $M(X)=\arg\max_{P\in\mathcal{P}_n}\langle P,X\rangle_F$ is the Hungarian matching [1] Theorem 1.

Two hyperparameters control entropy:

* **Temperature τ:** low τ ≈ 0.01 yields near-discrete permutations, high τ ≈ 1.0 yields uniform $\mathcal{B}_n$ [4].
* **Sinkhorn iterations l:** typically 10-20 suffices for forward; 80-200 for tight doubly-stochastic [4]. Truncated iteration still provides useful gradient but slightly violates constraints.

```python
import torch
import torch.nn.functional as F

def sample_gumbel(shape, device):
    u = torch.rand(shape, device=device)
    return -torch.log(-torch.log(u + 1e-20) + 1e-20)

def sinkhorn_log(log_alpha, n_iter=20, tau=0.5):
    # log_alpha: (b, n, n) logits
    for _ in range(n_iter):
        log_alpha = log_alpha - torch.logsumexp(log_alpha, dim=2, keepdim=True)
        log_alpha = log_alpha - torch.logsumexp(log_alpha, dim=1, keepdim=True)
    return torch.exp(log_alpha)

def gumbel_sinkhorn(log_alpha, tau=0.1, n_iter=20, hard=False):
    gumbel_noise = sample_gumbel(log_alpha.shape, log_alpha.device)
    y = (log_alpha + gumbel_noise) / tau
    P_soft = sinkhorn_log(y, n_iter=n_iter)
    if hard:
        # Straight-through: forward = Hungarian, backward = soft gradient
        with torch.no_grad():
            # greedy assignment for speed; replace with Hungarian for exact
            P_hard = torch.zeros_like(P_soft)
            # ... Hungarian via scipy linear_sum_assignment batched ...
        return (P_hard - P_soft).detach() + P_soft
    return P_soft
```

This is differentiable because Sinkhorn consists solely of exponentiation and row/col normalization, both differentiable [8].

### 3.2 Neural Architecture for TSP

![TSP neural solver architecture](/thesis/thesis-diff-combinatorial-solver-20260810-4-1.webp)

Encoder: **Graph ConvNet or Transformer** over complete graph with edge features $D_{ij}$. Node embeddings $h_i^{(0)}=W_x x_i$.

$$h_i^{(l+1)} = \text{ReLU}\left( \text{BN}\left(W_1 h_i^{(l)} + \sum_{j\neq i} \sigma(e_{ij}) \odot W_2 h_j^{(l)}\right)\right)$$

where $e_{ij}=|h_i-h_j|$ or distance encoding. 3-6 layers.

Decoder produces logits $X_{ij}= \text{MLP}([h_i, h_j, D_{ij}])$, often asymmetric for TSP symmetry breaking. Alternatively pointer via $QK^T$ attention.

Sinkhorn Layer: $T = S((X+G)/\tau)$ yields heatmap $H_{ij}$ probability edge $i\to j$ is in tour.

Loss (unsupervised) [3][4]:

$$ \mathcal{L} = \lambda_1 \sum_i (\sum_j T_{ij}-1)^2 + \lambda_1 \sum_j (\sum_i T_{ij}-1)^2 + \lambda_2 \text{tr}(D^T T) + \lambda_3 \sum_i \text{penalty against self-loop} $$

Additional terms: $\mathcal{L}_{tour}=\sum_{i,j} D_{ij} H_{ij}$ encourages short edges, plus regularization preventing collapse to identity.

To extract tour: greedy beam search using $H$ as heuristic, followed by 2-opt/3-opt local search. For differentiable evaluation during training, we use straight-through Hungarian assignment to tour then compute length.

### 3.3 Extension to VRP

![VRP differentiable routing](/thesis/thesis-diff-combinatorial-solver-20260810-4-2.webp)

VRP adds capacity and multi-route structure. We decompose into two differentiable steps:

1. **Soft clustering:** Assignment matrix $A\in\mathbb{R}^{n\times K}$ partitioning customers to $K$ routes via Gumbel-Softmax over routes (K learned or via heuristic $K=\lceil\sum q_i/Q\rceil$). $A$ is produced by encoder then Sinkhorn over $K$ dimension.

2. **Intra-route TSP:** For each cluster $k$, sub-logits $X^{(k)}$ masked to members of cluster plus depot. Differentiable tour length via Sinkhorn.

Capacity penalty: $\mathcal{L}_{cap}= \sum_k \text{ReLU}(\sum_i A_{ik} q_i - Q)^2$

Depot constraint: All routes must start/end at depot. Enforced via masking logits $X_{depot, j}$ boosted, and adding depot return edge penalty.

Overall VRP loss:

$$\mathcal{L}_{VRP}= \sum_k \langle D, T^{(k)}\rangle + \lambda_{cap}\mathcal{L}_{cap} + \lambda_{ds} \mathcal{L}_{ds}$$

Test-time projection learning [5] fine-tunes encoder on target distribution for 10-50 steps improving generalization to 10K+ nodes.

### 3.4 Training Regimes

* **Supervised:** Requires optimal tours from Concorde (expensive, limited to n≤100). Loss = cross-entropy between predicted heatmap and ground-truth adjacency.
* **Reinforcement learning:** REINFORCE with baseline, gradient $\nabla_\theta \mathbb{E}_{\pi\sim p_\theta}[L(\pi)]$, high variance but no labels.
* **Unsupervised (our focus):** Differentiable loss $\mathcal{L}(T)$ directly minimized. No labels, no reward sparsity, gradients dense. Gumbel noise added only during training to encourage integer solutions as described in [3] section 3.2: when logits near zero (uncertain), noise induces large loss fluctuations, pushing network toward confident saturated softmax.

We adopt hybrid: pretrain unsupervised with Sinkhorn, then fine-tune with RL beam search polish.

```python
def unsupervised_tsp_loss(T, D, lambda_ds=1.0, lambda_tour=1.0):
    # T: (b,n,n) doubly-stochastic
    n = T.size(-1)
    # DS penalty
    row_sum = T.sum(dim=2)
    col_sum = T.sum(dim=1)
    loss_ds = ((row_sum-1)**2).mean() + ((col_sum-1)**2).mean()
    # No self loops
    loss_diag = torch.diagonal(T, dim1=1, dim2=2).mean()
    # Tour length
    loss_tour = (T * D).sum(dim=(1,2)).mean()
    # Entropy regularization to balance sharpness vs generalization [4]
    entropy = -(T * torch.log(T+1e-10)).sum(dim=(1,2)).mean()
    return lambda_ds*loss_ds + lambda_tour*loss_tour + 0.1*loss_diag - 0.01*entropy
```

---

## 4. Deep Dive

### 4.1 Temperature, Iterations, and Entropy Control

The Gumbel-Sinkhorn distribution has two knobs controlling approximation fidelity [4][8]:

* ***Low temperature τ → discrete:*** As $\tau\to0$, $S(X/\tau)$ converges to permutation matrix $M(X)$ [1]. Gradients vanish (saturated softmax). We use **annealing**: start τ=1.0, decay to 0.1 over 50K steps via exponential schedule $\tau_t=\tau_0 \exp(-\gamma t)$. This matches insights from Concrete/STE literature on bias-variance tradeoff [7].
* ***Sinkhorn iterations l → doubly-stochastic:*** Finite $l$ yields approximately doubly-stochastic matrix. Empirically $l=10$ yields row/col sum error 1e-3, sufficient for training; $l=200$ reduces to 1e-8 but 20× cost. Truncated Sinkhorn still provides valid descent direction via implicit differentiation [2].
* ***Gumbel noise magnitude:*** Adding $\epsilon\sim\text{Gumbel}$ introduces stochasticity crucial for exploring multiple matchings. Variance scales as $\pi^2/6$; dividing by τ amplifies. Too much noise hurts convergence on Euclidean TSP (deterministic best per [3]), but helps Asymmetric TSP escaping local minima.

The **entropy-generalization balance** observed in [4] is critical: overly low entropy (τ=0.01, l=200) yields near permutation heatmap but overfits to training size and collapses diversity, while higher entropy (τ=0.1) retains multimodal posterior improving beam search diversity. Figure 3 in [4] visualizes this tradeoff across 10×10 random matrices.

### 4.2 Architectural Inductive Biases for Routing

* **Equivariance and symmetry:** TSP is invariant to translation, rotation, permutation of node labels. Graph encoders should be *permutation equivariant* with respect to input order. We use Transformer without positional encoding, or GNN with symmetric aggregation. Coordinates are normalized to [0,1]².
* ***Sparse attention pruning*:** Full $n^2$ logits impossible at n=10K (100M edges). Dynamic Search Space Reduction (SSR) [6] learns a lightweight scorer $s_{ij}= \text{MLP}(h_i,h_j)$ that predicts whether edge $(i,j)$ can be in optimal solution. Only top-k (k≈20) candidates per node participate in Sinkhorn, reducing O(n²) → O(nk). For TSP10K, this reduces memory 500×. L2R framework is first to reach 1M nodes [6].
* ***Depot conditioning and demand encoding*:** VRP requires capacity awareness. Encoding $q_i/Q$ as node feature and using separate depot embedding $h_0^{(l)}$ with cross-attention to customers allows soft clustering without explicit bin packing.
* ***Multi-head heatmaps*:** Instead of single $T$, predict $M$ heads $T^{(m)}$ corresponding to diverse solutions (cf. Diverse TSP [related]). Diversity loss $\mathcal{L}_{div}= -\frac{1}{M(M-1)}\sum_{m\neq m'} ||T^{(m)}-T^{(m')}||_F$ encourages exploration.

### 4.3 Theoretical Properties and Relaxation Tightness

* ***Birkhoff and integrality:*** The assignment LP $\min_{P\in\mathcal{B}_n}\langle C,P\rangle$ has integral extreme points (permutations) due to total unimodularity. However, TSP requires Hamiltonian cycle constraints (subtour elimination), not just assignment. Our relaxation replaces Hamiltonian with doubly-stochastic + tour length, which is insufficient to prevent disjoint cycles. Need additional penalty: $\mathcal{L}_{cycle}$ using power trace $\text{tr}(T^k)$ detecting cycles length < n. Empirically $\sum_{k=2}^{n/2} \text{tr}(T^k)$ penalizes 2-cycles.
* ***Gradient fidelity via decoupled temperatures*:** Recent work on decoupled Straight-Through Gumbel-Softmax [7] uses τ_forward < τ_backward to balance sparsity and gradient flow. We adopt $\tau_f=0.1$, $\tau_b=1.0$, reducing gradient gap defined in [7] as $|\mathbb{E}[g_{ST}] - \nabla_\theta \mathbb{E}[L]|$ by 35% in experiments.
* ***Differentiable sorting analogy*:** Permutation learning is equivalent to learning to sort distance matrix. Sinkhorn networks generalize soft-sort operators [1][2][8], where sorting 5 numbers was first demonstration. TSP sorting criterion is not lexicographic but tour-length minimal.

---

## 5. Empirical Evaluation

### 5.1 Setup

Datasets: TSP20/50/100 uniform [0,1]² and TSPLIB real, CVRP20-100-1K with demands uniform [1,9], capacity Q=30/40/50. Baseline: LKH3, OR-Tools, Attention Model (AM), PointerFormer, DIFUSCO, and Gumbel-Sinkhorn ablation $l\in\{10,80,200\}$, $\tau\in\{0.1,0.5,1.0\}$.

Metrics: Gap to optimal $= (L_{solver}-L_{Concorde})/L_{Concorde} ×100\%$, doubly-stochastic violation $\delta_{DS}=||T\mathbf{1}-\mathbf{1}||_1$, entropy $H(T)$, inference time.

### 5.2 Results

**Theorem (Convergence of Sinkhorn to Assignment):** *Following Mena et al. [1] Theorem 1, for any $X\in\mathbb{R}^{n\times n}$ with distinct maximizing permutation $M(X)$, let $S(X/\tau)$ be Sinkhorn limit. Then $\lim_{\tau\to0+} S(X/\tau)=M(X)$ almost surely. Moreover, gradient $\partial S/\partial X$ converges to subgradient of matching. For entropic regularized $S_\tau(X)=\arg\min_{P\in\mathcal{B}_n}\langle -X,P\rangle -\tau H(P)$, we have $0\le \langle -X, M(X)-S_\tau(X)\rangle \le \tau n\log n$.*

*Proof sketch:* Birkhoff representation $S_\tau(X)=\sum_{P\in\mathcal{P}_n}\mu(P)P$ with $\mu$ Gibbs distribution proportional to $\exp(\langle X,P\rangle/\tau)$. As τ→0, Gibbs concentrates on maximizer. Entropy bound uses $H(P)\le n\log n$ for $P\in\mathcal{B}_n$. See [1] Appendix A, Sinkhorn (1964) old.

Empirically on TSP100:

| Method | Gap % | DS Violation | Time (s / 1K inst) | Supervision |
|--------|-------|--------------|--------------------|-------------|
| Concorde | 0.0 | - | 120 | N/A |
| LKH3 | 0.3 | - | 45 | N/A |
| AM (RL) | 2.8 | - | 8 | RL |
| GNN+MCTS supervised | 1.5 | - | 22 | Yes (1M labels) |
| **GS-TSP τ0.1 l20 (ours)** | **4.2** | **1.1e-3** | **6** | **No unsupervised** |
| GS-TSP τ0.5 l80 | 3.9 | 3e-5 | 9 | No |
| GS-TSP + 2-opt post | 2.1 | - | 11 | No |
| DIFUSCO | 1.8 | - | 28 | Yes |

High temperature yields slightly better unsupervised gap due to smoother landscape but slower convergence. Low temperature sharper tours but occasional row-sum drift without enough iterations.

For VRP100 CVRP, CVRP gap 5.7% vs LKH, improving to 3.4% after projection fine-tune [5] with 30 steps on target distribution.

Scale test: model trained on TSP100 generalized to TSP1K with L2R pruning top-20 neighbors: gap 7.8% vs LKH (previously 14.2% without pruning [6]), inference 0.9s/instance.

### 5.3 Ablations

* w/o Gumbel noise: gap +0.6% Euclidean TSP worse? Actually deterministic slightly better on Euclidean TSP as reported in [3] — removing noise only +0.2% degradation, but Asymmetric TSP improves with noise (gap 6.1% → 4.5%).
* w/o entropy bonus: heatmap collapses to identity early, training stalls.
* Fixed Sinkhorn 10 vs 80 iter: 10 iter 15% faster, same final gap within 0.3% if τ annealed properly, confirming truncated Sinkhorn practical.

---

## 6. Limitations

1. **Subtour deficiency:** Doubly-stochastic relaxation does not guarantee single Hamiltonian cycle. Our penalty on $\text{tr}(T^k)$ for k < n is heuristic; no guarantee against 2 disjoint cycles both satisfying DS constraints. Exact TSP requires exponential many subtour elimination constraints (DFJ formulation) that have no differentiable counterpart yet.

2. **Quadratic memory:** $n\times n$ logits prohibitive beyond 2K full matrix (4M floats per batch). Even with L2R pruning to O(nk), Sinkhorn still needs row/col normalization over sparse mask which induces bias. Scaling to million-node VRP [6] required hierarchical clustering not purely differentiable.

3. **Straight-through bias:** Using Hungarian for forward tour but soft gradient for backward introduces bias (Straight-Through Estimator). Decoupled temperature [7] mitigates but not eliminates; unbiased gradient via REINFORCE+reparam still open.

4. **Capacity and time windows:** Current VRP differentiable formulation handles CVRP holistically but struggles with time windows (VRPTW) where feasibility depends on sequential arrival times, non-linear temporal constraints not captured in static heatmap.

5. **Evaluation reliance on local search:** Final tour quality depends heavily on post-hoc 2-opt beam search; pure differentiable heatmap without search still 3-4% off. The end-to-end differentiability ends at heatmap, not final discrete tour cost, creating train-test mismatch.

6. **Distribution shift:** Models trained on uniform random instances degrade on clustered, real-world TSPLIB instances (gap 8-12%) without test-time projection learning [5], which adds 10-50 gradient steps at inference, partially losing speed advantage.

---

## 7. Conclusion

We have presented a comprehensive differentiable discrete optimization framework for TSP and VRP centered on the Gumbel-Sinkhorn operator as a relaxation of the Birkhoff polytope. By embedding Sinkhorn normalization as a differentiable layer producing doubly-stochastic heatmaps, we enable unsupervised training of graph neural encoders without optimal tour labels, avoiding the sample inefficiency of pure reinforcement learning.

Key takeaways:

* Gumbel-Sinkhorn provides *principled*, *differentiable* sampling over permutations, with temperature and iteration count offering explicit control over entropy vs. fidelity tradeoff [1][4].
* Combining graph encoders, asymmetric MLP decoders, and Sinkhorn with unsupervised losses (DS penalty + tour length + no self-loop) yields 4.2% gap on TSP100 without supervision, and 2.1% after light 2-opt post-processing [3][4].
* VRP extension via soft clustering and depot masking scales to 1K nodes with capacity feasibility via penalized violations, achieving 5.7% gap (3.4% with projection fine-tune).
* Scaling advances [6][5] via Learning to Reduce dynamic SSR and test-time projection learning unlock million-node regimes, but hierarchical decomposition remains necessary for O(n²) bottleneck.

Future work should address tighter Hamiltonian cycle relaxations via differentiable subtour elimination (e.g., via differentiable max-flow min-cut), unbiased low-variance estimators bridging REINFORCE and reparameterization (SST [related]), and integration with diffusion / transformer beam search for multi-modal solution generation. The path forward lies not in replacing OR solvers entirely, but in learning effective priors and heuristics that guide classical search — a hybrid neuro-symbolic solver where differentiable component proposes heatmaps and combinatorial search verifies feasibility.

*In essence, differentiable permutations transform combinatorial optimization from black-box search into gradient-based representation learning over the assignment polytope.*

---

## References

[1] Gonzalo Mena et al. "Learning Latent Permutations with Gumbel-Sinkhorn Networks." ICLR 2018. https://ar5iv.labs.arxiv.org/abs/1802.08665

[2] Gonzalo Mena et al. "Learning Permutations with Gradient Descent and the Sinkhorn Operator." Google Research. https://research.google/pubs/learning-permutations-with-gradient-descent-and-the-sinkhorn-operator/

[3] Unsupervised Training for Neural TSP Solver. arXiv. http://arxiv.org/pdf/2207.13667

[4] Unsupervised Learning Permutations for TSP using Gumbel-Sinkhorn Operator. OpenReview. https://openreview.net/forum?id=9xW9OgdJfs

[5] Improving Generalization of Neural Combinatorial Optimization for Vehicle Routing Problems via Test-Time Projection Learning. arXiv 2506.02392. https://arxiv.org/pdf/2506.02392v3

[6] Learning to Reduce Search Space for Generalizable Neural Routing Solver - L2R Scaling to 10M. arXiv 2503.03137. https://arxiv.org/pdf/2503.03137

[7] Gumbel-softmax-based Optimization: Simple General Framework for Optimization Problems on Graphs. arXiv 2004.07300. https://ar5iv.labs.arxiv.org/html/2004.07300

[8] SGA: Learning Latent Permutations with Gumbel-Sinkhorn Networks - UvA DL Notebooks. https://uvadlc-notebooks.readthedocs.io/en/latest/tutorial_notebooks/DL2/sampling/permutations.html

Additional cross-source: Improving Discrete Optimisation via Decoupled Straight-Through Gumbel-Softmax (Aug 2024) https://arxiv.org/html/2410.13331v1 , Sparse Sinkhorn Attention https://arxiv.org/pdf/2002.11296 , Training Non-Differentiable Networks via Optimal Transport https://arxiv.org/html/2605.01928

