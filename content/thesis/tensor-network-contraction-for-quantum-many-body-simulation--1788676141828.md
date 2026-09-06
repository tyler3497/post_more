---
title: "Tensor Network Contraction for Quantum Many-Body Simulation: From Matrix Product States and DMRG to the #P-Complete Frontier of PEPS Contraction"
date: 1788676141828
author: "anon#6758"
type: thesis
id: "ths_1788676141828_3029"
images: ["ths_1788676141828_3029-0.webp", "ths_1788676141828_3029-1.webp", "ths_1788676141828_3029-2.webp"]
---

# Tensor Network Contraction for Quantum Many-Body Simulation: From Matrix Product States and DMRG to the #P-Complete Frontier of PEPS Contraction

## Abstract

Tensor networks compress the exponentially large Hilbert space of quantum many-body systems by encoding entanglement locally, converting the curse of dimensionality into a problem of contraction ordering. This thesis develops the theory and practice of tensor network contraction for quantum simulation, beginning with matrix product states (MPS) and the density-matrix renormalization group (DMRG) of White [2], whose reformulation in MPS language by Schollwöck [1] turned one-dimensional simulation into a controlled science. We show how Hastings' area law [3] guarantees efficient MPS approximation of gapped ground states, derive the DMRG sweep as variational optimization over the MPS manifold with SVD-optimal truncation, and extend the analysis to projected entangled pair states (PEPS) [4], where exact contraction becomes #P-complete [6] and practical computation relies on boundary-MPS, corner-transfer-matrix, and hyper-optimized contraction paths whose cost is governed by treewidth [10]. Empirical benchmarks — Heisenberg-chain DMRG at bond dimension χ ∼ 10³, iPEPS full-update scaling, and 49-qubit random-circuit simulation [8] — quantify the boundary between classically tractable and quantum-advantaged regimes. We close with the limitations that define the field: volume-law entanglement, critical two-dimensional systems, long-time dynamics, and the variationality gap of approximate PEPS contraction.

---

## 1 Introduction

A system of *N* spin-1/2 particles lives in a Hilbert space of dimension 2^N. For *N* = 300 — a modest number by condensed-matter standards — this already exceeds the number of atoms in the observable universe by roughly ten orders of magnitude. Exact diagonalization stalls at *N* ≈ 40 spins [1]; quantum Monte Carlo evades the exponential wall only where the sign problem does not intervene; mean-field theory discards precisely the correlations that make quantum matter interesting.

Tensor networks resolve this impasse through a single physical observation: **the states realized in nature are not generic**. A Haar-random state has volume-law entanglement and is computationally incompressible, but ground states of local Hamiltonians obey *area laws* — their entanglement entropy scales with the boundary, not the volume, of a subsystem [3]. Tensor networks are the natural mathematical language of area-law states. A tensor network factorizes a rank-*N* amplitude tensor into a contracted assembly of low-rank tensors, with auxiliary *bond indices* whose dimension χ controls the amount of entanglement the ansatz can carry. Where the entanglement is small, χ is small, and the exponential is tamed.

This thesis is a study of one central question: **given a tensor network, how do we contract it, and what does contraction cost?** The answer bifurcates sharply by geometry. In one dimension, contraction is a linear-time dynamic program, and the density-matrix renormalization group (DMRG) exploits this to become the gold standard for 1D statics and dynamics [1][2]. In two dimensions, exact contraction of projected entangled pair states (PEPS) is #P-complete [6], forcing a sophisticated ecosystem of approximate schemes — boundary MPS, corner transfer matrices, and hyper-optimized contraction paths selected by treewidth analysis [10]. The same contraction technology, applied to quantum circuits rather than ground states, underwrites the classical simulation frontier that defines quantum advantage [8].

The thesis proceeds as follows. Section 2 establishes the graphical calculus, Schmidt decomposition, area laws, and the MPS formalism. Section 3 develops the methodology: contraction ordering and cost analysis, the DMRG sweep, boundary-MPS contraction for PEPS, and tensor-network quantum circuit simulation. Section 4 deep-dives into five technical pillars: canonical forms and MPS geometry, DMRG as variational optimization, the PEPS contraction bottleneck, treewidth and hyper-optimized paths, and entanglement scaling limits. Section 5 states the key theorems and empirical benchmarks, Section 6 the limitations, and Section 7 concludes.

---

## 2 Background

### 2.1 Graphical calculus and the cost of contraction

Following Penrose, we draw tensors as shapes and indices as legs: a vector is a shape with one leg, a matrix two, a rank-*r* tensor *r* legs. Joining two legs denotes summation over the shared index — *contraction* — and a closed diagram evaluates to a scalar. This notation is not decoration; it is a *programming language* for multilinear algebra in which the dominant question is always **in what order do we contract?**

Because cost multiplies across the sequence, contraction ordering is the difference between polynomial and exponential runtime for the *same* diagram. For a chain of *N* matrices, left-to-right contraction costs O(Nχ³) while naive simultaneous contraction costs O(χ^N). Every algorithm in this thesis is, at bottom, a clever contraction ordering.

### 2.2 Schmidt decomposition and entanglement entropy

For any bipartition of a pure state |ψ⟩ into subsystems *A* and *B*, the Schmidt decomposition

> **Theorem (Schmidt):** *Every pure bipartite state admits a decomposition |ψ⟩ = Σₖ λₖ |aₖ⟩|bₖ⟩ with orthonormal {|aₖ⟩}, {|bₖ⟩} and non-negative Schmidt coefficients λₖ, Σₖ λₖ² = 1. The number of nonzero λₖ is the Schmidt rank.*

The reduced density matrix ρ_A has eigenvalues λₖ², and the *entanglement entropy* S = −Σₖ λₖ² log λₖ² quantifies the entanglement across the cut. A state representable with Schmidt rank χ across every cut satisfies S ≤ log χ — the **bond dimension is an entanglement budget**, and truncation to the largest λₖ is optimal in both Frobenius and trace norm by the Eckart–Young theorem. This optimality is the engine of every tensor-network algorithm.

### 2.3 Area laws: why tensor networks work

> **Theorem (Hastings' area law [3]):** *The ground state of a gapped, local one-dimensional Hamiltonian has entanglement entropy bounded by a constant independent of system size: S ≤ O(1). Moreover, the ground state is approximable to precision ε by an MPS of bond dimension polynomial in N/ε.*

The proof uses Lieb–Robinson bounds and the exponential clustering of correlations in gapped systems. The consequence is profound: **1D gapped ground states live in a tiny, MPS-describable corner of Hilbert space**. In two dimensions the area law S ∼ L is strongly supported but a full proof for gapped 2D systems remains open; PEPS are its natural ansatz. At criticality the 1D area law is violated logarithmically, S ∼ (c/3) log L, requiring χ ∼ L^(c/3) — polynomial, hence still tractable.

### 2.4 Matrix product states: definition, canonical forms, gauge freedom

A matrix product state on *N* sites with local dimension *d* is

|ψ⟩ = Σ_{s₁…s_N} Tr(A^[1]s₁ A^[2]s₂ ⋯ A^[N]s_N) |s₁…s_N⟩,

where each A^[i]sᵢ is a χᵢ₋₁ × χᵢ matrix and χ = max χᵢ is the *bond dimension*. The representation has a **gauge freedom**: inserting X X⁻¹ on any bond (A^[i] → A^[i]X, A^[i+1] → X⁻¹A^[i+1]) leaves |ψ⟩ invariant. Fixing the gauge yields *canonical forms*: in left-canonical form Σ_s A^[i]†s A^[i]s = I, so that truncations are globally optimal; the mixed-canonical form with an orthogonality center at the active bond makes local updates variationally optimal and underlies DMRG [1]. The transfer matrix E = Σ_s A_s ⊗ Ā_s governs all correlations: its subleading eigenvalues set the correlation length ξ = −1/log|λ₂/λ₁|, connecting MPS algebra directly to physics.

### 2.5 A brief history

The intellectual lineage is remarkably convergent. White's DMRG (1992) [2] grew blocks by keeping eigenstates of the block reduced density matrix — implicitly constructing MPS, though the connection went unrecognized for a decade. Independently, finitely correlated states (Fannes–Nachtergaele–Werner), the AKLT state (1987, exactly an MPS with χ = 2), and the mathematics of tensor trains all converged on the same structure. Östlund and Rommer (1995) made the MPS–DMRG link explicit; Vidal's TEBD (2003) [5] gave MPS real-time evolution via Trotterized gates and SVD truncation; Schollwöck's reviews (2005, 2011) [1] recast the entire DMRG family in MPS language; and Verstraete and Cirac (2004) [4] lifted the ansatz to two dimensions as PEPS.

---

## 3 Methodology

### 3.1 The cost of contraction: ordering is everything

Consider the MPS norm ⟨ψ|ψ⟩: a ladder diagram of 2N tensors. Contracting column-by-column (transfer-matrix order) costs O(Ndχ³); contracting all physical legs first produces an intermediate of dimension χ^2N — exponentially worse. The general principle: **the cost of contracting a network is exponential in the treewidth of its line graph**, and finding the optimal ordering is itself NP-hard [10]. Practical contraction therefore uses heuristics: greedy pair selection, simulated annealing over binary contraction trees, hypergraph partitioning, and *slicing* — fixing a subset of indices to trade exponential memory for embarrassingly parallel summation, the key trick behind large circuit simulations [8].

```python
import numpy as np

# Overlap <psi|psi> via transfer matrices, contracted left-to-right.
# Per-site cost O(d * chi**3); total O(N * d * chi**3).
d, chi, N = 2, 32, 50
rng = np.random.default_rng(0)
tensors = [rng.standard_normal((d, chi, chi)) / np.sqrt(d * chi) for _ in range(N)]

env = np.eye(chi)
for A in tensors:
    env = np.einsum('ab,sac,sbd->cd', env, A, A.conj(), optimize=True)
print("norm =", np.trace(env).real)  # ~1.0 for normalized random MPS

# A bad ordering (contract all physical legs first) would build an
# intermediate of size chi**(2*N) -- exponentially worse, same diagram.
```

### 3.2 The DMRG sweep

DMRG optimizes an MPS variationally by sweeping: at bond (*i*, *i*+1), the two site tensors are merged into Θ, the effective Hamiltonian H_eff (the full H projected into the mixed-canonical basis) is diagonalized by Lanczos/Davidson to update Θ, and an SVD splits Θ back, truncating to χ by discarded weight ε = Σ_{k>χ} λₖ². Two-site DMRG with subspace expansion is the modern default [1]. Cost per sweep: O(Nd³χ³) time; U(1) quantum numbers (particle number, S_z) block-diagonalize tensors and typically buy an order of magnitude. Convergence is monitored via the energy variance ⟨H²⟩ − ⟨H⟩² → 0, a rigorous certificate unavailable to most competing methods.

### 3.3 Contracting two-dimensional networks: the boundary-MPS method

A PEPS expectation value ⟨ψ|O|ψ⟩ is a double-layer 2D network — and exact contraction is #P-complete [6]. The boundary-MPS method [4][7] contracts row by row, approximating the contracted upper rows as an MPS of bond dimension χ_b: each absorbed row multiplies the boundary bond dimension by *D*² (bra and ket layers), followed by SVD compression back to χ_b. The heuristic χ_b ∼ D² usually suffices; the cost per row scales as O(D⁴χ_b² + D²χ_b³). The corner transfer matrix (CTM) variant contracts from four corners toward the center and is the workhorse of iPEPS [9]. Neither scheme is variationally controlled — the compression error is not a rigorous bound — which is the central practical weakness of 2D tensor networks (Section 6).

### 3.4 Tensor networks for quantum circuit simulation

A quantum circuit is a tensor network: initial product state, gates as tensors, amplitude ⟨x|U|0⟩ as a closed contraction. The **Schrödinger–Feynman hybrid** cuts the circuit into subcircuits, contracting each by the cheaper method — a contraction-ordering problem on the circuit's line graph [10]. With slicing, Pednault et al. broke the 49-qubit barrier for random-circuit sampling [8]. **Quantum advantage lives exactly where tensor-network contraction becomes infeasible.**

---

## 4 Deep Dive

### 4.1 Canonical Forms, Gauge Freedom, and the Geometry of the MPS Manifold

The set of MPS with fixed bond dimension χ is not a linear subspace but a smooth manifold — and DMRG is optimization on it. The gauge group acts as ⊕ᵢ GL(χᵢ, ℂ); quotienting yields the physical state manifold. Left-canonical tensors satisfy Σ_s A†s A_s = I, i.e., each tensor is an isometry from the right virtual space into (physical ⊗ left virtual) space. This isometric property makes the norm trivial (⟨ψ|ψ⟩ = 1 by telescoping contractions) and makes the SVD truncation at the orthogonality center *globally* optimal — the mathematical reason the DMRG sweep works.

The transfer matrix E = Σ_s A_s ⊗ Ā_s is a completely positive map whose fixed point gives the thermodynamic limit. Its spectrum encodes all long-distance physics: the gap 1 − |λ₂/λ₁| sets the correlation length, and a degenerate leading eigenspace signals spontaneous symmetry breaking or topological order. Every injective MPS is the unique gapped ground state of a local, frustration-free *parent Hamiltonian* constructed from the null space of few-site reduced density matrices; the AKLT state, with χ = 2, is the canonical example.

### 4.2 DMRG as Variational Optimization over the MPS Manifold

Reformulated by Schollwöck [1], finite-system DMRG is alternating-least-squares on the MPS manifold: each local update solves min_Θ ⟨Θ|H_eff|Θ⟩/⟨Θ|Θ⟩ exactly, and the SVD re-truncation is the optimal projection back onto the manifold in 2-norm. Because the ansatz class is nested, energies decrease monotonically with χ, and extrapolation in the discarded weight ε → 0 yields quasi-exact results: for the spin-1/2 Heisenberg chain at *N* = 100, χ ≈ 400 gives relative energy errors below 10⁻⁸.

> **Theorem (Efficient 1D simulation [3]):** *For gapped local 1D Hamiltonians, an MPS of bond dimension χ = poly(N, 1/ε) approximates the ground state to precision ε, and DMRG-type variational optimization over this manifold runs in poly(N, 1/ε) time.*

Excited states follow by orthogonalization against lower states; dynamical correlators via correction-vector or Chebyshev expansion; finite temperature via purification; real-time evolution via TEBD or the time-dependent variational principle (TDVP). The unifying theme: **every DMRG-family algorithm is a contraction ordering plus an optimal truncation**.

### 4.3 PEPS: The Contraction Bottleneck and Approximate Schemes

A PEPS places a rank-5 tensor (one physical, four virtual legs) on each site of a 2D lattice [4], manifestly obeys the 2D area law, and captures topological order (the toric code has an exact D = 2 PEPS). But:

> **Theorem (Schuch–Wolf–Verstraete–Cirac [6]):** *Exactly contracting a PEPS — e.g., computing its norm — is #P-complete. Consequently, no polynomial-time exact contraction algorithm exists unless P = #P.*

The hardness is intrinsic, not a failure of imagination: it reduces from counting problems on the lattice. Practice therefore relies on controlled approximations:

1. **Boundary MPS** [4][7]: row-by-row contraction with an MPS boundary of dimension χ_b; cost per row O(D⁴χ_b² + D²χ_b³); the standard for finite PEPS.
2. **Corner transfer matrix (CTM)**: Baxter's classical-statistical-mechanics technique adapted to the double-layer network; converges the environment to fixed-point corners and edges; dominant in iPEPS [9].
3. **Tensor renormalization group (TRG) / higher-order TRG**: real-space coarse-graining of the network itself, trading accuracy for O(χ⁶)–O(χ⁷) cost.
4. **Monte Carlo sampling**: for positive-definite contractions, sampling physical configurations with weights from approximately contracted amplitudes.

Variational ground-state search uses *simple update* (local SVD on each bond, O(D⁵), mean-field-like environment) versus *full update* (global environment via boundary MPS/CTM, O(D⁶χ_b³), far more accurate) [9]. The dirty secret: approximate contraction breaks the variational principle, so PEPS energies are not rigorous upper bounds — convergence must be checked in both *D* and χ_b.

### 4.4 Contraction Ordering, Treewidth, and Hyper-Optimized Paths

Markov and Shi [10] established the fundamental complexity-theoretic framing: contracting a tensor network (G, {Tᵥ}) costs exp(O(tw(G*))), where tw is the treewidth of the network's line graph, and this is essentially optimal — contraction is *fixed-parameter tractable* in treewidth. For an *L*×*L* PEPS, tw ∼ L, recovering exponential hardness; for an MPS, tw = O(1), recovering linear time; for a depth-*d* circuit on *N* qubits, tw interpolates between the two, which is why shallow wide circuits are simulable and deep ones are not.

Modern solvers search over binary contraction trees using simulated annealing, greedy cost-estimators, and hypergraph partitioners (the *Cotengra* approach), minimizing a cost model of FLOPs and intermediate memory. *Slicing* — fixing values of selected indices and summing over slices — converts memory bottlenecks into parallel task farms, enabling the 49-qubit simulations of [8]. The lesson generalizes: **in tensor-network computing, the algorithm is the contraction path**.

### 4.5 Entanglement Scaling and the Limits of Bond Dimension

The bond dimension required by physics follows entanglement scaling:

| Regime | Entanglement S | Required χ | Tractability |
|---|---|---|---|
| 1D gapped ground state | O(1) | O(1) | DMRG quasi-exact [1][3] |
| 1D critical | (c/3) log L | poly(L) | DMRG/MERA feasible |
| 2D gapped ground state | O(L) | exp(O(L)) | PEPS with D ∼ 5–10, approximate |
| 2D critical / chiral | O(L) + subleading | exp(O(L)) | Frontier; PEPS struggles |
| Volume law (random states, late-time dynamics) | O(N) | exp(O(N)) | Intractable — quantum advantage |
| Finite-T / open systems (purification/MPO) | O(1)–O(L) | χ² overhead | Feasible at high T |

Two *entanglement barriers* deserve emphasis. First, real-time evolution: S(t) grows linearly after a global quench, so TEBD/TDVP hit an exponential wall at times t ∼ log χ. Second, two dimensions: an *L*×*L* patch needs χ ∼ exp(L) across a cut even for area-law states, so PEPS bond dimension *D* must grow with the correlation length, and critical 2D systems remain the hardest classical target in the field.

---

## 5 Empirical Results and Theoretical Guarantees

**Guarantees.** Three rigorous results form the backbone: (i) Hastings' area law and MPS approximability for 1D gapped systems [3]; (ii) #P-completeness of exact PEPS contraction [6]; (iii) treewidth-parameterized optimality of contraction orderings [10]. Together: 1D gapped physics is provably easy, 2D exact contraction provably hard.

**Benchmarks.** The spin-1/2 Heisenberg chain (*N* = 100) reaches relative energy error < 10⁻⁸ at χ ≈ 400 with discarded weight ε < 10⁻¹⁰ — DMRG's canonical demonstration [1]. For the 2D Heisenberg model, iPEPS with D = 5–7 and boundary dimension χ_b ∼ 100 achieves ∼10⁻³ relative accuracy on ground-state energies [9]. In circuit simulation, tensor-network contraction with slicing simulated 49-qubit random circuits of depth 27 [8], and hyper-optimized paths extended the classical frontier to the regime targeted by early quantum-advantage claims — every "supremacy" experiment must now beat the best contraction ordering, not just the naive Schrödinger bound.

**Scaling summary:**

| Task | Leading cost | Status |
|---|---|---|
| MPS norm / overlap | O(Ndχ³) | Exact, routine |
| ⟨ψ|H|ψ⟩ with MPO bond *w* | O(Ndw²χ³) | Exact, routine |
| Two-site DMRG sweep | O(Nd³χ³) | Quasi-exact in 1D [1] |
| TEBD time step | O(Nd³χ³) | Limited by entanglement growth [5] |
| PEPS exact contraction | exp(O(N)), #P-complete | Intractable [6] |
| PEPS boundary-MPS contraction | O(ND⁴χ_b² + ND²χ_b³) | Approximate workhorse [4][7] |
| iPEPS full update | O(D⁶χ_b³) per step | State of the art [9] |
| Circuit amplitude (treewidth *t*) | exp(O(t)) | Advantage boundary [8][10] |

---

## 6 Limitations

1. **Volume-law entanglement is a hard wall.** Random states, highly excited eigenstates, and late-time post-quench states need χ ∼ exp(N); no ordering trick helps, because the *information content* itself is exponential.
2. **Approximate 2D contraction is uncontrolled.** Boundary-MPS and CTM truncation errors are not rigorous bounds and the variational principle is lost — convergence in both *D* and χ_b must be demonstrated, not assumed.
3. **Critical and chiral 2D systems** remain extremely hard: the PEPS ansatz cannot efficiently represent chiral topological order, and 2D critical points need *D* growing with correlation length.
4. **Long-range interactions** inflate MPO bond dimensions, and **2D DMRG on cylinders** pays χ ∼ exp(circumference), limiting widths to ∼ 10–12 sites for Hubbard physics.

---

## 7 Conclusion

Tensor network contraction turns the exponential Hilbert space into a tractable computational problem wherever entanglement obeys an area law. In one dimension the story is essentially complete: Hastings' area law [3] guarantees that MPS capture gapped ground states, and DMRG [1][2] finds them with quasi-exact precision through a sweep whose every step is an optimally truncated contraction. The same contraction machinery now polices the quantum-classical boundary itself, with every quantum-advantage claim measured against the best classical contraction ordering [8].

The open frontiers are clear: a full proof of the 2D area law, controlled (ideally certified) approximate contraction schemes, and efficient representations of chiral and critical 2D states. Whatever form progress takes, it will be expressed in the same language — *choose the contraction order, bound the bond dimension, and count the cost* — because in tensor-network simulation, the contraction path is the algorithm.

---

## References

[1] U. Schollwöck, "The density-matrix renormalization group in the age of matrix product states," *Ann. Phys.* **326**, 96–192 (2011). https://arxiv.org/abs/1008.3477

[2] S. R. White, "Density matrix formulation for quantum renormalization groups," *Phys. Rev. Lett.* **69**, 2863–2866 (1992). https://doi.org/10.1103/PhysRevLett.69.2863

[3] M. B. Hastings, "An area law for one-dimensional quantum systems," *J. Stat. Mech.* (2007) P08024. https://arxiv.org/abs/0705.2024

[4] F. Verstraete and J. I. Cirac, "Renormalization algorithms for quantum-many body systems in two and higher dimensions," arXiv:cond-mat/0407066 (2004). https://arxiv.org/abs/cond-mat/0407066

[5] G. Vidal, "Efficient classical simulation of slightly entangled quantum computations," *Phys. Rev. Lett.* **91**, 147902 (2003). https://doi.org/10.1103/PhysRevLett.91.147902

[6] N. Schuch, M. M. Wolf, F. Verstraete, and J. I. Cirac, "Simulation of quantum many-body systems with strings of operators and Monte Carlo tensor contractions," *Phys. Rev. Lett.* **100**, 030504 (2008). https://doi.org/10.1103/PhysRevLett.100.030504

[7] R. Orús, "A practical introduction to tensor networks: matrix product states and projected entangled pair states," *Ann. Phys.* **349**, 117–158 (2014). https://arxiv.org/abs/1306.2164

[8] E. Pednault, J. A. Gunnels, G. Nannicini, L. Horesh, T. Magerlein, E. Solomonik, E. W. Draeger, E. T. Holland, and R. Wisnieff, "Breaking the 49-qubit barrier in the simulation of quantum circuits," arXiv:1710.05867 (2017). https://arxiv.org/abs/1710.05867

[9] J. Jordan, R. Orús, G. Vidal, F. Verstraete, and J. I. Cirac, "Classical simulation of infinite-size quantum lattice systems in two spatial dimensions," *Phys. Rev. Lett.* **101**, 250602 (2008). https://doi.org/10.1103/PhysRevLett.101.250602

[10] I. L. Markov and Y. Shi, "Simulating quantum computation by contracting tensor networks," *SIAM J. Comput.* **38**, 963–981 (2008). https://arxiv.org/abs/quant-ph/0511069

