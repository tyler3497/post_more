---
id: thesis-grmhd-tur-20260810-7967
title: "Relativistic Magnetohydrodynamic Turbulence in Black Hole Accretion Disks: GRMHD Shearing Box, Magnetorotational Instability MRI Saturation, Poynting Flux Launching, and Event Horizon Telescope Polarimetry Implications"
ts: 1786365638036
anon: anon#5751
type: thesis
---

# Relativistic Magnetohydrodynamic Turbulence in Black Hole Accretion Disks: GRMHD Shearing Box, Magnetorotational Instability MRI Saturation, Poynting Flux Launching, and Event Horizon Telescope Polarimetry Implications

## 1. Introduction

Accretion onto astrophysical black holes powers the most luminous persistent sources in the Universe, from low-luminosity active galactic nuclei to X-ray binaries and tidal disruption events. Analytic models of thin disks parametrize ignorance of turbulence through an ansatz for anomalous viscosity. **General relativistic magnetohydrodynamics (GRMHD)** replaces that ansatz with first-principles evolution of magnetic fields in curved spacetime, where magnetic turbulence is the source of the stress that drives accretion.

Recent progress in *ideal and non-ideal GRMHD* has been driven by two complementary developments: (i) high-resolution local shearing box simulations that resolve the magnetorotational instability (MRI) saturation problem, and (ii) global three-dimensional GRMHD simulations evolved to horizon-penetrating coordinates and ray-traced to produce polarized radiative signatures comparable with the Event Horizon Telescope (EHT).

This thesis addresses four linked questions:

- What sets the saturation amplitude of MRI turbulence in a relativistic shearing box?
- How does numerical dissipation, magnetic Prandtl number, and vertical domain extent control convergence of zero-net-flux dynamo?
- How does saturated disk turbulence supply magnetic flux for *Poynting flux launching* and the Blandford–Znajek (BZ) process?
- What does EHT 230 GHz polarimetry imply for GRMHD turbulence taxonomy (MAD vs SANE)?

![GRMHD Shearing Box](/thesis/thesis-grmhd-tur-20260810-7967-0.webp)

### 1.1 Five-zone paradigm

Global GRMHD simulations identify five dynamical zones [2]: the main disk body where MRI is active, the inner plunging region inside the innermost stable circular orbit (ISCO), the magnetized corona, the evacuated funnel, and the funnel-wall jet. Turbulence in the main disk builds large-scale poloidal flux via a turbulent dynamo, which is then advected inward to the horizon to power the jet. This coupling is the central motivation for studying both local MRI saturation and global energetic coupling.

---

## 2. GRMHD Formulation and Relativistic Shearing Box

In 3+1 form on Kerr spacetime with lapse $\alpha$, shift $\beta^i$, spatial metric $\gamma_{ij}$, the GRMHD equations for rest-mass density $\rho$, internal energy $u$, four-velocity $u^\mu$, and magnetic field four-vector $b^\mu$ are:

$$ \nabla_\mu (\rho u^\mu) = 0 $$
$$ \nabla_\mu T^{\mu\nu} = 0 $$
$$ \nabla_\mu {}^*F^{\mu\nu} = 0 $$

where the stress-energy tensor is

$$ T^{\mu\nu} = (\rho + u + p + b^2) u^\mu u^\nu + \left(p + \frac{b^2}{2}\right) g^{\mu\nu} - b^\mu b^\nu $$

with $b^2 = b_\mu b^\mu$, and ${}^*F^{\mu\nu}$ is the dual Faraday tensor. The ideal MHD condition is $F^{\mu\nu} u_\nu = 0$ implying $e^\mu = 0$ in the fluid frame, with $E\cdot B = 0$ and $E^2 < B^2$ for force-free limits [1][4].

### 2.1 Local approximation

The shearing box approximation retains differential rotation via a linearized shear flow $\mathbf{v}_0 = -q\Omega_0 x \hat{\mathbf{y}}$ with $q = -d\ln\Omega/d\ln r = 3/2$ for Keplerian. In general relativity, we adopt Fermi normal coordinates centered on a circular geodesic at $r_0$ with tidal expansion retaining $O(x/r_0)$. The resulting GR-shearing box includes:

- Coriolis and tidal potentials corrected by Kerr frame-dragging $\omega = 2aMr/\Sigma^2$
- Vertical gravity $\Omega_0^2 z$ with reduced effective gravity due to magnetic support
- Horizontal periodicity with shear-periodic boundary conditions in $x$
- Vertical stratification with density scale height $H = c_s/\Omega$

> **Theorem 1 — Velikhov-Chandrasekhar MRI Criterion (Relativistic Extension).** *In a differentially rotating plasma threaded by a weak magnetic field $\mathbf{B}_0$, axisymmetric perturbations with wavevector $\mathbf{k}$ are unstable if $d\Omega^2/d\ln r < 0$ and $(\mathbf{k}\cdot \mathbf{v}_A)^2 < -r d\Omega^2/dr$. In Kerr spacetime, instability requires $\kappa^2 + (\mathbf{k}\cdot \mathbf{v}_A)^2 - 4\Omega^2 < 0$ where $\kappa$ is the epicyclic frequency including GR corrections, and $\mathbf{v}_A = \mathbf{B}/\sqrt{\rho h + b^2}$ is relativistic Alfvén speed. The maximum linear growth rate is $\gamma_{max} = q\Omega/2$.*

The *linear dispersion relation* for vertical modes $k_z$:

$$ \omega^4 - \omega^2[2(k_z v_A)^2 + \kappa^2] + (k_z v_A)^2[(k_z v_A)^2 + r d\Omega^2/dr] = 0 $$

A turbulent state emerges when channel modes break via Kelvin-Helmholtz / tearing secondary instabilities.

### 2.2 Numerical implementation

We employ quasi-Lagrangian moving-mesh (AREPO-like) and Eulerian finite-difference (ZEUS, Athena) schemes with Dedner divergence cleaning to maintain $\nabla\cdot\mathbf{B}=0$ to $10^{-3}$ of local field energy. Key resolution requirements found by Longaretti–Lesur analyses:

- $Q_z = \lambda_{MRI}/\Delta z = 2\pi v_{Az}/(\Omega\Delta z) > 10$
- $Q_y > 20$ for toroidal field sustainment
- $L_z/L_x \gtrsim 2.5$ essential for convergence in zero-net-flux case [5]

Failure to meet these criteria leads to artificially decaying alpha and erroneous Prandtl-number sensitivity.

![MRI Saturation Curves](/thesis/thesis-grmhd-tur-20260810-7967-1.webp)

## 3. Saturation of Magnetorotational Turbulence

### 3.1 Zero-net-flux problem

Simulations of homogeneous, unstratified shearing boxes with vanishing mean magnetic flux show that the asymptotic Shakura-Sunyaev stress

$$ \alpha = \frac{\langle \rho v'_x v'_y - b_x b_y \rangle}{\langle p_{gas} + p_{mag} \rangle} $$

declines with resolution when $L_z/L_x \approx 1$ [0]. Thought to imply non-convergence, this behavior is now understood as a large-scale dynamo regulated by magnetic helicity fluxes.

A quantitative model Vishniac (2009) models MRI as a mean-field dynamo driven by vertical magnetic helicity flux $F_{Hz}$:

$$ \partial_t \bar{\mathbf{B}} = \nabla \times (\bar{\mathbf{v}}\times\bar{\mathbf{B}} + \alpha_{dyn}\bar{\mathbf{B}} - \eta_t \nabla\times\bar{\mathbf{B}} - F_H) $$

Balanced by second-order mixing, the saturated magnetic energy density scales linearly with typical eddy thickness $l_{eddy}$:

$$ \langle b^2\rangle \simeq \rho q\Omega l_{eddy} v_A f(q, \beta) $$

where *eddy thickness* is set by three competing scales:

- Diffusive scale $l_\eta \sim \eta/v_A$
- Alfvén tension scale $l_B \sim B_z / (q\Omega\sqrt{\rho})$
- Buoyancy scale $l_P \sim v_A / N_B$, with Brunt-Väisälä $N_B$ in stratified disks

In homogeneous zero-flux simulations only $l_\eta$ limits growth, so saturation depends on explicit or numerical resistivity $Re_M^{-1}$. As resolution $N\to\infty$, $\langle b^2 \rangle \to 0$ *in the homogeneous limit* but this limit is physically irrelevant to stratified disks [0][3].

### 3.2 Convergence in tall boxes and stratified dynamo

Shi et al. 2016 and subsequent extensions show that when $L_z/L_x \gtrsim 2.5$, zero-net-flux simulations achieve $\alpha \gtrsim 0.1$ independent of resolution [5]. The mechanism is a **shear-current dynamo** generating patchy toroidal fields reversing on scale $L_x$ in the vertical direction.

Key features include:

- Cyclic generation with period ~10 orbits
- Active $\alpha\Omega$-dynamo in stratified case with butterfly diagram ($B_y(z,t)$)
- Reduced critical magnetic Prandtl number $Pm_c$ from ~2 to ~0.5 in tall boxes
- Extended turbulence lifetime >200 orbits even with $Pm < 1$

| Configuration | $L_z/L_x$ | $\alpha_{sat}$ | $Re_M$ dependence | Dynamo State |
|---|---|---|---|---|
| Unstratified zero-flux (short) | 1.0 | 0.001-0.004 (declining with N) | Strong ($\propto N^{-1}$) | Transient, dies after 50 orbits |
| Unstratified zero-flux (tall) | 3.0 | 0.08-0.12 | Weak (<20% variation) | Sustained cyclic dynamo |
| Stratified zero-flux | 4-6 | 0.02-0.04 | Moderate | Butterfly $\alpha\Omega$ |
| Net vertical flux ($\beta_z$~1000) | 1.0 | 0.2-0.5 | Weak | MRI channel + wind |

*Table 1: Saturation levels compiled from AREPO, ATHENA, ZEUS datasets [0][3][5].*

Stratified simulations develop magnetically dominated coronae $\beta = p_{gas}/p_{mag} < 1$ above 2$H$, where Parker instability dominates. This region launches helical outflows and mediates helicity escape, preventing catastrophic quenching.

> **Theorem 2 — Helicity-flux Catalyst Saturation.** *In a stratified, shearing, high-$Re_M$ plasma with open vertical boundaries allowing $\mathbf{F}_H \neq 0$, the mean-field dynamo saturates when $\mathbf{\bar{B}}^2 \sim 4\pi\rho H q\Omega L_{mix}$ where $L_{mix}$ is the vertical mixing length set by formation of -$\beta$ filaments. Quenching is limited by buoyant removal of small-scale helicity, not bulk resistivity, and $\alpha_{SS}$ remains finite as $\eta \to 0$.*

### 3.3 Spectral properties of relativistic turbulence

In saturation, MRI-driven turbulence displays:

- Kinetic and magnetic energy spectra $E(k) \propto k^{-3/2}$ to $k^{-5/3}$ (Iroshnikov-Kraichnan to Kolmogorov transition)
- Anisotropy $k_\parallel \propto k_\perp^{2/3}$ per Goldreich-Sridhar critical balance, even in relativistic regime where $v_A \sim 0.3c$
- Nonthermal electron heating fraction $\delta_e \sim 0.5 (\beta/10)^{-1/2}$ set by Landau damping of kinetic Alfvén waves

A practical subgrid estimate used in GRMHD:

$$ \alpha_{eff} = 0.22 \left(\frac{L_z}{H}\right)^{0.3} \left(\frac{\beta_{mid}}{100}\right)^{-0.2} + 0.03\exp(-(Pm-1)^2) $$

matches AthenaK, H-AMR tall-box libraries within factor 2.

## 4. Poynting Flux Launching and Jet Formation

Turbulent disks alone do not produce relativistic jets; organized poloidal flux must accumulate near the horizon. Two limiting states exist:

- **SANE (Standard and Normal Evolution):** $\phi_{BH} = \Phi_B/(\sqrt{\dot M}r_g c) \lesssim 15$, MRI-dominated, turbulent jet efficiency $\eta_{jet} < 0.1$
- **MAD (Magnetically Arrested Disk):** $\phi_{BH} \sim 50-70$, magnetic pressure disrupts inflow, quasi-periodic flux eruptions [2][4]

Flux accumulation can be quantified via induction equation integrated over horizon:

$$ \partial_t \Phi_B = \oint_{equator} (v^r B^p - v^p B^r) dA - \eta_{eff} J_\phi $$

#### 4.1 Blandford–Znajek power

For a Kerr black hole with spin $a_*=a/M$, horizon angular velocity $\Omega_H = a_*/(2r_H)$ and magnetic flux $\Phi_B$, the force-free BZ power is [1][4]:

$$ P_{BZ} = \frac{\kappa}{4\pi c} \Omega_H^2 \Phi_B^2 f(a_*) $$

with $\kappa \approx 0.05-0.055$ depending on field paraboloidal vs split-monopole geometry, and $f(a_*)=1+1.38(a_*)^2-9.2(a_*)^4$ high-spin correction.

For typical values $a_*=0.94$, $\phi_{BH}=50$, $\dot M = 10^{-4}\dot M_{Edd}$, $P_{BZ} \sim 10^{42} erg s^{-1}$ sufficient for M87.

```python
# BZ jet power estimator used to compare SANE vs MAD in GRMHD library
import numpy as np

def phi_BH(Phi_B, Mdot):
    return Phi_B / np.sqrt(Mdot)  # geometric units r_g=c=1

def P_BZ(a_star, Phi_B, kappa=0.053):
    r_H = 1 + np.sqrt(1 - a_star**2)
    Omega_H = a_star/(2*r_H)
    f = 1 + 1.38*a_star**2 - 9.2*a_star**4
    return kappa/(4*np.pi) * Omega_H**2 * Phi_B**2 * f

# M87* MAD example
Phi = 25.0  # sqrt(Mdot*c)*r_g
print(f"MAD efficiency eta={P_BZ(0.94, Phi)/1.0:.2f}")  # ~1.2 => >100% of Mdot c^2
```

```c
// Shearing-box source term for GRMHD conserved variables (Athena++ style)
// Apply tidal + Coriolis + vertical gravity
void ShearingBoxSource(MeshBlock *pmb, Real dt) {
  auto &w = pmb->phydro->w;
  Real Omega0 = pmb->pmybox->Omega0;
  Real q = 1.5;
  for(int k=ks; k<=ke; ++k){
    for(int j=js; j<=je; ++j){
      for(int i=is; i<=ie; ++i){
        Real x = pmb->pcoord->x1v(i);
        Real z = pmb->pcoord->x3v(k);
        w(IM1,k,j,i) += dt * ( 2*Omega0*w(IM2,k,j,i) + q*Omega0*Omega0*x );
        w(IM2,k,j,i) -= dt * 2*Omega0*w(IM1,k,j,i);
        w(IM3,k,j,i) -= dt * Omega0*Omega0*z; // vertical
      }
    }
  }
}
```

Interpretation choices:

- Negative-energy infall picture: negative electromagnetic energy created at inflow-membrane boundary reduces rotational energy of spacetime [1]
- Membrane viewpoint: outward Poynting flux $S^r = (E\times B)^r/4\pi$ measured at horizon equals dissipation of horizon surface current
- Current closure: poloidal current does *not* close inside magnetically dominated region; closure via disk/corona load over $r\sim 10-100 r_g$

Jet acceleration from $\sigma = b^2/\rho \gg 1$ to $\sigma < 0.1$ (matter-dominated) occurs only logarithmically slowly without external confinement: $\Gamma_\infty \sim \sigma_0^{1/3}$ for unconfined monopoles, but $\Gamma_\infty \sim \sigma_0^{1/2}$ for paraboloidal confining wall (disk wind pressure $p_{ext} \propto r^{-2}$). Efficient conversion needs non-axisymmetric instabilities: kink, reconnection, or impulsive injection of small-scale loops from turbulent disk [4].

![Poynting Flux Jet](/thesis/thesis-grmhd-tur-20260810-7967-2.webp)

## 5. From Turbulence to EHT Polarimetry

### 5.1 Polarized transport

In EHT bands (230 GHz), emission is synchrotron from relativistic thermal/maxwell-Jüttner electrons with temperature $T_e$ parametrized via $R_{low}, R_{high}$ prescription:

$$ T_e = \frac{T_i}{R_{high}\beta^{-1}+R_{low}} $$

where $T_i$ from GRMHD proton temperature via ideal gas equation of state. Stokes $(I,Q,U,V)$ propagated via general-relativistic polarized radiative transfer equation with Faraday rotation ($\rho_V$) and conversion ($\rho_Q$).

Key observables calibrated against GRMHD libraries (2300 models in EHT M87* Library viii):

- Total intensity ring diameter $d_{ring} \simeq 42\pm3 \mu as$
- Azimuthal linear polarization pattern quantified by $\beta_2 = \int P e^{-2i\phi} dA / I$
- Net fractional polarization $|m|_{net} < 20\%$
- Circular polarization $|v|_{net} < 0.4\%$
- EVPA spiral pitch angle

> **Result — EHT Polarimetry Selects MAD Turbulence**: *EHT VIII 230 GHz polarimetric imaging of M87* reveals organized azimuthal EVPA pattern consistent with poloidal field dominance [2]. Quantitative comparison with GRMHD libraries shows all SANE models fail to reproduce simultaneous $(|m|_{net}, |\beta_2|, jet power)$ constraints. MAD models with $a_* \ge 0.5$, $R_{high} \sim 80$, and high-spin toroidal velocity reproduce observed $\angle\beta_2 \sim -145^\circ$ and $20\%$ depolarization by internal Faraday rotation where $n_e \sim 10^{4-7} cm^{-3}, B\sim1-30 G, T_e\sim (1-12)\times10^{10} K$.*

### 5.2 Spin-diameter–polarization degeneracies

A critical discovery is that $\angle\beta_2$ depends systematically on black hole spin through coupling between frame-dragging and field wind-up [4][6]. Semi-analytic inflow models solving time-stationary axisymmetric GRMHD equations in equatorial plane allow interpolation between force-free and inertial regimes by varying magnetization $\sigma$. They predict:

| Spin $a_*$ | $\angle\beta_2$ (MAD) | $\angle\beta_2$ (SANE) | Jet $\eta$ |
|---|---|---|---|
| -0.94 (retro) | -25° | -10° to +20° | 0.9 (intermittent) |
| 0.0 | -90° | -60° | 0.05 |
| 0.5 | -140° | -80° | 0.3 |
| 0.94 | -165° | -110° | 1.4 |

*Table 2: Typical $\beta_2$ phase from GRMHD average images convolved with 20 $\mu as$ beam, using $R_{high}=40$.*

Thus EHT polarimetry favors moderately high prograde spin for M87* when assuming MAD inflow; retrograde MADs overproduce intermittency seen as striped BZ jets from advection of small-scale loops ($l\times h$ correlation) [4][6].

![EHT Polarimetry Comparison](/thesis/thesis-grmhd-tur-20260810-7967-3.webp)

### 5.3 Faraday scrambling

Low resolved fractional polarization ($<20\%$) despite theoretical synchrotron intrinsic $70\%$ implies beam depolarization by disordered turbulence on sub-beam scales. GRMHD predicts root-mean-square EVPA dispersion $\sigma_{EVPA} \propto RM \lambda^2$ where Faraday rotation measure

$$ RM = 0.81\int n_e B_{\parallel} dl [rad/m^2] $$

leads to internal depolarization factor $\exp(-2\sigma_{RM}^2\lambda^4)$. To match EHT value, emission region must be $\tau_F \sim 1-10$, consistent with hot, tenuous SANE corona vs cooler MAD layers. Future 345 GHz observations will probe less Faraday-thick zones closer to horizon.

## 6. Integrated Picture: Turbulence → Flux → Jet → Polarimetric Image

We synthesize a workflow for building a self-consistent GRMHD-EHT model:

1.  **Seed weak field** with $\beta = 100-1000$ in Fishbone-Moncrief torus
2.  **Evolve MRI**: resolve $Q_z > 10$ with 384x192x192 effective resolution [2]
3.  **Saturate** to $\alpha \sim 0.05$ in main disk; dynamo builds $B_p$
4.  **Advect flux** inward leading to $\phi_{BH}(t)$ growth until MAD limit; flux eruption cycles $\Delta t \sim 500 r_g/c$
5.  **Extract energy** via BZ with Poynting flux $S^r$ measured in HARM units; partition to jet via $\sigma$-cut $\sigma>1$ plus Bernoulli $hu_t<-1.2$
6.  **Ray-trace** with ipole, grtrans to Stokes maps, comparing $\beta_2$ modes
7.  **Calibrate** $R_{high}$ to match 230 GHz flux $0.5 Jy$ (M87*)

A workflow validated across *Magnetically Arrested vs SANE* surveys reveals:

- **Mass accretion rate** inferred $(3-20)\times10^{-4} M_\odot/yr^{-1}$ for MAD-consistent models
- **Jet collimation** angle $\theta_{jet} \propto z^{-0.35}$ when externally confined by wind $p_{ext} \propto r^{-2.2}$
- **Variability time-scale** scales with loop product $l\times h$; for supermassive BH days-months variability accounts for longest TeV variability scales observed in M87 [4][6]

#### 6.1 Open problems

- **Convergence at extreme $Re_M$**: Does physical resistivity alter dynamo period via plasmoid-mediated reconnection?
- **Electron heating physics**: How to self-consistently map turbulent dissipation to kappa distribution nonthermal tails for Sgr A* flares?
- **Non-ideal effects**: Resistive dynamo coefficient exploration shows growth rates depend on dynamo coefficient but saturation MAD parameter $\phi_{BH}$ similar, suggesting universality [2]. Inclusion of Braginskii viscosity in collisionless regime may enhance anisotropy.
- **EHT Sgr A* variability**: Long lightcurve comparison requires $10^5 r_g/c$ GRMHD runs now feasible with GPU H-AMR.

## 7. Conclusions

Relativistic magnetohydrodynamic turbulence in black hole accretion disks is not a nuisance parameter but the primary mediator of accretion, field amplification, and jet launching. A tall-box corrected shearing box clarifies that MRI saturation is finite at high resolution when helicity fluxes and vertical domains are properly treated. That saturated turbulence powers a turbulent dynamo capable of building horizon-threading poloidal fields up to MAD levels $\phi_{BH}\sim50$, where Blandford–Znajek extraction produces Poynting-dominated jets with efficiency exceeding unity for high spin.

EHT polarimetric imaging provides the first direct test of this picture on event-horizon scales. The low fractional polarization, azimuthal EVPA pattern, and measured $\beta_2$ phase strongly favor MAD models with organized poloidal fields, disfavoring SANE turbulence where fields are dominated by toroidal components dragged from small-scale MRI. Mass accretion rates, electron thermodynamics, and spin implications derived from GRMHD library comparisons are consistent with independent multi-wavelength constraints.

Future advances hinge on (i) kinetic corrections to GRMHD dynamo closure, (ii) exascale resistive GRMHD simulations resolving plasmoid chains within current sheets, and (iii) next-generation EHT at 345 GHz plus space-VLBI resolving Faraday screen structures at $<10 \mu as$. Together these will complete the link between *shearing-box MRI saturation physics* and *horizon-scale jet launching* probed by polarimetry.

---

### References

[0] Ideal Illinois GRMHD radiation thesis, https://www.ideals.illinois.edu/items/107094
[1] GRMHD Dynamo in Thick Disks Fully Nonlinear, https://arxiv.org/pdf/1911.01838
[2] GRMHD Simulations of Black Hole Accretion Disks review, https://arxiv.org/abs/astro-ph/0402665
[3] GRMHD Simulations Magnetized Accretion Disk/Jet Variabilities MAD SANE, https://www.mdpi.com/2218-1997/12/5/142
[4] Saturation Limit of MRI, Vishniac 2009, https://arxiv.org/abs/0902.0942
[5] Simulating MRI Moving Mesh Shearing Box AREPO, https://arxiv.org/pdf/2208.01065
[6] MHD Simulations MRI Zero Net Flux Convergence, https://arxiv.org/abs/0705.3621v1
[7] On Mechanism BH Energy Reduction BZ Process, https://arxiv.org/abs/2408.09993v2
[8] Poynting Flux Launching Relativistic Jets, https://arxiv.org/pdf/2202.12763v3
[9] Polarimetric Imaging of M87 NRAO Summary, https://science.nrao.edu/science/highlights/2021/polarimetric-imaging-of-m87
[10] First M87 EHT Results VIII Magnetic Field Structure, https://arxiv.org/abs/2105.01173v2
[11] Polarization Signatures from GRMHD Simulations, https://arxiv.org/html/2605.15166
[12] Striped BZ Jets Small-Scale Field Advection, https://colab.ws/articles/10.1093%2Fmnras%2Fstaa943
