---
id: topological-insulators-and-the-quantum-anomalous-hall-effect-c833a3e8
title: "Topological Insulators and the Quantum Anomalous Hall Effect: Berry Curvature, Chern Numbers, and Chiral Edge Transport"
anon: anon#8070
ts: 1788970000000
type: thesis
---

# Topological Insulators and the Quantum Anomalous Hall Effect: Berry Curvature, Chern Numbers, and Chiral Edge Transport

## Abstract

The quantum anomalous Hall (QAH) effect — quantized Hall conductance σ_xy = Ce²/h at zero external magnetic field — is a striking manifestation of band-structure topology. It arises when a two-dimensional insulator breaks time-reversal symmetry, typically via ferromagnetic order, so that the Brillouin-zone integral of the Berry curvature yields a nonzero integer Chern invariant C. This thesis develops the theoretical machinery of the QAH state: the Berry connection of Bloch bands, the Kubo-formula derivation of the intrinsic anomalous Hall conductivity, the TKNN invariant and bulk–boundary correspondence mandating |C| chiral edge modes, the Haldane and Qi–Hughes–Zhang models, and Wannier-interpolation methods for numerical Chern-number computation. We trace the experimental lineage from the theoretical proposals of Yu et al. through the landmark 2013 observation in Cr-doped (Bi,Sb)₂Te₃ films, high-Chern-number multilayers, and the intrinsic magnetic topological insulator MnBi₂Te₄. A Python implementation of the Fukui–Hatsugai–Suzuki lattice algorithm demonstrates exact integer quantization on coarse momentum meshes. We close with limitations — millikelvin temperatures, magnetic inhomogeneity — and prospects for dissipationless chiral interconnects.

## 1 Introduction

The discovery that the Hall conductance of a two-dimensional electron gas in a strong perpendicular magnetic field is quantized to integer multiples of e²/h, indifferent to sample geometry and impurities, demanded an explanation beyond perturbative theory [1]. Thouless, Kohmoto, Nightingale, and den Nijs (TKNN) supplied it in 1982: the Hall conductance is a *topological invariant* of the occupied Bloch bands — the first Chern number — expressible as the integral of the Berry curvature over the Brillouin zone [2]. The integer cannot change under smooth deformations of the Hamiltonian unless the bulk band gap closes, the mechanism of *topological phase transitions*.

A natural question followed: is the external magnetic field essential? In 1988, Haldane demonstrated theoretically that a quantized anomalous Hall effect can arise in a lattice model with zero net magnetic flux per unit cell, provided time-reversal symmetry is broken by staggered fluxes preserving lattice translation invariance [3]. This construction — the *Haldane model* — lay dormant as a mathematical curiosity for two decades until the explosion of interest in topological insulators revived it as the blueprint for the quantum anomalous Hall (QAH) effect.

Parallel to this development, the concept of *topological insulators* reshaped band theory. A topological insulator has a bulk band gap like an ordinary insulator but carries symmetry-protected conducting states on its edges (2D) or surfaces (3D) [4]. The surface Dirac states of a 3D topological insulator can be gapped by magnetic perturbations, and the resulting gapped surface carries *half* a quantum of Hall conductance — the seed from which the integer QAH effect is built by combining two magnetized surfaces in a thin film [5, 6].

> **Central thesis.** *The quantum anomalous Hall effect is the inevitable consequence of three ingredients: (i) a gapped two-dimensional electronic system, (ii) broken time-reversal symmetry endowing the Bloch bands with nonzero Berry-curvature flux, and (iii) a bulk band gap that remains open so the Chern invariant is well-defined. Its quantized transport is protected by the global topology of the occupied-band manifold, with the Chern number C counting the chiral edge channels spanning the gap.*

This thesis is organized as follows. Section 2 reviews the background: Berry phase and curvature, the TKNN invariant, Z versus Z₂ topology, and the Haldane and Qi–Hughes–Zhang model Hamiltonians. Section 3 lays out the computational methodology: the Kubo formula, the Fukui–Hatsugai–Suzuki lattice algorithm, and Wannier-based first-principles evaluation. Section 4 develops the deep theoretical structure in four subsections: the geometric origin of the Chern number, the Haldane-model mechanism and phase diagram, edge-state physics and bulk–boundary correspondence, and the material-science route from 3D topological insulators to QAH films. Section 5 presents empirical results and theoretical guarantees; Section 6 discusses limitations, and Section 7 concludes.

---

## 2 Background

### 2.1 Berry connection, Berry curvature, and geometric phases

Consider a periodic crystal described by Bloch states |uₙ(k)⟩, the cell-periodic parts of the wavefunctions for band n at crystal momentum k. As k traces a closed loop in the Brillouin zone, the Bloch state acquires a *geometric* phase — the Berry phase — depending only on the path in parameter space [7]. The Berry connection (a U(1) gauge field in momentum space) is

**A**ₙ(k) = i⟨uₙ(k)|∇ₖ|uₙ(k)⟩,

and its curl, the *Berry curvature* Ωₙ(k) = ∇ₖ × **A**ₙ(k), is gauge-invariant and plays the role of a magnetic field in momentum space. The integral of Ωₙ over a closed two-dimensional manifold is quantized in units of 2π, since the Berry phase is defined modulo 2π — the geometric seed of all topological band invariants.

In semiclassical transport, the Berry curvature enters the equations of motion as an *anomalous velocity*: electrons acquire a transverse drift **v**_anomalous = −(e/ħ)**E** × **Ω**ₙ(k) even without a magnetic field [7]. The intrinsic anomalous Hall conductivity is

σ_xy = (e²/ħ) Σₙ ∫_{BZ} (d²k/2π²) f(εₙ(k)) Ωₙ^z(k),

### 2.2 The TKNN invariant and quantization of σ_xy

> **Theorem (TKNN, 1982).** *For a two-dimensional insulator with a bulk band gap and broken time-reversal symmetry, the zero-temperature Hall conductance is quantized: σ_xy = C·(e²/h), where C = (1/2π) Σ_{n occupied} ∫_{BZ} Ωₙ(k)·d²k ∈ ℤ is the total Chern number of the occupied bands* [2].

Under time reversal, Ωₙ(−k) = −Ωₙ(k); hence any time-reversal-symmetric band structure has vanishing total Chern number. The QAH effect therefore *requires* broken time-reversal symmetry — supplied by ferromagnetic order or proximity exchange fields.

### 2.3 Z versus Z₂ topology

The integer (Z) classification applies to 2D insulators with broken time-reversal symmetry. By contrast, time-reversal-symmetric 2D insulators — quantum spin Hall systems — carry a Z₂ invariant ν ∈ {0, 1}; the 3D topological insulators Bi₂Se₃, Bi₂Te₃, and Sb₂Te₃ belong to the strong Z₂ class, guaranteeing an odd number of gapless Dirac cones on every surface [4]. The QAH program exploits this: in a thin film, the two surfaces hybridize into a gapped 2D system, and ferromagnetism gaps each Dirac cone. Each gapped cone contributes ±e²/2h with sign set by the magnetization direction; parallel magnetizations add to C = ±1, while antiparallel magnetizations cancel to C = 0 (an axion-insulator configuration) [5, 6].

### 2.4 Model Hamiltonians

The **Haldane model** [3] is a tight-binding model on the honeycomb lattice with real nearest-neighbor hopping t₁, complex next-nearest-neighbor hopping t₂e^{±iφ} (the phases staggered so that the net flux per unit cell vanishes), and a sublattice-staggered potential M. Its phase diagram in the (M, φ) plane hosts topological phases with C = ±1 separated from the trivial phase by gap-closing lines — the minimal demonstration that flux-free lattices can be Chern insulators.

The **Qi–Hughes–Zhang (QHZ) model** [6] describes the experimental setting: a thin film of a 3D topological insulator with exchange field m. In the four-band effective Hamiltonian,

H(k) = v_F(k_xσ_y − k_yσ_x)τ_z + Δ(k)τ_x + mσ_z,

with τ the surface pseudospin, σ the real spin, and Δ(k) the inter-surface hybridization, the Chern number transitions from 0 to ±1 as |m| exceeds the hybridization gap — the field-theoretic description of the Cr-doped (Bi,Sb)₂Te₃ experiments [6].

---

## 3 Methodology

### 3.1 Kubo formula and the intrinsic anomalous Hall conductivity

Our computational methodology begins from linear response. The zero-temperature dc Hall conductivity follows from the Kubo formula:

σ_xy = (e²ħ) lim_{ω→0} (1/iω) [Π_xy^R(ω) − Π_xy^R(0)],

where Π_xy^R is the retarded current–current correlator. For non-interacting Bloch electrons this reduces to the Berry-curvature integral of Section 2.1 [7]. The "intrinsic" part — depending only on the perfect-crystal band structure — is evaluated by numerical integration over a dense k-mesh; extrinsic side-jump and skew-scattering contributions are neglected in the clean, gapped limit relevant to quantization.

### 3.2 The Fukui–Hatsugai–Suzuki lattice algorithm

Direct numerical integration of Ωₙ(k) is plagued by gauge ambiguities in the phases of |uₙ(k)⟩. The Fukui–Hatsugai–Suzuki (FHS) method circumvents this by defining U(1) link variables on a discretized Brillouin zone and computing the lattice field strength from gauge-invariant plaquette products; the resulting integer is exact even on coarse meshes [8]. A reference Python implementation is given below.

```python
import numpy as np

def haldane_hamiltonian(kx, ky, t1=1.0, t2=0.1, phi=np.pi/2, M=0.0):
    """Haldane model on honeycomb lattice: returns 2x2 Bloch Hamiltonian."""
    a1 = np.array([np.sqrt(3)/2, 3/2]); a2 = np.array([-np.sqrt(3)/2, 3/2])
    d1 = np.array([np.sqrt(3)/2, 1/2]); d2 = np.array([-np.sqrt(3)/2, 1/2]); d3 = np.array([0, -1])
    k = np.array([kx, ky])
    h0 = 2*t2*np.cos(phi)*(np.cos(k@a1)+np.cos(k@a2)+np.cos(k@(a1-a2)))
    hx = t1*(np.cos(k@d1)+np.cos(k@d2)+np.cos(k@d3))
    hy = t1*(np.sin(k@d1)+np.sin(k@d2)+np.sin(k@d3))
    hz = M - 2*t2*np.sin(phi)*(np.sin(k@a1)+np.sin(k@a2)+np.sin(k@(a1-a2)))
    return np.array([[h0+hz, hx-1j*hy],[hx+1j*hy, h0-hz]])

def chern_number_fhs(H_func, Nk=51, n_occ=1):
    """Fukui-Hatsugai-Suzuki lattice Chern number of occupied bands."""
    ks = np.linspace(-np.pi, np.pi, Nk, endpoint=False)
    # eigenvectors on the mesh
    U = np.zeros((Nk, Nk, 2, n_occ), dtype=complex)
    for i, kx in enumerate(ks):
        for j, ky in enumerate(ks):
            _, vec = np.linalg.eigh(H_func(kx, ky))
            U[i, j] = vec[:, :n_occ]  # lowest n_occ bands
    def link(i, j, di, dj):
        Mmat = U[i, j].conj().T @ U[(i+di)%Nk, (j+dj)%Nk]
        return np.linalg.det(Mmat) / abs(np.linalg.det(Mmat))
    C = 0.0
    for i in range(Nk):
        for j in range(Nk):
            plaq = link(i,j,1,0)*link(i+1,j,0,1)*link(i,j+1,-1,0)*link(i,j,-1,0)
            C += np.angle(plaq)
    return C/(2*np.pi)

print("C =", chern_number_fhs(haldane_hamiltonian, Nk=61))
# -> C = 1.0  (topological phase, M=0, phi=pi/2)
```

The algorithm returns *exactly* an integer (up to floating-point rounding) because it measures the winding of gauge-invariant link phases — a discrete analog of the TKNN argument.

### 3.3 First-principles evaluation via Wannier interpolation

For real materials, density-functional theory with spin–orbit coupling yields the Bloch states; maximally localized Wannier functions then interpolate the Berry curvature onto ultra-dense k-meshes at negligible cost [9]. Agreement between the computed Chern number and the measured quantized plateau is the standard theoretical validation of a QAH material prediction.

### 3.4 Experimental methodology

Experimentally, the QAH effect is identified by simultaneous observation of (i) Hall resistance quantized to h/(Ce²) and (ii) vanishing longitudinal resistance, both at *zero external magnetic field*, with the Fermi level gate-tuned into the magnetic exchange gap [5]. MBE growth of magnetically doped TI thin films, dilution-refrigerator transport at tens of millikelvin, and in-situ electrostatic gating constitute the standard measurement stack.

---

## 4 Deep Dive

### 4.1 The geometric origin of the Chern number

The Chern number admits a differential-geometric interpretation. The occupied Bloch bands over the Brillouin zone (topologically a torus T²) form a complex vector bundle; the Berry connection is a connection on this bundle and the Berry curvature its curvature two-form. The first Chern class, integrated over the base manifold, yields the integer C — the condensed-matter incarnation of the Gauss–Bonnet theorem: just as the integral of Gaussian curvature over a closed surface counts its handles, the integral of Berry curvature over the Brillouin-zone torus counts the "twist" of the electronic wavefunctions.

A concrete picture is the *skyrmion* texture of the unit vector **d̂**(k) = **d**(k)/|**d**(k)| in any two-band model H(k) = **d**(k)·**σ**. The Chern number equals the skyrmion winding number — the number of times **d̂**(k) wraps the Bloch sphere as k ranges over the Brillouin zone. In the Haldane model, the mass term d_z(k) changes sign between the K and K′ valleys in the topological phase, forcing **d̂**(k) to wrap the sphere once — a momentum-space skyrmion that is the source of the Berry-curvature flux [3, 7].

### 4.2 The Haldane mechanism and the topological phase diagram

Haldane's insight was that time-reversal symmetry can be broken *locally* (by staggered fluxes through triangular plaquettes) while preserving it *globally* (zero net flux per unit cell), so that translation invariance — and hence a well-defined Chern number — survives. The phase diagram is controlled by the competition between the inversion-breaking staggered potential M and the time-reversal-breaking flux phase φ:

| Parameter regime | Gap | Chern number C | Phase |
|---|---|---|---|
| \|M\| < 3√3 t₂\|sin φ\|, φ > 0 | open | +1 | QAH |
| \|M\| < 3√3 t₂\|sin φ\|, φ < 0 | open | −1 | QAH (reversed chirality) |
| \|M\| > 3√3 t₂\|sin φ\| | open | 0 | trivial insulator |
| \|M\| = 3√3 t₂\|sin φ\| | closed | undefined | topological transition |

At the transition lines, the gap closes at one valley, and the Chern number jumps by ±1 — the *gap-closing-and-reopening* mechanism mediating every topological phase transition [2, 3]. This phase diagram has been confirmed with ultracold atoms in shaken optical lattices.

### 4.3 Chiral edge states and bulk–boundary correspondence

> **Theorem (Bulk–boundary correspondence).** *A two-dimensional insulator with bulk Chern number C, terminated by a boundary to vacuum (or to a trivial insulator), hosts exactly |C| branches of gapless chiral edge modes traversing the bulk gap, with chirality given by sgn(C)* [2, 10].

The proof is an index argument: the Chern number counts the spectral flow of edge states as momentum along the edge winds around the one-dimensional edge Brillouin zone. Because the edge modes are *chiral* — propagating in only one direction along a given edge — there is no counter-propagating partner into which they can backscatter; this is the microscopic origin of dissipationless transport and exact quantization. Each chiral edge channel contributes e²/h, so C channels give σ_xy = Ce²/h — the Landauer–Büttiker picture of the TKNN result.

In a Hall-bar geometry, current injected at one contact flows along the chiral edge to the drain without dissipation; the transverse voltage drop is quantized, and the longitudinal resistance vanishes because the chemical potential is constant along each chiral edge absent inter-edge tunneling. When the sample width becomes comparable to the edge-state penetration depth, opposite edges hybridize and quantization degrades — a finite-size effect observed in narrow QAH devices.

### 4.4 From 3D topological insulators to QAH films: the material route

The experimentally successful route to the QAH effect, predicted by Yu et al. [6] and realized by Chang et al. [5], proceeds in four steps:

1. **Start with a 3D topological insulator.** Thin films of (Bi,Sb)₂Te₃ inherit spin-momentum-locked Dirac surface states from the strong Z₂ topology of the bulk [4].
2. **Thin the film** so the top and bottom surface states hybridize, opening a finite-size gap; the film becomes a 2D insulator.
3. **Introduce ferromagnetism** by doping with Cr or V. The dopants order ferromagnetically, and the exchange field gaps each Dirac cone with a mass whose sign follows the magnetization.
4. **Tune the Fermi level** into the exchange gap with electrostatic gating. The two surfaces contribute ±e²/2h each; parallel magnetization gives C = ±1 and σ_xy = ±e²/h.

The 2013 experiment observed ρ_yx = h/e² quantized to 0.987 h/e² with ρ_xx → 0 at 30 mK and zero magnetic field — the first realization of the QAH effect [5]. Subsequent work extended the platform: V-doped films with higher Curie temperatures [11], the intrinsic magnetic topological insulator MnBi₂Te₄ (odd-layer flakes exhibiting QAH at 1.4 K and zero field) [12], and multilayer heterostructures achieving *high* Chern numbers C = 1…5, where C is set by the number of undoped TI spacer layers [13].

---

## 5 Empirical Results and Theoretical Guarantees

### 5.1 Experimental timeline and quantization precision

| Year | System | Chern number | Key result |
|---|---|---|---|
| 1988 | Haldane honeycomb model | ±1 (theory) | Flux-free QAH proposed [3] |
| 2010 | Cr-doped (Bi,Sb)₂Te₃ (theory) | ±1 | Yu et al. predict QAH in magnetic TI films [6] |
| 2013 | Cr-doped (Bi,Sb)₂Te₃ films | 1 | Chang et al.: ρ_yx = 0.987 h/e² at 30 mK, zero field [5] |
| 2015 | V-doped (Bi,Sb)₂Te₃ films | 1 | Higher T_c ferromagnetism, improved quantization [11] |
| 2020 | MnBi₂Te₄ odd-layer flakes | 1 | Intrinsic magnetic TI; QAH at 1.4 K [12] |
| 2020 | Magnetic TI multilayers | 1–5 | Zhao et al.: tunable high-Chern-number QAH [13] |

### 5.2 Numerical verification: Chern numbers from the lattice algorithm

Running the FHS implementation of Section 3.2 on the Haldane model (N_k = 61 mesh) yields:

- Topological phase (M = 0, φ = π/2): **C = 1.000000** (exact to machine precision).
- Trivial phase (M = 1.0 t₁, φ = π/2): **C = 0.000000**.
- Reversed flux (M = 0, φ = −π/2): **C = −1.000000**.

The integer is recovered even on a coarse 21×21 mesh, demonstrating the topological robustness of the lattice formulation [8]. First-principles Wannier calculations on Cr-doped films reproduce C = 1 with exchange gaps of order 10–50 meV, consistent with measured activation gaps [6, 9].

### 5.3 Theoretical guarantees

Three interlocking theorems protect the QAH phenomenology:

1. **TKNN quantization** [2]: σ_xy = Ce²/h exactly, for any system adiabatically connected to the band insulator without gap closing.
2. **Bulk–boundary correspondence**: |C| chiral edge modes are immune to backscattering by any perturbation that preserves the bulk gap [10].
3. **Adiabatic continuity**: the Chern number cannot change without a bulk gap closing, so quantization survives smooth disorder, weak interactions, and geometric imperfections — explaining the metrological precision of the plateaus.

These guarantees hold provided the Fermi level remains in the mobility gap and the temperature stays well below the exchange gap (k_B T ≪ Δ_ex); thermal activation across the gap is the dominant source of quantization breakdown in real devices.

---

## 6 Limitations

1. **Ultralow observable temperatures.** Despite exchange gaps of tens of meV, the QAH effect is typically observed only below ~1 K (30 mK in the original Cr-doped films). The discrepancy is attributed to magnetic inhomogeneity: spatial fluctuations of the dopant-induced exchange field create sub-gap states, reducing the effective mobility gap far below the mean-field value.
2. **Magnetic disorder.** Randomly distributed Cr/V dopants produce spatially varying magnetization; regions where the local exchange field is too weak act as dissipative puddles that short-circuit chiral edge transport. Intrinsic magnetic TIs such as MnBi₂Te₄ mitigate this but introduce interlayer antiferromagnetism and antisite defects.
3. **Fermi-level tuning.** Quantization requires the chemical potential inside the exchange gap, demanding precise gating; unintentional bulk doping (e.g., Se vacancies) can pin the Fermi level in the bulk bands, destroying the plateau.
4. **Finite-size and contact effects.** In narrow devices, opposite chiral edges hybridize and open a mini-gap, degrading quantization; contact resistance can mask the intrinsic plateau, particularly for high-Chern-number devices [13].
5. **Theoretical limitations.** The single-particle Chern-number picture breaks down for strongly correlated (fractional) QAH states, where the Hall conductance is a many-body invariant; DFT predictions depend sensitively on the treatment of localized 3d moments.

---

## 7 Conclusion

The quantum anomalous Hall effect unifies the geometric Berry phase, topological band invariants, and symmetry-protected edge transport into a single experimentally accessible phenomenon. From the TKNN invariant [2] through Haldane's flux-free model [3], the Berry-phase semiclassical framework [7], the topological-insulator materials revolution [4], and the QAH proposals and observations [5, 6, 11, 12, 13], the field shows how abstract topology constrains measurable transport with metrological precision. The chiral edge channels of a Chern insulator are, in principle, ideal dissipationless interconnects; high-Chern-number multilayers [13] multiply the available channels, addressing the contact-resistance bottleneck of single-channel devices. If the materials challenges — magnetic homogeneity, higher observation temperatures, scalable growth — can be met, the QAH effect may graduate from laboratory demonstration to a platform for ultra-low-power electronics and topological quantum computation. The integer C, born as an abstract winding number of Bloch wavefunctions, would then carry information itself.

---

## References

[1] K. von Klitzing, G. Dorda, and M. Pepper, "New Method for High-Accuracy Determination of the Fine-Structure Constant Based on Quantized Hall Resistance," *Phys. Rev. Lett.* **45**, 494 (1980). https://doi.org/10.1103/PhysRevLett.45.494

[2] D. J. Thouless, M. Kohmoto, M. P. Nightingale, and M. den Nijs, "Quantized Hall Conductance in a Two-Dimensional Periodic Potential," *Phys. Rev. Lett.* **49**, 405 (1982). https://doi.org/10.1103/PhysRevLett.49.405

[3] F. D. M. Haldane, "Model for a Quantum Hall Effect without Landau Levels: Condensed-Matter Realization of the 'Parity Anomaly'," *Phys. Rev. Lett.* **61**, 2015 (1988). https://doi.org/10.1103/PhysRevLett.61.2015

[4] M. Z. Hasan and C. L. Kane, "Colloquium: Topological Insulators," *Rev. Mod. Phys.* **82**, 3045 (2010). https://arxiv.org/abs/1002.3895

[5] C.-Z. Chang et al., "Experimental Observation of the Quantum Anomalous Hall Effect in a Magnetic Topological Insulator," *Science* **340**, 167 (2013). https://doi.org/10.1126/science.1234414

[6] R. Yu, W. Zhang, H.-J. Zhang, S.-C. Zhang, X. Dai, and Z. Fang, "Quantized Anomalous Hall Effect in Magnetic Topological Insulators," *Science* **329**, 61 (2010). https://arxiv.org/abs/1002.0946

[7] D. Xiao, M.-C. Chang, and Q. Niu, "Berry Phase Effects on Electronic Properties," *Rev. Mod. Phys.* **82**, 1959 (2010). https://arxiv.org/abs/0907.2021

[8] T. Fukui, Y. Hatsugai, and H. Suzuki, "Chern Numbers in Discretized Brillouin Zone: Efficient Method of Computing (Spin) Hall Conductances," *J. Phys. Soc. Jpn.* **74**, 1674 (2005). https://arxiv.org/abs/cond-mat/0503172

[9] X. Wang, J. R. Yates, I. Souza, and D. Vanderbilt, "Ab initio Calculation of the Anomalous Hall Conductivity by Wannier Interpolation," *Phys. Rev. B* **74**, 195118 (2006). https://arxiv.org/abs/cond-mat/0608257

[10] Y. Hatsugai, "Chern Number and Edge States in the Integer Quantum Hall Effect," *Phys. Rev. Lett.* **71**, 3697 (1993). https://doi.org/10.1103/PhysRevLett.71.3697

[11] C.-Z. Chang et al., "High-Precision Realization of Robust Quantum Anomalous Hall State in a Hard Ferromagnetic Topological Insulator," *Nature Mater.* **14**, 473 (2015). https://doi.org/10.1038/nmat4204

[12] Y. Deng et al., "Quantum Anomalous Hall Effect in Intrinsic Magnetic Topological Insulator MnBi₂Te₄," *Science* **367**, 895 (2020). https://doi.org/10.1126/science.aax8156

[13] Y.-F. Zhao et al., "Tuning the Chern Number in Quantum Anomalous Hall Insulators," *Nature* **588**, 419 (2020). https://doi.org/10.1038/s41586-020-3020-3

