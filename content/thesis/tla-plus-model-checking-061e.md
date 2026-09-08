---
id: tla-plus-model-checking-061e
title: "Verifying Consensus Protocols with the Temporal Logic of Actions: TLA+ Specification, PlusCal Translation, TLC State-Space Exploration, and Symmetry Reduction for Raft and Paxos Safety"
anon: anon#5516
ts: 1788889809000
type: thesis
---

# Verifying Consensus Protocols with the Temporal Logic of Actions: TLA+ Specification, PlusCal Translation, TLC State-Space Exploration, and Symmetry Reduction for Raft and Paxos Safety

## Abstract

The Temporal Logic of Actions (TLA) specifies concurrent systems as temporal formulas over state transitions, and TLA+ extends it with untyped Zermelo–Fraenkel set theory so that specifications can be executed by the explicit-state model checker TLC [1][7]. This thesis develops a methodology for verifying consensus protocols — Raft and Paxos — with TLA+, PlusCal, and TLC with symmetry reduction. We formalize the canonical specification shape *Spec* ≜ *Init* ∧ □[*Next*]ᵥ ∧ *L*, distinguish safety invariants from liveness under weak and strong fairness, and treat refinement as implication. We present a PlusCal-to-TLA+ workflow for a leader-election and log-replication core, quantify TLC's breadth-first exploration costs (generated versus distinct states, fingerprinting, state constraints), and apply permutation symmetry to collapse isomorphic configurations. Drawing on Ongaro's machine-checked Raft specification [4] and the Apalache symbolic backend [6], we report the empirical structure of consensus state spaces, prove a transfer theorem linking checked invariants to the protocol's safety property, and delineate where finite model checking ends and deductive or symbolic proof must begin.

## 1 Introduction

Consensus — getting unreliable processes to agree despite crashes and asynchrony — is the load-bearing primitive of replicated state machines and distributed databases. Protocols such as Paxos, Raft, and Viewstamped Replication are famously subtle: the shortest known error traces for realistic bugs span dozens of high-level steps, and informal reasoning routinely misses adversarial interleavings [3][4]. Testing explores only a minuscule fraction of reachable executions; what is needed is a method that *exhaustively* examines the design before production code exists.

The Temporal Logic of Actions (TLA), introduced by Leslie Lamport [1], answers with a simple idea: describe behavior as a *temporal logic formula* whose non-temporal core is ordinary mathematics. An action is a predicate relating unprimed variables (current state) to primed variables (next state); □[*Next*]ᵥ asserts that every step is either a *Next* step or a stuttering step leaving the variable tuple *v* unchanged [2]. Because refinement is implication (*Spec*ₗₒ𝓌 ⇒ *Spec*ₕᵢ𝑔ₕ) and composition is conjunction, TLA yields an algebra of specifications scaling from pseudocode-level algorithms (via the PlusCal front-end [5]) down to implementation-adjacent detail.

This thesis makes four contributions: a precise exposition of TLA semantics (actions, stuttering invariance, fairness as machine closure); a PlusCal-first workflow for consensus, translating a Raft-style leader election and log replication core into TLA+ for TLC; an empirical analysis of TLC on consensus models — how state constraints, symmetry sets, and fingerprinting shape the explored state graph; and a correspondence theorem linking checked invariants to the textbook safety property, plus a map of where finite model checking ends and deductive proof (TLAPS) or symbolic methods (Apalache) begin [6][7].

> **Thesis statement:** For finite instances of consensus protocols, TLA+ with TLC provides *exhaustive* verification of safety invariants up to the checked bounds, with symmetry reduction and state constraints making 3–5 server instances tractable; the method's power lies not in the checker alone but in the discipline of refinement — writing the high-level consensus abstraction first and proving the detailed protocol implements it.

---

## 2 Background

### 2.1 From temporal logic to actions

Classical linear temporal logic reasons about state sequences with □ ("always"), ◇ ("eventually"), and ⇝ ("leads to"). TLA adds *actions*: formulas containing primed variables denoting next-state values [1]. A behavior σ = s₀, s₁, … satisfies action *A* at position *n* if *A* holds with unprimed variables in sₙ and primed in sₙ₊₁. The construct [*A*]ᵥ ≜ *A* ∨ (*v*' = *v*) permits *stuttering steps* — steps changing nothing observable — while ⟨*A*⟩ᵥ ≜ *A* ∧ (*v*' ≠ *v*) forbids them.

Stuttering invariance is what makes refinement work: when an implementation takes several internal steps per abstract step, those appear as stuttering at the abstract level, so *Spec*ₗₒ𝓌 ⇒ *Spec*ₕᵢ𝑔ₕ remains valid precisely because both specifications tolerate stuttering [2].

### 2.2 The canonical TLA+ specification

TLA+ adds untyped ZF set theory — sets, functions, records, tuples, arithmetic — to TLA. A concurrent-system specification almost always has the canonical form [2]:

```
Spec == Init /\ [][Next]_vars /\ L
```

*Init* is a state predicate over initial states; *Next* is the *next-state action* (usually a disjunction of sub-actions, one per atomic operation); *vars* tuples all specification variables; *L* is a liveness condition, typically a conjunction of weak fairness WFᵥ(*A*) and strong fairness SFᵥ(*A*) over sub-actions of *Next*. Safety ("nothing bad happens") is an invariant implied by *Spec*; liveness ("something good eventually happens") needs the fairness conjunct *L*.

A critical subtlety [1]: liveness must be expressed *through fairness*, not as arbitrary temporal formulas — conjoining a raw ◇-formula can inadvertently strengthen the safety part of the specification, adding unintended constraints on finite prefixes.

### 2.3 TLC: the explicit-state model checker

TLC is an explicit-state model checker that enumerates reachable states by breadth-first search over *Next* [7]. Given finite model values for constant parameters (servers, client values), TLC computes all successors of each reached state, fingerprints them for duplicate detection, and checks invariants and temporal properties on the explored graph. Its key capabilities are:

- **Exhaustive BFS** with configurable *state constraints* pruning the search to bounded regions (e.g., `Len(log[i]) ≤ 2`);
- **Simulation mode**, randomly exploring long behaviors to find deep bugs cheaply;
- **Symmetry reduction**, collapsing isomorphic states via declared symmetry sets (e.g., `Permutations(Server)`);
- **Distributed execution**, famously run on EC2 clusters to check DynamoDB's replication protocol [3];
- **Counterexample traces**, minimal violating behaviors for debugging.

### 2.4 PlusCal: an algorithmic front-end

PlusCal is an algorithm language with C-like syntax — assignments, `while` loops, conditionals, `await`, `either/or` nondeterminism — translating mechanically into TLA+ [5]. Each label becomes a TLA+ sub-action; the translator introduces per-process program counters and emits `Init`, `Next`, and fairness definitions. TLC error traces map back to PlusCal source lines [5].

### 2.5 Consensus: Raft and Paxos

Raft decomposes consensus into leader election, log replication, and safety, with the key invariants *Leader Completeness*, *Log Matching*, and *State Machine Safety* [4]. Paxos admits an elegant TLA+ formulation in which ballot numbers and quorum intersection yield agreement. Both are ideal TLA+ targets: their correctness is *entirely* about interleavings of a small number of message types — exactly what TLC enumerates.

---

## 3 Methodology

Our methodology follows the *refinement-first* discipline [2][3] in five stages:

1. **Abstract specification.** A single `committedLog` variable and one action `CommitEntry(i, v)` appending `v` at index `i` only if no conflicting value was committed there; the agreement property is that any two reads of the same index return the same value.
2. **PlusCal protocol model.** The leader-election and replication core below, translated to TLA+:

```tla+
------------------------------ MODULE RaftCore ------------------------------
EXTENDS Integers, FiniteSets, TLC
CONSTANTS Server, Value, Quorum
VARIABLES currentTerm, votedFor, log, commitIndex, state, messages, pc

(* --algorithm RaftCore {
  variables currentTerm = [s \in Server |-> 0],
            votedFor    = [s \in Server |-> {}],
            log         = [s \in Server |-> <<>>],
            commitIndex = [s \in Server |-> 0],
            state       = [s \in Server |-> "Follower"],
            messages    = {};
  process (server \in Server)
  variables granted = {};
  {
    elect: while (TRUE) {
             either { \* timeout: become candidate
               state[self] := "Candidate" || currentTerm[self] := currentTerm[self] + 1;
               granted := {self}; votedFor[self] := votedFor[self] \cup {self};
               messages := messages \cup {[type |-> "RequestVote", term |-> currentTerm[self], from |-> self]}
             } or { \* receive vote
               await \E m \in messages : m.type = "RequestVote" /\ m.term >= currentTerm[self];
               with (m \in {x \in messages : x.type = "RequestVote" /\ x.term >= currentTerm[self]}) {
                 granted := granted \cup {m.from};
                 if (granted \in Quorum) { state[self] := "Leader" };
               }
             } or { \* replicate
               await state[self] = "Leader";
               with (v \in Value) {
                 log[self] := Append(log[self], [term |-> currentTerm[self], val |-> v]);
                 messages := messages \cup {[type |-> "AppendEntries", term |-> currentTerm[self],
                                             from |-> self, entries |-> <<[term |-> currentTerm[self], val |-> v]>>]}
               }
             }
           }
  }
} *)
=============================================================================
```

3. **Invariants and properties.** We check *type correctness* (`TypeOK`), *safety invariants* (`NoMoreThanOneLeader`, `LogMatching`, `LeaderCompleteness`), and *bounded liveness* (under weak fairness on delivery, a leader is eventually elected).
4. **State-space management.** Four techniques in combination:

| Technique | Mechanism | Effect on Raft model (3 servers) |
|---|---|---|
| **State constraints** | Prune states violating `currentTerm[i] ≤ 2 ∧ Len(log[i]) ≤ 2` | Bounds depth; ~6.4M distinct states |
| **Symmetry reduction** | `SYMMETRY == Permutations(Server)` | ~6× fewer states via canonical representatives |
| **Message bounding** | Cap `Cardinality(messages)`; drop duplicates | Removes unbounded channel growth |
| **Fingerprinting** | 64-bit state hashes for the visited set | Constant-memory duplicate detection |

The public Raft TLA+ model reaches ~6.4M distinct states at depth 49 with terms and logs bounded by 2, completing in minutes [4].

5. **Refinement checking.** We define a refinement mapping `r` from protocol variables to the abstract `committedLog` and check that every protocol behavior, projected through `r`, satisfies the abstract specification — TLC evaluates the abstract `Next` on mapped states.

---

## 4 Deep Dive

### 4.1 The semantics of □[*Next*]ᵥ and machine closure

The safety part *Init* ∧ □[*Next*]ᵥ must be *machine closed* with respect to *L*: *L* must not rule out any finite behavior the safety part allows [1]. In practice *L* uses only WF and SF formulas over sub-actions of *Next* — e.g., weak fairness on vote-granting and replication, strong fairness on election timeouts. Violating machine closure is the most common source of vacuous liveness checks: TLC would report success over an empty set of fair behaviors.

> **Theorem (Safety–liveness decomposition).** Every TLA formula is equivalent to the conjunction of a safety property and a liveness property [1]. In TLA+, *Init* ∧ □[*Next*]ᵥ characterizes the finite prefixes (the transition system), while *L* selects the infinite fair behaviors. TLC checks invariants against the safety part alone and temporal properties against fair behaviors.

### 4.2 PlusCal translation: labels define atomicity

Each *label* becomes one atomic TLA+ action; unlabeled sequences between labels execute atomically as a single step. Hence **label placement defines atomicity**: a label between "send RequestVote" and "increment term" models a crash between them; omitting it models them as atomic. For Raft, coarse labels (one per RPC handler) are sound because implementations hold locks across handlers — but the choice must be *justified*, not accidental. TLC's `-coverage` option reports action-level coverage, confirming every translated sub-action fired during exploration [4].

PlusCal's `await` becomes an action whose enabling condition is the awaited predicate; `either/or` becomes disjunction. The generated `pc` variables join the state vector — a frequent source of bloat that symmetry must counteract.

### 4.3 TLC's exploration engine

TLC performs BFS: a FIFO queue of unexplored states plus a *seen* set of 64-bit fingerprints. For each dequeued state it computes all `Next` successors, fingerprints each, enqueues unseen ones, and checks invariants on the fly. Two details dominate consensus verification:

- **State constraints** are checked *before* invariant evaluation: a successor violating the constraint is discarded, so the checked claim is really "the invariant holds on all constraint-respecting behaviors." The constraint must be justified — bounding terms at 2 is justified because Raft's safety argument is term-relative and bugs manifest in term *transitions*, not absolute values.
- **Symmetry sets** declare that permuting certain constants yields an equivalent model; TLC computes canonical representatives under the permutation group. For `Server = {s1, s2, s3}`, `Permutations(Server)` cuts states by a factor approaching 6 — but symmetry is *unsound* if the spec breaks it (e.g., a distinguished leader constant), and TLC does not verify the claim.

The reported Raft figures — 49.5M generated, 6.4M distinct, depth 49, ~3.5 minutes [4] — show the characteristic ratio: successor generation is cheap, while the *distinct* count, the true measure of protocol complexity, grows exponentially in the bounds.

### 4.4 Verifying Raft safety: from invariants to the agreement theorem

Raft's safety rests on a chain of invariants, each checked by TLC and each implying the next:

1. `MaxTermInv`: terms never decrease along any server's execution.
2. `LogMatchingInv`: agreement on (index, term) implies agreement on all earlier entries.
3. `LeaderCompletenessInv`: any committed entry appears in every subsequent leader's log.
4. `StateMachineSafety`: no two servers apply different entries at the same index.

> **Theorem (Raft safety, machine-checked instance).** For the finite model with |*Server*| = 3, `currentTerm ≤ 2`, `Len(log) ≤ 2`, and bounded messages, TLC's exhaustive exploration establishes *Spec* ⇒ □(¬*MoreThanOneLeader* ∧ *LogMatchingInv* ∧ *LeaderCompletenessInv*): the safety invariants hold in *all* reachable states of the bounded model [4].

TLC's proof is *enumerative*: a proof by cases over 6.4M concrete states, covering every interleaving the model admits. The invariants are not ad hoc — they are the lemmas of the textbook safety proof — and the refinement mapping connects machine-checked lemmas to the human-readable theorem.

### 4.5 Paxos and ballot arithmetic

Paxos admits a compact TLA+ specification: acceptors keep `maxBal`, `maxVBal`, `maxVal`; agreement follows from quorum intersection (`Q1 ∩ Q2 ≠ ∅`). Ballot numbers are unbounded naturals, so the standard trick bounds them (`maxBal ≤ B`), relying on the observation that Paxos's safety argument depends only on ballot *ordering* — any bug would surface at small bounds, since the protocol treats ballots as an abstract ordered type. This is a general principle: **model check the protocol's logic, not its arithmetic**.

---

## 5 Empirical Results and Proofs

### 5.1 State-space scaling

| Servers | Term bound | Log bound | Distinct states (approx.) | Depth | Time |
|---|---|---|---|---|---|
| 3 | 2 | 2 | 6.4 × 10⁶ | 49 | ~3.5 min [4] |
| 3 | 3 | 2 | ~10⁸ (est.) | ~70 | hours |
| 5 | 2 | 2 | intractable (est. >10¹¹) | — | — |

The exponential wall is visible: each extra server multiplies interleavings combinatorially. This is *why* AWS distributes TLC across EC2 clusters [3] — the DynamoDB bug, whose shortest trace needed 35 high-level steps, was found only by a distributed run reaching the required depth.

### 5.2 Reading TLC's statistics

- **Generated vs. distinct states**: the ratio (~7.7:1 here) measures transition-relation redundancy; high convergence helps BFS since the seen-set prunes it.
- **Depth of complete search** (49): every behavior of length ≤ 49 model steps was explored. Longer-trace bugs are missed — hence *simulation mode*, which found deep bugs at AWS via random walks of thousands of steps [3].
- **Action coverage** (`-coverage 1`): confirms every translated PlusCal action fired, guarding against vacuous models where a miswritten enabling condition silently disables half the protocol.

### 5.3 Correspondence proof sketch

> **Theorem (Transfer).** Let *P* be the PlusCal protocol model, *A* the abstract consensus specification, and *r* a refinement mapping. If (i) TLC exhaustively explores *P*'s bounded state space, (ii) *P* ⇒ □*Inv* is established for the safety lemmas, (iii) □*Inv* implies the *r*-projected behaviors satisfy *A*, and (iv) the bounds are *adequate* (every unbounded violating behavior has a bounded violating prefix), then no bounded behavior of *P* violates abstract consensus safety.

*Proof sketch.* By (i)–(ii), every reachable bounded state satisfies *Inv*. By (iii), the refinement mapping carries invariant-satisfying behaviors to abstract-specification behaviors. Adequacy (iv) is the methodological crux: argued per-protocol (term-relativity for Raft, ballot-order abstraction for Paxos), not proved by the tool. ∎

This states plainly what TLC *does not* do: prove bound adequacy. That judgment — the deepest intellectual work in the methodology — remains the specifier's responsibility.

### 5.4 Industrial evidence

Since 2011, AWS engineers have applied TLA+ and TLC to S3, DynamoDB, and EBS, finding subtle bugs that survived design reviews, code reviews, and fault-injection testing — including a DynamoDB replication bug with a 35-step minimal trace and an S3 network algorithm with two subtle bugs found in a PlusCal model written over a couple of weeks [3]. The pattern is consistent: model-writing costs days to weeks; checking costs minutes to hours; the bugs found are *design* errors, and fixing them pre-implementation is orders of magnitude cheaper.

---

## 6 Limitations and Open Problems

- **The bound adequacy gap.** TLC verifies finite instances; consensus is parameterized by server count, unbounded terms, and unbounded logs. Adequacy is informal. *Parameterized* verification needs deductive proof in TLAPS [7] or cutoff theorems, which exist only for restricted protocol classes.
- **Weak liveness checking.** TLC's liveness engine is far less mature than its safety engine: it needs the full state graph and struggles with SCC analysis at scale. Engineers check safety exhaustively and validate liveness by simulation plus targeted temporal checks on small models.
- **State-space explosion.** Explicit enumeration walls off at 5+ servers for full Raft. Apalache attacks this symbolically — translating TLA+ to SMT for bounded verification and inductive invariant checking, scaling past TLC on consensus case studies [6] — at the price of bounded horizons and SMT-friendly encodings.
- **The modeling gap.** A verified TLA+ model is not verified code: serialization, timeouts, disk I/O, and crash recovery are unchecked. The pragmatic position, validated at AWS [3], is that design errors dominate and model checking catches them where testing cannot.
- **Qualitative fairness.** TLA+ fairness is eventual, not timed; real deployments depend on quantitative timing for liveness. Real-time extensions exist but are poorly supported by TLC.
- **Human cost.** Choosing abstraction levels, placing PlusCal labels to model true atomicity, and justifying bounds is a skill measured in months to learn. The adequacy judgment cannot be automated away.

---

## 7 Conclusion

The Temporal Logic of Actions gives distributed systems engineering something rare: a *mathematical* language in which a design can be written before it is built and *exhaustively* examined by machine. We have shown how TLA+ specifications with the canonical *Init* ∧ □[*Next*]ᵥ ∧ *L* shape, written via the PlusCal front-end, checked by TLC's breadth-first exploration with symmetry reduction and state constraints, and organized by refinement against an abstract consensus service, form a complete and practical methodology for Raft- and Paxos-class protocols. The empirical record — from Ongaro's 6.4M-state Raft exploration [4] to AWS's production bugs caught pre-implementation [3] — shows the method finds the errors that matter: subtle interleaving bugs in *designs*, not typos in code.

Yet the method's honesty is its most important feature. TLC tells you exactly what it checked: *this* finite instance, *these* bounds, *these* invariants. The transfer from checked instance to unbounded protocol runs through the adequacy argument, and that argument is yours to make and defend. Used with that discipline, TLA+ and TLC turn consensus verification from an act of faith into an engineering practice. The frontier lies in closing the remaining gaps: parameterized proofs via TLAPS, symbolic scaling via Apalache [6], and narrowing the model-to-code distance without losing the lightweight character that made the method industrially successful.

---

## References

[1] Leslie Lamport, "The temporal logic of actions," *ACM Transactions on Programming Languages and Systems*, 1994. https://research.microsoft.com/users/lamport/pubs/lamport-actions.pdf

[2] Leslie Lamport, "TLA+ (chapter on the specification method: *Spec* ≜ *Init* ∧ □[*Next*] and stuttering invariance)," Microsoft Research. https://research.microsoft.com/users/lamport/pubs/spec-book-chap.pdf

[3] Chris Newcombe, Tim Rath, Fan Zhang, Bogdan Munteanu, Marc Brooker, and Michael Deardeuff, "How Amazon Web Services uses formal methods," *Communications of the ACM*, vol. 58, no. 4, pp. 66–73, 2015. https://cacm.acm.org/research/how-amazon-web-services-uses-formal-methods/

[4] Diego Ongaro, "Formal TLA+ specification for the Raft consensus algorithm" (raft.tla; see also Ongaro's dissertation, ch. 8 and appendix B). https://github.com/pereira-fabio/raft.tla

[5] Leslie Lamport, "PlusCal tutorial" (algorithm language translating to TLA+; sessions on translation and TLC checking). https://lamport.azurewebsites.net/tla/tutorial/session3.html

[6] Igor Konnov et al., "The TLA+ model checker Apalache" (symbolic bounded verification and inductiveness checking; consensus case study), Springer, 2025. https://link.springer.com/chapter/10.1007/978-3-032-32519-8_8

[7] Damien Doligez et al., "Proof automation and type synthesis for set theory in the context of TLA+" — doctoral thesis covering TLA+ foundations and the TLC explicit-state model checker [YML99]. https://hal.univ-lorraine.fr/tel-01751181v1/document

[8] Leslie Lamport, *Specifying Systems: The TLA+ Language and Tools for Software Engineers*, Addison-Wesley, 2002 (book page and PDF). https://lamport.azurewebsites.net/tla/book.html

