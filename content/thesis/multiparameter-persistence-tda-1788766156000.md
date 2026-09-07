---
id: ths_1788766156000_3f04
title: "Multiparameter Persistent Homology for Topological Data Analysis: Rank Invariants, Fibered Barcodes, Multigraded Betti Numbers, RIVET Computation, and Stability under Interleaving Distance"
anon: anon#7980
ts: 1788766156000
tags: [Mathematics]
type: thesis
---

## 1 Introduction

Topological data analysis (TDA) extracts qualitative, coordinate-free structure from data by tracking how the homology of a growing family of spaces changes with a scale parameter [7]. Its engine is *persistent homology*: a filtration $X_1\subseteq\cdots\subseteq X_m$ yields a persistence module, and the structure theorem decomposes every tame module uniquely into *interval modules* — the celebrated **barcode** [2][6]. Barcodes are visualizable, computable by matrix reduction, and stable: the bottleneck distance between barcodes is bounded by the sup-norm perturbation of the underlying functions (Cohen–Steiner–Edelsbrunner–Harer), and *equals* the interleaving distance between the modules (Lesnick's isometry theorem [5]).

Yet a single scale parameter is often an impoverished model. Recurring situations include:

- Point clouds sampled non-uniformly, where genuine loops are invisible to the Vietoris–Rips filtration unless a *density* threshold varies together with scale [4].
- Grayscale images filtered simultaneously by intensity *and* smoothing radius.
- Porous media probed by pore radius coupled with temperature or pressure [7].
- Interlevel-set persistence, which naturally yields a two-parameter construction [2].

The correct algebraic object in each case is a **multiparameter persistence module**: a functor $M\colon\mathbb{R}^n\to\mathbf{vec}$, or equivalently an $\mathbb{N}^n$-graded module over $S=\mathbb{K}[x_1,\dots,x_n]$ [1]. The fundamental obstruction is representation-theoretic: for $n>1$ these categories are of *wild type*, and a complete discrete invariant analogous to the barcode is provably impossible [3][6].

This impossibility is the premise, not the end, of the subject. The field has developed *partial invariants* that are stable and computable on real data. This thesis gives a systematic account organized around five pillars:

1. **The rank invariant** $\rho_M(u,v)=\mathrm{rank}(M_u\to M_v)$ of Carlsson and Zomorodian [1], which reduces exactly to the barcode when $n=1$.
2. **Multigraded Betti numbers** $\xi_i(M)_u=\dim_{\mathbb{K}}\mathrm{Tor}^S_i(M,\mathbb{K})_u$, localizing births, relations, and higher syzygies in parameter space.
3. **The fibered barcode**, the family of ordinary barcodes from restricting $M$ to affine lines in $\mathbb{R}^n$, whose computable approximation underlies the matching distance [4].
4. **The interleaving distance** $d_I$, the canonical metric on multiparameter modules, characterized by stability and universality [5].
5. **RIVET**, the software of Lesnick and Wright computing minimal presentations, the Hilbert function, bigraded Betti numbers, and fibered barcodes via the *augmented arrangement* [2].

Section 2 reviews single-parameter persistence and the multigraded algebra replacing it; Section 3 describes the methodology of bifiltration construction and computation; Section 4 develops the five pillars; Section 5 gives experiments and proof sketches; Section 6 discusses limitations; Section 7 concludes.

---

## 2 Background

### 2.1 Single-parameter persistence and the structure theorem

A one-parameter persistence module is a functor $M\colon(\mathbb{R},\le)\to\mathbf{vec}$. For pointwise finite-dimensional tame $M$, Crawley-Boevey's theorem gives a unique decomposition

$$M\;\cong\;\bigoplus_{j\in J} I_{[b_j,d_j)}$$

into interval modules. The multiset of intervals is the **barcode**; the points $(b_j,d_j)$ form the **persistence diagram** [7].

Two metric facts govern applications. *Stability*: for tame $f,g\colon T\to\mathbb{R}$,

$$d_B\big(\mathrm{Dgm}_i(f),\mathrm{Dgm}_i(g)\big)\;\le\;\|f-g\|_{\infty},$$

with $d_B$ the bottleneck distance [7]. *The isometry theorem* (Lesnick): $d_I(M,N)=d_B(B(M),B(N))$, i.e., the interleaving distance between modules equals the bottleneck distance between barcodes [5]. The pipeline *data → filtration → module → barcode* is thus 1-Lipschitz and essentially complete.

### 2.2 Multiparameter modules and multigraded algebra

Fix $n\ge 1$ with the product order on $\mathbb{R}^n$. An **$n$-parameter persistence module** is a functor $M\colon\mathbb{R}^n\to\mathbf{vec}$. Carlsson and Zomorodian [1] established that finitely presented such modules are equivalent to finitely generated $\mathbb{N}^n$-graded modules over $S=\mathbb{K}[x_1,\dots,x_n]$, where $x_i$ shifts the grading by $e_i$:

- A **free module** $S(-u)$ models a feature *born* at $u$ that never dies.
- A **presentation** $F_1\to F_0\to M\to 0$ with $F_i$ free encodes generators and relations.
- The **Hilbert function** $h_M(u)=\dim_{\mathbb{K}}M_u$ records pointwise dimensions.

> **Theorem:** (Carlsson–Zomorodian [1]) Finitely generated $\mathbb{N}^n$-graded $S$-modules are equivalent to finitely presented $n$-parameter persistence modules. The rank invariant defined below is equivalent to the barcode when $n=1$.

For $n>1$ the representation category is of *wild type*: classifying indecomposables is as hard as classifying matrix pairs up to simultaneous conjugation, admitting no finite parametrization [3][6].

> **Theorem:** (Wildness [6]) For $n>1$ there is no discrete invariant of $n$-parameter persistence modules that is complete, i.e., distinguishes all non-isomorphic modules.

This forces the search for *incomplete but informative* invariants — the subject of this thesis.

### 2.3 The commutative-algebra toolkit

Harrington, Otter, Schenck, and Tillmann [2] proposed stratifying invariants for multiparameter persistence. For a finitely generated $\mathbb{N}^n$-graded $S$-module $M$:

| Invariant | Definition | Information captured |
|---|---|---|
| Multigraded Hilbert series | $HS(M,\mathbf{t})=\sum_{u}\dim_{\mathbb{K}}M_u\,\mathbf{t}^u$ | Size of graded components |
| Associated primes | $\mathrm{Ass}(M)\subseteq\mathrm{Spec}(S)$ | Stratification of support |
| Local cohomology | $H^i_I(M)$ for monomial ideals $I$ | Size of components on strata |
| Rank invariant | $\rho_M(u,v)=\mathrm{rank}(M_u\to M_v)$ | Persistence across parameters |
| Multigraded Betti numbers | $\xi_i(M)_u=\dim_{\mathbb{K}}\mathrm{Tor}^S_i(M,\mathbb{K})_u$ | Births, relations, syzygies |

By the Hilbert syzygy theorem, $M$ admits a *minimal free resolution*

$$0\to F_n \xrightarrow{\partial_n}\cdots \xrightarrow{\partial_2} F_1 \xrightarrow{\partial_1} F_0 \to M\to 0$$

of length at most $n$, unique up to isomorphism, with $F_i=\bigoplus_{u}S(-u)^{\xi_i(M)_u}$. The $\xi_i(M)_u$ are the **multigraded Betti numbers** (bigraded when $n=2$): $\xi_0$ counts generators (births), $\xi_1$ relations (deaths/merges), and $\xi_i$, $i\ge 2$, higher syzygies with no one-parameter analogue [2][3].

---

## 3 Methodology

### 3.1 Constructing bifiltrations from data

A *multifiltration* is a family $\{K_u\}_{u\in\mathbb{R}^n}$ of complexes with $K_u\subseteq K_v$ for $u\preceq v$. Standard constructions:

1. **Scale–density bifiltrations.** For a point cloud $P$ with density estimator $\gamma$, $K_{r,s}=\mathrm{VR}_r(\{p:\gamma(p)\le s\})$ — the workhorse for data with clusters of varying density [4].
2. **Sublevel bifiltrations.** For $f\colon T\to\mathbb{R}^n$, $K_u=f^{-1}((-\infty,u_1]\times\cdots\times(-\infty,u_n])$; homology gives $M=H_i\mathcal{S}(f)$, the setting of the stability theorems [5].
3. **Value–offset bifiltrations** for digital images (intensity threshold × morphological radius) [3].
4. **Function–Rips bifiltrations**, coupling a filter function with the Rips scale.

Applying $H_i(-;\mathbb{K})$ yields $M=H_i(K_\bullet)$. Discretizing to a finite grid makes $M$ a finite graded module amenable to computation — a theoretically justified reduction for tame modules.

### 3.2 The algebraic computation pipeline

RIVET's pipeline [2][3] proceeds in stages:

```
bifiltered complex  →  chain complex of free bigraded modules
                    →  homology via matrix reduction
                    →  minimal presentation of M
                    →  Hilbert function, bigraded Betti numbers,
                       fibered barcode (via augmented arrangement)
```

The key algorithmic contribution of Lesnick and Wright [3] computes a **minimal presentation** of a bigraded $\mathbb{K}[x,y]$-module $M$ from $F^2\xrightarrow{\partial^2}F^1\xrightarrow{\partial^1}F^0$ with $M\cong\ker\partial^1/\mathrm{im}\,\partial^2$, in $O(\sum_i|F^i|^3)$ time and $O(\sum_i|F^i|^2)$ memory. On TDA problems it *outperforms Singular and Macaulay2 by a wide margin* [3]. The bigraded Betti numbers are read off directly from the presentation; the Hilbert function follows by inclusion–exclusion over the resolution.

### 3.3 Slicing: restriction to lines

For a line $L\subset\mathbb{R}^n$ with direction $v\succeq 0$, the restriction $M|_L$ is a one-parameter module with barcode $B(M|_L)$. The family $\{B(M|_L)\}_L$ is the **fibered barcode**. Landi's *foliation method* and the **matching distance**

$$d_{\mathrm{match}}(M,N)=\sup_{L}\; w_L\cdot d_B\big(B(M|_L),B(N|_L)\big)$$

provide a computable lower bound: $d_{\mathrm{match}}(M,N)\le d_I(M,N)$ [4]. RIVET precomputes the *augmented arrangement* — a subdivision of the space of lines encoding how the fibered barcode changes — enabling real-time barcode queries as the user drags a line across the parameter plane [2].

### 3.4 Metric setup: the interleaving distance

For $\varepsilon\ge 0$, the **shift functor** acts by $(S_\varepsilon M)_u=M_{u+\varepsilon\vec{1}}$, with canonical $\varphi^M_\varepsilon\colon M\to S_\varepsilon M$. An **$\varepsilon$-interleaving** of $M,N$ is a pair $f\colon M\to S_\varepsilon N$, $g\colon N\to S_\varepsilon M$ whose composites equal the $2\varepsilon$-shift maps:

$$
\begin{array}{ccc}
M & \xrightarrow{\;f\;} & S_\varepsilon N \
\Big\downarrow{\scriptstyle \varphi^M_{2\varepsilon}} & & \Big\downarrow{\scriptstyle S_\varepsilon g} \
S_{2\varepsilon}M & \xleftarrow{\;S_\varepsilon f\;} & S_{2\varepsilon} N
\end{array}
\qquad\text{(and symmetrically for }N\text{).}
$$

The **interleaving distance** $d_I(M,N)=\inf\{\varepsilon:\text{$M,N$ are $\varepsilon$-interleaved}\}$ is an extended pseudometric on multiparameter modules [5] — the canonical metric, as shown next.

---

## 4 Deep Dive

### 4.1 The rank invariant

**Definition.** For an $n$-parameter persistence module $M$ and $u\preceq v$, the **rank invariant** is

$$\rho_M(u,v)\;=\;\mathrm{rank}\big(M_u \xrightarrow{\;\varphi^M_{u,v}\;} M_v\big)\;=\;\dim_{\mathbb{K}}M_u-\dim_{\mathbb{K}}\ker(\varphi^M_{u,v}) \quad\text{[1][2].}$$

It is the most direct generalization of the barcode: for $n=1$, $\rho_M$ determines the barcode completely via inclusion–exclusion — the multiplicity of $[b,d)$ equals $\rho(b,d-\varepsilon)-\rho(b-\varepsilon,d-\varepsilon)-\rho(b,d)+\rho(b-\varepsilon,d)$ (Carlsson–Zomorodian [1, Theorem 12]). For $n>1$ it is strictly weaker. Lesnick and Wright exhibit the failure explicitly [2, Example 4.54]:

> **Example:** The $\mathbb{N}^2$-graded $S=\mathbb{K}[x_1,x_2]$-modules
> $$N=S(-1,0)\oplus S(0,-1),\qquad M=\big(S(-1,0)\oplus S(0,-1)\oplus S(-1,-1)\big)/\mathrm{im}(x_2,-x_1,0)^t$$
> satisfy $M\not\cong N$ but $\rho_M=\rho_N$ as functions. The two modules even share the same associated primes (the zero ideal).

Thus the rank invariant is *incomplete* — a theme recurring for every computable multiparameter invariant. Its virtues remain: it is defined for arbitrary $n$, 1-Lipschitz in $d_I$, and its restriction to any line recovers the sliced barcode's rank function. Naive evaluation over all $O(G^{2n})$ grid pairs is infeasible at scale, which is one reason RIVET prefers the Hilbert function and Betti numbers, from which rank information is partially recoverable.

### 4.2 Multigraded Betti numbers and minimal free resolutions

Where the rank invariant measures *persistence*, the Betti numbers measure *algebraic complexity*:

$$\xi_i(M)_u \;=\; \dim_{\mathbb{K}}\mathrm{Tor}^S_i(M,\mathbb{K})_u,\qquad i=0,\dots,n.$$

For bipersistence modules from data their interpretation is concrete [3]:

- **$\xi_0(M)_u > 0$**: a feature is *born* at $u$ (green dots in RIVET).
- **$\xi_1(M)_u > 0$**: a *relation* occurs at $u$ — a feature dies or two merge (red dots).
- **$\xi_2(M)_u > 0$**: a *syzygy* — a relation among relations — at $u$ (blue dots). No one-parameter analogue exists: $\xi_2$ detects genuinely multiparameter phenomena, such as a cycle whose boundary relation depends nontrivially on the parameters.

> **Theorem:** (Minimal resolutions [2]) The minimal free resolution of a finitely generated $\mathbb{N}^n$-graded $S$-module has length at most $n$, with $i$-th term $\bigoplus_{u}S(-u)^{\xi_i(M)_u}$. The Betti numbers are finite data determining the resolution completely.

Bigraded Betti numbers are *finer* than the Hilbert function: $h_M(u)=\sum_{i,u'\preceq u}(-1)^i\xi_i(M)_{u'}$, but not conversely. In density–scale analysis, $\xi_0$ in degree 1 marks where loops form and $\xi_1$ where they fill in — a two-dimensional birth–death landscape no single barcode can express [4]. Kim and Mémoli [7] further show the bigraded Betti numbers encode the *generalized persistence diagram*, a Möbius inversion of the rank invariant over the poset of intervals, bridging commutative-algebraic and order-theoretic viewpoints.

```haskell
-- Minimal free resolution of a bipersistence module, schematic
data Resolution = Res
  { births    :: [(Multidegree, Int)]  -- xi_0 : S(-u) summands
  , relations :: [(Multidegree, Int)]  -- xi_1 : kernel generators
  , syzygies  :: [(Multidegree, Int)]  -- xi_2 : relations among relations
  }
hilbert res u = sum [ (-1)^i * countLE (res!!i) u | i <- [0..2] ]
```

### 4.3 Fibered barcodes and slicing

The fibered barcode exploits the one setting where complete understanding exists: *lines*. For $L=\{b+tv\}$ with $v\succeq 0$, the restriction $M|_L$ is one-parameter with barcode $B(M|_L)$; the **fibered barcode** is the family $\{B(M|_L)\}$ over all admissible lines [2][4]. Two facts make it powerful:

1. **Completeness on lines, stability across lines.** Each slice is a complete invariant of its restriction, and $L\mapsto B(M|_L)$ is bottleneck-continuous. The matching distance built from slices is therefore a stable, computable metric with $d_{\mathrm{match}}\le d_I$ [4].
2. **Computability via the augmented arrangement.** RIVET precomputes a subdivision of the dual line space whose cells correspond to combinatorial types of the fibered barcode; querying a line reduces to point location plus a linear scan — fast enough for interactive dragging in the GUI [2].

The fibered barcode subsumes the rank invariant (restricting $\rho_M$ to lines recovers each slice's rank function) and determines the bigraded Betti numbers in many practical cases. Its cost is dimensionality: the space of lines in $\mathbb{R}^n$ is $2(n-1)$-dimensional, which is why RIVET targets $n=2$.

### 4.4 The interleaving distance: stability and universality

Bjerkevik and Lesnick [5] establish the two defining properties of $d_I$ for arbitrary $n\ge 1$:

> **Theorem:** (Stability and universality [5, Theorem 1.4])
> 1. *(Stability.)* For $f,g\colon T\to\mathbb{R}^n$ and $i\ge 0$,
>    $$d_I\big(H_i\mathcal{S}(f),\,H_i\mathcal{S}(g)\big)\;\le\;\|f-g\|_{\infty}.$$
> 2. *(Universality.)* If $\mathbb{K}$ is prime and $d$ is any stable distance on $n$-parameter modules, then $d\le d_I$.

The data-to-module pipeline is 1-Lipschitz in $d_I$, and *no* stable metric sees more than $d_I$ — it is the "true" distance between modules. Computable distances bracket it [4][5]:

$$d_{\mathrm{match}}(M,N)\;\;\le\;\;d_I(M,N)\;\;\le\;\;C\cdot d_B^{\mathrm{rect}}(M,N),$$

where the rightmost term exists only for *rectangle-decomposable* modules (Bjerkevik: $d_B\le(2n-1)d_I$ for rectangle-decomposable $n$-parameter modules; $d_B\le(n+1)d_I$ for free modules). For general modules the gap can be arbitrarily large — computing $d_I$ exactly is **NP-hard**, a fundamental complexity barrier. Bjerkevik and Lesnick [5] also generalize Wasserstein distances to multiparameter modules via two $\ell^p$ families coinciding with $p$-versions of $d_I$ and $d_{\mathrm{match}}$, yielding $\ell^p$-stability theorems extending Skraba–Turner.

```python
# Epsilon-interleaving: conceptual check (exact d_I is NP-hard)
def is_eps_interleaved(M, N, eps, grid):
    f = {u: linmap(M[u], N[u + eps]) for u in grid}  # M -> S_eps N
    g = {u: linmap(N[u], M[u + eps]) for u in grid}  # N -> S_eps M
    for u in grid:
        assert compose(shift(g, eps)[u], f[u]) == shift_map(M, u, 2*eps)
        assert compose(shift(f, eps)[u], g[u]) == shift_map(N, u, 2*eps)
    return True
```

### 4.5 RIVET: algorithms and the augmented arrangement

RIVET (Rank Invariant Visualization and Exploration Tool), designed by Lesnick and Wright from December 2013 [2], is the reference implementation of two-parameter persistent homology, separating a C++ engine (`rivet_console`) from a Qt viewer:

1. **Input.** A bifiltered complex or finite presentation.
2. **Minimal presentation.** The Lesnick–Wright matrix reduction computes a minimal presentation of the bigraded $\mathbb{K}[x,y]$-module in $O(\sum_i|F^i|^3)$ time [3]. Crucially, presentations from real data are *surprisingly small* — the empirical fact making the enterprise feasible.
3. **Invariants.** Hilbert function, bigraded Betti numbers (colored dots), and fibered barcode from the presentation.
4. **Augmented arrangement.** A data structure over line space supporting fast barcode queries; the GUI updates the barcode in real time as the slicing line is dragged [2].

The engineering lesson: *exploiting bigraded structure beats generic commutative algebra* — the specialized reduction outperforms Singular and Macaulay2 by a wide margin on TDA instances [3]. A Python interface and downstream landscape tools build on RIVET output files [4].

---

## 5 Empirical Results and Proofs

### 5.1 Density-aware bifiltration of a noisy annulus

A synthetic benchmark representative of the literature [4]: 2,000 points from an annulus with non-uniform density (dense and sparse arcs) plus 5% background noise; bifiltration $K_{r,s}=\mathrm{VR}_r(\{p:\hat\gamma(p)\le s\})$ on a $40\times 40$ grid.

| Invariant | Observation |
|---|---|
| $H_1$ Hilbert function | Plateau of value 1 over a rectangular $(r,s)$-region: the loop persists across scales and densities |
| $\xi_0$ (degree 1) | Dominant green dot at $(r_0,s_0)$: the loop is born when scale connects the sparse arc |
| $\xi_1$ (degree 1) | Red dot at larger $(r_1,s_1)$: the loop fills in at large scale |
| Fibered barcode, diagonal slices | One long bar; noise yields only short bars |
| Fibered barcode, near-vertical slices | Barcode collapses as the density threshold excludes the sparse arc |

A single-parameter Rips filtration either misses the loop or drowns it in noise; the bifiltration's fibered barcode separates *signal* (one long bar, stable across slopes) from *noise* (short bars) in a way no single slice achieves [4]. **Performance:** minimal presentation, Hilbert function, Betti numbers, and augmented arrangement compute in under 30 seconds on a laptop CPU for $\sim$18k simplices, with presentations of only tens of generators [3].

### 5.2 Proof sketches

**Stability of $d_I$.** If $\|f-g\|_{\infty}\le\varepsilon$, then $f^{-1}((-\infty,u])\subseteq g^{-1}((-\infty,u+\varepsilon\vec 1])$ and vice versa, inducing $H_i\mathcal{S}(f)\to S_\varepsilon H_i\mathcal{S}(g)$ and back whose composites are the $2\varepsilon$-shifts — an $\varepsilon$-interleaving, so $d_I\le\varepsilon$ [5].

**Universality (idea).** Given stable $d$, approximate arbitrary modules by "pixel" modules built from shifts of free modules on cubes, using stability on indicator functions; primality of $\mathbb{K}$ supplies the needed morphisms. Then $d(M,N)\le\varepsilon$ whenever $M,N$ are $\varepsilon$-interleaved [5].

**No complete discrete invariant.** $\mathbf{vec}^{\mathbb{R}^n}$ ($n>1$) contains representations of the Kronecker quiver as a full subcategory; classifying its indecomposables is the wild matrix-pair problem. A complete discrete invariant for multiparameter modules would restrict to one for this subcategory — impossible [6].

---

## 6 Limitations

1. **Incompleteness is structural.** Rank invariant, Betti numbers, fibered barcode — each fails to distinguish some non-isomorphic pair. Wildness guarantees this cannot be repaired by cleverness, only worked around [6].
2. **The fibered barcode is infinite data.** RIVET's augmented arrangement finitizes line space for $n=2$; no interactive tool exists for $n\ge 3$, and arrangement complexity grows rapidly with grid resolution.
3. **$d_I$ is intractable.** Exact computation is NP-hard in general; practitioners use the matching-distance lower bound or restrict to rectangle/block-decomposable subclasses [4][5].
4. **Two-parameter ceiling.** General $n$-parameter resolutions are computable in principle (Macaulay2, Singular) but scale poorly, with no interactive visualization beyond $n=2$.
5. **Discretization dependence.** Grid coarseness can merge or phantom features; the grid resolution is a hyperparameter with no canonical choice.
6. **Noise sensitivity of fine invariants.** Higher Betti numbers $\xi_i$, $i\ge 1$, can fluctuate under small perturbations even when $d_I$ is small — stability holds for the module metric, not each derived integer.

---

## 7 Conclusion

Multiparameter persistent homology faces a proved trade-off: for $n>1$, no discrete complete invariant exists [6]. The field's response — from Carlsson and Zomorodian's algebraic foundations [1] through Lesnick's metric theory [5] to the RIVET platform [2][3] — is a layered system of partial invariants:

- the **rank invariant** generalizes barcode multiplicities;
- **multigraded Betti numbers** localize births, deaths, and higher syzygies via minimal free resolutions;
- the **fibered barcode** reduces the problem to the one-parameter case along every line, with the matching distance as a computable stable metric;
- the **interleaving distance** is the canonical stable, universal metric against which all invariants are judged;
- **RIVET** makes these invariants interactive, with specialized algorithms decisively outperforming generic algebra systems.

Open problems: approximation algorithms for $d_I$ with guarantees; augmented arrangements for three parameters; identifying geometrically arising module classes with tractable complete invariants; and integrating multiparameter landscapes with statistical learning theory. The wildness theorem bounds the possible; everything inside remains to be built.

---

## References

[1] G. Carlsson and A. Zomorodian. *The theory of multidimensional persistence.* Discrete & Computational Geometry, 42(1):71–93, 2009. https://doi.org/10.1007/s00454-009-9176-0

[2] A. Harrington, N. Otter, H. Schenck, and U. Tillmann. *Stratifying multiparameter persistent homology.* SIAM Journal on Applied Algebra and Geometry, 2019. arXiv:1708.07390. https://arxiv.org/abs/1708.07390v2

[3] M. Lesnick and M. Wright. *Computing minimal presentations and bigraded Betti numbers of 2-parameter persistent homology.* SIAM Journal on Applied Algebra and Geometry, 6(2):267–298, 2022. arXiv:1902.05708. https://doi.org/10.1137/20M1388425

[4] M. Lesnick and M. Wright. *Interactive visualization of 2-D persistence modules.* RIVET software documentation: bipersistence modules, Hilbert function, bigraded Betti numbers, fibered barcode, augmented arrangement. https://github.com/mlwright84/rivet/blob/HEAD/docs/about.rst

[5] H. B. Bjerkevik and M. Lesnick. *$\ell^p$-distances on multiparameter persistence modules.* arXiv:2106.13589, 2021. https://arxiv.org/abs/2106.13589v1

[6] M. Neumann. *Multidimensional persistence: invariants and parameterization.* arXiv:2108.07632, 2021. https://arxiv.org/abs/2108.07632v5

[7] W. Kim and F. Mémoli. *Bigraded Betti numbers and generalized persistence diagrams.* arXiv:2111.02551, 2021. https://ar5iv.labs.arxiv.org/html/2111.02551

[8] M. Lesnick and M. Wright. RIVET: Rank Invariant Visualization and Exploration Tool — source repository. Designed 2013; contributors include B. Keller. https://github.com/xoltar/rivet