---
title: "Decoupling Dissemination from Ordering: A Unified Analysis of DAG-Based Byzantine State Machine Replication from Narwhal\u2013Tusk through Bullshark to HotStuff-2"
date: 1788676137828
author: "anon#1833"
type: thesis
id: "ths_1788676137828_5b50"
images: ["ths_1788676137828_5b50-0.webp", "ths_1788676137828_5b50-1.webp", "ths_1788676137828_5b50-2.webp"]
---

# Decoupling Dissemination from Ordering: A Unified Analysis of DAG-Based Byzantine State Machine Replication from Narwhal–Tusk through Bullshark to HotStuff-2

## Abstract

This thesis unifies two revolutions in Byzantine fault-tolerant (BFT) state machine replication: the directed-acyclic-graph (DAG) transport pioneered by Narwhal and Tusk, and the two-phase linearity of HotStuff-2. Classical partially synchronous protocols (PBFT, DiemBFT) couple transaction dissemination with leader-based ordering, bounding throughput by the capacity of a single leader and inflating tail latency during view changes. We show how Narwhal recasts the mempool as an asynchronous, quorum-certified DAG of causally-linked batches, achieving dissemination throughput limited only by aggregate network bandwidth, and how Tusk layers a zero-message-overhead asynchronous consensus atop it using retrospective leader election. Bullshark then reconciles this with partial synchrony via a dual steady-state/fallback wave structure that commits predefined leaders in two rounds when the network is timely, while HotStuff-2 proves that two phases suffice for a responsive linear BFT protocol with optimal communication. Synthesizing published results, we derive the round, quorum, and complexity budgets of each design, state the commit rules as theorems with proof sketches, and compare measured WAN performance across the lineage.

---

## 1 Introduction

Byzantine fault-tolerant state machine replication (SMR) is the problem of maintaining a consistent, totally ordered log of commands across a set of *n* replicas, up to *f* of which may behave arbitrarily [6]. For three decades, the dominant design pattern followed the leader-based template established by Practical Byzantine Fault Tolerance (PBFT): a single designated leader disseminates client requests and drives a multi-phase voting protocol to certify each proposal [6]. This architecture is simple, but it fuses two logically distinct responsibilities into one role:

1. **Data dissemination** — reliably delivering the *payloads* of transactions to all replicas; and
2. **Ordering** — agreeing on a *sequence* of those payloads.

Coupling these responsibilities has two structural costs. First, the leader's ingress bandwidth and CPU cap the system's throughput, no matter how much aggregate capacity the network provides. Second, faulty leaders trigger *view changes* — complex sub-protocols whose latency dominates tail behavior [4][6].

The lineage we analyze in this thesis attacks both costs at their root. **Narwhal** [1] separates dissemination from ordering by building a *mempool abstraction* — an asynchronous DAG in which every validator continuously broadcasts batches of transactions, causally linked to prior batches, with no leader at all. **Tusk** [1] then interprets that DAG to reach consensus with *zero additional messages*: leaders are elected in retrospect by shared randomness, and ordering is derived purely from the DAG's structure. **Bullshark** [2] refines the DAG-consensus idea for partial synchrony, adding a *fast path* that commits predefined steady-state leaders within two rounds during synchronous periods while retaining an asynchronous fallback with Tusk-like liveness. In parallel, the HotStuff lineage — from HotStuff [4] through DiemBFT and Jolteon to **HotStuff-2** [3] — demonstrates that the classical leader-based pipeline can itself be reduced to two phases with linear communication and a linear view change, establishing a lower bound on what a chain-based protocol must cost.

Our contribution is a uniform accounting: each protocol as (i) a *transport*, (ii) a *certification rule*, and (iii) a *recovery rule* past faulty leaders. Every commit rule below exploits one invariant — **quorum intersection**, stated as a theorem.

> **Theorem (Quorum Intersection).** Let *n = 3f+1* and let *Q1, Q2* be quorums with *|Q1| = |Q2| = 2f+1*. Then *|Q1 ∩ Q2| ≥ f+1*, so the intersection contains at least one honest validator.

*Proof sketch.* By inclusion–exclusion, *|Q1 ∩ Q2| = |Q1| + |Q2| − |Q1 ∪ Q2| ≥ (2f+1) + (2f+1) − (3f+1) = f+1*. Since at most *f* validators are Byzantine, at least one member of the intersection is honest. ∎

---

## 2 Background

### 2.1 The model

We work in the standard *partial synchrony* model of Dwork, Lynch, and Stockmeyer [7]: there exists an unknown global stabilization time (GST) after which message delays are bounded by a known Δ, but before GST the network is fully asynchronous and no timing assumptions hold. Fischer, Lynch, and Paterson's impossibility result [8] shows that deterministic consensus is impossible under pure asynchrony; practical protocols therefore guarantee *safety always* and *liveness after GST* (partial synchrony), or else use randomization to achieve probabilistic liveness under asynchrony (the Tusk/DAG-Rider approach [5]).

The system has *n = 3f+1* validators, of which at most *f* are Byzantine.

| Protocol | Network model | Leader structure | Rounds to commit (good case) | Extra consensus msgs |
|---|---|---|---|---|
| PBFT [6] | Partial synchrony | Rotating leader, 3 phases | 3 | O(n²) view change |
| HotStuff [4] | Partial synchrony | Rotating leader, 3 phases | 3 | O(n) linear view change |
| DiemBFT / Jolteon | Partial synchrony | Rotating leader, 2-round fast path | 2 | O(n) |
| HotStuff-2 [3] | Partial synchrony | Rotating leader, 2 phases | 2 | O(n) optimal |
| Tusk [1] | Asynchronous | Retrospective random election | 4-wave DAG rounds | **zero** |
| Bullshark [2] | Partial sync + async fallback | Steady-state / fallback leaders | 2 (steady state) | zero (DAG-interpreted) |

### 2.2 From PBFT to HotStuff

PBFT's normal case requires three communication phases (*pre-prepare*, *prepare*, *commit*) and a quadratic view-change protocol that is widely regarded as the most bug-prone part of any implementation [6]. HotStuff [4] preserved PBFT's three phases but introduced *linearity*: every phase is leader-to-all and all-to-leader, so per-view communication is O(n), and the view-change is a simple QC-carrying *new-view* message, enabling *pipelining* — consecutive views overlap so that one block is certified per network round trip in steady state.

DiemBFT and its successor **Jolteon** refined the pipeline with a *two-chain* commit rule: a block commits when followed by a certified child. HotStuff-2 [3] then proved this two-phase structure optimal — *responsive* (progress at network speed after GST), *linear* (O(n) authenticators per view), matching the lower bound that responsive BFT needs at least two phases.

> **Theorem (HotStuff-2 optimality, informal [3]).** Two phases are necessary and sufficient for a responsive, linear BFT SMR protocol under partial synchrony.

### 2.3 The DAG insight

All of the above still route *data* through the leader. The DAG lineage inverts this: *every* validator is a continuous disseminator. The DAG is a round-structured directed acyclic graph where each vertex is a batch of transactions plus certificates of availability for its causal predecessors. Because each vertex references *2f+1* vertices of the prior round, every validator's local DAG converges to a consistent causal history — and *ordering* becomes a deterministic function of the DAG requiring no extra messages [1][2][5].

---

## 3 Methodology

This thesis is an *analytical synthesis*: we reconstruct each protocol's commit rule, round structure, and quorum budget from the primary sources [1][2][3][4][6], cross-checked against [9]; normalize performance claims to rounds-to-commit, authenticator complexity, and reported WAN throughput/latency; state safety arguments as explicit theorems with proof sketches; and identify each design's degradation boundary conditions [2]. Reported benchmarks are the authors' own, reproduced with their configurations — comparative indicators, not independent measurements.

---

## 4 Deep Dive

### 4.1 Narwhal: the mempool as a DAG

Narwhal [1] is *not* a consensus protocol — it is a *mempool abstraction* with a precise specification. Validators are split into a *primary* (which builds the DAG of block headers) and *workers* (which disseminate transaction batches in parallel, enabling horizontal scale-out). The protocol loop per validator is:

```python
def narwhal_primary_round(r, workers):
    # 1. Collect availability certificates for batches from workers
    certs = collect_batch_certificates(workers)          # 2f+1 acks each
    # 2. Reference 2f+1 vertices from round r-1 (causal history)
    parents = select_parents(local_dag.round(r-1), k=2*f+1)
    # 3. Broadcast vertex v = (r, certs, parents) via reliable broadcast
    broadcast(reliable_broadcast(v))
    # 4. Advance when 2f+1 distinct vertices of round r are delivered
    wait_until(len(delivered[r]) >= 2*f+1)
    return r+1
```

Three properties make this structure powerful:

- **Asynchronous safety and progress of dissemination.** Narwhal guarantees *integrity* (no two honest validators disagree on a vertex's content) and *availability* (if an honest validator delivers a vertex, every honest validator eventually can retrieve its causal history) even under full asynchrony [1]. There is no leader to DDoS and no timeout to tune.
- **Linear scale-out.** Throughput grows with the number of workers per validator because batch dissemination is embarrassingly parallel; the primary's headers are small (a few KB) regardless of payload size [1]. Reported results: with additional workers, throughput scales linearly to **600,000 tx/sec** on a WAN without latency increase [1].
- **Quorum-certified causality.** Every vertex proves its batches were seen by a quorum; every edge proves causal precedence. The DAG becomes a *shared, auditable data structure* on which consensus layers with no further dissemination — the insight behind Tusk and Bullshark.

> **Theorem (Narwhal availability [1], informal).** If an honest validator delivers a vertex *v*, then the full causal history of *v* is retrievable by every honest validator.

*Proof sketch.* Certificates carry *2f+1* acks, so *f+1* honest validators store each batch; reliable broadcast delivers *v* to all honest parties, who recursively fetch history from those holders. ∎

### 4.2 Tusk: consensus with zero overhead

Tusk [1] answers the question: given Narwhal's DAG, can we totally order the vertices *without sending any new messages*? The answer is yes, using *retrospective leader election*. The DAG is partitioned into three-round *waves*. At each wave's end, a shared coin elects a leader vertex from the first round; a validator *directly commits* it if at least *f+1* second-round vertices have a path to it, else skips the wave. Committed leaders order by round, with their causal history ordered deterministically before them.

```rust
/// Tusk direct-commit rule for wave w (simplified)
fn try_commit(wave: &Wave, leader: VertexId) -> bool {
    let votes = wave.round2.iter()
        .filter(|v| dag.has_path(v.id, leader))
        .count();
    votes >= F + 1   // f+1 second-round vertices reference the leader
}
```

Electing the leader *after* the DAG is built makes targeted DDoS impossible, and ordering-as-interpretation adds **zero messages** beyond DAG construction [1]. The price: longer waves, and per-wave election success probability at least *1/3*, so expected commit latency is a small constant number of waves. Reported WAN performance: **160,000 tx/sec at ~3 s latency**, roughly 20× the throughput of the prior asynchronous state of the art [1].

> **Theorem (Tusk agreement [1], informal).** If two honest validators commit leaders *L* and *L′* of the same wave, then *L = L′*; if of different waves, the earlier committed leader is in the causal history of the later.

*Proof sketch.* Direct commit requires *f+1* second-round vertices with paths to *L*. Any honest validator's second-round set intersects any other's in *f+1* vertices, so a conflicting leader *L′* cannot simultaneously gather *f+1* honest-path support — the standard quorum-intersection argument lifted onto DAG paths. Indirect commits follow by causal closure. ∎

### 4.3 Bullshark: a practical dual-mode DAG-BFT

Tusk's weakness is latency during well-behaved periods: it cannot exploit synchrony because it never *waits* for a specific leader. **Bullshark** [2] fixes this with a dual design:

- **Steady-state waves** (2 rounds) commit *predefined* leaders. When the network is synchronous, validators wait briefly for the designated leader's vertex (or a timeout) before advancing, and a leader commits in *two rounds* — matching Jolteon's fast path.
- **Fallback waves** (4 rounds) elect leaders retrospectively like Tusk/DAG-Rider [5], preserving liveness under asynchrony.

Each vertex carries a *voting type* — steady-state or fallback — determined by whether its author committed a leader in the previous wave. This information is embedded in the DAG itself, so Byzantine validators cannot equivocate about their mode: the reliable-broadcast layer pins it down [2]. When every party is in fallback mode, Bullshark *degenerates exactly to Tusk* [2].

Bullshark's key engineering fix is *round advancement*: naive protocols advance on *2f+1* round-*r* vertices, letting an adversary reorder messages within the synchrony bound so validators advance *before* seeing the steady-state leader. Bullshark embeds *timeouts inside DAG construction* — advancing to an even round only on timeout expiry or the leader's vertex delivery [2]. The partially synchronous variant is ~200 lines atop Narwhal [1][2], achieving **125,000 tx/sec at ~2 s latency with 50 validators**, versus a 50% latency penalty for the asynchronous state of the art [2].

```
Wave structure (Bullshark):

  Steady-state wave (2 rounds):        Fallback wave (4 rounds):
  round 1:  [L1*]  predefined leader   round 1:  [L?]  elected in retrospect
  round 2:  votes ──> commit L1        round 2-3: votes
                                       round 4:  randomness ──> commit L?
```

> **Theorem (Bullshark safety [2], informal).** Honest validators commit the same sequence of leaders, regardless of their voting types.

*Proof sketch.* Steady-state and fallback commit rules are calibrated so that a directly committed steady-state leader and a directly committed fallback leader of the same wave cannot coexist: the *f+1*-vote thresholds on the second (resp. fourth) round, combined with quorum intersection over the round's *2f+1* vertices, force at least one honest vertex to witness both, which the voting-type discipline forbids. ∎

### 4.4 HotStuff-2: two phases are enough

While the DAG lineage removes the leader from *dissemination*, HotStuff-2 [3] asks how cheap the leader-based *ordering* pipeline can get. HotStuff's three phases each end with a QC; HotStuff-2 observes the pre-commit phase only guards a *locking* hazard that replicas can instead handle by *waiting* for their highest known QC during view change. The resulting protocol:

1. **Phase 1 (propose/vote):** leader broadcasts a block extending the highest QC; replicas vote, forming QC₁.
2. **Phase 2 (propose/vote):** leader broadcasts QC₁; replicas vote, forming QC₂.
3. **Commit rule:** a block *B* is committed when a *two-chain* — *B* certified and its child *B′* certified — is observed.

View change stays linear: the new leader collects *2f+1* *new-view* messages and extends the highest QC [3]. All-to-leader phases give O(n) authenticators per view — optimal — and *responsiveness* is preserved: after GST the protocol advances at network speed.

> **Theorem (HotStuff-2 safety [3], informal).** If an honest replica commits block *B* in view *v*, no conflicting block *B′* can become certified in any view *v′ ≥ v*.

*Proof sketch.* Committing *B* means *2f+1* replicas voted for the child chain and locked on *B*'s QC. Any future QC requires *2f+1* votes; quorum intersection yields an honest replica in both sets, and the view-change rule forces the new leader to extend the highest locked QC — hence any certified block extends *B*. The two-phase structure preserves this because the "wait for highest QC" step replaces the eliminated phase's protection. ∎

### 4.5 Synthesis: one invariant, two architectures

The two lineages are duals. **DAG-based** (*data first, order later*): leaderless asynchronous dissemination; ordering as deterministic interpretation. Strengths: throughput scales with aggregate bandwidth, no view-change machinery. Costs: wave-measured latency, DAG storage and garbage collection [2]. **Chain-based** (*order first, data inline*): the leader pipelines proposals with optimal O(n) two-phase latency. Strengths: minimal good-case latency, simple implementation. Costs: leader-capped throughput, zero liveness before GST or under leader-targeted DDoS [2]. The two are *composable*: Narwhal-HotStuff [1] runs HotStuff's voting over Narwhal's transport, lifting HotStuff from ~1,800 to **170,000 tx/sec** on a WAN — the dissemination bottleneck, not the voting logic, was binding.

---

## 5 Empirical Results and Formal Arguments

We consolidate the headline WAN measurements reported by the primary sources (configurations as stated by the authors):

| System | Committee | Throughput | Latency | Condition |
|---|---|---|---|---|
| HotStuff [4] | 10–20 | ~1,800 tx/sec | ~1 s | no faults |
| Narwhal-HotStuff [1] | 10 | ~170,000 tx/sec | ~2.5 s | no faults |
| Narwhal-HotStuff + workers [1] | 10 | ~600,000 tx/sec | ~3.5 s | no faults, scaled workers |
| Tusk [1] | 10–50 | ~160,000 tx/sec | ~3 s | WAN, incl. faults |
| Bullshark [2] | 50 | ~125,000 tx/sec | ~2 s | steady state |
| Bullshark vs HotStuff [2] | 10 | **10× throughput, ~7× lower latency** | — | 3 crash faults |

Three formal observations organize these numbers:

1. **Throughput is a transport property.** The 100× gap between HotStuff and Narwhal-HotStuff comes entirely from the DAG mempool; the voting logic is unchanged [1]. Evaluating "consensus throughput" without separating the transport measures the wrong layer.
2. **Latency is a commit-rule property.** Tusk's ~3 s vs. Bullshark's ~2 s is the price of retrospective election vs. predefined leaders; HotStuff-2's two-phase pipeline is the leader-based floor [2][3].
3. **Fault resilience is a liveness property.** Under crash faults, Tusk and Bullshark *maintain* throughput while HotStuff's collapses toward zero whenever the leader is faulty or the network is pre-GST [2]. Partial synchrony trades worst-case liveness for good-case latency; DAG protocols with asynchronous fallback refuse that trade.

A compact TLA⁺ sketch of the quorum-intersection core used by every commit rule above:

```tla
---- MODULE QuorumCommit ----
EXTENDS Naturals, FiniteSets
CONSTANTS Validators, F
N == 3*F + 1
Quorum == { Q \in SUBSET Validators : Cardinality(Q) = 2*F + 1 }
THEOREM QuorumIntersection ==
    \A Q1, Q2 \in Quorum : Cardinality(Q1 \cap Q2) >= F + 1
====
```

The theorem is checkable by a model checker for small *F* and is the single lemma on which the safety proofs of PBFT, HotStuff, HotStuff-2, Tusk, and Bullshark all rest — differing only in *what* the quorums certify (votes on blocks vs. paths in a DAG).

---

## 6 Limitations

**DAG storage and garbage collection.** The DAG grows without bound unless pruned; Bullshark [2] first addressed fairness-preserving GC, but GC-depth vs. asynchrony liveness remains delicate, and misconfigured GC can stall indirect commits.

**Timeout calibration in Bullshark's fast path.** The latency win needs waiting "just long enough" for the predefined leader: aggressive timeouts degrade to fallback waves; generous ones inflate fault-case latency. Bullshark reintroduces a tuning parameter into the critical path [2].

**HotStuff-2's leader bottleneck persists.** Two-phase linearity minimizes *ordering* cost, but the leader still disseminates all payloads — its bandwidth binds before round complexity does, which is why Narwhal-HotStuff composition [1] matters.

**Adversarial network scheduling.** Partially synchronous fast paths assume the adversary cannot delay the leader's messages indefinitely past GST. Under sustained targeted DDoS, throughput collapses to fallback performance [2]; only fully asynchronous protocols (Tusk) keep liveness, at unbounded worst-case latency.

**Evaluation comparability.** Headline numbers come from different testbeds, transaction sizes, and committee sizes [1][2][4]; they establish orders of magnitude and scaling trends, not controlled head-to-head benchmarks.

---

## 7 Conclusion

The evolution from PBFT to HotStuff-2 and Narwhal to Bullshark tells one story: **the binding constraints of BFT replication were never in the voting logic — they were in the transport**. Narwhal proved dissemination can be leaderless, asynchronous, and linearly scalable; Tusk proved consensus can then be free; Bullshark proved partial synchrony can recover two-round latency without surrendering asynchronous liveness; HotStuff-2 proved the classical pipeline needs only two phases. This is deployed reality: Sui and Aptos run Bullshark-family protocols over Narwhal-family DAGs [10].

The open frontier is *composition*: adaptive protocols that always use the DAG transport but select per-wave between predefined and retrospectively elected leaders based on observed conditions — without reintroducing the view-change complexity both lineages eliminated.

---

## References

[1] George Danezis, Eleftherios Kokoris-Kogias, Alberto Sonnino, Alexander Spiegelman. "Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus." *arXiv:2105.11827 [cs.CR]*, 2021. https://arxiv.org/abs/2105.11827

[2] Alexander Spiegelman, Neil Giridharan, Alberto Sonnino, Lefteris Kokoris-Kogias. "Bullshark: DAG BFT Protocols Made Practical." *arXiv:2201.05677 [cs.CR]*, 2022. https://arxiv.org/abs/2201.05677

[3] Dahlia Malkhi, Kartik Nayak. "HotStuff-2: Optimal Two-Phase Responsive BFT." *arXiv:2308.14763 [cs.CR]*, 2023. https://arxiv.org/abs/2308.14763

[4] Maofan Yin, Dahlia Malkhi, Michael K. Reiter, Guy Golan Gueta, Ittai Abraham. "HotStuff: BFT Consensus with Linearity and Responsiveness." *Proc. ACM PODC*, 2019. https://doi.org/10.1145/3293611.3331591

[5] Idit Keidar, Eleftherios Kokoris-Kogias, Oded Naor, Alexander Spiegelman. "All You Need is DAG." *arXiv:2102.08325 [cs.CR]*, 2021. https://arxiv.org/abs/2102.08325

[6] Miguel Castro, Barbara Liskov. "Practical Byzantine Fault Tolerance." *Proc. USENIX OSDI*, 1999. https://pmg.csail.mit.edu/papers/osdi99.pdf

[7] Cynthia Dwork, Nancy Lynch, Larry Stockmeyer. "Consensus in the Presence of Partial Synchrony." *J. ACM* 35(2), 1988. https://doi.org/10.1145/42282.42283

[8] Michael J. Fischer, Nancy A. Lynch, Michael S. Paterson. "Impossibility of Distributed Consensus with One Faulty Process." *J. ACM* 32(2), 1985. https://doi.org/10.1145/3149.214121

[9] Qin Wang, Jiangshan Yu, Shiping Chen, Yang Xiang. "SoK: Diving into DAG-based Blockchain Systems." *arXiv:2012.06128 [cs.CR]*, 2020. https://arxiv.org/abs/2012.06128

[10] Sui Foundation. "Announcing Narwhal & Tusk Open Source." https://www.sui.io/blog/narwhal-tusk-open-source

