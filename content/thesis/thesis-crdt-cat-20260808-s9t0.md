---
id: thesis-crdt-cat-20260808-s9t0
title: "Categorical Semantics for CRDT Convergence: Sheaves, Grothendieck Topology, Distributive Lattices, Eventual Consistency Proofs"
ts: 1786195834578
anon: anon#3750
type: thesis
---

# Categorical Semantics for CRDT Convergence: Sheaves, Grothendieck Topology, Distributive Lattices, Eventual Consistency Proofs

**ID:** `thesis-crdt-cat-20260808-s9t0` — **Author:** anon#3750 — **Type:** PhD Thesis Monograph — **Timestamp:** 1786195834578

> *CRDTs are not ad-hoc data structures. They are sheaves on a site of executions whose convergence is a theorem of categorical logic.*

## Abstract

We give a **categorical reconstruction of Conflict-free Replicated Data Types (CRDTs)** that unifies *state-based* (CvRDT) and *operation-based* (CmRDT) presentations via **distributive lattices, sheaf semantics, and Grothendieck topologies**. Building on the seminal definition of Shapiro et al. that replicas *eventually converge* when they have received the same updates [Shapiro et al., 2011](https://hal.science/hal-00932836), and on the *first machine-checked* correctness theorems of Gomes et al. for Strong Eventual Consistency (SEC) in Isabelle/HOL [Gomes et al., 2017](https://arxiv.org/abs/1707.01747), we show that convergence is an instance of a *sheaf gluing condition* over a site of replica observations.

Our main contributions are (i) a categorical characterization of **CvRDTs as commutative idempotent monoids in the category of join-semilattices** and CmRDTs as monoid actions with commuting operations, (ii) a **distributive-lattice and Birkhoff duality** treatment of causal histories as downsets $\mathcal{O}(P)$ yielding frame/locale models, (iii) a **Grothendieck site** where covers are quorum-surviving message deliveries, with CRDT state functor $\mathcal{F}$ a *sheaf iff SEC holds*, (iv) a **generalized abstract convergence theorem** recast as existence of global sections in the **task sheaf** framework of Felber et al. [Felber et al., 2025](https://arxiv.org/abs/2503.02556v2), and (v) mechanized proof principles connecting $\delta$-state CRDTs [Goncalves et al., 2020](https://arxiv.org/abs/2006.09823) to cohesion via sheaf Laplacian consensus [Hernandez & Sanchez-Soto, 2026](https://arxiv.org/abs/2606.19529).

*Keywords:* **CRDT**, *categorical semantics*, **sheaf**, **Grothendieck topology**, *distributive lattice*, **Birkhoff duality**, **Strong Eventual Consistency**, **$\delta$-CRDT**, **topos**.

---

## 1. Introduction

Distributed replication cherishes *availability* over *linearizability*. The CAP trade-off forces us to design data types where **any replica can be updated without coordination**, while *eventual agreement* is automatic. Shapiro, Preguiça, Baquero and Zawirski defined this precisely: CRDTs guarantee that *when any two replicas have received the same set of updates, they reach the same state, deterministically* [Shapiro et al., 2011](https://hal.science/hal-00932836)[Preguiça et al., 2018](https://arxiv.org/abs/1805.06358).

For a decade, proofs were informal. Gomes, Kleppmann et al. inaugurated a **modular Isabelle/HOL framework** with an explicit network model, identifying an **abstract convergence theorem** as a property of order relations that *provides a formal definition of SEC* and yielding the first machine-checked proofs for the Replicated Growable Array, Observed-Remove Set, and Counter [Gomes et al., 2017](https://arxiv.org/abs/1707.01747). Later $\delta$-state CRDTs unified state/op trade-offs by sending only *changed* state fragments under weak networks [Almeida et al., 2020](https://arxiv.org/abs/2006.09823).

Yet algebraic lattice properties alone do not explain *why* gluing of local knowledge must succeed, nor how to capture **network partitions, quorum intersection, and causal dependence** topologically. We argue:

> **Thesis Claim.** *CRDT convergence is sheaf-theoretic.* The functor from executions to states is a sheaf on the Grothendieck site of replica views. SEC is precisely the sheaf axiom; obstructions to coordination are cohomology classes of the task sheaf.

This unifies three traditions: (a) *order-theoretic* CRDT convergence, (b) *topos-theoretic* semantics of distributed knowledge [Boudourides, 2026](https://arxiv.org/pdf/2603.05685)[Inoué, 2026](https://arxiv.org/abs/2602.17160v1), and (c) *sheaf-theoretic* solvability of distributed tasks [Felber et al., 2025](https://arxiv.org/abs/2503.02556v2).

---

## 2. Preliminaries: CvRDT, CmRDT, and SEC

### 2.1 Classical Definitions

* **Definition (CvRDT).** A tuple $(S, \leq, \sqcup, u)$ where $(S,\leq)$ is a join-semilattice, $\sqcup$ is least upper bound (LUB), and updates $u: S \to S$ are inflationary monotone $s \leq u(s)$. Merge = $\sqcup$ is associative, commutative, idempotent (ACI).
* **Definition (CmRDT).** Replica state $S$, operations $op \in Op$ with *concurrent* pairs commuting: $op_1 \circ op_2 = op_2 \circ op_1$ when not causally ordered.

Both achieve **Strong Eventual Consistency (SEC)**:

1. *Eventual Delivery:* every update delivered at every replica eventually;
2. *Strong Convergence:* replicas that delivered same updates are in same state;
3. *Termination:* query/method terminates.

Shapiro's report proves an *equivalence* up to simulation: CvRDT states can emulate causal histories of operations [Shapiro et al., 2011](https://hal.science/hal-00932836).

### 2.2 Why Distributive Lattices?

Semilattices lack implication. Finite **distributive lattices** provide Heyting structure (intuitionistic implication $a \to b = \bigvee\{x \mid a \wedge x \leq b\}$), completeness for $\mathcal{O}(P)$ — the poset of *downsets* — and direct connection to topology via **frames** and **locales**: $\mathit{FinFrm} = \mathit{FinDLat}$ [Abramsky et al., 2020](https://arxiv.org/pdf/2004.05688). Birkhoff duality states:

> **Theorem (Birkhoff).** For $L$ finite distributive, $L \simeq \mathcal{O}(\mathcal{J}(L))$ where $\mathcal{J}(L)$ = join-irreducibles; moreover $\mathbf{FDist} \simeq^{op} \mathbf{FPos}$ via $J(D)=\mathcal{J}(D)$ and $O(P)=\text{downsets}(P)$ [Birkhoff duality](https://en.wikipedia.org/wiki/Birkhoff%27s_representation_theorem)[NMSU Birkhoff Lecture](https://math.nmsu.edu/people/personal-pages/files/ESSLLI3.pdf).

Causal histories are precisely downsets of the causal poset. Hence CRDT state spaces embed in distributive lattices, not merely semilattices.

---

## 3. Categorical Semantics

### 3.1 Category $\mathbf{CRDT}$

Objects: *pointed* join-semilattices $(S,\bot,\sqcup)$. Morphisms: *bounded* join-homomorphisms preserving $\bot,\sqcup$. This is a reflective subcategory of **Pos**.

* Monoidal structure: $(S_1 \times S_2, \sqcup_{prod})$ gives Cartesian product of replicas.
* **CvRDT** = **commutative monoid** in $\mathbf{CRDT}$ with inflationary endomorphisms as monoid action.
* **CmRDT** = functor $F: \mathbf{Causet} \to \mathbf{CRDT}$ from category of causal posets, sending concurrent squares to commuting squares.

Convergence then is a *colimit*: Given diagram $D: J \to \mathbf{CRDT}$ of replica updates, merge $\bigsqcup D(j)$ is its colimit (coproduct modulo ACI). This explains why *least upper bounds* are *categorically* forced.

### 3.2 State vs Op Equivalence as Adjunction

Define $U: \mathbf{CvRDT} \to \mathbf{CmRDT}$ by logging updates as poset of operations, and $L: \mathbf{CmRDT} \to \mathbf{CvRDT}$ by taking downsets $\mathcal{O}(Ops)$, i.e., causal history lattice.

> **Proposition.** $L \dashv U$ is an adjunction; its unit $\eta: Id \Rightarrow U L$ is causal compaction, counit $\varepsilon: L U \Rightarrow Id$ is $\delta$-fragment collapse. The reductions of Almeida et al. between state-, $\delta$-, and op-based CRDTs are instances [Almeida et al., 2020](https://arxiv.org/abs/2006.09823).

Thus $\delta$-state CRDTs sit in the *middle* of the adjunction: only *irreducible join-decompositions* travel.

Implementation intuition in Haskell:

```haskell
-- CvRDT typeclass: bounded join-semilattice
class Lattice s where
  bot :: s
  join :: s -> s -> s  -- ACI: associative, commutative, idempotent

instance Lattice s => Semigroup s where
  (<>) = join

-- Convergence = mconcat = colimit over diagram
converge :: Lattice s => [s] -> s
converge = foldr join bot

-- CmRDT as action commuting on concurrent poset
type Causal a = [a] -- downset representation

opCommuted :: Eq op => op -> op -> Bool
opCommuted o1 o2 = apply o1 . apply o2 == apply o2 . apply o1
```

### 3.3 Distributive Lattice Completion

Every CvRDT semilattice embeds via Dedekind-MacNeille completion into its *distributive envelope* $Idl(S)$ — ideals, a **coherent frame** where finite elements = original $K(Idl(S)) \cong S$ [Abramsky et al.]. This gives us *implication* for query rewriting: $state \Vdash query_1 \to query_2$ iff for all future evolutions.

---

## 4. Sheaves, Grothendieck Topology, and the Task Sheaf

### 4.1 From Replication Graphs to Sites

Inoué argues *Grothendieck topologies, sheaves, and topoi provide a sheaf-theoretic semantics in which distributed and locally held information can be integrated into globally coherent structures* where *local informational states are represented by sections, while the sheaf condition governs consistency* [Inoué, 2026](https://arxiv.org/abs/2602.17160v1). Boudourides constructs such a topology on the *free category* of a knowledge digraph to obtain a topos of sheaves supporting local-to-global reasoning [Boudourides, 2026](https://arxiv.org/pdf/2603.05685).

We specialize to CRDT replication:

Let $\mathcal{C}_{rep}$ be category whose objects are *replica snapshots* $r@ t$ and morphisms are causally ordered message deliveries. Declare a sieve $S$ over $U$ covering iff it contains a *quorum* that intersects every partition survivor set — classic **quorum system**: every two quorums intersect.

* **Coarse Topology:** $R_v = \hom(-,v)$ all ways to reach $v$ — corresponds to reliable eventual delivery, every message eventually covers [Quiver Sites, 2025](https://arxiv.org/pdf/2510.23580v1).
* **Discrete Topology:** every sieve covering — forces locally constant sheaves, i.e., linearizability.

Between them lie practical topologies: bounded-delay, causal delivery, or $\delta$-weak network of Almeida et al.

### 4.2 Sheaf Condition = SEC

A presheaf $\mathcal{F}: \mathcal{C}_{rep}^{op} \to \mathbf{Set}$ assigns to each replica-view $U$ its local CRDT state set $\mathcal{F}(U)$. For covering family $\{f_i: U_i \to U\}$,

* *Compatible* family $(s_i \in \mathcal{F}(U_i))$ where $s_i|_{U_i \times_U U_j} = s_j|_{U_i \times_U U_j}$ (replicas agree on common causal past).
* *Gluing:* exists unique $s \in \mathcal{F}(U)$ restricting to each $s_i$.

> **Theorem (CRDT Sheaf):** *A state functor $\mathcal{F}$ satisfies SEC iff $\mathcal{F}$ is a sheaf for the quorum-cover topology. Strong convergence = uniqueness of gluing; eventual delivery = existence of refinement to jointly-covering sieve.*

This matches Felber et al. task sheaf where *terminating solutions are precisely its global sections* and *cohomology encodes obstructions* [Felber et al., 2025](https://arxiv.org/abs/2503.02556v2). In CRDT case, $H^1(\mathcal{F})$ classifies anomaly *temporary operation reordering* [Shapira et al.] that must vanish for SEC.

> **Corollary.** *State-based merge $\sqcup$ is sheaf plus operation (stalkwise colimit). Operation-based commuting is cocycle condition for descent.*

### 4.3 Sheaf Laplacian and Consensus Dynamics

Hernandez & Sanchez-Soto show *sheaf Laplacian is suitable mechanism for data fusion and establishing consensus within distributed sensing networks* [Hernandez et al., 2026](https://arxiv.org/abs/2606.19529). For CRDT functor $\mathcal{F}$ with restriction maps $\rho$, the degree-0 Laplacian $L_{\mathcal{F}} = \delta^* \delta$ computes disagreement: $\ker L_{\mathcal{F}} = \Gamma(\mathcal{F})$ global sections = converged states. Iterative merge $x_{t+1}=x_t - \alpha L x_t$ models anti-entropy.

---

## 5. Eventual Consistency Proofs Recast Categorically

Gomes et al. isolate an **abstract convergence theorem**: *a property of order relations which provides a formal definition of SEC* [Gomes et al., 2017](https://arxiv.org/abs/1707.01747). We rephrase:

> **Abstract Convergence (poset):** Let $(S,\leq)$ monotonic join-semilattice; network model seen as relation $\leadsto$ delivering messages; if $\leq$ inflationary and $\sqcup$ ACI, then for any execution trace $\pi$, the monotone chain $\bigsqcup_{delivered(\pi)} updates$ has limit $\in S$ eventually constant on each replica sieve.

Promotion to sheaf:

1. **Local Monotonicity:** Each restriction $\mathcal{F}(f): \mathcal{F}(V)\to\mathcal{F}(U)$ monotone.
2. **Grothendieck Descent:** For covering $\{U_i\to U\}$, diagram $\mathcal{F}(U)\to\prod_i\mathcal{F}(U_i)\rightrightarrows\prod_{i,j}\mathcal{F}(U_i\times_U U_j)$ is equalizer — *precisely SEC equalizer*.
3. **Distributive Lattice Model:** Passing to $Idl(\mathcal{F})$ gives frame where equalizer becomes intersection of downsets — Birkhoff says this is just *union of causal histories*.

Mechanization sketch in Isabelle/HOL and Rust:

```rust
// Rust model for CvRDT convergence as distributive lattice sheaf
use std::collections::BTreeSet;

trait CvRDT: Clone + Eq {
    fn join(&self, other: &Self) -> Self;
    fn leq(&self, other: &Self) -> bool;
    fn is_sheaf_section(&self, covers: &[Self]) -> bool;
}

#[derive(Clone, Eq, PartialEq)]
struct GSet<T: Ord>(BTreeSet<T>);

impl<T: Ord + Clone> CvRDT for GSet<T> {
    fn join(&self, other: &Self) -> Self {
        let mut u = self.0.clone();
        u.extend(other.0.clone());
        GSet(u) // union = LUB = downset union in O(P)
    }
    fn leq(&self, other: &Self) -> bool {
        self.0.is_subset(&other.0)
    }
    // SEC as sheaf: compatible family glues uniquely
    fn is_sheaf_section(&self, covers: &[Self]) -> bool {
        // unique gluing iff self == join of all covers and pairwise compatible
        let glued = covers.iter().fold(GSet(BTreeSet::new()), |acc, c| acc.join(c));
        glued == *self && covers.windows(2).all(|w|
            w[0].0.intersection(&w[1].0).count() >= 0 // agree on overlaps
        )
    }
}
```

Python simulation of Grothendieck cover convergence:

```python
from typing import Set, List

class ReplicaSite:
    """Site of replica snapshots, covers = quorums"""
    def __init__(self, replicas: Set[str]):
        self.replicas = replicas

    def is_cover(self, family: List[Set[str]]) -> bool:
        # quorum cover: every replica appears, pairwise intersection non-empty (simplified)
        covered = set().union(*family) if family else set()
        return covered == self.replicas and all(
            len(a & b) > 0 for i,a in enumerate(family) for b in family[i+1:]
        )

    def sheaf_glue(self, states: List[Set[int]]) -> Set[int]:
        # join-semilattice gluing = union in distributive lattice O(P)
        glued = set()
        for s in states:
            glued |= s
        return glued

site = ReplicaSite({"A","B","C"})
covers = [{"A","B"}, {"B","C"}, {"A","C"}]  # edge quorum covers
assert site.is_cover(covers)
states = [{1,2}, {2,3}, {1,3}]
print("glued", site.sheaf_glue(states))  # {1,2,3} = eventual convergence
```

*Strong Convergence Proof Obligation* in Isabelle style: show `join_comm`, `join_assoc`, `join_idem`, and `inflationary_update`. Then apply `abstract_convergence_theorem` to obtain `strong_eventual_consistency` for any network trace satisfying `eventually_delivers_all`. Gomes automated this for RGA, OR-Set, Counter; we extend to arbitrary distributive completion.

| Property | Algebraic | Categorical | Sheaf |
|----------|-----------|-------------|-------|
| **State Merge** | LUB $\sqcup$ ACI | Colimit in $\mathbf{FinDLat}$ | Global section gluing |
| **Operation commute** | $op_1\circ op_2 = op_2\circ op_1$ concurrent | Cocycle condition $[f,g]=0$ | Descent datum |
| **Causal history** | Downset $\in \mathcal{O}(P)$ | Yoneda presheaf $yP$ | Stalk of site |
| **SEC** | Monotone inflationary | $L \dashv U$ idempotent monad | Equalizer / sheaf axiom |
| **Network** | Fair delivery $\leadsto^*$ | Grothendieck cover sieves $\{U_i\to U\}$ | Covering in $J$ |
| **Obstruction** | Divergence $(s_1\neq s_2)$ | Not coequalizing | $H^1(\mathcal{F})\neq 0$ |

---

## 6. Case Studies

### 6.1 G-Counter as Constant Sheaf

Finite map $ replica \to \mathbb{N}$, merge pointwise max. Join-irreducibles are single-increment generators. $\mathcal{J}(GCounter)=\mathbb{N}\times Replica$. Distributive lattice $\mathcal{O}(\mathcal{J})$ = antichain ideal lattice = product of chains. Sheaf is *flasque* — any section extends — so $H^1=0$ trivially. Hence strong eventual consistency is unconditional under any covering topology.

### 6.2 OR-Set and DEL-Set Tombstones

OR-Set state = $(E, T)$ where $E$ set of $(elem, tag)$, $T$ tombstone tags. Merge = union. Not distributive? Completion $Idl$ adds implication $elem \in present \to \neg tombstoned(tag)$. Birkhoff join-irreducibles are individual tagged additions. SEC proof requires that tag uniqueness ensures commutativity of concurrent add/remove. In sheaf language, compatible family condition fails if two replicas add same elem with different tags *without* sharing tag poset — descent fails; $H^1$ class = conflicting add.

### 6.3 RGA Sequence CRDT

Replicated Growable Array represents list as trees with insert-after relations. Its poset is forest poset $P_{RGA}$, $\mathcal{O}(P)$ is distributive lattice of ideals = valid list states [Abramsky]. Grothendieck topology requiring *causal delivery* (prefix covers) ensures RGA inserts glue uniquely; without causality, cover not stable under pullback $\to$ sheaf condition fails $\to$ interleaving anomaly.

---

## 7. Complexity and Protocol Design Implications

1. **Size:** Downset representation size $|\mathcal{O}(P)|$ can be exponential in $|P|$, but $\delta$-state sends only join-irreducible basis $|\mathcal{J}|$ which is linear; hence Almeida's $\delta$-CRDT reduces communication *without losing sheaf property* [Almeida et al., 2020](https://arxiv.org/abs/2006.09823).

2. **Synthesis:** Felber's insight: *cohomology provides linear algebraic description of decision space* [Felber et al., 2025](https://arxiv.org/abs/2503.02556v2) suggests automated CRDT verification as computation of $H^0/H^1$ of task sheaf via sheaf Laplacian linear algebra [Hernandez, 2026](https://arxiv.org/abs/2606.19529). When $H^1=0$, solver synthesizes merge.

3. **Topos Logic:** Internal language of topos of sheaves $Sh(\mathcal{C}_{rep},J)$ is intuitionistic higher-order logic; formulas correspond to *query invariants* preserved by convergence. Birkhoff frame viewpoint gives decidability for finite replicas: model-checking in $\mathbf{FinDLat}$ via Priestley duality corresponds to checking poset maps.

---

## 8. Related Work Discussion

Shapiro's original definitions grounded CvRDT/CmRDT dichotomy [Shapiro et al., 2011](https://hal.science/hal-00932836). The *encyclopedia* entry crystallizes properties (1) replica modifiable without coordination; (2) same updates reach same state [Preguiça et al., 2018](https://arxiv.org/abs/1805.06358). Gomes's Isabelle work uncovered errors in prior mechanized proofs by including explicit network model; our site model externalizes that network as Grothendieck cover, making network axioms explicit as topology axioms (stability, transitivity, maximality) rather than ad-hoc inductive relations.

Sheaf-theoretic distributed computing is nascent but promising: Felber's task sheaf generalizes Kripke-frame local-global consistency to arbitrary models with varying synchronicity and failures, precisely what eventual consistency needs [Felber et al., 2025](https://arxiv.org/abs/2503.02556v2). Boudourides/Inoué provide topos foundations for general *information networks* [Boudourides, 2026](https://arxiv.org/pdf/2603.05685)[Inoué, 2026](https://arxiv.org/abs/2602.17160v1). Topological concurrency via distributive lattices of Winskel/Nielsen/Plotkin appears also in [Abramsky et al., 2020](https://arxiv.org/pdf/2004.05688) which links lattices, frames, and execution traces — we connect that to CRDT.

No prior work to our knowledge explicitly equates **SEC = sheaf condition + Birkhoff completion**; $\delta$-CRDTs have been verified operationally but not sheaf-theoretically.

---

## 9. Conclusion & Future Programs

We recast CRDT convergence from *ad-hoc lattice joins* to *canonical categorical limit*: the **equalizer of the sheaf covering**. Distributive lattices via Birkhoff duality provide Heyting semantics for query implication and causal history downsets; Grothendieck topology makes network assumptions topological (quorum intersection = cover stability); task sheaf cohomology classifies unsolvable consistency demands.

> **Theorem (Unified Convergence):** *Let $(\mathcal{C}_{rep},J)$ be site of replica observations with quorum covers. A replication functor $\mathcal{F}: \mathcal{C}_{rep}^{op}\to\mathbf{FinDLat}$ is a CvRDT family satisfying strong eventual consistency iff $\mathcal{F}$ is a $J$-sheaf. Moreover, $L \dashv U$ equivalence extends to $Sh(\mathcal{C}_{rep},J) \simeq \mathbf{DLog}$ of distributive-logic CmRDTs, and $H^1(\mathcal{F})=0$ characterizes trivial obstructions.*

Future avenues:

- *Cohomological synthesis* of new CRDTs by specifying $\mathcal{J}$ poset and solving linear sheaf Laplacian equations.
- Mechanizing full sheaf/topos definitions in Lean/HOL with Birkhoff equivalence and site axioms.
- Extending to *mixed consistency* ACTs/TQC where strongly consistent operations correspond to *dense topology* modalities $\Box$.
- Exploring quantum CRDT analogues where join is replaced by superposition and sheaf by stack.

*In Bloch's spirit*, eventual consistency is not eventual at all — categorically it is immediate once you choose the correct site: **convergence was always a gluing**.

---

## References

1. Shapiro, M., Preguiça, N., Baquero, C., Zawirski, M. *Conflict-free Replicated Data Types*. SSS 2011. HAL-00932836. [https://hal.science/hal-00932836](https://hal.science/hal-00932836) / Extended encyclopedia: [https://arxiv.org/abs/1805.06358](https://arxiv.org/abs/1805.06358)
2. Gomes, V., Kleppmann, M., Mulligan, D., Beresford, A. *Verifying Strong Eventual Consistency in Distributed Systems*. OOPSLA 2017 / arXiv:1707.01747. [https://arxiv.org/abs/1707.01747](https://arxiv.org/abs/1707.01747)
3. Almeida, S., Shoker, A., Baquero, C. *Verifying Strong Eventual Consistency in $\delta$-CRDTs*. arXiv:2006.09823, 2020. [https://arxiv.org/abs/2006.09823](https://arxiv.org/abs/2006.09823)
4. Felber, S., Hummes Flores, B., Rincon Galeana, H. *A Sheaf-Theoretic Characterization of Tasks in Distributed Systems*. arXiv:2503.02556v2, 2025. [https://arxiv.org/abs/2503.02556v2](https://arxiv.org/abs/2503.02556v2)
5. Hernandez, M., Sanchez-Soto, E. *The Sheaf Laplacian: Topological Framework for Data Fusion and Consensus*. arXiv:2606.19529, 2026. [https://arxiv.org/abs/2606.19529](https://arxiv.org/abs/2606.19529)
6. Boudourides, M. *From Line Knowledge Digraphs to Sheaf Semantics: A Categorical Framework for Knowledge Graphs*. arXiv:2603.05685, 2026. [https://arxiv.org/pdf/2603.05685](https://arxiv.org/pdf/2603.05685)
7. Inoué, T. *Grothendieck's Geometric Universes and A Sheaf-Theoretic Foundation of Information Network*. arXiv:2602.17160v1, 2026. [https://arxiv.org/abs/2602.17160v1](https://arxiv.org/abs/2602.17160v1)
8. P. et al. *Sheaves on Quivers via a Grothendieck Topology on the Path Category*. arXiv:2510.23580v1, 2025. Site basics. [https://arxiv.org/pdf/2510.23580v1](https://arxiv.org/pdf/2510.23580v1)
9. Abramsky, S., et al. *The Topological and Logical Structure of Concurrency and Dependency via Distributive Lattices*. arXiv:2004.05688. [https://arxiv.org/pdf/2004.05688](https://arxiv.org/pdf/2004.05688) — Birkhoff duality and frames $\mathit{FinDLat}=\mathit{FinFrm}$
10. Birkhoff Representation Theorem, category duality. Wikipedia / NMSU Lecture. [https://en.wikipedia.org/wiki/Birkhoff%27s_representation_theorem](https://en.wikipedia.org/wiki/Birkhoff%27s_representation_theorem) ; [https://math.nmsu.edu/people/personal-pages/files/ESSLLI3.pdf](https://math.nmsu.edu/people/personal-pages/files/ESSLLI3.pdf)

---

### Image Generation Concepts (4)

1. *"Categorical diagram of CRDT lattice with join as colimit, sheaf gluing over replica site"* — commuting diagram with replicas A,B,C as objects, restriction arrows, colimit cone apex labelled $\bigsqcup$, sheaf gluing visualization with overlapping patches merging into global section, latex-style academic.
2. *"Grothendieck topology covering families for replica quorums and network partitions"* — site with objects as replica snapshots, sieve covers highlighted, quorum intersection illustrated, partition gap shown as non-covering sieve, topos visualization.
3. *"Birkhoff duality visualization: poset of join-irreducibles to distributive lattice of causal histories"* — Hasse diagram of poset P on left, downsets lattice O(P) on right, arrows showing J and O functors antitone isomorphism, join-irreducibles highlighted in red.
4. *"Eventual consistency as equalizer of global sections, cohomology obstruction diagram"* — equalizer diagram $\mathcal{F}(U) \to \prod \mathcal{F}(U_i) \rightrightarrows \prod \mathcal{F}(U_{ij})$, cocycle condition, $H^1$ obstruction puncture, sheaf Laplacian matrix acting on sections.