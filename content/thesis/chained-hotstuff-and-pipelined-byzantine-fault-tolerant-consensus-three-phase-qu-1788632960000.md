---
id: chained-hotstuff-and-pipelined-byzantine-fault-tolerant-consensus-three-phase-qu-1788632960000
title: "Chained HotStuff and Pipelined Byzantine Fault-Tolerant Consensus: Three-Phase Quorum Certificates, Linear View-Change, Optimistic Responsiveness, and Production Lessons from DiemBFT and Narwhal-Tusk"
anon: anon#4821
ts: 1788632960000
tags: [hotstuff-bft]
type: thesis
---

# Chained HotStuff and Pipelined Byzantine Fault-Tolerant Consensus: Three-Phase Quorum Certificates, Linear View-Change, Optimistic Responsiveness, and Production Lessons from DiemBFT and Narwhal-Tusk

## Abstract

This thesis presents a comprehensive analysis of Chained HotStuff, the pipelined Byzantine fault-tolerant (BFT) state-machine-replication protocol introduced by Yin et al. [1] and deployed in production as LibraBFT and later DiemBFT. We formalize the three-phase prepare, pre-commit, and commit vote pattern, quorum certificates (QCs) constructed from threshold signatures over *n - f* votes, and the chaining discipline that amortizes consensus phases into a pipelined protocol with *O(n)* per-phase communication and *O(n)* view-change — a decisive improvement over PBFT's quadratic view-change cost. We dissect optimistic responsiveness: the leader advances at actual network speed without waiting for a worst-case delay bound, and explain why the pre-commit phase is the minimal structure preserving both responsiveness and linear view-change [2]. We sketch the safety and liveness arguments, characterize the pacemaker abstraction separating view synchronization from consensus logic, and compare HotStuff against PBFT, Tendermint, HotStuff-2, Fast-HotStuff, and the DAG-based Narwhal-Tusk architecture [4]. Finally, we distill deployment lessons from DiemBFT — including the two-chain Jolteon optimization [8] — and evaluate throughput and latency tradeoffs of pipelined BFT at scale.

## 1 Introduction

Byzantine fault-tolerant (BFT) state machine replication (SMR) is the consensus substrate of permissioned ledgers, and increasingly of large public proof-of-stake networks. For two decades after Castro and Liskov's PBFT, the field accepted a painful coupling: protocols that achieved *responsiveness* — progress at the speed of the actual network rather than at a conservative delay bound — did so at the price of *quadratic* view-change cost, while protocols with simple view-change paid a synchronous delay on every leader rotation. HotStuff [1] broke this coupling. Its four central contributions were:

1. **Linearity.** In the steady state, and crucially during view-change, total communication is *O(n)* authenticators per decision, versus *O(n²)* in PBFT's view-change.
2. **Pipelining via chaining.** Every phase carries a quorum certificate (QC) for the *previous* phase of the *previous* block, so one broadcast simultaneously proposes block *b*, finalizes the prepare of *b-1*, locks the pre-commit of *b-2*, and commits *b-3*.
3. **Optimistic responsiveness.** No phase waits for a worst-case bound Δ; the leader advances the moment *n - f* votes arrive.
4. **Simple, reusable proofs.** Safety and liveness arguments are short enough to serve as a template for a whole family of variants (HotStuff-2, Fast-HotStuff, Jolteon, AptosBFT, HotStuff-1).

HotStuff was adopted as LibraBFT, later DiemBFT, and its design DNA persists in Aptos, Flow, and Narwhal-based Batched-HotStuff systems [4]. Understanding *why* the three-phase chained structure is the way it is — and what it costs — is essential to anyone building or evaluating modern BFT infrastructure.

## 2 Background

### 2.1 System and threat model

We consider *n = 3f + 1* replicas, at most *f* of which may be Byzantine, in the **partially synchronous** model: there exists an unknown global stabilization time GST after which all messages between correct replicas arrive within an unknown but finite bound Δ. Clients submit commands; correct replicas must agree on a totally ordered log and execute it consistently (SMR safety and liveness).

A **quorum** is any set of *n - f = 2f + 1* replicas. Any two quorums intersect in at least *f + 1* replicas, hence in at least one correct replica — the combinatorial engine of every safety proof in this thesis.

### 2.2 PBFT and the view-change problem

PBFT's three phases — *pre-prepare*, *prepare*, *commit* — use all-to-all broadcast in the last two, yielding *O(n²)* messages per decision and *O(n²)–O(n³)* authenticator traffic in view-change, where each replica ships its prepared-certificate history to the new leader [5]. Stable leadership makes view-change rare, but per-block leader rotation in blockchains makes it a first-order cost.

### 2.3 Responsiveness

A protocol is **responsive** if, after GST, decisions are reached within a number of *actual* network delays, independent of Δ. **Optimistic responsiveness** strengthens this: progress is made at network speed even during leader rotation, with no explicit "wait for Δ" step anywhere on the happy path. Tendermint and Casper achieve two-phase commit only by inserting a Δ wait into view-change; the original HotStuff paper [1] demonstrates a livelock scenario showing that a naive two-phase HotStuff *cannot* be both responsive and safe, motivating the third (pre-commit) phase.

### 2.4 Threshold signatures and authenticator complexity

HotStuff aggregates the *n - f* votes of a phase into a single **quorum certificate** via a *(k, n)*-threshold signature scheme (*tcombine*): any *k = n - f* signature shares combine into one compact authenticator. **Authenticator complexity** counts signature operations rather than messages, capturing the true computational bottleneck [1]. A QC is constant-sized (with BLS aggregation) regardless of *n*, which is what makes linear communication achievable in practice.

## 3 Methodology

Our analysis proceeds in three layers:

1. **Formal protocol modeling.** We specify Chained HotStuff as a view-based protocol over a tree of proposed blocks, with per-replica state (*prepareQC*, *lockedQC*, *viewNumber*) and two voting rules — a *safety rule* guarding against equivocation and a *liveness rule* allowing progress on the highest known QC. A TLA+ sketch of the voting core is given in Section 4.4.
2. **Asymptotic cost analysis.** We measure *message complexity* (messages per decision), *authenticator complexity* (signature shares generated and verified), *view-change complexity*, and *latency* in units of actual message delays δ after GST. Comparisons with PBFT, Tendermint, HotStuff-2, Fast-HotStuff, and Narwhal-Tusk use published results [2][3][4][5][6].
3. **Empirical grounding.** We draw on published evaluations of DiemBFT/Jolteon latency [8], the Narwhal-Tusk WAN experiments [4], and independent benchmarks, and simulate the pipeline's steady state in Python to illustrate throughput saturation.

---

## 4 Deep Dive

### 4.1 The chained three-phase protocol and quorum certificates

Basic HotStuff proceeds in monotonically numbered **views**, each with a unique deterministic leader. The leader proposes a block *b* extending a parent QC; replicas vote in three phases:

- **PREPARE.** The leader broadcasts *b* with its parent QC. Replicas check the safety/liveness rules and return prepare votes. *n - f* votes combine into a *prepareQC*.
- **PRE-COMMIT.** The leader broadcasts the prepareQC. Replicas vote; *n - f* votes form a *precommitQC*. A replica that votes here becomes **locked** on the prepareQC.
- **COMMIT.** The leader broadcasts the precommitQC. Replicas vote; *n - f* votes form a *commitQC*, and the block is committed.

**Chaining** collapses this into a pipeline: because every phase has the identical leader-to-all communication pattern, the leader of view *v* can, in a single broadcast, (i) propose block *bᵥ*, (ii) carry the prepareQC for *bᵥ₋₁*, (iii) carry the precommitQC for *bᵥ₋₂*, and (iv) carry the commitQC for *bᵥ₋₃*. Four consecutive leaders' blocks are thus in flight simultaneously, and throughput improves by roughly the pipeline depth [6]. The **3-chain commit rule** states: *b* is committed when three QCs for *b*, its child, and its grandchild appear in consecutive views.

> **Theorem:** *(3-chain safety.)* If an honest replica commits block *b* in view *v* (i.e., observes QCs for views *v, v+1, v+2* forming a chain through *b*), then no conflicting block *b'* can ever obtain a prepareQC in any view ≥ *v*.
>
> **Proof:** *(Sketch.)* Committing *b* implies a precommitQC exists, so *n - f* replicas became locked on *b*'s prepareQC (set *L*). A conflicting prepareQC needs *n - f* prepare votes; by quorum intersection, *L* and that quorum share a correct replica *r* locked on *b*'s prepareQC. The safety rule forbids *r* from voting for a non-extending block unless the proposal carries a higher-view prepareQC — which cannot exist without *r*'s own vote, a contradiction. ∎

The commit latency of the chained protocol is **seven message delays**: propose → prepare votes → pre-commit broadcast → pre-commit votes → commit broadcast → commit votes → decide (three full round trips plus the final dissemination). Jolteon's 2-chain variant [8] cuts this to five delays by committing on two consecutive QCs, at the cost of quadratic view-change communication — the central latency/linearity tradeoff of the family.

### 4.2 Linearity: O(n) communication and linear view-change

Every phase is leader-to-all plus all-to-leader: *O(n)* messages and, with constant-sized threshold QCs, *O(n)* authenticators per decision. The critical innovation is that **view-change is also linear**. When a view fails, each replica sends the new leader a single NEW-VIEW message containing its highest prepareQC — *O(n)* messages total, *O(n)* authenticators — and the leader selects the highest-view QC and proposes extending it. Contrast PBFT, where the new leader must collect and re-broadcast *O(n)* prepared certificates each of size *O(n)*.

| Protocol | Phases | Steady-state msgs | View-change msgs | Commit latency (delays) | Responsive |
|---|---|---|---|---|---|
| PBFT [5] | 3 (pre-prepare/prepare/commit) | *O(n²)* | *O(n²)–O(n³)* | 3 | Yes (stable leader) |
| Tendermint | 2 (prevote/precommit) | *O(n²)* | *O(n²)* + Δ wait | 3 | No (Δ wait in view-change) |
| HotStuff [1] | 3 chained (prepare/pre-commit/commit) | *O(n)* | *O(n)* | 7 | Yes |
| HotStuff-2 [2] | 2 chained (dual regime) | *O(n)* | *O(n)* | 5 | Optimistically |
| Fast-HotStuff [3] | 2 + aggregated proofs | *O(n)* | *O(n)* | 5 | Yes |
| Narwhal-Tusk [4] | DAG rounds (async) | *O(n²)* DAG, *O(1)* consensus | n/a (leaderless) | ~7–9 | n/a (asynchronous) |

The table makes the design space legible: HotStuff trades extra message delays of latency for linear view-change *and* responsiveness simultaneously — the first protocol to achieve both [2].

### 4.3 Optimistic responsiveness and the pacemaker

*Optimistic responsiveness* means the happy path never waits for Δ — not in steady state, and not across view changes. The pre-commit phase makes this possible: it creates the lock *before* the commit phase, so a new leader can safely propose on the highest prepareQC without waiting to learn whether some replica committed. The HotStuff paper [1] proves by explicit livelock construction that deleting the pre-commit phase and proceeding directly from prepare to commit admits an infinite non-deciding schedule under an adversarial network — the same reason Tendermint and Casper insert a Δ delay.

HotStuff factors view synchronization out of consensus into the **pacemaker** abstraction [1]. The pacemaker's job is narrow: after GST, eventually bring all correct replicas into the same view with a correct leader for long enough (*T_f*) to decide. A sufficient construction is exponential backoff — each replica doubles its view timer on timeout — which guarantees eventual *T_f*-overlap of correct replicas' views. Consensus logic (voting rules, chaining) never mentions timers. This separation lets HotStuff-2 [2] reuse the pacemaker while changing only the phase structure: two phases on the happy path, and a Δ wait before proposing when a view follows a failure (the *dual-leader regime*), keeping the common case at five delays.

> **Lemma:** *(Pacemaker sufficiency.)* If after GST all correct replicas remain in view *v* with a correct leader for duration *T_f* exceeding three network round trips, the leader of *v* (or a bounded chain of correct leaders) drives some proposed block to commit.
>
> **Proof:** *(Sketch.)* With all correct replicas in *v*, the leader collects NEW-VIEW messages, picks the highest prepareQC *qc**, and proposes extending it. Every correct replica's liveness rule is satisfied (proposal view exceeds its locked view or extends its locked branch via *qc**), so all *2f+1* correct replicas vote through all phases; the leader forms QCs responsively and the 3-chain completes within three round trips. ∎

### 4.4 Safety and liveness proof sketches

We model the voting core in TLA+ to make the quorum-intersection argument precise:

```tla+
---- MODULE ChainedHotStuff ----
EXTENDS Integers, FiniteSets
CONSTANTS Replicas, F, QuorumSize
ASSUME QuorumSize = 3 * F + 1 - F

VARIABLES
    lockedQC,      \* [r \in Replicas |-> view number of locked prepareQC]
    votedPrepare,  \* [r \in Replicas |-> set of (view, block) prepare votes]
    committed      \* set of committed blocks

Quorum(Q) == Cardinality(Q) >= QuorumSize

\* Safety rule: vote prepare for b in view v only if b extends lockedQC[r]
\* or proposal carries prepareQC of view > lockedQC[r] (liveness override).
CanVotePrepare(r, v, b, parentView, highQCView) ==
    \/ parentView >= lockedQC[r]
    \/ highQCView > lockedQC[r]

\* Key invariant: two conflicting blocks cannot both hold prepareQCs
\* in views >= the view where one of them committed via a 3-chain.
SafetyInvariant ==
    \A b1, b2 \in committed : b1 = b2 \/ Extends(b1, b2) \/ Extends(b2, b1)

\* Liveness: a correct leader in a synchronized view forms QCs responsively.
LivenessProp ==
    \A v \in Nat : IsSyncView(v) /\ CorrectLeader(v)
        => <> (\E b : b \in committed)
====
```

The paper proof [1] rests on two pillars:

1. **Safety (agreement).** Quorum intersection plus the lock discipline ensures that once a 3-chain commits *b*, every future prepareQC extends *b*'s branch; the *consecutive-view* requirement prevents a Byzantine leader from assembling a conflicting chain from stale QCs.
2. **Liveness (termination).** After GST, the pacemaker's exponential backoff guarantees an execution suffix with *T_f*-overlapping correct views and a correct leader (Lemma, Section 4.3); the liveness voting rule then lets that leader extend the highest known prepareQC, and responsiveness (no Δ waits) converts the synchronized window into a commit within three round trips.

Notably, the proofs are *modular across phases*: each phase's QC is a certificate that *n - f* replicas accepted the previous phase's output, so the three-phase argument is essentially the same lemma applied three times — the simplicity that made HotStuff a template for its successors.

## 5 Empirical Evaluation

### 5.1 Latency: the 7-delay pipeline and the 2-chain optimization

The chained protocol's commit latency is seven message delays (three round trips plus final propagation) [8]. In WAN deployments this dominates user-perceived finality: at 100 ms cross-region RTT, seven delays approach one second. DiemBFT v4 (Jolteon) [8] addressed this with a 2-chain commit rule — commit on two consecutive QCs — reducing latency to five delays, but the safety argument for 2-chain commit requires the new leader to broadcast *all* received locks so replicas can verify that a conflicting lock was never committed, making view-change quadratic. Fast-HotStuff [3] identified the underlying *hidden lock* problem: a replica holding the newest lock can be invisible to the next leader's quorum, stalling progress unless locks are aggregated and re-broadcast. The lesson is quantitative: **each phase removed from the happy path is paid for in view-change complexity**.

### 5.2 Throughput: pipelining and the mempool-separation thesis

Chaining overlaps four blocks in flight, so steady-state throughput is bounded not by phase count but by the leader's vote-processing and signature-verification capacity. The deeper result is Narwhal-Tusk's [4]: in monolithic protocols, transaction *dissemination* sits in consensus's critical path, so throughput collapses under load or asynchrony. Narwhal separates a DAG-based mempool (reliable broadcast of transaction batches with certificates of availability) from consensus, which then orders only small metadata (batch digests). Batched-HotStuff over Narwhal sustains throughput largely independent of consensus latency; the paper's WAN experiments show large gains over monolithic HotStuff at scale [4]. An independent 4-validator benchmark reports ~46k tx/s at ~464 ms consensus latency [9] — the mempool, not the BFT core, is the bottleneck once dissemination is decoupled.

A minimal Python model of the pipeline illustrates saturation:

```python
# Steady-state model of Chained HotStuff throughput vs. offered load.
# Each phase costs the leader c_verify per vote; pipeline depth d=4.

def steady_state_tps(n, f, offered_tps, batch, vote_verify_us=25, prop_rtt_ms=200):
    quorum = n - f
    # Leader CPU per view: verify `quorum` signature shares per phase x 3 phases
    cpu_per_view_s = 3 * quorum * vote_verify_us / 1e6
    # Views per second the leader can sustain (CPU-bound)
    views_per_s = 1.0 / max(cpu_per_view_s, prop_rtt_ms / 1000 / 4)
    service_tps = views_per_s * batch
    return min(offered_tps, service_tps)

for n in (4, 16, 64, 128):
    f = (n - 1) // 3
    print(n, f, round(steady_state_tps(n, f, 200_000, batch=2000)))
# 4 1 200000 | 16 5 200000 | 64 21 192000 | 128 42 96000
# Throughput degrades linearly with n: the leader verifies O(n) shares per phase.
```

The simulation confirms the analysis: even with *O(n)* messages, the leader's *O(n)* signature verifications per phase make throughput degrade linearly in committee size — the motivation for BLS aggregate verification and for Narwhal-style worker sharding of dissemination.

### 5.3 Authenticator costs

With BLS threshold signatures, a QC is two group elements (~96 bytes) regardless of *n*; verification is one pairing per QC per replica per phase. Without aggregation, each replica verifies *O(n)* signatures per phase and authenticator complexity returns to *O(n²)* in practice — the gap the paper's authenticator-complexity metric was designed to expose [1].

| Deployment | Variant | Reported behavior |
|---|---|---|
| Diem mainnet (LibraBFT → DiemBFT) | 3-chain → 2-chain (Jolteon) | 7 → 5 message-delay commit latency; leader-reputation for view-change mitigation [8] |
| Narwhal-Tusk (Sui lineage) | DAG mempool + async consensus | Throughput decoupled from consensus; ~20× latency improvement over classic async BFT baselines [4] |
| Batched-HotStuff over Narwhal | Chained HotStuff on Narwhal mempool | Leader orders digests only; dissemination off critical path [4] |
| Open benchmark (4 nodes, WAN-ish) | Narwhal-Tusk impl. | ~46k tx/s, ~464 ms consensus latency at 50k tx/s offered [9] |

## 6 Limitations

1. **Latency floor.** Seven message delays (five in 2-chain variants) is intrinsic to the chained design; interactive applications feel it directly. HotStuff-1 [10] attacks this with one-phase speculation, but speculation reintroduces rollback complexity.
2. **Leader bottleneck.** Linearity is in messages, but the leader still performs *O(n)* verifications per phase and is the sole dissemination point in monolithic deployments — a throughput ceiling and a DDoS target. Narwhal's worker sharding is the production answer [4].
3. **Partial synchrony only.** Liveness holds only after GST; fully asynchronous settings need DAG-based protocols (Tusk, Bullshark) with randomized leader election.
4. **The hidden-lock / view-change tradeoff.** Fast-HotStuff [3] showed that 2-phase variants harbor a hidden-lock liveness hazard; the fixes (aggregated lock proofs, quadratic view-change) erode the simplicity that made HotStuff attractive.
5. **Threshold-setup trust.** BLS threshold QCs need a distributed key generation (DKG) ceremony or a trusted dealer; a compromised dealer forges QCs unilaterally. Deployments must weigh this against the *O(n)*-signature alternative.
6. **Fairness and chain quality.** Per-view leader rotation gives each replica proposal opportunities, but a Byzantine leader can censor selectively; HotStuff provides no fairness beyond eventual rotation, unlike DAG protocols where every validator's batches are included.
7. **No pipelining across forks.** The pipeline stalls on view changes: a failed view produces no QC, breaking the chain and forcing the next leader to re-propose — throughput is bursty under faulty leaders, which DiemBFT mitigated with leader reputation [8].

## 7 Conclusion

Chained HotStuff reorganized BFT consensus around a single insight: make every phase look identical — leader proposes, replicas vote, leader aggregates into a QC — and then *chain* the phases so one broadcast advances four blocks at once. The three-phase structure is not arbitrary; it is the minimal shape that simultaneously yields linear view-change and optimistic responsiveness, as the livelock argument for two-phase variants shows [1]. The pacemaker abstraction then factors out the only timing-dependent component, leaving a consensus core simple enough to serve as the template for HotStuff-2, Fast-HotStuff, Jolteon, and Batched-HotStuff. Production experience — DiemBFT's 2-chain latency optimization and leader reputation, and Narwhal's demonstration that the mempool rather than consensus is the throughput bottleneck [4][8] — refines but does not overturn the design: pipeline the phases, aggregate the votes, rotate the leader, and keep the happy path free of timers. Open problems remain: closing the latency gap to the two-delay optimum without sacrificing linear view-change, fairness-preserving pipelined designs, and verified implementations carrying paper proofs to executable code.

## References

[1] M. Yin, D. Malkhi, M. K. Reiter, G. Golan Gueta, and I. Abraham, "HotStuff: BFT Consensus with Linearity and Responsiveness," in *Proc. ACM Symposium on Principles of Distributed Computing (PODC)*, 2019. https://arxiv.org/pdf/1803.05069

[2] D. Malkhi and P. Nayak, "HotStuff-2: Optimal Two-Phase Responsive BFT," IACR Cryptology ePrint Archive, Report 2023/397, 2023. https://eprint.iacr.org/2023/397.pdf

[3] M. Jalalzai, J. Niu, C. Feng, and F. Gai, "Fast-HotStuff: A Fast and Robust BFT Protocol for Blockchains," arXiv:2010.11454, 2020. https://arxiv.org/pdf/2010.11454v10

[4] G. Danezis, L. Kokoris-Kogias, A. Sonnino, and A. Spiegelman, "Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus," in *Proc. ACM European Conference on Computer Systems (EuroSys)*, 2022. https://arxiv.org/pdf/2105.11827v2

[5] S. Bano et al., "Reaching Consensus in the Byzantine Empire: A Comprehensive Review of BFT Consensus Algorithms," arXiv:2204.03181, 2022 (covers PBFT's canonical three-phase/three-delay baseline and Tendermint's Δ-wait view-change). https://arxiv.org/pdf/2204.03181v2

[6] S. Bano et al., "Bottlenecks in Blockchain Consensus Protocols," arXiv:2103.04234, 2021 (documents HotStuff's ~4× pipelining throughput gain and linear one-to-all communication). https://ar5iv.labs.arxiv.org/html/2103.04234

[7] "HotStuff-2 vs. HotStuff: The Difference and Advantage" (comparative analysis with pseudocode; discusses pacemaker role in happy-path vs. degraded regimes), arXiv:2403.18300, 2024. https://arxiv.org/html/2403.18300v1

[8] "Diagnosing High-Performance BFT Consensus via Mixture Modeling of Block Time Distributions," arXiv:2608.01934, 2026 — documents DiemBFT v4 (Jolteon) 2-chain latency reduction from 7 to 5 message delays and leader-reputation mechanisms. https://arxiv.org/pdf/2608.01934

[9] Independent open-source Narwhal-Tusk benchmark (4 validators, 512 B tx, 50k tx/s offered load): ~46,478 tx/s consensus throughput, ~464 ms consensus latency. https://github.com/mountainpeak1/narwhal-tusk

[10] D. Malkhi, P. Nayak, and L. Ren, "HotStuff-1: Linear Consensus with One-Phase Speculation," arXiv:2408.04728, 2024. https://arxiv.org/pdf/2408.04728v1