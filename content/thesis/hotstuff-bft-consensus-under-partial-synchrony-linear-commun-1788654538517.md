---
title: "HotStuff BFT Consensus under Partial Synchrony: Linear Communication Complexity, Three-Phase Pipelining, Pacemaker Liveness, and Threshold Signatures for 100-Node Deployments"
id: ths_1788654538517_2290
anon: anon#JZMK
ts: 1788654538517
type: thesis
images: ["ths_1788654538517_2290-0.webp", "ths_1788654538517_2290-1.webp", "ths_1788654538517_2290-2.webp", "ths_1788654538517_2290-3.webp"]
---

# HotStuff BFT Consensus under Partial Synchrony: Linear Communication Complexity, Three-Phase Pipelining, Pacemaker Liveness, and Threshold Signatures for 100-Node Deployments

## Abstract

HotStuff is a leader-based Byzantine fault-tolerant replication protocol for the partially synchronous model that simultaneously achieves *responsiveness* — consensus at the pace of actual network delay $\delta$ rather than the worst-case bound $\Delta$ — and *linear* $O(n)$ communication complexity [1]. It replaces PBFT's $O(n^2)$ all-to-all voting with a star topology in which each phase leader collects $2f+1$ partial BLS threshold signatures, aggregates them into a constant-size *quorum certificate* (QC), and broadcasts once. Three identical phases — *prepare*, *precommit*, *commit* — are chained across consecutive views so a single message finalizes one block while advancing two others, yielding pipelined block production at one round per block under a correct leader. Liveness is decoupled from safety through the *Pacemaker*, a view-synchronization module that intervenes only on leader failure. This thesis reconstructs the protocol, derives the safety and liveness arguments, analyzes threshold-signature aggregation, and surveys production deployments — Diem's LibraBFT/DiemBFT 100-validator mainnet [6] and Flow — arguing that HotStuff's reduction of BFT consensus to pipelined QC formation made partially synchronous BFT viable at the hundred-node scale.

---

## 1. Introduction

The problem of *Byzantine fault-tolerant state machine replication* — replicating a deterministic service across $n = 3f+1$ replicas such that at most $f$ may behave arbitrarily — is among the most consequential in distributed systems. The classical solution, Practical Byzantine Fault Tolerance (PBFT) of Castro and Liskov [2], demonstrated in 1999 that BFT agreement could be achieved at network speed with $O(n^2)$ messages per agreement instance in the *partially synchronous* model, where message delays are bounded by an unknown $\Delta$ only after an unknown *Global Stabilization Time* (GST) [3]. For two decades PBFT remained the reference point: every leader-based BFT protocol was either a variant of it or a reaction against its quadratic view-change protocol, which requires each replica to broadcast $O(n)$ messages to all others and has been widely regarded as the most intricate component of the protocol.

HotStuff, introduced by Yin, Malkhi, Reiter, Gueta, and Abraham in 2019 [1], resolves both deficiencies simultaneously. First, it achieves **linear communication complexity**: in each phase the leader exchanges messages with each replica exactly once, and replicas never communicate directly. Second, it achieves **responsiveness**: after GST, a correct leader advances consensus at the rate of the actual network delay $\delta$ rather than waiting for $\Delta$. HotStuff is the first partially synchronous BFT replication protocol exhibiting both properties [1].

The technical insight is architectural. HotStuff reframes BFT consensus as repeated *quorum certificate* formation: a leader proposes a value, collects $2f+1$ signed votes, combines them into a single constant-size threshold signature, and broadcasts it. Decomposing PBFT's three-phase commit into three *identical* phases — prepare, precommit, commit — each one collect-and-broadcast round yields a simple, regular pipeline. Chaining phases across consecutive views produces *Chained HotStuff*, in which one message simultaneously serves as the commit-phase QC for block $B$, the precommit QC for $B+1$, and the prepare QC for $B+2$; a block commits once a three-chain of QCs extends it. Liveness is extracted into the *Pacemaker*, so the safety core stays minimal — roughly two hundred lines in the reference implementation [1].

This thesis proceeds as follows. Section 2 reviews the theoretical background: the partially synchronous model, the quorum intersection argument, PBFT, and threshold BLS signatures [4]. Section 3 describes the methodology of our reconstruction — an event-driven specification, a Haskell model of the safety core, and a Rust simulation harness. Section 4 presents the deep dive: the three-phase protocol, chained pipelining, the Pacemaker, and threshold-signature QC aggregation. Section 5 sketches the safety and liveness proofs and surveys empirical deployments. Section 6 discusses limitations, and Section 7 concludes.

## 2. Background

### 2.1 The Partially Synchronous Model

Following Dwork, Lynch, and Stockmeyer [3], we consider a system of $n = 3f+1$ replicas, of which at most $f$ are *Byzantine* — they may deviate from the protocol arbitrarily, collude, and send conflicting messages to different replicas. The remaining $n-f \ge 2f+1$ replicas are *correct* and follow the protocol. Communication is authenticated: every message carries an unforgeable signature, and we assume a public-key infrastructure. The network is *partially synchronous*: there exists an unknown time GST and an unknown bound $\Delta$ such that every message sent at time $t \ge \text{GST}$ is delivered by $t + \Delta$. Before GST, delays are unbounded and messages may be lost. Crucially, the protocol never relies on knowing $\Delta$ for *safety*; $\Delta$ is used only for liveness timeouts.

> **Theorem (Quorum Intersection):** Any two quorums of size $2f+1$ in a system of $n = 3f+1$ replicas intersect in at least $f+1$ replicas, hence in at least one correct replica.

*Proof.* $|Q_1 \cap Q_2| = |Q_1| + |Q_2| - |Q_1 \cup Q_2| \ge (2f+1) + (2f+1) - (3f+1) = f+1$. Since at most $f$ replicas are Byzantine, at least one member of the intersection is correct. ∎

This single combinatorial fact underlies every BFT safety argument: a QC formed by $2f+1$ votes cannot be contradicted by a second QC for a conflicting value, because the two QCs share a correct replica that would have had to vote twice.

### 2.2 PBFT: The Classical Reference

PBFT [2] organizes replicas into *views*, each with a designated *primary* ($p = v \bmod n$). The normal case proceeds in three phases:

1. **Pre-prepare:** the primary multicasts $\langle\text{PRE-PREPARE}, v, s, m\rangle_{\sigma_p}$ assigning sequence number $s$ to client request $m$.
2. **Prepare:** each backup validates and multicasts $\langle\text{PREPARE}, v, s, i\rangle_{\sigma_i}$. Replica $i$ is *prepared* on $(v,s,m)$ upon collecting $2f$ matching prepares plus the pre-prepare.
3. **Commit:** each replica multicasts $\langle\text{COMMIT}, v, s, i\rangle_{\sigma_i}$. Replica $i$ *commits* upon collecting $2f+1$ commits, then executes $m$ in sequence-number order and replies to the client.

The all-to-all multicast in phases 2 and 3 costs $O(n^2)$ messages. The *view-change* protocol is worse: on suspecting the primary, each replica multicasts a `VIEW-CHANGE` message containing $O(n)$ prepared certificates, yielding $O(n^3)$ authenticators in the worst case [2].

### 2.3 Threshold Signatures and BLS

A $(t, n)$-threshold signature scheme allows any $t$ of $n$ parties to produce partial signatures on a message that combine into a single signature verifiable against one public key [4]. Boneh, Lynn, and Shacham's BLS construction uses a bilinear pairing $e : \mathbb{G}_1 \times \mathbb{G}_2 \to \mathbb{G}_T$ over elliptic-curve groups of prime order $q$, with a hash-to-curve function $H : \{0,1\}^* \to \mathbb{G}_1$. Each replica holds a secret share $sk_i$; its partial signature is $\sigma_i = sk_i \cdot H(m)$. Given any $t = 2f+1$ partial signatures, Lagrange interpolation in the exponent yields $\sigma = \sum_{i \in S} \lambda_i \sigma_i$, a single $\mathbb{G}_1$ element — 48 bytes on BLS12-381 — verifiable by $e(\sigma, g_2) = e(H(m), pk)$ where $pk$ is the aggregate public key.

The consequence for BFT is decisive: $2f+1$ votes compress into constant size. A QC is $O(1)$ bytes regardless of $n$, verified by a single pairing check. This is the primitive that makes linear communication possible: the leader collects $O(n)$ partial signatures (one per replica, each sent only to the leader) and broadcasts one fanout message containing a constant-size QC.

### 2.4 Tendermint and the Blockchain Lens

Tendermint [5] recast BFT consensus in blockchain terms — validators, blocks, rounds — and introduced the rotating-proposer discipline that HotStuff adopts. HotStuff's framework generalizes this: PBFT, Tendermint, Casper, and DLS are all expressible as instantiations of a common QC-formation pattern [1].

---

## 3. Methodology

Our investigation follows three methods: (1) **analytic reconstruction** of the event-driven formulation (Algorithm 4 of [1]); (2) **executable modeling** — the safety core as a pure Haskell state-transition function with property-based tests of the lock and no-conflicting-QC invariants, plus a Rust discrete-event harness simulating $n=100$ replicas; (3) **deployment archaeology** of LibraBFT/DiemBFT [6], Flow, and Jolteon/Ditto [7]. Quantitative deployment claims are taken from the HotStuff paper's 100+ replica evaluation [1].

---

## 4. Deep Dive

### 4.1 The Three-Phase Core: Prepare, Precommit, Commit

In Basic HotStuff, each view $v$ with leader $L_v$ executes three *identical* phases. Let $\text{QC}(x)$ denote a threshold-signature certificate over value $x$ formed from $2f+1$ votes.

| Phase | Leader action | Replica action | QC produced |
|---|---|---|---|
| **Prepare** | Broadcasts $\langle\text{PREPARE}, v, \text{node}, \text{highQC}\rangle$ | Votes if $\text{node}$ extends $\text{lockedQC}$ or $\text{highQC} \succ \text{lockedQC}$ | $\text{QC}_{\text{prepare}}$ |
| **Precommit** | Collects $2f+1$ prepare-votes, broadcasts $\text{QC}_{\text{prepare}}$ | Updates $\text{lockedQC} \gets \text{QC}_{\text{prepare}}$ on receipt; votes | $\text{QC}_{\text{precommit}}$ |
| **Commit** | Collects $2f+1$ precommit-votes, broadcasts $\text{QC}_{\text{precommit}}$ | Votes | $\text{QC}_{\text{commit}}$ |
| **Decide** | Collects $2f+1$ commit-votes, broadcasts $\text{QC}_{\text{commit}}$ | Executes on receipt | — |

Each phase is exactly one leader-to-all broadcast plus one all-to-leader vote collection: $O(n)$ messages. Three phases yield $O(n)$ total per decision, versus PBFT's $O(n^2)$. The safety rule is the *locking* mechanism: a replica sets `lockedQC` to the prepare-QC of the current view's node, and thereafter votes only for nodes extending `lockedQC` — unless presented with a `highQC` of strictly greater view, which proves that a quorum has moved past the lock (the standard "unlock" escape that preserves liveness without endangering safety).

The following Haskell sketch captures the voting rule, the entire safety-relevant logic of a replica:

```haskell
-- Replica state: (lockedQC, prepareQC, view)
data ReplicaState = RS { lockedQC :: QC, prepareQC :: QC, curView :: View }

voteRule :: ReplicaState -> Proposal -> Maybe Vote
voteRule st p
  | extends (pNode p) (lockedQC st)      = Just (mkVote p)   -- safe extension
  | view (pHighQC p) > view (lockedQC st) = Just (mkVote p)   -- quorum moved on
  | otherwise                            = Nothing            -- withhold vote
```

> **Theorem (Safety within a view):** If two correct replicas commit values $x$ and $x'$ in the same view, then $x = x'$.

*Proof sketch.* Committing requires a commit-QC, i.e., $2f+1$ commit-votes. Commit-votes are cast only after observing a precommit-QC, which requires $2f+1$ precommit-votes, each cast after locking on a prepare-QC for the same node. By quorum intersection, the two commit-QCs share a correct replica, which voted in both — impossible unless the nodes (and hence values) coincide. ∎

Cross-view safety follows from the lock: any QC of a higher view that conflicts with a committed value would require a correct replica to vote against its lock without a superseding `highQC`, contradicting the voting rule [1].

### 4.2 Chained HotStuff: Pipelining Three Phases into One Message

The three phases are structurally identical — each takes a QC as input and produces a QC as output. Chained HotStuff exploits this by *overlapping* phases across consecutive views. In view $v$, the leader proposes a block $B_v$ extending the block certified by the highest known QC. The single vote cast in view $v$ simultaneously serves as:

- the **commit** vote for $B_{v-2}$ (via the QC the proposal carries),
- the **precommit** vote for $B_{v-1}$,
- the **prepare** vote for $B_v$.

A block $B$ is *committed* when three consecutive blocks $B, B{+}1, B{+}2$ each carry QCs forming a *three-chain*: $\text{QC}(B) \gets \text{QC}(B{+}1) \gets \text{QC}(B{+}2)$. Equivalently, the commit rule becomes a *graph* property of the chain rather than a per-view counter. Under a correct leader, the steady state is one block proposed, one QC formed, and one block committed *per view* — the latency per committed block collapses to a single round trip, while throughput is bounded only by signature verification and block propagation.

The pipeline depth of three is not arbitrary: it is exactly the number of phases needed for the lock-commit argument. Two phases suffice for *prepare*-level agreement but not for the commit guarantee; the third phase is what converts a locked value into an irreversible decision.

```tla+
---- MODULE ChainedHotStuff ----
EXTENDS Naturals, FiniteSets
CONSTANTS Replicas, F, Views
VARIABLES chain,    \* sequence of certified blocks
          lockedQC  \* per-replica lock, a function Replicas -> Nat

ThreeChain(c) == Len(c) >= 3
  /\ c[Len(c)-2].qc.view + 1 = c[Len(c)-1].qc.view
  /\ c[Len(c)-1].qc.view + 1 = c[Len(c)].qc.view

CommitRule(c) == ThreeChain(c) => Committed(c[Len(c)-2])
====
```

### 4.3 The Pacemaker: Decoupling Liveness from Safety

The *Pacemaker* is HotStuff's answer to the view-change problem. Rather than embedding timeout and leader-replacement logic in the safety core (as PBFT does), HotStuff factors it into a separate module with a narrow interface: the Pacemaker is responsible for *view synchronization* — ensuring that after GST, all correct replicas eventually spend enough overlapping time in the same view with a correct leader to form QCs.

The mechanism is deliberately simple:

1. Each replica maintains a view timer. On expiry without progress, it multicasts $\langle\text{NEW-VIEW}, v+1, \text{highQC}\rangle$ — a *linear* message, one per replica, sent to the next leader.
2. The leader of view $v+1$ waits for $2f+1$ `NEW-VIEW` messages, selects the highest QC among them, and proposes.
3. Timeout durations increase exponentially (or via the "Fever" optimal synchronizer [8]) until they exceed $\Delta$, guaranteeing that eventually a view lasts long enough for a correct leader to complete three phases.

Crucially, the Pacemaker is *off the critical path* in the common case: with a correct leader, views advance via QCs, not timeouts, so consensus proceeds at network speed $\delta$ — this is precisely responsiveness. Because safety never depends on timing, a misbehaving Pacemaker can only delay liveness, never violate agreement.

The timeout-escalation logic in Rust pseudocode:

```rust
struct Pacemaker {
    view: u64,
    timeout: Duration,   // starts at delta_estimate, doubles on expiry
    high_qc: QC,
}

impl Pacemaker {
    fn on_timeout(&mut self) -> NewViewMsg {
        self.view += 1;
        self.timeout *= 2; // exponential backoff toward exceeding Delta
        NewViewMsg { view: self.view, high_qc: self.high_qc.clone() }
    }
    fn on_qc_formed(&mut self, qc: QC) {
        self.high_qc = max_qc(&self.high_qc, &qc);
        // view advances via QC; timer resets without escalation
    }
}
```

### 4.4 Threshold-Signature QC Aggregation at $n = 100$

At $n = 100$ ($f = 33$), the arithmetic of linear communication becomes concrete. Per phase, the leader receives 67 partial BLS signatures (48 bytes each on BLS12-381, $\approx$ 3.2 KB total inbound) and broadcasts one proposal carrying a constant-size QC. Contrast with PBFT's prepare phase at $n = 100$: $100 \times 99 \approx 10^4$ messages, each carrying signatures, per phase.

Aggregation cost is the price: combining 67 BLS shares via Lagrange interpolation is $O(t)$ cheap group multiplications — well under a millisecond — while QC verification is a *single* pairing, $O(1)$ regardless of $t$. The leader's per-view work is $O(n)$ cheap operations plus $O(1)$ pairings; every replica verifies $O(1)$ pairings per view. The original HotStuff evaluation confirmed that at 100+ replicas, throughput and latency matched BFT-SMaRt while leader failover remained linear [1].

A subtlety: BLS aggregation signs a message including the *view number and block hash*, binding each partial signature to a unique (view, phase) context. This domain separation prevents cross-view replay and is essential to the safety proof's vote accounting.

---

## 5. Empirical Evaluation and Proof Sketches

### 5.1 Safety and Liveness: Proof Sketches

**Safety.** The full safety theorem states: *if two correct replicas commit blocks $B$ and $B'$, then one extends the other* (no forks among committed blocks). Within a view, quorum intersection forbids two conflicting QCs (§4.1). Across views, a committed block's three-chain implies $2f+1$ replicas locked on its prepare-QC; any later conflicting QC requires $2f+1$ votes intersecting the locked set in a correct replica $r$, which votes against its lock only given a superseding `highQC` — and the minimal-view conflicting QC yields a contradiction [1].

**Liveness.** After GST, timeouts eventually exceed $\Delta$. Consider the first view $v$ after GST whose leader is correct and whose duration exceeds $3\Delta$ (three phases plus QC propagation). All correct replicas enter $v$ within $\Delta$ of each other, the leader's proposal reaches all correct replicas, $2f+1$ votes return, and the three phases complete at network speed. Hence every correct replica eventually commits new blocks: liveness holds.

### 5.2 Production Deployments

**Diem (LibraBFT/DiemBFT).** The Diem blockchain adopted a chained-HotStuff variant, LibraBFT, as its core consensus [6]. The DiemBFT v4 paper documents the production design: validators rotate leadership every round, QCs are BLS-aggregated, and the protocol sustained a 100-validator permissioned network with deterministic finality in seconds [6]. DiemBFT's refinements are instructive: *round* replaces *view* as the unit of leadership rotation (fairness), and the Pacemaker uses a fixed timeout with a nil-block fallback so a faulty leader cannot stall a round. Forensic analysis [9] further shows LibraBFT admits the strongest possible forensic support — given a safety violation (possible only when $f > n/3$), on-chain QCs identify at least $f+1$ culpable replicas.

**Flow.** The Flow blockchain employs a HotStuff-derived consensus, adapting the three-chain commit rule to a pipelined architecture with separated node roles. Flow's deployment demonstrates HotStuff's composability: the safety core is unchanged while block *dissemination* is factored into a separate layer — an architectural direction later formalized by Narwhal/Tusk [10].

**Jolteon and Ditto.** Gelashvili et al. [7] extend DiemBFT with a network-adaptive Pacemaker (Jolteon) and an asynchronous fallback (Ditto), showing the Pacemaker abstraction supports graceful degradation: the same safety core runs at network speed under synchrony and falls back to a quadratic asynchronous protocol only when the network deteriorates.

### 5.3 Performance Characteristics

| Metric | PBFT ($n=100$) | HotStuff ($n=100$) |
|---|---|---|
| Messages per decision | $O(n^2) \approx 3 \times 10^4$ | $O(n) \approx 4 \times 10^2$ |
| View-change messages | $O(n^3)$ authenticators | $O(n)$ `NEW-VIEW` |
| QC size | $O(n)$ signatures | $O(1)$ BLS aggregate (48 B) |
| Responsiveness | Yes (normal case) | Yes (all cases) |
| Steady-state block latency | 3 phase RTTs | 1 view RTT (pipelined) |
| Leader failover cost | Quadratic | Linear |

The HotStuff paper's 100+ replica deployment reported throughput and latency *comparable to BFT-SMaRt* — the highly optimized PBFT implementation — while failover communication stayed linear [1].

---

## 6. Limitations

HotStuff's elegance comes with genuine costs that any deployment must confront.

1. **Cryptographic dependence.** Linear communication rests entirely on threshold BLS signatures. Pairing operations are an order of magnitude slower than EdDSA verification, and deployments must manage distributed key generation (DKG) for threshold shares — a nontrivial ceremony at $n = 100$ — while guarding against rogue-key attacks in aggregation [4].
2. **Leader bottleneck and fairness.** All $O(n)$ communication flows through the leader, concentrating bandwidth and making it a natural DoS target. Rotating leadership mitigates targeted attacks, but throughput is bounded by the *slowest* leader's uplink, and a Byzantine leader wastes a full view before the Pacemaker reacts.
3. **Responsiveness is not instant finality.** A block commits only after a three-chain forms — three consecutive correct leaders in the worst case. Under intermittent Byzantine leadership, commit latency degrades gracefully but can stretch to $O(f)$ views.
4. **Chaining couples block production to consensus.** Because each block must extend a certified parent, block *dissemination* cannot outrun consensus. High-throughput designs (Narwhal/Tusk [10], Quorum Store) separate data dissemination from ordering precisely to escape this coupling — at the cost of reintroducing architectural complexity HotStuff sought to remove.

## 7. Conclusion

HotStuff's contribution is best understood as a *reduction*: Byzantine agreement under partial synchrony reduces to repeated, pipelined formation of threshold-signature quorum certificates by a rotating leader, with liveness factored into a replaceable Pacemaker. The three phases are the minimal count supporting a lock-based safety argument; chaining them across views yields pipelined block production at one round per block; BLS aggregation compresses each phase's $2f+1$ votes into constant size, delivering linear communication; and the Pacemaker confines timing assumptions to liveness, preserving responsiveness at network speed.

The production record validates the theory. DiemBFT ran a 100-validator mainnet on these principles [6]; Flow and the Jolteon/Ditto lineage [7] demonstrate the architecture's adaptability; and forensic analysis [9] shows the design strengthens accountability. Open problems remain: optimal *responsive* view synchronization (Fever [8]), DAG-based dissemination preserving HotStuff's simplicity, and post-quantum threshold signatures to replace pairing-based BLS.

---

## References

[1] M. Yin, D. Malkhi, M. K. Reiter, G. G. Gueta, and I. Abraham, "HotStuff: BFT Consensus in the Lens of Blockchain," *arXiv:1803.05069 [cs.DC]*, 2018. A shorter version appeared in *Proc. PODC 2019*. https://arxiv.org/abs/1803.05069

[2] M. Castro and B. Liskov, "Practical Byzantine Fault Tolerance," in *Proc. 3rd Symposium on Operating Systems Design and Implementation (OSDI '99)*, New Orleans, LA, 1999, pp. 173–186. https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance

[3] C. Dwork, N. Lynch, and L. Stockmeyer, "Consensus in the Presence of Partial Synchrony," *Journal of the ACM*, vol. 35, no. 2, pp. 288–323, 1988. https://doi.org/10.1145/42282.42283

[4] D. Boneh, B. Lynn, and H. Shacham, "Short Signatures from the Weil Pairing," in *Advances in Cryptology — ASIACRYPT 2001*, LNCS 2248, Springer, 2001, pp. 514–532. https://www.iacr.org/archive/asiacrypt2001/22480516.pdf

[5] E. Buchman, J. Kwon, and Z. Milosevic, "The Latest Gossip on BFT Consensus," *arXiv:1807.04938 [cs.DC]*, 2018. https://arxiv.org/abs/1807.04938

[6] D. Malkhi et al., "DiemBFT v4: State Machine Replication in the Diem Blockchain," Novi / Diem Association, revised Aug. 2021. https://developers.diem.com/papers/diem-consensus-state-machine-replication-in-the-diem-blockchain/2021-08-17.pdf

[7] R. Gelashvili et al., "Jolteon and Ditto: Network-Adaptive Efficient Consensus with Asynchronous Fallback," *arXiv:2106.10362 [cs.DC]*, 2021. https://arxiv.org/abs/2106.10362

[8] A. Lewis-Pye and I. Abraham, "Fever: Optimal Responsive View Synchronisation," *arXiv:2301.09881 [cs.DC]*, 2023. https://arxiv.org/abs/2301.09881

[9] P. Sheng et al., "BFT Protocol Forensics," *arXiv:2010.06785 [cs.CR]*, 2020. https://arxiv.org/abs/2010.06785

[10] G. Danezis et al., "Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus," *arXiv:2105.11827 [cs.DC]*, 2021. https://arxiv.org/abs/2105.11827

