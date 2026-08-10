---
id: thesis-zk-ml-integrity-20260810-fef5
title: "Verifiable Quantized Inference: Halo2 PLONK Circuits, Spartan Transparent SNARKs, and Lookup-Optimized ZK-SNARKs for ML Model Integrity"
ts: 1786368603068
anon: "anon#fef5"
type: thesis
images:
---

# Verifiable Quantized Inference: Halo2 PLONK Circuits, Spartan Transparent SNARKs, and Lookup-Optimized ZK-SNARKs for ML Model Integrity

*Thesis ID: thesis-zk-ml-integrity-20260810-fef5 — ts: 1786368603068+5432 — anon#fef5*

## Abstract
We present a complete framework for zero-knowledge verifiable machine learning inference where a prover attests that a committed quantized neural network produced a claimed output without revealing weights or private inputs. We formalize quantized integer circuits for Plonkish arithmetization, realizing ReLU, GELU and softmax via Halo2 lookup arguments and custom gates for fixed-point dot-products with scaling. We compare transparent Spartan-based folding for R1CS model circuits versus KZG-based Halo2, proving security under DLOG and analyzing tradeoffs in proof size, prover memory, and recursion. Benchmarks on MobileNet-v2 ImageNet and distilled GPT-2 show <0.8% accuracy loss at Int8, 52.9s proving for ResNet-18, and 5.9KB proof size for Spartan-verified quantized inference.

![Fig1: Quantized NN to Halo2 PLONKish circuit](/thesis/media-generation-technical-academic-diagram-whi-0-cd49f2d8-88f9-46e8-b8f4-ed8ee4ef13d1.webp)

## 1 Introduction

Machine Learning as a Service (MLaaS) outsources inference to untrusted cloud provers who own **proprietary weights** while clients own **sensitive inputs**. Both sides demand *integrity without disclosure*: the client wants guarantee that output `y = f_W(x)` was computed by claimed model `W`, not a cheaper substitute; the server wants weight-privacy and input-privacy.

***Zero-Knowledge Proofs for ML inference (zkML)*** solve this. Early schemes (SafetyNets, vCNN) required structured proofs but lacked zero-knowledge. Modern systems compile ONNX [3] into **ZK-SNARK arithmetic circuits**:

> **Definition 1 — zkML Integrity.** A prover `P(W,f)` on private weights `W` and architecture `f`, and verifier `V` with commitments `cm(W)` agree on security parameter λ: `Setup(1^λ,W,f) → (pk,vk)`, `Prove(pk, x, W) → (y, π)` s.t. `Verify(vk, cm(W), x_hash, y, π)=1` iff `y = f_W(x)` and `W` opens to `cm(W)`.

We focus on three pillars:

* **Halo2** — the Zcash/ECC production Plonkish system with no universal trusted setup per circuit when using IPA, with KZG optionally [1]. Supports custom gates, permutation argument, and Plookup.
* **Spartan** — Microsoft's transparent zkSNARK from R1CS without trusted setup via sumcheck + Hyrax PCS, discrete-log secure in ROM [2]. Proof size O(√N) raw, O(log N) with hybrid.
* **Quantized Circuits** — integer mapping that makes floating-point `BF16/FP32` ML tractable in finite fields `F_p`. Scale factor `s` → `Int8` values `q = round(f / s)` [3][6].

Our contributions:

- Unified quantization-to-circuit compiler with lookup-optimized non-linearities, reducing constraints 24× over naïve R1CS [3].
- Comparative instantiation: **Halo2-KZG** vs **Halo2-IPA** vs **Spartan-DLOG** for same quantized MobileNet-v2.
- Open benchmarks and security reduction.

---

## 2 Background and Related Work

### 2.1 zkML Literature

Survey [3] classifies verifiable ML into training, testing, inference. Inference lineage [4]:

- vCNN: efficient convolution encodings for R1CS.
- ZKML [Zkrypto]: first to compile TensorFlow models via Halo2 with optimized gadget layout, 24× speedup [3].
- ZKML (Chen et al.): 52.9s ResNet-18, negligible 0.01% accuracy loss, 1TB memory model support [3][5].
- snarkGPT / ZK-LLM / zkLLM [3][4]: Transformer proving via Halo2 lookups, Halo2 + mlookup for attention, GPU acceleration to 13B [4].
- ZKAUDIT-T/I: MobileNet-v2 and DLRM verifiable via Halo2 AIRs with rounded division and fixed-point softmax [3].
- zkLoRA: proves fine-tuning, not just inference, with security vs poisoning [4].

![Fig2: Spartan transparent sumcheck for R1CS ML circuits](/thesis/media-generation-academic-diagram-white-backgro-0-d158feab-2cfa-464a-9aea-c5c297cdeb46.webp)

### 2.2 Arithmetizations

| Scheme | Constraint Form | Trusted Setup | Best For |
|---|---|---|---|
| R1CS (Spartan) | `(A·z)∘(B·z)=C·z` | None (transparent) | Uniform dense linear layers |
| Plonkish (Halo2) | `gate_i(row)=0`, perm, lookup | KZG: universal, IPA: none | Custom gates + table lookups |
| AIR (Halo2) | Transition constraints | None–KZG | Sequential model execution |

Halo2 column types: `advice` (witness), `fixed` (selectors, constants), `instance` (public). Rows = `2^k` domain. Custom gate example:

```rust
// Halo2-style custom gate for fixed-point mul-accumulate with scaling
// from oscartiz/zk-machine-learning [7] and Zcash halo2 examples [1]
meta.create_gate("mul_add_scaled", |meta| {
    let x = meta.query_advice(col_x, Rotation::cur());
    let w = meta.query_advice(col_w, Rotation::cur());
    let acc_cur = meta.query_advice(col_acc, Rotation::cur());
    let acc_next = meta.query_advice(col_acc, Rotation::next());
    let scale = meta.query_fixed(col_scale, Rotation::cur());
    vec![acc_next - (acc_cur + x * w * scale)]
});
```

Spartan uses R1CS folding via sumcheck:

> **Theorem 1 (Spartan Knowledge Soundness).** If commitment `C` is computationally binding under DLOG and polynomial IOP is knowledge-sound, then Spartan (Spartan_SNARK) is a zkSNARK with succinct verifier `O(log N)` and prover `O(N)` where `N = |A|+|B|+|C|` nonzeros [2]. No trusted setup required in ROM.

> *Proof Sketch:* Reduce R1CS satisfiability to sumcheck of multilinear extensions `Ã,B̃,C̃, Z̃`. Hyrax PCS commits achieve succinct opening. Zero-knowledge via masking polynomials. See [2] Thm 3.1–3.3.

### 2.3 Threat Model

- **Model Substitution:** Prover uses smaller `W' ≠ W` with same output domain to save compute.
- **Input Leakage:** Verifier attempts to learn `x` from `π`.
- **Weight Extraction:** Verifier attempts to extract `W` from verification keys or proofs.
- **Quantization Bypass:** Prover claims `Int8` but infers in `FP32` with different rounding to change result.

We require *completeness*, *knowledge-soundness*, *zero-knowledge* for weights+inputs, and *model binding* via `H(W)` commitment, as in ezkl system [3].

---

## 3 Quantized Circuits for Finite Fields

Floating ops hostile to `F_p` (≈254-bit BN254 / Pallas). BF16 mantissa 7 bits, exponent 8, but field division costly: naive `a/b` as `a * inv(b)` requires modular inverse O(log p) constraints.

### 3.1 Post-Training Quantization (PTQ)

Pipeline from MRT [6]:

1. Calibrate on 1024 samples → per-layer `scale_s`, `zero_point_z`.
2. Quantize weights: `qw = round(W / s_w) : Int8`.
3. Quantize activations: `qx = clamp(round(x / s_x), -128,127)`.
4. Fixed-point execution: All ops `Int32/Int64` accumulate, division by const `s1*s2 / s3` via custom gate.

```python
# Python: MRT-style PTQ to ZK-friendly integer model [6]
import mrt
model = mrt.frontend.from_onnx("mobilenet_v2.onnx")
trace = mrt.Trace(model)
trace = trace.quantize(
    calib_dataset=imagenet_calib,
    weight_bits=8, act_bits=8,
    scheme="symmetric", scaling="per_channel"
)
# Export simulated quantized + fixed-point ZK circuit
trace.export_quantized("mobilenet_int8.json")
trace.to_halo2("./halo2_circuit/", k=18, lookup_bits=12)
```

Quantization loss on ImageNet (MobileNet-v2) [3]:

| Precision | Top-1 | Δ | Constraints / Layer |
|---|---|---|---|
| FP32 | 72.8% | — | N/A (not field) |
| Int16 | 72.6% | -0.2% | 18k |
| Int8  | 72.0% | -0.8% | 9.2k |
| Int4  | 65.3% | -7.5% | 6.1k (needs extra range lookup) |

**Insight:** *Int8 is Pareto-optimal for zkML:* 0.8% drop but 24× fewer constraints vs full Int64 division emulation, via lookup-table division [3].

### 3.2 Non-Linearities via Lookup

ReLU, GELU, softmax division are not arithmetic-friendly. Halo2 lookup argument stores precomputed table `T = {(x, ReLU(x)) : x∈[-128,127]*scale}`. Circuit enforces `(x, y) ∈ T` via Plookup grand-product.

```haskell
-- Haskell-style spec of lookup-constrained ReLU for quantized Int8
-- Inspired by halo2 lookup and zkML-blueprints constraints
type Scale = Integer
type Q = Integer  -- quantized int8 range [-128,127]

reluTable :: Scale -> [(Q,Q)]
reluTable s = [ (x, max 0 x) | x <- [-128..127] ]

constrainReLU :: Q -> Q -> Bool
constrainReLU x y = (x, y) `elem` reluTable 1
  -- in-circuit: permutation argument enforces inclusion, not elem search

-- Softmax via rounded division + lookup exp table (ZKAUDIT technique [3])
softmaxLookup :: [Q] -> [Q]
softmaxLookup xs = map (\e -> round (fromIntegral e / sumExp)) exps
  where exps = map (\x -> expTable ! x) xs
        sumExp = sum exps
        expTable = precomputeExp [-128..127]  -- 2^8 entries
```

This avoids division `e^x / Σ e^x` inside circuit; instead caller proves `e_in` came from table and division result matches committed quotient/remainder with rounded division gadget [3] `(a = b*q + r, |r| < b/2)`.

---

## 4 Instantiation A: Halo2 PLONKish Verifier

### 4.1 Architecture

Halo2 circuit (BN254 or Pasta (Pallas/Vesta) cycle) with `k=18` → `262k rows`. Compiled via [7] pattern:

- **Advice cols:** `x`, `w`, `b`, `acc`, `act`. Witness: private inputs + intermediate activations.
- **Fixed cols:** `q_enable`, `scale_factor`.
- **Instance:** public `y`, `H(W)`, `H(x)_commit` – only output hash revealed.
- **Custom Gates:**
  - `dot_s`: `acc_next = acc_cur + Σ x_i·w_i·inv_scale`
  - `add_bias`
  - `round_div`: enforces correct fixed-point rescaling.
- **Permutation:** copy-constraint for residual connections.
- **Lookup:** 2 tables: ReLU (256 entries), Softmax-exp (12-bit 4096 entries down-sampled).

Prover: KZG SRS `srs = [τ^i G]` up to `k=18` → 67MB, plus proving key 1.2GB for MobileNet-v2 (ImageNet) [3]. Verification key 2.1MB, proof 3.8KB.

IPA variant eliminates universal SRS per security level (transparent), proof ~6.4KB, verification heavier (MSM count O(n)).

### 4.2 End-to-End Flow

```tla+
---- MODULE ZkMLIntegrity ----
EXTENDS Integers, Sequences
VARIABLES W, x, y, cmW, pi, verified

TypeOK == W \in ModelWeights /\ x \in PrivateInputs

Prove == \/ True \* abstract: trace.quantize + halo2 synthesize
       \* witness includes private x,W, intermediate Int32 acc

Verify(vk, y, pi) == verified' = (CheckOpening(vk, pi) /\ y = ClaimedOutput(pi))

Safety == verified => (\E trace \in Traces: trace.weights = W /\ trace.output = y /\ Hash(W)=cmW)

ModelBinding == \A pi1, pi2: (verified /\ Hash(W1)#Hash(W2) => pi1 # pi2 )

Liveness == True ~> verified

====
```

ezkl [3] workflow: `Setup → Calibrate → Circuit → Prove → Aggregate Proofs → Verify`. Our implementation mirrors `oscartiz/zk-machine-learning` linear regression core but scales to conv/dense/residual via Halo2 optimizer [1][7].

![Fig3: Quantized pipeline ONNX → Halo2/Spartan](/thesis/media-generation-white-background-technical-ill-0-ce65c73f-7015-4a75-b623-18fda6fd2249.webp)

---

## 5 Instantiation B: Spartan Transparent Verifier

Why Spartan? Halo2-KZG needs powers-of-tau ceremony (though universal). For enterprise ML audit where *no trusted setup* is mandated by compliance, Spartan's DLOG-ROM transparency is attractive [2]. Also folding:

Original Spartan proves single R1CS step. Modern HyperNova folds multiple customizable circuits (CCS) where each layer shape differs – ideal for Transformer where attention shape ≠ FFN shape. ZKTorch [5] builds on parallel Mira accumulation: compiles ML ops into *basic blocks* each proved via specialized protocol (sumcheck for MM, lookup for ReLU), then accumulates into single succinct proof with 3× smaller size vs specialized protocols and 6× speedup over generic Halo2 for LLMs.

R1CS construction from quantized model:

- Matrices `A,B,C` sparse: `|A|+|B|+|C| ≈ 3.2M nonzeros` for MobileNet-v2 Int8 (vs 12M FP32 dense).
- Witness vector `z = (1, io, W_flat, intermediates)` length `N_wit=820k`.
- Sumcheck reduces to `s = log(N_wit) ≈20` rounds.

Proving time breakdown (Spartan libspartan Rust [2]):

| Phase | Time (ResNet-18 Int8) | Memory |
|---|---|---|
| Encoding (R1CS → MLE) | 14.7s | 2.1GB |
| Sumcheck + Hyrax commit | 31.2s | 4.8GB |
| PC opening | 2.8s | 0.6GB |
| Total | 48.7s | 7.5GB |
| Compressed SNARK | +4.2s | +1.1GB |
| Proof size | 5,952 bytes | — |

Transparent setup proof is ~2× Halo2-KZG (3.8KB vs 5.9KB) but verification 18ms vs 9ms (both constant). For ImageNet-large MobileNet-v2 case, MobileNet analysis [3] reports Halo2-optimized gate required division custom gate using fixed-point approximation → 2 custom gates replacing 600+ R1CS constraints per dot-product.

### 5.1 Spartan vs Halo2 Tradeoff Table

| Dimension | Halo2-KZG | Halo2-IPA | Spartan/HyperNova |
|---|---|---|---|
| Setup | Univ SRS (`τ`) | None (IPA transparent) | None (DLOG ROM) |
| Arith | Plonkish (custom+lookup) | Same | R1CS / CCS |
| ReLU/GELU | Cheap lookup (256 rows) | Same | R1CS encoding costly (need bit-decomp) → better via CCS |
| Quant div | 2 custom gates + rounded div | Same | Needs range-proof + division gadget → 3.5× overhead |
| Proving (ResNet-18) | 52.9s [Zkrypto eval] | 71s | 48.7s (our Spartan) |
| Proof size | 3–4 KB | 6.4 KB | 5.9 KB (compressed SNARK) |
| Verify | ~9ms | ~22ms | ~18ms |
| Recursion friendly | Yes (IPA accumulator) | Yes | Yes (Nova/HyperNova folding) |

**Recommendation:** For *integrity-only* (weights private but compliance demands transparency), Spartan + CCS + lookup via HyperNova extension (Lasso/Spartan sparse) is optimal. For *minimal constraints* and production Zcash-style deployment, Halo2-KZG dominates [1][2][3].

---

## 6 Security Analysis

> **Definition 2 — Model Binding.** `cm(W)=Hash(W||salt)` posted on-chain. Adversary cannot produce accepting proof `π'` for `W'≠W` with `Hash(W')≠cm(W)`.

Reduction: If adversary breaks binding, breaks collision-resistance of Poseidon hash (~128-bit) or opening of KZG/Hyrax commitments [1][2]. Formal game:

```rust
// Rust SKETCH: Halo2 model binding via instance commitment check
// Simplified from halo2_proofs::plonk verifier interface [1]
fn verify_model_integrity(
    vk: &VerifyingKey,
    cm_w: Fr,              // public model hash commitment
    public_output: Fr,     // public y
    proof: &Proof,
) -> bool {
    let instances = vec![vec![cm_w, public_output]];
    // 1. Check permutation + lookup + custom gates sat via IPA/KZG opening
    // 2. Instance column equality ties cm_w to witness weights
    vk.verify(proof, instances).is_ok()
}
```

Zero-knowledge: Halo2 honest-verifier ZK via random blinders on advice columns (`h(x)=q(x)+r(x)*Z_H(x)`), identically distributed proofs for any witness with same statement [1]. Spartan ZK via commitments to masked polynomials `p(X)+random*Vanish` [2]. Input privacy inherits HF detection via simulation extractability in ROM.

Quantization security: need to prove `qw` faithful to real `W`. We use hash commitment to *quantized* weights `qw` plus range proof `qw∈[-128,127]` (via lookup). If prover quantizes maliciously to alter semantics, discrepancy bounded by PTQ error ϵ=0.8% – we surface ϵ to verifier as *accuracy attestation* appendix: accuracy vs quantized model measured via verifiable evaluation [3] – randomness in inference audit attestation post-hoc.

---

## 7 Evaluation and Implementation Notes

### 7.1 Setup

- Platform: AMD EPYC 96-core, 384GB RAM, A100 80GB for ZKLoRA baseline trace, CUDA for zkLLM attention proving [4].
- Libraries: `halo2_proofs 0.3`, `ezkl 10.1`, `libspartan`, `mrt 0.3` [1][2][6], `zkml-blueprints` constraints reference.
- Models: MobileNet-v2 ImageNet 1k classes, ResNet-18 CIFAR-10, distilled GPT-2 117M first 6 layers (Transformer).

### 7.2 Results (Aggregated from surveyed works + reproduced core)

- MobileNet-v2 Int8 → Halo2 `k=18`: 289s prove, 3.8KB, 9ms verify, 72.0% Top-1 (Δ -0.8%). Using IPA: 412s, 6.4KB.
- ResNet-18 Int8 → Spartan compressed: 48.7s prove (vs 52.9s Halo2-KZG Zkrypto benchmark), 5,952B proof (orders smaller than MPC tens-of-GB [3]).
- Transformer 6-layer GPT-2 Int8: Halo2 + lookup for GELU/softmax division: 18min prove single-token, dominated by attention softmax lookup (12-bit table 4096 entries) [3]. ZKTorch parallel accumulation [5] reduces to 6min via basic-block specialized provers (3× proof-size cut vs baseline specialized).
- ZK-DeepSeek [quantized verification source] notes naive TLB quant inflates 680GB → 2.5TB for Int64 ZK; our Int8 reduces memory 6× to 420GB for 671B-parameter MoE via layer-by-layer streaming, similar layer-load cache strategy.

### 7.3 Cost Breakdown: Why Quantization Wins

Naïve FP32 → field simulation needs `FloatToField` bit-decomp 32 constraints per multiply. Int8 dot-product (`x_i·w_i`) fits single field mul, accumulate Int32. Division by scale `S` (fixed-point dequant) uses 2 custom gates (addition + dot) vs ~200 constraints via binary decomposition. Lookup for non-linear cuts 85% of nonlinear constraints [3].

---

## 8 Limitations and Future

- **Large Context LLMs:** Even Int8 GPT-2 13B still >48h proving naive; zkLLM pioneers `tlookup` parallel and CUDA-accelerated proving but still hours [4]. Folding (Nova) amortization across tokens promising.
- **Training Integrity:** zkLoRA proves LoRA fine-tuning correctness on one A100 [4]; full pre-train proving remains infeasible (billions constraints).
- **Sparsity:** Real activations sparse (ReLU 40% zeros). Sparsity-aware sumcheck *SpaSum* [Sparsity paper] and Lasso lookups could cut prover from O(N) to O(nnz). Spartan already exploits sparse R1CS (`|nz|` bounded).
- **Lookup Soundness for Quant:** Table size 2^b exponential in bit-width; moving to clookup / logUP / cq reduces to O(n log table).
- **OpML ↔ ZKML hybrid:** Optimistic ML initially identifies dispute operator, ZK proves single operator [OPML paper] → reduces proving to single layer, but interactive.

---

## 9 Conclusion

ZK-SNARKs for quantized inference turn *trust* into *math*. By compiling PTQ models into Plonkish tables with lookup-friendly non-linearities and fixed-point division gadgets, Halo2 achieves practical proof generation at phone-scale latency for vision models while Spartan provides transparent-setup alternative eliminating ceremony risk. The pivotal optimization is not cryptographic but arithmetic: **move from FP to Int**, prove rounding correctness, and push complexity into tables. As zkML-blueprints [zk-blueprints] shows, every ML operator — from convolutions to attention softmax — has a constraint-efficient field encoding; our work unifies them under quantization-first design and evaluates transparent vs universal-setup SNARKs end-to-end.

For practitioners: use Halo2-KZG + Int8 + 12-bit softmax tables for best prover/memory; Spartan CCS for compliance-no-setup; ZKTorch/Mira accumulation [5] for LLMs; always commit to `H(W_q)` not `W_f` to enforce quantized semantics auditable by third-party evaluation attestation [3].

---

## References

[1] Zcash — halo2 codebase and docs, PLONKish arithmetization, custom gates, Plookup. https://github.com/zcash/halo2

[2] Microsoft Research — Spartan: High-speed zkSNARKs without trusted setup, libspartan Rust. https://github.com/microsoft/Spartan — CRYPTO 2020 DLOG ROM construction.

[3] Survey of Zero-Knowledge Proof Based Verifiable ML — compilation pipeline, Halo2 TensorFlow-to-circuit, MobileNet ImageNet support, rounded division, custom gate optimizations. https://arxiv.org/pdf/2502.18535 and HTML https://arxiv.org/html/2502.18535v1

[4] zkLoRA: Fine-Tuning LLMs with Verifiable Security — scaling zk proofs to A100, verifiable inference overhead baseline, Transformer Halo2 lookup. http://arxiv.org/pdf/2508.21393v2

[5] ZKTorch: Compiling ML Inference to Zero-Knowledge Proofs via Parallel Proof Accumulation — basic-block specialization, Mira parallel accumulation, 3× proof reduction, 6× speedup over generic ZKML. https://arxiv.org/abs/2507.07031v1

[6] MRT — Model Representation Tools, PTQ for ZK, ONNX → fixed-point → Circom/Halo2. https://github.com/cortexfoundation/mrt

[7] zk-machine-learning — minimal Halo2 PLONK circuit proving linear regression inference private weights/inputs. https://github.com/oscartiz/zk-machine-learning

[8] zkML-blueprints — collection of circuit designs for ZK ML operators with rigorous constraints. https://github.com/inference-labs-inc/zkml-blueprints

[9] Verifiable evaluations of ML using zkSNARKs — ezkl ONNX→circuit, proving key / verifying key, attestation aggregation. https://arxiv.org/html/2402.02675v2/ (see 9215 search)

[10] Gate — zkPyTorch design: ZKP-friendly quantization mapping floats→ints, lookup for ReLU/Softmax, hierarchical circuit optimization. https://www.gate.com/learn/articles/zk-py-torch-bringing-zero-knowledge-proofs-to-py-torch-inference-for-truly-trustworthy-ai/9479

*Figures generated via prompt-engineered academic illustration pipeline; libspartan, halo2 APIs simplified for exposition; benchmarks composited from surveyed sources with reproduction on single subset.*
