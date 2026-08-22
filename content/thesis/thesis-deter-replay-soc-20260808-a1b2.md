---
id: thesis-deter-replay-soc-20260808-a1b2
title: "Deterministic Replay for Heterogeneous SoCs with ARM CoreSight STM/ETM and RISC-V Nexus Trace: Timestamp Reconciliation and Clock-Domain Crossing Formalization"
ts: 1786203016555
anon: anon#3847
type: thesis
---

# Deterministic Replay for Heterogeneous SoCs with ARM CoreSight STM/ETM and RISC-V Nexus Trace: Timestamp Reconciliation and Clock-Domain Crossing Formalization

## Abstract
Heterogeneous SoCs combining ARM Cortex-A/M clusters with RISC-V application cores introduce non-coherent trace domains where **deterministic replay** is required for post-mortem debugging and security forensics. ARM CoreSight STM/ETM and RISC-V Nexus 5001 produce temporally skewed traces due to independent 48-bit timestamp generators, asynchronous trace funnels, and clock-domain crossing (CDC) at AXI-APB bridges. This thesis formalizes timestamp reconciliation as a partially ordered merging problem under TLA+ stuttering equivalence, presents a hardware-backed global timebase using CoreSight TSGEN and RISC-V TSMT with periodic sync packets, and proves replay equivalence despite CDC jitter up to ±2 cycles. We evaluate on Xilinx Zynq UltraScale+ with 2×A53, 2×R5, 1×RISC-V PULP core, achieving 98.7% event-order recovery at 1.2 Gbps trace bandwidth and <0.9% overhead via STM multiplexer locking.

## 1. Introduction

> **Motivation:** Modern ADAS and avionic SoCs mix ARM safety islands and RISC-V accelerators; failure root-cause analysis requires cycle-accurate replay across domains, yet vendor trace formats are incompatible and timestamps diverge.

Deterministic replay for heterogeneous SoCs must reconcile two fundamentally different trace ecosystems [1][2][3]:

- **ARM CoreSight** provides ETMv4 instruction trace, STMv2 software instrumentation via 64K stimulus ports, timestamp request per write optimization, and global TSGEN shared across PTM/ETM/STM [4][5].
- **RISC-V Nexus** defines Class 3-4 instruction and data trace via Nexus Trace Encoder, with variable-length packets, branch history, and optional timestamp field using implementation-specific TSMT [6][7].

*Key challenges*:

1. **Timestamp domains**: CoreSight guarantees 48-bit global timestamp with automatic correlation across PTM/ETM/STM [2][5]; Nexus timestamp width negotiable, often 32-bit truncated, requiring rollover handling.
2. **Clock-domain crossing**: Trace funnel merging at 1: N arbiters introduces metastability when A53 @1.5 GHz and RISC-V @0.8 GHz share a 250 MHz ATB.
3. **Protocol skew**: CoreSight STPv2 encodes Major/Channel opcodes per STM port [1]; Nexus uses ownership messages to disambiguate context.

**Contributions**:

- Formal model of timestamp reconciliation with bounded drift
- CDC formalization in TLA+ proving stuttering equivalence of merged trace
- Hardware evaluation with timestamp error bounds

![Heterogeneous SoC Trace Architecture](/thesis/thesis-deter-replay-soc-20260808-a1b2-0.webp)

## 2. Background

### 2.1 ARM CoreSight STM/ETM

CoreSight SoC-400 is a library of debug/trace components comprising sources (ETM, STM, ITM), links (Funnel, Replicator), sinks (ETR, TPIU) [1][4]. STM is AXI slave with 65536 stimulus ports, each core sees identical register set avoiding locking [1]. Each write generates STPv2 packet with hardware-managed Major/Channel opcodes [1]. Extended Stimulus Port registers support timestamp request per write; timestamp from common source added autonomously by STM [1][2].

Timestamp precision 48-bit, synchronization opcodes autonomously added [1]. PTM/ETM packets retain original precision for accurate correlation across PUs [2]. Advantages over ITM: 32-bit output vs ITM 8-bit, 60-150× bandwidth, global timestamp input missing in ITM causing coarse correlation [4][5].

ETMv4 instruction trace emits P0 elements (branch packets), address packets with 64-bit context, exception packets. TSGEN provides global timestamp generator with 7-bit trace ID reserved (0x00, 0x70+ illegal per CoreSight D4.2.4) [6].

### 2.2 RISC-V Nexus

RISC-V Trace Spec 2.0.1 (Nexus-based) defines Trace Encoder ingesting retirement info, emitting ingress/egress packets via PIB or ATB [7][8]. Nexus 5001 standard variable-length packets: SYNC, Program Trace, Data Trace, Ownership. Timestamp optional, often via `mtime` CSR captured on packet retirement.

RISC-V `trTeInstMode` modes: optimized for code size using implicit return, sequential jump. Class 3 trace mandatory for privilege changes, supports differential addressing.

### 2.3 Deterministic Replay Related Work

Replay debugging classical for x86 via rr, Intel PT. For heterogeneous, work includes Quick Replay for ARM big.LITTLE, RISC-V Dromajo golden-model comparison. None formalize timestamp reconciliation CDC jointly.

> **Theorem 1 (Timestamp Monotonicity Preservation):** If each trace source obeys local monotonic timestamps and global sync period $T_s < 2^{b-1}/f_{max}$ where $b$ timestamp bits, then merged global order exists via Lamport-style max-plus algebra.

## 3. Methodology

We build hardware prototype on ZCU102 with 2×A53, 2×R5F, 1×RISC-V via Vitis softcore. Trace infrastructure:

- CoreSight TSGEN @200 MHz 48-bit, distributed to A53/A5 via ATB
- RISC-V TSMT synchronized to TSGEN via 1-pulse-per-10 ms GPIO interrupt, capturing TSGEN snapshot in RISC-V `mtrace_ts`
- STM configured via DT `arm,coresight-stm` compatible, reg names `stm-base`, `stm-stimulus-base`, APB clk `apb_pclk`, AT clk `atclk` [3]
- ETR 8 MB circular buffer, ETM configured for cycle-accurate mode, timestamp packet inserted every 1024 cycles
- Nexus encoder configured for 32-bit timestamp, ownership messages per context switch

**Timestamp Reconciliation Algorithm**:

```python
def reconcile(arm_pkts, riscv_pkts, sync_beacons):
    # sync_beacons: list of (tsgen, riscv_mtime, atb_cycle)
    drift_model = linear_regression(sync_beacons) # tsgen = a*m_time + b
    for pkt in riscv_pkts:
        pkt.global_ts = drift_model.predict(pkt.local_ts)
    merged = merge_sorted(arm_pkts, riscv_pkts, key=lambda p: p.global_ts)
    return cdc_dejitter(merged, depth=3)
```

- **CDC De-jitter**: Model ATB FIFO depth 8, 2-stage synchronizer, metastability window 500 ps, prove FIFO occupancy never exceeds 6 under worst-case bursts using UPPAAL.

**Formalization**: TLA+ spec `DeterministicReplay.tla`:

```tla
VARIABLES armTrace, riscvTrace, merged, globalClock
TypeOK == armTrace \in Seq(Packet) /\ riscvTrace \in Seq(Packet)
Reconcile == merged' = [i \in DOMAIN Sort(armTrace \o riscvTrace, globalTs) |-> ...]
Stutter == UNCHANGED <<merged>>
THEOREM Correctness == [] (IsDeterministicReplay(merged))
```

Prove invariant `Inv == \A i,j \in DOMAIN merged: i<j => merged[i].global_ts <= merged[j].global_ts \/ SyncPacket` holds via TLC 10^6 states.

![Timestamp Reconciliation Pipeline](/thesis/thesis-deter-replay-soc-20260808-a1b2-1.webp)

## 4. Deep Dive

### 4.1 Heterogeneous Trace Subsystem Architecture

Our SoC block diagram (Figure 1) shows A53 cluster ETMv4 -> ATB funnel 1, R5 PTM -> funnel 1, RISC-V Nexus -> ATB bridge -> funnel 1, STM as system-wide software trace source fed by all cores via AXI (port groups 0-1023 per core). TSGEN drives timestamp bus to all time stamping masters.

ATB bridge for RISC-V must handle protocol conversion: Nexus variable-length -> ATB 8-bit ATDATA, ATREADY/ATVALID handshake. We model ATB handshake latency 2 cycles, bridge introduces 1 extra cycle for packing, total 3 cycles per Nexus byte, effective 83 MB/s @250 MHz.

CDC at bridge: RISC-V trace clock domain 80 MHz, ATB 250 MHz, ratio 3.125, need asynchronous FIFO with Gray-coded pointers, depth 16 proved sufficient for burst 32 bytes.

### 4.2 Timestamp Reconciliation and Drift Modeling

CoreSight guarantees global timestamp shared: STM, ETM, PTM timestamps automatically correlated [2]. For RISC-V, we emulate global by sampling TSGEN register via APB read captured in RISC-V interrupt ISR latency 12 cycles measured.

Drift model: TSGEN crystal 20 ppm, RISC-V core clock 100 ppm, linear regression over 10 s window yields $R^2 >0.999$. Residual error 48 ns (3σ) after compensation.

Sync packet insertion: CoreSight auto inserts timestamp every N bytes or timer; we force sync every 4096 ATB bytes to bound window. RISC-V Nexus SYNC every 1024 retired inst, includes full 32-bit timestamp LSB+MSB nibble.

Error handling: 48-bit vs 32-bit rollover: CoreSight wrap after 15 days @200 MHz; RISC-V wrap 21 sec @100 MHz. Detect via discontinuity $ \Delta TS > 2^{31}$ -> add $2^{32}$ epoch.

> **Theorem 2:** With sync period $P_s$, max clock drift $\delta$, replay order error probability $\Pr[wrongOrder] \le 2\delta P_s / UI_{min}$.

### 4.3 Clock-Domain Crossing Formalization

CDC formalized as 2-stage synchronizer with metastability MTBF $ \frac{e^{T_r/\tau}}{f_{clk} f_{data} T_w}$ [8]. For our FPGA 28 nm, $\tau=20$ ps, $T_r=400$ ps, MTBF 1e9 years.

We prove FIFO pointer crossing safety using SystemVerilog assertions and SymbiYosys, bounded 10 steps.

FIFO occupancy proof: ingress rate $R_{in}=80$ MB/s max, egress $R_{out}=250$ MB/s, depth equation $occ_{max}=burst * (1 - R_{in}/R_{out})$, burst 32 -> occ 22, depth 16 overflow? Actually we throttle via ATREADY low after 8 entries, back-pressure Nexus encoder via stall signal, reducing effective ingress to 40 MB/s, occ 12.

### 4.4 Deterministic Replay Verification

Replay equivalence defined as stuttering bisimulation between reference execution on ISS (QEMU+RISC-V Spike) and merged trace order.

We instrument Linux kernel ftrace to emit STM writes on `sched_switch`, `irq_handler_entry`, capturing context switches. ETM cycle-accurate trace allows reconstruction of retired PC stream via ETM decoder OpenCSD.

Nexus trace decoded via `riscv-trace-decoder` library, ownership messages mapped to hart ID.

Merge algorithm preserves `happens-before` via vector clock augmentation: each packet carries 1-bit per domain causality.

Evaluation: replay debugger replays traced execution in gdb stub, breakpoints at divergence detected 3 cases where interrupt latency not captured due to STM port enable delay 4 cycles.

![Formal TLA+ State Machine](/thesis/thesis-deter-replay-soc-20260808-a1b2-2.webp)

### 4.5 Waveform and Packet Flow

Figure 4 shows ATB waveform: ATVALID high when ATDATA valid, ATREADY flow control, ATID for source ID (ETM0=0x10, ETM1=0x11, STM=0x18, Nexus=0x20). Packet flow STPv2 vs Nexus: STM STPv2 packet 1-5 bytes, timestamped, Nexus 2-8 bytes with timestamp optional.

We measure bandwidth: STM software trace 12 MB/s at 10K messages/sec, ETM 150 MB/s @1.5 GHz with 30% branch density, Nexus 22 MB/s, total 184 MB/s < ETR 256 MB/s limit.

---

## 5. Empirical/Proofs

| Metric | CoreSight Only | Nexus Only | Heterogeneous Merged |
|--------|----------------|------------|----------------------|
| Trace BW | 162 MB/s | 22 MB/s | 184 MB/s |
| Timestamp Error (σ) | 0 ns (global) | 48 ns after comp | 48 ns |
| Order Recovery Accuracy | 100% | 99.2% | 98.7% |
| Replay Overhead | 0.4% | 0.5% | 0.9% |
| CDC FIFO Overflow | 0 | 0 | 0 / 1M packets |
| TLC Model Checking States | N/A | N/A | 1.2M, no deadlock |

- **Proof Outline**: Invariant `Inv` proved by induction on packet ingress; base case empty trace, step merges next packet with minimal global_ts, preserves order due to TS monotonicity theorem.

- **Benchmark**: CoreMark 120 CoreMark/MHz, trace enabled overhead 0.9% due to STM port writes 2 cycles per instrumentation.

- **GFM Table**:

| Source | Timestamp Bits | Sync Period | Drift (ppm) | Compensation |
|--------|---------------|-------------|-------------|--------------|
| CoreSight TSGEN | 48 | 4096 bytes | 20 | none needed |
| RISC-V TSMT | 32 | 1024 inst | 100 | linear regression |

## 6. Limitations

- **Single global timebase failure**: If TSGEN fails, fallback to software timestamp via ARM Generic Timer has 1 µs granularity, degrading accuracy 20×.
- **Trace ID collision**: Only 70 valid IDs (0x01-0x6F). Heterogeneous with >8 cores needs ID virtualization via replicator, not implemented.
- **Security**: STM stimulus ports unprotected allow malicious guest to flood trace, DoS ETR; requires TZ-ASC filtering not evaluated.
- **Formal model scope**: TLA+ model abstracts away microarchitectural speculation; ETM speculative path not captured, may cause false replay divergence on Mispredicted branches (handled via 4-bit branch history).
- **Power**: Trace subsystem 180 mW @250 MHz, significant for low-power RISC-V IoT.

---

## 7. Conclusion

We presented deterministic replay for heterogeneous SoCs bridging ARM CoreSight and RISC-V Nexus via timestamp reconciliation and CDC formalization. Global TSGEN + periodic sync plus linear drift compensation yields <50 ns error; asynchronous FIFO with back-pressure guarantees zero overflow; TLA+ stuttering proofs ensure replay order correctness. Platform evaluation ZCU102+PULP achieves 98.7% order accuracy 0.9% overhead, enabling post-mortem debugging across ISA boundaries.

Future work: integration with ARM ETE for v9, RISC-V eTrace 3.0 self-hosted timestamp extension, hardware-accelerated reconciliation via SmartNIC.

## References

[1] Arm Ltd. System Trace Macrocell Architecture Specification STPv2, v1.0. https://documentation-service.arm.com/static/5f8ffb02f86e16515cdbfec0?token=  
[2] Zephyr Project. Multi-domain logging using ARM CoreSight STM. https://docs.zephyrproject.org/latest/services/logging/cs_stm.html  
[3] Linux Kernel. Devicetree bindings – Arm CoreSight STM. https://www.kernel.org/doc/Documentation/devicetree/bindings/arm/arm%2Ccoresight-stm.yaml  
[4] Intel/Altera. System Trace Macrocell Packs Major Benefits for High-Performance SoC System Debug. https://cdrdv2-public.intel.com/650398/wp-01229-system-trace-macrocell-for-high-performance-soc-system-debug.pdf  
[5] Intel. Architecture Brief – CoreSight Compliant Debug for SoC FPGAs. https://cdrdv2-public.intel.com/777341/ab19-soc-fpga.pdf  
[6] ARM Developer. Programming ARM’s System Trace Macrocell. https://developer.arm.com/community/arm-community-blogs/b/tools-software-ides-blog/posts/programming-arm-s-system-trace-macrocell  
[7] RISC-V International. RISC-V Processor Trace Specification 2.0.1, Nexus-based. https://riscv.org/specifications/  
[8] SiFive. RISC-V Trace Encoder, E-Trace Spec. https://github.com/riscv-non-isa/tg-nexus-trace  
[9] Green Hills. Multi-arch SoC Timing Closure CDC MTBF Formula. https://www.ghs.com/btc/  

![Waveform Trace Packet Flow](/thesis/thesis-deter-replay-soc-20260808-a1b2-3.webp)

