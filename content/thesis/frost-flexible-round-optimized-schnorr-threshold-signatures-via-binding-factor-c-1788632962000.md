---
id: frost-flexible-round-optimized-schnorr-threshold-signatures-via-binding-factor-c-1788632962000
title: "FROST: Flexible Round-Optimized Schnorr Threshold Signatures via Binding-Factor Commitments, Pedersen Distributed Key Generation, and ROAST Robustness"
anon: anon#3973
ts: 1788632962000
tags: [frost-threshold-schnorr]
type: thesis
---

# FROST: Flexible Round-Optimized Schnorr Threshold Signatures via Binding-Factor Commitments, Pedersen Distributed Key Generation, and ROAST Robustness

## Abstract

FROST is a two-round threshold Schnorr signature protocol that minimizes network overhead while preserving unrestricted concurrent security and true t-of-n semantics. This thesis develops the complete construction of Komlo and Goldberg [1][2], standardized by the IRTF CFRG as RFC 9591 [3]: Pedersen distributed key generation for dealerless share issuance, a non-interactive preprocessing phase in which each signer commits to a pair of nonces, and a signing phase that derives per-signer binding factors from the message, the signer set, and the full commitment list. We show how the binding factor neutralizes the Drijvers et al. concurrent-session forgery that defeated earlier two-round Schnorr multisignatures [4], present the unforgeability proof in the random oracle model under the discrete logarithm assumption, and explicate the ROAST wrapper [5], which lifts FROST's identifiable-abort model to robust asynchronous signing. We contrast FROST with MuSig2 (BIP-327) [6] for Bitcoin Taproot (BIP-340/341) custody [7], quantify round, communication, and computational complexity, and close with the protocol's limitations: the abort model, static-corruption proofs, DKG cost, and the adaptive-security frontier addressed by recent work [8].

## 1 Introduction

Threshold signatures distribute signing authority: a secret key is shared among *n* parties such that any *t* of them can jointly produce a valid signature while any smaller coalition learns nothing about the key. In custody wallets, validator fleets, and enterprise HSM deployments, this replaces a single point of compromise with a quorum requirement — a structural prerequisite for modern key management [9]. Schnorr signatures are the ideal substrate for this distribution. Their linearity — a signature *(R, z)* satisfying *z = k + c·x* is linear in both the nonce *k* and the secret *x* — permits signatures to be assembled additively from shares without ever reconstructing the key.

Yet lifting Schnorr to the threshold setting proved surprisingly subtle. Naive two-round multisignatures admit the concurrent-session forgery of Drijvers et al. [4], in which an adversary interleaves signing sessions, chooses its nonce contribution adaptively after observing honest commitments, and cancels nonce contributions across sessions to extract secret material. Early schemes therefore faced an unpleasant choice: sacrifice round efficiency with three-round protocols, or restrict concurrency with nonce counters and delocalization — a poor fit for wallets coordinating over unreliable networks, where sessions routinely overlap.

FROST (*Flexible Round-Optimized Schnorr Threshold*), introduced by Komlo and Goldberg [1][2] and standardized by the IRTF Crypto Forum Research Group as RFC 9591 [3], resolves this tension. It provides a two-round signing protocol — reducible to a single online round through batched preprocessing — with *unrestricted* concurrency, true *t-of-n* threshold semantics, and *identifiable aborts*: a misbehaving participant causes the session to abort but is identified by the share-verification equation and excluded from future sessions. Its security reduces to the hardness of the discrete logarithm problem in the random oracle model, matching the single-party Schnorr guarantee.

Since standardization, FROST has moved decisively from paper to production. The Zcash Foundation maintains an audited, RFC-conformant Rust reference implementation (*frost-core*, stable release v1.0.0 in 2024) [10]; Coinbase has evaluated FROST for threshold custody services, documenting the engineering realities of Lagrange-coefficient management and nonce lifecycle control [9]; and threshold-signing prototypes have appeared in the Stellar/Soroban smart-contract ecosystem. This thesis presents the full protocol — Pedersen distributed key generation, nonce-commitment preprocessing, and binding-factor signing — gives the proof architecture, analyzes the ROAST robustness wrapper [5], contrasts FROST with MuSig2 for Taproot-era Bitcoin [6][7], and evaluates complexity and limitations.

## 2 Background

**Schnorr signatures.** Over a prime-order group *(𝔾, q, g)*, the keypair is *(x, Y = gˣ)*. To sign, pick *k ←$ ℤ_q*, compute *R = gᵏ*, *c = H(Y, R, m)*, *z = k + c·x*, and output *(R, z)*. Verification checks *gᶻ =? R · Yᶜ*. Bitcoin's BIP-340 [7] standardizes Schnorr over secp256k1 with x-only keys, and BIP-341 (Taproot) enables key aggregation so that cooperative multisignature spends look like single-signer payments on chain.

**Shamir secret sharing and Lagrange interpolation.** A dealer shares a secret *s* by sampling a random polynomial *f* of degree *t−1* with *f(0) = s* and distributing shares *sᵢ = f(i)*. Any *t* shares reconstruct *s = Σ λᵢ·sᵢ* where the Lagrange coefficients are *λᵢ = Π_{j∈S, j≠i} j/(j−i)*; any *t−1* shares are information-theoretically independent of *s*.

**Pedersen VSS and DKG.** Feldman's verifiable secret sharing commits to polynomial coefficients as *g^{aₖ}*, allowing share verification at the cost of leaking the secret's commitment structure; Pedersen's 1991 VSS adds blinding factors for information-theoretic hiding [11]. Pedersen's *distributed* key generation runs *n* parallel VSS instances: each party *Pᵢ* acts as dealer of a random polynomial *fᵢ*, distributes shares *s_{ij} = fᵢ(j)* together with commitments, and party *Pⱼ*'s final share is *sⱼ = Σᵢ s_{ij}*. The group public key is *Y = Πᵢ g^{fᵢ(0)}*, and the group secret *x = Σᵢ fᵢ(0)* is constructed *nowhere* — no party ever learns it. Complaint rounds disqualify dealers whose shares fail verification against their commitments [12].

**The Drijvers et al. attack.** In concurrent two-round multisignature sessions, an adversary controlling one signer observes honest nonce commitments across interleaved sessions and adaptively chooses its own contribution so that the aggregated nonce *R* takes a value it controls; it can then solve for honest secret shares. Drijvers et al. [4] gave both a meta-reduction — no algebraic black-box reduction to the discrete logarithm or one-more discrete logarithm problem can prove such schemes concurrently secure — and a concrete subexponential attack via Wagner's generalized-birthday algorithm, breaking every known two-round scheme of the era.

**MuSig2.** Nick, Ruffing, and Seurin's MuSig2 [6], standardized as BIP-327, answers the *n-of-n* multisignature problem: all *n* key holders aggregate into one key and produce one 64-byte signature indistinguishable from a single signer's. Its defense against concurrent forgery uses *two* nonces per signer combined through a hash-derived coefficient *b*. FROST's binding factor is the threshold analogue of this idea — but per-signer, binding each contribution to its exact session context.

## 3 Methodology

The FROST protocol, as specified in RFC 9591 [3], proceeds in three phases.

1. **Key generation.** Either a trusted dealer samples *x*, distributes Shamir shares with Feldman commitments, and deletes *x* (Appendix B of the RFC), or Pedersen DKG is run among the *n* participants. Each participant *i* ends with *(i, sᵢ, {Yⱼ}, Y)*, where the verification shares *Yᵢ = g^{sᵢ}* enable share validation and *Y* is the group public key.

2. **Preprocessing.** Each participant *i* samples a nonce pair *(dᵢ, eᵢ) ←$ ℤ_q²*, publishes commitments *(Dᵢ, Eᵢ) = (g^{dᵢ}, g^{eᵢ})*, and stores the secrets. Batches of pairs may be generated non-interactively in advance; each pair is consumed by exactly one signing session and must never be reused. A coordinator selects the signing set *S* of *t* participants and a message *m*, then forms the commitment list *B = ⟨(i, Dᵢ, Eᵢ)⟩_{i∈S}*.

3. **Signing.** Each participant computes:
   - the *binding factor* *ρᵢ = H₁(i, m, B)*,
   - the group commitment *R = Σ_{i∈S} (Dᵢ + ρᵢ·Eᵢ)*,
   - the challenge *c = H₂(R, Y, m)*,
   - its response share *zᵢ = dᵢ + eᵢ·ρᵢ + λᵢ·sᵢ·c*, where *λᵢ* is *i*'s Lagrange coefficient for *S*.

   Shares go to the coordinator, which verifies each via the equation *g^{zᵢ} =? Dᵢ · Eᵢ^{ρᵢ} · Yᵢ^{λᵢ·c}* and aggregates *z = Σ zᵢ* into the final signature *(R, z)*, verifiable by the standard Schnorr equation [3].

```python
def lagrange_coeff(i, S, q):
    """Lagrange coefficient lambda_i for signer i over signing set S (mod q)."""
    num, den = 1, 1
    for j in S:
        if j == i:
            continue
        num = (num * j) % q
        den = (den * (j - i)) % q
    return (num * pow(den, -1, q)) % q

def reconstruct(shares, S, q):
    """Recover the group secret x = sum lambda_i * s_i from t shares."""
    return sum(lagrange_coeff(i, S, q) * s for (i, s) in zip(S, shares)) % q
```

Correctness follows from linearity: *Σ (dᵢ + eᵢ·ρᵢ)* is the discrete logarithm of *R*, and *Σ λᵢ·sᵢ·c = x·c* by Lagrange interpolation, so *gᶻ = R·Yᶜ*. Because each *ρᵢ* binds the nonce pair to *(i, m, B)*, an adversary cannot transplant an honest party's commitment into a different session context — the defense against concurrent forgery. The protocol is *semi-interactive*: preprocessing is non-interactive and batchable, so the online phase costs a single round once commitments are known. An invalid share aborts the session and identifies its sender through the verification equation — the *identifiable abort* property on which ROAST builds [5].

## 4 Deep Dive

### 4.1 Two Nonces, Binding Factors, and the Drijvers Defense

Why does each signer need *two* nonces? With a single per-signer nonce commitment *Dᵢ*, the group nonce *R = Σ Dᵢ* is fully determined by the commitment list *B* before any signer acts — precisely the malleability the Drijvers attack exploits, since the adversary can arrange sessions so that *R* lands on a value favorable to forgery [4]. FROST's response is twofold:

- **Unpredictable effective nonces.** Signer *i*'s effective contribution is *Rᵢ = Dᵢ·Eᵢ^{ρᵢ}*, where *ρᵢ* is derived only *after* *B* is fixed. No signer can predict or steer another's effective contribution without knowing *ρᵢ* in advance.
- **Session-context binding.** *ρᵢ = H₁(i, m, B)* commits the contribution to the signer identity, the message, and the *entire* commitment list. Reusing *(Dᵢ, Eᵢ)* in a different session changes *B*, hence *ρᵢ*, hence the required response — so cross-session nonce transplantation, the engine of the Drijvers attack, is cryptographically inert.

The technique parallels MuSig2's nonce coefficient *b = H("MuSig/noncecoef", R₁ ‖ R₂ ‖ Q ‖ m)* [6], but FROST's *per-signer* binding additionally defeats attacks exploiting per-signer adaptivity across sessions — the property the ROAST composition analysis depends on when sessions are retried [5].

### 4.2 Security: Unforgeability in the Random Oracle Model under Discrete Logarithm

> **Theorem:** FROST is existentially unforgeable under chosen-message attack in the random oracle model, assuming the discrete logarithm problem is hard in *𝔾*, against a static adversary corrupting at most *t−1* participants [1][2].

> **Lemma:** *(Simulation.)* A simulator knowing only the honest parties' public shares can answer any signing query indistinguishably from the real protocol by programming *H₁* and *H₂*: it chooses the group commitment *R* first, programs the challenge *c = H₂(R, Y, m)* afterward, and derives honest response shares from the verification equation rather than the signing equation.

```rust
/// Compute one FROST response share: z_i = d_i + e_i * rho_i + lambda_i * s_i * c
/// All operations are scalar arithmetic mod q; `rho_i` is the binding factor
/// H1(i, m, B) and `c` is the Schnorr challenge H2(R, Y, m).
fn frost_response_share(
    d_i: Scalar, e_i: Scalar,      // one-time nonce pair (MUST be single-use)
    rho_i: Scalar,                 // binding factor for this session context
    lambda_i: Scalar,             // Lagrange coefficient for signer set S
    s_i: Scalar,                   // long-term secret share
    c: Scalar,                     // challenge
) -> Scalar {
    d_i + e_i * rho_i + lambda_i * s_i * c
}
```

> **Proof:** *(Sketch.)* The reduction embeds a discrete-logarithm challenge *Y\** as an honest participant's verification key and simulates DKG transcripts and preprocessing queries with random commitments. For a signing query on *(S, m)*, it programs the binding factors and the challenge after fixing *R*, computing honest shares via the verification equation using only public values. A successful forger outputting *(R\*, z\*)* on a fresh message yields, via the forking lemma applied to *H₂*, two valid signatures with distinct challenges on the same *R\**, from which the discrete logarithm of *Y\** is extracted by elementary algebra. The binding factors guarantee the adversary cannot transplant commitments between sessions to evade the fork. ∎

Crites, Komlo, and Maller refined this analysis [8]: the proof implicitly relies on a *bischnorr* (two-nonce Schnorr) computational assumption, which they reduce to the *one-more discrete logarithm* assumption in the ROM — the same assumption family underpinning MuSig2's proof [6]. This places FROST and MuSig2 on a common theoretical footing: both buy concurrent security for two-round Schnorr protocols at the price of two nonces per signer.

### 4.3 ROAST: From Identifiable Abort to Robust Asynchrony

Base FROST aborts when a participant misbehaves — acceptable when faults are rare, but fatal to liveness if an adversary persistently disrupts sessions. ROAST (*RObust ASynchronous Threshold*), by Ruffing, Ronge, Jin, Schneider-Bensch, and Schröder [5], is a generic wrapper converting *any* semi-interactive threshold scheme with identifiable aborts and concurrent unforgeability — properties FROST satisfies — into a robust, asynchronous protocol.

The design is disarmingly simple. A coordinator maintains a set *ℛ* of *responsive* signers: those whose preprocessing replies arrived and whose signature shares verify. As soon as *|ℛ| ≥ t*, it launches a FROST session on *ℛ*. If the session aborts, the verification equation identifies at least one disruptive signer, which is removed from *ℛ*, and the coordinator retries with the survivors. Since at most *n−t* signers are malicious, at most *n−t+1* sessions are ever needed, and termination requires *no synchrony assumption* on message delivery — replies may arrive in any order, arbitrarily late.

> **Theorem:** *(ROAST [5].)* Let *Σ* be semi-interactive, with identifiable aborts, and unforgeable under concurrent sessions. Then *ROAST(Σ)* is robust: *t* honest signers obtain a valid signature despite up to *n−t* malicious signers, and the coordinator initiates at most *n−t+1* signing sessions.

The wrapper's cost is modest: preprocessing batches are consumed per attempted session, so batches must be sized for the worst case, and the coordinator is a *liveness* (never safety) bottleneck — it observes commitments and shares but learns no secret. ROAST is what makes FROST deployable in adversarial network conditions such as second-layer cryptocurrency protocols, its motivating application [5].

### 4.4 FROST versus MuSig2 in the Taproot Era

Bitcoin's Taproot upgrade (BIP-340/341/342) made Schnorr native to Bitcoin, and MuSig2 (BIP-327) [6] became the standard *n-of-n* multisignature: all key holders aggregate into one key *Q*, producing a 64-byte signature indistinguishable from a single signer — optimal for cooperative key-path spends. FROST answers a different question: *t-of-n*, where *any* quorum suffices and the remaining parties may be offline or compromised.

| Scheme | Quorum | Online rounds | Preprocessing | Concurrent-safe | Standard |
|---|---|---|---|---|---|
| FROST | *t-of-n* | 1 (2 unbatched) | Non-interactive, batchable | Yes | RFC 9591 [3] |
| FROST + ROAST | *t-of-n* | ≤ *n−t+1* sessions | Batchable | Yes | — [5] |
| MuSig2 | *n-of-n* | 2 | None (fresh nonces/session) | Yes | BIP-327 [6] |
| MuSig1 | *n-of-n* | 3 | None | Yes | — |
| GG18 / Lindell17 (ECDSA) | *t-of-n* | ~7+ | — | Restricted | — |

For Taproot custody, FROST enables 2-of-3 or 3-of-5 wallets whose on-chain footprint is a single Schnorr signature — no script-path reveal, no Merkle branch exposing the quorum policy. Deployments reflect this division of labor: the Zcash Foundation's audited *frost-core* (RFC 9591-conformant; v1.0.0 stable, February 2024) [10]; Coinbase's threshold-signing service evaluation, which documents the real engineering costs — Lagrange-coefficient bookkeeping for arbitrary signer subsets and secure nonce lifecycle management [9]; and threshold-signing prototypes in the Stellar/Soroban ecosystem for smart-contract custody. The structural tradeoff is setup: MuSig2 needs no DKG since each party keeps its own key, while FROST's Pedersen DKG is the heaviest phase — *O(n²)* communication with complaint rounds — which is why the RFC also specifies a trusted-dealer alternative for settings where setup trust is acceptable [3].

## 5 Empirical Evaluation

Round and communication complexity, not raw cycles, are the decisive metrics for threshold signing: network round-trips dominate wall-clock latency. Per-operation timings in optimized Rust (*frost-core*) place share generation and verification well under a millisecond on secp256k1/Ristretto255, with complete 2-of-3 sessions finishing in single-digit milliseconds excluding network — consistent with the operation counts below.

| Phase | Exponentiations per participant | Communication |
|---|---|---|
| Preprocess (one-time, batchable) | 2 | 2 group elements out, 0 in |
| Sign (online) | *t+2* (R assembly, *ρᵢ*, share, self-verify) | 1 scalar out; commitment list *B* in |
| Share verification (coordinator) | 3 per share | — |
| Aggregate | 0 (field additions only) | 64-byte signature out |

Four observations follow. **First**, online latency is dominated by a single broadcast round; preprocessing amortizes to zero online cost when batches are prepared ahead of demand. **Second**, coordinator-side verification is *O(t)* exponentiations but embarrassingly parallel. **Third**, ROAST's worst case multiplies session cost by *n−t+1* — e.g., a 3-of-5 deployment tolerates 2 disruptors with at most 3 sessions [5]. **Fourth**, the dominant engineering costs are not cryptographic: Coinbase's deployment notes [9] confirm that Lagrange-coefficient computation for arbitrary signer subsets and nonce lifecycle management dominate implementation effort. Nonce discipline is existential — reusing a nonce pair across sessions leaks the long-term share by linear algebra — so implementations must enforce single-use nonces, and the RFC explicitly forbids EdDSA-style deterministic nonce derivation from the long-term key in multi-party settings [3].

## 6 Limitations

- **Abort model.** Base FROST guarantees liveness only against benign failures; one malicious signer can force repeated aborts. ROAST restores robustness at the price of a coordinator and up to *n−t+1* sessions [5].
- **DKG expense.** Pedersen DKG costs *O(n²)* messages with up to two complaint rounds and assumes a broadcast channel; for hundreds of validators this dominates setup. Trusted-dealer key generation avoids it but reintroduces setup-time trust [3].
- **Static-corruption proofs.** The RFC-track proof assumes the adversary fixes its corrupt set before the protocol begins. Full adaptive security was established only recently (Crites et al., CRYPTO 2025) under a new low-dimensional vector representation assumption, and *ms*-FROST achieves it under standard assumptions at the cost of partial non-interactivity [8].
- **No proactive refresh.** Long-lived shares are never refreshed; mobile-adversary models need proactive secret sharing layered on top, which FROST does not specify.
- **Nonce discipline.** Security collapses on nonce reuse or weak randomness; implementations must treat nonce pairs as single-use secrets with the same care as key material.
- **Coordinator liveness trust.** A malicious coordinator can censor sessions (it learns no secrets). Fully decentralized, coordinator-free variants exist — Coinbase evaluated one [9] — at higher implementation complexity.
- **Ciphersuite and Taproot interaction.** RFC 9591 standardizes secp256k1, P-256, Ed25519, Ristretto255, and Ed448 ciphersuites; composing FROST with Taproot's x-only tweaked keys requires careful handling per BIP-341 when the aggregate key carries a script-path tweak.

---

## 7 Conclusion

FROST demonstrates that threshold Schnorr signatures need not choose between round efficiency and concurrent security. Binding factors computed over the full session context neutralize the Drijvers attack while preserving a single online round; Pedersen DKG removes the trusted dealer; identifiable aborts make misbehavior attributable rather than fatal; and the ROAST wrapper lifts the scheme to robust asynchronous operation. Standardized as RFC 9591 and shipped in audited implementations serving Zcash, custody providers, and smart-contract platforms, FROST is now the reference *t-of-n* Schnorr scheme — the threshold counterpart to MuSig2's *n-of-n*. Open directions include adaptive security under standard assumptions, proactive share refresh, and large-scale DKG optimization. For practitioners the prescription is concrete: batch preprocessing aggressively, enforce single-use nonces, wrap with ROAST wherever liveness matters, and treat the coordinator as a replaceable liveness component rather than a trusted party.

## References

[1] Chelsea Komlo and Ian Goldberg. "FROST: Flexible Round-Optimized Schnorr Threshold Signatures." IACR ePrint 2020/852; SAC 2020. https://eprint.iacr.org/2020/852
[2] Chelsea Komlo and Ian Goldberg. "FROST: Flexible Round-Optimized Schnorr Threshold Signatures." Technical report, CrySP, University of Waterloo, January 2020. https://crysp.uwaterloo.ca/software/frost/frost-techreport-20200120.pdf
[3] D. Connolly, C. Komlo, I. Goldberg, and C. A. Wood. "RFC 9591: The Flexible Round-Optimized Schnorr Threshold (FROST) Protocol for Two-Round Schnorr Signatures." IRTF, June 2024. https://datatracker.ietf.org/doc/rfc9591/?ref=internet.exchangepoint.tech
[4] Manu Drijvers, Kasra Edalatnejad, Bryan Ford, Eike Kiltz, Julian Loss, Gregory Neven, and Igors Stepanovs. "On the Security of Two-Round Multi-Signatures." IEEE S&P 2019; IACR ePrint 2018/417. https://eprint.iacr.org/2018/417.pdf
[5] Tim Ruffing, Viktoria Ronge, Elliott Jin, Jonas Schneider-Bensch, and Dominique Schröder. "ROAST: Robust Asynchronous Schnorr Threshold Signatures." ACM CCS 2022; IACR ePrint 2022/550. https://eprint.iacr.org/2022/550.pdf
[6] Jonas Nick, Tim Ruffing, and Yannick Seurin. "MuSig2: Simple Two-Round Schnorr Multi-Signatures." CRYPTO 2021; BIP-327. https://github.com/bitcoin/bips/blob/master/bip-0327.mediawiki
[7] Pieter Wuille, Jonas Nick, and Tim Ruffing. "BIP-340: Schnorr Signatures for secp256k1." https://github.com/bitcoin/bips/blob/master/bip-0340.mediawiki
[8] Elizabeth Crites, Chelsea Komlo, and Mary Maller. "How to Prove Schnorr Assuming Schnorr: Security of Multi- and Threshold Signatures." IACR ePrint 2021/1375. https://eprint.iacr.org/archive/2021/1375/1634019977.pdf
[9] Coinbase. "FROST: Flexible Round-Optimized Schnorr Threshold Signatures." The Coinbase Blog. https://medium.com/the-coinbase-blog/frost-flexible-round-optimized-schnorr-threshold-signatures-b2e950164ee1
[10] Zcash Foundation. "FROST Reference Implementation v1.0.0 Stable Release." February 2024. https://zfnd.org/2024/02/19/
[11] Torben P. Pedersen. "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing." CRYPTO 1991. https://cgi.di.uoa.gr/~aggelos/crypto/page8/assets/Pedersen-VSS.PDF
