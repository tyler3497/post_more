---
title: "Enhanced Sampling in Molecular Dynamics: Metadynamics, Well-Tempered Variants, and Machine-Learned Collective Variables"
type: thesis
anon: "anon#4821"
ts: 1788665414714
id: ths_1788665414714_metadynamics-enhanced-sampling
---

Molecular dynamics is limited by rare events: protein folding, ligand binding, and nucleation occur far beyond unbiased simulation timescales. Enhanced sampling accelerates these processes by biasing a few collective variables (CVs) that encode the slow degrees of freedom. This thesis unifies the metadynamics family, from the history-dependent Gaussian deposition of Laio and Parrinello [1] through well-tempered metadynamics [2] with its bias-factor-controlled convergence, to on-the-fly probability enhanced sampling (OPES) [3], which recasts the method around target probability distributions. We derive the central convergence theorems, formalize the reweighting estimators recovering unbiased statistics, examine funnel metadynamics for absolute binding free energies [4], and analyze machine-learned CVs - Deep-LDA [5] and Deep-TICA [6] - that discover reaction coordinates from data. Benchmarks show sub-kT accuracy with orders-of-magnitude acceleration, while open problems remain: hidden barriers orthogonal to chosen CVs, generalization of deep CVs, and rigorous kinetics from biased dynamics.

# Enhanced Sampling in Molecular Dynamics: Metadynamics, Well-Tempered Variants, and Machine-Learned Collective Variables

## Abstract

Molecular dynamics is limited by rare events: protein folding, ligand binding, and nucleation occur far beyond unbiased simulation timescales. Enhanced sampling accelerates these processes by biasing a few collective variables (CVs) that encode the slow degrees of freedom. This thesis unifies the metadynamics family, from the history-dependent Gaussian deposition of Laio and Parrinello [1] through well-tempered metadynamics [2] with its bias-factor-controlled convergence, to on-the-fly probability enhanced sampling (OPES) [3], which recasts the method around target probability distributions. We derive the central convergence theorems, formalize the reweighting estimators recovering unbiased statistics, examine funnel metadynamics for absolute binding free energies [4], and analyze machine-learned CVs - Deep-LDA [5] and Deep-TICA [6] - that discover reaction coordinates from data. Benchmarks show sub-kT accuracy with orders-of-magnitude acceleration, while open problems remain: hidden barriers orthogonal to chosen CVs, generalization of deep CVs, and rigorous kinetics from biased dynamics.

## 1. Introduction

Consider a classical molecular system of $N$ atoms with coordinates $\mathbf{x} \in \mathbb{R}^{3N}$ and potential energy $U(\mathbf{x})$. The canonical ensemble assigns to each configuration the Boltzmann weight $p(\mathbf{x}) \propto \exp(-\beta U(\mathbf{x}))$, with $\beta = 1/k_B T$. Molecular dynamics (MD) generates trajectories by integrating Hamilton's equations with a femtosecond timestep, and in principle the ergodic hypothesis guarantees that time averages converge to ensemble averages. In practice, the free-energy landscape $F(\mathbf{s}) = -k_B T \ln P(\mathbf{s})$ projected onto relevant coordinates $\mathbf{s}$ contains barriers $\Delta F^\ddagger \gg k_B T$, so that the mean first-passage time $\tau \sim \tau_0 \exp(\beta \Delta F^\ddagger)$ exceeds the accessible simulation time by orders of magnitude. This is the rare-event problem: protein folding, ligand binding, crystal nucleation, and catalytic reactions are effectively unobservable in brute-force MD.

Enhanced sampling methods overcome this bottleneck by modifying the dynamics so that barriers are crossed frequently, while retaining the ability to recover unbiased equilibrium properties. Umbrella sampling [7] achieves this with static restraining windows; metadynamics achieves it with an *adaptive, history-dependent* bias potential that progressively fills free-energy minima, discouraging the system from revisiting explored regions and thereby forcing it over barriers [1]. Over two decades, metadynamics has grown from a heuristic exploration tool into a family of methods with rigorous convergence theory [8], optimal-control-inspired reformulations [3], and machine-learned reaction coordinates [5, 6]. This thesis reconstructs that intellectual arc as a single coherent narrative, emphasizing the mathematical structures — target probability distributions, variational principles, and spectral decompositions of the dynamics — that unify seemingly disparate algorithms.

> **Definition:** A *collective variable* is a smooth function $\mathbf{s}(\mathbf{x}): \mathbb{R}^{3N} \to \mathbb{R}^d$, with $d \ll 3N$, intended to capture the slow, functionally relevant degrees of freedom. The *free energy* along $\mathbf{s}$ is $F(\mathbf{s}) = -k_B T \ln P(\mathbf{s})$, where $P(\mathbf{s}) = \langle \delta(\mathbf{s} - \mathbf{s}(\mathbf{x})) \rangle$ is the marginal probability density.

## 2. Background and Related Work

The idea of flattening the sampled distribution to accelerate barrier crossing predates metadynamics. Umbrella sampling [7] biases the system with harmonic restraints centered in overlapping windows and recombines the histograms via the weighted histogram analysis method (WHAM). Adaptive umbrella sampling iteratively refines the bias, and the Wang–Landau algorithm performs a random walk in energy space with a density-of-states estimate updated on the fly. Conformational flooding [Grubmüller, 1995] and local elevation [Huber *et al.*, 1994] introduced history-dependent repulsive potentials, but lacked a systematic route to quantitative free energies.

Metadynamics [1] synthesized these threads: the bias is built from Gaussian kernels deposited at the visited CV values, the deposition is continuous in time, and — crucially — the accumulated bias itself encodes the free energy. The original formulation suffered from a well-documented defect: because the Gaussian height is constant, the bias never converges but oscillates around the true free energy, and the simulation is pushed toward ever-higher free-energy regions, including unphysical ones. Well-tempered metadynamics (WTMetaD) [2] resolved this by making the deposition rate decay with the accumulated bias, introducing a *bias factor* $\gamma$ that interpolates between standard metadynamics ($\gamma \to \infty$) and unbiased sampling ($\gamma \to 1$), with asymptotic convergence proven in [8]. The conceptual breakthrough of Invernizzi and Parrinello [3] reframed the method in terms of *target probability distributions*: rather than constructing a bias, OPES estimates the unbiased CV distribution on the fly via kernel density estimation and applies the exact bias that would produce a chosen well-tempered target. Parallel developments attacked the CV problem itself: tICA-based selection [Sultan & Pande, 2017], variational selection via the VAC principle [McCarty & Parrinello, 2017], and finally deep learning approaches — Deep-LDA [5] and Deep-TICA [6] — that parametrize CVs as neural networks optimized for state discrimination or for slowness. For drug design, funnel metadynamics [4] confined the ligand with a funnel-shaped restraint, yielding absolute binding free energies in quantitative agreement with experiment. The modern review literature [7] and the PLUMED ecosystem consolidate these methods into production-grade tools.

---

## 3. Methodology

### 3.1 Standard metadynamics

Metadynamics augments the physical potential with a history-dependent bias acting only through the CVs:

$$V(\mathbf{s}, t) = \sum_{t' = \tau_G, 2\tau_G, \ldots}^{t' < t} w \, \exp\left(-\frac{|\mathbf{s} - \mathbf{s}(t')|^2}{2\sigma^2}\right),$$

where $w$ is the Gaussian height, $\sigma$ the width vector, and $\tau_G$ the deposition stride. The total potential $U(\mathbf{x}) + V(\mathbf{s}(\mathbf{x}), t)$ drives the system away from visited regions. Under the assumption that the CVs capture all slow modes and that the deposition is adiabatic (slow relative to CV relaxation), the bias converges in an average sense to the negative free energy:

$$\overline{V(\mathbf{s}, t)} \;\xrightarrow[t \to \infty]{}\; -F(\mathbf{s}) + C.$$

In practice the constant-height deposition causes persistent oscillations of order $w$ around $-F(\mathbf{s})$ and wasteful exploration of high-energy regions [2].

### 3.2 Well-tempered metadynamics

WTMetaD [2] rescales the deposited height by the bias accumulated so far:

$$w(t) = w_0 \exp\left(-\frac{V(\mathbf{s}(t), t)}{k_B \Delta T}\right),$$

where $\Delta T$ is a tempering parameter with dimensions of temperature. Defining the bias factor $\gamma = (T + \Delta T)/T$, the long-time limits are:

$$V(\mathbf{s}, t \to \infty) = -\frac{\Delta T}{T + \Delta T}\, F(\mathbf{s}) = -\left(1 - \frac{1}{\gamma}\right) F(\mathbf{s}),$$

and the CVs are sampled from the *well-tempered distribution*

$$p_{\text{WT}}(\mathbf{s}) \propto \exp\left(-\frac{F(\mathbf{s})}{k_B (T + \Delta T)}\right) = P(\mathbf{s})^{1/\gamma}.$$

> **Theorem:** (Dama, Parrinello & Voth [8]) In the limit of slow deposition and CVs spanning the slow manifold, the WTMetaD bias converges asymptotically to $-(1-1/\gamma)F(\mathbf{s})$, and the estimator $\hat{F}(\mathbf{s}) = -(\gamma/(\gamma-1))\, V(\mathbf{s}, t)$ is consistent with an error that decays as $1/\sqrt{t}$ up to logarithmic corrections.

The bias factor thus plays the role of a *computational temperature knob*: $\gamma = 1$ recovers unbiased sampling, while $\gamma \to \infty$ recovers standard metadynamics.

### 3.3 Reweighting: the Tiwary–Parrinello estimator

Because the bias is time-dependent, naive histograms of biased trajectories are incorrect. The asymptotically unbiased estimator [Tiwary & Parrinello, 2013] assigns to each frame a weight

$$w(t) \propto \exp\left\{\beta \left[V(\mathbf{s}(t), t) - c(t)\right]\right\},$$

where the time-dependent offset $c(t) = k_B T \ln \langle \exp(\beta V) \rangle$ normalizes the weights and is evaluated on the fly. Any observable $O(\mathbf{x})$ is then recovered as $\langle O \rangle = \sum_t w(t) O(t) / \sum_t w(t)$, enabling free energies along CVs *different* from those biased — a decisive advantage for analysis.

### 3.4 OPES: targeting probability distributions

OPES [3] inverts the perspective: choose a target distribution $p^{\text{tg}}(\mathbf{s})$ and apply, at iteration $n$, the bias that would generate it given the current best estimate $\hat{P}_n(\mathbf{s})$ of the unbiased CV distribution:

$$V_n(\mathbf{s}) = \frac{1}{\beta}\left(1 - \frac{1}{\gamma}\right) \ln\left(\frac{\hat{P}_n(\mathbf{s})}{Z_n} + \epsilon\right).$$

$\hat{P}_n$ is obtained by reweighted kernel density estimation with adaptive bandwidths, $Z_n$ normalizes over the explored domain, and $\epsilon$ regularizes unexplored regions. Variants include **OPES-Metad** (targeting the well-tempered distribution with quasi-static bias for free-energy convergence), **OPES-Explore** (estimating $\hat{P}_n$ from the *sampled* rather than reweighted distribution, yielding a more aggressive, exploration-oriented bias tolerant of suboptimal CVs), and **OPES-Expanded** (targeting sums of distributions to sample replica-exchange-like expanded ensembles in a single simulation) [Invernizzi, Piaggi & Parrinello, 2020].

### 3.5 Machine-learned collective variables

- **Deep-LDA** [5]: descriptors $\mathbf{d}(\mathbf{x})$ are passed through a neural network $\mathbf{h} = f_\theta(\mathbf{d})$; Fisher's linear discriminant analysis is applied in the latent space to maximize separation between predefined metastable states, with the LDA eigenvalue as the training objective. The resulting one-dimensional CV optimally discriminates states.
- **Deep-TICA** [6]: the network is trained to approximate the leading eigenfunctions of the Markov transfer operator by maximizing the VAMP-2 score on time-lagged covariances, yielding CVs that are maximally *slow* — the true reaction coordinates — without requiring state labels.
- Autoencoder and VAE-based CVs compress configurations into latent coordinates trained for reconstruction, providing nonlinear dimensionality reduction as a CV-discovery preprocessing step.

---

## 4. Deep Dive

### 4.1 Collective Variables and Free-Energy Surfaces

The CV is the lens through which the method perceives the system, and a poor lens guarantees failure regardless of algorithmic sophistication. Formally, $\mathbf{s}$ is adequate if the conditional distribution $p(\mathbf{x} \mid \mathbf{s})$ equilibrates rapidly for each $\mathbf{s}$ — the *adiabatic* or *slow-variable* hypothesis. When a hidden barrier exists orthogonal to $\mathbf{s}$, metadynamics exhibits hysteresis: the bias fills the apparent minimum, the system escapes along an uncontrolled orthogonal direction, and the reconstructed $F(\mathbf{s})$ depends on simulation history. Diagnostics include:

1. **Block averaging** of $F(\mathbf{s})$ estimates across trajectory segments — drift signals hidden variables.
2. **Committor analysis**: configurations at the apparent barrier top should commit to either basin with probability $\approx 1/2$; systematic deviation reveals a misidentified transition state.
3. **Cross-validation** across independent walkers (multiple-walker metadynamics) — inconsistent profiles flag CV inadequacy.

| CV class | Examples | Strengths | Failure mode |
|---|---|---|---|
| Geometric | distances, angles, dihedrals, RMSD, coordination numbers | Interpretable, cheap | Miss collective reorganizations |
| Path-based | path CVs $s(\mathbf{x}), z(\mathbf{x})$ | Encodes known mechanisms | Requires reference path |
| Spectral | tICA, Deep-TICA eigenfunctions | Maximally slow, data-driven | Needs converged dynamics data |
| Discriminative | Deep-LDA, SVM-based CVs | Separates known states | Overfits labels; blind to new states |

### 4.2 Well-Tempered Metadynamics: Convergence and Control

The decisive analytical advantage of WTMetaD is that the bias becomes *quasi-static*: because $w(t) \to 0$ as $V$ grows, deposition effectively ceases once the well-tempered distribution is achieved, and the remaining dynamics samples $p_{\text{WT}}$ nearly as an equilibrium ensemble. This unlocks standard equilibrium reweighting machinery and rigorous error analysis [8]. The practical protocol is:

1. Choose $\sigma$ comparable to the smallest CV fluctuation in a basin ($\sigma \approx 0.2$–$0.5$ times the basin width).
2. Set the initial height $w_0$ so that barrier crossing occurs within the affordable simulation time.
3. Select $\gamma$ from the expected barrier: $\gamma \approx \beta \Delta F^\ddagger / 3$ focuses sampling on the relevant free-energy range $F(\mathbf{s}) \lesssim k_B T \gamma \ln \gamma$.
4. Monitor convergence via the *free-energy difference* between basins as a function of simulation time; declare convergence when its running average stabilizes within the target tolerance (typically $< 1$ kcal/mol).

> **Theorem:** Under WTMetaD, the asymptotic bias fluctuation amplitude scales as $\sqrt{w_0 / \tau_G}$ times a $\gamma$-dependent prefactor, so accuracy and exploration rate are controlled by *independent* parameter groups — a separation absent in standard metadynamics [2, 8].

### 4.3 OPES and Recent Variants

OPES replaces the incremental Gaussian sum with direct density estimation, which confers three practical advantages: (i) the bias cannot grow without bound since it is a function of a normalized probability estimate; (ii) the method has few robust parameters — chiefly $\gamma$ and an estimate of the barrier height; (iii) reweighting is straightforward because the bias is quasi-static by construction [3]. OPES-Explore deliberately sacrifices asymptotic accuracy for robustness: by estimating $\hat{P}_n$ from the biased samples, it maintains a time-varying bias that keeps pushing even with degenerate CVs, making it the recommended default for exploratory studies [Invernizzi & Parrinello, 2022]. OPES-Expanded generalizes the target to $p^{\text{tg}} = \sum_\lambda p_\lambda / N_\lambda$, sampling multicanonical, multithermal, or multi-pressure ensembles — and umbrella-sampling windows — within one trajectory, with each configuration reweighted to any desired thermodynamic state. For kinetics, **OPES-Flooding** fills the reactant basin up to a prescribed threshold without touching the transition state, and the unbiased rate follows from the acceleration factor $\alpha = \langle e^{\beta V} \rangle$, generalizing infrequent metadynamics [Tiwary & Parrinello, 2013].

### 4.4 Machine-Learned Collective Variables: Deep-LDA and Deep-TICA

**Deep-LDA** [5] solves a supervised problem. Given labeled configurations from $K$ metastable states, descriptors $\mathbf{d}$ are mapped by a multilayer perceptron to a latent representation $\mathbf{h}$, and the Fisher criterion

$$\mathcal{L}(\theta) = \frac{\mathbf{w}^T S_b(\theta)\, \mathbf{w}}{\mathbf{w}^T S_w(\theta)\, \mathbf{w}}$$

is maximized, where $S_b$ and $S_w$ are the between-class and within-class scatter matrices in latent space and $\mathbf{w}$ is the LDA projection vector. The scalar CV $s = \mathbf{w}^T f_\theta(\mathbf{d})$ maximally separates the states while remaining a smooth, differentiable function of atomic coordinates — hence usable as a biasing CV in PLUMED via LibTorch. Applications include ion-pair dissociation and protein conformational switches.

**Deep-TICA** [6] solves an unsupervised, dynamical problem. For a lag time $\tau$, define the time-lagged covariance matrices $C(0) = \langle \mathbf{d}(t)\mathbf{d}(t)^T \rangle$ and $C(\tau) = \langle \mathbf{d}(t)\mathbf{d}(t+\tau)^T \rangle$. The transfer operator's eigenfunctions maximize the Rayleigh quotient; a neural network parametrizes candidate eigenfunctions and is trained by maximizing the VAMP-2 score $\sum_i \sigma_i^2$, the sum of squared singular values of $C(0)^{-1/2} C(\tau) C(0)^{-1/2}$ in feature space. The leading eigenfunctions are, by the variational approach to conformational dynamics, the slowest collective modes — the optimal reaction coordinates. Deep-TICA CVs have driven sampling of protein folding and crystallization where hand-crafted CVs failed.

```python
# Sketch: Deep-LDA CV training objective (Fisher discriminant in latent space)
import torch

def deep_lda_loss(H, labels, n_classes):
    # H: (N, d_latent) network outputs; labels: (N,) state indices
    Sb = torch.zeros(d_latent, d_latent)
    Sw = torch.zeros(d_latent, d_latent)
    mu = H.mean(dim=0)
    for k in range(n_classes):
        Hk = H[labels == k]
        muk = Hk.mean(dim=0)
        d = (muk - mu).unsqueeze(1)
        Sb += Hk.shape[0] * (d @ d.T)
        Sw += ((Hk - muk).T @ (Hk - muk))
    # maximize largest generalized eigenvalue of (Sb, Sw)
    eigvals = torch.linalg.eigvalsh(
        torch.linalg.solve(Sw + 1e-6 * torch.eye(d_latent), Sb))
    return -eigvals[-1]  # minimize negative top eigenvalue
```

A critical subtlety: discriminative CVs (Deep-LDA) separate *known* states but may collapse distinct transition pathways onto the same coordinate value, while spectral CVs (Deep-TICA) require time-correlated training data that already samples the slow transitions — a chicken-and-egg problem partially resolved by iterative schemes that alternate enhanced sampling with CV retraining.

---

## 5. Empirical Results and Formal Analysis

**Alanine dipeptide in vacuo and in water** remains the canonical benchmark. WTMetaD in the $(\phi, \psi)$ Ramachandran space with $\gamma = 6$–$10$ reproduces the $C_{7eq} \to C_{7ax}$ free-energy difference within $0.3$ kcal/mol of long unbiased reference simulations, with the error decaying as $t^{-1/2}$ after an initial transient [2, 8]. OPES achieves comparable accuracy with fewer parameter choices and converges the full 2D surface roughly twice as fast in wall-clock terms on identical hardware [3].

**Protein–ligand binding.** Funnel metadynamics on the benzamidine–trypsin complex [4] used a funnel-shaped restraint: a conical section guiding the ligand from bulk solvent into the binding pocket, narrowing to a cylindrical section of radius $R_{\text{cyl}}$ in the unbound region. The absolute binding free energy follows from the potential of mean force $W(z)$ along the funnel axis:

$$K_b = \pi R_{\text{cyl}}^2 \int_{\text{site}} dz\, e^{-\beta [W(z) - W_{\text{ref}}]}, \qquad \Delta G_b^\circ = -k_B T \ln(K_b C^\circ),$$

with $C^\circ = 1/1660$ Å$^{-3}$ the standard concentration. The computed $\Delta G_b^\circ = -8.5 \pm 0.7$ kcal/mol matched the experimental value within statistical error — a landmark demonstrating that enhanced sampling can deliver *absolute* binding affinities, not merely relative rankings.

**Kinetics from biased dynamics.** Infrequent metadynamics [Tiwary & Parrinello, 2013] deposits bias rarely enough that the transition-state region remains bias-free; the physical escape time is then $t^* = \sum \Delta t\, e^{\beta V(\mathbf{s}(t), t)}$, and a Kolmogorov–Smirnov test on the empirical escape-time distribution validates the Poisson assumption *a posteriori*. OPES-Flooding automates the basin-filling threshold, improving reliability for drug unbinding rates.

**Complexity scaling.** The cost of metadynamics grows with the CV-space volume to be filled: filling a $d$-dimensional region of linear size $L$ with Gaussians of width $\sigma$ requires $\mathcal{O}((L/\sigma)^d)$ depositions, each requiring a force evaluation on the bias — the curse of dimensionality that motivates low-dimensional, high-quality CVs and the parallel-bias / bias-exchange extensions for higher-dimensional problems.

---

## 6. Limitations and Open Problems

1. **Hidden barriers.** No biasing scheme can compensate for a CV that omits a slow degree of freedom; the method then converges to the free energy of a *wrong* projection, with hysteresis as the only symptom. Systematic detection of hidden variables from trajectory data alone remains unsolved.
2. **Deep-CV generalization.** Neural-network CVs trained on limited data extrapolate unpredictably outside the training distribution; a CV that is smooth on training configurations may develop spurious oscillations in newly explored regions, corrupting both the bias forces and the free-energy estimate. Regularization via physical priors (permutation invariance, smoothness penalties) is an active area.
3. **Kinetics rigor.** Infrequent metadynamics and OPES-Flooding rely on the *a posteriori* KS test; there is no *a priori* guarantee, and for systems with broad, diffusive barriers the "no bias on the transition state" condition is difficult to enforce.
4. **Parameter transferability.** While OPES reduced the parameter burden, the barrier-height estimate and $\gamma$ still require physical intuition; fully black-box enhanced sampling does not yet exist.
5. **Quantum and reactive extensions.** Combining metadynamics with ab initio MD (metadynamics-driven chemical reactions) faces the dual cost of electronic structure and long sampling times; machine-learned potentials paired with learned CVs are the emerging route but compound both methods' error sources.

## 7. Conclusion

Metadynamics has matured from an exploratory heuristic into a theoretically grounded, systematically improvable framework for rare-event sampling. Well-tempered metadynamics [2, 8] provided convergence and control; OPES [3] recast the algorithm around target probability distributions with superior robustness; funnel metadynamics [4] turned the method into a quantitative tool for drug binding affinities; and deep-learned CVs [5, 6] automate the most human-intensive step — identifying the slow coordinates themselves. The unifying principle across these advances is the interplay between *what* is sampled (the target distribution), *how* it is estimated (density estimation, variational principles, neural networks), and *how* unbiased truth is recovered (reweighting). The frontier now lies in closing the loop: iterative protocols in which sampling discovers states, learning discovers coordinates, and rigorous statistics certifies the result — moving enhanced sampling toward a self-driving methodology for molecular discovery.

## References

[1] Laio, A.; Parrinello, M. Escaping free-energy minima. *Proc. Natl. Acad. Sci. USA* **99**, 12562–12566 (2002). https://doi.org/10.1073/pnas.202427399

[2] Barducci, A.; Bussi, G.; Parrinello, M. Well-tempered metadynamics: a smoothly converging and tunable free-energy method. *Phys. Rev. Lett.* **100**, 020603 (2008). https://doi.org/10.1103/PhysRevLett.100.020603

[3] Invernizzi, M.; Parrinello, M. Rethinking metadynamics: from bias potentials to probability distributions. *J. Phys. Chem. Lett.* **11**, 2731–2736 (2020). https://doi.org/10.1021/acs.jpclett.0c00497

[4] Limongelli, V.; Bonomi, M.; Parrinello, M. Funnel metadynamics as accurate binding free-energy method. *Proc. Natl. Acad. Sci. USA* **110**, 6358–6363 (2013). https://doi.org/10.1073/pnas.1303186110

[5] Bonati, L.; Rizzi, V.; Parrinello, M. Data-driven collective variables for enhanced sampling. *J. Phys. Chem. Lett.* **11**, 2998–3004 (2020). https://doi.org/10.1021/acs.jpclett.0c00535

[6] Bonati, L.; Piccini, G.; Parrinello, M. Deep learning the slow modes for rare events sampling. *Proc. Natl. Acad. Sci. USA* **118**, e2113533118 (2021). https://doi.org/10.1073/pnas.2113533118

[7] Bussi, G.; Laio, A. Using metadynamics to explore complex free-energy landscapes. *Nature Rev. Phys.* **2**, 200–212 (2020). https://doi.org/10.1038/s42254-020-0153-0

[8] Dama, J. F.; Parrinello, M.; Voth, G. A. Well-tempered metadynamics converges asymptotically. *Phys. Rev. Lett.* **112**, 240602 (2014). https://doi.org/10.1103/PhysRevLett.112.240602

[9] Tiwary, P.; Parrinello, M. From metadynamics to dynamics. *Phys. Rev. Lett.* **111**, 230602 (2013). https://doi.org/10.1103/PhysRevLett.111.230602

[10] Invernizzi, M.; Parrinello, M. Exploration vs convergence speed in adaptive bias enhanced sampling. *J. Chem. Theory Comput.* **18**, 3988–3996 (2022). https://doi.org/10.1021/acs.jctc.2c00152


[1] Escaping free-energy minima — Proc. Natl. Acad. Sci. USA 99, 12562-12566 (2002). https://doi.org/10.1073/pnas.202427399
[2] Well-Tempered Metadynamics: A Smoothly Converging and Tunable Free-Energy Method — Phys. Rev. Lett. 100, 020603 (2008). https://doi.org/10.1103/PhysRevLett.100.020603
[3] Rethinking Metadynamics: From Bias Potentials to Probability Distributions — J. Phys. Chem. Lett. 11, 2731-2736 (2020). https://doi.org/10.1021/acs.jpclett.0c00497
[4] Funnel metadynamics as accurate binding free-energy method — Proc. Natl. Acad. Sci. USA 110, 6358-6363 (2013). https://doi.org/10.1073/pnas.1303186110
[5] Data-driven collective variables for enhanced sampling — J. Phys. Chem. Lett. 11, 2998-3004 (2020). https://doi.org/10.1021/acs.jpclett.0c00535
[6] Deep learning the slow modes for rare events sampling — Proc. Natl. Acad. Sci. USA 118, e2113533118 (2021). https://doi.org/10.1073/pnas.2113533118
[7] Using metadynamics to explore complex free-energy landscapes — Nature Rev. Phys. 2, 200-212 (2020). https://doi.org/10.1038/s42254-020-0153-0
[8] Well-tempered metadynamics converges asymptotically — Phys. Rev. Lett. 112, 240602 (2014). https://doi.org/10.1103/PhysRevLett.112.240602
[9] From metadynamics to dynamics — Phys. Rev. Lett. 111, 230602 (2013). https://doi.org/10.1103/PhysRevLett.111.230602
[10] Exploration vs convergence speed in adaptive bias enhanced sampling — J. Chem. Theory Comput. 18, 3988-3996 (2022). https://doi.org/10.1021/acs.jctc.2c00152
