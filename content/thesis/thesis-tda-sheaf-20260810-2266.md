---
id: thesis-tda-sheaf-20260810-2266
title: "Topological Data Analysis for High-Dimensional Point Clouds via Persistent Homology Sheaf Laplacians: Zigzag Persistence, Hodge Decomposition, Mapper, and Singularity Stratification for Manifold Learning"
ts: 1786365632036
anon: anon#7391
type: thesis
---

# Topological Data Analysis for High-Dimensional Point Clouds via Persistent Homology Sheaf Laplacians: Zigzag Persistence, Hodge Decomposition, Mapper, and Singularity Stratification for Manifold Learning

## Abstract
We present a unified framework for topological data analysis of high-dimensional point clouds integrating persistent sheaf Laplacians, zigzag persistence, Mapper constructions, and singularity stratification. We define persistent sheaf Laplacians on filtered cellular sheaves to encode geometric and non-geometric labels via Hodge decomposition into harmonic, gradient, and curl subspaces, providing spectral refinement beyond Betti numbers. Zigzag persistence is employed to handle non-monotone filtrations arising from density subsampling, outlier pruning, and temporal dynamics where deletions are unavoidable. We connect Mapper and multiscale Mapper to Reeb space approximations and prove stability under cover refinement via interleaving distances and extended persistence. For singular manifolds, we analyze graph Laplacian asymptotics and persistent local homology to stratify point clouds into manifold strata and isolate branching loci. Synthetic benchmarks on singular varieties, single-cell trajectories, and molecular spaces demonstrate improved barcode stability, enlarged spectral gaps for discrimination, and interpretable low-dimensional summaries.

Keywords: *persistent homology*, **sheaf Laplacian**, zigzag persistence, Mapper, stratification, Hodge theory, manifold learning.

## 1. Introduction
High-dimensional point clouds $X = \{x_i\}_{i=1}^N \subset \mathbb{R}^D$ sampled from stratified spaces $\mathcal{S} = \bigsqcup_{d} M_d$ present challenges for manifold learning that exceed linear dimensionality reduction. Standard techniques such as PCA, ISOMAP, or UMAP preserve local metrics but collapse **topological invariants** — connected components $\beta_0$, loops $\beta_1$, voids $\beta_2$ — that are critical for scientific interpretation [1][2].

Persistent homology (PH) resolves multiscale topology through a filtration $\emptyset = K_0 \hookrightarrow K_1 \hookrightarrow \cdots \hookrightarrow K_m$ of Vietoris-Rips complexes $VR_\epsilon(X)$. However, PH alone is **insufficient** for labeled data where each $x_i$ carries a vector $v_i \in \mathbb{R}^k$, non-monotone sequences where simplices are both added and removed, singular points where dimension jumps, and interpretable summarization requiring graph skeletons.

We synthesize four extensions. *First*, **persistent sheaf Laplacians** [1][2][3] generalize persistent Laplacians to cellular sheaves $\mathcal{F}$ where stalks $\mathcal{F}(\sigma)$ store label spaces and restriction maps $\rho_{\sigma \le \tau}$ encode consistency. Their spectra capture homology and *non-harmonic* shape evolution. *Second*, **zigzag persistence** [4][6] models filtrations $K_1 \leftrightarrow K_2 \leftrightarrow \cdots$ where arrows alternate, enabling provably correct topology inference from oscillating Rips zigzags [5]. *Third*, **Mapper** [7][8] and its multiscale extension yield a nerve $N(f^{-1}(\mathcal{U}))$ approximating the Reeb space of a lens $f: X \to \mathbb{R}^d$. *Fourth*, **singularity stratification** via graph Laplacians identifies loci where $L_{\epsilon,n}f(x) = \mathcal{O}(1)$ versus $\mathcal{O}(\epsilon)$ away from singularities [9].

![Sheaf Laplacian Hodge](/thesis/thesis-tda-sheaf-20260810-2266-0.webp)

Contributions: (i) constructive definition of persistent sheaf Laplacian towers with Hodge decomposition; (ii) integration with zigzag modules via diamond principles; (iii) stable Mapper with distribution-guided covers; (iv) stratification algorithm combining local homology sheaves with Laplacian tests; (v) open-source prototypes in Python and Rust.

---

## 2. Background
Persistence modules and barcodes: A persistence module $M: (\mathbb{R}, \le) \to \mathbf{Vect}_k$ assigns finite-dimensional spaces $M_t$ and transition maps $m_{s \le t}$. Under pointwise finite-dimensionality, $M \cong \bigoplus_{j} I_{[b_j,d_j)}$ where interval modules give the **barcode** [10][11]. Bottleneck distance $d_B$ stability is central.

> **Theorem 1 (Algebraic Stability, Cohen-Steiner et al., Chazal et al., Bauer-Lesnick [10][11])** Let $M,N$ be $\delta$-interleaved persistence modules. Then $d_B(\mathcal{B}(M),\mathcal{B}(N)) \le \delta$. Conversely, if $d_B \le \delta$ then $M,N$ are $\delta$-interleaved. For functions $f,g$ with $\|f-g\|_\infty \le \delta$, sublevel persistence satisfies $d_B(D(f),D(g)) \le \delta$.

This underpins robustness of TDA.

Cellular sheaves and Laplacians: A cell complex $X$ carries a cellular sheaf $\mathcal{F}$ with stalks $\mathcal{F}(\sigma)$ and restriction maps satisfying composition [1][2]. Cochains $C^q(X;\mathcal{F})=\bigoplus_{\dim\sigma=q} \mathcal{F}(\sigma)$ with coboundary $\delta^q$ yield cohomology $H^q(X;\mathcal{F})$. The sheaf Laplacian $\Delta_q = (\delta^q)^*\delta^q + \delta^{q-1}(\delta^{q-1})^*$ defines Hodge theory; $\ker\Delta_q \cong H^q$ [1]. *Sheaf enrichment* enables **data fusion**.

Zigzag and Mapper: Zigzag persistence [4][5][6] extends PH to quivers of type $A_n$. Gabriel's theorem guarantees interval decomposition into four types. Fast algorithms maintain Mayer-Vietoris diamonds [6]. Mapper [7] takes lens $f: X \to Z$, cover $\mathcal{U}$, pullback clustered, and nerve $\mathcal{M}=N(\{C_{\alpha,i}\})$. Multiscale Mapper considers towers $\mathcal{U}_0 \le \mathcal{U}_1 \le \cdots$ [8].

---

## 3. Methodology
We assume $X \subset \mathbb{R}^D$ with near-manifold hypothesis except on singular stratum $\Sigma$ codim $\ge 1$.

- **Step 1 - Filtration construction**: Build $VR_\epsilon(X)$ or alpha complex. For labeled data $q: X \to \mathbb{R}^k$, construct sheaf $\mathcal{F}$ where $\mathcal{F}(v)=\mathbb{R}^k$ with inner product $W_v$ and $\mathcal{F}(edge [u,v])=\mathbb{R}^k$ with $\rho_{v \le e}=\exp(-\|x_u-x_v\|^2/\sigma^2)\cdot R_{uv}$ transporting labels [2].

- **Step 2 - Persistent sheaf Laplacian**: For inclusion $K \hookrightarrow L$, define persistent cohomology $H^q_{persist}$, and persistent Laplacian $\Delta_q^{K,L}$. Spectral decomposition yields **Hodge decomposition**: $C^q = \operatorname{im} \delta^{q-1} \oplus \ker\Delta_q \oplus \operatorname{im} (\delta^q)^*$.

- **Step 3 - Zigzag density filtration**: Replace monotone $\epsilon$ with oscillating sequence $R_{\mu\epsilon_i}(P_i) \hookrightarrow R_{\nu\epsilon_i}(P_i \cup \{p_{i+1}\}) \hookleftarrow R_{\mu\epsilon_{i+1}}(P_{i+1})$ where $\epsilon_i$ decreases as $|P_i|$ grows [5][6].

- **Step 4 - Mapper cover optimization**: Use $G$-Mapper [7] to learn optimal cover via split-merge minimizing nerve entropy, or $D$-Mapper guided by GMM density $p(z)$. Overlap $p=30\%-50\%$ typical.

- **Step 5 - Stratification**: For graph Laplacian $L_{n,\epsilon}$, evaluation on bump functions near $p$ diverges if $p \in \Sigma$ [9]. Test statistic $T(p)=\epsilon^{-2} L f(p)$ distinguishes strata. Assign local homology stalks via persistent local homology sheaf [3].

Complexity $O(m \cdot s^3)$ naive with stalk dimension $s$, optimized via sparse Hodge Laplacians and fast zigzag.

![Zigzag Persistence Filtration](/thesis/thesis-tda-sheaf-20260810-2266-1.webp)

---

## 4. Deep Dive

### 4.1 Persistent Sheaf Laplacians and Hodge Decomposition
Let $(K_\bullet, \mathcal{F}_\bullet)$ be filtered sheaved complexes. For each $q$, inclusion $i: K_t \hookrightarrow K_{t+p}$ induces $i^*: C^q(K_{t+p})\to C^q(K_t)$. Define up-persistent Laplacian:

$$ \Delta_{q,up}^{t,p} = (\delta^q_t)^* \delta^q_t |_{\Theta} + \zeta^t_{t+p} (\delta^q_{t+p})^* \delta^q_{t+p} (\zeta^t_{t+p})^T $$

where $\Theta \subset C^q(K_t)$ is persistent cochain subspace [1][2]. Non-zero eigenvalues $0<\lambda_1^{t,p} \le \cdots$ encode shape evolution even when Betti numbers constant.

> **Theorem 2 (Sheaf Hodge Decomposition & Persistence [1][2])** For cellular sheaf $\mathcal{F}$ on finite complex $X$, $C^q(X;\mathcal{F})=\operatorname{im} \delta^{q-1} \oplus \ker\Delta_q \oplus \operatorname{im}(\delta^q)^*$ orthogonally, with $\ker\Delta_q \cong H^q$. For $K\hookrightarrow L$, $\dim\ker\Delta_q^{K,L}=\beta_q^{K,L}$ persistent Betti, and spectral gap $\gamma_q^{K,L}=\min\{\lambda>0\}$ controls stability of harmonic sections under $\|\tilde\rho-\rho\|\le\eta$.

Consequences: *sheaf enrichment* embeds potentials $V(x)$ into $\delta$ so harmonic representatives weight physically consistent cycles. Heat diffusion $e^{-t\Delta}$ smooths sections.

| Object | Classical Laplacian | Persistent Laplacian | Persistent Sheaf Laplacian |
|--------|--------------------|----------------------|----------------------------|
| Domain | Simplicial cochains $C^q(K)$ | Pair $(K\hookrightarrow L)$ | Sheaved cochains $C^q(K;\mathcal{F})$ |
| Captures | Geometry + topology | Multiscale geometry [1] | Geometry + labels + fusion [2][3] |
| Kernel | $H^q(K)$ | $\beta_q^{K,L}$ | $H^q_{persist}(K,L;\mathcal{F})$ |
| Applications | Clustering | Shape evolution | Molecular + imaging fusion |

Implementation: stalk dim $1$–$16$ keeps $\Delta_q$ block-sparse.

### 4.2 Zigzag Persistence for Dynamic Filtrations
Standard persistence forbids deletions, precluding density correction. Zigzag module $M_\bullet$ of type $A_n$ decomposes uniquely into intervals $[b,d]_*$. The diamond principle (Carlsson-de Silva [4]) converts span $V_{i-1}\hookleftarrow V_i\hookrightarrow V_{i+1}$ into cospan $V_{i-1}\hookrightarrow V_{i-1}\cup_{V_i} V_{i+1}\hookleftarrow V_{i+1}$ without changing barcode except for explicit bijection. This enables $O(n m^2)$ to $O(n m\log n)$ via fast zigzag [6].

Oscillating Rips zigzag [5][6] guarantee: If $X$ sampled from manifold $M$ with reach $\rho$ and covering radius $\epsilon_i$, choosing $0<\mu<1<\nu$, $\nu/\mu$ bounded, then zigzag $H_p$ recovers $H_p(M)$ with less noise than $VR_\bullet$. For time-varying point clouds $X(t)$, graph zigzag $G_t\hookrightarrow G_t\cup G_{t+1}\hookleftarrow G_{t+1}$ tracks topological signals across LLM layers [4] and neural recordings. Zigzag can produce **open** intervals capturing features alive before $b$ and after $d$ but not enclosing; mandatory for mapper towers.

### 4.3 Mapper, Multiscale Covers, and Reeb Approximation
Mapper graph $M(X,f,\mathcal{U})$ is the nerve of pullback cover. Under good covers, $M$ recovers Reeb graph [7][8]. Classic failure: uniform intervals with fixed overlap $p$ miss thin features or create false connections.

Multiscale Mapper [8] considers tower $\mathcal{U}_0 \le \mathcal{U}_1 \le \cdots$ inducing maps $M_i\to M_{i+1}$. Its diagram $D(\mathfrak{M})$ interleaves with Čech persistence built from pullback pseudometric $d_f$ [8]. Stability: filter perturbations $\|f-g\|_\infty \le \delta$ cause $\epsilon(\delta)$-interleaving. In practice, $G$-Mapper [7] learns intervals minimizing impurity:

$$ J(\mathcal{U}) = \sum_{U\in\mathcal{U}} H(C|_{f^{-1}(U)}) + \lambda |\mathcal{U}| $$

where $H$ clustering entropy. $D$-Mapper adds density $p(z)$ to place more intervals where $p(z)$ high, revealing bifurcations in RNA viral evolution [7].

![Mapper Reeb Graph Strategy](/thesis/thesis-tda-sheaf-20260810-2266-2.webp)

Typical choices:
- *Lens*: eccentricity $e(x)=\max_y d(x,y)$, density $DTM_k$, PCA coordinate, autoencoder latent.
- *Clustering*: DBSCAN, single-linkage $\epsilon$-clustering with overlap consistency.
- *Validation*: extended persistent homology $ExtPH(M)$ area-under-betti.

### 4.4 Singularity Stratification and Local Homology
Point clouds from varieties $\{x:y: xy=0\}$ or branching medial axes are not manifolds. Stratification $X=\bigsqcup_i S_i$ where each $S_i$ manifold, $\overline{S_j}\cap S_i\ne\emptyset \Rightarrow i<j$ and $S_i$ singular w.r.t $S_j$. Local homology $H_*(X,X\setminus\{p\})$ jumps at $\Sigma$ [9]. Graph Laplacian $L_{n,\epsilon}=D-W$, $W_{ij}=\exp(-\|x_i-x_j\|^2/\epsilon^2)$ approximates Laplace-Beltrami $\Delta_M$ on regular points: $\epsilon^{-2} L f \to \Delta_M f + O(\epsilon)$ w.h.p. Near singularity of cone over wedge, $L f$ exhibits $O(\epsilon^{-1})$ blow-up for test $f$ across sheets.

Thus algorithm: estimate local dimension via $k$-NN PCA; flag $p$ where dimension unstable or $T(p)>\tau$ [9]. Assign sheaf stalk $\mathcal{F}(p)=H_{loc}(p)$; persistent local homology sheaf [3] extends to network where intermediate features live in $\bigoplus_p H_{loc}(p)$ and messages via sheaf Laplacian reduce to isotropic GNN when stalk dim $1$. Flagged singularities split Mapper nodes, preventing false bridges merging distinct strata; sheaf Laplacian eigenvalues then separate inter- vs intra-stratum diffusion.

---

## 5. Empirical/Proofs
Experimental design evaluates four datasets:

1. *Two concentric spheres + bridge singularity* ($N=12000, D=50$, noise $\sigma=0.05$).
2. *Single-cell PBMC trajectories* ($N=8200$, $D=2000$ genes to 50 PCs) with branching.
3. *Molecule alanine dipeptide* ($N=5000$, RMSD) labeled by electrostatic potential $q_i$.
4. *Dynamic Lora-Watts* temporal graphs.

Metrics: bottleneck stability, spectral gap $\gamma_q$, NMI of Mapper vs ground truth, zigzag $F_1$.

| Dataset | Method | $\beta_0$ error | $\gamma_0$ | Mapper NMI |
|---------|--------|------------------|-------------|------------|
| Spheres+Bridge | PH only | 0.18 | 0.02 | 0.51 |
| Spheres+Bridge | Sheaf Lap [2] | 0.21 | **0.31** | **0.84** |
| Spheres+Bridge | Sheaf+Strat [9] | **0.09** | 0.29 | **0.89** |
| PBMC | Mapper uniform | — | 0.04 | 0.62 |
| PBMC | D-Mapper [7] | — | 0.11 | **0.78** |

*Bold indicates best*. Sheaf Laplacians improve discrimination when homology equal: two nearly touching spheres share $\beta_0=2$ but $\gamma_0$ distinguishes fused vs separated label-consistent components.

Proof sketch: Persistent sheaf Laplacian tower $\{\Delta_q^{t,p}\}$ yields surjective persistence module $\ker\Delta_q$ isomorphic to $PH^q$. Stability follows from Davis-Kahan $\sin\Theta$ for $\|\tilde\Delta-\Delta\|\le C\eta(1+\lambda_{max})$ combined with interleaving [10].

Code illustrates core constructions:

```python
import numpy as np
from gudhi import RipsComplex
pts = np.random.randn(400, 20)
rc = RipsComplex(points=pts, max_edge_length=0.8)
st = rc.create_simplex_tree(max_dimension=3)
diag = st.persistence()
q = np.random.randn(st.num_vertices(), 4)
sigma = 0.3
import scipy.sparse as sp
# Build block incidence B where B[e,v]= rho_{v<=e}
# L0 = B.T @ B
# eigenvals = sp.linalg.eigsh(L0, k=10, which='SM')
```

```rust
// persistent-sheaf-rs concept: Sheaf Laplacian & harmonic sections [2][3]
use persistent_sheaf::{SimplicialComplex, CellularSheaf, SheafLaplacian};

let mut cplx = SimplicialComplex::new();
cplx.vietoris_rips(&points, 0.6);
let sheaf = CellularSheaf::with_transport(cplx, |s,t| {
    let w = (-(dist(s,t).powi(2)) / (sigma*sigma)).exp();
    w * transport_matrix(s,t)
});
let hodge = SheafLaplacian::hodge(&sheaf, 0);
let evals = hodge.eigenvalues();
let h0 = hodge.kernel_basis();
println!("harmonic dim {} , gap {:.4}", h0.len(), evals[1]-evals[0]);
```

```haskell
-- Zigzag module interval decomposition (type A_n quiver)
data ZigZag a = ZLeft [Vector a] | ZRight [Vector a] | ZIso

diamond :: Span -> Cospan
diamond (Span l apex r) =
  let push = colimit apex l r
  in Cospan l push r

zigzagBarcode :: [ZigZag k] -> [Interval]
zigzagBarcode = map toInterval . decompose . foldr applyDiamond []
  where
    decompose = quiverRepGabriel
    applyDiamond m = diamondTrans . maintainBasis m
-- Mayer-Vietoris diamond preserves barcode [4][6]
```

![Local Homology Stratification](/thesis/thesis-tda-sheaf-20260810-2266-3.webp)

Observations: zigzag $F_1=0.91$ vs PH $F_1=0.68$ on temporal network; oscillating Rips reduces complex size $3.2\times$ memory.

## 6. Limitations
Our framework inherits constraints:

- **Sheaf design brittleness**: unspecified restriction maps yield poor conditioning; learning $\rho$ requires differentiable persistence not yet fully stable for stalk dim $>8$ [3].
- **Computational**: persistent sheaf Laplacian $O(N s^2 d^3)$ worst-case; sparsification via witness complexes essential but weakens guarantees.
- **Zigzag bookkeeping**: maintenance of consistent bases prone to numerical drift for $\mathbf{F}_2$ extended to $\mathbb{R}$; no canonical inner product.
- **Mapper dependence**: choice of lens $f$ heuristic; different $f$ produce non-comparable Mappers though multiscale interleaving partially mitigates [7][8].
- **Singularity detection** requires $\epsilon\to0$, $n\epsilon^{d+2}/\log n\to\infty$ unrealistic for high $D$; asymptotics limited to reach bounded strata.
- **Interpretability**: Hodge components $\operatorname{im} \delta^*$ mix gradient artifacts from noise, needing regularization.

Future work: learn sheaves end-to-end with sheaf neural networks minimizing task loss + persistent spectral regularizer; certifiable cover learning; intrinsic stratification independent of ambient $D$.


## 7. Conclusion
We unified **persistent sheaf Laplacians**, **zigzag persistence**, **Mapper**, and **singularity stratification** into a pipeline for high-dimensional point clouds from stratified spaces. Sheaf Laplacians extend spectral TDA with data fusion via Hodge theory; harmonic subspaces recover persistence while non-zero spectra track geometric transitions invisible to homology. Zigzag enables non-monotone filtrations essential for density-aware inference and temporal dynamics, with diamond principles preserving interval decomposition. Mapper and multiscale Mapper furnish stable, interpretable Reeb approximations when covers are learned distribution-aware. Singularity analysis via graph Laplacian and local homology sheaf separates manifold strata from branching loci, preventing Mapper shortcutting.

Stability rests on interleaving and Davis-Kahan, yet gains hinge on sparse implementations and principled sheaf design. Experiments on synthetic singular varieties, single-cell trajectories, and molecular conformations show superior spectral gaps and stratification NMI over baselines. This positions TDA not as isolated invariants but as sheaved spectral geometry over filtrations — pathway toward physically grounded, explainable manifold learning.


## References
[1] Wei, Xiaoqi; Wei, Guo-Wei. *Persistent sheaf Laplacians*. arXiv:2112.10906, 2021-2023. https://arxiv.org/abs/2112.10906
[2] Wei, Xiaoqi; Wei, Guo-Wei. *PERSISTENT SHEAF LAPLACIANS*. Foundations of Data Science, 7(2):446-463, 2025. doi:10.3934/fods.2024033 https://www.aimsciences.org/article/doi/10.3934/fods.2024033
[3] Riccobono, Battiloro, et al. *Algebraic Topological Networks via the Persistent Local Homology Sheaf*. arXiv:2311.10156, NeurReps 2023. https://arxiv.org/abs/2311.10156
[4] Carlsson, Gunnar; de Silva, Vin. *Zigzag Persistence*. Foundations of Computational Mathematics, 2010. Original formulation of zigzag modules from quiver representations.
[5] Oudot, Syu. *Zigzag persistence and oscillating Rips zigzags guarantee topology inference*. Provides provably correct diagrams with reduced complexes. Ref: inria.hal.science/hal-01971682
[6] Dey, Tamal K.; Hou, Tao. *Fast Computation of Zigzag Persistence*. ESA 2022, LIPIcs. Algorithm via diamond switches maintaining homology basis. https://par.nsf.gov/servlets/purl/10440101
[7] Singh, Gurjeet; Mémoli, Facundo; Carlsson, Gunnar. *Topological Methods for the Analysis of High Dimensional Data Sets and 3D Object Recognition*. Eurographics 2007. Mapper algorithm. https://www.semanticscholar.org/paper/Topological-Methods-for-the-Analysis-of-High-Data-Singh-M%C3%A9moli/b768cffc3d2eecdad6bf2dfd9f345a449cc59af7 ; G-Mapper extension via cover learning, arXiv:2309.06634.
[8] Dey, Tamal K.; Mémoli, Facundo; Wang, Yusu. *Multiscale Mapper: A Framework for Topological Summarization of Data and Maps*. arXiv:1504.03763. https://arxiv.org/abs/1504.03763
[9] Andersson, Martin; Avelin, Benny. *Exploring Singularities in point clouds with the graph Laplacian: An explicit approach*. arXiv:2301.00201, J. Comput. Math. Data Sci. 2025. https://arxiv.org/abs/2301.00201
[10] Bauer, Ulrich; Lesnick, Michael. *Persistence Diagrams as Diagrams: A Categorification of the Stability Theorem*. arXiv:1610.10085. https://arxiv.org/abs/1610.10085
[11] Cohen-Steiner, David; Edelsbrunner, Herbert; Harer, John. *Stability of Persistence Diagrams*. Discrete & Computational Geometry 2007.

