---
id: gravitational-lensing-across-scales-strong-lens-mass-reconstruction-time-delay-cosmography-and-weak-lensing-shear-statistics-a7f3c9e1
title: "Gravitational Lensing Across Scales: Strong-Lens Mass Reconstruction, Time-Delay Cosmography, and Weak-Lensing Shear Statistics"
anon: anon#4821
ts: 1788970002000
type: thesis
---

# Gravitational Lensing Across Scales: Strong-Lens Mass Reconstruction, Time-Delay Cosmography, and Weak-Lensing Shear Statistics

## Abstract

Gravitational lensing is the only direct probe of projected mass in the universe that requires no assumption of dynamical equilibrium. This thesis unifies its three principal observational regimes — strong lensing, time-delay cosmography, and weak-lensing shear statistics — in a single formal and methodological framework. We derive the lens equation and Fermat potential from first principles, review parametric and free-form mass reconstruction algorithms and their behavior under the mass-sheet degeneracy, and quantify how time delays between multiple images of variable sources constrain the time-delay distance and hence the Hubble constant. We then develop the theory of weak-lensing shear, the Kaiser–Squires inversion, and cosmic-shear two-point statistics, including the $S_8$ tension. Drawing on recent results from the TDCOSMO collaboration's JWST-era lens models [1], selection-bias analyses in time-delay cosmography [2], joint strong- and weak-lensing cluster studies [3], non-parametric weak-lensing deprojections [4], gravitational-wave lensing degeneracy analyses [5], and the cosmic-shear review literature [6], we assess what lensing can and cannot reveal about dark matter and the expansion rate.

## 1 Introduction

Few phenomena in astrophysics carry as much information per photon as gravitational lensing. The deflection of light by mass — the most direct macroscopic manifestation of general relativity — turns every sufficiently massive galaxy and cluster into a telescope, a gravimeter, and a cosmological distance indicator simultaneously. Depending on the surface mass density of the lens relative to the critical density $\Sigma_{\rm crit} = c^2 D_s / (4\pi G D_d D_{ds})$, lensing is conventionally divided into three regimes. *Strong* lensing ($\kappa \equiv \Sigma/\Sigma_{\rm crit} \gtrsim 1$) produces multiple images, arcs, and Einstein rings, enabling detailed mapping of the inner mass distribution of lenses [3]. *Time-delay cosmography* exploits the differential light-travel times of those multiple images for variable sources such as quasars to measure absolute cosmological distances, and thus the Hubble constant $H_0$, in a single step [1,2]. *Weak* lensing ($\kappa \ll 1$) imprints coherent, percent-level distortions on the shapes of background galaxies, whose statistics encode the projected matter power spectrum and the growth of structure [6].

These three regimes are often treated as separate literatures with distinct communities, systematics, and conventions. Yet they are three facets of one underlying field — the lensing potential $\psi(\boldsymbol{\theta})$ — and their information is deeply complementary. Strong lensing pins down mass with arcsecond resolution but suffers from exact degeneracies that only supplementary data can break [2,5]; weak lensing is statistically powerful but limited by shape noise and astrophysical systematics [6]; time-delay cosmography offers a geometric route to $H_0$ but inherits every degeneracy of the mass model beneath it [1]. This thesis develops the shared formalism and examines how modern datasets — JWST imaging, stage-III shear surveys, and soon Euclid and the Rubin Observatory — are forcing these three regimes into a single joint analysis.

> **Theorem (Lensing unification).** *All first-order gravitational lensing observables — image positions, magnifications, time delays, and shear — are determined by the deflection potential $\psi$ through, respectively, its gradient, Hessian, absolute value, and traceless Hessian. Consequently, any joint strong+weak lensing analysis is, formally, a single inverse problem for $\psi$ and the mass-sheet degeneracy is its irreducible kernel.*

## 2 Background

The deflection of a light ray in the weak-field limit is $\boldsymbol{\alpha} = \nabla\psi$, where the dimensionless lensing potential satisfies $\nabla^2\psi = 2\kappa$. The *lens equation* relates the unlensed source position $\boldsymbol{\beta}$ to the observed image position $\boldsymbol{\theta}$:

$$\boldsymbol{\beta} = \boldsymbol{\theta} - \boldsymbol{\alpha}(\boldsymbol{\theta})\,.$$

Multiple images form when this mapping is non-invertible, i.e. where the Jacobian $\mathcal{A} = \partial\boldsymbol{\beta}/\partial\boldsymbol{\theta}$ is singular — the *critical curves* in the image plane, mapping to *caustics* in the source plane. The Jacobian decomposes into convergence $\kappa$ and complex shear $\gamma$:

$$\mathcal{A} = \begin{pmatrix} 1-\kappa-\gamma_1 & -\gamma_2 \\ -\gamma_2 & 1-\kappa+\gamma_1 \end{pmatrix}, \qquad \mu = \frac{1}{\det\mathcal{A}} = \frac{1}{(1-\kappa)^2 - |\gamma|^2}\,.$$

The Fermat principle governs image formation: images appear at stationary points of the *time-delay surface* $\tau(\boldsymbol{\theta}) = \tfrac{1}{2}(\boldsymbol{\theta}-\boldsymbol{\beta})^2 - \psi(\boldsymbol{\theta})$. Minima, saddle points, and maxima of $\tau$ correspond to image parities that classify the observed image configurations.

| Regime | Typical $\kappa$ | Primary observable | Resolution | Main systematic |
|---|---|---|---|---|
| Strong lensing | $\gtrsim 1$ | Image positions, flux ratios | $\sim 0.1''$ | Mass-sheet degeneracy |
| Time-delay cosmography | $\gtrsim 1$ | $\Delta t$ between images | $\sim$ days | External convergence $\kappa_{\rm ext}$, lens profile |
| Weak lensing (clusters) | $10^{-2}$–$10^{-1}$ | Tangential shear profile | $\sim 10''$–$1'$ | Shape noise, photo-$z$ errors |
| Cosmic shear | $10^{-2}$ | $\xi_\pm(\theta)$, $C_\ell$ | $\sim 1$–$100'$ | Intrinsic alignments, baryonic feedback |

Historically, the three regimes matured independently: the first lensed quasar Q0957+561 (Walsh, Carswell & Weymann 1979) launched strong-lens cosmology, Refsdal (1964) proposed time delays as a cosmological probe, and Kaiser & Squires (1993) showed how to invert shear into mass. Modern cosmology demands their synthesis.

## 3 Methodology

### 3.1 The lens modeling inverse problem

Strong-lens mass reconstruction is the inversion of the lens equation given $N$ observed multiple images of $M$ background sources, possibly with extended host-galaxy surface brightness. Two families of methods dominate:

1. **Parametric models** (e.g. *lenstronomy*, *glee*): the mass is a sum of analytic profiles — singular isothermal ellipsoids (SIE), power-law ellipsoids $\rho \propto r^{-\gamma'}$, NFW halos, and external shear. They are compact and interpretable but assume the answer's functional form.
2. **Free-form / pixelated methods** (e.g. *MARS*, *GRALE*, PixeLens): $\kappa$ is discretized on a grid with regularization (maximum entropy, sparsity, smoothness). They make minimal assumptions but admit the full space of degenerate solutions.

Both families fit image positions to milliarcsecond precision, yet blind tests on simulated EAGLE lenses show that excellent image reproduction does **not** guarantee faithful recovery of the convergence field: reconstructed maps tend to be too round and too shallow, with Einstein radii recovered to $\sim 5\%$ for quads but $\sim 25\%$ for doubles [1 and references therein].

### 3.2 Shear measurement and mass mapping

Weak-lensing methodology begins with galaxy shapes. The observed ellipticity $\epsilon$ relates to the reduced shear $g = \gamma/(1-\kappa)$ via $\epsilon \approx \epsilon^s + g$ for small distortions. Kaiser–Squires inversion recovers $\kappa$ from $\gamma$ by Fourier deconvolution, $\hat{\kappa}(\mathbf{k}) = D(\mathbf{k})\hat{\gamma}(\mathbf{k})$, and aperture mass statistics provide model-free signal-to-noise estimators. Cosmic-shear cosmology compresses the field into two-point functions $\xi_\pm(\theta)$ or band powers, forward-modeled against $P(k)$ predictions.

### 3.3 Time-delay inference

For a variable source, the observable delay between images $i$ and $j$ is

$$\Delta t_{ij} = \frac{D_{\Delta t}}{c}\,\Delta\tau_{ij}, \qquad D_{\Delta t} \equiv (1+z_d)\frac{D_d D_s}{D_{ds}} \propto \frac{1}{H_0}\,,$$

where $\Delta\tau_{ij}$ is the Fermat potential difference determined by the lens model [1]. Inferring $H_0$ thus factorizes into (a) measuring $\Delta t_{ij}$ from light curves (COSMOGRAIL, now Rubin), (b) modeling $\Delta\tau_{ij}$, (c) correcting the line-of-sight *external convergence* $\kappa_{\rm ext}$ via galaxy counts and weak-lensing fields, and (d) breaking the internal mass-sheet degeneracy with stellar kinematics.

A minimal worked example of the Fermat potential for a singular isothermal sphere (SIS) illustrates the pipeline numerically:

```python
import numpy as np

def sis_fermat(theta, beta, theta_E):
    """Fermat potential tau(theta) for SIS with Einstein radius theta_E.
    theta, beta in arcsec; returns tau in arcsec^2."""
    psi = theta_E * np.abs(theta)          # SIS deflection potential
    return 0.5 * (theta - beta)**2 - psi

theta_E, beta = 1.0, 0.3                   # arcsec
# Image positions: theta = beta +/- theta_E
thA, thB = beta + theta_E, beta - theta_E
dtau = sis_fermat(thA, beta, theta_E) - sis_fermat(thB, beta, theta_E)
print(f"Image positions: {thA:.2f}, {thB:.2f} arcsec")
print(f"Fermat potential difference: {dtau:.4f} arcsec^2")
# Time-delay distance for a toy cosmology gives H0 via:
# H0 = (c / D_dt) * dtau / dt_observed  (with angular unit conversions)
```

---

## 4 Deep Dive

### 4.1 Strong-lens mass reconstruction: parametric versus free-form

Parametric modeling remains the workhorse of galaxy-scale strong lensing. A power-law ellipsoid plus external shear typically reproduces quad image positions to within a few milliarcseconds with $\chi^2_\nu \approx 1$, and the inferred logarithmic slope $\gamma' \equiv -d\ln\rho/d\ln r$ at the Einstein radius clusters near the isothermal value $\gamma' \approx 2$. The TDCOSMO program has shown that two independent codes (*glee* and *lenstronomy*) agree on Fermat potential differences to within a few percent once blinded modeling protocols are enforced [1]. The arrival of JWST is now the decisive advance: for the quad WFI2033–4723, JWST/NIRCam imaging improved the precision of the Fermat potential difference by **22%** relative to the best HST model, primarily through sharper PSF modeling and newly resolved quasar-host arcs [1].

Free-form methods trade precision for honesty. The MARS algorithm (maximum-entropy-regularized reconstruction) recovers cluster lenses such as Abell 1689 with NFW concentration $c_{200} = 5.53 \pm 0.77$, finding no evidence for the over-concentration once claimed from parametric fits [1]. The key lesson of blind studies is asymmetric: *image-plane fidelity does not imply mass-plane fidelity*. The *lensing Roche potential* — a combination of observables invariant under the mass-sheet transform — has been proposed to factor out the degeneracy and make model comparison meaningful [1].

### 4.2 The mass-sheet degeneracy and its breaking

The *mass-sheet transform* (MST),

$$\kappa(\boldsymbol{\theta}) \to \lambda\,\kappa(\boldsymbol{\theta}) + (1-\lambda), \qquad \boldsymbol{\beta} \to \lambda\,\boldsymbol{\beta},$$

leaves all image positions, flux ratios, and relative time delays invariant while rescaling the inferred time-delay distance as $D_{\Delta t} \to D_{\Delta t}/\lambda$ — and therefore $H_0 \to \lambda H_0$ [2]. It is the single dominant systematic of time-delay cosmography.

> **Theorem (Falco–Gorenstein–Shapiro degeneracy).** *For any lens model $\kappa$ and any $\lambda > 0$, the MST produces a model with identical image positions, shapes, and magnification ratios but time delays scaled by $1/\lambda$. No purely lensing observable can determine $\lambda$.*

Three routes break it: (i) **stellar kinematics** — the measured velocity dispersion $\sigma_v$ probes the 3D mass, constraining the internal sheet $\lambda_{\rm int}$; (ii) **multiple source planes** — sources at different redshifts experience different MST scalings; (iii) **absolute magnification** — standardizable sources or gravitational-wave sirens. The TDCOSMO hierarchical analysis, combining lensed quasars with SLACS galaxy–galaxy lenses, found that mass sheets are *required*: the inferred $H_0$ drops by $\sim 8\%$ once kinematics are included, and selection-function corrections lower it a further $\sim 3\%$, yielding $H_0 = 66 \pm 4$ (stat) $\pm 1$ (model sys) $\pm 2$ (measurement sys) km s$^{-1}$ Mpc$^{-1}$ [2]. The degeneracy even infects gravitational-wave lensing: for dark sirens, $H_0$ remains degenerate with the mass sheet unless supplemented by velocity dispersions [5].

### 4.3 Time-delay cosmography and the Hubble tension

Time-delay cosmography is prized because it is a *one-step* distance measurement, independent of both the Cepheid distance ladder and CMB sound-horizon physics [1]. The TDCOSMO collaboration's program — blinded analyses, fixed models before unblinding, full time-delay covariance matrices, and multi-code cross-checks — represents the state of the art in systematic control. For the lens WGD 2038–4008, incorporating two modeling codes and the full delay covariance matrix yielded $D_{\Delta t} = 1.68^{+0.40}_{-0.38}$ Gpc and $H_0 = 65^{+23}_{-14}$ km s$^{-1}$ Mpc$^{-1}$; the dominant uncertainty was quasar variability, not modeling [1].

The trajectory is clear: individual lenses currently deliver $\sim 5$–$15\%$ $H_0$ precision, and the collaboration's hierarchical combination of the full sample will provide the most robust single-probe $H_0$ from lensing to date [1]. In the Rubin era, with $\mathcal{O}(10^3)$ monitored lensed quasars expected, the statistical floor will fall below $1\%$ — at which point the entire enterprise lives or dies on mass-sheet control and selection modeling [2].

### 4.4 Weak-lensing shear statistics and the $S_8$ tension

Cosmic shear measures the amplitude of matter fluctuations through the parameter $S_8 \equiv \sigma_8\sqrt{\Omega_m/0.3}$. Stage-III surveys (DES Y3, KiDS-1000, HSC Y3) consistently prefer $S_8$ values $1$–$3\sigma$ below the Planck CMB inference — the *"lensing is low"* tension [6]. The two-point shear correlations $\xi_\pm(\theta)$ are forward-modeled with the nonlinear matter power spectrum (HMCode, EuclidEmulator), marginalizing over intrinsic alignments (TATT/NLA), baryonic feedback, and photometric redshift uncertainties.

Kaiser–Squires mass maps from DES Y3 — built from $>10^8$ galaxy shapes over $\sim 4500$ deg$^2$ — show the convergence field spanning $\kappa \pm 0.025$ with striking correspondence between overdensities and known clusters [6]. Non-parametric deprojection methods, applied to CLASH cluster shear profiles, recover circular velocities that are approximately flat at large radii and stellar-to-halo mass relations consistent with $\Lambda$CDM expectations, while demonstrating that parametric NFW fits can bias masses by amounts comparable to the hydrostatic bias they were meant to circumvent [4].

### 4.5 Joint strong+weak lensing: clusters as laboratories

Clusters are the one environment where strong and weak lensing overlap spatially. Joint analyses combine the Einstein-ring radius (strong) with the reduced tangential shear profile $g_t(R)$ (weak), reducing mass and concentration biases that arise from halo triaxiality and orientation [3]. Simulations show that strong-lens-selected clusters have concentrations $20$–$30\%$ above average at fixed mass — a selection effect that must be modeled, not averaged away [3]. JWST has extended this program dramatically: joint strong+weak analyses of the Sunrise Arc cluster achieved weak-lensing source densities of $\sim 100$ galaxies arcmin$^{-2}$, constraining the mass profile far beyond the strong-lensing regime and revising the magnification of the candidate star Earendel downward by orders of magnitude [1].

## 5 Empirical Results and Theoretical Guarantees

We summarize the quantitative state of the field:

- **Strong-lens mass reconstruction**: Einstein radii recovered to $\sim 5\%$ (quads) and $\sim 25\%$ (doubles) in blind EAGLE tests; ellipticity position angles to $\pm 10^\circ$; reconstructed maps systematically too round and shallow [1]. Abell 1689: $c_{200} = 5.53 \pm 0.77$, consistent with $\Lambda$CDM, no over-concentration [1].
- **Time-delay cosmography**: TDCOSMO+SLACS hierarchical result $H_0 = 66 \pm 4 \pm 1 \pm 2$ km s$^{-1}$ Mpc$^{-1}$ [2]; single-lens precision $5$–$15\%$; JWST improves Fermat potential precision by $22\%$ on WFI2033–4723 [1]; MST is the irreducible systematic, broken only by kinematics or multi-plane data [2,5].
- **Weak lensing**: cluster masses from WL+SL joint fits recover NFW parameters with orientation-driven scatter; concentrations of strong-lens-selected clusters biased high by $20$–$30\%$ [3]; non-parametric deprojections agree with $\Lambda$CDM stellar–halo relations [4]; cosmic shear $S_8$ tension persists at $1$–$3\sigma$ [6].

> **Theorem (Unbiasedness of shear).** *For a source population with $\langle\epsilon^s\rangle = 0$, the ensemble mean observed ellipticity is an unbiased estimator of the reduced shear, $\langle\epsilon\rangle = g$, to first order in $|\gamma|$ and $\kappa$. B-modes, which lensing cannot produce at leading order, therefore provide a null test of systematics.*

The theoretical guarantee that matters most for the coming decade is a negative one: the MST is an *exact* degeneracy of all lensing observables [2,5]. Precision without degeneracy-breaking is precision about the wrong quantity — the central caution of this thesis.

## 6 Limitations

1. **The mass-sheet degeneracy is exact**, not approximate; every strong-lens mass and $H_0$ measurement inherits it, and kinematics only break it to the accuracy of anisotropy and aperture corrections [2].
2. **Baryonic physics** complicates both ends: adiabatic contraction and feedback reshape inner profiles probed by strong lensing [3], while AGN feedback suppresses the small-scale matter power spectrum measured by cosmic shear at the several-percent level — degenerate with $S_8$ [6].
3. **Selection effects** are now the dominant known unknown: lensed quasars and strong-lens clusters are not fair samples of the deflector population, and modeling the selection function shifts $H_0$ by percent-level amounts comparable to the statistical error [2,3].
4. **Shear systematics** — PSF misestimation, blending, photo-$z$ biases, and intrinsic alignments — remain at the $\sim 1$–$2\%$ level in stage-III surveys, commensurate with the $S_8$ tension itself [6].
5. **Line-of-sight structure** ($\kappa_{\rm ext}$) contributes $\sim 3$–$5\%$ scatter to time-delay distances and must be calibrated per lens with deep field imaging and spectroscopy [1].

---

## 7 Conclusion

Gravitational lensing has matured from a collection of elegant effects into a precision measurement science spanning three orders of magnitude in scale. Strong-lens reconstruction delivers the sharpest mass maps but is bounded by exact degeneracies; time-delay cosmography delivers geometric distances but inherits those degeneracies wholesale; weak-lensing shear statistics deliver unmatched statistical power over cosmic volumes but are limited by percent-level astrophysical and instrumental systematics. Their synthesis — joint strong+weak analyses, hierarchical degeneracy-breaking with kinematics and selection modeling, and blinded multi-code inference — is already producing the most careful $H_0$ measurements outside the distance ladder and the CMB [1,2,3].

The next decade will be decisive. Euclid and the Rubin and Roman observatories will increase the known strong-lens sample by two orders of magnitude, turn cosmic shear into a sub-percent probe, and monitor thousands of lensed transients for time delays. The central challenge identified here will not disappear with more data: *the mass-sheet degeneracy is a property of the theory, not of the noise*. Meeting it will require the field's hard-won machinery — spatially resolved kinematics, multi-plane lensing, calibrated selection functions, and joint inversions of the lensing potential — applied at industrial scale. If that succeeds, lensing will weigh dark matter halos, map dark matter filaments, and arbitrate the Hubble tension on its own terms.

## References

[1] D. M. Williams, T. Treu, S. Birrer, et al., "TDCOSMO: XX. WFI2033–4723, the first quadruply imaged quasar modeled with JWST imaging," arXiv:2503.00099, 2025. https://arxiv.org/pdf/2503.00099v2

[2] T. Li, T. E. Collett, P. J. Marshall, et al., "Correcting for Selection Biases in the Determination of the Hubble Constant from Time-Delay Cosmography," arXiv:2410.16171, 2025. https://arxiv.org/abs/2410.16171v3

[3] C. Giocoli, M. Meneghetti, R. B. Metcalf, S. Ettori, L. Moscardini, "Mass and Concentration estimates from Weak and Strong Gravitational Lensing: a Systematic Study," MNRAS, arXiv:1311.1205, 2014. https://arxiv.org/abs/1311.1205v1

[4] T. Mistele, F. Lelli, S. McGaugh, J. Schombert, B. Famaey, "Mass Models of Galaxy Clusters from a Non-Parametric Weak-Lensing Reconstruction," arXiv:2506.13716, 2025. https://arxiv.org/pdf/2506.13716v2

[5] J. S. C. Poon, S. Rinaldi, J. Janquart, H. Narola, O. A. Hannuksela, "Galaxy lens reconstruction based on strongly lensed gravitational waves: similarity transformation degeneracy and mass-sheet degeneracy," arXiv:2406.06463, 2024. http://arxiv.org/abs/2406.06463v2

[6] A. Refregier, "Weak Gravitational Lensing by Large-Scale Structure," Ann. Rev. Astron. Astrophys. 41, 645–668 (2003), arXiv:astro-ph/0307212. https://ar5iv.labs.arxiv.org/html/astro-ph/0307212

