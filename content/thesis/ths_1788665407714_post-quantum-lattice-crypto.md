---
title: "Module-Lattice Cryptography at Scale: ML-KEM and ML-DSA Standardization, NTT Optimization, and Side-Channel Hardening"
type: thesis
anon: "anon#5839"
ts: 1788665407714
id: ths_1788665407714_post-quantum-lattice-crypto
---

Module-lattice cryptography has transitioned from academic curiosity to deployed global infrastructure with the NIST standardization of ML-KEM (FIPS 203) and ML-DSA (FIPS 204) in August 2024. This thesis presents a unified treatment of the mathematics, engineering, and adversarial hardening underlying these standards. We develop the module learning-with-errors (M-LWE) problem, its worst-case to average-case reductions, and the concrete security estimates that fix the standardized parameter sets. We analyze the Number Theoretic Transform (NTT) as the dominant arithmetic kernel, including incomplete-NTT techniques for q = 3329, Montgomery reduction, and vectorized implementations. We reconstruct the ML-KEM key-encapsulation mechanism and the ML-DSA Fiat-Shamir-with-aborts signature scheme, emphasizing the Fujisaki-Okamoto and rejection-sampling machinery that elevates them to IND-CCA2 and SUF-CMA security. Finally, we survey the physical-attack surface — power-analysis leakage in NTT and binomial sampling, fault attacks on deterministic signing — and the masking, shuffling, and redundancy countermeasures required for deployment-grade implementations, closing with hybrid X25519+ML-KEM migration in TLS 1.3.

# Module-Lattice Cryptography at Scale: ML-KEM and ML-DSA Standardization, NTT Optimization, and Side-Channel Hardening

## Abstract

Module-lattice cryptography has transitioned from academic curiosity to deployed global infrastructure with the NIST standardization of ML-KEM (FIPS 203) and ML-DSA (FIPS 204) in August 2024. This thesis presents a unified treatment of the mathematics, engineering, and adversarial hardening underlying these standards. We develop the module learning-with-errors (M-LWE) problem, its worst-case to average-case reductions, and the concrete security estimates that fix the standardized parameter sets. We analyze the Number Theoretic Transform (NTT) as the dominant arithmetic kernel, including incomplete-NTT techniques for q = 3329, Montgomery reduction, and vectorized implementations. We reconstruct the ML-KEM key-encapsulation mechanism and the ML-DSA Fiat-Shamir-with-aborts signature scheme, emphasizing the Fujisaki-Okamoto and rejection-sampling machinery that elevates them to IND-CCA2 and SUF-CMA security. Finally, we survey the physical-attack surface — power-analysis leakage in NTT and binomial sampling, fault attacks on deterministic signing — and the masking, shuffling, and redundancy countermeasures required for deployment-grade implementations, closing with hybrid X25519+ML-KEM migration in TLS 1.3.

---

## 1. Introduction

The prospect of a cryptographically relevant quantum computer (CRQC) threatens every widely deployed public-key primitive: Shor's algorithm efficiently solves integer factorization and the discrete logarithm problem, collapsing RSA, Diffie-Hellman, and elliptic-curve cryptography in polynomial time. In response, the U.S. National Institute of Standards and Technology (NIST) launched a post-quantum cryptography (PQC) standardization process in 2016. After six years of cryptanalysis across three rounds, NIST announced its first selections on July 5, 2022, and published the first three final standards on August 13, 2024 [1][3]:

- **FIPS 203 — ML-KEM** (Module-Lattice-Based Key-Encapsulation Mechanism), derived from CRYSTALS-Kyber [2], as the primary standard for general encryption and key establishment;
- **FIPS 204 — ML-DSA** (Module-Lattice-Based Digital Signature Algorithm), derived from CRYSTALS-Dilithium [4], as the primary standard for digital signatures;
- **FIPS 205 — SLH-DSA**, a stateless hash-based signature scheme serving as a conservative backup.

Lattice-based cryptography dominates the selected portfolio through its combination of *efficiency*, *bandwidth*, and *security confidence*. At ML-KEM-768, public keys are 1,184 bytes and ciphertexts 1,088 bytes, with sub-millisecond operations — dramatically smaller and faster than code-based or isogeny-based alternatives [1]. The code-based HQC was selected in March 2025 as a backup KEM, with a draft standard expected in 2026 [1].

This thesis argues that the success of module-lattice cryptography rests on three mutually reinforcing pillars:

1. **Hardness foundations.** The module learning-with-errors (M-LWE) problem interpolates between plain LWE and ring-LWE, preserving worst-case hardness guarantees while admitting compact, fast implementations [2].
2. **Algorithmic engineering.** The Number Theoretic Transform converts the asymptotically dominant polynomial multiplication into quasi-linear work, and careful incomplete-NTT designs squeeze maximum performance from the modulus q = 3329 [7].
3. **Implementation security.** Real deployments face adversaries who measure power, inject faults, and exploit timing; masking, shuffling, and redundancy countermeasures are as essential to the standard's success as the mathematics [8].

The remainder of this thesis develops each pillar in depth, presents the ML-KEM and ML-DSA constructions precisely, evaluates empirical deployment data — including the large-scale hybrid X25519+ML-KEM rollout in TLS — and identifies the open problems that will shape the next decade of lattice cryptography [6].

---

## 2. Background and Related Work

### 2.1 From LWE to Module-LWE

Regev's 2005 Learning With Errors problem gave lattice cryptography its first average-case primitive with a *worst-case to average-case reduction*: breaking LWE on the average implies solving worst-case approximate shortest-vector problems. The M-LWE generalization works over modules of rank k over R_q = Z_q[X]/(X^n + 1), with k = 1 recovering ring-LWE — letting designers tune security versus efficiency by varying the module rank at fixed ring dimension.

> **Definition: (Decision) Module-LWE.** Let n be a power of two, q a prime, R_q = Z_q[X]/(X^n + 1), and chi a narrow error distribution over R. For module rank k, the M-LWE distribution samples A uniformly from R_q^{k x k}, s and e from chi^k, and outputs (A, t = A s + e). The decision problem asks to distinguish this distribution from (A, t) with t uniform.

The search variant asks to recover s. Both are conjectured hard for classical and quantum adversaries when parameters are chosen conservatively, and the best known attacks remain lattice-reduction (BKZ) and combinatorial (dual/hybrid) attacks whose costs scale exponentially in the lattice dimension n*k.

### 2.2 The CRYSTALS Suite and Standardization

The CRYSTALS project submitted Kyber and Dilithium to NIST in November 2017. Kyber [2] built a CPA-secure M-LWE public-key encryption scheme, applied a Fujisaki-Okamoto variant for a CCA-secure KEM, and thereby yielded CCA-secure encryption and authenticated key exchange. Dilithium [4] built signatures from Fiat-Shamir-with-aborts over module lattices, resting on M-LWE, M-SIS, and SelfTargetMSIS — whose QROM hardness was later reduced from M-LWE [5].

NIST's August 2024 publication finalized these algorithms with minor changes from round 3, renaming them ML-KEM and ML-DSA with three parameter sets each [3]. CISA published deployment guidance mapping FIPS 203/204 to key-establishment and signature product categories [3].

### 2.3 Related Standardization and Deployment

Beyond NIST, large-scale deployments have validated the engineering choices: Chrome's hybrid X25519+ML-KEM-768 in TLS 1.3/QUIC, Apple's Kyber deployment in iMessage PQ3, and Signal's hybrid X25519+Kyber PQXDH handshake — evidence that module-lattice KEMs scale to billions of endpoints.

---

## 3. Methodology

This thesis is a synthesis and analysis work combining: (1) **primary-source reconstruction** of ML-KEM/ML-DSA from the NIST standards and CRYSTALS specifications [2][3][4]; (2) **complexity accounting** of the NTT bottleneck, butterfly counts, and vectorized/hardware optimization literature [7]; (3) **security-model analysis** separating the mathematical argument (reductions, QROM proofs [5]) from the implementation argument (side-channel and fault resistance [8]); and (4) **deployment evidence** from the Chrome hybrid-key-exchange rollout [6]. Quoted figures — key sizes, failure probabilities, cycle counts — are taken from the cited primary sources.

---

## 4. Deep Dive

### 4.1 Module-LWE and Security Reductions

The security of both ML-KEM and ML-DSA ultimately rests on M-LWE, with ML-DSA additionally relying on M-SIS and SelfTargetMSIS [4][5]. The appeal of M-LWE over plain LWE is twofold: *algebraic structure* enables the NTT and hence fast arithmetic, while the *module* aspect (rank k > 1) hedges against attacks exploiting the extra structure of ideal lattices.

> **Theorem (informal, worst-case to average-case).** For suitable parameters, solving decision M-LWE over R_q with module rank k is at least as hard as approximating worst-case lattice problems (SIVP, GapSVP) to polynomial factors on *module* lattices of dimension n*k.

Concrete security is estimated via the *core-SVP* methodology: the cost of the best known attack is equated to BKZ with block size beta, whose sieving core costs roughly 2^(0.292 beta) classically (2^(0.265 beta) quantumly, under debated quantum-sieving models). The Kyber specification's claimed estimates are:

| Parameter set | Module rank k | Classical core-SVP | Quantum core-SVP | NIST level |
|---|---|---|---|---|
| ML-KEM-512 | 2 | 2^118 | 2^107 | 1 (AES-128) |
| ML-KEM-768 | 3 | 2^183 | 2^165 | 3 (AES-192) |
| ML-KEM-1024 | 4 | 2^256 | 2^236 | 5 (AES-256) |

These estimates derive from primal and dual BKZ attacks on the underlying M-LWE instance and are deliberately conservative [2]. Improved dual/hybrid attacks have trimmed but not broken these margins; NIST's selection reflects confidence that the remaining margin absorbs foreseeable cryptanalytic progress.

A critical design decision is the *centered binomial distribution* (CBD) for noise sampling: CBD_eta samples are sums of eta differences of uniform bits, yielding small bounded noise without floating-point arithmetic, large tables, or data-dependent control flow — all side-channel hazards. The slight deviation from the distributions in the tightest reductions is compensated by conservative parameters [2].

### 4.2 NTT-Based Polynomial Arithmetic and Optimization

Polynomial multiplication in R_q = Z_q[X]/(X^256 + 1) dominates every M-LWE operation: matrix-vector products A s, A^T r, and the decapsulation re-encryption check. Schoolbook multiplication costs O(n^2) = 65,536 coefficient multiplications per product; the Number Theoretic Transform reduces this to O(n log n).

**The incomplete NTT for q = 3329.** Since 3329 - 1 = 13 x 256, a primitive 256th root of unity exists in Z_3329, but X^256 + 1 does not split completely: it factors into 128 irreducible quadratics. Kyber therefore employs an *incomplete* NTT with only 7 layers of Gentleman-Sande butterflies using a primitive 128th root of unity zeta:

```
NTT(f) = (f_0, f_1, ..., f_127),  each f_i in Z_q[X]/(X^2 - zeta^(2*brv(i)+1))
```

Pointwise multiplication then needs 128 independent degree-1 polynomial multiplications followed by the inverse NTT: 7 x 128 = 896 butterflies per transform versus 65,536 schoolbook multiplications [7].

**Modular reduction.** With q = 3329 < 2^12, intermediates fit in 16-bit signed arithmetic. Implementations use *Montgomery reduction* — values represented as a x 2^16 mod q, making post-multiplication reduction a multiply-and-shift with no division and no data-dependent branches: fast and constant-time. Barrett reduction handles final canonicalization.

**Vectorization and hardware.** AVX2 implementations process 16 coefficients per instruction; NEON and Cortex-M4 ports (pqm4) run ML-KEM-768 in a few hundred thousand cycles. Hardware studies report complete Kyber CCA-KEM circuits in ~5,551 cycles at 225 MHz (24.66 us) by optimizing the hash-sampling and NTT modules [7]. The NTT's regular, data-independent structure is what makes such optimization possible.

The following Python sketch illustrates the butterfly — the atomic unit of every NTT implementation:

```python
Q = 3329

def butterfly(a: int, b: int, zeta: int) -> tuple[int, int]:
    """One Gentleman-Sande butterfly: (a, b) -> (a + zeta*b, a - zeta*b) mod Q."""
    t = montgomery_reduce(zeta * b)   # t = zeta * b mod Q
    return (a + t) % Q, (a - t) % Q

def ntt_layer(coeffs, zetas, distance):
    """Apply one NTT layer: len(coeffs)//2 butterflies at stride `distance`."""
    n = len(coeffs)
    for i in range(0, n, 2 * distance):
        for j in range(distance):
            u, v = coeffs[i + j], coeffs[i + j + distance]
            coeffs[i + j], coeffs[i + j + distance] = butterfly(u, v, zetas[i // (2 * distance)])
    return coeffs
```

**Dilithium's NTT** is simpler: q = 8,380,417 = 2^23 - 2^13 + 1 satisfies 256 | (q - 1), admitting a *complete* 8-layer NTT. The larger modulus fits signature arithmetic's bigger coefficients at the cost of 32-bit intermediates [4].

### 4.3 ML-KEM and ML-DSA: From CRYSTALS to FIPS

**ML-KEM (FIPS 203).** The scheme is a KEM: KeyGen produces an encapsulation key ek and decapsulation key dk; Encaps(ek) outputs a ciphertext c and shared secret K; Decaps(dk, c) recovers K. Internally, ML-KEM builds on a CPA-secure public-key encryption scheme (ML-KEM.CPAPKE) and applies the Hofheinz-Hoevellmanns-Kiltz U^perp_m variant of the Fujisaki-Okamoto transform to achieve IND-CCA2 security in the (quantum) random oracle model [2]:

```
KeyGen:  A <- R_q^{k x k} (expanded from seed via SHAKE-128)
         s, e <- CBD_eta^k
         t = A s + e                       # M-LWE sample
         ek = (seed_A, t);  dk = (s, ek, H(ek), z)

Encaps(ek): m <- {0,1}^256                  # random message
         (K_bar, r) = G(m || H(ek))      # FO: derive coins + key from m
         u = A^T r + e_1                 # re-encrypt m under ek
         v = t^T r + e_2 + Decompress(m)
         c = Compress(u, v)
         K = KDF(K_bar || H(c))
         return (c, K)

Decaps(dk, c): m' = Decrypt(s, c)           # recover candidate message
         (K_bar', r') = G(m' || H(ek))
         c' = Encrypt(ek, m'; r')         # re-encrypt and compare
         if c' == c: return KDF(K_bar' || H(c))
         else:      return KDF(z || H(c)) # implicit rejection
```

The re-encryption check is the heart of the FO transform: dishonestly generated ciphertexts fail it, and *implicit rejection* returns a pseudorandom key derived from a secret seed z rather than an explicit failure — denying the attacker the decryption oracle that chosen-ciphertext attacks need. ML-KEM-512 uses eta_1 = 3 while higher sets use eta_1 = eta_2 = 2; compression parameters (d_u, d_v) are (10, 4) for the smaller sets and (11, 5) for ML-KEM-1024, each balancing ciphertext size against the decryption-failure probability delta (below 2^-139 and 2^-164 for ML-KEM-512/768 under standard independence assumptions [2]).

Standardized sizes are:

| | ML-KEM-512 | ML-KEM-768 | ML-KEM-1024 |
|---|---|---|---|
| Public key | 800 B | 1,184 B | 1,568 B |
| Secret key | 1,632 B | 2,400 B | 3,168 B |
| Ciphertext | 768 B | 1,088 B | 1,568 B |

**ML-DSA (FIPS 204).** Dilithium-style signatures follow Lyubashevsky's *Fiat-Shamir with aborts* paradigm [4]. The signer samples a masking vector y bounded by gamma_1, computes the challenge c = H(mu || w_1) as a sparse polynomial with exactly tau coefficients in {-1, 1}, and forms z = y + c s_1. *Rejection sampling* checks ||z||_infinity < gamma_1 - beta and the low-bits condition on w - c s_2, restarting on failure. This rejection makes the signature distribution independent of the secret key, defeating the statistical attacks that broke earlier Fiat-Shamir lattice signatures.

> **Theorem (informal, Dilithium unforgeability).** Under the hardness of M-LWE, M-SIS, and SelfTargetMSIS, ML-DSA is strongly unforgeable under chosen-message attack (SUF-CMA) in the (quantum) random oracle model. The SelfTargetMSIS reduction of [5] closes the last gap in the QROM proof.

Parameter sets and sizes:

| | ML-DSA-44 | ML-DSA-65 | ML-DSA-87 |
|---|---|---|---|
| NIST level | 2 | 3 | 5 |
| Public key | 1,312 B | 1,952 B | 2,592 B |
| Secret key | 2,560 B | 4,032 B | 4,896 B |
| Signature | 2,420 B | 3,309 B | 4,627 B |

The expected number of signing repetitions is modest (roughly 4-7), so the *abort* costs little while buying the entire security argument [4].

### 4.4 Side-Channel Hardening: Masking, Shuffling, and Fault Countermeasures

Mathematical security proofs assume a black-box adversary. Deployed implementations face *physical* adversaries who observe power consumption, electromagnetic emanation, and execution time, or who inject faults via voltage glitching, clock manipulation, or laser illumination. Lattice schemes present a rich side-channel surface, and the literature documents concrete attacks on unprotected implementations [8].

**Leakage sources.** The principal targets are:

1. **NTT twiddle-factor multiplication.** The butterfly computes zeta x b, where b is secret-dependent; a single-trace power/EM attack can recover b from the Hamming weight of intermediate products if the multiplication is unmasked.
2. **Binomial sampling.** CBD sampling expands secret bits through small additions; unprotected samplers leak the sampled noise, and hence the secret, through first-order DPA.
3. **Keccak/SHAKE.** The extendable-output function permeates key generation, sampling, and challenge derivation; its long secret-dependent phases are classic DPA targets, though its bit-sliced structure also admits efficient masking.
4. **Compression and the FO comparison.** Ciphertext compression and the re-encryption check involve secret-dependent branches in naive code; constant-time discipline is mandatory.

**Masking.** The standard countermeasure splits every sensitive variable x into d + 1 shares summing to x, so any d intermediates are independent of x — d-th-order security in the probing model. Masking the NTT is the central challenge: butterfly additions mask trivially share-by-share, but twiddle-factor *multiplications* need ISW-style gadgets costing O(d^2). Masked CBD sampling and Keccak add further overhead; published first-order masked Kyber implementations report roughly 2-5x cycle-count overheads, growing quadratically with masking order.

**Shuffling and blinding.** *Shuffling* randomizes the order of independent operations (e.g., permuting the 128 base multiplications of the incomplete NTT), forcing trace realignment before statistical analysis. *Blinding* multiplies NTT inputs by a random unit and corrects afterward, decorrelating traces from secrets at modest cost. Both are probabilistic — they raise the trace count for a successful attack — and compose best with masking.

**Fault attacks.** Deterministic Dilithium signing derives its masking vector y pseudorandomly from secret key and message. A fault during signing — skipping the bound check, corrupting y, disturbing the challenge hash — can yield a faulty signature from which the secret key is recoverable; a single faulty signature can be catastrophic under deterministic nonce derivation [8]. Countermeasures: **randomized (hedged) signing**, mixing fresh randomness into nonce derivation; **verify-after-sign**, suppressing faulty outputs; **redundancy**, duplicating critical checks so one skipped instruction cannot bypass rejection sampling.

For ML-KEM decapsulation, faulting the FO re-encryption comparison can turn the CCA-secure KEM back into a decryption oracle; the defense is redundant comparison and identical execution of the implicit-rejection path. Migration studies emphasize avoiding deterministic signing wherever a strong RNG exists, precisely because of this fault sensitivity [8].

---

## 5. Empirical Results and Formal Analysis

### 5.1 Performance at scale

On a modern x86-64 core, optimized ML-KEM-768 implementations perform key generation, encapsulation, and decapsulation in the low hundreds of thousands of cycles — sub-millisecond latencies within a small factor of the X25519 operations they complement. Internal hashing (SHAKE-128/256) accounts for the majority of runtime, so hardware SHA-3 acceleration yields outsized benefits [1]. On the ARM Cortex-M4, the pqm4 corpus shows ML-KEM-768 operations at roughly 0.5-1.5 million cycles with only ~4 KB of stack — comfortably inside IoT budgets. Hardware accelerators push further: a reported Kyber CCA-KEM circuit completes in 5,551 cycles at 225 MHz (24.66 us) with modest area [7].

### 5.2 The Chrome hybrid-deployment experiment

The most informative deployment datum comes from Google Chrome. Beginning August 2023, Chrome experimented with hybrid X25519+Kyber-768 key agreement in TLS 1.3; in August 2024, Chrome enabled the hybrid by default for desktop TLS and QUIC connections, then migrated to the finalized ML-KEM-768 (new TLS codepoint 0x11EC) in Chrome 131 later that year, since the finalized standard is wire-incompatible with round-3 Kyber [6]. The rollout surfaced real-world friction: some middleboxes and firewalls dropped ClientHello messages whose key-share extensions exceeded legacy size assumptions — the Kyber-768 key share is 1,184 bytes versus 32 for X25519. Three lessons emerge. First, *hybrid* designs were essential for deployment confidence: even a catastrophic break of ML-KEM degrades the hybrid only to classical security. Second, protocol ossification — middleboxes assuming small handshakes — is a first-order deployment risk. Third, standardization churn has real costs: the Kyber-to-ML-KEM codepoint migration required coordinated updates across browsers, servers, and libraries.

### 5.3 Formal analysis status

The theoretical picture is essentially complete for the standardized parameter sets: M-LWE/M-SIS reductions anchor the schemes to worst-case lattice problems; the HHK FO analysis gives IND-CCA2 security for ML-KEM in the QROM; and the SelfTargetMSIS reduction of [5] completes ML-DSA's QROM unforgeability proof. What remains open is composing these arguments with leakage and fault models: masked implementations carry probing-model proofs for individual gadgets, but end-to-end theorems under combined side-channel and fault adversaries are still an active research frontier.

---

## 6. Limitations and Open Problems

1. **Concrete-parameter tightness.** Core-SVP estimates rest on heuristic BKZ/sieving cost models (notably contested quantum sieving speedups). Dual-attack refinements keep shaving margins; the methodology needs continued scrutiny.
2. **Decryption-failure analysis.** ML-KEM's failure bounds rely on noise-independence heuristics. Fully rigorous analyses under realistic dependence would strengthen long-lived deployments.
3. **Masking cost.** First-order masking costs multi-fold slowdowns, scaling quadratically with order. Cheaper masking-friendly NTT formulations are the key enabler for secure IoT deployment.
4. **Fault-attack composability.** Redundancy countermeasures lack formal models composing with ROM-based unforgeability proofs; a fault-aware provable-security framework for lattice signatures remains open.
5. **Migration completeness.** TLS key exchange is migrating, but ML-DSA certificates (several kilobytes) stress handshake fragmentation. Code-based HQC as backup KEM (draft standard expected 2026 [1]) will restart parts of this migration.
6. **Cryptanalytic monoculture.** Both primary standards rest on module lattices. A structural M-LWE break would compromise encryption *and* signatures — the strongest argument for accelerating SLH-DSA and HQC despite their costs.

---

## 7. Conclusion

Module-lattice cryptography has earned its standards through a rare alignment of deep mathematics, practical efficiency, and adversarial scrutiny. M-LWE supplies worst-case hardness with algebraic structure; the incomplete-NTT design for q = 3329 converts that structure into sub-millisecond, kilobyte-scale cryptography; the Fujisaki-Okamoto transform and Fiat-Shamir-with-aborts rejection sampling lift the base schemes to the IND-CCA2 and SUF-CMA notions that real protocols demand. The Chrome hybrid-deployment experiment shows these schemes operating at planetary scale today, while the side-channel literature reminds us that mathematical security is necessary but not sufficient: masking, shuffling, blinding, and fault countermeasures are part of the standard's true cost.

The frontier now shifts from *selecting* algorithms to *deploying them safely*: cheaper masking, fault-aware proofs, ML-DSA certificate ecosystems, and disciplined hybrid migration. The lattice era of cryptography has begun; making it robust is the work of the coming decade.

---

## References

[1] Wikipedia contributors, "ML-KEM" and "NIST Post-Quantum Cryptography Standardization." https://en.wikipedia.org/wiki/ML-KEM and https://en.wikipedia.org/wiki/NIST_Post-Quantum_Cryptography_Standardization

[2] J. Bos, L. Ducas, E. Kiltz, T. Lepoint, V. Lyubashevsky, J. M. Schanck, P. Schwabe, G. Seiler, D. Stehle, "CRYSTALS-Kyber: A CCA-Secure Module-Lattice-Based KEM," IEEE EuroS&P 2018. https://eprint.iacr.org/2017/634

[3] NIST, "FIPS 203 (Initial Public Draft): Module-Lattice-Based Key-Encapsulation Mechanism Standard," doi:10.6028/NIST.FIPS.203.ipd. https://doi.org/10.6028/NIST.FIPS.203.ipd ; CISA, "Product Categories for Technologies That Use Post-Quantum Cryptography Standards." https://cisa.gov/resources-tools/resources/product-categories-technologies-use-post-quantum-cryptography-standards

[4] L. Ducas, E. Kiltz, T. Lepoint, V. Lyubashevsky, P. Schwabe, G. Seiler, D. Stehle, "CRYSTALS-Dilithium: Digital Signatures from Module Lattices," 2017. https://eprint.iacr.org/2017/633

[5] C. Miller, D. Wang, "Evaluating the security of CRYSTALS-Dilithium in the quantum random oracle model," 2023. https://eprint.iacr.org/2023/1968

[6] D. Adrian, D. Benjamin, B. Beck, D. O'Brien (Chrome Team), "Google Chrome Switches to ML-KEM for Post-Quantum Cryptography Defense," The Hacker News, Sep 2024. https://thehackernews.com/2024/09/google-chrome-switches-to-ml-kem-for.html?m=1

[7] S. Cheng, J. Chen, "Optimized Design and Implementation of CRYSTALS-KYBER Based on MLWE," Security and Communication Networks, Wiley, 2025. https://onlinelibrary.wiley.com/doi/10.1155/sec/7884158

[8] "Migration to Post-Quantum Cryptography: From ECDSA to ML-DSA," 2025 (covers fault-injection attacks on deterministic lattice signing and randomized-signing countermeasures). https://eprint.iacr.org/2025/2025.pdf

[1] ML-KEM / NIST Post-Quantum Cryptography Standardization — Wikipedia (NIST PQC standardization overview, FIPS 203/204/205, HQC selection). https://en.wikipedia.org/wiki/ML-KEM
[2] CRYSTALS-Kyber: A CCA-Secure Module-Lattice-Based KEM — IEEE EuroS&P 2018 (Cryptology ePrint Archive 2017/634). https://eprint.iacr.org/2017/634
[3] FIPS 203 (IPD): Module-Lattice-Based Key-Encapsulation Mechanism Standard; CISA PQC product categories — NIST FIPS 203; CISA guidance. https://doi.org/10.6028/NIST.FIPS.203.ipd
[4] CRYSTALS-Dilithium: Digital Signatures from Module Lattices — Cryptology ePrint Archive 2017/633. https://eprint.iacr.org/2017/633
[5] Evaluating the security of CRYSTALS-Dilithium in the quantum random oracle model — Cryptology ePrint Archive 2023/1968. https://eprint.iacr.org/2023/1968
[6] Google Chrome Switches to ML-KEM for Post-Quantum Cryptography Defense — The Hacker News, Sep 2024 (Chrome 131 hybrid X25519+ML-KEM-768, codepoint 0x11EC). https://thehackernews.com/2024/09/google-chrome-switches-to-ml-kem-for.html?m=1
[7] Optimized Design and Implementation of CRYSTALS-KYBER Based on MLWE — Security and Communication Networks, Wiley, 2025 (NTT/hardware optimization). https://onlinelibrary.wiley.com/doi/10.1155/sec/7884158
[8] Migration to Post-Quantum Cryptography: From ECDSA to ML-DSA — Cryptology ePrint Archive 2025 (fault attacks on deterministic signing, randomized signing). https://eprint.iacr.org/2025/2025.pdf
