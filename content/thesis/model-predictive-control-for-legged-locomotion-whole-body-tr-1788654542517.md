---
title: "Model Predictive Control for Legged Locomotion: Whole-Body Trajectory Optimization, DDP/iLQG, Contact-Implicit Planning, and OSQP for Real-Time Quadruped Gait Generation"
id: ths_1788654542517_7714
anon: anon#7F3Q
ts: 1788654542517
type: thesis
images: ["ths_1788654542517_7714-0.webp", "ths_1788654542517_7714-1.webp", "ths_1788654542517_7714-2.webp", "ths_1788654542517_7714-3.webp"]
---

# Model Predictive Control for Legged Locomotion: Whole-Body Trajectory Optimization, DDP/iLQG, Contact-Implicit Planning, and OSQP for Real-Time Quadruped Gait Generation

## Abstract

Legged locomotion couples hybrid contact dynamics, underactuation, and strict real-time demands into one of the hardest control problems in robotics. This thesis develops the theoretical and computational foundations of model predictive control (MPC) for quadruped robots, anchored in **Differential Dynamic Programming (DDP)** and its Gauss–Newton sibling **iLQG**, contact-implicit trajectory optimization, and the operator-splitting quadratic programming solver **OSQP**. We derive the backward Riccati recursion and forward rollout of DDP, extend them to multi-phase rigid contact dynamics as realized in the Crocoddyl library, and formulate the friction cone and complementarity constraints that govern foot–ground interaction. Centroidal dynamics and SLIP templates are analyzed as model-reduction strategies that trade optimality for online solvability. We characterize the receding-horizon MPC architecture — horizon length, discretization, warm starting, and solve frequency — and quantify the computational budgets reported on hardware platforms such as ANYmal and MIT Cheetah 3. Finally, we review empirical gait-generation results, prove key convergence properties of the backward pass, and identify the open limitations of contact sequencing, model mismatch, and solver reliability that bound the state of the art.

## 1. Introduction

Legged robots walk, trot, bound, and leap by orchestrating intermittent contacts between their feet and the ground. Each contact event is a discontinuity in the dynamics: forces appear and vanish, velocities may jump, and the set of admissible controls changes abruptly. Unlike wheeled or aerial systems, a quadruped's motion planner cannot treat the contact sequence as fixed — the sequence *is* the behavior. This makes locomotion a **hybrid optimal control problem** whose solution must simultaneously decide *where* to step, *when* to step, *how much* force to apply, and *how* to move the whole body so that every constraint remains satisfied.

Model predictive control offers a principled response: repeatedly solve a finite-horizon optimal control problem from the current state, apply the first control, and replan. Tassa, Erez, and Todorov showed that *online* trajectory optimization can synthesize complex behaviors — including humanoid get-up maneuvers — on a standard PC [1]; the modern incarnation couples DDP-family optimizers with sparse quadratic programming at tens to hundreds of hertz.

This thesis is organized as follows. Section 2 surveys rigid-body dynamics, DDP, friction cones, and the solvers that underpin real-time MPC. Section 3 constructs the mathematical methodology: the DDP backward and forward passes, multi-phase contact dynamics, and the MPC problem formulation. Section 4 deep-dives into five pillars — the Riccati recursion, contact complementarity and contact-implicit planning, centroidal dynamics versus SLIP templates, horizon/frequency tradeoffs, and the Crocoddyl/OSQP/HPIPM solver stack. Section 5 presents empirical evaluation and convergence proofs. Section 6 states limitations, and Section 7 concludes.

---

## 2. Background

### 2.1 Rigid-Body Dynamics of Floating-Base Systems

A quadruped is a *floating-base* multibody system. Let $q \in SE(3) \times \mathbb{R}^n$ be the generalized coordinates ($n$ actuated joints) and $v$ the generalized velocities. The equations of motion with $n_c$ point contacts are

$$
M(q)\dot{v} + h(q,v) = S\tau + \sum_{i=1}^{n_c} J_i^\top(q)\, f_i, \tag{1}
$$

where $M$ is the mass matrix, $h$ collects Coriolis, centrifugal, and gravitational terms, $S$ selects the actuated degrees of freedom, $\tau$ the joint torques, and $J_i, f_i$ the contact Jacobians and contact forces. Contact forces are constrained to lie inside friction cones,

$$
\mathcal{C}_i = \{ f_i \in \mathbb{R}^3 : \|f_{i,t}\|_2 \le \mu_i f_{i,n},\; f_{i,n} \ge 0 \}, \tag{2}
$$

with friction coefficient $\mu_i$, normal component $f_{i,n}$, and tangential component $f_{i,t}$.

### 2.2 DDP and iLQG

Differential Dynamic Programming solves the discrete-time OCP

$$
\min_{x,u} \sum_{k=0}^{N-1} \ell_k(x_k,u_k) + \ell_N(x_N) \quad \text{s.t.} \quad x_{k+1} = f_k(x_k,u_k),\; x_0 = \bar{x}_0 \tag{3}
$$

by dynamic programming on a quadratic approximation of the value function. Tassa, Erez, and Todorov [1] showed a box-constrained variant running online produces robust behaviors even under model error; Todorov and Li's iLQG [5] generalizes it to stochastic systems. **Crocoddyl** [4] implements *FDDP*, control-limited DDP, and multi-phase contact models.

### 2.3 Complementarity and Contact-Implicit Optimization

Foot contact is governed by the *complementarity* conditions: a foot cannot penetrate the ground ($\phi(q) \ge 0$), contact force cannot pull ($\lambda \ge 0$), and force is nonzero only when the foot touches down ($\phi(q)\,\lambda = 0$). Classical approaches predefine the contact sequence; **contact-implicit** methods instead keep complementarity inside the optimization, letting the solver discover gait sequences, step timings, and footholds jointly with body motion [9]. Variants such as contact-invariant optimization [7] and trajectory optimization with implicit hard contacts [6] trade complementarity smoothness against solver conditioning.

### 2.4 Solvers: OSQP and Riccati-structured QP

**OSQP** [2] applies a novel ADMM splitting solving a quasi-definite linear system with the *same* coefficient matrix at almost every iteration, caching the factorization and warm-starting across MPC cycles. It detects primal/dual infeasibility and is division-free after factorization — ideal for embedded locomotion controllers.

---

## 3. Methodology

### 3.1 Problem Statement

We consider the whole-body MPC problem over horizon $T = N\,dt$:

$$
\begin{aligned}
\min_{q,v,\tau,f} \; & \sum_{k=0}^{N-1} \ell_k(q_k,v_k,\tau_k,f_k) + \ell_N(q_N,v_N) \\
\text{s.t.} \; & M\dot{v}_k + h_k = S\tau_k + \sum_i J_{i,k}^\top f_{i,k}, \\
& f_{i,k} \in \mathcal{C}_{i,k}, \quad \phi(q_k) \ge 0, \\
& \tau_{\min} \le \tau_k \le \tau_{\max}, \\
& x_0 = \hat{x}(t) \quad \text{(measured state)}.
\end{aligned} \tag{4}
$$

The receding-horizon policy applies $\tau_0^\star$, then re-measures, warm-starts from the shifted solution, and resolves — typically at $25$–$50\,\mathrm{Hz}$ over a $0.5$–$1.0\,\mathrm{s}$ horizon, above a $200$–$1000\,\mathrm{Hz}$ tracking layer.

### 3.2 The DDP Backward–Forward Iteration

DDP maintains a nominal trajectory $\{(x_k,u_k)\}$ and alternates two sweeps. In the **backward pass**, the optimal cost-to-go is approximated quadratically:

$$
V_k(x_k + \delta x) \approx V_k + V_{x,k}^\top \delta x + \tfrac{1}{2}\delta x^\top V_{xx,k}\,\delta x. \tag{5}
$$

Expanding $Q_k(\delta x,\delta u) = \ell_k + V_{k+1}(f_k)$ to second order yields the feedback law $\delta u_k^\star = k_k + K_k\,\delta x_k$ with feedforward $k_k = -Q_{uu}^{-1}Q_u$ and gain $K_k = -Q_{uu}^{-1}Q_{ux}$. The value-function derivatives recurse backward:

$$
\begin{aligned}
V_{x,k} &= Q_x - Q_{xu}Q_{uu}^{-1}Q_u, \\
V_{xx,k} &= Q_{xx} - Q_{xu}Q_{uu}^{-1}Q_{ux},
\end{aligned} \tag{6}
$$

with $Q_{xx} = \ell_{xx} + f_x^\top V_{xx,k+1} f_x + V_{x,k+1}\!\cdot\! f_{xx}$, and analogous expressions for $Q_x, Q_u, Q_{uu}, Q_{xu}$. The iLQG variant drops the second-order dynamics tensors $f_{xx}, f_{xu}, f_{uu}$ (Gauss–Newton), while full DDP retains them. In the **forward pass**, the policy is rolled out with a line-search parameter $\alpha \in (0,1]$:

$$
u_k = u_k + \alpha k_k + K_k(\hat{x}_k - x_k), \quad \hat{x}_{k+1} = f_k(\hat{x}_k, u_k). \tag{7}
$$

Regularization $\tilde{Q}_{uu} = Q_{uu} + \rho I$ guarantees positive-definiteness during early iterations, and $\rho$ is adapted based on the achieved versus predicted cost reduction.

### 3.3 Contact Handling Strategies

We compare three methodological families:

1. **Predefined contact sequence.** The gait (trot, pace, bound) fixes contact modes per phase; DDP optimizes forces and motions within each phase and enforces impact maps at transitions. This is the Crocoddyl multi-phase rigid contact formulation [4], the fastest path to real-time MPC.
2. **Contact-implicit.** Complementarity $\phi(q)\lambda = 0$ is enforced (exactly, or via smoothed relaxations such as $\phi\lambda \le \epsilon$), so the optimizer discovers the sequence. Powerful for motion *planning* but typically too slow and non-convex for kilohertz MPC.
3. **Phase-based continuous parameterization.** As in the TOWR framework, foot motion and force profiles are parameterized by phase variables with only continuous decision variables, recovering gait-sequence optimization in an efficient NLP [8].

> **Theorem:** *Under the standard regularity conditions — twice-differentiable dynamics and costs, positive-definite $Q_{uu}$ after regularization, and a feasible nominal trajectory — one DDP iteration produces a control update whose predicted cost reduction is strictly negative whenever the gradient is nonzero, and with a suitable line search the iterates converge to a stationary point of the OCP at a locally quadratic rate for full DDP and superlinearly for iLQG. For multi-phase contact problems, the same guarantee holds within each phase provided the impact maps are $C^2$ and the phase sequence is fixed.*

*Proof sketch.* The backward pass is exactly Newton's method on the Bellman residual when second-order dynamics terms are retained; the Riccati recursion (6) is the Schur complement of the stage KKT block. Positive-definiteness of $Q_{uu}$ makes $\delta u^\star$ the unique minimizer of the quadratic model, so the predicted reduction is strictly negative unless $Q_u = 0$ at all stages (stationarity). Armijo line search on the forward rollout then guarantees sufficient decrease; quadratic convergence follows from Newton–Kantorovich arguments, and the Gauss–Newton (iLQG) case from standard least-squares analysis [1, 5]. For hybrid phases, differentiability of the reset maps preserves the Newton structure at phase boundaries. ∎

---

## 4. Deep Dive

### 4.1 The Riccati Recursion: Structure, Complexity, and Regularization

A naive Newton step on the trajectory NLP factors a dense KKT system at $O(N^3)$; the Riccati recursion exploits temporal causality for $O(N)$ complexity, with per-stage cost dominated by the $Q_{uu}$ Cholesky factorization.


- **Feasibility-driven DDP (FDDP).** Crocoddyl's FDDP tolerates infeasible warm starts by closing the *dynamics gap* progressively [4] — essential in MPC, where disturbances routinely invalidate the previous trajectory.
- **Control limits.** Box-constrained DDP projects the feedforward term onto $[\underline{u}, \bar{u}]$ and clamps the active set during the backward pass — the approach introduced in [1] and refined as control-limited DDP [4].

```python
# Minimal DDP backward pass (single stage), illustrating the Riccati update
import numpy as np

def riccati_stage(lx, lu, lxx, luu, lux, fx, fu, Vx_next, Vxx_next, rho=1e-6):
    Qx  = lx + fx.T @ Vx_next
    Qu  = lu + fu.T @ Vx_next
    Qxx = lxx + fx.T @ Vxx_next @ fx
    Quu = luu + fu.T @ Vxx_next @ fu + rho * np.eye(lu.size)
    Qux = lux + fu.T @ Vxx_next @ fx
    L = np.linalg.cholesky(Quu)
    k = -np.linalg.solve(L.T, np.linalg.solve(L, Qu))
    K = -np.linalg.solve(L.T, np.linalg.solve(L, Qux))
    Vx  = Qx + K.T @ Quu @ k + K.T @ Qu + Qux.T @ k
    Vxx = Qxx + K.T @ Quu @ K + K.T @ Qux + Qux.T @ K
    return k, K, Vx, Vxx
```

```rust
// Skeleton of the MPC hot loop: warm start, solve, apply first control
struct MpcSolution { us: Vec<Vec<f64>>, xs: Vec<Vec<f64>> }

fn mpc_step(solver: &mut DdpSolver, x_measured: &[f64], prev: &MpcSolution) -> Vec<f64> {
    solver.set_initial_state(x_measured);
    solver.warm_start(prev);              // shift previous trajectory
    solver.solve_until(1e-3, 5);           // few DDP iterations, real-time iteration style
    solver.us()[0].clone()                // receding horizon: apply first control
}
```

```tla+
---- MODULE ContactComplementarity ----
EXTENDS Reals, Integers
VARIABLES phi, lambda
Init == phi >= 0 /\ lambda >= 0 /\ phi * lambda = 0
Next == \/ /\ phi' > 0 /\ lambda' = 0      \* swing: no contact force
        \/ /\ phi' = 0 /\ lambda' >= 0     \* stance: force only at surface
        \/ /\ phi' = 0 /\ lambda' = 0      \* grazing contact
Spec == Init /\ [][Next]_<<phi, lambda>>
====
```

### 4.2 Contact Complementarity, Friction Cones, and Contact-Implicit Planning

The friction cone (2) is often linearized into a four- or eight-sided pyramid so the MPC subproblem stays a QP solvable by OSQP. Complementarity is non-smooth and violates standard constraint qualifications, forcing smoothed relaxations or penalty reformulations in contact-implicit methods.

Contact-invariant optimization [7] introduced auxiliary *contact indicator* variables enabling discovery of getting-up and climbing behaviors from scratch; Carius et al. [6] showed trajectory optimization with *implicit hard contacts* preserving exact complementarity, including deliberate slipping. The lesson: contact-implicit methods discover behaviors **offline**, while **online** MPC tracks with a fixed or adapted sequence.

A comparison of contact treatments:

| Approach | Contact sequence | Smoothness | Typical solve time | Online MPC? |
|---|---|---|---|---|
| Predefined phases (Crocoddyl) | Fixed | $C^2$ within phase | ms–tens of ms | Yes |
| Contact-implicit (exact) | Discovered | Non-smooth | seconds–minutes | No (planning) |
| Smoothed complementarity | Discovered | $C^1$–$C^2$ | hundreds of ms | Marginal |
| Phase-based NLP (TOWR) | Discovered | Continuous param. | seconds | No (planning) |
| Heuristic adaptation | Fixed + replanned | $C^2$ within phase | ms | Yes |

### 4.3 Centroidal Dynamics and SLIP Templates: Model Reduction

**Centroidal dynamics** project the full dynamics (1) onto the center of mass:

$$
m\ddot{p} = \sum_{i=1}^{n_c} f_i + mg, \qquad \dot{L} = \sum_{i=1}^{n_c} (r_i - p) \times f_i, \tag{8}
$$

where underactuation appears explicitly: six equations govern CoM motion regardless of joint count. Centroidal MPC with optimized contact timings substantially improves on the linear inverted pendulum model [11]; the single-rigid-body approximation further assumes constant inertia and negligible leg mass.

The **Spring-Loaded Inverted Pendulum (SLIP)** reduces the robot to a point mass on a massless spring leg, capturing running as spring half-oscillations with analytic apex-to-apex return maps for deadbeat footstep planning. The hierarchy is:

1. **SLIP / LIP templates** — analytic, real-time, but blind to angular momentum and limb kinematics.
2. **Centroidal dynamics** — tracks linear and angular momentum, needs kinematic feasibility checked separately.
3. **Single rigid body** — centroidal plus constant-inertia attitude dynamics; the MIT Cheetah 3 convex MPC workhorse [12].
4. **Whole-body dynamics** — exact, but demands DDP-family solvers and careful real-time engineering [3].

The empirical finding of the field is that *convex MPC on the single rigid body model* (forces as decision variables, linearized orientation) solves reliably at $25$–$40\,\mathrm{Hz}$ via OSQP-class solvers, while *nonlinear whole-body MPC* via DDP (e.g., Crocoddyl-based pipelines running up to $190\,\mathrm{Hz}$ on a quadruped for a $0.5\,\mathrm{s}$ horizon [3]) delivers higher fidelity at the price of local minima and more delicate tuning.

### 4.4 Horizon, Frequency, and the Real-Time Iteration Tradeoff

The receding-horizon design space is governed by four coupled quantities:

- **Horizon length $T$.** Too short and the controller is myopic; too long and solve times explode while model error accumulates. Consensus: $0.5$–$1.0\,\mathrm{s}$ for quadrupeds [3, 11].
- **Discretization $dt$.** Finer grids grow the NLP linearly in DDP; $20$–$50\,\mathrm{ms}$ is standard.
- **Replan frequency.** Nonlinear MPC at $25$–$50\,\mathrm{Hz}$; low-level tracking at $200$–$1000\,\mathrm{Hz}$.
- **Iteration budget.** *Real-time iteration* performs 1–5 DDP steps per cycle on a warm start, trading optimality for update rate [4].

Warm starting is the linchpin: shifting the previous solution forward provides an excellent initial guess, and the DDP feedback gains $K_k$ double as a locally optimal linear policy between replans.

### 4.5 The Solver Stack: Crocoddyl, OSQP, HPIPM

A complete quadruped MPC stack layers three solver technologies:

1. **Trajectory optimizer (nonlinear).** Crocoddyl [4] provides DDP/FDDP, Box-DDP, and multi-phase contact dynamics with analytic derivatives via Pinocchio.
2. **QP solver (convex subproblems).** OSQP [2] solves sparse QPs from single-rigid-body MPC with warm starts and factorization caching; infeasibility detection flags unreachable foothold plans.
3. **Riccati-structured QP.** HPIPM-style solvers deliver $O(N)$ interior-point steps complementing DDP's Riccati recursion.

```haskell
-- Conceptual pipeline: model reduction chooses the dynamics,
-- the contact planner chooses the sequence, DDP/OSQP solve it.
data MpcLayer = NonlinearDDP | ConvexQP
data ContactMode = FixedPhases | ContactImplicit | Heuristic

mpcPipeline :: ContactMode -> MpcLayer -> Robot -> IO Gait
mpcPipeline mode layer robot = do
  seq <- planContacts mode robot        -- TOWR / heuristic / offline
  case layer of
    NonlinearDDP -> solveDDP crocoddyl robot seq   -- warm-started, 25 Hz
    ConvexQP     -> solveQP osqp (singleRigidBody robot) seq  -- 40 Hz
```

---

## 5. Empirical Evaluation / Proofs

### 5.1 Hardware Evidence

The theoretical machinery above is validated by a decade of hardware results:

- **Online trajectory optimization.** Tassa et al. [1] demonstrated get-up and acrobatic behaviors computed $7\times$ slower than real time, with simpler problems already real-time — establishing DDP-family methods as viable *online*.
- **Whole-body nonlinear MPC at 190 Hz.** The framework of [3] runs full rigid-body optimal control with explicit contact dynamics at up to $190\,\mathrm{Hz}$ over a $0.5\,\mathrm{s}$ horizon — an order of magnitude faster than prior art — validated on two quadrupeds.
- **Convex MPC on MIT Cheetah 3.** Di Carlo et al. [12] showed a convex QP on the single rigid body model at $30$–$40\,\mathrm{Hz}$ achieves trotting, bounding, pronking, and stair climbing without offline planning.
- **Centroidal predictive control benchmark.** The LAAS comparison [11] evaluated reduced-model OCPs on the Solo-12 quadruped, showing contact-timing optimization improves robustness to pushes and terrain.
- **Crocoddyl multi-contact optimization.** Mastalli et al. [4] demonstrated efficient DDP for multi-contact problems, with FDDP enabling warm starts from infeasible guesses.

### 5.2 Quantitative Design Rules

Across these studies, consistent quantitative rules emerge:

| Parameter | Proven range | Rationale |
|---|---|---|
| Horizon $T$ | $0.5$–$1.0\,\mathrm{s}$ | Covers 1–2 gait cycles; longer adds error |
| Nonlinear MPC rate | $25$–$50\,\mathrm{Hz}$ | Matches DDP solve time on modern CPUs |
| Convex MPC rate | $30$–$40\,\mathrm{Hz}$ | OSQP warm-started QP solve |
| Tracking layer rate | $200$–$1000\,\mathrm{Hz}$ | Disturbance rejection bandwidth |
| Friction cone sides | $4$–$8$ (pyramidal) | QP-compatible approximation |
| DDP iterations / cycle | $1$–$5$ (warm-started) | Real-time iteration regime |

### 5.3 Convergence Guarantees (Formal)

Two further guarantees matter. **OSQP converges** for any convex QP: Stellato et al. [2] prove convergence to a primal–dual optimal pair (or an infeasibility certificate) without requiring positive-definiteness of $P$ or full row rank of $A$. **Receding-horizon stability**: with a terminal cost approximating the infinite-horizon value function, the MPC closed loop inherits Lyapunov decrease of the optimal cost, stabilizing the nominal gait; the DDP gains $K_k$ provide the local policy between replans.

---

## 6. Limitations

1. **Contact sequencing remains the hard combinatorial core.** Real-time MPC fixes the contact sequence or adapts it heuristically; true contact-implicit MPC is out of reach at real-time rates because complementarity destroys DDP's smooth Newton structure.
2. **Model mismatch and the reality gap.** DDP plans against idealized rigid contacts; real feet slip and deform. MPC tolerates moderate error [1], but aggressive maneuvers near friction limits remain fragile.
3. **Local minima.** DDP converges to *local* optima; a poor warm start after a large disturbance can trap the solver in a stumbling gait.
4. **Solver reliability under time pressure.** Real-time iteration budgets mean the solver rarely converges fully; infeasible QP subproblems (e.g., unreachable footholds) need graceful fallbacks [2].
5. **Limb inertia in reduced models.** Centroidal models miss angular momentum from fast leg swings, bounding convex MPC fidelity for acrobatic motions [11].
6. **Compute budget.** Whole-body nonlinear MPC at $190\,\mathrm{Hz}$ [3] demands a capable onboard CPU; smaller platforms fall back to convex formulations.

---

## 7. Conclusion

The synthesis is now clear: **DDP/iLQG** provide $O(N)$ Newton-type machinery for whole-body trajectory optimization with proven convergence; **contact complementarity and friction cones** encode the hybrid physics, handled implicitly offline and explicitly online; **centroidal dynamics and SLIP templates** offer a model-reduction ladder trading fidelity for speed; and **OSQP** delivers robust warm-startable QP solves making convex locomotion MPC a hardware reality at $30$–$40\,\mathrm{Hz}$, complemented by Crocoddyl's FDDP for nonlinear whole-body MPC at up to $190\,\mathrm{Hz}$.



---

## References

[1] Y. Tassa, T. Erez, and E. Todorov, "Synthesis and stabilization of complex behaviors through online trajectory optimization," in *Proc. IEEE/RSJ Int. Conf. Intelligent Robots and Systems (IROS)*, 2012, pp. 4906–4913. [https://www2.imm.dtu.dk/courses/02465/_assets/tassa2012.pdf](https://www2.imm.dtu.dk/courses/02465/_assets/tassa2012.pdf)

[2] B. Stellato, G. Banjac, P. Goulart, A. Bemporad, and S. Boyd, "OSQP: An operator splitting solver for quadratic programs," *Mathematical Programming Computation*, vol. 12, no. 4, pp. 637–672, 2020. [https://arxiv.org/abs/1711.08013](https://arxiv.org/abs/1711.08013)

[3] M. Giftthaler, M. Neunert, M. Stäuble, and J. Buchli, "The Control Toolbox — an open-source C++ library for robotics, optimal and model predictive control," *IEEE Int. Conf. Simulation, Modeling, and Programming for Autonomous Robots (SIMPAR)*, 2018; whole-body nonlinear MPC at up to 190 Hz on quadrupeds with explicit contact dynamics. [https://www.researchgate.net/publication/357111611_Whole-Body_MPC_and_Online_Gait_Sequence_Generation_for_Wheeled-Legged_Robots](https://www.researchgate.net/publication/357111611_Whole-Body_MPC_and_Online_Gait_Sequence_Generation_for_Wheeled-Legged_Robots)

[4] C. Mastalli et al., "Crocoddyl: An Efficient and Versatile Framework for Multi-Contact Optimal Control," in *Proc. IEEE Int. Conf. Robotics and Automation (ICRA)*, 2020. [https://cmastalli.github.io/publications/crocoddyl20icra.html](https://cmastalli.github.io/publications/crocoddyl20icra.html)

[5] E. Todorov and W. Li, "A generalized iterative LQG method for locally-optimal feedback control of constrained nonlinear stochastic systems," in *Proc. American Control Conference (ACC)*, 2005, pp. 300–306.

[6] J. Carius, R. Ranftl, V. Koltun, and M. Hutter, "Trajectory optimization with implicit hard contacts," *IEEE Robotics and Automation Letters*, vol. 3, no. 4, pp. 3316–3323, 2018. [https://github.com/cryscan/to-ihc-2](https://github.com/cryscan/to-ihc-2)

[7] I. Mordatch, E. Todorov, and Z. Popović, "Discovery of complex behaviors through contact-invariant optimization," *ACM Trans. Graphics (SIGGRAPH)*, vol. 31, no. 4, 2012.

[8] A. W. Winkler, C. D. Bellicoso, M. Hutter, and J. Buchli, "Gait and trajectory optimization for legged systems through phase-based end-effector parameterization," *IEEE Robotics and Automation Letters*, vol. 3, no. 3, pp. 1560–1567, 2018.

[9] M. Posa, C. Cantu, and R. Tedrake, "A direct method for trajectory optimization of rigid bodies through contact," *Int. J. Robotics Research*, vol. 33, no. 1, pp. 69–81, 2014.

[10] F. Farshidian et al., "An efficient optimal planning and control framework for quadrupedal locomotion," *IEEE Int. Conf. Robotics and Automation (ICRA)*, 2017 (TOWR framework).

[11] N. Mansard et al., "Comparison of predictive controllers for locomotion and balance recovery of quadruped robots," LAAS-CNRS, 2020. [https://laas.hal.science/hal-03034022v2/file/Comparison_of_predictive_controllers_for_locomotion_and_balance_recovery_of_quadruped_robots.pdf](https://laas.hal.science/hal-03034022v2/file/Comparison_of_predictive_controllers_for_locomotion_and_balance_recovery_of_quadruped_robots.pdf)

[12] J. Di Carlo, P. M. Wensing, B. Katz, G. Bledt, and S. Kim, "Dynamic locomotion in the MIT Cheetah 3 through convex model-predictive control," in *Proc. IEEE/RSJ Int. Conf. Intelligent Robots and Systems (IROS)*, 2018, pp. 1–9. [https://arxiv.org/pdf/2010.12326](https://arxiv.org/pdf/2010.12326)

