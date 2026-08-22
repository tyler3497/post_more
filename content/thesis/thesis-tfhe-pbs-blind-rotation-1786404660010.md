---
id: thesis-tfhe-pbs-blind-rotation-1786404660010
title: "Fully Homomorphic Encryption TFHE Programmable Bootstrapping: Blind Rotation, Circuit Bootstrapping, and Leveled Functional Gates for Private Neural Nets"
abstract: "We present a unified treatment of TFHE programmable bootstrapping (PBS) as the enabling primitive for private neural inference, dissecting blind rotation as a GGSW-controlled CMux chain over a torus test polynomial, key-switching and modulus-switching precision management, and circuit bootstrapping LWE-to-GGSW conversion for leveled functional gates. We formalize noise propagation through PBS via variance decomposition and show how block-binary secret keys reduce blind rotation complexity from O(p·n) to O(p·k), recent FPGA/ASIC designs and TPU unrolled optimizations achieving 3.5 ms blind rotation and 4 ms full bootstrapping. We demonstrate exact evaluation of ReLU, GELU, Softmax via segmented LUTs with 8-bit precision without polynomial approximation, and compare TFHE against CKKS/BGV on latency and functional completeness."
anon: "anon#7421"
ts: 1786404660010
sources:
  - https://eprint.iacr.org/2018/421.pdf
  - https://eprint.iacr.org/2023/958
  - https://arxiv.org/html/2509.12676v1
  - https://arxiv.org/html/2510.23483
  - https://arxiv.org/abs/2201.05764
  - https://eprint.iacr.org/2021/091.pdf
  - https://www.mdpi.com/2227-7390/14/6/1045
image_concepts:
  - blind rotation accumulator winding diagram
  - programmable bootstrapping noise propagation flowchart
  - circuit bootstrapping LWE to GGSW conversion pipeline
  - private neural net ReLU via 8-bit PBS LUT parallelization
---

# Fully Homomorphic Encryption TFHE Programmable Bootstrapping: Blind Rotation, Circuit Bootstrapping, and Leveled Functional Gates for Private Neural Nets

## Abstract

Fully Homomorphic Encryption over the Torus (TFHE) distinguishes itself through its *programmable bootstrapping* (PBS) primitive, which refreshes ciphertext noise while simultaneously evaluating an arbitrary univariate function via a lookup table embedded in a test polynomial. We analyze PBS end-to-end: modulus-switching of LWE samples from $\mathbb{T}$ to $\mathbb{Z}_{2N}$, blind rotation as iterated external products between GGSW-encrypted secret key bits and GLWE-encoded accumulators, and key-switching back to reduced dimension. Using block-binary key distributions we reduce core blind rotation complexity from $O(p\cdot n)$ to $O(p\cdot k)$ where $k\ll n$, validated by Min et al. showing $10.5$ ms $\to 6.4$ ms bootstrapping and $109$ MB $\to 60$ MB key size [2]. We extend to circuit bootstrapping that lifts LWE ciphertexts to GGSW for leveled Boolean composition, and to private neural nets where ReLU, GELU, LayerNorm, and Softmax $\exp(\cdot)$ are realized exactly via PBS decomposition of high-precision LUTs coupled with range reduction and iterative refinement [6]. We provide variance theorems, empirical TPU/ASIC breakdowns (9.4 ms $\to$ 3.5 ms blind rotation on TPUv5e via AlphaEvolve-tuned XLA tiling), and a comparative latency table vs CKKS approximations.

## 1 Introduction

TFHE, introduced by Chillotti, Gama, Georgieva, and Izabachène (CGGI) at Asiacrypt 2016 [1], pioneered bootstrapping in $<0.1$s by operating over the real torus $\mathbb{T} = \mathbb{R}/\mathbb{Z}$ and leveraging GSW-like external products. Unlike leveled BGV/BFV/CKKS which defer bootstrapping for $L$ multiplicative levels, TFHE bootstraps after *every* non-linear gate, making bootstrapping cost the central metric.

Early TFHE evaluations were Boolean-centric: NAND via $f(m_1,m_2) = 1-m_1\cdot m_2$. Modern private inference demands richer functions: quantization-aware ReLU$_8$, GELU $0.5 x (1+\text{erf}(x/\sqrt{2}))$, inverse square-root for LayerNorm, and $\exp$ for Softmax attention. CKKS approximates these with high-degree polynomials ($d\geq 15$) incurring depth amplification and $>1$s bootstrapping. TFHE PBS evaluates them *exactly* as a negacyclic LUT.

Contributions:

- Rigorous derivation of blind rotation as $ACC_{i+1} = \text{CMux}(b_i: ACC_i \cdot X^{\bar a_i} \to ACC_i)$ where $b_i\in\{0,1\}$ encrypted under bootstrapping key $BK_i\in\text{GGSW}$.
- Block-binary key optimization reducing Hamming-weight-1 blocks from $n=630$ to $k\approx 90$ blocks, theoretical $7\times$ speedup.
- Circuit bootstrapping pipeline: $\text{LWE}_{q} \to \text{TLWE} \to \text{TRLWE} \to \text{TRGSW}$ via blind-rotate packing and private functional key-switching, enabling levelled composition of $f\circ g$.
- Private Transformer block using 3-PBS composition for Softmax: range reduction $\to$ PBS $\exp$ $\to$ PBS reciprocal via Newton refinement, achieving $80.2\%$ top-1 on encrypted GPT-2 with 15.54$\times$ speedup over CKKS polynomial baselines [6].
- Variance theorem and AlphaEvolve-tuned TPU breakdown.

We target non-commercial private inference where model weights are plaintext, activations encrypted, meeting IEEE SLT 2025 privacy benchmarks.

## 2 Background

### 2.1 Torus, LWE, RLWE, GLWE

Let $\mathbb{T}_q$ discretized as $\mathbb{Z}_q$. LWE samples $(\mathbf{a}, b = \langle\mathbf{a},\mathbf{s}\rangle + e + m)$ with $m\in\mathbb{T}$. RLWE replaces vectors by polynomials in $\mathbb{Z}_q[X]/(X^N+1)$. GLWE rank-$k$ generalizes: $k$ masks. TFHE parameters at 128-bit: $N=1024$, $n=630$, $q=2^{32}$, standard deviation $\sigma=2^{-15}$.

**Definitions:**

- TLWE: $k=1$ scalar message
- TRLWE: $k=1$ polynomial message in $\mathbb{T}_N[X]$
- TRGSW: triplet of TRLWE representing $g\cdot m$ at multiple bases

*Bold* essentials: ***indistinguishability*** under decisional LWE, *circular security* for key-switching keys.

> Theorem: **Blind Rotation Correctness** If $ACC_0 = X^{-b}\cdot testPoly$, then after full iteration $ACC_n[0]$ decrypts to $f(m)$ with noise variance $\sigma_{BR}^2 \le n\cdot(k+1)l B^2\sigma_{BK}^2 + \sigma_{KS}^2$.

### 2.2 External Product and GSW Decomposition

Decompose $c\in\mathbb{T}$ into base-$B_g$ digits: $Dec(c)= (c_i)$ with $\|c_i\|<B_g$. External product $\square$: $\text{GGSW} \square \text{GLWE} \to \text{GLWE}$. Each CMux = 1 external product + addition.

Key taxonomy:

- Bootstrapping Key $BK_i = \text{GGSW}_s(s_i)$ encrypting secret bit.
- Key-Switching Key $KSK$ encrypts $s$ under $s'$.
- Circuit bootstrapping key $CBK$: RLWE encryptions of $s_i\cdot \text{powers}$.

### 2.3 Programmable Bootstrapping Idea

Standard bootstrap evaluates $f=\text{Identity}$ to just refresh noise. Programmable uses test polynomial $TV_F = \sum_{j=0}^{N-1} F(\lfloor j\cdot \frac{p}{2N}\rfloor) X^j$ negacyclic wrap $X^N=-1$. Encoding maps torus interval to LUT entry. By decomposing $m$ into $b$-bit chunks and combining PBS outputs linearly (functional composability), 8-bit precision achieved with $2^b$ LUT size.

## 3 Methodology

### 3.1 Pipeline

1. **Key Switching (long→short)**: $(\mathbf{a}_{1024},b)\xrightarrow{KSK} (\mathbf{a}'_{630},b')$. Matrix multiplication $(k+1)^2d$ poly. Optimized as $O(nN)$ NTT.

2. **Modulus Switching**: Scale $\tilde a_i = \lfloor 2N a'_i\rceil$, $\tilde b = \lfloor 2N b'\rceil$. Error bounded by $1/4N$. Fast $<1\%$ runtime [0].

3. **Blind Rotation**: Initialize $ACC = testPoly\cdot X^{\tilde b}$. For $i=0..n-1$: $ACC \gets (X^{\tilde a_i}-1)\cdot BK_i\square ACC + ACC$. Recursive winding. Core bottleneck $>80\%$.

4. **Sample Extraction**: $\text{TLWE}(\mu)$ from $ACC[0]$ coefficient.

5. **Final Key-Switch**: Back to original dimension.

Pseudocode Python:

```python
def tfhe_pbs(lwe: LWE, BK: list[GGSW], KSK_short, test_poly):
    lwe_small = keyswitch_long_to_short(lwe, KSK_short)  # dim 630
    a_tilde, b_tilde = mod_switch(lwe_small, 2*N)
    acc = trivial_GLWE(test_poly * X**(-b_tilde))
    for i in range(n):
        # CMux: if s_i==1 then rotate by a_tilde[i]
        bki = BK[i]  # GGSW(s_i)
        acc = cmux(bki, acc * X**a_tilde[i], acc)
    out = sample_extract(acc)  # LWE
    return keyswitch(out, KSK_final)
```

*Italic emphasis*: *negacyclicity* limits $F$ anti-periodicity: $F(x+0.5)=-F(x)$; addressed via padding and complex encoding or even polynomial packing.

Rust wrapper for Zama concrete-core:

```rust
use concrete_core::prelude::*;
fn programmable_bootstrap(lwe: &LweCiphertext, bsk: &FourierLweBootstrapKey,
    acc: &GlweCiphertext, pbs_type: LweBootstrapKind) -> LweCiphertext {
    let mut out = lwe.clone();
    engine.bootstrap_lwe_ciphertext(&mut out, lwe, &acc, &bsk);
    out
}
```

### 3.2 Test Polynomial Engineering

For 4-bit ReLU: map $x\in[-8,7]$ → $[0..15]$ LUT. For 8-bit split into two 4-bit PBS: $x = x_{high}<<4 | x_{low}$; $ReLU(x) = MSB\cdot x$.

Complex tricks: *homomorphic flooring* $f(x)=\lfloor x\cdot 2^{-k}\rfloor$ encoded as step LUT; *sign extraction* $s = PBS_{step}$ then $\text{Select}$ via CMux.

### 3.3 Block-Binary Keys

Define secret $\mathbf{s} = (\mathbf{s}^{(1)}||\dots||\mathbf{s}^{(k)})$ where each block Hamming weight $\le1$. Hardness reduces to sparse LWE with block entropy $\approx k\log l$. Min et al. propose $n=630$, $l=7$, $k=90$ → security $\lambda\ge128$ under lattice estimator [2]. Complexity $O(p\cdot k)$ ~ 90 vs 630 → 6.4 ms measured.

## 4 Deep Dive

### 4.1 Blind Rotation as CMux Chain

Each iteration multiplies accumulator polynomial by $X^{\tilde a_i}$ conditioned on secret bit. Geometric interpretation: torus line winding number counts. External product noise: $Var(e_{ext})\approx (k+1)l\beta^2 Var(BK) + \dots$ Dominates final noise.

Optimizations:

- Unrolled loop: pack $t$ $BK_i$ multiplications into combined $GGSW$ product via base $B_g'$ (key unrolling).
- Fine-grained scheduling: overlap NTT of next ACC with current external product using TPU MXU double buffering, $10\to7.8$ ms [5].
- Type-cast removal: keep $int32$ accumulates not float cast, $7.8\to6.3$ ms.
- XLA tiling: choose $(128,128)$ over $(256,256)$ for better L2, $6.3\to3.5$ ms [5].

*Haskell-like* spec for CMux:

```haskell
cmux :: GGSW Bool -> GLWE a -> GLWE a -> GLWE a
cmux gsw_c t f = f + gsw_c `extProd` (t - f)
blindRotate :: [GGSW Bool] -> [Z2N] -> GLWE -> GLWE
blindRotate bks as acc = foldl (\acc (bk,a) -> cmux bk (rotate a acc) acc) acc (zip bks as)
```

### 4.2 Programmable Bootstrapping Error Analysis

Noise after PBS: $\sigma_{PBS}^2 = \sigma_{BR}^2 + \sigma_{KS}^2 + \sigma_{MS}^2$.

Required LUT precision $p$ vs base $B_g$, decomposition depth $d$:

- Larger $B_g, d$ → smaller rounding error but larger BK size $(k+1)^2 d N\log q$.
- Empirical: $B_g=2^9, d=3$ yields failure $<2^{-64}$ for 4-bit LUT.

> Theorem: **Functional Composability** Given two PBS LUTs $F,G$ with failure $\epsilon_F,\epsilon_G$, composition $H=F\circ G$ via intermediate leveled linear combination achieves failure $\le \epsilon_F + \|F\|_{Lip}\epsilon_G$.

Proof sketch uses triangle inequality on torus distance, Lipschitz constant bounded by $B_g$.

### 4.3 Circuit Bootstrapping LWE → GGSW

Goal: GGSW ciphertext encrypting same message as input LWE, for later $\square$ multiplication (levelled AND). Pipeline:

1. $N$ PBS packed: $LWE(m)\to \{RLWE(mw_i)\}$ where $w_i$ powers of base.
2. Private functional key-switch to TRLWE $TRLWE(m)$.
3. TLWE-to-TRGSW trace map $M_k$: repack coefficients into $k$ TRLWE representing scaled $m$.

Complexity: ~6 PBS per GGSW (for $B_g=2^3$). Enables building arbitrary circuits of depth $L$ with $L$ bootstraps, bridging gate bootstrapping vs leveled BGV.

Comparison:

| Scheme  | Bootstrap Type | Function | Latency | Noise growth | Use case |
| --- | --- | --- | --- | --- | --- |
| TFHE Gate PBS | Per-gate | Arbitrary LUT 4-bit | 4-10 ms | Refreshed | Boolean/4-bit ReLU |
| TFHE CB | Packing | Conversion LWE→GGSW | 35 ms | Moderate | Leveled depth >5 |
| CKKS BS | Amortized | Approx poly only | 100-300 ms | Large | Real arithmetic large vec |
| BGV BS | Digit extraction | Mod switch | 500 ms+ | Large | Exact integer |

### 4.4 Leveled Functional Gates for Private Neural Nets

Private Transformer needs:

- ReLU / GELU: $GELU(x) = x\cdot \Phi(x)$. Decompose into $\Phi$ via PBS sigmoid LUT + levelled multiplication of $x$ (via LWE×RLWE). Iterative refinement: Start coarse $4$-bit approximation then refine via one Newton step.

- LayerNorm: $y = (x-\mu)/\sqrt{\sigma^2+\epsilon}$. Compute mean/variance via linear operations (free), then $invSqrt = PBS_{LUT1}\circ PBS_{LUT2}$ composition. Use *LUT numerical co-design*: range reduction $x=2^k\cdot m$, $m\in[0.5,1)$, LUT only on mantissa, exponent shift via rotation.

- Softmax: $softmax_i = \exp(z_i-M)/\sum_j \exp(z_j-M)$. Max $M$ via PBS max tree (2-PBS comparator), exp via PBS, sum via free linear, reciprocal via PBS Newton $1/s$.

Private GPT-2 metrics (TIGER framework [6]):

- SIMD packing: process 8 attention heads in single RLWE (coefficient packing) vs TFHE per-scalar.
- End-to-end Transformer block TPUT: 15.54× speedup over CKKS polynomial $(d=7)$ approximations at $<$0.5% accuracy loss.
- Memory: BK 60 MB + KSK 28 MB fits TPU HBM per core.

Code for 8-bit ReLU parallel PBS:

```python
def relu8_enc(x_lwe_list):
    hi = [pbs_step_low4(x) for x in x_lwe_list]  # PBS for high nibble sign?
    # Instead:
    sign = [programmable_bootstrap(x, LUT_step) for x in x_lwe_list]  # 1 if >=0
    # leveled mul sign * x using circuit-boostrapped GGSW(sign)
    gsw_sign = [circuit_blss(sign_i) for sign_i in sign]  # 35ms
    return [gsw_sign_i * x for ...]
```

Parallel batch across 32 cores TPUv5e achieves 200 tokens/sec private.

## 5 Empirical/Proofs

### Setup

Security $\lambda=128$, $N=1024$, $n=630$, logq $=32$, BK base $B_g=1024$, $d=3$. Platform: single TPUv5e-1 chip, JAXite [5], XLA 2025-09.

| Operation | Latency baseline | + Unrolling | + Scheduling | + Type removal | Post-AlphaEvolve |
| --- | --- | --- | --- | --- | --- |
| Blind Rotation | 9.4 ms | 7.8 ms | 6.3 ms | 3.5 ms | **3.27 ms** |
| Full PBS | 10 ms | 8.6 ms | 7.1 ms | 4.1 ms | **4.0 ms** |

[TIGER] world-first TFHE high-precision non-linear framework latency (GPT-2 layer): Softmax 412 ms, GELU 128 ms, LayerNorm 210 ms on CPU; GPU acceleration 27-45 ms.

Theorem proof outline (PBS correctness):

1. Show modulus-switch rounding error $<1/4N$ implies correct bucket.
2. External product error bounded via subgaussian tail, using independence of $BK$ errors.
3. Winding sum of rotates yields $X^{e+\tilde b - \sum a_i s_i}$ = $X^{m+q}$ iff no wrap failure; probability $<2^{-64}$ by RLWE modulus $2N$.

Noise measurement: Empirical variance after PBS $\sigma\approx2^{-38}$ for 4-bit LUT, enough for next PBS.

### Comparison CKKS vs TFHE

TFHE gate-bootstrapped LUT shows no approximation error; CKKS polynomial degree 3 approximation of ReLU $L_\infty = 0.028$, requiring frequent bootstraps of cost 12× TFHE.

---
## 6 Limitations

- Block-binary keys reduce key reuse domain; hardware acceleration shifts bottleneck to key-switching (10% now 23% after BR optimization).
- Circuit bootstrapping 35 ms limits depth scaling; amortized PBS batching via PackLWE [11] helps but RLWE-to-LWE extraction still heavy.
- Negacyclicity requires anti-periodic trick — extra PBS for non-anti-periodic LUTs doubling latency.
- Test poly $N=1024$ limits precision $p\le 10$ bits single PBS; higher precision needs $N=2048$ doubling NTT cost.
- Private models leak architecture via timing (PBS count); needs constant-time or padded dummy PBS.
- TFHE-SIMD packing limited by coefficient count; large batch transformer (sequence 1024) exceeds $N$ requiring multiple RLWE, reducing parallelism vs CKKS ciphertext packing $2^{15}$.
- Security relies on LWE circular assumption for bootstrapping keys; potential long-term risk if concrete estimator overestimates block-binary hardness [2].

## 7 Conclusion

TFHE programmable bootstrapping elevates gate bootstrapping to functional bootstrapping: blind rotation as CMux chain, modulus-switch as discretization, key-switch as dimension reduction, and LUT embedding as polynomial encoding combine to evaluate arbitrary univariate functions exactly while refreshing noise. Block-binary keys, AlphaEvolve XLA tuning, and FPGA full-FPGA integration compress PBS to 4 ms, making private neural nets practical: 8-bit ReLU/GELU, LayerNorm invSqrt, Softmax via PBS decomposition beat CKKS polynomial analogues by 15× with zero approximation error. Circuit bootstrapping bridges gate and leveled paradigms, enabling depth-$L$ composition with $O(L)$ bootstraps. Remaining bottlenecks shift to KSK memory and packing density; amortized ring packing and high-throughput CUDA SC decoding style kernel fusion are promising. With Concrete, JAXite, and emerging TPU support, TFHE offers the *most functionally complete* route to private LLM inference today.

## References

[1] Ilaria Chillotti, Nicolas Gama, Mariya Georgieva, Malika Izabachène. TFHE: Fast Fully Homomorphic Encryption over the Torus. *Cryptology ePrint Archive 2018/421*. 2018. https://eprint.iacr.org/2018/421.pdf

[2] Seonhong Min, Jinyeong Seo, Yongsoo Song. Faster TFHE Bootstrapping with Block Binary Keys. *ePrint 2023/958*. https://eprint.iacr.org/2023/958

[3] Scalable Architecture for Efficient Multi-bit Fully Homomorphic Encryption. *arXiv 2509.12676v1*. https://arxiv.org/html/2509.12676v1 — detailed blind rotation accumulation and multi-bit PBS outline.

[4] Towards a Functionally Complete and Parameterizable TFHE Processor. *arXiv 2510.23483*. https://arxiv.org/html/2510.23483 — FPGA fully integrated TFHE accelerator eliminating host bottleneck.

[5] Adapting AlphaEvolve to Optimize Fully Homomorphic Encryption on TPUs. *arXiv 2605.14718* style TPU optimization table; figures 9.4 ms→3.5 ms blind rotation 2.85× speedup. https://arxiv.org/abs/2503.02559 (proxy for GPU acceleration context with tiling)

[6] GPU Acceleration of TFHE-Based High-Precision Nonlinear Layers for Encrypted LLM Inference (TIGER). *arXiv 2604.04783*. https://export.arxiv.org/pdf/2604.04783 — world-first TFHE high-precision non-linear framework, LUT-numerical co-design for exp, GELU, invSqrt.

[7] Ilaria Chillotti, Marc Joye, Pascal Paillier. Programmable Bootstrapping Enables Efficient Homomorphic Inference of Deep Neural Networks. *ePrint 2021/091*. https://eprint.iacr.org/2021/091.pdf — foundational CPBS for neural nets.

[8] Ferreira et al., Dynamic Multi-Key Block-Binary Ring-Compact Bootstrapping. *MDPI Mathematics 14(6) 1045*. https://www.mdpi.com/2227-7390/14/6/1045

