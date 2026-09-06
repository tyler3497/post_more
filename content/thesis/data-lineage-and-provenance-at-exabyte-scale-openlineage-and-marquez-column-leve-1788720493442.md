---
id: ths_1788719456272_afbd
title: "Data Lineage and Provenance at Exabyte Scale: OpenLineage and Marquez, Column-Level Lineage via SQL Parsing, and Taint Tracking in Apache Spark"
anon: anon#4611
ts: 1788720493442
tags: [Data]
type: thesis
---
# Data Lineage and Provenance at Exabyte Scale: OpenLineage and Marquez, Column-Level Lineage via SQL Parsing, and Taint Tracking in Apache Spark

## Abstract

Modern data estates route petabytes through thousands of scheduled pipelines daily, yet most organizations cannot answer a deceptively simple question: *where did this field come from, and what breaks if I change it?* This thesis synthesizes three complementary answers. First, we formalize the OpenLineage event model — Run, Job, Dataset, and Facets — and its reference implementation, Marquez, which materializes streaming lineage events into a queryable metadata graph at exabyte scale. Second, we develop the algorithms behind column-level lineage via SQL parsing, reducing a query to a provenance semiring over an abstract syntax tree and resolving edges under aliasing, subqueries, star expansion, and aggregation with provable soundness guarantees. Third, we analyze taint tracking inside Apache Spark through the lineage-capture designs of systems like Titian: forward and backward tracing of individual records through narrow and wide dependencies with sub-30% overhead. We prove that fine-grained provenance is a dynamic taint analysis over a dataflow lattice, evaluate capture costs, and close with open problems in completeness, scale, and standardization.

---

## 1 Introduction

Data lineage — the record of *which datasets and columns flowed into which, through which transformations* — has graduated from governance checkbox to operational necessity. GDPR erasure, incident blast-radius analysis, and backfill re-computation planning all demand lineage that is *complete*, *fine-grained*, and *trustworthy*. Yet the modern stack resists all three: it is disaggregated across systems [2], polyglot across SQL dialects and DataFrame APIs, and vast, with daily lineage graphs exceeding billions of edges [4].

This thesis argues that no single mechanism solves lineage at scale. Instead, three layers compose into a coherent system:

1. **Coarse-grained, runtime-observed lineage** — captured *as jobs run*, standardized by the OpenLineage specification and materialized by the Marquez metadata service [3][4]: which tables were read and written by which runs.
2. **Fine-grained, statically derived lineage** — extracted from SQL *text* by parsing it into an AST and walking projections, FROM clauses, and predicates [7]: which *columns* flow where, with zero runtime instrumentation.
3. **Record-level, dynamically tracked provenance** — propagated *through* a running distributed computation, in the tradition of Titian for Spark [1]: which exact input records produced a given output row.

Our central contribution is a unified formal treatment: all three layers are instances of provenance semirings over dataflow graphs, differing only in *granularity* (dataset, column, record), *timing* (post-hoc events, static analysis, dynamic capture), and *completeness guarantees*. We score each on **precision**, **recall**, **overhead**, and **composability**.

---

## 2 Background

### 2.1 Lineage, provenance, and their distinctions

The terms *lineage* and *provenance* are frequently conflated but denote different lenses on the same metadata. Following the e-science provenance survey tradition [5]:

> **Theorem (Lineage–Provenance Duality):** *Let G = (V, E) be a data ecosystem's transformation graph. Then: (i) lineage is the transitive closure of read-then-write reachability from a dataset of interest; (ii) provenance is the inversion of that closure — the minimal subgraph explaining a data product's origins. Both are projections of one graph, differing only in query direction.*

Provenance further decomposes into three classical categories [5][6]: **where-provenance** (which source locations contributed), **why-provenance** (which source tuples *witnessed* a result), and **how-provenance** (the algebraic derivation, captured by provenance semirings propagating annotations via ⊕ for alternative use and ⊗ for joint use).

Operationally: where-provenance suffices for GDPR erasure; why-provenance for debugging bad aggregates; how-provenance for re-computation minimization.

### 2.2 The "big metadata" crisis

Hellerstein et al. [2] diagnosed the modern condition: disaggregation means no single catalog owns the full transformation graph. Each engine (Spark, Flink, dbt, Airflow) knows its own fragment; the lineage that matters — *end-to-end, across engines* — exists nowhere. Big-data provenance surveys [6] add that naive capture strategies collapse at scale: annotation-based query rewriting blows up data volume, while lazy on-demand recomputation faces unbounded query cost.

This motivates the strategy organizing this thesis: *standardize the collection protocol* (OpenLineage), so fragments can be assembled, and *make fine-grained extraction cheap* (static SQL parsing; bounded-overhead dynamic taint tracking), so the assembled graph is worth having.

### 2.3 Apache Spark as the reference execution substrate

Spark's RDD model exposes an explicit lineage DAG for fault tolerance (narrow vs. wide dependencies), but natively tracks partitions, not records — the gap record-level systems must close [1]. Its Catalyst optimizer additionally exposes logical plans amenable to static analysis.

---

## 3 Methodology

Our methodology is analytic and systems-oriented: we formalize each lineage layer, reduce it to a graph-construction algorithm, characterize its complexity and completeness, and ground claims in published measurements and reference implementations.

### 3.1 Formal model

We define a **lineage graph** as a directed multigraph *G = (V, E)* with typed vertices (Dataset, Column, Job, Run, Record — see table) and provenance-semiring-annotated edges.

| Vertex type | Granularity | Example |
|---|---|---|
| `Dataset` | table / file / topic | `warehouse.fact_orders` |
| `Column` | field within a dataset | `fact_orders.customer_id` |
| `Job` | executable process definition | `etl-nightly-orders` |
| `Run` | one execution of a job | run UUID `3f9a…` |
| `Record` | single tuple (dynamic layer) | partition 7, offset 12 |

Edges carry a provenance-semiring annotation: selection propagates annotations unchanged, projection applies ⊕-aggregation over contributing columns, joins apply ⊗ over join partners. An edge *(u → v)* labeled *t* asserts "the value at *v* at time *t* depends on *u*".

### 3.2 Evaluation criteria

For each layer we score **precision**, **recall**, **capture overhead**, **query latency**, and **scale ceiling**, using published system measurements [1][3][7] and our own complexity analysis.

### 3.3 Threats to validity

Overhead figures (e.g., Titian's <30% [1]) were measured on 2015-era Spark and TPC-style workloads; static SQL lineage recall depends on parser dialect coverage; Marquez scale claims derive from production deployments, not controlled experiments [4].

---

## 4 Deep Dive

### 4.1 The OpenLineage event model and its formal semantics

OpenLineage standardizes lineage *collection* rather than lineage *storage*. Its specification [3] defines three core entities:

- **Run Event**: an immutable record of a job run's observed state. Emitters must send at least `START` and one terminal event (`COMPLETE`, `FAIL`, `ABORT`); intermediate `RUNNING` events are optional.
- **Job**: a process definition identified by `(namespace, name)`, consuming input datasets and producing output datasets.
- **Dataset**: an abstract data reference identified by `(namespace, name)`, e.g., `db.host.database.schema.table`.

Extensibility comes from **facets** — namespaced metadata fragments attached to runs, jobs, or datasets (`schema`, `columnLineage`, `dataQualityMetrics`, `sql`). The event schema is formalized as JSON Schema with an OpenAPI transport binding [3].

![OpenLineage core data model: Run, Job, Dataset entities with facets](/thesis/ths_1788719456272_afbd-0.webp)

> **Theorem (Event Reconstructibility):** *Given a complete, ordered stream of OpenLineage run events for a namespace, the dataset-level lineage graph is reconstructible: for every input I and output O of a completed run R, the edge I → Job → O is derivable, and the derived graph soundly over-approximates true data flow (spurious edges arise only from unobserved branching inside opaque jobs).*

The over-approximation caveat is fundamental: OpenLineage trusts the emitter's declared inputs/outputs. An opaque UDF that reads a table but never declares it produces *missing* edges (recall loss); a job that declares inputs it conditionally skips produces *spurious* edges (precision loss). This is precisely why static SQL analysis (§4.2) is the natural complement: the emitted `sql` facet can be parsed independently to verify or refine declared edges, and its `columnLineage` facet attaches parser-derived column granularity to the same run.

```python
# Minimal OpenLineage event, illustrating the facet extension point
event = {
    "eventType": "COMPLETE",
    "run": {"runId": "3f9a2c1e-…", "facets": {}},
    "job": {"namespace": "warehouse-etl", "name": "nightly_orders",
            "facets": {"sql": {"query": "INSERT INTO fact_orders SELECT …"}}},
    "inputs":  [{"namespace": "postgres://db", "name": "staging.orders",
                 "facets": {"schema": {"fields": [{"name": "customer_id"}]}}}],
    "outputs": [{"namespace": "postgres://db", "name": "warehouse.fact_orders",
                 "facets": {"columnLineage": {"fields": {
                     "customer_id": {"inputFields": [
                         {"namespace": "postgres://db", "name": "staging.orders",
                          "field": "customer_id"}]}}}}}}]
}
```

### 4.2 Column-level lineage via SQL parsing

Column-level lineage answers "which fields" — the granularity at which PII tracking, schema-change impact analysis, and feature-store provenance operate. The key insight: for the overwhelmingly common case of SQL-defined transformations, lineage is *derivable from the query text alone*, with zero runtime instrumentation [7].

#### 4.2.1 The algorithm

Given a SQL statement *S*, the parser produces an AST, and lineage extraction is a recursive walk:

1. **Split** *S* into statements; for each `INSERT`/`CREATE TABLE AS`/`MERGE`, separate the *target* relation from the *source query*.
2. **Resolve the FROM clause**: map each table alias → base relation, descending into subqueries and CTEs recursively.
3. **Walk the SELECT list**: for each projection expression *e* with output name *c*, collect column references in *e*'s subtree (functions, `CASE`, arithmetic, casts); each resolves through the scope to *(table, column)*, emitting edge *(table.column → target.c)*.
4. **Handle star expansion**: `SELECT *` expands against catalog metadata when available; without metadata, emit a *virtual* column edge `source.* → target.*` as an explicit unknown [7].
5. **Assemble the DAG**: union per-statement edge sets across the script, keyed by fully qualified `(schema, table, column)`.

```haskell
-- Core lineage extraction, idealized
extractLineage :: Statement -> LineageGraph
extractLineage (Insert target query) =
    let scope  = resolveScope query          -- alias -> relation
        cols   = selectList query
        edges  = [ (resolve scope ref, (target, outName e))
                 | e <- cols, ref <- columnRefs e ]
    in foldr addEdge emptyGraph edges
  where
    columnRefs = universeBi :: Expr -> [ColumnRef]  -- generic SYB-style fold
```

The walk is *O(|AST|)* per statement; parallel batch parsing scales near-linearly in statement count [7].

#### 4.2.2 Soundness, completeness, and the hard cases

> **Theorem (Parser Soundness):** *For SELECT/INSERT with equi-joins, subqueries, CTEs, scalar functions, and aggregation — with complete catalog metadata for star expansion and no dynamic SQL — the algorithm emits edge (s → t) iff column t functionally depends on column s. It is sound and complete on this fragment.*

Outside the fragment, the algorithm degrades explicitly rather than silently:

| Construct | Behavior | Guarantee |
|---|---|---|
| `SELECT *` without metadata | virtual `*` edges | sound over-approximation |
| Unqualified column in multi-table join | edges to *all* candidate tables, flagged ambiguous | recall preserved, precision flagged |
| `UNION` branches | union of per-branch edges | sound |
| Window functions | partition/order keys treated as contributors | sound over-approximation |
| Dynamic SQL / stored procedures | unparseable → statement skipped with error | explicit failure, never silent |

This *explicit-failure* discipline separates serious lineage tooling from regex hacks: an `InvalidSyntaxException` is a feature, because a silently-missed edge is a lie the graph repeats at audit time [7].

![Column-level lineage derived from SQL parsing: query to AST to dependency DAG](/thesis/ths_1788719456272_afbd-1.webp)

#### 4.2.3 Provenance semirings meet the projection list

The walk above computes *where*-provenance. *Why*- and *how*-provenance need operator semantics: for `SELECT a.x + b.y`, the how-provenance polynomial is `a.x ⊗ b.y`; for `UNION`, `p₁ ⊕ p₂`. Static parsing can emit these polynomials symbolically, but evaluating them requires data — the bridge to dynamic tracking (§4.3). Production column lineage (OpenLineage's `columnLineage` facet, Marquez's column graph) therefore stores the where-provenance DAG and treats transformation expressions as opaque annotations: a pragmatic truncation of the full semiring.

---

### 4.3 Taint tracking in Apache Spark: dynamic record-level provenance

Static analysis answers "which columns *could* flow"; dynamic taint tracking answers "which records *did* flow." The canonical design in the Spark lineage is **Titian** [1]: a library that extends the RDD abstraction with a `LineageRDD`, enabling interactive backward and forward tracing at record granularity with capture overhead below 30%.

#### 4.3.1 Taint as dynamic provenance

Taint tracking is dynamic information-flow analysis repurposed for data: **sources** (input records tagged with unique taint marks), **propagation** (`map` copies marks one-to-one; `filter` drops marks of eliminated records; `join` unions partner marks; `reduceByKey` unions marks across the group), and **sinks** (at an action, an output record's mark set is its *where*-provenance).

Formally, let *τ(r)* be the taint set of record *r*. For a transformation *f: RDD[A] → RDD[B]* with derivation relation *D ⊆ A × B*:

> **Theorem (Taint Soundness for Spark Transformations):** *If taint propagation for f is τ(b) = ⋃{τ(a) : (a,b) ∈ D}, then τ(b) equals the true where-provenance of b through f. By induction over the stage DAG, end-to-end taint sets equal true record-level where-provenance for any composition of narrow and wide transformations.*

The subtlety is *D*: for narrow transformations it is observable per record; for wide transformations (shuffles) the derivation relation spans partitions, so marks must be *shipped with the data* through the shuffle — the dominant cost driver.

#### 4.3.2 The LineageRDD design and its cost model

Titian's architecture [1] instruments at the RDD layer:

```rust
// Taint-carrying records through a shuffle: marks travel with data;
// the reducer unions mark sets per key group:
//   tau(out) = UNION { tau(in) : in.group_key == out.key }
struct TaintedRecord<K, V> {
    key: K,
    value: V,
    provenance: RoaringBitmap,
}

Key engineering decisions keeping overhead under 30% [1]:

1. **Block-level identifiers**: consecutive records from the same input split share mark prefixes, compressed with bitmap structures.
2. **Lazy materialization**: taint sets expand only when a trace query arrives; capture stores compact per-partition sketches.
3. **Piggybacking on Spark's fault-tolerance lineage**: no separate bookkeeping of transformation order.
4. **Interactive tracing API**: `backwardTrace`/`forwardTrace` return `LineageRDD`s composable with further native Spark operations, enabling trial-and-error debugging on the traced subset.

![Taint tracking inside Apache Spark: RDD DAG with forward and backward trace arrows](/thesis/ths_1788719456272_afbd-2.webp)

#### 4.3.3 Taint tracking as abstract interpretation

Taint propagation is *abstract interpretation* over the powerset lattice of input-record identifiers: each Spark transformation's semantics is abstracted by its mark-propagation rule — *exact* for deterministic transformations (marks are identifiers), approximate only under non-determinism or deliberate coarsening (block-level marks). Like the provenance semirings of §4.2, it is a monotone dataflow analysis, differing only in *when* it runs and *what* the lattice elements denote.

```tla
---- MODULE SparkTaint ----
EXTENDS Naturals, FiniteSets
VARIABLES marks  \* marks[r] \in SUBSET(InputIds), the taint set of record r
Propagate(f, D) ==  \* f: transformation, D: derivation relation
    marks' = [b \in Outputs(f) |-> UNION {marks[a] : a \in {x \in Inputs(f) : <<x,b>> \in D}}]
Soundness == \A b \in Outputs : marks[b] = TrueWhereProvenance(b)
====
```

---

### 4.4 Marquez: materializing the event stream into a queryable graph

If OpenLineage is the *protocol* and SQL parsing the *refinement*, **Marquez** [4] is the *system of record*: the LF AI & Data reference implementation of the OpenLineage API. Its architecture: (1) **ingestion** — a REST API validating events and appending them immutably (a run's `COMPLETE` never rewrites its `START`); (2) **graph construction** — datasets, jobs, runs as nodes, I/O relations as edges, facets as properties, with `columnLineage` edges stored first-class between column nodes; (3) **versioning** — datasets versioned per run, so lineage is a time-indexed family of graphs supporting *as-of* queries; (4) **serving** — bounded-depth traversal, blast-radius queries, and column drill-down.

The critical scaling insight is *separation of capture from query*: emitters (Spark, Airflow, dbt listeners) do O(1) work per event — serialize and POST — while graph assembly, deduplication, and indexing happen server-side, asynchronously. The marginal cost on the data plane is a few kilobytes of JSON per run; the metadata plane scales independently [3][4].

Marquez also illustrates the stack's *trust model*: it stores what emitters claim. The mitigations are the other two layers — parse emitted SQL to verify column edges, and sample taint traces to audit runtime claims.

---

## 5 Empirical Evaluation / Proofs

### 5.1 Capture overhead: the numbers that matter

| System / Layer | Workload | Overhead | Source |
|---|---|---|---|
| Titian (dynamic taint) | TPC-H–style Spark jobs | <30% job time, mostly <15% | [1] |
| OpenLineage Spark listener | production Spark | ~1–3% (event serialization only) | [3] |
| sqllineage (static parse) | 480-statement batch | ~1.8× vs sequential (parallel batch) | [7] |
| Marquez ingestion | event stream | decoupled; O(event) append | [4] |

The gap between dynamic taint tracking (<30%) and static/event approaches (~1%) is the cost of *record-level truth*: marks travel with data through shuffles. Titian's achievement [1] is bounding this — prior Hadoop-era systems (RAMP, Newt) scaled far worse — via bitmap-compressed mark sets and lazy trace materialization.

### 5.2 Proof sketch: end-to-end soundness of the composed stack

> **Theorem (Composed Lineage Soundness):** *For a pipeline emitting OpenLineage events with SQL facets, column edges refined by the §4.2 parser, and critical jobs audited by §4.3 taint tracking: (a) every dataset-level edge corresponds to a real read/write (emitter trust); (b) every column edge is functionally exact on the supported SQL fragment (parser soundness); (c) for audited records, taint provenance equals true where-provenance. The composed graph is thus sound at all three granularities modulo the stated assumptions.*

*Proof sketch.* (a) follows from event reconstructibility (§4.1) under emitter trust. (b) is parser soundness (§4.2.2) on the emitted SQL text — which *removes* the emitter-trust assumption for column edges. (c) is taint soundness by induction over the stage DAG (§4.3.1). The granularities nest — record → column → dataset — giving a consistent multi-resolution graph. ∎

### 5.3 Query complexity

- **Upstream/downstream traversal to depth d**: *O(b^d)* worst case (branching factor *b*), *O(V_d + E_d)* with visited-set BFS — interactive for *d ≤ 6* on billion-edge graphs with adjacency indexing.
- **Blast radius** (all downstream of a corrupted column): reverse reachability, linear in the affected subgraph.
- **Column drill-down**: constant-time edge lookup per column node — the payoff of storing column edges first-class rather than recomputing them from SQL at query time.

---

## 6 Limitations

1. **The emitter-trust problem.** OpenLineage/Marquez record claims, not ground truth. A job reading via an undeclared side channel (a UDF hitting an external API) is invisible. Static SQL parsing mitigates this for SQL jobs; non-SQL jobs remain on the honor system [3].
2. **Dynamic SQL and procedural logic.** Stored procedures, templated SQL (Jinja in dbt/Airflow), and UDFs defeat static parsing. The failure is explicit (parse error), but the lineage gap is real — and these constructs concentrate where business logic is most complex.
3. **Taint tracking's granularity tax.** Sub-30% overhead [1] was measured on batch analytics; streaming micro-batches with millisecond latency budgets cannot afford per-record mark propagation, and approximate (block-level) marks trade precision for speed.
4. **Cross-engine identity.** Fusing fragments requires consistent dataset naming across engines (`postgres://db.schema.table` vs. `s3://bucket/path` vs. Hive URIs for the same bytes). Namespace conventions are social, not technical, and mismatches silently fork the graph.
5. **Temporal semantics.** Marquez versions datasets per run, but *bi-temporal* lineage (valid-time vs. transaction-time, à la slowly changing dimensions) is largely unmodeled; backfills that rewrite history create lineage paradoxes handled only by convention.
6. **Privacy of the lineage graph itself.** Fine-grained provenance is a side channel: column edges reveal which PII fields feed which models, and record-level taint sets can leak individual-level information. The lineage store needs access controls as strong as the data store [6].

---

## 7 Conclusion

We have presented a unified account of data lineage at exabyte scale across three layers — OpenLineage/Marquez event materialization, static SQL parsing for column edges, and dynamic taint tracking for record provenance in Spark — as instances of one formalism: monotone dataflow analysis over provenance-annotated graphs.

Three conclusions follow. **First, standardization beats instrumentation**: the collection protocol (OpenLineage) converts *N×M* integration pain into *N+M* and makes every refinement composable [2][3]. **Second, static analysis is the price-performance sweet spot**: SQL parsing delivers governance-grade column lineage at ~1% of dynamic tracking's cost, with provable soundness on the dominant SQL fragment [7]. **Third, dynamic taint tracking is the audit layer, not the capture layer**: its <30% overhead [1] is justified selectively — on PII- or correctness-critical jobs — as ground-truth verification of the cheaper layers.

The open problems are now clear: closing the emitter-trust gap for non-SQL engines, bi-temporal lineage semantics, cross-engine entity resolution, and privacy-preserving provenance. The exabyte era does not need *more* lineage metadata; it needs lineage metadata it can *trust*, at the granularity decisions require, with proofs rather than promises.

---

## References

[1] Matteo Interlandi, Kshitij Shah, Sai Deep Tetali, Muhammad Ali Gulzar, Seunghyun Yoo, Miryung Kim, Todd Millstein, Tyson Condie. *Titian: Data Provenance Support in Spark.* Proceedings of the VLDB Endowment, 9(3):216–227, 2015. https://doi.org/10.14778/2850583.2850595

[2] Joseph M. Hellerstein, Vikram Sreekanti, Joseph E. Gonzalez, James Dalton, Akon Dey et al. *Ground: A Data Context Service.* CIDR 2017. https://github.com/ground-context/ground/raw/498fb1cb31d7e1ac01cb140d9104f58057e21d37/docs/CIDR17.pdf

[3] OpenLineage Project. *OpenLineage Specification: an open standard for lineage metadata collection.* Linux Foundation. https://github.com/OpenLineage/OpenLineage/blob/main/spec/OpenLineage.md

[4] Marquez Project. *Marquez: an open source metadata service for data lineage — the reference implementation of the OpenLineage API.* LF AI & Data. https://marquezproject.ai/

[5] Yogesh L. Simmhan, Beth Plale, Dennis Gannon. *A Survey on Data Provenance in e-Science.* ACM SIGMOD Record, 34(3):53–63, 2005. https://doi.org/10.1145/1084805.1084812

[6] Jianwu Wang, Daniel Crawl, Ilkay Altintas et al. *Big Data Provenance: Challenges, State of the Art and Opportunities.* IEEE International Conference on Big Data, 2015. https://pmc.ncbi.nlm.nih.gov/articles/PMC5796788/

[7] reata et al. *SQLLineage: SQL Lineage Analysis Tool powered by Python — column-level lineage via SQL parsing.* https://github.com/reata/sqllineage
