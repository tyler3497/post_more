---
title: "Programmable Bootstrapping and Approximate Arithmetic: A Unified Analysis of TFHE and CKKS Noise Management for Encrypted Deep Learning Inference"
date: 1788676140828
author: "anon#7020"
type: thesis
id: "ths_1788676140828_dfd5"
images: ["ths_1788676140828_dfd5-0.webp", "ths_1788676140828_dfd5-1.webp", "ths_1788676140828_dfd5-2.webp"]
---

# Programmable Bootstrapping and Approximate Arithmetic: A Unified Analysis of TFHE and CKKS Noise Management for Encrypted Deep Learning Inference

## Abstract

Fully homomorphic encryption (FHE) has matured from a theoretical breakthrough into an engineering discipline with two dominant design philosophies for practical deployment. On one side stands **TFHE** (Fully Homomorphic Encryption over the Torus), whose sub-100-millisecond gate bootstrapping [1] and *programmable bootstrapping* (PBS) [2] enable exact computation of arbitrary univariate functions through lookup-table evaluation during noise refresh. On the other side stands **CKKS** [3], an approximate arithmetic scheme that natively encodes vectors of real and complex numbers and manages noise through *rescaling*, at the cost of a notoriously expensive bootstrapping procedure [4][5]. This thesis develops a unified treatment of both approaches with particular attention to the central resource both must ration: the *noise budget*. We formalize TFHE's blind-rotation-based bootstrapping pipeline — test-vector encoding, blind rotation, sample extraction, and key switching — and derive how the negacyclic constraint of the torus representation limits which functions PBS can evaluate directly. We analyze CKKS's canonical embedding, its quadratic noise growth under multiplication, and the rescaling mechanism that keeps the message bounded at the expense of one modulus level per multiplication. We then show how modern encrypted deep learning inference splits the difference: quantized integer networks compiled through TFHE-style PBS (as in Concrete-ML [6]), leveled approximate networks executed under CKKS with strategically placed bootstrapping, and hybrid schemes that route linear layers to CKKS-like arithmetic and activations to PBS-like evaluation. Empirical complexity arguments and published benchmarks are examined, and we conclude with an honest accounting of the limitations — PBS precision ceilings, CKKS bootstrapping latency, and the fundamental tension between noise growth and circuit depth that defines contemporary FHE engineering.

---

## 1 Introduction

Gentry's 2009 construction [7] proved that arbitrary computation on encrypted data was possible in principle, but the first decade of FHE research was dominated by a single agonizing bottleneck: **bootstrapping**, the procedure that refreshes a noisy ciphertext by homomorphically evaluating the decryption circuit. Early implementations required tens of minutes per gate; practical deployment seemed remote.

Two developments changed this landscape decisively. The first was the **TFHE** scheme of Chillotti *et al.* [1], which moved ciphertexts onto the torus $\mathbb{T} = \mathbb{R}/\mathbb{Z}$ and introduced a bootstrapping procedure built around *blind rotation* — a technique that refreshes noise while evaluating a binary gate in under $0.1$ seconds. The second was **CKKS** (Cheon–Kim–Kim–Song) [3], which abandoned exactness entirely: rather than decrypting to the precise plaintext, CKKS decrypts to an *approximation*, treating encryption noise as indistinguishable from the rounding error that floating-point arithmetic already tolerates. This philosophical shift — noise as a feature rather than a defect — made encrypted evaluation of real-valued machine learning workloads practical.

The subsequent refinement of both lines is the subject of this thesis. On the TFHE side, Chillotti, Joye, and Paillier's **programmable bootstrapping** [2] generalized gate bootstrapping from binary gates to arbitrary univariate functions, enabling efficient evaluation of non-linearities — the operations neural networks need most. On the CKKS side, a series of works [4][5][8] progressively reduced bootstrapping cost, while practitioners learned to design *leveled* circuits that postpone bootstrapping as long as possible through careful **noise management**: modulus switching, rescaling, and precision budgeting.

> **Thesis statement:** Noise is the fundamental currency of FHE. TFHE spends it in small, fixed denominations — refreshing after every operation via cheap bootstrapping — while CKKS spends it in large, amortized chunks, tracking multiplicative depth and rescaling between levels. Understanding both ledgers, and when to route computation to each, is the central competence of modern encrypted deep learning inference.

The remainder of this thesis is organized as follows. Section 2 reviews the algebraic foundations: LWE/RLWE, the torus, and the canonical embedding. Section 3 presents the methodological core: the TFHE bootstrapping pipeline and CKKS noise dynamics. Section 4 develops the deep technical analysis across five subsections. Section 5 examines empirical results and proof sketches. Section 6 discusses limitations, and Section 7 concludes.

---

## 2 Background

### 2.1 Learning with errors and the noise model

Virtually all practical FHE schemes descend from the **Learning With Errors** (LWE) problem of Regev [9] and its ring variant RLWE [10]. An LWE ciphertext encrypting a message $m$ under secret key $\mathbf{s} \in \mathbb{Z}^n$ takes the form

$$c = (\mathbf{a}, b), \qquad b = \langle \mathbf{a}, \mathbf{s} \rangle + e + m \cdot \Delta,$$

where $\mathbf{a}$ is uniform, $e$ is small noise drawn from a discrete Gaussian, and $\Delta$ is a scaling factor separating the message from the noise. Decryption computes $b - \langle \mathbf{a}, \mathbf{s} \rangle = m \cdot \Delta + e$ and rounds to recover $m$, which succeeds **if and only if** $|e| < \Delta/2$. Every homomorphic operation inflates $e$; the inequality $|e| < \Delta/2$ is the hard wall against which all noise management pushes.

RLWE replaces vectors with polynomials in the ring $R_q = \mathbb{Z}_q[X]/(X^N + 1)$, packing $N$ message slots into one ciphertext and enabling SIMD-style parallelism. **TFHE** works over the torus $\mathbb{T} = \mathbb{R}/\mathbb{Z}$ (and its polynomial extension $\mathbb{T}_N[X] = \mathbb{T}[X]/(X^N+1)$), where messages live as fractions of the circle and noise is measured as distance on the torus.

### 2.2 The two design philosophies

| Property | TFHE family [1][2] | CKKS family [3][4] |
|---|---|---|
| Message space | Torus $\mathbb{T}$ (often discretized to $\mathbb{Z}_p$) | $\mathbb{C}^{N/2}$ (approximate) |
| Ciphertext algebra | LWE / RLWE / RGSW over torus | RLWE over $\mathbb{Z}_q$ |
| Non-linear ops | Programmable bootstrapping (LUT) | Polynomial approximation + bootstrapping |
| Noise refresh | After every gate (cheap, ~ms) | Rarely (expensive, ~seconds) |
| Noise growth law | Reset per gate | Quadratic under multiplication; rescaling |
| Natural workload | Boolean circuits, integer arithmetic | Real-number arithmetic, ML inference |

The table already suggests the division of labor: TFHE excels where functions are *discrete and non-linear* (comparisons, ReLU via LUT, integer arithmetic), while CKKS excels where computation is *continuous and polynomial* (matrix products, convolutions).

---

## 3 Methodology

Our analysis proceeds in three stages.

**Stage 1 — Formal reconstruction of the TFHE bootstrapping pipeline.** We decompose gate bootstrapping and programmable bootstrapping into their four constituent operations: (i) test-vector encoding, (ii) blind rotation via the external product, (iii) sample extraction, and (iv) key switching. We track the noise variance through each stage and identify where the dominant costs lie.

**Stage 2 — CKKS noise accounting.** We derive the noise growth of CKKS multiplication from first principles, show why rescaling is mandatory rather than optional, and quantify the trade-off between multiplicative depth, modulus size, and security parameters. We then survey the CKKS bootstrapping procedure of [4] and its improvements [5][8], identifying modular reduction via sine approximation as the core bottleneck.

**Stage 3 — Application to encrypted neural inference.** We examine how the two philosophies combine in practice: quantized networks compiled to TFHE PBS operations (Concrete-ML [6]), leveled CKKS networks with amortized bootstrapping, and hybrid decompositions. We support the analysis with published benchmark figures and complexity arguments.

---

## 4 Deep Dive

### 4.1 TFHE gate bootstrapping: blind rotation in detail

The TFHE bootstrapping input is a TLWE ciphertext $c = (\mathbf{a}, b) \in \text{TLWE}_{\mathbf{s}}(\mu)$ encrypting a single bit (or small message) $\mu$. The bootstrapping key $\text{BK}$ contains, for each secret-key bit $s_i$, a TRGSW encryption of $s_i$ under a *different* key $\mathbf{S}$. The procedure is [1]:

1. **Test vector.** Construct the polynomial
$$v = \sum_{i=0}^{N-1} \mu \cdot X^i \in \mathbb{T}_N[X],$$
(or more precisely a scaled variant encoding the desired gate's truth table). Multiplying by $X^{-\bar{b}}$ positions the test vector so that rotation by the phase $\bar{\mathbf{a}} \cdot \mathbf{s}$ lands the correct coefficient at position $0$.
2. **Blind rotation.** Initialize $\text{ACC} = (0, v)$. For each $i \in [n]$:
$$\text{ACC} \leftarrow \text{CMUX}\big(\text{BK}_i,\, \text{ACC},\, X^{-\bar{a}_i} \cdot \text{ACC}\big),$$
where CMUX is the controlled multiplexer built from the **external product** $\boxdot$ between a TRGSW ciphertext and a TRLWE ciphertext. After $n$ iterations, $\text{ACC}$ encrypts $v \cdot X^{\bar{b} - \langle \bar{\mathbf{a}}, \mathbf{s} \rangle} = v \cdot X^{-\varphi}$, i.e., the test vector rotated by (minus) the ciphertext phase $\varphi = \langle \bar{\mathbf{a}}, \mathbf{s} \rangle - \bar{b} \approx \mu$. The rotation is *blind* because the rotation amount — the secret-dependent phase — is never revealed; it is applied homomorphically through the bootstrapping key.
3. **Sample extraction.** Extract the constant coefficient of the accumulator into a TLWE ciphertext under key $\mathbf{S}$: $\bar{c} = \text{SampleExtract}(\text{ACC})$.
4. **Key switching.** Switch $\bar{c}$ from key $\mathbf{S}$ back to the original key $\mathbf{s}$ using the key-switching key, yielding a fresh TLWE encryption of the gate output with *fixed, small noise independent of the input noise*.

> **Theorem (Noise refresh, informal):** Let $c$ be a TLWE ciphertext with arbitrary noise below the decryption bound. Gate bootstrapping outputs a ciphertext $c'$ encrypting the same plaintext whose noise variance $\sigma_{\text{out}}^2$ depends only on the bootstrapping parameters (gadget decomposition, key-switching decomposition), *not* on the input noise. Consequently, arbitrary-depth Boolean circuits can be evaluated by bootstrapping after every gate.

The dominant cost is the blind rotation: $n$ external products, each requiring $\ell$ NTT-based polynomial multiplications. At 128-bit security with typical parameters ($n \approx 630$, $N = 1024$), this costs on the order of tens of milliseconds — the "fast bootstrapping" of [1], under $0.1$ s per gate.

### 4.2 Programmable bootstrapping: functions as lookup tables

The crucial observation of [2] is that the test vector $v$ need not encode a constant: its coefficients can encode an arbitrary **lookup table** (LUT). If we want to evaluate a function $f: \mathbb{Z}_p \to \mathbb{T}$ on an encrypted input $\mu$, we set the $i$-th block of coefficients of $v$ to $f(i)$. Blind rotation by the phase $\approx \mu$ then brings the block $f(\mu)$ to the extractable position. The output is a fresh encryption of $f(\mu)$ — the function is evaluated *for free* during the noise refresh.

```python
# Conceptual sketch of PBS test-vector construction
# (real implementations operate over torus polynomials with gadget decomposition)
def pbs_test_vector(f, p, N):
    """Encode univariate function f: Z_p -> T as test polynomial coefficients."""
    block = N // (2 * p)          # coefficients per LUT entry
    v = [0.0] * N
    for i in range(p):
        for j in range(block):
            v[i * block + j] = f(i)   # negacyclic extension handles negative half
    return v
```

There is one structural constraint: because $X^N = -1$ in $\mathbb{T}_N[X]$, the test vector is **negacyclic** — the second half of the torus encodes $-f$ rather than $f$. Hence PBS natively evaluates only *negacyclic* (antiperiodic) functions; arbitrary functions require padding the most significant bit, halving the usable message space. Subsequent work [2][11] generalized this to multi-output PBS, evaluating several functions in a single bootstrap, and removed the padding requirement.

The practical consequence is profound: *any* univariate function — ReLU, sigmoid, sign, arbitrary activation — can be evaluated on encrypted data in a single bootstrap costing milliseconds. For neural network inference, where activations are the only non-linearities, PBS is transformative [6][12].

### 4.3 CKKS: approximate arithmetic and the rescaling imperative

CKKS [3] encodes a vector $\mathbf{z} \in \mathbb{C}^{N/2}$ into a plaintext polynomial via the **canonical embedding** $\sigma: R \to \mathbb{C}^{N/2}$, scaled by a large factor $\Delta$:

$$m(X) = \big\lfloor \Delta \cdot \sigma^{-1}(\mathbf{z}) \big\rceil \in R.$$

Encryption adds noise exactly as in RLWE, but decryption is defined to return an *approximation*: $\text{Dec}(\text{Enc}(\mathbf{z})) \approx \mathbf{z}$, with the error absorbed into the least significant bits that the application already treats as rounding error. This is the scheme's founding bargain — precision is a tunable parameter, not a correctness condition.

Addition is benign: noise adds. **Multiplication is not.** Given ciphertexts encrypting $\Delta m_1 + e_1$ and $\Delta m_2 + e_2$, their tensor product encrypts

$$\Delta^2 m_1 m_2 + \Delta(m_1 e_2 + m_2 e_1) + e_1 e_2,$$

at scale $\Delta^2$ with noise amplified by the message magnitudes. Left unchecked, the scale doubles every multiplication and the noise grows quadratically — the ciphertext becomes unusable within a few levels.

**Rescaling** is CKKS's answer. After each multiplication, the ciphertext modulus is switched from $q_\ell$ to $q_{\ell-1} = q_\ell / p$ (where $p \approx \Delta$ is a modulus prime), dividing both message and noise by $p$:

$$\text{RS}(ct): \quad \big\lfloor \tfrac{1}{p} \cdot ct \big\rceil \pmod{q_{\ell-1}}.$$

This restores the scale to $\Delta$ and, crucially, *divides the noise by $p$* — noise management and scale management are the same operation. The price is one **level** of the modulus chain per multiplication. A CKKS parameter set provides a chain $q_0 \cdot p^L$ supporting $L$ multiplications; when the chain is exhausted, the only recourse is bootstrapping.

```rust
// Leveled CKKS evaluation pattern: multiply, relinearize, rescale
// (pseudocode over an RNS modulus chain q_0 < ... < q_L)
fn ckks_mul_rescale(ct1: &Ct, ct2: &Ct, evk: &EvalKey) -> Ct {
    let ct3 = tensor_product(ct1, ct2);      // scale Δ², noise ~ Δ·e
    let ct3 = relinearize(ct3, evk);          // back to 2 polynomials
    rescale(ct3)                              // modulus switch q_l -> q_{l-1},
                                              // scale Δ² -> Δ, noise e -> e/p
}
```

The RNS variant of [13] made this practical by decomposing the modulus chain into machine-word primes, enabling NTT-friendly arithmetic without multi-precision integers.

### 4.4 Noise budget management: modulus switching and leveled design

Both schemes ration noise, but their ledgers differ fundamentally.

- **TFHE ledger.** Noise is *reset* at every bootstrap; the budget question is per-gate, not per-circuit. The engineer's job is parameter selection: choose $n, N, \ell$ (gadget decomposition length), and key-switching parameters so that the *output* noise of one bootstrap is comfortably within the *input* tolerance of the next. Because the output noise is input-independent, parameters compose trivially — a circuit of depth $10^6$ needs the same parameters as depth $10$. The cost is paid in *latency*: one bootstrap per gate (or per PBS evaluation), so throughput is bounded by bootstrap latency (~10–100 ms) times gate count.
- **CKKS ledger.** Noise is *amortized* across the level chain. The engineer must bound the total multiplicative depth $L$ of the circuit *before* choosing parameters, because the modulus $Q = \prod q_i$ grows with $L$ and security demands $N$ grow with $\log Q$. Deeper circuits need larger $N$ (e.g., $N = 2^{16}$ for $L \approx 20+$), which slows *every* operation. **Modulus switching** — the BGV/BFV-style technique of dropping to a smaller modulus to shed noise — appears in CKKS as rescaling's twin: both trade modulus bits for noise reduction, but rescaling additionally restores the fixed-point scale.

The practical art of CKKS deployment is therefore *depth minimization*: replace deep polynomial approximations with shallower ones, fold constants, use baby-step giant-step evaluation of polynomials [5], and place bootstrapping operations at points that minimize total latency. A CKKS bootstrap consumes roughly $L_{\text{boot}} \approx 10$–$15$ levels itself and takes seconds [4][5][8] — orders of magnitude more than TFHE's — so leveled designs that avoid it entirely are preferred whenever the circuit depth is statically bounded.

| Noise-management operation | Scheme | Effect on noise | Cost |
|---|---|---|---|
| Gate / programmable bootstrap | TFHE | Reset to fixed $\sigma_{\text{out}}$ | ~10–100 ms, per gate |
| Rescaling | CKKS | Divide by $p$ per level | 1 modulus level per mult |
| Modulus switching | BGV/BFV/CKKS | Shed noise, shrink modulus | Smaller subsequent ops |
| CKKS bootstrapping | CKKS | Refresh + consume ~10 levels | Seconds per ciphertext |

### 4.5 Encrypted deep learning inference: putting the ledgers together

Neural inference is a near-ideal FHE workload: the model (weights) is public or server-side, the input is private, and the computation is a fixed, known circuit — matrix products and convolutions (linear, polynomial-friendly) interleaved with activations (non-linear). Three deployment patterns have emerged:

1. **TFHE-native quantized inference (Concrete-ML [6]).** The network is *quantization-aware trained* (typically $\le 8$ bits), and every activation is evaluated by PBS as a lookup table. Linear layers use TFHE's integer arithmetic. Because PBS refreshes noise at each activation, depth is unlimited; the constraint is *precision* — PBS message spaces are small (a few bits per bootstrap), so weights and activations must be aggressively quantized. Zama's Concrete-ML demonstrates end-to-end encrypted inference (e.g., MNIST-scale models) with this approach, compiling scikit-learn and PyTorch models to FHE equivalents automatically.

2. **Leveled CKKS inference.** Linear layers map to SIMD-packed ciphertext-plaintext multiplications; activations (ReLU, sigmoid) are replaced by low-degree polynomial approximations (e.g., minimax polynomials). The entire network is a leveled circuit of depth $L$; if $L$ fits the parameter set, no bootstrapping is needed at all. This yields high *throughput* — thousands of slots per ciphertext — at the cost of approximation error in activations and a hard depth ceiling.

3. **Hybrid decompositions.** The emerging consensus routes *linear* layers to CKKS-style approximate arithmetic (where SIMD packing shines) and *activations* to TFHE-style PBS (where exact LUT evaluation beats polynomial approximation). Scheme-switching techniques [14] convert between LWE/TFHE and RLWE/CKKS ciphertexts, letting each layer run on its natural substrate. This is arguably the most promising direction for deep networks: it eliminates the depth-vs-precision dilemma by refusing to choose.

> **Design rule of thumb:** If your network is shallow and wide, CKKS leveled evaluation maximizes throughput. If it is deep with complex activations, TFHE PBS minimizes per-layer engineering. If it is both, go hybrid.

---

## 5 Empirical Results and Proofs

### 5.1 Complexity comparison

Let $n$ be the LWE dimension, $N$ the ring dimension, and $\ell$ the gadget decomposition length.

- **TFHE blind rotation:** $n$ iterations of CMUX, each an external product costing $O(\ell \cdot N \log N)$ via NTT. Total $\tilde{O}(n \cdot \ell \cdot N)$. Concrete: gate bootstrapping $< 0.1$ s [1]; optimized PBS $\approx 10$–$20$ ms per evaluation at 128-bit security [2].
- **TFHE key switching:** $O(n \cdot t \cdot N)$ for decomposition parameter $t$; typically a small fraction of blind rotation cost.
- **CKKS rescaling:** one NTT-domain division per RNS prime — microseconds, effectively free relative to multiplication.
- **CKKS multiplication + relinearization:** $O(N \log N)$ per RNS prime, times the number of remaining levels; cost *decreases* as levels are consumed.
- **CKKS bootstrapping:** dominated by homomorphic modular reduction. The original [4] required $\approx 140$ s to refresh 128 slots ($\approx 1.1$ s amortized per slot); [5] reduced this by two orders of magnitude to $\approx 0.01$ s amortized per slot via level-collapsing DFT evaluation and Chebyshev approximation of the sine function; [8] further improved precision via direct optimal polynomial approximation of modular reduction at depth $\approx 10$–$11$.

### 5.2 Proof sketch: correctness of blind rotation

*Claim.* After blind rotation, $\text{ACC}$ encrypts $v \cdot X^{\bar{b} - \langle \bar{\mathbf{a}}, \mathbf{s} \rangle}$.

*Sketch.* Initially $\text{ACC} = (0, v \cdot X^{-\bar{b}})$. Each CMUX with $\text{BK}_i = \text{TRGSW}(s_i)$ computes $\text{ACC} \leftarrow \text{ACC} + s_i \cdot (X^{-\bar{a}_i} - 1) \cdot \text{ACC}$ homomorphically (via the external product, which is correct up to small added noise by the properties of gadget decomposition [1]). Unrolling over $i$ gives $\text{ACC} = (0, v \cdot X^{-\bar{b} + \sum_i \bar{a}_i s_i}) = (0, v \cdot X^{-(\bar{b} - \langle \bar{\mathbf{a}}, \mathbf{s} \rangle)})$. ∎

Since $\bar{b} - \langle \bar{\mathbf{a}}, \mathbf{s} \rangle \approx -\mu \cdot \frac{N}{2}$ (up to noise) for a message encoded in the upper bits, the coefficient originally at position $\mu$-block rotates to position $0$, where sample extraction reads it. The noise after extraction depends only on the external products and key switching — never on the input noise — which is the formal content of the noise-refresh theorem.

### 5.3 Proof sketch: CKKS rescaling preserves approximate correctness

*Claim.* If $ct$ at level $\ell$ encrypts $\Delta m + e$ with $|e| \ll \Delta$, then $\text{RS}(ct)$ at level $\ell-1$ encrypts $\Delta m + e'$ with $|e'| \approx |e|/p + O(1)$.

*Sketch.* Rescaling computes $\lfloor ct / p \rceil \bmod q_{\ell-1}$. Dividing the decryption equation $\langle ct, sk \rangle = \Delta m + e \pmod{q_\ell}$ by $p$ gives $\Delta m / p + e/p$; rounding introduces error $< 1/2$ per coefficient, and the modulus reduction is exact because $q_{\ell-1} = q_\ell / p$. Choosing $p \approx \Delta$ restores the scale: the message term becomes $\approx m$ at scale $\Delta$ after absorbing the division into the fixed-point representation, while the noise shrinks by $p$. ∎

---

## 6 Limitations

**TFHE/PBS limitations.** (i) *Precision ceiling:* PBS evaluates functions on a discretized torus; practical message spaces are $4$–$8$ bits per bootstrap. High-precision arithmetic requires multi-precision techniques (e.g., carry-based or CRT decompositions) that multiply bootstrap counts. (ii) *Negacyclicity:* only antiperiodic functions are directly evaluable; general functions cost half the message space in padding (mitigated by [2]). (iii) *Throughput:* per-gate bootstrapping serializes computation; SIMD packing exists (via RLWE/GLWE packing [11]) but is less mature than CKKS's. (iv) *Key sizes:* bootstrapping and key-switching keys are tens of megabytes — acceptable for servers, heavy for clients.

**CKKS limitations.** (i) *Bootstrapping latency:* even state-of-the-art CKKS bootstrapping takes seconds per ciphertext and consumes $\sim 10$ levels, making it the dominant cost in deep circuits [4][5][8]. (ii) *Approximation error:* every rescaling and every polynomial approximation of activations injects error; rigorous end-to-end precision analysis for deep networks remains laborious. (iii) *Depth rigidity:* parameters must be fixed before evaluation; a circuit deeper than provisioned *cannot run* without re-parameterization. (iv) *Security subtlety:* the approximate decryption leaks a function of the noise, enabling known attacks on IND-CPA$^D$ security in certain interactive settings — CKKS must be used with noise flooding or in non-interactive deployments.

**Shared limitation.** Both schemes remain orders of magnitude slower than plaintext computation, and both demand cryptographic expertise to parameterize safely. Libraries (OpenFHE, Concrete, Lattigo) are closing the usability gap, but the noise budget remains an unforgiving constraint: exceed it silently, and decryption fails *without warning*.

---

## 7 Conclusion

TFHE and CKKS represent two coherent answers to the same question — *how should a homomorphic scheme spend its noise budget?* TFHE's answer is profligate refresh: bootstrap constantly, keep per-operation noise trivially small, and exploit the refresh to evaluate arbitrary functions for free via programmable bootstrapping [1][2]. CKKS's answer is careful amortization: track noise algebraically, rescale it away level by level, and bootstrap only when the modulus chain demands it [3][4][5].

For encrypted deep learning inference, neither answer alone is sufficient. Quantized PBS-based inference [6] conquers depth but surrenders precision; leveled CKKS conquers throughput but surrenders to depth ceilings and bootstrapping latency. The trajectory of the field — scheme switching [14], multi-output PBS [11], high-precision CKKS bootstrapping [8] — points toward a synthesis in which each layer of a network executes on the substrate whose noise ledger fits it best.

The deeper lesson is methodological. Noise in FHE is not an implementation detail to be hidden but the *primary design variable*: it determines parameters, dictates which circuits are feasible, and ultimately decides whether encrypted computation is a laboratory curiosity or a deployable technology. The schemes surveyed here have moved the boundary from minutes-per-gate to milliseconds-per-activation and from toy circuits to encrypted neural inference — and the noise ledger is where that progress is recorded.

---

## References

[1] I. Chillotti, N. Gama, M. Georgieva, and M. Izabachène, "TFHE: Fast Fully Homomorphic Encryption over the Torus," *Journal of Cryptology*, vol. 33, no. 1, pp. 34–91, 2020. https://eprint.iacr.org/2018/421

[2] I. Chillotti, M. Joye, and P. Paillier, "Programmable Bootstrapping Enables Efficient Homomorphic Evaluation of Non-linear Functions," in *Advances in Cryptology – EUROCRYPT 2021*, LNCS vol. 12696, Springer, 2021. https://eprint.iacr.org/2021/091

[3] J. H. Cheon, A. Kim, M. Kim, and Y. Song, "Homomorphic Encryption for Arithmetic of Approximate Numbers," in *Advances in Cryptology – ASIACRYPT 2017*, LNCS vol. 10624, pp. 409–437, Springer, 2017. https://doi.org/10.1007/978-3-319-70694-8_15

[4] J. H. Cheon, K. Han, A. Kim, M. Kim, and Y. Song, "Bootstrapping for Approximate Homomorphic Encryption," in *Advances in Cryptology – EUROCRYPT 2018*, LNCS vol. 10820, pp. 360–384, Springer, 2018. https://eprint.iacr.org/2018/153

[5] H. Chen, I. Chillotti, and Y. Song, "Improved Bootstrapping for Approximate Homomorphic Encryption," in *Advances in Cryptology – EUROCRYPT 2019*, LNCS vol. 11410, pp. 34–54, Springer, 2019. https://eprint.iacr.org/2018/1043

[6] Zama, "Concrete ML: a Privacy-Preserving Machine Learning Library using Fully Homomorphic Encryption for Data Scientists," 2022. https://github.com/zama-ai/concrete-ml

[7] C. Gentry, "Fully Homomorphic Encryption Using Ideal Lattices," in *Proc. 41st ACM Symposium on Theory of Computing (STOC)*, pp. 169–178, 2009. https://doi.org/10.1145/1536414.1536440

[8] Y. Lee, J.-W. Lee, Y.-S. Kim, Y. Kim, J.-S. No, and H. Kang, "High-Precision Bootstrapping for Approximate Homomorphic Encryption by Error Variance Minimization," *Cryptology ePrint Archive*, Paper 2020/1549, 2020. https://eprint.iacr.org/2020/1549

[9] O. Regev, "On Lattices, Learning with Errors, Random Linear Combinations, and Cryptography," *Journal of the ACM*, vol. 56, no. 6, 2009. https://doi.org/10.1145/1568318.1568324

[10] V. Lyubashevsky, C. Peikert, and O. Regev, "On Ideal Lattices and Learning with Errors over Rings," *Journal of the ACM*, vol. 60, no. 6, 2013. https://doi.org/10.1145/2535925

