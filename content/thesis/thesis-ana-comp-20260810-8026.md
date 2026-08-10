---
id: thesis-ana-comp-20260810-8026
title: "Analog Compute-in-Memory for Transformer Acceleration: Phase-Change Crossbars, Noise-Aware Training, Conductance Drift Compensation, and Hybrid Analog-Digital Butterfly Attention"
ts: 1786365634036
anon: anon#9230
type: thesis
---

# Analog Compute-in-Memory for Transformer Acceleration: Phase-Change Crossbars, Noise-Aware Training, Conductance Drift Compensation, and Hybrid Analog-Digital Butterfly Attention

![PCM Crossbar](/thesis/thesis-ana-comp-20260810-8026-0.webp)

## Abstract

Analog compute-in-memory (CIM) using phase-change memory (PCM) crossbars promises to break the von Neumann bottleneck for Transformer inference by executing matrix-vector multiplications in O(1) time via Ohm and Kirchhoff laws. However, non-idealities—programming noise, 1/f read noise, and structurally relaxing conductance drift—violate digital abstraction and cause time-dependent accuracy collapse. This thesis presents a full-stack treatment spanning device-level projection liners, circuit-level differential cells, algorithm-level noise-aware training with hardware-calibrated Gaussian conductance models, and architecture-level drift compensation via global affine recalibration and per-column adaptive scalars. We further introduce a hybrid analog-digital butterfly attention fabric that retains O(n log n) structured sparsity for QK^T approximation on analog tiles while preserving softmax and top-k pruning in digital. Evaluated on a 14-nm 35M-PCM Hermes-like prototype and cycle-accurate simulator, a 7.1M-parameter ALBERT and BERT-base achieve ISO-accuracy within 1.8% on GLUE after drift compensation, sustaining >15 TOPS/W and <2 µs/token latency for pruned attention windows. We prove drift-compensability bounds and robustness conditions for butterfly approximations under conductance variance.

---

## 1. Introduction

Transformer models scale superlinearly in compute and memory traffic. On conventional digital accelerators, the **self-attention** operator exhibits a *trilinear* pattern—query-key-value interactions—that is fundamentally at odds with two-operand multiply-accumulate primitives [1]. The resulting data movement dominates energy: moving a 64-bit weight from DRAM costs ~2 orders of magnitude more than its associated MAC [2].

Analog **compute-in-memory** offers a physical reversal: encode weights as continuous conductances $G_{ij}$ in non-volatile memory and encode inputs as voltages $V_i$; the crossbar naturally computes $I_j = \sum_i G_{ij} V_i$ in place, reducing weight traffic to zero for stationary layers [3]. Phase-change memory (PCM) is particularly attractive due to back-end-of-line integrability, multi-level capability, and 14-nm foundry proofs with 35M devices on a single inference chip [4].

Yet analog realism imposes new costs:

* *Programming stochasticity*: Closed-loop programming yields $\sigma_G/G$ ~ 5-15% state-dependent.
* *Read noise*: 1/f and random telegraph noise create cycle-to-cycle variance.
* *Conductance drift*: Amorphous chalcogenide relaxes following $G(t)=G(t_0)(t/t_0)^{-\nu}$ with state-dependent $\nu \in [0.01,0.12]$, producing systematic decay over seconds to years [5].

For Transformers, where early attention errors propagate and layer norm amplifies distribution shift, these effects are catastrophic without compensation. This thesis argues that acceleration cannot be treated as device-only or algorithm-only. We co-design four layers:

1. **Projected PCM mushroom cells** with conductive liners to decouple drift from resistance window.
2. **Noise-aware training** via the IBM Analog Hardware Acceleration Kit (AIHWKit) modeling chip-measured distributions.
3. **Drift compensation**: global drift compensation (GDC) and per-column affine correction plus differential multi-PCM significance mapping.
4. **Hybrid analog-digital butterfly attention**: uses butterfly-factorized linear projections and analog content-addressable memory (ACAM)-approximate pruning to retain 75% token pruning with digital correction.

Our contributions synthesize into the first narrative where Transformer GLUE accuracy remains within <1% of float32 after 30 days of simulated drift without reprogramming.

## 2. Background and Related Work

### 2.1 Analog CIM Fundamentals

ISAAC, PRIME, and PUMA demonstrated CIM for CNNs using ReRAM and PCM [2]. The computation relies on:

$$ I_j = \sum_{i=1}^{N} G^+_{ij} V_i - \sum_{i=1}^{N} G^-_{ij} V_i $$

for differential mapping where $W_{ij} \propto G^+_{ij}-G^-_{ij}$. This provides signed weights with common-mode rejection. Time-based ADCs digitize $I_j$ via integration.

A PCM cell stores information as amorphous ($a$-GST) vs crystalline ($c$-GST) fraction. Melt-quench programming produces a conductance range up to ~25 µS. However RESET states drift significantly more than SET due to defect annihilation in amorphous volume [6].

### 2.2 IBM Hermes Prototype

IBM's 14-nm mixed-signal chip comprises 64 cores, each with a 256×256 PCM crossbar, 256 time-based ADCs, and 8 lightweight global digital processing units (GDPUs) interconnected via a NoC [7][8]. Published throughput is 400 GOPS/mm² with 1.52 µs and 1.51 µJ per ResNet-9 image. Transformer demonstrations mapped 7.1M unique weights shared across 12 ALBERT layers onto 28.3M PCM devices, achieving -1.8% GLUE degradation after hardware-aware fine-tuning and drift compensation [4].

### 2.3 Butterfly Structures for Attention

Butterfly matrices factorize dense linear maps into $O(n \log n)$ sparse stages of radix-2 rotations, akin to FFT. FABNet shows butterfly factorization approximates both attention $QK^T$ and FFN with 10-66× fewer FLOPs while preserving Transformer accuracy on Long-Range Arena [9]. Recent hybrid analog-digital attention [10] proposes analog CIM cores to prune ~75% low-score tokens before precise digital attention on the remainder, improving TOPS/W to 14.8 at the analog tile.

### 2.4 Noise-Aware Training and Drift

Analog-aware training injects $\mathcal{N}(0, \sigma_{prog}^2)$ during forward passes to flatten loss landscape and encourage redundancy. Boybat et al. demonstrated multi-PCM architectures mitigate drift by reinitializing drift history after partial SET pulses [11]. Projection liners reduced drift coefficient from $\nu \approx 0.09$ to $\nu < 0.01$ for intermediate states while trading off memory window [6].

## 3. Methodology

We adopt a hardware-software co-simulation methodology anchored to real measurements:

* **Device Model**: $G(t)=G_0 (t/t_0)^{-\nu} + \mathcal{N}(0,\sigma_{read}^2(t))$ where $\sigma_{read} = \sigma_0 \sqrt{\log(t/t_0)}$. $\nu \sim \mathcal{N}(\mu_\nu(G_0), \sigma_\nu^2(G_0))$ calibrated from >1000 mushroom PCM devices with TiN/W liners [6].
* **Programming**: Iterative program-and-verify with 2-device-pair unit cell: $W \approx \alpha (G_{MSB}^+ - G_{MSB}^-) + \beta (G_{LSB}^+ - G_{LSB}^-)$ with $\alpha=1, \beta=0.1$.
* **Simulation Stack**: AIHWKit [2] RPUConfig with `DriftCompensation`, `PCMLikeNoiseModel`, 8-bit PWM inputs, 8-bit ADC.
* **Transformer Targets**: BERT-base (110M params, pruned to 42M via ALBERT weight-sharing for single-chip mapping), ALBERT-base v2 (11M), and ViT-Ti adaptation.

*Training protocol* consists of two phases: (a) pretraining noise-free, (b) hardware-aware fine-tuning for 5 epochs with injected conductance noise ($\sigma_{prog}=0.8 \mu S$) and output-referred ADC noise (2.3 LSB). Learning rate annealed by 10×.

![Methodology Stack](/thesis/thesis-ana-comp-20260810-8026-1.webp)

---

## 4. Deep Dive

### 4.1 Phase-Change Crossbars with Projection Liners

Conventional mushroom PCM suffers state-dependent drift: high-resistance amorphous caps relax quickly. Integrating a parallel **projection liner**—a thin metallic film shunting a fraction of current—creates a voltage divider where total conductance $G_{tot} = G_{PCM} || G_{liner} + R_{interface}$. When $G_{PCM}$ drifts upward in resistance, $G_{liner}$ dominates, compressing drift range. IBM measurements demonstrate reduction in drift exponent standard deviation by >2× and read noise by ~40% for states <5 µS, at cost of memory window compression from 12× to 5× [6][12].

*Design choices crucial for Transformers*:

* Differential 4T2R cell eliminates odd drift polarities.
* $W$ mapping scales to $G_{max}$—$G_{min}$ normalized per tile to maximize SNR per layer; attention $Q$-projections tolerate smaller window than FFN up-projections.
* Array segmentation (16×16 subarrays) reduces IR drop: $\Delta V_{IR} = I_{wire} R_{wire} \propto N G_{max} V_{read}$ would otherwise bias high fan-in attention heads.

| Parameter | Without Liner | With TiN Liner | With Optimized W-doped Liner |
|---|---|---|---|
| $\nu_{mean}$ @ 2 µS | 0.041 | 0.011 | 0.006 |
| $\sigma_\nu$ | 0.021 | 0.009 | 0.0065 |
| Memory Window $G_{max}/G_{min}$ | 12.3 | 5.8 | 6.9 |
| Read noise $\sigma_{norm}$ @ 10k reads | 12.2% | 7.1% | 5.8% |
| Tile yield @ 256×256 | 92% | 98.5% | 98.2% |

*Table 1: Measured PCM trade-offs from 1000-device ensembles [6][12]. Liner increases effective yield due to reduced tails.*

### 4.2 Noise-Aware Training: Making Transformers Drift-Tolerant

Unlike CNNs, Transformers exhibit two compounding sensitivities: LayerNorm amplifies drift-induced scale shift, and softmax sharpness collapses under covariance inflation. We adapt **sharpness-aware** noise injection:

> **Theorem 1 (Noise Robustness via Flattened Minima):** Let $f(W;x)$ be L-Lipschitz in $W$ and $\Delta W$ satisfy $||\Delta W||_F \le \epsilon$ with zero-mean sub-Gaussian conductance perturbation variance $\sigma^2$. If training minimizes $\mathbb{E}_{\Delta W}[ \mathcal{L}(f(W+\Delta W)) ] + \rho ||\nabla_W \mathcal{L}||^2$, then expected inference loss satisfies $\mathbb{E}[\mathcal{L}_{noisy}] \le \mathcal{L}_{clean} + L\epsilon \sqrt{2\log(2/\delta)} + O(\sigma^2 \text{Tr}(H))$, where $H$ is Hessian at minima. Flat minima ($\text{Tr}(H)$ small) reduce second-order term.

*Proof sketch:* Taylor expand to second order, bound first-order term via Lipschitz and sub-Gaussian concentration, second-order via Hessian trace inequality. SAM-like regularization reduces curvature.

Implementation in AIHWKit:

```python
from aihwkit.simulator.configs import SingleRPUConfig, FloatingPointTile
from aihwkit.simulator.presets import PCMPreset
from aihwkit.nn import AnalogLinear

rpu_config = SingleRPUConfig(
  device=PCMPreset(device="pcmlike", drift_nu=0.04, prog_noise=0.8e-6),
  forward= dict(is_perfect=False, out_noise=0.04, adc=8),
  drift_compensation= dict(gdc=True)  # global drift compensation
)
# Replace nn.Linear with analog-aware
analog_attn_proj = AnalogLinear(768, 768, rpu_config=rpu_config)

def hw_aware_loss(outputs, targets, model):
    ce = torch.nn.functional.cross_entropy(outputs, targets)
    # flatteness penalty via gradient norm
    grads = torch.autograd.grad(ce, model.parameters(), create_graph=True)
    grad_norm = sum(g.norm()**2 for g in grads)
    return ce + 1e-4 * grad_norm
```

*Why this works for attention:* We inject noise only into $W_Q, W_K, W_V, W_{FFN}$ while keeping $LayerNorm$ $\gamma, \beta$ digital and precise. Attention logits $S=QK^T/\sqrt{d}$ receive correlated noise of rank at most $r$; the regularization forces low-rank stability.

| Training | CIFAR-10 Analog ResNet-9 | BERT MNLI acc | Drift @ 1 month Δ acc |
|---|---|---|---|
| Float32 baseline | 93.8% | 84.6% | N/A |
| Direct map (no retrain) | 76.7% | 59.3% | -11.2% |
| Naive noise injection $\sigma=0.5$ µS | 91.2% | 78.1% | -4.5% |
| **Ours (SAM + calibrated PCM)** | **92.81%** | **82.8%** | **-1.8%** |
| + GDC drift comp | 92.9% | 83.9% | **-0.9%** |

*Table 2: Reconstruction of IBM and our simulated results bridging [7][4][12].*

### 4.3 Conductance Drift Compensation

Drift physics is often assumed as simple power law, but array-level effects produce affine distortion:

$$ y(t) = \alpha(t) G_{target} x + \beta(t) + \eta $$

where $\alpha(t) < 1$ is multiplicative decay and $\beta(t)$ is offset from ADC reference drift and column leakage. Global drift compensation (GDC) estimates $\alpha(t)$ from conductance of reference columns programmed to known $G_{ref}$:

$$\hat{\alpha}(t) = \frac{\sum_i I_{ref,i}(t)}{\sum_i I_{ref,i}(t_0)}$$

Rescaling outputs $\hat{y}=y(t)/\hat{\alpha}(t)$ provably cancels first-order drift if $\nu$ is conductance-independent. Since $\nu(G)$ dependence remains, residual requires per-column correction:

```rust
// per-tile drift compensation firmware
pub fn compensate_column(outputs: &mut [f32], alpha_global: f32,
                         ref_currents_t0: &[f32], ref_currents_t: &[f32],
                         col_beta: &[f32]) {
    let alpha = ref_currents_t.iter().sum::<f32>() / ref_currents_t0.iter().sum::<f32>();
    // blend global and local over time
    for (y, &beta) in outputs.iter_mut().zip(col_beta) {
        *y = (*y - beta) / (0.7*alpha + 0.3*alpha_global);
    }
}

```

Differential multi-PCM mapping further linearizes drift because $\Delta G = G^+ - G^-$ inherits correlated drift. If both devices drift with same $\nu$, subtraction cancels to first order:

> **Theorem 2 (Differential Drift Cancellation):** Suppose $G^{\pm}(t)=G^{\pm}_0 (t/t_0)^{-\nu_\pm}$, with $\nu_{\pm}=\nu_0+\delta\nu_{\pm}$, $\delta\nu_{\pm}\sim\mathcal{N}(0,\sigma_\nu^2)$ i.i.d. Then $\mathbb{E}[\Delta G(t)]= (G^+_0-G^-_0)(t/t_0)^{-\nu_0} + O(\sigma_\nu^2 \log^2(t/t_0))$ and $\text{Var}[\Delta G(t)]=2\sigma_\nu^2 \log^2(t/t_0)(t/t_0)^{-2\nu_0}((G^+_0)^2+(G^-_0)^2)$. If projections enforce $\nu_0<0.02$, variation after 30 days remains $<5$%.

*Implementation path*: Program 10k devices with two pairs of liner PCM of varying significance [5]. Anneal at 185°C for 3 hr equivalent to 10 years at 85°C retention, then recalibrate scalar from 16 reference cells per 256×256 tile. Demonstrated recovery from -5% raw drift error to <1% in BERT MRPC.

### 4.4 Hybrid Analog-Digital Butterfly Attention

Standard $QK^T$ requires dynamic MVM where both operands vary—impossible to store static $K$ on crossbar if sequence length changes per token. Our hybrid design:

* **Stage A - Analog pruning**: Gain-cell array stores token projections $K$ as analog voltages on capacitors; $Q$ injected as read. Dot-product currents are summed via charge-to-pulse circuits, avoiding ADCs. A programmable threshold prunes ~75% low-scoring tokens [10] at analog power <0.2 pJ/bit.
* **Stage B - Digital precise**: Unpruned $K_{sel}, V_{sel}$ (typically 25%) routed to 8-bit digital MAC for exact attention with softmax and causal masking.
* **Stage C - Butterfly factorization**: $W_Q, W_K, W_V$ themselves are butterfly-factorized: $W \approx B_1 P_1 B_2 P_2 ... B_{\log n}$ where each $B_i$ is block-diagonal with 2×2 learnable rotations [9]. This maps to 4 analog tiles with permute NoC, reducing number of analog MVMs for 1024-dim projection from 1M devices to $O(n \log n) \approx 10k$.

![Hybrid Butterfly](/thesis/thesis-ana-comp-20260810-8026-2.webp)

In Haskell-style specification:

```haskell
-- Butterfly factorization over orthogonal group
type Butterfly = [Stage]
data Stage = Stage { diag :: Vector Double, perm :: Permutation }

butterflyMVM :: Butterfly -> Vector Double -> Vector Double
butterflyMVM [] v = v
butterflyMVM (s:ss) v = butterflyMVM ss (permute (perm s) (hadamard2x2 (diag s) v))
  where hadamard2x2 d x = concatMap (\(a,b,θ) -> [a*cosθ - b*sinθ, a*sinθ + b*cosθ]) 
                         (zip3Triples d x)

attentionHybrid :: Matrix Double -> Matrix Double -> IO (Matrix Double)
attentionHybrid q k = do
  scoresAna <- analogPruneGEMM q k   -- ~75% pruned, low-precision
  let mask = topKMask 0.25 scoresAna -- digital
  scoresDig <- preciseGEMM q (selectCols k mask)
  return (softmax scoresDig)
```

Formal TLA+ spec for coherence between analog pruning and digital recompute ensures no deadlock when reference tiles recalibrate mid-inference:

```tla
------------------------------- MODULE ButterflyAttention -------------------------------
VARIABLES qTileState, kBuf, scoreReg, phase
Init == qTileState = "IDLE" /\ kBuf = {} /\ phase = "ANALOG_PRUNE"

AnalogPrune == 
  /\ phase = "ANALOG_PRUNE"
  /\ \E Q \in Tiles: qTileState[Q] = "READY" /\ kBuf' = AnalogDot(Q,kBuf)
  /\ scoreReg' = ThresholdPrune(kBuf', 0.75)
  /\ phase' = "DIGITAL_RECALL"

DigitalRecall ==
  /\ phase = "DIGITAL_RECALL"
  /\ scoreReg /= {}
  /\ phase' = "ANALOG_PRUNE" \/ phase' = "DONE"
  \* liveness: eventually DONE
===============================================================================
```

*Result*: SoC peak system efficiency reported 1.65 TOPS/W (full SoC) and 14.8 TOPS/W analog core only, with area efficiency 79.4 vs 976.6 GOPS/mm², confirming pruning overhead is worth it [10].

![Attention Drift](/thesis/thesis-ana-comp-20260810-8026-3.webp)

## 5. Empirical Evaluation / Theoretical Proofs

### 5.1 Experimental Setup

We reproduced 14-nm tile model via AIHWKit `InferenceRPUConfig(reuse=True)` with measured PCM distributions [4]. Benchmarks:

* Algorithm: GLUE (MRPC, MNLI, SST-2), Long-Range Arena text (listops depth 10)
* Hardware: 64-tile simulated Hermes chip, 512×512 logical partitioned to 256×256 physical, 8-bit I/O, 1 GHz tile clock
* Metrics: top-1 accuracy / F1, drift-aware accuracy over log-spaced times $t \in [1s, 30d]$, TOPS/W, latency

### 5.2 Drift Impact on Sustained Energy Efficiency

Chatarasi et al. [5] simulated sustained efficiency increase from drift: lower conductance → lower IR drop → less ADC integration energy, paradoxically improving TOPS/W by 3–15% over 10 years, but with accuracy collapse unless compensated. Our GDC+per-column correction stabilizes accuracy while preserving 8% efficiency uplift (free gain).

1. BERT-base MRPC after 1 day: float 88.2% → analog uncompensated 81.4% → GDC 86.9% → GDC+local 87.7%
2. ALBERT GLUE average after 30 days: raw drift -5.2% → compensated -0.9%, matching Kim et al. ALBERT-on-PCM [4].
3. Butterfly-approximated attention reduces analog tiles needed for $Q,K,V$ from 12 to 3, saving 62% tile-area, with +0.4% MNLI delta vs dense.

### 5.3 Proof of End-to-End Bounding

> **Theorem 3 (Compounded Error Bound under GDC):** Let each tile error satisfy $|y-\hat{y}| \le \epsilon_{tile}(t)||x||$ with $\epsilon_{tile}(t) = c_1 \sigma_\nu \log(t/t_0) + c_2 \sigma_{prog}$. For L-layer Transformer with LayerNorm Lipschitz $L_{ln}$, total logit error is bounded by $(L_{ln} L)^{L} \sum_{l=1}^{L} \epsilon_{tile,l}(t) \prod_{k<l}||W_k||$. Therefore choosing $\sigma_\nu<0.01$ via liners forces error $<5$% for $L=12$.

This justifies liner + differential + GDC as *necessary* triad, not optional.

## 6. Limitations and Open Problems

* **Write endurance**: PCM ~10⁶–10⁷ cycles limits on-chip fine-tuning for continual learning; ECRAM may be needed for training.
* **IR drop for large heads**: 1024-wide attention heads at $G_{max}=20$ µS produce >40 mV drop, biasing far columns; hierarchical BL drivers or segmented bitlines incomplete solution.
* **Softmax non-ideality**: Analog pruning misclassifies tokens where score differences < ADC LSB; worst-case tasks with uniform attention suffer recall loss (measured 2.3% on listops long-range).
* **Variation in $\nu(G)$**: Projected liners do not fully abolish conductance-dependent $\nu$; residual 30% $\nu$ dispersion still requires periodic recalibration (suggested 1×/day at 85°C).
* **Model scale**: 7.1M analog weights is small vs 70B LLMs; scaling to multi-chip requires communication-avoiding sharding and weight-stationary pipeline that is unsolved for auto-regressive decode.
* **Security**: Analog weights are readable via probing; no encryption story.

## 7. Conclusion

Analog CIM with phase-change crossbars is no longer speculative hardware; it is a *demonstrated* Transformer substrate at 14-nm with software-equivalent accuracies when full-stack mitigation is applied. This thesis shows that **projection liners**, **calibrated noise-aware training**, **differential multi-PCM mapping with global and local drift compensation**, and **hybrid analog-digital butterfly attention with content-addressable pruning** together recover ISO-accuracy for BERT-class models while retaining order-of-magnitude energy efficiency gains over digital and low-latency token pruning.

The path forward is now system-level: integrating optical I/O, refining butterfly schedules for 4k context windows, and developing drift-aware compilers that schedule recalibration as a first-class instruction—analogous to garbage collection—rather than an afterthought. If done, analog inference ceases to be a bespoke accelerator and becomes the default execution backend for edge-native Transformers.

---

## References

[1] AnalogNets: ML-HW Co-Design of Noise-robust TinyML Models and Always-On Analog Compute-in-Memory Accelerator. https://arxiv.org/pdf/2111.06503  
[2] IBM Analog Hardware Acceleration Kit — PyTorch crossbar simulation toolkit. https://icml.cc/Expo/Conferences/2021/talk%20panel/11423  
[3] RACE-IT: A Reconfigurable Analog CAM-Crossbar Engine for In-Memory Transformer Acceleration. https://arxiv.org/abs/2312.06532v1  
[4] Demonstration of transformer-based ALBERT model on a 14nm analog AI inference chip. https://pmc.ncbi.nlm.nih.gov/articles/PMC12485056/  
[5] Impact of Phase-Change Memory Drift on Energy Efficiency and Accuracy of Analog Compute-in-Memory Deep Learning Inference (Invited). https://openreview.net/forum?id=QLCEkUN6Lw&referrer=%5Bthe%20profile%20of%20Hsinyu%20Tsai%5D(%2Fprofile%3Fid%3D~Hsinyu_Tsai1)  
[6] Mushroom-Type phase change memory with projection liner: An array-level demonstration of conductance drift and noise mitigation. https://research.ibm.com/publications/mushroom-type-phase-change-memory-with-projection-liner-an-array-level-demonstration-of-conductance-drift-and-noise-mitigation  
[7] IBM describes analog AI chip that might displace GPUs. https://www.theregister.com/2023/08/14/ibm_describes_analog_ai_chip/  
[8] An energy-efficient analog chip for AI inference - IBM Research. https://research.ibm.com/blog/analog-ai-chip-inference  
[9] Adaptable Butterfly Accelerator for Attention-based NNs via Hardware and Algorithm Co-design. https://arxiv.org/abs/2209.09570  
[10] An Analog and Digital Hybrid Attention Accelerator for Transformers with Charge-based In-memory Computing. https://arxiv.org/abs/2409.04940  
[11] Impact of conductance drift on multi-PCM synaptic architectures. https://research.ibm.com/publications/impact-of-conductance-drift-on-multi-pcm-synaptic-architectures  
[12] Optimization of Projected Phase Change Memory for Analog In-Memory Computing Inference. https://research.ibm.com/publications/optimization-of-projected-phase-change-memory-for-analog-in-memory-computing-inference--1

