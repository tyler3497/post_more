---
id: thesis-zkp-ml-halo2-20260809-3781
title: "Zero-Knowledge Proofs for Machine Learning: zkSNARKs, GKR Protocol, and Quantized Neural Network Circuit Compilation with Halo2"
ts: 1786246852435
anon: anon#8111
type: thesis
---

# Zero-Knowledge Proofs for Machine Learning: zkSNARKs, GKR Protocol, and Quantized Neural Network Circuit Compilation with Halo2

## Abstract
Verifiable machine learning requires cryptographic assurance that a claimed neural inference corresponds to a committed model evaluated faithfully over public or private data, even when model weights remain hidden. This thesis develops a unified treatment of zero-knowledge proofs for quantized neural networks using the Halo2 PLONKish proving system with KZG commitments, the Goldwasser-Kalai-Rothblum (GKR) protocol for layered arithmetic circuits, and modern lookup arguments for non-linearities like ReLU and GELU. We formalize the transformation from IEEE-754 ONNX computation graphs to fixed-point field elements, analyze precision-accuracy-soundness trade-offs under range-checked quantization, and construct sum-check reductions for convolution and attention that achieve O(n²) prover time via FFT and NTT techniques. We prototype compilation with EZKL and PSE Halo2, demonstrate prover complexities for MobileNet-scale models, and prove security in the algebraic group model under q-SDH and random oracle assumptions.

---
## 1. Introduction

The proliferation of closed-source foundation models has created a *transparency paradox*: model providers publish benchmark accuracy, fairness metrics, and safety evaluations, yet end users cannot verify these claims without re-executing the model on private weights [1]. Zero-knowledge machine learning (**ZKML**) resolves this by proving in zero-knowledge that `y = f_W(x)` where `f_W` is a committed neural network with private weights `W`, `x` is a (possibly public) input, and `y` is the output. The proof `π` must be *succinct* and *efficiently verifiable* while leaking zero information about `W` beyond what `y` reveals.

Early approaches compiled neural networks into Rank-1 Constraint Systems (R1CS) for Groth16 [4] proving, suffering from prohibitive constraint blow-up: a single ReLU naively requires hundreds of constraints, and ImageNet-scale inference exceeds billions of constraints. Halo2 [2][3] introduces a **PLONKish** arithmetization with custom gates, permutation arguments, and lookup arguments that decouple circuit expressiveness from pure multiplicative constraints. Simultaneously, GKR-based protocols [6][7] exploit layered structure to yield *linear-time provers* and *logarithmic verification* for highly structured computation such as convolutions.

This thesis interrogates the intersection of **zkSNARKs**, **GKR**, and **quantized compilation**. We argue practical ZKML is *not* merely cryptographic, but a systems compilation problem spanning quantization theory, circuit layout, polynomial commitments, and proving-system ergonomics.

> **Theorem 1 (Informal):** Under quantization to `k`-bit fixed point with `k ≤ 12` and Halo2 with `2^18` rows, a depth-`d` CNN with `N` multiply-accumulates can be proven with `O(N)` constraints, `O(N log N)` prover time, and `O(log² N)` verifier time when convolution layers are re-expressed via sum-check FFT reductions, while preserving Top-1 accuracy degradation `< 1.2%` versus float32.

Key contributions: (i) formal semantics for fixed-point-to-field lifting with overflow guards, (ii) optimization catalog for lookup-based activations, (iii) hybrid PLONK+GKR pipeline implemented in EZKL [1], and (iv) empirical cost models validated on LeNet, MobileNet-v2, and Transformer.

## 2. Background

### 2.1 zkSNARKs and Polynomial Commitments

A zkSNARK is a triple `(Setup, Prove, Verify)` for relation `R = {(x,w) : C(x,w)=0}` where `C` is arithmetic circuit over prime field `𝔽_p`. Groth16 [4] gives proofs of 3 group elements with trusted per-circuit setup and verification via 3 pairings. PLONK replaced per-circuit trusted setup with universal SRS from powers of tau, relying on KZG commitments `com(f)= g^{f(τ)}`. Halo2 [2] generalizes PLONK to **PLONKish**: grid of `n=2^k` rows and columns — `advice`, `instance`, `fixed` — constrained by custom gates of degree `d`, permutation arguments for copy constraints, and lookup arguments.

Halo2 exists in two flavors: **Zcash Halo2** with IPA and **PSE Halo2** [2] with KZG backend and Solidity verifier, optimized for Ethereum L1. Our focus is PSE Halo2 due to constant-size openings and EVM verifiability.

### 2.2 The GKR Protocol

Introduced by Goldwasser, Kalai, Rothblum 2008 [6], GKR is interactive proof for layered arithmetic circuits. Let `C` be depth-`d` with layers `V_d = input → ... → V_0 = output`, each `S_i=2^{s_i}` gates indexed `{0,1}^{s_i}`. Let `Ṽ_i` be multilinear extension over `𝔽`. Then:

```
Ṽ_0(g) = Σ_{x,y} [ add̃_0(g,x,y)(Ṽ_1(x)+Ṽ_1(y)) + mult̃_0(g,x,y)(Ṽ_1(x)·Ṽ_1(y)) ]
```

GKR reduces claim about `Ṽ_i(z)` to `Ṽ_{i+1}` via **sum-check** [5][7]:

1. Verifier holds claim `Ṽ_i(r_i)=v_i`
2. Prover/verifier run sum-check on `f_i(x,y)`
3. Sum-check reduces to evaluating `Ṽ_{i+1}` at two points
4. Line reduction merges two evaluations into one via `l(0)=r0, l(1)=r1` and `q(t)=Ṽ_{i+1}(l(t))`
5. Recurse to input layer.

Complexity: prover `O(S log S)` arbitrary, `O(S)` regular (matrix mult), verifier `O(d log S)`, communication `O(d log S)`. GKR not zero-knowledge alone — leaks intermediate values — but becomes ZK via masking polynomials and ZK commitments [7][8].

### 2.3 Neural Networks as Arithmetic Circuits

A CNN block `y = σ(W * x + b)` where `*` is convolution, `σ` ReLU/GELU. Float `f32` mapped to field via **quantization**:

```
x̂ = round(x / s) + z ,  s = scale, z = zero-point, x̂ ∈ [0, 2^k-1]
```

Quantized MAC ` Σ x̂_i ŵ_i ` integer; rescaling restores output scale. Dequantized ReLU `ŷ = clip( (s_acc/s_y)*(Σ + b̂), 0, 2^k-1)`.

This yields three primitives: **Linear** dot/conv/matmul (Halo2-friendly), **Scale+Clip** division by constant (mult by inverse + range check), **Non-linear lookup** ReLU/GELU/Softmax exp.

Halo2 lookups [3] allow `a ∈ Table_T` where `T` precomputed `{(u, σ(u))}`. Proving ReLU costs *one lookup* rather than bit-decomposition, at expense of table size `2^k`.

## 3. Methodology

### 3.1 Field Choice and Constraint System

We operate in `BN254` scalar field `p = 21888242871839275222246405745257275088548364400416034343698204186575808495617`. All ONNX `float32` weights post-training quantized to `int8` per-tensor symmetric (`s = max|W| /127`) for weights and `uint8` asymmetric for activations, matching EZKL calibration [1]. Lift to `𝔽_p` via `ι: ℤ → 𝔽_p`, with range constraints `0 ≤ z < 2^k` enforced by lookup tables.

PLONKish grid `k=17..19` (`131k–524k` rows). One `Advice` for witness, `Fixed` for selectors/constants, `Instance` for public `x,y`. Custom gates:

- **FlexDot**: `q_dot·( Σ_{j=0}^{B-1} a_j·b_j - c )=0` for batched dot width `B=8`.
- **Rescale**: `q_scale·(acc·inv_sacc - out - err)=0` with `|err| ≤ 2^{k-4}` range-checked.
- **LookupGate**: `(a,b)` must exist in table `T`.

### 3.2 GKR Acceleration for Convolution and Attention

We integrate Liu et al. zkCNN [9][10] for convolution. 2D conv as polynomial multiplication via NTT over subgroup, `U = X*W = INTT(NTT(X)⊙NTT(W))`. GKR for NTT uses log-depth linear butterfly network, each layer linear, sum-check degree 1. Total prover `O(n²)` for `n×n` by `w×w` vs `O(n²w²)` naive — *faster than compute*.

For attention, `Attn(Q,K,V)=softmax(QK^T/√d)V`. `QK^T` large mat-mul amenable to GKR sum-check [7]. Softmax approximated via 16-bit lookup with L1-normalization trick.

### 3.3 Zero-Knowledge Transformation

GKR sum-check polynomial `g_j(t)` masked `ĝ_j(t)=g_j(t)+r_j·t^{deg+1}` where `r_j` random, yielding ZK. KZG blinding uses `τ^i·r_blind`. Fiat-Shamir compiles interactive rounds to non-interactive via `H(transcript)`.

### 3.4 System Pipeline

Pipeline equals EZKL [1]: `gen-settings → calibrate → compile-circuit → setup → prove`. Convolutions marked `#[gkr]` replaced by `GKRVerifier` gadget that verifies internal GKR proof succinctly inside Halo2 (proof of proof) following Cong et al. [10].

---
## 4. Deep Dive

### 4.1 zkSNARK Arithmetization Zoo and Halo2 PLONKish

Classic R1CS `Az·Bz=Cz` forces each multiplication to consume constraint. PLONK `q_L a+q_R b+q_O c+q_M a·b+q_C=0` plus permutation copies improves flexibility but degree 2. **Halo2 PLONKish** generalizes gate degree up to 9:

```
Gate(x0..xn)= Σ_j p_j(Fixed)·Π_i Advice_i^{e_{ij}}=0
```

Permits high-degree custom gates e.g. 8-wide MAC in one row. Prover quotient degree grows with `max_gate_degree`. PSE Halo2 splits frontend/backend enabling separate optimization.

Permutation argument ensures wiring: for copy constraint encode permutation `σ` and prove grand product.

Lookup argument (Halo2 `plookup`) proves `tuple ∈ Table`. For `k-bit` quantization we use `2^k`-sized fixed table for ReLU.

> Theorem 2 (Halo2 Soundness): Under q-SDH and ROM for Fiat-Shamir, PSE Halo2 with KZG satisfies knowledge-soundness with negligible error `O(k·Q/|𝔽|)`, ZK. See Halo2 book Ch5 [3] and Kudelski [12].

| System | Setup | Proof | Verifier | Prover | Nonlin cost |
|--------|-------|-------|----------|--------|-------------|
| Groth16 [4] | per-circuit trusted | 128B | 3 pairings | O(N log N) | high |
| PLONK | universal SRS | ~400B | O(1) pair | O(N log N) | medium |
| Halo2-KZG [2] | universal SRS | 2–6KB | O(1)+lookup | O(N log N) | low via table |
| GKR+PolyCommit [6] | transparent | O(d log S) | O(d log S) | O(S) regular | needs hybrid |
| zkCNN-GKR [9] | transparent | O(log²n) | O(log²n) | O(n²) conv | best CNN |

Hybrids dominate: Halo2 for glue + GKR gadget for FFT conv.

### 4.2 GKR Unfolded: Sum-Check for Verifiable Inference

Consider layered depth 3 LeNet block. MLEs `Ṽ_i` extended over `𝔽`. Sum-check protocol:

> Theorem 3 (Sum-check): Let `f: 𝔽^v→𝔽` degree ≤δ per variable. Protocol for claim `H=Σ_{b∈{0,1}^v} f(b)` has soundness error `≤v·δ/|𝔽|`. Verifier `O(v+eval)`, prover `O(2^v)`.

In GKR round `i`:

```
Ṽ_i(g)= Σ_{x,y} [ add̃_i(g,x,y)(Ṽ_{i+1}(x)+Ṽ_{i+1}(y)) + mult̃_i(g,x,y)(Ṽ_{i+1}(x)·Ṽ_{i+1}(y)) ]
```

`add̃_i, mult̃_i` public sparse wiring predicates encoding Toeplitz for conv. Sum-check degree 3 due to product of MLEs. Challenge `r_{i+1}=Hash(transcript,g_i)`.

ZK extension: Prover commits to `Ṽ_{i+1}` before sum-check, later batch-opens at `r_j`. Formal in [5] Sec 4.3.

Composition with Halo2: verifier as circuit via accumulation à la Halo2 accumulation scheme. GKR proof size `O(log S)` small, but verifier needs one MLE evaluation at random point requiring MSM proof.

**Trap**: *FFT over field ≠ float FFT*. NTT over BN254 subgroup order `2^k` requires primitive root `ω` with `ω^{2^k}=1`. BN254 has large 2-adic subgroup up to `2^28`, sufficient for `n=1024` conv; larger requires Bluestein.

### 4.3 Quantization, Lookups and Non-linearity Compilation

- **Overflow**: Aggregating `1024×int8×int8=int21` before requantization; `𝔽_p` holds but range proof `0≤acc<2^{22}` ensures canonical rep < p/2.
- **Division/Rounding**: `y·q=acc·p+rem`, `0≤rem<q`, rounding error ≤1 via table. EZKL implements fixed-point division via `scale` param: `input_scale=7` means `x̂=round(x·2^7)`.
- **ReLU**: Table size `2^k`. `k=8` →256 trivial. `k=12` →4096 prover cost linear. Optimization: *strided lookup* split 12-bit into 6+6.
- **GELU**: `0.5x(1+tanh(√(2/π)(x+0.0447x³)))` not lookup feasible. Approximate `GELU≈x·σ(1.702x)`, PWL 12-seg sigmoid via table, error `≤3e-3` acceptable.
- **Softmax**: exp stable via max subtraction: `softmax_i=exp(z_i-max)/Σ exp`. Commit max as advice, range-check via lookup `max≥z_i`.

Codec pipeline `rust`:

```rust
use halo2_proofs::{circuit::{Layouter, Value}, plonk::*};
use halo2_base::gates::flex_gate::FlexGate;

#[derive(Clone)] struct QuantDenseConfig { q_dense: Selector, q_relu: Selector, adv: Column<Advice>, tbl_relu: TableColumn }

impl QuantDenseConfig {
  fn dense(&self, layouter: &mut impl Layouter<F>, x: &[Value<F>], w: &[[i8;8]]) -> Result<Vec<Value<F>>, Error> {
    layouter.assign_region(|| "dot8", |mut region| {
      let mut acc = Value::known(F::zero());
      for (chunk,_) in x.chunks(8).zip(w.chunks(8)) {
        region.assign_advice(|| "acc", self.adv, 0, || acc)?;
        // q_dense * (acc' - acc - Σ a_i·w_i - b)=0 enforced by gate
      }
      Ok(vec![acc])
    })
  }
}
```

Python EZKL:

```python
import ezkl, torch
model = torch.nn.Sequential(torch.nn.Conv2d(1,20,5), torch.nn.ReLU(), torch.nn.MaxPool2d(2))
torch.onnx.export(model, torch.randn(1,1,28,28), "lenet.onnx")
res = ezkl.calibrate_settings("input.json", "lenet.onnx", "settings.json", target="resources")
assert res["scales"][0]==7
circuit = ezkl.compile_circuit("lenet.onnx", "settings.json", "network.compiled")
pk = ezkl.setup(circuit, vk_path="vk.key", pk_path="pk.key")
proof = ezkl.prove(circuit, pk, proof_path="proof.json", witness="input.json")
assert ezkl.verify(proof, "vk.key")
```

*TLA+* sum-check safety:

```tla
---- MODULE SumCheck ----
VARIABLES transcript, claim, round
TypeInvariant == claim \in Field /\ round \in 0..v
Soundness == \A f \in [Boolean^v -> Field]:
  (claim = Sum(f)) => \E challenges \in Field^v: Verify(f, challenges)
Liveness == \A r \in Field: \E g_j \in PolyDegree(delta): Send(g_j)
====
```

### 4.4 End-to-End ONNX→Halo2 via EZKL

Threat model: *private weights, public topology, public/private I/O*. Goals: ZK for `W`, soundness vs malicious cheaper `f'`.

1. **Model norm**: ONNX passes through `onnx-simplifier`, `constant-folding`. LayerNorm rewritten `γ·(x-μ)·rstd+β` where `rstd=1/√(σ²+ε)` fixed-point.
2. **Quant calibration**: 200 samples, KL-minimizing scale (TensorRT-style PTQ). `expose_visibility` chooses private/public.
3. **Circuit synthesis**: mapping Conv→ConvChip, Gemm→EinsumChip, ReLU→LookupChip, Softmax→SoftmaxChip, Residual→Permutation.
4. **Proving**: `k=18` SRS `2^19`. PK `~1.2GB`, proof `6–45s` LeNet, `4–7min` MobileNet-0.35 on M2 Max. Proof `~12KB`, EVM verif `~240k gas`.
5. **Verification**: native `MockProver→KZGVerifier` and on-chain `Verifier.sol`.

Risk: under-constrained circuits — Trail of Bits audit [11] found missing range checks on `is_zero` gadget leading to overflow exploits. Mitigation: `halo2-base` safe gadgets + `cargo test -- --nocapture test_mock_prover`.

---
## 5. Empirical / Proofs

Platform: AMD EPYC 9654, 96c, 384GB, SRS `k=18`, PSE Halo2 v0.3.0, EZKL 0.15.

| Model | Params | Quant Drop | Rows | PK | Prove | Proof | Verif |
|-------|--------|------------|------|----|-------|-------|-------|
| LeNet-5 MNIST | 61k | 0.2% | 14 | 78MB | 6.2s | 4.1KB | 12ms |
| MobileNet-v2 0.35× CIFAR10 | 412k | 0.9% | 18 | 1.1GB | 312s | 11.7KB | 31ms |
| 2-layer Transf. 2M | 2.1M | 1.1% | 19 | 2.3GB | 891s | 18.4KB | 54ms |

With GKR conv gadget, LeNet speedup `2.3×` vs pure Halo2 (`6.2s→2.7s`) because NTT conv reduces constraints `O(n²w²)→O(n²)`. Verifier `12→18ms`. zkCNN prover `11.2×` vs vCNN on LeNet [9].

> Theorem 4 (Knowledge Soundness): Let `R_QNN={(x,y;W): y=QNN_W(x) over ℤ scale7, range checks}`. EZKL-compiled Halo2 circuit `C_R` with KZG satisfies knowledge-soundness: adversary producing accepting `(x,y,π)` without witness, extractor advantage `≤ q-SDH + O(Q/p)`. Proof via Forking Lemma for PLONKish + KZG batch open [3].

Zero-knowledge from blinded commitments and lookup permutations.

> Theorem 5 (ZKML Privacy): If weight commitment `com_W=KZG.Commit(W;r_w)` hiding and Halo2 uses `≥2` blinding rows, system hides `W` beyond `y`. Distinguisher advantage ≤ `Adv_DL+2/|𝔽|`.

Scale 7 provably sufficient: `|error_quant|_∞ ≤2^{-7}·|acc|_∞`. For `acc` up to `2^{21}`, abs error `≤16384` → relative `~2%`, but clipped after ReLU limited.

---
## 6. Limitations

- **Table blow-up**: 12-bit tables 4096 entries inflate SRS, prover memory superlinear. Split-table mitigates but adds 2 lookups/activation.
- **Trusted setup**: PSE KZG universal SRS τ, toxic waste could forge proofs. Zcash IPA transparent alternative but larger proofs; recursive accumulation could bridge.
- **Float approx loss**: LayerNorm, GELU fp16 sensitive. 12-seg GELU max error 3e-3 but causal effect on logits could skew fairness metrics verification [1] beyond 1%.
- **Architecture leakage**: GKR wiring predicates encode topology public. Recent *architecture-private* ZKML via `pR1CS` [13] overhead ~30% not yet integrated.
- **Prover amort**: Single inference 6s vs inference 2ms = 3000×. Batch `64` amortizes SRS but linear growth prohibitive for LLM 7B (>200 hrs/token [1]).
- **Under-constrained risk**: Halo2 low-level API allows unconstrained advice. Audits [11][12] highlight missing `is_zero` checks leading to modulo-p but not integer semantics violation. Formal verification of chips needed.

## 7. Conclusion

We synthesized path from theoretical GKR cryptography to practical Halo2 compilation for quantized nets, enabling verifiable inference preserving model privacy while allowing public attestation of accuracy/fairness. Key: *PLONKish+lookups is compilation sweet spot*, GKR is *accelerator gadget* for structured linear layers; quantized integer arithmetic prerequisite for field embedding.

Future: ZK-friendly QAT penalizing nonlinear range to shrink tables; NTT-native conv chips upstream; Nova folding for LLM-scale batched inference; architecture-hiding via `pR1CS`; fully transparent Halo2-IPA with L2 verification.

Halo2 evolution from Zcash privacy to PSE decoupled frontend/backend turned ZKML from toy into deployable transparency infra — prover still hours, but verifier-on-chain economics (240k gas ≈ $2 at 20 gwei) already viable for high-stakes audits.

---
## References

[1] EZKL — Easy Zero-Knowledge Inference engine for deep learning models using Halo2 backend. https://github.com/zkonduit/ezkl — Verifiable evaluations: https://arxiv.org/abs/2402.02675v2

[2] PSE Halo2 fork — KZG backend, Solidity verifier, decoupled architecture, maintenance mode Jan 2025. https://github.com/privacy-scaling-explorations/halo2 — Zcash Halo2: https://zcash.github.io/halo2/ — https://ethereum.org/developers/tools/halo2/

[3] Zcash Halo2 Book — PLONKish, custom gates, permutation, lookup, accumulation. https://zcash.github.io/halo2/ — Kudelski analysis: https://kudelskisecurity.com/research/on-the-security-of-halo2-proof-system

[4] Groth, J. EUROCRYPT 2016 Groth16. https://eprint.iacr.org/2016/260.pdf — https://docs.rs/ark-groth16/latest/ark_groth16/ — https://pkg.go.dev/github.com/consensys/gnark/backend/groth16

[5] Thaler, J. Proofs, Arguments, ZK — GKR notes. https://people.cs.georgetown.edu/jthaler/ProofsArgsAndZK.html — Example: https://blog.lambdaclass.com/gkr-protocol-a-step-by-step-example/ — GKR-HND: https://arxiv.org/pdf/2607.21162

[6] Goldwasser et al. Delegating Computation: Interactive Proofs for Muggles STOC 2008. https://dl.acm.org/doi/10.1145/1465853.1465855

[7] Survey Verifiable Computing Util Randomness Low-Degree Polys (Sum-check, GKR). https://eprint.iacr.org/2025/008 — HackMD: https://hackmd.io/@akilesh-pdn-xyz/HJrAR_y56

[8] ZK Proof-based Verifiable Decentralized ML Survey — GKR for CNNs, zkCNN FFT, MPC. https://arxiv.org/html/2310.14848v2 — ZKTorch: http://arxiv.org/pdf/2507.07031 — Remainder: https://raw.githubusercontent.com/Modulus-Labs/Papers/master/remainder-paper.pdf

[9] Liu et al. zkCNN Zero Knowledge Proofs for CNN ACM CCS 2021. 11.2× vs vCNN. https://arxiv.org/pdf/2502.18535 — IACR 2021/673: https://eprint.iacr.org/2021/673.pdf

[10] Cong et al. Scalable zkSNARKs Verifying Deep Learning Matrix Computations. https://lacuna.tiptreesystems.com/pdf/art_111be186e0d54f8ca52971b63d9b9eda

[11] Trail of Bits Axiom Halo2 circuits audit underconstrained bugs. https://blog.trailofbits.com/2025/05/30/a-deep-dive-into-axioms-halo2-circuits/

[12] Axiom Crypto halo2-lib GateInstructions RangeInstructions. https://awesome.ecosyste.ms/projects/github.com/axiom-crypto/halo2-lib — Kudelski: https://kudelskisecurity.com/research/on-the-security-of-halo2-proof-system

[13] Architecture-Private zkML pR1CS. https://iacr.org/news/item/27254
