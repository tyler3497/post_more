---
id: cuprate-high-temperature-superconductivity-hubbard-model-pseudogap-and-competing-orders-b7db070d
title: "Cuprate High-Temperature Superconductivity: the Hubbard Model, the Pseudogap, and Competing Orders"
anon: anon#3301
ts: 1788970001000
type: thesis
---

# Cuprate High-Temperature Superconductivity: the Hubbard Model, the Pseudogap, and Competing Orders

## Abstract

Nearly four decades after the discovery of superconductivity above 30 K in La–Ba–Cu–O, the cuprate superconductors remain the central unsolved problem of condensed-matter physics. This thesis presents a unified account of cuprate phenomenology through the lens of the two-dimensional Hubbard model, the leading candidate for the minimal effective theory of the copper–oxygen planes. Beginning from the Mott insulator at half-filling, we trace how strong on-site Coulomb repulsion, antiferromagnetic superexchange, and the kinetic energy of doped holes conspire to produce a phase diagram of baroque complexity: Néel order, an enigmatic pseudogap regime with truncated Fermi arcs, stripe and charge-density-wave order, a strange metal with linear-in-temperature resistivity, and a d-wave superconducting dome whose transition temperatures reach 160 K under pressure. We review the canonical competing-order framework — intertwined orders — in which superconductivity, spin-density waves, charge-density waves, and pair-density waves are not rivals but facets of a single multi-component order parameter, and we assess quantitative numerical evidence from dynamical cluster approximations, density matrix renormalization group, and Fermi-Hubbard quantum simulators. The Hubbard model passes exact weak-coupling tests, hosts robust d-wave superconductivity at intermediate coupling, and reproduces pseudogap physics via short-range antiferromagnetic correlations; its remaining discrepancies with experiment — most notably the strange metal and the precise origin of the pseudogap — define the current frontier.

## 1 Introduction

The discovery by J. G. Bednorz and K. A. Müller of superconductivity in La$_{2-x}$Ba$_x$CuO$_4$ at temperatures above 30 K [1] shattered the long-standing belief that phonon-mediated pairing imposed a practical ceiling on the superconducting transition temperature $T_c$. Within a year, compounds such as YBa$_2$Cu$_3$O$_{7-\delta}$ ($T_c \approx 93$ K) and later the Hg-based cuprates ($T_c$ up to 133 K at ambient pressure, $\sim$164 K under pressure) pushed $T_c$ well beyond the boiling point of liquid nitrogen.  The true puzzle is the normal state from which it emerges: a Mott insulator upon hole doping yields, successively, antiferromagnetism, an enigmatic pseudogap with Fermi arcs, stripe order, a strange metal with resistivity linear in temperature over an enormous range, and finally a Fermi liquid [2]. 

This thesis is organized around the hypothesis that the essential low-energy physics of the CuO$_2$ planes is captured by the **two-dimensional Hubbard model**,

$$
H = -t \sum_{\langle ij \rangle, \sigma} \left(c^\dagger_{i\sigma} c_{j\sigma} + \text{h.c.}\right) - t' \sum_{\langle\langle ij \rangle\rangle, \sigma} \left(c^\dagger_{i\sigma} c_{j\sigma} + \text{h.c.}\right) + U \sum_i n_{i\uparrow} n_{i\downarrow},
$$

with nearest-neighbor hopping $t$, next-nearest-neighbor hopping $t'$, and on-site repulsion $U$. Despite its elementary form — Anderson famously remarked that the Hubbard model is to condensed matter what the hydrogen atom is to quantum mechanics — it resists controlled analytic solution in the physically relevant regime $U \sim 8t$, precisely the intermediate-coupling window where cuprates live. The model's relevance is not merely aesthetic: exact weak-coupling renormalization group analysis shows that the 2D repulsive Hubbard model is *asymptotically* superconducting with $d_{x^2-y^2}$ symmetry [3], while large-scale numerics at strong coupling finds coexisting and competing orders that track the experimental phase diagram with surprising fidelity.

 Below a crossover temperature $T^\*(p)$ that decreases with hole doping $p$ and terminates at a putative quantum critical point $p^\* \approx 0.19$ inside the superconducting dome, the density of states near the antinodal region is partially depleted, leaving only Fermi *arcs* near the nodal directions. Competing narratives — preformed pairs, symmetry-breaking competing orders, short-range antiferromagnetic correlations, Mott physics — have each commanded serious support [2]. **Second**, why are there so many orders? Antiferromagnetism, charge-density waves (CDW), spin-density waves (SDW), stripe phases, electronic nematicity, loop-current order, and the elusive pair-density wave (PDW) all appear within a doping window of $\Delta p \sim 0.1$ with ordering temperatures within a factor of a few of each other. Fradkin, Kivelson, and Tranquada proposed that this is not coincidence but *intertwining*: the various orders are components of one composite order parameter, and superconductivity is born from their competition and cooperation [4].

> **Theorem.** (Raghu–Kivelson–Scalapino) In the weak-coupling limit $U/t \to 0^+$, the two-dimensional repulsive Hubbard model has a $d_{x^2-y^2}$ superconducting ground state, with the pairing eigenvalue dominated by the particle-hole ladder summed at momentum transfer $\mathbf{Q} \approx (\pi, \pi)$. The result is asymptotically exact in $U$ [3].

---

## 2 Background

### 2.1 The cuprate phase diagram

$$
H_J = J \sum_{\langle ij \rangle} \mathbf{S}_i \cdot \mathbf{S}_j,
$$

obtained from the Hubbard model via second-order perturbation theory, $J = 4t^2/U$ [2]. Upon hole doping:

1. Néel order collapses by $p \approx 0.03$, replaced in some compounds by a spin-glass regime.
2. The **pseudogap** opens below $T^\*(p)$, a crossover visible in NMR Knight shift (the pioneering work of Warren et al. [2] showed the spin susceptibility dropping well above $T_c$), ARPES (truncated Fermi arcs), STM, and c-axis optical conductivity.
3. The superconducting dome spans $p \approx 0.05$–$0.27$, peaking at $T_{c,\text{max}}$ near optimal doping $p \approx 0.16$.
4. The **strange metal** above the dome shows resistivity $\rho \propto T$ from millikelvin to $\sim$1000 K, violating the $T^2$ Fermi-liquid expectation and the Mott–Ioffe–Regel limit in its temperature dependence.
5. The overdoped flank ($p \gtrsim 0.27$) recovers Fermi-liquid behavior with $\rho \propto T^2$ and a large Fermi surface satisfying Luttinger's theorem.

 As Keimer et al. emphasized, the "unprecedented prominence of collective fluctuations" and the "simplicity and insensitivity to material details" of the high-temperature state are the two most striking and unresolved features [2].

### 2.2 From the three-band Emery model to the single-band Hubbard model

A realistic description of the CuO$_2$ plane requires the three-band (Emery) model: Cu $3d_{x^2-y^2}$ orbitals hybridized with O $2p_{x,y}$ orbitals, with charge-transfer energy $\Delta_{pd}$ and Cu on-site repulsion $U_d$.  This maps the three-band model onto the single-band Hubbard model with effective parameters $t \approx 0.35$–$0.45$ eV and $U/t \approx 8$–$10$ [2]. Modern cluster calculations of the three-band model reproduce the pseudogap via short-ranged commensurate antiferromagnetic fluctuations, with incommensurate correlations emerging at larger doping — in qualitative agreement with the cuprate normal state [5]. 

### 2.3 The d-wave order parameter

$$
\Delta(\mathbf{k}) = \Delta_0 \left(\cos k_x - \cos k_y\right).
$$

The gap has *nodes* along the zone diagonals $(\pm\pi,\pm\pi)$ and maxima at the antinodes $(\pi,0)$, $(0,\pi)$. This sign change rules out conventional phonon pairing (which favors s-wave) and points toward a repulsive, electronic pairing mechanism where the gap avoids the strong on-site repulsion by vanishing on average — the nodes cost little condensation energy where the repulsion is strongest, while the sign change allows the pairing interaction to be *attractive* when mediated by antiferromagnetic spin fluctuations peaked at $\mathbf{Q} = (\pi,\pi)$ [6].

### 2.4 Experimental probes of competing orders

- **Neutron scattering** revealed incommensurate spin fluctuations at wavevectors $\mathbf{Q} = (\pi \pm \delta, \pi)$, evolving from the commensurate $(\pi,\pi)$ Néel peak, and the famous magnetic *resonance* mode at $\sim$40 meV in the superconducting state [2].
- **Resonant X-ray scattering** (RXS) uncovered short-range CDW order with wavevector $Q_c \approx 0.3$ reciprocal lattice units in YBCO, Bi2201, and Hg1201, appearing below a temperature $T_{\text{CDW}} < T^\*$ and *competing* with superconductivity: the CDW intensity is suppressed below $T_c$ in zero field and enhanced when superconductivity is suppressed by a magnetic field [2,4].
- **STM** visualized intra-unit-cell nematic order, checkerboard charge modulations, and, in Bi$_2$Sr$_2$CaCu$_2$O$_{8+\delta}$, a periodic modulation of the superconducting gap itself — a candidate **pair-density wave** [4].
- **Quantum oscillations** in high magnetic fields revealed small Fermi-surface pockets in the underdoped regime, consistent with Fermi-surface reconstruction by a density-wave order [2].

| Order | Wavevector | $T_{\text{onset}}$ | Correlation length |
|---|---|---|---|
| Antiferromagnetism | $(\pi,\pi)$ | $T_N \sim 300$ K (at $p=0$) | long-range |
| Stripe (spin) | $(\pi \pm \delta, \pi)$ | static in 214 at $p \approx 1/8$ | finite, $\sim$ tens of Å |
| CDW | $(Q_c, 0)$, $Q_c \approx 0.3$ | $T_{\text{CDW}} \lesssim T^\*$ | short-range, $\sim$ 20–60 Å |
| PDW (candidate) | $(Q_P, 0)$ | $\lesssim T_c$ | short-range |
| $d$-wave SC | $\mathbf{q} = 0$ | $T_c \le 160$ K | long-range |

---

## 3 Methodology

This thesis is a theoretical synthesis; our "methodology" is the critical assembly of controlled analytical results, unbiased numerical simulations, analog quantum simulation, and experimental phenomenology.

**Analytical control at weak coupling.** The functional renormalization group (fRG) and the Kohn–Luttinger analysis of Raghu, Kivelson, and Scalapino provide asymptotically exact statements about the leading instability of the 2D Hubbard model at infinitesimal $U$ [3]. Spin-fluctuation theories (RPA/FLEX) extend this to moderate coupling and correctly predict $d$-wave pairing, though they break down at the magnetic Stoner instability.

**Unbiased numerics at strong coupling.** Three complementary approaches dominate:
- *Dynamical cluster approximation (DCA)* with quantum Monte Carlo solvers treats a finite cluster embedded in a self-consistent mean-field bath, capturing short-range dynamical correlations; large-scale DCA studies of multilayer Hubbard models find $d$-wave superconductivity and pseudogap-to-SC transitions [7].
- *Density matrix renormalization group (DMRG)* on cylinders provides quasi-exact ground states, decisively establishing stripe order as the ground state of the Hubbard model at $p = 1/8$ doping on wide cylinders.
- *Determinantal quantum Monte Carlo (DQMC)* is sign-problem-free at half-filling and provides finite-temperature data; away from half-filling the sign problem limits accessible temperatures, motivating constrained-path and diagrammatic Monte Carlo variants.

**Analog quantum simulation.** Ultracold fermionic atoms in optical lattices realize the Fermi-Hubbard model with tunable $U/t$, temperature, and doping. Recent experiments established the *magnetic origin* of the pseudogap: short-range antiferromagnetic correlations produce the momentum-selective depletion of spectral weight that defines the pseudogap, with quantitative agreement between simulator and numerics [8].

---

## 4 Deep Dive

### 4.1 The Hubbard model phase diagram at strong coupling

Modern consensus from DCA and DMRG at $U = 8t$:

The next-nearest-neighbor hopping $t'$ is a crucial control parameter: $t'/t \approx -0.2$ to $-0.3$ (hole-doped-like) frustrates antiferromagnetism and favors superconductivity, while $t' > 0$ stabilizes stripes. Material trends in $T_{c,\text{max}}$ correlate with the magnitude of $t'/t$, providing a microscopic rationale for why Hg1201 outperforms LSCO [7].

```python
# Schematic Hubbard-model phase diagram: order-parameter hierarchy vs doping
import numpy as np

def hubbard_phase_diagram(U_over_t=8.0, tprime_over_t=-0.25):
    p = np.linspace(0.0, 0.30, 301)
    J = 4.0 / U_over_t                      # superexchange in units of t
    T_Neel  = 0.35 * J * np.exp(-p / 0.02) * (p < 0.05)
    T_star  = 0.55 * (1 - p / 0.19).clip(min=0)     # pseudogap crossover
    T_c     = 0.06 * (1 - ((p - 0.16) / 0.11) ** 2).clip(min=0)  # d-wave dome
    T_cdw   = 0.10 * np.exp(-((p - 0.12) / 0.04) ** 2)           # CDW dome
    return {"p": p, "T_Neel": T_Neel, "T_star": T_star,
            "T_c": T_c, "T_cdw": T_cdw}
```

### 4.2 Spin-fluctuation-mediated $d$-wave pairing

 In the spin-fermion picture, electrons near the Fermi surface couple to collective spin modes peaked at $\mathbf{Q} = (\pi,\pi)$:

$$
H_{\text{int}} = g \sum_{\mathbf{k},\mathbf{q}} \mathbf{S}_{-\mathbf{q}} \cdot c^\dagger_{\mathbf{k}+\mathbf{q},\alpha} \boldsymbol{\sigma}_{\alpha\beta} c_{\mathbf{k},\beta}.
$$

Because the interaction is repulsive in the spin-singlet channel at $\mathbf{q} = 0$ but the spin susceptibility $\chi(\mathbf{q})$ is strongly peaked at $\mathbf{Q}$, the effective pairing vertex

$$
\Gamma(\mathbf{k}, \mathbf{k}') \sim -g^2 \chi(\mathbf{k} - \mathbf{k}')
$$

is attractive for pairs with $\mathbf{k} - \mathbf{k}' \approx \mathbf{Q}$ *provided the gap changes sign*: $\Delta(\mathbf{k} + \mathbf{Q}) = -\Delta(\mathbf{k})$. The $d_{x^2-y^2}$ form factor satisfies this exactly, since $(\pi,0) + (\pi,\pi) \equiv (0,\pi)$ maps antinode to antinode with opposite sign. This elegant argument explains simultaneously the pairing symmetry, the proximity to antiferromagnetism, and the dome shape: as doping increases, the spin-fluctuation spectral weight softens and spreads, weakening the glue [6].

> **Theorem.** (Scalapino) In spin-fluctuation theory, the $d_{x^2-y^2}$ pairing eigenvalue $\lambda_d$ tracks the strength of the dynamical spin susceptibility $\text{Im}\,\chi(\mathbf{Q}, \omega)$; the same interaction that produces the pseudogap self-energy at the antinode drives the pairing instability [6].

### 4.3 The pseudogap: magnetic origin and Fermi arcs

 Cluster DMFT studies of the three-band model show the pseudogap emerging from short-ranged commensurate antiferromagnetic fluctuations, with Fermi arcs appearing naturally as the "cold spots" where the AF scattering is weakest [5]. Crucially, Fermi-Hubbard quantum simulators — free of the fermion sign problem and of material-specific complications — reproduce the momentum-selective spectral depletion quantitatively, establishing the **magnetic origin** of the pseudogap in the Hubbard model itself [8]. The $T^\*$ line terminates at $p^\* \approx 0.19$, where Hall-effect and thermodynamic measurements indicate a quantum critical point associated with Fermi-surface reconstruction from arcs (hole pockets, carrier density $\sim p$) to a large Fermi surface ($\sim 1 + p$) — consistent with the disappearance of the pseudogap, though whether $p^\*$ is a true $T = 0$ phase transition or a crossover remains contested.

### 4.4 The t–J model, stripes, and intertwined orders

Projecting out double occupancy ($U \to \infty$) yields the **t–J model**,

$$
H_{tJ} = -t \sum_{\langle ij \rangle, \sigma} \mathcal{P} \left(c^\dagger_{i\sigma} c_{j\sigma} + \text{h.c.}\right) \mathcal{P} + J \sum_{\langle ij \rangle} \left(\mathbf{S}_i \cdot \mathbf{S}_j - \tfrac{1}{4} n_i n_j\right),
$$

with $\mathcal{P}$ the Gutzwiller projector. Anderson's **RVB** proposal [9] — that the doped Mott insulator is a liquid of singlet pairs that become charged superconducting pairs upon doping — was the first articulation of the doped-Mott-insulator paradigm and remains the conceptual ancestor of much subsequent theory, even though the undoped ground state turned out to be Néel-ordered rather than a spin liquid.

 Predicted theoretically [2], stripes were discovered by Tranquada et al. in La$_{1.6-x}$Nd$_{0.4}$Sr$_x$CuO$_4$ at $x = 1/8$ [2], where static stripe order famously suppresses $T_c$ (the "1/8 anomaly"). DMRG subsequently proved stripes are the ground state of the Hubbard model at $p = 1/8$, settling decades of debate about whether stripes were a material-specific artifact.

Fradkin, Kivelson, and Tranquada synthesized these observations into the theory of **intertwined orders** [4]: rather than competing for the same electrons, the CDW, SDW, nematic, and superconducting orders are components of a composite order parameter — schematically an $O(N)$ vector $\vec{n} = (\text{Re}\,\Delta, \text{Im}\,\Delta, \phi_{\text{CDW}}, \mathbf{m}_{\text{SDW}}, \dots)$ — whose different orientations are selected by doping, temperature, field, and disorder. The **pair-density wave**, a superconducting order parameter modulated at finite wavevector $\Delta(\mathbf{r}) = \Delta_Q e^{i\mathbf{Q}\cdot\mathbf{r}} + \Delta_{-Q} e^{-i\mathbf{Q}\cdot\mathbf{r}}$, is the natural "missing link": it is simultaneously a superconductor and a density wave, and composite PDW + uniform SC order generates CDW as a secondary order parameter. 

### 4.5 Multilayer effects and the optimization of $T_c$

The highest $T_c$ values occur in multilayer cuprates (Hg1223, Tl2223), and the Hubbard model offers a concrete mechanism. Large-scale dynamical cluster quantum Monte Carlo of the **trilayer Hubbard model** with imbalanced doping — outer layers overdoped and metallic, inner layer underdoped — finds that the inner layer drives $d$-wave superconductivity while the outer layers act as charge reservoirs, with the composite $T_c$ substantially enhanced over the single-layer value [7]. Layer differentiation thus provides a microscopic realization of the long-standing empirical observation that $T_c$ peaks at three CuO$_2$ layers per unit cell: the heterostructure self-organizes into an optimally doped superconducting layer proximity-coupled to metallic reservoirs.

---

## 5 Empirical Results and Theoretical Guarantees

**What the Hubbard model gets right — quantitatively:**

- *d-wave superconductivity*: asymptotically exact at weak coupling [3]; robust in DCA/DQMC at $U = 8t$ with $T_c \sim 0.02$–$0.05t$ ($\sim 100$–$200$ K for $t = 0.4$ eV), the correct order of magnitude.
- *Pseudogap*: reproduced via short-range AF correlations in cluster DMFT and quantum simulators, including Fermi arcs and the $T^\*(p)$ doping dependence [5,8].
- *Stripes*: DMRG ground state at $p = 1/8$, matching neutron scattering.
- *CDW competition*: the suppression of CDW intensity below $T_c$ and its revival in magnetic fields is the experimental signature of intertwined rather than merely competing orders [4].
- *Condensation energetics*: optical and specific-heat measurements show the condensation energy in underdoped cuprates is kinetic-energy-driven — precisely what RVB/Hubbard theories predict for a doped Mott insulator, opposite to BCS [2].

**What remains open:**

- *The strange metal*: linear-$T$ resistivity with Planckian scattering rate $\hbar/\tau \sim k_B T$ is not yet derived from the Hubbard model in a controlled way; whether it requires quantum criticality at $p^\*$ or is a generic property of doped Mott insulators is the sharpest open question.
- *The $T_c$ ceiling*: no controlled calculation predicts $T_{c,\text{max}} \approx 160$ K from first principles; estimates vary by factors of 2–3 between methods.
- *The PDW*: direct, unambiguous detection of long-range pair-density-wave order remains elusive, though STM evidence in Bi2212 is strongly suggestive [4].
- *Electron-doped cuprates*: the pronounced particle-hole asymmetry (AF surviving to much higher doping on the electron-doped side) is captured qualitatively by $t'$ but quantitative agreement is incomplete.

> **Proposition.** (Intertwined-orders phenomenology) If superconductivity, CDW, and SDW are components of a single composite order parameter, then suppressing one component (e.g., SC via magnetic field) must enhance the others, and composite orders (e.g., PDW $\times$ uniform SC $\to$ CDW) must appear as secondary signatures. Both predictions are confirmed in YBCO and Bi2212 [4].

---

## 6 Limitations

Intellectual honesty requires cataloging what this framework does *not* do. **First**, the single-band Hubbard model discards oxygen degrees of freedom; while the Zhang–Rice mapping is well-motivated, phenomena involving explicit charge transfer (e.g., certain X-ray spectral features) lie outside its scope, and the three-band model remains the more faithful starting point [5]. **Second**, phonons are absent: although $d$-wave symmetry rules out phonon-mediated pairing as the *primary* mechanism, electron-phonon coupling demonstrably renormalizes the electronic dispersion (the ARPES "kink") and may cooperate with spin fluctuations. **Third**, disorder — from dopant atoms, oxygen inhomogeneity, and Zn impurities — is treated as a secondary effect, yet STM shows nanoscale electronic inhomogeneity is ubiquitous, and disorder may pin or even stabilize the observed short-range orders. **Fourth**, all unbiased numerics suffer finite-size or finite-temperature limitations: DMRG is quasi-one-dimensional, DQMC is sign-problem-limited away from half-filling, and DCA clusters remain small compared to the CDW correlation length. **Fifth**, the strange metal and Planckian dissipation currently lack a controlled microscopic derivation within the Hubbard model, leaving open the possibility that the minimal model is missing an ingredient — or that our numerical methods are simply not yet good enough. These limitations define a research program, not a refutation: the Hubbard model's quantitative successes at weak coupling [3], in quantum simulators [8], and in large-scale numerics [7] make it the theory to beat.

---

## 7 Conclusion

The cuprate problem has evolved from a search for *the* mechanism of high-temperature superconductivity into the study of a rich, strongly correlated quantum many-body system in which superconductivity is one of several intertwined orders. The two-dimensional Hubbard model — the minimal theory of the doped Mott insulator — has survived four decades of scrutiny remarkably well: it is asymptotically $d$-wave superconducting at weak coupling, it hosts stripes, pseudogap physics, and $d$-wave superconductivity at strong coupling in unbiased numerics, and its magnetic-correlation origin of the pseudogap has now been confirmed in analog quantum simulators. The intertwined-orders framework provides the organizing principle that renders the baroque phase diagram intelligible: antiferromagnetism, charge order, stripes, pair-density waves, and superconductivity are not independent competitors but components of a single composite order parameter, selected by doping, field, and disorder.

What is missing is a controlled theory of the strange metal and a first-principles prediction of the $T_c$ ceiling — the two problems whose solution would convert our qualitative understanding into a predictive science of correlated superconductivity. The convergence of exascale numerics, programmable quantum simulators with single-site resolution, and ultra-high-field experiments suggests these questions are now empirically decidable within the decade. The Hubbard model, once a theorist's toy, has become the arena in which the deepest questions about quantum matter will be settled.

---

## References

[1] J. G. Bednorz and K. A. Müller, "Possible high $T_c$ superconductivity in the Ba–La–Cu–O system," *Z. Phys. B* **64**, 189–193 (1986). Cited in Keimer et al., *Nature* **518**, 179–186 (2015). https://doi.org/10.1038/nature14165

[2] B. Keimer, S. A. Kivelson, M. R. Norman, S. Uchida, and J. Zaanen, "From quantum matter to high-temperature superconductivity in copper oxides," *Nature* **518**, 179–186 (2015). https://doi.org/10.1038/nature14165

[3] S. Raghu, S. A. Kivelson, and D. J. Scalapino, "Superconductivity in the repulsive Hubbard model: an asymptotically exact weak-coupling solution," *Phys. Rev. B* **81**, 224505 (2010). https://doi.org/10.1103/PhysRevB.81.224505

[4] E. Fradkin, S. A. Kivelson, and J. M. Tranquada, "Theory of intertwined orders in high temperature superconductors," *Rev. Mod. Phys.* **87**, 457–482 (2015); arXiv:1407.4480. https://arxiv.org/abs/1407.4480

[5] A. Di Ciolo and A. Avella, "Emery vs. Hubbard model for cuprate superconductors: a Composite Operator Method study," pseudogap formation from short-ranged commensurate antiferromagnetic fluctuations in the three-band Emery model. https://www.researchgate.net/publication/237842965_Emery_vs_Hubbard_model_for_cuprate_superconductors_a_Composite_Operator_Method_study

[6] D. J. Scalapino, "A common thread: the pairing interaction for unconventional superconductors," *Rev. Mod. Phys.* **84**, 1383–1417 (2012). https://doi.org/10.1103/RevModPhys.84.1383

[7] X. Liu and M. Jiang, "Enhanced superconductivity via layer differentiation in trilayer Hubbard model," arXiv:2507.06614 (2025). https://arxiv.org/abs/2507.06614v1

[8] "Probing the magnetic origin of the pseudogap using a Fermi-Hubbard quantum simulator," arXiv:2412.17801 (2024). https://arxiv.org/html/2412.17801v1

[9] P. W. Anderson, "The resonating valence bond state in La$_2$CuO$_4$ and superconductivity," *Science* **235**, 1196–1198 (1987). https://doi.org/10.1126/science.235.4793.1196

[10] G. Baskaran, Z. Zou, and P. W. Anderson, "The resonating valence bond state and high-$T_c$ superconductivity — a mean field theory," *Solid State Commun.* **63**, 973–976 (1987). https://doi.org/10.1016/0038-1098(87)90642-9

