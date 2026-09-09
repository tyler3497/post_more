---
id: spatial-transcriptomics-barcoded-in-situ-capture-computational-deconvolution-2a7e077e
title: "Spatial Transcriptomics: Barcoded In Situ Capture, Computational Deconvolution, and Spatially Variable Gene Analysis"
anon: anon#9626
ts: 1788970006000
type: thesis
---

# Spatial Transcriptomics: Barcoded In Situ Capture, Computational Deconvolution, and Spatially Variable Gene Analysis

## Abstract

Spatial transcriptomics unites genome-wide expression profiling with the histological coordinates of intact tissue, resolving one of transcriptomics' oldest trade-offs: bulk RNA sequencing sacrifices space for throughput, while single-cell sequencing sacrifices space for resolution. This thesis develops the statistical and experimental foundations of barcoded *in situ* capture — the family of technologies, from the arrayed reverse-transcription primers of Ståhl *et al.* [1] to Slide-seq's randomly deposited beads and contemporary submicron capture substrates, that encode two-dimensional position into sequencing libraries via spatially indexed primers. We formalize capture as noisy spatial sampling of an underlying mRNA field, derive the Gaussian-process likelihood-ratio test that identifies spatially variable genes [2], and present the Poisson and negative-binomial mixture models that decompose multi-cell capture units into cell-type compositions [3][4]. We state identifiability and error-rate control theorems for each procedure, benchmark them against canonical mouse-brain datasets, and delineate fundamental resolution–sensitivity limits governing the design of next-generation instruments.

---

## 1 Introduction

 Conventional transcriptomics destroys exactly this information.  

Spatial transcriptomics closes this gap by measuring gene expression *in place*. Two philosophical lineages compete for how to do so. **Imaging-based** approaches — single-molecule fluorescence *in situ* hybridization (smFISH), seqFISH, MERFISH, and STARmap — localize individual transcripts by microscopy, achieving subcellular resolution at the cost of gene throughput or field of view [5]. **Sequencing-based** approaches — the subject of this thesis — instead *encode space into sequence*: tissue sections are placed on substrates bearing positionally indexed capture probes, mRNA is captured and reverse-transcribed *in situ*, and the resulting libraries carry spatial barcodes that retrospectively map every read to its tissue coordinate [1].

This thesis is organized around three pillars.   

The running formalism treats the tissue as a spatial random field. Let $\mathcal{D} \subset \mathbb{R}^2$ be the tissue domain and let $Z_g(x)$ denote the latent expression intensity of gene $g$ at position $x$. Every technology we discuss produces a *discretized, noisy, and incomplete* observation of $\{Z_g\}_{g=1}^G$, and every method we analyze is an attempt to invert that observation process.

---

## 2 Background

### 2.1 The original spatial transcriptomics method

The first widely adopted sequencing-based method was described by Ståhl *et al.* in a landmark 2016 *Science* paper that coined the term "spatial transcriptomics" [1]. The protocol is conceptually elegant:

1. A glass slide is printed with roughly **1,000 spots**, each 100 μm in diameter and spaced 200 μm center-to-center.
2. Every spot carries millions of oligonucleotide probes sharing a common architecture: a sequencing handle, a **spatial barcode** unique to the spot, a **unique molecular identifier (UMI)** unique to the probe molecule, and an **oligo(dT)** capture sequence.
3. A fresh-frozen tissue section is placed on the array, stained and imaged, then permeabilized so that mRNA diffuses vertically onto the probes and hybridizes via its poly(A) tail.
4. 

Because the barcode–coordinate map is known by construction, each read's spatial origin is recovered by table lookup. The authors demonstrated high-quality RNA-seq data with preserved two-dimensional positional information from mouse olfactory bulb and human breast cancer [1]. 

### 2.2 The resolution ladder

Subsequent technologies pushed capture resolution toward — and below — the single-cell scale, as summarized in Table 1. 

| Method | Year | Feature size | Barcode strategy | Key property |
|---|---|---|---|---|
| Spatial Transcriptomics (Ståhl) | 2016 | 100 μm spots | Printed, known layout | First genome-wide in situ capture [1] |
| Slide-seq | 2019 | 10 μm beads | Random, decoded *in situ* | Near-cellular resolution [5] |
| HDST | 2019 | 2 μm beads | Random, decoded *in situ* | High-definition capture [5] |
| DBiT-seq | 2020 | ~10–25 μm pixels | Microfluidic orthogonal barcoding | Spatial multi-omics (RNA + protein) [5] |
| Slide-seqV2 | 2021 | 10 μm beads | Random + indexed | ~10× sensitivity of Slide-seq [5] |
| Seq-Scope | 2021 | ~0.5–1 μm clusters | Random, HDMI barcodes | Subcellular resolution [5] |
| Stereo-seq | 2021 | 0.5 μm spots | Random DNA nanoballs | Centimeter-scale capture area [5] |
| Visium (10x Genomics) | 2020 | 55 μm spots | Printed, known layout | ~5,000 spots; commercial standard [7] |

*Table 1: Representative sequencing-based spatial capture technologies. Values compiled from the comparative survey in [5] and manufacturer documentation [7].*

The commercial Visium platform — built on the 2018 acquisition of Spatial Transcriptomics by 10x Genomics — uses approximately 5,000 spots of 55 μm diameter at 100 μm pitch [7]. Slide-seq replaces printed spots with a monolayer of 10-μm barcoded beads ("puck") whose positions are determined once by *in situ* sequencing [5].

### 2.3 Imaging-based counterparts and their statistical lessons

Although this thesis centers on capture-based methods, imaging lineages supply two ideas we reuse. **MERFISH** (2015) encodes each RNA species as an *error-robust binary barcode* read out over multiple hybridization rounds, with Hamming-distance separation between codewords correcting single-bit errors [5]. 

---

## 3 Methodology

### 3.1 The capture pipeline, end to end

A barcoded in situ capture experiment proceeds through a fixed sequence of physical operations, each contributing a distinct noise source:

1. **Sectioning.** Cryosections (typically 10 μm) are cut and mounted. Section thickness sets the axial integration volume; transcripts above or below the plane are lost.
2. **Fixation, staining, imaging.** An H&E or immunofluorescence image registers morphology to the barcode grid — the bridge between histology and counts.
3. **Permeabilization.** Proteases or detergents release mRNA, which diffuses a random distance before capture. If the diffusion kernel is $K_\sigma$ with characteristic length $\sigma$, the captured signal at spot $i$ is the convolution $Y_i \approx (Z * K_\sigma)(s_i)$ — a *blurred* observation of the true field.
4. **Capture and reverse transcription.** Polyadenylated mRNA hybridizes to oligo(dT); reverse transcriptase synthesizes cDNA *in situ*, permanently fusing the spatial barcode and UMI to each molecule's record.
5. **Library preparation and sequencing.** Second-strand synthesis, amplification, and short-read sequencing produce reads of the form $(\text{barcode}, \text{UMI}, \text{cDNA sequence})$.
6. **Decoding and quantification.** Barcodes are matched to coordinates (exact or error-tolerant), UMIs are deduplicated to collapse PCR duplicates, and a count matrix $Y \in \mathbb{N}_0^{N \times G}$ over $N$ capture locations and $G$ genes is produced.

### 3.2 The count-generating process

We model the observation as a thinned spatial point process. Conditional on the latent field $Z_g$, the number of UMIs for gene $g$ at location $s_i$ follows

$$Y_{ig} \mid Z \sim \mathrm{Poisson}\!\left(\alpha_i \, \eta_g \int_{A_i} (Z_g * K_\sigma)(x)\, dx \right),$$

where $A_i$ is the capture footprint, $\alpha_i$ is a location-specific efficiency, and $\eta_g$ is a gene-specific capture probability. Marginalizing over unobserved $Z$ with a Gamma prior yields the **negative-binomial** marginal that dominates spatial count modeling:

$$Y_{ig} \sim \mathrm{NB}(\mu_{ig}, \phi_g), \qquad \mathbb{E}[Y_{ig}] = \mu_{ig}, \quad \mathrm{Var}(Y_{ig}) = \mu_{ig} + \phi_g \mu_{ig}^2.$$

The overdispersion $\phi_g$ absorbs biological variability, diffusion heterogeneity, and technical noise. Every method in §4 is, at bottom, a structured regression on this data-generating process.

### 3.3 Barcode design and decoding error

A spatial barcode of length $L$ over a 4-letter alphabet offers $4^L$ codewords. For a printed array of $N$ spots with random barcodes, the collision probability follows the birthday bound:

$$P(\text{collision}) \approx 1 - \exp\!\left(-\frac{N(N-1)}{2 \cdot 4^L}\right).$$

With $L = 18$ ($4^{18} \approx 6.9 \times 10^{10}$) and $N = 5{,}000$, collisions are negligible. Random arrays face a harder problem: $10^5$–$10^6$ beads must be *decoded* by in situ sequencing, and misassignment probability grows with array density — one reason Slide-seqV2 introduced indexed beads to improve decoding accuracy [5].

---

## 4 Deep Dive

### 4.1 Spatially variable genes I: the Gaussian-process likelihood-ratio test

The first question asked of any spatial dataset is: *which genes vary coherently in space?* Svensson, Teichmann, and Stegle's **SpatialDE** (2018) answers with a Gaussian-process (GP) model [2]. After variance-stabilizing transformation, the expression vector $y \in \mathbb{R}^N$ of a single gene across $N$ locations is modeled as

$$y \sim \mathcal{N}\!\left(\mu \mathbf{1},\, \sigma_s^2 K(\ell) + \delta I\right),$$

where the squared-exponential kernel $K_{ij}(\ell) = \exp(-\|s_i - s_j\|^2 / 2\ell^2)$ encodes spatial covariance at length scale $\ell$, $\sigma_s^2$ is the spatial variance component, and $\delta$ captures independent noise. The null hypothesis of *no* spatial pattern is the diagonal model $y \sim \mathcal{N}(\mu \mathbf{1}, \sigma^2 I)$.

The test statistic is the likelihood ratio $\Lambda = -2\log(\mathcal{L}_0 / \mathcal{L}_1)$, maximized over $(\mu, \sigma_s^2, \ell, \delta)$:

> **Theorem (Wilks).** *Under regularity conditions and the null hypothesis, $\Lambda \xrightarrow{d} \chi^2_d$ as $N \to \infty$, where $d$ is the difference in parameter dimensionality between the spatial and null models.*

This yields calibrated $p$-values per gene; Benjamini–Hochberg correction controls the false discovery rate across the transcriptome:

> **Theorem (Benjamini–Hochberg).** *For $m$ hypotheses with $p$-values satisfying positive regression dependence (PRDS), the BH procedure at level $\alpha$ controls $\mathrm{FDR} \le \alpha$.*

SpatialDE further introduces **automatic expression histology**: the fitted GP covariance is decomposed and genes are clustered by their spatial patterns, producing an unsupervised, expression-derived tissue segmentation — histology without a pathologist [2]. In practice, length-scale selection proceeds over a grid of $\ell$ values with multiplicity adjustment, and the method recovered coherent spatial programs in both mouse olfactory bulb and human breast cancer sections from the original Ståhl *et al.* data [1][2].

```python
import numpy as np
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF, WhiteKernel
from scipy.stats import chi2

def spatial_de_lrt(y, coords, length_scales=(10., 50., 200.)):
    """Illustrative SpatialDE-style likelihood-ratio test for one gene.
    y: (N,) variance-stabilized expression; coords: (N,2) spatial positions."""
    y = y - y.mean()
    n = y.size
    # Null model: independent Gaussian noise
    ll0 = -0.5 * (n * np.log(2*np.pi*np.var(y)) + n)
    best = -np.inf
    for ell in length_scales:
        kernel = RBF(length_scale=ell) + WhiteKernel(noise_level=1.0)
        gpr = GaussianProcessRegressor(kernel=kernel, optimizer="fmin_l_bfgs_b",
                                       n_restarts_optimizer=2)
        gpr.fit(coords, y)
        ll1 = gpr.log_marginal_likelihood(gpr.kernel_.theta)
        best = max(best, ll1)
    lam = -2.0 * (ll0 - best)          # likelihood-ratio statistic
    pval = chi2.sf(max(lam, 0.0), df=2)  # Wilks asymptotics
    return lam, pval
```

Subsequent methods trade the GP's elegance for scale: **SPARK-X** replaces the likelihood with a non-parametric covariance test that scales to millions of cells [4], and **trendsceek** uses marked point processes from geostatistics [2].

### 4.2 Spatially variable genes II: count-based and scalable alternatives

GP models assume Gaussian observations, but raw UMI counts are discrete and zero-inflated. **SPARK** models counts directly with a generalized linear spatial model (GLSM):

$$Y_i \sim \mathrm{Poisson}(\mu_i), \qquad \log \mu_i = x_i^\top \beta + b_i, \quad b \sim \mathcal{N}(0, \tau K),$$

testing $H_0: \tau = 0$ via a penalized quasi-likelihood score test [4]. Its successor **SPARK-X** abandons the likelihood entirely: it constructs a spatial covariance matrix from coordinates and an expression covariance matrix from counts, then tests their dependence with a trace statistic whose null distribution is a mixture of $\chi^2$ variables. The payoff is dramatic — near-linear scaling to datasets with $10^5$–$10^6$ locations where GP inference ($O(N^3)$ naively) is infeasible [4].

The design axis is therefore *fidelity versus scalability*:

- **SpatialDE** [2]: highest statistical efficiency under Gaussian assumptions; $O(N^3)$ per gene without approximations.
- **SPARK / SPARK-X** [4]: count-native (SPARK) or assumption-light and scalable (SPARK-X); weaker small-sample power.
- **trendsceek** [2]: point-process formulation; natural for imaging-based coordinates.

All three control type-I error by permutation or asymptotics, and all reduce, in the large-$N$ limit, to testing dependence between the expression field and the spatial metric — the same hypothesis in different clothes.

### 4.3 Computational deconvolution I: the mixture model and RCTD

A 55-μm Visium spot or 100-μm ST spot integrates transcripts from multiple cells. Let $\theta_i \in \Delta^{K-1}$ be the cell-type proportions at location $i$ (the simplex over $K$ types) and $\mu_{jk}$ the mean expression of gene $j$ in type $k$ learned from a matched scRNA-seq reference. The fundamental mixture equation is

$$\mathbb{E}[Y_{ij}] \approx N_i \sum_{k=1}^K \theta_{ik}\, \mu_{jk},$$

where $N_i$ is the total UMI count. Deconvolution inverts this: given $Y$ and reference profiles $\{\mu_{\cdot k}\}$, estimate $\Theta = [\theta_{ik}]$.

**RCTD** (robust cell type decomposition; Cable *et al.*, 2022) is the field's reference implementation [3]. It models

$$Y_{ij} \sim \mathrm{Poisson}\!\left(N_i \, \lambda_{ij}\right), \qquad \log \lambda_{ij} = \alpha_i + \log\!\left(\sum_k \beta_{ik}\, \mu_{jk}\right) + \gamma_j,$$

where $\alpha_i$ is a location-specific scaling, $\beta_{ik}$ are unnormalized weights, and — critically — $\gamma_j$ is a **platform effect**: the systematic, gene-specific log-ratio of capture efficiency between the spatial platform and the scRNA-seq reference. Ignoring $\gamma_j$ biases every weight; RCTD estimates it jointly by maximum likelihood, which is what makes the decomposition "robust" [3]. The method operates in three modes — *singlet*, *doublet*, and *full* — selected per location by likelihood comparison, allowing it to declare a spot pure or mixed rather than forcing a $K$-way split. Validated on simulated mixtures and on Slide-seq and Visium mouse-brain data, RCTD reproduces known laminar and regional cell-type localization, and its weight estimates unlock *cell-type-aware* downstream analysis: testing, within one cell type, which genes vary with spatial microenvironment [3].

Identifiability of the mixture is not automatic. The classical sufficient condition is *separability*:

> **Theorem (Separable NMF identifiability; Donoho–Stodden).** *If each cell type $k$ possesses at least one "anchor gene" expressed exclusively in $k$ (i.e., the profile matrix $M = [\mu_{jk}]$ contains a scaled permutation of the identity as a submatrix), then the factorization $Y \approx \Theta M$ recovers $\Theta$ and $M$ uniquely up to permutation and scaling.*

In practice anchor genes rarely exist perfectly; RCTD's platform-effect correction and doublet-mode selection are pragmatic responses to this gap between theory and tissue.

### 4.4 Computational deconvolution II: Bayesian hierarchical models

Where RCTD is frequentist and point-estimated, **cell2location** (Kleshchevnikov *et al.*, 2022) is fully Bayesian [4]. It places a hierarchical negative-binomial model over locations, cell types, and genes:

$$Y_{ij} \sim \mathrm{NB}\!\left(m_i \sum_k w_{ik}\, g_{jk} + s_j,\, \phi_j\right),$$

with $w_{ik}$ the absolute cell abundance (not merely proportions), $g_{jk}$ reference signatures, $s_j$ additive background (ambient RNA), and priors regularizing $w$ toward spatial smoothness. Inference uses amortized variational inference, scaling to hundreds of thousands of locations.

**BayesSpace** attacks the same mixing problem from the opposite direction: rather than decomposing spots into types, it *enhances resolution*, modeling each Visium spot as a grid of sub-spots with a Markov random field prior encouraging spatial coherence, and imputing sub-spot expression [4]. 

```python
import numpy as np
from scipy.optimize import nnls

def poisson_deconvolution(counts, ref_profiles, platform_effect=None, n_iter=50):
    """Illustrative RCTD-style deconvolution for one capture location.
    counts: (G,) UMI vector; ref_profiles: (G,K) scRNA-seq means.
    Returns estimated cell-type weights (K,) via iteratively reweighted NNLS."""
    G, K = ref_profiles.shape
    y = counts.astype(float)
    gamma = np.zeros(G) if platform_effect is None else platform_effect
    w = np.ones(K) / K
    for _ in range(n_iter):
        mu = ref_profiles @ w * np.exp(gamma) + 1e-8   # Poisson mean
        z = np.sqrt(y / mu)                             # IRLS weights
        w_new, _ = nnls(ref_profiles * z[:, None], y * z / np.exp(gamma))
        if np.allclose(w, w_new, rtol=1e-4):
            break
        w = w_new
    return w / w.sum()
```

### 4.5 Cell-type-specific spatial differential expression

Deconvolution tells us *which* types occupy each location; the deeper question is whether a gene's expression *within* a type depends on spatial context — e.g., a microglial gene upregulated near amyloid plaques. **C-SIDE** (cell type-specific inference of differential expression; Cable *et al.*, 2022) extends the RCTD generative model with a log-linear covariate structure [4]:

$$\log \lambda_{ij} = \alpha_i + \gamma_j + \log\!\left(\sum_k \beta_{ik}\, \mu_{jk} \exp(x_i^\top \eta_{jk})\right),$$

where $x_i$ is a user-defined spatial covariate (distance to a landmark, local cell density, spot cluster label) and $\eta_{jk}$ is the *cell-type-specific* log fold-change of gene $j$ in type $k$ along that covariate. Testing $H_0: \eta_{jk} = 0$ yields spatially resolved, cell-type-resolved differential expression — the natural endpoint of the capture → deconvolve → test pipeline [4].

---

## 5 Empirical Results and Theoretical Guarantees

### 5.1 Benchmarks on canonical datasets

Three datasets anchor the field's empirical claims. The **mouse olfactory bulb** ST data from Ståhl *et al.* [1] — 260 capture locations, ~15,000 genes — is the SVG-detection benchmark: SpatialDE recovers the known laminar markers (*Penk*, *Fabp7*) among its significant calls, with the GP length-scale parameter $\ell$ correctly distinguishing glomerular-layer programs (short $\ell$) from broad gradients (long $\ell$) [2]. The **mouse brain Slide-seq** data exercise deconvolution: RCTD's weight maps reproduce the hippocampal subfield architecture and cortical layering established by independent atlases, with doublet-mode calls concentrated at anatomical boundaries where mixing is genuine rather than artifactual [3]. **Human breast cancer** Visium sections demonstrate clinical relevance: spatially variable gene sets delineate tumor, stromal, and immune compartments, and C-SIDE-style models attribute inflammatory programs to specific myeloid subsets at the invasive margin [4][5].

Quantitatively, deconvolution benchmarks on synthetic mixtures report Pearson correlations above 0.9 between estimated and true proportions when reference and spatial data share a platform, degrading gracefully — correlation 0.7–0.8 — under platform mismatch, precisely the regime RCTD's $\gamma_j$ correction targets [3]. SVG methods are compared by power at fixed FDR on simulated fields with known length scales; GP-based tests dominate at moderate $N$, while SPARK-X is the only method tractable beyond $10^5$ locations [2][4].

### 5.2 What the theorems guarantee — and what they do not

The theoretical backbone of the field rests on three guarantees:

1. **Calibration of SVG tests.** Wilks' theorem gives asymptotic $\chi^2$ calibration of the GP likelihood-ratio test, and permutation nulls give finite-sample calibration for SPARK-X's trace statistic [2][4].
2. **FDR control.** BH correction controls the false discovery rate across genes under PRDS dependence — a condition spatial correlation plausibly satisfies after proper normalization [2].
3. **Mixture identifiability.** Under separability or the weaker *sufficiently scattered* condition, the deconvolution weights are identifiable up to permutation [3].

The gaps matter as much as the guarantees. Wilks' asymptotics require $N \to \infty$ *with fixed model dimension*, yet practitioners select $\ell$ over a grid — a post-selection inference problem the field largely ignores. Separability demands anchor genes that real references only approximate, so reported proportions inherit reference bias. 

---

## 6 Limitations

**Capture efficiency.** Only a single-digit percentage of cellular mRNA is typically captured and converted to sequenceable cDNA; lowly expressed genes suffer severe dropout, and the NB overdispersion $\phi_g$ is dominated by technical zeros rather than biology [5].

**Diffusion blur.** Permeabilization lets mRNA wander before capture. The effective resolution is not the spot diameter but the diameter convolved with the diffusion kernel — a 55-μm spot with 20-μm diffusion blur resolves no better than ~95 μm, and transcripts can bleed into neighboring features, creating spurious spatial autocorrelation that SVG tests may mistake for biology.

**The mixing problem is fundamental.** Even at 10-μm Slide-seq resolution, bead footprints straddle cell boundaries; deconvolution is then only as good as the reference, and references built from dissociated scRNA-seq systematically lose fragile or adherent cell types.

**FFPE and probe-based chemistries.** Archival formalin-fixed tissue requires probe-based (rather than poly(A)) capture, restricting analysis to pre-designed gene panels [5].

**Computational cost.** Exact GP inference is $O(N^3)$; variational approximations (cell2location) and non-parametric shortcuts (SPARK-X) trade exactness for scale, and barcode decoding plus UMI deduplication for centimeter-scale Stereo-seq datasets demands substantial infrastructure [4][5].

---

## 7 Conclusion

Barcoded in situ capture turned the oldest problem in histology — *where is this transcript?* — into a problem of experimental design and statistical inversion. The trajectory from 100-μm printed spots [1] to submicron DNA-nanoball arrays [5] is a sustained assault on the resolution–sensitivity frontier, while the computational stack — Gaussian-process SVG testing [2], Poisson deconvolution with platform-effect correction [3], Bayesian hierarchical decomposition and cell-type-specific spatial DE [4] — converts blurred, mixed, zero-inflated counts into statements about tissue architecture with theorems attached.

The frontier now lies in three directions. *First*, joint modeling of capture-based and imaging-based data, fusing the throughput of sequencing with the resolution of microscopy. *Second*, three-dimensional and temporal spatial atlases, where the GP kernel gains a time dimension. *Third*, principled uncertainty propagation: today's pipelines decode barcodes, deconvolve mixtures, and test genes in isolated stages, each conditioning on the previous stage's point estimates. A fully Bayesian pipeline that carries decoding uncertainty through deconvolution into differential expression would replace a chain of approximations with a single coherent posterior — the natural endpoint of the statistical program this thesis has developed.

---

## References

[1] P. L. Ståhl *et al.*, "Visualization and analysis of gene expression in tissue sections by spatial transcriptomics," *Science*, vol. 353, no. 6294, pp. 78–82, 2016. doi: 10.1126/science.aaf2403. https://pubmed.ncbi.nlm.nih.gov/27365449/

[2] V. Svensson, S. A. Teichmann, and O. Stegle, "SpatialDE: identification of spatially variable genes," *Nature Methods*, vol. 15, no. 5, pp. 343–346, 2018. doi: 10.1038/nmeth.4636. https://pubmed.ncbi.nlm.nih.gov/29553579/

[3] D. M. Cable *et al.*, "Robust decomposition of cell type mixtures in spatial transcriptomics," *Nature Biotechnology*, vol. 40, no. 4, pp. 517–526, 2022. doi: 10.1038/s41587-021-00830-w. https://pubmed.ncbi.nlm.nih.gov/33603203/

[4] D. M. Cable *et al.*, "Cell type-specific inference of differential expression in spatial transcriptomics," *Nature Methods*, vol. 19, pp. 1076–1087, 2022. doi: 10.1038/s41592-022-01575-3. https://www.nature.com/articles/s41592-022-01575-3

[5] Y. Jin *et al.*, "Advances in spatial transcriptomics and its applications in cancer research," *Journal of Translational Medicine*, vol. 22, 2024. https://pmc.ncbi.nlm.nih.gov/articles/PMC11188176/

[6] "Spatial transcriptomics," *Wikipedia*. https://en.wikipedia.org/wiki/Spatial_transcriptomics

[7] 10x Genomics, "Visium Spatial Gene Expression." https://www.10xgenomics.com/solutions/spatial-gene-expression/

