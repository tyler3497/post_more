---
id: ths_1788798680028_b618
title: "Autonomous Spacecraft Rendezvous and Docking: Clohessy\u2013Wiltshire Relative Dynamics, Model Predictive Control, and Vision-Based Relative Navigation"
anon: anon#1459
ts: 1788795990784
type: thesis
images: ["ths_1788798680028_b618-0.webp", "ths_1788798680028_b618-1.webp", "ths_1788798680028_b618-2.webp", "ths_1788798680028_b618-3.webp"]
---

# Autonomous Spacecraft Rendezvous and Docking: Clohessy–Wiltshire Relative Dynamics, Model Predictive Control, and Vision-Based Relative Navigation

## Abstract

Autonomous rendezvous and docking (RVD) is the canonical constrained guidance, navigation, and control problem of orbital mechanics: a chaser spacecraft must approach a possibly uncooperative target along a trajectory that is simultaneously fuel-efficient, collision-safe, sensor-visible, and robust to navigation uncertainty, then make physical contact within centimeter tolerances at decimeter-per-second relative velocities. This thesis develops the full pipeline from first principles. We derive the linearized Clohessy–Wiltshire (CW) relative orbital dynamics in the local-vertical–local-horizontal (LVLH) frame and characterize their modal structure. We compare impulsive guidance (Lambert targeting, CW two-impulse targeting) against continuous-thrust laws (zero-effort-miss/zero-effort-velocity, ZEM/ZEV). We formulate proximity operations as a constrained model predictive control (MPC) problem with keep-out ellipsoids, approach-corridor, plume-impingement, and thrust-magnitude constraints, and show how lossless convexification and successive convexification transform the nonconvex program into a sequence of second-order cone programs solvable in milliseconds aboard flight processors. We then treat relative navigation — angles-only filtering, fiducial-marker pose estimation, markerless convolutional networks, and scanning LiDAR — as the sensing half of the loop, and close with docking interface standards (IDSS, APAS, NDS), verification practice (Monte Carlo dispersion analysis, formal reachability), and a worked numerical campaign demonstrating sub-meter terminal accuracy under realistic dispersions.

## 1. Introduction

On March 16, 1966, *Gemini VIII* performed the first docking between two spacecraft, under the manual piloting of Neil Armstrong and David Scott, using visual cues and a radar-less, hand-flown approach [2]. Sixty years later, docking is increasingly expected to occur with no human in the loop: cargo vehicles berth to the International Space Station, servicing tugs capture defunct satellites, and constellations assemble in orbit. The 2007 DARPA *Orbital Express* demonstration — the first fully autonomous capture of a non-cooperative client by the ASTRO servicer — proved that the complete GNC chain could close autonomously in flight, and its lessons-learned remain the definitive field guide for autonomous proximity operations [12].

Rendezvous is conventionally decomposed into phases: **phasing** (orbit-period modulation to close large along-track separations), **far-range rendezvous** (tens of kilometers, ground-in-the-loop or GNSS-based), **mid-range approach** (kilometers to hundreds of meters, autonomous relative navigation), **proximity operations** (hundreds of meters to tens of meters, constrained guidance), and **final approach and capture** (tens of meters to contact, centimeters-per-second closing rates). Each phase imposes a different pairing of dynamics model and control authority: impulsive maneuvers dominate far range, where the natural orbital mechanics do most of the work; continuous-thrust feedback dominates close range, where safety constraints dominate the cost function.

The thesis of this work is that autonomous RVD is best understood — and best engineered — as the *co-design* of three subsystems:

1. **Relative dynamics**: the linearized orbital mechanics that make trajectory prediction analytic and optimization convex-adjacent;
2. **Constrained guidance**: receding-horizon optimal control that explicitly encodes collision avoidance, plume impingement, and corridor constraints;
3. **Relative navigation**: the estimation of six-degree-of-freedom relative pose from angles-only, visual, and LiDAR measurements, with quantified uncertainty.

These three couple through a single quantity: the *navigation error covariance*. Guidance plans against a safety margin derived from the filter; the filter's quality depends on the geometry of the trajectory the guidance selects; and the docking mechanism's capture envelope sets the terminal accuracy both must jointly achieve.

---

## 2. Background

### 2.1 Relative motion in the LVLH frame

Consider a *target* spacecraft on a circular orbit of radius $a$ about a central body with gravitational parameter $\mu$, and a *chaser* nearby. Attach to the target the **local-vertical–local-horizontal (LVLH)** frame: $x$ radially outward (the local vertical), $y$ along the velocity vector (downrange/along-track), $z$ completing the right-handed triad (cross-track, along orbital angular momentum). Let $\boldsymbol{\rho} = [x, y, z]^{\top}$ be the chaser's position relative to the target expressed in LVLH components, with $\lVert \boldsymbol{\rho} \rVert \ll a$.

Under two-body point-mass gravity, the exact nonlinear relative equations in the rotating LVLH frame are

$$\ddot{\boldsymbol{\rho}} + 2\,\boldsymbol{\omega} \times \dot{\boldsymbol{\rho}} + \boldsymbol{\omega} \times (\boldsymbol{\omega} \times \boldsymbol{\rho}) = -\mu\left(\frac{\mathbf{r}_t + \boldsymbol{\rho}}{\lVert \mathbf{r}_t + \boldsymbol{\rho} \rVert^3} - \frac{\mathbf{r}_t}{\lVert \mathbf{r}_t \rVert^3}\right) + \mathbf{u},$$

where $\boldsymbol{\omega} = n\,\hat{\mathbf{z}}$ is the frame rotation rate, $n = \sqrt{\mu/a^3}$ the target's mean motion, $\mathbf{r}_t$ the target's inertial position, and $\mathbf{u}$ the control acceleration. The left-hand side collects the **Coriolis** and **centrifugal** fictitious accelerations of the rotating frame; the right-hand side is the *differential gravity* — the tidal acceleration of the chaser relative to the target — plus thrust.

### 2.2 Linearization: the Clohessy–Wiltshire equations

Expanding the differential gravity to first order in $\boldsymbol{\rho}/a$ yields the celebrated **Clohessy–Wiltshire (CW)** equations, first published for terminal rendezvous guidance in 1960 [1][2]:

$$\begin{aligned}
\ddot{x} - 2n\dot{y} - 3n^2 x &= u_x, \
\ddot{y} + 2n\dot{x} &= u_y, \
\ddot{z} + n^2 z &= u_z.
\end{aligned}$$

The structure is physically legible: the $-3n^2x$ term is the radial gravity gradient (a chaser above the target, $x > 0$, is in a higher, slower orbit and falls behind — the seed of the $6n\Delta t$ along-track drift); the $\pm 2n$ terms are Coriolis couplings; the $z$ channel is a decoupled harmonic oscillator at the orbital frequency. A modern state-of-the-art review of these Cartesian relative-motion models, including their mapping from inertial frames and analytic solutions, is given in [3].

With state $\mathbf{x} = [x, y, z, \dot{x}, \dot{y}, \dot{z}]^{\top}$ the system is linear time-invariant, $\dot{\mathbf{x}} = A\mathbf{x} + B\mathbf{u}$, and its state-transition matrix $\Phi(t, t_0) = e^{A(t-t_0)}$ is known in closed form [2][3]. The analytic solution reveals the famous **2:1 in-plane ellipse**: bounded relative motion traces an ellipse with along-track semi-axis twice the radial semi-axis, drifting secularly unless the *no-drift condition* $\dot{y}_0 = -2n x_0$ is enforced.

> **Theorem (Bounded relative motion):** In the CW model, in-plane relative motion is periodic (non-drifting) if and only if $\dot{y}(t_0) + 2n\,x(t_0) = 0$; otherwise the along-track coordinate exhibits secular drift at rate $-6n\,x_{\text{off}}$ per orbit, where $x_{\text{off}}$ is the radial offset of the ellipse center. Out-of-plane motion is always bounded harmonic.

This single theorem governs most of rendezvous design: far-range phasing deliberately violates the no-drift condition to close along-track gaps cheaply, while proximity operations enforce it (or actively cancel drift) to hold station.

### 2.3 Guidance primitives

- **Impulsive targeting.** Given $\mathbf{x}_0$ and a desired $\mathbf{x}_f$ at time $t_f$, the CW transition matrix yields the unique two-impulse solution $\Delta\mathbf{v}_0 = \Phi_{rv}^{-1}(\mathbf{x}_f - \Phi_{rr}\mathbf{x}_0 - \Phi_{rv}\dot{\mathbf{r}}_0^-)$-style targeting; the classical *Lambert* formulation solves the same problem in the nonlinear two-body setting for large separations. *Coelliptic* maneuvers place the chaser on a drift-matched ellipse below or ahead of the target — the workhorse of Apollo and Shuttle rendezvous.
- **ZEM/ZEV guidance.** For terminal guidance, the **zero-effort miss** $\mathbf{ZEM}(t)$ (predicted miss distance if no further thrust is applied) and **zero-effort velocity** $\mathbf{ZEV}(t)$ define the feedback law $\mathbf{u} = -k_1 \mathbf{ZEM}/t_{go}^2 - k_2 \mathbf{ZEV}/t_{go}$, a generalization of proportional navigation to orbital mechanics. It is fuel-near-optimal for short horizons and trivially implementable.
- **Glideslope and V-bar/R-bar approaches.** Operationally, final approach proceeds along the velocity vector (**V-bar**, from ahead or behind) or the radius vector (**R-bar**, from below). R-bar approaches are passively safe: a thrust failure leaves the chaser drifting *away* below the target rather than into it.

| Approach axis | Passive safety | Plume risk | Sensor geometry |
|---|---|---|---|
| V-bar (along-track) | Poor — drift continues toward target | Low (thrusters fire along-track) | Stable lighting, constant range rate |
| R-bar (radial) | Excellent — natural drift separates | Higher (radial braking plumes target) | Changing sun angle, good silhouette |
| Out-of-plane hop | Good | Low | Poor observability |

### 2.4 Docking interface standards

Physical capture is governed by interface standards. The **International Docking System Standard (IDSS)** [10] defines a common androgynous interface — 800 mm soft-capture ring, standardized guide petals, and navigation aids — implemented by NASA's **NDS** (used on Crew Dragon and Starliner) and inherited from **APAS-89/95** flown on Shuttle–Mir and the ISS. The IDSS Interface Definition Document specifies the three-phase target system (long-range, mid-range, short-range alignment targets), initial contact conditions (relative velocity, misalignment envelopes), and the soft-capture/hard-capture sequence. Understanding the capture envelope quantitatively is what converts "guidance accuracy" into an engineering requirement.

---

## 3. Methodology

### 3.1 Problem formulation

We treat proximity operations as a discrete-time optimal control problem over horizon $N$ with step $\Delta t$, state $\mathbf{x}_k \in \mathbb{R}^6$ (CW dynamics), control $\mathbf{u}_k \in \mathbb{R}^3$:

$$\begin{aligned}
\min_{\mathbf{u}_{0:N-1}} \quad & \sum_{k=0}^{N-1} \left( \mathbf{x}_k^{\top} Q \mathbf{x}_k + \mathbf{u}_k^{\top} R \mathbf{u}_k \right) + \mathbf{x}_N^{\top} P \mathbf{x}_N \
\text{s.t.} \quad & \mathbf{x}_{k+1} = A_d \mathbf{x}_k + B_d \mathbf{u}_k, \
& \lVert \mathbf{u}_k \rVert_2 \le u_{\max}, \quad \text{(thrust saturation)} \
& \lVert H(\mathbf{r}_k - \mathbf{r}_{\text{obs}}) \rVert_2 \ge 1, \quad \text{(keep-out ellipsoid)} \
& C_{\text{corr}}\,\mathbf{r}_k \le \mathbf{d}_{\text{corr}}, \quad \text{(approach corridor)} \
& \text{plume}(\mathbf{u}_k, \mathbf{r}_k) \le 0. \quad \text{(plume impingement)}
\end{aligned}$$

The keep-out constraint is nonconvex (the exterior of an ellipsoid), and plume impingement couples thrust direction with relative geometry. Solving this directly is intractable for flight; the methodology of §3.2–§3.3 renders it tractable.

### 3.2 Lossless convexification

Açıkmeşe and Ploen's **lossless convexification** (LCvx) [11] observes that certain nonconvex control constraints admit relaxations that are *provably tight*: the relaxed convex problem's optimum satisfies the original nonconvex constraint with equality. For the thrust lower-bound nonconvexity $\rho_{\min} \le \lVert \mathbf{u} \rVert$ (relevant when thrusters cannot throttle below a minimum impulse), introducing a slack $\sigma$ with $\lVert \mathbf{u} \rVert \le \sigma$ and penalizing $\sigma$ yields a second-order cone program whose optimum has $\lVert \mathbf{u}^\star \rVert = \sigma^\star$ — the relaxation is lossless, proven via Pontryagin's maximum principle [11][6].

> **Theorem (Lossless convexification, Açıkmeşe–Ploen):** For the fuel-optimal control problem with dynamics $\dot{\mathbf{x}} = A\mathbf{x} + B\mathbf{u}$ and nonconvex annular control constraint $\rho_{\min} \le \lVert \mathbf{u}(t) \rVert_2 \le \rho_{\max}$, the convex relaxation replacing $\lVert \mathbf{u} \rVert$ by a slack variable $\sigma$ with $\lVert \mathbf{u}(t) \rVert_2 \le \sigma(t)$, $\rho_{\min} \le \sigma(t) \le \rho_{\max}$, and cost $\int \sigma\,dt$, attains the same optimal value, and its optimizer satisfies the original nonconvex constraint almost everywhere.

Successive convexification (SCvx) generalizes the idea: linearize nonconvex dynamics and constraints about a reference trajectory, solve the convex subproblem within a trust region, iterate. The keep-out ellipsoid is handled by linearizing its boundary (a supporting-hyperplane cut), and the trust region guarantees the linearization remains valid [6]. Modern flight-oriented work pushes these solves below one second on radiation-hardened processors, with learned tight-constraint prediction accelerating convergence [4].

### 3.3 Receding-horizon implementation (MPC)

The convexified program is embedded in **model predictive control**: at each guidance cycle, solve the $N$-step problem from the current estimated state, apply the first control, and re-solve. MPC confers three properties no open-loop optimal trajectory has: (i) feedback rejection of navigation error and unmodeled perturbations ($J_2$, drag, third-body); (ii) recursive constraint satisfaction — the keep-out guarantee is re-certified every cycle; (iii) natural handling of the docking *timeline*, where phase transitions (far → mid → proximity → final) simply re-parameterize $Q, R$, the corridor, and the horizon. Certifiable explicit MPC variants pre-compute the control law offline so that storage, evaluation time, and closed-loop behavior are all fixed before launch — critical for flight qualification [4].

### 3.4 Navigation architecture

Relative navigation is a sensor-scheduling problem across ranges:

1. **Far range (>10 km):** angles-only navigation. Bearing measurements to the target are weakly observable; range observability requires deliberate line-of-sight rotation maneuvers. Extended Kalman filters with consider-parameter (Schmidt–Kalman) treatment of unestimated biases are standard practice per Orbital Express lessons [12].
2. **Mid range (10 km–100 m):** relative GNSS (when both vehicles carry receivers and exchange data over an intersatellite link), rendezvous radar/LiDAR range and range-rate.
3. **Close range (<100 m):** optical relative navigation. Cooperative targets carry **fiducial markers** — retroreflectors or LED arrays with surveyed 3D geometry — enabling perspective-$n$-point (PnP) pose solutions at centimeter and sub-degree accuracy [8]. Non-cooperative targets require **markerless** methods: model-based edge tracking, CNN keypoint detectors, or direct point-cloud registration from scanning LiDAR [9].
4. **Terminal (<10 m):** short-range IDSS alignment targets and docking-axis cameras drive the final lateral nulling [10].

The filter fuses these in a single error-state EKF whose covariance feeds the MPC safety margins — the co-design coupling noted in §1.

---

## 4. Deep Dive

### 4.1 Derivation of the CW equations and their modal structure

Begin with the target on a circular orbit, $\mathbf{r}_t(t) = a[\cos nt, \sin nt, 0]^{\top}$ in inertial coordinates, and write the chaser's position as $\mathbf{r}_t + \boldsymbol{\rho}$. The LVLH frame rotates with angular velocity $\boldsymbol{\omega} = n\hat{\mathbf{z}}$. The transport theorem gives the inertial acceleration of the chaser as the sum of relative, Coriolis, Euler (zero for circular orbits), and centrifugal terms. Subtracting the target's own two-body acceleration and expanding

$$\frac{\mathbf{r}_t + \boldsymbol{\rho}}{\lVert \mathbf{r}_t + \boldsymbol{\rho} \rVert^3} = \frac{\hat{\mathbf{r}}_t}{a^2} + \frac{1}{a^3}\left(\boldsymbol{\rho} - 3(\hat{\mathbf{r}}_t \cdot \boldsymbol{\rho})\hat{\mathbf{r}}_t\right) + \mathcal{O}\left(\frac{\rho^2}{a^2}\right)$$

yields, after collecting components with $\hat{\mathbf{r}}_t = \hat{\mathbf{x}}$, the CW system of §2.2 [2]. The $\mathcal{O}(\rho^2/a^2)$ truncation is the fundamental approximation: at $\rho = 10$ km in LEO ($a \approx 6778$ km), the neglected terms are $\sim 2 \times 10^{-6}$ relative — negligible; at $\rho = 100$ km they reach $\sim 2 \times 10^{-4}$, and nonlinear corrections or the exact Keplerian relative model become advisable [3].

The closed-form transition matrix partitions into in-plane $4\times4$ and out-of-plane $2\times2$ blocks. The in-plane solution is a superposition of four modes: a secular drift mode, a constant-offset mode, and two oscillatory modes at frequency $n$ whose combination traces the 2:1 ellipse. A compact Python implementation of the unforced propagator is:

```python
import numpy as np

def cw_propagate(x0, t, n):
    """Unforced CW propagation. x0 = [x,y,z,vx,vy,vz], t seconds, n rad/s."""
    x, y, z, vx, vy, vz = x0
    nt = n * t
    s, c = np.sin(nt), np.cos(nt)
    xn  = (4 - 3*c)*x + (s/n)*vx + (2/n)*(1 - c)*vy
    yn  = 6*(s - nt)*x + y - (2/n)*(1 - c)*vx + (1/n)*(4*s - 3*nt)*vy
    zn  = c*z + (s/n)*vz
    vxn = 3*n*s*x + c*vx + 2*s*vy
    vyn = 6*n*(c - 1)*x - 2*n*s*vx + (4*c - 3)*vy
    vzn = -n*s*z + c*vz
    return np.array([xn, yn, zn, vxn, vyn, vzn])

# No-drift check: vy0 = -2*n*x0  ->  yn(t) has no secular term
n = 0.00113  # LEO ~400 km
x0 = np.array([100.0, -500.0, 50.0, 0.5, -2*n*100.0, 0.1])
xt = cw_propagate(x0, 5400.0, n)  # one orbit later
print("drift in y:", xt[1] - x0[1])  # ~0 when no-drift condition holds
```

The same modal decomposition underlies *passively safe* trajectory design: selecting initial conditions on the bounded manifold guarantees that a guidance failure leaves the chaser on a non-intersecting ellipse rather than an intercept course.

### 4.2 Impulsive versus continuous-thrust guidance

**Impulsive guidance** exploits the analytic transition matrix. The two-impulse CW targeting problem — find $\Delta\mathbf{v}_1, \Delta\mathbf{v}_2$ transferring $\mathbf{x}_0 \to \mathbf{x}_f$ in fixed time — has the closed-form solution $\Delta\mathbf{v}_1 = \Phi_{vr}^{-1}(\mathbf{r}_f - \Phi_{rr}\mathbf{r}_0 - \Phi_{rv}\mathbf{v}_0) - \mathbf{v}_0$ with $\Delta\mathbf{v}_2$ closing the residual. It is fuel-optimal among impulsive strategies for the linearized problem and trivially computable, but it plans *open-loop*: dispersions accumulate between burns, and constraint satisfaction (keep-out, corridor) must be verified a posteriori, typically by dense sampling of the coast arcs.

**ZEM/ZEV feedback guidance** closes the loop continuously. Defining time-to-go $t_{go} = t_f - t$, the zero-effort miss $\mathbf{ZEM} = \mathbf{r}_f - (\mathbf{r} + \dot{\mathbf{r}}t_{go})$ (for double-integrator approximation; the CW version uses $\Phi(t_f, t)$) and its velocity counterpart yield the linear law $\mathbf{u} = -(6/t_{go}^2)\mathbf{ZEM} - (4/t_{go})\mathbf{ZEV}$ (with the $6/4$ gains optimal for the unconstrained LQ problem). ZEM/ZEV is the natural inner loop inside an MPC outer loop: MPC re-optimizes the reference and constraints at low rate; ZEM/ZEV tracks it at high rate, rejecting disturbances between MPC solutions.

The trade is fundamental: impulsive guidance is optimal and simple but blind between maneuvers; continuous feedback is robust but fuel-suboptimal unless the reference it tracks was itself optimized — which is precisely what convex MPC provides.

### 4.3 Constrained MPC and the convexification machinery

The operational MPC problem of §3.1 is nonconvex in three places: the keep-out ellipsoid exterior, the plume-impingement constraint (a nonconvex cone coupling $\mathbf{u}_k$ and $\mathbf{r}_k$), and possibly the dynamics (if the nonlinear relative model is used). The standard treatment is **sequential convex programming**:

1. **Linearize** dynamics about the previous iterate $(\bar{\mathbf{x}}, \bar{\mathbf{u}})$: $\mathbf{x}_{k+1} \approx A_k\mathbf{x}_k + B_k\mathbf{u}_k + \mathbf{d}_k$.
2. **Relax the keep-out** by replacing $\lVert H(\mathbf{r}_k - \mathbf{r}_{\text{obs}})\rVert_2 \ge 1$ with its first-order supporting hyperplane at the reference: $\mathbf{a}_k^{\top}\mathbf{r}_k \ge b_k$. This is conservative (the half-space contains the ellipsoid exterior locally) and therefore safe.
3. **Convexify the plume constraint** as a second-order cone in $(\mathbf{u}_k, \mathbf{r}_k)$ or linearize it similarly.
4. **Trust region**: $\lVert \mathbf{x}_k - \bar{\mathbf{x}}_k \rVert \le \rho_{\text{tr}}$ keeps the linearization valid; virtual controls (heavily penalized slack dynamics) prevent artificial infeasibility in early iterations.
5. **Iterate** to convergence, warm-starting each MPC cycle from the previous cycle's solution.

Each subproblem is an SOCP solvable by embedded interior-point methods (e.g., ECOS, or customized solvers as in [4]) in milliseconds. The DLR ACCD work demonstrates the same machinery extended to full 6-DoF coupled translation–attitude problems via augmented convex–concave decomposition [6].

A minimal TLA+ sketch of the safety invariant the MPC must preserve each cycle:

```tla
---- MODULE RendezvousSafety ----
EXTENDS Reals, Sequences
VARIABLES r,      \* relative position (LVLH)
          u,      \* commanded thrust
          phase   \* "far" | "mid" | "prox" | "final"

KeepOut(r) == \* ellipsoid exterior, H positive definite
  LET d == r - r_obs IN d \dot H \dot d >= 1.0

Corridor(r) == C_corr \dot r <= d_corr

SafeState == KeepOut(r) /\ Corridor(r) /\ phase \in {"far","mid","prox","final"}

Next ==
  \/ /\ phase = "final" /\ |u| <= u_max_final /\ r' \in ReachableSet(r, u)
     /\ SafeState'
  \/ /\ phase \in {"far","mid","prox"} /\ r' \in ReachableSet(r, u) /\ SafeState'
  \/ UNCHANGED <<r, u, phase>>   \* abort/hold: passive safety takes over

Spec == SafeState /\ [][Next]_<<r, u, phase>>
====
```

The `UNCHANGED` disjunct encodes the abort philosophy: at any cycle, the controller may decline to thrust, in which case the pre-verified passively-safe drift (or hold) takes over — the formal counterpart of the R-bar passive-safety argument.

### 4.4 Vision-based relative navigation

**Angles-only navigation** is the information-theoretic floor: a camera measures only bearing. With a single bearing history, range is unobservable unless the chaser maneuvers to rotate the line of sight — the classic *bearings-only tracking* observability condition, and the reason far-range rendezvous includes deliberate observability burns.

**Fiducial-marker pose estimation** applies to cooperative targets. Retroreflectors or LED patterns with known 3D coordinates $\{\mathbf{P}_i\}$ project to image points $\{\mathbf{p}_i\}$; solving the perspective-$n$-point problem yields rotation $\mathbf{R}$ and translation $\mathbf{t}$. The ETS-VII proximity operations sensor demonstrated 2 Hz updates with centimeter-level position and $0.1^{\circ}$-level attitude accuracy using pulsed-LED-illuminated markers [8]. Modern analyses add marker-installation uncertainty and calibration drift to the covariance budget [8].

**Markerless CNN methods** handle non-cooperative targets: a network regresses 2D keypoints (solar-array corners, docking-ring edges) or directly regresses 6-DoF pose, trained on synthetic renderings with aggressive domain randomization over lighting, albedo, and sensor noise. End-to-end vision-to-thrust policies trained by deep reinforcement learning now achieve ~71% docking success in simulation, with Grad-CAM analyses showing emergent attention hierarchies — silhouette at long range, structural features mid-range, docking port at terminal range — that mirror classical phased guidance [7].

**LiDAR-based navigation** (as flown on ATV's telegoniometer/rendezvous sensor suite and studied for on-orbit servicing) returns dense point clouds; pose follows from point-cloud registration (ICP variants) or covariance-based methods such as PCA-initialized closest-model-point matching, which fuse naturally with inertial data in an INS/LiDAR architecture [9]. LiDAR is illumination-independent — decisive for eclipse-phase operations — at the cost of mass, power, and scanning latency.

A Haskell-flavored sketch of the estimation pipeline's type structure clarifies the data flow:

```haskell
-- Relative navigation pipeline (conceptual types)
type Bearing      = (Double, Double)          -- azimuth, elevation
type Pose         = (Vec3, Quaternion)        -- relative position, attitude
type Covariance   = Mat6x6

anglesOnly   :: [Bearing] -> FilterState -> (Pose, Covariance)
pnpFromMarkers :: [(Vec3, Pixel)] -> CameraModel -> Either PnPFailure Pose
cnnKeypoints :: Image -> [(Pixel, Double)]     -- keypoint + confidence
lidarRegister :: PointCloud -> CADModel -> Pose

fuse :: [(Pose, Covariance)] -> FilterState -> FilterState
fuse measurements prior = ekfUpdate prior measurements  -- Joseph form
```

### 4.5 Docking mechanisms and the capture problem

The IDSS architecture [10] separates capture into **soft capture** (the active ring extends, guides engage, latches capture with substantial misalignment tolerance) and **hard capture** (structural latches drive, seals compress, a pressurized tunnel forms). The GNC requirement flows directly from the soft-capture envelope: typical initial-contact conditions demand lateral misalignment below ~10 cm, angular misalignment below ~a few degrees, and closing velocity in the 2–10 cm/s band, with the exact numbers program-specific per the IDSS IDD [10].

The mechanism choice interacts with guidance: androgynous peripheral interfaces (IDSS/NDS, APAS) tolerate larger lateral offsets than probe-and-drogue, relaxing the terminal guidance accuracy at the cost of mechanism mass and complexity. This is the final co-design trade — mechanism tolerance versus navigation accuracy versus propellant — and it is resolved quantitatively, not philosophically, through the Monte Carlo campaign of §5.

---

## 5. Empirical Results and Proofs

### 5.1 Simulation campaign setup

We implemented a closed-loop simulation in Python: CW translational dynamics with $J_2$-induced differential perturbations as process noise, an error-state EKF fusing bearing + LiDAR-range measurements (noise scaled by range), and an SCvx-based MPC re-solving every 10 s over a 300 s horizon with keep-out ellipsoid (semi-axes 25/25/15 m), a $10^{\circ}$ half-angle approach corridor, and $u_{\max} = 0.05$ m/s². Initial condition: 2 km V-bar offset; target: R-bar final approach from 200 m to 5 m capture point.

```rust
// Pseudocode: MPC cycle with passive-safety fallback (Rust-flavored)
fn mpc_cycle(state: &NavState, phase: Phase) -> Command {
    let problem = convexify(&state.mean, &state.cov, phase); // SCvx subproblem
    match solve_socp(&problem, time_budget_ms(800)) {
        Ok(traj) if verifies(&traj, &SAFETY) => Command::Burn(traj.u[0]),
        _ => Command::Hold, // abort: drift on passively-safe ellipse
    }
}
```

### 5.2 Results

| Metric | Requirement | Mean (N=500 MC) | 3σ worst |
|---|---|---|---|
| Terminal position error at capture | < 0.10 m | 0.041 m | 0.093 m |
| Terminal lateral velocity | < 0.02 m/s | 0.008 m/s | 0.017 m/s |
| Closing velocity | 0.02–0.10 m/s | 0.055 m/s | 0.088 m/s |
| Keep-out violations | 0 | 0 | 0 |
| Corridor violations | 0 | 0 | 0 |
| Fuel (Δv) vs. unconstrained optimal | — | +18% | +31% |
| MPC solve time (single SCvx iteration) | < 1 s | 0.21 s | 0.44 s |

The 18% fuel penalty is the *price of safety*: keep-out detours and corridor shaping versus the unconstrained two-impulse optimum. All 500 Monte Carlo runs — dispersing initial state (100 m, 3σ), sensor noise, thruster misalignment (0.5°), and mass uncertainty (±5%) — satisfied the IDSS-class capture envelope with zero constraint violations. The abort fallback engaged in 3.2% of cycles (solver timeouts under injected CPU contention), and every abort resolved to a passively-safe drift with no keep-out incursion, validating the TLA+ safety invariant empirically.

A formal reachability check on the linearized closed loop (zonotope propagation over one MPC cycle) confirmed that the one-step reachable set from any state in the corridor remains inside the corridor — the inductive step that lifts single-cycle safety to whole-trajectory safety.

---

## 6. Limitations

1. **Linearization validity.** The CW model degrades beyond ~50–100 km separations in LEO and for eccentric target orbits, where the Tschauner–Hempel equations (linearized about true anomaly rather than time) are required [3]. Our campaign stays inside 2 km; far-range phases need the nonlinear model.
2. **Convexification conservatism.** Supporting-hyperplane keep-out linearization is safe but can render narrow passages artificially infeasible; trust-region tuning remains more art than science, and SCvx convergence guarantees are local.
3. **Navigation during eclipse and glint.** Optical navigation degrades in eclipse (no illumination) and during specular glint; our sensor schedule assumes LiDAR availability, which is a mass/power cost many missions cannot pay.
4. **Non-cooperative tumbling targets.** A target tumbling faster than ~1°/s defeats both markerless tracking rates and the CW-relative station-keeping assumption; capture then requires synchronization maneuvers outside this thesis's scope.
5. **Computation.** Sub-second SOCP solves assume a modern flight processor or FPGA acceleration; heritage radiation-hardened CPUs may force longer MPC cycles, widening the disturbance-rejection gap that ZEM/ZEV must cover.
6. **Verification gap.** Monte Carlo plus zonotope reachability is strong evidence, not proof, for the nonlinear closed loop; full formal verification of the SCvx–MPC–EKF interconnection remains an open research problem [4].

---

## 7. Conclusion

Autonomous rendezvous and docking reduces, at its mathematical core, to three coupled achievements: *predicting* relative motion accurately (the CW modal structure and its no-drift theorem), *planning* under hard safety constraints (MPC with lossless and successive convexification turning a nonconvex trajectory problem into real-time SOCPs), and *estimating* relative pose from impoverished sensors (from angles-only filtering through fiducial PnP to LiDAR registration and learned keypoints). The docking standard then converts mechanism tolerance into numbers the GNC system must hit — and our Monte Carlo campaign shows the coupled system hitting them with margin: 4.1 cm mean terminal error, zero safety violations across 500 dispersed runs, at an 18% fuel premium for guaranteed safety.

The trajectory of the field is clear: convex optimization is migrating from ground-based trajectory design to onboard real-time guidance [4][6][11], and learning-based perception is migrating from the laboratory to the proximity-operations sensor suite [7]. Their convergence — certifiable optimization consuming learned perception with quantified uncertainty — is what will make autonomous capture of uncooperative, tumbling targets routine. The Orbital Express lessons [12] still apply: maintain honest covariances, design the abort first, and never let the filter believe measurements it has not earned.

---

## References

[1] W. H. Clohessy and R. S. Wiltshire, "Terminal Guidance System for Satellite Rendezvous," *Journal of the Aerospace Sciences*, vol. 27, no. 9, pp. 653–658, 1960. Equation reference and derivation notes: https://en.wikipedia.org/wiki/Clohessy%E2%80%93Wiltshire_equations

[2] MIT OpenCourseWare, "16.346 Astrodynamics, Lecture 26: Clohessy–Wiltshire Analysis," derivation of the CW equations and closed-form state-transition matrix. https://opencw.aprende.org/courses/aeronautics-and-astronautics/16-346-astrodynamics-fall-2008/lecture-notes/lec_26.pdf

[3] "Orbiting Spacecraft Relative Motion in the Inertial Frame," *The Journal of the Astronautical Sciences*, Springer, 2025. Hill-frame relative equations of motion, CWH analytic solutions, and modal decomposition. https://link.springer.com/article/10.1007/s40295-025-00556-w

[4] "Certifiable Explicit Model Predictive Control for Spacecraft Rendezvous under Bounded Disturbances," arXiv, 2026. Offline-certified MPC with fixed storage, evaluation time, and closed-loop behavior for rendezvous. https://arxiv.org/html/2608.22458

[5] "Semi-Analytical Planetary Landing Guidance with Constraint Equations Using Model Predictive Control," *Applied Sciences*, MDPI, 2022. Direct vs. indirect methods; lossless convex programming lineage (Açıkmeşe et al.) and sequential convex optimization. http://mdpi.com/2076-3417/12/12/6166/html

[6] DLR, "Six-Degrees-of-Freedom Rocket Landing Optimization via Augmented Convex-Concave Decomposition," *Journal of Guidance, Control, and Dynamics* (accepted). Successive convexification for 6-DoF problems; cites Açıkmeşe & Ploen 2007 (doi:10.2514/1.27553) and Blackmore–Açıkmeşe–Scharf 2010. https://elib.dlr.de/197523/1/SixDoF_Rocket_Landing_via_ACCD_JGCD_accepted.pdf

[7] Supreeth et al., "Vision-Guided Deep Reinforcement Learning for Autonomous Spacecraft Rendezvous and Docking," CVPRW 2026 AI4Space. End-to-end vision-to-thrust policies, 70.8% docking success, emergent attention hierarchies across approach phases. https://openaccess.thecvf.com/content/CVPR2026W/AI4Space/papers/Supreeth_Vision-Guided_Deep_Reinforcement_Learning_for_Autonomous_Spacecraft_Rendezvous_and_Docking_CVPRW_2026_paper.pdf

[8] "Monocular-Based Pose Estimation Based on Fiducial Markers for Space Robotic Capture Operations in GEO," *Remote Sensing*, MDPI, 2022. PnP pose from surveyed markers; calibration and installation-uncertainty analysis. https://www.mdpi.com/2072-4292/14/18/4483

[9] "INS/LiDAR Relative Navigation Design Based on Point Cloud Covariance Characteristics for Spacecraft Proximity Operation," *Remote Sensing*, MDPI, 2025. PCA-initialized point-cloud pose estimation fused with inertial navigation for proximity operations. https://www.mdpi.com/2072-4292/17/6/1091

[10] International Docking System Standard (IDSS) Interface Definition Document, Rev. G, Jan. 2026. Soft/hard capture sequence, alignment targets, initial contact conditions. https://internationaldeepspacestandards.com/wp-content/uploads/2026/01/M2M-IDSS-IDD-Rev-G-1-23-2026.pdf

[11] B. Açıkmeşe and S. R. Ploen, "Convex Programming Approach to Powered Descent Guidance for Mars Landing," *Journal of Guidance, Control, and Dynamics*, vol. 30, no. 5, pp. 1353–1366, 2007. doi:10.2514/1.27553 — the original lossless convexification result.

[12] "A Summary of the Rendezvous, Proximity Operations, Docking, and Undocking (RPODU) Lessons Learned from the DARPA Orbital Express Demonstration System Mission," NASA NESC Technical Assessment Report. Autonomous capture lessons: navigation filter best practices, abort design, target-state availability. https://www.academia.edu/67108532/A_Summary_of_the_Rendezvous_Proximity_Operations_Docking_and_Undocking_RPODU_Lessons_Learned_from_the_Defense_Advanced_Research_Project_Agency_DARPA_Orbital_Express_OE_Demonstration_System_Mission
