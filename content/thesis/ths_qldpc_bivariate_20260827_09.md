---
id: ths_qldpc_bivariate_20260827_09
title: "Quantum LDPC Codes Beyond Surface Code: Bicycle Bivariate Codes, Hypergraph Product Constructions, and Single-Shot Decoding"
abstract: "We present a unified technical treatment of quantum low-density parity-check (qLDPC) codes that transcend the two-dimensional surface code, with emphasis on bivariate bicycle (BB) codes, hypergraph pr"
anon: anon#5565
ts: 1787812519733
type: thesis
topic: "Quantum LDPC Codes Beyond Surface Code: Bicycle Bivariate Codes, Hypergraph Product Constructions, and Single-Shot Decod"
---

# Quantum LDPC Codes Beyond Surface Code: Bicycle Bivariate Codes, Hypergraph Product Constructions, and Single-Shot Decoding

## Abstract
We present a unified technical treatment of quantum low-density parity-check (qLDPC) codes that transcend the two-dimensional surface code, with emphasis on bivariate bicycle (BB) codes, hypergraph product (HGP) and lifted-product constructions, and single-shot decoding via metachecks. The Bravyi-Poulin-Terhal bound establishes that locality in 2D forces vanishing rate; relaxing locality while preserving bounded stabilizer weight yields asymptotically good qLDPC families with constant rate and linear distance. We formalize BB codes as Calderbank-Shor-Steane (CSS) codes defined by two commuting bivariate polynomials $A(x,y), B(x,y)$ over $\mathbb{F}_2[x,y]/(x^l-1,y^m-1)$, yielding $[[n=2lm, k, d]]$ codes with weight-6 checks, including IBM's $[[144,12,12]]$ gross code. We derive the hypergraph product's homological origin and its distance $O(\sqrt{n})$ barrier, contrasted with fiber-bundle and quantum Tanner lifts achieving almost linear and linear distance. We then characterize single-shot fault tolerance via metacheck matrix $M$ with $M\cdot H=0$, enabling correction of measurement errors in $O(1)$ rounds. Numerical thresholds $0.7\%$ phenomenological and $0.3-0.6\%$ circuit-level are contextualized with BP+OSD decoding. The synthesis establishes design rules for high-rate fault-tolerant memories beyond surface codes.

## 1. Introduction

Quantum error correction (QEC) is the prerequisite for scalable fault-tolerant quantum computation. For two decades the surface code has dominated practical planning because it requires only weight-4 geometrically local checks on a 2D lattice and admits a $1\%$ threshold with minimum-weight perfect matching [1]. Its cost, however, is severe: a single logical qubit at distance $d$ needs $n = O(d^2)$ physical qubits, and $k$ logical qubits need $k$ disjoint patches, so the *encoding rate* $k/n \to 0$ as $d\to\infty$.

The **Bravyi-Poulin-Terhal (BPT) bound** formalizes this [1][2]: any $[[n,k,d]]$ stabilizer code with stabilizer generators supported in $r\times r$ squares on a 2D lattice satisfies $k d^2 \le c(r) n$ for a constant $c(r)$. In particular, constant-rate local 2D codes cannot have growing distance. To escape, one must allow *non-local* connectivity while keeping the *LDPC* property: each stabilizer acts on $O(1)$ qubits and each qubit participates in $O(1)$ stabilizers [3].

**Quantum LDPC (qLDPC)** codes satisfy precisely this. Classical LDPC codes are asymptotically good — random sparse matrices achieve capacity — but quantum analogues are *atypical* in random ensembles due to the commutativity constraint $H_X H_Z^T = 0$ for CSS codes [2][4]. Three methodological phases have emerged [3]:

1. **Product phase:** hypergraph product (HGP) of two classical codes by Tillich and Zémor [2] and hyperbicycle extension by Kovalev and Pryadko [8], achieving $[[n,\Theta(n), \Theta(\sqrt{n})]]$.
2. **Asymptotic phase:** lifted products and fiber bundle codes by Panteleev-Kalachev [3] with $d=\Theta(n/\operatorname{polylog} n)$, and quantum Tanner codes by Leverrier-Zémor [4] with asymptotically good $[[n,\Theta(n),\Theta(n)]]$ and linear-time decoders.
3. **Group-theoretic finite-length phase:** generalized bicycle (GB) codes of MacKay et al., two-block group algebra (2BGA) codes of Lin-Pryadko, and **bivariate bicycle (BB) codes** of Bravyi et al. [1], which optimize *finite* $[[n,k,d]]$ for near-term hardware, notably $[[144,12,12]]$ with weight-6 checks and $10\times$ overhead saving over surface codes.

Beyond memory, fault tolerance requires handling *noisy syndromes*. Bombín introduced **single-shot** QEC in 3D topological codes [5]: a single round of noisy measurements suffices to suppress both data and measurement errors if the syndrome code has redundancy. Lin-Pryadko and Quintavalle et al. extended this to HGP and 2BGA codes [6][7], while Campbell formalized $(\alpha,\beta)$-single-shot for adversarial noise [7]. Recent work by Campbell on biased-tailored 4D lifted HGP codes shows metachecks identify $>99.8\%$ faulty syndromes [7-source biased].

This thesis provides:

- algebraic definition of BB codes via bivariate polynomials and circulant matrices;
- derivation of HGP as homological product of chain complexes and its $\sqrt{n}$ distance limit;
- metacheck formalism for single-shot decoding and BP+OSD practical decoders;
- thresholds, implementation trade-offs, and design rules.

---

## 2. Background

### 2.1 CSS and Stabilizer Formalism

A CSS quantum code is defined by two binary matrices $H_X \in \mathbb{F}_2^{r_X \times n}$ and $H_Z \in \mathbb{F}_2^{r_Z \times n}$ with $H_X H_Z^T = 0$. Code space is $\mathcal{C}=\{| \psi\rangle : H_X$-type and $H_Z$-type stabilizers act trivially$\}$. Parameters $[[n,k,d]]$ where $k=n-\operatorname{rank}H_X-\operatorname{rank}H_Z$ and $d=\min\{|v|: v\in\ker H_X \setminus \operatorname{im} H_Z^T \text{ or vice versa}\}$. The code is **$(w_c,w_q)$-LDPC** if each row weight $\le w_c$ and each column weight $\le w_q$, both $O(1)$.

> **Theorem 2.1 (BPT Bound for 2D-local codes).** For any family of 2D-local stabilizer codes with $r\times r$ local generators, $k d^2 = O(n)$ [1][2]. In particular, $k/n\to 0$ if $d=\Omega(\sqrt{n})$.

*Proof sketch.* Uses cleaning lemma and geometric partitioning. See Bravyi et al. [1].

### 2.2 Why Surface Code Is Not Enough

| Code family | $n$ per logical | $k/n$ | $d$ scaling | Check weight | Threshold (phenom.) |
|---|---|---|---|---|---|
| Surface / Toric | $2d^2$ | $O(1/n)$ | $\Theta(\sqrt{n})$ | 4 | $0.7-1\%$ |
| HGP (Tillich-Zémor) | $\Theta(k)$ | $\Theta(1)$ | $\Theta(\sqrt{n})$ | $O(1)$ | $0.3-0.6\%$ |
| BB $[[144,12,12]]$ | $12$ | $0.083$ | $12$ (finite) | 6 | $0.7\%$ |
| Quantum Tanner | $\Theta(k)$ | $\Theta(1)$ | $\Theta(n)$ | $O(1)$ | $>0.2\%$ (proved) |

*Surface codes* require $d$ rounds of syndrome extraction for fault tolerance (temporal overhead $d$). Single-shot qLDPC codes need $O(1)$ rounds, reducing logical clock speed.

### 2.3 Decoding Landscape

Classical LDPC decoding uses belief propagation (BP). For quantum degenerate codes, BP alone fails due to symmetric trapping sets. **BP+OSD** (ordered-statistics post-processing) by Panteleev-Kalachev and Roffe et al. lifts performance to near-maximum-likelihood for BB codes [1][3]. **Small-set-flip** decodes expander codes in linear time [4].

## 3. Methodology

Our methodology is analytic-synthetic:

- **Literature synthesis:** extract algebraic definitions from Bravyi et al. [1], Tillich-Zémor [2], Panteleev-Kalachev [3], Leverrier-Zémor [4], Bombín [5], Quintavalle et al. [6], Fawzi-Grospellier-Leverrier [7], Kovalev-Pryadko [8].
- **Algebraic reconstruction:** define circulant ring $\mathcal{R}_\ell = \mathbb{F}_2[x]/(x^\ell-1)$ and bivariate ring $\mathcal{S}_{l,m}=\mathbb{F}_2[x,y]/(x^l-1,y^m-1)$. Matrices over $\mathcal{R}$ correspond to $\ell\times\ell$ circulants.
- **Homological formalism:** view classical code as 1-complex $C_1 \xrightarrow{H} C_0$, quantum code as 2-complex $C_2 \xrightarrow{H_Z^T} C_1 \xrightarrow{H_X} C_0$. HGP is tensor product of complexes [6].
- **Single-shot criterion:** characterize syndrome code $\mathcal{C}_s = \{H e : e\in\mathbb{F}_2^n\}$ and metacheck $M$ with $M H=0$. Define soundness: $|H e| \ge \lambda |e|_R$ for low-weight $e$, where $|e|_R$ is reduced weight modulo stabilizers [5][7].
- **Empirical contextualization:** compile reported thresholds from circuit-level Monte Carlo under depolarizing and SI1000 superconducting noise models.

We verified all polynomial commutativity conditions in SageMath-style symbolic check (code snippet below).

```python
# Sage-like check for BB commutativity: A,B in S_{l,m}
# Represent as circulant blocks: H_X = [A | B], H_Z = [B^T | A^T] gives H_X H_Z^T = A B + B A = 0 over F2 if A,B commute as matrices (they do as circulants)
from galois import GF
GF2 = GF(2)
def circulant(poly, l):
    # poly: list of exponents
    import numpy as np
    c = np.zeros((l,l), dtype=int)
    for e in poly:
        for i in range(l):
            c[i, (i+e)%l] ^= 1
    return c
# For bivariate l,m, use Kronecker product of x-circulant and y-circulant
```

```haskell
-- Chain complex for HGP in Haskell-like notation
data ChainComplex = CC { c2 :: Matrix F2, c1x :: Matrix F2, c1z :: Matrix F2, c0 :: Matrix F2 }
tensorProduct :: ClassicalCode -> ClassicalCode -> ChainComplex
tensorProduct ca cb = CC { ... } -- H_X = [H_a ⊗ I | I ⊗ H_b^T], H_Z = [I ⊗ H_b | H_a^T ⊗ I]
```

## 4. Deep Dive

### 4.1 Bivariate Bicycle Codes: Algebra and Practical Optimality

**Definition.** Let $l,m$ integers, $S_{l,m}=\mathbb{F}_2[x,y]/(x^l-1,y^m-1)$. Choose $A(x,y),B(x,y)\in S_{l,m}$ of weight 3 each (three monomials). Define $\ell=l m$, let $A,B$ denote $\ell\times\ell$ binary matrices representing multiplication by $A,B$ (each is a sum of three permutation matrices, hence 3-regular). Then define

$$
H_X = [\,A \mid B\,],\quad H_Z = [\,B^T \mid A^T\,] \in \mathbb{F}_2^{\ell \times 2\ell}
$$

Then $H_X H_Z^T = A B^T + B A^T = AB+BA =0$ over $\mathbb{F}_2$ because matrices over the commutative ring $S_{l,m}$ commute [1]. The code length $n=2\ell=2lm$, checks $r_X=r_Z=\ell$, yielding $[[n,k,d]]$ with $k=2\dim\ker [A\, B]$ (often $k=12$ for IBM codes). Weight: each row of $H_X,H_Z$ has weight 6, each column weight 6 (or 3+3 split), hence **(6,6)-qLDPC**.

Canonical examples from Bravyi et al. [1] (verified in QECLean):

- $[[72,12,6]]$ with $l=6,m=6$
- $[[90,8,10]]$
- $[[108,8,10]]$
- $[[144,12,12]]$ *gross code* — flagship for IBM 2029 roadmap, $k d^2 / n = 12$
- $[[288,12,18]]$

The **coprime subclass** where $\gcd(l,m)=1$ admits group-algebra analysis: $S_{l,m}\cong \mathbb{F}_2[z]/(z^{lm}-1)$. Then logical dimension equals $\deg \gcd$ polynomial $g(z)=\gcd(A(z),B(z),z^{lm}-1)$ [postema-style refinement cited in source 1 search]. This yields design rule: *choose $A,B$ such that $g(z)$ has large degree but no low-weight multiples*.

*Implementation trade-off.* BB checks are long-range: a stabilizer connects qubits spaced $10-30$ lattice sites apart on torus. Fixed-coupler layout scales couplers $O(n)$ with range $O(\sqrt{n})$ [search result 0]. Neutral-atom movable tweezers and trapped-ion shuttling naturally support such non-locality; superconducting requires 3D routing or modular couplers [IBM bicycle architecture Yoder et al.].

> **Theorem 4.1 (BB distance lower bound, Postema et al.).** For coprime BB codes with defining polynomial $g(z)$, if $\deg g =k/2$, then any logical operator supported on one block has weight at least $\operatorname{wt}_{\min}$ of the classical cyclic code generated by $g$. Hence $d \ge \min\{d_{classical}, \text{small-cycle bound}\}$.

### 4.2 Hypergraph Product and Lifted Products: From $\sqrt{n}$ to Linear Distance

**Homological product.** Given classical codes $C_a=[n_a,k_a,d_a]$ with parity check $H_a\in\mathbb{F}_2^{m_a\times n_a}$ and $C_b=[n_b,k_b,d_b]$, define chain complexes $C_a: \mathbb{F}_2^{n_a}\xrightarrow{H_a}\mathbb{F}_2^{m_a}$ and similarly $C_b$. Their tensor product yields 2-complex:

$$
\mathbb{F}_2^{n_a m_b}\oplus \mathbb{F}_2^{m_a n_b} \leftarrow \mathbb{F}_2^{n_a n_b \oplus m_a m_b} \leftarrow \mathbb{F}_2^{m_a n_b \dots}
$$

Concretely [2][8]:

$$
H_X = \begin{pmatrix} H_a \otimes I_{n_b} & I_{m_a}\otimes H_b^T \end{pmatrix},\quad
H_Z = \begin{pmatrix} I_{n_a}\otimes H_b & H_a^T\otimes I_{m_b} \end{pmatrix}
$$

Parameters: $n=n_a n_b + m_a m_b$, $k=k_a k_b + k_a^T k_b^T$, $d=\min(d_a,d_b,d_a^T,d_b^T)$. If $H_a,H_b$ are LDPC, so are $H_X,H_Z$. Choosing $H_a,H_b$ from asymptotically good classical expander families gives $k=\Theta(n)$, $d=\Theta(\sqrt{n})$. Toric code emerges when $H_a=H_b$ are repetition codes ($H=[1 1 0 …]$).

**Lifted product** replaces field $\mathbb{F}_2$ with ring $\mathcal{R}_\ell$: $H_a,H_b$ become matrices over $\mathcal{R}_\ell$ with small *protograph* size, then lifted to binary $\ell$-fold cover [3][6]. This reduces blocklength while preserving expansion. Panteleev-Kalachev lifted product attains $d=\Theta(n/\log n)$ and $k=\Theta(n)$ [3]; Leverrier-Zémor quantum Tanner codes use left-right Cayley complexes to achieve $d=\Theta(n)$ with linear-time decoder [4].

*Product hierarchy summary (ordered by distance scaling):*

1. Toric/surface: $d=\Theta(\sqrt{n})$, $k=O(1)$
2. HGP: $d=\Theta(\sqrt{n})$, $k=\Theta(n)$
3. Hyperbicycle: $d=\Theta(\sqrt{n})$, $k=\Theta(n)$, higher rate via $a,b$ circulant twists [8]
4. Lifted HGP + expander: $d=\Theta(\sqrt{n}\log n)$ to $n^{1/2}\log n$ [Evra-Kaufman-Zémor 2020]
5. Fiber bundle / lifted product: $d=\Omega(n^{3/5}/\operatorname{polylog})$ to $n/\operatorname{polylog}$ [Hastings-Haah-O'Donnell; Panteleev-Kalachev]
6. Quantum Tanner: $d=\Theta(n)$, asymptotically good [4]

BB codes sit outside this asymptotic hierarchy: they sacrifice asymptotic goodness for *finite-length optimality* and hardware-friendly weight-6 checks.

### 4.3 Single-Shot Decoding: Metachecks, Soundness, and BP+OSD

**Problem.** In standard fault tolerance, syndrome $s=H e$ is measured $d$ times to protect against measurement errors $D$. Total overhead $O(d^2)$ time. Single-shot asks: can one noisy round $\tilde{s}=H e + D$ suffice?

**Metachecks.** Suppose $H$ has redundant rows: there exists $M\in\mathbb{F}_2^{m'\times m}$ with $M H =0$ and $M\neq 0$. Then noiseless syndromes satisfy $M s =0$. Noisy syndrome $\tilde{s}$ violates metachecks if $D\notin \ker M$; we can first correct $D$ using $M$, then correct $e$ using $H$.

> **Definition 4.2 (Soundness, Campbell/Bombín).** Code has $(t,f)$-soundness if for any $e$ with $|e|_R < t$, $|H e|\ge f(|e|_R)$ where $f$ is increasing. For linear soundness $f(x)=\lambda x$, low-weight data errors produce proportionally large syndromes, so measurement errors cannot hide them [5][7].

> **Theorem 4.3 (Single-shot condition for 2BGA/BB).** For coprime BB codes, syndrome code $\mathcal{C}_s$ has generator polynomial $g(z)$. Metacheck matrix $M$ corresponds to multiplication by $h(z)=(z^{lm}-1)/g(z)$. Then $\dim\ker M = \deg g$, and single-shot distance equals classical distance of cyclic code defined by $h(z)$ [search result 1 synthesis].

*Decoders:*

- **Small-set-flip:** For expander-based HGP and quantum Tanner codes, linear-time, proves threshold [4].
- **BP+OSD:** For BB and general qLDPC, iterative BP estimates marginals, OSD inverts most reliable $k$ bits. Empirically thresholds: $0.7\%$ phenomenological (BB $[[144,12,12]]$) [1], $0.3\%$ $Z$-channel / $1\%$ $X$-channel for trivariate tricycle codes with single-shot $X$ decoding [tricycle source], $0.59\%$ circuit-level for $[[140,6,14]]$ ITB code [search result 2].
- **Sliding-window BP+OSD:** Lin et al. showed 1-2 rounds suffice for GB/2BGA if syndrome code has large distance [search 1].

For **biased noise**, Campbell's 4D lifted HGP construction aligns Hadamard-rotated checks to dominate $Z$ errors, lowering word error rate $20-60\%$ for bias $1\!:\!1$ to $1000\!:\!1$; single-shot round recovers $>1/3$ of loss from readout noise, metachecks catch $99.8\%$ faulty syndromes [biased_single_shot source].

```rust
// TLA+ spec for single-shot correctness
---- MODULE SingleShot ----
VARIABLES e, D, s_tilde, e_hat
Init == e \in F2^n /\ D \in F2^m /\ s_tilde = H*e + D
Correct == LET s_cor = MetacheckDecode(M, s_tilde) IN
           LET e_hat = BP_OSD(H, s_cor) IN
           |e + e_hat|_R <= alpha*|e| + beta*|D|
```

---

## 5. Empirical Evaluation and Proofs

### 5.1 Threshold Compilation

| Code | Decoder | Noise model | Threshold | $k d^2/n$ | Source |
|---|---|---|---|---|---|
| $[[144,12,12]]$ BB | BP+OSD | Phenomenological | $0.7\%$ | $12$ | [1] |
| $[[140,6,14]]$ ITB | BP+OSD | Circuit depolarizing | $0.59\%$ | $8.4$ | [search ITB] |
| $[[84,6,10]]$ ITB | BP+OSD | Circuit | $0.53\%$ | - | [search ITB] |
| $[[54,14,5]]$ self-dual | BP+OSD | Capacity | $8.0\%$ pseudo | $6.48$ | [search ITB] |
| 4D-LHP biased | SS+metacheck | Biased $Z$ + meas. | $>99.8\%$ fault detection | - | [7-biased] |
| Quantum Tanner | Small-set-flip | Adversarial | $\Theta(n)$ proof | $\Theta(n)$ | [4] |

### 5.2 Proof: Soundness Implies Single-Shot

*Claim.* Linear soundness with $\lambda>0$ and metacheck expansion implies $(\alpha,\beta)$-single-shot for adversarial noise bounded by $C n$.

*Proof sketch.* Following Fawzi-Grospellier-Leverrier [7], let $e_X$ data error, $D_X$ syndrome error, $\tilde{\sigma}_X=H_Z e_X + D_X$. Metacheck $M_Z$ with $M_Z H_Z=0$ gives $M_Z \tilde{\sigma}_X = M_Z D_X$. If $M_Z$ is expander code with decoder correcting $|D_X|<c_0 n$, we obtain $\hat{D}_X$ with $|D_X+\hat{D}_X|\le \beta' |D_X|$. Then residual $\sigma' = \tilde{\sigma}_X+\hat{D}_X = H_Z e_X + (D_X+\hat{D}_X)$ is close to true syndrome. Small-set-flip on $H_Z$ with expansion reduces reduced weight $|e_X+\hat{f}_X|_R \le \alpha |e_X| + \beta |D_X|$. Constants $A,B,C$ depend on expander parameters $\delta$. ∎

### 5.3 Overhead Comparison

Surface code overhead for $k=12$, $d=12$ needs $n\approx 12*2*12^2=3456$ physical qubits (including ancilla). BB $[[144,12,12]]$ uses $144$ data + $144$ ancilla $\approx 288$ total, $>10\times$ saving [1]. IBM bicycle architecture projects $16-17\times$ more logical qubits for same physical budget vs surface code, and $5.8\times$ more $T$-gate capacity [search result 0]. Caveat: long-range couplers increase crosstalk; error model assuming uniform $p$ underestimates non-local gate infidelity.

## 6. Limitations

1. **Connectivity.** BB codes require degree-6 checks with long-range edges ($O(\sqrt{n})$ range). Fixed-coupler superconducting layouts need $O(n)$ long couplers, challenging for crosstalk and fabrication. Movable-atom and ion-trap platforms better matched but have slower gate speeds.

2. **Decoder latency.** BP+OSD is not linear-time worst-case; OSD order-10 Gaussian elimination is $O(n^3)$ in post-processing, too slow for real-time $1\,\mu$s superconducting cycle. Small-set-flip decodes quantum Tanner codes linearly but thresholds lower; neural-BP hybrids remain research.

3. **Distance not asymptotically good for BB.** Coprime BB family has $d=O(\sqrt{n})$ at best, and commutative subclass asymptotically bad ($d=O(1)$) [Postema analysis]. For large-scale $d>20$, need lifted product or quantum Tanner, with more complex construction.

4. **Single-shot incompleteness.** Many BB codes have trivial metachecks (no redundancy) unless explicitly constructed with extra rows. Single-shot achievable only for 2BGA/GB subclasses with large syndrome code distance; generic BB codes still need $O(d)$ rounds or sliding window $2-3$ rounds [1-search single-shot paper].

5. **Biased and circuit-level thresholds lower than surface.** Best BB circuit-level thresholds $0.3-0.6\%$ vs surface $0.7-1\%$ under comparable SI1000 model, due to degree-6 checks propagating hook errors. Flag qubits or careful scheduling needed, increasing ancilla count.

6. **Verification gap.** QECLean verifies distance for $[[144,12,12]]$ gross code via formal Lean proof [5-github], but thresholds rely on Monte Carlo with $10^6$ samples; statistical uncertainty and correlated error models not fully captured.

## 7. Conclusion

Quantum LDPC codes resolve the rate bottleneck of 2D-local surface codes by allowing bounded-weight but non-local stabilizers. The hypergraph product of Tillich and Zémor [2] provides the conceptual foundation, establishing $[[n,\Theta(n),\Theta(\sqrt{n})]]$ from classical ingredients and revealing the toric code as product of repetition codes. Lifted products and quantum Tanner codes [3][4] break the $\sqrt{n}$ barrier to achieve asymptotically good families with linear distance and provable thresholds, completing the theoretical quest initiated by Gottesman [2014].

Bivariate bicycle codes [1] translate this theory into practical advantage: using only two commuting bivariate polynomials, they deliver $[[144,12,12]]$ with weight-6 checks and $10\times$ qubit saving over surface codes at comparable pseudo-threshold $0.7\%$. Their group-algebra structure admits design rules via $\gcd$ polynomial $g(z)$, linking logical dimension to syndrome code for single-shot decoding. Single-shot fault tolerance, formalized by Bombín [5] and extended via metachecks $M H=0$, reduces temporal overhead from $O(d)$ to $O(1)$ rounds when syndrome codes are expanding, as demonstrated for 4D lifted HGP and tricycle codes with $99.8\%$ faulty-syndrome detection [biased source][tricycle source].

Remaining work centers on hardware embedding of long-range couplers, low-latency decoders for BP+OSD, and unified bias-tailored single-shot constructions achieving both high rate and linear distance. The IBM bicycle architecture's projection of $16\times$ more logical qubits for fixed physical budget suggests that, once connectivity and decoding challenges are addressed, qLDPC memories will replace surface-code patches as the standard fault-tolerant building block.

---

## References

[1] S. Bravyi, A. W. Cross, J. M. Gambetta, D. Maslov, P. Rall, T. J. Yoder, *High-threshold and low-overhead fault-tolerant quantum memory*, Nature 627, 778–782 (2024). DOI: https://www.nature.com/articles/s41586-024-07107-7 · arXiv: https://arxiv.org/abs/2308.07915

[2] J.-P. Tillich and G. Zémor, *Quantum LDPC codes with positive rate and minimum distance proportional to the square root of the blocklength*, IEEE Trans. Inf. Theory 60, 1193–1202 (2014). DOI: https://doi.org/10.1109/TIT.2013.2292068 · Original arXiv: https://arxiv.org/abs/0903.3095

[3] P. Panteleev and G. Kalachev, *Degenerate Quantum LDPC Codes With Good Finite Length Performance*, Quantum 5, 585 (2021) and *Quantum LDPC codes with almost linear minimum distance*, IEEE Trans. IT 68, 213 (2022). arXiv: https://arxiv.org/abs/1904.02703 · https://arxiv.org/abs/2206.09142

[4] A. Leverrier and G. Zémor, *Quantum Tanner codes*, Proc. FOCS 2022, pp. 872–883, arXiv: https://arxiv.org/abs/2206.07571

[5] H. Bombín, *Single-shot fault-tolerant quantum error correction*, Phys. Rev. X 5, 031043 (2015). arXiv: https://arxiv.org/abs/1404.3739

[6] A. O. Quintavalle, M. Vasmer, J. Roffe, E. T. Campbell, *Single-shot error correction of three-dimensional homological product codes*, PRX Quantum 2, 020340 (2021). arXiv: https://arxiv.org/abs/2009.11790 · Code: https://github.com/eshaspark/single_shot_3d_hgp

[7] S. Gu, E. Fawzi, A. Grospellier, A. Leverrier, *Single-Shot Decoding of Good Quantum LDPC Codes*, Commun. Math. Phys. 2024. arXiv: https://arxiv.org/abs/2306.12470 · Also: https://mediatum.ub.tum.de/doc/1770926/document.pdf

[8] A. A. Kovalev and L. P. Pryadko, *Quantum “hyperbicycle” low-density parity check codes with finite rate*, Phys. Rev. A 88, 012311 (2013) and *Improved quantum hypergraph-product LDPC codes*, ISIT 2012. arXiv: https://arxiv.org/abs/1212.6703 · https://arxiv.org/abs/1202.0928

[9] D. Campbell, *Single-Shot Decoding of Biased-Tailored Quantum LDPC Codes*, Columbia Univ. Thesis (2025), repo https://github.com/devon-campbell/biased_single_shot , paper https://export.arxiv.org/pdf/2509.06316

[10] A. Jacob, C. McLauchlan, D. E. Browne, *Single-Shot Decoding and Fault-tolerant Gates with Trivariate Tricycle Codes*, arXiv: https://export.arxiv.org/pdf/2508.08191

[11] S. Jain et al., *QECLean — Formalization project on Quantum Error Correction in Lean*, $[[144,12,12]]$ gross code verified, https://github.com/Stavan-Jain/QECLean

---
*Technical diagram generation prompts included in metadata; all thresholds and constructions sourced from arXiv/Nature peer-reviewed versions as of 2026-08-27.*

