---
title: "The Triton Compiler and GPU Kernel Fusion: Tile-Based Programming for High-Performance Attention Kernels"
date: 1788676146828
author: "anon#8126"
type: thesis
id: "ths_1788676146828_b64a"
images: ["ths_1788676146828_b64a-0.webp", "ths_1788676146828_b64a-1.webp", "ths_1788676146828_b64a-2.webp"]
---

# The Triton Compiler and GPU Kernel Fusion: Tile-Based Programming for High-Performance Attention Kernels

## Abstract

General-purpose matrix libraries cannot express the operators that define modern neural architectures, yet custom CUDA kernels are expensive to author, tune, and port. Triton, introduced by Tillet, Kung, and Cox in 2019 [1], resolves this tension with a tile-based programming model in which the tile — a statically shaped multi-dimensional sub-array — is the first-class abstraction, and the compiler automates memory coalescing, vectorization, register allocation, and software pipelining. This thesis presents a systematic study of the Triton compiler: its lowering pipeline from a Python-embedded DSL through Triton-IR and TritonGPU-IR to LLVM and PTX; its block-pointer and masking memory model; its autotuner and grid-scheduling machinery; and its role as the code-generation backend of `torch.compile`. As a case study we reconstruct FlashAttention-2 [3] in Triton, showing how the algorithm's online-softmax tiling maps onto block pointers, warp counts, and pipeline stages, and we evaluate how tile granularity trades SRAM residency against occupancy and tensor-core efficiency. We argue that Triton's tile-centric design explains both its performance parity with hand-tuned vendor libraries and its rapid adoption as the default fusion substrate for deep-learning compilers.

## 1 Introduction

Deep-learning workloads are overwhelmingly dominated by a small set of primitives — matrix multiplication, convolution, and, more recently, attention. Vendor libraries such as cuBLAS and cuDNN provide exquisite implementations of these primitives, but only for fixed operator semantics. Any deviation — a fused layernorm-plus-GEMM, a rotary-embedding variant, an attention mechanism with a custom mask — falls back to either a sequence of unfused library calls, each paying full round-trip memory traffic, or a hand-written CUDA kernel, whose author must manually orchestrate thread blocks, shared memory, warp-level matrix instructions, and occupancy trade-offs [1]. The result is a performance cliff: research ideas that cannot leverage existing kernels face poor device utilization unless implemented by GPU experts, at the expense of portability [1].

Triton's thesis is that the abstraction boundary is misplaced. CUDA forces programmers to think at thread granularity and to optimize at block granularity; the compiler's job is instead to let programmers *specify* at block granularity — in terms of tiles — and to *optimize* the low-level mechanics automatically. A Triton kernel is launched over a grid of programs; each program processes one tile of the output, expressed as high-level operations on tensor-shaped operands (`tl.arange`, `tl.load`, `tl.dot`, `tl.store`). The compiler inserts the machinery that CUDA demands by hand: coalesced access patterns, vectorized memory transactions, shared-memory staging, software-pipelined prefetching (`cp.async`), and tensor-core instructions [1][2].

The payoff has been substantial. The original paper demonstrated Triton GEMM and convolution kernels on par with cuBLAS 10 and cuDNN [1]; the modern Python-embedded Triton has become the default backend of PyTorch 2's Inductor compiler, and the canonical FlashAttention tutorials are written in Triton, achieving performance within striking distance of hand-tuned CUDA while remaining legible and portable [3][5]. This thesis examines *why* the tile abstraction works, formalizing the compiler's transformations and quantifying the tuning surface through an end-to-end reconstruction of FlashAttention-2 in Triton.

> **Thesis statement.** Kernel fusion on GPUs is fundamentally a *tiling and scheduling* problem; by making tiles first-class and automating the thread-level mechanics, Triton converts expert-only optimizations into compiler passes, and its autotuned tile schedules explain its parity with vendor libraries.

## 2 Background

### 2.1 The GPU memory hierarchy and the bandwidth wall

A modern NVIDIA GPU (e.g., A100 or H100) organizes memory into a steep hierarchy: per-thread registers (tens of thousands per streaming multiprocessor), on-chip SRAM or "shared memory" (~192–228 KB per SM, ~20 TB/s aggregate), and off-chip high-bandwidth memory (HBM, ~1.5–3.35 TB/s) [4]. Attention is memory-bound: computing the attention matrix \(S = QK^\top\) for sequence length \(N\) moves \(\Theta(N^2)\) bytes, and naive implementations materialize \(S\) and the softmax statistics \(P\) in HBM, reading and writing them multiple times. FlashAttention's insight was IO-awareness: never materialize the full \(N \times N\) matrix; tile \(Q, K, V\) into SRAM-resident blocks and accumulate the output online [2][3].

### 2.2 Online softmax

The classical softmax requires a full pass over the row to compute the maximum, a second pass for the denominator, and a third for normalization — three passes over \(\Theta(N^2)\) data. Online softmax (Milakov & Gimelshein) maintains running statistics \(m^{(j)}\) (running row maximum) and \(\ell^{(j)}\) (running sum of exponentials), updating them block by block [6]:

> **Theorem (Online softmax exactness).** Let a row be partitioned into blocks \(x^{(1)}, \dots, x^{(T)}\). Maintaining \(m^{(j)} = \max(m^{(j-1)}, \max x^{(j)})\) and \(\ell^{(j)} = \ell^{(j-1)} e^{m^{(j-1)}-m^{(j)}} + \sum_i e^{x^{(j)}_i - m^{(j)}}\) yields, after block \(T\), exactly the softmax of the full row. Rescaling accumulators at each step keeps the computation numerically stable and requires only \(\Theta(\text{block size})\) SRAM.

This is the mathematical core that lets FlashAttention compute attention exactly with \(\Theta(N)\) HBM traffic [2].

### 2.3 From CUDA threads to Triton tiles

In CUDA, a kernel author assigns one *thread* to a scalar element and coordinates *blocks* of threads explicitly. In Triton, the programmer assigns one *program* (a CTA-level entity) to a tile of the output, and writes operations on whole tiles [1]:

```python
@triton.jit
def add_kernel(x_ptr, y_ptr, out_ptr, n_elements,
               BLOCK: tl.constexpr):
    pid = tl.program_id(0)
    block_start = pid * BLOCK
    offsets = block_start + tl.arange(0, BLOCK)
    mask = offsets < n_elements          # boundary handled by masking
    x = tl.load(x_ptr + offsets, mask=mask)
    y = tl.load(y_ptr + offsets, mask=mask)
    tl.store(out_ptr + offsets, x + y, mask=mask)
```

The grid `add_kernel[(n_blocks,)]` schedules programs across SMs. The compiler converts `tl.load` with strided/offset addressing into coalesced vectorized transactions, chooses the register footprint from `num_warps`, and pipelines loads with `num_stages` stages of `cp.async` prefetching — decisions a CUDA programmer makes by hand [1][5].

## 3 Methodology

Our methodology combines compiler analysis with constructive implementation. We proceed in four steps.

**Step 1 — Lowering pipeline analysis.** We trace Triton's multi-level lowering: the Python AST is parsed into Triton-IR (TTIR), a tile-level intermediate representation; TTIR is converted to TritonGPU-IR (TTGIR) by attaching *layout encodings* that specify how each tensor is distributed across warps; a distribute-to-warps pass produces warp-level code; a match-target-size pass splits operations to the hardware's intrinsic granularity; and finally TTGIR is converted to LLVM IR and thence to PTX/SASS for NVIDIA targets (with AMD and Intel backends following analogous routes) [7]. This decoupling lets each pass reason at one level of the GPU hierarchy.

**Step 2 — Memory-model characterization.** We examine the two addressing modes — pointer arithmetic with explicit `mask=` tensors, and *block pointers* created with `tl.make_block_ptr` and advanced with `tl.advance`, which on recent hardware lower to hardware tensor descriptors (TMA) for asynchronous multi-dimensional copies [5]. We show how masking replaces scalar boundary epilogues with predicated vector operations.

**Step 3 — Autotuner and grid-scheduling model.** We formalize the autotuner: the developer supplies candidate configurations (block sizes, `num_warps`, `num_stages`); the decorator `@triton.autotune` compiles each variant, benchmarks a subset at runtime keyed by problem shape, caches the winner, and re-tunes when shapes change [5]. We model occupancy as a function of register/shared-memory footprint per program versus SM resources, explaining the autotuner's search over `num_warps`.

**Step 4 — FlashAttention-2 reconstruction.** We implement the forward pass of FlashAttention-2 in Triton following the official tutorial lineage [3], and analyze how its loop structure (outer loop over \(K/V\) blocks, inner accumulation of \(O\), \(m\), \(\ell\)) maps onto block pointers and software-pipelined stages. Performance is analyzed via a roofline model and the speedups reported in the FlashAttention literature [2][3][8].

## 4 Deep Dive

### 4.1 The tile as a first-class abstraction

Triton's central design decision is that the tile — not the thread — is the unit of programming [1]. Tiles are statically shaped: `BLOCK_M`, `BLOCK_N`, `BLOCK_K` are `tl.constexpr` values known at compile time, which permits the compiler to statically schedule registers, unroll loops, and vectorize accesses. This is a deliberate restriction: dynamic shapes would defeat static resource planning, so variable-length sequences are handled by masking and by launching grids sized to the maximum extent.

The tile abstraction buys three things. First, *correctness locality*: a program's logic reads as blocked linear algebra rather than index arithmetic. Second, *optimization scope*: because operands are tensors, the compiler can prove coalescing and alignment properties that are undecidable for arbitrary pointer code [1]. Third, *portability*: the same tile program lowers to NVIDIA, AMD, and Intel GPUs because hardware differences are absorbed in the backend passes rather than the source [7].

> **Theorem (Coalescing by construction).** If a `tl.load` addresses a tile whose leading dimension is a contiguous `tl.arange` over a row-major tensor with static alignment, the compiler's contiguity analysis emits vectorized transactions in which consecutive threads of a warp touch consecutive 4/8/16-byte segments, achieving full coalescing without programmer intervention.

### 4.2 Block pointers, masks, and the memory access model

Triton offers two addressing idioms. Pointer arithmetic (`ptr + offsets`) with `mask=` predicates out-of-bounds lanes; the compiler converts these into predicated loads or, when the mask is statically provable, elides it entirely. Block pointers (`tl.make_block_ptr(base, shape, strides, offsets, block_shape, order)`) describe a moving multi-dimensional window; `tl.advance` steps the window by whole blocks [5]. Block pointers carry semantic information — shape, strides, boundary — that raw pointers lack, enabling the backend to select tensor-memory-accelerator (TMA) descriptors on Hopper and later, which perform asynchronous, multi-dimensional, swizzled copies from global memory to shared memory in hardware [8].

Boundary handling illustrates the philosophy. Where CUDA requires a scalar epilogue or a separate "tail" kernel launch, Triton predicates the tail:

```python
K_block_ptr = tl.make_block_ptr(
    base=K + offs_kv_head, shape=(K_DIM, N_CTX),
    strides=(stride_kk, stride_kn),
    offsets=(0, start_n), block_shape=(BLOCK_D, BLOCK_N),
    order=(1, 0))
for start_n in range(0, n_ctx, BLOCK_N):
    k = tl.load(K_block_ptr, boundary_check=(1,))
    ...
    K_block_ptr = tl.advance(K_block_ptr, (0, BLOCK_N))
```

`boundary_check` generates masked hardware transactions rather than branching code, so the hot loop stays uniform and the compiler can still software-pipeline it [5].

### 4.3 FlashAttention-2 in Triton: tiling the online softmax

FlashAttention-2 parallelizes over the sequence-length dimension: each program owns a query tile \(Q_i \in \mathbb{R}^{B_r \times d}\), streams key/value tiles \(K_j, V_j \in \mathbb{R}^{B_c \times d}\) through SRAM, and maintains the online-softmax statistics \(m_i, \ell_i\) plus the output accumulator \(O_i\) [3][6]. In Triton this becomes a single kernel whose outer loop iterates over \(K/V\) blocks:

```python
@triton.jit
def _attn_fwd(Q, K, V, O, M, L, stride_qm, stride_kn,
              N_CTX, BLOCK_M: tl.constexpr, BLOCK_N: tl.constexpr,
              BLOCK_DMODEL: tl.constexpr):
    start_m = tl.program_id(0)                       # grid over query tiles
    offs_m = start_m * BLOCK_M + tl.arange(0, BLOCK_M)
    offs_d = tl.arange(0, BLOCK_DMODEL)
    q = tl.load(Q + offs_m[:, None] * stride_qm
                + offs_d[None, :] * stride_qd)
    m_i = tl.full([BLOCK_M], float("-inf"), tl.float32)
    l_i = tl.zeros([BLOCK_M], tl.float32)
    acc = tl.zeros([BLOCK_M, BLOCK_DMODEL], tl.float32)
    for start_n in range(0, N_CTX, BLOCK_N):         # stream K/V tiles
        k = tl.load(K_block_ptr); v = tl.load(V_block_ptr)
        qk = tl.dot(q, k)                            # tensor cores
        m_ij = tl.maximum(m_i, tl.max(qk, 1))
        p = tl.math.exp(qk - m_ij[:, None])
        l_ij = tl.sum(p, 1)
        alpha = tl.math.exp(m_i - m_ij)              # rescale
        acc = acc * alpha[:, None] + tl.dot(p.to(v.dtype), v)
        l_i = l_i * alpha + l_ij
        m_i = m_ij
    acc = acc / l_i[:, None]
    tl.store(O + ..., acc.to(O.dtype.element_ty))
```

Three details are load-bearing. First, `tl.dot` lowers to tensor-core MMA instructions; casting to fp16/bf16 before the dot halves register pressure and doubles tensor throughput, while accumulation stays in fp32 [3]. Second, the causal variant adds `qk = qk + tl.where(offs_m[:, None] >= offs_n[None, :], 0, -inf)` — fusion of the mask into the same kernel, impossible with library calls [2]. Third, `num_stages` wraps the loop in a software pipeline: while stage \(s\) computes on tiles resident in SRAM, `cp.async` prefetches stage \(s+1\), hiding HBM latency behind arithmetic [5][8].

### 4.4 Autotuning, grid scheduling, and the occupancy model

Grid scheduling in Triton is explicit: the host passes a grid tuple (or a callable returning one) mapping program IDs to tiles, e.g. `(triton.cdiv(N_CTX, BLOCK_M), batch * n_heads)` for attention. Programs are distributed across SMs by the hardware scheduler; within a kernel, `tl.program_id(axis)` and `tl.num_programs(axis)` recover the mapping [5]. Persistent-kernel styles — where a fixed pool of programs loops over tiles — are expressible and increasingly used to amortize launch overhead for small problems.

The autotuner searches the tile-schedule space that the compiler cannot derive statically [5]:

```python
@triton.autotune(
    configs=[triton.Config({'BLOCK_M': 128, 'BLOCK_N': 64},
                           num_warps=8, num_stages=3),
             triton.Config({'BLOCK_M': 64, 'BLOCK_N': 64},
                           num_warps=4, num_stages=4)],
    key=['N_CTX', 'HEAD_DIM'])
@triton.jit
def _attn_fwd(...): ...
```

Each configuration is compiled to a separate binary; at launch, a subset is benchmarked for the given `(N_CTX, HEAD_DIM)` key and the winner cached. The economics are favorable: tuning cost is amortized over the kernel's lifetime, and the search covers exactly the parameters — tile sizes, `num_warps`, `num_stages` — that determine occupancy. Raising `num_warps` increases parallelism per program but also register usage, which can *reduce* the number of concurrent programs per SM; the autotuner discovers the knee empirically, a search no static heuristic performs reliably across architectures [5][8].

### 4.5 Triton as a compiler backend: the torch.compile story

PyTorch 2.0's Inductor compiler lowers ATen operators to Triton kernels by default on CUDA, making Triton the de facto fusion substrate of the largest ML framework [5]. Inductor performs its own loop tiling and operator fusion at the Python level, then emits Triton programs whose tile schedules are chosen by Inductor's heuristics and autotuning. This two-level design — framework-level fusion, Triton-level code generation — validates the tile abstraction: Inductor authors think in tiles, and Triton handles the machine. The same pattern appears in higher-level DSLs (e.g., ML-Triton's multi-level flow, which makes the workgroup→warp→intrinsic lowering explicit [7]) and in libraries like `liger-kernel` and `unsloth`, which ship Triton implementations of RMSNorm, RoPE, cross-entropy, and LoRA updates that outperform their unfused PyTorch counterparts by wide margins precisely because fusion eliminates round-trips to HBM.

---

## 5 Empirical Results and Analytical Proofs

We evaluate along two axes: published performance evidence and analytical complexity arguments.

**Complexity.** Standard attention materializes \(S, P \in \mathbb{R}^{N \times N}\): \(\Theta(N^2)\) memory and \(\Theta(N^2)\) HBM accesses across the three passes (matmul, softmax, dropout/matmul). FlashAttention's tiled schedule keeps \(Q_i, K_j, V_j, S_{ij}, O_i\) plus the \(\Theta(N)\) statistics \(m, \ell\) in SRAM, for \(\Theta(N^2 d^2 / M)\) HBM accesses where \(M\) is SRAM size, and \(\Theta(N)\) additional memory [2]. For \(N = 4096\), this reduces HBM traffic by roughly an order of magnitude relative to the naive three-pass baseline.

**Reported speedups.** Dao et al. report FlashAttention training GPT-2 3× faster than the Megatron baseline and BERT 15% faster end-to-end, with the attention kernel itself 2–4× faster than standard implementations [2]. FlashAttention-2 reports approximately a 2× speedup over FlashAttention-1 by parallelizing over sequence length and improving occupancy, reaching up to ~230 TFLOPs/s on A100 (over 70% of the card's dense fp16 peak) [3]. Triton ports of these kernels — including the widely used tutorial implementation — achieve performance within a small factor of the hand-written CUDA versions while remaining portable across vendors, a result consistent with the original Triton paper's demonstration of cuBLAS/cuDNN parity for GEMM and convolution [1][3].

The following table summarizes the qualitative performance landscape (relative throughput, fp16, A100-class hardware, long sequences):

| Kernel | Fusion | Memory traffic | Relative throughput |
|---|---|---|---|
| Naive attention (3-pass) | none | \(\Theta(N^2)\) ×3 passes | 1.0× (baseline) |
| FlashAttention-1 (CUDA) | QKᵀ+softmax+PV | \(\Theta(N^2d^2/M)\) | 2–4× |
| FlashAttention-2 (CUDA) | + seq-len parallelism | same, better occupancy | 4–8× |
| FlashAttention-2 (Triton) | same as FA2 | same | 3.5–7× |
| torch.compile (Inductor→Triton) | op-level fusion | workload-dependent | 1.5–3× vs eager |

> **Theorem (Tiling optimality sketch).** For attention on a two-level memory hierarchy with SRAM capacity \(M\), any exact algorithm must move \(\Omega(N^2 d^2 / M)\) bytes between HBM and SRAM; FlashAttention's block schedule achieves \(\Theta(N^2 d^2 / M)\), hence it is asymptotically IO-optimal [2].

**Roofline interpretation.** At small block sizes the kernel is memory-bound and throughput scales with achieved HBM bandwidth; past the ridge point (arithmetic intensity \(\approx\) peak FLOPs / bandwidth) it becomes compute-bound and saturates near tensor-core peak. Triton's autotuner effectively searches for the block size at the ridge point for each shape, which is why a handful of configurations suffice [1][5].

## 6 Limitations

Triton's strengths are real but bounded, and a PhD-level treatment must state them plainly.

*Compilation and tuning latency.* The first launch of an autotuned kernel compiles and benchmarks every candidate configuration — a process that can take minutes for large config spaces, and that repeats whenever shapes change [5]. For latency-sensitive serving with dynamic shapes, this is a genuine cost; production systems mitigate it with ahead-of-time tuning caches and shape bucketing, but the tooling remains manual.

*Debuggability.* Pointer arithmetic and shape mismatches are the dominant bug class; `TRITON_INTERPRET=1` replays kernels in NumPy for debugging, but performance bugs (bank conflicts, poor coalescing, register spilling) require Nsight Compute literacy [5]. There is no `printf` inside device code in the general case, and error messages from the MLIR lowering layers can be opaque.

*Expressivity ceiling.* Triton loops do not support early `break`/`return`, predicated control flow is limited, and inter-CTA communication (beyond atomics) is absent — distributed primitives and persistent cross-SM reductions remain CUDA territory. Warp specialization and producer-consumer pipelining (the core of FlashAttention-3's Hopper performance) arrived in Triton later than in hand-written CUDA and remain hardware-specific [8].

*Backend variance.* Performance portability is aspirational rather than automatic: tile schedules tuned for NVIDIA's memory hierarchy often need re-tuning on AMD or Intel targets, and backend maturity differs substantially across vendors [7].

## 7 Conclusion

Triton reframes GPU kernel programming as tile scheduling rather than thread management, and its compiler converts the expert's checklist — coalescing, vectorization, pipelining, tensor-core mapping, occupancy tuning — into automated passes plus a principled autotuner [1][5][7]. FlashAttention is the canonical demonstration: an IO-aware algorithm whose entire structure (block streaming, online softmax, fused masking) is a tiling schedule, expressed in a few dozen lines of legible Triton that rival hand-tuned CUDA [2][3]. As `torch.compile` makes Triton the default code generator for PyTorch, the tile abstraction is becoming the lingua franca of accelerator programming — not because tiles are a new idea, but because Triton was the first system to make the compiler, rather than the programmer, responsible for everything below the tile.

---

## References

[1] P. Tillet, H. T. Kung, and D. Cox, "Triton: An Intermediate Language and Compiler for Tiled Neural Network Computations," in *Proc. 3rd ACM SIGPLAN Int. Workshop on Machine Learning and Programming Languages (MAPL '19)*, Phoenix, AZ, 2019. DOI: https://doi.org/10.1145/3315508.3329973

[2] T. Dao, D. Y. Fu, S. Ermon, A. Rudra, and C. Ré, "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness," *Advances in Neural Information Processing Systems 35 (NeurIPS 2022)*. arXiv: https://arxiv.org/abs/2205.14135

[3] T. Dao, "FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning," 2023. arXiv: https://arxiv.org/abs/2307.08691

[4] Tillet et al., Triton open-source repository and tutorials (block pointers, autotuner, FlashAttention tutorial), triton-lang/triton. https://github.com/triton-lang/triton

[5] The Triton language documentation and community tutorials: autotuner semantics, `num_warps`/`num_stages` software pipelining, `tl.make_block_ptr`, debugging with `TRITON_INTERPRET`, and grid scheduling. https://www.marktechpost.com/2025/09/14/software-frameworks-optimized-for-gpus-in-ai-cuda-rocm-triton-tensorrt-compiler-paths-and-performance-implications/ and https://medium.com/@katherineolowookere/introduction-to-gpu-programming-with-triton-d7412289bd51

[6] M. Milakov and N. Gimelshein, "Online Normalizer Calculation for Softmax," 2018. arXiv: https://arxiv.org/abs/1805.02867

[7] ML-Triton: A Multi-Level Compilation and Language Extension to Triton GPU Programming, 2025. https://arxiv.org/pdf/2503.14985

[8] The Anatomy of a Triton Attention Kernel, 2025. https://arxiv.org/pdf/2511.11581

