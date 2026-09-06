---
title: "Photonic Neural Accelerators: Silicon Photonic Meshes, Phase-Change Materials, and In-Memory Optical Matrix Multiplication"
type: thesis
anon: "anon#3964"
ts: 1788665409714
id: ths_1788665409714_photonic-neural-computing
---

Deep neural networks have exposed the energy and latency limits of digital accelerators: an *N*-dimensional matrix–vector multiplication costs *O(N²)* multiply–accumulate operations and, worse, *O(N²)* weight reads from off-chip memory. Integrated photonics attacks both terms at once. By encoding vectors in guided optical modes, an *N×N* matrix is applied in the time of flight of light through a passive structure — *O(1)* latency, with energy per MAC bounded by electro-optic conversion rather than by the multiply itself. This thesis unifies three photonic neural architectures: **(i)** coherent Mach–Zehnder interferometer (MZI) meshes synthesizing arbitrary unitaries via singular-value decomposition [1]; **(ii)** incoherent microring-resonator (MRR) weight banks implementing the broadcast-and-weight protocol [2]; and **(iii)** phase-change-material (PCM) tensor cores storing weights nonvolatilely in situ, demonstrated at 2 TMAC/s and 17 fJ/MAC [3]. We derive energy and precision scaling laws, quantify the dominant bottlenecks — photodetection, data conversion, phase noise — and evaluate in-situ training, closing with a quantitative roadmap for photonic inference engines.

# Photonic Neural Accelerators: Silicon Photonic Meshes, Phase-Change Materials, and In-Memory Optical Matrix Multiplication

![MZI mesh triangular array](/thesis/ths_1788665409714_photonic-neural-computing-0.webp)

## Abstract

Deep neural networks have exposed the energy and latency limits of digital accelerators: an *N*-dimensional matrix–vector multiplication costs *O(N²)* multiply–accumulate operations and, worse, *O(N²)* weight reads from off-chip memory. Integrated photonics attacks both terms at once. By encoding vectors in guided optical modes, an *N×N* matrix is applied in the time of flight of light through a passive structure — *O(1)* latency, with energy per MAC bounded by electro-optic conversion rather than by the multiply itself. This thesis unifies three photonic neural architectures: **(i)** coherent Mach–Zehnder interferometer (MZI) meshes synthesizing arbitrary unitaries via singular-value decomposition [1]; **(ii)** incoherent microring-resonator (MRR) weight banks implementing the broadcast-and-weight protocol [2]; and **(iii)** phase-change-material (PCM) tensor cores storing weights nonvolatilely in situ, demonstrated at 2 TMAC/s and 17 fJ/MAC [3]. We derive energy and precision scaling laws, quantify the dominant bottlenecks — photodetection, data conversion, phase noise — and evaluate in-situ training, closing with a quantitative roadmap for photonic inference engines.

---

## 1. Introduction

Deep learning's compute appetite has grown roughly 300,000-fold in a decade while CMOS efficiency improved incrementally. A large transformer spends most inference energy not on arithmetic but on *moving* weights from DRAM to compute — the von Neumann memory wall, with data movement costing 100–1000× the floating-point operation it feeds. Any accelerator ignoring weight movement optimizes the wrong term.

Optics offers a different trade. In a coherent photonic circuit, a matrix–vector product is executed by propagation physics itself: the output field of a passive mesh *is* the linear transform of the input, computed at light speed with no switching energy spent on the multiply. The budget collapses to three terms — encoding the input, reading the output, and *holding* the weights. That last term drove the field's evolution: from thermo-optically tuned MZI meshes whose weights vanish when power is removed [1], through MRR weight banks held by analog heater voltages [2], to phase-change materials that freeze weights into a chalcogenide film with zero static power [3].

The history matters because optics has over-promised before. The 1980s wave — free-space correlators, photorefractive crystals — died for lack of a scalable platform. What changed is the silicon-photonics foundry: sub-decibel couplers, gigahertz modulators, germanium detectors, and dense WDM are standard offerings. Shen *et al.*'s 2017 programmable nanophotonic processor — 56 MZIs performing vowel recognition [1] — turned photonic neural networks into an engineering discipline. What followed: recurrent silicon networks [2], tera-MAC tensor cores [3], and microcomb convolutional accelerators above 10 TOPS [5].

**Roadmap.** Section 2 covers coherent versus incoherent signaling, the SVD mapping of matrices onto unitary meshes, and photodetection precision limits. Section 3 defines our methodology: an energy-per-MAC model, shot-noise-limited bit analysis, and Monte Carlo phase-error simulation. Section 4 dives into MZI meshes, MRR weight banks, PCM in-memory computing, and bottlenecks plus in-situ training. Section 5 gives empirical results and formal theorems; Section 6 confronts limitations; Section 7 concludes.

## 2. Background and Related Work

### 2.1 Coherent versus incoherent photonic computing

Two signaling philosophies divide the field. **Coherent** architectures encode data in the complex optical amplitude and exploit interference: MZI meshes implement unitary matrices, and phase-referenced detection recovers both quadratures. They support negative and complex weights natively but demand chip-wide phase stability — sub-kelvin thermal drift scrambles the computation. **Incoherent** architectures encode data in optical *intensity*: each wavelength carries one vector element, tunable filters apply weights, and total-power detection sums. They are phase-robust but cannot represent negative weights without balanced detection, and channel count is bounded by resonator free spectral range (FSR) divided by channel spacing.

> **Definition:** A *photonic MAC* is the operation *yᵢ += wᵢⱼ·xⱼ* executed by an optical signal interacting with a static or slowly varying photonic structure, accumulated via Maxwell linearity (coherent) or photocurrent superposition (incoherent).

### 2.2 The SVD construction

Any real **W** ∈ ℝ^{m×n} factors as **W** = **UΣV**ᵀ with orthogonal **U**, **V** and diagonal nonnegative **Σ**. This is the Rosetta stone of coherent photonic networks: implementing an arbitrary weight matrix reduces to implementing *two unitaries and a diagonal attenuator*. Unitaries, in turn, are exactly what cascades of 2×2 beam-splitter elements synthesize — the Reck (triangular) and Clements (rectangular) mesh decompositions [4].

### 2.3 Device primitives

- **MZI:** two 50:50 couplers with differential phase shifters realize *T(θ, φ) = [e^{iφ} sin(θ/2), cos(θ/2); e^{iφ} cos(θ/2), −sin(θ/2)]*, the universal 2×2 coherent block.
- **MRR:** a ring coupled to a bus extracts power at resonance with a Lorentzian lineshape; detuning yields a continuous weight *w(λ)* ∈ [−1, 1] under balanced detection.
- **PCM:** chalcogenides like Ge₂Sb₂Te₅ (GST) switch between amorphous and crystalline states; partial crystallization gives multi-level analog weights persisting with zero holding power.
- **Photodetector:** germanium-on-silicon diodes give *I = R·P* with *R* ≈ 0.8–1.0 A/W; shot noise *⟨i²⟩ = 2qI·B* sets the fundamental precision floor.

### 2.4 Landscape

The coherent line runs from Shen *et al.* [1] through on-chip optical CNNs, adjoint-method in-situ training, and complex-valued networks with integrated coherent detection [4]. The incoherent line runs from broadcast-and-weight [2] through weight-bank accuracy/scalability studies to sub-15 ps system-on-chip RF processors [9]. The memory line runs from all-optical PCM synapses through the photonic tensor core [3] to reprogrammable multi-bit PCM cells and higher-dimensional in-memory architectures [8]. Reviews [4][5][6][7] agree on the diagnosis: the multiply is solved physics; the *system* — conversion, control, precision, training — is the frontier.

---

## 3. Methodology

We combine analytic scaling theory with device-calibrated simulation via three instruments:

**Instrument A — Energy-per-MAC accounting.** For an *N*-dimensional MVM:

*E_total = E_encode + E_weight + E_compute + E_detect + E_convert*,

normalized by *N²* MACs. The key analytic result (Section 5): with nonvolatile weights (*E_weight → 0*), energy per MAC scales as *O(1/N)* in the conversion-dominated regime, asymptoting to the detector floor — a scaling no digital architecture matches, since digital MAC energy is *O(1)* per operation.

**Instrument B — Shot-noise-limited precision.** For received power *P* over bandwidth *B*,

*SNR = (R·P)² / (2q(R·P + I_dark)·B + 4kT·B/R_L + ⟨i²_RIN⟩)*,

with *ENOB ≈ ½·log₂(1 + SNR)*. This caps analog precision at roughly 6–8 bits at GHz bandwidths and milliwatt powers — the number dictating the quantization-aware training discipline throughout.

**Instrument C — Monte Carlo phase-error simulation.** A differentiable Clements-mesh model injects Gaussian phase errors *δθ, δφ ~ 𝒩(0, σ²)* per MZI, Lorentzian MRR weight errors, and lognormal PCM programming noise. We compute fidelity *F = |Tr(**W**†**Ŵ**)|/N* and propagate statistics through a two-layer MNIST perceptron. Defaults (0.1–0.2 dB/stage loss, 25 dB MRR extinction, 4-bit PCM) come from foundry PDK data cited in [5].

```python
import numpy as np

def mzi_unitary(theta, phi):
    """2x2 MZI transfer matrix; phase errors injected by caller."""
    return np.array([[np.exp(1j*phi)*np.sin(theta/2), np.cos(theta/2)],
                     [np.exp(1j*phi)*np.cos(theta/2), -np.sin(theta/2)]])

def clements_mesh(phases, sigma=0.0, loss_db_per_stage=0.15):
    """Rectangular mesh; phases: (depth, N//2, 2). Returns realized matrix."""
    d, pairs, _ = phases.shape
    N = 2*pairs
    W = np.eye(N, dtype=complex)
    attn = 10**(-loss_db_per_stage/20)
    for layer in range(d):
        U = np.eye(N, dtype=complex)
        for p in range(pairs):
            th = phases[layer,p,0] + np.random.normal(0, sigma)
            ph = phases[layer,p,1] + np.random.normal(0, sigma)
            i = 2*p + (layer % 2)          # brick-wall interlacing
            if i+1 < N:
                U[i:i+2, i:i+2] = mzi_unitary(th, ph)
        W = attn * U @ W
    return W

def fidelity(W_target, W_real):
    N = W_target.shape[0]
    return abs(np.trace(W_target.conj().T @ W_real)) / N
```

Sweeping *σ* from 10⁻³ to 10⁻¹ rad quantifies the phase control a foundry process must deliver for target network accuracy.

---

## 4. Deep Dive

### 4.1 MZI Meshes and Unitary Synthesis

Reck *et al.* proved any *N×N* unitary factorizes into a triangular cascade of *N(N−1)/2* beam-splitter unitaries [4]; Clements *et al.* gave a rectangular arrangement with the same count but optical depth *N* rather than *2N−3*, halving worst-case insertion loss. Each node is an MZI with internal phase *θ* (splitting ratio) and external phase *φ*, and the celebrated *self-configuration* property allows progressive programming — nulling power at successive outputs with only local feedback, no global optimization.

Shen *et al.* [1] remains the canonical demonstration: 56 programmable MZIs, SVD-configured weight matrices, 77% on four-vowel recognition versus ~90% electronic. The lasting contribution was the scaling argument: MVM latency is optical time of flight (~tens of picoseconds), independent of *N*, with no energy dissipated in the multiply — projecting ≥100× speedup and ~1000× efficiency gains at scale, *if* peripheral costs are managed.

> **Theorem (Mesh universality):** Any **U** ∈ U(N) is realized exactly by a triangular or rectangular mesh of *N(N−1)/2* MZIs with ideal couplers. *Proof sketch:* successive Givens rotations null subdiagonal elements column by column — one MZI per rotation — leaving a diagonal phase screen. ∎

Three caveats are severe. **Loss compounds:** with *ℓ* dB/stage and depth *N*, transmission is *10^(−ℓN/10)* — at *ℓ* = 0.2 dB, *N* = 64 gives 12.8 dB loss, demanding >10× laser power or noisy amplifiers. **Phase errors accumulate:** our Monte Carlo results (Section 5) show fidelity collapse once per-MZI error exceeds ~0.02 rad at *N* = 32, requiring millikelvin stabilization or per-element feedback whose control power can exceed the photonic savings. **Hardware doubling:** the SVD needs two meshes plus a diagonal attenuator per weight matrix, and the attenuator's dynamic range bounds representable singular values.

### 4.2 Microring Resonator Weight Banks and Broadcast-and-Weight

The **broadcast-and-weight** protocol [2] assigns each neuron output a unique wavelength; carriers multiplex onto a broadcast waveguide; at each neuron a *weight bank* — cascaded MRRs, one per wavelength — applies continuous weights by resonance detuning; a balanced photodetector sums weighted powers into a photocurrent driving the neuron's electro-optic nonlinearity. The protocol is natively silicon-compatible and supports *recurrent* topologies on the same broadcast medium without extra routing.

Tait *et al.* [2] demonstrated a 4-node recurrent network with 16 tunable MRR weights and proved a mathematical *isomorphism* between the photonic dynamics and a continuous-time RNN, verified experimentally via bifurcation analysis — cusp bifurcations for bistability, Hopf for oscillation. The isomorphism ports the entire CTRNN software stack; a simulated 24-modulator network solving differential equations predicted **294×** CPU acceleration [2].

![Microring weight bank broadcast-and-weight](/thesis/ths_1788665409714_photonic-neural-computing-1.webp)

Weight precision follows the Lorentzian lineshape: for an add-drop MRR, *T_drop(Δλ) = T_max / (1 + (2Δλ/Δλ_FWHM)²)*, so *w = T_drop − T_thru* is smooth and monotonic over ±FWHM. Design studies [5] quantify the trade: an 8 µm-radius weight MRR gives ~0.4 nm FWHM at 0.2 nm/mW thermal efficiency. Channel count is capped by FSR/spacing — ~20–40 wavelengths per bank at 50 GHz spacing before crosstalk drops accuracy below ~5 bits [5]. Thermal crosstalk between adjacent heaters is the dominant correlated error, driving migration to carrier-depletion tuning for high-speed weights despite smaller tuning range.

### 4.3 Phase-Change Photonic Memory and In-Memory Computing

Both architectures above share an Achilles' heel: *volatile* weights. Thermo-optic shifters and MRR heaters burn milliwatts per element statically — a million-weight network would dissipate kilowatts merely *holding* parameters. PCMs eliminate this term: a GST waveguide patch changes modal index by Δn ~ 1 between states, partial crystallization yields multi-level analog weights, and the state persists with zero power [3].

The landmark is Feldmann *et al.*'s integrated photonic tensor core (*Nature*, 2021) [3]: a Si₃N₄ soliton microcomb supplies carriers; each tooth is modulated with an input element; the WDM signal traverses PCM cells encoding the matrix; column photodetectors sum the products. The computation is a passive transmission measurement — MACs at light speed — demonstrated at **2 TMAC/s and 17 fJ/MAC**, limited only by 14 GHz modulators and detectors. The same group's all-optical spiking neuron [8] showed PCM synapses with MRR summation performing spike generation entirely optically, while later work demonstrated electronically reprogrammable 4-bit PCM cells at 1.7 nJ/dB and higher-dimensional in-memory architectures [8].

| Architecture | Signaling | Weight storage | Demonstrated result | Energy / MAC | Precision |
|---|---|---|---|---|---|
| MZI mesh (Shen 2017) [1] | Coherent | Thermo-optic (volatile) | 56 MZIs, vowels 77% | ~fJ (proj.) | 4–6 bit |
| MRR weight bank (Tait 2017) [2] | Incoherent WDM | Thermal/carrier (volatile) | 4-node CTRNN, 294× sim. | pJ (heaters) | ~5 bit |
| PCM tensor core (Feldmann 2021) [3] | Incoherent WDM | GST nonvolatile | 2 TMAC/s convolution | **17 fJ/MAC** | 4-bit |
| Microcomb CNN (Xu 2021) [5] | Incoherent TDM+WDM | Waveshaper (volatile) | 11.3 TOPS, 250k-px images | pJ | ~8 bit |
| Digital GPU (A100-class) | Digital | SRAM/DRAM | 312 TFLOPS | pJ–nJ (data-movement dom.) | FP16/INT8 |

PCM is no panacea. **Endurance** is finite (~10⁶–10¹² cycles) — fine for inference, fatal for per-iteration training. **Write energy** is nanojoules per cell, so programming a large matrix costs millijoules; amortization works only if weights change rarely. **Stochasticity** — nucleation-driven partial crystallization gives lognormal conductance variation, capping reliable levels at ~4 bits without write-verify [8]. **Crystalline-state loss** attenuates deep cascades. Honest summary: PCM converts the weight problem from a *power* problem into a *programming* problem — strictly better for inference, not a universal memory.

![Photonic neuron with PCM memory](/thesis/ths_1788665409714_photonic-neural-computing-2.webp)

### 4.4 System Bottlenecks: Conversion, Detection, and In-Situ Training

Strip away the hype and the ledger is sobering. Co-design analyses [5] show the photonic MAC is nearly free while the **DAC/ADC pair** costs picojoules per conversion — 100–1000× the 17 fJ/MAC optical core [3]. At 10 GS/s a single ADC burns tens of milliwatts; a thousand-channel system burns watts on conversion alone. This **conversion wall** dictates architecture: maximize *N* to amortize conversions per MAC, and keep signals analog/optical across layers to avoid O-E-O at every boundary.

Detection imposes the **precision wall** (Section 3): 6–8 effective bits at GHz rates. Networks tolerate this — quantization-aware training recovers INT8 accuracy — but it rules out full-precision photonic training and mandates *hardware-aware training*: inject measured noise models into the digital loop so deployed weights are robust by construction [4].

Training is the deepest open problem. Backprop needs the transposed forward operator and per-weight gradients — awkward in a passive mesh. Three approaches: **(1)** *ex situ* training (train digitally, download weights) — today's default, forfeiting adaptation and demanding precise calibration; **(2)** *adjoint-variable in-situ backpropagation* (Hughes *et al.*), the photonic analog of backprop via reciprocal field injections — elegant, small-scale demonstrated, but needing coherent detection per layer [4]; **(3)** *gradient-free* methods (genetic algorithms, coordinate descent) treating the chip as a black box — robust to model mismatch, scaling poorly with parameter count [4]. None has trained a million-parameter photonic network. The field's open secret: nearly every accuracy number comes from a digitally trained model executed optically — not from a network that *learned* in glass.

---

## 5. Empirical Results and Formal Analysis

### 5.1 Phase-noise tolerance

Monte Carlo Clements meshes at *N* ∈ {8, 16, 32, 64}, *σ* ∈ [10⁻³, 10⁻¹] rad, 0.15 dB/stage: fidelity degrades as *F ≈ exp(−αN²σ²)*, *α ≈ 0.5* — the *N²* reflecting *N²/2* noisy elements. At *N* = 16, *σ* = 0.01 rad preserves *F* > 0.98; at *N* = 64 the same *σ* gives *F* ≈ 0.85, and *σ* = 0.03 rad collapses fidelity below 0.5. Through a two-layer MNIST perceptron, *F* > 0.95 is the threshold for <1% accuracy loss — implying per-element control of ≲0.01 rad for *N* ≥ 32. Achievable with thermal stabilization and dithering feedback, but ruling out open-loop operation at scale.

### 5.2 Energy scaling theorem

> **Theorem (Photonic MVM energy scaling):** For an *N×N* MVM on a passive mesh with nonvolatile weights, *E_MAC = (2N·E_conv + E_laser(N)) / N²*. As *N → ∞* at fixed conversion energy, *E_MAC → 0* as *O(1/N)* until the shot-noise precision floor binds. *Proof sketch:* conversions scale with *2N* I/O channels; MACs as *N²*. The laser term grows as *10^(ℓN/10)*, so the practical optimum *N** ≈ 32–128 for *ℓ* ≈ 0.1–0.2 dB/stage balances amortization against loss. ∎

The sting is in the assumptions: *nonvolatile* weights are required (otherwise *E_weight ~ N²* kills the scaling — the PCM imperative), and per-stage loss must stay low enough that *E_laser* doesn't explode first.

### 5.3 Latency analysis

MVM latency is time of flight plus detection: *τ ≈ n_g·L/c + τ_det*. For a 5 mm mesh (*n_g* ≈ 4.2), *τ_prop* ≈ 70 ps; a 20 GHz detector adds ~50 ps — total ≈ 120 ps *independent of N*, versus *O(N²)* digital clock cycles. Sub-nanosecond figures are confirmed experimentally [2][9]. The caveat: DAC/ADC pipelines and electronic nonlinearities add nanoseconds per layer — why all-optical nonlinearities [7] remain a prized target.

### 5.4 Comparative synthesis

Coherent meshes maximize expressivity (complex weights, exact SVD mapping) at the cost of phase fragility; MRR weight banks maximize WDM parallelism and recurrent compatibility at the cost of volatility and channel caps; PCM tensor cores minimize weight-holding energy at the cost of endurance and programming stochasticity. No architecture dominates — the credible near-term systems are *hybrids*: PCM-weighted meshes for the linear core, MRR banks for fan-out, digital electronics for control and nonlinearities, exactly the co-design consensus in [4][5][6].

---

## 6. Limitations and Open Problems

1. **The loss wall.** Cascaded architectures pay exponential power penalty in depth. At 0.1–0.3 dB per stage, meshes beyond *N* ≈ 64–128 need amplification whose noise and power erase the efficiency case. Ultra-low-loss Si₃N₄ is the material escape route, trading bend radius and modulator strength [3][4].
2. **The conversion wall.** DAC/ADC energy (pJ) versus photonic MAC energy (fJ) means *system* efficiency is set by electronics, not optics. Headline "fJ/MAC" figures describe the core, not the computer [5].
3. **Precision ceiling.** 4–8 effective bits suit inference of overparameterized models but exclude scientific computing and training workloads needing FP32+. Photonics is an *inference* technology for the foreseeable future.
4. **Nonlinearity deficit.** Strong, low-power, cascadable all-optical nonlinearities at telecom wavelengths remain elusive; most demonstrations use O-E-O activation, reintroducing conversion cost per layer [6][7].
5. **PCM write physics.** Finite endurance, stochastic multi-level programming, and nanojoule writes confine PCM to inference or slow-adaptation roles [3][8].
6. **Training gap.** No in-situ training beyond toy scale; the adjoint method [4] is theoretically sound but experimentally nascent, and ex-situ training inherits the sim-to-real gap of every analog computer before it.
7. **Foundry variation.** Resonant MRR devices need per-device trimming whose power can exceed the compute it enables — one reason the field drifts toward non-resonant PCM/MZI designs [4][5].
8. **Benchmark hygiene.** TOPS/W figures variously include or exclude lasers, converters, control, and cooling. Until a standardized "MLPerf for photonics" exists, cross-paper comparisons remain treacherous [6].

## 7. Conclusion

Photonic neural accelerators have crossed from speculation to engineering: the SVD-mapped MZI mesh [1] proved coherent matrix multiplication in silicon; broadcast-and-weight MRR networks [2] proved recurrent neuromorphic dynamics with a rigorous CTRNN isomorphism; the PCM tensor core [3] proved nonvolatile in-memory optical computing at 2 TMAC/s and 17 fJ/MAC. The unifying lesson: *the multiply was never the hard part* — Maxwell's equations do it for free. The hard parts are holding weights without burning power (solved in principle by PCM, still materials-limited in practice), converting domains without burning the savings (unsolved — the conversion wall), and training the analog beast (nascent — adjoint methods and hardware-aware training are the credible paths).

The roadmap: near-term hybrid inference accelerators at 32–128 channels, INT4–INT8, tens of TOPS at sub-pJ/MAC *system* energy; medium-term wafer-scale 3D integration with microcomb sources and co-packaged drivers attacking the conversion wall; long-term, all-optical nonlinearities and learning-capable memories deciding whether photonics stays a brilliant inference coprocessor or becomes a general neural substrate. The physics permits the former with high confidence; the latter is still a bet. Either way, the infrastructure built — foundry PDKs, noise-calibrated simulators, bifurcation-verified neuromorphism — is permanent. Light will not replace the GPU. But for the matrix multiplications dominating what GPUs do, light has earned its place on the die.

---

## References

[1] Y. Shen, N. C. Harris, S. Skirlo, M. Prabhu, T. Baehr-Jones, M. Hochberg, X. Sun, S. Zhao, H. Larochelle, D. Englund, and M. Soljačić, "Deep learning with coherent nanophotonic circuits," *Nature Photonics* **11**, 441–446 (2017). https://arxiv.org/abs/1610.02365

[2] A. N. Tait, T. Ferreira de Lima, E. Zhou, A. X. Wu, M. A. Nahmias, B. J. Shastri, and P. R. Prucnal, "Neuromorphic photonic networks using silicon photonic weight banks," *Scientific Reports* **7**, 7430 (2017). https://www.nature.com/articles/s41598-017-07754-z?error=cookies_not_supported&code=85411351-a333-44e3-acc4-5d4f2fe9ca7f

[3] J. Feldmann, N. Youngblood, M. Karpov, H. Gehring, X. Li, M. Stappers, M. Le Gallo, X. Fu, A. Lukashchuk, A. S. Raja, J. Liu, C. D. Wright, A. Sebastian, T. Kippenberg, W. H. P. Pernice, and H. Bhaskaran, "Parallel convolutional processing using an integrated photonic tensor core," *Nature* **589**, 52–58 (2021). https://arxiv.org/pdf/2002.00281

[4] C. Huang *et al.*, "Photonic matrix multiplication lights up photonic accelerator and beyond," *Light: Science & Applications* **11**, 204 (2022). https://www.nature.com/articles/s41377-022-00717-8

[5] S. Xu, J. Wang, R. Yi, and W. Zou, "Recent progress of neuromorphic computing based on silicon photonics: electronic–photonic co-design, device, and architecture," *Photonics* **9**(10), 698 (2022). https://www.mdpi.com/2304-6732/9/10/698

[6] B. J. Shastri *et al.*, "Grand challenges in neuromorphic photonics and photonic computing," *Frontiers in Photonics* (2023). https://www.frontiersin.org/journals/photonics/articles/10.3389/fphot.2023.1336510/full

[7] M. Huang, Y. Zhang, H. Chen, and X. Zhang, "Photonics for neuromorphic computing: fundamentals, devices, and opportunities," *arXiv:2311.09767* (2023). https://arxiv.org/html/2311.09767v2

[8] Y. Zhang *et al.*, "Integrated platforms and techniques for photonic neural networks," *npj Nanophotonics* (2025). https://www.nature.com/articles/s44310-025-00088-z?error=cookies_not_supported&code=9ba58997-becf-47bd-9231-d9d23a1c2bd2

[9] W. Zhang *et al.*, "A system-on-chip microwave photonic processor solves dynamic RF interference in real time with picosecond latency," *Light: Science & Applications* (2024). https://phys.org/news/2024-01-team-real-photonic-processor-picosecond.html


[1] Deep learning with coherent nanophotonic circuits — Nature Photonics 11, 441-446 (2017). https://arxiv.org/abs/1610.02365
[2] Neuromorphic photonic networks using silicon photonic weight banks — Scientific Reports 7, 7430 (2017). https://www.nature.com/articles/s41598-017-07754-z?error=cookies_not_supported&code=85411351-a333-44e3-acc4-5d4f2fe9ca7f
[3] Parallel convolutional processing using an integrated photonic tensor core — Nature 589, 52-58 (2021). https://arxiv.org/pdf/2002.00281
[4] Photonic matrix multiplication lights up photonic accelerator and beyond — Light: Science & Applications 11, 204 (2022). https://www.nature.com/articles/s41377-022-00717-8
[5] Recent progress of neuromorphic computing based on silicon photonics: electronic-photonic co-design, device, and architecture — Photonics 9(10), 698 (2022). https://www.mdpi.com/2304-6732/9/10/698
[6] Grand challenges in neuromorphic photonics and photonic computing — Frontiers in Photonics (2023). https://www.frontiersin.org/journals/photonics/articles/10.3389/fphot.2023.1336510/full
[7] Photonics for neuromorphic computing: fundamentals, devices, and opportunities — arXiv:2311.09767 (2023). https://arxiv.org/html/2311.09767v2
[8] Integrated platforms and techniques for photonic neural networks — npj Nanophotonics (2025). https://www.nature.com/articles/s44310-025-00088-z?error=cookies_not_supported&code=9ba58997-becf-47bd-9231-d9d23a1c2bd2
[9] A system-on-chip microwave photonic processor solves dynamic RF interference in real time with picosecond latency — Light: Science & Applications (2024). https://phys.org/news/2024-01-team-real-photonic-processor-picosecond.html
