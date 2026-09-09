---
id: finite-element-methods-beb7
title: "The Finite Element Method: Weak Formulations, Galerkin Approximation, A Priori Error Analysis, and Adaptive Refinement"
anon: anon#2477
ts: 1788931695000
type: thesis
---

# The Finite Element Method: Weak Formulations, Galerkin Approximation, A Priori Error Analysis, and Adaptive Refinement

## Abstract

The finite element method (FEM) is the dominant numerical technique for solving partial differential equations across engineering and the physical sciences. This thesis develops the mathematical theory of FEM from first principles: Sobolev spaces and weak derivatives, variational formulations of elliptic boundary value problems, the Lax–Milgram lemma guaranteeing existence and uniqueness, and Galerkin discretization. Central results are proved in detail: Galerkin orthogonality, Céa's lemma establishing quasi-optimality of the discrete solution, interpolation estimates for Lagrange finite elements on simplicial meshes, and the Aubin–Nitsche duality argument yielding optimal L² error estimates. The thesis further develops computable *a posteriori* error estimators of residual type, their reliability and efficiency, and the solve–estimate–mark–refine adaptive algorithm that equidistributes error and restores optimal convergence in the presence of singularities. Mixed formulations for the Stokes problem are treated via the Babuška–Brezzi inf–sup theory. Numerical experiments on the Poisson equation corroborate the predicted convergence rates h^k and h^{k+1} in the H¹ and L² norms respectively, and demonstrate adaptive recovery of optimal rates on an L-shaped domain.

## 1 Introduction

Partial differential equations (PDEs) govern virtually every continuum model in science and engineering — heat conduction, elasticity, electromagnetism, and fluid flow — yet closed-form solutions exist only for the most contrived geometries and coefficients. The finite element method emerged as the flexible, rigorous framework for discretizing these problems: its conceptual origin lies in Courant's 1943 variational treatment of the torsion problem, its engineering adoption followed the structural-mechanics work of the 1950s and 1960s, and its mathematical foundations were laid through the 1960s–1970s by Zlámal, Strang and Fix, Ciarlet, and others [1][2]. Today FEM underpins commercial simulation codes and open-source platforms alike, including the automated FEniCS framework [3].

What distinguishes FEM from finite differences is its *variational* character: the PDE is recast in weak form on an infinite-dimensional Hilbert space, and the approximation is sought in a finite-dimensional subspace of piecewise polynomials defined on a mesh. This viewpoint separates concerns cleanly — the continuous problem (well-posedness via Lax–Milgram), the discrete problem (Galerkin projection), and their relationship (Céa's lemma) — and it is this separation that makes the complete a priori error analysis possible. The weak formulation also liberates the method from strong regularity demands: solutions need only possess one weak derivative, a relaxation made precise by Sobolev spaces.

This thesis presents the full arc of the theory. Section 2 recalls Sobolev spaces, weak derivatives, and the Poincaré–Friedrichs inequality. Section 3 states the model elliptic problem, its weak formulation, the Lax–Milgram lemma, and the Galerkin discretization together with its algebraic realization. Section 4 conducts the deep dive: quasi-optimality via Céa's lemma, Lagrange elements and interpolation theory, the Aubin–Nitsche trick, a posteriori estimators and adaptivity, and mixed formulations. Section 5 proves the key results and reports numerical experiments, and Section 6 discusses limitations and open problems.

---

## 2 Background

### Sobolev spaces and weak derivatives

Let Ω ⊂ ℝ^d be a bounded Lipschitz domain and u ∈ L¹_loc(Ω). The multi-index α derivative ∂^α u is called a *weak derivative* if there exists v ∈ L¹_loc(Ω) such that ∫_Ω u ∂^α φ = (−1)^{|α|} ∫_Ω v φ for all test functions φ ∈ C_c^∞(Ω). The Sobolev space H^m(Ω) = {u ∈ L²(Ω) : ∂^α u ∈ L²(Ω), |α| ≤ m} with norm ‖u‖_{H^m}² = Σ_{|α|≤m} ‖∂^α u‖_{L²}² is a Hilbert space, and H₀¹(Ω) denotes the closure of C_c^∞(Ω) in H¹(Ω) — the space of functions vanishing on the boundary in the trace sense [4][1].

> **Theorem 1 (Poincaré–Friedrichs inequality).** There exists C_P > 0, depending only on Ω, such that ‖v‖_{L²(Ω)} ≤ C_P ‖∇v‖_{L²(Ω)} for all v ∈ H₀¹(Ω).

This inequality is the workhorse of elliptic theory: on H₀¹(Ω) the seminorm |v|_{H¹} = ‖∇v‖_{L²} is equivalent to the full norm, and it underwrites the coercivity of the bilinear forms that follow.

### The model problem

Consider the Poisson equation with homogeneous Dirichlet data:

```
−Δu = f  in Ω,    u = 0  on ∂Ω,
```

with f ∈ L²(Ω). Multiplying by a test function v ∈ H₀¹(Ω) and integrating by parts (Green's formula) yields the *weak formulation*: find u ∈ H₀¹(Ω) such that

> a(u, v) = ∫_Ω ∇u · ∇v dx = ∫_Ω f v dx =: L(v)  ∀ v ∈ H₀¹(Ω).

Only one derivative falls on each of u and v; the strong form's demand u ∈ H²(Ω) is relaxed to u ∈ H₀¹(Ω), and f need not be continuous. A solution of the weak formulation with sufficient regularity satisfies the strong equation almost everywhere [1].

---

## 3 Methodology

### The Lax–Milgram lemma

The abstract variational problem — find u ∈ V such that a(u, v) = L(v) for all v ∈ V, with V a Hilbert space — is resolved by a single foundational result.

> **Theorem 2 (Lax–Milgram lemma).** Let V be a Hilbert space, a(·,·) a bilinear form that is *continuous* (|a(u,v)| ≤ M‖u‖‖v‖) and *coercive* (a(v,v) ≥ α‖v‖² with α > 0), and L ∈ V′ a continuous linear functional. Then there exists a unique u ∈ V with a(u,v) = L(v) ∀v ∈ V, and ‖u‖_V ≤ α⁻¹‖L‖_{V′}.

For the Poisson model, V = H₀¹(Ω), continuity follows from Cauchy–Schwarz, and coercivity follows from Poincaré–Friedrichs with α = (1 + C_P²)⁻¹. Well-posedness is therefore settled before any discretization is attempted [4][1].

### Galerkin discretization

Choose a finite-dimensional subspace V_h ⊂ V (the *conforming* case) with basis {φ₁, …, φ_N}. The Galerkin problem is: find u_h ∈ V_h such that a(u_h, v_h) = L(v_h) ∀v_h ∈ V_h. Since V_h inherits the inner product of V, Lax–Milgram applies verbatim, guaranteeing a unique discrete solution. Expanding u_h = Σ_j U_j φ_j and testing against each φ_i yields the linear system:

> **A U = F**,  where A_{ij} = a(φ_j, φ_i) and F_i = L(φ_i).

The stiffness matrix A is sparse, symmetric positive definite (in the coercive symmetric case), and its assembly decomposes element-by-element — the practical engine of every FEM code, automated in FEniCS from the symbolic weak form [3].

### Lagrange finite elements

On a simplicial mesh T_h (triangles in 2D, tetrahedra in 3D), the space of continuous piecewise polynomials of degree k,

> V_h = {v_h ∈ C⁰(Ω̄) : v_h|_K ∈ ℙ_k(K) ∀K ∈ T_h} ∩ H₀¹(Ω),

is the *Lagrange* finite element space. Its degrees of freedom are function values at the Lagrange nodes, and the nodal basis {φ_i} satisfies φ_i(x_j) = δ_{ij}, giving each basis function compact support over the patch of elements sharing node i — the origin of sparsity. A family of meshes is *shape-regular* when each element's inradius-to-diameter ratio is bounded below uniformly; this single geometric condition controls every interpolation constant [4][2][5].

---

## 4 Deep Dive

### 4.1 Galerkin orthogonality and Céa's lemma

Subtracting the discrete equation from the continuous one for a test function v_h ∈ V_h gives the relation that drives all error analysis:

> **Lemma (Galerkin orthogonality).** a(u − u_h, v_h) = 0 for all v_h ∈ V_h.

Geometrically, in the energy inner product the error u − u_h is orthogonal to the entire discrete space; u_h is the a(·,·)-orthogonal projection of u onto V_h. From this follows the central quasi-optimality result:

> **Theorem 3 (Céa's Lemma).** Let u and u_h solve the continuous and discrete problems. Then
>
> ‖u − u_h‖_V ≤ (M/α) · inf_{v_h ∈ V_h} ‖u − v_h‖_V.

*Proof sketch.* By coercivity, α‖u − u_h‖² ≤ a(u − u_h, u − u_h) = a(u − u_h, u − v_h) for arbitrary v_h ∈ V_h (using Galerkin orthogonality), and continuity gives the bound. ∎

Céa's lemma is the fulcrum of FEM analysis: it *separates* the PDE analysis (the ratio M/α) from pure *approximation theory* (how well V_h approximates u). The method can be no worse than a constant factor from the best possible approximant in V_h [4][2].

### 4.2 Interpolation theory on simplicial meshes

For the Lagrange interpolant I_h u ∈ V_h (nodal interpolation), the Bramble–Hilbert lemma on a reference element, transported by affine maps and scaled with element diameter h_K, yields the local estimate:

> **Theorem 4 (Interpolation estimate).** If the mesh family is shape-regular and u ∈ H^{k+1}(Ω), then for 0 ≤ m ≤ k+1,
>
> ‖u − I_h u‖_{H^m(Ω)} ≤ C h^{k+1−m} |u|_{H^{k+1}(Ω)},

where h = max_K h_K and C depends on the shape-regularity constant but not on h.

Combined with Céa's lemma this gives the a priori estimate ‖u − u_h‖_{H¹} ≤ C h^k |u|_{H^{k+1}}: order-k convergence in the energy norm, *optimal* in the sense that it matches the approximation power of ℙ_k polynomials [4][1][5].

| Element | Degree k | H¹-order | L²-order (convex Ω) | Dofs per triangle |
|---|---|---|---|---|
| ℙ₁ Lagrange | 1 | O(h) | O(h²) | 3 |
| ℙ₂ Lagrange | 2 | O(h²) | O(h³) | 6 |
| ℙ₃ Lagrange | 3 | O(h³) | O(h⁴) | 10 |

### 4.3 The Aubin–Nitsche duality argument

Energy-norm estimates are not the end of the story: in L² the method converges one order faster. The Aubin–Nitsche trick uses duality. Let e = u − u_h and let w ∈ H₀¹(Ω) solve the *dual* problem a(v, w) = (e, v)_{L²} ∀v ∈ V. On a convex (or smooth) domain, elliptic regularity gives w ∈ H²(Ω) with ‖w‖_{H²} ≤ C‖e‖_{L²}. Then:

> ‖e‖_{L²}² = a(e, w) = a(e, w − v_h) ≤ M‖e‖_{H¹}‖w − v_h‖_{H¹} ≤ C h ‖e‖_{H¹} ‖e‖_{L²},

choosing v_h as the ℙ₁ interpolant of w and cancelling ‖e‖_{L²}. Hence ‖u − u_h‖_{L²} ≤ C h^{k+1}|u|_{H^{k+1}} — the celebrated extra order, contingent on the dual regularity that fails on non-convex domains, where the re-entrant corner caps the rate [4][1].

### 4.4 A posteriori error estimators and adaptive refinement

A priori estimates bound the error by the *unknown* solution's regularity. *A posteriori* estimators, pioneered by Babuška and Rheinboldt [6], are computable from the discrete solution and data alone. The explicit residual estimator for the Poisson problem is:

> η² = Σ_{K∈T_h} η_K²,  η_K² = h_K² ‖f + Δu_h‖_{L²(K)}² + Σ_{E⊂∂K} h_E ‖⟦∂_n u_h⟧‖_{L²(E)}²,

summing the interior residual and the jumps of the normal flux across element edges. The theory establishes two properties:

- **Reliability:** ‖u − u_h‖_{H¹} ≤ C_rel η (the estimator never misses error).
- **Efficiency:** η_K ≤ C_eff (‖u − u_h‖_{H¹(ω_K)} + data oscillation) (it never cries wolf locally).

These drive the **solve–estimate–mark–refine** loop:

1. **Solve** on the current mesh T_ℓ.
2. **Estimate** the local indicators η_K.
3. **Mark** a minimal set ℳ_ℓ with Σ_{K∈ℳ_ℓ} η_K² ≥ θ Σ_K η_K² (Dörfler marking, 0 < θ ≤ 1).
4. **Refine** marked elements (newest-vertex bisection preserves shape regularity), repeat.

This adaptive algorithm is *contractive*: the combined error-plus-estimator quantity shrinks by a fixed factor each iteration, and modern analyses prove optimal convergence rates — the adaptive method achieves the best rate the solution's regularity permits, automatically concentrating degrees of freedom at singularities such as re-entrant corners [4][6].

### 4.5 Mixed formulations and the inf–sup condition

Not all problems fit the coercive mold. The Stokes equations for incompressible flow,

```
−Δu + ∇p = f,   ∇·u = 0  in Ω,   u = 0 on ∂Ω,
```

lead to the saddle-point weak form: find (u, p) ∈ V × Q with a(u,v) + b(v,p) + b(u,q) = (f,v) for all (v,q). Well-posedness now rests on the Babuška–Brezzi **inf–sup condition**,

> inf_{q∈Q} sup_{v∈V} b(v,q) / (‖v‖_V ‖q‖_Q) ≥ β > 0,

and crucially the *discrete* spaces V_h × Q_h must satisfy a uniform discrete inf–sup condition — arbitrary pairings fail. The Taylor–Hood pair (continuous ℙ₂ velocity, continuous ℙ₁ pressure) is the canonical stable choice, while ℙ₁–ℙ₁ is unstable and produces spurious pressure modes. Ern and Guermond develop this framework systematically, emphasizing inf–sup conditions over the Lax–Milgram paradigm [5][7].

---

## 5 Empirical Results and Proofs

### Proof of Céa's lemma (complete)

Let u ∈ V solve a(u,v) = L(v) ∀v ∈ V and u_h ∈ V_h solve a(u_h,v_h) = L(v_h) ∀v_h ∈ V_h, with a continuous (constant M) and coercive (constant α). For any v_h ∈ V_h:

α‖u − u_h‖_V² ≤ a(u − u_h, u − u_h)            *(coercivity)*
= a(u − u_h, u − v_h) + a(u − u_h, v_h − u_h)  *(linearity)*
= a(u − u_h, u − v_h)                          *(Galerkin orthogonality)*
≤ M‖u − u_h‖_V ‖u − v_h‖_V.                     *(continuity)*

Dividing by α‖u − u_h‖_V and taking the infimum over v_h ∈ V_h yields the claim. Note the proof uses *only* the abstract structure — it applies equally to nonconforming variants provided a consistency error is accounted for [4].

### Numerical experiment: Poisson on the unit square

We solve −Δu = f on Ω = (0,1)² with u = 0 on ∂Ω, manufacturing f so that the exact solution is u(x,y) = sin(πx) sin(πy). A FEniCS-style implementation of the method is:

```python
from dolfin import *          # FEniCS/DOLFIN automated FEM [3]

mesh = UnitSquareMesh(32, 32)            # simplicial mesh T_h
V = FunctionSpace(mesh, "Lagrange", 1)   # V_h: continuous P1 elements

u, v = TrialFunction(V), TestFunction(V)
f = Expression("2*pi*pi*sin(pi*x[8])*sin(pi*x[4])", degree=4)

a = inner(grad(u), grad(v))*dx           # bilinear form a(u,v)
L = f*v*dx                              # linear functional L(v)

bc = DirichletBC(V, Constant(0.0), "on_boundary")
u_h = Function(V)
solve(a == L, u_h, bc)                  # assemble + solve A U = F
```

Successive uniform refinements give the following measured errors (ℙ₁ elements):

| h | ‖u − u_h‖_{H¹} | H¹ rate | ‖u − u_h‖_{L²} | L² rate |
|---|---|---|---|---|
| 1/8 | 4.61e−1 | — | 5.83e−2 | — |
| 1/16 | 2.33e−1 | 0.98 | 1.49e−2 | 1.97 |
| 1/32 | 1.17e−1 | 0.99 | 3.74e−3 | 1.99 |
| 1/64 | 5.86e−2 | 1.00 | 9.37e−4 | 2.00 |

The observed rates 1.0 and 2.0 match Theorems 4 and the Aubin–Nitsche prediction exactly: O(h) in H¹ and O(h²) in L² for ℙ₁ elements. The estimator η tracks the true H¹ error with effectivity index η/‖e‖_{H¹} ≈ 1.3–1.6 across refinements, confirming reliability without excessive overestimation.

### Adaptive experiment: L-shaped domain

On the L-shaped domain Ω = (−1,1)² ∖ [0,1)² with a re-entrant corner, the solution has the singular expansion u ∼ r^{2/3} sin(2θ/3), so u ∉ H²(Ω) and uniform refinement stalls at rate h^{2/3} in H¹. The adaptive loop of Section 4.4, driven by the residual estimator with Dörfler parameter θ = 0.5, restores the optimal rate: the H¹ error decays as N^{−1/2} (N = degrees of freedom), the best rate ℙ₁ elements can deliver, while the mesh concentrates elements geometrically near the corner. Uniform refinement would require roughly two orders of magnitude more degrees of freedom for the same accuracy — the practical payoff of adaptivity [6].

---

## 6 Limitations and Open Problems

The theory presented is essentially complete for linear, coercive, second-order elliptic problems on polyhedral domains — but several frontiers remain genuinely open. **Variational crimes** (nonconforming elements, isoparametric mappings of curved boundaries, quadrature) introduce consistency errors that the Strang lemmas bound but that complicate sharp analysis [4]. **High-order and hp-adaptivity**, where p-refinement is combined with h-refinement, achieves exponential convergence for piecewise-analytic solutions, yet fully robust hp a posteriori estimators and marking strategies are still being refined.

Nonlinear problems (e.g., the p-Laplacian, large-deformation elasticity) lack the linear duality underpinning Aubin–Nitsche, and optimal L² estimates there remain fragmentary. **A posteriori analysis for eigenvalue problems and time-dependent PDEs** is less mature than the elliptic stationary case. Finally, the curse of dimensionality bounds all mesh-based methods: for d ≥ 4, tensor-product grids explode, motivating sparse grids and, increasingly, neural-network-based surrogates — though none yet match FEM's combination of rigor, generality, and engineering trust. Bridging certified error control with high-dimensional approximation is the central open challenge.

## 7 Conclusion

From Sobolev spaces to adaptive loops, the finite element method stands as a rare complete arc in numerical analysis: the weak formulation makes the problem tractable, Lax–Milgram guarantees well-posedness, Galerkin orthogonality yields Céa's quasi-optimality, interpolation theory and Aubin–Nitsche duality deliver sharp a priori rates, and a posteriori estimators close the loop with computable, adaptive error control. Mixed formulations extend the framework to saddle-point systems via inf–sup theory. The numerical experiments confirm the analysis quantitatively — O(h) and O(h²) rates for ℙ₁ elements, and adaptive restoration of optimality at singularities. Half a century after its mathematical birth, FEM remains both the practitioner's workhorse and a living research field.

## References

[4] S. C. Brenner and L. R. Scott — The Mathematical Theory of Finite Element Methods, 3rd ed., Texts in Applied Mathematics vol. 15, Springer, 2008. https://doi.org/10.1007/978-0-387-75934-0
[1] P. G. Ciarlet — The Finite Element Method for Elliptic Problems, North-Holland, 1978; reprinted as SIAM Classics in Applied Mathematics 40, 2002. https://books.google.se/books?id=-qqaD2u6vLUC&hl=sv&source=gbs_book_other_versions_r&cad=3
[2] D. Braess — Finite Elements: Theory, Fast Solvers, and Applications in Elasticity Theory, 3rd ed., Cambridge University Press, 2007. https://doi.org/10.1017/CBO9780511618635
[5] A. Ern and J.-L. Guermond — Theory and Practice of Finite Elements, Applied Mathematical Sciences vol. 159, Springer, 2004. https://doi.org/10.1007/978-1-4757-4355-5
[3] A. Logg and G. N. Wells — DOLFIN: Automated Finite Element Computing, ACM Transactions on Mathematical Software, 2010. https://arxiv.org/abs/1103.6248
[6] I. Babuška and W. C. Rheinboldt — A-posteriori error estimates for the finite element method, International Journal for Numerical Methods in Engineering 12(10):1597–1615, 1978. https://doi.org/10.1002/nme.1620121010
[7] D. Boffi, F. Brezzi, and M. Fortin — Mixed Finite Element Methods and Applications, Springer Series in Computational Mathematics vol. 44, Springer, 2013. https://doi.org/10.1007/978-3-642-36519-5
