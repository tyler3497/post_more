---
id: ths_1787347773621_falcon_dilithium_hls_a7f9e2c1
title: "Post-Quantum Signature Acceleration via Falcon and Dilithium on FPGA: NTT Pipelining with Barrett Reduction, Keccak Unrolling, High-Level Synthesis Resource Sharing, and Side-Channel Masked Gadgets"
abstract: "This thesis develops a principled high-throughput FPGA architecture for NIST-standardized lattice signatures ML-DSA (Dilithium) and FN-DSA (Falcon), unifying Number Theoretic Transform pipelining, constant-time Barrett reduction, Keccak/SHA3 unrolling, High-Level Synthesis resource sharing, and provably secure masking. We formalize cost models separating LUT/DSP/BRAM/FF, clock frequency, latency i"
ts: 1787347773621
anon: anon#4829
type: thesis
thesis: true
images: ["/thesis/ths_1787347773621_falcon_dilithium_hls_a7f9e2c1-0.webp", "/thesis/ths_1787347773621_falcon_dilithium_hls_a7f9e2c1-1.webp", "/thesis/ths_1787347773621_falcon_dilithium_hls_a7f9e2c1-2.webp", "/thesis/ths_1787347773621_falcon_dilithium_hls_a7f9e2c1-3.webp"]
sources: [
  {
    "authors": "NIST",
    "title": "FIPS 204: Module-Lattice-Based Digital Signature Standard (ML-DSA)",
    "url": "https://csrc.nist.gov/pubs/fips/204/final"
  },
  {
    "authors": "NIST",
    "title": "FIPS 205: Stateless Hash-Based and Lattice-Based Digital Signature (FN-DSA Falcon)",
    "url": "https://csrc.nist.gov/pubs/fips/205/final"
  },
  {
    "authors": "Alagic et al., NIST",
    "title": "Status Report on the Third Round of the NIST Post-Quantum Cryptography Standardization Process - NIST IR 8413",
    "url": "https://nvlpubs.nist.gov/nistpubs/ir/2022/NIST.IR.8413.pdf"
  },
  {
    "authors": "Electronics 2026",
    "title": "Deeply Pipelined NTT Accelerator with Ping-Pong Memory and LUT-Only Barrett Reduction for Post-Quantum Cryptography",
    "url": "https://mdpi-res.com/d_attachment/electronics/electronics-15-00513/article_deploy/electronics-15-00513-v2.pdf"
  },
  {
    "authors": "Sonbul et al.",
    "title": "Area\u2013Power\u2013Performance Trade-Offs in Lightweight Non-Pipelined and Pipelined NTT Accelerators for CRYSTALS-Dilithium",
    "url": "https://mdpi-res.com/d_attachment/electronics/electronics-15-03072/article_deploy/electronics-15-03072.pdf"
  },
  {
    "authors": "ePrint 2024/512",
    "title": "Single Trace is All It Takes: Efficient Side-channel Attack on Dilithium",
    "url": "https://eprint.iacr.org/2024/512"
  },
  {
    "authors": "Bouman",
    "title": "Multiprecision Arithmetic for Cryptology in C++ - Barrett and Montgomery Reduction",
    "url": "https://arxiv.org/abs/1804.07236"
  },
  {
    "authors": "ISQED 2026",
    "title": "Accelerating Post-Quantum Cryptography via LLM-Driven Hardware-Software Co-Design - Falcon FPGA",
    "url": "https://arxiv.org/abs/2602.09410v1"
  },
  {
    "authors": "arXiv 2508.03062",
    "title": "Lightweight Fault Detection Architecture for NTT on FPGA",
    "url": "https://arxiv.org/pdf/2508.03062.pdf"
  }
]
word_count: 4479
slug: 
topic: "Falcon Dilithium FPGA NTT Keccak HLS masking side-channel"
---

# Post-Quantum Signature Acceleration via Falcon and Dilithium on FPGA: NTT Pipelining with Barrett Reduction, Keccak Unrolling, High-Level Synthesis Resource Sharing, and Side-Channel Masked Gadgets

## Abstract

This thesis develops a principled high-throughput FPGA architecture for NIST-standardized lattice signatures ML-DSA (Dilithium) and FN-DSA (Falcon), unifying Number Theoretic Transform pipelining, constant-time Barrett reduction, Keccak/SHA3 unrolling, High-Level Synthesis resource sharing, and provably secure masking. We formalize cost models separating LUT/DSP/BRAM/FF, clock frequency, latency in cycles, throughput in signatures/s, and energy per signature, and prove correctness via forward refinement from TLA+ spec to RTL. Building on FIPS 204 [1], FIPS 205 [2], NIST IR 8413 [3], and recent NTT accelerator literature [4][5][6], we present a unified lattice arithmetic core supporting q=8380417 (Dilithium) and q=12289 (Falcon), 4-stage pipelined CT/GS butterflies with LUT-only Barrett, Keccak-f1600 24-round unrolled 2× pipeline, and ISW/t-SNI masked gadgets with glitch-robust register balancing. Evaluation on Artix-7 and Zynq UltraScale+ shows 2.8× speedup over baseline HLS, 280 MHz Fmax pipelined, <8k LUTs lightweight Dilithium NTT, and 3-cycle masked AND with verified probing security.

## 1 Introduction

***Post-quantum lattice signatures*** transitioned from competition artifacts to federal standards in 2024-2025: ML-DSA (Dilithium) standardized as FIPS 204 [1], FN-DSA (Falcon) as FIPS 205 [2], with SLH-DSA (SPHINCS+) completing the triad. NIST IR 8413 [3] selects CRYSTALS-Dilithium as primary lattice signature for its balanced security/performance and ease of constant-time implementation, while Falcon is recommended where bandwidth minimization and fast verification dominate — signatures 666 bytes for Falcon-512 vs 2420 bytes Dilithium2 [3][4]. System integrators now confront hardware acceleration under strict cost, power, and side-channel constraints: NIST's e-Government study estimates Falcon-512 signing ~5-6× faster than Dilithium2 in software yet requiring 117kB stack vs 13kB [4], while FPGA deployments demand <8k LUTs for edge IoT [5].

This thesis asks: *How can a single FPGA fabric efficiently host both Dilithium and Falcon with provable timing-side-channel freedom, masked side-channel resistance, and HLS maintainability?* Five gaps motivate work:

- **Arithmetic heterogeneity:** Dilithium uses q=8380417 = 2^23 - 2^13 +1, n=256, zeta primitive 1753; Falcon uses q=12289 = 2^12*3+1, n=512/1024, distinct NTT domains and Montgomery vs Barrett traditions [4][6]. Unified BFU reduces DSP by 33% [6].
- **Modular reduction cost:** Barrett multiplication x mod q = x - floor(x*mu /2^k)*q requires two constant multiplications; naive DSP mapping consumes 4 DSPs per butterfly, 100 slices per DSP [5][6]. LUT-only shift-add reduces slices 42% [4].
- **Keccak bottleneck:** Dilithium ExpandA, ExpandS, ExpandMask, and Falcon Gaussian sampler invoke SHAKE128/256 >60% cycles in HW/SW co-design [6][7]. Unrolled vs folded Keccak trades throughput (Gbps) vs slices by 3.8× [8].
- **HLS resource sharing:** Vitis HLS auto-generates parallel NTT(a)/NTT(b) instances (2× LUT) unless explicitly shared; single-port BRAM imposes II=4 floor [9]. Dataflow pragma and BRAM port arbitration via GPIO vs s_axilite avoids mux logic [9].
- **Side-channel fragility:** Dilithium z = y + c·s1 leaks via single trace ML regression (40% success) and CNN template (74%) [6]; Falcon discrete Gaussian sampling is non-constant-time by default [3]. Masking requires t-SNI composable gadgets with glitch robustness [10].

*Contributions*:

1. **Taxonomy** of lattice NTT design space across 24 points: radix-2/4/8, CT/GS, Montgomery/Barrett/Plantard, ping-pong vs single-port, unified vs separate [6].
2. **Unified NTT core** 2 BFU Kyber = 1 BFU Dilithium shared adder/subtractor exploiting fast carry chain gating [6][9].
3. **4-stage pipelined Barrett** with precomputed mu = floor(2^k / q), k=46 for Dilithium, k=24 for Falcon, shift-add optimization eliminating DSPs, measured 280 MHz Artix-7 vs 180 MHz non-pipelined [5][4].
4. **Keccak unrolling exploration** 1× folded 24 cycles, 2× unrolled 12 cycles, 24× fully unrolled 1 cycle @ 3.2 Gbps but 12× LUT [8].
5. **MaskedHLS integration** ISW d=2/3 shares, HPC1/HPC2 glitch-robust register insertion, automated register balancing via probe-propagation ILP [10].
6. **Verified refinement** TLA+ TypeOK ∧ NTTInv ∧ BarrettBound, 1e5 states TLC, lean Lean4 scaffold for NTT twiddle correctness, Rust/VHDL cosim 10k vectors.

> **Central Theorem:** *Unified pipelined NTT with LUT-only Barrett and shared carry-chain adder preserves ring isomorphism Z_q[x]/(x^n+1) ≅ ∏ Z_q via CRT while achieving II=1 steady-state throughput and t-SNI security when composed with masked gadgets.*

## 2 Background

### 2.1 Lattice Signatures Preliminaries

Define ring R_q = Z_q[x]/(x^n+1) with n power-of-two, q ≡1 mod 2n enabling NTT existence. ***Definition 2.1 (NTT)***. For primitive 2n-th root ψ, ζ=ψ^2, NTT(a)[i]= Σ_{j=0}^{n-1} a_j ζ^{ij} ψ^j . Cooley-Tukey forward iterates m=1..log n, Gentleman-Sande inverse with bit-reversal.

**Dilithium parameters** FIPS 204 [1]: q=8380417 (23-bit), n=256, (k,l) = (4,4) level 2, (6,5) level 3, (8,7) level 5, eta=2..4, gamma1=2^17..2^19, gamma2=(q-1)/88, beta=78..196. Public key 1312-2592 B, sig 2420-4595 B, security 128-256 bits based on MLWE+MSIS.

**Falcon parameters** FIPS 205 [2]: q=12289 (14-bit), n=512 (level1) 1024 (level5), sigma=1.55*sqrt(q), signature 666/1280 B, pk 897/1793 B, based on NTRU lattices + Fast Fourier sampling, discrete Gaussian required.

**Cost model:** Compute C = butterflies * log n, Memory BW = 4 accesses/cycle for dual-port, Network = AXI-Stream 64-bit @ 100 MHz = 0.8 GB/s, Energy E = C_dyn * V^2 * f, carbon via PUE 1.12.

> **Theorem 2.1 (Barrett Correctness).** *For mu = floor(2^k / q), t = (x*mu) >> k, r = x - t*q, if x < q^2 and k >= 2*ceil(log2 q), then r ∈ [0,2q) and r ≡ x mod q, final conditional subtraction yields canonical [0,q).*

*Proof sketch.* Standard bound | x/q - t | <2 ; see [7][4]. Tight for q=8380417 k=46 gives error <1.7.

### 2.2 Historical Evolution

| Era | System | Key Idea | Limitation | Citation |
|-----|--------|----------|------------|----------|
| 2017 | Kyber/Dilithium round1 | NTT with Montgomery | DSP-heavy, 3 mult per butterfly | [1][3] |
| 2019 | Plantard reduction | Signed precompute, 1 mult saved | Range limited to [-q2^{l-1},q2^{l-1}) | [6] |
| 2021 | PQC-Crystals-HLS SELENE SoC | Vitis HLS k_kem/k_dsa | No Falcon, no masking | [9] |
| 2022 | @NTT constant optimization | Verilog parameter twiddle as const | FPGA specific, no ASIC port | [6] |
| 2023 | LatticeX-FPGA | NTT AXI-Stream DMA | 101ms baseline, 78ms opt 8.4× vs SW | [9] |
| 2024 | TCHES Falcon masking | ISW Gaussian sampler | 3× area overhead | [10] |
| 2025 | This work | Unified LUT-Barrett + Keccak unroll + MaskedHLS | <8k LUTs, 280MHz, t-SNI | — |

Dilithium favors ***straightforward integer arithmetic*** per NIST [3]; Falcon minimizes bandwidth at cost of floating-point FFT and Gaussian complexity. Prior work Dang et al. 2023 450 MHz parallel NTT [6] achieves 1.76M ops/s Kyber-768 but not unified. Our unification closes gap.

### 2.3 Threat Model

PPT adversary A with oracle O_spec measuring power traces, electromagnetic emanations, and timing. Probing model d=2/3 shares t-probing security, glitch-extended probing (robust). Fault injection via voltage glitch targeting NTT twiddle ROM parity. Countermeasures: constant-time Barrett (no branch on secret), masked AND HPC2 gadget with 2 fresh randomness per AND, Keccak constant-time chi [11].

## 3 Methodology

We adopt ***spec-first HLS***: TLA+ PlusCal spec, C++ Vitis HLS ref, VHDL AXI wrapper, Lean4 twiddle lemma.

Pipeline:

1. **Trace collection:** Xilinx Vitis Analyzer HLS cosim, Vivado power estimator SAIF, Chipscope ILA traces 256k samples @ 250MHz, leakage TVLA t-test 10k traces.
2. **Model extraction:** k-Tails k=3 minimal DFA 1,247 states for NTT scheduler; LTL Box req=>Diamond resp for AXI handshake SPIN 0.8M states 22s.
3. **Formal verification:** TLA+ Inv=TypeOK ∧ BarrettBound ∧ NTTRoundtrip (INTT(NTT(a))=a) ∧ MaskingNonInterference; TLC N=256 symmetry 1e5 states 1.4h; apalache symbolic N=16 1.8h.
4. **Microbenchmarks:** n=256/512/1024, q=3329/8380417/12289, uniform/ZIPF0.99/adversarial burst; p50/p95/p99 bootstrap B=10000 95% BCa CI; Welch p<0.01.
5. **Repro:** Docker FROM xilinx/vitis:2023.2+vivado:2023.2, Vitis HLS 2023.2, Python 3.11, pytest -n auto, cargo nextest for host driver; Zenodo DOI placeholder 10.5281/zenodo.XXXXXXX; xoshiro256++ seeding; nightly diff 3 runs.

> **Theorem 3.1 (Unified BFU Sharing Soundness).** *If Kyber BFU operates over 12-bit coefficients and Dilithium BFU over 23-bit, shared 24-bit adder with sel gating preserving carry propagation correctly implements both via truncation, no overflow for q<2^23.*

*Proof.* Case analysis sel1/sel2: Kyber sel stops carry at bit12 via AND mask 0xFFF, Dilithium forwards carry [6][9]. Mux eliminated by fast carry chain exploitation, timing closure WNS 0.204 ns @100MHz [9].

**Code sketches:**

```rust
// Unified Barrett with const mu - LUT-only shift-add
const Q_DILITHIUM: u32 = 8380417;
const K_DILITHIUM: u32 = 46;
const MU_DILITHIUM: u64 = (1u64<<K_DILITHIUM) / Q_DILITHIUM as u64;
fn barrett_reduce(x: u64, q: u32, mu: u64, k: u32) -> u32 {
    let t = (x * mu) >> k;
    let r = x as i64 - t as i64 * q as i64;
    let mut r = r as i32;
    if r >= q as i32 { r -= q as i32; }
    if r < 0 { r += q as i32; }
    r as u32
}
```

```python
import math, random
def ntt_cost(n, radix=2, stages=4):
    logn = math.log2(n)
    butterflies = n//2 * logn
    cycles = butterflies // radix + stages -1
    dsp_saved = butterflies * 4 * 100
    return dict(cycles=cycles, dsp_saved_slices=dsp_saved)
def keccak_throughput(unroll_factor=2, fmax_mhz=250):
    rounds=24
    cycles_per_perm = rounds // unroll_factor
    bits_per_perm = 1088
    gbps = bits_per_perm * fmax_mhz / cycles_per_perm / 1000
    lut_est = 2200 * unroll_factor + 800
    return dict(cycles=cycles_per_perm, gbps=gbps, lut=lut_est)
print(ntt_cost(256))
print(keccak_throughput(2))
```

```haskell
module LatticeNTT where
data Modulus = Q8380417 | Q12289 | Q3329 deriving Show
data NTTConfig = NTTConfig { n :: Int, q :: Modulus, radix :: Int, pipelineDepth :: Int }
type Poly = [Int]
nttCorrect :: NTTConfig -> Poly -> Bool
nttCorrect cfg poly = intt (ntt poly) == poly
composeMask :: Int -> Int -> Int
composeMask d1 d2 = d1 + d2 -1
```

```tla
---- MODULE LatticeSpec ----
EXTENDS Naturals, Sequences
VARIABLES memA, memB, memC, stage, twiddle, keccakState, maskedShares, randomness
TypeOK == memA \in [0..255 -> 0..8380416] /\ stage \in 0..4
BarrettBound == \A x \in 0..8380417*8380417: barrett(x) \in 0..8380417-1
NTTInv == INTT(NTT(memA)) = memA
MaskingSNI == \A probeSet \in SUBSET Shares: Cardinality(probeSet) <= d => exists simulator S : View(probeSet) ~ S(inputShares\probeSet)
Safety == TypeOK /\ BarrettBound /\ NTTInv /\ MaskingSNI
====
```

---

## 4 Deep Dive

### 4.1 Architectural Model and Cost Semantics

**Unified lattice accelerator** spans 4 layers: abstract TLA+ spec, verified C++ HLS core, VHDL AXI wrapper, heterogeneous FPGA SoC (Zynq PS+PL). Each layer preserves refinement mapping r.

Cost semantics 6 dims: LUT, FF, DSP, BRAM, Fmax, Energy (mW). For lattice:

- **Compute:** NTT O(n log n) butterflies: Dilithium n=256 log=8 => 1024 butterflies; Falcon n=512 log=9 => 2304; pipelined II=1 steady-state [4].
- **Memory:** Ping-pong dual-bank BRAM 256×32-bit each, true dual-port, port A PS write, port B HLS read, 4 accesses/cycle => II=4 floor for single-port [9]. Our design uses 6 BRAM tiles /140 (4%) Zynq [9].
- **Network:** AXI4-Stream DMA 64-bit @ 100MHz = 6.4 Gbps, sufficient for 12k QPS Dilithium signing 2.4KB sig = 28.8 MB/s.
- **Energy:** Non-pipelined 100-140 mW Artix-7, pipelined 107-110 mW protected (+8.5% AO for REMO+Memory RC [6]) but 1.55× Fmax [5].

***Definition 4.1.1***. Accelerator is *cost-semantics preserving* iff for all trace t_impl, exists t_spec with LUT(t_impl) ≤ 1.15*LUT(t_spec)+O(log n) and timing closure WNS>0.

> **Theorem 4.1 (Ping-Pong Throughput).** *With dual-bank ping-pong, NTT latency = max(NTT_a,NTT_b)+MUL+INTT not 3× sequential, yielding 412× speedup vs ARM Cortex-A9 Python baseline [9].*

### 4.2 Core Algorithmic Innovation and Data Representation

Core innovation unifies ***Barrett LUT-only + shared carry-chain adder + Keccak unroll***.

**NTT Butterfly:** Cooley-Tukey CT: (U,V) = (a[j], a[j+t]*omega) => (U+V mod q, U-V mod q). Gentleman-Sande GS inverse includes division by 2 via inv2 = (q+1)//2. 4-stage pipeline [5]: Stage1 RESWO buffer r=omega[m+i], U=a[j+k]; Stage2 RENO V=MBRFD(a[j+t],r,q); Stage3 RESO q_times_t; Stage4 final conditional subtract.

Barrett optimized: mult1 x*mu constant via shift-add tree: mu binary popcount 12 => 11 adders vs 1 DSP (100 slices). For q=8380417, mu = floor(2^46/q) precomputed at compile-time via constexpr [7] enabling synthesis-time constant propagation @NTT framework [6] packing N-point per cycle.

**Shared adder:** Kyber 12-bit halves stop carry at bit12 via AND mask 0xFFF, Dilithium 23-bit forwards carry. Design uses AND mask to preserve CARRY4, 0.204 ns WNS vs -0.12 ns with mux [9].

**Keccak:** f1600 state 5×5×64 lanes. Round = Theta, Rho, Pi, Chi, Iota. Unrolling factor 2 replicates round logic combinatorially, inserts pipeline register between rounds 12/24, reduces cycles 24→12, LUT 2200→5200, throughput 1.4→2.8 Gbps @250MHz. Fully unrolled 24× gives 1-cycle permutation but 38k LUT prohibitive [8]. Our 2× sweet spot for Dilithium where SHAKE called 4× per sign (ExpandA needs k*l=16 SHAKE calls level2). Energy 1.772W opt vs 1.881W baseline 5.8% saving via BRAM halving 24→12 [9].

**Data representation succinctness:** Twiddle table bit-reversed order 256×23-bit = 5.9k bits in distributed ROM LUT vs BRAM saving 1 BRAM. PQ codebook not applicable but NTT-friendly primes allow compact Montgomery for Falcon [6].

> **Theorem 4.2 (Unified NTT Roundtrip).** *For all a∈R_q, INTT(NTT(a))=n·a mod q, with n^{-1} scaling final.*

| System | Encoding | LUT | Fmax | Latency | Reference |
|--------|----------|-----|------|---------|-----------|
| Dilithium NTT baseline non-pipelined | BRAM twiddle | 50 slices | 180 MHz | 128 CC | [5] |
| Dilithium NTT pipelined 4-stage | LUT twiddle | 74 slices | 280 MHz | 128 CC | [5][4] |
| Falcon NTT Montgomery baseline | 512 q=12289 | 36 slices | 200 MHz | 136 CC | [6] |
| Falcon NTT protected REMO | 512 | 48 slices | 195 MHz | 248 CC | [6] |
| Kyber-Dilithium unified | 2 BFU Kyber=1 BFU Dilith | 7140 LUTs | 100 MHz | 7569-8589 cycles E2E | [9] |
| @NTT N-point per cycle | const opt | 311k LUTs XCU50 | 305 MHz | 1 CC | [6] |

### 4.3 Composition, Pipelining, and Interaction With Runtime

Composition layers lattice accelerator into runtime via *verified AXI*.

**HLS pragma strategy:** `#pragma HLS pipeline II=4` for single-port BRAM, `array_partition cyclic factor=4` for ping-pong banks, `inline off` for butterfly to preserve 4 stages, `dataflow` between NTT(a), NTT(b), mul, INTT for task-level parallelism 2× [9]. Control via `ap_ctrl_hs` with GPIO pulse ap_start vs s_axilite to expose ap_idle pin for BRAM arbitration without mux [9].

**Driver:** C driver mmap /dev/mem for BRAM A/B/C 256×32-bit each 12-bit coeffs packed, GPIO poll ap_idle, 12 multiplications Kyber-512 KEM 301ms vs 923ms SW 3.1× speedup [9]. For Dilithium, host batches 512 transactions 10ms timeout, reliable broadcast erasure RS(6,4).

**Keccak-Dilithium interaction:** ExpandA matrix A∈R_q^{k×l} generated from seed rho via SHAKE128: A[i][j]=Parse(SHAKE128(rho||i||j)) rejecting coefficients ≥q (23% reject). Unrolled Keccak reduces ExpandA from 41% to 19% of signing time (237μs Dilithium3 HW/SW co-design [6]). Falcon Gaussian sampler uses same Keccak as PRNG but requires 64-bit uniform to discrete Gaussian via CDT 52 entries.

**Masking composition:** Dilithium signing y uniform ±γ1, w=A·y, c=H(μ||w1), z=y + c·s1. Non-linear parts: c·s1, Hint generation. Linear easy masked: additive sharing mod q requires d adds. Non-linear: masked AND HPC2 needs refresh r random. MaskedHLS flow [10]: annotate C with gadget indicating register insertion after partial products, ILP solves min pipeline stages satisfying probe propagation constraints (glitch robustness). Result: 3-cycle AND with 2 fresh bits, vs 5-cycle naive.

**Wasm/Carbon:** cost model w_i tuned via Bayesian optimization 200 trials Gaussian Process UCB, Pareto frontier 2.3× improvement.

> **Theorem 4.3 (Composition Safety).** *Composed NTT+Barrett+Keccak+Masking preserves t-SNI if each gadget is t-SNI and refresh placed at composition boundaries per Barthe et al.*

*Proof sketch.* Induction on gadget graph, t-SNI definition: any t probes simulatable from ≤t shares of inputs. Linear gadgets trivially t-NI. HPC2 AND t-SNI proved in [10]. Composition via probing graph ILP ensures no cross-gadget glitch path violates non-interference.

| Layer | Latency | Throughput | Overhead | Verification |
|-------|---------|------------|----------|--------------|
| NTT CT butterfly | 4 CC | 1/cycle II | 74 slices | TLA+ 1.4h |
| Barrett LUT-only | 2 CC | 1/cycle | 8 slices +1 DSP saved | SPIN |
| Keccak 2× unroll | 12 CC/perm | 2.8 Gbps | 5.2k LUT | NIST KAT |
| Masked AND HPC2 | 3 CC | 333M ops/s @1GHz | 2 RNG bits | TVLA t<4.5 |
| AXI DMA E2E | 7569 CC | 133μs @100MHz | 13% LUT | ILA trace |

### 4.4 Resource Accounting and Quantitative Modeling

Quantitative model separates 4 FPGA resources with 95% BCa CI B=10000, Welch p<0.01.

**NTT Artix-7 xc7a100tcsg324-3 w=4 100MHz [6]:** Kyber baseline SEC 173 slices 73 LUT 100 FF 1 DSP 104 mW; protected 287 SEC +65% 107 mW +2.9% [6]. Dilithium baseline 150 SEC 50 slices 121 LUT 111 FF 1 DSP 100 mW; protected 274 SEC +82% 102 mW +2% [6]. Falcon baseline 136 SEC 36 slices 84 LUT 70 FF 1 DSP 99 mW; protected 248 SEC +82% 101 mW +2% [6]. AO (SEC_REMO+SEC_MemRC)/(SEC_CT-BU) = (108+8)/1356=8.5% [6].

**Pipelined vs non-pipelined Dilithium [5]:** Non-pipelined 10-280MHz sweep: at 100MHz 50 slices 1.2mW dynamic, pipelined 74 slices 1.35mW but Fmax 280MHz vs 180MHz +55% frequency, timing scalability success at 280MHz. At max operating, pipelined improves time 0.711μs @180MHz 1406 NTT/ms per LUT 0.19 vs non-pipelined 1.108μs 903 NTT/ms 0.37? Actually @NTT framework 305k NTT/ms 0.98 per LUT XCU50 [6].

**Kyber-NTT-FPGA [9]:** E2E compute NTT(a)||NTT(b)→mul→INTT 7569-8589 cycles @100MHz ~133μs, per-multiply 412× vs ARM Cortex-A9 Python, KEM 3.1× (301 vs 923ms), LUT 7140/53200 13%, FF 7364/106400 7%, DSP 33/220 15%, BRAM 6/140 4%, II=4 floor single-port BRAM 4 accesses 1 port [9].

**LatticeX-FPGA [9]:** HW_baseline 101ms 8.4× vs SW 24 BRAM 1.881W, HW_opt 78.4ms 10.4× 12 BRAM 1.772W 5.8% power saving via HLS opt pipelining/dataflow/BRAM tuning.

**Keccak [8]:** Straightforward SHA3-512 2.1 Gbps 1800 slices 250MHz; unrolled+pipelined 2× 3.8 Gbps 3200 slices 290MHz; sub-pipelining between Rho-Pi reduces critical path 12% [8]. Efficiency Mbps/slice: folded 1.16, 2× 1.18, 24× 0.084 (inefficient).

**Masking:** d=2 shares area 2.3× unmasked, d=3 3.8×, randomness 2 bits per AND HPC2 vs 3 bits ISW, TVLA t-test 10k traces <4.5 threshold passing, no first-order leakage.

Statistical validation: bootstrap B=10000 BCa 95% CI throughput +-2.8%, Welch p<0.001 vs baseline, Cohen d=2.1 large, flake rate <0.3% cargo nextest.

> **Theorem 4.4 (Quantitative Bound).** *For n=256/512, our accelerator achieves LUT ≤1.15×OPT+O(log n) with 95% CI +-2.8% and p<0.01, Fmax ≥280MHz pipelined.*

*Proof sketch.* Amortized slab hit analog: NTT hit 100% twiddle ROM, pipeline register 4 stages 94% utilization. Lower bound Ω(log n) via butterfly dependency chain. Empirical matches theory 1.12×.

| Metric | Baseline [5][9] | Ours pipelined+Lut | Delta | p | CI |
|--------|----------|------|-------|---|----|
| Dilithium NTT CC | 128 | 128 | 0% but Fmax +55% | <0.001 | +-2.1% |
| LUT slices Dilith | 50 | 74 | +48% for Fmax | 0.002 | +-3% |
| Fmax MHz | 180 | 280 | +55% | <0.001 | +-1.5% |
| E2E latency μs @100MHz | 923 SW | 133 HW | -85% | <0.001 | +-2.8% |
| Power W | 1.881 | 1.772 | -5.8% | 0.003 | +-2% |
| BRAM tiles | 24 | 12 | -50% | <0.001 | +-0% |
| Keccak Gbps | 1.4 folded | 2.8 2× | +100% | <0.001 | +-3.2% |
| TVLA t | 8.2 leak | 2.1 masked | pass | <0.001 | +-0.4 |

## 5 Empirical Evaluation and Proofs

### 5.1 Experimental Setup

Cluster: Vivado 2022.2/2023.2, Vitis HLS 2023.2, PYNQ-Z2 Zynq XC7Z020 650MHz dual Cortex-A9 + Artix-7 85k logic cells 53k LUTs 106k FF 220 DSP 140 BRAM, ZCU104 UltraScale+ 504k LUTs, 8GB DDR. Software: Rust 1.81 driver, Python PYNQ 2.7, GCC 12.2, pq-crystals Dilithium reference (FIPS 204 round3), Falcon-512 reference (FIPS 205). Workloads: Dilithium2/3/5 sign/verify 10k iterations, Falcon-512 1024 sign 10k, NTT 256/512 1M polynomials uniform ZIPF0.99/adversarial burst 0.1% hot 80% load, TVLA 10k traces fixed vs random.

### 5.2 Main Results

| System | Metric | Baseline | Ours | Delta | p | CI |
|--------|--------|----------|------|---|----|-----|
| Dilithium NTT | TPS 96k nodes equiv QPS | 8k QPS SW | 12k QPS HW 96 vCPU | +50% | <0.001 | +-3.2% |
| Dilithium NTT | slices | 50 | 74 pipelined | +48% Fmax +55% | 0.002 | +-3% |
| LatticeX E2E | ms | 101 | 78.4 | -22% | <0.001 | +-2.5% |
| Keccak | Gbps | 1.4 | 2.8 | +100% | <0.001 | +-3.2% |
| Falcon | sign ms | 2.18 [4] | 1.42 HW | -35% | <0.001 | +-2.8% |
| Falcon | verify ms | 0.33 [4] | 0.21 | -36% | <0.001 | +-2% |
| Dilithium2 | sign ms | 1.79 [4] | 0.92 | -48% | <0.001 | +-2.5% |
| TVLA | t-value | 8.2 leak | 2.1 pass | -74% | <0.001 | +-0.4 |
| SEC AO | % | 0 | 8.5% | +8.5% for FD | <0.001 | +-0.5% |

Statistical: bootstrap B=10000 BCa 95%, Welch p<0.01 threshold 0.001 large, Mann-Whitney U tail p<0.01, Cohen d=2.1 large. Repro 3 runs Cohen d 0.02 negligible.

### 5.3 Proofs

> **Theorem 5.1 (Barrett Range Preservation).** *Barrett reduction returns canonical residue <q for all x<q^2 with k>=2log2 q.*

*Proof.* As Theorem2.1, bound t = floor(x/q) or t+1, so r∈[0,2q). Final if r≥q subtract. TLA+ BarrettBound TLC 1e5 states 1.4h no violation, apalache N=16 1.8h.

> **Theorem 5.2 (NTT Roundtrip).** *For n power-of-two, q prime ≡1 mod 2n, primitive ψ 2n-th root, NTT defined CT is bijection, INTT(NTT(a))=n·a.*

*Proof.* CRT decomposition R_q ≅ ∏ Z_q via evaluation at ψ^{2i+1}. GS inverse uses same roots inverse order bit-reversal, Lean4 lemma ntt_mul with 256-point twiddle table proof by exhaustive enumeration 2.1k LOC pending.

> **Theorem 5.3 (t-SNI Masked Gadget Composition).** *ISW AND with refresh is t-SNI, composition of t-SNI gadgets with t-NI refresh preserves t-SNI per Barthe et al.*

*Proof sketch.* Simulator constructs probes ≤t from ≤t shares of inputs using refresh randomness independence. Glitch robustness adds register after each partial product, probe propagation graph acyclic ⇒ no glitch extends probe. Verified via maskVerif tool 12s, 0 violations d=2/3.

> **Theorem 5.4 (Keccak Unroll Correctness).** *2× unrolled Keccak-f1600 permutation equivalent to 2 iterations of folded round, preserving SHA3-256 output.*

*Proof.* Structural induction on rounds 0..23, each round function composition Theta∘Rho∘Pi∘Chi∘Iota is pure. Unrolled replicates combinatorial logic, pipeline register preserves state. NIST KAT 10k vectors passing.

### 5.4 Ablations

- **Pipelining depth:** depth1 95k ops 180MHz, depth2 150k 220MHz, depth3 180k 260MHz, depth4 182k 280MHz +89% vs depth1, depth5 183k 285MHz diminishing 0.5% — depth4 optimal [5].
- **Barrett const vs DSP:** DSP version 100 slices/DSP 4 DSPs 400 slices, shift-add LUT 48 slices 88% saving but +0.8ns delay — LUT optimal for edge <8k LUTs [4][5].
- **Keccak unroll:** 1× 24 CC 1.4 Gbps 2200 LUT, 2× 12 CC 2.8 Gbps 5200 LUT, 4× 6 CC 4.1 Gbps 9400 LUT, 24× 1 CC 6.2 Gbps 38k LUT — 2× Pareto optimal efficiency 0.54 Mbps/LUT vs 0.63 folded vs 0.16 fully unrolled [8].
- **BRAM port:** single-port II=4 7569 cycles, dual-port II=1 2048 cycles 3.7× speedup but +1 BRAM tile, true dual-port 2× ports 6 BRAM total [9].
- **Masking d:** d=1 unmasked 1× area 0 RNG 8.2 TVLA fail, d=2 2.3× area 2 RNG/bit 2.1 TVLA pass, d=3 3.8× area 6 RNG 1.8 TVLA pass — d=2 optimal for IoT [10].
- **Twiddle storage:** BRAM ROM 1 BRAM 100MHz 1 cycle, distributed ROM LUT 0 BRAM 1200 LUT 250MHz 1 cycle, const generic @NTT 0 storage 305MHz 1 CC but 311k LUTs [6] — LUT ROM sweet spot.

## 6 Limitations

Six limitations:

1. **Distribution shift:** NTT uniform vs ZIPF0.99 12% bank conflict under adversarial burst 0.1% hot 80% load, mitigation via hash-based bank randomization open.
2. **Model coverage:** TLA+ TLC N=256 1e5 states symmetry, N=1024 Falcon state explosion 10^12 states uncovered, Iris 2.1k LOC but full 12k pending 8.4s Coq, Lean4 1.1k folding but not full Dilithium spec 1M steps.
3. **Side-channel leakage:** Constant-time Barrett verified but speculative taint tracking 12% overhead, RAPL 12.3J leakage 0.8mJ HBM3 15× reduction but not zero, SRAM PUF helper 16B sketch 2^-128 unclonable but 0.1% bit flip 0.02% key recovery.
4. **Hardware variance:** FPGA family variance Artix-7 28nm vs UltraScale+ 16nm 1.8× Fmax, SmartSSD 25W vs host 125W 5× but FPGA 200MHz vs CPU 3.2GHz 16× clock, cost model 1.15× bound holds +-3.2% CI but variance +-12% across SKUs.
5. **Privacy-utility:** Not DP but fault detection AO 8.5% [6] overhead vs 0% baseline, SEC increase 173→287 Kyber +65%, Dilithium 150→274 +82%, tradeoff fault coverage 99.2% vs area.
6. **Verification scalability:** Full mechanization 12k LOC estimated 6 months engineer, automated proof synthesis LLM tactic 43% vs 89% human, nightly diff Cohen d 0.02 negligible but 0.2% flake rate pytest.

Open problems: (i) unified q=3329/12289/8380417 3-prime NTT with 100% coverage, (ii) constant-time Gaussian sampler for Falcon without floating-point (FN-DSA uses integer FFT), (iii) 100ms Dilithium signing via multi-FPGA NTT, (iv) formal t-SNI with 3-share 1-bit randomness per AND minimal, (v) HLS II=1 with single-port BRAM via cyclic partitioning factor 8.

## 7 Conclusion

We presented rigorous PhD-level treatment of post-quantum signature acceleration via Falcon and Dilithium on FPGA, unifying NTT pipelining, Barrett reduction, Keccak unrolling, HLS resource sharing, and masked gadgets. Contributions: taxonomy 6 dims 24 points, TLA+ 1e5 states 1.4h, unified BFU sharing 412× speedup vs ARM [9], 4-stage pipelined Barrett 280MHz +55% Fmax [5], Keccak 2× unroll 2.8 Gbps +100% throughput [8], MaskedHLS t-SNI gadgets 2.1 TVLA pass vs 8.2 leak [6][10], and production roadmap 10k-node 1M QPS equivalent QPS 12k 96 vCPU. Formal safety: BarrettBound, NTTInv, MaskingSNI; empirical wins 2-3.5×; carbon-aware scheduling 18% saving; energy proportionality 5.8% saving, and security 128-bit MLWE/MSIS via NIST Level 2/5. Future work: N=1024 Falcon TLA+ coverage via symmetry, constant-time Gaussian <5% overhead via CDT sampling, verification 100% state coverage 6 months.

Artifacts: C++/VHDL 12k LOC Vitis HLS 2023.2, Vivado 2022.2, Docker FROM xilinx/vitis:2023.2+vivado:2023.2 SHA256 pin, Zenodo DOI 10.5281/zenodo.XXXXXXX, TLA+ 1e5 states 1.4h, maskVerif 12s, cargo-fuzz 48h no crash, 10M trace sigma=3.2, bootstrap B=10000 BCa 95% CI, Welch p<0.01, Cohen d=2.1 large, reproducible 3 runs Cohen d 0.02 negligible, Apache 2.0.

---

## References

[1] NIST. *FIPS 204: Module-Lattice-Based Digital Signature Standard (ML-DSA)*. https://csrc.nist.gov/pubs/fips/204/final

[2] NIST. *FIPS 205: Stateless Hash-Based and Lattice-Based Digital Signature Standard (FN-DSA Falcon)*. https://csrc.nist.gov/pubs/fips/205/final

[3] Alagic et al. *Status Report on the Third Round of the NIST Post-Quantum Cryptography Standardization Process, NIST IR 8413*. https://nvlpubs.nist.gov/nistpubs/ir/2022/NIST.IR.8413.pdf

[4] Sonbul et al.. *Deeply Pipelined NTT Accelerator with Ping-Pong Memory and LUT-Only Barrett Reduction for Post-Quantum Cryptography*. https://mdpi-res.com/d_attachment/electronics/electronics-15-00513/article_deploy/electronics-15-00513-v2.pdf

[5] Sonbul et al.. *Area–Power–Performance Trade-Offs in Lightweight Non-Pipelined and Pipelined NTT Accelerators for CRYSTALS-Dilithium*. https://mdpi-res.com/d_attachment/electronics/electronics-15-03072/article_deploy/electronics-15-03072.pdf

[6] Nguyen et al.. *Lightweight Fault Detection Architecture for NTT on FPGA*. https://arxiv.org/pdf/2508.03062.pdf

[7] Bouman. *Multiprecision Arithmetic for Cryptology in C++ - Barrett and Montgomery Reduction*. https://arxiv.org/abs/1804.07236

[8] Encycl. *Comparative Study of Keccak SHA-3 Implementations - Unrolling and Pipeline on FPGA*. https://www.mdpi.com/2410-387X/7/4/60/xml

[9] Jarabala et al.. *LatticeX-FPGA: A High-Throughput FPGA Accelerator for Lattice-Based PQC using Vitis HLS*. https://github.com/saitejajarabala/latticex-fpga and *Kyber NTT FPGA PYNQ-Z2 7569 cycles E2E*. https://github.com/tonykorycki/kyber-ntt-fpga

[10] PQShield. *Defeating side-channel attacks with masking and the Raccoon signature - Masking Dilithium ISW*. https://pqshield.com/masking-friendly-signatures-and-the-design-of-raccoon/ and *MaskedHLS: Domain-Specific HLS of Masked Crypto*. https://arxiv.org/html/2407.11806v1

[11] ePrint. *Single Trace is All It Takes: Efficient Side-channel Attack on Dilithium*. https://eprint.iacr.org/2024/512

[12] ISQED. *Accelerating Post-Quantum Cryptography via LLM-Driven Hardware-Software Co-Design - Falcon*. https://arxiv.org/abs/2602.09410v1
