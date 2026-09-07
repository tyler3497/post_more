---
id: humanoid-whole-body-mpc-5e6f
title: "Whole-Body Model Predictive Control for Humanoid Locomotion: Centroidal Dynamics, Contact-Implicit Trajectory Optimization, and Real-Time Differential Dynamic Programming"
anon: anon#3378
ts: 1788748165000
tags: [humanoid-whole-body-mpc]
type: thesis
---

# Whole-Body Model Predictive Control for Humanoid Locomotion: Centroidal Dynamics, Contact-Implicit Trajectory Optimization, and Real-Time Differential Dynamic Programming

## Abstract

Whole-body model predictive control (MPC) promises to lift humanoid locomotion beyond layered heuristics into a coherent optimization over contacts, momenta, and joint torques. Yet a 30+ degree-of-freedom floating-base system making and breaking frictional contacts at 1 kHz has kept whole-body MPC beyond real-time reach. This thesis synthesizes three research lines that jointly make it tractable: the centroidal momentum dynamics of Orin and Goswami, which compress the robot into a single rigid body governed by the centroidal momentum matrix; contact-implicit trajectory optimization pioneered by Posa and Tedrake, which turns contact-mode selection into complementarity constraints inside the optimizer; and the differential dynamic programming of Tassa, Erez, and Todorov. We formulate a receding-horizon whole-body MPC coupling contact forces and joint torques, prove local quadratic convergence of the DDP solver under regularity assumptions, and survey hardware deployments from the Cheetah 3's sub-millisecond convex MPC to 150-knot whole-body DDP on humanoids. We conclude with the fundamental limits -- nonconvex complementarity, state-dependent centroidal inertia, and the low-level tracking gap -- still separating theory from full-rate practice.

## 1 Introduction

Humanoid locomotion is among the most demanding problems in robotics: an underactuated, high-dimensional rigid-body system must regulate its linear and angular momentum through intermittent, unilateral contact with an uncertain environment, inside millisecond-scale control budgets. For two decades the field has relied on a *layered* architecture: a footstep planner selects a contact sequence, a simplified model (typically the linear inverted pendulum) generates center-of-mass and zero-moment-point references, and a whole-body controller resolves them into joint torques via an instantaneous quadratic program [8]. Each layer hides information from the next, and aggressive maneuvers -- running, jumping, stair climbing, push recovery -- routinely fall through the cracks between layers [4].

*Whole-body model predictive control* (MPC) rejects the decomposition. It poses locomotion as a single receding-horizon optimal control problem over the full floating-base state: configurations, velocities, and the contact wrenches coupling the robot to the ground. In principle this is the right formulation -- it captures the true coupling between limb inertia and centroidal momentum, discovers contact sequences on its own, and returns a time-varying feedback policy rather than an open-loop reference. In practice it collides with three walls: the hybrid, non-smooth character of contact; the cubic cost of Newton steps on a 30+ degree-of-freedom system; and the hard real-time budget of 1--2 kHz torque loops.

This thesis argues that the walls have cracked. Three independently developed ideas -- *centroidal dynamics* [6], *contact-implicit trajectory optimization* [4], and *control-limited differential dynamic programming* [1][2] -- compose into a practical recipe for whole-body MPC, now demonstrated on hardware from the MIT Cheetah 3 to the torque-controlled humanoid Talos [3][7]. Our contributions are:

1. A unified receding-horizon formulation of whole-body MPC with contact-implicit complementarity constraints (Section 3).
2. A DDP-based solver with a local quadratic-convergence guarantee (Sections 4.3 and 5).
3. An empirical survey of real-time deployments, from sub-millisecond convex MPC [3] to 150-knot whole-body DDP [7] (Section 5).
4. A candid treatment of the remaining barriers (Section 6).

---

## 2 Background

**Floating-base dynamics.** A humanoid is a floating-base multibody system with configuration *q = (q_b, q_j)* in *SE(3) x R^n*. Its equations of motion are

*M(q) q_ddot + b(q, q_dot) = S^T tau + sum_j J_j(q)^T lambda_j*

with inertia matrix *M*, Coriolis/gravity vector *b*, actuator selection matrix *S*, joint torques *tau*, and contact wrenches *lambda_j* through Jacobians *J_j* [7]. The system is *underactuated*: the six base coordinates evolve only through contact forces, so every motion must satisfy the unactuated Newton-Euler equations at the center of mass (CoM).

**Centroidal momentum.** Aggregating at the CoM gives the *centroidal dynamics*. The centroidal momentum *h_G* relates to generalized velocities through the *centroidal momentum matrix* *A_G(q)*, and its rate depends *only* on external forces [6]:

*m r_ddot = sum_j f_j + m g*
*h_dot(q, v) = sum_j (p_j - r) x f_j*

This six-dimensional description is *exact* -- the approximation enters only when reconstructing whole-body kinematics from the momentum trajectory, a step Dai, Valenzuela, and Tedrake made rigorous via momentum-consistency constraints [5]. Structurally, the translational-velocity block of *A_G* is identically zero and its rotational block is always invertible [6].

**Contact as complementarity.** Rigid contact is hybrid: with signed distance *phi(q) >= 0* and normal impulse *lambda_n >= 0*,

*0 <= lambda_n  perpendicular  phi(q) >= 0*

plus Coulomb friction *||lambda_t|| <= mu lambda_n*. Stewart-Trinkle time stepping discretizes these into a linear complementarity problem; Posa and Tedrake [4] lifted the same conditions into trajectory optimization as a mathematical program with complementarity constraints (MPCC), removing the need for a pre-specified contact-mode sequence.

**Differential dynamic programming.** DDP exploits Bellman's temporal structure: a backward pass builds local quadratic models of the value function and extracts an open-loop correction *k* plus Riccati feedback gains *K*; a forward pass rolls out the policy with a line search. Tassa, Erez, and Todorov [1] showed a regularized DDP/iLQG variant runs fast enough for *online* trajectory optimization of humanoids, and Tassa, Mansard, and Todorov [2] extended it to control-limited systems via a box-QP in the backward pass.

---

## 3 Methodology

We formulate whole-body MPC as the receding-horizon problem solved at each tick from the measured state *x_0 = (q_0, v_0)*:

*min_{x,u}  sum_{t=0}^{T-1} l(x_t, u_t, t) + l_T(x_T)*
*s.t.  x_{t+1} = f(x_t, u_t)*
*      phi(q_t) >= 0,  lambda_{n,t} >= 0,  lambda_{n,t} . phi(q_{t+1}) = 0*
*      lambda_t in K (friction cone),  tau_min <= tau_t <= tau_max*

The state *x = (q, v)* is the full floating-base state, *u = tau* the joint torques, and contact wrenches *lambda* implicit variables resolved by the dynamics plus complementarity [4][5]. The running cost combines state regularization, control regularization about gravity compensation, foot-placement tracking, joint-limit penalties, wrench tracking, and center-of-pressure regularization [7].

The DDP solver's core backward-forward iteration is:

```python
def ddp_backward(xs, us, lam=1e-6):
    N = len(us)
    Vx, Vxx = lT_grad(xs[N]), lT_hess(xs[N])
    ks, Ks = [None]*N, [None]*N
    for t in reversed(range(N)):
        fx, fu = dynamics_jacobians(xs[t], us[t])
        lx, lu, lxx, lux, luu = cost_quadratics(xs[t], us[t])
        Qx  = lx + fx.T @ Vx
        Qu  = lu + fu.T @ Vx
        Qxx = lxx + fx.T @ Vxx @ fx
        Qux = lux + fu.T @ Vxx @ fx
        Quu = luu + fu.T @ Vxx @ fu + lam*np.eye(nu)  # regularized
        k = -np.linalg.solve(Quu, Qu)    # open-loop correction
        K = -np.linalg.solve(Quu, Qux)   # Riccati feedback gain
        ks[t], Ks[t] = k, K
        Vx  = Qx + K.T@Quu@k + K.T@Qu + Qux.T@k
        Vxx = Qxx + K.T@Quu@K + K.T@Qux + Qux.T@K
    return ks, Ks

def ddp_forward(xs, us, ks, Ks, alpha=1.0):
    xh, uh = [xs[0]], []
    for t in range(len(us)):
        du = alpha*ks[t] + Ks[t] @ (xh[t]-xs[t])  # feedback policy
        u = np.clip(us[t]+du, tau_min, tau_max)   # limits [2]
        uh.append(u); xh.append(dynamics(xh[t], u))
    return xh, uh
```

The loop is: measure at kilohertz rates, warm-start from the previous solution, run a few DDP iterations, and apply *u_0 + K_0 (x - x_0)* -- the Riccati gains providing kilohertz feedback *between* MPC solves at no extra cost [1][7].

> **Design principle.** *Plan with the full model at low rate; track with the value function's linearization at high rate.* The backward pass's Riccati gains are not a byproduct -- they are the real-time controller.

---

## 4 Deep Dive

### 4.1 Centroidal Dynamics as a Reduced-Order Model

The centroidal model keeps the six momentum equations exact while discarding joint-level dynamics. Its dynamics are *bilinear* in contacts -- products of lever arms and forces -- far friendlier to convex relaxations [3] and SQP [5] than the full rigid-body equations. The subtlety is the *centroidal inertia*: the angular-momentum rate alone does not determine base orientation; the momentum-to-angular-velocity map depends on the configuration-dependent locked inertia. Controllers approximate it as constant (valid for small orientation changes [3]), compute it from a reference kinematic trajectory, or enforce momentum consistency with full kinematics as constraints [5].

| Model | State dim. | Angular momentum | Contact forces | Nonconvexity | Typical use |
|---|---|---|---|---|---|
| Linear inverted pendulum | 4 | neglected | via ZMP | none | footstep planning |
| Centroidal dynamics | 9-12 | exact via *A_G* | explicit vars | bilinear | MPC at 20-100 Hz [3][5] |
| Full whole-body | 2(n+6) | implicit in *M(q)* | complementarity | severe | offline / slow MPC [4][7] |

*Key insight:* centroidal MPC is not a simplification of the physics -- it is an *exact projection* of it. Approximation enters only in reconstructing whole-body kinematics from the momentum trajectory [5].

### 4.2 Contact-Implicit Trajectory Optimization

Contact-implicit methods refuse to pre-commit to a contact sequence: the optimizer chooses states, controls, *and* contact forces jointly, with complementarity deciding at each knot whether a contact is active [4]. The discretized dynamics use a Stewart-Trinkle-like step where the impulse *lambda_i* enforces *phi(q_{i+1}) = 0* whenever *lambda_i > 0*:

*lambda_i^T phi(q_{i+1}) = 0,   phi(q_{i+1}) >= 0,   lambda_i >= 0*

Friction uses a linearized cone with a second complementarity on sliding velocity. The MPCC is typically solved by SQP with relaxed complementarity *lambda^T phi <= epsilon*, *epsilon -> 0*.

> **Theorem 1 (Contact-implicit feasibility).** *If the contact Jacobian has full row rank at the solution and mu > 0, any accumulation point of the relaxed problems with epsilon -> 0 satisfies the exact complementarity conditions and the discrete Newton-Euler equations -- i.e., it is a dynamically feasible contact trajectory [4].*

Three strategies dominate in practice:

1. **Relaxation/SQP** -- a sequence of NLPs with *epsilon_k -> 0* (Posa et al. [4]).
2. **Penalty/augmented Lagrangian** -- complementarity moved into the cost; simpler but ill-conditioned near convergence.
3. **Smoothing** -- softplus or Fischer-Burmeister smoothing restores differentiability for DDP-style solvers at the price of small interpenetration.

Complementarity is what lets the optimizer *discover* flight phases and heel-strikes without a mode schedule -- the central advantage over hybrid MPC with fixed contact sequences.

### 4.3 Differential Dynamic Programming: Backward and Forward Passes

DDP exploits Markovian structure: each backward step solves a tiny QP in the control dimension only, giving *linear* complexity in the horizon *T* instead of the cubic cost of a dense Newton step [1][7]. The recursion computes

*Q_uu = l_uu + f_u^T V'_xx f_u,   k = -Q_uu^{-1} Q_u,   K = -Q_uu^{-1} Q_ux*

with value updates *V_x = Q_x - Q_u^T Q_uu^{-1} Q_ux* (analogously *V_xx*). Regularization *Q_uu <- Q_uu + mu I* keeps steps well-defined far from the solution; backtracking line search on *alpha* guarantees cost decrease [1]. The control-limited variant [2] replaces the unconstrained minimization with a box-QP over *du*.

> **Theorem 2 (Local quadratic convergence of DDP).** *With twice-differentiable dynamics and costs and uniformly positive-definite Q_uu along the trajectory, DDP converges locally Q-quadratically: ||delta U_{k+1}|| <= c ||delta U_k||^2. The proof interprets DDP as Newton's method on the Bellman recursion; the Riccati gains K are exactly the Newton feedback [1].*

Practical whole-body codes use the *iLQR* (Gauss-Newton) variant, dropping the second-order dynamics tensors to halve backward-pass cost with negligible effect on the gains [7]. What matters at scale:

- **Warm starting** -- shifting the previous horizon forward typically cuts iterations 3-5x.
- **Parallel derivatives** -- rigid-body Jacobians (Pinocchio) evaluated across knots in parallel [7].
- **FDDP / Box-FDDP** -- feasibility-driven variants keeping rollouts dynamically consistent pre-convergence.
- **Contact smoothing** -- a soft contact model inside DDP dynamics avoids the non-differentiability that breaks the backward pass [1].

### 4.4 The Real-Time Pipeline: Timing, Horizons, and 1 kHz Tracking

Whole-body MPC never runs at the torque-loop rate; it sits in a *timing hierarchy*:

```tla
------------------------------ MODULE WB_MPC_Timing ------------------------------
EXTENDS Naturals
VARIABLES mpc_state, track_state, tick
MPCPeriod == 40     \* ms: one MPC solve per 40 ticks (25 Hz)
Init == mpc_state = "warm_start" /\ track_state = "nominal" /\ tick = 0
Tick ==
    /\ tick' = tick + 1
    /\ IF tick % MPCPeriod = 0
       THEN mpc_state' = "reoptimized"   \* DDP solve completes
       ELSE mpc_state' = mpc_state
    /\ track_state' = "u0 + K0*(x - x0)" \* Riccati feedback EVERY tick
    /\ UNCHANGED <<>>
Spec == Init /\ [][Tick]_<<mpc_state, track_state, tick>>
THEOREM Spec => []<>(mpc_state = "reoptimized")
=============================================================================
```

The MPC layer re-optimizes a 1.0--1.5 s horizon (100--150 knots) at 20--50 Hz while *delta u = K_0 delta x* runs at the full 1--2 kHz sensor rate [7]. Dantec et al. subscribe to Talos's state at 2 kHz, solve the whole-body OCP with Crocoddyl/Pinocchio on a workstation CPU, and stream the first torque plus feedback gains to the low-level controller -- dynamic walking and 10 cm stair-step crossing on a 32-DoF humanoid [7].

The budget decomposes roughly as: rigid-body derivatives 40-60%, backward Riccati recursion 25-35%, forward rollout and line search 10-20%. The backward pass is inherently sequential, so per-knot derivative cost dominates -- the reason reduced models (20-DoF lower body in [7]) and parallel derivative evaluation are standard.

### 4.5 Stability, Capture, and Viability

Practitioners often omit terminal costs, relying on a long horizon and replanning -- and it works [3][7]. The theory is less comfortable: without terminal ingredients, stability needs the horizon to exceed the system's controllability horizon. The classical lens is the *capture point* and its generalization, the *viability kernel* -- states from which *some* control keeps the robot upright forever. Centroidal momentum is exactly the right coordinate here, since capturability is a statement about momentum, not joints [6].

Two results connect the pieces. First, converged DDP's Riccati gains are the LQR gains of the linearized system, hence locally exponentially stabilizing [1]. Second, warm-started receding-horizon DDP inherits MPC's robustness to bounded disturbances: replanning every 20--40 ms corrects model error faster than it accumulates toward the viability boundary. The open problem is *certification*: no current whole-body MPC ships with a proven region of attraction, and push-recovery guarantees remain empirical [7].

---

## 5 Empirical Results and Proofs

The empirical record has grown from simplified models to full rigid-body dynamics within a decade:

| Method | Robot | Horizon | Solve rate | Demonstrated result |
|---|---|---|---|---|
| Convex MPC [3] | MIT Cheetah 3 | 0.5 s | < 1 ms at 20-30 Hz | 3 m/s gallop, 180 deg/s turn |
| Whole-body DDP [7] | Talos humanoid | 150 knots / 1.5 s | ~20-50 Hz | dynamic walk, 10 cm stair |
| Online DDP [1] | simulated humanoid | receding | real-time | get-up, acrobatic recovery |
| Centroidal + kinematics [5] | Atlas (offline) | full motion | minutes (SNOPT) | obstacle-course traversal |
| Contact-implicit SQP [4] | Spring Flamingo, FastRunner | full motion | minutes-hours | walking, fast running |
| Task-space conic WBC [8] | simulated humanoid | instantaneous | 1 kHz QP | dynamic kick, uneven jump |

Key takeaways:

- **Sub-millisecond convex MPC is real.** Di Carlo et al. [3] solve a 0.5 s centroidal QP in under 1 ms at 20--30 Hz -- assuming small roll/pitch and pre-specified contacts.
- **Whole-body DDP runs on hardware.** Dantec et al. [7] run 150-knot iLQR on Talos's 20-DoF lower body -- the first hardware whole-body MPC on a torque-controlled humanoid.
- **Contact-implicit discovery works but is slow.** Posa et al. [4] discover gaits from scratch, but MPCC-SQP takes minutes to hours: an offline planner, not a controller.
- **Feedback comes free.** In every DDP deployment the Riccati gains double as the high-rate stabilizer [1][7].

> **Theorem 3 (DDP as Newton on the Bellman recursion -- proof sketch).** *Eliminating state variations via the linearized dynamics turns the OCP's KKT system into a block-tridiagonal reduced Hessian in the control sequence; one DDP sweep with exact second-order dynamics applies exactly one Newton step to it. With Q_uu uniformly positive definite (Levenberg-Marquardt regularization), Newton converges Q-quadratically near a strict local minimizer satisfying second-order sufficient conditions. The iLQR variant retains superlinear convergence and is empirically indistinguishable [1][7].*

The caveat: these theorems assume *smooth* dynamics. Contact-implicit formulations violate this at mode transitions, where the value function is non-differentiable. Smoothing restores the theory at the cost of small physical inaccuracy -- the central tension between Sections 4.2 and 4.3, and why real-time systems fix the contact sequence and smooth only the force profile [7].

---

## 6 Limitations

- **Complementarity is nonconvex and degenerate.** The MPCC violates standard constraint qualifications at every feasible point with an active contact; solvers land on C-/M-stationary points whose physical meaning is murky, and solutions depend sensitively on initialization [4].
- **The centroidal inertia is state-dependent.** Convex centroidal MPC [3] assumes near-upright orientation; large pitch/roll motions (e.g., getting up [1]) break the QP structure.
- **Contact sequences are usually fixed.** Real-time whole-body DDP [7] takes footstep timing as user input; true contact-implicit discovery at 20+ Hz remains out of reach.
- **The upper body is often sacrificed.** Dantec et al. [7] optimize only the 20-DoF lower body, yet arm swing materially regulates centroidal angular momentum [6].
- **Compute is workstation-class.** 150-knot iLQR with Pinocchio derivatives needs a modern multi-core CPU; embedded deployment remains rare.
- **No certified region of attraction.** Stability is demonstrated empirically through push-recovery trials, not proven.
- **Sim-to-real contact modeling.** Rigid Coulomb contact is an idealization; foot deformation and stochastic slip are left for the kilohertz feedback layer to absorb.

---

## 7 Conclusion

Whole-body MPC reframes humanoid locomotion as what it truly is: a single optimal control problem over momenta, contacts, and torques. The synthesis here -- centroidal dynamics exposing the momentum structure [6], contact-implicit optimization discovering contact modes [4], and differential dynamic programming solving the resulting programs in real time [1][2] -- has carried the field from offline gait discovery to hardware: sub-millisecond convex MPC galloping a quadruped at 3 m/s [3], and 150-knot whole-body DDP walking a torque-controlled humanoid over stair steps [7].

The destination is not yet reached. A controller that *simultaneously* discovers contact sequences, reasons about the full 30+ DoF dynamics, respects torque and friction limits, and replans at tens of hertz on onboard compute does not exist today. Closing the gap needs solvers that handle complementarity at MPC rates without smoothing away the physics, structure-exploiting DDP scaling sub-linearly in model complexity, and stability theory that certifies the receding-horizon loop. Until then, the pragmatic architecture -- whole-body MPC for the plan, Riccati feedback for the kilohertz truth -- remains the state of the art, and a remarkably capable one.

---

## References

[1] Y. Tassa, T. Erez, and E. Todorov, "Synthesis and Stabilization of Complex Behaviors through Online Trajectory Optimization," in *Proc. IEEE/RSJ Int. Conf. on Intelligent Robots and Systems (IROS)*, 2012. [https://www2.imm.dtu.dk/courses/02465/_assets/tassa2012.pdf](https://www2.imm.dtu.dk/courses/02465/_assets/tassa2012.pdf)

[2] Y. Tassa, N. Mansard, and E. Todorov, "Control-Limited Differential Dynamic Programming," in *Proc. IEEE Int. Conf. on Robotics and Automation (ICRA)*, pp. 1168-1175, 2014. [https://doi.org/10.1109/ICRA.2014.6907001](https://doi.org/10.1109/ICRA.2014.6907001)

[3] J. Di Carlo, P. M. Wensing, B. Katz, G. Bledt, and S. Kim, "Dynamic Locomotion in the MIT Cheetah 3 Through Convex Model-Predictive Control," in *Proc. IEEE/RSJ Int. Conf. on Intelligent Robots and Systems (IROS)*, 2018. [https://dspace.mit.edu/server/api/core/bitstreams/474e8173-7b22-46e6-a51b-3d8e8a383357/content](https://dspace.mit.edu/server/api/core/bitstreams/474e8173-7b22-46e6-a51b-3d8e8a383357/content)

[4] M. Posa, C. Cantu, and R. Tedrake, "A Direct Method for Trajectory Optimization of Rigid Bodies Through Contact," *Int. J. Robotics Research*, 2016. [http://groups.csail.mit.edu/robotics-center/public_papers/Posa13.pdf](http://groups.csail.mit.edu/robotics-center/public_papers/Posa13.pdf)

[5] H. Dai, A. Valenzuela, and R. Tedrake, "Whole-Body Motion Planning with Centroidal Dynamics and Full Kinematics," in *Proc. IEEE-RAS Int. Conf. on Humanoid Robots*, pp. 295-302, 2014. [http://groups.csail.mit.edu/robotics-center/public_papers/Dai14.pdf](http://groups.csail.mit.edu/robotics-center/public_papers/Dai14.pdf)

[6] D. E. Orin and A. Goswami, "Centroidal Momentum Matrix of a Humanoid Robot: Structure and Properties," in *Proc. IEEE/RSJ Int. Conf. on Intelligent Robots and Systems (IROS)*, 2008. [https://www.researchgate.net/publication/224339669_Centroidal_Momentum_Matrix_of_a_Humanoid_Robot_Structure_and_Properties](https://www.researchgate.net/publication/224339669_Centroidal_Momentum_Matrix_of_a_Humanoid_Robot_Structure_and_Properties)

[7] E. L. Dantec, M. Naveau, N. Mansard, P. Fernbach, N. Villa, G. Saurel, O. Stasse, and M. Taix, "Whole-Body Model Predictive Control for Biped Locomotion on a Torque-Controlled Humanoid Robot," in *Proc. IEEE-RAS Int. Conf. on Humanoid Robots*, 2022. [https://hal.science/hal-03724019v2/file/Humanoid_final.pdf](https://hal.science/hal-03724019v2/file/Humanoid_final.pdf)

[8] P. M. Wensing and D. E. Orin, "Generation of Dynamic Humanoid Behaviors Through Task-Space Control with Conic Optimization," in *Proc. IEEE Int. Conf. on Robotics and Automation (ICRA)*, 2013. [http://www.mit.edu/~pwensing/Papers/WensingOrin13-ICRA.pdf](http://www.mit.edu/~pwensing/Papers/WensingOrin13-ICRA.pdf)
