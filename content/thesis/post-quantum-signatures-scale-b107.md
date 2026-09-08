---
id: post-quantum-signatures-scale-b107
title: "Scaling Post-Quantum Digital Signatures: A Comparative Analysis of ML-DSA, SLH-DSA, and FN-DSA Under Implementation, Side-Channel, and Migration Constraints"
anon: anon#9650
ts: 1788882609000
type: thesis
---

# Scaling Post-Quantum Digital Signatures: A Comparative Analysis of ML-DSA, SLH-DSA, and FN-DSA Under Implementation, Side-Channel, and Migration Constraints

## Abstract

NIST's FIPS 204 (ML-DSA) and FIPS 205 (SLH-DSA), finalized in August 2024, and draft FIPS 206 (FN-DSA, formerly Falcon) will displace RSA, DSA, and ECDSA across global PKI, firmware supply chains, and authentication systems. This thesis develops a unified framework for deploying post-quantum signatures *at scale*, comparing the three schemes across parameter sets, security assumptions, sizes, throughput, and implementation attack surface. We formalize scheme selection as a constrained optimization over bandwidth, latency, assumption conservatism, and side-channel hardening cost, and show no single scheme dominates the Pareto frontier: ML-DSA minimizes verification latency and implementation complexity; SLH-DSA minimizes assumption strength at the cost of far larger signatures and slow signing; FN-DSA minimizes bandwidth at the cost of fragile floating-point samplers. We survey masking, shuffling, and constant-time countermeasures — including deep-learning attacks defeating fifth-order masking — and derive a phased migration strategy anchored in NSM-10, CNSA 2.0, and the 2030/2031 federal mandates, with hybrid signatures as the bridge. Scale forces heterogeneity: the migration will be won by engineering discipline, not cryptanalysis.

## 1 Introduction

Shor's algorithm [1] renders RSA, DSA, and elliptic-curve signatures asymptotically broken under a sufficiently large fault-tolerant quantum computer, and recent resource estimates — breaking ECC-256 with on the order of 30,000 to 500,000 physical qubits [2] — have compressed planning horizons from "decades" to "years." Unlike key establishment, where *harvest-now-decrypt-later* creates immediate exposure, signatures face forgery risk only *after* a cryptographically relevant quantum computer exists — which makes the signature migration structurally slower: signatures are embedded in certificate chains, code-signing pipelines, firmware formats, JOSE/JWT tokens, and audit-trail schemas with rigid size limits and long-lived verification code [3].

## 2 Background

### 2.1 The quantum threat model for signatures

A digital signature scheme is secure if no efficient adversary can forge a signature on a message it did not legitimately obtain — formally, *strong existential unforgeability under chosen-message attack* (SUF-CMA). Quantum computers threaten the two classical families differently: Shor's algorithm solves integer factorization and discrete logarithms in polynomial time, destroying RSA/DSA/ECDSA/EdDSA entirely, while Grover's algorithm gives only a quadratic speedup against symmetric primitives and hash functions, manageable by doubling output lengths [1].

### 2.2 The NIST PQC signature portfolio

NIST's signature track selected three schemes with deliberately diversified mathematical foundations [4] — cryptanalytic insurance such that a breakthrough against module lattices would leave hash-based SLH-DSA standing, and vice versa [5]:

| Scheme | Standard | Family | Assumption |
|---|---|---|---|
| ML-DSA | FIPS 204 (final, Aug 2024) | Module lattices | MLWE + MSIS |
| SLH-DSA | FIPS 205 (final, Aug 2024) | Hash-based | Hash collision / preimage resistance |
| FN-DSA | FIPS 206 (draft) | NTRU lattices | NTRU + SIS over NTRU lattices |

The diversification is intentional cryptanalytic insurance: a breakthrough against module lattices (affecting ML-DSA) would leave hash-based SLH-DSA standing, and vice versa [5].

### 2.3 Security levels and the meaning of "Category"

NIST defines security categories against symmetric primitives: Category 1 ≈ AES-128 key search, Category 2 ≈ SHA-256 collision search, Category 3 ≈ AES-192, Category 5 ≈ AES-256 [4]. Note the deployment-shaping asymmetry: **ML-DSA ships categories 2, 3, 5** (no category-1 set), **SLH-DSA ships 1, 3, 5**, and **FN-DSA ships 1, 5** — so the portfolio has no category-1 lattice signature, with real consequences for constrained devices that would prefer minimal sizes.

## 3 Methodology

Our analysis proceeds in three stages.

1. **Parametric decomposition.** We extract each scheme's parameter vector from the normative standard — dimensions, modulus, challenge weights, rejection bounds, tree heights, hash instantiations — and derive exact key and signature byte sizes [6][7].
2. **Cost modeling.** We model deployment cost as $C(\Pi) = (B_{pk}, B_{sig}, T_{sign}, T_{verify}, A, H_d)$: bytes, time, assumption strength $A \in \{1,2,3\}$ (hash-only $<$ module-lattice $<$ NTRU-with-float-sampler), and hardening order $H_d$ (masking depth plus shuffling). Scheme selection is the Pareto frontier of $C$, formalized in Section 5.
3. **Adversarial survey.** We systematize the side-channel literature — timing attacks on rejection sampling and division (the *KyberSlash* lineage), power-analysis and deep-learning attacks defeating fifth-order masking [8], floating-point leakage in Falcon's sampler — mapping each attack class to countermeasures with quantified overhead.

Byte sizes and parameter values come from the final standards or official drafts; performance figures are representative published values [9].

## 4 Deep Dive

### 4.1 ML-DSA: Fiat–Shamir with Aborts over Module Lattices

ML-DSA works in $\mathcal{R}_q = \mathbb{Z}_q[X]/(X^{256}+1)$ with NTT-friendly prime $q = 8380417 = 2^{23} - 2^{13} + 1$ and 512th root of unity $\zeta = 1753$ [6]:

| Parameter | ML-DSA-44 | ML-DSA-65 | ML-DSA-87 |
|---|---|---|---|
| NIST category | 2 | 3 | 5 |
| Matrix dims $(k,\ell)$ | (4,4) | (6,5) | (8,7) |
| Secret bound $\eta$ | 2 | 4 | 2 |
| Challenge weight $\tau$ | 39 | 49 | 60 |
| $\beta = \tau\eta$ | 78 | 196 | 120 |
| Masking range $\gamma_1$ | $2^{17}$ | $2^{19}$ | $2^{19}$ |
| Rounding range $\gamma_2$ | $(q-1)/88$ | $(q-1)/32$ | $(q-1)/32$ |
| Max hints $\omega$ | 80 | 55 | 75 |
| Public key (bytes) | 1,312 | 1,952 | 2,592 |
| Secret key (bytes) | 2,560 | 4,032 | 4,896 |
| Signature (bytes) | 2,420 | 3,309 | 4,627 |

Signing follows *Fiat–Shamir with aborts*: sample a masking vector $\mathbf{y}$ uniform in $[-\gamma_1+1, \gamma_1]$, compute $\mathbf{w} = \mathbf{A}\mathbf{y}$, derive a sparse challenge $c \in B_\tau$ (exactly $\tau$ coefficients in $\{-1,1\}$) as $c = H(\tilde{c}, \mathbf{w}_1, \mu)$, respond with $\mathbf{z} = \mathbf{y} + c\mathbf{s}_1$, and *abort* unless $\|\mathbf{z}\|_\infty < \gamma_1 - \beta$ and the low bits of $\mathbf{w} - c\mathbf{s}_2$ stay within $\gamma_2 - \beta$ [6][7]. Rejection makes the signature distribution independent of the secret — the linchpin of both the security proof and the side-channel story.

Two design decisions dominate ML-DSA's deployment profile: **no Gaussian sampling** (centered-binomial secrets, uniform masking vectors — constant-time without BLISS-style sampler side channels [10]) and **deterministic plus hedged signing variants** (hedged signing with a hardware RNG is the prudent default against fault adversaries, avoiding deterministic nonce-reuse catastrophe).

```python
# ML-DSA-65 signing sketch (FIPS 204, simplified)
def mldsa_sign(sk, msg, rnd=b"\x00"*32):
    rho, K, tr, s1, s2, t0 = sk
    mu = H(tr + b"\x00" + msg)
    kappa = 0
    while True:
        y = expand_mask(rho_prime, kappa)   # uniform in [-2^19+1, 2^19]
        w1 = high_bits(A @ y)               # Decompose, gamma2=(q-1)/32
        c = sample_in_ball(H(mu + w1), 49)  # 49 +/-1 coefficients
        z = y + c * s1
        r0 = low_bits(A @ y - c*s2)
        if norm_inf(z) < 2**19 - 196 and norm_inf(r0) < gamma2 - 196:
            h = make_hint(-c*t0, A @ y - c*s2 + c*t0)
            if popcount(h) <= 55:
                return (H(mu + w1), z, h)
        kappa += 1                          # abort and retry
```

Security is SUF-CMA in the QROM under MLWE and SelfTargetMSIS [7]; the matrix dimensions are the security dial — ML-DSA-87's $8 \times 7$ matrix needs 56 NTT multiplications per $\mathbf{A}\mathbf{y}$, so signing scales superlinearly.

### 4.2 SLH-DSA: Stateless Hash-Based Signatures from Hypertrees

SLH-DSA (SPHINCS+) takes the opposite philosophical position: trust *only* the hash function. A signature is a hypertree — a tree of XMSS Merkle trees whose leaves sign the roots of the layer below, with FORS few-time signatures at the bottom signing the message digest [4]. Statelessness comes from deriving the leaf index pseudorandomly from message and key, eliminating the state-synchronization failure mode of stateful schemes (XMSS, LMS): at most $2^{64}$ signatures per key, with graceful rather than catastrophic degradation on the bound.

FIPS 205 approves **twelve parameter sets** — two hash families (SHA-2, SHAKE) $\times$ $n \in \{16, 24, 32\}$ bytes (categories 1/3/5) $\times$ two trade-off points ($s$ = small signatures, $f$ = fast signing) [4]:

| Parameter set | Category | pk (B) | sk (B) | Signature (B) |
|---|---|---|---|---|
| SLH-DSA-SHA2/SHAKE-128s | 1 | 32 | 64 | 7,856 |
| SLH-DSA-SHA2/SHAKE-128f | 1 | 32 | 64 | 17,088 |
| SLH-DSA-SHA2/SHAKE-192s | 3 | 48 | 96 | 16,224 |
| SLH-DSA-SHA2/SHAKE-192f | 3 | 48 | 96 | 35,664 |
| SLH-DSA-SHA2/SHAKE-256s | 5 | 64 | 128 | 29,792 |
| SLH-DSA-SHA2/SHAKE-256f | 5 | 64 | 128 | 49,856 |

The hypertree geometry explains the cost. For 128s, total height $h = 63$ splits into $d = 7$ layers of $h' = 9$ with FORS $k = 14, a = 12$; signing evaluates Winternitz chains and Merkle paths across all layers — millions of hash compressions, hence tens to hundreds of milliseconds per signature. The $f$ variants widen the tree ($d = 22, h' = 3$ for 128f), roughly doubling the signature to halve per-layer work. Draft SP 800-230 adds *limited-use* sets capped at $2^{24}$ signatures for constrained firmware signing [5].

SLH-DSA's killer property is **assumption minimalism**: EUF-CMA reduces to hash second-preimage resistance, pseudorandomness, and collision resistance, with a tight proof invoking no lattice problem [4]. Its killer cost is bandwidth — a 49 KB signature fits neither a DNSSEC UDP response nor most embedded boot headers — and signing latency that rules out interactive protocols. It is the scheme for rare, critical signatures where verification matters and bandwidth is negotiable: root CAs, firmware release signing, long-term archival.

### 4.3 FN-DSA: Compact NTRU Signatures via Fast Fourier Sampling

FN-DSA (standardizing Falcon in draft FIPS 206) is the hash-and-sign counterpart: from a message-derived target $\mathbf{t}$, an NTRU trapdoor basis $\mathbf{B} = \begin{pmatrix} g & -f \\ G & -F \end{pmatrix}$ with $fG - gF = q \bmod (x^n+1)$ samples a close lattice vector via *fast Fourier sampling* over the LDL decomposition tree [11]:

| Parameter set | Category | Public key (B) | Signature (B, avg) |
|---|---|---|---|
| FN-DSA-512 | 1 | 897 | ~666 |
| FN-DSA-1024 | 5 | 1,793 | ~1,280 |

These are the smallest post-quantum signatures in the portfolio — near classical sizes — making FN-DSA the candidate for certificate chains, DNSSEC, and MTU-constrained broadcasts [4][11]. The compactness is purchased with the most delicate implementation in the portfolio:

- **Floating-point FFT sampling.** Key generation and signing need double-precision arithmetic with bounded numerical error; the Falcon tree's LDL decomposition is only *approximately* correct, and the Gram–Schmidt norm check must absorb the error. Floating point is a side-channel and portability hazard: subnormal handling, FMA contraction, and platform-dependent rounding threaten constant-time behavior and cross-platform compatibility [11].
- **Gaussian sampler fragility.** Unlike ML-DSA's uniform masking, FN-DSA samples discrete Gaussians; sampler bias or timing leakage directly exposes the trapdoor. Integer-only variants (HAWK-style fixed point, the *Antrag* trapdoor proposal [11]) aim to eliminate floating point but were judged too recent for the draft.
- **Deterministic signing with restart.** The draft discusses adding an infinity-norm acceptance bound $\|s\|_\infty \le B_\infty \approx 840$ and BUFF/PS-3 transforms for stronger security properties [11].

At scale, FN-DSA is a specialist instrument: deploy it where bytes are the binding constraint *and* you can afford audited constant-time implementations — never as the default.

```haskell
-- FN-DSA signing, conceptual (draft FIPS 206)
fnDsaSign :: Trapdoor -> Message -> Salt -> Maybe Signature
fnDsaSign (f,g,F,G) msg salt = do
  let t = hashToPoint (pkHash <> salt <> msg)
  let b = fftBasis (f,g,F,G)          -- FALCON tree (LDL)
  (s1,s2) <- ffSample b t             -- discrete Gaussian, fp
  guard (normInf s1 <= bInf && normInf s2 <= bInf)
  return (salt, compress (s1,s2))
```

### 4.4 Side-Channel Hardening: Masking, Shuffling, and Constant-Time Discipline

Black-box security proofs ignore power, EM, timing, and fault leakage. The lattice-signature side-channel literature reduces to three attack surfaces:

**Attack surface 1: rejection sampling and division.** ML-DSA's `Decompose` divides by $2\gamma_2$ — variable-time on most platforms, the mechanism behind the KyberSlash timing attack on ML-KEM. Trail of Bits' constant-time Go implementation of FIPS 204 eliminates all data-dependent branches and divisions [10].

**Attack surface 2: secret-dependent memory access.** The challenge polynomial $c \in B_\tau$, the hint vector, and NTT index permutations touch memory in secret-dependent patterns. Countermeasures:

1. **Masking (order $d$).** Split each secret coefficient $s$ into $d+1$ shares, $s = \sum_i s_i$, computing linear operations share-wise. But deep-learning attacks *defeated fifth-order masked* lattice implementations with $>99\%$ recovery [8]: masking raises the attacker's trace budget but is not a panacea — order must scale with the attacker's ML capability, not yesterday's DPA metrics.
2. **Shuffling.** Randomly permute independent coefficient operations (NTT butterflies, hint processing) per execution. Cheap but falls to the same deep-learning alignment when used alone [8]; it belongs *combined* with masking.
3. **Hiding and blinding.** Randomize NTT twiddle representations and add dummy operations; the abort loop re-randomizes ephemeral state per attempt, partially blunting single-trace attacks at the cost of variable-time signing.

**Attack surface 3: Falcon's sampler.** Floating-point FFTs leak through timing (subnormals, early exits) and power (FMA unit signatures). The hardening path is integer-only sampling with constant-time control flow — an active research area whose outcome decides whether FN-DSA is deployable outside HSMs [11][11]. SLH-DSA, by contrast, is nearly side-channel-inert: its signing path is hash compressions over public scheduling, so constant-time implementation is straightforward [10].

> **Theorem:** (Hardening composition, informal.) For a $d$-th order masked, shuffled, branchless implementation, first-order statistical attacks need $\Omega(E \cdot \sigma^{2d})$ traces ($E$ = shuffling entropy, $\sigma$ = noise) — but deep-learning profiled attacks reduce the effective $d$ by alignment, so deployed $d$ must exceed the evaluator's profiled-attack capability by a safety margin.

## 5 Empirical Results and Proofs

### 5.1 The Pareto frontier

Assembling published sizes and representative cycle counts [6][9]:

| Scheme (level ~3) | pk (B) | sig (B) | Sign | Verify | Assumption |
|---|---|---|---|---|---|
| ECDSA P-256 (classical) | 33 | ~72 | ~0.3 Mcyc | ~0.6 Mcyc | Broken by Shor |
| ML-DSA-65 | 1,952 | 3,309 | ~0.3 Mcyc | ~0.1 Mcyc | MLWE + MSIS |
| SLH-DSA-SHA2-128f | 32 | 17,088 | ~100+ Mcyc | ~2 Mcyc | Hash only |
| FN-DSA-512 (cat. 1) | 897 | ~666 | ~1–2 Mcyc | ~0.15 Mcyc | NTRU + SIS |

(Formally: ML-DSA is SUF-CMA in the QROM under MLWE + SelfTargetMSIS [7]; SLH-DSA is EUF-CMA under hash-function properties with a tight reduction [4]; Falcon reduces to NTRU and SIS over NTRU lattices in the ROM [11].)

The frontier reads: **ML-DSA** minimizes latency and engineering risk; **SLH-DSA** minimizes assumption strength and maximizes bandwidth cost; **FN-DSA** minimizes bandwidth and maximizes implementation fragility. Selection is therefore a *per-deployment* weighted optimization over signature bytes, signing time, assumption strength, and hardening order, subject to category requirements, protocol MTU limits ($B_{sig} \le \text{MTU}$ eliminates SLH-DSA from DNSSEC/UDP), and hardware capability (no FPU $\Rightarrow$ exclude floating-point FN-DSA).

### 5.2 The masking-overhead scaling law

Masking a lattice signature is disproportionately expensive: the NTT hot loop is duplicated per share and share count multiplies memory traffic. Published masked Dilithium reports roughly $3$–$10\times$ slowdown at first order with superlinear growth in $d$; shuffling adds $10$–$30\%$ [8][10]. The economic conclusion is stark: **hardening can dominate total cost of ownership**, and for high-assurance signers (HSMs, secure elements) hash-based SLH-DSA — needing almost no masking — may be cheaper *overall* despite 17 KB signatures. Total cost, not algorithm cost, is the right objective.

### 5.3 Hybrid signatures as the migration bridge

No flag-day migration of the global PKI is feasible. The bridge is **hybrid (composite) signatures**: combine classical and post-quantum signatures so security holds if *either* remains unbroken. IETF drafts define hybrid X.509 certificates; CNSA 2.0 blesses hybrid use during transition [3]. Hybrids solve the downgrade problem in the decade-long window of heterogeneous verifiers, at the cost of summed signature sizes — one more argument for ML-DSA-44 (2,420 B) as the hybrid workhorse.

## 6 Limitations

This analysis has boundaries that must be stated plainly.

1. **FN-DSA is not final.** Draft FIPS 206 may still change sampler requirements, the $B_\infty$ bound, or transform choices (BUFF vs. PS-3) [11]; performance and side-channel conclusions about FN-DSA are contingent on the final text.
2. **Cryptanalytic risk is non-stationary.** The module-lattice and NTRU assumptions have survived intense scrutiny, but "no attack known" is not a proof; SLH-DSA's margin is assumption-minimalism — a break in SHA-256/SHAKE would wound it too, hence the two hash families.
3. **Side-channel evaluation is adversary-relative.** Masking recommendations depend on evaluator laboratory capability; the deep-learning results [8] show yesterday's "secure at order 3" can become today's break — hardening budgets must include margin for attack improvement.
4. **Migration timelines are policy, not physics.** NSM-10 targets 2035 for NSS quantum-resistance [3], and the June 2026 executive order compresses federal high-value systems to PQC key establishment by December 2030 and quantum-safe signatures by December 2031 — but private-sector PKI, IoT fleets, and industrial systems have no binding deadline, and signature migration structurally lags key exchange because forgery is a post-quantum-only threat.
5. **We model, but do not measure, at full scale.** Cycle counts are representative published figures; exact costs depend on platform, vectorization, and SHAKE hardware acceleration.

---

## 7 Conclusion

The mathematics — module lattices, hash hypertrees, NTRU sampling — is settled enough to standardize; what is not settled is how to *deploy* it across billions of devices, hostile physical environments, and a single-decade migration window. Five conclusions follow:

1. **Default to ML-DSA-65** for general-purpose signing: the best balance of size, speed, proof maturity, and constant-time implementability — ML-DSA-44 where bandwidth dominates, ML-DSA-87 for category 5.
2. **Reserve SLH-DSA for roots of trust** — root CAs, firmware release keys, archival signatures — where assumption conservatism outweighs kilobyte signatures and slow signing, and where side-channel inertness is a feature.
3. **Confine FN-DSA to bandwidth-critical niches** (DNSSEC, constrained certificate chains) behind audited constant-time implementations, and track the integer-sampling research that will decide its long-term viability.
4. **Budget side-channel hardening as a first-class cost**, with masking order set against profiled deep-learning adversaries plus margin — or sidestep it with hash-based signatures where the threat model allows.
5. **Migrate through hybrids under mandate discipline**: inventory cryptography now (CBOM), deploy composite classical+PQC signatures, and align RSA/ECDSA deprecation with CNSA 2.0 (exclusive CNSA 2.0 for software/firmware signing and network equipment by 2030, browsers and cloud by 2033, all NSS quantum-resistant by 2035) [3] and the 2030/2031 federal deadlines.

The quantum computer that breaks ECDSA may arrive in years or decades; the migration it forces must be substantially complete *before* it arrives for long-lived trust anchors. Heterogeneity — of schemes, parameter sets, and hardening levels — is not a compromise. It is the strategy.

## References

[1] P. W. Shor, "Algorithms for quantum computation: discrete logarithms and factoring," *Proc. 35th FOCS*, 1994. DOI: 10.1109/SFCS.1994.365700.

[2] National Institute of Standards and Technology, "Module-Lattice-Based Digital Signature Standard," FIPS 204, August 2024. https://doi.org/10.6028%2FNIST.FIPS.204

[3] Open Quantum Safe, "ML-DSA," liboqs algorithm documentation. https://openquantumsafe.org/liboqs/algorithms/sig/ml-dsa

[4] National Institute of Standards and Technology, "Stateless Hash-Based Digital Signature Standard," FIPS 205 (initial public draft). https://csrc.nist.rip/external/nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.205.ipd.pdf

[5] NIST, "Public Comments on initial public draft of NIST SP 800-230, Additional SLH-DSA Parameter Sets for Limited Signature Use Cases." https://csrc.nist.gov/files/pubs/sp/800/230/ipd/docs/sp800-230_ipd_comments_received.pdf

[6] PostQuantum.com, "Post-Quantum Cryptography (PQC) Standardization — 2025 Update." https://postquantum.com/post-quantum/cryptography-pqc-nist/

[7] R. Perlner, "FIPS 206 and FN-DSA," NIST presentation, 2025. https://jurnal.jumanji.workers.dev/host-https-csrc.nist.gov/csrc/media/presentations/2025/fips-206-fn-dsa-(falcon)/images-media/fips_206-perlner_2.1.pdf

[8] V. Lyubashevsky et al., "CRYSTALS-Dilithium," round-3 submission; and "FIPS 204-Compatible Threshold ML-DSA via Shamir Nonce DKG." https://arxiv.org/pdf/2601.20917v5

[9] E. Dubrova, K. Ngo, J. Gärtner, "Deep learning based side-channel attacks can overcome conventional countermeasures," reported in *SCWorld*, 2024. https://www.scworld.com/analysis/post-quantum-algorithm-attack

[10] Trail of Bits, "How we avoided side-channels in our new post-quantum Go cryptography libraries," 2025. https://blog.trailofbits.com/2025/11/14/how-we-avoided-side-channels-in-our-new-post-quantum-go-cryptography-libraries/

[11] NSA, "Announcing the Commercial National Security Algorithm Suite 2.0," via Entrust summary, 2022. https://www.entrust.com/blog/2022/10/nsa-announces-new-post-quantum-resistant-algorithm-suite-2-0-and-transition-timetable

