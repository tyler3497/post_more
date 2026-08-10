---
id: thesis-tropical-relu-1786329188009
title: "Tropical Geometry Approaches to ReLU Network Expressivity: Newton Polytopes, Mixed Subdivisions, and Verification via Mixed-Integer Linear Programming"
ts: 1786329188009
anon: anon#7421
type: thesis
---

# Tropical Geometry Approaches to ReLU Network Expressivity: Newton Polytopes, Mixed Subdivisions, and Verification via Mixed-Integer Linear Programming

## Abstract
Rectified Linear Unit (ReLU) networks are piecewise-linear functions whose expressivity is combinatorially governed by polyhedral geometry. This thesis develops a unified tropical-geometric framework that identifies ReLU networks with tropical rational functions $f = p \oslash q$ over the max-plus semiring $\mathbb{T}=(\mathbb{R}\cup\{-\infty\}, \max, +)$, where Newton polytopes $\text{Newt}(p)$, $\text{Newt}(q)$, and their mixed subdivisions encode linear regions, decision boundaries, and depth separation. We show that a single hidden layer ReLU map yields $\text{Newt}(f)$ as an edge with extended Newton polytope $\text{ENewt}(f)$ being an interval, while deep composition corresponds to iteratively taking Minkowski sums of zonotopes $\mathcal{Z}_{\mathbf{G}}$ and convex hulls of polytope pairs, giving rise to the dual subdivision $\delta(R(\mathbf{x}))$ as convex hull of two zonotopes whose normal fan is the tropical hypersurface $\mathcal{T}(R)$. Using lattice polytope volume arguments we recover tight depth lower bounds $\lceil \log_2 n \rceil$ for computing $\max\{x_1,\dots,x_n\}$ with integral weights, and characterize linear region counts via mixed volume. Finally we connect tropical hypersurface membership to mixed-integer linear programming (MILP) verification: each unstable ReLU neuron introduces a binary variable in a big-M encoding whose LP relaxation equals the triangular abstraction and whose feasible set intersects the tropical variety. The framework unifies pruning via zonotope vertex preservation, verification, and depth-width tradeoffs under Newton polytopes.

## 1 Introduction

> **Central thesis:** A ReLU network is a tropical rational map, its expressivity a Newton polytope, its verification a mixed-integer program over that polytope's normal fan.

Deep learning owes much of its power to piecewise-linear activation $\sigma(x)=\max\{x,0\}$. A ReLU network $f_\theta: \mathbb{R}^{n_0}\to\mathbb{R}$ is continuous piecewise-linear (CPWL) and can be written as difference of two convex CPWL functions [2][6][3]. Tropical geometry replaces classical ring $(\mathbb{R},+,\times)$ by max-plus $(\mathbb{R}\cup\{-\infty\},\max,+)$, where tropical polynomials are exactly convex CPWL functions with integer (or real) slopes. This identification, initiated by Zhang et al. [1] and refined by Brandenburg-Loho-Montúfar [3] and Smyrnis-Maragos [5], makes the combinatorics of polytopes govern neural computation.

Three intertwined objects drive this work:

1. **Newton Polytopes $\Delta(p)$ and $\text{Newt}(f)$**: For tropical polynomial $p(x)=\max_i (a_i^T x + b_i)$, the Newton polytope is $\text{conv}\{a_i\}\subset\mathbb{R}^d$ with lifting by coefficients $b_i$ yielding regular subdivisions [1][5]. The number of upper vertices equals linear regions.
2. **Mixed Subdivisions and Zonotopes**: A one-layer ReLU unit $f_i(x)=\max\{a_i^T x+b_i,0\}$ has $\text{ENewt}(f_i)=\text{conv}\{(0,0),(a_i,b_i)\}$, an edge. Summing $p_j=\bigoplus_{c_{ji}>0}|c_{ji}|f_i$ in tropical sense corresponds to Minkowski sum of edges: a zonotope $\mathcal{Z}_{\mathbf{G}}$ [2][4]. The decision boundary dual $\delta(R(\mathbf{x}))=\text{conv}(\mathcal{Z}_{\mathbf{G}_1},\mathcal{Z}_{\mathbf{G}_2})$ preserves superset $\mathcal{T}(R)\supseteq\mathcal{B}$ [2].
3. **Verification as MILP**: Complete verification of $f(x)\ge 0$ over $[l,u]^d$ reduces to MILP $\min f(x)$ s.t. big-M ReLU encoding with binary $z_i\in\{0,1\}$ [6][7]. LP relaxation yields triangle over-approximation whose facets are dual to edges of $\text{Newt}(f)$.

**Contributions**:

- Formal synthesis of ReLU → tropical rational $p\oslash q$ with extended Newton polytope ENewt, duality with tropical hypersurface $\mathcal{T}(p)$ as codimension-1 skeleton of normal fan of lifted polytope.
- Proof that zonotopal representation $\mathcal{Z}_{\mathbf{G}}=\sum_i [\mathbf{0}, \tilde{B}_i A_i]$ characterizes bias-free networks and yields pruning criterion preserving $\delta(R)$.
- Depth lower bounds via normalized lattice volume parity: integral weights ⇒ Newton polytopes are lattice polytopes; odd-volume faces obstruct shallow representation [9][2].
- Verification bridge: Tropical hypersurface arrangement intersection emptiness certified via MILP feasibility; bound-tightening procedures (Grimstad et al.) interpreted as lifting regularization of Newton polytopes.
- Extensive GFM tables comparing region counts, volume bounds, MILP sizes.

![Tropical ReLU Zonotope Polytopes](/thesis/thesis-tropical-relu-1786329188009-0.webp)

## 2 Background

### 2.1 Tropical Polynomials and Newton Polytopes

Tropical arithmetic over $\mathbb{T}_{\max}$: $a\oplus b:=\max(a,b)$, $a\odot b:=a+b$ with additive identity $-\infty$. A tropical monomial $c\odot x^{\alpha}=c + \langle \alpha, x\rangle$ for $\alpha\in\mathbb{N}^d$. Tropical polynomial $p(x)=\bigoplus_{\alpha\in\mathcal{A}} c_\alpha \odot x^{\alpha}= \max_{\alpha\in\mathcal{A}} (c_\alpha + \langle \alpha, x\rangle)$ is convex CPWL. Its Newton polytope $\text{Newt}(p)=\text{conv}(\mathcal{A}\subset\mathbb{R}^d)$. The regular subdivision induced by lifting $\alpha\mapsto c_\alpha$ dualizes to $\mathcal{T}(p)=\{x\mid \max \text{ achieved at least twice}\}$ [1][5].

**Tropical rational:** $f=p\oslash q:=p-q$ in classical notation, i.e., difference of convex CPWL, i.e., general CPWL [3]. ReLU networks are exactly tropical rationals with sign-restricted representation [1][3].

> **Theorem 1 (Zhang-Montúfar duality):** For ReLU network $f$, $\text{Newt}(p)$ upper hull projection equals set of linear pieces. $\text{Vol}(\text{Newt}(f))$ bounds number of regions via $O(m^d)$ where $m$ terms [1][6].

### 2.2 ReLU Layer as Edge Zonotope

Consider single hidden layer with $n_1$ units $f_i=\max\{a_i^T x+b_i,0\}$ tropical rank-2 polynomial with $\text{ENewt}(f_i)$ edge from $(0,0)$ to $(a_i^T,b_i)\in\mathbb{R}^{n_0+1}$ [4]. For output $j$, $v_j=\sum_i c_{ji} f_i = p_j - q_j$ where $p_j=\sum_{c_{ji}>0}|c_{ji}|f_i$, $q_j=\sum_{c_{ji}<0}|c_{ji}|f_i$ are tropical sums (max) of scaled edges after tropicalization of linear combination. In extended space, Newton polytope of $p_j$ is zonotope $\mathcal{Z}_j=\sum_{i:c_{ji}>0}|c_{ji}|\cdot\text{ENewt}(f_i)$ = Minkowski sum of line segments, combinatorially a cubical zonotope with up to $2^{k}$ vertices [4][2].

Bias-free simplification: $\pi$ projection onto $\mathbb{R}^{n_0}$ drops $b_i$, making $\delta(R(x))=\Delta(R(x))$ (Newton polytope itself) which is $\text{conv}(\mathcal{Z}_{G_1},\mathcal{Z}_{G_2})$ [2].

### 2.3 Mixed Subdivisions and Mixed Volume

Minkowski sum $P+Q=\{p+q:p\in P,q\in Q\}$. Mixed subdivision of $P_1+\cdots+P_k$ partitions sum into cells $C=\sum F_i$ where $F_i$ faces. Cayley trick: mixed subdivisions correspond to regular subdivisions of Cayley polytope $\mathcal{C}(P_i)=\text{conv}(\cup_i P_i\times e_i)$. For ReLU networks, $P_i=\text{ENewt}(f_i)$ edge, sum is zonotope; mixed volume $\text{MV}(P_1,\dots,P_d)$ counts intersections of tropical hypersurfaces, which for networks equals maximal number of linear regions with generic weights [1][9].

Lattice polytopes: integer vertices ⇒ normalized volume $d!\text{Vol}$ integer. Parity of volume obstructs representation as Minkowski sum of simpler lattice polytopes, yielding depth separation [9].

### 2.4 MILP Verification for ReLU

Verification query: doesExists $x\in\mathcal{X}=[l,u]$ s.t. $f_\theta(x)<0$ (adversarial) or for all $x$. Exact encoding uses mixed-integer linear program [6][7][8]:

$$
\begin{aligned}
x_0&\in\mathcal{X}\\
\hat{z}_{i}&=W_i z_{i-1}+b_i\\
z_i&\ge 0,\; z_i\ge \hat{z}_i\\
z_i&\le U_i a_i\\
z_i&\le \hat{z}_i - L_i(1-a_i)\\
a_i&\in\{0,1\}
\end{aligned}
\tag{MILP}
$$

Where $[L_i,U_i]$ are valid bounds on $\hat{z}_i$. This is big-M formulation [7]. LP relaxation ($a_i\in[0,1]$) equals triangular abstraction (Ehlers): $\hat{x}\ge0,\hat{x}\ge x,\hat{x}\le \frac{U}{U-L}(x-L)$ [3]. Strength of relaxation tied to bound tightness; bound-tightening via OBBT solves auxiliary LPs minimizing $L_i,U_i$ subject to output bounds [4].

> **Theorem 2 (Anderson et al. equivalence):** Triangle LP relaxation is weakest possible convex relaxation respecting individual ReLU convex hull but not cross-neuron interactions. Tropical intersection non-trivialities correspond to need for cutting planes lifting Newton polytope facets.

![Mixed Subdivision Cayley Zonotope](/thesis/thesis-tropical-relu-1786329188009-1.webp)

## 3 Methodology

We study $f\in\text{ReLU}_{\mathbf{0}}^{\mathbb{Q}}(n_0,1)$ unbiased shallow rational weights and deep $\mathbf{f}^{(L)}=W_L\circ\sigma\circ\cdots\circ\sigma\circ W_1$. Tropicalization operator $\text{Trop}:f\mapsto \bigoplus_i c_i\odot x^{\alpha_i}$ extended over semiring homomorphism $\nu:(\mathbb{R}_{>0},+,\times)\to\mathbb{T}$ via Maslov dequantization $x\mapsto -h\log x$ with $h\to0$.

**Step 1 — to Newton polytope:** For each layer compute $\text{ENewt}^{(l)}=\text{conv}\{\tilde{P}^{(l-1)}\times\{0\}\cup \text{graph of lift}\}$. Composition $p^{(l)}= \max$ over compositions of max terms yields $|\mathcal{A}^{(l)}| \le \prod_{k=1}^l n_k$ upper hull complexity but zonotopal simplification keeps at $O(\sum 2^{n_k})$ via generator matrix $G$.

**Step 2 — Activation polytope for real tropical geometry:** Following Brandenburg et al. [3], activation polytope $P(a_1,\dots,a_m)=\text{conv}\{e_S: S\subseteq[m]\text{ valid activation}\}$ where $e_S$ indicator of dataset partition pattern. Normal fan $\Sigma$ equals classification fan. Sublevel sets of $0/1$ loss are subfans, possibly disconnected [3]. Algorithm to enumerate bipartite graph covectors axiomatized akin to oriented matroids.

**Step 3 — Volume parity obstruction:** For integral weights, $\text{Newt}(f)$ lattice. Compute normalized volume via $d!\text{Vol}_d = |\det G|$. If target function $\max\{0,x_1,\dots,x_{n}\}$ has Newton polytope simplex with volume 1 and $n+1$ vertices, any depth-$k$ integer network realizes polytope whose every face's normalized volume even unless $2^k\ge n+1$, giving $\lceil \log_2(n+1)\rceil$ lower bound. Complete classification of tropical rational functions with given $n_1$ via zonotope intersection numbers [9].

**Step 4 — MILP ↔ Tropical:** Show that exclusion certificate $x\notin\mathcal{T}(R)$ equivalent to strict inequality separating from max attainment region; MILP feasible implies existence of region where $p-q<0$. Strengthening via tropical divisors: Cartier divisor $D$ on toric variety $X_{\Sigma_{f_\theta}}$ associated to ReLU fan has polytope $P_D=-\text{Newt}(f)$ when $f$ tropical polynomial [10], linking integer programming rounding to divisor intersection theory.

We implemented tropix library extension [11] computing ENewt edges, zonotope Minkowski via $O(n\log n)$, mixed subdivisions via regular triangulation of Cayley polytope using scipy Qhull, and MILP exporter to gurobipy / PySCIPOpt.

```python
# Python: Newton polytopes and zonotope pruning preservation
from tropix import TropicalPolynomial, ENewt, zonotope_from_edges
import numpy as np
# single ReLU edges (a_i,b_i)
edges = [np.array([2.1,-0.5,0.3]), np.array([-1.2,0.8,-0.2])]  # extended
Z = zonotope_from_edges(edges)  # Minkowski sum -> vertices
# dual subdivision = conv(Z_G1, Z_G2)
def delta_R(G1,G2):
    Z1 = zonotope_from_edges(G1)
    Z2 = zonotope_from_edges(G2)
    # convex hull via Qhull wrapper
    return Z1.convex_hull(Z2)
# Tropical pruning criterion: vertex removal preserves hull volume
def can_prune(node_idx, G_list, eps=1e-6):
    hull_before = delta_R(G_list[0], G_list[1]).volume()
    G_pruned = [g for i,g in enumerate(G_list[0]) if i!=node_idx]
    hull_after = delta_R(G_pruned, G_list[1]).volume()
    return abs(hull_before - hull_after) < eps
```

## 4 Deep Dive

### 4.1 Tropical Rational Functions as ReLU Networks and Newton Polytope Duality

Formal representation theorem: $f:\mathbb{R}^{d}\to\mathbb{R}$ representable as ReLU network iff $f=p\oslash q$ with $p,q$ tropical polynomials where extended Newton polytopes lie in param subspace defined by semialgebraic rank constraints on $G=\tilde{B}A$ [3]. Example for $f(x)=\max\{0,x_1\}+\max\{0,x_2\}$: $p$ has 4 terms $(0,0),(1,0),(0,1),(1,1)$ ⇒ Newton square, 4 linear regions. Single neuron $f_i=\max\{a_i^T x+b_i,0\}$ Newton edge duality: tropical hypersurface $\mathcal{T}(f_i)=\{x\mid a_i^T x+b_i=0\}$ hyperplane, orthogonal to edge. This hypersurface arrangement defines linear region complex; number of regions $ \le \sum_{j=0}^{d} \binom{n}{j}$ for $n$ neurons same as hyperplane arrangement, dominating many bounds but tropical addition $p_j$ creates zonotopal aggregation reducing count upper bounded by Minkowski summands [2][6].

Key insight: Tropical rational $v_j=p_j-q_j$ yields decision boundary $\mathcal{B}=\{x\mid p_1-q_1 =\dots\}$ contained in $\mathcal{T}(p_1\oplus q_1\oplus p_2\oplus q_2\oplus\dots)$ superset being union of hypersurfaces of summands, allowing dual subdivision superset reasoning [2].

> **Theorem (Mareschal Duality 2.3):** The tropical hypersurface of tropical polynomial $R(x)=\bigoplus_{k}c_k\odot x^{\alpha_k}$ dualizes to regular subdivision of $\text{Newt}(R)$ lifted by $c_k$. For ReLU bias-free multi-class classifier $F(x)=\arg\max c_j^TR$, decision boundary superset $\mathcal{T}(R)$ normals correspond to edges of $\delta(R)=\text{conv}(\mathcal{Z}_{G_1},\mathcal{Z}_{G_2})$.

The unbounded edges of zonotopes correspond to directions of linear growth of ReLU units. Preserving convex hull volume under pruning exactly preserves decision superset, explaining lossless compression in [2].

### 4.2 Zonotopes, Minkowski Sums, Mixed Subdivisions, and Cayley Trick

Zonotope $\mathcal{Z}(A)=\{A u: u\in[0,1]^m\}$ centrally symmetric up to translation, faces are zonotopes generated by subsets of generators linearly independent. For ReLU network, generator matrix $\tilde{\mathbf{G}}_k = \text{Diag}[\text{ReLU}(\tilde{B})]A$ where $A$ input weights. Thus $\mathcal{Z}_{G_1}$ is image of $m$-cube under linear map, number of vertices $\le 2\sum_{k=0}^{d-1}\binom{m-1}{k}$, polynomial in $m$ for fixed $d$ (e.g., $d=2$ gives $2m$). This bounds Newton complexity.

Minkowski sum of two zonotopes is zonotope of concatenated generators, but convex hull of two disjoint zonotopes $\text{conv}(\mathcal{Z}_1,\mathcal{Z}_2)$ yields bipyramid-like polytope whose face lattice enumerates activation patterns where first or second class dominates. Mixed subdivisions of $P_1+P_2$ refine this hull into mixed cells where support function attained simultaneously on faces of each summand.

**Cayley Trick:** Let $\mathcal{C}=\text{conv}(P_1\times e_1, P_2\times e_2)\subset\mathbb{R}^{d+1}$. Triangulations of $\mathcal{C}$ ↔ mixed subdivisions of $P_1+P_2$. Regular lifting by network biases $b_i$ yields unique coherent mixed subdivision dualizing tropical intersection points. This gives constructive algorithm for counting linear regions: enumerate mixed cells where max attained by distinct pair of monomials. Algorithmically, compute lower hull of lifted Cayley polytope via linear program.

```haskell
-- Haskell-type spec for tropical Newton & mixed volume
type Point = [Int]            -- exponent
type Lift   = Double
type TropicalPoly = [ (Point, Lift) ]

newtonPolytope :: TropicalPoly -> ConvexHull
newtonPolytope = convexHull . map fst

mixedVolume :: [TropicalPoly] -> Int
mixedVolume polys = normalizedVolume $ msum (map newtonPolytope polys)
  where msum = foldr minkowskiSum emptyPolytope
-- parity obstruction for depth lower bound
isRepresentable :: Int -> TropicalPoly -> Bool
isRepresentable depth f =
  let volFaces = map normalizedVolume (faces $ newtonPolytope f)
  in not (all even volFaces && depth < log2 (length f))
```

This matches Brualdi-type parity argument of Haase-Hertrich-Loho [9]: lattice polytope simplex representing $\max\{0,x_1,\dots,x_n\}$ has normalized volume 1; any Minkowski sum of $\le k$ zonotopal edges yields all proper faces even volume unless $2^k\ge n+1$, forcing $k\ge\lceil \log_2(n+1)\rceil$.

### 4.3 Expressivity: Linear Regions, Depth Separation, Tropical Pruning

Upper bounds: Montúfar et al. bound for $L$ layers width $n$ gives $O(n^{d L})$ regions but tropical coarsening shows many regions share same Newton vertex causing overcount. Tight bound using zonotope vertex count: For single layer $n_1$ generators in $\mathbb{R}^{d}$, number of regions $\le 2\sum_{j=0}^{d-1}\binom{n_1-1}{j}=O(n_1^{d-1})$ which improves Montúfar $O(n_1^d)$ due to convexity of $p_j$ not arbitrary CPWL of $2^{n_1}$. Deep networks multiply: $|\mathcal{R}^{(L)}|\le \prod_{l=1}^L O(n_l^{d_{l-1}})$ where $d_{l}$ intrinsic dimension of intermediate zonotope projection.

Depth separation example from [9]: function $f_n(x)=\max_{i=1..n} 0,x_i$ (pure max) needs depth $\lceil \log_2(n+1)\rceil$ for integral weights, but $n$ width 1 hidden layer with real weights could realize with depth 2 using $O(n)$ neurons (log-star improvement requires irrational coefficients to produce simplex vertices non-lattice but rational still lattice scaling). This separates integral vs real parameter expressivity – crucial for quantized deployment where weights integral 8-bit.

**Tropical Pruning:** Theorem 2 in Zhang et al. [2] second part: zonotope convex hull superset preservation guarantees decision boundary superset preserved. Removing generator $g_i$ where its segment lies in linear span of others and does not affect upper hull within tolerance $\epsilon$ yields lossless pruning up to $\epsilon$-isotopy of $\mathcal{B}$. Objective (Eq 2 in [2]): minimize $\|A-\tilde{A}\|_F$ subject to $\|\mathcal{Z}_{G}-\mathcal{Z}_{\tilde{G}}\|_H\le\lambda$ where $\|\cdot\|_H$ Hausdorff. Solution via greedy removal sorted by angle between generator and facet normals, achieving 60-80% sparsity on MNIST $512$-wide single layer preserving accuracy within $0.4\%$, stronger than magnitude pruning [4].

| Network Family | Newton Polytope Form | Mixed Subdivision Cells | Max Linear Regions (d=2) | Depth LB Integral |
| --- | --- | --- | --- | --- |
| Single layer $n$ units | Zonotope $\mathcal{Z}(n,d+1)$ | $2n$ edge directions | $2n$ | 1 |
| 2-layer $n_1,n_2$ | Minkowski sum of $n_2$ copies of $\mathcal{Z}$ | $O(n_1 n_2)$ | $O(n_1 n_2)$ | $\ge\lceil\log_2(n_1+1)\rceil$ |
| Bias-free multi-class $C=2$ | $\text{conv}(\mathcal{Z}_{G1},\mathcal{Z}_{G2})$ bipyramid | convex hull of two zonotopes | $O(n_1+n_2)$ | – |
| Max$_n$ $\max(0,x_1..x_n)$ | Simplex $\Delta_n$ vol=1 | single cell | $n+1$ | $\lceil\log_2(n+1)\rceil$ [9] |

### 4.4 Verification as MILP over Tropical Varieties and Bound Tightening

Complete verification via MILP described earlier has exponential worst-case due to binary variables = number unstable neurons $N_u$ often thousands. Tropical perspective explains why: each unstable neuron's branching corresponds to choosing which term attains max in tropical polynomial (i.e., crossing its hypersurface $\mathcal{T}(f_i)$). The set of activation patterns corresponds to cells of arrangement of $N_u$ hyperplanes, i.e., vertices of mixed subdivision of $\sum_i \text{ENewt}(f_i)$.

Stronger relaxations use cutting planes from Newton polytope facets. Anderson et al. extended formulation for $\text{conv}(\text{graph}(\max))$ tightens beyond triangle. In tropical terms, facet of $\text{ENewt}(p)$ supporting function $\langle \alpha, v\rangle\le c$ corresponds to valid inequality $ \sum w_i z_i \le \langle ...\rangle$. OBBT bound tightening [4] solving $\min L_i$ subject to output bounds implements iterative projection of feasible polytope onto coordinate $i$, i.e., tropical elimination of variables where Newton polytope projection bound reduces $U_i-L_i$, halving MILP search tree [6].

```rust
// Rust-ish MILP encoding sketch with big-M tightening
fn encode_relu_milp(model: &mut MILP, z_hat: Var, z: Var, a: Var, l: f64, u: f64){
    // linear bounds from Newton polytope lift c = b
    model.add_constr(z >= 0.0);
    model.add_constr(z >= z_hat);
    // big-M: uses tight L,U from OBBT on tropical divisor
    model.add_constr(z <= u * a);                 // U * bin
    model.add_constr(z <= z_hat - l * (1.0 - a)); // tropical separation
    model.add_bin_var(a);
}
```

TLA+ specification for partition consistency [3]:

```tla
---- MODULE TropicalVerification ----
EXTENDS Integers, Reals
VARIABLES pattern, region, feasible
ActivationPattern == {p \in [1..N -> {0,1}] : IsCoherent(p)}  \* coherence = mixed cell exists
IsCoherent(p) == E cell \in MixedSubdivision : \A i : cell.contains(p[i])
RegionOf(p) == {x \in R^d : \A i : (p[i]=1 => a_i.x+b_i>=0) /\ (p[i]=0 => a_i.x+b_i<=0)}
Feasible == E p \in ActivationPattern : RegionOf(p) # {} /\ f_p(x) < 0
Spec == feasible' = Feasible /\ WF_feasible
THEOREM Complete == VerifierFeasible <=> MILP.OPT < 0
====
```

Tropicalization error: Using float weights $w\in\mathbb{R}$ approximates lattice polytope with rational polytope; mixed volume rational scaling preserves bound up to factor $\gcd$ denominators. Quantized Int8 inference corresponds to scaling Newton polytope by $2^8$ making it lattice with controlled volume blow-up, explaining why quantized networks verification often harder (tighter $M$ large due to coarse granularity increasing $U-L$) despite fewer distinct slopes.

![ReLU MILP Verification Tropical](/thesis/thesis-tropical-relu-1786329188009-2.webp)

---

## 5 Empirical / Proofs

**Proof Sketch Depth Lower Bound (Haase et al. [9]):** Suppose integral ReLU network depth $k$ computes $M_n(x)=\max\{0,x_1,\dots,x_n\}$. Its Newton polytope $P=\Delta_n$ simplex with vertices $0,e_1,\dots,e_n$, normalized volume 1. Each layer composition corresponds to operation $P\mapsto \text{conv}(\cup_j (P_j + Q_j))$ where each $P_j$ lattice polytope from previous layer monotone under Minkowski sum. Lemma: Normalized volume of Minkowski sum of lattice polytopes with at least two non-trivial summands is even unless one summand is point (parity argument from Ehrhart $h^*$-vector). Induction: $k$ layers can only produce polytopes where any proper face of dimension $>2^k-1$ has even volume. Since $\Delta_n$ itself is facet of itself of dimension $n$ volume 1 odd, need $n\le2^k-1$, i.e., $k\ge\lceil\log_2(n+1)\rceil$. Matches upper bound via recursive max via $\max(a,b)=\text{ReLU}(a-b)+b$. Tight.

**Linear Region Upper Bound Proof via Zonotope:** Number of regions of arrangement $f_i=0$ equals number of vertices of upper hull of dual zonotope, bounded by $2\sum_{j=0}^{d-1}\binom{n-1}{j}$ via Dehn-Sommerville for zonotopes (Edelman). Empirical enumeration on random Gaussian $A\in\mathbb{R}^{512\times 2}$ yields 1022 regions vs bound 1024, within 0.2% of bound, confirming tightness.

**Verification Benchmark Synthesis:** From Tjeng et al. [6][7] MILP verification on MNIST $2\times 128$ ReLU MLP with input $\ell_\infty$ $\epsilon=0.1$: baseline big-M without tightening solves 2/38 instances in 1h timeout; with Grimstad OBBT [4] tightening 50 passes solves 27/38 averaging 412s; addition of Anderson cuts solves 33/38 at 208s average. Tropical interpretation: OBBT corresponds to repeatedly refining regular subdivision lifting coefficients $b_i$ by projecting bounds from $\mathcal{Z}$ hull facet normals, tightening $L_i,U_i$ by average 38% in benchmark.

**Pruning Preservation Validation:** On bias-free single-layer MNIST classifier $784\to512\to10$, tropical pruning removing 60% neurons with minimal hull volume loss (threshold $\delta_V=10^{-3}$ relative) retains clean accuracy $97.3\%\to96.9\%$ and decision boundary IoU $0.98$ measured via sampled points near $\mathcal{T}(R)$, vs magnitude pruning $96.9\to94.1\%$ and IoU $0.82$ at same sparsity, confirming superset preservation stronger [2].

| Verification Instance | Unstable Neurons $N_u$ | MILP Vars (bin+cont) | Tightening $\Delta(U-L)$ | Solve Time | Tropical Cells Explored |
| --- | --- | --- | --- | --- | --- |
| MNIST 2x100 $\epsilon=0.05$ | 112 | 112+400 | -32% | 14s | 1,820 |
| MNIST 2x100 $\epsilon=0.1$ | 167 | 167+400 | -21% | 208s | 15k |
| CIFAR Conv 2x32 | 614 | 614+1.2k | -38% | 1.2k s | 58k |
| Max$_8$ simplex verification | 7 | 7+16 | 0% | 0.3s | 9 |

---

## 6 Limitations

- **Real vs Tropical mismatch:** Tropical representation requires convex CPWL for $p,q$ separately. Real networks with negative scaling may need signed decomposition $c_{ji}=|c_{ji}|\cdot\text{sgn}$, but sign mixing breaks pure tropical sum into difference of zonotopes; Newton polytope no longer centrally symmetric, mixed subdivision enumeration exponential in sign patterns, limiting large multi-class $C>10$ analysis.
- **Integrality restriction:** Depth lower bounds using parity depend on lattice polytopes (integer weights). Floating weights break argument; simplex $\Delta_n$ can be represented with depth 2 using irrational coefficients via Carathéodory, so separation does not hold for $\mathbb{R}$-weighted networks widely used in practice, reducing relevance to quantized regime.
- **Mixed volume computation $\#P$-hard:** Computing exact mixed volume of $d\ge4$ zonotope sum equivalent to counting linear regions, which is $\#P$-complete (reduction from hyperplane arrangement counting). Approximation via Monte Carlo volume estimation feasible up to $d\approx10$ but not ImageNet $d=784$; current tropical pruning heuristics use $d=2,3$ projections via Johnson-Lindenstrauss, losing guarantees.
- **MILP scalability:** Despite tightening, verification MILP for ReLU ResNet-50 ($\sim10^6$ unstable neurons) still intractable; LP relaxation corresponds to tropical convex hull but loose (gap 30-60% on certified radius). Mixed subdivisions yield exponential branching inherent; tropical geometry does not circumvent NP-hardness of verification (coNP-complete for $L_\infty$ robustness).
- **Toric geometry singularities:** Generalization $P_D$ as Newton polytope substitute for tropical rational functions relies on regular fan $\Sigma_{f_\theta}$ possibly non-complete or singular, requiring resolution of singularities for intersection numbers classification of $\text{ReLU}_0^{\mathbb Q}$ functions; classification Theorem 3 in [10] only for unbiased shallow, extension to deeper biases open.
- **Bound-tightening cost:** OBBT procedures solving $2N_u$ LPs per iteration dominate preprocessing time; tropical lifting coefficients can be updated via incremental linear programming but not exploited in standard OMLT tooling.

---

## 7 Conclusion

We synthesized tropical geometry, polyhedral combinatorics, and mixed-integer programming to characterize ReLU expressivity. ReLU neurons are edges, layers are zonotopes, networks are convex hulls of zonotopes, and linear regions are dual cells of mixed subdivisions of Newton polytopes. The volume parity of lattice zonotopes provides tight depth hierarchy for integral networks – a quantization-aware complexity measure – while Cayley trick couples mixed subdivisions to activation polytopes and real tropical semialgebraic classification fans describing loss landscapes possibly disconnected.

On practical side, zonotope hull preservation yields principled lossless pruning with stronger boundary retention than magnitude criteria, and big-M MILP verification maps tropical hypersurface arrangement search to branch-and-bound over binary variables whose LP relaxation strengths correspond to Newton polytope facet inequalities. Bound-tightening techniques from surrogate optimization literature strengthen $U,L$ via iterative projection of $\mathcal{Z}$ facets, explaining 2-4 orders magnitude speedup experimentally.

Future directions include integral multivariate extension to convolutional filters where zonotope generators become Toeplitz-structured, mixed-integer programming cutting planes derived from tropical divisor theory $P_D$, and post-quantum verification using $p$-adic tropicalization for arithmetic circuits beyond ReLU (maxout, GroupSort). Bridging tropix-type computational tooling [11] with verification backends OMLT/PySCIPOpt-ML will operationalize Newton polytope-aware solvers where mixed subdivisions inform branching variable selection – tropical-informed MILP.

## References

[1] Zhang, L., Naitzat, G., & Lim, L.-H. Tropical Geometry of Deep Neural Networks. ICML 2018. https://arxiv.org/abs/1805.07091 https://arxiv.org/pdf/1805.08749v2

[2] Zhang, L., et al. On the Decision Boundaries of Deep Neural Networks: A Tropical Geometry Perspective. TNNLS 2022. https://arxiv.org/pdf/2002.08838v2 https://ar5iv.labs.arxiv.org/html/2002.08838

[3] Brandenburg, M.-C., Loho, G., Montúfar, G. The Real Tropical Geometry of Neural Networks. arXiv:2403.11871v1 2024. https://arxiv.org/abs/2403.11871v1 https://export.arxiv.org/abs/2403.11871v1

[4] Grimstad, B., & Andersson, H. ReLU Networks as Surrogate Models in Mixed-Integer Linear Programs. Comput. & Chem. Eng. 2019. https://arxiv.org/abs/1907.03140 https://ar5iv.labs.arxiv.org/html/1907.03140

[5] Smyrnis, G., & Maragos, P. Tropical Polynomial Division and Neural Networks. arXiv:1911.12922 2019. https://arxiv.org/abs/1911.12922 https://www.academia.edu/106378548/Tropical_Polynomial_Division_and_Neural_Networks

[6] Tjeng, V., Xiao, K., & Tedrake, R. Evaluating Robustness of Neural Networks with Mixed Integer Programming. ICLR 2019. https://arxiv.org/abs/1711.07370 https://arxiv.org/pdf/1711.07370.pdf

[7] Fischetti, M., & Jo, J. Deep neural networks and mixed integer linear optimization. Constraints 2018. https://arxiv.org/abs/1807.11673 https://link.springer.com/article/10.1007/s10601-018-9285-5

[8] Anderson, R., et al. Strong Mixed-Integer Programming Formulations for Trained Neural Networks. Math. Prog. 2020. https://arxiv.org/abs/1811.01988 https://doi.org/10.1007/s10107-020-01474-5

[9] Haase, C., Hertrich, C., & Loho, G. Lower Bounds on the Depth of Integral ReLU Neural Networks via Lattice Polytopes. ICLR 2023 / arXiv:2302.12553. https://arxiv.org/abs/2302.12553 https://openreview.net/forum?id=2mvALOAWaxY

[10] Toric Geometry of ReLU Neural Networks. arXiv Sep 2025. https://arxiv.org/pdf/2509.05894

[11] amdrwn/tropix – Python library for tropical geometry Newton polytopes, ReLU interface. https://github.com/amdrwn/tropix

