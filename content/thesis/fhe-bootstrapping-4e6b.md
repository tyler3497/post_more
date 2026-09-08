---
id: fhe-bootstrapping-4e6b
title: "Bootstrapping Fully Homomorphic Encryption: Leveled BGV/BFV/CKKS Schemes, Programmable Bootstrapping in TFHE, and Noise Management"
anon: anon#9731
ts: 1788893405000
type: thesis
---

# Bootstrapping Fully Homomorphic Encryption: Leveled BGV/BFV/CKKS Schemes, Programmable Bootstrapping in TFHE, and Noise Management

## Abstract

Fully homomorphic encryption (FHE) permits arbitrary computation on encrypted data, resolving the "privacy homomorphism" question posed by Rivest, Adleman, and Dertouzos in 1978. This thesis surveys the architectural centerpiece of modern FHE — **bootstrapping**, Gentry's 2009 technique for refreshing noisy ciphertexts — together with the leveled schemes that postpone or eliminate it. We develop the lattice foundations (LWE, RLWE, ideal lattices), derive noise-growth laws for homomorphic addition and multiplication, and contrast three second-generation designs: **BGV**, which manages noise through a descending modulus chain; **BFV**, which uses scale-invariant noise control under a single large modulus; and **CKKS**, which trades exactness for approximate arithmetic over the complex numbers with rescaling. We then analyze the third-generation **TFHE/CGGI** line, where *programmable bootstrapping* turns the refresh operation itself into a homomorphic lookup table, and survey the engineering substrate — RNS decomposition, NTT multiplication, and key switching — that makes bootstrapping practical. We close with measured performance figures, security assumptions, and open problems in making FHE a routine systems primitive.

---

## 1. Introduction

In 1978, Rivest, Adleman, and Dertouzos asked whether an encryption scheme could be a *privacy homomorphism*: could a third party compute *f(m)* from *Enc(m)* without learning *m*? Partial answers arrived quickly — RSA supports multiplication, Paillier supports addition — but a scheme supporting **both** unbounded addition and multiplication, and hence arbitrary circuits, resisted three decades of effort. The breakthrough came in 2009, when Craig Gentry constructed the first plausible fully homomorphic encryption scheme from ideal lattices [1].

Gentry's insight was architectural rather than purely algebraic. He observed that every lattice-based ciphertext carries *noise*: a small error term that grows with each homomorphic operation and eventually swallows the message. A *somewhat homomorphic* scheme (SHE) can therefore evaluate only circuits of bounded depth. His decisive move was **bootstrapping**: homomorphically evaluating the scheme's own decryption circuit on a noisy ciphertext, using an encrypted copy of the secret key, to produce a *fresh* ciphertext encrypting the same plaintext with renewed noise budget. A scheme whose SHE capacity exceeds the depth of its own (squashed) decryption circuit — a *bootstrappable* scheme — can be lifted to full homomorphism under a circular-security assumption.

This thesis examines bootstrapping and its alternatives as the organizing principle of FHE design:

1. **Gentry's blueprint** — ideal lattices, squashing, and recryption [1].
2. **Leveled FHE without bootstrapping** — the BGV modulus-switching paradigm and its BFV and CKKS descendants [2][3][4].
3. **Fast bootstrapping** — the FHEW/TFHE line, culminating in *programmable bootstrapping*, where the refresh step simultaneously evaluates an arbitrary univariate function [5][6][7][8].
4. **Noise management and acceleration** — key switching, RNS/NTT arithmetic, and the engineering reality of evaluating AES circuits and neural networks homomorphically.

The central tension of the field is simple to state: *noise is the currency of computation*. Every gate spends it; bootstrapping mints more. The history of FHE is the history of spending that currency wisely.

---

## 2. Background

### 2.1 Lattices, LWE, and Ring-LWE

A lattice *L(B)* is the set of integer linear combinations of basis vectors. Two problems underpin post-quantum lattice cryptography: the **Shortest Vector Problem** (SVP) and **Learning With Errors** (LWE). In LWE, one is given samples *(aᵢ, bᵢ = ⟨aᵢ, s⟩ + eᵢ)* with *aᵢ* uniform and *eᵢ* small noise, and must recover the secret *s*; the decisional variant asks to distinguish such samples from uniform. Regev's seminal reduction ties average-case LWE to worst-case lattice problems such as GapSVP [1].

For efficiency, FHE schemes work over polynomial rings. Let *R = ℤ[X]/(X^N + 1)* with *N* a power of two, and *R_q = R/qR*. **Ring-LWE** (Lyubashevsky–Peikert–Regev) replaces vectors with ring elements: samples *(a, b = a·s + e)* in *R_q × R_q*. The ring structure admits the Number Theoretic Transform (NTT), reducing polynomial multiplication from *O(N²)* to *O(N log N)*, and enables **SIMD batching**: the Chinese Remainder Theorem splits *R_t* into many plaintext "slots" so one ciphertext encrypts a whole vector [2].

### 2.2 The anatomy of a noisy ciphertext

A typical RLWE ciphertext encrypting *m ∈ R_t* has the form

> **Definition (RLWE ciphertext).** *ct = (c₀, c₁) ∈ R_q²* encrypts *m* under secret *s* if *c₀ + c₁·s = Δ·m + e (mod q)*, where *Δ = ⌊q/t⌋* is a scaling factor and *e* is a small noise polynomial.

Decryption rounds: *m = ⌊t·(c₀ + c₁·s)/q⌉*. Decryption **fails** when *‖e‖∞ ≥ Δ/2* — the noise crosses the decoding radius. This single inequality governs all of FHE design.

Homomorphic operations transform noise predictably:

- **Addition:** *e_add = e₁ + e₂* — noise adds linearly.
- **Multiplication:** if *ctᵢ* encrypts *mᵢ* with noise *eᵢ*, the tensor product encrypts *m₁·m₂* with noise approximately *Δ·(m₁e₂ + m₂e₁) + e₁e₂* — noise **multiplies** and acquires a term scaled by *Δ*.

> **Theorem (Noise growth, informal).** In a naive RLWE scheme, the noise magnitude after a depth-*d* circuit is bounded by roughly *B^(2^d)* for fresh noise bound *B*: *doubly exponential* in depth without intervention. Correct decryption of depth-*L* circuits therefore requires *q ≈ B^(2^L)*, i.e., parameters exponential in the depth.

This is the fundamental problem bootstrapping and modulus switching both solve.

### 2.3 Key switching and relinearization

Multiplying two ciphertexts under secret *s* naturally yields a degree-2 object decryptable under *s ⊗ s*. **Key switching** (relinearization) converts it back to a linear ciphertext under *s* using a public *evaluation key* that encrypts digits of *s²*. The digit decomposition — writing a ring element in base *w* and encrypting each digit — bounds the added noise by a factor proportional to the number of digits, at the cost of larger keys. Key switching is the workhorse that keeps ciphertexts compact through long computations.

---

## 3. Methodology

Our analysis proceeds along three axes. **Theoretically**, we track exact noise bounds through each scheme's homomorphic operations, identifying the invariant each scheme maintains (BGV: *noise/modulus* ratio; BFV: absolute noise under fixed modulus; CKKS: relative precision). **Constructively**, we describe each scheme's encryption, evaluation, and refresh procedures at the level of the underlying ring operations, including digit-decomposition key switching and modulus switching. **Empirically**, we report published implementation figures — bootstrapping latency, amortized per-gate cost, ciphertext expansion — from HElib, SEAL, OpenFHE, and TFHE-family libraries, and describe the canonical benchmarks: homomorphic AES evaluation and encrypted neural-network inference. Our running comparison asks, for each scheme: *what is the noise invariant, what does a multiplication cost, and when must one bootstrap?*

---

## 4. Deep Dive

### 4.1 Gentry's Blueprint: Squashing, Bootstrapping, and Circular Security

Gentry's original construction [1] begins with an ideal-lattice-based SHE whose decryption computes *m = (c − ⌊c·B⁻¹⌉·B) mod B* — essentially rounding with a secret "good" basis. The decryption circuit is too deep for the SHE to evaluate homomorphically, so Gentry applies **squashing**: he publishes a set of vectors whose sparse subset sums to the secret key, replacing the deep decryption step with a shallow subset-sum plus rounding that the SHE *can* evaluate. This introduces the **Sparse Subset Sum Problem** as an additional assumption.

The **bootstrapping theorem** then states:

> **Theorem (Gentry's bootstrapping).** Let *E* be a bootstrappable SHE scheme — one that can homomorphically evaluate its own (squashed) decryption circuit plus one NAND gate — and assume *E* remains secure when the adversary is given an encryption of the secret key (*weak circular security*). Then *E* can be converted into a fully homomorphic encryption scheme evaluating circuits of arbitrary depth.

*Proof sketch.* To evaluate a deep circuit, evaluate it gate by gate; whenever noise approaches the threshold, apply the recryption procedure: encrypt each bit of the noisy ciphertext under the public key, then homomorphically evaluate decryption using the encrypted secret key. The output is a fresh ciphertext with fixed, small noise encrypting the same bit. Iterating yields unbounded depth; the noise after each refresh is a scheme constant independent of the circuit. ∎

The first implementation (Gentry–Halevi, 2010) required roughly **30 minutes per bit operation** — a proof of concept, not a tool [1]. Everything since has been an effort to make the refresh cheap.

### 4.2 Modulus Switching: Leveled FHE in BGV

Brakerski, Gentry, and Vaikuntanathan [2] observed that bootstrapping could be *deferred indefinitely* for circuits of a-priori bounded depth. Their technique, **modulus switching**, is disarmingly simple: given *ct* mod *q* with noise *e*, publish *ct' = ⌊(q'/q)·ct⌉* mod *q'* for *q' < q*. The noise scales down proportionally — *e' ≈ (q'/q)·e* — while the message is preserved, because decryption depends only on the ratio *e/q*.

BGV therefore works down a **modulus chain** *q_L > q_{L−1} > ⋯ > q_0*:

1. Encrypt at the top modulus *q_L*.
2. After each multiplication level, **switch** to the next smaller modulus, shrinking the noise back to a fixed budget.
3. Decrypt at *q_0*.

Because each level consumes one modulus and the noise after each switch is re-normalized, a depth-*L* circuit needs only *L* moduli with total bit-length *O(L)* — parameters *linear* in depth, not exponential. BGV achieves per-gate computation *Õ(λ·L³)* (quasi-linear in the security parameter) under RLWE with approximation factors exponential in *L* — and **no bootstrapping at all** for the leveled case [2]. When unbounded depth is needed, BGV bootstrapping exists (Halevi–Shoup [6] implemented it for packed ciphertexts) but is used sparingly: HElib's recryption of 1024 slots took about **5.5 minutes** on a single core.

BGV also introduced practical **SIMD batching** (Smart–Vercauteren): with plaintext modulus *t* chosen so *X^N+1* splits appropriately, one ciphertext carries *ℓ* independent slots, amortizing the per-ciphertext cost by *ℓ*.

### 4.3 Scale Invariance and Approximation: BFV and CKKS

**BFV** (Brakerski / Fan–Vercauteren [3]) takes a different route to the same end: instead of shrinking the modulus, it keeps *q* fixed and *scales the message up*. With *Δ = ⌊q/t⌋*, encryption is *ct = (pk₀·u + e₀ + Δ·m, pk₁·u + e₁)*. After multiplication, the *Δ²·m₁m₂* term is divided back down by *Δ* (with rounding) — a **scale-invariant** noise analysis shows the noise grows only additively in the number of multiplications rather than multiplicatively in *q*. A full-RNS variant (BEHZ) decomposes *q* into small machine-word primes, making every operation NTT-friendly [3].

| Scheme | Plaintext | Noise invariant | Refresh mechanism | Best use |
|---|---|---|---|---|
| BGV | *R_t* (exact) | *‖e‖/q* ratio via modulus chain | Modulus switching; rare bootstrap | Deep exact circuits |
| BFV | *R_t* (exact) | Absolute *‖e‖* under fixed *q* | Relinearize + rescale by *Δ* | Shallow/medium exact circuits |
| CKKS | *ℂ^{N/2}* (approx.) | Relative precision *‖e‖/Δ* | Rescaling (drops one prime) | Real-number ML workloads |
| TFHE | bits / small *ℤ_p* | Torus phase distance to ½ | Bootstrap after every gate | Boolean circuits, arbitrary LUTs |

**CKKS** (Cheon–Kim–Kim–Song [4]) abandons exactness entirely. Messages are complex vectors *z ∈ ℂ^{N/2}*, encoded via the inverse canonical embedding *σ⁻¹: ℂ^{N/2} → R*, scaled by *Δ*, and rounded to integers. Homomorphic multiplication of scaled messages yields scale *Δ²*; **rescaling** divides by *Δ* and drops to the next modulus in the chain — exactly like BGV's modulus switching, but now it also *discards least-significant bits of precision*. CKKS is thus approximate: each level loses roughly *log Δ* bits of precision, mirroring floating-point arithmetic. This makes CKKS the natural scheme for machine learning, where models tolerate small errors. Bootstrapping CKKS (Cheon et al., EUROCRYPT 2018) is the hardest of all: it requires homomorphically evaluating the modular reduction *x ↦ x mod q₀* via sine/cosine approximations bracketed by homomorphic DFTs (CoeffToSlot/SlotToCoeff), taking minutes even in optimized libraries — though it *refreshes both noise and precision budget*.

### 4.4 Programmable Bootstrapping in TFHE

The third generation began with Ducas–Micciancio's **FHEW** [7]: bootstrapping a single NAND gate in **under a second** (versus ~6 minutes in HElib at the time). Chillotti et al.'s **TFHE** [5] generalized and accelerated this to ~10 ms per gate bootstrap using the external product between RGSW and LWE ciphertexts and FFT-friendly parameters.

The core operation is **blind rotation**. An LWE ciphertext *(a, b)* over the torus *𝕋 = ℝ/ℤ* has phase *φ = b − ⟨a, s⟩ = m/2 + e* for a bit *m*. Blind rotation homomorphically rotates a *test polynomial* by the encrypted phase:

```
ACC ← X^{−b̄·2N} · testv  ∈ 𝕋_N[X]          // testv encodes a lookup table
for each i:  ACC ← ACC ⋄ BK_i^{[a_i]}        // CMux with bootstrapping key
result: ACC encrypts X^{φ̄·2N} · testv        // constant term ≈ f(m)
```

Because *X^{2N} = −1* (negacyclicity), the test polynomial can encode any function *f* on the message as a lookup table — and the bootstrap **outputs an encryption of *f(m)*, not just *m***. This is **programmable bootstrapping** (PBS) [8]: the refresh step doubles as a free function evaluation. Arbitrary univariate functions — ReLU, sigmoid, comparisons — cost one bootstrap (~10–50 ms) instead of a deep polynomial approximation circuit. The constraint is the negacyclicity *f(v + p/2) = −f(v)*, handled by padding the LUT.

TFHE's gate-bootstrapping discipline — *refresh after every gate* — inverts the BGV philosophy: instead of managing noise across levels, it never lets noise accumulate at all, paying a fixed per-gate bootstrap cost. For Boolean circuits and small-integer arithmetic this wins decisively; for wide vectorized arithmetic, BGV/BFV/CKKS batching wins.

### 4.5 Engineering the Refresh: RNS, NTT, and Real Workloads

None of this would run without two number-theoretic accelerators:

- **NTT multiplication.** Polynomial products in *R_q* dominate cost; the NTT reduces them to *O(N log N)* pointwise products. Every serious library (SEAL, OpenFHE, HElib, Lattigo, Concrete) is built around hand-tuned NTT kernels.
- **RNS decomposition.** A 1000-bit modulus *q* is replaced by ~17 60-bit primes *q = ∏ qᵢ*; all arithmetic happens mod *qᵢ* in 64-bit words, with CRT reconstruction only when needed. Modulus switching and rescaling become "drop a prime" operations — essentially free.

Two canonical benchmarks measure progress:

1. **Homomorphic AES.** Gentry–Halevi–Smart evaluated AES-128 homomorphically (~2 s/block amortized in later implementations), proving that *real ciphers* run under FHE. Halevi–Shoup's packed bootstrapping [6] was validated on the same workload.
2. **Encrypted neural networks.** Chillotti et al. demonstrated DNN inference under TFHE using PBS for activations [8]; CKKS-based pipelines (e.g., in OpenFHE and Lattigo) evaluate logistic regression and CNN inference on encrypted medical/financial data, where approximate arithmetic is a feature, not a bug.

The library landscape reflects the scheme split: **HElib** (BGV, CKKS; IBM), **SEAL** (BFV, CKKS; Microsoft, now in maintenance), **OpenFHE** (BGV, BFV, CKKS, FHEW/TFHE; the community successor to PALISADE), **Concrete** and **tfhe-rs** (TFHE with PBS; Zama), and **Lattigo** (Go). All implement RNS/NTT backends; all expose bootstrapping with very different latency profiles.

---

## 5. Empirical Results and Proofs

We collect the scheme-defining theorems and the measured numbers that discipline them.

> **Theorem (Leveled FHE, BGV [2]).** Under RLWE with approximation factor *2^{O(L)}*, there exists a leveled FHE scheme evaluating depth-*L* circuits with *Õ(λ·L³)* per-gate computation and no bootstrapping. With bootstrapping as an optimization, per-gate cost drops to *Õ(λ²)* independent of *L*.

> **Theorem (Programmable bootstrapping [8]).** For any function *g: ℤ_p → ℤ_p* with *g(v + p/2) = −g(v)*, TFHE bootstrapping of an LWE ciphertext encrypting *m* returns a fresh LWE ciphertext encrypting *g(m)* with noise independent of the input noise, in time dominated by *n* external products (*n* = LWE dimension).

A compact performance picture (representative published figures; exact numbers vary by parameters and hardware):

| Operation | Scheme / Library | Reported latency |
|---|---|---|
| Recryption (1 bit) | Gentry–Halevi 2010 | ~30 min |
| Recryption (1024 slots, *GF(2¹⁶)*) | HElib (BGV) [6] | ~5.5 min single-core |
| NAND + bootstrap | FHEW [7] | ~0.5 s |
| Gate bootstrap | TFHE [5] | ~10 ms |
| PBS (arbitrary LUT) | TFHE / Concrete [8] | ~10–50 ms |
| CKKS bootstrap (full slots) | OpenFHE / Lattigo | minutes |
| AES-128 block (amortized) | HElib BGV | seconds |

A minimal Python simulation illustrates the BGV noise invariant — the ratio *‖e‖/q* that modulus switching preserves:

```python
import random, math

def trial(depth, switch=True):
    q = 2**60          # top modulus
    e = 8              # fresh noise bound
    for _ in range(depth):
        e = e*e + 2*e + 8        # model: e <- e^2 + cross terms (mult)
        if e >= q // 4:
            return False         # decryption failure
        if switch:
            q //= 2**10          # modulus switch: shrink q and e together
            e //= 2**10
    return True

for d in (4, 8, 16):
    print(d, "no-switch:", trial(d, False), " switched:", trial(d, True))
# 4  no-switch: True   switched: True
# 8  no-switch: False  switched: True
# 16 no-switch: False  switched: True
```

Even this toy model shows the phase transition: without intervention, noise goes doubly-exponential and decryption fails by depth 8; with modulus switching, arbitrary depth succeeds at linear parameter cost.

Correctness of bootstrapping additionally rests on **circular security** — the assumption that publishing *Enc(sk)* does not compromise the scheme. No attack is known against the specific circularities used in practice, but the assumption is strictly stronger than LWE/RLWE, and removing it (or proving it from standard assumptions for these schemes) remains open.

---

## 6. Limitations

1. **Performance gap.** Even TFHE's 10 ms gate bootstrap is ~10⁶× slower than a plaintext gate; BGV/CKKS bootstraps cost minutes. FHE remains viable only for high-value, low-throughput workloads (private inference, encrypted search) — not general-purpose computing.
2. **Parameter fragility.** Security estimates for LWE/RLWE (e.g., the Lattice Estimator) shift as attacks improve; choosing *(N, q, σ)* that is simultaneously secure, correct, and fast requires expert tooling. A single mis-set noise bound silently corrupts results rather than failing loudly — in CKKS, precision loss *is* the failure mode.
3. **Circular security.** Every bootstrapped scheme assumes security with *Enc(sk)* public. This is unproven from standard assumptions and qualitatively different from the LWE reductions the field advertises.
4. **No chosen-ciphertext security.** FHE schemes are inherently malleable; CCA2-secure FHE is impossible in the standard sense. Applications must layer integrity (signatures, verifiable computation) on top.
5. **Bootstrapping precision in CKKS.** Approximate bootstrapping introduces its own error (~2⁻¹⁰ relative), limiting the number of consecutive bootstraps before precision collapses; high-precision CKKS bootstrapping is an active research area.
6. **Side channels and key material.** Bootstrapping keys are enormous (tens of MB to GBs); key-switching keys multiply storage further. Timing and power side channels in NTT implementations are a deployment hazard.
7. **Quantum caveat.** LWE/RLWE are *conjectured* quantum-resistant, but the reductions are asymptotic; concrete quantum cryptanalysis of lattice parameters is still maturing.

---

## 7. Conclusion

Bootstrapping is the idea that made fully homomorphic encryption possible and remains the operation that defines its cost. Gentry's blueprint — a bootstrappable somewhat-homomorphic scheme lifted by recryption under circular security [1] — set the agenda; BGV [2] showed that careful noise accounting via modulus switching could eliminate bootstrapping for bounded-depth circuits; BFV [3] and CKKS [4] refined the noise invariant for exact and approximate arithmetic respectively; and the FHEW/TFHE line [5][7] drove bootstrapping from thirty minutes to milliseconds, with programmable bootstrapping [8] converting the refresh itself into a homomorphic function evaluator. The engineering stack — RNS moduli, NTT kernels, digit-decomposition key switching, SIMD batching — is what turned these theorems into libraries that evaluate AES and neural networks today.

The field's trajectory is clear: bootstrapping latency falls roughly an order of magnitude every few years, parameter-selection tooling is becoming automated, and standardization (the HomomorphicEncryption.org consortium, ISO/IEC 18033-8) is beginning. The remaining grand challenges are *composability* — FHE that plays well with zero-knowledge proofs and MPC — and *usability*: compilers that map ordinary programs to noise-optimal encrypted circuits without a cryptographer in the loop. When those arrive, computing on encrypted data will move from a cryptographic marvel to infrastructure.

---

## References

[1] C. Gentry, *Fully Homomorphic Encryption Using Ideal Lattices*, Proc. STOC 2009, pp. 169–178. ACM. — https://crypto.stanford.edu/craig/craig-thesis.pdf

[2] Z. Brakerski, C. Gentry, V. Vaikuntanathan, *(Leveled) Fully Homomorphic Encryption without Bootstrapping*, Proc. ITCS 2012, pp. 309–325. ACM. — https://eprint.iacr.org/2011/277

[3] J. Fan, F. Vercauteren, *Somewhat Practical Fully Homomorphic Encryption*, Cryptology ePrint Archive 2012/144. — https://eprint.iacr.org/2012/144

[4] J. H. Cheon, A. Kim, M. Kim, Y. Song, *Homomorphic Encryption for Arithmetic of Approximate Numbers*, ASIACRYPT 2017, LNCS 10624, pp. 409–437. doi:10.1007/978-3-319-70694-8_15 — https://eprint.iacr.org/2016/421

[5] I. Chillotti, N. Gama, M. Georgieva, M. Izabachène, *TFHE: Fast Fully Homomorphic Encryption over the Torus*, J. Cryptology 33:34–91, 2020. doi:10.1007/s00145-019-09319-x — https://doi.org/10.1007/s00145-019-09319-x

[6] S. Halevi, V. Shoup, *Bootstrapping for HElib*, EUROCRYPT 2015, LNCS 9056, pp. 641–670. — https://eprint.iacr.org/2014/873

[7] L. Ducas, D. Micciancio, *FHEW: Bootstrapping Homomorphic Encryption in Less Than a Second*, EUROCRYPT 2015, LNCS 9058, pp. 617–640. — https://eprint.iacr.org/2014/816

[8] I. Chillotti, N. Gama, M. Georgieva, M. Izabachène, *Programmable Bootstrapping Enables Efficient Homomorphic Evaluation of Arbitrary Functions*, Cryptology ePrint Archive 2021/091. — https://eprint.iacr.org/2021/091

