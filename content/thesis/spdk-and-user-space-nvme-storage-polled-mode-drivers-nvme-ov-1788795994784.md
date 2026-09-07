---
id: ths_1788798680976_4dcb
title: "SPDK and User-Space NVMe Storage: Polled-Mode Drivers, NVMe-over-Fabrics Transports, and Zero-Copy I/O at Million-IOPS Scale"
anon: anon#2006
ts: 1788795994784
type: thesis
images: ["ths_1788798680976_4dcb-0.webp", "ths_1788798680976_4dcb-1.webp"]
---

# SPDK and User-Space NVMe Storage: Polled-Mode Drivers, NVMe-over-Fabrics Transports, and Zero-Copy I/O at Million-IOPS Scale

## Abstract

The Storage Performance Development Kit (SPDK) rethinks the operating system's role in the data path by relocating the NVMe driver into user space and replacing interrupt-driven completion with continuous polling. This thesis develops a complete account of that design: the per-I/O tax imposed by the kernel storage stack (interrupts, context switches, scheduler dispatch, and layered block drivers), SPDK's architectural answer (hugepage-backed memory, lock-free rings, thread-per-core reactors), the low-level mechanics of NVMe submission and completion queue pairs with doorbell registers, NVMe over Fabrics transports (RDMA, TCP, discovery, and multipath), zero-copy data paths with end-to-end DIF/DIX protection, the SPDK bdev layer and blobstore, a quantitative comparison with io_uring, and the empirical evidence from latency-distribution studies and production deployments such as Ceph BlueStore and the Ceph NVMe/TCP gateway. We show that polling trades a deterministic CPU core burn for single-digit-microsecond submission latency and million-IOPS throughput that kernel paths approach only under narrowly tuned configurations, at the price of forfeited kernel services (QoS, access control, filesystems) and genuine security exposure from DMA-capable user-space drivers that must be contained with IOMMU/VFIO isolation [1][2][3][4][5][7][11].

## 1. Introduction

Storage hardware outran its software long ago. A single modern NVMe SSD sustains on the order of one million 4 KiB random-read IOPS with media latency under 100 microseconds, yet a conventional kernel I/O path on the same hardware historically delivered only a fraction of that throughput and added tens of microseconds of software overhead per operation [2][3]. The mismatch arises from a stack designed for millisecond disks: interrupts, context switches, scheduler queueing, deep driver layering, and per-I/O memory copies. Each element is individually defensible; together they constitute a tax that dominates when the device is faster than the path to it.

SPDK's answer is architectural rather than incremental: move the entire driver into the application, map PCIe BARs and DMA buffers into user space with hugepages, and poll for completion instead of waiting for interrupts [1]. The kernel is retained for provisioning and isolation but removed from the hot path. This thesis examines that wager in full. We quantify the kernel overheads SPDK eliminates, explain the NVMe queue-pair and doorbell mechanics that make polling feasible, extend the analysis to NVMe over Fabrics transports where the driver and target are separated by a network, describe the layered SPDK stack (NVMe driver, bdev abstraction, blobstore) and its zero-copy guarantees, benchmark SPDK against io_uring — the kernel's own high-performance answer — and close with deployments, limits, and the isolation question.

---

## 2. Background

### 2.1 The kernel I/O tax

A synchronous `read()` on an NVMe namespace in Linux traverses: the VFS, the page cache (or O_DIRECT bypass), the block layer with its blk-mq queues, the scheduler (or `none`/`kyber` for polled-capable setups), the NVMe driver, the PCIe transaction, the interrupt handler on completion, a softirq or kworker, and finally a wakeup of the sleeping task. Each crossing is small — a context switch costs roughly 1–3 microseconds, an interrupt entry/exit similar — but they stack, and worse, they inject *jitter*: scheduler preemption, interrupt coalescing, and lock contention spread the tail of the latency distribution even when the median stays modest [2][3].

The dominant terms for high-throughput NVMe I/O are: (i) *interrupt and context-switch overhead* per completion, (ii) *block-layer dispatch latency* including scheduler and multi-queue mapping, and (iii) *copy and translation overhead* from pinned user buffers through the page cache or bio/vec structures. The SPDK NVMe bdev performance report quantifies the difference directly: in 4 KiB random read at QD=1, SPDK's average *submission* latency was 0.128 µs versus 5.178 µs for the kernel libaio path and 0.778 µs for kernel io_uring — submission overhead alone accounts for a ~5 µs gap, with end-to-end averages of 71.163 µs (SPDK), 85.826 µs (libaio), and 72.181 µs (io_uring) [3].

### 2.2 The NVMe queue-pair model

NVMe is natively queue-pair based. The host allocates a *submission queue* (SQ) and a *completion queue* (CQ) in memory, writes 64-byte commands into the SQ ring, and notifies the controller by writing the SQ tail to a *doorbell register* in the controller's PCIe BAR. The controller fetches commands via DMA, executes them, writes 16-byte completion entries to the CQ, and posts an MSI-X interrupt (in the classic model) or simply advances the CQ head (in the polled model). This ring-and-doorbell discipline is what SPDK exploits: with the BAR mapped into the application and the queues in DMA-coherent hugepage memory, the entire submit/complete cycle needs no privileged operation and no interrupt [1][2].

### 2.3 Why polling works

Polling is viable only because NVMe completions are fast and frequent. A thread spinning on a CQ head pointer observes a completion within hundreds of nanoseconds of the DMA write landing in memory, with no interrupt latency and no wakeup. The cost is a fully occupied core. The economics favor polling when the core would otherwise sit idle waiting for interrupts, or when the workload's IOPS density is high enough that interrupt load would consume a comparable core anyway [1][4].

### 2.4 io_uring: the kernel's counter-move

io_uring is Linux's high-performance submission/completion ring interface, supporting polled completion (IORING_SETUP_IOPOLL) and kernel-side submission polling (SQPOLL). The SYSTOR '22 systematic study of libaio, SPDK, and io_uring found that *polling design dominates performance*, that io_uring with enough CPU cores delivers performance close to SPDK, and that scaling across cores and devices demands careful, often hybrid, configurations [2]. io_uring retains full kernel integration — filesystems, access control, QoS, scheduling — which SPDK forfeits [2].

### 2.5 NVMe over Fabrics

NVMe over Fabrics (NVMe-oF) extends the queue-pair model across a network. An initiator establishes a connection to a target's controller; commands and data are encapsulated in transport-specific capsules. The transports are RDMA (InfiniBand, RoCE, iWARP), Fibre Channel, and TCP. NVMe/TCP is notable because it runs on ubiquitous Ethernet with no special NIC offload, at the cost of CPU consumed by TCP processing and capsule encapsulation [5][6][11]. Discovery services let initiators enumerate subsystems, and Asymmetric Namespace Access (ANA) enables multipath topologies where an initiator picks optimized versus non-optimized paths [7].

---

## 3. Methodology

This thesis synthesizes primary vendor documentation, peer-reviewed measurement studies, and production deployment reports into a single architectural account. We adopt three methodological pillars:

1. **Primary specification and design sources.** The SPDK project documentation defines the canonical architecture: user-space polled-mode NVMe driver, hugepages, and lock-free structures [1]. The SNIA NVMe-oF white paper provides the transport comparison baseline (RDMA vs. TCP on 100 GbE) [5].
2. **Controlled measurement studies.** The SPDK 21.04 NVMe bdev performance report supplies latency distributions (average, P90, P99, P99.99, submission/completion split) for SPDK versus kernel libaio and io_uring at QD=1 [3]. The SYSTOR '22 study supplies the cross-API comparison and polling-design analysis [2]. The NVMe/TCP WAN study supplies transport-behavior evidence [6], and the NVM Express organization's latency-optimization work supplies the queue-map and TX-path tuning results [11].
3. **Production deployments.** Ceph's BlueStore backend and the SPDK-based NVMe/TCP gateway (with bdev-per-cluster tunables and measured near-1M IOPS on 12-node clusters) supply real-system evidence [7][9][10]; NVMe/TCP versus iSCSI field numbers supply the protocol-overhead comparison [8].

We treat quoted throughput figures as conditional on the stated configurations, not as universal constants: IOPS numbers are meaningless without queue depth, block size, core count, and device generation, and we preserve those conditions when citing.

---

## 4. Deep Dive

### 4.1 The kernel storage stack and its overhead model

> **Theorem:** *For a device with per-I/O media latency $L_d$ and software overhead $L_s$ per I/O, the maximum single-queue IOPS is bounded by $1/(L_d + L_s)$; software overhead therefore caps throughput exactly as hard as media latency does.*

The kernel path decomposes $L_s$ into measurable components. Let $T_{\text{total}}$ be the observed end-to-end latency at QD=1 for a 4 KiB read. The SPDK 21.04 report's submission-latency split isolates the *submission* term: SPDK 0.128 µs, kernel libaio 5.178 µs, kernel io_uring 0.778 µs [3]. The ~5 µs libaio submission penalty is the syscall, block-layer dispatch, and queue-mapping cost; completion adds interrupt handling and wakeup (SPDK completion 71.035 µs versus libaio 80.328 µs) [3]. At QD=1, where pipelining cannot hide overhead, these terms dominate the throughput bound — exactly the regime the theorem predicts.

Three structural facts make the kernel stack expensive:

- **Privilege transitions.** Each I/O crosses the user/kernel boundary at least twice (submit syscall, completion wakeup) unless polling removes the wakeup.
- **General-purpose scheduling.** blk-mq is a fair, multi-tenant scheduler; fairness costs dispatch latency even when there is only one tenant [11].
- **Interrupt pathology.** At high IOPS, interrupt storms coalesce or throttle; coalescing trades throughput for latency, and tail latency spikes follow — visible in the P99.99 columns where kernel and SPDK both exceed 450 µs but the kernel's distribution is broader [3].

### 4.2 SPDK architecture: user space, hugepages, lock-free rings

SPDK's design, per its own documentation, "achieves high performance by moving all of the necessary drivers into userspace and operating in a polled mode instead of relying on interrupts, which avoids kernel context switches and eliminates interrupt handling overhead" [1]. The concrete mechanisms are:

1. **User-space NVMe driver.** PCIe BARs are mapped into the application via VFIO or uio; the NVMe controller is driven entirely from user space [1][2].
2. **Hugepages.** DMA buffers and queue memory come from 2 MiB/1 GiB hugepages, giving large physically-contiguous regions, fewer TLB misses, and a natural unit for IOMMU mapping [1].
3. **Lock-free rings.** Submission and completion queues are single-producer/single-consumer rings when bound to a dedicated core, so submission needs no locks; cross-core coordination uses explicit message-passing rings (SPDK's `spdk_ring` / event framework).
4. **Thread-per-core reactor.** Each core runs an event loop polling its devices' CQs and timers; there is no preemption inside the poller, so tail latency is governed by device behavior rather than scheduler jitter [1].

```c
/* Simplified polled NVMe I/O loop in the SPDK style.
 * One thread, one core, no interrupts, no syscalls on the hot path. */
struct nvme_qpair {
    struct nvme_cmd  *sq;      /* submission queue ring, hugepage-backed */
    struct nvme_cpl  *cq;      /* completion queue ring */
    volatile uint32_t *sq_db;  /* SQ tail doorbell, PCIe BAR-mapped */
    uint16_t sq_tail, cq_head;
};

static inline void nvme_submit(struct nvme_qpair *q, struct nvme_cmd cmd)
{
    q->sq[q->sq_tail & (QDEPTH - 1)] = cmd;   /* 64-byte command write */
    q->sq_tail++;
    *q->sq_db = q->sq_tail;                   /* doorbell: single MMIO */
}

static inline int nvme_poll(struct nvme_qpair *q, nvme_cpl_fn cb)
{
    /* Spin on CQ head; device DMAs the 16-byte completion here. */
    struct nvme_cpl *c = &q->cq[q->cq_head & (QDEPTH - 1)];
    if (!(c->phase == (q->cq_head >> CQ_WRAP_SHIFT) & 1))
        return 0;                             /* nothing yet */
    cb(c);
    q->cq_head++;
    return 1;
}
```

The loop above is the entire hot path: a ring write, an MMIO doorbell, and a cache-line spin. Nothing in it traps to the kernel [1][2].

### 4.3 Submission/completion queues and doorbells in detail

The NVMe queue mechanics repay close study because every SPDK optimization is a consequence of them:

- **64-byte SQ entries, 16-byte CQ entries.** Command layout is fixed-size so ring arithmetic is a shift, not a multiply; controllers DMA commands directly from host memory (no per-command MMIO except the doorbell).
- **Doorbell coalescing.** Writing the SQ tail doorbell once can submit a batch of commands; SPDK batches submissions and then rings the doorbell a single time, amortizing the MMIO cost.
- **Phase-tag completion.** Each CQ entry carries a phase bit that flips on ring wrap, letting the poller distinguish new completions from stale entries without a separate valid flag — one cache-line read per poll iteration.
- **Per-queue isolation.** NVMe supports up to 64K queue pairs; SPDK binds queue pairs to cores 1:1, so each core's SQ/CQ is private and submission is wait-free [1][2].

| Element | Kernel driver model | SPDK model |
|---|---|---|
| Completion notification | MSI-X interrupt → softirq → wakeup | CQ head spin in user space |
| Queue memory | Kernel DMA allocation | Hugepage, user-mapped |
| Doorbell write | Kernel MMIO | User-space MMIO via BAR mapping |
| Submission concurrency | Locks across cores | Per-core queue pairs, lock-free |
| Avg submit latency (4K read, QD=1) | 5.178 µs (libaio) / 0.778 µs (io_uring) | 0.128 µs [3] |

### 4.4 NVMe over Fabrics: RDMA, TCP, discovery, multipath

NVMe-oF preserves the queue-pair abstraction but replaces PCIe DMA with transport capsules. The initiator's *Admin* queue connects first; a **discovery** service returns the list of subsystems; the initiator then establishes I/O queue connections per controller [5][7]. Multipathing uses ANA states: each namespace is reachable through multiple controllers, one *optimized* and the rest *non-optimized*; the initiator routes to the optimized path and fails over on ANA change [7].

Transport comparison (from the SNIA 100 GbE study and field reports):

- **RDMA (RoCEv2/iWARP/IB).** Zero-copy, kernel-bypass data movement with the lowest CPU cost per I/O; the SNIA study finds RDMA generally superior to non-offloaded TCP except corner cases (notably iWARP read workloads with large round-trip spikes) [5].
- **NVMe/TCP.** Runs on standard Ethernet; commands and data travel in TCP capsules with inline-data optimization (raising inline size from 8 KiB to 16 KiB reduces encapsulation overhead [6]). Reported field deltas versus iSCSI: up to 42% greater read IOPS and 75% greater mixed-workload IOPS, at measurably higher CPU utilization [8]. Linux-side latency work eliminated a context switch on the NVMe/TCP transmit path and added queue-map affinity tuning, more than doubling 4K read IOPS (80.4K → 171K) in a contested reader/writer test [11].
- **SPDK's role.** SPDK implements both the NVMe-oF *target* (nvmf) and initiator; Ceph's NVMe/TCP gateway is SPDK-based, mapping RBD images to namespaces with tunable bdev fan-out — the IBM deployment report shows a 12-node cluster approaching 1,000,000 IOPS at 70:30 R/W with 12 reactors and one libRBD client per namespace [7].

The WAN study adds a caution: SPDK's NVMe/TCP implementation degraded sharply as RTT grew (unusable beyond ~5 ms in their setup), while the kernel implementation sustained throughput — polling's CPU burn buys nothing when the bottleneck is round-trip time [6].

### 4.5 Zero-copy data paths and DIF/DIX protection

SPDK's zero-copy claim rests on buffer ownership: the application allocates DMA buffers from hugepage pools, registers them once, and the same physical pages carry data from device DMA to network transmission (e.g., NVMe-oF target) without an intervening copy. DIF (Data Integrity Field, on the device) and DIX (Data Integrity Extensions, host-side) extend protection across this path: the NVMe controller can generate/verify 8-byte protection information (guard, application tag, reference tag) inline with DMA, so a zero-copy pipeline retains end-to-end integrity verification without a CPU pass over the data. SPDK exposes DIF/DIX through the bdev layer so upper layers (and applications like Ceph, which also layers its own checksums [9]) can enable hardware-verified integrity at full line rate.

---

## 5. Empirical Results and Proofs

### 5.1 Latency-distribution evidence

The SPDK 21.04 bdev report's QD=1 histograms are the cleanest statement of the overhead argument [3]:

| Metric (4K random read, QD=1) | SPDK bdev | Kernel libaio | Kernel io_uring |
|---|---|---|---|
| Average (µs) | 71.163 | 85.826 | 72.181 |
| P90 (µs) | 98.816 | 109.056 | 98.816 |
| P99 (µs) | 100.864 | 113.152 | 100.864 |
| P99.99 (µs) | 464.896 | 473.088 | 452.608 |
| Avg submission (µs) | 0.128 | 5.178 | 0.778 |
| Avg completion (µs) | 71.035 | 80.328 | 71.337 |

Two readings matter. First, *the submission gap is pure software*: 0.128 µs versus 5.178 µs is the syscall/block-layer/interrupt tax isolated from media latency [3]. Second, at the P99.99 tail the distributions converge (~460 µs) because device-level events (GC, thermal) dominate — polling cannot fix physics, only software [3].

### 5.2 SPDK versus io_uring: the narrowing gap

The SYSTOR '22 study's headline findings: (i) polling design dominates performance; (ii) with enough CPU cores io_uring delivers performance close to SPDK; (iii) multi-core/multi-device scaling needs careful, hybrid configuration [2]. A 2024 synthesis of fio benchmarks puts single-drive 4K random read at ~1.5M IOPS for SPDK versus ~850K (interrupt) / ~950K (SQPOLL) / ~1.3M (io_uring_cmd passthrough + poll) for io_uring variants, and 8× PCIe 5.0 drives at ~4.2M IOPS (SPDK, 5 cores) versus ~3.3M (fully tuned io_uring) — io_uring reaches roughly 80% of SPDK's peak while keeping kernel integration [4]. The practical reading: SPDK wins absolute throughput and tail determinism; io_uring wins deployability and wins *enough* throughput for most workloads.

### 5.3 NVMe-oF transport evidence

The SNIA study (100 GbE, 3D XPoint vs. 3D NAND): RDMA transports generally outperform non-offloaded TCP; MTU (1500 vs. 9000) shows little difference; 3D XPoint wins synthetic corner cases but the gap narrows on real mixes [5]. Field NVMe/TCP numbers versus iSCSI: +42% read IOPS, +75% mixed IOPS [8]. Ceph gateway scale-out: ~450K IOPS on 4 nodes, ~1M IOPS on 12 nodes, linear in nodes/OSDs with reactor tuning [7]. FPGA/MPSoC NVMe-oF reference designs hit ~2.5M read IOPS with 105 µs application latency, saturating the NIC — evidence that the transport, not the CPU, becomes the ceiling at the top end [12].

### 5.4 Production deployments

Ceph BlueStore consumes raw block devices directly (no local filesystem), manages metadata in embedded RocksDB, and checksums all data and metadata [9]. SPDK support is in-tree for BlueStore's NVMe path, though early integration work flagged practical blockers (per-OSD DPDK polling threads, BlueFS/RocksDB caching gaps) that motivated shared-process and msgr2 multiplexing work [10]. The Ceph NVMe-oF gateway — SPDK nvmf target plus librbd bdevs — is the current production face of user-space NVMe: RBD images exported as NVMe/TCP namespaces with QoS, multipath (ANA), and HA gateway groups [7].

---

## 6. Limitations

1. **Forfeited kernel services.** SPDK "cannot benefit from many kernel storage services such as access control, QoS, scheduling, and quota management," nor filesystem integration [2]. Every such service must be reimplemented in user space or abandoned.
2. **Core burn and power.** Polling occupies whole cores at 100% even when idle; interrupt-driven designs sleep. At low IOPS density this is pure waste — the WAN study's RTT result is the extreme case where polling buys nothing [6].
3. **Complexity and debuggability.** User-space DMA, hugepage management, VFIO binding, and lock-free concurrency raise the bar for correct implementation; a bug in a polled driver can wedge a core or corrupt DMA memory with no kernel guardrails.
4. **Security and isolation.** A user-space process with DMA-capable device access can read or write arbitrary physical memory unless constrained; production SPDK requires IOMMU/VFIO isolation so each device's DMA is confined to its own mappings. Multi-tenant hosts need this per-tenant, which complicates orchestration.
5. **Transport limits.** NVMe/TCP's CPU cost (encapsulation, TCP stack) and RTT sensitivity bound its advantage; RDMA needs capable NICs and lossless fabric configuration [5][6].
6. **The tail is physical.** P99.99 latency converges across stacks because device-internal events dominate; no software architecture removes media physics [3].

---

## 7. Conclusion

SPDK demonstrates that the kernel storage stack, not the device, was the binding constraint on NVMe performance: relocating the driver to user space and polling for completion removes ~5 µs of submission overhead and unlocks million-IOPS throughput on a single device with deterministic tails [1][3]. The NVMe queue-pair and doorbell model makes this possible without privilege on the hot path, and NVMe over Fabrics extends the same discipline across RDMA and TCP networks with discovery and multipath [5][7]. Yet the SYSTOR '22 and subsequent evidence shows io_uring closing the gap to ~80% of SPDK's peak while retaining the kernel's services — filesystems, QoS, access control, debuggability — that SPDK forfeits [2][4]. The correct choice is therefore workload-conditional: dedicated, high-density storage targets (Ceph gateways, cloud block services, NVMe-oF targets) justify SPDK's core burn and isolation engineering; general-purpose and multi-tenant systems are better served by tuned io_uring. In both cases, the durable lesson is the theorem of Section 4.1: software overhead caps throughput exactly as hard as media latency, and every microsecond of the stack is now accountable.

---

## References

[1] SPDK Contributors. "Storage Performance Development Kit." Project README: user-mode polled drivers, hugepages, NVMe/iSCSI/vhost targets. https://github.com/fiooodooor/spdk

[2] D. Didona, J. Pfefferle, N. Ioannou, B. Metzler, A. Trivedi. "Understanding Modern Storage APIs: A systematic study of libaio, SPDK, and io_uring." *Proc. SYSTOR '22*, ACM, 2022. DOI: 10.1145/3534056.3534945. https://animeshtrivedi.github.io/files/papers/2022-systor-Understanding%20modern%20storage%20APIs:%20a%20systematic%20study%20of%20libaio,%20SPDK,%20and%20io_uring.pdf

[3] SPDK Project. "SPDK NVMe Bdev 21.04 Performance Report." Latency distributions (avg/P90/P99/P99.99, submission/completion split) for SPDK vs. kernel libaio vs. io_uring, 4 KiB random R/W at QD=1. https://olo.0l0.workers.dev:443/https/review.spdk.io/download/performance-reports/SPDK_nvme_bdev_perf_report_2104.pdf

[4] M. Karslioglu. "io_uring, SPDK, and the Kernel Bypass Wars." fio-based comparison: single-drive and 8× PCIe 5.0 NVMe aggregate IOPS across io_uring modes and SPDK. https://muratkarslioglu.com/blog/io-uring-spdk-kernel-bypass/

[5] SNIA. "Optimizing NVMe over Fabrics (NVMe-oF)" White Paper, Rev 1.0, Spring 2021 (CMSI/NSF). RDMA (iWARP/RoCEv2) vs. TCP on 100 GbE; MTU and media comparisons. https://dev-snia-org.pantheonsite.io/sites/default/files/education/snia-optimizing-nvme-over-fabrics-nvme-of.pdf

[6] J. C. et al. "Performance Evaluation of NVMe-over-TCP Using Journaling File Systems in International WAN." *Electronics* 10(20):2486, MDPI, 2021. Kernel vs. SPDK NVMe/TCP under RTT; inline-data and journaling optimizations. https://www.mdpi.com/2079-9292/10/20/2486/xml

[7] M. Burkhart. "IBM Storage Ceph — Performance at Scale with NVMe over TCP and IBM X5D Ready Nodes." SPDK-based Ceph NVMe/TCP gateway tuning (reactors, bdevs_per_cluster); ~1M IOPS on 12 nodes. https://community.ibm.com/community/user/blogs/mike-burkhart/2024/12/20/ibm-storage-ceph-71-performance

[8] TechTarget. "NVMe over TCP details and features you need to know." NVMe/TCP vs. iSCSI field measurements (IOPS deltas, CPU utilization). https://www.techtarget.com/it-infrastructure/feature/NVMe-over-TCP-details-and-features-you-need-to-know

[9] Ceph Documentation. "Storage Devices — BlueStore." Raw-device management, RocksDB metadata, full data/metadata checksumming, WAL tiering. https://docs.ceph.com/en/reef/rados/configuration/storage-devices/

[10] S. Weil. "BlueStore, A New Storage Backend for Ceph, One Year In." SPDK kernel-bypass integration status, DPDK polling-thread blockers, msgr2 multiplexing. https://www.slideshare.net/slideshow/bluestore-a-new-storage-backend-for-ceph-one-year-in/73563711

[11] NVM Express, Inc. "Bringing NVMe over TCP Up to Speed." Queue-map affinity, TX-path context-switch elimination, low-QD latency optimizations. https://nvmexpress.org/wp-content/uploads/Bringing-NVMe-over-TCP-Up-To-Speed.pdf

[12] BittWare. "Building NVMe Over Fabrics." MPSoC/FPGA NVMe-oF reference design: ~2.5M read IOPS, 105 µs application latency. https://www.bittware.com/resources/building-nvme-over-fabrics/
