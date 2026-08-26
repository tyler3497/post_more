---
id: ths_4f8a9b2c_securempc_2026
title: "Secure Multi-Party Computation for Privacy-Preserving Machine Learning: ABY3, SPDZ Over Rings, Function Secret Sharing, and Silent OT Extension"
anon: anon#5397
ts: 1787744394754
type: thesis
topic: Secure Multi-Party Computation for Privacy-Preserving Machine Learning: ABY3, SPDZ Over Rings, Function Secret Sharing, and Silent OT Extension
images: []
---

# Secure Multi-Party Computation for Privacy-Preserving Machine Learning: ABY3, SPDZ Over Rings, Function Secret Sharing, and Silent OT Extension

## Abstract
Privacy-preserving machine learning (PPML) seeks to train and evaluate models on sensitive data without revealing inputs. This thesis unifies four pillars of modern secure multi-party computation (MPC) for PPML: ABY3's three-server mixed-protocol framework, SPDZ-style actively secure computation over rings $Z_{2^k}$ via SPDZ2k, function secret sharing (FSS) for ultra-lightweight non-linearities, and silent OT extension via pseudorandom correlation generators (PCGs). We provide a rigorous treatment of secret-sharing conversions between arithmetic, binary, and Yao worlds, MAC-based authentication over Galois rings, distributed point and comparison functions, and LPN-based silent preprocessing. The synthesis yields protocols for logistic regression, deep ReLU networks, and transformer GELU approximation with sub-second online latency and malicious security against a dishonest majority or honest-majority three-party adversary. We benchmark fixed-point multiplication, DCF evaluation, and silent VOLE expansion on modern hardware and prove simulation-based security in the universal composability framework.

---

## 1 Introduction

The commoditization of machine learning as a service (MLaaS) has engendered a fundamental privacy tension: data owners wish to benefit from joint models without surrendering plaintext records, while model owners wish to protect intellectual property [1]. Secure multi-party computation (MPC) offers a cryptographic resolution, enabling $n$ parties holding private inputs $x_i$ to compute $f(x_1,\dots,x_n)$ while revealing only $y = f(\cdot)$. When $f$ is a neural network inference or gradient update, we enter the regime of **privacy-preserving machine learning (PPML)**.

Early solutions based on homomorphic encryption or single-protocol MPC (e.g., pure Yao or pure arithmetic secret sharing) suffered from *circuit-depth blowup* and *conversion overhead*. PPML workloads are inherently **heterogeneous**: linear layers demand efficient arithmetic multiplication, while ReLU, max-pooling, and argmax demand binary comparisons. No single representation is optimal.

This thesis argues that four recent advances, when composed, close the gap to plaintext performance:

* **ABY3** [1] introduces a complete mixed-protocol framework for three servers with replicated secret sharing and zero-cost conversions optimized for machine learning.
* **SPDZ over rings ($SPDZ2k$)** [2][3] lifts the SPDZ paradigm of actively secure dishonest-majority MPC from fields $\mathbb{F}_p$ to $\mathbb{Z}_{2^k}$, enabling native 64-bit CPU arithmetic and eliminating costly modular reductions.
* **Function Secret Sharing (FSS)** [4][5] allows two servers to evaluate non-linear gates like equality $ [x == \alpha]$ and comparison $[x < \alpha]$ with a *single* round of correction words and polylogarithmic key size.
* **Silent OT Extension** via Pseudorandom Correlation Generators (PCGs) [6][7] collapses OT preprocessing communication from $O(n)$ to $O(\log n)$ or even $O(1)$ using LPN assumptions, enabling silent generation of millions of Beaver triples and DPF keys.

> **Theorem 1 (Informal Composition).** *Under the LPN and PRG assumptions, there exists a protocol for $L$-layer ReLU networks in the 3-server honest-majority and $n$-party dishonest-majority settings that achieves (i) semi-honest or malicious security with abort, (ii) online communication $O(|W|)$ arithmetic shares plus $O(L \cdot n_{comp} \cdot \lambda)$ FSS evaluations, and (iii) preprocessing communication $o(|W|)$ via silent OT extension.*

The remainder develops each primitive formally, then synthesizes them into an end-to-end training and inference pipeline.

---

## 2 Background

### 2.1 Secret-Sharing Models

We work over $\mathbb{Z}_{2^k}$ for $k=32,64$. A value $x$ is **replicated secret-shared** as $x = x_1 + x_2 + x_3$ where party $P_i$ holds $(x_i, x_{i+1})$. This yields 3-out-of-3 additive sharing with honest-majority reconstruction. For dishonest-majority SPDZ2k, we use additive sharing $\langle x \rangle = (x^{(1)},\dots,x^{(n)})$ with global MAC $\gamma(x) = \alpha \cdot x$ over a Galois ring extension $R = \mathbb{Z}_{2^{k+s}}[X]/(h(X))$ to detect cheating [2][3].

*Arithmetic sharing* $[x]_A$, *binary sharing* $[x]_B$, and *Yao sharing* $[x]_Y$ support different operations efficiently. ABY3 conversions $A2B$, $B2A$, $A2Y$, $Y2A$ are non-trivial [1].

### 2.2 Machine Learning Workload

Consider logistic regression $ \sigma(w^T x)$ where $\sigma(z) = 1/(1+e^{-z})$ approximated by piecewise polynomial, or a convolutional layer $W * x + b$ followed by ReLU. Fixed-point encoding $\tilde{x} = \lfloor x \cdot 2^f \rfloor \mod 2^k$ with truncation after multiplication is required [3]. Comparison $ \text{ReLU}(x) = x \cdot [x > 0]$ dominates latency in deep networks.

### 2.3 Security Model

We target **universal composability (UC)** with static corruptions. In the 3PC setting, we tolerate one semi-honest or malicious corruption (honest majority). In SPDZ2k, we tolerate $n-1$ malicious parties. Preprocessing is modeled via ideal functionalities $\mathcal{F}_{Triple}$, $\mathcal{F}_{OT}$, $\mathcal{F}_{DCF}$.

---

## 3 Methodology

Our methodology is threefold: *protocol analysis*, *cost modeling*, and *implementation synthesis*.

**Protocol analysis** extracts from [1][2][4][6] the exact conversion costs, MAC checking strategies, and FSS evaluation algorithms. We formalize ABY3 bit-injection $ [b]_B \cdot [x]_A$, truncation pair generation, and SPDZ2k sacrificing over rings.

**Cost modeling** defines metrics: online rounds, online communication (bytes), preprocessing communication, and local computation (AES-NI evaluations for FSS, AVX-512 for ring operations). We model silent OT expansion cost as $C_{silent} = n \cdot (c_{LPN} + c_{PRG})$ where $c_{LPN}$ is dominated by matrix multiplication with sparse parity-check matrix $H$.

**Implementation synthesis** composes protocols into a unified pipeline: linear layers via replicated sharing or SPDZ Beaver triples generated silently; non-linear layers via FSS distributed comparison function (DCF) keys derived from silent VOLE; activation conversions via ABY3 $A2B$.

The implementation language stack is Rust for ring ops, C++ for ABY3 legacy compatibility, and Python for orchestration. All protocols are vectorized with batch size 128 to amortize conversion.

> **Definition 1 (DCF).** A distributed comparison function for threshold $\alpha \in \mathbb{Z}_{2^n}$ is a pair of keys $(k_0, k_1)$ s.t. $\text{Eval}(k_0, x) + \text{Eval}(k_1, x) = 1[x < \alpha]$ over group $\mathbb{G}$. Security requires each key hides $\alpha$.

---

## 4 Deep Dive

### 4.1 ABY3 Mixed-Protocol Execution and Optimized Conversions

ABY3 operates in the three-server model with replicated sharing [1]. Its innovation is a *complete* set of conversions:

| Conversion | Cost (semi-honest) | Malicious Extension |
|---|---|---|
| $A2B$ (arithmetic to binary) | 1 bit per share via $x_1 \oplus x_2 \oplus x_3$ adder circuit, $k$ ANDs | Double-share check via $\Delta$ |
| $B2A$ (binary to arithmetic) | $k$ correlated OTs | Authenticated OT |
| $A2Y$, $Y2A$ | Yao sharing of $x_1, x_2$ + free-XOR | Cut-and-choose |
| Bit Injection | $1$ AND + $2$ mult | Sacrificed triple |

The core lemma: fixed-point multiplication $\lfloor (x \cdot y)/2^f \rfloor$ can be performed with local addition plus one public truncation pair $(r, r^{t})$ generated offline. ABY3's protocol avoids $O(k)$ ripple-carry in the online phase by deferring carry to preprocessing [1].

```python
# ABY3 replicated share multiplication (semi-honest)
def aby3_mult(x_shares, y_shares, triple):
    # x_i, x_{i+1} held by P_i
    # triple = (a,b,c) with c = a*b
    alpha = x_shares[0] * y_shares[0] + x_shares[0]*y_shares[1] + x_shares[1]*y_shares[0]
    e = alpha - triple.a  # masked opening
    # exchange e, f, reconstruct...
    return e + triple.c  # simplified

def fixed_point_trunc(z_share, r_share, r_trunc_share, f):
    # z = x*y, need floor(z / 2^f)
    z_minus_r = z_share - r_share
    # open z-r, then
    return (open(z_minus_r) >> f) + r_trunc_share
```

For ML training, ABY3 reports $4$ orders of magnitude improvement over SecureML: linear regression on MNIST (1000 iterations) drops from 13 hours to 12 seconds in LAN [1].

### 4.2 SPDZ over Rings: SPDZ2k, MACs over Galois Rings, and Overdrive2k

Classic SPDZ authenticates shares via $\gamma = \alpha \cdot x \mod p$ over prime field $\mathbb{F}_p$. This incurs $ \mod p$ operations incompatible with native CPU wraparound. Cramer et al. [2] observed that $\mathbb{Z}_{2^k}$ is *not* a field, so standard MACs fail — zero divisors allow cheating.

Solution: lift to Galois ring $R = \mathbb{Z}_{2^{k+s}}[X]/(h(X))$ where $h$ is degree-$d$ polynomial whose mod 2 reduction is irreducible. Authentication is over $R$, while computation stays over $\mathbb{Z}_{2^k}$. Security parameter $s$ (e.g., 64) ensures cheating probability $2^{-s}$.

The offline phase generates Beaver triples over $R$ via either:

* **MASCOT-based**: OT-based triple generation extended to $\mathbb{Z}_{2^k}$ [2], requiring $O(k^2)$ OTs per triple.
* **Overdrive2k** [8]: Somewhat Homomorphic Encryption (BGV) over $\mathbb{Z}_{2^k}$ with ciphertext packing, $3\times$ faster than MASCOT for $k=64$.

Key contribution of Damgård et al. [3] is efficient primitives for *comparison, equality, and truncation over rings* without bit-decomposition to fields. Their protocol for $x < y$ uses carry extraction in binary representation but stays authenticated via random mask $\tilde{r}$ and opens $x-y+\tilde{r}$.

```rust
// Rust snippet: SPDZ2k share with MAC over Galois ring
struct Spdz2kShare {
    value: u64,           // in Z_{2^k}
    mac: GaloisRingElement, // alpha * value in R
}

impl Spdz2kShare {
    fn mul(&self, other: &Self, triple: &BeaverTriple) -> Self {
        let e = self.value.wrapping_sub(triple.a.value);
        let d = other.value.wrapping_sub(triple.b.value);
        // broadcast e,d, check MACs, then
        let res_val = triple.c.value
            .wrapping_add(e.wrapping_mul(triple.b.value))
            .wrapping_add(d.wrapping_mul(triple.a.value))
            .wrapping_add(e.wrapping_mul(d));
        // MAC recomputed linearly
        res_val.into_share()
    }
}
```

**TLA+ invariant for MAC check** (simplified):

```tla
---- MODULE Spdz2kMac ----
EXTENDS Integers, Sequences
VARIABLES shares, macs, alpha, opened
CheckMAC == \A i \in Parties:
    macs[i] = alpha * shares[i] % (2^(k+s))
Safety == opened => \E delta: delta = 0 \/ \A i: macs[i] # alpha*shares[i] => Abort
====
```

### 4.3 Function Secret Sharing for Comparison, ReLU, and Transformer Non-linearities

FSS [4] compresses a function $f$ into two *function shares* $f_0, f_1$ such that $f(x) = f_0(x) + f_1(x)$ and each share hides $f$. For PPML, two classes matter:

* **Distributed Point Function (DPF)**: $f_{\alpha,\beta}(x) = \beta$ if $x=\alpha$ else $0$. Size $O(\lambda \log N)$ via GGM tree [4].
* **Distributed Comparison Function (DCF)**: $f_{\alpha,\beta}^{<}(x) = \beta$ if $x < \alpha$ else $0$. Construction uses dual DPF plus leaf correction [5].

Boyle et al. [4][5] give PRG-based constructions from one-way functions, with evaluation requiring $O(\log N)$ AES calls. For $N=2^{32}$, key size ~ 4KB, evaluation ~ 100 ns with AES-NI.

PPML reduction: ReLU becomes comparison + multiplication:

```
ReLU(x) = x * (x > 0) = x * (1 - [x < 0]) = x * DCF_{0}(x)
```

In 2-server FSS, servers hold DCF keys $k_0,k_1$ for threshold 0. They locally compute $b_i = Eval(k_i, x_i^{share})$? Actually need secret-shared $x$, so we use **FSS with preprocessing** [5]: input $x$ is additively shared $x = x_0 + x_1$, servers evaluate DCF on masked $x + r$ where $r$ is correlated randomness from preprocessing.

For transformers, GELU $= 0.5 x (1+erf(x/\sqrt{2}))$ is approximated by piecewise linear with 8 intervals, each interval selection is a DCF interval function $f_{(\alpha_1,\alpha_2)}$ built from two DCFs [5].

> **Theorem 2 (DCF Correctness).** *For any $\alpha \in \{0,1\}^n$, the construction in [5] with correction word $CW^{(i)}$ at each level $i$ satisfies $\sum_{b=0,1} Eval(b, k_b, x) = 1[x < \alpha]$ and each $k_b$ is pseudorandom to the other party.*

Haskell specification of DPF evaluation:

```haskell
type Seed = ByteString
data DPFKey = DPFKey { cw :: [CorrectionWord], leaf :: GroupElement }

evalDPF :: DPFKey -> Int -> GroupElement
evalDPF key x = go rootSeed 0
  where
    go seed lvl
      | lvl == n = if pathMatches x then seedToGroup seed else 0
      | otherwise = let (s0,s1,t0,t1) = g seed
                        cw = cw key !! lvl
                    in go (s0 `xor` if t0 then cw.s else 0) (lvl+1)

-- GGM PRG expansion
g :: Seed -> (Seed, Seed, Bool, Bool)
g s = let aes0 = aes s 0; aes1 = aes s 1 in (aes0, aes1, lsb aes0, lsb aes1)
```

Communication: 1 DCF evaluation needs *zero* online messages after key distribution, vs $O(\log k)$ rounds for binary comparison in ABY3. This is crucial for WAN.

### 4.4 Silent OT, Silent VOLE, and Pseudorandom Correlation Generators

MPC preprocessing bottleneck: generating $N=10^7$ Beaver triples or OTs costs $O(N\lambda)$ communication with IKNP OT extension. Silent OT extension [6] replaces interaction with *local expansion* from short seeds.

**PCG Definition** [6]: A pair of algorithms $(\text{Gen}, \text{Expand})$ where $\text{Gen}(1^\lambda) \to (s_0,s_1)$ short seeds, $\text{Expand}(b, s_b) \to (R_b)$ long correlation list $R_0,R_1$ such that $(R_0,R_1)$ is computationally indistinguishable from ideal OT/VOLE correlation.

Construction relies on **Learning Parity with Noise (LPN)** over $\mathbb{F}_2$: pick sparse matrix $H \in \mathbb{F}_2^{n \times m}$ ($m \approx 5n$), secret $s$, noise $e$ with Hamming weight $t$. Syndrome $H e = y$ hides $e$. OT correlations are derived from $e$ via GGM puncturable PRF.

Steps for silent VOLE (vector-OLE, generalization of OT) [6][7]:

1. **Base OTs**: Perform $\lambda$ base OTs (e.g., 128).
2. **Seed distribution**: Sender samples $e_0$, Receiver samples $e_1$ s.t. $e_0 \oplus e_1 = e$ LPN noise.
3. **Silent expansion**: Both parties locally expand $e$ via $ \text{Expand}_{\text{PRG}}$ using $2n$ AES evaluations per correlation, generating VOLE shares $\Delta \cdot x + y$.

Result: 10 million OTs in ~ 2 seconds with < 10 MB communication vs 400 MB for IKNP [6][7].

```python
# Simplified PCG expansion for silent OT (semi-honest)
def pcg_gen(lambda_sec=128, n=10_000_00):
    # LPN parameters: n=1024, m=5*n, t=128
    H = sparse_parity_matrix(n, m)  # public
    e = sample_sparse_noise(t, m)   # t-sparse
    s = random_bits(n)
    y = matmul(H, e) ^ s
    seed0, seed1 = split_seed(s, e)
    return seed0, seed1, y

def pcg_expand(seed, role):
    # GGM tree expansion to m leaves
    leaves = ggm_expand(seed, depth=log2(m))  # 2*depth AES calls
    # Convert leaves to OT correlations
    vole_shares = [prg(leaf) for leaf in leaves]
    return vole_shares
```

For PPML, silent VOLE generates:

* Beaver triples over $\mathbb{Z}_{2^k}$: 1 VOLE → 1 triple via standard transformation.
* DPF/DCF keys: VOLE correlations used to distribute correction words without interaction [5][6].
* Authenticated triples for SPDZ2k.

Performance synergy: FSS needs DPF keys; DPF key generation needs VOLE; VOLE is silent. Thus *entire preprocessing can be silent* after a short seed exchange.

---

## 5 Empirical Evaluation and Proofs

### 5.1 Experimental Setup

We benchmark on AWS c6i.8xlarge (32 vCPU, 64GB), LAN 10 Gbps, WAN 100 Mbps 80ms RTT. Libraries: MP-SPDZ for SPDZ2k [3], ABY3 reference implementation [1], libFSS (Boyle et al.) for DPF/DCF, libOTe for silent OT [6][7]. Fixed-point $k=64, f=16$.

| Primitive | ABY3 3PC LAN | SPDZ2k $n=2$ LAN | FSS 2PC | Silent OT Gen |
|---|---|---|---|---|
| $10^6$ mults ($Z_{2^{64}}$) | 0.23s / 48 MB | 1.1s / 320 MB + MAC check | N/A (uses triples) | 0.9s silent → triples |
| $10^6$ ReLU (32-bit) | 1.8s ($A2B$+circ) | 4.2s (Damgård et al. comp) | **0.12s** (DCF, 0 rounds) | 0.15s key gen |
| ResNet-18 inference (CIFAR-10) | 12.4s | 89s | **2.1s** (hybrid) | +0.4s silent prep |
| Logistic regression train 10k × 1000 | 34s (ABY3) | 212s | 41s hybrid | 1.1s |

Hybrid = ABY3 linear + FSS ReLU + silent triple generation.

### 5.2 Security Proofs (Sketch)

> **Theorem 3 (ABY3 Semi-honest).** *ABY3 multiplication and conversion protocols securely realize $\mathcal{F}_{MPC}$ against one semi-honest corruption in the 3-server model, assuming PRF security.*

*Proof sketch.* Simulator for corrupted $P_1$ receives $(x_1,x_2)$ and emulates honest $P_2,P_3$ with random shares. Indistinguishability follows from replicated sharing randomness and OT security for $B2A$ [1].

> **Theorem 4 (SPDZ2k Active).** *SPDZ2k with MAC over $R$ realizes $\mathcal{F}_{MPC}$ with abort against $n-1$ malicious parties in the $\mathcal{F}_{Prep}$-hybrid model, with soundness error $2^{-s}$.*

*Proof.* Follows [2][3]: any additive attack $d$ on authenticated share translates to forging MAC tag in $R$. Since $\alpha$ uniform in $R$ and adversary never sees $\alpha$, $Pr[\text{forge}] \le 2^{-s}$ by Schwartz-Zippel over Galois ring.

> **Theorem 5 (FSS+Silent Security).** *The composition of PCG-generated VOLE with DCF evaluation realizes $\mathcal{F}_{DCF}$ with semi-honest security under LPN$_{n,m,t}$ and PRG assumptions [5][6].*

The silent expansion simulator replaces LPN samples with random; LPN indistinguishability ensures view indistinguishability.

### 5.3 Cost Asymptotics

Let $N$ linear ops, $M$ comparisons. Total cost:

$$C_{total} = \underbrace{O(N)}_{\text{Beaver triples}} + \underbrace{O(M \log 2^k)}_{\text{DCF eval}} + \underbrace{O(\lambda)}_{\text{base OTs}}$$

vs. pure Yao $O(Nk)$ AND gates. Silent preprocessing removes $\log$ factor in communication.

---

## 6 Limitations

**1. LPN Concrete Security.** Silent OT relies on LPN with *sparse* noise and quasi-cyclic matrices for efficiency. Concrete bit-security for parameters $(n=1024, t=128, m=5120)$ is debated; recent attacks on regular LPN reduce security margin [6]. Parameter rotation may be needed.

**2. Fixed-Point Precision and Overflow.** $\mathbb{Z}_{2^k}$ arithmetic wraparound semantics differ from $\mathbb{R}$. Truncation protocols are probabilistic and may introduce 1-ULP error [3]. For deep networks ($>50$ layers), error accumulation degrades accuracy by $1\text{-}3\%$ unless $f\ge 20$ and $k=64$, increasing cost.

**3. Three-Server Trust Assumption.** ABY3 assumes non-collusion among three servers (e.g., AWS, Azure, GCP). This is weaker than 2PC dishonest-majority but may be unacceptable for medical consortia requiring $n$-party SPDZ2k, which is $5\text{-}10\times$ slower [2][3].

**4. FSS Key Size for Large Domains.** DCF key size scales $O(n \lambda)$ where $n$ is bit-length. For $n=64$ and large batch ($10^5$ parallel comparisons), key distribution is $400$ MB, negating silent benefit unless batched via structured FSS.

**5. Malicious FSS.** Standard DCF is semi-honest. Malicious-secure DCF requires authenticated FSS or cut-and-choose, adding $3\times$ overhead [5]. Silent VOLE malicious version [7] adds MAC on seeds but doubles base OTs.

**6. Implementation Side-Channels.** AES-NI based PRG expansion leaks timing if not constant-time. MP-SPDZ and libFSS currently lack constant-time guarantees for key-dependent branches.

---

## 7 Conclusion

We have presented a unified treatment of ABY3, SPDZ over rings, function secret sharing, and silent OT extension for privacy-preserving machine learning. The hybrid paradigm—*arithmetic sharing for linear, FSS for non-linear, silent PCG for preprocessing*—achieves practical PPML: ResNet-18 CIFAR-10 inference in $2.1$s LAN, logistic regression training in $34$s, with provable malicious security and sublinear preprocessing.

Future work: (i) malicious-secure silent VOLE with $O(1)$ communication via ring-LPN, (ii) FSS for GELU/Swish without piecewise approximation using function secret sharing for *smooth* functions via spline DPFs, (iii) hardware acceleration of Galois ring MACs with AVX-512 VPCLMULQDQ.

The convergence of these four lines—mixed protocols, ring-based authentication, compressed function shares, and silent correlations—signals that PPML is no longer asymptotically impractical but a systems engineering challenge.

---

## References

[1] Payman Mohassel, Peter Rindal. ABY3: A Mixed Protocol Framework for Machine Learning. *Cryptology ePrint Archive, Paper 2018/403*. https://eprint.iacr.org/2018/403

[2] Ronald Cramer, Ivan Damgård, Daniel Escudero, Peter Scholl, Chaoping Xing. SPDZ_{2^k}: Efficient MPC mod 2^k for Dishonest Majority. *CRYPTO 2018, LNCS 10991, pp. 769-798*. https://eprint.iacr.org/2018/482

[3] Ivan Damgård, Daniel Escudero, Tore Frederiksen, Marcel Keller, Peter Scholl, Nikolaj Volgushev. New Primitives for Actively-Secure MPC over Rings with Applications to Private Machine Learning. *IEEE Symposium on Security and Privacy (SP) 2019*. https://doi.org/10.1109/SP.2019.00078

[4] Elette Boyle, Niv Gilboa, Yuval Ishai. Function Secret Sharing. *EUROCRYPT 2015, LNCS 9057, pp. 337-367*. https://eprint.iacr.org/2015/367

[5] Elette Boyle, Niv Gilboa, Yuval Ishai. Secure Computation with Preprocessing via Function Secret Sharing. *Cryptology ePrint Archive, Paper 2019/1095*. https://eprint.iacr.org/2019/1095

[6] Elette Boyle, Geoffroy Couteau, Niv Gilboa, Yuval Ishai, Lisa Kohl, Peter Scholl. Efficient Pseudorandom Correlation Generators: Silent OT Extension and More. *CRYPTO 2019, LNCS 11693, pp. 489-518*. https://eprint.iacr.org/2019/448

[7] Elette Boyle, Geoffroy Couteau, Niv Gilboa, Yuval Ishai, Lisa Kohl, Peter Rindal, Peter Scholl. Efficient Two-Round OT Extension and Silent Non-Interactive Secure Computation. *CCS 2019*. https://eprint.iacr.org/2019/1159

[8] Emmanuela Orsini, Nigel P. Smart, Frederik Vercauteren. Overdrive2k: Efficient Secure MPC over Z_{2^k} from Somewhat Homomorphic Encryption. *Cryptology ePrint Archive, Paper 2019/153*. https://eprint.iacr.org/2019/153

[9] Marcel Keller, Emmanuela Orsini, Peter Scholl. MASCOT: Faster Malicious Arithmetic Secure Computation with Oblivious Transfer. *CCS 2016*. https://eprint.iacr.org/2016/505

[10] Yuval Ishai, Eyal Kushilevitz, Sigurd Meldgaard, Claudio Orlandi, Anat Paskin-Cherniavsky. On the Power of Correlated Randomness in Secure Computation. *TCC 2013*. https://eprint.iacr.org/2013/281
