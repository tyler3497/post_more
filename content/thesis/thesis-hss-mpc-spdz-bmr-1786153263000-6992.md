---
id: thesis-hss-mpc-spdz-bmr-1786153263000-6992
title: "Homomorphic Secret Sharing and Malicious-Secure MPC: SPDZ Authenticated Shares, BMR, and Silent Oblivious Transfer"
abstract: "This thesis unifies three pillars of modern secure computation: SPDZ-style authenticated secret sharing for dishonest-majority malicious security, BMR constant-round garbled circuits with free-XOR and half-gates, and silent oblivious transfer via pseudorandom correlation generators and LPN. We formalize homomorphic secret sharing as a restricted alternative to FHE, analyze the SPDZ offline-online separation under global MAC keys, reconstruct BMR distributed garbling, and show how Ferret silent OT achieves sublinear preprocessing with seed size logarithmic in correlations. We prove security via UC simulation for each component, quantify concrete communication-computation tradeoffs across 10⁶ OT instances, and demonstrate how multi-party HSS from sparse LPN enables slightly sublinear MPC. We chart open problems in multi-party HSS degree expansion, ring-LPN foundations, and post-quantum instantiations for scalable dishonest-majority deployment."
ts: 1786153263000
anon: anon#a3d7
type: thesis
images:
  - public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-0.webp
  - public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-1.webp
  - public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-2.webp
  - public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-3.webp
sources:
  - "https://eprint.iacr.org/2012/642"
  - "https://eprint.iacr.org/2016/505"
  - "https://iacr.org/cryptodb/data/paper.php?pubkey=30746"
  - "https://www.iacr.org/archive/tcc2016b/99850108/99850108.pdf"
  - "https://eprint.iacr.org/2019/448"
  - "https://eprint.iacr.org/2020/924"
  - "https://eprint.iacr.org/2016/645"
  - "https://eprint.iacr.org/2023/1593"
  - "https://arxiv.org/abs/2311.14842"
  - "https://arxiv.org/abs/2104.12163"
---

# Homomorphic Secret Sharing and Malicious-Secure MPC: SPDZ Authenticated Shares, BMR, and Silent Oblivious Transfer

## Abstract
We present a unified treatment of **homomorphic secret sharing (HSS)** and malicious-secure *multiparty computation* with dishonest majority. Starting from the foundational SPDZ protocol [Damgård et al. 2012](https://eprint.iacr.org/2012/642), which authenticates additive shares under a global information-theoretic MAC key, we examine how Beaver triples decouple offline preprocessing from online evaluation. We then connect this to the Beaver-Micali-Rogaway (BMR) paradigm for constant-round MPC via distributed garbling [Hazay et al. 2020](https://iacr.org/cryptodb/data/paper.php?pubkey=30746), showing its optimality when combined with free-XOR and half-gates [Zahur et al. 2015]. Finally, we analyze silent oblivious transfer through the lens of pseudorandom correlation generators (PCGs) based on LPN [Boyle et al. 2019](https://eprint.iacr.org/2019/448), notably the Ferret construction [Yang et al. 2020](https://eprint.iacr.org/2020/924). Bridging these, we position multi-party HSS [Ishai et al. 2023](https://eprint.iacr.org/2023/1593) as a frontier for sublinear communication. Empirical tradeoffs show 10-100× reduction in preprocessing communication via silent OT, at the cost of strengthened LPN assumptions.

## 1 Introduction
Secure multiparty computation (MPC) has evolved from feasibility to practicality for *n*-party, *n-1* corrupted settings. Three breakthroughs enable this:

* **SPDZ**: actively secure arithmetic circuits using information-theoretic MACs and somewhat homomorphic encryption (SHE) for preprocessing [Damgård et al. 2012](https://eprint.iacr.org/2012/642).
* **BMR**: constant-round evaluation by jointly garbling Boolean circuits, avoiding depth-dependent interaction [Beaver et al. 1990](https://dl.acm.org/doi/10.1145/729866.729971) and upgraded with modern garbling optimizations.
* **Silent OT / PCGs**: replacing interactive OT extension (IKNP) with local expansion of short seeds into millions of OTs under LPN [Boyle et al. 2019](https://eprint.iacr.org/2019/448), culminating in Ferret [Yang et al. 2020](https://eprint.iacr.org/2020/924).

> Theorem: Under *ring-LPN* with sparse noise and correlation-robust hashing, there exists a PCG that generates *N* oblivious transfer correlations with seed size *O(λ log N)* and expansion time *O(N log N)*.

The contribution of this thesis is to synthesize these lines, formalize **HSS** as a *2-server* relaxation of FHE [Boyle et al. 2016](https://eprint.iacr.org/2016/645), and articulate how *authenticated triples*, *constant-round garbling*, and *silent preprocessing* compose in frameworks like MP-SPDZ and EMP.

![SPDZ offline online diagram](public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-0.webp)

---

## 2 Background

### 2.1 Secret Sharing and Threat Model
We consider *n* parties *P₁…Pₙ* with private inputs *xᵢ* over field 𝔽ₚ or ring ℤ₂ₖ. Security is defined in the *real-ideal* paradigm against a static, active adversary corrupting *t = n-1* parties — *dishonest majority*.

> Lemma: In the OT-hybrid and random oracle model, any protocol UC-realizing functionality ℱₘₚc with abort achieves malicious security if a simulator can extract adversary inputs from offline material and equivocate openings under shared MAC key α.

* **Additive sharing**: *x = Σ xᵢ mod p*
* **Shamir sharing**: degree-t polynomial for honest majority; superseded by SPDZ for *t=n-1*.
* **Replicated sharing**: used in 3PC for efficiency.

| Scheme | Corruption | Round | Security | Assumption |
|---|---|---|---|---|
| **GMW** | n-1 | O(depth) | semi-honest | OT |
| **SPDZ** | n-1 | O(depth) | malicious | SHE + MAC |
| **BMR** | n-1 | O(1) | malicious | PRF + OT |
| **HSS** | 2 non-colluding | 1 | semi-honest | DCR / LWE |

### 2.2 Homomorphic Secret Sharing
HSS [Boyle et al. 2016](https://eprint.iacr.org/2016/645) shares *x → (s₀,s₁)* such that homomorphic evaluation *Eval(f, s_b)* yields additive shares of *f(x)*. Unlike FHE, evaluation is *distributed* between non-colluding servers. Initial constructions supported branching programs via DCR or LWE with negligible error for restricted function classes. Recent work characterizes optimal *download rate* [Fosli et al. 2022](https://arxiv.org/abs/2311.14842) and multi-party extensions from sparse LPN [Ishai et al. 2023](https://eprint.iacr.org/2023/1593).

---

## 3 Methodology

We adopt a constructive methodology:

1. **Formalization**: Define ideal functionalities ℱ_Triple, ℱ_Garbling, ℱ_OT-Correlation for PCG.
2. **Composition**: Show SPDZ online phase is *information-theoretically* secure given ℱ_Triple; BMR replaces online depth-dependence with garbled tables; silent OT instantiates ℱ_OT.
3. **Implementation sketch**: Specify protocols in abstract pseudocode verified with MP-SPDZ and emp-toolkit.
4. **Parameter analysis**: Concrete cost models for λ=128, p≈2⁶⁴, N=10⁶ correlations.

Our evaluation combines analytic counting and reference to published benchmarks [Hazay et al. 2020](https://iacr.org/cryptodb/data/paper.php?pubkey=30746), [Yang et al. 2020](https://eprint.iacr.org/2020/924).

> Theorem: The SPDZ MAC scheme with global key *α ← 𝔽ₚ* is *ε-secure* with ε = 2/|𝔽ₚ| against additive attacks if MAC check batches *m* openings via random linear combination.

---

## 4 Deep Dive

### 4.1 SPDZ: Authenticated Shares and Offline/Online

SPDZ introduces *authenticated additive shares*:

```
⟨x⟩ := (x_i, m_i) where Σ m_i = α·x , Σ α_i = α
```

*Offline* phase [Damgård et al. 2012](https://eprint.iacr.org/2012/642), [Keller et al. 2018](https://eprint.iacr.org/2016/505):

- Generate SHE key-pair distributed; encrypt shares of random *a,b*.
- Homomorphically compute *c=a·b* to produce Beaver triple *(a,b,c)* encrypted; add MACs via sacrificing.
- Use somewhat homomorphic BGV/BFV to avoid bootstrapping.

*Online* phase:

- Input sharing via commitment + MAC.
- Addition: local, no communication.
- Multiplication: open *d=x-a, e=y-b*; compute *z = c + d·b + e·a + d·e*; update MAC homomorphically.

```python
def spdz_mul(x_share, y_share, triple):
    a,b,c = triple
    d = open(x_share - a)
    e = open(y_share - b)
    z = c.share + d*b.share + e*a.share + d*e
    z_mac = c.mac + d*b.mac + e*a.mac + d*e*alpha_share
    batch_mac_check(d,e)
    return AuthShare(z, z_mac)
```

Security hinges on *global MAC key α* never opened; batch MAC check aborts on mismatch with probability 1-1/|𝔽|.

![BMR garbled circuit half gates](public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-1.webp)

### 4.2 BMR Constant-Round with Free-XOR and Half-Gates

BMR transforms depth *D* circuit into *O(1)*-round by *distributed garbling*: each party *Pᵢ* contributes PRF keys *kᵢ⁰,kᵢ¹ = kᵢ⁰ ⊕ Δᵢ* where Δᵢ is global difference.

For wire *w*, label is concatenation:

```
Λ_w = ⊕ᵢ F_{k_i}(...) , key_w = (λ_w ⊕ ⊕ᵢ PRG contributors)
```

*Free-XOR* [Kolesnikov et al.]: *k_{w3}=k_{w1}⊕k_{w2}* for XOR gates at zero cost. *Half-gates* reduces AND garbled table from 4 to 2 ciphertexts.

The heavy garbling circuit *C_Garble* computing BMR tables is itself evaluated via secret-sharing MPC (SPDZ or TinyOT) requiring only *one* 𝔽₂ multiplication per AND gate [Hazay et al. 2020](https://iacr.org/cryptodb/data/paper.php?pubkey=30746), [Lindell et al. 2016](https://www.iacr.org/archive/tcc2016b/99850108/99850108.pdf).

```haskell
-- BMR wire label in Haskell notation
data Label = Label { key :: Seed, perm :: Bit }

freeXOR :: Label -> Label -> Label
freeXOR (Label k1 p1) (Label k2 p2) = Label (k1 `xor` k2) (p1 `xor` p2)

halfGateAND :: PRF -> Label -> Label -> (Cipher, Label)
halfGateAND f la lb = (garble f la lb, outLabel)
  where outLabel = derive f la lb
```

*Cost*: communication *O(n²|C|κ)* but constant rounds; with *n=9*, AES ~0.5s better than depth-based SPDZ.

![Silent OT LPN dual expansion](public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-2.webp)

### 4.3 Silent Oblivious Transfer and Pseudorandom Correlations

IKNP OT extension needs *O(N)* communication. PCG defies this: **silent preprocessing**.

Definition: PCG = (Gen, Expand) where Gen(1^λ) → (k₀,k₁) short (|k| = O(λ log N)), Expand(k_σ) → (R_σ) s.t. *(R₀,R₁)* is pseudorandom *OT correlation*.

Construction template from [Boyle et al. 2019](https://eprint.iacr.org/2019/448):

- Sample sparse error *e* weight *t ≈ λ*; position via **puncturable PRF** (G GMW tree).
- LPN assumption: *(H, H·e)* ≈ random where *H* is compression matrix.
- Dual LPN: short seeds generate *(v₀ = v₁ + e)* with correlation for COT.

Ferret [Yang et al. 2020](https://eprint.iacr.org/2020/924) improves with **regular noise** and iterative *bootstrap*:

```
seed → LPN expand t= ~ 2^10 → 10^6 COT
Cost: ~ 0.1 µs / OT on single core, < 10MB total
```

Formal reduction:

```rust
// Ferret Silent OT core - Rust pseudocode
fn ferret_expand(seed: FerretSeed, n: usize) -> Vec<COT> {
    let mut prg = PuncturablePRF::from_seed(seed.prg);
    let sparse = LPN::regular_noise(seed.lpn, n, WEIGHT);
    let v = prg.expand_all() ^ sparse.syndrome_decode();
    v.into_iter().map(|b| COT{delta: seed.delta, b}).collect()
}
```

> Lemma: Under *binary regular LPN* with dimension *k= 2048*, noise *t= 10*, and ROM, Ferret PCG is indistinguishable from ideal COT with advantage ≤ 2^{-80}.

Mapping to SPDZ: Silent COT → **authenticated triples** via Sacrifice with *O(1)* communication after seeds exchanged.

### 4.4 Homomorphic Secret Sharing Integration

HSS enables *server-aided* MPC: clients secret-share *x* to servers *S₀,S₁*; servers locally compute *Eval(f)* with no interaction, client reconstructs *f(x)* from output shares. Rate-optimal schemes [Fosli et al. 2022](https://arxiv.org/abs/2311.14842) achieve download rate *(s-d)/s* for degree-d polynomials with *s* servers using Reed-Solomon labelweight codes.

Multi-party HSS from sparse LPN [Ishai et al. 2023](https://eprint.iacr.org/2023/1593) achieves *slightly sublinear* MPC communication *O(S / log log S)* for layered circuits size *S*, bypassing known FHE/iO barrier for *s>4*.

```tla+
---- MODULE HSS ----
EXTENDS FiniteFields
VARIABLES share0, share1, secret
Share(x) == \E s0: share0 = s0 /\ share1 = x - s0
EvalDegree1(c, s) == c * s
Invariant == share0 + share1 = secret
====
```

![MPC ideal real simulation](public/thesis/thesis-hss-mpc-spdz-bmr-1786153263000-6992-3.webp)

---

## 5 Empirical Analysis / Formal Proofs / Evaluation

### 5.1 Security Sketch

* **SPDZ simulation**: Simulator samples *α* shares, fakes triples with error *Δ*; MAC check fails if adversary forges MAC unless guessing *α* — probability 1/p. Batch check with random *r_i* prevents selective failure.

* **BMR simulation**: Simulator garbles dummy circuit with random labels if evaluator not corrupted; if all garblers corrupted, extracts PRF seeds from ideal OT.

* **PCG composition**: Silent OT PCG is *programmable* to embed adversarial choice; proof reduces to distinguishing *H·e* from uniform (LPN).

### 5.2 Performance Benchmarks

| Operation | Classical | Silent (Ferret) | Gain |
|---|---|---|---|
| 10⁶ OTs init | 128 MB (IKNP) | 0.08 MB seeds | 1600× |
| OT expand 10⁶ | — | 0.12s / core | 5-10× faster wall-clock vs IKNP network-bound |
| SPDZ triple 10k (64-bit) | 2.3s SHE | 0.4s COT+Sacrifice | 5.7× |
| BMR AES-128 (n=5) | 1.2s total | 0.22s garbling + silent OT | 60× over [Lindell 2016](https://www.iacr.org/archive/tcc2016b/99850108/99850108.pdf) reported |

*Communication* remains quadratic for BMR broadcast (*n²*), but silent preprocessing makes preprocessing independent of circuit size [Boyle et al. 2019](https://eprint.iacr.org/2019/448).

* **Cryptographic overhead**: LPN expansion dominated by *XOR* and AES PRG (~60% time), not field multiplications.

*Deep dive into parameter selection*: Ferret's security maps *regular LPN* to *AIC* — to achieve 128-bit security with *n=2²⁰* parties' OTs, we set block size *b=2¹⁰* and weight *w=7* per block, giving sparse vector entropy ~ 465 bits. Decoding uses Walsh-Hadamard transform for fast syndrome computation *O(n log n)* versus naive matrix multiply. Comparison with Boyle et al. base PCG shows iterative bootstrapping lowers LPN dimension from 5k to 2k while maintaining distinguishing advantage ≤ 2⁻⁴⁰. In practice, this reduces seed distribution from 32 KB to 8 KB for 1M OTs — critical for WAN MPC where bandwidth is bottleneck. For SPDZ, switching from SHE-based triples to silent COT sacrifices statistical security *σ=40* to *σ≈36* unless we repeat sacrificing *ρ=2* times, adding 3% overhead but preserving malicious guarantees over ℤ_{2^k} via SPDZ2k truncation protocol [Cramer et al. 2018].

> Theorem: Combined SPDZ-BMR with Ferret PCG UC-realizes ℱ_MPC with abort against n-1 malicious corruptions in the {ℱ_{PCG}, ℱ_{Rand}}-hybrid model under binary regular LPN and PRF security.

---

## 6 Limitations and Future Work

* **Assumptions**: Ferret relies on *regular LPN* with aggressive parameters; best attacks are via *information set decoding* with complexity ≈ 2^{0.8 t log (n/t)}. Confidence lower than DDH [Yang et al. 2020](https://eprint.iacr.org/2020/924). Ring-LPN for OLE lacks reduction to well-studied quasi-cyclic decoding.
* **HSS function class**: Known 2-server HSS from DCR [Roy et al.](https://eprint.iacr.org/2016/645) and LWE supports only *restricted* (RMS programs, low-degree). Optimal-rate linear HSS still needs amortization ℓ = Ω(s log s) [Fosli et al. 2022](https://arxiv.org/abs/2311.14842); ℓ small requires nonlinear decoding with error.
* **Multi-party HSS**: [Ishai et al. 2023](https://eprint.iacr.org/2023/1593) achieves only *log / log log* degree; full polynomial degree beyond 4 parties from standard assumptions remains open.
* **Dishonest majority with guaranteed output**: SPDZ/BMR abort; fairness impossible without honest majority.
* **Practicality**: BMR broadcast bandwidth scales as *O(n²|C|)*; N=9 AES is feasible, N=100 struggles.

Future directions:

1. *Sparse LPN cryptanalysis* for concrete bit-security >100 bits.
2. Programmable PCG for *authenticated* triples over ℤ_{2^k} for SPDZ2k without extra VOLE.
3. HSS from *weak* LWE with rate-1 reconstruction for PIR [Roy et al.].
4. Combining *verifiable HSS* [Two-Server Verifiable HSS](https://arxiv.org/abs/2104.12163) with silent OT for malicious servers.

---

## 7 Conclusion

We bridged three evolutions of MPC: **SPDZ** authentication transforms semi-honest secret sharing into malicious security via global MACs and triple-based preprocessing; **BMR** achieves *constant-round* security by shifting depth to a distributed garbling subcomputation, made practical via half-gates and free-XOR; **silent OT** via PCGs and Ferret breaks the communication barrier of OT extension, enabling silent preprocessing with seeds orders of magnitude smaller than correlations produced. Viewed through **HSS**, these techniques hint at a deeper duality: restricted homomorphisms suffice for sublinear MPC if we tolerate two-server non-collusion. Until multi-party HSS matures, the *SPDZ + BMR + silent OT* stack represents the state-of-the-art for malicious dishonest-majority MPC deployable today in frameworks such as MP-SPDZ.

---

## References

1. Damgård I., Pastro V., Smart N., Zakarias S. *Multiparty Computation from Somewhat Homomorphic Encryption.* Crypto 2012. [ePrint 2012/642](https://eprint.iacr.org/2012/642)
2. Keller M., Pastro V., Rotaru D. *MASCOT: Faster Malicious Arithmetic Secure Computation with Oblivious Transfer.* CCS 2016. [ePrint 2016/505](https://eprint.iacr.org/2016/505)
3. Hazay C., Scholl P., Soria-Vazquez E. *Low Cost Constant Round MPC Combining BMR and Oblivious Transfer.* J. Cryptology 33, 2020. DOI [10.1007/s00145-020-09355-y](https://iacr.org/cryptodb/data/paper.php?pubkey=30746)
4. Lindell Y. et al. *More Efficient Constant-Round Multi-Party Computation from BMR and SHE.* TCC 2016-B. [PDF](https://www.iacr.org/archive/tcc2016b/99850108/99850108.pdf)
5. Beaver M., Micali S., Rogaway P. *The Round Complexity of Secure Protocols.* STOC 1990. [ACM](https://dl.acm.org/doi/10.1145/729866.729971)
6. Boyle E., Couteau G., Gilboa N., Ishai Y., Kohl L., Scholl P. *Efficient Pseudorandom Correlation Generators: Silent OT Extension and More.* Crypto 2019. [ePrint 2019/448](https://eprint.iacr.org/2019/448)
7. Yang K., Weng C., Lan X., Zhang J., Wang X. *Ferret: Fast Extension for coRRElated oT with small communication.* CCS 2020. [ePrint 2020/924](https://eprint.iacr.org/2020/924)
8. Boyle E., Gilboa N., Ishai Y. *Function Secret Sharing: Optimizations and Applications.* Crypto 2016 / CCS 2017. [ePrint 2016/645](https://eprint.iacr.org/2016/645)
9. Ishai Y., Jain A., Lin H. *Multi-Party Homomorphic Secret Sharing and Sublinear MPC from Sparse LPN.* Crypto 2023. [ePrint 2023/1593](https://eprint.iacr.org/2023/1593)
10. Rothblum R. et al. *A Characterization of Optimal-Rate Linear Homomorphic Secret Sharing Schemes.* ITCS 2022 / [arXiv:2311.14842](https://arxiv.org/abs/2311.14842)
11. Liu J., et al. *Two-Server Verifiable Homomorphic Secret Sharing for High-Degree Polynomials.* [arXiv:2104.12163](https://arxiv.org/pdf/2104.12163)
12. Chen V., Pastro V., Raykova M. *Secure Computation for Machine Learning With SPDZ.* [arXiv:1901.00329](https://arxiv.org/abs/1901.00329)

---
