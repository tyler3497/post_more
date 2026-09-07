---
id: verified-distributed-consensus-ironfleet-1da4
title: "Mechanized Verification of Distributed Consensus: IronFleet Refinement Methodology, TLA+ Model Checking of Raft, Dafny-Verified Multi-Paxos, and Coq Proofs for Byzantine Fault Tolerance"
anon: anon#1437
ts: 1788740928000
images: 2
---

# Mechanized Verification of Distributed Consensus

## Abstract

Mechanized verification promises to lift distributed systems engineering from the standard of "tested" to the standard of "correct." This dissertation-length treatment examines four converging lines of work: the IronFleet methodology, which unites TLA-style state-machine refinement with Floyd-Hoare verification in Dafny to machine-check the safety and liveness of a Paxos-based replicated state machine (IronRSL) and a lease-based sharded key-value store (IronKV); TLA+ specification and model checking of the Raft consensus algorithm, whose 400-line formal specification and mechanically checked Log Completeness property anchored Raft's understandability claims; TLAPS-checked safety proofs of Multi-Paxos that shrink Dafny's 30,000-line proof burden by an order of magnitude through high-level message-history queries; and the mechanized treatment of Byzantine fault tolerance, including HotStuff verified in Agda, hashgraph's computer-checked aBFT proof in Coq, and compositional techniques for moving verified guarantees across fault models. We compare refinement-based, interactive-theorem-prover, and model-checking approaches on proof size, automation, and the trust base each demands, and we identify the central open problem: closing the formality gap between verified protocol models and the deployed implementation without exploding the verification effort.

---

## 1. Introduction

Distributed systems are notorious for harboring subtle bugs. A replicated state machine that passes months of stress testing can still admit a rare interleaving of message reorderings and fail-recovery cycles that violates linearizability exactly once, on the worst possible day [1][2]. The combinatorial explosion of the state space makes exhaustive testing impossible in principle; mechanized verification — machine-checked proof — *categorically* rules out entire classes of misbehavior.

This thesis synthesizes four methodological families:

1. **Refinement-based end-to-end verification** (IronFleet): the protocol, the implementation, and the bytes of UDP packets on the wire are all placed under one verified umbrella, combining TLA-style refinement between state-machine layers with Hoare-logic verification of imperative code in Dafny [1].
2. **Lightweight formal specification with model checking** (Raft/TLA+): a 400-line TLA+ specification that precisely captures the algorithm, with selected safety lemmas proven in TLAPS and the broader invariant suite validated by TLC model checking over bounded configurations [3][5].
3. **Interactive theorem proving at the algorithm level** (Multi-Paxos in TLAPS, HotStuff in Agda, hashgraph in Coq): machine-checked deductive proofs of the protocol logic itself, abstracting away the implementation but achieving unbounded generality [4][6][8].
The *decidable-logic verification* (Paxos Made EPR, IC3PO): pushing protocol correctness into decidable fragments or fully automated inductive-invariant synthesis, trading expressiveness for push-button guarantees [7][10].

We proceed as follows. Section 2 reviews the consensus landscape: crash-tolerant Paxos, Raft, and Multi-Paxos, and the Byzantine models of PBFT and HotStuff. Section 3 presents the verification methodologies in detail, with special attention to how IronFleet bridges the notorious *formality gap* between a verified model and an executable implementation. Section 4 provides a deep technical dive into four case studies. Section 5 collects empirical evidence on proof size, effort, and performance parity. Section 6 examines limitations and threats to validity, and Section 7 concludes with a research agenda.

---

## 2. Background

### 2.1 Crash-Tolerant Consensus: Paxos, Raft, Multi-Paxos

The consensus problem asks a set of processes, some of which may crash, to agree on a single value. Lamport's Paxos [1] solves it through a two-phase protocol of *prepare/promise* and *accept/accepted* rounds, with ballots providing the ordering that guarantees agreement: once a value is chosen at a ballot, every higher ballot must propose the same value. *Multi-Paxos* runs one Paxos instance per log slot, letting a stable leader skip phase one and commit in two message delays [4].

Raft [3] retains Paxos's safety structure but decomposes consensus into three relatively independent subproblems — leader election, log replication, and safety — and strengthens the leader election rules so that the *Leader Completeness* property ("if a log entry is committed in a given term, then that entry will be present in the logs of the leaders for all higher-numbered terms") holds by construction. This decomposition is precisely what made Raft amenable to a clean TLA+ specification and to Ongaro's understandability study, in which students scored 4.9 points higher (out of 60) on Raft than on Paxos quizzes.

### 2.2 Byzantine Fault Tolerance: PBFT, HotStuff, Hashgraph

Byzantine consensus tolerates *arbitrary* misbehavior — not just crashes — by up to $f$ of $n \\geq 3f+1$ replicas. PBFT established the practical blueprint with its three-phase *pre-prepare/prepare/commit* protocol at $O(n^2)$ message complexity. HotStuff [6] recasts the phases as a pipeline of *quorum certificates* (QCs) — threshold-signature aggregates proving that $2f+1$ replicas voted — achieving linear communication and optimistic responsiveness. Hashgraph's gossip-about-gossip with virtual voting claims *asynchronous* BFT (aBFT), the strongest possible network assumption, and was the first DLT to complete a machine-checked Coq proof of that claim [8].

> **Theorem:** *(Quorum Intersection).* In a system of $n = 3f + 1$ replicas, any two quorums of size $2f + 1$ intersect in at least $f + 1$ replicas, hence in at least one honest replica.
>
> *Proof.* $|Q_1 \\cap Q_2| = |Q_1| + |Q_2| - |Q_1 \\cup Q_2| \\geq (2f+1) + (2f+1) - (3f+1) = f+1$. Since at most $f$ replicas are Byzantine, at least one member of the intersection is honest. ∎

This single lemma is the load-bearing joint of nearly every BFT safety argument, and mechanizing it without appealing to a false injectivity assumption on hash functions required, in one documented case, rewriting proofs that grew from 10 lines to 150 [6].

### 2.3 The Verification Spectrum

| Approach | Representative | Scope | Automation | Proof burden |
|---|---|---|---|---|
| Refinement + Hoare logic | IronFleet/Dafny | Protocol → executable code | High (Z3) | ~30k lines for RSM |
| Interactive theorem proving | Verdi/Coq, TLAPS | Protocol algorithm | Low (manual tactics) | ~50k lines (Verdi) |
| Model checking | TLC, CADP/LNT | Bounded protocol instances | Full (bounded) | Spec ~400 lines |
| Decidable logic | EPR, IC3PO | Protocol inductive invariant | Full | ~1 hour synthesis |
| System transformers | Compositional BFT | Transfer across fault models | Medium | Moderate |

---

## 3. Methodology

### 3.1 The IronFleet Refinement Stack

IronFleet's central methodological contribution is the decomposition of a distributed system into carefully chosen *layers* connected by *refinement* [1][2]:

```
  High-level centralized spec        H0 → H1 → H2 → H3 → H4
       ↕ refinement (TLA-style)
  Distributed protocol               P0 → P1 → P2 → P3
       ↕ refinement (Hoare-style)
  Implementation                     I0 → I1 → I2 → I3
```

Each layer is a state machine; refinement demands that every behavior of the lower machine correspond to a behavior of the upper one. The protocol-to-spec refinement is proven in TLA style — an inductive invariant plus a refinement mapping — while the implementation-to-protocol refinement uses Floyd-Hoare reasoning in Dafny, whose verifier discharges verification conditions through the Z3 SMT solver [1]. Two engineering devices make this tractable:

- **Invariant quantifier hiding.** Dafny/Z3 struggles with undecidable quantifier alternations. IronFleet writes invariants so that quantifiers are hidden behind uninterpreted function abstractions (e.g., reasoning over the *set of messages sent so far* rather than quantifying over histories), steering Z3's heuristics toward success [1][7].
- **Reduction-enabling obligations.** Real hosts interleave receives and sends arbitrarily. IronFleet constrains each host step to perform all receives before all sends (and at most one time-dependent operation), which — by a Lipton-style reduction argument — lets the proof assume atomic steps without loss of generality [1].

The trusted computing base is thus a few dozen lines: the high-level spec, the refinement assertion, and the main event-handler loop above, with proofs covering the bytes of UDP packets on the wire [1].

```dafny
// IronFleet-style mandatory host event-handler loop (simplified)
method Main() {
  var s := ImplInit();
  while (true)
    invariant ImplInvariant(s);
  {
    ghost var journal_old := get_event_journal();
    var ios_performed: seq<IoEvent>;
    s, ios_performed := ImplNext(s);
    assert get_event_journal() == journal_old + ios_performed;
    assert ReductionObligation(ios_performed);
  }
}
```

### 3.2 TLA+ Specification and TLC Model Checking

TLA+ expresses a protocol as `Init ∧ □[Next]_vars`, a temporal formula over state variables [3]. Raft's specification is about 400 lines; it defines the actions each server may take (request vote, append entries, become leader) and the enabling conditions. Safety is expressed as state invariants such as:

```tla
\\* LeaderCompletenessInv: a committed entry persists in all future leaders' logs
LeaderCompletenessInv ==
    \\A s \\in Server, t \\in Nat :
        \\A i \\in 1..Len(log[s]) :
            (log[s][i].term = t \\/ committedBefore(s, i, t))
                => \\A l \\in Server, t2 \\in Nat :
                     (t2 > t \\/ t2 = t) \\/ IsLeader(l, t2)
                         => \\E j \\in 1..Len(log[l]) :
                              log[l][j].term = log[s][i].term
                              \\/ log[l][j].value = log[s][i].value
```

TLC exhaustively explores the state graph for small configurations (e.g., 3 servers, bounded terms and log lengths), checking invariants at every reachable state — 6.4M distinct states in a documented 2025 run [5]. Ongaro mechanically proved the *Log Completeness* property in the TLA proof system, though the proof rests on unchecked invariants such as the type safety of the specification [3]. Compositional techniques such as the IPA (interaction-preserving abstraction) framework reduce checking cost by up to 300× by verifying components separately and composing the results [5].

### 3.3 Interactive Proofs: TLAPS, Coq, Agda

When unbounded generality is required, model checking's bounded scope is insufficient. TLAPS machine-checks hierarchical TLA+ proofs: Chand, Liu, and Stoller verified Multi-Paxos safety in ~1,033 lines of TLAPS, an order of magnitude smaller than IronFleet's 30,000-line Dafny development, by phrasing invariants as high-level queries over message histories [4]. Their proof strategy — minimizing the delta from the Basic Paxos proof and developing reusable set/tuple proof tactics — cut proof-checking time dramatically.

For Byzantine protocols, the Agda verification of HotStuff/LibraBFT proves correctness of an abstract model whose only assumptions on an implementation are two precisely stated rules about externally visible behavior [6]. And hashgraph's Coq development, completed by Karl Crary at CMU, machine-checked the aBFT claim directly [8].

### 3.4 Decidable Fragments and Synthesis

An orthogonal thrust asks how much of this can be *automated*. The EPR (effectively propositional reasoning) fragment is decidable and expressive enough for asynchronous Paxos, Multi-Paxos, and variants [7]. IC3PO goes further: it synthesizes the inductive invariant automatically, producing for Paxos the same invariant humans derived with interactive theorem provers, in under an hour, and the invariant transfers trivially to Multi-Paxos by adding the instance as a universally quantified argument [10].

```python
# IC3PO-style invariant transfer: single-decree Paxos -> Multi-Paxos
# For each strengthening assertion A_i of Paxos, the Multi-Paxos
# version quantifies over instances I:
def lift_to_multipaxos(A):
    """A_11: forall A in Acceptor: maxVBal(A) > -1 -> msg2b(A, maxVBal(A), maxVal(A))"""
    return f"forall A in Acceptor, I in Instances: ({A}) with instance := I"
# Result: M!Safety /\ /\\_{1<=i<=11} M!A_i is already inductive for Multi-Paxos
```

---

## 4. Deep Dive

### 4.1 Case Study I: IronFleet's IronRSL and IronKV

IronRSL is a Paxos-based replicated state machine library; IronKV is a lease-based sharded key-value store built atop it. Both were verified for *safety and liveness* — IronFleet claims the first machine-verified liveness proofs of nontrivial distributed systems [1][2]. The liveness argument assumes fair network behavior and proves the protocol layer makes progress toward the high-level spec's progress predicate, with the implementation refinement preserving the argument.

Total development effort was reported as **3.7 person-years** for the two systems [2]. The verified implementations ran correctly on first execution with no debugging, and achieved performance within roughly 2.4× of unverified Go reference implementations — evidence that verification need not forfeit practicality [2].

### 4.2 Case Study II: Raft in TLA+ — Specification as Artifact

Raft's TLA+ specification serves a dual role: it is simultaneously the *subject* of the safety proof and *documentation precise enough to implement from* [3]. Independent re-modeling found issues in the original spec — Evrard's LNT/CADP modeling surfaced discrepancies that were subsequently corrected — demonstrating that the specification itself benefits from being an executable, checkable artifact rather than prose [11]. The paper is candid about the proof's limits: the TLAPS-checked Log Completeness proof depends on unchecked invariants, including the type safety of the specification [3]. A machine-checked proof with explicit, auditable assumptions is strictly more trustworthy than an informal proof whose assumptions are implicit.

### 4.3 Case Study III: Multi-Paxos — Dafny vs. TLAPS, an Economy of Proof

The same algorithm, two proof economies. IronFleet's Dafny verification of (Multi-)Paxos exceeds 30,000 lines of proof; Chand et al.'s TLAPS verification of Multi-Paxos safety is 1,033 lines; Liu et al.'s extension to variants with preemption, state reduction, and failure detection runs 4,959–7,006 lines — still 4–10× smaller than Dafny and Verdi's 50,000-line Coq Raft proof [4][9]. The difference is not merely stylistic. Dafny verifies an *implementation* (bytes, UDP, integer overflow, failure recovery paths); TLAPS verifies an *algorithm* (message histories, ballot orderings). The high-level message-history queries — "the set of 2b messages ever sent" — let the invariant say in one line what the implementation-level proof spreads across hundreds of scattered updates [9].

> **Theorem:** *(Multi-Paxos Agreement, TLAPS-checked).* For any two decided values $v_1, v_2$ in instances $i_1, i_2$ of Multi-Paxos, if $i_1 = i_2$ then $v_1 = v_2$.
>
> *Proof sketch (mechanized in TLAPS).* Each instance independently satisfies single-decree Paxos safety, since the ballot-ordering invariant $P1$ ("an acceptor votes at most once per ballot") and the chosen-value propagation invariant $P2$ ("any ballot higher than a chosen ballot proposes the chosen value") are indexed by instance and never interfere across instances. Agreement follows by instantiation. ∎

### 4.4 Case Study IV: Byzantine Protocols — HotStuff in Agda, Hashgraph in Coq

Byzantine verification confronts two difficulties absent from the crash-tolerant case. First, the *adversary model*: proofs must quantify over all behaviors of up to $f$ malicious replicas. Second, the *cryptographic idealization*: real protocols rely on threshold signatures and collision-resistant hashes, while proofs typically assume perfect cryptography. The Agda HotStuff work factors the proof through an abstract model: any implementation whose externally visible honest-peer behavior satisfies two stated rules inherits the proved safety and liveness, isolating cryptographic assumptions at the boundary rather than threading them through every lemma [6].

The hashgraph Coq development is notable for *what it chose to verify*: the abstract aBFT argument over the gossip graph, not the implementation [8]. This is a defensible scoping decision — the aBFT proof is the claim that distinguishes hashgraph — but it leaves open exactly the formality gap that IronFleet closes: nothing in the Coq proof constrains the deployed node software.

### 4.5 Comparative Synthesis

No single approach dominates. IronFleet covers the running binary at the highest proof-engineering cost; algorithm-level proofs (TLAPS, Coq, Agda) are 4–50× more economical but leave the implementation unverified; model checking is fully automatic but bounded; decidable-logic synthesis automates the middle ground where invariants fall in a decidable fragment — remarkably, including Paxos, Multi-Paxos, and FlexiblePaxos [7][10]. The emerging consensus is *compositional*: verify the protocol logic once, in the most economical framework, then transfer the guarantee to the implementation and across fault models without redoing the proof [2].

---

## 5. Empirical Results and Proofs

We collect the quantitative claims reported across the surveyed works. All figures are as reported by the original authors; we did not independently reproduce the proof developments.

| System | Framework | Proof size | Effort | Performance vs. unverified |
|---|---|---|---|---|
| IronRSL + IronKV | Dafny/Z3 | ~30k lines (proof+spec) | 3.7 person-years | within ~2.4× of Go reference |
| Raft (Ongaro) | TLA+/TLAPS/TLC | ~400-line spec; 3,500-word informal safety proof | dissertation-scale | n/a (algorithm-level) |
| Raft (Verdi) | Coq | ~50k lines | many months, experts | n/a |
| Multi-Paxos (Chand et al.) | TLAPS | 1,033 lines | weeks | n/a |
| Multi-Paxos variants (Liu et al.) | TLAPS | 4,959–7,006 lines | moderate | n/a |
| Paxos (IC3PO) | automated synthesis | 11 strengthening assertions | < 1 hour compute | n/a |
| HotStuff/LibraBFT | Agda | abstract model + 2-rule interface | moderate | n/a |
| Hashgraph aBFT | Coq | proof of abstract algorithm | single-author (Crary) | n/a |

Three patterns stand out. **First**, the proof-size ordering is stable: implementation-level verification costs an order of magnitude more than algorithm-level verification, which costs an order of magnitude more than automated synthesis where applicable [4][9][10]. **Second**, verification is compatible with competitive performance: IronFleet's systems ran correctly on first execution and stayed within a small constant factor of unverified baselines [2]. **Third**, the *trusted base* does not shrink with automation — mechanization moves trust, it does not eliminate it.

---

## 6. Limitations and Threats to Validity

**The formality gap.** With the exception of IronFleet, every surveyed verification covers the protocol *model*, not the deployed *implementation*. A bug in message serialization, a misconfigured timeout, or an overflow in a hand-rolled queue can violate in production what the proof guarantees on paper. IronFleet closes the gap but at a cost — 3.7 person-years — that few industrial teams will pay [1][2].

**Assumptions smuggled into the model.** Ongaro's TLAPS proof of Raft's Log Completeness rests on unchecked invariants, including type safety of the specification [3]. Toychain's Coq development initially assumed an *injective* hash function — a false assumption about real cryptography — and removing it forced a rewrite in which one proof grew from 10 to 150 lines [6]. Every mechanized proof should be read with its assumption list, not just its theorem statement.

**Liveness and the network model.** Safety ("nothing bad happens") is far easier to mechanize than liveness ("something good eventually happens"). IronFleet's liveness proofs are a genuine first, but they assume fair network behavior that real networks only approximate [1]. BFT liveness proofs universally assume partial synchrony (GST eventually arrives); hashgraph's aBFT claim is the notable exception, and it remains the most ambitious — and most narrowly scoped — machine-checked result in the area [8].

**Proof maintenance.** A 30,000-line Dafny development is a software artifact in its own right, subject to bit-rot as solvers, languages, and protocols evolve. The TLAPS line of work argues explicitly that shorter proofs are easier to maintain and faster to re-check — a serious engineering consideration, not an aesthetic one [9].

**Evaluation validity.** Effort figures (person-years) and proof-line counts are self-reported, measured differently across projects, and confounded by author expertise. Performance comparisons (IronFleet vs. Go baselines) compare systems written with different optimization budgets. These numbers should be read as existence proofs, not benchmarks.

---

## 7. Conclusion

Mechanized verification of distributed consensus has matured from a research curiosity into a portfolio of engineering disciplines, each with a clear cost model. IronFleet demonstrated that end-to-end verification of realistic distributed systems — protocol, implementation, and wire bytes, with safety *and* liveness — is achievable at a tolerable, if substantial, proof burden [1][2]. The TLA+ tradition showed that a precise, checkable specification is itself a high-value artifact, catching bugs in the specification before any code is written [3][11]. TLAPS and the Paxos proof-economy literature showed that algorithm-level verification can be an order of magnitude cheaper than implementation-level verification without sacrificing machine-checked certainty [4][9]. And the Byzantine line — HotStuff in Agda, hashgraph in Coq — showed that even adversarial models and the strongest network assumptions yield to mechanization when the proof is properly factored [6][8].

The central open problem is *compositional economy*: how to verify once and transfer everywhere — from model to implementation, from crash faults to Byzantine faults, from one protocol variant to the next — without paying the full proof cost each time. System transformers, interaction-preserving abstractions, and decidable-fragment synthesis are the first answers; making them routine engineering practice is the work of the next decade. The standard is moving from "tested" to "correct." The proofs are getting shorter. The gap is closing.

---

## References

[1] Chris Hawblitzel, Jon Howell, Manos Kapritsos, Jacob R. Lorch, Bryan Parno, Michael L. Roberts, Srinath Setty, and Brian Zill. *IronFleet: Proving Practical Distributed Systems Correct.* In Proc. 25th ACM Symposium on Operating Systems Principles (SOSP), October 2015. https://www.andrew.cmu.edu/user/bparno/papers/ironfleet.pdf

[2] Chris Hawblitzel, Jon Howell, Manos Kapritsos, Jacob R. Lorch, Bryan Parno, Michael L. Roberts, Srinath Setty, and Brian Zill. *IronFleet: Proving Safety and Liveness of Practical Distributed Systems.* Communications of the ACM 60(7), July 2017. https://web.eecs.umich.edu/~manosk/assets/papers/ironfleet-cacm17.pdf

[3] Diego Ongaro and John Ousterhout. *In Search of an Understandable Consensus Algorithm (Extended Version).* USENIX ATC 2014. https://www.scs.stanford.edu/26wi-cs244c/sched/readings/raft.pdf

[4] Saksham Chand, Yanhong A. Liu, and Scott D. Stoller. *Formal Verification of Multi-Paxos for Distributed Consensus.* arXiv:1606.01387 [cs.DC], 2016 (rev. 2019). https://arxiv.org/abs/1606.01387v3

[5] Compositional Model Checking of Consensus Protocols Specified in TLA+ via Interaction-Preserving Abstraction. arXiv:2202.11385. https://arxiv.org/pdf/2202.11385

[6] *Towards Formal Verification of HotStuff-based Byzantine Fault Tolerant Consensus in Agda.* arXiv:2203.14711. http://arxiv.org/pdf/2203.14711

[7] Oded Padon, Kenneth L. McMillan, Aurojit Panda, Mooly Sagiv, and Sharon Shoham. *Paxos Made EPR: Decidable Reasoning about Distributed Protocols.* OOPSLA 2017. http://arxiv.org/pdf/1710.07191

[8] *Hedera Hashgraph first DLT to complete Coq formal method proof* (Karl Crary, CMU). CryptoNinjas, Oct 2018. https://www.cryptoninjas.net/2018/10/17/hedera-hashgraph-first-dlt-to-complete-coq-formal-method-proof/

[9] Yanhong A. Liu et al. *Moderately Complex Paxos Made Simple: High-Level Executable Specification of Distributed Algorithms.* arXiv:1704.00082. http://arxiv.org/pdf/1704.00082

[10] Aman Goel and Karem A. Sakallah. *Towards an Automatic Proof of Lamport's Paxos.* arXiv:2108.08796. https://arxiv.org/pdf/2108.08796

[11] Hugues Evrard. *Modeling the Raft Distributed Consensus Protocol in LNT.* arXiv:2004.13284. https://arxiv.org/pdf/2004.13284v1
