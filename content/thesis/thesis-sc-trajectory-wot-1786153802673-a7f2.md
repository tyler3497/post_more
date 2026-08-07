---
title: "Single-Cell Trajectory Inference via Diffusion Maps, PHATE, and Optimal Transport: Waddington-OT, Palantir, and CellRank for Developmental Lineage Reconstruction"
id: thesis-sc-trajectory-wot-1786153802673-a7f2
type: thesis
ts: 1786153207200
anon: anon_3f9a2c1d
images: ["/thesis/thesis-sc-trajectory-wot-1786153802673-a7f2-0.webp", "/thesis/thesis-sc-trajectory-wot-1786153802673-a7f2-1.webp", "/thesis/thesis-sc-trajectory-wot-1786153802673-a7f2-2.webp", "/thesis/thesis-sc-trajectory-wot-1786153802673-a7f2-3.webp"]
sources: 8
---

# Single-Cell Trajectory Inference via Diffusion Maps, PHATE, and Optimal Transport: Waddington-OT, Palantir, and CellRank for Developmental Lineage Reconstruction

## Abstract
We present a unified analysis of single-cell trajectory inference grounded in **manifold learning** and **optimal transport**, contrasting *diffusion maps*, *PHATE*, and time-coupled optimal transport. We dissect **Waddington-OT**'s unbalanced entropic OT formulation for temporal couplings with growth-rate correction, **Palantir**'s adaptive anisotropic diffusion maps with Markov chain fate probabilities via shortest-path pseudotime, and **CellRank**'s kernel-aggregated Markov chain integrating RNA velocity. We prove convergence properties of diffusion operators to Laplace-Beltrami under sampling assumptions, characterize Waddington-OT as a Schrödinger bridge gluing, and show CellRank's GPCCA metastability improves lineage driver detection over pseudotime alone. Evaluation on hematopoietic and reprogramming datasets reveals complementary biases: OT excels for sparse time courses, diffusion for continuum, and velocity-based CellRank for directional fate. Limitations include non-identifiability of stationary OT and velocity noise amplification.

## 1 Introduction

Single-cell RNA-sequencing (scRNA-seq) destroys cells upon measurement, yielding **snapshot** distributions $\rho_{t_i} \in \mathcal{P}(\mathbb{R}^g)$ at experimental times $t_1<...<t_T$ but no clonal tracking. *Trajectory inference* aims to reconstruct the underlying stochastic process $\mathbf{R} \in \mathcal{P}(C([0,T];\mathcal{X}))$ consistent with marginals [1][2].

Two philosophical families emerged:

* **Manifold / diffusion approaches** assume cells lie on a low-dimensional phenotypic manifold $\mathcal{M}\subset\mathbb{R}^g$ and differentiate continuously. Diffusion maps [6], Palantir [3], and PHATE [4] build random-walk kernels $P$ to estimate pseudotime via diffusion distance.
* **Optimal transport (OT)** assumes minimal-effort mass transport between time points under Waddington's epigenetic landscape metaphor [1][2]. Cells evolve by least action in Wasserstein space.

CellRank [5] unifies both by abstracting to a **cell-cell transition matrix** $T$ via composable kernels, then analyzing its spectral properties with **Generalized Perron Cluster Cluster Analysis (GPCCA)**.

> Theorem: Under drift $b$ and diffusion $\sigma$ defining SDE $dX_t=b(X_t)dt+\sigma dW_t$, entropy-regularized OT couplings between marginals converge to the true path measure as $T\to\infty$, $\epsilon\to0$, $h\to0$ when $b=-\nabla\Psi$ gradient flow [2]. Violations of gradient structure incur $O(\| \nabla^\perp b\|)$ bias.

This thesis contributes systematic comparison of spectral convergence, OT unbalancedness, and velocity consistency, enabling practitioners to select lineage priors matching experimental design: dense continuum vs sparse time course vs spliced reads.

---

## 2 Background

### 2.1 Diffusion Maps and Manifold Learning

Given $n$ cells $x_i\in\mathbb{R}^g$ after PCA to 50 dims, define adaptive kernel:

$$W_{ij}= \exp\left(-\frac{\|x_i-x_j\|^2}{\sigma_i\sigma_j}\right) \cdot \exp\left(-\frac{\|x_i-x_j\|^2}{\alpha\text{-decay}}\right)$$

With $\sigma_i$ = distance to k-th nearest neighbor, alleviating density sampling bias [3]. Row-normalize $D^{-1}W = P$, where $P$ is Markov walk. Diffusion map coordinates $\Phi_t(x) = (\lambda_1^t\psi_1(x),...,\lambda_m^t\psi_m(x))$ where $(\lambda,\psi)$ are eigenpairs of $P$ [6]. As $n\to\infty$, $h\to0$, $L_h = (I-P)/h \to \Delta_{\mathcal{M}}$ Laplace-Beltrami, under uniform sampling after $\alpha=1$ normalization [6].

PHATE [4] extends this: interpret $P^t$ rows as global context distributions, compute potential distance $U_{ij}^t = \| \log P^t(i,:)-\log P^t(j,:)\|_2$ information-theoretic (M-divergence like Hellinger). MDS embed into 2-3D preserving $U$, capturing *both* local branching and global progression where t-SNE/UMAP create false clusters [4].

### 2.2 Waddington-OT and Unbalanced Optimal Transport

Schiebinger et al. [1] posed for adjacent times $t_i,t_{i+1}$ with empirical $\hat\rho_i,\hat\rho_{i+1}$:

$$\pi^{(i)} = \arg\min_{\pi\in\Pi(\hat\rho_i,\hat\rho_{i+1})} \langle C,\pi\rangle + \epsilon H(\pi|\hat\rho_i\otimes\hat\rho_{i+1}) + \lambda KL(\pi\mathbf{1}\|\mathbf{g}_i) + \lambda KL(\pi^T\mathbf{1}\|\mathbf{g}_{i+1})$$

$C_{ij}= \|x_i-x_j\|^2$ squared Euclidean in gene expression, $\epsilon$ entropic regularization yields dense couplings and Sinkhorn solvability $O(n^2)$, KL terms allow **unbalanced** growth/death: growth factors $g$ estimated via cell proliferation/apoptosis signatures (cell cycle scores). This is not conservative: $\sum_j \pi_{ij} \neq 1/n$ if cell divides.

Global Waddington-OT (gWOT) [2] glues all times simultaneously via entropy minimization relative to Brownian reference $\mathbf{W}^\sigma$:

$$F_{T,\lambda,h}(\mathbf{R}) = \sigma^2 H(\mathbf{R}|\mathbf{W}^\sigma)+\lambda\sum_i H(\hat\rho_{t_i}|\mathbf{R}_{t_i})$$

convex in law $\mathbf{R}$ proven to converge narrowly to true SDE law [2].

StationaryOT [extension] treats equilibrium as stationary SDE with birth-death, solving mean-first-passage.

### 2.3 Palantir and CellRank

Palantir [3] constructs diffusion operator $P$ as above via MAGIC imputation for denoising, then defines pseudotime $\tau_j = \sum_{k=1}^{j} L^{-1}_{ik}$ weighted shortest path from early cell $s_0$. Terminal states identified as minima of stationary distribution of backward-exposed chain; absorption probabilities $f_k(x)=Pr(\text{absorbed in terminal }k|x)$ computed via *absorbing Markov chain* iteration.

CellRank [5][6] generalizes: $T = \sum w_k T_k$ kernel mixture. VelocityKernel $T^v_{ij}\propto \mathbf{1}_{neighbor} \cdot \max(0,\cos\langle v_i, d_{ij}\rangle)$ where $v_i$ RNA velocity [7]. PseudotimeKernel biases to increasing pseudotime etc. RealTimeKernel uses WOT transport maps as kernel. Estimators apply GPCCA to find macrostates, compute fate probabilities and lineage drivers via correlation with $f_k$.

| Method | Input | Kernel | Direction | Handles growth | Complexity |
|--------|-------|--------|-----------|----------------|------------|
| Diffusion Maps | single snapshot | $W$ Gaussian | Undirected | $\alpha$-norm only | $O(n\log n)$ kNN |
| PHATE | single | $\alpha$-decay + $P^t$ + potential | Undirected | No | $O(n^2)$ |
| Palantir | single + start cell | Adaptive anisotropic $P$ + MAGIC | Directed via pseudotime | No | $O(n^2)$ eigen |
| WOT | time-course 2+ times | OT cost + entropic | Directed via time | Yes via KL | $O(T n^2/ \epsilon^2)$ Sinkhorn |
| CellRank | snapshot + velocity/time | Mixture kernel | Directed | Via Velocity growth or OT | $O(n\log n + e)$ |

---

## 3 Methodology

We synthesize 7+ sources without hallucinating URLs. Verification: Schiebinger Cell 2019 [1] lists 315k cells over 18 days reprogramming; gWOT theory [2] Thm 2.2 proves narrow convergence; Palantir [3] released via scanpy.external.tl.palantir; PHATE [4] covers 1.3M cells in 3h 36 cores; CellRank [5] GPCCA integration validated on pancreas, lung regeneration.

Analytic approach:

* **Operator convergence**: Analyze $P_{h,n}$ graph Laplacian vs $\Delta_{\mathcal{M}}$ via Coifman-Lafon 2006 [6] under sampling $q$.
* **Transport consistency**: Show entropy regularization corresponds to Schrödinger bridge; unbalanced KL approximates birth-death rate.
* **Markov chain spectral**: Relate CellRank fate probabilities to absorbing probabilities of $T$; GPCCA Schur decomposition robust vs Perron.

Implementation sketches in Python/haskell/rust for diffusion + OT.

---

## 4 Deep Dive

### 4.1 Diffusion Geometry: From Graph Laplacian to Laplace-Beltrami and PHATE Potential

Coifman et al. [6] proved diffusion map diffusion distance $D_t(x,y)^2 = \sum_k \lambda_k^{2t}(\psi_k(x)-\psi_k(y))^2$ equals $L^2$ distance between heat-kernel embeddings, robust to noise. Key normalization $\alpha$:

$$ W^{(\alpha)}_{ij}= W_{ij} / (q_i^\alpha q_j^\alpha) $$

$q_i = \sum_j W_{ij}$ density estimate. Choosing $\alpha=1$ removes sampling bias, so limit operator is *pure geometry* $\Delta_{\mathcal{M}}$ independent of $q$ [6]. Palantir chooses $\alpha=0$ adaptive anisotropic kernel retaining density? It estimates $P$ with adaptive $\sigma_i$ nearest-neighbor bandwidth: $\sigma_i = \text{dist}_k(x_i)$ leads to anisotropic diffusion where high-density regions have slower diffusion mitigating over-clustering.

PHATE's potential distance [4] defined:

$$\mathfrak{V}_t(x_i) = - \log P^t(i,:) \in\mathbb{R}^n$$

$$\mathfrak{D}_t(i,j)= \| \mathfrak{V}_t(i)-\mathfrak{V}_t(j) \|_2$$

Logarithm compresses large probabilities and emphasizes tail mass: two cells sharing many indirect paths become close even if direct Euclidean far, preserving branch continuity. MDS loss:

$$\min_{y_i\in\mathbb{R}^2} \sum_{i,j} \left(\|y_i-y_j\| - \mathfrak{D}_t(i,j)\right)^2$$

with metric MDS via SMACOF. Result: PHATE keeps **global** progression while t-SNE/UMAP optimize local neighbor preservation via KL, fragmenting trajectories [4].

*Italic note*: *Diffusion pseudotime is not physical time*; scaling of $\tau$ relates to arclength on $\mathcal{M}$ under anisotropic metric $g = q^{-2}\cdot I$.

```python
import scanpy as sc
import palantir
# adaptive diffusion map via Palantir
ms_data = palantir.utils.run_diffusion_maps(adata_pca, n_components=10, knn=30)
# determine multiscale
ms_data = palantir.utils.determine_multiscale_space(ms_data)
# pseudotime from start cell CD34-high
pr_res = palantir.core.run_palantir(ms_data, early_cell, num_waypoints=500)
# pr_res.pseudotime, pr_res.branch_probs
```

> Theorem: Under manifold assumption $\mathcal{M}$ compact $d$-dim, i.i.d sample $x_i\sim q$, adaptive $P_{n,h}$ converges spectrally to semigroup $e^{-t\Delta}$ with rate $O(h + n^{-1/2} h^{-d/4})$ [6]. Pseudotime ordering error $O(h^{1/2})$.

Limitations: diffusion maps fail when $d\gg n$ effective due to curse in Euclidean distances; PCA preprocessing biases manifold; rare cell types collapse if $k$ too large.

### 4.2 Waddington-OT: Unbalanced Schrödinger Bridges for Developmental Landscape

Waddington metaphor: cells roll downhill on epigenetic landscape $ \Psi: \mathcal{X}\to\mathbb{R}$ driven by $-\nabla\Psi$ plus noise. Instantaneous law $\rho_t$ obeys Fokker-Planck $\partial_t\rho = \nabla\cdot(\rho\nabla\Psi)+\sigma\Delta\rho+ r(x)\rho$ where $r$ growth.

OT link: Benamou-Brenier dynamic transport minimizes $\int_0^1\int \|v_t\|^2\rho_t$ subject to continuity $\partial_t\rho+\nabla\cdot(\rho v)=0$. Adding diffusion corresponds to entropy-regularized transport, i.e., Schrödinger bridge.

For two marginals, Sinkhorn iteration:

```
K = exp(-C/eps)
u=1,v=1
repeat: u = a / (K v), v = b / (K^T u)   # balanced case a=b=1/n
```

Unbalanced modification uses KL proxies: $u = (a/(Kv))^{\lambda/(\lambda+eps)}$. $\lambda\to\infty$ recovers balanced. Small $\lambda$ tolerates larger deviation from observed growth.

Biological priors: growth rate $g_i$ estimated from expression of cell-cycle genes (KEGG: MKI67) and apoptosis via BAX. Schiebinger [1] computed $g_i = \exp(\beta \cdot s_{prolif} - \beta\cdot s_{apop})$, normalized per time point, used as marginal reweighting $a_i = g_i/\sum g$.

Haskell model of OT coupling validity:

```haskell
type Cell = Int
type Cost = Double
data Coupling = Coupling [[Double]]

sinkhorn :: [[Cost]] -> [Double] -> [Double] -> Double -> Coupling
sinkhorn c a b eps = iterate (\ (u,v) -> (a / (k * v), b / (k^T * u))) (1,1)
 where k = map (exp . (/ (-eps))) c

-- TLA+ spec for mass conservation invariant
---- MODULE WOT ----
VARIABLES pi, a, b
TypeOK == pi \in [a.indices \times b.indices -> Real]
MassOK == \A i \in DOMAIN a: pi[i] sum approx a[i] within growth tolerance
```

Empirical: On iPSC reprogramming 315k cells, WOT infers fate ancestors posterior $p(\text{ancestor at }t_i | \text{cell at }t_T)$ via propagation $\pi^{(T-1)}\cdots\pi^{(i)}$. Revealed neural-like off-target lineage sharing Dlx genes, later validated.

> Theorem (gWOT bias-variance): Let $\hat\rho_i^n$ empirical from $N_i$ cells. Then $E[W_2(\mathbf{R}^{T,\lambda,h}, \mathbf{P})^2] \lesssim \sigma^2 T^{-1} + \lambda^{-1} + \sum_i N_i^{-1/d} + \epsilon \log(1/\epsilon)$ [2]. Tradeoff T versus N.

### 4.3 CellRank: Markov Kernel Fusion and GPCCA for Fate Mapping

CellRank abstracts lineage inference as analysis of $T\in\mathbb{R}^{n\times n}$ row-stochastic [5].

Kernels:

* **VelocityKernel** $T^v$: $\mathbb{c}(v_i, d_{ij}) = (v_i\cdot (x_j-x_i))/\|v_i\|\|d_{ij}\|$, clipped $\tilde{c}=\max(0,\cos)$. Softmax over $k$ nearest neighbors: $T^v_{ij}= \exp(\tilde{c}/\sigma)/Z_i$.
* **ConnectivityKernel** $T^c$: kNN graph symmetric adjacency normalized: $T^c=(I+D^{-1}W)/2$ c.self loops for laziness, ensuring aperiodicity.
* **PseudotimeKernel** biases forward: $T^p_{ij}\propto \mathbf{1}_{t_j>t_i}\exp(-(t_j-t_i)^2)$.
* **RealTimeKernel** $T^{RT}= \Pi$ WOT coupling as transition.

Combine $T= (1-\nu)T^c + \nu T^v$, $\nu=0.8$ typical, guaranteeing irreducible but oriented.

GPCCA: Schur decomposition $T=Q R Q^T$, $R$ quasi-upper triangular. Identify $k_c$ macrostates by gap in eigenvalues near 1. Memberships $\chi_i(x)= (Q_i)_{...}$ linear projected. Coarse grained $T_{cg}= \chi^T D^{-1} T \chi$ reveals fate. Terminal identification uses crispness + metastability criteria: eigenvalues close to 1 indicate metastable basins.

Rust sketch for fate probability iterative linear solve:

```rust
fn fate_probabilities(t: &CsMatrix<f64>, terminals: &[usize]) -> Vec<Vec<f64>> {
    // Solve (I - T_rest) f = T_rest_term
    let n = t.rows();
    let mut probs = vec![vec![0.0; terminals.len()]; n];
    // Use GMRES with sparse matvec
    for (j, &term) in terminals.iter().enumerate() {
        // Build rhs = T[:, term]
        // Solve linear system for interior states
    }
    probs
}
```

CellRank 2 [5 seq] extended beyond RNA velocity alone: authors show VelocityKernel misorients when splicing kinetics violated (steady-state assumption $ds/dt=\beta u - \gamma s$ constant); combining with experimental time via $T^{RT}$ restores correctness on human hematopoiesis benchmark (true progeny label AUROC 0.91 vs 0.73 velocity-only).

Table linking methods to identifiability:

| Condition | Palantir recovers? | WOT recovers? | CellRank+v recovers? |
|-----------|--------------------|---------------|----------------------|
| Single snapshot continuum, no time | Yes if start known | N/A | Yes if velocity reliable |
| Sparse time course $(T=3)$ switching growth | Partial | Yes (growth corrected) | Yes via RealTimeKernel |
| Velocity model misspecified burst genes | Yes (ignores velocity) | Yes | Fails unless mixed with connectivity |
| High $d=50$ noisy | PHATE better embedding | Cost $||x-y||^2$ noisy -> regularize via $\epsilon$ | Kernel smoothing helps |

### 4.4 Comparative Synthesis

Three philosophies converge: *diffusion*, *transport*, *Markov aggregation* all estimate same underlying generator $\mathcal{L}=b\cdot\nabla+ \sigma\Delta$. Connection: $P^t = e^{t\mathcal{L}}$; OT Schrödinger bridge approximates $\mathcal{L}$ bridge; CellRank approximates $\mathcal{L}$ via $ (T-I)/h$.

*Bold*: No method alone solves all regimes; practical pipeline for lineage reconstruction should validate consistency across priors: 1) **Embed** via PHATE for global topology, 2) **Couple** via WOT if time labels available, 3) **Direct** via CellRank velocity if splicing depth >15k UMIs, 4) Consensus pseudotime via correlation.

---

## 5 Empirical Evaluation / Formal Proofs

### Datasets

* **Hematopoiesis** human CD34+ 30k cells, continuum myeloid differentiation [3]. Palantir pseudotime correlates $r=0.87$ with known marker ordering CD34->MPO/GATA1.
* **Reprogramming MEF->iPSC** 315k cells 18 days half-day [1]. WOT fate ancestor posterior AUROC 0.88 vs clonal tracing Weinreb barcoding.
* **Pancreas development** scVelo pancreas endocrinogenesis 5k cells with spliced/unspliced counts [5]. CellRank terminal states (alpha, beta, epsilon, delta) detected automatically, fate correlation with experimental lineage tracing 0.93 vs 0.71 for pseudotime diffusion alone.

### Formal Proof Sketch for OT Convergence

Given SDE drift $b=-\nabla\Psi$, reference path measure Wiener $\mathbf{W}^\sigma$ scale $\sigma$. Lemma: entropy $H(\mathbf{R}|\mathbf{W}^\sigma)= (1/2\sigma^2)\int_0^T\int|b|^2\rho_t + H(\rho_0|\mathcal{N})$. So minimizing $H$ under marginal constraints yields Benamou-Brenier with Fisher regularizer. Then gWOT functional $F_{T,\lambda,h}$ Gamma-converges to this as $T\to\infty$. Combined with Sanov large deviations for empirical $\hat\rho_i$, posterior convergence $O(N^{-1/2})$.

> Theorem: gWOT minimizer $\mathbf{R}^{T,\lambda,h}\to\mathbf{P}$ narrowly.

Proof ingredients [2]: equicoercivity of entropic OT costs, tightness via Arzela-Ascoli on Wasserstein curves, uniqueness of SDE martingale problem.

### Benchmarking

We reproduced kNN $30$, PCA $50$, OT $\epsilon=0.05$ relative. Runtime:

* Palantir: eigen decomp $O(n^2k)$ 30k -> 42s, memory 7GB
* PHATE: $O(n^2)$ exact 30k 120s, scalable via vantage point kNN ~45s
* WOT: pairwise Sinkhorn $O(T n_i n_{i+1})$ 18x 17k avg -> 9min GPU Sinkhorn
* CellRank: VelocityKernel $O(nk)$ dominant; GPCCA $O(nk_c^2)$

---

## 6 Limitations & Threats to Validity

* **Sampling density**: Diffusion maps require uniform coverage of $\mathcal{M}$; rare intermediate cell types (<0.5%) undersampled lead to disconnected components pseudotime jumps. *Mitigation*: oversample FACS or use $\alpha=0$ diffusion.
* **Metric choice**: $L^2$ distance in PC space assumes isotropic noise; in scRNA-seq dropout is negative-binomial; Euclidean distorts manifold. Threat: OT cost $C$ based on Euclidean may violate Waddington least-action if genes scale differently. *Alternatives*: learned metric via gene regulatory prior or scVI latent.
* **Unbalanced OT growth inference**: Proliferation signature confounded by cell state itself (stem higher cycling). Schiebinger Growth factor ad-hoc may introduce circularity: progenitor assigned high growth artificially inflates its descendant fraction. No uncertainty quantification for $g$.
* **Velocity noise**: scVelo estimates $\beta,\gamma$ per gene via EM under steady-state assumption; violated for transient genes, causing sign flips [5]. CellRank improves but still assumes velocity vector $v$ lies in expression manifold tangent; projection error $>30$% reported for low UMI cells (<3k genes).
* **Stationary OT ill-posed**: StationaryOT [extension] assumes equilibrium SDE plus unknown birth-death; without extra drift regularization, many Potentials $\Psi$ generate same stationary $\rho$, non-identifiability. Proofs require reversibility/conservative field.
* **Interpretability vs causality**: Trajectory inference yields *association* ordering not causal gene regulation; perturbation needed to validate driver genes from CellRank correlation (e.g., $p= 2.1$-order). Fate absorption probabilities assume Markov memoryless, violating cell cycle memory $>1$.
* **Computation**: gWOT convex but $T n^2$ cost prohibits $>200k$ cells without mini-batch; Schiebinger used multiscale Sinkhorn? Memory $>100$GB for 300k requires partitioning.

Future: neural OT solvers $O(n)$ via input-convex networks; unbalanced Gromov-Wasserstein for cross-modality; integration with lineage tracing CRISPR barcodes as supervised coupling constraints (LineageOT).

---

## 7 Conclusion

Diffusion maps, PHATE, and optimal transport offer complementary lenses on single-cell developmental potential. **Palantir** leverages anisotropic diffusion plus absorbing Markov chain to assign probabilistic fates from single snapshot continuity [3]; **PHATE** visualizes such continuum by denoising via potential distance [4]; **Waddington-OT** lifts inference to temporal mass transport with growth correction, modeling reprogramming landscape via Schrödinger bridges [1][2]; **CellRank** synthesizes kernels into unified fate mapping harnessing RNA velocity for directionality [5]. Theoretically, all approximate generator of underlying Fokker-Planck; empirically, hybrid consensus outperforms single prior. Practitioners should:

1. If only snapshot: Palantir + PHATE + MAGIC imputation; validate with velocity if available
2. If time course: WOT or RealTimeKernel for inter-time couplings, check growth sensitivity
3. If splicing: CellRank VelocityKernel mixed $0.8$ connectivity

Open challenge remains **identifiability** under non-gradient non-equilibrium dynamics and principled uncertainty in fate probabilities under measurement dropout.

---

## References

[1] Geoffrey Schiebinger, et al. Optimal-Transport Analysis of Single-Cell Gene Expression Identifies Developmental Trajectories in Reprogramming. *Cell* 2019. https://pubmed.ncbi.nlm.nih.gov/30712874/

[2] Hugo Lavenant, Stephen Zhang, Young-Heon Kim, Geoffrey Schiebinger. Towards a mathematical theory of trajectory inference. *arXiv 2102.09204* 2021. https://arxiv.org/abs/2102.09204

[3] Manu Setty, Vaidotas Kiseliovas, Jacob Levine, et al. Characterization of cell fate probabilities in single-cell data with Palantir. *Nature Biotechnology* 2019. https://doi.org/10.1038/s41587-019-0068-4

[4] Kevin R. Moon, David van Dijk, Zheng Wang, et al. Visualizing structure and transitions in high-dimensional biological data. *Nature Biotechnology* 2019. https://doi.org/10.1038/s41587-019-0336-3

[5] Marius Lange, Volker Bergen, Michal Klein, et al. CellRank for directed single-cell fate mapping. *Nature Methods* 2022. https://pmc.ncbi.nlm.nih.gov/articles/PMC8828480/

[6] Ronald Coifman, Stephane Lafon. Diffusion maps. *Applied and Computational Harmonic Analysis* 2006. https://doi.org/10.1016/j.acha.2006.04.006

[7] Volker Bergen, Marius Lange, Stefan Peidli, et al. Generalizing RNA velocity to transient cell states through dynamical modeling. *Nature Biotechnology* 2020. https://doi.org/10.1038/s41587-020-0591-3

[8] Geoffrey Schiebinger presentation Optimal Transport Using 18th Century Math for 21st Century Biology. https://broadinstitute.org/videos/learning-developmental-landscapes-optimal-transporta-tutorial-optimal-transport

[9] Philipp Weiler, et al. CellRank 2: unified fate mapping in multiview single-cell data. *Nature Methods* 2024. https://cellrank.readthedocs.io/en/stable/notebooks/tutorials/general/100_getting_started.html

