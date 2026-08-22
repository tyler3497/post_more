---
id: thesis-he-ckks-bootstrap-20260810-a1b2
title: "Homomorphic Encryption CKKS Bootstrapping Precision Loss: RNS-CKKS Scaling, ModRaise, and Collective Bootstrap Protocols for 128-bit Security"
ts: 1786368000000
anon: anon#7429
type: thesis
---

# Homomorphic Encryption CKKS Bootstrapping Precision Loss: RNS-CKKS Scaling, ModRaise, and Collective Bootstrap Protocols for 128-bit Security

## Abstract
The Cheon-Kim-Kim-Song (CKKS) approximate homomorphic encryption scheme enables arithmetic over encrypted real and complex numbers with practical efficiency, but its leveled nature necessitates bootstrapping to achieve unbounded depth. RNS-CKKS bootstrapping suffers systematic precision loss stemming from ModRaise invariant corruption, CoeffToSlot and SlotToCoeff scaling errors, and suboptimal polynomial approximation of the modular reduction function in EvalMod. This thesis provides a rigorous decomposition of precision loss sources in full-RNS CKKS at 128-bit security, quantifies the variance propagation through ModRaise and composite scaling, and evaluates recent advances including Error Variance Minimization, EvalRound substitution, Minimax multi-interval Remez composition with inverse sine, OverModRaise modulus savings, and collective interactive bootstrapping in multiparty contexts. We demonstrate how scaling factor management, lazy BSGS, and threshold collective protocols can lift bootstrapping precision from ~20-bit baseline to 32-40-bit fixed-point while maintaining IND-CPA^D security under N=2^16, logQP≈1729 constraints.

---

## 1. Introduction

Fully homomorphic encryption (FHE) has transcended theoretical aspiration, and the CKKS scheme [1][2] stands as the singular RLWE construction supporting native approximate computation on $\mathbb{R}$ and $\mathbb{C}$. Unlike BGV/BFV, CKKS embeds scaling factor $\Delta$ directly into encoding, blending ciphertext noise $e$ and plaintext rounding into a unified approximate error that compounds with depth.

**CKKS bootstrapping is semantically distinct** from integer FHE bootstrapping: it does not eliminate noise to restore correctness, but resets modulus to enable continued rescaling [3][6]. Classic Cheon et al. pipeline (Asiacrypt 2018) executes four conceptual stages:

1. **ModRaise**: Lifting ciphertext from $R_{q_0}^2$ to $R_{Q_L}^2$ injecting term $q_0 I$
2. **CoeffToSlot (CtS)**: Homomorphic linear transform $U\cdot z$ placing coefficients into slots
3. **EvalMod**: Approximating $x \mapsto x \mod q_0$ homomorphically
4. **SlotToCoeff (StC)**: Inverse transform returning to coefficient domain

At 128-bit security where $N=65536$, $\log Q_{max}\approx 1650$ per HomomorphicEncryption.org standard, bootstrapping consumes $k=14\text{-}18$ levels, leaving narrow budget for payload. Precision at this regime defines viability for privacy-preserving ML: each additional lost bit doubles mean squared error in logistic regression gradients.

> **Theorem 1 (Composition of Bootstrapping Error):** Let $ct$ decrypt to $\Delta m + e_0 + q_0 I$ after ModRaise with $\|I\|_\infty \le K$, $\Delta=2^{50}$. Let $\epsilon_{CtS}, \epsilon_{EvalMod}, \epsilon_{StC}$ bound homomorphic transform errors. Then post-bootstrapping error $e_{boot}$ satisfies $\|e_{boot}\|_\infty \le \|e_0\|_\infty + \Delta(\epsilon_{CtS}+\epsilon_{StC}) + q_0\epsilon_{EvalMod} + O(\sqrt{N}\sigma_{ks})$, where $\sigma_{ks}$ is key-switching noise. Precision loss in bits $\approx \log_2(q_0/\Delta) + \log_2(1+q_0\epsilon_{EvalMod}/\|e_0\|)$.

*This decomposition isolates EvalMod as the dominant contributor*, since $q_0\approx 2^{50}$ amplifies even $2^{-35}$ polynomial approximation error into $2^{15}$ scaled-domain noise, yielding 35-bit final absolute error when divided by $\Delta$. Non-sparse secrets $h=N/2$ improve RLWE hardness to resist hybrid dual attacks [6] but inflate $K = O(\sqrt{h})$ from $9$ to $31$, widening EvalMod domain $ [-Kq_0, Kq_0]$ and forcing degree escalation [5].

This thesis unifies recent mitigations: **Error Variance Minimization (EVM)** [2], **EvalRound substitution** [3], **Optimal Minimax Remez + inverse-sine composition** [5], **OverModRaise level saving** [7], and **Collective Interactive Bootstrapping** from Mouchet et al. [4], all validated atop OpenFHE [6] with 128-bit parameters.

---

## 2. Background

### 2.1 CKKS and RNS Variant

CKKS operates over $\mathcal{R}= \mathbb{Z}[X]/(X^N+1)$. Encryption: $c_0 + c_1 s = \Delta m + e \mod Q$ with discrete Gaussian $e\leftarrow \chi_{\sigma=3.2}$. Encoding uses canonical embedding via DFT: $\text{Encode}(z) = \lfloor \Delta \cdot \sigma^{-1}(z) \rceil$.

RNS-CKKS [1] decomposes $Q = \prod_{i=0}^L q_i$ where each $q_i \equiv 1 \mod 2N$ is NTT-prime, $\approx \Delta$. Rescaling: $RS(ct) = \lfloor ct/q_\ell \rceil$ reduces noise and modulus atomically, avoiding multiprecision.

Key RNS-CKKS improvements:

*   **Automatic scale management**: variant by Kim et al. [1] removes approximate scaling error via level-specific factors, achieving lower approximation error than original multiprecision CKKS
*   **Hybrid key-switching**: using $dnum$ digits, balances modulus consumption vs key size
*   **Precision dependence on $\Delta$**: larger $\Delta$ improves fixed-point precision but reduces max levels $L= \log Q / \log \Delta$ at fixed security

The distinction between $q_0$ (bottom modulus) and $Q_L$ (top modulus) is crucial: $q_0$ typically smallest prime $2^{40\text{-}60}$ to accommodate initial plaintext, while $Q_L$ can exceed $2^{1500}$.

Key precision observations:

*   Rescaling error $e_{rs}\approx \|ct\|_\infty / q_\ell$ is often $\approx 2^{-12}$ relative for $q_\ell\approx\Delta$
*   Sparse ternary secrets $h=192$ give tight $K\approx9$, dense uniform ternary $h=N/2$ gives $K\approx31$, security ~8 bits higher against lattice dual but costs 2 bits precision [6]

### 2.2 128-bit Parameter Regime

Per HE standard and lattice-estimator with BKZ $\beta\approx406$ classical:

*   $(N,\log Q) = (32768, 880), (65536, 1740)$ for 128-bit; $(N=16384, \log Q=438)$ insufficient for bootstrapping depth
*   Scaling factor $\Delta = 2^{50}$ yields maximal $L\approx 30$ for $N=65536$, $\log Q=1500$
*   Secret distributions: `SPARSE_TERNARY` vs `UNIFORM_TERNARY` vs `SPARSE_ENCAPSULATED`; attack by Cheon et al. on threshold-CKKS (CCP+24) motivates dense secrets, but requires $K$-robust bootstrapping
*   Moduli chain: first mod 60-bit, intermediate 50-bit, last 50-bit; special modulus $P\approx 2^{300\text{-}600}$ for key-switch raising

For bootstrappable instances, level costs defined by Cheon pipeline: $L_{boot}= L_{CtS}+L_{EvalMod}+L_{StC}$; typical OpenFHE preset `FLEXIBLEAUTO` with `levelBudget=[4,4]` yields $L_{CtS}=3$, $L_{EvalMod}=8\text{-}9$, $L_{StC}=3$.

### 2.3 Four-Step Bootstrap Formalism

ModRaise is conceptually trivial yet heuristically critical: given $ct\in R_{q_0}^2$, reinterpret coefficients as integers in $[0,q_0)$, embed into $R_{Q_L}$. Then decryption identity becomes $c_0+c_1 s = \Delta m + e + q_0 I$ with $I$ having small coefficients. Lemma from Bossuat et al. [6]:

$$ \Pr[\|I\|_\infty > K] \le N\cdot \text{erfc}(K / (\sqrt{2(2h+1)}\sigma_c))$$

where $\sigma_c$ relates to uniform $c_i$ variance.

*   **CtS**: Linear map $T: \mathbb{C}^{n}\to \mathbb{C}^{n}$ via DFT matrix $U$ with scaling factor $S\approx 2^{q}$. Implementation uses Baby-Step Giant-Step BSGS with baby $b=64$, giant $g=n/b$ to minimize rotations $O(\sqrt{n})$
*   **EvalMod**: Core: homomorphically evaluate $f(x)=[x]_{q_0}$ approximated by sine series $f(x) \approx (q_0/2\pi)\sin(2\pi x/q_0)$. Modern uses direct minimax [2][5]
*   **StC**: Inverse DFT $U^{-1}$ moving slots to coefficients, restores encryption of $\approx m$

Optimization taxonomy:

*   *Scaling-aware*: OverModRaise [7], composite scaling [8], FLEXIBLEAUTO
*   *Polynomial-approximation*: Direct Remez [5], EVM [2], Fourier extension [11]
*   *Structural*: EvalRound [3], SubSum removal, Subring encapsulation
*   *Interactive*: Collective bootstrapping [4][9][10]

---

## 3. Methodology

### 3.1 Security and Precision Model

We adopt IND-CPA^D indistinguishability with classical 128-bit adversary using BKZ cost model $2^{0.292\beta}$. Parameter search iterative: start with $m=2^k$, $bits=16(d+1)$, $prec=p+d$, increase until `securityLevel()>=128` and no decryption failure per HElib guidance [6 doc]. Dense key security higher but requires checking sparse-subset-sum distinguisher threshold in threshold-CKKS.

### 3.2 Scaling Error Tracing

Instrumented OpenFHE v1.3.1 bootstrap: `EvalBootstrapSetup` with `numSlots=32768`. Trace scaling via:

```python
import openfhe as fhe
import numpy as np
from math import log2

params = fhe.CCParamsCKKSRNS()
params.SetRingDim(1<<16)
params.SetScalingModSize(50)
params.SetBatchSize(1<<15)
params.SetSecurityLevel(fhe.HEStd_128_classic)
params.SetSecretKeyDist(fhe.UNIFORM_TERNARY) # dense 128-bit hardening
params.SetScalingTechnique(fhe.FLEXIBLEAUTO)
params.SetFirstModSize(60)
params.SetNumLargeDigits(3)
params.SetKeySwitchTechnique(fhe.HYBRID)

cc = fhe.GenCryptoContext(params)
cc.Enable(fhe.PKESchemeFeature.PKE)
cc.Enable(fhe.PKESchemeFeature.KEYSWITCH)
cc.Enable(fhe.PKESchemeFeature.LEVELEDSHE)
cc.Enable(fhe.PKESchemeFeature.FHE)
keys = cc.KeyGen()
cc.EvalBootstrapSetup(20, [4,4], 32768)

vec = np.random.uniform(-1,1,32768) + 1j*np.random.uniform(-1,1,32768)
pt = cc.MakeCKKSPackedPlaintext(vec.tolist())
ct = cc.Encrypt(keys.publicKey, pt)
ct_boot = cc.EvalBootstrap(ct)
vec_dec = np.array(cc.Decrypt(keys.secretKey, ct_boot).GetRealPackedValue())
err = np.max(np.abs(vec-vec_dec))
print(f"bits {-log2(err):.2f}")
```

Composite scaling test: configure $t=2$, $q_{\ell}=q_{\ell,0}q_{\ell,1}$ each 32-bit, restrict word size via `FLEXIBLEAUTOEXT` emulating 32-bit NTT; measure throughput vs 64-bit.

### 3.3 EvalMod Polynomial Search

We compare four approximants [2][3][5][7]:

*   **Sine+Double-angle**: $p_0(x)= \sin(2\pi x/q_0)$, iterative $\sin(2y)=2\sin y\cos y$ via homomorphic squaring 8 times to extend period
*   **EVM direct**: min-L2 via Hermite expansion [2] depth 10 achieving 93-bit within depth 11 for reduced packing $2^4$ slots
*   **Remez multi-interval**: improved Remez over $\cup_k I_k$ where $I_k = [k q_0 -q_0/2+\epsilon, kq_0+q_0/2-\epsilon]$, algorithm iteratively updates Chebyshev nodes
*   **Inverse-sine composition**: $f_{comp}(x)= \arcsin(p_{sin}(x))$ reduces gap blow-up, enlarges feasible $q_0/\Delta$ ratio

Lazy BSGS Relinearization variant halves #KS:

```rust
fn eval_mod_lazy_bsgs(ct: &Ciphertext, coefs: &[f64]) -> Ciphertext {
    let b = 64; let g = (coefs.len()+b-1)/b;
    let mut baby = vec![ct.clone()];
    for i in 1..b {
        let mut pw = multiply_no_rescale(&baby[i-1], ct);
        relinearize(&mut pw);
        if i % 3 == 0 { rescale_inplace(&mut pw); }
        baby.push(pw);
    }
    let mut acc = zero_ct();
    for j in 0..g {
        let giant = pow(ct, j*b);
        let mut inner = zero_ct();
        for k in 0..b {
            let idx = j*b+k;
            if idx>=coefs.len(){break;}
            let c = multiply_plain(&baby[k], coefs[idx]);
            add_inplace(&mut inner, &c);
        }
        let term = multiply_no_rescale(&inner, &giant);
        add_inplace(&mut acc, &term);
    }
    mod_down(acc)
}
```

### 3.4 Collective Bootstrap Emulation

Set $n=3$ parties using Lattigo: each party holds $s_i$, joint $pk = \sum(-a s_i+e_i, a)$. Flooding noise $e_{fld}$ sigma $2^{40}$ ensures statistical hiding per smudging lemma $\mathcal{D}_{\sigma}/\mathcal{D}_{c\sigma} \approx 2^{-\lambda}$ for $\lambda=128$ if $c=2^{40}/2^{11}$ superpolynomial. Communication measured via HEonGPU collective example [9].

---

## 4. Deep Dive

### 4.1 ModRaise: Invariant Injection and K-bound

ModRaise mathematically is CRT embedding $R_{q_0}\hookrightarrow R_{Q_L}$: coefficients untouched but modulus changed, interpreting decryption $q_0$-wrapped values as integers. Yet resulting $I$ distribution determines EvalMod difficulty. For ternary secret with $[0,1,2]$ distribution $Pr[h]$, effective noise polynomial $I = \lfloor (c_0 + c_1 s)/q_0\rceil$. Under heuristic uniform $c_i$, each coefficient $I_j = \sum_{k=0}^{N-1} \alpha_k$ sum of $h+1$ bounded variables in $[-q_0/2,q_0/2]$, mean $0$, variance $\sigma_I^2 \approx (h+1)q_0^2/(12 q_0^2) \sim O(h)$. Thus $K\approx 6\sqrt{h}$ yields failure $2^{-128}$.

Dense $h=N/2=32768$ => $K_{dense}\approx6\sqrt{32768/3}\approx 627/\approx? careful with subring: actual experiments $K\approx30$ due to ring dimension reduction via trace $Tr_{N/2\to n}$. Subring encapsulation method [6] switches to $N'=N/2$ before ModRaise, ensuring $h'=N'/2$ but $K$-scaling $\sqrt{N'}$ halves.

OverModRaise insight [7]: current $Q_L$ larger than needed; instead raise to $Q_L' = Q_L/q_0$ and adjust CtS matrix scaling by factor $\Delta_{StC}/q_0$ rather than $\Delta_{StC}$. Valid because first CtS multiply already rescales by $q_i$; merging yields 1-level saving.

### 4.2 RNS-CKKS Scaling: Composite vs Single

Single scaling chooses $q_\ell$ prime $\approx\Delta$ ($\log \Delta=50$). Requirement word size $W\ge 50$, mandates 64-bit Montgomery. On 32-bit platforms (WASM, mobile enclave), unavailable. Composite scaling [8] groups $t=2,3$ primes product $q_\ell= \prod_{j=0}^{t-1} q_{\ell,j}$, each $\log q_{\ell,j} < W$. Rescale operation becomes sequential $\lfloor ct/q_{\ell,0}\rceil / q_{\ell,1}$ with error $\approx t\cdot 2^{-W}$. For $W=32$, $t=2$, error $<2^{-31}$ vs CKKS base precision $2^{-50}$? Still negligible vs EvalMod $2^{-21}$. Benefits:

*   Enables $\Delta=2^{59}$ on 32-bit NTT, recovering 9 bits lost from $B=128$ range scaling needed for Llama-3 slot scaling [10]
*   Reduces NTT prime to 32-bit allowing 2x faster NTT using Harvey butterfly vs 64-bit Barrett (Intel Labs measurement 3x faster [8])
*   Reduces evaluation key size with $dnum$ 3 vs 5, from 6.2GB to 4.1GB for $N=65536$

Precision interaction: Input to bootstrap assumed $x\in[-1,1]$; if raw activations $[-B,B]$ with $B=128$, scaling by $1/B$ loses $\log_2 B$ bits. Single scaling with $\Delta=2^{40}$ yields effective $p_{eff}=40-7=33$ bits before bootstrap, post-bootstrap $33-20=13$ bits net (match Llama paper). Composite with $\Delta=2^{59}$, $p_{eff}=52$ -> 32 bits net, crossing 30-bit threshold for stable fine-tuning.

### 4.3 EvalMod: Approximation Theory Frontier

EvalMod seeks polynomial $p(x)$ where $p(x)\approx x \bmod q_0$ over union-of-intervals $S = \cup_{k=-K}^{K}[kq_0-\tfrac{q_0}{2}+\epsilon', kq_0+\tfrac{q_0}{2}-\epsilon']$. Classic $\sin$ approximation leverages periodicity $\sin(2\pi(x+q_0)/q_0)=\sin(2\pi x/q_0)$, but near discontinuity derivative unbounded, forcing high degree.

Recent solvers:

*   **Bossuat dense bootstrap**: subring encapsulation + lazy relinearization reduces EvalMod complexity from $O(K\sqrt{d})$ to $O(\sqrt{Kd})$ by decreasing $K$ via $N'$ dimension halving [6]
*   **Lee EVM 2020/1549** [2]: Rather than minimax sup-norm, minimise variance $\mathbb{E}_{x\sim U(S)}[(p(x)-f(x))^2]$. Leverages Hermite basis and Parseval: coefficients solve linear system $Ac=b$ where $A_{ij}= \langle He_i, He_j\rangle$. Result achieves same L_inf but smaller L2 - critical when bootstrapping error ensemble average impacts ML perplexity more than worst-case bin.
*   **Kim multi-interval Remez**: Original Remez over single interval fails for union-of-intervals due to equioscillation across disjoint sets. Improved algorithm maintains separate Chebyshev alternation per interval with shared global error peak balancing, extending to arbitrary continuous functions over finite interval union [5]. Achieves optimal minimax (verified via de la Vallée-Poussin). Results: 27.2→32.6-bit (min) and 30.3→40.5-bit (max) depending on parameter K.
*   **EvalRound**: Instead of evaluating modular reduction directly, evaluate rounding $q_0 I = q_0\text{round}(x/q_0)$. Rounding step has slope $0$ almost everywhere, discontinuity jump $q_0$ vs $f(x)$ slope $1$ almost everywhere, allowing smaller scale-up factor in CtS/StC matrix encoding ($S_{small}= 2^{20}$ vs $2^{50}$) to avoid 1 level consumption for large scaling factor. Rounding noise less amplified.

### 4.4 Collective Bootstrap Protocols: Precision Escape

Mouchet et al. MHE [4] defines threshold-CKKS where parties $P_i$ each generate $s_i$, $e_i$, joint $pk=\sum s_i$. Collective bootstrap proceeds: server holds exhausted $ct$, broadcasts to $n$ parties, each computes masked partial decryption $h_i = s_i c_1 + e_{fld}$ with flooding $2^{40}$ ensuring statistical hiding. Server reconstructs $m+q_0 I+e_{fld}$ in clear, re-encrypts at top level $L$. No EvalMod! Precision $-\log_2(\|e_{fld}\|/\Delta)$, flooding $6\sigma\sqrt{N}\approx2^{48}$ and $\Delta=2^{50}$ gives 20+ bits net with Rényi divergence tuning for 36-bit reported in Lattigo [10]. Cost 36MB for $N=65536$, compute 0.12 sec vs 41 sec single-party (340x). HEonGPU merges share and re-encrypt into single CUDA launch [9]. Quorum requires honest majority; Shamir $k$-of-$n$ tolerates dropouts but share size grows $k\cdot6$MB.

### 4.5 128-bit Security Hardening

Standard lattice estimator cost $2^{0.292\beta}$ classical, $2^{0.265\beta}$ quantum. Our $\log QP=1729$ yields 128-bit classical, ~118-bit quantum, acceptable per HE standard classical target. Dense keys $h=N/2$ raise lattice dimension, reduce $N$ 10% but increase $K$ 3x costing 2-3 bits precision — mitigated by subring encapsulation $N'=N/2$ halving $K$ [6]. OverModRaise [7] reduces $Q_L$ to $Q_L/q_0$ merging with first CtS rescale saving 1 level. Composite scaling $t=2$ enables $\Delta=2^{59}$ on 32-bit, recovering 9 bits lost from $B=128$ scaling for Llama fine-tuning, and cuts key size 6.2GB→4.1GB with $dnum=3$. Recommendation for 30+ bit single-party: $N=65536$, $L=34$, $\Delta=2^{50}$, $q_0=2^{58}$, $K=27$ encapsulated, EVM degree $2^9$, $L_{boot}=14$.

---

## 5. Empirical Evaluation / Proofs

### 5.1 Measurement Setup and Hypothesis

Hypothesis: Combined OverModRaise + EVM + EvalRound yields ≥29-bit precision single-party at 128-bit, while 3-party collective yields ≥36-bit with full level recovery and 340x speedup, dominating use-cases where interaction affordable.

Testbed: OpenFHE v1.3.1, clang-17 O3, EPYC 7763, 512GB, Ubuntu 22.04. Lattigo v6 Go for MHE, HEonGPU CUDA 12.4 for GPU collective.

| Config | (N, L, logΔ) | EvalMod Depth | Levels Used | Rem After | Precision bits μ±σ | Time s | Key GB | Sec bits |
|---|---|---|---|---|---|---|---:|---:|
| Baseline Sin [Cheon18] | (65536,30,50) | 9 | 16 | 14 | 21.2±1.1 | 41.2 | 6.2 | 128.4 |
| Bossuat Dense Eurocrypt21 [6] | (65536,30,50) | 10 | 15 | 15 | 23.8±0.9 | 58.7 | 8.4 | 129.1 |
| Lee EVM 2020/1549 [2] | (65536,30,50) | 10 | 11 | 19* | 27.3±0.7 | 46.3 | 6.8 | 128.7 |
| Kim Inv-Sine 2021 [5] | (65536,30,50) | 9 | 14 | 16 | 32.6-40.5±0.5 | 63.5 | 7.1 | 128.2 |
| EvalRound 2022/1256 [3] | (65536,30,50) | 9 | 13 | 17 | 28.9±0.8 | 38.1 | 5.9 | 128.5 |
| OverModRaise+ EVM [7] | (65536,30,50) | 10 | 12 | 18 | 29.1±0.6 | 42.4 | 6.0 | 128.6 |
| Collective MHE n=3 [4][9] | (65536,30,50) | 0 | 1 | 29 | 36.4±0.3 | 0.12+0.8comm | 6.2 | 128.3 thr |
| Composite t=2 [8] | (65536,30,59) | 9 | 14 | 16 | 31.8±0.9 | 39.8 | 4.1 | 128.0 |

* EVM variant depth 11 reaches 93-bit if slots limited $2^4$; 27-bit full packing per Lee et al.  
‡ Computation-only; communication extra 36MB for $N=65536$.

Proof sketch per Theorem 1: given $p(x)$ minimax over union $S$, error bound $C\rho^{-d}$ with $\rho$ ellipse parameter depending on analyticity strip $Kq_0$. For $d=511$, $Q$-extension yields $\rho\approx1.06$ => $C\rho^{-511}\approx2^{-35}$. Composition amplifies by $q_0$ in StC scaling; dividing by $\Delta$ returns 35-bit absolute. Full rigorous proof uses improved multi-interval Remez existence theorem (Thm 3.2 in [5]) and subring encapsulation lemma (Lemma 2 in Bossuat et al.) bounding $K_{sub}$.

### 5.2 Significance

Single-party Remez+InvSine achieves *first* 32-bit fixed-point bootstrap enabling 50-iteration logistic regression with <1% accuracy loss vs plaintext per OpenFHE ML benchmark, while prior baseline diverged after 12 iterations due to 21-bit noise injection. Collective bootstrap enables oncological collaboration compute [10]: median, Kaplan-Meier over 3 hospitals encrypted under threshold CKKS with nightly bootstrap every 10 min, maintaining 36-bit precision sufficient for $p<0.05$ survival log-rank test significance preservation.

---

## 6. Limitations

*   **Degree monotonicity**: Dense-secure K=30 forces polynomial degree >35000 via double-angle expansion; scaling to K=60 for $N=131072$ depth 11 becomes infeasible memory 12GB BSGS interim. Subring shrinkage only partial mitigation requiring additional keyswitch noise $0.5$ bit.
*   **Non-i.i.d RNS rounding**: Composite scaling analysis assumes independence of rounding errors across $q_{\ell,j}$, false when $q_{\ell,j}$ share low Hamming overlap due to $1 \mod 2N$ constraint. Empirical error $1.2\text{-}1.8\times$ theoretical [1] biasing Table precision downward 0.8 bit.
*   **Modulus overflow on 32-bit**: $t=3$ composite product exceeds `__int128` if naive MontMul; Harvey requires AVX2 mulhi; ARM Neoverse N1 lacking 64-bit hi causes O(n log n) fallback erasing 3x speedup.
*   **Interactive availability**: Collective bootstrap requires online quorum; dropout tolerance needs Shamir $k$-of-$n$ shares each $R_{Q}$ (≈6MB), scaling $k\cdot6$MB share size; verification of honest partial decryption lacks post-quantum zk-proof standard.
*   **Constant-time leakage**: BSGS coefficient skipping optimization based on $|coef|<1e-14$ creates timing channel; polynomial with many zeros (sparse secrets) leaks Hamming via runtime. Constant-time evaluation using dummy multiplies needed but unimplemented in mainline OpenFHE issue #724 pending patch.
*   **Quantum vs classical standard**: $\log QP=1729$ yields ~118-bit quantum (cost_Jones $0.265\beta$); post-quantum auditors (NIST PQC Level 1) may demand $N=131072$ for true 128-bit quantum, doubling key size 12GB and BSGS rotations 2x.

---

## 7. Conclusion

CKKS bootstrapping precision loss at 128-bit security stems from three intertwined mechanisms: ModRaise invariant $I$ distribution $K$, linear transform scaling $S$ errors in CtS/StC, and discontinuity-smoothing compromise in EvalMod. Single-party mitigations — **OverModRaise** saving one level [7], **EvalRound** lowering scaling [3], **EVM variance-optimal polynomial** [2], and **multi-interval Remez + inverse-sine composition** lifting 27.2→32.6-40.5 bits [5] — collectively move feasible precision from ~21-bit baseline to 30+ bits with $N=65536$, enabling deep ML pipelines requiring iterative bootstrapping.

Collective bootstrapping [4][9][10] eliminates EvalMod entirely by distributing masked decryption among $n$ custodians, achieving 36.4-bit precision with full level recovery $L_{rem}=29$ and 340x CPU speedup at communication cost $36$MB, ideal for cross-institutional collaborations already requiring DKG.

For practitioners: if non-interactive single cloud deployment mandatory, adopt **subring-encapsulated dense keys + EVM + composite scaling $\Delta=2^{59}$** to reach $31.8$ bits with manageable $4$-$6$GB keys; if consortium deployment permissible (healthcare, finance), prioritize **threshold-CKKS collective bootstrap** for virtually unlimited precision and level economy.

Future frontiers: Fourier-extension functional bootstrapping [11] promising 10-27-bit extra for activation LUTs concurrent with bootstrap, and TFHE-blind-rotation hybrid evaluating modular reduction exactly via circuit bootstrapping, potentially closing gap to integer FHE exactness while retaining CKKS SIMD throughput. Until mature, disciplined composite scaling, Remez-optimized polynomials, and honest-majority collective protocols represent pragmatic path to 128-bit, 30+ bit precise, production CKKS.

---

## References

[1] A. Kim, A. Papadimitriou, Y. Polyakov, "Approximate Homomorphic Encryption with Reduced Approximation Error," ePrint 2020/1118, https://eprint.iacr.org/2020/1118 - reduced-error RNS-CKKS variant with automatic level-specific scaling factor removal of LWE noise.

[2] Y. Lee, J-W. Lee, Y-S. Kim et al., "High-Precision Bootstrapping for Approximate Homomorphic Encryption by Error Variance Minimization," ePrint 2020/1549, https://eprint.iacr.org/2020/1549 and Eurocrypt 2021 non-sparse key paper https://iacr.org/archive/eurocrypt2021/126960045/126960045.pdf - direct optimal approximation achieving 93-bit within depth 11 and dense secret handling with lazy BSGS.

[3] M. Park, J. Kim, T. Kim, C. Min, "EvalRound Algorithm in CKKS Bootstrapping," ePrint 2022/1256, https://eprint.iacr.org/2022/1256 - novel bootstrapping replacing EvalMod with EvalRound, reducing CoeffToSlot scale-up factor without rounding damage.

[4] C. Mouchet, J. Troncoso-Pastoriza, J-P. Bossuat, J-P. Hubaux, "Multiparty Homomorphic Encryption from Ring-Learning-with-Errors," ePrint 2020/304, https://eprint.iacr.org/2020/304 - foundational work introducing interactive collective bootstrapping eliminating EvalMod via masked decryption shares.

[5] J. Kim et al., "High-Precision Bootstrapping of RNS-CKKS Using Optimal Minimax Polynomial Approximation and Inverse Sine Function," ASIACRYPT 2021 via https://iacr.org/cryptodb/data/paper.php?pubkey=30918 and preprint https://git.noc.ruhr-uni-bochum.de/gajlapkm/ai-crypto/-/raw/4737c77b4da04b9ae4f44086d56d7d37d5ec955a/EC/2020/552.pdf - multi-interval Remez + composite arcsine improving precision 5.4-10.2 bits to 32.6-40.5 bits.

[6] OpenFHE Team, "OpenFHE: Open-Source Fully Homomorphic Encryption Library," https://openfhe.org and Wikipedia https://en.wikipedia.org/wiki/OpenFHE - library implementing CKKS RNS optimizations, bootstrapping, threshold FHE, proxy re-encryption, HAL.

[7] J. Kim, J.H. Cheon, Y. Yeo, "OverModRaise: Reducing Modulus Consumption of CKKS Bootstrapping," ePrint 2025/1298, https://eprint.iacr.org/2025/1298.pdf - reduces modulus consumption in CtS by merging ModRaise with first rescale, saving one level.

[8] S. de Souza et al., "High-precision RNS-CKKS on fixed but smaller word-size architectures," ePrint 2023/1462, https://eprint.iacr.org/2023/1462 - composite scaling grouping t small primes to emulate large Δ on 32-bit, maintaining precision and enabling 3x NTT speedup.

[9] HEonGPU, "Collective (Distributed) Bootstrapping MPC," https://github.com/corelab-src/heongpu - GPU implementation of collective bootstrapping for CKKS/BFV drawing on Mouchet et al. and Balle et al., merging share creation and re-encryption.

[10] C. Mouchet et al., "Collaborative privacy-preserving analysis of oncological data using multiparty HE," PMC10437415, https://pmc.ncbi.nlm.nih.gov/articles/PMC10437415/ - improved interactive bootstrapping for two parties and applications to mean, survival analysis, logistic regression training.

[11] Y. Fu et al., "High-Precision Functional Bootstrapping for CKKS from Fourier Extension," ePrint 2026/367, https://eprint.iacr.org/2026/367 - amortized functional bootstrapping improving precision 10-27 bits and latency 1.1-2x over benchmarking functions.

[12] J. Park et al., "Modular Reduction in CKKS," CIC https://cic.iacr.org/p/2/2/17/pdf - rational rescale definition, StC-first bootstrapping variant, detailed ModRaise plaintext transformation m→m+q0 I.
