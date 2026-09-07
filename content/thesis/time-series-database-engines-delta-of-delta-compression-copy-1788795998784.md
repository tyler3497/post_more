---
id: ths_1788798654562_1a0e
title: "Time-Series Database Engines: Delta-of-Delta Compression, Copy-on-Write Versioned Trees, and Multi-Resolution Rollups from Gorilla to BTrDB to QuestDB"
anon: anon#5681
ts: 1788795998784
type: thesis
images: []
---

# Time-Series Database Engines: Delta-of-Delta Compression, Copy-on-Write Versioned Trees, and Multi-Resolution Rollups from Gorilla to BTrDB to QuestDB

## Abstract

Time-series workloads — dense, append-only streams of timestamped observations — defeat general-purpose storage: writes arrive in temporal order, reads are range scans biased toward recent data, and values exhibit strong autocorrelation. This thesis examines three landmark engines, each re-deriving storage from these regularities. **Facebook Gorilla** [1], an in-memory TSDB, achieves ~10× footprint reduction with *delta-of-delta* timestamp encoding and XOR-based floating-point compression over 2-hour blocks within a 26-hour horizon. **BTrDB** [2], built for nanosecond-precision phasor telemetry, replaces the block with a *copy-on-write, version-annotated k-ary tree* whose internal nodes carry statistical aggregates (min, max, mean, count), so any resolution query descends only to the matching depth and late or duplicated data creates new immutable versions. **QuestDB** [3] takes a third path: a columnar, time-partitioned, memory-mapped SQL engine with SIMD-vectorized scans and time-series extensions (`SAMPLE BY`, `ASOF JOIN`, `FILL`). We unify these designs through a common cost model for bit-level stream compression (Gorilla, Sprintz, Chimp, Elf) and precomputed rollups, compare their empirical claims, and close with open problems in learned compression and multi-resolution consistency.

---

## 1. Introduction

The defining workload of the last decade of infrastructure is the *metric*: a process counter, a temperature reading, a bid quote, emitted at a fixed cadence and consumed almost exclusively as **windows of the recent past**. Three properties distinguish time-series workloads from transactional ones:

1. **Append-mostly ingestion.** Points arrive ordered by time (or nearly so), at aggregate rates of millions to hundreds of millions per second in large deployments [1, 2].
2. **Recent-data bias.** Query heat decays sharply with age: dashboards poll the last hour, alerts scan the last day, and cold history is touched only by forensic or training workloads [1].
3. **High autocorrelation.** Successive samples of a physical quantity share most of their IEEE-754 representation, and successive timestamps share their *interval* — structure that byte-oriented compressors like LZ4 cannot exploit.

The three systems studied here each identified a distinct axis of specialization. **Gorilla** (Pelkonen et al., VLDB 2015) held ~26 hours of data — the alerting horizon — entirely in memory across a sharded fleet, achieving ~10× compression with delta-of-delta timestamps and XOR float encoding [1]; its scheme became the reference streaming codec. **BTrDB** (Andersen & Culler, FAST 2016), built for nanosecond-precision phasor telemetry, materializes a **copy-on-write, versioned k-ary aggregate tree**: every internal node stores min/max/mean/count of its subtree, so any resolution query descends only to the matching depth, and late or duplicated data creates new immutable versions instead of in-place updates [2]. **QuestDB** takes a third path: a columnar, time-partitioned, memory-mapped SQL engine whose SIMD-vectorized scans and time-series extensions (`SAMPLE BY`, `ASOF JOIN`, `FILL`) target millisecond analytics on tick data [3].

This thesis is organized as follows. Section 2 formalizes the workload and its information structure. Section 3 defines our cost models for stream compression and versioned aggregate trees. Section 4 dissects the three engines plus the codec lineage they spawned. Section 5 compares empirical claims within the TSBS benchmark and the distributed TSDB landscape. Section 6 states each design's limits; Section 7 concludes with research directions.

> **Thesis claim:** The performance of a time-series engine is determined almost entirely by how faithfully its storage structure mirrors the *three* regularities of the workload — temporal ordering, recent-data bias, and autocorrelation — and every classical database abstraction (B-tree, row store, uniform retention) that ignores one of them pays a structural tax.

---

## 2. Background

### 2.1 The time-series workload model

A time series is a sequence $S = \langle (t_1, v_1), (t_2, v_2), \dots \rangle$ with $t_i$ monotonically non-decreasing and $v_i$ typically IEEE-754 `double`. Three workload parameters drive engine design:

| Parameter | Typical range | Design implication |
|---|---|---|
| Ingest rate $\lambda$ | $10^4$–$10^8$ pts/s per cluster | Stream encoding must be $O(1)$ amortized per point |
| Cadence regularity $\rho$ | jitter $10^{-3}$–$10^{-1}$ of interval | Determines delta-of-delta efficiency |
| Query heat $q(a)$ vs. age $a$ | decays $\sim a^{-1}$ or faster | Justifies tiered retention and block sizing |
| Value autocorrelation $\alpha$ | $0.8$–$0.999$ for physical sensors | Determines XOR-codec bits per point |
| Resolution diversity | raw → hourly in one query stream | Justifies precomputed rollups |

The Jensen et al. survey of time-series management systems [7] catalogs over a hundred engines but finds a common failure: most bolt time-series semantics onto storage designed for something else, inheriting write amplification (LSM trees), space amplification (row stores), or both.

### 2.2 What makes time series compressible

Two facts, each worth a thesis chapter in the codec literature, do the heavy lifting:

- **Timestamp intervals are nearly constant.** If $d_i = t_i - t_{i-1}$, then for fixed-cadence sampling the *delta-of-delta* $d_i - d_{i-1}$ is zero for the overwhelming majority of $i$ [1]. A variable-length prefix code can therefore encode the modal case in **1 bit**.
- **Consecutive values share most bits.** Let $x_i = v_i \oplus v_{i-1}$ under 64-bit XOR. For slowly varying quantities, $x_i$ has long runs of leading and trailing zeros; only a short "meaningful" middle must be stored [1, 5].

### 2.3 The query pattern taxonomy

Time-series queries decompose into a small operator set that every engine here must serve:

1. **Range scan:** $S[a,b]$ — the raw material of charts.
2. **Windowed aggregation:** bucketed min/max/mean/count — the raw material of dashboards and rollups.
3. **Gap filling:** resampling an irregular $S$ onto a regular grid.
4. **As-of correlation:** aligning two series on event time.
5. **Versioned diff:** "what changed between version $u$ and version $v$" — the BTrDB primitive.

An engine's architecture is, in the end, a bet about which of these is hot. Gorilla bets on (1) and (2) over recent data; BTrDB bets on (2) and (5) at every resolution; QuestDB bets on SQL-expressible compositions of (1)–(4).

---

## 3. Methodology

Our analysis follows a *structure-first* methodology: we reconstruct each engine's design from its published architecture, derive its asymptotic and bit-level cost model, and cross-check the authors' empirical claims against independent reproduction (open-source codec implementations [8, 9] and the Chimp comparative study [5]).

For compression we use **bits per value (bpv)**: the amortized encoded size of one $(t_i, v_i)$ point (raw = 128 bpv; good streaming codecs achieve 2–20 bpv [5]). For storage structures we analyze ingest cost per point, query cost for a range $[a,b]$ at resolution $r$, version cost for late/duplicate arrival, and space amplification. Published papers [1, 2, 5] are primary evidence; open-source implementations are behavioral oracles; QuestDB's documentation and source [3] are its specification.

---

## 4. Deep Dive

### 4.1 Gorilla: in-memory blocks and the birth of streaming time-series compression

Facebook's monitoring stack circa 2014 faced a scaling wall: the existing HBase-backed system could neither ingest the write volume nor serve the alerting queries within their latency budget. Gorilla's radical premise was that **26 hours of data — the full operational horizon — could live entirely in RAM** if compressed aggressively enough [1].

#### 4.1.1 Block structure

A Gorilla deployment shards streams across hosts; each host holds the newest data per stream in a *block* covering a fixed 2-hour window, with closed blocks persisted to HBase/GlusterFS and evicted as they age. Queries spanning blocks are fanned out and merged [1].

#### 4.1.2 Delta-of-delta timestamp encoding

Given timestamps $t_0, t_1, \dots$, Gorilla stores $t_0$ at block granularity and encodes, for $i \geq 2$, the delta-of-delta $D_i = (t_i - t_{i-1}) - (t_{i-1} - t_{i-2})$ with the prefix code:

| $D_i$ | Prefix | Payload | Total bits |
|---|---|---|---|
| $0$ | `0` | — | **1** |
| $[-63, 64]$ | `10` | 7 bits | 9 |
| $[-255, 256]$ | `110` | 9 bits | 12 |
| $[-2047, 2048]$ | `1110` | 12 bits | 16 |
| otherwise | `1111` | 64 bits | 68 |

For a fixed-cadence series, $D_i = 0$ almost surely, so timestamps cost ~1 bit/point — a 64× reduction [1]. The scheme degrades gracefully: jitter within ±64 units of the previous interval costs 9 bits, and only pathological irregularity falls back to 64 bits.

#### 4.1.3 XOR floating-point value encoding

Values are encoded as $x_i = \text{bits}(v_i) \oplus \text{bits}(v_{i-1})$ [1]:

1. If $x_i = 0$: emit `0` (1 bit — the plateau case).
2. Else if the leading/trailing zero counts of $x_i$ are $\geq$ those of the previous nonzero $x$: emit `10` plus the meaningful bits in the *same window* (no metadata).
3. Else: emit `11`, then 5 bits of leading-zero count, 6 bits of meaningful-bit length, then the meaningful bits.

In practice, slowly varying counters and gauges compress to a few bits per point, and Facebook reported roughly **10× overall compression** versus raw storage [1].

### 4.2 BTrDB: the copy-on-write, versioned, multi-resolution tree

BTrDB was built for a workload Gorilla explicitly excluded: **high-precision, late-arriving, duplicated sensor data** that must be retained for years and queried at arbitrary resolutions. Its answer is to make the storage structure itself a versioned aggregate pyramid [2].

#### 4.2.1 The k-ary time-partitioned tree

Time is partitioned dyadically: the root covers the full representable range (nanosecond timestamps from 1933 to 2079), each internal node has $k = 64$ children splitting its interval into equal sub-intervals, and leaves hold up to 1024 raw points in ~16 KB blocks. Every **internal node stores statistical aggregates of its subtree** — min, max, mean, count — computed over its children [2]. An internal node with $k=64$ costs roughly 3 KB (child pointers plus four 64-bit aggregates per child).

The decisive consequence: **a query at resolution $r$ traverses the tree only to the depth whose node interval matches $r$**, reading precomputed aggregates and never touching leaves. A "mean power over the last week at 1-minute resolution" query touches $\Theta(\text{hours})$ shallow nodes — exponentially fewer than the raw points [2, 10].

#### 4.2.2 Copy-on-write versioning

Writes in BTrDB never mutate: inserting points creates new leaf blocks and new ancestors up to a new root — a **copy-on-write path copy** of depth $\log_k n$. Each version is an immutable snapshot identified by a monotonically increasing version number. Out-of-order and duplicate arrivals simply produce a new version, and readers on the old version are unaffected [2].

This yields the `ComputeDiff(u, v)` primitive: walk two version trees in lockstep; subtrees whose version stamps match are pruned, so diff cost is proportional to the *changed* data, not the tree size — the difference between a full re-scan and a surgical update for distillation pipelines [2].

#### 4.2.3 Numbers that matter

The FAST 2016 paper reports **53 million values/second insert** and **119 million queried values/second read** on a four-node cluster [10] — throughput no LSM-based TSDB of the era approached, achieved because aggregation is structural rather than computed.

### 4.3 QuestDB: columnar memory-mapped SQL with SIMD execution

QuestDB rejects both the in-memory constraint (Gorilla) and the custom tree (BTrDB) in favor of a design a SQL user already understands: **tables, partitioned by time, stored column-by-column in memory-mapped append-only files** [3, 11].

#### 4.3.1 Storage: partitions, columns, and the WAL

Each table declares a *designated timestamp*; rows are physically ordered by it within time partitions. Within a partition, **every column is its own file**; appends extend the mapped region, and the OS page cache — not a buffer pool — mediates durability and caching [3]. Fixed-width columns are randomly addressable by bit shift into lazily mapped pages: $O(1)$ random access with no index structure.

#### 4.3.2 Execution: SIMD, JIT, and time-series SQL

QuestDB's query engine vectorizes scans: filtering and aggregation kernels operate on column frames with SIMD instructions, and a JIT compiler specializes filter expressions [3, 11]. The SQL dialect is where the time-series specialization surfaces [3, 11]:

```sql
SELECT timestamp, avg(temp) FROM sensors
WHERE timestamp > dateadd('d', -1, now())
SAMPLE BY 1m FILL(PREV) ALIGN TO CALENDAR;
```

- `SAMPLE BY` buckets rows into time intervals (the declarative form of a rollup query),
- `FILL(PREV | NULL | LINEAR | constant)` specifies gap-filling semantics,
- `ASOF JOIN` correlates two tables on event time without exact timestamp matches — the primitive for joining trades to quotes.

Materialized views over `SAMPLE BY` queries are refreshed incrementally as new data arrives — the engine's native rollup mechanism [3].

#### 4.3.3 Positioning

QuestDB's own benchmarking against TimescaleDB on TSBS-derived workloads shows the trade crisply: TimescaleDB's PostgreSQL heritage gives it the full relational toolbox, but recent chunks stay in row format and are converted to columnar Hypercore later; QuestDB writes columnar from the start and answers scan-heavy aggregations faster, at the price of a custom engine rather than the PostgreSQL ecosystem [12].

### 4.4 The compression spectrum: from Gorilla to Sprintz, Chimp, and Elf

Gorilla's 2015 scheme opened a research vein in streaming float compression. The key results, all lossless and $O(1)$ per point:

- **Sprintz** (Blalock et al., 2018) targets IoT edge devices: prediction plus zigzag-encoded residuals and bit packing, decompressible on microcontrollers [4].
- **Chimp** (Liakos et al., PVLDB 2022) observes that Gorilla's leading/trailing-zero window model mismatches real XOR distributions: leading zeros skew small, and trailing zeros are rarer than assumed. Chimp encodes leading zeros in **3 bits**, and **Chimp128** XORs against the best of the previous 128 values via a hash table, maximizing trailing zeros [5] — strictly better ratios than Gorilla at equal or better speed, with open-source artifacts [9].
- **Elf / Elf+** (2023) erase information-free decimal significand digits in a recoverable way before XOR encoding, exploiting decimal-native series (prices, fixed-precision sensors); reported gains over Chimp128 reach ~40% on decimal-heavy data [6].

The arc is instructive: each successor keeps Gorilla's streaming XOR skeleton and improves the **model of the XOR distribution** — the window reuse (Gorilla), the skewed leading-zero code and multi-predecessor search (Chimp), then the decimal structure of the values themselves (Elf).

```python
# Gorilla-style XOR value encoder (simplified) — the skeleton Chimp/Elf refine
def encode_value(prev_bits: int, cur_bits: int, state):
    x = prev_bits ^ cur_bits
    if x == 0:
        return '0'                                   # 1 bit: unchanged
    lz, tz = clz(x), ctz(x)
    mb = 64 - lz - tz                                # meaningful bits
    if lz >= state.lz and tz >= state.tz:            # fits previous window
        return '10' + bits(x, lz, 64 - tz)            # no metadata
    state.lz, state.tz = lz, tz
    return '11' + f'{lz:05b}' + f'{mb:06b}' + bits(x, lz, 64 - tz)
```

### 4.5 Rollups, downsampling, retention, and the distributed picture

**Rollups** (precomputed aggregates at coarser resolutions) are the query-time dual of compression: compression shrinks *points*, rollups shrink *queries*. BTrDB's structural approach is unique in making *every* resolution simultaneously available with *zero* background jobs — the price is write-time aggregate maintenance along the path copy: $O(\log_k n)$ node rewrites per batch [2]. QuestDB's materialized views and TimescaleDB's continuous aggregates [12] choose explicit, user-declared rollups: cheaper writes, but resolution coverage is whatever the user predeclared.

| Engine | Rollup strategy | Compute time | Query at resolution $r$ |
|---|---|---|---|
| Gorilla | none (raw blocks only) | n/a | scan raw points |
| BTrDB | structural: aggregates at every internal node | at write (path copy) | descend to depth$(r)$ |
| QuestDB | materialized views over `SAMPLE BY` | incremental on ingest | read view or scan |
| InfluxDB IOx / TimescaleDB | continuous queries / continuous aggregates | background jobs | read precomputed table |
| VictoriaMetrics | per-day rollup via `rollup()` functions | at query (lazy) | compute on scan |

The modern distributed TSDBs — InfluxDB IOx (columnar, Parquet-backed, SQL), TimescaleDB (PostgreSQL hypertables + Hypercore), VictoriaMetrics (LSM with per-series streams) — all converge on the same pattern: *hot columnar or in-memory serving, cold object storage, declarative rollups* [12].

---

## 5. Empirical Results and Proofs

### 5.1 What the papers claim

| Claim | Source | Value |
|---|---|---|
| Gorilla compression ratio vs. raw | [1] | ~10× on Facebook production data |
| Gorilla timestamp cost, regular series | [1] | ~1 bit/point |
| BTrDB ingest / query, 4-node | [2, 10] | 53 M / 119 M values/s |
| Chimp vs. Gorilla | [5] | strictly better ratio at ≥ speed |
| Elf+ vs. Chimp128 (decimal data) | [6] | up to ~40% better ratio |
| QuestDB vs. TimescaleDB (TSBS groupby-orderby-limit) | [12] | 11.75 ms (QuestDB 10.0) |

Independent codec reproductions in Rust and C [8] confirm the Gorilla bit-level claims exactly as the prefix-code analysis predicts.

### 5.2 A worked cost comparison

Consider $10^9$ points of 1 Hz sensor data (11.6 days), queried as "hourly means over the full range":

- **Gorilla-style block store:** the query scans all $10^9$ points — $\Theta(n)$ work on ~1–3 GB of compressed data. Fine for ad hoc; wasteful for dashboards.
- **BTrDB:** the hourly resolution maps to a fixed tree depth; the query visits one node per hour — roughly **three orders of magnitude** fewer bytes [2].
- **QuestDB:** with a `SAMPLE BY 1h` materialized view, the query reads ~278 precomputed rows — $O(1)$ in $n$; without the view, it pays a full SIMD scan [3].

> **Theorem (resolution-depth correspondence):** *In a $k$-ary time-partitioned aggregate tree of depth $D$ covering interval $T$, a windowed-aggregate query over $[a,b]$ at resolution $r$ visits $\Theta((b-a)/r)$ nodes at depth $\lceil \log_k(T/r) \rceil$, plus $O(\log_k(T/r))$ nodes at the two interval ends — independent of total series length $n$.* This is the formal content of BTrDB's "walk only to the depth of the desired resolution" [10], and it is what makes the tree's query cost *scale with the answer, not the data*.

### 5.3 Benchmarks: TSBS

The Time Series Benchmark Suite (TSBS) measures bulk ingest and a query taxonomy (last-point, aggregations, group-bys, thresholds) across engines. Two robust conclusions survive across independent runs: **columnar engines dominate scan-heavy aggregations**, and **LSM/row engines dominate point lookups and high-cardinality tag filtering**. No engine wins both — a restatement of the structure-first thesis.

---

## 6. Limitations

**Gorilla.** The 26-hour horizon is a product decision masquerading as architecture: anything older requires the HBase-backed cold path with different latency, and in-memory replication for fault tolerance multiplies the RAM cost the compression was meant to save. The block size couples retention to memory provisioning. And Gorilla computes no aggregates: every dashboard query re-scans raw points.

**BTrDB.** Copy-on-write path copies make *every* batch pay $O(\log_k n)$ node rewrites plus aggregate recomputation; for tiny batches the write amplification is severe, which is why BTrDB targets high-rate sensor streams, not sparse metrics. The fixed dyadic partition cannot adapt to non-uniform data density. Version proliferation under chronic late arrival creates chains of nearly identical trees, and garbage collection of unreachable versions is under-specified in the paper. Finally, BTrDB has no declarative query language surface comparable to SQL — it is an API-first engine.

**QuestDB.** The time-partitioned columnar layout assumes the designated timestamp is *the* access path; out-of-order ingestion beyond the WAL's sorting capacity degrades to expensive merges. The custom SQL dialect is powerful but non-portable. QuestDB's NULL semantics deliberately deviate from the SQL standard (null as a concrete comparable value) [11], a documented footgun for migrating workloads. And like all scan-optimized engines, it is weak at selective point lookups relative to indexed stores.

**The codec lineage.** Gorilla/Chimp/Elf are all *lossless stream codecs*: they cannot exploit cross-series correlation, cannot do lossy summarization with error bounds, and their per-point CPU cost is paid on *every* ingest — at 100 M pts/s the codec itself becomes the bottleneck, motivating SIMD batch codecs such as the AVX-512 Gorilla implementation [8].

---

## 7. Conclusion

Gorilla, BTrDB, and QuestDB are three answers to one question — *what does time-series data actually look like?* — and their answers compose rather than compete. Gorilla proved that the hot past fits in memory once autocorrelation is encoded at the bit level, and its delta-of-delta/XOR skeleton became the lingua franca of streaming compression, refined by Sprintz, Chimp, and Elf. BTrDB proved that if queries are aggregations, the storage structure should *be* the aggregation pyramid: versioned, copy-on-write, resolution-addressable. QuestDB proved that none of this requires abandoning SQL.

Three research directions follow. **Learned stream codecs** that adapt the XOR-distribution model per series could close the remaining gap to block compressors without sacrificing streaming. **Multi-resolution consistency** — a formal story for "the 1-minute view as of version $v$" under late arrival in systems with declarative rollups — is missing. And **retention-aware query planning**, choosing automatically between raw scans, rollup reads, and cold-tier fetches, remains heuristic everywhere.

The enduring lesson is architectural, not algorithmic: *storage structures should be derived from workload structure, not inherited from the last workload.* The B-tree was derived from the transaction, the LSM from the write burst — and the versioned aggregate tree, the compressed in-memory block, and the time-partitioned columnar file were each derived, correctly, from the time series.

---

## References

[1] Tuomas Pelkonen, Scott Franklin, Justin Teller, Paul Cavallaro, Qi Huang, Justin Meza, and Kaushik Veeraraghavan. "Gorilla: A Fast, Scalable, In-Memory Time Series Database." *Proc. VLDB Endow.* 8(12): 1816–1827, 2015. doi: [10.14778/2824032.2824078](https://doi.org/10.14778/2824032.2824078). Open-source reproductions: [givia/gorilla (Rust)](https://github.com/givia/gorilla), [givia/gorilla-simd (C, AVX-512)](https://github.com/givia/gorilla-simd).

[2] Michael P. Andersen and David E. Culler. "BTrDB: Optimizing Storage System Design for Timeseries Processing." In *Proc. 14th USENIX Conference on File and Storage Technologies (FAST '16)*, 2016. Author slides: [fast16_slides_andersen.pdf](https://www.usenix.org/sites/default/files/conference/protected-files/fast16_sildes_andersen.pdf). Survey notes: [xephon-k btrdb survey](https://github.com/xephonhq/xephon-k/blob/HEAD/doc/survey/btrdb.md), [xephon-b btrdb notes](https://github.com/xephonhq/xephon-b/blob/HEAD/doc/database/btrdb.md).

[3] QuestDB. Open-source time-series database: zero-GC Java core, time-partitioned columnar memory-mapped storage, SIMD-vectorized query engine, time-series SQL extensions. [github.com/questdb/questdb](https://github.com/questdb/questdb/blob/HEAD/README.md); query engine architecture: [documentation/architecture/query-engine.md](https://github.com/questdb/documentation/blob/HEAD/documentation/architecture/query-engine.md).

[4] Davis Blalock, Samuel Madden, and John Guttag. "Sprintz: Time Series Compression for the Internet of Things." *Proc. ACM IMWUT*, 2018.

[5] Panagiotis Liakos, Katia Papakonstantinopoulou, and Yannis Kotidis. "Chimp: Efficient Lossless Floating Point Compression for Time Series Databases." *Proc. VLDB Endow.* 15(11): 3058–3070, 2022. doi: [10.14778/3551793.3551852](https://doi.org/10.14778/3551793.3551852). Paper: [p3058-liakos.pdf](https://www.vldb.org/pvldb/vol15/p3058-liakos.pdf); code: [github.com/panagiotisl/chimp](https://github.com/panagiotisl/chimp).

[6] "Elf: Erasing-based Lossless Floating-Point Compression for Time Series" (and Elf+ refinement), 2023. [arXiv:2308.11915](http://arxiv.org/pdf/2308.11915).

[7] Søren Kejser Jensen, Torben Bach Pedersen, and Christian Thomsen. "Time Series Management Systems: A Survey." *IEEE Trans. Knowl. Data Eng.* 29(11): 2581–2600, 2017. doi: 10.1109/TKDE.2017.2740932.

[8] Edgar Ortega Ramírez. "tickr: Lightweight embeddable time series database engine with Gorilla compression." [github.com/edgarortegaramirez/tickr](https://github.com/edgarortegaramirez/tickr).

[9] "CAMEO: Autocorrelation-Preserving Line Simplification for Lossy Time Series Compression" (comparative lossless baseline data for Gorilla/Chimp bits-per-value). [arXiv:2501.14432](https://arxiv.org/html/2501.14432v1).

[10] Xephon project. "BTrDB survey notes: time-partitioned, multi-resolution, version-annotated copy-on-write k-ary tree; 53 M values/s insert, 119 M values/s read (four-node)." [doc/survey/btrdb.md](https://github.com/xephonhq/xephon-k/blob/HEAD/doc/survey/btrdb.md).

[11] "QuestDB." *Wikipedia.* Columnar layout, memory-mapped partitions, off-heap zero-GC design, SIMD filtering/aggregation, `SAMPLE BY`/`FILL`/`ASOF JOIN` extensions. [en.wikipedia.org/wiki/QuestDB](https://en.wikipedia.org/wiki/QuestDB).

[12] QuestDB. "TimescaleDB vs QuestDB: 2026 Benchmark Results." Tiered storage (WAL → columnar partitions → Parquet on object storage), QWP binary protocol, materialized views over `SAMPLE BY`. [questdb.com/blog/timescaledb-vs-questdb-comparison](https://questdb.com/blog/timescaledb-vs-questdb-comparison/)
