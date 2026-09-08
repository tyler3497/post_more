---
id: verdi-raft-coq-verification-ebaa
title: "Mechanized Verification of Raft Consensus with Verdi in Coq: Verified System Transformers, Network Semantics, and Crash-Recovery Proofs"
anon: anon#0135
ts: 1788882604000
type: thesis
---

# Mechanized Verification of Raft Consensus with Verdi in Coq: Verified System Transformers, Network Semantics, and Crash-Recovery Proofs

## Abstract

The Raft distributed consensus protocol underpins much of modern infrastructure, yet its implementations have historically rested on testing rather than proof. This thesis gives a technical account of the Verdi framework — a Coq methodology for implementing and formally verifying distributed systems — and its application to the first mechanized proof of state-machine safety for Raft [1][2]. We develop the core ideas: executable systems embedded in Coq as pure handler functions, *network semantics* formalized as inductive transition relations over packets and node state, and *verified system transformers* that upgrade a system proved under simple network assumptions to one provably correct under realistic fault models including crashes and reboots. We dissect the Raft verification — the ghost-variable transformer, the interface-driven decomposition of election safety and log matching, the refinement chain to linearizable state-machine replication, and OCaml extraction to running code — then evaluate the methodology honestly: its invariant-discovery burden, its trust assumptions, and its liveness blind spot.

## 1 Introduction

Distributed consensus — getting unreliable machines to agree on a growing sequence of decisions despite delays and crashes — is the narrow waist of distributed infrastructure. The Raft protocol [3] achieves it with a strong-leader design that favors understandability over Paxos's subtlety. But understandability is a property of the *algorithm*, not of its implementations. Production Raft codebases are concurrent, failure-prone, and resistant to exhaustive testing. Can the correctness of a *real, running* consensus implementation be established with mathematical certainty rather than empirical confidence?

The Verdi project (Wilcox, Woos, Tatlock, Ernst, Anderson et al., University of Washington) answers affirmatively [1]. Verdi is a Coq framework for implementing and formally verifying distributed systems, built on a strict separation of three concerns:

1. **What the system does** — pure Coq handler functions reacting to network packets and external inputs.
2. **What the network may do** — *network semantics*, inductive step relations over global system state encoding precise fault models.
3. **How fault tolerance is added** — *verified system transformers* (VSTs), mapping a system verified under weak assumptions to one provably analogous under adversarial assumptions [1][6].

Because handlers are pure Gallina functions, they are simultaneously specification, implementation, and proof object. Coq extraction compiles them to OCaml, linked against a small trusted shim, yielding binaries that run on real networks — with, in the authors' phrase, "no formality gap between the model and the implementation" [1].

The Raft verification [2][5] is Verdi's flagship result: the first formal proof of state-machine safety for Raft, requiring roughly ninety iteratively discovered invariants, composed into an end-to-end guarantee of linearizable state-machine replication, with the implementation extracted and running. Along the way Woos et al. developed a methodology of *planning for change* in large proof developments: proof interfaces, custom induction principles, higher-order transport lemmas, and structural tactics [2].

## 2 Background

### 2.1 The Raft consensus protocol

Raft [3] splits consensus into leader election, log replication, and safety. Time is divided into *terms*; a candidate winning a majority becomes leader. The leader appends client commands to its log and replicates them via `AppendEntries` RPCs; entries stored on a majority are *committed* and applied to every state machine in order. Two invariants carry the design:

- **Election safety:** at most one leader per term.
- **Leader completeness:** a committed entry appears in every higher-term leader's log.

Ongaro and Ousterhout's argument is a careful hand proof — about the protocol, not any implementation. Verdi's contribution is verifying the implementation itself.

### 2.2 Coq as implementation and proof language

Coq's Gallina programs extract to OCaml; propositions about them are proved interactively and checked by a small trusted kernel. Verdi requires systems in a restricted, total, pure style: a finite node set, each node with a `name` type, a `state` type, and two handlers:

```coq
net_handler   : name → state → packet → (list output) × state × (list packet)
input_handler : name → state → input  → (list output) × state × (list packet)
```

written in a handler monad threading state and accumulating emissions [4]. Totality keeps the logic consistent and extraction well-behaved.

### 2.3 Network semantics as inductive relations

A *network semantics* is an inductive step relation over global state — a node-name→state map, in-flight packets, and fault-model bookkeeping:

```coq
Inductive step : network → network → Prop :=
  | step_deliver : ∀ net net' p,
      In p (packets net) →
      net_handler (dst p) (nodes net (dst p)) (payload p) = (os, s', ps) →
      step net (deliver net p os s' ps)
  | step_drop : ∀ net p,
      In p (packets net) → step net (remove_packet net p)
  | step_dup  : ∀ net p,
      In p (packets net) → step net (add_packet net p).
```

Fault models are obtained by adding or removing rules: a reliable semantics omits `step_drop`; a crash semantics adds `CRASH`/`REBOOT` steps with failed-node bookkeeping [6]. Safety is proved by induction over the reflexive-transitive closure of `step`.

### 2.4 Verification landscape before Verdi

Earlier mechanized efforts verified *models* (TLA+, Ivy) or abstract code (IronFleet/Dafny), leaving a gap to deployed binaries; seL4 proved sequential code correct but not distributed behavior. Verdi's novelty was making implementation and model coincide while keeping the fault model explicit, compositional, and machine-checked [1].

---

## 3 Methodology

### 3.1 The Verdi workflow

**Stage 1 — Implement.** Handlers are written in `HandlerMonad`, a writer/state monad keeping emitted packets explicit and proof automation (`VerdiTactics.v`) effective [4]. Example systems: a lock server (`LockServ.v`), the `vard` key-value store (`VarD.v`), a counter with backup.

**Stage 2 — Specify and prove.** Safety properties are predicates over reachable states, proved by induction on the step relation. The `StatePacketPacket` technique decomposes invariants into per-state, per-packet, and per-pair conjuncts so each step case discharges a small local obligation [4].

**Stage 3 — Transform and extract.** Verified transformers lift the system into harsher semantics; handlers are extracted to OCaml and linked with a trusted shim.

### 3.2 Verified system transformers

A *system transformer* maps systems to systems; a *verified* one carries a proof that the transformed system satisfies properties *analogous* to the original's, under a different, more adversarial semantics [1]:

| Transformer | Input assumption | Output guarantee |
|---|---|---|
| `SeqNum` | reliable in-order delivery | same, over a lossy/duplicating/reordering network (sequence numbers + retransmission) |
| `PrimaryBackup` | single-node correctness | crash-recovery tolerance via async primary–backup replication |
| `GhostVariable` | — | identical observable behavior with enriched auxiliary state |

> **Theorem (Transformer correctness, schematic):** If system `M` satisfies trace property `P` under semantics `S`, then `T(M)` satisfies the lifting of `P` under the harsher semantics `S'`.

Fault tolerance is thus verified *once*, as a transformer, and applied to many systems. Application logic is proved under the simplest adequate semantics; the transformer carries the proof across the semantic gap.

### 3.3 The refinement chain for Raft

For Raft this becomes a *refinement stack*, each layer a proof interface with proofs in `raft-proofs/` [5]:

```
  ┌─────────────────────────────────────────────┐
  │ Linearizable state-machine replication spec │
  ├─────────────────────────────────────────────┤
  │ Log matching + leader completeness          │
  ├─────────────────────────────────────────────┤
  │ One-leader-per-term (election safety)       │
  ├─────────────────────────────────────────────┤
  │ Raft + ghost variables                      │  RaftRefinementInterface.v
  ├─────────────────────────────────────────────┤
  │ Raft implementation (Raft.v)                │
  ├─────────────────────────────────────────────┤
  │ Extracted OCaml + trusted runtime shim      │
  └─────────────────────────────────────────────┘
```

Interfaces hide proof details so strengthening one invariant does not cascade through the development — the "planning for change" discipline [2].

---

## 4 Deep Dive

### 4.1 Ghost variables: making the unobservable provable

"At most one leader per term" is a *global* property, and some facts needed mid-proof — e.g., which nodes a candidate has heard from — exist nowhere in the implementation's state. Verdi's answer is the **ghost-variable transformer** [5]: auxiliary state threaded through the system mechanically, never influencing outputs, so observable behavior is unchanged by construction. For Raft it tracks votes received per candidate (`VotesCorrect`), per-term supporter sets (`CroniesCorrect`), and self-votes (`CandidatesVoteForSelves`), each as its own proof interface [5]. Global safety then decomposes into local invariant conjuncts over ghost state. It is Lamport-style auxiliary-variable reasoning, but added *after* the fact by a verified program transformation rather than by hand-editing code.

### 4.2 Crash-recovery network semantics

Raft's correctness hinges on a persistence discipline: term, voted-for, and log must be durable *before* a node acts on them; volatile state (commit index) may be rebuilt after reboot. Verdi's **crash-recovery semantics** [6] adds two rules:

```coq
| step_crash  : ∀ net h, ¬ failed net h → step net (mark_failed net h)
| step_reboot : ∀ net h, failed net h  → step net (reboot_node net h)
```

where `reboot_node` wipes volatile state but preserves persistent state. Every invariant must survive the `step_reboot` case — the case a human prover is most tempted to wave through, and the machine accepts no waving. Doenges et al. later generalized Verdi's semantics to **dynamic networks under churn**, replacing the fixed node map with a partial map over a tracked membership set `N` plus overlay-neighborhood detection [6]; the Raft proof itself targets static membership with crash-recovery, matching Raft's single-cluster model.

### 4.3 Election safety: one leader per term

`OneLeaderPerTermInterface.v` states election safety; its proof depends on three auxiliary interfaces [5]:

1. **CandidatesVoteForSelves** — every candidate holds its own vote.
2. **VotesCorrect** — ghost vote-tracking reflects votes actually cast (no double counting, no phantoms).
3. **CroniesCorrect** — supporter sets are consistent with delivered messages.

The core is a mechanized quorum-intersection argument: two majorities intersect; persistent `votedFor` permits one vote per term; two leaders in one term would demand a double vote — contradiction. Each informal "clearly" of the hand proof becomes a stated, proved interface. That promotion is the signature move of the whole development.

### 4.4 Log matching and state-machine safety

**Log Matching** (`LogMatchingInterface.v`): equal index and term in two logs implies identical prefixes. It decomposes into `LeaderSublog` (leaders' logs contain all committed entries), `Sorted` (index well-formedness), and `UniqueIndices` [5]. From log matching plus election safety follows **leader completeness**, and then **state-machine safety**: no two servers ever apply different commands at the same index [2]. The refinement stack connects this to **linearizable state-machine replication** — the client-observable end-to-end theorem — with the `vard` key-value store inheriting linearizability through the Raft layer [2][5].

### 4.5 Extraction: from proof to running code

Coq extraction compiles the Gallina handlers to OCaml, linked against the `verdi-runtime` shim (UDP sockets, timers, disk persistence) [5]. The `vard` store is built this way (`make vard`) and deployable on a real cluster. The trust story is explicit: Coq's kernel and extraction, the OCaml toolchain, the shim's fidelity to the semantics (e.g., data reaching disk before acknowledgment), and the semantics' match to the real network are trusted. The Raft logic itself is not — it is proved. A smaller, shared-infrastructure TCB than "we tested it heavily."

---

## 5 Empirical Results and Proofs

### 5.1 What was proved

- **First mechanized proof of state-machine safety for Raft**, via machine-checked interfaces for election safety, log matching, leader completeness, and supporting ghost invariants.
- **~90 system invariants**, iteratively discovered — the number itself evidencing the claim that large protocol proofs are dominated by invariant *discovery and maintenance*.
- **End-to-end linearizability** for `vard` running extracted Raft on real networks.
- **A reusable methodology** — planning for change — in four techniques [2].

### 5.2 Planning for change

In a 90-invariant development, proving invariant *n+1* routinely forces strengthening invariants *1..n*. Woos et al.'s four defenses [2]:

1. **Information hiding.** Properties are Coq module types; proofs are functors over them. Strengthening changes a proof body, never the interface clients depend on.
2. **Custom induction principles.** The recurring "strengthen the induction hypothesis with these facts" pattern is factored into a bespoke principle, proved once.
3. **Higher-order lemmas.** "Any property of component *A* implies the analogous property of *B*" transports results across ghost and transformer layers without duplication.
4. **Structural tactics.** Ltac automation targets goal *shape* (induction over `step`, handler case analysis) rather than lemma names, surviving reorganization.

These read as hard-won software engineering advice for proof engineers — the 2016 analogue of "write modular code" — and are presented as broadly applicable to systems verification [2].

### 5.3 The artifact

`verdi-raft` [5] is a genuine artifact, not a paper prototype: it builds with released Coq (8.14+ in the maintained fork, via opam and Docker CI), checks every proof with `make`, and extracts a runnable store. Dependencies — Verdi, StructTact, Cheerios for serialization — are shared, versioned infrastructure. Its continued maintenance is evidence the methodology survived Coq's version treadmill.

---

## 6 Limitations

**Liveness is absent.** Every theorem is a *safety* property. Nothing is proved about progress — eventual leader election, eventual commit, freedom from election livelock. This follows from the framework: unlabeled transition systems suit safety-by-induction; liveness needs fairness and temporal reasoning the framework lacks (later `LabeledNet.v` opens that door [4]). A verified-safe Raft that never elects a leader satisfies every theorem in `raft-proofs/`.

**The trusted computing base is real.** Extraction, the OCaml toolchain, the shim, and the semantics' fidelity to deployment are all trusted. A shim bug — acknowledging a write before `fsync` — voids the crash-recovery guarantee with every Coq proof still green.

**Fault-model fidelity is bounded.** Crashes are atomic transitions with cleanly split persistent/volatile state. Torn writes, bit rot, Byzantine faults, and correlated failures are outside the model; the churn extension [6] widens the family but not to adversarial faults.

**Proof cost remains high.** Ninety invariants for one protocol, even with planning-for-change discipline, is formidable — justifiable for consensus, the narrow waist of infrastructure, but not yet routine engineering. And the method verifies safety *as written*; it does not produce fast or readable code.

**Transformers compose, but not freely.** Each transformer carries its own obligations and assumptions; stacking them multiplies refinement layers to keep consistent. The Raft development leans heavily on the ghost transformer but less on the full VST stack than the framework's vision suggests — a hint of practical friction in transformer composition.

---

## 7 Conclusion

Verdi's Raft verification is a landmark at three levels. **Technically**, it delivered the first machine-checked proof of state-machine safety for a real, executable consensus implementation, with a refinement chain reaching linearizable replication [1][2][5]. **Methodologically**, it showed that large protocol proofs are dominated by invariant discovery and maintenance, and supplied a concrete discipline — proof interfaces, custom induction principles, transport lemmas, structural tactics — for managing that cost [2]. **Architecturally**, it validated separating application logic, fault models, and fault-tolerance mechanisms into implementations, inductive semantics, and verified system transformers [1][6].

Open problems are clear: *liveness* under fairness remains the great unfinished business of the Verdi line; order-of-magnitude proof-cost reduction — via automation or verified synthesis — is the precondition for adoption beyond narrow-waist protocols; and hardening the extraction boundary (verified shims, crash-safe persistence with checked `fsync` discipline) is where the next real bugs hide.

What endures is the central lesson: *make the fault model explicit, make it a mathematical object, and prove the system against it — not against your intuition about it.* Raft was designed to be understandable; Verdi made it checkable. The ninety invariants are the receipt.

## References

[1] James R. Wilcox, Doug Woos, Pavel Panchekha, Zachary Tatlock, Xi Wang, Michael D. Ernst, and Thomas Anderson. "Verdi: A Framework for Implementing and Formally Verifying Distributed Systems." In *Proceedings of the 36th ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI 2015)*, Portland, OR, USA, June 2015, pp. 357–368. DOI: 10.1145/2737924.2737958. https://homes.cs.washington.edu/~mernst/pubs/verify-distsystem-pldi2015.pdf

[2] Doug Woos, James R. Wilcox, Steve Anton, Zachary Tatlock, Michael D. Ernst, and Thomas Anderson. "Planning for Change in a Formal Verification of the Raft Consensus Protocol." In *Proceedings of the 5th ACM SIGPLAN Conference on Certified Programs and Proofs (CPP 2016)*, St. Petersburg, FL, USA, January 2016, pp. 154–165. DOI: 10.1145/2854065.2854081. https://homes.cs.washington.edu/~mernst/pubs/raft-proof-cpp2016.pdf

[3] Diego Ongaro and John Ousterhout. "In Search of an Understandable Consensus Algorithm (Extended Version)." In *Proceedings of the 2014 USENIX Annual Technical Conference (USENIX ATC 2014)*, Philadelphia, PA, USA, June 2014. http://www.cs.cmu.edu/afs/.cs.cmu.edu/academic/class/15811-s17/www/papers/raft.pdf

[4] The Verdi Framework. "A framework for formally verifying distributed systems implementations in Coq." UW PLSE. https://github.com/uwplse/verdi/blob/HEAD/README.md

[5] Verdi Raft. "An implementation of the Raft distributed consensus protocol, verified in Coq using the Verdi framework." UW PLSE. https://github.com/uwplse/verdi-raft/blob/HEAD/README.md

[6] Ryan Doenges, James R. Wilcox, Doug Woos, Zachary Tatlock, and others. "Verification of Implementations of Distributed Systems Under Churn." *CoqPL 2017: The Third International Workshop on Coq for Programming Languages*. http://jamesrwilcox.com/churn-coqpl17.pdf

[7] 15-811 Distributed Systems, Carnegie Mellon University. "Lecture: Distributed Systems: Verdi." April 17, 2017. http://www.cs.cmu.edu/~15811/lectures/verdi.html

