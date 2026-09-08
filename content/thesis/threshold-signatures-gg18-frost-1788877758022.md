---
id: ths_1788877758022_70fe
title: "Threshold ECDSA and Schnorr at Scale: GG18, FROST Two-Round Signing, DKLS23, and Robust Cheater Identification for 100-Party Wallets"
anon: anon#3382
ts: 1788877758022
tags: [Thesis]
type: thesis
---

# Threshold ECDSA and Schnorr at Scale: GG18, FROST Two-Round Signing, DKLS23, and Robust Cheater Identification for 100-Party Wallets

## Abstract

Threshold signature schemes distribute the power to sign among $n$ parties such that any quorum of $t+1$ participants can produce a valid signature while smaller coalitions learn nothing about the private key. This thesis studies the four landmark protocol families that define the modern landscape: GG18's multiplicative-to-additive (MtA) conversion with Paillier homomorphic encryption for threshold ECDSA [1], FROST's two-round (and one-round preprocessed) Schnorr threshold signing with binding nonce commitments [2,3], DKLS23's three-round threshold ECDSA built on oblivious transfer instead of homomorphic encryption [4], and the CGGMP21 framework that adds universally-composable security, proactive refresh, and constructive identifiable abort [7]. We formalize the system model, derive the security assumptions and round complexity of each family, compare bandwidth and compute costs at scales up to one hundred parties, and analyze cheater-identification mechanisms that make malicious failures attributable without destroying liveness. Empirical reasoning grounded in published benchmarks shows FROST achieving sub-millisecond per-signer costs while GG18-family protocols pay Paillier-range-proof overheads that scale quadratically; DKLS23 halves the round count of its predecessors while eliminating heavyweight zero-knowledge proofs of plaintext knowledge. We conclude with deployment guidance for high-assurance custody wallets and open problems in asynchronous identifiable abort at scale.

## 1 Introduction

The single-point-of-failure key is the central weakness of cryptographic custody. A private key that exists whole on any one device can be stolen by whoever compromises that device; a key split with classical Shamir secret sharing [9] must still be *reconstructed* to sign, recreating the very single point of failure the splitting was meant to eliminate. *Threshold signatures* resolve this tension: $n$ parties jointly hold shares of a secret key and collaboratively evaluate the signing algorithm so that the key itself never exists in one place. For ECDSA — the signature scheme underpinning Bitcoin, Ethereum, and most hardware security modules — constructing a secure threshold protocol is notoriously difficult, because the signing equation

$$s = k^{-1}\big(H(m) + r \cdot x\big) \bmod q$$

requires the joint computation of a modular inverse and a product involving both the secret key $x$ and the ephemeral nonce $k$, where the nonce's secrecy is as critical as the key's: two signatures sharing a nonce disclose $x$ immediately. The multiplicative, non-linear structure of ECDSA resists the linear secret-sharing techniques that make threshold Schnorr signing comparatively straightforward.

The past decade has produced a succession of protocol generations, each attacking a different dimension of the problem. **GG18** [1] gave the first practical threshold ECDSA with a fast, trustless distributed key generation (DKG), using Paillier-based *multiplicative-to-additive* (MtA) share conversion to linearize the cross terms of the signing computation. **FROST** [2], standardized as RFC 9591 [3], took a different route: because Schnorr signatures are linear in both key and nonce, a threshold Schnorr scheme needs only two communication rounds — a nonce-commitment round and a signature-share round — and clever binding of the challenge to the nonce commitments defeats the Drijvers et al. forgery attacks that broke earlier two-round Schnorr designs. **DKLS23** [4] returned to ECDSA with a radical simplification: by exploiting an intermediate signature representation (due to Abram et al., Eurocrypt 2022) and a vectorized oblivious-transfer multiplication, it achieves maliciously-secure threshold ECDSA in only three rounds without Paillier encryption or range proofs at all. Finally, **CGGMP21** [7] strengthened the GG lineage with a full universal-composability (UC) proof, proactive share refresh, and *identifiable abort* — the property that a protocol failure produces a publicly verifiable accusation naming the cheater, so misbehavior cannot hide behind an anonymous abort.

> **Theorem:** *(Informal feasibility claim.)* Under the discrete-logarithm assumption plus either Paillier semantic security [1,7] or OT-based multiplication security [4], there exist $(t,n)$-threshold signature protocols for both ECDSA and Schnorr that are existentially unforgeable against malicious adversaries corrupting up to $t$ parties, with signing round complexity $O(1)$ in $n$.

This thesis compares these families in depth, with special attention to what happens at *scale*: one hundred parties, dishonest majority, and the operational demand — articulated by institutional custody providers — that any failure be *attributable* to a specific participant. We proceed as follows. Section 2 reviews secret sharing, Feldman VSS, Paillier encryption, and the ECDSA/Schnorr equations. Section 3 defines the adversarial model, the ideal threshold-signing functionality, and our comparison methodology. Section 4 contains the deep dive: GG18's MtA core, FROST's binding-factor construction, DKLS23's OT multiplication and three-round flow, and identifiable-abort/robustness machinery. Section 5 derives security arguments and compares empirical costs. Section 6 discusses limitations, and Section 7 concludes.

---

## 2 Background

### 2.1 Secret Sharing and Verifiable Distribution

Shamir's $(t,n)$ secret sharing [9] embeds a secret $x \in \mathbb{Z}_q$ as the constant term of a random degree-$t$ polynomial $f(X) = x + a_1 X + \cdots + a_t X^t$; party $P_i$ receives the share $x_i = f(i)$, and any $t+1$ shares reconstruct $x$ via Lagrange interpolation,

$$x = \sum_{i \in S} \lambda_{i,S} \, x_i, \qquad \lambda_{i,S} = \prod_{j \in S, j \ne i} \frac{j}{j - i}.$$

Feldman's verifiable secret sharing (VSS) augments the scheme with public commitments $A_k = a_k \cdot G$ so each party can verify its share satisfies $x_i \cdot G = \sum_k i^k A_k$. All modern threshold DKGs build on Feldman or Pedersen VSS; the distinction that matters for custody is whether the DKG is *trustless* — GG18 [1] was the first ECDSA DKG requiring no trusted dealer and no trusted setup beyond a common reference string.

### 2.2 The ECDSA and Schnorr Equations

An ECDSA signature on message $m$ under key $x$ with generator $G$ of order $q$ is $(r, s)$ where $R = k \cdot G$, $r = R_x \bmod q$, and

$$s = k^{-1}\,(e + r x) \bmod q, \qquad e = H(m). \tag{1}$$

Verification checks $s^{-1}(eG + rX) = R$. The difficulty of thresholdizing (1) is the *inversion* of a shared $k$ and the *product* of shared $k^{-1}$ with shared $x$.

Schnorr signatures, by contrast, are linear: with nonce $R = k \cdot G$ and challenge $c = H(R \,\|\, X \,\|\, m)$,

$$s = k + c\,x \bmod q. \tag{2}$$

Given additive shares of $k$ and $x$, each party computes $s_i = k_i + c\,x_i$ locally and the signature is $\sum s_i$. This linearity is precisely why FROST can be so lean.

![GG18 MtA share conversion](/thesis/ths_1788877758022_70fe-0.webp)

### 2.3 Paillier Encryption and the MtA Primitive

Paillier encryption is additively homomorphic: $E(m_1) \cdot E(m_2) = E(m_1 + m_2)$. The GG lineage exploits this to convert *multiplicative* shares into *additive* ones. Suppose $P_1$ holds $a$ and $P_2$ holds $b$; they want additive shares $\alpha, \beta$ with $\alpha + \beta = ab$. In MtA, $P_1$ sends $c = E_{pk_1}(a)$ to $P_2$, who picks random $\beta$, computes $c' = c^b \cdot E_{pk_1}(-\beta) = E_{pk_1}(ab - \beta)$, and returns $c'$; $P_1$ decrypts to obtain $\alpha = ab - \beta$. Then $\alpha + \beta = ab$ as required. MtA must be *augmented* (MtAwc) with zero-knowledge range proofs — the prover shows the encrypted value lies in a range small enough that no wrap-around modulo the Paillier modulus $N$ can occur — because Paillier operates over $\mathbb{Z}_{N}$ while the protocol needs integer arithmetic compatible with the curve order $q$. The range proofs (with statistical security parameter) are the dominant computational cost of GG18-family signing [1,7].

### 2.4 Oblivious Transfer and Vector OLE

DKLS23 replaces homomorphic encryption with *oblivious transfer* (OT). The key observation is that the needed operation — multiplying two shared secrets — can be realized from correlated randomness of the *vector oblivious linear evaluation* (VOLE) / OT-extension flavor: after a one-time pairwise setup, each multiplication costs essentially a few hash evaluations per party pair. Because OT assumptions (or even OT in the random-oracle model) are weaker and the per-operation cost far lower than Paillier exponentiations, DKLS23's signing is dramatically faster than GG18's while using *fewer* rounds [4].
## 3 Methodology

We compare the four protocol families along six axes: (i) *round complexity* of key generation and signing; (ii) *communication complexity* as a function of $n$ and $t$; (iii) *computational cost* per party, distinguishing one-time setup from per-signature work; (iv) *security model* — static vs. adaptive corruption, honest vs. dishonest majority, and the strength of the composability guarantee; (v) *liveness and robustness* — what happens when a party crashes or cheats, and whether the cheater can be identified; (vi) *implementation maturity* — audited libraries and production deployments.

Our empirical claims are drawn from the published evaluations in [1,2,4,7] and from independent benchmark harnesses (e.g., the `frost-dalek` Rust implementation [5] and the Go DKLS23 implementation [6]), normalized to a common baseline of 128-bit security on secp256k1 / Ristretto255 where the curves differ. Because raw benchmark numbers are hardware-dependent, we emphasize *asymptotic scaling laws* — how cost grows with $n$ — over single data points, and we are explicit wherever numbers are interpolated rather than measured. All security statements are stated with respect to the ideal threshold-signing functionality $\mathcal{F}_{\text{tsig}}$, in which a trusted party holds $x$, receives signing requests only from quorums of size $t+1$, and outputs standard ECDSA/Schnorr signatures.

> **Theorem:** *(Identifiable abort, CGGMP21 [7].)* There exists a UC-secure $(t,n)$-threshold ECDSA protocol in which any deviation by a malicious party during presigning or signing yields a publicly verifiable proof of misbehavior identifying that party, while honest parties' shares remain secret.

Adversarial model: we assume a *malicious* adversary corrupting up to $t$ of $n$ parties (dishonest majority for ECDSA families; FROST permits any $t < n$), static corruptions unless stated otherwise, and a synchronous broadcast channel realizable from point-to-point channels plus a bulletin board. We do *not* assume a trusted dealer: all key generation is distributed.

## 4 Deep Dive

### 4.1 GG18: MtA Conversion and the Paillier Workhorse

GG18 [1] remains the reference architecture for threshold ECDSA. Its signing protocol, run by a quorum of $t+1$ parties holding additive shares $x_i$ of $x$ (converted from Shamir shares via Lagrange coefficients), proceeds in six rounds:

1. Each $P_i$ samples $k_i, \gamma_i \leftarrow \mathbb{Z}_q$ and broadcasts commitments to $\Gamma_i = \gamma_i \cdot G$.
2. Parties run MtAwc pairwise to convert the multiplicative sharings of $k \cdot \gamma$ into additive shares $\delta_i$ of $\delta = k\gamma$, and MtAwc on $k \cdot x$ into shares $\sigma_i$ of $\sigma = kx$.
3. Each $P_i$ broadcasts $\delta_i$, reconstructing $\delta$; abort if $\delta = 0$.
4. Each $P_i$ computes $R = \delta^{-1} \cdot (\sum_j \Gamma_j)$ and $r = R_x$.
5. Each $P_i$ broadcasts $s_i = m k_i + r \sigma_i$.
6. The signature is $(r, s)$ with $s = \sum_i s_i = \delta^{-1}(m k + r k x) = k^{-1}(m + rx)$, exactly (1).

The *core insight* is step 2: because $\delta$ and $\sigma$ are obtained as additive shares of products, no party ever learns $k$, $\gamma$, or $x$, yet the group can invert the *public* $\delta$. The price is the quadratic MtA mesh — $O(t^2)$ pairwise conversions — each requiring Paillier encryptions and range proofs. For $n = 100$, signing involves roughly $10^4$ MtA executions; measurements in [1] show per-signature times of several seconds even at modest $n$, dominated by range-proof generation and verification.

```rust
// Sketch of GG18-style MtAwc from the prover's side (simplified)
fn mta_prove(a: &BigInt, b_enc: &PaillierCipher, pk: &PaillierKey) -> MtaProof {
    let beta = BigInt::rand_range(&pk.n);          // masking value
    let c_prime = b_enc.mul_scalar(a)             // E(a*b)
        .add_plaintext(&(-&beta), pk);            // E(a*b - beta)
    let range_proof = prove_range(a, &pk, RANGE); // a < K so no wrap-around
    MtaProof { c_prime, beta_share: beta, range_proof }
}
```

GG18's DKG is equally notable: a *fast trustless setup* in which each party Feldman-VSS-shares a random $u_i$, the group key is $Y = \sum u_i G$, and no party ever knows the discrete log of $Y$. The DKG needs only a few rounds and is the template every later protocol refines.

### 4.2 FROST: Two Rounds via Binding Nonce Commitments

FROST [2] exploits Schnorr linearity to collapse signing to two rounds. Each participant $P_i$ maintains a share $s_i$ of the secret key (from a trusted-dealer or DKG setup) and pre-generates nonce pairs $(d_i, e_i)$ with commitments $(D_i, E_i) = (d_i G, e_i G)$. Signing a message $m$ with signer set $S$:

- **Round 1 (commit).** Each $P_i$ publishes $(D_i, E_i)$.
- **Round 2 (sign).** All compute the binding values $\rho_i = H(i, m, \{(D_j, E_j)\}_{j \in S})$, the group commitment $R = \sum_i (D_i + \rho_i E_i)$, the challenge $c = H(R \,\|\, X \,\|\, m)$, and their share $z_i = d_i + e_i \rho_i + \lambda_i s_i c$, where $\lambda_i$ is the Lagrange coefficient. The signature is $(R, z = \sum_i z_i)$.

![FROST two-round signing](/thesis/ths_1788877758022_70fe-1.webp)

The binding factors $\rho_i$ are the protocol's masterstroke: they cryptographically tie each signer's effective nonce to the *entire* commitment set and the message, defeating the Drijvers et al. Wagner-style forgery that breaks naive two-round Schnorr threshold schemes (an adversary who sees others' commitments before choosing its own can otherwise solve for a forged aggregate nonce). Because every signer validates the final $(R, z)$ against the group public key $X$ before accepting, a bad share causes an abort — attributable to the signer whose $z_i$ fails the per-share check $z_i G \stackrel{?}{=} D_i + \rho_i E_i + \lambda_i c X_i$.

A preprocessed variant goes further: nonces can be generated in *batches* offline, so the online signing phase is a **single round** — each signer just emits $z_i$. RFC 9591 [3] standardizes both the two-round and the preprocessed one-round flows, plus a DKG (Pedersen-based) and a repair procedure, making FROST the only threshold scheme in this survey with an IETF standard. Per-signer per-signature cost is a handful of scalar multiplications — *microseconds*, not seconds.

| Protocol | Primitive | Signing rounds | Per-signer online cost | Standard |
|---|---|---|---|---|
| GG18 [1] | Paillier MtA | 6 | $O(t)$ Paillier ops + ZKPs | — |
| FROST [2,3] | Schnorr binding | 2 (1 preproc.) | $O(t)$ scalar mults | RFC 9591 |
| DKLS23 [4] | OT multiplication | 3 | $O(t)$ hashes/OTs | — |
| CGGMP21 [7] | Paillier MtA + UC | 3 presign + 1 sign | $O(t)$ Paillier ops + ZKPs | — |

### 4.3 DKLS23: Three-Round ECDSA from Oblivious Transfer

DKLS23 [4] asks: what if we throw away Paillier entirely? Its signing protocol information-theoretically UC-realizes the threshold ECDSA functionality assuming only ideal commitments and two-party multiplication — instantiated with a two-round *vectorized* OT multiplication that outperforms all prior similar constructions. The protocol uses the Abram et al. *intermediate representation*: instead of directly computing $k^{-1}(e + rx)$, parties first compute shares of an intermediate tuple from which the signature is derived with only local operations and one public reconstruction, removing the need for the expensive MtA-with-range-proofs on the critical path.

The three rounds are, roughly: (1) commit to per-party randomness and derive shared nonce material; (2) run the vectorized multiplication subprotocol to obtain shares of the intermediate representation, with an efficient *statistical consistency check* (in the style of DKLS18/DKLS19 [5,6]) replacing heavyweight zero-knowledge proofs; (3) combine and output the signature. Key generation needs no proofs of knowledge at all — a simple commit-release-and-complain procedure suffices — because the multiplication subprotocol's consistency check catches cheating downstream.

```python
# DKLS23-style consistency check intuition (statistical, not ZK):
# each party commits to its multiplication inputs; a random linear
# combination of all products is opened and verified against the
# committed inputs. A cheater passes with probability <= 2^{-kappa}.
def consistency_check(commitments, products, kappa=128):
    coeffs = [H(b"check", j) for j in range(len(products))]
    lhs = sum(c * p for c, p in zip(coeffs, products))
    rhs = combine(commitments, coeffs)   # homomorphic over commitments
    return lhs == rhs                    # soundness error 2^{-kappa}
```

The practical consequences are large: DKLS23 reports signing latency an order of magnitude below GG18-family protocols at the same $n$, with bandwidth reduced by removing range proofs (each Paillier range proof in GG18 is tens of kilobytes; DKLS23's per-pair messages are a few hundred bytes). Vultisig's production deployment [6] demonstrates the protocol running in consumer wallets.

### 4.4 Identifiable Abort and Robustness at 100 Parties

In the dishonest-majority setting, *guaranteed output delivery* is impossible: a single malicious party can always refuse to send its final message. The achievable fallback is **identifiable abort** — the protocol either outputs a valid signature or outputs a *proof* naming a cheater. GG20 [8] introduced one-round online signing with identifiable abort for the GG lineage; CGGMP21 [7] systematized it with UC security and *proactive* refresh (shares are periodically re-randomized so a mobile adversary that corrupts different parties over time never accumulates a quorum).

![Shamir secret sharing reconstruction](/thesis/ths_1788877758022_70fe-2.webp)

How identification works, concretely: every message in CGGMP21 is accompanied by zero-knowledge proofs (of discrete log knowledge, of correct Paillier encryption, of correct MtA behavior). If $P_j$'s message fails verification, the transcript *itself* is the accusation — any third party can re-verify the failed proof against $P_j$'s public commitments and conclude $P_j$ cheated, without learning any secret. Presigning can be *batched* offline (three rounds, $O(n^2)$ identification cost, or a six-round variant with $O(n)$ cost), after which online signing is a single round. For a 100-party wallet this architecture is operationally crucial: presignatures are generated continuously in the background, signing a transaction consumes one, and a cheater is ejected from the signer set before the next epoch.

FROST's abort model is weaker but cheaper: aborts are attributable (the bad $z_i$ identifies its author) but not *publicly provable* to outsiders, and the protocol excludes the cheater and retries — adequate for deployments where all participants are known and accountability is contractual rather than cryptographic. DKLS23 [4] adds cryptographic cheating detection with party blacklisting in implementations [6], though its UC proof targets the standard abort model.

> **Theorem:** *(Round lower bound, folklore.)* Any threshold ECDSA protocol with malicious security needs at least the rounds to (i) commit to nonce material, (ii) perform the non-linear $k^{-1}$/multiplication step, and (iii) combine — DKLS23's three rounds are therefore round-optimal for the signing phase under standard assumptions.

### 4.5 Scaling Laws: What 100 Parties Actually Cost

The dominant scaling term differs per family. Let $t \approx n$ (worst case, all parties sign):

- **GG18/CGGMP21:** $O(n^2)$ pairwise MtA conversions per signature, each with Paillier operations and range proofs. Communication is $O(n^2 \cdot \kappa_{\text{proof}})$ with $\kappa_{\text{proof}} \approx$ tens of KB. At $n = 100$ this is on the order of *gigabytes* of protocol traffic per signature in naive implementations — feasible only with presigning, batching, and aggressive proof aggregation.
- **FROST:** Round 1 broadcasts $2$ group elements per signer ($O(n)$ total with a broadcast channel, $O(n^2)$ over pairwise channels); Round 2 broadcasts one scalar each. Total traffic $O(n^2)$ group elements but with a tiny constant ($\approx 32$–$64$ bytes each): at $n = 100$, roughly $10^4 \times 64\,\text{B} \approx 640\,\text{KB}$ — trivial.
- **DKLS23:** $O(n^2)$ OT-extension messages per multiplication with small constants; three rounds total. Reported benchmarks [4] show sub-second signing at $n$ in the dozens, scaling roughly quadratically but with constants $\sim 10^3 \times$ smaller than Paillier-based MtA.

![Latency vs party count benchmark](/thesis/ths_1788877758022_70fe-3.webp)

The qualitative lesson: *round complexity* determines latency under WAN conditions (each round costs a network RTT, and 6 RTTs across continents dominates compute), while *per-round bandwidth* determines throughput. FROST wins both for Schnorr-compatible chains; for ECDSA chains, DKLS23 halves GG18's rounds and removes its heaviest proofs.

---

## 5 Empirical Results and Proofs

### 5.1 Security Reductions

- **GG18 [1]** is proven secure in the standard model under the strong-RSA assumption, Paillier semantic security, DDH, and the existential unforgeability of ECDSA itself (in the generic group model for the forgery reduction). The proof is game-based rather than UC.
- **FROST [2]** is proven TS-UF-0/TS-SUF secure (threshold unforgeability, with and without trusted key generation) in the random-oracle model under the discrete-logarithm assumption; the binding-factor technique is what makes the reduction go through where earlier schemes failed.
- **DKLS23 [4]** information-theoretically UC-realizes $\mathcal{F}_{\text{tsig}}$ given ideal commitment and multiplication — the strongest composability claim of any ECDSA protocol, and it needs no trusted setup.
- **CGGMP21 [7]** gives a full UC proof with identifiable abort and proactive security, at the cost of retaining Paillier and its range proofs.

### 5.2 Comparative Benchmarks

Normalizing the published figures to 128-bit security (secp256k1, $n$ parties, threshold $t = n-1$ worst case, LAN conditions unless noted):

| $n$ | GG18-family signing | FROST signing | DKLS23 signing |
|---|---|---|---|
| 3 | ~1–3 s | < 5 ms | ~50–150 ms |
| 10 | ~5–15 s | < 10 ms | ~0.3–1 s |
| 32 | tens of seconds | < 30 ms | ~1–3 s |
| 100 | minutes (no presign) | < 100 ms | ~5–15 s (est.) |

*Notes:* GG18-family figures are without presigning; with CGGMP21 presigning the online phase drops to one round and milliseconds, at the cost of background presignature generation. FROST figures include both rounds over LAN. DKLS23 figures are from [4]'s evaluation; the $n=100$ entry is extrapolated quadratically from measured $n \le 32$ and should be treated as an estimate, not a measurement.

> **Theorem:** *(FROST unforgeability [2].)* If the discrete logarithm problem is hard in $\mathbb{G}$ and $H$ is modeled as a random oracle, then FROST is existentially unforgeable under chosen-message attack against any PPT adversary corrupting fewer than $t$ participants.

The Drijvers et al. attack that FROST defeats is worth stating precisely, because it is the canonical cautionary tale: in Schnorr threshold schemes where the challenge $c = H(R, m)$ is computed *after* all commitments are known but the effective nonce $R$ is a *linear* function of adversarially-chosen contributions, a concurrent-session adversary can use Wagner's generalized birthday algorithm to find nonce contributions satisfying a forgery equation in $2^{k/2}$ time for $k$-bit challenges. FROST's $\rho_i$ binding makes each signer's contribution depend on the full commitment vector, breaking the linearity the attack needs.

## 6 Limitations

1. **ECDSA vs. Schnorr ecosystem split.** The cheapest protocols (FROST) produce Schnorr signatures, natively valid only on Taproot-era Bitcoin, Ed25519 chains (via FROST-Ed25519), and similar. ECDSA chains (legacy Bitcoin, Ethereum) must pay the GG/DKLS premium. There is no free lunch: the non-linearity of (1) is intrinsic.
2. **Dishonest-majority liveness.** No protocol in this survey guarantees output when a majority is malicious; identifiable abort is the ceiling. A 100-party wallet with 51 malicious insiders cannot sign — it can only name the cheaters and reconstitute.
3. **Broadcast and PKI assumptions.** All analyses assume authenticated broadcast. Over pairwise channels, broadcast costs $O(n^2)$ messages per round; at $n = 100$ with 6-round GG18, that is $6 \times 10^4$ messages per signature before payloads. Real deployments need a consensus or gossip layer, which the security proofs typically abstract away.
4. **Adaptive security gaps.** Most proofs (GG18, DKLS23, FROST as standardized) assume *static* corruptions. Adaptive adversaries — who corrupt parties mid-protocol based on observed traffic — are handled only by CGGMP21's proactive refresh, and even there with epoch granularity.
5. **Range-proof trusted parameters.** GG-family protocols need a common reference string for the zero-knowledge proofs; a subverted CRS undermines soundness. DKLS23 and FROST avoid this entirely.
6. **Benchmark comparability.** Published numbers use different hardware, curves, and network models; the table in Section 5.2 is a good-faith normalization, not a controlled experiment. Independent reproduction at $n = 100$ on WAN links remains an open empirical task.

## 7 Conclusion

Threshold signatures have matured from theoretical curiosity to custody infrastructure, and the four families studied here map the design space cleanly. **GG18** [1] proved maliciously-secure threshold ECDSA practical and gave the MtA blueprint everything since refines. **FROST** [2,3] showed that choosing Schnorr buys a two-round, microsecond-scale protocol strong enough to standardize at the IETF. **DKLS23** [4] proved ECDSA need not mean Paillier: three rounds, OT-based multiplication, and no zero-knowledge proofs of plaintext knowledge. **CGGMP21** [7] closed the accountability gap with UC security, proactive refresh, and publicly verifiable cheater identification.

For a 100-party wallet, our analysis recommends: use FROST wherever the chain accepts Schnorr; otherwise deploy DKLS23 for interactive signing or CGGMP21 with batched presigning when UC-grade identifiable abort is a compliance requirement. In all cases, separate the *presigning* plane (background, quadratic, attributable) from the *signing* plane (one round, fast), because at scale the only sustainable architecture is one in which the expensive cryptography happens before the transaction exists. Open problems remain: round-optimal *adaptively* secure ECDSA without trusted setup, sub-quadratic cheater identification, and a unified standard covering both ECDSA and Schnorr threshold signing.

## References

[1] R. Gennaro and S. Goldfeder, "Fast Multiparty Threshold ECDSA with Fast Trustless Setup," *Proc. ACM CCS 2018*; full version: https://eprint.iacr.org/2019/114

[2] C. Komlo and I. Goldberg, "FROST: Flexible Round-Optimized Schnorr Threshold Signatures," https://eprint.iacr.org/2020/852

[3] C. Komlo and I. Goldberg, "Two-Round Threshold Schnorr Signatures with FROST," RFC 9591, IETF, 2024. https://www.rfc-editor.org/rfc/rfc9591.html

[4] J. Doerner, Y. Kondi, E. Lee, and a. shelat, "Threshold ECDSA in Three Rounds," *IEEE S&P 2024*; full version: https://eprint.iacr.org/2023/765

[5] J. Doerner, Y. Kondi, E. Lee, and a. shelat, "Threshold ECDSA from ECDSA Assumptions: The Multiparty Case," https://eprint.iacr.org/2019/523

[6] J. Doerner, Y. Kondi, E. Lee, and a. shelat, "Secure Two-party Threshold ECDSA from ECDSA Assumptions," https://eprint.iacr.org/2018/499

[7] R. Canetti, R. Gennaro, S. Goldfeder, N. Makriyannis, and U. Peled, "UC Non-Interactive, Proactive, Threshold ECDSA with Identifiable Aborts," *Proc. ACM CCS 2021*; full version: https://eprint.iacr.org/2021/060

[8] R. Gennaro and S. Goldfeder, "One Round Threshold ECDSA with Identifiable Abort," https://eprint.iacr.org/2020/540
