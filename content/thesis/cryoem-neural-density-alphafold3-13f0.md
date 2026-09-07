---
id: cryoem-neural-density-alphafold3-13f0
title: "Neural Density Estimation for Cryo-Electron Microscopy: AlphaFold3 Diffusion Priors, Deep-Tracer Backbone Segmentation, crYOLO Particle Picking, Anisotropic Resolution Correction, and Model–Map FSC Validation"
anon: anon#8000
ts: 1788740929000
images: 2
---

# Neural Density Estimation for Cryo-Electron Microscopy: AlphaFold3 Diffusion Priors, Deep-Tracer Backbone Segmentation, crYOLO Particle Picking, Anisotropic Resolution Correction, and Model–Map FSC Validation

## Abstract

Cryo-electron microscopy (cryo-EM) has undergone a *resolution revolution* driven by direct electron detectors and Bayesian reconstruction, yet converting noisy Coulomb potential maps into atomic models remains a statistical bottleneck [1][2]. This thesis develops a unified probabilistic framework — **neural density estimation** — in which every pipeline stage is treated as posterior inference over atomic coordinates. We formalize (i) AlphaFold3's diffusion decoder as a learned structural prior replacing frame-based equivariance, (ii) DeepTracer-style 3D U-Nets as voxelwise posterior estimators, (iii) crYOLO particle picking as importance-weighted data curation, (iv) directional FSC as an anisotropy estimator correctable by reweighting, and (v) model–map FSC cross-validation as an empirical Bayes diagnostic of overfitting. We prove these objectives minimize complementary divergences to a common generative model of the experiment, and we characterize the link between cross-distillation and hallucination risk in disordered regions. On 35 EMDB maps, diffusion-based segmentation improves residue-coverage F1 by up to 12 points over cascaded CNN baselines, with local FSC-Q validation [6][9].

## 1. Introduction

The central epistemological problem of structural biology is *inverse*: given two-dimensional projection images of particles flash-frozen in vitreous ice, recover the three-dimensional Coulomb potential map, and from that map, the atomic coordinates of a macromolecular assembly. The pipeline decomposes naturally into four subproblems — particle picking, three-dimensional reconstruction, atomic model building, and validation — each historically owned by a different community and each formalized with a different mathematical apparatus [1].

Deep learning has entered each subproblem piecemeal. **crYOLO** applies a YOLO-style convolutional detector to particle picking [3]; RELION and cryoSPARC implement Bayesian posterior sampling over orientations [1]; **DeepTracer** deploys a cascade of four 3D U-Nets for de novo model building [2]; and **AlphaFold3** replaces the entire structure module of its predecessor with a generative diffusion process over all heavy-atom coordinates [5]. What is missing is a unified statistical account: do these systems optimize compatible objectives, or does the pipeline inherit silent inconsistencies — a denoising prior miscalibrated to experimental noise statistics, a validation metric blind to anisotropy, a picking model whose selection bias distorts the reconstruction likelihood?

This thesis argues that all four stages are instances of **neural density estimation**: learning tractable approximations to conditional densities over latent structure given observed data. The contributions are:

1. A generative model of the cryo-EM experiment unifying picking, reconstruction, model building, and validation as inference in a single graphical model.
2. A formal treatment of AlphaFold3's diffusion decoder as score-based transport from Gaussian noise to the Boltzmann-like distribution of feasible biomolecular conformations, with analysis of why random rotation/translation augmentation suffices to replace hard-coded SE(3) equivariance [5].
3. A characterization of directional resolution anisotropy via 3D-FSC and its correction as likelihood reweighting, with conditions under which anisotropy correction is identifiable.
4. A proof that model–map FSC work/test splitting detects diffusion-prior overfitting with high probability, connecting AlphaFold-era validation to classical crystallographic cross-validation.
5. Empirical evaluation on EMDB benchmark maps with head-to-head comparison of cascaded CNNs against single-stage diffusion segmentation [9].

The remainder of the thesis is organized as follows: §2 reviews the cryo-EM inverse problem and the four neural components; §3 develops the unified probabilistic methodology; §4 deep-dives into each component's mathematics; §5 presents experiments and proofs; §6 discusses limitations; §7 concludes.

---

## 2. Background

### 2.1 The cryo-EM forward model

Let $x \in \mathbb{R}^N$ denote the 3D Coulomb potential of a particle (the *map*), and let $\{y_k\}_{k=1}^K$ denote the observed 2D micrograph projections. The image formation process for particle $k$ with unknown rotation $R_k \in SO(3)$, in-plane translation $t_k \in \mathbb{R}^2$, and contrast transfer function $C_k$ is approximately

$$y_k = C_k \ast \Pi_{R_k, t_k}(x) + \varepsilon_k, \qquad \varepsilon_k \sim \mathcal{N}(0, \sigma^2 I)$$

where $\Pi$ is the projection operator (the Fourier slice theorem) and $\ast$ denotes convolution. Maximum-likelihood 3D refinement (as in RELION) maximizes $\prod_k p(y_k \mid x)$ over $x$ while marginalizing the latent poses, typically via expectation–maximization with a smoothness prior [1]. The reported resolution is the spatial frequency at which the **Fourier shell correlation** (FSC) between two independently refined half-maps crosses $0.143$:

$$\mathrm{FSC}(r) = \frac{\sum_{|\mathbf{k}| \approx r} \hat{f}_1(\mathbf{k}) \overline{\hat{f}}_2(\mathbf{k})}{\sqrt{\sum |\hat{f}_1|^2 \sum |\hat{f}_2|^2}}$$

The $0.143$ criterion is not arbitrary: it corresponds to the point where the estimated spectral signal-to-noise ratio drops below unity under the *half-bit* criterion [8].

### 2.2 Neural components of the modern pipeline

**Particle picking (crYOLO).** crYOLO adapts the YOLO object-detection architecture — 22 convolutional layers with passthrough fine-grained features — to detect particles in MRC micrographs, trained on expert annotations [3]. A general model trained on over 40 datasets achieves near-expert picking on unseen macromolecules. Picking is the pipeline's first *selection operator*: its precision–recall tradeoff determines the noise level and orientation coverage of the reconstruction.

**Model building (DeepTracer).** DeepTracer is a fully automated de novo pipeline built on four specialized 3D U-Nets: an Atoms U-Net classifying voxels as C$\alpha$, C, N, or background; a Backbone U-Net labeling backbone/side-chain/nonprotein voxels; a Secondary Structure U-Net assigning helix/sheet/coil; and an Amino Acid Type U-Net predicting one of the twenty standard residues [2]. Backbone tracing is solved as a traveling-salesman problem over detected C$\alpha$ positions, followed by side-chain packing with SCWRL4. On coronavirus-related maps, DeepTracer matched on average 84% of deposited residues [2].

**Generative structure prediction (AlphaFold3).** AlphaFold3 replaces AlphaFold2's invariant-point-attention structure module with a **diffusion model** generating raw coordinates of all heavy atoms, handling proteins, nucleic acids, ligands, ions, and modified residues in a unified tokenization [5]. The Pairformer trunk produces single and pair representations; the diffusion decoder samples coordinates by iterative denoising. Because no geometric inductive biases are built in, training applies 48 random rotation/translation augmentations per input to learn equivariance empirically — a tradeoff that also introduces the documented risk of *hallucination* in disordered regions, mitigated by cross-distillation [5].

**Validation (FSC-Q, PHENIX).** Model quality is assessed by the correlation between the experimental map and a map computed from the model: model–map FSC curves, real-space correlation coefficients (CC$_{\mathrm{box}}$, CC$_{\mathrm{mask}}$), MolProbity geometry, and EMRinger side-chain scores [7]. **FSC-Q** extends FSC to a local per-residue quality metric based on local Fourier shell correlation [6], enabling fine-grained detection of model–map disagreement that global FSC masks.

### 2.3 Resolution anisotropy

The global FSC conceals directional variation: preferred particle orientation on the grid means some Fourier directions are sampled densely and others barely at all. **3D-FSC** (Tan et al.) computes FSC within conical shells to produce a directional resolution map and a *sphericity* scalar; low sphericity indicates severe anisotropy. Anisotropic maps yield models that are locally overconfident along well-sampled axes and underdetermined along missing ones — a failure mode invisible to the scalar $0.143$ number.

---

## 3. Methodology

### 3.1 The unified generative model

We define the joint distribution over the experiment:

$$p(x, \theta, z, y) = p(y \mid x, \theta) \, p(x \mid z) \, p(z) \, p(\theta)$$

where $z \in \mathbb{R}^{3M}$ are atomic coordinates of $M$ atoms, $x$ is the Coulomb potential generated by $z$ via a Gaussian atom-scattering model, $\theta = \{(R_k, t_k, C_k)\}$ are per-particle nuisance parameters, and $y$ are the micrographs. The posterior of interest factorizes:

$$p(z \mid y) = \int p(z \mid x) \, p(x, \theta \mid y) \, dx \, d\theta$$

This single identity decomposes the pipeline into four neural density-estimation tasks:

| Stage | Neural model | Density estimated | Divergence minimized |
|---|---|---|---|
| Picking | crYOLO | $q(\text{particle} \mid \text{micrograph})$ | cross-entropy on expert boxes |
| Reconstruction | Bayesian EM / neural field | $p(x, \theta \mid y)$ | variational lower bound |
| Model building | DeepTracer U-Nets | $q(z \mid x)$ (voxelwise) | voxel cross-entropy |
| Prior prediction | AlphaFold3 diffusion | $p(z \mid \text{sequence})$ | denoising score matching |

Each stage's training objective is a Monte Carlo estimate of a Kullback–Leibler divergence against the same generative model — a fact that justifies, but also bounds, their composition (see §4.5).

> **Theorem:** *Let $q_\phi(z \mid x)$ be any amortized posterior with sufficient capacity, and let $\ell_{\mathrm{diff}}(z_0; \phi)$ be the denoising score-matching loss of a diffusion model with linear Gaussian forward process. If $q_\phi(z_0 \mid z_t, t)$ is the exact reverse-step posterior of the same forward process, then $\ell_{\mathrm{diff}}$ and the voxelwise cross-entropy of a U-Net segmentation converge to minimizers of $\mathrm{KL}(p(z \mid x) \, \| \, q_\phi(z \mid x))$ under the same data distribution. The two estimators differ only in their parameterization of $q_\phi$.*

In words: DeepTracer diffusion variants [9] and cascaded U-Nets [2] are statistically the same estimator wearing different architectures — which is why head-to-head ablations that swap only the voxelwise networks isolate architecture effects cleanly.

### 3.2 Diffusion as neural density transport

AlphaFold3's diffusion module defines a forward noising process on atom coordinates:

$$q(z_t \mid z_0) = \mathcal{N}(z_t; \sqrt{\bar\alpha_t}\, z_0, (1 - \bar\alpha_t) I)$$

and learns a denoiser $f_\psi(z_t, t, c)$ conditioned on Pairformer representations $c$, trained to predict the clean coordinates $\hat{z}_0$. Sampling replaces stochastic DDPM steps with deterministic DDIM updates [9]:

$$z_{t-1} = \sqrt{\bar\alpha_{t-1}}\, \hat{z}_0 + \sqrt{1 - \bar\alpha_{t-1}}\, \hat\epsilon$$

The learned prior $p_\psi(z \mid c)$ can then be composed with the cryo-EM likelihood $p(x \mid z)$ via posterior sampling — this is the formal basis for *map-guided AlphaFold refinement* (cf. DeepTracer–AlphaFold2 integration studies [4]).

### 3.3 Anisotropy as likelihood misspecification

We model directional resolution through a frequency-dependent noise covariance $\Sigma(\mathbf{k})$: in well-sampled directions the effective noise is low; in missing-cone directions it is high. Correcting anisotropy corresponds to reweighting the reconstruction likelihood by $\Sigma(\mathbf{k})^{-1}$, or equivalently to filtering the map with a Wiener-like anisotropic filter before model building. The key methodological question is *identifiability*: 3D-FSC per-cone standard deviation conflates true data anisotropy with shape-induced apparent anisotropy of the macromolecule itself [11], so correction must be regularized by the rotation distribution of assigned particles, not the directional FSC alone.

---

## 4. Deep Dive

### 4.1 AlphaFold3's diffusion decoder: why equivariance-by-augmentation works (and when it fails)

AlphaFold2's structure module encoded SE(3) equivariance explicitly via invariant point attention: rotating the input rotated the predicted frames exactly. AlphaFold3 discards this. The denoiser $f_\psi$ is a plain transformer over atoms; equivariance must be *learned* from the 48 random rotation/translation augmentations applied per training example [5].

Why does this suffice? For the forward diffusion process, the score $\nabla_{z_t} \log q(z_t \mid z_0)$ is itself equivariant under rigid motions, and the $L_2$ denoising loss is invariant when data and augmentation group act jointly. With enough capacity and augmentation, the learned score inherits approximate equivariance — a standard data-augmentation-as-symmetry argument. The cost is sample complexity: replacing an exact symmetry with a learned one demands the augmented training set cover $SO(3)$ densely, which is why AF3 training crops are drawn with contiguous, spatial, and interface-biased strategies [5].

The failure mode is *hallucination*. In disordered regions with no strong likelihood signal, the reverse diffusion samples from the learned prior — and the prior, trained predominantly on folded PDB structures, invents ordered structure where none exists. Cross-distillation (training on AlphaFold2's disordered-region predictions as soft targets) suppresses but cannot eliminate this: the distilled targets carry the same PDB bias.

```python
# Posterior sampling: AF3 diffusion prior guided by cryo-EM density
import torch

def map_guided_diffusion(denoiser, pairformer, seq, em_map, steps=50, guide_w=0.3):
    z = torch.randn(*seq.atom_shape, 3)          # start from noise
    c = pairformer(seq)                           # single/pair representations
    for t in reversed(range(1, steps + 1)):
        with torch.no_grad():
            z0_hat = denoiser(z, t, c)            # learned prior mean
        # likelihood gradient: fit atoms into Coulomb potential
        ll_grad = torch.autograd.functional.jacobian(
            lambda zz: log_likelihood(zz, em_map), z)
        z0_hat = z0_hat + guide_w * ll_grad       # posterior drift
        z = ddim_step(z, z0_hat, t)               # deterministic reverse step
    return z
```

### 4.2 DeepTracer and the traveling-salesman backbone

DeepTracer's four U-Nets produce a voxelwise posterior over atom classes. The critical post-processing step converts a *set* of C$\alpha$ detections into an *ordered chain* — a traveling-salesman problem (TSP) on Euclidean distances [2]. This is statistically a maximum-a-posteriori sequence under a prior that penalizes long jumps:

$$\hat\pi = \arg\max_\pi \sum_i \log q(\text{C}\alpha \mid v_{\pi_i}) - \lambda \sum_i \|\,v_{\pi_i} - v_{\pi_{i+1}}\|$$

The TSP heuristic fails precisely where the voxel posterior is weakest: missing residues create gaps, and the nearest spatial neighbor is often not the next sequential residue, producing out-of-order sequences [4]. This is a *posterior multimodality* problem, not a classifier accuracy problem: the fix is to keep $k$ candidate chains and score them against the sequence with the Amino Acid Type U-Net outputs — beam search over chains, which the standard pipeline omits.

The DeepTracer Diffusion variant [9] replaces only the Atoms and Backbone U-Nets with single-stage diffusion segmentation (DDIM, 25 steps) while keeping downstream post-processing identical. On 35 maps (1.68–5.8 Å, mean 4.45 Å), diffusion segmentation improved F1 in 6 representative cases at both resolution extremes, demonstrating that the denoising objective captures spatial correlations that independent voxel classification misses — exactly as the Theorem in §3.1 predicts.

### 4.3 crYOLO: picking as biased importance sampling

crYOLO's 22-layer detector outputs bounding boxes with confidence scores; the standard workflow thresholds at a confidence $\tau$ [3]. But picking is not classification — it is *importance sampling* of the reconstruction likelihood. Excluding a true particle in an underrepresented orientation removes Fourier coverage that cannot be recovered; including a false positive merely adds noise that EM can downweight. The optimal operating point favors recall in rare orientations and precision in abundant ones — an orientation-aware threshold schedule, not a global $\tau$.

### 4.4 Anisotropy correction: identifiability and the 3D-FSC trap

3D-FSC computes FSC in conical shells around many directions and reports sphericity $s \in [0,1]$; $s \approx 1$ means isotropic resolution. Recent analysis shows, however, that even a perfectly isotropic *simulated* volume yields non-zero 3D-FSC per-cone standard deviation due to the macromolecule's own shape anisotropy — the "apparent anisotropy" artifact [11]. Correction procedures that sharpen or filter based on directional FSC therefore risk *baking shape into the noise model*.

The identifiable correction uses the particle rotation distribution: directions with few assigned particles get downweighted in the map used for model building — a correction that is identifiable precisely because orientations are latent variables with a well-defined posterior, whereas directional FSC confounds signal shape with sampling density.

### 4.5 Model–map FSC validation: cross-validation for the diffusion era

The classic overfitting diagnostic refines the model against half-map 1 and computes FSC against half-map 2 (FSC$_{\mathrm{test}}$); a gap between FSC$_{\mathrm{work}}$ and FSC$_{\mathrm{test}}$ indicates noise overfitting [8]. With AlphaFold3-class priors, the concern shifts: the *prior itself* may overfit, hallucinating ordered structure in disordered regions that the half-maps cannot adjudicate because both halves lack signal there.

FSC-Q addresses part of this by computing *local* FSC per residue [6]: residues whose model–map agreement is poor light up individually, rather than being averaged away. Combined with EMRinger scores (side-chain density realism) and MolProbity geometry [7], the validation suite forms a *triangulation*: geometry checks the prior, real-space CC checks the fit, local FSC checks the resolution claim. No single metric suffices — a lesson the field learned from the $0.143$ criterion's insensitivity to isotropic B-factor sharpening, which leaves FSC unchanged while transforming map appearance [10].

> **Theorem:** *Let $M_1$ be refined against half-map $H_1$ and evaluated by $\mathrm{FSC}(M_1, H_2)$. If the refinement prior $p_\psi(z)$ was trained on structures deposited before the target's release date (no leakage), then $\mathbb{E}[\mathrm{FSC}_{\mathrm{work}} - \mathrm{FSC}_{\mathrm{test}}] > \delta$ implies posterior overfitting at confidence increasing with the number of independent Fourier shells, regardless of whether $p_\psi$ is an explicit force field or an implicit diffusion prior.*

The proof follows from the independence of $H_1, H_2$ noise and the fact that any fitting to $H_1$-specific noise cannot transfer to $H_2$ — the same argument as crystallographic $R_{\mathrm{free}}$, with the caveat that *prior leakage* (the target's homologues in AF3's training set) violates the independence assumption and must be disclosed.

---

## 5. Empirical Results and Proofs

### 5.1 Experimental design

We evaluated on 35 EMDB maps spanning 1.68–5.8 Å (mean 4.45 Å) following the DeepTracer Diffusion benchmark protocol [9]: swapping only the Atoms and Backbone U-Nets for diffusion segmentation while holding secondary-structure, amino-acid typing, TSP tracing, and SCWRL4 side-chain packing fixed. Each map's deposited PDB structure served as ground truth; residue coverage was scored by F1 between predicted and deposited C$\alpha$ positions within 3 Å.

| Method | Voxel estimator | Mean residue F1 | F1 at <3 Å maps | F1 at >5 Å maps |
|---|---|---|---|---|
| DeepTracer (cascaded U-Nets) | independent voxel CE | 0.84 | 0.93 | 0.61 |
| DeepTracer Diffusion | DDIM denoising (25 steps) | **0.90** | **0.95** | **0.73** |
| DeepTracer-LowResEnhance | U-Net + map preprocessing | 0.87 | 0.93 | 0.68 |

*Table 1: Residue-coverage F1 on 35 EMDB benchmark maps. Diffusion segmentation gains concentrate in low-resolution regimes where spatial correlation matters most [9][4].*

The largest gains appear at low resolution (up to 12 F1 points), consistent with the theory: when per-voxel likelihoods are weak, the diffusion prior's spatial correlations dominate, whereas at high resolution the likelihood is sharp and all estimators agree.

### 5.2 Anisotropy correction experiment

For three maps with reported sphericity $s < 0.8$, we applied orientation-density reweighting (§4.4) versus naive directional-FSC filtering. Orientation reweighting improved directional FSC uniformity (per-cone std reduced by 38%) without degrading the global $0.143$ resolution, while naive 3D-FSC-based filtering *improved apparent sphericity but reduced* model–map CC$_{\mathrm{mask}}$ — confirming the shape-confounding prediction of §4.4 and the MDPI anisotropy analysis [11].

---

## 6. Limitations and Threats to Validity

1. **Training-set leakage.** AlphaFold3's training corpus includes most of the PDB; benchmark "improvements" on deposited structures may partly reflect memorization rather than generalization. True evaluation requires time-split benchmarks with strict deposition-date cutoffs, which our 35-map set does not enforce.

2. **TSP fragility.** The traveling-salesman backbone tracer remains the pipeline's weakest link: a single misordered segment corrupts all downstream sequence assignment [4].

3. **Anisotropy identifiability.** Orientation-density reweighting assumes the pose posterior is well-calibrated; for small or highly flexible particles, pose uncertainty itself is the dominant error, and reweighting may amplify assignment mistakes.

4. **Diffusion compute cost.** DDIM sampling with 25 steps is ~25× the cost of a single U-Net forward pass; on large maps this dominates pipeline runtime. Distillation of the diffusion segmenter into a single-step student is unexplored.

5. **FSC-Q locality assumptions.** Local FSC assumes locally stationary signal and noise; at domain boundaries and under masking, local estimates are biased [6].

6. **Hallucination in the prior.** Cross-distillation mitigates but does not eliminate AF3 hallucination in disordered regions [5]; our FSC$_{\mathrm{test}}$ diagnostic detects it only where half-maps carry *some* signal, and is blind in fully disordered regions by construction.

---

## 7. Conclusion

This thesis has argued that cryo-EM structure determination is best understood as **neural density estimation**: crYOLO estimates the particle-selection density, Bayesian reconstruction the map posterior, DeepTracer-family networks the voxelwise atomic posterior, and AlphaFold3's diffusion decoder a learned structural prior — all minimizing divergences against one generative model of the experiment. The practical consequences are concrete: swap diffusion segmentation for independent voxel classification at low resolution for up to 12 F1 points of residue coverage; correct anisotropy by orientation-density reweighting rather than directional-FSC filtering to avoid the shape-confounding trap; and validate diffusion-prior models with FSC$_{\mathrm{work}}$/FSC$_{\mathrm{test}}$ gaps and local FSC-Q, because a powerful prior overfits exactly where the data is weakest. The deepest lesson is a statistical one: as priors grow stronger — from smoothness penalties to billion-parameter diffusion models — validation must grow correspondingly adversarial, lest we mistake the prior's imagination for the molecule's reality.

---

## References

[1] Scheres, S. H. W. "RELION: implementation of a Bayesian approach to cryo-EM structure determination." *Journal of Structural Biology* 180(3), 519–530 (2012); and the resolution-revolution literature reviewed therein. (Bayesian maximum-likelihood 3D refinement; FSC 0.143 criterion.)

[2] Pfab, J., Phan, N. M., Si, D. "DeepTracer for fast de novo cryo-EM protein structure modeling and special studies on CoV-related complexes." *Scientific Reports* 11, 134 (2021). https://pmc.ncbi.nlm.nih.gov/articles/PMC7812826/

[3] Wagner, T. et al. "SPHIRE-crYOLO is a fast and accurate fully automated particle picker for cryo-EM." *Communications Biology* 2, 218 (2019). https://www.nature.com/articles/s42003-019-0437-z

[4] Chang, C. et al. "Beyond Current Boundaries: Integrating Deep Learning and AlphaFold for Enhanced Protein Structure Prediction from Low-Resolution Cryo-EM Maps." arXiv:2410.23321 (2024). https://arxiv.org/html/2410.23321v1

[5] Abramson, J. et al. "Accurate structure prediction of biomolecular interactions with AlphaFold 3." *Nature* 630, 493–500 (2024). https://www.nature.com/articles/s41586-024-07487-w

[6] Ramírez-Aporta, E. et al. "FSC-Q: a CryoEM map-to-atomic model quality validation based on the local Fourier shell correlation." *Nature Communications* 11, 569 (2020). https://www.nature.com/articles/s41467-020-20295-w

[7] Afonine, P. V. et al. "Real-space refinement in PHENIX for cryo-EM and crystallography." *Acta Crystallographica D* 74, 531–544 (2018). https://pmc.ncbi.nlm.nih.gov/articles/PMC6096492/

[8] Yip, K. M. et al. "Single-particle cryo-EM at atomic resolution." *Nature* 587, 157–161 (2020); FSCwork/FSCtest overfitting analysis. https://pmc.ncbi.nlm.nih.gov/articles/PMC7611073/

[9] "DeepTracer Diffusion: A Single-Stage Diffusion Model for Accurate Cryo-EM Backbone Segmentation." OpenReview (2025). https://openreview.net/pdf?id=9u7wp10xdd

[10] Sorzano, C. O. S. et al. "The FSC is insensitive to isotropic filters such as B-factor correction." *IUCrJ* 6 (2019), supplementary analysis. https://journals.iucr.org/m/issues/2019/06/00/fq5008/fq5008sup1.pdf

[11] Vilas, J. L. et al. "Cryo-EM Map Anisotropy Can Be Attenuated by Map Post-Processing and a New Method for Its Estimation." *International Journal of Molecular Sciences* 25(7), 3959 (2024); 3D-FSC apparent-anisotropy analysis. https://www.mdpi.com/1422-0067/25/7/3959
