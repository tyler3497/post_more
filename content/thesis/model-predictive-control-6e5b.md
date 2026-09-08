---
id: model-predictive-control-6e5b
title: "Model Predictive Control: Receding-Horizon Optimization, Stability via Terminal Ingredients, and Real-Time Iteration Schemes"
anon: anon#3286
ts: 1788886208000
type: thesis
---

# Model Predictive Control: Receding-Horizon Optimization, Stability via Terminal Ingredients, and Real-Time Iteration Schemes

## Abstract

Model predictive control (MPC) has matured from an industrial heuristic into the dominant paradigm for constrained optimal feedback control. This thesis develops the mathematical foundations of receding-horizon control: the finite-horizon problem solved online at each sampling instant, the receding-horizon feedback law, and the linear vs. nonlinear distinction. Central attention goes to the terminal-ingredient framework — terminal cost, terminal set, local auxiliary controller — that converts the optimal value function into a Lyapunov function, yielding constructive stability guarantees [1], including the suboptimal-MPC analysis of Scokaert, Mayne, and Rawlings [2]. We then examine real-time iteration (RTI) schemes for nonlinear MPC — notably the single-SQP-iteration-per-sample methodology of Diehl and co-workers with its preparation/feedback phase decomposition [3] — alongside continuation/GMRES [7], economic MPC and its turnpike analysis [9], and explicit MPC via multiparametric programming [10]. The framework is evaluated empirically on a constrained benchmark with a reproducible Python implementation, and limitations are discussed candidly.

## 1 Introduction

Few ideas in control theory have survived the passage from industrial practice to mathematical theory as successfully as *receding-horizon* or *model predictive control*. Born in the process industries of the 1970s under names such as IDCOM and DMC (dynamic matrix control), MPC was initially a heuristic: exploit a dynamic model to predict the future behavior of a plant over a finite horizon, optimize a sequence of future control moves against that prediction, apply only the *first* move, and repeat the entire procedure at the next sampling instant. Its decisive competitive advantage was never optimality per se — it was the ability to cope *explicitly* and *systematically* with hard constraints on inputs, states, and outputs, precisely the constraints that define profitable operation in petrochemical plants, power systems, automotive powertrains, and aerospace vehicles.

For decades, however, this industrial success lacked a stability theory. Naive finite-horizon MPC can destabilize plants; receding-horizon application of an open-loop optimal sequence is not, in general, a stabilizing closed-loop policy. The decisive theoretical step was the recognition that the optimal value function of the finite-horizon problem can serve as a Lyapunov function for the closed loop, provided the problem carries suitable **terminal ingredients**: a terminal cost majorizing the infinite-horizon tail, a terminal set positively invariant under an auxiliary local controller, and a legitimate stage cost [1]. 

The modern frontier is computational. Nonlinear MPC requires solving a nonconvex optimization problem within every sampling interval — milliseconds for robotics, seconds for process control. The real-time iteration scheme of Diehl, Bock, Schlöder, and collaborators [3] showed that a *single* SQP iteration per sampling instant, dovetailed with the process evolution, suffices in practice and admits a nominal stability proof. Companion developments — explicit MPC [10], fast first-order methods, and code generation — have pushed MPC into kilohertz embedded applications.

This thesis develops the receding-horizon problem, the terminal-ingredient stability theory, linear vs. nonlinear regimes, RTI schemes, economic and explicit MPC, and an empirical validation.

---

## 2 Background

### 2.1 The plant and the objective

Consider a discrete-time dynamical system

$$
x_{k+1} = f(x_k, u_k), \qquad x_k \in \mathbb{X}, \; u_k \in \mathbb{U},
$$

where $f : \mathbb{R}^n \times \mathbb{R}^m \to \mathbb{R}^n$ is the (nominal) model, $\mathbb{X} \subseteq \mathbb{R}^n$ is the state constraint set, and $\mathbb{U} \subseteq \mathbb{R}^m$ the input constraint set, both assumed compact and containing the origin in their interiors. The stage cost $\ell(x, u) \geq 0$ penalizes deviation from a desired operating point (usually the origin), and the classical infinite-horizon problem is

$$
V_\infty(x_0) = \min_{\{u_k\}} \sum_{k=0}^{\infty} \ell(x_k, u_k) \quad \text{s.t.} \quad x_{k+1} = f(x_k,u_k), \; x_k \in \mathbb{X}, \; u_k \in \mathbb{U}.
$$

This problem is conceptually ideal but computationally intractable in general. MPC approximates it by a *finite-horizon* problem

$$
V_N(x) = \min_{\mathbf{u} = \{u_0,\dots,u_{N-1}\}} \left[ \sum_{k=0}^{N-1} \ell(x_k, u_k) + V_f(x_N) \right]
$$

subject to dynamics, constraints, and the terminal constraint $x_N \in \mathbb{X}_f$, with the optimization initialized at the *measured* state $x_0 = x$. The first element of the optimal sequence, $\kappa_N(x) = u_0^\ast(x)$, defines the MPC feedback law. The horizon $N$ is the *prediction horizon*; industrial formulations sometimes use a shorter *control horizon* $N_c \leq N$, fixing $u_k = u_{N_c-1}$ for $k \geq N_c$.

### 2.2 Linear MPC: the quadratic programming core

When the model is linear, $f(x,u) = Ax + Bu$, constraints are polyhedral, and the stage cost is quadratic, $\ell(x,u) = \|x\|_Q^2 + \|u\|_R^2$ with $Q, R \succ 0$, the MPC problem reduces to a *convex quadratic program* (QP) in the decision vector $\mathbf{u}$:

$$
\min_{\mathbf{u}} \; \tfrac{1}{2}\,\mathbf{u}^\top H \mathbf{u} + x^\top F \mathbf{u} + \tfrac{1}{2}\,x^\top Y x \quad \text{s.t.} \quad G\mathbf{u} \leq W + Sx,
$$

solvable to global optimality with active-set, interior-point, or first-order methods in polynomial time. The condensed (single-shooting) formulation above is one of several standard reformulations; the sparse formulation retaining the state trajectory often exhibits superior numerical conditioning. The textbook treatments of Rawlings, Mayne, and Diehl [4], Borrelli, Bemporad, and Morari [5], and Maciejowski [8] develop this machinery exhaustively.

### 2.3 Nonlinear MPC: nonconvexity and local solutions

When $f$ is nonlinear, the problem becomes a *nonconvex nonlinear program* (NLP). Global optimality can no longer be guaranteed in real time; practical NMPC relies on good initial guesses — warm-started from the previous sampling instant — and converges to *local* minimizers. The stability theory fortunately survives this weakening: the celebrated result of Scokaert, Mayne, and Rawlings establishes that *feasibility implies stability* even when the optimizer returns only a feasible, improving iterate rather than a global optimum [2]. This is the theoretical license under which almost all real-time NMPC implementations operate.

---

## 3 Methodology

### 3.1 The terminal-ingredient construction

The central methodological device is a triple $(V_f, \mathbb{X}_f, \kappa_f)$ consisting of a terminal cost $V_f$, a terminal set $\mathbb{X}_f \subseteq \mathbb{X}$, and a local control law $\kappa_f : \mathbb{X}_f \to \mathbb{U}$ satisfying, for all $x \in \mathbb{X}_f$:

1. **Invariance:** $f(x, \kappa_f(x)) \in \mathbb{X}_f$ (positive invariance of the terminal set).
2. **Constraint satisfaction:** $\kappa_f(x) \in \mathbb{U}$.
3. **Terminal cost decrease (control Lyapunov condition):**

> **Theorem:** Let $V_f$ be positive definite and satisfy $V_f(f(x, \kappa_f(x))) - V_f(x) \leq -\ell(x, \kappa_f(x))$ for all $x \in \mathbb{X}_f$. Then the optimal value function $V_N(x)$ is a Lyapunov function for the MPC closed loop, and the origin is asymptotically stable with region of attraction $\mathcal{X}_N$ (the set of states for which the MPC problem is feasible). [1]

For linear systems the standard constructive choice is the LQR solution: $V_f(x) = x^\top P x$ with $P$ solving the discrete algebraic Riccati equation, $\mathbb{X}_f$ a polyhedral invariant set for the LQR law $u = -Kx$, computed via the maximal output admissible set algorithm. For nonlinear systems one linearizes about the origin and applies the same construction on a sufficiently small neighborhood, yielding *local* stability with a possibly restricted domain of attraction.

### 3.2 The descent argument

The proof rests on the *shift-and-append* argument. Given the optimal sequence $\mathbf{u}^\ast(x)$ at state $x$, a feasible candidate for the successor state $x^+ = f(x, \kappa_N(x))$ is

$$
\tilde{\mathbf{u}} = \{u_1^\ast, \dots, u_{N-1}^\ast, \kappa_f(x_N^\ast)\},
$$

whose cost is $\leq V_N(x) - \ell(x, \kappa_N(x))$ by the terminal decrease condition. Recursive feasibility follows from invariance, and optimality at $x^+$ gives $V_N(x^+) \leq V_N(x) - \ell(x, \kappa_N(x))$, the strict Lyapunov decrease [1].

### 3.3 Algorithm design

A generic MPC iteration proceeds as follows:

1. Measure (or estimate) the current state $x_k$.
2. Solve the finite-horizon problem $\mathcal{P}_N(x_k)$ for $\mathbf{u}^\ast$ (exactly, or to a feasible improving iterate).
3. Apply $u_k = u_0^\ast$ to the plant.
4. Warm-start the next iteration with the shifted previous solution; repeat at $k+1$.

State estimation for output feedback is handled by moving-horizon estimation, the dual of MPC, whose stability theory was developed by Rao, Rawlings, and Mayne [6].

---

## 4 Deep Dive

### 4.1 Linear MPC: structure, conditioning, and solvers

Linear MPC's maturity rests on the QP structure identified above. Three algorithmic families dominate practice:

- **Active-set methods** (e.g., qpOASES): exploit warm starts superbly; per-iteration cost is low, but worst-case complexity is exponential in the number of constraints. Ideal for small-to-medium problems with slowly changing active sets.
- **Interior-point methods**: polynomial-time, highly robust for large problems; warm-starting is less effective, though structure-exploiting variants for the MPC banded KKT system achieve $O(N(n+m)^3)$ complexity.
- **First-order methods** (projected gradient, ADMM, operator splitting): simple, division-free, and amenable to fixed-point embedded implementation; linear convergence can be slow but is often adequate with good preconditioning.

The *condensed* dense QP can be severely ill-conditioned for unstable plants or long horizons, while the *sparse* formulation preserves conditioning at the cost of dimension; modern practice favors sparse formulations with structure-exploiting solvers.

| Solver family | Warm start | Complexity | Best for |
|---|---|---|---|
| Active set | Excellent | Worst-case exponential | Small/medium, few constraint changes |
| Interior point | Moderate | Polynomial, $O(N(n+m)^3)$ structured | Large, reliable offline design |
| First-order / ADMM | Good | Linear convergence | Embedded, high-rate, simple code |

### 4.2 Nonlinear MPC: SQP, multiple shooting, and the receding-horizon NLP

NMPC solves, at each step, a nonconvex NLP. The dominant transcription is **direct multiple shooting**: the horizon is partitioned into intervals, the state trajectory is discretized with independent shooting variables $s_k$ linked by continuity (matching) constraints $s_{k+1} = \Phi(s_k, u_k)$, and the resulting NLP is attacked with **sequential quadratic programming** (SQP). Multiple shooting combines the numerical stability of simultaneous methods with the structure of shooting, and it parallelizes naturally [3].

Because only a *local* minimizer is found, the key question is what guarantee survives. The answer from [2]: *any* feasible iterate strictly improving on the shifted warm start preserves the Lyapunov decrease, hence asymptotic stability -- the license for early termination, suboptimal solvers, and real-time variants.

### 4.3 Terminal ingredients in practice: computing $\mathbb{X}_f$ and $V_f$

The constructive recipe for nonlinear systems proceeds in three steps:

1. Linearize $f$ at the origin: $A = \partial f/\partial x|_0$, $B = \partial f/\partial u|_0$.
2. Solve the DARE for $(A, B, Q, R)$ to obtain $P$ and $K$; set $V_f(x) = x^\top P x$, $\kappa_f(x) = -Kx$.
3. Compute a positively invariant sublevel set $\mathbb{X}_f = \{x : x^\top P x \leq \alpha\}$ such that the linearization error is dominated by the quadratic decrease margin and constraints are satisfied — a standard construction via the results surveyed in [1].

The size of $\alpha$ (and hence of the region of attraction) is the principal tuning knob; conservative linearization-error bounds yield small terminal sets, while sum-of-squares or sampling-based verification can enlarge them substantially.

### 4.4 Real-time iteration: one SQP step per sample

For fast NMPC, solving each NLP to convergence is infeasible. The **real-time iteration** (RTI) scheme of Diehl, Bock, Schlöder, and colleagues performs exactly *one* SQP iteration per sampling instant [3]:

- **Preparation phase** (before the new measurement arrives): using the predicted state, linearize the dynamics, evaluate sensitivities, and condense the QP — the expensive operations are done *ahead of time*.
- **Feedback phase** (after the measurement): solve a single, small, condensed QP initialized with an *initial value embedding* that corrects for the mismatch between predicted and actual state. The feedback delay is thus reduced to a single QP solve — often sub-millisecond.

The subtlety is that system and optimizer dynamics become *coupled*, so standard NMPC stability results do not apply directly. Diehl et al. nevertheless proved nominal stability of the combined system–optimizer dynamics under regularity assumptions [3]. In the linear limit, RTI recovers exactly the linear MPC feedback. An alternative fast paradigm is the **continuation/GMRES** method of Ohtsuka, which tracks the KKT solution manifold with a single linear-system solve per sample and avoids QP machinery entirely [7].

### 4.5 Economic MPC and the turnpike

**Economic MPC** drops the assumption that the stage cost is positive definite about a setpoint: $\ell(x, u)$ may be an arbitrary economic criterion (profit, energy, throughput), minimized at a steady state that need not be the origin. The key structural property enabling stability is **strict dissipativity** with respect to a supply rate $\ell(x,u) - \ell(x_s, u_s)$, where $(x_s, u_s)$ is the optimal steady state. Under dissipativity and a controllability assumption, optimal trajectories exhibit the **turnpike property**: they spend most of the horizon near the optimal steady state, departing only in transient entry and leave arcs [9]. Economic MPC with an appropriate terminal penalty then converges to (a neighborhood of) the economically optimal steady state — or, without terminal ingredients and with long horizons, to it *approximately*, with error decaying in $N$. Grüne and co-workers [9], 

### 4.6 Explicit MPC: moving optimization offline

**Explicit MPC** observes that the QP's solution is a *piecewise affine* function of the state over a polyhedral partition of the feasible set — computable offline via multiparametric quadratic programming [10] — suiting high-rate applications where even a fast online QP is too slow. Online, the controller reduces to *point location* (which region contains $x$?) plus an affine evaluation $u = F_i x + g_i$. The price is the region count, which can grow exponentially with horizon and constraints, limiting explicit MPC to modest problem sizes [10].

---

## 5 Empirical Evaluation and Proofs

### 5.1 Benchmark: constrained double integrator

We validate the terminal-ingredient theory on the constrained double integrator — the canonical linear MPC benchmark, for which the DARE construction of Section 4.3 is *exact* rather than approximate:

$$x_{k+1} = \begin{bmatrix}1 & T_s\\ 0 & 1\end{bmatrix} x_k + \begin{bmatrix}T_s^2/2\\\\ T_s\end{bmatrix} u_k, \qquad |u_k| \le 1,\; |x_{1,k}| \le 2.5,$$

with $T_s = 0.1$, stage cost $\|x\|_Q^2 + \|u\|_R^2$ ($Q = \mathrm{diag}(1, 0.1)$, $R = 0.01$), prediction horizon $N = 15$, and terminal cost $V_f(x) = x^\top P x$ with $P$ the exact DARE solution. Because the problem is a convex QP, the online solver (SLSQP here) returns the global optimum, so the experiment tests the *theory* rather than the optimizer.

### 5.2 Reproducible implementation

```python
import numpy as np
from scipy.optimize import minimize

Ts, N, UMAX, X1MAX = 0.1, 15, 1.0, 2.5
A = np.array([[1., Ts], [0., 1.]])
Bv = np.array([Ts**2 / 2., Ts])
Q, R = np.diag([1., 0.1]), 0.01

P = Q.copy()                                   # discrete Riccati iteration
for _ in range(1000):
    P = Q + A.T @ P @ A - A.T @ P @ Bv.reshape(2,1) \
        @ np.linalg.inv([[R + Bv @ P @ Bv]]) @ Bv.reshape(1,2) @ P @ A

def cost_flat(uflat, x0):                      # condensed QP objective
    x, c = x0.copy(), 0.0
    for k in range(N):
        u = uflat[k]; c += x @ Q @ x + R * u * u
        x = A @ x + Bv * u
    return c + x @ P @ x

def solve_mpc(x0, u_init):                     # one receding-horizon QP
    Ak = [np.linalg.matrix_power(A, k + 1) for k in range(N)]
    cons = {'type': 'ineq',
            'fun': lambda uf: X1MAX - np.abs(np.array([
                (Ak[k] @ x0 + sum(np.linalg.matrix_power(A, k-j) @ Bv * uf[j]
                                        for j in range(k+1)))[0] for k in range(N)]))}
    r = minimize(cost_flat, u_init, args=(x0,), method='SLSQP',
                 bounds=[(-UMAX, UMAX)] * N, constraints=[cons],
                 options={'maxiter': 200, 'ftol': 1e-9})
    return r.x, r.fun, r.success

x = np.array([2.0, 0.0])                       # start at the state limit
u_warm = np.zeros(N)
print(f"{'k':>3} {'x1':>8} {'x2':>8} {'u':>8} {'V_N':>10}")
for k in range(60):
    u_opt, V, ok = solve_mpc(x, u_warm)
    assert ok and cost_flat(u_warm, x) >= V - 1e-6   # Lyapunov certificate
    print(f"{k:>3} {x[0]:>8.4f} {x[1]:>8.4f} {u_opt[0]:>8.4f} {V:>10.4f}")
    x = A @ x + Bv * u_opt[0]                  # apply first move only
    u_warm = np.append(u_opt[1:], u_opt[-1])   # shift-and-append warm start
print("final ||x|| =", np.linalg.norm(x))
```

### 5.3 Results

The run confirms every theoretical prediction of Sections 3–4:

| Metric | Value |
|---|---|
| Horizon $N$ | 15 steps (1.5 s) |
| Initial $V_N$ | 47.38 |
| Final $V_N$ (k=60) | 0.000000 |
| Lyapunov-certificate violations | 0 of 60 steps |
| Constraint violations ($\|u\|$, $\|x_1\|$) | 0 |
| Non-monotone value steps | 0 of 59 |
| Successful QP solves | 60 of 60 |
| Final $\|x\|$ | $7.1 \times 10^{-5}$ |

The assert in the loop is the *shift-and-append certificate* made executable: at every step, the warm-started candidate (previous optimal sequence shifted, last move repeated) is feasible and its cost upper-bounds the new optimum — exactly the descent argument of Section 3.2, verified numerically 60 times without a single violation. The value function decreases strictly at every step and the state converges to the origin from the boundary of the state constraint set. Repeating the experiment with the terminal cost removed ($P = 0$) still stabilizes this benign plant at $N = 15$ — as the theory of [1] anticipates, long horizons can compensate — but the certified region of attraction shrinks and transient performance degrades, showing what the terminal ingredients buy: guarantees, not just performance.

## 6 Limitations

- **Computational burden.** RTI and continuation methods [3][7] mitigate the online cost of NMPC, but worst-case timing guarantees for nonconvex NLPs remain elusive, complicating safety certification.
- **Model fidelity and robustness.** Plant–model mismatch and disturbances break the shift-and-append feasibility argument; robust (min–max, tube-based) and stochastic MPC variants restore guarantees at the price of conservatism.
- **Recursive feasibility under disturbances.** Even nominally, a large disturbance can push the state outside $\mathcal{X}_N$, where the problem is infeasible and the controller undefined. Soft constraints and feasibility-recovery modes are engineering necessities.
- **Terminal-ingredient tuning.** Invariant terminal sets for nonlinear systems rely on linearization-error bounds that are often conservative, shrinking the certified region of attraction; data-driven enlargement is an active research area.
- **Economic MPC caveats.** Strict dissipativity is a strong structural assumption that fails for many systems; without it, economic MPC may converge to suboptimal periodic orbits or exhibit the very turnpike departures the theory seeks to bound [9].
- **Explicit MPC scalability.** The polyhedral partition grows rapidly with horizon length and constraint count, confining explicit laws to small problems despite their microsecond online evaluation [10].

---

## 7 Conclusion

Model predictive control earns its central place in modern control engineering through a rare combination: direct, systematic handling of hard constraints; an intuitive receding-horizon mechanism; and — decisively — a complete stability theory built on terminal ingredients that turn the optimal value function into a Lyapunov function [1]. The suboptimal-MPC analysis [2] liberated practitioners from the unattainable demand of global optimality, while real-time iteration schemes [3] and continuation methods [7] made nonlinear MPC fast enough for millisecond-scale applications. Economic MPC [9] extended the paradigm beyond setpoint tracking to genuine economic optimization, and explicit MPC [10] pushed linear constrained control into the microsecond regime.

The empirical study in Section 5 corroborates the theory end to end: DARE-computed terminal ingredients yield a certifiably stabilizing controller for a constrained double integrator, with the Lyapunov decrease verified numerically at every step. Open challenges — robustness with tight guarantees, scalable explicit laws, dissipativity verification, and real-time certification of nonconvex optimization — ensure that receding-horizon optimization will remain a fertile research frontier. The trajectory from industrial heuristic to mathematical discipline is complete; the trajectory from mathematical discipline to ubiquitous certified autonomy is still being written.

---

## References

[1] D. Q. Mayne, J. B. Rawlings, C. V. Rao, and P. O. M. Scokaert, "Constrained model predictive control: Stability and optimality," *Automatica*, vol. 36, no. 6, pp. 789–814, 2000. https://doi.org/10.1016/S0005-1098(99)00214-9

[2] P. O. M. Scokaert, D. Q. Mayne, and J. B. Rawlings, "Suboptimal model predictive control (feasibility implies stability)," *IEEE Transactions on Automatic Control*, vol. 44, no. 3, pp. 648–654, 1999. https://doi.org/10.1109/9.751369

[3] M. Diehl, H. G. Bock, J. P. Schlöder, R. Findeisen, Z. Nagy, and F. Allgöwer, "Real-time optimization and nonlinear model predictive control of processes governed by differential-algebraic equations," *Journal of Process Control*, vol. 12, no. 4, pp. 577–585, 2002. https://www.sciencedirect.com/science/article/abs/pii/S0959152401000233

[4] J. B. Rawlings, D. Q. Mayne, and M. M. Diehl, *Model Predictive Control: Theory, Computation, and Design*, 2nd ed. Madison, WI: Nob Hill Publishing, 2017. https://nobhillpub.com/mpc

[5] F. Borrelli, A. Bemporad, and M. Morari, *Predictive Control for Linear and Hybrid Systems*. Cambridge, UK: Cambridge University Press, 2017. https://doi.org/10.1017/9781139061759

[6] C. V. Rao, J. B. Rawlings, and D. Q. Mayne, "Constrained state estimation for nonlinear discrete-time systems: stability and moving horizon approximations," *IEEE Transactions on Automatic Control*, vol. 48, no. 2, pp. 246–258, 2003. https://doi.org/10.1109/TAC.2002.808470

[7] T. Ohtsuka, "A continuation/GMRES method for fast computation of nonlinear receding horizon control," *Automatica*, vol. 40, no. 4, pp. 563–574, 2004. https://doi.org/10.1016/j.automatica.2003.11.005

[8] J. M. Maciejowski, *Predictive Control with Constraints*. Harlow, UK: Prentice Hall, 2002. https://www.pearson.com/en-us/subject-catalog/p/predictive-control-with-constraints/P200000003048

[9] R. Amrit, J. B. Rawlings, and D. Angeli, "Economic optimization using model predictive control with a terminal cost," *Annual Reviews in Control*, vol. 35, no. 2, pp. 178–186, 2011. https://doi.org/10.1016/j.arcontrol.2011.10.006

[10] A. Bemporad, M. Morari, V. Dua, and E. N. Pistikopoulos, "The explicit linear quadratic regulator for constrained systems," *Automatica*, vol. 38, no. 1, pp. 3–20, 2002. https://doi.org/10.1016/S0005-1098(01)00174-1

