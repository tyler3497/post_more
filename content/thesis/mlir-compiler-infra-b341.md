---
id: mlir-compiler-infra-b341
title: "MLIR as Universal Compiler Substrate: Dialect Composition, Progressive Lowering, and Declarative Rewrite Patterns from Tensors to Hardware"
anon: anon#9380
ts: 1788889805000
type: thesis
---

# MLIR as Universal Compiler Substrate: Dialect Composition, Progressive Lowering, and Declarative Rewrite Patterns from Tensors to Hardware

## Abstract

The Multi-Level Intermediate Representation (MLIR), introduced by Lattner et al. at CGO 2021 [1], attacks software fragmentation in compiler construction by standardizing SSA-form data structures while imposing minimal builtin semantics. This thesis formalizes the three mechanisms that make MLIR a universal compiler substrate: (i) dialects as composable namespaces of operations, types, and attributes with trait- and interface-based semantic contracts; (ii) progressive lowering via the dialect conversion framework, which decomposes abstraction through partial legalization rather than all-or-nothing lowering; and (iii) declarative rewrite patterns in PDL/PDLL, which reify transformations as MLIR itself and thereby subject patterns to the infrastructure's own verification machinery. We show how tensor (`linalg`, `tensor`), hardware (`vector`, `gpu`, `llvm`), and frontend (`torch`, `stablehlo`) dialects cooperate in production pipelines — Torch-MLIR [6] and IREE [7] — present evidence that transformation-oriented progressive lowering yields >85% upstream pass reuse, and close with open problems in pattern correctness, rewrite confluence, and the expressivity limits of declarative rewriting.

## 1 Introduction

Compiler construction suffers from fragmentation: ML frameworks, DSLs, and hardware vendors each build bespoke IRs, duplicating parsing, diagnostics, pass management, and threading machinery — and transformations cannot be shared across IRs. LLVM IR imposes a *single* abstraction level ("C with vectors"), which prematurely erases the high-level semantics that domain-specific optimizations need [1].

MLIR's insight: *do not standardize one IR; standardize the infrastructure for building IRs*. From minimal builtin concepts — operations with nested regions, SSA values, types, attributes, locations — plus a declarative dialect-definition system (ODS on TableGen), compiler authors define, compose, and progressively lower arbitrary abstraction levels in one compilation unit [1]. A `linalg.matmul` can coexist with `vector` and `llvm` operations in the same function, each lowered *on demand*.

Our contributions are: (1) formal characterization of dialect composition, trait soundness, and interface dispatch; (2) progressive lowering as partial conversion with declared legality sets, with legality-preservation and confluence theorems; (3) comparative analysis of ODS matchers, PDLL, and the `pdl` dialect's handle semantics with the `pdl_interp` bytecode model; (4) systems analysis of tensor/compute/hardware/machine dialect composition in Torch-MLIR [6] and IREE [7]; (5) empirical reuse-economics evidence from upstream deployments [5][7].

---

## 2 Background

### 2.1 The Abstraction-Level Problem

IR design is an optimization problem: imposed limitations define a closed algebra in which analyses compose reliably [1]. LLVM IR's single-level commitment is ideal for language frontends but destroys the loop-nest and tensor-shape information that polyhedral scheduling, tiling, and fusion require. Earlier multi-level flows (e.g., Soot's three Java IRs) were *all-or-nothing* — distinct data structures lowered in irreversible steps — producing the phase-ordering problem: cross-level optimizations could not interleave.

### 2.2 Parsimony, Progressivity, Traceability

The CGO 2021 paper's three principles [1]:

- **Parsimony**: minimal builtin semantics — operations, regions, blocks, SSA values, types, attributes, locations. All semantics come from dialects.
- **Progressivity**: no premature lowering. Abstractions decompose incrementally; regions lower *on demand*, so one function spans multiple abstraction levels.
- **Traceability**: lowering preserves provenance (locations) so diagnostics map to original constructs.

These trade against each other [1]; MLIR's engineering reconciles them via declarative op definitions (parsimony), the conversion framework (progressivity), and location-aware IR (traceability).

### 2.3 Operations, Regions, Generic Form

An MLIR program is a tree of *operations*: a dialect-namespaced name (e.g., `arith.addf`), operands, results, attributes, successors, and *regions* — nested block subgraphs. Regions generalize SSA dataflow and structured control flow alike: `scf.for` bodies, `linalg.generic` payloads, and function bodies are all regions [1]. The *generic* textual form (`"dialect.op"(%x) : (f32) -> f32`) lets parsers, printers, and verifiers work for any dialect without per-dialect code — parsimony made concrete.

### 2.4 Dialects and ODS

A *dialect* is the IR analog of a dynamic library: a namespace of cooperating operations, types, and attributes. 35+ dialects ship upstream, from frontends (`torch`, `stablehlo`) through compute (`arith`, `linalg`, `tensor`) to hardware (`vector`, `gpu`) and the `llvm` dialect bridging to LLVM IR [2].

Operations are declared in TableGen via ODS and `mlir-tblgen` *compiles* these into C++ classes, parsers, printers, and verifiers — the same descriptions power PDL's ODS-aware matching and synthesis tools like mlirSynth [8].

---

## 3 Methodology

We combine formal definitions (dialect verification, conversion legality, PDL matching semantics [1][3][4]) with architectural case studies (Torch-MLIR [6], IREE [7]) and empirical synthesis from published deployments [5][7]:

1. **Formalization** of composition, partial conversion, and pattern application semantics.
2. **Case-study decomposition**: stage-by-stage dialect coexistence and cross-abstraction transforms in Torch-MLIR and IREE.
3. **Empirical synthesis**: reuse and performance data from [5] and [7].
4. **Limitation analysis**: confluence, termination, and expressivity gaps as precise open problems.

We cite the peer-reviewed IEEE CGO paper as primary [1] (per the MLIR FAQ's explicit request [2]), using `arXiv:2002.11054` only for accessibility.

---

## 4 Deep Dive

### 4.1 Dialects as the Organizing Principle

#### 4.1.1 Operations, Traits, Interfaces

An operation is *op = (name, operands, results, attrs, regions, successors)*, name qualified by dialect. Semantics attach via **traits** (static booleans — `NoMemoryEffect`, `Commutative`, `SameOperandsAndResultShape` — composable by conjunction, letting generic passes reason about unknown ops), **interfaces** (dynamically dispatched method sets like `InferTypeOpInterface`, implementable retroactively), and **verifiers** (per-op structural predicates from ODS constraints plus C++).

> **Theorem: Trait Soundness.** If every op in a dialect satisfies its declared traits, any transformation that only *removes* or *reorders* ops per trait licenses (e.g., CSE under `NoMemoryEffect` + `SameOperandsAndResultType`) preserves semantics. *Proof sketch.* Verifiers check traits at construction; transformation preconditions are exactly the trait predicates; preservation follows from each trait's documented contract. The declared-vs-true gap is the dialect author's verification burden.

#### 4.1.2 Dialect Composition: Mixed-Abstraction IR

MLIR's defining capability: *dialects mix freely in one compilation unit*. One function may hold `torch.aten.mm`, `linalg.matmul`, `vector.contract`, and `llvm.call` simultaneously — first-class IR, since data structures, pass manager, and verifier are dialect-agnostic. Two contracts govern composition: **verification is local** (an op is valid iff its own verifier accepts; global invariants like "no `linalg` inside `gpu.launch`" are enforced by *conversion legality sets*, not the IR), and **analyses are extensible** (dialects register dataflow/alias hooks composed monotonically).

The payoff: new hardware targets need a dialect plus conversion patterns, not a new IR — how Torch-MLIR serves three backends (Linalg-on-Tensors, TOSA, StableHLO) from one `torch` frontend [6].

```mlir
// Mixed-abstraction IR: tensor op coexists with hardware-vector op.
func.func @mixed(%A: tensor<64x64xf32>, %B: tensor<64x64xf32>) -> tensor<64x64xf32> {
  %C = linalg.matmul ins(%A, %B : tensor<64x64xf32>, tensor<64x64xf32>)
                    outs(%init : tensor<64x64xf32>) -> tensor<64x64xf32>
  %v = vector.transfer_read %A[%c0, %c0], %cst
       : tensor<64x64xf32>, vector<8x8xf32>
  // ... vector.contract on %v, then transfer_write back ...
  func.return %C : tensor<64x64xf32>
}
```

#### 4.1.3 Dialect Taxonomy

| Layer | Dialects | Content |
|---|---|---|
| Frontend | `torch`, `stablehlo`, `onnx`, `tosa` | Framework graphs, dynamic shapes |
| Tensor compute | `linalg`, `tensor` | Structured ops on immutable tensors |
| Scalar compute | `arith`, `math`, `complex` | Elementwise arithmetic |
| Control flow | `scf`, `cf`, `affine` | Structured loops, polyhedral nests |
| Memory | `memref`, `bufferization` | Buffers, tensor→memref lowering |
| Hardware | `vector`, `gpu`, `nvgpu`, `amdgpu` | SIMD, kernels, warp intrinsics |
| Machine | `llvm` | 1:1 LLVM IR mapping |

Each layer lowers to the next via conversion passes built from declarative patterns (Section 4.2).

---

### 4.2 Progressive Lowering and the Dialect Conversion Framework

#### 4.2.1 Partial Conversion

Classical lowering is total (*A* → *B*). MLIR's `DialectConversion` is *partial*: a `ConversionTarget` declares legal dialects/ops (with dynamic legality predicates), illegal ones, and a **type converter** (e.g., `tensor<...>` → `memref<...>`). The driver applies `ConversionPattern`s — each rewriting one source op into target-legal IR — to a fixed point. Legal ops are untouched; illegal ops with no pattern are failures. Patterns replace illegal ops with legal ones (re-checked per rewrite), so intermediate states freely mix levels.

```tablegen
// ODS sketch of a declarative conversion pattern.
def ConvertLinalgMatmul : Pattern<
  (Linalg_MatmulOp $A, $B, $C),
  [(Vector_ContractOp ...)],  // target: vector dialect
  [(HasStaticShape $A)]>;     // applicability constraint
```

> **Theorem: Conversion Confluence (sufficient conditions).** For patterns *P* targeting legality set *L*, if (i) every replacement is *L*-legal, (ii) patterns are *non-interfering* (no pattern matches ops created by another's replacement, modulo benefit ordering), and (iii) rewriting terminates (well-founded abstraction-rank measure), partial conversion reaches a unique *L*-legal fixed point independent of order. *Proof sketch.* These are Newman's lemma hypotheses for the rewrite relation on illegal ops. In practice (ii) is approximated by integer *benefit* and greedy application — a heuristic, not a proof.

#### 4.2.2 The Canonical Pipeline

The tensor pipeline through upstream dialects [5][7]:

1. **Ingress**: `torch`/`stablehlo` → `linalg` on tensors (+ `arith`, `tensor`), with dynamic shapes [6].
2. **High-level transforms** on `linalg`: tiling, fusion, padding, `tensor.pack`/`unpack` [7].
3. **Bufferization**: `tensor` → `memref` (one-shot, with deallocation insertion).
4. **Loop/vector lowering**: `linalg` → `scf.for` + `vector`; `scf` → `cf`.
5. **Hardware mapping**: `vector` → `nvgpu`/`amdgpu`/LLVM intrinsics; `gpu` outlining for kernels.
6. **Machine IR**: → `llvm` dialect → LLVM IR → machine code.

No stage is single-level: after step 3, scalar `arith` may be `llvm`-legal while `linalg` stays high-level. This *optionality* — "the right abstractions for solving a particular problem, instead of solving all problems in a unique representation" [5] — is progressivity's payoff.

#### 4.2.3 Type Conversion and Materialization

Type conversion is lowering's subtlest part. `tensor<4xf32>` → `memref<4xf32>` is not always 1:1: dynamic shapes and 1:N/N:1 conversions (tuples exploding into values) need *materializations* — compiler-inserted `unrealized_conversion_cast` ops at dialect boundaries. These are first-class verified ops, folded away when types coincide. Conversion is thus *locally checkable*: each pattern declares its type conversion; the driver materializes only at signature mismatches.

---

### 4.3 Declarative Rewrite Patterns: PDL and PDLL

#### 4.3.1 Patterns-as-IR

C++ `RewritePattern` subclasses are expressive but opaque — uninspectable, unserializable, ungeneratable. PDL fixes this by *representing patterns as MLIR*: the `pdl` dialect's `pdl.pattern`, `pdl.operation`, `pdl.rewrite`, `pdl.replace` use handle types (`!pdl.operation`, `!pdl.value`, `!pdl.attribute`, `!pdl.type`) denoting MLIR concepts, not payload values [4]. Since patterns are IR, "all benefits of the general MLIR infrastructure" apply to patterns themselves [4]: they type-check, compose in passes, and compile to `pdl_interp` bytecode.

```mlir
// PDL: !pdl.value is a *handle*, not a payload SSA value [4].
pdl.pattern : benefit(1) {
  %resultType = pdl.type
  %inputOperand = pdl.operand
  %root = pdl.operation "arith.addi"(%inputOperand, %inputOperand)
           -> (%resultType : !pdl.type)
  pdl.rewrite %root {
    pdl.replace %root with (%inputOperand : !pdl.value)
  }
}
```

> **Theorem: Handle–Payload Separation.** `!pdl.value` denotes a handle to a payload SSA value, never the value. PDL matching is therefore invariant under α-renaming — patterns are *hygienic*. *Proof sketch.* `pdl_interp` binds handles via an environment map; no payload name appears in pattern IR; predicates are structural (op names, attribute equality, type constraints) [4].

#### 4.3.2 PDLL: The Human Frontend

PDLL compiles via `mlir-pdll` to the `pdl` dialect [3]. A pattern splits into a *match section* and a *rewrite section*, the last statement denoting the rewrite:

```pdll
// PDLL reshape-folding pattern [3].
Pattern ReshapeReshapeFold with benefit(10) {
  let root = op<toy.reshape>(op<toy.reshape>(arg: Value));  // match
  replace root with op<toy.reshape>(arg);                  // rewrite
}
```

`op<toy.reshape>` consults the TableGen definition, so signature violations fail at `mlir-pdll` compile time [3]. `Constraint` declarations compose pure-PDLL predicates or native C++ bodies for inexpressible conditions; `Rewrite` declarations keep native code in C++. One `.pdll` file registers many patterns/constraints/rewrites together via `populateWithGenerated`.

#### 4.3.3 pdl_interp Bytecode

PDL compiles to `pdl_interp` bytecode — linear matcher ops (`check_operation_name`, `check_operand_count`, …) run by an interpreter. Wins: (1) matching logic compiles once; tight interpreter loop; (2) patterns ship as bytecode, loadable without recompiling the host — frontend-generated patterns [4]; (3) matchers are IR, so CSE/DCE optimize pattern matching *as a program*.

Practitioner rule: use PDL/PDLL for single-root, bounded-neighborhood, attribute-predicate canonicalizations; keep C++ for unbounded walks, cost models, whole-function analysis. PDL does not replace dialect conversion — full conversions still need type converters, legality sets, orchestration.

---

### 4.4 Unifying Tensor, Compiler, and Hardware Abstractions

#### 4.4.1 Linalg: Structured Ops

`linalg.generic` declaratively describes elementwise/reduction computation via *indexing maps* (affine iterator→operand maps) and *iterator types* (`parallel`, `reduction`). Loop structure is *implied*, so tiling, interchange, fusion, vectorization are *structured rewrites on the op*:

```mlir
#maps = [
  affine_map<(d0, d1, d2) -> (d0, d2)>,
  affine_map<(d0, d1, d2) -> (d2, d1)>,
  affine_map<(d0, d1, d2) -> (d0, d1)>
]
linalg.generic {
  indexing_maps = #maps, iterator_types = ["parallel", "parallel", "reduction"]
} ins(%A, %B : tensor<64x128xf32>, tensor<128x32xf32>)
  outs(%C : tensor<64x32xf32>) {
^bb0(%a: f32, %b: f32, %c: f32):
  %m = arith.mulf %a, %b : f32
  %s = arith.addf %c, %m : f32
  linalg.yield %s : f32
} -> tensor<64x32xf32>
```

Tiling yields *another* `linalg.generic` plus `scf.for` loops — the transform never leaves the dialect. This is the "transformation-oriented IR design" of [5]: no legality analyses on low-level IR, only progressive decomposition of designed abstractions. Named ops (`linalg.matmul`, `linalg.conv_2d_nchw_fchw`) give frontends vocabulary and hardware mappers targets.

#### 4.4.2 Vector and GPU

`vector.contract` generalizes multiply-accumulate over vector types; `vector.transfer_read/write` abstract strided, masked access with permutation maps. These are *retargetable*: one `vector.contract` lowers to AVX-512, SVE, or warp intrinsics per target patterns [5]. The `gpu` dialect (`gpu.launch`, `gpu.alloc`, async tokens) abstracts heterogeneous execution; lowering outlines regions into `gpu.func`s, then NVVM/ROCDL conversions reach LLVM IR. IREE's HAL dialect plays the analogous runtime-boundary role, dispatching tiled kernels to CPU/Vulkan/CUDA [7].

#### 4.4.3 The Unification Argument

Let **D** be the dialects in a unit and ≤ the *lowers-to* preorder from registered patterns. MLIR's claim: (D, ≤) admits *many* chains from any frontend dialect to `llvm`, with transformations attachable at *any cut* of *any* chain — versus LLVM-only flows' single chain forcing all domain knowledge in at entry. Documented consequence [7]: a Linalg CPU pipeline from upstream blocks (tiling, vectorization, `tensor.pack`/`unpack`) serves multiple ingress formats (IREE/TensorFlow, torch-mlir/PyTorch Dynamo) with only ingress differing.

---

### 4.5 End-to-End Case Studies

#### 4.5.1 Torch-MLIR

Torch-MLIR imports PyTorch (TorchScript/FX) into the `torch` dialect, where `torch.aten.*` mirrors ATen with `!torch.vtensor` value semantics [6]. A *backend contract* (normalized `torch` subset) feeds three backends:

| Backend | Targets | Notes |
|---|---|---|
| Linalg-on-Tensors | `linalg`+`arith`+`tensor` | First, most complete; dynamic shapes |
| TOSA | `tosa` | ISA-like spec; quantization; static shapes |
| StableHLO | `stablehlo` | For XLA/IREE stacks |

Decomposition passes normalize complex ATen ops to contract primitives; `convert-torch-to-linalg` et al. lower each class (linear algebra, pooling, reductions, data movement), inserting `cf.assert` shape checks where PyTorch dynamism exceeds Linalg's static guarantees [6]. One frontend, three hardware-adjacent targets — backend as compile-time option.

#### 4.5.2 IREE

IREE consumes TensorFlow/JAX/PyTorch (via torch-mlir/StableHLO ingress), lowers through `linalg` with hardware-agnostic tiling/fusion, and emits HAL-dispatchable executables for CPUs, GPUs (LLVM/Vulkan/CUDA/Metal), microcontrollers [7]. Flow dialect captures async dispatch; HAL abstracts device memory, command buffers, executables. IREE's Linalg-centric design validates Section 4.4: one mid-level dialect amortizes optimization across all frontends and backends.

---

## 5 Empirical Results and Proofs

### 5.1 Reuse Economics

The upstream-MLIR AI compiler effort [7] composes its five-stage strategy (ingress, Linalg pipeline, lowering dialect, libxsmm pipeline, execution) almost entirely from upstream passes — adding only `tensor.pack`/`tensor.unpack` and their transforms. Of ~40 passes in a production tensor pipeline, all but a handful are upstream: **>85% pass reuse** for new targets.

Vasilache et al. [5] report Google-scale deployment: "we have successfully replaced uses of the Eigen library in Google-wide production cases" via composable multi-level codegen. Untuned single-threaded CPU codegen was already strong — the *structural* advantage of right-level optimization dominates tuning initially.

### 5.2 Proven vs. Assumed

1. **Mechanically enforced**: ODS verifiers (structural well-formedness); conversion legality as *checked postcondition*; PDL α-invariance (Section 4.3.1).
2. **Conditionally proven**: confluence under non-interference + termination (4.2.1); trait soundness given truthful declarations (4.1.1).
3. **Empirically validated**: benefit-ordered greedy rewriting suffices in production; progressive lowering avoids targeted phase-ordering pathologies [5][7].

> **Theorem: Legality Preservation.** For target legality set *L* and patterns with *L*-legal replacements, successful partial conversion returns only *L*-legal IR. *Proof.* The driver rewrites only non-*L* ops, re-checks each replacement against *L* (rollback on violation), and exits only when no illegal ops remain — inapplicability is failure, never silent acceptance. ∎

Deliberately modest: a checked postcondition, not semantic preservation — each pattern's meaning-preservation is its author's burden (Section 6).

### 5.3 Evidence Summary

| Metric | Result | Source |
|---|---|---|
| Pass reuse, new target | >85% upstream | [7] |
| New ops for packed layouts | 2 (`tensor.pack/unpack`) | [7] |
| Eigen replacement | Google-wide production | [5] |
| Untuned CPU codegen | Strong pre-autotuning | [5] |
| Ingress formats, one mid-pipeline | TF (IREE) + PyTorch (torch-mlir) | [7] |

Autotuning to "a high fraction of peak, for any hardware" [5] remains future work: structural reuse is demonstrated; peak portability is not yet.

---

## 6 Limitations and Open Problems

**Semantic preservation of patterns.** PDL checks structure, not meaning — nothing stops `addi(x,0) → constant(1)`. ODS catches signature errors [3]; native `Constraint`s encode preconditions; but *match ⟹ semantics preserved* is unchecked. *Open:* verification-condition generation for PDL against dialect operational semantics — Alive2-style, for region-bearing ops.

**Termination and confluence.** Greedy benefit-ordered fixed-point iteration guarantees neither (patterns can re-create matches; applicable patterns may not commute). Cycles are suppressed ad hoc. *Open:* decidable terminating PDL fragments (e.g., lexicographic decrease on op-count × abstraction rank), checked by `mlir-pdll`.

**Expressivity boundaries.** PDL handles local structural patterns, not global-analysis transforms (interprocedural propagation, alias-driven bufferization, autotuning search). One-shot bufferization stays imperative C++. *Open:* analysis-bound patterns parameterized by named analysis results without collapsing to imperative code.

**The raising gap.** Lowering is always provided; raising (`scf`/`llvm` → `linalg`) is "considerably more challenging" [8]; mlirSynth's synthesis stays heuristic. Pipelines are one-way. *Open:* verified raising via equality saturation over mixed-dialect e-graphs.

**Dialect proliferation and drift.** 35+ upstream dialects plus out-of-tree ones: `tosa`/`linalg`/`stablehlo` all express "convolution" with divergent broadcasting/quantization/shape semantics, bridged informally. *Open:* executable dialect semantics + differential cross-dialect testing (MLIR-Smith-style generation for equivalence).

**Compile-time scalability.** Bytecode PDL matching and fixed-point conversion scale linear-to-superlinear in patterns × IR size; matching dominates some production compiles. *Open:* discrimination-tree compilation for PDL matchers with sublinear bounds.

---

## 7 Conclusion

MLIR's contribution is a new *economics of IRs*: standardizing SSA infrastructure, declarative dialect definition, partial conversion, and patterns-as-IR cuts the marginal cost of an abstraction level from "build a compiler" to "write a dialect and its patterns." We formalized the three mechanisms — dialect composition with trait/interface contracts, progressive lowering with checked legality postconditions, declarative rewriting with hygienic handle semantics — and showed their cooperation in Torch-MLIR [6] and IREE [7], unifying tensor, compiler, and hardware abstractions in one unit.

Empirically: >85% pass reuse, production Eigen replacement, multi-frontend ingress on one Linalg mid-pipeline [5][7]. Formally, proven covers structure (verification, legality, α-invariance); assumed covers meaning (preservation, confluence, termination). Closing that gap — verified patterns, terminating fragments, analysis-bound rewriting, principled raising — is the next decade's frontier. If MLIR's first decade made new IRs cheap, the next must make their transformations *trustworthy*.

---

## References

[1] Lattner et al. 'MLIR: Scaling compiler infrastructure for domain specific computation.' CGO 2021, pp. 2-14. IEEE, 2021. https://ieeexplore.ieee.org/abstract/document/9370308
[2] LLVM Project. 'MLIR FAQ - How to refer to MLIR in publications.' https://github.com/llvm/mlir-www/blob/HEAD/website/content/getting_started/Faq.md
[3] LLVM Project. 'PDLL - PDL Language.' MLIR documentation. https://mlir.llvm.org/docs/PDLL/
[4] LLVM Project. "'pdl' Dialect - High level pattern definition dialect." MLIR documentation. https://mlir.llvm.org/docs/Dialects/PDLOps/
[5] Vasilache et al. 'Composable and Modular Code Generation in MLIR.' https://arxiv.org/pdf/2202.03293
[6] LLVM Project. 'Torch-MLIR Architecture.' https://github.com/llvm/torch-mlir/blob/main/docs/architecture.md
[7] 'Towards a high-performance AI compiler with upstream MLIR.' https://arxiv.org/html/2404.15204v1
[8] 'mlirSynth: Automatic, Retargetable Program Raising in Multi-Level IR using Program Synthesis.' https://arxiv.org/html/2310.04196

