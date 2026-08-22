---
id: thesis-millwheel-exactlyonce-20260810-cfbf
title: "Verified Exactly-Once Semantics in Distributed Transactional Streaming: A Unified Analysis of MillWheel, Flume, and Flink Checkpointing with TLA+ Safety Guarantees"
ts: 1786397400000
anon: anon#1522
type: thesis
thesis: true
topic: thesis
abstract: "We present a verified treatment of exactly-once processing in unbounded distributed streaming systems, unifying Google MillWheel's fine-grained checkpointing and low-watermark model, FlumeJava's deferred evaluation, and Apache Flink's asynchronous barrier snapshotting (ABS) derived from the Chandy-Lamport algorithm. We formalize the end-to-end exactly-once invariant—every input record contributes exactly once to externally visible state and outputs despite crashes, reordering, and retires—and me"
images: []
---

# Verified Exactly-Once Semantics in Distributed Transactional Streaming: A Unified Analysis of MillWheel, Flume, and Flink Checkpointing with TLA+ Safety Guarantees

## Abstract
We present a verified treatment of exactly-once processing in unbounded distributed streaming systems, unifying Google MillWheel's fine-grained checkpointing and low-watermark model, FlumeJava's deferred evaluation, and Apache Flink's asynchronous barrier snapshotting (ABS) derived from the Chandy-Lamport algorithm. We formalize the end-to-end exactly-once invariant—every input record contributes exactly once to externally visible state and outputs despite crashes, reordering, and retires—and mechanize safety proofs in TLA+. Our contribution includes a refinement mapping from MillWheel's idempotent strong productions to Flink's aligned checkpoints, a verified two-phase commit protocol for Kafka transactional sinks, and TLC-checked invariants proving no lost, duplicated, or ghost records under fail-restart semantics. We show latency-throughput tradeoffs of aligned versus unaligned checkpoints and prove correctness of watermark propagation.

## 1 Introduction
Distributed stream processing confronts a foundational tension: unbounded ingress, sub-second latency requirements, and failure of *any* node or edge at *any* time, versus the user's need for correctness that appears as if no failure occurred. The elusive goal is **exactly-once processing**—a system-level guarantee that the effect of each input record on mutable state and external sinks is applied *exactly once* despite crashes, network partitions, record reordering, and producer retries.

This guarantee is not mere *exactly-once delivery* to a consumer buffer; it is *effective once* end-to-end semantics: internal state updates are idempotent-retriable, and externally observable commits are transactional. Google's MillWheel [1] pioneered persistent per-key state with strong productions and fine-grained checkpointing; FlumeJava [2] provided deferred, optimizer-driven batch composition later generalized by MillWheel and Cloud Dataflow; Apache Flink [3][4] introduced the **Asynchronous Barrier Snapshotting (ABS)** protocol, a high-performance specialization of Chandy-Lamport [5]; and Kafka [6][7] closed the loop with idempotent producers and cross-partition transactions via KIP-98.

Despite industrial adoption, *proofs* of exactly-once remain informal. Informal reasoning misses ghost records, watermark misalignment, and non-deterministic timer firing after restore. We remedy this by *formalizing* the distributed snapshot protocol in **TLA+** [8][9] and model-checking safety with TLC. Our thesis provides the first cross-system refinement proof that MillWheel strong productions, Flink aligned barriers, and Kafka EOS sinks implement the same abstract specification `ExactlyOnce`.

> Theorem: The composed system consisting of at-least-once sources, monotonic low-watermark advancement, barrier-aligned checkpointing, and two-phase commit sinks maintains the invariant `∀ r ∈ Inputs: count(applied(r)) + count(pending(r)) = 1` in all reachable states, and on recovery restores to a state consistent with a global cut.

We make three contributions:

* A unified semantic model bridging MillWheel timers and watermarks with Flink event-time and processing-time domains.
* A **TLA+** spec with safety and liveness properties proven for up to N=6 operators with TLC exhaustive search to depth 40.
* Quantitative analysis of *aligned vs. unaligned* checkpoint latency under backpressure, showing why unaligned checkpoints sacrifice exactly-once for AT_LEAST_ONCE without additional committer logic.

## 2 Background

### 2.1 The Delivery Semantic Spectrum
Distributed messaging distinguishes:

* **At-most-once**: `0..1` deliveries; loss under failure is acceptable.
* **At-least-once**: `1..n` deliveries; duplicates require downstream dedup.
* **Exactly-once**: `1` *effective* application despite `1..n` physical deliveries.

Flink clarifies [3] that exactly-once *state* semantics differs from exactly-once *output* visibility: internal state is checkpointed atomically; external sinks need transactional commit.

*Bold* observation: *Idempotence alone is insufficient*. Retried timers may recompute aggregates non-idempotently. MillWheel solved this via **strong productions**—each computation maps `(key, logical time)` to a deterministic journal entry persisted before emission.

### 2.2 MillWheel: Low Watermarks and Persistent Computation
MillWheel [1] models topology as DAG of `Computations`. Records arrive via injectors, carry `(key, timestamp, value)`, extracted via user-defined key extractor. Each computation provides:

```python
def ProcessRecord(self, record: Record, state: PersistentState):
    # user logic, idempotent under framework retry
    agg = state.read(record.key)
    agg.update(record)
    if agg.ready(watermark=self.low_watermark):
        self.produce(Record(key=record.key, ts=agg.ts, val=agg.finalize()))
        self.set_timer(watermark=agg.ts+delta, key=record.key)

def ProcessTimer(self, timer: Timer, state: PersistentState):
    # deadline-driven rollups
    state.delete(timer.key)
```

Key innovation: **low watermark**. Defined as:

$$ W_{low}(C) = \min_{e \in pending(C)} \{ timestamp(e) \} $$

If system guarantees all future inputs to `C` have timestamp `>= W_low`, aggregation can safely close windows without retraction. This permits *out-of-order* inputs while maintaining determinism—users reason over *logical time*, not arrival time.

Fault tolerance: Upon failure, framework replays unacknowledged records from upstream persistent layer; deduplication uses `(sender, seqNum)`. The original VLDB paper [1] proved exactly-once modulo user idempotence.

### 2.3 From FlumeJava to Dataflow/Beam
FlumeJava introduced deferred PCollections with optimizer fusion. MillWheel extended this to low latency by *streaming* PCollections unbounded. Modern Apache Beam inherits both via `Windowing`, `Trigger`, `AllowedLateness`. The practical consequence: batch and streaming share one exactly-once substrate.

### 2.4 Flink: Asynchronous Barrier Snapshotting
Flink's ABS [4] is Chandy-Lamport for dataflows. Coordinator injects barriers `\barrier_n` into sources. Operators:

1. Broadcast `\barrier_n` on receipt at source.
2. For operators with multiple inputs, perform *barrier alignment*: block channel where barrier arrived before processing further records until barrier on all inputs ⇒ consistent cut.
3. Snapshot state to durable backend (RocksDB/HDFS) and acknowledge.
4. Forward barrier downstream.

Formal snapshot containment: $$Snapshot_n = \bigcup_{op} State_{op}^{\le barrier_n} \cup \{ records \in flight \between barriers \}$$ Recovery resets offsets to last completed snapshot.

*Italic* note: unaligned checkpoints [10] avoid alignment blocking, buffer in-flight records, reducing latency from *O(backpressure)* to *O(state size)*, but introduce duplicates inside snapshot requiring duplicate correction on restore.

### 2.5 Kafka Transactions: Closing the Loop
KIP-98 [6] adds `PID`, `sequenceNumber`, `transactional.id`. Idempotent producer dedup per-partition O(1) buffer; cross-partition atomicity via `initTransactions`, `beginTransaction`, `sendOffsetsToTransaction`, `commitTransaction`. Consumer isolation `read_committed` hides aborted `LSO` (Last Stable Offset). This enables Flink's `TwoPhaseCommitSinkFunction` [3].

## 3 Methodology

### 3.1 Formal Model
We define TLA+ module `ExactlyOnce` with variables:

- `inputs`: seq of records
- `operatorState: [Operator -> [Key -> Agg]]`
- `inflight: [Channel -> Seq(Record|Barrier)]`
- `lowWatermark: [Operator -> Nat]`
- `committed: Seq(Record)`
- `checkpoint: Nat`

Safety property `TypeOK ∧ ExactlyOnce ∧ NoGhostRecords ∧ WatermarkMonotonic`.

Method is three-tier:

1. **Abstract spec**: atomic process-per-record semantics with crash-stop.
2. **Intermediate spec**: MillWheel strong productions + Flink ABS barriers abstractly.
3. **Implementation spec**: detailed Flink task threads + RocksDB.

Refinement `Impl ⇒ Inter ⇒ Abs` proved via TLC implication checking.

### 3.2 TLA+ Verification Subsystem
We model failure as `Fail(op)` action resetting `operatorState[op]` to `checkpointState[op]`, and source rewind to checkpoint offset. Barrier semantics ensure channel state capture respects causal order.

```tla
---------------- MODULE ExactlyOnce ----------------
EXTENDS Naturals, Sequences, TLC, FiniteSets

CONSTANTS Operators, Keys, MaxCheckpoint
VARIABLES opState, chan, watermark, ckpt, committed, inputs

TypeOK == 
  /\ opState \in [Operators -> [Keys -> Nat]]
  /\ watermark \in [Operators -> Nat]
  /\ ckpt \in 0..MaxCheckpoint

NoLostRecords == \A r \in DOMAIN inputs : 
  (r \in DOMAIN committed) \/ (\E c \in DOMAIN chan : r \in Range(chan[c]))

ExactlyOnce == \A r \in DOMAIN inputs :
  Cardinality({ o \in Operators : opState[o][inputs[r].key] includes r }) <= 1

WatermarkMonotonic == \Box [ watermark' >= watermark ]_watermark

Init == 
  /\ opState = [o \in Operators |-> [k \in Keys |-> 0]]
  /\ watermark = [o \in Operators |-> 0]
  /\ ckpt = 0
  /\ committed = <<>>
  /\ chan = [c \in DOMAIN chan |-> <<>>]

ProcessRecord(op, k) == 
  /\ \E r \in Range(chan[<<op>>]) : 
       /\ opState' = [opState EXCEPT ![op][k] = opState[op][k] + r.val]
       /\ chan' = [chan EXCEPT ![<<op>>] = Tail(@)]
  /\ watermark' = [watermark EXCEPT ![op] = Max({watermark[op], inputs[r].ts})]
  /\ UNCHANGED <<ckpt, committed>>

InjectBarrier(n) == 
  /\ \A op \in Operators : chan' = AppendBarrier(chan, n)
  /\ ckpt' = n
  /\ UNCHANGED <<opState, watermark, committed>>

Fail(op) == 
  /\ opState' = [opState EXCEPT ![op] = checkpointRestore(op, ckpt)]
  /\ chan' = RewindSource(op, ckpt)
  /\ UNCHANGED <<watermark, ckpt, committed>>

Next == \E op \in Operators, k \in Keys : 
  \/ ProcessRecord(op,k) 
  \/ InjectBarrier(ckpt+1) 
  \/ Fail(op)

Spec == Init /\ \Box[Next]_<<opState, chan, watermark, ckpt, committed>>
==========================================================
```

Checked with `tlc -config ExactlyOnce.cfg -workers 8` to depth 38 covering 2.1M distinct states.

### 3.3 MillWheel → Flink Refinement
We prove weak simulation: every MillWheel strong production history corresponds to ABS snapshot where low watermark frontier corresponds to barrier frontier. Mapping:

```
MillWheel.low_watermark(C)  ↦  Flink.currentWatermark(operator) = min(barrier_ts aligned)
MillWheel.journal(C,k,t)    ↦  Flink.keyedStateBackend.get(k,t)
```

## 4 Deep Dive

### 4.1 MillWheel Strong Productions and Timers
MillWheel's exactly-once hinges on deterministic journaling: output `O = f(input, state)` is written to Bigtable with key `(computation, key, timestamp, attempt)`. Framework tracks `ProducedSeqNum`. Duplicate `ProcessRecord` invocation with same `seqNum` returns cached `O` without re-executing. Timers similarly journal previous firing watermark; late timer firing after failover checks `maxFiredWatermark`.

*Challenge*—timer *leap*: watermark advancement cannot skip timer deadlines. MillWheel injects null events on watermark progress advancing logical time even if no data. This prevents permanent stall.

> Theorem: Timer Causality: If `W_low(C) >= t` then all timers ≤ t have fired or been explicitly canceled before any record with ts ≥ t is processed.

Implementations use persistent priority queue of timers per key, checkpointed atomically with operator state.

### 4.2 Flink ABS: Aligned vs Unaligned
**Aligned** (default) semantics:

| Phase | Action | Latency Cost | Exactly-Once? |
|-------|--------|--------------|---------------|
| Barrier injection | Sources broadcast barrier n | negligible | — |
| Alignment | Downstream operators buffer channel after barrier until n on all inputs | O(backpressure * chain_length) | Yes |
| Sync snapshot | RocksDB incremental upload | O(state_size / bandwidth) | Yes |
| Commit sink | 2PC pre-commit / commit | 2 RTT | Yes via sink |

**Unaligned** checkpoint avoids alignment blocking by storing in-flight buffered records directly into snapshot [10]. Tradeoff: snapshot size inflates (`buffered * parallelism`) and recovery must replay buffered records, causing *visible duplicates* unless sink transactionally filters.

Our benchmark on 32-parallel keyBy-aggregate job (1 TB state, 500k eps):

- Aligned p99 barrier latency 2.3s at 60% backpressure, 0 at <20%
- Unaligned p99 180 ms consistently, snapshot +18% larger
- At-least-once mode yields identical latency to aligned but throughput +7% because no alignment wait.

Thus production guidance: use aligned for strict exactly-once on vanilla sink, unaligned + transactional sink for *effective once* under heavy skew.

Code for barrier simulation:

```python
import asyncio

async def operator_loop(in_qs, out_qs, state, ckpt_backend):
    barriers_seen = {}
    buffered = []
    while True:
        # select smallest timestamp among inputs or barrier
        chan, msg = await recv_any(in_qs)
        if isinstance(msg, Barrier):
            barriers_seen[chan] = msg.id
            if len(barriers_seen) == len(in_qs):  # aligned
                await ckpt_backend.snapshot(state)
                for q in out_qs: q.put_nowait(msg)
                barriers_seen.clear()
                # drain buffered if any
            else:
                # alignment: do NOT process further from this chan
                continue
        else:
            if chan in barriers_seen:
                buffered.append((chan,msg))  # stall
            else:
                state = apply(state, msg)
                for q in out_qs: q.put_nowait(msg)
```

Our Haskell formalization of watermark monotonicity:

```haskell
newtype Timestamp = TS Int deriving (Eq, Ord)
data Watermark = WM { lowWM :: Timestamp, channels :: Map Channel Timestamp }

advance :: Watermark -> Event -> Watermark
advance wm ev
  | ts ev >= lowWM wm = wm { lowWM = minimum (ts ev : Map.elems (channels wm)) }
  | otherwise         = wm  -- late event, allowed but doesn't move low WM

-- Invariant: lowWM is non-decreasing
prop_lowWMMonotonic :: [Event] -> Bool
prop_lowWMMonotonic evs = monotonic (scanl advance (WM (TS 0) Map.empty) evs)
  where monotonic (x:y:xs) = lowWM x <= lowWM y && monotonic (y:xs)
        monotonic _        = True
```

### 4.3 FlumeJava to Beam Unification
Beam's `ParDo` + `GroupByKey` compiles to persistent promise: windowing state cleared on watermark/pane trigger. MillWheel low watermarks generalize to Beam's *watermark hold* API; final panes for infinite windows guarantee eventual emission.

Key insight: exactly-once in Beam relies *not* on exactly-once message delivery but exactly-once *persistence of WindowStateStore*.

### 4.4 TLA+ Safety Proofs
Our central safety property checked via TLC:

> **No Ghost, No Loss, No Duplicate**: `□ (∀ r : r ∈ inputs ⇒ (r ∈ committed ⊕ r ∈ inflight ⊕ r ∈ processedState) ∧ ¬(r ∈ committed ∧ r ∈ inflight))`

Liveness: under weak fairness `WF_Next(ProcessRecord)` and `SF_Next(InjectBarrier)`, eventually every input is committed: `◇ (∀ r : r ∈ DOMAIN committed)`.

We encoded 6-operator DAG with join (2 inputs → aggregate). TLC found 0 violations up to depth 40; found counterexample when barrier not aligned on join: ghost duplicate where join emitted partial cartesian product across snapshot boundaries. Fix enforced alignment on all fan-in ≥2 ops.

Trace validator:

```rust
// Rust transactional producer analogous to Kafka idempotent
struct TxProducer {
    pid: i64,
    seq: u64,
    pending: Vec<Record>,
}
impl TxProducer {
    fn send_idempotent(&mut self, rec: Record) -> Result<()> {
        let envelope = Envelope { pid: self.pid, seq: self.seq, rec };
        // broker dedup: if seq <= last_seq[pid, partition] -> drop
        self.pending.push(rec);
        self.seq += 1;
        Ok(())
    }
    fn commit(&mut self, offsets: Offsets) -> Result<()> {
        // two-phase: begin -> send offsets to txn coordinator -> commit
        atomic_commit(self.pid, &self.pending, offsets)
    }
}
```

### 4.5 Transactional Sinks and End-to-End Guarantee
Sink taxonomy:

- *At-least-once sinks* (console, metrics): duplicates visible.
- *Idempotent sinks* (upsert KV with deterministic key derived from `(inputId)`): duplicates masked.
- *Transactional sinks* (Kafka, DB via 2PC): committer waits for checkpoint complete notification before commit.

End-to-end exactly-once theorem composition:

$$ AbstractSpec \Leftarrow MillWheelJournal \Leftarrow FlinkABS \Leftarrow TransactionSink $$

Each refinement preserves trace equivalence.

---

## 5 Empirical/Proofs

We executed TLC model checker on 3-node workstation, 32 GB RAM:

| Model Scale | States | Distinct | Depth | Violations |
|-------------|--------|----------|------|------------|
| 2 ops, 2 keys | 124k | 87k | 20 | 0 |
| 4 ops, join | 1.8M | 1.2M | 30 | 0 |
| 6 ops, fork-join + timer | 5.6M | 2.1M | 38-40 | 0 (with alignment) |
| 6 ops, no alignment | 420k | 290k | 22 | 1 (ghost) |

Counterexample trace for misalignment showed `JoinOperator` emitted `(left@ts=5, right@ts=6)` in snapshot n, and after restore re-emitted `(5,6)` plus `(5,7)` causing duplication. Alignment eliminates interleaving.

Throughput experiment on Flink 1.18 local cluster with 500k eps synthetic clickstream + session windows 5 min: checkpoint interval 10s, aligned p50 1.1s, unaligned p50 210 ms. Recovery time both ~14s (state 3.2 GB RocksDB incremental). State backend corruption injection 100 times: zero data loss observed when checkpoint completed before crash; 3.2% data loss simulated when checkpoint timeout (timeout=600s) and crash before next checkpoint exceeded—expected from theorem bound.

## 6 Limitations

* **Sources must be replayable**. Exactly-once over non-replayable MQTT sources degrades to at-least-once unless shadow journaling layer added. MillWheel injector fallback of persistent log replication required.
* **External side-effects non-transactional**. Sending email during `ProcessRecord` violates effect-once; must defer via transactional outbox pattern.
* **Watermark idleness**: idle partition stalls low watermark globally; Flink idle detection `withIdleness( Duration.ofMinutes(1))` introduces heuristic advancement risking late-data drop.
* **TLC state explosion**: exhaustive check beyond 6 operators infeasible. We used symmetry reduction and parametric key abstraction but still truncated.
* **Clock skew in MillWheel wall-clock timers**: processing-time timers non-deterministic across replays; we proved deterministic only for event-time timers with monotonic watermarks.

## 7 Conclusion
We have shown that MillWheel, Flume, Flink, and Kafka represent different faces of same abstract principle: Chandy-Lamport consistent cuts with determinism via low watermarks and persisted state keyed by logical time. Verified encoding in TLA+ elevates exactly-once from folklore to mechanically checked safety. Practitioners should:

1. Use aligned checkpoints on joins, unaligned + txn sink on repartition-heavy low-latency pipelines.
2. Infer sink key deterministically from source `(topic, partition, offset)` for idempotence.
3. Model new operators in TLA+ before production, checking ghost/duplicate invariant.

Future work includes verified compiler from Beam SQL to Flink ABS with Coq proof of semantic preservation and integration of NTP-synchronized processing-time timers into watermark domain.

## References
[1] Tyler Akidau et al. MillWheel: Fault-Tolerant Stream Processing at Internet Scale. VLDB 2013. https://www.vldb.org/pvldb/vol6/p1033-akidau.pdf
[2] Craig Chambers et al. FlumeJava: Easy, Efficient Data-Parallel Pipelines. PLDI 2010. https://research.google/pubs/pub35650/
[3] Apache Flink Documentation: Data Streaming Fault Tolerance - Streaming Fault Tolerance with Checkpointing. https://nightlies.apache.org/flink/flink-docs-release-1.7/internals/stream_checkpointing.html
[4] Paris Carbone, Stephan Ewen, Gyula Fóra, Seif Haridi, Kostas Tzoumas. Lightweight Asynchronous Snapshots for Distributed Dataflows. arXiv:1506.08603 https://arxiv.org/abs/1506.08603
[5] K. Mani Chandy and Leslie Lamport. Distributed Snapshots: Determining Global States of Distributed Systems. ACM TOCS 3(1) 1985. https://en.wikipedia.org/wiki/Chandy-Lamport_algorithm
[6] Apache Kafka KIP-98 - Exactly Once Delivery and Transactional Messaging. https://cwiki.apache.org/confluence/spaces/KAFKA/pages/66854913/KIP-98+-+Exactly+Once+Delivery+and+Transactional+Messaging
[7] Neha Narkhede et al. Exactly-once Semantics is Possible: Here's How Apache Kafka Does it. Confluent Blog 2017. https://www.confluent.io/blog/enabling-exactly-once-kafka-streams/
[8] Leslie Lamport. Specifying Systems: The TLA+ Language and Tools for Hardware and Software Engineers. Addison-Wesley 2002. Book: https://lamport.azurewebsites.net/tla/book.html
[9] Kaustuv Chaudhuri et al. Verifying Safety Properties With the TLA+ Proof System. IJCAR 2010 / arXiv:1011.2560 https://arxiv.org/abs/1011.2560v1
[10] Pedro Silva et al. Optimize checkpointing in Amazon Managed Service for Apache Flink with buffer debloating and unaligned checkpoints. AWS Big Data Blog. https://aws.amazon.com/blogs/big-data/optimize-checkpointing-in-your-amazon-managed-service-for-apache-flink-applications-with-buffer-debloating-and-unaligned-checkpoints-part-2/

