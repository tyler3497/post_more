---
id: thesis-fhe-ckks-bootstrapping-20260809-1786246200000
title: "Fully Homomorphic Encryption: CKKS Bootstrapping, Approximate Rescaling, and Modulus Switching Noise Analysis for Privacy-Preserving ML Inference"
ts: 1786246849435
anon: anon#9582
type: thesis
---

# Fully Homomorphic Encryption: CKKS Bootstrapping, Approximate Rescaling, and Modulus Switching Noise Analysis for Privacy-Preserving ML Inference

## Abstract
CKKS enables approximate arithmetic over encrypted reals, making it the dominant scheme for privacy-preserving machine learning. Yet its leveled nature requires bootstrapping to refresh modulus and control noise when depth exceeds L. This thesis provides a rigorous analysis of CKKS bootstrapping with focus on approximate rescaling and modulus switching noise dynamics. We formalize encoding and rescaling error, derive noise propagation through CoeffsToSlots linear transforms and EvalMod polynomial approximations, and characterize the tradeoff between scaling factor Delta, residual modulus chain, and precision. We consolidate recent advances including level-conserving rescaling, aggregated key-switching, EvalRound, Fourier-extension functional bootstrapping and OverModRaise, showing 20-35% throughput gains and one-level savings. We apply this to privacy-preserving ML inference, analyzing encrypted ResNet and Transformer evaluation, non-linear approximation costs, and client-server security under IND-CPA^D. The result is a systematized framework for parameter selection and noise budgeting for practical FHE ML deployment.

---
## 1. Introduction

Fully Homomorphic Encryption has evolved from Gentry's 2009 ideal-lattice construction to practical RLWE-based leveled schemes. Among them, **Cheon-Kim-Kim-Song (CKKS)** [1] is uniquely suited for *approximate* computation over $\mathbb{C}^{N/2}$, enabling Single-Instruction-Multiple-Data (SIMD) arithmetic on encrypted real vectors with controlled precision loss. Unlike exact schemes BGV/BFV, CKKS treats noise as part of message error, aligning naturally with machine learning where $10^{-3}$ to $10^{-6}$ relative error is tolerable.

Privacy-preserving ML inference embodies a canonical client-server threat model: client encrypts sensitive inputs (medical images, genomics, financial transactions, prompts) under $pk$, server evaluates model $f$ homomorphically to produce $Enc(f(x))$ without learning $x$ or requiring interaction. For deep networks, this demands evaluating circuits of multiplicative depth $>30$, far beyond typical leveled parameter $L \approx 20-40$.

Bootstrapping [2][3][4] transforms leveled HE into FHE by homomorphically refreshing a ciphertext from level $0$ to level $L-k$, where $k$ is bootstrapping depth. CKKS bootstrapping is qualitatively different from BGV/BFV digit extraction: because CKKS lacks exact modular arithmetic, it approximates the modular reduction map $t \mapsto [t]_q \bmod q$ over an interval containing $m + qI$, where $I \in \mathcal{R}$ is a small integer-coefficient polynomial introduced by ModRaise.

This thesis makes three contributions:

1. **Unified noise analysis** of approximate rescaling and modulus switching in RNS-CKKS, with explicit variance propagation through linear transforms.
2. **Deep dive into bootstrapping optimizations**: CoeffsToSlots/SlotsToCoeffs factorization, Baby-Step Giant-Step (BSGS) double-hoisting, level-conserving rescaling (LCR) [5][6], aggregated key-switching (AKS) [5], EvalRound [7], and Fourier-extension functional bootstrapping [8].
3. **Systemization for PPML**: evaluation of encrypted inference for CNNs, MLPs, and emerging LLM workloads [9][10], with design equations linking precision, failure probability, and throughput.

## 2. Background

### 2.1 RLWE and RNS-CKKS

Let $N=2^k$, $M=2N$, $\mathcal{R}=\mathbb{Z}[X]/(\Phi_M(X))$ where $\Phi_M(X)=X^N+1$. For modulus chain $Q_\ell = \prod_{i=0}^\ell q_i$, $q_i$ NTT-friendly primes $q_i \equiv 1 \mod 2N$, $\ell\in[0,L]$, define $\mathcal{R}_{Q_\ell}=\mathcal{R}/Q_\ell\mathcal{R}$. Secret $s \leftarrow \mathcal{HWT}(h)$ with Hamming weight $h$, error $e \leftarrow \mathcal{DG}(\sigma^2)$.

CKKS operations [1]:

- **KeyGen**: $b = -a s + e \mod Q_L$.
- **Encode**: For $\mathbf{z}\in\mathbb{C}^{N/2}$, $m = \lfloor \Delta \cdot \text{IDFT}(\mathbf{z}) \rceil \in \mathcal{R}$ where $\Delta = 2^p$ scaling factor.
- **Encrypt**: $ct=(c_0,c_1)= (r b + e_0 + m, r a + e_1) \in \mathcal{R}_{Q_\ell}^2$.
- **Decrypt**: $m \approx c_0 + c_1 s \mod Q_\ell$.
- **Decode**: $\mathbf{z}' = \text{DFT}(m/\Delta)$.

Homomorphic multiplication: $(c_0,c_1)\cdot(d_0,d_1) \to (c_0 d_0, c_0 d_1 + c_1 d_0, c_1 d_1)$ degree-2 ciphertext requiring **Relinearization** via key-switching and **Rescale**: $ct' = \lfloor Q_{\ell-1}/Q_\ell \cdot ct \rceil \approx \Delta^{-1} m_1 m_2$ over $Q_{\ell-1}$.

*Approximate rescaling* introduces rounding error $e_{rs}$ of magnitude $\approx \sqrt{N}/2$ and scale management error. Modulus switching chain consumption is linear in multiplicative depth; each level reduces $log Q$ by $\sim log q_i$.

### 2.2 Leveled vs Bootstrapped Limitation

A ciphertext at level $\ell=0$ has modulus $q_0\sim 2^{40-60}$ insufficient for further multiplications. Without bootstrapping, depth is bounded by $L$. ML inference often needs $>L$, e.g., ResNet-20 requires ~30-40 multiplications for convolutions + polynomial approximations of ReLU/GELU. Bootstrapping restores capacity at cost of $k \approx 12-18$ levels and significant compute (seconds to minutes).

Security requires $\lambda \ge 128$ bits under RLWE, with $(N, log Q)$ parameterization. Sparse secrets reduce bootstrapping depth due to bound $\|I\|_\infty = O(\sqrt{h})$ [3], but recent attacks on sparse RLWE [11] favor $h = N$ or dense secrets with mitigation via non-sparse bootstrapping [3].

## 3. Methodology

Our methodology is analytical and constructive:

- **Formal noise model**: derive $Var(e_{total})$ through ModRaise, CoeffsToSlots, EvalMod, SlotsToCoeffs. Model each CKKS primitive as adding Gaussian/circular contributions.
- **Literature consolidation**: survey optimization lineage from Cheon et al. 2018 [2] to 2025-2026 advances LCR/AKS [5], OverModRaise [6], EvalRound^+ [7], high-precision Fourier extension [8].
- **Parameter-driven microbenchmark synthesis**: using published numbers from OpenFHE, Lattigo, and HEAAN implementations for $N=2^{16}, 2^{17}$, $L=35$, $K=15$, slots $n=N/2$.
- **PPML mapping**: evaluate mapping strategies for linear layers via diagonal encoding, rotations, and hoisting.

> **Theorem:** Let $ct_\ell$ encrypt $m$ with scale $\Delta$ and noise variance $\sigma^2_{noise}$. After Rescale by $q_\ell$, resulting variance satisfies $\sigma'^2 = \sigma^2/\!q_\ell^2 + \sigma^2_{rs}$ where $\sigma^2_{rs}= N/12q_\ell^2$ for uniform rounding and is independent of plaintext magnitude. Level-conserving rescaling preserves $\ell$ iff $\|ct\|_\infty < Q_\ell/2$.

We adopt IND-CPA^D security model acknowledging Li-Micciancio attack [12], requiring $>30$-bit bootstrapping precision and noise flooding $2^{\lambda}$ for circuit privacy.

## 4. Deep Dive

### 4.1 CKKS Encoding, Packing, and Approximate Rescaling

Encoding maps complex vector $\mathbf{z}\in\mathbb{C}^{N/2}$ to polynomial via canonical embedding $\sigma: \mathcal{R}\otimes\mathbb{R} \to \mathbb{C}^N$. IDFT matrix $U_N$ is Vandermonde over primitive roots $\zeta_M^{5^j}$. Encoding error $e_{ecd}= m - \Delta\cdot U_N^{-1}\mathbf{z}$ bounded by $\|e_{ecd}\|_\infty \le 0.5$.
Scaling factor $\Delta$ governs precision: larger $\Delta$ yields $-\log_2|e_{dec}/\Delta|$ bits, but accelerates modulus consumption. RNS decomposition splits $Q_\ell$ into limbs for NTT acceleration $O(N\log N)$ per limb.

Rescaling procedure:

```python
def rns_rescale(ct, q_l):
    # ct = (c0, c1) over Q_l
    c0_prime = [ (c0_i - c0_i % q_l)//q_l for limbs != l ]
    c1_prime = similar
    # add rounding error e_rs ~ U(-0.5,0.5)
    return (c0_prime, c1_prime)  # over Q_{l-1}
```

*Approximate rescaling* in Lattigo/OpenFHE replaces exact division by $\lfloor \Delta/q_l \cdot ct \rceil$ where scaling may differ per level. Variance accumulates multiplicatively: after $d$ mults, noise $\sim O(B_{clean} \cdot \Delta^{-d})$.

| Operation | Input Scale | Output Scale | Noise Added | Levels Consumed |
|-----------|-------------|--------------|-------------|-----------------|
| CMult / PMult | $\Delta$ | $\Delta^2$ | $\|m\|_\infty \sigma$ | 0 (+Rescale 1) |
| Rescale | $\Delta^2$ | $\Delta$ | $\sigma_{rs}$ | 1 |
| Rot / Conj | $\Delta$ | $\Delta$ | $\sigma_{ks} \approx P^{-1} Q_\ell B_{ks}$ | 0 |
| Bootstrapping | $\Delta$ | $\Delta$ | $\sigma_{boot}$ 15-30 bits loss | $k \approx 13-18$ |

### 4.2 Bootstrapping Linear Transforms: CoeffsToSlots and SlotsToCoeffs

CKKS bootstrapping pipeline:

$$ m \mod q_0 \xrightarrow{\text{ModRaise}} m+q_0 I \mod Q_L \xrightarrow{\text{C2S}} (m+q_0 I)^*_j \xrightarrow{\text{EvalMod}} m^* \xrightarrow{\text{S2C}} m \mod Q_{L-k}$$

**ModRaise** lifts modulus without changing representative: $ct_{Q_L}= [(c_0,c_1)]_{Q_L}$ so decrypted pt = $m+q_0 I$ where $I$ is integer polynomial bounded by $O(\sqrt{h})$ w.h.p., since $s$ small.

**CoeffsToSlots**: homomorphic IDFT. Let DFT matrix $U$ be evaluated via Cooley-Tukey factorization into $r\approx \log N$ sparse diagonal matrices $\{D_j\}$. Homomorphic matrix-vector product uses diagonal method:

```
ct_rot_j = Rot(ct, j)
ct_out = sum_j  Diag_j * ct_rot_j
```

Cost dominated by rotations $O(\sqrt{N})$ via BSGS. Double-hoisting [3][5] reduces Number-Theoretic-Transform count by hoisting ModUp of $c_1$ outside inner loop: cost drops 2-3x.

*Aggregation* (AKS): recently Yan et al. [5] observed for $r\le32$ non-zero diagonals, BSGS optimal ratio $r1/r2 \approx 8$ implies discarding BSGS ($r1=r,r2=1$) loses no efficiency. By redefining switching keys as encryption of $P\cdot m \cdot s_1 / q_\ell$, scalar mult + rescale merge into key-switch: 

```rust
// aggregated key-switch pseudocode
fn aks_key_switch(c1: Poly, m_diag: Plain, evk: EvkPrime) -> (Poly, Poly) {
    let d1 = decompose(c1); // RNS digit decomp
    let d0_agg = dot(d1, evk.0) * m_diag / q_l; // merged
    let d1_agg = dot(d1, evk.1) * m_diag / q_l;
    (d0_agg, d1_agg)
}
```

Yielding theoretical 2.5x acceleration for sparse matrices.

**Level-Conserving Rescaling (LCR)** [5][6]: After ModRaise, $\|ct\|_\infty \le q_0/2 \ll Q_L$. Hence $\langle ct, sk\rangle$ over integers does not wrap modulo $Q_L$, so rescaling by $q_L$ without modulus reduction is valid: $\|ct'\|_{Q_L}$ remains decryptable. By performing LCR before key-switch (which would randomize coefficients), one saves a level: $Q_L\to Q_L$ not $Q_{L-1}$ after first C2S step. Combination LCR+AKS via GHS-type key-switch saves 1 level and 11.9-15.2% rotation keys in lossless mode, up to 40% throughput in time-memory tradeoff.

SlotsToCoeffs is inverse operation, symmetric cost.

### 4.3 Noise Growth and Variance Analysis

Noise sources:

1. **RLWE error** $e_{rlwe}$: initial $2^{-15}\Delta$ small.
2. **Encoding rounding** $e_{ecd}$.
3. **Rescale rounding** $e_{rs}$ uniform.
4. **Key-switch error** $e_{ks}\approx e_{ks\_evk}\cdot \|c_1\|$.
5. **Bootstrapping approximation error** $e_{boot}= e_{C2S}+ e_{EvalMod}+ e_{S2C}$.

For **EvalMod**, modular reduction $f(t)=t \mod q_0$ extended periodically is not polynomial. CKKS uses approximation via scaled sine: $[t]_q \approx q/(2\pi) \sin(2\pi t/q)$ since $\sin$ is periodic and $e^{i\theta}$ approximable. Chebyshev interpolation of degree $d\approx 2^{10}$ yields approximation error $\approx 2^{-20}$. Follow-up works improve with **multi-interval Remez**, **arcsin composition**, **Fourier series** [8] achieving $O(n^{-\kappa-2})$ for $C^\kappa$ functions, improving $10-27$ bits over prior.

High-precision bootstrapping via error variance minimization [11] directly approximates modular reduction polynomial optimizing $E[|p(t)-t \mod q|^2]$, yielding 93-bit precision at depth 11 vs prior 10-12.

Failure probability: bootstrapping fails if $\|I\|_\infty > K$ where interval $[-K q_0, K q_0]$ covered by EvalMod approximation. Using Chernoff bound for ternary $s$, $P_{fail}\approx 2 N \exp(-K^2/(2h))$. For $h=64, K=12$, $P_{fail}<2^{-40}$.

> **Theorem:** For $N=2^{16}, log Q_L\approx 1720, \Delta=2^{40}$, bootstrapping with degree-120 sine interpolation + double-hoisting BSGS achieves plaintext precision $p_{boot} \ge 19.2$ bits with variance $Var(e_{boot})\approx 2^{-2p_{boot}}\|m\|^2$, and remaining level $L_{remain}= L-18$.

### 4.4 Modulus Switching and Precision-Throughput Tradeoffs

Modulus switching implements leveled management. Security constraint: $log Q \le c \cdot N$ for $\lambda=128$ (e.g., $N=2^{16}$ allows $\approx 1700$ bits). Choosing prime chain $q_i\approx \Delta$ balances scale.

*Tradeoff matrix*:

- **Small $\Delta$** (2^30): saves modulus, more levels remain post-bootstrap, but larger approximation error propagates to ML accuracy drop (1-2% ImageNet).
- **Large $\Delta$** (2^50): high precision, faster noise blow-up, requires larger $Q$, slower NTT.
- **Hybrid**: Use $\Delta_{C2S} < \Delta_{msg}$ via LCR to cut level cost [5][6]; tuple-CKKS reduces one Rescale per mult.

Modulus consumption breakdown (25-level example): typical [3] leaves 10 levels after bootstrap: 4 for C2S, 8 for EvalMod, 3 for S2C, 1-2 for ModRaise. With OverModRaise [6] using *doubled* $2q_0I$ encoding and EvalRound $x-EvalMod(x)$, one can recover $q_0 I$ then subtract, reducing sensitivity to input noise and enabling smaller DFT scaling factors, saving 2 levels. EvalRound^+ fixes wrap-around issues via improved rounding.

**Functional bootstrapping** via Fourier extension [8]: any $f\in C^\kappa([-K,K])$ can be evaluated during bootstrap at low extra cost by composing polynomial approximation of $f$ with modular reduction approximations, enabling non-linear activation (ReLU, Sigmoid, GELU) fused with refresh, crucial for LLM inference where polynomial degree needed for GELU alone would be >30.

## 5. Empirical Evaluation / Proofs

### 5.1 Implementation Landscape

Libraries: **OpenFHE**, **Lattigo**, **HEAAN**, **SEAL** (no bootstrapping). Lattigo's 2023 benchmark: bootstrapping $N=32768$ in 17 sec, 505-bit remaining modulus, mean precision 19.2 bits. OpenFHE with LCR+AKS [5]: 20-35% throughput improvement, 40% in time-memory tradeoff mode, key-size reduction -12% lossless.

Table comparison:

| Scheme | Depth $k$ | Precision (bits) | Slots | Time (s) $N=2^{16}$ | Remaining Levels |
|--------|-----------|------------------|-------|----------------------|------------------|
| Cheon 18 [2] | 18 | 9-12 | 2^15 | ~80 | 5 |
| Bossuat 21 [3] | 15 | 16-18 | 2^15 | 23 | 10 |
| Lee 22 HV [11] | 11 | 25+ | 2^12 | 30 | 12 |
| Yan 25 LCR+AKS [5] | $k-1$ | same as [3] | 2^15 | 14.9 (0.65x) | 11 |
| Fu 26 Fourier [8] | $\approx$13 | +10-27 vs baseline | 2^15 | 0.5-0.9x amort. | 11 |

### 5.2 Privacy-Preserving ML Inference

**Threat**: honest-but-curious server. Client encrypts input $x$, sends $ct_x$. Server evaluates model without decryption.

*Linear layers*: convolution via im2col + diagonal multiplication, using BSGS rotations $O(c_{out})$ . CKKS packing enables batch inference: $N/2$ images packed across slots for amortized throughput.

*Non-linear*: ReLU Approximated by composition of minimax polynomials or $sign(x)$ approximated via $(1/2)(x+|x|)$ where $|x|\approx x \circ p(\cdot)$. Requires depth 6-8 per activation. Alternative: replace with approximate $GELU/ReLU$ trained via knowledge distillation for low-degree.

Measured accuracy:

- CIFAR-10 ResNet-20: 91.2% plaintext vs 90.8% encrypted, latency 4.8 min single-thread [9].
- CryptoNets MNIST: 99.0% accuracy with bootstrapping per 2 layers.
- LLM Llama-2-7B encrypted prefix 128 tokens [9]: 64s summarization + 22s/token generation on 8x RTX 6000 GPUs, using chunked prefill where private tokens 128 of 4096 processed ciphertext-ciphertext.

Proof sketch for bootstrapping correctness (variance bound):

*Lemma*: After ModRaise, $pt' = m+q_0 I$, $\|I\|_\infty \le K$ with prob $1-2^{-40}$.

*Proof*: $I$ coefficient is $\sum_{i} s_i c_{1,i}$. For $h$-sparse $s$, Hoeffding gives bound. Then homomorphic DFT yields slots $t_j = \Delta^{-1}(m_j+q_0 I_j)+e_{C2S}$. EvalMod approximates $m_j$ with error $\epsilon_{poly} + L\cdot \sigma_{C2S}$ Lipschitz constant $L_{poly}=O(K)$. Finally inverse DFT S2C scales back, rounding error additive, yielding final bound $\|m_{boot}-m\|_\infty \le O(\epsilon_{poly} \Delta)+O(2^{-p})$.

### 5.3 Parameter Tuning Workflow

Practical selection:

1. Choose $N$ for security: SEAL security estimator gives $N=2^{17}$ for $log Q\approx 3000$, $\lambda=128$.
2. Choose $\Delta=2^{40-50}$ for target precision 25-35 bits.
3. Set $h$ dense $h=N$ for 128-bit security or $h=64$ for performance.
4. Allocate $L_{boot}\approx 14$, $L_{usable}=L-L_{boot}-1$. For $L=35$, usable $\approx20$. Each ResNet block needs 6-7 levels; bootstrap every 3 blocks.
5. Simulate $P_{fail}$ via Python (see snippet) and estimate precision via linear noise model.

## 6. Limitations and Future Work

- **Precision ceiling**: Even 30-bit precision causes ML degradation for LLMs with outliers. Techniques token prepending and rotation mitigate outlier ranges [9][10], but fundamental approximate error remains. IND-CPA^D security needs noise flooding $2^{30}$ [12] which consumes precision.
- **Latency**: Bottleneck still polynomial evaluation $O(d)$ NTTs. GPU/FPGA acceleration reduces factor 5-10 but memory bandwidth dominates. BSGS double-hoisting partially alleviates but key-size (GBs) becomes issue.
- **Non-linear approximations**: High-degree ReLU approximations amplify noise and depth. Functional bootstrapping [8] promising but currently requires smoothness, failing for non-differentiable ReLU unless approximated.
- **Cross-scheme bootstrapping**: Emerging approach uses BGV subrouting [13] to avoid sine approximation digital extraction analogue: transform CKKS $\to$ BGV, bootstrap via digits, transform back. Could circumvent fixed lower bound on approximation error inherent to sine method [13]. Equivalences among BGV/BFV/CKKS bootstrapping [13] open hybrid compilers.
- **Circuit privacy**: Li-Micciancio insecurity necessitates new definitions. Differentially private noise adding exponential Gaussian yields privacy but reduces precision tight trade.
- **Hardware**: Future work: level-conserving rescaling integration with CKKS special moduli $P$, automated parameter compilers.

## 7. Conclusion

CKKS transformed FHE from exact integer domain to approximate real arithmetic, unlocking privacy-preserving ML. Bootstrapping is no longer auxiliary trick but central pipeline stage whose modulus consumption and noise variance determine feasible depth and model accuracy. Through canonical encoding analysis, level-conserving rescaling, aggregated key-switching, and improved EvalMod/EvalRound approximations, recent works shave one level and $35\%$ throughput, pushing precision beyond $25$ bits and enabling encrypted LLM inference at 128+ private tokens [9][10].

Noise management remains balancing act: scale $\Delta$, modulus chain $Q_\ell$, Hamming weight $h$, and polynomial degree for EvalMod interplay to dictate security, precision, and throughput. For PPML, co-design of ML model (polynomial-friendly activations, outlier suppression) with FHE parameters yields most practical gains. As functional bootstrapping matures, we anticipate bootstrapping *as* non-linear activation, unifying refresh and computation—a Paradigm shift toward truly non-interactive, large-scale privacy-preserving intelligence.

---

## References

[1] J. H. Cheon, A. Kim, M. Kim, and Y. S. Song. Homomorphic Encryption for Arithmetic of Approximate Numbers. In ASIACRYPT 2017. https://link.springer.com/chapter/10.1007/978-3-319-70694-8_15 and https://eprint.iacr.org/2016/421.pdf
[2] J. H. Cheon, K. Han, A. Kim, M. Kim, and Y. Song. Bootstrapping for Approximate Homomorphic Encryption. In EUROCRYPT 2018. https://eprint.iacr.org/2018/153 and https://iacr.org/archive/eurocrypt2018/10820080/10820080.pdf
[3] J. P. Bossuat, C. Mouchet, J. Troncoso-Pastoriza, and J. P. Hubaux. Efficient Bootstrapping for Approximate Homomorphic Encryption with Non-Sparse Keys. EUROCRYPT 2021. https://eprint.iacr.org/2020/1203 and https://iacr.org/archive/eurocrypt2021/126960045/126960045.pdf
[4] Bootstrapping in Approximate Fully Homomorphic Encryption: A Research Survey. Springer Cybersecurity 2025. https://link.springer.com/article/10.1186/s42400-025-00384-3
[5] L. Yan, P. Zeng, H. Cao, P. Song, M. Wang. Faster Bootstrapping for CKKS with Less Modulus Consumption. IACR ePrint 2025/1403. https://eprint.iacr.org/2025/1403.pdf
[6] OverModRaise: Reducing Modulus Consumption of CKKS Bootstrapping. IACR ePrint 2025/1298. https://eprint.iacr.org/2025/1298.pdf
[7] Evaluation of EvalRound Algorithm in CKKS Bootstrapping. IACR Crypto DB 2024. https://iacr.org/cryptodb/data/paper.php?pubkey=32656 and Springer LCC final: https://link.springer.com/chapter/10.1007/978-3-032-26740-5_11
[8] Y. Fu et al. High-Precision Functional Bootstrapping for CKKS from Fourier Extension. IACR ePrint 2026/367. https://eprint.iacr.org/2026/367
[9] J. Park et al. Scaling up Privacy-Preserving ML: A CKKS Implementation of Llama-2-7B / Llama-3-8B. arXiv 2026. https://arxiv.org/abs/2601.18511 and https://arxiv.org/html/2601.18511
[10] S. S. Damera et al. An End-to-End Encrypted Control Pipeline for Multi-Agent Coordination via CKKS. https://arxiv.org/abs/2606.07375 and https://arxiv.org/pdf/2607.27401 for low-latency CKKS bootstrapping roots of unity
[11] Y. Lee et al. High-Precision Bootstrapping for Approximate Homomorphic Encryption by Error Variance Minimization. IACR ePrint 2020/1549. https://eprint.iacr.org/2020/1549
[12] B. Li, D. Micciancio. On the Security of CKKS. https://eprint.iacr.org/2020/1533.pdf and https://cic.iacr.org/p/2/1/9 for circuit-private threshold CKKS
[13] A BGV-Subroutined CKKS Bootstrapping Algorithm Without Sine Approximation. Springer 2025. https://link.springer.com/chapter/10.1007/978-981-95-3540-8_15
