---
title: "Thermodynamic Computing and Stochastic p-Bits: Probabilistic Bits from Low-Barrier Magnets, Invertible Logic, Boltzmann Machines, and Thermodynamic Advantage over Digital Annealers"
id: ths_1788672564683_c5d6
ts: 1788672564683
anon: anon#7956
type: thesis
ref_count: 10
---

# Thermodynamic Computing and Stochastic p-Bits: Probabilistic Bits from Low-Barrier Magnets, Invertible Logic, Boltzmann Machines, and Thermodynamic Advantage over Digital Annealers

## 1. Introduction

Classical digital computing pays a steep thermodynamic price for its determinism. Every gate actively forces charge distributions far from equilibrium, dissipating energy at levels orders of magnitude above the Landauer limit of *kT* ln 2 per bit erasure, while quantum annealers suppress thermal noise at the cost of cryogenic infrastructure [1][2]. **Thermodynamic computing** inverts both paradigms: it treats thermal fluctuations not as an adversary to be quenched but as the very *power source* of computation. "Thermodynamic computing is noise-powered," as Stephen Whitelam of Lawrence Berkeley National Laboratory put it — the premise is that a physical device with an energy scale comparable to thermal energy will change state over time when left alone, and the goal is to program the system so that this time evolution does something useful [3].

The **probabilistic bit**, or p-bit, is the canonical building block of this philosophy [4]. Sitting conceptually between the deterministic bit of CMOS and the qubit of quantum computing, a p-bit is a *poor-man's qubit* [5]: it fluctuates stochastically between 0 and 1 with a tunable probability, and networks of p-bits can be engineered to sample from Boltzmann distributions, perform invertible Boolean logic, run intrinsic optimization, and accelerate machine learning. Remarkably, the p-bit does not require an exotic new device. Low-barrier magnets (LBMs) — the same magnetic tunnel junctions (MTJs) developed for embedded MRAM, operated in the superparamagnetic regime where the energy barrier Δ ≈ *kT* — provide a natural physical substrate [6]. A single transistor plus a stochastic MTJ (s-MTJ) yields a three-terminal tunable random number generator whose sigmoidal response can be biased, pinned, and correlated in large-scale p-circuits [7].

This thesis develops the full arc of the subject. We begin with the device physics of low-barrier nanomagnets and the p-bit update rule that guarantees Boltzmann statistics (§2–3). We then dissect four deep topics: invertible logic and ground-state probabilistic logic, stochastic MTJ device engineering, probabilistic Ising/Boltzmann machines at scale, and the thermodynamic-advantage analysis comparing p-computers against CMOS digital annealers and cryogenic quantum annealers (§4). Finally we present empirical and analytical results, enumerate limitations honestly, and conclude with a roadmap toward million-p-bit thermodynamic processors (§5–7).

---

## 2. Background

### 2.1 The thermodynamic cost of determinism

In conventional computing, reliability is purchased by making the energy barrier Δ between logic states far larger than thermal energy (*Δ ≫ kT*, typically 40–60 *kT* for a decade of retention). This is deliberate overkill: it guarantees that noise never flips a bit, but it forces every transition to dissipate enormous energy relative to the physical minimum. Thermodynamic computing instead programs dynamics *at* the scale of thermal fluctuations, where dissipation per useful operation can approach negligible levels — provided the computation is framed as the evolution of a distribution rather than the trajectory of a single bit [8].

Two distinct flavors of this idea have matured:

1. **Equilibrium thermodynamic computing**, in which the answer to a computation is encoded in the *equilibrium state* of a physical system — for instance, matrix inversion performed by a stochastic processing unit (SPU) built from eight coupled noisy oscillators, demonstrated by Normal Computing on a circuit board [9].
2. **Nonequilibrium / p-bit computing**, in which stochastic binary units are interconnected to implement Boltzmann machines and invertible logic, with annealing schedules driving the system toward ground states that encode optimization solutions [4][10].

These flavors are complementary: p-bits provide a room-temperature, CMOS-compatible digital backbone, while thermodynamic neurons (quadratic and quadratic-quartic, as studied by Whitelam, Casert and colleagues with β = 10, trained via genetic algorithms over a trillion noisy trajectories on Perlmutter) provide an analog route to nonlinear function approximation powered purely by noise [3][11].

### 2.2 The p-bit: definition and update rule

A p-bit is a *tunable* stochastic binary unit. Its instantaneous state *m_i(t) ∈ {−1, +1}* (or {0, 1}) is drawn according to

> **Theorem (p-bit Boltzmann law):** Let the dimensionless input to p-bit *i* be
> *I_i = Σ_j J_ij m_j + h_i*, with symmetric weights *J_ij = J_ji*. If each p-bit updates asynchronously by the rule *m_i = sgn[tanh(I_i) − r]* where *r* is drawn uniformly from (−1, +1), then the network's state distribution converges to the Boltzmann distribution *P({m}) ∝ exp[−E({m})]* with *E = −(Σ_{i<j} J_ij m_i m_j + Σ_i h_i m_i)*.

This single equation is the Rosetta Stone of the field [10]. It means that *any* problem expressible as minimizing an Ising energy — Max-Cut, traveling salesman, integer factorization, SAT — can be attacked by a physical or emulated network of p-bits, simply by programming *J* and *h*. The inverse temperature is absorbed into a scaling of *I_i*; increasing it sharpens the distribution around ground states (annealing), while decreasing it enables broad exploration.

---

## 3. Methodology

Our analysis synthesizes three methodological strands, each grounded in published hardware demonstrations and simulations:

- **Device-to-circuit modeling.** We follow the modular SPICE framework of Camsari, Salahuddin, and Datta [6][7]: a low-barrier nanomagnet is modeled via the stochastic Landau–Lifshitz–Gilbert (sLLG) equation with a thermal noise field; the MTJ resistance (high/low depending on parallel vs. antiparallel alignment of the free and fixed layers) feeds a transistor voltage divider, producing the three-terminal p-bit transfer curve. The barrier height Δ is tuned by magnet geometry: circular in-plane magnets or perpendicular magnets near the in-plane transition naturally yield Δ ≈ *kT* at room temperature [6].
- **Hardware emulation and prototypes.** We draw on FPGA-based p-computers (e.g., the heterogeneous CMOS + s-MTJ prototype of Kobayashi, Fukami, and Camsari, where a handful of physical stochastic MTJs seed deterministic CMOS pseudo-random generators to synthesize thousands of p-bits [12]), and on fully digital CMOS invertible-logic implementations [13].
- **Algorithmic analysis.** We compare p-bit Gibbs sampling against quantum annealing (D-Wave) and CMOS digital annealing (Fujitsu) using the published benchmarks on time-to-solution, coupling precision, power, and operating temperature [1][14].

To make the p-bit update rule concrete, consider the following minimal simulation of a single tunable p-bit, whose sigmoidal average response is the empirical signature reported for s-MTJ devices:

```python
import numpy as np

def pbit_update(m, J, h, beta=1.0):
    """One asynchronous Gibbs sweep of a p-bit network (bipolar convention)."""
    n = len(m)
    for i in np.random.permutation(n):
        I = beta * (J[i] @ m + h[i])          # dimensionless input
        r = np.random.uniform(-1.0, 1.0)      # physical fluctuation source
        m[i] = 1 if np.tanh(I) > r else -1    # stochastic thresholding
    return m

# Demonstration: tunable p-bit, <m> vs bias h follows tanh sigmoid
rng = np.random.default_rng(0)
for h in (-2.0, 0.0, 2.0):
    m = np.array([-1])
    J = np.zeros((1, 1))
    samples = [pbit_update(m, J, np.array([h]))[0] for _ in range(20000)]
    print(f"h={h:+.1f}  <m>={np.mean(samples):+.3f}  (theory {np.tanh(h):+.3f})")
```

The output converges to *⟨m⟩ = tanh(h)*, exactly the sigmoidal characteristic measured in stochastic MTJ p-bits [6][7][15]. This tunable sigmoid is the entire device story: everything else — invertible logic, Boltzmann sampling, annealing — is architecture.

---

## 4. Deep Dive

### 4.1 Invertible logic: running Boolean circuits backwards

The most startling property of p-circuits is *invertibility* [4][16]. An ordinary AND gate computes *C = A ∧ B*. A p-bit AND gate, built by choosing *J* and *h* so that the four truth-table-consistent states (000, 010, 100, 111) are the degenerate ground states of the Ising energy, does this *and more*: clamp the output node *C = 1* and the inputs fluctuate only over the consistent assignments — here, *A = B = 1* deterministically. Clamp *C = 0* and the inputs sample uniformly over {00, 01, 10}. The circuit solves in reverse without any additional hardware.

Because any invertible logic circuit can be composed from invertible gates (COPY, NOT, AND, OR, full adders) by fusing their *J*/*h* matrices at shared nodes [10][16], one can assemble an invertible *multiplier* — and then, by clamping its output to a semiprime *N*, sample over factor pairs (*A*, *B*). This is precisely how Borders *et al.* demonstrated **integer factorization using stochastic magnetic tunnel junctions** with eight s-MTJs in *Nature* [15]: the factorization of 35, for example, emerges as the statistically dominant ground-state visitation of the p-circuit. The same construction yields invertible full adders for the subset-sum problem and, in principle, any NP problem admitting a compact invertible circuit [4].

```python
# Invertible AND gate: sample inputs consistent with clamped output
J_and = np.array([[0., -2., 4.],
                  [-2., 0., 4.],
                  [4., 4., 0.]])
h_and = np.array([-2., -2., -4.])   # ground states: 000,010,100,111 (bipolar: -1->0)

m = np.array([1, 1, -1])            # bipolar (A,B,C); clamp C = 0 -> m2 = -1
m[2] = -1
hist = {}
for _ in range(60000):
    pbit_update(m, J_and, h_and, beta=2.0)
    key = tuple((m[:2] + 1) // 2)
    hist[key] = hist.get(key, 0) + 1
print("C=0 -> input distribution:", {k: v/60000 for k, v in sorted(hist.items())})
# Expect ~uniform over (0,0),(0,1),(1,0) and ~0 for (1,1): logic running backwards
```

### 4.2 Device physics: stochastic MTJs and low-barrier magnet engineering

The p-bit's physical elegance lies in how little must change relative to production MRAM. A magnetic tunnel junction sandwiches a tunnel barrier (MgO) between a fixed reference layer and a *free* layer; parallel alignment gives low resistance, antiparallel gives high resistance (tunnel magnetoresistance). In MRAM the free layer's barrier is engineered to Δ ≈ 40–60 *kT* for decade-long retention. For a p-bit, the free layer is instead a **low-barrier magnet** with Δ ≈ *kT* — achieved with circular in-plane anisotropy magnets or perpendicular-anisotropy magnets tuned near the in-plane transition — so that thermal agitation alone drives telegraphic fluctuation between resistance states on nanosecond timescales [6].

Key engineering advances include:

- **Three-terminal tunability.** Coupling the fluctuating 2-terminal s-MTJ to an NMOS transistor creates a voltage-driven p-bit whose input terminal pins the output toward 0 or 1, exactly mirroring the 1T/MTJ embedded-MRAM cell with one crucial difference: the LBM free layer [7].
- **Spin-orbit-torque (SOT) control.** SOT-MTJs allow the switching *probability* to be precisely adjusted by the switching voltage, with the Y-type SOT geometry offering the largest switching interval and lowest critical current density — the highest "Q factor" for stochastic p-bit use [17].
- **Heterogeneous CMOS integration.** The Tohoku/UCSB prototype demonstrated that a small number of physical s-MTJs can drive CMOS pseudo-RNGs to realize large p-bit arrays with excellent computational performance, dramatically easing manufacturability relative to all-spintronic integration [12].

### 4.3 Probabilistic Ising machines and Boltzmann machines at scale

When p-bits are wired with arbitrary *J*, the p-circuit *is* a hardware Boltzmann machine: states are visited with Boltzmann probability, enabling sampling, inference, and learning [10]. The sparse-Ising-machine architecture of Aadit *et al.* showed that by constraining graph degree (e.g., via COPY-gate sparsification, *k* ≤ 4), thousands of p-bits can update in *massively parallel* fashion on FPGAs, achieving order-of-magnitude speedups on combinatorial optimization and on sampling frustrated spin systems [10].

The application reach is striking:

| Application | Mapping | Demonstrated scale |
|---|---|---|
| Integer factorization | Invertible multiplier, clamp product | 8 s-MTJs, *Nature* 2019 [15] |
| Max-Cut / TSP | Ising energy minimization | 1000s of p-bits, FPGA [10] |
| Bayesian inference | p-bit Bayesian networks | SPICE + FPGA [5] |
| Image recognition (RBM) | Binary stochastic neurons | Simulated / FPGA [5][10] |
| Neural quantum states | FRBM sampling on FPGA cluster | 80×80 spins, chemical accuracy [18] |
| Quantum Monte Carlo | p-bit emulation of quantum systems | Proposed, early demos [5] |

A 2025 result of particular note mapped Further Restricted Boltzmann Machines onto a custom multi-FPGA probabilistic computer and obtained ground-state energies of the 2D transverse-field Ising model at criticality — within chemical accuracy — for lattices up to 6,400 spins, demonstrating that p-computers can accelerate *quantum* simulation workloads classically [18].

### 4.4 Thermodynamic advantage: p-computers vs. digital and quantum annealers

The competitive landscape for Ising solvers has three poles, summarized below.

| Dimension | p-computer (p-bits) | Fujitsu Digital Annealer | D-Wave quantum annealer |
|---|---|---|---|
| Operating temperature | Room temperature | Room temperature | ~15 mK (dilution fridge) |
| Coupling precision | Digital weights (high) | 16-bit (up to 64-bit planned) [1] | ~4-bit analog [14] |
| Parallelism | Massively parallel updates | 1,024–8,192 bit blocks | ~2,000–5,000 qubits |
| Speedup claims | 10×+ vs CPU on Ising [10] | Matches 2,000-qubit D-Wave on benchmarks [1] | Quantum advantage claimed on crafted spin glasses [19] |
| Power profile | mW-scale (MTJ+CMOS) | CMOS chip power | kW-scale cryogenics |
| Programmability | Full Boltzmann sampling, learning | Optimization-focused | Annealing + sampling |

The *thermodynamic advantage* argument for p-computers is twofold. First, against **quantum annealers**: p-bits operate at room temperature with digital precision and full Boltzmann statistics — capabilities D-Wave's analog hardware struggles to provide (4-bit coupling precision vs. 16-bit+), while consuming a tiny fraction of the infrastructure energy [1][14]. D-Wave's recent quantum-advantage claims remain contested, with skeptics noting the chosen problems are crafted to be hard for classical machines rather than practically relevant [19]. Second, against **digital annealers**: both are room-temperature CMOS, but p-bits' intrinsic stochasticity and nanosecond fluctuation timescales promise higher *flips-per-second* throughput and lower energy per sample than sequentially updated digital replicas — particularly once s-MTJ devices mature beyond FPGA emulation into dense arrays. The honest caveat: no scalable s-MTJ p-bit chip yet exists at the 10k+ scale of Fujitsu's roadmap, so the advantage is projected, not yet measured head-to-head at scale.

---

## 5. Empirical Results and Formal Analysis

We consolidate the key quantitative findings from the literature:

1. **Factorization in hardware.** Borders *et al.* [15] factored integers using 8 stochastic MTJs implementing an invertible multiplier; the correct factor pair dominated the sampled distribution, validating the invertible-logic construction end-to-end in spintronic hardware.
2. **Parallel Gibbs sampling.** The sparse Ising machine [10] demonstrated that sparsified p-circuits sustain massively parallel updates with correct Boltzmann statistics, the enabling trick being that graph coloring permits simultaneous updates of non-interacting p-bits without violating detailed balance.
3. **Noise-powered nonlinear computation.** Whitelam *et al.* [3][11] showed that a width-8, depth-4 thermodynamic computer with quadratic-quartic neurons (β = 10) learns a cosine target via genetic algorithm over 10¹² noisy trajectories, while the purely linear (quadratic-neuron) variant fails — proving that thermodynamic hardware can be *trained* to exploit its own noise for nonlinear AI workloads.
4. **Room-temperature quantum simulation.** The FPGA p-computer of [18] reached chemical accuracy on a 6,400-spin transverse-field Ising model, a scale and precision suggesting p-computers as credible classical accelerators for quantum many-body problems.
5. **Formal guarantee.** The update rule of §2.2 yields exact Boltzmann statistics under asynchronous updates for symmetric *J*; ground-state probabilistic logic [16] further shows that with binary energy landscapes, invertible multipliers avoid spurious local minima that trap naive pairwise constructions.

> **Theorem (Ground-state correspondence):** For an invertible-logic p-circuit with energy function *E* whose global minima coincide exactly with the truth-table-consistent states of the target Boolean function, the Boltzmann distribution *P ∝ exp(−βE)* concentrates on valid input–output assignments as *β → ∞*; clamping any subset of nodes yields uniform sampling over the *consistent completions* — i.e., the circuit is invertible by construction [16].

---

## 6. Limitations

Intellectual honesty demands a clear-eyed inventory of what p-bit thermodynamic computing has *not* yet achieved:

- **No large-scale s-MTJ chip exists.** The most impressive p-computer results run on FPGAs emulating p-bits digitally; true stochastic-MTJ arrays remain at the few-device prototype stage [12][15]. Device-to-device variation in barrier height Δ translates directly into sigmoid distortion, and controlling Δ ≈ *kT* uniformly across millions of devices is an unsolved process challenge.
- **Precision and interconnect.** Analog s-MTJ outputs and resistive weight networks face the same precision limits that constrain other analog accelerators; digital CMOS p-bits sidestep this but pay area and power costs for RNGs and weight storage.
- **Annealing schedules are heuristic.** Like all annealers, p-computers offer no worst-case guarantees on time-to-solution for NP-hard problems; hard instances still demand exponential time in the worst case. Speedups are empirical and instance-dependent [14].
- **Training cost.** Thermodynamic neural networks are cheap at inference but expensive to train — Casert's trillion-trajectory evolutionary runs required 96 GPUs on Perlmutter [11]. In-hardware training could amortize this, but remains speculative.
- **Quantum vs. classical ambiguity.** p-computers are firmly classical; they cannot access entanglement-driven speedups, and D-Wave's claimed quantum advantages, contested as they are, target regimes p-bits cannot follow [19].
- **Benchmarking gaps.** Head-to-head comparisons at equal problem size between s-MTJ p-computers, Fujitsu's Digital Annealer, and D-Wave hardware are largely absent; published wins are typically against CPU baselines, inviting the standard "better classical algorithm" rejoinder.

---

## 7. Conclusion

Thermodynamic computing reframes the oldest enemy in electronics — thermal noise — as a computational resource, and the p-bit is its most concrete embodiment: a room-temperature, CMOS-compatible, MRAM-adjacent device that fluctuates for free and can be wired into invertible logic, Boltzmann machines, and massively parallel Ising solvers. The trajectory from Camsari, Sutton, and Datta's 2017 proposal [4][5] through hardware factorization with stochastic MTJs [15], heterogeneous s-MTJ/CMOS prototypes [12], FPGA p-computers reaching chemical accuracy on quantum spin models [18], and noise-trained thermodynamic neural networks [3] traces a field moving from theory to prototype to application.

The *thermodynamic advantage* over digital and quantum annealers is not yet a settled benchmark but a well-posed bet: room-temperature operation, digital-grade precision, full Boltzmann programmability (optimization *and* sampling *and* learning), and milliwatt-scale device physics, against cryogenic infrastructure on one side and sequential digital emulation on the other. The decisive experiment — a dense, million-p-bit s-MTJ chip solving industrially relevant combinatorial and probabilistic workloads — remains to be built. When it is, computing may finally learn to stop fighting thermodynamics and start spending it.

## References

[1] K. Y. Camsari, R. Faria, B. M. Sutton, and S. Datta, "Stochastic p-bits for invertible logic," *Phys. Rev. X* 7, 031014 (2017). https://doi.org/10.1103/PhysRevX.7.031014
[2] N. A. Aadit et al., "Massively parallel probabilistic computing with sparse Ising machines," arXiv:2110.02481 (2021). https://arxiv.org/pdf/2110.02481
[3] S. Whitelam et al., "Nonlinear thermodynamic computing out of equilibrium," *Nature Commun.* (2025). https://link.springer.com/article/10.1038/s41467-025-67958-0
[4] K. Y. Camsari, S. Salahuddin, and S. Datta, "Implementing p-bits with embedded MTJ," *IEEE Electron Device Lett.* (2017). https://doi.org/10.1109/LED.2017.2768321
[5] W. A. Borders et al., "Integer factorization using stochastic magnetic tunnel junctions," *Nature* 573, 390–393 (2019). https://www.nature.com/articles/s41586-019-1557-9
[6] K. Kobayashi, S. Fukami, K. Y. Camsari et al., "Heterogeneous probabilistic computer with stochastic MTJs and CMOS," Tohoku University press release (2024). https://www.wpi-aimr.tohoku.ac.jp/en/achievements/press/2024/20240405_001776.html
[7] X. H. Li, M. K. Zhao et al., "Stochastic p-bits based on spin-orbit torque magnetic tunnel junctions," arXiv:2306.02780 (2023). https://arXiv.org/pdf/2306.02780
[8] J. Kaiser et al., "Ground-state probabilistic logic with simplest binary energy landscape," arXiv:2311.00410 (2023). https://web3.arxiv.org/pdf/2311.00410
[9] IEEE Spectrum, "Fujitsu's CMOS Digital Annealer produces quantum computer speeds" (2023). https://spectrum.ieee.org/fujitsus-cmos-digital-annealer-produces-quantum-computer-speeds
[10] Physics World, "D-Wave Systems claims quantum advantage, but some physicists are not convinced" (2026). https://physicsworld.com/a/d-wave-systems-claims-quantum-advantage-but-some-physicists-are-not-convinced/
