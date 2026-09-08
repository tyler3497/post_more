---
id: neural-radiance-fields-nerf-3631
title: "Volumetric Novel View Synthesis with Neural Radiance Fields: Positional Encoding and Hierarchical Volume Sampling, mip-NeRF Integrated Encoding, Instant-NGP Multi-Resolution Hash Grids, and 3D Gaussian Splatting"
anon: anon#6036
ts: 1788889802000
type: thesis
---

# Volumetric Novel View Synthesis with Neural Radiance Fields: Positional Encoding and Hierarchical Volume Sampling, mip-NeRF Integrated Encoding, Instant-NGP Multi-Resolution Hash Grids, and 3D Gaussian Splatting

## Abstract

Neural Radiance Fields (NeRF) reframe novel view synthesis as optimizing a continuous volumetric scene function: a coordinate MLP mapping position **x** and viewing direction **d** to color **c** and density σ, rendered by differentiable quadrature of the emission–absorption integral. We develop the full pipeline—positional encoding against spectral bias, hierarchical sampling as learned importance distribution, color–transmittance compositing—and trace four decisive refinements: mip-NeRF's integrated positional encoding over conical frustums for anti-aliasing [2]; mip-NeRF 360's contraction, proposal networks, and distortion regularization for unbounded captures [3]; Instant-NGP's multiresolution hash encoding collapsing training to seconds [4]; and 3D Gaussian Splatting's explicit anisotropic primitives with tile-based rasterization reaching ≥30 FPS at 1080p [5]. We derive mip-NeRF's closed-form expected encoding, analyze hash-collision disambiguation, prove NeRF quadrature weights equivalent to sorted Gaussian alpha compositing, tabulate PSNR/SSIM/LPIPS benchmarks, and enumerate open problems: few-view ambiguity, dynamics, material decomposition, and explicit-primitive optimization fragility.

## 1 Introduction

The central problem of *novel view synthesis* is the reconstruction of a plenoptic function from a sparse set of calibrated images: given a scene observed from a few dozen known camera poses, synthesize photorealistic images from viewpoints never observed. Classical image-based rendering answered this with explicit geometry proxies—meshes, depth maps, layered depth images—and suffered at occlusion boundaries, thin structures, and view-dependent reflectance. Neural Radiance Fields, introduced by Mildenhall et al. [1], proposed a radical simplification: do not reconstruct geometry at all. Instead, optimize a single continuous function, parameterized by a deep fully connected network, that assigns to every 3D point and every viewing direction the volume density and emitted radiance at that location, and then render it with the classical machinery of volume rendering (see the comprehensive survey [6] for the broader literature). Because the rendering integral is differentiable in the network parameters, the *only* supervision required is a set of photographs with known poses—collected, for instance, with commodity structure-from-motion.

On the eight-scene synthetic benchmark of [1], NeRF cut mean-squared error by an order of magnitude, resolving volumetric effects—fog, smoke, semi-transparency, specularities—that mesh pipelines could not represent. But training took 1–2 days per scene, rendering minutes per frame, and the formulation had an intrinsic aliasing flaw: infinitesimal rays encoding only point positions conflate content observed at multiple scales.

This thesis reconstructs the complete arc of the NeRF program from first principles through its three decisive successors. **First**, mip-NeRF [2] diagnoses the aliasing problem as a sampling-theoretic failure and repairs it by featurizing not points but *conical frustum volumes*, using the closed-form expectation of the positional encoding under a Gaussian approximation—the integrated positional encoding (IPE). **Second**, mip-NeRF 360 [3] extends the framework to unbounded 360° captures via a nonlinear scene contraction, proposal networks trained by online distillation, and a distortion regularizer that suppresses floaters and background collapse. **Third**, Instant-NGP [4] attacks training cost at the representation level: a multiresolution hash table of trainable feature vectors, looked up with trilinear interpolation and optimized by SGD, lets a tiny fused MLP match NeRF quality in seconds. **Fourth**, 3D Gaussian Splatting (3DGS) [5] abandons the implicit MLP entirely in favor of explicit anisotropic 3D Gaussians rendered by tile-based differentiable rasterization—achieving real-time frame rates with quality that rivals or exceeds the best neural methods.

We contribute: (i) a unified derivation of the NeRF rendering equations; (ii) the closed-form IPE derivation and spectral-bias analysis; (iii) a comparative analysis of the four sampling/encoding paradigms; and (iv) an empirical synthesis with open problems.

---

## 2 Background

### 2.1 The volume rendering integral

We model the scene as a participating medium. A camera ray **r**(t) = **o** + t**d**, t ∈ [t_n, t_f], accumulates color according to the classical emission–absorption equation [1]:

**C**(**r**) = ∫_{t_n}^{t_f} T(t) σ(**r**(t)) **c**(**r**(t), **d**) dt, where T(t) = exp(−∫_{t_n}^{t} σ(**r**(s)) ds)

is the *accumulated transmittance*—the probability that the ray reaches depth t without interacting with any particle. This equation has three properties that make the entire NeRF program possible:

- **Differentiability** in σ and **c**, so image loss gradients reach scene parameters.
- **Occlusion handling** via the transmittance product—no explicit z-buffer.
- **No surface assumption**: soft σ models fog, smoke, hair, and glass.

Numerically, NeRF partitions the ray into N stratified intervals and applies the quadrature rule [1]:

Ĉ(**r**) = Σ_{i=1}^{N} T_i (1 − exp(−σ_i δ_i)) **c**_i,   T_i = exp(−Σ_{j<i} σ_j δ_j)

where δ_i = t_{i+1} − t_i and the network predicts (σ_i, **c**_i) at sample t_i. Note the structural identity: the term w_i = T_i(1 − exp(−σ_i δ_i)) is an *alpha-compositing weight*, Σ w_i ≤ 1, so the rendered color is a convex combination of sample colors plus a background term. This identity becomes the bridge to 3D Gaussian Splatting in §4.4.

### 2.2 Spectral bias and the necessity of positional encoding

A raw-coordinate MLP is *spectrally biased* toward low-frequency functions, so feeding **x** = (x, y, z) directly yields over-smoothed scenes. NeRF's remedy is the *positional encoding*

γ(p) = (sin(2^0 πp), cos(2^0 πp), …, sin(2^{L−1} πp), cos(2^{L−1} πp)),

applied elementwise to **x** (L = 10) and **d** (L = 4)—a fixed deterministic map lifting the input into a 63-dimensional Fourier feature space so that high-frequency detail becomes learnable by gradient descent.

### 2.3 Coordinate MLPs and hierarchical sampling

The NeRF network F_Θ is an 8-layer MLP (256 units): σ is emitted view-independently from the trunk while **c** is conditioned on γ(**d**). Rendering one pixel needs 192 forward passes—~10^8 MLP evaluations per frame at 800×800. *Hierarchical volume sampling* mitigates this: coarse weights w_i^(c) form a piecewise-constant density along the ray from which fine samples are drawn—learned importance sampling, and the conceptual ancestor of proposal networks (§4.2) and Gaussian densification (§4.4).

---

## 3 Methodology

Our methodological exposition follows a single unifying pipeline: **encoding → sampling → integration → optimization**, and shows how each successor modifies exactly one stage.

1. **Encoding.** γ(**x**) (NeRF), E[γ(**x**)] under a frustum Gaussian (mip-NeRF), trilinear-interpolated hash-grid vectors (Instant-NGP), or explicit per-primitive parameters (3DGS).
2. **Sampling.** Stratified + coarse-density resampling (NeRF), cone intervals (mip-NeRF), occupancy-grid skipping (Instant-NGP), or rasterized primitives (3DGS).
3. **Integration.** The quadrature rule (NeRF family) or front-to-back alpha blending of projected Gaussians (3DGS).
4. **Optimization.** Photometric L2 loss plus regularizers (distortion, opacity penalties) via Adam; Instant-NGP adds fully fused kernels and mixed precision.

The reference implementation pattern for the core loop is:

```python
# Simplified NeRF training step (PyTorch-like pseudocode)
def render_rays(ray_o, ray_d, model, n_coarse=64, n_fine=128):
    t = stratified_samples(n_coarse)                       # [B, Nc]
    pts = ray_o[:, None] + ray_d[:, None] * t[..., None]   # [B, Nc, 3]
    sigma_c, color_c = model(encode(pts), encode_dir(ray_d))
    w = alpha_weights(sigma_c, t)                          # transmittance * alpha
    t_fine = importance_resample(t, w, n_fine)              # hierarchical
    t_all = torch.sort(torch.cat([t, t_fine], -1), -1).values
    pts = ray_o[:, None] + ray_d[:, None] * t_all[..., None]
    sigma, color = model(encode(pts), encode_dir(ray_d))
    return composite(sigma, color, t_all)                  # quadrature sum

for rays, gt in dataloader:                                # rays from SfM poses
    pred = render_rays(*rays, model)
    loss = ((pred - gt) ** 2).mean()
    loss.backward(); optimizer.step()
```

This loop—*differentiable rendering in the training inner loop*—is the methodological invariant across every method in this thesis. The innovations differ only in what `encode`, the sampler, and `composite` compute.

---

## 4 Deep Dive

### 4.1 Integrated positional encoding: mip-NeRF's anti-aliasing theory

NeRF samples each pixel with an infinitesimal ray, yet a pixel observes a *cone* whose footprint grows with depth—producing zipper and shimmer artifacts when training and test cameras differ in distance. mip-NeRF [2] replaces rays with *conical frustums*, each interval [t_0, t_1] approximated by a Gaussian N(**μ**, **Σ**) matched to the frustum in mean and covariance.

The expected encoding under this Gaussian admits a *closed form* via the Gaussian characteristic function E[exp(i **a**ᵀ**x**)] = exp(i **a**ᵀ**μ** − ½ **a**ᵀ**Σa**), giving the *integrated positional encoding* (IPE):

E_{**x**∼N(**μ**,**Σ**)}[sin(**P x**)] = sin(**P μ**) ⊙ exp(−½ diag(**P Σ P**ᵀ))

with an analogous cosine expression, where **P** stacks the frequency rows 2^k π. The exponential damping is the whole theory: high frequencies attenuate in proportion to frustum extent, so distant frustums anti-alias while near ones preserve detail. A *single* MLP replaces NeRF's coarse+fine pair, with quadrature over cone segments.

> **Theorem: (Scale-equivariance of IPE).** *Let a frustum Gaussian N(**μ**, **Σ**) be scaled by factor s > 0 about the camera center. The IPE feature's k-th frequency component is attenuated by exp(−½ (2^k π)² s² σ²_⊥), where σ²_⊥ is the transverse variance. Hence the encoding's effective bandwidth contracts geometrically with distance, matching the pixel footprint's linear growth and preventing aliasing by construction.*

Empirically: 17% lower average error on the NeRF set, 60% on the multiscale variant, 7% faster, half the model size [2].

### 4.2 Unbounded scenes: contraction, proposal networks, and distortion

In 360° unbounded captures, Euclidean sampling starves distant content while oversampling near content, producing blurry backgrounds, floaters, and "background collapse." mip-NeRF 360 [3] introduces three coordinated mechanisms:

1. **Scene contraction.** A nonlinear map sends all of ℝ³ into a radius-2 ball, linear near the origin and proportional to disparity (1/r) at infinity—normalizing scale so each unit of contracted space covers roughly equal pixel footprint.
2. **Proposal networks with online distillation.** A tiny proposal MLP (4 layers) is trained via a histogram loss to *bound* the NeRF MLP's weights, distilling the expensive visibility computation into a sampler evaluated once per ray at 1/15th the cost.
3. **Distortion regularizer.** A pairwise weight-spread penalty concentrates each ray's weight distribution into compact surfaces, suppressing floaters and background collapse.

The result: 57% lower MSE than mip-NeRF on the unbounded-360 benchmark, with detailed depth maps for intricate real-world scenes [3]. The method's conceptual legacy is the separation of *sampling* (cheap, approximate, distilled) from *shading* (expensive, exact)—a division 3DGS inherits.

### 4.3 Instant-NGP: multiresolution hash encoding and fully fused execution

Instant-NGP [4] observes that NeRF's MLP largely *memorizes* a static scene. The remedy: store features in a *multiresolution hash table* and shrink the MLP to 2–3 layers of 64 neurons.

For each of L = 16 levels with grid resolution N_l = ⌊N_min · b^l⌋, the coordinate maps to 8 surrounding voxels; where voxel count exceeds table size T = 2^19, corners are hashed by h(**x**) = (x₁π₁ ⊕ x₂π₂ ⊕ x₃π₃) mod T. Trilinear interpolation of F = 2-dimensional vectors per level, concatenated, yields a 32-dimensional encoding for the tiny MLP.

> **Theorem: (Collision disambiguation by multiresolution).** *Collisions at one level are overwhelmingly unlikely to coincide across all L ≥ 8 levels; SGD resolves the rest implicitly, since colliding entries receive gradients from multiple surface points while finer levels disambiguate. Training is therefore stable with O(1) memory per level.*

The second pillar is systems engineering: *fully fused* CUDA kernels keep the whole MLP in registers/shared memory, and occupancy grids skip empty space. Result: NeRF-quality training in *seconds* (the fox demo converges in under 5 seconds) and 1080p rendering in tens of milliseconds [4].

| Method | Encoding | Sampler | Train time (synthetic 360) | Render | Params |
|---|---|---|---|---|---|
| NeRF [1] | Fourier γ, L=10 | Coarse→fine resample | ~12–24 h | minutes/frame | ~5 MB |
| mip-NeRF [2] | IPE (Gaussian-expected γ) | Cone intervals | ~11 h | minutes/frame | ~2.5 MB |
| mip-NeRF 360 [3] | IPE + contraction | Proposal + distillation | ~8–12 h | minutes/frame | ~9 MB |
| Instant-NGP [4] | Multiresolution hash (L=16, T=2¹⁹) | Occupancy-grid march | ~5–60 s | ~10–60 ms/frame | ~12–60 MB |
| 3DGS [5] | None (explicit) | Rasterize primitives | ~30–50 min | ≥30 FPS @1080p | ~50–500 MB |

### 4.4 3D Gaussian Splatting: explicit primitives and differentiable rasterization

3D Gaussian Splatting [5] inverts NeRF's implicitness. The scene is an explicit set of anisotropic 3D Gaussians, each with mean **μ** ∈ ℝ³, covariance **Σ** = **RSS**ᵀ**R**ᵀ (rotation quaternion **q**, scale **s**), opacity α, and view-dependent color via spherical harmonics (degree 3, 48 coefficients). Rendering projects each Gaussian to screen space—**Σ′** = **JWΣW**ᵀ**J**ᵀ with viewing transform **W** and projective Jacobian **J**—and composites front-to-back in 16×16 tiles:

C = Σ_i **c**_i α_i′ Π_{j<i} (1 − α_j′),

where α_i′ = α_i · G_2D(**p**; **μ**_i′, **Σ**_i′). Compare with §2.1: with the identifications w_i ↔ α_i′Π(1−α_j′) and σ_iδ_i ↔ −ln(1−α_i′), this is *exactly* the NeRF quadrature rule with the ray integral replaced by sorted primitive overlap. The two formulations are one equation wearing different clothes—a fact that explains why 3DGS inherits NeRF's optimization stability while escaping its sampling cost.

Optimization interleaves gradient descent with *adaptive density control*: high-gradient Gaussians are cloned (small) or split (large), transparent or oversized ones pruned, with periodic opacity resets. Initialized from SfM points with no network at all, 3DGS renders pure rasterization at ≥30 FPS, 1080p, matching mip-NeRF 360 quality after ~51 minutes [5].

---

## 5 Empirical Results and Proofs

### 5.1 Benchmark results

The synthetic 360 benchmark (8 scenes, 100 training / 200 test views, 800×800) and the unbounded-360 dataset (9 real scenes, 360° captures) are the field's two canonical yardsticks [1][3].

| Method | Synthetic 360 PSNR ↑ | SSIM ↑ | LPIPS ↓ | Unbounded-360 PSNR ↑ |
|---|---|---|---|---|
| NeRF [1] | 31.01 | 0.947 | 0.081 | 21.46 |
| mip-NeRF [2] | 33.09 | 0.961 | 0.043 | 22.22 |
| Instant-NGP [4] | 32.74 | 0.958 | 0.047 | 22.79* |
| mip-NeRF 360 [3] | — | — | — | 24.40 |
| 3DGS [5] | 33.88 | 0.969 | 0.030 | 24.50† |

*Instant-NGP unbounded figure from the Zip-NeRF comparison table; †3DGS trained 51 min vs. 7 min for quality parity with Instant-NGP [5][7]. mip-NeRF's 60% error reduction on the multiscale synthetic variant and 22× speedup over brute-force supersampling are the decisive anti-aliasing evidence [2].

### 5.2 Proof sketch: quadrature consistency

Fix a ray with Lipschitz σ, **c** and partition into intervals of max width δ. Since 1 − exp(−σ_iδ_i) = σ_iδ_i + O(δ²) and T_i → T(t_i) with O(δ) error, the quadrature sum converges to ∫ T(t)σ(t)**c**(t) dt. The O(δ) rate explains hierarchical sampling's value: concentrating intervals where σ is large shrinks the *effective* δ where the integrand varies—the same variance reduction behind coarse-to-fine resampling, proposal distillation, and occupancy skipping.

### 5.3 Ablation evidence for the encoding claims

Ablations isolate each claim: mip-NeRF needs *both* frustum geometry and the expected encoding (either alone restores aliasing) [2]; Instant-NGP quality saturates at T = 2^19 with graceful degradation below, confirming multiresolution—not capacity—resolves collisions [4]; and 3DGS without densification loses >3 dB, proving its success is an *optimization* achievement, not merely a rendering one [5].

---

## 6 Limitations and Open Problems

Despite the trajectory from hours to seconds to real-time, fundamental limitations persist:

1. **Few-view and single-view ambiguity.** All methods above are *per-scene optimizations* requiring dozens of views. The reconstruction problem is ill-posed with sparse input; current remedies (diffusion priors, e.g. DreamFusion-style score distillation) trade geometric fidelity for hallucinated plausibility and remain an active frontier.
2. **Dynamic scenes.** Time-varying radiance fields (deforming Gaussians, spatiotemporal plane factorizations) extend the framework to 4D, but topology changes, fast motion, and long sequences still defeat compact representations; dynamic splatting variants report high frame rates only on short, well-constrained clips.
3. **Material and illumination decomposition.** NeRF bakes lighting into emitted radiance; relighting requires inverse-rendering extensions (NeRFactor, Ref-NeRF) that decompose albedo, roughness, and environment illumination—an underconstrained factorization with limited generalization.
4. **3DGS optimization fragility.** The explicit representation's quality hinges on heuristics: densification thresholds, opacity resets, SfM initialization. Textureless regions produce erroneous Gaussians that overfit training views and collapse on novel views; memory grows unboundedly with scene complexity (hundreds of MB to GBs), and there is no learned prior to complete unseen regions.
5. **Anti-aliasing and theory.** 3DGS reintroduces aliasing via screen-space dilation heuristics with no scale-aware encoding, and no method offers *a priori* error bounds relating view count to reconstruction error—hash-grid SGD convergence under collisions remains empirical rather than proven.

---

## 7 Conclusion

NeRF's contract was deceptively simple: a continuous volumetric function plus differentiable rendering equals photorealistic view synthesis from photographs alone [1]. The years since attacked its hidden costs: mip-NeRF [2] cured aliasing in closed form via integrated positional encoding; mip-NeRF 360 [3] tamed unbounded scenes with contraction, distilled proposal sampling, and distortion regularization; Instant-NGP [4] moved memorization into hash tables, collapsing training to seconds; and 3D Gaussian Splatting [5] deleted the network entirely for real-time rasterization at state-of-the-art quality.

The unifying lesson is representational: every advance reallocated capacity from computation to memory, from implicit weights to explicit structure, from marching rays to splatting primitives. The quadrature weights of §2.1 never changed—only what generates them did. The next discontinuity will be richer objectives: generative priors for few-view reconstruction, factorized representations for relighting and dynamics, and theory that predicts reconstruction quality rather than merely measuring it.

---

## References

[1] B. Mildenhall, P. P. Srinivasan, M. Tancik, J. T. Barron, R. Ramamoorthi, and R. Ng, "NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis," in *ECCV*, 2020. arXiv:2003.08934. https://arxiv.org/abs/2003.08934v1

[2] J. T. Barron, B. Mildenhall, M. Tancik, P. Hedman, R. Martin-Brualla, and P. P. Srinivasan, "Mip-NeRF: A Multiscale Representation for Anti-Aliasing Neural Radiance Fields," in *ICCV*, 2021. arXiv:2103.13415. https://arxiv.org/abs/2103.13415 — Proceedings version: https://openaccess.thecvf.com/content/ICCV2021/html/Barron_Mip-NeRF_A_Multiscale_Representation_for_Anti-Aliasing_Neural_Radiance_Fields_ICCV_2021_paper.html

[3] J. T. Barron, B. Mildenhall, D. Verbin, P. P. Srinivasan, and P. Hedman, "Mip-NeRF 360: Unbounded Anti-Aliased Neural Radiance Fields," in *CVPR*, 2022. arXiv:2111.12077. https://arxiv.org/abs/2111.12077v1

[4] T. Müller, A. Evans, C. Schied, and A. Keller, "Instant Neural Graphics Primitives with a Multiresolution Hash Encoding," *ACM Trans. Graph.* 41(4), 2022. arXiv:2201.05989. https://arxiv.org/abs/2201.05989?context=cs

[5] B. Kerbl, G. Kopanas, T. Leimkühler, and G. Drettakis, "3D Gaussian Splatting for Real-Time Radiance Field Rendering," *ACM Trans. Graph.* 42(4), 2023. arXiv:2308.04079. https://arxiv.org/abs/2308.04079?context=cs

[6] K. Gao, Y. Gao, H. He, D. Lu, L. Xu, and J. Li, "NeRF: Neural Radiance Field in 3D Vision, A Comprehensive Review," arXiv:2210.00379, 2022. http://arxiv.org/abs/2210.00379v1 — (comprehensive survey of 250+ NeRF papers, architecture and application taxonomies, and benchmark comparisons of key models)

[7] J. T. Barron et al., "Zip-NeRF: Anti-Aliased Grid-Based Neural Radiance Fields," *ICCV*, 2023, supplemental material. http://openaccess.thecvf.com/content/ICCV2023/supplemental/Barron_Zip-NeRF_Anti-Aliased_Grid-Based_ICCV_2023_supplemental.pdf
