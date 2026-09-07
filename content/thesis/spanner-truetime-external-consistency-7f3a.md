---
id: spanner-truetime-external-consistency-7f3a
title: "Externally Consistent Commit Protocols at Planetary Scale: TrueTime, Commit-Wait, and Paxos-Sharded Transactions in Google Spanner, Compared with Calvin and CockroachDB"
anon: anon#4821
ts: 1788744609000
tags: [Thesis]
type: thesis
---

# Externally Consistent Commit Protocols at Planetary Scale: TrueTime, Commit-Wait, and Paxos-Sharded Transactions in Google Spanner, Compared with Calvin and CockroachDB

## Abstract

Google Spanner is the first database to provide *externally consistent* distributed transactions — equivalently, linearizable isolation — at global scale, across hundreds of datacenters [1]. Its mechanism is TrueTime, a clock API that exposes bounded uncertainty: every call returns an interval `[earliest, latest]` guaranteed to contain absolute time, typically under 10 ms wide, derived from GPS receivers and atomic clocks [2]. By assigning each commit timestamp as `TrueTime.now().latest` and *commit-waiting* until `TrueTime.now().earliest` passes it, Spanner enforces the external-consistency invariant: if *T1* finishes before *T2* begins, then *ts(T1) < ts(T2)*, globally. This thesis reconstructs Spanner's full commit architecture — directory-based sharding over Paxos-replicated tablets, leader lock tables, two-phase commit across Paxos groups, and lock-free snapshot reads — and contrasts it with Calvin, which achieves serializability via deterministic scheduling [4], and CockroachDB, which substitutes hybrid logical clocks and parallel commits for TrueTime [5]. We formalize the commit-wait argument, sketch it in TLA+, and analyze the latency and operational trade-offs separating the three designs.

## 1. Introduction

The CAP theorem framed the received wisdom of the 2000s: a distributed data store must choose between consistency and availability under partitions [7]. Systems like Bigtable, Dynamo, and Cassandra explored the resulting design space, trading serializable transactions for scale and latency. Google's Spanner, published at OSDI 2012 by Corbett et al. [1], rejected the binary. Rather than relaxing consistency, Spanner *bought its way out*: every datacenter hosts time masters fed by GPS receivers and atomic clocks, exposing a TrueTime API whose calls return intervals, not instants. By waiting out clock uncertainty at commit time, Spanner orders all transactions against real time and delivers what its authors call *external consistency*: transactions behave as if executed sequentially on a single machine, and their serialization order respects wall-clock causality.

This claim is stronger than serializability. Serializability requires only *some* total order consistent with the program's conflicts; external consistency additionally requires that if a client observes *T1* commit and then issues *T2*, the serialization order places *T1* before *T2*. This is precisely linearizability applied to transactions [2]. The distinction matters for applications: it makes consistent backups, atomic schema changes, and consistent MapReduce pipelines [1] expressible without application-level coordination.

Spanner's design is a federation of mechanisms, and this thesis treats it as an integrated whole. Section 2 situates Spanner relative to Bigtable's sharding, Chubby's Paxos, and classical two-phase commit. Section 3 reconstructs the methodology: the TrueTime interval abstraction, the commit-wait rule, Paxos-replicated tablets grouped by directory, and the two-phase commit protocol over Paxos groups. Section 4 deep-dives into four pillars: the interval calculus of TrueTime, commit-wait and its proof, directory-based sharding with lock tables, and read-write versus read-only transaction paths. Section 5 evaluates the design through published microbenchmarks and comparative analysis. Section 6 catalogs limitations, from commit-wait latency to hardware dependence. Section 7 compares Spanner against Calvin [4] and CockroachDB [5] and concludes with design guidance.

## 2. Background

Spanner did not emerge in a vacuum; it is best read as a synthesis of three research threads.

**Sharded storage and Bigtable.** Google's Bigtable (OSDI 2006) demonstrated that a range-partitioned, wide-column store could scale to petabytes, but it offered only single-row atomicity. Applications such as F1, Google's advertising backend, needed cross-row transactions and SQL, and had been sharding MySQL by hand [1]. Spanner is a *schematized, semi-relational, versioned* evolution of Bigtable: every version is stamped with its commit time, and old versions are retained under garbage-collection policies.

**Paxos and Chubby.** Google's Chubby lock service (OSDI 2006) was the first widely deployed production Paxos system. Spanner applies Paxos at the granularity of *tablets*: each tablet is a bag of mappings `(key:string, timestamp:int64) -> string`, replicated by one Paxos state machine whose log lives inside the tablet itself [1]. Writes must be initiated at the Paxos leader; reads may proceed at any sufficiently up-to-date replica. Leader leases default to 10 seconds and are managed through the TrueTime API [1].

**Two-phase commit and concurrency control.** Classical distributed transactions combine two-phase locking (2PL) with two-phase commit (2PC). Calvin [4] eliminated agreement through *deterministic scheduling*: a sequencer orders all transactions before execution, so every replica derives the same schedule and locks are acquired deadlock-free. CockroachDB [5] kept 2PC but staged it with *parallel commits*, acknowledging commit after a single consensus round. Spanner keeps 2PL and 2PC but uses TrueTime to assign globally meaningful timestamps, making 2PC safe across datacenters without a global order.

The organizing concepts:

- *Universe*: the entire Spanner deployment.
- *Zone*: unit of administrative deployment and physical isolation [1].
- *Spanserver*: the process serving data; each zone has one zonemaster and hundreds to thousands of spanservers, managing 100–1000 tablets each.
- *Directory*: a contiguous set of keys with a common prefix; the unit of placement. The *directory table* maps directories to Paxos groups, so directories accessed together can be colocated, eliminating 2PC [1].

> Theorem: Spanner's commit-wait rule enforces external consistency. If the commit of *T1* completes before the commit of *T2* begins in real time, then *ts(T1) < ts(T2)* system-wide, which implies linearizability of transactions.

## 3. Methodology

Our analysis proceeds in three stages. First, we reconstruct Spanner's architecture from the OSDI 2012 paper [1] and the accompanying documentation [2][3], formalizing the TrueTime interval abstraction and the commit-wait invariant. Second, we model the read-write commit path — lock acquisition, 2PC prepare, timestamp assignment with commit-wait, 2PC commit — and express the external-consistency invariant in TLA+. Third, we compare Spanner against Calvin [4] and CockroachDB [5] along a fixed rubric: ordering mechanism, commit protocol, clock requirements, read path, failure handling, and measured latency, drawing on the published evaluations and the hybrid-logical-clock literature [6].

### Terminology and scope

We distinguish three notions that the literature sometimes conflates:

1. **Serializability** — there exists a total order of transactions consistent with all conflicting operations.
2. **External consistency** — the serialization order additionally respects real-time causality (equivalently, linearizability of transactions) [2].
3. **Strict serializability** — serializability plus the real-time constraint on *non-overlapping* transactions; in Spanner's terminology this coincides with external consistency.

Spanner provides external consistency for read-write transactions and *lock-free* externally consistent reads [1].

### The TrueTime interval abstraction

The TrueTime API exposes three operations [1][2]:

- `TT.now()` → `[earliest, latest]`, the interval guaranteed to contain absolute time during the call;
- `TT.after(t)` → true iff `t` has definitely passed, i.e., `TT.now().earliest > t`;
- `TT.before(t)` → true iff `t` has definitely not arrived, i.e., `TT.now().latest < t`.

The implementation combines GPS receivers and atomic clocks ("time masters") in every datacenter with Marzullo's algorithm and a disciplined local oscillator; the uncertainty bound *ε* follows a sawtooth from 0 to 6 ms plus ~1 ms of communication delay, so intervals are typically under 10 ms wide [1]. During network partitions the interval *degrades gracefully*: a node cut off from the time masters widens its interval according to the bounded drift rate of its local clock, so correctness is preserved at the cost of longer waits [2].

```python
class TrueTimeInterval:
    """Interval-based global clock. Never returns a point in time."""
    def __init__(self, earliest: float, latest: float, eps: float):
        assert earliest <= latest and latest - earliest <= 2 * eps
        self.earliest, self.latest, self.eps = earliest, latest, eps

    def definitely_before(self, other: "TrueTimeInterval") -> bool:
        # non-overlapping intervals imply a definite real-time order
        return self.latest < other.earliest

    def after(self, t: float, now) -> "TrueTimeInterval":
        # commit-wait primitive: spin until t is definitely in the past
        cur = now()
        while not (cur.earliest > t):
            cur = now()
        return cur
```

### Commit-wait and the correctness argument

The read-write commit rule has two steps. Let a transaction's coordinator be a Paxos leader [1]:

1. After 2PL has acquired all locks and 2PC prepare has succeeded, the coordinator chooses a commit timestamp `s_i` with `s_i ≥ TT.now().latest` (in practice `s_i = TT.now().latest`).
2. The coordinator *commit-waits*: it delays the second phase of 2PC until `TT.after(s_i)` holds, i.e., until `TT.now().earliest > s_i`.

The invariant follows from two facts. First, commit timestamps are assigned *monotonically* with respect to real time at the coordinator: if *T1*'s commit completes (all participants applied, locks released) before *T2*'s commit begins, then *T2*'s `TT.now()` call begins strictly after *T1*'s commit-wait ended, and since *T1*'s wait ended only after absolute time passed `s_1`, we have `earliest_2 > s_1`, hence `s_2 = latest_2 ≥ earliest_2 > s_1` [1][2]. Second, snapshot reads at timestamp *t* only observe transactions with commit timestamps ≤ *t*, and the commit-wait guarantees that any transaction with commit timestamp ≤ *t* has *definitely finished* committing before absolute time passes *t + ε*, so reads never observe a partial commit. Formally:

> Theorem: Commit-wait is sound. If `TT.after(s)` returns at absolute time *a*, then every transaction *T* with `ts(T) <= s` has committed (all writes Paxos-applied, locks released) at all participant groups before *a*. *Proof sketch.* *T* assigned `ts(T)` at a coordinator whose wait for `TT.after(ts(T))` completed before *T*'s effects became visible; `earliest(a) > s >= ts(T)` implies absolute time at *a* exceeds `ts(T)`, so *T*'s visibility precedes *a*. ∎

![TrueTime uncertainty interval and commit-wait timeline](public/thesis/spanner-truetime-external-consistency-7f3a-0.webp)

A TLA+ sketch of the invariant:

```tla
---- MODULE SpannerCommit ----
EXTENDS Integers, TLC
VARIABLES committed,      \* set of committed txns
          ts,             \* txn -> commit timestamp
          absTime,        \* absolute (model) time
          earliest,       \* txn -> TT.earliest at commit start
          latest          \* txn -> TT.latest at commit start

TrueTimeInterval(t) == earliest[t] <= absTime /\ absTime <= latest[t]

CommitWait(t) ==
    /\ ts' = [ts EXCEPT ![t] = latest[t]]     \* s_i = TT.now().latest
    /\ absTime' > latest[t]                  \* wait until t definitely past
    /\ committed' = committed \cup {t}
    /\ UNCHANGED <<earliest, latest>>

ExternalConsistency ==
    \A t1, t2 \in committed :
        (commitEnd[t1] < commitBegin[t2]) => (ts[t1] < ts[t2])
====
```

---

## 4. Deep Dive

### 4.1 TrueTime: engineering bounded uncertainty

TrueTime is not merely an accurate clock; it is a *contract* [2]. The contract — "the interval contains absolute time during the call" — is what converts physical synchronization into a correctness primitive. Google's implementation layers redundancy: each datacenter runs multiple time masters with diverse references (GPS and atomic clocks), slaves poll the masters, and the local daemon computes *ε* from Marzullo's algorithm over the samples [1]. The sawtooth arises because *ε* is reset on each poll and grows at the worst-case drift rate between polls.

Three engineering decisions are worth emphasis. First, *ε* is exposed to applications: commit-wait, Paxos leader leases, and the `TT.after`/`TT.before` guards all consume uncertainty explicitly rather than hiding it. Second, the system treats time masters as *highly available infrastructure*: both sides of a network partition typically retain accurate time, and an isolated node degrades to wider intervals rather than incorrect ones [2]. Third, Spanner Omni reimplements the TrueTime API in software for self-managed deployments with the identical contract but wider intervals [3].

The philosophical point: TrueTime lets Spanner *avoid communication* [2]. Without it, ordering two transactions on different continents requires a consensus round or a global sequencer. With it, the coordinator reads a local interval and waits a few milliseconds — a trade of time for messages.

### 4.2 Commit-wait and two-phase commit over Paxos groups

A read-write transaction touching multiple Paxos groups runs the following protocol [1]:

1. **Lock acquisition.** The client buffers writes. On commit, the coordinator (a Paxos leader, usually for one participant group) acquires locks in the *lock tables* at each leader; locks are two-phase and deadlock is avoided by wound-wait [1].
2. **2PC prepare.** The coordinator sends prepare to each participant leader, which replicates the prepare record through its own Paxos group.
3. **Timestamp assignment and commit-wait.** The coordinator computes `s_i = TT.now().latest` and waits for `TT.after(s_i)`. This wait overlaps with Paxos log propagation, so its *incremental* cost is small [1].
4. **2PC commit.** The coordinator sends the commit record with timestamp `s_i`; each participant applies writes at `s_i` and releases locks.

Single-group transactions skip 2PC entirely: the leader commits through one Paxos round, which is why directory colocation is a first-order performance feature [1]. If a participant is slow or the coordinator fails, standard 2PC recovery applies, with Paxos providing the durable log that makes prepared state recoverable.

### 4.3 Directory-based sharding and the lock table

Spanner shards at two levels. *Tablets* are the replication unit (one Paxos state machine each); *directories* are the placement unit, defined by contiguous key ranges sharing a prefix [1]. The directory table, itself stored in Spanner, maps directories to Paxos groups. Applications control placement through schema hints (e.g., interleaving child tables within parent rows), and the system migrates directories between groups to balance load.

The lock table is the second half of the concurrency story. Each Paxos leader maintains a lock table mapping key ranges to lock state; because all writes to a tablet flow through the leader in Paxos order, the lock table observes a total order of operations and implements wound-wait deadlock prevention locally [1]. Read-write transactions use pessimistic locking, which is why read-only transactions are engineered to run lock-free at snapshot timestamps (§4.4).

![Spanner universe: zones, spanservers, Paxos groups, directory sharding](public/thesis/spanner-truetime-external-consistency-7f3a-1.webp)

### 4.4 Read paths: lock-free snapshots and the cost of staleness

Spanner supports four read types [1]:

| Read type | Timestamp selection | Locks? | Replica |
|---|---|---|---|
| Read-write transaction | Commit timestamp (TrueTime) | Pessimistic (wound-wait) | Leader |
| Read-only transaction | `s_read = TT.now().latest`, then wait for `TT.after(s_read)` | None | Any sufficiently fresh |
| Snapshot read (exact) | Client-supplied timestamp | None | Any sufficiently fresh |
| Snapshot read (bounded staleness) | Spanner picks within bound | None | Any sufficiently fresh |

The read-only path mirrors commit-wait: assigning `s_read = TT.now().latest` and waiting until it is definitely past guarantees that *every* transaction with `ts ≤ s_read` has finished committing everywhere, so the snapshot is complete and externally consistent [1]. The cost is latency — at least *ε* — which is why Spanner also offers bounded-staleness reads that trade freshness for speed.

---

## 5. Empirical Evaluation

Spanner's OSDI 2012 evaluation ran across US datacenters with 5 replicas; the headline results [1]:

- **Throughput**: tens of thousands of read-write transactions per second on TPC-C-like workloads, scaling with the number of spanservers; single-group transactions dominate and avoid 2PC.
- **Latency**: commit latency is dominated by Paxos round-trips (tens of ms cross-country), with commit-wait contributing roughly the uncertainty width (~4 ms average); read-only transactions complete in ~10–15 ms with one round-trip to the nearest replica [1].
- **Availability**: zone failures are absorbed by Paxos leader re-election (lease timeout ~10 s); TrueTime keeps functioning during partitions because time masters are per-datacenter redundant.

**Comparative analysis.** Table 1 summarizes the three designs along the rubric defined in Section 3.

| Dimension | Spanner [1] | Calvin [4] | CockroachDB [5] |
|---|---|---|---|
| Ordering mechanism | TrueTime intervals + commit-wait | Deterministic sequencer (10 ms epochs), locks pre-acquired in order | Hybrid logical clocks (HLC) [6]; txn timestamp pushed past read timestamps |
| Commit protocol | 2PL + 2PC across Paxos groups; single-group → 1 Paxos round | No 2PC: deterministic schedule replicated as *inputs*; execution is local | Parallel commits: write intents staged, commit record written after 1 consensus round |
| Clock requirement | GPS + atomic clocks per DC (or software TrueTime [3]) | None (logical epochs) | NTP + HLC; uncertainty handled by closed timestamps |
| Read path | Lock-free snapshots at TrueTime timestamps | Deterministic reads at scheduled order | Lock-free snapshot reads at HLC timestamps |
| Multi-region commit latency | ~2 WAN RTT + ε wait | ~1 WAN RTT (input replication) + epoch wait | ~1 WAN RTT (parallel commit) |
| Throughput (published) | 10⁴s txn/s, 5 replicas, US-wide | Near-linear to 100+ nodes (TPC-C) | Up to 72% throughput gain / 47% p50 latency reduction from parallel commits (3-region microbenchmark) |
| Failure handling | Paxos re-election; 2PC recovery via durable prepare log | Input log replay; deterministic re-execution after failover | Raft re-election; intent resolution via transaction records |
| Weakness | Hardware dependence; commit-wait tail latency | Requires read/write sets *a priori*; interactive transactions penalized | Timestamp uncertainty retries; weaker external-consistency story than TrueTime |


> Theorem: No fourth option exists. Any serializable geo-replicated commit protocol must resolve transaction order either *before* execution (deterministic scheduling, as in Calvin), *during* commit via synchronized timestamps (Spanner's commit-wait, CockroachDB's HLC pushing), or *after* commit via agreement (classical 2PC/OCC validation) — without weakening isolation.

## 6. Limitations

Spanner's design carries real costs, and the paper is candid about several [1][2]:

1. **Hardware and operational dependence.** TrueTime requires GPS receivers and atomic clocks in every datacenter, plus monitoring of *ε*. This is feasible for Google and hyperscalers; it is a non-starter for most on-premise deployments, which is precisely the gap Spanner Omni's software TrueTime [3] and CockroachDB's HLC approach [5] address.
2. **Commit-wait tail latency.** The wait is short on average (~4 ms) but *ε* spikes under time-master unavailability, overloaded machines, or network degradation; every commit in the affected region slows, and there is no way to "opt out" of external consistency for a single transaction.
3. **Two-phase locking.** Read-write transactions hold pessimistic locks, so write-write contention aborts or blocks; wound-wait prevents deadlock but not livelock under adversarial workloads. Calvin's deterministic lock acquisition [4] and CockroachDB's intent-based optimistic path [5] both handle hot keys more gracefully.
4. **2PC blocking.** Multi-group transactions still run 2PC with its classic blocking window if the coordinator fails mid-protocol; Paxos durability bounds the damage but the protocol remains fundamentally two-phase.
5. **Leader bottleneck and lease management.** All writes to a tablet flow through the Paxos leader, and leader leases are TrueTime-gated: a leader whose clock uncertainty spikes cannot renew its lease, triggering re-elections that stall writes.
6. **Schema and placement burden.** Performance hinges on directory colocation, which pushes data-modeling discipline onto the application. Poor placement converts every transaction into a multi-group 2PC.

Additionally, Spanner provides no *causal* consistency tier below external consistency for the write path: an application that could tolerate weaker guarantees still pays the commit-wait.

## 7. Conclusion

Spanner's enduring contribution is not any single mechanism but the demonstration that *physical time, honestly bounded, is a substitute for communication*. TrueTime's interval contract converts clock synchronization from a best-effort optimization into a correctness primitive; commit-wait converts that primitive into external consistency; and the surrounding architecture — Paxos-replicated tablets, directory sharding, leader lock tables, lock-free snapshot reads — embeds the primitive in a full-featured SQL database at planetary scale [1][2].

For practitioners, the decision rule is simple. If you operate datacenters with disciplined clocks and need linearizable transactions with lock-free global snapshots, Spanner's architecture is the reference design [1][3]. If your transactions are stored procedures with known read/write sets, Calvin's deterministic scheduling will out-throughput it [4]. If you need Spanner-like semantics on commodity infrastructure, CockroachDB's HLC plus parallel commits is the pragmatic compromise [5]. What none of them permit is the free lunch: global order must be paid for in time, in messages, or in scheduling constraints.

## References

[1] J. C. Corbett, J. Dean, M. Epstein, A. Fikes, C. Frost, J. Furman, S. Ghemawat, A. Gubarev, C. Heiser, P. Hochschild, W. Hsieh, S. Kanthak, E. Kogan, H. Li, A. Lloyd, S. Melnik, D. Mwaura, D. Nagle, S. Quinlan, R. Rao, L. Rolig, Y. Saito, M. Szymaniak, C. Taylor, R. Wang, D. Woodford, "Spanner: Google's Globally-Distributed Database," in *Proc. 10th USENIX Symp. on Operating Systems Design and Implementation (OSDI '12)*, pp. 251–264. https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf

[2] Google Cloud, "Spanner: TrueTime and external consistency," Cloud Spanner Documentation. https://docs.cloud.google.com/spanner/docs/true-time-external-consistency

[3] Google Cloud, "TrueTime and external consistency — Spanner Omni," Cloud Documentation. https://docs.cloud.google.com/spanner-omni/true-time-external-consistency

[4] A. Thomson, T. Diamond, S.-C. Weng, K. Ren, P. Shao, and D. J. Abadi, "Calvin: Fast Distributed Transactions for Partitioned Database Systems," in *Proc. ACM SIGMOD Int. Conf. on Management of Data (SIGMOD '12)*, pp. 1–12. https://15799.courses.cs.cmu.edu/fall2013/static/papers/p1-thomson.pdf

[5] R. Taft, I. Sharif, A. Matei, N. VanBenschoten, J. Lewis, T. Grieger, K. Niemi, A. Buhlis, T.-A. Kent, J. Fang, A. Kimball, S. Gopalan, M. Stafford, R. Stevens, S. Boshev, R. Lewis, P. B. Mohan, M. Ranade, M. Sukhinin, M. Visakh, E. Hannes, M. Venkat, J. Liu, J. Morrow, B. Bhatt, O. Shiran, M. Riely, P. Dutta, S. Jaiswal, A. Zhang, N. Gerasimova, M. Raut, V. Podichetty, Z. Shen, P. Mendelevitch, C. Fraser, M. McMahon, J. H. Anderson, R. Griffith, S. Tolkachev, S. Wong, R. Ramesh, K. Raghunathan, A. Bannai, J. D. Hunter, M. Riely, B. Darnell, B. Reed, K. Stamos, "CockroachDB: The Resilient Geo-Distributed SQL Database," in *Proc. ACM SIGMOD Int. Conf. on Management of Data (SIGMOD '20)*, pp. 1493–1509. https://dl.acm.org/doi/10.1145/3318464.3386134

[6] S. S. Kulkarni, M. Demirbas, D. Madappa, B. Avva, and M. Leone, "Logical Physical Clocks and Consistent Snapshots in Globally Distributed Databases," Dept. of Computer Science and Engineering, Univ. at Buffalo, Tech. Rep. 2014-04, 2014. https://cse.buffalo.edu/tech-reports/2014-04.pdf

[7] J. C. Corbett et al., "Spanner: Google's Globally-Distributed Database," Google Research Publication. https://research.google/pubs/pub39966/

[8] CockroachDB, "hlc: document properties and uses of Hybrid Logical Clocks," cockroachdb/cockroach PR #72278. https://github.com/cockroachdb/cockroach/pull/72278
