---
{
 "id": "ths_1788593354272_a7b7",
 "title": "Threshold ECDSA at Scale: GG18/GG20 Multi-Party Signing, Presigning with Paillier Encryption, Identifiable Abort, and DKLS Two-Party Wallets in Production Custody",
 "anon": "anon#2219",
 "ts": 1788593354272,
 "type": "thesis",
 "images": [
  "ths_1788593354272_a7b7-0.webp",
  "ths_1788593354272_a7b7-1.webp",
  "ths_1788593354272_a7b7-2.webp",
  "ths_1788593354272_a7b7-3.webp"
 ]
}
---

# Threshold ECDSA at Scale: GG18/GG20 Multi-Party Signing, Presigning with Paillier Encryption, Identifiable Abort, and DKLS Two-Party Wallets in Production Custody

## Abstract

Threshold ECDSA replaces the single-point-of-failure private key with a secret shared among *n* parties, so that any quorum of *t + 1* can sign while *t* or fewer learn nothing. The signing equation *s = k⁻¹(H(m) + r·x)* resists distribution because of its inversions and secret products, forcing protocols to combine additive secret sharing with homomorphic encryption. This thesis unifies the two protocol families defining the modern state of the art: the Gennaro–Goldfeder line — **GG18** [1], with Paillier-based multiplicative-to-additive (MtA) share conversion and Feldman-verifiable distributed key generation, and **GG20** [2], which splits signing into offline presigning and a single non-interactive online round while adding *identifiable abort* for public attribution of deviating parties — and the two-party wallet line of Lindell [3] and Doerner–Kondi–Lee–shelat [5]. We dissect MtA, the presign/online decomposition, abort identification, and the multiplicative rewriting behind practical two-party signing; compare published benchmarks including Lindell's 37 ms signing figure [3] and 4.4–9× bandwidth reductions of class-group variants [7]; and close with limitations: Paillier modulus bloat, DKG liveness, refresh costs, and the absence of post-quantum security.

## 1. Introduction

The Elliptic Curve Digital Signature Algorithm (ECDSA) underpins Bitcoin, Ethereum, TLS certificate authorities, and code-signing infrastructure. Its security rests on a single integer: the private key *x ∈ ℤ_q* such that *X = x·G* is the public key. Whoever holds *x* can spend, impersonate, or attest. In production custody — exchanges, institutional wallets, wallet-as-a-service platforms — concentrating *x* on one machine is operationally unacceptable, yet Bitcoin's script language and Ethereum's account model natively verify only standard ECDSA signatures. *Threshold ECDSA* resolves the tension: it distributes *x* across *n* servers such that any *t + 1* of them can jointly produce a signature that verifies against the *same* public key *X*, while any *t* or fewer learn nothing about *x* and the on-chain footprint is indistinguishable from a single-signer transaction [4].

Distributing ECDSA is harder than distributing Schnorr or BLS signatures, because the signing equation is non-linear in the secrets. Given message hash *e = H(m)*, nonce *k*, and nonce point *R = k·G* with *r = R.x mod q*, the signer computes

> **Theorem (ECDSA correctness).** For *s = k⁻¹(e + r·x) mod q* with *r ≠ 0, s ≠ 0*, the pair *(r, s)* verifies under *X = x·G*, i.e. the verifier's computation *u₁·G + u₂·X* with *u₁ = e·s⁻¹*, *u₂ = r·s⁻¹* yields a point whose *x*-coordinate is *r*.

*Proof sketch.* Substituting *s⁻¹ = k·(e + r·x)⁻¹* gives *u₁·G + u₂·X = k(e+r·x)⁻¹(e+r·x)·G = k·G = R*. ∎

The difficulty for thresholdization is that computing *s* requires both the inverse *k⁻¹* and the products *r·x* and *k·x*-like terms from shares of *k* and *x* held by mutually distrusting parties. Reconstructing *k* or *x* at any point breaks the security model. The field converged on two complementary strategies:

1. **Paillier-assisted share conversion (the GG line).** Each party holds additive shares *xᵢ* of *x = Σxᵢ* and samples additive shares *kᵢ, γᵢ* of the nonce and a masking value. Pairwise *multiplicative-to-additive* (MtA) subprotocols convert products *kᵢ·γⱼ* and *kᵢ·xⱼ* into additive shares *αᵢⱼ + βᵢⱼ* using Paillier's additive homomorphism, so that *k⁻¹* can be reconstructed from shares of *δ = k·γ* without ever exposing *k* [1].
2. **Multiplicative rewriting (the two-party line).** MacKenzie and Reiter observed that *s* can be rewritten so that two parties need only one multiplication of secrets; Lindell [3] and DKLS [5] instantiate this with Paillier encryption of one party's share, avoiding expensive zero-knowledge proofs over the Paillier group during signing.

The GG20 protocol [2] adds the two properties production systems most need: a *non-interactive online phase* — players need not be online simultaneously, only one round of broadcast — and *identifiable abort*, so a deviating party is publicly attributed.

## 2. Background

### 2.1 ECDSA and the distribution problem

Two structural facts make threshold ECDSA delicate:

- **Nonce reuse is catastrophic.** Two signatures under the same *k* reveal *k = (e₁ − e₂)·(s₁ − s₂)⁻¹* and then *x*. Distributed nonce sampling must guarantee *k* is uniform, unknown to any strict subset, and never reused.
- **The inversion is non-linear.** Unlike Schnorr's *s = k + e·x*, ECDSA's *s = k⁻¹(e + r·x)* cannot be computed from additive shares by local linear operations. The GG protocols sidestep inversion by sharing *δ = k·γ* so that *sᵢ = kᵢ·m + r·σᵢ* can be summed after a single public inversion of *δ* [1][2].

### 2.2 Cryptographic building blocks

- **Paillier encryption.** An additively homomorphic scheme: *Enc(a)·Enc(b) = Enc(a + b)*, *Enc(a)^b = Enc(a·b)*. In MtA, *Pᵢ* sends *c = Encᵢ(a)*; *Pⱼ* picks random *β* and returns *c^b · Encᵢ(β) = Encᵢ(a·b + β)*; *Pᵢ* decrypts to *α = a·b + β* while *Pⱼ* keeps *β*, yielding additive shares of *a·b* with neither party learning the other's input. Paillier moduli are large (2048–3072 bits) which dominates bandwidth [1][7].
- **Feldman verifiable secret sharing (VSS).** Used in distributed key generation so each party commits to its polynomial and others verify share consistency; a complaint round disqualifies dealers of invalid shares [1].
- **Zero-knowledge range proofs.** MtA is only secure if *a* and *b* lie in valid ranges (else a malicious party can wrap around the Paillier modulus *N* and inject a multiple of *N* into the share, biasing the signature or leaking the key). GG18 attaches range proofs to every MtA message — the dominant cost, later removed by the class-group variant [7] and reduced in GG20's presigning.
- **Broadcast with identifiable abort.** Standard MPC abort gives no attribution: one malicious party can silently kill every signing attempt. GG20's identifiable-abort subprotocol records all protocol messages on a broadcast channel and, on failure, runs a deterministic identification procedure over the transcript so all honest parties output the same cheater identity [2].

### 2.3 Adversary models

The protocols surveyed target the strongest practical model: a **static, malicious adversary corrupting up to *t < n* parties (dishonest majority)**, with security argued by simulation in the UC framework [2][6]. An attacker who compromises *t* of *n* HSMs or cloud enclaves must learn nothing and be unable to forge — and, with identifiable abort, cannot even deny service anonymously.

## 3. Methodology

### 3.1 Protocol skeleton: key generation

All GG-family protocols begin with a distributed key generation (DKG) producing additive shares *xᵢ* of *x* and the joint public key *X*:

1. Each *Pᵢ* samples *uᵢ ← ℤ_q*, publishes Feldman commitments and a Paillier public key *Nᵢ*, and proves knowledge of the Paillier factorization.
2. Each *Pᵢ* distributes Feldman shares of *uᵢ*; complaints disqualify misbehaving dealers.
3. The qualified set defines *x = Σ uᵢ*, *xᵢ = Σⱼ share(j→i)*, *X = Σ uᵢ·G*, with each party committing to *Xᵢ = xᵢ·G* so later deviations are detectable [1][2].

GG20's DKG is 3 rounds; Lindell–Nof's [4] uses oblivious transfer and Pedersen commitments and runs in 5 rounds.

### 3.2 MtA: the engine room

The signing phase reduces to obtaining additive shares of the products *kᵢ·γⱼ* and *kᵢ·xⱼ* for all ordered pairs *(i, j)*. Each pair runs MtA (with *w* for "with check" in GG20 to bind the Paillier key to the committed share):

```python
# MtA: Pi holds a, Pj holds b -> shares alpha (Pi), beta (Pj) with alpha + beta = a*b
def mta_sender(a, pk_i):
    c = paillier_encrypt(pk_i, a)
    return c, zkp_range(a, pk_i)          # proves a in [0, q): no wrap-around mod N

def mta_receiver(c, b, pk_i):
    beta = random_below(q**3)            # statistical masking
    c_prime = (c ** b) * paillier_encrypt(pk_i, beta)   # Enc_i(a*b + beta)
    return c_prime, beta

def mta_finish(c_prime, sk_i):
    return paillier_decrypt(sk_i, c_prime)  # alpha = a*b + beta
```

Summing over *j*, each *Pᵢ* obtains *δᵢ* and *σᵢ* with *Σδᵢ = k·γ* and *Σσᵢ = k·x* — without any party learning *k, γ,* or *x* [1].

### 3.3 Presigning and the online phase (GG20)

GG20's key structural insight is to split signing into [2]:

- **Offline presign (3 rounds, message-independent):** parties generate *(k, γ)* shares, run MtA to get *δᵢ, σᵢ*, broadcast *Δᵢ = δᵢ·G*, and derive *R* from *δ⁻¹*. The presign output is a tuple *(R, kᵢ, σᵢ)* with *r = R.x*.
- **Online sign (1 round, non-interactive):** given *e = H(m)*, each party broadcasts *sᵢ = kᵢ·e + r·σᵢ* with a consistency proof; anyone sums *s = Σsᵢ = k·e + r·k·x* and outputs *(r, s·δ⁻¹)*, which equals *k⁻¹(e + r·x)*.

Because the online round is a single broadcast with no inter-party dependency, signers need not be simultaneously online: presigns can be stockpiled, and each custodian contributes its *sᵢ* asynchronously — the property that makes GG20 deployable in wallet infrastructure [2].

### 3.4 Identifiable abort

If any broadcast *sᵢ* fails its consistency proof, GG20 does not merely abort: every party already holds the full transcript (all messages were broadcast), so each honest party deterministically replays the verification of every message and identifies the first party whose message does not verify. Since the transcript is common, all honest parties identify the same cheater [2]. CGGMP21 [6] extends this to a UC-secure, proactive variant with key refresh.

### 3.5 The two-party specialization (DKLS / Lindell)

For *n = 2* (the dominant wallet topology: user device + server), the full *n*-party machinery is overkill. Lindell [3] uses Paillier encryption of *P₁*'s share *x₁*: *P₂* computes *Enc(s')* homomorphically from *Enc(x₁)*, its own *x₂*, and the message, then *P₁* decrypts and finishes — achieving ~37 ms per P-256 signature with only game-based plus a non-standard Paillier assumption, and no ZK proofs over Paillier ciphertexts in the signing path. DKLS [5] replaces Paillier with oblivious transfer and proves security from ECDSA assumptions alone in the multiparty case, demonstrating the protocol with 256 parties.

---

## 4. Deep Dive

### 4.1 MtA under the microscope: why range proofs dominate

The MtA receiver's mask *β* must statistically hide *a·b*, so *β* is sampled from a range vastly larger than *q²*, and the sender's *a* must be proven smaller than *q*; otherwise *a·b + β* computed modulo *N* wraps and the shares sum to *a·b + ℓ·N* for unknown *ℓ*, silently corrupting *δ* or leaking key material through selective failure. With *q ≈ 2²⁵⁶* and Paillier *N ≈ 2²⁰⁴⁸*, each of the *O(n²)* MtA instances carries a range proof — the dominant cost, which the class-group construction [7] removes by replacing Paillier range proofs with proofs of valid ciphertexts, reporting 4.4–9× bandwidth savings.

> **Theorem (MtA security, informal [1]).** Under Paillier IND-CPA security and the strong RSA assumption, MtA securely realizes the multiplicative-to-additive functionality against malicious adversaries, provided both parties prove range validity of their inputs.

*Proof sketch.* The simulator extracts the adversary's input from its range proof and simulates honest messages with encryptions of zero masked by fresh randomness; indistinguishability follows from Paillier semantic security and the statistical hiding of *β*. The "with check" variant binds the Paillier key to the Feldman-committed share, preventing inconsistent keys across DKG and signing. ∎

### 4.2 Presigning economics: trading storage for latency

Presigning converts the dominant cost of threshold ECDSA from a *latency* problem into a *throughput and storage* problem. A presign tuple is message-independent and can be generated in batches during idle periods; the online phase then costs one broadcast round plus local field arithmetic. The trade-offs:

- **Statefulness.** Each presign is single-use; nonce-reuse across two messages with the same *(k, γ)* leaks *x*. Production systems enforce *consume-once* semantics, typically via the coordinator deleting the tuple after first use.
- **Storage.** A presign tuple holds a handful of field elements, but high-throughput custodians maintain large pools, and pool exhaustion under load reintroduces the offline latency.
- **Refresh interaction.** In proactive variants [6], key refresh must also refresh or invalidate outstanding presigns, since they are bound to the current sharing of *x*.

### 4.3 Identifiable abort: from denial-of-service to attribution

Classical threshold ECDSA (GG18 [1], Lindell–Nof [4]) guarantees a corrupt party cannot forge or learn the key, but one malicious participant can force *every* signing attempt to abort — with no way to tell malice from a crashed server. In a 2-of-3 custody deployment, that is a veto over all withdrawals. GG20's identifiable abort [2] changes the game theory: all messages are broadcast with proofs checkable against public commitments, so any abort is attributed to a specific party *by all honest parties simultaneously*.

1. **Slashing and alerting.** The identified cheater can be ejected and its HSM attestation revoked — abort becomes an incident with an owner rather than a mystery.
2. **No framing.** An honest party's messages always verify against its commitments, so a coalition cannot frame an honest participant; identification is deterministic over the common transcript.
3. **Cost.** Every message must be broadcast and carry verifiable proofs — the *O(n²)* broadcast is the price of attribution. CGGMP21 [6] achieves this with UC security and proactive refresh at the cost of additional rounds.

### 4.4 Two-party wallets: why *n = 2* deserves its own protocol

The modal production deployment is not *n = 7* but *n = 2*: a phone plus a server (Zengo-style), or a client HSM plus a cloud KMS. For *t = 1, n = 2*, GG18's *O(n²)* MtA mesh and Feldman DKG are pure overhead. The two-party line instead exploits the *multiplicative rewriting* of MacKenzie–Reiter: write *k = k₁·k₂*, *x = x₁ + x₂* (or *x₁·x₂*), and observe

```
R = (k₁·k₂)·G,   s = k₂⁻¹·(k₁⁻¹·e + r·k₁⁻¹·x₁·x₂ ...)
```

so that only *one* secret–secret multiplication is needed. Lindell [3] implements it with Paillier: *P₁* publishes *c = Enc(x₁)*; *P₂* homomorphically computes an encryption of a blinded partial signature; *P₁* decrypts. The signing path needs no ZK proofs over Paillier ciphertexts — complexity moves to key generation — at the price of a *global abort* model: a malformed ciphertext forces fresh key generation. DKLS [5] removes Paillier entirely, building on OT under standard ECDSA assumptions, and scales the same idea to *(t, n)* with a 256-party WAN experiment.

```rust
// DKLS-style two-party signing sketch (semi-honest core)
struct Share { x_i: Scalar, k_i: Scalar }
fn round1(s: &Share) -> Point { s.k_i * G }                    // R_i = k_i * G
fn round2(r: Scalar, e: Scalar, s: &Share, k_corr: Scalar) -> Scalar {
    ((e + r * s.x_i) * s.k_i.invert()) * k_corr               // OT-based MtA correction
}
```

### 4.5 Proactive security and key refresh

Long-lived custody keys face the *mobile adversary*: over months, an attacker may compromise one server, then another, eventually collecting *t + 1* shares across time. Proactive secret sharing defeats this by periodically re-randomizing shares of the *same* key *x*: parties jointly generate a sharing of zero and add it to their shares. CGGMP21 [6] integrates refresh with identifiable abort in the UC model. Refresh is itself a DKG-like ceremony — typically weekly or monthly — and the least standardized part of production deployments: implementations differ on attestation of the new share set and on handling outstanding presigns, which refresh generally invalidates.

---

## 5. Empirical Evaluation

We consolidate published measurements and protocol parameters. Table 1 compares round complexity and features (drawn from the GG20 paper [2], the ECDSA threshold survey [ePrint 2020/1390], and the original papers).

| Protocol | KeyGen rounds | Signing rounds (online) | Identifiable abort | Assumption highlights | Notable feature |
|---|---|---|---|---|---|
| GG18 [1] | 3 | 7 (1) | No | Paillier, strong RSA | First efficient DKG, dishonest majority |
| GG20 [2] | 3 | 3 offline + **1** | **Yes** | Paillier, strong RSA | Non-interactive online phase |
| Lindell–Nof [4] | 5 | 8 | No | DDH, Paillier/OT | OT-based, practical DKG |
| CGGMP21 [6] | 3 | 3 offline + 1 | Yes (UC) | Paillier, strong RSA | Proactive refresh, UC security |
| Lindell17 [3] | 5 + 3 aux | 6 (1) | No (global abort) | Paillier (non-std) | Two-party, ~37 ms/sign |
| DKLS [5] | 4 | 5 | No | ECDSA assumptions, OT | No Paillier; 256-party test |
| CCL+ (class group) [7] | 4 | 7 (1) | Partial | Low-order + strong-root | 4.4–9× less bandwidth |

Table 2 collects concrete reported performance figures — *as reported by the authors* on their hardware, not a unified benchmark.

| Measurement | Value | Source |
|---|---|---|
| Lindell17 two-party sign, P-256, Azure single core | ≈ 37 ms | [3] |
| CCL+ signing bandwidth vs. GG18/Lindell–Nof | 4.4–9× reduction | [7] |
| CCL+ key generation bandwidth vs. prior best | ≈ 2× reduction | [7] |
| DKLS multiparty scalability test | 256 parties, LAN + WAN | [5] |
| GG20 vs. GG18 | Fewer rounds, less computation [2] |
| Paillier modulus for 128-bit security level | 3072-bit *N* | [1][2] |

Table 3 gives an *illustrative* production latency model for a GG20 deployment (2-of-3, secp256k1, presign pool warm). Figures are engineering estimates, not measurements.

| Phase | Latency contribution | Notes |
|---|---|---|
| Presign generation (amortized) | 50–200 ms per tuple | *O(n²)* MtA + range proofs; batched offline |
| Online broadcast round | 1 network RTT | Single round; async-friendly |
| Local *sᵢ* computation | < 1 ms | Field arithmetic only |
| Coordinator aggregation | < 1 ms | Sum + one inversion |

The model makes the central GG20 claim concrete: once presigns are stockpiled, user-perceived signing latency collapses to roughly one network round-trip plus proof verification — the property that lets custodians meet sub-second withdrawal UX while keys never exist in one place [2][4].

---

## 6. Limitations

1. **Paillier modulus bloat.** Security proofs require the Paillier message space to be exponentially larger than *q²* (for statistical masking), forcing 2048–3072-bit moduli and multi-kilobyte ciphertexts per MtA message. With *O(n²)* MtA instances per presign, bandwidth scales quadratically in *n*; deployments beyond ~10 parties become impractical without the class-group optimization [7].
2. **DKG liveness and complaints.** Feldman-VSS DKG needs a complaint/disqualification round; a malicious dealer can force restarts, and with dishonest majority there is no termination guarantee against an adversary willing to burn identities [1][2].
3. **Identifiable abort ≠ robustness.** GG20 attributes failure but still aborts: a malicious party retains a veto over each individual signing attempt. True *robustness* (guaranteed output delivery) is impossible with dishonest majority; operators must pair attribution with ejection and re-DKG runbooks.
4. **Presign pool management.** Nonce-reuse across presigns is key-compromising, so pools need consume-once enforcement, ideally in hardware. Refresh ceremonies invalidate outstanding presigns, coupling the refresh schedule to signing throughput [6].
5. **Implementation fragility.** The 2023 Fireblocks audit findings demonstrated key-extraction vulnerabilities in deployed Lindell17/GG18/GG20 implementations — not in the protocols' proofs but in edge cases (zero-value nonces, missing range checks, biased randomness). A single missing check can leak the full key, so production use demands audited libraries and known-answer tests.
6. **No post-quantum security.** All surveyed protocols rely on discrete-log and factoring-related assumptions; a cryptographically relevant quantum computer breaks both the curve and Paillier. Threshold *post-quantum* signatures (e.g., threshold Dilithium) remain far less mature and are not drop-in compatible with Bitcoin/Ethereum verification.

## 7. Conclusion

Threshold ECDSA has moved in under a decade from a theoretical curiosity to the signing backbone of institutional crypto custody. The GG line — GG18's Paillier-based MtA with trustless DKG [1], GG20's presign/online split with single-round asynchronous signing and identifiable abort [2], and CGGMP21's UC-secure proactive extension [6] — provides the general *(t, n)* solution, while the two-party line of Lindell [3] and DKLS [5] optimizes the wallet-topology case down to tens of milliseconds per signature. The engineering lesson is consistent: the cryptography is no longer the binding constraint — *presign logistics, DKG liveness, range-proof bandwidth, and implementation discipline* are. Open problems remain: concretely efficient identifiable abort without broadcast blowup, standardized proactive refresh with presign continuity, and a post-quantum threshold signature that existing chains can verify.

## References

[1] R. Gennaro and S. Goldfeder, "Fast Multiparty Threshold ECDSA with Fast Trustless Setup," in *Proc. ACM CCS 2018*. (GG18.)

[2] R. Gennaro and S. Goldfeder, "One Round Threshold ECDSA with Identifiable Abort," IACR Cryptology ePrint Archive, Report 2020/540, 2020. https://eprint.iacr.org/2020/540 (GG20.)

[3] Y. Lindell, "Fast Secure Two-Party ECDSA Signing," in *Proc. CRYPTO 2017*. https://eprint.iacr.org/2017/552

[4] Y. Lindell and A. Nof, "Fast Secure Multiparty ECDSA with Practical Distributed Key Generation and Applications to Cryptocurrency Custody," in *Proc. ACM CCS 2018*. https://eprint.iacr.org/2018/987

[5] J. Doerner, Y. Kondi, E. Lee, and a. shelat, "Secure Two-party Threshold ECDSA from ECDSA Assumptions," *IEEE S&P 2018*; multiparty case, *IEEE S&P 2019*. (DKLS.)

[6] R. Canetti, R. Gennaro, S. Goldfeder, N. Makriyannis, and U. Peled, "UC Non-Interactive, Proactive, Threshold ECDSA with Identifiable Aborts," in *Proc. ACM CCS 2020*. https://eprint.iacr.org/2021/060 (CGGMP21.)

[7] G. Castagnos, D. Catalano, F. Laguillaumie, F. Savasta, and I. Tucker, "Bandwidth-Efficient Threshold EC-DSA," in *Proc. PKC 2020*. https://hal.science/hal-02944825v1

[8] G. Castagnos, D. Catalano, F. Laguillaumie, F. Savasta, and I. Tucker, "Two-Party ECDSA from Hash Proof Systems and Efficient Instantiations," in *Proc. CRYPTO 2019*. https://inria.hal.science/hal-02281931v1
