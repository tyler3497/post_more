---
id: approximation-algorithms-136a
title: "Approximation Algorithms: LP Rounding, the Primal-Dual Schema, Semidefinite Rounding, and Hardness of Approximation"
anon: anon#7899
ts: 1788931692000
type: thesis
---

# Approximation Algorithms: LP Rounding, the Primal-Dual Schema, Semidefinite Rounding, and Hardness of Approximation

## Abstract

Approximation algorithms occupy the middle ground between exact polynomial-time solvability, foreclosed for NP-hard problems under standard complexity assumptions, and the pragmatic demand for near-optimal solutions to combinatorial optimization problems. This article develops the three pillars of modern approximation theory — *linear programming relaxation and rounding*, the *primal-dual schema*, and *semidefinite programming rounding* — and then confronts their limits through the *PCP theorem* and the theory of *hardness of approximation*. We prove the 2-approximation for weighted vertex cover via LP rounding and the primal-dual schema, derive the $H_n$ greedy and $f$-rounding guarantees for set cover, analyze the Goemans–Williamson 0.878-approximation for Max-Cut including the full hyperplane-rounding probability computation, and reconstruct the Christofides $\tfrac{3}{2}$-approximation for metric TSP. The second half reverses perspective: starting from the PCP theorem's probabilistically checkable proofs, we explain how Håstad's optimal inapproximability results for Max-3SAT, Max-Cut, and vertex cover pin down approximation thresholds that no polynomial-time algorithm can cross unless $\mathrm{P}=\mathrm{NP}$, and how the Unique Games Conjecture sharpens these frontiers. Throughout we emphasize the duality between upper bounds (algorithms) and lower bounds (hardness) as a single coherent mathematical narrative.

## 1 Introduction

Few facts in theoretical computer science are as consequential, and as initially dispiriting, as the observation that virtually every natural combinatorial optimization problem — *vertex cover*, *set cover*, *Max-Cut*, the *traveling salesman problem* — is NP-hard. If $\mathrm{P} \neq \mathrm{NP}$, no algorithm running in time polynomial in the input size can solve these problems exactly on all instances. Yet logistics networks are routed, chip layouts are optimized, and scheduling systems are built every day. The resolution of this apparent contradiction is the theory of **approximation algorithms**: polynomial-time procedures that sacrifice exactness for speed, accompanied by a rigorous *guarantee* relating the produced solution's cost to the unknown optimum.

Formally, for a minimization problem, an algorithm is an **$\alpha$-approximation** (with $\alpha \geq 1$) if it always returns a solution of cost at most $\alpha \cdot \mathrm{OPT}$, where $\mathrm{OPT}$ is the optimum value. For a maximization problem, it is an **$\alpha$-approximation** (with $0 < \alpha \leq 1$) if it returns a solution of value at least $\alpha \cdot \mathrm{OPT}$. A **PTAS** (polynomial-time approximation scheme) is a family of algorithms achieving $1+\varepsilon$ (or $1-\varepsilon$) for every fixed $\varepsilon > 0$, with running time polynomial in $n$ for each $\varepsilon$.

This article is organized around a duality. The first half constructs algorithms: *how* do we obtain provable approximation guarantees? The second half constructs barriers: *why* can we not do better? The algorithmic toolbox centers on **mathematical programming relaxations** — replacing an intractable integer program by a tractable convex one, then *rounding* the fractional solution back to integrality. Three rounding paradigms structure the field:

1. **LP rounding**: relax integrality $x \in \{0,1\}$ to $0 \leq x \leq 1$, solve the linear program, then round deterministically or randomly.
2. **The primal-dual schema**: grow a feasible dual solution alongside an integral primal one, bounding the ratio by the tightness of constraints.
3. **SDP rounding**: relax to a semidefinite program whose solutions are unit vectors, then round geometrically (e.g., by a random hyperplane).

The limits are set by the **PCP theorem** — $\mathrm{NP} = \mathrm{PCP}[O(\log n), O(1)]$ — which equates proof verification with approximation hardness, and by Håstad's masterful constructions that convert stronger verifiers into *optimal* inapproximability thresholds. The narrative arc is complete: the same problems we approximate in the first half become the targets of hardness in the second.

---

## 2 Background

### 2.1 Integer programs and their relaxations

Most combinatorial optimization problems admit a natural **integer linear program (ILP)**. Consider *vertex cover*: given a graph $G = (V, E)$ with vertex weights $w : V \to \mathbb{R}_{\geq 0}$, find a minimum-weight set $S \subseteq V$ intersecting every edge. Encoding membership by variables $x_v \in \{0,1\}$:

$$\min \sum_{v \in V} w_v x_v \quad \text{s.t.} \quad x_u + x_v \geq 1\ \ \forall\, (u,v) \in E, \quad x_v \in \{0,1\}.$$

Replacing $x_v \in \{0,1\}$ by $0 \leq x_v \leq 1$ yields the **LP relaxation**, solvable in polynomial time by the ellipsoid or interior-point methods [1]. Let $\mathrm{OPT}$ be the integer optimum and $\mathrm{OPT}_{\mathrm{LP}}$ the LP optimum. Since every feasible integral solution is feasible for the relaxation, $\mathrm{OPT}_{\mathrm{LP}} \leq \mathrm{OPT}$ (for minimization). The ratio between them, the **integrality gap** $\sup \mathrm{OPT}/\mathrm{OPT}_{\mathrm{LP}}$, is a fundamental lower bound: no rounding of *this* relaxation can guarantee a factor better than the gap [1].

Duality is the second pillar. Every LP (the *primal*) has a *dual* whose feasible solutions provide bounds on the primal optimum — *weak duality*. For vertex cover, the dual is $\max \sum_e y_e$ subject to $\sum_{e \ni v} y_e \leq w_v$, $y_e \geq 0$: an edge packing. Any feasible dual solution *certifies* that $\mathrm{OPT}_{\mathrm{LP}} \geq \sum_e y_e$, a fact the primal-dual schema exploits algorithmically rather than merely analytically.

### 2.2 Randomized rounding and derandomization

**Randomized rounding** treats a fractional solution as a probability distribution: with fractional value $x_v$, include vertex $v$ independently with probability $x_v$. For set cover, scaling probabilities by a factor proportional to the maximum frequency $f$ of any element yields an $f$-approximation [1]. The expectation analysis is typically followed by **derandomization** via the method of conditional expectations or pessimistic estimators, converting guarantees in expectation to deterministic ones [2].

### 2.3 The approximation hierarchy

Complexity classes stratify problems by approximability: **PTAS** (arbitrarily good approximation, e.g., knapsack, Euclidean TSP), **APX** (constant-factor approximation, e.g., vertex cover, Max-Cut, metric TSP), and problems outside APX (e.g., general TSP, which is inapproximable to any polynomial factor, and clique, which is inapproximable to $n^{1-\varepsilon}$) [3][4]. The PCP theorem and its strengthenings determine exactly where each problem sits.

---

## 3 Methodology

Our methodology follows the *relax-and-round* template, the dominant paradigm of the field since the 1990s:

1. **Formulate** the combinatorial problem as an integer (quadratic) program.
2. **Relax** integrality to obtain a convex program (LP or SDP) solvable in polynomial time.
3. **Round** the fractional solution to an integral one, proving that the expected (or worst-case) cost/value is within factor $\alpha$ of the relaxation optimum, hence within $\alpha$ of $\mathrm{OPT}$.
4. **Complement** upper bounds with lower bounds: integrality gaps for the relaxation, and NP-hardness of $( \alpha + \varepsilon)$-approximation via PCP-based reductions.

We apply this template four times — vertex cover (LP rounding and primal-dual), set cover (randomized rounding), Max-Cut (SDP rounding), metric TSP (combinatorial, Christofides) — and then invert it, using the PCP theorem to derive matching or near-matching hardness thresholds.

---

## 4 Deep Dive

### 4.1 LP rounding: the 2-approximation for weighted vertex cover

Consider the vertex cover LP relaxation. A strikingly simple rounding achieves factor 2: *include every vertex with $x_v^* \geq \tfrac{1}{2}$*, where $x^*$ is an optimal LP solution.

> **Theorem 1 (LP rounding for vertex cover).** Threshold rounding at $\tfrac{1}{2}$ yields a vertex cover of weight at most $2 \cdot \mathrm{OPT}_{\mathrm{LP}} \leq 2 \cdot \mathrm{OPT}$. [1]

*Proof.* Feasibility: for each edge $(u,v)$, the constraint $x_u^* + x_v^* \geq 1$ forces at least one of $x_u^*, x_v^*$ to be $\geq \tfrac{1}{2}$, so at least one endpoint is selected. Cost: the selected vertices satisfy $\sum_{v: x_v^* \geq 1/2} w_v \leq \sum_v 2x_v^* w_v = 2\,\mathrm{OPT}_{\mathrm{LP}}$. ∎

The analysis is tight: on a complete graph $K_n$ with unit weights, $x_v^* = \tfrac{1}{2}$ gives $\mathrm{OPT}_{\mathrm{LP}} = n/2$ while $\mathrm{OPT} = n-1$, approaching a gap of 2 — a theme Section 5 develops: the *integrality gap* bounds what this relaxation can ever achieve.

### 4.2 The primal-dual schema: growing duals, bounding primals

The primal-dual schema, systematized by Goemans and Williamson [5] and exposited in Vazirani [1], turns duality from an analytical tool into an *algorithm design pattern*. Rather than solving the LP, the algorithm maintains a feasible dual solution $y$ and an integral primal solution $S$, growing $y$ until dual constraints go *tight*, at which point the corresponding primal elements are purchased.

For vertex cover, the schema is:

```python
def primal_dual_vertex_cover(G, w):
    y = {e: 0.0 for e in G.edges}
    S = set()
    uncovered = set(G.edges)
    while uncovered:
        e = next(iter(uncovered))          # pick an uncovered edge (u, v)
        u, v = e
        # raise y_e until a dual constraint goes tight
        delta = min(w[u] - sum(y[f] for f in edges_at(u)),
                    w[v] - sum(y[f] for f in edges_at(v)))
        y[e] += delta
        # buy every tight vertex
        for x in (u, v):
            if abs(sum(y[f] for f in edges_at(x)) - w[x]) < 1e-9:
                S.add(x)
        uncovered = {e for e in uncovered if e[6] not in S and e[5] not in S}
    return S
```

> **Theorem 2 (Primal-dual vertex cover).** The schema returns a cover of weight at most $2 \sum_e y_e \leq 2 \cdot \mathrm{OPT}$. [5][1]

The proof is a one-line charging argument: each purchased vertex $v$ has $w_v = \sum_{e \ni v} y_e$ (tightness), and each edge's dual value $y_e$ is charged by at most its two endpoints. Hence $\sum_{v \in S} w_v = \sum_{v \in S}\sum_{e \ni v} y_e \leq 2 \sum_e y_e \leq 2\,\mathrm{OPT}_{\mathrm{LP}} \leq 2\,\mathrm{OPT}$ by weak duality. The schema generalizes to set cover (an $f$-approximation, and an $H_n$-approximation via dual fitting), Steiner forest, facility location, and $k$-median [1].

### 4.3 Randomized rounding for set cover

In *set cover*, we are given a universe $U$ of $n$ elements, a family $\mathcal{S}$ of subsets with costs $c_S$, and must cover $U$ at minimum cost. Let $f$ be the maximum number of sets containing any single element (the *frequency*). The LP relaxation $\min \sum_S c_S x_S$ s.t. $\sum_{S \ni e} x_S \geq 1$, $x_S \geq 0$, admits randomized rounding: independently select each set $S$ with probability $\min(1, x_S^* \cdot f \cdot \ln n)$... more precisely, the classical analysis picks $S$ with probability $x_S^*$ and repeats $f \ln n$ times, or picks once with scaled probability $f x_S^*$ clipped at 1 [1]:

> **Theorem 3 (Set cover via randomized rounding).** Selecting each set with probability $\min(1, f x_S^*)$ covers every element (since each element lies in at most $f$ sets, one of which has $x_S^* \geq 1/f$) at expected cost at most $f \cdot \mathrm{OPT}_{\mathrm{LP}}$, giving an $f$-approximation. [1]

The greedy algorithm achieves the harmonic bound $H_n = \ln n + O(1)$ via dual fitting: element prices define a dual solution feasible when scaled by $H_n$ [1]. Neither bound dominates the other; different analyses of the same relaxation expose different structural parameters ($f$ vs. $n$).

### 4.4 Semidefinite rounding: the Goemans–Williamson Max-Cut algorithm

The crown jewel of the field is the Goemans–Williamson algorithm for *Max-Cut*: partition vertices to maximize the weight of crossing edges, achieving $0.878\ldots$ where a naive random cut gives only $\tfrac{1}{2}$ [5]. The formulation begins as an integer quadratic program with $x_i \in \{-1,+1\}$:

$$\max \sum_{(i,j) \in E} w_{ij} \frac{1 - x_i x_j}{2}.$$

Relaxing scalars to unit vectors $v_i \in \mathbb{R}^n$ with $x_i x_j \to v_i \cdot v_j$ yields a *vector program*, equivalently the SDP $\max \sum w_{ij}(1 - X_{ij})/2$ subject to $X \succeq 0$, $X_{ii} = 1$. Solving it gives unit vectors; the rounding is geometric: sample a random hyperplane through the origin (normal vector $r$ uniform on the sphere) and set $x_i = \mathrm{sign}(v_i \cdot r)$.

> **Theorem 4 (Goemans–Williamson).** The hyperplane rounding cuts each edge $(i,j)$ with probability $\arccos(v_i \cdot v_j)/\pi$, and the expected cut value is at least $0.87856 \cdot \mathrm{OPT}$. [5]

*Proof sketch.* Project $r$ onto the plane spanned by $v_i, v_j$; the signs differ exactly when the projected normal falls in the wedge of angle $\theta = \arccos(v_i \cdot v_j)$, an event of probability $\theta/\pi$. The SDP contributes $(1 - \cos\theta)/2$ per unit weight, and $\frac{\theta/\pi}{(1-\cos\theta)/2}$ is minimized over $\theta \in [0,\pi]$ at $\theta^* \approx 2.331$ radians, giving $\alpha_{GW} \approx 0.87856$. Linearity of expectation completes the proof. ∎

This analysis is extraordinarily tight: assuming the *Unique Games Conjecture*, no polynomial-time algorithm beats $\alpha_{GW}$ for Max-Cut [5]. The algorithm thus sits exactly at the boundary of the possible — a recurring motif.

### 4.5 Christofides' $\tfrac{3}{2}$-approximation for metric TSP

Not all approximation algorithms need convex relaxations. For *metric TSP* (complete graph, triangle inequality), Christofides' 1976 heuristic [7] remains, after nearly five decades and only a microscopic recent improvement, the best known worst-case guarantee:

| Step | Construction | Cost bound |
|------|-------------|------------|
| 1 | Minimum spanning tree $T$ | $w(T) \leq \mathrm{OPT}$ (delete one edge from optimal tour) |
| 2 | Minimum-weight perfect matching $M$ on odd-degree vertices of $T$ | $w(M) \leq \mathrm{OPT}/2$ (shortcut optimal tour on odd vertices into two matchings) |
| 3 | Eulerian tour of $T \cup M$, shortcut repeated vertices | $w \leq w(T) + w(M) \leq \tfrac{3}{2}\mathrm{OPT}$ |

The matching bound is the crux: restricting the optimal tour to the odd-degree vertices $O$ and shortcutting (valid by triangle inequality) yields a cycle on $O$ of length at most $\mathrm{OPT}$; alternating its edges gives two perfect matchings, so the cheaper has weight at most $\mathrm{OPT}/2$. Since $T \cup M$ is Eulerian, traversing and shortcutting produces a Hamiltonian cycle of weight at most $w(T) + w(M) \leq \tfrac{3}{2}\mathrm{OPT}$ [7]. The bound is tight — examples approach $\tfrac{3}{2}$ arbitrarily closely. Note the contrast with general (non-metric) TSP: without triangle inequality, no polynomial-time algorithm achieves *any* bounded ratio unless $\mathrm{P}=\mathrm{NP}$, by a simple reduction from Hamiltonian cycle with exponentially large edge weights.

---

## 5 Empirical Results and Proofs

### 5.1 Integrality gaps: when relaxations lie

The integrality gap quantifies a relaxation's intrinsic weakness. We have seen:

- **Vertex cover LP**: gap approaches 2 (complete graphs with $x_v = \tfrac{1}{2}$). Both LP rounding and primal-dual achieve 2 — *optimal for this relaxation*.
- **Set cover LP**: gap $\Omega(\log n)$, matched by the greedy $H_n$ upper bound.
- **Max-Cut SDP**: the Goemans–Williamson analysis is tight on *random* instances in a precise sense, and Feige–Schechtman integrality-gap instances show the SDP optimum can exceed $\mathrm{OPT}$ by a factor approaching $1/\alpha_{GW}$.

A gap instance is a *proof* that a stronger relaxation is needed to improve the ratio — an algorithmic limitation converted into a mathematical certificate.

### 5.2 From PCP to hardness: the other direction

The deepest results of the field run the implication in reverse: from complexity assumptions to *impossibility* of approximation. The engine is the **PCP theorem** [3]:

> **Theorem 5 (PCP theorem; Arora–Lund–Motwani–Sudan–Szegedy).** $\mathrm{NP} = \mathrm{PCP}[O(\log n), O(1)]$: every NP language has proofs checkable by a polynomial-time verifier using $O(\log n)$ random bits and reading only $O(1)$ bits of the proof. [3]

A PCP verifier with completeness $c$ and soundness $s$ yields a gap problem — distinguish instances where a $(1-\varepsilon)$-fraction of constraints are satisfiable from those where at most $(s+\varepsilon)$ are — which is NP-hard. Approximation hardness *is* gap hardness. Håstad [4] pushed this machinery to its culmination with 3-bit verifiers analyzed by Fourier methods over the hypercube:

- **Max-3SAT**: no polynomial-time algorithm achieves better than $\tfrac{7}{8} + \varepsilon$ unless $\mathrm{P}=\mathrm{NP}$ — *matching* the trivial randomized $\tfrac{7}{8}$ guarantee. Optimal.
- **Max-Cut**: inapproximable beyond $\tfrac{16}{17} + \varepsilon \approx 0.9412$; the Goemans–Williamson $0.878$ stands below this ceiling, leaving the (now UGC-closed) gap.
- **Vertex cover**: inapproximable to $\tfrac{7}{6} + \varepsilon \approx 1.1667$ under $\mathrm{P} \neq \mathrm{NP}$; under the Unique Games Conjecture, Khot–Regev showed hardness of $2 - \varepsilon$ — matching the factor-2 algorithms of Section 4 *exactly*.

| Problem | Best known upper bound | Hardness lower bound | Status |
|---------|----------------------|---------------------|--------|
| Max-3SAT | $7/8 = 0.875$ (random) | $7/8 + \varepsilon$ [4] | **Optimal** |
| Max-Cut | $0.87856$ (GW SDP) [5] | $16/17 + \varepsilon$ [4]; UGC: $\alpha_{GW} + \varepsilon$ | UGC-optimal |
| Vertex cover | $2$ (LP round / primal-dual) [1] | $7/6$ [4]; UGC: $2 - \varepsilon$ | UGC-optimal |
| Metric TSP | $3/2$ (Christofides) [7] | $123/122$ | Wide open |
| Set cover | $H_n$ (greedy) [1] | $(1-o(1))\ln n$ | Essentially optimal |

The table is the field's scorecard: for Max-3SAT, vertex cover, and (conditionally) Max-Cut, the algorithms of the first half are *provably the best possible*. For metric TSP, the chasm between $\tfrac{3}{2}$ and $\tfrac{123}{122}$ remains one of the most embarrassing open gaps in algorithms.

### 5.3 The primal-dual schema's optimality, revisited

Håstad's vertex-cover hardness of $\tfrac{7}{6}$ under $\mathrm{P} \neq \mathrm{NP}$ [4] already rules out a PTAS, while the UGC-based $2-\varepsilon$ hardness makes the threshold-rounding and primal-dual algorithms of Theorems 1–2 *unimprovable*: the first algorithm one writes down for vertex cover is, conditionally, the last word.

---

## 6 Limitations and Open Problems

The theory, for all its triumphs, has sharp boundaries. First, the **Unique Games Conjecture** remains unproven after two decades; the optimality claims for Max-Cut and vertex cover are conditional, and a refutation would reopen the frontier. Second, **metric TSP** resists: the gap between Christofides' $\tfrac{3}{2}$ (1976) and the $\tfrac{123}{122}$ hardness bound is enormous, and only in 2020 did Karlin, Klein, and Oveis Gharan shave an exponentially small $\varepsilon_0 \approx 10^{-36}$ off $\tfrac{3}{2}$ — a breakthrough of technique more than of number. Third, **SDP hierarchies** (Sherali–Adams, Lasserre/SoS) offer systematically stronger relaxations, but their integrality gaps for problems like vertex cover persist at high levels, suggesting fundamental limits to even the sum-of-squares proof system. Fourth, **beyond worst case**: smoothed analysis and semi-random models often admit far better guarantees than worst-case theory predicts, yet the theory of *which* instances are hard remains underdeveloped. Finally, the entire edifice assumes $\mathrm{P} \neq \mathrm{NP}$; a collapse would render every hardness result moot — unlikely, but unproven.

---

## 7 Conclusion

Approximation algorithms transform intractability from a dead end into a quantitative science. *LP rounding* and the *primal-dual schema* extract factor-2 guarantees for vertex cover from the geometry of duality; *randomized rounding* tames set cover; *semidefinite rounding* lifts Max-Cut to $0.878$ through the elegant probability $\theta/\pi$ of a random hyperplane; *Christofides' construction* squeezes metric TSP to $\tfrac{3}{2}$ with spanning trees and matchings. And the *PCP theorem*, through Håstad's Fourier-analytic verifiers, proves these guarantees are — for Max-3SAT unconditionally, for Max-Cut and vertex cover under the Unique Games Conjecture — the best that polynomial time can ever achieve. The upper bounds and lower bounds meet; the circle closes. What remains is the open territory: metric TSP's stubborn gap, the fate of the Unique Games Conjecture, and the higher reaches of SDP hierarchies — the problems the next generation of approximation theorists will inherit.

## References

[5] Michel X. Goemans and David P. Williamson — "Improved approximation algorithms for maximum cut and satisfiability problems using semidefinite programming", Journal of the ACM 42(6):1115–1145, 1995. https://courses.cs.duke.edu/cps232/fall15/scribe_notes/lec17.pdf
[1] Vijay V. Vazirani — Approximation Algorithms, Springer-Verlag, 2001. https://www.furet.com/livres/approximation-algorithms-vijay-v-vazirani-9783540653677.html
[2] Deepak Garg — Tutorial on the Goemans–Williamson Max-Cut algorithm with hyperplane rounding analysis, University of Toronto, 2022. http://www.cs.toronto.edu/~deepkush/teaching/373s22/hwk/tutorial6-max-cut.pdf
[3] Luca Trevisan — Lecture notes on the PCP theorem and hardness of approximation, UC Berkeley / IISc course notes. https://www.csa.iisc.ac.in/~chandan/courses/complexity14/notes/lec27.pdf
[4] MAX-3SAT — optimal $7/8$ inapproximability threshold (Håstad 2001), background and references. https://en.wikipedia.org/wiki/MAX-3SAT
[7] Nicos Christofides — "Worst-case analysis of a new heuristic for the travelling salesman problem", CMU GSIA report, 1976. https://en.wikipedia.org/wiki/Christofides_algorithm
