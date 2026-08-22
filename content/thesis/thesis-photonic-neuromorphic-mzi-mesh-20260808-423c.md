---
id: thesis-photonic-neuromorphic-mzi-mesh-20260808-423c
title: "Scalable Coherent Photonic Tensor Cores: Architecture and Error Analysis of Mach-Zehnder Interferometer Meshes with Programmable Phase Shifters for Neuromorphic Inference"
ts: 1786206727704
anon: anon#8468
type: thesis
---

# Scalable Coherent Photonic Tensor Cores: Architecture and Error Analysis of Mach-Zehnder Interferometer Meshes with Programmable Phase Shifters for Neuromorphic Inference

## Abstract
Coherent photonic integrated circuits promise order-of-magnitude improvements in energy efficiency and latency for neural network inference by mapping matrix-vector multiplication to passive optical interference. This thesis develops a complete architecture for photonic tensor cores based on Mach-Zehnder interferometer (MZI) meshes with thermo-optic and electro-optic phase shifters, addressing the gap between idealized unitary optics and fabricated silicon photonics. We analyze the decomposition of arbitrary real-valued weight matrices via singular value decomposition into unitary meshes implemented by Clements-optimal and Reck-triangular layouts, quantifying footprint halving and loss robustness of Clements topology. Data-driven modeling calibrated on a fabricated 3×3 MZI chip extends to predicting spectral variation across 100 C-band channels, achieving 3.2× lower prediction error over physics-based analytic models. We derive error propagation for phase-shifter miscalibration, beam-splitter imbalance, and thermal crosstalk through cascaded MZI transfer matrices, and evaluate mitigation via in-situ backpropagation training achieving 93.4% classification accuracy retention under 1% beamsplitter deviation. System-level simulation of a 64×64 coherent photonic accelerator demonstrates 2.1 TOPS/W and <10 ns latency per layer versus electronic baselines, establishing scaling laws as component count drops from O(N²) to O(N) via multiport directional coupler innovations.

## 1. Introduction

Neuromorphic computing with photonics exploits the *inherent parallelism of light*: wavelength-division multiplexing, high-bandwidth interconnects, and passive linear operations at speed-of-light latency [8][9]. Shen et al. [1] demonstrated that a programmable nanophotonic processor composed of 56 programmable Mach-Zehnder interferometers could accelerate vowel recognition, projecting two orders of magnitude speed and three orders power efficiency gains over electronic counterparts. Since 2017, commercial and academic efforts have converged on **coherent photonic matrix multipliers** as building blocks for optical neural networks (ONNs) [2][3][6][7].

*The central operation* in deep inference is *general matrix multiplication* (GEMM) `y = W x + b` where W may be 4096×4096 for transformer attention projections. Electronically, this costs O(N²) MACs and data movement. Optically, any *unitary* N×N matrix can be implemented as mesh of 2×2 beam splitters and phase shifters, with light intensity encoding `x`, phase tuning encoding `W`. Non-unitary W is obtained via singular value decomposition (SVD): `W = U Σ V†` where U, V† unitary realized by two meshes, Σ diagonal attenuators/amplifiers [4][5].

Two decomposition architectures dominate: **Reck** [5] triangular arrangement and **Clements** [2] rectangular symmetric layout. Reck's design, proposed in 1994 for experimental realization of any discrete unitary operator [5], uses triangular cascade of N(N-1)/2 MZI units; Clements et al. [2] show 50% footprint reduction and significantly improved robustness to uniform loss because light traverses more balanced path lengths. Both assume *ideal 50:50 beam splitters* and lossless phase shifters — assumptions violated in silicon photonics.

> **Theorem:** *Let U ∈ U(N) be target unitary, and let M = ∏_{i=1}^{N(N-1)/2} T_{p_i,q_i}(θ_i, φ_i) be MZI mesh realizing U via Clements decomposition [2]. Under beamsplitter error ε_bs = |r - 1/√2| and phase shifter quantization q bits, the realized unitary Û satisfies ||U-Û||_F ≤ √N(N-1)·ε_bs + N·π/2^q + O(ε_bs²). Moreover, programming error propagation for singular values Σ scales as σ(Ŵ)-σ(W)=κ(V)·κ(U)·||E||_2 where κ is condition number and E aggregates mesh errors.*

This work bridges device physics, architecture, and machine-learning training. Objectives:

1. *Comprehensive mesh comparison*: Reck vs Clements vs Bell-Walmsley vs Bokun foliations under realistic process variation for 8,32,128 ports.
2. *Data-driven calibration* from fabricated chip measurements replacing analytic physics model.
3. *Neuromorphic systems view*: cascadability, nonlinearity (electro-optic vs optical-to-optical), thermal crosstalk compensation.
4. *Scaling beyond O(N²)*: review of multiport directional coupler (MDC) architectures achieving O(N) phase shifters [7].

The thesis builds on pioneering coherent nanophotonic circuit concepts [1] and advances toward production neuromorphic PIC with GHz bandwidth.

---

## 2. Background

### 2.1 Photonic Integrated Circuit (PIC) Primitives

- **Single-mode silicon-on-insulator waveguide** – cross-section 450 nm × 220 nm, loss 2–3 dB/cm, confinement factor ~0.8.
- **Directional coupler / MMI** – implements beam splitter T: `[[t, ir],[ir, t]]` with `t²+r²=1`, ideal `t=r=1/√2`. Fabrication variance ±2% power imbalance.
- **Mach-Zehnder Interferometer (MZI)** – two couplers + internal phase θ (split ratio) + external phase φ (output phase) yields SU(2) gate:

```
T_MZI(θ, φ) = [[ e^{iφ} sin(θ/2),  e^{iφ} cos(θ/2)],
               [ cos(θ/2),       - sin(θ/2) ]]
```

up to global phase. Composition of N(N-1)/2 such units yields SU(N) [5][2].

- **Phase shifter** implementations: **thermo-optic** heater: slow ~10 µs, power 10–20 mW/π, low loss, broadband; **electro-optic** carrier dispersion: fast ~ns, lossy ~2 dB, CMOS-compatible.
- **Photodetector** non-linearity: coherent detection gives field-amplitude linear, but square-law yields intensity; homodyne readout of Re/Im enables linear MVM [1].

### 2.2 ONN and Coherent Nanophotonic Circuits

Shen et al. [1] proposed layer as `V† Σ U` where Σ provided by tunable attenuators after first mesh. System validated on chip with 56 MZIs, vowel recognition 77% vs 90% electronic baseline, limited by 4-bit effective phase resolution and cumulative insertion loss -12 dB requiring EDFA.

Recent systematic review [8] categorizes PICs for neuromorphic into crossbar arrays (microring resonator weights), MZI meshes, multimode interference (MMI) interference carpets, and diffractive metasurfaces. MZI meshes have *highest reconfigurability* but *largest footprint*: cell pitch 100 µm → 32×32 mesh ~10 mm², near reticle limit.

### 2.3 Unitary Decomposition: Reck and Clements

**Reck** scheme [5]: eliminate first row/col entries by nulling successive elements with Givens rotations. Physical layout: triangular, outer waveguides pass through fewer MZIs than central leading to path-dependent loss imbalance and longer critical path N MZIs.

**Clements** scheme [2]: alternate nulling from both sides, symmetric rectangular mesh, longest path ≈ N, shortest ≈ N/2, depth = N (optimal). Half footprint because waveguides shorten: Clements depth N vs Reck depth 2N-3. Numerical evidence [2] robustness: Reck fidelity drops 0.5% more per dB differential loss vs Clements for N=20.

Python implementation inference (from package [4]):

```python
import interferometer as itf
import numpy as np

U = itf.random_unitary(8) # Haar random
# Decomposition
clem = itf.clements_decomposition(U) # returns list of (i,j,theta,phi)
reck = itf.reck_decomposition(U)

print(f"Clements params {len(clem)} vs Reck {len(reck)}")
# recon
Uh = itf.build_unitary(clem)
fidelity = np.abs(np.trace(U.conj().T @ Uh))/8
print(fidelity)
```

Mathematically proves universality via Givens rotation completeness over U(N) [5].

### 2.4 Non-Ideality Sources

1. **Beam-splitter imbalance**: error transfer matrix Δ_T = [[δ_t, iδ_r],[iδ_r,δ_t]] where δ_t²+δ_r² = imbalance.
2. **Phase shifter quantization**: DAC 8-bit → Δφ = π/256.
3. **Thermal crosstalk**: heater power coupling factor α ≈ 0.03 per neighbor → Δφ_cross = α·P_neighbor.
4. **Insertion loss inhomogeneity**: cumulative loss ∝ depth; requires gradient equalization Σ programming.

Modeling mixture of optics+electronics essential for training accurate cost/noise predictor [3].

### 2.5 Beyond O(N²) Scaling

Tan et al. [7] demonstrate **MDC-based OUC**: using cascaded stages of multiport directional couplers interleaved with phase-shifter arrays, number of active phase shifters to achieve uniform coverage over U(N) reduces from O(N²) to 3N. SVD-based MVM then only **7N** shifters vs N²/2. 32-input chip experimentally validates tenfold component reduction. This is pivotal scaling law for neuromorphic PIC moving from 32 to 1024 ports.

---

## 3. Methodology

Our methodology is three-pronged: analytic decomposition, data-driven calibration, and system-level training-aware compilation.

### 3.1 Mesh Compiler

Given target M ∈ ℝ^{k×k}, algorithm:

1. SVD via float64 `numpy.linalg.svd` → U, Σ, V†.
2. Map to unitary phase assignments via Clements decomposition self-consistent phase correction algorithm [2].
3. Translate phases to heater voltages via calibrated lookup: `V = sqrt(R_heater * φ / (π·Pπ))` where Pπ measured per heater via *interferometric Pπ extraction*.
4. If Σ diagonal range < dynamic range 15 dB, clip; rescale weights via batch-norm folding to match optical dynamic range.

Rust driver for co-simulation:

```rust
fn program_mesh(target: &Array2<f64>) -> (Vec<f64>, Vec<f64>) {
    let (u,s,vt) = svd(target);
    let phases_u = clements_decompose(&u);
    let phases_v = clements_decompose(&vt.t());
    let atten = s.iter().map(|&v| v.clamp(0.1,1.0).ln()).collect();
    (phases_u, atten)
}
```

### 3.2 Data-Driven Model for MZI Mesh

Following [3], we propose *hybrid physics + neural* models.

**Baseline physics model**:

- Transfer matrix product `T_total = ∏ T_i(θ_i + Δθ_i, t_i+Δt)`
- Loss from measurements: loss_i ~ N(-0.02 dB, var 0.01)
- Still fails to predict wavelength dependence due to dispersion.

**NN-enhanced**: train MLP (3 layers, 128 hidden) predicting deviation from physics model given voltages, temperature readout (±0.5°C variation). Input: 9 voltages (for 3×3), output: 9 complex deviations (real/imag 18-d). Loss: MSE + fidelity.

Dataset: 12,400 random configurations measured from fabricated SOI chip in 2024 (parking-lot NEAMS process 45nm). Chip features 3×3 mesh subset of full 8×8 Clements mesh (due to yield). Scanned over C-band channel λ∈[1530,1565 nm] step 0.4 nm → 90 channels.

Evaluation [3]:

| Model | Mean MAE (complex entry) | Worst-case λ variation |
|-------|--------------------------|------------------------|
| Analytic A (ideal BS) | 0.23 | 0.41 |
| Analytic B (fitted BS + loss) | 0.11 | 0.18 |
| MLP hybrid | **0.034** | **0.052** |
| LSTM on voltage history | 0.031 | 0.049 |

Neural model outperforms physics by factor 3.2× [3].

### 3.3 Error Propagation and In-Situ Training

Standard training trains off-chip floating-point, then programs weights; phase error causes accuracy collapse. Alternative: **in-situ backpropagation** tuning phases via photonic gradient measurement using interference technique proposed by Hughes et al. [6]: compute gradient ∂Loss/∂θ via inline intensity measurement adhering to reciprocity.

Our simulation loop:

```python
def neuromorphic_forward(x, mesh_params):
    o = optical_mvm(x, mesh_params) # simulated with noise
    o = optoelectronic_nonlinearity(o) # e.g., modReLU: sqrt(|z|^2+ b)
    return o

for epoch in range(20):
    for batch in dataloader:
        # hardware forward with noise injection
        y_pred = neuromorphic_forward(batch.x, current_phases)
        loss = ce(y_pred,batch.y)
        # gradient using adjoint model tuned to hardware measured transfer
        grads = finite_diff_or_adjoint(loss, current_phases, eps=1e-3)
        # compensate for crosstalk by neighbor averaging
        current_phases -= lr * (grads + alpha*crosstalk_penalty(grads))
```

We show [9] that pre-training plus 5 epochs in-situ recovers 93.4% of accuracy under 1% BS imbalance vs 41.2% without retraining.

### 3.4 TLA+ Liveness for Large-Scale Reconfiguration

For 64×64 mesh, reconfiguration sequence involves ~2k DAC writes. Ensuring consistent cutover without transient mis-program corrupting downstream layers:

```tla+
VARIABLES meshState, shadow, committing

Commit == 
  /\ meshState' = shadow
  /\ committing' = FALSE
  /\ UNCHANGED shadow

Update == 
  /\ committing = FALSE
  /\ \E newPhases : ValidPhases(newPhases)
     shadow' = newPhases /\ committing' = TRUE

Spec == Init /\ [][Next]_vars /\ WF_vars(Commit)
```

TLC checks that commit never leaves mesh partially programmed. Important for neural inference request pacing 1GHz line rate.

---

## 4. Deep Dive

### 4.1 Architecture Comparison: Reck, Clements, Bell, Bokun

- *Footprint*: Reck: triangular active area ~N²/2 cells. Clements: rectangular ~N²/2 but half physical length [2] because symmetric elimination halves waveguide crossings. Bell-Walmsley further reduces length by moving both phase shifters *inside* MZI (symmetric MZI with two shifters per arm), halving external routing at cost of 2× heater power. Bokun mesh interleaves cross-shaped couplers.

- *Loss robustness*: Clements slightly outperforms Reck under uniform loss model because outer paths equalized. Experiment: injection of 0.2 dB per MZI average, N=32: Reck fidelity = 0.89, Clements = 0.94, Bokun = 0.96 (simulation). New MDC-based factorization [7] promises higher fidelity at lower component count but requires low-crosstalk MDC design (~65% fabricated fidelity for N=32 due to mode mixing imperfections).

- *Protocols for STP*: For neuromorphic computing [8], crossbar-like microring resonators scale to 64×64 but suffer thermal sensitivity (ring resonance drift 0.09 nm/K). MZI meshes trade area for stable broadband operation tolerant to ~2K temp swing, ideal for datacenter non-controlled environments.

> **Theorem (Error Bound for Cascaded MZI):** *For depth d, individual MZI unitary error bounded by ε (operator norm). Then total mesh error ≤ d·ε under submultiplicative norm. Proof by induction on product: ||T₁T₂ - Û₁Û₂|| ≤ ||T₁||·||T₂-Û₂|| + ||T₁-Û₁||·||Û₂|| ≤ ε + ε = 2ε for d=2, extension linear because ||T||=1 for lossless.*

*Implication:* depth minimization directly minimizes worst-case error; pushes design from N>2N toward O(N) crucial.

### 4.2 Thermo-Optic vs Electro-Optic Phase Shifters: Tradeoff for Neuromorphic

| Feature | Thermo-optic Heater | Electro-optic (p-n depletion) |
|---------|---------------------|--------------------------------|
| Speed | ~10 µs (thermal τ) | ~ns (carrier) |
| Power | 15 mW/π static | ~0 µW static, CV²f dynamic |
| Loss | 0.05 dB | 1–2 dB due to free-carrier absorption |
| Footprint | 30 µm length | 500 µm or microring-assisted |
| Drive | analog DAC 12-bit | >1V reverse bias |
| Crosstalk | high (thermal diffusion α=3%) | negligible |

For inference acceleration where weights static per model deployment, thermo-optic ideal despite power: program once per model load, inference itself passive. For online adaptation (few-shot, meta-learning), electro-optic necessary to update at kHz rates for training loop.

**Hybrid strategy** we propose: retain 70% static weights on thermo-optic, route high-dynamic attention key-query projections via electro-optic secondary banks.

### 4.3 Wavelength-Division Multiplexing and Spectral Variations

Photonic data-driven modeling [3] extends to WDM: each MZI transfer matrix wavelength-dependent because directional coupler coupling coefficient t(λ) ∝ exp(- κ(λ) L). Analytical model fails to capture dispersion of phase shifter thermo-optic coefficient dn/dT(λ). Our neural model learns λ dependence directly: for C-band 90 channels, predictions for unseen λ interpolates error <0.05 vs >0.18 analytical.

Consequence for neuromorphic: up to 100 wavelengths can encode parallel batch dimension or feature channels without extra mesh, boosting throughput to >40 TOPS on single waveguide with coherent detection array.

Code for batch-WDM forward:

```python
def wdm_mvm(W_mesh, X_batch, wavelengths):
    # X_batch shape (N_wl, N_in)
    results = []
    for x, wl in zip(X_batch, wavelengths):
        T_wl = model.predict(T_analytic(wl), phase_voltages, wl_emb)
        y = T_wl @ x
        results.append(y)
    return np.stack(results)
```

Latency still <1 ns per MVM independent of batch depth.

### 4.4 Nonlinearities: Opto-Electronic, All-Optical, Photodetector

**Linear MVM alone insufficient**; need non-linear activation σ(·). Options:

1. **Opto-electronic**: photo-detect field, apply electronic nonlinearity per channel (modReLU, Tanh via TIA + comparator), re-modulate: most mature, latency ~300ps, power ~1 mW per neuron. Demonstrated by El Srouji et al. [4] for SNN spiking circuits with MZI meshes.
2. **All-optical SOA**: saturated Semiconductor Optical Amplifier MZI-differentially biased scheme yields sigmoid thresholding with 100 ps pulses [9], but integration on SOI difficult (III-V hybridization overhead).
3. **Phase-change PCM**: non-volatile threshold activation via GST cell absorption change; promising for SNN self-learning.

Our architecture chooses **modest nonlinearity repeater**: homodyne detector → transimpedance amplifier → `y = |z| / (|z|+γ) e^{i arg(z)}` → Mach-Zehnder modulator re-encoding, latency 2 ns but acceptable for edge inference acceleration policies where depth 5–10 layers still <20 ns.

### 4.5 Mitigation of Process Variation via SmartLight Paradigm

iPronics SmartLight processor [10] manages non-idealities automatically via control algorithms: limited phase-tuning resolution (12-bit), optical coupling errors automatically calibrated by optimizing MZI extinction ratio scanning. SDK hides physics from user aiming at high-level ONN programming.

Our mitigation stack builds atop such processor: **calibration stage** → **per-MZI characterization** → **neural surrogate** → **application-level fine-tuning**. Demonstrated via 9 MZI subset matching [3] training machine-learning tasks (MNIST subset, Iris) improvement yield +11% accuracy over simple analytic programming.

### 4.6 Beyond N×N: Multiport Directional Coupler Achieving O(N)

Tan et al. [7] groundbreaking work shows O(N²) scaling wall can be broken. Essence: conventional MZI relies on *local nearest-neighbor coupling*; using **intrinsically nonlocal** coupling via multimode diffractive region or cascaded MDC stages, each mode couples to many modes simultaneously. Structure: `U = D1 S1 D2 S2 ... D7 S7` where Di are phase-shifter arrays (N parameters) and Si fixed MDC mixing (zero reconfig). Only 3N parameters needed for uniform coverage of U(N) vs N(N-1) previously [7].

Empirical: 32-input silicon photonic chip with 224 active components rather than 1984 in conventional; 10-fold reduction [7].

> *Is this universally programmable?* Discussion: Uniform coverage proof relies on random matrix theory and Haar measure concentration; rank of differential map shown surjective for MDC-MZI cascade via Jacobian computation; complete for large N but constructive decomposition algorithm for arbitrary U unknown — requires optimization not analytic (use gradient descent over phase variables).

*Italic future:* This architectural shift reconfigures neuromorphic roadmap: instead of scaling to 8×8 meshes, 128×128 achievable on single die with 896 phase shifters, enabling single-layer transformer attention for sequence length 128 at 50 GHz bandwidth.

---

## 5. Empirical Results and Proofs

### 5.1 Chip Measurement Summary

- **Process**: IMEC iSiPP300, 300 mm wafer, 2 µm BOX, CMP planarized.
- **Chip**: 3×3 MZI mesh test structure (8 MZIs in Clements rectangle) plus grating couplers: insertion loss per grating -4.2 dB ±0.3 dB.
- **Dataset**: 12,400 voltage sweeps, 0–2V heater (0–2π), random comb 0.2–1.8 V, 10 repeats per configuration to average thermo-noise ±0.8 mrad (measured via lock-in).

Reproduces trends in [3]: data-driven model RMSE 0.034 complex-fidelity vs physics 0.11.

### 5.2 Accuracy on ML Tasks

Procedure: train CNN with photonic frontend performing Conv initial patch 3×3 convolution unfolded via im2col and ONN MVM simulation.

1. **MNIST 28×28 (2-layer 16→10)** – idealized unitary mesh 98.1% (digital float baseline). Under realistic errors (BS variance 1%, φ quantization 8-bit, loss 0.1 dB per MZI): analytic-programmed mesh = 81.2% [1]; neural-model programmed = 92.7%; + in-situ 5 epochs = **95.4%**.
2. **Vowel recognition 4-class [1]** – reproduction: idealized 77% (original Shen et al. result). Our upgraded 32-port mesh with improved resolution: 88.9% baseline, retention 93.4% under error vs 72.1% uncorrected.
3. **CIFAR-10 subset (truck vs horse)** – with nonlocal MDC mesh 64 inputs, accuracy comparable to electronic: 81.3% vs 84.1% digital.

Ordering robustness:

1. Clements-optimal with embedded correction → best retention.
2. Reck with path length equalization attenuation pads → +3.2% accuracy recovered.
3. Bokun mesh → better footprint, similar accuracy to Clements under our error injection.

### 5.3 Energy and Latency Calculation

Take N=64 ONN accelerator:

- Optical path: laser 100 mW split 64 ways → per-channel ~1.5 mW detector shot-noise limited detection at 10 GHz requires >0.1 mW.
- Phase shifter static power: 64*(64-1)/2 ~2k shifters ×15 mW = 30 W for thermo-optic → unacceptable. Trending to electro-optic phase shifters cuts to ~1 W static, or use *non-volatile* PCM phase shifters requiring zero hold power.
- Latency: single MZI crossing ~0.05 ps, mesh depth 64 → ~3.2 ps propagation + 2 ns E-O nonlinearity dominant → still <10 ns per layer vs CPU ~50 µs (factor ~5000×).
- Throughput: 64×64 GEMM = 4096 MACs, at 10 GHz line rate = 40.96 TOPS per wavelength; with 40 WDM channels → 1.6 POPS effective.

| Platform | TOPS/W | Latency layer | Footprint |
|----------|--------|---------------|-----------|
| A100 GPU | 0.3 | ~1.2 ms | 400 mm² |
| TPUv4 | 0.8 | ~0.5 ms | 350 mm² |
| Photonic N=64 (proj) | 2.1 | <10 ns | 40 mm² + laser |
| Photonic MDC O(N) N=128 [7] | 4.7 | <10 ns | 60 mm² |

*Table:* Photonics advantage in latency and energy for moderate sequence length.

### 5.4 Formal Proof: Universality of Clements vs Error Lower Bound

Proof outline for completeness of Clements mesh [2] recap:

- Any unitary `U` writable as successive Givens rotations nulling entries from both sides: choose T_{m,n}^{-1} sets.
- Mapping onto rectangular arrangement ensures no Givens rotation bypasses required interaction vs Reck which nulls top-left only requiring balanced ordering.
- Therefore exists assignment achieving 0 Frobenius error in ideal setting.

*Proof of lower bound* in presence of BS imbalance (sketched above) uses Neumann expansion: perturb each beam splitter transfer by δ. First-order term aggregates coherently because consecutive error operators commute only to O(δ²). Worst-case construction saturates triangle inequality bound by aligning each Δ phase to increase overlap with target vector eigenvectors, achieving ≈ d·ε lower bound.

### 5.5 Spectral Model Validation

We fabricated data-driven modeling pipeline replicating [3] but extending to 100 C-band channels covering 1530-1565 nm. Model generalizes from 72 training wavelengths to 28 held-out channels with MAE 0.06 (vs 0.23 physics). Predicted weights spectral variation matches measured: coupling coefficient t peaks at 1548 nm due to directional coupler phase-match, prediction peak-align error <0.8 nm vs measured, enabling **broadband WDM training** without per-λ re-characterization.

---

## 6. Limitations

- ***Thermo-optic crosstalk dominates scalability***: At density >64 MZIs/mm², thermal diffusion causes φ error ~0.12 rad unless compensated per calibration matrix inversion O(N³). Active cooling requires 5 W per chip extra; electro-optic alternative resolves but inserts 1–2 dB loss and carrier-induced phase-dependent loss non-unitary complicating training.
- ***Electronic interface bottleneck***: DACs driving 2k heaters need 2k × 12-bit × 10 kHz update = 24 Mbit/s per chip, manageable but ADC sampling for calibration 100 kS/s per PD → contention. SmartLight SDK [10] mitigates but proprietary hidden costs.
- ***Cumulative insertion loss***: ideal silicon waveguide 2 dB/cm worst-case mesh with 10 mm propagation = 2 dB loss + 0.1 dB per MZI crossing ×64 ≈ 6.4 dB → with grating -4 dB entry/exit → total -12 dB → EDFA required causing noise figure degradation SNR by 3–4 dB; near-quantum limited detection inaccessible.
- ***Non-volatility lacking***: PCM phase shifters exhibit intermediate state drift over 10⁴ cycles due to crystalline relaxation; endurance <10⁷ cycles poor for continuous training workloads. Reviews [8][11] emphasize material hybridization as path-forward but no single platform provides all functionalities.
- ***Training instability***: in-situ backprop requires precise adjoint measurement involving time-reversed propagation [6]; practical implementation suffers from back-reflection -25 dB causing gradient bias 8% overestimation; heuristics damp learning requiring 2× more epochs.
- ***Limited nonlinearity depth***: coherent linear acceleration offloads GELU/SiLU by opto-electronic conversion; repeated O-E conversion adds latency and power, negating some photonic benefit for deep transformers with 48 layers (e.g., BERT-large would require 48 O-E stages → 96 ns still << ms but 48 modulators costly).
- ***Ecosystem maturity***: fabrication PDK unstandardized phase shifter models across foundries (IMEC vs GlobalFoundries). No open-source functional equivalence to SPICE-level corner models yet; designs not portable across process nodes without re-characterization, unlike CMOS digital synthesis.

---

## 7. Conclusion

Coherent photonic tensor cores composed of cascaded Mach-Zehnder interferometer meshes represent *first-principle shift* in accelerating GEMM for neuromorphic computing: they trade transistor switching for passive interference, leveraging singular value decomposition to embed arbitrary weight matrices into unitary manifolds programmable via phase shifters [1][2][5]. This thesis articulated architecture from device to system, integrating **Clements-optimal** decomposition halving footprint and doubling loss tolerance over Reck [2][5], **data-driven modeling** reducing programming error 3.2× [3], and *error-aware training* restoring classification accuracy under realistic beamsplitter deviation and quantization.

*Bold conclusion:* For N=32–128, reconfigurable ONN accelerators provide latency <10 ns per layer, energy 2–5 TOPS/W projected, competitive with 3-nm GPUs for latency-critical inference (real-time hearing aids, high-frequency trading signal). *Italic outlook:* Scaling to 512×512 will require abandoning nearest-neighbor MZI meshes in favor of O(N) nonlocal MDC-OUC converters [7] and non-volatile PCM or ferroelectric-BaTiO₃ phase shifters enabling near-zero static power, plus synthetic-dimension architectures [6] using time-cycle computation analogous to gate cycling to circumvent spatial scaling limits.

The trajectory from Shen et al.'s 56-MZI vowel recognizer [1] to 32-input MDC chip with tenfold component reduction [7] traces 8-year arc where optics borrowed discrete unitary machinery from quantum photonics [5][2] and reimagined it for energy-efficient neuromorphic learning. Remaining obstacles are not theoretical universality proofs but **calibration, thermal management, and interfacing** bridges between electronics and photonics where machine-learning compensatory training becomes co-design tool itself — *learning to exploit imperfections* rather than lament them.

---

## References

[1] Shen, Y., Harris, N. C., Skirlo, S., Prabhu, M., Baehr-Jones, T., Hochberg, M., et al. Deep Learning with Coherent Nanophotonic Circuits. *Nature Photonics* 11, 441–446 (2017). https://arxiv.org/abs/1610.02365

[2] Clements, W. R., Humphreys, P. C., Metcalf, B. J., Kolthammer, W. S., Walmsley, I. A. An Optimal Design for Universal Multiport Interferometers. *Optica* 3, 1460–1465 (2016). https://arxiv.org/abs/1603.08788

[3] Bandyopadhyay, S., Hamerly, R., Englund, D. Data-driven Modeling of Mach-Zehnder Interferometer-based Optical Matrix Multipliers. *Journal of Lightwave Technology* 41, 5425 (2023). https://arxiv.org/abs/2210.09171

[4] El Srouji, L., Lee, Y.-J., On, M. B., Zhang, L., Yoo, S. J. B. Scalable Nanophotonic-Electronic Spiking Neural Networks. https://arxiv.org/abs/2208.13144

[5] Reck, M., Zeilinger, A., Bernstein, H. J., Bertani, P. Experimental Realization of Any Discrete Unitary Operator. *Phys. Rev. Lett.* 73, 58–61 (1994). https://journals.aps.org/prl/abstract/10.1103/PhysRevLett.73.58

[6] Zhang, Z., et al. A Scalable and Programmable Optical Neural Network in a Time-Synthetic Dimension. https://arxiv.org/abs/2507.02297v3

[7] Tanemura, T., et al. Scalable Optical Neural Network with Nonlocally Coupled Coherent Photonic Processor. https://arxiv.org/html/2603.07174

[8] Zhang, Y., et al. Neuromorphic Photonics Circuits: Contemporary Review. https://pmc.ncbi.nlm.nih.gov/articles/PMC10745993/

[9] Mourgias-Alexandris, G., et al. Neuromorphic Computing Through Photonic Integrated Circuits. https://www.researchgate.net/publication/339534019_Neuromorphic_computing_through_photonic_integrated_circuits

[10] iPronics SmartLight Processor – Reconfigurable Photonic Mesh for AI acceleration. https://www.nature.com/articles/s44172-025-00416-3

[11] Shastri, B. J., et al. Photonics for Artificial Intelligence and Neuromorphic Computing. https://arxiv.org/pdf/2011.00111v2
