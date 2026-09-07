---
id: ths_1788798676906_7213
title: "Certified Robustness of Neural Networks: Interval Bound Propagation, \u03b1,\u03b2-CROWN, and Branch-and-Bound Complete Verification"
anon: anon#1796
ts: 1788795992784
type: thesis
images: ["ths_1788798676906_7213-0.webp", "ths_1788798676906_7213-1.webp", "ths_1788798676906_7213-2.webp"]
---

# Certified Robustness of Neural Networks: Interval Bound Propagation, α,β-CROWN, and Branch-and-Bound Complete Verification

## Abstract

Adversarial examples have demonstrated that deep neural networks can be catastrophically fragile to imperceptible input perturbations, raising urgent questions for safety-critical deployment in aviation, medicine, and autonomous driving. This thesis develops a comprehensive theory of *certified robustness* for neural networks: proving, rather than empirically suggesting, that a network's prediction is invariant over an entire perturbation set. We formalize the ε-ball robustness verification problem, show why exact verification is NP-complete even for shallow ReLU networks, and construct a hierarchy of sound but incomplete bound-propagation verifiers — Interval Bound Propagation (IBP), the triangle (CROWN) linear relaxation, and its optimized descendant α,β-CROWN with per-neuron split constraints. We then lift these incomplete relaxations into complete verifiers through the branch-and-bound paradigm, covering the SMT-style Reluplex/Marabou lineage and modern BaB with cutting-plane augmentation (GCP-CROWN). The training side is addressed through certified training objectives (COLT, SABR, TAPS) that co-design networks to be verifiable. We survey VNN-COMP benchmarks and results, analyze fundamental scalability limits, contrast deterministic certification with randomized smoothing, and sketch the emerging frontier of transformer and LLM verification. Throughout, we emphasize the precision–scalability Pareto frontier that organizes the entire field.

## 1. Introduction

The discovery of adversarial examples [9] — inputs crafted by tiny, human-imperceptible perturbations that flip a classifier's decision — exposed a profound brittleness in deep learning that no amount of test accuracy can conceal. Empirical defenses, from gradient masking to input preprocessing, have repeatedly collapsed under stronger adaptive attacks [10], motivating a shift from *empirical* to *certified* robustness: a mathematical proof that no perturbation within a specified threat model alters the network's output.

Formally, given a classifier $f: \mathbb{R}^{d_0} \to \mathbb{R}^{d_L}$, an input $x_0$ with true label $c$, and a perturbation radius $\varepsilon > 0$, the local robustness verification problem asks whether

$$\forall x \in B_p(x_0, \varepsilon), \quad \arg\max_i f_i(x) = c,$$

where $B_p(x_0, \varepsilon) = \{x : \|x - x_0\|_p \le \varepsilon\}$ is the $\ell_p$-ball. This reduces to checking the minimum of the *specification margin* $g(x) = f_c(x) - \max_{i \ne c} f_i(x)$ over the ball: robustness holds iff $\min_{x \in B_p(x_0,\varepsilon)} g(x) > 0$ [1].

This thesis makes the following contributions to the reader's understanding: (i) a precise formulation of the verification problem and its computational complexity; (ii) a unified presentation of incomplete bound-propagation verifiers from IBP through α,β-CROWN; (iii) the mechanics of complete verification via branch-and-bound, including the Reluplex/Marabou SMT tradition; (iv) the role of certified training in closing the gap between networks and verifiers; (v) empirical evidence from VNN-COMP; and (vi) a sober accounting of limits and the probabilistic alternative of randomized smoothing.

---

## 2. Background

### 2.1 Problem Formulation

A feedforward network $f$ with $L$ layers computes

$$z^{(k)} = W^{(k)} \hat{z}^{(k-1)} + b^{(k)}, \qquad \hat{z}^{(k)} = \sigma(z^{(k)}), \qquad \hat{z}^{(0)} = x,$$

where $W^{(k)}$, $b^{(k)}$ are parameters and $\sigma$ is typically ReLU, $\sigma(z) = \max(0, z)$. Verification properties are encoded as linear constraints on the network's input and output. The canonical property is *adversarial robustness* above, but the framework also captures safety properties such as the ACAS Xu collision-avoidance specifications [1]: e.g., "if the intruder is distant and slower, the network must advise *clear-of-conflict*".

Verification algorithms fall into a well-known taxonomy [5]: *reachability* (propagate input sets through the network), *optimization* (bound the specification minimum), *search with reachability*, and *search with optimization*. A verifier is **sound** if every "robust" verdict is correct (no false negatives); it is **complete** if it additionally decides every instance given enough time — either proving robustness or producing a genuine counterexample. Soundness is non-negotiable; completeness is bought with exponential cost.

### 2.2 Computational Complexity

> **Theorem:** Deciding whether a ReLU network is robust in an $\ell_\infty$ ε-ball is NP-complete, even for networks with a single hidden layer [2].

The hardness stems from the combinatorial structure of ReLU: each of the $n$ unstable neurons (with pre-activation interval $[l, u]$ straddling zero) is piecewise linear, and an exact verifier must in the worst case consider $2^n$ activation patterns. This complexity barrier is the organizing fact of the field: every verifier is either incomplete (fast, conservative) or complete (exact, exponential in the worst case). The remainder of the thesis is a tour of how to live with this trade-off.

### 2.3 Notation

We write $z^{(k)}_j$ for the $j$-th pre-activation neuron in layer $k$ and $\hat{z}^{(k)}_j$ for its post-activation value. Given an input set $\mathcal{X}$, a verifier maintains for each neuron an interval $[l^{(k)}_j, u^{(k)}_j]$ of attainable values — *concrete bounds* — and possibly linear symbolic bounds $a \le z \le b$ as affine functions of input or earlier neurons.

---

## 3. Methodology

Our methodology is constructive and comparative: we build each verifier from first principles, derive its relaxation, analyze its soundness argument, and locate it on the precision–efficiency spectrum. The unifying lens is *linear relaxation*: replacing the non-convex ReLU graph

$$S = \{(z, \hat{z}) : \hat{z} = \max(0, z), \, l \le z \le u\}$$

with a convex over-approximation $S \subseteq \hat{S}$. If the verification property holds over $\hat{S}$, it holds over $S$ — the soundness argument used by every incomplete verifier in this thesis. Tightness of $\hat{S}$ governs precision; the cost of computing bounds over $\hat{S}$ governs scalability.

We structure incomplete verifiers by their abstraction domain:

| Verifier | Domain | Cost per neuron | Tightness |
|---|---|---|---|
| IBP | Intervals (boxes) | $O(1)$ | Loose |
| DeepZ / DeepPoly | Zonotopes / polyhedra | $O(n^2)$–$O(n^3)$ | Medium |
| CROWN / α-CROWN | Linear bounds (backpropagated) | $O(n^2)$ GPU | Tight |
| β-CROWN | CROWN + per-neuron split constraints | $O(n^2)$ GPU | Tighter under splits |

Complete verifiers then wrap these incomplete engines in search: Reluplex's simplex-with-ReLU-pivoting, Marabou's extended simplex, or the now-dominant *branch-and-bound* (BaB) framework [6].

---

## 4. Deep Dive

### 4.1 Interval Bound Propagation: The Minimal Sound Abstraction

Interval Bound Propagation (IBP) [3] is the simplest sound verifier and the workhorse of certified training. Given input intervals $[x_{0,j} - \varepsilon, x_{0,j} + \varepsilon]$, IBP propagates intervals forward layer by layer. For an affine map, interval arithmetic gives

$$[l', u'] = W^+ [l, u] + W^- [u, l] + b,$$

where $W^+$ and $W^-$ are the positive and negative parts of $W$. For ReLU, $[\max(0, l), \max(0, u)]$. The appeal is clear: forward propagation is $O(\text{network size})$, trivially GPU-parallel, and *differentiable*, so IBP bounds can be plugged directly into a training loss.

```python
def ibp_forward(Ws, bs, x0, eps):
    """Sound interval bounds for an MLP under L_inf perturbation eps."""
    l = x0 - eps; u = x0 + eps
    for W, b in zip(Ws, bs):
        Wp, Wn = np.maximum(W, 0), np.minimum(W, 0)
        l, u = Wp @ l + Wn @ u + b, Wp @ u + Wn @ l + b
        l, u = np.maximum(l, 0), np.maximum(u, 0)  # ReLU
    return l, u
```

The cost is *wrapping*: intervals discard all cross-neuron correlation, so bounds explode with depth. IBP-verified networks routinely achieve high certified accuracy on MNIST (78% at small ε [7]) yet provide almost no certification on CIFAR-10 with deeper nets, because the relaxation error compounds exponentially. The lesson is twofold: IBP is an excellent *training* regularizer but a weak *post hoc* verifier.

### 4.2 The Triangle Relaxation and CROWN

CROWN (Certified Robustness for deep neural Networks) [4] propagates *linear* bounds backward, keeping correlation. The key object is the convex hull of the ReLU graph over $[l, u]$ (with $l < 0 < u$), the *triangle relaxation*:

> **Theorem:** The convex hull of $\{(z, \max(0,z)) : l \le z \le u\}$, $l < 0 < u$, is the polytope
> $$\hat{z} \ge 0, \qquad \hat{z} \ge z, \qquad \hat{z} \le \tfrac{u}{u-l}\,(z - l).$$

The upper bound is the chord joining $(l, 0)$ and $(u, u)$; it is the *tightest* single linear upper bound (in the sense of minimal area of the relaxation). CROWN's innovation is algorithmic: given a linear specification on the output, it propagates a linear bound backward through each layer, choosing at every unstable ReLU the tightest available relaxation and *concretizing* intermediate bounds with cheap IBP passes. Concretely, to bound $f_c(x) - f_i(x) \ge A x + b$ over the input ball, one step of backward propagation through layer $k$ replaces $A^{(k)} z^{(k)}$ with $A^{(k-1)} z^{(k-1)} + b^{(k-1)}$ using the relaxed activation. The final bound $\min_{x \in B_\infty} (Ax + b)$ is a closed-form expression — an $\ell_\infty$ ball against a linear function.

The price is the choice of lower bound: CROWN's original formulation fixes the lower relaxation to the line through $(l, 0)$–$(u,u)$ with slope $0$ or $1$ ("adaptive" variants). This motivates the next step.

### 4.3 α-CROWN: Optimizing the Relaxation Itself

α-CROWN [6] observes that the triangle's lower face need not be fixed: any line through the origin with slope $\alpha \in [0, 1]$ is a valid lower bound, since $\alpha z \le \max(0, z)$ on $[l, u]$. By treating each neuron's $\alpha^{(k)}_j$ as a *free parameter* and optimizing the final concrete bound via projected gradient ascent on the GPU (auto_LiRPA), the verifier tightens itself:

$$\max_{\alpha \in [0,1]^n}\; \min_{x \in B_\infty(x_0,\varepsilon)} \; A(\alpha)\,x + b(\alpha).$$

This is a small, smooth optimization whose gradients flow through the entire backward-propagation computation. α-CROWN strictly dominates CROWN and, on many benchmarks, rivals LP-based verifiers at a fraction of the cost — the empirical sweet spot of precision and efficiency that made it the bounding engine inside the competition-winning α,β-CROWN [6].

### 4.4 β-CROWN and Complete Verification by Branch-and-Bound

Complete verification requires *search*. The branch-and-bound (BaB) scheme [6] maintains a global lower bound on the specification minimum (from an incomplete verifier) and an upper bound (from attacks or random sampling, i.e., candidate counterexamples). It recursively *splits* the problem — classically, on an unstable ReLU $j$, into the subdomains $\{z_j \le 0\}$ and $\{z_j \ge 0\}$ — recomputes bounds on each subdomain, and prunes subdomains whose lower bound is positive.

β-CROWN [6] is the crucial insight that BaB splits need not be handled by an expensive LP solver: per-neuron split constraints ($z_j \ge 0$ or $z_j \le 0$ along the current branch) can be encoded directly as additional Lagrangian terms inside the CROWN backward pass. With multipliers $\beta^{(k)}_j \ge 0$ optimized by gradient ascent alongside $\alpha$, the incomplete verifier *internalizes* the branch constraints:

$$\min_{x \in \mathcal{X}}\; A x + b + \sum_{j \in \mathcal{Z}^+} \beta_j z_j \;\le\; \min_{\text{split constraints}}\; g(x).$$

The result is a complete verifier running entirely on GPU, with bound computations parallelizable across subdomains. α,β-CROWN won VNN-COMP 2023 and 2024 [7]. Its completeness argument is clean: splitting eventually reduces every subdomain to a linear region (all ReLUs fixed), where the linear relaxation is exact; with a fair branching schedule, the gap between global lower and upper bounds closes, and the verdict is exact.

Branching heuristics matter enormously. Modern BaB uses *strong branching* estimates: the FSB (filtered smart branching) heuristic scores candidate neurons by the estimated bound improvement from splitting, approximated cheaply via the very linear bounds CROWN already computed. Cutting planes (GCP-CROWN) add valid inequalities derived from the network's own constraints, pruning fractional regions of the relaxation without splitting — the verification analogue of cutting-plane methods in mixed-integer programming.

### 4.5 The SMT Lineage: Reluplex and Marabou

Before BaB dominated, the SMT community's Reluplex [1] extended the simplex algorithm with *ReLU pivoting*: variables for pre- and post-activation values are kept in the tableau, and ReLU violations ($ \hat{z} \ne \max(0, z)$) are repaired by pivoting or by case-splitting, mirroring DPLL(T). Marabou [1] generalized this to a full framework supporting piecewise-linear activations, network-level reasoning (abstraction, symbolic bound tightening), and parallel splitting strategies. On the ACAS Xu benchmarks, Marabou proved safety properties of real collision-avoidance networks — a landmark demonstration that formal methods could touch deployed deep learning [1]. The BaB revolution did not obsolete this lineage; modern verifiers hybridize, using Marabou-style symbolic tightening inside BaB nodes.

---

## 5. Empirical Results and Proofs

### 5.1 VNN-COMP: The Competition as Experiment

The International Verification of Neural Networks Competition (VNN-COMP) [7] is the field's shared empirical ground: standardized benchmarks (MNIST/CIFAR fully-connected and convolutional networks, ACAS Xu, NN4Sys, vision transformers) with per-instance timeouts and scoring by verified instances. Recent editions show a clear hierarchy:

1. **α,β-CROWN / NeuralSAT** (bound-propagation + BaB/SAT hybrids) dominate, verifying hundreds of instances per benchmark suite within minutes [7].
2. **Pure incomplete verifiers** (IBP, vanilla CROWN) are orders of magnitude faster per bound but verify far fewer instances at interesting ε.
3. **SMT/MILP verifiers** (Marabou, MIPVerify) remain competitive on small networks and structured properties like ACAS Xu.

A representative datapoint from attack-guided α,β-CROWN studies: on MNIST, certified training with IBP attains ~78% certified accuracy at $\varepsilon = 0.1$, while on CIFAR-10 the same recipe collapses and PGD adversarial training dominates with ~94% "certification" only at very small perturbations — certification success is fundamentally dataset- and training-dependent [7].

### 5.2 Certified Training: Co-Designing Verifiable Networks

A network trained without verification in mind is typically *unverifiable*: its relaxations are too loose for any incomplete verifier. Certified training closes this gap by optimizing a verifiable upper bound on the adversarial loss. Three generations:

- **COLT** (Convex Layerwise adversarial Training): layerwise convex relaxations trained with a curriculum of increasing ε.
- **SABR** (Small Boxes for certified Robustness): propagates a small IBP box around adversarially chosen points, interpolating between empirical and certified objectives.
- **TAPS** (Training with Adversarial Propagation through Sound bounds): splits the network, using PGD attacks on early layers and IBP on later ones, multiplying their strengths.

The theoretical payoff is a *certified accuracy*: the fraction of test points for which the verifier proves robustness — a rigorous lower bound on true robust accuracy, unlike PGD accuracy which is merely an upper bound. The persistent cost is clean-accuracy degradation: certified networks trail standard ones by several points, the "price of provability."

### 5.3 Randomized Smoothing: A Probabilistic Alternative

Randomized smoothing [8] sidesteps NP-completeness by changing the question. Given a base classifier $f$, define the smoothed classifier $g(x) = \arg\max_c \mathbb{P}_{\delta \sim \mathcal{N}(0,\sigma^2 I)}[f(x+\delta) = c]$. The Neyman–Pearson lemma then yields a *certified radius* $R = \frac{\sigma}{2}(\Phi^{-1}(p_A) - \Phi^{-1}(p_B))$ within which $g$'s prediction is provably constant [8]. The guarantee is probabilistic (over the Monte Carlo estimation of $p_A, p_B$) and applies to the smoothed, not the original, classifier — but it scales to ImageNet-scale networks where deterministic verification is hopeless. It is the right tool when soundness must be traded for scale.

---

## 6. Limitations

No honest treatment omits the field's hard limits:

1. **Scalability wall.** Complete verification remains exponential in the worst case; even α,β-CROWN struggles beyond medium networks at meaningful ε on CIFAR-10/ImageNet. The number of unstable neurons, not parameter count, is the true complexity measure — deep, narrow networks can be harder than wide, shallow ones.
2. **Threat-model myopia.** Nearly all certification is $\ell_p$-ball robustness, a poor proxy for real-world distribution shift, semantic perturbations, or physical attacks. A certified $\ell_\infty$ radius of $2/255$ says little about a rotated stop sign.
3. **Specification bottleneck.** Verification proves properties *as specified*; ACAS Xu-style properties required domain experts to write down. For LLMs and generative models, even stating the right property is an open problem — current work on transformer verification handles toy-scale models and simple robustness specs [7].
4. **Incomplete-verifier looseness.** Triangle relaxations are optimal per-neuron but globally loose; multi-neuron relaxations (k-ReLU, PRIMA) tighten at steep computational cost.
5. **Probabilistic vs. deterministic gap.** Randomized smoothing's guarantees hold for a randomized classifier and degrade under distribution shift of the noise model — a weaker, if far more scalable, notion of "certified."

---

## 7. Conclusion

Certified robustness has matured from Reluplex's first SMT proofs on ACAS Xu to GPU-accelerated branch-and-bound systems that win international competitions. The intellectual core is stable and elegant: *convex relaxation of non-convex computation*, from IBP's intervals through CROWN's triangle to α,β-CROWN's optimized bound propagation, lifted to completeness by branch-and-bound search. Certified training co-designs networks to be verifiable, VNN-COMP measures progress honestly, and randomized smoothing offers a pragmatic probabilistic escape hatch when determinism cannot scale.

The frontier is clear: verification of transformers and large language models, richer specifications beyond $\ell_p$ balls, and tighter multi-neuron relaxations that preserve GPU efficiency. The deeper lesson endures — in safety-critical machine learning, a test set is an anecdote; only a proof is a guarantee.

---

## References

[1] G. Katz, C. Barrett, D. Dill, K. Julian, and M. Kochenderfer. "Reluplex: An Efficient SMT Solver for Verifying Deep Neural Networks." *Proc. CAV*, 2017. https://arxiv.org/abs/1702.01135
[2] G. Katz et al. "The Marabou Framework for Verification and Analysis of Deep Neural Networks." *Proc. CAV*, 2019. https://doi.org/10.1007/978-3-030-25540-4_26
[3] E. Wong and Z. Kolter. "Provable Defenses against Adversarial Examples via the Convex Outer Adversarial Polytope." *Proc. ICML*, 2018.
[4] H. Zhang et al. "Efficient Neural Network Robustness Certification with General Activation Functions." *Proc. NeurIPS*, 2018.
[5] C. Liu et al. "Algorithms for Verifying Deep Neural Networks." *Foundations and Trends in Optimization*, 4(3–4):244–404, 2021. https://doi.org/10.1561/2400000035
[6] S. Wang et al. "Beta-CROWN: Efficient Bound Propagation with Per-Neuron Split Constraints for Neural Network Robustness Verification." *Proc. NeurIPS*, 2021. http://arxiv.org/pdf/2103.06624v2
[7] C. Brix et al. "The Fourth International Verification of Neural Networks Competition (VNN-COMP 2023)." *Proc. SAIV*, 2023; and 2024 edition reports.
[8] J. Cohen, E. Rosenfeld, and Z. Kolter. "Certified Adversarial Robustness via Randomized Smoothing." *Proc. ICML*, 2019.
[9] C. Szegedy et al. "Intriguing Properties of Neural Networks." *Proc. ICLR*, 2014.
[10] A. Athalye, N. Carlini, and D. Wagner. "Obfuscated Gradients Give a False Sense of Security." *Proc. ICML*, 2018.
[11] H. Zhang et al. "General Cutting Planes for Bound-Propagation-Based Neural Network Verification." *Proc. NeurIPS*, 2022.
[12] S. Deshmukh, V. Savin, and K. Arya. "Veriphi: Attack-Guided Neural Network Verification with Dataset-Dependent Training Methods." 2026. https://arxiv.org/pdf/2606.18454.pdf
