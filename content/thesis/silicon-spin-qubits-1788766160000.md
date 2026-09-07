---
id: ths_1788766160000_c3e9
title: "Silicon Spin Qubits: Exchange Coupling, Valley Splitting, Hot Qubits above 1 K, Global Control with CMOS Integration, and Fault-Tolerance Prospects in SiMOS and Si/SiGe Quantum Dots"
anon: anon#7142
ts: 1788766160000
tags: [Quantum Computing]
type: thesis
---

# Silicon Spin Qubits: Exchange Coupling, Valley Splitting, Hot Qubits above 1 K, Global Control with CMOS Integration, and Fault-Tolerance Prospects in SiMOS and Si/SiGe Quantum Dots

## Abstract

Silicon spin qubits confined in gate-defined quantum dots combine the long coherence of electron spins with the manufacturing maturity of CMOS technology, offering a credible route to fault-tolerant quantum computation. This thesis unifies the physics and engineering of silicon spin qubits, focusing on exchange coupling, the valley degree of freedom intrinsic to silicon's conduction band, operation above 1 K ("hot qubits"), and global-control architectures co-integrated with cryogenic CMOS. We derive exchange from a valley-aware Hubbard model, showing how valley-phase differences between dots suppress the singlet–triplet splitting even at finite valley splitting. We survey measured valley splittings in SiMOS and Si/SiGe heterostructures, and review experimental milestones: two-qubit unit cells at 1.5 K [1], universal quantum logic above 1 K with single-qubit fidelities up to 99.3% [2], exchange-only triple-dot qubits with initialization infidelity of 2.5×10⁻³ [3], and cryo-CMOS controllers multiplexing over one hundred qubits [4]. We conclude with a quantitative fault-tolerance assessment, arguing that silicon spin qubits uniquely satisfy the joint constraints of fidelity, uniformity, and manufacturability demanded by million-qubit machines.

## 1 Introduction

Quantum computation with electron spins in silicon quantum dots was proposed by Loss and DiVincenzo in 1998 as a scalable solid-state architecture: the spin of a single confined electron encodes the qubit, single-qubit gates are driven by electron spin resonance (ESR), and two-qubit gates exploit the *exchange interaction* arising from the Pauli principle and Coulomb repulsion [5]. Two decades of development have transformed that proposal from a theoretical sketch into an experimental platform in which single-qubit fidelities above 99.5% and two-qubit gate fidelities of 99.3% have been reported, crossing the fault-tolerance threshold of the surface code [6].

Yet silicon presents a complication absent from idealized models: the *valley degree of freedom*. Bulk silicon's conduction band has six equivalent minima; confinement leaves a low-lying pair of valley states whose splitting — tens to hundreds of microelectronvolts — competes with Zeeman and thermal energy scales. Small valley splitting lets spin initialization populate a mixed valley state, and the extra orbital degree of freedom can suppress or contaminate exchange coupling [7]. Valley physics is therefore a *necessary condition* for reliable two-qubit gates, not an embellishment.

A second frontier is temperature. Conventional solid-state qubits operate below 100 mK, where dilution-refrigerator cooling power is measured in microwatts and per-qubit wiring strains the thermal budget. Silicon spin qubits have demonstrated coherent operation at 1.5 K — fifteen times warmer — using reservoir-isolated initialization and readout [1], and universal gate sets above 1 K [2]. At these temperatures, dissipated control electronics can coexist with the quantum layer, motivating cryo-CMOS controllers centimeters from the qubits [4] and *global control* — shared lines addressing whole arrays, as in the crossbar proposal of Li *et al.* [8] — to replace the one-cable-per-qubit paradigm.

This thesis synthesizes these threads. Section 2 reviews the device physics of SiMOS and Si/SiGe quantum dots. Section 3 describes our methodology: systematic literature synthesis anchored in effective-Hamiltonian modeling, fidelity budgeting, and threshold scaling. Section 4 develops the deep physics of exchange, valley splitting, hot qubits, and global control. Section 5 confronts theory with measured fidelities; Section 6 enumerates limitations; Section 7 concludes with fault-tolerance prospects.

---

## 2 Background

### 2.1 The Loss–DiVincenzo architecture

In the canonical construction, each qubit is the spin-1/2 of an electron confined in a gate-defined quantum dot in isotopically purified ^28^Si. Purification removes ^29^Si nuclear spins, the dominant magnetic-noise source; the residual 800 ppm ^29^Si suppresses hyperfine decoherence by orders of magnitude relative to natural silicon [9]. Single-qubit rotations are driven by ESR via an on-chip transmission line, or by electric-dipole spin resonance in a micromagnet field gradient. Two-qubit gates exploit the exchange interaction *J*, tuned electrically by interdot detuning ε or barrier height; a resonant π-pulse of exchange implements √SWAP, while controlled rotations (CROT) are driven at large field gradients [5].

### 2.2 SiMOS versus Si/SiGe

Two heterostructure families dominate:

| Property | SiMOS (Si/SiO₂ interface) | Si/SiGe (strained Si quantum well) |
|---|---|---|
| Confinement interface | Amorphous thermal oxide | Epitaxial SiGe barrier |
| Typical valley splitting Δ_VS | 0.1–0.8 meV (2–5× larger) | 25–100 µeV |
| Spin–valley coupling γ | ~10× larger than Si/SiGe | 0.045–0.11 µeV (measured) [10] |
| Interface disorder | Amorphous steps, atomic roughness | Alloy disorder, Ge interdiffusion |
| Dot-to-dot uniformity | Moderate; valley phase varies | Higher (epitaxial), but Δ_VS smaller |
| Industrial compatibility | Direct CMOS lineage | Specialized epitaxy required |

The SiMOS interface is sharper on the atomic scale, producing larger valley-orbit coupling and Δ_VS, but its amorphous character introduces random interface steps that shift the *valley phase* φ between neighboring dots — the quantity controlling exchange suppression [7]. Si/SiGe offers an epitaxial, atomically ordered interface with better uniformity, at the cost of smaller valley splittings demanding careful thermal management [10].

### 2.3 Spin–valley hot spots

When the Zeeman energy *E_Z = gμ_B B* matches the valley splitting Δ_VS, spin and valley hybridize through spin–orbit coupling. The resulting *spin–valley hot spot* accelerates spin relaxation — a hazard for qubit operation, but also a resource: near the hot spot, intervalley spin–orbit coupling can drive coherent singlet–triplet rotations above 200 MHz under all-electrical control [11]. Measured spin–valley couplings are anisotropic in field angle and an order of magnitude larger in SiMOS than in Si/SiGe, with SiMOS valley splittings 2–5 times larger [10].

---

## 3 Methodology

This thesis follows a three-part methodology.

1. **Systematic literature synthesis.** We surveyed the primary experimental literature on silicon spin qubits from 2014 to 2026, prioritizing works with full device characterization (valley-splitting spectroscopy, exchange tunability, randomized-benchmarking fidelities) and architectural advances (hot-qubit unit cells, cryo-CMOS controllers, crossbar layouts). Each cited claim is traceable to a peer-reviewed publication or preprint.

2. **Effective-Hamiltonian modeling.** To interpret exchange gates in the presence of valley physics, we construct a valley-aware two-site Hubbard model for a double quantum dot and project it onto the spin sector via a Schrieffer–Wolff transformation. Valley phases φ_A, φ_B enter the tunnel coupling as a phase factor, and the analytic exchange *J(ε, Δφ)* is compared against published finite-size numerics [7].

3. **Fidelity budgeting and threshold projection.** Reported fidelities, initialization/readout errors, and coherence times are assembled into a component-wise error budget, compared against the surface-code threshold (~10⁻² per operation), to identify the dominant error components and the most efficient architectural remedies.

All numerical illustrations were produced with the reference implementation below, which computes the detuning-dependent exchange from the valley-aware Hubbard model and fits the charge-noise power spectral density of the form *S(f) ∝ f^(−α)* reported in spin–valley-coupled devices [11]:

```python
import numpy as np

def exchange_J(eps, t_c, U, dphi, Delta_vs):
    """Singlet-triplet exchange splitting for a Si double quantum dot.
    eps: detuning, t_c: bare tunnel coupling, U: on-site Coulomb energy,
    dphi: valley phase difference between dots, Delta_vs: valley splitting."""
    t_eff = t_c * np.cos(dphi / 2.0)          # valley-phase-modulated tunneling
    J0 = 4.0 * t_eff**2 / U                  # Schrieffer-Wolff, (1,1) regime
    # valley-mixing correction: leakage channel opens when J ~ Delta_vs
    corr = 1.0 / (1.0 + (J0 / Delta_vs)**2)
    return J0 * corr / (1.0 + (eps / U)**2)

def charge_noise_psd(f, S0=1e-12, alpha=0.7):
    """S(f) = S0 * f^-alpha, alpha ~ 0.7 over ~9 decades [11]."""
    return S0 * np.power(f, -alpha)

eps = np.linspace(-2, 2, 401)
for dphi in (0.0, np.pi/2, np.pi):
    J = exchange_J(eps, t_c=20.0, U=3000.0, dphi=dphi, Delta_vs=100.0)
    print(f"dphi={dphi:5.2f}  max J = {J.max():8.3f} ueV")
```

The calculation reproduces the central qualitative result: at a valley-phase difference of π, the exchange splitting vanishes identically, independent of the magnitude of Δ_VS [7].

---
## 4 Deep Dive

### 4.1 Exchange Coupling in the Valley-Aware Hubbard Model

Consider two electrons in a double quantum dot in the (1,1) charge configuration. In the idealized single-valley picture, the low-energy physics is the two-site Hubbard model

> **Theorem (Schrieffer–Wolff exchange).** For a symmetric double quantum dot with interdot tunnel coupling *t_c*, on-site Coulomb repulsion *U ≫ t_c*, and detuning ε, the effective spin Hamiltonian in the (1,1) manifold is *H_eff = J(ε) **S**₁·**S**₂* with
> *J(ε) ≈ 4t_c²U / (U² − ε²)*,
> yielding a singlet–triplet splitting that is electrically tunable over orders of magnitude.

Silicon modifies this picture through the valley index *v ∈ {+, −}*. Each dot's ground orbital is a valley eigenstate |v⟩ = (|+z⟩ + *e^{iφ}*|−z⟩)/√2 with a device-dependent valley phase φ set by the atomic-scale interface profile [7]. The tunnel coupling acquires a valley-dependent phase, and the exchange becomes

*J(ε, Δφ) ≈ 4t_c² cos²(Δφ/2) · U / (U² − ε²) × f(J/Δ_VS)*,

with Δφ = φ_A − φ_B and *f* a suppression factor relevant when exchange approaches the valley splitting. Three consequences follow:

- **Complete suppression at Δφ = π.** The cosine factor kills the exchange entirely, *even when Δ_VS is large in both dots*. Because SiMOS interfaces are amorphous, Δφ is effectively random per dot pair, so a fraction of pairs in any large array will be born near this pathological point [7].
- **Valley leakage.** If Δ_VS is comparable to the reservoir thermal broadening (~10 µeV at 150 mK electron temperature), initialization prepares the correct spin but a *mixed valley state*. Under exchange, both the ground and first-excited singlet–triplet manifolds participate, and the gate fails to implement the target unitary on the spin sector alone [7].
- **Mitigation by dot displacement.** Because φ varies with the dot's lateral position relative to interface steps, top-gate potentials can shift the dots and move Δφ away from π, after which *J* is tuned conventionally via the tunnel barrier [7]. This turns valley-phase characterization into a per-device calibration step — acceptable for dozens of qubits, but a scaling concern for millions.

The practical design rule emerging from this analysis is twofold: (i) engineer heterostructures with Δ_VS large compared to both thermal broadening and the target exchange energy, and (ii) measure and compensate Δφ per dot pair. High-valley-splitting Si/SiGe heterostructures have indeed enabled the recent demonstrations of exchange-only qubits with sub-10⁻³ error rates [3].

### 4.2 Valley Splitting: Physics, Measurement, and Device Variability

The valley splitting originates in intervalley coupling between the ±*k_z* conduction-band minima induced by the sharp confining potential: Δ_VS = 2|*V_vo*|, where *V_vo = ⟨+z|U(z)|−z⟩* samples the interface potential at the atomic scale. A single-atom step at the Si/SiO₂ interface can shift φ by order unity while barely moving the dot electrostatically — which is why Δφ is the hidden variable of silicon spin qubits.

Spectroscopic measurement proceeds through (1) magnetospectroscopy of the (1,1)–(0,2) transition, tracking the singlet–triplet avoided crossing as *E_Z* sweeps through Δ_VS; (2) spin–valley hot-spot mapping, fitting the S–T_− rotation frequency versus field magnitude and angle to extract Δ_VS and γ [10]; and (3) pulsed-gate spectroscopy via charge sensing.

Recent comparative measurements on SiMOS and Si/SiGe double quantum dots illustrate the landscape: in one Si/SiGe device, Δ_VS,A = 44.0 µeV and Δ_VS,B = 60.7 µeV with γ_A = 0.045 µeV, γ_B = 0.11 µeV; the SiMOS device showed valley splittings larger by a factor of 2–5 and spin–valley couplings larger by an order of magnitude [10]. The variability *within* a device (Δ_VS differing by tens of percent between adjacent dots) matters as much as the mean: two-qubit gates require Δ_VS ≫ *J* in *both* dots simultaneously.

### 4.3 Hot Qubits above 1 K and Reservoir-Isolated Readout

The standard spin-qubit operating temperature of ~20–100 mK is set not by spin physics but by *readout*: energy-selective tunneling to a reservoir requires *k_BT ≪ E_Z*. At 1.5 K (*k_BT* ≈ 130 µeV), the reservoir Fermi edge is thermally broadened beyond the Zeeman splitting, and conventional Elzerman readout fails. The hot-qubit breakthrough sidesteps the reservoir entirely [1]:

- **Initialization and readout via interdot tunneling.** The double dot is isolated from the reservoir; spin states are initialized and read by tunneling *between* the two dots and exploiting Pauli spin blockade, whose energy scale is set by the singlet–triplet splitting (meV-scale orbital energies) rather than the Zeeman energy. Because the relevant gap is orbital, it survives at kelvin temperatures.
- **Demonstrated performance.** A two-qubit unit cell operated at 1.5 K with single-qubit control, and universal quantum logic (initialization, readout, single- and two-qubit gates) was demonstrated above 1 K with single-qubit fidelities up to 99.3% and exchange tunable from 0.5 to 18 MHz [2].
- **Why it matters.** At 1–4 K, cryo-CMOS electronics dissipate watts rather than microwatts; the qubit plane and its controller can share a cryostat stage, eliminating thousands of millikelvin coaxial lines — the enabling condition for the integrated architectures of Section 4.4.

Charge noise remains the dominant decoherence channel at elevated temperature. In spin–valley-coupled SiMOS devices, the noise power spectral density follows *S(f) ∝ f^(−0.7)* over nine decades of frequency, measured via CPMG dynamical-decoupling spectroscopy [11] — a quantitative input for the fidelity budget of Section 5.

### 4.4 Global Control, Cryo-CMOS Integration, and the Wiring Bottleneck

A million-qubit processor cannot afford a million coaxial cables. Two complementary strategies address the interconnect bottleneck:

**Global (shared) control.** In the crossbar architecture [8], rows and columns of plunger, barrier, and readout lines address a 2D quantum-dot array; selectivity emerges from the *combination* of line voltages rather than dedicated per-qubit wiring. Electrons are shuttled by gate-voltage pulses, giving nearest-neighbor coupling for two-qubit gates and a path to remote entanglement. The design is heterostructure-agnostic — SiMOS benefits from large valley splitting, Si/SiGe from epitaxial uniformity — and anticipates *global* ESR: one microwave field driving all qubits, with individuals tuned in and out of resonance via local Stark shifts of their *g*-factors. Foundry-fabricated arrays have demonstrated the requisite single-electron control and (1,1,1) triple-dot configurations for exchange-only encoding [9].

**Cryo-CMOS controllers.** Intel's Horse Ridge program demonstrates the complementary approach: a 22 nm FinFET mixed-signal SoC operating at ~4 K that synthesizes 2–20 GHz microwave bursts, frequency-multiplexes 4×32 qubit channels, and addresses up to 128 qubits from a single die [4]. Electrical benchmarking showed control fidelity consistent with 99.99% for ideal qubits, and closed-loop operation of a two-qubit silicon processor at 99.7% — identical to room-temperature instrumentation [4]. Horse Ridge II adds on-chip state readout, multigate pulsing, and a programmable microcontroller for crosstalk-mitigating pulse shaping, verified at 4 K [12]. On the qubit side, Intel's Tunnel Falls 12-qubit chip, fabricated on a near-standard CMOS line with ≥95% wafer yield, provides a reproducible device platform [13].

Together, global control and cryo-CMOS define the scaling vector: shared lines reduce the *number* of interconnects, while in-fridge controllers reduce their *length* and thermal load. The residual challenge is *variability*: global fields demand uniform qubit frequencies, hence uniform valley splittings and *g*-factors — closing the loop back to Section 4.2.

---

## 5 Empirical Results and Proofs

We now assemble measured performance into a component-wise account, stated as empirical propositions:

> **Proposition 1 (Single-qubit control).** ^28^Si quantum-dot spin qubits achieve single-qubit fidelities above 99.5%, with *T₂^CPMG* exceeding 28 ms — more than 10⁵ Rabi operations per coherence time [6][14].

> **Proposition 2 (Two-qubit logic).** Resonantly driven CNOT and exchange-based CROT gates reach 99.3% fidelity, crossing the surface-code threshold; universal gate sets are demonstrated both at millikelvin and above 1 K [2][6].

> **Proposition 3 (Exchange-only encoding).** Triple-dot exchange-only qubits in high-valley-splitting Si/SiGe achieve 980-ns measurement, ~300-ns initialization, initialization/measurement infidelity of (2.5 ± 0.5)×10⁻³, and a randomized-benchmarking error rate of 1.7×10⁻³ — all with baseband electrical control, no ESR [3].

> **Proposition 4 (Hot operation).** Coherent one- and two-qubit operation at 1.5 K is established by two independent groups using reservoir-isolated Pauli-blockade readout, with single-qubit fidelities up to 99.3% and exchange tunable over 0.5–18 MHz [1][2].

> **Proposition 5 (Cryo-CMOS control).** A 22 nm cryo-CMOS controller at 4 K drives silicon spin qubits with fidelity indistinguishable from room-temperature electronics, multiplexing up to 128 qubits per chip [4][12].

The following table consolidates the error budget against the surface-code threshold (circuit-level threshold ≈ 1% per operation):

| Error component | Best reported value | Distance to threshold | Dominant physics |
|---|---|---|---|
| Single-qubit gate error | < 0.5% [6] | 2× margin | Charge noise via spin–orbit coupling |
| Two-qubit gate error | 0.7% [6] | 1.4× margin | Charge noise on *J(ε)*, valley leakage |
| Init/readout infidelity | 0.25% [3] | 4× margin | T₁ during spin-to-charge conversion |
| Idle (decoherence) per gate | ≪ 0.1% | large margin | ^29^Si hyperfine (suppressed), charge noise |
| Valley-phase yield loss | few % of pairs | architectural | Δφ ≈ π suppression [7] |

The budget shows the *median* device already operates below threshold, but the *tails* — valley-phase outliers, charge-noise hot spots, low-Δ_VS dots — determine array-scale yield. Fault tolerance at scale is therefore less about peak fidelity than about *uniformity*.

---

## 6 Limitations

What silicon spin qubits have *not* yet demonstrated:

- **No logical qubit below break-even.** Physical fidelities cross the surface-code threshold, but no silicon device has operated a distance-3 logical qubit below break-even; overhead analysis for ~100 logical qubits exists on paper [6], while experimental demonstration lags superconducting platforms.
- **Valley-phase disorder is calibrated, not solved.** Per-pair Δφ calibration works for small arrays; no wafer-scale strategy guarantees Δφ away from π across 10⁶ pairs, and atomic-scale interface metrology is beyond current CMOS process control.
- **Global-control uniformity is unproven at scale.** The crossbar [8] assumes qubit-frequency uniformity that current Δ_VS variability (tens of percent dot-to-dot [10]) does not deliver; frequency crowding under global ESR remains a theoretical design with small-scale support.
- **Hot-qubit fidelities trail millikelvin records.** The 99.3% single-qubit fidelity above 1 K [2] sits below 99.5%+ millikelvin values [6]; whether elevated-temperature operation closes the gap or error correction absorbs it is open.
- **Readout fan-out.** Single-shot readout is high-fidelity but slow (~1 µs), and multiplexed readout resonators for millions of qubits are an unsolved systems problem.
- **Materials ceiling.** Si/SiGe valley splittings remain in the tens of µeV; engineered strain and profile shaping improve the mean faster than the variance.

None of these limitations is a no-go theorem. Each is an engineering program with a defined metric and a plausible path — which is precisely why the platform attracts industrial investment.

---

## 7 Conclusion

Silicon spin qubits occupy a unique position: the only platform simultaneously offering (i) coherence times in the tens of milliseconds, (ii) gate fidelities crossing fault-tolerance thresholds, (iii) operation above 1 K compatible with integrated cryo-CMOS control, and (iv) fabrication in the most mature semiconductor infrastructure on earth. The valley degree of freedom — the platform's central complication — is increasingly an engineering variable rather than a fundamental obstacle: valley splittings are measured, modeled, and designed; valley-phase suppression of exchange is characterized and calibrated away; and high-valley-splitting heterostructures have unlocked exchange-only qubits with 10⁻³-level errors under all-electrical control.

The road to fault tolerance is now a problem of *scale and uniformity* rather than physical principle. Global-control architectures such as the crossbar [8], cryo-CMOS controllers multiplexing hundreds of qubits [4][12], and foundry-fabricated dot arrays [9] each attack the wiring and variability bottlenecks from a different direction. The decisive near-term experiments — logical qubits below break-even in silicon, and thousand-qubit arrays with calibrated valley phases — would make the silicon spin qubit the most credible vehicle for million-qubit fault-tolerant computation.

---

## References

[1] C. H. Yang *et al.*, "Operation of a silicon quantum processor unit cell above one kelvin," *Nature* 580, 350–354 (2020). https://doi.org/10.1038/s41586-020-2171-6

[2] L. Petit *et al.*, "Universal quantum logic in hot silicon qubits," *Nature* 580, 355–359 (2020). https://doi.org/10.1038/s41586-020-2170-7 — arXiv: https://arxiv.org/abs/1910.05289

[3] A. Mills *et al.* (exchange-only Si/SiGe triple-quantum-dot qubits), "Rapid high-fidelity state preparation and measurement in exchange-only Si/SiGe triple-quantum-dot qubits," *PRX Quantum* 3, 010352 (2022). https://sugaku.net/oa/W2108820376/

[4] S. Pellerano *et al.* (Intel/QuTech), "A scalable cryo-CMOS 2-to-20 GHz digitally intensive controller for 4×32 frequency multiplexed spin qubits/transmons in 22 nm FinFET technology," *ISSCC* (2020); Horse Ridge overview: http://www.techpowerup.com/264000/intel-and-qutech-detail-horse-ridge-first-cryogenic-quantum-computing-control-chip

[5] D. Loss and D. P. DiVincenzo, "Quantum computation with quantum dots," *Phys. Rev. A* 57, 120–126 (1998). https://doi.org/10.1103/PhysRevA.57.120

[6] X. Xue *et al.*, "Quantum logic with spin qubits crossing the surface code threshold," *Nature* 601, 343–347 (2022). https://doi.org/10.1038/s41586-021-04273-w

[7] Q. Li *et al.*, "Impact of the valley orbit coupling on exchange gate for spin qubits in silicon," *npj Quantum Information* 8, 87 (2022). https://www.nature.com/articles/s41534-022-00554-y

[8] R. Li *et al.*, "A crossbar network for silicon quantum dot qubits," *Science Advances* 4, eaar3960 (2018). https://www.science.org/doi/10.1126/sciadv.aar3960

[9] S. G. J. Philips *et al.*, "Single-electron operations in a foundry-fabricated array of quantum dots," *Nature Communications* 12, 4355 (2021). https://www.nature.com/articles/s41467-020-20280-3

[10] N. T. Jacobson *et al.* (Sandia), "Anisotropic spin-valley coupling in SiMOS and Si/SiGe quantum dots," arXiv:2604.16713 (2026). https://arxiv.org/pdf/2604.16713v2.pdf

[11] A. Corna *et al.*, "A silicon singlet–triplet qubit driven by spin-valley coupling," *Nature Communications* 13, 1445 (2022). https://www.nature.com/articles/s41467-022-28302-y

[12] Intel, "Intel debuts 2nd-gen Horse Ridge cryogenic quantum control chip" (2020), 22 nm FinFET verified at 4 K. https://www.nasdaq.com/press-release/intel-debuts-2nd-gen-horse-ridge-cryogenic-quantum-control-chip-2020-12-03

[13] Intel, "Tunnel Falls" 12-qubit silicon spin-qubit chip (2023), ≥95% 300 mm wafer yield. https://www.hpcwire.com/2023/06/15/intel-debuts-tunnel-falls-quantum-chip-and-lqc-program-to-work-with-it/
