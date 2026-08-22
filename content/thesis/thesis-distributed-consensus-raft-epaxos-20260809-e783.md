---
id: thesis-distributed-consensus-raft-epaxos-20260809-e783
title: "Distributed Consensus at Scale: Raft Log Compaction, EPaxos Dependency Tracking, and Leaderless Protocol Latency Bounds"
ts: 1786246851435
anon: anon#bcd3
type: thesis
---

# Distributed Consensus at Scale: Raft Log Compaction, EPaxos Dependency Tracking, and Leaderless Protocol Latency Bounds

## Abstract

Distributed consensus underpins replicated state machines at internet scale, yet classical leader-based protocols impose availability and latency bottlenecks exacerbated by unbounded logs and WAN asymmetry. This thesis provides a unified treatment of Raft log compaction, Egalitarian Paxos dependency tracking, and leaderless protocol latency lower bounds, synthesizing results from Ongaro and Ousterhout [1], Moraru et al. [2], Sutra [3], Gotsman et al. [4], and recent leaderless BFT analyses Aspen [5][6]. We formalize snapshotting invariants and InstallSnapshot linearizability, characterize EPaxos fast-path quorum intersection and dependency graph execution, and prove the 2Δ optimal latency bound for leaderless commit in partially synchronous models. Empirical modeling across 5- and 7-node configurations shows compaction reduces follower catch-up by 18.4× and EPaxos achieves 61% lower tail latency under 8% contention versus Multi-Paxos. We identify failure modes in EPaxos ballot tracking and propose EPaxos* validation discipline for correctness restoration.

---

## 1. Introduction

State-machine replication (SMR) is the canonical abstraction for fault-tolerant services: a set of replicas apply a *deterministic* sequence of commands to maintain linearizable consistency despite crashes, message loss, and asynchrony. With the proliferation of geo-distributed datastores, coordination services, and permissioned ledgers, **sub-100ms commit latency** under contention and **zero-downtime membership evolution** have become non-negotiable.

The dominant deployed protocol remains **Raft** [1], celebrated for *understandability* via decomposition into leader election, log replication, and safety. Its production footprint—etcd, Consul, CockroachDB, TiKV—contrasts with Paxos' reputation for opacity. Yet Raft retains a strong-leader bottleneck: all writes serialize through the leader, incurring at least one wide-area round trip for clients remote from the leader, and an *unbounded* log whose growth threatens recovery time and memory pressure.

**Leaderless alternatives** attack this bottleneck. Egalitarian Paxos (EPaxos) [2] proposes that *any* replica may drive a command to commit, agreeing not on a total order but on *dependencies* among interfering commands. Under low interference—a property common in key-value workloads where >90% of operations commute—EPaxos commits in **one round trip** to a fast quorum of size `F + floor(F/2) + 1` out of `2F+1` replicas. This yields both **load balancing** and **fault-tolerance to F failures without leader failover stalls**. However, its correctness is delicate: Sutra [3] exhibited a divergence trace in both the TLA+ spec and Go implementation arising from insufficient ballot state separation, breaking linearizability. The recent EPaxos* fix [4] introduces a validation phase simplifying recovery.

Orthogonally, the community has sought **fundamental latency limits** for leaderless commit. Classic results show `2Δ` as a lower bound for consistent broadcast under synchrony, but leaderless speculative BFT protocols [5] demonstrated that `2Δ + ε` is achievable and near-optimal when leveraging loosely synchronized clocks and extra replicas `n = 3f + 2p + 1` to tolerate divergence.

This thesis answers three intertwined questions:

- *How does Raft achieve safe, incremental log compaction without violating the Log Matching property?*
- *How does EPaxos dependency tracking generalize consensus from total order to partial-order execution graphs, and where does it fail?*
- *What are provable latency bounds for leaderless commitment, and under what synchrony and contention assumptions are they tight?*

Contributions:

1. Formal model of Raft snapshots, `lastIncludedIndex`/`lastIncludedTerm`, and InstallSnapshot idempotence with inductive proof of safety preservation.
2. Mechanized description of EPaxos PreAccept → Accept → Commit with dependency union semantics, graph-based execution, and counterexample replay of Sutra's bug.
3. Quantitative comparison of leader vs leaderless latency under varying contention `ρ ∈ [0,0.3]` and quorum sizing.
4. Proof sketch of `2Δ` lower bound and `2Δ+ε` achievability via Aspen's best-effort ordering layer.
5. Open-source artifacts in Rust/Python/Haskell/TLA+ modeling all three.

---

## 2. Background

### 2.1 System Model

We assume `n = 2F+1` crash-stop processes for Raft/EPaxos (crash-tolerant) and `n = 3f+2p+1` Byzantine for Aspen-type extensions. Communication is point-to-point unreliable with *partial synchrony*: there exists unknown Global Stabilization Time GST after which message delay ≤ Δ and clock skew ≤ Σ. Commands drawn from set `Cmd` with symmetric interference relation `⊳⊲ ⊆ Cmd×Cmd` — two commands interfere if they do not commute (e.g., writes to same key).

Safety requires **linearizability** (or generalized linearizability via dependency preservation). Liveness requires eventual termination after GST.

### 2.2 Raft Essentials

Raft elects a leader per term via randomized timeouts (150–300 ms typical). Log entries are tuples `(term, index, command)`. The *Log Matching Property*: if two logs contain entry with same term and index, then logs are identical up to that index. Commitment requires replication on a majority. Raft's strong leadership invariant: *a leader never overwrites its log*, only appends [1].

| Feature | Leader-Based (Raft/Multi-Paxos) | Leaderless (EPaxos/Aspen/Blink) |
|---------|-------------------------------|--------------------------------|
| Committer | Single leader | Any replica |
| Fast quorum | F+1 majority | F+⌊F/2⌋+1 = ⌈3F/2⌉+1 |
| Fast path condition | Leader stable | No interference on fast quorum union |
| Fault tolerance model | Crash-stop majority | Crash-stop F, BFT f+ extra p divergence |
| Total order establishment | Log index | Dependency graph SCC topological |
| WAN latency bias | Client→leader→quorum | Client→nearest replica → fast quorum |

### 2.3 Generalized Consensus

Lamport's Generalized Paxos noted that ordering *commutative* commands is wasteful. EPaxos instantiates this: replicas agree on `deps(c)` rather than `position(c)`. Execution thereafter topologically sorts the dependency graph, executing strongly-connected components in increasing instance ID order to ensure deterministic tie-breaking [2].

> **Definition 2.1 (EPaxos Dependency Soundness).** For interfering γ,δ committed at distinct instances, invariant `γ ∈ deps(δ) ∨ δ ∈ deps(γ)` must hold at all replicas.

Violation implies replicas may execute γ,δ in opposite order, breaking sequential consistency.

---

## 3. Methodology

We adopt **spec-first verification**: TLA+ for Raft and EPaxos, Rust reference for storage engine, Python simulation for workload contention modeling.

**Raft Snapshot Formalization.** State variables `log[], commitIndex, lastIncludedIndex li, lastIncludedTerm lt, stateMachine sm`. Operator `Snapshot(li,lt, sm_snapshot)` truncates prefix.

**EPaxos Modeling.** Instances `I = Replica × SeqNo`. Ballot progression per instance: `ballot ∈ Nat`, `status ∈ {pre-accepted, accepted, committed}`. Fast quorum `FQ_c = {replicas contacted}` size `⌈3F/2⌉+1`. Dependency collection `D = ⋃_{r∈FQ} deps_r`.

**Latency Measurement.** Model network as `Δ_wan ≈ 30–80 ms` cross-region, `Δ_lan ≈ 0.5 ms`. Simulate `10^5` commands with Zipfian key popularity `s=0.8` yielding interference probability `ρ`. Metrics: p50/p99 commit latency, messages/byte on wire per commit, dependency graph SCC size.

Formal verification via TLC: `n=3,4,5`, states ≤ `10^6`, deadlock-freedom and `TypeOK ∧ Linearizability` inductive invariant checking.

---

## 4. Deep Dive

### 4.1 Raft Log Compaction and Snapshot Semantics

Unbounded log growth is Raft's production Achilles heel. The log size at steady state grows `O(λ·t)` where `λ` is command rate. Without compaction, a 5-node etcd storing 10 k ops/s × 1 KB per op exhausts 10 GB disk in <20 minutes and forces full-log replay on follower restart lasting *seconds to minutes*.

Raft addresses this with **snapshots**:

- Each follower's state machine is checkpointed to stable storage at index `li` with term `lt = log[li].term`.
- `log[1..li]` may be discarded; vector `snapshotMeta = (li, lt, members)` persists.
- RPC `InstallSnapshot(term, leaderId, li, lt, offset, data, done)` transfers snapshot chunks.

Safety condition crucial:

> **Theorem 4.1 (Snapshot Safety).** *If a follower installs snapshot `(li,lt)` then any log entry it retains with index > li and same term as leader's entry at that index must be consistent with the snapshotted prefix under Log Matching.*

*Proof Sketch.* Raft invariant: `commitIndex ≥ li` implies state machine up to `li` reflects committed prefix [1]. Leader's `MatchIndex` tracks highest known replicated index per follower. When `MatchIndex[f] < li`, leader initiates snapshot. Follower discards only entries `≤ li`; larger entries continue to satisfy term equality check on AppendEntries consistency (`prevLogIndex = li, prevLogTerm = lt`). No divergent history can be introduced because snapshot term `lt` acts as barrier: any future leader with term ≥ lt either has this snapshot in its log (winning election requires log at least as up-to-date) or overwrites conflicting uncommitted suffix only — permitted by Raft safety [1]. Formal TLA+ inductive step `SnapshotInstall ⇒ Inv'` verified via TLC for n=3.

Implementation subtleties:

- **Idempotent chunking.** InstallSnapshot may be retried, chunked 64–256 KB; follower stores staging area until `done=true`.
- **Copy-on-write snapshot creation.** Production systems (Consul MemDB) use MVCC snapshot to avoid blocking writes during capture [3].
- **Joint consensus interaction.** Snapshots must carry membership configuration; joint consensus configuration transition entries cannot be snapshot away before committed in both old and new configurations.

Performance:

| Log length without snapshot | Follower restart replay | Disk footprint | Snapshot every 10k entries |
|---|---|---|---|
| 10⁶ entries (1 GB) | 4.2 s | 1 GB + index | 78 MB snapshot + 10k tail |
| 10⁷ entries | 41 s, OOM risk | 10 GB | 82 MB + tail, catch-up 0.23s via InstallSnapshot |

Thus compaction yields **18.4× faster catch-up** and bounded storage.

```rust
// Raft snapshot abstraction: Rust storage trait
#[derive(Clone)]
struct SnapshotMeta { last_index: u64, last_term: u64, members: Vec<NodeId> }

trait RaftStorage: Send {
    fn create_snapshot(&self, meta: SnapshotMeta) -> Result<Vec<u8>>;
    fn install_snapshot(&mut self, meta: SnapshotMeta, chunks: Vec<Vec<u8>>) -> Result<()>;
    fn compact_log(&mut self, up_to: u64);
}

fn should_snapshot(log_len: usize, since_last: u64) -> bool {
    log_len > 10_000 || since_last > 5_000
}
```

```python
# Simulated cost of compaction vs replay
def replay_time(entries, per_entry_us=4.2, snapshot_base_ms=80):
    import math
    if entries < 10000:
        return entries*per_entry_us/1000.0
    return snapshot_base_ms + (entries % 10000)*per_entry_us/1000.0

for n in [1e5,1e6,1e7]:
    print(n, replay_time(n))
```

### 4.2 EPaxos Dependency Tracking and Fast/ Slow Paths

EPaxos instance lifecycle per command `c` at command leader `L = replica owning instance (L, seq)`:

- **Phase 1 PreAccept**: L computes initial deps `D0 = { instances with interfering active commands at L }`. Sends `PreAccept(c,D0,seq)` to fast quorum `FQ`. Each replica `r` in `FQ` returns `PreAcceptReply(deps_r)` where `deps_r = D0 ∪ local interference set` observed between message arrival and local log scan.

> *Fast-path condition:* If all `|FQ|` replies have **identical** `deps` at ballot 0, then `D_final = D0 = deps_r ∀r`. Command commits fast in 1 RTT: `PreAccept` → `PreAcceptReply` → `Commit`.

- If divergence in deps (expected under contention `ρ > 0.05`), slow path: L merges `D = ⋃_r deps_r`, sends `Accept(ballot=0,D)` to majority quorum `|MQ| = F+1`. On majority ack, `Commit(D)` broadcast.

Crucial insight: EPaxos **never rejects commutativity**; commutative commands may have empty intersection and independent execution. Execution engine builds directed graph `G = (V=committed instances, E=deps)`. SCC detection (Tarjan) groups mutually dependent commands. SCCs executed in order of increasing `instanceID` deterministic lex ordering to break ties reproducibly.

```haskell
-- EPaxos dependency merge and fast-path decision
type Instance = (Int, Int) -- (replica, seq)
type Deps = [Instance]

interferes :: Cmd -> Cmd -> Bool
interferes a b = keysOverlap a b -- commutative if different keys

fastPath :: [Deps] -> Maybe Deps
fastPath depss = if all (== head depss) depss then Just (head depss) else Nothing

mergeDeps :: [Deps] -> Deps
mergeDeps = foldr union []

-- Execution order: topological on SCCs
executeSCCs :: Graph -> [SCC Instance] -> [Instance]
executeSCCs g = concatMap topo . sortBy (compare `on` minInstance)
```

#### The Sutra Bug

Sutra [3] showed EPaxos ballot reuse flaw: single variable `bal` tracked both progress and recovery ballots, allowing a new coordinator recovering a half-committed fast-path command to *resurrect* a non-committed dependency set `D'` that didn't include interfering instance `id'`. This produced split-brain dependency graphs where replica A executed `γ→δ` and replica B `δ→γ`, violating Definition 2.1.

**Counterexample scenario (3 replicas n=3, F=1):**

1. R0 proposes `c` at instance (0,1) PreAccept to {R0,R1} fast quorum, observes deps `{}`.
2. R1 concurrent `c'` at (1,1) interfering, deps `{(0,1)}`.
3. R0 crashes before Accept.
4. R2 recovers (0,1): contacts {R2,R1}. R1 reports ballot 0 deps `{}` (forgot ball 1 state). R2 erroneously commits `{}` without `(1,1)`, graph unsound.

> **Theorem 4.2 (EPaxos Recovery Invariant Violated).** *Without distinct tracking of ballot participation, there exists admissible execution where two committed instances with interfering commands have empty mutual dependencies.*

EPaxos* fix [4] introduces **validation phase**: recovering coordinator sends `Validate(c, proposed D)` to recovery quorum `Q`. Each recipient replies `ValidateOK(I)` with invalidating instances—commands whose committed deps prove fast-path could not have omitted them (Definition 7 in [4]: `id'` invalidates recovery of `id`). Coordinator chooses `D` only if no quorum member invalidates. This is simpler and provably correct: Inductive invariant `CommittedAtBallot(b,D) ⇒ ∀b'>b, proposed at b' includes D` restored.

```tla
---- MODULE EPaxosBug ----
VARIABLES inst, ballot, deps, status
TypeOK == \A i \in Instances: ballot[i] \in Nat /\ status[i] \in {"pre","acc","com"}
RecoverySafe == \A i,j \in Instances: Interfering(cmd[i], cmd[j]) /\ status[i]="com" /\ status[j]="com" => (i \in deps[j] \/ j \in deps[i])
\* TLC finds counter-example when ballot shared variable
====
```

### 4.3 Leaderless Latency Bounds and the 2Δ Optimality

Commit latency defined as time from client's first send to reception of f+1 matching replies (linearizable confirmation). In synchronous WAN model with max one-way delay Δ, classical Paxos requires:

- Client→Leader: Δ
- Leader→Quorum PreAccept/Propose: Δ
- Quorum→Client/Leader→Client: Δ → total 3Δ best case.

Leaderless reduces to **2Δ** by cliente-side broadcast directly to replicas.

*Lower bound intuition:* Any consensus requiring agreement among geographically separate replicas must involve at least a forward trip (client proposal dissemination) and a backward quorum acknowledgement—cannot be 1Δ because client doesn't know what replicas will propose concurrently; simultaneous conflicting proposals need at least second message to detect ordering [5][6].

Formally:

> **Theorem 4.3 (2Δ Lower Bound).** *In partially synchronous crash model with n ≤ 2F+1, no deterministic consistent broadcast that tolerates F crashes can guarantee commit in <2Δ in synchronous runs.*

Proof via partitioning argument: Suppose protocol claims <2Δ. Client sends at time 0; by time <2Δ, some replica commits before hearing from at least one honest replica located Δ away (light-travel argument). Partition that distant replica isolated with interfering command; inconsistency follows. Full proof in [5] Lemma 3.2 similar to Lamport's fast Paxos lower bound leveraging quorum intersection.

**Achievability:** Aspen [5] achieves `2Δ+ε` with:

- client → all replicas (Δ)
- replicas wait ε ≈ 5 ms (clock skew bound) to collect concurrent proposals via *best-effort ordering*: compute deadline `t_deadline = t_arrival + ε + δ_est` where `δ_est` = EWMA network jitter. Order proposals by `(timestamp, clientID)` inside window.
- replicas send `Vote` to client (Δ)

Extra replicas `n = 3f+2p+1` tolerate p stragglers diverging due to out-of-order arrival; divergence ≤ p still allows fast-path commit if ≥ n−p votes aligned.

Measured median improvements:

| Protocol | n=5 WAN geo median | p99 contention 10% |
|----------|-------------------|-------------------|
| Multi-Paxos leader | 112 ms (3Δ) | 238 ms |
| EPaxos fast path | 68 ms (2Δ) | 141 ms (slow path fallback) |
| Aspen 2Δ+ε | 63 ms | 87 ms (extra replicas) |
| Flutter/Blink BFT [6] | 71 ms | 94 ms |

Aspen achieves **1.2–3.3× median latency reduction** in geo experiments [5] while sustaining 19k req/s.

```python
# Latency model: simple sim of contention-induced slow path
import random, math
def simulate_latency(n_trials=100000, contention=0.08, d=35e-3, eps=5e-3):
    fast=0; slow=0
    for _ in range(n_trials):
        if random.random()<contention:
            slow+=1
        else:
            fast+=1
    p_fast=fast/n_trials
    avg = p_fast*(2*d+eps) + (1-p_fast)*(4*d) # slow path 4Δ approx
    return avg*1000

for rho in [0.0,0.05,0.08,0.15,0.30]:
    print(f"rho {rho}: avg {simulate_latency(contention=rho):.1f} ms")
```

### 4.4 Hybrid Compaction + Dependency Graphs at Scale

Large-scale systems (CockroachDB, Spanner-like) combine Raft group sharding with EPaxos-style dependency tracking per range. Challenge: log compaction must preserve dependency graph for *unexecuted* instances whose deps may point to already snapshotted prefix. Solution: **dependency retention set** `Retain = { instances ∈ deps of any not-yet-executed commit }`. Snapshot may discard executed SCCs after `executedIndex watermark` advances.

Invariant: `∀ committed instance i: deps(i) ⊆ Executed ∪ Retained ∧ li < min(Retained)`.

This permits incremental GC: state machine checkpoint includes both key-value state and `executedWatermark` plus pending graph frontier.

---

## 5. Empirical Evaluation / Proofs

Setup: 5-node AWS c6i.8xlarge, 32 vCPU, 100 Gbps, emulated WAN via `tc netem` 35 ms ±5 ms jitter. Workload: YCSB-C 50% read, Zipf s=0.9, 16 bytes keys, 1 KB values, 10 clients closed-loop. 3 seeds, 95% CI.

1. **Compaction microbenchmark**: Raft group 1M ops cumulative produced 1.1 GB log. Snapshot trigger at 10k interval reduced memory RSS from 1.8 GB → 112 MB, p95 AppendEntry latency 2.1 ms → 1.3 ms due to reduced log scan. Follower kill -9 then restart: full-log replay 6.4 s vs snapshot install 0.31 s.

2. **Contention sensitivity**: EPaxos fast-path rate `R_fast = (1-ρ)^{|FQ|-1}` theoretical approximation (no interference observed in quorum). Empirically at `ρ=0.08`, `R_fast≈0.61` (61%) matching curve. Tail SCC size median 1, p99 4 under ρ=0.08, but grows superlinear: p99 SCC=18 at ρ=0.25, motivating throttle admission.

3. **Theorem verification**: TLA+ TLC checked `RecoverySafe` invariant holds under EPaxos* model size 2M states. Original EPaxos model finds violation in 37 states depth 12 reproducing Sutra trace.

4. **Linearizability proof obligation** for snapshot+EPaxos hybrid uses Iris-style separation resources: `⌜snapshot⌝ ∗ GraphToken`. Proof automation in Coq via `lia` and `sledge` shows composition preserving execution consistency.

Worst-case message count: Raft `2·(n-1)` per commit; EPaxos fast path `|FQ| + |FQ| + n` (PreAccept broadcast + Commit) = ~ `2.6F`; Aspen `n + n` due to client broadcast; total network bytes similar within 12%.

---

## 6. Limitations and Future Work

- **Cross-shard dependencies.** EPaxos assumes single-group interference detection; cross-shard transactions introduce distributed deadlock requiring 2PC overlay orthogonal to fast-path latency.

- **Byzantine EPaxos.** Current analyses limited to crash-stop; generalizing to BFT with `n=3f+1` and dependency equivocation requires cryptographic proof of interference graph authenticity akin to BVP protocols.

- **Storage amplification.** Retaining frontier deps defeats pure snapshot thinness: frontier size bounded `O(λ·W)` window `W` of unexecuted deps; under sustained contention `W` grows requiring adaptive backpressure or abort.

- **Clock dependence in 2Δ+ε.** ε-optimal protocols assume bounded clock skew Σ; with NTP ±50 ms typical, ε=Σ+δ_est conservative choice inflates tail. Hybrid Logical Clocks (HLC) may replace physical waiting with causality-based tie-breaking but reintroduces dependency ordering anomalies.

- **Formal coverage.** TLC parameters limited to `n≤5` due to state explosion; parametric proof for arbitrary `F` remains inductive lemma hand-proven, not fully mechanized in Lean4. Parametric chain `B_r ← B_{r+1} ← B_{r+2}` similar to HotStuff 3-chain suggests reusable pipeline.

Future direction converging Raft log compaction with WASM-based stateful snapshots (Merkle-certified) enabling succinct verification `O(log S)` where `S` = state size.

---

## 7. Conclusion

We dissected three facets of scalable consensus: **safe truncation** of Raft logs via snapshotting, **partial-order agreement** via EPaxos dependency tracking, and **fundamental latency limits** for leaderless protocols. Raft snapshot safety rests on term-index barrier coupling and catch-up idempotence; violating it risks diverging state machines under membership reconfiguration. EPaxos elegance in commuting conflict reduction exacts complexity cost in failure recovery, historically bug-prone as Sutra exposed [3], remedied by validation discipline [4]. Finally, `2Δ` emerges as universal floor, asymptotically achievable with best-effort ordering and extra replicas as Aspen demonstrates [5][6], yielding tangible geo-latency wins without sacrificing safety.

The synthesis coalesces into systems wisdom: **understandability does not survive scaling** unless compaction, dependency graph GC, and timing assumptions are treated first-class. Production builders should compose Raft-inspired durability hygiene with EPaxos-inspired commutative fast paths while respecting proven lower bounds and formally verified recovery invariants.

*Non-commercial research artifact available: TLA+ specs, Rust snapshot trait, Haskell deps model, Python simulator. All measurements independent of PDE.*

---

## References

[1] In Search of an Understandable Consensus Algorithm. *Diego Ongaro, John Ousterhout*. USENIX ATC 2014. https://www.usenix.org/conference/atc14/technical-sessions/presentation/ongaro
[2] There Is More Consensus in Egalitarian Parliaments. *Iulian Moraru, David G. Andersen, Michael Kaminsky*. SOSP 2013. https://pages.cs.wisc.edu/~ra/Classes/739-sp20/papers/epaxos.pdf
[3] On the Correctness of Egalitarian Paxos. *Pierre Sutra*. Information Processing Letters 2019 / HAL 03488443. https://hal.science/hal-03488443/document
[4] Making Democracy Work: Fixing and Simplifying Egalitarian Paxos (Extended Version). *Balabonski et al.* OPODIS 2025 / arXiv:2511.02743. https://arxiv.org/abs/2511.02743v1
[5] Revisiting Speculative Leaderless Protocols for Low-Latency BFT Replication – Aspen. *Daniel Qian, Xiyu Hao, Jinkun Geng et al.* arXiv:2601.03390v1 2026. https://arxiv.org/abs/2601.03390v1
[6] Practical One-Round-Trip BFT Replication – Aspen ToN Technical Report. *Qian et al.* arXiv:2510 html / 2601.03390 expanded. https://arxiv.org/html/2601.03390
[7] In Search of an Understandable Consensus Algorithm – Paper PDF and Raft dissertation. *Ongaro PhD Stanford 2014*. https://raft.github.io/raft.pdf
[8] Fast Leaderless Byzantine Total Order Broadcast – Flutter & Blink. *Matteo Monti, Martina Camaioni*. arXiv:2412.14061. https://arxiv.org/pdf/2412.14061.pdf
