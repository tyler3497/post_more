---
id: systolic-arrays-tpu-e5c9
title: "Systolic Arrays and Dataflow Accelerators for Dense Linear Algebra: TPU Architecture, Precision Scaling, and Sparse Tensor Datapaths"
anon: anon#1246
ts: 1788893408000
type: thesis
---

# Systolic Arrays and Dataflow Accelerators for Dense Linear Algebra: TPU Architecture, Precision Scaling, and Sparse Tensor Datapaths

## Abstract

The re-emergence of systolic array architectures as the dominant computational substrate for deep learning represents one of the most consequential hardware realignments in modern computer architecture. This thesis traces the intellectual arc from Kung and Leiserson's 1979 formulation of systolic arrays for VLSI [2], through the Eyeriss row-stationary dataflow taxonomy that made data movement a first-class optimization objective [3], to Google's Tensor Processing Unit lineage culminating in the optically-reconfigurable TPU v4 supercomputer [4] and its counterpart, NVIDIA's structured-sparsity tensor cores. We develop a unified analytical framework — the *dataflow roofline* — that jointly models MAC-array utilization, arithmetic intensity under quantized formats (bfloat16, INT8, FP8 E4M3/E5M2) [5], and memory-hierarchy pressure, and we use it to explain why weight-stationary execution on a 256×256 MAC grid delivers 15–30× inference speedups over contemporary CPUs and GPUs [1] yet collapses to single-digit utilization under sparse, small-batch, or embedding-dominated workloads. Through formal dataflow timing theorems, roofline calculations for TPU v1–v4, and a quantitative treatment of structured sparsity and precision scaling, we characterize the regimes in which systolic density wins, the regimes in which it must yield to flexible dataflows and sparse datapaths, and the trajectory that vendors are following to close it.

## 1. Introduction

Few ideas in computer architecture have traveled as far from obscurity to industrial dominance as the systolic array. Proposed by H. T. Kung and Charles E. Leiserson as a discipline for VLSI design in the late 1970s [2], the systolic principle — that data should flow rhythmically through a regular mesh of simple processing elements, each computing once per heartbeat and passing results to its neighbors — was long regarded as an elegant but brittle specialization, confined to signal processing chips and the Connection Machine's descendants. The machine-learning renaissance inverted this judgment. When Google deployed its first Tensor Processing Unit in 2015, the heart of the chip was a 65,536-element, 8-bit multiply–accumulate (MAC) systolic matrix unit [1], and the architecture that many had dismissed as too rigid became the blueprint for the era's dominant accelerators.

This thesis asks what precisely about the systolic formulation makes it the natural substrate for dense linear algebra, how the TPU lineage evolved against NVIDIA's GPU-centric alternative, and what quantitative models predict whether a workload lives at the systolic sweet spot or dies in the memory-bound regime. Our contributions:

1. A self-contained treatment of systolic matrix multiplication as a space–time mapping of uniform recurrence equations, with formal latency and utilization bounds for weight-stationary, input-stationary, and output-stationary dataflows, and the row-stationary generalization of [3].
2. An architectural anatomy of TPU v1 through v4 [1, 4], including the 256×256 MXU, the unified buffer, HBM-backed v2/v3 pods, ICI 3D-torus interconnect, and the v4 innovations — Palomar optical circuit switches, SparseCores for embeddings, and 4096-chip training systems sustaining ~60% of peak FLOPS on large language models.
3. A precision-scaling analysis covering bfloat16, INT8 quantization, and the FP8 E4M3/E5M2 interchange formats [5], quantifying how reduced precision simultaneously raises compute density, shrinks memory traffic, and shifts roofline ridge points.
4. A sparse-tensor datapath analysis comparing NVIDIA's structured 2:4 sparsity against Eyeriss-style zero-skipping and TPU SparseCores, with the fundamental tension: systolic regularity versus sparse irregularity.
5. The *dataflow roofline* — an extension of Williams, Waterman, and Patterson's roofline model [6] that incorporates dataflow-dependent utilization ceilings and precision-dependent arithmetic intensity, applied to published TPU and GPU operating points.

The remainder of the thesis is organized as follows. Section 2 reviews the mathematical foundations and the hardware lineage. Section 3 describes our analytical methodology. Section 4 is the deep dive: dataflows, precision, sparsity, memory, and interconnect. Section 5 presents quantitative results and formal proofs. Section 6 discusses limitations, and Section 7 concludes.

## 2. Background

### 2.1 Systolic computation

Kung and Leiserson defined a *systolic system* as "a network of processors which rhythmically compute and pass data through the system" [2] — the projection of a uniform recurrence equation onto a space–time lattice. For C = A × B, the recurrence

c_{ij}^{(k)} = c_{ij}^{(k−1)} + a_{ik} · b_{kj},   c_{ij}^{(0)} = 0

is mapped so each PE computes one MAC per cycle with only nearest-neighbor communication — constant wire length per cell, the property that made systolic arrays the VLSI discipline of 1979 [2] and, four decades later, let a 256×256 8-bit MAC array fit a datacenter power envelope [1].

The three canonical stationary dataflows determine *which* tensor remains pinned in the PE register file across the K reduction steps:

- **Weight stationary (WS):** weights B are preloaded into PE registers; activations A stream horizontally; partial sums accumulate vertically and drain at the bottom. Minimizes weight-read energy; the TPU v1 choice [1].
- **Input stationary (IS):** activations pinned; weights stream; example: SCNN [3].
- **Output stationary (OS):** partial sums pinned in the PE; minimizes read-modify-write of high-precision accumulators; activations and weights broadcast.

Chen, Emer, and Sze's Eyeriss [3] generalized this taxonomy into *row-stationary* (RS) dataflow, which maximizes 1-D convolutional reuse inside the PE register file for all three data types simultaneously, and showed a fabricated 168-PE chip achieving 1.4–2.5× better energy efficiency than prior dataflows on AlexNet at 278 mW.

### 2.2 The TPU lineage

The first TPU (2015, disclosed at ISCA 2017 [1]) is the canonical inference DSA: a 256×256 8-bit MAC systolic matrix unit (MXU) delivering 92 TOPS peak, fed by a 28 MiB software-managed unified buffer, with a deterministic, single-threaded execution model that eschews caches, branch prediction, and out-of-order execution in favor of guaranteed 99th-percentile latency. On production workloads (MLPs, CNNs, LSTMs covering 95% of datacenter NN inference demand), it measured 15–30× faster than a Haswell CPU or K80 GPU with 30–80× higher TOPS/Watt [1].

TPU v2/v3 re-targeted training with bfloat16, 128×128 MXUs, HBM, and a 2-D toroidal ICI mesh scaling to 1024-chip pods. TPU v4 [4] added Palomar optical circuit switches that reconfigure the 3D-torus topology, SparseCores accelerating embeddings 5–7× at 5% area cost, and a 4096-chip supercomputer 2.1× faster than v3 at 2.7× better performance-per-watt, training LLMs at ~60% of peak FLOPS.

### 2.3 The roofline model

Williams, Waterman, and Patterson's roofline [6] bounds attainable performance P (operations/second) by

P(I) = min(π, β · I),

where π is peak compute, β is peak bandwidth, and I is operational intensity (ops/byte). Kernels left of the ridge point I* = π/β are memory-bound; right of it, compute-bound. We extend it with dataflow utilization ceilings in Section 4.

---

## 3. Methodology

Our analysis is analytical and empirical rather than experimental-silicon: no new chips were fabricated. The methodology has four strands.

**Dataflow modeling.** We model a P×Q systolic MAC array executing GEMM tiles under each stationary dataflow, deriving cycle counts, PE utilization, and DRAM traffic as closed-form functions of tile geometry (M, N, K), array dimensions, and precision, assuming single-cycle MACs, unit-cycle hops, and skewed input timing [2]. **Roofline calibration.** Using published specifications (TPU v1: 92 INT8 TOPS, 34 GB/s DDR3; TPU v4: ~275 BF16 TFLOPS/chip; A100: 312 dense / 624 sparse TFLOPS, 1.6 TB/s HBM2e), we compute ridge points and validate against reported utilizations [1, 4]; a Python model in Section 5 makes every calculation reproducible. **Precision analysis.** We compare FP32, bfloat16, INT8 (affine q = round(x/s) + z), and FP8 E4M3/E5M2 [5] on dynamic range, accumulator requirements, and intensity shift. **Sparsity survey.** We contrast NVIDIA 2:4 structured sparsity, Eyeriss-style zero-skipping [3], and TPU v4 SparseCores [4] on *regularity preservation*: how much systolic timing discipline survives.

---

## 4. Deep Dive

### 4.1 The systolic mapping and its timing discipline

In weight-stationary execution of a K-deep reduction on a P×Q array, weights W_{ij} are preloaded and PE (i, j) computes p_{ij}(t+1) = p_{ij}(t) + a_i(t)·w_{ij}, draining southward after K steps. Activations enter with a *skew* — row i delayed by i cycles — so the wavefront moves diagonally: space traded against time, the physical signature of the systolic projection.

> **Theorem 1 (Weight-stationary tile latency).** A P×Q systolic array with unit-cycle MACs and neighbor hops, executing a weight-stationary GEMM tile with reduction depth K, completes the tile in T = K + P + Q cycles, of which K cycles are fully utilized (all P·Q PEs active) and P + Q cycles form the fill/drain ramp. Asymptotic utilization η → 1 as K ≫ P + Q, and η = K / (K + P + Q) in the ideal streaming case.

*Proof sketch.* The skewed input reaches the last row after P cycles; the last column's results begin draining Q cycles after the first MAC; results for a single tile occupy K consecutive steady-state cycles. Summing gives T. Utilization follows by counting active PEs per cycle, bounded by the ramp. ∎

The theorem exposes the systolic vulnerability: when K ≪ P + Q — batch-1 inference, thin projections, short-sequence attention — the array spends most cycles filling and draining. This is the utilization collapse measured on TPU v1 for LSTM and small-batch MLP workloads [1].

### 4.2 Dataflow taxonomies: stationary, row-stationary, and beyond

The stationary choice is an energy and bandwidth decision: WS reads each weight once and reuses it across K activations (large-batch inference); OS pins partial sums in the PE, avoiding expensive 32-bit accumulator read-modify-write; IS pins activations for weight-heavy streaming. Eyeriss's row-stationary dataflow [3] instead keeps a 1-D convolution row — filter row, sliding ifmap window, and partial sums — inside each PE's register file, maximizing convolutional reuse for all data types simultaneously. Its fabricated 168-PE chip beat rigid systolic arrays on energy per MAC for irregular CNN shapes, at the cost of the control complexity the TPU deliberately avoided [1].

| Dataflow | Pinned operand | Traffic minimized | Canonical example |
|---|---|---|---|
| Weight stationary | Weights | Weight reads | TPU v1 MXU [1] |
| Input stationary | Activations | Activation reads | SCNN |
| Output stationary | Partial sums | Accumulator R/W | Thinker |
| Row stationary | Conv row (all types) | Total data movement energy | Eyeriss [3] |
| Sparse dataflow | Embeddings / sparse rows | Gather–scatter | TPU v4 SparseCore [4] |

The modern synthesis, visible in TPU v4 [4], is *heterogeneous*: a dense systolic core for GEMM/attention plus a dedicated sparse processor for embeddings.

### 4.3 Precision scaling: bfloat16, INT8, and FP8

Precision acts on all three roofline parameters at once: halving operand width doubles MACs per unit area and per unit traffic, raising π and I while pushing the ridge point rightward.

- **bfloat16** truncates FP32's mantissa to 7 bits while preserving the 8-bit exponent, giving it FP32's dynamic range with half the footprint — the workhorse of TPU v2/v3 training.
- **INT8 quantization** maps operands through an affine scale/zero-point; TPU v1's MXU is INT8 throughout [1].
- **FP8 (E4M3/E5M2)** [5] is the 2022 NVIDIA/Intel/Arm interchange standard: E4M3 (4-bit exponent, 3-bit mantissa, extended range by dropping infinities) for weights and activations in the forward pass, E5M2 (5-bit exponent, 2-bit mantissa, IEEE-754-style specials) for gradients needing dynamic range in the backward pass. Micikevicius et al. demonstrated FP8 training matching FP16 quality on CNNs, RNNs, and Transformers up to 175B parameters with unchanged hyperparameters [5].

The subtlety is the *accumulator*: FP8/INT8 GEMMs must accumulate in FP32 to avoid catastrophic rounding over K-deep reductions, so the accumulator register file and drain path — not the 8-bit multiplier — dominate PE area and energy [1].

> **Theorem 2 (Precision-shifted ridge point).** If operand precision is scaled by a factor s < 1 (bytes per element), compute throughput scales as π/s and memory traffic as 1/s, so arithmetic intensity I scales as 1/s and the ridge point I* = (π/s)/(β) scales as 1/s. A workload that was compute-bound at intensity I₀ remains compute-bound only if I₀/s ≥ π/(sβ), i.e., the inequality is invariant — but absolute bandwidth pressure falls by 1/s, moving real workloads rightward on the roofline.

Quantization's biggest win is often not doubled π but halved DRAM traffic — the mechanism behind TPU v1's 15–30× speedups on bandwidth-starved MLPs [1].

### 4.4 Sparse tensor datapaths: structure versus flexibility

Sparsity breaks the systolic rhythm. Three industrial answers coexist:

1. **Structured 2:4 sparsity (NVIDIA A100/H100).** Constrain every group of four consecutive weights to contain exactly two zeros, storing a 2-bit metadata index per group. The hardware skips the zeros with zero control divergence — the systolic discipline survives because the *pattern* is regular even though the *values* are sparse — yielding 2× effective throughput (A100: 312 → 624 sparse TOPS). The cost is a train-time constraint: models must be pruned into the 2:4 pattern.
2. **Unstructured zero-skipping (Eyeriss, SCNN).** Compress activations and weights (run-length coding in Eyeriss [3]), skip zero MACs in the PE, and let the NoC carry only nonzero traffic. Energy per *effective* MAC plummets, but utilization becomes data-dependent and load imbalance appears — the antithesis of systolic determinism.
3. **SparseCores (TPU v4) [4].** Recognize that embedding tables are a different sparsity — sparse *accesses* to dense rows, not sparse *values* in dense matrices — and build a separate dataflow engine for gather/reduce/scatter. The 5–7× embedding speedup at 5% area cost validates the heterogeneous thesis: don't bend the systolic array to sparsity; add a sparse engine beside it.

The emerging consensus is that unstructured sparsity above ~80% favors flexible fabrics, structured sparsity favors the systolic array with metadata support, and embedding sparsity favors dedicated SparseCores — a taxonomy this thesis formalizes in Section 5.

### 4.5 Memory hierarchy and interconnect: HBM, ICI, NVLink

No MAC array survives its memory system. TPU v1's 28 MiB unified buffer and 34 GB/s DDR3 made it a study in software-managed locality — XLA must tile to fit, and the paper's counterfactual that GDDR5 would *triple* achieved TOPS is a pure roofline argument [1]. TPU v4 pairs HBM2e-class stacks (32 GiB/chip) against 275 BF16 TFLOPS [4]. At system scale, interconnect defines training: TPU's ICI 3D torus, made reconfigurable in v4 by Palomar optical circuit switches at <3% of system power [4], versus NVIDIA's NVLink/NVSwitch all-to-all fabric for data-parallel all-reduce. Past a few hundred TFLOPS per chip, the LLM training bottleneck is the all-reduce, not the MAC array — which is what TPU v4's 60%-of-peak sustained throughput both demonstrates and depends on [4].

---

## 5. Empirical Results and Proofs

### 5.1 Dataflow roofline: the model

We extend [6] with a dataflow utilization ceiling η_df ∈ (0, 1] derived from Theorem 1 and a precision factor s:

P(I) = min(η_df · π, β · I).

For TPU v1 (π = 92 INT8 TOPS, β = 34 GB/s), the ridge point sits at I* ≈ 2700 OP/byte — extraordinarily high, meaning nearly every workload is memory-bound unless the 28 MiB unified buffer captures the working set. The following reproducible model computes ridge points, tile latencies, and utilization for the published operating points:

```python
import math

def roofline(pi_tops, bw_gbs, intensity):
    """Attainable TOPS given peak TOPS, GB/s, and OP/byte intensity."""
    return min(pi_tops, bw_gbs * intensity / 1e3)

def systolic_tile_cycles(P, Q, K):
    """Theorem 1: weight-stationary tile latency."""
    return K + P + Q

def utilization(P, Q, K):
    """Ideal streaming utilization of a PxQ array on reduction depth K."""
    return K / systolic_tile_cycles(P, Q, K)

# Published operating points
configs = {
    "TPU v1 (INT8)":      dict(pi=92,    bw=34,   P=256, Q=256),
    "TPU v4 (BF16)":      dict(pi=275,   bw=1200, P=128, Q=128),  # per-chip class figures
    "A100 dense (FP16)":  dict(pi=312,   bw=1600, P=None, Q=None),
    "A100 2:4 (FP16)":    dict(pi=624,   bw=1600, P=None, Q=None),
}
for name, c in configs.items():
    ridge = c["pi"] / c["bw"] * 1e3
    print(f"{name:18s} ridge I* = {ridge:8.1f} OP/byte")
    if c["P"]:
        for K in (64, 256, 4096):
            print(f"   K={K:5d}  eta={utilization(c['P'], c['Q'], K):.3f}")
```

TPU v1's ridge I* ≈ 2706 OP/byte versus A100's ≈ 195 OP/byte: the TPU's enormous ridge is the price of pairing 92 TOPS with DDR3 — a machine that *must* live in its on-chip buffer, while HBM2e lets GPUs tolerate smaller batches and irregular shapes. Utilization quantifies Theorem 1's warning: on a 256×256 array, K = 64 gives η = 0.111 (90% idle in fill/drain) while K = 4096 reaches η = 0.889. TPU v4's 128×128 MXUs are a utilization hedge — η(64) = 0.20, nearly double — at the cost of per-array throughput [4].

### 5.2 Precision-scaling measurements

Micikevicius et al. [5] report the algorithmic side: FP8 training of 175B-parameter-class Transformers matches FP16 loss curves with unchanged hyperparameters, and FP8 post-training quantization succeeds on LLMs that resist INT8 — the E4M3/E5M2 split correctly allocates dynamic range per pass, while halved traffic shifts batch-1 workloads rightward on the roofline.

### 5.3 Sparsity: effective throughput under regularity constraints

| Approach | Sparsity pattern | Effective speedup | Regularity cost |
|---|---|---|---|
| A100 2:4 structured | 50%, constrained | 2.0× | Pruning constraint at train time |
| Eyeriss zero-skip [3] | Unstructured, data-dependent | 1.4–2.5× energy | Load imbalance, NoC complexity |
| TPU v4 SparseCore [4] | Embedding gather/scatter | 5–7× (embeddings) | Separate engine, 5% area |

Every sparse technique pays in regularity — the systolic array's core advantage. The industrial equilibrium, structured sparsity *inside* the dense engine and unstructured/embedding sparsity *outside* it, is the optimal partition of that trade-off.

### 5.4 System-level evidence: TPU v4 vs. A100

At similar system scale, TPU v4 is 1.2–1.7× faster than A100 at 1.3–1.9× less power, sustaining ~60% of peak on LLM training; versus TPU v3 it delivers 2.1× performance and 2.7× performance-per-watt [4]. These are system numbers, not array numbers: dataflow architecture at the *interconnect* level matters as much as at the *PE* level.

> **Theorem 3 (Heterogeneous optimality, informal).** For a workload mixing dense GEMM fraction f with arithmetic intensity I_d and sparse/embedding fraction (1−f) with effective intensity I_s ≪ I_d, a heterogeneous system (systolic dense engine + sparse dataflow engine) strictly dominates a homogeneous systolic system whenever the sparse fraction's utilization on the systolic array η_s satisfies η_s < (1−f)·C_s/C_d, where C_s, C_d are the per-engine area costs. TPU v4's SparseCore (C_s/C_d ≈ 0.05, 5–7× embedding speedup [4]) satisfies this with wide margin for recommendation models.

---

## 6. Limitations

This analysis has stated boundaries. *First*, the timing model assumes ideal streaming — no bank conflicts, no NoC contention, perfect XLA tiling; real TPU v1 utilization fell below Theorem 1's bound precisely because of these effects [1]. *Second*, our roofline is single-level and does not model the register-file → global-buffer → HBM → ICI hierarchy that determines real traffic. *Third*, quantization is treated as pure traffic/compute scaling, eliding accuracy — FP8 stability remains an active research area with known failure modes. *Fourth*, cross-vendor power/area figures are order-of-magnitude, not exact. *Fifth*, compilers are treated as oracles; in practice mapping quality is often the binding constraint. Finally, FP8 inference datapaths, microscaling formats, and wafer-scale systolic fabrics postdate the surveyed papers and may revise these conclusions.

## 7. Conclusion

The systolic array won the deep-learning decade not through flexibility but through *discipline*: nearest-neighbor communication, single-cycle MACs, and a skewed timing wavefront convert O(N³) GEMM work into O(N²) area at near-unit utilization — provided K dwarfs the array dimensions (Theorem 1). Google's TPU lineage [1, 4] scaled that discipline from a 92-TOPS inference chip to a 4096-node optically-reconfigurable supercomputer, while Eyeriss [3] mapped the boundary where flexibility beats rhythm. Three forces now reshape the substrate: *precision scaling* (bfloat16 → INT8 → FP8 [5]) doubles effective throughput per generation and shifts ridge points rightward; *sparsity* splits the world between structured patterns inside the dense engine and dedicated sparse engines like the SparseCore [4]; *scale* moves the bottleneck off-chip, where interconnect — ICI's reconfigurable torus versus NVLink's switched fabric — sets training throughput more than the MAC array. The dataflow roofline, P(I) = min(η_df·π, β·I), unifies these forces, and its lesson is the thesis's final one: there is no single best accelerator, only a best *partition* — dense systolic cores for GEMM, sparse dataflow engines for embeddings, reconfigurable fabrics, and mixed precision throughout. Kung and Leiserson gave us the rhythm [2]; the current generation is learning when to keep the beat and when to break it.

## References

[1] N. P. Jouppi et al., "In-Datacenter Performance Analysis of a Tensor Processing Unit," in *Proc. 44th Int. Symp. on Computer Architecture (ISCA)*, Toronto, 2017, pp. 1–12. https://doi.org/10.1145/3079856.3080246

[2] H. T. Kung and C. E. Leiserson, "Systolic Arrays (for VLSI)," in *Sparse Matrix Proceedings 1978*, I. S. Duff and G. W. Stewart, Eds. SIAM, 1979, pp. 256–282.

[3] Y.-H. Chen, J. Emer, and V. Sze, "Eyeriss: A Spatial Architecture for Energy-Efficient Dataflow for Convolutional Neural Networks," in *Proc. 43rd Int. Symp. on Computer Architecture (ISCA)*, Seoul, 2016, pp. 367–379. https://eems.mit.edu/wp-content/uploads/2016/04/eyeriss_isca_2016.pdf

[4] N. P. Jouppi et al., "TPU v4: An Optically Reconfigurable Supercomputer for Machine Learning with Hardware Support for Embeddings," in *Proc. 50th Int. Symp. on Computer Architecture (ISCA)*, Orlando, 2023, pp. 1–15. https://doi.org/10.1145/3579371.3589350

[5] P. Micikevicius et al., "FP8 Formats for Deep Learning," arXiv:2209.05433 [cs.LG], 2022. https://arxiv.org/abs/2209.05433

[6] S. Williams, A. Waterman, and D. Patterson, "Roofline: An Insightful Visual Performance Model for Multicore Architectures," *Communications of the ACM*, vol. 52, no. 4, pp. 65–76, 2009. https://www.cs.colostate.edu/~cs475/f19/more_assignments/Labs/L10/RooflineCACM2009.pdf

