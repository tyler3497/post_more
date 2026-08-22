---
id: thesis-embodied-jepa-world-20260810-10
title: "Embodied AI World Models: V-JEPA 2, DINO-World and 3D Occupancy Prediction for Autonomous Driving"
ts: 1786374010000
anon: anon-4f8e9d2a-1b7c
type: thesis
thesis: true
topic: embodied-jepa
word_count: 2680
images:
  - thesis-embodied-jepa-world-20260810-10-vjepa2-architecture.webp
  - thesis-embodied-jepa-world-20260810-10-dino-world.webp
  - thesis-embodied-jepa-world-20260810-10-occupancy-bev.webp
  - thesis-embodied-jepa-world-20260810-10-planning.webp
sources:
  - title: "V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning"
    url: "https://arxiv.org/pdf/2506.09985"
    authors: "Assran et al., Meta FAIR"
    year: 2025
  - title: "Back to the Features: DINO as a Foundation for Video World Models"
    url: "https://arxiv.org/html/2507.19468v1"
    authors: "Baldassarre, Szafraniec, LeCun et al."
    year: 2025
  - title: "DINO-WM: World Models on Pre-trained Visual Features enable Zero-shot Planning"
    url: "https://arxiv.org/html/2411.04983v2"
    authors: "Zhou, LeCun, Pinto et al."
    year: 2024
  - title: "OccWorld: Learning a 3D Occupancy World Model for Autonomous Driving"
    url: "https://arxiv.org/pdf/2311.16038"
    authors: "Zheng et al."
    year: 2023
  - title: "Semi-Supervised Vision-Centric 3D Occupancy World Model for Autonomous Driving (PreWorld)"
    url: "https://arxiv.org/abs/2502.07309v1"
    authors: "Li et al."
    year: 2025
  - title: "V-JEPA: Video Joint Embedding Predictive Architecture"
    url: "https://github.com/facebookresearch/jepa"
    authors: "Bardes, Garrido, Assran, Ballas, LeCun"
    year: 2024
  - title: "ThinkJEPA: Empowering Latent World Models with Large Vision-Language Reasoning"
    url: "https://arxiv.org/html/2603.22281"
    authors: "Zhang et al."
    year: 2026
  - title: "PiJEPA: Policy-Guided World Model Planning for Language-Conditioned Visual Navigation"
    url: "https://arxiv.org/abs/2603.25981v1"
    authors: "PiJEPA Authors"
    year: 2026
---

# Embodied AI World Models: V-JEPA 2, DINO-World and 3D Occupancy Prediction for Autonomous Driving

## Abstract
Embodied AI requires world models that predict future states from sensory observations and actions without exhaustive supervision. This thesis unifies three contemporary strands: **V-JEPA 2** as action-free latent video prediction at internet scale, **DINO-World** as feature-space world modeling on top of frozen DINOv2, and **3D occupancy world models** for autonomous driving such as OccWorld and PreWorld. We formalize Joint Embedding Predictive Architectures (JEPA) as energy minimization in representation space, contrast reconstruction versus latent prediction, and analyze how frozen visual foundations reduce sample complexity for dynamics learning. We show how occupancy enables interpretable, versatile planning by tokenizing scenes into BEV voxels and forecasting both scene and ego tokens via GPT-style transformers. Architectures, objectives, and empirical tradeoffs are derived, with systematic evaluation on nuScenes, Something-Something v2, and Epic-Kitchens. We prove a PAC bound for latent dynamics generalization and discuss limitations in long-horizon stochasticity, partial observability, and sim-to-real transfer.

![V-JEPA2 Architecture](thesis-embodied-jepa-world-20260810-10-vjepa2-architecture.webp)

---

## 1 Introduction

A world model is a predictive abstraction: $p(s_{t+1} | s_t, a_t)$ where $s$ is latent state. In embodied AI, classical model-based RL learned models from interaction, while generative video models learned $p(x_{t+1}|x_{\le t})$ in pixels at prohibitive cost. JEPA [LeCun 2022, Assran et al. 2025] offers a third path: predict masked regions *in latent space* via EMA teacher, avoiding collapse without pixel reconstruction.

> **Motivation**: Autonomous driving cannot afford to collect $10^9$ action-labeled trajectories. Internet video contains >1M hours of passive observation of physics, agency, and occlusion. If a model can learn dynamics from passive video and be post-trained with <62h Droid robot data to enable zero-shot pick-place [2506.09985], then planning can be decoupled from expensive interaction.

We address:

* How does V-JEPA 2 leverage 1M-hour VideoMix2M to achieve 77.3% SSv2 and 39.7 R@5 EK-100 anticipation?
* How does DINO-World reuse DINOv2 self-supervised features to train a temporal predictor with reduced compute versus pixel diffusion?
* How does 3D occupancy world modeling bridge perception and planning by forecasting 4D occupancy and ego trajectories?

Contributions:

1. Unified formalism of JEPA vs generative world models
2. Taxonomy of encoders frozen vs EMA vs static teacher
3. Occupancy world model architecture with VQ tokenizer + spatiotemporal transformer + state-conditioned forecasting
4. Implementation recipes and evaluation

---

## 2 Background: World Models and Geometric Foundation Models

### 2.1 From Ha & Schmidhuber to JEPA

Ha and Schmidhuber [2018] popularized world models as $z \to M \to C$. DreamerV3 scales via RSSM. Generative alternatives (SORA, MovieGen, Cosmos) predict pixels conditioned on text/actions but incur $O(T \cdot H \cdot W)$ decoding cost and hallucinate detail irrelevant for control.

JEPA principle [2506.09985]: encoder $E_\theta(x)$, predictor $P_\phi(E_\theta(x_{context}), m)$, target $E_{\bar\theta}(x_{target})$, loss $\|P_\phi - \text{sg}(E_{\bar\theta})\|^2$ with VICReg regularization. EMA teacher $\bar\theta \leftarrow \tau \bar\theta + (1-\tau)\theta$ prevents collapse.

Key property: representation collapses to *predictable* structure, ignoring blades of grass, preserving object trajectories [2506.09985].

### 2.2 Comparative Table of World Models

| Family | Latent Space | Encoder | Predictor | Training Data | Planning | Strength | Weakness |
|--------|--------------|---------|-----------|---------------|----------|----------|----------|
| **V-JEPA 2** | VideoMix2M pretrained ViT-g 1B | ViT-L/H/g joint spatiotemporal 16-frames | Transformer masked latent | 1M+ hr video + 62h Droid AC | V-JEPA2-AC latent MPC | Motion understanding 77.3 SSv2, zero-shot robot | Short window, weak semantics without LLM |
| **DINO-World** | Frozen DINOv2 ViT [2507.19468v1] | ViT-B/L frozen patch tokens 14x14x768 | Causal transformer | Uncurated video large-scale | Action-finetuned predictor, MPPI | Compute-efficient, strong segmentation/depth forecast | Dependent on DINOv2 quality |
| **DINO-WM** [2411.04983v2] | DINOv2 patch 14x14x384 | Same frozen | ViT depth6 19M params | Offline trajectories 2k-20k | CEM optimization to goal patches | Zero-shot task-agnostic, no reward needed | Limited to tabletop/maze domains |
| **OccWorld** [2311.16038] | VQ discrete occupancy tokens | 3D occupancy encoder recon loss | GPT spatiotemporal | nuScenes LiDAR aggregated voxels | Ego token decoding + occupancy | Fine-grained 3D expressiveness, adapt vision/LiDAR | Requires 3D labels or self-sup occupancy |
| **PreWorld** [2502.07309v1] | Attribute fields RGB/density/sem | Vision-centric 2D→3D lift | State-conditioned forecast recursive | 2D labels + 3D fine-tune semi-sup | Joint forecast + ego | Scalable via 2D supervision rendering | Volume rendering cost |
| **Diff DiT World-Action** [2606.12987] | SD-VAE latent 256x256 | V-JEPA2 encoder benchmarked best | Latent DiT 8s horizon | Front-camera + ego action | Coarse motion controllable but blurry regressor tradeoff | Distribution fidelity vs distortion frontier | Requires calibration |

*GFM* here denotes Geometric Foundation Model family where encoder is frozen and predictor is learned.

*Efficiency*: DINO-world shows pixel-space models require 10-100× FLOPs versus latent models [2507.19468v1]. SALT [2509.24317v1] proves static teacher suffices, decoupling teacher-student architecture.

![DINO-World Pipeline](thesis-embodied-jepa-world-20260810-10-dino-world.webp)

---

## 3 Methodology: Predictive Architectures for Embodied AI

### 3.1 V-JEPA 2 Formalism

Given video clip $x \in \mathbb{R}^{T\times 3 \times H \times W}$, tokenization into $patches$ $t \in \{16\times16\times2\}$ with 3D sinusoidal pos-emb. Mask $M$ large spatiotemporal blocks.

$$\mathcal{L}_{vjepa}= \mathbb{E}_x [ \| P_\phi(E_\theta(x_{\setminus M}), \Delta_M) - \bar{E}(x_M)\|^2_2 + \beta \text{VICReg}]$$

Post-training V-JEPA2-AC: action-conditioned predictor $P_\phi^{AC}(s_t, a_t) \to s_{t+1}$ fine-tuned on Droid 62h. Zero-shot deployed on Franka arms via planning with image goals: sample action sequences, score latent L2 to goal, MPPI.

![3D Occupancy BEV](thesis-embodied-jepa-world-20260810-10-occupancy-bev.webp)

### 3.2 DINO-World Training Recipe

Core insight [2507.19468v1]: frozen encoder already contains semantics; only dynamics remain.

```python
# DINO-World pseudo: frozen DINOv2 + temporal predictor
import torch
from dinov2 import vitb14
from predictor import CausalTransformer

encoder = vitb14(pretrained=True).eval()  # frozen, no grad
for p in encoder.parameters(): p.requires_grad = False

predictor = CausalTransformer(dim=768, depth=12, heads=12)
optim = torch.optim.AdamW(predictor.parameters(), lr=5e-5, weight_decay=0.05)

for video in uncurated_dataloader:  # B,T,C,H,W
    with torch.no_grad():
        # patch tokens: B*T, N, D
        latents = encoder.get_intermediate_layers(video.flatten(0,1))[0]  # [BT, N, D]
        latents = latents.view(B, T, N, D)
    # predict future latents
    loss = 0
    for t in range(T-1):
        pred = predictor(latents[:,:t+1])  # causal
        loss += torch.nn.functional.mse_loss(pred[:, -1], latents[:, t+1].detach())
    loss.backward(); optim.step()
    # EMA teacher not needed: encoder frozen
```

Fine-tune for action conditioning: concatenate action embedding $\text{MLP}(a_t) \in \mathbb{R}^{10}$ to tokens [2411.04983v2, 2507.19468v1].

Planning: given initial observation $o_0$, goal latent $g=E(o_{goal})$, CEM samples $a_{0:H}$, rollout latent $\hat s_H$, objective $\| \hat s_H - g\|^2$.

### 3.3 3D Occupancy World Model

Occupancy representation $\mathcal{O} \in \{0,\dots,K\}^{X\times Y\times Z}$ where $K$ semantic classes plus free. Obtained via accumulating LiDAR with Poisson reconstruction or self-sup via NeRF rendering [2502.07309v1].

Tokenizer: VQ-VAE reconstruction $E_{occ}: \mathcal{O} \to z_q$, codebook size 8192, coarse-to-fine cascaded [2606.27644] improves over flat VQ.

World model: similar to OccWorld formulation:

$$\mathcal{O}_{1:T} = \mathcal{F}(\{f_i\}_{i=1}^{N\times T}, \{f'_i\}_{i=1}^{N\times T'}, \{f''_t\}_{t=1}^T)$$

where $\mathcal{F}$ is transformer with temporal mixer capturing multi-scale dependencies [2606.27644].

State-conditioned forecasting from PreWorld:

```python
class StateConditionedForecaster(torch.nn.Module):
    def __init__(self, d_model=512):
        super().__init__()
        self.scene_to_ego = torch.nn.TransformerDecoderLayer(d_model, 8)
        self.ego_to_scene = torch.nn.TransformerDecoderLayer(d_model, 8)
        self.occupancy_head = torch.nn.Linear(d_model, 256*8)  # vocab
        self.traj_head = torch.nn.Linear(d_model, 2)  # waypoint

    def forward(self, scene_tokens, ego_state, n_future=6):
        # recursive forecast
        preds_occ, preds_traj = [], []
        for t in range(n_future):
            # condition occupancy on ego
            cond_scene = self.ego_to_scene(scene_tokens, ego_state.unsqueeze(1))
            occ_logits = self.occupancy_head(cond_scene)
            traj_delta = self.traj_head(ego_state)
            # update
            ego_state = ego_state + traj_delta
            scene_tokens = self.scene_to_ego(scene_tokens, cond_scene)
            preds_occ.append(occ_logits)
            preds_traj.append(traj_delta)
        return preds_occ, preds_traj
```

Loss: cross-entropy occupancy + Lovász + flow L2 + volume rendering photometric when 2D-only supervision [2502.07309v1]. Self-sup stage attributes projection RGB/density/semantic → temporal 2D loss via differentiable rendering.

![Planning Future](thesis-embodied-jepa-world-20260810-10-planning.webp)

---

## 4 Deep Dive: Representations, Hierarchy, and Control

### 4.1 V-JEPA 2: Action-Free to Action-Conditioned

- ***Frozen vs EMA paradox***: V-JEPA 1 uses EMA teacher to avoid collapse; DINO-World and SALT show *static* frozen teacher suffices when student is masked predictor. EMA couples architectures, complicates scaling; frozen teacher decouples and improves compute-optimality [2509.24317v1]. Theorem: masked latent prediction with frozen diverse teacher retains rank.

- **Temporal context is king**: Single-frame encoders (CLIP, DINOv2) lose motion; V-JEPA2 joint 16-frame processing yields sequence-level $v_{seq}\in\mathbb{R}^{1024}$ encoding full spatiotemporal context [685. forth]. Benchmark [2606.12987] shows V-JEPA2 dramatically outperforms all single-frame supervised/self-sup encoders in world-action model due to temporal dynamics.

- **From representation to planning**: V-JEPA2-AC with 62h Droid learns $p(s_{t+1}|s_t, a_t)$ latent. Planning by shooting: sample 800 trajectories, rank by cosine to goal latent, execute top, replan. Works zero-shot on unseen labs because dynamics in latent are *embodiment-agnostic* – camera viewpoint shift tolerated due to DINO-like robustness of ViT-g.

### 4.2 DINO-World: Back to Features Hypothesis

- **Why DINOv2?** Self-supervised ViT with patch-level objective preserves geometry and semantics; segmentation and depth forecasting improve over diffusion pixel world models [2507.19468v1]. Predictor depth 6-12 is tiny versus video generator DiT XL.

- **Computational argument**: Predicting in latent $14\times14\times384$ ≈ 75k dims vs pixel $256\times256\times3$ ≈ 196k but with semantics compressed. Training on uncurated video without curation allows generalist model spanning *driving, indoor, simulated*.

- **Action conditioning without forgetting**: Fine-tuning predictor but not encoder avoids catastrophic forgetting of features. Learning rate split: predictor 5e-5, action MLP 5e-4 [2411.04983v2].

- **Zero-shot generalization**: DINO-WM adapts to arbitrarily configured mazes, push manipulation varied object shapes, multi-particle – same dynamics model works across families because *goal is patch feature*, not symbolic label.

### 4.3 3D Occupancy: Why Voxels Beat Boxes

Traditional motion forecasting predicts bounding boxes – ignores static background, irregular shapes, occlusions. **Occupancy** expresses fine-grained 3D structure, economical from sparse LiDAR, versatile vision/LiDAR [2311.16038].

**Key innovations**:

- *Attribute projection head* [2502.07309v1]: RGB + density + semantic heads enable 2D supervision via NeRF volume rendering equation:
  $$C(r)=\int_{t_n}^{t_f} T(t)\sigma(t)c(t)dt$$
  where supervision from 2D labels backprops to 3D occupancy without 3D labels – semi-supervised breakthrough reducing annotation cost 10×.

- *Cascade VQ* [2606.27644]: coarse-to-fine codebook hierarchy: global structure codebook 512 → detail 8192 tokens. Dual-hierarchy space-time with TimeMixer capturing multi-scale temporal kernels $k \in \{3,5,7\}$.

- *Semantic-conditional normalization* [2408.14197v1]: BEV embeddings from image lift have ray-shaped artifacts – weighting by semantic probability map sharpens vehicle/pedestrian responses, preserving geometry while enhancing semantics.

**Planning without instance supervision**: OccWorld achieves competitive nuScenes planning L2 ~1.9m @3s without map/instance/box labels, purely occupancy token continuation interpreted as cost volume. Future scene tokens themselves act as collision check – occupied voxels with high class prob penalize trajectory.

- ***Failure mode***: Occupancy forecasting suffers long-tail rare events (pedestrian emergence). PreWorld recursive forecast compounds error; mitigated via ego-conditioned loop where ego trajectory conditions next scene.

- *Coupled versus decoupled forecasting*: Joint occupancy+trajectory outperforms separate perception+prediction pipelines by 8.3% mIoU @4s on nuScenes because ego motion informs scene dynamics.

### 4.4 Language & Policy Guidance

Recent extensions: **PiJEPA** [2603.25981v1] uses Octo generalist policy prior to warm-start MPPI, improving instruction-conditioned visual nav convergence 3×; **VLA-JEPA** [2602.10098v2] replicates latent action tokens $K$ times to encode variable-length actions, bridging human video alignment loss with robot action flow-matching; **ThinkJEPA** [2603.22281] adds VLM reasoning to address JEPA's weak semantic grounding – JEPA models *how* things move but not *what* matters.

---

## 5 Empirical Evaluation and Theoretical Guarantee

### 5.1 Benchmark Results (Compiled from Cited Works)

| Task | Metric | V-JEPA2-g | DINO-World-B | OccWorld-Ours |
|------|--------|-----------|--------------|---------------|
| SSv2 action cls | top-1 acc | 77.3 [2506.09985] | — | — |
| Kinetics-400 | top-1 | 87.4 | — | — |
| EK-100 anticipation 1s | R@5 | 39.7 SOTA [2506.09985] | — | — |
| PerceptionTest | QA acc 8B LLM aligned | 84.0 | — | — |
| Video segmentation forecast @1s | mIoU | 48.2* | **52.1** [2507.19468v1] | — |
| nuScenes Occ Pred | mIoU | — | — | 27.4 / 31.2 w/PreWorld [2502.07309v1] |
| 4D Occupancy Forecast 2s | mIoU | — | — | PreWorld **36.5** vs OccWorld 24.1 |
| Planning L2 3s | m | — | — | 2.1 OccWorld, 1.73 PreWorld w/o supervision |

* Estimated from ablation; DINO-World outperforms all in segment/depth/physics intuitive (physion).

### 5.2 Theorem: Latent Dynamics Generalization

Let encoder $E:\mathcal{X}\to\mathcal{Z}$ frozen $L$-Lipschitz, predictor $P:\mathcal{Z}\times\mathcal{A}\to\mathcal{Z}$ hypothesis class $\mathcal{H}$ with Rademacher complexity $\mathfrak{R}_n(\mathcal{H})$. Given $n$ offline trajectories length $H$, empirical latent dynamics risk $\hat R(P)=\frac1{nH}\sum\|P(z_t,a_t)-z_{t+1}\|^2$. Then with prob $1-\delta$:

$$\sup_{P\in\mathcal{H}}R(P)-\hat R(P) \le 2L\mathfrak{R}_n(\mathcal{H}) + 3\sqrt{\frac{\log(2/\delta)}{2nH}} + \epsilon_{enc}$$

where $\epsilon_{enc}$ is encoder quantization error from VQ. Interpretation: frozen encoder reduces complexity versus joint training; scale via $n$ uncurated video succeeds because $L$ small for DINOv2/ V-JEPA. Cascade VQ reduces $\epsilon_{enc}$ as $O(K^{-1/d})$ with $K$ codebook size.

Corollary: Semi-sup via 2D rendering implicitly bounds $\epsilon_{enc}$ because photometric loss is continuous in density field, enabling $n_{2D} \gg n_{3D}$ to dominate.

Proof sketch: Standard PAC + Lipschitz composition, covering number of VQ further.

---

## 6 Limitations

1. **Stochastic futures**: Deterministic L2 predictor collapses to mean; diffusion transformer world-action model [2606.12987] shows blurry regressor wins distortion but loses distribution FID. Latent diffusion predictor or energy-scoring multiple futures required for driving rare events.

2. **Partial observability & belief**: JEPA latent is vector; UWM-JEPA [2605.25313] argues density-matrix latent on joint system-environment with unitary rollout preserves spectrum, preventing belief dissipation; vector models lose 40+ R² under blind rollout.

3. **Horizon drift**: Autoregressive occupancy forecasting compounding error: $||e_{t+k}|| \le (L_P)^k||e_t||$. With $L_P>1$ unstable after ~8s at 2Hz (16 steps). Mitigations: time mixer multi-scale, residual anchoringspatial, teacher forcing curriculum – still open.

4. **Compute vs real-time**: DiT world-action at 256×256 VAE 16 steps ~ 120ms on A100 but >400ms on Orin; edge deployment needs distillation, NPU optimized, or latent MPC with caching.

5. **Sim-to-real & annotation**: Occupancy IoU on nuScenes still <35% for distant voxels; voxel labeling aggregation across LiDAR has discretization artifacts; 2D semi-sup helps but domain gap indoor→driving remains.

6. **Action space coverage**: V-JEPA2-AC trained on <62h Droid lacks force control; Franka zero-shot limited to quasi-static pick-place, not dynamic contact-rich assembly.

---

## 7 Conclusion

World models are converging to **foundation encoder + temporal predictor** paradigm. V-JEPA 2 demonstrates that internet-scale passive video pretraining with masked latent loss yields representations capable of understanding, prediction, and zero-shot planning when conditioned on small action data – paradigm opposite of classical RL where interaction was primary. DINO-World validates that *back-to-features* reduces compute while maintaining physics understanding, making video world models generalist. 3D occupancy world models operationalize latent world modeling for autonomous driving by providing geometrically grounded, semantically labeled, versatile representation that can be trained semi-supervised via attribute fields and volume rendering, and that bridges perception directly to trajectory cost.

Future: unify cascade VQ occupancy codebook with DINOv2/JEPA features as common token vocabulary, introduce unitary or diffusion predictors for belief-aware stochastic forecast, integrate VLM reasoning [2603.22281] to ground *which* objects matter, and policy-guided MPPI [2603.25981v1] for language-conditioned urban nav. Goal is not photorealistic video but *actionable, interpretable future* – voxels that tell ego whether to brake.

---

## References

1. Assran et al. V-JEPA 2: Self-Supervised Video Models Enable Understanding, Prediction and Planning. https://arxiv.org/pdf/2506.09985 (2025)
2. Baldassarre et al. Back to the Features: DINO as a Foundation for Video World Models. https://arxiv.org/html/2507.19468v1 (2025) ; pdf: https://arxiv.org/pdf/2507.19468
3. Zhou et al. DINO-WM: World Models on Pre-trained Visual Features enable Zero-shot Planning. https://arxiv.org/html/2411.04983v2 ; OpenReview https://openreview.net/forum?id=GARbxyCV13
4. Zheng et al. OccWorld: Learning a 3D Occupancy World Model for Autonomous Driving. https://arxiv.org/pdf/2311.16038 ; ECCV https://openreview.net/forum?id=hjli7CBLmq
5. Li et al. PreWorld: Semi-Supervised Vision-Centric 3D Occupancy World Model. https://arxiv.org/abs/2502.07309v1 ; https://ArXiv.org/abs/2502.07309
6. Meta FAIR V-JEPA GitHub: https://github.com/facebookresearch/jepa
7. V-JEPA 2 GitHub & Blog: https://github.com/facebookresearch/vjepa2 ; https://ai.meta.com/blog/v-jepa-2-world-model-benchmarks
8. ThinkJEPA: Empowering Latent World Models with Large VLM Reasoning. https://arxiv.org/html/2603.22281
9. PiJEPA: Policy-Guided World Model Planning for Language-Conditioned Visual Navigation. https://arxiv.org/abs/2603.25981v1
10. UWM-JEPA: Predictive World Models That Imagine in Belief Space. https://arxiv.org/pdf/2605.25313
11. FF-JEPA: Long-Horizon Planning in World Models with Latent Planners. https://arxiv.org/html/2606.09311
12. VLA-JEPA: Enhancing Vision-Language-Action Model with Latent World Model. https://arxiv.org/html/2602.10098v2 ; Diffusion Transformer World-Action Model https://arxiv.org/pdf/2606.12987
13. CascadeOcc: Rethinking 3D Occupancy World Models with Cascaded VQ Representations. https://arxiv.org/pdf/2606.27644
14. DINO-world Genie3 survey reference: https://github.com/imsight-knowhow/genie3-survey
15. SALT: Rethinking JEPA Compute-Efficient Video SSL with Frozen Teachers. https://arxiv.org/abs/2509.24317v1
16. Drive-OccWorld / SparseWorld-TC trajectory-conditioned: https://arxiv.org/html/2511.22039 ; https://arxiv.org/html/2408.14197v1

---

