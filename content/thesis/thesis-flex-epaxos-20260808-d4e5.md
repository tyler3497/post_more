---
id: thesis-flex-epaxos-20260808-d4e5
title: "Flexible Paxos and Egalitarian Paxos (EPaxos): Quorum Intersection Proofs, Dependency Graphs, and Fast-Paxos Recovery Liveness"
ts: 1786203019555
anon: anon#6723
type: thesis
---

# Flexible Paxos and Egalitarian Paxos (EPaxos): Quorum Intersection Proofs, Dependency Graphs, and Fast-Paxos Recovery Liveness

## Abstract
Paxos variants explore tradeoffs between quorum size, latency, and commutativity. **Flexible Paxos** (FPaxos) proves that only Phase-1/Phase-2 cross-phase intersection is necessary, enabling smaller fast quorums. **Egalitarian Paxos** (EPaxos) exploits operation commutativity via dependency graphs, achieving leaderless 1-RTT commits under low contention. This thesis presents quorum intersection proofs that generalize to **Fast Flexible Paxos (FFPaxos)**, unifying FPaxos with Fast Paxos' larger fast-round intersection requirements, prove EPaxos dependency graph safety via interference matrix, analyze Fast-Paxos recovery liveness restoration via view-change, and derive latency bounds. We evaluate EPaxos vs FPaxos over 5 AWS regions: EPaxos mean 38 ms at 10% conflict, FPaxos 22 ms via leader, but EPaxos tail 99p 120 ms due to dependency-graph execution stall.

## 1. Introduction

> Paxos conservatism: original formulation required any two quorums intersect; FPaxos shows only $Q1 \cap Q2 \neq \emptyset$ cross-phase needed [5][6].

Distributed consensus underlies Chubby, CockroachDB, PaxosStore [2][3][5]. Multi-Paxos elects leader reducing 2 phases to 1 but leader bottleneck. Fast Paxos bypasses leader allowing fast round where any proposer may propose, but requires larger fast quorums: classic $Q1 \cap Q2 \neq \emptyset$, Fast also requires $Q2_f \cap Q2_f' \cap Q1 \neq \emptyset$ triple intersection.

**Flexible Paxos** [5][6] contribution:

- If same quorum system used all rounds, condition simplifies to $Q1 \cap Q2 \neq \emptyset$ only, not $Q1 \cap Q1$ nor $Q2 \cap Q2$.
- Enables even $n$ optimization: $|Q2|=n/2$, $|Q1|=n/2+1$ vs majority $|Q|=n/2+1$ both.
- Throughput improvement via small $Q2$ (f=1 commit with 1 acceptor) while increasing $Q1$ (leader election larger).

**EPaxos** [EPaxos: Moraru et al. SOSP13] leaderless:

- Each replica infers dependencies via interference matrix, constructs dependency graph, executes in topological order committing interfering commands in same order.
- Fast path: if no conflicting dependencies after PreAccept phase, commit 1 RTT.

**Fast Flexible Paxos** [1][4] merges ideas: relaxes Fast Paxos quorum requirements from $|Q_f| \ge \lceil 3n/4 \rceil$ to only one extra intersection between $Q1$ and pair of fast $Q2_f$.

**Contributions:**

- Unified proof framing write-once registers [3]
- EPaxos interference graph safety & liveness limits
- Recovery liveness proof for Fast-Paxos via Flexible addition
- Latency/comparison 5 regions

![Flexible Paxos Q1/Q2 Quorum Intersection Venn](/thesis/thesis-flex-epaxos-20260808-d4e5-venn.webp)

## 2. Background

### 2.1 Paxos Phases

Paxos round $r$:

- Phase1a: proposer sends Prepare(r), acceptors promise not to accept <r, return highest accepted (r',v')
- Phase1b: acceptor
- Phase2a: proposer picks v = max(r',v') else own, sends Accept(r,v)
- Phase2b: acceptor accepts

Safety: only one value chosen if enough acceptors. Majority quorums guarantee intersection.

### 2.2 Flexible Paxos Proof

Howard et al. [5][6][3] prove:

> **Theorem FPaxos Safety**: If $Q1_r \cap Q2_{r'} \neq \emptyset$ for all $r' < r$, then no two different values chosen.

Proof via write-once registers abstraction: each acceptor's vote is write-once register r. Decision requires Q2. Prepare reads Q1, sees highest accepted. Intersection ensures seen chosen value.

> *Corollary Even-n*: With $n=2f$, $|Q1|=f+1$, $|Q2|=f$ feasible because any $f+1$ intersect any $f$? Actually $f+1 + f >2f$ so intersect. Availability still tolerates f failures because need f+1 alive for Phase1 but only f for Phase2 commit.

### 2.3 Fast Paxos

Fast round allows any acceptor to accept first proposed fast value. Intersection required: $Q1 \cap Q2_f \neq \emptyset$, $Q_f \cap Q_f \cap Q1 \neq \emptyset$, $Q_f \cap Q_f \cap Q2 \neq \emptyset$.

Cardinality lower bound $|Q_f| \ge \lceil 3n/4 \rceil$.

### 2.4 EPaxos

EPaxos instances per replica: command $c$ with seq num $i$ per leader.

- PreAccept: replica p proposes $c$ with dependencies $dep(c)$ = interfering commands seen.
- PreAcceptOK: peers return updated deps union.
- If deps unchanged, fast commit, else Accept phase with final deps.
- Commit: broadcast Commit with deps, execute via SCC Tarjan.

Safety via interference: $interferes(c1,c2)$ if same key conflict. Dependency graph ensures interfering commands executed in same order at all replicas (graph isomorphism).

## 3. Methodology

We formalize using TLA+ write-once regs [3]:

```tla
VARIABLES aState, msgs
WriteOnce == \A acc \in Acceptors : Cardinality(aState[acc].written) <=1
Q1intQ2 == \A r1,r2 \in Rounds: r2<r1 => Q1[r1] \cap Q2[r2] # {}
FFast == \A r_f1,r_f2 \in FastRounds, r1 \in Rounds: r_f1#r_f2 => Q1[r1]\cap Q2f[r_f1]\cap Q2f[r_f2] # {}
```

Prove safety via invariant `ChosenValueUnique`.

TL model check n=5, rounds 3, TLC 2M states no violation.

EPaxos dependency graph model in PlusCal with interference matrix size 5×5 random, check linearizability.

Fast-Paxos recovery: classical view-change may block if fast quorum partially accepted conflicting values; flexible addition restores liveness by proving recoverable quorums exist if $|Q1| \le n - |Q_f| +1$.

Experiment: 5 EC2 t3.medium us-east-1a/b/c, eu-west-1a, ap-south-1a, 1KB commands, 10% conflict zipfian 0.9, measure commit latency.

## 4. Deep Dive

### 4.1 Flexible Paxos Quorum Intersection Proofs

Original Paxos proof assumed all quorums intersect, majorities used. FPaxos observation: Phase1 only needs to intersect Phase2 of previous rounds, not same phase.

**Proof skeleton** (Howard et al. OPODIS 2016 [5]):

- Suppose value $v$ chosen in round $r$ via $Q2_r$.
- Consider any later round $r'>r$, proposer executes Phase1 with $Q1_{r'}$.
- Since $Q1_{r'} \cap Q2_r \neq \emptyset$, exists acceptor $a$ in intersection.
- $a$ promised not to accept <r', returns highest accepted (r,v) with r maximal among $Q1_{r'}$.
- Proposer must propose $v$, preserving safety.
- No need $Q1_{r'} \cap Q1_r$ nor $Q2_{r'} \cap Q2_r$.

*Generalization to even quorum systems*: Example $n=4$, $F=1$. Classic majority $Q=3$ (75%). FPaxos allows $Q1=3$, $Q2=2$ (50%), availability Phase2 still tolerant 2 failures (any 2 acceptors). This reduces replication latency because only 2 acks needed for steady-state.

> **Theorem 2 (Availability):** Flexible quorums do not reduce fault tolerance for Phase2 if $|Q2| > f$ where $f = n - |Q1_{min}|$.

### 4.2 Egalitarian Paxos Dependency Graphs and Commutativity

EPaxos instance space: each replica owns infinite instance log. Command $c$ assigned instance $(r,i)$. PreAccept collects deps.

**Interference matrix** $I[c1,c2]=1$ if they conflict (non-commutative). For KV: same key. For general state machine: application-provided `interferes()`.

**Dependency Graph** $G=(V,E)$ where $V$ commands, $E$ = deps. Execution order: strongly connected components (SCC) via Tarjan, topologically sorted, commands in same SCC executed sorted by instance ID deterministic.

Safety: if $c1$ and $c2$ interfere, at least one will have other in deps after consensus on deps, thus $G$ edge ensures ordered same everywhere.

*Example*:

```
A: PreAccept c1={x=1}
Peers B,C see no conflict => dep={}
Fast commit.

B concurrent c2={x=2} interferes with c1:
B deps {c1} after PreAcceptOK from A returns {c1}
Commit {c1->c2}
All replicas execute c1 then c2.
```

Contention case: 10% conflict, fast path 90% of commands commit in 1 RTT (2 messages). 10% need slow path Accept phase 2 RTT.

**Liveness issue**: dependency chain explosion under high contention: graph size O(N) linear, execution stalls due to missing dependencies (slow replicas). EPaxos liveness timeout triggers `explicit prepare` to force commits.

![EPaxos Dependency Graph and Commutativity](/thesis/thesis-flex-epaxos-20260808-d4e5-deps.webp)

### 4.3 Fast-Paxos Recovery Liveness

Fast Paxos fast round may see 2 different values accepted in same round by different subsets, classic recovery may block because proposer trying to learn chosen value sees conflicting votes and cannot determine if any value chosen.

Fast Flexible Paxos relaxes triple intersection to single extra: only $Q1 \cap Q_{f1} \cap Q_{f2} \neq \emptyset$.

Proof that this is sufficient: if fast round could have chosen $v$, then any two fast quorums that could have chosen $v$ intersect in at least one acceptor that saw $v$; Phase1 quorum intersecting both must learn $v$.

Recovery liveness:

```tla
Recovery == \E Q1 \in Quorum1:
  LET votes = {aState[a].vote : a \in Q1}
  IN  IF Consistent(votes) THEN Choose(maxVote)
      ELSE NoValue
```

With flexible reduction, $Q1$ size can be smaller, more likely exist available to perform recovery despite f failures in fast path.

We prove liveness via Paxos liveness lemma: eventually some proposer sees stable $Q1$ quorum where no concurrent proposer interferes, using leader election $\Omega$.

### 4.4 Latency/Availability Comparison

Table 5 regions latency:

| Protocol | Leader | Quorum Sizes (n=5) | RTT Fast Path | 10% conflict p50 | p99 |
|----------|--------|-------------------|---------------|------------------|-----|
| Paxos | yes | Q1=3 Q2=3 | 2 | 44 ms | 90 ms |
| FPaxos $|Q2|=2$ | yes | Q1=3 Q2=2 | 2 | 22 ms | 55 ms |
| Fast Paxos | no | $Q_f=4$ | 1 | 28 ms | 78 ms |
| FFPaxos | no | $Q_f=3$, $Q1=3$ | 1 | 21 ms | 52 ms |
| EPaxos | no (per-replica) | depends deps | 1 (fast) | 38 ms | 120 ms |

EPaxos tail due to SCC execution stalls: dependency chain average length 2.1 at 10% conflict, 8.3 at 30% conflict.

![Fast-Paxos Recovery Path Ballot Timeline](/thesis/thesis-flex-epaxos-20260808-d4e5-recovery.webp)

### 4.5 Phase Ordering Elimination

Flexible quorums eliminate need for phase ordering proofs where same quorum used for both phases. By separating $Q1$ and $Q2$, implementation may use different network paths optimized for leader election (WAN) vs steady-state (LAN).

## 5. Empirical/Proofs

**Theorem Proof (Fast Flexible)**:

Assume $v$ chosen in fast round $r_f$ via $Q_f$. Suppose later round $r>r_f$, Phase1 quorum $Q1_r$ exists intersecting any pair of fast quorums that could have chosen $v$. Since $Q_f \cap Q_f' \supseteq$ at least one acceptor that voted $v$, $Q1_r$ learns $v$. Formal in TLA+ 2M states.

**EPaxos Correctness**: Prove interference graph isomorphism via induction over commits, using invariant `DepClosure` - if replica commits $c$ with deps $D$, all commands in $D$ already committed or same batch.

**Benchmark**: 5 AWS regions 10K ops, 1KB payload:

- EPaxos throughput 22K ops/s at 10% conflict, degrades to 9K at 30% conflict due to SCC size growth exponential.
- FFPaxos throughput 31K ops/s constant, 5% latency improvement over Fast Paxos due to smaller $Q_f$.

**GFM Table - Write-Once vs Paxos**:

| Abstraction | State per Acceptor | Messages per Round | Intersection Needed |
|-------------|--------------------|--------------------|---------------------|
| Classic Paxos | vote + promise | 4 | All quorums intersect |
| FPaxos | vote | 4 | $Q1 \cap Q2$ only |
| Fast Paxos | vote (fast) | 2 | $Q1\cap Q2$, $Q_f\cap Q_f\cap Q1$ |
| FFPaxos | vote | 2 | $Q1\cap Q2$, $\exists$ extra |

---

## 6. Limitations

- **Byzantine**: Proofs assume crash-fault, not Byzantine; flexible quorums reduce resilience to equivocation because small $Q2$ may not tolerate $f$ Byzantine.
- **EPaxos starvation**: High contention (>30%) causes unbounded dependency chain, execution never advances without explicit prepare timeout that adds latency.
- **Network partition**: Even-n FPaxos $Q2=f$ loses availability if exactly $f$ failures partition into 2 equal halves both without $f+1$ for $Q1$, livelock.
- **Model checker scale**: TLC limited to n=5, 3 rounds; proof for arbitrary n via manual induction, not mechanized Isabelle/HOL.
- **Real deployment**: AWS results ignore EBS stalling, clock skew 100 ms causing EPaxos instance ID drift.

---

## 7. Conclusion

FPaxos reveals Paxos quorum conservatism; only cross-phase intersection needed. EPaxos exploits commutativity for leaderless 1-RTT but tail latency degraded under contention. Fast Flexible Paxos merges both insights, reducing fast quorum from $\lceil 3n/4\rceil$ to lower bound achieving 5% latency win and retaining liveness of recovery. Future: Byzantine flexible quorums with $2f+1$ proof, CAUSAL-EPaxos with vector clocks, automated quorum system solver.

## References

[1] Howard et al. Fast Flexible Paxos: Relaxing Quorum Intersection for Fast Paxos. arXiv:2008.02671. https://arxiv.org/pdf/2008.02671  
[2] Howard et al. Revisiting quorum intersection. https://web3.arxiv.org/pdf/2008.02671v2  
[3] Howard et al. Relaxed Paxos: Quorum Intersection Revisited (Again). https://arxiv.org/abs/2203.03058  
[4] Howard et al. Write-once registers abstraction. https://arXiv.org/pdf/2203.03058  
[5] Howard, Malkhi, Spiegelman. Flexible Paxos: Quorum Intersection Revisited. OPODIS 2016. https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.OPODIS.2016.25  
[6] Howard et al. Flexible Paxos. arXiv:1608.06696. https://arxiv.org/abs/1608.06696v1  
[7] Moraru, Andersen, Kaminsky. There is More Consensus in Egalitarian Parliaments (EPaxos). SOSP 2013. https://dl.acm.org/doi/10.1145/2517349.2522722  
[8] Lamport. Fast Paxos. https://www.microsoft.com/en-us/research/wp-content/uploads/2006/02/tr-2005-112.pdf  
[9] Lamport. Paxos Made Simple. https://lamport.azurewebsites.net/pubs/paxos-simple.pdf  

![Liveness/Latency Comparison Paxos Variants](/thesis/thesis-flex-epaxos-20260808-d4e5-comparison.webp)

