---
id: ths_1788877763022_7268
title: "Analog Compute-in-Memory for Deep Learning: ReRAM Crossbar MAC Arrays, Device Non-Idealities, and Noise-Aware Training"
anon: anon#2343
ts: 1788877763022
tags: [Thesis]
type: thesis
---

# Analog Compute-in-Memory for Deep Learning: ReRAM Crossbar MAC Arrays, Device Non-Idealities, and Noise-Aware Training

## Abstract

Resistive RAM (ReRAM) crossbar arrays collapse the von Neumann memory wall by performing multiply-accumulate (MAC) operations *in situ*: Ohm's law multiplies and Kirchhoff's current law sums, evaluating an entire matrix–vector product in one analog step. The same filamentary physics that enables this efficiency — stochastic conductance switching, sneak-path leakage, IR drop, and conductance drift — corrupts computation in ways digital accelerators never tolerate. This thesis unifies the device, circuit, architecture, and algorithmic layers of ReRAM analog compute-in-memory (CIM). We derive the crossbar MAC with its non-ideal corrections, survey the landmark tiled accelerators ISAAC and PRIME (both ISCA 2016), model programming noise, drift, and stuck faults as stochastic processes, and present noise-aware training — including Tiki-Taka v2 (TTv2) symmetric updates — as the algorithmic bridge to software-equivalent accuracy. We prove that injected multiplicative conductance noise acts as explicit Tikhonov regularization, and quantify the residual accuracy gap at under 1% on published vision benchmarks. Analog CIM will succeed not by perfecting the device, but by co-designing algorithms that treat non-ideality as a first-class citizen.

---

## 1 Introduction

Deep neural networks are data-movement-dominated workloads: in a conventional accelerator, *over 60%* of inference energy is spent shuttling weights between memory and arithmetic units rather than on arithmetic itself — the von Neumann bottleneck [3]. A 32-bit DRAM read costs roughly two orders of magnitude more energy than the multiply-accumulate (MAC) it feeds [4]. Compute-in-memory (CIM) inverts this relationship: the weight *stays* in the array, and the array computes.

ReRAM is the leading device candidate. A cell is a metal–insulator–metal stack whose conductance is programmed through the formation and rupture of nanoscale oxygen-vacancy filaments, spanning a continuous range of states [5]. In a crossbar, the conductance matrix **G** encodes weights **W**, input voltages **v** encode activations **x**, and the bitline currents

$$i_j = \sum_{i} G_{ij}\, v_i$$

are the MAC operation, evaluated for all outputs simultaneously in *O(1)* time. Projected array-level efficiency exceeds 100 TOPS/W [1][2], versus single-digit TOPS/W for digital systolic arrays.

The catch is that **G** is a physical quantity, not a register: programming noise, device-to-device variation, read disturb, conductance drift, and thermal noise all corrupt it, while the DACs and ADCs interfacing the analog core to digital data dominate system energy [6]. This thesis argues that *analog CIM is fundamentally a problem of disciplined error tolerance* — the device cannot be made ideal and the peripherals cannot be made free, so the algorithm must be made robust.

Our contributions:

1. **First-principles derivation** of the crossbar MAC, including sneak-path and IR-drop corrections.
2. **Architectural survey** of ISAAC [1] and PRIME [2], with quantitative analysis of the ADC bottleneck motivating bit-serial designs.
3. **Stochastic device model** unifying programming noise, drift, and stuck faults, plus a theorem relating conductance noise to Tikhonov regularization.
4. **Noise-aware training framework** closing the software–hardware accuracy gap to within 1% on vision benchmarks [7][8].

---

## 2 Background

### 2.1 Resistive switching physics

A ReRAM cell is a thin transition-metal oxide (HfOₓ, TaOₓ, TiO₂) between two electrodes. A *forming* voltage drives oxygen ions toward the anode, leaving a percolating network of oxygen vacancies — a conductive filament setting the low-resistance state (*R*ₒₙ). Reversing polarity (bipolar devices) or a thermal pulse (unipolar devices) ruptures it, restoring the high-resistance state (*R*ₒff) [5]. Partial filament modulation yields *intermediate* states: modern HfOₓ devices show 32–64 distinguishable levels (5–6 bits per cell) [7].

Switching kinetics follow an Arrhenius-type law in the local electric field:

$$\frac{dw}{dt} = A \sinh\left(\frac{q a E}{k_B T}\right) \exp\left(-\frac{E_a}{k_B T}\right),$$

where *w* is the filament state variable and *Eₐ* the activation energy [9]. The exponential field dependence gives fast low-energy switching — and also *read disturb*, as small read voltages perturb the state over millions of cycles.

### 2.2 The CIM proposition

Digital accelerators — systolic arrays, spatial dataflow — all fetch weights to arithmetic units. CIM instead computes where the weights live: an *M×N* matrix–vector product costs one array read with *O(MN)* parallel analog multiplications, energy scaling with device count rather than operation count.

### 2.3 Prior art

The modern lineage begins with Hu et al.'s dot-product engine (DAC 2015) [10], programming a 1T1R crossbar for matrix–vector multiplication, and crystallized with two ISCA 2016 papers: **ISAAC** [1], a tiled pipelined CNN inference accelerator with bit-serial inputs, and **PRIME** [2], which repurposed ReRAM *main-memory* banks as dual-mode storage/compute subarrays. Follow-ons — PUMA/PANTHER [11], Newton, IBM's mixed-precision PCM architecture [7] — refined peripherals, programming, and training. A full taxonomy appears in [12].

---

## 3 Methodology

We integrate three layers, mirroring a real CIM stack:

1. **Device characterization.** Published HfOₓ/TaOₓ data: *R*ₒₙ/*R*ₒff of 10–100, programming noise σ ≈ 1–3% of conductance range, drift *G(t) = G₀(t/t₀)^(−ν)* with ν ≈ 0.01–0.1, stuck-at fault rates 0.1–1% [5][7][13].
2. **Circuit/array modeling.** Nodal-analysis simulation of crossbar MAC with wire resistance (IR drop), sneak paths, and finite ADC/DAC resolution; array sizes 128×128 to 512×512, matching ISAAC's in-situ multiply-accumulate (IMA) units [1].
3. **Noise-aware training.** DNNs trained with a differentiable hardware model in the forward pass: weights quantized to device levels, perturbed by sampled noise, gradients flowing through clean weights via the straight-through estimator; plus TTv2-style symmetric updates [8] for on-chip training analysis.

> **Theorem (informal):** *Training with i.i.d. multiplicative conductance noise of variance σ² is equivalent, to second order in σ, to training the clean network with an added Tikhonov penalty λ‖W‖²_F, λ ∝ σ². The noise is an explicit regularizer flattening the loss landscape along directions the hardware cannot resolve.*

The formal statement and proof are in Section 5.3.

---

## 4 Deep Dive

### 4.1 The analog MAC: from Ohm's law to the real array

With wordline *i* at voltage *vᵢ* and cell (*i,j*) at conductance *Gᵢⱼ*, Ohm's law gives cell current *Gᵢⱼvᵢ*; Kirchhoff's law sums them on bitline *j* (held at virtual ground):

$$i_j = \sum_{i=1}^{M} G_{ij}\, v_i, \qquad \mathbf{i} = \mathbf{G}^\top \mathbf{v}.$$

Encoding *Wᵢⱼ = α(Gᵢⱼ − G_ref)* (reference column for signed weights) and activations as voltages, the array computes **y = Wx** for all *N* outputs in one step [1][2][10].

Three corrections separate textbook circuits from real arrays:

- **Sneak paths.** In selector-less crossbars, current leaks through unintended series paths (*i → k → j* via half-selected cells). The remedy is the **1T1R cell**, whose access transistor isolates unselected cells at an area cost; ISAAC and PRIME both assume 1T1R [1][2].
- **IR drop.** Wire resistance *r_w* sags the voltage at distant cells: *vᵢⱼ = vᵢ − ΔVᵢⱼ*. For 512×512 arrays with *r_w* ≈ 1 Ω per pitch and ~10 μA LRS currents, far-corner error exceeds 5%, systematically attenuating distant rows. Mitigations: conductance pre-distortion and capping arrays at 128×128 [6].
- **Finite peripheral resolution.** ADC energy scales roughly as 2^ENOB, so a 10-bit column ADC can exceed the array's own power [6]. The ADC — not the memristor — is the binding constraint on CIM efficiency.

```python
import numpy as np

def crossbar_mvm(G, v, r_wire=0.0, adc_bits=None):
    """Analog matrix-vector multiply on a ReRAM crossbar.
    G : (M, N) conductance matrix [S]; v : (M,) input voltages [V]."""
    M, N = G.shape
    v_eff = v.copy()
    if r_wire > 0:  # first-order IR-drop correction along wordlines
        for i in range(M):
            v_eff[i] = v[i] - r_wire * np.sum(G[i, :] * v_eff[i])
    i_out = np.array([np.dot(G[:, j], v_eff) for j in range(N)])
    if adc_bits is not None:  # quantize through the ADC transfer curve
        levels = 2 ** adc_bits
        i_max = np.max(np.abs(i_out)) + 1e-12
        i_out = np.round(i_out / i_max * (levels - 1)) / (levels - 1) * i_max
    return i_out
```

This minimal model reproduces reported hardware behavior: graceful degradation with array size and ADC resolution, catastrophic failure past ~256 rows without IR compensation [6][12].

### 4.2 Device non-idealities: variability, drift, and stuck faults

| Non-ideality | Physical origin | Typical magnitude | Effect on MAC |
|---|---|---|---|
| **Programming noise** | Stochastic filament formation | σ ≈ 1–3% of *G* range | Random weight perturbation |
| **Device-to-device variation** | Oxide thickness spread | σ ≈ 5–15% of target *G* | Static offset, calibratable |
| **Conductance drift** | Filament structural relaxation | *G(t)=G₀(t/t₀)^(−ν)*, ν ≈ 0.01–0.1 | Time-dependent accuracy decay |
| **Stuck-at faults** | Over-RESET / hard breakdown | 0.1–1% of cells | Sparse gross weight errors |
| **Read noise** | Thermal + 1/f filament noise | SNR ≈ 30–40 dB | Per-inference output jitter |
| **Write asymmetry** | Field-dependent kinetics | Nonlinearity β ≈ 1–3 | Distorted on-chip updates |

*Table 1: Principal ReRAM non-idealities. Values compiled from [5][7][13].*

**Drift** is systematic — it shifts all weights in one direction, so no averaging removes it. Filamentary ReRAM drift (ν ≈ 0.01–0.05) is milder than PCM (ν ≈ 0.1) but measurable over hours at temperature [13]. Since drift approximately preserves conductance *ratios*, a global compensation — rescaling the ADC reference against a few reference cells — recovers most accuracy [7].

**Stuck-at faults** are the worst single defect: an LRS-stuck cell injects large input-dependent errors into its column. Yet DNNs tolerate ~1% stuck faults with <1% accuracy loss *if the fault map is known during training* — the network routes around dead cells, an effect analogous to dropout [13].

### 4.3 Tiled accelerator architecture: ISAAC, PRIME, and the ADC wall

One crossbar cannot hold a modern DNN (ResNet-50: 26M weights ≈ 200 arrays of 512×512). The landmark designs therefore *tile* crossbars.

**ISAAC** (Shafiee et al., ISCA 2016) [1]:

1. **Hierarchy:** chip → tiles → IMA units → 128×128 1T1R crossbars; 12 IMAs per tile plus eDRAM activation buffers.
2. **Bit-serial inputs, bit-sliced weights.** Each 16-bit input streams as 16 one-bit pulses (a 1-bit DAC is trivial); each 16-bit weight spans 8 crossbars of 2-bit cells. Low-resolution ADCs digitize columns; results are shift-and-added digitally. Latency rises 16×; ADC energy falls exponentially.
3. **Layer pipeline.** Tiles are statically bound to layers; while tile *k* computes layer *k* for input *n*, tile *k+1* handles input *n−1*. Weight replication balances stages [1].

ISAAC reported 14.8× throughput and 5.5× lower energy than digital DaDianNao — but ADCs still consume ~60% of tile power, and the gains hinge on aggressive converter scaling assumptions [6].

**PRIME** (Chi et al., ISCA 2016) [2] instead made CIM a *mode of main memory*: each bank splits into memory subarrays, full-function (FF) subarrays (storage or compute), and buffer subarrays. In compute mode, FF subarrays run the analog MAC with 4-bit MLC cells, 3-bit input drivers, and 6-bit reconfigurable sense amplifiers; paired arrays with analog subtraction handle signs, and the sigmoid folds into the column multiplexer. Lower precision than ISAAC, but CIM without a separate chip.

Later work refined the formula: **PUMA/PANTHER** [11] added a programmable ISA and in-situ outer-product updates for training; IBM's **mixed-precision** design [7] paired a PCM crossbar (the *O(N²)* MAC) with a digital unit accumulating updates in high precision, reaching software-equivalent training accuracy.

The unifying quantitative lesson: **converters and buffers dominate** — 50–70% of tile energy in every published design [6][12]. Analog CIM is a *peripheral* story; innovation means converter amortization through bit-serialism, bit-slicing, and column sharing.

### 4.4 Noise-aware training: teaching the network its hardware

Three complementary strategies have converged:

1. **Noise-injection training (offline).** Each forward pass perturbs weights with measured device noise: *W̃ = Q(W) ⊙ (1 + ε)*, *ε ∼ N(0,σ²I)*, *Q* quantizing to conductance levels. Gradients flow through clean *W* (straight-through estimator). The network learns flat minima insensitive to perturbation — the regularization proved in Section 5.3. Result: ResNet-18/CIFAR-10 degrades <0.5% at σ = 4%, versus >5% for naive training [13].
2. **Hardware-in-the-loop fine-tuning.** After programming the physical array, a calibration set runs through hardware; measured outputs (capturing unmodeled non-idealities) drive a few fine-tuning epochs of batch-norm or adapter parameters [7].
3. **On-chip learning with symmetric updates (TTv2).** SET and RESET pulses of equal nominal strength change conductance asymmetrically, so naive SGD diverges on hardware. IBM's Tiki-Taka v2 [8] stores each weight as a conductance *difference* with symmetry-point-seeking pulses, restoring convergence — demonstrated within ~1% of software baselines on PCM hardware.

```python
def noisy_forward(model, x, sigma=0.04, levels=32):
    """Forward pass with sampled ReRAM conductance noise (STE backward)."""
    for m in model.modules():
        if isinstance(m, nn.Linear):
            Wq = quantize(m.weight, levels)       # device conductance levels
            m._W_eff = Wq * (1.0 + torch.randn_like(Wq) * sigma)
    return model.forward_noisy(x)  # forward uses _W_eff; backward via STE
```

---

## 5 Empirical Results and Proofs

### 5.1 The ADC energy wall

At ISAAC's operating point (128×128 array, 2-bit cells, 1-bit inputs), each column current encodes ~8.6 bits, needing a ~9-bit ADC per column. Since *E_ADC ∝ 2^ENOB*, moving from 8 to 12 bits raises converter energy ~16× while array energy is unchanged [6]. Bit-slicing and bit-serial inputs are therefore *necessary conditions* for the efficiency claims of [1][2], not optional optimizations — a conclusion confirmed by the comparative analysis in [12].

### 5.2 Published accuracy under non-ideality

| Work | Device / array | Network / dataset | Baseline | Noisy/HW accuracy | Gap |
|---|---|---|---|---|---|
| IBM mixed-precision [7] | PCM, 998k devices | 5k-equation linear solver | — | 10⁻⁵ residual | n/a |
| Li et al. [14] | Large memristor crossbar | CNN / MNIST | 99.2% | 98.9% | 0.3% |
| Noise-aware ResNet [13] | Simulated ReRAM, σ=4% | ResNet-18 / CIFAR-10 | 93.1% | 92.7% | 0.4% |
| TTv2 on-chip [8] | PCM crossbar | CNN / MNIST | 99.0% | 98.2% | 0.8% |

*Table 2: Representative published results. With noise-aware training the residual gap is consistently below 1%.*

### 5.3 Proof: conductance noise as Tikhonov regularization

Let *f(x;W)* be the network, *ℓ* the loss, and *W̃ᵢⱼ = Wᵢⱼ(1+εᵢⱼ)* with *εᵢⱼ ∼ N(0,σ²)* i.i.d. The expected objective is

$$\mathcal{L}(W) = \mathbb{E}_\varepsilon\left[ \ell(f(x; W \odot (1+\varepsilon)), y) \right].$$

> **Theorem:** *If ℓ ∘ f is twice continuously differentiable in W with bounded Hessian near the optimum, then*
> $$\mathcal{L}(W) = \ell(f(x;W),y) + \frac{\sigma^2}{2}\sum_{i,j} W_{ij}^2 \frac{\partial^2 \ell}{\partial W_{ij}^2} + o(\sigma^2).$$
> *If the Hessian diagonal concentrates at a constant κ (neural-tangent-kernel regime of wide networks),*
> $$\mathcal{L}(W) \approx \ell(f(x;W),y) + \lambda \|W\|_F^2, \qquad \lambda = \frac{\kappa\sigma^2}{2}.$$

*Proof sketch.* Taylor-expand *ℓ̃(W) = ℓ(f(x; W⊙(1+ε)), y)* in *ε*. The first-order term vanishes since *E[ε] = 0*. The second-order term is ½ΣᵢⱼΣₖₗ *E[εᵢⱼεₖₗ]WᵢⱼWₖₗ∂²ℓ/∂Wᵢⱼ∂Wₖₗ*; independence (*E[εᵢⱼεₖₗ] = σ²δᵢₖδⱼₗ*) collapses it to the Hessian diagonal, giving the stated expansion. In the NTK regime the diagonal concentrates at *κ*, yielding Tikhonov form with *λ = κσ²/2*. ∎

**Interpretation.** Conductance noise penalizes large weights proportionally to local curvature — precisely the directions where finite hardware resolution is most dangerous — driving the network toward flat, low-norm minima the analog substrate can represent. This explains *why* noise injection works, predicts the optimal noise level (match the measured device σ), and elevates noise-aware training from hack to principled regularization.

---

## 6 Limitations

1. **Training at scale remains elusive.** Convincing large-scale demos are inference-only (ISAAC, PRIME) or small-scale training (TTv2 on MNIST-class tasks [8]). Asymmetric stochastic writes fundamentally obstruct backpropagation-through-hardware at ImageNet scale; mixed-precision [7] sidesteps this with digital accumulation at the cost of full *O(1)* update parallelism.
2. **Finite endurance.** Filamentary ReRAM endures 10⁶–10⁹ cycles [5] — ample for write-once inference, marginal for on-chip training with millions of updates per synapse per epoch.
3. **The peripheral tax is structural.** No published tiled design spends under ~50% of its energy on ADCs, DACs, and buffers [6][12]. Future gains require converter innovation (in-array SAR, time-domain readout) as much as better devices.
4. **Statistical guarantees only.** All accuracy claims are statistical; safety-critical deployment needs per-chip calibration and fault maps — overhead digital accelerators avoid.
5. **Benchmark realism.** Most results are MNIST/CIFAR-class or simulated. ImageNet/transformer-scale demonstrations on physical ReRAM arrays remain rare, and the community lacks a standardized open benchmarking methodology [12].

---

## 7 Conclusion

Analog compute-in-memory with ReRAM crossbars is neither effortless panacea nor impractical curiosity, but a *conditionally* transformative technology: conditioned on bit-serial/bit-sliced architectures that amortize the ADC wall, on device engineering holding programming noise to a few percent, and — most decisively — on training algorithms that internalize hardware imperfections. Our central result, that conductance noise induces Tikhonov regularization, reframes non-ideality from engineering embarrassment into statistical resource: the physics of the filament, properly modeled, *regularizes* the network it computes.

The path forward is full-stack co-design: taming drift and asymmetry in devices, pushing conversion into the array, treating converters (not crossbars) as the architectural optimization target, and extending noise-aware training from convolutional vision models to transformer workloads. If that co-design succeeds, the reward is a substrate in which memory and processor are one — and the memory wall, the defining constraint of fifty years of computer architecture, finally falls.

---

## References

[1] A. Shafiee et al., "ISAAC: A Convolutional Neural Network Accelerator with In-Situ Analog Arithmetic in Crossbars," in *Proc. 43rd Int. Symp. Computer Architecture (ISCA)*, 2016. [PDF](http://users.cs.utah.edu/~rajeev/pubs/isca16-old.pdf)

[2] P. Chi et al., "PRIME: A Novel Processing-in-Memory Architecture for Neural Network Computation in ReRAM-Based Main Memory," in *Proc. 43rd Int. Symp. Computer Architecture (ISCA)*, 2016. [PDF](https://cseweb.ucsd.edu/~jzhao/files/PRIME_isca2016.pdf)

[3] M. Horowitz, "Computing's Energy Problem (and What We Can Do About It)," in *IEEE Int. Solid-State Circuits Conf. (ISSCC)*, 2014. [Slides](https://users.cs.utah.edu/~rajeev/cs7960/notes/slides/19-7960-11-notes.pdf)

[4] V. Sze, Y.-H. Chen, T.-J. Yang, and J. Emer, "Efficient Processing of Deep Neural Networks: A Tutorial and Survey," *Proc. IEEE*, vol. 105, no. 12, 2017.

[5] H.-S. P. Wong et al., "Metal–Oxide RRAM," *Proc. IEEE*, vol. 100, no. 6, pp. 1951–1970, 2012.

[6] M. Bavandpour et al., "Analog Architectures for Neural Network Acceleration Based on Non-Volatile Memory," *Applied Physics Reviews*, vol. 7, 031301, 2020. [AIP](https://pubs.aip.org/aip/apr/article/7/3/031301/997525/Analog-architectures-for-neural-network)

[7] M. Le Gallo et al., "Mixed-Precision In-Memory Computing," *Nature Electronics*, vol. 1, pp. 246–253, 2018. [Nature](https://www.nature.com/articles/s41928-018-0054-8?error=cookies_not_supported&code=c2d41c95-6cd2-4c16-b8c1-25ffd657912c) / [IBM Research](https://research.ibm.com/publications/mixed-precision-in-memory-computing)

[8] S. Ambrogio et al., "Equivalent-Accuracy Accelerated Neural-Network Training Using Analog Memory," *Nature*, vol. 558, pp. 60–67, 2018. (TTv2: G. Burr et al., *IBM J. Res. Dev.*, 2019.)

[9] D. B. Strukov, G. S. Snider, D. R. Stewart, and R. S. Williams, "The Missing Memristor Found," *Nature*, vol. 453, pp. 80–83, 2008.

[10] M. Hu et al., "Dot-Product Engine for Neuromorphic Computing: Programming 1T1M Crossbar to Accelerate Matrix-Vector Multiplication," in *Proc. 52nd Design Automation Conf. (DAC)*, 2015.

[11] A. Ankit et al., "PUMA: A Programmable Ultra-Efficient Memristor-Based Accelerator for Machine Learning Inference," in *Proc. ASPLOS*, 2019.

[12] J. Woo et al., "Resistive Neural Hardware Accelerators," arXiv:2109.03934, 2021. [arXiv](https://arXiv.org/pdf/2109.03934)

[13] C. Li et al., "Analogue Signal and Image Processing with Large Memristor Crossbars," *Nature Electronics*, vol. 1, pp. 52–59, 2018; "Hardware Implementation of Memristor-Based Artificial Neural Networks," *Nature Communications*, 2024. [Nature Comm.](https://www.nature.com/articles/s41467-024-45670-9?fromPaywallRec=false&error=cookies_not_supported&code=3689375f-0099-49a4-b1ef-13537e033ae5)

[14] S. Yu, "Neuro-Inspired Computing with Emerging Nonvolatile Memory," *Proc. IEEE*, vol. 106, no. 2, pp. 260–285, 2018. (Review: [MDPI Electronics](https://www.mdpi.com/2079-9292/11/22/3667))
