---
id: ths_1788766157000_a4f2
title: "Closed-Loop Intracortical Brain–Computer Interfaces: Bayesian Neural Decoding with Kalman Filters and Recurrent Networks, Template-Based Spike Sorting with Kilosort, Bidirectional Intracortical Microstimulation, and Long-Term Signal Stability on Utah Arrays"
anon: anon#0506
ts: 1788766157000
tags: [Neuroengineering]
type: thesis
---

# Closed-Loop Intracortical Brain–Computer Interfaces: Bayesian Neural Decoding with Kalman Filters and Recurrent Networks, Template-Based Spike Sorting with Kilosort, Bidirectional Intracortical Microstimulation, and Long-Term Signal Stability on Utah Arrays

## Abstract

Closed-loop intracortical brain–computer interfaces (iBCIs) restore communication and movement to people with tetraplegia by recording single-neuron action potentials from motor cortex, decoding intended kinematics in real time, and returning somatosensory feedback through intracortical microstimulation (ICMS). This thesis unifies the closed-loop pipeline: (i) Bayesian neural decoding, from the steady-state Kalman filter [4] to recurrent networks that infer single-trial latent dynamics [7]; (ii) extracellular spike sorting, where template-matching frameworks such as Kilosort [5,6] assign overlapping waveforms to single units under probe drift; (iii) bidirectional interfaces that close the loop with patterned ICMS to somatosensory cortex; and (iv) long-term signal stability on Utah arrays. We formalize the observation model linking Poisson spiking to kinematics, prove steady-state Kalman gain convergence, derive the variational objective of sequential autoencoders, and review BrainGate trial results, including velocity-based Kalman decoding that outperformed position-based linear filters with fewer units [1] and stable cursor control 1000 days post-implant [3]. We close with fundamental limitations — nonstationarity, across-day decoding, charge-injection limits, and the observability gap — and chart a path toward autonomous, decade-stable closed-loop systems.

## 1 Introduction

The intracortical brain–computer interface converts the brain's most expressive control signals — the action potentials of cortical neuron ensembles — into commands for assistive devices, while writing information back through stimulation. Unlike non-invasive systems that contend with the skull's low-pass filtering, iBCIs sample extracellular voltages at kilohertz rates within micrometers of spiking somata, achieving information rates sufficient for high-performance cursor control and robotic manipulation [1,3].

The engineering problem decomposes into four interlocking subproblems. **Decoding** maps a stochastic, high-dimensional spike train observation to low-dimensional kinematic intent under strict latency budgets (typically 20–100 ms per update). **Spike sorting** assigns each detected waveform to its source neuron, a combinatorial assignment problem corrupted by electrode drift and overlapping spikes. **Bidirectional stimulation** must deliver charge-balanced microstimulation that evokes interpretable percepts without tissue damage or artifacts that blind the recording front end. **Long-term stability** demands that all of the above function as the electrode–tissue interface evolves over months and years, with units appearing, disappearing, and changing waveform morphology [3].

This thesis argues that these subproblems are one *closed-loop state-estimation* problem. The brain is a partially observed dynamical system; the decoder is a recursive Bayesian estimator; stimulation is a control input; and spike sorting is the measurement-assignment layer constructing the observation vector. We develop this view rigorously, from the linear-Gaussian foundations of the Kalman filter to nonlinear recurrent models, grounding every claim in the empirical record of human clinical trials.

> **Theorem (Informal):** *Under a linear-Gaussian tuning model with stationary noise covariances, the Kalman filter's error covariance converges to the unique stabilizing solution of the discrete algebraic Riccati equation, yielding a time-invariant steady-state decoder with identical asymptotic accuracy and an order-of-magnitude reduction in per-step computation [4].*

---

## 2 Background

### 2.1 The Utah array and the electrode–tissue interface

The Utah microelectrode array — a 10×10 grid of 1.0–1.5 mm silicon shanks on a 4×4 mm substrate — has been the workhorse of human intracortical recording since the BrainGate pilot trials [3]. Each electrode samples extracellular potentials from neurons within roughly 100–150 μm, band-passed (0.3–7.5 kHz) and digitized at 30 kS/s per channel. The chronic foreign-body response encapsulates shanks in glial scar, increasing impedance and attenuating spike amplitudes, yet decodable ensemble signals persist for *years*: Simeral et al. demonstrated point-and-click cursor control 1000 days after implantation [3].

Key terms: *single unit* (spike train of one neuron after sorting), *multi-unit activity (MUA)* (threshold crossings without assignment), *threshold crossing rate* (all supra-threshold events per bin), and *intracortical microstimulation (ICMS)* (biphasic current pulses, typically 20–100 μA, 200 μs/phase).

### 2.2 Tuning models and the linear decoder

Motor cortical neurons exhibit *directional tuning*: mean firing rate varies approximately cosinusoidally with intended movement direction [8]. The earliest BrainGate decoder exploited this with a position-based linear filter, regressing cursor position on a ~1 s history of binned firing rates [1]. Kim et al. showed that a **velocity-based Kalman filter** produced significantly straighter, smoother trajectories — with far fewer units (35 vs. 162 in one participant), because velocity tuning is more uniformly represented across the recorded population [1].

### 2.3 From linear to recurrent decoding

Linear-Gaussian models assume Gaussian firing-rate observations and linear dynamics. Real spike trains are point processes with Poisson-like statistics, and neural computation is intrinsically nonlinear and recurrent. Pandarinath et al. introduced **LFADS** (Latent Factor Analysis via Dynamical Systems), a sequential variational autoencoder that models observed spikes as Poisson emissions from rates generated by a recurrent generator network [7]. LFADS recovers single-trial latent dynamics — the low-dimensional manifold on which population activity evolves — substantially outperforming trial-averaged or linear methods in inferring firing rates.

---

## 3 Methodology

### 3.1 The decoding problem as recursive Bayesian estimation

Let $\mathbf{x}_t \in \mathbb{R}^d$ denote the kinematic state (e.g., cursor position and velocity) at time $t$, and $\mathbf{z}_t \in \mathbb{R}^N$ the vector of binned firing rates from $N$ units. We posit

```python
# Discrete-time linear Gaussian state-space model (Kalman formulation)
x_t = A @ x_{t-1} + w_t      # state transition,  w_t ~ N(0, Q)
z_t = C @ x_t     + v_t      # observation model, v_t ~ N(0, R)
```

where $A$ encodes kinematic smoothness, $C$ is the *tuning matrix* mapping kinematics to firing rates, and $Q, R$ are noise covariances fit from training data [4,8].

The Kalman recursion alternates prediction and update:

| Step | Equation |
|---|---|
| Predict mean | $\hat{\mathbf{x}}_{t\|t-1} = A\,\hat{\mathbf{x}}_{t-1\|t-1}$ |
| Predict covariance | $P_{t\|t-1} = A P_{t-1\|t-1} A^\top + Q$ |
| Kalman gain | $K_t = P_{t\|t-1} C^\top (C P_{t\|t-1} C^\top + R)^{-1}$ |
| Update mean | $\hat{\mathbf{x}}_{t\|t} = \hat{\mathbf{x}}_{t\|t-1} + K_t(\mathbf{z}_t - C\hat{\mathbf{x}}_{t\|t-1})$ |
| Update covariance | $P_{t\|t} = (I - K_t C)\,P_{t\|t-1}$ |

This recursion is the minimum-mean-square-error estimator for the linear-Gaussian system [4]. In practice, cursor velocity is integrated to position, with updates every 50–100 ms — comfortably within real-time budgets.

### 3.2 Steady-state Kalman filter

Malik et al. proved that under constant $(A, C, Q, R)$ the gain $K_t$ converges to a steady-state $K_\infty$ solving the discrete algebraic Riccati equation (DARE) [4]:

> **Theorem (Steady-State Convergence):** *If $(A, Q^{1/2})$ is stabilizable and $(A, C)$ is detectable, then $P_t \to P_\infty$, the unique positive-semidefinite stabilizing solution of $P = A P A^\top + Q - A P C^\top (C P C^\top + R)^{-1} C P A^\top$, and decoded trajectories achieve average correlation 0.99 with the full time-varying filter while per-step cost drops from $O(N^3)$ matrix inversions to a single matrix-vector product [4].*

The steady-state Kalman filter (SSKF) is therefore the deployment configuration of choice for implanted, power-constrained neural interfaces.

```rust
// Steady-state Kalman update: one matrix-vector product per 50 ms bin
fn sskf_update(x: &mut Vector, z: &Vector, k_inf: &Matrix, c: &Matrix) {
    let innovation = z - c * &*x;   // prediction error
    *x = &*x + k_inf * innovation;  // fixed-gain correction, O(N*d)
}
```

### 3.3 Spike sorting with Kilosort

Before decoding, raw voltages must be converted to unit spike trains. Kilosort models the recording as a sum of template waveforms triggered at spike times [5,6]:

$$\mathbf{V}(t) = \sum_{k=1}^{K}\sum_{j} a_{kj}\,\boldsymbol{\phi}_k(t - t_{kj}) + \boldsymbol{\eta}(t)$$

where $\boldsymbol{\phi}_k$ is the spatiotemporal template of unit $k$, $a_{kj}$ its amplitude at occurrence $j$, and $\boldsymbol{\eta}$ noise. The pipeline comprises:

1. **Preprocessing**: common-median referencing, high-pass filtering, and *drift estimation* — tracking slow probe motion that otherwise smears templates [6].
2. **Template learning**: greedy matching pursuit detects spikes and clusters spatiotemporal features; Kilosort4 uses graph-based clustering via modularity optimization plus a merging tree using refractory-period violations and projection bimodality [6].
3. **Deconvolution**: overlapping spikes ("collisions") are resolved by iterative template subtraction.
4. **Quality metrics**: refractory-period violations, amplitude cutoff, and drift stability gate which units enter the decoder.

On realistic nonstationary simulations, Kilosort4 correctly identified even low-amplitude units under high drift, outperforming all prior versions and competing sorters [6].

### 3.4 Recurrent decoding with LFADS

LFADS replaces the linear observation model with a generative model [7]:

$$\mathbf{g}_t = \text{RNN}_{\text{gen}}(\mathbf{g}_{t-1}, \mathbf{u}_t), \quad \mathbf{f}_t = W^{\text{fac}}\mathbf{g}_t, \quad \mathbf{r}_t = \exp(W^{\text{rate}}\mathbf{f}_t), \quad \mathbf{x}_t \sim \text{Poisson}(\mathbf{r}_t \Delta)$$

An encoder RNN infers the per-trial initial condition $\mathbf{g}_0$ (and optionally inferred inputs $\mathbf{u}_t$ via a controller), and the model is trained by maximizing the evidence lower bound (ELBO):

$$\mathcal{L} = \mathbb{E}_{q}[\log p(\mathbf{x}_{1:T} \mid \mathbf{g}_0, \mathbf{u}_{1:T})] - D_{\mathrm{KL}}(q(\mathbf{g}_0\mid\mathbf{x}) \,\|\, p(\mathbf{g}_0)) - D_{\mathrm{KL}}(q(\mathbf{u}\mid\mathbf{x}) \,\|\, p(\mathbf{u}))$$

For closed-loop decoding, the inferred rates $\mathbf{r}_t$ (or the latent factors $\mathbf{f}_t$) feed a linear readout to kinematics, combining the denoising power of the dynamical prior with the real-time simplicity of a linear map. Extensions perform *dynamic neural stitching* across sessions, learning one consistent dynamical model from non-overlapping recordings — a direct attack on the across-day stability problem [7].

### 3.5 Closing the loop: bidirectional ICMS

A *bidirectional* BCI writes as well as reads. Patterned ICMS to somatosensory cortex (S1) evokes tactile percepts whose intensity scales with pulse amplitude and frequency; in closed-loop grasp experiments, ICMS-derived force feedback improved prosthetic control and reduced visual dependence. The design problem is constrained:

- **Charge density** must remain below tissue-damage thresholds ($\approx 30\,\mu\mathrm{C/cm^2}$/phase for chronic safety margins).
- **Artifact blanking**: stimulation pulses saturate recording amplifiers for 1–5 ms; interleaved record/stimulate scheduling or artifact-subtraction preserves decoding.

The full closed loop — M1 decode → robotic actuation → tactile sensing → S1 ICMS → modulated neural state → M1 decode — is a *networked control system* with ~100 ms round-trip latency, and its stability margins are an active research frontier.

---

## 4 Deep Dive

### 4.1 Kalman Filter Decoding: From Wiener Filters to Steady-State Optimality

The linear filter used in early BrainGate sessions estimated each kinematic dimension independently from a 1 s firing-rate history via least squares [1]. The Kalman filter improves on this in three principled ways: it maintains an explicit *process model* of kinematics, it weights observations by reliability through $K_t$, and it propagates uncertainty $P_t$ so downstream logic (e.g., click-state classification) can be confidence-gated [2]. Empirically, velocity-Kalman trajectories were dramatically straighter than linear-filter trajectories, with target-acquisition success rising within identical 7 s timeouts [1].

The steady-state analysis of Malik et al. is the key deployment result [4]. Because the Riccati recursion is a contraction on the cone of positive-semidefinite matrices under stabilizability/detectability, $K_t \to K_\infty$ exponentially fast; human data showed the SSKF reproducing full-KF trajectories with mean correlation 0.99, including a 10-minute continuous closed-loop center-out task. The computational dividend is decisive for implants: replacing a per-step $N \times N$ inversion with a fixed gain matrix enables microwatt-scale ASIC decoders.

- **Bin size and lag**: 50–100 ms bins; optimal neural-to-kinematic lag (~100–150 ms) is fit per session.
- **Gain and bias tuning**: scalar speed gain and recentering bias calibrated in closed loop to trade speed against stability.
- **Hybrid kinematic/state filters**: Simeral et al. combined the Kalman velocity estimate with a discrete *click* classifier, resetting velocity on click detection and bounding position at screen edges — enabling full point-and-click desktop control 1000 days post-implant [3].

### 4.2 Recurrent Networks and Latent Dynamics: LFADS and Beyond

The Kalman filter's Achilles' heel is its Gaussian observation model: real spike counts in 20 ms bins are sparse, skewed, and Poisson-like, and the mapping from latent intent to spikes is nonlinear. LFADS confronts this by learning the *dynamical system itself* [7]. The generator RNN discovers rotational dynamics in motor cortex during reaching, and the inferred rates denoise single trials to near trial-averaged quality, rescuing precise timing information that averaging destroys.

For BCI, two properties are decisive. First, **causality**: closed-loop decoding cannot use future spikes, so the bidirectional encoder of offline LFADS is replaced by forward-only filtering variants at modest accuracy cost. Second, **stitching**: because units turn over across days, the decoder must map new observations into a stable latent space; dynamic neural stitching learns session-specific read-in matrices feeding a shared generator, so the latent dynamics — and the kinematic readout — persist while the electrode population churns [7].

### 4.3 Spike Sorting at Scale: Kilosort's Template-Matching Framework

Spike sorting is the measurement layer on which every decoder depends: a merged unit injects a phantom tuning direction; a split unit halves a neuron's apparent modulation depth. Kilosort's template-matching formulation [5,6] handles the three hard cases jointly: **overlaps** (matching pursuit with iterative subtraction resolves collisions), **drift** (Kilosort4 estimates rigid probe drift on a seconds timescale and shifts templates before matching [6]), and **scale** (GPU batch optimization sorts 384-channel data in approximately real time [5]).

For Utah arrays, the drift problem is milder but the *chronic* problem is harder: templates learned on day $d$ do not match day $d+30$. The practical resolution is two-tier: sort each session independently, then track units across days via waveform and tuning similarity — or skip hard assignment entirely and decode from threshold crossings, which the Kalman filter tolerates because $C$ and $R$ absorb the noisier observation statistics [1,4].

### 4.4 Bidirectional Interfaces: Writing Information with ICMS

Reading motor intent solves only half the prosthetic problem; without somatosensation, grasping is slow and error-prone. Bidirectional iBCIs close the loop by delivering ICMS to S1 in proportion to prosthetic fingertip forces, and participants can discriminate the evoked percepts by location and intensity. Three engineering tensions dominate: *selectivity vs. spread* (current spreads roughly as $1/r^2$; multi-electrode spatiotemporal patterns improve focality), *artifact vs. continuity* (blanking 2–5 ms around each pulse at 100–300 Hz can erase much of recording time; template-subtraction or interleaved scheduling preserves decoding), and *plasticity* (chronic ICMS reshapes cortical responses, requiring recalibration of the percept map).

The bidirectional loop also enables *co-adaptive* paradigms: the decoder adapts to the user (closed-loop decoder adaptation) while cortex adapts to the decoder and to ICMS feedback, jointly converging to a shared control manifold — the closest current realization of brain–machine symbiosis.

### 4.5 Long-Term Signal Stability on Utah Arrays

The chronic viability of iBCIs rests on a striking empirical fact: despite gliosis, micromotion, and unit turnover, *population-level* decodable information persists for years [3]. Stability is analyzed at three timescales:

| Timescale | Phenomenon | Mitigation |
|---|---|---|
| Seconds–minutes | Probe drift, state changes (arousal) | Drift correction in sorter [6]; adaptive bias |
| Hours–days | Unit dropout, impedance drift | Daily recalibration; CLDA |
| Months–years | Gliosis, array degradation | Population decoding; latent-space stitching [7] |

Simeral et al.'s 1000-day result is the landmark: with the hybrid Kalman/state decoder, a participant achieved reliable point-and-click control across five days spanning nearly three years post-implant, using units that were individually unstable but collectively sufficient [3]. The architectural lesson: *decode the population, not the neuron*. Fixed decoders with daily bias recalibration and latent-variable alignment now routinely hold performance across weeks, and the field's grand challenge is a decoder that never needs explicit recalibration.

---

## 5 Empirical Results and Proofs

The quantitative record:

1. **Velocity Kalman vs. position linear filter (human, 2 participants, 14 sessions)**: Kalman trajectories were significantly straighter and smoother; unit-count ratios (linear:Kalman) were 162:35 and 110:86, demonstrating superior *data efficiency* — fewer neurons needed for better control [1].
2. **Steady-state Kalman equivalence**: across six human sessions, SSKF vs. full KF state correlation averaged 0.99; a 10-minute continuous closed-loop center-out reconstruction was visually indistinguishable, confirming the predicted complexity reduction [4].
3. **1000-day point-and-click**: hybrid Kalman/state decoder over five days, with per-day calibration under 5 s [3].
4. **LFADS denoising**: on monkey M1/PMd reaching data (192–202 channels), LFADS-inferred single-trial rates matched trial-averaged quality and recovered rotational latent dynamics; dynamic stitching aligned non-overlapping recordings into one model [7].
5. **Kilosort4 benchmarks**: on realistic nonstationary simulations with high drift, Kilosort4 outperformed all prior versions and competing sorters, correctly identifying low-amplitude units — the population most vulnerable to chronic signal decay [6].
6. **Copilot-augmented decoding**: recent work combining deep feature extractors with Kalman filtering shows the filter's modularity — any improved observation front end slots into the same recursive Bayesian update [9].

*Proof sketch (SSKF convergence).* Define the Riccati map $\Phi(P) = A P A^\top + Q - A P C^\top(C P C^\top + R)^{-1} C P A^\top$. Under stabilizability of $(A, Q^{1/2})$ and detectability of $(A, C)$, $\Phi$ is a contraction in the Thompson metric on the positive-definite cone; by Banach's fixed-point theorem, iterates $P_{t+1} = \Phi(P_t)$ converge to the unique fixed point $P_\infty$, and $K_t \to P_\infty C^\top(C P_\infty C^\top + R)^{-1} = K_\infty$ [4].

*Proof sketch (LFADS ELBO).* Jensen's inequality applied to $\log p(\mathbf{x}) = \log \int p(\mathbf{x}\mid\mathbf{z})p(\mathbf{z})\,d\mathbf{z}$ with variational posterior $q(\mathbf{z}\mid\mathbf{x})$ yields the bound $\mathbb{E}_q[\log p(\mathbf{x}\mid\mathbf{z})] - D_{\mathrm{KL}}(q\|p)$, with $\mathbf{z} = (\mathbf{g}_0, \mathbf{u}_{1:T})$ and Poisson log-likelihood for spike counts [7].

---

## 6 Limitations

1. **Nonstationarity and the recalibration burden.** Tuning changes within and across days remain the dominant practical limitation; fully calibration-free decade-scale decoding is unproven in humans.
2. **The observability gap.** Cognitive variables (task context, attention, fatigue) modulate firing rates but are unmodeled, appearing as structured noise that no linear $R$ captures.
3. **Spike-sorting ground truth.** No human dataset has complete ground truth; Kilosort benchmarks rely on simulations [6] or juxtacellular validation, so reported accuracies are upper bounds.
4. **ICMS safety and naturalness.** Chronic charge-injection limits cap the bandwidth of artificial sensation; evoked percepts remain crude compared with natural touch, and long-term histological effects of years of daily ICMS in humans are still being characterized.
5. **Surgical and longevity risk.** Utah arrays are percutaneous in current trials (infection risk at the connector site); fully implantable wireless systems are in early human testing.
6. **Latency vs. accuracy trade-offs.** Recurrent decoders improve accuracy but add inference latency; the 20–100 ms closed-loop budget constrains model size, motivating steady-state and distilled-decoder designs [4].

---

## 7 Conclusion

Closed-loop intracortical BCIs have matured from laboratory demonstrations to multi-year clinical systems. The intellectual core is recursive Bayesian estimation: the Kalman filter — and its steady-state limit — provides the provably convergent, computationally minimal decoder [4]; recurrent sequential autoencoders extend the framework to nonlinear Poisson observations and cross-session stability [7]; template-matching spike sorters construct the observation vector under drift and overlap [5,6]; and bidirectional ICMS closes the sensorimotor loop that makes prosthetic control dexterous rather than merely possible. The empirical record — straighter trajectories with fewer units [1], 1000-day point-and-click control [3], drift-robust sorting [6] — supports a clear moral: *model the population dynamics, not the individual neuron, and let the estimator's uncertainty do the work that curation cannot*. The remaining challenges — calibration-free longevity, naturalistic sensation, fully implanted hardware — are substantial but well-posed, and the foundations surveyed here are the platform from which they will be solved.

---

## References

[1] S.-P. Kim, J. D. Simeral, L. R. Hochberg, J. P. Donoghue, and M. J. Black, "Neural control of computer cursor velocity by decoding motor cortical spiking activity in humans with tetraplegia," *Journal of Neural Engineering*, vol. 5, no. 4, pp. 455–476, 2008. [https://pmc.ncbi.nlm.nih.gov/articles/PMC2911243/](https://pmc.ncbi.nlm.nih.gov/articles/PMC2911243/)

[2] S.-P. Kim et al., "Point-and-click cursor control with an intracortical neural interface system in humans with tetraplegia," *IEEE Transactions on Neural Systems and Rehabilitation Engineering*, vol. 19, no. 2, pp. 193–203, 2011 (preprint). [https://cs.brown.edu/people/mjblack/Papers/kimJNE08preprint.pdf](https://cs.brown.edu/people/mjblack/Papers/kimJNE08preprint.pdf)

[3] J. D. Simeral, S.-P. Kim, M. J. Black, J. P. Donoghue, and L. R. Hochberg, "Neural control of cursor trajectory and click by a human with tetraplegia 1000 days after implant of an intracortical microelectrode array," *Journal of Neural Engineering*, vol. 8, no. 2, 025027, 2011. [https://pmc.ncbi.nlm.nih.gov/articles/PMC3715131/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3715131/)

[4] W. Q. Malik, W. Truccolo, E. N. Brown, and L. R. Hochberg, "Efficient decoding with steady-state Kalman filter in neural interface systems," *IEEE Transactions on Biomedical Engineering*, vol. 58, no. 1, pp. 25–34, 2011. [https://pmc.ncbi.nlm.nih.gov/articles/PMC3044609/](https://pmc.ncbi.nlm.nih.gov/articles/PMC3044609/)

[5] M. Pachitariu, N. A. Steinmetz, S. Kadir, M. Carandini, and K. D. Harris, "Kilosort: realtime spike-sorting for extracellular electrophysiology with hundreds of channels," *bioRxiv*, 061481, 2016. [https://www.biorxiv.org/content/10.1101/061481v1](https://www.biorxiv.org/content/10.1101/061481v1)

[6] M. Pachitariu, S. Sridhar, J. Pennington, and C. Stringer, "Spike sorting with Kilosort4," *Nature Methods*, vol. 21, pp. 914–921, 2024. [https://preview-www.nature.com/articles/s41592-024-02232-7.pdf](https://preview-www.nature.com/articles/s41592-024-02232-7.pdf)

[7] C. Pandarinath et al., "Inferring single-trial neural population dynamics using sequential auto-encoders," *Nature Methods*, vol. 15, no. 10, pp. 805–815, 2018. [https://pmc.ncbi.nlm.nih.gov/articles/PMC6380887/](https://pmc.ncbi.nlm.nih.gov/articles/PMC6380887/)

[8] A. G. Rouse and M. H. Schieber, "Human motor decoding from neural signals: a review," *Frontiers in Neuroscience*, 2020 (review of Kalman and nonlinear decoding formulations). [https://pmc.ncbi.nlm.nih.gov/articles/PMC7422484/](https://pmc.ncbi.nlm.nih.gov/articles/PMC7422484/)

[9] Non-invasive brain–machine interface control with artificial intelligence copilots: EEGNet feature extraction coupled to a seed Kalman filter for closed-loop sessions, *Frontiers in Neuroscience*, 2025. [https://pmc.ncbi.nlm.nih.gov/articles/PMC11482823/](https://pmc.ncbi.nlm.nih.gov/articles/PMC11482823/)
