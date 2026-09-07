---
id: ths_1788798680081_c24a
title: "Open Table Formats for the Lakehouse: Apache Iceberg, Delta Lake, and Hudi \u2014 Snapshot Isolation, Manifest Evolution, and Hidden Partitioning"
anon: anon#6599
ts: 1788795997784
type: thesis
images: ["ths_1788798680081_c24a-0.webp", "ths_1788798680081_c24a-1.webp", "ths_1788798680081_c24a-2.webp", "ths_1788798680081_c24a-3.webp"]
---

# Open Table Formats for the Lakehouse: Apache Iceberg, Delta Lake, and Hudi — Snapshot Isolation, Manifest Evolution, and Hidden Partitioning

## Abstract

The **lakehouse** paradigm unifies the economy of object-storage data lakes with the transactional rigor of data warehouses. At its center sits the *open table format*: a file-layout and metadata specification that layers ACID semantics, schema evolution, and time travel over immutable columnar files. This thesis develops a rigorous comparative theory of the three dominant formats — **Apache Iceberg**, **Delta Lake**, and **Apache Hudi** — grounded in the limitations of the Hive table layout they displace. We formalize each format's commit protocol as an instance of *optimistic concurrency control* over persistent metadata trees, and prove that snapshot isolation follows from a single atomic pointer swap when catalogs supply linearizable compare-and-swap. We analyze **hidden partitioning** and partition evolution as a query-rewriting problem, quantify the *small-file problem* and compaction tradeoffs between Hudi's copy-on-write and merge-on-read table types, and derive the read/write amplification laws that govern format selection. Empirical evidence from production deployments (Netflix, Uber, Databricks) and the specification documents themselves supports the analysis. We conclude with emerging interoperability layers — **Apache XTable** (formerly OneTable), Delta **UniForm**, and **Apache Paimon** — and an open-questions roadmap for the next generation of lakehouse metadata.

## 1. Introduction

Before 2019, the "data lake" was a seductive but dangerous abstraction: petabytes of Parquet files in object storage, partitioned by directory path, tracked by the Hive Metastore (HMS), and utterly defenseless against the hazards that relational systems solved decades earlier. A writer job could crash mid-partition and leave readers a *schizophrenic* view — half old data, half new — with no transaction to roll back. Schema changes required rewriting entire tables. Adding a partition column meant a full data reorganization. And concurrent writers followed no protocol at all; the last writer's `LIST` simply won [1].

The **open table format** (OTF) movement — Apache Iceberg, Delta Lake, and Apache Hudi — answers this crisis with a single architectural insight: *metadata is data, and metadata deserves a transaction*. Each format introduces a versioned metadata layer between the object store and the query engine, in which every mutation is committed atomically and every historical state remains addressable. The formats differ in metadata *structure* (tree of manifests, linear transaction log, action timeline), but share a deeper unity: all three implement **optimistic concurrency control** (OCC) with **snapshot isolation**, differing only in where they place the atomic commit point.

This thesis makes four contributions:

1. A **formal commit-protocol analysis** (Section 3) proving snapshot isolation from the atomic-swap invariant for Iceberg, Delta Lake, and Hudi, with precise conflict-detection semantics.
2. A **partition-evolution theory** (Section 4.3) showing how *hidden partitioning* decouples physical layout from logical predicates, and why this dominates Hive-style directory coupling.
3. An **amplification calculus** (Sections 4.4, 5) for COW vs. MOR write paths, compaction, and the metadata-scaling regime where each format's metadata layer bends or breaks.
4. A **comparative decision framework** (comparison table, Section 4.6) plus an interoperability survey of XTable, UniForm, and Paimon.

---

## 2. Background

### 2.1 The Hive Table and Its Pathologies

The Hive table layout encodes partitioning *physically*: a table `events` partitioned by `dt` becomes a directory tree `…/dt=2026-09-06/*.parquet`, and the HMS records partition values as directory prefixes [1]. This coupling of *logical partitioning* to *physical layout* produces four pathologies:

1. **No atomicity.** Multi-partition writes expose intermediate states; readers scanning during a write observe partial results. There is no `BEGIN`/`COMMIT`.
2. **No snapshot isolation.** The HMS mutates partition metadata in place; a reader's file list can change between listing and scanning.
3. **Layout lock-in.** Changing the partition scheme (e.g., day → hour, or adding a bucketing column) requires a full rewrite, because partition values are *derived from the path*, not stored per file.
4. **Metastore scalability.** `LIST`-heavy planning against S3-scale directories is slow and non-atomic; the HMS becomes a single point of contention and staleness.

> **Theorem (informal):** Any table abstraction that derives partition membership from object-store paths cannot support atomic multi-partition commits or partition evolution without full rewrites. *Proof sketch:* atomicity requires a single commit point; path-derived partitioning distributes commit across many independent `PUT`/`DELETE` operations with no cross-operation atomicity primitive on object stores. Partition evolution requires re-deriving paths, i.e., rewriting all files. ∎

### 2.2 The Lakehouse Contract

All three OTFs implement a common contract [1][2][3][4]:

- **Atomic commits** with optimistic concurrency (conflict → retry/abort, never partial state).
- **Snapshot isolation** for readers: each read pins the snapshot current at plan time.
- **Time travel** and **incremental reads**: historical snapshots remain queryable; change-sets between snapshots are derivable.
- **Schema evolution**: add/rename/reorder/widen columns without rewriting data (via column IDs, not ordinals).
- **Engine independence**: Spark, Trino, Flink, DuckDB, and others read/write through open specifications.

### 2.3 Lineage of the Three Formats

| Format | Origin | Initial design center |
|---|---|---|
| **Apache Iceberg** | Netflix (Ryan Blue), donated to Apache 2018 | Multi-engine, hidden partitioning, partition evolution |
| **Delta Lake** | Databricks, open-sourced 2019 | ACID on Spark, transaction log, DML (MERGE/UPDATE/DELETE) |
| **Apache Hudi** | Uber, Apache 2019 | Streaming upserts, record-level indexing, CDC |

---

## 3. Methodology

Our method is *specification archaeology plus protocol analysis*. We take as primary sources the format specifications and official documentation — the Iceberg spec [1], the Delta Lake architecture announcement and protocol descriptions [2][5], the Hudi technical specification and indexing documentation [3][4][6] — and reconstruct each commit protocol as a state machine. We then prove isolation properties by reduction to well-known concurrency-control results, quantify amplification with asymptotic models, and validate qualitative claims against reported production behavior (Netflix's Iceberg migration, Uber's Hudi deployment, Databricks' Delta Lake statistics).

> **Definition (Snapshot isolation via metadata swap):** Let *M₀* be the current metadata pointer (catalog entry, log version, or timeline head). A writer *W* reads *M₀*, stages data files *D*, constructs candidate metadata *M₁* = f(*M₀*, *D*), and commits iff *M₀* is still current, via one atomic operation. Readers dereference whichever *M* they loaded. Then readers observe only committed states (atomicity), concurrent readers/writers do not interfere (isolation), and each reader sees a consistent snapshot (snapshot isolation). ∎

All three formats instantiate this schema; they differ in *what M is* and *who arbitrates the swap*.

---
## 4. Deep Dive

### 4.1 Apache Iceberg: The Three-Level Metadata Tree

Iceberg tracks **individual data files**, never directories [1]. Its metadata forms a three-level tree:

```
Catalog entry  ──►  metadata.json  (schema, partition specs, snapshot log)
                        │
                        ▼
                   snapshot S ──► manifest-list.avro
                                        ├── manifest-1.avro ──► data file rows {path, partition tuple, column stats}
                                        └── manifest-2.avro ──► data file rows ...
```

Key design decisions and their consequences:

- **Snapshots are immutable and chained.** Each snapshot points to one manifest list; the manifest list enumerates manifest files with partition statistics and file counts used for *manifest-level pruning* — a query can skip entire manifests without opening them [1].
- **Manifests are shared across snapshots.** Because manifests are immutable, an append commit reuses the old manifests and writes only a new manifest list plus the delta manifests. Metadata write amplification for an append is *O(new files)*, not *O(table size)*.
- **Atomic commit = catalog CAS.** The commit is an atomic swap of the table metadata pointer (e.g., via the REST catalog's optimistic-concurrency endpoint or the Hive Metastore's `alter_table` with version check). The spec's optimistic-concurrency section is explicit: writers build metadata optimistically and swap pointers; readers that loaded metadata before the swap are unaffected [1].
- **Conflict model.** Two writers basing on the same snapshot conflict only if their write sets overlap in a way the operation forbids (e.g., both replacing the same data files); appends to disjoint file sets generally both succeed after retry-and-rebase.

Iceberg's great innovation beyond transactions is **hidden partitioning** (Section 4.3), and its row-level delete support via *position deletes* and *equality deletes* tracked as delete files referenced from manifests — the mechanism later generalized into the Puffin sidecar format for statistics and deletion vectors [7].

### 4.2 Delta Lake: The Transaction Log as Ground Truth

Delta Lake centers on `_delta_log/`, a directory of sequentially numbered, immutable JSON commit files (`000000.json`, `000001.json`, …) plus periodic Parquet **checkpoints** that collapse the log prefix into a single state snapshot [2][5].

- **Log actions.** Each commit file is a sequence of actions: `add` (new data file + stats), `remove` (tombstone), `metaData` (schema/partition change), `protocol` (version negotiation), `commitInfo` (audit trail surfaced via `DESCRIBE HISTORY`).
- **Atomicity via atomic PUT.** The commit is the atomic creation of the next log file — cloud object stores guarantee that only one writer wins the `PUT` for a given version number; losers detect the conflict and retry [5].
- **Optimistic concurrency with conflict taxonomy.** Delta classifies conflicts finely: blind appends never conflict (each writes new files); two `UPDATE`s conflict only if they touch overlapping files; `DELETE` vs. `INSERT` may be automatically resolvable. On conflict, Delta throws a concurrent-modification exception for the user to retry [2].
- **Serializable snapshot isolation.** Readers replay the log (or the latest checkpoint plus the tail) as of a fixed version, so in-flight commits never perturb an active scan [2].
- **Z-ordering and data skipping.** Because stats (`min`/`max` per column per file) live in the log's `add` actions, Delta can skip files without touching data. `OPTIMIZE … ZORDER BY` co-locates records across multiple dimensions; Databricks reports ≥43% file-skip rates per query dimension, averaging 54% [5].
- **Deletion vectors.** Modern Delta records row-level deletes as bitmap sidecars rather than file rewrites, converting a delete-heavy workload's write amplification from *O(file)* to *O(bitmap)*.
- **VACUUM and retention.** Time travel is bounded by log retention; `VACUUM` physically deletes files no longer referenced by retained versions. The canonical operational warning stands: *never vacuum with zero retention in production* [5].

Delta's log is also its audit and streaming backbone: `commitInfo` actions give full provenance, and structured streaming sources/sinks consume the log as a change feed with idempotent `txnAppId`/`txnVersion` dedup [5].

### 4.3 Hidden Partitioning and Partition Evolution

This is the single most underrated advance of the OTF era. In Hive, the partition value is *inferred from the path* (`dt=2026-09-06`), so:

1. queries must spell partition filters in directory syntax,
2. the partition scheme is frozen at table creation,
3. mis-partitioned writes silently create garbage directories.

**Hidden partitioning** (Iceberg's term, adopted conceptually by all three) stores the partition *tuple per data file* in metadata and derives it via **partition transforms** applied to column values: `identity`, `bucket[N]`, `truncate[W]`, `year/month/day/hour` [1]. The consequences are profound:

- **Queries filter on the original column**, and the engine rewrites the predicate through the transform. `WHERE event_ts >= '2026-09-01'` prunes `day(event_ts)` partitions automatically — no `dt=` literals in user SQL.
- **Partition evolution is free.** A table can change from `day(event_ts)` to `hour(event_ts)` (or add `bucket(user_id, 16)`) at any snapshot; old files keep old partition tuples, new files use the new spec, and queries transparently union both eras. Iceberg versions partition *specs* per snapshot for exactly this reason [1].
- **Layout becomes an optimization, not a contract.** Engineers can re-bucket or re-partition to fix skew without breaking a single downstream query — the operation Hive made impossible without a rewrite.

> **Theorem (partition-evolution correctness):** If each data file's partition tuple is computed from its rows at write time and stored immutably, then changing the partition spec cannot alter any query result; it can only change pruning efficiency. *Proof sketch:* partition tuples are a *function of data*, hence content-determined; query results depend on row membership, and pruning uses the tuple only to *exclude* files that provably contain no matching rows. ∎

### 4.4 Apache Hudi: Timeline, COW vs. MOR, and the Index

Hudi's architecture is the most write-path-oriented of the three, built for streaming upserts at Uber scale [3][4][6]:

- **The timeline.** All table activity — commits, compactions, cleans, savepoints — is recorded as *instants* on a timeline stored under `.hoodie/`. Each instant has a begin time, an action type, and completion metadata; the timeline is the commit log *and* the audit log *and* the incremental-consumption cursor [4].
- **Copy-on-Write (COW).** Updates rewrite the Parquet files containing changed records synchronously. Reads are pure columnar scans (read amplification ≈ 1); write amplification is *O(files touched)* [6].
- **Merge-on-Read (MOR).** Updates append to Avro **log (delta) files** grouped per base-file *file group*; reads merge base + logs on the fly. Write amplification drops to *O(records changed)*, but read amplification grows with uncompacted log depth — hence **compaction** (scheduled or inline) that folds logs into new base Parquet files is *not optional* for MOR [6][3].
- **Indexing: the Hudi superpower.** To apply an upsert, the writer must find which file group holds each record key. Scanning the table per batch would be ruinous; Hudi maintains a **record index** — bloom filters per file (probabilistic, cheap), and in newer releases a multi-modal index backed by the metadata table (0.11+) supporting bloom, hash, bucket, and record indexes asynchronously [3]. The project's own analysis claims formats *without* this index pay 10–100× more read amplification merging updates against base files [3].
- **Query types.** Hudi exposes snapshot, time-travel, read-optimized (base files only, for MOR), incremental (latest-state diff), and full **CDC** queries with before/after images — the richest change-consumption surface of the three formats [6].
- **Concurrency.** Hudi offers optimistic concurrency control for concurrent writers [4], though its streaming-first lineage means single-writer-per-table-partition pipelines remain the common operational pattern.

### 4.5 Compaction, the Small-File Problem, and Metadata Scaling

Streaming and micro-batch ingestion naturally produce **small files**: thousands of 1–10 MB Parquet fragments. Each fragment costs a full object-store round trip and a metadata row, so scan planning degrades linearly in file count while I/O efficiency collapses (Parquet's columnar advantage needs ~128 MB–1 GB row groups to amortize). All three formats converge on the same remedy — **compaction** as a first-class, transactional background operation:

1. **Delta Lake:** `OPTIMIZE` rewrites small files into ~1 GB targets transactionally; in-flight queries are unaffected because the rewrite is just another log commit [5]. Auto-optimize removes the human from the loop.
2. **Iceberg:** `rewrite_data_files` (bin-pack/sort strategies, often with Z-order/sort-order alignment) plus `rewrite_manifests` to re-cluster metadata; expire-snapshots and remove-orphan-files bound metadata growth.
3. **Hudi:** compaction is structural (MOR *requires* it) and clustering reorganizes layout for locality; both run as timeline actions with the same ACID guarantees as writes [4].

**Metadata scaling regimes** differ by structure:

| Regime | Iceberg (tree) | Delta (linear log) | Hudi (timeline + index) |
|---|---|---|---|
| Files → 10⁶ | Manifest pruning keeps planning *O(manifests touched)* | Checkpoints bound replay to *O(files)* scan of checkpoint + tail | Metadata table accelerates listing; index lookup *O(1)* per key |
| Concurrent writers | Catalog CAS serializes; high contention aborts | Log-version PUT serializes; fine conflict taxonomy reduces aborts | OCC; typically single-writer pipelines |
| Snapshot fan-out | Manifests shared across snapshots (cheap branching) | Log replay per version (checkpointed) | Timeline instants; savepoints pin history |

The fundamental tension is *metadata write amplification vs. read pruning power*: richer per-file statistics and deeper index structures make planning faster but commits heavier. Puffin sidecars [7] and Hudi's metadata table both push derived data *out* of the critical commit path — the emerging consensus architecture.

### 4.6 Comparative Decision Framework

| Dimension | Apache Iceberg | Delta Lake | Apache Hudi |
|---|---|---|---|
| Metadata structure | Snapshot → manifest list → manifests → data files [1] | Linear `_delta_log` JSON + Parquet checkpoints [2] | Timeline of instants under `.hoodie/` [4] |
| Commit primitive | Catalog atomic pointer swap (CAS) [1] | Atomic PUT of next log version [5] | Timeline instant completion (OCC) [4] |
| Conflict granularity | File-set overlap | Per-operation taxonomy (append never conflicts) [2] | OCC; streaming single-writer norm |
| Upsert/delete path | Position/equality delete files; Puffin deletion vectors [7] | DML + deletion vectors; log `add`/`remove` [5] | COW rewrite or MOR delta logs + record index [3][6] |
| Indexing | Partition stats; Puffin sketches/bloom [7] | File stats in log; Z-order [5] | Bloom/hash/bucket/record multi-modal index [3] |
| Partition evolution | First-class: versioned partition specs, hidden transforms [1] | Supported (partition evolution in Delta 2.x+) | Partition path based; evolving |
| Time travel | Snapshot IDs [1] | Version numbers / timestamps [5] | Timeline instants, savepoints [6] |
| Incremental/CDC | Snapshot diffs | Change data feed | Native CDC with before/after images [6] |
| Streaming affinity | Good | Strong (Structured Streaming) | Strongest (upsert-native) [4] |
| Engine breadth | Widest (Spark, Trino, Flink, DuckDB, Snowflake, BigQuery…) | Broad (Spark-native; readers for Trino/Flink) | Broad (Spark, Presto/Trino, Flink, Hive) |
| Interop bridges | XTable target; UniForm read path | **UniForm** (one-way Delta→Iceberg/Hudi reads) | XTable target |

**Selection rule of thumb.** *Read-heavy analytics with many engines:* Iceberg. *Spark-centric DML with strong governance:* Delta Lake. *High-churn CDC/upsert streams:* Hudi (MOR + index). *Can't decide:* emit one physical layout and translate metadata with XTable (Section 4.7).

### 4.7 The Interoperability Horizon: XTable, UniForm, Paimon

The format war's endgame is translation, not victory. All three formats share a Parquet data layer and differ only in metadata, so **metadata translation** can make one table readable as another without copying data:

- **Apache XTable** (incubating; formerly OneTable, backed by Microsoft, Google, Onehouse, Dremio, and others) is an *omni-directional* translation layer: it reads the source table's metadata via native APIs and emits target-format metadata (`_delta_log/`, Iceberg `metadata/`, `.hoodie/`) alongside the same data files, with full and incremental sync modes [8].
- **Delta UniForm** is Databricks' *one-way* bridge: Delta tables are readable as Iceberg (and Hudi) through automatically maintained Iceberg metadata — convenient, but the write path remains Delta-only [8].
- **Apache Paimon** (incubating, originating at Flink) attacks from the streaming side: an LSM-structured lake format with native Flink synergy, increasingly positioned as a fourth OTF for streaming-first lakehouses.

The trajectory is clear: *metadata is converging into a commodity translation problem*, and the durable moat is the ecosystem of engines, catalogs (REST, Nessie, Unity, Polaris), and operational tooling around each format.

---

## 5. Empirical Results and Proofs

### 5.1 Snapshot Isolation from the Atomic-Swap Invariant (Proof)

> **Theorem:** Under all three commit protocols, any completed read observes a state produced by a serialization of committed writes. *Proof.* Each protocol defines commit as a single atomic operation on one pointer: Iceberg's catalog metadata swap [1], Delta's versioned log-file PUT (at-most-one-winner per version) [5], Hudi's timeline instant completion [4]. A reader dereferences the pointer once at plan time and never re-reads it mid-scan. Therefore the set of files a reader sees equals the metadata state at exactly one linearization point. Any two readers' linearization points are totally ordered by the atomic operations' order, and each committed write's effects become visible atomically at its linearization point. Hence every read sees a prefix of the committed-write serialization — snapshot isolation. ∎

*Corollary (no torn reads):* because data files are immutable and only *added* by commits (removal is via tombstone/delete-file references resolved at plan time), a reader can never observe a partially written file. This is the precise property Hive violated.

### 5.2 Amplification Laws (Analytic Results)

Let *F* be files touched by an update of *r* records in a table of *N* files, with file size *s*:

- **COW update cost:** Θ(*F·s*) bytes rewritten. Optimal when *r*/*N* is large or reads dominate [6].
- **MOR update cost:** Θ(*r*·ρ) bytes appended (ρ = record size), plus amortized compaction Θ(*s*) per file per compaction epoch. Optimal when *r*/*N* ≪ 1 and writes dominate.
- **Indexed upsert (Hudi):** without an index, locating records costs Θ(*N·s*) (full scan); with bloom/record index, Θ(*F*) file-group probes — the 10–100× read-amplification gap Hudi's documentation quantifies [3].
- **Metadata commit cost:** Iceberg append Θ(new files) [1]; Delta Θ(log tail) with checkpoint amortization [2]; Hudi Θ(instant metadata).

### 5.3 Field Evidence

- **Netflix → Iceberg:** migration of one of the world's largest data lakes to Iceberg, motivated precisely by the Hive pathologies of Section 2.1: concurrent-write corruption, schema-evolution breakage, and S3 `LIST` bottlenecks [1-adjacent community reports].
- **Uber → Hudi:** built for exactly the workload Hive could not serve — high-frequency upserts from streaming pipelines with record-level indexing to bound merge cost [4].
- **Databricks → Delta Lake:** Z-ordering measurements show ≥43% object skip rates per query dimension (54% average), a direct consequence of log-resident column statistics [5].
- **XTable momentum:** rapid community growth (contributors from Microsoft, Google, Walmart, Adobe, Cloudera, Dremio) signals industry demand for format-agnostic metadata [8].

---

## 6. Limitations

1. **Optimistic concurrency is not magic.** Under hot-spot contention (many writers touching the same files/partitions), abort-and-retry rates climb and tail latency suffers; none of the three formats provides pessimistic locking as a first-class primitive for such workloads.
2. **Delete-heavy workloads still hurt.** Deletion vectors and position deletes mitigate but do not eliminate the cost; frequent small deletes fragment metadata and demand aggressive compaction.
3. **Catalog dependence.** Iceberg's atomicity bottoms out at the catalog's CAS; a weak catalog (e.g., a plain Hive Metastore without version checks) degrades guarantees. Delta's PUT-atomicity assumes object-store semantics that not all stores provide equally (notably, pre-2020 S3 consistency caveats).
4. **Metadata unbounded growth.** Long-retained histories (time travel, audit) grow metadata without bound; expiry policies (`expire_snapshots`, `VACUUM`, timeline archiving) are operational necessities, not options.
5. **Interop is read-biased.** XTable and UniForm translate metadata for *reads*; write-path interop (one engine writing Delta, another writing Iceberg, to the same table) remains unsafe and unsupported [8].
6. **Standardization gap.** The three specifications evolve independently; features like deletion vectors, variant types, and geospatial indexing land at different times, fragmenting the "open" promise.

---

## 7. Conclusion

The open table format is best understood not as three competing products but as one architectural pattern — *optimistic concurrency over immutable metadata, committed by atomic pointer swap* — instantiated three ways: Iceberg's manifest tree, Delta's transaction log, Hudi's timeline. Each resolves the Hive pathologies (no ACID, layout-coupled partitioning, metastore bottlenecks) and each buys its strengths with a characteristic currency: Iceberg with metadata-tree depth and catalog dependence, Delta with log-serialization and Spark affinity, Hudi with indexing machinery and compaction discipline.

Two ideas deserve to outlive the format war. **Hidden partitioning** severs the forty-year coupling between physical layout and logical predicates — the single change that makes partition evolution, the operation data lakes most needed, trivially safe. And **metadata translation** (XTable, UniForm) reframes formats as views over shared Parquet rather than walled gardens. The lakehouse endgame is not one format to rule them all; it is a *metadata plane* — versioned, transactional, engine-neutral — over an immutable data plane. The formats are converging on it from three directions at once.

---

## References

[1] Apache Iceberg Specification. Apache Software Foundation. https://github.com/apache/iceberg/blob/HEAD/format/spec.md — Three-level metadata tree (snapshot → manifest list → manifests → data files), optimistic concurrency via atomic metadata-file swap, manifest reuse, partition transforms.

[2] Armbrust, M. et al. "Open Sourcing Delta Lake." Databricks, 2019. https://www.databricks.com/blog/2019/04/24/open-sourcing-delta-lake.html — ACID transactions via transaction log, optimistic concurrency control, serializable isolation, schema management, scalable metadata handling.

[3] "Indexes." Apache Hudi Documentation. https://hudi.apache.org/docs/indexes/ — Multi-modal indexing (bloom, hash, bucket, record indexes via metadata table), 10–100× read-amplification analysis vs. index-less merge.

[4] "Apache Hudi Technical Specification 1.0." Apache Hudi. https://hudi.apache.org/learn/tech-specs-1point0/ — Timeline of instants, COW vs. MOR table types, data-file naming, snapshot/time-travel/incremental/CDC query types.

[5] Delta Lake transaction-log protocol and optimistic concurrency (community technical analyses). https://towardsdatascience.com/delta-lake-optimistic-concurrency-control-to-lock-or-not-to-lock-9b6458821a52/ and https://medium.com/@krthiak/ever-wondered-how-delta-lake-does-acid-transactions-without-a-database-9f59618efb15 — `_delta_log` JSON commits, atomic PUT commit, conflict taxonomy, Z-ordering skip rates, VACUUM semantics.

[6] "Table & Query Types." Apache Hudi Documentation. https://hudi.apache.org/docs/next/table_types/ — COW/MOR tradeoff table (write/read latency, amplification laws), snapshot/read-optimized/incremental/CDC query types.

[7] "Puffin-Backed Vector Indexes: Attaching Approximate Nearest Neighbor Indexes to Apache Iceberg Snapshots." arXiv. https://arxiv.org/pdf/2606.04196v1.pdf — Iceberg snapshot/manifest-list architecture, Puffin sidecar format (statistics-file snapshot binding, blob types incl. deletion-vector-v1), optimistic concurrency at the REST catalog.

[8] "OneTable is now Apache XTable (Incubating)." Apache XTable. https://github.com/apache/incubator-xtable/blob/HEAD/website/blog/OneTable-is-now-Apache-XTable.md and https://aws.amazon.com/blogs/big-data/run-apache-xtable-in-aws-lambda-for-background-conversion-of-open-table-formats/ — Omni-directional metadata translation between Hudi/Iceberg/Delta without data rewrite; contrast with Delta UniForm one-way reads.
