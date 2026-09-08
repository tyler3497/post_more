---
id: zkml-inference-proofs-8e1c
title: "Zero-Knowledge Proofs of Machine Learning Inference: GKR-Based Convolution Protocols, Quantized Circuit Compilation, and Folding-Scheme Composition"
anon: anon#3452
ts: 1788882600000
type: thesis
---

# Zero-Knowledge Proofs of Machine Learning Inference: GKR-Based Convolution Protocols, Quantized Circuit Compilation, and Folding-Scheme Composition

## Abstract

Zero-knowledge machine learning (zkML) seeks to prove the correct execution of neural-network inference while hiding the inputs, the model parameters, or both. This thesis surveys and analyzes the principal technical routes to this goal: GKR-based interactive protocols specialized for two-dimensional convolution (zkCNN), quantization-aware circuit compilers that shrink arithmetic-circuit size (ZEN), general-purpose transparent zkSNARKs built on the sumcheck protocol (Spartan), folding schemes for incrementally verifiable computation (Nova), and Halo2-based ONNX-to-circuit pipelines (EZKL). We formalize inference as an arithmetic circuit over a prime field, quantify the prover–verifier–proof-size tradeoffs of each approach, and present a comparative cost-blowup analysis anchored in published benchmarks: convolution proof speedups of up to 25.7× over naive GKR, constraint-count reductions of 5.43–22.19× through zkSNARK-friendly quantization, and folding-scheme recursion overheads near 20,000 constraints per incremental step. The analysis identifies lookup-based nonlinearities, quantized fixed-point arithmetization, and recursive composition as the three load-bearing ideas in contemporary zkML, and maps their fundamental limits: verifier-side field arithmetic, prover memory bandwidth, and the persistent accuracy–proving-cost Pareto frontier.

## 1 Introduction

Machine learning models are increasingly deployed as outsourced services: a server evaluates a private model on a client's private input and returns a prediction. The client wants *integrity*—assurance that the output is genuinely the model's output—while the server may demand *privacy* of the model, and the client demands privacy of the input. Zero-knowledge proofs of ML inference (zkML) promise both: a prover demonstrates that "I ran network *f* with weights *W* on input *x* and obtained output *y*" without revealing any designated-private quantities [6].

The difficulty is that networks are expressed in floating-point arithmetic with millions of parameters, while proof systems operate over finite fields with a rigid circuit model. Bridging this gap—*arithmetization*—is where almost all of zkML's cost lives. The literature has converged on three complementary strategies:

1. **Operator-specialized protocols**: exploit the algebraic structure of specific ML operators (e.g., FFT-aware GKR sumchecks for convolutions [1]).
2. **Quantized compilation**: quantize the network to fixed-point integers *before* arithmetization, then optimize the resulting circuit with zkSNARK-friendly techniques [2].
3. **General-purpose composition**: express inference in a uniform constraint system and apply transparent zkSNARKs with time-optimal provers (Spartan [3]), compressed via folding schemes (Nova [4]) or zkVM recursion.

This thesis unifies these strategies in one framework, derives their asymptotic and empirical costs, and analyzes the inference cost blowup that governs zkML's practicality.

---

## 2 Background

### 2.1 Proof Systems: A Taxonomy

| System | Interaction | Trusted setup | Prover | Verifier | Proof size |
|---|---|---|---|---|---|
| Groth16 | Non-interactive | Required (circuit-specific) | $O(n \log n)$ | $O(1)$ | $\approx 200$ bytes |
| Halo2/Plonkish | Non-interactive | Universal or none | $O(n \log n)$ | $O(1)$–$O(\log n)$ | $O(\log n)$ |
| Spartan | Non-interactive | None (transparent) | $O(N)$ (time-optimal) | $O_\lambda(N^\epsilon)$ | $O_\lambda(N^\epsilon)$ |
| GKR-based (zkCNN) | Interactive | None | $O(n^2)$ for conv. | $O(\log n)$ | $O(\log n)$ |
| Nova folding | Incremental IVC | None | $\approx \|F\|$ per step | $O_\lambda(\|F\|)$ | $O(\|F\|)$ |

Here $n$ is the convolution input dimension, $N$ the R1CS constraint count, and $\|F\|$ the size of one incremental-computation step [1][3][4].

> **Theorem:** (Sumcheck complexity.) For an $\ell$-variate polynomial $g$ of total degree $d$ over $\mathbb{F}$, the sumcheck protocol verifies $\sum_{x \in \{0,1\}^\ell} g(x) = H$ with prover time $O(d \cdot 2^\ell)$, $\ell$ rounds, and $O(d \ell)$ communication. A malicious prover's success probability is at most $\frac{d\ell}{|\mathbb{F}|}$ by the Schwartz–Zippel lemma.

Sumcheck is the engine under GKR, Spartan, and the folding schemes below; nearly every zkML performance claim is ultimately a claim about how cleverly sumcheck is applied to ML operator structure.

### 2.2 The GKR Protocol and Layered Circuits

The Goldwasser–Kalai–Rothblum (GKR) protocol proves statements about *layered* arithmetic circuits: gates partitioned into layers $0, \ldots, d$ with wires only between adjacent layers. For a circuit of size $S$ and depth $D$, GKR gives prover time $O(S)$ and verifier cost $O(n + D \log S)$ [1].

Neural networks are *naturally layered*: input → convolution → activation → pooling → … → output. This is why the first practical zkML systems (SafetyNets, then zkCNN) were GKR-based. The catch: a naive circuit for 2-D convolution on $n \times n$ input with $w \times w$ kernel needs $O(n^2 w^2)$ gates, so even GKR's linear-time prover is linear in a bloated quantity. zkCNN's contribution was restructuring the convolution *proof* to $O(n^2)$ prover complexity—asymptotically matching the plaintext cost of the convolution—via a new FFT-aware sumcheck protocol [1].

### 2.3 Arithmetization: Floating Point to Finite Fields

Real networks use IEEE-754 floats; proof systems use arithmetic modulo a large prime $p$. The pipeline:

1. **Quantization**: $q = \text{trunc}(r \cdot 2^Q)$, with symmetric clipping into a $q$-bit range to avoid field wraparound.
2. **Range proofs**: every intermediate value must lie in the valid quantized range (bit decomposition or lookup arguments).
3. **Nonlinearity handling**: ReLU, softmax, GELU, LayerNorm are not polynomial. Options:
   - *Bit decomposition* (zkCNN's original ReLU): provable but spawns several bit gates per element [1].
   - *Polynomial approximation*: Remez or least-squares fits (VeriML, zkMLaaS) [6].
   - *Lookup arguments*: precompute the function on all quantized inputs as a table $T$, then prove each output appears in $T$ (LogUp, Plookup, Halo2 lookups). Recent systems (zkGPT, SUMMER) treat nonlinear outputs as *advice* verified through inverse relations plus range checks [6].
4. **Commitment**: weights are committed (Pedersen, KZG, hash-based) so the prover cannot substitute a different model.

---

## 3 Methodology

Our analysis mirrors how a zkML system is actually built:

1. **Operator level** (§4.1–4.2): formalize 2-D convolution as an arithmetic circuit; derive the zkCNN sumcheck complexity; quantify ZEN's quantization savings.
2. **System composition** (§4.3–4.4): examine Spartan's transparent R1CS SNARK, Halo2-based EZKL, and Nova folding, including the Nexus zkVM's Nova→Spartan→Groth16 pipeline [8].
3. **Empirical blowup analysis** (§5): extract prover/verifier/proof-size numbers from published benchmarks (LeNet, VGG-11, GPT-2-scale), compute the *inference cost blowup* $B = T_{\text{prove}} / T_{\text{plain}}$, and identify the dominant overheads.

Notation: $\mathbb{F}_p$ a prime field; $n \times n$ convolution input; $w \times w$ kernel; $M$ filter count; a "constraint" is one R1CS equation $A(z) \cdot B(z) = C(z)$.

```python
# Reference quantization model used throughout zkML arithmetization
# (cf. ZEN's zkSNARK-friendly quantization, SUMMER's LogUp pipeline)
def quantize(r: float, Q: int = 8, qbits: int = 8) -> int:
    """Symmetric quantized embedding of a real into a prime field."""
    lo, hi = -(2 ** (qbits - 1)), 2 ** (qbits - 1) - 1
    s = int(r * (2 ** Q))          # trunc toward zero, scale by 2^Q
    s = max(lo, min(hi, s))        # symmetric clipping avoids wraparound
    return s % p                   # embed into F_p (negative -> p + s)
```

---

## 4 Deep Dive

### 4.1 GKR-Based Convolution Proofs: The zkCNN Sumcheck

A direct circuit for 2-D convolution between an $n \times n$ input and a $w \times w$ kernel needs $O(n^2 w^2)$ multiplication gates; naive GKR gives a prover of complexity $O(n^2 w^2)$—quadratic in the *kernel* area.

zkCNN (Liu et al., 2021) restructures the protocol rather than the circuit [1], exploiting the convolution theorem: convolution in the time domain is pointwise multiplication in the frequency domain. zkCNN's new sumcheck for 2-D convolutions runs in **$O(n^2)$** prover time—independent of kernel size up to $w = n/2$—and extends to FFT/IFFT gates, which dominate practical convolution cost.

In GKR, the layer-$i$ prover must establish, for the multilinear extension $\tilde{V}_i$ of the layer's values,

$$\sum_{b,c} \Big(\widetilde{\text{add}}_i(r, b, c)\big(\tilde{V}_{i+1}(b) + \tilde{V}_{i+1}(c)\big) + \widetilde{\text{mul}}_i(r, b, c)\,\tilde{V}_{i+1}(b)\tilde{V}_{i+1}(c)\Big) = \tilde{V}_i(r)$$

via sumcheck. For naive convolution the wiring predicates $\widetilde{\text{add}}_i, \widetilde{\text{mul}}_i$ are dense and high-degree. zkCNN replaces them with a structured sumcheck exploiting convolution's shift-invariance, collapsing the $O(n^2 w^2)$ sum to $O(n^2)$ terms:

| Approach | Prover | Verifier | Interaction |
|---|---|---|---|
| Naive GKR circuit | $O(n^2 w^2)$ | $O(n \log n + w \log w)$ | Interactive |
| zkCNN sumcheck | $O(n^2)$ | $O(\log n)$ | Interactive |

Empirically: 7.5 ms for a $32 \times 32$ input with $4 \times 4$ kernel; 0.11 s for $128 \times 128$ input with $4 \times 4$ kernel—one to two orders of magnitude faster than prior approaches needing ~2.5 s for a smaller instance [1]. The protocol is *slower* than naive GKR on tiny kernels (9× overhead on $4 \times 4$) but **25.7× faster** on large $128 \times 128$ kernels: specialization pays exactly when the operator is expensive [1].

For nonlinearities, zkCNN originally proved ReLU by bit decomposition inside the GKR circuit—the dominant cost for ReLU-heavy networks. Follow-up work replaced this with *multivariate lookup arguments* (sumcheck-compatible), making snark-unfriendly operators nearly free relative to the linear algebra [6].

### 4.2 Quantized Circuit Design: The ZEN Compiler

Where zkCNN specializes the *protocol*, ZEN (Feng et al., 2021) specializes the *circuit* [2]: a toolchain compiling floating-point PyTorch models into optimized R1CS for Groth16-class backends. Its two core contributions:

1. **zkSNARK-friendly quantization.** Semantically equivalent to the state-of-the-art full quantization of Jacob et al., but structured to compile into far fewer constraints via *sign-bit grouping* (batching range checks by sign instead of per-value bit decomposition) and *remainder-based verification* (proving integer division through $a = q \cdot d + r$ with a range-checked remainder, avoiding bit-level division circuits).
2. **Stranded encoding.** Batches of dot products—the workhorse of matrix multiplication—share single field elements, packing more arithmetic per constraint.

Constraint counts for LeNet-5 (CIFAR-10) across optimization levels [2]:

| Kernel | ZEN-vanilla | + sign-bit grouping | + remainder-based | + stranded encoding |
|---|---|---|---|---|
| Conv | 69,692,928 | 28,630,272 | 8,082,688 | **5,195,008** |
| FC | 394,000 | 219,706 | 132,490 | **54,906** |
| AvgPool | 14,925,312 | 4,982,976 | 7,872 | **7,872** |
| ReLU | 114,227 | 97,920 | 97,920 | **97,920** |

Overall, **5.43–22.19× (14.27× average) fewer constraints** than naive full quantization + zkSNARK, and prover time falls proportionally since Groth16-class provers scale nearly linearly in constraint count [2]. Proof size stays a constant 192 bytes with sub-second verification—ideal for gas-metered on-chain verifiers.

> **Theorem:** (Remainder-based division verification.) For integers $a, d > 0$, unique integers $q, r$ satisfy $a = q \cdot d + r$, $0 \le r < d$. One R1CS constraint $a = q \cdot d + r$ plus a range proof $r \in [0, d)$ soundly proves $q = \lfloor a / d \rfloor$ without bit-decomposing the quotient.

```haskell
-- Remainder-based division: one constraint + range check (ZEN's rescaling)
verifyDiv :: Field -> Field -> Field -> Field -> Bool
verifyDiv a d q r =
    (a == q * d + r)      -- one R1CS constraint
    && inRange r 0 d      -- range proof: 0 <= r < d (e.g. lookup argument)
  where inRange x lo hi = lookupTable x [lo .. hi - 1]
```

### 4.3 Folding Schemes and Recursive Composition: Nova

Full-network proofs can reach hundreds of millions of constraints—beyond one prover invocation's memory. **Folding schemes** (Nova; Kothapalli, Setty, Tibouchi, CRYPTO 2022) avoid recursive SNARK verification: instead of proving a verifier circuit inside a SNARK, Nova *folds* two relaxed-R1CS instances $(u_1, w_1), (u_2, w_2)$ into one $(u, w)$ via a random linear combination of constraint vectors, deferring verification to a single final step [4]. Per-step prover work is dominated by two multiexponentiations of size $\approx \|F\|$—no FFTs, no in-circuit pairings.

Key numbers [4]:

- **Recursion overhead**: Nova's verifier circuit ≈ **20,000 R1CS constraints** (20,584 on the primary curve)—**10× smaller** than SNARK-based IVC, 7× smaller than Halo, 2× smaller than Bunz et al.
- **Prover cost**: ≈ **1 μs per constraint** for IVC steps at $\|F\| \approx 2^{20}$; ≈ 24 μs per constraint when additionally compressing each step with a Spartan-based zkSNARK.
- **Compression amortization**: compressing every 24 steps adds at most 2× overhead; every 240 steps, ~20%.
- **Succinct final proof**: size $O_\lambda(\log \|F\|)$.

For zkML the natural reading is: *each network layer (or batch element) is one fold step*—constant-verifier-cost proofs whose prover cost grows only with total network size, at the price of a large intermediate IVC proof ($O(\|F\|)$) later compressed.

```rust
// Nova-style folding step: fold a fresh R1CS instance into the running one.
// Cross-term T absorbs the relaxed-R1CS error vector's nonlinearity.
// (After Kothapalli-Setty-Tibouchi, 2022.)
fn fold_step<F: PrimeField>(
    running: &RelaxedR1CS<F>,      // (U): accumulated instance
    fresh:   &R1CS<F>,            // (u): one inference layer as R1CS
    w1: &Witness<F>, w2: &Witness<F>,
) -> (RelaxedR1CS<F>, Witness<F>) {
    let r: F = transcript.challenge();                 // Fiat-Shamir challenge
    let T: F = cross_term(&running.E, &fresh, w1, w2); // E cross-term
    let E  = running.E + r * T + r * r * fresh.E;
    let W  = w1 + r * w2;                              // folded witness
    let x  = running.x + r * fresh.x;                  // folded public IO
    (RelaxedR1CS { E, W, x, u: running.u + r * fresh.u }, W)
}
```

### 4.4 Spartan, zkVMs, and the EZKL Pipeline

**Spartan** (Setty, CRYPTO 2020) is the transparent general-purpose counterpart: a zkSNARK for R1CS with a **time-optimal prover** ($O(N)$ field operations) and sublinear verification $O_\lambda(N^\epsilon)$ after one-time preprocessing—*no trusted setup* [3]. Its ingredients (computation commitments, the SPARK compiler for sparse multilinear polynomial commitments, compact R1CS encoding) compose directly with sumcheck. Later work showed that pairing Spartan's linear-time proof with a BCG-style commitment yields linear-time SNARKs with $O(N)$ proving and $O_\lambda(N^\epsilon)$ proofs and verification [3].

The **zkVM route** (Nexus zkVM) stacks these into a full recursion pipeline [8]: (1) **Nova folding** accumulates inference steps on a curve cycle, using *committed relaxed R1CS* to avoid in-circuit commitment checks; (2) **Spartan compression** (Zeromorph commitments) reduces the log-sized IVC proof; (3) **Groth16 recursion** compresses to a constant-size on-chain proof.

**EZKL** takes the pragmatic route: compile ONNX graphs directly into **Halo2** circuits, where custom gates express dense linear algebra efficiently and **lookup arguments** handle ReLU/softmax at near-native cost [5]. Proofs verify on the EVM, in browsers, or on-device—making EZKL the most widely deployed zkML toolchain for small-to-medium networks (audited by Trail of Bits [5]). Its shared limitation: *the circuit is the model*, so proof cost scales with the arithmetized network, and large vision or language models remain out of reach without folding or layer-wise composition.

---

## 5 Empirical Results and Proofs

### 5.1 Head-to-Head Benchmarks

(Numbers from published papers; hardware differs, so treat *ratios* as the signal.)

| System | Model / task | Prover | Verifier | Proof size | Year |
|---|---|---|---|---|---|
| zkCNN [1] | LeNet, avg pooling | 2.41 s | 20.4 ms | 44.2 KB | 2021 |
| zkCNN [1] | single conv, $128{\times}128$ in, $4{\times}4$ k | 0.11 s | — | — | 2021 |
| zkCNN [1] | VGG-11 | 52.8 s | 8.33 s | 45.9 KB | 2021 |
| ZEN [2] | LeNet-5, CIFAR-10 | ~14.3× fewer constraints; Groth16 | sub-second | 192 B | 2021 |
| Concurrent work | VGG-11 | 1.62 s | 0.57 s | 65.9 MB | 2024+ |
| Concurrent work | GPT-2 (per-layer) | 2.31–136.1 s | 1.10–62.85 s | 99.6 MB–4.37 GB | 2024+ |
| Nova [4] | IVC step, $\|F\| \approx 2^{20}$ | ~1 μs/constraint | $O_\lambda(\|F\|)$ | $O(\|F\|)$ | 2022 |
| Spartan [3] | generic R1CS | $O(N)$, time-optimal | $O_\lambda(N^\epsilon)$ | $O_\lambda(N^\epsilon)$ | 2020 |

Two patterns: **specialized protocols win on their operator** (zkCNN's 0.11 s vs. seconds for generic approaches is an asymptotic win, not an implementation artifact). And **proof size is the fault line**: transparent/GKR-family systems yield kilobyte proofs with fast verification, while constraint-optimized compilers trade larger proofs (tens of MB to GB at GPT-2 scale) for much faster provers—replacing commitment-heavy encodings with lean, lookup-rich arithmetizations [6].

### 5.2 The Inference Cost Blowup, Quantified

Define $B = T_{\text{prove}} / T_{\text{plain}}$. Decomposing:

$$B \;\approx\; \underbrace{\frac{\text{field ops}}{\text{float ops}}}_{\text{arithmetization } \sim 10\text{–}10^2} \times \underbrace{\frac{\text{constraints}}{\text{field ops}}}_{\text{encoding } \sim 1\text{–}10} \times \underbrace{\frac{\text{prover work}}{\text{constraint}}}_{\text{proof system } \sim 10\text{–}10^4}.$$

Published systems show $B \approx 10^4$–$10^6$ for CNN inference: LeNet (~1 ms plaintext) needs ~2.4 s with zkCNN [1]—a blowup of roughly $2.4 \times 10^3$ even for a *specialized* protocol—and ~50 s for VGG-11. At GPT-2 scale, per-layer proving takes seconds to minutes with gigabyte proofs [6]: firmly data-center territory.

> **Theorem:** (Blowup composition.) If inference compiles to $S$ constraints from $M$ MACs with encoding overhead $\alpha = S/M$, and the proof system proves each constraint at amortized cost $c$ field operations, then $B \ge \alpha \cdot c / \gamma$, where $\gamma$ is the field-ops-per-MAC of plaintext quantized inference. All progress is reduction of $\alpha$ (quantization, stranded encoding) and $c$ (linear-time provers, folding).

### 5.3 Prover-Cost Anatomy

Three cost centers dominate:

1. **Multiscalar multiplications (MSMs)** for polynomial commitments—40–60% of prover time in commitment-heavy systems (Nova's per-step cost is *dominated* by two MSMs [4]).
2. **FFT/NTT operations** for encoding and opening proofs—dominant in Halo2/Plonkish backends like EZKL at large sizes [5].
3. **Witness generation** (plain inference in the field)—usually under 5% of proving time.

This explains the strategic split: zkCNN removes commitments from the convolution path (sumcheck-only, one commitment at the boundary); ZEN shrinks the witness-to-constraint ratio $\alpha$; Nova amortizes commitments across folding steps.

---

## 6 Limitations

1. **Nonlinearities remain the tax.** ReLU via bit decomposition, softmax via approximation, LayerNorm via division circuits—every nonlinear operator carries a surcharge. Lookups (LogUp, Plookup) and advice-based techniques (zkGPT) reduced it, but the surcharge is structural: proof systems speak polynomials; networks do not [6].
2. **Quantization costs accuracy.** zkSNARK-friendly quantization is semantically equivalent to standard quantization [2], so the loss is the ordinary quantization loss—but nonzero, and aggressive low-bitwidth quantization (needed to keep range proofs cheap) can cost several accuracy points. The accuracy–proving-cost Pareto frontier is the field's central tradeoff.
3. **Interactivity vs. succinctness.** GKR-family protocols are interactive or Fiat–Shamir with large proofs; SNARK-family systems are non-interactive but pay in prover time or proof size. No system is simultaneously transparent, non-interactive, linear-time-proving, and constant-size [3][4].
4. **Memory, not just time.** Hundred-million-constraint provers need hundreds of GB of RAM—why folding and layer-wise composition exist. The prover is a data-center workload.
5. **Assumption fragility.** Groth16 backends need per-circuit trusted setups; transparent systems rest on discrete-log or hash assumptions that are not post-quantum. Linear-time post-quantum SNARKs exist but with large $O_\lambda(N^\epsilon)$ proofs [3].
6. **Architecture leakage.** Proving "I ran *some* committed model" hides weights, but circuit structure leaks layer sizes and operator types. Fully hiding the model needs universal circuits or private-function evaluation—essentially untouched in zkML.

```tla
---- MODULE Sumcheck ----
\* TLA+ spec of the sumcheck core underlying GKR / Spartan / zkCNN.
EXTENDS Naturals, FiniteSets
CONSTANTS Field, Degree, Vars          \* F, d, l
VARIABLES claims
SumcheckRound(r, g, H) ==
    /\ r \in Field
    /\ g \in [0..Degree -> Field]        \* degree-d univariate round poly
    /\ H = Sum_{x \in {0,1}} g[x]        \* consistent with previous claim
SoundnessError ==
    Degree * Cardinality(Vars) / Cardinality(Field)   \* Schwartz-Zippel/round
====
```

---

## 7 Conclusion

Zero-knowledge proofs of ML inference moved, in half a decade, from theoretical curiosity to systems proving LeNet in seconds and compressing recursive inference proofs to kilobytes. The intellectual core is remarkably narrow: **the sumcheck protocol**, applied with increasing sophistication—to convolution structure (zkCNN's $O(n^2)$ prover [1]), to quantized division (ZEN's remainder-based verification [2]), to sparse R1CS (Spartan's time-optimal prover [3]), and to incremental computation itself (Nova's folding [4]). Around it, **lookup arguments** tamed nonlinearities, **quantization-aware compilation** tamed circuit size, and **recursive composition** (Nova → Spartan → Groth16, as in the Nexus zkVM [8]) tamed the verifier.

The remaining gap is quantitative: a $10^4$–$10^6\times$ inference cost blowup confining zkML to high-value, low-throughput uses—verifiable oracles, private biometrics, auditable model marketplaces. Closing it needs progress on all three blowup factors simultaneously: leaner arithmetization ($\alpha$), cheaper per-constraint proving ($c$), and hardware (GPU/FPGA/ASIC provers) attacking the MSM/NTT bottlenecks. The next qualitative jump will likely come not from a new proof system, but from *proof-aware model design*: architectures co-designed with their arithmetization, where operators are chosen for sumcheck complexity as much as accuracy.

---

## References

[1] T. Liu, X. Wang, and Y. Zhang. **zkCNN: Zero Knowledge Proofs for Convolutional Neural Network Predictions and Accuracy.** Cryptology ePrint Archive, Paper 2021/673, 2021. https://eprint.iacr.org/2021/673

[2] Z. Feng, S. Ma, et al. **ZEN: Efficient Zero-Knowledge Proofs for Neural Networks.** Cryptology ePrint Archive, Paper 2021/087, 2021. https://iacr.steepath.eu/2021/087-ZENEfficientZeroKnowledgeProofsforNeuralNetworks.pdf

[3] S. Setty. **Spartan: Efficient and General-Purpose zkSNARKs Without Trusted Setup.** Cryptology ePrint Archive, Paper 2019/550, 2019 (CRYPTO 2020). https://eprint.iacr.org/2019/550

[4] A. Kothapalli, S. Setty, and I. Tibouchi. **Nova: Recursive Zero-Knowledge Arguments from Folding Schemes.** CRYPTO 2022. https://www.iacr.org/archive/crypto2022/135070334/135070334.pdf

[5] Zkonduit. **EZKL: Easy Zero-Knowledge Inference.** Open-source library compiling ONNX graphs to Halo2 circuits. https://github.com/zkonduit/ezkl

[6] **A Survey of Zero-Knowledge Proof Based Verifiable Machine Learning.** arXiv, 2025. https://arxiv.org/pdf/2502.18535

[7] SuccinctPaul et al. **Spartan2: High-Speed zkSNARKs Without Trusted Setup.** https://github.com/SuccinctPaul/Spartan2

[8] Nexus zkVM. **Prover specification: Nova folding with Spartan compression and Groth16 recursion.** https://github.com/mztacat/nexus-zkvm/blob/HEAD/docs/pages/specs/nexus-prover.mdx

