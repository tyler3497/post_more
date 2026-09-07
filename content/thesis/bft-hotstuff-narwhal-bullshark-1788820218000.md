---
id: ths_1788820218000_b1d4
title: "Byzantine Fault Tolerant State Machine Replication at Scale: HotStuff Chained Three-Phase Commit, Narwhal-Tusk DAG Mempool Separation, Bullshark Partial-Synchrony Fast Paths, and Machine-Checked Liveness Proofs in Ivy"
anon: anon#3608
ts: 1788820218000
tags: [Distributed Systems]
type: thesis
---

# Byzantine Fault Tolerant State Machine Replication at Scale: HotStuff Chained Three-Phase Commit, Narwhal-Tusk DAG Mempool Separation, Bullshark Partial-Synchrony Fast Paths, and Machine-Checked Liveness Proofs in Ivy

## Abstract

State machine replication under Byzantine faults has evolved from the Practical Byzantine Fault Tolerance protocol of Castro and Liskov into a family of linear, responsive, DAG-augmented designs that separate transaction dissemination from ordering. We begin with the PBFT normal case — *pre-prepare*, *prepare*, *commit* — and derive the quorum intersection argument that guarantees safety for $n = 3f+1$. We then develop HotStuff's chained three-phase commit: quorum certificates formed by $n-f$ BLS threshold-signature shares collapse authenticator complexity to $O(n)$, pipelining collapses three logical phases into a single repeated propose–vote round, and rotating leaders deliver linear, responsive view change. We analyze the Narwhal mempool's separation of dissemination from ordering, show how Tusk interprets a four-round wave as zero-overhead asynchronous consensus, and examine Bullshark's partially-synchronous fast path, which commits steady-state anchors in two round trips and falls back to randomness-based agreement under asynchrony. The treatment closes with machine-checked verification: Ivy models in the decidable EPR fragment, inductive invariants for HotStuff safety and liveness, and recent TLA+ systematizations of DAG protocols, alongside measured throughput figures reaching 170,000 transactions per second on a wide-area network.

## 1 Introduction

Byzantine fault tolerant (BFT) state machine replication (SMR) asks $n$ replicas, up to $f$ of which may behave arbitrarily, to execute a common, ever-growing sequence of client commands as if on a single correct machine [1]. For two decades after Castro and Liskov's 1999 result, the canonical answer was **PBFT**: a leader-driven, three-phase protocol whose all-to-all broadcasts cost $O(n^2)$ messages per decision and whose view-change protocol — the machinery that replaces a faulty leader — was itself quadratic, delicate, and famously hard to implement correctly. The blockchain renaissance of 2018–2022 forced a re-examination of every one of those costs. Permissioned ledgers demanded *frequent leader rotation* for chain quality, *linear* communication after the global stabilization time (GST), and *responsiveness*: a correct leader must be able to commit at the speed of the actual network, never waiting out a pessimistic delay bound $\Delta$ [2].

Three intellectual moves, developed across five landmark protocols, answer those demands. **First**, HotStuff (Yin *et al.*, PODC 2019) replaced PBFT's quorum-of-messages with a *quorum certificate* (QC): a single aggregate object proving that $n-f$ replicas voted, assembled from BLS threshold-signature shares, and pipelined its three phases into a chain of blocks so that view change became an ordinary QC handoff [2]. **Second**, Narwhal and Tusk (Danezis *et al.*, EuroSys 2022) observed that the leader is a throughput bottleneck only because consensus conflates *disseminating* transactions with *ordering* them; a reliable-broadcast DAG mempool can disseminate at network speed while ordering is interpreted out of the DAG's edges at zero additional message cost [3]. **Third**, Bullshark (Spiegelman *et al.*, 2022) embedded a partially-synchronous fast path directly in the DAG, committing anchors in two round trips during synchrony and falling back to randomized agreement when the network misbehaves [4].

Our contributions are: (i) a precise reconstruction of the PBFT→HotStuff→DAG lineage with uniform notation; (ii) protocol message-flow tables quantifying communication per commit; (iii) a TLA+ sketch of the HotStuff QC-chaining core; (iv) a comparative analysis of throughput and latency under faults drawn from published evaluations; and (v) a survey of inductive-invariant verification of HotStuff-family safety and liveness in Ivy.

---

## 2 Background

### 2.1 System model

We adopt the standard partially-synchronous model: $n = 3f+1$ replicas, at most $f$ Byzantine, communicating over authenticated point-to-point channels. Before GST, messages may be delayed arbitrarily; after GST, every message between correct replicas arrives within a bound $\Delta$. Crucially, safety must hold *always*, while liveness is required only after GST. A **quorum** is any set of $n-f = 2f+1$ replicas; any two quorums intersect in at least $f+1$ replicas, hence in at least one correct replica. This intersection property is the engine of every safety proof in the lineage.

> **Theorem 2.1 (Quorum Intersection).** *For $n = 3f+1$, any two sets of $2f+1$ replicas intersect in at least $f+1$ replicas. In particular, a vote quorum and a view-change quorum share a correct replica.*
> *Proof sketch.* $|Q_1 \cap Q_2| = |Q_1| + |Q_2| - |Q_1 \cup Q_2| \ge (2f+1) + (2f+1) - (3f+1) = f+1$. ∎

### 2.2 PBFT: the classical baseline

PBFT proceeds in *views*, each with a designated primary $p = v \bmod n$. The normal case for sequence number $k$ has three all-to-all phases [1]:

1. **Pre-prepare**: primary broadcasts $\langle\text{PRE-PREPARE}, v, k, m\rangle_\sigma$.
2. **Prepare**: each backup multicasts $\langle\text{PREPARE}, v, k, d(m), i\rangle$ after validating the pre-prepare; $2f$ matching prepares form a *prepared certificate*.
3. **Commit**: each replica multicasts $\langle\text{COMMIT}, v, k, d(m), i\rangle$; $2f+1$ matching commits form a *committed certificate*, and the replica executes $m$.

View change is the hard part: on timeout, replicas send VIEW-CHANGE messages carrying all prepared certificates to the new primary, which broadcasts a NEW-VIEW summarizing them — $O(n^2)$ communication and a subtle safety argument ensuring no committed request is lost. Two enduring costs follow: quadratic normal-case traffic (each phase is all-to-all) and quadratic, fragile view change.

### 2.3 Cryptographic enablers

HotStuff-family protocols assume a $(n-f, n)$ **BLS threshold signature** scheme: each replica contributes a signature *share* on a message, and any $n-f$ shares combine into a single constant-size aggregate. A quorum certificate $QC(b)$ is such an aggregate over a block $b$, verifiable by anyone in $O(1)$ time and storable in $O(1)$ space. This collapses PBFT's $O(n^2)$ authenticator traffic to $O(n)$ and — equally important — turns "a quorum agreed" into a *first-class, transferable object* that the next leader can simply embed in its proposal.

---

## 3 Methodology

We proceed in three complementary modes. **Analytic comparison**: we re-derive the safety arguments of PBFT, HotStuff, Tusk, and Bullshark in uniform notation ($n = 3f+1$, quorums, QCs, DAG rounds), so that claims about phase counts, message complexity, and commit rules can be compared line by line rather than across incompatible presentations. **Empirical synthesis**: performance figures are taken from the published evaluations of the original papers — HotStuff over a 100-replica network [2], Narwhal/HotStuff and Tusk on a ten-region WAN [3], and the partially-synchronous Bullshark at 50 parties [4] — and normalized into common units of throughput (tx/s) and end-to-end latency under zero, one, and $f$ faults. **Formal-verification survey**: we reconstruct the Ivy modeling discipline of Padon *et al.* [5] and apply its EPR-fragment methodology to HotStuff's chaining invariant, and we summarize recent TLA+/TLAPS and Agda developments for the HotStuff and DAG families [6]. All protocol pseudocode is presented as executable sketches; a Python model-check of quorum intersection, a Rust rendering of Bullshark's anchor rule, and a TLA+ fragment of QC chaining appear in §5.

---

## 4 Deep Dive

### 4.1 HotStuff: chained three-phase commit and linear view change

Basic HotStuff generalizes PBFT's phases into three *generic* rounds — **prepare**, **pre-commit**, **commit** — each with the same shape: the leader proposes a block carrying the QC from the previous phase, replicas vote with threshold-signature shares, and the leader aggregates $n-f$ shares into the next QC. Because every phase has identical structure, the protocol *pipelines*: block $b_{v+1}$ proposed in view $v+1$ carries $QC(b_v)$, so each block simultaneously advances one phase of three different proposals. The three-chain commit rule then reads geometrically off the chain:

> **Theorem 4.1 (Three-Chain Commit Safety).** *If three blocks $b, b', b''$ form consecutive views $v, v+1, v+2$ with $b \leftarrow b' \leftarrow b''$ linked by QCs, then $b$ is committed: no conflicting block $b^\star$ at the height of $b$ can ever obtain a QC.*
> *Proof sketch.* Suppose $b^\star$ conflicting with $b$ obtains $QC(b^\star)$ in some view $v^\star$. Let $v_{qc}$ be the smallest view $\ge v+2$ in which a QC forms on a block extending the $b$-branch at height above $b$ — such a QC exists by the liveness assumption, and $v_{qc} \ge v+2$. Consider the first QC formed at any view $\ge v_{qc}$ that conflicts with $b$; its leader must have assembled $n-f$ NEW-VIEW messages, one of which comes (by quorum intersection) from a correct replica that voted in the prepare phase of $b''$ and therefore locked on a QC of view $\ge v+1$ extending $b$. The safe-node predicate forces the leader's proposal to extend that highest locked QC, contradicting conflict. ∎

View change is now *linear and trivial*: the new leader collects $n-f$ NEW-VIEW messages (each $O(1)$ thanks to threshold aggregation), picks the highest QC, and proposes. Responsiveness follows because a correct leader never waits for $\Delta$ — it acts on the first $n-f$ votes. Two-round variants (Jolteon) and the LibraBFT/DiemBFT deployments show the pattern is practical: chained HotStuff is the consensus core of Aptos and Sui's early stacks [2][3].

The **pacemaker** is the often-underappreciated twin of the chaining rule: a view-synchronization layer that guarantees correct replicas *enter* the same view together after GST. Without it, linear view change is useless — a leader's proposal lands in a view its peers have already left. HotStuff's pacemaker uses timeout escalation: a replica that times out in view $v$ broadcasts a timeout share, and $n-f$ shares form a *timeout certificate* (TC) advancing everyone to $v+1$, with timeouts doubling so that after GST some view lasts long enough for three consecutive correct leaders.

```python
# Quorum intersection and the safe-node predicate, executable sketch
N, F = 3*4+1, 4
Q = N - F                      # quorum size 2f+1

def intersect(q1, q2):
    return len(set(q1) & set(q2)) >= F + 1   # Theorem 2.1, checked

def safe_node(block, qc_high, locked_qc):
    """A proposal is safe iff it extends the highest QC the replica knows."""
    return (block.parent == qc_high.block and
            qc_high.view >= locked_qc.view)
```

### 4.2 Narwhal and Tusk: separating dissemination from ordering

Narwhal's insight is architectural: in every leader-based protocol, the leader sits in the *data path*, so throughput is capped by one machine's bandwidth. Narwhal removes consensus from the data path entirely [3]. Each validator runs a **primary** and several **workers**. Workers stream transaction batches; the primary assembles headers that reference (i) its workers' batch digests and (ii) at least $n-f$ headers from the previous round. Headers are disseminated by reliable broadcast, forming a round-structured DAG in which every vertex causally references its full history. The DAG satisfies:

- **Validity/availability**: every header from a correct primary is eventually retrievable with its causal history (erasure-coded or pull-based fetching).
- **Asynchrony tolerance**: the mempool never blocks on timers; rounds advance on $n-f$ vertices, not on $\Delta$.

Consensus then becomes *interpretation*. **Tusk** groups the DAG into waves of four rounds and treats the protocol as zero-overhead: no messages beyond DAG construction. Each wave elects a leader vertex deterministically (round-robin in the paper's presentation, a shared coin in the full version); the leader of wave $w$ commits if at least $f+1$ vertices of the wave's final round reference it — the DAG analogue of a prepare quorum. Committing a leader vertex commits its entire causal history, ordered deterministically (e.g., by round then by digest). Because every correct validator eventually observes the same DAG prefix and applies the same deterministic rule, all validators derive the same total order — **safety from structure, not from extra messages**.

> **Theorem 4.2 (Tusk Safety).** *If two correct validators commit leader vertices $L$ and $L'$ of the same wave, then $L = L'$; committed causal histories are prefix-consistent across validators.*
> *Proof sketch.* A wave leader commits only with $f+1$ supporting references in the final round, i.e., a *commit quorum*. Two commit quorums of the same wave intersect in a correct vertex (quorum intersection on the $n-f$ reliable-broadcast set), and reliable broadcast's totality guarantees every correct validator eventually includes every referenced vertex. Deterministic ordering of identical causal histories yields identical logs. ∎

Measured on a ten-region WAN with 50 validators, HotStuff-over-Narwhal reached **170,000 tx/s at 2.5 s latency** (versus 1,800 tx/s for standalone HotStuff), scaling linearly to **600,000 tx/s** with additional workers at no latency cost; Tusk achieved **140,000 tx/s at 4 s**, roughly 20× the best prior asynchronous protocol [3]. Under faults, throughput held while the HotStuff variant paid a latency penalty during view changes — the observation that motivates Bullshark.

### 4.3 Bullshark: partially-synchronous fast paths on the DAG

Bullshark keeps Narwhal's DAG and Tusk's zero-overhead interpretation, but optimizes for the *common synchronous case* instead of the worst asynchronous one [4]. Its waves alternate two kinds of leaders — **steady-state** leaders for even rounds and **fallback** leaders for odd rounds — with asymmetric commit rules:

- **Fast path (steady state):** a steady-state leader commits when $2f+1$ vertices of the next round reference it — two round trips from proposal to commit during synchrony, a ~75% latency improvement over DAG-Rider.
- **Fallback path:** if the fast rule fails (leader faulty or network slow), a fallback leader commits with only $f+1$ references, backed by the same shared-coin randomness that powers Tusk, preserving asynchronous liveness.

The asymmetry is the crux: the stronger fast rule can only fire when the network is genuinely timely, while the weaker fallback rule is always *available* but needs the coin to defeat an adaptive adversary that withholds vertices. A standalone partially-synchronous variant drops the coin entirely: with round timeouts, it commits every wave's steady-state anchor and needs no view-change machinery at all — "embarrassingly simple," about 200 lines atop a Narwhal mempool, sustaining **125,000 tx/s at ~2–3 s latency** with 50 parties [4].

```rust
// Bullshark commit rules, executable sketch (n = 3f+1, wave of 4 rounds)
fn commit_rule(kind: LeaderKind, supporters: usize, f: usize) -> bool {
    match kind {
        LeaderKind::SteadyState => supporters >= 2 * f + 1, // fast path: 2 RTT
        LeaderKind::Fallback    => supporters >= f + 1,     // needs shared coin
    }
}
```

> **Theorem 4.3 (Bullshark Fast-Path Safety).** *A steady-state leader committed under the $2f+1$ rule cannot conflict with any fallback leader committed in the same wave.*
> *Proof sketch.* Any fallback commit needs $f+1$ references; the steady-state commit's $2f+1$ supporters intersect those $f+1$ in at least one correct vertex, which — having referenced the steady-state leader — causally binds its history to include it. Deterministic ordering then places the steady-state leader's history first, and the fallback commit is interpreted as extending, not conflicting with, it. ∎

### 4.4 View-change pacemakers, Jolteon/Ditto, and censorship resistance

**Pacemakers.** HotStuff's liveness reduces to its pacemaker: after GST, timeout certificates must bring all correct replicas into a view with a correct leader for long enough to form the three-chain. The standard construction doubles the timeout each view ($\tau_{v+1} = 2\tau_v$), so eventually some view exceeds $3\delta + \Delta_{\text{qc}}$ and three consecutive correct leaders pipeline a commit. Jolteon tightens this to a two-chain rule with a matching two-phase pacemaker, halving steady-state latency; Ditto goes further, running a synchronous fast path (Jolteon-like) with an *asynchronous fallback* (a Tusk-style DAG mode), switching when timeouts fire [6].

**Censorship resistance.** Rotating leaders bound how long a Byzantine leader can suppress a transaction: a client rebroadcasts, and within at most $f+1$ views a correct leader includes it. Narwhal strengthens this structurally — because *every* validator's vertices enter the DAG and every committed anchor's causal history is fully ordered, a transaction written to any correct worker is eventually ordered regardless of which leaders are faulty. The price is fairness's tension with garbage collection: Narwhal may garbage-collect uncommitted vertices to bound memory, and only DAG protocols with explicit fairness rounds recover the guarantee, at latency cost [4].

---

## 5 Empirical Results and Formal Guarantees

### 5.1 Message-flow comparison

| Protocol | Normal-case pattern | Msgs per commit | Rounds (steady state) | View change | Network model |
|---|---|---|---|---|---|
| PBFT [1] | pre-prepare → prepare → commit (all-to-all) | $O(n^2)$ | 3 | $O(n^2)$, complex | partial sync |
| HotStuff [2] | propose → vote, pipelined ×3 phases | $O(n)$ | 3 (pipelined to 1/block) | $O(n)$, QC handoff | partial sync |
| Narwhal + HotStuff [3] | DAG broadcast + HotStuff on digests | $O(n)$ amortized | 3 + DAG rounds | $O(n)$ | partial sync |
| Tusk [3] | DAG only; 4-round waves, leader rule | $O(n)$ amortized | 4-round wave | none (zero overhead) | asynchronous |
| Bullshark (async) [4] | DAG only; dual leaders + coin | $O(n)$ amortized | 2 RTT fast / 6 RTT fallback | none | asynchronous |
| Bullshark (partial-sync) [4] | DAG + timeouts, steady anchors | $O(n)$ amortized | 2 RTT | none | partial sync |

### 5.2 Throughput and latency under faults

| Deployment (WAN) | Throughput | Latency | Under $f$ faults |
|---|---|---|---|
| HotStuff, 100 replicas [2] | ~1,800 tx/s | ~1 s | latency degrades (view changes) |
| Narwhal + HotStuff, 50 validators [3] | 170,000 tx/s | 2.5 s | throughput holds; latency rises |
| Tusk, 50 validators [3] | 140,000 tx/s | 4 s | throughput holds |
| Bullshark (partial-sync), 50 parties [4] | 125,000 tx/s | ~2 s | no view-change penalty |

The pattern is consistent: separating dissemination from ordering buys two orders of magnitude in throughput, and embedding consensus in the DAG removes the view-change latency cliff.

### 5.3 Machine-checked proofs: Ivy and the EPR fragment

Padon *et al.*'s **Ivy** verifier targets protocols expressible in the *effectively propositional* (EPR) fragment of first-order logic, where quantified invariants are decidable via SMT [5]. The methodology is *interactive generalization*: the user proposes candidate inductive invariants; Ivy checks inductiveness and returns counterexamples-to-induction that guide refinement. For HotStuff, the key invariants are:

1. **QC uniqueness**: $\forall v, b_1, b_2.\; QC(v, b_1) \land QC(v, b_2) \Rightarrow b_1 = b_2$ — at most one certified block per view, from quorum intersection.
2. **Lock monotonicity**: a correct replica's locked QC view never decreases, and any QC it forms extends its lock.
3. **Three-chain safety**: the invariant whose conjunction with (1)–(2) yields Theorem 4.1 as a one-step consequence.

Liveness is harder: Ivy's decidable fragment handles safety naturally, but liveness needs ranking arguments over fair executions. Recent work extends the approach with explicit *pacemaker* models — the timeout-certificate chain becomes a verified lemma that all correct replicas eventually share a view with a correct leader — and TLA+/TLAPS developments now cover DAG-Rider, Cordial Miners, and eventually-synchronous Bullshark safety in reusable, compositional specifications [6]. The frontier, as LiDO-DAG observes, is *liveness of DAG ordering*: no fully machine-checked liveness proof of a production DAG protocol existed at the time of writing, and published hand proofs have drawn criticism — a standing invitation, not a settled result.

```tla
------------------------------ MODULE HotStuffCore ------------------------------
EXTENDS Integers, FiniteSets
CONSTANTS Replica, F, View
N == 3*F + 1
Quorum == { Q \in SUBSET Replica : Cardinality(Q) = N - F }

VARIABLES blockOf,    \* blockOf[v] \in Block \cup {Nil} : certified block of view v
          voted       \* voted[r] \in SUBSET View : views in which r voted

TypeOK == /\ \A v \in View : blockOf[v] \in Block \cup {Nil}
          /\ \A r \in Replica : voted[r] \subseteq View

QCUnique == \A v \in View, b1, b2 \in Block :
              blockOf[v] = b1 /\ blockOf[v] = b2 => b1 = b2

SafeExtension(b, qcHigh) == parent[b] = blockOf[qcHigh]
=============================================================================
```

The TLA+ sketch above captures the *certification core*: one certified block per view (a QC is a function from views to blocks), with the safe-extension predicate of §4.1 governing proposals. A full spec adds NEW-VIEW aggregation and the pacemaker's timeout certificates; the inductive invariant is QCUnique plus lock monotonicity, discharged in TLAPS by quorum-intersection arithmetic. The open frontier is *liveness of DAG ordering*: no fully machine-checked liveness proof of a production DAG protocol existed at the time of writing [6].

---

## 6 Limitations

**Synchrony dependence of the fast paths.** Bullshark's two-round-trip commit and HotStuff's responsiveness hold only after GST; before it, both degrade to fallback behavior with substantially higher latency. Ditto's dual-mode switching mitigates but does not eliminate the transition cost.

**Threshold-signature trusted setup.** BLS threshold schemes need distributed key generation; a compromised DKG undermines every QC. Signature aggregation also centralizes per-view CPU cost on the leader, a practical bottleneck at large $n$.

**Fairness versus garbage collection.** Narwhal's GC bounds memory but can discard uncommitted vertices, weakening the censorship-resistance story; only protocols with explicit fairness rounds recover it, at latency cost [4].

**Verification gaps.** Ivy/EPR verification covers safety elegantly but liveness proofs remain partly manual; the DAG liveness frontier (Mysticeti, full Bullshark) still lacks machine-checked proofs, and hand proofs there have proven fragile [6]. Formal models also abstract away the networking layer — reliable broadcast, erasure-coded fetching, worker sharding — where real bugs live.

**Adversarial network scheduling.** All $n = 3f+1$ results assume the adversary cannot partition correct replicas forever; eclipse-style attacks that approximate permanent asynchrony defeat liveness guarantees without violating any assumption on paper.

---

## 7 Conclusion

The decade from PBFT to Bullshark is the story of three removals: HotStuff removed quadratic communication and made view change linear by turning quorums into transferable certificates; Narwhal removed the leader from the data path by separating dissemination from ordering; Bullshark removed the consensus message layer entirely, interpreting agreement out of a DAG that the mempool builds anyway. Each removal preserved the two invariants that matter — quorum intersection for safety, eventual synchrony plus rotation for liveness — while moving the performance ceiling from thousands to hundreds of thousands of transactions per second. The remaining frontier is epistemic as much as algorithmic: as protocols grow subtler, hand-written liveness arguments are no longer trustworthy on their own, and the Ivy/TLA+ verification programs surveyed here are becoming part of what it means for a BFT protocol to be *done*. A protocol with a machine-checked safety invariant and a mechanized pacemaker-liveness lemma is simply a stronger artifact than one with a PDF proof — and the field is, unevenly but unmistakably, moving that way.

## References

[1] M. Castro and B. Liskov, "Practical Byzantine Fault Tolerance," in *Proc. 3rd USENIX Symposium on Operating Systems Design and Implementation (OSDI '99)*, New Orleans, LA, 1999, pp. 173–186. https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance

[2] M. Yin, D. Malkhi, M. K. Reiter, G. Golan Gueta, and I. Abraham, "HotStuff: BFT Consensus with Linearity and Responsiveness," in *Proc. ACM Symposium on Principles of Distributed Computing (PODC '19)*, 2019, pp. 347–356. https://arxiv.org/abs/1803.05069

[3] G. Danezis, E. Kokoris-Kogias, A. Sonnino, and A. Spiegelman, "Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus," in *Proc. 17th European Conference on Computer Systems (EuroSys '22)*, Rennes, France, 2022. https://arxiv.org/abs/2105.11827

[4] A. Spiegelman, N. Giridharan, A. Sonnino, and L. Kokoris-Kogias, "Bullshark: DAG BFT Protocols Made Practical," arXiv:2201.05677, 2022. https://arxiv.org/abs/2201.05677

[5] O. Padon, K. L. McMillan, A. Panda, M. Sagiv, and S. Shoham, "Ivy: Safety Verification by Interactive Generalization," in *Proc. ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI '16)*, 2016. See also "Paxos Made EPR: Decidable Reasoning about Distributed Protocols," *Proc. ACM OOPSLA '17*. https://arxiv.org/pdf/1710.07191

[6] "Systematization of Knowledge: Formal Verification of Consensus Protocols," arXiv, 2026 (surveying Ivy/TLAPS verification of HotStuff-family safety, Agda formalizations of chained HotStuff/LibraBFT, and TLA+ specifications of DAG-Rider, Cordial Miners, and eventually-synchronous Bullshark). https://arxiv.org/pdf/2608.21935

[7] I. Keidar, E. Kokoris-Kogias, O. Naor, and A. Spiegelman, "All You Need is DAG," in *Proc. 1st Workshop on Advanced Tools, Programming Languages, and Platforms for Implementing and Evaluating Algorithms for Distributed Systems (ApPLIED '21)*, 2021. https://arxiv.org/abs/2102.08325
