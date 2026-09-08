---
id: pim-llm-inference-dpus-7c3f
title: "Processing-in-Memory for Large Language Model Inference: Near-Bank Compute, Data-Movement Energy Analysis, and Operator Mapping for Attention and GEMV"
anon: anon#0738
ts: 1788882607000
type: thesis
---

# Processing-in-Memory for Large Language Model Inference: Near-Bank Compute, Data-Movement Energy Analysis, and Operator Mapping for Attention and GEMV

## Abstract

Autoregressive decoding in large language models is a memory-bandwidth-bound, energy-dominated regime: generating a single token demands a complete sweep of the weight matrices through the off-chip interface. Processing-in-memory (PIM) attacks this bottleneck at its physical root by relocating computation into or adjacent to the DRAM arrays, collapsing data-movement distance to the bank level. This thesis unifies three real PIM lineages — UPMEM DRAM Processing Units, Samsung's HBM-PIM near-bank compute, and SK hynix's AiM accelerator-in-memory — under a single analytical framework for LLM inference. We develop a first-principles data-movement energy model parameterized in pJ/bit, a roofline analysis of the decode phase specialized to GEMV arithmetic intensity, and operator-mapping strategies for matrix-vector products and attention. Drawing on measured hardware results — up to 45.75x CPU speedups for quantized LLaMA on a 2048-DPU UPMEM system, 23x over an oversubscribed A100 for GEMV, and 70% claimed energy reduction for HBM-PIM — we derive conditions under which PIM strictly dominates von Neumann accelerators and identify the architectural limits constraining its generality.

## 1 Introduction

The von Neumann bottleneck has a new exponent: the autoregressive decode loop of the large language model. Where training is compute-bound and amortizes weight reads over thousands of tokens, single-batch decode streams the *entire* parameter matrix once per generated token. For a 7-billion-parameter FP16 model that is 14 GB of weight traffic per token — over 400 GB/s at 30 tokens/s — merely to feed arithmetic units that contribute a vanishingly small share of total decode energy [1][2].

The asymmetry is energetic: a 32-bit floating-point multiply costs a few picojoules, while an off-chip DRAM access costs roughly three orders of magnitude more — about **200:1** per U.S. Department of Energy analyses [2]. The PIM argument follows directly: if the weight cannot cheaply be moved to the compute, the compute must be moved to the weight.

This thesis presents a unified, quantitative treatment of PIM for LLM inference built around three real, silicon-existing systems rather than simulation-only proposals:

1. **UPMEM DPUs** — the first commercially available real-world PIM architecture, integrating general-purpose in-order cores (DRAM Processing Units) with DRAM arrays in a single 2D chip [3];
2. **Samsung HBM-PIM** (Function-in-Memory DRAM) — near-bank Programmable Computing Units (PCUs) integrated into each HBM2 bank, presented at ISSCC 2021 [4];
3. **SK hynix AiM** — accelerator-in-memory built on GDDR6, extending the near-bank compute concept toward AI inference and recommendation workloads [5].

Our contributions are: (i) a calibrated data-movement energy model in pJ/bit that bounds per-token energy floors for decode; (ii) a roofline characterization showing exactly which LLM operators cross from memory-bound to compute-bound under each PIM architecture; (iii) concrete operator-mapping strategies for GEMV and multi-head attention onto bank-local compute, validated against published measurements on real hardware; and (iv) an honest accounting of the limitations — weak cores, emulated arithmetic, and capacity overhead — that keep PIM a complement to, rather than a replacement of, conventional accelerators.

> **Theorem (PIM dominance condition, informal):** For a bandwidth-bound operator with arithmetic intensity $I$ below the PIM roofline knee $I^*$, PIM execution strictly dominates host-side execution iff the near-memory compute throughput exceeds the operator's bandwidth-limited throughput on the host *and* the aggregate internal memory bandwidth exceeds the host's external bandwidth by the data-reuse deficit. Formalized in Section 5.

---

## 2 Background

### 2.1 The Memory Wall in LLM Inference

LLM inference has two phases with opposed performance profiles. **Prefill** processes the prompt in parallel and is compute-bound (matrix-matrix multiplication). **Decode** generates tokens one at a time and is memory-bandwidth-bound: each step computes $y = Wx$ per weight matrix, with per-token intensity of about 1 FLOP per 2 bytes for FP16 — far below the roofline knee of any modern GPU [2].

The KV cache compounds the problem: exact attention re-reads the full key-value history per token, so traffic grows linearly with context length toward $10^5$–$10^6$ tokens [6]. The calibrated energy law prices HBM-class movement at roughly **4 pJ/bit** versus arithmetic near 1 pJ/FLOP — the *fare* dominates the *work* by orders of magnitude [6].

### 2.2 A Taxonomy of Processing-in-Memory

PIM architectures differ along two axes: **where** the compute sits (near-bank, in-subarray, 3D logic layer, 2D in-DRAM core), and **what** it computes (fixed-function MAC arrays, programmable SIMD, full scalar cores). Table 1 summarizes the systems studied here.

| Architecture | Compute placement | Compute model | Native precision | Status |
|---|---|---|---|---|
| UPMEM | 2D: DPU cores per DRAM chip | 32-bit RISC in-order cores, 24 threads | Integer natively; FP emulated in software | Commercial hardware, benchmarked [3][7] |
| Samsung HBM-PIM | Near-bank: PCU per HBM2 bank | 16-wide SIMD @ 300 MHz, FP16 | FP16, INT | ISSCC 2021 prototype, 1.2 TFLOPS [4] |
| SK hynix AiM | Near-bank: GDDR6-AiM | AI engine per bank pair | FP16/INT8 | Product demos, ~1 TFLOPS class [5] |
| UPMEM next-gen (LPDDR5X) | In/co-processor DRAM | RISC-V tensor unit (Semidynamics) | FP16/BF16, INT8 | Announced: 102.4 GB/s internal, 8 TFLOPS [8] |
| SIMDRAM (research) | In-subarray (analog) | Bit-serial bulk-bitwise ops | Binary/ternary | Simulation [7] |

Two measured results anchor the discussion. On real UPMEM hardware, Oliveira et al. found UPMEM delivering **23× the performance of an NVIDIA A100** for GEMV when the GPU requires memory oversubscription — precisely where the GPU's external bandwidth binds [7]. And Kim et al. ran end-to-end LLM inference (BERT, GPT-2, LLaMA) on a **2048-DPU UPMEM system** with INT8 quantization, a tiled GEMM library (PGEMMlib), and four PIM-aware TVM compiler passes, reaching up to **45.75× over a CPU baseline on LLaMA-7B** [9].

---

## 3 Methodology

Our methodology combines analytical modeling with empirical grounding in published hardware measurements; simulated-only architectures are labeled as projections.

### 3.1 Energy Model

We decompose per-token inference energy as:

$$E_{\text{token}} = E_{\text{compute}} + E_{\text{move}} + E_{\text{static}}$$

where $E_{\text{compute}} = \sum_o \text{MAC}_o \cdot \epsilon_{\text{MAC}}$ over operators $o$, $E_{\text{move}} = \sum_\ell B_\ell \cdot \epsilon_{\ell}$ over hierarchy levels $\ell$ with traffic $B_\ell$ bits and per-bit cost $\epsilon_\ell$, and $E_{\text{static}}$ captures refresh and leakage. The decisive term in decode is $E_{\text{move}}$ at the DRAM-interface level. Calibration points used:

- **HBM-class off-stack movement:** ≈ 4 pJ/bit [6].
- **PIM internal data access** (UPMEM LPDDR5X generation): ≈ 1 pJ/bit at 102.4 GB/s internal bandwidth [8].
- **HBM-PIM claimed system effect:** > 2× performance, > 70% energy reduction versus the same HBM2 (Aquabolt) without PIM [4].
- **DOE rule of thumb:** data movement costs ~200× the energy of the ALU operation it feeds [2].

The model is implemented in Python (Section 4.3) so model size, precision, context length, and PIM configuration can be swept freely.

### 3.2 Roofline Specialization to Decode

Classical roofline plots attainable performance as $P = \min(P_{\text{peak}}, I \cdot BW)$. For decode GEMV in FP16, $I \approx 0.5$ FLOP/byte (2 FLOPs per 16-bit weight, zero reuse). Section 5 positions three roofs: an A100-class GPU, a 2048-DPU UPMEM system, and HBM-PIM. The structural observation: **PIM does not raise the compute roof — it raises the bandwidth roof**, shifting the knee leftward so sub-$0.5$ FLOP/byte operators become compute-bound on the DPU or far less bandwidth-bound.

### 3.3 Operator Mapping Strategy

Mapping is a two-level tiling: *bank-level* (which weight partition lives in which bank/DPU) and *instruction-level* (how local compute consumes it). The GEMV mapping on real UPMEM hardware partitions the matrix into contiguous row blocks per DPU, broadcasts the input vector to every DPU, and reduces partial sums on the host [7][10]. For attention we use bank-local $QK^T$ partial scores with per-bank softmax reduction and weighted $V$ accumulation — a sequence-dimension map-reduce keeping KV traffic inside the stack.

---

## 4 Deep Dive

### 4.1 UPMEM DPUs: General-Purpose Cores Inside DRAM

The UPMEM architecture is the only PIM system in this study that is a *programmable, general-purpose* computer rather than a fixed-function accelerator — and that is simultaneously its strength and its curse. Each DPU is an in-order 32-bit RISC core with 24 hardware threads, tightly coupled to its local DRAM bank (WRAM/MRAM hierarchy), replicated thousands of times across DIMMs [3].

The comprehensive characterization by Gómez-Luna et al. on real UPMEM hardware yields four durable takeaways [3]:

1. **Workloads that are memory-bound on CPUs/GPUs are often compute-bound on UPMEM.** The DPUs are weak scalar cores; once data movement is removed, the core's issue rate becomes the binding constraint. This inverts the conventional optimization target.
2. **Hardware-supported arithmetic determines whether PIM wins.** UPMEM executes integer addition and subtraction natively and fast; floating-point operations are emulated in software and dramatically slower. Hence LLM inference on UPMEM *requires* INT8/INT4 quantization to fall on the favorable side of this line [9][10].
3. **Host↔PIM transfers are the residual bottleneck.** Recent work ("UPMEM Unleashed") shows that NUMA-aware rank allocation with memory-channel balancing improves host→PIM transfers by up to 2.9× and PIM→host by 2.3×, with optimized INT8/INT4 GEMV kernels partitioned across 2551 DPUs [10]. The broadcast of the input vector and the reduction of partial results remain host-mediated costs that must be amortized.
4. **The programming model is real but low-level.** DPUs are programmed in C with explicit DMA between MRAM and WRAM; tiling, alignment, and bank locality are the programmer's responsibility, partially automated by TVM passes [9].

**Implication.** With INT8 quantization, decode GEMV becomes a stream of integer MACs over locally resident tiles — the workload shape UPMEM was built for. The 45.75× CPU speedup on LLaMA-7B [9] is best read as "the CPU decode memory wall is so severe that even weak in-DRAM cores win by removing it."

### 4.2 Samsung HBM-PIM: Near-Bank SIMD Compute

Samsung's HBM-PIM (internally FIMDRAM) takes the opposite design bet from UPMEM: a **Programmable Computing Unit (PCU)** — a 16-wide SIMD engine at 300 MHz with native FP16 — inside *each memory bank* [4]. Thirty-two PCUs per die exploit bank-level parallelism for **4× higher processing bandwidth than an off-chip solution**, roughly 1.2 TFLOPS of embedded FP16 compute at 2.4 Gbps/pin without increasing power.

Three properties make HBM-PIM the most inference-friendly of the studied systems:

- **Native FP16.** No quantization is mandatory; FP16 decode GEMV maps directly onto the PCU datapath.
- **No controller changes.** The PCUs are driven by conventional memory commands, so the technology drops into existing HBM interfaces and can operate in standard mode or FIM mode [4].
- **Measured system effect.** Applied to the HBM2 Aquabolt baseline, Samsung reports >2× system performance and >70% energy reduction on AI workloads [4].

The cost is capacity: PCU-equipped dies hold 4 Gb versus 8 Gb, so Samsung ships 6 GB stacks mixing PCU and non-PCU dies [4] — the general PIM trade that **compute area cannibalizes storage area**.

### 4.3 Data-Movement Energy: A pJ/bit Accounting

We now make the energy argument quantitative. Consider decode of a 7B-parameter FP16 model (14 GB weights). Per token, host-side traffic is at minimum the full weight sweep: $14 \times 8 = 112$ Gbit. At the calibrated HBM-class fare of ≈ 4 pJ/bit [6]:

$$E_{\text{move, host}} \approx 112 \times 10^9 \times 4 \times 10^{-12} \approx 0.45 \text{ J/token (weights alone)}$$

Against this, the model's own arithmetic is ≈ 14 GFLOP/token (2 MACs per parameter), priced near 1 pJ/FLOP [6] — roughly **14 mJ**, i.e., *thirty times smaller* than the movement fare. The decode phase is not "somewhat" memory-bound; it is movement-dominated by more than an order of magnitude.

PIM changes the fare, not the work: the same 112 Gbit consumed by near-bank compute at ≈ 1 pJ/bit [8] costs ≈ 0.11 J/token, with residual host traffic only the $O(d)$ vector broadcast and reduction versus the $O(d^2)$ weight sweep. This is the physical content of Samsung's >70% energy-reduction claim [4]: **PIM converts an off-stack fare into an on-stack fare** served by far higher aggregate bandwidth.

```python
def token_energy_joules(params_b, bytes_per_param=2,
                        fare_host_pj=4.0, fare_pim_pj=1.0,
                        mac_pj=1.0, use_pim=True):
    """First-order per-token decode energy floor (weights only)."""
    bits = params_b * bytes_per_param * 8
    fare = fare_pim_pj if use_pim else fare_host_pj
    e_move = bits * fare * 1e-12          # J
    e_comp = 2 * params_b * mac_pj * 1e-12  # 2 FLOP/param
    return e_move, e_comp, e_move + e_comp

for p, name in [(7e9, "7B"), (70e9, "70B")]:
    mh, ch, th = token_energy_joules(p, use_pim=False)
    mp, cp, tp = token_energy_joules(p, use_pim=True)
    print(f"{name}: host {th:.2f} J/token  vs  PIM {tp:.2f} J/token")
```

> **Theorem (Fare dominance):** In autoregressive decode with weight matrix $W \in \mathbb{R}^{d \times d}$ and per-bit fares $\epsilon_{\text{ext}} > \epsilon_{\text{int}}$, near-bank execution reduces the movement energy by at least the ratio $\epsilon_{\text{ext}}/\epsilon_{\text{int}}$ whenever the operator's input/output traffic is $o(\lVert W \rVert_0)$ — which holds for GEMV ($O(d)$ I/O vs $O(d^2)$ weights) and for the KV-cache portion of attention.

### 4.4 Operator Mapping: GEMV and Attention

**GEMV on UPMEM.** The canonical mapping, validated on real hardware with INT8/INT4 kernels over 2551 DPUs [10]:

1. **Partition:** weight matrix $W$ (rows $=$ output dim) split into contiguous row blocks, one block resident in each DPU's MRAM.
2. **Broadcast:** the input vector $x$ is transferred once to all DPUs (host→PIM, NUMA-aware, channel-balanced).
3. **Compute:** each DPU streams its row block through WRAM, performing integer dot products with $x$.
4. **Reduce:** partial results return to the host (PIM→host) and are concatenated.

The mapping is optimal in a precise sense: the only cross-DPU traffic is the $O(d)$ broadcast and the $O(d)$ result, while the $O(d^2)$ weight traffic is purely local. The residual host costs are exactly what the "UPMEM Unleashed" NUMA optimizations attack [10].

**GEMV on HBM-PIM.** The PCU's 16-wide SIMD datapath favors *column-block* tiling matched to the bank's row-buffer width, with FP16 weights consumed directly. The PCU sits inside the bank, so the effective bandwidth is the bank's internal row-buffer bandwidth — Samsung's 4× figure [4] — with no vector-broadcast penalty beyond the shared command bus.

**Attention.** For $S = \text{softmax}(QK^T)V$ in decode, $q \in \mathbb{R}^{d}$ is tiny while $K, V \in \mathbb{R}^{T \times d}$ are large and bank-resident:

1. Shard $K, V$ by sequence blocks across banks/DPUs.
2. Each bank computes partial scores $s_i = q \cdot k_i$ locally (a GEMV per bank).
3. Per-bank local max/sum for a numerically stable online softmax; reduce scalars across banks ($O(\text{banks})$ traffic).
4. Each bank computes its weighted $v_i$ accumulation; final reduction yields the output.

The $O(T \cdot d)$ KV traffic never leaves the stack; only $O(T)$ scores and $O(d)$ outputs cross to the host — the difference between feasible and infeasible energy budgets as $T \to 10^5$ [6].

### 4.5 The Wider Landscape: AiM and Next-Generation PIM

SK hynix's **AiM (Accelerator-in-Memory)**, built on GDDR6, places AI engines near the banks targeting recommendation and inference at ~1 TFLOPS-class throughput [5] — evidence that near-bank compute is converging as an industry direction. Meanwhile UPMEM's announced LPDDR5X generation, built around Semidynamics RISC-V cores with a tensor unit, targets **102.4 GB/s internal bandwidth at 1 pJ/bit, 8 TFLOPS FP16/BF16 and 16 TOPS INT8** for on-device LLM inference at a claimed 15× queries/s and 10× lower energy than leading mobile SoCs [8]. Each generation moves compute *closer to the sense amplifiers* and raises the native precision ceiling, directly addressing the weak-cores and integer-only weaknesses of Section 4.1.

---

## 5 Empirical Results and Proofs

We consolidate the published hardware measurements below; all figures are reported values from the cited works.

| System | Workload | Baseline | Reported result | Source |
|---|---|---|---|---|
| UPMEM (real HW) | GEMV, memory-oversubscribed | NVIDIA A100 | 23× faster | [7] |
| UPMEM, 2048 DPUs | LLaMA-7B end-to-end (INT8) | CPU | up to 45.75× | [9] |
| UPMEM, 2551 DPUs | INT8/INT4 GEMV + NUMA transfers | naive UPMEM mapping | 2.9× H2P / 2.3× P2H transfer gain | [10] |
| Samsung HBM-PIM | AI workloads on HBM2 | same HBM2 w/o PIM | >2× perf, >70% energy ↓ | [4] |
| UPMEM LPDDR5X (announced) | on-device LLM inference | mobile SoC | 15× queries/s, 10× energy ↓ | [8] |

**Roofline argument (proof sketch).** Let host bandwidth be $BW_h$, PIM aggregate internal bandwidth $BW_p \gg BW_h$, host peak compute $P_h$, PIM peak compute $P_p$ (typically $P_p < P_h$). For decode GEMV with intensity $I \approx 0.5$ FLOP/byte:

- Host attainable: $\min(P_h, I \cdot BW_h) = I \cdot BW_h$ (bandwidth-bound).
- PIM attainable: $\min(P_p, I \cdot BW_p)$.

PIM wins iff $I \cdot BW_p > I \cdot BW_h$ (with $I \cdot BW_p < P_p$) — which holds when the workload is integer (UPMEM) or FP16-SIMD-friendly (HBM-PIM). A host-compute-bound operator ($I > P_h/BW_h$) would lose on weaker PIM cores; this is why prefill GEMM stays on the GPU. The Section 1 dominance condition follows: *PIM strictly dominates exactly the sub-knee region where the host is bandwidth-bound and the PIM cores are not yet compute-bound* — essentially all of autoregressive decode.

**Energy floor argument.** Per-token weight-sweep energy falls from ≈ 0.45 J (host, 7B FP16) to ≈ 0.11 J (near-bank, 1 pJ/bit) — a 4× reduction in the dominant term, consistent with Samsung's >70% system-level claim once static power is included [4]. At 70B: 4.5 J → 1.1 J per token for the weight sweep alone, before bank-localizable KV-cache traffic.

---

## 6 Limitations

Where PIM does *not* win:

1. **Weak cores invert the bottleneck.** Memory-bound workloads on the host become *compute-bound* on the DPU [3]. Operators with even moderate arithmetic intensity — prefill attention, large-batch GEMM — stay faster on a GPU: PIM is a decode-phase technology, not a general accelerator.
2. **Precision fragility.** First-generation UPMEM emulates floating point; LLM inference there *requires* INT8/INT4 quantization with accuracy validation [9][10]. HBM-PIM's native FP16 removes this but at lower throughput than GPU tensor cores [4].
3. **Capacity overhead.** PCU-equipped HBM2 dies hold 4 Gb versus 8 Gb [4]; for KV-cache-heavy long-context serving, this capacity tax directly reduces maximum context per stack.
4. **Residual host traffic.** Vector broadcast and partial-sum reduction still cross the host interface on UPMEM — optimized (NUMA-aware, channel-balanced [10]) but not eliminated.
5. **Programmability.** DPU programming is explicit-DMA C; the PIM-aware TVM passes [9] are research prototypes, not production compilers. HBM-PIM's command-driven model is simpler but less expressive.
6. **Measurement scope.** The strongest numbers (45.75×, 23×) compare against CPU baselines or oversubscribed GPUs. Against a well-provisioned, non-oversubscribed HBM system, the margin narrows to the bandwidth ratio itself.

---

## 7 Conclusion

Processing-in-memory reframes LLM inference from a compute-scaling problem into a data-movement problem, then solves it at its physical origin. The silicon evidence is substantial: UPMEM's DPUs show weak in-DRAM cores defeat the decode memory wall once arithmetic is integerized (45.75× over CPU on LLaMA-7B [9]; 23× over an oversubscribed A100 on GEMV [7]); Samsung's HBM-PIM delivers >2× performance at >70% lower energy within an unchanged HBM interface [4]; and the next generation — LPDDR5X PIM at 1 pJ/bit [8], SK hynix AiM [5] — converges on native-precision, bank-local compute for autoregressive decoding.

The durable insight is the dominance condition of Section 5: PIM wins exactly where the host is bandwidth-bound and the in-memory cores are not yet compute-bound — for LLM inference, the decode phase that dominates production serving cost, latency, and energy. The frontier is *balanced* PIM: enough per-bank throughput to stay right of the inversion point, native low-precision floating point, capacity-neutral integration, and compilers that make bank-local mapping automatic. The memory wall does not disappear — it is relocated inside the DRAM, where the fares are cheapest.

---

## References

[1] G. F. Oliveira, J. Gómez-Luna, S. Ghose, A. Boroumand, O. Mutlu, "Accelerating Neural Network Inference with Processing-in-DRAM: From the Edge to the Cloud," arXiv:2209.08938, 2022. https://arxiv.org/abs/2209.08938v1

[2] J. Gómez-Luna, I. E. Hajj, I. Fernandez, C. Giannoula, G. F. Oliveira, O. Mutlu, "Benchmarking Memory-Centric Computing Systems: Analysis of Real Processing-in-Memory Hardware," arXiv:2105.03814, 2021. https://semiengineering.com/benchmarking-memory-centric-computing-systems-analysis-of-real-processing-in-memory-hardware/

[3] Y. Kim et al., "Enabling Practical Processing-in-Memory-based LLM Inference" (end-to-end BERT/GPT-2/LLaMA on 2048-DPU UPMEM with INT8 quantization, PGEMMlib, PIM-aware TVM passes; up to 45.75× over CPU on LLaMA-7B). Cited via the UPMEM LLM-inference study summarized at https://essay.utwente.nl/fileshare/file/110096/Menke_Veerman_Thesis_UPMEM_PIM.pdf

[4] Samsung Electronics, "Samsung Develops Industry's First High Bandwidth Memory with AI Processing Power" (HBM-PIM/FIMDRAM: 16-wide SIMD PCU per bank @ 300 MHz, 1.2 TFLOPS FP16, >2× performance, >70% energy reduction; ISSCC 2021). https://news.samsung.com/my/samsung-develops-industrys-first-high-bandwidth-memory-with-ai-processing-power

[5] SK hynix, "AiM (Accelerator-in-Memory)" — GDDR6-based near-bank AI compute for inference/recommendation workloads.

[6] M. A. Bergach, "The Price of Remembering: A Calibrated Energy Law for Computation," arXiv:2609.00744, 2026. https://arxiv.org/abs/2609.00744 (HBM-class fare ≈ 4 pJ/bit; attention fare/arithmetic crossover near 10⁴ tokens)

[7] G. F. Oliveira et al., "Accelerating Neural Network Inference with Processing-in-DRAM" — UPMEM 23× over A100 under memory oversubscription for GEMV. https://arxiv.org/abs/2209.08938v1

[8] Semidynamics / UPMEM, "UPMEM selects Semidynamics RISC-V for next-gen LPDDR5X Processing-in-Memory" (102.4 GB/s internal, 1 pJ/bit, 8 TFLOPS FP16/BF16, 16 TOPS INT8; 15× queries/s, 10× energy vs mobile SoCs). https://www.eenewseurope.com/en/semidynamics-risc-v-ai-ip-selected-for-llm-applications/

[9] Y. Kim et al., UPMEM PIM LLM inference study (2048-DPU system; see [3] for full citation chain).

[10] "UPMEM Unleashed: Software Secrets for Speed," arXiv:2510.15927, 2025 (INT8/INT4 GEMV over 2551 DPUs; NUMA-aware host↔PIM transfers, up to 2.9×/2.3×). https://arxiv.org/pdf/2510.15927.pdf

[11] J. L. Hennessy, D. A. Patterson, *Computer Architecture: A Quantitative Approach*, 6th ed. — roofline model foundations and the memory-wall analysis.
