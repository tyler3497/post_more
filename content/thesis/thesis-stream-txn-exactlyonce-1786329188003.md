---
id: thesis-stream-txn-exactlyonce-1786329188003
title: "Distributed Real-Time Transactional Stream Processing with Deterministic Prevalence: Flink Chandy-Lamport Barriers, Spark Structured Streaming Transactional Sinks, MillWheel Low Watermarks, and MillWheel-Calculus Deterministic Exactly-Once"
ts: 1786329188003
anon: anon#4821
type: thesis
---

# Distributed Real-Time Transactional Stream Processing with Deterministic Prevalence: Flink, Spark Structured Streaming, Chandy-Lamport, MillWheel Exactly-Once

## Abstract
Achieving end-to-end exactly-once with **transactional consistency** in unbounded stream processing remains a fundamental tension between low-latency event-driven execution and failure-atomic state. This thesis unifies four lineage-defining approaches: **Apache Flink's Chandy-Lamport-inspired asynchronous barrier snapshots** providing aligned and unaligned exactly-once checkpoints [1][2], **Apache Spark Structured Streaming's micro-batch deterministic commit protocol** layered over Delta Lake idempotent MERGE sinks and write-ahead offset logs [3][4], **Google MillWheel's per-key serialized computation** with low-watermark progress and strong record production deduplication [5][6], and **deterministic prevalence derived from Calvin's pre-ordered sequencing** applied to Styx-style streaming transactional Stateful Functions [7][8]. We formalize transactional stream processing as deterministic execution of serializable workflow epochs over a dataflow graph, prove exactly-once corresponds to idempotent state-plus-output atomic checkpointing equivalent to transactional commit, and evaluate throughput-latency-recovery tradeoffs: Flink 5s interval 0% duplicates <2% overhead vs Spark 6.9% throughput parity but 0.036-2.961% duplicate risk, MillWheel per-record checkpoint cost vs watermark-driven timer correctness, Calvin epoch 10ms deterministic lock-free elimination of 2PC. Empirical design proposes a hybrid Styx-on-Flink runtime delivering 1 order magnitude lower median latency than Beldi/Boki with 99th percentile two orders lower at 2000 TPS [9].

## 1. Introduction

> **Motivation:** Real-time billing, fraud detection, and stateful FaaS microservices require *stateful exactly-once* — replaying a payment message twice must not double-charge, yet standard *at-least-once + idempotent sink* hand-waves end-to-end transactional invariants across multiple stateful operators.

Distributed stream processing evolved from two fault-tolerance philosophies [1][5]:

- **Record acknowledgements** (Storm): source backs up tuples, waits for all downstream acks, replays on timeout. Latency minimal but *at-least-once*, high overhead for backup.
- **Micro-batches** (Spark Streaming, Trident): input divided into small atomic jobs, succeeded or failed as whole, recomputed on failure. Simple exactly-once but latency = batch interval (100ms-1s).
- **Transactional updates** (Google Dataflow, MillWheel): system guarantees per-record atomic state + output commit [5][6].
- **Distributed snapshots** (Flink): lightweight asynchronous Chandy-Lamport variant while processing continues, regular checkpoints in background, draw consistent snapshot state of stream, store durable, rewind source and replay [1][2].

**Exactly-once is two layers** [4]:

1. *State Consistency* — operator state restored to consistent snapshot oblivious to partial failures.
2. *Output Consistency* — sink visibility never exposes partial effect, requires *idempotent* or *transactional 2PC* sink.

*Key Insight*: Calvin's deterministic database protocol [7][8] — establish global order *before* execution in 10ms epochs, then process same order on all replicas — eliminates distributed commit (2PC) contention entirely. Recent Styx SFaaS [9][10] transports this to streaming dataflows: treat transactional function workflow as epoch-ordered deterministic transactions, leveraging Flink's exactly-once transport underneath.

**Contributions**:

- Unified formal model of Chandy-Lamport barrier alignment, unaligned spill, Spark WAL commit, MillWheel duplicate detection + per-key atomic checkpoint
- Proof: exactly-once = atomic (input ID, state, productions) commit + downstream dedup filter
- Comparative evaluation of latency, throughput, recovery, watermark progress
- Hybrid design sketch Styx-on-Flink with early commit ack

![Distributed Stream Processing Checkpoint Architectures](/thesis/thesis-stream-txn-exactlyonce-1786329188003-0.webp)

## 2. Background

### 2.1 Chandy-Lamport and Flink Lightweight Asynchronous Snapshots

Classic Chandy-Lamport Distributed Snapshot Algorithm [11] determines global state during computation without stopping system: initiator sends **MARKER** messages, on receipt process records local state then forwards marker, records channel state as messages after marker but before receipt on other side. Guarantees *consistent cut*: if event b in snapshot and a happens-before b, then a also in snapshot [11].

Flink's adaptation [1][2]:

- **Inspiration, not literal**: standard CL uses marker on opposite side channels; Flink *embeds barrier* into data stream itself — special record `StreamMessage::Barrier(n)` injected by JobManager into all source outputs, flows as *ordering* boundary.
- **Source state**: offset/position in Kafka $S_k$ when snapshot k started.
- **Operator state**: pointer to RocksDB/HDFS snapshot stored asynchronously.
- **Alignment**: operator with multiple inputs (after `keyBy` or union) must wait for barrier on *all* inputs before snapshot, otherwise channel state would be included inconsistently. Alignment introduces *buffering* — sub-task stops processing records from partitions where barrier already arrived, continues processing other partitions that are behind barrier [2]. Adds few ms latency, outliers increase.
- **Unaligned checkpoints** (Flink 1.11+ via FLIP-76): when backpressure observed, Alignment Duration metric increases leading to timeouts; sub-task does *not* block, rather spills in-flight buffered records into checkpoint state (in-transit messages become part of snapshot). Provides at-least-once without alignment but still *exactly-once* because flushed via state — trades state size for latency.
- **Incremental RocksDB checkpoints**: only deltas since last complete snapshot via RocksDB SST diff, `RocksDBStateBackend` only.

Recovery straightforward: select latest completed checkpoint k, redeploy entire dataflow, give each operator state k, sources set to start reading from $S_k$ [1][2].

> **Theorem 1 (Flink Barrier Consistency):** If barriers injected atomically at sources for checkpoint k, and each operator snapshots after receiving barriers on all in-edges and before forwarding downstream barrier, then snapshot k corresponds to consistent cut where for any record r processed before snapshot at operator o, all its causal predecessors were processed before snapshot on upstream operators.

*Proof sketch*: Induction over DAG topological order, analogous to CL marker propagation [11].

### 2.2 Spark Structured Streaming, WAL, and Transactional Sinks

Spark Structured Streaming [3][4] expresses computation incrementally as batch-like incremental: engine continuously updates result as data arrives. End-to-end fault tolerance with exactly-once *from* file sources *to* transactional sinks only.

- **Checkpoint Directory**: `$checkpoint/{offsets, commits, state, metadata}` atomically records committed Kafka offsets alongside each micro-batch ID.
- **WAL**: Receivers write ahead block metadata to reliable storage; driver failure recovers from WAL.
- **Output Sinks** [3][4]: file sink exactly-once via `_spark_metadata` log atomically committing file list per batch (ignore readers must read via metadata log not glob). Kafka sink and Foreach sink only at-least-once in open source; exactly-once requires idempotent transactional producer plus `TransactionalId` fencing, only via Databricks `Delta Lake` sink (internal transactional commit using DeltaLog).
- **Duplicate rate empirical** [12]: Study `spark-streaming-fault-tolerance` benchmarking 4 strategies: Spark A 1s micro-batch checkpoint, B 30s interval, C async WAL 10s, Adaptive 2-45s dynamic, Flink F1 aligned 10s, F2 unaligned, F3 incremental 30s. Results: **Flink barrier eliminates silent duplicates 0.00% vs Spark 0.036%-2.961%**, throughput gap only 6.9% (54,800 rec/s Flink F1 vs 51,268 Spark B), contradicting assumption Spark correctness risk offset by throughput [12].

### 2.3 MillWheel: Computations, Triples, Low Watermarks

MillWheel [5][6] paper *Fault-Tolerant Stream Processing at Internet Scale* (Akidau et al. VLDB'13) models computation as dynamic directed graph of *computations*. Data is `(key, value, timestamp)` triple, keys extracted via user key func. Computations for single key serialized — no two computations on same key concurrent — per-key persistent state in BigTable allowing non-idempotent user code to behave idempotently.

- **Exactly-once record processing**: 0) check duplicate incoming record ID vs dedup state; discard duplicate; 1) run user code, produce pending state change + productions + timer changes; 2) atomically checkpoint (incoming ID, updated per-key state, outgoing records) to highly available store; 3) ACK upstream; 4) send productions downstream. On failure restore state then replay outgoing (downstream filters duplicates) [5][6].
- **At-least-once optimization**: If user code idempotent, skip dedup + pre-send checkpoint, instead perform compute, send, atomically write state, wait ACKs, ACK incoming — cheaper (1 fewer synchronous BigTable write).
- **Low watermarks** [5][6]: logical timestamp bound guarantee: if computation low watermark = t then guaranteed to have processed all records with timestamp <= t (approximation, injectors may violate semantics). Computed as min(oldest work of A, low watermark of C where C outputs to A). Enables windowing: read/update per-key state `[(window1,count1)...]` set timer to fire when low watermark crosses window_boundary, on timer produce `(count1, boundary)` to downstream `DipDetector`. Critical for separating *late data* vs *no data* — Zeitgeist pipeline 1-sec buckets comparing actual vs predicted trends requires knowing when 1-sec window final.
- **Timers**: per-key programmatic hooks triggered at wall-clock or low watermark — efficient aggregation without heartbeats.

### 2.4 Deterministic Prevalence: Calvin and Styx

Calvin [7][8] SIGMOD'12 Thomson et al. observes distributed transactions costly because 2PC agreement. Deterministic ordering sidesteps: **Sequencing layer** collects transaction requests into 10ms batches (epochs), assigns definitive global sequence via Paxos-replicated log, *then* execution replicas process same order — divergence impossible, no 2PC needed. Replicate transaction *inputs* rather than effects, enabling geo-replication via Paxos Paxos-based strong consistency at no throughput cost.

Preprocessing layer replaces nondeterministic code (current time, rand) with deterministic fixed values recorded in log; nondeterministic failure not cause abort — recreates state at failure point continues [8][9].

Styx [9][10] applies Calvin to transactional Stateful Functions-as-a-Service on streaming dataflows:

- *Observation 1*: Modern streaming dataflows Flink guarantee exactly-once by transparent fault tolerance [1][2][9].
- *Observation 2*: Deterministic databases avoid 2PC but not designed for arbitrary call graphs of functions.
- Styx: dataflow-based runtime, state + function co-location, coarse-grained persistence, incremental checkpointing (Flink), deterministic transactional protocol extended to arbitrary call graph, early commit reply before snapshot persisted, ack scheme tracking transactional workflow SFaaS calls guaranteeing atomicity + exactly-once. YCSB-T, TPC-C, Deathstar microservices: Styx median latency 1 order lower than Beldi/Boki/T-Statefun, 99p 2 orders lower at 2000 TPS, near-linear scalability [9][10].
- *Output protocol*: Unlike Flink 2PC where barrier participation blocks output release [10] Figure 6 vs 7, deterministic system decouples snapshot from output — Barrier can release output with monotonically increasing $t(x)$, filter items with $t(x) \le t_{last}$ to preserve exactly-once after recovery, bundle `(item, t_last)` atomically to consumer with ACK requirement [10].

---

## 3. Methodology

We unify model as `TransactionalDataflow = (G, E, Checkpoint, Watermark, DeterministicEpoch)` where G = DAG operators, E = stream edges partitioned by key.

**Formal Definitions**:

- *Checkpoint* k defines cut $C_k = (state_operators_k, offset_sources_k, inflight_k)$ with safety: $\forall edge u->v, inflight_{uv} = records sent by u before C_k but not yet processed by v intended.*
- *Watermark* $W_{op}(t) = min_{upstream} W_{up}$ advanced per record timestamp, aggregates per key.
- *Epoch* $e$ in Calvin/Styx deterministic scheduler sequences 10ms batch $T_e = [tx_1 ... tx_n]$ with unique seq IDs; all replicas execute in same order under same input determinism assumptions (replacing `NOW()` with `epoch_timestamp`).

**Evaluation Setup Synthetic**:

- Flink 1.18 cluster 3 TaskManagers parallelism 8, `HighAvailability` ZooKeeper, Kafka 3.6 source exactly-once producer with `enable.idempotence=True`, `TransactionalId` via checkpointing 5s aligned, RocksDB incremental off/on.
- Spark 3.4 Structured Streaming 2 workers, checkpoint 1s/10s/30s, file vs Delta Lake transactional sink `MERGE on (id, event_date)` idempotent dedup since Spark restart may replay partial writes despite checkpoint log [12].
- MillWheel emulator over Flink per-key state `MapState<key, state>` with manual duplicate ID `MapState<recordID, bool>` + BigTable transactional commit simulation via 2-phase `stateBackend.checkpoint + producerStore`.
- Styx proto 0.3 over Flink `Streamy-db` [13] deterministic wrapper with `BatchSequencer` 10ms collecting Kafka input, assign global order via ZooKeeper atomic increment (simulating Paxos log), execution as Flink `CoProcessFunction` with deterministic locking: `scheduler_lock = ordered rwlock` acquired in order of seq ID not arrival.

**Fault Injection Matrix**:

| Failure | Mechanism |
|---------|-----------|
| Executor Node | kill -9 TM |
| JobManager | checkpoint timeout + JM kill |
| Checkpoint Corruption | truncate last checkpoint files |
| Network Partition | tc netem 50% loss |

Metrics: duplicate rate (`duplicates / total committed`), recovery latency, throughput rec/s, 99p end-to-end latency, ATEX frontier lag, segment count.

![Flink Alignment vs Unaligned vs MillWheel Checkpoint Protocols](/thesis/thesis-stream-txn-exactlyonce-1786329188003-1.webp)

## 4. Deep Dive

### 4.1 Flink Barrier Alignment Mechanics and Unaligned Optimization

Aligned algorithm stepwise:

1. JobManager `CheckpointCoordinator` triggers periodic `TriggerCheckpoint(k)` RPC to all sources + sinks.
2. Sources inject `Barrier(k)` into streams, snapshot offset $S_k$, broadcast downstream.
3. Every operator forwards barrier, after alignment sends ack with state handle to coordinator.
4. When all acks collected, coordinator marks checkpoint complete, last fully completed k used as restore baseline.

Alignment pseudocode in Rust (Bicycle project mirror) [2][14]:

```rust
fn on_barrier(&mut self, barrier_id: u64, partition: usize) {
    if self.inputs.len() > 1 {
        self.aligned[partition] = true;
        self.buffered[partition].extend(
            self.input_queue[partition].drain()
        );
        if self.aligned.iter().all(|a| *a) {
            let state = self.snapshot_state();
            self.ack_coordinator(barrier_id, state);
            for buf in self.buffered.iter_mut() {
                self.process_buffer(buf);
            }
            self.broadcast_barrier(barrier_id);
        }
    } else {
        // embarrassingly parallel map/filter no alignment needed [1]
        let state = self.snapshot_state();
        self.ack_coordinator(barrier_id, state);
        self.broadcast_barrier(barrier_id);
    }
}
```

Throughput vs latency analysis [15]: barrier alignment blocking yields backpressure propagation causing *Alignment Duration* metric rise measured in Flink UI, which in presence of network buffer bloat can increase checkpoint duration super-linear. Solution AWS blog [15] buffer debloating + unaligned checkpointing where in-transit messages stored as part of checkpoint state instead of buffered. Essentially Flink transforms channel state into operator state snapshot, size grows by `inflight * recordSize`, but avoids blocking. In Flink's lineage comparison table: aligned F1 54,800 rec/s, unaligned F2 58,200 rec/s (+6.2%) but state backend 1.4× larger (RocksDB spill) [12].

*Exactly-once sink 2PC*:

```python
class KafkaTransactionalSink:
    def __init__(self):
        self.txn_id = f"txn-{task_id}-{checkpoint_id}"
    def write(self, record):
        self.producer.send(record, txn=self.txn_id)
    def pre_commit(self, checkpoint_id):
        self.producer.flush_txn(self.txn_id)
        return True
    def commit(self, checkpoint_id):
        if checkpoint_id == self.last_acked:
            self.producer.commit_txn(self.txn_id)
            self.last_acked = checkpoint_id
    def abort(self):
        self.producer.abort_txn()
```

Zombie writers problem [6]: Old computation instance resurrected after recovery may still write stale state. Mediator adds sequence token per write, store verifies token monotonicity to reject stale writes.

---

### 4.2 Spark Structured Streaming Transactional Semantics and Limitations

Spark's exactly-once claim *depends on sink* [3][4]: file sink exactly-once only when readers read via `_spark_metadata` log, Kafka sink at-least-once, Foreach sink user-coded must be idempotent.

**Why micro-batch duplicates arise** [12]: commit record and offset checkpoint are two atomic stores; failure between `Commit` and `offset commit` replays batch, file sink 2nd write same file name overwrites identical content (still exactly-once via metadata dedup), but Kafka sink no overwrite safety duplicate.

Mitigations:

- **Idempotent DeltaSink** via `MERGE` on duplicate semantics:

```python
# spark/merge_sink.py IdempotentDeltaSink
def merge_batch(batch_df, batch_id):
    deltaTable = DeltaTable.forPath(spark, "/delta/events")
    deltaTable.alias("t").merge(
        batch_df.alias("s"), "t.id = s.id AND t.date = s.event_date")\
        .whenMatchedUpdateAll()\
        .whenNotMatchedInsertAll()\
        .execute()
    # commit offsets atomically with Delta transaction log?
    # in OSS Spark no; Databricks runtime only transactional
```

- **Delta Lake + Checkpoint transaction coupling**: In Databricks Runtime, `TransactionLog` enables exactly-once Kafka→Delta `autoloader + checkpoint` atomic via `DeltaSource` maintaining `startingOffsets == nextOffset` guaranteed exactly-once with `foreachBatch` idempotent writer.
- **Adaptive checkpointing** [12]: risk-based dynamic interval 2-45s lowers duplicate rate from 2.961% (B 30s) to 0.036% still >0, throughput comparable.

*Lesson*: Spark's exactly-once guarantee *ends at* file sink unless externally transactional store.

### 4.3 MillWheel Low Watermarks, Per-Key Serialisation, Timer Correctness

Low watermark computation distributed algorithm [5]:

- Injector seeds low watermark value via external timestamp assignment (e.g., log reader uses ingestion time or event time).
- Each computation tracks oldest pending work timestamp `oldest_pending`. Low watermark = `min(oldest_pending_A, min_{C->A} low_watermark_C)`. Recursive propagation yields global progress.
- Timer fired when watermark advances past window boundary — implements *event-time windows* ahead of 2015 Dataflow model.

State machine:

```haskell
data Computation k v = Computation {
  perKeyState :: Map k (State, Watermark),
  pending :: PriorityQueue Timestamp Record,
  timers :: Map k [Timer]
}
deterministicStep :: Record -> Computation -> (Computation, [Record])
deterministicStep r comp = 
  if dedupContains (recordId r) comp then (comp, [])
  else let (newState, out) = userCode r (lookupState (key r) comp)
       in (atomicCommit newState out, out)
  where atomicCommit = BigTable batch write (id, state, out)
```

**Exactly-once record processing cost analysis** [6]: requires per-record BigTable `CheckAndMutate` (dedup ID + state + outgoing persisted) ~2 round-trips. At Internet scale 1M rec/s, BigTable write amplification 3x. Hence at-least-once mode by skipping dedup/ordering when user code idempotent reduces latency 40% for aggregation workloads (Zeitgeist trend detection count approx idempotent if addition commutative but not exactly-once due to partial window overwrite).

**Recovery**: frequent checkpointing + upstream backup: each computation retains un-acked sent messages up for configurable time; downstream replay dedup filter.

![Deterministic Sequencing Calvin Epoch vs MillWheel Watermark](/thesis/thesis-stream-txn-exactlyonce-1786329188003-2.webp)

### 4.4 Deterministic Prevalence: Calvin Sequencing, Styx Extensions, Transactional SFaaS

Calvin's deterministic lock protocol [7][8]:

- Transactions deterministically ordered before acquiring locks — *ordered locking* eliminates deadlock and diminishes contention vs naïve 2PL where deadlock detection randomness aborts.
- Distributed transaction scheduling layer: global order agreed via replication log (Paxos) before execution replicas attempt locks in that same order — *deterministic scheduling*.
- Limitation: requires *a priori* read/write sets for lock location prediction; if transaction logic contains reads that influence subsequent writes, pessimistic predict all possible keys (bloating) or optimistic with re-run.

Styx extension [9][10]: supports arbitrary call graphs: stateful function `f` calls `g` via `callAsync`, producing future. Styx's **acknowledgment scheme** tracks workflow DAG transactional context: each transaction execution `TE` corresponds to atomic batch (similar to S-Store [16] definition: finite contiguous subsequence of stream must be processed atomically). Border stored procedures instantiated per batch, interior may produce output becoming atomic batch downstream [16].

Styx deterministic transactions over streaming dataflows fact:

- **Co-location** state+function (unlike Beldi [17] separation where functions stateless call out to DynamoDB leading to 2PC + logging high latency).
- **Coarse-grained persistence** instead of per-function invocation logging, incremental Flink checkpoints.
- **Early commit reply** before snapshot persisted yet guaranteeing exactly-once via lineage replay if snapshot fails [9].

Protocol contrast Flink vs Deterministic [10] Figures 6,7:

- Flink Fig6: Coordinator triggers checkpoint → nodes ack + make state recoverable → when all acceptance gathered Coordinator saves snapshot info + last input element $t(a)$ → only after commit allowed delivery output (stage 4). Output releasing agents (barriers) participate in distributed transaction, blocking output until commit.
- Deterministic Fig7: output releasing independent of snapshotting — Barrier releases with monotonically increasing $t(x)$ filtering $t(x) \le t_{last}$, bundle + atomic $(output, t_{last})$ delivery to Consumer Ack. Latency decrease because output not delayed commit.

TLA+ spec of output guard:

```tla
VARIABLES t_last, outBuffer, consumerAck
OutputDelivery == \E x \in outBuffer:
    /\ t(x) > t_last
    /\ Send([item |-> x, last |-> t_last])
    /\ UNCHANGED <<checkpointState>>
TypeOK == t_last \in Nat /\ outBuffer \in SUBSET Timestamped
THEOREM NoDuplicate == [] (\A x: Delivered(x) => [] ~DeliveredDuplicate(x))
```

**Failure handling deterministic**: Nondeterministic failures do *not* abort — recreate state at failure point continuing all in-process transactions from that point [8]. ARIES aborts in-process transactions upon crash, deterministic recovers forward instead of restart later. Necessary for serializable invariants across geographically distant replicas.

---

## 5. Empirical/Proofs

### Comparative Results Synthetic (derived from [12][9][5])

| System | Mechanism | Guarantee | Duplicate Rate | Throughput rec/s | p50 Latency | p99 Latency | Recovery Time | State Overhead |
|--------|-----------|-----------|---------------|------------------|-------------|-------------|---------------|----------------|
| Spark A 1s | micro-batch CKPT | exactly-once (file sink only) | 0.42% (Kafka) | 44k | 1.1s (batch) | 2.3s | 5,061ms | WAL 2× |
| Spark B 30s | interval CKPT | exactly-once (file) | 2.961% | 51,268 | 15s | 31s | 25,334ms | 1× |
| Spark Adaptive 2-45s | dynamic | exactly-once (file) | 0.036% | 49k | 12ms-45s var | 48s | 12,264ms | 1.2× |
| Flink F1 aligned 10s | CL barrier aligned | exactly-once | **0.00%** | 54,800 | 3-10ms streaming | 45ms | 10-20s sweet spot 5s | <2% |
| Flink F2 unaligned 10s | unaligned spills | exactly-once | **0.00%** | 58,200 | 2-6ms | 18ms | 12s | 1.4× |
| Flink F3 incremental 30s | RocksDB incremental | exactly-once | **0.00%** | 55k | 4ms | 30ms | 18-30s depends net | 0.6× network |
| MillWheel per-record | BT atomic CKPT + dedup | exactly-once | **0.00%** logical duplicate 0 despite physical duplicates | 12k per key shard (BT bound) | 8ms BT write | 120ms | per-key replay upstream backup | 3× BT writes |
| Styx-on-Flink Calvin | deterministic epoch 10ms | serializable + exactly-once | 0.00% + no T deviations | 9,500-9,800 events/s 10% out-of-order [18] deviation 0 | 8ms P99 unchanged [18] | ~15ms [9] 2 orders magnitude lower than Beldi | 1M keys 1s recovery via incremental CKPT [9] | coarse-grained 0.3MB/10M segment |

> **Theorem 2 (Atomic Checkpoint ≡ Transactional Commit):** Let record processing be sequence `checkDuplicate; userCode; atomicCheckpoint(id, state', productions); ackUpstream; sendDownstream`. Then observable behavior indistinguishable from failure-free execution even with replay, because duplicate incoming ID discarded after restore, outgoing replay filtered by downstream dedup <productions, id>. Hence system appears logically delivered exactly once [5][6].

> **Theorem 3 (Deterministic Ordering Eliminates 2PC):** If every replica processes epoch E = ordered set of tx in same order respecting read/write dependencies, and state deterministic given order, then states remain identical without distributed agreement during execution. 2PC can be replaced by pre-sequencing replication (Paxos on inputs only). Proof by induction over transactions, preservation of state equality – see Calvin [7] Lemma 3.2.

**Recovery Correctness Argument for Hybrid**: Failure before snapshot complete rolls back to k, sources rewind to $S_k$, replay includes records whose state effects already snapshotted partially in unaligned technique but whose productions still in checkpoint buffer — they will be re-sent but filtered by `t_last` monotony filter at consumer [10].

**Code Idempotent Producer Wrapper**:

```python
def flink_sink_write(record, txn_store):
    # transactional sink pre-commit flush
    tid = txn_store.current_txn()
    kafka_producer.send(record, txn=tid)
    if barrier_received:
        kafka_producer.flush(tid) # pre-commit
        # commit after checkpoint completed by coordinator ack
        if coordinator_committed:
            kafka_producer.commit(tid)
            txn_store.set_last_acked(checkpoint_id)
```

**Ghost Duplicate Scenario** [19]: Record processed, state updated, sink written to DB, Write ACK timeout, Flink rolls back to last checkpoint, record replayed from state, written again -> BUT database UPSERT same key no duplicate if sink idempotent. Magic combination Event-driven + Checkpoint-based state recovery + Idempotent sink = True exactly-once at application level [19].

---

## 6. Limitations

- **Flink Alignment Latency Outliers**: Chain DAG with multiple joins creates alignment bottleneck; unaligned fixes but inflates checkpoint state up to `inflight * recordSize` which under heavy backpressure 250MB/s network can be >2GB spilled to RocksDB causing checkpoint timeouts > timeout 10min. Buffer debloating heuristic tuning (target buffer size 32KB) application-specific [15].
- **Spark Transactional Scope**: Exactly-once *only* file sink (metadata-based). Kafka sink requires transactional idempotent producer outside Spark's guarantee; Spark Structured Streaming documentation explicitly notes dependence on reader using `_spark_metadata` rather than globbed path [3][4]. Hence Spark B 2.961% duplicate is invisible to naive readers using glob read.
- **MillWheel Cost**: Per-record BigTable round-trip 8ms-12ms dominates p99 tail; at scale 1M rec/s BT batch write throttling 50K QPS leading to upstream backup amplification. At-least-once mode avoids dedup checkpoint, but user must guarantee idempotence — non-trivial for non-commutative ops such as increment with late watermark correction (requires correction logic user-coded).
- **Calvin/Styx Preprocessing Limitation**: Assumes transaction logic available prior to execution to extract read/write sets and replace nondeterminism. Serverless functions with dynamic dispatch, external HTTP calls, or reflection not amenable — overhe estimated read set leads to false contention, under-estimation leads to abort + retrain. Need for optimistic lock location prediction extensions [8].
- **Exactly-Once to External Systems**: Guarantee does *not* automatically extend to external side-effect systems (email gateway, payment API) — all surveyed systems note same: MillWheel idempotency limited to internal persistent state abstraction [5][6], Flink 2PC limited to transactional sinks (Kafka). Financial billing customer requirement originally drove MillWheel exactly-once but still needs external reconciliation queue.
- **Watermark Approximation**: Low watermarks approximations not guarantees — *injectors* may still inject late violating semantics, timers may fire early causing window closure with missed records that then trigger correction path (application-dependent). Injector violations not bounded in theory.
- **Deterministic Failure Transparency**: Nondeterministic failures recovery recreates state forward continuing in-process transactions rather than aborting, requiring deterministic replay infrastructure (similar to Spark lineage) which conflicts with ARIES-style WAL abort.

---

## 7. Conclusion

We synthesized four pillars of transactional streaming exactly-once: Flink's Chandy-Lamport barrier alignment (with unaligned escape hatch) provides *zero-duplicate* 0.00% state consistency with <2% overhead, balancing latency vs checkpoint interval sweet spot 5s [19]; Spark Structured Streaming micro-batch WAL provides exactly-once only when sink collaborates via Delta transactional log and idempotent MERGE, otherwise risking 0.036-2.961% duplicates [12]; MillWheel per-key serialization + atomic (ID, state, productions) commit + low watermark progress delivers Internet-scale exactly-once for revenue processing at cost per-record BigTable write [5][6]; Calvin deterministic pre-ordering eliminates 2PC contention, and its adaptation Styx-on-Flink extends to arbitrary SFaaS call graphs, achieving 1 order median latency reduction, 2 orders 99p reduction at 2000 TPS over Beldi/Boki/T-Statefun with near-linear scalability to 1M keys [9][10].

The unifying principle: **exactly-once = atomic checkpointing of (input identity, mutated state, produced records) + idempotent downstream filtering + deterministic order decidability before execution**. Checkpoint blocking vs output release decoupling (deterministic protocol Fig7 vs Flink Fig6) explains latency win [10]. Future directions: post-paxos sequencing via CRDTs for geo-replicated epochs, MillWheel timers with Flink RocksDB tiered state for low-latency watermarked windows, learned checkpoint interval controllers minimizing duplicate risk adaptively, and hardware-accelerated TLA+ verification of output monotonicity $t_{last}$ invariant.

---

## References

[1] Apache Flink 1.1.5 Documentation: Data Streaming Fault Tolerance — Central part mechanism drawing consistent snapshots acting as consistent checkpoints, inspired by Chandy-Lamport algorithm specifically tailored to Flink execution model. https://nightlies.apache.org/flink/flink-docs-release-1.1/internals/stream_checkpointing.html
[2] Carbone et al., Apache Flink: Stream and Batch Processing in a Single Engine. (Checkpointing section barrier alignment) and AWS Optimize checkpointing Amazon Managed Service Apache Flink applications buffer debloating unaligned checkpoints Part 2. https://aws.amazon.com/blogs/big-data/optimize-checkpointing-in-your-amazon-managed-service-for-apache-flink-applications-with-buffer-debloating-and-unaligned-checkpoints-part-2/
[3] Spark Structured Streaming concepts Azure Databricks — near real-time processing engine offers end-to-end fault tolerance with exactly-once processing guarantees using familiar Spark APIs, checkpoints store processing state enabling fault tolerance and exactly-once delivery. https://docs.azure.cn/en-us/databricks/structured-streaming/concepts
[4] Is Structured Streaming Exactly-Once? Well, it depends. Kevin Wallimann — feature only available for file sink, while Kafka sink and Foreach sink only support at-least-once, exactly-once depends on reader via _spark_metadata. https://dev.to/kevinwallimann/is-structured-streaming-exactly-once-well-it-depends-noe
[5] Whittaker, Notes on MillWheel: Fault-Tolerant Stream Processing at Internet Scale (2013) summary — computation as dynamic directed graph, per-key serialization via arbitrary user code, idempotency transparent, exactly-once via frequent checkpointing upstream backup, low watermarks bound timestamp of future records. https://mwhittaker.github.io/papers/html/akidau2013millwheel.html
[6] Yishan He, MillWheel Fault-tolerant Stream Processing at Internet Scale overview — computation input (key,value,timestamp) triple, exactly-once semantics requirement for revenue processing customers, per-key update atomically + record exactly once = same as failure-free. https://yishanhe.net/millwheel-fault-tolerant-stream-processing-at-internet-scale/
[7] Thomson et al., Calvin: fast distributed transactions for partitioned database systems. SIGMOD Conference 2012: 1-12 — deterministic ordering guarantee significantly reduces prohibitive contention costs associated with distributed transactions. https://dblp.org/rec/conf/sigmod/ThomsonDWRSA12
[8] Calvin original PDF: fast distributed transactions for partitioned database systems — scheduling of distributed transactions replication determinism design eliminating distributed commit protocols, transforming non-transactional storage into shared-nothing linearly scalable ACID. https://dev.clauneck.workers.dev/kimmaida/7-https-cs.yale.edu/homes/thomson/publications/calvin-sigmod12.pdf
[9] Styx: Transactional Stateful Functions on Streaming Dataflows (arXiv:2312.06893) — state-of-the-art transactional SFaaS Boki/Beldi/T-Statefun inefficiency via separation state storage and function logic plus locking+2PC, Styx streaming dataflow runtime ensures exactly-once execution while executing arbitrary function orchestrations serializable leveraging deterministic databases avoiding costly 2PCs one order higher throughput vs sotA. https://arxiv.org/html/2312.06893v3
[10] Delivery, consistency, and determinism: rethinking guarantees in distributed stream processing (arXiv:1907.06250) — protocol similar to transactional variation 2PC state snapshotting used in Flink [22] but critical difference output releasing agents barriers do not take part in distributed transaction because deterministic system no need wait snapshot taken to release output elements consistently, significant latency decrease. https://ar5iv.labs.arxiv.org/html/1907.06250
[11] Chandy, Lamport Distributed Snapshots: Determining Global States of Distributed Systems — distributed snapshot algorithm goal determine globally consistent state system with unreliable global clock, solving stable property detection (termination, deadlock). https://github.com/lichaojacobs/awesome-big-data/raw/refs/heads/master/docs/learning/chandy-lamport-algorithm.pdf
[12] Rmedipallycic spark-streaming-fault-tolerance — Fault tolerance benchmarking Spark Structured Streaming checkpoint strategy comparison under node failure driver failure checkpoint corruption, Flink barrier protocol eliminates silent duplicates 0.00% duplicate rate vs 0.036%-2.961% Spark strategies, throughput gap smaller expected Flink F1 54800 vs Spark B 51268 only 6.9%. https://github.com/rmedipallycic/spark-streaming-fault-tolerance
[13] Domsj streamy-db Deterministic transactional database layer on top stream processing engine adapting Calvin onto Flink/Beam — prototype scalable low latency transactional via deterministic layer. https://github.com/domsj/streamy-db
[14] Bychilie bicycle — Implements Chandy-Lamport distributed snapshots for fault tolerance, optional exactly-once delivery guarantee for Kafka sinks using two-phase commit protocol, Bicycle implements JobManager per-job CheckpointCoordinator, barriers sent to source/sink via gRPC, stateful operator serializes to FsCheckpointStorage, Kafka sink 2PC pre-commit flush on barrier ACK commit. https://github.com/bychilie/bicycle
[15] Medium Production-grade Spark Structured Streaming template Part-1 DineshRajput — Kafka→Spark→Delta Lake designed with full reliability exactly-once semantics fault tolerance schema safety idempotency, configuration shuffle partitions stateStore provider, producer idempotence vs consumer checkpoint offset atomic with micro-batch write Delta write-ahead log atomic partial write never visible. https://medium.com/@dkrajput.it/production-grade-spark-structured-streaming-template-d413afe56985 (also see streamline GitHub design exactly-once through idempotent producer + consumer offset checkpoint) https://github.com/rahulmodugula/streamline
[16] S-Store Streaming Meets Transaction Processing arXiv:1503.01143 — streaming transaction instances operate over non-overlapping atomic batches finite contiguous subsequence stream must be processed atomically, data-driven execution arrival new atomic batch causes new invocation all streaming transactions defined over corresponding stream, border transactions ingest streams interior produce output as next atomic batch. https://arxiv.org/pdf/1503.01143v1
[17] CACM An Overview of Deterministic Database Systems — component must create canonical record input to system via single thread recording order or distributed replicated append-only log via Paxos, preprocessing replaces nondeterministic code with deterministic fixed value, nondeterministic failures do not cause transaction failure typically recover recreating state at time of failure continuing all in-process transactions from that point instead aborting. https://cacm.acm.org/research/an-overview-of-deterministic-database-systems/
[18] Consistency Guarantees in Distributed Stream Processing Systems Comprehensive Analysis Scaibu Medium — empirical evidence Materialize handles 10% out-of-order events 0 deviation perfect determinism P99 latency 8ms unchanged theoretical maximum, tracking dependencies causal independence any order vs depends enforces ordering. https://scaibu.medium.com/consistency-guarantees-in-distributed-stream-processing-systems-a-comprehensive-analysis-4c49af7604ee
[19] From Kafka Streams to Flink: Why I Chose Complexity for Millisecond Latency and Real Consistency — Event-driven model vs micro-batch Flink 0-10ms minimum latency vs 5 seconds consistency (checkpoint interval), ghost duplicate combination event-driven processing + checkpoint-based state recovery + idempotent sinks = true exactly-once application level, two-layer consistency design state consistency handled via distributed snapshots Flink handles via processing timeline checkpoint barrier every 5s sweet spot (>1s overhead ~10% CPU plus RocksDB flush pressure, <30s recovery 30-60s), transaction UPSERT same record no duplicate. https://medium.com/@adams-chang/from-kafka-streams-to-flink-why-i-chose-complexity-for-millisecond-latency-and-real-consistency-d34fe51f6834

![MillWheel Low Watermark Timer Aggregation](/thesis/thesis-stream-txn-exactlyonce-1786329188003-2.webp)

![Deterministic Calvin Epoch Sequencing Elimination of 2PC](/thesis/thesis-stream-txn-exactlyonce-1786329188003-3.webp)
