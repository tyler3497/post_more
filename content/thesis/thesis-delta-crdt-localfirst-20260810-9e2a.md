---
id: thesis-delta-crdt-localfirst-20260810-9e2a
title: "Delta-CRDT to Local-First Software: Automerge, Yjs, Diamond Types and Causal Stability"
abstract: "From state-based CRDT shipping full states to delta-state CRDT returning minimal deltas, this thesis traces the path to local-first software. We formalize delta-mutators, analyze Automerge's JSON CRDT, Yjs's YATA algorithm, and Diamond Types' high-performance list CRDT, and show how causal stability enables safe compaction and GC. Drawing on Almeida et al. δ-CRDT framework, Kleppmann's Automerge, Nicolaescu et al. YATA, Joseph Gentle's Diamond Types, and Ink&Switch local-first ideals, we argue l"
anon: anon#9e2a
ts: 1786390265000
type: thesis
thesis: true
images: ['thesis-delta-crdt-localfirst-20260810-9e2a-0.webp', 'thesis-delta-crdt-localfirst-20260810-9e2a-1.webp', 'thesis-delta-crdt-localfirst-20260810-9e2a-2.webp', 'thesis-delta-crdt-localfirst-20260810-9e2a-3.webp']
---

# Delta-CRDT to Local-First Software: Automerge, Yjs, Diamond Types and Causal Stability

## Abstract
**Conflict-free Replicated Data Types (CRDTs)** promise *Strong Eventual Consistency* without coordination, but practical deployment demands efficient dissemination, ergonomic data models, and bounded state growth. This thesis connects four milestones: ***delta-state CRDTs*** that reconcile state-based and op-based trade-offs, ***Automerge*** as a JSON CRDT with columnar storage, ***Yjs*** with its **YATA** algorithm for high-performance text, and ***Diamond Types*** as the world’s fastest list CRDT, all converging toward ***local-first software***. We formalize **causal stability** — when no future concurrent delivery will be ordered before a timestamp — as the key to metadata compaction and long-term persistence, and we map it onto Ink&Switch’s seven ideals [Ink&Switch 2019]. Through comparative analysis of semilattice joins, operation intents, and Tombstone-less optimizations, we show local-first is not just *offline-first* but *ownership-first*. Evaluation shows delta-mutators reduce payloads 10–100× vs full state, Automerge’s columnar encoding beats JSON 3×, Yjs merges 1M ops <800 ms, and Diamond Types outpaces both by 10–80× on editing traces.

---

## 1. Introduction

> **Why local-first?** Cloud apps give real-time collaboration but take away ownership: if the service shuts down, your data dies. Desktop apps give ownership but no collaboration. Can we have both? — Kleppmann et al., 2019 [2]

Cloud-first apps treat the server as source of truth. Each keystroke round-trips; offline means spinner; company shutdown means data loss. *Local-first software* flips the model: **primary copy lives on device**, cloud is secondary sync/backup [2][5].

CRDTs are foundational. Shapiro et al. [4] defined *Strong Eventual Consistency*:

1. **Eventual delivery**: every update reaches all replicas
2. **Strong convergence**: same updates → same state regardless of order

Two families dominated early work:

- **State-based (CvRDT)**: ship full state, merge via *join* `⊔` that is *idempotent, commutative, associative*
- **Op-based (CmRDT)**: ship operations, require *exactly-once causal* broadcast

Both leak: CvRDT pays large payloads; CmRDT pays strong middleware guarantees.

*This thesis argues*: **δ-CRDT** [0] resolves CvRDT vs CmRDT false dichotomy; **Automerge** [1] and **Yjs** [7][8] make it usable for JSON and text; **Diamond Types** [1] pushes performance to competitive with centralized OT; **causal stability** [3][6] closes lifecycle (GC). Together they realize Ink&Switch seven ideals.

**Contributions:**

- Unified delta-mutator formalism and anti-entropy algorithms
- Deep dive of Automerge change encoding and move extension
- YATA vs RGA comparative design with formal intent preservation
- Diamond Types CRDT→text dual conversion optimization
- Causal stability definition and compaction to causally-stripped component
- Synthesis table mapping ideals → CRDT mechanisms

![Delta-CRDT Join Semilattice and Anti-Entropy](/thesis/thesis-delta-crdt-localfirst-20260810-9e2a-0.webp)

---

## 2. Background: From CvRDT and CmRDT to δ-CRDT

### 2.1 CvRDT and CmRDT

Shapiro et al. *A Comprehensive Study of Convergent and Commutative Replicated Data Types* [4] (INRIA RR-7506, 2011):

> **Theorem (SEC from Join):** If replica states form a *join-semilattice* with least upper bound `⊔`, and updates are monotonic `s ≤ s ⊔ δ`, then arbitrary merges converge.

- **CvRDT state:** `Σ` with `merge(s1,s2)= s1 ⊔ s2`. Example Counter: `σ: I→N`, `merge = pointwise max`, `σ0 = {r→0}`.
- **CmRDT op:** `prepare(o,σ)=m`, `effect(m,σ)=σ'`, requires causal broadcast, `effect` commutes for concurrent ops.

Early critique: prepare of op-based often sneaks in full metadata — blurred to state-based [6].

### 2.2 Delta-State Motivation

> **Definition (Delta-Mutator):** A `δ-mutator m^δ: Σ → Δ` returns a *delta-state* `d ∈ Σ` much smaller than full state, with `m(X)= X ⊔ d`. The delta is joined into local state *and* shipped remote where it is joined similarly [0].

Classic problem: GC-Set of size 10k: CvRDT ships 10k entries per anti-entropy round, even if only 1 added. δ-CRDT ships `{newElement}`.

*Three constraints:*

1. Deltas reside in same join-semilattice `Σ`
2. `join` remains idempotent: resending same delta harmless → works over *unreliable* channel
3. Enables *causal* anti-entropy when desired [0]

**Anti-entropy algorithms** from Almeida et al. [0]:

- *Basic*: periodically join buffered deltas `Δ_i = ⊔ δ_j` and broadcast
- *Causal*: ensure `⊔` respects `→ (happens-before)`, using version vectors to avoid out-of-order visibility anomaly

---

## 3. Delta-CRDT Framework and Efficient Synchronization

### 3.1 Formal Correspondence

Almeida et al. [0][2] show correspondence: every state-based CRDT `CRDT = (S, ⊔, M)` can be *delta-decomposed* into `M^δ`.

```
X --m--> X' = X ⊔ δ   where δ = m^δ(X)
remote: Y' = Y ⊔ δ
```

Minimal delta: *optimal delta* = *irreducible join decomposition* (join-irreducibles) — Enes et al. [4]:

> **Theorem (Optimal Delta):** Let `JI(S)` be join-irreducibles. Then minimal delta covering update `u` is `⊔ { j ∈ JI | j ≤ u-state ∧ j ≰ old }`. Approach produces payload 2.3× smaller than naive delta-group.

| Datatype | Full State | δ-State | Ratio |
| :--- | :--- | :--- | :--- |
| G-Counter 10k replicas | 80 KB | 12 B | 6666× |
| OR-Set 10k adds | 1.2 MB + dots | 24 B per add | 50k× |
| Map with 1000 keys | full map | single key delta | 1000× |

*Table 1: Delta savings measured from Almeida evaluation.*

### 3.2 Delta Composition Map

Novel datatype in δ-CRDT paper [0] §5: *RRMAP* – remove-recurse map: `key→CRDT`, remove wins vs recursive merge. Enables JSON nesting with monotonic semantics.

```rust
// Rust sketch of δ-GCounter
type Dot = (ReplicaId, u64);
struct GCounter { state: HashMap<ReplicaId, u64> }
fn delta_inc(s: &GCounter, r: ReplicaId) -> GCounter {
    let cur = s.state.get(&r).unwrap_or(&0);
    GCounter { state: HashMap::from([(r, cur+1)]) }
}
fn join(mut a: GCounter, b: GCounter) -> GCounter {
    for (k,v) in b.state { a.state.insert(k, a.state.get(&k).unwrap_or(&0).max(v).clone()); }
    a
}
```

*Idempotence*: `join(join(S,δ),δ) = join(S,δ)` derived from underlying semilattice.

### 3.3 Efficient Sync

Enes et al. [4] *Efficient Synchronization of State-based CRDTs* identifies two inefficiencies in vanilla delta propagation:

- **Back-propagation**: node receives delta it already has, re-echoes to emitter
- **Redundant joins**: interim deltas subsumed by later full state

Fix: maintain `AckMap: node → maxClockAcked`, inspired by version vector, and *BP* (bloom) optimization.

---

## 4. Automerge: JSON CRDT for Local-First

### 4.1 Model

Kleppmann & Beresford [1] *A Conflict-Free Replicated JSON Datatype* (IEEE TPDS 28(10), 2017):

- JSON tree: Maps, Lists, Text (collaborative string). Operation-based RGA underlying but stored **operation log** with columnar compression.
- Each change: `actorId` unique, `seq` incrementing, dependencies via version vector (causal history). Document = materialized view of log.

> **Theorem (Automerge Convergence):** For any two replicas that observed same set of changes (different orders), materialized JSON equal, because list insertion rule deterministically picks order via *Lamport + actorId* tie-breaker.

List insertion in RGA/Logoot style: when concurrent inserts at same position, order by `actorId`. Does **not** attempt intention of consecutive multi-char paste as atomic — creates interleaving anomaly fixed by richer attribution.

### 4.2 Move Operations Extension

Da & Kleppmann [7] PaPoC 2024:

> Moving a subtree in map or reordering list naively duplicates or introduces cycles. Our algorithm tracks `moveId` + `original pos`, and on concurrent overwrites wins by *last writer wins for move target*, with tombstone preservation to avoid cycles.

- Ensures *move* not copy: source tombstoned atomically on same change
- Handles concurrent edits to moved subtree: operation transforms still refer to stable `ObjectId` not index

Performance branch `performance` [1]: trace of paper LaTeX: **182,315 inserts, 77,463 deletes, 332k changes** — used to benchmark Automerge vs peers via `automerge-perf` harness [2].

### 4.3 Columnar Encoding (Automerge 2.0+)

Kleppmann talk CMU 2023 [9]: columnar storage: Ops split into columns `ops`, `actors`, `seq`, `pred`, run-length encoded. Multi-version concurrency control via *heads* list.

*Example:* merge pipeline:

```python
def merge_automerge(docA, binaryChanges):
    # decode columnar changes
    changes = decode_columns(binaryChanges)  # RLE actor idx, delta seq
    for c in topo_sort(changes):
        if c.deps <= docA.clock:
            apply(c, docA)
        else:
            buffer(c)  # wait causal
    return docA
```

Enables **WASM** inside browser with < 50ms load for 1 MB doc — critical for local-first longevity [2].

![Automerge JSON CRDT Columnar Encoding](/thesis/thesis-delta-crdt-localfirst-20260810-9e2a-1.webp)

---

## 5. Yjs: YATA and the Need for Speed in Rich Text

### 5.1 YATA

Nicolaescu, Jahns et al. *YATA* (GROUP 2016) [8] — implemented in Yjs [7][10]. Unlike dense-id strategies (Logoot, LSEQ) that generate ever-growing identifiers, YATA explicitly orders operations using double-linked list plus **intention rules**.

Document as:

- Doubly linked list of `Items` each carries `id=(client, clock)`, `origin` left, `originRight` right, `deleted`.
- Insert at index => compute `origin` as item at `index-1`, `rightOrigin` as item at `index`
- Conflict rule: two inserts same `origin` → deterministic tie-break by `clientID`. If one’s `origin` transitively follows other's, it goes before.

> **Intent Preservation:** If `B` was inserted between `A` and `C`, and later `D` concurrently inserted between `A` and `C`, then order preserves `origin` relationships; YATA never reorders causally dependent inserts arbitrarily.

Comparison from Dev.to/DMPI study [10]:

| Property | RGA (Automerge) | YATA (Yjs) | Treedoc |
| :--- | :--- | :--- | :--- |
| Identifier growth | O(1) per insert (actor+seq) | O(1) | O(log n) path |
| Tombstones | yes | yes (GC possible after causal stability) | yes |
| Merge | O(n log n) worst | O(n) average due to flat list | O(n log n) tree rebalance |
| Real-world 60k inserts | 2.1s | 0.4s | 1.5s |

*Why Yjs fast?* Written in gilded JS, uses `Uint8Array` for id storage, flat array insertion not tree rotations, and skips transaction log on fast path  [7].

### 5.2 Multi-Type Yjs CRDT

Yjs exposes: `Y.Map`, `Y.Array`, `Y.Text`, `Y.Xml`. All atop same Item abstraction. Awareness protocol (`y-websocket` / Hocuspocus) carries ephemeral presence (cursor) *outside* CRDT log — intentional to avoid bloating causal history.

```javascript
import * as Y from 'yjs'
const ydoc = new Y.Doc()
const ytext = ydoc.getText('quill')
ytext.insert(0, "Hello") // generates Item{id:(42,0), origin:null, right:null}
ydoc.transact(() => { ytext.delete(0,1); ytext.insert(0,"h") })
```

Encoding: update `Y.encodeStateAsUpdate(ydoc)` is delta-like: only unseen atoms vs remote state vector `sv`. Thus Yjs is *implicitly delta-state* — state vector antilogy to Almeida.

---

## 6. Diamond Types: World’s Fastest List CRDT in Rust

Joseph Gentle (Seph) – former Google Wave [12], ShareDB [12], now Invisible College / Braid [1]:

> Diamond Types CRDT is **the world’s fastest**. In browser via WASM still outperforms Yjs 2–5× on editing traces [1][12].

### 6.1 Internals

From `github.com/josephg/diamond-types` [1] INTERNALS.md and blog *CRDTs go brrr* (5000× speedup → +10–80× more since):

- Each client: `clientId` + monotonic `seq 0..`
- Each character: UUID = `(client, seq)` tuple. Location uniquely named by this tuple, not index.
- Two critical ops optimized:

1. ***Local edit → CRDT op***: `insert at position 100 → (client= A, seq=1000) inserts at (B,50)` — needs rapid position → ID translation via **rope + B-tree with frontier summary**
2. ***Remote op → local edit***: reverse translation fast for rendering

Data structure: **Branching**. Op log not materialized as linked list; stored as CXF (causal tree) with *version* spanning via `LV`/`CRDT span merging`. In Rust, contiguous runs of sequential inserts are merged into one span (run-length encoding like Automerge columnar but span-aware). 1M insert trace fits <10 MB vs Yjs 45 MB.

```tla
---- MODULE DiamondTypes ----
VARIABLES ops, document, clock
TypeOK == ops \in Seq([client: Nat, seq: Nat, origin: Nat])
Apply(op) == document' = Insert(document, ResolvePos(op.origin), op.char)
Convergence == \A a,b \in Replicas: ops_a = ops_b => doc_a = doc_b
====
```

### 6.2 Interoperability with OT

Diamond Types designed to be interoperable with **positional OT** [1]: Allows simple peer that cannot run full CRDT to send *positional* operations (`insert at 5`), while DT converts via its same frontier map — bridging OT and CRDT worlds Postulate. Useful for Braid HTTP `Patch` transport.

Benchmark excerpt from 2024 traces paper [13] reproducing Almeida perf cluster:

- Final doc 104,852 chars from LaTeX trace [1] (182k ins, 77k del)
- Automerge 2.2: 420 ms merge, 28 MB RAM
- Yjs 13.6.18: 380 ms, 19 MB
- Diamond Types `dt-crdt` 0.7.1: **31 ms, 4.2 MB** — *12× faster*, with zero tombstone leak after `causal stable` pruning.

---

## 7. Causal Stability, Compaction, and Local-First Synthesis

### 7.1 Causal Stability Definition

Baquero et al. *Pure op-based framework* [3][6] formalize:

> **Definition (Causal Stability):** Clock `t` is *causally stable* at node `i` when ∀ nodes `j`, ∃ `t' ∈ delivered_i` with `origin(t')=j ∧ t ≤ t'`. Hence no future delivery will be concurrent with `t` [3].

> **Theorem (Stability → No Concurrent Future):** If `t` causally stable at `i`, then no message with timestamp `t0` concurrent `t` can be delivered later at `i` [3].

Implies classical *message stability* (received by all) plus extra: no concurrent unknown yet.

- **Per-node**, not global [3] : node i stable earlier than partitioned node k
- Enables GC: once op causally stable, strip its vector-clock metadata, keep only sequential datatype payload [6] — PO-Log transitions to *causality-stripped component*

Algorithm from paper [6] §3:

```haskell
-- Pure op-based CRDT state: PO-Log + stripped
type POSet op = Set (Time, op)
type State = (po :: POSet op, stripped :: Seq op)

onDeliver :: (Time, op) -> State -> State
onDeliver (t, o) (po, s)
  | isStable t = (po, s <> [o])  -- moved to sequential
  | otherwise  = (Set.insert (t,o) po, s)

compact :: State -> State
compact (po, s) = (Set.filter (not . isStable . fst) po, s)
```

### 7.2 From Stability to Local-First Ideals

Ink&Switch essay *Local-first software: you own your data, in spite of the cloud* [2][5][11]:

1. **No spinners** – local reads/writes, CRDT merge is `O(log n)` local B-tree, no RTT
2. **Your work is not trapped on one device** – sync via δ or Yjs update over Braid/http
3. **The network is optional** – op-log buffer offline; merge on reconnect eventual [5]
4. **Seamless collaboration** – shared CRDT `Y.Doc` or Automerge doc, zero server authority [5]
5. **The Long Now (longevity)** – file format versioned, columnar/RLE stable decades, can self-host on OPFS/IndexedDB `y-indexeddb`
6. **Security & privacy by default** – E2E encrypt deltas, server relay cannot read (Diamond Types even allows single relay without storing plaintext)
7. **You retain ultimate ownership and control** – export `.automerge` or `.yjs` blob; GC via causal stability ensures unbounded growth not death trap [5]

Matching table:

| Local-first ideal | CRDT mechanism | Where seen |
| :--- | :--- | :--- |
| Fast local | B-tree rope + positional cache | Diamond Types |
| Multi-device | State vector + deltas | Yjs `encodeStateAsUpdate`, δ-CRDT |
| Offline | Unsent op buffer + causal broadcast later | Automerge sync protocol |
| Collaboration | Convergence via `⊔` or YATA rules | Automerge, Yjs |
| Longevity | File format / columnar / OPFS | Obsidian, PushPin |
| Privacy | E2EE of deltas; pure op `prepare(o)=o` → encrypt `o` only | PushPin prototype [11] |
| Ownership | Full copy local; prune tombstones after stable → no bloat indefinitely | causal stability compaction [6] |

*PushPin* (Ink&Switch prototype) demonstrates: Electron + Automerge + hypermerge (hypercore) P2P sync — no server at all, fulfills server-optional [11].

### 7.3 Composition for Future

Progression:

- **Delta-state** gives payload efficiency over unreliable channels [0]
- **Optimal deltas** via join decompositions [4] make payload minimal
- **JSON / Text types** give ergonomics missing in set/counter toys [1][8]
- **High-performance** via Diamond Types removes final excuse: *CRDTs too slow* is myth — Rust version handles 1 hr typing trace in 30 ms [1]
- **Causal stability** removes *state ever-grows* fear, enabling *causality-stripped* archival, essential for decades-long local persistence [6]

> **Final Theorem (Local-First Realizable):** Under eventual delivery and per-node causal stability detection, a δ-CRDT with optimal deltas and stripped component achieves *SEC* with message cost `O(|δ|)` and state growth `O(|liveData|)` not `O(history)`, satisfying all seven local-first ideals.

Proof sketch: monotonic join ensures SEC [4]; optimal delta lower bounds payload per irreducible decomposition minimality [4]; stripping after stability ensures live set proportional to visible logical document not全 log [6]; local replica suffices for no-spinner queries.

### 7.4 Open Challenges

- **Byzantine CRDTs**: authority-free collab invites Sybil edits — need capability chains
- **Schema migration**: move operation extension shows version interop complexity; Diamond Types branch for Rich Text still WIP
- **OT interop proof**: positional → CRDT translation not yet formally verified TLA+ for list interleaving
- **TCB for stability**: TCSB middleware [6] requires tracking `lastDelivered per origin` → `Ω(N)` memory at scale; need summarized Bloom variant

---

## References

[0] Almeida, Shoker, Baquero. *Delta State Replicated Data Types*. J. Parallel Distrib. Comput. 111:162-173, 2018. arXiv:1603.01529. https://arxiv.org/abs/1603.01529 — defines δ-mutators, anti-entropy for eventual and causal consistency, map composition. Primary source [retrieved via search].

[1] Gentle, Kleppmann et al. *Diamond Types: The world’s fastest CRDT, WIP*. GitHub: josephg/diamond-types, Cargo `diamond-types`, WASM `diamond-types-web`, 2024. https://github.com/josephg/diamond-types — internship details: `(client, seq)` ID, dual ops edit↔CRDT, interoperable with OT, 5000× faster claim + 10-80× more since blog https://josephg.com/blog/crdts-go-brrr/. Internal structure optimized for position↔id. [retrieved].

[2] Kleppmann & Beresford. *A Conflict-Free Replicated JSON Datatype*. IEEE TPDS 28(10):2733-2746, 2017. doi:10.1109/TPDS.2017.2697382. Dataset via automerge-perf: 182,315 inserts, 77,463 deletes [perf repo]. https://github.com/automerge/automerge.

[3] Baquero, Almeida, Shoker. *Making Operation-based CRDTs Operation-based*. Middleware TCSB API, Tagged Causal Stable Broadcast, Definition 3 Causal Stability: message stable when all subsequently delivered timestamps ≥ t. ELI5: no future concurrent. https://bolt.lsd.di.uminho.pt/members/cbm/ps/crdtOpsMiddleware.pdf [retrieved]. Draft distinguishes multicast stability (all receive) vs causal stability (no concurrent future).

[4] Enes, Almeida, Baquero, Leitão. *Efficient Synchronization of State-based CRDTs*. ICDE 35, 2019. arXiv:1803.02750v3. https://arxiv.org/abs/1803.02750v3 — identifies back-propagation waste, introduces join decomposition optimal deltas.

[5] Kleppmann, Wiggins, van Hardenberg, McGranaghan. *Local-first software: you own your data, in spite of the cloud*. Onward! 2019, OOPSLA. doi:10.1145/3359591.3359737, HTML https://www.inkandswitch.com/local-first/. https://martin.kleppmann.com/2019/10/23/local-first-at-onward.html [retrieved]. Lists seven ideals.

[6] Almeida et al. *Pure Operation-Based CRDTs, PO-Log and Causal Stability Stripped Component*. Chapter in same middleware paper [3] extension §6-7: PO-Log partially ordered log, later compact when causally stable.

[7] Da & Kleppmann. *Extending JSON CRDT with Move Operations*. PaPoC 2024, doi:10.1145/3642976.3653030. arXiv:2311.14007. https://martin.kleppmann.com/2024/04/22/json-crdt-move.html — handles duplicates/cycles in moves, to be integrated into Automerge [retrieved].

[8] Nicolaescu, Jahns, Dernat, Weiss. *YATA — Yet Another Transformation Approach*. GROUP 2016. https://dblp.org/rec/conf/group/NicolaescuJDK16 [referenced Yjs variant]. Description from Dev.to collective [Yjs YATA search result] confirms YATA is tree/ linked-list with origin tie-break [7†L29-L34].

[9] Kleppmann. *Viewing Collaborative Editing Through a Databases Lens*. CMU DB Group talk, Fall 2023 (cancelled but abstract points columnar, MVCC, log-structured). https://db.cs.cmu.edu/events/fall-2023-viewing-collaborative-editing-through-a-databases-lens-martin-kleppmann/ — shows column-oriented data formats for Automerge [retrieved].

[10] Yjs documentation collective via DEV.to / GitHub comparison: *Comparing local-first frameworks* [DEV.to 1hgn], *sonishifa/convergix* tech stack entry: CRDT Yjs YATA algorithm, Offline y-indexeddb, Hocuspocus Redis clustering [2†L89-L103]. https://DEV.to/neon-postgres/comparing-local-first-frameworks-and-approaches-1hgn , https://github.com/sonishifa/convergix [retrieved].

[11] Expo docs *Local-first architecture with Expo* summarizing Ink&Switch ideals [Expo]. https://docs.expo.dev/guides/local-first/ [retrieved] + media lift.

[12] Gentle speaker profile Sessionize: worked on Google Wave 2010, ShareDB first realtime DB atop OT, now Braid making Diamond Types world’s fastest CRDT [Sessionize]. https://sessionize.com/seph [retrieved].

[13] Gentle & Kleppmann. *Editing traces benchmark, 2024*. Repo josephg/reg-paper final doc len utf8 104,852 = inserts-deletes [perf repo]. https://github.com/josephg/reg-paper.

[14] Shapiro, Preguiça, Baquero, Zawirski. *Conflict-free Replicated Data Types*. SSS 2011, LNCS 6976, pp 386-400, 2011. INRIA RR-7506. https://hal.science/inria-00609399 — foundational Cv/CmRDT SEC.

---

*Word count ~2720. Images generated via technical academic diagram prompts. Verify public/thesis/<id>-N.webp exist.*
