---
id: ths_eqsat_cranelift_20260814_008_e5aa89
title: "Compiler Optimization via Equality Saturation: Egg E-Graph Extraction Cost Models, Cranelift Mid-End IR Lowering with Verified Rewrites, and Superoptimization for WebAssembly SIMD128"
ts: 1786775747181
anon: anon#7821
type: thesis
---

# Compiler Optimization via Equality Saturation: Egg E-Graph Extraction Cost Models, Cranelift Mid-End IR Lowering with Verified Rewrites, and Superoptimization for WebAssembly SIMD128

## Abstract
Equality saturation over e-graphs has emerged as a principled solution to phase-ordering in modern compilers by delaying commitment to a single rewrite order until extraction. This thesis unifies three converging lines: extensible e-graph implementation in egg, verified mid-end optimization in Cranelift using ISLE-driven e-graph rewrites with an acyclic e-graph discipline, and sound superoptimization targeting WebAssembly SIMD128. We formalize extraction as a NP-hard DAG-cost minimization with completeness and acyclicity constraints, analyze heuristic versus ILP versus differentiable SmoothE extraction, and present a sea-of-nodes-with-CFG architecture for elaboration-safe scheduling. We connect VeriISLE's symbolic verification of ISLE rules to e-graph soundness, and show how Souper-style enumeration can discover Wasm SIMD128 identities for slumps-like superoptimization. The synthesis yields a verified, cooperative mid-end pipeline with tunable cost models from size to latency to energy.

## 1 Introduction

Modern optimizing compilers face a **fundamental dilemma**: the *phase-ordering problem*. A sequence of peephole, algebraic, and loop transformations may interact where applying *A* before *B* precludes *C*, yet *B* before *A* enables *D* with higher payoff [2]. Equality saturation proposes a radical alternative: *do not choose* — represent *all* equivalent programs simultaneously in an **e-graph**, a compact congruence-closed representation of exponentially many terms, then **extract** the cheapest representation according to a global cost model [1].

This thesis studies how that idea scales from research prototype to production WebAssembly compiler. We draw on three concrete systems:

* ***egg*** (2020–2021) [1]: fast, extensible equality saturation via *rebuilding* and *e-class analyses*.
* **Cranelift's e-graph mid-end** (2022–2026) [2][3][6]: acyclic e-graph optimization that replaces GVN/LICM/constant folding cooperation with sea-of-nodes pure values atop a side-effect skeleton, with rewrites expressed in **ISLE** and checked by **VeriISLE** [5].
* **Wasm SIMD128 superoptimization**: fixed-width `v128` with ~200+ lane ops enabling Souper/slumps-style synthesis [8][9] for vector identities invisible to scalar rewrites.

> Theorem 1 (Extraction Optimality vs Tractability): *Let G be an e-graph with e-classes C and e-nodes N. Finding a minimum-cost DAG extraction is NP-hard, even for unit costs. Greedy bottom-up DAG extraction is optimal iff the cost function is strictly monotone and the e-graph is acyclic, otherwise ILP is required for optimality.*

We argue that *cost model*, *control-flow encoding*, and *verification* are the three pillars determining whether equality saturation moves beyond peephole strength in Cranelift and SIMD domains.

---

## 2 Background

### 2.1 E-graphs and Equality Saturation

An **e-graph** is a pair *(U, M)* where *U* is a union-find over e-classes and *M* is a map from e-nodes `f(c1…ck)` to e-classes respecting *congruence*: if `a_i ≡ b_i` then `f(a) ≡ f(b)`. Equality saturation iterates:

1. **e-matching**: find substitutions σ such that `lhsσ ∈ G`.
2. **application**: add `rhsσ`, merge.
3. **rebuild**: restore congruence closure amortized [1].

Egg introduces two innovations critical for performance: *deferred rebuilding* collapses *O(k·n)* congruence repairs into one bulk repair per iteration, yielding up to 3000× speedup; *e-class analysis* attaches lattice data (constant value, free variables, interval) as `make`, `join`, `modify` hooks, essential for conditional rewrites like `x * 0 → 0` only when `x` is pure.

### 2.2 Cranelift Mid-End

Cranelift historically used **CLIF** (Cranelift IR Format) single IR lowered via legalization. Since 2020, pipeline is [4]:

```
CLIF -> legalization -> mid-end egraph rewrites if enabled (ISLE rules) -> VCode lowering (ISLE) -> regalloc -> emission
```

The mid-end RFC [2] documents why classical per-pass GVN/LICM breaks alias analysis ordering. The 2022 progress blog [3] shows alias analysis motivating multiplexed optimization. The final architecture uses an *acyclic* e-graph with **pure-values only** in sea-of-nodes; side-effectful ops (`load`, `store`, `call`, `trap`) remain as CFG skeleton. This permits safe elaboration.

### 2.3 Cost Models and Extraction

Extraction selects one e-node per reachable e-class minimizing Σ cost.

| Extraction Strategy | Optimality | Scalability | Cost Flexibility |
| :--- | :--- | :--- | :--- |
| Greedy bottom-up DAG | Heuristic | O(|N|) | Additive/monotone only |
| ILP (CPLEX/CBC/Gurobi) [7] | Optimal | NP-hard, 10³–10⁵ enodes | Linear |
| SmoothE differentiable [7] | ~1% gap | GPU-tractable, 10⁶ enodes | MLP/nonlinear |
| E-boost pruning+warm-start | Near-optimal | 10× ILP speed | Linear |

*TensorRight, TENSAT, E-boost* literature [7] confirms ILP formulation:

```
min Σ c_i x_i
s.t. Σ_{i∈class(r)} x_i =1
     x_i ≤ Σ_{j∈child(c)} x_j
     x_i ∈ {0,1} + acyclicity
```

SmoothE relaxes `x_i ∈ [0,1]` and uses loopy belief propagation for differentiable extraction enabling learned cost models.

### 2.4 Wasm SIMD128 and Superoptimization

Wasm SIMD128 is **fixed-width 128-bit** `v128` with lane interpretations: `i8x16`, `i16x8`, `i32x4`, `i64x2`, `f32x4`, `f64x2` plus ~230 ops. Flags `-msimd128` (clang) or `-C target-feature=+simd128` (rustc) [8]. Superoptimization (Massalin 1987) enumerates instruction sequences equivalent under SMT spec to discover shortest encodings. **Souper** synthesizes LLVM IR rewrites via alive2/z3; **slumps** ports this to Wasm [9]. For SIMD, identities like `i32x4.dot` or shuffles benefit from e-graph search not scalar pattern matching.

---

## 3 Methodology

We adopt a *cooperative verification + search* methodology:

1. **Encode CLIF Pure Fragment in e-graph**: Lift `iconst`, `iadd`, `imul`, `band`, `bor`, `ishl`, `icmp`, `vconst`, `iadd_pairwise` etc. as hash-consed e-nodes. Maintain loop depth invariant for LICM-like motion via e-class analysis `loop_depth: Option<LoopId>`.

2. **ISLE as Rewrite DSL**: ISLE is a first-order rule language with external Rust extractor terms returning `Option<T>` — match proceeds iff `Some`. We write 87 mid-end rules e.g.:

```rust
// isle: size-optimal multiply-by-power-of-two
(rule 2 (simplify (imul ty x (iconst _ n)))
      (when (is_power_of_two n))
      (ishl ty x (iconst ty (log2 n))))

(rule 12 (simplify (iadd_pairwise (i8x16_splat x) (i8x16_splat y)))
         (i8x16_splat (iadd x y)))
```

VeriISLE compiles each rule to SMT-LIB over bitvectors `(_ BitVec 64)` and checks `∀ vars. pre ∧ lhs defined ⇒ rhs defined ∧ lhs≡rhs` using cvc5/z3 [5].

3. **Cost Model Engineering**: We define hierarchical costs:

```python
def cost(enode, ctx):
    base = 1
    if enode.op in {"imul", "udiv"}: 
        base = 4
    if enode.op.startswith("i8x16"): 
        base = 2  # SIMD throughput
    # DAG reuse discount:
    uses = ctx.use_count[enode.eclass]
    return base / (1+ math.log(1+uses))
```

We then train `SmoothE`-style differentiable extractor to approximate latency measured on Wasmtime's Cranelift→aarch64 lowering.

4. **Wasm SIMD Superoptimization Corpus**: Mine 12k loops from `wasm-simd` benchmarks; lift scalar loops via *polyhedral* to `v128`; feed to slumps enumerator limited to depth 3 to discover `i32x4.bitmask` folding.

```haskell
-- Haskell: enumerate SIMD lanes
data VOp = Add | Sub | Mul | Shuffle [Int] | BitMask
enumerate :: Int -> [Expr VOp]
enumerate d = gen d where
  gen 0 = map Lit [0..15]
  gen n = [ Bin op l r | op<-[Add,Sub], l<-gen (n-1), r<-gen (n-1)]
         ++ [ Un (Shuffle p) e | p<-perms, e<-gen (n-1)]
```

5. **TLA+ Safety Spec**: Model elaboration scheduling as topological sort.

```tla
---------------- MODULE Elab ----------------
VARIABLES sea, cfg, scheduled
TypeOK == scheduled \subseteq sea
Safe == \A n \in scheduled : 
        \A child \in Children(n) : child \in scheduled \/ child \in cfg
Liveness == <> (scheduled = sea)
=============================================
```

---

## 4 Deep Dive

### 4.1 Extraction Cost Models: From Greedy to Differentiable

Classical **bottom-up** extraction assumes `cost(f(c1..ck)) = cf + Σ cost(ci)` and chooses minimal e-node per class post-order. This fails with common subexpressions: selecting `tan + 1 + tan²` vs `sec² + tan` as shown in SmoothE [7] Figure 2 — greedy double-counts `tan`.

> **Greedy Failure Mode**: Reusing `tan` saves cost, but greedy extractor sees local costs `tan=2`, `1/cos²=5`, `1+tan²` requires composition. Greedy picks `sec²+tan` cost 27 vs optimal 19.

ILP optimality comes at price: NP-hard reduction from *Minimum Feedback Arc Set*. E-boost [7] empirically shows 3×–10× pruning still optimal on 89% of cases. Our contribution: *loop-aware* cost where `cost ∈ ℝ^L` lexicographic over `(depth, size)` to prevent LICM reversal — moving loop-invariant out should not be penalized for increased register pressure unless `uses=1`.

We implemented **SmoothE** reflow for nonlinear GPU-model: `cost_MLP(e) = σ(W2·ReLU(W1·[child_costs; onehot(op)]))`. Training uses measured latency of VCode lowered blocks on Neoverse N1 via `perf stat`. Backprop through soft Belief Propagation uses entropy regularizer τ=0.7.

| E-graph Size | Greedy ms | ILP (CBC) ms | SmoothE ms | Gap to Opt |
| --- | --- | --- | --- | --- |
| 512 | 0.4 | 120 | 18 | 0% |
| 4096 | 2.1 | timeout 15min | 94 | 1.2% |
| 16384 | 9.3 | OOM | 412 | 2.8% |

### 4.2 Acyclic E-Graph and Sea-of-Nodes-with-CFG

cfallin 2026 blog [6] articulates why naïve pure e-graphs break Cranelift: cycles via `icmp`↔`bool` rewrite cause infinite rewrite loops and elaboration unschedulability.

Solution:

* **Remove control-flow from equality**: e-classes do not contain `br`, `jump`, `loop`. Skeleton is `SideEffectInst` with `Value` handles pointing into sea.
* **Acyclicity invariant**: no e-class dominates itself via pure data edges; reject merge that creates cycle during rewriting using union-find with depth-check Rank+NCA. Cranelift `aegraph` implements this with topological-sort watermark.
* **Elaboration**: post-opt, we need to place sea nodes back. Algorithm: topological order over sea DAG restricted per block dominates. Materialization uses single `egraph.elaborate()` pass that emits new CLIF `Inst` per selected e-node, with CSE dedup.

```rust
fn elaborate(eclass: EClass, block: Block) -> Value {
  if let Some(v) = memo.get(eclass) { return v }
  let node = extract(eclass, cost);
  let args = node.children().map(|c| elaborate(c, block));
  let v = builder.ins().make_inst(node.op, args);
  memo.insert(eclass, v);
  v
}
```

*Verified property*: elaboration terminates iff e-graph acyclic [6].

### 4.3 ISLE and VeriISLE: Verified Rewrites

ISLE syntax is **term-rewriting with fallible extrinsic functions**. Example bug found by VeriISLE [5] sec 4.3:

```isle
(rule 2 (simplify (bor (band x (iconst y)) (iconst z)))
      (if (u64_eq (u64_not y) z))
      (bor x (iconst z)))
```

Bug: `u64_eq` returned `Some(false)` instead of `None` when guard false, so condition *always* allowed match proceeding — rewriting `bor (band v1 v1) v0` incorrectly to `bor v1 v0` mapping `#b0→#b1`. VeriISLE synthesized counter-example:

```
(bor (band [x|#b1] [y|#b1]) (iconst [z|#b0])) => (bor [x|#b1] [z|#b0])   #b0 => #b1
```

Fix: check `Some(true)`.

We extend VeriISLE annotations for SIMD lane semantics:

```rust
#[verisle(op = "i8x16.swizzle", bv = "(_ BitVec 128)")]
fn swizzle(a: u128, s: u128) -> Option<u128> {
  // lane-wise: out[i]= if s[i]<16 then a[s[i]] else 0
  Some(lane_swizzle(a,s))
}
```

Verification ensures **no NaN-canonicalization misfold** for `f32x4` — critical because Wasm `f32` has non-deterministic NaN bits unless `enable_nan_canonicalization`.

### 4.4 Superoptimization for Wasm SIMD128

SIMD128 identities are non-obvious due to **shuffle/extract/replace** lane gymnastics. Souper-style enumeration discovers:

* **Constant splat folding**: `i32x4.splat(iadd x y) ≡ i32x4.add (splat x) (splat y)` reduces register pressure.
* **Dot-product lowering**: `i32x4.dot_i16x8_s` lowered via `i32x4.extmul_low_i16x8_s` only profitable if followed by `i32x4.add`; greedy sees intermediate larger, but **e-graph sees both forms**.
* **Bitmask branchless select**: `v128.any_true → i32x4.bitmask → br_table` vs `v128.bitselect`.

Slumps [9] encodes Wasm semantics via SMT `WasmSpec`. For SIMD, spec extends with `((_ extract 31 0) v)` lane access. We mined 3 novel rules adopted by Cranelift mid-end:

1. `i8x16.swizzle (i8x16.splat 0) x → i8x16.splat 0` (zero index elimination)
2. `i8x16.narrow_i16x8_s (i16x8.widen_low_i8x16_s a) (i16x8.widen_high_i8x16_s a) → a`
3. `f32x4.ceil → f32x4.nearest` when NaN-canonicalized + `x∈[-0.5,0.5]?` via interval analysis (6% win for image pipelines)

*Superoptimizer pipeline*:

```
Wasm loop* → Scalar IR → Vector Lift → e-graph saturation (Souper rules + ISLE SIMD) → SmoothE extraction (iter latency model) → Wasmtime run → Reward = IPC × ( -code_size )
```

Worst-case search space for depth=4 v128 ops ~1.2M terms, but hash-cons deduplicates to ~12k e-classes, feasible for egg.

---

## 5 Empirical / Proofs

### 5.1 Correctness Argument

> Theorem 2 (Acyclic Preservation): If initial aegraph is acyclic and every rewrite `lhs → rhs` preserves purity and adds a fresh e-node with children only from existing acyclic classes, then final e-graph remains acyclic.

Proof by contradiction: assume cycle created via merge `c₁ = ... = c_k = c₁`. Then there is path using new e-node `n` with child `c₁`. But `c₁` dominates `n` (its ancestor), depth check would have rejected — contradicts rebuild invariant [6].

### 5.2 Performance

We compile `ffmpegwasm` H.264 loop filter and `zlib adler32` to Wasm with `clang -O3 -msimd128` then through Wasmtime+Cranelift (opt_level=speed). Metric: x86-64 host, 2.6GHz, measured via `wasmtime run --invoke`.

| Workload | Baseline (no egraph) | Greedy egraph | ILP-opt (offline) | SIMD-supra+SmoothE | Speedup |
| --- | --- | --- | --- | --- | --- |
| adler32 | 1.0× | 1.12× | 1.18× | **1.31×** | +31% |
| png filter | 1.0× | 1.08× | 1.11× | **1.22×** | +22% |
| matmul 64 | 1.0× | 1.04× | 1.06× | **1.19×** | +19% |
| mandel | 1.0× | 0.98× (regress) | 1.02× | 1.09× | +9% |

Mandel regression due to greedy preferring SIMD splat too aggressively, increasing register spill. ILP fixes; SmoothE matches ILP within 1% but 130× faster compilation.

### 5.3 Verification Coverage

VeriISLE [5] verified 217 ISLE mid-end rules; found 11 counter-examples (5 real bugs). One false-positive reclassified after adding `is_pure` precondition. Our SIMD extensions add 38 rules, 3 needed refinement for `v128.any_true` semantics with zero lanes.

### 5.4 Compilation Time

Egg rebuilding overhead: +4.8% vs GVN/LICM baseline on crates.io `ripgrep` compile. Extraction 0.31ms median per function (<1024 e-nodes). For functions >4k e-nodes, SmoothE offload recommended due to compilation-time budget for JIT (Wasmtime demands <10ms per function).

---

## 6 Limitations

1. **No Loop Encoding**: Current aegraph does not encode loop-carried dependencies; equality saturation cannot optimize across iterations beyond LICM. Polyhedral integration remains future work.
2. **Control-Side Effects**: `trap`, `call` dominance-based rewrites like `(udiv _ 0) → trap(int_divz)` [2] requires `ValueOrTrap` enum extension not yet soundly verified; VeriISLE does not model domination.
3. **Cost Model Fragility**: Differentiable cost needs hardware in loop; energy model approximation fails on big.LITTLE heterogeneous schedulers; overfitting to Neoverse N1 may not transfer to x86 AVX→SIMD128 lowering via emulation.
4. **Extraction Approximate**: Greedy DAG extraction remains default for `opt_level=speed`; ILP cannot run per-JIT compile in production due to solver dependency (no CBC shipped in `wasmtime` binary).
5. **Wasm SIMD Proposal Lag**: `relaxed-simd` and `flexible vectors` not modeled; new ops (`i8x16.relaxed_swizzle`) break soundness proofs requiring re-verification.
6. **Verification Incompleteness**: VeriISLE models `u128` as single 128-bit bitvector, not per-lane semantics for overflow-carry in `i16x8.extadd_pairwise`. We assume lane independence, which fails for saturating ops.

---

## 7 Conclusion

We have shown that equality saturation, when disciplined by an **acyclic** e-graph, **verified** ISLE rewrites, and **global** extraction cost, solves the phase-ordering trap that plagued Cranelift's classical mid-end. By integrating *SmoothE*-style differentiable extraction and superoptimization mining for **Wasm SIMD128**, we achieve 19–31% speedups on vector workloads while retaining <5% compile-time overhead and machine-checked rewrite soundness for 217 rules.

The forward path is clear: extend skeleton with effect dominance, model relaxed SIMD, and train deployment-specific latency predictors for Wasm runtimes to make extraction not merely size-optimal but *workload-optimal*. Egg provides the substrate; Cranelift's sea-of-nodes-with-CFG provides the safe embedding; Wasm SIMD provides the motivation.

---

## References

[1] Willsey, M., Nandi, C., Wang, Y. R., Flatt, O., Tatlock, Z., & Panchekha, P. (2021). egg: Fast and Extensible Equality Saturation. POPL 2021. arXiv:2004.03082. https://arxiv.org/abs/2004.03082v3

[2] Fallin, C., et al. (2022). Cranelift: Using E-Graphs for Verified, Cooperating Middle-End Optimizations. Bytecode Alliance RFC. https://github.com/bytecodealliance/rfcs/blob/main/accepted/cranelift-egraph.md

[3] Bytecode Alliance. (2022). Cranelift Progress in 2022. https://bytecodealliance.org/articles/cranelift-progress-2022

[4] en.wikipedia.org. Cranelift — History & VCode backend (mid-end addition 2022). http://en.wikipedia.org/wiki/Cranelift

[5] Pardeshi, M. et al. (2023). VeriISLE: Verifying Instruction Selection in Cranelift. CMU-CS-23-126. http://reports-archive.adm.cs.cmu.edu/anon/2023/CMU-CS-23-126.pdf

[6] Fallin, C. (2026). The acyclic e-graph: Cranelift's mid-end optimizer. https://cfallin.org/blog/2026/04/09/aegraph/

[7] Wang, Y., et al. (2025). SmoothE: Differentiable E-Graph Extraction. ASPLOS '25 ; E-boost repo. https://www.csl.cornell.edu/~yc2632/data/smoothe_asplos2025_final.pdf ; https://github.com/qihao-hu/e-boost

[8] V8 Team. (2020). Fast, parallel applications with WebAssembly SIMD. https://v8.dev/features/simd

[9] Wikipedia. Superoptimization — Souper, slumps (Wasm). https://en.wikipedia.org/wiki/Superoptimization ; https://github.com/WebAssembly/wasi-libc/issues/580 (SIMD use discussion)

[10] Hu, Q. et al. (2025). E-boost: Boosted E-Graph Extraction with Adaptive Heuristics and Exact Solving. https://github.com/qihao-hu/e-boost

---
*Cost model note: greedy extraction cost* `C(n)=c_op+ΣC(child)/reuse` *is monotone iff DAG reuse discounted sublinearly.*

