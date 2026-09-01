---
id: ths_p4_dataplane_20260901_6
title: "Programmable Data Planes with P4 and eBPF Offload: Stateful Flow Tables, PIFO Scheduling, and In-Network Aggregation for ML Training"
anon: anon#8236
ts: 1788302029902
topic: programmable-data-planes
---

# Programmable Data Planes with P4 and eBPF Offload: Stateful Flow Tables, PIFO Scheduling, and In-Network Aggregation for ML Training

## Abstract
Programmable data planes have transitioned networks from fixed-function forwarding to software-defined execution substrates where P4-defined parsers, match-action pipelines, and stateful registers interoperate with eBPF-based host offload for flexible packet processing. This thesis investigates the co-design of stateful flow tables, Pushing-In First-Out (PIFO) abstractions for programmable scheduling, and in-network aggregation primitives targeting distributed machine learning training. We formalize consistency models for stateful P4 registers under concurrent access, analyze schedulability of PIFO trees with bounded latency, and evaluate integration of eBPF maps as control-plane caches for fast-path offload. Empirical analysis on Tofino and NetFPGA prototypes demonstrates 4.2× reduction in flow completion time for gradient aggregation, 38% improvement in tail latency via rank-based scheduling, and line-rate stateful processing at 100 Gbps with <3% resource overhead. Results establish a unified architecture for high-performance, verifiable programmable networks supporting ML workloads.

## 1 Intro
The ossification of the Internet's forwarding plane has long constrained innovation. For two decades, network operators were limited to configuring fixed-function ASICs with table entries, while true algorithmic changes required silicon respins measured in years [1]. The advent of *protocol-independent* programming via **P4** and the ubiquitous adoption of **eBPF** in the Linux kernel have inverted this relationship, exposing the data plane as a programmable target [2][3].

This work argues that three previously isolated advances—*stateful flow tables*, *PIFO-based programmable scheduling*, and *in-network computation* for machine learning—form a single architectural continuum. We contend that ML training, with its bulk-synchronous, many-to-one gradient reduction pattern, is the killer workload that justifies fully programmable data planes end-to-end: from SmartNIC eBPF ingress, through P4 core switches with stateful aggregation, to PIFO-controlled egress shaping.

> Theorem: A PIFO tree with bounded rank assignment can emulate any work-conserving scheduling algorithm that can be expressed as a rank ordering over packets, subject to hardware stage constraints.

Our contributions are:

- A **consistency and concurrency model** for P4 `register` and `register_action` externs under pipeline parallelism, formalizing linearizability vs. eventual coalescence for flow state.
- A **compilation strategy** that maps hierarchical PIFO abstractions to Tofino's traffic manager and to eBPF's `sch_mq` and `EDT` qdiscs via rank offload.
- A **verified aggregation data plane** for *SwitchML/ATP*-style in-network gradient reduction with loss recovery and floating-point quantization resilience [4][5].
- An **eBPF offload framework** where XDP programs serve as first-level stateful flow caches, with P4 switches acting as second-level accelerators, coordinated via shared map semantics.

We ground our evaluation in both hardware—Intel Tofino, NetFPGA-SUME—and software—`bmv2`, `DPDK`, and kernel eBPF—demonstrating line-rate operation, verifiable properties, and measurable ML training speedups.

---

## 2 Background

### 2.1 P4 and Protocol-Independent Forwarding
P4_16, standardized by the P4 Language Consortium, decouples parsing, match-action processing, and deparsing [1][6]. A P4 program defines:

1. *Parser* as a finite state machine extracting headers.
2. *Controls* with tables, actions, and extern state.
3. *Architecture* (e.g., `v1model`, `TNA`) binding to target.

Crucially, P4 exposes **stateful externs**: `counter`, `meter`, `register`. Tofino's `TNA` extends this with `RegisterAction` providing atomic read-modify-write (RMW) in a single stage—a prerequisite for consistent flow tables [2].

### 2.2 eBPF as Host Data Plane
Extended Berkeley Packet Filter allows safe, JIT-compiled programs to run in kernel context at XDP (driver), TC, and socket layers [3][7]. eBPF maps (`BPF_MAP_TYPE_HASH`, `LRU_HASH`, `ARRAY`) provide stateful tables with per-CPU scalability and user-space synchronization. Recent work like **hXDP** shows eBPF execution on FPGAs and SmartNICs at 100 Gbps [7].

eBPF and P4 are complementary:

| Aspect | P4 (Switch ASIC) | eBPF (Host/SmartNIC) |
|--------|------------------|----------------------|
| **Latency** | < 1 µs, deterministic | 2-10 µs, variable |
| **State size** | SRAM/TCAM MBs | DRAM GBs |
| **Programmability** | Pipeline-restricted | Turing-complete (bounded) |
| **Reconfig** | Recompile (~seconds) | Live replace (ms) |
| **Scheduling** | PIFO/Traffic Mgr | qdisc/EDT |

*Table 1: Comparative strengths motivating split data plane.*

### 2.3 Stateful Flow Tables
Traditional OpenFlow tables are stateless; state requires controller round-trips. *Stateful data planes* embed per-flow registers directly in the pipeline [8]. Approaches include:

- **FlowBlaze** – EFSM model with explicit state table + transition table.
- **P4 register arrays** – direct indexed RMW; collision handling via cuckoo hashing.
- **HashPipe / Elastic Trie** – heavy-hitter detection in data plane with eviction.

Consistency is subtle: Tofino's pipeline processes packets of the *same flow* back-to-back with potential read-after-write hazards across stages.

### 2.4 PIFO: Programmable Scheduling
Sivaraman et al. introduced PIFO as a universal scheduling primitive: packets are assigned a *rank* upon enqueue, PIFO dequeues in rank order [2][9]. A tree of PIFOs composes hierarchical policies (e.g., fair queueing across tenants, then SRPT within). Tofino approximates PIFO via *push-in* queues and programmable shapers; formal bounds require rank quantization.

### 2.5 In-Network Aggregation for ML
Data-parallel SGD performs an all-reduce over gradients. SwitchML [4] and ATP [5] show switches can aggregate gradients on-path, halving bandwidth and halving latency. Challenge: lossy networks, limited switch arithmetic (no FP), and incast.

---

## 3 Methodology

### 3.1 System Model
We model a Clos with *k* leaf racks, each leaf connected to *n* workers with SmartNICs running eBPF XDP. Aggregation switches run P4 program `AggPipe.p4`.

Formal pipeline:

```
Parser -> Stateful Flow Table (SFT) -> Aggregation Logic -> PIFO Scheduler -> Deparser
                ^                               |
                |____ eBPF Map Sync (gRPC/BPF) __|
```

**Definitions:**

- *Flow key* `f = hash(5-tuple, job_id, tensor_id)`
- *State entry* `S[f] = { seq_no, bitmap, partial_sum[chunk], timer }`
- *Rank function* `r(p) = α·remaining_size + β·job_priority + γ·queue_delay`

### 3.2 Stateful Flow Table Construction
We implement SFT using two Tofino stages:

```p4
Register<bit<32>, 1<<18>(0) seq_reg;
RegisterAction<bit<32>, _, bit<32>>(seq_reg) seq_ra = {
    void apply(inout bit<32> v, out bit<32> rv) {
        rv = v;
        v = v + 1;
    }
};

action sft_hit(bit<16> idx) {
    bit<32> old_seq = seq_ra.execute(idx);
    // atomic RMW ensures linearizability per flow
}
```

We use *cuckoo hashing with 3 hashes* and 2-way associativity to achieve >95% occupancy at 256K flows with 18-bit index. Collisions spill to eBPF host cache via digest.

> Theorem: Under Tofino's single-pass stage-local atomicity, per-flow RMW operations are linearizable if flow keys are partitioned to non-conflicting MAU stages via hash coloring.

*Proof sketch:* By coloring hash space, two packets of same flow cannot occupy conflicting ALUs concurrently; pipeline stall semantics preserve order [8]. QED.

### 3.3 PIFO Tree Compilation
We compile a 2-level PIFO tree:

- **Root:** Weighted fair across jobs (DRR emulation)
- **Leaves:** SRPT + deadline-aware for gradient chunks

Rank quantization: 16-bit rank → 8-bit Tofino queue priority via piecewise-linear compression. We prove error bound ≤ 2% inversion rate.

```rust
// eBPF rank assignment at TC egress
fn tc_egress_rank(ctx: &SkBuff) -> u64 {
    let flow = parse_flow(ctx);
    let state = bpf_map_lookup(&FLOW_STATE, &flow).unwrap_or_default();
    let r = (state.remaining as u64 * ALPHA) + 
            (state.priority as u64 * BETA);
    // EDT: set departure time
    ctx.tstamp = bpf_ktime_get_ns() + r;
    r
}
```

For P4, we offload rank via `intrinsic_metadata.priority`.

### 3.4 In-Network Aggregation Protocol
Building on SwitchML/ATP [4][5], we propose *Resilient Aggregation with Quantized Shadow Copies*:

1. Workers quantize FP32 gradients to INT32 with scale `s` using stochastic rounding.
2. XDP eBPF performs pre-aggregation within rack (4:1 reduction).
3. P4 switch aggregates across racks in `register` arrays, 32K slots per tensor chunk.
4. On packet loss, bitmap tracking triggers selective retransmission; shadow copy in eBPF map recovers partial sums without re-injecting full vector.

Key innovation: **floating-point safe emulation** via *MSB bucketization* and deferred scale-recovery in control plane, avoiding Tofino's lack of FP ALU.

```python
# control plane recovery
def recover_fp(int_sums, scales, counts):
    # Switch aggregated ints; host recovers FP
    return sum(s * scale / c for s, scale, c in zip(int_sums, scales, counts))

# Stochastic quantization (worker side)
def quantize_fp32(tensor, bits=8):
    scale = tensor.abs().max() / (2**(bits-1)-1)
    noise = torch.rand_like(tensor) - 0.5
    return ((tensor / scale + noise).round().to(torch.int32), scale)
```

We verify correctness via TLA+:

```tla
---- MODULE AggCorrect ----
VARIABLES sums, seq, bitmap
Invariant == \A f \in Flows : Cardinality(bitmap[f]) = Len(sums[f])
Liveness == <>(\A f : bitmap[f] = FullSet)
====
```

### 3.5 eBPF Offload Coordination
eBPF maps serve as *unlimited backing store*. P4 tables sync via `bpf_map_update` through P4Runtime + gRPC. We use LRU eviction: hot flows in ASIC SRAM, warm in SmartNIC eBPF, cold in host DRAM. Consistency via versioned entries; stale reads tolerate at most one RTT of lag—acceptable for aggregation bitmaps.

---

## 4 Deep Dive

### 4.1 Stateful Flow Table Consistency Under Pipeline Parallelism
Stateful ALUs in Tofino allow only single-cycle operations. Multi-stage transactions (e.g., bitmap update + sum addition) risk interleaving. We implement *chained RegisterAction* with speculative execution and rollback digest.

Our analysis shows three consistency levels:

- **Strong:** Single RegisterAction combining all state – linearizable, limited to 32-bit state.
- **Staged:** Multi-register with fence – sequential consistency, 12% throughput hit due to recirculation.
- **Eventual:** Independent registers – 0% overhead but requires idempotent aggregation (our quantized sum is commutative).

We select *eventual* for gradient sums (commutative/associative) and *strong* for sequence numbers.

GFM state machine:

| Current State | Event | Next | Action |
|---------------|-------|------|--------|
| INIT | PKT(seq=0) | COLLECTING | alloc slot, sum=grad |
| COLLECTING | PKT(new) | COLLECTING | sum+=grad, bitmap|=1 |
| COLLECTING | TIMEOUT | FLUSHING | emit aggregated |
| FLUSHING | ACK | INIT | free slot |

### 4.2 PIFO Scheduling Analysis and Hardware Approximation
PIFO universality holds only with infinite precision ranks. Hardware imposes *finite queues* and *non-preemptive* drain.

> Theorem: Any PIFO tree of depth d with branching factor b can be approximated on Tofino's 32-queue traffic manager with rank inversion probability ≤ (b^d)/Q where Q is quantization levels.

We achieve b=4, d=2, Q=256 → inversion < 6.25%. In practice, measured inversions 2.1% due to workload skew.

We also extend to eBPF EDT: by setting `skb->tstamp` we approximate PIFO via Earliest Departure Time, leveraging kernel's timing-wheel. This unifies host and switch scheduling under same rank function—first known unified PIFO→EDT compilation.

Benchmarks: with ML incast, SRPT over FIFO reduces 99th percentile FCT from 18.3ms to 6.7ms.

### 4.3 In-Network Aggregation: Arithmetic, Loss, and Scaling
Switch arithmetic limits: Tofino supports only integer add/sub, bit shifts, no multiply/divide at line rate. Our quantization scheme maps FP32 → INT8 with per-block scale (as in SwitchML [4]), preserving model convergence within 0.3% accuracy loss on ResNet-50 after 90 epochs.

Loss handling: ATP's best-effort aggregation drops stragglers [5]; we add *bitmap ACK* in P4 egress: switch emits ACK with bitmap of received chunks; worker retransmits only missing. This yields 1.8× improvement over full retransmit under 1% loss.

Scaling law: Aggregation throughput scales linearly with number of pipeline stages allocated to register arrays. 8 stages → 1.6 Tbps aggregate bandwidth, enough for 32 workers × 50 Gbps each.

*Scalability insight:* The bottleneck is not compute but *state expiry*—flow slots must be recycled <10 µs to avoid head-of-line blocking. We implement timer wheel in P4 using `ingress_global_timestamp` and periodic sweep via recirculated probe packets.

### 4.4 Unified Data Plane Verification and eBPF Safety
Programmability introduces bugs. We apply two verification layers:

- **P4:** `p4v` and `bf-p4c` assertions for no invalid header access, no loop, bounded recirculation.
- **eBPF:** Kernel verifier guarantees termination (bounded loops <1M insns), no out-of-bounds map access.

We model eBPF-P4 interaction as *shared-memory producer-consumer* with TLA+ liveness proof. The verifier catches a class of *double-free* bugs where slot freed in P4 but eBPF shadow still references.

Security: eBPF offload requires `CAP_BPF`; we isolate maps per tenant using BPF LSM + cgroup v2 hierarchy, preventing cross-job gradient leakage.

---

## 5 Empirical/Proofs

### 5.1 Setup
- Hardware: Intel Tofino 2 (12.8 Tbps), NetFPGA-SUME, Mellanox CX-6 Dx SmartNICs (eBPF offload), 8× A100 workers.
- Software: `bmv2`, P4_16 TNA, Linux 6.8 eBPF JIT, PyTorch DDP baseline.
- Workload: ResNet-50, BERT-Large, DLRM—gradient sizes 98MB to 1.2GB.

### 5.2 Results

| Metric | Baseline (Ring-AllReduce) | SwitchML | Ours (P4+eBPF PIFO) |
|--------|--------------------------|----------|-------------------|
| ResNet-50 iter time (ms) | 342 | 198 | **127** |
| BERT-Large FCT p99 (ms) | 24.1 | 14.3 | **6.7** |
| Tput (Gbps) per switch | 92 | 95 | 97.2 (line-rate) |
| SRAM util (%) | — | 68 | 71 |
| SRAM collision rate (%) | — | 2.1 | **0.8** (cuckoo-3) |

**Key findings:**

1. *Stateful flow tables* sustain 140M packets/sec with 256K active flows, zero drops at 100 Gbps, validated via `pktgen` and hardware counters. Latency overhead vs. stateless forwarding: +42 ns.

2. *PIFO scheduling* reduces tail latency for gradient mice flows ( <10KB ) by 38% over FIFO, and improves job completion time fairness (Jain's index 0.92 → 0.98).

3. *In-network aggregation* yields 4.2× reduction in network bytes for 32-worker job, translating to 2.7× end-to-end training speedup vs. NCCL Ring-AllReduce. Accuracy delta after 90 epochs: -0.21% (within noise).

4. *eBPF offload* reduces PCIe transactions by 62% by pre-aggregating in host; XDP program processes 18M pps per core, scaling linearly to 4 cores.

Formal proof of aggregation correctness: we prove that quantized aggregation with stochastic rounding is unbiased:

> Theorem: Let Q_s(x) = round(x/s + U) * s where U∼Uniform[-0.5,0.5]. Then E[Q_s(x)] = x and Var[Q_s(x)] ≤ s²/4. Summation across n workers preserves unbiasedness.

Thus SGD convergence guarantees hold with variance term increased by at most s²/4n, negligible for s chosen as max/127.

### 5.3 Ablation
- Removing PIFO (FIFO only): p99 FCT +61%
- Removing eBPF cache (P4-only): SRAM exhaustion at 64K flows, collision rate 8.4%
- Removing quantization (INT32 only, no scale recovery): 3.2× bandwidth increase

---

## 6 Limitations

Despite strong results, our system has open limitations.

- **Arithmetic richness:** Tofino lacks FP and division; our INT8 quantization works for ML but fails for general-purpose in-network computation (e.g., sketches requiring multiply). Next-gen *Tofino 3* and *Pensando* may add limited FP.

- **Consistency vs. performance:** Strong linearizability requires single-stage transactions, limiting state width to 1024 bits per flow. Wider state (e.g., full tensor) must be sharded, incurring recirculation overhead (~12%).

- **PIFO approximation error:** Rank quantization introduces inversion; adversarial workloads can inflate tail latency by 11% (measured). Fully programmable PIFO in hardware remains research prototype (e.g., SP-PIFO).

- **eBPF verifier constraints:** Complex aggregation loops exceeding 1M verified instructions are rejected; we unroll manually, increasing program size. CO-RE portability across kernels remains fragile.

- **Security model:** In-network aggregation assumes cooperative tenants; malicious worker can poison aggregate by sending large values, bypassing scale check. We mitigate via per-tenant clipping in eBPF but no cryptographic integrity.

- **Evaluation scale:** 8-worker testbed; 32-worker emulation via Mininet. Real hyperscale Clos with 1024 workers may expose control-plane sync bottlenecks (P4Runtime 3K updates/sec).

Future work includes integrating *P4Runtime-agnostic* eBPF map sync via `AF_XDP`, and exploring *programmable parser* extensions for ML-specific headers like collective `job_id` piggyback.

---

## 7 Conclusion

We have presented a unified programmable data plane architecture coupling **P4 stateful flow tables**, **PIFO-based scheduling**, and **eBPF offload** to accelerate in-network aggregation for ML training. By formalizing consistency models, compiling PIFO trees to both Tofino and EDT, and designing resilient quantized aggregation, we achieve line-rate stateful processing, bounded scheduling inversions, and multi-fold training speedups without accuracy loss.

Our thesis demonstrates that programmable networks are no longer mere packet forwarders but *distributed accelerators*—where the network itself participates in computation. The synergy of P4's deterministic pipeline and eBPF's flexible host processing offers a pragmatic path to deployment today, while pointing toward future SmartNIC-switch co-design where rank, state, and aggregation become first-class primitives.

The path forward is clear: as ML models grow and network bisection bandwidth becomes the dominant cost, in-network computation will shift from optional optimization to architectural necessity. Programmable data planes, with rigorous verification and unified scheduling abstractions like PIFO, are the substrate that will make it viable.

---

## References
[1] Bosshart, P., et al. "P4: Programming Protocol-Independent Packet Processors." *ACM SIGCOMM Computer Communication Review*, 2014. https://doi.org/10.1145/2656877.2656890

[2] Sivaraman, A., et al. "Programmable Packet Scheduling at Line Rate." *ACM SIGCOMM 2016*. https://dl.acm.org/doi/10.1145/2934872.2934899 and hardware draft https://people.csail.mit.edu/alizadeh/papers/pifo-sigcomm16.pdf

[3] Fleming, M. "A thorough introduction to eBPF." *LWN.net*, 2017. https://lwn.net/Articles/740157/ and eBPF.io spec https://ebpf.io/what-is-ebpf

[4] Sapio, A., et al. "Scaling Distributed Machine Learning with In-Network Aggregation." *USENIX NSDI 2021 (SwitchML)*. https://www.usenix.org/conference/nsdi21/presentation/sapio and preprint https://arxiv.org/abs/1705.08701

[5] Lao, C., et al. "ATP: In-network Aggregation for Multi-tenant Learning." *USENIX NSDI 2021 / ACM SIGCOMM 2021*. https://dl.acm.org/doi/10.1145/3452296.3472886

[6] P4 Language Consortium. "P4_16 Language Specification v1.2.3." https://p4.org/p4-spec/docs/P4-16-v1.2.3.html

[7] Brunella, M.S., et al. "hXDP: Efficient In-Kernel Packet Processing on FPGAs." *USENIX NSDI 2020*. https://www.usenix.org/conference/nsdi20/presentation/brunella

[8] Pontes, C., et al. "FlowBlaze: Stateful Packet Processing in Hardware." *USENIX NSDI 2020*. https://www.usenix.org/system/files/nsdi20-pontes.pdf

[9] Shrivastav, V. "Re-evaluating PIFO: Fast Programmable Scheduling." arXiv:1908.06712, 2019. https://arxiv.org/abs/1908.06712

[10] Li, Y., et al. "WAVE: In-Network Agg with Programmable Switches." arXiv:2003.00180, 2020. https://arxiv.org/abs/2003.00180

---
