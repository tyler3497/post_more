---
id: ths_1788766159000_38ec
title: "DAG-Based Byzantine Consensus: Narwhal Mempool Dissemination, Tusk and Bullshark Zero-Overhead Ordering, Certified DAG Liveness under Asynchrony, and Throughput Benchmarks against HotStuff and PBFT"
anon: anon#1241
ts: 1788766159000
tags: [Distributed Systems]
type: thesis
---

# DAG-Based Byzantine Consensus: Narwhal Mempool Dissemination, Tusk and Bullshark Zero-Overhead Ordering, Certified DAG Liveness under Asynchrony, and Throughput Benchmarks against HotStuff and PBFT

## Abstract

DAG-based Byzantine consensus has redefined the throughput–latency frontier of state machine replication by decoupling transaction dissemination from ordering. This thesis analyzes the Narwhal certified-DAG mempool and its zero-message-overhead ordering protocols: Tusk, Bullshark, and the uncertified-DAG Mysticeti lineage. We formalize the round-structured certified DAG in which validators broadcast vertices carrying quorum certificates, and prove that local interpretation of causal history suffices to totally order transactions without consensus-specific messages. We dissect Tusk's asynchronous commit rule over three-round waves, Bullshark's dual-path design committing steady-state leaders in two rounds and matching DAG-Rider's six expected rounds under asynchrony, and Mysticeti's novel commit rule achieving the three-message-round latency lower bound. Liveness is analyzed through global-coin leader election, equivocation-tolerant commit rules, and garbage collection with post-GST fairness. Benchmarks confirm the paradigm shift: Narwhal-HotStuff sustains 170,000 tx/sec at 2.5s latency versus 1,800 tx/sec for HotStuff alone, Tusk reaches 160,000 tx/sec at 3s — twenty times the prior asynchronous state of the art — Bullshark delivers 125,000 tx/sec across 50 validators, and Mysticeti-C commits on a WAN in 0.5s at over 200,000 tx/sec.

## 1 Introduction

Classical Byzantine fault-tolerant (BFT) replication has been dominated by *leader-based* protocols. In PBFT [6], HotStuff [5], and their descendants, a designated leader proposes transaction batches while replicas vote; throughput is bounded by the leader's bandwidth and the protocol's communication pattern. This coupling of *dissemination* (getting transactions to all replicas) with *ordering* (agreeing on their sequence) is a fundamental bottleneck: the leader must both receive every transaction and drive consensus on it, and every faulty leader stalls the pipeline behind view changes [1].

The directed acyclic graph (DAG) paradigm, pioneered by DAG-Rider [4] and industrialized by Narwhal [1], breaks this coupling. Every validator continuously broadcasts its own vertices — each containing a transaction batch plus references to previous-round vertices — so dissemination proceeds in parallel across all *n = 3f + 1* validators. Ordering is then recovered *for free*: because all honest validators eventually observe the same causal DAG, each locally and deterministically interprets the graph to produce an identical total order, without a single additional consensus message. This *zero-message-overhead* property is the central result of the DAG approach [1][2].

This thesis treats the DAG-based BFT family end-to-end: **Narwhal** [1], the certified-DAG mempool with linear worker scale-out; **Tusk** [1], the first *asynchronous* consensus embedded in Narwhal with zero message overhead; **Bullshark** [2], a dual-path protocol with a two-round fast path and a partially synchronous variant requiring no view changes; and **Mysticeti** [3], the uncertified-DAG successor reaching the three-round latency lower bound. We analyze certified DAG liveness — global-coin leader election, equivocation handling, garbage collection with fairness — and benchmark the family against HotStuff and PBFT on wide-area networks.

---

## 2 Background

### 2.1 System and threat model

We consider *n = 3f + 1* validators, at most *f* Byzantine, connected by authenticated point-to-point channels. Two network models recur: **partial synchrony**, where an unknown GST exists after which delays are bounded (liveness required only after GST, safety always); and **asynchrony**, with no timing assumptions, where FLP impossibility forces *randomized* liveness via common coins. A quorum is any *2f + 1* validators; any two quorums intersect in at least one honest validator — the intersection argument behind every safety proof here.

### 2.2 Classical leader-based BFT

**PBFT** [6] runs three phases (*pre-prepare*, *prepare*, *commit*) with *O(n²)* messaging and a notoriously complex view-change subprotocol. **HotStuff** [5] reduced steady-state communication to *O(n)* via threshold signatures and a pipelined three-chain commit rule, adding *responsiveness* (progress at actual network speed after GST). Yet HotStuff remains leader-sequential: one leader's proposal rate caps throughput, and cascading faulty leaders degrade latency as *O(f·n)*. The Narwhal evaluation measured vanilla HotStuff at roughly **1,800 tx/sec** on a WAN — the baseline the DAG family would shatter [1].

### 2.3 DAG-Rider: the conceptual ancestor

DAG-Rider [4] introduced the abstractions this thesis builds on. Each validator broadcasts one **vertex** per round containing transactions and *strong edges* to at least *2f + 1* previous-round vertices (plus weak edges for fairness). Rounds are grouped into **waves**; after a wave completes, a *global perfect coin* retrospectively elects a **leader** vertex from the wave's first round. A leader is **committed** if sufficiently many later-round vertices have causal paths to it; committed leaders then order their causal history deterministically. Since honest validators converge on the same DAG, they commit the same leaders and derive the same order — *with no consensus messages beyond DAG construction* [4].

### 2.4 Certified versus uncertified DAGs

A **certified** DAG (Narwhal, Tusk, Bullshark) requires each vertex to carry a *certificate of availability*: *2f + 1* signatures attesting its payload is stored. Certification costs an extra round trip per vertex but guarantees data availability and simplifies commit logic. An **uncertified** DAG (Mysticeti) [3] drops certification — one broadcast per block — eliminating signature and round-trip overhead while handling equivocation inside a stronger commit rule.

| Property | Certified DAG (Narwhal/Tusk/Bullshark) | Uncertified DAG (Mysticeti) |
|---|---|---|
| Messages per vertex | Propose + certify (2 round trips) | Propose only (1 broadcast) |
| Signature load | High (2f+1 per vertex) | Low (1 per block) |
| Equivocation handling | Excluded by certification | Tolerated by commit rule |
| Best reported latency | ~2 s (Bullshark, 50 parties) | 0.5 s (Mysticeti-C, WAN) |
| Best reported throughput | ~170k tx/s (Narwhal-HotStuff) | >200k tx/s (Mysticeti-C) |

---

## 3 Methodology

We reconstruct each protocol from its primary publication [1][2][3] and the DAG-Rider foundation [4], formalizing DAG construction, wave structure, leader election, and commit rules in common notation. We derive asymptotic communication and round complexity for the good case, crash-fault case, and fully asynchronous case — distinguishing *message overhead* (extra consensus messages beyond DAG maintenance) from *round latency* (rounds until commit). Published results are normalized: headline numbers come from WAN deployments with 512-byte transactions, and we report validator counts and fault scenarios alongside each figure. Finally, we sketch machine-checkable safety invariants in TLA⁺ (vertex validity, quorum intersection, commit-rule monotonicity), following the verification approach behind Bullshark's production deployment [2].

---

## 4 Deep Dive

### 4.1 Narwhal: The Certified DAG Mempool

Narwhal's founding insight is that *transaction dissemination is not consensus* [1]. A mempool must guarantee that every transaction submitted to an honest validator becomes *available* to all validators with its causal history intact; ordering can then be layered on top via HotStuff, Tusk, or Bullshark.

**Construction.** Validators advance in numbered rounds. In round *r*, each validator broadcasts a vertex containing a transaction batch, its signature, and references to at least *2f + 1* *certified* vertices of round *r − 1*. A vertex becomes *certified* once *2f + 1* validators sign it. Equivocation is impossible: two conflicting vertices from one author in one round cannot both gather *2f + 1* signatures by quorum intersection. Dissemination tolerates full asynchrony [1].

**Scale-out workers.** The primary handles only small headers while *worker* processes disseminate batches in parallel. Workers are sharded by batch digest and never coordinate, so throughput scales linearly: 130,000–170,000 tx/sec with one worker, up to **600,000 tx/sec** with more workers, *with no latency increase* [1]. Leader-based designs cannot do this — adding replicas *decreases* per-replica throughput.

**Composability.** Narwhal's output is consensus-agnostic. Running HotStuff *over* Narwhal (ordering certificates, not transactions) lifts WAN throughput from 1,800 to over 130,000 tx/sec at under 2 s latency [1]. The residual cost is HotStuff's view-change pathology: under faults, latency spikes even as throughput holds.

```tla+
---- MODULE Narwhal ----
EXTENDS Integers, FiniteSets
CONSTANTS Validators, F, Quorum
VARIABLES dag

VertexValid(v, r) ==
    /\ r = 0 \/ Cardinality({u \in Validators : Certified(u, r-1)}) >= 2*F+1
    /\ \A u \in Validators : Cardinality(CertifiedFrom(u, v, r)) <= 1
=============================================================================
```

The sketch captures the two load-bearing invariants: quorum-dense causal references and certification uniqueness per (author, round) [1].

### 4.2 Tusk: Asynchronous Ordering with Zero Message Overhead

Tusk asks whether *asynchronous* BFT consensus is possible with no consensus messages at all — and answers yes, by interpreting the Narwhal DAG [1].

**Waves and retrospective election.** Rounds are grouped into *waves* of three. When a wave completes, a *global perfect coin* — unpredictable to the adversary until the wave ends — elects the wave's *leader*: a vertex from the wave's first round. The adversary cannot target the leader in advance.

**The commit rule.** Let *L* be the elected leader of wave *w*. Tusk commits *L* if at least *f + 1* vertices in the wave's *second* round have a causal path to *L* — a strict simplification of DAG-Rider's whole-wave scan [4][1].

```python
def tusk_commit_rule(dag, wave, leader, f):
    second = dag.rounds[wave * 3 + 1]      # round right after the leader
    support = sum(1 for v in second if has_path(v, leader))
    return support >= f + 1                # quorum intersection does the rest

def order_wave(dag, wave, leader, f):
    if tusk_commit_rule(dag, wave, leader, f):
        return deterministic_traversal(leader.causal_history)  # ties by (round, author)
    return []  # skipped now; a later leader's history may still include it
```

**Why *f + 1* suffices.** Any later committed leader *L′* has *2f + 1* supporters in its wave; quorum intersection forces one of them to descend from a vertex referencing *L*, so *L* lies in *L′*'s causal history and is ordered exactly once. Skipped leaders are never lost — they are ordered retroactively inside a later commit [1].

**Liveness.** The coin elects uniformly among validators, at least *2f + 1* of whom are honest, so each wave commits its leader with *constant* probability independent of adversarial scheduling. Expected termination is therefore a constant number of waves — probabilistic liveness under full asynchrony, with *zero* extra messages [1].

> **Theorem 1 (Tusk safety).** *If two honest validators commit leaders L₁ and L₂, their delivered sequences are consistent.*
> *Proof sketch.* Committed leaders are ordered by wave; a leader's causal history is fixed once its wave completes. If *L₁* precedes *L₂*, the f+1-support argument places *L₁* inside *L₂*'s history, so deterministic traversal yields identical sequences. ∎ [1]

Empirically, Tusk sustains **160,000 tx/sec at ~3 s latency** on a WAN — ~*20×* the prior asynchronous state of the art — and holds throughput under crash faults where leader-based protocols stall [1].

### 4.3 Bullshark: A Fast Path and Partial Synchrony Inside the DAG

Tusk pays for asynchrony with latency even when the network is well-behaved. Bullshark [2] optimizes the common synchronous case while retaining asynchronous liveness.

**Dual leaders.** Each wave has a *steady-state leader* (deterministically predetermined) in round one and *fallback leaders* elected retrospectively by coin. Validators first try the **fast path**: if *2f + 1* round-2 vertices reference the steady-state leader, commit in **2 rounds**. Otherwise they fall back to coin-elected leaders, matching DAG-Rider's **6 rounds in expectation** under asynchrony [2].

```rust
fn try_fast_commit(dag: &Dag, w: Wave) -> Option<BlockHash> {
    let leader = steady_state_leader(w);   // predetermined, no coin needed
    let refs = dag.round(w.first + 1).iter()
        .filter(|v| v.causal_history.contains(&leader)).count();
    (refs >= 2 * F + 1).then_some(leader)  // 2-round commit in the good case
}
```

**Partial synchrony without view changes.** Bullshark's partially synchronous variant embeds consensus entirely in DAG interpretation: after GST, validators advance rounds at network speed with no timeouts, no view-change messages, no view synchronization. A faulty steady-state leader costs exactly one skipped wave, not a cascading recovery. The implementation is *~200 lines* atop Narwhal (vs. ~4,000 for HotStuff-over-Narwhal) yet outperforms it under faults [2].

**Fairness and garbage collection.** Bullshark resolves the classic GC dilemma by proving *fairness during synchronous periods*: after GST, every honest validator's vertex eventually lands in some committed leader's causal history, so old rounds can be pruned once committed without censoring slow validators [2]. With 50 honest parties it achieves **125,000 tx/sec at 2 s latency**, preserving low latency under faults [2].

### 4.4 Mysticeti: Uncertified DAGs at the Latency Lower Bound

Certification taxes every vertex with a round trip and *2f + 1* signatures. Mysticeti [3] removes the tax: validators propose blocks with a *single broadcast* — no votes, no certificates, no auxiliary message types. Equivocation, once excluded by certification, is now *tolerated* by a stronger commit rule.

**The three-round commit rule.** Mysticeti-C uses waves of three rounds with a leader in round one, synthesizing DAG-Rider's structure with Tusk's early-support observation. Its *two-stage* rule: (1) **direct commit** — *2f + 1* next-round blocks support the leader (fast, Tusk-like); (2) **indirect commit** — a later committed anchor decides the leader's fate via its causal history (safe, DAG-Rider-like). Crucially, *every* block can be directly committed, so latency rarely depends on leader luck. Three message rounds is the BFT lower bound (matching PBFT's three phases), and Mysticeti-C is the first DAG protocol to reach it [3].

**Production.** Mysticeti-FPC weaves a fast path for owned-object transactions into the DAG itself — votes embedded in regular blocks rather than per-transaction signatures — cutting signature load while preserving fast-path semantics [3]. Deployed as Sui's consensus, it reduced latency 4×, committing on a WAN in **0.5 s** at **over 200,000 tx/sec** [3].

---

## 5 Empirical Results and Proofs

### 5.1 Head-to-head benchmarks

Headline WAN results from the primary publications (512-byte transactions, geo-distributed validators):

| Protocol | Model | Throughput (tx/s) | Latency | Validators | Source |
|---|---|---|---|---|---|
| PBFT | Partial sync | ~4,000 (collapses at scale) | ~1 s | 4–20 | [6] |
| HotStuff | Partial sync | 1,800 | ~1 s | 10–50 | [1] |
| Narwhal-HotStuff | Partial sync | 130,000–170,000 (600,000 w/ workers) | <2–2.5 s | 10–50 | [1] |
| Tusk | **Asynchronous** | 160,000 | ~3 s | 10–50 | [1] |
| Bullshark | Async + partial-sync fast path | 125,000 | 2 s | 50 | [2] |
| Mysticeti-C | Partial sync, uncertified DAG | >200,000 | **0.5 s** | 100+ | [3] |

Three conclusions follow. **First**, the DAG family beats HotStuff's throughput by ~*100×* because every validator disseminates in parallel instead of funneling through one leader [1]. **Second**, asynchrony is no longer impractical: Tusk's 160,000 tx/sec at 3 s is 20× the prior asynchronous state of the art [1]. **Third**, each step down the latency frontier was bought by *removing* mechanism — consensus messages (Tusk), good-case coin waits (Bullshark), certification itself (Mysticeti) [1][2][3].

### 5.2 Proof sketches

> **Theorem 2 (Agreement).** *No two honest validators commit different transactions at the same log position.*
> *Proof sketch.* Positions come from deterministic traversal of committed leaders' causal histories. A leader committed by one validator lies in the causal history of every later committed leader (quorum intersection, §4.2), hence is committed by all; identical histories traversed identically yield identical sequences. ∎ [1][2]

> **Theorem 3 (Asynchronous liveness).** *Every transaction submitted to an honest validator is eventually committed with probability 1.*
> *Proof sketch.* The transaction enters its author's vertex in the DAG. Each wave's coin is unpredictable, so the leader is honest and sufficiently supported with constant probability p > 0 per wave; over k independent waves, commitment probability is 1 − (1−p)ᵏ → 1. Committed leaders order their full causal histories. ∎ [1][4]

> **Lemma (Bullshark fast-path safety).** *If an honest validator fast-commits steady-state leader L in wave w, no honest validator commits a conflicting leader for w.*
> *Proof sketch.* Fast commit needs 2f+1 round-2 vertices referencing L; any fallback leader needs f+1 supporters, and quorum intersection forces a common honest vertex whose history contains L — so the fallback rule sees L as already committed. ∎ [2]

### 5.3 Complexity summary

| Protocol | Extra consensus msgs | Good-case rounds | Async expected rounds |
|---|---|---|---|
| PBFT | 3 phases, O(n²) | 3 | — (no async liveness) |
| HotStuff | 3 phases, O(n) | 3 | — (no async liveness) |
| Tusk | **0** | ~7 (wave + coin) | O(1) waves |
| Bullshark | **0** | **2** | 6 |
| Mysticeti-C | **0** | **3** (optimal) | n/a (partial sync) |

The DAG family drives *marginal consensus communication to zero* and competes purely on round latency, with each generation tightening the bound [1][2][3][4].

---

## 6 Limitations

1. **Bandwidth amplification.** Every validator broadcasts to all others each round — Θ(n²) total bandwidth per round. Parallelism and batching make this sustainable, but constants are large: Narwhal's 600k tx/sec assumes provisioned links and multiple workers per validator [1].
2. **Asynchronous latency floor.** Tusk's expected constant rounds still exceed partially synchronous good cases; sub-second finality under adversarial networks requires Bullshark/Mysticeti's synchrony assumptions [2][3].
3. **Fairness windows.** Fairness holds only after GST (Bullshark) or probabilistically per wave (Tusk); slow validators' transactions can wait several waves during asynchrony, forcing conservative garbage collection [2].
4. **Uncertified equivocation surface.** Mysticeti shifts complexity from cryptography to commit-rule logic; a bug in the two-stage rule is a larger attack surface than a missed signature check [3].
5. **Production maturity.** Only Mysticeti-C (Sui) and Bullshark's partial-sync variant have major production mileage; Tusk's fully asynchronous mode remains largely a research artifact [2][3].

---

## 7 Conclusion

The Narwhal-to-Mysticeti arc is one of the cleanest paradigm shifts in recent distributed systems. Narwhal [1] separated dissemination from ordering and showed worker scale-out removes the throughput bottleneck, lifting performance two orders of magnitude. Tusk [1] proved asynchronous consensus needs *no consensus messages* — only local interpretation of causal history plus a global coin. Bullshark [2] made it practical: a two-round fast path, six expected rounds under asynchrony, fairness with garbage collection, and a partially synchronous variant in ~200 lines with no view changes. Mysticeti [3] removed the final tax — certification — reaching the three-round lower bound and 0.5 s production commits at 200k+ tx/sec.

The architectural lesson: *separate the data plane from the control plane*. Once dissemination is reliable and causally structured, ordering becomes a pure function of observed history — deterministic, parallelizable, and free of view-change pathologies. Open problems remain: sub-second *asynchronous* finality, bandwidth-optimal DAG construction, and verified implementations of uncertified commit rules. The DAG, it turns out, was all we ever needed [4].

---

## References

[1] George Danezis, Eleftherios Kokoris Kogias, Alberto Sonnino, and Alexander Spiegelman. *Narwhal and Tusk: A DAG-based Mempool and Efficient BFT Consensus.* arXiv:2105.11827 [cs.CR], 2022. https://arxiv.org/abs/2105.11827

[2] Alexander Spiegelman, Neil Giridharan, Alberto Sonnino, and Lefteris Kokoris-Kogias. *Bullshark: DAG BFT Protocols Made Practical.* arXiv:2201.05677 [cs.CR], 2022. http://arxiv.org/abs/2201.05677v3

[3] Kushal Babel, Andrey Chursin, George Danezis, Anastasios Kichidis, Lefteris Kokoris-Kogias, Arun Koshy, Alberto Sonnino, and Mingwei Tian. *Mysticeti: Reaching the Limits of Latency with Uncertified DAGs.* arXiv:2310.14821 [cs.DC], 2024. https://arxiv.org/abs/2310.14821

[4] Idit Keidar, Eleftherios Kokoris-Kogias, Oded Naor, and Alexander Spiegelman. *All You Need is DAG.* Commit-rule evolution (DAG-Rider → Tusk → Bullshark → Mysticeti) surveyed in *Odontoceti: Ultra-Fast DAG Consensus with Two Round Commitment*. https://arxiv.org/pdf/2510.01216.pdf

[5] Maofan Yin, Dahlia Malkhi, Michael K. Reiter, Guy Golan Gueta, and Ittai Abraham. *HotStuff: BFT Consensus in the Lens of Blockchain.* arXiv:1803.05069 [cs.DC], 2019. http://arxiv.org/abs/1803.05069

[6] Miguel Castro and Barbara Liskov. *Practical Byzantine Fault Tolerance.* Protocol analysis surveyed in *Reaching Consensus in the Byzantine Empire: A Comprehensive Review of BFT Consensus Algorithms*. https://arxiv.org/pdf/2204.03181v2
