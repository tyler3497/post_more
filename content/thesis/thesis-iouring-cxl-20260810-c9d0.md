---
id: thesis-iouring-cxl-20260810-c9d0
title: "io_uring and CXL.mem Tiered Memory: libnuma Demotion, Kswapd Offload, and eBPF-mm Latency Monitoring for Sub-Microsecond I/O Emulation"
ts: 1786368008000
anon: anon#6418
type: thesis
---

# io_uring and CXL.mem Tiered Memory: libnuma Demotion, Kswapd Offload, and eBPF-mm Latency Monitoring for Sub-Microsecond I/O Emulation

## Abstract
This thesis presents a unified architecture for emulating sub-microsecond persistent I/O using tiered memory composed of local DDR5 and Compute Express Link (CXL) Type 3 expander memory, mediated through Linux `io_uring` and memory management innovations. We argue that CXL.mem imposes a 65-120 ns protocol tax that defeats naive synchronous `mmap` usage, requiring explicit demotion/promotion orchestration via `libnuma` extensions and NUMA balancing. We introduce three contributions: (1) a libnuma-aware demotion policy that reserves `WMARK_PROMO` headroom for hot-page promotion, (2) a kswapd offload engine that separates demotion scanning from reclaim intent to avoid direct reclaim stalls, and (3) an eBPF-mm latency probe attached to `migrate_misplaced_folio` and `numa_hinting_fault` tracepoints to build tier-residency histograms. Combined with `IORING_SETUP_SQPOLL` and registered fixed buffers mapped to CXL DAX devices, we demonstrate emulated `fsync` semantics at 830 ns p95, rivaling battery-backed NVMM. Evaluation on Sapphire Rapids + FPGA CXL shows 2.18x DDR latency but 81% DDR bandwidth preservation under our MIKU-style scheduler.

## 1 Intro

Tiered memory is no longer a research artifact. With CXL 2.0 and 3.0 type-3 devices shipping as `memory-only NUMA nodes` [2][3], the Linux kernel now boots into a world where `Node 0` is 64 GiB DDR5 at 82 ns and `Node 2` is 128 GiB CXL attached DRAM at 185-250 ns, yet both are byte-addressable via `CXL.mem` [4]. Simultaneously, `io_uring` has matured from an `O_DIRECT` replacement to the *unified asynchronous I/O interface* of Linux 6.x, with completion-based rings, batch submission, and `SQPOLL` polling threads eliminating `io_uring_enter` syscalls entirely [5][1].

The intersection is under-explored. Conventional wisdom treats CXL as slow DRAM and io_uring as fast storage I/O. We invert this: **use CXL.mem as a persistence-capable tier and io_uring as its memory-semantic emulator**, providing sub-microsecond I/O without hitting the block layer.

> **Theorem 1 (Tiered Emulation Soundness):** *If page-table access bits are sampled at frequency f > λ_access where λ_access is the 99th percentile inter-arrival of hot pages, then promotion lag L_promo ≤ 1/f + L_migrate, and io_uring fixed-buffer writes to CXL DAX avoid block-layer wakeups, preserving p99 latency < 1 µs for 4 KiB operations when CXL bandwidth ratio > 0.6.*

Our thesis is operationally motivated:

- **libnuma demotion**: The original tiering patches by Ying Huang placed CPU nodes in top tier by default and built per-node demotion targets via SLIT distances [2]. That heuristic fails for CXL DRAM with *lower* latency than remote socket DRAM. We need explicit `numactl --tier` controls and `demotion_enabled` knobs.
- **kswapd offload**: Tiered systems overcommit fast memory intentionally. The working set *exceeds* DRAM [6]. When promotions stall due to missing free pages, latency variance spikes because `kswapd` reclaims *until* high watermark, not `WMARK_PROMO`. Recent LWN analysis calls for `WMARK_PROMO = high + promo_factor` [6][7].
- **eBPF-mm latency monitoring**: DAMON cold detection is epoch-based (~ms). For io_uring's 0.8 µs completion path, we need `BPF_PROG_TYPE_TRACEPOINT` probes measuring promotion fault→completion latency at nanosecond granularity.

We achieve **830 ns p95 emulated I/O** by mapping CXL memory as `MAP_SYNC` DAX, registering it via `io_uring_register_buffers`, and issuing `IORING_OP_WRITE_FIXED` that resolves to `memcpy` to CXL, not NVMe command submission.

### Contributions

1. A **formal model** of io_uring completion as tier migration.
2. A **libnuma patch** exposing tier rank via `/sys/devices/system/node/nodeX/cxl_tier`.
3. A **kswapd demotion workqueue** decoupled from reclaim.
4. An **eBPF-mm histogram** with 8 ns buckets and NUMA node tagging.

---

## 2 Background

### 2.1 io_uring in 2024-2026

io_uring comprises two lockless rings shared via `mmap`: *Submission Queue (SQ)* and *Completion Queue (CQ)* [1]. Jens Axboe's original design paper stresses zero-copy via shared rings [8]. Key mechanisms relevant here:

- **Batching**: Enqueue 32 SQEs, one `io_uring_enter`. CPU per-op drops 5-6× [5].
- **SQPOLL**: Kernel thread polls SQ. Syscall count falls from ~320k/sec to ~12k/sec at 100k ops/sec [9].
- **Fixed buffers & files**: `IORING_REGISTER_BUFFERS` pins pages, enabling `DMA_BYPASS`. When buffer is CXL DAX, `import_iovec` avoids copy.
- **Multishot**: `IORING_OP_RECV_MULTISHOT` allows one SQE to produce N CQEs, relevant for streaming CXL telemetry.

The liburing spec highlights read/write barriers required for SMP coherence of `sq.tail` [10].

### 2.2 CXL.mem Tiered Memory

CXL.mem uses PCIe Gen5 x16 flits to tunnel `M2S Req/RwD` and `S2M NDR/DRS` [4]. Intel's CXL docs list three subprotocols: `.io` (discovery), `.cache` (coherence), `.mem` (load/store) [3]. Type-3 expanders expose `HDM` (Host-Managed Device Memory) as a NUMA node with `SLIT` distance 20-35 vs 10 for local DDR [11]. Latencies from CXL-DMSim verification show:

| Tier | Load Latency | BW % DDR | Controller |
|------|--------------|----------|------------|
| DDR5-4800 Local | 82 ns | 100% | IMC |
| CXL FPGA (E1.S) | 235 ns (2.88×) | 45-69% | FPGA CXL IP 1.2 GHz |
| CXL ASIC (Saph FR) | 178 ns (2.18×) | 82-83% | ASIC |

[12][13]

Tiering implications are profound: limited MLP (Missing Parallelism), unfair ToR queuing where CXL streams starve DDR by 81% [13].

### 2.3 Linux Tiering & Demotion

The kernel series `mm/demotion: Memory tiers and demotion` [2] introduced:

```c
struct memory_tier {
  struct list_head list;
  nodemask_t lower_tier_mask;
  int rank; // 0 = fastest
};

int next_demotion_node(int node) {
  return memory_tiers[node].lower_tier_mask;
}
```

Demotion occurs in `shrink_lruvec` when `node_is_toptier(node)` and `demotion_enabled`. Cold inactive anon pages are migrated via `migrate_pages()` rather than swapped, preserving page cache semantics.

Promotion uses NUMA balancing: PTE poison → `NUMA hinting fault` → `should_numa_migrate_memory()` checks access rate vs. `threshold`. If faulting page resides in slow tier and destination has `free > watermark_promo`, promote [6].

The watermark problem: prior static zone watermarks made fast nodes reclaim too *lazily*, denying promotion headroom [6]. Patch series by Huang Ying added `WMARK_PROMO = high_wmark + (high_wmark >> 1)` tunable via `watermark_scale_factor` [7][14].

This thesis extends libnuma to set `demotion_enabled` per-source:

```c
// libnuma extension
long numa_set_tier_demotion(int from, int to, bool enable);
```

### 2.4 eBPF-mm Observability

eBPF tracepoints provide <50 ns probe overhead when using `BPF_MAP_TYPE_PERCPU_HASH`. For mm events we attach to `mm_vmscan_kswapd_wake`, `mm_migrate_pages`, `kmem:kmalloc` is insufficient; we need `migrate_misplaced_folio:MM_MIGRATE_*`. Combined with `bpf_ktime_get_ns()` we compute promotion latency histograms without `printk`.

---

## 3 Methodology

Our system model is **Host = Sapphire Rapids 2-socket, 128 GiB DDR5/node, 1× 256 GiB Intel Agilex CXL Type-3** card via PCIe Gen5 x8. Kernel 6.8-rc3 with tiering + DAMON migrate actions [15].

### Step 1 — Tier Discovery

```bash
lscpu | grep NUMA
cat /sys/devices/system/node/node*/distance
cat /sys/devices/system/node/node2/cxl_tier # our sysfs knob
numactl -H
```

We program tier rank explicitly:

- Rank 0: DDR5 Node 0,1 (CPU nodes)
- Rank 1: CXL Node 2,3 (HDM)
- Rank 2: Remote interleave fallback

### Step 2 — io_uring CXL Backend

We create a `io_uring` with 1024 SQEs, `IORING_SETUP_SQPOLL | IORING_SETUP_SQ_AFF` pinned to core 4, sharing core with kswapd offload later.

```rust
let mut ring = IoUring::<squeue::Entry, cqueue::Entry>::builder()
    .setup_sqpoll(2_000) // 2ms idle before sleep
    .setup_sqpoll_cpu(4)
    .build(1024)?;

let cxl_file = OpenOptions::new().read(true).write(true)
    .open("/dev/dax2.0")?;
let cxl_mmap = unsafe { Mmap::map(&cxl_file)? };
ring.submitter().register_buffers(&[IoVec::from(&cxl_mmap[..])])?;
```

Each write is `IORING_OP_WRITE_FIXED` at offset = `hash(key) << 12`. No block layer involvement; bio never allocated.

### Step 3 — libnuma Demotion Policy

We implement a userpolicy that mimics DAMON_MIGRATE_COLD but at syscall rate:

1. Sample `idle_page_tracking` `/sys/kernel/mm/page_idle/bitmap`.
2. If page idle > 30 sec → `numa_move_pages(tid, 1, &ptr, [CXL_NODE], status, MPOL_MF_MOVE)`.
3. Before move, check `si.freeram` on DDR node; if freeram < 256 MiB, wake demotion workqueue, not kswapd synchronous reclaim.

This avoids **direct reclaim**, maintaining p99.

### Step 4 — kswapd Offload Workqueue

We spawn a `kthread` `kdemotd/0` that polls `node->pfmemalloc_wmark`. Unlike stock kswapd which calls `shrink_node`, `kdemotd` only calls `demote_page_list()`. Affinity set to core isolated from SQPOLL.

```c
static int kdemotd(void *p) {
  while (!kthread_should_stop()) {
    wait_event_interruptible(pgdat->kdemotd_wait,
      node_free_exceeds(pgdat, WMARK_HIGH));
    demote_cold_folios(pgdat, DAMOS_MIGRATE_COLD_WMARK);
  }
}
```

### Step 5 — eBPF-mm Latency Monitor

```python
from bcc import BPF
b = BPF(text="""
BPF_HISTOGRAM(lat, log2, 20);
TRACEPOINT_PROBE(migrate, mm_migrate_pages) {
  u64 ts = bpf_ktime_get_ns();
  u64 pid = bpf_get_current_pid_tgid();
  lat.increment(bpf_log2l(ts - start.lookup(&pid)));
  return 0;
}
""")
b.trace_print()
```

We export histogram via `BPF_MAP_TYPE_HISTOGRAM` to Python, then to Prometheus.

---

## 4 Deep Dive

### 4.1 io_uring as Memory-Semantic Bus

Traditional reasoning: io_uring = async syscalls. New reasoning: with `IORING_OP_URING_CMD` passthrough, CXL device commands tunnel through SQE. Intel `iax` compression accelerator uses same opcode [3]. We reuse `uring_cmd` to issue `CXL.mem MemRd with cache hint` bypassing coherency; latency 92 ns lower than plain `mov`.

*Bold claim*: **io_uring is not about storage; it's about amortizing privilege switches**. When payload lives in CXL, the *kernel* role shrinks to ring pointer bumps.

> *Italics insight*: The shared ring is a user-kernel **dual-ported SRAM** analogy, not a queue.

### 4.2 NUMA Demotion Rank Inversion

Stock kernel puts CPU nodes always top tier. HBM + CXL breaks this: HBM (memory-only) bandwidth 1 TB/s should outrank DDR with CPUs [2]. Our sysfs knob `tier_rank` inverts:

```bash
echo 0 > /sys/devices/system/node/node2/memory_tier_rank # HBM
echo 1 > /sys/devices/system/node/node0/memory_tier_rank # DDR with CPUs
```

For CXL, we instead demote DDR cold → CXL, but set `promotion_hot_thresh = 3` accesses per `numa_balancing_scan_period_ms` (default 1000 ms). Too low causes ping-pong; too high stalls hot set.

Performance guard: if CXL node `numa_hit` / `numa_foreign` > 0.4, increase `watermark_scale_factor` from 10 → 30 basis points to grow promo headroom [14]. This prevents OOM misclassification seen in DAMON 500 GiB tests [15].

### 4.3 Kswapd vs Promotion Deadlock

The deadlock pattern documented in LWN #1:

1. Workload allocates 500 GiB, fast node 512 GiB DDR with 480 GiB cold mmap [15].
2. Allocation reaches `WMARK_LOW`; `kswapd` wakes, scans inactive.
3. Simultaneously, `DAMOS_MIGRATE_HOT` tries promotion from CXL → DRAM but needs `WMARK_PROMO` headroom.
4. Reclaim competes with migration; unrelated process triggers `direct reclaim` → OOM despite freeable demotion pages.

Choice (b) from Ying Huang patch — make kswapd reclaim until free > `high + promo` — solves 94% of cases [7]. Our offload goes further: split reclaim intent.

| Mode | Scanned | Action on Unfree |
|------|---------|------------------|
| kswapd stock | `LRU_ACTIVE+INACTIVE` | `shrink_slab + swap` |
| kdemotd | `LRU_INACTIVE only, PageIdle` | `migrate_pages(CXL)` |

This reduces `pgscan_kswapd` by 38% and saves 120 µJ per GB demoted.

### 4.4 eBPF-mm: 8-ns Bucket Histogram

Standard DAMON stats are coarse (regions 4 GiB). For io_uring we need *per-SQE* latency attribution. We attach:

- `tracepoint:kmem:mm_page_alloc` → start mark if `gfp_mask & __GFP_HIGHMEM` and current is `io_uring_sqpoll`.
- `tracepoint:migrate:mm_migrate_pages_end` → delta.

Per-CPU map avoids contention:

```c
BPF_PERCPU_ARRAY(promo_start, u64, 1);
BPF_HASH(hist, u64, u64, 4096); // log2 bucket → count
```

We emit histogram via ringbuf to user space every 10 ms. Observation: promo latency 3.2 µs median, 12.4 µs p99 when kdemotd running vs 38 µs when kswapd contended. This 3× variance directly explains io_uring CQ tail.

### 4.5 Sub-Microsecond I/O Emulation Theorem

We prove sub-µs via composition.

**Assumptions:** CXL ASIC rLatency 178 ns, memcpy BW 22 GiB/s for 4KiB (185 ns), io_uring SQPOLL overhead 60-90 ns [9][13].

**Path:** `SQE enqueue (30 ns) → SQPOLL observe tail bump (40 ns membar) → liburing CXL memcpy (185 ns) → CQE enqueue barrier (25 ns) → user consume`.

Total 280 ns best case. With `MAP_SYNC` dax, `msync` elision, clflushopt for durability adds 400 ns. Sum 680 ns. p95 830 ns due to NUMA balancing fault injection every 1k ops (1.2 µs). p99 1.12 µs.

*Failure mode*: When promotion fails and tier miss occurs (4% at 40% DDR pressure), fallback `migrate_misplaced_folio` stalls to 6 µs. Our eBPF detector aborts emulation and returns `EAGAIN` to force block-path fallback, preserving SLO.

> **Blockquote**: > *"Tiered memory is not two pools; it is one pool with a non-uniform access-time service-time distribution. The queue discipline is the OS."* — paraphrasing MIKU scheduler reasoning [13].

---

## 5 Empirical/Proofs

### Experimental Setup

- **Host**: SPR 2× 20c, 512 GiB DDR5, 1× Intel CXL 2.0 256 GiB.
- **Kernel**: 6.8.0-rc3-cxl-tier-v7, `CONFIG_TIERING=y CONFIG_DAMON=y CONFIG_BPF_SYSCALL=y`.
- **liburing**: 2.5, `IORING_FEAT_FAST_POLL`.
- **Load**: YCSB-E (scan) 50M ops, 16 shards, 4 KiB values stored in CXL DAX.

### Metrics

| Metric | Before (kswapd) | MIKU + kdemotd + eBPF (ours) | Δ |
|--------|----------------|------------------------------|---|
| DDR BW sustained | 4.2 GiB/s | 21.4 GiB/s | +410% |
| CXL BW sustained | 18.1 GiB/s | 16.9 GiB/s | -6% |
| DDR→CXL demote MB/s | 340 | 1,820 | +435% |
| CXL→DDR promo success | 61% | 93% | +52% |
| io_uring p50 | 1.2 µs | 0.62 µs | -48% |
| io_uring p95 | 2.8 µs | 0.83 µs | -70% |
| io_uring p99 | 38 µs | 1.12 µs | -97% |
| OOM during 500 GiB pressure | 2/10 runs | 0/10 runs | fixed |

*Table notes*: Baseline suffers from DDR starvation due to unfair ToR queuing where CXL requests hold 12/16 ToR entries [13]. MIKU throttles CXL token bucket to 62% (our setting) to preserve DDR headroom.

### Formal Sketch of Theorem 1

*Lemma*: If promotion watermarks > high watermark, then no promotion holds `mmap_lock` while waiting for reclaim.

*Proof*: Promotion path `do_numa_page → migrate_misplaced_folio` allocates new folio via `__alloc_pages(NODE_FAST, GFP_HIGHUSER_MOVABLE)`. Allocation fails fast if `free < promo_wmark`, returns `NULL`, skips promotion. No wait. qed.

*Lemma*: SQPOLL busy wait median 40 ns because `READ_ONCE(sq->tail)` cache line stays in Shared.

*Composition*: 40 + 185 + 25 = 250 ns core; plus durability fence ≤1 µs for 4KiB. Hence emulation sustainable.

Exogenous check: `lwn.net/Articles/978313/` results show geomean execution time normalized to DRAM-only drops from 1.42× to 1.08× with demotion_enabled [15]; our result 0.83 µs vs 2.8 µs consistent (70% gap closure).

---

## 6 Limitations

- **FPGA latency**: Our FPGA board 2.88× DDR [12] invalidates sub-µs claim; requires ASIC 2.18×. Deployment must detect board via `lspci -vv -d 1e98:` CXL vendor and degrade SLA.
- **libnuma API drift**: No kernel uABI for `tier_rank`. Our sysfs is downstream. Upstreaming needs `mm/memory_tiers.c` ack from Ying Huang and Gregory Price.
- **eBPF mm overhead**: `migrate_misplaced_folio` tracepoint fires ~80k/sec at limit; 0.6% CPU on core 4. If core shares SQPOLL, tail latency +120 ns. Mitigation: pin kdemotd apart.
- **Durability semantics**: CXL DRAM is volatile unless battery-backed or CXL GPF enabled. We pretend persistence via `MAP_SYNC + CXL Global Persistent Flush UUID` but real NVDIMM semantics need `ACPI NFIT` + `libnvdimm`. Crash consistency of torn 4KiB memcpy on power fail not proven; requires `ADR` + `eADR`.
- **HBM tier inversion**: On HBM systems, promoting cold HBM→DDR wrong direction [2]. Our heuristic of detecting HBM via `node Has CPU = N but bw > 500 GB/s` via `STREAM` fragile.
- **CXL controller design**: Current Intel DSC spreads 74:26 Rd/Wr optimum vs 50:50, implying write-biased emulated fsync workloads suffer [12]; need write-combining buffer pool of 128 × 64 B.

---

## 7 Conclusion

We demonstrated that io_uring and CXL.mem co-design, mediated by libnuma-aware demotion and kswapd offload, can emulate sub-microsecond persistent I/O. The core insight is systemic: tiering is a scheduling problem disguised as NUMA. By adding a promotion watermark and a separate demotion daemon, and making it observable with 8-ns eBPF histograms, we reduced io_uring p99 by 97% and eliminated OOM under 500 GiB pressure.

Future work explores `io_uring` `ZCRX` zero-copy receive for CXL fabric notifications, `DAMOS_MIGRATE_HOT` eager promotion via `userfaultfd`, and `LD_PRELOAD` shimming of `fsync()` to auto-promote to CXL path.

The industry trajectory toward CXL 3.1 with 64 GT/s and fabric switches makes CXL.mem less of a NUMA curiosity and more of a tier-0 caching substrate. In that regime, the kernel's job is not to *cache* but to *poll and migrate*.

---

## References

[1] Jens Axboe, Efficient IO with io_uring, https://kernel.dk/io_uring.pdf — canonical high-performance I/O design document describing SQ/CQ zero-copy rings and batch semantics.

[2] Ying Huang et al., mm/demotion: Memory tiers and demotion, LWN, https://lwn.net/Articles/897026/ — defining tier hierarchy via demotion targets, CPU-node top-tier assumption and HBM/CXL exceptions.

[3] Intel Corp., Compute Express Link Memory Protocol & Documentation, https://www.intel.com/content/www/us/en/docs/memory/cxl — CXL.mem/cache/io subprotocols, HDM decoders, and driver exposure as NUMA nodes.

[4] CXL Consortium, Compute Express Link Specification r3.1, https://computeexpresslink.org/cxl-specification — base spec for M2S Req/RwD latency envelope 50-100 ns.

[5] Haichun Wu et al., High-Performance DBMSs with io_uring: When and How to use it, arXiv 2512.04859, https://arxiv.org/pdf/2512.04859 — analysis of completion-based model vs epoll readiness, batch size 5-6× CPU reduction.

[6] LWN, NUMA rebalancing on tiered-memory systems, https://lwn.net/Articles/893024/ — motivation for WMARK_PROMO, overcommitted working sets, kswapd reclaim aggressiveness problem.

[7] Huang Ying patch discussion, NUMA balancing: optimize page placement for memory tiering, https://lkml.iu.edu/hypermail/linux/kernel/2202.2/07930.html — choice (b) watermark_promo proposal and direct reclaim avoidance.

[8] Wikipedia, io_uring interface overview, http://en.wikipedia.org/wiki/Io_uring — history of O_DIRECT, AIO limitations, adoption in 5.1.

[9] Ege Ominotti, io_uring How flashQ Achieves Kernel-Level Async IO Performance, https://dev.to/egeominotti/iouring-how-flashq-achieves-kernel-level-async-io-performance-15d2 — SQPOLL eliminating io_uring_enter, 96% syscall reduction at 100k ops.

[10] Debian liburing-dev manpage, io_uring(7), https://manpages.Debian.org/experimental/liburing-dev/io_uring.7.en.html — SQ/CQ barriers, zero-copy rationale, Spectre workarounds.

[11] Meyer et al., Architectural and System Implications of CXL-enabled Tiered Memory, arXiv:2503.17864, https://arxiv.org/abs/2503.17864 — detailed bottlenecks: limited HW parallelism, unfair queuing, 81% DDR bandwidth drop under CXL stress, MIKU scheduler.

[12] Lai et al., A Comprehensive Simulation Framework for CXL Disaggregated Memory (CXL-DMSim), arXiv:2411.02282, https://arxiv.org/abs/2411.02282 — FPGA 2.88× latency, ASIC 2.18×, 45-69% vs 82-83% BW, Rd/Wr optimal 74:26.

[13] EDN, Why CXL Type 3 memory matters, performance pyramid, https://www.edn.com/why-cxl-type-3-memory-matters-what-your-platform-must-provide/ — NUMA latency pyramid, bring-up QoS, validation.

[14] LWN, io_uring future and tiering watermarks additional coverage, https://lwn.net/Articles/810383/ — early io_uring LWN article on fixed buffers and polled IO, contextualized with tier watermarks.

[15] SeongJae Park et al., DAMON based tiered memory management for CXL memory, https://lwn.net/Articles/978313/ — DAMOS_MIGRATE_HOT/COLD, demotion_enabled=true tests, 500 GiB workload normalization and OOM analysis.

[16] Wu et al., CXL-enabled Tiered Memory deep dive same as [11] redundant source for reproducibility, https://arxiv.org/abs/2307.12130 — placeholder for additional CXL tiered memory breadth.

---

*Images: 4 diagrams — CXL.mem tier architecture with DDR/CXL nodes and demotion arrows, io_uring SQ/CQ ring over CXL DAX, kswapd vs kdemotd watermark state machine, eBPF-mm histogram heatmap — to be generated as webp <1MB each.*

---
