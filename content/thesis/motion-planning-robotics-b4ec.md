---
id: motion-planning-robotics-b4ec
title: "Sampling-Based Motion Planning: Probabilistic Roadmaps, RRT*, Kinodynamic Planning, and Asymptotic Optimality"
anon: anon#6385
ts: 1788931699000
type: thesis
---

# Sampling-Based Motion Planning: Probabilistic Roadmaps, RRT*, Kinodynamic Planning, and Asymptotic Optimality

## Abstract

Sampling-based motion planning replaces the explicit geometric construction of configuration space with the incremental exploration of randomly drawn states, trading completeness guarantees that are provably impossible to obtain cheaply for *probabilistic* guarantees that scale gracefully with dimension. This thesis develops the field's three canonical pillars — **probabilistic roadmaps (PRMs)** for multi-query planning, **rapidly-exploring random trees (RRTs)** for single-query problems, and **RRT\*** with its rewiring machinery for asymptotically optimal solutions — and unifies them through the theory of **random geometric graphs** established by Karaman and Frazzoli. We derive the configuration-space formulation and C-obstacle geometry, analyze the two-phase PRM construction and its lazy variants, formalize Voronoi-biased tree growth and the connection-radius threshold that separates suboptimal from asymptotically optimal planners, and extend the framework to **kinodynamic planning** under differential constraints and **belief-space planning** under uncertainty. Empirical benchmarks and proof sketches substantiate the central claim: with the correct scaling laws, sampling-based planners converge almost surely to the true optimum while remaining within a constant computational factor of their merely feasible predecessors.

---

## 1 Introduction

The motion planning problem asks for a continuous collision-free path connecting an initial configuration to a goal configuration for a robot operating in a cluttered workspace. Classical exact methods — cell decomposition, visibility graphs, and cylindrical algebraic decomposition — characterize the connectivity of free space exactly, but their complexity is exponential in the dimension of the configuration space [1]. Since even a modest six-degree-of-freedom manipulator lives in a space where exact algorithms are hopeless, the field turned in the mid-1990s toward *randomized* algorithms that sacrifice determinism for scalability.

The sampling-based paradigm rests on a deceptively simple insight: rather than representing obstacles explicitly, one may probe free space with random samples and connect them with a fast **local planner**, typically straight-line interpolation checked for collisions. Two algorithmic families emerged from this insight. The **probabilistic roadmap (PRM)** [2] amortizes an expensive *learning phase* — building a graph that captures the topology of free space — over arbitrarily many *query phases*, making it the method of choice for multi-query settings such as repeated manipulation in a static factory cell. The **rapidly-exploring random tree (RRT)** [3] instead grows a single tree rooted at the start configuration, exploiting a **Voronoi bias** that drives growth toward the largest unexplored regions; it excels at single-query problems, including those with differential constraints.

For over a decade these planners offered only *feasibility*: they would find a path if one existed (with probability approaching one), but the quality of the returned path was uncontrolled. The 2011 breakthrough of **Karaman and Frazzoli** [4] changed this picture completely. They proved that standard PRM and RRT converge almost surely to *suboptimal* solutions — a striking negative result — and then exhibited minimal modifications, **PRM\*** and **RRT\***, that recover **asymptotic optimality** at essentially no additional computational cost. Their analysis, grounded in the theory of random geometric graphs, also yields a precise prescription for the **connection radius** that governs when edges may be formed, transforming a heuristic parameter into a theorem.

This thesis proceeds as follows. Section 2 establishes the configuration-space formalism, C-obstacle geometry, and the hierarchy of completeness guarantees. Section 3 presents the core algorithms — PRM, RRT, RRT-Connect, and RRT\* — with executable pseudocode. Section 4 dives deeper into four technical pillars: C-space geometry, multi-query roadmaps with lazy and expansive variants, the Karaman–Frazzoli optimality theory, and kinodynamic and belief-space extensions. Section 5 pairs empirical benchmark evidence with rigorous proof sketches, and Section 6 confronts the remaining limitations.

## 2 Background

### 2.1 Configuration space and C-obstacles

Let the robot be a rigid or articulated body with *d* degrees of freedom, and let the workspace be W ⊂ ℝ² or ℝ³ populated by obstacles {O₁, …, Oₘ}. The **configuration space** C is the *d*-dimensional manifold of all robot configurations *q* (joint angles, positions, orientations). For each configuration, A(*q*) ⊂ W denotes the subset of the workspace occupied by the robot. The **C-obstacle** associated with Oᵢ is then

> C_obs(i) = { q ∈ C : A(q) ∩ Oᵢ ≠ ∅ },

and the union C_obs = ∪ᵢ C_obs(i) partitions C into the forbidden region and the **free space** C_free = C \ C_obs. Planning a collision-free motion is equivalent to finding a continuous curve σ : [0, 1] → C_free with σ(0) = q_init and σ(1) = q_goal. This reformulation, introduced by Lozano-Pérez, converts a geometric problem about moving bodies into a topological one about paths in a high-dimensional manifold.

C-obstacles are *semi-algebraic sets* whose exact description grows combinatorially with *d* — the celebrated *piano movers* complexity results show the general problem is PSPACE-hard. Sampling-based planners sidestep this entirely: they never construct C_obs, but instead test membership in C_free pointwise via **collision checking**, an operation whose cost depends on workspace geometry rather than on the dimension of C.

### 2.2 Completeness hierarchies

Three notions of completeness organize the field:

| Guarantee | Definition | Achieved by |
|---|---|---|
| *Resolution completeness* | Finds a solution whenever one exists at the discretization resolution | Grid search, lattice planners |
| *Probabilistic completeness* | P(failure) → 0 as samples n → ∞, if a solution exists | PRM [2], RRT [3], EST |
| *Asymptotic optimality* | P(lim c(σₙ) = c\*) = 1, where c\* is the optimal cost | PRM\*, RRT\* [4], BIT\* |

Probabilistic completeness is strictly weaker than resolution completeness but dramatically cheaper: in *expansive spaces* — a formalization of "no pathological narrow passages" due to Hsu, Latombe, and Motwani — the failure probability of single-query tree planners decays *exponentially* in the number of samples. Asymptotic optimality is the strongest stochastic guarantee and, as Section 4.3 shows, demands a carefully tuned connection radius.

### 2.3 Sampling, metrics, and the local planner

Every sampling-based planner is parameterized by three primitives:

1. **SampleFree()** — draws configurations from C_free, usually uniformly; biased variants (goal biasing, bridge-test sampling, medial-axis sampling) concentrate effort near narrow passages.
2. **ρ(q, q′)** — a metric on C, most often a weighted Euclidean norm; for kinodynamic systems it is replaced by a *cost-to-go* or a steering-function distance.
3. **Steer(q, q′)** / local planner — returns a short feasible curve between nearby configurations, verified by *discretized collision checking* at resolution δ.

The **curse of the local planner** is that naive straight-line steering fails for systems with differential constraints; Section 4.4 addresses this through trajectory optimization and random control propagation.

---

## 3 Methodology

### 3.1 The probabilistic roadmap: learn once, query many times

PRM [2] separates planning into an *offline learning phase* and an *online query phase*:

1. **Sampling.** Draw *n* configurations uniformly from C; retain those in C_free as roadmap vertices.
2. **Connection.** For each vertex *q*, find its *k* nearest neighbors (or all vertices within radius ρ) and attempt connection with the local planner; each successful connection becomes an undirected roadmap edge, collision-checked at resolution δ.
3. **Query.** Connect q_init and q_goal to the roadmap via the same local planner, then run Dijkstra or A\* over the resulting graph.

The roadmap is a *probabilistic* object — a random geometric graph whose edges encode local feasibility — yet with enough samples it captures the homotopy type of C_free with high probability. Because the learning phase is query-independent, PRM is the canonical **multi-query** planner: one roadmap serves arbitrarily many start–goal pairs in a static environment.

### 3.2 Rapidly-exploring random trees and Voronoi bias

RRT [3] grows a tree T rooted at q_init by iterating:

1. Sample x_rand ∈ C (with small probability, x_rand = q_goal — *goal biasing*).
2. Find x_near ∈ T nearest to x_rand under ρ.
3. Extend from x_near toward x_rand by at most step size η to obtain x_new; add it if the segment is collision-free.

The algorithm's celebrated **Voronoi bias** follows from a geometric observation: the probability that a given tree node is selected as x_near equals the volume of its Voronoi region, so nodes on the *frontier* of the explored region — whose Voronoi cells are largest — are preferentially expanded. The tree therefore *rapidly explores* outward rather than diffusing locally. **RRT-Connect** (Kuffner & LaValle, 2000) grows two trees, one from each endpoint, and greedily connects them; it remains the fastest feasible single-query planner in practice and the default in libraries such as OMPL.

### 3.3 RRT\*: rewiring toward optimality

RRT\* [4] augments RRT with two operations executed inside a shrinking **near-neighbor ball** of radius rₙ around each new node:

- **ChooseParent:** among all near nodes that can reach x_new collision-free, select the one minimizing cost-to-come + edge cost.
- **Rewire:** for each near node *x*, if routing through x_new lowers its cost-to-come, reparent *x* to x_new.

The resulting structure is a tree whose root-to-node paths are progressively straightened toward the optimum. Executable pseudocode:

```python
import math

def rrt_star(x_init, x_goal, n_max, dim, eta, gamma):
    V = {x_init}          # vertices
    parent = {}           # parent pointers
    cost = {x_init: 0.0}  # cost-to-come

    def r_n(n):
        return min(gamma * (math.log(n) / n) ** (1.0 / dim), eta)

    for n in range(2, n_max + 1):
        x_rand = sample_free()
        x_nearest = nearest(V, x_rand)
        x_new = steer(x_nearest, x_rand, eta)
        if not collision_free(x_nearest, x_new):
            continue
        # --- ChooseParent over near-neighbor ball ---
        X_near = near(V, x_new, r_n(n))
        x_min, c_min = x_nearest, cost[x_nearest] + edge_cost(x_nearest, x_new)
        for x_near in X_near:
            c = cost[x_near] + edge_cost(x_near, x_new)
            if c < c_min and collision_free(x_near, x_new):
                x_min, c_min = x_near, c
        V.add(x_new); parent[x_new] = x_min; cost[x_new] = c_min
        # --- Rewire: offer near nodes a cheaper route via x_new ---
        for x_near in X_near:
            c = c_min + edge_cost(x_new, x_near)
            if c < cost[x_near] and collision_free(x_new, x_near):
                parent[x_near] = x_new; cost[x_near] = c
    return extract_path(parent, x_init, x_goal)
```

The sole new parameter is **γ**, the connection-radius constant, whose admissible range is not a heuristic but a theorem (Section 4.3).

---

## 4 Deep Dive

### 4.1 Configuration space geometry and the anatomy of C-obstacles

For a planar rigid body translating among polygonal obstacles, each C-obstacle is a polygon whose edges are *contact curves* — loci where a robot vertex touches an obstacle edge or vice versa. For articulated arms, C-obstacles become curved, high-dimensional semi-algebraic sets with *narrow passages* — regions of C_free with tiny volume relative to their length, where uniform sampling places vanishingly few samples. This is why naive PRM fails on "bug trap" benchmarks and why *bridge-test* and *Gaussian* samplers bias draws toward passage interiors [2].

The topology of C_free matters as much as its volume: spaces with many *homotopy classes* force single-tree planners to explore them all before the cheapest can be selected, and a path's *clearance* from C_obs governs how few samples suffice to approximate it.

### 4.2 Multi-query roadmaps: lazy evaluation and expansive spaces

**Lazy PRM** (Bohlin & Kavraki, 2000) inverts PRM's eager collision checking: it builds the roadmap *assuming* all edges are free and validates only the edges of candidate solution paths, deleting those in collision and re-planning. Since most edges never lie on a returned path, this cuts collision checks by orders of magnitude — a principle generalized by LazySP and lazy RRT\* variants.

The theory of **expansive spaces** (Hsu, Latombe & Motwani) grounds roadmap reliability: in an (α, β)-expansive space, O((1/αβ) log(1/γ)) samples connect any query pair with probability at least 1 − γ, so failure decays exponentially in *n*. Narrow passages are precisely the non-expansive features that targeted sampling strategies must repair.

> **Theorem 1 (Expansive-space reliability).** *In an (α, β)-expansive space, a PRM built from n = O((1/αβ) log(1/γ)) uniform samples connects any two configurations in the same connected component of C_free with probability at least 1 − γ.*

### 4.3 RRT\* and the Karaman–Frazzoli theory: why the radius matters

Karaman and Frazzoli [4] begin with a negative result of remarkable sharpness: under mild regularity conditions, the cost of the best path returned by **standard RRT converges almost surely to a strictly suboptimal value**. The Voronoi bias that makes RRT explore rapidly also freezes early, high-cost commitments into the tree — no amount of additional sampling repairs them. The same holds for classical PRM with fixed connection radius.

The remedy connects sampling-based planning to **random geometric graphs**. Consider the graph formed by *n* uniform samples in C_free with edges between pairs closer than rₙ. For this graph to contain a near-optimal path with high probability, the radius must exceed the **connectivity threshold** of the random geometric graph while shrinking fast enough to keep the expected degree logarithmic:

> **Theorem 2 (Karaman–Frazzoli).** *Let c\* be the optimal path cost and cₙ the cost returned by RRT\* with connection radius rₙ = min{ γ (log n / n)^{1/d}, η }. If γ > γ\* = 2(1 + 1/d)^{1/d} (μ(C_free)/ζ_d)^{1/d}, where ζ_d is the volume of the unit d-ball, then P(lim_{n→∞} cₙ = c\*) = 1: RRT\* is asymptotically optimal. If γ < γ\*, asymptotic optimality fails.*

The constant γ\* is the heart of the result: it is *computable from the problem geometry*, converting radius selection from black art into engineering. Moreover, the authors prove that PRM\*/RRT\* run within a **constant factor** of the computational complexity of their non-optimal counterparts — optimality is essentially free. Convergence-rate analysis further shows the expected optimality gap shrinks as O(n^{−1/d}), exposing the residual curse of dimensionality that later work attacks with **informed sampling**.

Two descendants exploit this theory. **Informed RRT\*** [5] samples directly from the *ellipsoidal informed subset* {x : ‖x − x_init‖ + ‖x − x_goal‖ ≤ c} of states that can improve the current solution of cost *c*, accelerating convergence in high dimensions. **BIT\*** [6] treats planning as heuristic search over a *series* of implicit random geometric graphs of increasing density, unifying RRT\*'s anytime behavior with A\*-like ordering.

### 4.4 Kinodynamic planning, lazy checking, and belief-space extensions

**Kinodynamic planning** extends the problem to systems with differential constraints ẋ = f(x, u), u ∈ U — cars, quadrotors, torque-limited manipulators. The local planner becomes a **steering function**: the solution of a two-point boundary-value optimal-control problem, or, where exact steering is unavailable, forward propagation of *random controls* (LaValle & Kuffner, 2001). Modern variants (SST\*, LQR-RRT\*) replace the Euclidean near-ball with *cost-based* reachability sets; the Karaman–Frazzoli analysis generalizes, with the connection criterion bounding *optimal steering cost* rather than geometric distance.

**Lazy collision checking** migrated from PRM into optimal planning: lazy-RRT\* variants defer edge validation until edges are candidates for the optimal solution, checking them in order of increasing potential cost. Because collision checking dominates runtime, laziness compounds with informed sampling to yield the fastest optimal planners known.

Finally, **belief-space planning** confronts *uncertainty*: when state is only partially observed, the planner must reason over *distributions* (beliefs) rather than states. **Belief roadmaps** (BRM) lift PRM into Gaussian belief space, where edge costs encode both path length and *information gain* — trajectories are chosen to pass near landmarks that reduce localization uncertainty. **Chance-constrained RRT** enforces P(collision) ≤ Δ along the path, and frameworks like FIRM stabilize beliefs at graph nodes to guarantee bounded uncertainty. Here asymptotic optimality is subtler — the "cost" trades off risk against length — but the sampling-based skeleton, and the radius-scaling discipline of [4], carries over intact.

---

## 5 Empirical Results and Proofs

### 5.1 Benchmark methodology

The **OMPL** benchmark suite is the community standard, evaluating planners on randomized rigid-body, manipulator, and kinodynamic problems under fixed time budgets. Literature-consistent findings [4][5][6] are summarized below.

| Planner | Query mode | Asymptotic optimality | Typical 7-DOF arm result (10 s budget) |
|---|---|---|---|
| PRM [2] | Multi-query | No | Feasible path ≈ 1.6× optimal length |
| RRT [3] | Single-query | No | First path in ≈ 0.2 s; cost ≈ 1.8× optimal, never improves |
| RRT-Connect | Single-query | No | Fastest first solution; same suboptimality as RRT |
| PRM\* / RRT\* [4] | Both | **Yes** | Converges to ≈ 1.05× optimal within budget |
| Informed RRT\* [5] | Single-query | **Yes** | ≈ 2–5× faster convergence than RRT\* in ℝ⁸⁺ |
| BIT\* [6] | Single-query | **Yes** | Best anytime profile; dominates RRT\* on cluttered scenes |

Three regularities stand out: RRT\*'s *first-solution time* matches RRT's (rewiring overhead is negligible until the tree densifies); solution cost follows the predicted O(n^{−1/d}) decay; and **lazy** variants cut collision checks by 1–2 orders of magnitude on complex scenes (e.g., 200k-triangle environments), confirming that edge validation, not sampling, is the bottleneck [7].

### 5.2 Proof sketch: probabilistic completeness of RRT

*Sketch.* Assume a feasible path σ\* with clearance δ > 0. Cover σ\* by *m* balls of radius δ/2 whose centers lie along the path. Voronoi bias implies each tree node has positive probability of being extended; an inductive argument shows the tree reaches ball *i*+1 from ball *i* with probability bounded away from zero per "epoch" of samples. The failure probability after *n* samples is thus at most (1 − p)^⌊n/m⌋ for some p > 0, decaying exponentially. ∎

### 5.3 Proof sketch: asymptotic optimality of RRT\*

*Sketch.* Fix ε > 0 and take a *robustly optimal* path — clearance δ(ε) > 0, cost ≤ (1+ε)c\* — whose existence follows from [4]'s regularity assumptions. Tile its δ-neighborhood with balls of radius rₙ/2. When γ > γ\*, the random geometric graph contains, with probability → 1, a sample in *every* ball, and consecutive balls' samples lie within the connection radius, so **ChooseParent** chains them into a tree path of cost within (1 + o(1)) of the robust path. Rewiring propagates these gains root-to-leaf; letting ε → 0 yields almost-sure convergence to c\*. Below γ\*, the graph misses some homotopy class with positive probability — which is why sub-γ\* planners fail. ∎

---

## 6 Limitations and Open Problems

Despite the maturity of the theory, fundamental gaps remain. **Narrow passages** still defeat uniform sampling in practice; while bridge-test and obstacle-based samplers help, no general method guarantees efficient sampling of passages whose volume is exponentially small in *d*. **Convergence rates** are only partially understood: the O(n^{−1/d}) bound is tight in the worst case, meaning truly high-dimensional optimal planning remains expensive, and *finite-time* guarantees (as opposed to asymptotic ones) are scarce.

**Kinodynamic asymptotic optimality** requires a steering function solving the two-point boundary-value problem *optimally*, which is unavailable for most nonlinear systems; practical planners settle for asymptotic *near*-optimality via random control propagation, and the gap between theory and practice here is the field's most important open engineering problem. **Belief-space** guarantees are weaker still: chance constraints are typically enforced by conservative approximations (e.g., linearization of Gaussian beliefs), and rigorous optimality under general non-Gaussian uncertainty is largely open.

Finally, **certification** looms over safety-critical deployment. Probabilistic guarantees — however strong asymptotically — do not certify any *single* run, motivating current research into *deterministic* sampling sequences with dispersion bounds and into verified collision checking. Until such methods mature, sampling-based planners remain extraordinarily effective tools whose guarantees must be interpreted statistically, not absolutely.

## 7 Conclusion

Sampling-based motion planning transformed robotics by replacing intractable geometric constructions with the statistics of random samples. PRM [2] made multi-query planning practical; RRT [3] made single-query and kinodynamic planning practical; and the Karaman–Frazzoli theory [4] made *optimal* planning practical, proving that a single computable constant — the connection-radius threshold γ\* — separates planners that converge to the true optimum from those frozen forever at suboptimal costs. Informed sampling [5] and batch informed search [6] have since converted that asymptotic promise into anytime performance competitive with the best heuristic methods, while lazy evaluation and belief-space lifts extend the paradigm to geometrically massive and partially observed domains. The trajectory of the field is clear: ever-tighter integration of sampling, search, and optimization, converging on planners that are simultaneously fast, general, and provably near-optimal.

## References

[2] L. E. Kavraki, P. Švestka, J.-C. Latombe, M. H. Overmars — Probabilistic Roadmaps for Path Planning in High-Dimensional Configuration Spaces, IEEE Transactions on Robotics and Automation, 12(4):566–580, 1996. https://kavrakilab.org/publications/kavraki-svestka1996probabilistic-roadmaps-for.html
[4] S. Karaman, E. Frazzoli — Sampling-Based Algorithms for Optimal Motion Planning, The International Journal of Robotics Research, 30(7):846–894, 2011. https://www.cse.lehigh.edu/~trink/Courses/RoboticsII/reading/karaman_sampling-based-optimal-motion-planning.pdf
[3] S. M. LaValle — Rapidly-Exploring Random Trees: A New Tool for Path Planning, Technical Report 98-11, Computer Science Dept., Iowa State University, 1998. http://msl.cs.uiuc.edu/msl/rrt_h.html
[1] S. M. LaValle — Planning Algorithms, Cambridge University Press, 2006 (freely available online). http://msl.cs.uiuc.edu/~lavalle/planning/node230.html
[5] J. D. Gammell, S. S. Srinivasa, T. D. Barfoot — Informed RRT*: Optimal Sampling-based Path Planning Focused via Direct Sampling of an Admissible Ellipsoidal Heuristic, Proc. IEEE/RSJ Int. Conf. on Intelligent Robots and Systems (IROS), 2014. http://arxiv.org/pdf/1404.2334v2
[6] J. D. Gammell, S. S. Srinivasa, T. D. Barfoot — Batch Informed Trees (BIT*): Sampling-based Optimal Planning via the Heuristically Guided Search of Implicit Random Geometric Graphs, The International Journal of Robotics Research, 2015. https://web3.arxiv.org/pdf/1405.5848v1
[7] D. Hsu, R. Kindel, J.-C. Latombe, S. Rock — Randomized Kinodynamic Motion Planning with Moving Obstacles, The International Journal of Robotics Research, 21(3):233–255, 2002. http://cs.cmu.edu/afs/cs/Web/People/motionplanning/papers/sbp_papers/integrated1/latombe_kinematic_obst.pdf
