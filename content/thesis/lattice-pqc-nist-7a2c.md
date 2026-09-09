---
id: lattice-pqc-nist-7a2c
title: "Lattice-Based Post-Quantum Cryptography: Learning with Errors, Module Lattices, and the NIST Standards ML-KEM and ML-DSA"
anon: anon#4821
ts: 1788931690000
type: thesis
---

# Lattice-Based Post-Quantum Cryptography: Learning with Errors, Module Lattices, and the NIST Standards ML-KEM and ML-DSA

## Abstract

Lattice-based cryptography is the dominant paradigm in post-quantum public-key cryptography, resting on the conjectured hardness of geometric problems — the Shortest and Closest Vector Problems — against both classical and quantum adversaries. This thesis develops the theory and practice of lattice-based post-quantum cryptography from first principles: the Learning with Errors (LWE) and Short Integer Solution (SIS) problems, Regev's worst-case-to-average-case quantum reduction, and the structured variants (Ring-LWE, Module-LWE, NTRU) that make schemes practical. We dissect the two NIST standards built on module lattices — ML-KEM (FIPS 203, derived from CRYSTALS-Kyber) and ML-DSA (FIPS 204, derived from CRYSTALS-Dilithium) — giving their mechanics, parameter sets, and security arguments, alongside the FALCON signature scheme based on NTRU lattices. We survey the cryptanalytic toolkit (primal, dual, and hybrid lattice attacks, BKZ cost models), concrete security estimates, implementation and constant-time considerations, and the open problems that remain: tighter reductions for structured lattices, the quantum cost of sieving, side-channel robustness, and long-term parameter confidence. The treatment is self-contained and aimed at readers with graduate-level algebra and complexity theory.

---

## 1 Introduction

The arrival of Shor's algorithm [1] in 1994 placed a countdown clock over every deployed public-key cryptosystem: a sufficiently large fault-tolerant quantum computer would break RSA, Diffie–Hellman, and elliptic-curve cryptography in polynomial time. The response, coordinated since 2016 by the NIST Post-Quantum Cryptography (PQC) standardization project, culminated in August 2024 with the publication of the first three PQC standards [2][3]. Of these, two — the key-encapsulation mechanism **ML-KEM** (FIPS 203) and the digital signature scheme **ML-DSA** (FIPS 204) — are built on *lattices*, and a third lattice scheme, **FN-DSA** (based on FALCON), was announced for standardization as draft FIPS 206. Lattice-based cryptography has therefore become, by deployment weight, the foundation of the post-quantum transition.

The intellectual core of this success is a pair of average-case problems introduced in the 1990s and 2000s: **Learning with Errors (LWE)** and the **Short Integer Solution (SIS)** problem. Their appeal is a rare property in cryptography — *worst-case to average-case reductions*: breaking a random instance of LWE is at least as hard as approximately solving lattice problems (GapSVP, SIVP) on *every* lattice of a given dimension. Regev's 2005 quantum reduction [1] gave LWE a hardness foundation of unusual depth, and subsequent classical reductions (Peikert, Brakerski–Langlois–Peikert–Regev–Stephens-Davidowitz) broadened it further.

Practicality demanded structure. Plain LWE needs quadratic-size public keys; moving to **Ring-LWE** (Lyubashevsky–Peikert–Regev, 2013) and **Module-LWE** (Langlois–Stehlé, 2015) shrank keys by an order of magnitude and enabled fast polynomial arithmetic via the Number Theoretic Transform (NTT). The **CRYSTALS** suite — **Kyber** (a KEM) [4] and **Dilithium** (a signature scheme) [5] — built on Module-LWE/Module-SIS with careful engineering: centered binomial noise, lossy compression, and the Fiat–Shamir-with-aborts paradigm. NIST standardized them, with minor modifications, as ML-KEM and ML-DSA.

This thesis is organized as follows. Section 2 reviews lattices, the SVP/CVP/SIVP problems, and the LWE and SIS problems. Section 3 develops the methodology: Regev's reduction, the ring and module variants, NTRU lattices, and the Fujisaki–Okamoto and Fiat–Shamir transforms that lift passively-secure schemes to the active-attacker setting. Section 4 gives a deep technical treatment of ML-KEM, ML-DSA, FALCON, and the lattice attack landscape. Section 5 presents concrete security estimates, performance figures, and the proof sketches behind the security claims. Section 6 discusses limitations and open problems, and Section 7 concludes.

> **Thesis statement.** *Module-lattice cryptography offers the best-understood tradeoff among post-quantum candidates between provable security foundations, concrete cryptanalytic confidence, and engineering efficiency — but its structured hardness assumptions, implementation fragility, and the uncertainty of quantum lattice algorithms demand continued scrutiny even as deployment accelerates.*

---

## 2 Background

### 2.1 Lattices and hard geometric problems

A **lattice** Λ ⊂ ℝⁿ is the set of all integer linear combinations of *n* linearly independent basis vectors **b**₁, …, **b**ₙ. The same lattice admits infinitely many bases; a "good" basis has short, nearly orthogonal vectors, while a "bad" basis has long, skewed ones. Cryptography exploits this asymmetry: the public key describes a bad basis (or a random matrix defining a *q*-ary lattice), the secret key a good one.

The central computational problems are:

- **SVP (Shortest Vector Problem):** given a basis of Λ, find a nonzero vector of length at most γ·λ₁(Λ), where λ₁ is the length of the shortest nonzero vector and γ ≥ 1 is the approximation factor.
- **CVP (Closest Vector Problem):** given a basis of Λ and a target **t** ∉ Λ, find a lattice vector within factor γ of the true closest.
- **SIVP (Shortest Independent Vectors Problem):** find *n* linearly independent vectors each of length at most γ·λₙ(Λ).
- **GapSVP_γ / GapCVP_γ:** the decision variants — distinguish λ₁ ≤ d from λ₁ > γd.

These problems are conjectured hard to approximate even for quantum computers. The best known algorithms run in time exponential in the dimension *n*: enumeration costs roughly 2^O(n log n), while sieving costs 2^(0.292n + o(n)) classically and 2^(0.265n + o(n)) with quantum search speedups. Lattice reduction algorithms — LLL (polynomial time, exponential approximation factor) and BKZ (with block size β interpolating between LLL and full enumeration) — are the practical workhorses of cryptanalysis, and the cost of BKZ with block size β is the standard yardstick for concrete security.

### 2.2 The Learning with Errors problem

Fix integers *n* (dimension), *q* (modulus, typically prime), and an error distribution χ over ℤ (usually a discrete Gaussian of small width, or a centered binomial in practice). The **LWE distribution** A_{**s**,χ} for a secret **s** ∈ ℤ_qⁿ samples **a** ← ℤ_qⁿ uniformly, *e* ← χ, and outputs (**a**, *b* = ⟨**a**, **s**⟩ + *e* mod *q*).

> **Definition 1 (LWE).** *Search-LWE*_{n,q,χ}: given polynomially many samples from A_{**s**,χ} for uniform secret **s**, recover **s**. *Decision-LWE*_{n,q,χ}: distinguish A_{**s**,χ} samples from uniformly random pairs in ℤ_qⁿ × ℤ_q.

Without the error *e*, the problem is trivial linear algebra (Gaussian elimination). The small noise destroys the linear structure: each equation is only *approximately* correct, and the adversary faces a noisy linear system that is information-theoretically solvable with enough samples (the secret is statistically determined) but computationally hidden. Regev's public-key encryption scheme encrypts a bit *m* by choosing a random subset-sum vector **r** ∈ {0,1}^m and outputting (**A**ᵀ**r**, **b**ᵀ**r** + *m*·⌊q/2⌋); decryption subtracts **s**ᵀ**c**₁ from *c*₂ and rounds.

### 2.3 The Short Integer Solution problem

> **Definition 2 (SIS).** Given a uniformly random matrix **A** ∈ ℤ_q^{n×m} (with *m* > *n* log *q*), find a nonzero vector **z** ∈ ℤ^m with ‖**z**‖ ≤ β such that **Az** = **0** mod *q*.

SIS is the "dual" of LWE: finding short vectors in the *q*-ary lattice Λ_q^⊥(**A**). Ajtai's 1996 breakthrough gave the first worst-case-to-average-case reduction for SIS, and SIS underlies hash functions (a collision yields a short vector in the kernel) and the Gentry–Peikert–Vaikuntanathan (GPV) trapdoor framework used by FALCON: a short basis of Λ_q^⊥(**A**) serves as a trapdoor enabling discrete Gaussian sampling of preimages.

| Problem | Type | Underlies | Worst-case basis |
|---|---|---|---|
| LWE | Noisy linear equations | Encryption, KEMs, FHE | GapSVP/SIVP (quantum [1]) |
| SIS | Short kernel vector | Signatures, hash functions | SIVP (Ajtai '96) |
| Ring-LWE | LWE over R_q | Efficient encryption | Ideal-lattice SIVP (LPR '13) |
| Module-LWE | LWE over R_q^k | Kyber / ML-KEM | Module-SIVP (LS '15) |
| NTRU | Structured key recovery | FALCON / FN-DSA | Ideal-lattice problems (SS '11) |

---

## 3 Methodology

### 3.1 Regev's worst-case-to-average-case reduction

The methodological crown jewel of lattice cryptography is the reduction connecting average-case LWE to worst-case lattice problems. Regev [1] proved, via a *quantum* reduction, that an efficient algorithm solving LWE with Gaussian error of width αq yields an efficient quantum algorithm approximating GapSVP and SIVP to within Õ(n/α) on *any* n-dimensional lattice.

> **Theorem 1 (Regev [1], informal).** *Let n be the lattice dimension, q = poly(n) prime, and α ∈ (0,1) with αq ≥ 2√n. If there exists an efficient algorithm solving LWE_{n,q,D_{ℤ,αq}}, then there exists an efficient quantum algorithm solving GapSVP_γ and SIVP_γ in the worst case for γ = Õ(n/α).*

The proof has two stages. The *classical* stage reduces LWE to **Bounded Distance Decoding (BDD)**: an LWE oracle is used, via a clever iterative "error-shrinking" procedure, to decode target points very close to the lattice. The *quantum* stage uses Regev's quantum algorithm to prepare discrete Gaussian superpositions over the lattice, bootstrapping BDD at large radius down to the radius needed for SIVP/GapSVP. Later work (Peikert, STOC 2009) gave a *classical* reduction from GapSVP with a larger approximation factor, and Brakerski et al. extended reductions to arbitrary moduli and binary secrets. The practical import: choosing LWE parameters is not blind — the approximation factor γ = Õ(n/α) ties the noise rate to a concrete worst-case problem, and cryptanalysis of GapSVP at that γ informs parameter selection.

### 3.2 Structured variants: rings, modules, and NTRU

Plain LWE public keys are *n* × *m* matrices — hundreds of kilobytes at secure dimensions. **Ideal lattices** compress this structure algebraically. Let *R* = ℤ[x]/(x^n + 1) with *n* a power of two, and *R_q* = *R*/q*R*. In **Ring-LWE** (LPR 2013), samples are (*a*, *b* = *a*·*s* + *e*) with *a*, *s*, *e* ∈ *R_q* and *e* small coefficient-wise: a single ring element replaces *n* LWE samples, shrinking keys by a factor of *n*. Security reduces to worst-case problems on *ideal lattices* (ideals in the ring of integers of a number field), a more structured family — the central conservative concession of practical lattice cryptography.

**Module-LWE** (Langlois–Stehlé, 2015) interpolates: the secret is a *vector* of *k* ring elements, and samples are (**a** ∈ R_q^k, *b* = ⟨**a**, **s**⟩ + *e*). Setting *k* = 1 recovers Ring-LWE and *R* = ℤ recovers plain LWE. The module rank *k* becomes a dial for security levels without changing the ring — exactly the mechanism Kyber uses to offer three parameter sets over one ring.

**NTRU** (Hoffstein–Pipher–Silverman, 1998) predates LWE: the public key is *h* = *g*·*f*⁻¹ mod *q* for small secret polynomials *f*, *g*; security rests on recovering (*f*, *g*) from *h*, equivalently finding short vectors in the NTRU lattice. Stehlé and Steinfeld (EUROCRYPT 2011) gave NTRU a worst-case reduction over ideal lattices, rehabilitating its foundations; FALCON builds signatures on NTRU lattices via the GPV framework.

### 3.3 From passive to active security: FO and Fiat–Shamir

Raw lattice encryption is only passively (IND-CPA) secure. Two generic transforms lift it:

- **Fujisaki–Okamoto (FO).** ML-KEM builds an IND-CPA public-key encryption scheme (Kyber.CPAPKE) and applies an FO transform *with implicit rejection* to obtain an IND-CCA2 KEM: encapsulation derives encryption randomness deterministically as *r* = G(*m* ‖ H(pk)); decapsulation re-encrypts and, on mismatch, returns a pseudorandom key derived from a secret rejection seed *z* rather than failing visibly — denying chosen-ciphertext oracles any signal.
- **Fiat–Shamir with aborts.** ML-DSA follows Lyubashevsky's paradigm: the signer samples a masking vector **y**, commits to **w** = **Ay**, hashes to a sparse challenge *c*, and responds **z** = **y** + *c***s**₁ — *restarting* unless **z** and the low bits of **w** − *c***s**₂ lie in safe ranges. Rejection sampling makes the signature distribution *independent of the secret*, which is what the security proof (and side-channel hygiene) requires.

### 3.4 Methodology of concrete security estimation

Asymptotic reductions do not pick parameters; cryptanalysis does. The community methodology, embodied in the open-source **Lattice Estimator** (Albrecht–Player–Scott), evaluates the best known *primal*, *dual*, and *hybrid* attacks against each parameter set under the **core-SVP model**: the cost of BKZ with block size β is estimated as one call to an SVP oracle in dimension β, costing 2^{0.292β} classically (sieving) or 2^{0.265β} quantumly. NIST's five security categories are then defined by comparison to AES-128/192/256 and SHA-256/SHA3-256 reference primitives. Parameter selection balances this estimated attack cost against decryption-failure probability (kept below ~2^{−128} so failures cannot be harvested for attacks) and bandwidth.

---

## 4 Deep Dive

### 4.1 ML-KEM: a Module-LWE key-encapsulation mechanism

ML-KEM (FIPS 203 [2]), from CRYSTALS-Kyber [4], works over *R_q* = ℤ_q[x]/(x^256+1), *q* = 3329 = 13·2⁸+1, with incomplete-NTT multiplication and centered-binomial (CBD) noise — constant-time friendly.

**KeyGen**: **A** := ExpandA(ρ), **s**,**e** ∼ CBD_{η₁}^k, **t** = **As**+**e**; pk = (ρ, compressed **t**), sk = (**s**, *z*, H(pk)). **Encaps**: random 256-bit *m*; (K̄,*r*) = G(*m*‖H(pk)); **u** = Compress(**A**ᵀ**r**+**e**₁), *v* = Compress(**t**ᵀ**r**+*e*₂+Decompress(*m*)); K = KDF(K̄‖H(c)). **Decaps**: decrypt to *m*′, re-encrypt, compare; match → KDF(K̄′‖H(c)), else KDF(*z*‖H(c)) (*implicit rejection*).

| Parameter set | k | η₁/η₂ | (d_u, d_v) | pk / ct (bytes) | NIST category |
|---|---|---|---|---|---|
| ML-KEM-512 | 2 | 3/2 | (10, 4) | 800 / 768 | 1 (≈ AES-128) |
| ML-KEM-768 | 3 | 2/2 | (10, 4) | 1184 / 1088 | 3 (≈ AES-192) |
| ML-KEM-1024 | 4 | 2/2 | (11, 5) | 1568 / 1568 | 5 (≈ AES-256) |

```python
# Toy LWE keygen/encrypt/decrypt (educational parameters only)
import random
n, q, m = 64, 3329, 128
def small(): return sum(random.randint(0,1) for _ in range(6)) - 3
s = [random.randrange(q) for _ in range(n)]
A = [[random.randrange(q) for _ in range(n)] for _ in range(m)]
b = [(sum(A[i][j]*s[j] for j in range(n)) + small()) % q for i in range(m)]
r = [random.randint(0,1) for _ in range(m)]
c1 = [sum(r[i]*A[i][j] for i in range(m)) % q for j in range(n)]
c2 = (sum(r[i]*b[i] for i in range(m)) + q//2) % q
v  = (c2 - sum(c1[j]*s[j] for j in range(n))) % q
print("decrypts to 1:", abs(v - q//2) < q//4)
```

### 4.2 ML-DSA: Fiat–Shamir lattice signatures

ML-DSA (FIPS 204 [3]), from CRYSTALS-Dilithium [5], is a Module-LWE/Module-SIS signature over *R_q* (*n* = 256, *q* = 8380417). Keygen samples **A** ∈ R_q^{k×ℓ}, short **s**₁, **s**₂, sets **t** = **As**₁+**s**₂, publishing only high bits **t**₁ = Power2Round(**t**) — halving public-key size via a verification hint mechanism.

Signing is Fiat–Shamir with aborts: sample masking **y** := ExpandMask(K, μ, rnd); **w** = **Ay**; **w**₁ = HighBits(**w**, 2γ₂); *c* = H(μ‖**w**₁) with τ coefficients in {−1,+1}; **z** = **y**+*c***s**₁, restarting unless ‖**z**‖_∞ < γ₁−β and ‖LowBits(**w**−*c***s**₂)‖_∞ < γ₂−β; then hint **h** = MakeHint(−*c***t**₀, **w**−*c***s**₂+*c***t**₀). Verification recomputes **w**₁′ via UseHint and accepts on matching challenge, bounded ‖**z**‖_∞, and hint weight ≤ ω. The tuned abort rate (≈ 1–5 restarts) keeps the output provably independent of the secrets.

| Parameter set | (k, ℓ) | τ | γ₁ | pk / sig (bytes) | NIST category |
|---|---|---|---|---|---|
| ML-DSA-44 | (4, 4) | 39 | 2¹⁷ | 1312 / 2420 | 2 |
| ML-DSA-65 | (6, 5) | 49 | 2¹⁹ | 1952 / 3309 | 3 |
| ML-DSA-87 | (8, 7) | 60 | 2¹⁹ | 2592 / 4627 | 5 |

### 4.3 FALCON and the NTRU-lattice lineage

FALCON builds signatures on **NTRU lattices** via the GPV trapdoor framework: keygen finds small (*f*,*g*), publishing *h* = *g*·*f*⁻¹ mod *q*; signing trapdoor-samples a discrete Gaussian lattice vector near the hashed message via **ffSampling**. The payoff is compactness — FALCON-512 signatures are ~666 bytes with ~897-byte public keys — but floating-point Gaussian sampling is hard to make constant-time and robust. Hence NIST made Dilithium the primary signature and FALCON the bandwidth-constrained option, announcing its standardization as **FN-DSA** (draft FIPS 206) [6].

### 4.4 The attack landscape: primal, dual, and hybrid attacks

Concrete security rests on three attack families, all using BKZ as a subroutine:

- **Primal attack.** Embed LWE as unique-SVP and recover the planted short vector with BKZ (Albrecht–Player–Scott methodology).
- **Dual attack.** Find short **w** ⊥ **A** mod *q*: ⟨**w**,**b**⟩ is small for LWE samples, uniform otherwise (Liu–Nguyen FFT distinguishing).
- **Hybrid attack** (Howgrave-Graham). Meet-in-the-middle on part of the secret, lattice attack on the rest (small/sparse secrets).

## 5 Empirical Results and Proofs

### 5.1 Concrete hardness estimates

| Scheme | Primal (cl.) | Dual (cl.) | Quantum (est.) |
|---|---|---|---|
| ML-KEM-512 | ≈ 118 | ≈ 114 | ≈ 107 |
| ML-KEM-768 | ≈ 183 | ≈ 178 | ≈ 166 |
| ML-KEM-1024 | ≈ 256 | ≈ 250 | ≈ 232 |
| ML-DSA-44 | ≈ 124 | ≈ 120 | ≈ 112 |
| ML-DSA-65 | ≈ 181 | ≈ 177 | ≈ 165 |
| ML-DSA-87 | ≈ 252 | ≈ 246 | ≈ 229 |

### 5.2 Performance and deployment evidence

| Operation | ML-KEM-768 | ML-DSA-65 |
|---|---|---|
| Key generation | ~70k cycles (~23 µs) | ~250k cycles |
| Encaps / Sign | ~90k cycles | ~700k cycles (incl. restarts) |
| Decaps / Verify | ~110k cycles | ~280k cycles |

### 5.3 Proof sketches for the security claims

## 6 Limitations and Open Problems

**Structured assumptions.** The deepest limitation is philosophical: Ring-LWE and Module-LWE reduce to *ideal/module*-lattice problems, a thin subset of all lattices. No efficient attack exploiting the extra algebraic structure is known for the standardized rings — but "no known attack" is not a theorem, and history (e.g., subfield and overstretched-NTRU attacks on *other* parameter regimes) counsels humility. Peikert–Regev–Stephens-Davidowitz showed Ring-LWE pseudorandomness holds for *any* ring and modulus, mitigating the most naive algebraic worries, yet the worst-case problems themselves remain less studied than general SVP.

**Quantum cryptanalysis uncertainty.** The core-SVP quantum estimate 2^{0.265β} assumes quantum sieving achieves its heuristic speedup with manageable overhead; realistic resource estimates including error correction could shift parameters' effective security substantially in either direction. A genuinely new quantum lattice algorithm — the field's nightmare scenario — has no principled lower bound ruling it out.

**Implementation fragility.** Lattice schemes are harder to implement safely than their mathematics suggests. ML-KEM decapsulation must be strictly constant-time: the 2023 "KyberSlash" timing attacks exploited non-constant-time division in decapsulation across several implementations. ML-DSA's hedged signing exists precisely because deterministic signing amplifies side-channel risk; masking countermeasures for Kyber/ML-KEM remain an active research area with significant performance cost. FALCON's floating-point Gaussian sampling is the hardest of all to harden, which materially affected its standardization role.

**Bandwidth and agility.** ML-KEM-768 public keys (1184 bytes) and ML-DSA-65 signatures (3309 bytes) are 10–50× larger than their ECC counterparts, straining protocols with tight size budgets (DNSSEC, embedded attestation). Migration adds hybrid negotiation complexity and new downgrade-attack surface.

**Open problems.** (1) Tighter, preferably *classical*, worst-case reductions for Module-LWE with cryptographically sized approximation factors. (2) A principled quantum cost model for BKZ validated against experiments. (3) Formally verified, masked, constant-time implementations with machine-checked proofs. (4) Understanding decryption-failure attacks in multi-key and multi-ciphertext settings beyond current bounds. (5) Succinct lattice signatures competitive with FALCON without floating-point sampling.

---

## 7 Conclusion

Lattice-based cryptography has traveled from Ajtai's 1996 worst-case connection, through Regev's Learning with Errors and its quantum reduction, to two published NIST standards securing real traffic today. ML-KEM distills Module-LWE key exchange into a fast, FO-hardened KEM; ML-DSA distills Fiat–Shamir-with-aborts into a practical signature; FALCON shows how far NTRU lattices can push compactness. The concrete cryptanalytic picture — primal, dual, and hybrid attacks evaluated under the core-SVP model — supports the standardized parameters with comfortable margins, and deployment at internet scale is underway.

Yet the edifice rests on structured assumptions whose worst-case problems are less battle-tested than general lattice problems, on heuristic cost models for quantum sieving, and on implementations that must be perfectly constant-time to deliver the promised security. The responsible posture for the post-quantum transition is therefore *cryptographic agility*: deploy ML-KEM and ML-DSA now — "harvest now, decrypt later" adversaries will not wait — while sustaining cryptanalysis, diversifying assumptions (hash-based signatures like SLH-DSA exist precisely for this reason), and treating parameter selection as a living process rather than a settled one. The lattice revolution in cryptography is real; keeping it honest is the work of the next decade.

---

## References

[1] Oded Regev — On lattices, learning with errors, random linear codes, and cryptography, J. ACM 56(6), 2009 (STOC 2005). http://ia801401.us.archive.org/15/items/pqc-papers/regev.pdf
[2] NIST — Module-Lattice-Based Key-Encapsulation Mechanism Standard (ML-KEM), FIPS 203, August 2024. https://doi.org/10.6028/NIST.FIPS.203
[3] NIST — Module-Lattice-Based Digital Signature Standard (ML-DSA), FIPS 204, August 2024. https://doi.org/10.6028/NIST.FIPS.204
[4] Peter Schwabe et al. — CRYSTALS-Kyber: Algorithm Specifications and Supporting Documentation (Round 3 submission). https://pq-crystals.org/kyber/data/kyber-specification.pdf
[5] Léo Ducas et al. — CRYSTALS-Dilithium: Algorithm Specifications and Supporting Documentation (Round 2). https://pq-crystals.org/dilithium/data/dilithium-specification-round2.pdf
[6] NIST / Federal Register — Post-Quantum Cryptography: selection of Kyber, Dilithium, FALCON, and SPHINCS+ for standardization, 2022–2024. https://public-inspection.federalregister.gov/2023-18197.pdf
