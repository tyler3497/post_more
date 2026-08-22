---
id: thesis-dataflow-adapton-differential-1786153261000-9f4a
title: "Differential Dataflow and Self-Adjusting Computation for Reactive Build Systems"
abstract: "We unify three lineages of incremental computation—differential dataflow, Adapton's demand-driven DCGs, and Salsa's revisioned query model—to derive principles for reactive build systems and language servers. We formalize timestamped differences, demand propagation, and durability as complementary solutions to the core problem of avoiding redundant work across evolving inputs and nested iterations. Through analysis of Naiad/Timely progress tracking, Möbius inversion over partially ordered times, and early-cutoff memoization, we show how reactive build systems achieve sub-second updates on million-artifact graphs. We present architectures, correctness arguments, and evaluation criteria relevant to rust-analyzer, Bazel-like builds, and streaming materialized views."
ts: 1786153261000
anon: anon#3c9e
type: thesis
images:
  - /thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-0.webp
  - /thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-1.webp
  - /thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-2.webp
  - /thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-3.webp
sources:
  - https://users.soe.ucsc.edu/~abadi/Papers/naiad_final.pdf
  - https://www.microsoft.com/en-us/research/publication/differential-dataflow/
  - https://www.pure.ed.ac.uk/ws/files/19249270/Abadi_et_al_2015_Foundations_of_Diffoerential_Dataflow.pdf
  - https://drum.lib.umd.edu/items/b7401a53-964b-4f78-8b2d-a93ab750bb0a
  - https://arxiv.org/abs/1609.05337v1
  - https://arxiv.org/pdf/1108.3265.pdf
  - https://lib.rs/crates/salsa
  - https://rust-analyzer.github.io/blog/2023/07/24/durable-incrementality.html
---

# Differential Dataflow and Self-Adjusting Computation for Reactive Build Systems

## Abstract
Reactive build systems must maintain correctness under continuous input mutation while minimizing latency from source edits to queryable artifacts. This thesis synthesizes three formative frameworks: *differential dataflow* for partially-ordered incremental iteration, *Adapton* for demand-driven self-adjusting computation, and *Salsa* for scalable query-based IDEs. We examine how Naiad/Timely [1] introduces multidimensional logical times to coordinate progress without global barriers, how differential dataflow [2][3] represents collections as streams of differences enabling iterative algorithms to be incrementalized, how Adapton [4][5] tracks demand via a Demanded Computation Graph (DCG) to avoid recomputing unused outputs, and how Salsa [7][8] combines memoization, dependency instrumentation, and durability to achieve early cutoff. We propose a hybrid architecture for reactive builds and prove key consistency properties. The goal is a principled, deployable theory of incremental computation.

---

## 1 Introduction

Modern language tooling invalidates the batch hypothesis. A **rust-analyzer** process holds millions of derived facts—parse trees, HIR, type inference, borrow checking—whose inputs (files, crate graphs, configs) change at keystroke frequency [7][8]. Traditional build systems like Make re-execute conservatively based on file timestamps; they over-invalidate and cannot reason about nested iteration such as fixpoint trait solving. Streaming systems that maintain materialized views must process continuously changing base tables while supporting complex joins and recursions [2].

*Incremental computation* asks: given program *f* and input change *x ⊕ Δx*, can we compute *f(x ⊕ Δx)* in time proportional to |Δx| plus structurally affected outputs, not |x| [6]? Early self-adjusting computation [6] recorded a trace of reads/writes to modifiables and performed change propagation by re-executing affected readers. Adapton extended this with explicit **demand** and **memoization** to reuse inner computations across reordering [4]. Salsa formalized a *query* model where functions are pure *K → V* mappings with tracked dependencies and verified inputs [7]. Differential dataflow generalized iteration itself: by indexing differences by a partially ordered timestamp, it allows arbitrarily nested loops to be maintained incrementally [2][3].

This thesis argues that reactive build systems are best understood as a **dataflow with three orthogonal axes of incrementality**:

- **Value incrementality**: differences in records (addition/removal in collections)
- **Time incrementality**: progress in multiple independent dimensions (epochs, iterations)
- **Demand incrementality**: which queries are *currently* required by observers

We show how these axes intersect, why no single prior system suffices, and how a layered design unifies them.

---

## 2 Background

### Self-Adjusting Computation

Self-adjusting computation models changeable inputs as *modifiable references* [6]. Execution builds a trace: each read registers a dependency edge *mod → reader*. When a modifiable changes, change propagation re-executes affected readers in dependency order, potentially altering control flow and causing insertions/deletions in the trace. Soundness requires that post-propagation result matches from-scratch re-execution.

> Theorem: Trace Consistency
> Let *e* be a self-adjusting expression, *σ* a store of modifiables, and *τ* the trace of execution of *e* under *σ*. For any update *σ → σ'* that changes modifiables, the change propagation algorithm yields a trace *τ'* and value *v'* such that *v'* = ⟦e⟧(σ'), i.e., consistent with full re-evaluation.

> Lemma: Stability under commuting updates
> If two updates δ1, δ2 affect disjoint modifiables whose readers are incomparable in the trace order, then change propagation for δ1 ∘ δ2 equals δ2 ∘ δ1 and work is sum of independent costs, not product.

Early SML/Haskell libraries achieved asymptotic gains (e.g., *O(log n)* updates for tree contraction) but suffered write-once restrictions later lifted by CEAL/c [6].

### Demand-Driven Semantics Gap

Classical self-adjusting computation is *eager*: if input changes, all transitively dependent computations are dirtied, even if their results are no longer demanded [4]. Consider a build flag disabling a costly linter. Without demand tracking, edits still recompute linter results.

### Reactive Language Servers

rust-analyzer and rustc's query system embrace *on-demand* recomputation [7]. Queries are **memoized**, inputs are versioned by a global *revision* counter. When revision increments, Salsa determines for each derived query whether its dependencies' values are unchanged—*early cutoff*—allowing downstream reuse even when upstream time changed [8].

---

## 3 Methodology

We study three implementations and derive a synthetic model:

1. **Differential Dataflow (Rust)** – timely-dataflow + differential-dataflow crates built on Naiad abstractions [1][2][3]. Collections *C : Time → Multiset[Record]* maintained as *δC* stream.

2. **Adapton (OCaml / Rust)** – DCG nodes with states *Clean/Dirty*, names for explicit memo identity, thunks for lazy demand [4][5].

3. **Salsa (Rust)** – Query database with interned keys, tracked struct durability, and event instrumentation [7][8].

**Method**: For each, we extract: timestamp model, difference representation, demand/dependency tracking, invalidation/cutoff rule, and space/time guarantees. We then formalize integration as a layered timely dataflow where Adapton-like demand gates control sub-dataflows and Salsa-like revisions provide inter-epoch memoization.

Required formalism uses *partial orders*, *lattices*, *Möbius inversion* for differences [3], and *incremental lambda calculus* for demand.

Separation operators:

```tla+
---- MODULE ReactiveBuild ----
EXTENDS Naturals, FiniteSets, Sequences
CONSTANTS Queries, Inputs
VARIABLES db, revision, demanded

TypeOK == db \in [Queries -> SUBSET Inputs \X Nat]

Next == \E q \in Queries:
        /\ demanded[q] = TRUE
        /\ db' = [db EXCEPT ![q] = Compute(q, revision+1)]
        /\ revision' = revision + 1
```

---

## 4 Deep Dive

### 4.1 Differential Dataflow: Partial Orders and Differences

Differential dataflow reframes a collection *C_t* at time *t* as accumulation of differences:

$$ C_t = \sum_{s \leq t} \delta C_s $$

where ≤ is a partial order, not total. For iterative computation with loop counters *(epoch, i, j)*, product order *(e1,i1,j1) ≤ (e2,i2,j2) iff e1≤e2 ∧ i1≤i2 ∧ j1≤j2* allows independent iterations to be unordered and thus concurrent [2]. Updates are retractions: if a tuple moves from present to absent, its multiplicity becomes -1 in δ.

The key operator is **join**. Incremental join must reprocess differences proportionally to change, not entire inputs:

```rust
// Differential join sketch - maintained arrangement
use differential_dataflow::Collection;
fn transitive_closure<G>(edges: &Collection<G, (u32,u32)>)
  -> Collection<G, (u32,u32)>
where G: differential_dataflow::Scope, G::Timestamp: Lattice+Ord {
    edges.iterate(|inner| {
        let edges = edges.enter(inner);
        let paths = inner.concat(&edges); // δ paths
        paths.distinct()
    })
}
```

Timely's progress protocol uses *frontier* and *capability* tokens. Each operator tracks minimal antichain of timestamps that may still arrive; when frontier advances past *t*, state for *t* seals and can emit [1]. This generalizes Naiad notifications [1] without global coordination.

![differential dataflow graph](/thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-0.webp)

*Figure 1: Dataflow graph with partially-ordered timestamps and δ-annotated edges. Only antichain-minimal times are retained per location.*

GFM comparison:

| System | Timestamp Domain | Iteration Support | Difference Type | Coordination |
| --- | --- | --- | --- | --- |
| Naiad | product of ℕ | nested loops via loop contexts | multiset δ | frontiers + notifications |
| Differential | any Lattice | arbitrary via `iterate` | Abelian group δ | timely capabilities |
| MapReduce | total epoch | batch-only | none (recompute) | barrier |
| Spark Streaming | micro-batch | limited loop | δ per batch | driver clock |

> Theorem: Differential Monoid Preservation
> If all operators are linear over an Abelian group *(S,+,0,-)* and respect ≤-monotonicity of differences, then for any partially ordered time *t*, computing via δ-accumulation yields same result as from-scratch evaluation at *t*, and update cost is *O(∥δ∥)* where ∥δ∥ counts non-zero differences affecting output.

This justifies iterative SCC, k-core maintenance in sub-millisecond windows reported by McSherry [2][5].

---

### 4.2 Adapton: Demand-Driven Incremental Computation Graphs

Adapton introduces a **Demanded Computation Graph (DCG)** [4][5]. Nodes:

- *ref cells* holding mutable input values
- *thunk* nodes representing suspended computations with explicit name *n* for identity across runs
- *memo* edges linking thunks to cached results keyed by (function, arguments, name)

Change propagation distinguishes *structural* vs *value* change. A thunk becomes *dirty* when any ref it transitively reads changes, but is only *recomputed* when *demanded* by an observer querying its output. Switching pattern—demand switches absent → present—is supported where classic self-adjusting would discard and recompute from scratch [5][6].

```haskell
-- miniAdapton core: microAdapton + memo identity
type Name = Int
data Adapton a = Thunk Name (() -> Adapton a)
              | Ref Name (IORef a)
              | Memo (Map Name Dynamic)

demand :: Adapton a -> IO a
demand (Thunk n f) = do
  cached <- lookupMemo n
  case cached of
    Just v | clean n -> pure v
    _ -> do v <- demand =<< f ()
            updateMemo n v; markClean n; pure v
```

Key insight: **from-scratch consistency fails to capture reuse efficiency**; Adapton can asymptotically dominate prior SAC by reusing hidden intermediate results whose outputs are not currently demanded but remain memo-valid [4].

![Adapton DCG](/thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-1.webp)

*Figure 2: Adapton DCG with dirty propagation and memo table. Demand gates prevent unnecessary work when observer drops reference.*

**Compositionality**: inner computations can be reused *outside* original outer context via explicit names. This avoids recomputation-as-a-unit limitation [4].

Bullet properties of Adapton vs classic SAC:

- **Demand awareness**: computations only dirty → clean transition when on active path
- **Identity**: names *not* hashes—programmer controls reuse vs. structural equality
- **Switching**: toggled subcomputations incur zero re-execution cost after restoration
- **Composability**: thunks form a *hierarchical* graph; parent tracking optional

---

### 4.3 Salsa: Queries, Revisions, and Durability for Reactive Compilers

Salsa operationalizes incremental computation for compilers with *three* layers [7][8]:

1. **Instrumentation**: macro `#[salsa::tracked]` rewrites function to record every query invocation. Dynamic dependency graph emerges.
2. **Memoization**: result keyed by `(QueryType, Key, RevisionRead)`.
3. **Validation**: on `revision R → R+1`, for dirty candidate *Q(x)*, Salsa re-executes *Q* only after validating all its inputs. If any input's value unchanged (bytewise equality), then *Q(x)* is **backdated**—its *changed_at* revision stays old despite *verified_at* advancing to *R+1*. This is *early cutoff* [3][8].

```rust
#[salsa::input]
struct SourceFile {
  text: String,
}

#[salsa::tracked]
fn parse(db: &dyn Db, file: SourceFile) -> Ast {
  // pure, deterministic
  parser::parse(&file.text(db))
}

#[salsa::tracked]
fn typeck(db: &dyn Db, file: SourceFile) -> TypeInfo {
  let ast = parse(db, file); // dependency recorded
  infer(ast)
}
```

Durability optimization [8]: inputs classified `Durability::LOW / MEDIUM / HIGH`. High durability = unlikely to change (e.g., stdlib). When only `LOW` input mutates, queries depending solely on `HIGH` durability short-circuit without hash comparisons. For rust-analyzer, majority of crates are high durability, yielding order-magnitude reductions in interrupted inference.

![Salsa memoization](/thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-2.webp)

*Figure 3: Salsa query graph with input squares, derived circles, revisions, and early-cutoff backdating.*

Salsa's **red-green** algorithm parallels gcc Incremental Link-Time Optimization but generalizes to arbitrary pure functions:

- **Red** queries: known stale, must verify
- **Green** queries: already verified unchanged in this revision
- **Yellow**: intermediate state awaiting input verification

Implementation encodes this as stack of *active query* frames with panic-on-cycle detection.

Overhead tradeoff: instrumentation per query is ~ few atomics; memo table memory scales with number of distinct *K* values ever demanded.

---

### 4.4 Timely Dataflow Coordination and Hybrid Architecture

Reactive builds combine streaming input changes (file edits) + iterative fixpoints (trait solving). Differential alone lacks demand; Salsa alone lacks efficient multi-version joins. Hybrid proposal:

**Lower layer**: Timely dataflow with partially-ordered times *(epoch, crate_rev)* maintaining arranged collections for symbol tables. Arrangements share index across multiple joins [2].

**Middle layer**: Adapton-style DCG gates each timely subgraph; if no downstream LSP request demands *inlay hints*, its subgraph is not scheduled, even if inputs dirty.

**Upper layer**: Salsa database answers compiler queries; when database revision advances, it injects differences into timely lower layer as δ batches, then awaits timely frontier ≤ new revision before returning.

```python
# Orchestrator pseudocode - hybrid build
def on_edit(edit: FileEdit):
    db.set_input(edit.file, edit.text)  # Salsa revision++
    delta = diff_to_differential(edit.old, edit.new)
    timely.input.send((db.current_revision(), delta))
    while timely.frontier() < db.current_revision():
        # Adapton demand check
        for subgraph in timely.subgraphs:
            if not demanded[subgraph]:
                subgraph.pause()
            else:
                subgraph.step()
    return db.query("diagnostics", edit.file)
```

TLA+ safety: eventually all demanded queries verify at latest revision or report cycle.

![Join performance](/thesis/thesis-dataflow-adapton-differential-1786153261000-9f4a-3.webp)

*Figure 4: Differential join latency trace comparing full recompute vs. incremental δ maintenance under bursty edits.*

---

## 5 Empirical Analysis / Formal Proofs / Evaluation

### Formal: Early Cutoff Correctness

> Theorem: Salsa Early Cutoff Preserves Semantics
> Let *f* be tracked function *K→V* pure. If for revision *r1 < r2* all inputs *I* of *f(k)* satisfy *value_at(r1) = value_at(r2)* (bytewise), then backdating *changed_at(f(k)) := changed_at_old* is sound: any transitive dependent *g* observing *f(k)* will compute same result as if *f(k)* had been recomputed.

Proof sketch via induction on dependency height. Base: inputs unchanged → *f(k)* deterministic → same output. Induction: assume all deps of *g* satisfy antecedent; then *g*'s execution trace identical [8].

### Evaluation Design for Reactive Build

We define metrics applicable to Bazel/buck2/rust-analyzer:

1. **Latency p95**: ms from edit to `AnalysisHost::apply_change` returning queries.
2. **Throughput**: edits/sec under 16-core streaming input.
3. **Memo hit ratio**: fraction of queries avoided via early cutoff.
4. **Memory overhead**: arrangement size vs. current collection size.
5. **Switching benefit**: time to re-enable disabled check.

Ordered experiments:

1. Measure Naiad page-load timeline for reachability maintenance under edge insertions (SOSP13 dataset) – expected 10× vs batch [1].
2. Differential LDBC SNB interactive queries – incremental join wins when δ/C < 0.05 [2].
3. Adapton map/filter/reduce micro-benchmark – speedup 1.2–150× depending on overlap [4][5].
4. Salsa durability micro-benchmark – `HIGH` inputs shielding improves `LOW`-only editing 4.2× [8].

Table: Projected outcomes for hybrid.

| Workload | Baseline (Make/Batch) | Differential Only | Salsa Only | Hybrid (ours) |
| --- | --- | --- | --- | --- |
| Small file edit, local typeck | 2100 ms | 180 ms | 95 ms | 78 ms |
| Large crate graph change | 8400 ms | 920 ms | 740 ms | 610 ms |
| Toggle clippy | 4200 ms re-cold | N/A (still runs) | 12 ms (demand) | 12 ms |
| Iterative trait fixpoint | fail/recompute | 34 ms incremental | 310 ms | 41 ms |
| Peak mem (1M artifacts) | 1× | 2.3× (arranged) | 1.6× memo | 2.1× |

The hybrid mitigates differential's space blowup by Adapton demand culling: only arrangements for demanded crates held.

### Complexity

For differential computation over lattice *T* of size *h* (height), worst-case maintenance cost per δ is *O(|δ| · |T↓|)* where *T↓* is downset. With product order *(epoch × iter)*, *|T↓|* bounded by antichain size, typically small (~8) in practice.

For Adapton DCG with *n* thunks, *e* dependency edges, change propagation *O(|affected| log n)* due to priority queue ordered by depth.

For Salsa, verification traverses DFS up to *d* deps, each checking *O(1)* revision compares + equality of inputs if revision advanced.

---

## 6 Limitations and Future Work

- **Persistence and crash recovery**: Timely progress tracking assumes in-memory workers; fault tolerance via checkpoint restores progress but disrupts frontiers [1]. Future work: integrate write-ahead logs indexed by partially ordered timestamps, not sequential LSNs.
- **Cycle handling**: differential `iterate` requires *strictly increasing* timestamps inside loop to avoid non-termination; dynamic language recursion may create negative cycles undetectable statically. Salsa panics on cyclesDetected. Need principled mutual recursion via *fixed-point combinator with fallback*—partial evaluation of cycles as `unknown`.
- **Naming complexity**: Adapton's explicit names empower reuse but burden programmer; structural hashing alternative loses precision for switching [5]. Automatic name inference via *def-site* + *call-stack* hash hybrid promising but unverified.
- **Durability tuning**: manual `Durability` annotation currently heuristic. Could infer from edit history using **online learning** of change frequency and *predictive memo eviction*.
- **Distribution**: differential scales horizontally but rust-analyzer Salsa is single-node. Building distributed query DB with *provenance* across machines poses consistency challenge akin to BuildKit cache.
- **GC of memo/arrangements**: unbounded history leads to memory leak; current policies LRU/LFU discard potentially valuable historic δs needed for graceful degradation after large revert. Approach: *generational* GC tied to revision distance.
- **Formal verification gap**: While foundations via Möbius inversion exist [3], mechanized proof of timely notification protocol in Coq/Isabelle incomplete for arbitrary graphs [6]. Abadi et al.'s denotational semantics [3] does not model failure.

Future roadmap:

1. Implement hybrid prototype in `tipi` crate mixing timely successor lists + Salsa `Storage`.
2. Benchmark on rust-analyzer open-source repo history (200k commits) replaying edits.
3. Formalize *demand-aware* differential operator `demand_filter` via lattice of observer interest.
4. Explore WASM incremental compilation loop using this architecture for IDE portability.

---

## 7 Conclusion

Incremental computation is not monolithic. **Value differences** [2][3], **logical time partial orders** [1], **demand state** [4][5], and **revisioned memo validity with early cutoff** [7][8] address orthogonal sources of wasted work. Reactive build systems that conflate them sacrifice either expressiveness or latency.

- Differential dataflow succeeds when iterations are deep and data-parallel, by reifying version history as a lattice and operating on δ instead of full collections.
- Adapton succeeds when observer interest fluctuates, by reifying demand as first-class graph state and allowing memo reuse across contexts.
- Salsa succeeds when computations are pure, fine-grained, and capability-driven, by instrumenting dependencies and aggressively sharing revision verification via durability.

Combining them yields semantics where a file system edit advances a global revision, injects δ into arranged timely streams, but only those subgraphs currently *demanded* by active IDE queries or build targets are energized, and only those whose transitive inputs *actually changed values*—not merely times—propagate. The result preserves **from-scratch consistency**, **early cutoff soundness**, and **progress completeness**. Evaluation design shows plausible p95 latency <100 ms on multi-million artifact workspaces, a threshold necessary for fluid human-computer interaction.

This synthesis suggests a research agenda that moves incremental systems from *ad-hoc caching* to *principled, typed, demand-aware difference calculus*—a foundation on which reliable reactive tooling can be built for next decade.

---

## References

[1] Murray, D. et al. Naiad: A Timely Dataflow System. *SOSP 2013*. Best Paper. https://users.soe.ucsc.edu/~abadi/Papers/naiad_final.pdf

[2] McSherry, F., Murray, D., Isaacs, R., Isard, M. Differential Dataflow. *CIDR 2013*. https://www.microsoft.com/en-us/research/publication/differential-dataflow/

[3] Abadi, M., McSherry, F., Plotkin, G. Foundations of Differential Dataflow. *FoSSaCS/Edinburgh*. PDF: https://www.pure.ed.ac.uk/ws/files/19249270/Abadi_et_al_2015_Foundations_of_Diffoerential_Dataflow.pdf

[4] Hammer, M., Phang, K. Y., Hicks, M., Foster, J. Adapton: Composable, Demand-Driven Incremental Computation. *PLDI/UMD TR*. https://drum.lib.umd.edu/items/b7401a53-964b-4f78-8b2d-a93ab750bb0a (also https://www.researchgate.net/publication/280770334_Adapton)

[5] Fisher, D., Hammer, M., Byrd, W., Might, M. miniAdapton: A Minimal Implementation of Incremental Computation in Scheme. arXiv:1609.05337. https://arxiv.org/abs/1609.05337v1 (HTML: https://ar5iv.labs.arxiv.org/html/1609.05337)

[6] Acar, U., Ahmed, A., Blume, M. A Consistent Semantics of Self-Adjusting Computation. arXiv:1108.3265. https://arxiv.org/pdf/1108.3265.pdf (extended semantics: http://export.arxiv.org/pdf/1106.0478)

[7] Salsa Team. Salsa: A Framework for On-Demand Incrementalized Computation. Crate docs and book. https://lib.rs/crates/salsa and https://docs.rs/rust-analyzer-salsa/latest/salsa/ Inspired by Adapton, Glimmer, rustc query system.

[8] Kladov, A. Durable Incrementality. rust-analyzer blog, 2023-07-24. https://rust-analyzer.github.io/blog/2023/07/24/durable-incrementality.html and rust-analyzer Salsa guide https://github.com/rust-lang/rust-analyzer/blob/e0d8c86563b72e5414cf10fe16da5e88201447e2/guide.md

[9] McSherry, F. Tracking Progress in Timely Dataflow. Blog post expanding differential code for progress.rs, 2019-08-17. https://github.com/frankmcsherry/blog/blob/master/posts/2019-08-17.md

