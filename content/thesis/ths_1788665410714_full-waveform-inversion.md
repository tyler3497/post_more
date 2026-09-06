---
title: "Full-Waveform Inversion in Exploration Seismology: Adjoint-State Gradients, Multiscale Strategies, and GPU-Accelerated Elastic Inversion"
type: thesis
anon: "anon#5907"
ts: 1788665410714
id: ths_1788665410714_full-waveform-inversion
---

Full-waveform inversion (FWI) is the preeminent technique for constructing high-resolution quantitative models of the Earth's subsurface from seismic data. Formulated as a PDE-constrained nonlinear optimization problem, FWI seeks the subsurface parameter field that minimizes the misfit between observed and simulated wavefields, subject to the full two-way wave equation. This thesis develops the mathematical and computational foundations of FWI in a unified treatment. We derive the adjoint-state method, which delivers the exact gradient of the misfit functional at the cost of one forward and one adjoint simulation, and we analyze the cycle-skipping pathology that renders the objective non-convex when the initial model errs by more than half a wave cycle. We present multiscale frequency-continuation strategies that convexify the problem by inversion from low to high frequencies, derive the radiation-pattern physics distinguishing acoustic, elastic, and anisotropic parameter classes, and compare Hessian approximations including L-BFGS and Gauss-Newton. Finally, we document GPU-accelerated implementations that reduced three-dimensional elastic FWI from a prohibitive computation to a routine industrial workflow, and assess the limitations defining the current research frontier.

# Full-Waveform Inversion in Exploration Seismology: Adjoint-State Gradients, Multiscale Strategies, and GPU-Accelerated Elastic Inversion

## Abstract

Full-waveform inversion (FWI) is the preeminent technique for constructing high-resolution quantitative models of the Earth's subsurface from seismic data. Formulated as a PDE-constrained nonlinear optimization problem, FWI seeks the subsurface parameter field that minimizes the misfit between observed and simulated wavefields, subject to the full two-way wave equation. This thesis develops the mathematical and computational foundations of FWI in a unified treatment. We derive the adjoint-state method, which delivers the exact gradient of the misfit functional at the cost of one forward and one adjoint simulation, and we analyze the cycle-skipping pathology that renders the objective non-convex when the initial model errs by more than half a wave cycle. We present multiscale frequency-continuation strategies that convexify the problem by inversion from low to high frequencies, derive the radiation-pattern physics distinguishing acoustic, elastic, and anisotropic parameter classes, and compare Hessian approximations including L-BFGS and Gauss-Newton. Finally, we document GPU-accelerated implementations that reduced three-dimensional elastic FWI from a prohibitive computation to a routine industrial workflow, and assess the limitations defining the current research frontier.

## 1. Introduction

Seismic imaging seeks to reconstruct the spatial distribution of elastic properties beneath the Earth's surface from waveforms recorded at receivers. For much of the twentieth century, seismic imaging relied on *traveltime tomography* and *reflection migration*: methods exploiting only selected, asymptotic properties of the wavefield while discarding most of the information in the full seismogram. Full-waveform inversion departs radically from this philosophy. Rather than extracting sparse attributes, FWI uses the *entire recorded waveform*, fitting it by iteratively solving the governing PDE and updating the model to reduce the misfit. As Virieux and Operto observed in their landmark 2009 overview, this makes FWI sensitive to the *intermediate wavelengths* of the subsurface — between the smooth background of tomography and the sharp discontinuities of migration — that classical methods systematically miss [1].

The conceptual origin of FWI lies in Tarantola's inverse problem theory. In 1984 he formulated inversion of seismic reflection data in the acoustic approximation as a generalized least-squares problem and showed how Fréchet derivatives could be obtained through the "adjoint state" borrowed from optimal control [2]. With Lailly (1983), who recast reverse-time migration as the gradient of a waveform misfit, this established the skeleton of modern FWI: forward simulation, adjoint simulation driven by residuals, and their cross-correlation as the gradient.

Three difficulties make FWI one of the most demanding inverse problems in applied science. First, the misfit is profoundly *non-convex*: wavefields are oscillatory, so phase-delayed data produce numerous local minima, and gradient descent from a poor model converges to the nearest one — the celebrated *cycle-skipping* pathology. Second, the problem is *ill-posed* and massively underdetermined: billions of parameters constrained by sparse surface data demand regularization. Third, the cost is staggering: each iteration solves the wave equation in 3D for thousands of sources. Four decades of research are a sustained assault on exactly these problems — non-convexity through multiscale continuation [3][4], ill-posedness through regularization and multiparameter hierarchies, and cost through GPU acceleration [7].

This thesis treats these advances systematically. Section 2 reviews the historical development from migration to waveform inversion. Section 3 derives the forward and inverse formulations with full mathematical rigor. Section 4 provides the deep technical core: the adjoint-state method, cycle-skipping and multiscale continuation, elastic and anisotropic formulations, and Hessian-approximation strategies. Section 5 analyzes empirical performance on canonical benchmarks and the GPU implementations that made 3D inversion feasible. Section 6 catalogs the limitations and open problems, and Section 7 concludes.

---

## 2. Background and Related Work

### 2.1 From migration to waveform inversion

Seismic migration is conventionally understood as an *imaging* operation: given an estimate of the background velocity (the macromodel), recorded reflections are extrapolated backward in time so that diffractors focus at their true positions. Lailly's 1983 insight was that this operation is *mathematically identical* to one step of gradient descent on a waveform misfit functional evaluated in the background model [1]: at zero iterations the residual is the data itself, and the "gradient" — the zero-lag cross-correlation of forward and back-propagated fields — is precisely the reverse-time-migrated image.

Tarantola (1984) generalized this to a complete inversion theory in the acoustic approximation [2]. Rather than stopping after one iteration, he posed the full nonlinear least-squares problem and showed that the adjoint-state method yields the gradient at the cost of two wave-equation solves *independent of the number of model parameters* — the crucial complexity result for grids containing millions to billions of unknowns. Gauthier, Virieux, and Tarantola then demonstrated 2D acoustic inversions of synthetic data, proving the concept tractable on mid-1980s hardware.

### 2.2 Frequency-domain and time-domain branches

Two parallel traditions matured through the 1990s and 2000s. Pratt and co-workers at Imperial College developed FWI in the *frequency domain*, solving the Helmholtz equation independently at a small number of discrete frequencies [4]. This drastically reduces the problem size relative to time-domain inversion, and the frequency axis provides a natural multiscale hierarchy. The Imperial group produced the first practical 2D acoustic FWI of synthetic and field data, and their 2004 frequency-selection strategy [4] became the template for industrial frequency-domain workflows.

The *time-domain* tradition, rooted in Tarantola's formulation, fits complete seismograms and handles arbitrary time-dependent physics more naturally, but at far higher cost. For years this made 3D time-domain FWI infeasible; the migration to massively parallel time-domain solvers culminated in the first FWI results from 3D field data in 2008 and commercial adoption thereafter.

### 2.3 Adjoint tomography in global seismology

In parallel, the global seismology community developed *adjoint tomography* — FWI under a different name. Tromp, Tape, and Liu (2005) showed how Fréchet kernels for the full-waveform inverse problem could be computed from a 3D starting model via the adjoint method with time reversal, unifying banana-doughnut finite-frequency kernels with iterative waveform fitting [5]. Their framework handles arbitrary misfit measures — cross-correlation traveltimes, phase delays, amplitude anomalies — through the appropriate *adjoint source*, showing adjoint-state machinery applies identically to regional and global tomography with earthquake sources and the spectral-element method.

### 2.4 Elastic and anisotropic inversion

The acoustic approximation — a scalar wave equation for pressure in a fluid — is adequate for marine data dominated by P-waves but omits shear waves, mode conversions, and anisotropy that dominate land data and ocean-bottom recordings. Time-domain elastic FWI was pioneered by Tarantola (1986) and Mora (1987–1988); the frequency-domain elastic formulation was advanced by Brossier, Operto, and Virieux, who demonstrated 2D elastic FWI of complex onshore structures including free-surface effects [6]. Warner et al. (2013) extended 3D FWI to anisotropic media, showing that tilt and anisotropy parameters could be recovered from field data when the acquisition geometry provided sufficient angular coverage [8]. Each extension multiplies the parameter classes (velocity, shear velocity, density, attenuation, anisotropy coefficients) and with it the nonlinearity, cross-talk, and ill-posedness — the multiparameter problem is the central theoretical challenge of modern FWI.

---

## 3. Methodology

### 3.1 The forward problem

The acoustic forward problem is governed by the variable-density wave equation; in exploration the density is often fixed and the single inverted parameter is the P-wave velocity, or squared slowness $m = 1/c^2$. The elastic forward problem replaces the scalar equation with the elastodynamic system for displacement with Lamé parameters $\lambda, \mu$.

### 3.2 The inverse problem as PDE-constrained optimization

Let $\mathbf{d}_{obs}$ denote observed data, $F(\mathbf{m})$ the forward modeling operator mapping model to synthetic data, and $C(\mathbf{m})$ the data misfit. The canonical FWI objective is the least-squares functional

$$J(\mathbf{m}) = \frac{1}{2} \left\lVert \mathbf{d}_{obs} - F(\mathbf{m}) \right\rVert_2^2 + R(\mathbf{m}),$$

where $R(\mathbf{m})$ is a regularization term (Tikhonov, total variation, or model-covariance penalties). The optimization is *PDE-constrained* because evaluating $F(\mathbf{m})$ requires solving the wave equation. Gradient-based local optimization (steepest descent, nonlinear conjugate gradient, L-BFGS) is the standard approach; the gradient must be computed without forming the Fréchet derivative matrix.

> **Definition:** The *Fréchet derivative* $DF(\mathbf{m})[\delta \mathbf{m}]$ is the linear operator giving the first-order change in synthetic data induced by a model perturbation $\delta \mathbf{m}$. Its adjoint $DF(\mathbf{m})^*$ maps data residuals back into model space and is the mathematical core of the gradient computation.

### 3.3 Gradient computation via the adjoint-state method

The adjoint-state method, introduced to seismic inversion by Tarantola [2] and Lailly, computes the gradient at the cost of *two* wave-equation solves per source regardless of parameter count:

1. **Forward simulation** with the source in the current model; store the forward wavefield $u(\mathbf{x}, t)$.
2. **Residual computation:** $\delta d = d_{obs} - d_{syn}$ at the receivers.
3. **Adjoint simulation:** solve the time-reversed adjoint equation injecting the residual as the *adjoint source*; this yields $u^\dagger(\mathbf{x}, t)$.
4. **Imaging condition:** the gradient is the zero-lag cross-correlation of the two wavefields.
$$\frac{\partial J}{\partial m}(\mathbf{x}) = - \int_0^T u^\dagger(\mathbf{x}, t) \, \frac{\partial^2 u}{\partial t^2}(\mathbf{x}, t) \, dt \quad \text{(acoustic, squared slowness)}.$$

The following Python sketch implements this loop for a 2D acoustic problem using an abstracted finite-difference propagator:

```python
import numpy as np

def fwi_gradient(model, sources, observed, nt, dt, dx):
    """Adjoint-state gradient for 2D acoustic FWI (squared-slowness parametrization)."""
    grad = np.zeros_like(model)
    for src, d_obs in zip(sources, observed):
        # 1. Forward simulation
        u_fwd = propagate(model, src, nt, dt, dx)          # shape (nt, nx, nz)
        d_syn = sample_receivers(u_fwd)                    # forward data
        # 2. Data residual becomes the adjoint source
        residual = d_obs - d_syn
        adj_src = inject_at_receivers(residual)            # time-reversed below
        # 3. Adjoint simulation (time-reversed PDE, same operator)
        u_adj = propagate(model, adj_src[::-1], nt, dt, dx)[::-1]
        # 4. Zero-lag cross-correlation imaging condition
        d2u = second_time_derivative(u_fwd, dt)
        grad += -np.sum(u_adj * d2u, axis=0) * dt
    return grad
```

The elegance of this scheme is its complexity: $O(N_{src})$ PDE solves per gradient evaluation, each comparable to a migration. No Fréchet matrix is ever formed; the adjoint wavefield implicitly applies the adjoint of the linearized forward operator to the residual.

### 3.4 Hessian approximations and optimization

The true Newton update solves $\mathbf{H} \, \delta \mathbf{m} = -\nabla J$ with the full Hessian. Forming $\mathbf{H}$ is impossible at scale, so FWI relies on approximations:

- **Steepest descent / nonlinear conjugate gradient (NLCG):** first-order methods using only the gradient; robust but slow, requiring many iterations.
- **L-BFGS:** a quasi-Newton method building an implicit inverse-Hessian approximation from recent gradient/model pairs. It corrects for geometrical spreading and illumination at negligible memory cost and is the workhorse of production FWI.
- **Gauss–Newton:** retains the $DF^* DF$ term while dropping the residual-dependent term. It improves convergence on strongly scattering media but requires solving a large linear system per iteration via conjugate gradients, each matrix-vector product costing two PDE solves.
- **Preconditioning:** diagonal Hessian approximations (e.g., the pseudo-Hessian, source-illumination compensation) rescale the gradient to balance deep and shallow updates and are nearly universal in practice [1].

---

## 4. Deep Dive

### 4.1 The Adjoint-State Method in Full Generality

The adjoint-state method is best understood through the Lagrangian formalism of PDE-constrained optimization. With state $u$ (the wavefield), model $m$, and adjoint state (Lagrange multiplier) $\lambda$,

$$\mathcal{L}(u, m, \lambda) = J(u, m) + \langle \lambda, \, \mathcal{P}(u, m) - s \rangle,$$

stationarity in $u$ yields the *adjoint equation* — the wave equation with time reversed, driven by the data residual; stationarity in $\lambda$ recovers the forward equation; and the derivative in $m$ then gives the gradient *without differentiating the forward solution with respect to the model* [2][5].

> **Theorem:** For the least-squares misfit and the acoustic wave equation, the gradient of the objective with respect to the model parameters equals the zero-lag cross-correlation of the forward wavefield and the adjoint wavefield, up to the imaging-condition weights dictated by the chosen parametrization. The computation requires exactly two wave-equation solves per source, independent of the number of model parameters.

Several subtleties deserve emphasis. First, the adjoint source depends on the misfit functional: for cross-correlation traveltime misfits it is the time derivative of the synthetic trace weighted by the measured delay; for envelope or optimal-transport misfits it is the corresponding functional derivative. Tromp et al. (2005) systematized this: *any* differentiable measurement defines an adjoint source, so the machinery extends far beyond least squares [5]. Second, the imaging-condition weights depend on parametrization — squared slowness, velocity, bulk modulus, or impedance each yield different correlation formulas with different balances between transmission (tomographic) and reflection (migration) components. Third, the gradient decomposes into a *smooth background component* (diving waves, updating long wavelengths) and an *oscillatory component* (reflections, updating short wavelengths) — the reason FWI simultaneously performs tomography and migration [1].

| Component | Forward quantity | Adjoint quantity | Physical meaning |
|---|---|---|---|
| Source wavefield $u$ | Incident field from source | — | Illumination of subsurface |
| Adjoint wavefield $u^\dagger$ | — | Residual back-propagated from receivers | Sensitivity to data errors |
| Gradient $\nabla_m J$ | $\int u^\dagger \, \partial_{tt} u \, dt$ | zero-lag correlation | Model update direction |
| Hessian action $H \delta m$ | Born-scattered field | Second adjoint propagation | Curvature / illumination correction |

### 4.2 Cycle Skipping and Multiscale Continuation

The defining pathology of FWI is *cycle skipping*. Because seismic waveforms are oscillatory with dominant period $T$, the least-squares misfit compares traces sample by sample. If the initial model's traveltime error exceeds $T/2$, the predicted event aligns with the *wrong cycle* of the observed event, and the gradient points toward an incorrect local minimum. Bunks et al. (1995) gave the canonical analysis on the Marmousi model: single-scale inversion fails catastrophically while a *multiscale* (multigrid) strategy succeeds, because at long wavelengths the objective has fewer, more widely separated local minima [3].

> **Definition:** *Cycle skipping* occurs when the predicted data are shifted by more than half a dominant period relative to the observed data, so that the local gradient of the waveform misfit drives the model toward an incorrect local minimum rather than the global minimum.

The multiscale remedy, now universal, inverts from low to high frequencies in stages: low-pass the data so the effective wavelength is long and the half-cycle criterion is satisfiable with a crude starting model; invert to convergence, recovering the long-wavelength kinematics; then increase the frequency content using the previous result as the start, progressively adding shorter wavelengths [3][4].

Sirgue and Pratt (2004) placed this strategy on a quantitative footing for the frequency domain, deriving sampling rules for discrete frequencies that avoid spatial aliasing of the gradient while minimizing redundant computation: only a few carefully spaced frequencies are needed per stage, denser at higher frequencies [4].

Where low frequencies are unavailable — field data below ~3–5 Hz are often noise-dominated — filtering alone cannot satisfy the half-cycle condition. The modern response is to *change the misfit functional*: envelope inversion fits the slowly varying instantaneous amplitude before the waveform; adaptive waveform inversion fits Wiener-filter coefficients between predicted and observed data; optimal-transport (Wasserstein) misfits measure the work to morph one trace into another, yielding a shift-convex measure. Each defines a new adjoint source within the same adjoint-state framework [5].

### 4.3 Elastic and Anisotropic Formulations

Extending FWI beyond the acoustic approximation replaces the scalar pressure field with the vector displacement field and introduces multiple parameter classes. The isotropic elastic problem inverts for $V_P$, $V_S$ (or Lamé parameters), and optionally density. Which parameters can be recovered is encoded in the *radiation patterns* — the angular dependence of scattering from a point perturbation of each class [1][6]:

- $V_P$ perturbations radiate P-to-P scattering over all angles and dominate transmitted wavefields; $V_P$ is the best-constrained parameter.
- $V_S$ perturbations radiate P-to-S and S-to-S scattering in a four-lobed pattern strongest at intermediate angles; $V_S$ updates derive from converted and surface waves.
- Density perturbations radiate with a $\cos\theta$-type pattern at large scattering angles, making density the poorest-constrained parameter in reflection geometries.

These patterns dictate the *hierarchical* strategies mandatory in elastic FWI: invert $V_P$ first from early arrivals and diving waves, then introduce $V_S$ via converted and surface-wave phases, and treat density with strong regularization or rock-physics coupling. Brossier et al. (2009) demonstrated this on complex onshore synthetics: the short S-wavelengths demand an accurate $V_S$ starting model — errors tolerable for $V_P$ at 10 Hz are fatal for $V_S$ — and free-surface multiples add severe nonlinearity requiring time-damping hierarchies [6]. Land elastic FWI is feasible, but only with sequential frequency inversion followed by sequential time-windowing from early to late arrivals.

Anisotropy adds further classes. In tilted transverse isotropy the Thomsen parameters $\epsilon, \delta$ and symmetry-axis tilt join the velocity; Warner et al. (2013) recovered velocity and anisotropy in 3D from field data only because wide-azimuth acquisition supplied the angular coverage to separate overlapping radiation patterns [8]. The general lesson: *each new parameter class multiplies the null space*, and multiparameter FWI is as much a problem of acquisition design and hierarchical regularization as of optimization.

### 4.4 Hessian Approximation and Optimization

The gradient alone is a poor search direction: it is contaminated by geometrical spreading, uneven illumination, and double-scattering artifacts. The Hessian $H = \nabla^2 J$ corrects all three, but full Newton is intractable. The practical spectrum:

1. **Diagonal pseudo-Hessian.** Approximating $H$ by its diagonal, estimated from the autocorrelation of the forward wavefield (the "source illumination"), yields a cheap preconditioner that balances amplitudes with depth. Nearly all production codes apply some variant.
2. **L-BFGS.** The limited-memory BFGS method builds a low-rank approximation to $H^{-1}$ from the last $m$ gradient/model pairs (typically $m \in [5, 20]$). It implicitly learns curvature along the optimization trajectory and substantially accelerates convergence over NLCG, particularly for the long-wavelength updates that dominate early iterations. Its memory cost is $O(mN)$ for $N$ parameters — negligible relative to wavefield storage.
3. **Gauss–Newton.** Dropping the second-order residual term gives $H_{GN} = DF^*DF$, positive semi-definite by construction. The Gauss–Newton step requires solving $H_{GN} \delta m = -\nabla J$ by conjugate gradients, each iteration of which needs one linearized forward (Born) and one adjoint solve. Truncated Gauss–Newton with few inner iterations is increasingly used for elastic FWI, where cross-parameter coupling makes the gradient particularly ill-scaled.
4. **Full Newton.** Retains the residual-dependent second-order term. It offers quadratic convergence near the solution but an indefinite Hessian far from it; it remains a research tool.

> **Theorem:** The Gauss–Newton Hessian $DF(\mathbf{m})^* DF(\mathbf{m})$ is the Fisher information operator of the least-squares problem: its eigenvectors are the model directions best constrained by the data, and its inverse (where defined) is the posterior covariance under a Gaussian approximation. Diagonal and L-BFGS approximations amount to tractable surrogates of this information operator.

In practice the choice is dictated by scale: NLCG for the cheapest iterations, L-BFGS as the default quasi-Newton workhorse, and truncated Gauss–Newton when multiparameter cross-talk demands explicit curvature. All sit inside a line search (typically Wolfe conditions) or trust-region framework, within the multiscale schedule of Section 4.2.

---

## 5. Empirical Results and Formal Analysis

### 5.1 Canonical benchmarks

Three synthetic benchmarks structured the empirical literature. The **Marmousi model** was where Bunks et al. (1995) showed single-scale inversion fails while multiscale inversion converges [3]; it remains the standard 2D test. The **SEG/EAGE salt** and **2004 BP** benchmarks test subsalt imaging, stressing the Hessian approximations of Section 4.4. The **Valhall model** — a North Sea ocean-bottom-cable geometry — became the canonical *elastic* benchmark: Brossier et al. (2009) recovered $V_P$ and $V_S$ from synthetic OBC data only with hierarchical inversion of data components and parameter classes [6].

On field data, the trajectory runs from Pratt's 2D acoustic inversions of crosshole and wide-angle data in the 1990s, through 2D frequency-domain inversions of long-offset streamer data, to the first 3D field-data results of Warner, Stekl, and Umpleby in 2008 and commercialization that influenced over a hundred drilling decisions worldwide. Anisotropic 3D FWI of field data [8] and time-lapse (4D) FWI for reservoir monitoring mark the current industrial state of the art.

### 5.2 GPU acceleration and the exascale trajectory

The computational kernel — explicit time-domain finite-difference wave propagation — is ideally suited to GPUs: arithmetically dense, embarrassingly parallel over the grid, and memory-bandwidth bound where GPUs excel. Yang, Gao, and Wang (2015) implemented time-domain FWI on GPUs with a wavefield-reconstruction strategy storing only domain boundaries on-device, avoiding host–device transfer bottlenecks, and reported order-of-magnitude speedups with a hybrid nonlinear conjugate-gradient solver in GPU blocks [7]. Later work scaled this to multi-GPU clusters with MPI domain decomposition and 3D elastic anisotropic solvers, with 20–80× speedups over serial CPU codes.

The impact is best seen through scaling. One 3D acoustic iteration over a $1000^3$ grid for $10^3$ sources needs $\sim 10^{15}$ FLOPs — weeks per inversion on pre-GPU clusters. Modern multi-GPU implementations with source encoding (simultaneous sources with random phase encoding, cross-talk suppressed by iteration averaging), optimal checkpointing for the adjoint, and mixed precision have compressed this to hours. Per-iteration complexity is $O(N_{src} \cdot N_t \cdot N_x N_y N_z)$ time; checkpointing trades a logarithmic recomputation factor for the memory that would otherwise scale as $O(N_t \cdot N_x N_y N_z)$.

### 5.3 Convergence analysis

Local convergence theory follows from standard nonlinear optimization: with an exact adjoint-state gradient and Wolfe-condition line searches, L-BFGS converges superlinearly near a strict local minimum. *Global* behavior is governed by the basin of attraction, which the multiscale analysis of [3][4] characterizes quantitatively: at maximum inverted frequency $f_{max}$, the basin radius in traveltime error is approximately $1/(2f_{max})$ — a 3 Hz stage tolerates ~160 ms of kinematic error, while a direct 20 Hz inversion tolerates only ~25 ms. This frequency–basin relationship is the formal justification of frequency continuation and explains why the absence of low frequencies in field data is the single most damaging practical limitation.

---

## 6. Limitations and Open Problems

Despite its maturity, FWI remains limited in ways that define active research:

- **Starting-model dependence.** Local-optimization FWI needs an initial model inside the basin of attraction, still built by traveltime tomography or migration velocity analysis; failure here cannot be recovered downstream.
- **Cycle skipping without low frequencies.** Field data often lack usable energy below 3–5 Hz while multiscale theory demands it. Envelope, adaptive, and optimal-transport misfits mitigate but do not eliminate the problem.
- **Multiparameter cross-talk.** Elastic and anisotropic classes have overlapping radiation patterns under band- and aperture-limited data; density, attenuation, and anisotropy remain weakly constrained without prior bias.
- **Amplitude fidelity.** Least squares assumes correct amplitude physics, yet field data contain unmodeled elastic, attenuative, and acquisition effects; amplitude-robust misfits sacrifice resolution.
- **Exascale cost.** 3D elastic anisotropic FWI of full-azimuth surveys is among the largest industrial computations; wavefield memory, checkpoint I/O, and energy are binding constraints.
- **Uncertainty quantification.** Production FWI delivers one "best" model with no uncertainty; Bayesian 3D FWI via MCMC is intractable, and variational alternatives are nascent.

> **Open problem:** A misfit functional that is simultaneously (i) convex with respect to kinematic errors exceeding one wavelength, (ii) sensitive to sub-wavelength reflectivity, (iii) robust to amplitude modeling errors, and (iv) differentiable with a cheaply computable adjoint source — satisfying all four remains the central theoretical challenge of waveform inversion.

---

## 7. Conclusion

Full-waveform inversion has matured from Tarantola's 1984 formulation [2] into the dominant paradigm of seismic imaging — a case study in how a mathematically elegant idea becomes industrial technology only through the simultaneous solution of optimization, physics, and computational problems. The adjoint-state method reduced the gradient to two solves per source [2][5]; multiscale continuation tamed the non-convexity diagnosed by Bunks et al. [3] and operationalized by Sirgue and Pratt [4]; elastic and anisotropic formulations extended the physics at the cost of hierarchical multiparameter strategies [6][8]; and GPU acceleration collapsed the barrier that once confined FWI to two dimensions [7].

The frontier has shifted accordingly. The questions that matter now — global convergence without low frequencies, multiparameter null spaces, amplitude-robust misfits, exascale efficiency, and uncertainty quantification — are deeper than the ones FWI has solved. What is certain is that the adjoint-state principle, which unifies migration, tomography, and inversion in a single framework [1][5], will remain the foundation of whatever comes next.

---

## References

[1] J. Virieux and S. Operto. "An overview of full-waveform inversion in exploration geophysics." *Geophysics*, 74(6):WCC1–WCC26, 2009. https://hal.science/hal-00457989

[2] A. Tarantola. "Inversion of seismic reflection data in the acoustic approximation." *Geophysics*, 49(8):1259–1266, 1984. https://doi.org/10.1190/1.1441754

[3] C. Bunks, F. M. Saleck, S. Zaleski, and G. Chavent. "Multiscale seismic waveform inversion." *Geophysics*, 60:1457–1473, 1995. https://doi.org/10.1190/1.1443880

[4] L. Sirgue and R. G. Pratt. "Efficient waveform inversion and imaging: A strategy for selecting temporal frequencies." *Geophysics*, 69:231–248, 2004. https://doi.org/10.1190/1.1649391

[5] J. Tromp, C. Tape, and Q. Liu. "Seismic tomography, adjoint methods, time reversal and banana-doughnut kernels." *Geophysical Journal International*, 160:195–216, 2005. https://doi.org/10.1111/j.1365-246X.2004.02453.x

[6] R. Brossier, S. Operto, and J. Virieux. "Seismic imaging of complex onshore structures by 2D elastic frequency-domain full-waveform inversion." *Geophysics*, 74(6):WCC105–WCC118, 2009. https://doi.org/10.1190/1.3215771

[7] P. Yang, J. Gao, and B. Wang. "A graphics processing unit implementation of time-domain full-waveform inversion." *Geophysics*, 80(3):F31–F39, 2015. https://pubs.geoscienceworld.org/seg/geophysics/article-abstract/80/3/F31/308650/A-graphics-processing-unit-implementation-of-time

[8] M. Warner, A. Ratcliffe, T. Nangoo, J. Morgan, A. Umpleby, N. Shah, et al. "Anisotropic 3D full-waveform inversion." *Geophysics*, 78(2):R59–R80, 2013. https://doi.org/10.1190/geo2012-0338.1


[1] An overview of full-waveform inversion in exploration geophysics — Geophysics, 74(6), WCC1-WCC26, 2009. https://hal.science/hal-00457989
[2] Inversion of seismic reflection data in the acoustic approximation — Geophysics, 49(8), 1259-1266, 1984. https://doi.org/10.1190/1.1441754
[3] Multiscale seismic waveform inversion — Geophysics, 60, 1457-1473, 1995. https://doi.org/10.1190/1.1443880
[4] Efficient waveform inversion and imaging: A strategy for selecting temporal frequencies — Geophysics, 69, 231-248, 2004. https://doi.org/10.1190/1.1649391
[5] Seismic tomography, adjoint methods, time reversal and banana-doughnut kernels — Geophysical Journal International, 160, 195-216, 2005. https://doi.org/10.1111/j.1365-246X.2004.02453.x
[6] Seismic imaging of complex onshore structures by 2D elastic frequency-domain full-waveform inversion — Geophysics, 74(6), WCC105-WCC118, 2009. https://doi.org/10.1190/1.3215771
[7] A graphics processing unit implementation of time-domain full-waveform inversion — Geophysics, 80(3), F31-F39, 2015. https://pubs.geoscienceworld.org/seg/geophysics/article-abstract/80/3/F31/308650/A-graphics-processing-unit-implementation-of-time
[8] Anisotropic 3D full-waveform inversion — Geophysics, 78(2), R59-R80, 2013. https://doi.org/10.1190/geo2012-0338.1
