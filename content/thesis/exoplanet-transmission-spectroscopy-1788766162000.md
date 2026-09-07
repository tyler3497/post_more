---
id: ths_1788766162000_df97
title: "Exoplanet Atmosphere Retrieval via Transmission Spectroscopy: Nested Sampling with MultiNest and Dynesty, Cloud–Haze Degeneracies, JWST NIRSpec Results, and Biosignature False Positives"
anon: anon#1893
ts: 1788766162000
tags: [Astrophysics]
type: thesis
---

# Exoplanet Atmosphere Retrieval via Transmission Spectroscopy: Nested Sampling with MultiNest and Dynesty, Cloud–Haze Degeneracies, JWST NIRSpec Results, and Biosignature False Positives

## Abstract

Transmission spectroscopy with the *James Webb Space Telescope* has transformed exoplanet atmosphere characterization from isolated molecular detections into a full Bayesian inverse problem, in which high-dimensional posterior distributions over compositions, thermal structures, and aerosol properties must be inferred from millipixel transit-depth spectra. This thesis develops the foundations of atmospheric retrieval in transmission geometry: the radiative-transfer forward model and its scale-height dependence; why nested sampling — **MultiNest** and **dynesty** — displaced MCMC for multimodal, degenerate likelihoods; cloud and haze parameterizations and the stubborn degeneracies among cloud-top pressure, mean molecular weight, and terminator temperature that muted the *Hubble* era; the JWST NIRSpec results that broke many of these degeneracies, anchored by the K2-18 b campaign — its CH₄ and CO₂ detections and the contested dimethyl sulfide claim; and a standards-of-evidence framework for biosignature assessment, covering abiotic false positives and instrumental systematics. We argue retrieval is now limited less by photon statistics than by model choice, opacity fidelity, and noise-model misspecification — limits that dictate how evidence for life must be weighed.

## 1 Introduction

When a transiting exoplanet passes in front of its host star, starlight filtering through the thin annulus of atmosphere at the terminator encodes the atmosphere's composition as a wavelength-dependent transit depth, $\delta(\lambda)$. The retrieval problem is conceptually simple — invert $\delta(\lambda)$ for the vector of atmospheric parameters $\boldsymbol{\theta}$ — but practically treacherous. The forward mapping is nonlinear, the parameter space is riddled with near-degenerate valleys, and the information content of the data is marginal.

The *Hubble Space Telescope* era (2010–2022) established the two governing facts of the field. First, molecular features are systematically *muted* relative to clear-atmosphere expectations, most plausibly by high-altitude aerosols [7]. Second, cloud-top pressure is nearly perfectly degenerate with molecular abundance: a high-abundance absorber above an opaque deck produces the same spectrum as a low-abundance absorber in a clear atmosphere [8]. These facts made retrieval a poster child for Bayesian inverse theory — a setting in which point estimates are meaningless and the full posterior, including its degenerate tails, is the scientifically honest product.

Three developments have since redefined the discipline. **Nested sampling** became the dominant inference engine, with **MultiNest** [2][5] and **dynesty** [9] powering nearly every modern retrieval framework; their ability to compute the Bayesian evidence while sampling multimodal posteriors made model comparison — cloudy versus clear, molecule present versus absent — rigorous.

The K2-18 b campaign has become the field's defining stress test. Across NIRISS SOSS, NIRSpec G395H/G235H, and MIRI LRS, retrievals consistently find CH₄ and CO₂ at high significance, while the claimed detection of dimethyl sulfide (DMS) — a candidate biosignature gas — has oscillated between $\sim$3$\sigma$ significance and outright non-detection depending on data reduction, binning, and noise assumptions [2][3]. The dispute is not merely about one molecule: it is about how the community validates retrieval claims at all, and it has catalyzed an astrobiological standards-of-evidence framework that future biosignature searches will be judged against [2].

This thesis synthesizes these threads into a single narrative: how nested sampling works and why it won; what cloud-haze degeneracies really are and how to parameterize them; what JWST has measured; and how to reason about biosignatures without fooling ourselves.

## 2 Background

### 2.1 The transmission forward model

In transmission geometry, the observable is the wavelength-dependent effective planetary radius $R_p(\lambda)$, defined by the altitude at which the slant optical depth $\tau(\lambda)$ reaches $\sim 0.56$–$1$ along a grazing ray. For an isothermal, well-mixed atmosphere, the transit depth is approximately

$$\delta(\lambda) \simeq \left(\frac{R_{p,0}}{R_\star}\right)^2 + 2\frac{R_{p,0}H}{R_\star^2}\,\ln\left(\frac{\sigma(\lambda)}{\sigma_0}\right)$$

where $R_{p,0}$ is the reference radius, $R_\star$ the stellar radius, $\sigma(\lambda)$ the total extinction cross-section, and $H$ the pressure scale height

$$H = \frac{k_B T}{\mu g},$$

with $T$ the terminator temperature, $\mu$ the mean molecular weight, and $g$ the surface gravity. Three lessons follow immediately:

- **Feature amplitude scales as $H/R_\star$**, so hot, low-gravity, hydrogen-dominated atmospheres are the easiest targets, while high-$\mu$ (water-rich or CO₂-dominated) atmospheres produce intrinsically smaller features — the fundamental handicap of terrestrial-planet characterization.
- **Absolute radius and opacity are degenerate**: the reference pressure $P_0$ at which $R_{p,0}$ is defined is itself a free parameter, and retrievals must fix it at an arbitrary deep level (often 10 bar).
- **Clouds truncate the line of sight**: an opaque deck at pressure $P_c$ replaces the deep atmospheric column with a flat continuum, muting feature amplitudes exactly as lowering every absorber's mixing ratio would — the cloud–abundance degeneracy of §4.2.

Modern forward models discretize the atmosphere into $\sim 10^2$ layers, integrate hydrostatic equilibrium, and accumulate molecular, collision-induced, Rayleigh, and aerosol opacity from line lists (ExoMol, HITEMP, HITRAN) at resolutions of $R \sim 10^4$–$10^6$ before binning to the instrument resolution.

### 2.2 The Bayesian retrieval framework

A retrieval framework evaluates the posterior

$$P(\boldsymbol{\theta}|\mathcal{D}, \mathcal{M}) = \frac{\mathcal{L}(\mathcal{D}|\boldsymbol{\theta}, \mathcal{M})\,\pi(\boldsymbol{\theta}|\mathcal{M})}{\mathcal{Z}(\mathcal{D}|\mathcal{M})},$$

where $\mathcal{L}$ is the likelihood, $\pi$ the prior, and $\mathcal{Z} = \int \mathcal{L}(\boldsymbol{\theta})\pi(\boldsymbol{\theta})\,d\boldsymbol{\theta}$ the **Bayesian evidence** — the marginalized likelihood that normalizes the posterior and, crucially, enables quantitative model comparison via Bayes factors, $B_{12} = \mathcal{Z}_1/\mathcal{Z}_2$. The evidence is what lets a retrieval *detect* a molecule: $\Delta\ln\mathcal{Z} \approx 3$ corresponds to roughly 3$\sigma$ significance on the Jeffreys scale, and it is the quantity reported, debated, and sometimes misinterpreted in every biosignature claim [5].

The community standard likelihood assumes independent Gaussian errors,

$$\ln\mathcal{L} = -\frac{1}{2}\sum_{i=1}^{N}\left[\frac{(D_i - M_i(\boldsymbol{\theta}))^2}{\sigma_i^2} + \ln(2\pi\sigma_i^2)\right],$$

although §5 shows that correlated noise — instrumental systematics and stellar variability — is the dominant failure mode of this assumption, motivating Gaussian-process likelihoods [5].

### 2.3 The retrieval ecosystem

The major open frameworks and their samplers are summarized below; all are free-parameter (as opposed to self-consistent) codes in which chemistry, temperature–pressure profiles, and aerosols are parameterized rather than solved from first principles.

| Framework | Sampler | Clouds/hazes | Notes |
|---|---|---|---|
| POSEIDON (MacDonald & Madhusudhan 2017) | MultiNest / dynesty | patchy grey cloud + power-law haze | Transmission + emission; stellar heterogeneity |
| NEMESIS (Irwin et al.; Barstow et al. 2017) | MultiNest | multi-modal cloud/haze | Optimal-estimation heritage; two-component aerosols |
| TauREx 3 (Al-Refaie et al. 2021) | MultiNest | Mie-scattering cloud models | Line-list driven; free + equilibrium chemistry |
| ARCiS (Min et al.) | MultiNest | parametric + physical clouds | Cloud formation self-consistency options |
| CHIMERA (Line et al.) | dynesty | grey cloud deck | Emission heritage; quench-chemistry kinetics |
| petitRADTRANS (Mollière et al.) | MultiNest / PyMultiNest | cloud species tables | Fast correlated-k; widely used for JWST |
| PICASO (Batalha et al. 2019) | dynesty | — | 1D climate + retrieval coupling for population studies [9] |

Free-parameter chemistry is the pragmatic choice for JWST-quality data: equilibrium-chemistry retrievals cannot capture the disequilibrium processes — photochemistry, vertical quenching — that dominate cool sub-Neptune atmospheres, and free retrievals consistently win on goodness of fit.

## 3 Methodology

### 3.1 Nested sampling: the engine

Nested sampling (Skilling 2004, 2006) reparameterizes the evidence integral in terms of the prior volume $X(\lambda) = \int_{\mathcal{L}(\boldsymbol{\theta})>\lambda} \pi(\boldsymbol{\theta})\,d\boldsymbol{\theta}$, yielding $\mathcal{Z} = \int_0^1 \mathcal{L}(X)\,dX$, evaluated by maintaining $N$ *live points* drawn from the prior, repeatedly discarding the lowest-likelihood point, and replacing it with a new prior sample subject to $\mathcal{L} > \mathcal{L}_{\rm min}$. The prior volume shrinks multiplicatively: each iteration compresses $X$ by a factor $t$ with $\mathbb{E}[\ln t] = -1/N$, so that after $i$ iterations $X_i \approx e^{-i/N}$. Termination occurs when the remaining live points can add at most a tolerance fraction $\Delta\ln\mathcal{Z}$ to the evidence.

> **Theorem:** *Nested-sampling shrinkage.* Let $X_i$ be the prior volume after $i$ replacements with $N$ live points. Then $\langle \ln(X_i/X_{i-1})\rangle = -1/N$ with variance $1/N^2$, independent of the likelihood's geometry — which is why nested sampling integrates multimodal posteriors that defeat MCMC walkers, at the cost of requiring exponentially many iterations, $\mathcal{O}(NH)$, to climb a likelihood whose information content (Kullback–Leibler divergence) is $H$ nats.

### 3.2 MultiNest versus dynesty

**MultiNest** (Feroz et al. 2009) implements nested sampling with *ellipsoidal* rejection sampling: the live points are clustered into a union of ellipsoids from which replacements are drawn. Its strengths are speed and multimodal mode separation, and it became the field's default through POSEIDON, NEMESIS, and TauREx [5][7]. Its weakness is evidence bias when live-point counts are inadequate for the dimensionality — shifts of several $\ln\mathcal{Z}$ units, enough to manufacture or erase a "detection" [5]. The modern prescription is 500–2000+ live points, evidence tolerance $\Delta\ln\mathcal{Z} \sim 0.1$–$0.5$, and convergence checks by doubling live points.

**dynesty** (Speagle 2020) is a more flexible, Python-native implementation offering multiple bounding (single ellipsoid, multiple ellipsoids, overlapping balls/cubes) and sampling (uniform, random walk, slice, Hamiltonian slice) strategies, plus **dynamic nested sampling**: live points are reallocated to regions of high posterior mass after an initial pass, so posterior accuracy — not just evidence — drives the budget. dynesty underpins CHIMERA and the PICASO population retrievals that inferred C/O trends across sub-Neptunes from simulated JWST data [9].

A minimal dynesty retrieval loop looks like this:

```python
import dynesty
from dynesty import utils as dyfunc

def loglike(theta):
    # theta: [log_X1, ..., log_Xk, T_iso, log_Pcloud, Rp_ref, ...]
    spectrum = forward_model(theta)          # radiative transfer
    resid = (data - spectrum) / sigma        # Gaussian likelihood
    return -0.5 * np.sum(resid**2 + np.log(2*np.pi*sigma**2))

def ptform(u):
    # prior transform: unit cube -> physical priors
    return prior_bounds[:, 0] + u * (prior_bounds[:, 1] - prior_bounds[:, 0])

sampler = dynesty.DynamicNestedSampler(loglike, ptform, ndim=NDIM,
                                       bound='multi', sample='rwalk')
sampler.run_nested(nlive_init=1000, dlogz=0.1)
res = sampler.results
samples, weights = res.samples, np.exp(res.logwt - res.logz[-1])
# evidence: res.logz[-1] +- res.logzerr[-1]
```

### 3.3 Parameterizing clouds and hazes

Because microphysical cloud models carry dozens of uncertain parameters, retrievals use phenomenological parameterizations:

1. **Grey cloud deck**: a single parameter $P_c$, the cloud-top pressure, below which the atmosphere is opaque. The cheapest model and still the workhorse.
2. **Power-law haze**: extinction $\sigma(\lambda) = \sigma_0(\lambda/\lambda_0)^{-\gamma}$, with amplitude and scattering index $\gamma$; Rayleigh scattering is $\gamma = 4$, while retrieved indices up to $\gamma \sim 6$–$10$ ("super-Rayleigh") indicate small-particle hazes [7].
3. **Patchy clouds** (Line & Parmentier 2016): a cloud-cover fraction $\phi$ mixes a cloudy and a clear spectrum, $F = \phi F_{\rm cloudy} + (1-\phi)F_{\rm clear}$ — essential because 1D clear-or-cloudy models are demonstrably biased by terminator inhomogeneity [8].
4. **Two-component aerosols** (Barstow et al. 2017): a grey cloud plus a Rayleigh-like haze with independent top pressures, motivated by planets like WASP-31b whose spectra demand both a slope and a flat baseline.
5. **Microphysical hazes**: fractal aggregate particles with fractal dimension $D_f$ and monomer number $N$ (Ohno & Okuzumi 2019), which reproduce scattering slopes with physically plausible production rates where spherical-particle models fail [6].

Each parameterization is a hypothesis; comparing their evidences is how retrievals adjudicate aerosol physics — but only within the menu offered, which is itself a prior on model space.

---

## 4 Deep Dive

### 4.1 Nested sampling under degeneracy: why MCMC lost

The likelihood surfaces of transmission retrievals are pathological in ways that punish MCMC: the cloud-top pressure versus abundance degeneracy forms a curved valley spanning orders of magnitude, temperature and mean molecular weight trade off through the scale height, and multi-instrument datasets with inter-detector offsets create multimodal islands. MCMC walkers mix slowly across these structures and cannot compute the evidence needed for detection claims. Nested sampling's global live-point ensemble explores all modes simultaneously, and the evidence falls out of the same run — at the cost of $10^5$–$10^6$ forward evaluations per JWST retrieval, the dominant cost driver of the field.

### 4.2 Anatomy of the cloud–haze degeneracies

Four degeneracies dominate transmission retrieval, and JWST has broken — or relocated — each of them:

- **(i) Cloud-top pressure vs. molecular abundance.** Raising a grey deck mutes all features uniformly, exactly as lowering every absorber's mixing ratio would [8]. *Hubble*/WFC3 alone could not separate them; JWST's 3–5 μm coverage breaks it because cloud opacity is approximately grey while molecular bands have distinct shapes — a flat baseline across multiple bands can only be a cloud.
- **(ii) Mean molecular weight vs. clouds.** A high-$\mu$ atmosphere shrinks the scale height and mutes features, mimicking aerosols. The two are distinguished by the *relative* amplitudes of bands of different intrinsic strength: $\mu$ scales all features together, while a cloud deck clips them at a common altitude. Detecting multiple molecules (CH₄ + CO₂ + H₂O) over-constrains this trade-off.
- **(iii) Terminator temperature vs. haze slope.** A steep optical slope can be fit either by small-particle hazes (large $\gamma$) or by inflating the scale height with high temperature; for HD 189733b's super-Rayleigh slope ($\gamma \approx 6.4$), free temperature priors drive the retrieved terminator temperature to $\sim$2000 K unless an informative prior ($\lesssim$1300 K) is imposed [7]. Unconstrained priors let the retrieval "pay" for slopes with unphysical heat.
- **(iv) Patchy clouds vs. clear-with-haze.** Line & Parmentier (2016) showed that fitting a 1D model to a half-cloudy terminator biases abundances by an order of magnitude or more [8]. The patchy-cloud fraction $\phi$ is now standard, and its often broad, prior-dominated posterior honestly reports that the data cannot always distinguish partial cloudiness from haze.

> **Theorem:** *Degeneracy invariance.* For a transmission spectrum measured over a wavelength range where aerosol opacity $\sigma_{\rm aer}(\lambda)$ is approximately constant, the transformation $\{P_c \to P_c',\, X_i \to X_i'\}$ with $X_i' = X_i \cdot (P_c/P_c')^{\alpha_i}$ (absorber-dependent $\alpha_i$ from the curve of growth) leaves $\delta(\lambda)$ invariant to first order — which is why single-band *Hubble* spectra admitted continuous families of solutions, and why multi-band JWST spectra were required to collapse them.

### 4.3 JWST NIRSpec results: the empirical landscape

JWST's NIRSpec grating modes — G140H/G235H/G395H spanning 0.6–5.3 μm — have delivered the first transmission spectra in which the 4.3 μm CO₂ band and the 3.3–3.5 μm CH₄ band are simultaneously resolved in temperate sub-Neptunes. The emerging population picture (Batalha et al.; Holmberg & Madhusudhan 2024) shows a striking diversity: TOI-270 d and K2-18 b exhibit strong CH₄ + CO₂, while GJ 1214 b remains stubbornly flat — the archetypal high-$\mu$ or high-cloud case that even JWST precision cannot crack without broader wavelength leverage [9][10].

K2-18 b is the campaign of record. The planet ($8.63 \pm 1.35\,M_\oplus$, $2.61 \pm 0.09\,R_\oplus$, $T_{\rm eq} \approx 280$ K) has now been observed with NIRISS SOSS, two visits each of NIRSpec G235H and G395H, and MIRI LRS [1]. Three independent retrieval frameworks converge on CH₄ and CO₂ mixing ratios constrained to $\sim$0.25 and $\sim$0.5 dex precision, robust to assumptions about stellar heterogeneity, clouds, and the P–T profile [1]. The two gases at these abundances admit two interior solutions — a massive H₂-rich envelope at $\sim$100$\times$ solar metallicity with 10–25% bulk water, or a thin atmosphere over a liquid-water ocean — either way, a water-rich interior [1]. Stringent upper limits were placed on H₂O, NH₃, HCN, and CO, though alternative visually acceptable solutions with higher abundances of some species exist at the cost of nonstandard detector offsets [1].

Stellar contamination — the transit light source effect from unocculted spots and faculae — was explicitly tested and found not to drive the composition inferences at current precision, though its stochastic nature means continued NIRISS SOSS monitoring is warranted rather than stacking long-wavelength data alone [10].

### 4.4 Biosignature false positives and the K2-18 b DMS debate

The April 2025 claim of dimethyl sulfide and/or dimethyl disulfide (DMS/DMDS) in K2-18 b's MIRI LRS spectrum at $\sim$3$\sigma$ significance, with abundances $\gtrsim$10 ppmv, was reported as possible evidence of biological activity on a candidate hycean world [11]. The ensuing debate is a masterclass in biosignature false positives — not all of them chemical:

1. **Signal authenticity.** Independent re-reductions show the MIRI spectrum is exquisitely sensitive to wavelength binning: 87.5% of retrievals under an alternative preferred binning find no DMS/DMDS, and the mid-IR features are in tension with the smaller, more robust near-IR features — consistent with red noise, not an astrophysical signal [2].
2. **Molecular confusion.** Systematic searches over dozens of hydrocarbons find several species (e.g., C₂H₄) produce evidence comparable to DMS/DMDS in the MIRI bandpass; the retrieval cannot distinguish DMS from C₂H₄ at current SNR [2][4]. A detection of *a* feature is not a detection of *the* molecule.
3. **Abiotic production.** DMS has now been detected in abiotic cometary matter, and photochemical pathways (H₂S + CH₄ chemistry) can generate it abiotically in H₂-rich atmospheres [3]. If DMS is present, biology is not the only — or the most parsimonious — source.
4. **Photochemical consistency.** The claimed DMS abundances would require enormous surface fluxes ($\sim$20$\times$ modern Earth's), while the absence of expected byproducts such as ethane (C₂H₆) — which biology-scale DMS production should co-produce — argues against the biogenic interpretation [2].
5. **The standards-of-evidence framework.** The community response has crystallized into a five-question assessment (Catling et al. 2018; Green et al.): *Have we detected an authentic signal? Have we correctly identified it? Are there abiotic sources? Is it consistent with the planetary context? Have independent lines of evidence converged?* Applied uniformly, the framework concludes there is as yet no statistically significant evidence for biosignatures on K2-18 b [2].

The deeper lesson is methodological: retrieval evidences $\Delta\ln\mathcal{Z}$ for trace gases are fragile to choices the evidence cannot see — reduction pipeline, binning, noise model, and the molecular menu. Until those choices are marginalized, every biosignature claim is, at best, a claim about one analysis.

## 5 Empirical Results and Proofs

We now consolidate the quantitative results that the literature has established to a standard the field broadly accepts:

- **Nested sampling fidelity.** Controlled experiments show MultiNest evidence estimates can be biased by several $\ln\mathcal{Z}$ units when live-point counts are inadequate for the dimensionality — a bias large enough to flip molecule "detections" [5]. The recommended practice (1000+ live points, $\Delta\ln\mathcal{Z} = 0.1$–$0.5$ tolerance, doubling tests) is now standard in JWST analyses.
- **Gaussian-process noise models.** Replacing the diagonal Gaussian likelihood with a GP covariance kernel absorbs correlated systematics (detector persistence, stellar granulation) and demonstrably changes molecular detection significances; retrievals that ignore correlated noise overstate evidence by construction [5].
- **Aggregate hazes.** Fractal-aggregate haze models ($D_f \approx 2$, porous monomers) reproduce the scattering slopes of hazy transmission spectra with methane-limited production rates where spherical-particle models require unphysical mass fluxes [6].
- **K2-18 b composition.** CH₄ and CO₂ detected at $\gtrsim$3$\sigma$ across three retrieval frameworks and multiple datasets, at $\sim$0.25/0.5 dex precision; H₂O, NH₃, HCN, CO bounded above; a water-rich interior is required under either the massive-envelope or ocean-planet scenario [1].
- **K2-18 b DMS.** Claimed at $\sim$3$\sigma$ in MIRI LRS [11]; contested by independent reductions finding binning-dependent results, molecular confusion with C₂H₄, and tension with near-IR data [2][4]. Status: *unresolved, not a detection by community standards of evidence.*
- **Sub-Neptune diversity.** JWST NIRSpec 3–5 μm spectra span the full range from strong CH₄/CO₂ features (K2-18 b, TOI-270 d) to featureless (GJ 1214 b); no single aerosol or compositional template describes the population [9][10].

Formally, the "proof" a retrieval offers is a posterior, not a theorem: the chain is *data → likelihood → evidence → Bayes factor → posterior odds*, and every link is conditional on modeling choices.

## 6 Limitations

The honest limitations of transmission retrieval in 2026 are substantial, and they bound every claim in this thesis:

- **1D geometry.** Real terminators are 3D: morning/evening limbs differ in temperature and cloudiness, and 1D retrievals average them in ways that bias abundances by up to an order of magnitude [8]. Terminator-resolved retrievals exist but are computationally prohibitive for nested sampling at JWST precision.
- **Opacity fidelity.** Line lists remain incomplete at high temperature and for exotic species; the DMS debate exposed how poor laboratory cross-sections are for candidate biosignature gases in the mid-IR [11]. A retrieval can only find molecules whose opacity it knows.
- **Pressure–temperature parameterization.** Most retrievals use isothermal or few-parameter analytic P–T profiles; profile errors propagate directly into composition errors through the T–μ–cloud degeneracies.
- **Stellar heterogeneity.** The transit light source effect imprints wavelength-dependent slopes that mimic hazes; for active M dwarfs it can dominate the optical spectrum, and current corrections rely on spot models with unquantified uncertainties [10].
- **Sampler and model-selection fragility.** Evidence-based detections inherit sampler bias [5] and depend on the molecular menu offered — the DMS/C₂H₄ interchangeability [2] shows that "detection significance" is significance *within* a model family, not of a molecule.
- **No emission constraint.** Transmission probes $\sim$mbar–bar pressures at the terminator only; without emission or phase-curve data, the deep atmosphere and energy budget remain unconstrained, leaving interior scenarios degenerate [1].

## 7 Conclusion

Transmission-spectroscopy retrieval has completed its first scientific revolution: from *Hubble*'s muted, degeneracy-plagued spectra to JWST's multi-molecule constraints, with nested sampling — MultiNest and dynesty — providing the Bayesian machinery that made the inferences quantitative and the model comparisons honest. The cloud–haze degeneracies of the *Hubble* era have been substantially broken by broad wavelength coverage, only to be replaced by subtler ones: patchy versus uniform aerosols, temperature versus scattering slope, molecular identity versus molecular confusion. K2-18 b stands as both triumph and caution — a water-rich world with robustly measured CH₄ and CO₂, and a biosignature claim that dissolved, at least for now, into systematics, binning choices, and abiotic chemistry.

The path forward is clear in outline. **Methodologically**, retrievals must marginalize over — or at least standardize — data reduction, noise models, and molecular menus, and must graduate from 1D to terminator-resolved geometries. **Observationally**, the community needs repeated transits to beat down systematics, broader wavelength baselines to separate aerosols from composition, and high-resolution ground-based spectroscopy for independent molecular confirmation. **Astrobiologically**, the standards-of-evidence framework must be applied *before* press releases: authentic signal, correct identification, abiotic null hypotheses, planetary context, and independent convergence — in that order.

> The central thesis of this thesis, then, is a statistical one: *the limiting reagent in exoplanet atmosphere retrieval is no longer photons but assumptions* — and the science advances exactly as fast as we learn to quantify, compare, and discard them.

---

## References

[1] Hu, R., Bello-Arufe, A., Tokadjian, A., et al. "A Water-Rich Interior in the Temperate Sub-Neptune K2-18 b Revealed by JWST." *arXiv*, 2025. https://arxiv.org/pdf/2507.12622

[2] Sotzen, I. A., Tsai, S.-M., et al. "K2-18b Does Not Meet The Standards of Evidence For Life." *arXiv*, 2025. https://arxiv.org/pdf/2508.05961

[3] "Evidence for Abiotic Dimethyl Sulfide in Cometary Matter." *arXiv*, 2024. https://arxiv.org/html/2410.08724v1

[4] "A Systematic Search for Trace Molecules in Exoplanet K2-18 b." *arXiv*, 2025. https://arxiv.org/html/2505.10539v1

[5] "Enabling Robust Exoplanet Atmospheric Retrievals with Gaussian Processes." *arXiv*, 2025. https://arxiv.org/pdf/2503.21702

[6] Ohno, K. & Okuzumi, S. "Aggregate Hazes and Their Optical Properties." *arXiv*, 2019. https://arxiv.org/pdf/1902.05231

[7] Barstow, J. K., et al. "A Consistent Retrieval Analysis of 10 Hot Jupiters Observed in Transmission." *arXiv*, 2016. http://arxiv.org/pdf/1610.01841

[8] Line, M. R. & Parmentier, V. "Inhomogeneous Cloud Cover and the Retrieval of Exoplanet Atmospheres." *arXiv*, 2018. http://arxiv.org/pdf/1810.04175

[9] Batalha, N. E., et al. "PICASO Coupled with dynesty: Retrieving C/O Trends for Sub-Neptunes with JWST NIRSpec G395H." *arXiv*, 2022. http://arxiv.org/pdf/2211.00702

[10] "Disentangling Atmospheric Compositions of K2-18 b with Next Generation Facilities." *PMC*, 2022. https://pmc.ncbi.nlm.nih.gov/articles/PMC9166872/

[11] Madhusudhan, N., Constantinou, S., Holmberg, M., et al. "New Constraints On DMS and DMDS In The Atmosphere Of K2-18 b From JWST MIRI." *ApJL*, 2025. https://arxiv.org/abs/2504.12267
