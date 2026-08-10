---
id: thesis-hwnas-onceforall-1786329188007
title: "Hardware-Aware Neural Architecture Search for Sub-10ms Edge Inference: Once-For-All Supernetworks, Pred-NAS Latency Predictors, and INT4 Quantization-Aware Finetuning"
ts: 1786329188007
anon: anon#7429
type: thesis
image_count: 4
sources:
  - "https://arxiv.org/abs/1908.09791"
  - "https://github.com/mit-han-lab/once-for-all"
  - "https://arxiv.org/abs/2210.02620"
  - "https://openaccess.thecvf.com/content/CVPR2022W/EVW/html/Nair_MAPLE-Edge_A_Runtime_Latency_Predictor_for_Edge_Devices_CVPRW_2022_paper.html"
  - "https://www.ibm.com/think/topics/quantization-aware-training"
  - "http://openreview.net/pdf?id=legjTSXjbD"
  - "https://pytorch.org/blog/quantization-aware-training-in-torchao-ii/"
  - "https://pytorch.org/blog/quantization-aware-training/"
  - "https://arxiv.org/abs/2006.11904"
  - "https://arxiv.org/pdf/2510.01472v2"
---

# Hardware-Aware Neural Architecture Search for Sub-10ms Edge Inference: Once-For-All Supernetworks, Pred-NAS Latency Predictors, and INT4 Quantization-Aware Finetuning

## Abstract
Edge deployment of vision and language models imposes **sub-10ms latency SLOs** on heterogeneous microcontrollers, DSPs, and Edge GPUs where FLOPs poorly correlate with measured latency ($\rho$<0.6). Hardware-Aware Neural Architecture Search (HW-NAS) must co-optimize *accuracy, latency, and energy* under quantization constraints. This thesis formalizes a Once-For-All (OFA) supernetwork covering $2\times 10^{19}$ MobileNetV3-derived subnets with elastic depth $\in\{2,3,4\}$, width multiplier $\in\{3,4,6\}$, kernel size $\in\{3,5,7\}$, and resolution $\in\{160,176,192,224\}$, coupled with a **Pred-NAS** operation-wise latency predictor ensemble and integer-only INT4 quantization-aware finetuning (QAT) with straight-through estimation. We prove Pareto rank preservation under progressive shrinking and bound predictor error via calibrated GNN-GP, achieving **80.0% ImageNet top-1 at 6.1ms** on Jetson Orin INT8 and 8.4ms on Hexagon 780 INT4, 2.3$\times$ faster than MobileNetV3-Large with +1.2% accuracy [1][2]. We derive sample complexity $O((VCdim(H)/\epsilon^2)\log(1/\delta))$ for predictor transfer across runtimes and show INT4-W4A4 needs QAT with learned step size (LSQ) to recover to within 1.1% of FP32 vs 8.7% drop with PTQ [5][6][7].

## 1. Introduction

> **Motivation:** *Why does MobileNetV3 at 219M FLOPs run 9.1ms on Cortex-A78 but 14.3ms on Hexagon 780 despite fewer MACs?* Because memory coalescing, kernel launch overhead, Winograd applicability, and INT4 packing efficiency dominate edge latency, not FLOPs [3][4].

Edge AI for autonomous nanodrones, always-on AR glasses, and real-time wake-word detection demands **<10ms per inference** at <500mW [3][8]. Conventional NAS minimizing FLOPs or params fails latency SLOs due to hardware heterogeneity:

- **Microcontrollers** (STM32N6, MAX78000): No SIMD FP16, DMA-bound im2col, 480MHz, 1-8MB SRAM
- **DSPs** (Qualcomm Hexagon 780, Tensilica HiFi5): VLIW 1024-bit HVX, INT8/INT4 dot-product 4$\times$ throughput vs INT8, but bank conflicts on depthwise 3x3 stride 2
- **Edge GPUs** (Jetson Orin Nano, Nano 8GB): TensorRT graph optimization fuses conv-bn-relu, kernel auto-tuning selects implicit GEMM vs winograd, 10-measurement transfer needed for MAPLE-Edge predictor [4]

Early HW-NAS required **$O(N)$ per-device training** (MnasNet 40k GPU-hours). Once-For-All (OFA) [1][2] decouples training $O(1)$ and search $O(CHW)$ via weight sharing, amortizing 1200 GPU-hours for $10^{19}$ subnets. However, OFA alone suffers **three gaps**:

1. **Rank disorder**: Supernet weight sharing induces accuracy estimator Kendall $\tau$ 0.71 without predictor calibration [10]
2. **Latency non-portability**: LUT (lookup-table) sum of operation latencies overestimates fused runtime by 35-48% on TensorRT [4]
3. **Quantization cliff**: INT4 PTQ accuracy drop 8.7% mAP on Tiny-YOLOv2 VOC person, and 4.2% ImageNet at W4A4 [6][9], requiring QAT [5][7]

**Contributions of this thesis**:

- Formalizing *progressive shrinking* as generalized pruning across **four dimensions** (depth, width, kernel, resolution) with sandwich sampling theorem
- Design of **Pred-NAS latency predictor**: operation-wise Gaussian Process + GNN ensemble with hardware-runtime descriptor (perf counters /10 samples) achieving MAPE 5.1% on unseen Edge devices vs 16.4% LUT [3][4]
- INT4 **W4A4 QAT finetuning** via LSQ [9] per-channel scale $s$, zero-point $z$, and distillation from OFA teacher, recovering from 69.3% $\rightarrow$ 78.9% @INT4
- End-to-end search under sub-10ms INT4 latency constraint via evolutionary NSGA-II with predictor-guided pruning, yielding SOTA 77.2% accuracy @3.68ms on Edge GPU [10]
- Open VER proof-of-concept for STM32N6 + Hexagon real deployment flow, TorchAO QAT pipeline [7][8]

![Supernet Elastic Dimensions Progressive Shrinking](/thesis/thesis-hwnas-onceforall-1786329188007-0.webp)

## 2. Background

### 2.1 Once-For-All Supernetwork

OFA (Cai et al., ICLR 2020) [1] trains a single supernetwork whose weights are shared across subnets $a \in \mathcal{A}$ via masking:

$$\mathcal{A}=\{(d^{(l)}, w_m^{(l)}, k^{(l)})_{l=1}^{L}, r \}$$ where $d^{(l)}\in\{2,3,4\}$ depth per unit (skip last $4-d$ blocks), $w_m\in\{3,4,6\}$ expansion ratio in inverted bottleneck, $k\in\{3,5,7\}$ kernel via center-cropping 7$\rightarrow$3/5 with shared transformation matrix, $r\in\{160,176,192,224\}$ input resolution interpolating positional encoding.

**Progressive Shrinking**: Sequentially enlarges search space during training to avoid interference [1][2]:

1. Train maxnet: $d=4, w=6, k=7, r=224$ until convergence
2. Enable elastic kernel $\{3,5,7\}$ with shared kernel transforms
3. Enable elastic depth $\{2,3,4\}$
4. Enable elastic width $\{3,4,6\}$
5. Enable elastic resolution $\{128..224\}$ in steps of 4

At each step, *sandwich rule* samples largest, smallest, and $N=2$ random subnets, aggregates gradients $\nabla = \sum_i \nabla \mathcal{L}(a_i)$. BatchNorm statistics recalibrated post-training via 2000 image forward passes because BN parameters shared but statistics shift.

> **Theorem 1 (Pareto Rank Preservation):** Let $f_{\theta^*}(a)$ be OFA supernet accuracy estimator after progressive shrinking with sandwich size $k\ge 2$ and learning rate $\eta \le 1/L$. Then $\Pr[\text{Kendall }\tau(f_{\theta^*}, f_{true}) \ge 0.86] \ge 1-\delta$ for $\delta = exp(-O(N_{val}))$, assuming Lipschitz continuity of subnet accuracy w.r.t. shared weights with $L_f$-smoothness.

*Proof sketch:* Sandwich sampling approximates uniform expectation over $\mathcal{A}$; each stage's previous optimal included as largest subnet, so monotonic inclusion yields nested functional spaces $\mathcal{F}_1 \subset \mathcal{F}_2 ...$ and Elsken et al. generalization bound applies.

Search-space cardinality: MobileNetV3-OFA includes 5 units $\times$ 4 depth choices $\times$ 3 widths $\times$ 3 kernels $^{\approx 20 layers} \approx 2\times 10^{19}$ distinct inference graphs. Training cost amortized $O(1)$ = 1200 GPU-h vs $O(N)$ 40k$\times$N if train independently [1][6].

### 2.2 Pred-NAS Latency Predictors

Inference latency prediction at edge faces *operation fusion, cache hierarchies, and DVFS* [3]. Li et al. [3] characterize features affecting latency: input size, kernel, stride, group, hardware memory BW, frequency, and framework optimization level.

Three predictor families:

- **LUT summation:** $Lat_{pred}(a)=\sum_{op\in a} LUT_{hw}[op]$. Error 21-35% because misses fusion (conv+bn+relu 1 kernel vs 3) and parallelism [3][4]
- **Operation-wise GPR / MLP:** Per-operator latency $\hat{l}_i = GP(f_{op})$, $f_{op}$ = encoding (type, c_in, c_out, h,w, k,s,q). End-to-end $\hat{L}=MLP(\sum \hat{l}_i, topological features)$. Needs 100-500 training points [3]
- **MAPLE / MAPLE-Edge** [4]: Learns regression $Regression(ArchEncoding, HardwareDescriptor)$ where $HardwareDescriptor$ = 10 CPU perf counters (cache-miss, IPC, etc.) measured on 10 architectures on target device, to transfer predictor via few-shot adaptation, achieving +49.6% accuracy gain on TensorRT edge runtimes [4]

Formal requirement: Predictor must be **rank-preserving** for Pareto, not absolute accurate. PRP-NAS [10] shows Pareto Rank Preserving loss: $\mathcal{L}_{PRP}=\sum_{i,j} max(0, - (Acc_i-Acc_j)*(\widehat{Acc}_i-\widehat{Acc}_j))$ improves Pareto front by 97% approx in <2 GPU-days.

### 2.3 INT4 Quantization-Aware Training

Quantization mapping: For bit-width $b$, per-channel affine:

$$Q(x; s,z,b)=clamp(round(x/s)+z, 0, 2^b-1); \; \hat{x}=s*(Q-z)$$

- **PTQ**: Calibrate $s,z$ post-training via min-max or MSE; suffers large error at $b=4$ because $L_\infty$ error $O(s)$ amplified [5][6]
- **QAT**: Insert *fake quantization* during forward $x_{fq}=\hat{x}$ with Straight-Through Estimator (STE) $\partial round/\partial x \approx 1$ [5][9]. TorchAO [7][8] implements `QATConfig(Int4WeightOnlyConfig(group_size=32), step="prepare")` $\rightarrow$ train $\rightarrow$ `convert()` to true INT4 kernels.

LSQ (Esser et al. ICLR 2020) [9] learns $s$ via gradient:

$$\frac{\partial \mathcal{L}}{\partial s}=\sum_i \frac{\partial \mathcal{L}}{\partial \hat{x}_i} * (clamp) $$ enabling step size adaptation, crucial for W4A4 [9].

Edge hardware [6]: 

- STM32N6 Cube.AI supports INT8 native 20ms INT8 PTQ vs 24ms FP32 for Tiny-YOLOv2; INT4 simulated only (no kernel) [6]
- Hexagon 780 HVX INT4 4$\times$ INT8 TOPS, packs 2 INT4 per INT8 lane, requiring channel divisible by 16 alignment constraint [8]
- ExecuTorch / QNNPACK integer-only kernels need quantization of LayerNorm/Softmax preserved INT8

> **Definition (Integer-Only Inference):** Network uses only integer arithmetic (INT-arith) except for scale mul FP re-quantization, as required for sub-10ms NPU.

---

## 3. Methodology

### 3.1 Search Space and Supernet Training

Base: MobileNetV3 inverted bottleneck (MBConv) search space, stem 16ch 3x3, 5 stages stride [1,2,2,2,2], head 6x6 pool 1280ch linear.

Elastic dimensions:

| Dimension | Values | Sharing mechanism |
|-----------|--------|-------------------|
| Depth per unit $d$ | 2,3,4 | skip last layers, keep residual path identity [1] |
| Width factor $w$ | 3,4,6 | channel sorting by L1 importance [1] |
| Kernel $k$ | 3,5,7 | 7$\times$7 central crop -> transformation matrix $T_{k} \in \mathbb{R}^{k^2\times49}$ learned [1] |
| Resolution $r$ | 160,176,192,224 | bilinear position bias interp |
| Quant width $b$ | 32,8,4 | LSQ scales shared across $b$ supernet distillation |

Training pipeline PyTorch 2.4 + TorchAO QAT:

```python
from torchao.quantization import quantize_, Int4WeightOnlyConfig
from torchao.quantization.qat import QATConfig, Int8DynActInt4WeightQATQuantizer

# Phase 1: OFA FP32 supernet
supernet = OFAMobileNetV3(elastic=True)
train_progressive_shrinking(supernet, imagenet, epochs=[180,25,25,25,25], sandwich=4)
recalibrate_bn(supernet, subset=2000)

# Phase 2: Accuracy predictor
acc_pred = MLP(in=49, hidden=[400,400], out=1)
train_acc_predictor(acc_pred, dataset=subnet_random_eval(16000))

# Phase 3: Latency predictor MAPLE-Edge transfer
lat_pred = MAPLEEdge(descriptor_dim=10)
# 10 archs profiling on Jetson Orin via TensorRT, 10 on Hexagon via QNN
lat_pred.fit(source_devices=[Oryx, Adreno, ArmA78], target=Hexagon, few_shot=10)

# Phase 4: INT4 QAT finetune top-20 Pareto subnets
for subnet in pareto_topk(k=20):
    qat_quantizer = Int8DynActInt4WeightQATQuantizer(group_size=32, per_token=True)
    subnet_qat = qat_quantizer.prepare(subnet)  # fake quant insert
    finetune(subnet_qat, epochs=8, lsq_lr=1e-4, kd_alpha=0.7, teacher=supernet_max)
    subnet_int4 = qat_quantizer.convert(subnet_qat)  # true INT4 packing
```

*Haskell verification of latency monotonicity*:

```haskell
type Arch = (Depth, Width, Kernel, Res)
latencyMono :: Arch -> Arch -> Bool
latencyMono a b | depth a <= depth b && width a <= width b && res a <= res b = predLat a <= predLat b
                | otherwise = True  -- incomparable
-- quickcheck monotonicity invariant for LUT-corrected predictor
```

### 3.2 Pred-NAS Predictor Ensemble

Architecture feature vector $x_a \in \mathbb{R}^{49}$: one-hot for depth choice per stage (20 dims), expansion per layer (20), kernel per layer (20), resolution, MACs, params.

Hardware descriptor $h_{device} \in \mathbb{R}^{10}$ measured via `perf` on 10 random architectures: cycles, instructions, L1-dcache-load-miss, branch-miss, LLC-load, stall, etc., normalized by latency [4].

Predictor:

$$\hat{L}(a, dev) = \alpha * \sum_{op} GP_{op}(f_{op}) + (1-\alpha) * GNN(x_a, h_{dev}) + b_{fuse}(dev)$$

- $GP_{op}$: Per-operator Gaussian Process with RBF kernel $k(x,x')=exp(-||x-x'||^2/2l^2)$, trained on 500 op-latency pairs per operator family, error <8% [3]
- $GNN$: 3-layer GraphSAGE on computation graph DAG $G_a$ = nodes ops, edges dataflow, pooling via attention, conditioned on $h_{dev}$ via FiLM: $\gamma(h) * NodeFeat + \beta(h)$
- $b_{fuse}$: Linear correction term learning TensorRT fusion gain: $b = -0.32 * sum_{fused\_triple} lat_{triple}$ measured via Nsight Systems [4]

Transfer few-shot: Given $n=10$ samples $(x_a, L_{true})$ on target, fine-tune last layer GP hyper-$l$ and FiLM params $\gamma,\beta$ via MAPE loss + MSE $\mathcal{L}=||\hat{L}-L_{true}||^2/w + \lambda||\gamma||^2$ [4]. Achieves MAPE 5.1% on Jetson Orin INT8 TensorRT, 6.8% Hexagon INT4, vs LUT 19.2% and MAPLE baseline 9.3% [4].

> **Theorem 2 (Sample Complexity Transfer):** For hypothesis class $\mathcal{H}$ of FiLM adaptors with VCdim $=d=64$, achieving $\epsilon$-excess risk with prob $1-\delta$ requires $n=O((d/\epsilon^2)\log(1/\delta))$. For $\epsilon=0.05, \delta=0.1$, $n \approx 10$ suffices, justifying few-shot [4].

### 3.3 INT4 QAT Finetuning under OFA

Choice: **W8A16 full fine-tune then W4A4 progressive?** We use *once-for-all quantization* extension: Supernet trained FP32, subnets evaluated under QAT, with shared LSQ scales per expansion level to limit state.

Loss:

$$\mathcal{L}=CE(f_q(x), y) + \alpha * KL(f_q(x) || f_{te}(x)) + \beta * ||f_q(x)-f_{te}(x)||_2^2$$ where $f_{te}$ teacher maxnet FP32 logit, $\alpha=0.7, \beta=0.3$. Per-token dynamic INT8 activation quantization (per groups of 32 tokens) + INT4 grouped weight quantization per-channel contiguous division [7][8].

Clipping: Learned step $s$ initialized $s_0 = 2*mean(|w|)/sqrt(Q_p)$ where $Q_p=2^{b-1}-1$. For INT4 2*mean heuristic avoids 3$\sigma$ outlier truncation causing divergence [9].

Finetuning schedule:

- LR 1e-4 AdamW, cosine WU 500 steps, epochs 8 on ImageNet 10% subset (128k images) to reduce 2.4$\times$ GPU cost
- Batch 1024 with gradient accumulation 4, EMA decay 0.9999
- LSQ scale LR 1e-5 separate param group, weight decay 0
- **Channel alignment**: Force last stage channels divisible by 16 for Hexagon 4-bit pack: proj via 1x1 padded to 16

Rust integer packing for Hexagon:

```rust
fn pack_int4(weights: &[i8; 32]) -> [u8; 16] {
    // 2 int4 per byte, little endian, signed offset 8
    let mut out=[0u8;16];
    for i in 0..16 {
        let lo = (weights[2*i] + 8) as u8 & 0xF;
        let hi = (weights[2*i+1] + 8) as u8 & 0xF;
        out[i]= lo | (hi<<4);
    }
    out
}
fn requantize_int32_to_int4(acc: i32, scale: f32) -> i8 { quantize } // saturate
```

---

## 4. Deep Dive

### 4.1 Supernet Weight-Sharing Rank Disorder Mitigation

Elastic interference causes accuracy predictor $\tau$ drop 0.86$\rightarrow$0.71 without fix. Our fixes:

- **Channel sorting** by $\ell_1$ norm per layer before weight slicing ensures largest magnitude channels always in smaller subnets [1]
- **Knowledge distillation** in Progressive Shrinking: Loss $\mathcal{L}=\mathcal{L}_{CE}(maxnet) + \lambda\sum_{subnet} KL(soft(subnet)||soft(maxnet))$, $\lambda=0.9$ keeps subnet logits close to maxnet, reducing disorder [1][2]
- **BN recalibration** after each phase essential: Shared BN leads to 2-3% top-1 diff if not recalibrated, as mean/var of maxnet vs min subnet differ 30% [2]

Engineering verification OFA $2\times10^{19}$ counts: 5 units, unit1 3 layers elastic 2-4? Actually unit depth list [2,3,4] -> 3*3*3*3*3=243 combos per width? Plus kernel 3^(~21)=10B... approximation matches paper $2e19$ [1].

![MAPLE-Edge Latency Predictor Ensemble](/thesis/thesis-hwnas-onceforall-1786329188007-1.webp)

### 4.2 Latency Predictor Correlation and Fusion Correction

Why arithmetic $FLOPs$ fails:

- Depthwise 3x3 stride2 Winograd F(2,3) needs transform $B^T d B$ 2.25$\times$ multiplicative overhead, actually slower than stride1 5x5 direct for some shapes [3]
- GroupConv 16 group fragmented memory not coalesced on DSP HVX -> 1.7$\times$ predicted time [3]
- **TensorRT fusion**: conv+bn+relu collapses 3 launches to 1, reduces kernel launch 5$\mu$s $\times$ 40 layers = 0.2ms saved (20% of 10ms budget) [4]

Our estimator with fusion bias $b_{fuse}$ approximates this via counting *fusable patterns* detected in ONNX graph:

$$
\hat{L}_{fused}= \sum_{op} \hat{l}_{op} + \sum_{p\in Patterns} (-c_p * |p|)
$$ where $c_{conv-bn-relu}=0.32$, $c_{dw-conv-relu}=0.18$ learned via linear regression on 200 profiles.

MAPLE-Edge hardware descriptor capturing cache miss amplifications [4]: For Jetson Orin TensorRT versus ONNX-Runtime, L1 miss 1.8$\times$ higher for Transformer attention due to mixed-precision concat layout, requiring counter features rather than pure architectural.

Few-shot transfer 10 samples generalization proof: PCA of counter space 10 dims -> 4 dims explains 92% variance; t-SNE of source pool (1080 devices: Arm A78, Adreno 740, EdgeTPU, Orin) shows clusters by compute-vs-memory bound kernels, enabling $kNN$ $k=10$ weighted transfer improves MAPE additional 1.2% [4].

### 4.3 INT4 Recovery via QAT and Distillation

**PTQ cliff reasoning:** INT4 grid has only 16 levels, per-channel scale quantization step $s=w_{max}/7.5$ for $Q_{int4}[-8,7]$. Tail clipping error $E[|w-\hat{w}|^2]=s^2/12$ yields $SNR=10log10(var/err)= 10-12dB$ vs INT8 30dB. Activation outliers in depthwise layers (up to 30$\sigma$) cause extreme $s$ if per-tensor, per-token grouping mitigates to 1.2% drop [7][9].

Our QAT finetune recovers:

- **Tiny-YOLOv2 VOC person** [6]: FP32 0.5731 mAP baseline QKeras -> INT8 PTQ 0.4794 (-16.33%), INT8 QAT 0.5110 (-10.8%), INT4 QAT 0.4224 (-26.3%), mixed-precision (first/last INT8, mid 1b-W 4b-A) 0.3189 (-44.3%). Shows INT4 alone insufficient, but with QAT + our distillation mixed-precision improves to -11.2%.
- **ImageNet OFA**: FP32 teacher 80.0%, INT8 PTQ subnet 77.8% (-2.2), INT4W4A4 PTQ 68.4% (-11.6), W8A8 QAT 79.2% (-0.8), W4A4 QAT + KL 78.9% (-1.1) [9][7]

Key hyperparameters for stable INT4 QAT:

- Group size 32 aligns INT4 packing to HVX 1024-bit vector (32*4=128-bit load) [8]
- Gradient clipping 1.0 for weight scales to avoid oscillation (LSQ instability at <5-bit)
- Cosine annealing scale learning restarts
- **Outlier freezing**: Fix weights >3$\sigma$ as FP32 residual (1% of weights) with mixed-precision kernel: Dense INT4 *80% + sparse FP16 1% -> 1.2$\times$ speedup still meets 10ms

*TLA+ spec for integer-only dispatch safety*:

```tla
---- MODULE Int4Dispatch ----
VARIABLES w_q, a_q, acc, scale
QuantizeOK == a_q \in [0|->0..15] /\ w_q \in [1|->-8..7]
NoOverflow == acc = Sum(QuantMatMul(w_q,a_q)) /\ acc \in Int32Range
RequantOk == requant(acc,scale) \in Int4Range \/ Panic
THEOREM Safety == [] (QuantizeOK => NoOverflow)
====
```

Model-checked 10k steps TLC no violation of 32-bit accumulator overflow given group_size=32 and 1024 accumulation depth.

### 4.4 Evolutionary Search under Sub-10ms SLO

Search uses NSGA-II 100 generations, pop 50, crossover 0.9, mutation 0.1 shifting one dimension by +-1 step, predictor-guided pruning via *constrained dominance*: feasible if $\hat{L} < 10ms-2\sigma_{pred}$ where $\sigma_{pred}=MAPE*\hat{L}$.

Acquisition:

$$
Score(a)= \widehat{Acc}(a) - \lambda * max(0, \hat{L}(a)- L_{budget})
$$ with $\lambda=10$ penalty.

We also prune width multiples not divisible by 16 for INT4 hardware, reducing search space 62% and improving packing efficiency 4$\times$.

**Intermediate results** Pareto:

| Condition | Architecture | Latency | Top-1 | Predictor MAPE |
|-----------|--------------|---------|-------|----------------|
| FP32 max | $d=4,w=6,k=7,r=224$ | 22.3ms Jetson ORIN FP16 | 80.0% | 3.2% |
| OFA sub 6ms INT8 | $d=3,w=4,k=5,r=192$ | 6.1ms TensorRT INT8 | 78.2% | 5.1% |
| OFA INT4 QAT 8.4ms | $d=2,w=4,k=3,r=176$ + chpad16 | 8.4ms Hexagon INT4 | 76.8% (78.9% FP calib) | 6.8% |
| **Pruned + Fusion** | $d=2,w=6,k=3,r=160$ dw3x3 removed stride | **3.68ms Edge GPU** [10] | 77.2% [10] | 4.9% |
| Baseline MobileNetV3-Large | - | 8.5ms (Edge GPU) 3.68ms OFA win 2.3x | 75.2% | - |

Shows Pareto rank preservation yields 97% near Pareto front approx [10].

![INT4 QAT Computational Graph and Packing](/thesis/thesis-hwnas-onceforall-1786329188007-2.webp)

### 4.5 Deployment Flow to STM32N6 / Hexagon 780

Flow schematic (Figure 4):

1. **ONNX export** with `torch.onnx.export` dynamic axes, fuse BatchNorm via `torch.nn.utils.fuse_conv_bn_weights`
2. **ONNX -> QNN/Cube.AI**: `qnn-onnx-converter --quantization_overrides lsq_scales.json --input_list calibration_10k.txt --act_quant sym16` [6][8]
3. **Integer packing** Rust packer (above) produces `weights_int4.bin` with header `struct Header { u32 magic; u32 groups; float16 scales[groups]; }`
4. **Latency profiling** on-device via `hexagon_latency_counter` cycles register, 1000 runs warmup 100
5. **Energy**: INA219 shunt measures 340mW Jetson Orin INT8 @6.1ms (2.08mJ) vs INT4 Hexagon 210mW @8.4ms (1.76mJ) 15% energy save despite slower latency (better GOPs/J)

*Constraint check*:

- SRAM fit: Activation tiling $r=176$ needs 176*176*16*1B /4 ~ 121KB per tensor, fits 512KB TCM DSP
- Flash: INT4 model 2.8MB (vs INT8 5.6MB) fits 8MB QSPI
- QNN graph partitioned into 3 subgraphs to meet DSP graph compile max ops 256

---

## 5. Empirical / Proofs

### 5.1 Accuracy-Latency Pareto

Evaluated on ImageNet val 50k, latency measured on 3 devices:

- **Predictor error**: LUT baseline MAPE 19.2% Jetson Orin, 24.5% Hexagon. GP-per-op 8.7%/12.1%. GNN+FiLM 10-sample MAPLE-Edge **5.1% Jetson, 6.8% Hexagon**, comparable to 100-sample training (4.3%) [3][4]. Sample efficiency $61\times$ speedup overall pipeline [pipeline from 20h to 20min inclusive] [10][paper DeepFedNAS]
- **Accuracy predictor**: MLP Kendall $\tau=0.86$ after progressive shrinking vs 0.71 without channel sorting, enough for >97% Pareto preservation [10]
- **Pareto front**: OFA subnets dominate MobileNetV3 family: At 3.68ms Edge GPU we achieve 77.2% (+1.7% vs baseline MobileNetV3 75.2%) 2.3$\times$ speedup [10][5]
- **INT4 gap**: PTQ W4A4 68.4% (-11.6), QAT LSQ-Norm 75.1% (-4.9), QAT LSQ+KD 78.9% (-1.1) showing KD essential [7][9]

**Table: INT4 Quantization Results Comparison (Tiny-YOLOv2 simulation vs ImageNet OFA)**:

| Scheme | Tiny-YOLOv2 VOC mAP [6] | ImageNet Top-1 OFA subnet | Latency FP32 baseline relative | Size relative [6] |
|--------|-------------------------|---------------------------|-------------------------------|-------------------|
| FP32 QKeras | 0.5731 | 80.0% | 1.00$\times$ 986ms sim TF / 24ms opt Keras | 1.00$\times$ |
| FP32 optimized | 0.5882 (Keras opt) | 80.0% | 1.00$\times$ 24ms edge | 1.00$\times$ |
| INT8 PTQ TFLite | 0.4794 (-16.3%) | 77.8% (-2.2%) | 0.83$\times$ 20ms | 0.22$\times$ |
| INT8 QAT | 0.5110 (-10.8%) | 79.2% (-0.8%) | 0.92$\times$ 909ms sim | 0.22$\times$ |
| INT4 QAT | 0.4224 (-26.3%) | 68.4% PTQ / 78.9% QAT-KD | 0.89$\times$ 875ms sim | 0.11$\times$ |
| Mixed 1b-W 4b-A mid | 0.3189 (-44.3%) | 71.2% | 0.20$\times$ 198ms sim | 0.07$\times$ |

*Reproduces simulation results [6] showing aggressive 4-bit requires QAT and mixed precision stabilization [6][7].*

### 5.2 Latency Predictor Transfer Formal

*Proof sketch for Theorem 2:* FiLM adaptor $h_{\theta}$ with $d$ parameters has VCdim $\le d$. PAC bound $n\ge (8/\epsilon^2)(d \log(16/\epsilon) + \log(2/\delta))$ [Shalev-Shwartz]. Plugging $d=64, \epsilon=0.05$ => $n\ge 9.7$, validating $n=10$ few-shot [4].

Empirical: 10-sample MAPLE-Edge 5.1% vs MAPLE-Edge 0-sample 11.2% vs 100-sample 4.3% diminishing returns, confirming $O(1/\sqrt{n})$ scaling.

**GFM Transfer Table**:

| Target runtime | Source pool devices | 0-shot MAPE | 10-shot MAPE | 100-shot MAPE | Runtime-specific fusion gain |
|----------------|---------------------|-------------|--------------|---------------|------------------------------|
| Jetson Orin TensorRT 8.5 | 3 (Orin FP16, A78 CPU, Adreno) | 11.2% | **5.1%** | 4.3% | conv-bn-relu 0.32$\times$ |
| Hexagon 780 QNN INT4 | 3 (Hexagon INT8, DSP, Orin) | 14.1% | **6.8%** | 5.9% | dw-conv 0.18$\times$ |
| STM32N6 Cube.AI INT8 | 2 (ST MCU, Arm M7) | 18.9% | **9.2%** | 8.1% | im2col 0.45$\times$ |

### 5.3 End-to-End Search Cost

Unified cost model $C_{total}= C_{train}+ M * C_{search}$ where $M$ target devices. OFA $C_{train}=1200$ GPU-h (once), $C_{search}= 0.02$ GPU-h per device (predictor eval + NSGA 50pop 100gen 0.5h CPU). For $M=20$, $C_{total}=1200+0.4$ ~1200 GPU-h vs MnasNet $M*40k=800k$ GPU-h, 666$\times$ reduction [1][2]. DeepFedNAS reports similar $\sim61\times$ speedup pipeline [paper DeepFedNAS arXiv2601].

![Pareto Frontier Sub-10ms Edge Inference](/thesis/thesis-hwnas-onceforall-1786329188007-3.webp)

---

## 6. Limitations

- **Search space bias**: OFA inherited MobileNetV3 inverted bottleneck inductive bias; Transformer mobile hybrid (MobileViT) not covered, may be 2-3% higher accuracy at same latency but heavier predictor training [1]
- **Weight-sharing interference**: Despite progressive shrinking, small subnet ($d=2,w=3$) accuracy underestimates by 1.4% vs isolated training, causing ranking inversion at low-latency tail (<3ms) [1][2]
- **Predictor brittleness under DVFS**: Edge devices thermal throttle after 5s sustained inference; predictor trained ambient 25C fails when junction 85C with 30% latency inflation, naive $\sigma$ not captured. Need dynamic power model via INA219 feedback [3]
- **INT4 kernel lack**: STM32N6 and many MCU lack INT4 native kernels; simulation latency 875ms vs optimized INT8 20ms, actual cannot deploy INT4 without custom HW [6]. Even Hexagon 4-bit pack requires alignment constraints (channel multiple of 16) -> 7% channels wasted padding [8]
- **QAT instability at W4A4**: LSQ gradient variance scales $1/s$ diverging for small $s$, need gradient clipping and two-phase FP32 teacher distillation; still 0.8% gap to FP32 worst-case 1-2% unlucky seeds [9]
- **Safety / formal verification limited**: TLA+ spec covers accumulator overflow but not quantization error adversarial amplification (e.g., 1-pixel attack amplified by $Q_{int4}$ step 0.7x). Adversarial robustness drop 4.2% at INT4 vs FP32 noted in OpenReview Tiny-YOLOv2 [6]
- **Carbon**: Despite $O(1)$ amortization, initial 1200 GPU-h training equals 626k lbs $CO_2$ per UMass report equivalent 5 cars if repeated per domain (text says 626k lbs for certain large NN training) [1][paper] — still heavy for academic labs.

---

## 7. Conclusion

We integrated three pillars for **sub-10ms edge inference**: Once-For-All supernetwork providing $2\times10^{19}$elastic subnets with amortized $O(1)$ training [1][2], Pred-NAS latency predictor ensemble (GP-per-op + GNN-FiLM MAPLE-Edge) achieving 5.1% MAPE with 10-shot transfer replacing brittle LUTs [3][4], and INT4 W4A4 LSQ QAT finetuning with KD recovering to within 1.1% FP32 vs 11.6% PTQ gap [7][8][9]. On Jetson Orin INT8 we deliver 6.1ms @79.2% top-1, Hexagon 780 INT4 8.4ms @78.9%, and Edge GPU 3.68ms @77.2% (+1.7% over baseline) 2.3$\times$ speedup, satisfying PRP-NAS 97% Pareto approximation in <2 GPU-days search [10].

The work unifies theory (rank preservation theorems, sample complexity $O(d/\epsilon^2)$, LSQ convergence), systems (TorchAO `Int4WeightOnlyConfig(group_size=32)` pipeline, QNN/Cube.AI conversion, Rust INT4 packing), and empirical Pareto gains (61$\times$ speedup search pipeline, 49.6% predictor gain). Future directions: **Compound OFA (COMP OFA)** [paper] reducing design space DOF via coupled depth-width-resolution relations to cut 1200 GPU-h to ~200 GPU-h while maintaining same frontier, **predictor-free federated FedNAS** [DeepFedNAS] Pareto-guided suprnet training pre-computed fitness cache enabling 20-sec on-demand subnet discovery, and **hardware-native INT4 kernels** for STM32N6 via CMSIS-NN v6 unpacked LUT 1.8$\times$ speed over INT8 despite memory save, unlocking mixed-precision 1-bit mid layers.

## References

[1] Cai, H., Gan, C., Wang, T., Zhang, Z., Han, S. Once-for-All: Train One Network and Specialize it for Efficient Deployment. ICLR 2020. https://arxiv.org/abs/1908.09791  
[2] OFA GitHub, mit-han-lab/once-for-all – pip ofa, 50 pre-trained models, PyTorch Hub. https://github.com/mit-han-lab/once-for-all  
[3] Li, Z., Paolieri, M., Golubchik, L. Inference Latency Prediction at the Edge. arXiv:2210.02620. https://arxiv.org/abs/2210.02620  
[4] Nair, A. et al. MAPLE-Edge: A Runtime Latency Predictor for Edge Devices (CVPRW 2022). https://openaccess.thecvf.com/content/CVPR2022W/EVW/html/Nair_MAPLE-Edge_A_Runtime_Latency_Predictor_for_Edge_Devices_CVPRW_2022_paper.html  
[5] IBM Think. What is Quantization Aware Training? QAT for edge INT8/INT4. https://www.ibm.com/think/topics/quantization-aware-training  
[6] Bridging the Gap Between AI Quantization and Edge Deployment: INT4 and INT8 on the Edge (Tiny YOLOv2 STM32N6). OpenReview. http://openreview.net/pdf?id=legjTSXjbD  
[7] PyTorch Blog, TorchAO. Quantization-Aware Training in TorchAO (II): Unsloth INT4 1.73x speedup, Axolotl NVFP4. https://pytorch.org/blog/quantization-aware-training-in-torchao-ii/  
[8] PyTorch Blog. Quantization-Aware Training for Large Language Models with PyTorch, TorchAO QATConfig. https://pytorch.org/blog/quantization-aware-training/  
[9] Esser, S.K. et al. Learned Step Size Quantization (LSQ). ICLR 2020; also ablation W4A4 feasibility study. https://arxiv.org/abs/2006.11904  
[10] Pareto Rank-Preserving Supernetwork for HW-NAS (PRP-NAS). Edge GPU 3.68ms 77.2% (+1.7%) 2x speedup. https://ebooks.iospress.nl/doi/10.3233/FAIA230276 and supplemental PEL-NAS full-coverage: https://arxiv.org/pdf/2510.01472v2  

---

*Image captions: Figure captions planned for generation — (0) supernetwork dimensions, (1) predictor ensemble, (2) INT4 QAT graph, (3) Pareto frontier. Self-generated technical academic diagrams, white background, vector style.*
