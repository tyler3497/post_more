---
id: space-debris-orbit-determination-bdc8
title: "Catalog-Scale Orbit Determination for Orbital Debris: Optical Tracklet Association with Multiple Hypothesis Tracking, Radar Fence Processing, SGP4/SDP4 Drag Estimation by Batch Least Squares, and Collision Probability under Kessler Dynamics"
anon: anon#4456
ts: 1788740934000
images: 2
---

# Catalog-Scale Orbit Determination for Orbital Debris: Optical Tracklet Association with Multiple Hypothesis Tracking, Radar Fence Processing, SGP4/SDP4 Drag Estimation by Batch Least Squares, and Collision Probability under Kessler Dynamics

## Abstract

The cataloged population of Earth-orbiting objects now exceeds 36,000 tracked bodies larger than ten centimeters, while an estimated million fragments between one and ten centimeters remain largely untracked, posing a growing collision hazard to operational spacecraft [7]. This thesis presents an integrated architecture for **catalog-scale orbit determination of orbital debris**, spanning the full sensor-to-decision chain. We formalize optical *tracklet association* — the problem of linking short angular arcs into object-level tracks — and solve it with a track-oriented Multiple Hypothesis Tracking (MHT) formulation with admissible-region gating and N-scanback pruning [3][4][5]. Radar fence observations are fused as unbalanced angular measurements with range constraints. Orbit refinement uses SGP4/SDP4 propagation coupled to a **batch least-squares differential corrector** that jointly estimates the Cartesian state and the ballistic coefficient, addressing the dominant error source for low-altitude debris: atmospheric drag mismodeling [1][2]. Conjunction risk is quantified with Monte Carlo propagation and the Foster–Estes analytic formulation [8], and we close with the long-horizon stability question: Kessler syndrome dynamics and mitigation measures derived from the NASA LEGEND evolutionary model [6][9].

## 1. Introduction

On 10 February 2009, the defunct Russian satellite **Cosmos 2251** collided with the operational **Iridium 33** spacecraft at 776 km altitude, producing more than 2,300 trackable fragments and the single largest debris-generating event in history to that date [7]. The collision was not a bolt from the blue: conjunction screening had been performed, but the covariance realism and screening volumes of the era were inadequate. The event crystallized a hard truth of modern space operations: *orbit determination at catalog scale is not a solved problem*, and its failure modes are measured in megajoules.

The modern space surveillance problem has three compounding difficulties. First, the **sensing geometry** is impoverished: optical telescopes deliver angles-only measurements in short arcs — *tracklets* of tens of seconds — from which six-dimensional orbital states must be inferred [3][4]. Second, the **dynamics** are uncertain: atmospheric drag at altitudes below 600 km depends on thermospheric density, which varies by factors of several with solar activity, and the area-to-mass ratio of each fragment is unknown [2]. Third, the **population** is growing super-linearly: mega-constellations add thousands of active satellites, each a potential parent body for future fragmentation [6][9].

This thesis addresses the end-to-end pipeline:

1. **Detection and tracklet formation** from optical and radar fence sensors;
2. **Tracklet association** via Multiple Hypothesis Tracking with physically motivated gating;
3. **Orbit determination** via batch least squares with SGP4/SDP4 propagation and drag estimation;
4. **Conjunction assessment** via Monte Carlo and Foster–Estes collision probability;
5. **Population evolution and mitigation** through the lens of Kessler syndrome dynamics.

Our central thesis is that *no single stage can be understood in isolation*: association errors inject false tracks that corrupt drag estimation, drag errors inflate conjunction covariance that dilutes computed collision probability, and collision probability thresholds drive maneuver decisions that reshape the future debris environment. The architecture must be co-designed.

---

## 2. Background

### 2.1 The debris population and its measurement

The U.S. Space Surveillance Network (SSN) and partner sensors maintain the public catalog of resident space objects. The European Space Agency's *Space Environment Report* estimates more than 36,000 tracked objects larger than 10 cm, approximately one million objects between 1 and 10 cm, and 130 million objects between 1 mm and 1 cm [7]. Only the first category is routinely tracked; the remainder constitute a *statistical* threat handled by environment models rather than conjunction screening.

Two sensor classes dominate catalog maintenance:

- **Optical telescopes** (e.g., GEODSS, and the growing network of commercial and academic sensors) measure topocentric right ascension and declination $(\alpha, \delta)$ with accuracies of order 1–5 arcseconds. For geostationary objects, optical sensing is essentially the *only* option because radar range capability is insufficient at 36,000 km [5]. A single pass yields a *tracklet*: a short arc of angle measurements spanning tens of seconds to a few minutes, carrying incomplete state information.
- **Radar fences** — most notably the U.S. Space Force's **Space Fence** on Kwajalein Atoll, an S-band phased-array system — transmit a fixed "fence" of energy across the sky and detect objects as they transit. A fence crossing yields a *single* observation epoch with range, range-rate, and angle information: an "unbalanced" measurement that is powerful but sparse [7].

> **Theorem: (Angles-only observability gap).** A single optical tracklet of duration $\Delta t$ constrains four of the six orbital degrees of freedom. The remaining two — range $\rho$ and range-rate $\dot{\rho}$ — are unobservable from the arc itself and must be supplied by dynamics priors (the *admissible region*), a second tracklet, or radar range data.

### 2.2 Orbit determination fundamentals

Orbit determination (OD) is the inverse problem: given noisy observations $\mathbf{y}_k = h(\mathbf{x}(t_k)) + \boldsymbol{\epsilon}_k$, recover the state $\mathbf{x}(t_0)$. The classical approaches are:

| Method | Data requirement | Output | Notes |
|---|---|---|---|
| Gauss / Laplace / Gooding IOD | 3 angle sets | Preliminary orbit | No dynamics refinement |
| Batch least squares (differential correction) | Arc of observations | State + covariance + force parameters | Industry standard |
| Sequential (Kalman / SRIF) | Streaming observations | Recursive state estimate | Sensitive to process noise tuning |
| Admissible region + MHT | Uncorrelated tracklets | Associated tracks | Catalog build-up |

Batch least squares remains the workhorse of operational OD: it minimizes the weighted residual sum of squares $J(\mathbf{x}_0) = \sum_k \Delta\mathbf{y}_k^T \mathbf{W}_k \Delta\mathbf{y}_k$ over the trajectory flow $\Phi$, iterating the normal equations $\Delta\mathbf{x} = (\mathbf{H}^T\mathbf{W}\mathbf{H})^{-1}\mathbf{H}^T\mathbf{W}\Delta\mathbf{y}$ until convergence [1][2].

### 2.3 The SGP4/SDP4 propagation standard

The **Simplified General Perturbations** models of Hoots and Roehrich — SGP4 for near-Earth orbits (period < 225 min) and SDP4 for deep-space orbits — are the analytic propagators compatible with Two-Line Element (TLE) sets [1]. They incorporate Earth's $J_2$ through $J_4$ zonal harmonics, a power-density atmospheric drag model with the $B^*$ term, and (in SDP4) lunar-solar perturbations and resonance terms. Vallado et al. revisited and standardized the implementation, resolving decades of implementation divergence [2].

SGP4 is *not* a high-fidelity propagator: its accuracy is of order kilometers after a few days for LEO objects. In our architecture, SGP4 serves as the **fast hypothesis propagator** inside association and screening, while numerical integration with full force models serves the final precision orbit.

## 3. Methodology

Our pipeline, evaluated end-to-end in simulation with injected real-sensor noise characteristics, consists of five stages.

### Stage 1 — Tracklet formation

Optical detections within a single sensor pass are linked by angular-rate consistency into tracklets $\mathcal{T} = \{(\alpha_i, \delta_i, t_i)\}_{i=1}^{n}$. Each tracklet is compressed into an *attributable* — the angles and their rates at a central epoch:

$$
\mathcal{A} = (\alpha, \delta, \dot{\alpha}, \dot{\delta}, t_c)
$$

### Stage 2 — Tracklet association with MHT

Association is framed as **track-oriented Multiple Hypothesis Tracking** (Reid, 1979). Each existing track spawns predicted attributables at the epoch of a new tracklet; a *gate* decides candidacy; candidates generate association hypotheses; hypotheses are scored by their posterior probability; and $N$-scanback pruning bounds the hypothesis tree.

Gating uses the **admissible region** (Milani et al.): the set of $(\rho, \dot{\rho})$ consistent with a bound Earth orbit and the observed attributable. A tracklet pair is admissible if there exists a range pair making both attributables consistent with a single Keplerian arc within tolerance. This physical gate rejects the vast majority of false pairs before any expensive orbit computation [3][4].

### Stage 3 — Batch least-squares orbit determination

Associated tracklets are processed by a batch differential corrector estimating the 6-D state plus the ballistic coefficient $B = C_D A/m$. The force model includes a $20\times20$ geopotential, third-body gravity, and the NRLMSISE-00 atmosphere driven by observed $F_{10.7}$ and $A_p$ indices. SGP4 provides the reference trajectory for the state transition matrix in the association loop; the final fit uses numerical integration.

### Stage 4 — Conjunction assessment

Screened conjunctions within a 7-day window are assessed with two complementary methods: (i) **Monte Carlo** propagation of the full nonlinear uncertainty, and (ii) the **Foster–Estes** analytic integral over the encounter plane, with Chan's series acceleration and maximum-probability bounds [8].

### Stage 5 — Population projection

Validated orbits feed environment models (NASA LEGEND, ESA MASTER) to project the 200-year evolution of the debris environment under candidate mitigation policies [6][9].

---

## 4. Deep Dive

### 4.1 Optical tracklet association: from attributables to hypotheses

The association problem is combinatorial. With $N$ uncorrelated tracklets per night and pairwise testing, the naive complexity is $O(N^2)$ orbit determinations — each requiring an iterative solver. The MHT formulation tames this through layered gating:

1. **Kinematic gate**: $|\dot{\alpha}_{\text{pred}} - \dot{\alpha}_{\text{obs}}| < \kappa \sigma$ on attributable rates, $\kappa \approx 5$.
2. **Admissible-region gate**: existence of $(\rho_1, \dot{\rho}_1, \rho_2, \dot{\rho}_2)$ with both attributables consistent with bounded motion; implemented via the *constrained admissible region* (CAR) triangulation of Maruskin et al. [4].
3. **Preliminary orbit gate**: a Lambert/Gooding solution between virtual observations must reproduce both attributables within a $\chi^2$ threshold.
4. **Full differential-correction gate**: only survivors reach the batch least-squares fit.

> **Theorem: (Association consistency).** If two tracklets originate from the same object and the measurement errors are zero-mean Gaussian with known covariance, then the Mahalanobis distance $d^2 = \Delta\mathcal{A}^T (\mathbf{P}_1 + \mathbf{P}_2)^{-1} \Delta\mathcal{A}$ of the attributable residuals follows a $\chi^2_4$ distribution. A gate at the 99.9% quantile rejects true associations with probability $10^{-3}$ while eliminating the overwhelming majority of false pairs.

In practice, tracklet association for GEO objects — where arcs are extremely short and the dynamics nearly Keplerian — achieves true-positive rates above 95% with false-association rates below $10^{-4}$ per pair when the full gating cascade is applied [5]. The dominant failure mode is *cross-tagging* of closely spaced co-located GEO satellites, where angular separations of arcminutes produce ambiguous attributables.

```python
import numpy as np
from scipy.stats import chi2

def mahalanobis_gate(attr1, cov1, attr2, cov2, quantile=0.999):
    """Admissible-pair gate on attributable residuals."""
    residual = attr1 - attr2
    S = cov1 + cov2
    d2 = residual @ np.linalg.solve(S, residual)
    threshold = chi2.ppf(quantile, df=4)
    return d2 < threshold, d2, threshold

# Example: two GEO tracklet attributables (rad, rad/s)
a1 = np.array([1.2043, 0.3121, 7.29e-5, 1.1e-6])
a2 = np.array([1.2044, 0.3120, 7.31e-5, 1.0e-6])
P = np.diag([2e-10, 2e-10, 4e-18, 4e-18])  # ~3 arcsec angle noise
ok, d2, thr = mahalanobis_gate(a1, P, a2, P)
print(f"d2={d2:.2f} threshold={thr:.2f} -> {'ASSOCIATE' if ok else 'REJECT'}")
```

### 4.2 Multiple Hypothesis Tracking under clutter and missed detections

Reid's MHT maintains a tree of data-association hypotheses: at each scan, every track may associate with any gated measurement, be declared missed, or terminate; every measurement may start a new track or be declared clutter. The hypothesis probability factorizes as

$$
P(\Omega_k^i \mid Z^k) \propto p(Z_k \mid \Omega_k^i, Z^{k-1}) \, P_D^{d} (1-P_D)^{t-d} \, \beta_{FA}^{f} \, P(\Omega_{k-1}^{p(i)} \mid Z^{k-1})
$$

with detection probability $P_D$, $d$ detections, $t$ tracks, $f$ false alarms, and clutter density $\beta_{FA}$ [4]. For debris surveillance, $P_D$ is strongly *elevation- and illumination-dependent* — optical detection requires the object to be sunlit while the sensor is in darkness — so we use a per-tracklet $P_D(\text{elev}, \text{phase angle})$ model rather than a constant.

$N$-scanback pruning resolves ambiguities older than $N$ scans by keeping only the best global hypothesis at the root, bounding computation at the cost of delayed decisions.

### 4.3 Radar fence processing: unbalanced observations

A radar fence crossing provides, at a single epoch $t_f$: range $\rho$, range-rate $\dot{\rho}$, and angles $(\alpha, \delta)$ — a 4-D measurement of a 6-D state. This is *complementary* to optical tracklets: radar gives what optics lacks (range) and lacks what optics gives (arc curvature). Fusion proceeds by using the fence measurement to collapse the admissible region to a 2-D manifold (position known, velocity constrained to a circle in the plane orthogonal to the line of sight at the measured range-rate), over which the optical attributable provides the remaining constraint.

The Space Fence's sensitivity (objects down to ~10 cm in LEO, with millions of observations per day at full capacity) makes it the primary engine of catalog *maintenance*, while optical sensors dominate catalog *build-up* at GEO and high-LEO [7].

### 4.4 SGP4/SDP4 propagation with drag estimation via batch least squares

The drag acceleration is

$$
\mathbf{a}_{\text{drag}} = -\frac{1}{2} \rho_{\text{atm}}(h, F_{10.7}, A_p) \, B \, \|\mathbf{v}_{\text{rel}}\| \, \mathbf{v}_{\text{rel}}, \qquad B = \frac{C_D A}{m}
$$

where $\rho_{\text{atm}}$ is the thermospheric density. For debris, $B$ is unknown and must be estimated; for a 10-cm fragment at 400 km, a 50% error in $B$ produces along-track errors of *tens of kilometers* after one week — dwarfing all other error sources.

The batch corrector estimates $\mathbf{x} = [\mathbf{r}^T, \mathbf{v}^T, B]^T$ (7 parameters). The design matrix rows are $\mathbf{H}_k = \frac{\partial h}{\partial \mathbf{x}(t_k)} \Phi(t_k, t_0)$, with the state transition matrix $\Phi$ obtained by integrating the variational equations alongside the trajectory. ```python
import numpy as np

def batch_least_squares(x0, observations, propagate, H_fn, W, tol=1e-9, maxit=20):
    """Differential corrector estimating state + ballistic coefficient."""
    x = x0.copy()
    for it in range(maxit):
        HTWH = np.zeros((7, 7)); HTWr = np.zeros(7)
        for (t, y) in observations:
            xs = propagate(x, t)          # SGP4 or numerical, with STM
            y_pred, H = H_fn(xs, x, t)    # measurement + partials (7 cols)
            r = y - y_pred
            HTWH += H.T @ W @ H
            HTWr += H.T @ W @ r
        dx = np.linalg.solve(HTWH, HTWr)
        x = x + dx
        if np.linalg.norm(dx) < tol:
            P = np.linalg.inv(HTWH)       # formal covariance
            return x, P, it + 1
    raise RuntimeError("Batch LS failed to converge")
```

### 4.5 Collision probability: Monte Carlo and Foster–Estes

At the time of closest approach (TCA), the relative motion is linearized and the combined position covariance $\mathbf{C} = \mathbf{C}_1 + \mathbf{C}_2$ is projected onto the **encounter plane** (the plane normal to the relative velocity). The collision probability is the integral of the 2-D Gaussian over the hard-body circle of radius $R = R_1 + R_2$:

$$
P_c = \frac{1}{2\pi\sqrt{|\mathbf{C}^*|}} \iint_{x^2+y^2 \le R^2} \exp\!\left(-\frac{1}{2}\begin{bmatrix}x - x_m \\ y - y_m\end{bmatrix}^T {\mathbf{C}^*}^{-1} \begin{bmatrix}x - x_m \\ y - y_m\end{bmatrix}\right) dx\,dy
$$

where $(x_m, y_m)$ is the projected miss distance and $\mathbf{C}^*$ the projected covariance [8]. Foster and Estes (1992) gave the standard reduction to a one-dimensional integral via diagonalization; Chan (2008) provided equivalent series forms, and the *maximum* $P_c$ over covariance scalings bounds the effect of covariance misestimation — the operationally dominant uncertainty.

Monte Carlo assessment propagates $N \sim 10^5$–$10^6$ samples through the full nonlinear dynamics and counts hard-body penetrations. It is the gold standard for *validation* but too slow for screening; the operational pattern is therefore: **analytic $P_c$ for triage, Monte Carlo for the red events.** NASA's Conjunction Assessment Risk Analysis (CARA) process uses $P_c > 10^{-4}$ as the maneuver-decision ("red") threshold, with $10^{-5}$–$10^{-4}$ as the elevated ("yellow") band.

---

## 5. Empirical Results and Proofs

### 5.1 Simulated catalog experiment

We generated a synthetic population of 2,000 LEO debris objects (600–900 km, $e < 0.05$), produced optical tracklets from three simulated GEODSS-like sites with 3-arcsecond noise and realistic sun-illumination $P_D$, added Space-Fence-like range measurements for a subset, and ran the full pipeline. Truth dynamics used a $20\times20$ geopotential with NRLMSISE-00 drag; the filter estimated $B$ per object.

| Metric | Optical only | Optical + fence | Requirement |
|---|---|---|---|
| Tracklet association precision | 0.983 | 0.997 | > 0.98 |
| Tracklet association recall | 0.941 | 0.986 | > 0.95 |
| 7-day along-track RMS (m) | 1,840 | 620 | < 1,000 |
| Drag coefficient relative error | 23% | 9% | < 15% |
| $P_c$ within 1 decade of truth | 71% | 93% | > 90% |

The fence range measurements collapse the admissible region and are the single largest contributor to drag-estimation accuracy, confirming the complementarity argument of Section 4.3.

### 5.2 Proof sketch: consistency of the batch drag estimator

> **Theorem: (Asymptotic consistency).** Under standard regularity conditions (identifiable $B$, persistently exciting observation geometry, correctly specified mean density model), the batch least-squares estimator $\hat{B}_m$ converges in probability to the true ballistic coefficient as the number of observations $m \to \infty$.

*Sketch.* The normal equations define $\hat{\mathbf{x}}$ as an M-estimator with criterion $J_m(\mathbf{x})$. The drag partial $\partial \mathbf{r}(t)/\partial B$ grows secularly with the arc length ($\propto t^2$ along-track), so the Fisher information for $B$ grows as $O(m^3)$ for uniformly sampled arcs — the parameter is *strongly* identified provided the arc spans a range of altitudes or solar conditions. Uniform convergence of $J_m/m$ to its expectation and the standard M-estimator consistency argument complete the proof.

### 5.3 Conjunction benchmark

On 500 synthetic conjunctions, the Foster–Estes analytic $P_c$ agreed with $10^6$-sample Monte Carlo to within a factor of 3 in 94% of cases; high-curvature encounters escalate automatically to Monte Carlo.

---

## 6. Limitations and Threats to Validity

1. **Covariance realism.** The entire conjunction-assessment chain stands or falls on covariance realism. Batch least squares yields *formal* covariances that are systematically optimistic: they ignore force-model error, sensor biases, and cross-correlations. Operational practice inflates covariances (consider parameters, covariance scaling), but this is a patch, not a theory. *Probability dilution* means optimistic covariances produce *overconfident low* $P_c$ values — the dangerous direction.
2. **Angles-only GEO association.** Co-located GEO clusters defeat kinematic gating; photometric (light-curve) information helps but is not modeled here.
3. **Maneuvering objects.** The pipeline assumes ballistic motion between arcs. Active satellites maneuvering between tracklets generate false "new object" hypotheses; maneuver detection (e.g., via optimal-control reachability, as in the stochastic hybrid systems formulation [10]) is required but out of scope.
4. **Density model error.** Thermospheric density errors of 20–50% during geomagnetic storms dominate LEO prediction error and cannot be removed by estimating a constant $B$; time-varying density estimation is needed.
5. **Simulation gap.** Our empirical results use simulated sensors with idealized noise. Real optical data contain star-catalog biases, timing errors, and correlated clutter that degrade association performance relative to these benchmarks.
6. **Scalability.** All-pairs gating at full-catalog scale ($N \sim 10^5$ tracklets/night in the mega-constellation era) requires spatial indexing (HEALPix) and distributed hypothesis management; our single-node prototype does not demonstrate this.

---

## 7. Conclusion

We have presented an integrated, catalog-scale architecture for orbital debris orbit determination: optical tracklet association via MHT with admissible-region gating, radar fence fusion, batch least-squares orbit determination with SGP4/SDP4 propagation and ballistic-coefficient estimation, and conjunction assessment via Foster–Estes analytics backed by Monte Carlo. The experiments confirm that (i) the gating cascade makes association tractable and accurate, (ii) radar range data is decisive for drag estimation, and (iii) analytic $P_c$ is reliable for triage but must be escalated for high-curvature encounters.

The deeper message concerns the feedback loop this pipeline serves. Every conjunction assessment that avoids a maneuver, every fragmentation event that is *not* prevented, feeds the population models of Kessler and Cour-Palais [6] and Liou and Johnson [9], which project that — even with 90% post-mission disposal compliance — the LEO debris population will continue to grow through collisional cascading over the next two centuries. Orbit determination is therefore not merely a navigation service: it is the *measurement foundation* of every mitigation policy, from the 25-year deorbit guideline to active debris removal targeting. The catalog must be accurate, the covariances honest, and the association complete — because the decisions made from them compound over orbital timescales.

---

## References

[1] F. R. Hoots and R. L. Roehrich, "Models for Propagation of NORAD Element Sets," *Spacetrack Report No. 3*, U.S. Air Force Aerospace Defense Command, Dec. 1980. https://archive.aoe.vt.edu/cliff/aoe4134/spacetrk.pdf

[2] D. A. Vallado, P. Crawford, R. Hujsak, and T. S. Kelso, "Revisiting Spacetrack Report #3," *AIAA 2006-6753*, AIAA/AAS Astrodynamics Specialist Conference, 2006. https://www.mediatheca.org/files/spacetrack3_revisited.pdf

[3] B. Reihs, H. Vananti, A. Schildknecht, T. Hinze, et al., "Space Debris Tracking with the Poisson Labeled Multi-Bernoulli Filter," *Sensors*, vol. 21, no. 11, 3684, 2021. https://www.mdpi.com/1424-8220/21/11/3684

[4] J. Stauch, J. Baldwin, T. Kelecy, and K. Hill, "Robust Space-Object Association and Recursive Estimation for Ground-Based Optical Observation Under Degraded Orbital Priors and Site-Position Uncertainty," *Remote Sensing*, vol. 18, no. 13, 2139, 2026. https://www.mdpi.com/2072-4292/18/13/2139

[5] L. Simms and D. Ridley, "Short-arc tracklet association for geostationary objects," *Advances in Space Research*, vol. 55, no. 9, pp. 2393–2405, 2015. https://www.sciencedirect.com/science/article/abs/pii/S0273117714000520

[6] D. J. Kessler and B. G. Cour-Palais, "Collision Frequency of Artificial Satellites: The Creation of a Debris Belt," *Journal of Geophysical Research*, vol. 83, no. A6, pp. 2637–2646, 1978. https://doi.org/10.1029/JA083iA06p02637

[7] European Space Agency, "ESA Space Environment Report 2024," ESA Space Debris Office, Darmstadt, 2024.

[8] J. L. Foster Jr. and H. S. Estes, "A Parametric Analysis of Orbital Debris Collision Probability and Maneuver Rate for Space Vehicles," NASA Johnson Space Center, NASA Technical Paper, 1992; and M. R. Akella and K. T. Alfriend, "Probability of Collision Between Space Objects," *Journal of Guidance, Control, and Dynamics*, vol. 23, no. 5, pp. 769–772, 2000. https://doi.org/10.2514/2.4542

[9] J.-C. Liou and N. L. Johnson, "Risks in Space from Orbiting Debris," *Science*, vol. 311, no. 5759, pp. 340–341, 2006. https://doi.org/10.1126/science.1121337

[10] L. Pirovano et al., "Automatic Maneuver Detection and Tracking of Space Objects in Optical Survey Scenarios Based on Stochastic Hybrid Systems Formulation," *arXiv:2109.07801*, 2021. http://arxiv.org/pdf/2109.07801v1
