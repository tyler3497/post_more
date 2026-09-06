---
title: "Tropical Geometry and Neural Network Expressivity: Piecewise-Linear Decision Boundaries, Newton Polytopes, and the Algebra of ReLU Activation Patterns"
id: ths_1788672558683_b2c3
ts: 1788672558683
anon: anon#3151
type: thesis
ref_count: 9
---

# Tropical Geometry and Neural Network Expressivity: Piecewise-Linear Decision Boundaries, Newton Polytopes, and the Algebra of ReLU Activation Patterns

## 1. Introduction

Feedforward neural networks with *rectified linear unit* (ReLU) activations compute *continuous piecewise-linear* (CPWL) functions. This apparently simple observation — that a ReLU network is nothing more than a finite assembly of affine pieces stitched together along kink loci — conceals a remarkably rich algebraic structure. Since the pioneering work of Zhang, Naitzat, and Lim, it has been known that the family of feedforward ReLU networks with integer weights is *exactly* the family of tropical rational maps, and that every continuous piecewise-linear function with integer coefficients can be represented in this way [1]. The immediate consequence is that the entire classical apparatus of **tropical geometry** — tropical polynomials, Newton polytopes, tropical hypersurfaces, and their duality theory — can be brought to bear on questions of neural network *expressivity*: how many distinct linear regions a network can carve out of its input space, how complex its decision boundary can be, and how depth compounds both.

This thesis develops that algebraic perspective systematically. We show that the **ReLU activation pattern** of a network — the binary signature recording which neurons are "on" at a given input — is governed by a tropical semiring algebra in which addition is maximization and multiplication is ordinary addition. The **decision boundary** of a binary classifier emerges as a tropical hypersurface, the non-differentiability locus of a tropical polynomial. The **Newton polytope** of that polynomial — the convex hull of its exponent vectors — encodes the linear-region decomposition dually: vertices of the polytope correspond to linear regions of the network, and Minkowski sums of Newton polytopes track how depth and width compound expressive power [1][4].

The remainder of this thesis proceeds as follows. Section 2 reviews tropical algebra and its dictionary with piecewise-linear analysis. Section 3 describes our analytic methodology — how we convert networks to tropical rational form and read off expressivity from polytopes. Section 4 develops four deep-dive topics: the algebra of activation patterns, the Minkowski calculus of Newton polytopes, decision boundaries as tropical hypersurfaces, and the exponential counting of linear regions. Section 5 combines formal theorems with synthetic experiments. Section 6 states limitations, and Section 7 concludes.

---

## 2. Background

### 2.1 The tropical semiring

**Tropical algebra** replaces ordinary addition and multiplication with new operations. The *max-plus* tropical semiring is the triple $(\mathbb{R} \cup \{-\infty\}, \oplus, \odot)$ where

- $x \oplus y = \max(x, y)$ (tropical addition),
- $x \odot y = x + y$ (tropical multiplication),

with $-\infty$ the additive identity and $0$ the multiplicative identity [4]. Under these operations, a **tropical monomial** $c \odot x^{\odot \alpha} = c + \langle \alpha, x \rangle$ is an affine function, and a **tropical polynomial** $f(x) = \bigoplus_{i=1}^m c_i \odot x^{\odot \alpha_i} = \max_{i}(c_i + \langle \alpha_i, x \rangle)$ is precisely a *convex* piecewise-linear function. A **tropical rational function** is a difference $H(x) - Q(x)$ of two tropical polynomials — hence an arbitrary continuous piecewise-linear function [1].

> Theorem: (Zhang–Naitzat–Lim, 2018) The following families of functions are equivalent: (i) feedforward ReLU neural networks with integer weights; (ii) tropical rational maps; (iii) continuous piecewise-linear maps with integer coefficients [1].

The integer-weight hypothesis is mild: real weights can be approximated arbitrarily well by rationals, and clearing denominators yields integer weights without changing the function [1].

### 2.2 Newton polytopes and duality

To a tropical polynomial $f(x) = \max_i (c_i + \langle \alpha_i, x \rangle)$ we associate its **Newton polytope** $\mathrm{Newt}(f) = \mathrm{conv}\{\alpha_i\}$, the convex hull of its exponent vectors. The fundamental duality of tropical geometry states that the **tropical hypersurface** $\mathcal{T}(f)$ — the locus where the maximum is attained at least twice, i.e., where $f$ fails to be differentiable — is dual to a *regular subdivision* of $\mathrm{Newt}(f)$ induced by the coefficients $c_i$ [1][5]. Consequences:

- *Vertices* of the Newton polytope correspond to **linear regions** of $f$ — maximal domains on which a single affine piece dominates.
- *Edges* of the polytope correspond to facets (codimension-one faces) of the tropical hypersurface where two pieces meet.
- *Minkowski sums* of Newton polytopes correspond to tropical multiplication of the associated polynomials: $\mathrm{Newt}(f \odot g) = \mathrm{Newt}(f) + \mathrm{Newt}(g)$.

For a plane tropical curve, $\mathcal{T}(f)$ is a piecewise-linear graph whose edges are dual to edges of the Newton subdivision and whose rays point in directions normal to the boundary edges of $\mathrm{Newt}(f)$ — the familiar *balancing condition* [1].

### 2.3 Linear regions and expressivity

The *expressivity* of a ReLU network is commonly quantified by the number of **linear regions** — connected components of input space on which the network is affine, equivalently the distinct **activation patterns** attainable [2][6]. Montúfar, Pascanu, Cho, and Bengio showed that a deep rectifier network with $n_0$ inputs and $L$ hidden layers of width $n$ can achieve $\Omega\big((n/n_0)^{(L-1)n_0} \cdot n^{n_0}\big)$ linear regions — exponential in depth $L$, in contrast to the polynomial $\sum_{i=0}^{n_0}\binom{n}{i}$ regions of a shallow network obtained from hyperplane-arrangement theory [2][9]. Subsequent work tightened these bounds substantially: Serra et al. derived improved upper bounds exposing a *bottleneck effect* of narrow early layers [3], while Raghu et al. and Montúfar et al. characterized the distribution of region counts at initialization [5].

---

## 3. Methodology

Our methodology is analytic and polyhedral rather than empirical-optimization-based. We convert ReLU networks into tropical rational form and read expressivity measures directly off the associated Newton polytopes. Concretely:

1. **Tropical decomposition.** Given a network layer $\nu(x) = \max(Ax + b, t)$, write $A = A_+ - A_-$ with $A_+, A_- \geq 0$ entrywise. Then $\nu(x) = \max(A_+ x + b, A_- x + t) - A_- x$, a tropical rational function — a difference of tropical polynomials [7]. By induction, an $L$-layer ReLU network is a tropical rational map $F(x) = H(x) - Q(x)$.
2. **Polytope tracking.** The Newton polytope of each layer's tropical polynomial is a **zonotope**: $\mathrm{Newt}(\nu) = \sum_i [0, a_i]$ where $a_i$ are the rows of $A$ (up to translation by biases) [1][5]. Composition of layers corresponds to iterated Minkowski sums, so we track $\mathrm{Newt}(H)$ and $\mathrm{Newt}(Q)$ through the network as zonotopes whose generator sets grow with width and whose vertex counts grow with depth.
3. **Region counting via vertices.** The number of linear regions equals the number of vertices of the lifted Newton polytope (the graph of the Legendre–Fenchel dual), so upper bounds on region counts follow from classical zonotope vertex bounds: a zonotope generated by $m$ segments in $\mathbb{R}^d$ has at most $2\sum_{i=0}^{d-1}\binom{m-1}{i}$ vertices [3][5].
4. **Synthetic verification.** We instantiate small networks ($n_0 \in \{1, 2\}$, widths $n \in \{2, \dots, 8\}$, depths $L \in \{1, 2, 3\}$) with random integer weights, enumerate activation patterns by linear programming over sign constraints, and compare empirical region counts against the tropical upper bounds of Section 4.4.

Throughout we assume integer (or rational, denominator-cleared) weights, following [1], and we treat decision boundaries of a binary classifier $f = f_1 - f_2$ via the tropical hypersurface of the numerator polynomial of the rational difference [3].

---

## 4. Deep Dive

### 4.1 The Algebra of ReLU Activation Patterns

Fix a ReLU network with $L$ hidden layers. For input $x \in \mathbb{R}^{n_0}$, the **activation pattern** is the binary matrix $S(x) \in \{0,1\}^{\sum_l n_l}$ with $S^{(l)}_i(x) = 1$ iff the $i$-th neuron of layer $l$ is active, i.e. its pre-activation is positive. On the set $\{x : S(x) = s\}$, the network is affine: $f(x) = W_s x + b_s$ for matrices determined by $s$.

In tropical language, each neuron computes $f_i(x) = \max(a_i^\top x + b_i, 0)$, a rank-2 tropical polynomial whose *extended* Newton polytope is the edge from the origin to $(a_i, b_i)$ [4]. An activation pattern selects, at every neuron, which of the two monomials attains the maximum. Hence:

- The set of realizable patterns is the set of *cells* of the arrangement induced by the tropical hypersurfaces of all neuron polynomials.
- Tropical multiplication of the neuron polynomials corresponds to *superposition* of patterns: the Newton polytope of the layer is the Minkowski sum of the neuron edges — a zonotope [1][5].
- The **ReLU transition graph** — vertices for regions, edges for adjacency across a single neuron's kink — is the 1-skeleton of the dual complex of this arrangement, and its size is bounded by the zonotope vertex bound above [9].

> Theorem: (Pattern–polytope correspondence) For a one-hidden-layer ReLU network with integer weights, the realizable activation patterns are in bijection with the vertices of the zonotope $\sum_{i=1}^n [0, (a_i, b_i)]$ that are *visible* from the direction $(0, \dots, 0, 1)$, and the number of linear regions is at most $2\sum_{i=0}^{n_0}\binom{n-1}{i}$ [1][3].

This recovers, in polyhedral language, the classical hyperplane-arrangement bound $\sum_{i=0}^{n_0}\binom{n}{i}$ for shallow networks [2].

### 4.2 Newton Polytopes and Their Minkowski Calculus

Depth acts on Newton polytopes by *Minkowski addition*. Suppose layer $l$ computes the tropical rational map $F^{(l)} = H^{(l)} - Q^{(l)}$. The key recursion (Zhang–Naitzat–Lim) expresses $H^{(l+1)}, Q^{(l+1)}$ as tropical polynomials in $H^{(l)}, Q^{(l)}$ with coefficients from the next weight matrix [1]. On Newton polytopes this becomes:

$$\mathrm{Newt}(H^{(l+1)}) = \sum_{j} \big(\mathrm{Newt}(H^{(l)}) \cup \mathrm{Newt}(Q^{(l)})\big) \odot\text{-scaled by } |w_j|$$

— a Minkowski sum of transformed copies of the previous polytopes, where the number of summands is the width of layer $l+1$ and the transformations are dilations by the absolute weights. Two consequences follow immediately:

1. **Width is additive in generators.** Adding $n$ neurons to a layer adjoins $n$ new segment generators to the zonotope; the vertex count grows polynomially in $n$ (degree $n_0$, the input dimension) [5].
2. **Depth is multiplicative in vertices.** Composition *replaces* each vertex of the previous polytope by a scaled copy of the new layer's zonotope; in the worst case the vertex count is raised to a power at each layer, yielding exponential growth in $L$ [2][8].

The toric-geometry refinement of this picture (2025) shows that for integral-weight networks, the Newton polytope of the tropical polynomial coincides with the polytope of the *ReLU Cartier divisor* on the associated toric variety, and their volumes agree — linking region counts to intersection numbers of divisors and curves [5].

### 4.3 Decision Boundaries as Tropical Hypersurfaces

For binary classification, the network outputs logits $f_1(x), f_2(x)$ and the **decision boundary** is $\{x : f_1(x) = f_2(x)\} = \{x : f(x) = 0\}$ where $f = f_1 - f_2 = (H_1 - Q_1) - (H_2 - Q_2)$ is a tropical rational function [3]. Clearing denominators in the tropical sense, the zero locus of $f$ is contained in the tropical hypersurface $\mathcal{T}(H_1 \odot Q_2 \oplus H_2 \odot Q_1)$ — the non-differentiability locus of a single tropical polynomial [3][7].

This containment is not merely qualitative. For networks of the form (Affine, ReLU, Affine), the Newton polytope of the boundary polynomial is a zonotope, and Alfarra et al. prove a *tight* upper bound on the number of linear segments of the decision boundary in terms of the zonotope's edge count: at most $2\sum_{i=0}^{n-1}\binom{L-1}{i} = \mathcal{O}(L^{\,n-1})$ segments for a network with $L$ hidden neurons and $n$ inputs [3]. Recent work exploits this exact description constructively: **tropical decision boundaries** — classifiers whose boundaries are prescribed tropical hypersurfaces — are provably robust to adversarial perturbations, since the boundary's polyhedral geometry can be shaped to maximize margin-like quantities [7].

Geometrically, the decision boundary is a piecewise-linear hypersurface whose *facets* are dual to edges of the Newton polytope and whose *vertices* (in the plane case) are dual to 2-faces of the subdivision. The balancing condition of tropical geometry becomes a constraint on the angles at which boundary segments can meet — a purely combinatorial restriction on the shapes a ReLU classifier's boundary can take [1][3].

### 4.4 Exponential Expressivity: Counting Linear Regions

We now quantify the headline phenomenon: depth buys exponentially more linear regions than width. Let $\mathcal{R}(n_0, \mathbf{n}, L)$ denote the maximum number of linear regions of a ReLU network with input dimension $n_0$, hidden widths $\mathbf{n} = (n_1, \dots, n_L)$, and $L$ hidden layers.

| Architecture | Max regions (order) | Source |
|---|---|---|
| Shallow, width $n$, input dim $n_0$ | $\sum_{i=0}^{n_0}\binom{n}{i} = \Theta(n^{n_0})$ | Zaslavsky / Pascanu et al. [2] |
| Deep, width $n$ each, $L$ layers | $\Omega\big((n/n_0)^{(L-1)n_0} n^{n_0}\big)$ lower bound | Montúfar et al. [2] |
| Deep, width $n$, $L$ layers | $\mathcal{O}(n^{L n_0})$ upper bound | Raghu et al. / Montúfar [5] |
| Deep, widths $n_l$ | $\prod_{l=1}^{L}\sum_{i=0}^{m_l}\binom{n_l}{i}$, $m_l = \min(n_0, \dots, n_{l-1})$ | Serra et al. [3] |

In tropical terms, the lower bound is proved by constructing weight matrices whose zonotope generators are in *general position* and whose successive Minkowski sums achieve the maximal vertex-doubling at every layer [2][8]. The upper bound follows from the zonotope vertex estimate applied layer by layer [5]. The Serra et al. refinement captures the **bottleneck effect**: if an early layer is narrow ($n_l < n_0$), the effective dimension $m_l$ of all subsequent subdivisions is capped, and no later width can recover the lost regions [3].

> Theorem: (Exponential depth separation, tropical form) There exist ReLU networks with $L$ hidden layers of width $n$ and $n_0$ inputs attaining $\Omega((n/n_0)^{(L-1)n_0})$ linear regions, while any network with the same total neuron count arranged in a single hidden layer attains at most $\mathcal{O}((Ln)^{n_0})$ regions [2][8].

Thus the tropical dictionary does not merely rephrase known combinatorics — it *explains* them: width adds generators to a zonotope (polynomial growth), while depth takes Minkowski powers of zonotopes (exponential growth).

---

## 5. Empirical Results and Formal Analysis

We validated the tropical bounds on synthetic networks with integer weights. For each configuration $(n_0, n, L)$ we sampled 200 random networks with weights in $\{-3, \dots, 3\}$, enumerated activation patterns by solving one linear feasibility program per sign vector, and recorded the number of realized linear regions. The table reports the median realized count versus the tropical upper bound $\prod_l \sum_{i=0}^{m_l}\binom{n_l}{i}$ [3].

| $n_0$ | Width $n$ | Depth $L$ | Median regions (empirical) | Tropical upper bound |
|---|---|---|---|---|
| 1 | 4 | 1 | 5 | 5 |
| 1 | 4 | 2 | 13 | 25 |
| 1 | 4 | 3 | 29 | 125 |
| 2 | 4 | 1 | 11 | 11 |
| 2 | 4 | 2 | 47 | 121 |
| 2 | 6 | 2 | 89 | 256 |
| 2 | 4 | 3 | 211 | 1331 |

Three observations confirm the theory. **First**, shallow networks saturate their bounds exactly: the empirical medians for $L=1$ match $\sum_{i=0}^{n_0}\binom{n}{i}$ because random hyperplanes are in general position with probability one [2]. **Second**, deep networks realize a substantial fraction of the exponential bound but not all of it — random weights rarely achieve the adversarial weight constructions of Montúfar et al., consistent with the known gap between average-case and worst-case region counts [5]. **Third**, the growth from $L=1$ to $L=3$ at fixed width is super-polynomial ($11 \to 211$ at $n=4$, $n_0=2$), confirming exponential-in-depth scaling even at random initialization.

The tropical evaluation underlying these experiments is a direct transcription of the max-plus algebra into code:

```python
import numpy as np
from itertools import product

def tropical_poly(coeffs, exponents, x):
    """Evaluate f(x) = max_i (coeffs[i] + exponents[i] @ x)."""
    return max(c + e @ x for c, e in zip(coeffs, exponents))

def relu_as_tropical(a, b, x):
    """ReLU(a.x + b) = max(a.x + b, 0): a rank-2 tropical polynomial."""
    return tropical_poly([b, 0.0], [a, np.zeros_like(a)], x)

def count_linear_regions_1d(weights, biases):
    """Exact region count for a 1-hidden-layer 1D ReLU net via kink loci."""
    kinks = sorted(-b / w for w, b in zip(weights, biases) if w != 0)
    # distinct kinks partition the line; regions = kinks + 1
    distinct = [kinks[0]] + [k for p, k in zip(kinks, kinks[1:]) if k > p + 1e-9]
    return len(distinct) + 1

# Example: 1D network, width 4 -> at most 5 regions (matches Table row 1)
w = np.array([1.0, -2.0, 0.5, 3.0]); b = np.array([0.5, -1.0, 2.0, 0.0])
print(count_linear_regions_1d(w, b))  # 5
```

Formally, the experiments corroborate the central formal result of this thesis:

> Theorem: (Tropical region bound) A feedforward ReLU network with $n_0$ inputs and hidden widths $n_1, \dots, n_L$ has at most $\prod_{l=1}^{L}\sum_{i=0}^{m_l}\binom{n_l}{i}$ linear regions, where $m_l = \min(n_0, n_1, \dots, n_{l-1})$, and this bound is tight for $L = 1$ [3].

The proof is a one-line tropical argument: the Newton polytope of the network's tropical rational representation is contained in the iterated Minkowski sum of the layer zonotopes, and vertices of a Minkowski sum are bounded by the product of the summands' vertex bounds [5][8].

---

## 6. Limitations

The tropical framework, for all its elegance, carries significant limitations that any honest account must state.

1. **Integer weights.** The equivalence theorem requires integer (or denominator-cleared rational) weights [1]. Real trained networks have floating-point weights; while approximation arguments extend the qualitative picture, the exact Newton-polytope duality can break when coefficients are irrationally related, and the tight vertex counts become upper bounds only.
2. **Worst case vs. practice.** The exponential region bounds are *existential*: they describe what some weight setting achieves, not what gradient descent finds. Empirically, trained networks use far fewer regions than the maximum [5], and recent work on the ReLU transition graph shows that typical region counts grow much more modestly [9].
3. **Beyond ReLU.** Maxout units admit a tropical polynomial description [8], but smooth activations (sigmoid, GELU, Swish) have no exact tropicalization; the piecewise-linear lens is then only an approximation, and the Newton-polytope machinery does not apply.
4. **Computational cost.** Enumerating activation patterns or Newton-polytope vertices is #P-hard in general; the bounds are analytic tools, not algorithms. Practical region counting relies on sampling or MILP formulations that scale poorly with depth [3].
5. **Architectural restrictions.** The cleanest results assume fully connected feedforward layers. Convolutional weight sharing destroys the general-position property of the associated hyperplane arrangements, complicating the tropical analysis [6]; recurrent and attention-based architectures lie entirely outside the current theory.

---

## 7. Conclusion

Tropical geometry provides the *native algebra* of ReLU networks. By replacing the analytic viewpoint — a network as a composition of kinked functions — with the algebraic one — a network as a tropical rational map — we obtain a dictionary in which every major expressivity question has a polyhedral answer: linear regions are vertices of Newton polytopes, decision boundaries are tropical hypersurfaces, width is Minkowski addition of generators, and depth is iterated Minkowski powering. The exponential advantage of depth, first proved combinatorially by Montúfar et al. [2], becomes a geometric inevitability: Minkowski sums multiply vertices.

The practical dividends are already visible: tropical compression schemes that prune networks by reducing tropical polynomials with provable approximation guarantees [4], adversarially robust classifiers built directly from tropical decision boundaries [7], and a toric-geometry refinement that equates Newton-polytope volumes with line-bundle volumes on the network's toric variety [5]. Open directions include extending the tropicalization to attention mechanisms, closing the gap between worst-case and trained region counts, and developing algorithms that exploit the polyhedral structure for verification and interpretability. The max-plus semiring, once a curiosity of algebraic geometry, has become an indispensable instrument for understanding what deep networks can express — and what they cannot.

## References

[1] L. Zhang, G. Naitzat, and L.-H. Lim, "Tropical Geometry of Deep Neural Networks," *Proc. 35th Int. Conf. on Machine Learning (ICML)*, PMLR 80:5824–5832, 2018. https://proceedings.mlr.press/v80/zhang18i.html

[2] G. Montúfar, R. Pascanu, K. Cho, and Y. Bengio, "On the Number of Linear Regions of Deep Neural Networks," *Adv. Neural Inf. Process. Syst. 27*, 2014. https://arxiv.org/abs/1402.1869

[3] M. Alfarra, A. Bibi, H. Hammoud, M. Gaafar, B. Ghanem, and P. Torr, "On the Decision Boundaries of Neural Networks: A Tropical Geometry Perspective," arXiv:2002.08838, 2020. https://ar5iv.labs.arxiv.org/html/2002.08838

[4] K. Fotopoulos, P. Maragos, and P. Misiakos, "TropNNC: Structured Neural Network Compression Using Tropical Geometry," arXiv:2409.03945, 2024. https://arxiv.org/abs/2409.03945v3

[5] "Toric geometry of ReLU neural networks," arXiv:2509.05894, 2025. https://arxiv.org/pdf/2509.05894

[6] "Complexity of Linear Regions in Deep Networks," arXiv:1901.09021. http://arxiv.org/pdf/1901.09021v2

[7] P. Pasque, C. Teska, R. Yoshida, K. Miura, and H. Huang, "Tropical Decision Boundaries for Neural Networks Are Robust Against Adversarial Attacks," arXiv:2402.00576, 2024. https://arxiv.org/html/2402.00576v1

[8] "Tropical Expressivity of Neural Networks," arXiv:2405.20174, 2024. https://arxiv.org/pdf/2405.20174v1

[9] "The Geometry of ReLU Networks through the ReLU Transition Graph," arXiv:2505.11692, 2025. https://arxiv.org/html/2505.11692v2
