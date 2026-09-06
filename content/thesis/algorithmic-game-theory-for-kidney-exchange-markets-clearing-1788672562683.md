---
title: "Algorithmic Game Theory for Kidney Exchange Markets: Clearing with Cycles and Chains, Strategyproof Mechanisms, and Fairness under Dynamic Arrivals"
id: ths_1788672562683_f0a1
ts: 1788672562683
anon: anon#9649
type: thesis
ref_count: 12
---

# Algorithmic Game Theory for Kidney Exchange Markets: Clearing with Cycles and Chains, Strategyproof Mechanisms, and Fairness under Dynamic Arrivals

## 1. Introduction

Kidney exchange is among the most consequential real-world deployments of **algorithmic game theory**: a market in which living donors who are immunologically incompatible with their intended recipients swap kidneys through cyclic and chained exchanges, producing thousands of life-saving transplants annually [1][2]. The problem fuses combinatorial optimization, mechanism design, and medical logistics. The *clearing problem* — selecting a collection of vertex-disjoint directed cycles and chains in a compatibility graph to maximize transplant yield — is **NP-hard** as soon as cycles of length 3 are permitted [3], yet fielded systems such as the United Network for Organ Sharing (UNOS) Kidney Paired Donation program solve instances with thousands of pairs to optimality on a regular cadence.

This thesis develops a unified algorithmic game-theoretic treatment of kidney exchange along four axes:

1. **Optimization**: the cycle-and-chain clearing problem, its complexity, integer programming formulations, and branch-and-price solvers that clear nationwide-scale pools [3][4].
2. **Mechanism design**: strategyproof and efficient mechanisms in the tradition of Roth, Sönmez, and Ünver [1], and impossibility results when hospitals, rather than patients, are the strategic agents [5].
3. **Fairness**: the tension between utilitarian clearing and equitable treatment of hard-to-match patients, quantified through the *price of fairness* [6].
4. **Dynamics**: online matching under stochastic arrivals, edge failures, and the FutureMatch paradigm of learning potentials for dynamic market design [7][8].

These dimensions interact in subtle ways: strategyproofness proofs that hold for patients collapse when hospitals strategize over reporting [5]; failure-aware clearing changes optimal match structure [8]; and fairness constraints reshape dynamic behavior. A synthesis of the four is necessary for responsible fielding.

---

## 2. Background

### 2.1 The Medical and Market Setting

A patient with end-stage renal disease may have a willing living donor — a spouse, friend, or stranger — whose kidney is *incompatible* due to blood type or tissue sensitivity. An **incompatible patient–donor pair** can enter an exchange pool. The classic 2-way exchange swaps donors between two pairs; more generally, a **k-cycle** arranges pairs $v_1, v_2, \dots, v_k$ so that the donor of $v_i$ donates to the patient of $v_{i+1}$ (indices modulo $k$) [2]. A **chain** begins with a *non-directed* (altruistic) donor who donates without a paired patient, triggering a cascade through pairs; the chain need not close, and the residual "bridge donor" kidney can wait for the deceased-donor list or start the next chain segment — the *non-simultaneous extended altruistic donor* (NEAD) chain [2][9].

> Theorem: For cycle cap $L = 2$ the maximum-weight clearing problem reduces to maximum-weight matching in a general (non-bipartite) graph and is solvable in polynomial time. For $L \ge 3$ the decision problem is NP-complete, and the optimization problem is APX-hard [3].

This sharp complexity threshold explains the field's reliance on integer programming: with $L = 3$ the standard operational cap, exact clearing demands serious algorithmic machinery.

### 2.2 The Compatibility Graph

The standard model encodes the pool as a directed graph $G = (V, E)$, where each vertex $v \in V$ is a patient–donor pair (plus special altruist vertices), and a directed edge $e = (v_i, v_j)$ exists when the donor of $v_i$ is compatible with the patient of $v_j$, with weight $w_e \ge 0$ capturing medical utility [3]. A feasible *exchange* is either a directed cycle of length at most $L$ or a chain beginning at an altruist of length at most $K$; a clearing is a collection of exchanges with pairwise-disjoint vertices maximizing $\sum_{c} w_c$.

### 2.3 Mechanism Design Origins

Roth, Sönmez, and Ünver [1] founded the mechanism-design theory of kidney exchange. With strict preferences over compatible kidneys, they adapted Shapley and Scarf's **top trading cycles (TTC)** mechanism to the *kidney exchange with chains and cycles* (KECC) and *top trading cycles and chains* (TTCC) procedures, obtaining Pareto efficiency and strategyproofness for patients. With **0–1 preferences** — patients indifferent among all compatible kidneys — Roth, Sönmez, and Ünver showed a wide class of constrained-efficient mechanisms that are strategyproof for pairwise exchange [2]. These results underpin real clearinghouse design: the UNOS solver and the UK's National Living Donor Kidney Sharing Schemes (NLDKSS) encode lexicographic and hierarchical criteria reflecting these theoretical foundations [10].

---

## 3. Methodology

Our methodology combines five instruments, each appropriate to a different dimension of the problem:

- **Complexity-theoretic reduction.** Clearing is cast as maximum-weight *cycle and path packing* in a directed graph with cardinality constraints; hardness is inherited from set packing and 3-dimensional matching, and the $L=2$ vs. $L\ge 3$ dichotomy is established via matching theory [3].
- **Integer programming.** The *cycle formulation* (Roth et al. [1]; Abraham et al. [3]) uses one binary variable per feasible cycle, with packing constraints $\sum_{c \ni v} x_c \le 1$ for all $v \in V$. The pricing subproblem — finding a negative-reduced-cost cycle — is solved by column generation within a **branch-and-price** framework that cleared 10,000-pair instances [3].
- **Compact formulations.** Position-indexed formulations (PICEF/PIEF) encode chains with polynomially many variables by indexing arcs by position, preserving tight LP relaxations while scaling to larger chain caps [4].
- **Game-theoretic analysis.** Strategyproofness is studied in two agent models: *patients* with 0–1 or strict preferences, and *hospitals* that decide which pairs to reveal; the latter yields impossibility theorems with quantitative efficiency bounds [5].
- **Empirical validation.** All models are evaluated on UNOS match-run data (hundreds of runs, thousands of pairs) and generated pools calibrated to UNOS statistics, measuring transplants, runtimes, fairness gaps, and robustness to edge failure [6][7][8].

### 3.1 The Clearing Integer Program

The cycle formulation, the workhorse of fielded exchanges, is:

$$
\max \sum_{c \in \mathcal{C}(L,K)} w_c x_c
\quad \text{s.t.} \quad
\sum_{c : v \in c} x_c \le 1 \;\; \forall v \in V, \quad
x_c \in \{0,1\} \;\; \forall c \in \mathcal{C}(L,K),
$$

where $\mathcal{C}(L,K)$ is the set of all cycles of length at most $L$ and chains of length at most $K$ [3]. A Python sketch of the column-generation loop that solves its LP relaxation is shown below.

```python
def branch_and_price_clearing(G, L, K, weights):
    """Column-generation loop for the cycle/chain clearing LP."""
    RMP = restricted_master(cycles=initial_feasible_cycles(G, L))
    while True:
        x, duals = RMP.solve_lp()          # duals: pi[v] per vertex
        new_cols = []
        for k in range(2, L + 1):          # cycle pricing
            new_cols += negative_reduced_cost_cycles(G, k, weights, duals)
        new_cols += negative_reduced_cost_chains(G, K, weights, duals)  # chain pricing
        if not new_cols:
            break                          # LP optimal over full column set
        RMP.add_columns(new_cols)
    if all_integral(x):
        return x
    # otherwise branch: pick fractional x_c, recurse on x_c = 0 and x_c = 1
    return branch_on_fractional(x, RMP)
```

The pricing subproblem for cycles reduces to a *negative-cycle* detection variant solvable in polynomial time for fixed $L$ (Glorie et al.), while chain pricing is an elementary-path problem; branch-and-price on this formulation cleared the projected US steady-state scale of 10,000 pairs [3][4].

---

## 4. Deep Dive

### 4.1 Complexity and the Cycle Formulation

The NP-hardness of clearing for $L \ge 3$ is not merely theoretical obstruction — it dictates the entire computational architecture of the field. The cycle formulation has exponentially many variables in principle, yet its LP relaxation is remarkably tight: the packing constraints $\sum_{c \ni v} x_c \le 1$ define a face structure under which branch-and-price closes the integrality gap quickly on real instances [3]. Two facts explain practical tractability:

1. *Sparsity.* Real compatibility graphs are sparse — highly sensitized patients have few incoming edges — so the enumerated cycle set $\mathcal{C}(3, K)$ is far smaller than its worst-case bound.
2. *Pricing efficiency.* For cycles, the pricing problem admits polynomial-time algorithms via Bellman–Ford-style negative-cycle detection with cardinality handling [4]; the exponential blowup is confined to the chain-pricing elementary-path subproblem, which is NP-hard but manageable at fielded chain caps.

Comparative benchmarks on 286 UNOS match runs show position-indexed formulations (PICEF, HPIEF) outperforming the original branch-and-price solver on the hardest instances, with the tightest LP relaxations proving optimality fastest [4].

| Formulation | Variables | LP tightness | Chains | Cycle cap |
|---|---|---|---|---|
| Cycle formulation (Abraham et al. [3]) | Exponential (column gen.) | Tight | Via dummy edges | Any $L$ |
| PICEF [4] | Polynomial | Tight | Native, position-indexed | Any $L, K$ |
| HPIEF [4] | Polynomial | Tightest known | Hybrid | Any $L, K$ |
| Edge formulation [3] | Polynomial | Weak | Native | Small $L$ |

### 4.2 Altruistic Donor Chains and NEAD

Chains fundamentally alter both optimization and logistics. Unlike cycles, whose surgeries must be simultaneous (to prevent donor reneging), chains can execute *non-simultaneously*: each link's donor gives after their patient has received a kidney, so no donor is ever asked to give before their loved one is transplanted [2][9]. This enables:

- **Longer exchanges.** Fielded chain caps $K$ reach 10–20, dwarfing cycle caps, because simultaneity constraints vanish.
- **NEAD chains.** The terminal bridge donor's kidney need not return to the pool immediately; it can seed future segments, effectively allowing chains to span multiple match runs [9].
- **Failure resilience.** A failed link breaks only the suffix of a chain, whereas a failed edge in a simultaneous cycle destroys the entire cycle — a key input to failure-aware clearing [8].

Optimization-wise, chains convert the problem from pure cycle packing to cycle-*and*-path packing; PICEF handles this natively with polynomial variables, and the traveling-salesman-based formulation of Anderson et al. finds provably long chains [11].

### 4.3 Strategyproof Mechanisms and Impossibility

Mechanism design for kidney exchange operates at two levels of agency, with strikingly different conclusions.

**Patient-level strategyproofness.** Under 0–1 preferences, Roth, Sönmez, and Ünver [2] characterize a broad class of constrained-efficient, strategyproof mechanisms for pairwise exchange — including deterministic priority mechanisms mirroring organ-bank rules and randomized mechanisms addressing distributive justice. With strict preferences, TTCC with appropriate chain-selection rules is Pareto efficient, and rules (a), (d), (e) induce strategyproofness while longest-chain rules (b), (c) do not [1].

> Theorem: No individually rational mechanism can be both efficient and strategyproof when hospitals are the strategic agents, even for maximum exchange size $k = 2$. Moreover, no IR strategyproof mechanism guarantees more than a constant fraction of the efficient allocation in the worst case [5].

**Hospital-level impossibility.** Ashlagi and Roth [5] (building on unpublished Roth–Sönmez–Ünver notes) show that when hospitals choose which pairs to report — *free riding* by withholding easy-to-match pairs for internal exchange — efficiency and strategyproofness are incompatible. Deterministic IR strategyproof mechanisms cannot guarantee more than $1/2$ of the efficient allocation; randomized ones are bounded by $7/8$, even for $k=2$. This is a sobering *price of decentralization*: the market's fragmentation across transplant centers imposes a fundamental welfare tax that no clever mechanism can fully remove.

### 4.4 Fairness, Dynamics, and Failure

**Price of fairness.** Utilitarian clearing maximizes total transplants but can systematically marginalize highly sensitized patients (high PRA), who are hard to match and contribute few edges. Dickerson, Procaccia, and Sandholm [6] adapt the Bertsimas–Farias–Trichakis price-of-fairness framework to kidney exchange, showing the *theoretical* price of fairness is low, yet *empirically* on UNOS data it is frequently high — fair rules cost real transplants. Weighted fairness objectives of the form $\Delta_\beta(e) = (1+\beta) w_e$ for edges into prioritized vertices $V_P$ interpolate between utilitarian and egalitarian regimes [7].

**Dynamic matching.** Pairs arrive and depart over time; myopic period-by-period clearing is suboptimal. Dickerson and Sandholm [7] prove bounds on learning *potentials* for vertices, edges, cycles, and the whole graph, then learn vertex potentials offline and subtract them from myopic objectives at runtime — a scalable alternative to sampling-based stochastic programming. Their **FutureMatch** framework unifies failure-awareness, dynamics, and fairness: it takes a high-level expert objective (e.g., maximize graft survival), learns the "means" (potentials) from data, and validates on UNOS exchange data [12].

**Failure-aware clearing.** Proposed matches fail: crossmatch tests reject, donors renege, logistics break. Dickerson, Procaccia, and Sandholm [8] model each edge succeeding independently with probability $p$, maximizing *expected* transplants: a cycle of length $\ell$ contributes $p^\ell w_c$, while a chain arc at position $k$ contributes $p^k w_e$. On 36 UNOS match runs, failure-aware clearing produced equal or substantially more expected transplants than deterministic clearing, particularly under bimodal failure probabilities [8]. PICEF extends naturally to this discounted objective [4].

---

## 5. Empirical Results and Formal Analysis

We consolidate the headline quantitative findings from the fielded literature:

1. **Scale.** Branch-and-price clears the projected US steady-state pool of 10,000 pairs to optimality [3]; PICEF/HPIEF dominate on generated large instances and on 286 real UNOS runs plus 17 UK NLDKSS runs [4].
2. **Cycle-length value.** Moving from $L=2$ to $L=3$ yields significantly more transplants in practice, justifying the NP-hard regime [3][9].
3. **Chains.** Long chains (via TSP-based search [11]) materially increase match counts where altruist supply permits; NEAD chains compound gains across runs [9].
4. **Failure-awareness.** Discounted clearing never underperforms deterministic clearing in expectation on UNOS data and often wins by large margins under heterogeneous failure rates [8].
5. **Dynamics.** Learned potentials beat myopic matching and scale where sample-based stochastic optimization does not [7][12].
6. **Fairness cost.** The empirical price of fairness is frequently high on real data despite low theoretical bounds — a gap driven by the skewed sensitization distribution of real pools [6].

Formally, the complexity landscape is summarized:

> Theorem: The clearing problem is polynomial for $L = 2$ (reduction to general-graph matching), NP-complete for $L \ge 3$ even without chains [3], and remains NP-hard under the failure-aware discounted objective (the deterministic case is the $p = 1$ special case) [8].

---

## 6. Limitations

This synthesis inherits the limitations of its source literature. *First*, the standard model assumes edge failures are independent and identically distributed — a simplification Dickerson et al. [8] adopt partly to avoid further marginalizing already-sick patients, but real failures correlate through donor health and center effects. *Second*, strategyproofness results for patients assume truthful compatibility reporting is verifiable; in practice, blood-type and crossmatch data can be manipulated at the margins by centers, and the hospital-level impossibility [5] bites hardest precisely where verification is weakest. *Third*, fairness formalisms (price of fairness, MAXCARD-FAIR) encode a particular moral arithmetic — multiplicative reweighting of prioritized vertices — that transplant committees may not endorse; the "human values" alignment problem remains open [13]. *Fourth*, dynamic models assume stationary arrival distributions, while real pools shift with policy changes, desensitization protocols, and global kidney exchange initiatives. *Fifth*, our complexity claims concern worst-case asymptotics; the empirical tractability of branch-and-price rests on real-graph sparsity that future denser pools (e.g., with desensitization) could erode.

---

## 7. Conclusion

Kidney exchange stands as algorithmic game theory's most successful life-or-death deployment: NP-hard clearing tamed by branch-and-price at national scale [3][4]; strategyproofness characterized for patients [1][2] and proven impossible for hospitals [5]; fairness priced and debated [6]; dynamics and failure internalized through learned potentials and discounted objectives [7][8][12]. The field's arc — from Roth, Sönmez, and Ünver's market-design foundations to UNOS's fielded optimizer — demonstrates that deep theory and operational impact need not trade off. The frontier now lies in *unified* market design: mechanisms that are simultaneously efficient, fair, robust to failure, adaptive to arrivals, and aligned with human values [13] — a challenge worthy of the lives at stake.

---

## References

[1] A. E. Roth, T. Sönmez, and M. U. Ünver, "Kidney Exchange," *Quarterly Journal of Economics*, 2004. NBER Working Paper 10698 (Pairwise Kidney Exchange). https://www.nber.org/papers/w10698

[2] A. E. Roth, T. Sönmez, and M. U. Ünver, "Pairwise Kidney Exchange," *Journal of Economic Theory*, 2005. Survey chapter: https://www.kellogg.northwestern.edu/research/math/MiniCoursePapers/TayfunSurvey.pdf

[3] D. J. Abraham, A. Blum, and T. Sandholm, "Clearing Algorithms for Barter Exchange Markets: Enabling Nationwide Kidney Exchanges," *Proc. ACM Conference on Electronic Commerce (EC)*, 2007. Summary and extensions: https://www.cs.cmu.edu/~sandholm/hierarchy.ec2016_EC_CAMERA_READY.pdf

[4] J. P. Dickerson, D. F. Manlove, B. Plaut, T. Sandholm, and J. Trimble, "Position-Indexed Formulations for Kidney Exchange," *Proc. ACM Conference on Economics and Computation (EC)*, 2016. https://www.cs.cmu.edu/~sandholm/hierarchy.ec2016_EC_CAMERA_READY.pdf

[5] I. Ashlagi and A. E. Roth, "Free Riding and Participation in Large Scale, Multihospital Kidney Exchange," *Theoretical Economics*, 2014. Working paper: http://web.stanford.edu/~iashlagi/papers/LargeScaleKidneyExchange_7_13.pdf

[6] J. P. Dickerson, A. D. Procaccia, and T. Sandholm, "Empirical Price of Fairness in Failure-Aware Kidney Exchange," *Proc. AAAI Workshop on Computational Sustainability*, 2014. http://www.cs.cmu.edu/~sandholm/www/www/empirical%20price%20of%20fairness%20in%20failure-aware.hcagt14.pdf

[7] J. P. Dickerson and T. Sandholm, "FutureMatch: Combining Human Value Judgments and Machine Learning to Match in Dynamic Environments," *Proc. AAAI*, 2015. http://www.cs.cmu.edu/~sandholm/www/www/futurematch.aaai15%20with%20appendix.pdf

[8] J. P. Dickerson, A. D. Procaccia, and T. Sandholm, "Failure-Aware Kidney Exchange," *Proc. ACM Conference on Electronic Commerce (EC)*, 2013. http://www.cs.cmu.edu/~sandholm/failure-aware%20kidney%20exchange.ec13.pdf

[9] R. Anderson, I. Ashlagi, D. Gamarnik, and A. E. Roth, "Finding Long Chains in Kidney Exchange Using the Traveling Salesman Problem," *PNAS*, 112(3):663–668, 2015. Chains discussion: http://www.cs.cmu.edu/~sandholm/www/chains.aamas12.pdf

[10] D. F. Manlove and G. O'Malley, "Paired and Altruistic Kidney Donation in the UK: Algorithms, Combinatorics and Experiments," *Experimental Algorithms (SEA)*, 2012. https://eprints.gla.ac.uk/99667/1/99667.pdf

[11] D. F. Manlove et al., "Position-Indexed Formulations" companion results on chain caps; see also Glorie et al., "Kidney Exchange with Long Chains," *MSOM*, 2014 — via branch-and-price survey: https://inria.hal.science/CRISTAL-INOCS/hal-04475586v2

[12] J. P. Dickerson, "Dynamic Matching Markets and Barter Exchange," Ph.D. thesis, Carnegie Mellon University, 2016. https://www.cs.cmu.edu/afs/.cs.cmu.edu/Web/Posters/CSThesis-Dickerson16.pdf
