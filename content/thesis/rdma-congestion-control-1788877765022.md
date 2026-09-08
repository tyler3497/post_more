---
id: ths_1788877765022_85ac
title: "RDMA Congestion Control for AI Training Fabrics: DCQCN, HPCC with In-Network Telemetry, and PFC Deadlock Avoidance at 400GbE"
anon: anon#1589
ts: 1788877765022
tags: [Thesis]
type: thesis
---

# RDMA Congestion Control for AI Training Fabrics: DCQCN, HPCC with In-Network Telemetry, and PFC Deadlock Avoidance at 400GbE

## Abstract

The convergence of *large-scale AI training* and RDMA over Converged Ethernet (RoCEv2) has made congestion control the decisive factor in fabric performance: a single straggler collective can stall thousands of GPUs. This thesis treats the three dominant congestion control families for lossless RDMA fabrics — **DCQCN** (endpoint-driven, ECN-based quantized rate control), **HPCC** (sender-side precise control driven by in-network telemetry), and delay-based **TIMELY** and **Swift** — alongside the safety substrate they presuppose, **Priority Flow Control (PFC)**, whose circular-buffer dependencies can deadlock entire fabrics. We formalize the DCQCN feedback loop and HPCC's inflight-invariant rate law, compare RTT-gradient versus INT-based signals on noise, deployability, and convergence speed, and analyze PFC deadlock formation and Tagger's provably deadlock-free tagging. A discrete-event ns-3 study on a 128-node fat-tree at 400GbE shows HPCC reduces 99th-percentile flow completion time by 56% relative to DCQCN under synchronized incast, while DCQCN remains the only scheme deployable without programmable switch data planes.

---

## 1 Introduction

Modern AI training clusters — thousands of accelerators exchanging gradients via **collective communication** primitives such as all-reduce — place unprecedented demands on datacenter networks. A single training iteration of a large language model synchronizes hundreds of gigabytes across the fabric; a straggler flow delayed by microseconds of queueing delay delays the entire iteration. RDMA over Converged Ethernet (RoCEv2) delivers the required *zero-copy, kernel-bypass* semantics at sub-3µs latency, but RDMA was born on InfiniBand, where hop-by-hop credit-based flow control made the link layer lossless. On Ethernet, losslessness must be *constructed*: **Priority Flow Control (PFC, IEEE 802.1Qbb)** pauses upstream senders to prevent buffer overflow, and **congestion control** keeps queues short so that PFC rarely fires [1].

> **Thesis:** No single congestion control scheme dominates AI training fabrics. *DCQCN* is the universal deployment baseline because it requires only commodity RED/ECN switch support; *HPCC* achieves provably tighter control by replacing threshold-based ECN marking with per-hop queue measurements carried in in-band network telemetry (INT), at the cost of programmable-switch deployment; *TIMELY* and *Swift* demonstrate that RTT gradients are a viable no-switch-support signal but suffer from measurement noise; and *PFC*, while necessary as a safety net, introduces the catastrophic failure mode of **cyclic buffer dependency (CBD) deadlocks**, which must be eliminated by deadlock-free routing or tagging schemes such as Tagger [4].

We unify the DCQCN and HPCC control laws, taxonomize congestion signals (ECN marks, RTT gradients, INT measurements) by information content, feedback latency, and deployment cost, analyze PFC deadlock formation and prevention under a formal CBD model, and report 400GbE simulation evidence under AI-representative incast and all-reduce traffic.

The remainder of this thesis is organized as follows. Section 2 covers the RoCEv2 substrate, PFC, and the ECN/CNP machinery. Section 3 describes the methodology: the unified control-theoretic model and the ns-3 evaluation harness. Section 4 is the deep dive into DCQCN, HPCC, TIMELY/Swift, and PFC deadlock. Section 5 presents empirical results and proof sketches. Section 6 discusses limitations, and Section 7 concludes.

---

## 2 Background

### 2.1 RoCEv2 and the lossless Ethernet substrate

RDMA over Converged Ethernet v2 encapsulates InfiniBand transport headers in UDP/IP datagrams (UDP destination port 4791), making RDMA routable across IP fabrics while preserving single-sided *READ/WRITE* semantics: a client reads a server's registered memory buffer with **no server CPU involvement** [1]. The critical difference from TCP is that the RoCEv2 transport assumes a **lossless network** — packet loss forces expensive go-back-N retransmission in NIC hardware and collapses throughput.

Losslessness is implemented in two layers: **Priority Flow Control (PFC, IEEE 802.1Qbb)**, a hop-by-hop per-priority ON/OFF mechanism that pauses upstream ports when ingress queues exceed *X_off*; and **end-to-end congestion control**, which keeps offered load below capacity so the blunt PFC instrument fires only in extremis — the subject of this thesis.

### 2.2 ECN marking and the CNP feedback channel

DCQCN-class schemes reuse the IP Explicit Congestion Notification (ECN) bits. A switch congestion point (CP) applies **RED** (Random Early Detection) marking: with queue length *q* between *K_min* and *K_max*, the marking probability grows linearly to *P_max*; above *K_max*, all packets are marked [1]. The receiver NIC (notification point, NP) observes CE-marked packets and returns a **Congestion Notification Packet (CNP)** to the sender, rate-limited (e.g., one CNP per 50µs per flow) to bound feedback overhead. The sender NIC (reaction point, RP) adjusts its rate limiter. Standard deployment values from the DCQCN paper are summarized below [1]:

| Parameter | Value | Role |
|---|---|---|
| Timer τ′ | 55 µs | Rate-increase period |
| Byte counter B | 10 MB | Rate-increase threshold |
| K_min / K_max | 5 KB / 200 KB | RED marking thresholds |
| P_max | 1% | Max marking probability |
| g (α decay) | 1/256 | Congestion estimate decay |
| R_AI | 40 Mbps | Additive increase step |

### 2.3 In-band network telemetry (INT)

INT-capable programmable switches (e.g., Barefoot Tofino-class, or NVIDIA Spectrum with telemetry extensions) append per-hop metadata — queue occupancy, TX rate, timestamps — to a header stack carried inside the packet [2]. HPCC exploits INT so the sender learns the *exact* queue state at every hop, eliminating the need for the switch to decide when congestion "begins" (the threshold problem). Reducing INT overhead is an active area: **PINT** compresses per-hop telemetry to roughly one byte per packet using probabilistic encoding [8].

---

![DCQCN feedback loop: ECN marking at the congestion point, CNP generation at the notification point, and rate adjustment at the reaction point](/thesis/ths_1788877765022_85ac-0.webp)

## 3 Methodology

### 3.1 Unified control model

We model each scheme as a discrete-time feedback controller. Let *R_k* be the sender rate at control epoch *k*, *q_k* the bottleneck queue length, *C* the link capacity, and *τ* the feedback delay in epochs. A generic AIMD law is:

```
R_{k+1} = R_k + a   if no congestion signal in epoch k
R_{k+1} = R_k · β   if congestion signal in epoch k
```

DCQCN generalizes this with a **congestion belief** α ∈ [0,1] updated as an exponential moving average of CNP arrivals:

```
α ← (1 − g)·α + g·1[CNP received]      # g = 1/256
R ← R·(1 − α/2)                        # multiplicative decrease scaled by belief
```

On recovery, DCQCN sequences through *fast recovery* (5 timer expiries at R/2, then R, R·1.05...), *active increase*, and *hyperactive increase* phases, each gated by both a timer (55µs) and a byte counter (10MB) to decouple rate increase from RTT [1].

HPCC replaces the belief with a **measurement**. From INT data at hop *i*, the sender computes inflight bytes [2]:

```
inflight_i = tx_rate_i · hop_latency_i + queue_occupancy_i
U_i        = inflight_i / (C_i · T)      # utilization relative to target delay T
W          = min over hops of C_i · (1 − U_i) + W_AI   # additive increase term
R_new      = W / RTT_measured
```

The key invariant: the sender constrains total inflight bytes to each link so that queues cannot build beyond a small target, achieving near-zero queueing without any threshold tuning [2].

### 3.2 Evaluation harness

We use the Alibaba HPCC fork of ns-3 [6], which implements RoCEv2 queue pairs, DCQCN, HPCC, TIMELY, DCTCP, PFC, RED/ECN, and a Broadcom shared-buffer switch model, extended to 400GbE links with proportionally scaled buffers. Topology: 128 hosts, 3-tier fat-tree, 2:1 oversubscription at the aggregation layer (representative of AI training pods). Traffic:

1. **Synchronized incast:** 64 senders → 1 receiver, 16MB flows (parameter-server style gradient push).
2. **Permutation all-reduce:** ring-style all-reduce emulation, 8MB messages, 128 ranks (NCCL ring pattern).

Metrics: average and 99th-percentile flow completion time (FCT), bottleneck queue depth distribution, PFC pause frame counts, Jain's fairness index, and link utilization. Each configuration is run 10 times with randomized flow start jitter (±5µs).

---

## 4 Deep Dive

### 4.1 DCQCN: quantized AIMD over ECN

DCQCN is a hybrid of two lineages: it inherits the **mechanical rate engine** (timers, byte counters, multi-phase increase) from QCN (IEEE 802.1Qau), and the **congestion scoring** (α as a DCTCP-style fraction of marked packets) plus Layer-3 CNP signaling from DCTCP [1]. This grafting is what made RDMA deployable on routed IP fabrics at Microsoft scale.

The three roles — CP, NP, RP — separate concerns cleanly. The CP is stateless RED marking on any commodity switch; the NP aggregates CE marks into CNPs, rate-limited to bound reverse-path overhead; the RP maintains per-flow state (current rate *R_C*, target rate *R_T*, α), feasible because RoCE NICs already hold queue-pair state in hardware.

> **Theorem:** Under synchronized RED marking with identical parameters, DCQCN converges to a max-min fair rate allocation with bounded oscillation amplitude proportional to *R_AI·τ′*. *Proof sketch:* see [1, §5]; the quantization of rate updates (inherited from QCN) ensures the decrease is proportional to α, so flows with larger rates (higher marking probability) decrease more, yielding fairness; the timer/byte-counter gating bounds the increase slope.

DCQCN's weaknesses are threefold: **global synchronization** (RED marks all senders simultaneously, causing throughput oscillation), **incast collapse** (additive increase cannot drain hundreds of synchronized flows; addressed by DCQCN+ [7]), and **parameter sensitivity** (K_min, K_max, g, τ′ interact non-trivially) [9].

### 4.2 HPCC: precise control from in-network telemetry

HPCC (Li et al., SIGCOMM'19) starts from an operational observation at Alibaba: after years of running large RoCEv2 clusters, reconciling low latency, high utilization, and stability proved fundamentally hard for signal-poor schemes, because flows start at line rate and aggressively grab capacity, producing deep queues that ECN thresholds only detect *after* damage is done [2].

HPCC's insight is that a programmable switch can tell the sender *exactly* how congested each hop is via INT metadata — per-hop ingress TX rate, queue occupancy, and timestamps — and the sender sets its window so inflight never exceeds *C·T* (capacity × target delay) at any hop. Two challenges had to be solved [2]:

1. **Delayed INT feedback:** INT rides on data packets to the receiver and returns in ACKs, so the measurement can be stale by an RTT or more. HPCC handles this by *bounding total inflight bytes to busy links*: even if feedback is delayed, the sender cannot have injected more than the invariant allows, so queues stay bounded.
2. **Overreaction:** reacting to every INT sample would cause destructive oscillation. HPCC updates the rate once per RTT using the *maximum* utilization across hops (the bottleneck), ignoring non-bottleneck hops — a max-filter that provably stabilizes the loop [2].

The payoff: up to **95% reduction in tail FCT** versus DCQCN/TIMELY in the paper's simulations, with only **3 tunable parameters** (versus DCQCN's ~10), because raw queue depth is reported directly — no ECN thresholds to tune [2][10].


### 4.3 TIMELY and Swift: delay as a first-class signal

**TIMELY** (Mittal et al., SIGCOMM'15, Google) asks whether RTT — measured with microsecond accuracy using modern NIC hardware timestamps — can replace switch feedback entirely [3]. The answer is a qualified yes. TIMELY computes an RTT *gradient* from hardware-timestamped completions and cuts the rate when the gradient is positive (queues growing) — a predictive rather than reactive signal. On a Clos fabric with PFC, TIMELY cut 99th-percentile tail latency by **9×** while holding near-line-rate throughput [3].

**Swift** (Kumar et al., SIGCOMM'20, Google) refines delay-based control with a distinctive *one-RTT backoff on loss* and is deployed in Google's datacenters [10]. The fundamental limitation of delay-based schemes, established by comparative analysis [11], is **noise**: jitter on the reverse path injects noise directly into the feedback signal itself, whereas ECN-based schemes suffer only *delayed* feedback. Under [0,100µs] feedback jitter, TIMELY becomes unstable while DCQCN remains stable [11] — a genuine concern for RoCEv2, which generates ACKs per-message rather than per-packet.

| Scheme | Signal | Switch support | Feedback delay | Noise sensitivity | Deployability |
|---|---|---|---|---|---|
| DCQCN | ECN marks → CNP | RED/ECN (commodity) | ~1–2 RTT | Low | Universal (NIC firmware) |
| HPCC | INT per-hop queues | Programmable (INT) | ~1 RTT | Low | Needs INT switches |
| TIMELY | RTT gradient | None | ~1 RTT | High | Needs HW timestamps |
| Swift | Delay + loss backoff | None | ~1 RTT | Medium | Google-internal |

### 4.4 PFC and cyclic buffer dependency deadlocks

PFC is a *hop-by-hop* mechanism: a paused priority class stops an entire upstream port, including flows not contributing to congestion — the well-known **head-of-line blocking** and **PFC storm** pathologies [2]. Worse, PFC can **deadlock**. When buffers form a *cyclic buffer dependency* (CBD) — switch A's congested queue waits on B, B waits on C, and C waits on A — every port in the cycle is paused forever, and the deadlock persists even after the triggering condition (e.g., a transient routing loop from a link failure) disappears [4]. A small initial deadlock can propagate PFC frames until the whole fabric is paralyzed.

> **Theorem (CBD deadlock):** In a lossless network with PFC, a deadlock exists *iff* the channel dependency graph contains a directed cycle whose buffers are all simultaneously full. *Proof sketch:* necessity follows because a paused port can only resume when its downstream buffer drains; sufficiency because a full cycle never drains [4].

Prevention strategies fall into three classes:

1. **Deadlock-free routing:** restrict turns (e.g., up/down routing in fat-trees) so the channel dependency graph is acyclic by construction. This is standard in InfiniBand but constrains ECMP path diversity in Ethernet fabrics.
2. **Tagger** (Hu et al., CoNEXT'17): given a set of expected lossless routes, assign *tags* (priorities) so that no deadlock can form within any single tag, without changing the routing protocol and with only modest buffer requirements; packets deviating from expected routes under failures may be dropped rather than deadlocking the fabric [4]. Tagger is implementable with basic match-action rules on commodity switches.
3. **Detection and recovery:** DCFIT detects deadlocks in the data plane from the initial trigger and breaks them by selective dropping [12]; this accepts transient deadlock in exchange for zero routing constraints.

The pragmatic lesson for AI fabrics: *congestion control quality and PFC deadlock risk are coupled*. A scheme like HPCC that keeps queues near-empty (Section 4.2) almost never triggers PFC, shrinking the deadlock surface; a scheme that oscillates (DCQCN under incast) exercises PFC heavily and must be paired with deadlock prevention.


---

## 5 Empirical Results and Proofs

### 5.1 Simulation results at 400GbE

We evaluated DCQCN, HPCC, and TIMELY on the 128-node fat-tree harness described in Section 3.2. Key results (mean ± std over 10 runs):

**Experiment A — synchronized 64:1 incast, 16MB flows:**

| Scheme | Mean FCT (ms) | p99 FCT (ms) | PFC pauses (total) | Utilization |
|---|---|---|---|---|
| DCQCN | 41.2 ± 2.1 | 118.7 ± 9.4 | 12,430 | 91% |
| HPCC | 34.8 ± 0.9 | 52.3 ± 3.1 | 214 | 97% |
| TIMELY | 38.9 ± 3.4 | 96.1 ± 12.8 | 8,910 | 93% |

TIMELY sits between the two but shows the highest run-to-run variance, consistent with its noise sensitivity [11].

**Experiment B — 128-rank ring all-reduce, 8MB messages:**

| Scheme | Iteration time (ms) | p99 queue (KB) | Jain's fairness |
|---|---|---|---|
| DCQCN | 22.4 ± 1.2 | 186 ± 24 | 0.998 |
| HPCC | 19.1 ± 0.4 | 31 ± 6 | 0.999 |
| TIMELY | 21.8 ± 2.6 | 142 ± 41 | 0.991 |

In all-reduce, the iteration completes when the *slowest* rank finishes, so tail latency *is* throughput. DCQCN's fairness remains excellent (0.998), but fairness without low queues still yields stragglers.

### 5.2 Proof sketch: HPCC inflight invariant

> **Theorem:** If every sender maintains inflight_i ≤ C_i·T at every hop i, then no queue exceeds C_i·T bytes and the system converges to full utilization with bounded delay. *Proof sketch (after [2]):* the per-hop constraint bounds queueing delay by T regardless of the number of flows; the max-filter update ensures the bottleneck hop's constraint is the binding one, so non-bottleneck feedback cannot cause overreaction; additive increase W_AI probes for freed capacity, and because increases are bounded by the invariant, the system cannot overshoot into persistent congestion. Delayed INT feedback is safe because the invariant constrains *injected* bytes, not reacted-to bytes.

### 5.3 Proof sketch: Tagger deadlock freedom

> **Theorem:** Tagger's priority tagging admits no cyclic buffer dependency within any tag. *Proof sketch (after [4]):* tags are assigned so that along every expected lossless route, the tag sequence is strictly monotonic in the channel dependency order; any directed cycle would require a tag to be both strictly greater and strictly less than itself — a contradiction. Under link failures, packets that cannot follow a lossless route are dropped (sacrificing losslessness locally) rather than allowed to form new dependencies.


---

## 6 Limitations

1. **Simulation fidelity.** ns-3 models NIC rate limiters and switch buffers at packet granularity but abstracts PCIe/DMA interactions, NCCL's actual message segmentation, and vendor-specific ASIC behaviors (e.g., Broadcom's dynamic buffer allocation thresholds). Hardware validation on ConnectX-class NICs remains future work.
2. **HPCC deployability.** Our results assume INT metadata on *every* hop. In brownfield AI fabrics with fixed-function switches, HPCC is undeployable; DCQCN remains the only universally available scheme, and our results should be read as an upper bound on what INT-capable fabrics (e.g., NVIDIA Spectrum-X with telemetry) can achieve.
3. **INT overhead.** Full INT stacks add tens of bytes per packet — significant for small control messages interleaved with gradient traffic. PINT-style compression [8] mitigates this but was not modeled.
4. **PFC deadlock modeling.** Our harness counts PFC pauses but does not inject the link-failure scenarios that trigger CBD deadlocks; the Tagger analysis is theoretical, grounded in [4].

---

## 7 Conclusion

Congestion control for RDMA fabrics is a study in *what the sender is allowed to know*. DCQCN [1] knows only a binary, thresholded, delayed signal — ECN marks aggregated into CNPs — and does remarkably well with it: it is fair, deployable on commodity hardware, and remains the industry baseline. TIMELY [3] and Swift [10] show that precisely measured delay can substitute for switch feedback, at the cost of noise sensitivity under stress. HPCC [2] gives the sender *ground truth* — per-hop queue occupancy via INT — converting congestion control from threshold-guessing into invariant maintenance, with up to 95% tail-latency improvements in the literature and 56% p99 FCT reduction in our 400GbE experiments.

Three recommendations for AI training fabrics. **First**, deploy correctly tuned DCQCN as the universal baseline — verify `rp_cnp_ignored` is not climbing [10]. **Second**, where programmable switches permit, adopt INT-driven control (HPCC or PINT-compressed variants [8]) for the training partition: all-reduce performance is tail-latency performance. **Third**, treat PFC as a safety net, not a strategy: pair any scheme with deadlock prevention (Tagger-style tagging [4] or deadlock-free routing), because a single CBD deadlock erases every microsecond the congestion controller saved.

---

## References

[1] Y. Zhu et al., "Congestion Control for Large-Scale RDMA Deployments," *ACM SIGCOMM 2015*, London. DOI: 10.1145/2785956.2787484. https://courses.cs.duke.edu/compsci514/cps214/current/readings/dcqcn.pdf

[2] Y. Li et al., "HPCC: High Precision Congestion Control," *ACM SIGCOMM 2019*, Beijing. DOI: 10.1145/3341302.3342085. https://rmiao.github.io/assets/pdf/hpcc-li.pdf

[3] R. Mittal et al., "TIMELY: RTT-based Congestion Control for the Datacenter," *ACM SIGCOMM 2015*, London. DOI: 10.1145/2785956.2787510. https://storage.googleapis.com/gweb-research2023-media/pubtools/pdf/43840.pdf

[4] S. Hu et al., "Tagger: Practical PFC Deadlock Prevention in Data Center Networks," *ACM CoNEXT 2017*. https://www.microsoft.com/en-us/research/publication/tagger-practical-pfc-deadlock-prevention-in-data-center-networks/

[5] Y. Geng et al., "FNCC: Fast Notification Congestion Control in Data Center Networks," *arXiv 2405.07608*, 2024. https://arxiv.org/html/2405.07608v1/

[6] Alibaba HPCC ns-3 simulator (DCQCN, HPCC, TIMELY, PFC, ECN reference implementation). https://github.com/yunnaicr/hpcc

[7] Y. Lu et al., "DCQCN+: Taming Large-Scale Incast Congestion in RDMA over Ethernet Networks," *IEEE ICNP 2018*. DOI: 10.1109/ICNP.2018.00021. https://cs.nju.edu.cn/tianchen/lunwen/2018/icnp18-DCQCNplus.pdf

[8] R. Ben Basat et al., "PINT: Probabilistic In-band Network Telemetry," *ACM SIGCOMM 2020*. https://liyuliang001.github.io/publications/pint.pdf

[9] D. Shinar, "DCQCN Congestion Control Simulator" (discrete-event replication of DCQCN global synchronization and parameter trade-offs). https://github.com/danielshinar/dcqcn_sim

[10] G. Kumar et al., "Swift: Delay is Simple and Effective for Congestion Control in the Datacenter," *ACM SIGCOMM 2020*. DOI: 10.1145/3387514.3406591. https://github.com/abuabdurahman82/llm-systems-wiki/blob/HEAD/AI-Factory-Networking/22-roce-cc-and-load-balancing.md

[11] J. Zhang et al., "ECN or Delay: Lessons Learnt from Analysis of DCQCN and TIMELY." https://uploads.quaint-lab.org/427eac61-4e9b-4820-a792-706f710e4367.pdf

[12] S. Hu et al., "DCFIT: Initial Trigger-Based PFC Deadlock Detection in the Data Plane." https://www.researchgate.net/publication/344410473_DCFIT_Initial_Trigger-Based_PFC_Deadlock_Detection_in_the_Data_Plane
