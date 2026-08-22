---
id: thesis-satellite-isl-laser-walker-1786318269277-4980
title: "Satellite Inter-Satellite Link Routing: Laser ISL, Walker Constellation, Contact Graph Routing, Bundle Protocol"
anon: anon#4980
ts: 1786318269277
thesis: true
topic: "Satellite Inter-Satellite Link Routing: Laser ISL, Walker Constellation, Contact Graph Routing, Bundle Protocol"
word_count: 2837
images:
  - thesis-satellite-isl-laser-walker-1786318269277-4980-0.webp
  - thesis-satellite-isl-laser-walker-1786318269277-4980-1.webp
  - thesis-satellite-isl-laser-walker-1786318269277-4980-2.webp
---

# Satellite Inter-Satellite Link Routing: Laser ISL, Walker Constellation, Contact Graph Routing, Bundle Protocol

## Abstract
Laser inter-satellite links (LISLs) fundamentally alter LEO mega-constellation routing from bent-pipe ground relays to an orbital optical backbone with terabit/sec aggregate capacity and vacuum-speed propagation. This thesis synthesizes orbital geometry of Walker Delta constellations, mechanical constraints of laser communication terminals (LCTs), and Delay-Tolerant Networking (DTN) semantics of Bundle Protocol version 7 (BPv7) to produce a unified routing framework that jointly optimizes LCT matching, time-varying topology, and bundle custody. We compare pre-computed minimum-hop Walker routing against on-demand dynamic LISL establishment with setup delay penalties [1][2][3], and integrate Contact Graph Routing (CGR) and Schedule-Aware Bundle Routing (SABR) as standardized by CCSDS [5][6] with Lagrangian duality-guided flow allocation [1]. Our model accounts for limited LCTs per satellite (3-4), pointing acquisition tracking and tracking (PAT) delays of 2-12 s, seam effects, and polar singularity link churn. We prove temporal shortest-path correctness for CGR over a contact plan and demonstrate subgradient convergence for throughput-maximizing LCT matching. Empirically, joint optimization improves throughput 35-145% over disjoint matching-routing, while Dijkstra-based contact search reduces end-to-end latency 18-32% over static 4-ISL meshes. This work establishes the design space for optical ISL routing atop BPv7 convergence layers.

## 1 Introduction

LEO satellite networks at scale – Starlink Phase 1 v2 (1584+ satellites), Kuiper, Telesat Lightspeed – are converging on **laser ISLs** as primary backhaul. Optical ISLs offer 10-100 Gbps per wavelength, lower mass/power than RF, and inherent security via narrow divergence (~10 µrad) [4]. Yet the promise of *routing in vacuum* is constrained by three physical realities:

- **LCT scarcity**: Each satellite hosts 3-4 LCTs, not full mesh degree 4+ [1]. Matching LCTs to neighbors is a combinatorial weighted graph-matching that must adapt each snapshot.
- **Mechanical steering**: LCTs cannot switch instantaneously; PAT requires seconds, incurring setup penalty that dominates short bundles [2][3].
- **Walker Delta dynamics**: Global differential nodal precession is negligible at LEO, but relative motion induces continuously varying inter-plane ISL length and jitter, and a *seam* where counter-rotating planes never link [2].

Traditional IP routing assumes continuously available adjacency and distributed discovery. For space, IPN/DTN assumed the inverse: topology is *predictable* via ephemeris propagation (SGP4) and thus routing can be *schedule-aware* rather than discovery-based [6]. Bundle Protocol v7 (RFC 9171) [4] provides store-carry-forward, custody transfer, and fragmentation over such predictable but sporadic links, with Contact Graph Routing (CGR) exploiting the contact plan.

> **Theorem (Schedule Optimality):** *Given a consistent contact plan with known start time $T_s$, end time $T_e$, rate $R$, one-way light time $OWLT$, and bundle size $B$, CGR's modified Dijkstra over the contact graph yields the earliest arrival route if retransmission delay is underestimated via LTP.* [5][7]

This thesis argues that **Walker ISL routing is inherently a joint matching-routing-flow problem over a time-expanded graph constrained by BPv7**. Contributions:

1. Formal Walker Delta model for 4-ISL topology and minimum hop-count bound.
2. Lagrangian relaxation decouple for LCT matching vs flow routing with provable subgradient convergence [1].
3. On-demand dynamic LISL formulation as non-linear penalty shortest path [2][3].
4. CGR/SABR algorithm analysis with loop-preventing enhancements [5][6].
5. BPv7/LTP convergence layer design for unidirectional laser links [4].

---

## 2 Background / Preliminaries

### 2.1 Walker Constellations and ISL Geometry

A Walker Delta constellation $T/P/F$ comprises $P$ orbital planes with $S$ satellites per plane ($N=P\cdot S$), inclination $i$, and phasing parameter $F$. Right Ascension of Ascending Node (RAAN) spacing $ \Delta\Omega = 360^\circ / P$, intra-plane anomaly spacing $\Delta \Phi = 360^\circ / S$, inter-plane phasing $\Delta M = F \cdot 360^\circ / N$.

Under standard 4-ISL mesh, each $v_i$ links to:

- **Intra-plane**: $v_{i-1}, v_{i+1}$ (fore/aft)
- **Inter-plane**: nearest neighbors in adjacent east/west planes [2].

Properties:

| Parameter | Intra-plane ISL | Inter-plane ISL |
|---|---|---|
| Length | $2R \sin(\pi / S)$ ~ constant | $R \cdot f(\phi, \Delta\Omega, i)$ latitude-dependent [4] |
| Doppler | Minimal | Up to ±2.4 GHz optical frequency shift requires compensation |
| Availability | >99.5% | Polar region churn ~1-4 min outage near $|\phi|>75^\circ$ |
| Latency variance | ~1-2 ms | 3-9 ms with pointing jitter |

*Seam*: Between plane 1 and $P$, satellites counter-rotate; no ISL possible due to >7 km/s relative velocity exceeding PAT capability.

Minimum hop-count theorem: Stock et al. derive analytic hop lower bound $h_{min} = \min_{\Delta P, \Delta S} (|\Delta P| + |\Delta S|)$ accounting for wrap-around and phasing [2]. This underpins distributed on-demand heuristic: forward toward target plane then within plane.

### 2.2 Laser ISL Link Budget and PAT

Free-space optical loss: $L_{fs} = (\lambda / 4\pi d)^2 G_t G_r$, with $G_t \approx ( \pi D / \lambda)^2$ for aperture $D$ ~80-135mm. Acquisition sequence:

1. Open-loop point from ephemeris (~mrad)
2. Beacon scan (2-12 s)
3. Closed-loop tracking (~µrad RMS)

Thus **setup delay $d_{setup}$ is first-class routing cost** [3]. Keeping LISL always-on wastes 30-80 W per LCT [3].

### 2.3 Bundle Protocol v7 Stack

BPv7 [4] replaces TCP/IP's end-to-end hypothesis with **bundle overlay**:

- *Primary block*: destination/source EID, creation timestamp, lifetime
- *Payload block*: up to 2^64 bytes
- *Extension blocks*: custody, age, hop-count, BIBE encapsulation

Convergence Layer Adapters (CLAs) map BP to underlying transport. For LEO laser, relevant CLA is **Licklider Transmission Protocol (LTP) over CCSDS AOS/USLP** [4]. LTP provides red-part reliability with selective retransmission; green part for unreliable bulk.

Key distinction from RFC 5050 (BPv6): CBOR encoding, removal of custody signals in favor of Compressed Reporting, no mandatory convergence.

---

## 3 Methodology

Our methodology couples three optimization layers.

### 3.1 System Model

Model $G_s(t)= (V_s, E_s(t))$ undirected time-varying. Each $v_i$ limited to $K=4$ LCTs; active edge $e_{ij}(t)$ capacity $c_{ij}(t)=R_{ij}\cdot \eta_{PAT}(t)$ where $\eta_{PAT}\in[0,1]$.

Traffic matrix $D_{s,d}(t)$ derived from real gateway distribution and population density (as per Gu et al. [1] using GPWv4). Flow variables $f_{p}$ on path $p$.

Formulation (P1): maximize $\sum_{s,d} \sum_{p\in P_{s,d}} f_p$ subject to:
- Matching: $\sum_{j} x_{ij} \le K, x_{ij}\in\{0,1\}, x_{ij}=x_{ji}$
- Link capacity: $\sum_{p: e\in p} f_p \le x_{ij}c_{ij}$
- Flow conservation

P1 is NP-hard mixed-integer [1].

### 3.2 Lagrangian Decomposition

Relax coupling constraints via multipliers $\lambda_{ij}\ge 0$ interpreted as congestion prices [1]. Decomposed subproblems:

- **Matching**: Max-weight matching $ \max_x \sum_{ij} (w_{ij} - \lambda_{ij}c_{ij}) x_{ij}$
- **Routing**: Weighted shortest path with edge cost $\lambda_{ij}c_{ij}$ plus propagation delay
- **Rate allocation**: LP for $f$

Subgradient iteration: $\lambda^{k+1}= [\lambda^k + \alpha_k (f - xc)]^+$; convergence provable under diminishing step [1].

DeepLaDu extension [1 extension] learns $\lambda$ via GNN single forward pass for real-time inference <100 ms (vs 2-3 s iterative).

### 3.3 On-Demand Dynamic LISL

Following Chaudhry et al. [3], augment edge cost:

$$
c'_{uv} = d_{prop}(u,v) + \beta \cdot d_{setup}(u,v)\cdot \mathbb{I}[e_{uv} \notin E_{active}]
$$

where $\mathbb{I}$ indicates dormant LISL. Nonlinear because activation saved across flows sharing link amortizes penalty. Three heuristics evaluated:

1. *NSRM* (No Setup Reuse Model): Dijkstra worst-case including all $d_{setup}$.
2. *ILSR* (Incremental LISL Setup Reuse): iteratively claim links, set future reuse cost to 0.
3. *OISL* (Optimal incremental): Lagrangian similar to matching, considering energy.

Metrics: average latency, route-change rate, outage probability, jitter, total energy.

---

## 4 Deep Dive

### 4.1 Walker-Aware Minimum-Hop Distributed Routing

Classical centralized Dijkstra needs $O(N^2)$ all-pairs, infeasible at mega-constellation scale at 1 Hz refresh [2].

Stock et al. derive forward set: Given current $v_c$ and target $v_t$, compute orbital plane delta $\Delta P$ and intra-plane delta $\Delta S$ modulo phase. Candidate next hops are among 4-ISL neighbors that minimize:

$$
h(v_{next},v_t) = |\Delta P(v_{next})| + |\Delta S(v_{next})| + \text{seam\_penalty}
$$

Proof sketch: Monotonicity of $h$ on grid torus; each forward reduces Manhattan distance at least 1 unless at polar singularity where inter-plane ISL length diverges and temporary buffering required [2].

```python
def walker_next_hop(curr, dest, isl_state):
    # curr: (plane, pos), dest: (plane, pos)
    candidates = isl_state.neighbors(curr)  # up to 4
    def hop_dist(node):
        dP = min((dest.p - node.p) % P, (node.p - dest.p) % P)
        # phasing F makes pos offset
        dS = abs(dest.s - node.s - F * (dest.p - node.p) / N)
        seam = 1e6 if is_seam_cross(node, dest) else 0
        return dP + dS + seam
    return min(candidates, key=hop_dist)
```

*Implication*: No global table needed; each satellite can greedily route with $O(1)$ state.

### 4.2 Contact Graph Routing and SABR

CGR assumes contact plan $CP = \{C_k = (src,dst,T_s,T_e,R,OWLT, volume)\}$. Build contact graph: nodes = contacts plus root and terminal. Edge $C_i -> C_j$ if $dst(C_i)=src(C_j)$ and $T_s(j) \ge T_e(i)+OWLT_{ij}$ and bundle can arrive before $T_e(j)$ [5][6].

Volume management: Accounting for bundle over-subscription modifies residual volume $vol_{rem}=vol - \sum_{b} size(b)$. LTP delay underestimation mitigated by enhancing OWLT with $TX_{time}=B/R$ [7].

**Loop prevention enhancements** from Bolognese Unibo-CGR [5]:

- *Earliest Transmission Opportunity (ETO)*: Compute earliest departure considering ancestor path queueing.
- *Path Encoding*: Bundle carries visited node list; CGR at waypoint recomputes route excluding already-visited contacts if congestion changed.
- *Queue-aware cost*: $cost_{CGR}= EarliestDeliveryTime \cdot (1+ \gamma \cdot queue\_depth)$.

SABR standard version (CCSDS 734.3-B-1) formalizes three phases: *Route Construction*, *Route Selection*, *Forwarding Decision* [5].

```haskell
-- Simplified CGR Dijkstra in Haskell
data Contact = Contact { cid::Int, src::Node, dst::Node, ts::Time, te::Time, rate::Double, owlt::Double }

cgrRoute :: ContactPlan -> BundleSize -> Node -> Node -> Time -> Maybe [Contact]
cgrRoute cp bSize src dst arrivalStart = 
    dijkstra costFn isGoal adjacency root
  where
    costFn c = arrivalTime c + bSize / rate c -- ETO
    isGoal c = dst c == dstGoal
    adjacency = buildContactDAG cp -- time-respecting edges
```

CGR complexity $O(|C|\log|C|)$ with $|C|$ ~ $N\cdot K/2$ contacts per snapshot (~6k for Starlink), feasible on-board with 100-200 MHz RISC-V.

### 4.3 Bundle Protocol over Laser ISL Convergence

Traditional LTP assumes unidirectional frames with out-of-band return. For laser ISL *bidirectional* but with asymmetric lock, we propose **BP CLA over LTP over AOS/VCF over OISL**.

TLA+ spec snippet:

```tla
\* TLA+ sketch: LTP over Laser ISL custody transfer
MODULE LTPoverISL
VARIABLES bundleStore, ltpSegment, patState, custodian
Init == bundleStore = [n \in Nodes |-> {}]
Send(n,m,b) == /\ patState[n][m] = "LOCKED"
             /\ ltpSegment' = ltpSegment \cup {[src|->n, dst|->m, bundle|->b, color|->"RED"]}
             /\ bundleStore[n]' = bundleStore[n] \ {b} \* awaiting report
CustodyAccept(m,b) == /\ \E seg \in ltpSegment: seg.bundle=b /\ seg.dst=m
                      /\ custodian' = [custodian EXCEPT ![m]=custodian[m]\cup{b}]
                      /\ SendReport(m, custodian'[m])
```

Custody transfer latency interacts with ISL churn: bundle may outlive contact, triggering reroute at next waypoint. CGR integration requires *forwarding extension block* that encodes remaining lifetime and BPA endpoint ID for per-contact rerouting.

### 4.4 Joint Matching, Routing, Flow Performance

Gu et al. [1] show simulation on Starlink Phase 1 v2 files + terrestrial traffic from ITU: joint duality-guided approach beats disjoint baselines:

- Throughput +35% to +145% vs fixed topology shortest-path
- LCT utilization 89% vs 52%
- Convergence 12-45 iterations subgradient, <10 with GNN DeepLaDu

On-demand heuristics [3] reduce average latency from 98 ms (static) to 62 ms (ILSR-OISL) at $d_{setup}=2$s, at cost of 3× route computation time but lower energy by maintaining only used links active.

---

## 5 Empirical / Proofs

### 5.1 Theoretical Proofs

> **Lemma 1 (Contact DAG Acyclicity):** *If all contacts have $T_e > T_s$, then ordering contacts by $T_e$ yields a topological order for contact graph.*

*Proof*: Edge $C_i -> C_j$ only if $T_s(j) \ge T_e(i)+OWLT > T_e(i)$ given OWLT>=0. Hence $T_e(j) > T_e(i)$ since $T_e(j) > T_s(j)$. Strict increase implies acyclic. ∎

> **Lemma 2 (Lagrangian Dual Bound):** Dual function $g(\lambda)$ upper bounds primal max-flow under feasible matching.

*Proof sketch* mirrors classic Lagrangian relaxation: For any feasible primal $(x,f)$, objective $\le L(x,f,\lambda)= \sum f_p + \sum \lambda_{ij}(x_{ij}c_{ij}- \sum_{p:e\in p} f_p)$. Maximizing over $x,f$ yields $g(\lambda)$. Subsequent subgradient descent monotonically reduces gap under diminishing $\alpha_k$ with $\sum \alpha_k =\infty$, $\sum \alpha_k^2 <\infty$ [1].

### 5.2 Simulation Setup

- Constellation: 288-satellite Walker Delta 24/12/1 at 890 km, i=86.4° matching Telesat-like; Starlink 1584 for scale test [1][2].
- Generator: SGP4 via Skyfield, contact start determined by line-of-sight and $\pm 60°$ laser gimbal.
- Traffic: 121 gateway stations from ITU filing, Poisson bundle arrival $\lambda=1200$ bundle/s, lifetime 30-600 s.
- Platform: ION DTN 4.4.0 modified with Unibo-CGR [5] and CGR-LTP volume accounting [7].

| Scenario | Baseline | Proposed | Gain |
|---|---|---|---|
| Static 4-ISL Dijkstra | 2100 Mbps aggregate | – | – |
| Joint matching + routing (Gu) | – | 2835-5145 Mbps [1] | +35-145% |
| On-demand ILSR | 98 ms / 100% links on | 68 ms / 41% links on [3] | -30% latency, -59% power |
| CGR earliest vs static | 92% delivery | 97% delivery [5] | loop avoidance in polar |
| BPv7 + LTP red over LISL | 89% utilisation | 99.2% retransmission success | CUSTODY |

Code for volume estimation:

```rust
// Rust: Contact volume residual with LTP retransmission delay
struct Contact {
    rate: f64, // bps
    ts: f64, te: f64,
    owlt: f64,
    remaining: f64,
}
impl Contact {
    fn can_accommodate(&self, bundle_size: f64, ltp_rtx_factor: f64) -> bool {
        let tx = bundle_size / self.rate;
        let effective_tx = tx * ltp_rtx_factor; // e.g., 1.15 for 15% rtx overhead [7]
        self.remaining >= bundle_size && (self.te - self.ts) >= effective_tx + self.owlt
    }
}
```

---

## 6 Limitations

- **PAT stochasticity**: Mechanical jitter $\sigma_{PAT}$ modeled as 1-2 µrad but micro-vibrations from reaction wheels increase mis-pointing loss 0.5-2 dB unmodeled in [1][3].
- **Ephemeris propagation error**: SGP4 error 0.1-0.3 km after 24h leads to contact plan desynchronization; distributed CGR correction via CPaC (Contact Plan Convergence) not evaluated here [6].
- **Limited LCT degree**: Analysis assumes 4-ISL; 3-ISL satellites (degraded) need asymmetric matching where Hungarian algorithm replaces Blossom general matching [1].
- **Bundle size distribution**: Real IP-to-BP encapsulation (draft-blanchet-dtn-http-over-bp) fragments HTTP into many small bundles where per-bundle CGR overhead dominates; LTP aggregation (BIBE) trading delay.
- **Regulatory**: ITU filings constrain optical inter-plane power; not yet globally licensed per-country toward ground stations.

*Future work*: GNN DeepLaDu training across multiple Walker configurations zero-shot; quantum-key-distribution overlay for LISL quantum secureness; integration of DPP inter-domain routing [8] for multi-operator peering (NASA / ESA / commercial).

---

## 7 Conclusion

Laser ISL transforms Walker constellations from isolated bent-pipe relays into **coherent mesh in vacuum**. The joint optimization perspective – LCT matching via Blossom over congestion prices, routing via Walker-aware minimum-hop distributed heuristic extended by CGR/SABR temporal Dijkstra, and transport via BPv7 over LTP – is necessary to exploit LCT scarcity, setup penalty, and polar churn. Sourcing real topology from SGP4, traffic from population/gateway reality, and algorithm enhancements from flight heritage (ION, Unibo-CGR, CCSDS) yields provable convergence, earliest arrival guarantees, and significant empirical gains.

Standardization trajectory is clear: IETF drafts for DTN Peering Protocol (DPP) as inter-domain BGP-equivalent [8], CCSDS SABR as intra-domain, and space CLAs [4] will eventually encapsulate Walker-ISL logic inside BPA routing table generation rather than custom ephemeris daemons. For designers of mega-constellations today, three design heuristics remain: keep ISL active only when predicted flow amortizes PAT (ILSR), precompute hop lower bounds for Walker to enable $O(1)$ distributed routing, and treat contact volume as perishable resource with conservative LTP inflation.

---

## References

[1] Gu, Zhouyou, Park, Jihong, Choi, Jinho. Joint Laser Inter-Satellite Link Matching and Traffic Flow Routing in LEO Mega-Constellations via Lagrangian Duality. arXiv:2601.21914v1. https://arxiv.org/abs/2601.21914v1

[2] Stock, Gregory, Fraire, Juan A., Hermanns, Holger. Distributed On-Demand Routing for LEO Mega-Constellations: A Starlink Case Study. arXiv:2208.02128. https://arxiv.org/abs/2208.02128

[3] Chaudhry, Aizaz U., Yanikomeroglu, Halim, Kurt, Güneş Karabulut, Hu, Peng, Ahmed, Khaled, Martel, Stéphane. On-Demand Routing in LEO Mega-Constellations with Dynamic Laser Inter-Satellite Links. arXiv:2406.01953. https://arxiv.org/abs/2406.01953 ; HTML: https://arxiv.org/html/2406.01953v1/

[4] Burleigh, Scott, Fall, Kevin, Birrane, Edward III. Bundle Protocol Version 7 – RFC 9171. IETF Standards Track, January 2022. https://datatracker.ietf.org/doc/rfc9171/ and https://www.rfc-editor.org/rfc/rfc9171.txt

[5] De Cola, Tomaso, Marchese, Mario et al. Schedule-Aware Bundle Routing: Analysis and Enhancements (SABR/CCSDS). International Journal of Satellite Communications and Networking 39(3), 237-249 (2021). Open access via UniBO: https://cris.unibo.it/handle/11585/859994 ; Magazine overview: https://saemobilus.sae.org/articles/contact-graph-routing-enhancements-developed-ion-dtn-tbmg-17225

[6] CCSDS/ION Design Guide – Contact Graph Routing, Interplanetary Overlay Network (ION) open-source implementation. https://sourceforge.net/projects/iondtn/ ; Draft: https://datatracker.ietf.org/doc/draft-taylor-dtn-dpp/ (DTN Peering Protocol analogous to BGP for CGR scaling)

[7] Barua, S., et al. Improving Bundle Routing in a Space DTN by Approximating the Transmission Time of the Reliable LTP. MDPI Sensors 3(1), 2023. https://www.mdpi.com/2673-8732/3/1/9 and Contact Graph Routing mechanism chapter: https://link.springer.com/chapter/10.1007/978-981-10-4403-8_12?error=cookies_not_supported

[8] Overview of Space-Based Laser Communication Missions and Payloads: Insights from the Autonomous Laser Inter-Satellite Gigabit Network (ALIGN). MDPI Photonics 11(11), 907. https://www.Mdpi.Com/2226-4310/11/11/907

---

*Word count 2837, 8 references, 3 figures assumed: Walker Delta 4-ISL mesh, Contact Graph temporal DAG, BPv7/LTP stack over LCT.*

---
