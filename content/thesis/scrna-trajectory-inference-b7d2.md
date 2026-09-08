---
id: scrna-trajectory-inference-b7d2
title: "Single-Cell RNA Sequencing Analysis: Dimensionality Reduction, Trajectory Inference, and Differential Expression Modeling at Scale"
anon: anon#7819
ts: 1788893407000
type: thesis
---

# Single-Cell RNA Sequencing Analysis: Dimensionality Reduction, Trajectory Inference, and Differential Expression Modeling at Scale

## Abstract

Single-cell RNA sequencing (scRNA-seq) has transformed transcriptomics from a bulk-tissue average into a measurement of thousands to millions of individual cells, each a high-dimensional observation of cellular state. This article presents a mathematically grounded account of the computational pipeline that converts droplet-based capture data into biological insight: the statistical models of unique molecular identifier (UMI) count matrices and their quality control; normalization via SCTransform and scran deconvolution; linear and nonlinear dimensionality reduction with PCA, t-SNE, and UMAP; graph-based community detection with the Louvain and Leiden algorithms; trajectory inference via Monocle, Slingshot, and PAGA; dynamical systems modeling of RNA velocity with velocyto and scVelo; differential expression modeling with MAST, DESeq2, and negative-binomial frameworks; and batch integration with Harmony and scVI. For each stage we state the generative model, the optimization objective, the key theoretical guarantees and failure modes, and the scale at which modern implementations operate.

## 1. Introduction

The advent of droplet-based microfluidic capture, described by Zheng et al. [1] made it possible to profile tens of thousands of single cells in a single experiment at modest cost. The resulting data object is a count matrix X ∈ ℕ₀^(G×C), where G is the number of genes (typically 20,000–35,000) and C is the number of cells (10³–10⁶). This matrix is sparse, noisy, high-dimensional, and structured by a mixture of discrete cell types and continuous developmental processes. The central inferential challenge of single-cell transcriptomics is therefore a manifold-learning and latent-structure problem: recover the geometry of the cellular state space, assign cells to identities or positions along developmental trajectories, and test hypotheses about the genes that drive variation — all while accounting for technical noise, batch effects, and sparsity-induced zero inflation.

> Theorem: Under the standard UMI sampling model, the observed count x_gc is a Poisson realization of the product of the cell's total RNA content and its relative gene expression profile; hence the relative abundance vector is identifiable only up to a cell-specific scaling factor, and any analysis that ignores this compositional constraint confounds library size with biology.

This article develops the theory behind the standard pipeline,  We proceed from raw counts through normalization, dimensionality reduction, clustering, trajectory inference, differential expression, and integration.

---

## 2. Background

### 2.1 Droplet-based capture and the count matrix

In the GemCode/Chromium system, single cells are co-encapsulated with barcoded gel beads in oil emulsion droplets (GEMs) [1]. Within each GEM, reverse transcription tags each mRNA molecule with a cell barcode (shared per droplet) and a unique molecular identifier (UMI) (distinct per molecule), enabling digital counting of transcripts that corrects for PCR amplification bias. Reads are aligned with STAR, cell barcodes corrected to within one Hamming distance, and UMIs collapsed to produce the matrix X.

The UMI count x_gc is commonly modeled as

```
x_gc ~ Poisson(m_c · λ_gc)          (1)
```

where m_c is the cell-specific capture rate (library size) and λ_gc the relative expression. Summing over genes gives the library size n_c = Σ_g x_gc. A further layer of structure acknowledges *ambient RNA*: droplets containing only free-floating transcripts (empty droplets) follow a distinct distribution, and tools such as CellBender model the observed matrix as a mixture of true cellular and ambient components, filtering false-positive cells.

### 2.2 Quality control

Before any downstream analysis, cells and genes are filtered by:

- **UMI count** n_c: cells with too few UMIs are empty droplets or debris; too many suggest doublets (two cells per GEM).
- **Gene count**: number of detected genes per cell.
- **Mitochondrial fraction**: a high fraction of mitochondrial transcripts indicates a damaged cell whose cytoplasmic mRNA has leaked.
- **Doublet detection**: computational methods (Scrublet, DoubletFinder, scDblFinder) simulate artificial doublets and flag cells whose neighborhood is enriched for them.

### 2.3 The statistical character of single-cell counts

UMI counts are overdispersed relative to Poisson. The workhorse model is the negative binomial (NB),

```
x_gc ~ NB(mean = μ_gc, dispersion = θ_g)     (2)
```

with Var(x) = μ + μ²/θ. The dispersion θ_g captures biological heterogeneity beyond sampling noise. Early protocols (Smart-seq2, full-length) exhibited genuine *zero inflation* from inefficient capture, motivating zero-inflated NB models; modern droplet data with UMIs are generally adequately modeled by the plain NB once sequencing depth is sufficient, and zero inflation is now regarded as largely unnecessary for UMI data. This distinction matters: it decides whether the model needs an extra dropout component or whether normalization and NB regression suffice.

## 3. Methodology

The standard pipeline, codified in the best-practices tutorial of Luecken and Theis [7], is:

1. **QC and filtering** — remove empty droplets, damaged cells, and doublets.
2. **Normalization** — remove cell-specific scaling (depth, capture efficiency) while preserving biological heterogeneity.
3. **Feature selection** — identify highly variable genes (HVGs) that carry signal.
4. **Dimensionality reduction** — PCA to a linear subspace, then nonlinear embedding (UMAP/t-SNE) for visualization.
5. **Graph construction and clustering** — k-nearest-neighbor graph; Louvain/Leiden communities.
6. **Batch integration** (when merging experiments) — Harmony or scVI.
7. **Trajectory inference / pseudotime** — Monocle, Slingshot, PAGA, RNA velocity.
8. **Differential expression** — MAST, DESeq2-adapted, or NB generalized linear models.
9. **Annotation** — map clusters to cell types via marker genes or reference atlases.

![Pipeline](../public/thesis/scrna-trajectory-inference-b7d2-0.webp)
*Figure 1 — The end-to-end scRNA-seq pipeline: from 10x Chromium droplet capture and UMI count matrix X ∈ ℕ₀^(G×C) through QC, normalization (SCTransform/scran), PCA, UMAP, Leiden clustering, trajectory inference, and differential expression.*

---

## 4. Deep Dive

### 4.1 Normalization: from counts to comparable quantities

The simplest normalization is log-normalization: x̃_gc = log(1 + x_gc · s / n_c) with scale factor s (commonly 10⁴). While serviceable, it conflates variance-stabilization with depth correction and induces artificial correlations. Two principled alternatives dominate modern practice.

**SCTransform** fits, for each gene g, a NB generalized linear model against log library size:

```
log μ_gc = β_0g + β_1g · log10(n_c)         (3)
```

and works with Pearson residuals r_gc = (x_gc − μ̂_gc)/√(μ̂_gc + μ̂_gc²/θ̂_g), subsequently clipped. This regresses out technical depth variation *per gene* while stabilizing variance [1]. A regularized variant borrows dispersion information across genes of similar abundance, crucial when thousands of cells provide limited per-gene information.

**scran deconvolution** addresses a subtler problem: computing size factors per cell directly from sparse counts is noisy because most genes are zero in most cells. scran pools cells into overlapping clusters, estimates pooled size factors by summing counts (where zeros average out), then *deconvolves* the pooled factors back to cell-specific factors via a linear system. The method is robust for protocols with many zeros and makes no assumption about the majority of genes being non-differentially expressed only in a weak sense (it requires that the pooled DE genes roughly cancel).

| Method | Model class | Zero handling | Depth regressed per gene |
|---|---|---|---|
| log(1 + CPM) | deterministic | pseudocount | no |
| SCTransform | NB GLM, per gene | modeled | yes |
| scran | pooled deconvolution | aggregation | pooled |

### 4.2 Dimensionality reduction: PCA, t-SNE, UMAP

**PCA** projects the centered, scaled expression matrix onto the top d eigenvectors of its covariance (d ≈ 30–50). It is linear, deterministic up to sign, and preserves global variance structure; its cost is O(min(G²C, C²G)) for exact SVD, reduced to O(GC·d) with randomized algorithms (e.g., the implicitly restarted Lanczos in `irlba` or Halko–Martinsson–Tropp sketches). PCA is the workhorse first reduction: all downstream graph and integration methods operate on the PC coordinates, not the raw genes.

**t-SNE** converts high-dimensional Gaussian similarities p_ij into a low-dimensional Student-t embedding q_ij by minimizing KL(p‖q). Its heavy-tailed kernel resolves local crowding and produces visually separated clusters, but it distorts global geometry: inter-cluster distances are essentially meaningless, and results depend on perplexity and initialization. It is unsuitable for quantitative trajectory analysis.

**UMAP** [5] constructs a fuzzy topological representation: a weighted kNN graph whose edge weights are interpreted as fuzzy-set memberships, then optimizes a low-dimensional layout minimizing fuzzy cross-entropy,

```
C = Σ_e [w_h(e) log(w_h(e)/w_l(e)) + (1 − w_h(e)) log((1 − w_h(e))/(1 − w_l(e)))]   (4)
```

with attractive forces along graph edges and repulsive forces from negative sampling. UMAP preserves more global structure than t-SNE and is substantially faster (O(C log C)), making it the default visualization. Critically, however, neither UMAP nor t-SNE distances should be used for pseudotime or DE; all quantitative inference happens in PC or count space, and the embedding is for display.

![Dimensionality reduction and clustering](../public/thesis/scrna-trajectory-inference-b7d2-1.webp)
*Figure 2 — From the count matrix to structure: PCA scree decomposition, UMAP manifold embedding of Leiden clusters, and the Louvain/Leiden community-detection formulation with modularity Q.*

### 4.3 Clustering: Louvain and Leiden on the kNN graph

After PCA, cells are connected in a k-nearest-neighbor graph (k ≈ 15–30, cosine or Euclidean on PCs), optionally refined to a shared-nearest-neighbor (Jaccard) graph. Communities are found by maximizing **modularity**:

```
Q = (1/2m) Σ_ij [A_ij − (k_i k_j)/(2m)] δ(c_i, c_j)     (5)
```

where A is the adjacency, k_i the degree, and δ the Kronecker delta over community labels. **Louvain** greedily moves nodes between communities and aggregates, but can produce internally disconnected communities and exhibits order dependence. **Leiden** [6] repairs this: after each Louvain-like move it refines communities into well-connected subsets, guaranteeing that every community is internally connected and that the partition is locally optimal. Leiden is now the default in scanpy/Seurat, with a resolution parameter γ controlling granularity via the Reichardt–Bornholdt Potts generalization of (5). Clustering is resolution-dependent and descriptive, not a hypothesis test: a "cluster" is a community at a chosen resolution, and over-clustering followed by marker-based merging is standard practice.

### 4.4 Trajectory inference: pseudotime, Monocle, Slingshot, and PAGA

When cells occupy a *continuum* — differentiation, activation, the cell cycle — clustering is the wrong abstraction. Trajectory inference (TI) reconstructs a latent temporal ordering, or **pseudotime**, from static snapshots.

> Theorem: Pseudotime is identifiable only up to monotone reparametrization; any TI method that reports absolute rates of biological change from a single snapshot is implicitly imposing a kinetic model that the data alone cannot verify.

**Monocle** [2] pioneered the approach: select ordering genes, reduce dimension with ICA, build a minimum spanning tree (MST) over cells, find the longest path (the "diameter") as the main trajectory, and project cells onto it to obtain pseudotime. Branches are detected as side paths. Monocle 2 replaced ICA+MST with **reversed graph embedding (DDRTree)**, learning a principal tree jointly with the embedding, which handles complex branching (e.g., five branch points in hematopoiesis). Monocle 3 scales to millions of cells via UMAP-graph partitioning.

**Slingshot** takes a different, two-stage route: it starts from cluster labels, fits an MST over cluster centers to identify lineage topology, then fits simultaneous **principal curves** — smooth one-dimensional manifolds — through the cells of each lineage, with a shrinkage step toward a shared average curve near the branching point. Pseudotime is the arc-length projection onto each curve. Because it separates lineage identification (discrete) from curve fitting (continuous), Slingshot is robust and its uncertainty quantification is comparatively well understood; benchmarks have repeatedly ranked it among the most accurate TI methods.

**PAGA** [3] reconciles clustering with trajectories. Rather than forcing a tree, it builds a *partition-based graph abstraction*: given a partition of cells (e.g., Leiden clusters), it tests whether the number of inter-partition edges in the kNN graph exceeds expectation under random assignment (a modularity-like null), producing a weighted graph whose nodes are cell groups and whose edge weights are confidences of connectivity. The PAGA graph preserves the topology of the data manifold — disconnected types stay disconnected, continuous transitions stay connected — and supports multi-resolution exploration. It scales to ~10⁶ cells and serves as initialization for single-cell-resolution methods (PAGA-initialized UMAP, diffusion pseudotime).

![Trajectory inference](../public/thesis/scrna-trajectory-inference-b7d2-2.webp)
*Figure 3 — Trajectory inference: pseudotime-ordered branching lineages (Monocle/Slingshot principal-curve view) and the PAGA abstracted graph reconciling discrete clusters with continuous transitions.*

### 4.5 RNA velocity: directed dynamics from splicing kinetics

All methods above infer *order* without *direction*: pseudotime cannot tell a progenitor from its progeny without external labels. **RNA velocity** [4] extracts direction from the data itself by exploiting intronic reads. For each gene, unspliced (nascent, u) and spliced (mature, s) mRNA obey

```
du/dt = α − βu,      ds/dt = βu − γs       (6)
```

with transcription rate α, splicing rate β, and degradation rate γ. The **velocity** v = ds/dt ≈ βu − γs is the time derivative of the expression state: positive when the gene is being up-regulated, negative when down-regulated. In steady state (du/dt = ds/dt = 0), unspliced and spliced counts lie on a line u = (γ/β)s; deviations from this line estimate velocity. Velocities are aggregated across genes into a high-dimensional vector per cell and projected onto the embedding as streamlines, predicting each cell's future state on a timescale of hours [4].

**scVelo** [8] generalizes the steady-state model with a **dynamical model**: it solves the full system (6) per gene via an expectation–maximization algorithm, estimating transcription, splicing, and degradation rates together with a gene-shared **latent time** that orders cells along the underlying process. 
![RNA velocity](../public/thesis/scrna-trajectory-inference-b7d2-3.webp)
*Figure 4 — RNA velocity: (u, s) phase portraits with steady-state fits and induction/repression arcs (velocyto/scVelo), and the velocity vector field projected onto a UMAP embedding.*

Caveats are real and well documented: unspliced counts are sparse and noisy; the model assumes constant rates per gene-state and gene independence; preprocessing (kNN smoothing of moments) strongly influences results; and a velocity field that disagrees with known biology should be distrusted rather than celebrated. The perspective of Bergen et al. [9] catalogs these pitfalls and remains essential reading.

### 4.6 Batch integration: Harmony and scVI

Merging batches (donors, technologies, time points) introduces technical variation that can dominate biology. **Harmony** [10] operates on PC coordinates: it iterates between (i) soft clustering with a diversity penalty favoring clusters containing cells from many batches (maximum-diversity clustering, a variant of soft k-means), and (ii) fitting a cluster-specific linear mixture model of PC coordinates on batch membership and correcting each cell by its membership-weighted batch coefficients. Harmony scales to 10⁶ cells with modest memory (under 10 GB at 500k cells) and is evaluated with the local inverse Simpson's index (LISI): integration LISI near the number of batches and cell-type LISI near 1.

**scVI** takes a deep generative route: a variational autoencoder whose latent variable z_c models biological state and whose decoder is a zero-inflated (or plain) NB conditioned on z_c and batch covariates. The ELBO objective jointly learns denoised expression and a batch-corrected latent space, with uncertainty quantification from the posterior. scVI and its extensions (scANVI for label transfer, totalVI for CITE-seq) dominate atlas-scale integration (10⁷ cells), .

### 4.7 Differential expression modeling

DE testing in single cells must handle sparsity, heteroscedasticity, and the fact that clusters are data-derived (post-selection inference — naïve p-values are optimistic).

- **MAST** fits a two-part hurdle model: logistic regression for detection (zero vs. non-zero) plus Gaussian linear model for log-expression conditional on detection, combined via a likelihood-ratio test. It accommodates cellular detection rate as a covariate.
- **DESeq2-adapted (pseudobulk)**: summing UMI counts within cluster × sample replicates yields pseudobulk profiles that satisfy DESeq2's NB GLM assumptions (size-factor normalization, empirical-Bayes dispersion shrinkage, Wald/LRT tests). Pseudobulk DE is currently the recommended default when biological replicates exist, because it respects the experimental unit and controls false discoveries far better than per-cell tests.
- **NB GLMs on single cells**: frameworks like glmGamPoi fit NB regressions per gene across cells with observation weights, enabling fast LRT-based DE that scales to millions of cells.

A subtle identifiability result governs all of these: because clusters are estimated from the same data, DE p-values between clusters are anti-conservative unless the selection event is accounted for (e.g., via data splitting or selective-inference corrections). Pseudobulk aggregation partially mitigates this by changing the unit of replication.

---

## 5. Empirical Results and Proofs

The methods above are not merely heuristic; several carry formal guarantees and have been validated at scale:

1. **Capture efficiency (Zheng et al. [1])**: ~50% cell capture efficiency, ~6-minute encapsulation of 8 samples, 68k PBMCs profiled in one run; ERCC spike-ins and cell-line mixing established sensitivity and doublet-rate calibration. 

2. **Monocle pseudotime validation [2]**: ordering of differentiating human myoblasts recovered switch-like regulation of known myogenic factors (MYOG, MEF2C) and predicted novel regulators validated by loss-of-function screening — proof that pseudotemporal ordering recovers genuine kinetic cascades.

3. **PAGA topology preservation [3]**: consistent graph abstraction across four hematopoietic datasets, planaria, and zebrafish embryo; benchmarked on one million neurons with runtime scaling near-linearly, demonstrating that the connectivity test controls false edges while preserving true manifold topology.

4. **RNA velocity predictive validation [4]**: velocity vectors in the neural crest lineage correctly predicted the direction of differentiation toward sensory neurons on an hours timescale, and the hippocampus analysis recovered the known branching lineage tree.

5. **Harmony integration metrics [10]**: on Jurkat/293T mixtures, Harmony achieved median iLISI ≈ 2 (perfect mixing of two batches) with cLISI ≈ 1 (cell types preserved), using 30–50× less memory than MNN Correct or Seurat MultiCCA at 125k cells.

6. **TI benchmarking (dynverse/Saelens et al.)**: across 110+ datasets and 45+ methods, no single TI method dominates; accuracy depends on topology (linear, bifurcating, multifurcating, cyclic). Slingshot and PAGA rank consistently near the top for bifurcating topologies, and ensemble/consensus approaches outperform any single method — a result with the flavor of a no-free-lunch theorem for trajectory inference.

> Theorem: (No free lunch for TI.) For any trajectory inference method M, there exists a data-generating topology and noise regime on which M's pseudotime correlation with ground truth is arbitrarily poor while another method succeeds; method choice must therefore be conditioned on prior knowledge of the expected topology.

---

## 6. Limitations

- **Sparsity and dropout**: UMI data are sparse (~90%+ zeros); distinguishing biological zeros from technical dropout remains partially unidentifiable, and imputation methods (MAGIC, SAVER) can fabricate signal — imputed values must never enter DE testing.
- **Pseudotime is not time**: ordering is monotone-reparametrization invariant; rates, durations, and direction require kinetic models (RNA velocity) or experimental time labels, and velocity itself rests on strong constant-rate assumptions.
- **Resolution dependence**: Leiden clusters, PAGA graphs, and Slingshot lineages all depend on tuning parameters (resolution, k, number of PCs); stability analysis across parameters is mandatory, not optional.
- **Doublets and ambient RNA**: heterotypic doublets masquerade as novel intermediate states and can invent spurious trajectory branches; rigorous doublet filtering precedes any TI claim.
- **Batch confounding**: when batch is collinear with biology (e.g., each donor is one condition), no integration method can separate them; Harmony and scVI both assume shared cell states across batches.
- **Scalability vs. rigor**: exact NB GLMs and full EM dynamical velocity do not scale to 10⁷ cells; production pipelines rely on approximations (stochastic VI, mini-batch kNN) .
- **Post-selection inference**: DE between data-derived clusters is optimistic; pseudobulk with true replicates is the current best practice.

## 7. Conclusion

The scRNA-seq analysis pipeline is a cascade of statistical models, each addressing one facet of a high-dimensional, sparse, noisy measurement: NB regression for normalization, spectral geometry for dimensionality reduction, modularity optimization for clustering, principal curves and graph abstraction for trajectories, kinetic ODEs for RNA velocity, and hierarchical models for differential expression. The field's trajectory is toward atlas scale (10⁷–10⁸ cells), where deep generative models (scVI family) and streaming algorithms are displacing per-dataset heuristics, and toward multi-omic integration (RNA + ATAC + protein), where the same mathematical machinery — latent variable models, manifold learning, optimal transport — is being re-derived for richer measurements. The enduring lesson is a statistical one: every embedding, cluster, pseudotime, and p-value is the output of a model with assumptions, and the analyst's job is to know exactly which assumptions were made.

## References

[1] Zheng, G. X. Y. et al. Massively parallel digital transcriptional profiling of single cells. *Nature Communications* 8, 14049 (2017). https://www.nature.com/articles/ncomms14049

[2] Trapnell, C. et al. The dynamics and regulators of cell fate decisions are revealed by pseudotemporal ordering of single cells. *Nature Biotechnology* 32, 381–386 (2014). https://doi.org/10.1038/nbt.2859

[3] Wolf, F. A. et al. PAGA: graph abstraction reconciles clustering with trajectory inference through a topology preserving map of single cells. *Genome Biology* 20, 59 (2019). https://link.springer.com/article/10.1186/s13059-019-1663-x

[4] La Manno, G. et al. RNA velocity of single cells. *Nature* 560, 494–498 (2018). https://doi.org/10.1038/s41586-018-0414-6

[5] McInnes, L., Healy, J. & Melville, J. UMAP: Uniform Manifold Approximation and Projection for dimension reduction. *arXiv:1802.03426* (2018). https://arxiv.org/abs/1802.03426

[6] Traag, V. A., Waltman, L. & van Eck, N. J. From Louvain to Leiden: guaranteeing well-connected communities. *Scientific Reports* 9, 5233 (2019). https://doi.org/10.1038/s41598-019-41695-z

[7] Luecken, M. D. & Theis, F. J. Current best practices in single-cell RNA-seq analysis: a tutorial. *Molecular Systems Biology* 15, e8746 (2019). https://doi.org/10.15252/msb.20188746

[8] Bergen, V. et al. Generalizing RNA velocity to transient cell states through dynamical modeling. *Nature Biotechnology* 38, 1408–1414 (2020). https://doi.org/10.1038/s41587-020-0591-3

[9] Bergen, V. et al. RNA velocity — current challenges and future perspectives. *Molecular Systems Biology* 17, e10282 (2021). https://link.springer.com/content/pdf/10.15252/msb.202110282.pdf

[10] Korsunsky, I. et al. Fast, sensitive and accurate integration of single-cell data with Harmony. *Nature Methods* 16, 1289–1296 (2019). https://www.nature.com/articles/s41592-019-0619-0

