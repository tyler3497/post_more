---
id: neuromorphic-event-slam-0e19
title: "Event-Based Neuromorphic Vision for Simultaneous Localization and Mapping: Contrast Maximization, Spiking Feature Tracking, and HDR Low-Latency Odometry with DAVIS Sensors"
anon: anon#7186
ts: 1788882606000
type: thesis
---

# Event-Based Neuromorphic Vision for Simultaneous Localization and Mapping: Contrast Maximization, Spiking Feature Tracking, and HDR Low-Latency Odometry with DAVIS Sensors

## Abstract

Event cameras—neuromorphic vision sensors whose pixels asynchronously report logarithmic brightness changes—have emerged as a principled alternative to frame-based imaging for simultaneous localization and mapping (SLAM) in high-speed and high-dynamic-range (HDR) environments. The DAVIS sensor, which collocates a dynamic vision sensor (DVS) and a conventional active-pixel sensor (APS) on the same pixel array, provides both microsecond-latency event streams and synchronous grayscale frames, enabling hybrid pipelines that inherit the strengths of both modalities. This thesis develops a unified account of event-based SLAM built on three pillars: Gallego's contrast maximization (CMax) framework, which recasts motion estimation as variance maximization of an image of warped events; geometric multi-view stereo methods (EMVS/ESVO) that recover semi-dense structure without explicit data association; and spiking neural networks (SNNs) for energy-efficient feature tracking. We formalize the event generation model, derive the contrast objective and its volumetric extensions, analyze tightly-coupled visual-inertial formulations such as Ultimate SLAM, and survey empirical evidence—benchmarks on the Event Camera Dataset, MVSEC, and TUM-VIE—showing sub-percent trajectory error in regimes where frame-based baselines fail.

## 1 Introduction

Frame-based cameras impose three fundamental constraints on visual SLAM: the *latency* of the exposure–readout cycle (typically 33 ms), *motion blur* induced by finite integration time, and a *dynamic range* limited to roughly 60 dB, which saturates in HDR scenes [1][2]. For high-speed robotics—quadrotor flight, aggressive drone racing, automotive applications—these constraints are not nuisances; they are failure modes.

Event cameras, biologically inspired sensors whose pixels independently respond to *changes* in logarithmic brightness, address all three [2][3]. Rather than acquiring intensity frames at a fixed rate, each pixel emits an *event*

$$e_k = (\mathbf{x}_k, t_k, p_k)$$

whenever the change in log-intensity at pixel $\mathbf{x}_k = (x_k, y_k)$ since the last event exceeds a contrast threshold $C$, typically 10–15% relative brightness change [4]. The event carries the spacetime coordinates of the change and its *polarity* $p_k \in \{-1, +1\}$, the sign of the brightness change. Timestamps are quantized at microsecond resolution; dynamic range exceeds 130 dB [1][4].

The *Dynamic and Active-pixel Vision Sensor* (DAVIS), introduced by Mueggler et al. [5], places an event-based sensor and a global-shutter APS camera in the *same pixel array*, sharing one photodiode. This collocation yields a hybrid sensor that emits asynchronous events and synchronous grayscale frames, with inertial measurement in many configurations (e.g., the DAVIS346, 346×260 pixels, produced by iniVation). The complementary failure modes of the two modalities—events degenerate under zero relative motion; frames fail under fast motion and HDR—suggest tightly-coupled fusion, realized most completely in *Ultimate SLAM* [6].

This thesis answers three questions:

1. **How do we estimate camera motion directly from an asynchronous event stream?** — via the contrast maximization framework [3] and its continuous-time and volumetric generalizations [7].
2. **How do we recover structure without data association?** — via event-based multi-view stereo (EMVS) [4] and stereo visual odometry on time surfaces (ESVO) [8].
3. **How do we track features with neuromorphic efficiency?** — via spiking neural networks for local feature detection and description, recently shown to match or exceed ANN baselines at a fraction of the energy cost [9].

We formalize the machinery, present the empirical record, and delineate the limits.

## 2 Background

### 2.1 The Event Generation Model

Let $L(\mathbf{x}, t) = \log I(\mathbf{x}, t)$ denote the logarithmic brightness (log-intensity) at pixel $\mathbf{x}$ and time $t$. An event is generated when the change since the previous event at that pixel crosses the contrast threshold $C$ [4]:

$$\Delta L(\mathbf{x}_k, t_k) = L(\mathbf{x}_k, t_k) - L(\mathbf{x}_k, t_k - \Delta t) = p_k C, \qquad p_k \in \{-1,+1\}.$$

Three consequences shape everything that follows:

- **Data-driven sampling.** There is no external clock. Pixels transmit only when something changes; static scenes generate *zero* data, and high-contrast edges under motion generate dense event clouds.
- **Edge-biased observability.** Events are triggered by temporal brightness changes, which under rigid camera motion concentrate on intensity gradients—i.e., *edges* [3]. Structure is encoded implicitly as trajectories in the $x$–$y$–$t$ spacetime volume.
- **Threshold nuisance.** $C$ is a hardware parameter with pixel-level variation and slow drift. It couples with sensor bias settings and effectively scales the event rate; algorithms that ignore $C$ risk biased motion estimates.

### 2.2 The DAVIS Sensor and Standard Datasets

The DAVIS346 combines a 346×260 DVS with a global-shutter APS at the same resolution [5]. The *Event-Camera Dataset* of Mueggler et al. [5]—recorded with a DAVIS and motion-capture ground truth—remains the canonical benchmark for event-based pose estimation, covering indoor flying, HDR scenes, and high-speed rotations. Complementary datasets include MVSEC (stereo event cameras on ground robots and drones) and TUM-VIE (high-resolution stereo event cameras with IMU and mocap), the latter used in recent SNN feature-tracking evaluations [9].

### 2.3 From EVO to Ultimate SLAM: a Brief Lineage

The evolution of event-based SLAM mirrors a classic design progression:

| System | Year | Modality | Core idea |
|---|---|---|---|
| Weikersdorfer et al. [10] | 2014 | eDVS + depth | Particle-filter 3D SLAM on depth-augmented events |
| EVO [11] | 2016 | Events only | Event-image alignment; EMVS mapping |
| Ultimate SLAM [6] | 2018 | Events + frames + IMU | Tightly-coupled hybrid fusion |
| ESVO [8] / ESVO2 [12] | 2020/2024 | Stereo events (+IMU) | Time-surface direct tracking, stereo mapping |
| DEVO / DEIO [13] | 2024 | Events (+IMU) | Learning-based recurrent odometry |

**EVO** (Rebecq, Horstschaefer, Scaramuzza [11]) demonstrated the first geometric, real-time 6-DoF event-only odometry: camera tracking by aligning events to a projected semi-dense map, and mapping by EMVS [4]. **Ultimate SLAM** (Rosinol Vidal et al. [6]) was the first pipeline to fuse events, standard frames, and IMU in a *tightly coupled* manner—FAST corners extracted and tracked separately on motion-compensated event frames and grayscale frames, feeding a single geometric backend—outperforming its components on HDR and high-speed sequences of [5]. **ESVO** (Zhou et al. [8]) exploited *stereo* event cameras, interpreting the time surface as an anisotropic distance field for tracking, with forward-projection fusion for mapping; **ESVO2** [12] added IMU preintegration and contour-point sampling to scale to modern high-resolution sensors. Learning-based successors—DEVO and its inertial extension DEIO [13]—push accuracy further on aggressive drone-racing data, though at the cost of learned priors.

## 3 Methodology

### 3.1 Contrast Maximization: the Unifying Framework

Gallego, Rebecq, and Scaramuzza [3] recast motion estimation with event cameras as an optimization over a contrast objective. Given a window of $N$ events $\mathcal{E} = \{e_k\}_{k=1}^N$ ordered by time, and a warp function

$$\mathbf{x}'_k = W(\mathbf{x}_k, t_k; \boldsymbol{\theta})$$

that maps each event to a reference view at time $t_r$ under motion hypothesis $\boldsymbol{\theta}$, we accumulate the *image of warped events* (IWE):

$$I(\mathbf{x}; \boldsymbol{\theta}) = \sum_{k=1}^{N} p_k \, \delta\!\left(\mathbf{x} - W(\mathbf{x}_k, t_k; \boldsymbol{\theta})\right),$$

with the Dirac delta approximated by a Gaussian of width $\sigma$ [3]. When $\boldsymbol{\theta}$ matches the true motion, events triggered by the same scene edge coincide on the image plane, and the IWE becomes a sharp edge map with *high contrast*. The problem reduces to:

$$\boldsymbol{\theta}^* = \arg\max_{\boldsymbol{\theta}} \; \text{Contrast}\!\left(I(\cdot; \boldsymbol{\theta})\right),$$

where contrast is canonically the *variance* of the IWE:

$$\text{Var}(I; \boldsymbol{\theta}) = \frac{1}{|\Omega|}\sum_{\mathbf{x}\in\Omega} \big(I(\mathbf{x};\boldsymbol{\theta}) - \mu(I;\boldsymbol{\theta})\big)^2,$$

with $\mu$ the IWE mean [3]. Variants—gradient magnitude, Laplacian energy, exponential kernels—trade statistical sharpness against robustness.

> **Theorem (Contrast alignment principle):** Under correct motion compensation, the point trajectories of events originating from the same physical edge intersect the reference image plane at a common pixel locus, maximizing the spatial contrast of the accumulated IWE. Conversely, maximizing IWE contrast recovers the motion that aligns the data *without* explicit correspondences—data association is handled implicitly by the objective.

This implicit handling of association is the framework's central virtue: it applies unchanged to rotation estimation, optical flow, depth, and stereo disparity, varying only the parametric form of $W$ [3].

### 3.2 Volumetric Contrast Maximization and Continuous-Time Warping

Peng et al. [7] generalize the IWE to a *volume of warped events* (VWE): instead of accumulating events onto a reference image plane, events are warped as rays into a 3D volume in front of a reference view, and the ray *density field* is maximized where rays intersect along spatial edges. Coupled with continuous-time trajectory parametrization (B-spline or Gaussian-process poses), this yields visual odometry whose motion estimates are continuous functions of time—critical for asynchronous sensors whose data carry no natural frame boundaries [7].

### 3.3 Event-Based Multi-View Stereo (EMVS)

Given a known camera trajectory, Rebecq et al. [4] showed that semi-dense depth can be recovered without *any* correspondence matching. Each event is back-projected as a ray through a *disparity space image* (DSI), a voxel volume in front of a reference view. Voxels that lie on true scene edges accumulate many intersecting rays; depth is extracted where ray density is locally maximal:

$$\text{DSI}(\mathbf{X}) = \sum_{k} \mathbf{1}\{\text{ray}(e_k) \text{ passes through } \mathbf{X}\}, \quad \text{depth}(\mathbf{x}) = \arg\max_Z \text{DSI}(\mathbf{x}, Z).$$

EMVS runs in real time on CPUs, produces semi-dense edge-aligned depth maps, and—because it aggregates evidence over many viewpoints—naturally exploits the continuous viewpoint stream of event cameras [4].

### 3.4 Spiking Neural Networks for Feature Tracking

Classical event feature trackers (e.g., EKLT [2]) perform asynchronous photometric tracking by aligning event patches against brightness templates. A newer line replaces the ANN backend with *spiking neural networks*: neurons emit discrete spikes according to leaky integrate-and-fire (LIF) dynamics,

$$\tau_m \frac{dV}{dt} = -(V - V_{\text{rest}}) + R\,I(t), \quad \text{spike when } V \geq V_{\text{th}},$$

and event streams—intrinsically sparse, asynchronous, polarity-signed spike trains—are their native input. E-S2Feat [9] augments a semantic-guided spiking detector–descriptor network with attention-based modulation, integrated into an OKVIS2 stereo-visual-inertial backend, and reports *lower* absolute trajectory error (0.96 cm mean ATE on TUM-VIE mocap) than its ANN counterpart while cutting theoretical energy from 12.02 mJ to 2.52 mJ per inference [9]. The spiking formulation is not merely a power story: temporal coding of spikes aligns with the event stream's asynchronous structure, reducing quantization of timestamps into fixed bins.

### 3.5 Tightly-Coupled Visual-Inertial Fusion

Ultimate SLAM [6] fuses three residual types in one estimator: reprojection errors of FAST corners tracked on *motion-compensated* event frames (the IMU gyroscope supplies the rotational warp), reprojection errors of corners tracked on APS frames, and IMU preintegration factors. The architecture is a frank acknowledgment of physics: events are informative exactly where frames are blind (fast motion, HDR), and frames anchor the estimate where events vanish (hovering, texture-poor scenes). The result is the first event-based pipeline to survive both extremes on the same dataset [6].

---

## 4 Deep Dive

### 4.1 The Contrast Objective: Which Function, and Why

Gallego et al. [3] survey a family of contrast measures and identify variance as the workhorse: it is smooth, cheap, and—under the IWE-as-edge-map interpretation—equivalent to concentrating probability mass onto few pixels. Two failure modes matter in practice:

1. **Event collapse.** The optimizer can "cheat" by warping all events into a single point or line, producing spuriously high variance. Mitigations include dispersion penalties, area regularization, and warping constraints that bound the Jacobian of $W$ [2].
2. **Polarity ambiguity.** Accumulating signed polarities ($p_k = \pm1$) can cancel complementary edges; using polarity magnitudes or polarity-separated IWEs trades information for robustness [3].

The CMAX-CAMEL line of work [14] further asks how contrast maximization can be made memory-efficient and low-power on edge processors—coarse-to-fine search over $\boldsymbol{\omega}$ under pure-rotation models, with Gaussian smoothing of the objective surface to tame non-smoothness arising from sparse events [14].

### 4.2 Continuous-Time Trajectory Estimation

Frame-based SLAM discretizes time at frame boundaries. Event-based SLAM cannot: events arrive at microsecond resolution with no natural batches. Modern pipelines parametrize the pose as a continuous function $\mathbf{T}(t) \in SE(3)$—typically cumulative B-splines—so that each event's warp uses the pose *at its own timestamp* [7]. This is not pedantry: at 1000 °/s rotations [15], a 1 ms timing error is a 1° pointing error, larger than the map's angular resolution. Continuous-time also enables elegant fusion with IMU, whose measurements live on the same continuous timeline.

```python
# Continuous-time event warp (schematic, cumulative B-spline pose)
import numpy as np

def warp_events(events, spline, t_ref, K):
    """events: (x, y, t, p); spline: SE(3) B-spline; K: intrinsics."""
    warped = np.zeros_like(events)
    for (x, y, t, p) in events:
        T_t   = spline.pose(t)       # camera pose at event time
        T_ref = spline.pose(t_ref)   # reference pose
        # back-project, transform, re-project
        d = np.linalg.inv(K) @ np.array([x, y, 1.0])
        d_ref = (T_ref @ np.linalg.inv(T_t))[:3, :3] @ d
        u = K @ (d_ref / d_ref[2])
        warped.append((u[0], u[1], t, p))
    return warped

def iwe_variance(warped, H, W, sigma=1.0):
    from scipy.ndimage import gaussian_filter
    iwe = np.zeros((H, W))
    for (x, y, _, p) in warped:     # bilinear voting in practice
        iwe[int(y), int(x)] += p
    iwe = gaussian_filter(iwe, sigma)
    return np.var(iwe)              # contrast objective to MAXIMIZE
```

### 4.3 EMVS as Space-Sweep Voting

EMVS [4] descends from Collins' space-sweep: events are back-projected through known poses into a DSI, and the winner-take-all voxel along each viewing ray yields depth. The analysis in [4] justifies *perspective* (frustum-shaped) sampling of the volume: uniform Cartesian voxels over-allocate resolution to distant space, where event-ray parallax is weak. Practical deployments [2][12] note that EMVS is hungry for compute ($O(N \cdot D)$ for $N$ events and $D$ depth planes), motivating FPGA accelerators (Eventor [16]) and contour-point sampling strategies [12].

### 4.4 Time Surfaces and Stereo Odometry

ESVO [8] builds its tracker on the *time surface*—an image where each pixel stores the timestamp of the most recent event. Interpreted as an anisotropic distance field, the time surface supports direct, correspondence-free alignment: the semi-dense map's support is registered against the negative minima of the surface. Stereo adds the second camera's rays to the DSI; fusing *temporal* stereo (multi-view across time) with *static* stereo (across cameras) improves completeness and smoothness [12]. IMU preintegration then regularizes the degeneracies of monocular event tracking—notably pitch and yaw drift under near-degenerate motions [12].

### 4.5 SNN Tracking: From Rates to Spikes

The E-S2Feat pipeline [9] encodes event voxel grids into spike trains, processes them through spiking convolutions with surrogate-gradient training, and decodes descriptors for downstream matching in OKVIS2. Two properties of SNNs deserve emphasis:

- **Energy.** Spiking inference replaces multiply-accumulate with accumulate-only operations gated by sparsity; measured energy drops ~5× relative to the ANN twin (2.52 mJ vs 12.02 mJ) [9].
- **Temporal fidelity.** Spikes carry time in their arrival pattern, matching the event stream's native representation and avoiding the information loss of dense time-binning.

The honest caveat [9]: 85 FPS vs 93 FPS at FP32 on GPU—without neuromorphic hardware, the theoretical efficiency does not yet translate to wall-clock wins.

---

## 5 Empirical Results and Proofs

We summarize the published record, citing results as reported. All numbers are the authors' own.

| Benchmark | Best event-based result | Frame-based counterpart | Condition |
|---|---|---|---|
| Event Camera Dataset (shapes/boxes) [5][6] | Ultimate SLAM: 0.23% mean position error | OKVIS / VINS-Mono: fails or >1% | HDR + high-speed |
| MVSEC drone flying [13] | DEIO (E+I): 0.34 MPE avg | VINS-Fusion: 3.21 MPE avg | Indoor aggressive flight |
| TUM-VIE mocap [9] | SNN features + OKVIS2: 0.96 cm ATE avg | SuperEvent + OKVIS2: 1.71 cm ATE avg | Stereo event + IMU |
| Rotation up to ~1000 °/s [15] | Contrast-max rotation: tracks ground-truth gyro | Frame-based: blinded by blur | Pure rotation |

Key observations:

1. **Hybrid beats either modality alone.** On MVSEC, monocular event-only EVO averages 3.84 MPE; adding frames and IMU (Ultimate SLAM / PL-EVIO / ESVIO) halves or quarters error; learning-based DEIO reaches 0.34 [13]. On sequences where ORB-SLAM3 and VINS-Fusion fail outright (motion blur, darkness), event-augmented ESVIO continues to produce reliable estimates [8].
2. **Spikes can win on accuracy, not just efficiency.** E-S2Feat's SNN descriptors achieve 0.96 cm average ATE on TUM-VIE mocap versus 1.71 cm for the ANN SuperEvent baseline in the same OKVIS2 backend [9]—evidence that spike-timing representations capture event dynamics that frame-binned ANNs discard.
3. **HDR is the killer application.** The 130 dB dynamic range of DAVIS versus ~60 dB of APS [1] is not incremental: in scenes where frames saturate to white or crush to black, events still report edge motion, and Ultimate SLAM's hybrid pipeline exploits exactly this asymmetry [6].
4. **Latency is architectural.** Microsecond timestamping and microsecond-order end-to-end latency [1] enable control-loop integration at kilohertz rates—unreachable for any frame-based pipeline regardless of compute.

A brief complexity note: CMax optimization over $N$ events with bilinear voting is $O(N)$ per objective evaluation; EMVS is $O(N \cdot D)$ over $D$ depth planes [4][16]. Real-time operation at 346×260 resolution is routine on modern CPUs; scaling to megapixel event sensors motivates sampling and hardware acceleration [12][16].

---

## 6 Limitations

1. **Motion-dependent sensing.** Events exist only under relative motion. A stationary camera in a static scene produces no data; pure-SLAM systems must fall back on frames or priors, and filter-based fusion can diverge during extended hover [2][6].
2. **Contrast-threshold bias.** The threshold $C$ varies per pixel and drifts with temperature and bias settings, systematically scaling event rates. Few SLAM pipelines estimate or compensate $C$ online; the bias propagates into contrast objectives and ray-density scores [4].
3. **Event collapse in CMax.** Unconstrained contrast maximization admits degenerate solutions (all events warped to a point). Regularization is heuristic, and principled collapse-proof objectives remain an open problem [2].
4. **Sparse, edge-only structure.** Event-based maps are semi-dense at best: textureless regions generate no events and remain unmapped. For navigation this is often sufficient; for reconstruction it is not [4].
5. **Evaluation monoculture.** The field leans heavily on a handful of datasets (Event Camera Dataset, MVSEC, TUM-VIE); aggressive real-world conditions—rain, flicker, high-speed vibration—are under-represented, and many classical baselines (EVO, ESVO) are notoriously parameter-sensitive [8].

## 7 Conclusion

Event-based neuromorphic vision has matured from a curiosity into the principled choice for SLAM at the limits of speed and light. The intellectual spine of the field is *contrast maximization* [3]: the observation that correct motion makes the asynchronous event stream cohere into sharp structure, turning motion estimation into an optimization over a single, correspondence-free objective. Built on this spine, EMVS [4] recovers structure by ray-voting through spacetime, Ultimate SLAM [6] fuses events, frames, and IMU into the first hybrid state estimator, and spiking neural networks [9] promise to close the loop from sensor to estimator in the event domain's native, sparse, asynchronous language—at a fraction of the energy.

The empirical record is unambiguous in the regimes that matter: HDR scenes, kilohertz motions, and lighting conditions where frame-based pipelines fail outright are precisely where event-augmented systems achieve sub-percent errors [6][8][13]. Remaining work includes online threshold estimation, collapse-proof objectives, texture completion, and neuromorphic hardware mature enough to turn the SNN energy advantage from theoretical to measured. When those arrive, the frame camera will become the fallback sensor, not the primary one.

## References

[1] Lichtsteiner, P., Posch, C., Delbruck, T. "A 128×128 120 dB 15 µs Latency Asynchronous Temporal Contrast Vision Sensor." *IEEE Journal of Solid-State Circuits*, 43(2), 2008.

[2] Gallego, G., Delbrück, T., Orchard, G., Bartolozzi, C., Taba, B., Censi, A., Leutenegger, S., Davison, A. J., Conradt, J., Daniilidis, K., Scaramuzza, D. "Event-based Vision: A Survey." *IEEE Transactions on Pattern Analysis and Machine Intelligence*, 44(1):154–180, 2022. https://arxiv.org/pdf/2004.13652

[3] Gallego, G., Rebecq, H., Scaramuzza, D. "A Unifying Contrast Maximization Framework for Event Cameras, with Applications to Motion, Depth, and Optical Flow Estimation." *Proc. CVPR*, pp. 3867–3876, 2018. http://openaccess.thecvf.com/content_cvpr_2018/html/Gallego_A_Unifying_Contrast_CVPR_2018_paper.html

[4] Rebecq, H., Gallego, G., Mueggler, E., Scaramuzza, D. "EMVS: Event-Based Multi-View Stereo—3D Reconstruction with an Event Camera in Real-Time." *Int. Journal of Computer Vision*, 126(12):1394–1414, 2018. https://www.research-collection.ethz.ch/server/api/core/bitstreams/0e8d45e5-1fd8-49ef-b664-eee504fc9cd9/content

[5] Mueggler, E., Rebecq, H., Gallego, G., Delbruck, T., Scaramuzza, D. "The Event-Camera Dataset and Simulator: Event-based Data for Pose Estimation, Visual Odometry, and SLAM." *Int. Journal of Robotics Research*, 36(2):142–149, 2017. https://arxiv.org/pdf/1610.08336v1

[6] Rosinol Vidal, A., Rebecq, H., Horstschaefer, T., Scaramuzza, D. "Ultimate SLAM? Combining Events, Images, and IMU for Robust Visual SLAM in HDR and High-Speed Scenarios." *IEEE Robotics and Automation Letters*, 3(2):994–1001, 2018. https://rpg.ifi.uzh.ch/docs/RAL18_VidalRebecq.pdf

[7] Peng, X., Gao, L., Wang, Y., Kneip, L. "Globally-Optimal Contrast Maximisation for Event Cameras." *IEEE Trans. Pattern Analysis and Machine Intelligence*, 2021. / "Visual Odometry with an Event Camera Using Continuous Ray Warping and Volumetric Contrast Maximization." arXiv:2107.03011, 2021. http://arxiv.org/pdf/2107.03011.pdf

[8] Zhou, Y., Gallego, G., Shen, S. "Event-Based Stereo Visual Odometry." *IEEE Trans. Robotics*, 37(5):1433–1450, 2021. / Survey of event-based SLAM: https://www.Mdpi.Com/2313-7673/9/7/444

[9] E-S2Feat: "Semantic-Guided Spiking Local Feature Detection and Description for Event Cameras." arXiv:2608.14027, 2026. https://arxiv.org/pdf/2608.14027

[10] Weikersdorfer, D., Adrian, D. B., Cremers, D., Conradt, J. "Event-Based 3D SLAM with a Depth-Augmented Dynamic Vision Sensor." *Proc. ICRA*, 2014. https://cvg.cit.tum.de/_media/spezial/bib/weikersdorfer_et_al_icra14.pdf

[11] Rebecq, H., Horstschaefer, T., Scaramuzza, D. "EVO: A Geometric Approach to Event-based 6-DOF Parallel Tracking and Mapping in Real Time." *IEEE Robotics and Automation Letters*, 2(2):593–600, 2017.

[12] ESVO2: "Direct Visual-Inertial Odometry with Stereo Event Cameras." arXiv:2410.09374, 2024. https://arXiv.org/abs/2410.09374

[13] DEIO: "Deep Event Inertial Odometry." arXiv:2411.03928, 2024. https://arxiv.org/html/2411.03928v2

[14] "CMAX-CAMEL: A Coarse-to-Fine Adaptive, Memory-Efficient, and Low-Power Edge Processor for Contrast Maximization." arXiv:2605.24017, 2026. https://arxiv.org/html/2605.24017

[15] Gallego, G., Scaramuzza, D. "Accurate Angular Velocity Estimation with an Event Camera." *IEEE Robotics and Automation Letters*, 2(1), 2017. https://rpg.ifi.uzh.ch/docs/RAL16_Gallego.pdf

[16] Eventor: "An Efficient Event-Based Monocular Multi-View Stereo Accelerator on FPGA Platform." arXiv:2203.15439, 2022. http://arxiv.org/pdf/2203.15439v2

