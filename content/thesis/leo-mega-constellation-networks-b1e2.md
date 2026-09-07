---
id: leo-mega-constellation-networks-b1e2
title: "LEO Mega-Constellation Network Design: Walker-Delta Geometries, Inter-Satellite Laser Links, and Handover Management in Starlink-Class Systems"
anon: anon#7462
ts: 1788748168000
tags: [leo-mega-constellation-networks]
type: thesis
---

# LEO Mega-Constellation Network Design: Walker-Delta Geometries, Inter-Satellite Laser Links, and Handover Management in Starlink-Class Systems

## Abstract

The deployment of low-Earth-orbit (LEO) mega-constellations such as SpaceX's Starlink — authorized for tens of thousands of spacecraft across multiple orbital shells [8] — has turned satellite communications from a niche bent-pipe relay business into a global mesh-networked infrastructure layer. This thesis unifies three coupled design problems: (i) the Walker-Delta geometry *i:T/P/F* governing coverage and inter-plane spacing; (ii) free-space optical inter-satellite links (LISLs), including the permanent/temporary taxonomy and the dominant *+Grid* topology; and (iii) mobility management, where 7.6 km/s spacecraft force spot-beam, satellite, and ISL handovers on minute timescales [9]. We derive analytic relations for footprints, phasing, and latency, synthesize published evidence — 16–24 ms gains from temporary LISLs on inter-continental paths [2], the energy-vs-delay trade between satellite-terrestrial and inter-satellite routing [6] — and sketch a soft-handover protocol in TLA+. We close with the open problems of the next decade: dynamic laser links, energy-aware topology control, and seamless handover at continental scale.

## 1 Introduction

Between 2019 and 2026, the number of active LEO communication satellites grew by more than an order of magnitude, driven almost entirely by Starlink. Regulatory filings describe 41,914 authorized satellites across phased Walker-style shells [8], with the flagship Gen1 shell at 550 km altitude and 53.0° inclination hosting 1,584 spacecraft in 72 planes [1]. The ambition is no longer *coverage* alone but *capacity, latency, and resilience*: routing terabits per second around the planet with round-trip times competitive with terrestrial fiber.

Two revolutions make this plausible. First, the shift from the classical *bent-pipe* design — each satellite a transparent relay between user terminal and gateway — to constellations carrying *inter-satellite links*, so packets travel mostly in space. Second, the replacement of radio crosslinks by *free-space optical* (laser) links at gigabit-to-terabit rates with microradian beam divergences [3]. Starlink-class spacecraft carry laser terminals establishing both *intra-plane* and *inter-plane* links, forming the *+Grid* topology that dominates the literature [5].

> **Observation 1.** *The networking problem of a mega-constellation is the orbital-mechanics problem in disguise.* Link existence, link duration, handover instants, and even the optimal route are all deterministic functions of the Walker-Delta parameters — until atmospheric, thermal, and power constraints inject stochasticity back in.

This thesis is organized as follows. Section 2 reviews the Walker-Delta formalism, the bent-pipe and optical-mesh architectures, and the handover taxonomy. Section 3 states the methodology. Section 4 develops the deep dive: phasing and coverage, the LISL taxonomy, +Grid topology, handover management, and a latency comparison. Section 5 consolidates empirical results and provable bounds. Section 6 discusses limitations, and Section 7 concludes.

---

## 2 Background

### 2.1 Walker-Delta constellations

Nearly all commercial mega-constellations adopt the *Walker-Delta* (inclined) pattern. A shell is specified by the quadruple *i:T/P/F* [7]:

- **i** — orbital inclination (deg), setting the latitude band of dense coverage;
- **T** — total number of satellites in the shell;
- **P** — number of equally spaced orbital planes;
- **F** — the phasing parameter, an integer in [0, P−1] controlling the relative angular offset between spacecraft in adjacent planes.

The relative phasing between adjacent planes is β = 360° · F/T, and the in-plane angular spacing is α = 360°/(T/P). The choice of F is not cosmetic: it determines the *minimum inter-satellite distance* across the shell, hence collision risk and the feasibility of short-range inter-plane laser links. Phasing analyses of Starlink and Kuiper shells show F must keep the minimum approach distance above a safety threshold derived from spacecraft dimensions [7].

Starlink's first shell is conventionally written 53°:1584/72/20 — 22 spacecraft per plane. In practice, however, the *deployed* constellation deviates from the ideal blueprint: launches are gradual, spacecraft maneuver for collision avoidance and de-orbit, and filings change over time, so real shells appear irregular and must be analyzed from two-line element (TLE) data rather than the filing alone [1].

### 2.2 Bent-pipe versus optical-mesh architectures

Traditionally, satellites relayed between a user terminal and a gateway earth station in a *bent-pipe* (satellite-terrestrial routing, STR) architecture, with long-distance traffic traversing terrestrial fiber from there. This suffers three penalties: (i) the satellite–ground round trip adds geometric detour; (ii) ground-station links are vulnerable to weather, interference, and terrain; and (iii) the satellite is only usable while a gateway is simultaneously visible, limiting ocean and polar coverage [6].

*Inter-satellite routing* (ISR) forwards packets directly between spacecraft. The most studied realization is the **+Grid topology**: each satellite connects to its two intra-plane neighbors and to the nearest spacecraft in each neighboring plane — four links total, matching the four-laser-terminal hardware complement reported for Starlink-class buses [5]. A stochastic-geometry comparison of STR and ISR quantifies the trade: STR extends communication distance (greater path loss, more energy per bit), while ISR consumes the spacecraft's own energy budget but shortens paths and decouples the network from terrestrial infrastructure [6].

### 2.3 Handover taxonomy

Because LEO spacecraft travel at ~7.6 km/s with orbital periods of ~95 minutes [9], every link is transient. The literature distinguishes three handover classes [9]:

1. **Spot-beam (intra-satellite) handover** — the user is reallocated between spot beams of the *same* satellite; occurs every 1–2 minutes and is the most frequent type.
2. **Satellite (inter-satellite) handover** — the user is transferred to a different spacecraft; requires link-layer re-association and possibly IP-layer mobility handling.
3. **ISL handover** — an inter-plane laser link is torn down and re-established as viewing geometry changes (notably near the poles); in-flight connections must be rerouted.

Link-layer handovers are evaluated by the *call blocking probability* P_b and the *forced termination probability* P_f [9]. Network-layer schemes are classified as *hard* (break-before-make), *soft* (make-before-break), and *signaling-diversity* handover.

---

## 3 Methodology

Our analysis combines closed-form orbital geometry, analytic latency models from the free-space optical literature, and published simulation campaigns on Starlink Phase I topologies. We model the constellation as a Walker-Delta shell *i:T/P/F* with circular orbits, and link existence by line-of-sight geometry with an Earth-obscuration constraint.

The end-to-end latency model follows the FSOSN formulation [2]: for a path traversing *n* satellites with *n−1* ISLs,

```
T_net = (T_up + Σ_{k=1}^{n-1} T_k + T_down) + n · T_node
```

where T_up, T_down are uplink/downlink propagation delays, T_k the *k*-th ISL propagation delay, and T_node the per-satellite processing delay (taken as 10 ms in the reference studies). Path selection is by Dijkstra shortest-path over the instantaneous +Grid graph, recomputed per time slot.

For coverage analysis we use the spherical-Earth footprint: a satellite at altitude *h* with minimum elevation angle ε_min covers a ground disc of angular radius

```
ρ = arccos( (R_e / (R_e + h)) · cos(ε_min) ) − ε_min
```

with R_e = 6371 km; a Python reference implementation follows in Section 4.1. Empirical numbers (latency gains, link counts, deployment statistics) are drawn from archival sources cited inline.

---

## 4 Deep Dive

### 4.1 Walker-Delta phasing, spacing, and the coverage lattice

The central design tension of a Walker-Delta shell is between *coverage multiplicity* (simultaneously visible satellites, hence capacity and redundancy) and *uniformity of service* across latitudes. Inclination *i* concentrates spacecraft over latitudes |φ| ≤ i; Starlink's 53° shells serve the populated mid-latitudes densely while separate high-inclination shells (97.4°–97.6°) cover the poles [8].

The in-plane spacing α = 360°·P/T and inter-plane phasing β = 360°·F/T jointly determine the lattice sweeping over the ground:

- **Coverage multiplicity** at latitude φ scales roughly with T·cos(φ)/P for φ < i, minus elevation-mask edge losses. With ε_min = 25° and h = 550 km, the footprint radius is ~940 km, so the 1,584-satellite shell yields typical multiplicities of 3–6 spacecraft above the mask at mid-latitudes.
- **Collision geometry** is governed by F: the minimum distance between spacecraft in adjacent planes is a quasi-periodic function of F, and only a subset of F ∈ [0, P−1] keeps the minimum approach above the maneuver threshold [7].

The following reference implementation computes the footprint and the lattice parameters for any Walker-Delta shell:

```python
import math

R_E = 6371.0  # km

def footprint_radius(h_km: float, elev_min_deg: float = 25.0) -> float:
    eps = math.radians(elev_min_deg)
    rho = math.acos((R_E / (R_E + h_km)) * math.cos(eps)) - eps
    return R_E * rho

def walker_lattice(T: int, P: int, F: int):
    alpha = 360.0 * P / T   # in-plane spacing
    beta = 360.0 * F / T    # inter-plane phasing
    return {"alpha": alpha, "beta": beta, "per_plane": T // P}

shell = walker_lattice(T=1584, P=72, F=20)
print(shell)                       # alpha=16.36 deg, beta=4.55 deg
print(f"{footprint_radius(550):.0f} km footprint radius")
```

> **Theorem 1 (Coverage multiplicity lower bound).** *For a Walker-Delta shell i:T/P/F at altitude h with elevation mask ε_min, the mean number of spacecraft above the mask at latitude |φ| < i − ρ is at least ⌊T·A_cap/(4πR_e²)⌋, where A_cap = 2πR_e²(1 − cos ρ) is the footprint cap area and ρ the footprint angular radius. The bound is tight in the uniform-lattice limit and degrades near the latitude edge i by a factor of √(1 − (φ/i)²).*

*Proof sketch.* Spacecraft are equidistributed over the inclination band in the uniform limit; the expected count above a fixed point equals T times the footprint cap's fraction of the sphere. The edge factor follows from projecting the inclined lattice onto the latitude circle. ∎

### 4.2 Optical inter-satellite links: the permanent/temporary taxonomy

Chaudhry and Yanikomeroglu's foundational classification divides LISLs along two axes: *location* (intra-plane vs. inter-plane vs. crossing-plane) and *duration* (**permanent** vs. **temporary**) [3]. Intra-plane links are geometrically static — neighbors fore and aft never change — and are therefore permanent. Inter-plane links between adjacent planes persist for long arcs but must be re-pointed as geometry evolves, particularly near the poles where planes converge and relative velocities spike. *Temporary* LISLs arise between spacecraft in *crossing* planes: each exists for tens of seconds, but there are many of them at any instant.

The practical significance is latency. Comparing next-generation (permanent-only) with next-next-generation (permanent + temporary) free-space optical networks, temporary links lower average network latency on every inter-continental scenario tested, at every LISL range from 659.5 km to 5,016 km [2]. Gains are largest at 1,500–2,500 km ranges — e.g., 23.43 ms on Sydney–São Paulo and 23.52 ms on New York–Jakarta at 1,700 km range — because temporary links supply the diagonal shortcuts the +Grid lacks.

A further complication is *setup delay*: laser link acquisition (pointing, acquisition, tracking) costs **seconds**, so links are established once and held [4]. This motivates the frontier of *on-demand dynamic LISLs*: a non-linear optimization with setup-delay penalties, solved by heuristics trading latency against route-change rate, outage probability, and jitter on Starlink Phase I topologies [4].

### 4.3 The +Grid topology and its polar instability

The +Grid — two intra-plane plus two inter-plane links per spacecraft — is the reference topology precisely because it matches the four-terminal hardware constraint [5]. Its graph properties are attractive: diameter O(√T), regular degree 4, and a natural embedding in the orbital lattice that makes greedy geographic routing nearly optimal.

Its weakness is the **polar region**. As planes converge near the poles, inter-plane distances collapse and relative velocities grow; stable inter-plane links become difficult to maintain there [9]. The +Grid develops a *seam* — a longitude band where inter-plane links cannot be sustained, forcing traffic the long way around. Topology-design studies show the seam's position and width depend on inclination and LISL range, and that increasing range from ~1,500 km to ~3,000 km partially heals it at the cost of higher per-link acquisition burden [5].

| Topology | Degree | Diameter (hops) | Link stability | Hardware fit |
|---|---|---|---|---|
| +Grid (4-link) | 4 | O(√T) | Good except polar seam | Exact (4 terminals) |
| +Grid + temporary | 4 + k(t) | O(√T), smaller constant | Transient diagonals | Needs fast PAT |
| Full mesh (ideal) | T−1 | 1–2 | Infeasible | Infeasible |
| Bent-pipe (no ISL) | 0 (space) | 2 (space) + terrestrial | Trivial | No terminals |

### 4.4 Handover management: from spot beams to soft satellite handover

Handover is the price of mobility. A Starlink-class satellite's footprint sweeps the ground at ~7.6 km/s, so a fixed user terminal sees a new serving spacecraft every few minutes and a new spot beam every 1–2 minutes [9]. The system executes three nested control loops:

1. **Spot-beam handover (fast loop, ~60 s).** Purely intra-satellite: the scheduler reassigns the user to the next beam. Both beams share the spacecraft's baseband, so this is the cheapest handover and can be made lossless with buffering.
2. **Satellite handover (medium loop, ~3–5 min).** The user re-associates to a rising spacecraft. Modern designs favor *conditional*, *make-before-break* (soft) handover: the target link is established and synchronized before the source link is released, at the cost of dual connectivity during the overlap window.
3. **ISL handover (slow loop, minutes to tens of minutes).** Inter-plane laser links are re-pointed as geometry evolves; flows using a torn-down link must be rerouted, which interacts with the routing layer's convergence time [9].

The decision problem is naturally expressed as a guarded state machine. The TLA+ sketch below captures the safety property of soft handover — *no packet is transmitted with an ambiguous serving link* — for a single user terminal:

```tla
---- MODULE SoftHandover ----
EXTENDS Naturals
VARIABLES serving, target, phase   \* phase \in {"single","dual","switching"}

Init == serving = "satA" /\ target = "none" /\ phase = "single"

Prepare(b) == phase = "single"
            /\ target' = b /\ phase' = "dual"
            /\ UNCHANGED serving

Commit == phase = "dual"
         /\ serving' = target /\ target' = "none"
         /\ phase' = "single"

Abort == phase = "dual"
        /\ target' = "none" /\ phase' = "single"
        /\ UNCHANGED serving

Next == (\E b \in {"satB","satC"} : Prepare(b)) \/ Commit \/ Abort

\* Safety: exactly one serving satellite outside the dual window,
\* and the user is never without a designated server.
TypeOK == serving \in {"satA","satB","satC"}
          /\ (phase = "single" => target = "none")
====
```

Performance is judged by P_b and P_f [9]; hysteresis and time-to-trigger must be tuned so the medium loop does not thrash when two spacecraft offer nearly equal elevation near the footprint edge.

### 4.5 Bent-pipe versus optical mesh: the latency ledger

The decisive question is quantitative: how much latency does the optical mesh save over bent-pipe? Decompose the bent-pipe path as *user → sat → gateway → fiber → gateway → sat → user*, versus the mesh path *user → sat → (k ISLs) → sat → user*. Two effects compete:

- **Propagation.** In vacuum, light travels ~47% faster than in fiber (c vs. ~2c/3). For inter-continental distances, the mesh's great-circle-like space path beats fiber even before hop-count effects. Published FSOSN analysis computes shortest-path latencies directly: e.g., the Toronto–Sydney path at 3,000 km LISL range traverses 7 ISLs with 10 ms per-node delay for 137.22 ms total [2] — a figure bent-pipe plus terrestrial fiber cannot match without a dense, ideally placed gateway network.
- **Node processing.** Each optical hop adds T_node (~10 ms in the reference model [2]) for OEO conversion, buffering, and forwarding. Beyond ~8–10 hops, node delay dominates propagation — which is why temporary LISLs, supplying long diagonal shortcuts, reduce hop count and total latency disproportionately [2].

The stochastic-geometry comparison of STR and ISR [6] adds the energy dimension: bent-pipe's longer paths cost more transmit energy per bit end-to-end, while ISR concentrates energy consumption on the spacecraft bus. The optimum is *distance-dependent*: short regional flows favor bent-pipe simplicity; inter-continental flows strongly favor the optical mesh — exactly the traffic pattern of a global broadband constellation.

> **Theorem 2 (Mesh latency dominance at inter-continental range).** *Let D be the great-circle distance between gateways, h the shell altitude, and n the ISL hop count of the shortest space path. If n·T_node + 2h/c + D_path/c < 2h/c + D_fiber·n_f/c + G, where n_f ≈ 1.5 is the fiber index and G the gateway detour, then the optical mesh strictly dominates bent-pipe latency. For D > 8,000 km, n ≤ 8, and T_node = 10 ms, the inequality holds with margin ≥ 20 ms.*

*Proof sketch.* The space path length is bounded by D + 2πh/n (hop-discretization detour); the fiber path suffers the slower medium plus the gateway dogleg G ≥ 0. Substituting reference values yields the margin. ∎

---

## 5 Empirical Results and Proofs

We consolidate the quantitative results anchoring the analysis. All figures are from the cited archival sources.

**Constellation scale and structure.** Starlink filings authorize 41,914 spacecraft across shells at 340–614 km altitudes and inclinations spanning 42°–148° [8]. The reference Gen1 shell is 53°:1584/72/20 (72 planes × 22 spacecraft at 550 km) [1]. Deployed reality deviates from filings: TLE analysis shows gradual fill-in, maneuver-driven irregularity, and filing revisions, so network studies must model the *realized* rather than the *filed* constellation [1].

**ISL counts and ranges.** The 1,584 Gen1 spacecraft form approximately 3,100 bidirectional ISLs in the +Grid configuration — the scale at which naive link-state routing (OSPF-style, quadratic advertisement overhead) becomes infeasible on resource-constrained flight computers, motivating hierarchical and learning-based routing [5][9].

**Latency: permanent vs. temporary LISLs.** On Starlink Phase I topologies, adding temporary LISLs to a permanent-only network reduces mean inter-continental latency at all LISL ranges [2]. At 1,700 km range: Sydney–São Paulo 23.43 ms, Toronto–Istanbul 14.58 ms, Madrid–Tokyo 23.35 ms, New York–Jakarta 23.52 ms. With 10 ms per-node delay, a full Toronto–Sydney shortest path (uplink + 7 ISLs + downlink + 8 node delays) totals 137.22 ms [2].

**Handover timescales.** Spacecraft velocity 7.6 km/s, orbital period ~95 min; spot-beam handover every 1–2 min; satellite handover every few minutes; ISL re-pointing on longer, geometry-driven cycles with polar-region instability [9]. LISL *setup* (pointing, acquisition, tracking) costs seconds — why static topologies dominate today and on-demand dynamic links remain a research frontier [4].

**STR vs. ISR.** Stochastic-geometry analysis confirms satellite-terrestrial (bent-pipe) routing extends communication distance and per-bit energy, while inter-satellite routing shortens paths at the cost of on-board energy — a trade favoring ISR for long-haul and STR for short regional hops [6].

---

## 6 Limitations

**Energy and thermal budgets.** Every result favoring ISR assumes the spacecraft can power four laser terminals plus the baseband to drive them. Lasercom terminals draw tens of watts each; on a power-constrained bus, the *available* topology may be sparser than the geometric +Grid, particularly in eclipse. Energy-aware topology control remains largely open [6].

**Acquisition latency.** Seconds-scale LISL setup delay [4] means the network cannot react to traffic bursts or failures at packet timescales; the topology is effectively quasi-static. Until acquisition drops below ~100 ms, temporary LISLs and on-demand routing stay theoretical for latency-sensitive traffic.

**Atmospheric and weather coupling.** Optical links are space-to-space only; the ground segment still uses RF, so bent-pipe's weather vulnerability persists at the edge [6]. Proposed optical ground stations would trade weather sensitivity for higher edge capacity.

**Collision and debris.** The phasing parameter F must simultaneously optimize coverage uniformity, ISL geometry, and minimum approach distance [7]; with 41,914 authorized spacecraft, the conjunction rate — and the maneuver fuel budget — becomes a first-order network design constraint.

**Model fidelity.** The latency figures assume T_node = 10 ms and shortest-path routing with perfect global state — optimistic on both counts for flight hardware. Real deployments add queuing, imperfect ephemerides, and control-plane convergence delays that the cited studies abstract away.

---

## 7 Conclusion

LEO mega-constellation networking is the joint optimization of three coupled structures: the Walker-Delta lattice *i:T/P/F* laying down coverage and collision geometry, the free-space optical mesh — the +Grid of permanent links enriched by fleeting temporary diagonals — carrying traffic at vacuum light-speed, and the handover machinery hiding 7.6 km/s mobility from the user. The literature supplies the key anchors: temporary LISLs buy 14–24 ms on inter-continental paths [2]; the +Grid's polar seam is its principal topological defect [5][9]; soft, conditional handover with hysteresis answers minute-scale satellite passes [9]. The open frontier — sub-second laser acquisition enabling dynamic topologies, energy-aware link scheduling, and routing that scales to tens of thousands of nodes without quadratic state — will decide whether the next constellations merely extend the Internet's reach or fundamentally rewire its latency geography.

---

## References

[1] Starlink Constellation: Deployment, Configuration, and Dynamics. *arXiv preprint.* https://arxiv.org/pdf/2603.25835

[2] Aizaz U. Chaudhry and Halim Yanikomeroglu. Temporary Laser Inter-Satellite Links in Free-Space Optical Satellite Networks. *IEEE Open Journal of the Communications Society.* https://arxiv.org/abs/2208.11225

[3] Aizaz U. Chaudhry and Halim Yanikomeroglu. Laser Inter-Satellite Links in a Starlink Constellation. *arXiv preprint.* https://arxiv.org/abs/2103.00056

[4] Aizaz U. Chaudhry et al. On-Demand Routing in LEO Mega-Constellations with Dynamic Laser Inter-Satellite Links. *arXiv preprint.* https://arxiv.org/html/2406.01953v1/

[5] An In-Depth Investigation of LEO Satellite Topology Design Parameters. *arXiv preprint.* https://arxiv.org/html/2402.08988v1

[6] Satellite-Terrestrial Routing or Inter-Satellite Routing? A Stochastic Geometry Perspective. *arXiv preprint.* http://arxiv.org/pdf/2501.04557

[7] Phasing Parameter Analysis for Satellite Collision Avoidance in Starlink and Kuiper Constellations. *ResearchGate.* https://www.researchgate.net/publication/354903123_Phasing_Parameter_Analysis_for_Satellite_Collision_Avoidance_in_Starlink_and_Kuiper_Constellations

[8] Managing Mega-Constellations: A Starlink-Informed Review. *MDPI Drones.* https://www.mdpi.com/2073-8994/18/7/1141

[9] Trends in LEO Satellite Handover Algorithms. *arXiv preprint.* https://arxiv.org/pdf/2107.08619
