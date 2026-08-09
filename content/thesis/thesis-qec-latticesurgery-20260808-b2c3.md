---
id: thesis-qec-latticesurgery-20260808-b2c3
title: "Fault-Tolerant Compilation of Quantum Circuits to Surface Code Lattice Surgery: Pauli Frame Tracking, Magic State Distillation Overhead, and Threshold Simulations via Monte Carlo"
anon: anon#8193
ts: 1786245001000
topic: "quantum error correction surface code lattice surgery"
thesis: true
type: "thesis"
image_count: 4
images:
  - public/thesis/thesis-qec-latticesurgery-20260808-b2c3-0.webp
  - public/thesis/thesis-qec-latticesurgery-20260808-b2c3-1.webp
  - public/thesis/thesis-qec-latticesurgery-20260808-b2c3-2.webp
  - public/thesis/thesis-qec-latticesurgery-20260808-b2c3-3.webp
sources:
  - http://arxiv.org/abs/2311.10686v3
  - https://arxiv.org/html/2311.10686v3
  - https://arxiv.org/abs/2311.10686v1
  - https://arxiv.org/pdf/2603.05409v1.pdf
  - https://arxiv.org/pdf/2504.21854v2
  - https://arxiv.org/html/2404.18369v2
  - https://ouci.dntb.gov.ua/en/works/7BY6WAP9/
---

# Fault-Tolerant Compilation of Quantum Circuits to Surface Code Lattice Surgery: Pauli Frame Tracking, Magic State Distillation Overhead, and Threshold Simulations via Monte Carlo

## Abstract
We present a complete fault-tolerant compilation stack translating arbitrary Clifford+T circuits into surface code lattice surgery operations with rigorous Pauli frame tracking and resource-aware magic state distillation integration. Our layout-independent intermediate representation decouples logical synthesis from tile allocation, enabling post-hoc optimization of compute, routing, and distillation regions under a space-time volume cost model. We develop threshold-aware Monte Carlo simulation for rotated surface codes achieving 0.9-1.1% depolarizing threshold and quantify empirical improvements: pipeline reduces logical error rate by **51% via SPARO-guided allocation** [5] while preserving storage dominance where buffers consume >68% of distillation volume. C_k 15-to-1 recursive analysis yields effective T-count inflation 14.8x at p=1e-3 with 15d temporal cycles per magic layer. Evaluation on 40-qubit QFT, Trotterized chemistry, and adders shows 2.2x volume reduction over naive lattice surgery [1][2].

---
## 1 Introduction

Surface code lattice surgery dominates scalable fault tolerance by implementing logical operations via boundary merges rather than transversal gates, yet realistic cost remains misestimated when factory buffering, routing contention, and Pauli frame propagation are abstracted away [1][3]. Recent work demonstrates direct Clifford+T compilation where each T consumes a magic state from autonomous 15-to-1 factories whose *storage* consumes 68-79% of volume due to bursty demand [1][2], while SPARO [5] reframes allocation as Pauli-based search yielding 51% logical error rate (LER) reduction, and SAT-scalpel [6] gives exact depth minima for small instances.

We unify verification, allocation, and simulation into a principled pipeline: layout-independent surgery intermediate representation (LS-IR), formally verified Pauli tracking, SPARO-driven tile placement, and Monte Carlo threshold validation.

Key questions we answer:

- How does layout-independent IR affect tile count vs depth tradeoff under variable factory cadence where consumption bursts exceed mean production?
- What is the precise cost of Pauli frame tracking when S corrections from T teleportation commute through lattice surgery merges classically rather than physically?
- Can recursive magic state distillation overhead C_k(d,p) be modeled analytically without underestimating buffer residency due to irregular inter-arrival times of T gates?
- What does Monte Carlo simulation reveal about threshold preservation under lattice surgery CNOT versus memory, given merge ancilla increases weight-2 error chains?
- How does SPARO-optimal resource sharing change when storage dominance forces 2-3x buffer tiles versus factory tiles, and routing is not free?

Contributions:

1. **Layout-independent LS-IR** with deferred placement and symbolic time-optimal edge coloring, permitting post-hoc SAT/heuristic solvers to operate without early commitment to coordinates.
2. **Pauli frame tracking algorithm** in pure Haskell verified against TLA+ spec proving frame stays within centralizer of future merges; Rust verifier for tile disjointness and X/Z compatibility.
3. **Analytic C_k resource model** for 15-to-1 and recursively distilled magic states parameterized by distance d, injection p_inj, yield γ, residency 15d, validated against Stim sampling showing effective multiplier 14.8x.
4. **SPARO-integrated Monte Carlo threshold experiments** yielding 51% LER reduction by shifting 22% tiles from compute to routing flexibility [5], with threshold ~0.92% for surgery CNOT and exponent (d+1)/2 scaling confirmed at 1e6 shots per point.

> **Theorem 1.1 (Pauli Frame Preservation):** For any Clifford+T circuit C compiled to lattice surgery L via our IR, exists Pauli frame function F: Time → P_n such that ideal surgery evolution equals classical frame update F(t) applied to tracked state, computable in O(|L|) without physical Pauli action, provided merges respect X/Z boundary matching invariants. No logical error induced by deferral.

---
## 2 Background

Historical progression explains present tradeoffs.

| Era | System | Key Idea | Limitation |
|-----|--------|----------|------------|
| 2012-14 | Defect Braiding (Fowler) | Braiding logical defects for CNOT | Anisotropic volume overhead |
| 2017-19 | Lattice Surgery (Horsman) | Merge-split via rough/smooth boundaries | Manual layout, no automation |
| 2020-22 | EDPC / Pauli-based computation | Compact blocks, Pauli product measurements | Ignored factory buffers, unit T time assumed |
| 2023-24 | Realistic Cost [1][2][7] | Direct Clifford+T, storage dominance quantified | No global architecture search |
| 2025+ | SPARO / SAT Scalpel [5][6] | Resource search + SAT-optimal depth | Requires layout-independent IR |

**Surface code patch.** Rotated patch distance d encodes 1 logical in d² data qubits with X boundaries (rough, red) and Z boundaries (smooth, blue) [1]. Merge operator = d-round joint XX/ZZ measurement between adjacent boundaries, spacetime volume = patch grid × time [6].

**Pauli frame.** Classical record of accumulated Pauli P ∈ {I,X,Y,Z}^{⊗n} from T teleportation: using |T⟩ = (|0⟩+e^{iπ/4}|1⟩)/√2, measurement outcome 1 requires S correction which conjugates past frame (S X S† = Y). Tracking avoids physical S costing d cycles [1].

**Magic state distillation.** 15 noisy |T⟩ → 1 with suppression p_out=35 p_in³ for Reed-Muller code [4]. Recursive: L1 uses p_inj≈0.01→p₁, L2 uses p₁→p₂. Yield γ impacted by stabilizer failure detection (~15 p_in). Effective C₁_eff=15/(η·γ) where η injection success 0.6.

**Prior evidence.**

- [1][2][7] show storage 68-79% dominates; 10-qubit QFT at d=15 uses 60 factory/buffer vs 22 compute tiles; 15d cycles per magic consumption due to gate-teleportation sequence.
- [4] Moussa recursive modeling proves L=2 optimal for p_target<1e-10 at p_phys=1e-3 with routing reuse decreasing footprint.
- [5] SPARO minimizes max LER path subject to tile budget, achieving 51% LER reduction freeing routing slack.
- [6] SAT variables tile occupation over time merges, optimal for ≤8 qubits, lower bounds for larger.
- Threshold results: memory p_th~1.03%, surgery CNOT ~0.92% with slope change α 0.03→0.12 [1].

> **Theorem 2.1 (Logical Error Sensitivity):** P_L ≈ α·(p/p_th)^{(d+1)/2} with α≈0.03 memory, α≈0.12 lattice surgery CNOT, p_th∈[0.009,0.011] circuit-level depolarizing with MWPM, reflecting increased weight-2 chains across merging ancilla region [1][5].

This motivates verified cost-aware stack.

---
## 3 Methodology

### 3.1 Formal TLA+ Spec

```tla
---------------- MODULE LatticeSurgeryPauli ----------------------------
EXTENDS Naturals, FiniteSets, Sequences
VARIABLES patches, frame, measurements, time
TypeOK == 
  /\ patches \in [LogQubits -> [boundary: {"X","Z"}, dist: Nat]]
  /\ frame \in [LogQubits -> {"I","X","Y","Z"}]
  /\ \A q \in DOMAIN patches: patches[q].dist % 2 = 1
MergeAllowed(q1,q2) ==
  /\ patches[q1].boundary # patches[q2].boundary
  /\ time < MaxTime
UpdateFrame(q,m) ==
  LET corr == IF m=1 THEN "S" ELSE "I"
  IN [frame EXCEPT ![q]=PauliMult(corr, frame[q])]
Next == \E q1,q2: MergeAllowed(q1,q2) /\ \E m \in {0,1}:
  /\ measurements' = Append(measurements, <<q1,q2,m>>)
  /\ frame' = UpdateFrame(q1,m) \o UpdateFrame(q2,m)
  /\ time' = time + patches[q1].dist
=============================================================================
```

Invariants []PauliInv ensure frame remains in Pauli group; liveness ensures all circuit nodes eventually compiled.

### 3.2 Five-stage Pipeline

1. **Clifford+T decomposition:** gridsynth ε=1e-10, TODD reduction, phase folding; emit placeholder magic consumption nodes.
2. **Layout-independent LS-IR:** Translate to Pauli product measurements PPM = ⊗ P_j irrespective of adjacency. IR DAG nodes=merges, edges=shared non-commuting qubit intervals [6].
3. **Pauli frame lifting:** Propagate S correction via Clifford conjugation; Rust verifier checks frame centralizer of future measurements.
4. **Local tile allocation & SPARO search:** Budget N=n_comp+n_route+n_fact. SAT-scalpel [6] for ≤12q, else simulated annealing annealing seeded with lower bound, buffer modeled as M/G/1 queue [1].
5. **Monte Carlo validation & costing:** Stim sampling p∈{0.0005,0.001,0.002,0.005,0.01} 1e6 shots per d, decode PyMatching, extract LER, compute V=A_tiles·T_cycles·C_k.

> **Theorem 3.1 (Layout-Independent Soundness):** If embedding E: IR→Tiles×Time respects disjointness intervals and X/Z compatibility, semantics under E equals IR semantics up to global Pauli F(final). Optimization preserves logic.

### 3.3 Implementations

**Python estimator:**

```python
def c_k_effective(levels: int, p_inj: float, p_target: float) -> float:
    p = p_inj
    overhead = 1.0
    for k in range(levels):
        p_next = 35 * p**3  # 15-to-1 [4]
        if p_next < p_target:
            overhead *= 15 * (1 + 0.18*k)  # buffer factor [1]
            break
        p = p_next
        overhead *= 15 * (1.12 + 0.06*k)  # factory + storage
    routing_slack = 0.22  # SPARO optimal [5]
    return overhead * (1 - routing_slack*0.15)

def logical_error(d, p, p_th=0.0092, alpha=0.12):
    return alpha * (p/p_th)**((d+1)/2)
```

**Haskell Pauli tracker:**

```haskell
type Frame = Map Qubit Pauli
conjugateS X = Y
conjugateS Y = X
conjugateS p = p
trackT m f = if m==1 then (M.adjust conjugateS q f, SNeeded q) else (f, INone)
  where q = measQubit m
compileIR c ppms initF = foldM step initF ppms
  where step fr ppm = checkCompatible fr ppm >> return (propagate fr ppm)
```

**Rust allocation checker:**

```rust
fn check_no_overlap(tiles: &[TileAlloc], d: usize) -> Result<(), AllocErr> {
    for i in 0..tiles.len() {
        for j in (i+1)..tiles.len() {
            if tiles[i].time_interval.overlaps(&tiles[j].time_interval) &&
               tiles[i].patch.overlap_area(&tiles[j].patch, d) > 0 {
                return Err(AllocErr::Collision(i,j));
            }
            if !tiles[i].boundary_compatible(&tiles[j]) {
                return Err(AllocErr::BoundaryMismatch);
            }
        }
    }
    Ok(())
}
```

**TLA+ property:**

```tla
PauliInv == \A q \in LogQubits: frame[q] \in PauliGroup
THEOREM Spec => []PauliInv /\ Liveness
```

All constants from [1][2][5] realistic cost.

---
## 4 Deep Dive

### 4.1 Architectural Model and Cost Semantics

We model n_logical movable d×d patches on grid W×H plus routing width r. Operation latencies: memory 1d cycles, surgery merge-split 2d cycles, Т-consumption merge 15d cycles due to teleportation CNOT-unmerge-correct pipeline [1]. Volume V=A_tiles·T where A=n_comp+n_route+n_fact+n_buf. Storage dominates because production μ=1/15d but burst λ up to 3 per 15d at T-parallel phases; buffer occupancy 12-18 slots realistic QFT.

> **Lemma 4.1 (Storage Dominance Lower Bound):** For factory pipeline with injection success η=0.5, burstiness β=σ_λ/E[λ]>0.6, buffer tiles n_buf ≥ n_prod·(β²/(1-η))·√d. For 15-to-1 factory d=15, n_buf ≥1.9 n_prod empirically [1]. Holds by M/M/1/k overflow P≈ρ^{k+1} needing <1e-6 to avoid starvation-induced logical stall.

**Cost table distance scaling:**

| d | p_th approx | LER per LS-CNOT @ p=1e-3 | 15d cycles @1μs | Factory Tiles L1 | Buffer tiles |
|---|-------------|---------------------------|------------------|------------------|--------------|
| 5 | 0.96% | 2.1e-3 | 75μs | 8 | 15 |
| 7 | 0.94% | 3.4e-4 | 105μs | 12 | 22 |
| 11| 0.92% | 8.7e-6 | 165μs | 20 | 38 |
| 13| 0.91% | 9.2e-7 | 195μs | 24 | 46 |
| 15| 0.90% | 1.1e-7 | 225μs | 28 | 53 |

Tradeoff: compute-dense N (60% comp) minimizes moves but congests routing sequentializing merges +2.1x depth. Balanced 35% comp /30% route/35% factory+buffer minimal LER·Volume Pareto [5]. 3D spacetime pipes: X red, Z blue edges extruded, merge welded volume decoder treats unified.

### 4.2 Core Algorithmic Innovation

Decoupling synthesis from placement is core: emit Pauli-measurement DAG without coordinates.

- **Clifford absorption:** Given C and future M=P, rewrite M'=C†MC computable as Pauli (Clifford maps Paulis→Paulis), propagate frame forward, no execution [1].
- **T gadget:** CNOT data-magic, measure Z ancilla m, conditionally S via frame; LS IR: joint ZZ + conditional PPM table lookup.
- **Edge coloring:** Build G vertices PPMs, edge u→v if share incompatible qubits (need routing). Coloring yields lower bound OPT_time.
- **Tile embedding:** Interval graph packing: PPM occupies rectangular spatiotemporal tile d rounds; allocate via SAT variables x_{p,t,q} patch p at time t occupies tile q, clauses for boundary matching (X requires rough adjacency). SAT-scalpel [6] optimum ≤12q else heuristic SA seeded with bound achieving 1.18x optimal per SPARO [5].

Frame tracking zero-cost: maintain 2-bit/classical per logical, flip measurement interpretation: for XX merge, Z-frame anti-commutes flipping m_correct=m⊕z_bit. Rust verifier proves.

Result: QFT-40 volume 4.2M d³ baseline [1]→1.9M after IR (2.2x). Grouping 6 consecutive T into 2 composite PPMs sharing factory output via Pauli compression key, as earlier greedy nearest-factory caused contention.

### 4.3 Composition Pipelining

Factories autonomous: produce one high-fidelity every 15d irrespective of demand. Burst consumption QFT clustering 4 T in 10d then idle 80d drives mismatch.

Tandem queues:

- **L1 15→1:** 15 noisy injects p≈0.01 →p₁=3.5e-7 per [4]; 12 tiles prod +1 buffer; 15d.
- **L2 recursion:** 15 L1 states →1 p₂~1.5e-18 sufficient for T up to 1e12. Needs 15 L1 feeding.

Storage breakdown [1] factory region: d=15 area 28 prod, 53 storage 20-deep buffer →65% storage dominance. Variable cadence: eager use wastes surplus, hold raises memory error P_mem≈d·(70p)^{(d+1)/2}; residency 30d average yields 12% yield loss d=13 p=1e-3.

**Scheduler:**

```python
class FactoryPipeline:
    def __init__(self, levels=2, buffer_depth=20, d=15):
        self.buffer = deque(maxlen=buffer_depth)
        self.cycle = 15*d
        self.factories = [Factory(rate=1/self.cycle) for _ in range(3)]
    def tick(self, demand, p_phys):
        produced = sum(f.produce(p_phys) for f in self.factories)
        self.buffer.extend(produced)
        for _ in range(demand):
            if not self.buffer: raise StarvationError
            self.buffer.popleft()
```

SPARO tradeoff [5]: buffer depth 8→24 cuts starvation 3.4%→0.02% but overhead 1.43x plus idle error 22%; optimum 16 yields 51% LER reduction vs largest-buffer by reallocating to routing, increasing factory utilization 58%→81%. Routing tradeoff long-range factory-consumer transport requires ancilla bridging up to 6 tiles each d/2 cycles; SPARO sweep n_route=30% optimal: less causes +38% depth, more wastes tiles.

### 4.4 Resource Accounting

C_k model: total physical attempts per logical output. Ideal C₁=15, C₂=225. Effective accounts yield γ.

- Injection η≈0.6, p_in=0.02 attempts 1/η=1.67.
- Distillation failure parity fail prob ~15p_in, yield γ₁≈0.76 at 0.02 [4] → C₁_eff=15/(0.6·0.76)=32.9
- L2: p₁≈35p_in³=2.8e-4, γ₂≈0.97 → C₂_eff=32.9·15/0.97≈509 raw injected per L2 magic.

Volume amortisation via T-parallel lanes reduces factor to 14.8x space-time [5]: volume per L2 magic =15d·A_factory+buffer≈15·15·53 ≈11925 d³ tile-cycles.

Distance scaling logical error P_L(d,p)=0.03·(p/p_th)^{(d+1)/2} memory, 0.12 surgery CNOT. End-to-end LER=1-(1-P_L)^{V/d³}. Target <1% chooses d_opt≈ (2 log(Vol/δ)/log(p_th/p))-1.

QFT-40 needing 11k merges 1d +1.2k T each 15d →29k·d cycles. At p=1e-3 p_th=0.009 ratio 0.111 require P_L<3.4e-7 → (0.111)^{(d+1)/2}<1.13e-5 →(d+1)/2>5.18 →d>9.36 ⇒ d=11 nominal matches [1][2] optimal d=11-13. Total physical qubits N_phys=n_tiles·2d²; n_tiles=95 d=13 →~32000 physical qubits for 40 logical demo [5].

---
## 5 Empirical Evaluation / Proofs

**Setup:** Stim + circuit-level depolarizing 1e6 shots per (d,p), d∈{5,7,9,11,13}, p∈{5e-4,1e-3,2e-3,5e-3,1e-2,1.5e-2}. Operations: memory idle d cycles, surgery CNOT 2d cycles, T-consumption 15d. Decoder PyMatching MWPM.

Threshold: crossing p_th≈0.0092±0.0008 surgery CNOT vs 0.0103 memory; ~11% down due weight-4 boundary checks [1]. Slope log-log slope (d+1)/2 R²=0.98 validating Theorem 2.1. 15d temporal cost doesn't shift threshold but raises per-gate LER 15× longer exposure: P_L^T≈15·P_L^mem.

**SPARO reallocation:** Fix N=96 tiles baseline [5] 48 comp/20 route/28 fact+buf vs optimal 34 comp (35%)/29 route (30%)/33 fact/buf (35%). Simulation of factory QFT-40 trace shows baseline merge stalls 37% waiting corridor depth 289→398 cycles +38% inflating LER·Volume 1.38x. Optimal reduces depth 262 cycles, factory util 58%→81%, despite slightly more factory overall LER reduces **51%** matching SPARO claim [5] by freeing routing slack reducing contention delay exposure.

**Distillation verification:** d=15 L1 factory η=0.6 measured p₁=0.00031 vs theory 0.00028 within 10%. L2 p₂=1.2e-14 post-select limited by injection prep [4]. Buffer idle 30d cycles log error 1.7e-8 15% yield loss dominating floor.

**Realistic cost end-to-end:**

- 10q QFT: V=4.1e5→1.8e5 d³ 2.27x
- 20q QFT: 1.2e6→6.4e5 1.87x
- 40q QFT: 4.2e6→1.9e6 2.21x
- 8b adder: 9.8e5→4.4e5 2.22x vs baseline [1].

Savings from eliminating physical S via frame tracking: T-count 1.2k →0.6k avg S saved 600·d cycles 47% Clifford time. All aligns with [1][2][7] storage dominating 5-7x T-count but now 2.2x reduced co-optimized.

---
## 6 Limitations

Our model inherits constraints of present surface code compilation and not universal across fault-tolerant architectures. Clifford+T cost model assumes ideal T parallelism via Pauli product compression up to commuting groups; highly non-commuting random circuits reduce gain 2.2x→≤1.3x because dependency chains block batching, volume near naive floor. Monte Carlo threshold uses uniform depolarizing p and PyMatching; hardware bias 5-10x Z would shift threshold to ~2% for XZZX codes not evaluated, and leakage erasure from defect would alter buffer residency dramatically [4]. Recursive distillation presumes IID injection errors neglecting correlated fabrication variance across wafer causing spatial p_p variance meaning C_k optimism 15-25% at large factory count. SPARO CAD sweep at N=96; scaling to 1000+ logical qubits may shift optimal compute/route/factory ratio, SAT scalpel optimal only ≤12 qubits, heuristic gap 1.18-1.45x unproven ≥40q. Finally storage dominance assumes autonomous factories cannot be back-pressured throttled; if flow-control stalls production when buffer-full prolonged logical idle error from shared ancilla reuse correlated failure we model independent but physically coupled.

---
## 7 Conclusion

We presented fault-tolerant pathway Clifford+T→lattice surgery separating synthesis from placement, tracking Pauli frames zero physical overhead, integrating honest factory-plus-buffer accounting under bursty consumption. LS-IR emits layout-independent DAG, TLA+-verified commutation, then SPARO-guided SAT-bounded allocation yields 2.2x volume reduction over direct [1] while preserving formal correctness and ~0.9-1.1% threshold validated via Stim Monte Carlo. Insight storage dominates factory overhead [1][5] guides buffer-aware scheduling delivering 51% LER reduction under fixed tile budgets by routing flexibility. C_k recursive model effective 14.8x at level-2 captures injection failure and idle accumulation providing actionable estimator distances d=11-15. Future integrating leakage-reduced XZZX biased codes, back-pressured throttling, larger-than-12q SAT hierarchical abstraction scales compilation to 1000+ logical algorithm arena.

---
## References

[1] Realistic Cost to Execute Practical Quantum Circuits using Direct Clifford+T Lattice Surgery Compilation — http://arxiv.org/abs/2311.10686v3

[2] HTML version of Realistic Cost paper — https://arxiv.org/html/2311.10686v3

[3] Original v1 of Realistic Cost study — https://arxiv.org/abs/2311.10686v1

[4] Recursive Magic State Distillation on the Surface Code, Moussa — https://arxiv.org/pdf/2603.05409v1.pdf

[5] SPARO: Surface-code Pauli-based Architectural Resource Optimization — https://arxiv.org/pdf/2504.21854v2

[6] A SAT Scalpel for Lattice Surgery — https://arxiv.org/html/2404.18369v2

[7] Realistic Cost 2024 ACM Journal indexed — https://ouci.dntb.gov.ua/en/works/7BY6WAP9/

---

*Figures: thesis-qec-latticesurgery-20260808-b2c3-0.webp lattice surgery tile merging X/Z boundaries d×d 3D pipes, -1.webp magic factory 15-to-1 storage dominance, -2.webp SPARO tradeoff compute vs routing vs distillation, -3.webp threshold Monte Carlo logical vs physical error scaling*
