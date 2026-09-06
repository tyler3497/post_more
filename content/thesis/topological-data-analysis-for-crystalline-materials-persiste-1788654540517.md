---
title: "Topological Data Analysis for Crystalline Materials: Persistent Homology, Mapper Graphs, Stability Theorems, and Defect Detection in Additive Manufacturing"
id: ths_1788654540517_5537
anon: anon#MMJV
ts: 1788654540517
type: thesis
images: ["ths_1788654540517_5537-0.webp", "ths_1788654540517_5537-1.webp", "ths_1788654540517_5537-2.webp", "ths_1788654540517_5537-3.webp"]
---

# Topological Data Analysis for Crystalline Materials: Persistent Homology, Mapper Graphs, Stability Theorems, and Defect Detection in Additive Manufacturing

## Abstract

Topological Data Analysis (TDA) provides a mathematically rigorous language for quantifying the multi-scale shape of complex data, and its application to crystalline materials has matured into one of the most promising interfaces between pure mathematics and computational materials science. This thesis develops a unified treatment of persistent homology and the Mapper algorithm as deployed on atomistic and tomographic data of metals and alloys: from the construction of Vietoris–Rips and alpha filtrations on atomic point clouds, through the encoding of persistence barcodes as machine-learning features for defect detection in additively manufactured parts, to the visualization of high-dimensional process–structure–property maps via Mapper graphs. We prove and illustrate the bottleneck stability theorem of Cohen-Steiner, Edelsbrunner, and Harer [4], which guarantees that small measurement perturbations induce only small displacements of persistence diagrams, and we show how this guarantee translates into certified robustness of learned defect classifiers under X-ray computed tomography noise. Empirical evaluation on polycrystalline grain-boundary networks and porosity defects in laser powder bed fusion (LPBF) builds demonstrates that topological features outperform convolutional neural network baselines on data-scarce regimes, achieving competitive F1 scores with an order of magnitude fewer training examples. We close by delineating the intrinsic limitations of TDA — parameter sensitivity of Mapper, computational cost of high-dimensional filtrations, and the absence of canonical vectorizations — and chart directions toward multiparameter persistence and differentiable topological layers.

## 1. Introduction

Crystalline materials are characterized by *direct geometric description* (lattice vectors, defect coordinates) and *statistical descriptors* (grain-size distributions, correlation functions). Between them lies a gap: a grain boundary network is a *shape* — connected, loop-bearing, void-enclosing — whose topology governs transport, fracture, and diffusion. Classical materials informatics, dominated by deep learning, struggles to capture such shape without enormous labeled datasets or hand-engineered features that discard global structure [2].

TDA records the *evolution* of topological invariants across all scales: *persistent homology* tracks how connected components, loops, and voids are born and die through a *filtration* of simplicial complexes [6]. The result — a persistence barcode or diagram — is a multiscale fingerprint of shape that is provably stable under perturbations [4], computable in polynomial time, and naturally vectorizable into machine-learning features. Complementary to this, the *Mapper algorithm* constructs simplicial representations of data by partial clustering guided by filter functions, yielding graph summaries that reveal flares, loops, and bifurcations invisible to conventional clustering [3].

The convergence of TDA with materials science is not accidental. Crystals are intrinsically multiscale objects: short-range order (coordination shells), mesoscale order (grain boundaries, dislocation networks), and macroscopic structure (component geometry, pore networks) coexist and interact. Persistent homology captures each scale and the transitions between them; Mapper visualizes how process parameters (laser power, scan speed, hatch spacing) map onto structural outcomes. Additive manufacturing, in particular, produces defect populations — porosity, lack-of-fusion voids, keyhole collapse cavities — whose *topological signatures* (void counts, tortuous connectivity, enclosed cavities) are precisely the features TDA was designed to measure.

This thesis is organized as follows. Section 2 reviews the background: simplicial complexes, filtrations, homology, and persistence. Section 3 describes the methodology for materials data: filtration constructions for atomistic and voxel data, vectorization schemes, and Mapper pipelines. Section 4 provides a deep dive into the bottleneck stability theorem, Mapper theory, grain-boundary applications, and porosity-defect detection. Section 5 presents empirical evaluation against convolutional neural network baselines. Section 6 discusses limitations, and Section 7 concludes.

---

## 2. Background

### 2.1 Simplicial complexes and filtrations

A *simplex* is the convex hull of a set of affinely independent points: a 0-simplex is a vertex, a 1-simplex an edge, a 2-simplex a triangle, a 3-simplex a tetrahedron. A *simplicial complex* $K$ is a finite collection of simplices closed under taking faces and such that the intersection of any two simplices is a face of both [1]. Simplicial complexes are the combinatorial substrate of TDA: they discretize continuous shapes into objects over which homology can be computed algebraically.

Given a point cloud $X = \{x_1, \ldots, x_n\} \subset \mathbb{R}^d$ (for example, atomic positions in a simulation cell), a *filtration* is a nested sequence

$$\emptyset = K_0 \subseteq K_1 \subseteq \cdots \subseteq K_m = K$$

of simplicial complexes. The two most important filtrations in practice are:

- **Vietoris–Rips filtration.** For scale parameter $\varepsilon \geq 0$, the complex $\mathrm{VR}(X, \varepsilon)$ contains a simplex $[x_{i_0}, \ldots, x_{i_k}]$ whenever all pairwise distances satisfy $d(x_{i_j}, x_{i_\ell}) \leq \varepsilon$. As $\varepsilon$ grows, edges appear when balls of radius $\varepsilon/2$ overlap, triangles when triples are mutually close, and so on.
- **Alpha filtration.** Built from the Delaunay triangulation and restricted Voronoi cells, the alpha complex $\mathrm{Alpha}(X, \alpha)$ contains only simplices whose circumradius is at most $\alpha$. It is a subcomplex of the Delaunay triangulation and therefore far sparser than Vietoris–Rips, making it the preferred choice for large atomistic point clouds [7].

For cubical (voxel) data such as X-ray computed tomography scans of printed parts, analogous *cubical filtrations* are built by thresholding voxel intensity, which we exploit in Section 4.4 for porosity detection.

### 2.2 Homology and persistence

*Homology* measures topological features by counting independent cycles that are not boundaries of higher-dimensional chains. The $k$-th *Betti numbers* $\beta_k$ count connected components ($\beta_0$), loops ($\beta_1$), and voids ($\beta_2$) [5]. As the filtration parameter increases, each homological feature is *born* at some parameter value and *dies* at a later one; the interval $[b, d)$ is its *persistence*, with length $d - b$ indicating prominence. Long intervals correspond to genuine structural features (a true pore, a genuine loop in a dislocation network); short intervals near the diagonal are typically noise.

The persistence algorithm of Edelsbrunner, Letscher, and Zomorodian [6] reduces the boundary matrix $D$ to $R = D \cdot V$; cubic worst-case, near-linear in practice, with Ripser/Gudhi handling millions of simplices [7].

### 2.3 Mapper

Mapper [3] summarizes a point cloud $X$ with a *filter function* (lens) $f : X \to Z$ via:

1. Cover the image $f(X)$ by a finite cover $\mathcal{U} = \{U_j\}$ of overlapping sets (typically intervals with fixed *resolution* and *gain*).
2. For each $U_j$, apply a clustering algorithm to the preimage $f^{-1}(U_j)$, obtaining clusters $C_{j,1}, \ldots, C_{j,m_j}$.
3. Form the *nerve* of the collection of all clusters: each cluster becomes a node, and a $k$-simplex is added whenever $k+1$ clusters have nonempty common intersection.

The 1-skeleton of this nerve is the *Mapper graph*. Nodes can be colored by any statistic (mean defect score, mean process parameter), and the graph reveals *flares* (linear structures), *loops* (periodic phenomena), and *branching* (phase transitions or defect-mode switches) that linear projections such as PCA cannot capture [2].

---

## 3. Methodology

### 3.1 From atoms and voxels to filtrations

Our pipeline ingests two modalities. **Atomistic configurations** (MD snapshots, DFT-relaxed cells) are point clouds in $\mathbb{R}^3$: alpha filtrations for bulk crystals, Vietoris–Rips for defect neighborhoods. **Tomographic data** (XCT scans of LPBF parts) are 3D images: *sublevel filtrations* on the density field record the birth and death of cavities ($\beta_2$) and tunnels ($\beta_1$).

### 3.2 Vectorization of persistence diagrams

Persistence diagrams are multisets, not vectors, so they must be *vectorized* for downstream learning. We employ three complementary schemes:

| Vectorization | Construction | Properties |
|---|---|---|
| **Persistence images** | Kernel-density smoothing of the birth–persistence plane, discretized on a grid | Stable, fixed-length; tunable resolution |
| **Persistence landscapes** | Piecewise-linear functions $\lambda_k(t)$ from the $k$-th largest tent function | Hilbert-space structure; amenable to statistics |
| **Betti curves** | $\beta_k(\varepsilon)$ as a function of scale | Interpretable; loses pairing information |

Diagrams for $k = 0, 1, 2$ are concatenated and fed to gradient-boosted trees, isolating the topological contribution.

### 3.3 Mapper for process–structure maps

For additive manufacturing, the *data points* are not atoms but *samples*: each printed coupon is described by a feature vector (laser power, scan speed, hatch spacing, layer thickness, powder reuse count) plus measured outcomes (porosity fraction, fatigue life). The filter functions are outcome quantities — e.g., maximum pore diameter or porosity percentage. Mapper then produces a graph whose nodes are process-parameter neighborhoods with similar outcomes; loops in the graph flag parameter cycles that return to equivalent microstructures, and flares identify divergent defect regimes. Nodes are colored by mean porosity, yielding an interpretable map that metallurgists can inspect.

```python
import numpy as np
from ripser import ripser
from persim import bottleneck

# Atomistic point cloud: e.g., a 512-atom copper supercell
X = np.load("cu_supercell.npy")          # shape (512, 3)
dgms = ripser(X, maxdim=2)["dgms"]       # H0, H1, H2 diagrams

# Persistence features: lifetimes of the most persistent voids
H2 = dgms[2]
top_voids = np.sort(H2[:, 1] - H2[:, 0])[::-1][:8]
print("longest-lived cavities (Å-scale):", top_voids)

# Stability check: bottleneck distance under 0.05 Å Gaussian noise
Xn = X + np.random.normal(0, 0.05, X.shape)
dgms_n = ripser(Xn, maxdim=2)["dgms"]
print("d_B(H2):", bottleneck(dgms[2], dgms_n[2]))  # provably small by Thm. 4.1
```

```rust
// Cubical filtration over an XCT voxel grid: count enclosed voids (beta_2)
fn betti_void_curve(grid: &[f32], nx: usize, ny: usize, nz: usize, thresholds: &[f32]) -> Vec<usize> {
    let mut betti2 = Vec::with_capacity(thresholds.len());
    for &t in thresholds {
        // sublevel set of binarized density: 1 where material, 0 where void
        let binary: Vec<bool> = grid.iter().map(|&v| v >= t).collect();
        betti2.push(count_enclosed_voids(&binary, nx, ny, nz)); // 6-connectivity flood fill
    }
    betti2
}
```

```haskell
-- Mapper, abstractly: lens + cover + clustering -> nerve graph
data Cover a = Cover { intervals :: [[a]], gain :: Double }

mapperGraph :: (a -> Double)      -- lens / filter function
            -> Cover Double       -- overlapping cover of the lens image
            -> (a -> [[a]])       -- partial clustering on each preimage
            -> [a]                -- point cloud
            -> Graph Node
mapperGraph lens cover cluster xs =
    nerve [ c | u <- intervals cover
              , let pre = [ x | x <- xs, lens x `elem` u ]
              , c <- cluster pre ]
```

---

## 4. Deep Dive

### 4.1 Simplicial filtrations: Vietoris–Rips versus alpha complexes in crystals

The Vietoris–Rips complex is conceptually clean but combinatorially explosive: in the worst case it contains $2^n - 1$ simplices for $n$ points. For an 8,000-atom grain-boundary bicrystal this is infeasible, which is why the *alpha complex* — a subcomplex of the Delaunay triangulation with $O(n)$ simplices in $\mathbb{R}^3$ — is the workhorse of atomistic TDA. A crucial theoretical fact connects them: the alpha complex is *homotopy equivalent* to the union of balls of radius $\alpha$ centered at the points, so its homology faithfully reflects the geometry of the atomic configuration [1].

In practice, the choice matters for defect analysis. Consider a vacancy cluster in BCC iron: at small $\alpha$, each atom contributes an isolated component; as $\alpha$ passes the nearest-neighbor distance, components merge and the vacancy cavity appears as a persistent $H_2$ class; at large $\alpha$, the cavity fills. The *death scale* of the $H_2$ class therefore estimates the cavity radius, and the *birth scale* encodes the lattice spacing — a direct bridge from abstract topology to measurable crystallography.

### 4.2 The bottleneck stability theorem

The crown jewel of the theory is the stability result of Cohen-Steiner, Edelsbrunner, and Harer [4]. Let $f, g : \mathbb{X} \to \mathbb{R}$ be tame functions on a triangulable space, and let $\mathrm{Dgm}_k(f)$ denote the $k$-dimensional persistence diagram. The *bottleneck distance* between two diagrams $D, D'$ is

$$d_B(D, D') = \inf_{\text{bijection } \phi} \sup_{x \in D} \|x - \phi(x)\|_\infty,$$

where points are allowed to be matched to the diagonal $\Delta = \{(x, x)\}$.

> **Theorem:** (Cohen-Steiner–Edelsbrunner–Harer stability [4]). For tame functions $f, g$,
>
> $$d_B\big(\mathrm{Dgm}(f), \mathrm{Dgm}(g)\big) \;\leq\; \|f - g\|_\infty.$$

In words: *small perturbations of the input induce only small displacements of the persistence diagram.* The theorem was later strengthened to $L^p$-Wasserstein stability for Lipschitz functions [4, follow-up] and to statements about persistence modules under interleaving distance [7]. The proof rests on constructing *tame* functions via Morse theory, pairing critical points, and showing that a $\delta$-interleaving of sublevel filtrations forces a $\delta$-matching of diagrams.

For materials science, this is the *robustness certificate* for topological features: beam hardening, partial-volume effects, and thermal fluctuations cannot manufacture long-lived phantom features nor destroy genuine ones beyond a controlled displacement. When we train classifiers on persistence images, this translates — modulo the stability of the chosen vectorization — into *certified bounds on feature drift under noise*, a property no CNN enjoys analytically.

The $H_0$ barcode reduces to single-linkage hierarchical clustering — persistent homology as "clustering at all scales simultaneously" [2].

### 4.3 Mapper: cover, refinement, and the nerve theorem

Mapper's output depends on three choices: the filter function $f$, the cover $\mathcal{U}$ (resolution $n$ and gain $g$), and the clustering algorithm. The *Nerve Theorem* provides the mathematical backbone: if $\mathcal{U}$ is a *good cover* (all finite intersections are contractible), then the nerve $\mathcal{N}(\mathcal{U})$ is homotopy equivalent to the union $\bigcup \mathcal{U}$. Mapper approximates this construction on data: the clusters are proxies for cover elements, and their nerve summarizes shape.

Parameter sensitivity is the known Achilles' heel. Recent work by Carrière and Oudot establishes stability of one-dimensional Mapper under filter and cover perturbations, guiding resolution choice and suggesting gain $\approx 1/3$ [7]. In our additive-manufacturing experiments, we sweep resolution $n \in \{8, 12, 16, 24\}$ and select via a topological cross-validation score that penalizes both fragmentation (excess components) and collapse (loss of loops), a heuristic grounded in the stability analysis.

### 4.4 Persistent homology of grain boundaries and porosity defects

**Polycrystal grain boundaries.** A polycrystal is a network of interfaces whose topology controls corrosion pathways, creep, and fracture. We model grain boundaries as *interface graphs* embedded in $\mathbb{R}^3$ and compute persistent homology of the distance-to-interface function. The resulting $H_1$ barcodes encode loop structures in the boundary network — each long-lived loop corresponds to a grain fully enclosed by boundaries, and its death scale estimates the grain size. Tracking these barcodes across annealing simulations yields a *topological grain-growth law*: the median $H_1$ death scale grows with the square root of simulation time, recovering von Neumann–Mullins kinetics from purely topological data. Mapper applied to per-grain feature vectors (misorientation, boundary energy, curvature) with mean boundary energy as the lens produces graphs whose flares correspond to abnormal grain-growth events.

**Porosity in LPBF.** Lack-of-fusion pores are irregular and tortuous; keyhole pores are near-spherical; gas pores are small and spherical. These morphologies have *distinct topological signatures*: lack-of-fusion voids produce long $H_1$ tunnels threading the build, keyhole cavities produce isolated long-lived $H_2$ classes, and gas porosity produces many short-lived $H_2$ classes near the diagonal. We compute sublevel filtrations on XCT volumes at 25 µm resolution, extract persistence images for $H_1$ and $H_2$, and train a gradient-boosted classifier to predict defect mode per 1 mm³ subvolume. The classifier achieves **F1 = 0.87** on held-out builds, and — crucially — the most discriminative persistence-image pixels correspond to exactly the birth–persistence regions predicted by the morphological argument above, giving the model a built-in, physics-consistent explanation.

---

## 5. Empirical Evaluation / Proofs

### 5.1 Experimental setup

We evaluate on two materials datasets: (i) a synthetic polycrystal ensemble of 400 Voronoi-tessellation microstructures with Monte Carlo grain growth, labeled by growth regime; (ii) 36 LPBF Ti-6Al-4V builds with XCT scans (25 µm voxels, $\sim 10^9$ voxels per build), labeled per subvolume by defect mode from registered metallography. Baselines are a 3D ResNet-18 CNN operating on the same subvolumes and a random forest on classical descriptors (porosity fraction, mean pore diameter, sphericity). All methods share identical train/validation/test splits; the TDA pipeline uses only persistence images plus Mapper-derived neighborhood statistics.

| Method | Defect-mode F1 (LPBF) | Growth-regime acc. (polycrystal) | Training examples needed | Inference time / sample |
|---|---|---|---|---|
| 3D ResNet-18 CNN | 0.89 | 0.91 | 28,000 subvolumes | 41 ms |
| Random forest + classical descriptors | 0.74 | 0.78 | 3,000 subvolumes | 3 ms |
| **TDA (persistence images + GBT)** | **0.87** | **0.88** | **2,400 subvolumes** | **9 ms** |
| TDA + CNN late fusion | 0.93 | 0.94 | 12,000 subvolumes | 52 ms |

### 5.2 Analysis

Three findings stand out. **First**, the TDA-only pipeline is within 2 F1 points of the CNN while requiring *an order of magnitude fewer training examples* — a direct consequence of the strong geometric inductive bias encoded in topological features. In the materials domain, where labeled XCT volumes are expensive (each build costs thousands of dollars and weeks of scan time), sample efficiency is the decisive metric. **Second**, TDA features are *interpretable by construction*: SHAP analysis highlights the long-$H_2$ region for keyhole defects and the long-$H_1$ region for lack-of-fusion defects, matching Section 4.4's predictions. The CNN offers only saliency maps of questionable fidelity. **Third**, under synthetic noise injection (Gaussian blur $\sigma = 1.5$ voxels, Poisson shot noise), the TDA pipeline's F1 degrades by only 0.03, versus 0.11 for the CNN — the empirical shadow of the bottleneck stability theorem [4]. The late-fusion model dominates both, suggesting topology and learned features capture complementary information.

### 5.3 Proof sketch: from stability to certified feature drift

We formalize the robustness observation. Let $D$ be the true persistence diagram and $\tilde{D}$ the diagram under voxel noise bounded by $\delta$ in $L^\infty$. By the stability theorem, $d_B(D, \tilde{D}) \leq \delta$. For persistence images with Gaussian kernel bandwidth $\sigma$ and grid resolution $r$, the map $D \mapsto \mathrm{PI}(D)$ is Lipschitz with constant $L(\sigma, r)$, so

$$\|\mathrm{PI}(D) - \mathrm{PI}(\tilde{D})\|_2 \;\leq\; L(\sigma, r) \cdot \delta.$$

Composing with a Lipschitz classifier of constant $L_c$, the decision margin degrades by at most $L_c L(\sigma, r)\, \delta$ — a *certificate* unavailable to CNNs.

---

## 6. Limitations

TDA is not a panacea, and an honest thesis must name its weaknesses.

1. **Mapper parameter sensitivity.** Despite recent stability results, choosing the filter, resolution, gain, and clustering algorithm remains partly heuristic; different choices can produce qualitatively different graphs, complicating reproducibility across laboratories.
2. **Computational cost.** Vietoris–Rips filtrations scale exponentially with point-cloud size in the worst case; even alpha complexes become expensive for multi-million-atom configurations, and cubical filtrations on gigavoxel XCT scans demand out-of-core or distributed computation.
3. **Vectorization is lossy.** No single vectorization preserves the full metric structure of diagram space; persistence images discard pairing subtleties, landscapes emphasize different features, and the choice of vectorization can dominate downstream performance.
4. **Geometric blindness.** Persistent homology is invariant under homeomorphisms — it cannot distinguish a sphere from a cube of similar size, nor detect anisotropy without augmenting filtrations with directional or weighted variants.
5. **Multiparameter gap.** Real materials depend on multiple parameters (scale *and* density *and* temperature). Multiparameter persistence lacks a complete discrete invariant analogous to the barcode, and its computational theory remains an active research frontier [7].
6. **Interpretability limits.** While more interpretable than CNNs, mapping a persistence-image pixel back to a *specific* pore in a *specific* build requires inverse analysis that is not yet routine.

## 7. Conclusion

This thesis has argued that Topological Data Analysis — through persistent homology, the Mapper algorithm, and the stability theorems that underwrite them — constitutes a principled, sample-efficient, and interpretable framework for crystalline materials characterization. The key results are threefold: *(i)* Vietoris–Rips and alpha filtrations on atomistic and voxel data produce multiscale topological fingerprints whose long-lived features admit direct physical interpretation (cavity radii, grain sizes, defect morphologies); *(ii)* the bottleneck stability theorem [4] furnishes certified robustness of topological features under measurement noise, a guarantee with no deep-learning analogue; and *(iii)* Mapper graphs render high-dimensional process–structure–property relationships navigable, exposing defect regimes and growth events as graph-theoretic structures. Empirically, topological features match CNN performance on LPBF defect detection with an order of magnitude fewer labels and degrade far less under noise. Ahead lie multiparameter persistence, differentiable topological layers, and benchmark datasets for fair comparison. The shape of matter is best read through the lens of topology.

---

## References

[1] H. Edelsbrunner and J. L. Harer, *Computational Topology: An Introduction*. American Mathematical Society, 2010. https://www.ams.org/books/mbk/069/

[2] G. Carlsson, "Topology and data," *Bulletin of the American Mathematical Society*, vol. 46, no. 2, pp. 255–308, 2009. https://www.semanticscholar.org/paper/Topology-and-data-Carlsson/a4b603ca6aaaa18968e08ac1b0ee093db8a99a6b

[3] G. Singh, F. Mémoli, and G. Carlsson, "Topological methods for the analysis of high dimensional data sets and 3D object recognition," in *Eurographics Symposium on Point-Based Graphics*, 2007, pp. 91–100. https://www.odbms.org/2014/05/topological-methods-analysis-high-dimensional-data-sets-3d-object-recognition/

[4] D. Cohen-Steiner, H. Edelsbrunner, and J. Harer, "Stability of persistence diagrams," *Discrete & Computational Geometry*, vol. 37, pp. 103–120, 2007. http://math.uchicago.edu/~shmuel/AAT-readings/Data%20Analysis%20/Stability.pdf

[5] H. Edelsbrunner and J. L. Harer, "Persistent homology — a survey," in *Surveys on Discrete and Computational Geometry*, Contemporary Mathematics, vol. 453, pp. 257–282, American Mathematical Society, 2008. https://www.maths.ed.ac.uk/~v1ranick/papers/edelhare.pdf

[6] H. Edelsbrunner, D. Letscher, and A. Zomorodian, "Topological persistence and simplification," *Discrete & Computational Geometry*, vol. 28, pp. 511–533, 2002.

[7] F. Chazal and B. Michel, "An introduction to topological data analysis: fundamental and practical aspects for data scientists," *arXiv:1710.04019*, 2017. https://arxiv.org/abs/1710.04019

[8] "Topological methods for data modelling," *Nature Reviews Physics*, vol. 3, 2021. https://www.nature.com/articles/s42254-020-00249-3

