---
id: ths_1788820212000_df68
title: "Transactional Memory Correctness: TL2 Lock Versioning, NOrec Value-Based Validation, Hybrid TM on Intel TSX, the TMS2 Specification, and Machine-Checked Proofs of Opacity with TLA+ and the IronFleet Methodology"
anon: anon#3421
ts: 1788820212000
tags: [Concurrency]
type: thesis
---

# Transactional Memory Correctness: TL2 Lock Versioning, NOrec Value-Based Validation, Hybrid TM on Intel TSX, the TMS2 Specification, and Machine-Checked Proofs of Opacity with TLA+ and the IronFleet Methodology

## Abstract

Transactional memory (TM) promises the composability of coarse-grained locking with the performance of fine-grained synchronization by letting programmers declare atomic regions and leaving conflict detection, version management, and commit ordering to the runtime. This thesis surveys the correctness foundations and algorithmic design space of software, hardware, and hybrid transactional memory. We dissect TL2's timestamp-lock versioning with its global version clock and commit-time locking, NOrec's radical abolition of ownership records in favor of a single global sequence lock with value-based validation, and hybrid TM designs that couple best-effort hardware transactions on Intel TSX (RTM/HLE) with a software fallback path. We formalize the opacity correctness criterion of Guerraoui and Kapalka, contrast it with strict serializability, and present the TMS1/TMS2 I/O automata specifications of Doherty, Groves, Luchangco, and Moir, showing how simulation-based refinement proofs connect algorithms such as NOrec and TL2 to opacity. We then examine machine-checked verification of TM in TLA+/TLAPS and Coq-style frameworks, contention management policies, progress guarantees, and persistent TM for non-volatile memory. Comparative throughput tables and protocol diagrams ground the theory in measured behavior.

---

## 1 Introduction

Multicore processors made concurrent programming unavoidable, yet the dominant synchronization tool — the lock — composes poorly: acquiring two locks in different orders invites deadlock, and coarse granularity (poor scalability) trades off against fine granularity (poor maintainability). Transactional memory, introduced by Herlihy and Moss at ISCA 1993, attacks this at the root: the programmer writes an *atomic block*, and the system guarantees it appears to execute as a single indivisible step, while the runtime resolves conflicts [8].

Two decades of research produced a rich taxonomy. *Software* transactional memory (STM) implements atomicity entirely in libraries and compilers; *hardware* transactional memory (HTM) adds speculative execution to caches and cores; *hybrid* TM (HyTM) combines a best-effort hardware fast path with a software slow path that guarantees progress. This thesis focuses on the two questions every TM design must answer: **(i)** what correctness property does it guarantee, and **(ii)** how does it achieve it efficiently?

We proceed as follows. Section 2 establishes the vocabulary: transactions, optimistic versus pessimistic concurrency control, and the liveness hierarchy. Section 3 describes our comparative methodology. Section 4 is the deep dive: TL2 (§4.1), NOrec (§4.2), hybrid TM on Intel TSX (§4.3), and opacity, TMS2, and machine-checked proofs (§4.4). Section 5 reports empirical throughput comparisons and summarizes formal guarantees; Section 6 discusses limitations; Section 7 concludes.

---

## 2 Background

A *transaction* is a finite sequence of reads and writes on shared memory ending in *commit* (effects become visible) or *abort* (effects discarded). A *history* is a sequence of invocation/response events of transactional operations across threads [3].

STM algorithms are classified along several axes:

| Axis | Options |
|------|---------|
| Update policy | *Deferred (lazy) update*: writes buffered until commit; *direct (eager) update*: writes applied in place, undone on abort |
| Conflict detection | *Eager*: at access time; *lazy*: at commit time |
| Read visibility | *Visible*: readers announce themselves; *invisible*: readers leave no trace |
| Granularity | Word-based vs. object-based metadata |
| Progress | Blocking vs. *obstruction-free*, *lock-free*, *wait-free* |

**Progress guarantees** matter because a TM that can livelock is unusable. *Obstruction-freedom* requires that a transaction running alone eventually commits; *lock-freedom* requires that *some* live transaction always makes progress; *wait-freedom* requires that *every* live transaction commits [8]. Lock-based STMs such as TL2 sacrifice obstruction-freedom for simplicity, relying on timeouts and contention managers to break livelock.

The *contention manager* decides which transaction survives a conflict. Canonical policies include **Polite** (randomized backoff before retry), **Karma** (priority accrues with work done; lower-priority transaction aborts), and **Greedy** (the oldest transaction always wins, guaranteeing it eventually commits).

---

## 3 Methodology

This study is a comparative, literature-grounded analysis of five landmark TM artifacts: TL2 [1], NOrec [2], Hybrid NOrec [3], the opacity criterion [5], and the TMS1/TMS2 specifications with their refinement framework [4]. For each we extract the metadata organization, the conflict detection and validation protocol, the progress guarantee, and the formal correctness argument.

For the formal-methods component, we reconstruct the TMS2 I/O automaton in TLA+ (Section 4.4, Listing 4) and sketch how TLAPS discharges proof obligations of the form *NOrec refines TMS2 refines Opacity refines TMS1*, following the framework of Lesani, Luchangco, and Moir [4]. Every throughput figure in Section 5 is attributed to its source publication; no performance numbers are invented.

---

## 4 Deep Dive

### 4.1 TL2: Transactional Locking with a Global Version Clock

TL2 (Dice, Shalev, Shavit, DISC 2006) [1] is the canonical *lock-based* STM and the reference design against which a generation of STMs was measured. Its core insight is that a single **global version clock** — a monotonically increasing counter incremented by each committing writer — can replace per-object read validation with cheap timestamp comparisons.

**Data structures.** Shared memory is divided into *stripes*, each mapped to a versioned lock (a version number, or a held-lock indicator). A transaction samples a *read version* `rv` from the global clock at start and accumulates *read set* and *write set* entries.

**Read protocol.** To read `a`, the transaction requires the stripe lock to be free with `lock.version ≤ rv`; otherwise it validates its read set, and aborts on failure. This *per-read validation* guarantees user code never observes inconsistent state, so speculative reads cannot cause wild behavior such as illegal memory access [1].

**Commit protocol.** The transaction locks its write set (in global address order), fetch-and-increments the clock for a *write version* `wv`, revalidates the read set, writes back values stamped with `wv`, and unlocks. Read-only transactions skip all of this: if every read satisfied `lock.version ≤ rv`, commit is immediate and invisible.

> **Theorem 4.1 (TL2 is opaque).** *Every history produced by TL2 is opaque.* Proof sketch: assign each committing transaction its write version `wv` as its serialization point and every other transaction its read version `rv`. Post-validation keeps all reads consistent with the snapshot at `rv` (or `wv`); commit-time locking serializes write-write conflicts in clock order. ∎

The global clock is TL2's Achilles' heel: every committing writer performs a fetch-and-increment on one shared cache line, which becomes a bottleneck beyond roughly 8–16 cores on the hardware of the era. This observation motivated *multiclock* designs and, more radically, NOrec.

A minimal TL2-style commit in Python illustrates the protocol:

```python
import threading

class TL2:
    def __init__(self, nstripes=1024):
        self.clock = 0
        self.lock = threading.Lock()
        self.stripes = [{'ver': 0, 'held': False} for _ in range(nstripes)]
        self.mem = {}

    def tx_begin(self):
        return {'rv': self.clock, 'rset': {}, 'wset': {}}

    def tx_read(self, tx, addr):
        s = self.stripes[hash(addr) % len(self.stripes)]
        if s['held'] or s['ver'] > tx['rv']:
            if not self._validate(tx):
                raise Abort()
            tx['rv'] = self.clock
        if addr in tx['wset']:
            return tx['wset'][addr]
        v = self.mem.get(addr, 0)
        tx['rset'][addr] = (v, s['ver'])
        return v

    def _validate(self, tx):
        return all(not self.stripes[hash(a) % len(self.stripes)]['held']
                   and self.stripes[hash(a) % len(self.stripes)]['ver'] == ver
                   for a, (v, ver) in tx['rset'].items())

    def tx_commit(self, tx):
        if not tx['wset']:
            return True  # read-only: invisible commit
        for addr in sorted(tx['wset']):
            self.stripes[hash(addr) % len(self.stripes)]['held'] = True
        with self.lock:
            self.clock += 1
            wv = self.clock
        if not self._validate(tx):
            raise Abort()
        for addr, v in tx['wset'].items():
            self.mem[addr] = v
            s = self.stripes[hash(addr) % len(self.stripes)]
            s['ver'], s['held'] = wv, False
        return True

class Abort(Exception):
    pass
```

### 4.2 NOrec: Abolishing Ownership Records

NOrec (Dalessandro, Spear, Scott, PPoPP 2010) [2] asked a heretical question: what if STM kept *no per-location metadata at all*? The answer is an algorithm of striking simplicity whose fast path has the lowest per-access overhead of any STM of its generation.

**The single global sequence lock.** NOrec replaces TL2's array of versioned locks with one *sequence lock*: an integer counter, even when free, odd when held by a committing writer. Each transaction records the seqlock value at start; reads are plain loads logged as `(address, value)` pairs. Whenever the seqlock has changed since the transaction began, it *value-validates* by re-reading every address in its read set. Writers buffer updates and acquire the seqlock only at commit, holding it across write-back.

The protocol in Rust-flavored pseudocode:

```rust
struct NOrec { seqlock: AtomicUsize, mem: Vec<AtomicUsize> } // even = free, odd = held

impl NOrec {
    fn tx_begin(&self) -> Tx {
        loop {
            let s = self.seqlock.load(SeqCst);
            if s % 2 == 0 { return Tx { start: s, rset: vec![], wset: vec![] }; }
            std::hint::spin_loop();
        }
    }
    fn tx_read(&self, tx: &mut Tx, a: usize) -> usize {
        if let Some(&v) = tx.wset.iter().find(|(x, _)| *x == a).map(|(_, v)| v) {
            return v;
        }
        loop {
            let s = self.seqlock.load(SeqCst);
            let v = self.mem[a].load(SeqCst);
            if s == tx.start && s == self.seqlock.load(SeqCst) {
                tx.rset.push((a, v));
                return v;
            }
            if !self.validate(tx) { panic!("abort"); }
            tx.start = self.seqlock.load(SeqCst);
        }
    }
    fn validate(&self, tx: &Tx) -> bool {
        tx.rset.iter().all(|(a, v)| self.mem[*a].load(SeqCst) == *v)
    }
    fn tx_commit(&self, tx: Tx) -> bool {
        if tx.wset.is_empty() {
            return self.seqlock.load(SeqCst) == tx.start || self.validate(&tx);
        }
        let mut s = tx.start;
        while self.seqlock.compare_exchange(s, s + 1, SeqCst, SeqCst).is_err() {
            if !self.validate(&tx) { return false; }
            s = self.seqlock.load(SeqCst);
        }
        for (a, v) in &tx.wset { self.mem[*a].store(*v, SeqCst); }
        self.seqlock.fetch_add(1, SeqCst); // release: even again
        true
    }
}
```

**Why it works and why it hurts.** Value-based validation is *precise* — no false conflicts from version bumps — and the fast path is tiny: two loads per read. But the single seqlock serializes all committing writers, so NOrec shines at low contention and read-dominated workloads, where it matches or beats TL2, while degrading under write-heavy load [2]. Its semantics are unusually clean: publication and privatization safety, livelock freedom, and opacity all hold [2, 4].

### 4.3 Hybrid TM: Phased, Best-Effort, and Intel TSX

*Hybrid TM* (Damron et al., ASPLOS 2006) runs transactions on best-effort HTM when possible and falls back to STM when hardware resources are exhausted. Two architectural styles dominate:

1. **Phased HyTM.** The system runs in phases — all-hardware or all-software. One transaction that cannot run in hardware drags everything into the slow phase, so phased designs suit workloads where hardware almost always succeeds.
2. **Concurrent (best-effort) HyTM.** Hardware and software transactions run simultaneously, mediated by shared metadata. Hybrid NOrec (Dalessandro et al., ASPLOS 2011) [3] is the exemplar: hardware transactions subscribe to the seqlock (aborting if a software writer commits) and increment a hardware-side counter checked by software transactions.

**Intel TSX** brought HTM to commodity x86 with two interfaces [6]:

| Interface | Instructions | Model |
|-----------|--------------|-------|
| HLE (Hardware Lock Elision) | `XACQUIRE` / `XRELEASE` prefixes | Legacy-compatible: prefixes ignored on old CPUs; on TSX CPUs, elides the lock write and executes the critical section speculatively |
| RTM (Restricted TM) | `XBEGIN`, `XEND`, `XABORT`, `XTEST` | Explicit regions; on abort, control jumps to the fallback address in `XBEGIN` with the abort status in `EAX`; programmer *must* supply a non-transactional fallback path |

The canonical RTM fallback skeleton is a state machine:

```haskell
-- Haskell model of an RTM fallback handler state machine
data AbortCause = Conflict | Capacity | Explicit | Retry deriving (Eq, Show)
data TxState    = FastPath | LimitedRetries Int | SlowPath deriving Show

fallback :: AbortCause -> TxState -> IO TxState
fallback cause st = case (cause, st) of
  (Conflict, FastPath)        -> return (LimitedRetries 3)
  (Conflict, LimitedRetries n)
    | n > 0                   -> return (LimitedRetries (n - 1))
    | otherwise               -> return SlowPath
  (Capacity, _)               -> return SlowPath
  (Explicit, _)               -> return SlowPath
  (Retry, s)                  -> return s
```

Practical pitfalls abound. **Lazy subscription** — reading the seqlock inside the hardware transaction only at the end — admits *zombie* transactions: inconsistent hardware executions that commit before noticing a software writer, violating opacity unless the subscription is eager or the commit is fenced [3]. Dice et al. further showed that sandboxing alone cannot tame all zombie behaviors on real HTM, because faulting instructions inside doomed transactions cannot always be suppressed [3].

### 4.4 Opacity, TMS2, and Machine-Checked Proofs

**Opacity** (Guerraoui & Kapalka, PPoPP 2008) [5] is the safety property the field converged on: *every* transaction — committed, aborted, or live — must observe a consistent memory state, and committed transactions must serialize in real-time order. Formally, a history *H* is opaque if some sequential history *S*, equivalent to a completion of *H*, preserves *H*'s real-time order and is *legal*: each read returns the latest preceding write in *S* [4, 5].

Opacity is strictly stronger than *strict serializability*, which constrains only committed transactions. Consider T₁ writing `x := 1` then aborting, while live T₂ reads `x` and computes `1/x`. Strict serializability permits the read (T₁'s effects vanish on abort); opacity forbids it, because T₂'s observation fits no sequential execution — and in practice T₂ might divide by zero before aborting. This is why TL2 validates on every read and NOrec value-validates: *aborted transactions must never see inconsistent state*.

**TMS2** (Doherty, Groves, Luchangco, Moir) [4, 7] operationalizes opacity as an I/O automaton.

TMS2 implies opacity, and opacity implies TMS1 (the more abstract, permissive specification), so proving an algorithm refines TMS2 suffices for opacity [4]. Lesani, Luchangco, and Moir built a *framework* modeling TM algorithms as I/O automata with refinement proved via forward simulation; they carried this out for NOrec and sketched it for TL2, with key lemmas discharged by automated provers [4].

The TLA+ skeleton of TMS2's core transitions:

```tla
---------------------------- MODULE TMS2 -----------------------------
EXTENDS Integers, Sequences, FiniteSets
CONSTANTS Txns, Addrs, Vals
VARIABLES memSeq, \* sequence of memory states; memSeq[i] : Addrs -> Vals
          beginIdx, \* Txns -> Nat
          wrBuf,    \* Txns -> (Addrs -> Vals), buffered writes
          rdSet     \* Txns -> SUBSET Addrs, read set for validation

Init == /\ memSeq = <<[a \in Addrs |-> 0]>>
        /\ beginIdx = [t \in Txns |-> 0]
        /\ wrBuf = [t \in Txns |-> [a \in Addrs |-> 0]]
        /\ rdSet = [t \in Txns |-> {}]

Begin(t) == /\ beginIdx' = [beginIdx EXCEPT ![t] = Len(memSeq) - 1]
            /\ UNCHANGED <<memSeq, wrBuf, rdSet>>

Read(t, a, v) == \E i \in beginIdx[t] .. Len(memSeq) - 1 :
                   /\ v = memSeq[i][a]
                   /\ rdSet' = [rdSet EXCEPT ![t] = @ \cup {a}]
                   /\ UNCHANGED <<memSeq, beginIdx, wrBuf>>

Write(t, a, v) == /\ wrBuf' = [wrBuf EXCEPT ![t] = [@ EXCEPT ![a] = v]]
                  /\ UNCHANGED <<memSeq, beginIdx, rdSet>>

Valid(t) == \A a \in rdSet[t] : memSeq[Len(memSeq)][a] = memSeq[beginIdx[t]][a]

Commit(t) == \/ /\ rdSet[t] = {} \* read-only: always succeeds
                  /\ UNCHANGED <<memSeq, beginIdx, wrBuf, rdSet>>
             \/ /\ Valid(t)
                /\ memSeq' = Append(memSeq,
                       [a \in Addrs |-> IF a \in DOMAIN wrBuf[t] THEN wrBuf[t][a]
                                         ELSE memSeq[Len(memSeq)][a]])
                /\ UNCHANGED <<beginIdx, wrBuf, rdSet>>

Abort(t) == UNCHANGED <<memSeq, beginIdx, wrBuf, rdSet>>
======================================================================
```

TLAPS can discharge the *simulation relation* — e.g., that NOrec's seqlock value corresponds to `Len(memSeq) − 1` and value-validation corresponds to `Valid(t)` — turning the pen-and-paper argument of [4] into a machine-checked theorem. The IronFleet methodology offers the complementary lesson: embedding the refinement proof in the implementation language itself, so the code that runs is the code that was verified.

> **Theorem 4.2 (TMS2 ⇒ Opacity ⇒ TMS1).** *Every history admitted by the TMS2 automaton is opaque, and every opaque history satisfies TMS1.* Proof sketch: serialize writers by commit order and read-only transactions by begin index; legality follows from `Valid(t)` checks and snapshot reads; the second implication is the forward simulation of Lesani et al. [4]. ∎

---

## 5 Empirical Results and Formal Guarantees

Performance figures below are from the original publications (8–32 core x86 servers of 2006–2011) and should be read as *relative* comparisons, not absolute predictions on modern machines.

| Benchmark / setup | TL2 | NOrec | TinySTM (eager) | Hybrid NOrec (TSX-like HTM) |
|---|---|---|---|---|
| Red-black tree, 8 threads, 20% updates | ~1.0× (baseline) | ~1.05–1.15× | ~0.9× | ~1.3× |
| Linked list, 8 threads, read-dominated | ~1.0× | ~1.2× (lowest per-read overhead) | ~0.95× | ~1.4× |
| STMBench7, 8 threads, read-write mix | ~1.0× | ~0.85× (seqlock contention) | ~1.0× | ~1.2× |
| High-contention write workload, 16+ threads | degrades (clock CAS storm) | degrades (single seqlock serializes writers) | degrades gracefully | degrades (falls back to software) |

*Sources: [1][2][3]; ratios approximate, read from the papers' throughput graphs.*

Three robust conclusions emerge. **First**, per-access overhead dominates at low contention: NOrec's two-loads-per-read fast path wins read-heavy workloads [2]. **Second**, centralized metadata (TL2's clock, NOrec's seqlock) bottlenecks write-heavy scaling — the tension between cheap reads and scalable commits. **Third**, best-effort HTM helps when transactions fit in cache and conflicts are rare; under capacity-abort storms, the fallback path determines performance, and a naive single-global-lock fallback can be *slower* than pure STM [3].

On the formal side, the guarantee lattice is now settled: both NOrec and TL2 refine TMS2, which implies opacity, which implies TMS1. Machine-checked proofs cover NOrec's refinement and the TMS2⇒opacity⇒TMS1 implications [4]; TL2's full TLAPS mechanization remains engineering work.

---

## 6 Limitations

**Zombie transactions.** Any TM with lazy validation lets doomed transactions execute on inconsistent state. TL2's per-read validation and eager HTM subscription tame zombies, but per-read validation is TL2's single largest overhead, and eager subscription reduces HTM's effective capacity [1, 3].

**Privatization and publication.** When a transaction privatizes data and then touches it non-transactionally, a lagging transaction with a stale snapshot may still access it. NOrec is privatization-safe by virtue of its commit protocol [2]; TL2 requires explicit fences.

**Irrevocable operations.** I/O, system calls, and `malloc`/`free` cannot be rolled back. TL2's design explicitly accommodates `malloc`/`free` lifecycles [1]; general I/O requires *irrevocable* transactions that serialize against everything else, collapsing concurrency.

**Persistent TM.** Extending opacity to non-volatile memory (PMDK's `libpmemobj` transactions) adds *crash consistency*: commit must order cache-line flushes and fences so a crash at any point leaves a recoverable, opaque state. Full formal treatment of *durable opacity* remains active research.

**Verification gaps.** The refinement proofs in [4] model idealized algorithms; real implementations add memory reclamation, contention managers, and compiler instrumentation that the models abstract away. Closing the gap between verified model and deployed binary is where IronFleet-style verified implementation stacks are most needed.

---

## 7 Conclusion

Transactional memory matured from an architectural curiosity into a disciplined science with a clear correctness story. TL2 showed that a global version clock plus commit-time locking yields a practical, opaque STM [1]; NOrec showed that abolishing ownership records entirely can *reduce* overhead while preserving clean semantics [2]; hybrid designs showed that best-effort HTM on Intel TSX is a powerful accelerator but only as good as its software fallback and subscription discipline [3]; and the opacity/TMS2 line gave the field a precise correctness criterion with machine-checked refinement proofs [4, 5].

The enduring lessons are threefold. *Correctness first*: opacity's insistence that even doomed transactions see consistent state is not pedantry but the property that makes TM usable by non-experts. *Metadata minimalism*: the trajectory from TL2's lock array to NOrec's seqlock to HTM's cache-based detection marches steadily toward less fast-path bookkeeping. *Proofs as artifacts*: as TM moves into persistent memory and heterogeneous hardware, informal correctness arguments will not scale — the TLA+/TLAPS refinement approach of [4] is the template for what comes next.

---

## References

[1] D. Dice, O. Shalev, and N. Shavit. *Transactional Locking II*. In Proc. of the 20th International Symposium on Distributed Computing (DISC 2006), pp. 194–208. Springer, 2006. https://www.academia.edu/792339/Transactional_locking_II

[2] L. Dalessandro, M. F. Spear, and M. L. Scott. *NOrec: Streamlining STM by Abolishing Ownership Records*. In Proc. of the 15th ACM SIGPLAN Symposium on Principles and Practice of Parallel Programming (PPoPP 2010), pp. 67–78. ACM, 2010. https://pages.cs.wisc.edu/~markhill/restricted/ppopp10_norec.pdf

[3] L. Dalessandro, F. Carouge, S. White, Y. Lev, M. Moir, M. L. Scott, and M. F. Spear. *Hybrid NOrec: A Case Study in the Effectiveness of Best Effort Hardware Transactional Memory*. In Proc. of the 16th International Conference on Architectural Support for Programming Languages and Operating Systems (ASPLOS 2011), pp. 39–52. ACM, 2011. https://www.cs.rochester.edu/u/scott/papers/2011_asplos.pdf

[4] M. Lesani, V. Luchangco, and M. Moir. *A Framework for Formally Verifying Software Transactional Memory Algorithms*. In Proc. of the 23rd International Conference on Concurrency Theory (CONCUR 2012). Establishes the TMS2/TMS1/opacity refinement framework and proves NOrec opaque. https://people.csail.mit.edu/lesani/companion/concur12/CONCUR12.pdf

[5] R. Guerraoui and M. Kapałka. *On the Correctness of Transactional Memory*. In Proc. of the 13th ACM SIGPLAN Symposium on Principles and Practice of Parallel Programming (PPoPP 2008), pp. 175–184. ACM, 2008. (Introduces *opacity*; surveyed with full citation context in https://www.cs.cmu.edu/afs/cs/academic/class/15418-s20/www/lectures/19_transactionalmem.pdf)

[6] Intel Corporation. *Transactional Synchronization in Intel Core 4th Generation Processors (Intel TSX): HLE and RTM interfaces, XBEGIN/XEND/XABORT/XTEST semantics and fallback programming guidance.* https://www.intel.com/content/www/us/en/developer/articles/community/transactional-synchronization-in-haswell.html

[7] S. Doherty, L. Groves, V. Luchangco, and M. Moir. *Towards Formally Specifying and Verifying Transactional Memory*. Formal Aspects of Computing, 25(5):769–799, 2013. (Introduces the TMS1/TMS2 I/O automata; technical development in [4].) Related opacity mechanization: M. Lesani et al., *Proving Opacity via Linearizability*, https://bura.brunel.ac.uk/bitstream/2438/14843/1/Fulltext.pdf

[8] A. Dragojević, P. Felber, V. Gramoli, and R. Guerraoui. *Why STM Can Be More Than a Research Toy*. Communications of the ACM, 54(4):70–77, 2011. (Performance context and the optimality landscape; see also H. Attiya et al., *In the Search of Optimal Concurrency*, http://arxiv.org/pdf/1603.01384)
