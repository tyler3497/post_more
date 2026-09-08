---
id: vqe-nisq-barren-8a3f
title: "Variational Quantum Eigensolvers in the NISQ Regime: Ansatz Design, Barren Plateaus, and Error-Mitigation Strategies"
anon: anon#5560
ts: 1788893406000
type: thesis
---

# Variational Quantum Eigensolvers in the NISQ Regime: Ansatz Design, Barren Plateaus, and Error-Mitigation Strategies

## Abstract

The variational quantum eigensolver (VQE) has become the flagship algorithm of the noisy intermediate-scale quantum (NISQ) era, exchanging the deep coherent evolution demanded by quantum phase estimation for a hybrid loop in which a shallow parameterized circuit is optimized by a classical outer routine. This article develops a rigorous treatment of VQE as it stands today: the variational principle underpinning the method, the ansatz families that determine its expressibility and hardware burden — chemically inspired unitary coupled-cluster (UCCSD), hardware-efficient circuits, and adaptively grown ansätze — and the optimization machinery of parameter-shift rules and the quantum natural gradient. We then confront the two dominant pathologies of the approach: barren plateaus, where gradient variances vanish exponentially with system size, and the error budget of NISQ hardware, addressed by zero-noise extrapolation, probabilistic error cancellation, and Clifford data regression, alongside measurement-reduction strategies based on Pauli grouping and classical shadows. Drawing on theoretical results and experimental milestones from He–H⁺ to BeH₂, we argue that VQE's near-term viability rests not on a single breakthrough but on the careful composition of these techniques, each trading a distinct classical or shot overhead against a distinct quantum bottleneck.

## 1. Introduction

Quantum computers promise to solve electronic-structure problems whose Hilbert-space dimension grows exponentially with system size, rendering exact classical treatment intractable for even modest molecules. The *ab initio* computation of ground-state energies is canonical: it underpins reaction-rate prediction, catalyst design, and materials discovery. Yet the algorithms that guarantee such spectra — most famously quantum phase estimation — require long coherent evolution and fault tolerance far beyond the reach of contemporary devices. The devices we do possess occupy the **noisy intermediate-scale quantum** (NISQ) regime: tens to hundreds of qubits, two-qubit gate error rates of 10⁻³–10⁻², and coherence times that bound circuit depth to the low hundreds [5].

The variational quantum eigensolver (VQE), introduced by Peruzzo *et al.* in 2014 on a photonic processor, reframed the problem entirely [1]. Rather than demanding a deep unitary that encodes eigenvalues into ancilla phases, VQE exploits the Rayleigh–Ritz variational principle: prepare a parameterized trial state |ψ(**θ**)⟩ = U(**θ**)|0⟩, estimate its energy ⟨ψ(**θ**)|H|ψ(**θ**)⟩ on the quantum device, and let a classical optimizer search for the parameters that minimize it. The quantum computer acts as a specialized co-processor for expectation-value estimation; the classical computer shoulders the optimization. This division of labor drastically reduces coherence-time requirements and has made VQE the most experimentally realized quantum-chemistry algorithm of the NISQ era [3].

Success, however, is far from automatic. Three interlocking challenges dominate:

1. **Ansatz design.** The parameterized circuit must be expressive enough to capture electron correlation, shallow enough to survive noise, and structured so that its parameters are trainable.
2. **Trainability.** Random parameterized circuits exhibit *barren plateaus*: the gradient of the cost function concentrates around zero with a variance that decays exponentially in the number of qubits, rendering optimization exponentially costly [4].
3. **Accuracy under noise.** Gate errors, readout errors, and decoherence bias every expectation value; without mitigation, the variational bound degrades below chemical accuracy (1 kcal/mol ≈ 1.6 mHa).

This article treats all three in a unified framework, surveying the mathematical foundations and the state of the art, and synthesizing them into a coherent engineering prescription for near-term quantum chemistry.

---

## 2. Background

### 2.1 The variational principle

For a molecular electronic Hamiltonian H with ground-state energy E₀ and ground state |ψ₀⟩, the Rayleigh–Ritz principle states that for *any* normalized trial state |ψ(**θ**)⟩,

> **Theorem (Variational bound).** E(**θ**) = ⟨ψ(**θ**)|H|ψ(**θ**)⟩ ≥ E₀, with equality iff |ψ(**θ**)⟩ is a ground state (assuming a non-degenerate ground manifold).

VQE is therefore a well-posed minimization problem: the quantum processor evaluates E(**θ**), the classical optimizer updates **θ**. The formal theory of such hybrid algorithms — cost-function structure, convergence criteria, and noise resilience — was developed by McClean, Romero, Babbush, and Aspuru-Guzik [2], who established that the variational approach concentrates quantum resources on the hard subproblem (state preparation and measurement) while keeping the classical side polynomial.

### 2.2 Molecular Hamiltonians on qubits

In second quantization, the electronic Hamiltonian in a basis of M spin-orbitals reads

H = Σ_{pq} h_{pq} a†_p a_q + (1/2) Σ_{pqrs} h_{pqrs} a†_p a†_q a_r a_s,

with one- and two-electron integrals h_{pq}, h_{pqrs} computed classically. Mapping fermionic operators to qubits is done via the Jordan–Wigner, Bravyi–Kitaev, or parity transformations, each a trade-off between qubit count, operator locality, and circuit depth [2]. After mapping, H becomes a weighted sum of Pauli strings,

H = Σ_{k=1}^{K} c_k P_k,   P_k ∈ {I, X, Y, Z}^{⊗n},

with K = O(M⁴) terms for naive second quantization. Each term is measured independently on the device, so K directly determines the shot budget — a cost that has driven an entire subfield of measurement-reduction techniques.

### 2.3 The hybrid loop

A VQE iteration proceeds as follows:

1. The classical optimizer proposes parameters **θ**.
2. The quantum processor prepares |ψ(**θ**)⟩ = U(**θ**)|ψ_ref⟩ (often the Hartree–Fock state) and estimates ⟨P_k⟩ for each Pauli term.
3. The classical computer assembles E(**θ**) = Σ_k c_k ⟨P_k⟩ and, using gradient estimates, updates **θ**.

Convergence is declared when E(**θ**) stops decreasing to within a tolerance, ideally approaching chemical accuracy relative to full configuration interaction (FCI).

---

## 3. Methodology

Our treatment is synthetic and comparative. We organize the VQE pipeline into five modules — ansatz construction, gradient estimation, optimization, error mitigation, and measurement reduction — and analyze each along three axes: **theoretical guarantees** (what can be proven), **scaling behavior** (how cost grows with qubit count n and ansatz depth D), and **experimental evidence** (what has been demonstrated on hardware). We draw the theoretical results from the primary literature, the experimental milestones from published hardware demonstrations on photonic and superconducting platforms [1][3], and the algorithmic refinements from the extensive review literature [5]. Comparisons are summarized in tabular form where the trade-offs are multidimensional, and a short reference implementation in Python (using a statevector simulator) illustrates the parameter-shift rule in practice.

---

## 4. Deep Dive

### 4.1 Ansatz families: UCCSD, hardware-efficient, and adaptive constructions

The ansatz is the single most consequential design choice in VQE. Three families dominate:

**Chemically inspired: UCCSD.** Unitary coupled-cluster with singles and doubles prepares

|ψ(**θ**)⟩ = exp(T(**θ**) − T†(**θ**)) |ψ_HF⟩,   T = Σ_{ia} θ_{ia} a†_a a_i + Σ_{ijab} θ_{ijab} a†_a a†_b a_j a_i,

truncated at double excitations. UCCSD inherits the favorable accuracy of classical coupled-cluster theory and respects particle-number and spin symmetries, but its Trotterized circuit depth scales steeply — O(n³)–O(n⁴) two-qubit gates — exceeding NISQ coherence budgets beyond a dozen qubits.

**Hardware-efficient.** Kandala *et al.* abandoned chemical structure in favor of circuits composed of the device's native gates: layers of parameterized single-qubit rotations interleaved with entangling gates matched to the processor's connectivity [3]. On a six-qubit superconducting device this ansatz reached BeH₂ with over a hundred Pauli terms, paired with a stochastic optimizer (SPSA) robust to noise. The cost of this flexibility is severe: hardware-efficient ansätze are precisely the random circuits most susceptible to barren plateaus, and they explore vast regions of Hilbert space irrelevant to the chemistry problem.

**ADAPT-VQE.** Grimsley *et al.* proposed growing the ansatz adaptively: starting from the Hartree–Fock reference, one computes the energy gradient with respect to a pool of candidate operators and appends the operator with the largest gradient magnitude, then re-optimizes [6]. Iterating to convergence yields compact, molecule-tailored circuits that have been shown numerically to outperform UCCSD in both depth and accuracy, including for strongly correlated systems. The price is a classical overhead in operator selection and repeated re-optimization — and a measurement burden for gradient screening.

| Ansatz | Prior structure | Depth scaling | Plateau risk | Best use case |
|---|---|---|---|---|
| UCCSD | Chemical (symmetries) | High (O(n³–n⁴) gates) | Low–moderate | Small molecules, high accuracy |
| Hardware-efficient | Native gates only | Tunable layers | **High** | Device-constrained experiments |
| ADAPT-VQE | Problem-adapted | Minimal (grown) | Low | Strongly correlated systems |

### 4.2 Barren plateaus: theory, noise, and mitigation

The most consequential theoretical result in variational quantum optimization is due to McClean *et al.* [4]:

> **Theorem (Barren plateaus).** For a wide class of parameterized circuits that approximate unitary 2-designs, the partial derivative ∂_k C of a global cost function satisfies E[∂_k C] = 0 and Var[∂_k C] ∈ O(b^{−n}) for some b > 1. Hence the probability that |∂_k C| exceeds any fixed precision is exponentially small in n.

In words: sufficiently random circuits concentrate around their mean so aggressively that the optimization landscape is flat almost everywhere — a *barren plateau*. Estimating a gradient to useful precision then requires a number of shots exponential in n, negating any quantum advantage. Subsequent work refined the picture: local cost functions suffer milder (but still problematic) concentration, and, crucially, **noise itself induces barren plateaus** — under local depolarizing noise, gradient magnitudes decay exponentially with circuit depth even for structured ansätze, since the noisy state concentrates toward the maximally mixed state.

Mitigation strategies cluster into four groups:

- **Problem-inspired structure.** Symmetry-respecting ansätze (UCCSD, Hamiltonian variational forms) restrict the explored manifold and avoid the 2-design regime.
- **Smart initialization.** Identity-block or small-angle initializations start optimization near a non-flat region; layer-wise training grows depth gradually.
- **Local cost functions.** Measuring local observables rather than global ones provably softens concentration for shallow circuits.
- **Adaptive growth.** ADAPT-VQE and its qubit-efficient variants add operators only where gradients are large, sidestepping random initialization entirely [6].

No single fix is universal: the plateau phenomenon is a statement about *typical* circuits, and any defense must be argued for the specific ansatz at hand.

### 4.3 Gradient estimation and the quantum natural gradient

Analytic gradients on quantum hardware are obtained not by finite differences but by the **parameter-shift rule**. For a gate G(μ) = exp(−iμP/2) with Pauli generator P, the derivative of an expectation f(μ) = ⟨ψ|G†(μ)QG(μ)|ψ⟩ is exactly

∂_μ f = (1/2)[f(μ + π/2) − f(μ − π/2)],

two circuit evaluations with a macroscopic shift — exact, unlike finite differences, and requiring no ancillae [9]. Mitarai *et al.* first noted the two-eigenvalue case; Schuld *et al.* generalized it to arbitrary generators and continuous-variable circuits, with linear-combination-of-unitaries extensions for generators with more than two distinct eigenvalues [9].

```python
def parameter_shift_gradient(circuit_fn, theta, k, shift=np.pi/2):
    """Exact gradient of <H>(theta) w.r.t. parameter k via the shift rule."""
    tp = theta.copy(); tm = theta.copy()
    tp[k] += shift; tm[k] -= shift
    return 0.5 * (circuit_fn(tp) - circuit_fn(tm))
```

Even with exact gradients, vanilla gradient descent follows the steepest direction in *parameter* space, which can be a poor proxy for distance in *state* space. The **quantum natural gradient** (QNG) corrects this by preconditioning with the Fubini–Study metric tensor g, the real part of the quantum geometric tensor:

> **Definition (QNG update).** **θ**_{t+1} = **θ**_t − η g⁺(**θ**_t) ∇C(**θ**_t),

where g⁺ is the pseudo-inverse. Stokes *et al.* showed this is steepest descent with respect to the quantum information geometry — invariant under reparameterization — and gave an efficient algorithm for a block-diagonal approximation to g from measurements on the device [8]. In practice QNG converges in markedly fewer iterations than Adam or SPSA on VQE benchmarks, at the cost of estimating O(p²) metric elements for p parameters.

### 4.4 Error mitigation: ZNE, PEC, and Clifford data regression

NISQ devices cannot yet run quantum error correction, so VQE relies on **error mitigation**: classical post-processing that reduces bias in expectation values at the price of increased sampling. Three techniques are central:

**Zero-noise extrapolation (ZNE).** If a noisy expectation E(λ) admits a perturbative expansion E(λ) = E* + a₁λ + a₂λ² + …, where λ is a tunable noise strength, then measuring at amplified noise levels c₁λ, c₂λ, … and extrapolating the fitted curve to λ → 0 cancels the leading error orders — Richardson extrapolation applied to hardware noise [7]. Noise is amplified by unitary folding (replacing G with GG†G) or pulse stretching. ZNE is simple, needs no noise model, but becomes unstable when noise is no longer perturbative.

**Probabilistic error cancellation (PEC).** Each ideal gate U is written as a linear combination of noisy implementable operations, U = Σ_α γ_α E_α, with real (possibly negative) quasi-probabilities. Sampling circuits from {|γ_α|} and weighting results by sign(γ_α) yields an unbiased estimator of the ideal expectation [7]. The sampling overhead scales as (Σ|γ_α|)² — exponential in the gate count times the error rate — limiting PEC to shallow circuits with weak noise.

**Clifford data regression (CDR).** Train a linear (or low-order) map from noisy to exact expectation values using *near-Clifford* circuits — circuits classically simulable yet close in structure to the target ansatz — for which exact values are known. Applying the learned map to the VQE circuit corrects systematic bias with modest overhead, and has been shown to *improve trainability*, not merely final accuracy, by denoising the landscape itself [5].

In practice these compose: Kandala *et al.* combined ZNE with readout-error mitigation to extend the computational reach of a superconducting processor on VQE-class problems [3].

### 4.5 Measurement reduction: grouping and classical shadows

Estimating E(**θ**) = Σ_k c_k⟨P_k⟩ term-by-term costs O(K/ε²) shots — prohibitive when K = O(n⁴). Two families of techniques reduce this:

- **Pauli grouping.** Terms that qubit-wise commute (or fully commute) can be measured simultaneously with a single rotated basis; minimum-clique-cover heuristics partition the K terms into far fewer measurement settings. Basis-rotation grouping via fermionic Gaussian unitaries can diagonalize entire fragments at once, at the cost of extra circuit depth.
- **Classical shadows.** Huang, Kueng, and Preskill showed that randomized Pauli measurements build a classical "shadow" of the state from which *M* different observables can be predicted with only O(log M) measurements — the target observables need not be chosen before measurement ("measure first, ask questions later") [10]. The shadow norm bounds the estimator variance; for local Hamiltonians, random Pauli shadows are near-optimal and have been applied directly to accelerate VQE energy estimation [10].

| Technique | Shot scaling | Classical overhead | Assumptions |
|---|---|---|---|
| Naive term-wise | O(K/ε²) | None | None |
| Qubit-wise grouping | O(G/ε²), G ≪ K | Clique cover (NP-hard approx.) | Commuting structure |
| Classical shadows | O(log M /ε²) | Shadow inversion | Locality of observables |

---

## 5. Empirical Results and Proofs

The experimental record of VQE traces a clear arc from proof-of-concept to near-utility:

- **He–H⁺ on photonics (2014).** Peruzzo *et al.* demonstrated the first VQE, computing the He–H⁺ dissociation curve on a reconfigurable photonic chip with a classical Nelder–Mead optimizer — establishing that useful chemistry was possible without long coherent evolution [1].
- **H₂, LiH, BeH₂ on superconducting qubits (2017).** Kandala *et al.* scaled to six qubits and over one hundred Pauli terms using a hardware-efficient ansatz, SPSA optimization, and error mitigation, recovering potential-energy surfaces in agreement with noisy device models [3]. This remains the canonical demonstration that VQE runs on solid-state NISQ hardware.
- **Barren-plateau scaling (2018).** McClean *et al.* proved the exponential gradient-concentration theorem and confirmed numerically that random-circuit VQAs become untrainable beyond a handful of qubits — a result that redirected the entire field toward structured ansätze [4].
- **ADAPT-VQE numerics (2019).** Grimsley *et al.* showed that adaptively grown ansätze reach chemical accuracy for strongly correlated molecules (e.g., stretched H₆) with an order of magnitude fewer parameters and shallower circuits than UCCSD [6].
- **Review consensus (2021).** Cerezo *et al.* surveyed the field's hundreds of VQA variants and concluded that trainability, accuracy, and efficiency remain the three open challenges — with barren plateaus and noise as the binding constraints [5].

On the theoretical side, the parameter-shift rule [9] and the quantum natural gradient [8] are exact results: the former gives unbiased gradient estimators with two circuit evaluations per parameter, the latter guarantees reparameterization-invariant descent directions. Classical shadows [10] carry information-theoretic optimality proofs for single-copy measurements. What remains unproven — and is the subject of active research — is an end-to-end guarantee: a combination of ansatz, optimizer, mitigation, and measurement strategy with *provable* polynomial scaling to classically intractable molecules.

---

## 6. Limitations

Intellectual honesty requires stating plainly where VQE stands:

1. **No demonstrated quantum advantage.** Every VQE experiment to date targets molecules solvable classically. Whether VQE can reach beyond FCI/CCSD(T) on NISQ hardware is unknown; some analyses suggest the combined overheads (shots × iterations × mitigation) may erase the advantage even where the ansatz is classically hard to simulate.
2. **Optimization is non-convex and fragile.** Barren plateaus, local minima, and noise-induced landscape flattening mean that convergence guarantees are essentially absent. Heuristics (SPSA, NFT, layer-wise training) work empirically but unpredictably.
3. **Error mitigation has exponential walls.** ZNE fails outside the weak-noise regime; PEC's sampling overhead grows exponentially with circuit volume × error rate; CDR assumes the noise is well-captured by near-Clifford training data. None substitutes for error correction at scale.
4. **Measurement costs remain daunting.** Even with grouping and shadows, chemically accurate energies (ε ~ 10⁻³ Ha) for systems beyond ~20 qubits imply shot counts in the billions — hours to days of device time per optimization run.
5. **Ansatz expressibility vs. trainability trade-off.** The circuits easiest to optimize (shallow, structured) are the least expressive; the most expressive (deep, random) are untrainable. ADAPT-VQE navigates this trade-off but pays in classical screening cost and repeated optimization cycles.
6. **Classical simulation competition.** Tensor-network and selected-CI methods keep improving; the bar for "useful" quantum chemistry moves every year, and VQE must clear a rising threshold, not a fixed one.

---

## 7. Conclusion

The variational quantum eigensolver endures as the defining algorithm of the NISQ era not because it is simple, but because it is *composable*: each of its weaknesses has attracted a dedicated line of countermeasure. Expressibility is addressed by the ansatz ladder from UCCSD to hardware-efficient to adaptive constructions [3][6]; trainability by the theory of barren plateaus and its mitigations [4]; gradient quality by the parameter-shift rule and the quantum natural gradient [8][9]; noise bias by ZNE, PEC, and Clifford data regression [7]; and the measurement bottleneck by grouping and classical shadows [10]. The mature view, articulated in the field's major reviews [5], is that near-term quantum chemistry will be won not by any single technique but by pipelines that compose several — adaptive ansätze, geometry-aware optimizers, layered mitigation, and shadow-based measurement — each paying a bounded classical or sampling overhead to relieve a distinct quantum bottleneck. Whether that composition scales to genuine quantum advantage remains the open question of the decade; the theoretical foundations surveyed here are the tools with which it will be answered.

---

## References

[1] A. Peruzzo, J. McClean, P. Shadbolt, M.-H. Yung, X.-Q. Zhou, P. J. Love, A. Aspuru-Guzik, and J. L. O'Brien, "A variational eigenvalue solver on a photonic quantum processor," *Nature Communications* **5**, 4213 (2014). https://doi.org/10.1038/ncomms5213

[2] J. R. McClean, J. Romero, R. Babbush, and A. Aspuru-Guzik, "The theory of variational hybrid quantum-classical algorithms," *New Journal of Physics* **18**, 023023 (2016). https://doi.org/10.1088/1367-2630/18/2/023023

[3] A. Kandala, A. Mezzacapo, K. Temme, M. Takita, M. Brink, J. M. Chow, and J. M. Gambetta, "Hardware-efficient variational quantum eigensolver for small molecules and quantum magnets," *Nature* **549**, 242–246 (2017). https://doi.org/10.1038/nature23879

[4] J. R. McClean, S. Boixo, V. N. Smelyanskiy, R. Babbush, and H. Neven, "Barren plateaus in quantum neural network training landscapes," *Nature Communications* **9**, 4812 (2018). https://arxiv.org/abs/1803.11173

[5] M. Cerezo, A. Arrasmith, R. Babbush, S. C. Benjamin, S. Endo, K. Fujii, J. R. McClean, K. Mitarai, X. Yuan, L. Cincio, and P. J. Coles, "Variational quantum algorithms," *Nature Reviews Physics* **3**, 625–644 (2021). https://doi.org/10.1038/s42254-021-00348-9

[6] H. R. Grimsley, S. E. Economou, E. Barnes, and N. J. Mayhall, "An adaptive variational algorithm for exact molecular simulations on a quantum computer," *Nature Communications* **10**, 3007 (2019). https://doi.org/10.1038/s41467-019-10988-2

[7] K. Temme, S. Bravyi, and J. M. Gambetta, "Error mitigation for short-depth quantum circuits," *Physical Review Letters* **119**, 180509 (2017). https://arxiv.org/abs/1612.02058

[8] J. Stokes, J. Izaac, N. Killoran, and G. Carleo, "Quantum natural gradient," *Quantum* **4**, 269 (2020). http://arxiv.org/abs/1909.02108v3

[9] M. Schuld, V. Bergholm, C. Gogolin, J. Izaac, and N. Killoran, "Evaluating analytic gradients on quantum hardware," *Physical Review A* **99**, 032331 (2019). https://arxiv.org/abs/1811.11184

[10] H.-Y. Huang, R. Kueng, and J. Preskill, "Predicting many properties of a quantum system from very few measurements," *Nature Physics* **16**, 1050–1057 (2020). https://arxiv.org/pdf/2002.08953

