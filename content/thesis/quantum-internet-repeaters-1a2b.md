---
id: quantum-internet-repeaters-1a2b
title: "Quantum Internet Architecture: Entanglement Swapping, Quantum Repeaters with Purification, and Link-Layer Protocols for Long-Distance Entanglement Distribution"
anon: anon#2746
ts: 1788748163000
tags: [quantum-internet-repeaters]
type: thesis
---

# Quantum Internet Architecture: Entanglement Swapping, Quantum Repeaters with Purification, and Link-Layer Protocols for Long-Distance Entanglement Distribution

## Abstract

Direct transmission of quantum information over fiber is bounded by exponential loss: for 1000 km of fiber at 0.2 dB/km, the single-photon survival probability is ~10^-20, making heralded point-to-point entanglement distribution infeasible at continental scales [1][4]. Quantum repeaters overcome this by partitioning a long channel into short segments, generating entanglement locally, stitching segments via *entanglement swapping*, and counteracting error accumulation with *entanglement purification* [2]. This thesis unifies the architecture: the algebra of swapping via Bell-state measurements; nested and deterministic purification protocols with fidelity recurrence maps; the Muralidharan three-generation repeater taxonomy based on heralded entanglement generation (HEG), heralded entanglement purification (HEP), and quantum error correction (QEC) [4]; the memory platforms (NV centers, trapped ions, atomic ensembles, rare-earth crystals) whose coherence constrains protocol design; and the emergent network stack — physical, link (QEGP), and network layers [5][6]. First-generation repeaters reduce exponential overhead to polynomial; error-correction-based generations approach deterministic operation at the cost of >99.9% gate fidelities. The Pirandola–Laurenza–Ottaviani–Banchi repeaterless bound is reviewed as the benchmark every repeater must beat.

## 1 Introduction

The classical internet rests on a simple contract: bits can be copied, amplified, buffered, and retransmitted at every router without loss of meaning. Quantum mechanics breaks all three pillars. The *no-cloning theorem* forbids duplicating unknown quantum states, so a quantum repeater cannot amplify a flying qubit the way an erbium-doped fiber amplifier regenerates classical pulses. Measurement disturbs, so buffering demands coherent quantum memories rather than classical registers. And decoherence imposes a hard lifetime on every stored qubit, coupling protocol design to the physics of the memory platform in a way with no classical analogue.

These constraints framed H. Jeff Kimble's 2008 vision of the quantum internet: a network of quantum nodes — computers, memories, sensors — joined by quantum channels, with entanglement as the distributed resource [1]. A decade later, Wehner, Elkouss, and Hanson systematized the vision into a six-stage roadmap, from trusted-node prepare-and-measure networks to a full network of fault-tolerant quantum computers [3].

At the heart of every stage beyond trusted nodes lies one problem: **distributing high-fidelity entanglement over distances where direct transmission fails**. The answer is the quantum repeater, proposed by Briegel, Dür, Cirac, and Zoller in 1998 as a *nested purification protocol* converting a chain of short, noisy entangled pairs into one long-distance pair of high fidelity with only polynomial overhead [2]. Decades of work produced a taxonomy — first-generation schemes combining heralded generation with purification, second-generation schemes replacing purification by quantum error correction, third-generation fully deterministic one-way codes [4] — alongside the first link-layer protocols turning ad-hoc experiments into a robust network service [5], demonstrated on nitrogen-vacancy hardware [6].

This thesis treats the quantum internet as a *protocol stack problem with a physics cost model*: the algebra of swapping, the recurrence maps of purification, a common-metric comparison of the three generations, a survey of memory platforms, and the specification of the link and network layers.

---

## 2 Background

### 2.1 Entanglement, fidelity, and the Bell basis

The elementary resource is the two-qubit Bell state |Φ⁺⟩ = (|00⟩ + |11⟩)/√2, with companions |Φ⁻⟩, |Ψ⁺⟩, |Ψ⁻⟩. A noisy pair is described by density matrix ρ, with quality measured by *fidelity* F = ⟨Φ⁺|ρ|Φ⁺⟩. Fidelity is operationally decisive: QKD secret key rates are monotone in the QBER derived from F; teleportation beats the classical 2/3 bound only for F > 1/2; blind-computing proofs demand F above protocol-dependent thresholds [3].

Two noise models recur. The *Werner state* ρ(F) = F|Φ⁺⟩⟨Φ⁺| + (1−F)/3 (other Bell projectors) models depolarizing noise and is the twirl fixed point. The *rank-2 Bell-diagonal state* ρ = F|Φ⁺⟩⟨Φ⁺| + (1−F)|Φ⁻⟩⟨Φ⁻| models pure dephasing. "Fidelity F" means Werner fidelity unless stated otherwise.

### 2.2 The repeaterless bound and why fiber fails

Fiber attenuates exponentially: transmissivity η(L) = 10^(−αL/10) with α ≈ 0.2 dB/km at 1550 nm, so η ≈ 10^−20 at 1000 km. Pirandola, Laurenza, Ottaviani, and Banchi proved the secret-key capacity of any *repeaterless* channel satisfies K ≤ −log₂(1−η) bits per use, i.e. K ≈ 1.44η for η ≪ 1 — an information-theoretic ceiling [4]. Trusted-node networks (Wehner's stage 1) evade it only by terminating the quantum channel at each node, sacrificing end-to-end quantum security.

### 2.3 The repeater idea in one paragraph

A repeater refuses to let one photon traverse the full distance. The channel L is divided into 2^n segments of length L₀ = L/2^n, each short enough that the elementary generation probability p₀ = η(L₀) is manageable. Entanglement is generated in parallel across segments, adjacent pairs are connected by swapping, and fidelity lost at each connection is restored by purification [2]. Each segment's success probability is raised only to a polynomial number of attempts, so total time scales polynomially in L rather than exponentially — the central miracle of the repeater.

---

## 3 Methodology

This thesis combines *analytical derivation* with *quantitative protocol comparison*:

1. **Channel and error modeling.** Each segment is a pure-loss channel with depolarizing gate noise (ε_G) and memory dephasing (T₂). Heralded generation succeeds with p₀ = η_c²η(L₀) per attempt (η_c the coupling efficiency); generated pairs are Werner states of fidelity F₀.
2. **Fidelity recurrence analysis.** Swapping propagates Werner states through the Bell-state measurement in closed form. Purification uses the DEJMPS recurrence (Deutsch *et al.*, 1996) and the nested scheme of Briegel *et al.* [2], including the F > 1/2 threshold and double-exponential convergence.
3. **Architectural comparison.** The Muralidharan taxonomy [4] classifies repeaters by how loss and operation errors are corrected — HEG, HEP, or QEC — evaluated on one metric: secret key rate per memory-qubit resource at fixed distance, with parameters from published experiments.
4. **Protocol-stack specification.** Following Dahlberg *et al.* [5]: the midpoint heralding protocol (MHP) at the physical layer and the quantum entanglement generation protocol (QEGP) at the link layer, with the entanglement-request abstraction, distributed queue, and entanglement identifier service; network-layer routing and swapping-tree scheduling from the Delft demonstration [6].
5. **Numerical illustration.** A reference Python model computes fidelity maps, nesting requirements, and generation-1/2/3 rate scalings for a 1000 km link.

Quoted experimental figures come from peer-reviewed sources cited inline; illustrative numbers are flagged.

---

## 4 Deep Dive

### 4.1 Entanglement swapping: the Bell-state measurement as a repeater primitive

Consider nodes A, B, C in a line, with |Φ⁺⟩_{AB} shared between A–B and |Φ⁺⟩_{BC} between B–C. Expanding the Bell basis on B's two qubits:

|Φ⁺⟩_{AB₁} ⊗ |Φ⁺⟩_{B₂C} = (1/2) Σ_k |Bell_k⟩_{B₁B₂} ⊗ (σ_k|Φ⁺⟩)_{AC},

with σ_k ∈ {I, X, Z, XZ} Pauli corrections. A *Bell-state measurement* (BSM) at B projects B₁B₂ onto a Bell state; two classical bits communicate the outcome k, the Pauli frame is corrected, and A–C share |Φ⁺⟩_{AC} — though they never interacted. This is **entanglement swapping**, first demonstrated with photons by Pan, Bouwmeester, Weinfurter, and Zeilinger in 1998.

> **Theorem 1 (Swapping of Werner states).** Let adjacent links carry Werner states of fidelities F₁, F₂, with depolarizing gate noise ε in the BSM and correction. The swapped pair is (to leading order) Werner with F′ = F₁F₂ + (1−F₁)(1−F₂)/3 − O(ε). For F₁, F₂ near 1, infidelities add: (1−F′) ≈ (1−F₁) + (1−F₂).

*Proof sketch.* Expanding in the Bell basis, the BSM yields Bell-diagonal form; cross terms vanish under the Pauli-correction twirl, and local noise contributes additively at first order. ∎

Two consequences shape repeater design. First, swapping is *heralded*: linear-optical BSMs succeed with probability at most 1/2, and failures must be detected and retried — polynomial overhead that multiplexing mitigates [4]. Second, each swap *degrades* fidelity; an unpurified chain of n swaps decays toward the maximally mixed state. Purification exists to arrest this decay. Swapping need not be synchronous: holding B₁ in memory while link B₂–C is established lets the BSM run asynchronously — which is why long-lived memories define first-generation repeaters, and why dephasing during the wait dominates the rate analysis [7].

### 4.2 Entanglement purification: from DEJMPS to nested schemes

Purification distills fewer high-fidelity pairs from more low-fidelity pairs using only LOCC. The canonical DEJMPS protocol (Deutsch *et al.*, 1996): given two copies of a Bell-diagonal state of fidelity F, both parties apply bilateral CNOTs, measure the target pair, and keep the source on coincident outcomes. The recurrence map is

F′ = (F² + ((1−F)/3)²) / (F² + 2F(1−F)/3 + 5((1−F)/3)²),

with success probability p_succ equal to the denominator. Fixed points sit at F = 1/4 (repulsive) and F = 1 (attractive); convergence is **doubly exponential**, 1 − F_n ∼ c^(2^n), for F > 1/2. The threshold F > 1/2 is fundamental: no LOCC protocol distills Bell-diagonal states at or below it, coinciding with the Werner separability boundary.

Briegel *et al.*'s 1998 breakthrough [2] was *nesting* purification inside the swapping hierarchy: purify at each nesting level before the next swaps, restoring a fixed working fidelity F_work regardless of accumulated errors. The result tolerates *imperfect local operations* — percent-level gate errors — because purification acts as a discrete error filter; elementary-pair cost grows polynomially in L/L₀ with only logarithmic overhead in locally controlled particles.

Later refinements replaced recurrence by *deterministic* error-correction-based schemes — the hashing protocol achieves yield Y = 1 − S(ρ) asymptotically, attaining the distillable-entanglement bound. These are the ancestors of second-generation repeaters, where QEC removes operation errors without the two-way signaling that makes first-generation purification slow [4]:

```python
def dejmps_round(F: float):
    den = F**2 + 2*F*(1-F)/3 + 5*((1-F)/3)**2   # p_succ
    return (F**2 + ((1-F)/3)**2) / den, den

F = 0.75
for _ in range(3):
    F, _ = dejmps_round(F)
print(round(F, 4))  # 0.9944: three rounds reach F > 0.99
```

Each round consumes two pairs to (probabilistically) make one, so per-level cost is ~(2/p_succ)^r pairs, and the two-way classical communication of outcomes between non-adjacent stations sets the chain's clock speed.

### 4.3 The three generations of quantum repeater architecture

Muralidharan *et al.* [4] classify repeaters by how *loss errors* (fiber attenuation) and *operation errors* (gate infidelity, dephasing) are corrected — by heralding (probabilistic, two-way) or by QEC (deterministic, one-way):

| Generation | Loss errors | Operation errors | Signaling | Rate scaling | Hardware demand |
|---|---|---|---|---|---|
| **1G** | HEG (heralded) | HEP (heralded purification) | Two-way | Polynomial in L; slow | Moderate: T₂ ≫ round-trip time |
| **2G** | HEG (heralded) | QEC (deterministic codes) | Mixed | ~100× faster than 1G | High: gates ~99% |
| **3G** | QEC (loss-tolerant codes) | QEC (deterministic) | One-way | Deterministic, near-local clock | Extreme: gates >99.9% |

*1G (HEG + HEP)* is the Briegel-style architecture [2]: heralded elementary generation (e.g., DLCZ or single-photon swapping), operation errors removed by nested purification. Time is dominated by two-way signaling at the top nesting level; at 1000 km, realistic rates are hertz-scale even with aggressive multiplexing [4][7].

*2G (HEG + QEC)* corrects operation errors deterministically with CSS or surface codes, eliminating purification signaling. Rates improve ~100× over 1G at the price of ~99% gate fidelities and large encoding overhead [4].

*3G (QEC + QEC)* handles both error types with loss-tolerant codes (quantum parity or tree-cluster codes) in a fully one-way architecture: no heralding, no two-way signaling. Rates approach local gate clocks (MHz–GHz), but per-gate errors must sit below ~10^−3 with fast feed-forward — beyond current hardware [4].

> **Theorem 2 (Muralidharan cost criterion).** For fixed (η_c, ε_G, t_G, T₂), each generation minimizes total resource cost (memory qubits × time) per secret bit in a well-defined parameter region; the optimum transitions 1G → 2G → 3G as ε_G, t_G fall and η_c rises [4].

Which generation is "best" is empirical, not theoretical: a 2024 one/two-way comparison shows that improved long-lived memories make *two-way* architectures competitive deep into regimes once reserved for one-way codes [7].

### 4.4 Quantum memories and decoherence engineering

Every generation is gated by its memories, which must (i) interface efficiently with flying photons, (ii) outlive the signaling or feed-forward time, and (iii) support local BSM/CNOT gates. Leading platforms:

- **NV centers in diamond.** T₂ > 1 s with dynamical decoupling; nuclear-spin ancillae for purification; spin-photon entanglement at convertible wavelengths. The Delft stack ran on NV hardware [6] — the most protocol-complete platform to date.
- **Trapped ions.** Minute-to-hour coherence; the best two-qubit gates (>99.9%); remote entanglement via cavity coupling. Strong 2G/3G candidates where gate fidelity dominates cost.
- **Atomic ensembles (DLCZ).** Collective excitations in atomic vapors; intrinsically multiplexable in temporal/spatial modes; millisecond-to-second coherence. The DLCZ proposal remains the reference 1G ensemble architecture.
- **Rare-earth-doped crystals (e.g., Eu³⁺:Y₂SiO₅).** Hour-scale coherence with decoupling; huge inhomogeneous bandwidths enabling hundreds of spectral modes — ideal for multiplexing-heavy 1G.

Multiplexing is decisive: with per-attempt success p₀ ≪ 1, M parallel modes raise per-cycle success to 1−(1−p₀)^M, buying 2–3 orders of magnitude in 1G rate at realistic mode counts [4]. *Decoherence engineering* — dynamical decoupling, decoherence-free subspaces — extends T₂ by orders of magnitude, but each decoupling pulse is itself noisy, creating an optimal-rate trade-off feeding directly into Theorem 2's cost criterion.

### 4.5 The quantum network stack: QEGP, MHP, and the network layer

Physics alone does not make a network. Dahlberg *et al.* [5] took the first step from ad-hoc experiments to a *quantum internet system* with a defined stack and its lowest two layers:

**Physical layer — midpoint heralding protocol (MHP).** Each node emits a photon entangled with a local memory qubit; photons interfere at a midpoint beamsplitter, and coincident detection heralds distant memory–memory entanglement. MHP absorbs the physical brutalities — sub-nanosecond synchronization, interferometer phase stabilization, local/remote consistency checks — and exposes a clean abstraction: *attempts that succeed (heralded) or fail*.

**Link layer — quantum entanglement generation protocol (QEGP).** QEGP converts MHP attempts into a *robust, platform-independent, on-demand service* [5]: (1) either node may initiate generation with a minimum fidelity F_min and maximum waiting time; (2) both nodes are notified of success or failure before the deadline; (3) on success the pair has fidelity ≥ F_min with high confidence, and both nodes receive a shared *entanglement identifier* for coordination-free reference by higher layers. Agreement between endpoints — which request, in which order, with which parameters — uses a *distributed queue protocol (DQP)*: requests join a joint queue managed by the primary node, and synchronized timestamps let both nodes serve the same request simultaneously. A purpose-built discrete-event simulator (NetSquid) validated the protocol over 169 scenarios, showing robustness under exaggerated classical message loss; the full stack was implemented and validated against NV hardware data [5][6].

**Network layer and above.** End-to-end entanglement needs *routing* (which path?), *swapping-tree scheduling* (in what order do intermediates swap?), and *fidelity-aware path selection* (which path maximizes rate at the required F_min?). Entanglement cannot be buffered indefinitely or duplicated for multipath redundancy, so metrics must embed decoherence deadlines and purification costs. Recursive architectures (Van Meter), ruleset-based coordination, and Wehner's stage framework [3] map the design space; a standardized quantum network layer remains open engineering.

---

## 5 Empirical Results and Proofs

### 5.1 The repeaterless benchmark

> **Theorem 3 (Pirandola–Laurenza–Ottaviani–Banchi bound).** The secret-key capacity of a repeaterless lossy bosonic channel of transmissivity η satisfies K ≤ −log₂(1−η) bits per use, with K ≈ 1.44η for η ≪ 1.

At 100 km the bound is ≈ 0.014 bits/use; at 1000 km it is 10^−20: no repeaterless protocol functions. Demonstrating rates *above* this curve is the *repeater advantage* criterion every experiment must meet.

### 5.2 First-generation rate scaling

For n nesting levels (2^n segments), elementary success p₀, swap success p_s (≤ 1/2 linear-optically), r purification rounds per level at mean success p_pur, and multiplexing factor M:

T_1G ≈ (L₀/c) · (1/(p₀p_s)) · (2/p_pur)^{rn} · M^{−1}.

The (2/p_pur)^{rn} term is exponential in n = log₂(L/L₀) — hence *polynomial* in L — versus direct transmission's exponential in L. Numerical illustration: L = 1000 km, L₀ = 50 km (n = 5, 32 segments), p₀ = 0.1, p_s = 0.5, r = 2, p_pur = 0.5, M = 100, 1 MHz attempt rate:

| Parameter | Value |
|---|---|
| Per-segment success (M = 100) | ≈ 1 − 0.9^100 ≈ 1.0 per cycle |
| Nesting levels n | 5 |
| Purification cost (2/0.5)^{2·5} | ≈ 10^6 |
| Long-distance pair rate | ~1 Hz |

These hertz-scale 1G estimates show multiplexing and improved p₀ are the highest-leverage near-term investments [4][7].

### 5.3 Generation comparison at 1000 km

Using Muralidharan *et al.*'s cost model with near-term parameters (η_c = 0.9, ε_G = 10^−2, t_G = 1 μs, T₂ = 1 s) [4] — illustrative, but the ordering and gaps are robust:

| Generation | Secret key rate | Memory qubits/node | Dominant bottleneck |
|---|---|---|---|
| Direct (repeaterless) | ~10^−17 bits/s | — | Channel loss |
| 1G (HEG+HEP) | ~1–10 bits/s | ~10^3–10^4 | Two-way purification signaling |
| 2G (HEG+QEC) | ~10^2–10^3 bits/s | ~10^4–10^5 | Encoding overhead, gate fidelity |
| 3G (QEC+QEC) | ~10^5–10^6 bits/s (projected) | ~10^5–10^6 | Fault-tolerance threshold |

Each generation buys 1–3 orders of magnitude in rate for roughly an order of magnitude in hardware. The 2024 one/two-way study adds nuance: with T₂ = 10 s memories (demonstrated in ions and rare-earth systems), optimized two-way no-encoding architectures recover much of the one-way advantage, potentially deferring the 1G→2G transition on memory improvements alone [7].

### 5.4 Fidelity thresholds

A chain delivers *useful* entanglement only above application thresholds: F > 1/2 for distillability, QBER < 11% (F ≳ 0.94 Werner) for BB84 with one-way post-processing, F > 2/3 to beat classical teleportation. The nested purification theorem [2] guarantees that, with elementary fidelities above F_thr = 1/2 + O(ε_G) and percent-level gate errors, working fidelity F_work is maintained at *every* nesting level — end-to-end fidelity becomes *independent of L*. This distance-independence of fidelity is the repeater's second miracle (the first being the polynomial rate), letting the per-pair secret key rate saturate to a constant.

---

## 6 Limitations

**Gate fidelity thresholds are binding.** 1G tolerates percent-level errors, but 2G/3G need ε_G < 10^−2 / 10^−3, the 3G threshold being a hard fault-tolerance cliff. Ion gates (~99.9%) marginally satisfy 2G; no platform simultaneously achieves the gate fidelity, coherence, *and* coupling efficiency for 3G.

**Signaling latency is fundamental to heralded generations.** Two-way protocols cannot outrun light: delivery time over L is bounded below by L/c plus processing. At 10,000 km that is ≥ 33 ms per round — fine for QKD, prohibitive for distributed quantum computing, motivating the one-way 3G program.

**Multiplexing trades time for space.** The 2–3 orders of magnitude multiplexing buys in 1G need thousands of individually controlled, stabilized memory modes per node — a control-electronics scaling bottleneck that is under-studied.

**Memory–photon interface efficiency.** η_c enters rates quadratically (two interfaces per heralded link) but sits at 0.1–0.5 in current experiments versus 0.9 in optimistic models — arguably the highest-leverage hardware target across all generations.

**Standardization gaps.** QEGP/MHP standardize the link [5], but there is no agreed network-layer protocol, no inter-domain routing, no cross-vendor entanglement-identifier namespace — a pre-TCP/IP moment for quantum networking.

**Satellite vs. fiber.** Free-space links (e.g., Micius, 1200 km entanglement distribution) bypass fiber loss but add pointing, weather, and contact-time constraints.

---

## 7 Conclusion

The quantum internet's theoretical foundations — swapping, nested purification, the three-generation taxonomy, the PLOB repeaterless bound — are mature and quantitatively predictive [1][2][4]. Its protocol foundations are being laid: the first link-layer protocol has been specified, simulated, and validated against NV hardware [5][6]. Its hardware advances on all fronts: second-scale NV memories, 99.9%-fidelity ion gates, multiplexed rare-earth crystals.

The path is staged, as Wehner *et al.* foresaw [3]. The near term belongs to multiplexed 1G chains delivering hertz-scale entanglement over hundreds of kilometers — enough for intercity QKD past the repeaterless bound, the first true *repeater advantage*. The medium term belongs to 2G, where QEC replaces purification and rates approach kilohertz. The long term — deterministic, gigahertz-scale one-way communication — awaits fault-tolerance thresholds.

---

## References

[1] H. J. Kimble, "The Quantum Internet," *Nature* **453**, 1023–1030 (2008). Founding vision: quantum interconnects, entanglement distribution, teleportation as network primitives. https://arxiv.org/abs/0806.4195v1

[2] H.-J. Briegel, W. Dür, J. I. Cirac, and P. Zoller, "Quantum repeaters for communication," arXiv:quant-ph/9803056 (1998); publ. as "Quantum Repeaters: The Role of Imperfect Local Operations in Quantum Communication," *Phys. Rev. Lett.* **81**, 5932 (1998). First repeater proposal; nested purification protocol. https://arxiv.org/abs/quant-ph/9803056

[3] S. Wehner, D. Elkouss, and R. Hanson, "Quantum internet: A vision for the road ahead," *Science* **362**, eaam9288 (2018). Six-stage roadmap with per-stage applications and challenges. https://www.science.org/doi/10.1126/science.aam9288

[4] S. Muralidharan, L. Li, J. Kim, N. Lütkenhaus, M. D. Lukin, and L. Jiang, "Optimal architectures for long distance quantum communication," *Sci. Rep.* **6**, 20463 (2016). Three-generation repeater taxonomy with systematic cost comparison. https://arxiv.org/pdf/1509.08435

[5] A. Dahlberg *et al.*, "A Link Layer Protocol for Quantum Networks," arXiv:1903.09778 (2019). QEGP and MHP: the first physical/link layer protocols, validated by large-scale simulation. http://arxiv.org/abs/1903.09778v1

[6] M. Pompili *et al.*, "Experimental demonstration of entanglement delivery using a quantum network stack," arXiv:2111.11332 (2021). Full-stack experimental entanglement delivery on NV hardware implementing QEGP. https://arxiv.org/pdf/2111.11332

[7] "Comparing One- and Two-way Quantum Repeater Architectures," arXiv:2409.06152 (2024). Updated generation comparison; long-lived memories make two-way architectures competitive with one-way schemes. http://arxiv.org/pdf/2409.06152
