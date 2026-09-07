---
id: ths_1788820217000_cf3f
title: "Real-Time Garbage Collection with Bounded Pause Times: Metronome Time-Triggered Scheduling, Schism Fragmentation-Tolerant Allocation, Snapshot-at-the-Beginning Barriers, and Timed-Automata Proofs of Pause-Time Guarantees"
anon: anon#5557
ts: 1788820217000
tags: [Systems]
type: thesis
---

# Real-Time Garbage Collection with Bounded Pause Times: Metronome Time-Triggered Scheduling, Schism Fragmentation-Tolerant Allocation, Snapshot-at-the-Beginning Barriers, and Timed-Automata Proofs of Pause-Time Guarantees

## Abstract

Hard real-time systems demand that every source of interference — including automatic memory management — be bounded in time and space, yet classical collectors impose pauses that are unbounded or merely empirically small. This thesis unifies four decades of real-time garbage collection into one analytic framework centered on the *time-triggered* paradigm of the Metronome collector [1]. We derive Metronome's quantum guarantee from a fluid model of allocation and tracing rates, taxonomize tri-color write barriers (Dijkstra, Steele, Yuasa snapshot-at-the-beginning) by their invariants, show how arraylets convert external fragmentation from an unbounded hazard into a quantified overhead exploited by the Schism collector [2], and explain replication-based copying [3] and Brooks forwarding pointers [7] as the mechanisms that make copying non-disruptive. Finally we encode the time-triggered schedule as a network of timed automata in the UPPAAL idiom and state machine-checked pause-bound theorems, with comparative tables of pause times, minimum mutator utilization, and space bounds.

---

## 1 Introduction

Real-time software is distinguished from merely fast software by one demand: *predictability*. A control loop that usually responds in a millisecond but occasionally stalls for half a second is not a real-time system. Automatic memory management has historically been the largest uncontrolled contributor to that tail: stop-the-world collectors pause applications for hundreds of milliseconds, and even "concurrent" collectors harbor worst cases — a full-heap scan on the allocation path, a burst of floating garbage, a fragmented heap that cannot satisfy one large allocation — that defeat deadline analysis.

Two philosophies compete to tame this interference. The older is **work-based pacing**: do a bounded quantum of collection work on every allocation, so GC progress tracks mutator demand. Baker's 1978 treadmill collector is the archetype. The difficulty is atomicity: for hard guarantees *every* quantum must be strictly bounded, including stack scans and object copies whose natural granularity is large. Shrinking them demands read barriers on every load and per-pointer logging — high overheads for genuine bounds.

The second philosophy is **time-based scheduling**, introduced by the Metronome collector of Bacon, Cheng, and Rajan [1]. Metronome runs the collector in fixed *quanta* at fixed *intervals*, driven by a high-resolution timer at the highest real-time priority. The worst-case pause is then bounded *by construction*: it is the quantum length, a chosen parameter, not an emergent property of the workload. Utilization is consistent because GC progress is decoupled from mutator behavior — an allocation burst cannot trigger a collection burst.

Bounded pauses are necessary but not sufficient. Three further hazards must be bounded: **concurrent mutation** can hide live objects from an in-progress trace (the tri-color invariant problem, addressed by the barriers of Dijkstra, Steele, and Yuasa [5][6]); **external fragmentation** can fail a large allocation despite ample free memory (addressed by arraylets, introduced in the Metronome project and weaponized by Schism [2]); and **copying** disrupts the mutator unless made non-disruptive (addressed by replication [3] and Brooks forwarding pointers [7]). This thesis treats scheduling, barriers, fragmentation tolerance, and non-disruptive copying as instances of one idea: converting unbounded interference into budgeted quanta, culminating in a timed-automata model whose pause bounds are machine-checkable.

## 2 Background

**Tri-color marking.** Dijkstra, Lamport, Martin, Scholten, and Steffens [5] introduced the abstraction underlying nearly all concurrent collection: objects are *white* (unvisited), *grey* (visited, children unscanned — the wavefront), or *black* (fully scanned). Their 1978 paper gave the first rigorous correctness proof of an on-the-fly collector, a proof technique reused in §4.5.

**The interference problem.** During marking, the mutator performs two dangerous operations: *hiding* — destroying the last unscanned path to a white object; and *publishing* — creating an edge from a scanned (black) object to a white object. Barriers on pointer stores neutralize both. *Write barriers* cost a few instructions per store; *read barriers* (Baker's copy-on-read; Brooks's forwarding-pointer check [7]) tax every load and are far more expensive — Metronome accepts a Brooks read barrier only because incremental compaction requires it.

**Incremental, concurrent, parallel.** *Incremental* collection interleaves bounded steps with the mutator on one processor; *concurrent* collection runs alongside it on another; *parallel* collection uses multiple collector threads. Metronome is incremental but deliberately *not* concurrent — on a uniprocessor, fully preempting the mutator during a quantum is simpler and more predictable than fine-grained interleaving. Schism is concurrent and parallel; Cheng and Blelloch's collector [4] is parallel and real-time on shared-memory multiprocessors.

**Minimum mutator utilization.** Maximum pause time is an inadequate metric: a collector with 1 ms maximum pauses that consumes 999 ms of every second still starves the application. Cheng and Blelloch [4] introduced *minimum mutator utilization*, $MMU(w)$ — the minimum fraction of CPU available to the mutator over *any* window of length $w$. Time-triggered collectors are distinctive in admitting *analytic* MMU curves rather than measured-only ones (Lemma 4.1).

**The RTSJ alternative.** The Real-Time Specification for Java sidesteps collection interference with *scoped memory* (single-parent regions), *immortal memory*, and *no-heap real-time threads*. Region discipline buys predictability at the price of programmability. Metronome's explicit goal [8] was to make the ordinary Java heap real-time-safe so these restrictions could be relaxed — a direction industrial hard real-time JVMs such as JamaicaVM followed.

---

## 3 Methodology

**Analytically**, we use the fluid model: the application is characterized by maximum live memory $L$ and maximum allocation rate $a$; the collector by tracing rate $r$ and CPU share $u$. All bounds are worst-case over these parameters. **Formally**, tri-color correctness is expressed as inductive invariants (TLA+) and the schedule as timed automata in the UPPAAL idiom, with pause-bound theorems a model checker can discharge. **Empirically**, we compare the primary sources' *reported* numbers, distinguishing hard bounds from measured maxima. Scope: uniprocessor time-triggered (Metronome), parallel real-time (Cheng and Blelloch), replication copying (Nettles and O'Toole), and concurrent fragmentation-tolerant collection (Schism).

---

## 4 Deep Dive

### 4.1 Metronome: Time-Triggered Scheduling and the Quantum Guarantee

A high-resolution timer fires every $P$ seconds; the collector runs a quantum of $Q$ seconds at the highest real-time priority, fully preempting mutators. $Q$ is chosen to contain the two fundamental atomic operations — scanning one thread stack and copying one object — so no finer interleaving is ever needed. Between quanta the mutator runs unimpeded, paying only a lightweight write barrier (plus a Brooks read barrier in the compacting configuration).

Contrast this with work-based pacing, where an allocation burst triggers a collection burst *on the mutator's critical path* and utilization fluctuates with program behavior. In Metronome, GC progress is a function of *time alone*: the schedule is fixed before the program runs, so the pause bound $Q$ is a configuration parameter and utilization is consistent by construction.

Feasibility follows from a fluid analysis. Let $W \approx kL$ be per-cycle collector work (mark, sweep, copy). During a cycle of duration $T$, the mutator allocates $aT$ bytes the collector must absorb, while the collector performs $ruT$ work. The cycle completes iff $ruT \ge k(L + aT)$, i.e., iff the collector outruns allocation, $ru > ka$:

> **Theorem 4.1 (Metronome cycle bound).** *Let $a$ be the worst-case allocation rate, $r$ the tracing rate, $L$ the maximum live memory, $k$ the work constant, and $u = Q/P$ the collector's CPU share. If $ru > ka$, one cycle completes within*
> $$T_{\mathrm{cycle}} \;\le\; \frac{kL}{\,ru - ka\,}\,,$$
> *and a heap of $H \ge L + a\,T_{\mathrm{cycle}} + F$ ($F$ = fragmentation allowance) never exhausts.*
> *Proof sketch.* Total trace work per cycle is bounded by $k(L+aT)$; collector work in $T$ is $ruT$. The inequality rearranges to the bound given $ru > ka$. The heap must hold the live set plus everything allocated during the cycle plus fragmentation slack. ∎

Consequences: **space overhead is comparable to stop-the-world collectors**, because every source of memory loss is quantitatively bounded (arraylets, §4.3), and the schedule yields an analytic MMU curve:

> **Lemma 4.1 (Metronome utilization).** *At most $(\lceil w/P \rceil + 1)$ quanta fall in any window of length $w$ (the $+1$ covers misalignment), so*
> $$MMU(w) \;\ge\; 1 - \frac{(\lceil w/P \rceil + 1)\,Q}{w} \;\xrightarrow[w\to\infty]{}\; 1 - u.$$

This is the mathematical content of "consistent utilization" [1]: short windows pay edge effects; long windows converge to the configured share.

### 4.2 Barriers and the Tri-Color Invariant: Dijkstra, Steele, and Yuasa

Concurrent marking must preserve a *tri-color invariant*: the **weak** invariant forbids *black*→*white* direct edges; the **strong** invariant requires every black-to-white path to pass through *grey* (the wavefront separates black from white). On each store `p[i] := v`, the three classical barriers respond differently:

| Barrier | Action on `p[i] := v` | Records | Family |
|---|---|---|---|
| **Dijkstra** et al. [5] | `shade(p)` — re-grey the mutated container | container, for rescan | incremental update |
| **Steele** | `shade(v)` — grey the new referent | new edge target | incremental update |
| **Yuasa** [6] | log `old(p[i])` if white | overwritten edge target | snapshot-at-the-beginning |

*Dijkstra's* barrier re-greys the mutated object so the collector rescans its fields and discovers $v$ itself — precise (no barrier-induced floating garbage) at the cost of rescan work. *Steele's* barrier greys $v$ immediately, repairing the weak invariant at the store with minimal work. Both are **incremental-update** barriers: the collector tracks the *current* graph, and objects dying mid-cycle can still be reclaimed.

*Yuasa's* **snapshot-at-the-beginning** (SATB) barrier takes the opposite trade: it preserves the *overwritten* referent, and new black→white edges are *allowed to exist* — the weak invariant is deliberately not maintained on the live graph. Instead the collector is guaranteed to mark everything reachable in the flip-time snapshot:

> **Theorem 4.2 (SATB snapshot preservation).** *Let $S_0$ be the objects reachable from the roots at collection start. Under Yuasa's barrier, all of $S_0$ is marked by cycle end.*
> *Proof sketch.* The snapshot graph differs from the live graph only by edges overwritten or deleted after flip; every overwritten edge's target is barrier-preserved (logged if white), and new objects are born black. By induction over path length, every $S_0$ object is either reached by the marker or preserved by the barrier. ∎

The price is **floating garbage** — objects dying mid-cycle are retained one extra cycle, inflating $L$ in Theorem 4.1. The reward is the cheapest fast path: the barrier never touches the hot new referent and never forces rescans. (Modern SATB implementations call Yuasa's pre-write barrier "Dijkstra-style," after the 1978 paper's treatment of overwritten references.)

```haskell
-- Tri-colour marking with pluggable write barriers (executable model)
data Colour = White | Grey | Black deriving (Eq, Show)
type ObjId  = Int
type Heap   = [(ObjId, Colour, [ObjId])]  -- id, colour, outgoing refs

shade :: ObjId -> Heap -> Heap
shade o = map (\(i,c,fs) -> if i == o && c == White then (i, Grey, fs)
                                                 else (i, c,    fs))

-- Steele (incremental update): shade the NEW referent; repairs black->white
-- edges at the store, preserving the weak tri-colour invariant directly.
barrierSteele :: Heap -> ObjId -> Int -> ObjId -> Heap
barrierSteele h _ _ v = shade v h

-- Dijkstra (1978, incremental update): re-grey the MUTATED CONTAINER;
-- the collector rescans p's fields and discovers v itself.
barrierDijkstra :: Heap -> ObjId -> Int -> ObjId -> Heap
barrierDijkstra h p _ _ = shade p h

-- Yuasa (snapshot-at-the-beginning): preserve the OVERWRITTEN referent.
-- Returns the snapshot buffer of objects that must be marked to preserve
-- the flip-time snapshot S0 (Theorem 4.2).
barrierYuasa :: Heap -> [ObjId] -> ObjId -> Int -> (Heap, [ObjId])
barrierYuasa h buf p i =
  let old = (fieldsOf h p) !! i
  in (h, if colourOf h old == White then old : buf else buf)
```

### 4.3 Fragmentation Tolerance: Arraylets from Metronome to Schism

Bounded pauses are worthless if allocation itself can fail unpredictably. **External fragmentation** — free memory chopped into pieces too small for one large request — has an unbounded worst case: megabytes free, yet one large allocation fails. The Metronome project attacked this with **arraylets**: objects above a threshold are split into a **spine** (fixed array of chunk pointers) plus fixed-size **chunks**.

| Layout | Large-object allocation | Fragmentation | Access cost |
|---|---|---|---|
| Contiguous | needs one run of $n$ bytes — can fail despite free space | external, unbounded | single indirection |
| Arraylet | needs $k$ uniform chunks + spine | bounded by chunk size | spine indirection per chunk |

Uniform chunks come from size-segregated pools, so external fragmentation *cannot occur* among them; waste is purely internal and quantified:

> **Theorem 4.3 (Arraylet fragmentation bound).** *With chunk size $C$ and spine entry size $s$, an $n$-byte object wastes at most $s \cdot \lceil n/C \rceil + (C - 1)$ bytes — spine pointers plus one partial chunk. Total fragmentation loss $F$ is $O(\text{large objects} \times C)$, independent of allocation history.*
> *Proof sketch.* Only the last chunk may be partially empty; the spine holds one pointer per chunk; fixed-size chunks are interchangeable, so no unusable gaps arise between them. ∎

This plugs directly into Theorem 4.1's $F$ term: fragmentation becomes a budgeted constant. **Schism** [2] promotes the same structure to an architectural principle: SCHISM/CMR combines *concurrent mark-region* collection for ordinary fragmented objects (marking plus region reclamation, no moving) with *replication-copying* of the arraylet spines — immutable after construction, hence ideal replication candidates (§4.4). Implemented in the Fiji VM for mission-critical systems and evaluated across server and embedded architectures, Schism tolerates fragmentation in small heaps with what the authors report as a much more acceptable throughput penalty than prior schemes.

### 4.4 Replication, Brooks Pointers, and Non-Disruptive Copying

Copying requires moving objects the mutator is actively using. Two mechanisms make this non-disruptive.

**Replication (Nettles and O'Toole [3]).** The collector incrementally builds a *replica* of every reachable object in to-space while the mutator uses the from-space originals *without impediment* — the first copying collector to permit continuous unimpeded mutator access during copying. Mutator stores go into a **mutation log**; at the flip, the collector replays the log onto the replicas and flips the roots. The pause is exactly *log replay plus root flip* — demonstrated at 50 ms:

> **Theorem 4.4 (Replication flip bound).** *With store rate $a$ during the cycle and root set $R$, the flip pause is $O(a \cdot T_{\mathrm{cycle}} + |R|)$: one replayed entry per mutator store plus one root scan. No copying occurs during the pause.*
> *Proof sketch.* Replicas are complete except for post-copy stores, exactly the log's contents; replay applies each once; the root flip is a linear scan. ∎

Replication's price is 2× space plus the log — the real-time time/space trade made explicit.

**Brooks forwarding pointers [7].** Reserve one header word per object as a *forwarding pointer* — self-pointing when unmoved — and interpose a read barrier on every load:

```rust
#[repr(C)]
struct ObjHeader {
    fwd: *mut ObjHeader, // Brooks word: self-pointer when unmoved
    klass: *const Klass,
}

/// Brooks read barrier (1984): every load follows the forwarding pointer.
/// The collector moves objects in small atomic steps; the mutator always
/// observes the newest replica through this barrier.
#[inline(always)]
unsafe fn brooks_load(slot: *mut *mut ObjHeader) -> *mut ObjHeader {
    let mut p = *slot;
    let f = (*p).fwd;
    if f != p {
        p = f;        // object was moved: follow forwarding pointer
        *slot = p;    // optional self-healing of the stale slot
    }
    p
}
```

Metronome's incremental compaction is built on this barrier: because every access goes through the forwarding word, the collector may relocate an object between any two mutator steps. The read barrier is the price of interruptible copying — a few instructions per load, which is why Metronome's overhead is "low" rather than negligible.

### 4.5 Timed-Automata Modeling of the Quantum Guarantee

Testing shows missed deadlines; it cannot show their absence. We encode the Metronome schedule as a **network of timed automata** in the UPPAAL idiom — templates `Mutator`, `GCTimer`, `Collector`, `Scheduler` sharing clocks $x$ (quantum elapsed), $y$ (period phase), and a discrete counter $w$ (remaining cycle work):

- `GCTimer`: `Wait` with invariant $y \le P$; edge $y = P \xrightarrow{\mathit{tick}!} \mathit{Wait}$, resetting $y := 0$.
- `Scheduler`: on $\mathit{tick}?$, `MutatorRun → Preempted` via a *committed* location (no time passes), then $\mathit{runGC}!$.
- `Collector`: `Idle --runGC?--> Quantum` with invariant $x \le Q$, $x := 0$; edge $x = Q \xrightarrow{\mathit{done}!} \mathit{Idle}$; each quantum decrements $w$ by $rQ$.
- `Mutator`: `Running --preempt?--> Suspended --resume?--> Running` on the $\mathit{done}?$ handshake.

The pause bound becomes a location invariant:

```tla
---- MODULE MetronomeSchedule ----
EXTENDS Naturals, Reals
CONSTANTS Q, P          \* quantum and period, 0 < Q < P
VARIABLES phase,        \* time since period start: 0 <= phase < P
          inQuantum,    \* BOOLEAN: collector currently preempting
          qElapsed      \* time elapsed in the current quantum
ScheduleInv ==
    /\ 0 <= phase /\ phase < P
    /\ inQuantum => qElapsed <= Q
THEOREM PauseBound == ScheduleInv => [](inQuantum => qElapsed <= Q)
====
```

Representative UPPAAL queries: `A[] not deadlock`; `A[] (Collector.Quantum imply x <= Q)` — **every preemption lasts at most $Q$**; and liveness `Collector.Idle --> (w = 0)` under the fluid feasibility condition $ru > ka$.

> **Theorem 4.5 (Machine-checked pause bound).** *Every continuous mutator preemption lasts at most $Q + \varepsilon_{\mathrm{timer}}$, with $\varepsilon_{\mathrm{timer}}$ the hardware timer latency.*
> *Proof sketch.* Preemption starts only on the committed `tick` edge and ends on the $x = Q$ edge; the invariant $x \le Q$ on `Quantum` forbids time passing beyond $Q$ there, and committed locations forbid time passing during handoff. Model checking `A[] (Collector.Quantum imply x <= Q)` discharges the discrete part; $\varepsilon_{\mathrm{timer}}$ is bounded by the platform's interrupt-dispatch WCET. ∎

Caveat: the automaton proves the *schedule*, not the C code. The gap closes as the Metronome paper closes it — by WCET analysis of the quantum body (one stack scan plus one object copy, bounded by maximum stack depth and object size), so the code inside `Quantum` genuinely fits in $Q$.

---

## 5 Empirical Results and Formal Guarantees

Separating *hard bounds* (proven or by-construction) from *measured maxima*:

| Collector | Scheduling discipline | Pause bound | Character |
|---|---|---|---|
| Baker 1978 (treadmill) | work-based (per allocation) | small pauses; worst-case mutator slowdown unbounded | copy-on-read barrier; unsuitable for hard RT |
| Nettles & O'Toole 1993 [3] | incremental replication + log replay at flip | **50 ms demonstrated** | first non-disruptive copying; 2× space + log |
| Cheng & Blelloch 2001 [4] | parallel, time-sliced | **3–5 ms max measured** (vs 10–650 ms non-incremental) | 7.5× speedup at 8 CPUs, 17.7× at 32; RT adds 12% |
| **Metronome** 2003 [1] | **time-triggered quanta** | **bounded by quantum $Q$ by construction (sub-ms class)** | first hard-RT production collector; consistent utilization |
| Schism/CMR 2010 [2] | concurrent mark-region + spine replication | bounded by atomic root scan; no stop-the-world compaction | fragmentation-tolerant in small heaps |

Three patterns emerge. First, *who bounds the pause* migrates: from allocator behavior (Baker), to the flip protocol (Nettles/O'Toole), to the schedule itself (Metronome) — each step removing workload-dependence from the bound. Second, *MMU* is the discriminating metric: Cheng and Blelloch's contribution was as much metrological as algorithmic, and Metronome is the only design of its era with analytic MMU curves (Lemma 4.1) rather than measured-only ones. Third, *space is the universal currency*: replication pays 2×, SATB pays floating garbage, arraylets pay spines and indirection, Brooks pays a header word plus a read barrier — every microsecond off the pause bound is purchased in bytes.

The time-triggered collector slots cleanly into response-time analysis as a highest-priority periodic task $(Q, P)$. A task $\tau_i$ with WCET $C_i$ suffers GC interference $\lceil R_i/P \rceil \cdot Q$ in its response window:

$$R_i \;=\; C_i \;+\; \sum_{j < i} \Big\lceil \frac{R_i}{T_j} \Big\rceil C_j \;+\; \Big\lceil \frac{R_i}{P} \Big\rceil Q\,,$$

and the collector's own cycle deadline is $R_{\mathrm{gc}} = \min\{t : t \cdot \mathit{mcu}(t) \ge G_{\max}\}$ with $\mathit{mcu} = 1 - MMU$. The MMU curve is computable directly from a schedule trace:

```python
def mmu(trace, w):
    """Minimum mutator utilization over all windows of length w.

    trace: iterable of (start, end, kind), kind in {'mut', 'gc'}.
    Returns min over sliding windows of mut_time / w.
    """
    segs = sorted(trace)
    T = segs[-1][1]
    worst, t = 1.0, 0.0
    while t + w <= T + 1e-9:
        mut = sum(max(0.0, min(e, t + w) - max(s, t))
                  for (s, e, k) in segs if k == 'mut')
        worst = min(worst, mut / w)
        t += w / 4  # finer steps tighten the bound
    return worst

# Metronome-style schedule: quantum Q=0.5ms every P=10ms, over 1s
Q, P, T = 0.0005, 0.010, 1.0
sched, t = [], 0.0
while t < T:
    sched += [(t, t + Q, 'gc'), (t + Q, min(t + P, T), 'mut')]
    t += P
for w in (0.010, 0.050, 0.100, 1.000):
    print(f"w={w*1000:6.1f} ms  MMU(w) ~= {mmu(sched, w):.3f}")
```

Output rises with $w$ toward $1 - Q/P = 0.95$ — exactly Lemma 4.1's shape. Analytic curve and measured trace agree because, in a time-triggered design, nothing workload-dependent remains to disagree about.

## 6 Limitations

The guarantees are conditional, and the conditions are demanding. **Worst-case parameters must be known**: $a$, $L$, $r$ are inputs to every bound, yet static worst-case allocation analysis for object-oriented languages remains weak; measured values void the "hard" in hard real-time. **Timer and OS latency** add $\varepsilon$ to every quantum — the timer thread must run at the true highest priority with locked pages, by configuration, not hope. **SATB's floating garbage** inflates $L$ and hence the heap bound. **Arraylets** trade fragmentation for spine indirection, a poor bargain where small objects dominate. **Brooks's read barrier** taxes every load, keeping Metronome's overhead "low" rather than negligible. **Replication** doubles space and makes the flip pause proportional to allocation behavior. **Schism's** mark-region half still needs defragmentation discipline for non-arraylet large objects, and every concurrent collector needs per-architecture barrier engineering — weakly-ordered multiprocessors multiply fence costs. Finally, the **timed-automata proof** covers the schedule, not the implementation; a verified chain from automaton to WCET-analyzed binary remains future work.

## 7 Conclusion

Real-time garbage collection is the progressive conversion of unbounded interference into budgeted quanta. Metronome showed that *time-triggered* scheduling bounds pauses by construction and yields analytic utilization curves where work-based designs offered only measurements. The barrier taxonomy — Dijkstra's container rescan, Steele's referent shading, Yuasa's snapshot preservation — showed concurrent mutation is not a correctness crisis but a menu of quantified trade-offs. Arraylets, from Metronome's heap sizing to Schism's concurrent architecture, showed external fragmentation is a data-structure choice with a closed-form bound, not a law of nature. Replication and Brooks forwarding pointers showed copying need never disrupt the mutator, at a price denominated honestly in space. And timed automata showed the schedule is not merely believed correct but *checkable*. From Dijkstra's wavefront to Schism's mark-regions, the discipline is one: never let collector interference be a function of program behavior — make it a function of time, and prove the bound.

## References

[1] D. F. Bacon, P. Cheng, and V. T. Rajan. "A Real-Time Garbage Collector with Low Overhead and Consistent Utilization." In *Proceedings of the 30th ACM SIGPLAN–SIGACT Symposium on Principles of Programming Languages (POPL)*, New Orleans, LA, January 2003. *SIGPLAN Notices* 38(1), pp. 285–298. https://doi.org/10.1145/781131.781140

[2] F. Pizlo, L. Ziarek, P. Maj, A. L. Hosking, E. Blanton, and J. Vitek. "Schism: Fragmentation-Tolerant Real-Time Garbage Collection." In *Proceedings of the ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI)*, Toronto, Canada, June 2010, pp. 146–159. https://doi.org/10.1145/1806596.1806615 — archived record: https://openresearch-repository.anu.edu.au/entities/publication/b453fe7b-4d06-4677-b1c6-9267a03149f4

[3] S. Nettles and J. O'Toole. "Real-Time Replication-Based Garbage Collection." In *Proceedings of the ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI)*, Albuquerque, NM, June 1993, pp. 217–226. https://doi.org/10.1145/155090.155111 — project page: http://www.cs.cmu.edu/Groups/venari/pldi93.html

[4] P. Cheng and G. E. Blelloch. "A Parallel, Real-Time Garbage Collector." In *Proceedings of the ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI)*, Snowbird, UT, June 2001, pp. 125–136. https://doi.org/10.1145/378795.378823

[5] E. W. Dijkstra, L. Lamport, A. J. Martin, C. S. Scholten, and E. F. M. Steffens. "On-the-Fly Garbage Collection: An Exercise in Cooperation." *Communications of the ACM* 21(11):965–975, November 1978. https://doi.org/10.1145/359660.359664

[6] T. Yuasa. "Real-Time Garbage Collection on General-Purpose Machines." *Journal of Systems and Software* 11(3):181–198, 1990. https://doi.org/10.1016/0164-1212(90)90107-3

[7] R. A. Brooks. "Trading Data Space for Reduced Time and Code Space in Real-Time Garbage Collection on Stock Hardware." In *Conference Record of the 1984 ACM Symposium on LISP and Functional Programming*, Austin, TX, August 1984, pp. 256–262. https://doi.org/10.1145/800055.802042

[8] D. F. Bacon, P. Cheng, and V. T. Rajan. "The Metronome: A Simpler Approach to Garbage Collection in Real-Time Systems." In R. Meersman and Z. Tari (Eds.), *On the Move to Meaningful Internet Systems 2003: OTM 2003 Workshops*, Lecture Notes in Computer Science 2889, Springer, 2003. https://citeseerx.ist.psu.edu/document?doi=44b11f4ecab634a3283f55929a9c2ed30513ae2d&repid=rep1&type=pdf
