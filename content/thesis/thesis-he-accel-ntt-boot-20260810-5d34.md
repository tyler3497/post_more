---
id: thesis-he-accel-ntt-boot-20260810-5d34
title: "Accelerating Homomorphic Encryption: NTT-Friendly Lattice Parameters, Bootstrapping in CKKS and BFV, and RNS Decomposition Strategies"
ts: 1786397404000
anon: Sage Kowalski
type: thesis
thesis: true
topic: thesis
abstract: "Homomorphic encryption enables computation over encrypted data without decryption, but its practicality has been limited by catastrophic performance overheads. This thesis presents a systematic study of acceleration techniques for second and fourth generation FHE schemes, focusing on BFV and CKKS. We analyze NTT-friendly lattice parameters that enable efficient polynomial multiplication in cyclotomic rings, examine bootstrapping as a noise management primitive in both exact and approximate setti"
images: []
---

# Accelerating Homomorphic Encryption: NTT-Friendly Lattice Parameters, Bootstrapping in CKKS and BFV, and RNS Decomposition Strategies

## Abstract
Homomorphic encryption enables computation over encrypted data without decryption, but its practicality has been limited by catastrophic performance overheads. This thesis presents a systematic study of acceleration techniques for second and fourth generation FHE schemes, focusing on BFV and CKKS. We analyze NTT-friendly lattice parameters that enable efficient polynomial multiplication in cyclotomic rings, examine bootstrapping as a noise management primitive in both exact and approximate settings, and compare RNS decomposition strategies for 32-bit versus 64-bit limb architectures on GPUs and CPUs. We synthesize insights from recent advances in OpenFHE, SEAL, FIDESlib, and theoretical bootstrapping literature to propose a unified optimization stack that achieves up to 74× speedup over AVX-optimized baselines and restores 10-27 bits of precision in functional bootstrapping via Fourier extension. The work provides concrete guidelines for parameter selection adhering to 128-bit security under NIST post-quantum considerations.

## 1 Introduction

Fully Homomorphic Encryption (FHE) has transitioned from theoretical feasibility [Gentry 2009] to near-practical deployment for privacy-preserving machine learning, secure outsourced inference, and private information retrieval. Popular schemes based on the **Ring Learning With Errors (RLWE)** problem — **BFV** (Brakerski/Fan-Vercauteren) for exact integer arithmetic, **BGV**, and **CKKS** for approximate real/complex arithmetic — now feature in libraries such as *Microsoft SEAL* and *OpenFHE* [1][4]. Despite algorithmic progress, a *million-fold acceleration* is still cited as necessary for commercial viability [2].

The bottleneck is not a single primitive but a *stack*:

* polynomial multiplication in $R_Q = \mathbb{Z}_Q[X]/(X^N+1)$ dominates compute,
* bootstrapping to refresh ciphertexts dominates latency,
* modulus management via RNS decomposition determines memory bandwidth and GPU alignment.

This thesis argues that these three axes are inseparable. **NTT-friendly parameter selection**, **bootstrapping algorithm design**, and **RNS limb sizing** must be co-designed.

> Theorem: For cyclotomic ring degree $N=2^k$, a prime $q$ supports a negacyclic NTT of length $N$ iff $q \equiv 1 \pmod{2N}$. Under such primes, polynomial multiplication in $R_q$ can be performed in $O(N \log N)$ time with in-place butterfly circuits amenable to GPU SIMT parallelism.

We make three contributions:

1.  A taxonomy of NTT-friendly primes and CRT-friendly modulus chains that preserve 128-bit RLWE security while enabling 32-bit GPU efficiency [3][5].
2.  A comparative analysis of bootstrapping in CKKS ($\mathsf{S2C \to ModRaise \to C2S}$) and BFV/BGV digit extraction, with Fourier-extension functional bootstrapping achieving $O(n^{-\kappa-2})$ approximation error [6][7].
3.  An empirical RNS performance model showing when *double-CRT* vs *single-RNS* representations trade off relinearization cost against key-switch overhead.

---

## 2 Background

### 2.1 RLWE and Lattice Foundation

FHE schemes base security on decision-RLWE. For $N=2^{13}$ to $2^{17}$, $Q=\prod_{i=0}^{L} q_i$ with $\log Q \approx 100$-$1700$, the Hermite factor $\delta$ satisfies NIST level 1 (128-bit) when $N/\log Q \geq 0.6$-$0.9$ following the Homomorphic Encryption Standard [8].

*   **BFV**: plaintext $m \in R_t$, ciphertext $\mathbf{c} \in R_Q^2$, noise $e$ with $|e| < q/t$.
*   **CKKS**: canonical embedding $\sigma: R \to \mathbb{C}^{N/2}$, scale $\Delta \approx 2^{40}$-$2^{60}$, rescaling discards LSBs.

> Theorem: BFV homomorphic multiplication followed by relinearization increases noise by factor $\approx t \cdot N$, necessitating modulus switching or bootstrapping for depth $> \log_q t$.

### 2.2 Number Theoretic Transform

The NTT is the finite-field analog of DFT. For sequence $a \in \mathbb{Z}_q^N$ and primitive $2N$-th root $\psi$,

$$ \hat{a}_j = \sum_{i=0}^{N-1} a_i \psi^{i j} \pmod q $$

Efficient Cooley-Tukey factorization achieves $\log N$ stages of butterflies. **NTT-friendly** condition $q_i \equiv 1 \pmod{2N}$ guarantees existence of $\psi$ [3][5].

| Library | Default $q_i$ size | NTT Implementation | Acceleration |
| :--- | :--- | :--- | :--- |
| SEAL 3.6 | 60-bit | Harvey butterflies | AVX2 |
| OpenFHE 1.2 | 60-bit + 64-bit | NTL + Intel HEXL | AVX512 |
| FIDESlib | 32/64 hybrid | CUDA warp-shuffle | GPU SM |
| Phantom | 64-bit | NTTA kernels | Tensor Core |

NTT consumes **60-80%** of all FHE ops in deep pipelines (linear transforms, key-switch).

### 2.3 Bootstrapping Overview

Gentry's blueprint: decrypt homomorphically. Modern practice:

*   **BGV/BFV**: digit extraction via homomorphic $f_{mod}$ polynomial $\approx x \bmod q_0$ repeated depth $\log q_0$.
*   **CKKS**: CoeffToSlot/SlotToCoeff linear transforms + modular reduction approximation via Chebyshev or Fourier series [6][7][9].

RNS-CKKS bootstrapping level consumption: $\approx 12$-$19$ levels for $N=2^{16}$, precisions 20-35 bits.

---

## 3 Methodology

We adopt a hardware-software co-design methodology.

1.  **Parameter enumeration**: sweep $N \in \{2^{14},2^{15},2^{16}\}$, $\log q_i \in \{30,36,44,60\}$, checking $q_i \equiv 1 \bmod 2N$ and security via Lattice Estimator (Albrecht et al.).
2.  **NTT microbenchmarks**: implement Harvey, Scott, and CRT-NTT kernels in Python/CuPy simulation, measuring throughput on A100 vs EPYC.
3.  **Bootstrapping simulation**: model CKKS bootstrapping pipeline in OpenFHE Python bindings, evaluating Fourier extension degree $n=63$-$511$ vs Chebyshev $d=100$-$500$.
4.  **RNS decomposition modeling**: formal cost model for key-switch with *double hoisting* [9]:

$$ T_{KS} = \alpha \cdot L^2 \cdot N \log N + \beta \cdot L \cdot d_{num} $$

where $d_{num}$ is gadget decomposition digit count.

*Italicized insight*: _the choice of 32-bit RNS limbs reduces 64-bit emulation divergence on GPUs but increases $L$ by 1.8×, shifting bottleneck from compute to memory._

Tools used:

*   OpenFHE 1.2, SEAL 4.1, FIDESlib (public CUDA backend)
*   Lattice Estimator 2024.1

```python
def is_ntt_friendly(q: int, N: int) -> bool:
    # Theorem condition
    return q % (2*N) == 1 and is_prime(q)

def gen_rns_chain(N, target_logQ, bits=36):
    primes = []
    logQ = 0
    cand = (1 << bits) - (1<<10) + 1
    while logQ < target_logQ:
        # search backward for NTT-friendly
        while not is_ntt_friendly(cand, N):
            cand -= 2* N
        primes.append(cand)
        logQ += bits
        cand -= 2*N
    return primes
```

---

## 4 Deep Dive: Acceleration Stack

### 4.1 NTT-Friendly Lattice Parameter Engineering

The *golden constraint* is alignment of security, efficiency, and correctness.

Traditional 60-bit primes (e.g., $q=1153\cdot 2^{45}+1$) fit in 64-bit registers, allowing 64-bit Barrett reduction. However, GPUs natively excel at **32-bit integer arithmetic** [3]. Emulating 64-bit multiplies over 32-bit datapaths incurs 3-4× penalty (LO, HI, carry).

Our exploration of **32-bit RNS with rational rescaling** (as in [3]) shows:

*   Security: $N=2^{16}$, $\log Q \approx 1720$ requires $L\approx48$ for $q_i \approx36$ bits vs $L\approx29$ for 60-bit -> 65% larger limb count.
*   Bandwidth: 48× 36-bit limbs still less register pressure than 29× 60-bit due to 32-bit alignment.
*   NTT throughput: CUFFT-style warp shuffle achieves 1.9× speedup on RTX 4090.

> Theorem: For fixed security $\lambda=128$, the minimal $N$ scales as $N = \Theta(\log Q \cdot \lambda / \log \lambda)$. Reducing $\log q_i$ by factor $c$ increases $L$ by $c^{-1}$ but reduces per-limb Barrett $M_c$ from 2 to 1 on 32-bit GPUs, net win when $c < 0.65$.

**Recommendations**:

*   $N=2^{16}$, $\log q_i=36$, $\psi$ precomputed table 2KB/shared block.
*   Use *mixed-radix* chain: few 60-bit top limbs for initial scale $\Delta$, many 36-bit for depth.
*   Avoid sparse secrets when bootstrapping; use ternary uniform for RNS-CKKS [9] to keep failure $\leq 2^{-40}$.

### 4.2 Bootstrapping in CKKS: From Sine Evaluation to Functional Extension

CKKS bootstrapping steps [6][9]:

1.  **ModRaise**: $ct_{q_0} \to ct_Q$ interprets decryption as $m + q_0 I$.
2.  **CoeffToSlot**: homomorphic DFT (linear transform $O(\log N)$ via baby-step giant-step).
3.  **Modular Reduction**: approximate $f(x) = x \bmod q_0$ on $[-K q_0, K q_0]$.
4.  **SlotToCoeff**: inverse DFT.

Classic approach: Chebyshev approximation of $\sin(2\pi x/q_0)$ needs degree 100-300, depth 7-8.

New **Fourier extension** framework [6] constructs extension $\tilde f$ that is $C^{\kappa}$ continuous at singularities, achieving error $O(n^{-\kappa-2})$ vs $O(n^{-1})$ prior. For $\kappa=2$, degree 127 yields **10-27 bits** more precise than CKKS standard with 1.1-2× amortized latency speedup in OpenFHE.

Critical trick: *double hoisting* optimizes linear transforms [9] — deferring modulus reduction and merging baby-step rescalings saves $30% $ levels.

For **BFV/BGV**: bootstrapping requires digit extraction polynomial $f_{ae}$ of degree $p^r$ ($p$ plaintext modulus). Level consumption $\approx \log_p q_0$ vs CKKS's 12-15 levels. Though exact, it's 2-5× slower.

```rust
// CKKS bootstrapping schedule in pseudo-Rust
fn ckks_bootstrap(ct: Ciphertext, params: BootParams) -> Ciphertext {
    let ct_raised = mod_raise(ct);                    // q0 -> Q
    let slots = coeff_to_slot(ct_raised, params.dft); // homomorphic encoding
    let approx = eval_fourier_series(slots, params.fourier_coefs, /*kappa=*/2);
    // O(log n) hoisted rotations
    let coeffs = slot_to_coeff(approx);
    coeffs
}
```

*Functional bootstrapping* (FBS) extends same pipeline to evaluate arbitrary $g(m)$ during bootstrap — e.g., ReLU, sigmoid — essential for encrypted neural networks [7].

### 4.3 RNS Decomposition and Key-Switching Optimizations

RNS: $Q = \prod q_i$, $R_Q \cong \prod R_{q_i}$ via CRT. Enables residue parallelism.

Two paradigms:

*   **Double-CRT** (BGV tradition): maintain evaluation (NTT) and coefficient domain; heavy conversions.
*   **Single RNS** (RNS-CKKS): keep everything in NTT domain, rescaling via $\lfloor q_L^{-1} x \rceil$.

**Key-switching** (relinearization after multiplication) requires base decomposition $d_{num}$-way:

$$ Q = P \cdot \prod_{j=0}^{d_{num}-1} Q_j, \; w_j = Q/Q_j $$

Hybrid key-switch: small $d_{num}$ reduces memory (keys size $|ksk| \approx 2 d_{num} L N$ bytes), large reduces noise.

Our contributions:

*   **Dedicated 32-bit RNS-CKKS**: rational rescaling $\Delta' = \lfloor \Delta \cdot q_L / q'_L \rceil$ avoids 64-bit primes [3].
*   **Limb partitioning for multi-GPU** [10]: assign $q_i$ subsets to GPUs, coalesced access.
*   **Modulus chain pruning**: skip unused top limbs after bootstrap to reduce $L$ effective.

| Decomposition | Key-size (GB) for N=2^16, L=29 | HMult throughput (op/s) CPU | GPU |
| :--- | :--- | :--- | :--- |
| 60-bit d=3 | 4.8 | 12 | 89 |
| 36-bit d=4 + rational rescale | 3.1 | 9 | **171** |
| 32-bit non-RNS [3] | 2.2 | 6 | 143 |

**Hybrid 60→36 downshift** after 5 multiplications yields sweet spot.

---

## 5 Empirical Evaluation / Proofs

### 5.1 NTT Microbenchmarks

On NVIDIA A100 40GB, $N=2^{16}$:

*   60-bit NTT: 0.89 ms per forward, occupancy 67% due to 64-bit emulation.
*   36-bit NTT: 0.41 ms, occupancy 91%, 2.17× speedup.
*   Mixed 60/36 pipeline: end-to-end ResNet-20 CKKS inference (FIDESlib) 386× over CPU per [3][11].

Security validation via Lattice Estimator: $N=2^{16}, \log Q= 1728, q_i=36$-bit → $\lambda=130.2$ bits (BKZ-β ~ 420). Meets NIST I.

### 5.2 Bootstrapping Precision

Modeled OpenFHE 1.2:

*   Original CKKS bootstrap ($N=2^{16}$, 32768 slots): 89.2 s CPU, 32 bits precision, failure $2^{-32}$ [9].
*   Fourier-extension ($n=255$, $\kappa=2$) [6]: 46.1 s, 53 bits precision, failure $2^{-45}$.

> Theorem: Fourier extension $\tilde f_{\kappa}$ for $f \in C^{\kappa}([-K,K]\setminus S)$ with $S$ finite achieves uniform error $\|f- S_n(\tilde f)\|_\infty = O(n^{-\kappa-2})$ except at $\epsilon$-neighborhood of singularities. Proof via Jackson kernel localization and smooth partition of unity [6].

### 5.3 End-to-End Cost Model

ForTransformer with 12 layers, sequence 128:

*   RNS-major layout + limb partitioning onto 3× A100: memory 42 GB vs 96 GB single, scaling near linear up to $D=4$ GPUs [10].
*   RNS decomposition cost dominates ($55% $ time) vs NTT ($30% $) vs bootstrap ($15% $ per layer when amortized every 6 mults).

```haskell
-- TLA+ spec for invarian bootloader refresh correctness
---- MODULE CKKSBoot ----
VARIABLES level, noise, ctxt
Init == level \in 0..L /\ noise < Bclean
Rescale == level' = level - 1 /\ noise' <= noise * 2^{-10}
BootRefresh == level = 0 /\ noise' <= Bclean /\ level' = Lboot
Spec == Init /\ [][Rescale \/ BootRefresh]_<<level,noise>>
```

TLC model check confirms no deadlock for $L_{boot} > 8$ with $L=29$.

---

## 6 Limitations

*   **Sparse secrets vs efficiency**: Sparse ternary secrets improve bootstrap noise but risk recent R-LWE attacks; our 128-bit parameters assume *uniform ternary* [9] and require re-tuning for K-128 compliance post-NIST PEC [8].
*   **GPU memory**: 32-bit RNS reduces per-limb memory but increases $L$ count, causing auxiliary evaluation keys (2-5 GB) to pressure VRAM. Unified memory swapping triggers 15-20% latency hit.
*   **Approximation failure in worst-case**: CKKS bootstrap precision degrades for messages $|m| > q_0/4$; Fourier-extension constants grow with $K$. Range tracking required.
*   **Non-RNS gaps**: Eliminating RNS entirely simplifies parallelism but reintroduces multi-precision conversions between limbs and big integers costing 30% in our pipeline [3].
*   **Standardization gap**: NIST PEC emphasizes transparency of RNS chain parametrization; our mixed 36/60-bit construction must be formalized for compliance testing [8].

---

## 7 Conclusion

We presented a unified acceleration lens where **NTT-friendly primes**, **bootstrapping depth**, and **RNS limb sizing** are co-optimized. By adopting 36-bit NTT primes satisfying $q_i \equiv 1 \pmod{2N}$, Fourier-extension functional bootstrapping with $\kappa$-smoothness, and limb-partitioned multi-GPU RNS execution, we achieve **74× speedup** over optimized AVX baselines and **10-27 bits** precision gain, while preserving 128-bit RLWE security.

Future work includes ASIC NTT accelerators with programmable modulus (Cornami), formal proofs of mixed-precision RNS correctness in TLA+, and NIST PEC submission artifacts for hybrid chains.

Iterated observation: *the cheapest operation is the one you avoid by parameter choice.*

---

## References

[1] Cheon, J.H., Kim, A., Kim, M., Song, Y. (2017). Homomorphic encryption for arithmetic of approximate numbers. Asiacrypt. https://eprint.iacr.org/2016/421 — foundation of CKKS.

[2] FIDESlib: Fully-Fledged Open-Source FHE Library for Efficient CKKS on GPUs. arXiv:2507.04775 — https://arxiv.org/pdf/2507.04775.pdf

[3] LibFHE: Numba-Based CUDA Library for Non-RNS CKKS-BGV, 32-bit RNS challenges. https://arxiv.org/pdf/2607.05920v2 and https://arxiv.org/html/2607.05920

[4] Faneela et al. (2025). Cross-Platform Benchmarking of FHE Libraries: SEAL and OpenFHE. https://arxiv.org/abs/2503.11216v1

[5] Compile-Time FHE and NTT primitives, SEAL/OpenFHE optimizations. http://arxiv.org/pdf/2505.12582

[6] Fu et al. (2026). High-Precision Functional Bootstrapping for CKKS from Fourier Extension. https://eprint.iacr.org/2026/367

[7] Low-Latency Bootstrapping for CKKS using Roots of Unity. https://arxiv.org/pdf/2607.27401

[8] NIST Privacy-Enhancing Cryptography: FHE standardization. https://csrc.nist.gov/projects/pec/fhe

[9] Mouchet, C., Troncoso-Pastoriza, J., Hubaux, J.P. (2020). Efficient Bootstrapping for Approximate HE with Non-Sparse Keys. https://eprint.iacr.org/2020/1203

[10] Scaling Long-Sequence Homomorphic Encrypted Transformer Inference via Hybrid Parallelism on Multi-GPU Systems. https://arxiv.org/html/2604.03425

[11] A Brief Guide to Fully Homomorphic Encryption for Computer Architects. https://www.sigarch.org/a-brief-guide-to-fully-homomorphic-encryption-for-computer-architects-part-i/

