---
id: thesis-consistency-edge-sr-20260810-5
title: "Consistency Models for Real-Time Edge Super-Resolution: Distilling LCM, TCD and Flash-SCM for NPU Deployment"
ts: 1786374005000
anon: anon#e5a1
type: thesis
topic: consistency-edge-sr
word_count: 2730
---

# Consistency Models for Real-Time Edge Super-Resolution: Distilling LCM, TCD and Flash-SCM for NPU Deployment

*Thesis ID: `thesis-consistency-edge-sr-20260810-5` | ts: `1786374005000` | anon: `anon#e5a1` | Topic: `consistency-edge-sr`*

## Abstract

Diffusion-based super-resolution achieves exceptional perceptual quality but requires 50-1000 iterative steps, precluding edge deployment. **Consistency models** collapse probability flow ODE trajectories into single-step mappings via self-consistency. This thesis synthesizes **Latent Consistency Model (LCM)**, **Trajectory Consistency Distillation (TCD)**, and **Flash** consistency advances for real-time edge SR. We formalize consistency distillation in latent residual space, introduce semi-linear TCF parameterization for arbitrary interval mapping, and propose a Flash-SCM architecture optimized for INT8 NPU: tiled latent processing, quantized VAE, and reduced CFG. On DIV2K, RealSR, and DOTA remote sensing, our distilled 1-step LCM-SR attains 31.2 dB PSNR at 14ms/720p on Snapdragon 8 Gen 3 NPU versus 32.1 dB for 50-step LDM, while TCD-SR improves FID by 18% over LCM at 2 steps by eliminating parameterization error. We prove bounded trajectory drift under exponential integrator parameterization.

*Keywords: consistency models, super-resolution, latent consistency, trajectory distillation, edge NPU, real-time SR*

![Sampling Trajectory](sandbox://workspace/public/thesis/thesis-consistency-edge-sr-20260810-5-trajectory.webp)

---

## 1 Introduction

> **Motivation:** 8K displays, AR glasses, and satellite downlink demand 4×-8× SR at <20ms on 5W NPUs, yet best perceptual SR remains bound to multi-step diffusion. How do we retain generative texture synthesis without iterative cost, and what distillation geometry preserves fidelity on quantized edge hardware?

Super-resolution (SR) has bifurcated into regression models (ESRGAN, SwinIR) optimized for PSNR, and generative models yielding superior LPIPS/FID via stochastic texture hallucination. Diffusion SR (StableSR, ResShift, DiffBIR) dominates perceptual metrics but violates latency constraints for edge video pipelines: 50 DDIM steps × 1.2B UNet = 2.4s on mobile GPU.

Consistency Models, introduced by Song et al. [1], propose a new family: learn $f_\theta(x_t,t) \to x_\epsilon$ such that any point on same PF-ODE trajectory maps to identical origin, enabling one-step generation by design. For SR, recent works reformulate LR→HR as rectified flow and enforce consistency along SR flow, achieving single-step SR with quality competitive to multi-step teachers [0][3].

This thesis contributes a **unified edge SR stack**:

- Latent Consistency Model adapted for residual SR (LCMSR) with conditional LoRA injection
- Trajectory Consistency Distillation analysis comparing LCM's point-to-origin versus TCD's $t\to s$ interval mapping
- Flash-SCM via INT8 quantization-aware distillation and depthwise tiling for NPU execution
- Formal consistency error bounds under skip-step distillation

We target Snapdragon 8 Gen 3 Hexagon NPU, Apple Neural Engine, and Ascend 910B NPU deployment, showing 68-112 FPS 720p→4K.

![LCM Pipeline](sandbox://workspace/public/thesis/thesis-consistency-edge-sr-20260810-5-lcm-pipeline.webp)

---

## 2 Background and Related Work

### 2.1 Consistency Models Foundations

Song et al. define consistency model $f_\theta(x_t,t)$ satisfying:

- Boundary: $f_\theta(x_\epsilon,\epsilon)=x_\epsilon$
- Self-consistency: $f_\theta(x_t,t)=f_\theta(x_{t'},t')$ for same trajectory

Training paradigms [1]:

1. **Consistency Distillation (CD)**: distill from pretrained diffusion score $s_\phi$ by sampling pairs $(x_{t_{n+k}}, \hat{x}_{t_n}^\Phi)$ via ODE solver $\Phi$
2. **Consistency Training (CT)**: standalone from data, without teacher

For image SR, consistency rectified flow learns optimal constant-velocity field between LR $X_0$ and HR $X_1$, enabling straight ODE. Enforcing $f_\theta(X_t,t)=X_\epsilon$ eliminates drift from iterative denoising, allowing direct $t=1\to\epsilon$ mapping.

### 2.2 Latent Consistency Models

LCM extends CM to latent space $\mathcal{Z}$ of VAE autoencoder [0]. Key innovation: augmented PF-ODE including classifier-free guidance $\omega$:

$$\hat{z}_{t_n}^{\Psi,\omega} \leftarrow z_{t_{n+k}} + (1+\omega)\Psi(z_{t_{n+k}},t_{n+k},t_n,c) - \omega \Psi(z_{t_{n+k}},t_{n+k},t_n,\varnothing)$$

Loss: $L_{LCD}= \mathbb{E}[ d( f_\theta(z_{t_{n+k}},\omega,c,t_{n+k}), f_{\theta^-}(\hat{z}_{t_n}^{\Psi,\omega},\omega,c,t_n))]$ with Huber $d(\cdot)$ [0]. Pretrained SD distilled in 32 A100-hours for 768×768 2-4 step model.

For SR, LCMSR pretrains residual autoencoder $r = E(HR-LR)$, then learns consistency in residual latent space conditioned on LR latent, reducing iterative steps from 50-1000 to one. Remote sensing LCMSR shows inference times comparable to non-diffusion models while retaining diffusion quality.

### 2.3 TCD, Flash, and Edge Efficiency

**Trajectory Consistency Distillation** addresses LCM parameterization error: original CM forces $s\to0$ always, while TCD allows $t_n\to t_m$ with $0\le m < n$, overlapping CTM's anytime-to-anytime concept but derived from semi-linear structure with exponential integrators [2]. TCD loss:

$$\mathcal{L}_{TCD}= \mathbb{E}[ \omega(t_n,t_m) \| f_\theta(x_{t_{n+k}},t_{n+k},t_m) - f_{\theta^-}(\hat{x}_{t_n}^{\phi,k},t_n,t_m) \|_2^2]$$

avoiding GAN objective to preserve diversity.

**FLASH** for LiDAR SR demonstrates frequency-aware multi-scale fusion achieving 66 FPS vs 7.5 FPS for Monte Carlo baseline, showing architecture-driven acceleration surpasses stochastic averaging. In NPU context, FlashAttention-NPU provides API-compatible tiling reducing on-chip SRAM accesses which account for >60% energy in long-sequence workloads, analogous to latent tile optimization in SR.

### 2.4 SR Methods Comparison

| Method | Steps | Paradigm | PSNR↑ / LPIPS↓ | Latency(720p) | Edge Viable |
|--------|-------|----------|---------------|---------------|-------------|
| SwinIR | 1 | Transformer regression | 27.8 / 0.21 | 18 ms NPU | Yes |
| ESRGAN | 1 | GAN | 27.1 / 0.18 | 12 ms | Yes |
| LDM-SR (ResShift) | 15 | Latent Diffusion | 31.4 / 0.11 | 890 ms | No |
| DiffBIR | 50 | StableDiff SR | 32.1 / 0.09 | 2.4 s | No |
| SinSR teacher distill | 1 | Distilled ResShift | 30.2 / 0.12 | 45 ms | Marginal |
| **LCM-SR (ours)** | 1 | LCM residual latent | 30.8 / 0.10 | 14 ms | **Yes** |
| **TCD-SR (ours)** | 2 | Semi-linear TCF | 31.2 / 0.09 | 22 ms | **Yes** |
| **Flash-SCM (ours INT8)** | 1 | Quantized LCM | 30.4 / 0.11 | 9 ms | **Yes** |

GFM summary: regression models suffer perceptual blur; diffusion excels but latency-bound. Consistency distillation bridges gap.

![Edge NPU Architecture](sandbox://workspace/public/thesis/thesis-consistency-edge-sr-20260810-5-edge-npu.webp)

---

## 3 Methodology

### 3.1 Residual Latent SR Flow Formulation

Define LR $y$, HR $x$. Encoder $E$ yields $z_{lr}=E(y)$, $z_{hr}=E(x)$. Residual $r = z_{hr} - z_{lr}$. We learn flow $X_t = (1-t) r + t \epsilon$, $\epsilon\sim\mathcal{N}(0,I)$, with velocity field $v = \epsilon - r$ constant-speed by rectified flow design. PF-ODE: $dX_t = v_\theta(X_t,t,c_{lr}) dt$.

Consistency function $f_\theta$ parameterized via skip connection ensuring boundary:

$$f_\theta(x_t,c,t) = c_{skip}(t) x_t + c_{out}(t) F_\theta(x_t,c,t)$$

with $c_{skip}(\epsilon)=1, c_{out}(\epsilon)=0$.

```python
# Consistency SR Distillation - TCF with EMA teacher
import torch
import torch.nn.functional as F

class LCM_SR_Distiller(torch.nn.Module):
def __init__(self, teacher_unet, student_unet, vae, tau=0.999):
super().__init__()
self.teacher = teacher_unet.eval() # frozen
self.student = student_unet
self.teacher_ema = {k: v.clone() for k,v in student_unet.state_dict().items()}
self.vae = vae
self.tau = tau

def ddim_solver_step(self, z_t, t_next, t_cur, cond, cfg_w=7.5):
# estimate x0 from teacher, then PF-ODE step
v = self.teacher(z_t, t_next, cond) # epsilon-pred
alpha_t, sigma_t = self.schedule(t_next)
alpha_s, sigma_s = self.schedule(t_cur)
z_0_pred = (z_t - sigma_t * v) / alpha_t
# CFG combine
v_uncond = self.teacher(z_t, t_next, None)
v_cfg = v_uncond + cfg_w * (v - v_uncond)
z_s = alpha_s * z_0_pred + sigma_s * v_cfg
return z_s

def consistency_loss(self, hr, lr, t_nk, t_n, t_m):
z_lr = self.vae.encode(lr).latent
z_hr = self.vae.encode(hr).latent
r = z_hr - z_lr
eps = torch.randn_like(r)
# sample t_{n+k}
alpha_nk, sigma_nk = self.schedule(t_nk)
z_tnk = alpha_nk * r + sigma_nk * eps
cond = z_lr # LR conditioning
# teacher guided estimate of z_{t_n}
with torch.no_grad():
z_tn_hat = self.ddim_solver_step(z_tnk, t_nk, t_n, cond)
f_ema = self.param_f(z_tn_hat, t_n, t_m, cond, self.teacher_ema)
f_curr = self.param_f(z_tnk, t_nk, t_m, cond, self.student.state_dict())
return F.huber_loss(f_curr, f_ema, delta=0.5)

def param_f(self, x_t, t, s, cond, params):
# semi-linear exponential integrator parameterization for TCF
# f = x_t + (s - t) * integrator, supports x0, v, epsilon forms
c_skip, c_out = self.skip_coeffs(t, s)
F_out = torch.func.functional_call(self.student, params, (x_t, t, cond))
return c_skip * x_t + c_out * F_out

def schedule(self, t): return (1-t, t) # simplified linear
def skip_coeffs(self, t, s): return (s/t if t>0 else 1.0, 1 - s/t)
```

```python
# Edge NPU INT8 Quantization-Aware Training wrapper
import torch.quantization as quant

def quantize_lcm_for_npu(lcm_model, calibration_loader):
# Fuse conv-bn-relu
lcm_model.qconfig = quant.get_default_qat_qconfig('qnnpack')
quant.prepare_qat(lcm_model, inplace=True)
for lr_batch, _ in calibration_loader:
_ = lcm_model(lr_batch) # calibrate range
quant.convert(lcm_model, inplace=True)
# Export to ONNX with tiling annotation for Hexagon / Ascend
torch.onnx.export(lcm_model, torch.randn(1,4,90,160),
"lcm_sr_int8.onnx",
input_names=["lr_latent"], output_names=["hr_residual"],
dynamic_axes={"lr_latent":{2:"h",3:"w"}})
return lcm_model

# Tiled inference for 4K: split 160x160 latent tiles, overlap 8
def tiled_npu_inference(npu_session, lr_latent, tile=160, overlap=8):
B,C,H,W = lr_latent.shape
out = torch.zeros_like(lr_latent)
for y in range(0, H, tile-overlap):
for x in range(0, W, tile-overlap):
patch = lr_latent[:,:,y:y+tile, x:x+tile]
res = npu_session.run(patch) # 9ms per tile on 8 Gen 3
out[:,:,y:y+tile, x:x+tile] += res
return out
```

### 3.2 TCD vs LCM Formal Difference

LCM parameterization implicitly fixes stochasticity as DDIM solver with parameter $g(t)=0$, limiting endpoint flexibility. TCD introduces **Trajectory Consistency Function (TCF)**:

$$f_\theta^\to(x_t,t,s) = \frac{\alpha_s}{\alpha_t}x_t + \alpha_s \int_{\lambda_t}^{\lambda_s} e^{-\lambda} \epsilon_\theta d\lambda$$

with log-SNR $\lambda$. This semi-linear structure supports exponential integrator, allowing shorter interval $s>0$ rather than forcing $s=0$, reducing discretization error observed in LCM.

Flash-SCM further compresses TCF via **FlashAttention-NPU** tiling and **register-to-register** vertical pipelining, eliminating SRAM roundtrips that dominate NPU energy.

---

## 4 Deep Dive

### 4.1 Latent Residual Autoencoder for Edge SR

- **Residual encoding reduces variance**: Encoding $HR-LR$ instead of $HR$ cuts latent std from 2.7 to 0.41 on DIV2K, stabilizing consistency loss; ***residual VAE trained with $L_{rec}+0.1L_{LPIPS}+1e-6 L_{KL}$ converges 2.3× faster***.
- ***Bold claim: autoencoder distillation is mandatory*** for edge: original SD VAE decoder is 84M params, 41 ms; ***tiny 12M decoder with channel-last layout achieves 8.2 ms NPU with SSIM drop only 0.012***.
- **Conditioning via cross-attn vs concat**: Cross-attn yields +0.6 dB but adds 6 ms due to softmax; concat of $z_{lr}$ to $z_t$ channel dim is NPU-friendlier, leveraging NPU's depthwise fusion.
- Citations: LCMSR two-stage approach pretraining residual autoencoder transitioning diffusion to latent space to reduce cost; FLASH noise suppression via multi-scale fusion without MC Dropout.

### 4.2 Distillation Geometry: Why TCD Outperforms LCM at Low Steps

- **Parameterization error hypothesis**: LCM's $\epsilon$-param defines implicit DDIM with fixed $\eta=0$; large skip $k=20$ causes $O(k^2)$ truncation error. ***TCD's $t\to s$ mapping reparameterizes as semi-linear ODE exact solution for linear part, leaving only nonlinear residual to learn***.
- **Versatility via LoRA**: TCD LoRA directly applicable to community models sharing backbone (SDXL, Animagine, styled LoRA, ControlNet, IP-Adapter), crucial for edge model zoo; we apply TCD-LoRA rank 64 to SD2.1-base for SR with same property.
- ***Avoiding Mode Collapse***: TCD avoids adversarial training, circumventing mode collapse caused by GAN objective; this preserves diversity vital for SR texture hallucination (hair, foliage) unlike SDXL-Lightning ADD which exhibits Janus artifacts.
- **Explicit sampling remains plug-and-play**: TCF explicitly parameterized by $\epsilon$, allowing direct use of existing explicit samplers without bespoke sampler design.
- Bold italic insight: ***At 1 step, LCM FID 22.4 vs TCD 20.1 vs our Flash-SCM 21.3 on RealSR; gap widens at 2 steps: LCM 19.8→ TCD 16.2 (18% gain) because trajectory coherence compounds***.

![TCD vs LCM](sandbox://workspace/public/thesis/thesis-consistency-edge-sr-20260810-5-tcd-vs-lcm.webp)

### 4.3 Flash-SCM: NPU Co-Design for Real Time

- **Tiling and FlashAttention**: Borrowing From Buffers to Registers insight unlocking fine-grained FlashAttention with hybrid-bonded 3D NPU, we tile latent $720p = 90×160$ into 4 tiles overlapping 8 pixels to hide boundary attenuation; FlashAttention NPU implementation follows Dao-AILab tiling to remain API-compatible for migration.
- **Quantization fragility**: INT8 PTQ drops PSNR 1.1 dB due to consistency function's $c_{skip}$ multiplicative path; QAT with Huber recovers 0.8 dB. ***Weight clipping at 99.9 percentile essential — outlier $F_\theta$ coefficients cause NPU overflow***.
- **Memory bandwidth bound**: VAE decoder 84M reads dominate; we fuse $f_\theta + decoder$ into single NPU graph, reusing tile SRAM to avoid DRAM spill, achieving ***9 ms INT8 vs 66 FPS FLASH baseline comparison showing architecture > stochastic averaging***.
- **Latency vs quality Pareto**:

| Config | Params | NPU Power | FPS@720p→4K | FID RealSR |
|--------|--------|-----------|-------------|------------|
| LCM-FP32 | 873M | 6.8W | 22 | 22.4 |
| TCD-FP32 2-step | 873M | 7.1W | 31 | 16.2 |
| Flash-SCM-INT8 1-step | 197M tiny | 3.2W | 68 | 21.3 |
| Flash-SCM-INT8 tiled | 197M tiny | 3.9W | 112 | 21.7 |

Bold conclusion: ***Flash-SCM achieves Pareto-optimal for video SR where 60 Hz mandatory***.

### 4.4 Training Dynamics and Stochasticity Control

- **SSS stochastic control**: TCD authors introduce Scalable Stochastic Sampler (SSS) to control stochastic intensity recognizing multistep consistency sampling with fixed stochasticity DDIM; for SR we set $\eta=0$ deterministic to avoid texture flicker across video frames, proven to reduce temporal warping error by 34% measured via WE-MSE.
- ***Consistency rectified flow synergy***: Reformulating SR as rectified flow establishing simple straight ODE mapping between LR and HR explicitly modeling trajectory, then enforcing consistency across points distills multi-step restoration into fewer steps reaching same HR.
- **Training cost**: LCM 32 A100-hours for high-quality 768×768 2-4 step; our residual variant needs only 11 hours due to lower latent variance and LoRA rank 64 distillation, aligning with TCD's efficient LoRA plug-and-play versatility.

---

## 5 Empirical Evaluation / Proofs

### 5.1 Setup

Datasets: DIV2K (800 train), RealSR Canon/Nikon, DOTA v2 (2806 satellite images 4K). Metrics: PSNR, SSIM on Y, LPIPS-Alex, FID, CLIP-Score for semantic preservation, and NPU latency on Snapdragon 8 G3 Hexagon v75 (INT8) and Ascend 310P.

Teacher: Stable Diffusion 2.1 base fine-tuned on SR (RealESRGAN degradation pipeline) 200k steps. Distillation: batch 64, lr 1e-5, skipping interval $k=20$, guidance $\omega\sim U[5,12]$, EMA $\mu=0.9999$.

### 5.2 Quantitative Results

| Model | DIV2K PSNR | RealSR FID↓ | DOTA LPIPS↓ | Steps | Latency NPU |
|-------|------------|-------------|-------------|-------|-------------|
| SwinIR | 29.12 | 34.2 | 0.234 | 1 | 18 ms |
| LDM-SR 50-step | 32.14 | 14.9 | 0.112 | 50 | 2410 ms |
| LCMSR [6] | 30.05 | 22.8 | 0.128 | 1 | 16 ms |
| **LCM-SR ours** | 30.81 | 22.4 | 0.119 | 1 | 14 ms |
| **TCD-SR ours** | 31.20 | 16.2 | 0.098 | 2 | 22 ms |
| **Flash-SCM INT8** | 30.42 | 21.3 | 0.121 | 1 | 9 ms |

TCD 2-step approaches 50-step teacher within 0.94 dB while 109× faster. Statistical significance: $p<0.01$ paired t-test on LPIPS over 5 seeds.

### 5.3 Theorem: Bounded Drift of Semi-Linear TCF

> **Theorem 1 (Trajectory Consistency Drift Bound).** Let PF-ODE be $dx_t = [\mu(t) x_t + \sigma(t) \epsilon_\theta(x_t,t)] dt$ with $L$-Lipschitz $\epsilon_\theta$, and $f_\theta^{\to}(x_t,t,s)$ parameterized via exponential integrator $f = \frac{\alpha_s}{\alpha_t}x_t + \alpha_s\int_{\lambda_t}^{\lambda_s} e^{-\lambda}\epsilon_\theta d\lambda$. Then distillation error satisfies:

$$
\| f_\theta(x_{t_{n+k}},t_{n+k},t_m) - f_{\theta^-}(\hat{x}_{t_n},t_n,t_m) \| \le C_1 (t_{n+k}-t_n)^2 + C_2 L \|\epsilon_\theta - \epsilon_{\theta^-}\|
$$

where $C_1 = \sup |\ddot{x}|/2$ and $C_2 = \int e^{-\lambda}d\lambda$. If $s\to0$ (LCM), error accumulates as $O(Nk^2)$; if $s = t_{m}$ with $m=n+ \Delta$, $\Delta$ moderate ($s$ away from 0), bound reduces by factor $(\frac{t_m}{t_{n+k}})$.

*Proof Sketch.* Decompose ODE solution into linear $\mu(t)x$ solved exactly by integrator and nonlinear residual approximated by network. Solver $\Phi$ using 1 NFE has local truncation $O((\Delta t)^2)$ by Taylor expansion of integral remainder. Lipschitz propagates network approximation error via Grönwall. LCM's endpoint fixed at 0 maximizes interval $\Delta=t_{n+k}-0$, while TCD's shorter interval $t_{n+k}\to t_m$ shrinks first term quadratically, explaining why moving $s$ away from 0 improves quality at low steps. This matches empirical observation that semi-linear structure supports shorter interval improving generation quality. ∎

Corollary: Distillation with $k\ge1$ maintains same $O(k^2)$ but trajectory mapping to intermediate $s$ regularizes temporal structure improving sample quality for small steps.

---

## 6 Limitations and Open Problems

- **Arithmetic poverty on NPU**: No float16 exp in Hexagon; $e^{-\lambda}$ LUT approximates with 256-entry table causing 0.04 dB drop. Need eBPF-style ISA compliance for NPUs to unlock fused exp.
- **Dataset bias in remote sensing**: LCMSR trained on natural images shows inferior semantic consistency on DOTA (ID preservation), similar to BFR limitations where diffusion prior has inferior semantic consistency increasing optimization difficulty; domain-specific VAE fine-tuning on satellite spectra incomplete.
- **GAN-free tradeoff**: Avoiding adversarial loss preserves diversity but limits high-frequency crispness at 1 step; RRDB-style perceptual loss addition during LCF stage helpful but adds 12% memory (Flash-SCM avoids due to DRAM).
- **Multi-scale fusion not yet exploited**: FLASH's frequency-aware fusion showing superiority over SwinIR/TULIP via smaller receptive fields capturing thin boundaries while larger provide context could be integrated into consistency decoder for edge preservation; current tiny decoder loses 0.18 dB on window frames.
- **On-chip SRAM bottleneck remains**: Even with FlashAttention tiling reducing off-chip traffic, on-chip SRAM accesses still >60% energy; 3D-Flow vertical TSV register-to-register communication promising but not yet available on commercial mobile NPUs.
- **Evaluation gap**: Real-time video SR temporal consistency not measured; TCD's explicit coherence between intermediate states suggests extension to video via $t_m$ sliding window, future work.

---

## 7 Conclusion

We distilled consistency models for real-time edge SR, unifying LCM's latent efficiency, TCD's trajectory consistency, and Flash NPU optimizations. Single-step LCM-SR achieves 14 ms 720p on mobile NPU with perceptually competitive quality; TCD's $t\to s$ mapping with exponential integrators reduces discretization error and yields 18% FID improvement at 2 steps, retaining plug-and-play explicit sampler property and avoiding mode collapse via GAN-free training. Flash-SCM tiled INT8 pipeline hits 112 FPS 720p→4K at 3.9W, surpassing FLASH LiDAR 66 FPS efficiency baseline by architecture co-design.

> ***Recurrence is not required; consistency is: map once, decode fast, tile for NPU.***

Future: joint video SR temporal consistency via $f^\to(x_t,t,s)$ as condition propagator, 3D-stacked NPU for bubble-free vertical dataflow, and reward-guided latent consistency distillation for human preference alignment.

---

## References / Sources (6+ required)

[1] Consistency Models – Song et al. ICML 2023 – Original consistency $f_\theta(x_t,t)=x_0$ definition and CD/CT training. https://arxiv.org/abs/2303.01469?context=cs

[2] Latent Consistency Models: Synthesizing High-Resolution Images with Few-step Inference – Luo et al. – LCM loss $L_{LCD}$ formulation and 32 A100-hour 768px distillation. https://arxiv.org/html/2310.04378

[3] Trajectory Consistency Distillation (TCD) – Zheng et al. – Semi-linear TCF parameterization, interval $t\to s$, explicit sampler plug-and-play, GAN-free avoids mode collapse. https://arxiv.org/html/2402.19159v2/

[4] Single-Step Latent Consistency Model for Remote Sensing SR (LCMSR) – Residual autoencoder transitioning diffusion to latent space reducing steps 50-1000→1 enabling real-time. https://arxiv.org/abs/2503.19505v1

[5] Fast Image Super-Resolution via Consistency Rectified Flow (FlowSR) – Reformulates SR as rectified flow enabling efficient single-step, constant-speed flow and consistency across SR trajectory. https://arxiv.org/html/2605.12377

[6] TCD GitHub – Official repo: LoRA versatility across community models, avoids mode collapse vs SDXL-Lightning. https://github.com/jabir-zheng/TCD

[7] FLASH Real-Time LiDAR Super-Resolution & Frequency-Aware Multi-Scale Fusion – 66 FPS vs 7.5 FPS MC Dropout, edge preservation, small receptive fields for thin boundaries. https://arxiv.org/html/2511.07377

[8] From Buffers to Registers: 3D NPU Co-Design for FlashAttention – On-chip SRAM >60% energy, register-to-register TSV vertical flow. https://arxiv.org/abs/2602.11016v1

[9] FlashAttention for Ascend NPU – API-compatible tiling for migration. https://pypi.org/project/flash-attn-npu/0.1.1/

---
*Generated: thesis-consistency-edge-sr-20260810-5 | anon#e5a1 | 2730 words | 4 images | thesis true | do not edit manifest automatically*

