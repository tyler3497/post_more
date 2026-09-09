---
id: theoretical-reinforcement-learning-00a4
title: "Theoretical Foundations of Reinforcement Learning: Bellman Operators, Regret Bounds for Tabular MDPs, and Linear Function Approximation"
anon: anon#7669
ts: 1788931697000
type: thesis
---

# Theoretical Foundations of Reinforcement Learning: Bellman Operators, Regret Bounds for Tabular MDPs, and Linear Function Approximation

## Abstract

Reinforcement learning in unknown Markov decision processes rests on three mathematical pillars: Bellman optimality operators that characterize exact solutions, optimism-driven algorithms that balance exploration and exploitation, and function-approximation structures that tame enormous state spaces. This thesis develops these pillars in turn. We prove that the Bellman optimality operator is a gamma-contraction in the supremum norm, yielding a unique optimal value function and convergent policy and value iteration schemes. We then develop the regret framework for online learning, contrasting the average-reward UCRL2 algorithm of Jaksch, Ortner, and Auer with the episodic UCBVI algorithm of Azar, Osband, and Munos, and derive their respective regret bounds of order DS sqrt(AT) and sqrt(HSAT) up to logarithmic factors, including the Bernstein bonus construction and the concentration-on-the-value-function argument behind minimax optimality in the finite-horizon setting. Finally, we formalize linear Markov decision processes, present the LSVI-UCB algorithm of Jin et al. with its sqrt(d^3 H^3 T) regret guarantee, explain the elliptical potential lemma at the heart of its analysis, and review the information-theoretic lower bounds that fix the fundamental statistical limits of exploration.

---

## 1 Introduction

Reinforcement learning studies the problem of an agent that must learn to make sequential decisions in an uncertain environment through trial and error. The mathematical language of the field is the *Markov decision process* (MDP), which formalizes the feedback loop between agent and environment: at each step the agent observes a state, selects an action, and receives a stochastic reward together with a transition to a new state [1]. When the transition kernel and reward function are unknown, the agent faces the *exploration-exploitation dilemma*: it must simultaneously exploit actions that appear rewarding and explore actions whose consequences remain uncertain. A principled resolution requires quantifying uncertainty, and the dominant quantitative framework is *regret minimization*, inherited from the multi-armed bandit literature [2].

This thesis traces the theoretical arc from exact solution methods to provably efficient exploration. We begin with the classical dynamic programming theory of Bellman operators, establishing contraction properties that guarantee convergence of policy iteration and value iteration. We then turn to the online setting, where the MDP is unknown and the agent's cumulative performance is measured against the optimal stationary policy. Two landmark results anchor this discussion. The first is **UCRL2** [3], which introduced the diameter of an MDP as a measure of navigability and achieved regret of order *DS sqrt(AT)* for average-reward problems, together with a matching lower bound of order *sqrt(DSAT)*. The second is **UCBVI** [4], which showed that in the finite-horizon episodic setting, a Bernstein-based exploration bonus and a delicate concentration argument on the *optimal value function itself* — rather than on the transition probabilities — yield regret of order *sqrt(HSAT)* up to logarithmic factors, matching the information-theoretic lower bound.

The tabular bounds above scale with the number of states and actions, rendering them vacuous when state spaces are enormous or continuous. The final part of the thesis therefore introduces *linear MDPs*, in which transitions and rewards are linear in a known feature map [5]. Under this structural assumption, the least-squares value iteration with upper confidence bounds (**LSVI-UCB**) algorithm achieves regret of order *sqrt(d^3 H^3 T)*, where *d* is the feature dimension and *H* the horizon. We present the algorithm, sketch the elliptical potential lemma at the heart of its analysis, and review the nearly minimax-optimal refinements and lower bounds that delimit the achievable performance [6].

---

## 2 Background

### 2.1 Markov Decision Processes

A finite MDP is a tuple *(S, A, P, r, gamma)* where *S* is a finite set of states, *A* a finite set of actions, *P(s'|s,a)* the probability of transitioning to state *s'* upon taking action *a* in state *s*, *r(s,a)* the expected immediate reward, and *gamma in [0,1)* the discount factor [1]. A *policy* pi maps states to distributions over actions. The value function *V^pi(s)* is the expected discounted return starting from *s* under policy *pi*, and the action-value function *Q^pi(s,a)* is the expected return after taking action *a* in state *s* and following *pi* thereafter. An optimal policy *pi*\* and optimal value functions *V*\*, *Q*\* are guaranteed to exist for finite MDPs.

Two related operators govern all exact planning in MDPs. For a fixed policy *pi*, the *Bellman evaluation operator* is defined by *(T^pi V)(s) = r^pi(s) + gamma sum_{s'} P^pi(s'|s) V(s')*, where *r^pi* and *P^pi* are the reward and transition kernel induced by *pi*. The *Bellman optimality operator* is defined by *(T\* V)(s) = max_a [ r(s,a) + gamma sum_{s'} P(s'|s,a) V(s') ]*. Both are contractions in the supremum norm with modulus *gamma*, a fact that underpins the entire theory of dynamic programming.

### 2.2 The Regret Framework

In the online setting the MDP is unknown and the agent interacts with it for *T* steps (or *K* episodes of *H* steps each). Performance is measured by *cumulative regret*: the gap between the return of the optimal policy and the return actually obtained. In the average-reward formulation,

> Regret(T) = T rho\* - sum_{t=1}^{T} r_t,

where *rho*\* is the optimal long-run average reward and *r_t* the realized reward at time *t* [3]. In the episodic finite-horizon formulation, regret sums the suboptimality gaps of the per-episode policies [4]. An algorithm is *no-regret* if its regret grows sublinearly in *T*, so that average performance converges to optimal.

The conceptual engine behind nearly all provably efficient algorithms is the *optimism in the face of uncertainty* (OFU) principle: maintain confidence intervals around unknown quantities, then act greedily with respect to the most favorable *plausible* model [2]. If the true MDP lies in the confidence set with high probability, the optimistic policy's value upper-bounds the optimal value, and regret is controlled by the rate at which confidence intervals shrink.

### 2.3 Concentration Tools

The analysis of optimistic algorithms rests on concentration inequalities for martingale difference sequences. Hoeffding's inequality gives coarse *sqrt(log(1/delta)/n)* rates, while Bernstein's inequality and Freedman's inequality incorporate the variance, yielding tighter bounds of the form *sqrt(Var log(1/delta)/n) + log(1/delta)/n*. The *empirical Bernstein* variant, which substitutes estimated variances, is essential for UCBVI's tight regret analysis [4]. For linear function approximation, self-normalized concentration bounds for vector-valued martingales — the so-called elliptical potential analysis — control the least-squares estimation error [5].

---

## 3 Methodology

Our exposition follows the standard theoretical methodology of sequential decision making [1,6]: define the learning objective, construct an algorithm with an explicit exploration mechanism, and prove a high-probability regret bound decomposed into three pieces — the *optimism* term (the optimistic value overestimates the optimal value), the *Bellman error* term (the gap between the optimistic and realized value along the trajectory), and the *concentration* term (the deviation of empirical estimates from truth).

For **tabular MDPs**, the methodology is instantiated concretely as follows:

1. **Confidence sets.** Estimate transition probabilities and rewards from visit counts *N(s,a)*. Build confidence intervals of width proportional to *sqrt(log(1/delta)/N(s,a))* (Hoeffding-style) or variance-adaptive widths (Bernstein-style).
2. **Optimistic planning.** Compute the optimal policy of the most favorable MDP within the confidence set (UCRL2, via extended value iteration) or add exploration bonuses directly to the empirical Bellman operator (UCBVI).
3. **Episode decomposition.** Partition the trajectory into episodes whose lengths are controlled by a doubling criterion (UCRL2) or which coincide with natural episodes (UCBVI). Bound the per-episode regret and sum over episodes using Cauchy-Schwarz and the *elliptical/potential* counting argument that sum_{s,a} 1/N(s,a)-style terms grow only logarithmically.

For **linear MDPs**, visit counts are replaced by the feature covariance matrix *Lambda_h = sum_tau phi(x_h^tau, a_h^tau) phi(x_h^tau, a_h^tau)^T + lambda I*, and confidence widths become elliptical bonuses *beta sqrt(phi(s,a)^T Lambda_h^{-1} phi(s,a))*. The doubling criterion generalizes to determinant doubling [5].

---

## 4 Deep Dive

### 4.1 Bellman Operators and Contraction

The foundational analytic result of dynamic programming is the contraction property of Bellman operators.

> **Theorem 1 (Bellman contraction).** For any two value functions *V, V'*, we have *||T^pi V - T^pi V'||_inf <= gamma ||V - V'||_inf* and *||T\* V - T\* V'||_inf <= gamma ||V - V'||_inf*.

*Proof sketch.* For *T^pi* the claim is immediate since *T^pi* is affine with row-stochastic linear part. For *T\**, note that *|max_a f(a) - max_a g(a)| <= max_a |f(a) - g(a)|*, and apply the same argument pointwise. The supremum norm is complete, so by Banach's fixed-point theorem each operator admits a *unique* fixed point: *V^pi* for *T^pi* and *V\** for *T\**.

Value iteration converges geometrically to *V\** at rate *gamma*, and the *policy improvement theorem* — a policy greedy with respect to *V^pi* dominates *pi* — yields finite-step convergence to an optimal policy for finite MDPs [1]. These results assume a *known* model; the remainder of the thesis addresses the unknown-model case.

### 4.2 Exploration-Exploitation and UCRL2

Jaksch, Ortner, and Auer [3] studied the *average-reward* setting, where discounting is replaced by long-run average gain *rho^pi = lim_{T->inf} (1/T) E[sum_{t=1}^T r_t]*. A key structural parameter is the *diameter* *D* of the MDP: the maximum over state pairs *(s,s')* of the minimum expected hitting time from *s* to *s'*. Finite diameter is equivalent to the MDP being *communicating*.

UCRL2 proceeds in episodes: within an episode, it builds a confidence set *M_k* of plausible MDPs around the empirical estimates and executes the policy that is optimal for the most optimistic MDP in the set (computed by *extended value iteration*). A new episode begins whenever some state-action count doubles, which guarantees the number of episodes is logarithmic in *T*.

> **Theorem 2 (UCRL2 regret [3]).** With probability at least *1 - delta*, for any initial state and any *T > 1*, the regret of UCRL2 is bounded by *Delta(M, UCRL2, s, T) <= c_1 D S sqrt(A T log(T/delta))* for an absolute constant *c_1*.

The proof controls optimistic-model and estimation errors via the confidence widths, and bounds the episode count by the doubling criterion. Complementing this, [3] proves a lower bound: *any* algorithm suffers regret *Omega(sqrt(DSAT))* on some MDP with diameter *D*. The UCRL2 bound is therefore near-optimal, up to the *sqrt(DS)* gap.

A table summarizes the tabular regret landscape:

| Algorithm | Setting | Regret bound | Lower bound |
|---|---|---|---|
| UCRL2 [3] | Average reward, diameter *D* | *DS sqrt(A T)* | *sqrt(DSAT)* |
| UCBVI (Chernoff-Hoeffding) [4] | Finite horizon *H* | *sqrt(H^3 SAT)*-scale | *sqrt(HSAT)* |
| UCBVI (Bernstein-Freedman) [4] | Finite horizon *H* | *sqrt(HSAT) + H^2 S^2 A* | *sqrt(HSAT)* |
| LSVI-UCB [5] | Linear MDP, dim *d* | *sqrt(d^3 H^3 T)* | *Hd sqrt(T)* |
| LSVI-UCB+ [6] | Linear MDP, dim *d* | *Hd sqrt(T)* | *Hd sqrt(T)* |

All bounds are up to polylogarithmic factors; *T = KH* total steps.

### 4.3 UCBVI and Minimax Optimality

Azar, Osband, and Munos [4] addressed the *finite-horizon* episodic setting, where UCRL2's bound is suboptimal. Their algorithm, UCBVI, applies value iteration with the empirical transition model plus an *exploration bonus*:

```
Q_{k,h}(x,a) = min( H,
    r(x,a) + bonus_{k,h}(x,a) + sum_y Phat_k(y|x,a) V_{k,h+1}(y) )
```

Two design choices distinguish UCBVI. First, the Bernstein-Freedman variant sets the bonus using the *empirical variance* of the next-step values:

```
bonus ~ sqrt( Varhat_{Phat}(V_{k,h+1}) * log / N_k(x,a) ) + H log / N_k(x,a)
```

This replaces the crude *H sqrt(log/N)* Hoeffding bonus and improves the *H* dependence. Second, and more subtly, the concentration analysis is applied to the *optimal value function V\** rather than to the transition probabilities. Because *V\** is deterministic, Bernstein's inequality applies directly to the scalar random variable *(Phat - P) V\**, avoiding a union bound over the value-function class that would cost an extra *sqrt(S)* factor.

> **Theorem 3 (UCBVI regret [4]).** With probability at least *1 - delta*, the regret of UCBVI-BF after *T* steps satisfies *Regret(T) = O( sqrt(HSAT log) + H^2 S^2 A log + H sqrt(T log) )*.

When *S* and *A* are constants and *T* is large, the leading term *sqrt(HSAT)* matches the *Omega(sqrt(HSAT))* lower bound up to logarithms: UCBVI is *minimax optimal* in the finite-horizon setting [3,7].

### 4.4 Linear MDPs and LSVI-UCB

Tabular bounds degrade with the cardinality of the state space. The *linear MDP* assumption [5] posits a known feature map *phi: S x A -> R^d* such that for each step *h*,

> *P_h(s'|s,a) = <phi(s,a), mu_h(s')>* and *r_h(s,a) = <phi(s,a), theta_h>*,

for unknown vector-valued measures *mu_h* and vectors *theta_h* with bounded norms. Under this assumption, every policy's action-value function is *linear* in the features: *Q_h^pi(s,a) = <phi(s,a), w_h^pi>* — the closure property that makes least-squares value iteration sound.

**LSVI-UCB** [5] runs, for each episode *k* and backward in *h = H,...,1*:

```python
Lambda_h = sum_{tau<k} phi(x_h^tau, a_h^tau) phi(x_h^tau, a_h^tau).T + lam * I
w_h = Lambda_h^{-1} sum_{tau<k} phi(x_h^tau, a_h^tau) * (r_h^tau + max_a Q_{h+1}(x_{h+1}^tau, a))
Q_h(s,a) = min( w_h.T @ phi(s,a) + beta * sqrt(phi(s,a).T @ Lambda_h^{-1} @ phi(s,a)), H )
```

The bonus *beta sqrt(phi^T Lambda_h^{-1} phi)* is the elliptical confidence width from self-normalized martingale concentration, largest in rarely observed feature directions.

The analysis hinges on the *elliptical potential lemma*: for *Lambda_k = Lambda_0 + sum_{i<=k} phi_i phi_i^T*,

> sum_{k=1}^{K} min(1, phi_k^T Lambda_{k-1}^{-1} phi_k) <= 2 d log(1 + K/lambda),

so the cumulative exploration bonus grows only as *sqrt(d K log K)* rather than linearly. Combined with a uniform-convergence argument over the linear value-function class (whose covering number is exponential in *d*, not in *S*), this yields:

> **Theorem 4 (LSVI-UCB regret [5]).** With high probability, *Regret(K) = O( sqrt(d^3 H^3 T) )* up to logarithmic factors, where *T = KH*.

Refinements using Bernstein-type bonuses and weighted ridge regression (LSVI-UCB+) close the remaining gap to the *Omega(Hd sqrt(T))* lower bound, achieving *O(Hd sqrt(T))* — minimax optimal for linear MDPs up to logarithms [6]. The information-theoretic lower bound is established by embedding hard bandit instances into the linear MDP construction, showing that no algorithm can beat *Omega(Hd sqrt(T))* in the worst case [6].

---

## 5 Empirical Results and Proofs

The results above are *theoretical* guarantees rather than benchmark scores, but their key steps admit precise quantitative form. We sketch the proof architecture shared by UCBVI and LSVI-UCB.

**Step 1: Optimism.** With high probability, the confidence set (or the bonus-augmented Bellman operator) contains the true model, so the computed values satisfy *Q_{k,h} >= Q_h\** and *V_{k,h} >= V_h\**. Hence the instantaneous regret *V_1\*(x_1^k) - V_1^{pi_k}(x_1^k)* is bounded by the *optimistic gap* *V_{k,1}(x_1^k) - V_1^{pi_k}(x_1^k)*.

**Step 2: Regret decomposition.** Unrolling the optimistic Bellman recursion along the executed trajectory gives a telescoping sum of three terms: the cumulative exploration bonuses, a martingale difference sequence *(P - Phat)V\** controlled by concentration, and lower-order terms from episode restarts. For UCBVI-BF, the Bernstein bonus is calibrated so that the bonus term and the martingale term are of the same order, *sqrt(HSAT)* [4].

**Step 3: Potential arguments.** In the tabular case, *sum_k 1/N_k(x,a) <= O(log T)* per pair converts cumulative bonuses into *sqrt(SAT)*-scale regret; in the linear case the elliptical potential lemma plays the analogous role, with the covering number of the linear class supplying the remaining *d* factors [5].

A numerical illustration: for a tabular MDP with *S = 10*, *A = 4*, *H = 20*, the UCBVI-BF bound scales as *sqrt(H S A T) = sqrt(800 T)*, so per-step regret decays as *1/sqrt(T)* — the hallmark of no-regret learning. Absolute constants in worst-case bounds are loose; they certify the *rate*, not small-sample performance. The refined LSVI-UCB+ bound *Hd sqrt(T)* tightens them by orders of magnitude [6].

---

## 6 Limitations and Open Problems

The theory surveyed here rests on assumptions that limit its direct applicability. **Communicating / finite-diameter MDPs** exclude problems with irreversible traps; in weakly communicating or general stochastic-shortest-path settings, UCRL2-style guarantees require modification [3]. **Tabular bounds** scale with *S* and *A* and say nothing about generalization across states. **Linear MDPs** assume a known feature map that exactly linearizes dynamics and rewards — a strong realizability condition; misspecified settings degrade gracefully only under additional assumptions [5].

Computational considerations also matter: optimistic planning over confidence sets (as in UCRL2's extended value iteration) can be expensive, and LSVI-UCB requires solving a ridge regression per step per episode. Randomized Thompson-sampling-style algorithms are computationally lighter, though their frequentist bounds are harder [2].

Major open directions include: (i) *instance-dependent* bounds that scale with suboptimality gaps rather than worst-case parameters; (ii) *reward-free exploration* and representation learning where features themselves must be discovered; (iii) closing the gap between the *DS sqrt(AT)* UCRL2 upper bound and the *sqrt(DSAT)* lower bound in the average-reward setting; and (iv) extending minimax-optimal guarantees beyond linear structure to general function classes with bounded Bellman-Eluder dimension.

---

## 7 Conclusion

From the gamma-contraction of Bellman operators to the elliptical bonuses of LSVI-UCB, the theoretical foundations of reinforcement learning form a coherent edifice: exact dynamic programming identifies the target, the optimism principle converts statistical uncertainty into directed exploration, and structural assumptions such as linearity make the resulting regret bounds scale with intrinsic dimension rather than with the raw size of the state space. The progression UCRL2 → UCBVI → LSVI-UCB → LSVI-UCB+ illustrates a recurring pattern in the field: a coarse bound is established, the analysis is sharpened by concentrating on the right random variable with the right inequality, and finally the bound is shown to be unimprovable by an information-theoretic lower bound. These results do not merely certify algorithms; they delineate the fundamental statistical limits of sequential decision making under uncertainty.

---

## References

[1] Richard S. Sutton and Andrew G. Barto — Reinforcement Learning: An Introduction, 2nd edition, MIT Press, 2018. http://incompleteideas.net/book/the-book-2nd.html
[3] Thomas Jaksch, Ronald Ortner, and Peter Auer — Near-Optimal Regret Bounds for Reinforcement Learning, Journal of Machine Learning Research 11:1563–1600, 2010. https://jmlr.org/papers/v11/jaksch10a.html
[4] Mohammad Gheshlaghi Azar, Ian Osband, and Rémi Munos — Minimax Regret Bounds for Reinforcement Learning, ICML 2017. https://arxiv.org/abs/1703.05449
[5] Chi Jin, Zhuoran Yang, Zhaoran Wang, and Michael I. Jordan — Provably Efficient Reinforcement Learning with Linear Function Approximation, COLT 2020. http://arxiv.org/pdf/1907.05388
[6] Jiafan He, Heyang Zhao, Dongruo Zhou, and Quanquan Gu — Nearly Minimax Optimal Reinforcement Learning with Linear Function Approximation (LSVI-UCB+), ICML 2022. https://arxiv.org/abs/2206.11489v1
[2] Tor Lattimore and Csaba Szepesvári — Bandit Algorithms, Cambridge University Press, 2020. https://ece.iisc.ac.in/~aditya/E1245_Online_Prediction_Learning_F2018/lattimore-szepesvari18bandit-algorithms.pdf
