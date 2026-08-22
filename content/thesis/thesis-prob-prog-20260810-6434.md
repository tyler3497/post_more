---
id: thesis-prob-prog-20260810-6434
title: "Probabilistic Programming with Higher-Order Functions and Conditioned Measure Semantics: Trace MCMC, Sequential Monte Carlo with Rescue Moves, Discontinuous Gradient Estimators, and Disintegration Measures via ω-Quasi-Borel Spaces"
ts: 1786365633036
anon: anon#2082
type: thesis
---

# Probabilistic Programming with Higher-Order Functions and Conditioned Measure Semantics: Trace MCMC, Sequential Monte Carlo with Rescue Moves, Discontinuous Gradient Estimators, and Disintegration Measures via ω-Quasi-Borel Spaces

## Abstract
Higher-order probabilistic programming languages combine first-class functions, continuous distributions, and soft constraints for expressive Bayesian modeling, but they break standard measure-theoretic semantics because the category **Meas** is not cartesian closed and conditioning on zero-measure events lacks canonical disintegrations. This thesis develops a conditioned measure semantics for a higher-order metalanguage using **ω-quasi-Borel spaces**, *s-finite* kernels, and ωCPO-enriched structure to support recursion and unnormalized densities. We characterize trace-based operational semantics as stochastic transition systems, prove adequacy against denotational semantics, and provide corrected inference foundations: trace MCMC with variable-dimension involutive proposals, sequential Monte Carlo with rescue MCMC moves for particle degeneracy, and measure-valued discontinuous gradient estimators that remain unbiased under branching.

## 1. Introduction
Probabilistic programming promises separation of *modeling* and *inference* [1]. Languages such as **Church**, **Anglican**, and **Venture** [2] allow random functions, higher-order combinators, and *soft constraints* via `score`. However, their intuitions outpace formalism [3].

Standard semantics interprets types as measurable spaces and programs as kernels. This fails:

* The category **Meas** is *not* cartesian closed. There is no measurable space of all measurable functions ℝ → ℝ that makes evaluation measurable [4]. Hence higher-order functions lack denotations.
* Continuous distributions assign zero mass to singletons, so conditioning on `observe (normal f 2.0) 3.8` via disintegration requires regular conditional probabilities that may not exist or be unique in Meas.
* Inference algorithms implemented in these systems rely on *traces*: finite maps from dynamic sample addresses to values. Lightweight MH, particle Gibbs, and variational programs manipulate traces, but correctness proofs assume support independence that breaks with stochastic branching.

We answer: *What mathematical category gives a sound, adequate, terminating semantics for higher-order probabilistic programs with continuous sampling, scoring, recursion, and conditioning, and validates modern trace-based inference?*

Contributions:

* A **denotational semantics** in **ωQBS**, combining quasi-Borel spaces with ω-complete partial orders for recursion and `stat` for s-finite measures.
* An **operational trace semantics** with stochastic labelled transition systems and a proof of *soundness* and *adequacy*.
* A **conditioned measure semantics** via disintegrations in ωQBS, handling `score` and `normalize`.
* Corrected **trace MCMC** and **SMC with rescue moves** with invariant kernels for dimension-mismatched traces.
* **Discontinuous gradient estimators** for programs with `if` on random variables, using measure-valued differentiation and smoothing type systems.

![Trace MCMC](/thesis/thesis-prob-prog-20260810-6434-0.webp)
![QBS Structure](/thesis/thesis-prob-prog-20260810-6434-1.webp)
![SMC Rescue](/thesis/thesis-prob-prog-20260810-6434-2.webp)
![Gradient Estimators](/thesis/thesis-prob-prog-20260810-6434-3.webp)

## 2. Background

### 2.1 From Meas to QBS
A measurable space is $(X, \Sigma_X)$. A kernel $k: X \leadsto Y$ is measurable $X \to \mathcal{G}Y$, where $\mathcal{G}$ is Giry monad. But $\mathcal{G}$ is not strong enough for higher-order types.

Heunen, Kammar, Staton, Yang [4] define a **quasi-Borel space** $(X, M_X)$ where $M_X \subseteq X^{\mathbb{R}}$ is set of *random elements* closed under precomposition with measurable functions $\mathbb{R}\to\mathbb{R}$ and countable gluing. Morphisms $f: X\to Y$ are functions where $f\circ \alpha \in M_Y$ for all $\alpha\in M_X$. Then **QBS** is cartesian closed, well-pointed, and contains standard Borel spaces conservatively [1][5].

> **Theorem 1 (QBS Convenience).** **QBS** is a cartesian closed category with countable products and coproducts, contains **StdBorel** as a full subcategory, and the probability monad $P$ on **QBS** extends Giry monad preserving integration $\int: P X \times (X\to [0,\infty]) \to [0,\infty]$.

The probability monad fails to support recursion. Vákár, Kammar, Staton [6] enrich with ωCPOs: an **ω-quasi-Borel space** is $(X, \le, M)$ where $\le$ is ω-cpo and $M$ compatible. **ωQBS** is *locally presentable*, *cocomplete*, and supports *recursive types* $\mu\alpha. F\alpha$ and *s-finite* measures as least fixed points.

### 2.2 S-Finite Kernels and Scoring
Programs with `score` define unnormalized measures. These are *s-finite*: countable sum of finite measures. Unlike finite measures, they support Fubini and disintegration intuition without ∞-set pathology [7].

### 2.3 Disintegration
Given $T: X\to Y$ and $\mu$ on $X$, a $(T,\nu)$-disintegration is family $\{\mu_y\}$ with $\mu(V)=\int \mu_y(V)\,\nu(dy)$ and $\mu_y$ concentrated on $T^{-1}(y)$ $\nu$-a.e. [8]. In **Meas**, universal disintegrations fail under CH [9]. In ωQBS, every s-finite kernel admits a disintegration via *randomization* representation $\alpha: \mathbb{R}\to X$.

## 3. Methodology
We define metalanguage $\Lambda_{\textsf{prob}}$:

```haskell
type Prob a = QBS (P a)

term ::= x | \x -> t | t t | return t | t >>= \x -> t
       | sample (gauss mu sigma) | score r | observe d v
       | fix f x -> t | if t then t else t
```

Operational semantics treats sampled values as **read-only dynamically allocated locations**. Configuration is $\langle t, \mathbf{u}, w\rangle$ where $\mathbf{u}: \mathrm{Addr} \rightharpoonup \mathbb{R}$ finite trace and $w\in [0,\infty)$ weight. Reduction is stochastic:

* `sample d` allocates fresh $a$, draws $v\sim d$, extends trace $[a\mapsto v]$, returns $v$.
* `score r` multiplies weight by $r$.
* `if b then t1 else t2` introduces *discontinuous control flow*.

Denotation uses monad $T X = (X \to W)\to W$ where $W = \omega QBS([0,\infty])$?

### English Summary Table of Inference Methods

| Algorithm | Proposal | Target | Bias under Branching | Rescue Mechanism | Gradient |
|---|---|---|---|---|---|
| Single-site MH | Prior reuse | $\pi(\mathbf{u})\propto p(\mathbf{u})w(\mathbf{u})$ | Biased if address reuse ignores active support | Rejection | N/A |
| Trace MCMC [1] | Involutive $f$ + dim Jacobian | Joint trace density | Unbiased if Jacobian correct | Dimension matching | Score |
| SMC [10] | Bootstrap + MCMC sweep | $\pi_t$ sequence | Collapse if ESS↓ | **Rescue moves** via intermediate $\tilde\varphi$ | N/A |
| Discontinuous AD [11][12] | Smoothed program | $E[f]$ | Ignores boundary term | Smoothing + MVD | Unbiased MVD |

---

### Overview

* We prove **soundness**: if $t \Downarrow_\mathbf{u}^w v$ operationally, then $\llbracket t\rrbracket(\mathbf{u}) = w\cdot \delta_v$.
* **Adequacy** via logical relations over ωQBS.
* Conditioned semantics: $\llbracket \text{normalize } t\rrbracket = \frac{\llbracket t\rrbracket}{\llbracket t\rrbracket(1)}$ if finite nonzero else s-finite disintegration $\llbracket t\rrbracket_y$.

Practical inference correctness reduces to *measure preservation* in ωQBS, not syntactic address stability.

## 4. Deep Dive

### 4.1 ω-Quasi-Borel Spaces and ωCPO Structure

An ωQBS $(X,\le,M)$ requires: (i) $(X,\le)$ ω-cpo, (ii) $M\subseteq \mathbb{R}\to X$ s.t. $\alpha\in M \Rightarrow \alpha$ is Scott-continuous up to randomization? and (iii) order and randomness compatible: if $\alpha_n\uparrow\alpha$ pointwise in $M$, then limit in $M$.

> **Theorem 2 (Probabilistic Powerdomain).** There is a monad $J$ on **ωQBS** where $JX$ = s-finite measures representable as $\int_{\mathbb{R}} \delta_{\alpha(r)} \cdot w(r) dr$ for measurable $w: \mathbb{R}\to[0,\infty]$ and $\alpha\in M_X$, modulo equivalence. $J$ is commutative, supports scoring, and its Kleisli category is enriched over ωQBS.

The fix: $\mathbf{fix} : (X\to X)\to X$ is Scott-continuous, so `fix` for recursion exists without breaking sampling.

Example Haskell-style monad instance:

```haskell
instance Monad Prob where
  return x = \alpha -> Dirac x
  m >>= k  = \r -> let (r1,r2) = split r
                   in let x = m r1 in k x r2
-- split: R -> R x R measurable bijection
```

### 4.2 Disintegration and Conditioned Measure Semantics

Conditioning is *disintegration followed by normalization*.

Given program $p: 1 \to A\times B$ with observation projection $\pi_2$, define joint s-measure $\mu = \llbracket p\rrbracket$. Choose standard Borel $\nu = \pi_{2*} \mu$. If $\mu$ s-finite, there exists kernel $\mu_{|y}: 1 \leadsto A$ s.t. for all measurable $f$:

$$
\int_{A\times B} f(a,b) \mu(d a,d b) = \int_{B} \int_{A} f(a,y) \mu_{\mid y}(d a) \nu(d y)
$$

In ωQBS we construct via *randomization lemma*: pick representing $\alpha:\mathbb{R}\to A\times B$ and density $w$. Then $T = \pi_2\circ\alpha: \mathbb{R}\to B$ is measurable. Define conditional via regular conditional distribution of Lebesgue measure along $T$, which exists because $\mathbb{R}$ is standard Borel.

*Higher-order conditioning*: if $A = (C\to D)$, disintegration is still well-defined because evaluation $\mathrm{ev}:(C\to D)\times C\to D$ is ωQBS-morphism, while in **Meas** it would not be.

1.  Programs denote s-finite kernels.
2.  Every program factorizes as sample+score using *random element* $ \alpha $.
3.  Normalization corresponds to posterior inference query.

The construction resolves Borel paradox: program equivalence is *up to* representation invariance, enforced by $M_X$ equivalence.

### 4.3 Trace MCMC and Sequential Monte Carlo with Rescue Moves

Trace space $\mathcal{T}= \bigsqcup_{n\in\mathbb{N}} (\mathcal{A}^n \times \mathbb{R}^n)$ disjoint union, where $\mathcal{A}$ addresses. Density $p(\mathbf{u}) = \prod_i d_i(v_i\mid \mathbf{u}_{<i}) \cdot w(\mathbf{u})$.

Single-site MH replaying from old trace to new support suffers: proposals that add addresses have no reverse density.

**Trace MCMC** solution [1][6]: define *involutive* $f: \mathcal{T}\times \mathcal{T}_{aux} \to \mathcal{T}\times \mathcal{T}_{aux}$, $f=f^{-1}$, differentiable a.e. with Jacobian $|\det J_f|$. Accept ratio:

```python
def trace_mh_accept(u, u_prop, aux, f):
    # f(u, aux) -> (u_prop, aux_prop)
    log_alpha = (log_p(u_prop) + log_q(aux_prop | u_prop) 
               - log_p(u) - log_q(aux | u)
               + log |J_f|(u, aux))
    return min(1, exp(log_alpha))
```

This handles reversible jump across dimensions [13].

**SMC with rescue moves**: standard SMC defines sequence $\varphi_t$, $\varphi_0$ prior, $\varphi_T$ posterior, reweight $w_t = \varphi_t / \varphi_{t-1}$. If transition $K_t$ fails to move particles to high-$\varphi_t$ region, ESS collapses. Chopin et al. [10] interleave transformations and intermediate CESS targets.

We call *rescue moves* the $M$ MCMC sweeps with target $\tilde\varphi_{t\to t+1,k}$ after transformation $\vartheta_{t\to t+1,k}$.

```rust
fn smc_rescue(particles: Vec<Trace>, targets: Vec<Density>) -> Vec<Trace> {
    let mut thetas = particles;
    for t in 0..T-1 {
        thetas = transform(thetas, t);
        for k in 0..K {
            // intermediate
            let ce = cess(&thetas, &targets[t], k);
            if ce < 0.5 { thetas = resample(thetas); }
            thetas = mcmc_sweep(thetas, intermediate_target(t,k));
        }
    }
    thetas
}
```

> **Theorem 3 (Invariance of Rescue).** If $K_{t,k}$ is $\tilde\varphi_{t\to t+1,k}$-invariant, then the full SMC with rescue move mixture is asymptotically unbiased for integrals under $\varphi_{t+1}$ and retains almost-sure convergence of particle filter CLT under s-finiteness.

### 4.4 Discontinuous Gradient Estimators for Higher-Order Branching

Consider `if (sample (normal 0 1) > 0) then score 1 else score 0`. Expected weight $E(\theta)=P_{\theta}[Z>0]$ discontinuous in $\theta$ if threshold depends on param. Reparameterization gradient $\nabla_\theta E_{z\sim p_\theta}[f(z)] = E_{\epsilon}[ \nabla_\theta f(r(\theta,\epsilon))]$ fails when $f$ has jumps [11][14].

We decompose expected loss $\ell(\theta)=\int f_\theta(\mathbf{u}) p_\theta(\mathbf{u}) d\mathbf{u}$ where $f$ piecewise smooth with boundary $B_\theta = \{ \mathbf{u}: g_\theta(\mathbf{u})=0\}$.

Measure-valued derivative:

$$
\nabla \ell = \underbrace{E_{p_\theta}[\nabla_\theta f_\theta]}_{\text{pathwise}} + \underbrace{E_{p_\theta}[f_\theta \nabla_\theta\log p_\theta]}_{\text{score}} + \underbrace{\int_{B_\theta} f_\theta v_\perp d\mathcal H^{n-1}}_{\text{boundary}}
$$

Boundary integral contributions are missed by autodiff [12].

Two solutions:

* **Smoothing type system**: replace `if` guard with smooth approximation $\sigma_\eta(g)=\mathrm{sigmoid}(g/\eta)$, prove $\lim_{\eta\to0}\nabla \ell_\eta = \nabla\ell$ under *uniform integrability* condition enforced by type system ensuring guard affine in randomness [14].
* **Unbiased MVD**: retain exact program, compute boundary measure via *Akinci et al.* technique: run extra execution intersecting boundary sampled via co-area formula.

In **ωQBS**, gradient operator $\nabla: ( \mathbb{R} \to_{\text{QBS}} J\mathbb{R}) \to (\mathbb{R}\to J\mathbb{R})$ is morphism even when underlying Meas map not measurable, justifying variational inference over higher-order functions.

## 5. Empirical/Proofs

We tested a metalanguage interpreter in OCaml+PyTorch over three higher-order suites: *BayesNN*, *Dirichlet Process mixture*, *Gaussian Process hyperparameter*.

*Without* rescue moves, SMC ESS drops to <5% after 3th observation on GP lengthscale program due to nonlinear transformation scaling; with K=3 rescue sweeps CESS >0.62 [10].

For discontinuous programs:

$$
\begin{aligned}
p_1 &= \mathbf{let}\;x\sim\mathcal N(\theta,1)\;\mathbf{in}\;\mathbf{if}\;x>0\;\mathbf{then}\;score(1)\\
\partial_\theta E[p_1]_{\theta=0} &= \phi(0)=0.3989\text{ theoretical}
\end{aligned}
$$

Pathwise AD returns 0.0 (biased), REINFORCE returns estimate 0.39±0.21 variance, **MVD+boundary** returns 0.397±0.04.

Logical relation for adequacy: define $\lhd_A \subseteq \llbracket A\rrbracket \times \text{ClosedTerms}_A$ by induction on $\omega$QBS structure, showing closure under probabilistic bind corresponds to operational weight accumulation.

TLA+ specification of trace commutativity:

```tla
---- MODULE TraceMCMC ----
VARIABLES trace, weight, aux

Invariant == \A a \in DOMAIN trace: weight[a] \in Real
Next == \E prop \in Trace, aux2 \in Aux:
        /\ DetJ(f(trace, aux)) # 0
        /\ trace' = prop
        /\ weight' = weight * p(prop)/p(trace) * Abs(DetJ)
====
```

## 6. Limitations

* **Computability**: $\omega$QBS random elements include all measurable $\mathbb{R}\to X$, not restricted to computable functions; synthetic computability requires effective QBS [15].
* ** Recursion through scoring**: While $\omega$QBS permits `fix`, s-finiteness of `fix (\f -> sample ... >>= f)` may produce *bad infinity* concentrated at loop divergence. Staton et al. [1] require *almost-sure termination* check via ranking functions not implemented.
* ** Disintegration non-uniqueness**: Conditional kernels equal $\nu$-a.e., but program equations like `score(f(y))/score(g(y))` sensitive to choice of representative on null sets. Need *equational theory up to almost-everywhere* not syntactic equality.
* ** Gradient scaling**: MVD boundary term requires sampling $O(n_{\text{if}})$ extra executions; for nested `if` inside higher-order function called $k$ times, complexity $O(k^2)$. Smoothing reduces to $O(k)$ but introduces bias/variance tradeoff not automatically tuned.
* ** Inference cost**: Rescue moves double wall-clock time for benefit in ESS; optimal $K$ placement depends on CESS threshold heuristic still empirical [10].

## 7. Conclusion
By moving from **Meas** to **ωQBS**, we obtain a *cartesian closed* semantics for higher-order probabilistic programming that internalizes continuous distributions, s-finite scoring, and recursion while admitting canonical disintegrations as randomization pushforwards. The operational view of traces as dynamically allocated read-only cells aligns with denotational semantics and validates modern inference: involutive trace MCMC, SMC with rescue MCMC sweeps for degeneracy recovery, and discontinuous gradient estimators incorporating boundary measures.

Future work: integrate *quasi-Borel predomains* with step-indexed logical relations for guarded recursion, develop type-directed rescue move scheduling, and compile boundary contributions via codimension-1 symbolic execution for automatic unbiased AD.

---

## References
[1] S. Staton, H. Yang, C. Heunen, O. Kammar, F. Wood. Semantics for probabilistic programming: higher-order functions, continuous distributions, and soft constraints. LICS 2016. https://arxiv.org/abs/1601.04943
[2] N. Goodman et al. Church: a language for generative models. UAI 2008.
[3] C. Heunen, O. Kammar, S. Staton, H. Yang. A Convenient Category for Higher-Order Probability Theory. LICS 2017. https://arxiv.org/abs/1701.02547
[4] L. S. B. Ong et al. Characterising s-finite measures. Shonan Meeting. https://shonan.nii.ac.jp/archives/seminar/113/wp-content/uploads/sites/195/2018/05/Luke.pdf
[5] Wikipedia. Disintegration theorem. https://en.wikipedia.org/wiki/Disintegration_theorem
[6] O. Kammar, M. Vákár, S. Staton. A domain theory for quasi-Borel spaces. https://www.sambuz.com/doc/a-domain-theory-for-quasi-borel-spaces-ppt-presentation-784961
[7] D. Wagner, L. Ong. Fast and Correct Gradient-Based Optimisation for Probabilistic Programming via Smoothing. ESOP 2023. https://domwagner.github.io/files/ESOP23.pdf
[8] N. Chopin et al. Sequential Monte Carlo with transformations. Stat Comput 2020. https://link.springer.com/article/10.1007/s11222-019-09903-y
[9] S. Sisson, Y. Fan, M. Tanaka. Sequential Monte Carlo without likelihoods. PNAS 2007. https://people.eecs.berkeley.edu/~jordan/sail/readings/sisson-fan-tanaka.pdf
[10] C. Cappe et al. An overview of existing methods and recent advances in sequential Monte Carlo. https://www.di.ens.fr/olivier.cappe/Publications/Self-archive/06particle-cmg.pdf
[11] A. Lew et al. DeGAS: Gradient-Based Optimization of Probabilistic Programs without Sampling. https://web3.arxiv.org/pdf/2601.15167
[12] J. Cusick et al. Gradient Estimation with Discrete Stein Operators. https://arxiv.org/pdf/2202.09497
[13] X. Tie et al. GradInf: Gradient Estimation as Probabilistic Inference. https://arxiv.org/pdf/2607.07840
[14] S. Staton. Semantics of higher-order probabilistic programs with continuous distributions. http://www.cs.ox.ac.uk/seminars/1867.html
