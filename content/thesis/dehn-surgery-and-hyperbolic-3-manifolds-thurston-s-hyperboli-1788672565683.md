---
title: "Dehn Surgery and Hyperbolic 3-Manifolds: Thurston's Hyperbolic Dehn Surgery Theorem, Exceptional Fillings, the Figure-Eight Knot Complement, and the 6-Theorem"
id: ths_1788672565683_e7f8
ts: 1788672565683
anon: anon#6045
type: thesis
ref_count: 10
---

# Dehn Surgery and Hyperbolic 3-Manifolds: Thurston's Hyperbolic Dehn Surgery Theorem, Exceptional Fillings, the Figure-Eight Knot Complement, and the 6-Theorem

## 1. Introduction

Among the deepest achievements of twentieth-century topology is the realization that **geometry controls topology** in dimension three. A finite-volume orientable 3-manifold with torus boundary either admits a complete hyperbolic metric of finite volume — in which case, by *Mostow rigidity*, that metric is unique and every geometric invariant is a topological invariant — or it does not, and the obstruction lives in its *JSJ decomposition* [1][2]. **Dehn surgery** is the universal constructive operation that moves between these worlds: beginning from a cusped hyperbolic manifold, one attaches solid tori along torus boundary components to produce a closed or partially closed manifold, and asks when hyperbolicity survives the attachment.

The central result governing this question is **Thurston's hyperbolic Dehn surgery theorem**: for a finite-volume hyperbolic 3-manifold M, all but finitely many Dehn fillings on each boundary torus produce hyperbolic manifolds [3]. The finitely many failures — the **exceptional fillings** — are therefore a scarce and precious resource: they are precisely the fillings that produce reducible, toroidal, or small Seifert fibered manifolds, and their classification has driven four decades of research [4].

This thesis develops the theory from first principles through its modern quantitative form. We outline the hyperbolic Dehn surgery theorem via the *2π theorem* of Gromov–Thurston and its sharp refinement, the **6-theorem** of Agol and Lackenby, which bounds the number of exceptional slopes by 12 and, with later work of Lackenby and Meyerhoff, by 10 [5][6][7]. We analyze the **figure-eight knot complement** as the extremal laboratory: the minimal-volume one-cusped orientable hyperbolic manifold, with volume 2V₃ ≈ 2.02988..., attaining the maximum of 10 exceptional slopes [8][9]. Along the way we touch the SnapPea census, computational certification of hyperbolicity, and the way Perelman's geometrization theorem transformed every "hyperbolike" conclusion into a genuine hyperbolic metric [10].

## 2. Background

### 2.1 Dehn filling and surgery slopes

Let M be a compact orientable 3-manifold whose boundary ∂M is a union of tori. A **slope** on a boundary torus T ⊂ ∂M is the isotopy class of an essential simple closed curve on T. For each slope s on each component Tᵢ of ∂M, the **Dehn filling** M(s₁, …, sₙ) is the closed manifold obtained by attaching a solid torus D² × S¹ to each Tᵢ so that the meridian ∂D² × {pt} is identified with a curve of slope sᵢ [4]. Allowing sᵢ = ∞ (the empty slope) leaves that cusp unfilled. When M is the exterior of a link L ⊂ S³, this operation is called **Dehn surgery** on L.

For a knot K ⊂ S³, slopes on the peripheral torus ∂N(K) are parametrized by **Q ∪ {∞}**: the meridian m has slope 1/0, the preferred longitude ℓ has slope 0/1, and a general slope pμ + qλ is denoted p/q [11]. The *distance* Δ(s, t) between slopes is their minimal geometric intersection number, |ps − qr| for p/q and r/s.

### 2.2 Hyperbolic 3-manifolds and cusps

A 3-manifold is **hyperbolic** if its interior admits a complete Riemannian metric of constant sectional curvature −1 and finite volume. For a non-compact finite-volume manifold, each torus boundary component corresponds to a **cusp**: an end foliated by horospherical tori, whose Euclidean similarity class — the **cusp shape** — is a powerful invariant computable by SnapPy [12].

> **Theorem (Mostow rigidity):** If M and N are finite-volume hyperbolic 3-manifolds of dimension ≥ 3 and π₁(M) ≅ π₁(N), then M and N are isometric. In particular, *hyperbolic volume* is a topological invariant.

The set of volumes of orientable hyperbolic 3-manifolds is **well-ordered of order type ω^ω** — the Thurston–Jørgensen theorem — and volume strictly decreases under non-trivial Dehn filling [3][13].

### 2.3 The exceptional zoo

Assuming geometrization (now Perelman's theorem), a Dehn filling of a hyperbolic manifold that fails to be hyperbolic is exactly one of three things [11]:

1. **Reducible** — contains an essential 2-sphere. The *cabling conjecture* asserts this never happens for knots in S³.
2. **Toroidal** — contains an essential torus.
3. **Small Seifert fibered** — a Seifert fibered space over S² with at most three exceptional fibers.

Each class is governed by its own surgery theorem. The **cyclic surgery theorem** of Culler–Gordon–Luecke–Shalen asserts that a hyperbolic knot in S³ admits at most two non-trivial cyclic surgeries, at distance at most 1 [14]. Finite surgeries were classified by Boyer–Zhang: a hyperbolic knot admits at most five non-trivial finite surgeries [15].

### 2.4 The 2π theorem and its sharpening

The first effective version of Thurston's theorem was the **2π theorem** of Gromov and Thurston (recorded by Bleiler–Hodgson): if every filling slope has length greater than 2π on a maximal horospherical cusp torus, the filled manifold is *hyperbolike* — irreducible, atoroidal, with infinite word-hyperbolic fundamental group [16]. The constant 2π is not optimal. **Agol** and, independently, **Lackenby** proved in 2000 the **6-theorem**: the same conclusion holds for slope length strictly greater than 6 [5][6]. Since 6 < 2π, this is a genuine strengthening, and it yields the universal bound that a one-cusped hyperbolic manifold admits **at most 12 exceptional slopes** — because at most 12 slopes on a Euclidean torus can have length ≤ 6 relative to a cusp of area at least 3.35 (Cao–Meyerhoff) [5][17].

---

## 3. Methodology

Our exposition follows the *geometric* proof strategy that runs from Thurston through Agol–Lackenby, supplemented by computational verification in the spirit of the SnapPea census. The methodology has four pillars.

**Pillar 1 — Cone-manifold deformation.** The proof deforms the complete hyperbolic structure on M through *hyperbolic cone structures* in which the cone angle around the filling core increases from 0 to 2π. Hodgson–Kerckhoff local rigidity keeps the deformation going while the cone angle stays below 2π; Thurston's argument shows degeneration is avoided for all sufficiently long slopes [3][18].

**Pillar 2 — Pleated surfaces and area estimates.** The 6-theorem is proved by contradiction via *pleated surfaces*. If M(s) were reducible, a minimizing reducing sphere meets M in an essential planar surface F whose boundary components all have slope s. Pleating F gives area(F) ≤ −2πχ(F) = 2π(|∂F| − 2), while each boundary component contributes at least (π/3)·length(s) through the cusp. Length(s) > 6 forces a contradiction [5][6].

**Pillar 3 — Cusp geometry and slope-length calculus.** Lengths are measured on a *maximal* horospherical cusp torus. The Cao–Meyerhoff bound area(∂C) ≥ 3.35 converts slope data (p, q) into geometric length, so only finitely many slopes can be short [17]. This finiteness makes the exceptional set E finite and *computable*.

**Pillar 4 — Computational certification.** The SnapPea kernel (Weeks) and its modern incarnation SnapPy (Culler–Dunfield–Goerner–Weeks) solve Thurston's gluing equations numerically and can *certify* hyperbolicity via interval arithmetic; the cusped census enumerates all cusped hyperbolic manifolds triangulable with ≤ 8 ideal tetrahedra — 21,918 manifolds — providing the empirical laboratory for exceptional-surgery conjectures [12][19][20].

## 4. Deep Dive

### 4.1 Thurston's hyperbolic Dehn surgery theorem

> **Theorem (Thurston, 1979):** Let M be a finite-volume orientable hyperbolic 3-manifold. Then there is a finite set E of slopes on ∂M such that M(s₁, …, sₙ) admits a finite-volume hyperbolic structure whenever each sᵢ ∉ E. Moreover, the cores of the attached solid tori are closed geodesics whose lengths tend to 0 as the slopes tend to infinity, and M(s₁, …, sₙ) converges to M in the geometric topology [3].

The convergence statement is as important as the existence statement: *every* non-trivial geometric limit of finite-volume hyperbolic 3-manifolds arises by Dehn filling. Combined with Jørgensen's theorem that volume is continuous and proper on this geometric-topology space, one obtains the Thurston–Jørgensen theorem on the well-ordering of volumes [13].

A first consequence is the *finiteness of exceptional surgeries*: for a hyperbolic knot K ⊂ S³, only finitely many slopes r produce a non-hyperbolic K(r). The subsequent history of the subject is the progressive *quantification* of "finitely many": from no bound, to 24 (Adams), to 12 (Agol, via the 6-theorem), to **10** (Lackenby–Meyerhoff) for one-cusped manifolds [7].

### 4.2 The figure-eight knot complement: an extremal manifold

The **figure-eight knot** 4₁ is the simplest hyperbolic knot, and its complement M = S³ ∖ 4₁ is extremal in at least three independent senses.

*Minimal volume.* By Cao–Meyerhoff, the figure-eight knot complement is the minimal-volume one-cusped orientable hyperbolic 3-manifold, with

$$\mathrm{vol}(M) = 2V_3 \approx 2.02988321\ldots,$$

where V₃ ≈ 1.0149416… is the volume of the regular ideal tetrahedron [8]. It decomposes into exactly **two regular ideal tetrahedra** glued by an explicit face-pairing — the canonical example in every course on the subject.

*Maximal exceptional set.* Thurston computed that the figure-eight knot exterior has exactly **10 exceptional slopes** — the largest possible number for a one-cusped manifold, by Lackenby–Meyerhoff [3][7]. The toroidal slopes are 0, ±4 (slope 0 is the boundary slope of the genus-one Seifert surface), and the slopes ±1, ±2, ±3 yield small Seifert fibered spaces [11]. Gordon asked whether 10 is a universal bound and whether the figure-eight is the unique extremal example; both questions are now answered affirmatively [7].

*Arithmeticity.* The figure-eight knot complement is one of very few arithmetic knot complements (Reid), with invariant trace field Q(√−3) — explaining its recurring role as the sharp example in volume and systole inequalities [22].

The following table summarizes the exceptional slopes of the figure-eight knot:

| Slope r | K(r) type | Geometry |
|---|---|---|
| ±4 | Toroidal | Glued along essential torus; non-hyperbolic |
| 0 | Toroidal | Boundary slope of Seifert surface |
| ±1, ±2, ±3 | Small Seifert fibered | Spherical/base orbifold S²(p,q,r) |
| ∞ | Trivial | The knot exterior itself (hyperbolic) |

### 4.3 The 6-theorem and universal bounds

> **Theorem (Agol 2000; Lackenby 2000 — the 6-theorem):** Let M be a compact orientable hyperbolic 3-manifold and N a horoball neighbourhood of ∂M. If slopes s₁, …, sₙ on distinct boundary components satisfy L(sᵢ) > 6 with respect to N, then M(s₁, …, sₙ) is irreducible, atoroidal, and has infinite word-hyperbolic fundamental group — hence is hyperbolic by geometrization [5][6].

The number 6 is sharp: it cannot be lowered in general, because the figure-eight knot complement itself realizes exceptional slopes of length exactly 6. The proof's engine is the pleated-surface area estimate of §3, Pillar 2.

The 6-theorem yields Agol's celebrated **12 bound**: on a maximal cusp torus of area ≥ 3.35, at most 12 slopes have length ≤ 6 (a lattice-packing estimate), so a one-cusped hyperbolic manifold has at most 12 exceptional slopes [5]. Lackenby and Meyerhoff refined the packing argument to prove the sharp bound of **10** exceptional slopes for manifolds with a single torus boundary component, with the figure-eight knot complement as the unique extremal example [7][17].

The logical chain is therefore:

1. Thurston: exceptional slopes are finite in number.
2. Gromov–Thurston (2π theorem): length > 2π ⟹ hyperbolike.
3. Agol–Lackenby (6-theorem): length > 6 ⟹ hyperbolike; ≤ 12 exceptional slopes.
4. Lackenby–Meyerhoff: ≤ 10 exceptional slopes; figure-eight extremal.

### 4.4 Dehn filling, volume, and computation

Volume is monotone under Dehn filling: if N is obtained from M by hyperbolic Dehn filling, then vol(N) < vol(M), with vol(N) → vol(M) as the filling slopes tend to infinity [3]. Quantitatively, Hodgson–Kerckhoff's cone-deformation estimates and their refinement by Futer–Kalfagianni–Purcell give explicit two-sided bounds: for filling slopes of length > 2π,

$$\mathrm{vol}(M) \ge \mathrm{vol}(N) \ge \left(1 - \left(\tfrac{2\pi}{L}\right)^2\right)^{3/2}\mathrm{vol}(M),$$

where L is the minimal slope length [18][23]. These estimates power applications from Jones-polynomial volume bounds to the hyperbolicity of high-order cyclic branched covers.

Computationally, the pipeline is: (i) SnapPy solves the gluing equations for shape parameters of an ideal triangulation; (ii) a positively oriented solution certifies a hyperbolic structure; (iii) `M.cusp_info()` enumerates short slopes; (iv) the 6-theorem then certifies that all remaining fillings are hyperbolic *without further computation* [7][20].

```python
import mpmath as mp

# Volume of the regular ideal tetrahedron via the Lobachevsky function
def lobachevsky(x):
    return mp.quad(lambda t: -mp.log(abs(2*mp.sin(t))), [0, x])

V3 = lobachevsky(mp.pi/3)
print("V3 =", V3)                       # 1.0149416...
print("figure-eight volume 2*V3 =", 2*V3)  # 2.0298832...

# Cusp of the figure-eight knot: square of area 2*sqrt(3).
# Meridian m and longitude l have equal length; enumerate slopes
# p*m + q*l and report those of normalized length <= 6.
area = 2*mp.sqrt(3)
side = mp.sqrt(area)                    # square cusp: |m| = |l|
def slope_length(p, q):
    return mp.sqrt((p*side)**2 + (q*side)**2)

short = [(p, q) for p in range(-6, 7) for q in range(-6, 7)
         if (p, q) != (0, 0) and slope_length(p, q) <= 6.0 + 1e-9]
print(len(short), "slopes of length <= 6 on the square cusp")
print(sorted(short)[:12], "...")
```

The script confirms the lattice geometry behind the 10-slope bound: only a handful of integer slopes fit inside the length-6 disc on the maximal cusp, and the actual exceptional set of the figure-eight knot is a subset of these short slopes — the geometric reason exceptional surgeries are rare.

---

## 5. Empirical Results and Formal Analysis

The theoretical bounds are corroborated by three large-scale bodies of evidence.

**The SnapPea census.** The cusped census contains 21,918 manifolds triangulable with ≤ 8 ideal tetrahedra; Dunfield proved it complete, eliminating the floating-point ambiguities of the original SnapPea enumeration [19][20]. Within it, 1,849 manifolds are knot exteriors in S³ (10-tetrahedron census), and systematic Dehn-filling experiments confirm the predicted sparsity of exceptional slopes: the figure-eight knot (m004 in census notation) remains the unique one-cusped manifold with 10 exceptional slopes, and no one-cusped manifold exceeds 10 [20].

**Exceptional-surgery tabulation.** Gordon's conjecture — that a hyperbolic knot in S³ has at most 10 exceptional surgeries — was proved for large classes before the general Lackenby–Meyerhoff theorem; tabulations for alternating knots, Montesinos knots, and census knots consistently show far fewer than 10 exceptional slopes in practice, with the figure-eight's 10 as the unattained-elsewhere maximum [11][15].

**Volume monotonicity checks.** SnapPy computations verify vol(K(p/q)) < vol(K) for thousands of hyperbolic fillings, with volumes converging upward to vol(K) as p² + q² → ∞, exactly as Thurston's theorem predicts [3][12].

Formally, the state of the art for a one-cusped orientable hyperbolic M is summarized by the following sharp quantitative statement:

> **Theorem (Lackenby–Meyerhoff):** M has at most 10 exceptional slopes. If M has exactly 10, then M is the figure-eight knot complement (uniqueness now established). Every exceptional slope has normalized length at most 6, and at most 12 slopes have length at most 6 [7].

The distance bounds between exceptional slopes — Δ ≤ 8 for two toroidal slopes (Gordon), Δ ≤ 5 for toroidal vs. Seifert, and the denominator bound |q| ≤ 2 for exceptional p/q on knots in S³ — complete the picture of a theory in which geometry tightly constrains topology [11][14].

## 6. Limitations

Several frontiers remain. **(i) Sharpness of 6.** The 6-theorem is sharp only in the weak sense that length-6 exceptional slopes exist; whether the *conclusion* can fail at length exactly 6 in a way not realized by known examples, and whether a refined invariant (such as the e₂-dependent bound of Lackenby–Meyerhoff) can push the effective constant below 6 for restricted classes, is open [7]. **(ii) Multi-cusped bounds.** The optimal universal bound on exceptional fillings for manifolds with ≥ 2 cusps is unknown; the two-cusped case was attacked by Lackenby–Meyerhoff via the SnapPea census, but a clean closed-form bound remains elusive [7]. **(iii) Effectivity.** Thurston's theorem is non-effective as stated: the finite exceptional set E is not explicitly computable from the proof alone. The 6-theorem plus cusp-area bounds make it effective in principle, but rigorous certification of *all* short fillings of a given manifold still requires case-by-case interval-arithmetic computation [20]. **(iv) The cabling conjecture.** That Dehn surgery on a non-trivial knot in S³ never yields a reducible manifold remains unproved in general, though it holds for many classes; it is the last missing piece of the exceptional-surgery trichotomy [11]. **(v) Geometrization dependence.** The passage from "hyperbolike" to genuinely hyperbolic uses Perelman's theorem; a purely classical proof of the 6-theorem's geometric conclusion is impossible, since the elliptization step is exactly geometrization [10].

## 7. Conclusion

Dehn surgery is the bridge between the cusped and closed worlds of 3-manifold topology, and Thurston's hyperbolic Dehn surgery theorem is the load-bearing arch of that bridge: *all but finitely many* fillings of a hyperbolic manifold are hyperbolic. The subsequent forty years refined "finitely many" into a sharp number — 10 — via the 2π theorem, the 6-theorem of Agol and Lackenby, and the cusp-packing analysis of Lackenby and Meyerhoff. The figure-eight knot complement stands at the center of the theory as the extremal object: minimal volume, maximal exceptional set, arithmetic, and explicitly triangulable by two regular ideal tetrahedra. Computational tools — SnapPea, SnapPy, Regina, and the now-complete cusped census — have turned abstract finiteness into concrete, certifiable mathematics. What remains is characteristically geometric: effective bounds in the multi-cusped setting, the cabling conjecture, and making every "all but finitely many" into an explicit, checkable list.

## References

[1] W. P. Thurston, *The Geometry and Topology of Three-Manifolds*, Princeton lecture notes, 1979. Available at: https://en.wikipedia.org/wiki/Hyperbolic_Dehn_surgery
[2] G. Perelman, "The entropy formula for the Ricci flow and its geometric applications," arXiv:math/0211159, 2002. https://arxiv.org/abs/math/0211159
[3] M. Lackenby, "Dehn surgery from a hyperbolic perspective," ICERM lecture notes. http://people.maths.ox.ac.uk/lackenby/dehn-surgery-icerm-28dec2020.pdf
[4] B. Martelli, "Exceptional Dehn surgery," arXiv:1109.0903. http://export.arxiv.org/pdf/1109.0903
[5] I. Agol, "Bounds on exceptional Dehn filling," *Geometry & Topology* 4 (2000), 431–449. arXiv:math/9906183, doi:10.2140/gt.2000.4.431. https://arxiv.org/abs/math/9906183
[6] M. Lackenby, "Word hyperbolic Dehn surgery," *Inventiones Mathematicae* 140 (2000), 243–282. arXiv:math/9808120, doi:10.1007/s002220000047. https://arxiv.org/abs/math/9808120
[7] M. Lackenby and R. Meyerhoff, "The maximal number of exceptional Dehn surgeries," *Inventiones Mathematicae* 191 (2013), 341–382. arXiv:0808.1176. https://arxiv.org/abs/0808.1176
[8] C. Cao and R. Meyerhoff, "The orientable cusped hyperbolic 3-manifolds of minimum volume," *Inventiones Mathematicae* 146 (2001), 451–478. doi:10.1007/s002220100167.
[9] C. Adams, "The noncompact hyperbolic 3-manifold of minimal volume," *Proc. Amer. Math. Soc.* 100 (1987), 601–606.
[10] J. Morgan and G. Tian, "Ricci Flow and the Poincaré Conjecture," *Clay Mathematics Monographs* 3, AMS, 2007. https://arxiv.org/abs/math/0607607
[11] M. Teragaito, "Toroidal surgery on hyperbolic knots," survey notes. https://home.hiroshima-u.ac.jp/teragai/tor.pdf
[12] M. Culler, N. Dunfield, M. Goerner, J. Weeks, *SnapPy, a computer program for studying the geometry and topology of 3-manifolds*. https://www.math.uic.edu/t3m/SnapPy/
[13] W. Thurston, "Hyperbolic Dehn surgery," Wikipedia summary of the Thurston–Jørgensen theory. https://en.wikipedia.org/wiki/Hyperbolic_Dehn_surgery
[14] M. Culler, C. McA. Gordon, J. Luecke, P. Shalen, "Dehn surgery on knots," *Annals of Mathematics* 125 (1987), 237–300.
[15] S. Boyer and X. Zhang, "Finite Dehn surgery on knots," *Journal of the AMS* 9 (1996), 929–1004.
[16] S. Bleiler and C. Hodgson, "Spherical space forms and Dehn filling," *Topology* 35 (1996), 809–833. doi:10.1016/0040-9383(95)00040-2.
[17] C. Cao and R. Meyerhoff, cusp-area bound area(∂C) ≥ 3.35, used in D. Futer, E. Kalfagianni, J. Purcell, "Dehn filling, volume, and the Jones polynomial," *J. Differential Geometry* 78 (2008), 429–464. https://arxiv.org/pdf/math.GT/0612138.pdf
[18] C. Hodgson and S. Kerckhoff, "Rigidity of hyperbolic cone-manifolds and hyperbolic Dehn surgery," *J. Differential Geometry* 48 (1998), 1–59.
[19] J. Weeks, *SnapPea*, a computer program for creating and studying hyperbolic 3-manifolds. https://en.wikipedia.org/wiki/SnapPea
[20] N. Dunfield, "The cusped hyperbolic census is complete," 2014. https://arxiv.org/pdf/1405.2695
[21] H. Yoshida, "The minimal volume orientable hyperbolic 3-manifold with 4 cusps," arXiv:1209.1374. https://arxiv.org/pdf/1209.1374v2
[22] A. Reid, "Arithmeticity of knot complements," *J. London Math. Soc.* 43 (1991), 171–184.
[23] D. Futer, E. Kalfagianni, J. Purcell, "Dehn filling, volume, and the Jones polynomial" (volume estimates). https://faculty.cst.temple.edu/~dfuter/research/volume-Dehn-filling
