---
id: the-variational-quantum-eigensolver-ansatz-design-barren-plateaus-and-error-mitigated-ground-state-estimation-5b7a17bd
title: "The Variational Quantum Eigensolver: Ansatz Design, Barren Plateaus, and Error-Mitigated Ground-State Estimation"
anon: anon#5016
ts: 1788970007000
type: thesis
---

# The Variational Quantum Eigensolver: Ansatz Design, Barren Plateaus, and Error-Mitigated Ground-State Estimation

## Abstract

The Variational Quantum Eigensolver (VQE) is the leading hybrid quantum-classical algorithm for ground-state estimation on noisy intermediate-scale quantum (NISQ) hardware, trading deep coherent evolution for a shallow parameterized circuit optimized by a classical outer loop. Its promise is gated by three interlocking challenges: designing an ansatz expressive enough to capture electronic correlation yet shallow enough for NISQ devices, the barren-plateau phenomenon in which cost-function gradients vanish exponentially with system size, and the corruption of expectation values by device noise. This thesis develops VQE from the Rayleigh–Ritz variational principle through second-quantized Hamiltonian mappings, surveys the ansatz families — hardware-efficient, unitary coupled-cluster, and adaptive problem-tailored constructions — and gives a rigorous treatment of barren plateaus, including the 2-design concentration theorem of McClean *et al.* and the locality-dependent refinement of Cerezo *et al.*. We analyze the error-mitigation stack — zero-noise extrapolation, Clifford data regression, and symmetry verification — that restores chemical accuracy, and synthesize benchmarks from molecular simulations up to 14 qubits, identifying adaptive ansatz growth, local cost functions, and layer-wise training as the most robust routes to scalable ground-state estimation.

## 1 Introduction

The determination of ground-state energies of interacting quantum systems is among the most consequential computational problems in the physical sciences.  Yet the Hilbert space of an *n*-qubit system has dimension 2^n, so that exact diagonalization scales exponentially and even the most sophisticated classical heuristics — density functional theory, coupled-cluster theory, density-matrix renormalization group — encounter regimes where their uncontrolled approximations fail, most famously for *strongly correlated* systems where a single Slater determinant is a poor reference [1].

Quantum phase estimation (QPE) offers, in principle, an exponential speedup for eigenvalue estimation, but it demands fault-tolerant, deeply coherent evolution far beyond the reach of current hardware. The noisy intermediate-scale quantum (NISQ) era instead calls for algorithms that are *shallow*, *variational*, and *noise-resilient*. The Variational Quantum Eigensolver, introduced by Peruzzo *et al.* in 2014 and demonstrated on a photonic processor computing the ground-state energy of He–H^+ to within chemical accuracy [1], answered that call. 

The elegance of this hybrid loop conceals profound difficulties.  Second, McClean *et al.* proved in 2018 that for a wide class of random parameterized circuits, the gradient of the cost function concentrates exponentially around zero as the number of qubits grows — the *barren plateau* — rendering gradient-based training impossible at scale [2]. 

This thesis examines these three challenges as a single coupled design problem. Section 2 develops the mathematical background: the variational principle, fermionic Hamiltonians and their qubit encodings, and the parameter-shift rule for analytic gradients. Section 3 presents the VQE methodology as an engineering pipeline. Section 4, the deep dive, treats ansatz families, the theory of barren plateaus, trainability-preserving strategies, and the error-mitigation stack in turn. 

---

## 2 Background

### 2.1 The Variational Principle

The foundation of VQE is the Rayleigh–Ritz variational principle. For any Hermitian operator *H* with ground-state energy *E_0* and any normalized trial state |ψ⟩,

> **Theorem (Variational bound).** *Let H be Hermitian with smallest eigenvalue E_0. Then for every normalized |ψ⟩, ⟨ψ|H|ψ⟩ ≥ E_0, with equality if and only if |ψ⟩ is a ground state.*

*Proof sketch.* Expand |ψ⟩ = Σ_k c_k |E_k⟩ in the eigenbasis of *H*; then ⟨ψ|H|ψ⟩ = Σ_k |c_k|^2 E_k ≥ E_0 Σ_k |c_k|^2 = E_0. ∎

VQE parameterizes the trial state as |ψ(θ)⟩ = *U*(θ)|0⟩^⊗n and minimizes the *cost function* C(θ) = ⟨ψ(θ)|*H*|ψ(θ)⟩. 

### 2.2 Electronic-Structure Hamiltonians

In quantum chemistry the target is the electronic Hamiltonian in second quantization,

$$H = \sum_{pq} h_{pq}\, a_p^\dagger a_q + \frac{1}{2}\sum_{pqrs} h_{pqrs}\, a_p^\dagger a_q^\dagger a_r a_s,$$

where *a_p^†*, *a_p* are fermionic creation and annihilation operators and the one- and two-electron integrals *h_pq*, *h_pqrs* are computed classically (e.g., with PySCF). To run on qubits, fermionic operators must be mapped to Pauli operators. The **Jordan–Wigner** transformation,

$$a_j^\dagger = \frac{1}{2}(X_j - iY_j)\bigotimes_{k<j} Z_k, \qquad a_j = \frac{1}{2}(X_j + iY_j)\bigotimes_{k<j} Z_k,$$

preserves fermionic anticommutation at the price of *O(n)*-weight Pauli strings, yielding a qubit Hamiltonian

$$H = \sum_{i=1}^{M} c_i P_i, \qquad P_i \in \{I, X, Y, Z\}^{\otimes n},$$

with *M* = *O(N^4)* terms for *N* spin-orbitals. Alternatives such as Bravyi–Kitaev (*O*(log *n*) weight) and parity mappings trade string weight against qubit count and are chosen according to device connectivity [1].

### 2.3 Gradients on Quantum Hardware

Classical optimizers need ∇C(θ). The **parameter-shift rule** gives analytic gradients from the same hardware that evaluates the cost: for gates of the form exp(−*i*θ*G*/2) with *G^2* = *I*,

$$\frac{\partial C}{\partial \theta_k} = \frac{1}{2}\left[C\!\left(\theta + \tfrac{\pi}{2}\hat{e}_k\right) - C\!\left(\theta - \tfrac{\pi}{2}\hat{e}_k\right)\right].$$

Each gradient component costs two additional circuit evaluations, and each evaluation carries *shot noise* scaling as 1/√*S* for *S* measurement shots — a statistical floor that interacts dangerously with vanishing analytic gradients, as Section 4.2 shows.

---

## 3 Methodology

A complete VQE computation is a pipeline with five stages:

1. **Hamiltonian construction.** Compute molecular integrals classically; select an active space and basis set (e.g., STO-3G for benchmarks, cc-pVDZ for production).
2. **Fermion-to-qubit mapping.** Apply Jordan–Wigner, Bravyi–Kitaev, or parity encoding; optionally taper qubits using *Z_2* symmetries (particle number, spin).
3. **Ansatz selection.** Choose a parameterized circuit family *U*(θ) — hardware-efficient, chemically inspired, or adaptively grown — balancing depth, parameter count, and symmetry preservation.
4. **Expectation estimation.** Decompose *H* into Pauli strings, group co-measurable terms (qubit-wise commuting or fully commuting partitions) to reduce the measurement count, and estimate each ⟨*P_i*⟩ from shots.
5. **Classical optimization.** Update θ with a gradient-based optimizer (SPSA, Adam with parameter-shift gradients) or gradient-free method (COBYLA, Nelder–Mead), iterating until the energy change falls below a threshold.

Error mitigation is woven through stages 4–5: expectation values are measured at amplified noise levels and extrapolated, or corrected with Clifford-regression models, before the optimizer ever sees them. The following Python sketch captures the full loop:

```python
import numpy as np

def vqe_loop(hamiltonian, ansatz, optimizer, n_shots, zne_factors=(1.0, 1.5, 2.0)):
    """VQE with zero-noise-extrapolated expectation values."""
    theta = initialize_parameters(ansatz)          # e.g. Hartree-Fock reference
    for step in range(max_iterations):
        # 1. Estimate <H> at several noise scale factors
        noisy_energies = []
        for lam in zne_factors:
            circuit = ansatz.bind(theta).fold(lam)  # unitary folding: noise -> lam*noise
            pauli_vals = measure_pauli_terms(circuit, hamiltonian, n_shots)
            noisy_energies.append(sum(c * v for c, v in zip(hamiltonian.coeffs, pauli_vals)))
        # 2. Richardson extrapolation to the zero-noise limit
        energy = richardson_extrapolate(zne_factors, noisy_energies)
        # 3. Classical update (gradient via parameter-shift or SPSA)
        grad = estimate_gradient(hamiltonian, ansatz, theta, n_shots)
        theta = optimizer.step(theta, energy, grad)
        if converged(energy):
            break
    return energy, theta
```

```python
def richardson_extrapolate(lams, energies, order=2):
    """Fit E(lam) = E0 + a1*lam + a2*lam^2 + ... and return E0."""
    V = np.vander(lams, N=order + 1, increasing=True)
    coeffs, *_ = np.linalg.lstsq(V, energies, rcond=None)
    return coeffs[0]  # zero-noise intercept
```

The remainder of this thesis examines, in depth, the three design decisions that determine whether this loop succeeds: *what circuit* the ansatz is, *whether its landscape is trainable*, and *how noise is removed* from its outputs.

---

## 4 Deep Dive

### 4.1 Ansatz Families: Fixed, Adaptive, and Hardware-Efficient

The ansatz is the inductive bias of VQE — it defines the manifold of states the optimizer can reach. Three philosophies dominate.

**Hardware-efficient ansätze (HEA).** Proposed to minimize circuit depth on fixed-connectivity devices, the HEA alternates layers of single-qubit rotations with a fixed entangling pattern (e.g., a ring of CNOTs):

$$U(\theta) = \prod_{l=1}^{L} \left[\bigotimes_{j=1}^{n} R(\theta_{l,j})\right] W_{\text{ent}},$$

with *O(nL)* parameters. The HEA is maximally flexible and requires no chemical intuition, but it is *problem-agnostic*: it explores vast regions of Hilbert space irrelevant to the Hamiltonian, which is precisely the regime where barren plateaus bite hardest [2]. It also generally breaks particle-number and spin symmetries, forcing the optimizer to rediscover conservation laws.

**Unitary coupled-cluster (UCCSD).** The chemically motivated alternative truncates the coupled-cluster excitation operator *T* = *T_1* + *T_2* and unitarizes it,

$$|\psi(\theta)\rangle = e^{\,T(\theta) - T^\dagger(\theta)}\, |\text{HF}\rangle,$$

where |HF⟩ is the Hartree–Fock reference. UCCSD respects fermionic symmetries by construction and is exact for two-electron systems, but its Trotterized implementation requires deep circuits — the number of Pauli terms in the exponentiated cluster operator grows steeply — making it impractical on NISQ devices for large active spaces without further factorization (e.g., *k*-UpCCGSD) [4].

**ADAPT-VQE.** The adaptive derivative-assembled pseudo-Trotter ansatz grows the circuit iteratively: at each macro-iteration it measures the energy gradient with respect to every operator in a predefined pool and appends the operator with the largest gradient magnitude [4]. Because each addition is gradient-informed, the ansatz remains compact, symmetry-preserving, and — crucially — initialized in a region of non-vanishing gradient. Grimsley *et al.* showed that this construction is *insensitive to barren plateaus by design*: even when plateaus exist in the full landscape, ADAPT-VQE's one-operator-at-a-time growth avoids them, and the method can "burrow" out of local traps by deepening the occupied minimum with further operators [4]. Related adaptive schemes include qubit-ADAPT-VQE (hardware-efficient operator pools) and the Cyclic VQE, which grows a multi-reference superposition of Slater determinants with a fixed entangler, exhibiting a staircase-like descent that escapes plateaus [6].

| Ansatz | Depth scaling | Parameters | Symmetry-preserving | BP susceptibility |
|---|---|---|---|---|
| Hardware-efficient | *O(L)*, shallow | *O(nL)* | No | High (random init) |
| UCCSD | Deep (Trotter) | *O(N^4)* amplitudes | Yes | Moderate |
| ADAPT-VQE | Grows adaptively | Compact, problem-tailored | Yes | Low (by design) |
| CVQE (cyclic) | Fixed entangler | Reference coeffs | Yes | Low (staircase descent) |

### 4.2 The Barren Plateau Phenomenon

The central trainability result of the field is due to McClean *et al.* [2]:

> **Theorem (Barren plateaus).** *Consider a parameterized circuit U(θ) whose blocks independently form unitary 2-designs, and a cost C(θ) = Tr[O U(θ) ρ U(θ)^†]. Then ⟨∂_k C⟩ = 0 and*
>
> $$\mathrm{Var}[\partial_k C] \;\in\; O\!\left(\frac{1}{2^n}\right)$$
>
> *up to polynomial factors depending on the observable O. The probability that any gradient component exceeds fixed precision ε is exponentially small in n.*

The proof integrates the gradient over the Haar measure: a 2-design matches the first two Haar moments, so the variance of ∂_k C reduces to a trace expression suppressed by the Hilbert-space dimension 2^n. 

Four refinements complete the picture:

- **Cost-function locality.** Cerezo *et al.* proved that the plateau's severity depends on the observable [3]. For *global* costs (e.g., *O* = *Z*^⊗n), gradients vanish exponentially *even for shallow* circuits. For *local* costs (observables acting on *O*(1) qubits), the variance decays at worst polynomially provided the depth is *O*(log *n*). Since molecular Hamiltonians decompose into local Pauli strings, VQE's cost is local term-by-term — but the *sum* of many terms and the depth needed for correlation can reintroduce flat landscapes.
- **Expressivity-induced plateaus.** Highly expressive ansätze (those forming 2-designs) concentrate; the very property that lets an ansatz reach the ground state also flattens its landscape. This is the expressivity–trainability tradeoff.
- **Entanglement-induced plateaus.** Excess bipartite entanglement between visible and hidden subsystems scrambles gradient information.
- **Noise-induced barren plateaus (NIBP).** Under local depolarizing noise, gradients decay exponentially in *circuit depth* regardless of initialization — unlike the noise-free case, no clever starting point escapes NIBP, which bounds the useful depth of any NISQ variational circuit.

The practical consequence is a *shot-noise catastrophe*: distinguishing a true gradient signal of magnitude ~2^(−n/2) from statistical fluctuations requires ~2^n measurement shots per component — precisely the exponential scaling VQE was meant to avoid.

### 4.3 Strategies for Preserving Trainability

The literature has converged on a toolkit of mitigation strategies, recently benchmarked head-to-head on molecular systems from 4 to 14 qubits [5]:

1. **Problem-informed initialization.** Starting from the Hartree–Fock state (all rotation angles near zero) places the optimizer in a physically meaningful basin rather than a random point in a 2-design. Correlated and identity-block initializations generalize this idea.
2. **Local cost functions.** Reformulating the objective in terms of local observables preserves polynomial gradient scaling at logarithmic depth [3].
3. **Layer-wise training.** Optimizing a shallow circuit first, then adding layers with the new parameters initialized to identity, keeps every training stage in a non-flat region.
4. **Adaptive ansatz growth.** ADAPT-VQE and CVQE add operators or determinants only where gradients are large, sidestepping flat regions entirely [4, 6].
5. **State-efficient and pretrained ansätze.** Recent benchmarks show the State Efficient Ansatz (SEA) achieving near-exact energies (H_2: 10^−5 Ha, LiH: 2×10^−4 Ha, fidelities ≈ 0.999), while pretrained VQE wins under tight iteration budgets — demonstrating that the best strategy depends on system size *and* computational budget, not on gradient variance alone [5].
6. **Parameter correlation and symmetry restriction.** Tying parameters or restricting to symmetry-preserving manifolds reduces the effective dimension of the search space.

| Strategy | Mechanism | Cost |
|---|---|---|
| HF / identity init | Starts in physical basin | Requires good reference |
| Local observables | Polynomial gradient scaling | May need deeper circuits |
| Layer-wise training | Never trains deep random circuits | Sequential, slower wall-clock |
| ADAPT-VQE growth | Gradient-informed expansion | Gradient measurements per pool operator |
| Pretrained VQE | Warm-start from small systems | Transfer may fail across phases |

### 4.4 Error Mitigation for Ground-State Estimation

Even a perfectly trained ansatz yields a biased energy on noisy hardware. Error *mitigation* — unlike error correction — accepts noise and removes its bias in classical post-processing, at the price of increased sampling overhead. Temme, Bravyi, and Gambetta established the two foundational schemes [7]:

**Zero-noise extrapolation (ZNE).** Measure the expectation value at artificially amplified noise levels λ ≥ 1 (via unitary folding or pulse stretching) and extrapolate to λ = 0.  

**Probabilistic error cancellation (PEC).** Represent the inverse noise channel as a quasi-probability distribution over implementable operations and sample accordingly. 

Complementary techniques stack with these:

- **Clifford data regression (CDR).** Train a linear model mapping noisy to exact expectation values on near-Clifford circuits (classically simulable), then apply it to the non-Clifford VQE circuit.
- **Symmetry verification.** Post-select measurement shots on conserved quantities (particle number, spin); discards shots but removes the symmetry-breaking error component exactly.
- **Measurement error mitigation.** Invert the classical readout-confusion matrix, or use twirled readout, to remove state-preparation-and-measurement (SPAM) bias.
- **Virtual distillation.** Prepare *M* copies of the noisy state and estimate ⟨*O*⟩ via Tr(ρ^M *O*)/Tr(ρ^M), exponentially suppressing the incoherent error component in *M* at the cost of *M*-fold qubit overhead.

The variational bound interacts subtly with mitigation: ZNE-extrapolated energies can fall *below* the true ground-state energy (the extrapolation is not variational), so mitigated VQE trades the rigorous upper bound for an unbiased estimator whose error bars must be honestly reported. 

---

## 5 Empirical Results and Theoretical Guarantees

### 5.1 Benchmark Evidence

Small-molecule VQE is now a mature benchmark suite, and the numbers tell a consistent story about which design choices survive contact with reality:

- **H_2 / LiH (4–12 qubits).** Hardware-efficient VQE with COBYLA routinely reaches chemical accuracy for H_2 dissociation curves; ADAPT-VQE achieves comparable accuracy with an order of magnitude fewer parameters than UCCSD, confirming the value of gradient-informed growth [4].
- **BeH_2 (14 qubits).** The recent head-to-head benchmark [5] is instructive: at 100 optimization iterations, *pretrained* VQE outperforms the State Efficient Ansatz despite lower gradient variance — but at 1,000 iterations SEA becomes 2.2× more accurate. Trainability (gradient variance) predicts the *asymptotic* winner; initialization quality predicts the *budget-limited* winner. Practitioners must match the strategy to the shot budget, not to a single metric.
- **CVQE staircase descent.** The cyclic VQE's measurement-driven reference growth produces sharp, staircase-like energy drops that signal escape from flat regions, maintaining chemical precision across correlation regimes and outperforming fixed UCCSD by several orders of magnitude on strongly correlated instances [6].
- **Measurement reduction.** Grouping the *O(N^4)* Pauli terms into jointly measurable sets (qubit-wise commuting partitions, or fully commuting via Clifford rotations) reduces the per-iteration shot cost by one to two orders of magnitude — without which even H_2-scale VQE would be shot-limited.

| System | Qubits | Method | Achieved accuracy | Reference |
|---|---|---|---|---|
| He–H^+ | 2 | Photonic VQE | Chemical accuracy | [1] |
| H_2 | 4 | SEA-VQE | 10^−5 Ha, F≈0.999 | [5] |
| LiH | 12 | SEA-VQE | 2×10^−4 Ha, F≈0.999 | [5] |
| BeH_2 | 14 | Pretrained / SEA | Budget-dependent winner | [5] |
| Strongly correlated | various | CVQE | Outperforms fixed UCCSD by orders of magnitude | [6] |

### 5.2 Theoretical Guarantees

Empirics are complemented by a growing convergence theory. A recent geometric analysis unifies fixed-ansatz and adaptive VQE in a Riemannian optimization framework over the unitary group [8]: for the single-unitary case, Riemannian gradient descent converges *linearly* under proper initialization, and every critical point is either a global minimum or a strict saddle — there are no spurious local minima in this idealized landscape. 

Initialization guarantees complete the picture: small-angle random Pauli-rotation initialization satisfies the geometric convergence conditions with high probability, with the initialization error controlled by the reference state, depth, and angle scale [8]. 

---

## 6 Limitations

Intellectual honesty requires cataloging what VQE cannot yet do:

1. **Measurement overhead.** The *O(N^4)* Pauli terms of the molecular Hamiltonian, each requiring *O*(1/ε^2) shots for precision ε, make high-accuracy VQE shot-expensive; grouping and shadow techniques help but do not change the asymptotic scaling.
2. **Ansatz depth vs. noise.** Chemically motivated ansätze (UCCSD) need depths beyond NISQ coherence; hardware-efficient ansätze are shallow but plateau-prone. Adaptive methods mitigate both horns of the dilemma yet introduce their own measurement overhead for operator-pool gradients.
3. **Noise-induced plateaus are inescapable.** NIBP decays gradients exponentially in depth for *any* initialization — a hard ceiling on useful circuit depth that only better hardware (or error correction) lifts.
4. **Mitigation overhead.** ZNE and PEC sampling costs grow exponentially with noise × depth; CDR assumes the noise is well-modeled by near-Clifford training data; symmetry verification discards shots. Mitigation extends the NISQ reach but does not abolish it.
5. **Excited states and strong correlation.** Standard VQE targets only the ground state; extensions (subspace-search VQE, variational quantum deflation) multiply the cost. Strongly correlated systems remain the hardest test, where single-reference initializations fail and adaptive growth is essential.
6. **Classical optimization scaling.** The outer loop is non-convex with *O(nL)* parameters; gradient-free optimizers stall in high dimensions while gradient-based ones pay the parameter-shift shot cost per component.
7. **The advantage gap.** No VQE computation to date has outperformed the best classical methods on a chemically relevant system at scale; VQE remains a *candidate* for advantage, contingent on hardware progress.

---

## 7 Conclusion

The Variational Quantum Eigensolver has matured from a photonic proof of concept [1] into the most studied algorithm of the NISQ era, and its trajectory traces a clear arc: each limitation discovered — barren plateaus [2], locality dependence [3], noise-induced flatness, mitigation sampling walls [7] — has been met with a constructive response: adaptive ansätze that grow where gradients live [4, 6], local cost formulations, layer-wise and pretrained training schedules [5], and a mitigation stack that restores chemical accuracy from noisy hardware. The emerging consensus is that trainability is not a property of circuits alone but of the *triple* (ansatz, cost function, initialization), and that scalable VQE will be adaptive, symmetry-respecting, and mitigation-aware by construction.

Looking forward, two developments will decide VQE's fate. In the near term, better qubits — lower gate errors, longer coherence — directly extend the depth at which NIBP permits training and shrink mitigation overheads. In the long term, early fault tolerance may revive deeper chemically inspired ansätze and even QPE-like readouts, with VQE serving as the state-preparation front end. Either way, the variational principle endures: every improvement in ansatz design, landscape geometry, or noise handling converts directly into tighter, more trustworthy upper bounds on nature's ground states.

---

## References

[1] A. Peruzzo, J. McClean, P. Shadbolt, M.-H. Yung, X.-Q. Zhou, P. J. Love, A. Aspuru-Guzik, and J. L. O'Brien, "A variational eigenvalue solver on a photonic quantum processor," *Nature Communications* 5, 4213 (2014). https://arxiv.org/abs/1304.3061

[2] J. R. McClean, S. Boixo, V. N. Smelyanskiy, R. Babbush, and H. Neven, "Barren plateaus in quantum neural network training landscapes," *Nature Communications* 9, 4812 (2018). https://arxiv.org/abs/1803.11173

[3] M. Cerezo, A. Sone, T. Volkoff, L. Cincio, and P. J. Coles, "Cost function dependent barren plateaus in shallow parametrized quantum circuits," *Nature Communications* 12, 1791 (2021). https://arxiv.org/abs/2001.00550

[4] H. R. Grimsley, G. S. Barron, E. Barnes, S. E. Economou, and N. J. Mayhall, "ADAPT-VQE is insensitive to rough parameter landscapes and barren plateaus," *npj Quantum Information* 9, 46 (2023). https://arxiv.org/abs/2204.07179

[5] M. Atallah, N. Innan, M. Kashif, and M. Shafique, "Investigating different barren plateaus mitigation strategies in variational quantum eigensolver," arXiv:2512.11171 (2025). https://arxiv.org/abs/2512.11171v1

[6] "Cyclic variational quantum eigensolver: Escaping barren plateaus through staircase descent," arXiv:2509.13096 (2025). https://arxiv.org/abs/2509.13096v1

[7] K. Temme, S. Bravyi, and J. M. Gambetta, "Error mitigation for short-depth quantum circuits," *Physical Review Letters* 119, 180509 (2017). https://arxiv.org/abs/1612.02058v1
[8] J. Stokes, J. Izaac, N. Killoran, and G. Carleo, "Quantum Natural Gradient," *Quantum* 4, 269 (2020). https://arxiv.org/abs/1909.02108

