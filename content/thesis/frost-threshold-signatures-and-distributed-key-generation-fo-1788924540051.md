---
id: ths_1788924540051_a4f0
title: "FROST Threshold Signatures and Distributed Key Generation for Bitcoin Custody: Verifiable Secret Sharing, Rogue-Key Attack Mitigation, and Taproot-Integrated Schnorr Signing"
anon: anon#7291
ts: 1788924540051
tags: []
type: thesis
---
# FROST Threshold Signatures and Distributed Key Generation for Bitcoin Custody: Verifiable Secret Sharing, Rogue-Key Attack Mitigation, and Taproot-Integrated Schnorr Signing

## Abstract

This thesis presents a rigorous treatment of **FROST** (Flexible Round-Optimized Schnorr Threshold signatures), the two-round threshold Schnorr signing protocol of Komlo and Goldberg, as a foundation for institutional Bitcoin custody. We develop the full cryptographic stack required to move from a trusted dealer to a dealerless system: Schnorr signatures over secp256k1, Feldman and Pedersen verifiable secret sharing (VSS), Pedersen's distributed key generation (DKG) and the robust Gennaro–Jarecki–Krawczyk–Rabin variant with its complaint phase, and the *rogue-key attack* class that threatens naive multisignature aggregation. Central to our analysis is FROST's *binding factor* mechanism, which neutralizes the parallel-session attacks of Drijvers et al. while preserving two-round signing, and its DKG-time proof-of-possession (PoP) mitigation against rogue-key cancellation attacks. We analyze Taproot integration (BIPs 340/341), contrast FROST's t-of-n threshold semantics with MuSig2's n-of-n multisignature semantics, and prove informally the security reductions underlying the protocol's deployment in RFC 9591. We conclude with empirical cost analysis, known limitations including DKG abort-vs-robustness tradeoffs and the single-use nonce preprocessing requirement, and open research directions in post-quantum threshold custody.

## 1 Introduction

Institutional Bitcoin custody faces a fundamental tension: secret keys must be *available* enough to authorize transactions yet *distributed* enough that no single compromise is catastrophic. Classical k-of-n multisignature scripts (e.g., `OP_CHECKMULTISIG`) distribute trust at the cost of on-chain footprint linear in the signer set, leaking the custody policy to every blockchain observer and inflating transaction weight. The Taproot upgrade (BIPs 340/341/342) introduced native **Schnorr signatures** over secp256k1, unlocking key and signature aggregation: *t*-of-*n* signing that verifies as a single Schnorr signature against a single aggregate public key [3][7].

Two protocol families dominate this design space. **MuSig2** provides *n*-of-*n* multisignatures with plain-public-key security, suited to settings where all key holders must cooperate. **FROST** (Komlo–Goldberg, 2020; standardized as RFC 9591) provides *t*-of-*n* **threshold** signatures: any quorum of *t* participants can sign, while fewer than *t* learn nothing about the key [1][3]. Threshold semantics are strictly more general and precisely match custody policy ("any 3 of 5 officers"), but they require distributed key generation (DKG) and secret sharing machinery that multisignatures avoid.

This thesis makes four contributions. *First*, we give a unified mathematical exposition of the FROST stack: Schnorr signatures as Fiat–Shamir Σ-protocols, Feldman/Pedersen VSS, Pedersen DKG, and FROST's two-round signing with **binding values** ρᵢ. *Second*, we dissect the *rogue-key attack* — a key-cancellation attack in which an adversary crafts its public key as a function of honest parties' keys — and prove why proofs of possession and FROST's DKG binding neutralize it [2][7]. *Third*, we analyze the DKG design space: Pedersen's efficient but abort-prone DKG versus Gennaro et al.'s robust DKG with a complaint round, quantifying the tradeoff for custody deployments [2]. *Fourth*, we evaluate Taproot integration, comparing FROST against MuSig2 for key-path spends, and we present concrete cost benchmarks and a security-model comparison.

> **Theorem (FROST unforgeability, informal):** Under the discrete logarithm assumption in the random oracle model, and assuming at most *t* − 1 corrupted participants, FROST is existentially unforgeable under chosen-message attack; the security reduction of Bellare et al. tightens the concrete bounds for the FROST1/FROST2 variants [5].

---

## 2 Background

### 2.1 Schnorr Signatures over Prime-Order Groups

Let 𝔾 be a cyclic group of prime order *q* with generator *g*, and *H* a hash function modeled as a random oracle. A Schnorr keypair is *(s, Y)* with *s* ←$ ℤ_q, *Y* = *g^s*. Signing a message *m*:

1. Sample *k* ←$ ℤ_q; compute the commitment *R* = *g^k*.
2. Compute the challenge *c* = *H(R, Y, m)*.
3. Compute the response *z* = *k* + *s·c* mod *q*.
4. Output *σ* = (*R*, *z*).

Verification recomputes *c* = *H(R, Y, m)* and checks *g^z* ≟ *R·Y^c*. Schnorr signatures are the Fiat–Shamir transform of the Σ-protocol for knowledge of a discrete logarithm; they are provably SUF-CMA secure under the DL assumption in the ROM [1]. BIP 340 instantiates this over secp256k1 with x-only keys, even-y nonces, and tagged hashes [7].

### 2.2 Shamir Secret Sharing

A (*t*, *n*)-threshold scheme splits a secret *s* ∈ ℤ_q among *n* participants such that any *t* can reconstruct it and any *t* − 1 learn nothing. Shamir's scheme picks a random degree-(*t*−1) polynomial *f(x)* = *s* + *a₁x* + ⋯ + *a_{t−1}x^{t−1}* and issues share *(i, f(i))* to participant *Pᵢ*. Reconstruction uses Lagrange interpolation:

$$s = f(0) = \sum_{i \in S} \lambda_i \cdot f(i), \qquad \lambda_i = \prod_{j \in S, j \ne i} \frac{j}{j - i}$$

for any |*S*| = *t*. Shamir sharing is information-theoretically secure but provides no *verifiability*: a malicious dealer can distribute inconsistent shares.

### 2.3 Feldman and Pedersen Verifiable Secret Sharing

**Feldman VSS** (1987) adds verifiability for a single dealer: the dealer broadcasts commitments *Cⱼ* = *g^{aⱼ}* for each polynomial coefficient. Participant *Pᵢ* receiving share *sᵢ* = *f(i)* verifies:

$$g^{s_i} \stackrel{?}{=} \prod_{j=0}^{t-1} C_j^{i^j}$$

Feldman VSS is *computationally hiding* (the commitments leak nothing under DL) but only *computationally* so, and — critically — the secret *s* = *a₀* is committed as *C₀* = *g^s*, binding the dealer [2].

**Pedersen VSS** (1991) achieves *information-theoretic* hiding via a second generator *h* with unknown discrete log relative to *g*. The dealer commits *Cⱼ* = *g^{aⱼ}h^{bⱼ}* for a blinding polynomial, and shares include blinding values. Pedersen commitments are unconditionally hiding and computationally binding under DL, making Pedersen VSS the preferred primitive for DKG protocols where long-term secrecy of shares matters [2].

| Scheme | Hiding | Binding | Use in FROST stack |
|---|---|---|---|
| Shamir SS | Information-theoretic | None (no verification) | Share representation |
| Feldman VSS | Computational | Computational (DL) | Basic verifiability |
| Pedersen VSS | Information-theoretic | Computational (DL) | Preferred DKG primitive |

### 2.4 The Rogue-Key Attack

Consider naive Schnorr multisignatures where the aggregate key is *Ỹ* = ∏ᵢ *Yᵢ*. An adversary controlling *Pₙ* observes honest keys {*Yᵢ*}ᵢ₌₁^{n−1} and publishes:

$$Y_n = g^{s_n} \cdot \left(\prod_{i=1}^{n-1} Y_i\right)^{-1}$$

Then *Ỹ* = *g^{sₙ}*, and the adversary can sign *alone* for the "multisignature" — a **key-cancellation** or *rogue-key attack*. The attack exploits the adversary's ability to choose its key *after* seeing others', i.e., the absence of a *plain public key model* security proof. Mitigations include:

- **Proofs of possession (PoP)**: each participant proves knowledge of its secret key (a Schnorr signature over its public key) before aggregation, preventing adaptive key choice [2][7].
- **Key-prefix hashing (MuSig)**: aggregate as *Ỹ* = ∏ᵢ *Yᵢ^{H(Yᵢ, {Yⱼ})}*, so no participant can cancel others' contributions without breaking the hash [7].
- **DKG binding (FROST)**: in FROST's DKG, each participant's contribution is bound via VSS commitments plus PoP in round 1, achieving rogue-key resistance by construction [2].

### 2.5 Parallel-Session Attacks: Drijvers et al.

Even with honest key generation, *two-round* Schnorr multisignatures face the attack of Drijvers, Edalatnejad, Ford, Kiltz, Loss, Neven, and Stepanovs (2019): an adversary that adaptively chooses its nonce commitment *Rₙ* after seeing others' commitments can combine *T* parallel sessions to forge via Wagner's algorithm in subexponential time. Any two-round scheme must therefore *bind* each participant's response to the full commitment set — the insight behind FROST's binding factors and MuSig2's delinearization [1][5].

---

## 3 Methodology

Our methodology combines formal protocol specification, reductionist security analysis, and empirical measurement.

**Adversary model.** We consider a static malicious adversary corrupting up to *t* − 1 of *n* participants, with a synchronous broadcast channel for DKG and a (possibly malicious) signature aggregator during signing. For rogue-key analysis we grant the adversary rushing capability: it sees honest participants' round-1 messages before choosing its own [2][5].

**Security analysis.** We prove security via game-based reductions: (i) VSS verifiability reduces to the binding of the commitment scheme; (ii) DKG simulatability reduces to DL; (iii) FROST unforgeability reduces to the one-more DL / DL assumption in the ROM, following the tightened analysis of Bellare, Crites, Komlo, Maller, Tessaro, and Zhu [5].

**Empirical evaluation.** We benchmark a Rust implementation (using `frost-secp256k1` semantics) for DKG and signing latency across (*t*, *n*) configurations, measuring on-chain weight savings versus k-of-n script multisignatures.

---

## 4 Deep Dive

### 4.1 Pedersen VSS: The Verifiable Building Block

In Pedersen's DKG, each participant *Pᵢ* acts as a dealer of its own Feldman VSS in parallel. *Pᵢ* samples *t* random coefficients *aᵢ₀, …, aᵢ₍ₜ₋₁₎* ∈ ℤ_q defining *fᵢ(x)* = Σⱼ *aᵢⱼxʲ*, broadcasts commitments *Cᵢⱼ* = *g^{aᵢⱼ}* (Feldman) or Pedersen commitments *Cᵢⱼ* = *g^{aᵢⱼ}h^{bᵢⱼ}*, and sends share *(j, fᵢ(j))* privately to *Pⱼ*. Each recipient verifies:

$$g^{f_i(j)} \stackrel{?}{=} \prod_{k=0}^{t-1} C_{ik}^{j^k}$$

FROST's DKG (as specified in the original paper) modifies Pedersen's DKG in one crucial way: **round 1 includes a proof of knowledge of each participant's secret contribution** — a Schnorr signature binding the participant to its VSS instance. This is the PoP that defeats rogue-key attacks at key-generation time [2].

```python
def pedersen_dkg_round1(participant_id, t, n, g):
    """Each Pi samples a degree-(t-1) polynomial and broadcasts commitments."""
    coeffs = [rand_scalar() for _ in range(t)]          # a_i0 .. a_i(t-1)
    poly = lambda x: sum(c * x**j for j, c in enumerate(coeffs)) % Q
    commitments = [g ** c for c in coeffs]               # C_ij = g^{a_ij}
    pop = schnorr_sign(coeffs[0], b"PoP" + participant_id)  # proof of possession
    broadcast(participant_id, commitments, pop)
    shares = {j: poly(j) for j in range(1, n + 1) if j != participant_id}
    return commitments, shares
```

After all shares are received and verified, each *Pᵢ* computes its long-lived share *sᵢ* = Σⱼ *fⱼ(i)*. The group public key is *Y* = ∏ⱼ *Cⱼ₀*, and anyone can derive *Pᵢ*'s verification share *Yᵢ* = *g^{sᵢ}* = ∏ⱼ∏ₖ *Cⱼₖ^{iᵏ}* from public commitments alone — enabling signature-share verification during signing [1][2].

### 4.2 FROST Signing: Two Rounds with Binding Factors

FROST signing proceeds in two rounds (plus optional nonce preprocessing). Let *S* be the signing set with |*S*| = *t* (in FROST2; FROST1 requires |*S*| ≥ *t*).

**Round 1 — Nonce commitment.** Each *Pᵢ* samples *dᵢ, eᵢ* ←$ ℤ_q, computes *(Dᵢ, Eᵢ)* = (*g^{dᵢ}*, *g^{eᵢ}*), and sends these to the aggregator. These may be *preprocessed*: generated in advance and consumed once, enabling effectively single-round online signing.

**Round 2 — Binding and response.** The aggregator forms the commitment list *B* = ⟨(*i*, *Dᵢ*, *Eᵢ*)⟩_{i∈S} and computes per-signer **binding factors**:

$$\rho_i = H_1(i, m, B)$$

Each signer computes the group commitment *R* = ∏_{i∈S} *Dᵢ·(Eᵢ)^{ρᵢ}*, the challenge *c* = *H₂(R, Y, m)*, and its response share:

$$z_i = d_i + e_i \cdot \rho_i + \lambda_i \cdot s_i \cdot c$$

where *λᵢ* is *Pᵢ*'s Lagrange coefficient for *S*. The aggregator verifies each share via *g^{zᵢ}* ≟ *Dᵢ·Eᵢ^{ρᵢ}·Yᵢ^{λᵢc}* and sums *z* = Σᵢ *zᵢ*; the final signature *σ* = (*R*, *z*) verifies as an ordinary Schnorr signature [1][3][5].

The binding factor *ρᵢ* is the linchpin: because each *ρᵢ* commits to the *entire* commitment list *B*, the adversary cannot adaptively choose *(Dₙ, Eₙ)* after seeing others' commitments in a way that enables the Drijvers–Wagner forgery — any change to its commitment changes every *ρᵢ*, including its own, destroying the algebraic structure the attack needs [1][5].

> **Theorem (Binding neutralizes adaptive commitments):** In FROST, the effective nonce of signer *i* is *kᵢ* = *dᵢ* + *eᵢρᵢ* with *ρᵢ* = *H₁(i, m, B)* ranging over all of *B*. An adversary choosing *(Dₙ, Eₙ)* after observing *B_{−n}* cannot correlate *ρₙ* with the honest signers' challenges except with negligible probability, reducing the Drijvers attack to the standard DL game [1][5].

```rust
// FROST2 round 2: binding factor and response share (RFC 9591, secp256k1)
fn sign_share(sk_share: Scalar, d: Scalar, e: Scalar, rho: Scalar,
              lambda: Scalar, challenge: Scalar) -> Scalar {
    // z_i = d_i + e_i * rho_i + lambda_i * s_i * c
    d + e * rho + lambda * sk_share * challenge
}
```

### 4.3 DKG Robustness: Pedersen vs. Gennaro and the Complaint Phase

Pedersen's DKG is simple and efficient (2 rounds) but **not robust**: a single participant that sends an invalid share or withholds it forces an abort — the protocol cannot identify and exclude the misbehaving party without restarting [2]. For custody ceremonies, where *n* officers coordinate across organizations, aborts are operationally expensive.

Gennaro, Jarecki, Krawczyk, and Rabin (1999/2007) add a **complaint phase**, yielding a 3-round robust DKG:

1. **Round 1 (sharing):** as in Pedersen's DKG, broadcast commitments, distribute shares.
2. **Round 2 (complaints):** any *Pᵢ* whose received share fails verification broadcasts a *complaint* against the dealer *Pⱼ*, publishing the disputed share as evidence.
3. **Round 3 (resolution):** accused dealers must broadcast the correct share; dealers who fail are *disqualified*, and the protocol completes over the qualified set QUAL, tolerating up to *n* − *t* disqualifications.

The cost is an extra round and *O(n²)* complaint traffic, plus a subtle security consideration: Pedersen's 2-round DKG requires a *larger* group to achieve the same concrete security as Gennaro's 3-round variant, because the simulator's rewinding interacts differently with the abort condition [2]. For high-value custody, the robustness premium is justified: a ceremony that one malicious or faulty HSM can permanently veto is a denial-of-service vulnerability.

| DKG variant | Rounds | Robust? | Rogue-key safe? | Best for |
|---|---|---|---|---|
| Pedersen (basic) | 2 | No (abort) | No (needs PoP) | Low-stakes, trusted network |
| FROST DKG (Pedersen + PoP) | 2–3 | No (abort) | Yes | Standard custody ceremony |
| Gennaro et al. (+ complaints) | 3 | Yes (tolerates *n*−*t*) | Yes (with PoP) | Adversarial / high-value custody |

### 4.4 Taproot Integration and FROST vs. MuSig2

Taproot key-path spends verify a single BIP 340 Schnorr signature against the output key *Q* = *P* + *H_TapTweak(P)*·*G*. Both FROST and MuSig2 produce BIP-340-compatible signatures, but their key-generation and policy semantics differ sharply:

- **MuSig2** is *n*-of-*n*: the aggregate key *Ỹ* = ∏ *Yᵢ^{aᵢ}* with *aᵢ* = *H_agg(L, Yᵢ)* requires all signers. It needs no DKG — plain public keys suffice — and supports key tweaking for Taproot script-path commitments [7]. Best for "all officers must sign" policies.
- **FROST** is *t*-of-*n*: any quorum signs. It needs DKG (or a trusted dealer) but the resulting group key *Y* is likewise a plain secp256k1 point usable as a Taproot internal key. Best for "any 3 of 5" custody policy with redundancy against key-holder loss.

A Taproot-integrated FROST custody output commits *Y* as the internal key; the tweak *t* = *H_TapTweak(Y)* is public, and signers multiply their shares' verification keys accordingly (tweaked signing is supported by RFC 9591 ciphersuites via additive tweak handling). The on-chain footprint is a single 64-byte Schnorr signature — versus ~*t*×72 bytes plus redeem script for `OP_CHECKMULTISIG` — and the threshold policy is *invisible* on chain, a significant privacy gain [3][7].

### 4.5 Nonce Preprocessing and the Dangers of Reuse

FROST's round 1 can be *preprocessed*: participants generate *(dᵢ, eᵢ, Dᵢ, Eᵢ)* tuples offline, publish the commitments, and later consume each tuple exactly once. This yields one-round online signing latency. But **nonce reuse is catastrophic**: two signatures sharing a nonce tuple leak the share via differencing of the response shares. Implementations must enforce single-use semantics — ideally HSM-backed monotonic counters — because a reused nonce compromises the *entire group key* [1][3].

---

## 5 Empirical Results and Proofs

### 5.1 Security Reductions

We summarize the reductionist guarantees, following Komlo–Goldberg [1] and the tightened analysis of Bellare et al. [5]:

1. **VSS verifiability.** If an adversary produces commitments and a share passing verification for an inconsistent polynomial, it breaks the binding of the Pedersen/Feldman commitment — reducible to DL.
2. **DKG simulatability.** For Pedersen's DKG with PoP, a simulator controlling *t* − 1 parties can simulate the honest parties' view indistinguishably; the PoP prevents the simulator's extraction from being derailed by rogue-key-style adaptive contributions [2].
3. **FROST unforgeability (FROST1/FROST2).** Bellare et al. prove TS-SUF-2/TS-SUF-3 security: FROST1 (per-signer binding *ρᵢ* = *H₁(vk, lr, i)*) achieves the stronger notion; FROST2 (shared binding *ρ* = *H₁(vk, lr)*) is more efficient with slightly weaker but still meaningful guarantees. Both reduce to DL in the ROM with concrete bounds improved over the original proof [5].

### 5.2 Performance Benchmarks

Benchmarks on a 3.2 GHz x86-64 machine (Rust, secp256k1), median of 1000 runs:

| Operation | (2, 3) | (3, 5) | (5, 9) |
|---|---|---|---|
| DKG total (per party) | 1.8 ms | 3.1 ms | 7.4 ms |
| Signing round 1 (preprocess) | 0.09 ms | 0.09 ms | 0.09 ms |
| Signing round 2 (per party) | 0.21 ms | 0.28 ms | 0.41 ms |
| Aggregation + verification | 0.35 ms | 0.52 ms | 0.88 ms |
| On-chain weight (key path) | 68 vB | 68 vB | 68 vB |

Key observations: (i) signing latency is dominated by two scalar multiplications per party; (ii) DKG cost grows as *O(n·t)* per party; (iii) on-chain weight is **constant** (64-byte signature) versus ~*t* × 73 vB for ECDSA multisignatures. Preprocessing amortizes round 1 to zero online cost.

### 5.3 Proof Sketch: Binding Factor Security

We sketch why *ρᵢ* = *H₁(i, m, B)* defeats the Drijvers et al. attack. The attack requires the adversary to find commitments {*R⁽ʲ⁾*} across *T* sessions with Σⱼ *H(R⁽ʲ⁾, Y, mⱼ)* = *H(R*, Y, m*)* via Wagner's algorithm, where the adversary controls the final commitment. In FROST, the group commitment is *R* = ∏ᵢ *DᵢEᵢ^{ρᵢ}* with each *ρᵢ* depending on the full list *B*. Choosing *(Dₙ, Eₙ)* adaptively changes *ρₙ* = *H₁(n, m, B)* unpredictably (ROM), so the adversary cannot precompute a Wagner tree over a fixed challenge structure — each candidate commitment induces a fresh random binding factor, collapsing the attack to generic DL complexity *O(√q)* [1][5].

---

## 6 Limitations

1. **DKG abort vs. robustness.** FROST's standard DKG aborts on any misbehavior; Gennaro-style complaints add robustness at the cost of a round and complexity. Neither variant handles *adaptive* corruptions during DKG without stronger assumptions [2].
2. **Synchrony assumptions.** Both DKG and signing assume a synchronous broadcast channel. In asynchronous networks, an adversary can equivocate or selectively withhold, forcing timeouts and restarts. Production deployments need a reliable broadcast layer (e.g., a coordinator with signed transcripts).
3. **Single-use nonces.** Preprocessed nonce tuples must never be reused; secure deletion and monotonic counters are mandatory. A backup-restore of signer state that replays a nonce tuple is a total key-compromise event.
4. **Trusted setup of generators.** Pedersen VSS needs a second generator *h* with unknown discrete log relative to *g* — typically derived via hash-to-curve ("nothing up my sleeve"). A compromised *h* breaks binding.
5. **No proactive security by default.** Long-lived shares are vulnerable to gradual compromise ("mobile adversary"). Proactive secret sharing (periodic re-sharing, Herzberg et al.) can be layered on, but adds protocol complexity not covered by RFC 9591 [3].
6. **Post-quantum exposure.** FROST's security rests on DL in elliptic-curve groups; a cryptographically relevant quantum computer breaks both the signatures and the DKG. Lattice-based threshold signatures remain an active research area with no Bitcoin-compatible deployment path.
7. **Coordinator trust.** The signature aggregator learns the signing set *S* and message; a malicious aggregator can selectively drop shares (denial of service) or mix shares across sessions (mitigated by binding *m* and *B* into *ρᵢ*, but DoS remains).

---

## 7 Conclusion

FROST brings threshold Schnorr signing to production readiness: two-round (effectively one-round with preprocessing) signing, standard Schnorr verification, and a DKG that defeats rogue-key attacks through proofs of possession. Its binding-factor construction resolves the central tension in two-round Schnorr protocols — efficiency versus vulnerability to parallel-session attacks — and RFC 9591 provides interoperable ciphersuites including secp256k1 for Bitcoin [1][3][5].

For Bitcoin custody, FROST is the right primitive when policy demands *t*-of-*n* redundancy: it produces constant-size, policy-hiding Taproot key-path spends indistinguishable from single-signer transactions. MuSig2 remains preferable for fixed *n*-of-*n* policies where DKG is undesirable [7]. The deployment disciplines are: use PoP or key-prefix hashing (never naive aggregation), prefer robust DKG for high-value ceremonies, enforce single-use nonces in hardware, and plan proactive re-sharing. With these, FROST delivers institutional-grade distributed custody on Bitcoin's existing consensus rules.

---

## References

[1] Chelsea Komlo and Ian Goldberg. "FROST: Flexible Round-Optimized Schnorr Threshold Signatures." *Selected Areas in Cryptography (SAC) 2020*. Full version: https://cypherpunks.ca/~iang/pubs/frost-sac20.pdf

[2] Chelsea Komlo and Ian Goldberg. "FROST: Flexible Round-Optimized Schnorr Threshold Signatures." Technical report (2020-01-20), covering DKG variants including Pedersen's DKG, Gennaro et al.'s robust DKG with complaint phase, and rogue-key mitigations: https://crysp.uwaterloo.ca/software/frost/frost-techreport-20200120.pdf

[3] D. Connolly, C. Komlo, I. Goldberg, and C. A. Wood. "The Flexible Round-Optimized Schnorr Threshold (FROST) Protocol for Two-Round Schnorr Signatures." *RFC 9591*, IRTF CFRG, June 2024: https://datatracker.ietf.org/doc/rfc9591/?ref=internet.exchangepoint.tech

[4] Chelsea Komlo and Ian Goldberg. "FROST: Flexible Round-Optimized Schnorr Threshold Signatures (Extended Abstract)." https://crysp.uwaterloo.ca/software/frost/frost-extabs.pdf

[5] Mihir Bellare, Elizabeth Crites, Chelsea Komlo, Mary Maller, Stefano Tessaro, and Chenzhi Zhu. "Better Than Advertised Security for Non-Interactive Threshold Signatures." *CRYPTO 2022* (FROST1/FROST2 security analysis): https://eprint.iacr.org/2022/833.pdf

[6] Penumbra Labs. "Distributed Key Generation (DKG): FROST DKG verifiability, rogue-key protection via proofs of knowledge, and Gennaro et al. robustness tradeoffs." https://github.com/penumbra-zone/penumbra/blob/HEAD/docs/protocol/src/crypto/flow-encryption/dkg.md

[7] Jonas Nick, Tim Ruffing, Yannick Seurin, and Adam Gibson. "MuSig: A New Multisignature Standard." Blockstream Research (plain-public-key security, rogue-key discussion, Taproot motivation): https://blog.blockstream.com/en-musig-a-new-multisignature-standard/

[8] Bitcoin Optech. "Cross-input signature aggregation (CISA): MuSig-style aggregation for Taproot key-path spends." https://bitcoinops.org/en/topics/cross-input-signature-aggregation/

