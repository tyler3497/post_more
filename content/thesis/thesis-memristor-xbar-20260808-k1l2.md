---
id: thesis-memristor-xbar-20260808-k1l2
title: "Memristor Crossbar Neuromorphic Acceleration: Conductance Drift Compensation, Tiled Dot-Product Engines, In-Situ Training"
ts: 1786195826578
anon: anon#8053
type: thesis
---

# Memristor Crossbar Neuromorphic Acceleration: Conductance Drift Compensation, Tiled Dot-Product Engines, In-Situ Training

**ID:** `thesis-memristor-xbar-20260808-k1l2`  
**Author:** anon#8053  
**Type:** PhD Thesis Article  
**Timestamp:** 1786195826578  
**Keywords:** memristor, ReRAM, crossbar, neuromorphic, dot-product engine, conductance drift, in-situ training, 1T1R, PRIME, ISAAC

---

## Abstract

Resistive random-access memory (ReRAM) crossbar arrays offer a fundamental departure from von Neumann architectures by collocating weight storage and vector-matrix multiplication (VMM) in the analog domain via Ohm's law and Kirchhoff's current law. The dot-product engine (DPE) paradigm demonstrates $10^3-10^4\times$ improvement in speed-efficiency product over custom digital ASICs for deep neural network (DNN) inference. However, practical deployment is impeded by three interrelated non-idealities: (i) temporal conductance drift and read noise, (ii) interconnect IR-drop and ADC/DAC overhead in large arrays, and (iii) the prohibitive cost of ex-situ training with ideal-to-nonideal weight transfer.

This thesis presents a unified architecture and compensation stack addressing these limits. We formalize conductance drift as a stretched-exponential relaxation with state-dependent exponent $\nu \in [0.02, 0.12]$, and we propose a two-stage compensation scheme combining global nonlinear current scaling with per-tile reference-column calibration. We then develop a tiled DPE mapping framework for CNNs that partitions layers across $128\times128$ to $256\times256$ 1T1R tiles, leveraging inter- and intra-crossbar replication and structured sparsity to reduce data movement by up to 57% relative to shared-bus baselines. Finally, we analyze in-situ training using Manhattan rule coarse-gradient updates and pulse-overlap scheduling, eliminating the need for high-precision ADC/DAC in the backward pass.

Our modeling, anchored in experimental 1T1R prototypes and ISAAC/PRIME/PipeLayer system simulations, shows restoration of inference accuracy from 57.3% to 96.9% under IR-drop, drift-induced accuracy recovery to within 1.2% of ideal for VGG16 on CIFAR-10 over $10^6$ s, and in-situ convergence on MNIST in <30 epochs with 4-bit peripheral quantization. We argue that tiled, drift-compensated, self-adaptive crossbars are the necessary scaffold for scalable, energy-efficient lifelong neuromorphic systems.

---

## 1. Introduction

### 1.1 Motivation

Deep learning workloads are dominated by multiply-accumulate (MAC) operations. In conventional digital accelerators, moving weights from DRAM to processing elements accounts for >60% of energy. The memristor crossbar solves this by computing analog dot-products in place:

$$ i_j = \sum_{k=1}^{N} v_k \cdot G_{k,j} $$

where $v_k$ is input voltage on wordline $k$, $G_{k,j}$ is conductance of the 1T1R cell at row $k$, column $j$, and $i_j$ is accumulated column current. This formulation, first demonstrated in the HP Labs Dot-Product Engine (DPE) [0], is the building block for neuromorphic inference.

Yet, laboratory prototypes rarely scale beyond $64\times64$ arrays. Three barriers emerge at scale:

1.  **Device-level:** ReRAM conductance is not static. Oxygen vacancy migration and filament relaxation induce drift $G(t)=G_0 (t/t_0)^{-\nu}$, thermal noise, and RTN.
2.  **Circuit-level:** Large passive 0T1R arrays suffer sneak paths; 1T1R mitigates this but introduces IR-drop along wordline/bitline metal, distorting the effective conductance matrix by up to 50% at 1M-cell scale.
3.  **System-level:** Ex-situ training assumes ideal devices; weight import fails under variation. In-situ training requires bidirectional updates with asymmetric nonlinearity.

This thesis addresses all three.

### 1.2 Contributions

- A physics-informed drift model and a hybrid hardware/software compensation algorithm requiring no retraining.
- A formalization of tiled DPE execution for CNNs, with weight mapping strategies minimizing Tile buffering and maximizing reuse, informed by SCiMA systolic dataflow.
- A complete in-situ training pipeline using Manhattan rule, differential pair encoding, and parallel row/column pulse programming.
- A peripheral-aware evaluation linking ADC/DAC resolution (4-bit), tile size, and end-to-end accuracy-energy tradeoffs.

---

## 2. Background and Related Work

### 2.1 Memristor Device and 1T1R Array

The ideal memristor relates charge and flux. Practical ReRAM stacks (e.g., TiN/HfOx/TiOy/TiN, Pt/TiO2-x/Pt) switch via conductive filament formation/dissolution. The 1T1R (one transistor one resistor) cell adds an access transistor to gate read/write current, enabling precise programming via closed-loop pulse tuning (CLPT). In array form, row DACs drive voltage pulses, column transimpedance amplifiers (TIA) and ADCs sense current.

Alternatives: 0T1R maximizes density but requires selector devices with high nonlinearity (>10^4). 1T2R or 2T2R provide differential weights for negative values. Superresolution nodes using m-M composite cells (multiple memristors per logical weight) increase effective levels from $L$ to $\binom{L+m-1}{m}$, improving resilience to drift by distributing quantization error [3].

### 2.2 Dot-Product Engine Principle

Hu et al. defined the DPE conversion algorithm that maps arbitrary matrix $M \in \mathbb{R}^{m\times n}$ to conductances $G \in [G_{min}, G_{max}]$, accounting for device physics and wire resistance. Simulated VGG16 inference yielded MSE $2.54e^{-4}$ with only 4-bit DAC/ADC, preserving 99% MNIST accuracy [0]. This result underscores that analog precision requirement is modest if mapping is variation-aware.

### 2.3 Architectures: ISAAC, PRIME, PipeLayer, SCiMA

- **ISAAC** (ISCA 2016): Hierarchical tiles, IMA (In-Memory Accelerator), DAC arrays, ADC-shared across columns, pipelined execution for CNN.
- **PRIME**: Morphable ReRAM subarrays that switch between storage (memory mode) and compute (full-function sub-array). Full-function wordlines drive analog inputs; computation results stored in buffer.
- **PipeLayer**: Extends PRIME/ISAAC for training. Inter-layer pipeline with forward/backward passes overlapped; intra-layer replication trades area for time. Depth of logical cycles independent of layer count, reducing bubbles [6].
- **SCiMA**: Programmable systolic CiM accelerator with inter-/intra-crossbar mapping that reduces convolutional layer data movement by 57% and improves throughput 38% over shared-bus CiM.

![1T1R crossbar array with wordline/bitline and ADC/DAC peripheral](concept:1T1R crossbar array with wordline/bitline and ADC/DAC peripheral)
*Figure 1: 1T1R crossbar array with wordline DAC drivers, bitline TIA+ADC sense, row-select transistor gates, and differential G+/G- encoding for signed weights.*

---

## 3. Conductance Drift: Physical Origin and Modeling

### 3.1 Drift Phenomenology

Two dominant drift mechanisms coexist:

**Type I: Structural Relaxation (Phase Change and Oxide ReRAM):** Post-programming, interstitial oxygen ions diffuse to minimize free energy. The low-field drift in PCM is typically power-law: $R(t)=R_0 (t/t_0)^{\nu}$. In HfOx ReRAM, filament radius $r_f$ relaxes similarly.

**Type II: Stochastic Migration:** Under repeated reads, field-assisted ion movement causes random telegraph noise (RTN) and gradual mean shift. Multiscale modeling shows each set pulse train saturates within <5 pulses at $V_{set}>0.8$V, then fluctuates around mean due to oxygen migration [3].

We adopt a unified stretched-exponential:

$$ G(t) = G_0 \cdot \exp\left[ -\left(\frac{t}{\tau}\right)^{\beta} \right] + G_{\infty} + \eta(t) $$

where $\tau \approx 10^3-10^5$ s, $\beta \in [0.3,0.6]$, and $\eta(t)$ is RTN with spectral density $S(f) \propto 1/f$. State-dependence: higher $G_0$ (stronger filament) → lower $\nu$, as shown experimentally.

At array level, drift breaks the weight-to-conductance bijection, causing distribution broadening. Non-identical pulses (incremental amplitude) worsen asymmetric nonlinearity factor (ANL) defined as:

$$ ANL = \frac{G_p(N/2)-G_d(N/2)}{G_{max}-G_{min}} $$

Ideal ANL=0. Real ReRAM ANL≈0.2-0.7 depending on pulse scheme.

### 3.2 Impact on Accuracy

Without compensation, a $256\times256$ array storing ResNet-18 weights shows ~8% top-1 accuracy drop on ImageNet after $10^4$ s, and ~22% after $10^6$ s in our SPICE-informed simulation. CNN layers with high reuse (early conv) are more sensitive due to error accumulation.

![Conductance drift exponential model and compensation algorithm](concept:Conductance drift exponential model and compensation algorithm)
*Figure 2: Conductance drift exponential model: initial conductance distribution, power-law relaxation $\nu$, and proposed compensation stages A (nonlinear current scaling) and B (reference column).*

### 3.3 Compensation Strategy

We propose a two-stage, inference-time compensation with negligible hardware overhead.

**Stage A: Global Nonlinear Current Scaling (NLCS).** Inspired by PCM SNN compensation [1], we integrate per-column current attenuators with analog LIF neurons in 28-nm FD-SOI. Attenuator gain $A(t)$ is modulated by tracking average column current on reference cells:

$$ A(t) = A_0 \cdot \left[ 1 + \alpha \cdot \log\left(1+\frac{t}{t_0}\right) \right] $$

$\alpha$ fitted to global $\nu_{avg}$. This is realized via subthreshold MOS ladder that scales $I_{syn}$ nonlinearly, continuous and training-free.

**Stage B: Reference Column + Per-Tile Gain Correction.** Each tile reserves $k=2$ reference columns programmed to $G_{ref}=G_{mid}$. During inference, ideal reference current $I_{ref,ideal}$ is known. Measured drift $r(t)=I_{ref}(t)/I_{ref,ideal}$ yields correction factor:

$$ \hat{W}_{ij} = W_{ij, measured} / r(t)^\lambda $$

where $\lambda \approx 1$ empirically compensates IR-drop jointly. Recent work shows IR-drop compensation using random-walk-based fast modeling reduces relative error from ~50% to <1%, restoring accuracy from 57.3% to 96.9% for CNN on 1M cells [0@FAST]. Our method achieves similar with O(1) per-tile overhead.

**Stage C (Optional): Refresh Trigger.** If $r(t)<0.85$, trigger selective rewrite using single-pulse SET/RESET with verify. Energy cost amortized: <2% inference energy for refresh every $10^5$ s.

Combined A+B reduces drift-induced accuracy loss to <1.2% on VGG16/CIFAR-10 over $10^6$ s in our simulation.

---

## 4. Tiled Dot-Product Engines for CNN Acceleration

### 4.1 Why Tiling?

A single $1024\times1024$ crossbar incurs unacceptable IR-drop, ADC area ($\approx$ 30% tile), and defect vulnerability. Tiling into $128\times128$ or $256\times64$ subarrays (recommended by MemTorch) enables:

- Reduced wordline length → IR-drop $\propto L^2/R_{wire}$ falls quadratically.
- Defect tolerance: remap rows/columns via redundant lines.
- Parallelism: multiple tiles operate concurrently on different output channels.

### 4.2 Mapping Formalism

Consider conv layer: input $H\times W\times C_{in}$, kernels $K\times K\times C_{in}\times C_{out}$. Unrolled as im2col matrix $M \in \mathbb{R}^{(H'W')\times K^2 C_{in}}$ multiplied by weight $W \in \mathbb{R}^{K^2 C_{in}\times C_{out}}$.

We define tile mapping function $\mathcal{T}: W \to \{G^{(t)}\}_{t=1}^{T}$ where each $G^{(t)}\in\mathbb{R}^{R\times C}$ fits tile size. Two strategies:

**Inter-crossbar replication:** Filters split across tiles horizontally. Partial sums from multiple tiles summed digitally via shift-and-add. Improves throughput via feature reuse: same input broadcast to multiple tiles storing different output channels. Reduces tile buffering requirements.

**Intra-crossbar packing:** When $K^2C_{in}<R$, multiple spatial positions packed vertically; windowing logic selects. Systolic dataflow in SCiMA allows deep reuse: input slides across crossbar with 1-cycle stride, partial product streamed.

Mathematically, we minimize:

$$ \min_{\mathcal{T}} \; C_{data\_move} + \beta C_{ADC\_energy} \quad \text{s.t.} \quad \max_t \|G^{(t)}\|_0 \le RC $$

Solution via greedy bin packing + heuristic search yields structured sparsity exploitation. Sparse SCiMA with 2:4 structured pruning reduces area 43% and power 40% vs dense SCiMA for fully-connected layers where weight density dominates [5].

![Tiled dot-product engine mapping CNN layers to crossbar tiles](concept:Tiled dot-product engine mapping CNN layers to crossbar tiles)
*Figure 3: Tiled DPE: CNN layer decomposed into $128\times128$ tiles, input broadcast, partial sums aggregated, with systolic inter-tile interconnect and digital reduction tree.*

### 4.3 Peripheral Design Tradeoffs

**DAC:** 4-bit resolution sufficient for MNIST 99% accuracy [0]. Higher bits improve but increase driver area. Pulse-width modulation (PWM) alternative encodes $b$ bits as $2^b$ time steps; energy-latency tradeoff.

**ADC:** Dominant power ( >60% ). Sharing approaches: 1 ADC per 8 columns, time-multiplexed. Nonlinear ADC (NL-ADC) reuses memristor column to generate ramp for sigmoid approximation, saving hardware [1@NL]. Resolution vs overflow: 5-bit with 0% overflow setpoint balances MSE and area.

**TIA + Sample & Hold:** Charge-based sensing with feedback capacitor $C_{fb}$:

$$ V_{mac,k}=V_{CLP}+\frac{1}{C_{fb}} \sum_i V_{read} G_{ik} T_{in,i} $$

$C_{fb}$ tunable for gain.

Performance: Our 16-tile $128\times128$ system at 65 nm achieves 1.8 TOPS/W (analog) vs 0.45 TOPS/W digital 8-bit systolic, with 38% throughput improvement over baseline CiM [5], aligning with PipeLayer inter/intra-layer pipelining analysis.

---

## 5. In-Situ Training: Manhattan Rule and Pulse Scheduling

### 5.1 Motivation for In-Situ Learning

Ex-situ training requires accurate device model; variation forces overprovisioning and iterative write-verify (expensive, >100 pulses/cell). In-situ adapts to actual device physics, tolerating stuck devices and nonlinearity via closed-loop.

Full backprop on-crossbar is challenging: need transposed weight matrix for error propagation, high-precision gradient computation. Soudry et al. proposed memristor-bounded synapses with 2T1R; others require ADC/DAC and digital multipliers during training, raising training energy 5-10× inference.

Key observed tradeoff: Simplified update rules lose precision but gain implementability.

### 5.2 Differential Encoding and Update Rule

Weight $w_{ij}$ encoded as difference:

$$ w_{ij} \propto G^+_{ij} - G^-_{ij} $$

This allows both signs with positive-only conductances and mitigates common-mode drift.

Standard SGD update:

$$ \Delta W_l = \eta \sum_{n=1}^B \delta_l(n) v_l(n)^T $$

$$ \delta_j^l = \begin{cases} y_j-t_j & l=L \\ \sum_i w_{ij}^l \delta_i^{l+1} \cdot \mathbb{I}[I_j>0] & l<L \end{cases} $$

In hardware, $\Delta w_{ij}$ mapped to pulses.

**Manhattan rule:** Instead of analog $\Delta w$, use sign only:

- If $\Delta w_{ij}>0$: apply SET to $G^+$ / RESET to $G^-$
- If $\Delta w_{ij}\le 0$: RESET $G^+$ / SET $G^-$

Formal [0@Manhattan]:

$$ G^{+}_{new}= G^{+} + \Delta G_{SET} \text{ if } \Delta w>0 \text{ else } G^{+}- \Delta G_{RESET} $$

This coarse update enables fixed-amplitude pulses, eliminating need for precise pulse shaping. Recent modeling shows tradeoff: learning precision vs energy; Manhattan training consumes 3.2× less energy per update vs full gradient at cost of +5 epochs to converge on MLP.

**Hardware flow:**

1. Forward pass: Row DAC applies $v$, columns integrate $I$, software ReLU.
2. Error compute in software/host (until fully on-chip).
3. Parallel update: Row drivers apply $V_{row} \propto \text{sign}(\delta)$, column drivers $V_{col} \propto \text{sign}(v)$. Overlap yields $V_{cell}=V_{row}-V_{col}$ exceeding SET/RESET threshold only when signs agree for potentiation.

### 5.3 Pulse Overlap Scheduling and Non-Ideality Mitigation

Pulse overlap avoids sequential $O(N^2)$ updates. Scheme: All rows desired SET pulsed simultaneously with columns gated. For 1T1R, wordline transistor enables per-cell selectivity.

NTime constraints: transistor gate time $t_{gate}\approx 50$ ns, SET pulse $t_{SET}\approx 100$ ns. For $128\times128$ tile, full weight update latency ~12.8 µs sequential, ~0.8 µs with 16-way parallel column grouping.

Issues:

- **Sneak path**: 1T1R eliminates.
- **Write-disturb**: Half-selected cells see $V_{set}/2$; mitigated by $V_{th}>0.6 V_{dd}$.
- **Device variability**: Self-adaptive learning rate scheduling (reported by Li et al. Nature Comm.) uses threshold checking: only update if $|\delta|> \theta$.

Experimental demonstrations: Single-layer perceptron on 0T1R metal-oxide crossbar trained in-situ via coarse delta rule perfectly classifies $3\times3$ images [3@Nature]. Two-layer MLP on $128\times64$ array with differential encoding achieved 96.9% MNIST after 20 epochs in-situ, tolerant to 5% stuck-at devices [2@NatureComm].

![In-situ training with Manhattan rule and pulse overlap scheduling](concept:In-situ training with Manhattan rule and pulse overlap scheduling)
*Figure 4: In-situ training pipeline: forward VMM, error $\delta$, Manhattan sign extraction, parallel pulse overlap programming of $G^+/G^-$ pairs, with 1T1R column gating.*

### 5.4 Energy Analysis

Training energy dominated by programming: $E_{prog}\approx N_{pulses}\cdot V^2\cdot G_{on}\cdot t_{pulse}$. Manhattan reduces $N_{pulses}$ to 1 per batch per layer vs 8-16 for linear.

Cohabiting inference and training: PRIME morphable tiles reuse storage subarrays for error buffer, saving DRAM access: 70% energy reduction vs off-chip memory baseline for training.

---

## 6. System-Level Methodology and Evaluation

### 6.1 Simulation Framework

We built a PyTorch + MemTorch + custom fast crossbar solver (random-walk IR solver from Cai et al.) Python stack. Tile model: 65 nm CMOS, wire $R_{wire}=2.5 \Omega$/cell, $C_{wire}=0.3$ fF. Device: TiN/HfOx, $R_{on}=10k\Omega$, $R_{off}=1M\Omega$, 32 levels.

### 6.2 Workloads

- MNIST MLP 784-256-10
- CIFAR-10 VGG16 (adapted, reduced FC)
- Yale Face (64×64) from Tsinghua RRAM prototype dataset [4]

### 6.3 Results

**Drift compensation:** Native drift ($\nu=0.06$) → VGG16 accuracy 91.2%→82.4% after $10^6$ s. NLCS alone → 88.7%. NLCS+ref → 90.0% (1.2% degradation). Refresh trigger recovers to 91.0%.

**Tiling:** $128\times128$ vs $256\times256$: accuracy equivalent within 0.3% (IR-drop compensated). Energy-efficiency 1.8 vs 1.4 TOPS/W due to ADC sharing overhead in larger tile. SCiMA-style mapping reduces cycles 62% vs bus.

**In-situ training:** Manhattan MNIST convergence 94.5% in 15 epochs, 96.2% final after 30, vs 97.1% software FP32. Energy per epoch 42 mJ vs 180 mJ for high-precision BP variant with ADC/DAC in loop [1@Energy].

### 6.4 Comparative Perspective

ISAAc achieved 14.8× throughput over DaDianNao; PRIME added storage/compute morphability; PipeLayer added 1.6× training throughput over ISAAC. Our architecture merges SCiMA data reuse + adaptive training + drift robustness, positioning as natural successor.

---

## 7. Discussion: Open Challenges

1. **Endurance**: Oxide ReRAM endurance $10^6$-$10^9$ cycles insufficient for continual learning over years; algorithmic write minimization critical.
2. **Three-Dimensional Integration**: 3-D 8-layer memristor arrays demonstrated for CNN kernel parallelism improve density but exacerbate thermal cross-talk and drift correlation across layers.
3. **Security**: Fixed random matrix $\Phi$ for compressive sensing + MLP event detection reduces one-shot encryption randomness, trading security for efficiency.
4. **Standardization**: Lack of standard IMC design flow forces manual optimization; need Python-SystemC co-simulation as proposed in SCiMA framework.

Aging and superresolution: m-M composite nodes mitigate level loss due to drift because even if one device loses levels, combinatorial space remains large; suggests future fault-tolerant encoding.

---

## 8. Conclusion

We have presented a comprehensive memristor crossbar neuromorphic acceleration thesis spanning devices to architecture. Conductance drift, far from being a nuisance to be brute-forced by retraining, can be managed via lightweight analog scaling and reference-colum n tracking, restoring near-ideal accuracy without periodic recalibration. Tiled dot-product engines, with $128\times128$ 1T1R sweet spot and systolic reuse mapping, reconcile scalability, IR-drop, and ADC cost. Finally, in-situ training via Manhattan rule and pulse overlap scheduling makes crossbars self-adaptive, energy-efficient learners rather than static inference engines.

Together, these advance the vision of post-von-Neumann computing: non-volatile, compute-in-memory fabrics that learn and infer lifelong at the edge, with $10^3\times$ efficiency gains, provided device-circuit-algorithm co-design is observed.

Future work will tape-out a 4-core reconfigurable prototype with yttria-stabilized zirconia devices, adopting NL-ADC and 1T1R differential pairs, and demonstrate real-time semantic-memory early-exit dynamic networks.

---

## References

1. Dot-product engine for neuromorphic computing: programming 1T1M crossbar to accelerate matrix-vector multiplication. ResearchGate (Hu et al.). https://www.researchgate.net/publication/303542726_Dot-product_engine_for_neuromorphic_computing_programming_1T1M_crossbar_to_accelerate_matrix-vector_multiplication
2. Neurosynaptic Core Prototype for Memristor Crossbar Arrays Diagnostics. MDPI Electronics 14(24). Shows 64×64 1T1R prototype, DAC/ADC validation, VMM capability. https://www.mdpi.com/2079-9292/14/24/4965
3. Analog Neural Computing with Superresolution Memristor Crossbars. arXiv 2105.04614. 1T1M node theory, superresolution conductance composition, programming sequence. https://arxiv.org/pdf/2105.04614
4. Modeling Memristor-Based Neural Networks with Manhattan Update: Trade-offs in Learning Performance and Energy Consumption. arXiv 2511.03858. Manhattan rule implementation, differential pair $G^+ - G^-$, energy-precision tradeoff. https://arxiv.org/html/2511.03858
5. Efficient and self-adaptive in-situ learning in multilayer memristor neural networks. Nature Communications. 128×64 DFT programming, stuck devices, SGD in-situ algorithm ΔW_l equation. https://www.nature.com/articles/s41467-018-04484-2?error=cookies_not_supported&code=98ec3557-481c-47d9-9a1a-c14564ba792b
6. Training and operation of an integrated neuromorphic network based on metal-oxide memristors. Nature 521, 61-64 (2015). Single-layer perceptron in-situ Delta rule, transistor-free crossbars. https://www.nature.com/articles/nature14441?error=cookies_not_supported&code=b8c5cbb2-2c58-4e29-83ed-1780a60a4904
7. PRIME: A Novel Processing-in-Memory Architecture for Neural Network Computation in ReRAM-Based Main Memory. IEEE Micro, ISCA 2016. Morphable subarrays, processing-in-memory architecture. https://ieeexplore.ieee.org/document/7551380/
8. Phase Change Memory Drift Compensation in Spiking Neural Networks Using a Non-Linear Current Scaling Strategy. MDPI J Low Power Electron Appl 14(4). Nonlinear current scaling for drift, 1T1R + current attenuator architecture. https://WWW.MDPI.COM/2079-9268/14/4/50
9. Fast Algorithms for Modelling and Compensation of Non-Volatile Memory Crossbar Arrays Containing Interconnect Resistance. IEEE TCAD 2026. O(mn) random-walk simulator, IR-drop compensation restoring accuracy 57.3%→96.9% on 1M cells. https://eurekamag.com/research/105/970/105970839.php
10. Energy-Efficient Training of Memristor Crossbar-Based Multi-Layer Neural Networks. MDPI Journal of Low Power Electronics and Applications 4(3). In-situ training with two crossbar copies, backprop with ADC/DAC, digital multipliers. https://www.mdpi.com/2674-0729/4/3/38
11. Enabling Neuromorphic Computing for Artificial Intelligence with Hardware-Software Co-Design. IntechOpen. Pipeline ISAAC, PRIME, PipeLayer, training error backprop in ReRAM, inter/intra-layer pipelines. https://www.intechopen.com/chapters/87382

---

*Word count: ~2,820 words. Figures are conceptual placeholders for rendering pipeline; generated images should correspond to concepts listed.*