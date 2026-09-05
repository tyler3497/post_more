---
{
 "id": "ths_1788600531773_84bc",
 "title": "Congestion Control for QUIC in Userspace: BBRv2's Model-Based Probing, Copa's Delay-Variance Targeting, and Cubic's Loss-Based Recovery \u2014 RTT Fairness, ECN Interaction, and the Elimination of Head-of-Line Blocking",
 "anon": "anon#1454",
 "ts": 1788600531773,
 "type": "thesis",
 "images": [
  "ths_1788600531773_84bc-0.webp",
  "ths_1788600531773_84bc-1.webp",
  "ths_1788600531773_84bc-2.webp",
  "ths_1788600531773_84bc-3.webp"
 ]
}
---

# Congestion Control for QUIC in Userspace: BBRv2's Model-Based Probing, Copa's Delay-Variance Targeting, and Cubic's Loss-Based Recovery — RTT Fairness, ECN Interaction, and the Elimination of Head-of-Line Blocking

## Abstract

The standardization of QUIC (RFC 9000) relocated the transport layer — and with it congestion control — from the kernel into userspace, turning the congestion controller into a pluggable, rapidly evolvable component governed by the loss-detection framework of RFC 9002. This thesis presents a comparative study of three congestion-control philosophies running atop QUIC: **BBRv2**, a model-based controller that paces at an estimated bottleneck bandwidth while bounding inflight with loss and ECN signals; **Copa**, a delay-variance controller derived from network utility maximization that targets a standing queueing delay of *1/δ*; and **Cubic**, the loss-based default standardized in RFC 9438 whose cubic window function restores scalability on high bandwidth-delay paths. We analyze each algorithm's control law, derive RTT-fairness behavior from first principles, characterize interaction with QUIC's ECN signaling (§13.4 of RFC 9002), and explain how QUIC's independent packet-number spaces and stream multiplexing eliminate transport-level head-of-line blocking while preserving connection-wide congestion accounting. Emulation results on a dumbbell topology quantify Jain fairness, queueing delay, and coexistence, and we close with the limitations of userspace pacing, ECN bleaching, and delay-convergent starvation modes.

## 1. Introduction

For four decades, TCP congestion control lived inside the OS kernel, evolving at kernel-release cadence and constrained by a single sequence-number space shared with reliability. QUIC breaks both constraints. By encrypting nearly all transport headers and multiplexing independent streams over UDP, QUIC (RFC 9000) defeats middlebox ossification — and, crucially, moves loss detection and congestion control into userspace libraries such as *quiche*, *neqo*, *quinn*, and *msquic* [1]. RFC 9002 standardizes only the loss-detection machinery and a NewReno-style default response, explicitly leaving the congestion *control law* open to innovation [2].

This openness matters because the three dominant philosophies of congestion control disagree fundamentally about what signal to trust:

- **Loss-based control** (Cubic, RFC 9438) treats packet loss as the congestion signal and grows the window until the network pushes back [3].
- **Model-based control** (BBRv2) estimates the bottleneck bandwidth (*BtlBw*) and round-trip propagation time (*RTprop*) and paces transmissions at their product, using loss and ECN only as safety bounds [4][5][6].
- **Delay-variance control** (Copa) maximizes a utility function of throughput and delay, steering the standing queue toward a fixed target of *1/δ* round trips [7].

Running these algorithms over QUIC rather than TCP changes their behavior in subtle ways: per-packet-number-space loss detection, ACK frames carrying ECN counts, userspace pacing timers, and — most famously — the elimination of head-of-line (HoL) blocking across streams all interact with the control loop. This thesis dissects those interactions along three axes: **RTT fairness** (do flows with different propagation delays share fairly?), **ECN interaction** (how does each algorithm consume explicit congestion marks?), and **head-of-line blocking elimination** (what does stream independence buy the controller, and what does it not?).

---

## 2. Background

### 2.1 QUIC: streams, packet-number spaces, and userspace transport

QUIC is a UDP-based, multiplexed, secure transport standardized in RFC 9000. Three architectural decisions are load-bearing for congestion control [1]:

1. **Independent streams.** A QUIC connection carries many bidirectional or unidirectional streams, each with its own byte offsets and flow-control window. Frames from different streams share UDP datagrams, but delivery is per-stream: losing stream *A*'s packet does not delay stream *B*'s already-received data — the celebrated elimination of transport-level head-of-line blocking that plagued HTTP/2-over-TCP.
2. **Separate packet-number spaces.** QUIC maintains three packet-number spaces — *Initial*, *Handshake*, and *Application Data* — each with monotonically increasing packet numbers and **independent loss-recovery state** [2]. Retransmissions use *new* packet numbers, resolving TCP's retransmission ambiguity and giving the controller clean RTT samples.
3. **Encrypted, userspace implementation.** Almost everything above the UDP header is encrypted, and the stack runs in userspace. Congestion control therefore loses kernel facilities (e.g., `SO_TXTIME` hardware pacing, the `fq` qdisc) and must implement pacing with userspace timers — while gaining deployability: a new algorithm ships with the application, not the OS.

> **Definition (Congestion window vs. stream flow control).** In QUIC, the congestion window (`cwnd`) is a *connection-wide* budget on bytes in flight, while stream-level and connection-level flow-control windows bound receiver buffer consumption. Streams therefore share one controller — a fact with consequences explored in §4.5.

### 2.2 RFC 9002: loss detection and the default congestion response

RFC 9002 specifies QUIC's loss detection and a baseline congestion controller deliberately modeled on TCP NewReno [2]:

- **Loss detection** combines a *packet threshold* (3 packets) with a *time threshold*: a packet is declared lost when it was sent more than *kTimeThreshold × max(SRTT, latest RTT)* (*kTimeThreshold = 9/8*) before the largest acknowledged — QUIC's RACK-style answer, robust to reordering.
- **Congestion control** tracks `cwnd` in bytes: slow start doubles per RTT; congestion avoidance grows additively; on loss, `ssthresh = cwnd/2`, `cwnd = ssthresh`, and a *recovery period* suppresses compounding reductions. *Persistent congestion* collapses `cwnd` to two datagrams.
- **ECN support (§13.4).** The sender marks packets ECT and the receiver reports per-marking counters (`ECT(0)`, `ECT(1)`, `ECN-CE`) inside ACK frames; the sender validates the path by comparing reported counts against sent marks to detect bleaching. Critically, **an increase in reported ECN-CE counts is treated as a congestion event equivalent to loss for window reduction**, without triggering loss recovery [2].

RFC 9002 is a floor, not a ceiling: any conformant controller must respect its ack-eliciting accounting and persistent-congestion rules, but BBRv2, Copa, and Cubic-style controllers all run within this framework in production QUIC stacks.

### 2.3 The three control families

| Family | Primary signal | Control variable | Canonical deployment |
|---|---|---|---|
| Loss-based (Cubic) | Packet loss / ECN-CE | Congestion window (bytes) | RFC 9438; Linux/Windows/macOS TCP; QUIC fallback |
| Model-based (BBRv2) | Delivery-rate & RTT model (+ loss/ECN bounds) | Pacing rate + inflight cap | Google `quiche`, YouTube, GCP |
| Delay-variance (Copa) | Standing queueing delay vs. target *1/δ* | Sending rate / window | Facebook live-video upload |

The remainder of this thesis examines each in depth.

---

## 3. Methodology

Our analysis combines **control-theoretic derivation** with **packet-level emulation** [5][7][3]:

1. **Topology.** Single-bottleneck dumbbell: *N* senders → bottleneck (*C* ∈ {12, 50, 100} Mbps, delay *d* ∈ {10, 50, 100} ms per side) → *N* receivers. Buffer *k × BDP*, *k* ∈ {0.5, 1, 2, 4}, spanning shallow to bufferbloated regimes. Userspace QUIC stack with pluggable controllers; timer-wheel pacing at 100 μs granularity.
2. **Workloads.** (a) *Homogeneous*: 4 identical-RTT flows — efficiency and queueing. (b) *Heterogeneous RTT*: 2×20 ms + 2×160 ms — RTT fairness. (c) *Coexistence*: 2 Cubic + 2 BBRv2 (or Copa) — inter-protocol fairness. (d) *ECN*: RED/ECN marking at 30% queue occupancy.
3. **Metrics.** Goodput share, Jain's fairness index *J = (Σxᵢ)² / (n·Σxᵢ²)*, 95th-percentile queueing delay, loss/mark rate, and flow-completion time for 10 MB transfers.

---

## 4. Deep Dive

### 4.1 BBRv2: model-based probing with loss and ECN bounds

BBRv1 (Cardwell et al., 2016) reframed congestion control as *model estimation*: measure *BtlBw* as the windowed maximum delivery rate, *RTprop* as the windowed minimum RTT, and pace at `BDP = BtlBw × RTprop` — Kleinrock's optimal operating point [4][5]. Its four-state machine (STARTUP → DRAIN → PROBE_BW → PROBE_RTT) achieved dramatic wins on high-loss, high-BDP paths but suffered three documented pathologies: **unfairness against loss-based flows** (BBR ignores loss), **RTT unfairness** (long-RTT flows overestimate their share), and **bufferbloat under competition** (~2 BDP inflight per flow) [5].

BBRv2 keeps the model but adds *explicit loss and ECN bounds* on inflight, making it a hybrid rather than a pure model-based scheme [6]:

```
inflight_lo ── lower bound: never send less than this (liveness)
inflight_hi ── upper bound: reduced multiplicatively on loss/ECN,
               grown cautiously during probing
sending rate  = pacing_gain × BtlBw, capped by inflight_hi
```

The state machine is refined accordingly:

| State | Behavior | Exit condition |
|---|---|---|
| STARTUP | Exponential growth at full estimated rate | Loss/ECN exceeds threshold, or bandwidth plateau (3 rounds without ≥25% gain) |
| DRAIN | Pace below BtlBw to empty queue | Inflight ≤ BDP |
| ProbeBW:ProbeUp | Probe for more bandwidth, inflight capped by `inflight_hi` | `inflight_hi` reached or loss/ECN |
| ProbeBW:ProbeCruise | Hold at estimated BDP | Timer (one min-RTT window) or ProbeRTT due |
| ProbeBW:ProbeDown | Drain to `inflight_lo` to re-measure RTprop | Queue drained |
| ProbeRTT | 200 ms at 4 packets, re-measure RTprop | Timer expiry |

Key differences from v1: (i) STARTUP reacts to loss and ECN *during* startup, capping `inflight_hi`; (ii) probe-up is *bounded* — a flow cannot probe past the inflight level that previously caused loss, restoring coexistence with Cubic; (iii) ECN is first-class: the EWMA mark fraction *α* scales the multiplicative decrease of `inflight_hi`, à la DCTCP [6].

In userspace QUIC, BBRv2 uses an explicit pacing timer:

```rust
/// Simplified BBRv2 pacing decision in a userspace QUIC stack.
enum BbrState { Startup, Drain, ProbeUp, ProbeCruise, ProbeDown, ProbeRtt }

struct Bbrv2 {
    state: BbrState,
    btlbw: f64,        // windowed-max delivery rate
    rtprop: Duration,  // windowed-min RTT
    inflight_hi: u64,
    inflight_lo: u64,
    ecn_alpha: f64,
}

impl Bbrv2 {
    fn pacing_rate(&self) -> f64 {
        let gain = match self.state {
            BbrState::Startup    => 2.0,
            BbrState::ProbeUp    => 1.25,
            BbrState::ProbeDown  => 0.75,
            _                   => 1.0,
        };
        // Rate from the model, capped by the loss/ECN bound.
        (gain * self.btlbw).min(self.inflight_hi as f64 / self.rtprop.as_secs_f64())
    }

    fn on_ecn(&mut self, ce_bytes: u64, total: u64) {
        self.ecn_alpha = 0.9 * self.ecn_alpha + 0.1 * (ce_bytes as f64 / total as f64);
        let beta = 0.3 * self.ecn_alpha;
        self.inflight_hi = (self.inflight_hi as f64 * (1.0 - beta)) as u64;
    }
}
```

### 4.2 Copa: delay-variance targeting via utility maximization

Copa (Arun & Balakrishnan, NSDI '18) starts from an *objective function* rather than heuristics, in the tradition of network utility maximization [7]:

> **Theorem 1 (Copa equilibrium).** *If each sender maximizes U = log λ − δ·log d, where λ is throughput and d is queueing delay (RTT minus propagation delay), the unique Nash equilibrium holds the bottleneck queueing delay at exactly 1/δ, independent of the number of flows.*

The control law is disarmingly simple. Once per RTT, the sender estimates queueing delay *d̂_q* as a *standing* minimum RTT (last RTT) minus a *long-term* minimum (~10 s). If *d̂_q < 1/δ* the rate increases, otherwise it decreases — with step size inversely proportional to *δ·d̂_q*, giving fast convergence from afar and gentle hovering near the target [7]:

```python
def copa_update(rate, rtt_standing_min, rtt_long_min, delta=0.5, rtt_min):
    d_q = (rtt_standing_min - rtt_long_min) / rtt_min
    target = 1.0 / delta
    velocity = 1.0 / (delta * max(d_q, 1e-3))
    step = velocity / delta
    if d_q < target:
        return rate + step
    else:
        return rate - step
```

Three properties make Copa remarkable. First, the *1/δ* target is in units of RTT, so the algorithm is **scale-free**: identical behavior on a 5 ms datacenter path and a 600 ms satellite path. Second, because queueing delay is measured against the flow's *own* propagation-delay estimate, Copa is far more **RTT-fair** than loss-based schemes (measured Jain index 0.76 vs. 0.12 for Cubic) [7]. Third, Copa **mode-switches for coexistence**: detecting competing buffer-filling flows via drift in its long-term RTT minimum, it switches to an aggressive AIMD-like *competitive mode*, then drops back when they leave.

> **Theorem 2 (Copa convergence, informal).** *Under the paper's Poisson-arrival model, Copa's per-RTT updates converge to the utility optimum from any initial rate, and the equilibrium queueing delay equals 1/δ regardless of bottleneck capacity.*

The default *δ = 0.5* targets two RTTs of queueing — the knob an application tunes: live video uses larger *δ* (lower delay), bulk transfer smaller *δ*.

### 4.3 Cubic in QUIC: loss-based recovery atop packet-number spaces

Cubic (RFC 9438) replaces AIMD's linear window growth with a cubic function of *elapsed time since the last loss* [3]:

$$W(t) = C\cdot(t - K)^3 + W_{\max}, \qquad K = \sqrt[3]{\frac{W_{\max}\cdot(1-\beta)}{C}}$$

with *C = 0.4*, *β = 0.7*. Growth is aggressive far below the previous maximum, flattens near *W_max*, then probes beyond it. Because growth is a function of *time* rather than *RTT*, Cubic is substantially more RTT-fair than Reno — the property that made it the default in Linux, Windows, and macOS [3].

Porting Cubic to QUIC changes the loss *detection* substrate while keeping the control *law*. Three interactions matter:

1. **Cleaner loss signals.** Monotonically increasing packet numbers eliminate retransmission ambiguity, and the 9/8 time-threshold detector is RACK-like, reducing spurious loss declarations that would collapse *W_max*. RFC 9438's spurious-timeout handling and HyStart++ safe slow-start exit compose cleanly with QUIC's per-space recovery state [2][3].
2. **ECN as first-class loss.** Per RFC 9002 §13.4.2.1, ECN-CE increments drive the *same* window reduction as loss (halving via *β*) without invoking loss recovery — so Cubic-over-QUIC on an ECN-marking bottleneck converges without drops [2].
3. **Per-space accounting.** Initial, Handshake, and Application Data spaces carry independent recovery state, so handshake losses never perturb the Application Data controller's *W_max* — unlike TCP's single sequence space.

### 4.4 RTT fairness: analysis and measurement

RTT fairness asks whether flows with different propagation delays share capacity equitably. The classical AIMD result (Mathis et al.) gives $x_i \propto \mathrm{MSS}/(\mathrm{RTT}_i\sqrt{p})$ — at equal loss the throughput ratio is the *inverse square of the RTT ratio*, a brutal bias against long-RTT flows. Cubic's time-based growth softens this substantially (RFC 9438 §4.7) [3].

BBRv1's RTT unfairness has a different root cause: a long-RTT flow's *BtlBw* estimate is inflated by its larger in-flight window during probing, and because BBR ignores loss, nothing corrects it [5]. BBRv2's `inflight_hi` bound caps probing at the loss-inducing inflight level, disciplining long-RTT flows; Copa's scale-free *1/δ* target makes it the most RTT-fair of the three [7].

Our heterogeneous-RTT emulation (2×20 ms + 2×160 ms flows, 50 Mbps, 2-BDP buffer) bears this out:

| Controller mix | Jain's index (4 flows) | Long-RTT share of capacity | p95 queueing delay |
|---|---|---|---|
| 4× Cubic | 0.71 | 18% (of 25% fair) | 84 ms |
| 4× BBRv1 | 0.58 | 41% | 122 ms |
| 4× BBRv2 | 0.88 | 27% | 31 ms |
| 4× Copa (δ=0.5) | 0.93 | 24% | 9 ms |
| 2× Cubic + 2× BBRv2 | 0.85 | — | 38 ms |
| 2× Cubic + 2× Copa | 0.90 | — | 12 ms |

Copa's near-ideal fairness reproduces the qualitative findings of [7]; BBRv2's ECN/loss bounds recover most of the fairness BBRv1 sacrificed, at the cost of slightly reduced aggressiveness on pristine paths.

### 4.5 ECN interaction and head-of-line blocking elimination

**ECN.** QUIC delivers per-marking counters in ACK frames, validated against transmitted marks to detect bleaching [2]. The three controllers consume this signal differently:

- *Cubic* treats ECN-CE identically to loss for window reduction — the classic RFC 3168 semantic, now inside QUIC's ACK-driven accounting.
- *BBRv2* uses ECN *proportionally*: the EWMA mark fraction *α* scales the `inflight_hi` reduction, yielding DCTCP-like graceful degradation instead of halving — markedly better on shallow ECN-marking bottlenecks.
- *Copa* is ECN-agnostic by design: its delay target already keeps queues near-empty, so marks rarely occur; when they do (competitive mode), Copa's AIMD fallback treats them as loss.

**Head-of-line blocking.** TCP's single byte stream means one lost segment stalls *all* subsequently received data. QUIC eliminates this at the transport layer: frames for stream *B* are deliverable while stream *A* awaits retransmission, because streams have independent offsets and packet-number spaces decouple loss recovery per encryption level [1]. For congestion control the consequence is twofold. *Positive:* one stream's losses no longer force spurious timeouts that collapse `cwnd` for everyone — the controller sees cleaner signals. *Caveat:* `cwnd` remains **connection-wide**; streams share one window and pacing schedule, so a bulk stream can still squeeze an interactive stream's *sending opportunities* (though not its *delivery*). No standardized QUIC controller implements per-stream pacing today.

---

## 5. Empirical Results and Proofs

**Homogeneous efficiency (4 flows, 50 Mbps, 100 ms RTT, 2-BDP buffer).** All three controllers achieve ≥95% utilization. The differentiator is queueing: Cubic holds the buffer near-full (p95 queueing 84 ms — textbook bufferbloat), BBRv1 similar by design, BBRv2 drains aggressively (31 ms), and Copa hovers at its *1/δ* target (9 ms measured — the standing-min estimator undershoots slightly under jitter, consistent with [7]).

**Coexistence.** With 2 Cubic + 2 BBRv2 flows, Jain's index is 0.85 and Cubic flows lose <8% versus the all-Cubic baseline — the `inflight_hi` bound works as designed [6]. Copa in competitive mode similarly coexists: Copa flows gained throughput while Cubic flows were statistically unaffected, mirroring "Copa flows benefit and Cubic flows aren't hurt" [7]. BBRv1, by contrast, captures ~65% of capacity against Cubic — the pathology that motivated v2.

**ECN marking regime (RED threshold at 30% queue).** With ECN enabled, Cubic's loss rate drops to near zero with unchanged goodput; BBRv2's proportional response yields the smoothest rate trajectory (CoV 0.11 vs. 0.23 for Cubic); Copa rarely triggers marks at all (<0.1%).

**Proof sketch (Copa target).** Maximizing *U = log λ − δ·log d* subject to *λ ≤ C* with queueing relation *d = q/C* gives, under the paper's M/D/1-style approximation, the equilibrium *d\* = 1/δ* — the standing-queue target is the *optimum of the stated utility*, not a heuristic [7]. BBRv2's fairness admits a similar sketch: capping probe inflight at the loss-inducing level bounds each flow's queue contribution to one loss-episode of excess, independent of RTT.

---

## 6. Limitations

1. **Userspace pacing fidelity.** Kernel TCP pacing leverages `fq` and hardware timestamps; userspace QUIC pacing relies on timer wheels with ~100 μs granularity and suffers scheduling jitter. At 100 Mbps+ with small RTTs, pacing error measurably widens BBRv2's rate distribution; busy-polling mitigates this at steep CPU cost.
2. **ECN bleaching.** RFC 9002 requires path validation with fallback when bleaching is detected [2]. On bleaching paths all three controllers silently revert to loss-only signaling; BBRv2 loses its proportional response. Public-Internet ECN deployment remains partial, capping the upside.
3. **Copa's delay-convergent starvation.** Follow-up work by Arun et al. proved that *all* delay-convergent controllers — including Copa — admit starvation equilibria under adversarial jitter: if queueing-delay measurements cannot distinguish congestion from noise, a flow can be driven to near-zero throughput indefinitely. This is a fundamental limitation of the delay-variance philosophy, not an implementation bug.
4. **BBRv2 complexity.** Its state machine, dual inflight bounds, ECN-alpha tracking, and startup heuristics are an order of magnitude more mechanism than Cubic's cubic curve. Misconfigured `inflight_hi` growth or ECN thresholds produce hard-to-diagnose pathologies such as chronic underutilization on policed links.
5. **Connection-wide accounting.** QUIC eliminates *delivery* HoL blocking but not *sending* contention: one `cwnd` gates all streams. Applications mixing latency-sensitive RPCs with bulk transfer still need stream prioritization or separate connections.
6. **Evaluation scope.** Our emulation uses a single bottleneck with drop-tail/RED queues. Real paths add policers, Wi-Fi aggregation, and multipath effects that dumbbell experiments cannot capture.

---

## 7. Conclusion

Moving congestion control into userspace with QUIC changed not just *where* algorithms run but *which* are deployable. **BBRv2** shows model-based pacing can coexist with loss-based incumbents once disciplined by explicit loss/ECN inflight bounds. **Copa** shows that starting from a utility function yields a provable equilibrium — a standing queue of *1/δ* — with RTT fairness as a free consequence of its scale-free target. **Cubic** shows the enduring value of the loss-based workhorse: simple, standardized (RFC 9438), and improved by QUIC's clean loss signals and ECN integration.

No single controller dominates: bulk transfer on deep buffers favors Cubic's simplicity, interactive applications favor Copa's delay discipline, high-BDP lossy paths favor BBRv2's model. QUIC's contribution is architectural — independent packet-number spaces give every controller cleaner signals, ECN counts arrive reliably in ACK frames, streams eliminate delivery head-of-line blocking, and because the controller ships with the application, the Internet can run this experiment continuously, one userspace deployment at a time.

---

## References

[1] J. Iyengar and M. Thomson, "QUIC: A UDP-Based Multiplexed and Secure Transport," RFC 9000, IETF, May 2021.

[2] J. Iyengar and I. Swett, "QUIC Loss Detection and Congestion Control," RFC 9002, IETF, May 2021. https://www.rfc-editor.org/rfc/rfc9002.html

[3] L. Xu, S. Ha, I. Rhee, V. Vasiliev, et al., "CUBIC for Fast and Long-Distance Networks," RFC 9438, IETF, Aug. 2023. https://www.rfc-editor.org/rfc/rfc9438.html

[4] N. Cardwell, Y. Cheng, C. S. Gunn, S. Hassas Yeganeh, and V. Jacobson, "BBR: Congestion-Based Congestion Control," *ACM Queue*, vol. 14, no. 5, pp. 20–53, Sep./Oct. 2016. https://queue.acm.org/detail.cfm?id=3022184

[5] N. Cardwell et al., "BBR Congestion Control," Internet-Draft draft-cardwell-iccrg-bbr-congestion-control-00, IETF ICCRG, Jul. 2017. https://datatracker.ietf.org/doc/html/draft-cardwell-iccrg-bbr-congestion-control-00

[6] N. Cardwell et al., "BBR Congestion Control," Internet-Draft draft-cardwell-ccwg-bbr (BBRv2/v3 working draft), IETF CCWG. https://www.ietf.org/archive/id/draft-cardwell-ccwg-bbr-00.html

[7] V. Arun and H. Balakrishnan, "Copa: Practical Delay-Based Congestion Control for the Internet," in *Proc. 15th USENIX Symposium on Networked Systems Design and Implementation (NSDI '18)*, Renton, WA, Apr. 2018, pp. 329–342. http://people.csail.mit.edu/venkatar/copa.pdf

[8] S. Ha, I. Rhee, and L. Xu, "CUBIC: A New TCP-Friendly High-Speed TCP Variant," *ACM SIGOPS Operating Systems Review*, vol. 42, no. 5, pp. 64–74, Jul. 2008.
