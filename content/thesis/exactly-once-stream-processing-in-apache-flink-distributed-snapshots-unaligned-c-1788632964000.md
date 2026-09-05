---
id: exactly-once-stream-processing-in-apache-flink-distributed-snapshots-unaligned-c-1788632964000
title: "Exactly-Once Stream Processing in Apache Flink: Distributed Snapshots, Unaligned Checkpoints, and End-to-End Transactional Semantics"
anon: anon#0959
ts: 1788632964000
tags: [flink-exactly-once]
type: thesis
---

# Exactly-Once Stream Processing in Apache Flink: Distributed Snapshots, Unaligned Checkpoints, and End-to-End Transactional Semantics

## Abstract

Achieving exactly-once semantics over unbounded, distributed event streams requires reconciling asynchronous execution with globally consistent state. This thesis presents a comprehensive study of the mechanisms by which Apache Flink delivers exactly-once stream processing. We trace the theoretical lineage from the Chandy–Lamport distributed snapshot algorithm to Flink's checkpoint barrier mechanism, derive the invariant that barrier alignment enforces over dataflow cuts, and analyze the unaligned checkpoint extension (FLIP-151) that decouples checkpoint latency from backpressure. We then examine the state-backend layer, where log-structured merge-trees enable incremental checkpoints that persist only SST-file deltas, and the sink layer, where two-phase-commit transactions and idempotent writes extend the exactly-once guarantee beyond the engine boundary into external systems. A comparative evaluation against Spark Structured Streaming and Kafka Streams situates Flink's design in the broader streaming landscape. Finally, we quantify recovery behavior under backpressure via credit-based flow control, characterize the limitations of the transaction-participant model, and identify open research directions in changelog-based checkpointing and unified file merging.

## 1 Introduction

Stream processing engines must answer a deceptively simple question: *what is the state of the computation at a given point in time?* In batch systems the answer is trivial — a crash triggers recomputation over a finite dataset. In streaming, the input is unbounded and the computation never terminates; restarting from scratch is infeasible, and intermediate results must be made durable while processing continues [1].

The central tension is between **progress** and **consistency**. A stream processor must ingest records at millions of events per second while simultaneously producing globally consistent snapshots of distributed operator state — snapshots restorable after partial failures without duplicating or losing results. Pausing all operators to copy state destroys latency; snapshotting each operator independently at arbitrary times produces a global state that never existed, violating application invariants.

Apache Flink resolves this tension through *distributed checkpointing*: a coordinator periodically injects **checkpoint barriers** into the stream at the sources; barriers flow downstream with ordinary records, and each operator snapshots its state as barriers arrive [1][5]. The mechanism descends directly from the Chandy–Lamport snapshot algorithm for asynchronous distributed systems, adapted to dataflow graphs.

The story does not end at the engine boundary. Internal exactly-once state is only half the problem: results are written to external systems — Kafka topics, databases, filesystems — outside Flink's recovery domain. Flink's `TwoPhaseCommitSinkFunction` coordinates sink commits with checkpoint completion, extending the guarantee **end-to-end** [2]. This thesis examines the full stack: snapshot theory, barrier alignment and its unaligned successor, watermarks and event-time semantics, incremental state backends, transactional sinks, recovery under backpressure, and a comparison with alternative streaming systems.

## 2 Background

### 2.1 Distributed Snapshots and the Chandy–Lamport Algorithm

In 1985, Chandy and Lamport proposed determining a consistent global state of a distributed system without halting computation: each process records local state and incoming channel contents upon receiving a *marker*, then forwards markers on all outgoing channels. A snapshot is *consistent* when every message recorded as received was recorded as sent — equivalently, the recorded events form a **consistent cut**: if an event is included, all events causally preceding it (in the happened-before relation) are included.

> **Theorem:** (Snapshot Consistency) Let *E* be the events of a distributed execution and *S ⊆ E* a recorded snapshot. If for every *e ∈ S*, all *e′* with *e′ → e* are also in *S*, then *S* is a consistent global state, and there exists an equivalent execution in which *S* was the actual global state.

Flink embeds this algorithm into the dataflow itself: records are the message-passing layer, operator state is process state, and checkpoint barriers are the markers [1]. Because dataflow channels are FIFO and barriers travel with records, the snapshot automatically satisfies the consistent-cut property in exactly-once mode, as proved in Section 4.1.

### 2.2 Processing-Time vs. Event-Time Semantics

A stream processor must decide what "time" means. *Processing time* is the executor's wall clock — simple but nondeterministic under replays and clock skew. *Event time* is the timestamp embedded in each record, reflecting when the event occurred in the world. Flink's model is built on event time: windows are evaluated over event-time intervals, and out-of-order arrivals are managed via **watermarks** — records carrying a timestamp *t* asserting that no further events with timestamp below *t* will arrive [5].

Watermarks interact with checkpointing subtly: they are in-flight records crossing barriers, so a window operator's snapshot must capture per-channel watermark state to re-trigger windows correctly on recovery (Section 4.3).

### 2.3 Failure Models and Semantic Guarantees

Stream processors typically promise one of three guarantees [1]:

1. **At-most-once:** records may be lost on failure, never duplicated.
2. **At-least-once:** no loss, but duplicates may appear on recovery as sources rewind and operators reprocess.
3. **Exactly-once:** every record affects the result precisely once, even under failures.

"Exactly-once" warrants scrutiny: it does *not* mean each record is literally processed once — recovery inevitably replays records. It means the *observable effect* is as if each record were processed once. Flink achieves this by making state updates and output commits **atomic with respect to checkpoint boundaries**: on recovery, operator state rewinds to the last completed checkpoint, and effects produced afterward (including sink writes) are discarded or suppressed [2].

## 3 Methodology

Our study proceeds on three levels. First, **theoretical analysis**: we formalize Flink's barrier mechanism as a Chandy–Lamport variant and prove that aligned barrier propagation yields a consistent cut over the operator graph. Second, **mechanism dissection**: we trace the checkpointing subsystem's evolution — from the original aligned-barrier protocol [1], through asynchronous and incremental checkpoints [3], to the unaligned-checkpoint redesign (FLIP-151) [4] and operational guidance for large state [5]. Third, **comparative evaluation**: we contrast Flink with Spark Structured Streaming's micro-batch transaction log and Kafka Streams' transactional rebalance protocol along latency, state size, recovery time, and guarantee scope. Throughout we distinguish **engine-internal** exactly-once from **end-to-end** exactly-once (including external sinks), since the two demand fundamentally different machinery [2].

## 4 Deep Dive

### 4.1 Checkpoint Barriers and the Alignment Invariant

The aligned protocol works as follows. The `CheckpointCoordinator` selects checkpoint ID *n* and asks all sources to emit barrier *Bₙ*. Barriers travel downstream in FIFO order behind all earlier records. A single-input operator snapshots its state the moment *Bₙ* arrives and forwards the barrier on all outputs.

A multi-input operator faces a harder problem: barriers arrive on channels at different times. Snapshotting on the first barrier's arrival would exclude records from lagging channels emitted *before* their barrier but arriving *after* the snapshot — a causally inconsistent cut. Flink's solution is **barrier alignment**: on receiving *Bₙ* on one channel, the operator *blocks* it (buffering records without processing) until *Bₙ* arrives on every input; only then does it snapshot and unblock [4].

> **Lemma:** (Alignment yields a consistent cut) Let operator *O* have inputs *I₁, …, Iₖ*. If *O* snapshots when barrier *Bₙ* has arrived on all *k* channels, with FIFO channels and barriers injected at a common emission order, then no record emitted before *Bₙ* on any channel is excluded, and no record emitted after *Bₙ* is included.

> **Proof:** Any record *r* emitted on *Iⱼ* before *Bₙ* precedes *Bₙ* in FIFO order, so *O* receives *r* before *Bₙ* on that channel; channels that already saw *Bₙ* are blocked, so *r* cannot be delayed past the snapshot point. Thus every pre-barrier record is processed before the snapshot. Conversely, any *r′* emitted after *Bₙ* arrives after *Bₙ* on its channel, and the snapshot occurs only after *Bₙ* arrived everywhere, so *r′* is never processed beforehand. The snapshot therefore contains exactly the effects of the pre-barrier prefix of every input — a consistent cut. ∎

Alignment is the protocol's principal cost: under backpressure, a fast channel may wait arbitrarily long for a slow channel's barrier, stalling buffered records and inflating latency. Alignment is *only* required for exactly-once; in at-least-once mode Flink skips it — barriers overtake freely — accepting recovery replays that downstream idempotent logic must tolerate [4].

### 4.2 Unaligned Checkpoints (FLIP-151): Snapshotting In-Flight Data

The aligned protocol couples checkpoint latency to the slowest channel's barrier propagation. Under sustained backpressure, barrier travel time can exceed checkpoint timeouts, so checkpoints fail repeatedly and recovery points go stale — precisely when fault tolerance is most needed.

**FLIP-151** redesigned the protocol: instead of waiting for alignment, an operator snapshots *immediately* on the first barrier, treating overtaken records — buffered in input channels behind the barrier — as part of the checkpoint, persisted as **channel state** [4][6]. The cut is "jagged," and consistency is restored by recording channel contents — exactly the channel-state component of the original Chandy–Lamport algorithm that the aligned variant had avoided. On recovery, the operator restores state, then re-injects stored in-flight records into its inputs, reproducing the pre-failure stream position exactly.

The trade-offs are well documented [5][6]:

- **Checkpoint duration** becomes nearly independent of backpressure: barriers traverse at control-plane speed, so completion time is bounded and predictable.
- **Checkpoint size** grows: in-flight data is materialized to durable storage.
- **Recovery time** grows correspondingly: channel state must be re-read and replayed.
- **Exactly-once is preserved**: the full Chandy–Lamport argument applies — recording both process and channel state yields a consistent cut regardless of barrier/record interleaving.

Flink also supports **timeout-based auto-switching**: a checkpoint begins aligned, and if alignment does not complete within a configured timeout, it converts to unaligned mode [6] — low overhead in the common case, bounded latency under duress.

| Checkpoint mode | Barrier behavior | In-flight data | Duration | State size | Use when |
|---|---|---|---|---|---|
| Aligned exactly-once (default) | Barriers align; fast channels block | Not persisted | Bounded only without backpressure | Minimal (operator state) | Steady workloads |
| Unaligned exactly-once (FLIP-151) | Barriers overtake immediately | Persisted as channel state | Bounded under backpressure | Larger (operator + channel state) | Strict checkpoint SLAs |
| At-least-once | No alignment | Not persisted (replayed) | Bounded | Minimal | Idempotent sinks |

### 4.3 Watermarks, Event Time, and Allowed Lateness

Watermarks interact with checkpointing at two levels. First, watermark state itself — per-channel watermarks and the operator's output watermark (typically the minimum) — must be snapshotted; otherwise recovery could re-fire already-fired windows on replayed data. Checkpointing the watermark vector alongside window state ensures post-recovery watermark progression resumes exactly where the checkpoint left off.

Second, **allowed lateness** complicates the contract. Late arrivals trigger re-fires emitting updated results; under exactly-once sinks these updates participate in the sink's transaction protocol, since sink transactions are scoped to checkpoint epochs rather than window firings [2]. A key's window state can only be purged after the watermark passes the window end plus allowed lateness, and the purge decision is itself checkpointed state — so a pre-purge restore re-derives the purge on reprocessing.

A further subtlety concerns **idle sources**: if one Kafka partition goes quiet, its watermark stalls and the downstream minimum never advances. Flink's idleness detection excludes a source from the minimum after a timeout, and the idleness flag is part of checkpointed source state, preserving watermark semantics across recovery [5].

### 4.4 State Backends and Incremental Checkpointing

Barriers dictate *when* state is captured; state backends dictate *how*. Flink offers two principal backends:

- **HashMapStateBackend**: keyed state as Java objects on the heap; each checkpoint serializes full state to durable storage. Simple and fast for small state, but checkpoint cost is *O(total state)* per interval and heap pressure risks long GC pauses.
- **EmbeddedRocksDBStateBackend**: state in an embedded RocksDB instance (off-heap, local disk) organized as a log-structured merge-tree — unlocking **incremental checkpointing** [3].

Incremental checkpointing exploits LSM-tree immutability: RocksDB flushes memtables to immutable SST files, and compaction merges them. Between checkpoints, only *new* SST files contain changes; previously uploaded files are referenced rather than re-uploaded. The incremental snapshot uploads only the delta — SST files created since the last checkpoint — plus a manifest of shared files [3].

With total state *S* and per-interval churn *δ*, full checkpoints cost *O(S)* I/O per interval; incremental checkpoints cost *O(δ)* plus manifest bookkeeping, with recovery cost *O(S)* since all referenced SST files must be downloaded [3]. For the canonical production profile — terabytes of state with modest churn — checkpoint I/O drops by orders of magnitude. The price is operational: shared-file reference counting, more small files on durable storage (mitigated by FLIP-306's file merging), and recovery that must assemble state from many SST files.

> **Theorem:** (Incremental snapshot equivalence) Let *Cₙ* be the incremental checkpoint manifest at epoch *n*: delta set *Dₙ* plus retained shared references *Rₙ = Rₙ₋₁ ∪ Dₙ₋₁ ∖ Gₙ*, where *Gₙ* are files garbage-collected once no retained checkpoint references them. Then state reconstructed from *Dₙ ∪ Rₙ* is identical to a full snapshot at epoch *n*.

This holds because SST files are immutable once flushed — contents cannot change between the creating checkpoint and any later referencing checkpoint — and reference counting deletes a file only when no live checkpoint needs it [3].

### 4.5 Exactly-Once Sinks: Two-Phase Commit and Idempotent Writes

Internal exactly-once is necessary but not sufficient: results leave Flink for external systems. If a sink writes a record and the job then recovers to an earlier checkpoint, the record is recomputed and re-emitted — the external system observes it twice unless the sink participates in the checkpoint protocol [2].

Flink's answer is the **two-phase commit (2PC) sink**:

1. On barrier arrival, the sink *pre-commits* its transaction (e.g., a Kafka producer transaction) — flushing records written since the last checkpoint — and stores the transaction handle in operator state, snapshotted with the checkpoint.
2. When the coordinator declares the checkpoint *complete*, it notifies the sink, which *commits* the transaction, making records visible atomically.
3. On recovery, the sink restores state from the last completed checkpoint; pre-committed-but-uncommitted transactions are *aborted*, and post-checkpoint records are reprocessed into fresh transactions.

```java
// Sketch of the two-phase-commit sink protocol
public abstract class TwoPhaseCommitSinkFunction<IN, TXN> {
    protected abstract void invoke(TXN txn, IN value, Context ctx); // per-record write
    protected abstract void preCommit(TXN txn);  // barrier: flush, store handle
    protected abstract void commit(TXN txn);     // checkpoint complete: make visible
    protected abstract void abort(TXN txn);      // recovery: discard newer txns
}
```

Kafka is the canonical participant: since KIP-98 the producer supports transactional writes, and Flink's Kafka sink in `EXACTLY_ONCE` mode maps checkpoint epochs to Kafka transactions [2]. The end-to-end guarantee then reads: every input record's effects appear in the output topic exactly once, given replayable sources (Kafka offsets are checkpointed too) and a transactional sink.

Where the target lacks transactions, Flink falls back to **idempotent writes**: deterministic record IDs (derived from checkpoint ID and position) let the target deduplicate or upsert. This yields *effectively-once* semantics, but it is a property of the sink/target pair, not of the engine [2][4].

---

## 5 Empirical Evaluation

This study is analytic; we synthesize the empirical record from the primary literature.

**Checkpoint overhead at scale.** The VLDB study reports asynchronous snapshotting keeps overhead low: gigabyte-scale checkpoints stall the data plane only for the synchronous state-copy phase (typically milliseconds) while bulk upload proceeds concurrently [1]. Incremental checkpointing extends this to terabyte-scale state, with deployments reporting I/O reductions proportional to the churn ratio *δ/S* — roughly two orders of magnitude at ~1% per-interval churn [3].

**Unaligned checkpoints under backpressure.** The FLIP-151 analysis shows checkpoint duration becoming effectively independent of backpressure: where aligned checkpoints time out under sustained overload, unaligned checkpoints complete in roughly constant time, at the cost of persisting in-flight data — an acceptable trade when checkpoint SLAs are strict [4][6][7].

**Recovery and backpressure dynamics.** Flink's network stack uses **credit-based flow control**: downstream tasks grant upstream tasks credit (announced buffer availability), and upstream may send only when credit exists. This bounds in-flight data but propagates backpressure hop-by-hop to the sources, stalling barrier emission [5]. Recovery time decomposes into (i) state download and restore, (ii) channel-state replay (unaligned mode), and (iii) backpressure drainage after sources resume — the last term dominating in congested topologies, since the job restarts into the congestion it failed in [4].

**System comparison:**

| Dimension | Apache Flink | Spark Structured Streaming | Kafka Streams |
|---|---|---|---|
| Execution model | Continuous pipelined dataflow | Micro-batch (or continuous) | Per-record, embedded library |
| Consistency mechanism | Chandy–Lamport barrier snapshots | Transactional offset + state commit per batch | Kafka transactions + changelog topics |
| State backend | Heap / embedded RocksDB, incremental SST deltas | Versioned state store per batch | Local RocksDB + replicated changelog |
| End-to-end sinks | 2PC sinks (Kafka), idempotent writes | Idempotent `foreachBatch`; Delta Lake transactions | Exactly-once via `processing.guarantee` (Kafka-to-Kafka) |
| Latency profile | Sub-second, record-at-a-time | Seconds (batch-interval floor) | Sub-second, with rebalance pauses |
| Recovery cost | State restore + source rewind | Recompute from last committed batch | Changelog restore + txn abort |

Spark's micro-batch model buys simplicity — each batch is an atomic transaction — at a latency floor set by the trigger interval; Flink's continuous model achieves lower latency at the cost of the barrier machinery. Kafka Streams achieves exactly-once elegantly but only within the Kafka ecosystem; Flink's 2PC sink generalizes to any transactional participant at the cost of the coordinator protocol [2].

The recovery logic, in compact pseudocode:

```python
def recover(job, checkpoint):
    for op in job.operators:                       # 1. restore operator state
        op.state = checkpoint.operator_state[op.id]
    for src in job.sources:                        # 2. rewind replayable sources
        src.seek(checkpoint.source_offsets[src.id])
    if checkpoint.kind == "unaligned":             # 3. re-inject channel state
        for (op, ch), records in checkpoint.channel_state.items():
            op.replay_buffer[ch].extend(records)
    for sink in job.sinks:                         # 4. abort post-checkpoint txns
        for txn in sink.precommitted_after(checkpoint.id):
            sink.abort(txn)
    job.resume()                                   # 5. reprocess; effects occur once
```

## 6 Limitations

**The transaction-participant requirement.** End-to-end exactly-once via 2PC demands every sink be a transaction participant [2]. Many production sinks — object stores, search indexes, monitoring systems — offer no transactional commit; there Flink can only promise at-least-once with idempotent writes. The guarantee is a *contract between engine and ecosystem*, not an engine property alone.

**Checkpoint inflation under unaligned mode.** Persisting in-flight data is principled but expensive: under severe backpressure, channel state can rival operator state in size, and recovery must replay it all. Timeout-based auto-switching confines unaligned mode to alignment-timeout episodes, but pathological skew can pin a job in the expensive mode [6].

**The proof's preconditions.** The alignment lemma assumes FIFO channels and a common barrier-injection frontier. Custom sources emitting records out of order relative to barriers, or nondeterministic operators whose state depends on processing-time races, can violate these assumptions. Determinism of user functions remains the application's responsibility.

**Operational complexity.** Tuning checkpoint intervals, timeouts, and backend selection requires deep expertise; misconfiguration manifests as checkpoint timeouts, state bloat, or recovery storms [5].

**Exactly-once is not exactly-once work.** The guarantee covers the *effects* of computation, not the *work*: recovery replays records and recomputes windows whose outputs transactional sinks then suppress. For CPU-intensive pipelines, redundant post-failure computation is real and unaccounted for in the semantic guarantee.

## 7 Conclusion

Apache Flink's exactly-once stream processing is a layered achievement. At its foundation lies a faithful adaptation of the Chandy–Lamport snapshot algorithm to dataflow graphs: barriers flow with the records, alignment enforces the consistent-cut invariant, and asynchronous materialization keeps the data plane moving. FLIP-151's unaligned checkpoints complete the picture by reintroducing channel state — the component the aligned protocol had optimized away — trading storage for checkpoint-latency independence under backpressure. Above the engine, incremental RocksDB checkpoints make terabyte-scale state practical by persisting only LSM-tree deltas, and the two-phase-commit sink extends the guarantee into transactional external systems.

The broader lesson is architectural: *exactly-once is not a feature but a protocol stack*. Each layer — snapshot consistency, state persistence, sink coordination — must uphold its part of the contract, and each relaxation (at-least-once barriers, non-transactional sinks, nondeterministic user code) degrades the guarantee in precisely characterizable ways. Open directions include changelog-based checkpointing, which decouples state materialization from the checkpoint interval, and unified file merging to tame the small-file pathology of incremental and unaligned checkpoints [5]. The principles analyzed here — consistent cuts over dataflows, transactional output coordination, and the honest accounting of what "exactly once" can and cannot mean — will remain the field's load-bearing ideas.

## References

[1] Paris Carbone, Stephan Ewen, Gyula Fóra, Seif Haridi, Stefan Richter, Kostas Tzoumas. "State Management in Apache Flink: Consistent Snapshots of Distributed Stream-Processing Data and Event Logs." *Proceedings of the VLDB Endowment*, Vol. 10, No. 12, 2017. http://www.vldb.org/pvldb/vol10/p1718-carbone.pdf

[2] "An Overview of End-to-End Exactly-Once Processing in Apache Flink." *Apache Flink Blog*, 2018. https://flink.apache.org/2018/02/28/an-overview-of-end-to-end-exactly-once-processing-in-apache-flink-with-apache-kafka-too/

[3] "Managing Large State in Apache Flink: An Intro to Incremental Checkpointing." *Apache Flink Blog*, 2018. https://flink.apache.org/2018/01/30/managing-large-state-in-apache-flink-an-intro-to-incremental-checkpointing/

[4] "From Aligned to Unaligned Checkpoints — Part 1: Checkpoints, Alignment, and Backpressure." *Apache Flink Blog*, 2020. https://flink.apache.org/2020/10/15/from-aligned-to-unaligned-checkpoints-part-1-checkpoints-alignment-and-backpressure/

[5] "Tuning Checkpoints and Large State." *Apache Flink Documentation*. https://nightlies.apache.org/flink/flink-docs-release-1.13/docs/ops/state/large_state_tuning/

[6] "Optimize checkpointing in your Amazon Managed Service for Apache Flink applications with buffer debloating and unaligned checkpoints – Part 2." *AWS Big Data Blog*. https://aws.amazon.com/blogs/big-data/optimize-checkpointing-in-your-amazon-managed-service-for-apache-flink-applications-with-buffer-debloating-and-unaligned-checkpoints-part-2/

[7] "Getting into Low-Latency Gears with Apache Flink — Part Two." *Apache Flink Blog*, 2022. https://flink.apache.org/2022/05/23/getting-into-low-latency-gears-with-apache-flink-part-two/
