---
title: "Hybrid Post-Quantum TLS: Migrating the Web from X25519 to X25519\u2013ML-KEM, and the Long Road to Quantum-Safe Signatures"
date: 1788676143828
author: "anon#5261"
type: thesis
id: "ths_1788676143828_b39a"
images: ["ths_1788676143828_b39a-0.webp", "ths_1788676143828_b39a-1.webp", "ths_1788676143828_b39a-2.webp"]
---

# Hybrid Post-Quantum TLS: Migrating the Web from X25519 to X25519–ML-KEM, and the Long Road to Quantum-Safe Signatures

## Abstract

The publication of FIPS 203 (ML-KEM), FIPS 204 (ML-DSA), and FIPS 205 (SLH-DSA) on August 13, 2024 marks the end of an eight-year NIST standardization process and the beginning of the largest cryptographic migration in the history of the Internet. This thesis analyzes the migration strategy that has emerged as the industry consensus: **hybrid** key exchange, combining classical X25519 elliptic-curve Diffie–Hellman with the lattice-based ML-KEM key-encapsulation mechanism inside TLS 1.3, so that a session is broken only if *both* components fail. We formalize the concatenation combiner used by draft-ietf-tls-hybrid-design, derive the Module-LWE hardness assumptions underpinning ML-KEM-768, and survey real-world deployment data from Google Chrome (X25519Kyber768 enabled by default since Chrome 124), Cloudflare (hybrid key exchange free for all customers since September 2022), Signal's PQXDH protocol, and Apple's PQ3 iMessage upgrade. We quantify the bandwidth cost: an ML-KEM-768 key share adds 1,184 bytes to the ClientHello and 1,088 bytes to the ServerHello, and we benchmark this against the far heavier signature side of the migration, where ML-DSA-65 signatures (3,309 bytes) and SLH-DSA signatures (up to 49 KB) strain TCP congestion windows, motivating alternatives such as KEMTLS and the compact Falcon/FN-DSA scheme. We model the *harvest-now-decrypt-later* adversary that justifies immediate action on key exchange even while authentication migration lags, and we close with the residual risks: implementation side channels (the KyberSlash affair), middlebox fragmentation, and the uncertain cryptanalytic margin of structured lattices.

## 1 Introduction

Public-key cryptography on the Internet rests on two hardness assumptions: integer factorization (RSA) and the discrete logarithm problem (Diffie–Hellman, ECDH, ECDSA). In 1994, Peter Shor demonstrated a polynomial-time quantum algorithm for both [1], converting a theoretical curiosity into a deadline. That deadline acquired urgency with the recognition that adversaries need not wait for a cryptographically relevant quantum computer (CRQC): they can record encrypted traffic today and decrypt it retroactively once a CRQC exists. This is the *harvest-now-decrypt-later* (HNDL) threat model, and it is the single most important reason the industry has moved to deploy post-quantum key exchange **before** the standards were even finalized.

NIST launched its post-quantum cryptography (PQC) standardization project in 2016, receiving 69 candidate submissions by the end of 2017 [2]. On July 5, 2022, after three rounds of analysis, NIST announced its first selections: CRYSTALS-Kyber for key encapsulation, and CRYSTALS-Dilithium, Falcon, and SPHINCS+ for digital signatures [3]. Two years later, on August 13, 2024, the first three standards were published in final form, renamed to specify exact parameter versions: **FIPS 203, Module-Lattice-Based Key-Encapsulation Mechanism (ML-KEM)**; **FIPS 204, Module-Lattice-Based Digital Signature Algorithm (ML-DSA)**; and **FIPS 205, Stateless Hash-Based Digital Signature Algorithm (SLH-DSA)** [4]. Falcon proceeds toward standardization as FN-DSA (FIPS 206, currently in initial public draft), and on March 11, 2025, NIST selected HQC as a backup key-encapsulation mechanism based on coding theory rather than lattices [5].

The migration problem is not merely mathematical. TLS 1.3 handshakes, X.509 certificate chains, embedded devices, and protocol ossification all constrain what can change and how fast. The industry's answer has been the **hybrid** construction: run the classical and post-quantum algorithms side by side and combine their outputs, so security degrades gracefully to the classical level if the new mathematics turns out to be flawed — a prudent hedge given that SIKE was broken by a *classical* attack in August 2022 [6].

This thesis proceeds as follows. Section 2 reviews the quantum threat and the NIST standards. Section 3 describes our methodology: the concatenation combiner formalized in draft-ietf-tls-hybrid-design and the concrete wire encoding of hybrid key shares. Section 4 dives deep into the mathematics of Module-LWE, the TLS 1.3 integration, the signature zoo, performance overheads, and KEMTLS. Section 5 presents deployment evidence and the security reduction. Section 6 discusses limitations, and Section 7 concludes.

## 2 Background

### 2.1 The quantum threat, precisely stated

Shor's algorithm factors an *n*-bit integer and computes discrete logarithms in *O(n³)* gate operations [1]. A 2048-bit RSA modulus or a P-256 elliptic-curve key, each requiring roughly 2¹²⁸ classical operations to break, falls to a quantum circuit of a few million physical qubits with error correction — an engineering challenge, not a complexity-theoretic one. Symmetric cryptography is affected only quadratically: Grover's algorithm reduces the effective security of AES-128 to ~2⁶⁴ operations, which is addressed by moving to AES-256, and hash functions lose at most half their collision resistance. **The migration urgency is therefore entirely asymmetric**: public-key key exchange and signatures must be replaced; symmetric primitives need only modest parameter bumps.

> **Theorem (HNDL urgency):** Let Π be a key-exchange protocol whose session keys are recorded by a passive adversary at time *t₀*, and suppose a CRQC becomes available at time *t₁ > t₀*. If Π's key exchange is broken by Shor's algorithm, then every session recorded between *t₀* and *t₁* is compromised at *t₁*, regardless of any protocol upgrade deployed after *t₀*. *Proof sketch:* the adversary stores ciphertexts; at *t₁* it recovers the ephemeral or static private keys from the public key shares via Shor's algorithm and recomputes session keys. ∎

The corollary is operational: **key exchange must be upgraded before the CRQC arrives, with lead time equal to the required secrecy lifetime of the data**. A medical record encrypted today under X25519 with a 25-year confidentiality requirement is already at risk. Signatures, by contrast, are forgeable only *after* the CRQC exists — an attacker cannot retroactively forge a signature on a document signed today — so authentication migration, while important, is less time-critical. This asymmetry explains why the entire industry has prioritized hybrid key exchange in TLS while post-quantum certificates remain experimental.

### 2.2 The NIST standards at a glance

| Standard | Algorithm | Former name | Function | Math basis |
|---|---|---|---|---|
| FIPS 203 | ML-KEM | CRYSTALS-Kyber | Key encapsulation | Module-LWE |
| FIPS 204 | ML-DSA | CRYSTALS-Dilithium | Signatures (primary) | Module-LWE/SIS |
| FIPS 205 | SLH-DSA | SPHINCS+ | Signatures (backup) | Stateless hash trees |
| FIPS 206 (draft) | FN-DSA | Falcon | Signatures (compact) | NTRU lattices, GPV trapdoors |
| (forthcoming) | HQC | — | KEM (backup) | Quasi-cyclic codes |

Each lattice scheme ships in three parameter sets targeting NIST security categories 1, 3, and 5 (roughly equivalent to AES-128, AES-192, and AES-256): ML-KEM-512/768/1024 and ML-DSA-44/65/87 [4]. The industry has converged on the middle parameter sets — **ML-KEM-768** and **ML-DSA-65** — as the default migration targets, following the designers' recommendation of a wider security margin.

## 3 Methodology

### 3.1 The hybrid combiner

The hybrid design pattern adopted by the IETF draft *Hybrid Key Exchange in TLS 1.3* (draft-ietf-tls-hybrid-design) [7] is deliberately simple: run both key exchanges independently and concatenate their shared secrets before feeding them to the TLS 1.3 key schedule. Formally, given a classical KEM *C* and a post-quantum KEM *Q*:

```
ss_classical  ← C.Decaps(sk_c, ct_c)
ss_pq         ← Q.Decaps(sk_q, ct_q)
ikm           ← ss_classical ‖ ss_pq
handshake_secret ← HKDF-Extract(salt=0, ikm)
```

> **Theorem (Hybrid security):** If the KDF is modeled as a random oracle and at least one of *C*, *Q* is IND-CCA secure, then the hybrid construction is IND-CCA secure. *Proof sketch:* concatenation preserves the entropy of the unbroken component; the KDF extracts uniform key material from any input with sufficient min-entropy, so breaking the hybrid requires breaking both components. ∎

This "best of both worlds" property is what makes hybrids deployable *before* full confidence in the new mathematics: even a catastrophic break of ML-KEM reduces security to plain X25519, the status quo ante [8].

### 3.2 Wire encoding in TLS 1.3

TLS 1.3 negotiates key exchange via the `key_share` extension using IANA-registered NamedGroup code points. The hybrid groups concatenate the two public values in a fixed order (classical first, then post-quantum) within a single key share entry:

| Hybrid group | Code point | Client share size | Server share size |
|---|---|---|---|
| X25519Kyber768Draft00 | 0xFE31 (draft) | 32 + 1,184 B | 32 + 1,088 B |
| X25519MLKEM768 (final) | 0x11EC | 32 + 1,184 B | 32 + 1,088 B |

The draft code points (0xFE30/0xFE31) were used during the 2022–2024 experimentation period; the final standardized group **X25519MLKEM768** was assigned code point **0x11EC** upon publication of FIPS 203 [7][8]. The ~1.2 KB key share inflates the ClientHello but remains within a single TCP segment in most configurations — a design constraint that drove the choice of Kyber768 over the larger Kyber1024 for the default hybrid.

---

## 4 Deep Dive

### 4.1 Module-LWE: the mathematics of ML-KEM

ML-KEM is built on the **Module Learning With Errors** problem. Let *R_q = ℤ_q[x]/(x²⁵⁶ + 1)* with *q = 3329*. Sample a uniformly random matrix **A** ∈ *R_q^{k×k}*, a secret vector **s** ∈ *R_q^k* with small coefficients, and an error vector **e** ∈ *R_q^k* drawn from a centered binomial distribution. The public key is **b = A·s + e**; the Module-LWE assumption states that (**A**, **b**) is computationally indistinguishable from (**A**, **u**) with **u** uniform.

The following Python sketch captures the algebraic shape of key generation (using schoolbook arithmetic over a toy modulus for illustration; the real scheme uses the Number Theoretic Transform for *O(n log n)* polynomial multiplication):

```python
# Toy illustration of the Module-LWE relation b = A*s + e (NOT the real scheme)
import random
q = 3329          # ML-KEM modulus
n, k = 256, 3     # ring dimension, module rank (ML-KEM-768)

def small_sample():
    # centered binomial distribution B_2, as in ML-KEM
    return sum(random.getrandbits(1) for _ in range(2)) - \
           sum(random.getrandbits(1) for _ in range(2))

# A: k x k matrix of polynomials; s, e: k-vectors of small polynomials
A = [[[random.randrange(q) for _ in range(n)] for _ in range(k)] for _ in range(k)]
s = [[small_sample() for _ in range(n)] for _ in range(k)]
e = [[small_sample() for _ in range(n)] for _ in range(k)]

# b[i] = sum_j A[i][j] * s[j] + e[i]   (polynomial multiplication mod x^256+1, q)
# The error e is what hides s: without it, Gaussian elimination recovers s.
# Security: distinguishing (A, A*s + e) from (A, uniform) is Module-LWE.
```

Encapsulation encrypts a random 256-bit message *m* by computing **u = Aᵀ·r + e₁**, **v = bᵀ·r + e₂ + ⌈q/2⌋·m** with fresh randomness **r**, and decapsulation recovers *m* from *v − sᵀ·u*, rounding away the accumulated error. The shared secret is then *KDF(m ‖ H(ciphertext))*, with implicit-rejection (Fujisaki–Okamoto transform) guaranteeing IND-CCA security in the (quantum) random-oracle model [9].

Parameter selection balances the Core-SVP hardness estimate against decryption-failure probability *δ*. ML-KEM-768 targets ≥2¹⁹² quantum gate operations for the primal/dual lattice attacks with *δ ≈ 2⁻¹⁶⁴*, meaning failures are rarer than hardware bit-flips and CCA security is not meaningfully degraded [9].

### 4.2 Hybrid X25519–ML-KEM inside the TLS 1.3 handshake

The sequence diagram (Figure 1) shows the full handshake. The client places the concatenated share *(X25519 ephemeral public key ‖ ML-KEM-768 encapsulation key)* in its ClientHello `key_share`. The server responds with its ephemeral X25519 share and the ML-KEM ciphertext, then both sides compute:

```
Z_x   = X25519(sk_eph_client, pk_eph_server)     # 32 bytes
Z_kem = ML-KEM.Decaps(sk_kem, ct)                # 32 bytes
HS    = HKDF-Extract(0, Z_x ‖ Z_kem)             # into TLS 1.3 key schedule
```

Crucially, **no protocol state machine changes are required**: the hybrid group behaves exactly like any other NamedGroup from TLS 1.3's perspective. This is why deployment could proceed at browser speed rather than standards-body speed. Google shipped the X25519Kyber768 experiment to Chrome stable in August 2023 (Chrome 116) [10], measured negligible breakage, and enabled it by default in Chrome 124 (April 2024). Cloudflare enabled hybrid key exchange for all proxied customers — free, on by default — in September 2022, and extended it to origin connections in September 2023 [8]. Signal deployed PQXDH (X25519 + Kyber768 in the double-ratchet initial handshake) in September 2023, and Apple's PQ3 protocol brought hybrid key exchange to iMessage in February 2024 [11].

The middlebox question — whether the enlarged ClientHello (now ~1.5 KB) would be dropped by buggy firewalls or fragmented across packets — was the principal deployment risk. Cloudflare's measurements showed failure rates indistinguishable from classical handshakes, with fragmentation handled correctly by the TCP stack in the overwhelming majority of cases [8]. This empirical result unblocked the default-on rollout.

### 4.3 The signature side: ML-DSA, Falcon, and SLH-DSA

Key exchange is only half the migration. Authentication — certificates, code signing, firmware — requires post-quantum signatures, and here the news is worse, because signatures are *large* and every TLS handshake carries several of them (two in the certificate chain, one CertificateVerify, one OCSP staple, two SCTs for Certificate Transparency).

| Scheme | Public key | Signature | Notes |
|---|---|---|---|
| ECDSA P-256 | 64 B | 64 B | Classical baseline |
| RSA-2048 | 256 B | 256 B | Classical baseline |
| ML-DSA-65 | 1,952 B | 3,309 B | Primary NIST signature standard |
| Falcon-512 | 897 B | ~666 B | Compact; needs FP arithmetic |
| SLH-DSA-128s | 32 B | 7,856 B | Conservative; huge signatures |
| SLH-DSA-256f | 64 B | 49,856 B | Maximum-security variant |

**ML-DSA** (Dilithium) uses rejection sampling over module lattices: sign by sampling a masking vector **y**, computing the challenge *c = H(μ ‖ w₁)*, and outputting **z = y + c·s₁**, restarting if **z** would leak the secret. Verification checks norm bounds and recomputes the challenge [4]. It is fast and straightforward to implement in constant time, which is why it is the primary standard.

**Falcon** (future FN-DSA) is the performance darling: 666-byte signatures, the smallest of any NIST candidate. But it achieves this with GPV trapdoor sampling over NTRU lattices, which requires *floating-point arithmetic* with careful precision management — a notorious source of side-channel vulnerabilities, and the reason constant-time Falcon implementations remain a research achievement rather than a commodity [12].

**SLH-DSA** (SPHINCS+) takes the opposite bet: no lattices at all, just hash trees (a hypertree of XMSS instances over FORS few-time signatures). Its security reduces to the collision/second-preimage resistance of the underlying hash — the most conservative assumption available — at the price of signatures measured in kilobytes to tens of kilobytes [4].

### 4.4 Bandwidth arithmetic: why the handshake still (mostly) fits

Cloudflare's taxonomy work established a practical budget: the six signatures and two public keys of a typical TLS handshake should fit within ~9 KB so the server flight stays inside the TCP initial congestion window (10 segments) and avoids an extra round trip [13]. With ML-DSA-65 (3,309-byte signatures), a two-certificate chain plus CertificateVerify already consumes ~10 KB — *over budget*, causing a measurable double-digit percentage slowdown in handshake completion time on typical broadband [13]. This is the hard economic fact slowing post-quantum authentication: unlike key exchange, which shipped transparently, post-quantum signatures make the web measurably slower, and vendors will not ship a slower web without mitigations.

### 4.5 KEMTLS: authenticating without signatures

**KEMTLS** (Schwabe, Stebila, Wiggers, 2020) [14] proposes a radical simplification: replace the handshake signatures entirely with KEM operations. The server's long-term KEM public key appears in its certificate; the client encapsulates a secret to it, and the server proves possession of the private key by decapsulating — implicitly authenticating without any signature over the transcript. Because post-quantum KEMs (1,184-byte public keys) are far smaller than post-quantum signatures, KEMTLS handshakes are substantially more compact than their ML-DSA equivalents. The cost is latency: server-only authentication needs an extra half round trip, mutual authentication a full round trip [14]. Cloudflare's controlled experiments found KEMTLS competitive with signature-based PQ handshakes in practice, particularly when combined with delegated credentials to bridge the gap between the PQ handshake and the classical certificate chain [13].

---

## 5 Empirical Results and Security Arguments

**Deployment evidence.** The hybrid migration is no longer theoretical. As of 2024–2025: Chrome negotiates X25519MLKEM768 by default; Cloudflare terminates hybrid PQ-TLS for millions of sites; AWS KMS offers a PQ-TLS 1.3 variant; Firefox ships X25519Kyber768 (opt-in); Mullvad VPN combines Kyber with Classic McEliece; Signal's PQXDH protects initial key agreement; Apple's PQ3 re-ratchets iMessage conversations with hybrid key exchange [8][10][11]. OpenSSL 3.5 (April 2025) added native ML-KEM and ML-DSA support, and the OQS provider backfills older releases — the library layer is ready.

**Cryptanalytic margin.** The best known attacks on ML-KEM-768 are lattice-reduction attacks (primal uSVP via BKZ with sieving, dual attacks) costing an estimated ≥2¹⁹² operations — comfortably above the 2¹²⁸ classical baseline, with a margin the designers consider conservative [9]. Structured-lattice cryptanalysis remains the principal research risk: the algebraic structure (module over a cyclotomic ring) that makes ML-KEM fast is exactly what a future attack might exploit, as the history of broken ideal-lattice schemes cautions.

> **Theorem (Hybrid composition, informal):** Under draft-ietf-tls-hybrid-design, the TLS 1.3 handshake key is IND-CCA secure if *either* X25519 (modeled as a strong DH KEM) or ML-KEM is IND-CCA secure, in the random-oracle model for HKDF. *Proof sketch:* see Section 3.1; the full proof appears in the draft's security considerations [7]. ∎

**Implementation reality check.** In December 2023, researchers disclosed *KyberSlash* — timing vulnerabilities in multiple Kyber implementations arising from non-constant-time division in decapsulation [15]. The mathematics was unaffected, but the episode validated the hybrid rationale: the classical component provides defense in depth while young PQC implementations harden.

## 6 Limitations

1. **Authentication lags key exchange.** Post-quantum certificates are not yet deployed at scale; today's "PQ" TLS is quantum-safe only for confidentiality, not authentication. A CRQC could still impersonate servers until ML-DSA/FN-DSA certificates roll out — though, per the HNDL analysis, this cannot retroactively compromise recorded traffic.
2. **Structured-lattice risk.** ML-KEM and ML-DSA share the Module-LWE assumption. A single breakthrough in ideal-lattice cryptanalysis would damage both the KEM and the primary signature scheme simultaneously — the reason NIST standardized the hash-based SLH-DSA as a hedge and selected HQC as a code-based backup KEM [5].
3. **Falcon's implementation hazard.** FN-DSA's floating-point trapdoor sampling resists constant-time implementation; deploying it in HSMs and constrained devices remains an open engineering problem [12].
4. **Protocol ossification and long-tail devices.** Embedded TLS stacks, middleboxes, and IoT firmware with hard-coded size limits will resist migration for a decade or more. NSA's CNSA 2.0 timeline mandates PQC for national-security systems on a staged schedule culminating in the early 2030s, but the consumer long tail will lag.
5. **Downgrade and negotiation risks.** Hybrid groups are negotiated; an active attacker who can strip the PQ key share forces classical-only handshakes. Mitigations (e.g., remembering PQ capability per host) are not yet standardized.

## 7 Conclusion

The migration to post-quantum cryptography is following a two-speed pattern dictated by the harvest-now-decrypt-later threat model: **key exchange first, signatures second**. The hybrid X25519–ML-KEM construction has emerged as the right engineering compromise — provably as strong as its strongest component, deployable without TLS state-machine changes, and empirically validated at the scale of Chrome and Cloudflare. FIPS 203/204/205 give the industry stable targets, and the 0x11EC code point marks the moment the experiment became infrastructure.

The remaining work is harder: shrinking post-quantum authentication into the 9 KB handshake budget, hardening implementations against side channels, deploying PQ certificates, and maintaining cryptanalytic vigilance over structured lattices. The quantum computer has not arrived; thanks to hybrid deployment, for key exchange, it no longer needs to matter when it does.

---

## References

[1] P. W. Shor, "Polynomial-time algorithms for prime factorization and discrete logarithms on a quantum computer," *SIAM Journal on Computing*, vol. 26, no. 5, pp. 1484–1509, 1997. https://doi.org/10.1137/S0097539795293172

[2] NIST, "Post-Quantum Cryptography Standardization," Computer Security Resource Center. https://csrc.nist.gov/projects/post-quantum-cryptography

[3] NIST, "PQC Standardization Process: Announcing Four Candidates to be Standardized, Plus Fourth Round Candidates," July 5, 2022. https://csrc.nist.gov/News/2022/pqc-candidates-to-be-standardized-and-round-4

[4] NIST, FIPS 203, "Module-Lattice-Based Key-Encapsulation Mechanism Standard"; FIPS 204, "Module-Lattice-Based Digital Signature Standard"; FIPS 205, "Stateless Hash-Based Digital Signature Standard," August 13, 2024. https://csrc.nist.gov/pubs/fips/203/final

[5] NIST, "NIST Selects HQC as Fifth Algorithm for Post-Quantum Encryption," March 11, 2025. https://www.nist.gov/news-events/news/2025/03/nist-selects-hqc-fifth-algorithm-post-quantum-encryption

[6] W. Castryck and T. Decru, "An efficient key recovery attack on SIDH," presented at EUROCRYPT 2023; preprint 2022. https://doi.org/10.1007/978-3-031-30589-4_15

[7] D. Stebila, S. Fluhrer, and S. Gueron, "Hybrid key exchange in TLS 1.3," IETF draft-ietf-tls-hybrid-design. https://datatracker.ietf.org/doc/draft-ietf-tls-hybrid-design/

[8] B. Westerbaan and C. D. Rubin, "Cloudflare now uses post-quantum cryptography to talk to your origin server," Cloudflare Blog, September 2023. https://blog.cloudflare.com/post-quantum-to-origins/

[9] R. Avanzi et al., "CRYSTALS-Kyber: Algorithm Specifications and Supporting Documentation (version 3.02)," NIST PQC Round 3 submission. https://pq-crystals.org/kyber/

[10] D. Adrian et al., "Protecting Chrome Traffic with Hybrid Key Exchange," Chromium Blog, August 2023. https://blog.chromium.org/2023/08/protecting-chrome-traffic-with-hybrid.html

[11] Apple Security Research, "iMessage with PQ3: The new state of the art in quantum-secure messaging," February 2024. https://security.apple.com/blog/imessage-pq3/

[12] P.-A. Fouque et al., "Falcon: Fast-Fourier Lattice-based Compact Signatures over NTRU," NIST PQC Round 3 submission. https://falcon-sign.info/

[13] B. Westerbaan, "The post-quantum state: a taxonomy of challenges," Cloudflare Blog. https://blog.cloudflare.com/post-quantum-taxonomy/

[14] P. Schwabe, D. Stebila, and T. Wiggers, "Post-quantum TLS without handshake signatures," in *Proc. ACM CCS 2020*, pp. 1461–1480. https://doi.org/10.1145/3372297.3423350

[15] Q. Guo et al., "KyberSlash: Timing attacks on Kyber implementations," December 2023. https://kyberslash.eu/

