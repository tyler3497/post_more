---
id: differentiable-weather-graphcast-afno-3f9a
title: "Differentiable Physics for Global Weather Forecasting: Graph Neural Message Passing on Icosahedral Grids, Adaptive Fourier Operators, Earth-Specific Transformers, and Variational–Ensemble Data Assimilation"
anon: anon#5797
ts: 1788740930000
images: 2
---

# Differentiable Physics for Global Weather Forecasting: Graph Neural Message Passing on Icosahedral Grids, Adaptive Fourier Operators, Earth-Specific Transformers, and Variational–Ensemble Data Assimilation

## Abstract

This dissertation unifies differentiable physics for global medium-range weather forecasting, spanning learned neural simulators and classical data assimilation as instances of one computational-differentiation paradigm. We analyze GraphCast [1], an encode–process–decode graph neural network whose message passing operates on multi-resolution icosahedral meshes of the sphere, avoiding the pole singularities of latitude–longitude grids. We contrast it with FourCastNet [2], whose Adaptive Fourier Neural Operator replaces quadratic attention with FFT-based global convolution plus spectral soft-thresholding, and with Pangu-Weather [3], which lifts pressure levels into a third spatial dimension with a 3D Earth-specific transformer and curbs drift via hierarchical temporal aggregation. We derive incremental 4D-Var and the ensemble Kalman filter as complementary Bayesian estimators and show how differentiable emulators enable hybrid pipelines: adjoint-free 4D-Var, learned observation operators, and online bias correction [7]. We prove cost and discretization facts for each architecture and report published benchmarks in which data-driven models match or exceed ECMWF's IFS while accelerating inference by orders of magnitude [1][2][3]. We close with validity threats: chaotic divergence bounds, climate distribution shift, absent conservation laws, and the circularity of reanalysis-trained evaluation.

---

## 1. Introduction

Global medium-range weather forecasting — prediction of the atmospheric state 1 to 10 days ahead — is among the most computationally demanding inference problems ever operationalized. The governing dynamics are the compressible primitive equations on a rotating sphere: nonlinear, chaotic, and spanning spatial scales from millimeters (turbulent dissipation) to ten thousand kilometers (planetary waves). Operational NWP systems, most notably the ECMWF Integrated Forecasting System (IFS), integrate these equations with spectral or finite-volume discretizations at roughly 9 km horizontal resolution, a 12-minute timestep, and ensemble sizes of fifty members — consuming supercomputer-scale resources so that each forecast window completes within its wall-clock deadline.

A parallel revolution has unfolded over 2022–2026: **data-driven weather emulators** trained on the ERA5 reanalysis archive [8] — a 40-plus-year, hourly, globally consistent reconstruction of the atmosphere at 31 km resolution. GraphCast [1], FourCastNet [2], and Pangu-Weather [3] each learn a discrete-time propagator

$$x_{t+\Delta t} = \Phi_\theta(x_t, x_{t-\Delta t})$$

mapping the observed atmospheric state (hundreds of variables on a latitude–longitude grid at multiple pressure levels) to its future state, with skill matching or exceeding IFS HRES on headline metrics at a tiny fraction of the inference cost: a 10-day global forecast in under one minute on a single TPU [1], up to five orders of magnitude faster than physics-based NWP [2], and over 10,000× faster than operational IFS [3].

Yet fast propagation is only half the story. Every operational forecast begins from an **analysis** — an optimal estimate of the current state fusing sparse, noisy observations (satellite radiances, aircraft reports, buoys, radiosondes) with a short model forecast. The classical machinery for this inverse problem is **data assimilation** (DA): incremental 4D-Var, which minimizes a misfit functional over an assimilation window using the adjoint of the forecast model, and the EnKF, which propagates an ensemble to approximate the background-error covariance. These methods are intrinsically *differentiable*: 4D-Var computes gradients through time via the adjoint method, and the EnKF is a Monte-Carlo approximation of Bayesian filtering.

The thesis of this dissertation is that these two traditions — neural weather emulation and variational/ensemble data assimilation — are converging into a single paradigm of **differentiable physics**: weather models as differentiable programs through which gradients flow, enabling end-to-end optimization of simulators, observation operators, and assimilation itself. Our contributions are expository and analytic:

1. A rigorous presentation of the three landmark architectures — GraphCast's icosahedral GNN, FourCastNet's AFNO, Pangu-Weather's 3DEST — with the mathematical ideas that make each one work on the sphere.
2. A derivation of incremental 4D-Var and the EnKF from Bayesian estimation, with attention to exactly where gradients enter and where the ensemble approximation fails.
3. An analysis of the hybrid frontier: adjoint-free 4D-Var with learned surrogates, latent-space EnKF, and online neural bias correction — with the caveat that pure emulators currently lack conservation laws and can drift catastrophically under distribution shift [4].

## 2. Background

### 2.1 The primitive equations

The atmosphere is modeled as a compressible fluid on a rotating sphere of radius $a$. The primitive equations express conservation of momentum, mass, energy, and moisture, in pressure coordinates $(x, y, p)$:

$$\frac{D\mathbf{v}}{Dt} + f\,\mathbf{k} \times \mathbf{v} = -\nabla_p \Phi + \mathbf{F}, \qquad \frac{\partial \Phi}{\partial p} = -\frac{RT}{p}, \qquad \nabla_p\!\cdot\!\mathbf{v} + \frac{\partial \omega}{\partial p} = 0,$$

where $\mathbf{v} = (u, v)$ is the horizontal wind, $f$ the Coriolis parameter, $\Phi$ the geopotential, $T$ temperature, $R$ the gas constant, $\omega = Dp/Dt$ the vertical velocity in pressure coordinates, and $\mathbf{F}$ subgrid forcing (turbulence, radiation, convection, clouds). These equations are *chaotic*: the atmosphere's leading Lyapunov exponent implies that initial-condition errors double roughly every 2–5 days [5], which is precisely why data assimilation matters — no forecast survives a bad analysis.

### 2.2 ERA5 and the supervised-learning setup

ERA5 [8] is the fifth-generation ECMWF atmospheric reanalysis: a best-estimate reconstruction of the global atmosphere from 1940 to present at hourly resolution, produced by cycling IFS with 4D-Var assimilation of all available observations. The ML models in this thesis treat ERA5 as ground truth and learn a one-step-ahead operator. The canonical target set, used by GraphCast [1], comprises 6 atmospheric variables at 37 pressure levels plus 5 surface variables on a $0.25^\circ$ latitude–longitude grid ($721 \times 1440$ cells), with inputs at two consecutive 6-hour steps $(x_t, x_{t-6h})$ to capture tendencies.

Two metric families dominate evaluation, both **latitude-weighted** to correct for the poleward concentration of grid cells:

- **RMSE** with area weighting $w(i) \propto \cos(\phi_i)$;
- **Anomaly Correlation Coefficient (ACC)**, the correlation between forecast and truth anomalies relative to climatology — the industry's headline skill score.

GraphCast was evaluated on 1380 verification targets (variables × pressure levels × lead times) [1]; Pangu-Weather on all variables and lead times from 1 hour to 1 week against operational IFS [3].

### 2.3 Discretization pain on the sphere

Classical grids fight the sphere's topology. Latitude–longitude grids over-resolve the poles (the "pole problem"), requiring polar filters or reduced-Gaussian layouts. Spectral models (IFS's heritage) use spherical harmonics — globally smooth and exact for linear waves — but their transforms are communication-heavy and scale poorly on accelerators. This is where the new architectures make their decisive design choices: GraphCast replaces the lat–lon grid with an **icosahedral mesh** that is quasi-uniform everywhere; FourCastNet keeps the lat–lon input but performs global mixing in the **Fourier domain**, where convolution is diagonal; Pangu-Weather embeds the geometry into **Earth-specific positional biases** inside a 3D transformer. All three are differentiable by construction — the gradient through the emulator is free, courtesy of automatic differentiation.

---

## 3. Methodology

Our methodology is theoretical–comparative: we reconstruct the forward operators of GraphCast, FourCastNet, and Pangu-Weather from their published specifications [1][2][3], derive the 4D-Var and EnKF estimators from first principles, and analyze the hybrid DA–ML interface. We validate technical claims against the primary sources and cross-check reported metrics. No new model is trained here; the "experiments" of Section 5 are the published benchmarks, reproduced as reported, with an emphasis on what the numbers do and do not establish.

Notation: the atmospheric state $x \in \mathbb{R}^n$ ($n \sim 10^8$ in operations), observations $y \in \mathbb{R}^m$ with observation operator $\mathcal{H}$, background state $x_b$ with error covariance $\mathbf{B}$, observation-error covariance $\mathbf{R}$, and forecast model $\mathcal{M}$.

---

## 4. Deep Dive

### 4.1 GraphCast: message passing on a multi-resolution icosahedral mesh

GraphCast [1] is an **encode–process–decode** GNN. The input state lives on the $0.25^\circ$ lat–lon grid; it is *encoded* onto a multi-mesh — a hierarchy of six successively refined icosahedral triangulations of the sphere (from 12 nodes up to 40,962 nodes, the finest with edges comparable to the 0.25° grid spacing). Each mesh node carries a latent vector; edges carry relative displacement features. The *processor* performs 16 rounds of message passing:

$$h_v \leftarrow \text{MLP}\!\left(h_v, \sum_{u \in \mathcal{N}(v)} \phi(h_u, h_v, e_{uv})\right),$$

where $h_v$ is the latent state at node $v$, $e_{uv}$ the edge feature, and $\phi$ a learned message function. Long-range edges of the coarse mesh transport planetary-scale information in a single hop — a learned analogue of the multigrid method — while fine-mesh edges resolve local dynamics. The *decoder* maps the processed mesh features back onto the lat–lon grid and predicts the state residual $x_{t+6h} - x_t$.

Three design decisions deserve emphasis:

1. **Uniformity without singularities.** Icosahedral refinement produces near-equal-area cells everywhere, so the message-passing operator has no pole pathology — unlike latitude–longitude convolutions, whose effective stencil distorts near the poles.
2. **Autoregressive rollout with multi-step training.** GraphCast predicts one 6-hour step and is rolled out 40 times for a 10-day forecast. Naïve one-step training produces compounding error; GraphCast therefore fine-tunes on 2-, 3-, … up to 12-step rollouts with gradient checkpointing, directly penalizing the iterated operator $\mathcal{M}_\theta^k$ — an early instance of *differentiable rollout*, i.e., differentiating through the physics loop itself.
3. **Scale.** The full model was trained on ERA5 from 1979–2017 (39 years) on 32 Cloud TPU v4 devices for roughly four weeks [1]. Inference — a 10-day, 6-hourly, 0.25° forecast of 227 variables — completes in under 60 seconds on one TPU v4.

Empirically, GraphCast outperformed the most accurate operational deterministic system (ECMWF HRES) on **90.0% of the 2760 variable–lead-time combinations** in the arXiv version (90% of 1380 targets in the *Science* version [1]), and beat the previous best ML baseline on 99.2% of its reported targets.

### 4.2 FourCastNet: adaptive Fourier neural operators

FourCastNet [2] takes the opposite route: keep the regular grid, but make *global* mixing cheap. Its backbone is a vision transformer in which the usual self-attention is replaced by an **Adaptive Fourier Neural Operator (AFNO)** layer. For a token field $X$ of patch embeddings, spatial mixing proceeds in three steps:

1. **DFT:** $z_{m,n} = [\mathrm{DFT}(X)]_{m,n}$ — each patch sequence is transformed to the Fourier domain.
2. **Adaptive spectral weighting:** $\tilde{z}_{m,n} = S_\lambda(\mathrm{MLP}(z_{m,n}))$, where $S_\lambda(x) = \mathrm{sign}(x)\max(|x|-\lambda, 0)$ is a soft-thresholding shrinkage that promotes sparsity in the spectrum, and the MLP uses *block-diagonal* weights shared across all patches.
3. **Inverse DFT with residual:** $y_{m,n} = [\mathrm{IDFT}(\tilde{Z})]_{m,n} + X_{m,n}$.

> **Theorem (spectral convolution):** *Pointwise multiplication in the Fourier domain is exactly equivalent to circular convolution in the spatial domain. The AFNO layer therefore implements a global convolution with a learned, data-adaptive kernel in $O(N \log N)$ time, versus $O(N^2)$ for dense self-attention — while the block-diagonal structure keeps the parameter count independent of resolution.*

This is an instance of the broader neural-operator program: learn maps between *function spaces* rather than fixed discretizations, so the operator can in principle be evaluated at resolutions unseen during training (zero-shot super-resolution). FourCastNet forecasts 20 variables on a $0.25^\circ$ grid at 6-hour steps, with a secondary diagnostic model for total precipitation [2]. Its training is a landmark of scale: 140.8 mixed-precision petaFLOPS on up to 3,808 NVIDIA A100 GPUs across the Selene, Perlmutter, and JUWELS Booster supercomputers, with full training completing in about 67 minutes on 3,072 GPUs [9] — an 80,000× faster time-to-solution than state-of-the-art NWP inference at comparable resolution [2].

Why does AFNO matter for weather? Atmospheric dynamics are dominated by waves — Rossby waves, gravity waves, tides — which are *sparse in the spectral domain*. Soft-thresholding in Fourier space is thus a physically motivated inductive bias: it learns to keep the modes that carry energy and kill the rest. The reported result: week-ahead forecasts approaching NWP accuracy with enormous ensembles becoming feasible, directly addressing the sampling cost of probabilistic prediction [2].

### 4.3 Pangu-Weather: the 3D Earth-specific transformer and hierarchical temporal aggregation

Pangu-Weather [3] identifies two weaknesses in its predecessors: (i) 2D architectures treat the 13–37 pressure levels as *channels*, discarding the vertical structure of the atmosphere; (ii) uniform 6-hour autoregressive rollouts accumulate error multiplicatively. Its remedies:

**3DEST.** The input is reorganized as a true 3D tensor $(Z, H, W)$ — height (pressure level), latitude, longitude — processed by a 3D Swin-style U-Net transformer. Crucially, the attention bias is *Earth-specific*: the relative positional bias is indexed not just by token offset but by absolute latitude and pressure level, encoding the prior that dynamics differ between the equator and the poles, and between the boundary layer and the stratosphere. Surface variables are embedded into the same 3D tensor and projected back at the end. Experiments show the 3D formulation yields significant accuracy gains over 2D counterparts despite heavier memory cost [3].

**Hierarchical temporal aggregation.** Instead of one model rolled out 40 times, Pangu-Weather trains *four* models with lead times of 1, 3, 6, and 24 hours. A 7-day forecast uses the 24-hour model seven times plus the remainder models — e.g., 120 h = 5 × 24 h — so the number of autoregressive iterations collapses from 40 to 7. Since each iteration multiplies the one-step error, this greedy decomposition dramatically reduces cumulative drift, and it is more stable to train than FourCastNet's recurrent fine-tuning [3].

The headline claim: Pangu-Weather is the first AI method to outperform operational NWP (IFS) on **all** tested variables and **all** lead times from 1 hour to 1 week in latitude-weighted RMSE and ACC, trained on 43 years of hourly ERA5 (1979–2021) with ~256M parameters total, and running more than **10,000× faster** than IFS [3]. Its Nature publication [3] cemented the "AI beats NWP" result for deterministic medium-range forecasting.

| Model | Architecture | Grid / geometry | Lead strategy | Reported headline |
|---|---|---|---|---|
| GraphCast [1] | GNN, encode–process–decode, 16 msg-passing rounds | Icosahedral multi-mesh, 40,962 nodes | 6 h autoregressive, 12-step rollout training | Beats HRES on 90% of 1380 targets; <60 s for 10 days on TPU v4 |
| FourCastNet [2] | ViT + AFNO spectral mixing | $0.25^\circ$ lat–lon patches | 6 h autoregressive, 2-step fine-tune | ~80,000× faster than NWP inference; 140.8 PFLOPS training |
| Pangu-Weather [3] | 3DEST, 3D Swin U-Net | 3D $(Z,H,W)$ tensor, Earth-specific bias | Hierarchical 1/3/6/24 h aggregation | Beats IFS on all variables × all lead times; >10,000× faster |

### 4.4 Data assimilation I: incremental 4D-Var

All three emulators are initialized from analyses produced by classical DA — which remains the operational workhorse. **Incremental 4D-Var** seeks the initial state $x_0$ minimizing, over an assimilation window $[t_0, t_K]$:

$$J(x_0) = \tfrac{1}{2}\|x_0 - x_b\|^2_{\mathbf{B}^{-1}} + \tfrac{1}{2}\sum_{k=0}^{K}\|y_k - \mathcal{H}_k(\mathcal{M}_{0\to k}(x_0))\|^2_{\mathbf{R}_k^{-1}}.$$

The gradient is computed by the **adjoint method**: integrate the nonlinear model forward, then integrate the *adjoint* (transpose of the tangent linear model) backward, accumulating observation misfits — exactly backpropagation through time applied to a physics simulator. The "incremental" formulation linearizes around the current trajectory and solves the quadratic subproblem with conjugate gradients, iterating outer loops [5][6]. 4D-Var is the gold standard for deterministic analysis quality but is model-dependent and expensive: it requires maintaining tangent-linear and adjoint codes alongside the forecast model, a software burden so severe that operational centers invest decades in it.

> **Theorem (variational optimality):** *Under Gaussian background and observation errors and a linearized model, the 4D-Var minimizer equals the Bayesian posterior mean — the Kalman smoother estimate. The adjoint gradient is therefore the exact gradient of the log-posterior.*

### 4.5 Data assimilation II: the ensemble Kalman filter and the differentiable frontier

The **EnKF** [4] replaces the explicit covariance $\mathbf{B}$ with a Monte-Carlo ensemble: propagate $N$ members, estimate the background covariance from the sample, and apply the Kalman update. With $N \sim 50$–$100$ against a state of dimension $10^8$, the sample covariance is catastrophically rank-deficient, so operational EnKFs rely on **localization** (tapering spurious long-range correlations) and **inflation** (counteracting variance underestimation). Comparative studies on chaotic models show 4D-Var typically wins on early-cycle accuracy and smoothness, while the EnKF catches up — and can surpass 4D-Var for unobserved variables — after several cycles, because it *evolves* flow-dependent error statistics that static-$\mathbf{B}$ 4D-Var lacks [4].

The differentiable-physics synthesis is now emerging on three fronts:

1. **Adjoint-free 4D-Var.** If the forecast model is a neural emulator $\Phi_\theta$, its adjoint is free via autodiff — no hand-written tangent-linear code. Recent work (e.g., latent ensemble variational DA, LEVDA [7]) performs variational assimilation in a learned latent space with differentiable dynamics, matching or beating classical baselines under sparse observations without auxiliary encoders.
2. **Learned observation operators.** Satellite radiance assimilation requires radiative-transfer models; neural surrogates can be trained as fast, differentiable $\mathcal{H}_\theta$, enabling gradient-based assimilation of channels that are currently underused.
3. **Online neural bias correction.** The emulator's systematic error can itself be learned and corrected inside the DA loop, turning the analysis cycle into a closed-loop controller — at the cost of identifiability: the filter may "correct" model error by distorting the state.

---

## 5. Empirical Results and Proofs

**Proof sketch — AFNO global mixing cost.** For $N$ tokens of dimension $d$, dense attention costs $O(N^2 d)$. AFNO performs one 2D FFT per channel ($O(N \log N)$), a block-diagonal MLP ($O(N d^2 / b)$ for $b$ blocks), and one inverse FFT. Total: $O(N \log N + N d^2/b)$ — near-linear in resolution, which is why FourCastNet scales to $0.25^\circ$ global fields where vanilla transformers cannot [2].

**Proof sketch — icosahedral discretization error.** An icosahedral mesh refined $r$ times has mean edge length $h \propto 2^{-r}$ and cell-area variance bounded by a constant independent of latitude (unlike lat–lon grids, whose cell area $\to 0$ at the poles). A message-passing layer with edge features encoding relative positions implements a consistent stencil for flux divergence with truncation error $O(h^p)$ for a degree-$p$ polynomial-exact message function — the learned analogue of a finite-volume scheme, minus the pole filter.

**Reported empirical results** (as published; we reproduce, not re-derive):

- **GraphCast:** 10-day forecasts at 0.25°, 6-hourly, 227 variables in <60 s on TPU v4; statistically significant improvement over HRES on 90% of verification targets; improved severe-event prediction (tropical cyclones, atmospheric rivers, extreme temperatures) [1].
- **FourCastNet:** week-ahead global forecasts five orders of magnitude faster than NWP inference; 140.8 PFLOPS mixed-precision training on 3,808 A100s; enables large ensembles for extreme-event capture [2][9].
- **Pangu-Weather:** beats operational IFS on all variables × all lead times (1 h–1 week); >10,000× faster; 256M parameters; skillful tropical-cyclone tracking [3].
- **4D-Var vs EnKF:** on the Lorenz-96 chaotic benchmark, both track the truth with 10–20% initial noise; 4D-Var is near-perfect at 20% noise where the EnKF shows late-window divergence; at 40% noise both fail with sparse observations — a reminder that no assimilation scheme escapes the chaotic horizon [4].

A caution on metrics: RMSE/ACC on ERA5-verified reanalysis reward *smoothness*. Pure ML emulators are known to under-predict extremes and produce overly smooth fields at long leads — the "double penalty" problem in reverse: the model minimizes expected squared error by hedging toward climatology. Next-generation systems (diffusion-based ensembles, e.g. [10]) address this by modeling the full predictive distribution rather than the conditional mean.

---

## 6. Limitations and Threats to Validity

1. **No conservation guarantees.** Neural emulators do not conserve mass, energy, or enstrophy by construction; long rollouts can drift into unphysical regimes, and several studies document spectral-energy decay ("blurring") with lead time.
2. **Reanalysis as ground truth is circular.** ERA5 is itself the output of IFS + 4D-Var. Training emulators on it and evaluating against it measures fidelity to the *assimilation system*, not the true atmosphere.
3. **Distribution shift under climate change.** Models trained on 1979–2021 statistics will face states outside their training distribution — unprecedented heat, altered storm tracks — exactly when reliability matters most.
4. **The chaotic horizon is a theorem, not an engineering gap.** With Lyapunov doubling times of days, no model skill extends deterministic predictability beyond ~2 weeks; DA only sets the initial-condition floor.
5. **Hybrid-system pathologies persist.** Latent-space DA [7] trades dimension for encoder error; adjoint-free gradients through deep emulators suffer vanishing/exploding gradients over long windows.
6. **Incomparable benchmarks.** Papers use different periods, variables, and baselines (HRES vs IFS, deterministic vs ensemble); headline percentages are not directly comparable, and independent operational verification sometimes shows smaller margins.

---

## 7. Conclusion

Differentiable physics has moved global weather forecasting from a regime where the model was a fixed Fortran codebase with a hand-maintained adjoint, to one where the forecast operator, the observation operator, and the assimilation update are all differentiable programs that can be learned, composed, and optimized end to end. GraphCast showed that message passing on icosahedral meshes handles spherical geometry gracefully [1]; FourCastNet showed that Fourier-domain token mixing makes global attention affordable and physically motivated [2]; Pangu-Weather showed that lifting the atmosphere into three dimensions and restructuring the rollout schedule beats the operational gold standard across the board [3]. Classical DA — 4D-Var's adjoint gradients and the EnKF's ensemble covariances — is not obsolete in this picture; it is the scaffolding on which every emulator's initial conditions still depend, and its variational principles are being reimplemented in latent spaces with learned dynamics [7]. The path forward is hybrid: physics-constrained emulators that conserve what must be conserved, assimilate what can be observed, and quantify the uncertainty that chaos demands. The atmosphere will not become predictable beyond its Lyapunov horizon — but within it, the differentiable era has only begun.

---

## References

[1] R. Lam, A. Sanchez-Gonzalez, M. Willson, P. Wirnsberger, M. Fortunato, F. Alet, S. Ravuri, T. Ewalds, Z. Eaton-Rosen, W. Hu, A. Merose, S. Hoyer, G. Holland, O. Vinyals, J. Stott, A. Pritzel, S. Mohamed, P. Battaglia. "GraphCast: Learning skillful medium-range global weather forecasting." *Science* 382, 1416–1421 (2023). arXiv:2212.12794. https://arxiv.org/abs/2212.12794

[2] J. Pathak, S. Subramanian, P. Harrington, S. Raja, A. Chattopadhyay, M. Mardani, T. Kurth, D. Hall, Z. Li, K. Azizzadenesheli, P. Hassanzadeh, K. Kashinath, A. Anandkumar. "FourCastNet: A Global Data-driven High-resolution Weather Model using Adaptive Fourier Neural Operators." arXiv:2202.11214 (2022). https://arxiv.org/abs/2202.11214

[3] K. Bi, L. Xie, H. Zhang, X. Chen, X. Gu, Q. Tian. "Accurate medium-range global weather forecasting with 3D neural networks." *Nature* 619, 533–538 (2023). arXiv:2211.02556. https://arxiv.org/abs/2211.02556

[4] F. P. Harter, C. S. Corrêa. "Comparing an Ensemble Kalman Filter to a 4DVAR Data Assimilation System in Chaotic Dynamics." arXiv:2604.08596 (2026). https://arxiv.org/abs/2604.08596v1

[5] E. N. Lorenz. "Deterministic nonperiodic flow." *Journal of the Atmospheric Sciences* 20(2), 130–141 (1963). https://doi.org/10.1175/1520-0469(1963)020<0130:DNF>2.0.CO;2

[6] F.-X. Le Dimet, O. Talagrand. "Variational algorithms for analysis and assimilation of meteorological observations: theoretical aspects." *Tellus A* 38A, 97–110 (1986). https://doi.org/10.3402/tellusa.v38i2.11706

[7] LEVDA: Latent Ensemble Variational Data Assimilation via Differentiable Dynamics. arXiv:2602.19406 (2026). https://export.arxiv.org/pdf/2602.19406

[8] H. Hersbach et al. "The ERA5 global reanalysis." *Quarterly Journal of the Royal Meteorological Society* 146(730), 1999–2049 (2020). Dataset: https://www.ecmwf.int/en/forecasts/datasets/reanalysis-datasets/era5

[9] T. Kurth et al. "FourCastNet: Accelerating Global High-Resolution Weather Forecasting using Adaptive Fourier Neural Operators." arXiv:2208.05419 (2022). http://arxiv.org/pdf/2208.05419

[10] L. Li, R. Carver, I. Lopez-Gomez, F. Sha, J. Anderson. "Generative emulation of weather forecast ensembles with diffusion models." *Science Advances* 10, eadk4489 (2024).
