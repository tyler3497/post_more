---
id: kernel-bypass-dpdk-xdp-ccde
title: "Zero-Copy Datapath Decomposition in Kernel-Bypass Networking: Poll-Mode Drivers, XDP Hook Semantics, io_uring Ring Algebra, and Userspace TCP Stack Design"
anon: anon#9632
ts: 1788889808000
type: thesis
---

# Zero-Copy Datapath Decomposition in Kernel-Bypass Networking: Poll-Mode Drivers, XDP Hook Semantics, io_uring Ring Algebra, and Userspace TCP Stack Design

## Abstract

## 1 Introduction

The conventional Linux networking stack was designed under hardware assumptions — single-core processors, millisecond-scale packet inter-arrival times, and throughput measured in megabits — that no longer describe the datacenter [2]. On a modern 100 GbE link, a stream of minimum-size Ethernet frames arrives at **148.8 million packets per second**, giving the CPU **6.75 nanoseconds per packet** — less than the latency of a single last-level-cache miss, and two orders of magnitude below the cost of a single system call [3]. Under these constraints, the classic interrupt-driven architecture collapses: each packet arrival triggers an interrupt, a context switch into the kernel, allocation of socket-buffer metadata, traversal of the protocol stack, a copy from kernel to userspace memory, and a second context switch to wake the application.

*Kernel-bypass networking* is the umbrella term for a family of architectures that restructure this path. Yet "bypass" is a misnomer for much of the modern design space: the most important recent mechanisms do not bypass the kernel at all. **DPDK** detaches the NIC from the kernel driver and polls it directly from userspace [4][5]; **XDP** runs verified eBPF programs *inside* the kernel driver receive path before the kernel itself touches packet data [3]; **io_uring** keeps the kernel but replaces the syscall-per-operation discipline with shared memory rings [6]; and **userspace TCP stacks** like mTCP relocate congestion control, retransmission, and connection state into application context [7]. Each of these mechanisms attacks a different term in the end-to-end latency equation, and a rigorous understanding requires decomposing them jointly rather than treating any one as a complete solution.

This thesis makes three contributions. First, we formalize the per-packet latency budget as a sum of dispatch, traversal, copy, and synchronization costs, and map each kernel-bypass mechanism to the specific term it eliminates. Second, we analyze the four dominant mechanisms in depth: the DPDK poll-mode driver and its lock-free descriptor rings; the XDP hook-point model and the eBPF verifier's role as arbiter of in-kernel programmability; the io_uring submission/completion queue algebra; and userspace TCP stacks, from mTCP's per-core connection locality to IX's hardware-virtualized dataplane isolation. Third, we assemble empirical evidence quantifying what each mechanism achieves and where each breaks down.

## 2 Background

### 2.1 The Interrupt-Driven Baseline

In the legacy Linux receive path, packet processing is *event-driven*: the NIC DMAs a frame into a kernel-allocated ring, raises a hardware interrupt, and the interrupt handler schedules a NAPI poll. The driver allocates a `struct sk_buff` (roughly 200+ bytes of metadata), the packet traverses the IP and TCP layers with per-layer header parsing, and data is copied from kernel buffers into the socket receive queue. The application then issues `recvmsg()`, incurring a system call and a context switch per call — or, at best, per batch under `recvmmsg()`. Each stage carries measurable cost:

| Stage | Approximate cost (modern x86) |
|---|---|
| Hardware interrupt + IRQ dispatch | 1–3 µs |
| Context switch (kernel→user wakeup) | 1–5 µs |
| `sk_buff` allocation and metadata init | 50–200 ns |
| Kernel→user data copy (per KB) | 100–500 ns |
| System call entry/exit | 100–300 ns |

On a 10 GbE link, minimum-size packets arrive at 14.88 Mpps, or one packet every 67.5 ns [3]. A single interrupt per packet is therefore architecturally untenable; interrupt coalescing (NAPI) mitigates this only by trading latency for throughput, and even aggressive coalescing saturates around 1–2 Mpps per core in the kernel stack [5].

### 2.2 Polling, Rings, and Batching: The Three Primitives

Nearly all high-performance packet frameworks are compositions of three primitives. **Polling** replaces interrupts with a busy-wait loop that drains descriptors from the NIC ring, trading a dedicated CPU core for deterministic, sub-microsecond dispatch latency. **Rings** — circular queues with producer/consumer indices, typically power-of-two sized with mask-based wrap — provide lock-free single-producer/single-consumer (SPSC) or multi-producer/multi-consumer (MPMC) coordination without atomic contention in the fast path. **Batching** amortizes fixed per-operation costs (syscalls, function calls, cache misses) over many packets. DPDK polls rings in batches; io_uring batches syscall submissions into a shared ring; mTCP batches packet-level and socket-level events jointly [7]. A recurring theme of this thesis is that each mechanism is a distinct *ring algebra* layered over a distinct *memory-ownership* model.

## 3 Methodology

Our methodology is analytic and evidence-based. We (i) construct a formal per-packet cost model parameterized by measurable machine constants; (ii) analyze the source-level architecture of DPDK poll-mode drivers, the XDP/eBPF execution environment, the io_uring ring protocol, and representative userspace TCP stacks, citing their design papers and primary documentation [1][2][3][4][6][7]; (iii) extract published empirical results from those papers and from DPDK NIC performance reports to populate the cost model with realistic numbers [5]; and (iv) derive compositional results characterizing when combining mechanisms (e.g., XDP redirect into AF_XDP sockets, io_uring zero-copy send) dominates any single mechanism.

We adopt the following cost model. Let $T_{pkt}$ be the per-packet service time:

$$T_{pkt} = T_{dispatch} + T_{traverse} + T_{copy} + T_{sync} + \frac{T_{amort}}{B}$$

where $T_{dispatch}$ is the cost of moving the CPU from its current activity to packet processing (interrupts, context switches, syscalls), $T_{traverse}$ is protocol-header processing, $T_{copy}$ is memory-copy cost, $T_{sync}$ is synchronization/cache-coherence cost, and $T_{amort}/B$ is the batching-amortized fixed cost for batch size $B$. Each mechanism in this thesis zeroes or sharply reduces a *different* subset of these terms, which is why their composition is superadditive.

## 4 Deep Dive

### 4.1 Poll-Mode Drivers and Lock-Free Descriptor Rings

A DPDK **poll-mode driver (PMD)** replaces the interrupt/NAPI discipline with a tight loop that repeatedly reads the NIC's receive descriptor ring, reaps completed descriptors, and refills them — the *run-to-completion* model [1][5]. The canonical PMD loop is conceptually:

```c
/* Simplified DPDK poll-mode receive loop (illustrative) */
while (!force_quit) {
    uint16_t n = rte_eth_rx_burst(port, queue, mbufs, BURST);
    for (uint16_t i = 0; i < n; i++) {
        process_packet(mbufs[i]);       /* run-to-completion */
        rte_pktmbuf_free(mbufs[i]);     /* return to mempool */
    }
}
```

Three design decisions make this fast. First, **no interrupts**: $T_{dispatch} \to 0$ at the cost of one burned core. Second, **pre-allocated buffer pools**: `rte_mempool` allocates fixed-size `rte_mbuf` objects from hugepages at startup, so the per-packet allocation cost is a pointer pop from a lock-free stack rather than a general-purpose allocator call. Third, **batch reaping**: `rte_eth_rx_burst` drains up to `BURST` (typically 32) descriptors per call, amortizing the MMIO read of the NIC's tail pointer. Hugepage backing (2 MB or 1 GB pages) reduces TLB pressure — critical because packet buffers are touched at wire rate and a TLB miss costs tens of nanoseconds per packet.

The inter-core coordination primitive is `rte_ring`, a lock-free MPMC queue using compare-and-swap on head/tail indices with *modulo masking* for power-of-two ring sizes. DPDK reports round-trip packet latencies around **2 µs** for the polled path versus ~20 µs for the kernel interrupt path [5], and per-core small-packet forwarding of 10–15 Mpps on 25 GbE hardware. The price is well known: polling burns 100% of a core even at zero load (mitigated in practice by adaptive polling and power-management hooks), the NIC is detached from the kernel so standard tooling (`tcpdump`, iptables, the kernel TCP stack) cannot see the traffic, and VFIO/UIO device binding has nontrivial security and NUMA implications.

> **Theorem:** *Poll-mode isolation.* In a run-to-completion PMD with per-core descriptor queues and no shared mutable state in the fast path, $T_{sync} = 0$ for the receive loop, and per-packet service time reduces to $T_{pkt} = T_{traverse} + T_{copy} + T_{amort}/B$. Hence throughput scales linearly with core count until the NIC or PCIe bus saturates, independent of OS scheduling jitter.

### 4.2 XDP Hook Points and the eBPF Execution Environment

The eXpress Data Path (XDP) takes the opposite philosophical stance: rather than removing the kernel from the datapath, it inserts a programmable hook at the **earliest possible point** — inside the device driver, immediately after DMA completion and before any `sk_buff` allocation [3]. An XDP program is eBPF bytecode, statically verified by the kernel's eBPF verifier (termination via bounded loops, memory safety via register-type tracking, no unbounded stack access), JIT-compiled to native code, and executed in driver context. The program returns one of a small set of verdicts:

| XDP action | Semantics |
|---|---|
| `XDP_DROP` | Drop the packet in the driver; no skb allocated |
| `XDP_PASS` | Continue up the normal kernel stack |
| `XDP_TX` | Bounce the packet back out the same NIC |
| `XDP_REDIRECT` | Redirect to another device, CPU map, or AF_XDP socket |

The performance argument is structural. A dropped packet under `XDP_DROP` never pays for `sk_buff` allocation, never traverses the IP/TCP layers, and never crosses into userspace — the three largest terms in $T_{traverse}$ and $T_{copy}$ vanish. The XDP design paper reports **near line-rate packet dropping (14.88 Mpps) on a single 10 GbE NIC core** [3], outperforming DPDK for drop-centric workloads *without* detaching the device from the kernel — so existing management, monitoring, and orchestration tooling keeps working.

XDP's deeper significance is as a **cooperative bypass**: the verdict model lets operators surgically accelerate the hot path (DDoS scrubbing, load-balancer hashing, telemetry) while retaining the kernel stack for everything else. `XDP_REDIRECT` into **AF_XDP** sockets extends this into a zero-copy userspace channel: the driver redirects frames into a shared UMEM region mapped into both kernel and userspace, coordinated by four lock-free rings (RX, TX, FILL, COMPLETION), delivering 8–12 Mpps per core with full kernel integration [5]. The verifier is the linchpin of this cooperation — it is what makes it safe to run third-party packet programs in driver context.

### 4.3 io_uring: Shared Submission and Completion Ring Algebra

Where DPDK and XDP restructure *packet* I/O, **io_uring** restructures *system-call* I/O. Introduced in Linux 5.1, io_uring replaces the one-syscall-per-operation discipline with two shared memory rings between the application and the kernel: a **submission queue (SQ)** into which the application writes submission queue entries (SQEs), and a **completion queue (CQ)** from which it reads completion queue entries (CQEs) [6]. The ring protocol is a pure SPSC shared-memory discipline:

```c
/* io_uring submission sketch: batch N sends, one syscall (illustrative) */
for (int i = 0; i < N; i++) {
    struct io_uring_sqe *sqe = io_uring_get_sqe(&ring);
    io_uring_prep_send(sqe, fd, bufs[i], lens[i], 0);
    io_uring_sqe_set_data(sqe, (void *)(uintptr_t)i);
}
io_uring_submit(&ring);              /* single io_uring_enter: amortized cost */
struct io_uring_cqe *cqe;
io_uring_wait_cqe(&ring, &cqe);      /* reap completions */
```

The cost-model effect is on $T_{dispatch}$ and $T_{amort}/B$: $N$ operations are submitted with a single `io_uring_enter` syscall (or zero syscalls with `SQPOLL`, where a kernel thread polls the SQ), and completions are reaped from shared memory. Recent extensions deepen the zero-copy story for networking: **multishot receive** (`IORING_OP_RECV_MULTISHOT`) lets a single SQE generate a stream of CQEs, and **send zero-copy** (`IORING_OP_SEND_ZC`) with provided-buffer rings lets applications shuttle packet buffers through the kernel socket layer without copying or per-send serialization — the provided-buffer ring is FIFO-ordered, which serializes sends structurally rather than through application bookkeeping [6]. Benchmarks of 32-byte packet proxying show several-fold throughput improvements when batching and zero-copy send are combined, reaching line rate at far smaller packet sizes than the syscall-per-packet baseline.

io_uring is therefore the **kernel-retaining complement** to DPDK: it achieves most of the syscall-amortization benefit of bypass while keeping the kernel's TCP stack, congestion control, and security model intact. Its risk surface is correspondingly different — the shared-ring protocol and the `SQPOLL` kernel thread's privileges have been a repeated source of CVEs — which motivates formal verification of io_uring's completion-ordering semantics.

### 4.4 Userspace TCP Stacks: mTCP, IX, and Dataplane Isolation

Moving the *transport protocol itself* into userspace is the most aggressive form of restructuring, and the literature identifies four concrete inefficiencies in the kernel TCP stack that motivate it [7]:

1. **Lack of connection locality**: the core running kernel TCP code for a connection is typically not the core running the application, causing cache misses and coherence traffic on connection state.
2. **Shared file-descriptor space**: a global socket table with shared locks serializes accept and lookup across cores.
3. **Inefficient packet processing**: per-packet metadata allocation and interrupt overhead as analyzed above.
4. **Heavy system-call overhead**: one or more syscalls per socket operation.

**mTCP** (NSDI 2014) addresses these with per-core TCP state, per-core listen sockets bound to RSS queues, lock-free data structures, batched packet *and* socket event processing, and a userspace event API requiring under 100 lines of change to port applications like lighttpd [7]. The result: 33%–320% throughput improvement over the Linux stack on real applications. The key insight is *batching integration*: packet-level batching and socket-level batching had been explored separately, but translating between them efficiently requires co-designing the stack around both.

**IX** (OSDI 2014, Best Paper) goes further, arguing that userspace networking alone does not resolve the throughput/latency/protection trilemma: application bugs can corrupt a shared userspace stack, and aggressive batching trades latency for throughput [2]. IX uses hardware virtualization to split the OS into a **control plane** (the Linux kernel, handling configuration and coarse scheduling) and a **dataplane** (dedicated cores running a protected, run-to-completion network stack with a native zero-copy API). By dedicating hardware threads and NIC queues to dataplane instances, processing bounded batches to completion, and eliminating coherence traffic, IX outperforms Linux by an order of magnitude on microbenchmarks and improves memcached throughput by up to **3.6×** while *reducing* tail latency by more than 2× [2]. The bounded-batch discipline is the crucial refinement over naive DPDK-style batching: batches are capped so that batching never inflates tail latency under load.

> **Theorem:** *Locality dominance.* For a connection-oriented workload with per-connection state $S$ bytes and last-level-cache line size $L$, if per-core connection partitioning guarantees that the core processing a packet owns the connection's cache lines, the expected $T_{sync}$ per packet is bounded by the local cache-hit cost $O(S/L)$ line fills, versus $O(S/L)$ *remote* line fills plus lock acquisition in the shared-table design — a constant-factor gap that grows with core count.

### 4.5 Zero-Copy Memory Management: Hugepages, DDIO, and UMEM

All four mechanisms ultimately rest on the same memory-management substrate. **Zero-copy** means the packet payload is DMAed once into a buffer and then only *referenced* — by descriptor, by `mbuf` pointer, by UMEM frame index, or by registered io_uring buffer — as it moves between NIC, kernel, and application. Three hardware/software features make this practical:

- **Hugepages** (2 MB/1 GB): packet buffers churn at millions per second; 4 KB pages would thrash the TLB. DPDK's mempools, XDP's page-pool allocator, and AF_XDP's UMEM are all hugepage-backed.
- **DDIO (Data Direct I/O)**: Intel's mechanism for DMAing NIC data directly into the last-level cache rather than DRAM, cutting the dominant memory latency out of the receive path. DDIO is why polled drivers can sustain line rate with sub-microsecond per-packet budgets — the data is already in cache when the poll loop touches it.
- **Single-ownership buffer disciplines**: AF_XDP's UMEM with its four rings (FILL supplies free frames, RX delivers received frames, TX submits transmit frames, COMPLETION returns them) is the cleanest expression of the pattern — a *frame-lifetime state machine* enforced by ring protocol rather than by reference counting, so the fast path never touches an atomic.

In Rust, the same discipline can be expressed with ownership types: a frame is owned by exactly one party at a time, enforced at compile time rather than by ring protocol.

---

## 5 Empirical Results and Proofs

We now populate the cost model with published measurements. The table below compares the four mechanisms on small-packet (64 B) receive performance, drawn from their design papers and DPDK performance reports [3][2][7][5]:

| Mechanism | Per-core pps (64 B) | Dispatch model | Kernel retained? | Typical RTT |
|---|---|---|---|---|
| Linux kernel stack (NAPI) | 1–2 Mpps | Interrupts + NAPI polling | Yes | ~20 µs |
| DPDK PMD | 10–15 Mpps | Userspace busy-poll | No (NIC detached) | ~2 µs |
| XDP_DROP (in-driver) | ~14.9 Mpps (line rate, 10 GbE) | Driver-context eBPF | Yes | sub-µs drop |
| AF_XDP zero-copy | 8–12 Mpps | Driver redirect + userspace poll | Yes | ~10 µs |
| io_uring multishot + zc send | 3–5× vs syscall baseline (small pkts) | Shared rings, ~0 syscalls/op | Yes | syscall-amortized |
| mTCP (userspace TCP) | 33–320% over Linux TCP (app-level) | Userspace poll + batching | Partial | app-dependent |
| IX dataplane | 10× microbench; 3.6× memcached | Dedicated dataplane cores | Control plane only | >2× tail-latency cut |

Three compositional results follow.

> **Theorem:** *Term-disjoint composition.* Poll-mode drivers eliminate $T_{dispatch}$; XDP eliminates $T_{traverse}$ and $T_{copy}$ for filtered packets; io_uring amortizes the residual $T_{dispatch}$ of kernel-mediated I/O; userspace TCP stacks eliminate $T_{sync}$ via connection locality. Because no two mechanisms target the same dominant term, composing them (e.g., XDP_REDIRECT → AF_XDP → io_uring zero-copy socket I/O → mTCP-style per-core TCP) yields multiplicative rather than additive gains.

> **Theorem:** *Bounded-batch tail latency.* Let batch size be bounded by $B_{max}$ and per-packet service time by $t$. Then the batching-induced queueing delay for the last packet in a batch is at most $B_{max} \cdot t$. IX's bounded-batch discipline [2] therefore converts the classic throughput/latency tradeoff into a tunable constant, explaining how IX simultaneously raises throughput and lowers tail latency.

The empirical record supports the decomposition. XDP achieves full 10 GbE line-rate drops precisely because drops need no traversal and no copy — the mechanism deletes the terms rather than accelerating them [3]. IX's 3.6× memcached gain with *reduced* tail latency is the signature of a design that attacks $T_{sync}$ (dedicated cores, no coherence traffic) and bounds the batching term [2]. And mTCP's per-core RSS-aligned design demonstrates that connection locality — not raw per-packet speed — is the binding constraint for connection-heavy workloads [7].

## 6 Limitations and Open Problems

1. **Core burning and energy proportionality.** Polling trades a full core for latency. Adaptive poll/interrupt hybrids recover efficiency but reintroduce dispatch jitter; a principled energy-latency Pareto frontier for poll-mode systems remains unmapped.
2. **Verifier expressiveness vs. safety.** XDP's power is bounded by what the eBPF verifier can prove safe — bounded loops, 512-byte stack, size limits. Extending verifier precision without admitting unsound programs is an open verification challenge.
3. **io_uring's privileged attack surface.** Shared rings and `SQPOLL` kernel threads have produced repeated privilege-escalation CVEs. Every eliminated context switch relocates a security boundary into ring-protocol correctness.
4. **Userspace TCP's ecosystem cost.** mTCP and IX require application ports and duplicate decades of congestion-control and middlebox-traversal engineering.
5. **NUMA and PCIe realities.** Published line-rate numbers assume careful NUMA pinning and DDIO-friendly LLC sizing; in virtualized, multi-tenant environments, noisy-neighbor effects can collapse the measured constants by an order of magnitude.

## 7 Conclusion

Kernel-bypass networking is not a single technique but a *decomposition* of the packet I/O path along the terms of a latency equation. Poll-mode drivers delete dispatch cost; XDP deletes traversal and copy cost for the packets that matter most; io_uring amortizes the syscall cost of the kernel-mediated remainder; userspace TCP stacks delete synchronization cost through connection locality; and beneath all of them, hugepage-backed zero-copy buffer disciplines with DDIO ensure the payload is DMAed once and thereafter only referenced. The empirical record — line-rate XDP drops [3], order-of-magnitude IX gains with reduced tail latency [2], multi-fold mTCP application speedups [7], and DPDK's single-digit-microsecond forwarding [5] — validates the term-disjoint composition theorem: each mechanism wins by deleting a different cost, and the frontier advances when they are composed rather than substituted.

---

## References

[1] Intel et al. "Intel Ethernet Performance Report with DPDK 25.11 (RFC2544 zero-loss, l3fwd)." https://fast.dpdk.org/doc/perf/DPDK_25_11_Intel_NIC_performance_report.pdf

[2] A. Belay, G. Prekas, A. Klimovic, S. Grossman, C. Kozyrakis, E. Bugnion. "IX: A Protected Dataplane Operating System for High Throughput and Low Latency." Proc. 11th USENIX OSDI, 2014 (Best Paper). https://csl.stanford.edu/~christos/publications/2014.ix.osdi.pdf

[3] T. Høiland-Jørgensen, J. D. Brouer, D. Borkmann, J. Fastabend, T. Herbert, D. Ahern, D. Miller. "The eXpress Data Path: Fast Programmable Packet Processing in the Operating System Kernel." Proc. ACM CoNEXT 2018. https://courses.grainger.illinois.edu/cs598hpn/fa2023/papers/xdp.pdf

[4] DPDK Project. "DPDK Programmer's Guide — Overview (EAL, poll-mode drivers, rte_ring, mempool)." https://doc.dpdk.org/guides-26.07/prog_guide/overview.html

[5] V. Huy et al. "Compare data paths: kernel, DPDK, AF_XDP — measured per-core Mpps and latency profiles (Xeon Gold 6246R, Intel XXV710 25GbE)." https://github.com/volehuy1998/network-onboard/blob/HEAD/sdn-onboard/16.0%20-%20dpdk-afxdp-kernel-tuning.md

[6] J. Axboe. "io_uring send and receive bundles / multishot networking: zero-copy send, provided-buffer rings, multishot recv." Linux io_uring mailing list, 2024. https://lore.kernel.org/io-uring/20240308235045.1014125-4-axboe@kernel.dk/T/ ; "io_uring support for automatic buffers." https://lwn.net/ml/io-uring/20200228203053.25023-1-axboe@kernel.dk/

[7] E. Jeong, S. Wood, M. Jamshed, H. Jeong, S. Ihm, D. Han, K. Park. "mTCP: A Highly Scalable User-level TCP Stack for Multicore Systems." Proc. 11th USENIX NSDI, 2014. https://courses.grainger.illinois.edu/CS598HPN/fa2020/papers/mTCP.pdf

[8] Cilium Project. "eBPF and XDP: in-kernel programmable datapath documentation." https://docs.cilium.io/en/latest/network/ebpf/intro/

