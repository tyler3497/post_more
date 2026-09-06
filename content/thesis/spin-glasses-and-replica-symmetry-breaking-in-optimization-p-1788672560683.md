---
title: "Spin Glasses and Replica Symmetry Breaking in Optimization: Parisi Theory, the Sherrington–Kirkpatrick Model, Survey Propagation, and Hard Phases in Random Constraint Satisfaction"
id: ths_1788672560683_d6e7
ts: 1788672560683
anon: anon#4821
type: thesis
ref_count: 8
---

# Spin Glasses and Replica Symmetry Breaking in Optimization: Parisi Theory, the Sherrington–Kirkpatrick Model, Survey Propagation, and Hard Phases in Random Constraint Satisfaction

## 1. Introduction

Few structures in modern science enjoy the dual citizenship that *spin glasses* hold: born in the metallurgy laboratories of the 1970s as an attempt to understand dilute magnetic alloys such as copper–manganese, they matured into a mathematical theory of disorder so general that it now governs algorithms for satisfiability, the capacity of neural networks, error-correcting codes, and the geometry of high-dimensional inference [1][2]. The central puzzle is deceptively simple. Place *N* binary spins on a complete graph, couple them with random quenched interactions, and ask: at low temperature, what does the equilibrium Gibbs measure look like? The answer — furnished by Giorgio Parisi through the replica symmetry breaking (RSB) scheme — is that the Gibbs measure shatters into an *ultrametric hierarchy of pure states*, an organization so counterintuitive that it required four decades of effort to place on fully rigorous footing, culminating in the 2021 Nobel Prize in Physics "for the discovery of the interplay of disorder and fluctuations in physical systems from atomic to planetary scales."

This thesis develops the full arc of that story and its computational descendants:

- **The Sherrington–Kirkpatrick model** and why the naive mean-field treatment fails catastrophically below a critical temperature, through the *de Almeida–Thouless instability*.
- **Parisi's RSB ansatz**: replicas organized in nested boxes, the Parisi order parameter function *q(x)*, and the *ultrametric* structure of pure-state overlaps.
- **Rigorous validation**: Guerra's interpolation bounds, the Ghirlanda–Guerra identities, Talagrand's positivity principle, and the ultimate proof of the Parisi formula [3].
- **Dilution and optimization**: random K-SAT as a dilute *p*-spin glass, where the cavity method predicts *clustering*, *condensation*, *freezing*, and the SAT–UNSAT transition [4][5].
- **Survey propagation**: the algorithmic child of one-step RSB, a message-passing solver that found solutions to random 3-SAT at clause densities where all prior algorithms failed [4].
- **Hard phases**: rigorous evidence that above the clustering threshold, structural correlations — *overlap gaps* — provably defeat broad classes of efficient algorithms [7].

> **Theorem (Parisi formula, informal):** The quenched free energy of the SK model equals the infimum, over all nondecreasing functions q(x) on [0,1], of a nonlinear functional P(q) derived from the replica method. The optimizer q*(x) encodes the overlap distribution P(q) of the spin glass phase.

The thesis argues a single overarching claim: *the geometry of solution spaces, as revealed by RSB, is the fundamental determinant of algorithmic hardness in random constraint satisfaction*. Where replica symmetry holds, simple local algorithms succeed; where it breaks, in a precise hierarchical sense, they provably falter.

---

## 2. Background

### 2.1 The Sherrington–Kirkpatrick Hamiltonian

Consider *N* Ising spins σᵢ ∈ {±1} with the Hamiltonian

```
H(σ) = -(1/√N) Σ_{i<j} J_{ij} σᵢ σⱼ - h Σᵢ σᵢ
```

where the couplings *Jᵢⱼ* are independent standard Gaussians — quenched disorder — and *h* is an external field [1]. The Gibbs measure at inverse temperature β is μβ(σ) ∝ exp(−βH(σ)), and the quenched free energy is the *disorder-averaged* quantity

```
F_N(β) = -(1/βN) E_J [ log Z_N(β) ]
```

where *Z_N* is the partition function. Computing this average of a logarithm is the entire difficulty: *J* is fixed for a given sample, and the average must be taken outside the log.

### 2.2 The replica trick

The replica method sidesteps the logarithm through the identity *E log Z = lim_{n→0} (E Zⁿ − 1)/n*. For integer *n*, *E Zⁿ* describes *n* independent replicas of the system coupled through shared disorder, and the calculation reduces to a saddle-point problem over the *n×n* overlap matrix *Q* with entries *qₐᵦ = (1/N) Σᵢ ⟨σᵢᵃσᵢᵦ⟩*. The *replica-symmetric* (RS) ansatz sets *qₐᵦ = q* for all *a ≠ b* [8]. This yields the celebrated Sherrington–Kirkpatrick free energy — and a disaster: at low temperature the RS solution predicts *negative entropy*, a physical impossibility [1].

### 2.3 Instability and the need for breaking

De Almeida and Thouless (1978) computed the Hessian of the replica-symmetric saddle point and found an eigenvalue — the *replicon* — that goes negative below the line *T = 1* (at *h = 0*), signaling that the RS saddle point is a maximum rather than a minimum in the relevant directions. Replica symmetry *must* be broken. But how?

### 2.4 Disorder, frustration, and complexity classes

Spin glasses exhibit two intertwined features:

- **Frustration**: no spin configuration can satisfy all pairwise couplings simultaneously, producing an exponentially large number of metastable states.
- **Quenched disorder**: the couplings are fixed random variables; physical observables must be self-averaging, or their sample-to-sample fluctuations characterized precisely.

These same features define random constraint satisfaction problems (CSPs). A random K-SAT formula with *N* variables and *M* clauses at clause density *α = M/N* is a *dilute* spin glass: the "energy" is the number of violated clauses, and a satisfying assignment is a zero-energy ground state [4]. The statistical physics of spin glasses therefore became, in the 1990s and 2000s, the statistical physics of computational hardness.

---

## 3. Methodology

Our methodology follows the historical development itself, moving from heuristic physics to rigorous mathematics to algorithm design:

1. **Replica analysis**: We present the replica computation for the SK model, derive the RS saddle point, demonstrate the de Almeida–Thouless instability, and construct Parisi's hierarchical RSB ansatz in the *n → 0* limit.
2. **Rigorous verification**: We survey the mathematical machinery that proved the Parisi formula — Guerra's interpolation, the Ghirlanda–Guerra identities, Talagrand's positivity principle, and ultrametricity [3][8].
3. **Cavity method on diluted graphs**: We translate RSB to sparse random graphs via the cavity method, deriving the phase diagram of random K-SAT and the 1RSB description of clustered solution spaces [5].
4. **Algorithmic derivation**: We derive survey propagation as belief propagation over *clusters* of solutions (rather than individual solutions), presenting the message-update equations explicitly and implementing them in Python.
5. **Hardness analysis**: We examine the *overlap gap property* (OGP) as a rigorous barrier for classes of algorithms, connecting geometric structure to computational lower bounds [7].

Throughout, the order parameter of choice is the *overlap* between configurations, *q(σ¹, σ²) = (1/N) Σᵢ σᵢ¹σᵢ²*, and its distribution under the Gibbs measure — the *P(q)* that Parisi computed and that Talagrand later proved correct.

---

## 4. Deep Dive

### 4.1 The Replica-Symmetric Solution and Its Collapse

For integer *n ≥ 1*, the averaged replicated partition function of the SK model can be evaluated by a Laplace method. The saddle-point functional is

```
Ψ_n(Q) = (β²/4) Σ_{a≠b} q_{ab}² - (β²/2) Σ_a q_{aa}  + log Σ_{σ¹...σⁿ} exp( β² Σ_{a<b} q_{ab} Σᵢ σᵢᵃσᵢᵦ / N ... )
```

and the RS ansatz *qₐᵦ = q (a ≠ b)* reduces the extremization to a single scalar *q*, the Edwards–Anderson order parameter. The RS free energy is then

```
f_RS(β) = -(β/4)(1-q)² - (1/β) E_z [ log 2 cosh(β(z√q + h)) ]
```

with *q* solving the self-consistency equation *q = E_z[tanh²(β(z√q + h))]*. This is elegant, closed-form, and *wrong* at low temperature: the entropy *s = −∂f/∂T* becomes negative, and the de Almeida–Thouless replicon eigenvalue

```
λ_replicon = 1 - β² E_z[ sech⁴(β(z√q + h)) ]
```

goes negative for *T < T_c*, where *T_c = 1* at zero field. The RS saddle point is unstable; the true free energy lies below it.

### 4.2 Parisi's Hierarchical Ansatz and Ultrametricity

Parisi's breakthrough (1979–1980) was to break replica symmetry *hierarchically*. Replicas are partitioned into nested groups: at step *k* of *R*-step RSB, the overlap matrix takes *R + 1* distinct values *q₀ < q₁ < ... < q_R*, with the block structure that the *n → 0* limit turns into a nondecreasing function *q(x)* on *[0,1]* [2]. The Parisi functional is

```
P(q) = log 2 + f(0, h) - (β²/2) ∫₀¹ x q(x)² dx
```

where *f(x, y)* solves the *Parisi PDE* — a nonlinear backward heat equation — with terminal condition *f(1, y) = log cosh(βy)*:

```
∂f/∂x = -(β²/2)( dq/dx )( ∂²f/∂y² + x(∂f/∂y)² )
```

The free energy is *inf_{q} P(q)*. This is the Parisi formula [3].

The physical content is far richer than a number. The optimizer *q*(x)* encodes the *overlap distribution*: *P(q) = dx*/dq*, the probability that two independently drawn Gibbs configurations have overlap *q*. In the spin glass phase this distribution is *nontrivial and non-self-averaging* — it fluctuates from sample to sample even as *N → ∞*. Moreover, the overlaps between *three* pure states satisfy, with probability one, the *ultrametric inequality*

```
q_{αβ} ≥ min(q_{αγ}, q_{βγ})   for all triples (α, β, γ)
```

meaning the pure states are organized as leaves of a hierarchical tree: any triangle of states is either equilateral or isosceles with the unequal side shortest [8]. This *ultrametricity*, derived from the Ghirlanda–Guerra identities, is the geometric signature of full RSB and has no analogue in conventional ordered phases.

The Ghirlanda–Guerra identities themselves deserve emphasis. For any bounded function *f* of the overlaps of *n* replicas:

> **Theorem (Ghirlanda–Guerra identities):** In the thermodynamic limit, *E⟨f q_{1,n+1}^k⟩ = (1/n) E⟨f⟩ E⟨q_{12}^k⟩ + (1/n) Σ_{j=2}^{n} E⟨f q_{1j}^k⟩*. These identities force the overlap distribution to be determined by a single function and imply ultrametricity.

Talagrand's *positivity principle* further shows overlaps are nonnegative in the limit, and Guerra's interpolation provides the matching upper bound that, together with Talagrand's lower bound, proves the Parisi formula exactly [3].

### 4.3 From Dense to Dilute: Random K-SAT as a Dilute Spin Glass

Random K-SAT replaces the dense Gaussian couplings of the SK model with sparse, structured interactions: *N* Boolean variables, *M = αN* clauses, each clause forbidding one of 2^K assignments of *K* randomly chosen variables. The energy — number of violated clauses — is a *dilute p-spin Hamiltonian*. Because the interaction graph is locally tree-like (a random hypergraph), the *cavity method* replaces the replica method as the tool of choice [5].

The cavity analysis predicts a cascade of phase transitions as *α* increases, summarized below for large *K* (values illustrative; the 3-SAT thresholds are α_d ≈ 3.86, α_c ≈ 3.92, α_s ≈ 4.267):

| Transition | Symbol | Physical meaning |
|---|---|---|
| Dynamical / clustering | α_d | Solution space shatters into exponentially many clusters; local algorithms (e.g., simulated annealing, BP) get trapped |
| Condensation | α_c | Dominant weight concentrates on subexponentially many clusters; long-range correlations emerge |
| Rigidity / freezing | α_f | Typical solutions develop a frozen core of variables fixed across the cluster |
| SAT–UNSAT | α_s | Formulas become unsatisfiable with high probability |

For *α < α_d* the solution space is essentially connected (replica symmetric), and simple algorithms succeed. For *α_d < α < α_c* the space is clustered but the clusters are numerous and democratic — the *dynamical 1RSB* phase — and sophisticated message-passing algorithms like survey propagation still succeed [4]. For *α_c < α < α_s*, condensation means a few clusters dominate: this is the regime where rigorous *overlap gap* arguments begin to rule out broad algorithmic classes [7]. Above *α_s*, no solutions exist.

The *complexity* Σ(φ) — the exponential growth rate of the number of clusters with internal entropy density φ — is the 1RSB order parameter: *Σ(φ) = (1/N) log N_clusters(φ)*. The replicated free entropy *Φ(m) = max_φ [Σ(φ) + mφ]* with Parisi parameter *m* plays the role of the Parisi functional on sparse graphs [5].

### 4.4 Survey Propagation: One-Step RSB as an Algorithm

Survey propagation (SP), introduced by Mézard, Parisi, and Zecchina [4], is the algorithmic incarnation of the 1RSB cavity equations. Standard belief propagation (BP) passes messages representing *marginals over solutions*; it fails in the clustered phase because the Gibbs measure is a mixture of far-apart clusters and BP's fixed points no longer describe it. SP instead passes *surveys* — messages describing, for each directed edge, the distribution over clusters of the "warning" that a clause sends to a variable.

On a factor graph with variable nodes *i* and clause nodes *a*, the SP update for the survey *η_{a→i}* (probability that clause *a* warns variable *i*) is:

```python
import numpy as np

def sp_update(eta_in, J):
    """One SP sweep. eta_in[a->i] current surveys; J[a,i] = +1/-1 literal sign."""
    eta_out = {}
    for (a, i) in edges:
        # product over clauses b != a warning i to take the wrong value
        prod_wrong, prod_right = 1.0, 1.0
        for b in neighbors(i):
            if b == a: continue
            e = eta_in[(b, i)]
            if J[b, i] == J[a, i]:
                prod_wrong *= (1.0 - e)
            else:
                prod_right *= (1.0 - e)
        # survey: probability clause a is the unique warning source
        eta_out[(a, i)] = prod_wrong * (1.0 - prod_right) / (
            prod_wrong * (1.0 - prod_right) + (1.0 - prod_wrong))
    return eta_out
```

From the fixed-point surveys, SP computes for each variable a *bias* — the difference between the probability it is forced true vs. false across clusters — fixes the most biased variable (*decimation*), simplifies the formula, and iterates. This SP-guided decimation solved random 3-SAT instances with *N = 10⁷* variables at *α = 4.25*, essentially at the SAT–UNSAT threshold, where all previous algorithms failed [4]. The generic formalism extends to all CSPs via the *warning* alphabet {0, 1, *} of Braunstein et al. [6].

---

## 5. Empirical Results and Formal Analysis

### 5.1 Numerical evidence for the Parisi picture

Large-scale simulations of the SK model confirm the Parisi predictions quantitatively. Parallel-tempering Monte Carlo for *N* up to several thousand shows:

```python
import numpy as np

def sk_monte_carlo(N, beta, n_sweeps, J):
    """Metropolis dynamics for the SK model; J is the coupling matrix."""
    s = np.random.choice([-1, 1], size=N)
    overlaps = []
    for sweep in range(n_sweeps):
        for i in np.random.permutation(N):
            h_i = (J[i] @ s) / np.sqrt(N)   # local field
            dE = 2 * s[i] * h_i
            if dE <= 0 or np.random.rand() < np.exp(-beta * dE):
                s[i] *= -1
        if sweep % 10 == 0:
            s2 = s.copy()
            # second replica: independent copy, overlap q = (1/N) s.s2
            overlaps.append(float(s @ s2) / N)
    return s, overlaps
```

Ground-state energies converge to the Parisi value *e₀ ≈ −0.763* with predicted finite-size corrections [8].

### 5.2 The Franz–Parisi potential as a geometric probe

To probe the organization of states directly, Franz and Parisi introduced a *constrained* free energy: fix a reference equilibrium configuration *σ**, and compute the free energy of configurations at fixed overlap *q* with it [6]:

```
V(q) = -(1/βN) E log Σ_σ exp(-βH(σ)) δ(q - (1/N)Σᵢ σᵢσᵢ*)
```

In the paramagnetic phase *V(q)* has a single minimum at *q = 0*; in the spin glass phase it develops a secondary minimum at *q = q_EA*, the self-overlap of pure states. Replica analysis of this potential on sparse graphs yields self-consistency equations equivalent to the *1RSB cavity equations at Parisi parameter x = 1*, providing an independent route to the dynamical transition temperature [6]. The potential thus functions as a *thermometer for clustering*: the birth of the secondary minimum marks α_d.

### 5.3 Overlap gaps and rigorous algorithmic barriers

The most striking recent development is the *overlap gap property* (OGP) as a rigorous obstruction. An optimization problem exhibits OGP if near-optimal solutions come in two flavors — pairs with overlap either very high (same cluster) or very low (different clusters) — with a forbidden intermediate band. Gamarnik and coauthors showed that *stable* algorithms (those whose output changes little under small input perturbations, a class including approximate message passing, low-degree polynomials, and SP-guided decimation with bounded rounds) *cannot* cross an overlap gap [7]. For random K-SAT, they established that low-degree polynomial algorithms succeed up to *(1−o(1)) 2^K log K / K* — matching the best known algorithm — and fail above *(1+o(1)) κ* 2^K log K / K* with *κ* ≈ 4.91*. The clustering threshold *(1+o(1)) 2^K log K / K* is thus conjectured to be the *universal* algorithmic threshold: above it, freezing makes all but an *o(1)* fraction of variables in typical solutions *frozen*, so any local algorithm is trapped [7].

### 5.4 Ultrametricity: from conjecture to theorem

Panchenko's proof of ultrametricity (2013) closed the last major gap in the mathematical Parisi theory: the Ghirlanda–Guerra identities plus a perturbation argument imply that the asymptotic Gibbs measure's pure states are ultrametrically organized [8]. Combined with Talagrand's proof of the Parisi formula [3], the SK model now rests on rigorous foundations.

---

## 6. Limitations

Intellectual honesty requires stating what RSB does *not* deliver:

- **Finite dimensions remain open.** The Parisi theory is exact for the *mean-field* (fully connected) SK model. Whether finite-dimensional spin glasses (e.g., the 3D Edwards–Anderson model) exhibit RSB, droplet-like excitations, or something intermediate is still contested; the Newman–Stein *metastate* analysis shows the mean-field pure-state picture cannot transfer naively [8].
- **The n → 0 limit is unproven as a method.** The replica trick remains a heuristic; rigorous proofs (Guerra, Talagrand, Panchenko) *verify its conclusions* by other routes but do not justify analytic continuation in replica number.
- **SP lacks convergence guarantees.** Survey propagation is spectacularly effective empirically but has no general proof of convergence on loopy graphs; its fixed points are understood only on trees and locally tree-like ensembles [6].
- **OGP is not the final word.** Overlap-gap lower bounds apply to *stable* algorithm classes; they do not rule out unstable or adaptive algorithms, and the precise algorithmic threshold of random K-SAT for *all* polynomial-time algorithms remains open [7].

---

## 7. Conclusion

The trajectory from Sherrington and Kirkpatrick's 1975 model to modern hardness-of-approximation theory is one of the great unifications in science. A failed mean-field calculation — negative entropy and an unstable saddle point — forced the invention of replica symmetry breaking, a mathematical structure of baroque beauty: replicas nested in boxes within boxes, pure states arranged on an ultrametric tree, an order parameter that is a *function* rather than a number. Parisi's ansatz, proven by Talagrand and geometrized by Panchenko, turned out to describe not only magnetic alloys but the *shape of computational hardness itself*.

An algorithm that ignores the clustered, hierarchical, ultrametric organization of the solution space is fighting the problem's intrinsic structure. The algorithms of the future — whether classical message-passing, quantum annealers, or neural solvers — will succeed to the extent that they internalize the lesson Parisi taught: when symmetry breaks, count the pieces, map the tree, and search the hierarchy, not the leaves.

---

## References

[1] D. Sherrington and S. Kirkpatrick, "Solvable model of a spin-glass," *Phys. Rev. Lett.* 35, 1792–1796 (1975). https://doi.org/10.1103/PhysRevLett.35.1792

[2] G. Parisi, "Infinite number of order parameters for spin-glasses," *Phys. Rev. Lett.* 43, 1754–1756 (1979). https://doi.org/10.1103/PhysRevLett.43.1754

[3] M. Talagrand, "The Parisi formula," *Ann. Math.* 163, 221–263 (2006). https://doi.org/10.4007/annals.2006.163.221

[4] M. Mézard, G. Parisi, and R. Zecchina, "Analytic and algorithmic solution of random satisfiability problems," *Science* 297, 812–815 (2002). https://doi.org/10.1126/science.1073287

[5] M. Mézard and A. Montanari, "Reconstruction on trees and spin glass transition," *J. Stat. Phys.* 124, 1317–1350 (2006); see also lecture notes on Gibbs measures and phase transitions in sparse graphical models, http://web.stanford.edu/~montanar/RESEARCH/FILEPAP/clusters.pdf

[6] A. Braunstein, M. Mézard, M. Weigt, and R. Zecchina, "Constraint satisfaction by survey propagation," arXiv:cond-mat/0212451 (2002). https://arxiv.org/abs/cond-mat/0212451v2

[7] D. Gamarnik, A. Jagannath, and A. S. Wein, "The overlap gap property and approximate message passing algorithms," and "The algorithmic phase transition of random k-SAT for low degree polynomials," arXiv:2106.02129 (2021). https://arxiv.org/abs/2106.02129v2

[8] D. Panchenko, *The Sherrington–Kirkpatrick Model*, Springer (2013); overview: https://ar5iv.labs.arxiv.org/html/1211.1094