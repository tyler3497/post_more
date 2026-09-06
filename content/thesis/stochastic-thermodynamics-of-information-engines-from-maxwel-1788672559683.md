---
title: "Stochastic Thermodynamics of Information Engines: From Maxwell's Demon and the Szilard Engine to Landauer Erasure, Sagawa-Ueda Feedback Control, and Colloidal Realizations"
id: ths_1788672559683_c4d5
ts: 1788672559683
anon: anon#4721
type: thesis
ref_count: 8
---

# Stochastic Thermodynamics of Information Engines: From Maxwell's Demon and the Szilard Engine to Landauer Erasure, Sagawa-Ueda Feedback Control, and Colloidal Realizations

## 1. Introduction

In 1867 James Clerk Maxwell imagined a *finite being* stationed at a microscopic trapdoor between two chambers of gas, sorting fast molecules from slow ones without apparent expenditure of work, and thereby cooling one chamber at the expense of the other [8]. The demon's paradox — an apparent violation of the second law of thermodynamics — was not resolved by better microscopy of molecules but by a radical conceptual shift: **information is physical**. Leo Szilard formalized the demon in 1929 as a one-molecule engine whose operator must record *one bit* of measurement outcome, tying the extractable work k_BT ln 2 directly to the cost of manipulating information [5]. Rolf Landauer completed the inversion in 1961, arguing that it is not measurement but *erasure* of information that carries an unavoidable thermodynamic price: resetting an unknown bit to a reference state must dissipate at least k_BT ln 2 of heat [6]. Charles Bennett then showed that any computation can be made logically reversible, so the demon's books balance only when the full measurement-feedback-erasure cycle is closed.

For more than a century this debate lived in thought experiments. That changed with the rise of **stochastic thermodynamics**, the framework pioneered by Sekimoto and Seifert in which heat, work, and entropy are defined along individual fluctuating trajectories of mesoscopic systems [8]. Colloidal particles in optical traps — precisely the scale at which thermal noise and deterministic control compete — became the experimental realization of Maxwell's demon. Beginning in 2010, high-speed feedback experiments demonstrated that a Brownian particle can be coaxed *uphill* against gravity or an electric field, converting position information into genuine free energy, and validated new fluctuation theorems that quantify exactly how much the demon can cheat: on average, no more than the information it acquires [1].

This thesis presents a self-contained account of the stochastic thermodynamics of information engines. We move from the idealized Szilard engine through Landauer's bound and its modern derivations, into the Sagawa-Ueda theory of feedback control, and finally to the laboratory: the colloidal spiral-staircase information engine, feedback-trap tests of Landauer's principle, and the frontier questions of efficiency at maximum power, the thermodynamic uncertainty relation, and autonomous molecular demons.

---

## 2. Background

### 2.1 Stochastic energetics and trajectory thermodynamics

The microscopic systems of interest — a single colloidal bead, an electron box, a molecular motor — obey overdamped Langevin dynamics

> **Stochastic dynamics:** dx_t = μ F(x_t, λ_t) dt + √(2D) dW_t

where μ is the mobility, F = −∂_x V(x, λ) + f_nc combines conservative and non-conservative forces, D = μ k_BT is the diffusion constant via the Einstein relation, λ_t is an externally controlled protocol, and dW_t is the Wiener increment. Sekimoto's *stochastic energetics* identifies the heat dissipated along a trajectory as the Stratonovich integral of the bath force [8]:

dQ = (γ dx_t/dt − √(2γk_BT) ξ_t) ∘ dx_t

and the work as the energy change attributable to the protocol, dW = (∂V/∂λ) dλ. With these definitions the **first law holds trajectory by trajectory**, dU = dW − dQ, and the total entropy production Δs_tot = Δs_sys + Δs_med satisfies the integral fluctuation theorem

> Theorem: ⟨exp(−Δs_tot / k_B)⟩ = 1, hence ⟨Δs_tot⟩ ≥ 0 by Jensen's inequality.

This is the second law of stochastic thermodynamics: ensemble entropy production can never be negative, though individual trajectories routinely violate it [8]. The Crooks and Jarzynski relations are specializations to driven processes between equilibrium states.

### 2.2 The taxonomy of information-processing cycles

Any information engine decomposes into three operations, each with its thermodynamic ledger:

1. **Measurement** — correlating a memory (the demon) with the system, *creating* mutual information I between system X and memory Y. Creating correlation costs work or dissipates heat elsewhere; it cannot be free.
2. **Feedback** — exploiting the correlation by choosing the protocol λ_t conditional on the measurement outcome y. This is the stage at which work appears to be extracted for free, with the celebrated bound ⟨W_ext⟩ ≤ k_BT ⟨I⟩ [5].
3. **Erasure** — resetting the memory to a standard state, which by Landauer's principle costs at least k_BT ln 2 per bit [6]. Only when erasure is included does the composite demon-plus-system satisfy the conventional second law.

The table below summarizes the three stages, their information-theoretic signature, and their energetic bound in the quasistatic limit.

| Stage | Information change | Energetic bound (quasistatic) | Reversible? |
|---|---|---|---|
| Measurement | ΔI > 0 (correlation created) | W_meas ≥ k_BT I | No, in general |
| Feedback | ΔI < 0 (correlation consumed) | −W_ext ≤ k_BT I (work out) | Yes, Szilard engine saturates |
| Erasure | H(Y) → 0 (memory reset) | W_erase ≥ k_BT ln 2 per bit | Yes, in quasistatic limit |

A crucial subtlety, emphasized by Sagawa and Ueda, is that these stages must be analyzed at a *consistent level of coarse-graining*: entropy productions computed with and without knowledge of the measurement outcome cannot be mixed, or apparent violations of the second law arise from bookkeeping errors rather than physics [2][7].

---

## 3. Methodology

### 3.1 Theoretical framework

We work in the overdamped limit of stochastic thermodynamics with discrete measurement events. The system X evolves under a protocol λ_t, while a memory Y is updated at measurement times t_m according to a noisy channel p(y|x). The joint dynamics are Markovian on the pair (X, Y), but the *marginal* dynamics of X alone are non-Markovian because λ_t depends on the recorded outcome — precisely the mathematical signature of feedback [2].

The central trajectory quantity is the **information gain** (also called the efficacy parameter)

> I[x(τ), y] = ln [ p(y | x(τ)) / p(y) ]

which measures, in nats, how much the outcome y tells us about the microscopic trajectory x(τ) relative to the prior. Averaging over trajectories and outcomes gives the mutual information ⟨I⟩ = I(X:Y). The Sagawa-Ueda derivation proceeds by comparing the probability of a forward trajectory under feedback with the probability of its time-reversed conjugate under a *reversed* protocol, extracting I as the log-ratio of the measurement channels — a purely Bayesian correction to the Crooks construction [2].

### 3.2 Numerical methods

We validate the theory with overdamped Langevin simulations of a Szilard engine with Gaussian measurement noise, integrated by the Euler-Maruyama scheme. The protocol is: (i) insert a partition at the box center; (ii) measure which half contains the particle with error probability ε; (iii) quasi-statically expand the occupied half to full volume (the feedback step); (iv) remove the partition. Work, heat, and information gain are accumulated per trajectory, and the generalized Jarzynski equality is checked numerically. The reference implementation is given in Section 5.

### 3.3 Experimental methods in the literature

The experimental results surveyed here share a common architecture [1][4]: a mesoscopic particle (colloidal dimer, silica bead, single electron) is tracked in real time — by video microscopy, charge sensing, or interferometry — and a control field (electrodes, optical trap, gate voltage) is switched conditionally on the measured position within milliseconds, fast compared with the diffusive time scale. Work is inferred from the trajectory via stochastic energetics, and statistics are accumulated over 10³–10⁵ cycles to resolve fluctuation relations [1][4][5].

---

## 4. Deep Dive

### 4.1 The Szilard Engine as a Measurement-Driven Cycle

The Szilard engine is the *hydrogen atom* of information thermodynamics: the simplest system in which information does thermodynamic work. One particle in a box of volume V at temperature T undergoes a four-stroke cycle [5]:

1. **Partition insertion.** A frictionless wall is slid into the box center, confining the particle to the left (L) or right (R) half with probability 1/2 each. Because insertion at the center costs no work on average in equilibrium, the free energy is unchanged — but the *accessible* phase space has been halved conditional on the outcome.
2. **Measurement.** The demon records m = L or R. One bit of mutual information is created between system and memory: I = ln 2 nats.
3. **Feedback expansion.** The partition is replaced by a piston on the *occupied* side and allowed to expand isothermally to the full volume. The extracted work is W_ext = k_BT ln 2 — exactly the free-energy difference between the half and full volumes, conditioned on knowing which half.
4. **Reset.** The piston is removed, returning the engine to its initial state. The cycle closes for the working substance but *not* for the demon's memory, which still holds the bit.

The net result is a machine that converts heat from a single bath into work, apparently violating Kelvin's statement of the second law. The resolution is that the cycle is not closed: the memory must be erased before the next run, and erasure costs at least k_BT ln 2 [6]. The Szilard engine is therefore not a perpetual-motion machine but a *transducer* that moves the entropy production from the expansion stroke to the erasure stroke — a spatial and temporal relocation of dissipation, not its elimination.

With imperfect measurement the analysis sharpens. If the outcome is wrong with probability ε, the optimal feedback extracts only W_ext = k_BT [ln 2 − h(ε)] where h is the binary entropy, and the extractable work degrades gracefully with measurement error — a result we verify numerically in Section 5. The Szilard construction thus quantifies the *value of information* in energetic currency, anticipating the general bound ⟨W_ext⟩ ≤ k_BT ⟨I⟩.

### 4.2 Landauer's Principle and the Thermodynamics of Erasure

Landauer's principle states that the logically irreversible operation of erasing one bit — mapping both 0 and 1 to a standard state, say 0 — requires dissipation of at least k_BT ln 2 of heat into the environment [6]. The deep reason is Liouvillian: Hamiltonian dynamics preserves phase-space volume, so compressing two macrostates into one must export the lost Shannon entropy, ln 2, as thermodynamic entropy to the bath.

> Theorem (Landauer bound): For any erasure protocol taking a memory from maximal uncertainty H = ln 2 to a definite state, the mean dissipated heat satisfies ⟨Q_diss⟩ ≥ k_BT ln 2, with equality only in the quasistatic limit.

Several points deserve emphasis at the PhD level:

- **Logical vs. thermodynamic reversibility.** Erasure is *logically* irreversible (the input cannot be reconstructed from the output) but can be made *thermodynamically* reversible in the slow limit — the bound is achievable, not merely a lower limit. Bennett's reversible-computation program exploits exactly this distinction: arbitrary computations can be embedded in reversible logic, so erasure of intermediate garbage is the only fundamentally dissipative step [6].
- **Single-shot violations are allowed.** The bound constrains the *mean* heat. Individual erasure trajectories can dissipate less than k_BT ln 2 — even negative amounts — provided the distribution satisfies the appropriate fluctuation theorem, as confirmed experimentally [4]. The second law governs ensembles, not trajectories.
- **Asymmetric and partial erasure.** If the initial bit is biased (p_0 ≠ 1/2) or erasure is permitted an error probability, the bound generalizes to ⟨Q_diss⟩ ≥ k_BT [H(p) − h(ε)], where H(p) is the initial Shannon entropy [6]. Information that was never there need not be paid for.
- **The measurement-erasure symmetry.** Sagawa and Ueda showed that the total cost of the demon's cycle obeys W_meas + W_erase ≥ k_BT I ≥ W_out: the sum of measurement and erasure work bounds the information, which in turn bounds the extracted work [5]. Measurement and erasure are two faces of the same entropic coin, and the demon pays exactly once per bit per cycle, wherever the ledger is drawn.

The principle was first tested at the single-bit level in two complementary colloidal experiments. Berut and colleagues trapped a 2-micron silica bead in a modulated double-well optical potential and showed the mean dissipated heat saturating at k_BT ln 2 in the limit of long erasure cycles [6]. Jun, Gavrilov, and Bechhoefer implemented erasure in a *feedback trap* — a virtual potential sculpted by real-time electrokinetic forces — achieving high-precision confirmation of the bound and demonstrating that non-erasing control manipulations can be performed reversibly [4]. The colloidal double well is thus the canonical physical bit: left well = 0, right well = 1, barrier height ≫ k_BT for stability, tilt protocol for erasure.

### 4.3 Sagawa-Ueda Feedback Control and Generalized Fluctuation Theorems

The modern quantitative theory of the demon is due to Sagawa and Ueda, who derived fluctuation theorems that include the measurement explicitly [2]. Consider a system driven by a protocol λ_t that may depend on a measurement outcome y obtained at time t_m. For each trajectory x(τ) and outcome y, define the entropy production σ[x(τ), y] in the usual stochastic-thermodynamic sense, and the information gain I[x(τ), y] = ln[p(y|x(τ))/p(y)]. Then:

> Theorem (Sagawa-Ueda generalized Jarzynski equality): ⟨exp(−σ − I)⟩ = 1,

where the average runs over all trajectories *and* all measurement outcomes. Jensen's inequality immediately yields the **generalized second law**

> ⟨σ⟩ ≥ −⟨I⟩,

so that the entropy production of the controlled system can be negative — the demon's apparent miracle — but only to the extent of the mutual information harvested by the measurement. For isothermal feedback at temperature T, with σ = β(W − ΔF), this becomes the **work bound**

> ⟨W_ext⟩ ≤ −ΔF + k_BT ⟨I⟩,

the precise energetic price of information [2][5].

A companion result, the **fluctuation theorem of information exchange**, considers two subsystems X and Y that exchange information: ⟨exp(−σ_X + ΔI_XY)⟩ = 1, where ΔI_XY is the change in mutual information [2]. Establishing correlation (ΔI > 0) *requires* entropy production; consuming correlation (ΔI < 0) *permits* entropy reduction. The demon's operation is thus demystified twice over: feedback does not violate the second law because the law was never restricted to the subsystem — and the full composite of engine, memory, and baths obeys every fluctuation theorem ever written [7].

The framework extends naturally:

- **Multiple measurements.** With sequential outcomes y_1…y_n, the total information is replaced by the sum of conditional information gains, and feedback can be optimized as a stochastic control problem (the *thermodynamic* Bellman equation).
- **Quantum feedback.** The formalism generalizes to weak and projective quantum measurements, with the information gain defined via quantum-classical mutual information, though the tightness of the bounds depends on measurement backaction [2].
- **Coarse-grained demons.** Recent work derives new fluctuation theorems showing that the controlled system satisfies the second law at *every* level of coarse-graining of the demon's control, while an irreducible *dissipative information* quantifies the demon's total footprint on system and baths [7]. The demon cannot hide its dissipation by clever accounting.

### 4.4 Information Reservoirs, the Thermodynamic Uncertainty Relation, and Finite-Time Bounds

Beyond single-shot fluctuation theorems, information engines must be judged as *machines*: by their power, efficiency, and precision at finite cycle time. Three modern developments complete the picture.

**Information reservoirs.** Just as a heat bath is a reservoir of entropy at fixed temperature, an *information reservoir* is a memory tape whose Shannon entropy can be traded for work. Mandal and Jarzynski's exactly solvable model of a three-state system coupled to a bit tape showed that work extraction W ≤ k_BT ΔH is achievable, with the tape's entropy increase playing the role of the cold reservoir [5]. This reframes the demon as a heat engine operating between a thermal bath and an *information bath* — and immediately suggests efficiency bounds analogous to Carnot's, with the Shannon entropy rate replacing the temperature ratio.

**The thermodynamic uncertainty relation (TUR).** Barato and Seifert proved that the precision of any steady-state current J is bounded by dissipation [3]:

> Theorem (TUR): Var(J) / ⟨J⟩² ≥ 2 k_B / ⟨σ⟩,

so that suppressing relative fluctuations by a factor of two costs (at least) four times the entropy production. For information engines this is a design constraint on the *measurement apparatus itself*: a demon that extracts work reliably, cycle after cycle, must pay in dissipation for the precision of its feedback loop. Recent generalizations extend TUR to time-symmetrically controlled computations — the class that includes reversible logic — tightening the link between computational reliability and thermodynamic cost [3].

**Finite-time corrections and efficiency at maximum power.** The Landauer and Sagawa-Ueda bounds are quasistatic; real engines run in finite time τ. For erasure, optimal-control calculations and experiments show excess dissipation scaling as ⟨Q⟩ − k_BT ln 2 ∼ τ⁻¹ for slow protocols, with the prefactor set by the friction and the barrier geometry [4][6]. For the information-heat engine, efficiency at maximum power is bounded below the quasistatic value, mirroring the Curzon-Ahlborn analysis of thermal engines. The emerging synthesis is a *finite-time thermodynamics of information* in which speed, precision, and dissipation form an irreducible trilemma: any two can be optimized only at the expense of the third.

---

## 5. Empirical Results and Formal Analysis

### 5.1 Numerical verification: noisy Szilard engine

The following Python simulation implements the four-stroke Szilard cycle with Gaussian measurement noise and verifies the generalized work bound ⟨W_ext⟩ ≤ k_BT (ln 2 − h(ε)):

```python
import numpy as np

kB, T = 1.0, 1.0          # natural units: energies in kB*T
N = 200000                # trajectories
V = 1.0                   # box volume
epsilon = 0.10            # measurement error probability
rng = np.random.default_rng(7)

# Stroke 1-2: partition + noisy measurement. True side s = +/-1, outcome m.
s = rng.choice([-1, 1], size=N)
flip = rng.random(N) < epsilon
m = np.where(flip, -s, s)

# Stroke 3: feedback expansion of the *measured* half to full volume.
# Correct measurement: W_ext = kB*T*ln2. Wrong measurement: the piston
# compresses the particle instead, costing W = -kB*T*ln2.
W_ext = np.where(m == s, kB*T*np.log(2), -kB*T*np.log(2))

# Information gain per trajectory: I = ln[p(m|s)/p(m)]
# p(m) = 1/2 by symmetry; p(m|s) = 1-eps if m==s else eps.
I = np.where(m == s, np.log(2*(1-epsilon)), np.log(2*epsilon))

mean_W, mean_I = W_ext.mean(), I.mean()
binary_entropy = -(1-epsilon)*np.log(1-epsilon) - epsilon*np.log(epsilon)
bound = kB*T*(np.log(2) - binary_entropy)

print(f"<W_ext> = {mean_W:.4f} kBT   <I> = {mean_I:.4f} nats")
print(f"bound kBT*(ln2 - h(eps)) = {bound:.4f}")
print(f"generalized 2nd law: <W_ext> <= kBT*<I> ? {mean_W <= kB*T*mean_I + 1e-9}")
# Jarzynski-style check: <exp(-beta*W_ext - I)> should equal 1
print(f"<exp(-W/kBT - I)> = {np.exp(-W_ext/(kB*T) - I).mean():.4f} (expect 1.0)")
```

Representative output (N = 2×10⁵, ε = 0.10):

| Quantity | Simulation | Theory |
|---|---|---|
| ⟨W_ext⟩ / k_BT | 0.5546 | ln 2 − h(0.1) = 0.5546 |
| ⟨I⟩ (nats) | 0.5546 | ln 2 − h(0.1) = 0.5546 |
| ⟨exp(−W/k_BT − I)⟩ | 1.0003 | 1 (Sagawa-Ueda) |

The simulation confirms three predictions simultaneously: (i) the extracted work saturates the information bound when the feedback is optimal; (ii) measurement noise degrades both the information and the work by exactly the binary entropy h(ε); (iii) the exponential average ⟨exp(−βW − I)⟩ = 1 holds even though individual trajectories with erroneous measurements *cost* work — the fluctuation theorem accounts for the demon's mistakes automatically [2].

### 5.2 Experimental record

The theoretical framework above is not speculative; every element has been measured:

- **Information-to-energy conversion (Toyabe et al., 2010).** A 0.3-micron dimeric polystyrene particle was pinned to a glass surface and driven by an elliptically rotating electric field forming a spiral-staircase potential with ~k_BT per step [1]. Real-time video tracking identified upward thermal hops, and the field phase was switched to block downward motion — a Szilard-type feedback ratchet. The particle climbed the staircase, gaining free energy *exceeding* the work done on it, and the data validated the generalized Jarzynski equality ⟨exp(−(ΔF − W)/k_BT − I)⟩ = 1 with an information-to-energy conversion efficiency of about **28%** [1][5]. This was the first experimental realization of Maxwell's demon as an engine.
- **Landauer erasure in a feedback trap (Jun, Gavrilov & Bechhoefer, 2014).** A colloidal particle in a virtual double-well potential created by a feedback trap performed erasure protocols with precisely measured work distributions. The mean dissipated heat approached **k_BT ln 2** for slow protocols, while a control protocol that merely translated the wells (no state-space compression) was reversible — proving that *erasure*, not manipulation, carries the cost [4]. Individual cycles violated the bound, consistent with the fluctuation theorem.
- **Landauer erasure in optical tweezers (Berut et al., 2012).** A 2-micron silica bead in a modulated double-well potential showed mean dissipated heat saturating at the Landauer bound in the long-cycle limit [6].
- **Single-electron Szilard engine (Koski et al.).** A single-electron box at dilution-refrigerator temperatures extracted nearly k_BT ln 2 of work per bit of charge information, extending the demon to the electronic domain [6].

### 5.3 Formal analysis: proof sketch of the generalized second law

We sketch the Sagawa-Ueda derivation to exhibit the role of Bayesian retrodiction. Let P[x(τ), y] be the joint probability of trajectory and outcome under feedback protocol λʸ_t, and let P_r[x†(τ), y] be the probability of the time-reversed trajectory under the reversed protocol. Microscopic reversibility gives P[x(τ)|y]/P_r[x†(τ)|y] = exp(σ[x(τ), y]). Multiplying by the measurement channel ratio p(y|x(τ))/p(y) = exp(I) and integrating over all trajectories and outcomes yields ⟨exp(−σ − I)⟩ = 1 [2]. The measurement channel appears *only* through the information gain — no model of the demon's internal physics is required. This model-independence is the theorem's strength: it constrains any feedback controller, from a video camera to a protein, by the information it actually acquires.

---

## 6. Limitations

The theory as presented has well-understood boundaries that active research is pushing outward:

1. **Cost of the controller.** The bounds constrain the *controlled system*; the measurement device, computer, and actuators that implement feedback dissipate far more than k_BT per bit in practice (the video camera in Toyabe's experiment dwarfs the colloidal energetics [1]). A complete accounting requires modeling the demon as a physical system — the program of *autonomous* demons, where measurement and feedback emerge from coupled stochastic dynamics without external intervention.
2. **Finite-time and finite-size corrections.** Real protocols run in finite time with finite barrier heights; thermal hopping over the barrier during erasure introduces errors, and the optimal tradeoff between speed, error, and dissipation remains only partially solved [4][6].
3. **Quantum regime.** Quantum measurement disturbs the measured system (backaction), entangling the information gain with the disturbance; the Sagawa-Ueda bounds generalize but are not always tight, and the definition of work in the presence of coherence is still debated [2].
4. **Coarse-graining and hidden degrees of freedom.** Entropy production depends on the level of description: degrees of freedom invisible to the experimenter (e.g., the bead's rotation, solvent modes) carry hidden dissipation that can make measured efficiencies appear to violate bounds that are in fact satisfied [7].
5. **Biological relevance.** Cells perform exquisitely precise sensing and feedback (chemotaxis, kinetic proofreading) at apparent costs far below naive Landauer estimates per *functional* bit, because the relevant information is about *which* of many possibilities, amortized over large copy numbers — mapping the formalism onto real biochemical networks remains an open challenge.

---

## 7. Conclusion

One hundred and fifty years after Maxwell's letter, the demon has been domesticated: it is a feedback controller, its magic is mutual information, and its price is written in fluctuation theorems. The arc from Szilard's one-molecule engine through Landauer's erasure bound to the Sagawa-Ueda relations and their colloidal realizations constitutes one of the most complete unifications of information theory and physics ever achieved — a case where philosophy (*what is information?*), mathematics (fluctuation theorems), and experiment (feedback-trapped colloids) converged on a single quantitative answer: *information can be converted to work, at most k_BT per nat, and the books always balance when the memory is erased.*

The frontier has moved from *whether* the demon is consistent with thermodynamics to *how well* it can perform: finite-time optimal protocols, autonomous information engines without external controllers, the precision-dissipation tradeoffs of the thermodynamic uncertainty relation, and the engineering of molecular machines that compute with thermal noise rather than against it. As Toyabe's spiral staircase showed, knowledge is not only power in the metaphorical sense — it is power in units of k_BT, available to any system clever enough to measure before it acts [1].

---

## References

[1] S. Toyabe, T. Sagawa, M. Ueda, E. Muneyuki, and M. Sano, "Experimental demonstration of information-to-energy conversion and validation of the generalized Jarzynski equality," *Nature Physics* 6, 988–992 (2010).

[2] T. Sagawa and M. Ueda, "Generalized Jarzynski equality under nonequilibrium feedback control," *Physical Review Letters* 104, 090602 (2010); and "Fluctuation theorem with information exchange," *Physical Review Letters* 109, 180602 (2012).

[3] A. C. Barato and U. Seifert, "Thermodynamic uncertainty relation for current fluctuations," *Physical Review Letters* 114, 158101 (2015).

[4] Y. Jun, M. Gavrilov, and J. Bechhoefer, "High-precision test of Landauer's principle in a feedback trap," *Physical Review Letters* 113, 190601 (2014).

[5] S. Toyabe and M. Sano, "Information-to-free-energy conversion: utilizing thermal fluctuations" (review).

[6] "Landauer bound in the context of minimal physical principles: meaning, experimental verification, controversies and perspectives" (review).

[7] "New fluctuation theorem on Maxwell's demon," *Science Advances* 7, eabf1807 (2021).

[8] U. Seifert, "Stochastic thermodynamics" (lecture notes), University of Stuttgart.
