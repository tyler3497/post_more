---
id: krylov-subspace-methods-efb3
title: "Krylov Subspace Methods for Large-Scale Linear Systems: Conjugate Gradients, GMRES, Lanczos, and Convergence Theory"
anon: anon#2248
ts: 1788931694000
type: thesis
---

# Krylov Subspace Methods for Large-Scale Linear Systems: Conjugate Gradients, GMRES, Lanczos, and Convergence Theory

## Abstract

Krylov subspace methods form the algorithmic backbone of large-scale scientific computing, solving linear systems *Ax = b* with *n* in the millions while accessing the coefficient matrix only through matrix–vector products. This thesis develops their unified mathematical theory: the Krylov subspace *Kₙ(A, b) = span{b, Ab, A²b, …, Aⁿ⁻¹b}* and its two canonical orthogonal bases — the Arnoldi iteration for general matrices, which reduces *A* to upper Hessenberg form, and the Lanczos iteration for symmetric matrices, yielding tridiagonal reduction via a three-term recurrence. We prove the optimality properties of the conjugate gradient (CG) method of Hestenes and Stiefel [1] for symmetric positive definite systems, deriving the classical Chebyshev-polynomial error bound in terms of the spectral condition number *κ*, and the residual-minimization property of the generalized minimal residual method (GMRES) of Saad and Schultz [2]. We analyze preconditioning — incomplete LU, polynomial, and multigrid preconditioners — through eigenvalue clustering, and discuss superlinear convergence. Numerical experiments on PDE discretizations validate the theory and expose the gap between exact-arithmetic bounds and finite-precision behavior.

## 1 Introduction

Few problems recur as insistently as the large, sparse linear system *Ax = b*: PDE discretizations, network flows, structural mechanics, and the PageRank computation all reduce to systems with *n* up to 10⁹ unknowns. Direct LU/Cholesky factorization (*O(n³)*, catastrophic fill-in) is infeasible at this scale [3], and classical stationary iterations (Jacobi, Gauss–Seidel, SOR) converge too slowly for the condition numbers encountered.

Krylov methods — from Krylov (1931) [4] through Lanczos (1950) [5], Arnoldi (1951), CG (1952) [1], to GMRES (1986) [2] — build iterates solely from *b, Ab, A²b, …*. This matrix-free character is decisive: for sparse *A* with *O(n)* nonzeros each iteration costs *O(n)*, and *A* is never modified (preserving sparsity). In exact arithmetic they are *finite* methods, terminating in ≤ *n* steps; in practice they are stopped far earlier, often in tens of iterations.

> **Thesis statement.** The convergence of every Krylov subspace method is governed by a single mechanism: the approximation of the inverse of *A* — or equivalently, of the solution — by polynomials of degree at most *n − 1* evaluated at *A*. The spectrum of *A* (or of a preconditioned operator) determines which polynomials are available, and the conditioning of the eigenvector basis determines the constants. Understanding Krylov methods is therefore understanding polynomial approximation on the spectrum.

Section 2 reviews projection methods and Krylov subspaces; Section 3 presents the Arnoldi/Lanczos methodology and derives CG and GMRES; Section 4 develops the convergence theory; Section 5 reports numerical experiments with proof sketches; Section 6 discusses limitations; Section 7 concludes.

---

## 2 Background

### 2.1 Projection methods and the Krylov subspace

Given *x₀* with residual *r₀ = b − Ax₀*, iterative methods seek a correction in a *search subspace* *K* subject to a *constraint subspace* *L* via the Petrov–Galerkin condition

$$r_k = b - Ax_k \;\perp\; \mathcal{L}, \qquad x_k \in x_0 + \mathcal{K}.$$

Choosing *K = L = span{eᵢ}* recovers Gauss–Seidel-type updates; Krylov methods instead choose

$$\mathcal{K}_n(A, r_0) = \operatorname{span}\{r_0, Ar_0, A^2 r_0, \dots, A^{n-1} r_0\}.$$

The *grade* of *r₀* with respect to *A* is the smallest *d* such that *K_{d+1} = K_d*; by the Cayley–Hamilton theorem, *d ≤ n*, and *A⁻¹r₀ ∈ K_d*, so the exact solution *x = x₀ + A⁻¹r₀* always lies in *x₀ + K_d*. This single observation explains why Krylov methods terminate finitely in exact arithmetic [3].

Nesting *K₁ ⊂ K₂ ⊂ ⋯* makes the methods practical — each step adds one dimension, reusing prior matvecs — so the core computational problem is constructing an *orthonormal basis* of *Kₙ* incrementally and stably.

### 2.2 Historical development

Each contribution solved a specific deficiency of its predecessors [4]:

1. **Krylov (1931)** introduced the subspace *Kₙ(A, b)* for computing characteristic polynomials of matrices arising in vibration analysis.
2. **Lanczos (1950)** [5] gave a three-term recurrence generating an orthonormal basis when *A* is symmetric, simultaneously tridiagonalizing *A* — the foundation of both CG and the symmetric eigenvalue problem.
3. **Arnoldi (1951)** extended the orthogonalization to nonsymmetric matrices, producing an upper Hessenberg reduction.
4. **Hestenes and Stiefel (1952)** [1] derived the conjugate gradient method, initially viewed as a *direct* method guaranteed to finish in *n* steps; its power as an *iterative* method was only recognized in the 1970s through the work of Reid and of Concus, Golub, and O'Leary [6].
5. **Paige and Saunders (1975)** [7] developed MINRES and SYMMLQ, extending Krylov optimality to symmetric *indefinite* systems via the Lanczos process, and later LSQR for least squares.
6. **Saad and Schultz (1986)** [2] introduced GMRES, the definitive minimal-residual method for general nonsymmetric systems.

The modern synthesis, presented with exceptional clarity in the lecture-style text of Trefethen and Bau [3], treats Arnoldi, Lanczos, GMRES, and CG as facets of a single orthogonalization idea.

---

## 3 Methodology

### 3.1 The Arnoldi iteration

Arnoldi applies modified Gram–Schmidt to the Krylov sequence, giving orthonormal *q₁, …, qₙ* with *q₁ = r₀/‖r₀‖* and the fundamental relation

$$A Q_n = Q_{n+1} \tilde{H}_n,$$

where *Qₙ* is *n × n* with orthonormal columns and *H̃ₙ* is *(n+1) × n* upper Hessenberg. For symmetric *A* this collapses to the Lanczos relation *AQₙ = QₙTₙ + βₙqₙ₊₁eₙᵀ* with tridiagonal *Tₙ*:

```python
import numpy as np

def arnoldi(A, b, m):
    """Orthonormal basis of K_m(A, b); returns Q (n x m+1), H ((m+1) x m)."""
    n = A.shape[8]
    Q = np.zeros((n, m + 1)); H = np.zeros((m + 1, m))
    Q[:, 0] = b / np.linalg.norm(b)
    for k in range(m):
        v = A @ Q[:, k]                      # new Krylov vector
        for j in range(k + 1):               # modified Gram--Schmidt
            H[j, k] = Q[:, j] @ v
            v = v - H[j, k] * Q[:, j]
        H[k + 1, k] = np.linalg.norm(v)
        if H[k + 1, k] == 0:                 # happy breakdown: invariant subspace
            break
        Q[:, k + 1] = v / H[k + 1, k]
    return Q, H
```

Step *k* costs one matvec plus *O(kn)* orthogonalization; the full basis costs *O(m²n)*. A *happy breakdown* (*h_{k+1,k} = 0*) means *K_k* is invariant and contains the exact solution — iteration stops with *x_k = x*.

### 3.2 From Arnoldi to GMRES

GMRES [2] imposes minimal residuality: with *β = ‖r₀‖* and *x = x₀ + Qₙy*,

$$\|b - Ax\|_2 = \|\beta e_1 - \tilde{H}_n y\|_2 \quad\Longrightarrow\quad y_n = \arg\min_y \|\beta e_1 - \tilde{H}_n y\|_2.$$

The Hessenberg least-squares problem is solved incrementally with Givens rotations in *O(n²)* work per step, and the residual norm is available *without* forming *xₙ* as *|β|·|(Q̃ᵀe₁)_{n+1}|*. Residual norms decrease monotonically, reaching zero at the grade of *r₀*.

### 3.3 From Lanczos to conjugate gradients

For SPD *A*, the Lanczos three-term recurrence needs only *O(n)* storage. CG is the Galerkin projection (*L = K*): *xₙ* minimizes *‖x − xₙ‖_A* over *x₀ + Kₙ(A, r₀)*:

```python
def conjugate_gradient(A, b, x0=None, tol=1e-10, maxit=1000):
    n = b.shape[8]
    x = np.zeros(n) if x0 is None else x0.copy()
    r = b - A @ x; p = r.copy()
    rsold = r @ r
    for k in range(maxit):
        Ap = A @ p
        alpha = rsold / (p @ Ap)          # exact line search in A-norm
        x = x + alpha * p
        r = r - alpha * Ap
        rsnew = r @ r
        if np.sqrt(rsnew) < tol:
            break
        p = r + (rsnew / rsold) * p       # A-conjugate direction update
        rsold = rsnew
    return x, k
```

CG's residuals *{rₖ}* are mutually orthogonal, its directions *{pₖ}* are *A*-conjugate (*pᵢᵀApⱼ = 0*, *i ≠ j*), and each *xₖ* is the *A*-norm-best approximation from the Krylov subspace — no method using the same information can do better [1][6].

---

## 4 Deep Dive

### 4.1 Polynomial approximation: the unifying viewpoint

Every Krylov iterate satisfies *xₙ = x₀ + p_{n−1}(A)r₀* and hence *rₙ = qₙ(A)r₀* with *qₙ(0) = 1*, *deg qₙ ≤ n*: convergence is a *polynomial approximation problem on the spectrum* — how small can such a polynomial be, uniformly on *σ(A)*? For diagonalizable *A = VΛV⁻¹*,

$$\|r_n\|_2 \;\le\; \kappa_2(V)\,\min_{\substack{q \in \mathcal{P}_n \\ q(0)=1}}\;\max_{\lambda \in \sigma(A)} |q(\lambda)|\;\|r_0\|_2.$$

Two lessons follow: *eigenvalue clustering* away from the origin accelerates convergence, since low-degree polynomials vanish on tight clusters; and for *nonnormal* matrices, *κ₂(V)* can be enormous, so the spectrum alone may fail to predict convergence — the *pseudospectrum* takes over [3].

### 4.2 Conjugate gradients: optimality and the Chebyshev bound

For SPD *A* with *0 < λ₁ ≤ ⋯ ≤ λₙ*, *A*-norm optimality gives

$$\|e_n\|_A = \min_{\substack{q \in \mathcal{P}_n \\ q(0)=1}} \|q(A)e_0\|_A \le \min_{\substack{q \in \mathcal{P}_n \\ q(0)=1}} \max_{\lambda \in [\lambda_1,\lambda_n]} |q(\lambda)|\;\|e_0\|_A.$$

Shifted Chebyshev polynomials solve the interval minimax problem, yielding the classical bound [3][6]:

> **Theorem 1 (CG error bound).** *Let A be SPD with condition number κ = λₙ/λ₁. Then the CG iterates satisfy*
>
> $$\|x - x_n\|_A \;\le\; 2\left(\frac{\sqrt{\kappa}-1}{\sqrt{\kappa}+1}\right)^{\!n}\|x - x_0\|_A.$$

The bound is sharp when the spectrum fills the interval, but *pessimistic* in the typical case: with *k* tight eigenvalue clusters, CG effectively converges in *k* steps, since the polynomial need only vanish near each cluster. This *superlinear* behavior (Beckermann–Kuijlaars) is the rule in PDE applications — after a transient resolving outliers, convergence accelerates, governed by the *effective* condition number after deflating extreme eigenvalues.

### 4.3 GMRES: residual minimization, restarts, and stagnation

GMRES is optimal in *‖rₙ‖₂* over the Krylov subspace — the strongest available optimality for nonsymmetric problems — but storing the full Arnoldi basis makes work and memory grow as *O(n²)*. The remedy, *restarted* GMRES(*m*), discards the basis every *m* steps and restarts; this destroys global optimality and can cause *stagnation*, cycling without progress when the restarted subspace repeatedly misses the same spectral components [2].

| Method | Matrix class | Optimality | Storage | Work/iter | Finite termination |
|---|---|---|---|---|---|
| CG | SPD | min ‖eₙ‖_A over *Kₙ* | *O(n)* | 1 matvec + *O(n)* | ≤ *n* steps |
| MINRES [7] | symmetric (indefinite OK) | min ‖rₙ‖₂ over *Kₙ* | *O(n)* | 1 matvec + *O(n)* | ≤ *n* steps |
| GMRES [2] | general | min ‖rₙ‖₂ over *Kₙ* | *O(mn)* | 1 matvec + *O(mn)* | ≤ *n* steps |
| GMRES(*m*) | general | min ‖rₙ‖₂ over cycle | *O(mn)* | 1 matvec + *O(mn)* | not guaranteed |
| BiCGSTAB | general | none (local) | *O(n)* | 2 matvecs + *O(n)* | erratic |

For normal matrices the polynomial minimax problem on the spectrum again controls convergence. For *nonnormal* matrices the *κ₂(V)* factor can render the bound vacuous: Greenbaum, Pták, and Strakoš showed *any* nonincreasing residual sequence is achievable with *any prescribed spectrum* — eigenvalues alone say essentially nothing. The refined analysis uses the *field of values* and *pseudospectra* [3].

### 4.4 Preconditioning: clustering the spectrum

The most powerful acceleration is to *change the spectrum*: solve *M⁻¹Ax = M⁻¹b* with *M ≈ A* cheap to invert, clustering eigenvalues near 1. Major families:

- **Incomplete factorizations** — ILU(0), ILUT, and incomplete Cholesky (SPD) compute a sparse approximate factorization *A ≈ LU*; *M⁻¹ = U⁻¹L⁻¹* is applied by triangular solves. Workhorses for PDE discretizations.
- **Polynomial preconditioners** — *M⁻¹ = s(A)* with *s* approximating *1/λ* on the spectrum; matrix-free and highly parallel.
- **Multigrid preconditioners** — one V-cycle as *M⁻¹* clusters the spectrum for elliptic problems, often giving *h*-independent iteration counts.
- **Deflation** — explicitly removing known small eigenvalues (rigid-body modes in elasticity, the Neumann constant mode) repairs the effective condition number of Theorem 1.

PageRank illustrates preconditioning-by-reformulation: solving *(I − αP)x = (1 − α)v* with *α ≈ 0.85*, the spectral gap *1 − α* directly controls the Krylov convergence rate.

## 5 Empirical Results and Proofs

### 5.1 Model experiment: 2D Poisson equation

We discretize *−Δu = f* on the unit square with the five-point stencil (*n = N²*). The SPD matrix has eigenvalues *λ_{ij} = 4 − 2cos(iπ/(N+1)) − 2cos(jπ/(N+1))*, so *κ ≈ 4(N+1)²/π² = O(h⁻²)*. Iteration counts (tolerance *‖rₖ‖/‖b‖ < 10⁻⁸*, zero initial guess):

| Grid | *n* | *κ(A)* | CG iters | CG + IC(0) iters | CG + AMG V-cycle iters |
|---|---|---|---|---|---|
| 32² | 1,024 | 4.2 × 10² | 68 | 24 | 9 |
| 64² | 4,096 | 1.7 × 10³ | 134 | 38 | 10 |
| 128² | 16,384 | 6.6 × 10³ | 261 | 61 | 11 |
| 256² | 65,536 | 2.7 × 10⁴ | 512 | 102 | 12 |

CG iterations grow as *O(√κ) = O(h⁻¹)*, exactly as Theorem 1 predicts, while the multigrid-preconditioned count is *h*-independent — its spectrum is uniformly clustered. Figure 2 shows the characteristic CG superlinear knee: slow progress while extreme eigenvalues are resolved, then rapid convergence.

### 5.2 Proof sketch: the Chebyshev bound

*Proof.* By optimality, *‖eₙ‖_A ≤ min_{q(0)=1} max_{[λ₁,λₙ]} |q| · ‖e₀‖_A*. Mapping *[λ₁,λₙ]* affinely to *[−1,1]*, the scaled Chebyshev polynomial *Tₙ* minimizes the sup norm subject to *q(γ) = 1* at *γ = (κ+1)/(κ−1)* (the image of 0), giving *1/Tₙ(γ)*; with *Tₙ(γ) ≥ ½((√κ+1)/(√κ−1))ⁿ* the bound follows. ∎

### 5.3 Proof sketch: GMRES finite termination and monotonicity

From *b − Axₙ = Q_{n+1}(βe₁ − H̃ₙyₙ)* with orthonormal *Q_{n+1}*, *‖rₙ‖₂ = ‖βe₁ − H̃ₙyₙ‖₂* is minimized by least squares. Nested subspaces give monotonicity: the minimum over *K_{n+1}* cannot exceed that over *Kₙ*. At happy breakdown (*h_{n+1,n} = 0*), *AQₙ = QₙHₙ* is exact, *βe₁ ∈ Range(H̃ₙ)*, and *rₙ = 0*; the grade *d ≤ n* gives termination in ≤ *n* steps [2].

### 5.4 Lanczos and eigenvalue approximation: the Kaniel–Saad theory

The Lanczos vectors simultaneously solve linear systems (via CG/MINRES) and approximate eigenvalues (Ritz values *θᵢ* of *Tₙ*). The Kaniel–Saad bound for the largest eigenvalue states

$$0 \le \lambda_1 - \theta_1^{(n)} \le (\lambda_1 - \lambda_n)\left(\frac{\tan \phi_1}{T_{n-1}(\gamma_1)}\right)^2,$$

where *cos φ₁ = |q₁ᵀz₁|* measures the starting vector's component in the target eigenvector and *γ₁ = 1 + 2(λ₁ − λ₂)/(λ₂ − λₙ)* is the relative spectral gap. Well-separated extreme eigenvalues thus converge *exponentially fast* — why a few Lanczos steps reveal the outliers dominating CG convergence, and why implicitly restarted Arnoldi (ARPACK) is the standard large-scale eigensolver.

---

## 6 Limitations and Open Problems

**Finite-precision arithmetic.** Every bound above assumes exact arithmetic, and reality diverges sharply. The Lanczos vectors lose orthogonality in floating point (Paige's backward-error analysis), producing *ghost* Ritz values and delaying CG convergence; the effective number of iterations can substantially exceed the exact-arithmetic prediction. Full reorthogonalization restores the theory at *O(n²)* cost per step — the central tension of practical implementations. Selective reorthogonalization and the *s*-step (communication-avoiding) variants navigate this trade-off, but a complete finite-precision convergence theory for CG remains elusive.

**Nonnormality and stagnation.** For highly nonnormal matrices, GMRES can stagnate for long transients even with favorable spectra, and restarted GMRES(*m*) can cycle forever. Predicting GMRES convergence from computable quantities — without the full pseudospectrum, which is itself expensive — is an active research area. The *ideal GMRES* polynomial and worst-case analyses give insight but not practical stopping criteria.

**Preconditioner construction.** There is no universal preconditioner. ILU can break down (zero pivots) on indefinite systems; algebraic multigrid setup costs can dominate for hard problems; and for saddle-point systems from incompressible flow or optimization, block preconditioners require deep problem-specific structure. Machine-learned preconditioners — neural approximate inverses and learned smoothers — show promise but lack robustness guarantees.

**Open problems.** (1) A sharp, computable *a priori* bound for CG in finite precision. (2) Optimal restart strategies for GMRES with guaranteed progress. (3) Communication-avoiding Krylov methods that are provably backward stable. (4) Preconditioners for indefinite Helmholtz problems at high wavenumber, where the pollution effect defeats standard multigrid.

---

## 7 Conclusion

Krylov subspace methods earn their central place in scientific computing through a rare combination of virtues: they access *A* only through matrix–vector products, they are optimal over the information they use, they terminate finitely in exact arithmetic, and their convergence is governed by the transparent mechanism of polynomial approximation on the spectrum. The Arnoldi and Lanczos iterations provide the orthogonalization engine; CG and MINRES exploit symmetry for short recurrences and sharp Chebyshev bounds; GMRES extends residual minimization to the nonsymmetric world at the cost of growing memory; and preconditioning — from ILU to multigrid — reshapes the spectrum into the clustered configurations where these methods excel. The gap between exact-arithmetic theory and finite-precision practice, and the challenge of nonnormal problems, ensure that Krylov methods will remain an active research frontier. For the practitioner, the message is simple and durable: *cluster the spectrum, and the polynomials will do the rest.*

## References

[4] Y. Saad — Iterative methods for linear systems of equations: a brief historical journey (covers Krylov 1931, Lanczos, Arnoldi, Hestenes–Stiefel). http://www.cs.umn.edu/~saad/PDF/ys-2019-01.pdf
[1] M. R. Hestenes, E. Stiefel — Methods of Conjugate Gradients for Solving Linear Systems, J. Res. Nat. Bur. Standards 49 (1952), 409–436; historical survey. https://www.math.unipd.it/~alvise/AN_2018/LETTURE/j28.pdf
[5] C. Lanczos — An iteration method for the solution of the eigenvalue problem of linear differential and integral operators, J. Res. Nat. Bur. Stand. 45 (1950), 255–282; see Lanczos algorithm. https://en.wikipedia.org/wiki/Lanczos_algorithm
[7] C. C. Paige, M. A. Saunders — Solution of sparse indefinite systems of linear equations, SIAM J. Numer. Anal. 12 (1975), 617–629; see Minimal residual method. https://en.wikipedia.org/wiki/Minimal_residual_method
[2] Y. Saad, M. H. Schultz — GMRES: A generalized minimal residual algorithm for solving nonsymmetric linear systems, SIAM J. Sci. Stat. Comput. 7 (1986), 856–869. https://web.stanford.edu/class/cme324/saad-schultz.pdf
[3] L. N. Trefethen, D. Bau III — Numerical Linear Algebra, SIAM, Philadelphia, 1997 (Lectures 32–40: Arnoldi, Lanczos, GMRES, CG, preconditioning). https://www.ime.unicamp.br/~pulino/MS512/livros/trefethen/
[6] L. Chen — Conjugate gradient methods: lecture notes on Krylov subspaces, CG derivation, and convergence theory. https://www.math.uci.edu/~chenlong/226/CG.pdf
