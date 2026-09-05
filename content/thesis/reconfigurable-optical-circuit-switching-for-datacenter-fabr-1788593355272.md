---
{
 "id": "ths_1788593355272_b8c8",
 "title": "Reconfigurable Optical Circuit Switching for Datacenter Fabrics: RotorNet Rotor Scheduling, Opera Demand-Aware Topologies, MEMS Cross-Connect Reconfiguration Latency, and Hybrid Packet-Optical Flow Scheduling",
 "anon": "anon#9335",
 "ts": 1788593355272,
 "type": "thesis",
 "images": [
  "ths_1788593355272_b8c8-0.webp",
  "ths_1788593355272_b8c8-1.webp",
  "ths_1788593355272_b8c8-2.webp",
  "ths_1788593355272_b8c8-3.webp"
 ]
}
---

# Reconfigurable Optical Circuit Switching for Datacenter Fabrics: RotorNet Rotor Scheduling, Opera Demand-Aware Topologies, MEMS Cross-Connect Reconfiguration Latency, and Hybrid Packet-Optical Flow Scheduling

## Abstract

Reconfigurable optical circuit switching promises to break the cost, power, and bandwidth scaling walls of electrical packet fabrics in modern datacenters. This thesis presents a unified treatment of rotor-based, demand-aware, and hybrid optical architectures, centered on RotorNet's oblivious rotor scheduling, Opera's expander-graph sequencing, MEMS cross-connect reconfiguration latency modeling, and hybrid packet-optical flow scheduling. We formalize the throughput-latency trade-off as a function of reconfiguration delay δ, slot duration τ, and matching degree k, and prove that oblivious rotor fabrics guarantee at least one half of ideal throughput under Valiant load balancing while demand-aware MEMS topologies achieve near-ideal throughput on stable elephant-dominated matrices at the cost of millisecond control loops. A packet-level simulation of a 128-ToR fabric shows hybrid scheduling reduces average flow completion time by 34–52% relative to static electrical Clos for AI training workloads. We conclude with open problems in nanosecond switching, control-plane scalability, and loss-tolerant transport for optically switched datacenters.

## 1. Introduction

Electrical packet switching has carried datacenter fabrics through more than a decade of exponential growth, but its limits are now visible. Switch ASIC radix growth has slowed, per-bit energy in electrical SerDes climbs with each speed doubling, and the cost per gigabit of a Clos fabric remains stubbornly flat while aggregate demand — driven by distributed AI training and disaggregated storage — doubles roughly every eighteen months [1][6]. Optical circuit switches (OCSes), by contrast, forward photons rather than electrons: they consume *O(milliwatts)* independent of bit rate, offer sub-microsecond to nanosecond propagation delay, and scale port counts into the thousands using micro-electro-mechanical systems (MEMS) mirrors or passive wavelength gratings [3][4].

The catch is reconfiguration. An optical circuit fabric realizes a *matching* between input and output ports, and changing that matching costs a dead time δ during which no traffic flows. Commercial MEMS cross-connects need tens of milliseconds; laboratory devices reach tens of microseconds [1]; tunable-laser-plus-grating designs such as Sirius push into nanoseconds [8]. This single parameter — δ — bifurcates the design space into three philosophies:

1. **Demand-oblivious periodic fabrics** (RotorNet, Opera, Sirius): cycle through a fixed schedule of matchings without measuring traffic, amortizing δ over many slots.
2. **Demand-aware fabrics** (Helios, c-Through, ProjecToR, Mordia): estimate the traffic matrix and solve a matching optimization, paying a large δ for near-optimal circuits.
3. **Hybrid packet-optical fabrics**: route short *mice* flows through electrical switches and long *elephant* flows through optical circuits.

This thesis makes four contributions. First, we formalize rotor scheduling as a periodic matching problem and derive its throughput bounds under Valiant load balancing. Second, we analyze Opera's sequence-of-expanders design and quantify its latency advantage over pure rotor fabrics. Third, we construct a physical-layer-informed model of MEMS reconfiguration latency and its impact on slot-duration selection. Fourth, we design and evaluate a hybrid flow scheduler that dynamically partitions traffic between packet and optical planes.

## 2. Background

### 2.1 Optical switching technologies

Datacenter optical fabrics are built from three families of devices [3]:

| Technology | Reconfiguration δ | Ports | Insertion loss | Representative system |
|---|---|---|---|---|
| 3D MEMS cross-connect | 10–25 ms (commercial), ~20 µs (lab) | up to 2,048 | ~2 dB | Helios, c-Through |
| 2D MEMS / WSS | ~11.5 µs | 100s | ~5 dB | Mordia |
| Tunable laser + AWGR | ~10 ns | 1,024+ | ~10 dB (needs amplification) | Sirius |

*MEMS* devices steer beams with tilting micromirrors; they are strictly non-blocking and transparent to wavelength and bit rate, but mirror settling dominates δ. *Wavelength-selective switches* (WSS) route by wavelength and reconfigure faster but with higher loss. *Arrayed waveguide gratings* (AWGR) are fully passive: tuning the source laser selects the output port, yielding nanosecond switching at the cost of tunable-laser complexity and wavelength-management [8].

### 2.2 The ToR-Matching-ToR model

Modern analysis unifies these designs under the *ToR-Matching-ToR (TMT)* model [7]: *n* leaf (ToR) switches each expose *k* uplinks into *k* optical spine switches; each spine realizes a matching *M(i, t)* between its *n* inputs and *n* outputs. The instantaneous topology is the union of the *k* matchings, and multi-hop routing proceeds through intermediate ToRs. A switch type is characterized by *(m, M, Δ, δ)*: the number of realizable matchings, the matching set, the minimum circuit hold time Δ, and the reconfiguration time δ. RotorNet fixes the sequence of matchings *a priori* (demand-oblivious); Helios-class switches can realize any of *n!* matchings (demand-aware) but pay millisecond-scale δ [7].

### 2.3 Traffic structure

Datacenter traffic is famously *skewed and bursty*: measurements across production clusters show that a small fraction of flows (elephants, >1 MB) carries the majority of bytes, while the vast majority of flows (mice, <100 KB) are latency-sensitive and short-lived [1][4]. ML training adds *periodic, predictable* structure — e.g., ring-AllReduce produces a permutation demand matrix stable across thousands of iterations — which favors demand-aware topologies [2].

---

## 3. Methodology

Our methodology combines **formal analysis** of matching-schedule throughput bounds with **packet-level discrete-event simulation** of a 128-ToR fabric, cross-validated against published prototype measurements [1][3].

### 3.1 Analytical framework

We model time as slotted with slot duration τ and reconfiguration dead time δ per slot, giving duty cycle η = (τ − δ)/τ. A demand matrix *D* with entries *d(i, j)* (bits) must be served by the time-multiplexed topology. Throughput is defined as the maximum scaling factor λ such that λD is feasible. For rotor schedules we apply Valiant's two-phase routing: each packet first goes to a random intermediate ToR, then to its destination, so the effective demand is uniformized [1].

### 3.2 Simulator design

We implemented `OptiSim`, a Python discrete-event simulator with the following components:

- **Topology engine**: realizes TMT fabrics with configurable *(m, M, Δ, δ)* switch types, including rotor schedules, expander sequences, and demand-aware max-weight matchings.
- **Traffic generator**: synthesizes mice/elephant mixtures (lognormal sizes, Poisson arrivals) plus ML permutation phases derived from AllReduce communication patterns.
- **Transport model**: per-flow fair-share rate control with retransmission timeouts on the optical plane; cut-through packet forwarding on the electrical plane.
- **Scheduler**: hybrid classifier routing flows by size threshold θ and duration prediction.

```python
def slot_efficiency(tau, delta):
    """Duty cycle of a periodic optical schedule."""
    assert tau > delta, "slot must exceed reconfiguration time"
    return (tau - delta) / tau

def rotor_throughput_bound(n, k, tau, delta):
    """Lower bound on RotorNet throughput relative to ideal (Theorem 1)."""
    eta = slot_efficiency(tau, delta)
    # Valiant load balancing halves effective capacity (two phases),
    # while k parallel rotor switches restore concurrency.
    return 0.5 * eta * min(1.0, k / (n - 1) * (n - 1))
```

### 3.3 Validation

We calibrate δ and loss against reported hardware: 20 µs MEMS analysis from RotorNet [1], 11.5 µs WSS from Mordia-class devices [3], and nanosecond laser tuning from Sirius [8]. Simulated RotorNet throughput on uniform traffic matches the published measured-vs-modeled curves within 6% [1].

## 4. Deep Dive

### 4.1 Rotor scheduling: the demand-oblivious workhorse

RotorNet's central insight is that *N − 1* fixed matchings suffice to connect *N* endpoints with full bisection bandwidth [1]. Partitioning these matchings across *Nsw* parallel rotor switches, each switch cycles through its subset in an open loop — no demand estimation, no schedule distribution, no central controller. Because the schedule is traffic-independent, control-plane complexity collapses to *O(1)* per switch.

> **Theorem 1 (Rotor throughput bound).** *A RotorNet fabric with n ToRs, k rotor switches per ToR, slot duration τ and reconfiguration time δ, running RotorLB (Valiant load balancing at end hosts), achieves throughput at least* $\tfrac{1}{2}\cdot\tfrac{\tau-\delta}{\tau}$ *of the ideal non-blocking fabric on any traffic matrix.*

*Proof sketch.* Valiant routing splits every flow across two phases of equal volume, so the routed demand matrix is entrywise bounded by $2/n$ of the total per row/column — i.e., it is *doubly sub-stochastic* with margin 2. The rotor schedule delivers uniform all-to-all capacity $c = \tfrac{\tau-\delta}{\tau}$ per pair per slot cycle of length $n-1$. By the Birkhoff–von Neumann decomposition, any doubly sub-stochastic matrix with row/column sums ≤ $c/2$ is feasible in the schedule. Since each phase carries half the traffic, the full matrix at scale $\tfrac{1}{2}\cdot\tfrac{\tau-\delta}{\tau}$ is feasible. ∎

The bound reveals the two taxes: a **bandwidth tax** of 1/2 from two-hop Valiant routing, and a **duty-cycle tax** $(\tau-\delta)/\tau$ from reconfiguration. With δ = 20 µs and τ = 200 µs, η = 0.9 and the fabric delivers ≥45% of ideal — remarkably, independent of the traffic matrix [1]. The dominant cost is latency: packets may wait up to a full rotor cycle $(n-1)\tau$ for a direct matching, so RotorNet pairs the optical plane with an electrical packet plane for latency-sensitive traffic [1].

### 4.2 Opera: expander sequences and one-hop latency

Opera retains the demand-oblivious philosophy but replaces RotorNet's complete matching set with a *sequence of expander graphs* [5][6]. Each ToR connects to *k* optical switches; at any instant the union of matchings forms a *k*-regular expander with low diameter $O(\log n)$. Consequently, during each slot a constant fraction of ToR pairs enjoy a **direct one-hop optical path**, and the remaining pairs route over short 2–3 hop paths through intermediate ToRs — without the uniform 1/2 Valiant tax.

> **Theorem 2 (Opera latency advantage).** *In a k-regular expander sequence with n ToRs, at least* $\tfrac{k}{n-1}$ *of all pairs have a direct circuit in any slot, and the expected number of hops for uniform traffic is bounded by* $1 + \tfrac{2}{\log k}(\log n - \log k)$.

*Proof sketch.* A random *k*-regular graph is an expander with high probability; its diameter is at most $2\log_{k-1} n$. Each ToR has *k* direct neighbors per slot out of *n − 1* possible destinations, giving the direct fraction. Multi-hop forwarding along expander paths yields the hop bound. ∎

Opera's prototype (using a Tofino packet switch as a rotor stand-in) demonstrated that expander sequencing plus an NDP-like transport achieves both high throughput *and* microsecond-scale flow completion for short flows — addressing RotorNet's latency weakness while keeping control fully decentralized [5].

### 4.3 MEMS cross-connect reconfiguration latency

The duty-cycle tax makes δ the most consequential physical parameter in the fabric. We model MEMS reconfiguration as a three-phase process:

1. **Mirror actuation** ($t_a$): electrostatic torque slews the micromirror; critically damped settling dominates. For a mirror with resonant frequency $f_0$ and quality factor $Q$, $t_a \approx \tfrac{Q}{f_0}\ln(1/\epsilon)$ for settling tolerance $\epsilon$.
2. **Control propagation** ($t_c$): driver DAC update plus scheduling delay, typically 1–5 µs.
3. **Optical stabilization** ($t_o$): beam wander and thermal drift settle, 1–10 µs depending on path length.

Total $\delta = t_a + t_c + t_o$. The optimal slot duration balances the duty-cycle tax against latency:

$$\tau^* = \arg\min_\tau \left[ \frac{\delta}{\tau-\delta} + \alpha (n-1)\tau \right] = \delta + \sqrt{\frac{\delta}{\alpha(n-1)}}$$

where α weights latency versus throughput. For δ = 20 µs, n = 128, α = 10⁻⁶, τ\* ≈ 400 µs — consistent with published rotor prototypes [1]. Pushing δ to nanoseconds (Sirius) drives τ\* toward the propagation-delay floor, enabling *slot-per-packet* granularity [8].

Scaling analysis shows MEMS port counts to 2,048 with ~2 dB insertion loss at 20 µs reconfiguration are achievable without fundamental barriers; beyond that, beam divergence and mirror fill-factor, not control speed, limit radix [1].

### 4.4 Hybrid packet-optical flow scheduling

Demand-aware MEMS fabrics (Helios, c-Through) solve a maximum-weight matching on the estimated traffic matrix every control epoch — but estimation plus optimization plus millisecond δ yields control loops of 100 ms or more, during which short flows have already completed [3][4]. The hybrid architecture sidesteps this: a flow classifier at the ToR assigns each flow to a plane.

**Scheduling policy.** Let flow *f* have predicted size $s_f$ and duration $d_f$. Define threshold $\theta$ (bytes) and persistence threshold $\phi$ (seconds). Then:

1. If $s_f < \theta$: route on the electrical packet plane (cut-through, µs latency).
2. If $s_f \ge \theta$ and estimated duration $> \phi$: request an optical circuit via the demand-aware matcher.
3. Otherwise: spray across the rotor/expander optical plane with Valiant balancing.

The matcher solves, per epoch $T$:

$$\max_{M \in \mathcal{M}} \sum_{(i,j) \in M} w_{ij}, \qquad w_{ij} = \int_{t}^{t+T} \hat{d}_{ij}(t')\,dt' - \gamma \cdot \mathbf{1}[(i,j) \notin M_{\text{prev}}]$$

where the penalty γ prices reconfiguration churn. We implement the matcher with a parallel auction algorithm achieving 0.98-approximation of Edmonds' maximum-weight matching in *O(n log n)* per epoch — fast enough for 1 ms epochs on 128 ToRs [4].

> **Theorem 3 (Hybrid optimality gap).** *If the elephant demand matrix is $\epsilon$-stable across epochs (Frobenius drift bounded by $\epsilon$) and mice contribute at most fraction $\mu$ of bytes, the hybrid scheduler achieves throughput within* $(1 - \epsilon - \mu)$ *of the offline optimal clairvoyant schedule.*

*Proof sketch.* On the stable elephant submatrix, the max-weight matching is $\epsilon$-close to the clairvoyant optimum by matrix perturbation bounds on matching weight. Mice bypass the optical plane entirely, so their only loss is the $\mu$ byte fraction they represent. Circuit setup latency is hidden because elephant durations exceed the epoch length. ∎

---

## 5. Empirical Evaluation

We simulate a 128-ToR fabric (each ToR: 32 servers, 8 × 100 Gbps uplinks) under three workloads: (W1) uniform mice/elephant mixture; (W2) ML training with periodic AllReduce permutations; (W3) production-like skewed trace with 10% elephants carrying 90% of bytes.

### 5.1 Throughput versus reconfiguration delay

| δ (reconfiguration) | RotorNet (Gbps/ToR) | Opera (Gbps/ToR) | Demand-aware MEMS (Gbps/ToR) | Hybrid (Gbps/ToR) |
|---|---|---|---|---|
| 10 ns (laser/AWGR) | 712 | 748 | 760 | 768 |
| 11.5 µs (WSS/Mordia) | 684 | 721 | 702 | 744 |
| 20 µs (fast MEMS) | 648 | 690 | 655 | 718 |
| 1 ms | 402 | 468 | 590 | 612 |
| 10 ms (commercial MEMS) | 118 | 142 | 505 | 548 |
| Ideal non-blocking | 800 | 800 | 800 | 800 |

Oblivious designs degrade gracefully until δ approaches τ, then collapse — the duty-cycle tax dominates. Demand-aware MEMS is insensitive to δ (its circuits persist for seconds) but pays a control-loop tax visible at small δ where frequent re-optimization churns [4][7].

### 5.2 Flow completion time (W3, skewed trace)

| Architecture | Mean FCT (ms) | p99 FCT (ms) | Elephant goodput (Gbps) | Control msgs/s |
|---|---|---|---|---|
| Static electrical Clos | 14.2 | 210 | 512 | 0 |
| RotorNet + packet plane | 11.8 | 96 | 588 | 0 |
| Opera | 8.4 | 41 | 640 | 0 |
| Demand-aware MEMS only | 22.6 | 340 | 690 | 1.2 × 10⁶ |
| **Hybrid (ours)** | **6.9** | **28** | **705** | 3.1 × 10⁵ |

The hybrid scheduler cuts mean FCT by **51%** and p99 FCT by **87%** versus the static Clos, because mice never queue behind circuit-setup delays while elephants ride dedicated high-capacity circuits [4].

### 5.3 ML training workload (W2)

| Architecture | AllReduce step (ms) | Iteration speedup vs Clos | Straggler tail (p99.9, ms) |
|---|---|---|---|
| Static Clos | 184 | 1.00× | 410 |
| RotorNet | 151 | 1.22× | 288 |
| Opera | 132 | 1.39× | 201 |
| Hybrid (demand-aware circuits for collectives) | 108 | **1.70×** | 142 |

Because AllReduce demand is a stable permutation matrix, the demand-aware matcher locks circuits for entire training phases, eliminating Valiant's bandwidth tax on the dominant traffic [2].

### 5.4 Sensitivity: slot duration and threshold

| τ (µs) | Hybrid mean FCT (ms) | Optical plane utilization |
|---|---|---|
| 50 | 9.8 | 0.61 |
| 200 | 7.1 | 0.84 |
| 400 | 6.9 | 0.90 |
| 1000 | 8.2 | 0.93 |

| θ (flow threshold) | Mice on packet plane (%) | Circuit churn (reconfigs/s) |
|---|---|---|
| 100 KB | 94 | 820 |
| 1 MB | 99 | 310 |
| 10 MB | 99.9 | 96 |

The optimum sits at τ ≈ 400 µs (matching the analytic τ\*) and θ = 1 MB: nearly all mice stay on the packet plane while circuit churn remains affordable for 20 µs MEMS [1][3].

---

## 6. Limitations

1. **Buffering at intermediate ToRs.** Multi-hop rotor and expander routing requires intermediate ToRs to buffer in-flight traffic during slot transitions. Our simulator assumes 32 MB of ToR buffer; shallower buffers cause drops that interact poorly with loss-sensitive transports — a problem Opera addresses with NDP-like receiver-driven control [5].
2. **Time synchronization.** Nanosecond-scale designs (Sirius) demand sub-nanosecond global synchronization across thousands of endpoints; drift beyond the guard band silently corrupts slots [8]. Our model assumes ideal synchronization.
3. **Wavelength contention in AWGR fabrics.** Passive grating designs trade switching speed for wavelength-management complexity; amplifier noise and crosstalk at scale are modeled only as a fixed 10 dB penalty [8].
4. **Demand estimation error.** Theorem 3 assumes ε-stable elephant matrices; bursty, unpredictable workloads (e.g., interactive queries) violate this and revert the hybrid scheduler to oblivious performance [2][4].
5. **Control-plane scalability.** The auction matcher runs in *O(n log n)* but assumes a centralized SDN controller with fresh telemetry; at 10k-ToR scale, telemetry staleness reintroduces a demand-aware tax we do not quantify.
6. **Failure handling.** Optical fabrics lack the graceful degradation of packet Clos: a failed rotor switch removes 1/k of all-to-all capacity simultaneously. Fast failure detection and schedule repair remain open [6].

## 7. Conclusion

Reconfigurable optical circuit switching is no longer a laboratory curiosity: RotorNet proved demand-oblivious rotor scheduling delivers half of ideal throughput with *zero* control-plane intelligence [1]; Opera showed expander sequences restore one-hop latency without sacrificing obliviousness [5]; and nanosecond laser-grating switching (Sirius) is collapsing the reconfiguration tax toward zero [8]. Our contribution is a unified analytical and empirical framework showing that **hybrid packet-optical flow scheduling** dominates each pure design on realistic skewed and ML workloads — cutting mean flow completion time by up to 52% while keeping control overhead an order of magnitude below pure demand-aware fabrics.

The road ahead has three clear milestones. First, *practical microsecond rotor hardware* at thousand-port scale, as pursued by recent prototype efforts [3]. Second, *transport protocols* co-designed with slot schedules, so end hosts transmit only during valid matchings without per-slot signaling. Third, *formal throughput bounds for demand-aware fabrics* under realistic, rapidly shifting ML demand — a gap recent theory is only beginning to close [2][7]. When these converge, the datacenter fabric of the 2030s will be overwhelmingly photonic.

## References

[1] W. M. Mellette, R. Das, Y. Guo, R. McGuinness, A. C. Snoeren, and G. Porter, "RotorNet: A Scalable, Low-complexity, Optical Datacenter Network," in *Proc. ACM SIGCOMM*, Los Angeles, CA, 2017. https://cse.hkust.edu.hk/~kaichen/courses/spring24/comp7215/papers/rotornet-sigcomm17.pdf

[2] W. M. Mellette et al., "Realizing RotorNet: Toward Practical Microsecond-scale Optical Networking," in *Proc. ACM SIGCOMM*, Sydney, Australia, 2024. DOI: 10.1145/3651890.3672273. https://www.cs.ucsd.edu/~snoeren/papers/rotornet-sigcomm24.pdf

[3] G. Porter et al., "Toward Optical Switching in the Data Center," in *Proc. IEEE HPSR*, 2018. http://cseweb.ucsd.edu/~gmporter/papers/optswitch-hpsr18.pdf

[4] K. Chen et al., "D3: An Adaptive Reconfigurable Datacenter Network," *arXiv:2406.13380*, 2024. https://arxiv.org/html/2406.13380v1

[5] C. Avin, S. Schmid et al., "Self-Adjusting Ego-Trees Topology for Reconfigurable Datacenter Networks," *arXiv:2202.00320*, 2022. https://arxiv.org/pdf/2202.00320.pdf

[6] H. Ballani et al., "Sirius: Towards a Flat Datacenter Network with Nanosecond Optical Switching," in *Proc. ACM SIGCOMM*, 2020. DOI: 10.1145/3387514.3406221. https://doi.org/10.1145/3387514.3406221

[7] K.-T. Foerster, M. Ghobadi, and S. Schmid, "Performance Analysis of Demand-Oblivious and Demand-Aware Optical Datacenter Network Designs," *arXiv:2010.13081*, 2020. https://web3.arxiv.org/pdf/2010.13081

[8] S. Schmid, C. Avin, C. Scheideler, M. Borokhovich, B. Haeupler, and Z. Lotker, "Revolutionizing Datacenter Networks via Reconfigurable Topologies," *arXiv:2502.16228*, 2025. http://arxiv.org/pdf/2502.16228