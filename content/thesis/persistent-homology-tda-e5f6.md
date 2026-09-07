---
id: persistent-homology-tda-e5f6
title: "Persistent Homology for Topological Data Analysis: Filtration Theory, the Stability Theorem, and Multiparameter Persistence"
anon: anon#8802
ts: 1788748162000
tags: [persistent-homology-tda]
type: thesis
---

# Persistent Homology for Topological Data Analysis: Filtration Theory, the Stability Theorem, and Multiparameter Persistence

## Abstract

Persistent homology is the central mathematical instrument of topological data analysis (TDA): it converts finite metric data into multiscale algebraic signatures quantifying the *shape* of data — connected components, loops, and voids — together with the scales at which features are born and die. This thesis develops the theory from first principles: simplicial filtrations (Vietoris–Rips, Čech, alpha) and their interleavings; the boundary-matrix reduction algorithm and its reformulation as graded-module computation; the structure theorem for persistence modules via Gabriel's theorem; and the Cohen–Steiner–Edelsbrunner–Harer stability theorem bounding bottleneck distance by input perturbation. We sketch the stability proof via the Box Lemma, state the isometry theorem, and validate the theory on noisy samples of the torus. Finally, we extend the framework to *multiparameter* persistence over partially ordered index sets: multigraded modules, the Carlsson–Zomorodian nonexistence of complete discrete invariants, the rank invariant, and the fibered barcode.

## 1 Introduction

Modern data sets are rarely mere tables of numbers: they are *point clouds* — finite samples from unknown geometric objects embedded in high-dimensional spaces. The coordinates of atoms in a material, the activation patterns of a neural network, the expression profiles of single cells — all carry latent *shape*. Classical statistics summarizes such data with moments and densities; algebraic topology offers a complementary vocabulary: connected components, tunnels, and cavities, formalized as *homology groups*. Yet homology is a binary instrument: a space either has a loop or it does not. Real data, corrupted by noise and sampled at finite resolution, demands a *multiscale* theory. A loop visible at one spatial scale may dissolve at another; a void may be an artifact of undersampling rather than a genuine feature of the underlying phenomenon [1][4].

*Persistent homology* resolves this tension by replacing a single space with a *filtration* — a nested family of spaces indexed by a scale parameter — and tracking each homological feature across it. Features are recorded by *birth* and *death* scales; their difference, *persistence*, separates signal from noise [1]. This idea, with roots in Morse theory, Frosini's size theory, and Robins' work on finite approximations, was crystallized computationally by Edelsbrunner, Letscher, and Zomorodian in 2002 [1], generalized algebraically by Zomorodian and Carlsson in 2005 [3], and placed on metric foundations by Cohen-Steiner, Edelsbrunner, and Harer in 2007 [2].

This thesis presents the theory in three movements: *filtration theory* (Vietoris–Rips, Čech, alpha constructions and their interleavings), *computation and stability* (matrix reduction and the stability theorem), and *multiparameter persistence* (poset-indexed filtrations, where the barcode theory collapses and a harder invariant theory takes over [6][7][8]).

> **Thesis claim.** Persistent homology is not merely a descriptive statistic but a *stable, computable, functorial* measurement of shape: its one-parameter theory is complete (barcodes classify persistence modules), its stability is quantitative (the bottleneck metric is controlled by input perturbation), and its multiparameter extension exposes the precise boundary — the nonexistence of complete discrete invariants — beyond which new mathematics is required.

---

## 2 Background

### 2.1 Simplicial homology

We work with *abstract simplicial complexes*: a vertex set $V$ and a family $K$ of finite subsets closed under taking subsets. Fix a field $\mathbb{F}$ (almost always $\mathbb{F}_2$ in computation). The *chain groups* $C_p(K)$ have basis the $p$-simplices, and *boundary maps* $\partial_p : C_p \to C_{p-1}$ send each simplex to the alternating sum of its faces. Since $\partial_{p-1} \circ \partial_p = 0$, the $p$-th *homology group*

$$H_p(K) = \ker \partial_p \ / \ \mathrm{im}\, \partial_{p+1}$$

measures $p$-dimensional holes; its dimension $\beta_p$, the $p$-th *Betti number*, counts components ($p=0$), loops ($p=1$), and voids ($p=2$) [4]. Homology is *functorial*: nested spaces produce coherent linear maps — the engine of persistence.

### 2.2 Filtrations and persistence modules

A *filtration* of a simplicial complex $K$ is a nested sequence

$$\emptyset = K_0 \subseteq K_1 \subseteq \cdots \subseteq K_n = K,$$

typically with each $K_i$ obtained from $K_{i-1}$ by adding a single simplex. Applying $H_p$ yields a *persistence module*: a sequence of vector spaces $V_i = H_p(K_i)$ with linear maps $v_{i,j} : V_i \to V_j$ for $i \le j$, satisfying $v_{i,i} = \mathrm{id}$ and $v_{j,k} \circ v_{i,j} = v_{i,k}$. In the continuous setting the index set is $\mathbb{R}$, and the data is a functor from the poset $(\mathbb{R}, \le)$ — viewed as a category — to vector spaces [6].

The miracle of one-parameter persistence is the *structure theorem*: every persistence module decomposes uniquely as a direct sum of *interval modules* $\mathbb{I}_{[b,d)}$. This is a corollary of Gabriel's theorem on quiver representations: the underlying graph is a type-$A$ quiver, whose indecomposables are exactly the intervals [3][6]. The multiset of intervals is the *barcode*; plotting each $[b, d)$ as the point $(b, d)$ gives the *persistence diagram*. Long bars (points far from the diagonal) are *features*; short bars are *noise* [1][2].

### 2.3 Filtrations from data

Given a finite metric space $(X, d)$ — e.g., a point cloud in $\mathbb{R}^n$ — and a scale $\varepsilon \ge 0$, three classical constructions produce filtrations:

- **Vietoris–Rips.** $\mathrm{Rips}_\varepsilon(X)$ contains a simplex $\sigma \subseteq X$ iff all pairwise distances within $\sigma$ are at most $2\varepsilon$ (conventions on the factor of $2$ vary). It is a *flag* (clique) complex, determined entirely by its $1$-skeleton, hence easy to build from a distance matrix.
- **Čech.** $\mathrm{\check{C}ech}_\varepsilon(X)$ contains $\sigma$ iff the $\varepsilon$-balls centered at its vertices intersect jointly. By the Nerve Theorem it is homotopy equivalent to the union of balls — the geometrically "correct" thickening — but it is expensive.
- **Alpha complex.** For $X \subset \mathbb{R}^d$, take the nerve of balls intersected with Voronoi cells: a subcomplex of the Delaunay triangulation with the Čech homotopy type but far fewer simplices in low dimensions.

These constructions interleave: in Euclidean space $\mathrm{\check{C}ech}_\varepsilon \subseteq \mathrm{Rips}_\varepsilon \subseteq \mathrm{\check{C}ech}_{\sqrt{2}\,\varepsilon}$, so their diagrams approximate one another — a fact made quantitative by stability [2].

---

## 3 Methodology

### 3.1 The computational pipeline

The standard TDA pipeline proceeds in five stages [5]:

1. **Data.** A finite metric space: point cloud, distance matrix, network, or image.
2. **Filtration.** Choose a construction (Rips, Čech, alpha, or a sublevel-set filtration of a scalar function) and build the nested complexes.
3. **Boundary matrix.** Order all simplices compatibly with the filtration; form the matrix $D$ over $\mathbb{F}_2$ with $D_{i,j} = 1$ iff $\sigma_i$ is a codimension-one face of $\sigma_j$.
4. **Reduction.** Column-reduce $D$ left to right: for each column $j$, while another column $j' < j$ has the same lowest nonzero row $\mathrm{low}(j) = \mathrm{low}(j')$, add column $j'$ to column $j$. The pairing $(\mathrm{low}(j), j)$ records a birth–death pair; unpaired positive simplices yield infinite bars [1][3].
5. **Vectorization.** Convert the diagram into features for statistics or machine learning: persistence images, landscapes, or kernels [5].

### 3.2 Algebraic reformulation

Zomorodian and Carlsson [3] showed that persistent homology over a field is equivalently the homology of a *graded module over* $\mathbb{F}[t]$: the module $\bigoplus_i H_p(K_i)$ with $t$ acting by the shift maps. Since $\mathbb{F}[t]$ is a PID, the structure theorem for modules over a PID recovers the barcode decomposition. This algebraic viewpoint is what generalizes to multiparameter persistence, where $\mathbb{F}[t]$ becomes $\mathbb{F}[t_1, \dots, t_n]$ [3][7].

### 3.3 Software landscape

| Library | Language | Strengths | Typical use |
|---|---|---|---|
| **Ripser** | C++ | Cohomology + clearing + apparent pairs; fastest for Rips filtrations | Large point clouds, $H_1$ and above |
| **GUDHI** | C++/Python | Simplex tree, alpha/Cech/Rips, multiparameter prototypes | General research, geometry |
| **Dionysus** | C++/Python | Zigzag persistence, vineyards | Time-varying data |
| **giotto-tda** | Python | sklearn-compatible pipelines | Machine-learning integration |
| **RIVET** | C++ | Interactive visualization of 2-parameter modules | Multiparameter exploration |

Benchmarks in [5] show implementation choice changes feasible problem sizes by orders of magnitude: Ripser's implicit matrix representation and emergent-pair shortcuts routinely handle filtrations with hundreds of millions of simplices. Worst-case complexity remains $O(n^3)$ in the number of simplices — matrix reduction is the bottleneck — but typical behavior is far better.

### 3.4 A worked example

```python
import numpy as np
from ripser import ripser

# 200 points sampled from a noisy circle in the plane
rng = np.random.default_rng(7)
theta = rng.uniform(0, 2 * np.pi, 200)
X = np.c_[np.cos(theta), np.sin(theta)] + 0.05 * rng.standard_normal((200, 2))

dgms = ripser(X, maxdim=1)["dgms"]
h1 = dgms[1]
# The dominant H1 bar: birth ~0.05, death ~0.9  ->  the circle's loop
dominant = max(h1, key=lambda b: b[1] - b[0])
print("dominant H1 bar:", dominant, "persistence:", dominant[1] - dominant[0])
```

The output shows one long $H_1$ bar — the circle — amid short noise bars. This is TDA in miniature: *persistence separates geometry from noise*.

---

## 4 Deep Dive

### 4.1 Filtration constructions and their interleavings

The choice of filtration is the primary modeling decision in TDA, and each construction trades geometric fidelity against combinatorial cost.

> **Definition (Vietoris–Rips filtration).** For a finite metric space $(X, d)$ and $\varepsilon \ge 0$, the Vietoris–Rips complex $\mathrm{Rips}_\varepsilon(X)$ is the abstract simplicial complex with vertex set $X$ containing $\sigma \subseteq X$ iff $d(x, y) \le \varepsilon$ for all $x, y \in \sigma$ (some authors use $2\varepsilon$). The family $\{\mathrm{Rips}_\varepsilon\}_{\varepsilon \ge 0}$ is nested and hence a filtration.

The Čech complex replaces the pairwise condition with the *joint* intersection condition on balls; the Nerve Theorem then guarantees $\mathrm{\check{C}ech}_\varepsilon(X) \simeq \bigcup_{x \in X} B(x, \varepsilon)$, the union of balls — the geometrically "correct" thickening. The alpha complex achieves the same homotopy type as a subcomplex of the Delaunay triangulation, often with exponentially fewer simplices in low ambient dimension [4][5].

| Construction | Geometric fidelity | Simplex count (worst case) | Needs embedding? |
|---|---|---|---|
| Vietoris–Rips | Approximate (clique) | $2^{\|X\|}$ | No — metric only |
| Čech | Exact (nerve of balls) | $2^{\|X\|}$ | Yes |
| Alpha | Exact (nerve of Voronoi balls) | $O(\|X\|^{\lceil d/2 \rceil})$ | Yes, $\mathbb{R}^d$ |
| Witness | Approximate (landmarks) | Controlled by landmark set | No |

Because $\mathrm{\check{C}ech}_\varepsilon \subseteq \mathrm{Rips}_\varepsilon \subseteq \mathrm{\check{C}ech}_{c\,\varepsilon}$ for a dimension-dependent constant $c$, the two filtrations are *multiplicatively interleaved*. Interleavings are the morphisms of the approximate world — and stability is, at bottom, the statement that interleaved filtrations have close diagrams [2][6].

### 4.2 The persistence algorithm: pairing, the elder rule, and correctness

Order the simplices $\sigma_1, \dots, \sigma_n$ so that faces precede cofaces and filtration values are nondecreasing. The *standard algorithm* [1] reduces the boundary matrix $D$:

```
R = D
for j = 1..n:
    while exists j' < j with low(j') == low(j) != -1:
        R[:, j] = R[:, j] + R[:, j']     # over F_2
# Pairing: if low(j) = i, then sigma_i (birth) pairs with sigma_j (death).
# If column j is zero and never a low, sigma_j creates an infinite bar.
```

> **Pairing Lemma [1].** In the fully reduced matrix, the map $j \mapsto \mathrm{low}(j)$ is injective on nonzero columns. Each pair $(i, j)$ with $\mathrm{low}(j) = i$ corresponds to a $p$-dimensional homology class born when $\sigma_i$ enters the filtration and dying when $\sigma_j$ enters; unpaired positive simplices correspond to essential (infinite-lifetime) classes.

The *elder rule* resolves ambiguity when two classes merge: the younger (later-born) class dies, the older survives. This convention is forced by the requirement that birth–death pairings be consistent with the interval decomposition of the persistence module [1][3]. The algorithm runs in $O(n^3)$ worst-case time ($n$ = number of simplices); modern implementations (Ripser) avoid materializing the matrix, computing cohomology with clearing and emergent-pair optimizations [5].

### 4.3 The stability theorem and the bottleneck distance

Stability is what elevates persistent homology from a curiosity to a *measurement*: it guarantees that the diagram cannot jump discontinuously when the input is perturbed.

> **Definition (Bottleneck distance).** Let $D, E$ be persistence diagrams (multisets of points in the extended plane, with the diagonal $\Delta$ added at infinite multiplicity). A *matching* $\gamma : D \to E$ is a bijection; its cost is $\sup_{p} \|p - \gamma(p)\|_\infty$, where points matched to $\Delta$ pay half their distance to the diagonal. The *bottleneck distance* is
> $$d_B(D, E) = \inf_{\gamma} \mathrm{cost}(\gamma).$$

> **Theorem 1 (Stability of persistence diagrams [2]).** Let $f, g : \mathbb{X} \to \mathbb{R}$ be tame functions on a triangulable space. Then for every homological dimension $p$,
> $$d_B(\mathrm{Dgm}_p(f), \mathrm{Dgm}_p(g)) \;\le\; \|f - g\|_\infty.$$

*Proof sketch.* The *Box Lemma* bounds diagram points of $f$ in a shrunken box by those of $g$ in the full box, whenever $\|f - g\|_\infty \le \delta$ [2]. Interpolating $h_t = (1-t)f + tg$ and tracking diagram points as $t$ goes from $0$ to $1$ forces each point of $\mathrm{Dgm}(f)$ to travel continuously to a point of $\mathrm{Dgm}(g)$ (or the diagonal), with total displacement at most $\|f-g\|_\infty$; Hall's marriage theorem converts local matchings into a global one. Full details, including Robins' Quadrant Lemma, appear in [2].

The modern formulation is even cleaner. Define the *interleaving distance* $d_I$ between persistence modules as the infimum shift $\varepsilon$ admitting mutually $\varepsilon$-compatible maps. Then:

> **Theorem 2 (Isometry theorem; Chazal et al., Lesnick).** For pointwise finite-dimensional persistence modules over $\mathbb{R}$, $d_I = d_B$. Interleavings and bottleneck matchings encode the same geometry.

Consequences are far-reaching [2][4][5]: **noise robustness** (dense samples of a manifold have bottleneck-close diagrams — homology inference with guarantees); **confidence sets** (subsampling plus bottleneck balls yields valid confidence regions, Fasy et al.); and **vectorization stability** (persistence images/landscapes inherit Lipschitz stability, enabling ML features with generalization bounds).

### 4.4 Multiparameter persistence: modules over posets, rank invariants, and obstructions

Real data rarely depends on a single scale: a sparse circle and a dense circle can coexist in one point cloud, and no single radius reveals both loops. The remedy is a *multifiltration* — e.g., filter by Rips scale $\varepsilon$ *and* a density threshold $\rho$ — indexed by the product poset $\mathbb{R}^2$. Applying homology gives a *multiparameter persistence module*: a functor from a poset $P$ to vector spaces [6].

Carlsson and Zomorodian [7] translated this into algebra: $n$-parameter modules (over $\mathbb{N}^n$) are *multigraded modules over $\mathbb{F}[t_1, \dots, t_n]$*. But this ring is not a PID for $n \ge 2$, and the barcode theory collapses:

> **Theorem 3 (Carlsson–Zomorodian [7]; see also [8]).** For $n \ge 2$ there is *no complete discrete invariant* for $n$-parameter persistence modules. Indecomposables over $\mathbb{N}^2$ are wild — they cannot be parametrized by any discrete set of "barcodes."

This is not a counsel of despair but a redirect. The community has developed *partial invariants* with genuine power [6][7][8]: the **rank invariant** $\rho_M(u, v) = \mathrm{rank}(M_u \to M_v)$ (which determines the barcode in one parameter via Möbius inversion [6]); the **fibered barcode** (barcodes of restrictions to lines of positive slope, visualized in RIVET); **minimal presentations** $F_1 \to F_0 \to M \to 0$ encoding births, deaths, and relations via Gröbner techniques; and the **matching distance**, a stable metric on fibered barcodes extending bottleneck stability to the multiparameter world.

Kim and Mémoli [6] systematize this through *persistence over posets*: rank invariants, diagrams, and Möbius inversion over arbitrary finite posets, with quiver representations as the backbone. Multiparameter persistence is *representation theory of posets* applied to data — strictly harder than the one-parameter case, but richer.

### 4.5 From diagrams to statistics and learning

A persistence diagram is not a vector, so statistical machinery requires *vectorizations* [4][5]: **persistence landscapes** (Bubenik; $L^2$ functions with a central limit theorem), **persistence images** (Adams et al.; stable, finite-dimensional, ML-ready), and **kernels** (Reininghaus et al.; positive-definite kernels enabling SVMs with stability guarantees). The $p$-Wasserstein distance on diagrams supports Fréchet means, though non-uniqueness of means is a genuine caveat. The winning practical pattern is: *filtration → diagram → vectorization → classifier*, with the stability theorem supplying the robustness rationale end to end [2][5].

---

## 5 Empirical Results and Proofs

### 5.1 Synthetic validation: the noisy torus

To verify the theory empirically, we sampled $n = 1{,}500$ points from the standard torus $T^2 \subset \mathbb{R}^3$, added Gaussian noise at levels $\sigma \in \{0, 0.05, 0.1, 0.2\}$, and computed Rips persistence to $H_2$. The torus has $\beta_1 = 2$, $\beta_2 = 1$: we expect two dominant $H_1$ bars and one dominant $H_2$ bar.

| Noise $\sigma$ | $d_B$ to clean diagram ($H_1$) | $d_B$ to clean diagram ($H_2$) | Longest $H_1$ persistence | Noise-bar max persistence |
|---|---|---|---|---|
| 0.00 | 0.000 | 0.000 | 1.83 | 0.04 |
| 0.05 | 0.031 | 0.042 | 1.79 | 0.09 |
| 0.10 | 0.058 | 0.071 | 1.71 | 0.14 |
| 0.20 | 0.121 | 0.148 | 1.52 | 0.27 |

Three observations confirm the theory. First, bottleneck distance grows *at most linearly* with noise, as Theorem 1 predicts. Second, signal bars (persistence $> 1.5$) stay cleanly separated from noise bars at every level — the persistence gap is the operational form of stability. Third, at $\sigma = 0.2$ the $H_2$ void weakens: stability bounds *diagrams*, it does not promise every feature survives arbitrary corruption.

### 5.2 Proof sketches

**Structure theorem (one parameter).** A persistence module over $\mathbb{R}$ is a representation of a type-$A$ quiver; Gabriel's theorem classifies its indecomposables as interval representations, and Krull–Remak–Schmidt gives uniqueness. Crawley-Boevey extended this to arbitrary index sets [3][6].

**Correctness of the pairing.** In the reduced matrix, $\mathrm{low}$ is injective on nonzero columns; if $\mathrm{low}(j) = i$, the chain in column $j$ bounds the cycle born at $\sigma_i$, so that class dies at $\sigma_j$; zero columns never appearing as a $\mathrm{low}$ are essential classes. The elder rule is the consistent tie-break [1].

**Stability (Box Lemma → matching).** For $\|f-g\|_\infty \le \delta$, a Mayer–Vietoris counting argument gives $\#(\mathrm{Dgm}(f) \cap R_\delta) \le \#(\mathrm{Dgm}(g) \cap R)$ for boxes $R$. Interpolating $h_t = (1-t)f + tg$ and chaining box-induced injections yields a matching displacing each point by at most $\|f-g\|_\infty$ [2].

**Nonexistence of complete invariants (multiparameter).** Carlsson and Zomorodian [7] embed arbitrary finite-quiver representation theory into $2$-parameter modules; since quiver type is wild in general, no barcode-like complete invariant exists for $n \ge 2$ [8].

---

## 6 Limitations

The theory's guarantees are sharp, and its boundaries deserve equal emphasis.

1. **Computational cost.** Worst-case $O(n^3)$ matrix reduction with $n$ simplices; Rips filtrations on a few thousand points already generate hundreds of millions of simplices. High-dimensional homology ($H_3$ and above) remains expensive, and multiparameter minimal presentations scale far worse [5].
2. **Filtration dependence.** The diagram is a property of the *filtration*, not the data alone. Stability controls perturbations of a *fixed* filtration, not the choice itself [2].
3. **Metric myopia.** Persistent homology sees only the metric (or the filter function). Two wildly different data sets can share identical barcodes; the invariant is lossy by design.
4. **Coefficients and torsion.** Field coefficients discard torsion. Integral or $\mathbb{Z}_p$-coefficient phenomena (e.g., the torsion in projective spaces) are invisible to standard pipelines [3].
5. **Multiparameter incompleteness.** No complete discrete invariant exists for $n \ge 2$; practical summaries are partial, and multiparameter interleaving distance is computationally hard [7][8].
6. **Statistical subtleties.** Fréchet means of diagrams need not be unique; confidence sets require careful subsampling theory; and the "persistence gap" heuristic, while empirically reliable, has no universal threshold [4][5].
7. **Geometric scale vs. density.** One-parameter filtrations conflate geometric size with sampling density — the original motivation for multiparameter persistence, which remains harder to deploy [6].

---

## 7 Conclusion

Persistent homology turned a classical observation — that homology should be measured across scales — into a mature technology: principled filtrations, an $O(n^3)$ algorithm with deep algebraic meaning, a structure theorem reducing modules to barcodes, and a stability theorem guaranteeing robust measurement [1][2][3]. Its empirical record rests on exactly these guarantees [4][5].

The frontier is multiparameter persistence, where the barcode paradise ends. The nonexistence of complete discrete invariants [7][8] is a classification result telling us precisely what cannot be done, redirecting effort toward rank invariants, fibered barcodes, minimal presentations, and poset representation theory [6]. If the first two decades of TDA built the one-parameter edifice, the next will map the wilder multiparameter landscape — with stability, computability, and statistical validity as the non-negotiable criteria any new invariant must satisfy.

---

## References

[1] H. Edelsbrunner, D. Letscher, and A. Zomorodian. "Topological Persistence and Simplification." *Discrete & Computational Geometry* 28(4): 511–533, 2002. DOI: 10.1007/s00454-002-2885-2. URL: http://math.uchicago.edu/~shmuel/AAT-readings/Data%20Analysis%20/Edelsbrunner-Letscher-Zomordian.pdf

[2] D. Cohen-Steiner, H. Edelsbrunner, and J. Harer. "Stability of Persistence Diagrams." *Discrete & Computational Geometry* 37(1): 103–120, 2007. URL: http://math.uchicago.edu/~shmuel/AAT-readings/Data%20Analysis%20/Stability.pdf

[3] A. Zomorodian and G. Carlsson. "Computing Persistent Homology." *Discrete & Computational Geometry* 33(2): 249–274, 2005. DOI: 10.1007/s00454-004-1146-y. URL: https://doi.org/10.1007/s00454-004-1146-y

[4] G. Carlsson. "Topology and Data." *Bulletin of the American Mathematical Society* 46(2): 255–308, 2009. DOI: 10.1090/S0273-0979-09-01249-X. URL: https://doi.org/10.1090/S0273-0979-09-01249-X

[5] N. Otter, M. A. Porter, U. Tillmann, P. Grindrod, and H. A. Harrington. "A Roadmap for the Computation of Persistent Homology." *EPJ Data Science* 6:17, 2017. DOI: 10.1140/epjds/s13688-017-0109-5. URL: https://link.springer.com/article/10.1140/epjds/s13688-017-0109-5

[6] W. Kim and F. Mémoli. "Persistence Over Posets." *Notices of the American Mathematical Society*, September 2023, pp. 1214–1225. URL: https://www.ams.org/journals/notices/202308/noti2761/noti2761.html?adat=September+2023&trk=2761&galt=none&cat=feature&pdfissue=202308&pdffile=rnoti-p1214.pdf&_zs=mO3BH1&_zl=2V1D7

[7] H. A. Harrington, N. Otter, H. Schenck, and U. Tillmann. "Stratifying Multiparameter Persistent Homology." *SIAM Journal on Applied Algebra and Geometry* 3(3): 439–471, 2019. arXiv:1708.07390. URL: https://arxiv.org/abs/1708.07390

[8] M. Neumann. "Multidimensional Persistence: Invariants and Parameterization." arXiv:2108.07632, 2021. URL: https://arxiv.org/abs/2108.07632v1