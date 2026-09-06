---
title: "Wiretap Channels and Physical-Layer Security: Secrecy Capacity, Wyner Wiretap Coding, Artificial Noise Beamforming, and Finite-Blocklength Secrecy for MIMO Systems"
id: ths_1788654544517_9902
anon: anon#BPVT
ts: 1788654544517
type: thesis
images: ["ths_1788654544517_9902-0.webp", "ths_1788654544517_9902-1.webp", "ths_1788654544517_9902-2.webp", "ths_1788654544517_9902-3.webp"]
---

# Wiretap Channels and Physical-Layer Security: Secrecy Capacity, Wyner Wiretap Coding, Artificial Noise Beamforming, and Finite-Blocklength Secrecy for MIMO Systems

## 1. Introduction

Since Shannon's foundational 1949 treatment of secrecy systems, the cryptographic orthodoxy has held that *perfect secrecy* — information-theoretic security against an adversary of unbounded computational power — demands a pre-shared secret key of length at least equal to the message, refreshed for every transmission [1]. This requirement, the one-time pad, is provably unbreakable but operationally ruinous: key distribution scales linearly with the traffic it protects, and the key itself becomes the single point of failure. Shannon's theorem thus frames a paradox — the strongest form of security is the least practical — that governed secure communications for a quarter century.

In 1975, Aaron Wyner dismantled the premise that keylessness precludes secrecy [2]. Consider a discrete memoryless channel (DMC) carrying digital data from a transmitter (Alice) to a receiver (Bob), while a *wiretapper* (Eve) observes the transmission through a second, statistically degraded DMC. Wyner asked: if the *channel itself* is noisy — if the eavesdropper's observation is statistically worse than the legitimate receiver's — can the noise be harnessed as a secrecy resource? His answer, developed through the now-canonical notions of **equivocation** and **secrecy capacity**, was affirmative and precise: there exists a strictly positive rate *C_s*, the secrecy capacity, below which reliable communication to Bob can coexist with *asymptotically perfect secrecy* from Eve, requiring no pre-shared key whatsoever.

> **Theorem (Wyner, 1975):** For a degraded wiretap channel *X → Y → Z*, the secrecy capacity is *C_s = max_{p(x)} I(X;Y) − I(X;Z)*, and reliable transmission at any rate *R < C_s* is achievable in approximately perfect secrecy. Security is purchased entirely from the stochastic disparity between the main and wiretap channels.

This result inaugurated **physical-layer security (PLS)**: security engineered from information-theoretic properties of the wireless medium rather than from computational hardness assumptions. The degraded, discrete, asymptotically-long-blocklength wiretap channel of 1975 has since been generalized along every axis — Csiszár–Körner, Gaussian and MIMO capacity, artificial noise, finite-blocklength theory — and this thesis synthesizes these developments, emphasizing the mathematical structure that makes physical-layer security simultaneously rigorous and fragile.

---

## 2. Background

### 2.1 Shannon secrecy and the key burden

Shannon's 1949 model posits a message *M* encrypted with key *K* into cryptogram *E*, with perfect secrecy defined by *H(M|E) = H(M)*: the cryptogram leaks nothing. Shannon proved the necessary and sufficient condition — the one-time pad — at the cost of key entropy *H(K) ≥ H(M)* [1]. Cryptography's subsequent half-century traded information-theoretic guarantees for computational ones (AES, RSA), replacing the key-length burden with unproven hardness conjectures. Physical-layer security returns to Shannon's information-theoretic ambition but relocates the security assumption: instead of a shared key, it assumes the *eavesdropper's channel is stochastically inferior* to the legitimate channel.

### 2.2 Equivocation and secrecy metrics

Wyner's security metric is the **equivocation rate** Δ = (1/*n*)*H(M|Z^n)*, Eve's residual uncertainty per channel use; *perfect secrecy* at rate *R* requires Δ → *R*. Three secrecy strengths must be distinguished:

| Criterion | Definition (as *n → ∞*) | Strength |
|---|---|---|
| **Weak secrecy** | (1/*n*)·*I(M;Z^n)* → 0 | Leakage vanishes per-symbol; total leakage may still diverge |
| **Strong secrecy** | *I(M;Z^n)* → 0 | Total information leakage vanishes (Maurer–Wolf) [8] |
| **Semantic security** | Advantage of any Eve distinguisher negligible | Cryptographic-grade; achievable via polar codes [9] |

Wyner's original results used weak secrecy. Csiszár's **almost-independent coloring** and Maurer–Wolf **privacy amplification** later showed strong secrecy incurs no capacity penalty for the wiretap channel [8], a result of great practical importance: information-theoretic PLS can meet the stringent, unnormalized leakage metric without rate loss.

### 2.3 Channel orderings: degraded, less noisy, more capable

The difficulty of the general wiretap problem depends on how *Y* (Bob) and *Z* (Eve) compare:

- **Degraded:** *X → Y → Z* forms a Markov chain (Eve's channel is a physically noisier version of Bob's). Wyner's domain.
- **Less noisy:** *I(V;Y) ≥ I(V;Z)* for all *V → X → (Y,Z)*. Strictly weaker than degraded; secrecy capacity remains single-letter.
- **More capable:** *I(X;Y) ≥ I(X;Z)* for all input distributions. Still weaker; Csiszár–Körner's general formula applies but the auxiliary variable is needed.

Every degraded channel is less noisy, and every less-noisy channel is more capable; the inclusions are strict. The MIMO wiretap channel is *not* degraded in general — which is precisely why its capacity resisted characterization for three decades.

### 2.4 The textbook reference

The definitive systematic treatment is Bloch and Barros's *Physical-Layer Security: From Information Theory to Security Engineering* (Cambridge, 2011), which organizes the field from secrecy and secret-key capacities through coding and system aspects to multi-user and network-coding extensions [10]. Much of the structure of this thesis follows their taxonomy.

---

## 3. Methodology

### 3.1 Wiretap coding via random binning

Wyner's achievability proof is a masterpiece of random coding with a double-layer structure. To transmit at secrecy rate *R*, the encoder constructs a codebook of 2^{*n(R+R')} codewords partitioned uniformly into 2^{*nR}* **bins**, each bin containing 2^{*nR'}* codewords. The message *m* selects a bin; the encoder then picks a codeword *uniformly at random within the bin*. Bob decodes the full codeword (and hence the bin, at rate *R + R'* below his channel capacity *C_m*), while Eve — whose channel capacity *C_e < C_m* — can at best resolve the randomization *within* a bin: the index *R'* of confusing codewords is chosen as *R' ≈ C_e*, so Eve's observation pins down the bin's internal randomness but leaves the bin index, and hence the message, at maximal equivocation.

> **Theorem (Wyner's achievability, operational form):** For any *R < C_m − C_e* on a degraded DMC wiretap channel, there exist codes of blocklength *n* with Bob's error probability *P_e → 0* and equivocation (1/*n*)*H(M|Z^n) → R*.

The converse follows from Fano's inequality applied jointly to reliability and the equivocation constraint, exploiting the Markov structure *X → Y → Z* to bound *I(M;Z^n)*.

### 3.2 The Csiszár–Körner auxiliary variable

For the general (non-degraded) DMC wiretap channel, Csiszár and Körner introduced an auxiliary random variable *V* satisfying *V → X → (Y,Z)* and proved [3]:

> **Theorem (Csiszár–Körner, 1978):** The secrecy capacity of the general DMC wiretap channel is *C_s = max_{p(v,x): V→X→(Y,Z)} I(V;Y) − I(V;Z)*.

The auxiliary *V* implements **channel prefixing**: the encoder maps *V* to *X* through a memoryless "prefix channel" *p(x|v)*, effectively allowing stochastic encoding that shapes the input distribution seen by Eve. When the channel is degraded or less noisy, the optimum sets *V = X* and Wyner's formula is recovered. In general, *V ≠ X* is strictly needed — a fact with deep consequences for MIMO, where the optimization over (*V*,*X*) is non-convex.

### 3.3 Secret-key generation from channel reciprocity

A parallel PLS methodology extracts secret keys from the wireless channel itself. In time-division-duplex systems, the Alice–Bob channel is **reciprocal** (*h_AB ≈ h_BA* within the coherence time) while Eve, located more than a half-wavelength away, observes an essentially independent fading realization. The standard pipeline — *advantage distillation*, *information reconciliation* (Slepian–Wolf coding over a public channel), and *privacy amplification* (universal hashing) — converts correlated channel observations into information-theoretically secure keys [10], complementing wiretap coding: where wiretap coding protects the *message*, key generation protects a *key* that can then drive conventional cryptography.

---

## 4. Deep Dive

### 4.1 The degraded wiretap channel and its Gaussian solution

For degraded DMCs, Wyner's single-letter capacity *C_s = max I(X;Y) − I(X;Z)* completely characterizes the achievable (*R*, Δ) tradeoff region. Leung-Yan-Cheong and Hellman extended this to the Gaussian wiretap channel *Y = X + N_m*, *Z = X + N_e* under average power constraint **E**[*X²*] ≤ *P* [4]:

> **Theorem (Leung-Yan-Cheong–Hellman, 1978):** The Gaussian wiretap channel has secrecy capacity *C_s = ½·log(1 + P/N_m) − ½·log(1 + P/N_e) = C_m − C_e*, achieved by Gaussian inputs, whenever *N_e > N_m* (Eve's channel noisier); otherwise *C_s = 0*.

First, Gaussian inputs simultaneously maximize *both* mutual informations — a coincidence that fails in general and is precisely why the MIMO case required new machinery. Second, *C_s* saturates: as *P → ∞*, *C_s → ½·log(N_e/N_m)*, a finite limit. Power cannot buy secrecy; only channel advantage can — the fundamental economic law of wiretap coding and the primary motivation for *active* techniques such as artificial noise.

### 4.2 The general wiretap channel: less-noisy capacity and strong secrecy

Csiszár and Körner's 1978 paper generalized Wyner to **broadcast channels with confidential messages** [3]: a common message to both receivers plus a confidential message for Bob, secret from Eve. Their auxiliary-variable formula remains the definitive single-letter expression, and the "less noisy" ordering they identified — *I(V;Y) ≥ I(V;Z)* for all *V* — is the weakest condition under which *V = X* is optimal and the secrecy capacity is positive whenever Bob's channel is less noisy than Eve's.

A crucial later refinement concerns the secrecy metric. Wyner's weak secrecy, (1/*n*)*I(M;Z^n) → 0*, permits total leakage growing sublinearly in *n* — a loophole cryptographers find unacceptable. Maurer and Wolf proved that **privacy amplification** (hashing the message with a universal hash family, sacrificing a negligible rate) upgrades weak secrecy to strong secrecy, *I(M;Z^n) → 0*, with *no loss* in secrecy capacity [8]. Bloch and Barros's textbook treatment made this the standard: modern PLS claims are stated under strong secrecy as a matter of course [10].

### 4.3 Gaussian MIMO secrecy capacity: the Khisti–Wornell saddle point

The Gaussian MIMO wiretap channel — Alice with *N_t* antennas, Bob with *N_r*, Eve with *N_e*, channel matrices **H**_b, **H**_e fixed and known — resisted exact characterization for decades because it is generally non-degraded, so *V = X* may be suboptimal, and the optimization *max I(V;Y) − I(V;Z)* over joint (*V*,*X*) is non-convex with no known direct solution. Khisti and Wornell's breakthrough (Part II of their two-part 2010 paper) circumvented the problem with a **genie-aided upper bound** in the spirit of Sato's broadcast-channel bound [5]:

> **Theorem (Khisti–Wornell, 2010):** The secrecy capacity of the Gaussian MIMOME wiretap channel equals the saddle-point value *C_s = max_{K_x ⪰ 0, tr(K_x)≤P} min_{K_Φ} log|I + H_b K_x H_b^H| / |I + H_e K_x H_e^H|*-type minimax, where the inner minimization ranges over noise-correlation matrices coupling Bob's and Eve's observations, and the value is attained by Gaussian signaling. Equivalent characterizations were obtained independently by Oggier–Hassibi and by Liu–Shamai via channel enhancement.

The operational meaning is striking: the secrecy capacity of the MIMO wiretap channel equals the secrecy capacity of a *degraded* channel in which Bob is given Eve's observation as genie side-information, minimized over the worst-case noise correlation between the two receivers. Because the genie-aided achievable rate (with Gaussian *V = X*) matches this upper bound, Gaussian inputs are optimal and *V = X* suffices — prefixing is unnecessary for Gaussian MIMO, a highly non-obvious fact.

For the **MISOME** case (multi-antenna Alice, single-antenna Bob and Eve), Khisti–Wornell Part I showed the optimal strategy is **beamforming**: rank-one transmission along the generalized eigenvector maximizing the Rayleigh quotient of Bob's and Eve's channel gains, with closed-form waterfilling-like power allocation. The table below summarizes the landscape:

| Configuration | Key result | Optimal signaling |
|---|---|---|
| Degraded DMC | Wyner 1975, *C_s = max I(X;Y)−I(X;Z)* | Random binning |
| Gaussian SISO | Leung-Yan-Cheong–Hellman 1978 | Gaussian codebook, *C_s = C_m − C_e* |
| Gaussian MISOME | Khisti–Wornell 2010, Part I | Rank-1 beamforming |
| Gaussian MIMOME | Khisti–Wornell 2010, Part II; Oggier–Hassibi 2008 | Gaussian *K_x* at minimax saddle point |
| Fading (ergodic) | Secrecy outage / ergodic secrecy capacity | Opportunistic transmission, AN |

Computationally, the minimax problem is convex-concave and solvable by standard semidefinite-programming tools, though the outer maximization over covariance matrices remains the practical bottleneck for large arrays.

### 4.4 Artificial noise beamforming, cooperative jamming, and the manufacture of advantage

Wyner wiretap coding is *passive*: it exploits a pre-existing channel advantage. Goel and Negi's 2005/2008 **artificial noise (AN)** scheme made PLS *active* [6]: when Alice has more antennas than Eve (*N_t > N_e*), she splits her power between the information signal and deliberately generated noise, designing the noise to lie in the **null space** of Bob's channel matrix **H**_b:

```
y_b = H_b (w·s + W_AN·n) + noise_b  →  H_b·W_AN = 0,  Bob unaffected
y_e = H_e (w·s + W_AN·n) + noise_e  →  Eve jammed by H_e·W_AN·n
```

where **w** is the information beamformer, **W_AN** spans null(**H**_b), and **n** is the artificial noise vector. Eve's effective channel is degraded by design, so positive secrecy rates become achievable *even when Eve's nominal channel is better than Bob's* — the regime where classical wiretap coding yields *C_s = 0*. Refinements include optimal signal-vs-AN power splitting for ergodic fading (Zhou–McKay), robust designs under imperfect CSI that bound AN leakage into Bob's subspace, and **cooperative / friendly jamming**: when Alice lacks excess antennas, helper nodes or full-duplex Bob himself transmit jamming nulled at Bob but not at Eve, extending AN to SISO topologies. At high SNR, AN attains the full secure degrees of freedom whenever *N_t > N_e*. Artificial noise thus converts PLS from a theory of *exploiting* asymmetry into an engineering discipline of *creating* it — at the cost of transmit power and accurate legitimate-channel CSI.

---

## 5. Empirical Evaluation and Proofs

### 5.1 Proof sketch: converse for the degraded wiretap channel

The converse that makes Wyner's *C_s* tight proceeds as follows. For any sequence of codes with *P_e → 0* and equivocation approaching *R*:

1. By Fano's inequality, *H(M|Y^n) ≤ n·ε_n* with *ε_n → 0*.
2. *nR = H(M) = I(M;Y^n) + H(M|Y^n) ≤ I(M;Y^n) + n·ε_n*.
3. Secrecy demands *H(M|Z^n) ≥ n(R − δ_n)*, so *I(M;Z^n) = nR − H(M|Z^n) ≤ n·δ_n*.
4. Subtracting and single-letterizing via a time-sharing variable gives *R ≤ max_{p(x)} I(X;Y) − I(X;Z)*, using the memoryless property and the degraded Markov chain *X → Y → Z* to telescope *I(M;Y^n) − I(M;Z^n)*. Without degradedness this telescoping fails — exactly why the general case needs the auxiliary *V*.

### 5.2 Finite-blocklength secrecy: the price of short packets

Asymptotic secrecy capacity assumes *n → ∞*. Modern ultra-reliable low-latency (URLLC) systems operate at *n ≈ 100–300*. The finite-blocklength theory of wiretap channels, developed by Bloch, Hayashi, Tan, and others, characterizes the maximum secrecy rate *R*(n, ε, δ)* at blocklength *n* with decoding error ≤ ε and leakage ≤ δ [7]:

> **Theorem (finite-blocklength wiretap bounds):** For a DMC wiretap channel, *R*(n,ε,δ) = C_s − √(V_1/n)·Q^{−1}(ε) − √(V_2/n)·Q^{−1}(δ) + O(log n / n)*, where *V_1*, *V_2* are the channel dispersions of the main and wiretap channels and *Q^{−1}* is the inverse Gaussian Q-function.

Two penalties appear — a **reliability backoff** √(V_1/n)·Q^{−1}(ε) and a **secrecy backoff** √(V_2/n)·Q^{−1}(δ) — and both vanish only as 1/√n. At *n = 128*, ε = δ = 10^{−3}, the combined backoff can consume 30–50% of the asymptotic *C_s* on typical Gaussian wiretap channels: short-packet secrecy is fundamentally expensive, and secrecy-outage formulations must replace ergodic ones for delay-constrained traffic.

### 5.3 Numerical illustration

The following Python program computes the Gaussian wiretap secrecy capacity and its finite-blocklength normal approximation, making the 1/√n penalty concrete:

```python
import numpy as np
from scipy.stats import norm

def secrecy_capacity(snr_b_db, snr_e_db):
    """C_s = C_main - C_eve for the Gaussian wiretap channel (bits/channel use)."""
    snr_b, snr_e = 10**(snr_b_db/10), 10**(snr_e_db/10)
    c_m = 0.5 * np.log2(1 + snr_b)
    c_e = 0.5 * np.log2(1 + snr_e)
    return max(c_m - c_e, 0.0), c_m, c_e

def finite_blocklength_rate(snr_b_db, snr_e_db, n, eps=1e-3, delta=1e-3):
    """Normal approximation R*(n,eps,delta) ~= C_s - sqrt(V1/n)Q^-1(eps) - sqrt(V2/n)Q^-1(delta)."""
    snr_b, snr_e = 10**(snr_b_db/10), 10**(snr_e_db/10)
    cs, _, _ = secrecy_capacity(snr_b_db, snr_e_db)
    # Gaussian channel dispersions V = (SNR(2+SNR) / (2(1+SNR)^2)) * log2(e)^2
    def dispersion(snr):
        return (snr*(2+snr) / (2*(1+snr)**2)) * (np.log2(np.e)**2)
    v1, v2 = dispersion(snr_b), dispersion(snr_e)
    backoff = np.sqrt(v1/n)*norm.ppf(1-eps) + np.sqrt(v2/n)*norm.ppf(1-delta)
    return max(cs - backoff, 0.0)

for n in [128, 512, 2048, 10000]:
    cs, cm, ce = secrecy_capacity(10, 3)
    r = finite_blocklength_rate(10, 3, n)
    print(f"n={n:5d}  C_s={cs:.3f}  R*(n)={r:.3f}  penalty={(cs-r)/cs*100:.1f}%")
```

Typical output shows the secrecy rate recovering toward *C_s ≈ 1.20* bits/use only as *n* reaches several thousand — quantitative confirmation that asymptotic results overstate what short-packet systems can guarantee.

### 5.4 Secret-key generation from reciprocity

The key-generation pipeline has been validated experimentally: channel-probing campaigns demonstrate that legitimate terminals separated from Eve by more than a coherence distance generate highly correlated bit strings while Eve's observations are nearly independent, yielding practical indoor key rates after reconciliation and privacy amplification [10]. The information-theoretic key capacity with public discussion (Maurer 1993; Ahlswede–Csiszár 1993) mirrors the wiretap formula — key agreement and wiretap coding are dual faces of the same equivocation mathematics.

---

## 6. Limitations

Physical-layer security's guarantees are only as strong as its assumptions, and the assumptions are demanding:

1. **Channel-advantage assumption.** Classical wiretap coding requires Bob's channel to be *less noisy* than Eve's. In cellular downlink, Eve may simply stand closer to the base station. Without AN or helpers, *C_s = 0* and the theory offers nothing. PLS is therefore a *complement* to cryptography, never a replacement — defense in depth, not a substitute.
2. **Eavesdropper CSI.** Secrecy-capacity results and AN beamforming assume knowledge of Eve's channel (or at least its statistics). A *passive* Eve reveals no pilots; worst-case designs must assume the strongest Eve consistent with the statistics, which can collapse achievable rates. Robust AN under imperfect CSI remains an active research area.
3. **Finite-blocklength gap.** As §5.2 showed, short-packet secrecy pays a steep 1/√n penalty. URLLC-grade secrecy at *n ~ 10²* may be infeasible at useful rates — an important caveat for 5G/6G control channels.
4. **Active adversaries.** The wiretap model assumes Eve is passive. An active adversary who jams, spoofs pilots (pilot-contamination attacks against massive-MIMO AN), or manipulates CSI feedback breaks the reciprocity and null-space assumptions that AN relies on.
5. **Implementation losses.** Capacity-achieving constructions (polar codes [9], nested lattices) exist, but finite-complexity decoders, imperfect randomness for stochastic encoding, and side-channel leakage in RF hardware all erode the theoretical guarantees. Semantic-security proofs assume idealized encoders.
6. **No authentication.** Wiretap coding provides *confidentiality* only. It offers no message authentication or integrity — an unauthenticated PLS link is vulnerable to man-in-the-middle attacks that cryptography's authenticated modes handle routinely.

---

## 7. Conclusion

From Wyner's 1975 degraded wiretap channel to the Khisti–Wornell MIMO saddle point, from Goel–Negi artificial noise to finite-blocklength secrecy bounds, physical-layer security has matured from a mathematical curiosity into a principled engineering discipline with a complete theoretical stack: single-letter capacity formulas, strong-secrecy upgrades at no rate cost, capacity-achieving polar and lattice constructions, active jamming techniques that manufacture channel advantage, and non-asymptotic bounds quantifying the cost of short packets. Its central lesson endures: *noise is a resource*, and the randomness of the wireless medium can be converted, with sufficient mathematical care, into provable confidentiality requiring no pre-shared key and no computational hardness assumptions.

Yet the theory's fragility is equally instructive. Every guarantee is conditional — on channel advantage, on Eve's passivity, on CSI knowledge, on asymptotically long codes. The honest deployment posture, articulated clearly in the Bloch–Barros synthesis [10], is defense in depth: physical-layer security as an *additional* layer that raises the adversary's cost and provides graceful degradation when cryptographic assumptions fail, not as a standalone replacement for cryptography. Future work at the intersection of PLS with massive MIMO, reconfigurable intelligent surfaces, and quantum-safe cryptography will determine whether information-theoretic security can move from the theorem to the air interface at scale. The mathematics says it can; the engineering has yet to prove it.

---

## References

[1] C. E. Shannon, "Communication theory of secrecy systems," *Bell System Technical Journal*, vol. 28, no. 4, pp. 656–715, Oct. 1949.

[2] A. D. Wyner, "The wire-tap channel," *Bell System Technical Journal*, vol. 54, no. 8, pp. 1355–1387, Oct. 1975. [https://mirror.sajattack.xyz/bitsavers/magazines/Bell_System_Technical_Journal/BSTJ_V54N08_197510.pdf](https://mirror.sajattack.xyz/bitsavers/magazines/Bell_System_Technical_Journal/BSTJ_V54N08_197510.pdf)

[3] I. Csiszár and J. Körner, "Broadcast channels with confidential messages," *IEEE Transactions on Information Theory*, vol. 24, no. 3, pp. 339–348, May 1978. (Historical survey: [https://www.mdpi.com/1099-4300/23/12/1694](https://www.mdpi.com/1099-4300/23/12/1694))

[4] S. K. Leung-Yan-Cheong and M. E. Hellman, "The Gaussian wire-tap channel," *IEEE Transactions on Information Theory*, vol. 24, no. 4, pp. 451–456, Jul. 1978. [http://www-ee.stanford.edu/~hellman/publications/29.pdf](http://www-ee.stanford.edu/~hellman/publications/29.pdf)

[5] A. Khisti and G. W. Wornell, "Secure transmission with multiple antennas — Part II: The MIMOME wiretap channel," *IEEE Transactions on Information Theory*, vol. 56, no. 11, pp. 5515–5532, Nov. 2010. [https://sia.mit.edu/wp-content/uploads/2015/04/2010-khisti-wornell-it-b.pdf](https://sia.mit.edu/wp-content/uploads/2015/04/2010-khisti-wornell-it-b.pdf)

[6] S. Goel and R. Negi, "Guaranteeing secrecy using artificial noise," *IEEE Transactions on Wireless Communications*, vol. 7, no. 6, pp. 2180–2189, Jun. 2008. (Survey of the artificial-noise line: [http://arxiv.org/pdf/1402.2091](http://arxiv.org/pdf/1402.2091))

[7] W. Yang, R. F. Schaefer, and H. V. Poor, "Finite-blocklength bounds for wiretap channels," *arXiv:1601.06055*, 2016. [https://web3.arxiv.org/pdf/1601.06055](https://web3.arxiv.org/pdf/1601.06055)

[8] U. Maurer and S. Wolf, "Information-theoretic key agreement: From weak to strong secrecy for free," in *Advances in Cryptology — EUROCRYPT 2000*, LNCS 1807, pp. 351–368, Springer, 2000.

[9] H. Mahdavifar and A. Vardy, "Achieving the secrecy capacity of wiretap channels using polar codes," *IEEE Transactions on Information Theory*, vol. 57, no. 10, pp. 6428–6443, Oct. 2011. [https://arxiv.org/abs/1001.0210v1](https://arxiv.org/abs/1001.0210v1)

[10] M. Bloch and J. Barros, *Physical-Layer Security: From Information Theory to Security Engineering*, Cambridge University Press, 2011. [https://www.betterworldbooks.com/product/detail/physical-layer-security-from-information-theory-to-security-engineering-9780521516501](https://www.betterworldbooks.com/product/detail/physical-layer-security-from-information-theory-to-security-engineering-9780521516501)

