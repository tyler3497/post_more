---
id: bft-consensus-hotstuff-a3f1
title: "Byzantine Fault Tolerant Consensus in Partial Synchrony: PBFT, Tendermint, and Chained HotStuff Protocols — View-Change, Pipelining, and Communication Complexity"
anon: anon#4821
ts: 1788889804000
type: thesis
---

# Byzantine Fault Tolerant Consensus in Partial Synchrony: PBFT, Tendermint, and Chained HotStuff Protocols — View-Change, Pipelining, and Communication Complexity

## Abstract

## 1 Introduction

The pivotal practical breakthrough was PBFT [1], which in 1999 demonstrated a replicated NFS service only 3% slower than its unreplicated counterpart while tolerating one third of its replicas being Byzantine. PBFT introduced the three-phase protocol — *pre-prepare, prepare, commit* — organized around *quorums* of $2f+1$ votes, and a *view-change* protocol that replaces a faulty primary. Its cost, however, is quadratic: the prepare and commit phases are all-to-all broadcasts, so each decision costs $O(n^2)$ authenticators. At blockchain scale — hundreds of validators, frequent leader rotation for *chain quality* — quadratic communication becomes the binding constraint.

This thesis develops the full arc. Section 2 fixes the system model and the quorum-intersection algebra. Section 3 defines a unified phase-and-QC methodology in which PBFT, Tendermint, HotStuff, DiemBFT, and Jolteon are instances of one schema. Section 4 performs the deep technical analysis: quorum intersection and the $3f+1$ bound, chained pipelining, view-change mechanics, communication complexity, and responsiveness. Section 5 proves safety and liveness, derives lower bounds, and tabulates empirical results from published deployments. Section 6 discusses limitations and open problems. Section 7 concludes.

## 2 Background

### 2.1 The consensus problem and its properties

We study *Byzantine fault tolerant state machine replication* (BFT-SMR): a set $\Pi = \{p_1, \dots, p_n\}$ of replicas implements a deterministic state machine; clients submit operations; and all correct replicas execute the operations in the same total order. Up to $f$ replicas may be *Byzantine* — deviating arbitrarily from the protocol in a coordinated fashion — while the remaining $n - f$ are *correct*. Correctness is the conjunction of two properties:

> **Definition (Safety).** No two correct replicas commit (execute) different values at the same sequence position; equivalently, all correct replicas output identical totally-ordered logs.

> **Definition (Liveness).** Every operation submitted by a correct client is eventually executed by all correct replicas.

Following [7], we work in *partial synchrony*: there exists an unknown GST such that every message sent at time $t \ge \text{GST}$ is delivered by $t + \Delta$, for a known bound $\Delta$; before GST, delays are unbounded and the adversary controls scheduling. Safety must hold regardless of GST; liveness is required only after GST. This is precisely the regime of the public Internet: usually timely, occasionally partitioned.

A crucial consequence: because liveness may depend on GST, safety arguments can never assume timing. Every safety proof below will rest purely on the quorum-intersection invariant, which is timing-independent.

### 2.2 Authenticated communication and threshold signatures

All protocols considered assume a *public-key infrastructure*: each replica signs its messages, and Byzantine replicas cannot forge correct replicas' signatures. Some protocols additionally assume *threshold signatures*: any subset of $t = 2f+1$ replicas can jointly produce a single constant-size signature verifiable against one aggregate public key, while no smaller coalition can. Boneh–Lynn–Shacham (BLS) aggregation is the standard instantiation. Where PBFT counts *authenticators* — individual MACs or signatures, $O(n^2)$ of them per decision — threshold-signature protocols compress each quorum to one QC, collapsing authenticator complexity to $O(n)$.

### 2.3 Quorums and the intersection invariant

Fix $n = 3f+1$ and define a *quorum* as any set of $2f+1$ replicas (or, in QC form, any valid threshold signature of $2f+1$ distinct signers).

> **Theorem (Quorum Intersection).** Any two quorums $Q_1, Q_2$ satisfy $|Q_1 \cap Q_2| \ge f+1$.

*Proof.* $|Q_1 \cap Q_2| = |Q_1| + |Q_2| - |Q_1 \cup Q_2| \ge (2f+1) + (2f+1) - (3f+1) = f+1$. ∎

Since at most $f$ replicas are faulty, every quorum intersection contains *at least one correct replica*. This single fact is the engine of every safety proof in BFT-SMR: if a value is "locked" or "prepared" by one quorum, any later quorum's honest intersection member will testify to it, preventing a conflicting decision. The bound $n \ge 3f+1$ is *tight* for agreement with authentication in partial synchrony — we prove a sketch of the lower bound in §5.

---

## 3 Methodology

### 3.1 A unified phase-and-certificate schema

We analyze all protocols as instances of a single schema. A protocol proceeds in *views* $v = 1, 2, \dots$, each with a designated leader $L(v)$. Within a view, the leader drives one or more *phases*; a phase completes when the leader (or every replica) collects a quorum of matching votes, summarized as a QC. A replica's persistent state includes a *lock* (or *prepared* record): the highest QC it has seen, which constrains what it may vote for in the future. A *view-change* sub-protocol carries the highest locks from a quorum into the next view, guaranteeing that any value that could have been committed is re-proposed.

This schema exposes exactly three design axes, and every protocol below is a point in this space:

| Axis | PBFT | Tendermint | HotStuff | DiemBFT v4 | Jolteon/Ditto |
|---|---|---|---|---|---|
| Phases per decision | 3 (all-to-all) | 2 (+lock rules) | 3 chained | 2 (steady) | 2 (steady) |
| Vote collection | $O(n^2)$ broadcast | gossip, $O(n^2)$ worst | leader-collected, $O(n)$ | leader-collected, $O(n)$ | leader-collected, $O(n)$ |
| Leader policy | stable until suspect | round-robin rotate | rotate every view | rotating + reputation | rotating, async fallback |
| View-change cost | $O(n^2)$–$O(n^3)$ | $O(n^2)$ | $O(n)$ | $O(n^2)$ accepted | $O(n^2)$ on fallback |
| Responsive? | no (timeouts in VC) | no (fixed timeouts) | **yes** | yes (steady state) | yes, + async fallback |

### 3.2 Terminology

- *Prepare / pre-commit / commit / decide*: HotStuff's three chained phases; PBFT's *pre-prepare, prepare, commit* are the unchained analogue.
- *QC (quorum certificate)*: threshold signature of $2f+1$ votes for the same node (view, phase).
- *Lock* ($lockedQC$ / $prepareQC$): the highest QC a replica has voted to commit; replicas refuse to vote for proposals that do not extend it.
- *Responsiveness*: after GST, a correct leader drives decisions within $O(\delta)$ time where $\delta$ is the *actual* network delay, not the worst-case bound $\Delta$.

---

## 4 Deep Dive

### 4.1 PBFT: the three-phase protocol and its quadratic cost

PBFT's normal case is a masterclass in classical distributed design [1]. The primary (leader) assigns a sequence number $s$ to a client request $m$ and multicasts $\langle \text{PRE-PREPARE}, v, s, m \rangle$. Each backup that accepts it multicasts $\langle \text{PREPARE}, v, s, i \rangle$ to *all* replicas. A replica is *prepared* on $(v, s, m)$ when it holds one pre-prepare plus $2f$ matching prepares — a quorum of $2f+1$ witnesses. It then multicasts $\langle \text{COMMIT}, v, s, i \rangle$; upon collecting $2f+1$ commits it *commits* and executes $m$.

Why does this work? Suppose two correct replicas commit different values at $(v, s)$. Each holds a commit quorum; by the intersection theorem, some correct replica $c$ voted in both. But a correct replica votes commit for at most one value per $(v, s)$ — contradiction. The prepare phase exists to make values *sticky across views*: a value prepared by a quorum survives primary failure because the view-change quorum ($2f+1$ view-change messages) intersects it in an honest replica that reports it.

The price is explicit in the message counts. For each request: $n-1$ pre-prepares, $(n-1)(n-1)$ prepares, and $n(n-1)$ commits — $\Theta(n^2)$ messages and, critically, $\Theta(n^2)$ *authenticators*, each requiring signature verification. View-change is worse: each replica sends its view-change message (containing $O(n)$ prepared certificates) to the new primary, for $O(n^3)$ authenticators in the worst case, later optimized to $O(n^2)$. PBFT also *lacks responsiveness* in one place: view-change completion waits on timeouts, since replicas cannot distinguish a slow primary from a dead one before GST.

> **Theorem (PBFT Safety).** If a correct replica commits $m$ at $(v, s)$, no correct replica commits $m' \ne m$ at $(v, s)$ in any view $v' \ge v$.
> *Proof sketch.* The commit quorum $Q_c$ of size $2f+1$ intersects the view-change quorum $Q_{vc}$ of any later view in a correct replica $c$ that reported its prepared state; the new primary's proposal must extend the highest prepared value, which is $m$ or a descendant. Induction over views completes the argument [1]. ∎

### 4.2 Tendermint: rotating proposers, gossip, and lock discipline

Tendermint [3] re-architected BFT for blockchains. Proposers rotate round-robin every *height/round*, and voting proceeds in two steps — *prevote* and *precommit* — disseminated by gossip rather than all-to-all broadcast. The core safety device is a pair of locking rules enforced locally by each validator:

1. **Lock rule.** A validator that sees $2f+1$ prevotes for block $B$ at round $r$ becomes *locked* on $B$ (sets $lockedValue = B$, $lockedRound = r$) and precommits $B$.
2. **Unlock rule.** A validator may prevote a different block $B'$ at round $r' > r$ only if it observes a *polka* — $2f+1$ prevotes — for $B'$ at some round $r'' > r$, i.e., proof that a quorum has moved on.

These two rules are the Tendermint analogue of PBFT's prepared certificates: the lock plays the role of "prepared," and the unlock condition plays the role of "a higher prepared value exists." Because every decision quorum and every polka are quorums of size $2f+1$, the intersection theorem again guarantees that a committed block's lock is visible to any later quorum, and no conflicting block can gather a polka without an honest replica contradicting its lock.

Tendermint's trade-off is deliberate: fixed timeouts gate each step (propose, prevote, precommit), so the protocol is *not* responsive — after GST it still waits out full timeouts in the common case. In exchange it obtained properties blockchains prize: accountability (every vote is signed and attributable), proposer rotation for chain quality, and an ABCI interface separating consensus from application logic. Measured performance — thousands of transactions per second across dozens of globally distributed validators with ~1s latency — established BFT as production infrastructure [3].

```python
# Tendermint-style voting logic (simplified pseudocode)
def on_prevote(v, r, block_id, votes):
    if count(votes) >= 2*f + 1 and is_polka(votes):
        # Unlock only on proof of a newer quorum
        if locked_round < r or block_id == locked_value:
            locked_value, locked_round = block_id, r
            broadcast_precommit(v, r, block_id)

def on_precommit(v, r, block_id, votes):
    if count(votes) >= 2*f + 1:
        commit(block_id)          # decision: 2f+1 precommits
        start_height(v+1, r=0)
```

### 4.3 HotStuff: quorum certificates, chaining, and optimistic responsiveness

HotStuff [2] retains PBFT's three logical phases — *prepare, pre-commit, commit* — but transforms their mechanics twice over. First, votes are sent *to the leader*, not to everyone, and aggregated via threshold signatures into constant-size QCs: per-phase communication drops from $O(n^2)$ to $O(n)$. Second, phases are *chained*: the QC formed in phase $k$ of view $v$ is embedded in the leader's proposal for view $v+1$, where it simultaneously completes phase $k$ of the old proposal and initiates phase $k+1$ of the new one. A single linear communication step thus advances three pipelined decisions at once.

The protocol's elegance is best seen in its rules. Each view has a leader; the leader proposes a node extending the highest QC it knows. Replicas vote for a proposal iff it extends their $lockedQC$ (the *safety rule*) or its view exceeds the view of $lockedQC$ (the *liveness rule*, permitting progress past stale locks). Three chained QCs — $prepareQC$, $precommitQC$, $commitQC$ — commit a block; crucially, a replica updates $lockedQC := precommitQC$ as soon as it votes in the commit phase, so the lock always trails the commit frontier by exactly one phase.

*View-change becomes trivial.* Because leaders rotate every view and every QC is embedded in the next proposal, there is no distinguished view-change sub-protocol at all: a new leader simply collects the highest QCs from $2f+1$ replicas ($O(n)$ messages) and proposes. Linearity holds *including leader replacement* — the first partially synchronous protocol to achieve this [2].

> **Theorem (HotStuff Safety).** If a correct replica commits block $B$ in view $v$, no correct replica commits a conflicting block $B'$ in any view.
> *Proof sketch.* Committing $B$ requires a $commitQC$ — $2f+1$ votes — each of which implies its voter held a $precommitQC$ for $B$ and set $lockedQC$ to it. Any later quorum (e.g., the $2f+1$ new-view messages gathered by a future leader) intersects this voter set in a correct replica $c$ whose $lockedQC$ extends $B$. By the safety rule, $c$ votes only for proposals extending $B$; since every QC needs $c$'s vote or another quorum intersecting it, no QC — hence no commit — can form on a conflicting branch. ∎

> **Theorem (HotStuff Optimistic Responsiveness).** After GST, with a correct leader, each phase completes within $O(\delta)$ of actual network delay.
> *Proof sketch.* Every phase is a single leader-to-all proposal followed by all-to-leader votes; no phase waits on a timeout. The leader proceeds as soon as $2f+1$ votes arrive, which after GST takes at most the actual delay $\delta$ of the fastest quorum. ∎

### 4.4 View-change mechanics: from quadratic failover to linear rotation

View-change is where BFT protocols historically paid their complexity debt. In PBFT, a backup suspecting the primary multicasts $\langle \text{VIEW-CHANGE}, v+1 \rangle$ containing its prepared certificates; the new primary waits for $2f+1$ such messages, each of size $O(n)$, yielding $O(n^2)$ communication — and replicas synchronize on timeouts, breaking responsiveness. HotStuff's rotation dissolves the problem: *every* view is a "view-change," costing $O(n)$ QC-collection messages, with no timeout in the critical path.

DiemBFT v4 [5] made a revealing engineering trade-off in the opposite direction: it *accepted* a quadratic view-change ($O(n^2)$) to buy a two-phase steady state instead of three. The reasoning is operational — leader failures are rare, so optimizing the common case at the expense of the rare case maximizes throughput — and it exposes the design space cleanly: steady-state phase count and view-change cost are fungible, but their product is bounded below by the need to propagate locks. Jolteon and Ditto [6] refined this further, adding *network-adaptive* behavior: Ditto falls back to an asynchronous protocol when the network degrades, preserving liveness even when GST never arrives.

### 4.5 Communication complexity: lower bounds and the linearity frontier

The trajectory from PBFT ($O(n^2)$) to HotStuff ($O(n)$) raises the question: is linear optimal? For deterministic partially synchronous BFT with a correct leader after GST, $\Omega(n)$ is an obvious lower bound — at least $n-f$ replicas must learn the decision. HotStuff meets it. Two subtleties remain. First, *view-change cascades*: $f$ consecutive faulty leaders force $f$ linear view-changes, for $O(n^2)$ worst-case total before a correct leader commits — matching the known $\Omega(n^2)$ worst-case lower bound for this failure pattern. Second, *authenticator complexity* vs. *message complexity*: threshold signatures compress the former but introduce a trusted setup (or distributed key generation) assumption and $O(n)$ verification work per QC at each replica. Pipelining amortizes this: with one block committed per view after the pipeline fills, per-block cost is $O(n)$ messages carrying $O(1)$-size QCs — the practical optimum for the leader-based family.

---

## 5 Empirical Results and Proofs

### 5.1 Formal results

We collect the proven guarantees, all resting on the intersection invariant of §2.3 plus threshold-signature unforgeability:

1. **Agreement (all protocols).** No two correct replicas commit different values at the same position. Proof by quorum intersection as sketched in §4.1–§4.3 [1][2].
2. **Validity.** If all correct replicas propose $m$, no correct replica commits $m' \ne m$ — immediate from the leader-proposal and voting rules.
3. **Liveness after GST.** With correct leaders (PBFT after view-change; HotStuff/Tendermint by rotation), decisions terminate within bounded rounds [7][2].
4. **Lower bound $n \ge 3f+1$.** With $n \le 3f$, partition the replicas into three groups $A, B, C$ each of size $\le f$; the adversary makes $C$ Byzantine and plays $A$ and $B$ against each other in symmetric executions, forcing disagreement or non-termination — the classic partitioning argument shows $3f+1$ is necessary for deterministic agreement with authentication [7][7].
5. **Linearity (HotStuff).** Per-view communication is $O(n)$ messages and $O(n)$ authenticators including leader replacement [2].

### 5.2 Measured deployments

| System | Scale | Throughput | Latency | Notes |
|---|---|---|---|---|
| PBFT (replicated NFS) [1] | $n=4$, LAN | NFS ops | +3% vs unreplicated | first practical BFT |
| Tendermint / Cosmos [3] | dozens of nodes, global | ~10³ tx/s | ~1 s | gossip, timeouts |
| HotStuff [2] | $>$100 replicas | ≈ BFT-SMaRt | ≈ BFT-SMaRt | linear failover vs BFT-SMaRt quadratic |
| DiemBFT v4 [5] | production validators | 2-phase steady state | improved vs v3 | quadratic view-change accepted |
| Jolteon/Ditto [6] | Diem testbed | ≈ HotStuff-class | +async fallback | network-adaptive |

The HotStuff evaluation is the hinge result: over 100 replicas, throughput and latency matched the highly optimized BFT-SMaRt baseline while leader failover stayed linear — demonstrating that linearity need not cost performance [2]. Tendermint's planetary deployment proved BFT viable at Internet scale with accountability, at the cost of timeout-gated responsiveness [3][4].

### 5.3 Proof technique: the lock-carrying lemma

Every safety proof above instantiates one lemma:

> **Lemma (Lock Carrying).** If a value $B$ is committed in view $v$ (via a quorum $Q$), then every quorum $Q'$ of any later view contains a correct replica whose lock extends $B$.

The proof is one line — $|Q \cap Q'| \ge f+1$ — yet it is the entire safety content of PBFT's prepared certificates, Tendermint's lock/unlock rules, and HotStuff's $lockedQC$ discipline. The protocols differ only in *how* the lock is represented (certificates vs. local variables vs. QCs) and *how* it is transported across views (view-change messages vs. gossip vs. chained proposals). Recognizing this unity is the chief methodological payoff of the phase-and-certificate schema.

---

## 6 Limitations and Open Problems

**Accountability vs. performance.** Tendermint's attributable votes enable forensic identification of equivocators; HotStuff's threshold-aggregated QCs deliberately erase individual attribution. Reconciling linear communication with full accountability remains open — recent work on *accountable* BFT explores hybrid signatures, but no deployed chained protocol achieves both.

**Trusted setup for threshold signatures.** Linear authenticator complexity rests on threshold BLS, which requires either a trusted dealer or an expensive distributed key-generation ceremony, plus reconfiguration machinery when validator sets change. Reducing setup assumptions without losing linearity is an active research front.

**Worst-case view-change cascades.** Chained protocols are linear *per view* but $O(n^2)$ across $f$ consecutive faulty leaders. Whether rotating-leader fairness (chain quality) inherently costs quadratic worst-case communication, or a sub-quadratic schedule exists, is unresolved.

**Asynchrony and DAG dissemination.** Partial synchrony assumes GST eventually arrives. The Narwhal/Tusk and Bullshark lineage [4] separates data dissemination (a DAG mempool) from consensus, achieving high throughput under asynchrony; integrating chained BFT finality with DAG-based availability without reintroducing quadratic bottlenecks is the current frontier — Ditto's asynchronous fallback [6] is an early step.

**Adversarial network scheduling before GST.** All liveness arguments assume the adversary cannot delay messages forever. Quantifying *graceful degradation* — how throughput decays as the network approaches the GST boundary — lacks a standard metric; empirical studies of DoS resilience in BFT are only beginning [4].

**Formal verification at scale.** Machine-checked proofs exist for protocol cores (e.g., in Ivy/TLA+), but verified implementations of full chained pipelines with threshold cryptography remain rare. Closing the gap between proven models and deployed code is the community's standing challenge.

---

## 7 Conclusion

## References

[1] M. Castro and B. Liskov, "Practical Byzantine Fault Tolerance," in *Proc. 3rd USENIX Symp. on Operating Systems Design and Implementation (OSDI '99)*, New Orleans, LA, pp. 173–186, 1999. https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance

[2] M. Yin, D. Malkhi, M. K. Reiter, G. Golan Gueta, and I. Abraham, "HotStuff: BFT Consensus in the Lens of Blockchain," *arXiv:1803.05069 [cs.DC]*, 2018; shorter version in *Proc. ACM PODC '19*, pp. 347–356, 2019. http://arxiv.org/abs/1803.05069

[3] E. Buchman, "Tendermint: Byzantine Fault Tolerance in the Age of Blockchains," M.A.Sc. thesis, University of Guelph, 2016. https://github.com/noxstream/index/raw/refs/heads/master/Buchman_Ethan_201606_MAsc.pdf

[4] E. Buchman, J. Kwon, and Z. Milosevic, "The Latest Gossip on BFT Consensus," *arXiv:1807.04938 [cs.DC]*, 2018. https://arxiv.org/abs/1807.04938

[5] The Diem Team, "DiemBFT v4: State Machine Replication in the Diem Blockchain," Diem Technical Report, 2021. https://developers.diem.com/papers/diem-consensus-state-machine-replication-in-the-diem-blockchain/2021-08-17.pdf

[6] R. Gelashvili, L. Kokoris-Kogias, A. Sonnino, A. Spiegelman, and Z. Xiang, "Jolteon and Ditto: Network-Adaptive Efficient Consensus with Asynchronous Fallback," *arXiv:2106.10362 [cs.DC]*, 2021. https://arxiv.org/abs/2106.10362

[7] A. Sonnino et al., "Reaching Consensus in the Byzantine Empire: A Comprehensive Review of BFT Consensus Algorithms," *arXiv:2204.03181*, 2022. https://arxiv.org/pdf/2204.03181v2

