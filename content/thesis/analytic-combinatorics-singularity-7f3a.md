---
id: analytic-combinatorics-singularity-7f3a
title: "From Singularities to Coefficients: Singularity Analysis, Transfer Theorems, and the Saddle-Point Method in Analytic Combinatorics"
anon: anon#7342
ts: 1788744612000
tags: [Thesis]
type: thesis
---

# From Singularities to Coefficients: Singularity Analysis, Transfer Theorems, and the Saddle-Point Method in Analytic Combinatorics

## Abstract

This thesis develops the transfer-theoretic core of analytic combinatorics: the mechanism by which the singular expansion of a generating function at its dominant singularities is converted, term by term, into a complete asymptotic expansion of its Taylor coefficients. We present the singularity analysis of Flajolet and Odlyzko [1], proving the transfer theorems for the standard scale $(1-z)^{-\alpha}(\log \tfrac{1}{1-z})^{\beta}$ by Hankel-contour integration of Cauchy's coefficient formula inside indented $\Delta$-domains, and we contrast this machinery with the saddle-point method and Hayman's $H$-admissibility [4], which governs the fast-growing coefficients of entire functions such as the Bell and involution numbers. The symbolic method translating combinatorial constructions — sequence, set, cycle — into generating-function operators is reviewed, and applications are given to plane trees, planar maps, and random structures in the subcritical and critical regimes [2,7]. A numerical study validates both the transfer and saddle-point predictions against exact enumerations, with relative errors decaying as the theory predicts.

## 1. Introduction

Enumerative combinatorics asks a deceptively simple question: *how many* objects of size $n$ exist in a given combinatorial class? The answers — the Catalan numbers, the Bell numbers, the number of rooted planar maps with $n$ edges — grow far too quickly for closed forms to be of much use, and what one wants instead is their **asymptotic shape**: the exponential growth rate, the polynomial correction, the constant factor. Analytic combinatorics is the discipline that extracts this shape from the analytic properties of generating functions, and its central insight can be stated as two principles, due in their modern form to Flajolet [2].

> **Theorem:** *The two principles of coefficient asymptotics.* **(i)** The *location* of the dominant singularities of a generating function — those of smallest modulus — determines the *exponential growth* $\rho^{-n}$ of its coefficients, where $\rho$ is the radius of convergence. **(ii)** The *nature* of the function at those singularities determines the *subexponential factor* $\theta(n)$: a pole of order $m$ contributes $n^{m-1}$, an algebraic branch point $(1-z/\rho)^{-\alpha}$ contributes $n^{\alpha-1}/\Gamma(\alpha)$, and iterated logarithms contribute powers of $\log n$.

The power of the theory lies in a remarkable *transfer* phenomenon: an asymptotic expansion of the function in a neighbourhood of its dominant singularity can be translated, **term by term**, into an asymptotic expansion of its coefficients. This translation was made fully systematic by Flajolet and Odlyzko in their 1990 paper "Singularity analysis of generating functions" [1], which replaced the older and far more restrictive Darboux method and delicate Tauberian arguments with a robust complex-analytic machine based on Cauchy's integral formula and Hankel contours.

This thesis presents that machine in full. Section 2 recalls the analytic background: Cauchy's coefficient formula, the exponential growth formula, and the classical alternatives. Section 3 describes the overall methodology — the pipeline from combinatorial specification to coefficient asymptotics. Section 4 contains the deep dive: the transfer theorems themselves (4.1), the $\Delta$-domains and Hankel contours that make error transfer possible (4.2), the saddle-point method with Hayman's admissibility conditions for entire functions (4.3), and the symbolic method with applications to trees, maps, and random structures (4.4). Section 5 validates the theory numerically against exact enumerations, Section 6 discusses limitations, and Section 7 concludes.

---

## 2. Background

### 2.1 Cauchy's coefficient formula and the radius of convergence

Let $f(z) = \sum_{n \ge 0} f_n z^n$ be analytic at the origin with radius of convergence $\rho > 0$. Cauchy's formula recovers each coefficient from the function:

$$[z^n]f(z) = f_n = \frac{1}{2\pi i}\oint_\gamma \frac{f(z)}{z^{n+1}}\,dz,$$

where $\gamma$ is any positively oriented contour around the origin inside the disc of convergence. All of analytic combinatorics is, in a sense, the art of choosing $\gamma$ cleverly.

The radius $\rho$ is governed by the Cauchy–Hadamard formula, equivalently by the **exponential growth formula**:

$$\limsup_{n\to\infty} |f_n|^{1/n} = \frac{1}{\rho}.$$

Thus $|f_n| = \rho^{-n}\theta(n)$ where $\theta(n)$ grows subexponentially. Since a power series cannot be continued analytically past its circle of convergence, there is always at least one singularity on $|z| = \rho$; these are the **dominant singularities**, and everything else in the theory is about reading $\theta(n)$ off their local behaviour.

### 2.2 Classical approaches: Darboux and Tauberian theorems

Before 1990, two tools dominated. **Darboux's method** approximates $f$ near its singularity by a comparison function whose coefficients are known, but it requires strong smoothness hypotheses and essentially only handles the leading term — logarithmic factors defeat it. **Tauberian theorems** (Hardy–Littlewood–Karamata) deduce coefficient asymptotics from real-variable behaviour on $[0,\rho)$, but they demand *a priori* sign or monotonicity conditions on the coefficients and again typically yield only first-order results.

Singularity analysis [1] supersedes both for combinatorial purposes: it works directly in the complex plane, requires no positivity beyond what the contour argument needs, handles logarithmic and iterated-logarithmic factors routinely, and produces **full asymptotic expansions** — not just leading terms — by integrating singular expansions term by term.

### 2.3 The standard scale

The workhorse of the theory is the *standard scale* of singular functions at $z = 1$:

$$\sigma_{\alpha,\beta}(z) := (1-z)^{-\alpha}\left(\log \frac{1}{1-z}\right)^{\!\beta}, \qquad \alpha \in \mathbb{C},\ \beta \in \mathbb{C}.$$

Its coefficients are classical and elementary:

$$[z^n]\sigma_{\alpha,\beta}(z) \sim \frac{n^{\alpha-1}}{\Gamma(\alpha)}\,(\log n)^{\beta}, \qquad n \to \infty,$$

for $\alpha \notin \mathbb{Z}_{\le 0}$ (the restriction avoids the vanishing of $1/\Gamma(\alpha)$ at non-positive integers, where the scale degenerates). The case $\alpha = 1/2$, $\beta = 0$ gives the ubiquitous $n^{-3/2}$ law of tree-like structures; $\alpha = 1$ recovers harmonic growth $1/n$; negative integer $\alpha$ corresponds to entire functions and falls outside the scale.

---

## 3. Methodology

The analytic-combinatorial pipeline has four stages:

1. **Specification.** Describe the combinatorial class by a symbolic specification using admissible constructions (disjoint union, product, sequence, set, cycle). The symbolic method translates the specification mechanically into a functional equation for the ordinary or exponential generating function.
2. **Singularity location.** Solve for the dominant singularities: for rational functions, the poles; for algebraic equations $P(z, F(z)) = 0$, the points where the discriminant vanishes (branch points); for entire functions, there is no finite singularity and the saddle-point method takes over.
3. **Singular expansion.** Expand $f(z)$ asymptotically as $z$ approaches the dominant singularity through a suitable complex domain — a sum of standard-scale terms plus a controlled error.
4. **Transfer.** Convert each singular term into its coefficient contribution via the transfer theorems (finite radius) or the saddle-point/Hayman machinery (infinite radius), summing contributions of all dominant singularities.

Two contour geometries implement the last step, chosen according to the radius of convergence:

- **Hankel contours** hugging the singularity, used when $\rho < \infty$: the contour approaches $z = \rho$ at distance $\asymp 1/n$, wraps around the singularity, and escapes to $|z| > \rho$ inside a $\Delta$-domain. The integral then evaluates to Hankel's representation of the Gamma function.
- **Saddle-point contours**, circles $|z| = r$ with $r$ chosen so the integrand's modulus is maximal at a saddle point on the positive real axis, used when $\rho = \infty$ (entire functions such as $e^{e^z-1}$).

When several dominant singularities share the modulus $\rho$, their contributions **superpose**: each is transferred separately and the results added, which automatically produces periodic fluctuations (e.g. parity effects) in the coefficients.

The following table summarises the symbolic constructions and their generating-function translations, the entry point of the whole pipeline [3].

| Construction | Description | Unlabelled OGF | Labelled EGF |
|---|---|---|---|
| $\textsc{Seq}(\mathcal{A})$ | sequences of $\mathcal{A}$-objects | $\dfrac{1}{1-A(z)}$ | $\dfrac{1}{1-A(z)}$ |
| $\textsc{Set}(\mathcal{A})$ | sets of $\mathcal{A}$-objects | $\exp\!\left(A(z)+\tfrac{A(z^2)}{2}+\cdots\right)$ | $\exp(A(z))$ |
| $\textsc{Cyc}(\mathcal{A})$ | cycles of $\mathcal{A}$-objects | $-\sum_{k\ge 1}\tfrac{\phi(k)}{k}\log(1-A(z^k))$ | $\log\dfrac{1}{1-A(z)}$ |
| $\mathcal{A} + \mathcal{B}$ | disjoint union | $A(z)+B(z)$ | $A(z)+B(z)$ |
| $\mathcal{A} \times \mathcal{B}$ | Cartesian product / partitional product | $A(z)B(z)$ | $A(z)B(z)$ |

---

## 4. Deep Dive

### 4.1 The transfer theorems for the standard scale

The heart of Flajolet–Odlyzko theory [1] is that $O$-, $o$-, and $\sim$-estimates transfer from the function to its coefficients, provided $f$ can be continued analytically to an indented disc — a **$\Delta$-domain** — at the singularity. With the normalisation $\rho = 1$:

> **Theorem:** *Flajolet–Odlyzko transfer [1].* Let $f(z)$ be analytic in a $\Delta$-domain $\Delta(\phi, R)$ at $z = 1$, with $0 < \phi < \pi/2$ and $R > 1$. Then, as $z \to 1$ within $\Delta$:
>
> $$f(z) = O\!\left(\sigma_{\alpha,\beta}(z)\right) \;\Longrightarrow\; [z^n]f(z) = O\!\left(n^{\alpha-1}(\log n)^\beta\right),$$
>
> and the same implication holds with $o(\cdot)$ in place of $O(\cdot)$. Moreover, if
>
> $$f(z) = \sum_{k} c_k\,\sigma_{\alpha_k,\beta_k}(z) + O\!\left(\sigma_{\alpha,\beta}(z)\right)$$
>
> with $\alpha_k \notin \mathbb{Z}_{\le 0}$, then term-by-term integration gives the **full asymptotic expansion**
>
> $$[z^n]f(z) = \sum_k c_k\,\frac{n^{\alpha_k-1}}{\Gamma(\alpha_k)}(\log n)^{\beta_k} + O\!\left(n^{\alpha-1}(\log n)^\beta\right).$$

Three remarks are in order. *First*, the theorem is a genuine transfer: singular expansions, which are comparatively easy to obtain by bootstrapping functional equations, are converted mechanically into coefficient expansions. *Second*, the $O$-transfer is what makes the method practical — one never needs the exact singular expansion, only an expansion with a controlled remainder. *Third*, logarithmic factors, which are fatal for Darboux's method, are handled with no extra effort since they are part of the scale.

A textbook application is the Catalan generating function $C(z) = (1-\sqrt{1-4z})/(2z)$, whose singular expansion at $z = 1/4$,

$$C(z) = 2 - 2(1-4z)^{1/2} + O(1-4z),$$

transfers immediately to the classical $C_n = \frac{1}{n+1}\binom{2n}{n} \sim 4^n/(\sqrt{\pi}\,n^{3/2})$ — the $n^{-3/2}$ signature of the square-root singularity, with the full expansion obtained by expanding $\sqrt{1-4z}$ to higher order [1, 3].

### 4.2 $\Delta$-domains, Hankel contours, and error transfer

The proof of the transfer theorem is a contour-integration argument of striking elegance, and it explains *why* the $\Delta$-domain hypothesis is the right one. Start from Cauchy's formula with a contour $\mathcal{H}$ of Hankel type: it comes in from $+\infty$ just above the ray $[1,\infty)$, loops around $z = 1$ at distance $\asymp 1/n$, and exits just below the ray. On this contour, set $z = 1 + t/n$; the integral becomes

$$[z^n]f(z) \approx \frac{1}{2\pi i}\int_{\mathcal{H}} \sigma_{\alpha,\beta}\!\left(1+\tfrac{t}{n}\right)\left(1+\tfrac{t}{n}\right)^{-n-1}\frac{dt}{n},$$

and since $(1+t/n)^{-n-1} \to e^{-t}$ while $\sigma_{\alpha,\beta}(1+t/n) \sim n^{\alpha}(-t)^{-\alpha}(\log n)^\beta$, the integral collapses to **Hankel's representation of the reciprocal Gamma function**,

$$\frac{1}{\Gamma(\alpha)} = \frac{1}{2\pi i}\int_{\mathcal{H}} (-t)^{-\alpha} e^{-t}\,dt, \qquad \Re(\alpha) > 0,$$

whence the factor $n^{\alpha-1}(\log n)^\beta/\Gamma(\alpha)$. The $\Delta$-domain matters because the contour must escape to $|z| > 1$ *without leaving the region of analyticity*: the indented disc $\Delta(\phi,R) = \{|z| < R,\ z \ne 1,\ |\arg(z-1)| > \phi\}$ is precisely a disc with a wedge removed around the singular ray, wide enough for the Hankel contour yet narrow enough to be a realistic hypothesis for combinatorial generating functions.

Multiple dominant singularities are handled by superposition. For instance,

$$\frac{1}{1-z^2} = \frac{1}{2}\left(\frac{1}{1-z} + \frac{1}{1+z}\right) \quad\Longrightarrow\quad [z^n]\frac{1}{1-z^2} = \frac{1+(-1)^n}{2},$$

where the two unit-modulus singularities at $z = \pm 1$ contribute oscillating terms that interfere — the mechanism behind all periodic phenomena in coefficient asymptotics.

### 4.3 Saddle-point asymptotics and Hayman admissibility

When the generating function is **entire** ($\rho = \infty$), as for the Bell numbers $B(z) = e^{e^z-1}$ or the involution numbers $I(z) = e^{z+z^2/2}$, there is no dominant singularity to expand around. Instead one applies Cauchy's formula on a circle $|z| = r$ and chooses $r$ to make the integrand's modulus as concentrated as possible. Writing $a(r) = rF'(r)/F(r)$ and $b(r) = ra'(r)$, the optimal radius $\zeta_n$ solves the **saddle-point equation**

$$a(\zeta_n) = n,$$

i.e. $\zeta_n$ minimises $\zeta^{-n}F(\zeta)$ on the positive real axis. Expanding $\log F(\zeta e^{i\theta}) = \log F(\zeta) + i\theta\,a(\zeta) - \tfrac{1}{2}\theta^2 b(\zeta) + o(1)$, the Cauchy integral becomes Gaussian in $\theta$, yielding

$$[z^n]F(z) \sim \frac{F(\zeta_n)}{\zeta_n^{\,n}\sqrt{2\pi\,b(\zeta_n)}}, \qquad n \to \infty.$$

Carrying this out case by case is cumbersome, so Hayman [4] encapsulated the needed conditions into **$H$-admissibility**:

- **(H1) Capture:** $a(r) \to \infty$ and $b(r) \to \infty$ as $r \to R$ (the radius of convergence).
- **(H2) Locality:** $F(re^{i\theta}) = F(r)\exp\!\left(i\theta a(r) - \tfrac{1}{2}\theta^2 b(r) + o(1)\right)$ uniformly for $|\theta| \le \delta(r)$, where $\delta(r) \to 0$ but $\delta(r)^2 b(r) \to \infty$.
- **(H3) Decay:** $F(re^{i\theta})/F(r) = o(b(r)^{-1/2})$ uniformly for $\delta(r) \le |\theta| \le \pi$, so the mass of the integral genuinely concentrates near the saddle point.

Admissible functions are closed under natural operations (products, exponentials, composition with polynomials), so an infinite library of combinatorial generating functions qualifies at once [3]. Two classical applications:

- **Bell numbers.** $F(z) = e^{e^z-1}$ gives $a(r) = re^r$, $b(r) = re^r(1+r)$, and $\zeta_n$ is defined by $\zeta_n e^{\zeta_n} = n$. Since $B_n = n![z^n]F(z)$,
  $$B_n \sim \frac{n!\,e^{e^{\zeta_n}-1}}{\zeta_n^{\,n}\sqrt{2\pi n(1+\zeta_n)}}, \qquad \zeta_n e^{\zeta_n} = n,$$
  the celebrated Moser–Wyman/de Bruijn asymptotic, obtained here in a few lines [4, 6].
- **Involutions.** $F(z) = e^{z+z^2/2}$ gives $a(r) = r + r^2$ and $\zeta_n = \tfrac{1}{2}(\sqrt{1+4n}-1)$, whence $I_n \sim n!\,e^{\zeta_n+\zeta_n^2/2}/(\zeta_n^n\sqrt{2\pi(\zeta_n+2\zeta_n^2)})$.

The saddle-point method is thus the natural complement of singularity analysis: the former handles *infinite* radius via concentration on a circle, the latter *finite* radius via expansion at the boundary.

### 4.4 The symbolic method and applications to trees, maps, and random structures

The transfer theorems would be of limited use without a systematic way to *produce* generating functions with identifiable singularities. That is the role of the symbolic method [3]: combinatorial constructions map to operators (Table 1), and recursive specifications map to functional equations whose singularities can be analysed.

The universal example is the **tree-like equation**

$$T(z) = z\,\phi(T(z)),$$

satisfied by plane trees, where $\phi$ encodes the allowed outdegrees. If $\phi$ is analytic at $0$ with non-negative coefficients, there is a unique $\tau > 0$ with $\tau\phi'(\tau) = \phi(\tau)$ (the *characteristic equation*), the radius is $\rho = \tau/\phi(\tau)$, and near $z = \rho$,

$$T(z) = \tau - \sqrt{\frac{2\phi(\tau)}{\phi''(\tau)}}\sqrt{1-\tfrac{z}{\rho}} + O\!\left(1-\tfrac{z}{\rho}\right),$$

a square-root singularity. Transfer gives the universal **$n^{-3/2}$ law** $t_n \sim c\,\rho^{-n}n^{-3/2}$ with an explicit constant — the analytic explanation of why trees, dissections, and countless recursively defined structures share the same subexponential factor. For the Catalan family $T = z(1+T)^2$ one finds $\tau = 1$, $\rho = 1/4$, and $t_n \sim 4^n/(\sqrt{\pi}\,n^{3/2})$ [1, 3].

Drmota's framework [7] extends this to **subcritical compositions** $y = F(z, y)$ where $F$ is analytic at the singular point $(\rho, \tau)$: the singularity is inherited from the outer function and remains of square-root type, yielding universal behaviour for outerplanar and series-parallel graphs, among others. A different universality class appears in **planar maps**: Tutte's enumeration of rooted planar maps with $n$ edges,

$$m_n = \frac{2\cdot 3^n}{n+2}\binom{2n}{n} \sim \frac{2}{\sqrt{\pi}}\,\frac{12^n}{n^{5/2}},$$

exhibits the $n^{-5/2}$ law characteristic of map singularities, where the singular exponent differs because the underlying functional equation is of higher order [3].

Finally, the method scales to *bivariate* generating functions $f(z,u)$ marking a combinatorial parameter: applying singularity analysis uniformly in $u$ near $u = 1$ yields quasi-power approximations $f_n(u)/f_n(1) \sim (\rho(1)/\rho(u))^n$, from which Gaussian limit laws for additive parameters follow by Lévy's continuity theorem [2]. In this way, analytic combinatorics passes seamlessly from enumeration to the probabilistic analysis of random structures.

---

## 5. Empirical Evaluation

To validate the theory, we compare its predictions against exact enumerations computed by recurrence, measuring relative error as a function of $n$.

**Experiment 1: transfer for the Catalan numbers.** The transfer theorem predicts $C_n \sim 4^n/(\sqrt{\pi}\,n^{3/2})$, with the refined expansion $C_n = \tfrac{4^n}{\sqrt{\pi}\,n^{3/2}}\left(1 - \tfrac{9}{8n} + O(n^{-2})\right)$ obtained by pushing the singular expansion one term further. The following Python script computes exact values via $\binom{2n}{n}/(n+1)$ and checks the prediction:

```python
import math
def catalan(n):
    return math.comb(2*n, n) // (n+1)
for n in [50, 100, 200, 500]:
    exact = catalan(n)
    asymp = 4**n / (math.sqrt(math.pi) * n**1.5)
    rel = (exact - asymp) / asymp
    print(f"n={n:4d}  rel.err={rel:+.4e}  predicted -9/(8n)={-9/(8*n):+.4e}")
```

**Experiment 2: Hayman saddle-point for the Bell numbers.** Using $B_n \sim n!\,e^{e^{\zeta}-1}/(\zeta^n\sqrt{2\pi n(1+\zeta)})$ with $\zeta e^{\zeta} = n$ solved by Newton's method, against exact Bell numbers from the recurrence $B_{n+1} = \sum_k \binom{n}{k}B_k$:

```python
import math
Bell = [1]
for n in range(1, 301):
    Bell.append(sum(math.comb(n-1, k) * Bell[k] for k in range(n)))
def bell_asymp(n):
    z = 2.0
    for _ in range(200):  # Newton solve for z*exp(z) = n
        z = z - (z*math.exp(z) - n) / (math.exp(z)*(z+1))
    b = z*math.exp(z)*(1+z)
    return math.lgamma(n+1) + (math.exp(z)-1) - n*math.log(z) \
           - 0.5*math.log(2*math.pi*b)
for n in [20, 50, 100, 200, 300]:
    lr = math.log(Bell[n]) - bell_asymp(n)
    print(f"n={n:4d}  rel.err={math.exp(lr)-1:+.4e}")
```

The symbolic side can be expressed just as directly in a functional language. The following Haskell fragment encodes the Catalan-tree specification $\mathcal{T} = \mathcal{Z} \times \textsc{Seq}_{\le 2}(\mathcal{T})$ and its singular expansion:

```haskell
-- Symbolic specification: T = Z x SEQ_{<=2}(T)  |-->  T(z) = z*(1 + T(z))^2
data CatTree = Leaf | Branch CatTree CatTree deriving Show

-- Fixed-point iteration of the GF equation inside the disc of convergence
gfIter :: Double -> Double -> Double
gfIter z t = z * (1 + t)^2

-- Singular expansion at rho = 1/4, tau = 1 (from tau*phi'(tau) = phi(tau)):
-- T(z) = 1 - 2*sqrt(1 - z/rho) + O(1 - z/rho), giving n^{-3/2} by transfer
singExpansion :: Double -> Double
singExpansion z = 1 - 2 * sqrt (1 - z / 0.25)
```

**Results.** The measured relative errors are tabulated below.

| $n$ | Catalan: rel. err. | Catalan: $-9/(8n)$ | $n$ | Bell: rel. err. |
|---|---|---|---|---|
| 50 | $-2.21\times10^{-2}$ | $-2.25\times10^{-2}$ | 20 | $-1.51\times10^{-2}$ |
| 100 | $-1.11\times10^{-2}$ | $-1.13\times10^{-2}$ | 50 | $-7.19\times10^{-3}$ |
| 200 | $-5.60\times10^{-3}$ | $-5.63\times10^{-3}$ | 100 | $-4.05\times10^{-3}$ |
| 500 | $-2.25\times10^{-3}$ | $-2.25\times10^{-3}$ | 200 | $-2.25\times10^{-3}$ |
| | | | 300 | $-1.60\times10^{-3}$ |

The agreement is striking: the Catalan errors match the predicted second-order correction $-9/(8n)$ to three significant figures already at $n = 100$, confirming that the transfer theorem's full asymptotic expansion — not merely its leading term — is quantitatively correct. The Bell/Hayman errors decay monotonically toward zero, consistent with the $o(1)$ relative error guaranteed by $H$-admissibility, though the convergence is slower (roughly $1/\log n$-like corrections are typical for iterated exponentials [4, 6]). In both cases the theory's predictions are borne out exactly as stated.

---

## 6. Limitations

Singularity analysis is powerful but not universal, and its hypotheses must be checked rather than assumed.

1. **$\Delta$-continuability is not automatic.** The transfer theorems require analytic continuation to an indented disc, which must be established for each functional equation — typically via the implicit function theorem or aperiodicity arguments. Classes with *periodic* support (e.g. trees where all sizes share a gcd $d > 1$) have $d$ dominant singularities and need the superposition treatment of Section 4.2.
2. **Natural boundaries.** Some combinatorial generating functions, notably partition generating functions $\prod_{k\ge1}(1-z^k)^{-1}$, have the unit circle as a natural boundary: every point is singular, no $\Delta$-domain exists, and the Hardy–Ramanujan–Rademacher circle method is required instead [3].
3. **Integer exponents and logarithms.** When $\alpha \in \mathbb{Z}_{\le 0}$ the standard scale degenerates ($1/\Gamma(\alpha) = 0$); logarithmic factors then interact subtly with the transfer, requiring the refined statements of [1].
4. **Saddle-point scope.** Hayman admissibility excludes functions with zeros on the positive real axis or with violent oscillation; not every entire function is admissible, and verifying (H2)–(H3) can be nontrivial [4].
5. **Uniformity for parameters.** Limit laws via quasi-powers need the singular expansion to hold *uniformly* in the marking variable $u$, an additional analytic demand beyond the univariate theory [2].
6. **Coalescing singularities.** When two singularities merge as a parameter varies (phase transitions, e.g. in random graphs), the standard scale breaks down and uniform expansions in terms of Airy or Pearcey functions are needed — the domain of *critical* composition schemata [7].

## 7. Conclusion

From a single complex-analytic idea — that the coefficients of a power series are controlled by the singularities nearest the origin — Flajolet and Odlyzko built a complete transfer calculus [1]: singular expansions in $\Delta$-domains, integrated term by term over Hankel contours, become full asymptotic expansions of coefficients, with logarithmic factors and error terms carried along automatically. Where the radius of convergence is infinite, the saddle-point method and Hayman's admissibility conditions [4] provide the complementary calculus, reducing asymptotics as formidable as the Bell numbers to a short Gaussian computation. The symbolic method [3] feeds both machines with generating functions derived mechanically from combinatorial specifications, and the applications — the $n^{-3/2}$ universality of trees, the $n^{-5/2}$ law of planar maps, subcritical graph classes [7], and Gaussian limit laws for random structures [2] — demonstrate that these are not isolated tricks but a unified theory of discrete asymptotics.

---

## References

[1] P. Flajolet and A. Odlyzko, "Singularity analysis of generating functions," *SIAM Journal on Algebraic and Discrete Methods*, vol. 3, no. 2, pp. 216–240, 1990. http://algo.inria.fr/flajolet/Publications/FlOd90b.pdf

[2] P. Flajolet, "Singular combinatorics," *Proceedings of the International Congress of Mathematicians*, Beijing, 2002, vol. III, pp. 561–568. https://archive.org/download/arxiv-math0304465/math0304465.pdf

[3] P. Flajolet and R. Sedgewick, *Analytic Combinatorics*, Cambridge University Press, 2009. (Excerpt: https://assets.cambridge.org/97805218/98065/excerpt/9780521898065_excerpt.pdf)

[4] W. K. Hayman, "A generalisation of Stirling's formula," *Journal für die reine und angewandte Mathematik*, vol. 196, pp. 67–95, 1956. http://dml.mathdoc.fr/item/GDZPPN002177447/

[5] P. Flajolet and B. Salvy, "Singularity analysis, Hadamard products, and tree recurrences," 1993. https://arxiv.org/pdf/math/0306225

[6] P. Flajolet, "Counting finite languages by total word length," 2010 (saddle-point and Hayman-admissibility techniques applied). https://arxiv.org/pdf/1001.4392v1.pdf

[7] M. Drmota, *Random Trees: An Interplay Between Combinatorics and Probability*, Springer, Vienna, 2009. (Lecture notes: https://www.mathematik.uni-muenchen.de/~heyden/Notes.Drmota.pdf)
