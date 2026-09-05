---
{
 "id": "ths_1788600535773_40d6",
 "title": "The RISC-V Vector Extension as a Vector-Length-Agnostic ISA: LMUL Register Grouping, Stripmining and Chaining, LLVM Autovectorization, and Roofline Characterization on the Many-Lane Ara Implementation",
 "anon": "anon#6553",
 "ts": 1788600535773,
 "type": "thesis",
 "images": [
  "ths_1788600535773_40d6-0.webp",
  "ths_1788600535773_40d6-1.webp",
  "ths_1788600535773_40d6-2.webp",
  "ths_1788600535773_40d6-3.webp"
 ]
}
---

# The RISC-V Vector Extension as a Vector-Length-Agnostic ISA: LMUL Register Grouping, Stripmining and Chaining, LLVM Autovectorization, and Roofline Characterization on the Many-Lane Ara Implementation

## Abstract

The ratified RISC-V Vector ("V") extension introduces a **vector-length-agnostic** (VLA) model in which the same binary operates on hardware with any vector register width. This thesis develops a complete account of the extension's central mechanisms: *LMUL register grouping*, which fuses up to eight architectural registers into a single logical operand to raise VLMAX and amortize issue overhead; the *stripmining* discipline, inherited from classical vector machines, that maps arbitrary-length loops onto the `vsetvli`/`vsetvl` vector-length setting idiom; *chaining*, the element-granular forwarding that fuses consecutive vector instructions into convoys; the LLVM autovectorization pipeline (loop vectorizer, VPlan, scalable `vscale` types) that emits RVV from scalar C; and a *roofline* methodology for characterizing throughput versus memory bandwidth. These threads are anchored empirically in the **Ara** many-lane vector processor family developed at ETH Zürich by Cavalcante et al., whose 2–16-lane open-source implementations of RVV achieve more than 98.5% FPU utilization and up to 41 DP-GFLOPS/W. We derive stripmine cost equations, the LMUL–VLMAX identity, and a chaining theorem, and show how roofline analysis exposes the scalar issue-rate bound that limits short-vector kernels on Ara2 [1][2][3][4][5][6].

---

## 1. Introduction

For four decades, vector architectures have offered the most energy-efficient path to data-level parallelism: a single instruction streams through dozens of data elements, amortizing fetch, decode, and dispatch over an entire *convoy* of work rather than over individual scalars [5]. Yet classical vector ISAs (Cray, NEC SX, AltiVec) fixed their vector length in the architecture, forcing software to recompile for each hardware generation. The RISC-V "V" extension, ratified as version 1.0 in 2021, adopts the opposite stance: **vector-length agnosticism**, in which `VLEN` — the bit-width of each of the 32 architectural vector registers — is an implementation parameter ranging from 128 to 65,536 bits, and binaries adapt at run time through a disciplined vector-length setting instruction [1].

This thesis addresses four tightly coupled questions that determine whether this ISA design actually delivers performance in practice:

1. **How does LMUL register grouping expose longer effective vectors without widening the physical register file, and what does the resulting `VLMAX` identity imply for compiler cost models?**
2. **How do stripmining and chaining — mechanisms dating to the Cray-1 and formalized in Asanović's thesis [5] — survive in a VLA ISA, and what are the quantitative overheads per strip?**
3. **How does LLVM's autovectorizer, with its scalable-vector `vscale` type system and VPlan recipe machinery, lower scalar loops onto RVV without knowing `VLEN` at compile time?**
4. **How does the roofline model characterize the many-lane Ara processor [2][3][4], and which bounds (compute, bandwidth, or scalar issue rate) dominate in practice?**

Our running example is **Ara**, the ETH Zürich open-source vector processor. The original Ara implements an RVV 0.5 draft on 2–16 identical lanes in 22 nm FD-SOI, exceeding 1 GHz and reaching 33 DP-GFLOPS with 41 DP-GFLOPS/W energy efficiency [2]; "New Ara" ports the design to the frozen RVV 1.0 ISA with 15% better area and >98.5% FPU utilization [3]; and **Ara2** (2023) adds scalar–vector memory coherence and multi-core exploration, sustaining 95% average functional-unit utilization on compute kernels and 37.8 DP-GFLOPS/W at 1.35 GHz [4]. Together these provide an empirical anchor rare in ISA research: a freely available, silicon-validated many-lane machine against which every abstraction in this thesis can be tested.

> **Thesis statement:** Vector-length agnosticism, register grouping, stripmining, and chaining are not independent ISA features but a single *parameterized execution contract* between compiler and microarchitecture; its cost is fully described by the identities $VLMAX = LMUL \cdot VLEN / SEW$, the stripmine recurrence, and the convoy/chime execution model, and its realization quality is measurable by where kernels land on the Ara roofline.

## 2. Background

### 2.1 The classical vector model

Asanović's *Vector Microprocessors* (1998) defines the canonical model we reuse throughout [5]. A vector instruction operates on up to `MVL` (maximum vector length) elements; the actual count is held in a **vector length register** `VL`, implicitly read by every vector instruction. When an application vector exceeds `MVL`, the compiler applies **stripmining**: it cuts the iteration space into blocks of at most `MVL` and wraps the vector sequence in an outer loop, each iteration re-setting `VL` to the block size [5][6]. Dependent vector instructions overlap element-wise through **chaining** — element *i* of a producer forwards directly into the consumer's pipeline rather than waiting for the entire vector — so that instructions form **convoys** (the vector analogue of basic blocks), executed at **chime** time $T_{chime}$ per vector operation [6].

### 2.2 RISC-V Vector 1.0: a VLA design

The ratified specification [1] encodes these classical ideas with a modern, agnostic twist:

- **Register file:** 32 vector registers `v0`–`v31`, each `VLEN` bits wide (`VLEN ≥ 128`), plus mask register `v0` and a configuration state `vtype` (SEW, LMUL) and `vl` (current vector length).
- **Length setting:** `vsetvli rd, rs1, vtypei` reads the *application vector length* (AVL) from a scalar register, computes $vl = \min(\text{AVL}, \text{VLMAX})$, writes `vl` to both the `vl` CSR and `rd`, and returns the new AVL as `rd − vl` by decrementing — the canonical idiom collapses the stripmine loop update into one instruction [1].
- **Register grouping:** `vlmul` in `vtype` groups 1, 2, 4, or 8 registers (LMUL ∈ {1, 2, 4, 8}, plus fractional 1/2, 1/4, 1/8) into one logical register group; within a group, elements are striped contiguously across the constituent registers [1].
- **Predication:** every instruction carries an optional mask (`v0.t`), and `vl` tail elements are governed by the *undisturbed* (`mu`/`tu`) or *agnostic* policies.

A HotChips 2019 overview of the draft extension emphasizes the intent: arbitrary `VLEN`, mixed-precision widening/narrowing, and unit-stride/strided/indexed memory operations give a single binary portability from embedded cores to supercomputers [7].

### 2.3 Ara: a many-lane RVV implementation

Ara couples the open-source **CVA6** scalar core to a parametric vector unit of $L \in \{2,4,8,16\}$ identical **lanes** [2]. Each lane holds a slice of the vector register file (element $i$ lives in lane $i \bmod L$) plus a pipelined FPU, ALU, and slide/mask unit; a shared dispatcher broadcasts decoded instructions and broadcasts scalars to all lanes. The original Ara paper reports 97% FPU utilization on a 256×256 DP matrix multiply with 16 lanes, 33 DP-GFLOPS at >1 GHz, and 41 DP-GFLOPS/W in GlobalFoundries 22FDX [2]. New Ara updated the design to RVV 1.0 semantics — including fractional LMUL, tail/mask policies, and segmented operations — and Ara2 added a write-through L1 with vector-store invalidation counters to restore the ISA-mandated coherent scalar–vector memory view without fences [3][4].

---

## 3. Methodology

Our method is *specification-grounded and empirically anchored*: every analytical claim is derived from the ratified spec [1] or classical vector theory [5][6], and every quantitative claim is either taken from published Ara measurements [2][3][4] or derived from models instantiated with Ara's parameters (16 lanes, 64-bit datapaths, >1 GHz clock, 41 DP-GFLOPS/W).

We proceed in three stages:

1. **Algebraic:** derive the LMUL–VLMAX identities, the stripmine recurrence in `vsetvli` form, and the convoy execution cost $T_n$, establishing the *parameterized contract*.
2. **Compiler:** trace LLVM's autovectorization pipeline — loop vectorizer, VPlan, `llvm.riscv.*` intrinsics, scalable `<vscale × N × T>` types — and show how it selects LMUL and emits stripmined loops without a compile-time `VLEN`.
3. **Architectural:** apply the roofline model $P \le \min(\pi, \beta \cdot I)$ (peak compute $\pi$, bandwidth $\beta$, arithmetic intensity $I$) to representative RVV kernels on Ara, identifying which of the three bounds — compute, memory, or *scalar issue rate* — dominates.

All derivations assume the RVV 1.0 semantics of [1]; where Ara implements a draft (v0.5 in the original paper [2]), we note the divergence.

---

## 4. Deep Dive

### 4.1 LMUL Register Grouping and the `VLMAX` Identity

The `vlmul[2:0]` field of `vtype` selects the **LMUL** (vector register group multiplier) [1]. When `LMUL > 1`, instructions naming register `vn` (with `n` a multiple of LMUL) transparently operate across `vn … vn+LMUL−1`, whose elements are laid out **contiguously in element order**, filling `vn` before moving to `vn+1` [1]. Fractional LMUL ({1/2, 1/4, 1/8}) does the inverse, exposing only a slice of one register — essential when SEW is large and the register file would otherwise be under-utilized.

The fundamental identity governing the whole ISA is:

> **Theorem (VLMAX identity):** For selected element width SEW and group multiplier LMUL on a machine with register width VLEN,
>
> $$VLMAX = \frac{LMUL \cdot VLEN}{SEW},$$
>
> and any `vsetvli`/`vsetvl` with application length AVL yields $vl = \min(AVL, VLMAX)$ (for the standard AVL encodings) [1].

*Proof sketch.* Each register holds `VLEN/SEW` elements of width SEW; a group of LMUL registers therefore holds $LMUL \cdot VLEN/SEW$ elements; the vector-length setting instructions define VLMAX as exactly this maximum and clamp `vl` to it [1]. ∎

The implications are profound:

- **Issue amortization.** One instruction now covers 8× more elements at LMUL=8, dividing per-element fetch/decode energy by eight — the reason Ara sustains >98.5% FPU utilization on long kernels [3].
- **Widening arithmetic.** Mixed-precision ops (e.g., 16-bit × 16-bit → 32-bit MAC) use **EMUL** (effective LMUL): a widening op with LMUL=4 needs an EMUL=8 destination group, and the spec reserves encodings requiring EMUL > 8 — a hard constraint LLVM's register allocator must respect [1].
- **Tail policy interaction.** With LMUL=8 and a short `vl`, up to seven registers of tail elements are governed by the *undisturbed* vs. *agnostic* policy; the agnostic policy lets hardware skip tail writes entirely, while undisturbed forces read-modify-write [1].

The canonical grouping table (VLEN = 512, SEW = 32) illustrates the scaling:

| vlmul | LMUL | Registers in group | VLMAX (elements) | Valid base registers |
|-------|------|--------------------|------------------|----------------------|
| 000   | 1    | 1                  | 16               | v0–v31               |
| 001   | 2    | 2                  | 32               | v0, v2, …, v30       |
| 010   | 4    | 4                  | 64               | v0, v4, …, v28       |
| 011   | 8    | 8                  | 128              | v0, v8, v16, v24     |
| 101   | 1/2  | 1/2                | 8                | v0–v31               |
| 111   | 1/8  | 1/8                | 2                | v0–v31               |

Note the alignment law: a group of size LMUL must be named by a multiple of LMUL; odd-numbered bases with `vlmul=01` raise illegal-instruction exceptions [1]. This is not bureaucracy — it guarantees each lane's register slice stays aligned across group boundaries in a lane-partitioned file like Ara's.

### 4.2 Stripmining, Chaining, and Convoy Scheduling in a VLA ISA

Classical stripmining (Cray style) computes `VL = n mod MVL` for the first block and `MVL` thereafter [6]. RVV replaces this two-phase idiom with a single recurrence. Let AVL$_k$ be the remaining elements at strip $k$:

```c
// RISC-V V stripmined DAXPY: y[i] = a*x[i] + y[i], i in [0, n)
// AVL recurrence implemented by vsetvli
size_t avl = n, vl;
float *x = ..., *y = ...;
for (float *px = x, *py = y; avl > 0; ) {
    // vsetvli t0, avl, e32, m8  ->  vl = min(avl, VLMAX); rd = vl
    // avl -= vl; pointers += vl
    asm volatile ("vsetvli %0, %1, e32, m8, ta, ma"
                  : "=r"(vl) : "r"(avl));
    asm volatile ("vle32.v v8, (%0)"  :: "r"(px));
    asm volatile ("vle32.v v16, (%0)" :: "r"(py));
    asm volatile ("vfmacc.vf v16, %0, v8" :: "f"(a));
    asm volatile ("vse32.v v16, (%0)" :: "r"(py));
    avl -= vl; px += vl; py += vl;
}
```

**Key insight:** `vsetvli` *returns* `vl` in `rd` and the idiom `avl -= vl` needs no division or modulo — the remainder strip falls out naturally when `avl < VLMAX` on the final iteration [1]. The stripmine loop therefore costs a constant $T_{loop}$ (set length, bump pointers, branch) per strip, independent of `VLEN`: binaries are portable across a 128-bit embedded core and a 16-lane Ara with VLEN = 4096 [7].

Chaining completes the picture. In Asanović's model, a **convoy** is a maximal set of vector instructions with no structural hazards; convoys execute sequentially while instructions *within* a convoy chain at element granularity [5]. For the DAXPY above (one convoy of 2 loads + 1 FMACC + 1 store, after chaining):

$$T_n = \left\lceil\frac{n}{VLMAX}\right\rceil \cdot T_{loop} + \left\lceil\frac{n}{VLMAX}\right\rceil \cdot T_{start} + n \cdot T_{chime},$$

where $T_{start}$ is the pipeline fill per convoy and $T_{chime}$ the per-element convoy time [6]. On Ara, $T_{chime}$ for an FMA-heavy convoy approaches the reciprocal FPU throughput (1 DP-FMA per lane per cycle, i.e., $L$ elements per cycle across lanes [2]), so *chime efficiency* $= n \cdot T_{chime} / T_n \to 1$ as $n$ grows — the analytical form of the measured 97% utilization on 256×256 DGEMM [2].

Three VLA-specific refinements matter:

1. **VLMAX-scaled strip count.** Since $VLMAX \propto LMUL$, LLVM can trade register pressure against strip count: LMUL=8 quarters the number of `vsetvli` executions and branch mispredictions versus LMUL=2, at the cost of holding 8-register groups live [1].
2. **Chaining across strips is forbidden** — `vl` tail elements from strip $k$ must not leak into strip $k+1$. The *agnostic* tail policy (`ta`) is what makes this free: hardware may leave tails undisturbed without reading them [1].
3. **Masked chaining.** Predicated instructions chain only on enabled elements; on Ara, the mask unit broadcasts `v0` bits per lane, and masked-off lanes clock-gate their FPUs — the microarchitectural lever behind energy proportionality on sparse masks [2].

### 4.3 LLVM Autovectorization for VLEN-Agnostic Code

LLVM's RVV backend (production-ready from LLVM 16 onward) lowers scalar IR through a pipeline designed around *not knowing* `VLEN`:

1. **Loop Vectorizer + VPlan.** The vectorizer builds a VPlan — a hierarchical recipe of the vectorized loop — using `ElementCount::getScalable(N)` types (`<vscale × N × i32>`), where `vscale` is a positive symbolic constant resolved only at run time [1]. Cost modeling multiplies per-lane costs by the *minimum* `vscale` the target guarantees (RVV mandates `vscale ≥ 1`, i.e., VLEN ≥ 128).
2. **LMUL selection via `riscv-v-vector-bits-min`.** The `-riscv-v-vector-bits-min` attribute and the `prefer-vector-width` heuristics choose an LMUL: larger LMUL raises the vectorization factor (fewer trips through the stripmine loop) but consumes more of the 32 architectural registers. LLVM's default is LMUL=1 with `m1` for most loops, promoting to LMUL=2/4/8 when the register budget allows and the loop is unrolled — a direct embodiment of the issue-amortization argument in §4.1.
3. **Stripmine emission.** The vectorizer emits the canonical `vsetvli`-based tail loop (`llvm.riscv.vsetvli` → real `vsetvli` in the backend), using the AVL recurrence of §4.2 so the final partial strip needs no scalar cleanup loop in the common case.
4. **Intrinsics and inline assembly.** For hand-tuned kernels, `riscv_vector.h` exposes `vfloat32m8_t` types mirroring LMUL groups, and Rust's `core::arch::riscv64` exposes the same; a Rust DAXPY kernel looks like:

```rust
// RVV DAXPY via riscv_vector.h-style intrinsics (Rust nightly, riscv64gc target)
use core::arch::riscv64::*;
unsafe fn daxpy_rvv(n: usize, a: f32, x: *const f32, y: *mut f32) {
    let mut avl = n;
    let (mut px, mut py) = (x, y);
    while avl > 0 {
        let vl: usize;
        core::arch::asm!("vsetvli {0}, {1}, e32, m8, ta, ma",
                         out(reg) vl, in(reg) avl);
        let vx = vle32_v_f32m8(px, vl);       // unit-stride load, LMUL=8
        let vy = vle32_v_f32m8(py, vl);
        let vacc = vfmacc_vf_f32m8(vy, a, vx, vl); // chained FMA
        vse32_v_f32m8(py, vacc, vl);
        avl -= vl;
        px = px.add(vl); py = py.add(vl);
    }
}
```

The critical autovectorization challenges are RVV-specific: **widening/narrowing EMUL accounting** (the allocator must reserve EMUL-sized groups [1]), **mask-register pressure** (`v0` is the only mask register, so nested predication spills), **segmented accesses** (`vlseg*`/`vsseg*` for struct-of-arrays, which Ara2 deliberately executes at one element per cycle to bound control complexity [4]), and **gather/scatter** (`vluxei`/`vsuxei`), which LLVM emits only when the cost model proves indexed access beats scalar.

### 4.4 Roofline Characterization Methodology

The roofline model bounds attainable performance by

$$P(I) \le \min\big(\pi,\; \beta \cdot I\big),$$

with peak compute $\pi$ (FLOP/s), sustained memory bandwidth $\beta$ (bytes/s), and arithmetic intensity $I$ (FLOP/byte) [2]. On Ara we instantiate:

- $\pi_{16} = 16\ \text{lanes} \times 2\ \text{FLOP/FMA} \times 1.0\ \text{GHz} = 32\ \text{DP-GFLOPS}$ (measured 33 DP-GFLOPS at >1 GHz [2]; Ara2 reaches 1.35 GHz [4]).
- $\beta$ from the vector load/store unit width (one 64-bit element per lane per cycle per Ara2 lane [4]).
- A **third ceiling** specific to lane-based decoupled designs: the **scalar issue-rate bound**. Each vector instruction must be decoded and dispatched by CVA6; with short vectors the dispatch overhead $T_{issue}$ per instruction dominates, capping throughput at $\approx VLMAX / T_{issue}$ elements/s regardless of $\pi$ or $\beta$. The Ara2 paper identifies exactly this bound and shows that *multi-core* vector clusters (eight 2-lane Ara2 cores) beat a single 16-lane core by >3× on 32³ DGEMM — same FPU count, 3× the aggregate issue rate [4].

For a roofline plot of RVV kernels we therefore draw **three** ceilings: the slanted bandwidth roof $\beta I$, the horizontal compute roof $\pi$, and a vertical-ish *issue-rate wall* at low element counts that LMUL shifts rightward (LMUL=8 multiplies the elements per issued instruction by 8, moving the wall toward higher intensity). This is the roofline formalization of "LMUL amortizes issue overhead."

---

## 5. Empirical Results / Proofs

We now instantiate the model with published Ara measurements and derive the quantitative consequences.

**Result 1 — Stripmine overhead on Ara.** Take DAXPY ($I = 2\ \text{FLOP} / 12\ \text{bytes} \approx 0.167\ \text{FLOP/B}$) at $n = 10^6$, VLEN = 4096, SEW = 32, LMUL = 8 ⇒ $VLMAX = 8 \cdot 4096/32 = 1024$. Strip count $\lceil n/1024 \rceil = 977$. With $T_{loop} \approx 5$ cycles (vsetvli + pointer bumps + branch, partially overlapped) and chained $T_{chime}$ of one FMA convoy at 16 lanes ≈ $1024/16 = 64$ cycles per strip, total $T \approx 977 \times (5 + 64) + T_{start}$; loop overhead is ~7% — consistent with Ara's measured >98.5% FPU utilization on long compute kernels [3].

**Result 2 — Chaining theorem (empirical form).**

> **Theorem (Convoy chaining on lane-based RVV):** If a strip's vector instructions form a single convoy with chime time $T_{chime}$ elements/cycle rate $r = L$ lanes, then for $n \gg VLMAX$ the achieved throughput tends to $r$ elements/cycle per instruction slot, independent of pipeline depth $d$: $\lim_{n\to\infty} P = L \cdot f_{clk}$ element-ops/s.

*Argument.* Each strip of length VLMAX fills pipelines once (cost $T_{start} \approx d$ cycles) then retires $L$ elements per cycle; the per-strip startup amortizes as $d/VLMAX \to 0$ when $n/VLMAX$ strips execute [5][6]. Ara's 97% utilization on 256×256 DGEMM is this limit realized in silicon: 16 lanes × 1 GHz × 2 FLOP/FMA ≈ 32 GFLOPS measured against 33 GFLOPS peak [2]. ∎

**Result 3 — LMUL shifts the issue-rate wall.** Ara2 shows a 16-lane single core limited by CVA6's issue rate on 32³ DGEMM; distributing the same 16 FPUs over eight 2-lane cores (8× the dispatch bandwidth) yields >3× speedup and 1.5× better energy efficiency [4]. Analytically, the issue bound is $P_{issue} = VLMAX \cdot f_{clk} / c_{issue}$ where $c_{issue}$ is cycles per dispatched vector instruction; doubling LMUL doubles $P_{issue}$ at fixed $c_{issue}$ — the roofline justification for LLVM's LMUL promotion heuristic in §4.3.

**Result 4 — Energy proportionality.** At 41 DP-GFLOPS/W (22FDX, TT/0.80V/25°C) [2] and 37.8 DP-GFLOPS/W at 1.35 GHz for Ara2 [4], lane-based RVV sits at the Pareto frontier of programmable vector efficiency: the per-element control energy shrinks as $1/VLMAX$ while datapath energy stays constant — the same amortization identity that motivated LMUL in §4.1.

---

## 6. Limitations

This analysis has explicit boundaries. **First**, the original Ara implements the RVV 0.5 *draft*, not 1.0: its `vtype` encoding, tail/mask policies, and segmented operations differ from the ratified spec, so §4.1–4.2 claims about fractional LMUL and agnostic policies apply strictly to New Ara/Ara2 [2][3]. **Second**, Ara2's deliberate choice to execute segmented memory operations at one element per cycle [4] means `vlseg`-heavy codes (complex FFTs, RGB interleaving) will fall far below the bandwidth roof — the roofline's $\beta$ ceiling is *operation-dependent*, a known weakness of the model. **Third**, LLVM's scalable-vector cost model assumes a minimum `vscale`; on machines with VLEN = 128 the vectorizer's LMUL=8 groups (VLMAX = 32 for FP32) may underperform scalar code due to `vsetvli` and register-group setup — autovectorization is not universally profitable, and the compiler's profitability heuristic remains the weakest link. **Fourth**, our roofline instantiation uses *sustained* rather than *measured* bandwidth; a full characterization requires performance-counter validation on FPGA or silicon, which this thesis does not perform. **Fifth**, gather/scatter (`vluxei32`) throughput on lane-based designs is bank-conflict-limited and resists closed-form modeling; we treat it as a bandwidth-roof derating rather than deriving it.

## 7. Conclusion

The RISC-V Vector extension's wager is that a *parameterized contract* — `vtype`/`vl` configuration, the $VLMAX = LMUL \cdot VLEN/SEW$ identity, the `vsetvli` stripmine recurrence, and element-granular chaining — can replace a century of fixed-length vector ISAs with one binary that scales from a 128-bit microcontroller to a 16-lane, 1 GHz+ vector engine. The Ara family validates the wager in silicon: 97% FPU utilization, 33 DP-GFLOPS, and 41 DP-GFLOPS/W on the original design [2]; RVV 1.0 compliance with >98.5% utilization in New Ara [3]; and a coherent-memory, multi-core Ara2 at 1.35 GHz and 37.8 DP-GFLOPS/W that exposes the scalar issue-rate bound as the next frontier [4].

Three lessons generalize beyond RISC-V. (i) **Register grouping is issue amortization**: LMUL's value is not longer vectors per se but fewer instructions per element, shifting the roofline's issue-rate wall rightward. (ii) **The stripmine recurrence belongs in the ISA**: `vsetvli`'s AVL→`vl` reduction collapses the Cray two-phase idiom [6] into one instruction, making vector-length agnosticism a three-instruction loop property rather than a compiler heroic effort. (iii) **Roofline needs a third ceiling** for decoupled scalar–vector machines: where the dispatcher, not the datapath, is the bottleneck, adding lanes without adding issue bandwidth — as Ara2's multi-core experiment proves [4] — is the architectural response. Future work should extend LLVM's VPlan cost model with an explicit issue-rate term and validate the three-ceiling roofline with hardware counters on Ara2 silicon.

---

## References

[1] RISC-V "V" Vector Extension, version 1.0 (ratified). RISC-V International. Spec: https://github.com/riscv/riscv-v-spec/releases/download/v1.0-rc1/riscv-v-spec-1.0-rc1.pdf ; living spec: https://github.com/riscvarchive/riscv-v-spec/blob/master/v-spec.adoc

[2] M. Cavalcante, F. Schuiki, F. Zaruba, M. Schaffner, L. Benini, "Ara: A 1 GHz+ Scalable and Energy-Efficient RISC-V Vector Processor with Multi-Precision Floating Point Support in 22 nm FD-SOI," IEEE Trans. VLSI Syst., 2020 (arXiv:1906.00478). https://arxiv.org/abs/1906.00478

[3] M. Perotti, M. Cavalcante, N. Wistoff, R. Andri, L. Cavigelli, L. Benini, "A 'New Ara' for Vector Computing: An Open Source Highly Efficient RISC-V V 1.0 Vector Processor Design," arXiv:2210.08882, 2022. https://arxiv.org/pdf/2210.08882

[4] M. Perotti, M. Cavalcante, R. Andri, L. Cavigelli, L. Benini, "Ara2: Exploring Single- and Multi-Core Vector Processing with an Efficient RVV1.0 Compliant Open-Source Processor," arXiv:2311.07493, 2023. https://arxiv.org/abs/2311.07493v1

[5] K. Asanović, "Vector Microprocessors," Ph.D. thesis, Computer Science Division, University of California, Berkeley, 1998. Technical Report UCB/CSD-02-1183. http://www.eecs.berkeley.edu/Pubs/TechRpts/2002/CSD-02-1183.pdf

[6] D. Patterson, CS252 Graduate Computer Architecture, Lecture 10: Vector Processing — strip mining, convoys, chimes, and chaining (Cray-1 startup penalties). UC Berkeley. http://people.eecs.berkeley.edu/~pattrsn/252/Lecture06.pdf

[7] K. Asanović et al., "RISC-V Vector Extension Overview," HotChips 31, 2019. https://old.hotchips.org/hc31/HC31_T4_RISCV-20190818-HotChips.pdf
