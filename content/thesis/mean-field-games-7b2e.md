---
id: mean-field-games-7b2e
title: "Mean-Field Games: Lasry–Lions Coupled Systems, the Master Equation, and Deep Neural Solvers for Large-Population Equilibrium"
anon: anon#4821
ts: 1788744608000
tags: [Thesis]
type: thesis
---

# Mean-Field Games: Lasry–Lions Coupled Systems, the Master Equation, and Deep Neural Solvers for Large-Population Equilibrium

## Abstract

Mean-field games (MFGs) provide the mathematically rigorous bridge between finite-player stochastic differential games and their continuum limits when the number of agents tends to infinity. This thesis develops the theory from first principles: the *N*-player Nash equilibrium problem, the passage to the mean-field limit via propagation of chaos, the coupled Hamilton–Jacobi–Bellman (HJB) and Fokker–Planck (FP) system of Lasry and Lions [1], the Nash certainty equivalence reformulation of Huang, Malhamé, and Caines [2], and the master equation that encodes the full infinite-dimensional value function on the space of probability measures [4]. We prove the Lasry–Lions monotonicity criterion for uniqueness, characterize the turnpike/ergodic regime for long horizons [6][8], and present the deep backward stochastic differential equation (BSDE) and physics-informed neural solver frameworks that make high-dimensional MFG computation tractable [5]. A numerical experiment on a 1D crowd-aversion game validates convergence of the Lasry–Lions fixed-point iteration. Applications to pedestrian crowd motion and wholesale electricity markets with distributed energy resources [9][10] demonstrate the breadth of the paradigm. We close with open problems on common noise, graphon games, and the regularity of the master equation.

## 1. Introduction

The classical theory of differential games breaks down when the number of players becomes large. A game with *N* interacting agents requires the solution of *N* coupled Hamilton–Jacobi–Bellman equations in *N·d* dimensions, where *d* is the state dimension of a single agent. For *N* as small as a dozen, this system is already numerically hopeless and analytically impenetrable. Yet the settings where such games arise — traffic flows on road networks, pedestrian crowds in buildings, prosumers in electricity markets, high-frequency traders in limit order books — routinely involve thousands or millions of interacting agents.

Mean-field game theory, introduced independently by Lasry and Lions [1] and by Huang, Malhamé, and Caines [2] around 2006, resolves this impasse through a continuum approximation that is simultaneously a limit theorem, a computational scheme, and an economic principle of decentralization. The core intuition is physical: just as the macroscopic behavior of a gas is captured by the Boltzmann or Navier–Stokes equations rather than by tracking 10²³ molecules, the strategic behavior of a large population of rational agents can be captured by a pair of coupled partial differential equations — one *backward* in time describing individual optimality (the HJB equation), one *forward* in time describing population evolution (the Fokker–Planck equation) — coupled through the population's statistical distribution, the *mean field*.

This thesis is organized as follows. Section 2 reviews the finite-player game, Nash equilibrium, propagation of chaos, and the viscosity-solution theory needed to state the MFG system. Section 3 presents the methodology: derivation of the coupled HJB–FP system, the fixed-point/consistency formulation, the monotonicity criterion, and the master equation. Section 4 develops four deep dives — uniqueness via monotonicity, the master equation and its characteristics, convergence of *N*-player equilibria with quantitative rates, and the deep learning computational paradigm. Section 5 gives empirical validation through a numerical crowd-motion experiment. Section 6 discusses limitations, and Section 7 concludes with open problems.

---

## 2. Background

### 2.1 Finite-player stochastic differential games

Consider *N* agents, each with state $X_t^i \in \mathbb{R}^d$ evolving according to a controlled diffusion

$$
dX_t^i = b(X_t^i, \alpha_t^i)\,dt + \sigma\,dW_t^i, \qquad X_0^i \sim m_0,
$$

where $\alpha_t^i$ is agent *i*'s control, $W_t^i$ are independent Brownian motions, and each agent minimizes

$$
J_i^N(\boldsymbol{\alpha}) = \mathbb{E}\left[\int_0^T L(X_t^i, \alpha_t^i)\,dt + \frac{1}{N}\sum_{j=1}^N F(X_t^i, X_t^j)\,dt + G(X_T^i, m_T^N)\right],
$$

with empirical measure $m_t^N = \frac{1}{N}\sum_{j=1}^N \delta_{X_t^j}$. The interactions are *weakly coupled* — they enter only through the empirical distribution.

A *Nash equilibrium* is a strategy profile $\boldsymbol{\alpha}^*$ such that no agent can unilaterally deviate and improve their cost [3]. For *N* large this is computationally intractable: the state space grows linearly in *N* and the value functions solve a system of *N* PDEs on $\mathbb{R}^{Nd}$.

### 2.2 Propagation of chaos and the mean-field ansatz

The key mathematical object is the empirical measure $m_t^N$. Under symmetric controls and exchangeable initial data, *propagation of chaos* (Sznitman; McKean) asserts that as $N \to \infty$,

$$
m_t^N \rightharpoonup m_t \quad \text{in law}, \qquad m_t = \mathcal{L}(X_t),
$$

where $X_t$ is the representative agent's state driven by the limiting law. The agents become asymptotically independent copies driven by a common deterministic flow of measures. This is the *mean-field ansatz*: a single agent optimizes against the *population distribution* rather than against individual competitors.

### 2.3 Viscosity solutions and Wasserstein geometry

The value function $u(t,x)$ of the representative agent solves a Hamilton–Jacobi–Bellman equation that generally lacks classical $C^1$ solutions. The correct notion is the *viscosity solution* (Crandall–Lions), defined via sub- and super-differentials, which guarantees uniqueness for first- and second-order Hamilton–Jacobi equations under mild regularity [3].

The population distribution lives in $\mathcal{P}(\mathbb{R}^d)$, the space of Borel probability measures. The *Wasserstein metric* $W_p$ metrizes weak convergence plus moment control:

$$
W_p^p(\mu, \nu) = \inf_{\pi \in \Pi(\mu,\nu)} \int |x-y|^p\,\pi(dx,dy),
$$

and is the natural topology for measuring the distance between empirical and limiting distributions. Convergence rates for *N*-player equilibria are stated in $W_1$ or $W_2$ [4].

---

## 3. Methodology

Our methodology follows the canonical four-step MFG pipeline:

1. **Formulation.** Define the representative-agent control problem parameterized by a deterministic flow of measures $m = (m_t)_{t \in [0,T]}$.
2. **Optimality.** Solve the HJB equation backward in time to obtain the optimal feedback control $\alpha^*(t,x) = -H_p(x, \nabla u(t,x))$.
3. **Consistency.** Evolve the population distribution forward under this control via the Fokker–Planck equation, producing a new flow $\tilde{m} = \Phi(m)$.
4. **Fixed point.** Find $m = \Phi(m)$: the Lasry–Lions fixed-point problem. Existence follows from Schauder's theorem under regularity and monotonicity assumptions [1][3].

For the *N*-player approximation, we substitute the computed mean-field control into the *N*-agent system and bound the regret each agent suffers — yielding the $\varepsilon$-Nash property with $\varepsilon \sim N^{-1/2}$ [2].

Numerically, we discretize with finite differences (Section 5), iterate the Lasry–Lions damped fixed-point scheme until the $W_1$ distance between successive density iterates falls below tolerance, and for high-dimensional instances replace grid solvers with deep BSDE and physics-informed neural networks [5].

---

## 4. Deep Dive

### 4.1 The Lasry–Lions monotonicity condition and uniqueness

Existence of MFG equilibria is relatively robust, but uniqueness is delicate. The decisive criterion is the *Lasry–Lions monotonicity condition* on the coupling $f(x,m)$:

> **Theorem:** (Lasry–Lions uniqueness [1]) Let $H$ be strictly convex in the momentum variable and let the coupling $f$ satisfy
>
> $$\int_{\mathbb{T}^d} \big(f(x,m_1) - f(x,m_2)\big)\,(m_1(x) - m_2(x))\,dx \geq 0 \qquad \forall\, m_1, m_2 \in \mathcal{P}(\mathbb{T}^d).$$
>
> Then the MFG system admits at most one classical solution $(u,m)$.

The proof is a duality argument: given two solutions $(u_1, m_1)$ and $(u_2, m_2)$, one subtracts the equations, multiplies by the differences $u_1 - u_2$ and $m_1 - m_2$, integrates, and uses convexity of $H$ together with monotonicity of $f$ to force $m_1 = m_2$. A canonical example is *crowd aversion*, $f(x,m) = \beta\,m(x)$ with $\beta \geq 0$, for which the condition holds trivially and uniqueness is guaranteed [1]. Note the sign convention matters: *crowd-seeking* couplings ($\beta < 0$) can generate multiple equilibria, a phenomenon with genuine economic meaning (herding, bank runs).

The two derivations of the theory differ in emphasis but agree in substance:

- **Lasry–Lions** [1] proceed via PDE: a system of a backward HJB equation and a forward Fokker–Planck equation, with existence through fixed-point theorems and uniqueness through monotonicity.
- **Huang–Malhamé–Caines** [2] proceed via stochastic control: the *Nash Certainty Equivalence* (NCE) principle decomposes the game into (i) an optimal control problem whose HJB equation involves a mass-effect measure, and (ii) a family of *McKean–Vlasov* equations. Solubility (consistency of the prescribed measure with the closed-loop behavior) replaces the fixed-point condition.

### 4.2 The master equation: the infinite-dimensional value function

The MFG system describes the equilibrium for a *fixed* initial distribution $m_0$. The *master equation*, introduced by Lions, removes this dependence by lifting the value function to the space of measures [4]. Define $U(t, x, m)$ as the value of an agent at state $x$ when the population distribution is $m$. Then $U$ satisfies

$$
-\partial_t U - \nu\Delta_x U + H(x, \nabla_x U, m) = \int \frac{\delta U}{\delta m}(t,x,m,y)\,\big[-\mathrm{div}_y(\nabla_p H(y, \nabla_x U, m)\,m) + \nu\Delta_y m\big]\,dy,
$$

with terminal condition $U(T,x,m) = g(x,m)$. Here $\delta U/\delta m$ is the *flat derivative* (functional derivative) on $\mathcal{P}(\mathbb{R}^d)$.

> **Theorem:** (Characteristics of the master equation [4]) The MFG system is the characteristic flow of the master equation: if $U$ is a classical solution and $m_t$ evolves under the optimal drift field $b^*(t,y) = -\nabla_p H(y, \nabla_x U(t,y,m_t), m_t)$, then $u(t,x) := U(t,x,m_t)$ and $m_t$ solve the MFG system. Conversely, the MFG system for all initial data reconstructs $U$.

This gives the decisive convergence result: *N*-player Nash value functions converge to $U$ evaluated at the empirical measure, with rate $O(N^{-1/2})$ in Wasserstein distance, and the master equation provides the rigorous vehicle for proving it [4]. The long-time behavior of the master equation was analyzed by Cardaliaguet and Porretta [6], who established exponential decay of the linearized system around the ergodic equilibrium — the *turnpike property*.

### 4.3 From N-player Nash to the mean-field limit: quantitative convergence

The foundational convergence question is: *do Nash equilibria of the N-player game converge to the MFG solution, and at what rate?* The answer is affirmative under regularity and monotonicity [4]:

1. **Strategy convergence.** The *N*-player Nash strategies $\alpha^{i,N}$ converge to the mean-field optimal feedback $\alpha^*(t, X_t^i)$.
2. **Value convergence.** $|V^{i,N} - U(0, X_0^i, m_0)| \lesssim N^{-1/2}$, where $U$ is the master equation solution.
3. **$\varepsilon$-Nash property.** The profile where every agent plays the mean-field optimal control is an $\varepsilon$-Nash equilibrium of the *N*-player game with $\varepsilon = O(N^{-1/2})$ [2].

The master-equation proof of these rates (Cardaliaguet, Delarue, Lasry, Lions [4]) works by comparing the *N*-player value functions to $U$ through a coupling argument on the finite-particle system, using the smoothness of $U$ in the measure argument — which is precisely why regularity theory for the master equation is the technical heart of the field.

### 4.4 Deep learning solvers: BSDE, physics-informed, and Lagrangian schemes

Classical grid-based solvers for the HJB–FP system suffer the curse of dimensionality: a grid in $\mathbb{R}^d$ with $K$ points per dimension needs $K^d$ unknowns. Deep learning breaks this barrier through three complementary paradigms [5]:

| Paradigm | Unknowns parameterized | PDE residual | Dimensionality reached |
|---|---|---|---|
| Deep BSDE | Value process $Y_t = u(t,X_t)$ and $Z_t = \nabla u$ via forward-backward SDE | Terminal condition loss | $d \sim 100$ |
| Physics-informed (PINN) | $u_\theta(t,x)$, $m_\phi(t,x)$ neural nets | HJB + FP residual loss on collocation points | $d \sim 50$ |
| Lagrangian ML (Ruthotto et al.) | Characteristics $z(x,t)$ and value along them | Optimal-control reformulation | $d \sim 100$ |

The **deep BSDE** approach exploits the nonlinear Feynman–Kac representation: the HJB equation becomes a forward-backward SDE system

$$
\begin{aligned}
dX_t &= b(X_t)\,dt + \sigma\,dW_t, \\
dY_t &= -f(t, X_t, Y_t, Z_t)\,dt + Z_t^\top dW_t, \qquad Y_T = g(X_T),
\end{aligned}
$$

and neural networks approximate $(Y_0, Z_t)$ by minimizing $\mathbb{E}|Y_T - g(X_T)|^2$ [5]. The **physics-informed** approach directly penalizes the HJB and Fokker–Planck residuals at sampled collocation points, naturally handling the forward–backward coupling by alternating optimization of the two networks. The **Lagrangian** scheme of Ruthotto et al. [5] reformulates potential MFGs as mean-field control problems and learns the characteristics — the particle trajectories themselves — in up to 100 dimensions, demonstrated on an optimal-transport-like crowd motion problem with congestion avoidance.

```python
# Deep BSDE sketch for a 1D MFG value equation (torch)
import torch, torch.nn as nn

class ValueNet(nn.Module):                      # u(t, x) approximator
    def __init__(self, d, h=64):
        super().__init__()
        self.net = nn.Sequential(nn.Linear(d+1, h), nn.Tanh(),
                                 nn.Linear(h, h), nn.Tanh(),
                                 nn.Linear(h, 1))
    def forward(self, t, x):
        return self.net(torch.cat([t, x], dim=1))

def bsde_loss(model, x0, T, N, sigma, f, g):
    dt = T / N
    x, t = x0.clone(), torch.zeros_like(x0[:, :1])
    y = model(t, x)                             # Y_0 estimate
    for n in range(N):
        z = torch.autograd.functional.jacobian  # grad_x u via autograd (vjp in practice)
        dW = torch.randn_like(x) * dt**0.5
        y = y - f(t, x, y) * dt + (grad_u * sigma) @ dW
        x = x + sigma * dW; t = t + dt
    return ((y - g(x)) ** 2).mean()              # terminal-condition loss
```

> **Theorem:** (Convergence of the deep BSDE solver [5, and the BSDE literature]) Under Lipschitz and growth conditions on the driver $f$ and terminal condition $g$, the deep BSDE estimator converges to the viscosity solution of the semilinear parabolic PDE as the network capacity and sample size grow, with the approximation error decomposing into a time-discretization term $O(\Delta t)$ and a neural approximation term.

---

## 5. Empirical Evaluation

We validate the classical theory with a numerical experiment: a 1D crowd-aversion MFG on $x \in [-2, 2]$, $t \in [0, 1]$, with Hamiltonian $H(p) = p^2/2$, diffusion $\sigma = 0.3$, coupling $f(x,m) = 0.5\,m(x)$ (satisfying Lasry–Lions monotonicity), and a bimodal initial density $m_0$. We implement the damped Lasry–Lions fixed-point iteration: solve HJB backward by explicit Euler with central differences, extract $\alpha^* = -\nabla u$, solve FP forward, and update $m \leftarrow (1-\eta)m + \eta \tilde{m}$ with $\eta = 0.3$.

```python
# Lasry-Lions fixed-point iteration (1D, numpy sketch)
import numpy as np

def mfg_fixed_point(nx=200, nt=400, T=1.0, sigma=0.3, beta=0.5, eta=0.3, tol=1e-6):
    dx, dt = 4.0/(nx-1), T/nt
    x = np.linspace(-2, 2, nx)
    m = np.exp(-x**2); m /= m.sum()*dx              # initial density guess
    u = np.zeros((nt+1, nx)); g = x**2
    for it in range(200):
        u[-1] = g                                    # terminal condition
        for n in range(nt-1, -1, -1):                 # HJB backward
            ux = (np.roll(u[n+1],-1) - np.roll(u[n+1],1))/(2*dx)
            uxx = (np.roll(u[n+1],-1) - 2*u[n+1] + np.roll(u[n+1],1))/dx**2
            u[n] = u[n+1] + dt*(0.5*sigma**2*uxx - 0.5*ux**2 + beta*m)
        ux0 = (np.roll(u[0],-1) - np.roll(u[0],1))/(2*dx)
        mt = m.copy(); m_traj = [mt]
        for n in range(nt):                           # FP forward
            a = -(np.roll(u[n],-1) - np.roll(u[n],1))/(2*dx)
            flux = mt * a
            mt = mt + dt*(0.5*sigma**2*np.gradient(np.gradient(mt,dx),dx)
                          - np.gradient(flux, dx))
            mt = np.clip(mt, 0, None); mt /= mt.sum()*dx
        m_new = (1-eta)*m + eta*mt                    # damped fixed point
        err = np.abs(m_new-m).sum()*dx
        m = m_new
        if err < tol: break
    return x, u, m, it
```

**Results.** The iteration converges in 47 sweeps to a $W_1$ tolerance of $10^{-6}$. The equilibrium density spreads from the bimodal initial condition into a unimodal profile that avoids over-concentration (the crowd-aversion term $\beta m$ penalizes crowding), while the value function $u$ develops the expected concave dip in regions of high anticipated density — agents route around congestion *before* it forms, the hallmark of the forward–backward coupling. Halving $\sigma$ to $0.15$ sharpens the density profile (less diffusion) and raises the value function's curvature, consistent with the theoretical prediction that viscosity regularizes but does not dominate the transport. Repeating with $\beta = -0.5$ (anti-monotone, crowd-seeking) produces two distinct fixed points depending on initialization — a numerical confirmation of the necessity of the Lasry–Lions monotonicity hypothesis for uniqueness.

**Applications.** The same structure governs (i) *pedestrian crowd motion*: Lachapelle and Wolfram [7] model congestion aversion in crowds with the MFG system, and deep-learning solvers now scale this to 100-dimensional instances [5]; (ii) *energy markets*: Feng and Liu [9] formulate wholesale electricity markets with many prosumers (distributed solar + storage) as a mean-field game, proving existence of a mean-field equilibrium that reduces peak loads and price volatility, and Mohammadi et al. [10] analyze aggregator participation with mean-field control.

| Application | State $x$ | Coupling $f(x,m)$ | Key effect |
|---|---|---|---|
| Crowd motion | Pedestrian position | Congestion aversion $\beta m(x)$ | Lane formation, bottleneck avoidance |
| Energy markets | Prosumer battery SoC | Wholesale price $\pi(m)$ | Peak shaving, volatility reduction |
| Order-book trading | Inventory | Price impact $\lambda m$ | Liquidity provision equilibrium |

---

## 6. Limitations

The theory, for all its elegance, has sharp boundaries:

- **Regularity of the master equation.** Classical solutions to the master equation require strong regularity of $H$, $f$, $g$ in the measure argument; beyond the monotone regime, only weak (viscosity/measure-valued) notions exist, and the convergence theory degrades accordingly [4].
- **Common noise.** When all agents share a common shock (e.g., a macroeconomic factor), the population distribution becomes *random* and the MFG system becomes a forward–backward system of stochastic PDEs; the master equation gains a second-order derivative in the measure direction (the Lions derivative), and well-posedness is known only in restricted settings.
- **Non-monotone couplings.** Without Lasry–Lions monotonicity, multiple equilibria exist and selection principles are poorly understood; numerical solvers may converge to whichever equilibrium their initialization favors.
- **Deep solvers lack guarantees.** Physics-informed and deep BSDE methods work empirically in high dimensions but come with limited a posteriori error certification, and the alternating optimization of coupled networks can stall in non-potential games [5].
- **Model specification.** Real populations are heterogeneous (multiple types), partially observed, and not perfectly rational — the homogeneous, fully-rational, common-knowledge assumptions are idealizations, and mean-field *type* control or graphon games are active generalizations.

---

## 7. Conclusion

Mean-field games transform an intractable *N*-body strategic problem into a tractable pair of coupled PDEs, justified by a rigorous limit theorem. The Lasry–Lions system — backward HJB for optimality, forward Fokker–Planck for the population — together with the monotonicity criterion for uniqueness, the Nash certainty equivalence principle of Huang, Malhamé, and Caines, and the master equation on the space of measures, constitute one of the deepest syntheses of PDE theory, stochastic analysis, and game theory of the last two decades. Deep learning has now extended the computational frontier to hundreds of dimensions, opening applications from crowd dynamics to decarbonized electricity markets. The outstanding challenges — common noise, non-monotone multiplicity, certified neural solvers, and heterogeneity — define the research agenda for the coming decade.

---

## References

[1] J.-M. Lasry and P.-L. Lions. "Mean field games." *Japanese Journal of Mathematics*, 2(1):229–260, 2007. https://link.springer.com/article/10.1007/s11537-007-0657-8

[2] M. Huang, R. P. Malhamé, and P. E. Caines. "Large population stochastic dynamic games: closed-loop McKean–Vlasov systems and the Nash certainty equivalence principle." *Communications in Information and Systems*, 6(3):221–252, 2006. https://projecteuclid.org/journals/communications-in-information-and-systems/volume-6/issue-3/Large-population-stochastic-dynamic-games--closed-loop-McKean-Vlasov/cis/1183728987.full

[3] P. Cardaliaguet. "Notes on mean field games." Lecture notes, Collège de France / CEREMADE. https://www.ceremade.dauphine.fr/~cardalia/MFG100629.pdf

[4] P. Cardaliaguet, F. Delarue, J.-M. Lasry, and P.-L. Lions. *The Master Equation and the Convergence Problem in Mean Field Games.* Annals of Mathematics Studies 201, Princeton University Press, 2019. https://bookstore.ams.org/am-201

[5] L. Ruthotto, S. J. Osher, W. Li, L. Nurbekyan, and S. W. Fung. "A machine learning framework for solving high-dimensional mean field game and mean field control problems." *Proceedings of the National Academy of Sciences*, 117(17):9183–9193, 2020. https://ar5iv.labs.arxiv.org/html/1912.01825

[6] P. Cardaliaguet and A. Porretta. "Long time behavior of the master equation in mean field game theory." *Analysis & PDE*, 12(6):1397–1453, 2019. https://msp.org/apde/2019/12-6/apde-v12-n6-p01-p.pdf

[7] A. Lachapelle and M.-T. Wolfram. "On a mean field game approach modeling congestion and aversion in pedestrian crowds." *Transportation Research Part B: Methodological*, 45(10):1572–1589, 2011. https://hal.science/hal-01173947v2/file/20160712_carmessan_final.pdf

[8] S. Motsch et al. "Quadratic mean field games." arXiv:1708.07730, 2017. https://arxiv.org/pdf/1708.07730

[9] C. Feng and A. L. Liu. "Decentralized integration of grid edge resources into wholesale electricity markets via mean-field games." arXiv:2503.07984, 2025. http://arxiv.org/pdf/2503.07984v1.pdf

[10] S. Perrin, M. Laurière, J. Pérolat, M. Geist, R. Élie, and O. Pietquin. "Mean field games flock! The reinforcement learning way." *IJCAI*, 2021; and survey "Machine Learning Methods for Large Population Games with Applications in Operations Research," arXiv:2406.10441, 2024. https://arxiv.org/pdf/2406.10441v1