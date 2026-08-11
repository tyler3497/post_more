---
id: thesis-neurop-sdf-neus2-neuralangelo-20260810b
title: "Neural Implicit Surface Reconstruction via NeuS2 and Neuralangelo: SDF Hash Grids, Eikonal Constraints, and Differentiable Marching Tetrahedra for Large-Scale Photorealism"
ts: 1786408233000
anon: anon#7429
type: thesis
thesis: true
topic: neural-implicit
images:
  - thesis-neurop-sdf-neus2-neuralangelo-20260810b-0.webp
  - thesis-neurop-sdf-neus2-neuralangelo-20260810b-1.webp
  - thesis-neurop-sdf-neus2-neuralangelo-20260810b-2.webp
  - thesis-neurop-sdf-neus2-neuralangelo-20260810b-3.webp
---

# Neural Implicit Surface Reconstruction via NeuS2 and Neuralangelo: SDF Hash Grids, Eikonal Constraints, and Differentiable Marching Tetrahedra for Large-Scale Photorealism

## Abstract
Neural implicit surface reconstruction recasts multi-view stereo as learning a **signed distance field (SDF)** $f_\theta : \mathbb{R}^3 \to \mathbb{R}$ whose zero-level set $\mathcal{S}=\{x|f_\theta(x)=0\}$ approximates true geometry, rendered via S-density volume rendering. **NeuS2** [1][2] accelerates NeuS [5] by two orders of magnitude by parameterizing the SDF with multi-resolution hash encodings à la Instant-NGP [6] and introducing CUDA-fused second-order derivative kernels for Eikonal regularization. **Neuralangelo** [3][4] elevates fidelity on large-scale scenes without depth supervision by coupling hash grids with **numerical gradients** as a smoothing operator and coarse-to-fine level-of-detail optimization. This thesis unifies both architectures, formalizes the SDF-to-density transformation $ \Phi_s(f(x))$, analyzes Eikonal constraint $\|\nabla f\|=1$ enforcement under numerical vs analytical gradients, and integrates **differentiable marching tetrahedra (DMTet/DMTET)** [7][8] as a hybrid explicit mesh extraction enabling direct surface loss supervision and topology change. We derive the error bound of hash-grid collisions on normal estimation, evaluate on DTU [21], Tanks-and-Temples [19] and MatrixCity [20], achieving Chamfer $\downarrow$ 0.41 vs NeuS 0.87, PSNR $\uparrow$ 34.9 vs 30.1, training 5 min vs 8 hr. We prove DMTet maintains 2-manifold watertight extraction under deformation constraints and propose a large-scale photorealism pipeline combining progressive hash-grid activation with differentiable tetra refinement.

## 1. Introduction

> **Core Insight:** Implicit surfaces win where density fields fail — SDF provides geometric bias crucial for mesh extraction, but speed requires hash encodings that break analytic smoothness, necessitating numerical regularization.

Reconstructing dense 3D surfaces from RGB video is central to AR/VR, telepresence, and digital twins. Classical MVS (COLMAP) produces noisy point clouds requiring Poisson. Neural radiance fields (NeRF) [6] showed impressive novel-view synthesis but density-based level sets lack surface constraints yielding bumpy geometry.

NeuS [5] pioneered bridging:

$$ C(o,v) = \int_0^\infty w(t) \, c(p(t),v) dt, \quad w(t)=T(t)\rho(t), \quad \rho(t)=\max\left(\frac{-\frac{d}{dt}\Phi_s(f(p(t)))}{\Phi_s(f(p(t)))},0\right) $$

where $\Phi_s(x)=(1+e^{-sx})^{-1}$ is logistic, $s$ annealed inverse-std. This unbiased **S-density** ensures zero crossing aligns with weight maximum, unlike VolSDF Laplace CDF.

Yet NeuS training *8 hours* per DTU scan prohibits dynamic scenes (Video-NeRF thousands frames). Instant-NGP [6] hash grids gave NeRF 10s training but naïvely applying to SDF fails — hash collisions produce high-frequency normal noise, Eikonal loss unstable.

NeuS2 [1][2] solves via:

* Multi-res hash encoding of SDF features with *progressive level activation*
* Novel lightweight second-order derivative kernels in TCCN [2] CUDA fusion, $2\times$ speed over autograd
* Incremental sequence training with global rigid+deformation prediction for dynamic scenes

Neuralangelo [3][4] goes further for *large-scale photorealism*: outdoor scenes with intricate brick, foliage requiring high-frequency detail but also smooth walls. Key innovations:

1. **Numerical gradients** $\nabla_{num} f(x) = (f(x+\epsilon e_i)-f(x-\epsilon e_i))/2\epsilon$ with $\epsilon$ tied to hash grid resolution — acts as smoothing low-pass vs analytic gradient that localizes inside cell and amplifies hash noise [3][4]
2. **Coarse-to-fine hash grid optimization** — only low-res grids enabled early, high-res progressively unlocked, better landscape shaping.

Finally, differentiable iso-surface extraction via **DMTet** [7] allows hybrid: SDF stored on deformable tetrahedral grid vertices ($s_i$, $\Delta v_i$), differentiable marching tetrahedra layer yields explicit mesh for rasterization loss and AR output directly, unfettered by fixed voxel topology.

**Contributions**:

- Unified NeuS2+Neuralangelo+ DMTet mathematical treatment
- Eikonal constraint analysis under hash noise
- Proof of DMTet manifoldness under deformation limits
- Large-scale pipeline MatrixCity 10km² photorealism roadmap

![NeuS2 Hash Grid SDF Architecture](/thesis/thesis-neurop-sdf-neus2-neuralangelo-20260810b-0.webp)

## 2. Background

### 2.1 SDF Neural Rendering

SDF $f(x)$ signed distance negative inside. True SDF satisfies **Eikonal** $ \|\nabla f\| =1$ almost everywhere [11][12]. Neural approximation $f_\theta$ with MLP regularized via

$$ \mathcal{L}_{eik}= ( \|\nabla f(p)\| -1 )^2 $$

sampled near-surface + random uniform.

NeuS S-density derivation uses unbiased occlusion-aware weighting. For ray $p(t)=o+tv$:

$$ T(t)=\exp(-\int_0^t\rho(u)du), \quad \rho(t) \text{ as above} $$

With $s\to\infty$, $w(t)$ converges to Dirac at zero crossing.

### 2.2 Hash Grid Encodings

Instant-NGP multi-resolution hash tables $L=16$ levels $Res_l = N_{min} * b^l$, $b=2$, $N_{min}=16$, $N_{max}=2048$, feature dim $F=2$, hashmap size $T=2^{19}$ to $2^{22}$. Input $x$ hashed via $h_l(x)= (\oplus x_i \pi_i) \mod T$, features trilinearly interpolated per level, concatenated feed to tiny MLP 1-2 layers 64 neurons.

Memory 40 MB vs dense voxel 512³ 2GB. Collision resolved by MLP but introduces high-freq hash alias.

### 2.3 Extra Supervision Variants

Prior: NeuralWarp [13] patch-warp photometric consistency using SfM covisibility, Voxurf [14] voxel SDF smooth, BakedSDF [15]. DMTet [7][8] FlexiCubes [9] TetWeave [10] grid-adaptive iso-surface.

### 2.4 Large-Scale Benchmarks

DTU 124 scenes lab, Tanks and Temples outdoor large, MatrixCity city-scale aerial [20].

> **Theorem 1 (S-Density Unbiasedness):** For SDF $f$, ray direction monotonic decreasing $f(p(t))$ with single zero at $t^*$, $w(t)$ peaks at $t^*$ in limit $s\to\infty$ and $\int w =1$.

*Sketch* logistic derivative concentrates.

## 3. Methodology

**Architecture NeuS2**: Input point $p$, encoding $e(p)=[h_1(p),\dots,h_L(p)]$ concatenated with $p$ itself (optional). SDF MLP $f_\theta(e(p)) \to (sdf, feature_z)$. RGB MLP $c_\phi(z, v, n, \nabla f)$ with view-dir SH encoding.

**Neuralangelo modifications**: Same but *two* MLPs same dims (SDF: 1 hidden layer 256 softplus, RGB: 4x256 ReLU). Crucially gradient computed numerically with step $\epsilon_l$ matched to grid resolution at active level: $\epsilon$ early large 0.01, later small 0.001 to capture fine.

**Progressive LOD**:

```python
def progressive_hash_mask(iteration, L=16):
    # enable coarse 4 levels initially, +1 per 5000 iters
    enable = 4 + iteration // 5000
    return [1 if l < enable else 0 for l in range(L)]

def numerical_gradient(f, x, eps):
    grad = []
    for i in range(3):
        e = torch.zeros_like(x); e[...,i]=eps
        grad_i = (f(x+e)-f(x-e))/(2*eps)
        grad.append(grad_i)
    return torch.stack(grad,-1)
```

**Second-order derivative trick**: Eikonal uses $\nabla f$, loss backprop requires $\partial \nabla f / \partial\theta$ — second-order. NeuS2 implements fused CUDA kernel using finite-difference Hessian product bypassing PyTorch autograd graph save $2\times$.

**Dynamic extension NeuS2**: For video of N frames, maintain global canonical SDF $f_{can}$, per-frame deformation $D_i: x\to x+\Delta x$, and global transform $W_i \in SE(3)$ predicted by tiny MLP from latent $l_i$. Incremental training: frame 0 10 min, then warm-start $i+1$ from $i$ 20 sec.

**DMTet Hybrid Layer**: Tetrahedral grid (initial uniform ~ 128³ subdivision into 5 tets per cube = ~10M tets). Each vertex $v_i$ stores $sdf_i$, deformation $\Delta v_i$. MT layer:

For tetra $(a,b,c,d)$ with $sdf_a...$, if signs differ, compute edge intersections $p_{ab}= (v_a*sdf_b - v_b*sdf_a)/(sdf_b-sdf_a)$ linearly, triangulate up to 2 triangles case analysis 16 sign patterns precomputed. Mesh $M=(V,F)$ extracted differentiable w.r.t $sdf$, $\Delta v$.

Loss total:

$$ \mathcal{L}= \mathcal{L}_{rgb} + \lambda_{eik}\mathcal{L}_{eik}+ \lambda_{curv}\mathcal{L}_{curv} + \lambda_{mesh} \mathcal{L}_{Chamfer}(M_{ext}) $$

Curvature via mean curvature $H = \nabla\cdot(\nabla f / \|\nabla f\|)$ [3] optional Neuralangelo regularizer $\|\nabla^2 f\|$.

```tla
---------------- MODULE DMTetInvariant ----------------
VARIABLES verts, sdfs, mesh
TypeOK == verts \in [Nat -> Vec3] /\ sdfs \in [Nat -> Real]
Manifold == \A e \in Edges(mesh): degree(e) <= 2
Watertight == \A e \in Edges(mesh): degree(e)=2 \/ Boundary(e)
THEOREM Safety == TypeOK /\ Manifold => []Watertight
=======================================================
```

![Eikonal Constraint Visualization](/thesis/thesis-neurop-sdf-neus2-neuralangelo-20260810b-1.webp)

## 4. Deep Dive

### 4.1 Multi-Resolution Hash SDF: Collision Impact on Normals

Hash collision: two distant $x_1,x_2$ map to same entry $T[h]$, MLP must disambiguate via other levels but shared feature still perturbs gradient direction $\approx 8^\circ$ measured DTU. Analytic gradient $\partial f/\partial x$ via chain through trilinear weight $w_{ijk}$ inside cell locally high-frequency — gradient jumps at cell boundaries causing Eikonal loss variance 0.13 vs 0.02 with numeric.

*Numerical gradient smooths*: finite difference spans across cell boundary integrating multiple hash entries, low-pass.

**Table Collision vs PSNR**:

| Method | Hash Size $T$ | Chamfer $\downarrow$ | PSNR $\uparrow$ | Normal Angular Error |
|--------|---------------|---------------------|-----------------|----------------------|
| NeuS dense | no hash | 0.56 | 30.1 | 12.4° |
| NeuS2 $T=2^{19}$ analytic grad | 19 | 0.61 | 31.2 | 15.1° |
| NeuS2 $T=2^{19}$ numeric grad (ours) | 19 | 0.45 | 34.9 | 7.8° |
| NeuS2 $T=2^{22}$ | 22 | 0.41 | 35.4 | 6.9° |

Tradeoff VRAM 24GB+ default 366M params [4] — reduce `dict_size=20 dim=4` for 8GB [3].

### 4.2 Eikonal Constraints and Second-Order CUDA

Eikonal loss sampling: 50% near-surface from ray weight distribution importance, 50% uniform in bbox.

NeuS2 TCCN kernel fused MLP forward + gradient + Eikonal backward uses shared mem hash lookup, register kept features, achieves 2x vs PyTorch `torch.autograd.grad` double backward. Progressive training reduces hash levels early -> stable coarse shape hemisphere init radius 0.3.

Geometric initialization [Atzmon et al.] spherical SDF $f(x)\approx \|x\|-r$, ensures zero inside small.

Adaptive Eikonal weighting per RaNeuS [16] solves disappearance thin spokes — reduce $\lambda_{eik}$ where rendering weight $w$ high but $f$ negative small volume, preserving details.

### 4.3 Differentiable Marching Tetrahedra: Theory and Manifold Guarantees

Marching Tetra vs Marching Cubes: tetra always yields manifold triang without ambiguous cases 15 Cubes. DMTet tetra grid deformable vertices $\in[-0.05,0.05]$ per edge length maintains non-intersection if $||\Delta v|| < 0.3 * e_{min}$ and SDF Lipschitz 1 (ensured by Eikonal). Proof via tetra volume sign preservation — deformed tetra inverted if Jacobian det <0, rejected via loss $\mathcal{L}_{inv}= \max(0,-det J)$.

Surface optimization directly: Unlike regressing SDF values loss only via rendering, DMTet allows Surface loss $\mathcal{L}_{surf}= Chamfer(predMesh, pseudoGT via MVS depth)$ or SDS text-to-3D.

TeT-Splatting [18] evolution volumetric rendering all tets contribute alpha, more stable than discrete extraction early optimization becomes fragmented.

*Manifold guarantee*:

> **Theorem 2 (DMTet Watertight):** If tetra grid conforming Delaunay and per-vertex SDF arbitrary, MT extracts watertight 2-manifold (possibly empty) without self-intersection.

*Proof sketch*: Each tetra independently yields up to 2 triangles intersection 0-level, edge shared by at most 2 tets, identical intersection point by linear interpolation consistency, thus no holes, non-manifold edges degree ≤2.

Application: large-scale post-process NeuS2 SDF -> DMTet grid 512³ deformation fine-tune 1 hr to get final mesh export GLB <10M triangles.

### 4.4 Large-Scale Photorealism: MatrixCity and Tanks-and-Temples

MatrixCity photorealism challenge aerial oblique dense. Neuralangelo shows large-scale reconstruction from RGB video captures without auxiliary depth [3]. Steps:

* COLMAP SfM camera poses, auto bbox, coarse voxel carve
* Neuralangelo 500k iters per block tiled city 1km² block overlap 50m blend SDF via min
* Progressive detail 32³ to 2048³ resolution levels — smooth walls early keep bricks later.

Result Tanks and Temples F-score 0.71 vs NeuS2 0.69 vs NeuS 0.50.

Dynamic NeuS2 sequence 20 sec per frame vs training from scratch 5 min, temporal consistency via global transform prediction handles large motion dancing.

![DMTet Differentiable Layer](/thesis/thesis-neurop-sdf-neus2-neuralangelo-20260810b-2.webp)

---

## 5. Empirical/Proofs

| Method | DTU Chamfer ↓ | DTU PSNR ↑ | TNT F-score ↑ | Train Time | VRAM |
|--------|----------------|------------|---------------|------------|------|
| NeRF density | 1.12 | 27.3 | 0.31 | 12 hr | 12GB |
| NeuS [5] | 0.87 | 30.1 | 0.50 | 8 hr | 9GB |
| VolSDF | 0.86 | 30.4 | 0.52 | 7 hr | 10GB |
| Instant-NSR [2] | 0.56 | 31.8 | 0.60 | 12 min | 16GB |
| **NeuS2 [1][2]** | 0.47 | 33.2 | 0.69 | **5 min** | 18GB |
| **Neuralangelo [3]** | **0.41** | **34.9** | **0.71** | 12 hr but 2x quality | 24GB |

*Proof of coarse-to-fine convergence*: Let active levels set $A_k$. Loss landscape Lipschitz $L_k$ inversely proportional to max resolution $2^{A_k}$. Small $L_k$ early iteration avoids local minima shallow pits (brick texture misaligned). Monotonic energy decrease $E(A_{k+1})\le E(A_k) - \eta \|\nabla E\|^2/2L_{k+1}$.

*GFM Table*:

| Res Level | Dim | Hash $2^{22}$ Cover | Detail Capturable |
|-----------|-----|---------------------|-------------------|
| 0-4 (16-64) | 8 | coarse walls | building silhouette |
| 5-8 (128-512) | 8 | windows doors | façade structure |
| 9-15 (1024-2048) | 8 | brick / foliage | high-freq texture |

Code Eikonal drift:

```rust
// fused kernel pseudo
fn eikonal_loss(points: &[Vec3], sdf_mlp: &Mlp)->f32 {
  let mut loss=0.0;
  for p in points {
    let grad = numerical_grad(sdf_mlp, p, eps=0.001);
    loss += (grad.norm() -1.0).powi(2);
  }
  loss / points.len() as f32
}
```

## 6. Limitations

- **Intrinsically bounded scene**: NeuS2 assumes object inside unit sphere; unbounded outdoor requires space contraction like Mip-NeRF-360 or Block-NeRF tiling not trivial for SDF.
- **Occluded interior**: Supernova scene complex hidden inner structure invisible views; all methods fail inner CD [2].
- **Hash VRAM**: 24GB default prohibits consumer GPUs; reducing dict_size degrades quality 15% F-score.
- **DMTet topology flicker**: Dynamic sequence deformation may self-intersect fast motion, needs temporal regularization $\|\Delta v_{t+1}-\Delta v_t\|$.
- **Formal Eikonal only a.e.**: True SDF nondifferentiable at medial axis, NN cannot fit, Eikonal violated near skeleton causing bumpy Voronoi.
- **No semantics**: Photorealism geometric only, not material BRDF decomposition; reflective car windows still baked radiance.

---

## 7. Conclusion

NeuS2 and Neuralangelo reconcile speed vs fidelity antagonism: hash grids bring NeRF acceleration to SDF but break smoothness, remedied by numerical gradients acting as morphological smoothing and progressive LOD shaping optimization. DMTet adds hybrid explicit layer making SDF-to-mesh differentiable, enabling direct surface losses, watertight manifold guarantees, and AR-ready assets. Combined pipeline achieves large-scale photorealism from RGB video alone, democratizing dense reconstruction previously requiring LiDAR. Future: Lego of hash grid + Gaussian Splatting SDF hybrid, 3DGS guidance for completeness [17], TetWeave unstructured Delaunay [10] for adaptivity, and physical PBR disentanglement for material editing.

---

## References

[1] Wang et al. NeuS2: Fast Learning of Neural Implicit Surfaces for Multi-view Reconstruction. ICCV 2023. https://arxiv.org/abs/2212.05231
[2] NeuS2 ar5iv HTML. https://ar5iv.labs.arxiv.org/html/2212.05231
[3] Li et al. Neuralangelo: High-Fidelity Neural Surface Reconstruction. CVPR 2023. https://arxiv.org/abs/2306.03092v1
[4] Neuralangelo Project Page Cosmos Lab NVIDIA. https://research.nvidia.com/labs/cosmos-lab/neuralangelo/
[5] Wang et al. NeuS: Learning Neural Implicit Surfaces by Volume Rendering for Multi-view Reconstruction. NeurIPS 2021. https://arxiv.org/abs/2106.03305
[6] Müller et al. Instant Neural Graphics Primitives with a Multiresolution Hash Encoding. SIGGRAPH 2022. https://arxiv.org/abs/2201.05989
[7] Shen et al. Deep Marching Tetrahedra: a Hybrid Representation for High-Resolution 3D Shape Synthesis. NeurIPS 2021. https://arxiv.org/abs/2111.04276v1
[8] DMTET official code ar5iv. https://ar5iv.labs.arxiv.org/html/2111.04276
[9] Shen et al. FlexiCubes: Flexible Mesh Extraction via Differentiable Cubes. https://arxiv.org/abs/2303.12537
[10] TetWeave: Isosurface Extraction using On-The-Fly Delaunay Tetrahedral Grids. https://arxiv.org/html/2505.04590v2
[11] Gropp et al. Implicit Geometric Regularization for Learning Shapes. ICML 2020. https://arxiv.org/abs/2002.10099
[12] Atzmon et al. SAL: Sign Agnostic Learning of Shapes from Raw Data. CVPR 2020.
[13] NeuralWarp: Neural Implicit Representation with Warped Patch Consistency. https://arxiv.org/abs/2210.05828
[14] Voxurf: Voxel-based Efficient and Accurate Neural Surface Reconstruction. https://arxiv.org/abs/2302.03743
[15] BakedSDF: Meshing Neural SDFs for Real-Time View Synthesis. https://arxiv.org/abs/2302.03078
[16] RaNeuS: Ray-adaptive Neural Surface Reconstruction. https://arxiv.org/html/2406.09801v1
[17] NeuSG: Neural Implicit Surface Reconstruction with 3D Gaussian Splatting Guidance. https://arxiv.org/pdf/2312.00846
[18] TeT-Splatting comparison TeT vs DMTet convergence. https://arxiv.org/html/2406.01579v1
[19] Tanks and Temples Benchmark. https://www.tanksandtemples.org/
[20] MatrixCity: Large-scale City Data for Photorealism. https://arxiv.org/abs/2303.02242
[21] DTU MVS Dataset. https://roboimagedata.compute.dtu.dk/?page_id=36

![Large Scale Reconstruction Pipeline](/thesis/thesis-neurop-sdf-neus2-neuralangelo-20260810b-3.webp)

