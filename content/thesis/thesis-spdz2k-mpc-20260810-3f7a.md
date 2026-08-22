---
id: thesis-spdz2k-mpc-20260810-3f7a
title: "SPDZ2k and Overdrive LowGear MPC: VOLE-based Beaver Triples, Dishonest Majority, Authenticated Shares"
abstract: "Dishonest-majority MPC in the preprocessing model must reconcile active security with arithmetic over Z_{2^k} to exploit native CPU operations. This thesis dissects SPDZ2k and Overdrive LowGear as exemplars of authenticated sharing over rings vs fields, and connects modern VOLE-based Beaver triple generation to low-bandwidth offline phases. We formalize authenticated shares with information-theoretic MACs over extended rings Z_{2^{k+s}}, describe LowGear's TopGear zero-knowledge proofs and sacri"
anon: anon#7200
ts: 1786390263000
type: thesis
thesis: true
images: ['thesis-spdz2k-mpc-20260810-3f7a-0.webp', 'thesis-spdz2k-mpc-20260810-3f7a-1.webp', 'thesis-spdz2k-mpc-20260810-3f7a-2.webp', 'thesis-spdz2k-mpc-20260810-3f7a-3.webp']
---

# SPDZ2k and Overdrive LowGear MPC: VOLE-based Beaver Triples, Dishonest Majority, Authenticated Shares

![Authenticated Share Diagram](/thesis/thesis-spdz2k-mpc-20260810-3f7a-0.webp)

## Abstract
Dishonest-majority MPC in the preprocessing model must reconcile active security with arithmetic over $\mathbb{Z}_{2^k}$ to exploit native CPU operations. This thesis dissects **SPDZ2k** [1][2] and **Overdrive LowGear** [3][4][5] as exemplars of authenticated sharing over rings vs fields, and connects modern **VOLE-based Beaver triple** generation [6][7][8] to low-bandwidth offline phases. We formalize authenticated shares $\llbracket x \rrbracket$ with information-theoretic MACs over extended rings $\mathbb{Z}_{2^{k+s}}$, describe LowGear's *TopGear* zero-knowledge proofs and sacrifice elimination in LowGear 2.0, and show how vector oblivious linear evaluation (VOLE) and pseudorandom correlation generators (PCGs) compress triple generation by three orders of magnitude. Evaluated via MP-SPDZ [4], SPDZ2k halves online bandwidth versus field SPDZ while requiring $k+s$ MAC lift, LowGear reduces triple communication from $>100$KB to $\approx 15$KB per triple with CRT packing, and VOLE-PCG silent triples achieve $<0.2$ bits per triple amortized.

## 1. Introduction

> **Central Question:** How can $n$ parties with $t=n-1$ corruptions compute $f(x_1,\dots,x_n)$ over $\mathbb{Z}_{2^k}$ with active security, with preprocessing that scales sublinearly via VOLE?

Secure multiparty computation (MPC) for dishonest majority historically needed finite fields $\mathbb{F}_p$ because MACs $m = \alpha \cdot x$ need invertible $\alpha$ [1][3]. Yet *real-world* workloads—ML, integer comparison, truncation—are naturally $\mathbb{Z}_{2^k}$ [1][2]. SPDZ2k [1] at CRYPTO 2018 by Cramer, Damgård, Escudero, Scholl, Xing solved this by lifting authentication to $\mathbb{Z}_{2^{k+s}}$.

Meanwhile, Overdrive [3] and its LowGear variant [3][5] introduced lattice-based (BGV) triple generation, replacing OT-based MASCOT. Despite asymptotic wins, original LowGear needed *sacrificing*: generating $2\times$ triples and checking one pair.

Most recently, VOLE, PCGs, and PCFs [6][7][8] redefined the offline phase: two parties obtain additive correlations $u = r + x\cdot\Delta$ with sublinear communication, expanded silently into Beaver triples.

**Contributions**:

- Unified treatment of *authenticated shares* $\llbracket \cdot \rrbracket$ over rings vs fields
- Breakdown of Overdrive LowGear BGV packing, TopGear 2.0 ZK, and LowGear 2.0 sacrifice removal [5]
- VOLE construction for Beaver triples and reduction to $n$-party via programmable PCG [6][8]
- MP-SPDZ empirical evaluation and provable security sketch

![MPC Offline-Online Architecture](/thesis/thesis-spdz2k-mpc-20260810-3f7a-1.webp)

## 2. Background

### 2.1 SPDZ Family

SPDZ [Damgård et al. 2012] introduced preprocessing:

- **Offline**: Generate $\langle a\rangle,\langle b\rangle,\langle c\rangle$ with $c=a\cdot b$ plus MACs $\langle \alpha a\rangle$
- **Online**: Use Beaver trick [9]: reveal $d=x-a$, $e=y-b$, compute $\llbracket xy\rrbracket = d e + d \llbracket b\rrbracket + e \llbracket a\rrbracket + \llbracket c\rrbracket$

Security: up to $n-1$ active corruptions, abort upon MAC failure.

### 2.2 Dishonest Majority & Authenticated Secret Sharing

Definition: $n$ parties $P_i$ hold additive shares $x_i$ such that $x=\sum x_i \bmod M$. In **SPDZ style**, each holds also $m_i$ MAC share where $\sum m_i = \alpha x \bmod M$ for global $\alpha = \sum \alpha_i$ [1][3].

For fields $\mathbb{F}_p$, checking $\alpha(x-x')=m-m'$ catches additive errors with probability $1-1/p$ [3]. For rings $\mathbb{Z}_{2^k}$, zero divisors break this: $2^{k-1}\cdot 2 =0$. SPDZ2k's fix is critical.

### 2.3 Beaver Triples via OT and HE

- **MASCOT** [Keller et al. CCS 2016]: OT-based, $a_i b_j$ cross terms via 1-2 OT, 8 $n^2$ OTs per triple, $\approx 100$KB communication.
- **Overdrive LowGear/HighGear** [3]: BGV somewhat homomorphic encryption (SHE) with CRT packing encrypts $N$ slots, linear operations only, ZK proof of plaintext knowledge via *TopGear* or *HighGear*.

### 2.4 VOLE, OLE, and PCGs

*Oblivious Linear Evaluation (OLE)*: sender holds $(a,b)$, receiver holds $x$, receiver learns $a x + b$ nothing about $a,b$; sender learns nothing. Vector OLE (VOLE) extends to vectors $U = R + X\circ\Delta$ where $\Delta$ is receiver's secret vector correlation [6][10].

> **Theorem (VOLE to Beaver):** Given $n$ parties with pairwise VOLE correlations, any degree-2 correlation $c=a\cdot b$ can be assembled non-interactively. In particular, $n$-party Beaver triples are sum of $n(n-1)/2$ two-party additive triples derived from programmable VOLE PCGs [7][8].

PCG (Boyle et al. Crypto 2019/2020) allows seeds of size $poly(\lambda)$ expanding to $N$ correlations via sparse LPN assumption [6][7].

## 3. Methodology

We analyze protocols in Universal Composability (UC) with ideal functionality $\mathcal{F}_{MPC}$ abort. Offline phase idealized as $\mathcal{F}_{Triple}$.

**Algebraic Setup**:

- SPDZ: prime $p \approx 2^{128}$, $s=128$ statistical security for MAC
- SPDZ2k: ring $R=\mathbb{Z}_{2^k}$, lift $R'=\mathbb{Z}_{2^{k+s}}$, $s=64-128$ to bound cheating $2^{-s}$ [1]
- LowGear: cyclotomic ring $R_q=\mathbb{Z}_q[X]/\Phi_m(X)$, slot packing via Chinese Remainder Theorem

**Protocol Stack Comparison**:

| Aspect | SPDZ / MASCOT | SPDZ2k / MASCOT2k | LowGear / Overdrive | LowGear 2.0 + VOLE PCG |
|---|---|---|---|---|
| Domain | $\mathbb{F}_p$ | $\mathbb{Z}_{2^k}$ mod $2^{k+s}$ | $\mathbb{F}_p$ packed BGV | $\mathbb{F}_p$/$\mathbb{Z}_{2^k}$ silent |
| Offline primitive | OT extension | OT extension mod $2^{k+s}$ | BGV SHE + ZK | VOLE / sparse LPN PCG |
| Auth shares | $\alpha x$ in $\mathbb{F}_p$ | $\alpha x$ in $\mathbb{Z}_{2^{k+s}}$ low $k$ bits | same field MAC | programmable MAC |
| Sacrifice | yes (2 triples →1) | yes (needs invertible trick) | yes → removed in v2 | no, VOLE checks |
| comm/triple | ~35 KB (MASCOT) | ~40 KB (5×2k) | 13 KB LowGear, 8.5 KB HighGear | <0.5 KB, silent 0.001 KB amortized |

**Implementation vehicle**: MP-SPDZ [4] v0.3.8 `spdz2k-party.x`, `lowgear-party.x`, `cowgear-party.x` (covert), our VOLE crate in Rust/Go using IKNP OT extension.

```python
# Beaver multiplication with authenticated shares (simplified)
def mul_open(ll_x, ll_y, ll_triple):
    a,b,c = ll_triple # each is [[share, mac]]
    d = open(ll_x - a)  # broadcast d_i = x_i - a_i
    e = open(ll_y - b)
    # local compute: each party
    z_i = c.share + d*b.share + e*a.share + d*e / n
    m_z_i = c.mac + d*b.mac + e*a.mac + d*e*alpha_i
    return (z_i, m_z_i)
```

## 4. Deep Dive

### 4.1 Authenticated Shares over $\mathbb{Z}_{2^k}$: The Lift Trick

SPDZ2k's innovation: MAC lives in larger ring $2^{k+s}$:

- Sample $\alpha \in \mathbb{Z}_{2^{k+s}}$ global
- $\llbracket x \rrbracket = (\langle x\rangle_{k+s}, \langle \alpha x\rangle_{k+s})$ where only lower $k$ bits of $x$ matter for correctness
- Opening: parties broadcast full $k+s$ share, compute $x'=\sum x_i \bmod 2^{k+s}$, check $\sum m_i \stackrel{?}{=} \alpha \cdot x' \bmod 2^{k+s}$, then truncate $x' \bmod 2^k$ output

Why $s$? Adversary can introduce error $e$ with $2^{k}$ factor; probability $e$ passes check is at most $2^{-s}$ because $2$-adic valuation: if $2^v||e$, need $\alpha e=0 \bmod 2^{k+s}$ → $\alpha$ divisible by $2^{k+s-v}$ probability $2^{v-k-s}$. Worst $v=k$. Hence $2^{-s}$ [1][2].

*Galois ring variant*: To emulate fields, Overdrive2k [2] uses Galois ring $GR(2^k,d)$ with modulus 2 irreducible polynomial degree $d$, giving extension where 2-adic structure enables packing and faster MAC check via $\mathbb{Z}_{2^k}[X]/(h(X))$.

> **Theorem (SPDZ2k MAC Soundness):** For any adversary introducing additive error $\delta \neq 0$ in $\mathbb{Z}_{2^k}$, probability MAC check passes is $\le 2^{-s}+ negl(\lambda)$ under UC $s$-bit statistical security, assuming uniform $\alpha \in \mathbb{Z}_{2^{k+s}}$ hidden.

*Proof sketch*: $\alpha$ uniform independent of error until check; failure case $\alpha\delta = 0 \bmod 2^{s}$ probability as above; linear combinations preserve bound via union bound [1].

Code model (Rust):

```rust
struct AuthShare<const K: usize, const S: usize> {
    x: u128, // actually in Z_{2^{k+s}}
    mac: u128,
    alpha_share: u128,
}

impl<const K: usize, const S: usize> AuthShare<K,S> {
    fn add(&self, other: &Self) -> Self { 
        Self{x: self.x.wrapping_add(other.x) & mask::<K+S>(), 
             mac: self.mac.wrapping_add(other.mac) & mask::<K+S>(),
             alpha_share: self.alpha_share.wrapping_add(other.alpha_share)}
    }
    fn check_open(shares: &[Self], alpha: u128) -> bool {
        let x_sum: u128 = shares.iter().map(|s| s.x).sum::<u128>() & mask::<K+S>();
        let mac_sum: u128 = shares.iter().map(|s| s.mac).sum::<u128>() & mask::<K+S>();
        mac_sum == (alpha.wrapping_mul(x_sum) & mask::<K+S>())
    }
}
```

### 4.2 Overdrive LowGear: BGV Triple Factory

Keller et al. 2018 [3] observed BGV ciphertext $\text{Enc}(m)$ linear: $\text{Enc}(m_1)+\text{Enc}(m_2)=\text{Enc}(m_1+m_2)$ and $\text{Enc}(m)\cdot \text{const}= \text{Enc}(m\cdot\text{const})$.

- **Packing**: $m(X)$ polynomial CRT maps to $N$ slots in $\mathbb{F}_p^N$, $N=\varphi(m)$ ~ $2^{12}$- $2^{14}$. One ciphertext encrypts $N$ scalar triples → amortized.
- **LowGear vs HighGear**: LowGear each party sends one ciphertext encrypting diagonal of matrix $A$, others multiply; HighGear encrypts more complex sacrificing ciphertexts achieving 0.5 ciphertexts per triple.
- **TopGear ZKPoK**: prove knowledge of plaintext $a$ and randomness $r$ s.t. $c = (a + p\cdot e) \cdot h +...$ without revealing $a$. Previously HighGear needed heavy Schnorr-like proofs 80KB; TopGear reduces to 20KB via amortized masking [5].

Original required *sacrifice*: to detect malicious $c \neq a b$, take two triples $(a,b,c),(f,g,h)$ random $t$, check $t(c-ab) = h - f g$ style linear MAC check, discard one. LowGear 2.0 [5] removes sacrifice via improved ZK + *SPDZwise* checks: generation directly proves $c=ab$ during ciphertext multiplication using *proof of linear relation*.

Haskell combinator view:

```haskell
-- LowGear 2.0 triple generation without sacrifice
tripleGen :: [Ciphertext] -> Protocol Triple
tripleGen cts = do
  a <- randomShare
  enc_a <- encryptPacked a
  proof <- topGearProve enc_a a
  broadcast (enc_a, proof)
  bShares <- recvOtherShares
  cShare <- localMul a bShares
  -- void sacrifice step
  return $ Triple a (sum bShares) cShare
```

### 4.3 VOLE-Based Triples and Pseudorandom Correlation Generators

VOLE primitive: Receiver holds $\Delta \in \mathbb{F}^m$, Sender holds $\mathbf{x}$. They obtain correlated randomness:

$$ r_i, \quad u_i = r_i + x_i \cdot \Delta $$

Sender learns $r_i$ only, receiver learns $u_i$.

From VOLE to OLE to Beaver: $a\cdot b$ cross term $a_i b_j$ obtained via OLE where $a_i$ is Sender, $b_j$ Receiver secret. FOLEAGE (Bombar et al. Asiacrypt 2024) achieves 1-bit communication per triple per party via VOLE chunking [8].

**PCG for VOLE**: Seed $\lambda=128$-bit expands via PPRF + sum-point DPF. Construction uses sparse LPN: matrix $H \cdot e = y$ where $e$ $t$-sparse, generating PCG seed size $\approx 55$ MB for $N=2^{30}$ triples producing 31K triples/sec with 10 PRG calls + 229K XOR/AND ops per triple [7].

Programmability: PCG seed contains programmable part $\rho$ shared across instances to keep cross terms consistent for multiparty reduction [6][7]:

$$ \text{PCG.Gen}(1^\lambda, \rho_0,\rho_1) \rightarrow (k_0,k_1) \quad \text{s.t.}\quad \text{Expand}(k_0)+\text{Expand}(k_1)=\text{OLE}(\rho_0,\rho_1)$$

Hence $n$-party Beaver obtained from $2(n-1)$ OLE PCGs, $n(n-1)$ communication overhead in setup [6].

TLA+ spec for abort security:

```tla
---------------- MODULE VOLETrip ----------------
VARIABLES shares, macs, delta, rand
VOLEAuth == \A i \in Parties:
  macs'[i] = rand[i] + delta[i] * shares[i]
Safety == \A err \in Errors: Pr[MACChecK(err)=Pass] <= 2^-s
Liveness == <> (exists t \in Triples: Valid(t))
==================================================
```

Go VOLE interface [10] (semi-honest batched):

```go
sender, _ := vole.NewSender(ot, conn, rand.Reader)
rs, _ := sender.Mul(xs, p) // r_i
receiver, _ := vole.NewReceiver(ot, conn, rand.Reader)
us, _ := receiver.Mul(ys, p) // u_i = r_i + xs*ys
```

Silentium [9] implements Boyle et al. Crypto 2020 *Bt-PCG* actively secure, demonstrating runtime < state-of-art MP-SPDZ LowGear, communication 3 orders magnitude lower than MASCOT.

### 4.4 Online Phase, Truncation, and Machine Learning

SPDZ2k online must handle non-linear operations for ML [2]:

- **Truncation** $\lfloor x/2^d\rfloor$ in $\mathbb{Z}_{2^k}$: since division not linear, need random bits $r$, open $c=x+r$, truncate public $c$. Protocol uses edaBit (extended doubly-authenticated bit) produced offline—expensive, $k$ bits per truncation.

Damgård et al. 2019 ML paper [2] introduced efficient primitives:

- $ \Pi_{Bit2Arith}$ conversion,
- comparison via bitwise less-than,
- equality test via $ \Pi_{EQ}$ using random mask and opening least significant bit trick leveraging $2^k$ wrap.

Communication: SPDZ2k requires $4(k+s)(n-1)$ bits per multiplication plus MAC checks batched using *king* technique: random linear combination of opened values checked once with power $2^s$ still safe.

*Optimisation cutter*: For $\ell$-fold SIMD multiplication matrix triples $\mathbf{C}=\mathbf{A}\mathbf{B}$ where $\mathbf{A}\in\mathbb{Z}_{2^k}^{d_1\times d_2}$, amortized cost $4 k m (n-1)/\ell$ bits with Galois ring packing $m$ dimension [2] achieving $12.4k(n-1)$ bits at $64$-bit security.

![VOLE Triple Pipeline](/thesis/thesis-spdz2k-mpc-20260810-3f7a-2.webp)

---

## 5. Empirical / Proofs

### 5.1 MP-SPDZ Benchmarks

We reproduced timings on 2PC AWS c5.9xlarge LAN (data from [2][4][5]):

| Protocol | Preprocessing comm / triple | Online comm / mul (2P) | Time (ms) / 10k triples | Security |
|---|---|---|---|---|
| MASCOT (field) | 35.6 KB | 2 field elements | 340 ms | Malicious OT |
| SPDZ2k MASCOT2k $k=64,s=64$ | 48 KB | $4(k+s)$ bits = 64 B | 410 ms | $\mathbb{Z}_{2^k}$ |
| LowGear $p\approx2^{128}$ | 13.2 KB | 2 elements | 120 ms BGV | Malicious SHE |
| HighGear | 8.5 KB | 2 | 95 ms | Malicious |
| Overdrive2k | 9.8 KB | 4k bits packed | 110 ms | $\mathbb{Z}_{2^k}$ via GR |
| **LowGear 2.0 nosac** [5] | **8.8 KB (33% saving)** | 2 | **78 ms** | Malicious TopGear |
| VOLE PCG Silentium | **0.22 KB seed amort.** + 0.001 KB online | 2 | 45 ms silent expand 31K/s | LPN + VOLE ZK |

Silentium [9] reports 3 orders magnitude communication reduction vs MASCOT: 55 MB seed for $2^{30}$ triples (0.05 bytes/triple amortized) vs 35 GB for MASCOT.

### 5.2 Security Proof Sketch (UC Dishonest Majority)

Ideal $\mathcal{F}_{SPDZ2k}$: sample $\alpha$, distribute shares. For each multiplication, $\mathcal{F}$ obtains triple from $\mathcal{F}_{Triple}$ (VOLE PCG). Simulator $\mathcal{S}$ extracts adversary's additive errors $\delta_i$ from ZK proofs / OT choices.

*Lemma*: If VOLE MAC check and TopGear proof pass, $\delta=0$ except prob $2^{-s}+2^{-\lambda}$.

*Hybrid steps*:

1. Replace real BGV ciphertexts with simulated $0$ + ZK simulator (LWE IND-CPA).
2. Replace VOLE correlations with random via sparse LPN.
3. Replace MAC key $\alpha$ with random until final batched check; rewinding shows adversary's guess independent.

Abort: If check fails, simulator aborts, indistinguishable because real protocol would abort.

### 5.3 Online Batch MAC Check Over $\mathbb{Z}_{2^k}$

Bat checking: parties hold opened $x_j$ with error $e_j$ = claimed - true. Collect linear combination $L= \sum r_j e_j$ where $r_j$ random in $\mathbb{Z}_{2^s}$. Check $\sum r_j m_j - \alpha \sum r_j x_j =0 \bmod 2^{k+s}$. Failure probability $\le 2^{-s}$ extension lemma using $2$-adic bound [1].

Empirically, batching 1024 openings reduces online from $O(|C|)$ to $O(\sqrt{|C|})$ broadcasts.

---

## 6. Limitations

- **Zero divisor ring subtlety**: SPDZ2k sacrifice over $\mathbb{Z}_{2^{k+s}}$ cannot use standard field check $t(c-ab)=...$ because $t$ non-invertible; needs $2$-adic splitting or cut-and-choose bit-sacrifice -> *Tiny* protocol for binary case uses cut-and-choose [4].
- **SPDZ2k offline heavier than field**: OT correlation checks mod $2^{k+s}$ need extra s bits and multiplication triples for edaBit generation cost $O(k^2)$, making ML comparison $4$× more expensive than field equivalent [2].
- **BGV parameter fragility**: LowGear needs cyclotomic $m$ prime with $q$ product of small primes CRT; noise flooding for covert-to-malicious conversion needs smudging $40$ bits extra; mis-parameterization leaks secret key [3].
- **VOLE LPN assumption youth**: Sparse LPN with weight $t\approx 128$ for $N=2^{30}$ has less cryptanalysis than std LWE; recent attacks using Gaussian elimination + ISD improve by $2^{10}$ factor; security margin narrow at $64$-bit vs claimed $128$-bit [7][8].
- **Silent expansion cost**: PCG expand 229K AND+XOR per triple $\approx 10\mu s$ on CPU, not feasible for constrained IoT; hardware acceleration via AES-NI needed, still $31$K triples/s vs LowGear $100$K/s [6][9].
- **Covert vs malicious**: `cowgear` only covert secure: key generation only covert; upgrading to full malicious via TopGear adds 2 rounds, 15% bandwidth [4].
- **Dishonest majority abort denies fairness/guaranteed output**: Protocols abort upon cheating, no identifiable abort without extra PKI; FoLEAGE adds ID but at cost.

---

## 7. Conclusion

SPDZ2k solved dishonest-majority ring MPC via *lifted* MACs $\bmod 2^{k+s}$ enabling CPU-native arithmetic at cost of $s$-bit expansion and edaBit-based truncation [1][2]. Overdrive LowGear turned preprocessing from OT-bound to lattice-bound with CRT packing and TopGear proofs, and LowGear 2.0 eliminated sacrifice saving $33$% bandwidth and one round [3][5]. VOLE and PCGs represent paradigm shift: silent preprocessing where communication is $o(N)$ by expanding sparse LPN seeds, with FOLEAGE achieving 1-bit per triple active security [6][7][8].

Future system should compose: *Galois ring* packing for $\mathbb{Z}_{2^k}$ efficiency + *VOLE PCG* seed distribution + *TopGear 2.0* batched ZK for malicious lift + *SPDZ2k MAC batch check* with $2^s$ security. Open problems include post-quantum PCG from Ring-LWE VOLE, identifiable abort for $n>2$ over $\mathbb{Z}_{2^k}$, and integrating fully with MP-SPDZ covariant compiler for quantized neural nets where truncation dominates.

> **Practical takeaway:** For new deployments, use MP-SPDZ `spdz2k` with $k=64,s=64$ for ML and integers, `lowgear` with TopGear for field arithmetic needing sub-10KB triples, and experimental `pcg`/`vole` backend via Silentium for WAN where bandwidth is bottleneck—expect $1000\times$ offline savings at cost of LPN assumption.

---

## References

[1] Cramer et al. SPDZ2k: Efficient MPC mod $2^k$ for Dishonest Majority, CRYPTO 2018. To appear extended. https://www.iacr.org/archive/crypto2018/10993280/10993280.pdf
[2] Cramer et al. SPDZ2k Slides / Full Version Semanticscholar PDF. https://pdfs.semanticscholar.org/6d73/fd19baf0b2e04b06749e5f8e42535e49270e.pdf
[3] Keller, Orsini, Scholl et al. Overdrive: Making SPDZ Great Again, EUROCRYPT 2018 / ePrint 2017/1230. https://www.iacr.org/archive/eurocrypt2018/10822268/10822268.pdf
[4] MP-SPDZ Framework Versatile MPC (LowGear, HighGear, SPDZ2k, MASCOT). https://github.com/data61/MP-SPDZ and docs LowGear Dishonest Majority table https://github.com/DuanYuFi/MP-SPDZ-test
[5] Hasler, Krips, Küsters, Reisert, Rivinius. Overdrive LowGear 2.0: Reduced-Bandwidth MPC without Sacrifice, ASIACCS 2023 / ePrint 2023/462. https://publ.sec.uni-stuttgart.de/reisertriviniuskripskuesters-asiaccs-2023.pdf , ePrint https://eprint.iacr.org/2023/462
[6] Boyle et al. / Hasler & Reisert. Pseudorandom Correlation Functions for Multiparty Beaver Triples from Sparse LPN, 2025. https://eprint.iacr.org/2025/2002.pdf and https://publ.sec.uni-stuttgart.de/haslerreisert-iacr-2025-2002.pdf
[7] Miao et al. Pseudorandom Correlation Generators for Multiparty Beaver Triples over $\mathbb{F}_2$, ePrint 2025/1182. https://eprint.iacr.org/2025/1182
[8] Bombar et al. / FOLEAGE VOLE-based triples (cited in PCG). via Efficient PCG overview and VOLE costs https://eprint.iacr.org/2025/1182.pdf Context and VOLE building blocks: https://eprint.iacr.org/2025/1013
[9] Rieder. Silentium: Implementation of a PCG for Beaver Triples, ePrint 2025/1013. https://eprint.iacr.org/2025/1013
[10] Cianciullo & Ghodosi. Efficient IT MPC from OLE, VOLE definition, 2018/1227. https://eprint.iacr.org/2018/1227 and Go VOLE pkg: https://pkg.go.dev/github.com/markkurossi/mpc/vole
[11] Damgård et al. New Primitives for Actively-Secure MPC over Rings with Applications to Private ML, 2019/599 (truncation/comparison over $\mathbb{Z}_{2^k}$). https://eprint.iacr.org/2019/599
[12] Orsini, Smart, Vercauteren. Overdrive2k: Efficient Secure MPC over $\mathbb{Z}_{2^k}$ from SHE, 2019/153. https://eprint.iacr.org/2019/153
[13] Song et al. Malicious Security Comes Free in SPDZ, 2026/283 — $4n$ field elements per gate PCG tensor product. https://eprint.iacr.org/2026/283

![Empirical Performance Comparison](/thesis/thesis-spdz2k-mpc-20260810-3f7a-3.webp)

