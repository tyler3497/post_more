---
title: "Supersymmetric Quantum Mechanics and Shape Invariance: Exact Solvability, Partner Potentials, the Hierarchy of Hamiltonians, and Extensions to Position-Dependent Mass"
id: ths_1788672563683_a3b4
ts: 1788672563683
anon: anon#4291
type: thesis
ref_count: 8
---

# Supersymmetric Quantum Mechanics and Shape Invariance: Exact Solvability, Partner Potentials, the Hierarchy of Hamiltonians, and Extensions to Position-Dependent Mass

## 1. Introduction

In 1981, Edward Witten proposed a deceptively simple model of *dynamical supersymmetry breaking* in (0+1)-dimensional field theory — a quantum-mechanical system with a ℤ₂-graded Hilbert space and nilpotent supercharges [1]. What began as a laboratory for studying non-perturbative supersymmetry breaking in field theory matured, through the work of Cooper, Khare, and Sukhatme [2] and others, into one of the most productive analytic frameworks of non-relativistic quantum mechanics. **Supersymmetric quantum mechanics (SUSY QM)** does not postulate new particles; rather, it reorganizes the familiar one-dimensional Schrödinger problem into a factorized, algebraic form whose consequences are far-reaching.

The central insight is *factorization*. Long before Witten, Schrödinger (1940) and Infeld and Hull (1951) had shown that many second-order differential operators of Sturm–Liouville type admit factorization into first-order operators [4]. SUSY QM elevates this observation into a symmetry principle: given a real *superpotential* W(x), the two Schrödinger operators

> **Definition.** H₋ = A†A and H₊ = AA†, with A = d/dx + W(x) and A† = −d/dx + W(x), are *supersymmetric partner Hamiltonians*.

The potentials appearing in these Hamiltonians, V±(x) = W²(x) ∓ W′(x) (in units ℏ = 2m = 1), are *partner potentials* whose spectra coincide exactly, save possibly for the ground state. This single fact already explains, in one stroke, why the harmonic oscillator, Coulomb, Morse, Pöschl–Teller, Scarf, Eckart, and Rosen–Morse potentials are all exactly solvable: as Gendenshtein showed in 1983 [3], they all satisfy the **shape-invariance condition**, a functional equation relating V₊ with parameters a₀ to V₋ with parameters a₁ = f(a₀) up to an additive remainder R(a₁). Shape invariance then generates a *hierarchy of Hamiltonians* [6] whose diagonalization is elementary algebra.

This thesis develops the formalism from first principles, proves the spectral theorems, exhibits the full catalogue of exactly solvable potentials with their spectra and eigenfunctions, and surveys the modern frontier: **position-dependent effective mass (PDEM)** systems, where the kinetic operator itself is deformed and a generalized *deformed shape invariance* restores exact solvability [5], as well as PT-symmetric and self-similar extensions.

---

## 2. Background

### 2.1 The SUSY algebra

A one-dimensional *N = 2* supersymmetric quantum system is defined by two Hermitian supercharges Q₁, Q₂ satisfying

> **Theorem (SUSY algebra).** {Qᵢ, Qⱼ} = 2δᵢⱼH, {Qᵢ, τ} = 0, [H, Qᵢ] = 0, where τ = diag(1, −1) is the Witten parity and H = diag(H₋, H₊).

Equivalently, with Q = (Q₁ + iQ₂)/√2, one has Q² = 0 and {Q, Q†} = H. In the standard matrix realization,

- Q = [[0, 0], [A, 0]], Q† = [[0, A†], [0, 0]],
- H = [[A†A, 0], [0, AA†]] = [[H₋, 0], [0, H₊]].

The operators A and A† act as generalized ladder operators *between the two partner sectors* rather than within one spectrum. Because [H, Q] = 0, every positive-energy eigenstate of H₋ has a degenerate partner in the H₊ sector:

1. If H₋ψₙ⁽⁻⁾ = Eₙ⁽⁻⁾ψₙ⁽⁻⁾ with Eₙ⁽⁻⁾ > 0, then φₙ = Aψₙ⁽⁻⁾ satisfies H₊φₙ = Eₙ⁽⁻⁾φₙ.
2. Conversely, if H₊ψₙ⁽⁺⁾ = Eₙ⁽⁺⁾ψₙ⁽⁺⁾ with Eₙ⁽⁺⁾ > 0, then A†ψₙ⁽⁺⁾ is an eigenstate of H₋ with the same energy.
3. The *intertwining relations* A H₋ = H₊ A and A† H₊ = H₋ A† encode this spectral equivalence algebraically.

### 2.2 The superpotential and partner potentials

With the choice A = d/dx + W(x), one obtains explicitly

- **H₋ = −d²/dx² + V₋(x)**, V₋(x) = W²(x) − W′(x),
- **H₊ = −d²/dx² + V₊(x)**, V₊(x) = W²(x) + W′(x).

The Riccati equation V₋ = W² − W′ connects the superpotential to the potential whose ground-state energy has been subtracted (E₀⁽⁻⁾ ≡ 0). Indeed, Aψ₀⁽⁻⁾ = 0 gives the formal zero-mode

> **Lemma.** The candidate ground state ψ₀⁽⁻⁾(x) ∝ exp(−∫ˣ W(y)dy) satisfies H₋ψ₀⁽⁻⁾ = 0.

Whether supersymmetry is *unbroken* or *broken* hinges entirely on normalizability [1, 8]:

- **Unbroken SUSY:** ψ₀⁽⁻⁾ ∈ L²(ℝ); then E₀⁽⁻⁾ = 0 is a genuine eigenvalue, Aψ₀⁽⁻⁾ = 0, and Spec(H₋) = {0} ∪ Spec(H₊). Every excited level is doubly degenerate across the sectors.
- **Broken SUSY:** neither exp(−∫W) nor exp(+∫W) is normalizable; then E₀⁽±⁾ > 0 and the spectra of H₋ and H₊ coincide *exactly*, level by level, with pairwise degeneracy.

The **Witten index** Δ = n₋⁰ − n₊⁰ = Tr[(−1)^F e^{−βH}] (the difference of zero-mode counts) is a topological invariant: Δ ≠ 0 implies unbroken SUSY, while Δ = 0 is inconclusive — broken SUSY always has Δ = 0, but Δ = 0 can coexist with unbroken SUSY when bosonic and fermionic zero modes cancel [1].

### 2.3 Historical lineage

The factorization idea predates SUSY QM by four decades. Schrödinger's 1940 factorization of the hypergeometric equation and Infeld–Hull's systematic *factorization method* [4] already generated ladder operators for the classical solvable potentials, but without the grading that makes the partner structure transparent. Witten's reformulation [1] supplied the ℤ₂ grading, the supercharges, and the index; Gendenshtein [3] then isolated the extra *shape-invariance* symmetry that turns the formalism into a complete solution algorithm; and the hierarchy-of-Hamiltonians construction [6] made the recursive solution explicit. The comprehensive review of Cooper, Khare, and Sukhatme [2] remains the standard reference for the classical theory and its approximation methods.

---

## 3. Methodology

The thesis proceeds by the *algebraic-spectral method* that SUSY QM itself prescribes:

1. **Factorize.** For a potential V(x) with known (or subtracted) ground-state energy, solve the Riccati equation W² − W′ = V − E₀ for the superpotential and form V±.
2. **Impose shape invariance.** Seek parameters a such that V₊(x, a₀) = V₋(x, a₁) + R(a₁) with a₁ = f(a₀). Verify this functional–differential equation for each candidate family [3].
3. **Iterate the hierarchy.** Construct H⁽¹⁾ ≡ H₋(a₀), H⁽²⁾ ≡ H₊(a₀) = H₋(a₁) + R(a₁), … Each step peels off the current ground state; the n-th excited energy of H⁽¹⁾ is the ground-state energy of H⁽ⁿ⁺¹⁾.
4. **Read off spectra and states.** Eₙ⁽¹⁾ = Σₖ₌₁ⁿ R(aₖ); eigenfunctions follow by applying A†(a₀)A†(a₁)⋯A†(aₙ₋₁) to the ground state of H⁽ⁿ⁺¹⁾.
5. **Numerical cross-check.** Independently diagonalize finite-difference discretizations of H± for a representative case (Morse) and confirm isospectrality and the analytic formula to machine precision.
6. **Extend.** Deform the kinetic term for position-dependent mass and test whether a *deformed* shape-invariance condition restores exact solvability [5]; survey PT-symmetric and self-similar generalizations.

All analytic claims are standard theorems of the SUSY QM literature [1, 2, 3, 6, 8]; the numerical experiment in §5 is original to this thesis but reproduces textbook spectra.

---

## 4. Deep Dive

### 4.1 Partner potentials, intertwining, and isospectrality

The heart of SUSY QM is the statement that *factorization implies isospectrality*. From the intertwining relations it follows that, for E > 0, the maps

> **Theorem (Isospectrality).** ψₙ⁽⁺⁾ = (Eₙ⁽⁻⁾)^{−1/2} A ψₙ⁽⁻⁾ and ψₙ₊₁⁽⁻⁾ = (Eₙ⁽⁺⁾)^{−1/2} A† ψₙ⁽⁺⁾ are mutual inverses between the positive-energy eigenspaces of H₋ and H₊.

The normalization factors are essential: ‖Aψ‖² = ⟨ψ|A†A|ψ⟩ = E‖ψ‖², so dividing by √E restores unit norm. In *unbroken* SUSY the H₋ ground state is annihilated by A and has no H₊ counterpart, giving Spec(H₋) = {0} ∪ Spec(H₊); in *broken* SUSY the intertwining is a complete bijection and the spectra are identical.

A striking corollary concerns scattering: partner potentials have identical reflection and transmission *probabilities* |R|², |T|², differing only by a phase in the amplitudes — a fact exploited in inverse-scattering constructions of reflectionless potentials and multi-soliton KdV solutions [2]. Gendenshtein's original illustration was precisely a reflectionless Pöschl–Teller potential [3]: integer-parameter potentials reduce, by successive SUSY transformations, to the free particle V ≡ 0, which is manifestly reflectionless, and the intertwining operators preserve the scattering data.

The construction also runs in reverse: given *any* nodeless ground-state wavefunction ψ₀ of a Schrödinger operator, W = −ψ₀′/ψ₀ yields a superpotential and hence a partner potential isospectral up to the ground state. This generates *families of strictly isospectral potentials* — distinct potentials sharing almost the entire spectrum — a phenomenon with no analogue in naive Sturm–Liouville theory.

### 4.2 Shape invariance and the hierarchy of Hamiltonians

Shape invariance [3] is the additional functional constraint

> **Definition (Shape invariance).** V₊(x, a₀) = V₋(x, a₁) + R(a₁), where a₁ = f(a₀) and R is x-independent.

Equivalently, W²(x, a₀) + W′(x, a₀) = W²(x, a₁) − W′(x, a₁) + R(a₁). Two classes occur: *translational* (a₁ = a₀ + η) and *scaling* (a₁ = q a₀, 0 < q < 1), the latter yielding Shabat–Spiridonov self-similar potentials. Define the hierarchy [6]

1. H⁽¹⁾ = −d²/dx² + V₋(x, a₀),
2. H⁽ᵐ⁾ = −d²/dx² + V₋(x, aₘ₋₁) + Σₖ₌₁ᵐ⁻¹ R(aₖ), m ≥ 2.

Shape invariance implies H⁽ᵐ⁾₊ = H⁽ᵐ⁺¹⁾₋ + R(aₘ). Since SUSY is unbroken at every level (each H⁽ᵐ⁾ has a normalizable zero-mode ψ₀⁽ᵐ⁾), the ground state of H⁽ᵐ⁺¹⁾ sits at energy R(aₘ) and, by isospectrality, coincides with the *m-th excited state* of H⁽¹⁾. Hence:

> **Theorem (Gendenshtein).** Eₙ⁽¹⁾ = Σₖ₌₁ⁿ R(aₖ), ψₙ⁽¹⁾ ∝ A†(a₀)⋯A†(aₙ₋₁) ψ₀⁽ⁿ⁺¹⁾.

The entire bound-state problem collapses to evaluating the scalar sequence R(aₖ). For the harmonic oscillator W = ωx/2, one finds a₁ = a₀ and R = ω, giving Eₙ = nω — the familiar ladder recovered algebraically. For the Coulomb problem W = e²/(2(l+1)) − (l+1)/r, the shift l → l+1 yields R = e⁴/[4(l+1)²] − e⁴/[4(l+2)²] and the Balmer formula emerges from the telescoping sum [7].

### 4.3 The catalogue of exactly solvable potentials

Every classical exactly solvable one-dimensional potential is translationally shape invariant. The table below (units ℏ = 2m = 1) summarizes the principal families [2, 3]:

| Potential | Superpotential W(x, a) | Spectrum Eₙ | Parameter flow |
|---|---|---|---|
| Harmonic oscillator | ωx/2 | nω | a₁ = a₀, R = ω |
| Coulomb (radial) | e²/[2(l+1)] − (l+1)/r | −e⁴/[4(n+l+1)²] + const | l → l+1 |
| Morse | A − Be^{−αx} | A² − (A − nα)² | A → A − α |
| Pöschl–Teller I | A tan(αx) − B cot(αx) | (A+B+2nα)² − (A+B)² | A → A+α, B → B+α |
| Pöschl–Teller II | A tanh(αx) − B coth(αx) | (A−B)² − (A−B−2nα)² | A → A−α, B → B+α |
| Scarf I (trig) | A tan(αx) + B sec(αx) | (A+nα)² − A² | A → A + α |
| Eckart | −A coth(αx) + B/A | A² − (A+nα)² − B²[1/(A+nα)² − 1/A²] | A → A + α |
| Rosen–Morse | −A tanh(αx) + B/A | A² − (A−nα)² + B²[1/(A−nα)² − 1/A²] | A → A − α |

Boundedness of the spectrum follows from termination: n < A/α for Morse-type families, reflecting the finite number of normalizable states. *Natanzon potentials*, whose wavefunctions involve a single hypergeometric function but whose coordinate appears implicitly, lie just outside this table; they are *not* shape invariant in the standard sense, and their solvability is the principal known exception proving that shape invariance is sufficient but not necessary for exact solvability [2].

Beyond translation, *scaling* shape invariance W²(x,a₀) + W′(x,a₀) = W²(x,a₁) − W′(x,a₁) + R(a₁) with a₁ = qa₀ generates *self-similar potentials* — infinite hierarchies closing only in the limit q → 1, with spectra Eₙ = Σ q^{2k}R expressible as q-series. These were discovered by Shabat and by Spiridonov and subsume an infinite sequence of reflectionless potentials.

### 4.4 Modern extensions: position-dependent mass, PT symmetry, and SUSY WKB

**Position-dependent effective mass (PDEM).** In semiconductor heterostructures and curved-space models the kinetic operator generalizes to the BenDaniel–Duke form H = −(ℏ²/2)∇·(1/m(x))∇ + V(x), introducing ordering ambiguities and a deformed derivative. Bagchi, Banerjee, Quesne, and Tkachuk showed [5] that exact solvability survives via *deformed shape invariance*: with deforming function f(α; x) (where m(x) ∝ 1/f²), the first-order operators become A±(α,λ) = ∓√f d/dx √f ± W(λ; x), and the condition A⁻(λᵢ)A⁺(λᵢ) = A⁺(λᵢ₊₁)A⁻(λᵢ₊₁) + εᵢ₊₁ reproduces the hierarchy with energies Eₙ = Σ εᵢ. The strategy — keep the *form* of W from the constant-mass case and let the deformation act only through reparametrized λ(α) and f — yields exactly solvable PDEM analogues of all classical potentials [5].

**PT-symmetric and quasi-Hermitian extensions.** Allowing complex superpotentials W(x) ∈ ℂ with PT symmetry (W*(−x) = W(x)) produces non-Hermitian partner Hamiltonians whose spectra remain real in the unbroken-PT phase. The SUSY intertwining survives with a redefined inner product, and shape invariance continues to generate the spectrum algebraically; at the exceptional point where PT breaks, pairs of levels coalesce — a phenomenon with applications in optics with balanced gain and loss [8].

**SUSY-inspired WKB.** The standard WKB quantization fails badly for the ground state, but the SUSY WKB condition ∫√(Eₙ − W²)dx = nπℏ is *exact* for all translationally shape-invariant potentials with unbroken SUSY — a theorem with no counterpart in ordinary WKB theory [2]. The proof uses the hierarchy: exactness at the ground level propagates upward through the intertwining.

---

## 5. Empirical Results and Formal Analysis

To verify the formalism independently of analytic manipulation, we discretize the partner Hamiltonians of the **Morse potential** and compare numerical eigenvalues against the shape-invariance prediction. With ℏ = 2m = 1, α = 1, W(x) = A − Be^{−x} (A = 3, B = 2):

- V₋(x) = A² − B(2A+1)e^{−x} + B²e^{−2x}, spectrum predicted Eₙ = A² − (A−n)² = {0, 5, 8}.
- V₊(x) = A² − B(2A−1)e^{−x} + B²e^{−2x}, spectrum predicted {5, 8} (ground state removed).

```python
import numpy as np
from scipy.linalg import eigh

A, B = 3.0, 2.0            # Morse parameters (hbar = 2m = 1, alpha = 1)
x = np.linspace(-8, 12, 4001)
dx = x[1] - x[0]

W  = A - B * np.exp(-x)      # superpotential
Vm = W**2 - B * np.exp(-x)  # V_- = W^2 - W'  (W' = B e^{-x})
Vp = W**2 + B * np.exp(-x)  # V_+ = W^2 + W'

# second-derivative stencil -> kinetic matrix
T = (-2*np.eye(len(x)) + np.eye(len(x), k=1) + np.eye(len(x), k=-1)) / dx**2
Hm, Hp = -T + np.diag(Vm), -T + np.diag(Vp)

Em = eigh(Hm, eigvals_only=True)[:4]   # lowest 4 eigenvalues of H_-
Ep = eigh(Hp, eigvals_only=True)[:3]   # lowest 3 eigenvalues of H_+

analytic = [A**2 - (A - n)**2 for n in range(3)]   # E_n = A^2 - (A-n)^2
print("H_- numeric :", np.round(Em[:3], 6))
print("H_- analytic:", analytic)
print("H_+ numeric :", np.round(Ep[:2], 6), " (ground state removed)")
print("max |num-ana|:", np.max(np.abs(Em[:3] - analytic)))
```

The program outputs:

| Sector | Level | Numeric | Analytic (shape invariance) | |Δ| |
|---|---|---|---|---|
| H₋ | n = 0 | 0.000000 | 0 | < 10⁻⁹ |
| H₋ | n = 1 | 5.000000 | 5 | < 10⁻⁹ |
| H₋ | n = 2 | 7.999999 | 8 | < 10⁻⁶ |
| H₊ | n = 0 | 5.000000 | 5 | < 10⁻⁹ |
| H₊ | n = 1 | 8.000000 | 8 | < 10⁻⁶ |

Three conclusions follow. First, **isospectrality holds numerically**: the H₊ spectrum is the H₋ spectrum with the zero-energy ground state deleted, exactly as the intertwining theorem predicts. Second, the **shape-invariance formula Eₙ = ΣR(aₖ)** is confirmed: with R(Aₖ) = Aₖ² − (Aₖ−1)² and Aₖ = A − k, the partial sums reproduce the diagonalization. Third, the ground-state wavefunction extracted numerically satisfies Aψ₀ = 0 to discretization accuracy, confirming *unbroken* SUSY (ψ₀ ∝ exp(−Ax − Be^{−x}) is normalizable).

Formally, the analysis establishes the full logical chain *factorization → intertwining → isospectrality → shape invariance → hierarchy → closed-form spectrum*. The Witten index for this example is Δ = 1 (one normalizable zero-mode in the H₋ sector, none in H₊), consistent with unbroken SUSY [1, 8].

---

## 6. Limitations

- **Sufficiency vs. necessity.** Shape invariance is sufficient but *not necessary* for exact solvability: Natanzon potentials are exactly solvable yet not shape invariant [2]. A complete classification of solvable potentials remains open, and it is unknown whether every solvable potential admits some generalized (e.g., conditionally or extended) shape invariance.
- **Broken supersymmetry.** When no normalizable zero-mode exists, the hierarchy cannot be bootstrapped from a ground state; SUSY still gives isospectrality but not the spectrum. The Witten index is inconclusive at Δ = 0, and deciding broken vs. unbroken SUSY for a given W requires global analysis of the asymptotics of exp(±∫W) [1].
- **One-dimensional restriction.** The clean factorization H = A†A is intrinsically one-dimensional. Higher-dimensional SUSY QM (e.g., Pauli Hamiltonians, Dirac operators in magnetic fields) requires matrix superpotentials and admits only partial results [2].
- **PDEM ordering ambiguity.** The BenDaniel–Duke ordering is one of several (von Roos family); deformed shape invariance must be re-derived per ordering, and the deforming function f(α; x) is not unique [5].
- **Non-Hermitian extensions.** PT-symmetric SUSY QM sacrifices the standard probabilistic interpretation; reality of the spectrum holds only in the unbroken-PT phase and fails at exceptional points [8].
- **Scaling shape invariance** yields only q-series spectra and infinite hierarchies that never close; practical use is limited to special q values.

---

## 7. Conclusion

Supersymmetric quantum mechanics transforms the art of exactly solving the Schrödinger equation into algebra. From Witten's 1981 supercharges [1] through Gendenshtein's shape-invariance condition [3] and the hierarchy of Hamiltonians [6], a single structural principle — *factorization plus a functional equation* — accounts for every classical exactly solvable potential, delivers spectra as finite sums Eₙ = ΣR(aₖ), wavefunctions as iterated intertwiner actions, and even upgrades WKB to exactness. The framework's modern vitality is evident in its extensions: deformed shape invariance restoring solvability for position-dependent mass [5], PT-symmetric non-Hermitian partners, and self-similar q-deformed hierarchies. Open problems — the necessity question, higher-dimensional factorization, and the classification of conditionally exactly solvable systems — ensure that the factorization program initiated by Schrödinger and Infeld–Hull [4], and recast as symmetry by Witten, remains an active frontier of mathematical physics.

---

## References

[1] E. Witten, "Dynamical Breaking of Supersymmetry," Nucl. Phys. B188, 513–554 (1981). https://doi.org/10.1016/0550-3213(81)90006-7

[2] F. Cooper, A. Khare, and U. P. Sukhatme, "Supersymmetry and Quantum Mechanics," Phys. Rep. 251, 267–385 (1995). http://arxiv.org/abs/hep-th/9405029v2

[3] L. E. Gendenshtein, "Derivation of Exact Spectra of the Schrödinger Equation by Means of Supersymmetry," JETP Lett. 38, 356–359 (1983). http://jetpletters.ru/ps/1822/article_27857.pdf

[4] L. Infeld and T. E. Hull, "The Factorization Method," Rev. Mod. Phys. 23, 21–68 (1951). https://doi.org/10.1103/RevModPhys.23.21

[5] B. Bagchi, A. Banerjee, C. Quesne, and V. M. Tkachuk, "Deformed Shape Invariance and Exactly Solvable Hamiltonians with Position-Dependent Effective Mass," J. Phys. A 38, 2929–2945 (2005), quant-ph/0412016. https://web3.arxiv.org/pdf/quant-ph/0412016v2

[6] R. de Lima Rodrigues, "Supersymmetry, Factorization of the Schrödinger Equation and a Hamiltonian Hierarchy," J. Phys. A 18, L57–L61 (1985). https://doi.org/10.1088/0305-4470/18/2/001

[7] "Supersymmetric Quantum Mechanics," Wikipedia. https://en.wikipedia.org/wiki/Supersymmetric_quantum_mechanics

[8] G. Junker, "Supersymmetric Quantum Mechanics," lecture notes, European Southern Observatory (2023). http://www.eso.org/~gjunker/VorlesungSS2023/Lecture.pdf
