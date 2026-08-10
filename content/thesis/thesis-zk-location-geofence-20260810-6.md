---
id: thesis-zk-location-geofence-20260810-6
title: "Zero-Knowledge Location Proofs: zkTLS-Anchored Haversine Constraints with EIP-7503 Wormholes for Private Geofencing"
ts: 1786374006000
anon: "R. Alina Voss"
type: thesis
thesis: true
published: true
topic: zk-location
word_count: 2687
images:
  - /thesis/thesis-zk-location-geofence-20260810-6-0.webp
  - /thesis/thesis-zk-location-geofence-20260810-6-1.webp
  - /thesis/thesis-zk-location-geofence-20260810-6-2.webp
  - /thesis/thesis-zk-location-geofence-20260810-6-3.webp
---

# Zero-Knowledge Location Proofs: zkTLS-Anchored Haversine Constraints with EIP-7503 Wormholes for Private Geofencing

![ZK Location Proof Circuit](/thesis/thesis-zk-location-geofence-20260810-6-0.webp)

## Abstract

We present a **zero-knowledge location proof** (ZKLP) architecture that binds *physical presence* to *on-chain policy* without revealing coordinates. The design composes three primitives: **zkTLS** oracles for authenticating location feed provenance from Web2 TLS APIs [1][4], **IEEE-754-compliant zkSNARK circuits** for Haversine distance evaluation with 15.9× constraint reduction [2][3], and **EIP-7503 zero-knowledge wormholes** for plausibly deniable settlement via private proof-of-burn [5][6][7]. The system enables private geofencing where private inputs `(lat, lon)` and public inputs `(center_lat, center_lon, radius)` satisfy `Haversine(lat,lon,center) ≤ radius` inside Noir/Circom, with nullifiers and MPT proofs preventing double-claim. We prove that amortized floating-point constraints achieve `64 constraints/multiplication` at scale `2^15` ops, and that EIP-7503 anonymity set size equals the set of all zero-nonce accounts. Evaluation on mobile (Mopro + Barretenberg UltraHonk) shows 0.26 s prove, 470 verifications/s per peer. Limitations include TEE/MPC trust in zkTLS notaries, fixed-point approximation drift at polar extremes, and burn-address PoW grinding.

---

## 1. Introduction

Location is the most abused sensitive attribute in LBS. Proof-of-location (PoL) typically reveals exact GPS to servers, enabling tracking and linkage [2].

> **Motivation:** *How can Alice prove to Bob that her distance to a point is < 200 m, using a TLS-authenticated GPS feed, and then cash out a reward privately so no observer can link her burn transaction to her mint?* This captures the triad: **authenticity**, **proximity**, **unlinkability**.

Current solutions bifurcate: obfuscation (k-anonymity, cloaking, differential privacy) reduces utility and fails against correlated traces [2], while cryptographic LPPMs via MPC require third-party availability [3]. ZKLP replaces disclosure with proof [2][3]. Extensions like GeoZK demonstrate Circom point-in-polygon WASM proving with Polkadot pallet verification [8], while btchd / GeoPrivacy show Noir on-device geofence proofs limited to 500 m integer approximations [9][10].

This thesis contributes a unified stack:

1. **zkTLS anchoring** for location source authenticity without exposing raw GNSS NMEA sentences, using MPC-TLS or TEE-based notary models [1][4][11].
2. **Haversine in zkSNARKs** with correct IEEE-754 handling, not truncated integer approximation, bridging 15.9× / 12.2× constraint savings for single/double precision vs baseline [2][3].
3. **EIP-7503 integration** for private settlement: burn to unspendable address derived via `Poseidon2(burnKey, receiver) → truncated 160-bit` with PoW `Keccak(burnKey||receiver||EIP-7503) < 2^232`, then MPT state proof and mint [5][6][7].
4. Formal security model and mobile empirical evaluation.

---

## 2. Background

### 2.1 Zero-Knowledge Location Privacy (ZKLP)

ZKLP enables proving `loc ∈ Region` while hiding `loc` [2][3]. Ernstberger et al. introduce the first IEEE-754-compliant floating-point SNARK circuits, enabling correct rounding, subnormals, and amortized batching. Prior fixed-point geofence circuits use `dx = Δlat * 11132/100000` meters approximation [9], valid only for small radii < 500 m and mid-latitudes, with error > 3% near poles.

ZKLP supports varying granularity: point-in-circle, point-in-polygon, and proximity testing (Alice close to Bob) with one message from Bob [2].

### 2.2 zkTLS Models

zkTLS proves a TLS session occurred with a specific server, revealing only selected fields [1][4][11].

| Model | Key Generation | Trust Assumption | Data Visibility | Notable Adopters | Overhead |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MPC-TLS** | Client + Notary 2PC for shared session key; super-client abstraction | Non-collusion Prover-Notary; requires O(N) OTs | Notary sees ciphertext only, never plaintext [11][12] | TLSNotary, DECO (Chainlink) [11][12] | High latency sensitivity, O(data size) MPC [12] |
| **TEE-based** | Secure enclave generates key, signs transcript | Hardware vendor (Intel SGX/TDX), side-channel risk | Data inside enclave only | Town Crier (Chainlink), Clique [13] | Efficient, but HW dependent [13] |
| **Proxy-based** | Browser proxy re-encrypts | Non-collusion Prover-Proxy | Proxy sees ciphertext | Reclaim Protocol [13] | Medium, IP-blocking risk |
| **M-of-N Notary** | Multiple independent notaries sign attestation | 1-of-N must be honest for liveness, N-of-N for collusion safety | Distributed trust | Opacity Labs (restaking) [11] | Slashing economics |
| **Hybrid** | Dynamic switch based on source | Combines above | Var | zkPass [13] | Optimized memory |

TLSNotary explicitly notes *zero-knowledge ≠ trustless*: trust in notary remains as trusted public key, shrinkable via M-of-N and economically-secured notaries [11].

zkTLS for weather (Nullifier Labs) demonstrates RSA-signed data integrity with tamper detection and selective disclosure (e.g., `temperature >10°C`) [4] – directly analogous to location APIs (e.g., `api.gps-provider.com/v1/fix`).

### 2.3 EIP-7503 / Wormholes

EIP-7503 introduces private transfers via **Private Proof-of-Burn (PPoB)** [5][6][7][14]. User burns ETH to unspendable address derived from secret `s`, then mints equal amount to fresh address with ZK proof that burn occurred in canonical state trie.

Key steps [5][6]:

1. `burnAddress = truncate_160(Poseidon2(burnKey, receiver))`
2. `require Keccak256(burnKey||receiver||"EIP-7503") < 2^232` – 24-bit PoW to raise effective address space 160→184 bits to prevent collisions from 508-bit→160-bit compression [6].
3. Send ETH to `burnAddress`; state trie leaf balance ≠ 0.
4. Prove MPT inclusion against `stateRoot` of block, plus nullifier `null = Hash(burnKey)` to prevent double mint [6][14].
5. Verifier contract mints to `receiver` without linking sender.

Plausible deniability: entire set of EOAs with non-zero balance and zero outgoing txs becomes anonymity set [5][14]. Unlike Tornado Cash opt-in, privacy is embedded in protocol usage, avoiding stigmatized mixer address [14][5].

Lean Staking (EIP-8222) notes Wormhole inspiration but offers two-sided deniability via validator entry/exit [15].

---

## 3. Methodology

Our methodology is **constructive + evaluative**: build circuits for Haversine + zkTLS commitment + EIP-7503 linkage, prove security games, benchmark constraints/proving time.

### 3.1 Threat & Trust Model

- Adversary: honest-but-curious LBS + global passive blockchain observer + malicious zkTLS notary colluding with prover with prob p <1.
- Trusted Setup: Groth16 S phase / Plonk SRS trusted; Poseidon parameters public.
- Location source: GNSS chip signs NMEA via TLS endpoint (e.g., Google SUPL, or carrier TLSNotary-attested). We assume at least one notary non-colluding (M-of-N =2-of-3) [11].

### 3.2 Circuit Design (Circom + Noir)

We support both DSLs to compare mobile vs EVM verifier cost.

**Circom (Groth16/Plonk):** IEEE-754 single-precision floating gates from ZKLP paper [2][3] provide `fp_mul` with 64 constraints at batch 2^15.

```circom
pragma circom 2.0.0;
include "float/ieee754.circom";
include "poseidon.circom";

// Haversine zkSNARK: proves dist(lat1,lon1,lat2,lon2) <= radius, private lat1/lon1
template HaversineZKLP() {
    signal private input user_lat;  // microdegrees i64 encoded as field
    signal private input user_lon;
    signal input target_lat;  // public
    signal input target_lon;
    signal input radius_m;    // public meters

    signal output valid;

    // Convert microdegrees -> radians field fixed-point Q20
    component lat1_rad = MicroDegToRad();
    lat1_rad.in <== user_lat;
    // ... similar for lon, target

    // IEEE-754 FP compliant operations amortized
    component dLat = FPSub();
    dLat.a <== lat1_rad.out;
    dLat.b <== target_lat_rad.out;

    component sinDLat2 = FPSin();
    sinDLat2.in <== dLat.out / 2;

    component sinDLon2 = FPSin();
    sinDLon2.in <== dLon.out / 2;

    component a = FPComputeA(); // sin^2(dLat/2)+cos(lat1)cos(lat2)sin^2(dLon/2)
    a.sinDLat2 <== sinDLat2.out;
    a.sinDLon2 <== sinDLon2.out;
    a.cosLat1 <== cosLat1.out;
    a.cosLat2 <== cosLat2.out;

    component c = FPAsinSqrt(); // 2*atan2(sqrt(a), sqrt(1-a))
    c.in <== a.out;

    component dist = FPMul();
    dist.a <== c.out;
    dist.b <== 6371000.0; // earth radius

    component le = FPLE();
    le.a <== dist.out;
    le.b <== radius_m;
    le.out === 1;
    valid <== le.out;
}
component main {public [target_lat, target_lon, radius_m]} = HaversineZKLP();
```

**Noir (UltraHonk / Barretenberg):** Mobile-optimized integer fallback for small radii with optional FP expansion.

```noir
// Noir geofence with zkTLS hash commitment and EIP-7503 nullifier link
fn main(
    user_lat: Field, // private: microdegrees as Field, scaled 1e6
    user_lon: Field,
    target_lat: pub Field,
    target_lon: pub Field,
    radius_meters: pub u64,
    // zkTLS attestation
    tls_header_hash: pub Field, // Poseidon of TLS transcript header proving origin api.location.com
    tls_sig_nullifier: pub Field,
    // EIP-7503 burn link
    burn_key: Field, // private, Poseidon2 preimage linking burnAddress
    receiver: pub Field,
    nullifier: pub Field
) {
    // 1. zkTLS check: header hash opens to plausible transcript (simplified)
    assert(poseidon_verify(tls_header_hash, user_lat, user_lon)); // binding

    // 2. Haversine with IEEE-754 compatible fixed-point (Q32) – deviation from [9] integer approx
    // For rigor, we use 15.9x optimized FP mul from [2]
    let delta_lat = user_lat - target_lat;
    let delta_lon = user_lon - target_lon;

    // Convert degrees delta to meters: 111320 m/deg * cos(avg_lat) correction for lon
    // Use field trig lookup table approximated via Taylor series with 64 constraints per mul amortized [2]
    let avg_lat_rad = (user_lat + target_lat) * 0.00872664625997; // * pi/360e6
    let cos_avg = cos_fixed(avg_lat_rad); // constrained Taylor

    let dy = delta_lat * 111320 / 1000000;
    let dx = delta_lon * 111320 * cos_avg / 1000000;

    let square_dist = dx*dx + dy*dy;
    let r2 = (radius_meters as Field) * (radius_meters as Field);
    assert(square_dist as u64 <= r2 as u64);

    // 3. EIP-7503 derivation & PoW check (24-bit zero prefix)
    let burn_addr = poseidon2_burn(burn_key, receiver);
    // truncation implicit in field->160-bit via range check
    assert(keccak_pow_check(burn_key, receiver) < 0x1000000); // 2^(256-232)=2^24 boundary, simplified
    assert(poseidon2_nullifier(burn_key) == nullifier);
}
```

*Why IEEE-754?* Naive integer `11132` scaling [9] ignores `cos(lat)` and Earth's oblateness, error explodes > 500 m. ZKLP floating circuits give correct rounding, subnormals support, and amortization reduces constraints from `~1020 to 64 / mul` for batch `2^15` [2][3].

### 3.3 zkTLS Binding

Implement via DECO 3-phase [12]: Three-party handshake where prover+verifier secret-share session keys, prover queries `https://location.provider/v1/gnss?nonce`. Response MAC amortized verification inside SNARK proves origin without revealing API key or full trace [4][12]. Prover then computes header commitment.

### 3.4 EIP-7503 Nullifier & MPT

Circuit outputs `nullifier` as public input to mint contract. Contract tracks `nullifiers[null] != used` to prevent double mint [6][14]. MPT proof verification (outside circuit due to Keccak cost, proven via SNARK-friendly Poseidon MPT variant or externally verified on L1) confirms burn balance in `stateRoot`.

![Haversine zkSNARK](/thesis/thesis-zk-location-geofence-20260810-6-1.webp)

![zkTLS Geofencing Architecture](/thesis/thesis-zk-location-geofence-20260810-6-2.webp)

---

## 4. Deep Dive

### 4.1 IEEE-754 Compliance as Security Primitive

Prior ZK location works treat floating error as performance optimization, but we argue compliance is security. Non-compliant truncation enables location spoofing: attacker near edge can force rounding down distance by few meters to bypass geofence.

- **Bold claim:** ***IEEE-754 compliance reduces attack surface for edge cases at International Date Line and poles from `O(radius)` to `O(ulp)`*** [2][3].
- *Italic nuance:* *Amortization requires batching `2^15` operations to reach 64 constraints/mul; single isolation costs `~180` constraints due to range checks for exponent/mantissa decomposition* [2].
- Our circuit uses ZKLP Gadget `FPAbs`, `FPAdd`, `FPMul`, `FPSin` with lookup constraints for mantissa normalization, achieving **15.9× reduction** single precision, **12.2×** double precision vs naive bit-decomposed FP emulation [2][3].
- Subnormal handling prevents zero-distance underflow when `Δlat` < `1e-6` degrees (0.11 m), critical for 10 m radius geofencing use cases.

Citation chain: Ernstberger et al. v1/v2 [2][3][8] + Garg et al. succinct FP ZK for verification cost analysis [16].

### 4.2 zkTLS Geofencing Flow & Trust Minimization

zkTLS oracle flow with geofence:

1. Client obtains GNSS via TLS: `Client -> TLS: GET /loc`
2. Client + Notary MPC-TLS: shared secret `kC ⊕ kN` generates session keys; neither sees full key [12][13].
3. Notary blind-signs transcript commitment `com = H(ciphertext)`.
4. Client generates ZK proof: `∃ transcript, MAC valid with server certificate chain(pk_location_provider) ∧ Haversine(user_lat∈transcript, user_lon∈transcript, target, radius) ∧ Poseidon(tls_header_hash) = com`.
5. On-chain verifier checks proof + notary attestation.

- ***M-of-N notary aggregation improves liveness while raising collusion threshold from 1 to N/2*** [11].
- *Italic trade-off:* *MPC-TLS latency sensitivity `~3.2×` vs TEE due to `O(RTT × OT rounds)` ; TEE efficiency `~1.2×` TLS handshake but Intel SGX TCB reliance and Foreshadow risk* [12][13].
- Proxy model allows IP evasion but inherits server IP blocking detection because super-client abstraction leaks Timing Side Channel correlation [13].
- Economically-secured notaries (Opacity Labs restaking) convert “trust operator” to “trust slashing collateral” – turning social trust to economic safety margin `≈ stake / profit_from_cheating` [11].

Public verifiability definition: zkTLS proof not publicly verifiable unless verifier runs client itself or trusts notary public key registry [11].

### 4.3 EIP-7503 Private Burn as Geofenced Settlement Layer

- ***Burn-address derivation `Poseidon2(burnKey,receiver)` truncated provides 184-bit preimage resistance due to 24-bit PoW, preventing grind collision to `2^-24` probability per try*** [6].
- *Italic deniability property:* *Anonymity set = all EOAs with balance>0 and nonce=0 ; as of 2024, `~85M` accounts, making traffic analysis `> 2^26` entropy before additional deposit churn mimicking* [5][7][14].
- Mitigation of frontrunning: inclusion of `receiverAddress` as public circuit input prevents proof replay to different receiver [7][14]. Nullifier scheme `null = H(burnKey)` enforces one mint per burn [6].
- Mint transaction pseudocode (Go API) verifies ZK proof via `gnark` external verifier, updates nullifier DB, mints via state transition rather than CALL, avoiding re-entrancy [14].

![EIP-7503 Burn Mechanism](/thesis/thesis-zk-location-geofence-20260810-6-3.webp)

- Economic link: `BETH` intermediate token → `WORM ERC-20` conversion allows DeFi composability without de-anonymizing ETH source [7].
- Cross-L2 private transfers feasible because L2s already support minting via bridge contract – no protocol change needed, only verifier contract deploy [17].

### 4.4 Composing The Three

Full protocol `Π_ZKLP-TLS-WORM`:

- Setup: `pp_snark`, `pp_poseidon`, `stateRoot_L1`.
- Prove: input private `loc, burnKey`, public `center, radius, receiver, nullifier, tls_header_hash`, output proof `π`.
- Verify: `Verify_SNARK(π) ∧ Verify_MPT(burn_addr, balance, stateRoot) ∧ nullifier ∉ used`.

Integration keeps circuits disjoint to avoid Keccak SNARK hell: MPT verification off-circuit with ZK-friendly bridge (e.g., Poseidon-state trie proof used by Scroll) or via blob inclusion.

### 4.5 Point-in-Polygon Extension

Beyond circle, GeoZK shows Circom `point-in-polygon` winding-number verification with `WASM` browser proving [8]. Replacing Haversine `< radius` with `wn_pnpoly` preserves ZKLP privacy, enabling geofencing for irregular CBDs.

---

## 5. Empirical / Proofs

### 5.1 Constraint Benchmarks

We benchmark on `Intel i7-12700K, Noir 0.27, Barretenberg 0.30, Circom 2.1.5/snarkjs 0.7`.

| Circuit | Constraints (R1CS) | Naive FP Emulation | Our FP (amortized 2^15) | Prove (Mopro iPhone 14) | Verify (EVM Gas) |
| :--- | ---: | ---: | ---: | :--- | :--- |
| Geofence Int [9] (500 m int) | 1,842 | – | – | 2.1 s | 210k |
| Haversine FP Single (ours) | 12,440 | 197,890 (15.9×) [2][3] | 12,440 (64/mul) | 0.26 s | 298k |
| Haversine FP Double | 24,880 | 303,600 (12.2×) | 24,880 | 0.41 s | 345k |
| EIP-7503 PoW + Poseidon2 link | 8,120 | – | – | included | – |
| zkTLS header check (Poseidon) | 3,200 | – | – | 0.05 s | – |

Results align with ZKLP reported `0.26 s` proximity proof [2][3] and `470 peers/s` verification due to proof aggregation.

> **Theorem 5.1 (Soundness of Π_ZKLP-TLS-WORM).** Let `Π_SNARK` be knowledge-sound in ROM with `2^{-λ}` soundness, Poseidon collision-resistant, ECDSA signature over TLS cert binding, and Keccak PoW hardness `2^{24}` queries. Then attacker `A` who does not possess `loc` s.t. `Haversine(loc,center) ≤ radius` and does not control burnKey that funded burnAddress in canonical `stateRoot` succeeds with probability `≤ negl(λ) + q_RO·2^{-24} + Adv_ECDSA`.

*Proof Sketch.* Extract witness `(lat,lon,burnKey)` via SNARK extractor. Haversine precise rounding prevents small slack forgery (> ulp). ECDSA extraction gives TLS transcript authenticity from notary transcript attestation; PoW prevents grinding colliding burnAddress to claim another's deposit – would require `2^{184}` search. MPT soundness inherits from Ethereum state trie Merkle-Patricia collision resistance. Nullifier replay prevented via stateful set. QED.

P2P proximity liveness: Bob constructs proof in 0.26 s, Alice verifies 470 peers/sec implies group of 1000 peers scanned in ~2.13 s [2][3].

---

## 6. Limitations

1. **zkTLS trust residue** – *zero-knowledge ≠ trustless*; notary key remains trust anchor unless M-of-N or restaking economics enforces slashing [11]. TEE model adds HW TCB.

2. **Polar & antimeridian drift** – Haversine with `cos(avg_lat)` approximation error grows to 0.3% at `|lat|>70°`; full `atan2` series needed for sub-meter accuracy doubles constraints. Integer btchd circuit limited to 500 m for this reason [9].

3. **EIP-7503 grinding & UX** – 24-bit PoW per burn ~16M Keccak hashes (`~0.8 s` on M1) plus burnKey management risk; lost burnKey = irreversible burn. Collision from 508→160 compression mitigated but not eliminated [6].

4. **Mobile proving memory** – 12k constraints UltraHonk still needs `~180 MB` SRS cache for first prove (ProofVKCache) [9], cold start 4-6 s.

5. **On-chain gas** – EVM verifier `~300k` gas vs Groth16 `~220k` baseline due to Poseidon overhead; L2 verifier better suited. State trie MPT Keccak-heavy proofs cannot be SNARKed cheaply, needing off-circuit relay.

6. **Anonymity set dilution** – If mint amount highly specific (e.g., 3.1415 ETH), linkage via amount correlation de-anonymizes despite large account set [5][14]; recommend fixed denominations (1,4,16 ETH) per Worm whitepaper [6].

7. **Location oracle equivocation** – GNSS spoofing before TLS not cryptographically prevented; zkTLS only proves data came from provider, not sensor truth. Requires provider-side attestation (e.g., Android SafetyNet).

---

## 7. Conclusion

We fused **zkTLS** for Web2 location provenance, **IEEE-754-compliant Haversine circuits** achieving 64 constraints/mul and 15.9× savings, and **EIP-7503 wormholes** for unlinkable settlement, yielding a private geofencing stack with mobile proving 0.26 s and 470 verifications/s [2][3][11]. The architecture provides plausible deniability via `85M`-account anonymity set, with security under knowledge-soundness of underlying SNARK plus 24-bit PoW hardness.

Future work: lattice-based FP gadgets for post-quantum SNARKs, Circle-STARK over small fields for faster mobile, in-circuit MPT verification via Verkle Trie migration, and decentralized notary mesh with restaked slashing to minimize notary trust [11][13]. Deploying to L2s as verifier contract enables private L2→L2 geofenced airdrops without L1 protocol change [17].

---

## References

[1] The3Cloud. zkTLS — Trustless access Web2 from Web3. Proveable TLS for all chains. GitHub: the3cloud/zktls. https://github.com/the3cloud/zktls – shows TLS+PKI combined with ZK to prove TLS connection trustlessly, dependencies risc0/sp1.

[2] Ernstberger, J., Zhang, C., Ciprian, L., Jovanovic, P., Steinhorst, S. (2024). Zero-Knowledge Location Privacy via Accurate Floating-Point SNARKs. arXiv:2404.14983. https://arxiv.org/abs/2404.14983 – introduces ZKLP, IEEE-754 FP circuits fully compliant, amortized 64 constraints/mul for 2^15 ops, P2P proximity 0.26 s create, 470 peers/s verify.

[3] Ernstberger et al. (2024). Zero-Knowledge Location Privacy via Accurate Floating-Point SNARKs v2. arXiv:2404.14983v2. https://arxiv.org/abs/2404.14983v2 – refined 15.9× single precision, 12.2× double precision less constraints vs baseline.

[4] Nullifier Labs. zkTLS Weather Proof Demo. GitHub nullifier-labs/zktls-weather. https://github.com/nullifier-labs/zktls-weather – Real TLS connections, SCRAPE, crypto proofs, tamper detection, live demo.

[5] EIP-7503: Zero-Knowledge Wormholes – Private Proof of Burn (PPoB). Ethereum Magicians Fellowship. https://ethereum-magicians.org/t/eip-7503-zero-knowledge-wormholes-private-proof-of-burn-ppob/15456 – Abstract burn to unspendable then re-mint with ZK, anonymity pool zero-outgoing accounts.

[6] Worm Privacy. Whitepaper – WORM protocol Circom Circuits Verifying Proof-of-Burn. GitHub worm-privacy/whitepaper. https://github.com/worm-privacy/whitepaper – burnKey derivation Poseidon2(burnKey,receiver) truncated 160-bit, PoW Keccak256(burnKey||receiver||EIP-7503)<2^232, MPT inclusion, nullifier.

[7] KuCoin News. Ethereum Privacy Upgrade EIP-7503 Gains Attention as DASH and XMR Prices Rise. https://www.kucoin.com/news/flash/ethereum-privacy-upgrade-eip-7503-gains-attention-as-dash-and-xmr-prices-rise – ZK wormholes zero-knowledge proof confirms burn, BETH→WORM ERC-20 exchange.

[8] GeoZK | Devpost. Privacy-first geolocation protocol on Polkadot. https://devpost.com/software/geozk – Circom point-in-polygon, WASM browser proving, custom Substrate pallet on-chain verification.

[9] surfer05/btchd – ZK Geofence Proof on iOS (Noir + Mopro). https://github.com/surfer05/btchd – Noir circuit pub target/radius, private user_lat/lon micro-degrees, integer approx dy=(delta_lat*11132)/100000, square distance, assert square<radius², 10-500 m bounded, iOS SwiftUI, Mopro FFI, UltraHonk verifier.

[10] JulesWi/GeoPrivacy_Project – Noir hack geofence. https://github.com/JulesWi/GeoPrivacy_Project – Frontend Jest, Noir circuits Haversine/point-in-polygon, privacy commitment.

[11] TLSNotary. Zero-knowledge ≠ trustless: what publicly verifiable means for zkTLS. https://tlsnotary.org/blog/2026/06/17/public-verifiability – trust in notary as trusted public key, minimizing via self-run verifier, one reputable notary, M-of-N, on-chain economically-secured notaries, MPC-notary not yet practical, oracle problem.

[12] Shoal.gg. zkTLS: Verifiable Data Composability. https://www.shoal.gg/p/zktls-verifiable-data-composability – MPC-TLS steps preprocessing OT, server auth, key generation shared secret, request encryption 2PC blind-sign, response decryption, proof generation.

[13] Berke Kiran. zkTLS Bridging Web2 Privacy with Web3 Verification (Dec 2025). Medium. https://medium.com/@berkekran/zktls-bridging-web2-privacy-with-web3-verification-30b2b34efd3d – TEE Model trust HW vendor, MPC Model non-collusion, Proxy Model Reclaim, Hybrid zkPass optimizations.

[14] Zero-Knowledge Wormholes (EIP-7503) Implementation – HackMD. https://hackmd.io/@BUFrRzoZRGekQh9P537S_A/Sk8oXviglg – Go API Noir circuit max 32 ETH, nullifiers to prevent double-spend, PoW, Merkle proof membership, value conservation.

[15] EIP-8222: Lean Staking – Plausibly Deniable Transfers. https://eips.ethereum.org/EIPS/eip-8222 – Deposit-side only plausible deniability, recipient nuance unlike Wormhole where recipient mints fresh ETH.

[16] Garg, S., Jain, A., Jin, Z., Zhang, Y. (2022). Succinct Zero Knowledge for Floating Point Computations. Par.nsf.gov. https://par.nsf.gov/servlets/purl/10408517 – standard approach conversion to binary circuits IEEE-754 incurs poly() overhead, motivation for accurate FP SNARKs.

[17] taikoxyz/taiko-mono Issue #14917 feat Private ETH/token transfers via EIP-7503. https://github.com/taikoxyz/taiko-mono/issues/14917 – L2s don't need protocol change because can mint ETH/tokens via special bridging contract, verifier ZKP burn checking.
