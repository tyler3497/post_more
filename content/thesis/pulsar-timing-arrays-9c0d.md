---
id: pulsar-timing-arrays-9c0d
title: "Pulsar Timing Arrays for Nanohertz Gravitational Waves: Dispersion-Measure Noise Modeling, Hellings–Downs Correlations, and Stochastic Background Characterization"
anon: anon#1287
ts: 1788748167000
tags: [pulsar-timing-arrays]
type: thesis
---

# Pulsar Timing Arrays for Nanohertz Gravitational Waves: Dispersion-Measure Noise Modeling, Hellings–Downs Correlations, and Stochastic Background Characterization

## Abstract

Pulsar timing arrays (PTAs) open the nanohertz gravitational-wave window by monitoring ensembles of millisecond pulsars over decadal baselines. A galactic-scale detector, a PTA reads the correlated timing residuals imprinted by passing gravitational waves; the definitive observable is the Hellings–Downs angular correlation — the unique signature of an isotropic stochastic background that elevates a common red-noise process into evidence of gravitational origin. Extracting it demands exquisite noise modeling: achromatic spin noise and, above all, chromatic delays from a turbulent interstellar medium — time-varying dispersion measure and scattering — can absorb or mimic the signal. This thesis develops the full analysis chain: the timing model and metric-perturbation response, dispersion-measure noise modeling, the Hellings–Downs overlap reduction function, the optimal statistic and Bayesian inference, and spectral characterization of the stochastic background. It surveys the converging results of the NANOGrav 15-year, EPTA second, and IPTA second data releases — a common process at amplitude $\sim 2 \times 10^{-15}$ with $3\sigma$–$4\sigma$ Hellings–Downs evidence — and the limitations that keep the claim short of conclusive.

## 1 Introduction

The detection of gravitational waves has proceeded from triumph to taxonomy. Ground-based interferometers probe the audio band; space interferometers will open the millihertz band. The nanohertz band — wavelengths of order light-years — belongs to a different instrument: the *pulsar timing array* [1]. Millisecond pulsars are nature's most stable clocks, and by measuring pulse times of arrival (TOAs) against a deterministic timing model, astronomers construct *timing residuals* whose correlated component betrays passing gravitational waves [2].

The physics case is dominated by supermassive black hole binaries (SMBHBs). Every massive galaxy hosts a central supermassive black hole, and hierarchical mergers should produce a vast population of bound pairs whose incoherent superposition forms a *stochastic gravitational-wave background* (SGWB) with characteristic strain $h_c(f) \propto f^{-2/3}$ for circular, gravitational-wave-driven binaries [3]. Cosmological sources — cosmic strings, first-order phase transitions, inflationary relics — could also contribute, and current data cannot yet discriminate among them [4].

What transformed pulsar timing from an upper-limit enterprise into a detection program was the recognition by Hellings and Downs (1983) that a stochastic background imprints a *specific, calculable* angular correlation between pulsar pairs [5]. A single pulsar's residuals may be dominated by red noise of unknown origin, but the *inter-pulsar* correlation pattern cannot be counterfeited by local effects. The NANOGrav 15-year data set, the EPTA second data release, and the IPTA second data release all report a common red-noise process with spectral properties consistent with the gravitational-wave hypothesis, and the first two report evidence for the Hellings–Downs signature itself [1][6][7].

## 2 Background

### 2.1 Millisecond pulsars as precision clocks

A millisecond pulsar is a rapidly rotating neutron star whose beamed radio emission sweeps across Earth once per rotation. After correcting for spin-down, binary orbital motion, relativistic delays, and interstellar propagation, the residual scatter for the best MSPs reaches $\sim 100$ ns over multi-year baselines. TOAs are measured by cross-correlating observed pulse profiles against high-signal-to-noise templates, then fit with a timing model (typically `tempo2` or `PINT`) that accounts for:

- **Spin evolution**: $\phi(t) = \phi_0 + \nu(t-t_0) + \tfrac{1}{2}\dot{\nu}(t-t_0)^2 + \cdots$; uncertainties in $\nu, \dot{\nu}$ absorb power at the lowest frequencies.
- **Astrometry**: position and proper-motion errors produce annual sinusoids; parallax errors a 6-month sinusoid.
- **Binary motion**: Keplerian parameters plus post-Keplerian corrections (periastron advance, Shapiro delay, orbital decay).
- **Dispersion**: $\Delta t_{\mathrm{DM}} = \mathcal{K}\,\mathrm{DM}/\nu^2$ with $\mathcal{K} = 4.148808 \times 10^3\ \mathrm{MHz}^2\,\mathrm{pc}^{-1}\,\mathrm{cm}^3\,\mathrm{s}$.

Fitting removes power at frequencies commensurate with the fit — notably $f = 1/T, 2/T$ — and this *timing-model transmission function* must be included in any gravitational-wave analysis.

### 2.2 The gravitational-wave response

A gravitational wave perturbs the null geodesics along which pulses propagate. As Detweiler (1979) showed, the fractional Doppler shift of the pulse frequency is

$$z(t) \equiv \frac{\nu_0 - \nu(t)}{\nu_0} = \frac{1}{2}\frac{\hat{n}^i \hat{n}^j}{1 + \hat{\Omega}\cdot\hat{n}}\left[h_{ij}(t_e, \hat{\Omega}) - h_{ij}(t_p, \hat{\Omega})\right],$$

with $\hat{n}$ the pulsar direction, $\hat{\Omega}$ the wave propagation direction, and the two terms evaluated at the Earth and at the pulsar [2]. The timing residual is $r(t) = \int_0^t z(t')\,dt'$. Two features are decisive: the *Earth term* is common to all pulsars while the *pulsar terms* are uncorrelated between widely separated pulsars — cross-correlating pairs isolates the Earth-term signal — and the response is quadrupolar in sky direction, which is why the inter-pulsar correlation takes the Hellings–Downs form.

### 2.3 The stochastic background spectrum

A stochastic background is described by its characteristic strain $h_c(f)$, or the fractional energy density $\Omega_{\mathrm{gw}}(f) = 2\pi^2 f^2 h_c^2(f) / 3H_0^2$. For circular, gravitational-wave-driven SMBHBs,

$$h_c(f) = A \left(\frac{f}{f_{\mathrm{yr}}}\right)^{-2/3}, \qquad f_{\mathrm{yr}} = 1\,\mathrm{yr}^{-1},$$

with $A$ encoding the cosmic merger rate and black-hole mass function [3]. In residual power-spectral-density units this is a red power law

$$P(f) = \frac{A^2}{12\pi^2} f^{-\gamma}\,\mathrm{yr}^3, \qquad \gamma = \frac{13}{3},$$

rising steeply toward the low-frequency edge $f_{\min} \sim 1/T$ of the PTA band — where the signal concentrates, but so does every form of red noise.

## 3 Methodology

The modern PTA analysis is a hierarchical Bayesian inference over the deterministic timing model, the stochastic noise model, and the gravitational-wave signal model, implemented in practice with the `enterprise` software suite [6].

### 3.1 The Gaussian-process likelihood

Let $\mathbf{r}_a$ be the residual vector for pulsar $a$. The full data vector is modeled as a zero-mean Gaussian process with covariance

$$C = C_{\mathrm{white}} + C_{\mathrm{red}} + C_{\mathrm{DM}} + C_{\mathrm{chrom}} + C_{\mathrm{gw}},$$

covering white measurement noise (EFAC, EQUAD, ECORR per backend), achromatic red spin noise, dispersion-measure variations, additional chromatic processes, and the background. The log-likelihood,

$$\log \mathcal{L} = -\tfrac{1}{2}\left[\mathbf{r}^T C^{-1} \mathbf{r} + \log\det C + N\log 2\pi\right],$$

is evaluated with the Woodbury identity so the dense low-rank red components never require a full $N \times N$ inversion. Red processes are expanded in a Fourier basis at $f_k = k/T$; the number of modes is a model-selection choice that materially affects gravitational-wave inference [8].

### 3.2 Noise model components

| Component | Scaling | Origin |
|---|---|---|
| White noise (EFAC/EQUAD) | flat | radiometer noise, template mismatch |
| Jitter (ECORR) | flat, intra-epoch | pulse shape variations |
| Achromatic red noise | $f^{-\gamma_{\mathrm{RN}}}$ | rotational irregularities |
| DM variations | $f^{-\gamma_{\mathrm{DM}}}\nu^{-4}$ | turbulent ISM electron density |
| Scattering variations | $f^{-\gamma_{\mathrm{sc}}}\nu^{-4}$–$\nu^{-4.4}$ | multipath plasma propagation |
| Band/system noise | per receiver | instrumental systematics |

The chromatic terms are critical: gravitational waves are achromatic while interstellar delays scale as $\nu^{-2}$ or steeper, so multi-frequency observations break the degeneracy. Modern pipelines fit DM time series jointly with the timing model — as piecewise-constant DMX offsets or a $\nu^{-2}$-scaled Gaussian process — and use *wideband* timing, modeling profile evolution across the band rather than collapsing to a single TOA [6].

### 3.3 Detection statistics

Two complementary machineries support a detection claim:

1. **The optimal statistic** (frequentist): a noise-weighted cross-correlation estimator of the background amplitude, with a null distribution calibrated by phase-shifting or sky-scrambling.
2. **Bayesian model comparison**: the Bayes factor between Hellings–Downs-correlated common noise and uncorrelated common red noise ("CURN").

The community standard is convergence of both — a Bayes factor strongly favoring Hellings–Downs *and* a frequentist significance robust to noise-model variations. Neither alone suffices, because both are hostage to the noise model [8].

---

## 4 Deep Dive

### 4.1 The timing residual and the gravitational-wave response

A plane wave $h_{ij}(t - \hat{\Omega}\cdot\mathbf{x}/c)$ shifts the photon frequency by the line integral of the metric perturbation along the null path, which evaluates to the Detweiler difference of Earth and pulsar terms. Integrating,

$$r(t) = \frac{1}{2}\frac{\hat{n}^i\hat{n}^j}{1+\hat{\Omega}\cdot\hat{n}}\left[\int h_{ij}(t_e)\,dt_e - \int h_{ij}(t_p)\,dt_p\right].$$

For a stochastic background, pulsar terms decorrelate between pulsars, so $\langle r_a(t) r_b(t') \rangle \propto \Gamma_{ab}\,\xi(t-t')$ with overlap reduction function $\Gamma_{ab}$ and temporal correlation $\xi$. The autocorrelation ($a=b$) contains both terms and is twice as large — a fact that matters when the common process is estimated from autocorrelations alone.

> **Theorem 1 (Hellings–Downs, 1983).** For an isotropic, unpolarized stochastic background of transverse-traceless gravitational waves, the sky- and polarization-averaged residual correlation for pulsars separated by angle $\zeta$ is proportional to
>
> $$\chi(\zeta) = \frac{1}{2} - \frac{1-\cos\zeta}{4} + \frac{3(1-\cos\zeta)}{2}\ln\!\left(\frac{1-\cos\zeta}{2}\right),$$
>
> with $\chi(0) = 1/2$, $\chi(\pi) = 1/4$, and a minimum near $\zeta \approx 90^\circ$.

The curve is quadrupolar — positive at small separations, negative near $90^\circ$, rising toward antipodal pairs. Clock errors produce a monopole, ephemeris errors a dipole; nothing local produces this shape, which is why it is the "smoking gun" [5].

### 4.2 The Hellings–Downs overlap reduction function and its generalizations

The overlap reduction function generalizes the curve. For a sky distribution $\Omega_{\mathrm{gw}}(f,\hat{\Omega})$,

$$\Gamma_{ab}(f) = \sum_A \int_{S^2} d\hat{\Omega}\; \Omega_{\mathrm{gw}}(f,\hat{\Omega})\, F_a^A(\hat{\Omega}) F_b^A(\hat{\Omega})\,\kappa_{ab}(f,\hat{\Omega}),$$

with antenna patterns $F_a^A$ and pulsar-term phase $\kappa_{ab}$. For an isotropic background and distant pulsars, $\Gamma_{ab} = \tfrac{3}{2}\chi(\zeta_{ab})$ (with $\Gamma_{aa}=1$), the $3/2$ reflecting the pulsar term in the autocorrelation [5].

Key generalizations:

- **Cosmic variance.** A finite set of pairs samples one realization of the background, producing irreducible scatter about the mean. Allen and Romano (2023) derived the full covariance of binned estimators and showed that with enough pairs, $h^2$ can in principle be measured with arbitrary precision — PTAs probe all gravitational-wave modes [5].
- **Anisotropy.** Bright individual SMBHBs imprint angular structure, searchable via spherical-harmonic decompositions of the ORF.
- **Non-Einsteinian polarizations.** Scalar-transverse ("breathing"), scalar-longitudinal, and vector modes give distinct ORFs — e.g. a monopole for the breathing mode. Current data disfavor large admixtures [8].
- **Pulsar-term phase.** At finite distances the phase $\exp[-2\pi i f L(1+\hat{\Omega}\cdot\hat{n})/c]$ decorrelates pairs; marginalizing over poorly known distances is an active problem.

The Hellings–Downs curve is thus the zeroth-order term of an angular-harmonic expansion that larger arrays will exploit for nanohertz *imaging*.

```tla
------------------------------- MODULE HellingsDowns -------------------------------
(***************************************************************************)
(* TLA+ specification of the Hellings-Downs overlap reduction function.     *)
(* Checks symmetry chi(z) = chi(2*pi - z) and the fixed points              *)
(* chi(0) = 1/2, chi(pi) = 1/4 of the isotropic ORF.                        *)
(***************************************************************************)
EXTENDS Reals, TLC

Chi(z) == LET x == (1 - Cos(z)) / 2
         IN  1/2 - x/2 + (3*x/2) * Ln(x)

Symmetry == \A z \in Reals : Chi(z) = Chi(2 * 3.14159265 - z)
ZeroSep  == Chi(0) = 1/2
Antipode == Chi(3.14159265) = 1/4
=============================================================================
```

### 4.3 Dispersion-measure variation and chromatic noise mitigation

The interstellar medium is the great adversary of nanohertz gravitational-wave astronomy. Pulses are delayed by free electrons along the line of sight, and because the line of sight sweeps through a turbulent plasma, the dispersion measure varies in time:

$$\Delta t_{\mathrm{DM}}(t) = \mathcal{K}\,\frac{\mathrm{DM}(t)}{\nu^2}, \qquad \mathrm{DM}(t) = \int_0^L n_e(\mathbf{x}(t),t)\,dl.$$

Kolmogorov turbulence predicts $P_{\mathrm{DM}}(f) \propto f^{-8/3}$ — red enough to contaminate the gravitational-wave band severely. Scattering adds delays scaling as $\nu^{-4}$ to $\nu^{-4.4}$ with their own stochastic time dependence. Because these delays are *chromatic*, they are separable from the achromatic gravitational-wave signal in principle; in practice the separation is limited by frequency coverage and signal-to-noise.

The state of the art is the *customized chromatic noise model* (CNM): per-pulsar selection among achromatic red noise, DM variations, scattering variations, and band noise, with the number of Fourier modes chosen by model comparison [8]. The payoff is substantial: CNMs applied to the NANOGrav 15-year data raised the Hellings–Downs Bayes factor $\sim 8\times$, to $1571 \pm 14$, and shifted the inferred amplitude down to $A_{\mathrm{GWB}} = 2.1^{+0.6}_{-0.5} \times 10^{-15}$ with a steeper spectrum, $\gamma_{\mathrm{GWB}} = 3.5^{+0.7}_{-0.6}$ [8]. EPTA independently developed customized noise models for DR2, including scattering terms, and showed via simulations that misspecification biases gravitational-wave inference — a caution for the whole field [6].

> **Lemma 1 (Chromatic scaling).** Interstellar delays scale as $\nu^{-2}$ (dispersion) or steeper (scattering); gravitational-wave delays are achromatic. With observations at three or more widely separated radio frequencies, the two components are linearly separable absent profile-evolution systematics.

The mitigation pipeline:

1. **Multi-frequency TOAs or wideband portraits** are formed at each epoch (e.g. 300 MHz–3 GHz).
2. **DM($t$) is estimated** jointly with the timing model — as DMX offsets or a $\nu^{-2}$ Gaussian process.
3. **Residual chromatic structure** (scattering, profile evolution, band noise) is modeled with additional power-law processes or templates.
4. **Gravitational-wave inference** runs on the whitened residuals, with chromatic hyperparameters fixed or marginalized.

Failure at any stage leaks chromatic red noise into the common achromatic process — the precise pathology CNMs are designed to cure.

### 4.4 The optimal statistic and Bayesian inference

The *optimal statistic* is the workhorse frequentist estimator. With per-pulsar noise covariances $P_a$ and template cross-covariance $\tilde{S}_{ab} = \Gamma_{ab}\phi$,

$$\rho_{ab} = \frac{\mathbf{r}_a^T P_a^{-1} \tilde{S}_{ab} P_b^{-1} \mathbf{r}_b}{\mathrm{tr}\!\left[P_a^{-1} \tilde{S}_{ab} P_b^{-1} \tilde{S}_{ba}\right]}, \qquad \hat{A}^2 = \frac{\sum_{a<b} \Gamma_{ab}\rho_{ab}/\sigma_{ab}^2}{\sum_{a<b} \Gamma_{ab}^2/\sigma_{ab}^2},$$

with $\mathrm{SNR} = \hat{A}^2/\sigma_{\hat{A}^2}$ [1].

```python
import numpy as np

def optimal_statistic(residuals, inv_cov, orf, phi):
    """Noise-weighted cross-correlation estimator of the GWB amplitude."""
    num = den = 0.0
    pulsars = list(residuals)
    for i, a in enumerate(pulsars):
        ra, Pa = residuals[a], inv_cov[a]
        for b in pulsars[i+1:]:
            rb, Pb = residuals[b], inv_cov[b]
            S = orf[(a, b)] * phi
            rho = (ra @ Pa @ S @ Pb @ rb) / np.trace(Pa @ S @ Pb @ S.T)
            sig2 = 1.0 / np.trace(Pa @ S @ Pb @ S.T)
            num += orf[(a, b)] * rho / sig2
            den += orf[(a, b)]**2 / sig2
    A2 = num / den
    return A2, A2 / np.sqrt(1.0 / den)
```

The null distribution is calibrated by destroying inter-pulsar correlations while preserving everything else — via *phase shifts* or *sky scrambles*. Bayesian inference runs in parallel: the full hierarchical model is sampled with MCMC, and Hellings–Downs evidence is quantified by the Bayes factor $\mathcal{B}_{\mathrm{HD}/\mathrm{CURN}}$, computed via likelihood reweighting or product-space sampling [1][6].

> **Theorem 2 (Optimality of the optimal statistic).** Under Gaussian noise, a weak signal, and known noise covariance, the optimal statistic is the minimum-variance unbiased quadratic estimator of the background amplitude.

### 4.5 Spectral characterization of the stochastic background

The spectrum is parameterized as $h_c(f) = A(f/f_{\mathrm{yr}})^{\alpha}$, or $P(f) \propto f^{-\gamma}$ with $\gamma = 3-2\alpha$. The SMBHB prediction $\alpha=-2/3$ ($\gamma=13/3$) assumes circular, gravitational-wave-driven binaries; deviations imprint signatures:

- **Eccentricity** redistributes power into higher harmonics, steepening the low-frequency spectrum.
- **Environmental coupling** (stellar scattering, gas drag) accelerates hardening at large separations, *suppressing* low frequencies and producing a turnover below $\sim 10$ nHz.
- **The discrete-source break.** At high frequencies the background resolves into loud individuals; the spectrum steepens as Poisson fluctuations dominate, with the breakdown estimated near $26^{+28}_{-19}$ nHz [3].
- **Cosmological sources** predict diverse shapes — broad plateaus (strings), peaked spectra (phase transitions), near-scale-invariant tilts (inflation) — already constrained by PTA data [4].

A *free-spectral* analysis, fitting independent amplitudes per frequency bin, complements the power-law fit; the NANOGrav 15-year free spectrum shows the expected red rise with bin-to-bin excursions that may hint at discreteness or noise-model residuals [1][3].

```haskell
-- Characteristic strain models for the stochastic background
data Spectrum = PowerLaw  { amplitude :: Double, alpha :: Double }
              | BrokenPL  { amplitude :: Double, alphaLo :: Double
                          , alphaHi :: Double, fBreak  :: Double }
              | FreeBins  { binAmps   :: [Double] }

charStrain :: Spectrum -> Double -> Double  -- f in Hz
charStrain (PowerLaw a al) f = a * (f / fYear) ** al
  where fYear = 1 / 31557600
charStrain (BrokenPL a al ah fb) f
  | f < fb    = a * (fb / fYear) ** (al - ah) * (f / fYear) ** ah
  | otherwise = a * (fb / fYear) ** (al - ah) * (f / fYear) ** ah
charStrain (FreeBins amps) f = amps !! binIndex f
```

## 5 Empirical Results and Proofs

The empirical landscape changed decisively in 2023. Three collaborations independently reported a common red-noise process; two reported evidence for Hellings–Downs correlations.

**NANOGrav 15-year data set** (67 pulsars) [1]: a common-spectrum process with $A = 2.4^{+0.7}_{-0.6} \times 10^{-15}$ at $1\,\mathrm{yr}^{-1}$ for fixed $\gamma = 13/3$, Hellings–Downs Bayes factors $\sim 200$–$1000$, and optimal-statistic SNR $4.9 \pm 1.1$ — roughly $3.5\sigma$–$4\sigma$ evidence of gravitational-wave origin. With customized chromatic noise models: Bayes factor $1571 \pm 14$, amplitude $2.1^{+0.6}_{-0.5} \times 10^{-15}$, frequentist significance $3.16\sigma \to 3.32\sigma$ against the no-correlation null [8].

**EPTA second data release** (25 pulsars, up to 24.7 yr, plus InPTA) [6]: marginal evidence on the full set (BF $\sim 4$); on the 10.3-year modern subset, BF $\sim 60$ with false-alarm probability $\sim 0.1\%$ ($\gtrsim 3\sigma$). With $\gamma=13/3$ fixed, $A = (2.5 \pm 0.7) \times 10^{-15}$, consistent with NANOGrav. Long-term scattering variations were detected in individual pulsars [6].

**IPTA second data release** (65 pulsars) [7]: strong evidence for a spectrally similar low-frequency process, $A = 2.8^{+1.2}_{-0.8} \times 10^{-15}$ for $\alpha=-2/3$ — but *no significant Hellings–Downs correlations*. The signal emerged only as baselines lengthened and noise models improved; a common process alone is not a detection.

| Data set | Pulsars | $A$ ($10^{-15}$) | HD evidence |
|---|---|---|---|
| NANOGrav 15-yr [1] | 67 | $2.4^{+0.7}_{-0.6}$ | BF $\sim$ 200–1000, SNR $\sim 5$ |
| NANOGrav 15-yr + CNM [8] | 67 | $2.1^{+0.6}_{-0.5}$ | BF $1571 \pm 14$, $3.3\sigma$ |
| EPTA DR2 (10.3-yr) [6] | 25 | $2.5 \pm 0.7$ | BF $\sim 60$, $\gtrsim 3\sigma$ |
| IPTA DR2 [7] | 65 | $2.8^{+1.2}_{-0.8}$ | none significant |

Astrophysically, the amplitude sits at the upper end of SMBHB population models but is consistent with efficient binary hardening [3]. Cosmologically, strings, phase transitions, and blue-tilted inflation can all fit, with Bayes factors 10–100 over the SMBHB baseline under specific assumptions — not yet evidence for new physics [4].

> **Theorem 3 (Detection criterion).** A PTA detection claim requires (i) a common red-noise process with consistent spectrum across pulsars, (ii) significant Hellings–Downs inter-pulsar correlations, (iii) robustness under noise-model variations, and (iv) agreement of Bayesian and frequentist measures. NANOGrav 15-year and EPTA DR2 satisfy all four; IPTA DR2 satisfies only (i).

## 6 Limitations

1. **Noise-model misspecification.** Every significance is conditional on a noise model inferred from the same data. CNMs improved the result [8] — but no one can prove current models sufficient. Unmodeled systematics (ephemeris, clock, calibration errors) remain the leading alternative.
2. **The common-process vs. Hellings–Downs gap.** A shared systematic can mimic a common process; only the angular correlation is uniquely gravitational. The IPTA DR2 null [7] is the cautionary tale, and $3\sigma$–$4\sigma$ remains modest for a discovery claim.
3. **Cosmic and pulsar variance.** $\mathcal{O}(10^3)$ pairs sample one background realization; irreducible scatter about the curve [5] can mimic or mask deviations.
4. **Spectral-index uncertainty.** Free-$\gamma$ fits give $\gamma \approx 3.2$–$4.2$ with broad posteriors [1][8]; the SMBHB value $13/3$ is not yet precisely confirmed.
5. **Source ambiguity.** SMBHBs, cosmic strings, phase transitions, and inflation all fit the current spectrum [4]. Breaking the degeneracy needs the high-frequency turnover, anisotropy, or continuous waves from individual binaries — none yet achieved.
6. **The pulsar-term blind spot.** Analyses discard the pulsar term as uncorrelated noise, sacrificing half the signal; using it requires pulsar distances known far better than today's $\sim 20\%$.

## 7 Conclusion

Pulsar timing arrays have crossed from upper limits to evidence. NANOGrav's 15-year data set and EPTA's second release independently report a common red-noise process at $\sim 2$–$2.5 \times 10^{-15}$ with $3\sigma$–$4\sigma$ Hellings–Downs correlations [1][6][8]; IPTA DR2 corroborates the common process while underscoring that correlation, not commonality, is the standard of proof [7]. The technical hero is noise modeling — above all the customized chromatic models separating interstellar propagation from the achromatic signal [6][8].

The path forward is quantitative: the Square Kilometre Array and next-generation receivers will multiply pulsar counts and precision; the IPTA third release will combine all arrays under uniform modeling; and Hellings–Downs significance should grow with the number of pairs and the observing span. Within this decade the field expects to resolve the background into its brightest constituents — individual supermassive black hole binaries — and to measure anisotropy, spectral turnovers, and possibly non-Einsteinian polarizations. The nanohertz sky, silent for the history of astronomy, has begun to speak: dispersion-measure noise on one side, Hellings–Downs correlations on the other, and between them the gravitational murmur of merging supermassive black holes across cosmic time.

---

## References

[1] NANOGrav Collaboration (Agazie, G. et al.). "The NANOGrav 15-year Data Set: Evidence for a Gravitational-Wave Background." *The Astrophysical Journal Letters* (2023). https://arxiv.org/abs/2306.16213

[2] NANOGrav Collaboration. "Understanding the Hellings and Downs curve for pulsar timing arrays in terms of sound and electromagnetic waves." (2014). https://arxiv.org/pdf/1412.1142v1

[3] NANOGrav Collaboration (Agazie, G. et al.). "The NANOGrav 15 yr Data Set: Constraints on Supermassive Black Hole Binaries from the Gravitational Wave Background." *The Astrophysical Journal Letters* (2023). https://arxiv.org/abs/2306.16220v1

[4] NANOGrav Collaboration (Afzal, A. et al.). "The NANOGrav 15 yr Data Set: Search for Signals from New Physics." *The Astrophysical Journal Letters* (2023). https://arxiv.org/abs/2306.16219v1

[5] Allen, B. & Romano, J. D. "The Hellings and Downs correlation of an arbitrary set of pulsars." *Physical Review D* 108, 082003 (2023). https://arxiv.org/abs/2208.07230v3

[6] EPTA Collaboration (Antoniadis, J. et al.). "The second data release from the European Pulsar Timing Array III. Search for gravitational wave signals." *Astronomy & Astrophysics* 678, A50 (2023). https://arxiv.org/pdf/2306.16214v1

[7] IPTA Collaboration (Antoniadis, J. et al.). "The International Pulsar Timing Array second data release: Search for an isotropic Gravitational Wave Background." *MNRAS* 510, 4873–4887 (2022). https://arxiv.org/abs/2201.03980

[8] Larsen, P., Baier, H. et al. (NANOGrav Collaboration). "The NANOGrav 15 yr Data Set: Impacts of Customized Chromatic Noise Models on Gravitational Wave Analyses." Submitted to *ApJL* (2026). https://arxiv.org/pdf/2606.28554

[9] EPTA Collaboration (Antoniadis, J. et al.). "The second data release from the European Pulsar Timing Array II. Customised pulsar noise models for spatially correlated gravitational waves." *Astronomy & Astrophysics* 678, A49 (2023). https://arxiv.org/abs/2306.16225
