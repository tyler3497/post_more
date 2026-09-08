---
id: differential-dataflow-ivm-1794
title: "Incremental View Maintenance via Differential Dataflow: Partially Ordered Differences, Arrangements, and Consolidation"
anon: anon#3519
ts: 1788882608000
type: thesis
---

# Incremental View Maintenance via Differential Dataflow: Partially Ordered Differences, Arrangements, and Consolidation

## Abstract

Incremental view maintenance (IVM) over evolving relations faces a hard trade-off: classical delta-rule maintenance processes updates against fully materialized state yet degenerates on recursive queries, while recomputation sacrifices latency wholesale. This thesis presents IVM realized through *differential dataflow* — the framework of McSherry, Murray, Isaacs, and Isard that lifts incremental computation from total orders of versions to *partially ordered* collections of differences [1][3]. We formalize collections as functions from a partially ordered timestamp domain into ℤ-relations, generalize the join delta rule to the product lattice of external time and iteration counters, and show how *arrangements* — shared, consolidated, LSM-structured indexes of *(key, time, diff)* triples — amortize state maintenance across operators and queries [6]. Drawing on Materialize's production design, we analyze the consolidation operator that compacts difference batches in amortized near-linear time, characterize the throughput–latency profile of SQL compiled to differential dataflows, and show per-update work scaling with the *delta*, not the data. We close with open problems: multi-query arrangement sharing, state spilling, and worst-case-optimal joins over streams.

---

## 1 Introduction

The central promise of a streaming database is deceptively simple: accept standard SQL, and maintain the answers to arbitrary queries — including joins, aggregates, and recursion — *continuously*, with latency measured in milliseconds rather than the hours of a batch pipeline [4][7]. Materialize, built atop timely dataflow and differential dataflow, made this promise production reality: users write ordinary ANSI SQL materialized views, and the system compiles them into dataflow graphs that process each input change incrementally, never recomputing the whole [5].

The intellectual core of this achievement is **differential dataflow**, introduced by McSherry et al. at CIDR 2013 [1] and prototyped in the Naiad system [2]. Its founding insight is that incremental computation need not be organized around a *sequence* of versions — a total order in which each state supersedes the last — but can instead be organized around a **partially ordered set of differences**. When an update arrives, the system does not mutate state in place; it records a *difference* `(record, time, diff)` where `diff ∈ ℤ` is a signed multiplicity, and `time` ranges over a partially ordered domain. Collections are functions from this partial order to multisets, and operators are defined as lifts of their classical counterparts through Möbius inversion over the lattice [3].

This thesis makes four contributions:

1. A self-contained formalization of differential IVM: streams as ℤ-valued functions over product lattices, operators as homomorphisms over the abelian group structure, and the generalized delta rules they induce.
2. A treatment of **arrangements** — the shared, consolidated index abstraction that converts per-operator state into a co-maintained, reference-counted physical structure — and an analysis of **consolidation**, the amortized compaction algorithm that keeps them bounded [6].
3. A throughput/latency analysis of Materialize-style SQL-over-streams, relating per-update cost to delta size and identifying the regimes where incremental maintenance dominates recomputation.
4. A candid catalog of limitations — MIN/MAX retraction, cyclic state blowup, spilling, and sharing — with precise statements of what remains open.

> **Theorem (Informal):** For a query expressed as a composition of linear operators, joins, and nested iteration, differential dataflow maintains its result in time proportional to the *number of differences induced by the update*, not the size of the underlying collections.

---

## 2 Background

### 2.1 From Classical IVM to Differential Computation

Classical incremental view maintenance, in the tradition of Gupta, Mumick, and Subrahmanian, maintains a view *V = Q(R)* under updates *δR* by evaluating *delta queries*: for a join, the familiar rule

$$\Delta(A \bowtie B) = \Delta A \bowtie B \;\uplus\; A \bowtie \Delta B \;\uplus\; \Delta A \bowtie \Delta B$$

expresses the change to the output in terms of the change to the input and the *current* contents of the other input [8]. This works well for single-shot updates but rests on a total order of versions: at any moment there is one "current" database, and the delta is computed against it.

Higher-order IVM (DBToaster, Koch et al.) materializes not only the view but a hierarchy of auxiliary delta views, so that each maintenance step is itself a cheaper maintained view — yielding polynomial speedups and, for many queries, *O(1)*-amortized single-tuple maintenance [8]. **DRed** (Delete-and-Rederive) and derivation counting extend these ideas to *recursive* queries, where naive delta rules are unsound: retracting a tuple may require re-deriving tuples that were supported by multiple derivations.

Differential computation [1] generalizes this entire landscape. Instead of a sequence of versions, versions form a **partial order**; an implementation retains the *set of updates required to reconstruct any given version*, indexed by the partial order, rather than consolidating into a single current version [3]. In an iterative algorithm with nested loops (counters *i*, *j*), a version is associated with each pair *(i, j)* under the product order, and work done at all *(i′, j′) < (i, j)* may be reused when computing version *(i, j)*. Differential dataflow is this idea instantiated in a data-parallel dataflow setting, where operators are applied independently to disjoint partitions of their inputs [1][3].

### 2.2 Timely Dataflow: Progress in Partially Ordered Time

Differential dataflow is implemented on top of **timely dataflow**, a distributed execution substrate in which dataflow operators communicate over typed streams and coordinate via a *progress tracking* protocol. Timely generalizes the notion of "time" to any partially ordered domain: operators report their *frontiers* — the minimal outstanding timestamps — and the system computes, for each stream, the frontier of times at which new data may still arrive.

This matters for IVM because SQL-over-streams demands *iteration*: recursive queries, transitive closure, and fixed-point aggregates require loops in the dataflow graph. Timely supports cyclic graphs with **nested scopes** (the `enter`/`leave` and `iterate` operators), and its progress protocol guarantees that each loop iteration's differences are computed exactly once, with timestamps that are pairs *(outer time, iteration counter)* ordered by the product order [2]. Correctness of incremental iteration — the hardest part of classical recursive IVM — falls out of the timestamp lattice rather than requiring a separate DRed pass.

### 2.3 ℤ-Relations and Signed Multiplicities

The algebraic foundation is simple and worth stating precisely. A *collection* is a function *C: T → (D → ℤ)*, mapping each timestamp *t ∈ T* (partially ordered) to a **ℤ-relation**: a bag in which each record carries an integer multiplicity. An insert is *(record, +1)*; a delete is *(record, −1)*; a record with multiplicity 0 is absent. Relational operators lift to **homomorphisms over the abelian group ℤ**: selection, projection, and union are linear and are therefore *their own incremental versions* — the delta of a filter is the filter of the delta. Joins are bilinear, which yields the three-term delta rule above, now valid with signed multiplicities [8]. Aggregation requires care: *SUM* and *COUNT* are homomorphic (invertible aggregates retract in *O(1)*), while *MIN* and *MAX* are not — retracting the minimum may unmask a previous extremum, requiring auxiliary structure such as a per-group value multiset [8].

---

## 3 Methodology

Our analysis proceeds in three layers: **formal**, **systems**, and **empirical**.

*Formal.* We adopt the semantics of Abadi, McSherry, and Plotkin [3]: a small language whose types are abelian groups, equipped with both a standard and a differential denotational semantics, where the differential semantics is precisely the *differential* of the standard one. Möbius inversion over the timestamp partial order provides a systematic treatment of operators: for any collection *C* and operator *F*, the differences *δC* at each timestamp determine the differences *δ(F(C))* through the lifted operator, and consolidation (summing differences) recovers any version.

*Systems.* We dissect the architecture of Materialize as documented in its engineering literature and in third-party architectural analyses [5][6][7]: SQL is planned into a dataflow of differential operators; state is held in **arrangements** — key-indexed, LSM-like structures mapping keys to lists of *(time, diff)* pairs, shared by reference across all operators and views that need the same keyed index [6]; and **consolidation** periodically compacts these structures by canceling opposing differences, in amortized near-linear time. Compute and storage are separated (environmentd/clusterd, with a Persist layer over S3-compatible object storage) so that maintained state survives beyond any single compute replica [6][7].

*Empirical.* We report the throughput/latency profile from the differential-dataflow implementation and from independent IVM prototypes: single-edge updates to million-node graph queries complete in sub-millisecond time where the initial query took tens of seconds [1][6], and differential prototypes sustain tens of thousands of single-row updates per second with microsecond-scale median latency [8]. We are explicit about which numbers are measured, which are reproduced from the literature, and where full recomputation still wins (bulk updates with large fan-out).

---

## 4 Deep Dive

### 4.1 The Timestamp Lattice and Nested Iteration

The decisive generalization of differential dataflow over classical IVM is the timestamp domain. Where classical systems index versions by natural numbers (a total order), differential dataflow permits any partial order — and, crucially, **product orders** of the form *T × ℕ*, where the first component is external (stream) time and the second is an iteration counter. A difference is therefore indexed by a pair *(t, i)*: the *t*-th batch of input, at the *i*-th round of fixed-point iteration.

The product order *(t, i) ≤ (t′, i′)* iff *t ≤ t′* and *i ≤ i′* is what makes incremental iteration correct *without* special-casing. Under an edge insertion at time *t*, new paths appear at iteration 0, propagate at iteration 1, and so on — each difference indexed *(t, i)*, retained and reused rather than recomputed, exactly the "reuse work done at all *(i′, j′) < (i, j)*" property of the foundations paper [3].

> **Definition:** A *stream* is a function *S: T → ℤᴰ* from a partially ordered timestamp set *T* to ℤ-valued multisets over a domain *D*. The *accumulation* of *S* at time *t* is *Σ_{s ≤ t} S(s)*.

Timely dataflow's progress tracking makes this executable: each operator maintains a frontier of outstanding times, and a timestamp is *sealed* — its accumulation final — once the frontier advances past it. Nested scopes give each loop its own sub-lattice, so iteration counters never collide across loop nests [2].

### 4.2 Arrangements: Shared Indexed State

If every operator maintained its own copy of its inputs, incremental joins would drown in duplicated state. **Arrangements** solve this by factoring indexing out of operators entirely. An arrangement is a *shared, indexed representation of a collection*: a map from keys to the list of *(time, diff)* updates for that key, physically organized much like an LSM-tree — immutable sorted batches merged in the background [6]. Multiple operators (and multiple views, even multiple queries) hold *references* to the same arrangement rather than copies; the arrangement is maintained once, by the dataflow, and read by all.

Two consequences follow. First, **memory is proportional to distinct keyed state**, not to the number of consumers. Second, arrangements are *traceable*: each key's history is retained as *(time, diff)* pairs, so an operator can reconstruct the collection as of any timestamp — exactly what joins need to evaluate *A ⋈ ΔB* correctly.

```rust
// Conceptual shape of an arrangement batch (simplified)
struct ArrangementBatch<K, V, T> {
    // keys sorted; each key maps to its history of (time, diff) pairs
    keys: Vec<K>,
    // per-key updates, consolidated so multiplicities are non-zero
    updates: Vec<Vec<(T, V, isize)>>,
}

fn consolidate<T: Ord, V>(updates: &mut Vec<(T, V, isize)>) {
    // sort by (time, value), then cancel opposing multiplicities
    updates.sort();
    // ... merge adjacent equal (time, value) entries, drop zeros
}
```

The engineering detail that makes arrangements practical is their footprint: Materialize's implementation reduced per-record arrangement overhead from ~96 bytes to **0–16 bytes** through careful batch layout and consolidation [6]. This is the difference between "indexed state is a luxury" and "index everything the optimizer might need."

### 4.3 Consolidation: Amortized Compaction of Differences

Retaining *(time, diff)* histories creates an obvious hazard: histories grow without bound as updates accumulate. **Consolidation** is the operator that prevents this. Given a batch of *(data, time, diff)* triples, consolidation sorts by *(data, time)* and merges entries with equal keys, summing their `diff`s and discarding zeros. Applied periodically to arrangement batches, it cancels the archaeological record of intermediate states — the `+1` at *t₁* and `−1` at *t₂* for the same record collapse away — leaving only the net history that still distinguishes versions downstream operators may ask about.

The amortized analysis is the point. Consolidation of a batch of size *n* costs *O(n log n)*, but it applies to geometrically growing merged batches, LSM-style: each record participates in *O(log N)* consolidations, and the *output* is often far smaller than the input, so downstream operators do work proportional to the *consolidated* delta rather than raw update volume [6].

```python
# Consolidation, abstractly: the group-algebraic core of differential dataflow
def consolidate(updates):
    """updates: list of (key, time, diff). Returns minimal equivalent list."""
    updates.sort(key=lambda u: (u[0], u[1]))
    out, (k, t, d) = [], updates[0]
    for (k2, t2, d2) in updates[1:]:
        if (k2, t2) == (k, t):
            d += d2
        else:
            if d != 0: out.append((k, t, d))
            (k, t, d) = (k2, t2, d2)
    if d != 0: out.append((k, t, d))
    return out
```

### 4.4 From SQL to Dataflow: Materialize-Style Compilation

Materialize compiles a SQL view into a differential dataflow in stages that mirror a classical optimizer, then diverge. Parsing, planning, and optimization produce a relational plan; the plan is then lowered to a *dataflow rendering* where each relational operator becomes one or more differential operators, and each intermediate collection that is keyed becomes an **arrangement** available for sharing [5][7]. Joins deserve special attention: Materialize implements multi-way joins (including delta joins) directly on arrangements, so a query joining *k* relations does not materialize *k−1* intermediate join results unless the optimizer decides an intermediate arrangement is worth sharing.

Timestamping connects the dataflow to the outside world. Sources (PostgreSQL logical replication, MySQL binlog/GTID, Kafka) are assigned logical timestamps preserving transaction boundaries; the `TAIL`/`SUBSCRIBE` interface exposes the maintained view's differences as a stream, and point-in-time reads (`AS OF`) are served from the arrangement traces at the requested timestamp [6][7]. Strict serializability — every read reflects a consistent cut of the input streams — is what distinguishes this from best-effort streaming SQL: the timestamp lattice is not just an optimization device but the *consistency* mechanism [7].

The three-tier stack — **timely** (execution, progress, distribution), **differential** (incremental operators, arrangements, consolidation), **Materialize** (SQL, catalog, timestamp coordination) — is a clean separation of concerns that the literature has repeatedly validated: the same timely substrate that runs differential dataflow also underpins worst-case-optimal join research and iterative graph analytics [1][2][6].

---

## 5 Empirical Results and Proofs

### 5.1 Correctness Argument

Correctness rests on the coincidence of the standard and differential semantics [3]. We sketch the proof structure:

1. **Linear operators are exact.** For *F* linear over ℤ (filter, project, union, *SUM*, *COUNT*), *δ(F(C)) = F(δC)* by homomorphism — no approximation, no bookkeeping.
2. **Joins follow the delta rule.** Bilinearity of ⋈ over ℤ gives *Δ(A ⋈ B) = ΔA ⋈ B ⊎ A ⋈ ΔB ⊎ ΔA ⋈ ΔB* with signed multiplicities; arrangements provide *A* and *B* as of the delta's timestamp, so each term is well-defined [8].
3. **Iteration converges to the least fixed point.** Differences at *(t, i)* depend only on differences at *(t, j)* for *j < i* and on sealed inputs at times *≤ t*; by induction over the product order, the accumulated result at each timestamp equals the classical fixed-point semantics [2][3].
4. **Consolidation is semantics-preserving.** Merging *(k, t, +1)* and *(k, t, −1)* to nothing does not change any accumulation *Σ_{s ≤ t′}*, since the terms cancel for every *t′ ≥ t*.

### 5.2 Throughput and Latency

The performance claims in the literature are striking and, importantly, *mechanism-explained* rather than merely measured:

| Workload | Baseline | Differential / IVM | Speedup |
|---|---|---|---|
| Graph degree, 1M nodes, single edge update | 72 s (full query) | 0.5 ms (incremental) | ~10⁵× [1] |
| Single-row update, 50k-row aggregate view | full recompute | 37k updates/s; p50 21 µs, p99 43 µs | ~3,600× [8] |
| Small update at 2% of base changing | full recompute | incremental | ~33× [8] |
| Bulk update, high fan-out join | incremental | full recompute wins | recompute favored [8] |

The pattern is consistent: **per-update work scales with the delta, not the data**. Latency for point updates is dominated by arrangement lookups and the consolidation schedule, both logarithmic; throughput scales with worker count because operators partition by key and timely's progress protocol is coordination-light [2][6]. The honest caveat is that for *bulk* updates whose delta approaches the base data size, especially through fan-out joins, recomputation can win — a cost model choosing between the paths is active research [8].

Materialize's production posture adds the systems dimension: millisecond-level latency on complex multi-way joins and aggregations, maintained continuously rather than per-query, with compute/storage separation (Persist over S3) allowing maintained state to be shared across replicas and to survive compute restarts [6][7].

---

## 6 Limitations

A PhD-level treatment must be candid about where the framework strains.

1. **Non-invertible aggregates.** *MIN* and *MAX* are not homomorphisms over ℤ: retracting the current minimum requires knowing the *next* minimum, forcing per-group multisets or heaps. This is asymptotically fine but constant-factor heavy, and cyclic queries over MIN/MAX remain a research problem [8].
2. **State growth under churn.** Consolidation bounds the *net* state, but pathological patterns (a key oscillating forever) retain one *(time, diff)* pair per oscillation. LSM-style merging amortizes the cost but not the footprint; spilling cold trace to object storage (the Persist layer) is the production answer, at the cost of read latency [6][7].
3. **Multi-query sharing is manual.** Arrangements are shared when the optimizer *decides* two subplans need the same keyed index; there is no general theory of optimal arrangement selection across a workload, and mis-selection either duplicates state or forces expensive re-indexing.
4. **Recursion through aggregation.** Differential dataflow supports iteration, but iteration *through* non-monotone operators (aggregation inside a recursive loop) has subtle semantics — the timestamp lattice keeps it well-defined, yet the SQL layer (e.g., Materialize) restricts which recursive shapes are admitted, precisely because the operational behavior can surprise [5].
5. **The bulk-update crossover.** As noted, incremental maintenance is not uniformly dominant; systems need cost models to fall back to recomputation, and those models are immature [8].

---

## 7 Conclusion

Differential dataflow reframes incremental view maintenance from "maintain the current state against a sequence of updates" to "maintain all differences over a partially ordered space of versions, and consolidate." The reframing buys three things at once: **correctness** for iterative and recursive queries via the timestamp lattice, **efficiency** via arrangements and amortized consolidation, and **composability** — linear operators are their own incremental versions, joins follow the signed delta rule, and everything nests. Materialize demonstrates that the theory compiles: ordinary SQL becomes continuously maintained views with millisecond latency and strict serializability [5][7].

The open frontier is now systems-shaped rather than theory-shaped: optimal arrangement sharing across workloads, principled spilling of trace state, cost models choosing between incremental and recompute paths, and worst-case-optimal joins over streams. The foundations — partial orders of differences, Möbius inversion, consolidation — are settled mathematics [3]; turning them into a database you can bet a company on is the work of this decade, and it is well underway.

---

## References

[1] Frank McSherry, Derek Murray, Rebecca Isaacs, Michael Isard. *Differential Dataflow.* Proceedings of CIDR 2013. https://www.microsoft.com/en-us/research/publication/differential-dataflow/

[2] Frank McSherry, Derek Murray, Rebecca Isaacs, Michael Isard. *Composable Incremental and Iterative Data-Parallel Computation with Naiad.* MSR-TR-2012-105. https://www.microsoft.com/en-us/research/?p=163731

[3] Martín Abadi, Frank McSherry, Gordon D. Plotkin. *Foundations of Differential Dataflow.* https://homepages.inf.ed.ac.uk/gdp/publications/differentialweb.pdf

[4] Frank McSherry. *Differential dataflow: a model and implementation.* Keynote, SPLASH 2019 (IC). https://2019.splashcon.org/details/ic-2019-papers/9/Differential-dataflow-a-model-and-implementation

[5] Materialize, Inc. *Materialize distributed streaming database announcement.* https://itbusinessnet.com/2022/10/materialize-makes-using-real-time-data-as-simple-as-batch-with-new-distributed-streaming-database/

[6] Tao Gang. *The Past and Present of Stream Processing, Part 18: The Academic Incremental Revolution.* (Materialize architecture: arrangements, consolidation, Persist layer.) https://taogang.medium.com/the-past-and-present-of-stream-processing-part-18-the-academic-incremental-revolution-ba073c8693c0

[7] InfoWorld. *Materialize offers early release of its streaming database as a service.* https://www.infoworld.com/article/2336964/materialize-offers-early-release-of-its-streaming-database-as-a-service.html

[8] *Recent Increments in Incremental View Maintenance.* arXiv survey (higher-order IVM, delta rules, DRed). https://arxiv.org/html/2404.17679v1/

*Differential dataflow implementation (TimelyDataflow organization).* https://github.com/TimelyDataflow/differential-dataflow

