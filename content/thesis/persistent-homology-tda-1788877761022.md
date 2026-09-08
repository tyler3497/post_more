---
id: ths_1788877761022_a3f9
title: "Topological Data Analysis with Persistent Homology: Vietoris-Rips Filtrations, Multiparameter Persistence, and Stability Theorems for Noisy Data"
anon: anon#8632
ts: 1788877761022
tags: [Thesis]
type: thesis
---

# Topological Data Analysis with Persistent Homology: Vietoris-Rips Filtrations, Multiparameter Persistence, and Stability Theorems for Noisy Data

## Abstract

Persistent homology furnishes a rigorous mathematical framework for extracting multiscale topological structure from point-cloud data: it tracks the birth and death of homological features — connected components, loops, voids — across a nested filtration of simplicial complexes, and encodes the resulting dynamics in barcodes or persistence diagrams. This thesis develops the theory from first principles — simplicial complexes, the Vietoris–Rips construction, homology with field coefficients, and the structure theorem for persistence modules — before advancing to the algebraic stability theorem of Cohen-Steiner, Edelsbrunner, and Harer, which guarantees that bottleneck perturbations of persistence diagrams are controlled by the Gromov–Hausdorff distance between input data. We then examine the multiparameter extension, where filtrations are indexed by partially ordered sets: we confront the wild representation theory of multiparameter modules, the absence of a complete discrete invariant, and the practical remedies — rank invariants, fibered barcodes, interleaving distances, and the RIVET framework — that make 2-parameter persistence computationally viable. Computational aspects, complexity bounds, software ecosystems (GUDHI, Ripser, RIVET), and open problems in stability, metric statistics, and noise-robust inference are treated in depth.

---

## 1 Introduction

Modern data analysis confronts point clouds of ever-increasing size and dimension: single-cell RNA sequencing, cosmological surveys, neural recordings, and molecular configurations all present as finite samples of spaces whose global geometry is unknown and whose natural coordinates carry no intrinsic meaning [1][2]. Classical statistical tools — clustering, principal component analysis, kernel density estimation — impose geometric or distributional assumptions that may be poorly matched to the underlying phenomenon. Topological data analysis (TDA) proceeds from a different premise: the *shape* of data, encoded in its homology, is a stable, coordinate-free invariant that survives noise, deformation, and resampling [1][3].

Homology itself, however, is fragile under naïve discretization. A single threshold at which a continuous space is approximated by a combinatorial one produces topological artifacts that depend sensitively on the chosen scale. **Persistent homology** resolves this by studying *all* scales simultaneously: a point cloud is thickened by balls of radius $\varepsilon$, and the evolution of homology as $\varepsilon$ varies is recorded as a multiset of intervals — the *barcode* — or equivalently as points in the plane — the *persistence diagram* [4][5]. Long intervals signal genuine features of the underlying space; short intervals, artifacts of sampling noise. The heuristic becomes a theorem under the *stability theorem*, which bounds the bottleneck distance between persistence diagrams by the Hausdorff or Gromov–Hausdorff distance between the data sets [6].

Yet single-parameter persistence has a fundamental limitation: it is indexed by one real parameter, forcing the analyst to collapse all other aspects of the data — density, scale, filtration type — into a single sweep. Multiparameter persistence remedies this by considering filtrations indexed by posets such as $\mathbb{R}^d$, but at a steep price: the representation theory of $d$-parameter persistence modules for $d \geq 2$ is *wild*, admitting no complete discrete invariant analogous to the barcode [7][8]. This thesis charts both the triumph and the frontier: the complete, stable, computable theory of one-parameter persistence, and the incomplete but vigorously developing theory of multiparameter persistence.

---

## 2 Background

### 2.1 Simplicial complexes and the Vietoris–Rips construction

A finite metric space $X = \{x_1, \dots, x_n\}$ carries no topology of its own. To study its shape, we embed it in a combinatorial object built from its metric: an *abstract simplicial complex* $K$ is a collection of finite subsets of a vertex set, closed under taking subsets; a $k$-simplex $\sigma = \{v_0, \dots, v_k\}$ is an abstract $k$-dimensional face. The workhorse construction in TDA is the **Vietoris–Rips complex**:

> **Definition:** Given a finite metric space $(X, d)$ and $\varepsilon \geq 0$, the Vietoris–Rips complex $\mathrm{VR}(X, \varepsilon)$ is the abstract simplicial complex whose $k$-simplices are precisely those $(k+1)$-subsets of $X$ with pairwise distances at most $\varepsilon$.

As $\varepsilon$ increases, simplices are only added, never removed, producing a nested sequence — a *filtration*:

$$\emptyset = K_0 \subseteq K_1 \subseteq \cdots \subseteq K_m = \Delta_X.$$

Each filtration value has a clear geometric interpretation: balls of radius $\varepsilon/2$ about the points merge, and the nerve of this cover is approximated by the Vietoris–Rips complex [5]. The Čech complex, defined by requiring a common $\varepsilon$-intersection rather than pairwise intersections, is homotopy equivalent to the nerve of the cover and hence to the union of balls, but is combinatorially harder to compute; the two are related by the standard interleaving $\mathrm{\check{C}}(X, \varepsilon) \subseteq \mathrm{VR}(X, \varepsilon) \subseteq \mathrm{\check{C}}(X, \sqrt{2}\,\varepsilon)$ in Euclidean space [3][5].

![Vietoris-Rips filtration at increasing radii](/thesis/ths_1788877761022_a3f9-0.webp)

### 2.2 Homology with field coefficients

For each complex $K_\varepsilon$ we compute its *simplicial homology* with coefficients in a field $\mathbb{F}$ (typically $\mathbb{F}_2$ in practice). The $k$-th homology group is $H_k(K; \mathbb{F}) = \ker \partial_k / \mathrm{im}\, \partial_{k+1}$, where $\partial_k$ is the boundary operator; its dimension $\beta_k = \dim H_k(K)$, the $k$-th *Betti number*, counts $k$-dimensional holes: $\beta_0$ counts connected components, $\beta_1$ counts independent loops, $\beta_2$ counts enclosed voids [3]. The functoriality of homology turns the filtration into a *persistence module* — a diagram of vector spaces and linear maps indexed by $\mathbb{R}$:

$$H_k(K_{\varepsilon_1}) \longrightarrow H_k(K_{\varepsilon_2}) \longrightarrow \cdots.$$

A class is **born** at $\varepsilon_b$ when it appears without antecedent, and **dies** at $\varepsilon_d$ when it becomes a boundary or merges with an older class (elder rule). The multiset of pairs $(\varepsilon_b, \varepsilon_d)$ is the persistence diagram $D_k$, and the same information as intervals is the barcode [4][5].

### 2.3 The structure theorem

The foundational algebraic result is due to Zomorodian–Carlsson (2005) and Crawley-Boevey (2015): under mild tameness conditions, a one-parameter persistence module decomposes uniquely as a direct sum of *interval modules* $\mathbb{I}_{[b,d)}$, each contributing one bar $[b, d)$ [5][9]. This is the theorem that makes the barcode a *complete* invariant of 1-parameter persistence modules — and, crucially, it fails in the multiparameter setting, as we shall see in Section 4.

![Persistence barcode and persistence diagram](/thesis/ths_1788877761022_a3f9-1.webp)

---

## 3 Methodology

The standard TDA pipeline, which we adopt as our methodological backbone, comprises four stages:

1. **Data acquisition and metricization.** Raw data (e.g., delay embeddings of time series, point samples of manifolds, distance matrices from sequence alignment) is converted into a finite metric space. The choice of metric is itself a modeling decision; Carlsson emphasizes that data metrics are rarely theoretically justified and that persistence's stability partially insulates the analyst from this choice [2].

2. **Filtration construction.** From the metric space, build a filtered simplicial complex — most often Vietoris–Rips (all pairwise distances) or a *witness complex* / *lazy witness complex* when the full Rips complex is too large [2][10]. Complexity is a hard constraint: the $k$-skeleton of $\mathrm{VR}(X, \varepsilon)$ can contain $O(n^{k+1})$ simplices, and computing persistent homology naively reduces to matrix reduction of the boundary matrix, $O(m^3)$ in the number of simplices [10]. Modern implementations (Ripser, GUDHI) exploit the cohomology algorithm with clearing and implicit matrix representations to reach state-of-the-art performance [10].

3. **Barcode/diagram computation.** Matrix reduction yields birth–death pairs. Software libraries — GUDHI (C++/Python), Ripser (C++), Dionysus, Eirene, Giotto-tda — implement this with varying trade-offs between generality and speed [10].

4. **Statistical and topological summarization.** Diagrams are not vectors; downstream analysis requires *vectorizations* (persistence landscapes [11], persistence images, Betti curves, sliced Wasserstein kernels) or *metrics* (bottleneck, Wasserstein $p$-distances) that respect stability [6][11]. Machine-learning pipelines consume these features for classification, anomaly detection, and hypothesis testing.

```python
# Canonical one-parameter pipeline with GUDHI + giotto-tda idiom
import gudhi as gd
import numpy as np

cloud = np.random.rand(300, 2)          # point sample of a noisy shape
rips = gd.RipsComplex(points=cloud, max_edge_length=0.35)
simplex_tree = rips.create_simplex_tree(max_dimension=2)
diag = simplex_tree.persistence()       # list of (dim, (birth, death))
betti_curves = simplex_tree.betti_numbers()
# diag is stable: d_B(diag(X), diag(Y)) <= 2 d_H(X, Y)   [Cohen-Steiner et al.]
```

---

## 4 Deep Dive

### 4.1 The algebraic stability theorem and interleavings

The qualitative claim "long bars are signal, short bars are noise" rests on the deepest result of the one-parameter theory. The modern formulation is algebraic, due to Chazal et al. (2016) and developed systematically in [3]:

> **Theorem (Algebraic stability):** If two persistence modules $\mathbb{V}, \mathbb{W}$ are $\delta$-interleaved — i.e., there exist morphisms $f: \mathbb{V} \to \mathbb{W}(\delta)$ and $g: \mathbb{W} \to \mathbb{V}(\delta)$ whose composites are the $2\delta$-shift maps — then their persistence diagrams satisfy $d_B(\mathrm{Dgm}(\mathbb{V}), \mathrm{Dgm}(\mathbb{W})) \leq \delta$.

The *bottleneck distance* $d_B$ is defined over matchings $\gamma: D \to D'$ (allowing matches to the diagonal $\Delta = \{(x,x)\}$) as $d_B(D, D') = \inf_\gamma \sup_{p \in D} \|p - \gamma(p)\|_\infty$ [3]. From this abstract theorem, the classical geometric stability follows: if $f, g: M \to \mathbb{R}$ are tame functions on a triangulable space with $\|f - g\|_\infty \leq \delta$, then $d_B(\mathrm{Dgm}_k(f), \mathrm{Dgm}_k(g)) \leq \delta$ [6]; for finite point clouds $X, Y$ with Hausdorff distance $d_H(X, Y) \leq \delta$, the Vietoris–Rips diagrams satisfy $d_B \leq 2\delta$ [3]. In words: **jiggling each point by at most $\delta$ moves no diagram point by more than $2\delta$**. This is what licenses the signal/noise reading of barcodes on real, noisy data.

![Bottleneck distance matching between two persistence diagrams](/thesis/ths_1788877761022_a3f9-3.webp)

### 4.2 Multiparameter persistence: the wild frontier

In applications, a single filtration parameter is often insufficient. A density-Rips bifiltration filters simultaneously by spatial scale $\varepsilon$ and density threshold $\rho$; a degree-Rips or function-Rips bifiltration filters by $\varepsilon$ and a function value. Formally, a $d$-parameter persistence module is a functor $M: \mathbb{R}^d \to \mathbf{vect}$, where $\mathbb{R}^d$ carries the product order [7].

The theory fractures here. Viewed as representations of the commutative $n$D grid quiver, $\mathbb{R}^d \to \mathbf{vect}$ is of *wild representation type* for $d \geq 2$: indecomposables cannot be classified, and **no complete discrete invariant exists** [7][8]. Concretely, there is no barcode for multiparameter persistence. The interval decomposition that undergirds everything in Section 2 fails — multiparameter interval modules do not suffice to decompose arbitrary modules.

The community's response has been to develop *incomplete but informative and stable invariants*:

- **The rank invariant** $\rho_M(s, t) = \mathrm{rank}(M_s \to M_t)$ for $s \leq t$, introduced by Carlsson–Zomorodian [7], records the persistent rank across comparable pairs. It is equivalent to the *fibered barcode*: the collection of ordinary barcodes of restrictions $M|_L$ to all lines $L \subset \mathbb{R}^2$ of non-negative slope [8].
- **Bigraded Betti numbers** $\xi_i(M)$, the multigraded Betti numbers of a minimal free resolution of $M$ as a module over the polynomial ring — computable, visualizable, and the engine behind RIVET's data structures [8].
- **The interleaving distance** $d_I$, the multiparameter analogue of the bottleneck distance, defined via $\delta$-interleavings along the diagonal direction. Lesnick's foundational work establishes its universality among stable metrics [12]; crucially, it is *NP-hard to compute* in general, motivating tractable approximations such as the matching distance $d_{\mathrm{match}}$ [12].

![Multiparameter bifiltration grid with rank invariant](/thesis/ths_1788877761022_a3f9-2.webp)

### 4.3 RIVET and the fibered barcode paradigm

RIVET (Rank Invariant Visualization and Exploration Tool) by Lesnick and Wright [8] is the flagship software for 2-parameter persistence. Its key insight: although a 2-D module has no barcode, each affine slice $M|_L$ along a line of non-negative slope *does*, and the collection of all such barcodes — the fibered barcode — is equivalent to the rank invariant. RIVET's augmented arrangement data structure, based on planar line arrangements, supports *real-time queries*: as the user drags a line through the parameter space, the barcode of the current slice updates instantly. The interface simultaneously displays the dimension function $\dim M_a$ (Hilbert function, as greyscale shading) and the bigraded Betti numbers (as colored dots), giving coarse global structure alongside the sharp local barcode view [8].

### 4.4 Noise, density, and robust filtrations

Real point clouds are noisy and non-uniformly sampled. Two strategies dominate:

1. **Density-aware filtrations.** The density-Rips bifiltration filters points by a density estimator before applying Rips at each level, suppressing spurious topology from outliers [8]. The *distance-to-measure* (DTM) filtration of Chazal, Cohen-Steiner, and Mérigot replaces Euclidean distance to the sample with a robust proxy, yielding stability to outliers in the Wasserstein sense rather than merely the Hausdorff sense [3].
2. **Statistical persistence.** Landscapes, images, and kernel methods convert diagrams into Banach-space-valued random variables, enabling confidence bands, hypothesis tests, and central limit theorems [11]. The *persistence landscape* $\lambda_k(t) = \sup\{h \geq 0 : \beta^{t-h, t+h} \geq k\}$ is 1-Lipschitz in the bottleneck metric and lives in $L^p$, where classical statistics apply [11].

| Filtration | Indexing poset | Robust to outliers? | Software |
|---|---|---|---|
| Vietoris–Rips | $\mathbb{R}$ | No (Hausdorff only) | Ripser, GUDHI |
| Čech / Alpha | $\mathbb{R}$ | No | GUDHI |
| Density–Rips | $\mathbb{R}^2$ | Partially | RIVET |
| DTM–Rips | $\mathbb{R}$ | Yes (Wasserstein) | GUDHI |
| Function–Rips | $\mathbb{R}^2$ | Depends on $f$ | RIVET |

### 4.5 Computation: complexity and the software ecosystem

Computing one-parameter persistent homology of a Rips filtration on $n$ points is dominated by the number of simplices: up to $\binom{n}{k+1}$ in dimension $k$. The standard reduction algorithm is $O(m^3)$ worst-case but effectively much faster with the *twist* / *clearing* optimizations and cohomology computation [10]. Ripser's implicit matrix representation avoids storing the full boundary matrix and remains the benchmark for Vietoris–Rips barcodes [10]. For multiparameter persistence, RIVET computes the augmented arrangement in time polynomial in the size of a minimal presentation, with practical performance on thousands of simplices [8]. A comprehensive survey of algorithms, implementations, and benchmarks is given in Otter et al. [10].

```python
# Two-parameter exploration idiom (RIVET-style workflow, cf. rivet.online)
# M: bifiltration indexed by (radius, density); L: line of slope m >= 0
# For each slice L, restrict M|_L -> ordinary barcode B(M_L).
# Fibered barcode = { B(M_L) : L line, slope >= 0 }  <=>  rank invariant
def fibered_barcode(bifiltration, lines):
    return {L: one_parameter_barcode(restrict(bifiltration, L)) for L in lines}
# Matching distance: sup over lines of bottleneck distance of slice barcodes,
# weighted by slope -- a computable stable lower bound of d_I. [12]
```

---

## 5 Empirical Results and Proofs

We consolidate the theory's load-bearing results as a sequence of theorems with proof sketches, followed by representative empirical findings.

> **Theorem (Structure, Zomorodian–Carlsson 2005; Crawley-Boevey 2015):** Every pointwise finite-dimensional persistence module $\mathbb{V}: \mathbb{R} \to \mathbf{vect}$ decomposes as $\mathbb{V} \cong \bigoplus_{i} \mathbb{I}_{[b_i, d_i)}$, uniquely up to permutation. The multiset $\{[b_i, d_i)\}$ is the barcode [5][9].

*Sketch.* Reduce to a graded module over the PID $\mathbb{F}[t]$; the classification of finitely generated modules over a PID yields interval summands. Crawley-Boevey extends this to arbitrary pointwise finite-dimensional modules via a delicate argument with projective limits [9].

> **Theorem (Stability, Cohen-Steiner–Edelsbrunner–Harer 2007):** For tame $f, g: X \to \mathbb{R}$, $d_B(\mathrm{Dgm}(f), \mathrm{Dgm}(g)) \leq \|f - g\|_\infty$ [6].

*Sketch.* The sublevel filtrations are $\|f-g\|_\infty$-interleaved; the algebraic stability theorem converts interleavings into bottleneck matchings [3][6].

> **Theorem (No complete invariant, Carlsson–Zomorodian 2009):** For $d \geq 2$, the category of $d$-parameter persistence modules is of wild representation type; no complete discrete invariant exists [7].

*Sketch.* Embed the representation category of an arbitrary finite quiver into $\mathbb{R}^d \to \mathbf{vect}$; classification of the former is provably intractable (wild), so the latter admits no finite classification scheme [7][8].

> **Theorem (Universality of interleaving distance, Lesnick):** The interleaving distance $d_I$ on multiparameter modules is the universal stable metric: any other metric stable with respect to $d_I$-perturbations factors through it [12].

Empirically, the theory's predictions hold across domains. In the landmark natural-image study, Carlsson et al. found that the space of high-contrast $3 \times 3$ image patches concentrates on a Klein bottle, with $\beta_0 = 1$, $\beta_1 = 2$, $\beta_2 = 1$ over $\mathbb{F}_2$ — a discovery made by reading barcodes of witness complexes, not by any parametric model [2]. In oncology, Nicolau, Levine, and Carlsson used Mapper-based TDA to identify a breast-cancer subgroup with a unique mutational profile and excellent survival, invisible to standard clustering [2]. In neuroscience, Giusti, Pastalkova, Curto, and Itskov applied the *clique topology* of neural correlations to detect geometric organization in hippocampal activity [3]. Each application leans on the same pipeline of Section 3 and the same stability guarantee: the topological signal persists across reasonable choices of scale, metric perturbation, and sampling noise.

---

## 6 Limitations

Intellectual honesty demands a clear-eyed catalog of what persistent homology cannot do.

1. **The wildness barrier.** As established above, multiparameter persistence admits no barcode. Every practical invariant (rank invariant, fibered barcode, Betti numbers, matching distance) is incomplete: non-isomorphic modules can share all of them. Whether the invariants in use are *sufficient* for any given application is an open, application-specific question [7][8].

2. **Computational cost.** Vietoris–Rips complexes explode combinatorially: the 2-skeleton on $n$ points has $\Theta(n^3)$ simplices. Data sets beyond a few thousand points require witness complexes, subsampling, or distributed computation [10]. Multiparameter computation is harder still; RIVET's arrangement, while polynomial, is practical only for modest bifiltrations [8].

3. **Metric and filtration dependence.** Stability bounds perturbations of a *fixed* filtration; it says nothing about the choice of filtration itself. Different metrics, density estimators, or complex constructions can produce qualitatively different diagrams, and there is no canonical selection procedure [2][3].

4. **Interpretability gap.** A long bar in $H_1$ certifies a loop, but not *which* loop, nor its geometric meaning. Representative cycles are non-canonical, and mapping topological features back to domain semantics remains largely manual [3].

5. **Statistical immaturity.** While landscapes and kernels enable inference [11], confidence sets for diagrams, multiple-testing corrections across scales, and minimax rates for topological estimation are active research areas, not settled methodology.

6. **Instability of multiparameter metrics.** The interleaving distance is NP-hard to compute; the matching distance is a tractable surrogate but a strictly weaker invariant, and its discriminative power on real data is still being evaluated [12].

---

## 7 Conclusion

Persistent homology has matured from a 2002 paper on "topological persistence and simplification" [4] into a full-fledged mathematical discipline with theorems, algorithms, software, and applications spanning biology, neuroscience, materials science, and finance. Its one-parameter theory is essentially complete: filtrations produce persistence modules, modules decompose into barcodes, barcodes are stable under perturbation, and the entire pipeline is computable at scale [3][5][6][10]. The multiparameter theory is where the frontier lies — wild representation theory denies us a barcode, but the rank invariant, fibered barcodes, interleaving and matching distances, and tools like RIVET provide a working, principled, and increasingly practical substitute [7][8][12].

The deepest lesson of the subject is methodological: *topology is a language for qualitative hypotheses about data*. When Carlsson's group read a Klein bottle in image patches [2], or when Nicolau's group found a cancer subtype in the shape of patient data [2], the contribution was not a number but a shape — a falsifiable, interpretable, stable claim about how the data is organized. As data sets grow noisier, higher-dimensional, and more heterogeneous, the demand for such coordinate-free, noise-tolerant summaries will only increase, and the open problems catalogued in Section 6 — computable multiparameter metrics, statistical foundations, filtration selection — define the research program for the coming decade.

---

## References

[1] F. Chazal and B. Michel, "An introduction to Topological Data Analysis: fundamental and practical aspects for data scientists," *arXiv:1710.04019*, 2017. https://ar5iv.labs.arxiv.org/html/1710.04019

[2] G. Carlsson, "Topology and Data," *Bulletin of the American Mathematical Society*, 46(2):255–308, 2009. https://www.math.kth.se/math/GRU/2013.2014/SF2704/Papers/Topologyanddata.pdf

[3] E. Munch, "A user's guide to topological data analysis," *Journal of Learning Analytics*, 4(2):47–61, 2017. https://arxiv.org/pdf/2004.04108

[4] H. Edelsbrunner, D. Letscher, and A. Zomorodian, "Topological persistence and simplification," *Discrete & Computational Geometry*, 28:511–533, 2002.

[5] H. Edelsbrunner and J. Harer, *Computational Topology: An Introduction*, American Mathematical Society, 2010.

[6] D. Cohen-Steiner, H. Edelsbrunner, and J. Harer, "Stability of persistence diagrams," *Discrete & Computational Geometry*, 37(1):103–120, 2007. https://doi.org/10.1007/s00454-006-1276-5

[7] G. Carlsson and A. Zomorodian, "The theory of multidimensional persistence," *Discrete & Computational Geometry*, 42:71–93, 2009.

[8] M. Lesnick and M. Wright, "Interactive visualization of 2-D persistence modules," *arXiv:1512.00180*, 2015. https://arxiv.org/pdf/1512.00180

[9] "Algebraic and Topological Persistence" (persistence module structure theory survey), *arXiv:2410.08323*. https://arxiv.org/pdf/2410.08323

[10] N. Otter, M. A. Porter, U. Tillmann, P. Grindrod, and H. A. Harrington, "A roadmap for the computation of persistent homology," *EPJ Data Science*, 6:17, 2017; arXiv:1506.08903. http://arxiv.Org/pdf/1506.08903

[11] P. Bubenik, "Statistical topological data analysis using persistence landscapes," *Journal of Machine Learning Research*, 16:77–102, 2015.

[12] M. Lesnick, "The theory of the interleaving distance on multidimensional persistence modules," *Foundations of Computational Mathematics*, 15(3):613–650, 2015.
