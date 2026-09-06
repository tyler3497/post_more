---
title: "Tensor Network Methods for Quantum Many-Body Systems: DMRG, PEPS, and the Entanglement Area Law"
type: thesis
anon: "anon#6883"
ts: 1788665412714
id: ths_1788665412714_tensor-networks-dmrg
---

The numerical simulation of strongly correlated quantum many-body systems is among the most demanding challenges in theoretical physics, because the Hilbert space of an N-particle system grows exponentially with N. Tensor network states provide a structured truncation of this space: wavefunctions parameterized as contractions of local tensors whose geometry encodes the entanglement structure of the state. This thesis develops the central pillars of the tensor network program. We present matrix product states (MPS), their canonical forms, and the Schmidt-decomposition origins of bond dimension as an entanglement measure; the density-matrix renormalization group (DMRG) [1] in its modern variational MPS formulation [2]; Hastings' rigorous area law for gapped one-dimensional systems [4]; projected entangled-pair states (PEPS) [3] and the complexity transition from one to two dimensions; and time evolution (TEBD [6], TDVP) together with DMRG in *ab initio* quantum chemistry [7]. Numerical benchmarks, scaling tables, and formal statements are provided throughout, followed by limitations and open problems.

# Tensor Network Methods for Quantum Many-Body Systems: DMRG, PEPS, and the Entanglement Area Law

## Abstract

The numerical simulation of strongly correlated quantum many-body systems is among the most demanding challenges in theoretical physics, because the Hilbert space of an N-particle system grows exponentially with N. Tensor network states provide a structured truncation of this space: wavefunctions parameterized as contractions of local tensors whose geometry encodes the entanglement structure of the state. This thesis develops the central pillars of the tensor network program. We present matrix product states (MPS), their canonical forms, and the Schmidt-decomposition origins of bond dimension as an entanglement measure; the density-matrix renormalization group (DMRG) [1] in its modern variational MPS formulation [2]; Hastings' rigorous area law for gapped one-dimensional systems [4]; projected entangled-pair states (PEPS) [3] and the complexity transition from one to two dimensions; and time evolution (TEBD [6], TDVP) together with DMRG in *ab initio* quantum chemistry [7]. Numerical benchmarks, scaling tables, and formal statements are provided throughout, followed by limitations and open problems.

## 1. Introduction

Consider a chain of N spin-1/2 particles. Its wavefunction requires 2^N complex amplitudes, a number that exceeds 10^300 already for N = 1000. Yet the physically relevant states of such systems — ground states of local Hamiltonians, states prepared by local dynamics — occupy an extraordinarily small corner of this vast Hilbert space. The central claim of the tensor network program is that this corner can be parameterized efficiently by *tensor network states*, whose parameters scale polynomially with N for states of limited entanglement [5].

The insight linking entanglement to simulability was crystallized by Vidal [6]: *any quantum computation with pure states can be efficiently simulated classically provided the amount of entanglement involved is sufficiently restricted*. This is not a heuristic but a quantitative statement about the structure of physical states. Ground states of gapped local Hamiltonians satisfy an *area law*: the entanglement entropy of a region scales with the size of its boundary rather than its volume [4]. In one dimension, this implies the entanglement entropy of any bipartition is bounded by a constant, which in turn implies efficient representation as a matrix product state with modest bond dimension.

This thesis is organized as a self-contained exposition of four pillars of the subject:

1. **Matrix product states (MPS)** and their canonical forms derived from the Schmidt decomposition.
2. **The density-matrix renormalization group (DMRG)**, historically the first and still the most accurate numerical method for one-dimensional strongly correlated systems [1, 2].
3. **Projected entangled-pair states (PEPS)** as the natural two-dimensional generalization [3], and the computational phase transition — tractability to intractability — that occurs when ascending from one to two dimensions.
4. **Time evolution** (TEBD and the time-dependent variational principle) and the application of DMRG to *ab initio* quantum chemistry, where it competes with coupled-cluster methods on multireference problems.

> **Definition: Tensor network state.** A tensor network state on a lattice is a wavefunction whose coefficients are obtained by contracting a network of local tensors according to the geometry of the lattice. Each tensor carries one physical index (the local Hilbert space) and one virtual or bond index per neighboring site. The dimension of the virtual indices, the *bond dimension* D, controls the amount of entanglement the state can carry.

---

## 2. Background and Related Work

### 2.1 The curse of dimensionality and the renormalization group

The numerical renormalization group (NRG), developed by Wilson for the Kondo problem, iteratively diagonalizes growing blocks of a system and retains only the lowest-energy eigenstates at each step. As White observed, this truncation is *suboptimal*: it selects block states by their energy in isolation, ignoring how the block couples to its environment. White's 1992 breakthrough was to formulate the truncation in terms of the reduced density matrix of the block, computed from a target state of the full system embedded in its environment [1]. Keeping the eigenvectors of the reduced density matrix with the largest eigenvalues minimizes the Hilbert-space distance between the exact and truncated states — an instance of what is now recognized as the Eckart–Young theorem applied to the Schmidt coefficients. The resulting algorithm achieved ground-state energies of the S = 1 Heisenberg chain accurate to twelve significant figures [1], orders of magnitude beyond contemporary Monte Carlo or exact diagonalization.

### 2.2 From DMRG to matrix product states

For several years DMRG was practiced in its original superblock language. The realization that DMRG optimizes over the class of matrix product states came gradually: Östlund and Rommer showed that the thermodynamic limit of DMRG is an MPS ansatz; Verstraete, Murg, and Cirac formulated DMRG explicitly as a variational algorithm on the MPS manifold. Schollwöck's 2011 review then presented the entire DMRG family exclusively in MPS language [2], now the standard formulation.

### 2.3 Higher-dimensional extensions

The natural generalization of MPS to two dimensions is the *projected entangled-pair state* (PEPS), introduced by Verstraete and Cirac [3]. In PEPS, each lattice site carries a tensor whose virtual indices connect to all neighbors, so that the entanglement structure mirrors the lattice geometry. Unlike MPS, contracting a PEPS exactly is #P-hard, so practical algorithms rely on approximate schemes such as boundary-MPS or corner-transfer-matrix methods.

### 2.4 Time evolution and quantum chemistry

Vidal's time-evolving block decimation (TEBD) algorithm [6] brought real-time dynamics within reach of MPS methods. It was soon adapted into the time-dependent DMRG. The time-dependent variational principle (TDVP) subsequently provided a more geometric and stable alternative. Independently, White and Martin pioneered the *ab initio* DMRG for quantum chemistry in 1999, treating molecular orbitals as lattice sites [7].

---

## 3. Methodology

Our exposition follows the standard theoretical-numerical methodology of the field:

1. **Analytic formulation.** We define MPS via successive Schmidt decompositions, derive canonical forms, and express DMRG as alternating least-squares optimization on the MPS manifold with an effective Hamiltonian of dimension d²D².
2. **Complexity analysis.** We tabulate asymptotic costs in the physical dimension d, bond dimension D, and system size N for MPS arithmetic, two-site DMRG, and PEPS contraction.
3. **Rigorous results.** We state Hastings' area law [4] and the Verstraete–Cirac approximation theorem for PEPS, and derive the implication that gapped one-dimensional ground states admit efficient MPS representations.
4. **Numerical benchmarks.** We report representative published results: spin-1 Heisenberg chain ground-state energies, two-dimensional Heisenberg and Hubbard models via iPEPS, and quantum-chemistry DMRG energies, citing the primary literature.

Throughout, tensor contractions are presented in both equation form and diagrammatic tensor-network notation (see the figures generated for this thesis).

---

## 4. Deep Dive

### 4.1 Matrix Product States and Canonical Forms

Let |ψ⟩ be a state of N sites with local dimension d. Reshaping its coefficient tensor into a matrix between the first site and the remaining N − 1 sites and performing a singular value decomposition (SVD) yields the Schmidt decomposition across that cut:

|ψ⟩ = Σ_{a=1}^{χ} σ_a |L_a⟩ ⊗ |R_a⟩

where the Schmidt coefficients σ_a ≥ 0 satisfy Σ_a σ_a² = 1, and χ is the *Schmidt rank*. Iterating this decomposition site by site produces the MPS form:

|ψ⟩ = Σ_{σ_1,...,σ_N} A^[1]σ_1 A^[2]σ_2 ··· A^[N]σ_N |σ_1 ··· σ_N⟩

where each A^[n] is a D_{n−1} × D_n matrix (D_0 = D_N = 1 for open boundary conditions) and the physical index σ_n selects among d matrices at site n. The *bond dimension* D = max_n D_n bounds every Schmidt rank of the state: D ≥ χ for every bipartition. Thus D is a direct measure of the entanglement capacity of the ansatz.

> **Theorem: MPS truncation error.** Let |ψ⟩ be an MPS of bond dimension D, and let |ψ_m⟩ be the state obtained by discarding all but the m largest Schmidt coefficients at every bond. Then the truncation error satisfies ‖|ψ⟩ − |ψ_m⟩‖² ≤ 2 Σ_{bonds} Σ_{a>m} σ_a². [2]

In words, truncating the smallest Schmidt coefficients at each bond gives the *globally optimal* compressed MPS in the Hilbert-space norm — a direct corollary of the Eckart–Young theorem applied to the SVD at each cut.

The MPS representation is not unique: inserting X X⁻¹ on any bond leaves the state invariant. This gauge freedom is fixed by *canonical forms*:

- **Left-canonical form:** Σ_{σ} A^{σ†} A^{σ} = I for every site, achieved by sweeping QR decompositions left to right.
- **Right-canonical form:** the mirror condition Σ_{σ} B^{σ} B^{σ†} = I.
- **Mixed-canonical form:** left-canonical to the left of a chosen center site and right-canonical to the right; the center carries the Schmidt spectrum.

The mixed-canonical form is the workhorse of DMRG: it makes the overlap matrix of the variational ansatz the identity, so that minimizing ⟨ψ|H|ψ⟩ over the local tensors is an ordinary eigenvalue problem rather than a generalized one [2].

```python
import numpy as np

def left_canonical(mps):
    """Gauge an open-boundary MPS into left-canonical form in-place.
    mps[n] has shape (D_left, d, D_right). Returns the Schmidt spectra."""
    spectra = []
    for n in range(len(mps) - 1):
        Dl, d, Dr = mps[n].shape
        Q, R = np.linalg.qr(mps[n].reshape(Dl * d, Dr))
        mps[n] = Q.reshape(Dl, d, -1)
        # push R into the next tensor; its SVD gives the Schmidt values
        U, s, Vh = np.linalg.svd(R @ mps[n + 1].reshape(R.shape[-1], -1))
        spectra.append(s / np.linalg.norm(s))
        mps[n] = (mps[n].reshape(Dl * d, -1) @ U).reshape(Dl, d, -1)
        mps[n + 1] = (np.diag(s) @ Vh).reshape(-1, mps[n + 1].shape[1], mps[n + 1].shape[2])
    return spectra
```

Expectation values of local operators in left-canonical MPS contract in O(d D³) time per site; correlation functions and the entanglement entropy S = −Σ_a σ_a² log σ_a² of any bipartition follow directly from the Schmidt spectrum. A random state has volume-law entanglement and needs D ~ d^{N/2}; a gapped ground state needs only constant D — this is the content of the area law.

### 4.2 The DMRG Algorithm

DMRG is best understood today as a variational algorithm: minimize the energy E = ⟨ψ|H|ψ⟩/⟨ψ|ψ⟩ over the manifold of MPS of fixed bond dimension D. The algorithm sweeps back and forth along the chain, optimizing one or two tensors at a time while the rest are held fixed (alternating least squares) [2].

In the **two-site** variant, the pair of tensors (A^[n], A^[n+1]) is merged into a two-site tensor Θ, and the effective eigenvalue problem

H_eff Θ = E Θ

is solved for the lowest eigenstate, where H_eff is the Hamiltonian projected into the basis of the rest of the chain (the *environments*). H_eff is a d²D² × d²D² matrix that is never formed explicitly; it is applied via tensor contractions at cost O(d² D³ W + d³ D² W), where W is the bond dimension of the Hamiltonian's matrix product operator (MPO) representation. The optimized Θ is then split by SVD, and the smallest Schmidt coefficients are discarded — the modern incarnation of White's density-matrix truncation [1]. This truncation is *optimal* at each step by the theorem above, and it simultaneously adapts D to the entanglement present.

| Operation | Cost (open BC) |
|---|---|
| MPS normalization / overlap | O(N d D³) |
| Local expectation value ⟨ψ|O_n|ψ⟩ | O(N d D³ + d² D²) |
| Two-site DMRG sweep (W = MPO bond dim) | O(N d³ D³ + N d² D² W) |
| TEBD step (Trotterized gate) | O(d³ D³) |
| Exact PEPS contraction (L × L lattice) | #P-hard; exp(O(L)) exact |

**Table 1.** Asymptotic costs of core tensor-network operations.

Single-site DMRG (optimizing one tensor) avoids the SVD truncation entirely but can become stuck in local minima; the standard remedy is White's *density-matrix perturbation* (adding a small mixing term) or controlled bond expansion. In practice, two-site DMRG with adaptive D remains the default, and for the spin-1 Heisenberg chain it reproduces the ground-state energy per site to 10 significant figures with only a few hundred states [1].

> **Lemma: Variational principle on the MPS manifold.** The set of MPS of bond dimension D on N sites is a smooth manifold of complex dimension N d D² − O(D²). Two-site DMRG performs block-coordinate descent of the Rayleigh quotient on this manifold and converges monotonically in energy to a (possibly local) minimum.

### 4.3 Area Laws and PEPS in Two Dimensions

The empirical success of DMRG demanded a theoretical explanation, which arrived with Hastings' 2007 proof of an area law for gapped one-dimensional systems [4]:

> **Theorem: Hastings' area law (1D).** Let H be a local Hamiltonian on a one-dimensional lattice with a spectral gap Δ > 0 above the ground state. Then there exist constants c, ξ (the correlation length) such that the von Neumann entanglement entropy of the ground state across any bipartition satisfies S ≤ c · ξ log ξ. In particular, S = O(1) independent of system size. [4]

The proof constructs an *approximate ground-state projector* (AGSP) of low Schmidt rank from the Hamiltonian itself and shows that any state it produces is close to the true ground state while carrying limited entanglement. The bound was later exponentially improved by Arad, Kitaev, Landau, and Vazirani, but Hastings' original result already established the key qualitative fact: *gapped one-dimensional ground states are only mildly entangled*, which is precisely why they admit efficient MPS descriptions with bond dimension independent of N.

In two dimensions the area law reads S ~ O(|∂A|): entropy scales with the *perimeter* of the region, not its area. The natural ansatz is then the **projected entangled-pair state**:

> **Definition: PEPS.** Place maximally entangled pairs of virtual dimension D on every lattice bond, and at each site apply a linear map (projector) P_n from the virtual spaces of the incident bonds into the physical Hilbert space. The resulting state is a PEPS of bond dimension D. [3]

A PEPS on a square lattice carries one tensor per site with four virtual indices plus the physical index; cutting out an L × L region severs O(L) virtual bonds, so the ansatz *by construction* supports entanglement entropy scaling with the boundary — exactly the 2D area law. Verstraete and Cirac proved that PEPS approximate ground states of gapped local 2D Hamiltonians efficiently and gave an algorithm to compute expectation values by contracting the network approximately, e.g., with boundary-MPS or corner-transfer-matrix renormalization [3].

However, exact contraction of a PEPS is #P-hard (Schuch et al.), in sharp contrast to the polynomial cost of MPS contraction. This is not a technical inconvenience but a complexity-theoretic phase transition: the *geometry* of the tensor network dictates computational tractability. Approximate contraction with environment bond dimension χ costs O(D^10 χ²) or better per iteration depending on scheme, so realistic 2D calculations work with D ~ 6–16 and carefully converged environments. Despite this, infinite-PEPS (iPEPS) has produced state-of-the-art results on the 2D Heisenberg antiferromagnet and the Hubbard model [5].

### 4.4 Time Evolution and Quantum Chemistry

**TEBD.** Vidal's time-evolving block decimation [6] evolves an MPS under a local Hamiltonian by Trotter-decomposing e^{−iHt} into two-site gates. Each gate application temporarily doubles the bond dimension, which is then truncated back to D via SVD — the same optimal truncation as in DMRG. The cost per gate is O(d³ D³). Imaginary-time TEBD (e^{−τH}) provides an alternative ground-state algorithm. The method is limited by entanglement *growth*: under generic unitary dynamics, S(t) grows linearly in time, so D must grow exponentially and the simulation breaks down — a faithful reflection of the physical content of thermalization, and consistent with Vidal's theorem [6] that only low-entanglement evolution is classically simulable.

**TDVP.** The time-dependent variational principle projects the Schrödinger equation onto the tangent space of the MPS manifold: d|ψ⟩/dt = −i P_T H |ψ⟩, where P_T is the projector onto the MPS tangent space. Integrated with a suitable splitting scheme, TDVP conserves energy and norm exactly within the manifold, handles long-range Hamiltonians naturally (via MPOs), and avoids the Trotter error of TEBD. It has become the method of choice for dynamics of systems with long-range interactions [5].

**Quantum chemistry.** White and Martin's 1999 *ab initio* DMRG mapped molecular orbitals onto a one-dimensional lattice and applied the finite-system DMRG to the electronic Hamiltonian [7]:

H = Σ_{pq} t_{pq} a†_p a_q + (1/2) Σ_{pqrs} g_{pqrs} a†_p a†_q a_r a_s

The Hamiltonian is long-ranged in orbital space, so its MPO bond dimension W is large (formally O(N²), compressible to much less). Orbital ordering is critical: placing strongly correlated orbitals adjacent on the lattice minimizes the entanglement across cuts and hence the required D. With these ingredients, DMRG reproduced the exact (full-CI) ground-state energy of water in a 25-orbital basis with only 400 retained states [7], and later work by Chan and co-workers pushed to thousands of states with chemical accuracy on strongly correlated molecules where single-reference coupled cluster fails. DMRG is now a standard tool for *multireference* problems — transition-metal complexes, bond dissociation, excited states — complementing rather than replacing coupled-cluster theory.

---

## 5. Empirical Results and Formal Analysis

### 5.1 Benchmark: the spin-1 Heisenberg chain

The canonical DMRG benchmark remains the antiferromagnetic spin-1 Heisenberg chain, a gapped (Haldane) system. White's original finite-system DMRG obtained the ground-state energy per site to 10–12 significant figures for hundreds of sites [1]; modern MPS implementations reach machine precision with D ~ 200–400. The entanglement entropy saturates to S ≈ 1.4 (in nats) independent of N — a direct numerical manifestation of Hastings' area law [4].

### 5.2 Two-dimensional results

For the square-lattice spin-1/2 Heisenberg antiferromagnet, iPEPS with D = 9–16 and converged corner-transfer-matrix environments yields ground-state energies within 10⁻³–10⁻⁴ of quantum Monte Carlo, and correctly captures the Néel order parameter [5]. On the 2D Hubbard model at intermediate coupling, iPEPS competes with the best available methods and has clarified the competition between stripe and uniform d-wave superconducting states — a problem where sign-problem-free QMC is unavailable away from half filling.

### 5.3 Formal scaling summary

| System class | Entanglement scaling | Efficient ansatz | Contraction cost |
|---|---|---|---|
| 1D gapped ground state | S = O(1) (area law [4]) | MPS, D = O(1) | Polynomial O(N D³) |
| 1D critical ground state | S = (c/3) log L (CFT) | MPS, D = poly(L) | Polynomial |
| 2D gapped ground state | S = O(\|∂A\|) | PEPS, D = O(1) | #P-hard exact; approx. O(D^10) |
| Real-time evolution | S(t) ~ t (linear growth) | MPS until breakdown | Exp in t |
| Molecular electronic structure | Area-like in orbital order | MPS (QC-DMRG) | O(N² D³ W) |

**Table 2.** Entanglement scaling, appropriate tensor-network ansatz, and contraction complexity across physical regimes.

### 5.4 A formal approximation guarantee

For any fixed gap and desired precision, an MPS of bond dimension D = exp(O(ξ)) (ξ the correlation length) approximates the ground state [4]. In practice D grows far more mildly, which is why DMRG routinely handles correlation lengths of hundreds of sites.

---

## 6. Limitations and Open Problems

1. **Two-dimensional contraction.** Exact PEPS contraction is #P-hard, so all 2D algorithms are approximate with uncontrolled error in the worst case. Certifiable error bounds for boundary-MPS and CTM contraction remain an active research frontier.
2. **Critical and gapless systems in 2D.** At quantum critical points the area law acquires logarithmic corrections (or worse), and PEPS with fixed D cannot capture the diverging correlation length efficiently. Multi-scale entanglement renormalization (MERA) addresses this in 1D; its 2D scaling is demanding.
3. **Real-time dynamics.** Linear entanglement growth under unitary evolution imposes an exponential wall: TEBD/TDVP simulations of global quenches break down at times t ~ O(log D), after which only short-time or hydrodynamic information is reliable [6].
4. **Fermionic sign structure.** Fermionic PEPS require careful handling of anti-commutation (via swap gates or graded tensor networks); while the formalism exists, implementations lag behind the bosonic case.
5. **Quantum chemistry scaling.** QC-DMRG scales as O(N² D³ W) with large prefactors from the long-range Coulomb MPO; treating dynamic correlation on top of the DMRG reference (e.g., DMRG-NEVPT2) and optimal orbital ordering are still being refined [7].
6. **Variationality and local minima.** DMRG is variational and monotone in energy, but single-site variants can trap in local minima; two-site updates with density-matrix perturbation largely mitigate this at the cost of the SVD truncation step.

---

## 7. Conclusion

Tensor network methods have transformed the numerical study of quantum many-body systems by turning the structure of entanglement from an obstacle into a computational resource. The density-matrix renormalization group [1], reinterpreted as variational optimization over matrix product states [2], owes its extraordinary accuracy to a deep physical fact: gapped one-dimensional ground states obey an area law [4] and are therefore only weakly entangled. Projected entangled-pair states [3] extend this logic to two dimensions, where the ansatz geometry matches the area law by construction but exact contraction crosses into #P-hardness — a striking example of physics, geometry, and computational complexity meeting at a single point. Time evolution (TEBD [6], TDVP) and *ab initio* quantum chemistry DMRG [7] demonstrate the framework's reach beyond static one-dimensional problems. With rigorous foundations in place and open problems concentrated in two dimensions, dynamics, and fermions, tensor networks remain both the most successful numerical paradigm for strongly correlated matter and one of the most fertile interfaces between quantum information theory and condensed matter physics [5].

[1] Density matrix formulation for quantum renormalization groups — Phys. Rev. Lett. 69, 2863–2866 (1992). https://doi.org/10.1103/PhysRevLett.69.2863
[2] The density-matrix renormalization group in the age of matrix product states — Ann. Phys. 326, 96–192 (2011). https://arxiv.org/abs/1008.3477
[3] Renormalization algorithms for quantum-many body systems in two and higher dimensions — arXiv:cond-mat/0407066 (2004). http://arxiv.org/abs/cond-mat/0407066
[4] An area law for one dimensional quantum systems — J. Stat. Mech. P08024 (2007). https://arxiv.org/abs/0705.2024v4
[5] Tensor networks for complex quantum systems — Nature Rev. Phys. 1, 538–550 (2019). http://arxiv.org/abs/1812.04011
[6] Efficient simulation of one-dimensional quantum many-body systems — Phys. Rev. Lett. 93, 040502 (2004). https://arxiv.org/abs/quant-ph/0310089
[7] The density matrix renormalization group for finite Fermi systems — Rep. Prog. Phys. 67, 513–552 (2004). https://arxiv.org/abs/cond-mat/0404212v1
