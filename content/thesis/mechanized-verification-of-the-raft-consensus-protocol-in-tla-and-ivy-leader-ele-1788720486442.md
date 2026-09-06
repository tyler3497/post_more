---
id: ths_1788720451385_0eb0
title: "Mechanized Verification of the Raft Consensus Protocol in TLA+ and Ivy: Leader Election Safety, Log Matching via Induction, Liveness under Partial Synchrony, and Membership Reconfiguration with Joint Consensus"
anon: anon#6687
ts: 1788720486442
tags: [Distributed]
type: thesis
---
# Mechanized Verification of the Raft Consensus Protocol in TLA+ and Ivy: Leader Election Safety, Log Matching via Induction, Liveness under Partial Synchrony, and Membership Reconfiguration with Joint Consensus

## Abstract

Raft is a distributed consensus algorithm engineered for *understandability*, yet its correctness argument spans hundreds of lines of TLA+ and an inductive invariant whose discovery took its authors years of refinement. This thesis develops a unified account of the *mechanized* verification of Raft across three complementary toolchains: (i) the original TLA+ specification and its TLAPS-checked safety proof of leader election and log replication [1][2]; (ii) the first mechanically checked proof of a Raft *reconfiguration* protocol — joint-consensus membership change — in TLA+ with the TLA+ Proof System [3]; and (iii) decidable-fragment deductive verification in Ivy, which trades the generality of higher-order proof assistants for predictable SMT-based automation via the effectively propositional (EPR) fragment [5][6][7], alongside the Coq/Verdi framework's end-to-end verified implementation [4][8]. We reconstruct the safety argument from first principles — *Election Safety*, *Log Matching*, and *Leader Completeness* — show how the inductive invariant is strengthened until it becomes closed under the next-state relation, and analyze the decidability constraints that make Ivy-style verification feasible. A comparative evaluation measures proof effort, automation yield, and state-space coverage.

---

## 1 Introduction

Distributed consensus is the foundational problem of replicated state machines: a cluster of servers, subject to crash failures and an adversarial network, must agree on a single totally ordered log of commands [1]. Paxos established the theory, but its reputation for inscrutability motivated Diego Ongaro and John Ousterhout to design **Raft** — an algorithm decomposed into leader election, log replication, and safety, with a coherent-leader restriction that makes the correctness argument more teachable [1].

Teachability is not correctness. In 2014, a *safety bug* was found in Raft's single-server membership change mechanism — precisely the component whose correctness argument was least formalized — prompting the community to invest in *mechanized* verification: proofs whose every step is checked by machine [2]. Ongaro's dissertation gives both a ~450-line TLA+ specification of Raft and a TLAPS-checked proof of the Log Completeness property, the lemma on which state-machine safety rests [2]. Later work closed the reconfiguration gap, mechanically verifying a joint-consensus reconfiguration protocol in TLA+/TLAPS [3]. Orthogonal efforts took different routes: the **Verdi** framework in Coq produced the first mechanically checked proof of *linearizability* of a Raft implementation, with code extraction to OCaml [4][8]; and **Ivy** demonstrated that consensus protocols including Raft-family algorithms can be verified in decidable fragments of first-order logic, with the human supplying only inductive invariants while SMT solvers discharge all proof obligations [5][6][7].

This thesis makes four contributions:

1. A self-contained reconstruction of Raft's TLA+ safety proof, identifying the exact inductive invariant conjuncts that close the proof and the role of *type correctness* as a prerequisite.
2. An account of the first mechanically verified Raft reconfiguration protocol [3], explaining why single-server membership change failed and how joint consensus restores the quorum-intersection argument.
3. A comparative analysis of decidable-fragment verification in Ivy [5][6][7] versus interactive TLAPS and Coq/Verdi proofs, with attention to what each method can and cannot automate.
4. A treatment of **liveness** — deliberately outside Raft's TLAPS proof — covering the partial-synchrony assumptions required, and the reduction of liveness to safety in Ivy [6].

> **Theorem (State Machine Safety):** If a server has applied a log entry at a given index to its state machine, no other server will ever apply a different command for the same log index [1].

---

## 2 Background

![Raft leader election and log replication state machine](/thesis/ths_1788720451385_0eb0-0.webp)

### 2.1 The Raft algorithm

Raft operates in *terms*, each term beginning with an election. Servers are in one of three states — **leader**, **follower**, **candidate**. At most one leader exists per term (Election Safety). The leader accepts client requests, appends them to its log, and replicates them via `AppendEntries` RPCs; a follower's log is made to match the leader's. An entry is **committed** once stored on a majority of servers, and the leader commits entries from its own term only after a newer entry is committed — the subtle rule that prevents a deposed leader's uncommitted entries from being committed by a successor [1].

Key safety properties form a dependency chain:

- **Election Safety:** at most one leader is elected in a given term.
- **Log Matching:** if two logs contain an entry with the same index and term, then the logs are identical in all entries preceding that index.
- **Leader Completeness:** if a log entry is committed in a term, then that entry appears in the logs of the leaders of all higher-numbered terms.
- **State Machine Safety:** the property quoted above, which follows from Leader Completeness plus Log Matching [2].

### 2.2 TLA+, TLC, and TLAPS

TLA+ is Leslie Lamport's specification language for concurrent systems: a specification is a formula `Init ∧ □[Next]_vars`, where `Init` describes initial states and `Next` is a disjunction of actions describing all possible transitions. The **TLC** model checker exhaustively explores finite instances of a specification (bounded numbers of servers, terms, and log lengths), making it the standard tool for *debugging* a specification and *candidate invariants* before proof. **TLAPS**, the TLA+ Proof System, checks hierarchical human-written proofs: each step is discharged by back-end provers (SMT solvers, Zenon, Isabelle/TLA+), and the trusted base includes only the proof manager and the back ends [2][3].

### 2.3 Ivy and decidable fragments

Ivy is a multi-modal verification tool for distributed systems developed by McMillan and Padon [5][6]. Its central design decision is to restrict the protocol model and its inductive invariant to a *decidable fragment* of first-order logic — effectively propositional logic (EPR) after the finite-model property — so that SMT solvers (Z3, ABC) decide every verification condition predictably [5][6]. When verification fails, Ivy displays a concrete counterexample to induction, and the user generalizes from it interactively; this loop replaced months of manual invariant debugging in the original PLDI 2016 work [7]. Ivy also compiles verified protocols to executable C++ and supports model checking, testing, and manual natural-deduction proofs in one tool [6].

### 2.4 Verdi in Coq

Verdi is a Coq framework for implementing and verifying distributed systems by Wilcox et al. [4]. Systems are written against idealized network semantics; *verified system transformers* (VSTs) then transfer correctness guarantees to adversarial fault models without additional proof burden. The Verdi Raft project [8] gives a Coq implementation of Raft with a mechanically checked proof of **linearizability** — the first such proof for Raft — and extracts to running OCaml code. Its inductive invariant approach in the proof of linearizability ("planning for change", CPP 2016 [8]) shares intellectual lineage with the TLA+ work.

| Approach | Toolchain | Logic | Automation | Artifact |
|----------|-----------|-------|------------|----------|
| Ongaro TLA+ | TLC + TLAPS | TLA+ (set theory) | SMT back ends, human proof skeleton | Checked safety proof [2] |
| Reconfiguration | TLA+ + TLAPS | TLA+ | Same, plus new invariant | First verified Raft reconfiguration [3] |
| Ivy | Z3/ABC | Decidable FOL (EPR) | Fully automatic VCs | Verified protocol + C++ code [5][6] |
| Verdi Raft | Coq | CIC | Tactics, manual | Verified impl + OCaml extraction [4][8] |

---

## 3 Methodology

Our methodology is comparative and reconstructive. We take the published specifications and proofs as primary sources [1][2][3][4][5][6][7][8] and reconstruct the proof architecture at a uniform level of detail, asking for each toolchain: *what is the statement proved, what is the inductive invariant, who discovers it, and what discharges the proof obligations?*

**Reconstruction of the TLA+ proof.** We follow Ongaro's dissertation [2]: the specification models servers, terms, votes, logs, and messages, with an asynchronous network that may drop, duplicate, and reorder messages, and servers that fail by stopping and restart from stable storage. The proof proceeds by strengthening an inductive invariant `Inv` until `Init ⇒ Inv`, `Inv ∧ Next ⇒ Inv'`, and `Inv ⇒ Safety` are all provable. We enumerate the conjuncts and explain, for each, which action of `Next` would violate it without the conjunct present — the standard "invariant discovery by failed induction" loop, performed first with TLC on small instances and only then checked in TLAPS.

**Reconfiguration case study.** We analyze the reconfiguration verification of [3]: the authors formalize joint consensus — in which a transitional configuration `C_old,new` requires majorities of *both* the old and new configurations for leader election — and prove the inductive invariant mechanically with TLAPS, giving what they report as the first formal verification of a Raft-family reconfiguration protocol.

**Decidability analysis.** For Ivy, we analyze the EPR fragment restriction [5][7]: invariants must be universally quantified formulas over uninterpreted relations such that, after Skolemization, they lie in the Bernays–Schönfinkel class (∃*∀* prefix), which enjoys the finite-model property and is therefore decidable. We examine which Raft concepts fit naturally (quorum intersection via majority sets) and which resist the fragment (arithmetic over terms, transitive closure of log order), and how the tool's modularity and tactic mechanisms [6] recover expressiveness.

**Liveness.** Raft's published proofs are *safety* proofs; liveness requires timing assumptions (partial synchrony). We survey the treatment of liveness in Ivy via the reduction of liveness to safety [6] and discuss why TLAPS liveness proofs remain rare for Raft.

> **Theorem (Election Safety):** If a server `s` is leader in term `t`, no other server can become leader in term `t`. *Proof sketch.* A candidate wins term `t` by collecting votes from a majority of the configuration; two majorities intersect, and a server votes at most once per term [1].

---

## 4 Deep Dive

### 4.1 Leader election and the RequestVote invariant

Raft's election is deliberately constrained: a candidate's `RequestVote` is granted only if the candidate's log is *at least as up-to-date* as the voter's (comparing last term, then last index). This is the mechanism that makes Leader Completeness provable — the eventual leader necessarily possesses all committed entries.

In TLA+, the election is modeled by actions `RequestVote`, `HandleRequestVoteRequest`, and `BecomeLeader`. The critical invariant conjunct is the *one-vote-per-term* rule: for every server `s` and term `t`, `s` grants at most one vote in term `t`, and if `s` granted its vote to candidate `c`, then `s` will not grant votes in term `t` to anyone else. Combined with the majority-intersection lemma — any two majorities of the same configuration share a server — Election Safety follows by contradiction: two leaders in term `t` would require two disjoint voting majorities [1][2].

The subtlety the TLA+ proof exposes is that the invariant must also constrain *messages in flight*: a delayed `RequestVoteResponse` from an earlier attempt must not be counted toward a later term's quorum. The dissertation's specification handles this by tagging votes with terms and requiring the candidate to count only responses matching its current term — a detail easily lost in prose but unavoidable in the machine-checked proof [2].

```tla
BecomeLeader(i) ==
    /\ state[i] = "candidate"
    /\ Cardinality(votesGranted[i]) * 2 > Cardinality(Server)
    \* invariant: a server grants at most one vote per term
    /\ \A s \in Server : votedFor[s] = i => term[s] = currentTerm[i]
```

### 4.2 Log matching and leader completeness by induction

Log Matching is the workhorse lemma. Its proof is by induction on the `AppendEntries` action: the leader sends entries only by appending to a log that already matches the follower's log at the preceding index (the consistency check), so appending preserves the matching property; conflicting entries are deleted before appending, which also preserves it [1]. The TLA+ proof requires the invariant to state Log Matching as a *global* property of all pairs of servers — not merely leader–follower pairs — because followers exchange no messages directly yet their logs must still match pairwise.

Leader Completeness then follows: suppose entry `e` is committed in term `t`. Any leader of term `t' > t` won an election with votes from a majority; the majority that committed `e` and the voting majority intersect in some server `s`; `s` voted for the new leader only if the new leader's log was at least as up-to-date as `s`'s — and `s`'s log contains `e` — so the new leader's log contains `e` [1]. The mechanized proof's difficulty is that "at least as up-to-date" must be expressed as an invariant relating `lastTerm`/`lastIndex` across servers and terms, and the *induction* must carry the property that every leader's log contains all entries committed in earlier terms — a statement that is *not* inductive on its own and must be bundled with the vote-granting restriction.

![Joint consensus reconfiguration quorum overlap diagram](/thesis/ths_1788720451385_0eb0-1.webp)

### 4.3 Membership reconfiguration and joint consensus

Reconfiguration is where Raft's informal argument broke down. In the original single-server membership change, adding or removing one server at a time was *believed* safe because "a majority of the old and new configurations overlap" — but the argument was never fully formalized, and in 2014 a safety bug was found [2][3]. The problem: during the transition, a server that has not yet learned the new configuration computes quorums against the *old* configuration size, and can elect itself leader of the same term with a "majority" that does not intersect the true majority.

**Joint consensus** fixes this by making the transition explicit: the leader first replicates a log entry for the joint configuration `C_old,new`, during which *both* majorities (of `C_old` and `C_new`) are required for elections and commitment; then it replicates `C_new` alone [1]. The mechanized proof in [3] formalizes this in TLA+ and proves the invariant with TLAPS. The key lemma is a *generalized quorum-intersection property*: any majority of `C_old,new` (i.e., a set containing a majority of `C_old` *and* a majority of `C_new`) intersects any majority of `C_old` and any majority of `C_new`. The inductive invariant must now be parameterized by the *configuration sequence* in each server's log, and the proof must handle the case where different servers have applied different prefixes of the configuration-change entries — precisely the scenario the informal argument glossed over.

This is the thesis's central comparative datapoint: reconfiguration is the *first* Raft feature whose verification was born mechanized, and it is also the feature where the Ivy approach faces its steepest challenge, because configuration sequences are unbounded lists that resist EPR encoding — arithmetic-free, quantifier-restricted logics cannot naturally express "the sequence of configurations in the log."

### 4.4 Decidable verification in Ivy: what fits in EPR

Ivy's verification conditions must fall in a decidable fragment — typically EPR (∃*∀*), which has the finite-model property: if a formula is satisfiable, it is satisfiable in a finite model, so SMT solvers can decide it [5][6]. Raft's core safety argument turns out to be surprisingly EPR-friendly: *quorum intersection* is expressible with uninterpreted predicates over sets, and the vote-once-per-term discipline is a universal statement over servers and terms. Padon's PLDI 2016 work [7] demonstrated the interactive-generalization loop on consensus-family protocols; the CAV 2020 multi-modal tool [6] added model checking, testing, and code extraction around the same decidable core.

What resists EPR: **term arithmetic** (terms are totally ordered; EPR cannot express transitive closure or induction over naturals) and **log order** (the "precedes" relation on log indices). The standard remedies are *modular decomposition* — verifying the election layer and the replication layer separately with abstract interfaces, as in the PLDI 2018 modularity work [6] — and *ghost state* that reifies the needed order facts as uninterpreted relations constrained by axioms. The price is paid in modeling ingenuity rather than prover time: every VC discharges in seconds once the model fits the fragment, but fitting the model is the work [5].

### 4.5 Verdi in Coq: from specification to running code

Verdi takes the opposite trade: full expressive power of the Calculus of Inductive Constructions, at the cost of manual proof. The Raft development [8] implements the protocol in Verdi's handler monad against an idealized network semantics, then applies verified system transformers to transport the linearizability guarantee to realistic fault models — the "planning for change" methodology of the CPP 2016 paper [8]. Where the TLA+ proof checks the *algorithm*, Verdi checks an *implementation* and extracts it to OCaml, closing the gap between verified model and deployed artifact [4]. The Raft linearizability proof was the first mechanically checked proof of its kind, and its inductive invariant — over 50 supporting lemmas about ghost state tracking commit indices and message histories — is the largest of the four approaches surveyed, reflecting the price of implementation-level fidelity.

---

## 5 Empirical Evaluation / Proofs

We compare the four approaches on proof effort, automation, and coverage. Precise line counts vary across revisions; the figures below are order-of-magnitude, drawn from the cited sources.

| Dimension | TLA+/TLAPS (core) [2] | TLA+/TLAPS (reconfig) [3] | Ivy [5][6][7] | Verdi/Coq [4][8] |
|-----------|----------------------|---------------------------|---------------|------------------|
| Property proved | Safety (Log Completeness, State Machine Safety) | Safety incl. joint-consensus reconfiguration | Safety (decidable fragment) | Linearizability of implementation |
| Spec size | ~450 lines TLA+ [2] | Extended with configuration sequence | Ivy model, modular | Full Coq implementation |
| Invariant discovery | Human, TLC-assisted | Human, TLC-assisted | Interactive generalization from CTIs [7] | Human |
| Obligation discharge | SMT/ATP back ends | SMT/ATP back ends | Automatic (EPR decidable) | Coq tactics, manual |
| Liveness | Not proved | Not proved | Via liveness-to-safety reduction [6] | Not the focus |
| Executable artifact | No | No | C++ extraction [6] | OCaml extraction [4] |
| Re-verification cost | Re-run TLAPS (minutes–hours) | Same | Seconds (push-button) | Re-run Coq (hours) |

Three findings emerge. **First**, TLC's role is underappreciated: in every TLAPS effort, the invariant was *debugged* by model checking before it was proved — TLC finds the missing conjunct in seconds on 3-server, 2-term instances, a workflow the Ivy counterexample-to-induction display deliberately mirrors [2][6]. **Second**, reconfiguration dominates marginal proof cost: the core safety proof's invariant is stable across implementations, while each new *feature* (reconfiguration, pre-vote, read-only queries) demands fresh invariant engineering [3]. **Third**, automation inverts the cost structure: Ivy's per-change re-verification is seconds, versus hours for TLAPS/Coq, which is why the decidable-fragment approach is attractive for *evolving* protocols even though its initial modeling cost is comparable.

> **Theorem (Generalized Quorum Intersection):** Let `Q_old`, `Q_new` be majorities of configurations `C_old`, `C_new`, and `Q_joint` a set containing a majority of each. Then `Q_joint ∩ Q_old ≠ ∅` and `Q_joint ∩ Q_new ≠ ∅`. *Proof.* By pigeonhole on each configuration's server set [3].

On liveness: Raft's leader election guarantees termination only under partial synchrony (eventual timely message delivery). The TLA+ efforts prove safety unconditionally and leave liveness informal; Ivy's POPL 2018 reduction [6] compiles liveness properties to safety verification conditions in first-order logic, which is the most promising route to a *mechanized* Raft liveness proof, though a complete end-to-end result remains open.

---

## 6 Limitations

**Scope of the mechanized claims.** The TLAPS proofs verify the *specification*, not any implementation; bugs in the gap between spec and code (serialization, RPC framing, persistence ordering) are out of scope — precisely the gap Verdi closes at the cost of far greater effort [2][4]. Conversely, Verdi verifies one implementation; the TLA+ spec is reusable across implementations.

**Reconfiguration coverage.** The verified reconfiguration protocol of [3] covers joint consensus over the core replication path; production extensions — pre-vote, leadership transfer, read-only lease reads — remain largely unverified, and each interacts with the configuration machinery in ways that could invalidate the invariant.

**Decidability boundaries.** Ivy's automation applies only when the model fits a decidable fragment. Protocols whose correctness depends on arithmetic (e.g., bounded retry counters), transitive closure (reachability in dynamic topologies), or higher-order state resist the fragment, and the modularity workarounds [6] reintroduce manual proof architecture. Raft is near the boundary of what fits comfortably.

**Liveness gap.** No surveyed effort gives a complete mechanized proof of Raft *liveness* (eventual leader election and progress under partial synchrony). The liveness-to-safety reduction [6] is the technical path forward, but applying it to full Raft is future work.

**Evaluation limits.** Our comparison is qualitative and source-based; we did not re-run the TLAPS or Coq developments, so effort figures are as reported. Proof-engineering productivity remains notoriously hard to measure.

---

## 7 Conclusion

Mechanized verification has transformed Raft from a "more understandable" algorithm with a prose correctness argument into one of the most thoroughly machine-checked consensus protocols in existence. The trajectory is instructive: Ongaro's TLA+ specification and TLAPS proof [1][2] established the safety baseline; the discovery of the reconfiguration bug drove the *first* mechanically verified Raft reconfiguration [3]; Verdi [4][8] pushed verification down to executable code; and Ivy [5][6][7] showed that decidable fragments can make re-verification push-button at the cost of modeling discipline.

The deeper lesson concerns *where* proof effort goes. Across all four approaches, the dominant cost is not discharging proof obligations — SMT solvers and proof checkers handle that — but *discovering the inductive invariant*: the precise strengthening of the safety property that is closed under every transition. TLC's counterexample-driven debugging, Ivy's interactive generalization, and Verdi's ghost-state methodology are three faces of the same activity. Future work should therefore target invariant *inference* — IC3PO, SWISS, and DistAI-style automation [3] — applied to full Raft including reconfiguration, and the liveness frontier via liveness-to-safety reduction [6]. When the invariant can be inferred, consensus verification becomes routine engineering; until then, it remains a craft — but a craft whose products, for Raft, are now checked by machine.

---

## References

[1] D. Ongaro and J. Ousterhout, "In Search of an Understandable Consensus Algorithm (Extended Version)," USENIX ATC 2014. https://www.scs.stanford.edu/26wi-cs244c/sched/readings/raft.pdf

[2] D. Ongaro, "Consensus: Bridging Theory and Practice," Ph.D. dissertation, Stanford University, 2014. (Ch. 3: formal TLA+ specification, ~450 lines; TLAPS proof of Log Completeness.) http://files.catwell.info/misc/mirror/2014-ongaro-raft-phd.pdf

[3] "Formal Verification of a Reconfiguration Protocol for Raft-based Replication Systems with TLA+ and TLAPS," arXiv:2109.11987, 2021 — first mechanically checked proof of a Raft-family reconfiguration protocol. http://arxiv.org/pdf/2109.11987

[4] J. R. Wilcox, D. Woos, P. Panchekha, Z. Tatlock, X. Wang, M. D. Ernst, and T. Anderson, "Verdi: A Framework for Implementing and Formally Verifying Distributed Systems," PLDI 2015 — first mechanically checked proof of Raft linearizability. https://homes.cs.washington.edu/%7Emernst/pubs/verify-distsystem-pldi2015-abstract.html

[5] K. L. McMillan and O. Padon, "Deductive Verification in Decidable Fragments with Ivy," SAS 2018. http://mcmil.net/pubs/SAS18.pdf

[6] K. L. McMillan and O. Padon, "Ivy: A Multi-modal Verification Tool for Distributed Algorithms," CAV 2020. https://doi.org/10.1007/978-3-030-53291-8_12

[7] O. Padon, K. L. McMillan, A. Panda, M. Sagiv, and S. Shoham, "Ivy: Safety Verification by Interactive Generalization," PLDI 2016. https://www.cs.tau.ac.il/~sharonshoham/papers/pldi16.pdf

[8] D. Woos, J. R. Wilcox, S. Anton, Z. Tatlock, M. D. Ernst, and T. Anderson, "Planning for Change in a Formal Verification of the Raft Consensus Protocol," CPP 2016. https://doi.org/10.1145/2854065.2854081
