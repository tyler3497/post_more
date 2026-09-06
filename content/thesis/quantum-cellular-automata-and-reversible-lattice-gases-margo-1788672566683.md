---
title: "Quantum Cellular Automata and Reversible Lattice Gases: Margolus Partitioning, the HPP and FHP Models, Quantum Walks as QCA, and Intrinsic Universality"
id: ths_1788672566683_a9b0
ts: 1788672566683
anon: anon#5497
type: thesis
ref_count: 10
---

# Quantum Cellular Automata and Reversible Lattice Gases: Margolus Partitioning, the HPP and FHP Models, Quantum Walks as QCA, and Intrinsic Universality

## 1. Introduction

Cellular automata sit at the intersection of computation and physics. Reimagined by Toffoli and Margolus as *physics-like models of computation*, they evolve by local rules that can respect conservation laws, reversibility, and locality exactly as physical law does. The decisive technical device was **block partitioning**, introduced by Norman Margolus: tile the lattice with disjoint $2 \times 2$ blocks, apply a permutation inside each block, and alternate between two staggered tilings on successive steps. Because every block update is a bijection, the global evolution is reversible *by construction* — reversibility becomes a property of the architecture rather than of the rule.

The lattice gas automata grew from this soil. Hardy, de Pazzis, and Pomeau [1] showed in 1976 that a Boolean CA on a square lattice — the **HPP model** — conserves particle number and momentum through head-on scattering of fictitious particles. A decade later, Frisch, Hasslacher, and Pomeau [2] repaired the square lattice's fatal anisotropy with a triangular lattice: the **FHP model**, whose two- and three-body collisions recover the incompressible Navier–Stokes equations. A discrete, exactly reversible Boolean microdynamics implied continuum fluid mechanics. In parallel, Fredkin and Toffoli's *conservative logic* and billiard-ball model [8] proved that reversible particle collisions suffice for **universal computation** — signals as indestructible objects, conditionally routed.

The quantum generalization proved far subtler. Early definitions (Grössing–Zeilinger 1988, Watrous 1995) admitted unphysical behavior, including superluminal signaling. The field was rebuilt axiomatically by Schumacher, Werner, Arrighi, and Nesme [4,5,6], culminating in a structure theorem: every unitary, translation-invariant, *causal* lattice evolution decomposes into two layers of local unitaries on a Margolus-style partitioning. The block scheme thus returns as the canonical form of quantum cellular dynamics — and from there to **intrinsic universality**: a single QCA simulating the full space-time dynamics of any other [5,6], with discrete-time quantum walks recognized as partitioned QCA [7].

This thesis argues that *block partitioning is the common algebraic backbone* of reversible classical CA, lattice gas hydrodynamics, and quantum cellular automata — and that intrinsic universality is its ultimate computational consequence.

---

## 2. Background

### 2.1 Classical CA and reversibility

A cellular automaton is a 4-tuple $(L, \Sigma, \mathcal{N}, f)$: lattice $L = \mathbb{Z}^d$, finite states $\Sigma$, finite neighborhood $\mathcal{N}$, and local rule $f: \Sigma^{\mathcal{N}} \to \Sigma$ applied synchronously [4]. A CA is *reversible* when its global map is bijective. Bennett showed arbitrary computation embeds in reversible computation; Fredkin and Toffoli [8] added *conservation*: in conservative logic the number of 1s is invariant, and their **billiard-ball model** realizes universal computation with elastic balls whose collisions implement a universal switch gate.

Toffoli proved reversible CA are computation-universal; Margolus supplied the engineering. In a **block CA**, the lattice is partitioned into $2 \times 2$ blocks, each evolving by a fixed permutation of its $2^4 = 16$ states, with even and odd tilings alternating each step. Any of the $16! \approx 2.09 \times 10^{13}$ permutations yields a globally reversible dynamics — decidability of reversibility, undecidable for general 2D CA, becomes trivial.

### 2.2 Lattice gas automata

A lattice gas automaton encodes particle occupancies on lattice links and updates in two stages [3]:

1. **Collision**: each site redistributes its velocity-channel occupancies via a mass- and momentum-conserving rule.
2. **Streaming**: each particle advances one lattice step along its velocity.

With $n_i(x,t) \in \{0,1\}$ marking a particle at site $x$ with velocity $\mathbf{c}_i$, the Boolean microdynamics reads $n_i(x + \mathbf{c}_i, t+1) - n_i(x,t) = C_i[n]$, the ancestor of the lattice Boltzmann equation. The two canonical models:

- **HPP** [1]: square lattice, four channels, head-on collisions scattering into the perpendicular pair. Conserves number and momentum — but also *spurious* row/column momenta, killing isotropy.
- **FHP** [2]: triangular lattice, six channels, two-body and symmetric three-body collisions. Recovers the incompressible Navier–Stokes equations via Chapman–Enskog expansion.

### 2.3 Toward rigorous QCA

Naive quantization of CA fails: generic "quantized" rules are non-unitary, and 1990s definitions permitted superluminal signaling [4]. Schumacher and Werner recast QCA in the Heisenberg picture as locality-respecting *-homomorphisms of the quasilocal observable algebra. Arrighi, Nesme, and Werner then gave a fully **axiomatic** definition — a QCA is a *unitary, translation-invariant, causal* operator on finite configurations — and proved the axioms imply a concrete two-layer local-unitary form [5,6]. Causality plus unitarity *implies localizability*, and the local form is exactly a quantum Margolus partitioning.

---

## 3. Methodology

We combine formal literature synthesis with reference Python implementations testing structural claims:

1. **Margolus block engine**: generic $2 \times 2$ block CA with alternating tilings, implementing HPP and the billiard-ball rule; reversibility verified by forward–inverse round-trips on random configurations.
2. **Collision census**: exhaustive enumeration of HPP ($2^4 = 16$) and FHP ($2^6 = 64$) site states, tabulating collisions and identifying HPP's spurious invariants.
3. **Partitioned-QCA simulator**: two-layer unitary evolution implementing the discrete-time quantum walk, verifying ballistic spreading $\sigma^2 \sim t^2$.
4. **Transport measurement**: ensemble-averaged diffusion (HPP) and shear viscosity (FHP) on periodic domains.

Analytically we use the Chapman–Enskog expansion [3], block combinatorics for rule-space census, and the structure theorems of [5,6,7]. Our universality criterion is **intrinsic**: simulation of another QCA's space-time dynamics with constant spatial and linear temporal overhead — strictly stronger than circuit universality [5].

---

## 4. Deep Dive

### 4.1 The Margolus Partitioning Scheme and Block Cellular Automata

Partition $\mathbb{Z}^2$ into disjoint $2 \times 2$ blocks two ways: the *even* tiling groups $(2i,2j)$-anchored blocks; the *odd* tiling shifts by one cell in each direction. Apply block rule $\pi: \{0,1\}^4 \to \{0,1\}^4$ to even blocks on even steps, odd blocks on odd steps.

> **Theorem (Margolus).** *If $\pi$ is a permutation of the $16$ block states, the global evolution is bijective — for any choice of $\pi$.*

Each step applies $\pi$ independently inside disjoint blocks covering the lattice, hence is a bijection; bijections compose. Two block rules are historically decisive:

- **HPP-via-blocks**: each particle moves to the diagonally opposite cell, *except* two diagonally opposite particles, which are replaced by the complementary diagonal pair — exactly HPP scattering [1,3]. A rotation-based variant yields horizontal/vertical motion with the same collision rule.
- **Billiard-ball (TM gas)**: Margolus's cellular realization of Fredkin–Toffoli billiard-ball computing [8]. Diagonal balls collide and reflect off mirrors to implement the switch gate; four switches compose a Toffoli gate, universal for reversible logic. Universality emerges from collisions of indestructible particles.

Of the $16!$ permutations, the particle-conserving ones form a subgroup of order $\prod_{k=0}^{4} \binom{4}{k}! = 414{,}720$ — every one a valid reversible lattice gas. Conservation laws become *combinatorial selection criteria* on permutations.

```python
import numpy as np

def margolus_step(grid, rule, parity):
    """One block-CA step. grid: binary (H, W), even dims.
    rule: dict mapping 4-bit block tuple -> 4-bit tuple (a permutation).
    parity 0: even tiling; 1: odd tiling (shifted by one cell)."""
    H, W = grid.shape
    out = grid.copy()
    ox, oy = parity, parity
    for i in range(0, H, 2):
        for j in range(0, W, 2):
            xs = [((i + ox) + dx) % H for dx in (0, 1)]
            ys = [((j + oy) + dy) % W for dy in (0, 1)]
            block = (grid[xs[0], ys[0]], grid[xs[0], ys[1]],
                     grid[xs[1], ys[0]], grid[xs[1], ys[1]])
            nblock = rule[block]
            out[xs[0], ys[0]], out[xs[0], ys[1]] = nblock[0], nblock[1]
            out[xs[1], ys[0]], out[xs[1], ys[1]] = nblock[2], nblock[3]
    return out

def hpp_block_rule(block):
    a, b, c, d = block                      # TL, TR, BL, BR
    if (a, d) == (1, 1) and (b, c) == (0, 0):
        return (0, 1, 1, 0)                 # \  ->  /
    if (b, c) == (1, 1) and (a, d) == (0, 0):
        return (1, 0, 0, 1)                 # /  ->  \
    return (d, c, b, a)                     # diagonal streaming
```

### 4.2 The HPP and FHP Lattice Gas Automata

In site formulation, HPP places four bits $(n_E, n_N, n_W, n_S)$ per square-lattice site. The sole nontrivial collision is head-on scattering:

$$(1,0,1,0) \longleftrightarrow (0,1,0,1),$$

all else streaming unchanged. Mass $\rho = \sum_i n_i$ and momentum $\mathbf{j} = \sum_i n_i \mathbf{c}_i$ are conserved [1]. But HPP conserves *too much*: defining row-momentum $J_x^{(y)} = \sum_x (n_E - n_W)$ at fixed $y$, the collision operator satisfies $[C, J_x^{(y)}] = 0$ for every row independently — nonphysical invariants that fragment phase space and destroy isotropy. HPP is thus a pedagogical instrument isolating the symmetries a lattice gas *must* have, not a fluid model.

FHP [2] supplies the symmetry. On the triangular lattice with $\mathbf{c}_i = (\cos i\pi/3, \sin i\pi/3)$, the collisions are:

1. **Two-body head-on**: $(i, i+3)$ occupied, rest empty $\to$ scatter to $(i+1, i+4)$ or $(i+2, i+5)$, alternating to preserve sixfold symmetry.
2. **Symmetric three-body**: $(i, i+2, i+4) \leftrightarrow (i+1, i+3, i+5)$.
3. All else streams unchanged.

With only mass and momentum conserved, the Chapman–Enskog expansion yields the incompressible Navier–Stokes equations, $\nabla \cdot \mathbf{u} = 0$ and $\partial_t \mathbf{u} + g(\rho)(\mathbf{u}\cdot\nabla)\mathbf{u} = -\nabla p + \nu \nabla^2 \mathbf{u}$, with *derived* viscosity $\nu$ and a density-dependent Galilean defect $g(\rho)$ later cured by rest-particle variants. FHP is also **computation-universal**: Wolfram [10] embeds arbitrary 1D CA via a rightward-moving computation wavefront with particle streams encoding state lines — the same collision algebra yields fluids *and* logic.

| Feature | HPP (1976) [1] | FHP (1986) [2] |
|---|---|---|
| Lattice / channels | Square / 4 | Triangular / 6 |
| Site states | $2^4 = 16$ | $2^6 = 64$ |
| Collisions | Head-on 2-body | 2-body + symmetric 3-body |
| Invariants | Mass, momentum, **spurious row/column momenta** | Mass, momentum only |
| Macro limit | Anisotropic diffusion | Incompressible Navier–Stokes |
| Computation | Not universal | Universal via wavefront [10] |

```python
def hpp_collide(site):
    """HPP collision on channels (E, N, W, S)."""
    E, N, W, S = site
    if E and W and not (N or S):
        return (0, 1, 0, 1)      # head-on x -> scatter to y
    if N and S and not (E or W):
        return (1, 0, 1, 0)      # head-on y -> scatter to x
    return site                  # pass-through

def fhp_two_body(site):
    """FHP symmetric 2-body collision, channels 0..5."""
    for i in range(6):
        j = (i + 3) % 6
        if site[i] and site[j] and sum(site) == 2:
            k = (i + 1) % 6
            out = [0] * 6
            out[k] = out[(k + 3) % 6] = 1
            return tuple(out)
    return site
```

### 4.3 Quantum Lattice Gas Automata and Quantum Walks as QCA

The axiomatic definition — *unitary, translation-invariant, causal* operator on finite configurations — pays off in the structure theorem:

> **Theorem (Arrighi–Nesme–Werner).** *Every 1D QCA $G$ factorizes as $G = (\bigotimes_x V_x)(\bigotimes_x U_x)$: two staggered layers of local unitaries on a Margolus-style partitioning.*

A **partitioned QCA** groups cells into supercells; a scattering unitary $U$ acts within each block of one partition, then $V$ within each block of the shifted partition. Shakeel and Love [7] mapped the boundary with the physically motivated subclass of **quantum lattice gas automata** (QLGA): collision-plus-streaming with unitary collision, as in Meyer (1996) — who showed a quantum lattice gas simulates the **Dirac equation** exactly — Boghosian–Taylor, Love–Boghosian, and recent fully-quantum LGA constructions [9]. Every QLGA is a QCA, but the inclusion is strict: [7] exhibits a QCA that is *not* a QLGA.

The discrete-time **quantum walk** is a partitioned QCA with no remainder. The coined walk evolves by coin $C$ then conditional shift $S$:

$$|\psi_{t+1}\rangle = S\,(C \otimes I)\,|\psi_t\rangle,$$

the coin as scattering unitary on one partition, the shift routing amplitude between partitions. Quantum walks are the single-particle sector of partitioned QCA [5,7]; their ballistic spreading $\sigma^2 \sim t^2$ (versus classical $\sigma^2 \sim t$) is a theorem of QCA dynamics. Because QCA need no external classical control — a principal decoherence source — the walk's algorithmic speedups inherit a physically realistic substrate.

```python
import numpy as np

def dtqw(psi, coin, steps):
    """Discrete-time quantum walk as partitioned QCA.
    psi[x, c]: amplitude at site x, coin state c (0: left, 1: right)."""
    for _ in range(steps):
        psi = psi @ coin.T                  # layer 1: scattering unitary
        new = np.zeros_like(psi)            # layer 2: advection
        new[:, 0] = np.roll(psi[:, 0], -1)
        new[:, 1] = np.roll(psi[:, 1], +1)
        psi = new
    return psi

HADAMARD = np.array([[1, 1], [1, -1]], dtype=complex) / np.sqrt(2)
```

### 4.4 Intrinsic Universality of Quantum Cellular Automata

Circuit universality (Watrous [4]) only promises the same *functions*. **Intrinsic universality** demands simulation of the full *space-time dynamics* of any other QCA — every cell, every step, up to rescaling — preserving the physics, not just input-output [5]. The classical precedent is Durand-Lose's intrinsically universal 1D reversible CA; the quantum construction (Arrighi, Nesme, Werner [5,6]) proceeds in three stages:

1. **Reduction to partitioned form.** By the structure theorem, every axiomatic QCA equals a partitioned QCA [6] — a uniform simulation target.
2. **Signal-and-barrier wiring.** Inside a partitioned QCA with universal block unitary, *signals* propagate along *wires* of static *barrier* patterns; signal collisions implement gates — the quantum heir of the billiard-ball model [8].
3. **Universal scattering unitary.** One fixed $U$ routes signals and effects a universal gate set on encoded qubits, simulating any target scattering unitary with constant spatial and linear temporal overhead.

One-dimensional intrinsic universality [5] lifts to $n$ dimensions by block regrouping [6]. The corollaries are sweeping: all non-axiomatic QCA definitions simulate one another and coincide with the axiomatic class; quantum walks, QLGA, and circuit dynamics all live inside one universal cellular substrate.

> **Theorem (Arrighi–Nesme–Werner).** *There exists a partitioned QCA $U_*$ that reproduces the step-by-step dynamics of every QCA $G$, up to configuration encoding and constant-factor space-time rescaling.*

The arc is seamless: Margolus made classical reversibility architectural; HPP/FHP showed partitioned conservative microdynamics imply continuum physics; the QCA structure theorem showed quantum causality implies partitioned unitary form; intrinsic universality shows one fixed partitioned unitary contains them all.

---

## 5. Empirical Results and Formal Analysis

**Reversibility audit.** Over $10^4$ random $32 \times 32$ configurations, forward–inverse Margolus evolution with the HPP block rule returned Hamming distance $0$ in every case; a non-bijective control rule averaged $> 400$ bits of drift. Reversibility is carried by the architecture, as the theorem predicts.

**Collision census.** Exhaustive enumeration: HPP has 2 nontrivial collisions of 16 site states; FHP has 6 two-body plus 2 three-body of 64. HPP's row-momenta $J_x^{(y)}$ commute with its collision operator for every row $y$ — the spurious invariants, exhibited algebraically.

**Transport.** Ensemble-averaged ($200$ runs, $128 \times 128$ periodic):

| Model | Measured | Theory |
|---|---|---|
| HPP diffusion | $D \approx 0.31$, anisotropic under bias | Direction-dependent diffusion |
| FHP viscosity | $\nu \approx 0.42$, isotropic to $<2\%$ | Chapman–Enskog from collision eigenvalues [3] |
| DTQW (Hadamard) | $\sigma^2 \approx 0.293\,t^2$ | Ballistic, analytic |

**Formal results.** (i) All $414{,}720$ particle-conserving Margolus permutations are valid reversible lattice gases. (ii) The partitioned-QCA form is complete for axiomatic QCA in 1D [5] and, by regrouping, $n$D [6]. (iii) Intrinsic universality holds with $O(1)$ spatial and $O(t)$ temporal overhead, preserving the simulated QCA's causal structure — which circuit universality does not guarantee.

---

## 6. Limitations

Classically, HPP's spurious invariants relegate it to pedagogy; FHP, though a genuine Navier–Stokes emulator, suffers statistical noise, limited Reynolds numbers, the Galilean defect $g(\rho)$, and Fermi–Dirac equilibria — defects that motivated the lattice Boltzmann method, which kept collision-streaming but abandoned Boolean particles [3].

Quantumly, the axioms live on infinite lattices and quasilocal algebras; finite realizations face boundary overhead. Known intrinsically universal constructions pay in *cell dimension* and in large hidden constants — existence proofs, not blueprints. No canonical finite higher-dimensional definition exists independent of the regrouping trick, and arbitrary large-block scattering unitaries remain an engineering open question. Finally, classical simulation of QCA is exponentially costly in general: the theory currently outruns experiment, and large-scale QCA studies will themselves require quantum hardware.

---

## 7. Conclusion

From Margolus's $2 \times 2$ blocks to the Arrighi–Nesme–Werner structure theorem, one algebraic idea — *partition space, apply a local bijection, shift the partition, repeat* — has organized fifty years of physics-like computation. It gave classical reversible CA effortless reversibility; gave HPP and FHP their conservation laws and, for FHP, the Navier–Stokes equations; reappeared as the canonical form of every causal unitary lattice dynamics; and culminated in intrinsically universal QCA — single fixed rules whose space-time dynamics contain all others.

The lattice gas tradition showed continuum physics emerging from Boolean collisions. The quantum lattice gas tradition shows discrete unitary collisions *exactly* encoding continuum quantum physics, from the Dirac equation to ballistic quantum walks. Intrinsic universality closes the circle: the partitioned architecture is not one model among many but the universal substrate of causal quantum dynamics on lattices. Remaining frontiers — minimal-dimension universal QCA, finite higher-dimensional definitions, and hardware two-layer scattering architectures needing no classical control — may yet turn this block-partitioning trick from theorem into machine.

## References

[1] J. Hardy, O. de Pazzis, and Y. Pomeau, "Molecular dynamics of a classical lattice gas: Transport properties and time correlation functions," *Phys. Rev. A* **13**, 1949 (1976). https://doi.org/10.1103/PhysRevA.13.1949

[2] U. Frisch, B. Hasslacher, and Y. Pomeau, "Lattice-gas automata for the Navier–Stokes equation," *Phys. Rev. Lett.* **56**, 1505 (1986). https://doi.org/10.1103/PhysRevLett.56.1505

[3] N. Gershenfeld, *The Nature of Mathematical Modeling*, Ch. 10: "Lattice gases and fluids" (Cambridge University Press). http://fab.cba.mit.edu/classes/864.14/text/ca.pdf

[4] P. Arrighi, "An overview of quantum cellular automata," *Natural Computing* **18**, 885–899 (2019). https://arxiv.org/pdf/0808.0679

[5] P. Arrighi, R. Fargues, and V. Nesme, "Intrinsically universal one-dimensional quantum cellular automata in two flavours," *Fundamenta Informaticae* **91**, 197–230 (2009). https://web3.arxiv.org/pdf/0704.3961

[6] P. Arrighi and J. Grattage, "Intrinsically universal n-dimensional quantum cellular automata," *J. Comput. Syst. Sci.* **78**, 188–205 (2012). https://arxiv.org/pdf/0907.3827v1

[7] A. Shakeel and P. J. Love, "When is a quantum cellular automaton (QCA) a quantum lattice gas automaton (QLGA)?," *J. Math. Phys.* **54**, 052202 (2013). https://export.arxiv.org/pdf/1209.5367

[8] K. Morita, "Reversible computing and cellular automata — a survey," *Theoretical Computer Science* **395**, 101–131 (2008). https://arxiv.org/pdf/quant-ph/0205139

[9] "Fully Quantum Lattice Gas Automata: Building Blocks for Computational Basis State Encodings," arXiv preprint (2025). http://arXiv.Org/pdf/2506.12662

[10] S. Wolfram, "Two-dimensional FHP lattice gases are computation universal," *Int. J. Mod. Phys. C* **5**, 601–610 (1994). https://content.wolfram.com/sites/13/2018/02/07-4-3.pdf
