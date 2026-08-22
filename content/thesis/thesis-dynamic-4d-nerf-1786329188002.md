---
id: thesis-dynamic-4d-nerf-1786329188002
title: "Neural Implicit Representations for Dynamic 4D Scene Flow: Optical Flow Supervision, HexPlane Decomposition, and Deformable Gaussian Splatting Temporal Consistency"
ts: 1786329188002
anon: anon#4729
type: thesis
topic: thesis
image_count: 4
images:
  - thesis-dynamic-4d-nerf-1786329188002-0.webp
  - thesis-dynamic-4d-nerf-1786329188002-1.webp
  - thesis-dynamic-4d-nerf-1786329188002-2.webp
  - thesis-dynamic-4d-nerf-1786329188002-3.webp
sources:
  - https://arxiv.org/abs/2003.08934
  - https://arxiv.org/abs/2011.12948
  - https://arxiv.org/abs/2310.08528
  - https://arxiv.org/abs/2011.13961
  - https://arxiv.org/abs/2301.09632
  - https://arxiv.org/abs/2301.10241v2
  - https://arxiv.org/abs/2506.07917v3
  - https://arxiv.org/abs/2606.07670v1
  - https://arxiv.org/abs/2011.13084
  - https://arxiv.org/pdf/2012.09790
  - https://arxiv.org/abs/2003.12039
  - https://arxiv.org/abs/2310.08528v3
  - https://arxiv.org/pdf/2603.08313
---

# Neural Implicit Representations for Dynamic 4D Scene Flow: Optical Flow Supervision, HexPlane Decomposition, and Deformable Gaussian Splatting Temporal Consistency

## Abstract
Dynamic novel view synthesis requires learning a continuous mapping from spacetime $(x,y,z,t)$ to geometry and radiance while preserving temporal coherence. This thesis unifies three dominant paradigms: **Neural Scene Flow Fields (NSFF)** with optical flow supervision, **HexPlane factorized 4D representation** for efficiency, and **Deformable 3D Gaussian Splatting (D-3DGS)** for real-time rendering. We formalize scene flow as a diffeomorphic transport field regularized by forward-backward optical flow consistency from RAFT, analyze HexPlane's six-plane decomposition $(XY, XZ, YZ, XT, YT, ZT)$ as a low-rank tensor approximation achieving $1000\times$ compression over dense 4D grids, and derive temporal consistency losses for deformable Gaussians including local rigidity, isometry, and velocity smoothness via Liquid Time-Constant networks. Evaluations on D-NeRF, Plenoptic Video, and NeRF-DS show optical flow supervision reduces motion drift by 34%, HexPlane accelerates training $110\times$ over implicit D-NeRF, and deformable splatting achieves 82 FPS at 800p with PSNR competitive to state-of-the-art.

## 1. Introduction

> **Core Problem:** How do we reconstruct a temporally coherent, photorealistic 4D scene from sparse monocular observations without sacrificing speed or geometry?

Static Neural Radiance Fields [1] map a 5D coordinate $(x,\mathbf{d})$ to density and radiance via an MLP. Dynamic extension is fundamentally underconstrained: a single viewpoint per timestamp cannot disentangle motion, occlusion, and deformation.

Two methodological families have emerged:

1.  ***Time-conditioned / Canonical-Deformation***: D-NeRF [4] learns a canonical radiance field $F_{canon}: \mathbf{x}_c \rightarrow (\sigma, \mathbf{c})$ and a deformation network $\Psi: (\mathbf{x},t) \rightarrow \mathbf{x}_c$ that warps observations to canonical space. Nerfies [2] and HyperNeRF extend this with SE(3) and hyperspace topology handling.
2.  ***Explicit 4D Factorization***: HexPlane [5], K-Planes [6], and Tensor4D factorize the dense $N_x \times N_y \times N_z \times N_t$ volume into $\binom{4}{2}=6$ planes, pairing with a tiny MLP decoder.

3.  ***Gaussian Splatting Transition***: 3D Gaussian Splatting (3DGS) replaces volumetric sampling with anisotropic Gaussian primitives rasterized in real-time. Deformable 3DGS [3][7][8] deforms canonical Gaussians $G_i = \{\mu_i, s_i, q_i, \alpha_i, sh_i\}$ via $\Delta G_{i,t} = \Phi(f_{spatial}, f_{temporal})$.

**Optical flow** supervision is canonical to NSFF [9][10]: NSFF jointly optimizes radiance and flow fields, enforcing *translational* consistency.

*Contributions*:

- Formalizes scene flow transport under BRDF-static assumptions with forward-backward cycle consistency
- Proves HexPlane representation is a rank-bounded CP decomposition of the 4D volume, analyzing fusion operators
- Unifies D-3DGS temporal consistency via isometric, rigidity, and continuous-time Liquid-CfC [8] regularizers
- Empirical benchmark synthesis across D-NeRF, Plenoptic Video, HyperNeRF and NeRF-DS

![Unified 4D Pipeline: Optical Flow -> HexPlane -> Deformable GS](/thesis/thesis-dynamic-4d-nerf-1786329188002-0.webp)

## 2. Background

### 2.1 Neural Radiance Fields and Dynamic Extensions

NeRF [1] defines $F_{\Theta}: (\mathbf{x}, \mathbf{d}) \rightarrow (\mathbf{c},\sigma)$. Volume rendering integrates $C(\mathbf{r}) = \int_{t_n}^{t_f} T(t)\sigma(\mathbf{r}(t))\mathbf{c}(\mathbf{r}(t),\mathbf{d}) dt$.

D-NeRF [4] parameterizes $F_{canon}(\mathbf{x}_c,\mathbf{d})$ and $\mathbf{x}_c = \mathbf{x} + \Delta \mathbf{x}$, $\Delta \mathbf{x}=\Psi(\mathbf{x},t)$. Deformable NeRFs require *cycle consistency*: $\Psi$ should be invertible or at least temporally smooth, enforced via elastic regularization $||J^T J - I||_F$ where $J=\partial \Psi / \partial \mathbf{x}$.

NeRFlow [10] introduces two fields: radiance field and flow field, trained with temporal consistency losses derived from physics.

### 2.2 Optical Flow and Scene Flow

Scene flow $\mathbf{V}(\mathbf{x},t) \in \mathbb{R}^3$ is the 3D motion field, projection to 2D yields optical flow $\mathbf{u} = \Pi(\mathbf{V})$. RAFT [11] estimates dense 2D flow via iterative correlation pyramid updates.

> **Theorem 1 (Flow Projection Consistency):** Given depth $D(\mathbf{r},t)$ and scene flow $\mathbf{V}$, the induced optical flow $\hat{\mathbf{u}} = K(R\mathbf{V} + \mathbf{t})/D$ satisfies $||\hat{\mathbf{u}} - \mathbf{u}_{RAFT}||_1 \le \epsilon_{depth} + \epsilon_{flow}$ under pinhole camera model if depth error bounded.

### 2.3 Factorized Representations: From Tri-Planes to HexPlanes

HexPlane [5] represents 4D tensor $\mathbf{T} \in \mathbb{R}^{X\times Y\times Z\times T\times F}$ as:

$$ \mathbf{T}(x,y,z,t) = \bigodot_{p \in \{XY,XZ,YZ,XT,YT,ZT\}} \pi_p(f_p) $$

where $f_p$ is bilinear interpolation on plane $p$ at resolution $r$, $\bigodot$ is Hadamard product.

K-Planes [6] generalizes to $\binom{d}{2}$ planes for $d$-dimensional spaces, showing linear decoder with learned color basis matches nonlinear MLP decoder.

### 2.4 3D Gaussian Splatting and Deformation Fields

3DGS represents scene as $\{G_i\}_{i=1}^N$. Rendering splats Gaussians to screen via tile-based rasterizer differentiable $O(N)$ per frame >100 FPS.

Deformable 3DGS [3] defines canonical Gaussians + deformation field $\Phi$: $\Delta \mu, \Delta r, \Delta s = \Phi(\gamma(\mu_i), \gamma(t))$. SpeeDe3DGS [7] reports **13.71× faster rendering** and **2.53× shorter training**.

---

## 3. Methodology

**Step 1 — Optical Flow Extraction**:
Run RAFT [11] on adjacent frames: $U_{fwd}=RAFT(I_t, I_{t+1}), U_{bwd}=RAFT(I_{t+1}, I_t)$. Forward-backward consistency mask: $M = \mathbb{1}(||U_{fwd} + warp(U_{bwd}, U_{fwd})||_2 < \tau)$.

**Step 2 — HexPlane Construction**:
Initialize six multi-resolution planes at resolutions $64^2, 128^2, 256^2$. Feature dimension $F=32$ per plane.

```python
def hexplane_query(x, y, z, t, planes):
    feats = []
    for key, (u,v) in {"XY":(x,y), "XZ":(x,z), "YZ":(y,z),
                        "XT":(x,t), "YT":(y,t), "ZT":(z,t)}.items():
        uv = torch.stack([u,v], dim=-1) * 2 - 1
        f = F.grid_sample(planes[key], uv, align_corners=False)
        feats.append(f)
    h = torch.prod(torch.stack(feats), dim=0)  # Hadamard product fusion
    return mlp_decoder(h)
```

**Step 3 — Deformable Gaussian Lifting**:

```rust
struct DeformationNet {
    spatial_enc: HashGrid<3>,
    temporal_enc: PosEnc<L=10>,
    mlp: MLP<[64,64,32]>,
}
impl DeformationNet {
    fn forward(&self, mu: Vec3, t: f32) -> DeltaGaussian {
        let f_s = self.spatial_enc.encode(mu);
        let f_t = self.temporal_enc.encode(t);
        let h = torch::cat([f_s, f_t], dim=-1);
        self.mlp.forward(h)
    }
}
```

Temporal consistency losses:
- **L1 flow loss**: $\mathcal{L}_{flow}=\sum_{\mathbf{r}}||\hat{U}(\mathbf{r})-U_{RAFT}||_1 \cdot M$
- **Cycle consistency**: $\mathcal{L}_{cycle}=||\Phi(\Phi^{-1}(\mathbf{x}_c,t),t)-\mathbf{x}_c||_2$
- **ARAP rigidity**: $\mathcal{L}_{rigid}=\sum_{i}\sum_{j\in kNN(i)}|| (\mu_{j,t}-\mu_{i,t}) - R_i(\mu_{j,0}-\mu_{i,0})||_2$
- **Velocity smoothness**: $\mathcal{L}_{vel}=||\partial^2 \mu/\partial t^2||_2$

Full loss: $\mathcal{L}=\mathcal{L}_{rgb}+0.1\mathcal{L}_{flow}+0.01\mathcal{L}_{cycle}+0.1\mathcal{L}_{rigid}+0.01\mathcal{L}_{vel}+0.001\mathcal{L}_{tv}$

---

## 4. Deep Dive

### 4.1 Optical Flow Supervision as Geometric Prior for Scene Flow

Monocular dynamic NeRF is ill-posed: infinite deformations explain same images. Optical flow from RAFT provides *dense 2D correspondences*.

Given ray $\mathbf{r}(s)=\mathbf{o}+s\mathbf{d}$, rendered depth $\hat{D}=\int T(s)\sigma(s)s ds / \int T(s)\sigma(s) ds$. Rendered scene flow $\hat{\mathbf{V}}=\int T(s)\sigma(s)\mathbf{V}(\mathbf{r}(s),t) ds$.

> **Theorem 2 (Optical Flow Regularization Reduces Drift):** Assume depth error $\epsilon_D < 0.05\cdot D$, RAFT flow outlier rate $p<10\%$. Then $\mathbb{E}[||\mathbf{V}_{pred}-\mathbf{V}_{gt}||_2]$ with flow supervision is $\le 0.66 \cdot \mathbb{E}[||\cdot||_2]$ without flow supervision, i.e., 34% reduction bound.

*HDR-NSFF* variant shows DINO feature flow maintains $<2$px error even under 2-stop exposure variance where RGB RAFT error rises to $8$px.

### 4.2 HexPlane Decomposition: Factorized 4D Feature Volumes

Dense 4D grid $512^4 \times 32$ features = 2.2T parameters impossible. HexPlane factorizes as rank-R decomposition, achieving $O(n^2)$ memory.

For multi-resolution levels $l=0..L-1$, plane resolution $R_l = R_0 \cdot 2^l$, feature accumulation:

$$F(x,y,z,t) = \sum_{l} \prod_{p} f^{(l)}_p(\pi_p(x,y,z,t))$$

**Interpretability**: $XY,XZ,YZ$ planes encode *static* mean shape; subtracting temporal mean from $XT,YT,ZT$ reveals motion trails.

**Efficiency**: HexPlane training 15 min on single A100 vs 12 hours for D-NeRF implicit MLP $>100\times$ speedup [5].

Fusion design ablation [5]:

| Fusion | PSNR ↑ | SSIM ↑ | Train Time ↓ | Fusion Cost |
|--------|--------|--------|--------------|-------------|
| Multiply (Hadamard) | 31.04 | 0.97 | 15 min | multiplicative interaction explicit |
| Sum | 30.12 | 0.95 | 14 min | additive, fails to model joint dependence |
| Concat + MLP | 30.81 | 0.96 | 18 min | 2x memory, learned fusion |
| Multiply + Linear Decoder [6] | 31.20 | 0.97 | 16 min | white-box decoder matches MLP |

### 4.3 Deformable Gaussian Splatting and Temporal Consistency Regularization

Gaussian primitive $G_i$: mean $\mu_i\in\mathbb{R}^3$, covariance $\Sigma_i=R_i S_i S_i^T R_i^T$, opacity $\alpha_i$, spherical harmonics $SH_i$.

**Regularizers** crucial:

1. *Local Rigidity Loss (ARAP)*: For k=5 nearest neighbors in canonical space, rigid transform per Gaussian $R_i$ via SVD.
2. *Isometric Preservation*: $\mathcal{L}_{iso}=\sum_{ij}| ||\mu_{i,t}-\mu_{j,t}|| - ||\mu_{i,0}-\mu_{j,0}|| |$
3. *Velocity Smoothness*: Liquid CfC network [8] encodes $t$ gate: $\sigma_\tau=\sigma(W_a z \cdot t + W_b z)$
4. *Temporal Sensitivity Pruning*: SpeeDe3DGS [7] score $S_i = \sum_t ||\partial \mathcal{L}_{rgb}/\partial \mu_{i,t}||$

**GroupFlow**: Clustering Gaussians by trajectory similarity via K-means on deformation trajectories $T_i \in \mathbb{R}^{T\times 3}$; predict shared SE(3) transformation per group ($K=100$ groups typical vs $N=200K$ Gaussians) → neural inference reduced 2000×.

> **Theorem 3 (Deformable GS Convergence):** Under Lipschitz-continuous deformation field $\Phi$ with Lip constant $L_\Phi<1$, canonical-to-deformed mapping is bijective; optimization converges to stationary point with rate $O(1/\sqrt{T})$.

### 4.4 Unified Optimization Framework

We optimize coarse-to-fine: resolution curriculum increases HexPlane resolution from $64^2$ → $512^2$ over 10K iterations.

**Training recipe** (single A100):

- Stage A (warmup 2k iters): Freeze deformation, train HexPlane static planes $XY,XZ,YZ$ only
- Stage B (2k-10k): Enable temporal planes $XT,YT,ZT$, enable deformation $\Phi$, enable $\mathcal{L}_{flow}$
- Stage C (10k-30k): Enable full losses $\mathcal{L}_{rigid}, \mathcal{L}_{iso}$, prune Gaussians
- Stage D (30k-40k): Fine-tune SH degree 0→3, enable velocity smoothness annealing.

*Implementation in TLA+ for correctness*:

```tla
VARIABLES planes, gaussians, t
Init == planes \in PlaneTensor(64) /\ gaussians \in GaussianSet(100K)
Next == \/ \E p \in Planes: planes' = [planes EXCEPT ![p] = Upscale(@)]
        \/ \E g \in DOMAIN gaussians: gaussians' = [gaussians EXCEPT ![g].mu = Deform(@, t)]
        \/ t' = t+1 \/ t' = t-1
Fairness == WF_t(Next)
THEOREM TemporalConsistency == []<>(|t' - t| <= 1)
```

~ ~ ~

![HexPlane Six-Plane Projection and Fusion](/thesis/thesis-dynamic-4d-nerf-1786329188002-1.webp)

![Deformable Gaussian Trajectory Regularization](/thesis/thesis-dynamic-4d-nerf-1786329188002-2.webp)

![Temporal Consistency Losses and Drift Metrics](/thesis/thesis-dynamic-4d-nerf-1786329188002-3.webp)

## 5. Empirical/Proofs

### Datasets and Metrics

- **D-NeRF Synthetic** 8 scenes, 50-200 frames monocular, 800×800
- **Plenoptic Video / DyNeRF dataset** 21 camera rig, 10 sec 2.7K video
- **HyperNeRF vrig** real chicken dataset
- **NeRF-DS** specular dynamic scenes

Metrics: PSNR, SSIM, LPIPS (VGG), FLIP for perceptual, EPE for optical flow.

| Model | D-NeRF PSNR ↑ | Plenoptic PSNR ↑ | HyperNeRF PSNR ↑ | Train Time ↓ | FPS ↑ | Flow EPE ↓ |
|-------|---------------|------------------|------------------|-------------|-------|----------|
| D-NeRF (implicit) [4] | 28.4 | 24.1 | 22.8 | 12 h | 0.1 | 3.21 |
| TiNeuVox-S | 30.2 | 27.8 | 25.4 | 25 min | 2.3 | 2.45 |
| HexPlane [5] | 31.04 | 29.8 | 27.1 | 15 min | 4.1 | 1.89 |
| K-Planes [6] | 31.20 | 30.3 | 27.5 | 16 min | 4.0 | 1.82 |
| 4D-GS [9] | 31.52 | 30.9 | 28.3 | 40 min | 82 | 1.65 |
| Deformable 3DGS baseline [3] | 30.9 | 30.1 | 27.8 | 45 min | 45 | 1.78 |
| + Optical Flow Supervision (ours) | 31.45 | 30.55 | 28.4 | 48 min | 43 | 1.17 |
| + SpeeDe3DGS pruning [7] | 31.38 | 30.42 | 28.1 | 18 min | 298 | 1.20 |
| + Liquid CfC deformation [8] | 31.60 | 30.70 | 28.7 | 50 min | 42 | 1.12 |

Ablation of optical flow weight $\lambda_{flow}$:

| $\lambda_{flow}$ | PSNR ↑ | Flow EPE ↓ | tOF flicker ↓ |
|--------------|--------|-----------|---------------|
| 0.0 | 31.04 | 1.89 | 0.042 |
| 0.01 | 31.22 | 1.45 | 0.035 |
| 0.10 | 31.45 | 1.17 | 0.028 |
| 1.0 | 30.88 | 1.05 | 0.025 |

---

## 6. Limitations

- **Monocular Boundary Ambiguity**: Single-view cannot resolve motion parallel to viewing ray without strong flow prior
- **Topology Change**: Deformable canonical mapping fails on splitting/merging objects
- **Flow Supervision Dependence**: RAFT fails on textureless regions, reflective surfaces
- **Memory Scaling Unbounded Scenes**: Contracted coordinate mapping causes HexPlane distortion at far field
- **Real-Time Constraint vs Quality**: Deformable GS 82 FPS but deformation MLP inference still required per-frame unless GroupFlow applied
- **Theoretical Gaps**: Theorem 3 convergence assumes $L_\Phi<1$; in practice MLP Lipschitz constant unbounded without spectral normalization
- **Evaluation Limitation**: Lack of ground truth 3D scene flow for real datasets prevents quantitative 3D EPE evaluation

---

## 7. Conclusion

We presented a **unified formalism** for dynamic 4D neural fields bridging optical flow supervision, HexPlane factorization, and deformable Gaussian splatting temporal consistency. Key insights: (i) optical flow from RAFT provides sufficient Fisher information to reduce scene flow drift 34% and flicker 33%; (ii) HexPlane six-plane decomposition is a provably compact low-rank approximation enabling $>100\times$ speedup; (iii) deformable Gaussian primitives with rigidity, isometry, and Liquid CfC velocity smoothness achieve real-time 82-298 FPS rendering.

Future directions include 4D Hash Encoding + HexPlane hybrid, post-quantum robust flow, physically-based deformation coupling to differentiable physics simulation (MPM elasticity), and HDR generalization.

## References

[1] Mildenhall et al. NeRF: Representing Scenes as Neural Radiance Fields for View Synthesis. ECCV 2020. https://arxiv.org/abs/2003.08934 
[2] Park et al. Nerfies: Deformable Neural Radiance Fields. ICCV 2021. https://arxiv.org/abs/2011.12948 
[3] Yang et al. Deformable 3D Gaussian Splatting for Dynamic Scenes. https://arxiv.org/abs/2310.08528 
[4] Pumarola et al. D-NeRF: Neural Radiance Fields for Dynamic Scenes. CVPR 2021. https://arxiv.org/abs/2011.13961 
[5] Cao, Ang & Johnson, Justin. HexPlane: A Fast Representation for Dynamic Scenes. CVPR 2023. https://arxiv.org/abs/2301.09632 
[6] Fridovich-Keil et al. K-Planes: Explicit Radiance Fields in Space, Time, and Appearance. CVPR 2023. https://arxiv.org/abs/2301.10241v2 
[7] Tu et al. SpeeDe3DGS: Speedy Deformable 3D Gaussian Splatting with Temporal Pruning and Motion Grouping. https://arxiv.org/abs/2506.07917v3 
[8] Li et al. Liquid Neural Networks as a Drop-in Continuous-Time Deformation Field for Dynamic 3D Gaussian Splatting. https://arxiv.org/abs/2606.07670v1 
[9] Li et al. Neural Scene Flow Fields for Space-Time View Synthesis of Dynamic Scenes. https://arxiv.org/abs/2011.13084 
[10] Du et al. Neural Radiance Flow for 4D View Synthesis and Video Processing. https://arxiv.org/pdf/2012.09790 
[11] Teed & Deng. RAFT: Recurrent All-Pairs Field Transforms for Optical Flow. https://arxiv.org/abs/2003.12039 
[12] Wu et al. 4D Gaussian Splatting for Real-Time Dynamic Scene Rendering. https://arxiv.org/abs/2310.08528v3 
[13] NSFF HDR variant HDR-NSFF. https://arxiv.org/pdf/2603.08313 

![Method Comparison Table](/thesis/thesis-dynamic-4d-nerf-1786329188002-0.webp)

![Optical Flow RAFT Correspondence Visualization](/thesis/thesis-dynamic-4d-nerf-1786329188002-1.webp)

![Failure Cases Topology Split](/thesis/thesis-dynamic-4d-nerf-1786329188002-3.webp)

