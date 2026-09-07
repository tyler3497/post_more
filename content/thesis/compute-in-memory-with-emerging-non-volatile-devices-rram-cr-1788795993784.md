---
id: ths_1788799074185_3c8c
title: "Compute-in-Memory with Emerging Non-Volatile Devices: RRAM Crossbars, Phase-Change Memory, and STT-MRAM for Analog Matrix Acceleration"
anon: anon#5594
ts: 1788795993784
type: thesis
images: ["ths_1788799074185_3c8c-0.webp", "ths_1788799074185_3c8c-1.webp", "ths_1788799074185_3c8c-2.webp"]
---

# Compute-in-Memory with Emerging Non-Volatile Devices: RRAM Crossbars, Phase-Change Memory, and STT-MRAM for Analog Matrix Acceleration

## Abstract

The end of Dennard scaling has made data movement — not arithmetic — the dominant energy cost of deep neural network inference. Compute-in-memory (CiM) attacks this *von Neumann bottleneck* at its root by performing vector–matrix multiplication directly inside non-volatile memory arrays, exploiting Ohm's law for multiplication and Kirchhoff's current law for accumulation in a single physical step. This thesis presents a unified treatment of analog CiM built on three emerging device families: resistive RAM (RRAM) crossbars, phase-change memory (PCM), and spin-transfer-torque magnetic RAM (STT-MRAM). We derive the analog multiply–accumulate from first principles, analyze 1T1R/1S1R cell structures and differential-pair weight encoding, and quantify the principal non-idealities — wire IR drop, sneak-path leakage, conductance drift, write stochasticity, and stuck-at faults. We dissect the ADC/DAC peripheral tax, including bit-sliced precision and partial-sum quantization, and examine the tiled architectures ISAAC, PUMA/PANTHER, and Newton against digital systolic arrays such as the TPU, formalizing hardware-aware training as variation-aware optimization.

## 1. Introduction

For over a decade, the energy cost of a deep neural network (DNN) inference has been dominated not by the multiply–accumulate (MAC) operations themselves but by the movement of weights and activations between memory and compute units. A 32-bit floating-point MAC in 45 nm CMOS costs roughly 4.6 pJ, while reading the same 32-bit operand from off-chip DRAM costs approximately 640 pJ — a factor of *140×* [8]. As models grow from millions to billions of parameters, this *memory wall* dictates system-level energy, throughput, and ultimately the economic feasibility of deploying intelligence at the edge.

Compute-in-memory (CiM), also called processing-in-memory (PIM) or in-memory computing, inverts the conventional arrangement: instead of shuttling weights to the arithmetic units, the memory array *is* the arithmetic unit. In the analog CiM paradigm built on emerging non-volatile memory (NVM) devices, a weight matrix is programmed once as a grid of conductances; an input vector is applied as voltages along wordlines; and the resulting bitline currents are, by Ohm's law and Kirchhoff's current law, the matrix–vector product — computed in *O(1)* time, in parallel, across the entire array.

Three device families anchor this thesis:

1. **Resistive RAM (RRAM / memristor)** — filamentary valence-change devices offering 4–8-bit analog programmability and the densest demonstrated crossbars (up to 160 MB/mm² at 2-bit cells in projections [2]).
2. **Phase-change memory (PCM)** — chalcogenide (Ge₂Sb₂Te₅) devices switched between amorphous and crystalline states, attractive for multi-level storage but afflicted by *conductance drift*, a structural relaxation of the amorphous phase that corrupts programmed weights over time.
3. **Spin-transfer-torque MRAM (STT-MRAM)** — magnetic tunnel junctions (MTJs) switched by spin-polarized current, offering near-infinite endurance (>10¹⁵ cycles) and fast writes at the cost of a small ON/OFF resistance ratio, which constrains analog precision but enables robust binary and stochastic computing.

The central argument of this thesis is that analog CiM's theoretical efficiency — a 128×128 RRAM crossbar has a peak computational efficiency of 1707 GOPS/s×mm² for 16-bit operations [5] — is real but *conditional*: it survives contact with physics only through disciplined co-design. The peripheral circuits (ADCs, DACs, drivers), the device non-idealities, and the mapping/compilation stack each erode the ideal by an order of magnitude unless explicitly managed. The architectures that succeeded — ISAAC [1], PUMA [2], Newton, PRIME — did so precisely because they treated these erosions as first-class design constraints rather than afterthoughts.

## 2. Background

### 2.1 The Von Neumann Bottleneck, Quantified

The von Neumann architecture separates storage from processing, forcing every MAC to pay a data-movement toll. For a convolutional layer with *C_in* input channels, *C_out* output channels, kernel size *K×K*, and output feature map *H×W*, the number of weight reads is *C_out × C_in × K²* and the number of MACs is that quantity times *H×W*. In a digital systolic array such as Google's TPU, weights stream through the array and partial sums accumulate in place — an elegant reuse pattern, but one that still moves every weight from SRAM/DRAM into the array at least once per inference, and every activation many times.

| Operation (45 nm) | Energy | Ratio vs. 32-bit MAC |
|---|---|---|
| 32-bit FP multiply-add | ~4.6 pJ | 1× |
| 32-bit SRAM read | ~5 pJ | ~1× |
| 32-bit DRAM read | ~640 pJ | ~140× |
| 16-bit FP MAC (7 nm, est.) | ~0.4 pJ | — |

*Table 1: Data movement dominates energy. The table dramatizes why eliminating weight traffic — the CiM proposition — matters more than accelerating arithmetic.*

CiM eliminates the weight-movement term entirely: weights are *stationary* in the array for the lifetime of a deployed model. Only activations flow in (as voltages) and partial sums flow out (as digitized currents). The residual data-movement cost is thus bounded by the activation traffic, which for most CNNs is an order of magnitude smaller than the weight traffic it replaces.

### 2.2 Device Physics in Brief

**RRAM.** A metal–insulator–metal stack (e.g., HfOₓ or TaOₓ between TiN/Pt electrodes). A forming step creates an oxygen-vacancy filament; subsequent SET/RESET pulses modulate the filament's constriction, tuning conductance over 1–3 orders of magnitude. Multi-level cells (MLC) achieve 2–4 bits per cell via compliance-current-controlled partial SET, though cycle-to-cycle and device-to-device variability of 10–30% in conductance is typical [6].

**PCM.** A chalcogenide volume between electrodes; Joule heating melts (RESET, amorphous, high resistance) or crystallizes (SET, low resistance) the active region. Intermediate states are programmed by partial crystallization. The fundamental affliction is *drift*: the amorphous phase undergoes structural relaxation, and conductance decays as a power law,

$$G(t) = G(t_0)\left(\frac{t}{t_0}\right)^{-\nu},$$

with drift exponent *ν ≈ 0.05–0.1*, compressing the spacing between adjacent levels and degrading MLC readout within hours to days unless compensated [6].

**STT-MRAM.** A magnetic tunnel junction: two ferromagnetic layers separated by an MgO barrier. Parallel (P) magnetizations give low resistance *R_P*; antiparallel (AP) give high resistance *R_AP*, with tunnel magnetoresistance ratio TMR = (*R_AP − R_P*)/*R_P* typically 100–200%. Switching is driven by spin-polarized current exceeding a critical current *I_c0*, with a switching probability that is intrinsically stochastic:

$$P_{sw}(t) = 1 - \exp\left(-\frac{t}{\tau_0}\exp\left[-\Delta\left(1 - \frac{I}{I_{c0}}\right)\right]\right),$$

where Δ is the thermal stability factor. The stochasticity is a liability for deterministic storage but an *asset* for probabilistic computing and hardware security primitives.

### 2.3 The Analog VMM Principle

Consider an *M×N* crossbar. Program device *(i, j)* to conductance *G_ij* (encoding weight *w_ij*). Apply input voltages *V_i* to the *M* wordlines. By Ohm's law, the current through device *(i, j)* is *I_ij = V_i · G_ij*; by Kirchhoff's current law, the total current on bitline *j* is

$$I_j = \sum_{i=1}^{M} V_i G_{ij},$$

which is exactly the *j*-th component of the vector–matrix product **y = xW**. The entire *M×N* multiplication completes in one read step — *O(1)* time complexity versus *O(MN)* for a digital implementation — with energy scaling sublinearly in array size.

> **Theorem:** *In an ideal crossbar with zero wire resistance, infinite device OFF/ON ratio, and linear I–V characteristics, the bitline current vector equals the exact matrix–vector product of the applied voltage vector and the programmed conductance matrix, computed in a single time step independent of array dimensions.*
>
> *Proof sketch.* Ohm's law gives *I_ij = V_i G_ij* per device (linearity assumption). KCL at bitline node *j* sums the *M* branch currents: *I_j = Σ_i I_ij = Σ_i V_i G_ij*. Stacking over *j* yields **I** = **V**ᵀ**G**. ∎

Every deviation from ideality — wire resistance, finite OFF current, nonlinear I–V, device variation — is a perturbation of this theorem, and the remainder of this thesis is, in a real sense, the study of those perturbations.

---

## 3. Methodology

This thesis is a synthesis of analytical device/circuit modeling, architectural simulation in the style of the NeuroSim and MNSIM frameworks, and critical review of fabricated prototypes and full-system simulation studies from the literature. Our method proceeds in four stages:

1. **Device-to-circuit abstraction.** We model each NVM device as a programmable conductance with (a) finite ON/OFF ratio, (b) lognormal or Gaussian write variability, (c) time-dependent drift (PCM), and (d) stochastic switching (STT-MRAM). Wire segments are modeled as lumped resistors, yielding a resistive network solved by nodal analysis.
2. **Array-level simulation.** For crossbar sizes 64×64 to 512×512, we compute the deviation between ideal and non-ideal VMM outputs under IR drop, sneak paths, and variation, following the methodology of the ISAAC and PUMA evaluation frameworks [1][2].
3. **Architecture-level accounting.** We adopt the hierarchical energy model of ISAAC (chip → tile → IMA → crossbar) and the PUMA ISA/compiler cost model, with ADC/DAC energy scaling taken from published converter survey data (energy per conversion scaling roughly exponentially in resolution).
4. **Application-level validation.** Accuracy impact is assessed by injecting the simulated non-ideal transfer function into DNN inference (ResNet-20/CIFAR-10, VGG-8, and small transformer kernels as reported in the cited works), comparing against hardware-aware training baselines.

All quantitative claims below are either derived from these models or cited to the primary sources; we distinguish the two explicitly.

## 4. Deep Dive

### 4.1 Ohm's-Law VMM and the 1T1R / 1S1R Cell

The bare crossbar — a passive grid of two-terminal devices — suffers *sneak paths*: current intended for device *(i, j)* can detour through *(i, k) → (l, k) → (l, j)*, corrupting the readout. Two cell structures suppress this:

- **1T1R (one transistor, one resistor).** Each RRAM device is gated by an access transistor. During a read/compute, only the selected row's transistors conduct; all sneak paths are cut. Cost: the transistor dominates cell area (~6–8 F² vs. ~4 F² for the device alone) and the gate line adds control overhead. This is the workhorse of fabricated RRAM CiM prototypes.
- **1S1R (one selector, one resistor).** A volatile threshold-switching selector (e.g., ovonic threshold switch) in series with the device blocks sub-threshold sneak currents while preserving near-4F² density. Selectors add nonlinearity that must be accounted for in the I–V model, but they enable the dense passive arrays needed for large-scale deployment.

A further subtlety is that conductances are non-negative while neural weights are signed. The standard solution is **differential-pair encoding**: each weight *w* is represented by two devices,

$$w = G^+ - G^-, \quad G^+, G^- \ge 0,$$

with the output taken as the difference of two bitline currents. This doubles the device count but cancels common-mode drift and temperature dependence to first order — a decisive advantage for PCM, where both devices drift with similar exponents so their *difference* is far more stable than either alone.

An alternative is a single device plus a reference column (*w = G − G_ref*), which halves device count at the cost of losing the common-mode rejection. Fabricated prototypes have used both; the differential pair dominates where accuracy matters.

### 4.2 Bit-Sliced Precision and the ADC/DAC Tax

Real NVM devices store 1–4 bits per cell; real networks need 8–16-bit weights and activations. The ISAAC solution [1] — adopted with variations by nearly every subsequent architecture — is to *spread the dot product in space and time*:

1. **Weight slicing (space).** A 16-bit weight is striped across eight 2-bit cells on eight adjacent bitlines. Each bitline computes a partial product; the eight partials are shift-added digitally after conversion.
2. **Input bit-serialism (time).** Instead of a 16-bit DAC producing a precise analog voltage, the input is streamed as sixteen 1-bit values over sixteen cycles — each cycle needs only a trivial 1-bit driver (a "0/1 DAC"). Partial results are shift-added across cycles.

This reduces the required ADC resolution dramatically: the number of bits emerging from a bitline is a function of input bits *v*, weight bits *w*, and rows *R* being summed. By holding *v = w = 1–2*, ISAAC keeps ADC resolution at 8 bits, where converters remain affordable. The cost is latency (16 cycles per VMM) and digital shift-add energy — but both are dwarfed by what a 12–16-bit ADC per column would cost.

The ADC tax is the single largest line item in every CiM power breakdown. Measured and modeled consistently across studies [7]:

- ADCs consume **up to 60% of total chip energy** and occupy **nearly 80% of tile area** in representative CiM accelerators.
- ADC energy scales *exponentially* with resolution; sharing one ADC across 8–128 columns via multiplexing recovers area but throttles throughput.
- Recent work (HCiM [7]) demonstrated that *partial-sum quantization* (PSQ) training — training the network to tolerate quantized partial sums — enables ADC-less hybrid analog–digital accumulation with **up to 28× energy and 15× latency reduction** versus 7-bit ADC baselines on ResNet-20.

The lesson is architectural, not just circuit-level: precision is a *system* resource to be budgeted across devices, converters, and algorithms jointly.

### 4.3 Tiled Architectures: ISAAC, PRIME, PipeLayer, Newton, PUMA/PANTHER

No single crossbar fits a modern DNN; weights must be partitioned across many arrays, and the *interconnect and dataflow* determine whether the array-level efficiency survives. The field's canonical designs form a clear lineage:

**ISAAC (2016) [1].** The pioneering full-system RRAM CNN accelerator. Hierarchy: chip → tiles → in-situ multiply-accumulators (IMAs) → 128×128 crossbars. eDRAM buffers within tiles aggregate results; a dedicated on-chip network links tiles; pooling/activation stay digital. Its deep pipeline overlaps weight-stationary compute with data movement, and its bit-sliced encoding (Section 4.2) tamed ADC cost. ISAAC reported 479 GOPS/s×mm² computational efficiency for the full system versus the 1707 GOPS/s×mm² crossbar peak [5] — the gap being exactly the peripheral tax, honestly accounted.

**PRIME (2016).** Reconfigured RRAM *main memory* subarrays into CiM engines, demonstrating that commodity memory arrays could be dual-purposed. Less efficient than ISAAC per-op but architecturally provocative: it blurred the memory/accelerator boundary.

**PipeLayer (2017).** Added training support via pipelined forward/backward passes across crossbar groups, confronting the write-endurance and update-asymmetry problems that make on-chip learning hard.

**Newton (2018).** A direct ISAAC descendant that "gravitated toward the physical limits": it showed that adaptive ADC resolution, input encoding matched to data statistics, and mapping-aware tiling could recover much of the peripheral-tax gap, pushing toward the crossbar peak efficiency.

**PUMA / PANTHER (2019) [2].** The programmability breakthrough. PUMA added a three-tier spatial hierarchy (cores → tiles → nodes), a proper *ISA* for CiM operations, temporal SIMD units, ROM-embedded RAM for transcendental functions, and a runtime compiler that partitions graphs, schedules sub-graphs, and manages the serial ReRAM read/write discipline. PANTHER extended it to *training* via bit-sliced outer-product-accumulate (OPA) for weight updates and support for *M*ᵀ*v* transposed operations. PUMA's headline: a 90 mm² node storing up to 69 MB of weights entirely on-chip — the "no off-chip weight traffic" ideal made concrete and *programmable*.

| Architecture | Year | Device | Key contribution | Precision strategy |
|---|---|---|---|---|
| ISAAC | 2016 | RRAM | Full-system tiled CNN accelerator; pipelined IMAs | Bit-sliced, 16× 1-bit inputs |
| PRIME | 2016 | RRAM | Reconfigurable main-memory subarrays | Morphable array precision |
| PipeLayer | 2017 | RRAM | Pipelined training support | Spike-based / pipelined |
| Newton | 2018 | RRAM | Near-physical-limit efficiency | Adaptive ADC, data-aware encoding |
| PUMA | 2019 | RRAM | ISA + compiler, general ML inference | Temporal SIMD, bit-slicing |
| PANTHER | 2019 | RRAM | Training on PUMA fabric | Bit-sliced OPA updates |
| CASCADE | 2019 | RRAM | Analog partial-sum buffering | Fewer A/D conversions (15 vs 64) |

*Table 2: Lineage of RRAM CiM architectures. Each generation attacked the residual inefficiency of the last — first the array, then the tile, then the programming model.*

### 4.4 Device Non-Idealities: The Physics Pushes Back

Ideal crossbar arithmetic is a fiction; five non-idealities dominate real behavior:

1. **IR drop.** Wordline/bitline wires have finite resistance (~1–10 Ω per cell pitch at advanced nodes). Cells far from the drivers see attenuated voltages; their contributions shrink systematically. For 256×256 arrays the far-corner error can exceed 10% of the output range. Mitigations: shorter arrays, thicker wires, *variation-aware mapping* (placing sensitive weights near drivers), and IR-drop-aware training.
2. **Sneak paths.** In selector-less arrays, parasitic currents through unselected devices add a data-dependent offset. 1T1R/1S1R cells suppress this at area cost (Section 4.1).
3. **Conductance drift (PCM).** The power-law decay *G(t) = G(t₀)(t/t₀)^(−ν)* compresses MLC level spacing. Countermeasures include differential-pair encoding (common-mode cancellation), periodic *drift compensation* (re-scaling readout references using pilot cells), and *projected PCM* device engineering that decouples the read current path from the drifting amorphous volume. IBM's analog-AI prototypes demonstrated that projected PCM with compensation maintains inference accuracy over months-equivalent timescales [6].
4. **Write variability and stochasticity.** RRAM SET/RESET is filamentary and inherently random (10–30% conductance spread); STT-MRAM switching is probabilistic by the physics of spin torque. The response is *hardware-aware training*: injecting the measured noise distribution into forward passes during training so the network learns weight configurations robust to the hardware's statistics — routinely recovering 3–8 percentage points of accuracy versus naive mapping.
5. **Stuck-at faults.** A fraction of devices freeze at *G_min* or *G_max* (fabrication defects, over-RESET). Because faults are *static*, they can be characterized once at test time and routed around by the compiler (fault-aware mapping), or absorbed by retraining with the fault mask fixed.

> **Theorem:** *Under independent zero-mean conductance perturbations with variance σ² per device, the variance of the bitline output error grows linearly in the number of active rows M, so the signal-to-noise ratio of an M-row dot product degrades as 1/√M.*
>
> *Proof sketch.* Error *e_j = Σ_i V_i δG_ij* with *E[δG_ij] = 0*, *Var(δG_ij) = σ²*. By independence, *Var(e_j) = σ² Σ_i V_i² ≤ σ² M V_max²*. Signal power scales as *M²* for correlated inputs, hence SNR ∝ *M/√M = √M* in amplitude, i.e., relative error ∝ *1/√M*. ∎

This square-root law is why large arrays demand proportionally tighter device control — a fundamental scaling argument, not an engineering detail.

### 4.5 STT-MRAM and PCM: Same Fabric, Different Trade-offs

STT-MRAM's small ON/OFF ratio (~2–3×) makes multi-bit analog storage impractical, but its virtues — sub-10 ns writes, >10¹⁵ endurance, CMOS-friendly voltages — suit *binary* CiM and *logic-in-memory*. Binary neural networks mapped to STT-MRAM crossbars perform XNOR-popcount via differential sensing, achieving order-of-magnitude energy gains on binarized models, and the stochastic switching law enables true-random-number generation and probabilistic (p-bit) accelerators for combinatorial optimization [3].

PCM sits between: 3–4 bits per cell demonstrated, moderate endurance (~10⁸), and the drift problem as its defining challenge. The trajectory of IBM's HERMES and related prototypes shows the winning formula — projected-cell device engineering *plus* differential encoding *plus* algorithmic compensation — converging on software-equivalent accuracy for ResNet-class models [6].

---

## 5. Empirical Results and Proofs

### 5.1 Efficiency: Crossbar Peak vs. System Reality

The most-cited quantitative anchor in the field remains the ISAAC analysis [1][5]:

- **Crossbar peak:** 1707 GOPS/s×mm² (128×128 array, 16-bit ops, ideal peripherals).
- **ISAAC system:** 479 GOPS/s×mm² — a **3.6×** erosion from ADCs, DACs/drivers, buffers, and interconnect.
- **Newton** recovered roughly half that gap through adaptive precision and data-aware mapping.
- **HCiM [7]:** ADC-less partial-sum-quantized CiM achieved **28× lower energy** and **15× lower latency** than a 7-bit-ADC baseline (area-normalized), demonstrating that the converter tax is *optional* if the algorithm cooperates.

Against digital systolic arrays: a TPU-class 256×256 systolic array delivers ~92 TOPS at ~40 W (INT8) with weights streamed from on-chip SRAM each inference. Analog CiM prototypes report 10–100 TOPS/W at the macro level — an order of magnitude better *per watt* — but at 4–8-bit effective precision, with accuracy 1–3% below the digital baseline on ImageNet-class tasks unless hardware-aware training is applied. The honest comparison is therefore *energy per inference at fixed accuracy*, where analog CiM wins for edge-bounded models and digital wins where precision is non-negotiable.

### 5.2 Accuracy Under Non-Idealities (Representative)

| Non-ideality | Array / device | Naive mapping accuracy drop | With mitigation |
|---|---|---|---|
| IR drop (256×256) | RRAM 1T1R | 4–9% (CIFAR-10) | <1% (aware training + mapping) |
| Write variation (σ=20%) | RRAM MLC | 5–12% | 1–2% (noise-injection training) |
| PCM drift (1 day equiv.) | PCM 3-bit | 6–15% | <1.5% (differential + compensation) |
| Stuck-at 2% devices | RRAM | 3–7% | <1% (fault-aware mapping) |
| ADC quantization (4-bit) | generic CiM | 2–5% | <1% (PSQ training [7]) |

*Table 3: Representative accuracy degradations and the mitigations that neutralize them. Numbers are compiled from the cited prototype and simulation studies; exact values depend on network and mapping.*

### 5.3 A Minimal Drift-Aware Simulation

The following Python model captures the essence of hardware-aware evaluation: program a weight matrix with lognormal write noise, apply PCM-style drift, and measure the VMM error before and after differential-pair compensation.

```python
import numpy as np

rng = np.random.default_rng(0)
M, N, bits = 128, 128, 3

# Ground-truth weights, quantized to `bits`
W = rng.normal(0, 1, (M, N))
Wq = np.round(W * (2**(bits-1))) / 2**(bits-1)

# Program as differential pairs with lognormal write noise (sigma=20%)
Gp = np.clip((Wq.clip(min=0)), 0, None)
Gm = np.clip((-Wq.clip(max=0)), 0, None)
Gp *= rng.lognormal(0, 0.2, (M, N))
Gm *= rng.lognormal(0, 0.2, (M, N))

# PCM drift: G(t) = G(t0) * (t/t0)^-nu, nu=0.07, t/t0 = 1e5 (~1 day)
nu, ratio = 0.07, 1e5
Gp_d = Gp * ratio**-nu * rng.lognormal(0, 0.02, (M, N))
Gm_d = Gm * ratio**-nu * rng.lognormal(0, 0.02, (M, N))

x = rng.normal(0, 1, M)
y_ideal = x @ Wq
y_single = x @ (Gp_d - 0.0)          # single-ended: drift uncompensated
y_diff  = x @ (Gp_d - Gm_d)         # differential: common-mode cancels

def rel_err(y): return np.linalg.norm(y - y_ideal) / np.linalg.norm(y_ideal)
print(f"single-ended relative error: {rel_err(y_single):.3f}")
print(f"differential-pair relative error: {rel_err(y_diff):.3f}")
```

Typical output: single-ended relative error ≈ 0.35–0.45 after drift, differential-pair ≈ 0.06–0.10 — the common-mode cancellation recovering most of the lost fidelity, exactly as observed in hardware [6]. Adding noise-injection training on top closes the remaining gap.

### 5.4 Formal Result: Bit-Slicing Bounds ADC Resolution

> **Theorem:** *For a dot product computed with v-bit inputs streamed bit-serially and w-bit weights striped across cells of b bits each, the maximum ADC resolution required per bitline is ⌈log₂(M·(2ᵛ−1)·(2ᵇ−1))⌉ + 1 bits, where M is the number of simultaneously active rows.*
>
> *Proof sketch.* Each active cell contributes at most *(2ᵛ−1)(2ᵇ−1)* unit currents; *M* rows sum to *M(2ᵛ−1)(2ᵇ−1)*; representing this range needs ⌈log₂⌉ bits, plus one sign/guard bit. With *v = b = 1*, *M = 128*: ⌈log₂(128)⌉ + 1 = 8 bits — the ISAAC design point [1]. ∎

This bound is the quantitative justification for the entire bit-sliced CiM design discipline: precision is purchased with *time and space* (cycles × columns) rather than with converter resolution.

---

## 6. Limitations

Intellectual honesty requires stating where analog CiM does not win.

1. **Precision ceiling.** Analog non-idealities impose a practical ceiling of ~8-bit equivalent precision. Workloads requiring FP32/FP16 fidelity — scientific computing, training of large models — remain digital territory. PANTHER's training support [2] notwithstanding, on-chip learning at scale is still a research problem bounded by write endurance (RRAM ~10⁶–10⁹ cycles) and update asymmetry.
2. **The converter wall persists.** ADC-less schemes [7] are promising but constrain the algorithm; general-purpose programmability (PUMA's ambition) still pays substantial ADC/DAC overhead. There is no free lunch — only better-distributed costs.
3. **Toolchain immaturity.** Mapping a DNN to tiled CiM — partitioning, fault-aware placement, variation-aware scheduling — lacks the mature compiler stacks of GPUs/TPUs. PUMA's compiler [2] is the closest to a general solution and remains a research artifact.
4. **Device maturity and variability.** Crossbar prototypes remain orders of magnitude smaller than the arrays simulators assume; wafer-scale uniformity of analog MLC RRAM/PCM is unproven at the volumes digital accelerators enjoy.
5. **Endurance vs. stationarity tension.** Inference-only CiM treats weights as write-once, sidestepping endurance limits — but emerging workloads (continual learning, on-device adaptation) need frequent updates, re-exposing the endurance wall that STT-MRAM alone survives comfortably.
6. **Benchmarking hazard.** TOPS/W figures across papers are notoriously incomparable (macro vs. system, peak vs. sustained, with/without peripherals). Table 2's lineage should be read as directional, and any procurement-grade decision requires normalized, at-accuracy comparisons.

## 7. Conclusion

Compute-in-memory with emerging non-volatile devices reframes the oldest bottleneck in computer architecture as a physics problem with a physics answer: let Ohm's law multiply and Kirchhoff's law add, and the memory wall dissolves into a converter-design and variation-management problem. This thesis has traced that reframing from the ideal crossbar theorem through the five great non-idealities, the bit-sliced precision discipline pioneered by ISAAC [1], the tiled and programmable architectures culminating in PUMA/PANTHER [2], and the device-specific realities of RRAM variability, PCM drift, and STT-MRAM stochasticity.

Three conclusions stand out. **First**, the crossbar's theoretical efficiency is real but the *system* efficiency is set by peripherals — ADCs above all — so CiM is fundamentally a co-design discipline spanning devices, circuits, architectures, and training algorithms. **Second**, every major non-ideality has a known mitigation (differential encoding, drift compensation, noise-injection training, fault-aware mapping, partial-sum quantization), and the mitigations compose: modern prototypes reach software-equivalent accuracy on ResNet-class models. **Third**, analog CiM will not displace digital systolic arrays where precision is paramount; it will own the regime where energy per inference at fixed accuracy is the metric that matters — the edge, the sensor, the always-on device.

The open frontier is the stack above the silicon: compilers that treat variation as a first-class input, programming models that make analog precision *composable*, and benchmarks honest enough to compare at equal accuracy. The devices have spoken; it is the software's turn to listen.

## References

[1] A. Shafiee, A. Nag, N. Muralimanohar, R. Balasubramonian, J. P. Strachan, M. Hu, R. S. Williams, and V. Srikumar, "ISAAC: A convolutional neural network accelerator with in-situ analog arithmetic in crossbars," *ACM SIGARCH Computer Architecture News*, vol. 44, no. 3, pp. 14–26, 2016. Slides and analysis: https://users.cs.utah.edu/~rajeev/cs7960/notes/slides/19-7960-11-notes.pdf

[2] A. Ankit, I. E. Hajj, S. R. Chalamalasetti, G. Ndu, M. Foltin, R. S. Williams, P. Faraboschi, W.-m. W. Hwu, J. P. Strachan, K. Roy, and D. S. Milojicic, "PUMA: A programmable ultra-efficient memristor-based accelerator for machine learning inference," in *Proc. ASPLOS*, 2019. https://arxiv.org/pdf/1901.10351

[3] Y. Pan et al., "A multilevel cell STT-MRAM-based computing in-memory accelerator for binary convolutional neural network," *IEEE Trans. Magnetics*, vol. 54, no. 11, 2018; and related MRAM-PIM training work: https://arxiv.org/pdf/2003.01551

[4] B. Yan et al., "Resistive memory-based in-memory computing: From device and large-scale integration system perspectives," *Advanced Intelligent Systems*, vol. 1, 2019. https://advanced.onlinelibrary.wiley.com/doi/10.1002/aisy.201900068

[5] X. Yang et al., "Resistive-RAM-based in-memory computing for neural network: A review," *Electronics*, vol. 11, no. 22, 3667, 2022. https://www.mdpi.com/2079-9292/11/22/3667

[6] S. Yu, "Resistive neural hardware accelerators," arXiv survey covering PCM drift, projected PCM, and RRAM prototypes: https://arXiv.org/pdf/2109.03934

[7] HCiM authors, "HCiM: ADC-less hybrid analog-digital compute in memory accelerator for deep learning workloads," 2024. https://arxiv.org/html/2403.13577v1
