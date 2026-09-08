---
id: ths_1788877762022_a9e2
title: "Chained BFT Consensus after HotStuff: Pipelined Two-Phase Commit, View-Change Certificates, and Linear-Communication Protocols at 100K TPS"
anon: anon#5297
ts: 1788877762022
tags: [Thesis]
type: thesis
---

# Chained BFT Consensus after HotStuff: Pipelined Two-Phase Commit, View-Change Certificates, and Linear-Communication Protocols at 100K TPS

## Abstract

We analyze the family of chained Byzantine fault-tolerant (BFT) protocols descending from HotStuff [1], the first partially synchronous leader-based protocol to combine *responsiveness* — progress at the pace of actual network delay — with *linear* communication complexity. We formalize the quorum-certificate chaining abstraction that turns a three-phase basic protocol into a pipelined chain where each view simultaneously advances three overlapping proposals, and we prove the three-chain commit rule that makes pipelining safe. We then trace three post-HotStuff fronts: two-phase successors (Jolteon/DiemBFT, HotStuff-2, Fast-HotStuff) restoring classical two-round latency with linear view-change; timeout-certificate machinery and rotating leaders keeping failover at O(n); and DAG-based successors (Narwhal–Tusk, Bullshark) separating dissemination from ordering to reach 130K–170K tx/s on a WAN — two orders of magnitude above plain HotStuff's ≈1,800 tx/s [2]. We close with the fundamental trade-offs: leader bandwidth, threshold-signature cryptography, and the partial-synchrony assumption.

---

## 1 Introduction

State machine replication (SMR) under Byzantine faults is the central primitive of permissioned blockchains, distributed ledgers, and high-assurance control planes. A protocol solving SMR must guarantee *safety* — no two correct replicas ever commit conflicting logs — and *liveness* — correct replicas eventually commit — despite up to *f* of the *n* replicas behaving arbitrarily. Classical results bound the achievable: deterministic consensus is impossible under full asynchrony [FLP], so practical BFT protocols assume *partial synchrony* [Dwork–Lynch–Stockmeyer], where an unknown global stabilization time (GST) exists after which messages arrive within a known bound Δ.

The practical history of BFT began with **PBFT** [Castro–Liskov 1999], a three-phase (pre-prepare, prepare, commit) protocol with O(n²) all-to-all communication. PBFT proved Byzantine SMR could be practical, but its quadratic footprint — especially during leader failover, where a view-change floods Θ(n²) messages — limits scalability [6].

**HotStuff** [1] (Yin, Malkhi, Reiter, Gueta, Abraham; PODC'19) changed the landscape by importing the linear star topology of Paxos into BFT: replicas vote *to the leader*, which aggregates *n − f* votes into a single quorum certificate (QC) using threshold signatures and broadcasts that QC once. The result is the first partially synchronous BFT protocol to achieve both responsiveness and linear communication complexity, with O(n) view-changes. HotStuff also introduced a *framework* re-expressing classical protocols (DLS, PBFT, Tendermint, Casper FFG) in a single phased language, showing they differ mainly in phase structure and voting rules.

This thesis makes three contributions:

1. **A unified chained-BFT abstraction** — quorum certificates, the *generic QC* pipelining trick, and the *three-chain commit rule* — proving why a chain of consecutive views commits safely even though each view's QC plays three phases simultaneously.
2. **A comparative analysis of the post-HotStuff frontier** across three axes — two-phase reductions, linear view-change machinery, and DAG-based decoupling — with asymptotic communication, latency, and measured-throughput comparison.
3. **An empirical assessment of the 100K-tps regime**: why pipelined HotStuff alone plateaus near 1,800 tx/s on a WAN, how Narwhal's dissemination layer lifts the leader bottleneck, and where the remaining limits lie.

---

## 2 Background

### 2.1 The BFT System Model

We consider n = 3f + 1 replicas, at most f of them Byzantine, under partial synchrony: after GST, every message between correct replicas arrives within Δ, but before GST the adversary controls delivery arbitrarily. A *quorum* is any set of 2f + 1 = n − f replicas; any two quorums intersect in at least one correct replica — the combinatorial fact on which all quorum-based safety arguments rest.

| Protocol | Communication (happy path) | View-change cost | Phases per view | Responsiveness |
|---|---|---|---|---|
| PBFT [Castro–Liskov] | O(n²) | O(n²) | 3 (pre-prepare/prepare/commit) | Yes |
| Tendermint | O(n²) | O(n²) | 2 + Δ wait | No (waits δ) |
| BFT-SMaRt | O(n²) | O(n²) | 3 | Yes |
| **Basic HotStuff** [1] | **O(n)** | **O(n)** | 3 (prepare/pre-commit/commit) | Yes |
| **Chained HotStuff** [1] | **O(n)** | **O(n)** | 1 (pipelined) | Yes |
| HotStuff-2 | O(n) | O(n) | 2 (happy path) | Partial |
| Narwhal–Tusk [2] | O(n²) amortized, DAG | zero-message | 3 rounds/instance | Async live |
| Bullshark [3] | O(n²) amortized, DAG | fast path sync | 2-round fast path | Yes |

*Table 1: Asymptotic comparison of representative BFT protocols. Linear cost in HotStuff-family protocols comes from threshold-signature vote aggregation; DAG protocols amortize quadratic dissemination across large batches.*

### 2.2 Threshold Signatures and Quorum Certificates

HotStuff-family linearity rests on *(k, n)-threshold signatures*, typically BLS over pairing-friendly curves: each replica signs with a share; any *n − f* shares combine into one constant-size signature verifiable under a single public key. A *quorum certificate* (QC) is then

> **Definition (QC).** A quorum certificate for a node *b* in view *v* is a tuple `QC = (type, view, node, sig)` where `sig` is a threshold signature over `(type, view, node)` from a quorum of replicas.

Because a QC is O(1) in size regardless of n, the leader can broadcast one QC to n replicas in O(n) words — the crux of linear communication. Replicas *lock* on the highest QC they have seen; the locking rule plus quorum intersection gives safety.

### 2.3 Responsiveness and the δ Problem

A protocol is *responsive* if, after GST, a correct leader drives consensus at the pace of the actual network delay δ rather than the conservative bound Δ. One of HotStuff's central results is that responsiveness and linearity are jointly achievable — but basic HotStuff pays for linearity with an extra phase (three instead of two), adding latency that later two-phase variants remove.

---

## 3 Methodology

Our analysis combines **protocol-theoretic reconstruction** (re-deriving chained HotStuff from basic HotStuff via the generic-QC transformation, proving the three-chain safety theorem from quorum intersection and the locking invariant), **asymptotic communication accounting** (authenticator words per phase per role, following the load model of [6]), and **published WAN measurements** — HotStuff at 100 replicas matching BFT-SMaRt throughput with linear failover [1]; Narwhal–HotStuff at 130K–170K tx/s versus 1,800 tx/s for plain HotStuff; Tusk at ≈140K–160K tx/s [2] — treated as existence proofs of the architectural scaling argument, since hardware and batching differ across studies. We use TLA⁺-style formalism where precision matters (§5) and Python where algorithmic intuition matters (§4).

---

## 4 Deep Dive

### 4.1 Basic HotStuff: Three Phases, One Linear Spine

Basic HotStuff proceeds in views, each with a designated leader, in three phases — **prepare**, **pre-commit**, **commit** — each with identical structure: the leader broadcasts a proposal carrying the previous phase's QC; replicas vote to the leader if the proposal extends their locked node; the leader aggregates n − f votes into a QC for the next phase. Only the final phase's QC (the *commit QC*) causes replicas to commit.

```python
# Basic HotStuff — one phase (all three phases share this structure)
def phase(leader, view, phase_type, proposal):
    leader.broadcast(MSG(proposal, justify=last_qc))      # O(n) words
    votes = leader.collect(n - f, timeout=delta)           # star topology
    qc = threshold_aggregate(votes)                        # O(1) certificate
    return qc
```

The *voting rule* (`SafeNode`): vote for a proposal extending the highest QC known, or extending the locked node. The *locking rule*: on receiving a pre-commit QC, lock on its node. Safety follows because any commit QC and any later lock's quorum intersect in a correct replica that prevents divergence.

> **Theorem (Basic HotStuff safety):** If two correct replicas commit nodes *b₁* and *b₂* at the same log position, then *b₁ = b₂*. *Proof sketch.* A commit requires a commit QC — 2f + 1 votes, hence f + 1 correct. Any later view's prepare quorum (2f + 1) intersects those f + 1 correct voters in ≥1 correct replica *r*, which locked on *b₁* (or its extension) and will only vote for nodes extending it. ∎ [1]

Linearity is immediate: each phase moves O(n) words (one broadcast of size O(n) total via n unicasts, n votes inbound, one QC of size O(1) in the next broadcast).

![Chained HotStuff pipeline with three-chain commit rule](/thesis/ths_1788877762022_a9e2-0.webp)

### 4.2 Chaining: The Generic-QC Pipelining Transformation

The key observation of [1] is that the three phases are *structurally identical*: each collects votes into a QC and hands that QC to the next phase. Chained HotStuff therefore replaces the phase-specific QC with a **generic QC** and lets the *leader of view v + 1* perform the next phase *while also starting its own proposal*:

- View *v*'s PREPARE votes are aggregated by leader *v* into a generic QC.
- Leader *v + 1* broadcasts a new proposal *justified by* that QC; its PREPARE phase simultaneously serves as view *v*'s PRE-COMMIT phase.
- View *v + 2*'s PREPARE simultaneously serves as *v + 1*'s PRE-COMMIT and *v*'s COMMIT.

Views *v₁, v₂, v₃* thus serve as the prepare/pre-commit/commit phases of the command proposed in *v₁*, which commits at the end of *v₄*; overlapping, every view advances three proposals at once (Figure 1 in [1]). Each proposal carries two links: `b.parent` (the chain parent) and `b.justify.node` (the QC it extends). Since a commit now requires three *consecutive* views to each produce a QC extending the previous — a **three-chain** *v, v + 1, v + 2* — the commit rule becomes:

> **Definition (Three-chain commit rule).** A replica commits node *b* proposed in view *v* when it observes QCs forming a three-chain: `QC(v) → QC(v+1) → QC(v+2)`, each justifying a node extending *b*.

Why three and not two? The pre-commit phase *locks* replicas before committing; without it, a view-change after a commit QC could elect a leader unaware of the commit. The three-chain preserves exactly the basic protocol's phase count, merely overlapping the phases in time. Rotating leaders (a fresh leader per view) additionally bound the damage a Byzantine leader can do and give every replica equal proposal opportunity [4].

```tla
---- MODULE ChainedHotStuff ----
EXTENDS Integers, FiniteSets
CONSTANTS Replicas, F, Views
Quorum == { Q \in SUBSET Replicas : Cardinality(Q) >= 3*F+1 - F }
(* Invariant: lockedQC[v] is non-decreasing per correct replica *)
LockSafety == \A r1, r2 \in Correct :
    committed[r1] = committed[r2] \/ PrefixOf(committed[r1], committed[r2])
    \/ PrefixOf(committed[r2], committed[r1])
====
```

### 4.3 Two-Phase Successors: Jolteon, HotStuff-2, Fast-HotStuff

HotStuff's third phase is the price of combining responsiveness with linear view-change. Three successors remove it:

- **Jolteon / DiemBFT.** Deployed in the Diem (ex-Libra) blockchain, Jolteon keeps the chained structure but adopts a **two-chain commit rule**, recovering safety with a strengthened voting rule: replicas vote only if the proposal's QC is at least as fresh as their highest voted QC, and view-change carries the highest QC forward explicitly [4]. Latency drops by one round trip per commit at the cost of a more delicate liveness argument under consecutive faulty leaders.
- **HotStuff-2** [7]. Two-phase latency *without* the strengthened voting rule: the happy path uses two voting rounds, and view-change uses a **timeout certificate (TC)** — 2f + 1 timeout messages carrying replicas' highest QCs — so the new leader always learns the freshest lock. The concession: HotStuff-2 is not responsive in the *unhappy* path (TC assembly waits for Δ), which measurements show rarely matters.
- **Fast-HotStuff** [4]. Targets the *forking attack* on chained protocols, where a Byzantine leader withholds QCs to create competing branches and stall commits. It adds a proof-of-aggregation to blocks on the unhappy path so replicas can detect withheld QCs and blame the leader, at the price of slightly larger blocks during view-changes.

| Variant | Commit rule | Happy-path phases | Unhappy-path cost | Key mechanism |
|---|---|---|---|---|
| Chained HotStuff | 3-chain | 1 pipelined (≡3) | linear TC-free | generic QC |
| Jolteon/DiemBFT | 2-chain | 1 pipelined (≡2) | linear | strengthened voting |
| HotStuff-2 | 2-chain | 2 | TC waits Δ | timeout certificates |
| Fast-HotStuff | 2-chain | 1 pipelined (≡2) | +aggregation proof | forking accountability |

*Table 2: The two-phase HotStuff family. All retain O(n) per-view communication via threshold QCs.*

![View-change with timeout certificates and rotating leader election](/thesis/ths_1788877762022_a9e2-1.webp)

### 4.4 View-Change Certificates and Rotating Leaders

In PBFT, view-change is the quadratic bottleneck: each replica sends its state to the new leader (O(n) messages each, O(n²) total), and the new leader broadcasts an O(n)-sized new-view message. HotStuff-family protocols make view-change linear:

1. **Timeout messages.** On view timeout, each replica sends `TIMEOUT(highest_qc)` *to the next leader only* — n messages, O(n) words since each carries one QC.
2. **Timeout certificate (TC).** The new leader aggregates 2f + 1 timeouts into a TC (one threshold signature) selecting the freshest QC, and broadcasts one proposal + TC: O(n) words.
3. **Rotating leaders.** Every view has a fresh leader anyway, so there is no "stable leader vs. view-change" dichotomy: a slow leader simply yields to the next view at the same O(n) cost as a normal view — the uniformity that makes pipelining practical at scale.

The safety subtlety is *lock freshness*: the new leader must propose extending the highest locked node, or liveness stalls. The TC solves it by construction — among 2f + 1 timeouts, at least f + 1 are from correct replicas, and any committed node's lock is held by f + 1 correct replicas, so their intersection guarantees the freshest QC in the TC extends every committed node.

### 4.5 DAG-Based Successors: Narwhal–Tusk and Bullshark

Even linear per-view communication leaves the **leader bandwidth bottleneck**: every transaction flows through the leader's broadcast. Narwhal [2] (Danezis, Kogias, Sonnino, Spiegelman) separates *dissemination* from *ordering*:

- **Narwhal (mempool layer).** Every validator reliably broadcasts batches of transactions and builds a round-based DAG where each vertex references 2f + 1 vertices of the previous round (its causal history). Each block is reliably broadcast once and referenced by hash thereafter, so dissemination is load-balanced across all validators and scales out with additional workers per validator.
- **Tusk (ordering layer).** Interprets the DAG with *zero message overhead*: every three rounds form a consensus instance; rounds 1–2 act as all-to-all exchange, round 3 produces a shared perfect coin (threshold signature on the round number) electing a leader vertex from round 1; committing the leader commits its entire causal history deterministically. Liveness holds under full asynchrony via the common coin.
- **Bullshark** [3] (Giridharan, Kokoris-Kogias, Sonnino, Spiegelman) adds a partially synchronous *fast path*: during synchrony it commits in two DAG rounds, falling back to the asynchronous path otherwise — combining DAG-Rider's theoretical optimality with Narwhal's practicality, and resolving the fairness/garbage-collection tension.

The measured effect is dramatic: on a WAN, Narwhal–HotStuff exceeds 130K tx/s at <2s latency (up to 170K tx/s reported, scaling linearly to 600K tx/s with more workers), versus 1,800 tx/s at 1s for plain HotStuff; Tusk achieves ≈140K–160K tx/s at 3–4s latency — 20× the prior asynchronous state of the art [2]. Worst case the DAG pays O(n²) messages per round, but each message is a small vertex of hashes while bulk data travels once through reliable broadcast — amortized, throughput scales with aggregate validator bandwidth rather than leader bandwidth.

![Linear vs quadratic communication complexity comparison](/thesis/ths_1788877762022_a9e2-2.webp)

---

## 5 Empirical Results and Proofs

### 5.1 The Three-Chain Safety Theorem (Proof)

> **Theorem (Chained HotStuff safety):** No two correct replicas commit conflicting nodes at the same height. *Proof.* Suppose correct *r₁* commits *b₁* via three-chain *(v, v+1, v+2)* and correct *r₂* commits *b₂* via *(u, u+1, u+2)*, with *v ≤ u*, at the same height. The commit QC of view *v+2* contains votes from a quorum *Q₁*; the pre-commit lock for *b₂*'s chain at view *u* (or any view ≥ v) required votes from quorum *Q₂*. *Q₁ ∩ Q₂* contains a correct replica *r* that voted for *b₁*'s chain and hence locked on it; *r* votes only for nodes extending its lock, so *b₂* extends *b₁* at every height ≤ height(*b₁*); at equal height, *b₂ = b₁*. ∎ [1, §4]

The argument uses only quorum intersection and the monotonic-lock invariant, so it transfers unchanged to Jolteon's two-chain rule (with the strengthened voting rule compensating for the missing phase) and to HotStuff-2's TC-based view-change.

### 5.2 Liveness and Responsiveness

> **Theorem (Liveness after GST):** After GST, with a correct leader and Δ-bounded delivery, chained HotStuff commits a new block every O(δ) time, where δ is the actual network delay. *Proof sketch.* Views advance on QC formation — no Δ waits in the happy path; a correct leader's proposal reaches all correct replicas in δ, votes return in δ, the QC forms in 2δ; three consecutive correct leaders (guaranteed within f + 1 views by rotation) produce a three-chain. View-change costs one TC round trip. ∎

Responsiveness is what separates the HotStuff family from Tendermint (which idles a full δ per decision [6]) and from HotStuff-2's unhappy path.

### 5.3 Measured Throughput and the 100K-tps Regime

Published WAN evaluations give the following picture [1,2,6]:

| System | Throughput | Latency | Setup |
|---|---|---|---|
| HotStuff (100 replicas) | comparable to BFT-SMaRt | seconds | linear failover [1] |
| Plain HotStuff | ≈1,800 tx/s | ≈1 s | WAN [2] |
| Narwhal–HotStuff | >130K tx/s (up to 170K) | <2–2.5 s | WAN, workers scale to 600K tx/s [2] |
| Tusk | ≈140K–160K tx/s | ≈3–4 s | WAN, asynchronous [2] |
| Tendermint (n=16) | ≈90–150 tx/s | high | degrades fast with n [6] |

*Table 3: Reported WAN measurements. The two-order-of-magnitude jump from HotStuff to Narwhal–HotStuff is architectural — dissemination decoupled from ordering — not an implementation artifact.*

The pipeline analysis of [5] explains *why* plain chained HotStuff plateaus: with rotating leaders and pipeline depth 4, the busiest (leader) node load is Θ(1) per view in message *count*, but each message carries the full block — throughput is bounded by leader egress bandwidth divided by block size. Narwhal removes exactly this term by spreading dissemination across all validators, which is why worker scale-out increases throughput linearly *without* latency increase [2].

---

## 6 Limitations

1. **Partial synchrony is load-bearing.** All HotStuff-family liveness claims assume GST eventually arrives. Under sustained asynchrony, chained protocols stall while Tusk/Bullshark keep ordering — the precise motivation for the DAG line [2,3].
2. **Threshold-signature cryptography.** BLS aggregation is not free: pairing operations cost milliseconds, distributed key generation is a trusted-setup or interactive protocol, and rogue-key attacks require proofs of possession. At 100K+ tx/s, per-view QC verification CPU becomes a first-order term that message-counting analyses omit.
3. **Leader fairness and censorship.** Rotating leaders bound Byzantine damage but do not guarantee fair inclusion: a faulty leader can censor transactions for its views, and correct leaders order arbitrarily within a block. DAG protocols improve censorship resistance but add subtleties in leader-vertex election.
4. **The unhappy path still bites.** Chained protocols degrade sharply under consecutive faulty leaders: each failed view costs a full Δ-scale timeout, and the three-chain rule needs three *consecutive* successful views. HotStuff-2's TC wait and Fast-HotStuff's forking proofs add overhead exactly when the system is already stressed [4,7].
5. **DAG costs: memory and complexity.** Narwhal-style DAGs trade the leader bottleneck for unbounded-memory risk (mitigated by garbage collection with weak links [3]), subtler liveness arguments (common-coin proofs), and higher baseline latency (3–4s for Tusk vs. ~1s for HotStuff [2]).
6. **Evaluation comparability.** Published numbers span different hardware, transaction sizes, batching policies, and WAN topologies; "100K TPS" is a regime claim, not a portable benchmark.

---

## 7 Conclusion

HotStuff's contribution was twofold: a concrete protocol achieving responsiveness with linear communication, and a *framework* — phases, QCs, voting and commit rules — in which the entire BFT design space can be expressed and compared [1]. The post-HotStuff decade has explored that space along three axes: **fewer phases** (Jolteon/DiemBFT, HotStuff-2, Fast-HotStuff recovering two-round latency), **cheaper view-changes** (timeout certificates and per-view rotation making failover as cheap as the happy path), and **no leader bottleneck at all** (Narwhal–Tusk and Bullshark decoupling dissemination from ordering to reach 130K–170K tx/s on a WAN [2,3]).

The through-line is a single engineering principle: *move work off the critical path of the leader*. Threshold signatures moved vote aggregation off the quadratic all-to-all mesh; chaining moved phases off sequential rounds into a pipeline; DAG mempools moved data dissemination off the leader entirely. Each step preserved the safety invariant — quorum intersection plus monotonic locks — while attacking the next binding throughput constraint.

Open problems remain: fair ordering under Byzantine leaders, post-quantum threshold signatures with linear aggregation, formally verified implementations of the full chained-plus-DAG stack, and consensus that degrades gracefully when the synchrony assumption fails. The three-chain was never the point — the point was learning to see every BFT protocol as a pipeline of certificates, and then asking what else can be pipelined.

---

## References

[1] Maofan Yin, Dahlia Malkhi, Michael K. Reiter, Guy Golan Gueta, Ittai Abraham. "HotStuff: BFT Consensus in the Lens of Blockchain." *Proc. PODC'19*; full version arXiv:1803.05069. http://arxiv.org/abs/1803.05069

[2] George Danezis, Lefteris Kokoris-Kogias, Alberto Sonnino, Alexander Spiegelman. "Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus." arXiv:2105.11827, 2021. http://arxiv.org/abs/2105.11827

[3] Neil Giridharan, Lefteris Kokoris-Kogias, Alberto Sonnino, Alexander Spiegelman. "Bullshark: DAG BFT Protocols Made Practical." arXiv:2201.05677, 2022. http://arxiv.org/abs/2201.05677

[4] Mohammad M. Jalalzai, Jianyu Niu, Chen Feng, Fangyu Gai. "Fast-HotStuff: A Fast and Robust BFT Protocol for Blockchains." arXiv:2010.11454. https://arxiv.org/pdf/2010.11454v10

[5] K. Boke et al. "On the Performance of Pipelined HotStuff." arXiv:2107.04947. http://arxiv.org/pdf/2107.04947

[6] "Bottlenecks in Blockchain Consensus Protocols" (HotStuff/Tendermint/Streamlet throughput–latency comparison). arXiv:2103.04234. https://arxiv.org/pdf/2103.04234

[7] "HotStuff-2 vs. HotStuff: The Difference and Advantage." arXiv:2403.18300, 2023. https://arxiv.org/html/2403.18300v1
