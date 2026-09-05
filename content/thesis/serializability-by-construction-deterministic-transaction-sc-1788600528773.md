---
{
 "id": "ths_1788600528773_4034",
 "title": "Serializability by Construction: Deterministic Transaction Scheduling from Calvin to Aria \u2014 Total-Order Execution, Agreement Without Two-Phase Commit, and the FaunaDB/CalvinFS Lineage",
 "anon": "anon#5759",
 "ts": 1788600528773,
 "type": "thesis",
 "images": [
  "ths_1788600528773_4034-0.webp",
  "ths_1788600528773_4034-1.webp",
  "ths_1788600528773_4034-2.webp",
  "ths_1788600528773_4034-3.webp"
 ]
}
---

# Serializability by Construction: Deterministic Transaction Scheduling from Calvin to Aria — Total-Order Execution, Agreement Without Two-Phase Commit, and the FaunaDB/CalvinFS Lineage

## Abstract

Traditional distributed databases purchase serializability with agreement: two-phase commit (2PC) across partitions, distributed deadlock detection, and locks held across network round trips whose latency dwarfs local execution time. Deterministic database systems invert this bargain by fixing a *total order* over transactions before execution begins, then executing that order deterministically everywhere. This thesis develops a rigorous account of serializability-by-construction in the Calvin lineage: Calvin's sequencer–scheduler–execution pipeline with epoch batching and deterministic locking [1]; the elimination of distributed commit protocols through input (rather than effect) replication; FaunaDB's Calvin-inspired unified-consensus log delivering strict serializability without atomic clocks [5]; CalvinFS's application of deterministic transactions to WAN-replicated file-system metadata [3]; and Aria's batch execution with deterministic reordering, which removes Calvin's requirement that read/write sets be known in advance [4]. We compare message complexity against 2PC analytically, sketch serializability proofs for each design, and delineate the fundamental limitations of deterministic scheduling: epoch latency, hotspot contention, and the treatment of nondeterminism.

## 1. Introduction

Distributed transaction processing has been dominated for five decades by a single architectural template: execute optimistically or under locking, then force *agreement* about the outcome through an atomic commit protocol. Two-phase commit (2PC), and its Paxos-hardened descendants, require every participating partition to vote before any lock may be released; a single slow participant stalls the transaction, and coordinator failure converts a performance problem into an availability outage [6]. The contention footprint of a distributed transaction — the interval during which it holds locks and blocks others — is dominated not by the few microseconds of local execution but by the milliseconds of agreement round trips [1].

Deterministic database systems attack this cost at its root. Their central insight is that *agreement is unnecessary if every replica independently reaches the same conclusion*. If all replicas observe the same totally ordered log of transaction inputs and apply the same deterministic execution function, they converge to identical states without a single vote, lock escalation, or commit round [1][4]. Serializability ceases to be a property that must be *checked* at commit time and becomes a property that is *constructed* by the execution order itself.

This thesis traces the deterministic-scheduling paradigm through its canonical instantiations. We begin with **Calvin** (Thomson et al., SIGMOD 2012), the system that made determinism practical for partitioned, disk-backed databases [1][2]. We analyze how Calvin's three-layer architecture — sequencer, scheduling, and execution — guarantees that a global order established *before* lock acquisition is faithfully realized *during* execution, even under concurrent thread scheduling and disk stalls [7]. We then examine two industrial descendants: **FaunaDB**, whose unified-consensus transaction log provides strict serializability across regions without Spanner-style atomic clocks [5], and **CalvinFS**, which demonstrates that deterministic transactions scale beyond databases into consistent WAN-replicated file-system metadata [3]. Finally, we study **Aria** (Lu et al., VLDB 2020), which removes Calvin's most restrictive assumption — advance knowledge of read/write sets — through batch execution and deterministic reordering [4].

> **Theorem (Deterministic Serializability, informal):** *Let L be a total order over a set of transactions T, and let each replica execute T deterministically, acquiring locks in an order consistent with L and applying writes only after all of L's predecessors are complete. Then every replica's final state equals the state produced by serial execution of T in order L; the execution is conflict-serializable.*

The remainder of this thesis formalizes this claim, surveys the mechanisms that realize it, quantifies the agreement cost it eliminates, and confronts its limits.

---

## 2. Background

### 2.1 The cost of agreement-based serializability

In a conventional partitioned database, a transaction spanning *k* partitions must coordinate its commit across all of them. Two-phase commit demands a prepare round (all partitions durably record their vote) followed by a commit round; running 2PC over per-partition Paxos, as in Spanner-derived systems, compounds this to *two sequential rounds of consensus*, each costing one or more wide-area round trips [6]. Worse, 2PC's latency is not merely additive to throughput — it is multiplicative with contention: locks acquired before the prepare phase are held throughout agreement, so every distributed transaction's contention footprint spans the full WAN latency, often two orders of magnitude longer than its local execution [1].

Optimizations (presumed abort, read-only shortcuts, early prepare) reduce the *latency* of commit but do not shrink the *contention footprint*, which is what limits throughput under contention [1]. This is the fundamental asymmetry deterministic scheduling exploits: agreement protocols serialize at commit time, after locks are held; determinism serializes *before* locks are ever acquired.

### 2.2 Determinism as a coordination substitute

A deterministic database separates *ordering* from *execution* [1]. Transactions arrive at a **sequencer** layer that assigns each a globally consistent position in a total order, batching them into **epochs** (Calvin uses ~10 ms batches). A **scheduling** layer then analyzes each epoch's read/write sets and performs **deterministic locking**: a scheduler thread scans the epoch and acquires, for every transaction, locks on all variables in its read/write set *before* execution begins, in an order consistent with the sequencer order [7]. Because locks are granted in sequencer order and held only during purely local execution, thread scheduling can never reorder the effective execution order. Finally, an **execution** layer of worker threads runs the epoch's transactions — possibly distributed across partitions, with active participants executing logic and passive participants serving remote reads [7].

Two consequences follow. First, **replication becomes input replication**: replicas need only agree on the ordered *input* log, not on execution *effects*, since deterministic execution of identical inputs yields identical states. This admits active replication and trivial crash recovery by log replay [1]. Second, **no distributed commit protocol is required**: there is nothing to vote on, because the outcome is a pure function of the ordered input.

### 2.3 The read/write-set problem

Classical deterministic systems require advance knowledge of each transaction's read and write sets — the scheduler cannot deterministically lock what it does not know [1][4]. Transactions whose access sets depend on values they read (*dependent transactions*) are not natively supported; Calvin addresses them with **Optimistic Lock Location Prediction (OLLP)**, a cheap reconnaissance query that discovers the access set before the real transaction is sequenced [1]. Later systems (Aria, Bohm, PWV) attack the restriction more fundamentally, as §4.5 discusses [4].

---

## 3. Methodology

Our investigation proceeds on three tracks. **(i) Architectural analysis:** we reconstruct the Calvin pipeline from the primary paper and secondary lecture materials, formalizing the sequencer–scheduler–executor contract [1][7]. **(ii) Analytical comparison:** we derive message-complexity and contention-footprint models for 2PC-over-consensus versus deterministic ordering, parameterized by partition count *k*, replica count *r*, and WAN round-trip time *δ*. **(iii) Lineage study:** we examine how Calvin's principles were adapted in FaunaDB's unified-consensus log [5][6], CalvinFS's metadata layer [3], and Aria's batch execution [4], identifying which assumptions each design relaxes and at what cost. We restrict empirical claims to results reported in the primary papers, avoiding synthetic benchmarks of our own; where quantitative comparison is offered, it is clearly labeled as an analytical model, not a measurement.

> **Definition (Deterministic execution):** *A database execution is deterministic iff the final state is a pure function of the ordered transaction input log — i.e., any two replicas that observe the same input order and start from the same checkpoint converge to byte-identical states without inter-replica communication during execution.*

---

## 4. Deep Dive

### 4.1 Calvin: the sequencer–scheduler–execution pipeline

Calvin's architecture comprises three layers, each replicated and each without a single point of failure [1]:

1. **Sequencer layer.** Client requests arrive at sequencer nodes, which assign a global order and batch transactions into epochs (~10 ms). The sequencer handles nondeterminism explicitly: operations like `RAND()` or `TIME` are resolved to constants at sequencing time so that downstream execution is a pure function [7]. For disk-resident records, the sequencer injects an artificial delay before forwarding, while storage components pre-warm the records — disk latency is thereby removed from the transaction's contention footprint without changing total latency [1].

2. **Scheduling layer.** Scheduler threads receive each epoch and perform read/write-set analysis. A deterministic lock manager acquires locks for all transactions in the epoch *ahead of execution*, in sequencer order [7]. This is the mechanism that makes thread scheduling irrelevant: with all locks pre-acquired in total order, no interleaving of worker threads can produce an execution inconsistent with the sequenced order.

3. **Execution layer.** Worker threads execute a five-phase protocol: (a) read/write-set analysis identifying partition locality and active vs. passive participants; (b) local reads; (c) serving remote reads (passive participants terminate here); (d) collecting remote read results; (e) transaction logic and write application on active participants [7].

The epoch design is the linchpin: ordering is amortized over a batch, so the per-transaction cost of establishing the total order is small, while the 10 ms epoch imposes a modest, bounded latency floor — a deliberate throughput–latency tradeoff.

### 4.2 Replica agreement without two-phase commit

The deepest consequence of determinism is the transformation of the replication problem. In agreement-based systems, replicas must synchronize on *effects*: did partition *P* commit? In Calvin, replicas synchronize only on *inputs*: the sequencer's ordered batches, agreed upon via Paxos. Because execution is deterministic, agreement on inputs *implies* agreement on outcomes — a single round of consensus replaces the two rounds required by partitioned 2PC [6].

This yields Calvin's striking multi-consistency property: by replicating transaction inputs rather than effects, Calvin supports multiple consistency levels — including Paxos-based strong consistency across geographically distant replicas — *at no cost to transactional throughput* [1]. Cross-region replicas simply consume the same ordered input log with higher latency; local throughput is unaffected because execution never waits for remote acknowledgment. Contrast this with Spanner-derived designs, where every multi-partition transaction pays two consensus rounds, and where a single slow partition (e.g., one undergoing leader election) stalls the entire transaction's commit [6].

```python
# Analytical model: WAN round trips per multi-partition transaction
# k partitions, r replicas per partition, WAN RTT = delta

def twopc_over_paxos_rounds(k, r):
    # prepare over Paxos (1 RTT to majority) + commit over Paxos (1 RTT)
    # coordinator must collect votes from ALL k partitions
    return 2  # sequential consensus rounds; locks held for both

def calvin_rounds(k, r):
    # single consensus round on the sequencer's ordered batch (inputs only)
    # execution is local and deterministic; locks held only during local exec
    return 1

# Contention footprint: 2PC holds locks across WAN agreement;
# Calvin holds locks only across local execution (microseconds, not milliseconds).
```

The table below summarizes the analytical comparison:

| Dimension | 2PC over partitioned consensus | Calvin deterministic ordering |
|---|---|---|
| Consensus rounds per txn | 2 (prepare + commit) [6] | 1 (input log only) [6] |
| Lock-holding interval | Full WAN agreement latency | Local execution only [1] |
| Slow-participant effect | Stalls commit (all must vote) [6] | None — execution is local |
| Coordinator failure | Blocks / requires recovery | No coordinator in execution path |
| Replication payload | Effects / votes | Ordered inputs [1] |
| Cross-region strong consistency | Full WAN cost per txn | No throughput cost [1] |
| Per-txn ordering cost | — | Amortized over ~10 ms epoch [1] |

### 4.3 FaunaDB: Calvinism at planetary scale

FaunaDB is the most prominent industrial realization of Calvin's ideas, built by a team including Daniel Abadi, Calvin's co-author [5]. Its transaction engine is explicitly *Calvin-inspired*: rather than Spanner-style TrueTime atomic clocks, Fauna orders all read-write transactions in a **global transaction log** agreed upon by consensus in brief increments, and every transaction's serial position in that log defines its execution order [5]. The result is **strict serializability** — log order reflects real-time processing order — for all read-write transactions, while read-only transactions are serializable with an additional *read-your-own-writes* guarantee maintained via a client-side high-watermark of the latest observed logical time [5].

The architectural payoff mirrors Calvin's: because Fauna uses a *unified* consensus log rather than partitioned per-shard consensus, committing a transaction that touches data on many machines requires only **one round of consensus**, versus the two sequential rounds demanded by 2PC-over-partitioned-consensus designs [6]. This is the decisive latency advantage of unified ordering, and it explains Fauna's ability to offer strict serializability across availability zones and region groups without specialized clock hardware.

### 4.4 CalvinFS: determinism beyond databases

Thomson and Abadi's CalvinFS (FAST 2015) demonstrates that the deterministic-transaction substrate generalizes beyond OLTP [3]. File systems — even petabyte-scale ones — conventionally centralize metadata on a single server or shared-disk architecture to preserve consistency. CalvinFS instead manages file metadata as *deterministic transactions* executed by a Calvin-style engine, partitioned across a shared-nothing cluster of independent servers and replicated across WAN-separated datacenters [3]. The metadata layer thereby inherits Calvin's properties: linearizable namespace operations, no 2PC across metadata partitions, and survival of entire datacenter outages with only small performance hiccups [3]. CalvinFS is an existence proof that deterministic scheduling is a *general coordination primitive* — anywhere a total order over operations suffices for consistency, agreement protocols can be replaced by ordered deterministic execution.

### 4.5 Aria: determinism without read/write-set omniscience

Calvin's Achilles' heel is its demand for *a priori* read/write sets [4]. **Aria** (Lu et al., VLDB 2020) removes this requirement with an execute-then-validate discipline that remains fully deterministic [4]:

- **Execution phase.** A batch of transactions executes in parallel against the *same* database snapshot; each transaction buffers its writes (and index updates) in thread-local storage, so no phantom anomalies arise from index mutation [4].
- **Commit phase.** After a barrier, a deterministic validator checks each transaction against earlier ones in TID order. A transaction aborts iff it has a write–write conflict with an earlier transaction, *or* it has both a read–write and a write–read conflict with earlier transactions — a rule proven to preclude cycles in the dependency graph [4].
- **Deterministic reordering.** Rather than aborting transactions that merely conflict in input order, Aria commits a maximal subset whose *effective* serial order is a permutation of the input — the results are serializable though not in input order [4].
- **Fallback phase.** If aborts are excessive, the aborted transactions (whose read/write sets are now known from the first execution) are re-executed in Calvin fashion [4].

Aria's two-phase structure mirrors the *order-then-execute* workflow — the sequencer still assigns TIDs and batches — but pushes concurrency control *after* execution, trading Calvin's lock pre-acquisition for speculative execution with deterministic validation [4].

```rust
// Deterministic lock ordering: the Calvin scheduler's core invariant.
// Locks for an epoch are acquired in (sequencer_order, key) order,
// so no thread interleaving can produce a cycle or an out-of-order execution.
fn acquire_epoch_locks(epoch: &[Txn]) -> Vec<LockGuard> {
    let mut requests: Vec<(u64, Key)> = epoch.iter()
        .flat_map(|t| t.read_set.iter().chain(t.write_set.iter())
            .map(move |k| (t.seq_no, k.clone())))
        .collect();
    requests.sort();            // total order: deterministic by construction
    requests.dedup();
    requests.into_iter().map(|(_, k)| lock_manager.acquire(k)).collect()
}
```

---

## 5. Empirical Results and Proofs

### 5.1 Serializability proof sketches

> **Theorem (Calvin serializability):** *Calvin's execution is conflict-equivalent to serial execution in sequencer order.*

*Proof sketch.* The scheduler acquires all locks of epoch transactions in sequencer order before any execution begins (§4.1) [7]. Hence every conflicting operation pair is ordered by lock acquisition in sequencer order, and the resulting serialization graph has edges oriented consistently with the total sequencer order — an acyclic orientation. Execution therefore admits a topological order identical to the sequencer order, i.e., it is conflict-serializable. ∎

> **Theorem (Fauna strict serializability):** *FaunaDB read-write transactions are strictly serializable.*

*Proof sketch.* Every read-write transaction occupies a position in the unified consensus log, and the log order respects real-time arrival at the ordering layer; execution applies transactions in log order [5]. Any two transactions ordered by real time are therefore ordered identically in the serial schedule — the definition of strict (linearizable) serializability. ∎

> **Theorem (Aria serializability):** *Aria's committed transactions are serializable.*

*Proof sketch.* The commit phase aborts any transaction that would introduce a write–write conflict or a combined read–write/write–read cycle with earlier transactions; the reordering rule guarantees the dependency graph over committed transactions is acyclic (proved in §5.3 of the paper) [4]. An acyclic dependency graph admits a serial order — serializability follows. ∎

### 5.2 Reported empirical behavior

The primary papers report the following (we reproduce claims, not independent measurements):

- **Calvin** scales *near-linearly on a cluster of commodity machines*, supports disk-based storage (unlike earlier deterministic prototypes), and has no single point of failure [1].
- **CalvinFS** sustains high-throughput metadata operations partitioned across a shared-nothing cluster while surviving full datacenter outages with only minor performance degradation [3].
- **Aria**'s evaluation demonstrates that removing the read/write-set requirement need not sacrifice throughput; subsequent work (Gria) reports further gains of up to **13× over Aria** on standard benchmarks via multi-version structures and auto-scaling batch sizes, confirming that deterministic validation — not locking — is the fertile ground for optimization [4].

The analytical model in §4.2 complements these reports: under WAN latency *δ*, a *k*-partition transaction's contention footprint is ≈ 2*δ* under 2PC-over-consensus versus ≈ *ε* (local execution time, *ε* ≪ *δ*) under deterministic ordering — a reduction that compounds multiplicatively with contention.

---

## 6. Limitations

Determinism is not free; it relocates complexity rather than eliminating it.

1. **Read/write-set knowledge.** Calvin's scheduler requires access sets in advance; dependent transactions need OLLP reconnaissance queries, adding a client-visible round trip and the risk of set drift between reconnaissance and execution [1].
2. **Epoch latency floor.** Batching transactions into ~10 ms epochs amortizes ordering cost but imposes a hard lower bound on latency — unsuitable for workloads demanding single-digit-millisecond commits [1].
3. **Hotspot contention.** Deterministic locking serializes conflicting transactions by construction; under extreme write contention on a single key, throughput collapses to serial execution with no optimistic escape hatch (Aria's reordering and fallback mitigate this only partially) [4].
4. **Nondeterminism must be hoisted.** Any nondeterministic operation (`RAND()`, wall-clock reads, auto-increment side effects) must be resolved at the sequencer; application code that cannot tolerate this constraint cannot run on a deterministic engine [7].
5. **No interactive transactions.** Multi-round-trip transactions that interleave client think time with database operations are fundamentally incompatible with advance ordering and deterministic replay.
6. **Recovery cost.** Input-log replication makes recovery simple (replay) but requires retaining the input log; log retention and replay time bound recovery point and time objectives.
7. **Aria's abort waste.** Speculative batch execution discards work on abort; under pathological conflict rates the fallback phase degenerates to Calvin-style execution plus one wasted pass [4].

---

## 7. Conclusion

Deterministic database systems reframe serializability from a property verified by agreement into a property constructed by ordering. Calvin showed that a sequencer–scheduler–execution pipeline with deterministic locking eliminates distributed commit protocols while scaling near-linearly [1]; FaunaDB industrialized the idea into a unified-consensus log delivering strict serializability without atomic clocks [5][6]; CalvinFS proved the substrate generalizes to WAN-replicated file-system metadata [3]; and Aria removed the read/write-set prerequisite through deterministic batch validation and reordering [4]. The analytical comparison is stark: one consensus round instead of two, locks held for microseconds instead of WAN round trips, and replication of inputs instead of effects. The remaining costs — epoch latency, hotspot serialization, and the discipline of determinism — define the frontier. As workloads grow more geo-distributed and agreement grows relatively more expensive, the deterministic paradigm's share of the design space will only widen. Serializability by construction is not a curiosity of 2012; it is the architecture that agreement-based systems are converging toward.

---

## References

[1] Alexander Thomson, Thaddeus Diamond, Shu-Chun Weng, Kun Ren, Philip Shao, and Daniel J. Abadi. "Calvin: Fast Distributed Transactions for Partitioned Database Systems." *Proc. ACM SIGMOD 2012*, pp. 1–12. https://15799.courses.cs.cmu.edu/fall2013/static/papers/p1-thomson.pdf

[2] dblp record: Thomson et al., "Calvin: fast distributed transactions for partitioned database systems." SIGMOD Conference 2012. https://dblp.org/rec/conf/sigmod/ThomsonDWRSA12

[3] Alexander Thomson and Daniel J. Abadi. "CalvinFS: Consistent WAN Replication and Scalable Metadata Management for Distributed File Systems." *13th USENIX Conference on File and Storage Technologies (FAST '15)*, pp. 1–14. https://www.usenix.org/node/188413

[4] Yi Lu, Xiangyao Yu, Lei Cao, and Samuel Madden. "Aria: A Fast and Practical Deterministic OLTP Database." *Proc. VLDB Endowment*, Vol. 13, 2020, p. 2047. http://www.vldb.org/pvldb/vol13/p2047-lu.pdf

[5] Luis Eduardo Colón. "Fauna Deep Dive: Architecting a Distributed Serverless Database." *dev.to*, Fauna. https://DEV.to/luiseduardocolon/fauna-deep-dive-architecting-a-distributed-serverless-database-307a

[6] Fauna. "Partitioned Consensus and Its Impact on Spanner's Latency." *dev.to*. https://Dev.To/fauna/partitioned-consensus-and-its-impact-on-spanner-s-latency-l8h

[7] "Calvin" lecture slides, CS 590 (Expolab). https://expolab.org/cs590-spring2017/slides/CalvinBD.pdf
