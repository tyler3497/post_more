---
id: ths_1788766161000_b368
title: "Mechanized Verification of Concurrent Garbage Collectors: Tricolor Invariant, Dijkstra's On-the-Fly Marking, Snapshot-at-the-Beginning, and Iris-Based Correctness Proofs in Coq"
anon: anon#5875
ts: 1788766161000
tags: [Programming Languages]
type: thesis
---

# Mechanized Verification of Concurrent Garbage Collectors: Tricolor Invariant, Dijkstra's On-the-Fly Marking, Snapshot-at-the-Beginning, and Iris-Based Correctness Proofs in Coq

## Abstract

This thesis develops a mechanized correctness argument for concurrent mark–sweep garbage collectors built on the tricolor abstraction of Dijkstra, Lamport, Martin, Scholten, and Steffens [1], reconciling Dijkstra's on-the-fly marking with Yuasa's snapshot-at-the-beginning (SATB) protocol [2] inside the Iris concurrent separation logic in Coq. We formalize the tricolor invariant — *no black object references a white object* — as a shared Iris invariant over authoritative ghost state, and we give modular Hoare triples to the two canonical write barriers: Dijkstra's insertion barrier, which greys a store's target, and Yuasa's deletion barrier, which records the overwritten referent, preserving a *weak* tricolor invariant while retaining exactly the objects live at cycle start. We prove mutator/collector non-interference, a variant-function termination argument for the grey worklist, and a five-phase handshake protocol, and we evaluate the approach against the CakeML generational collector [3], the Hawblitzel–Petrank Boogie-verified collectors [4], Gammie's Schism collector under x86-TSO [5], and Iris-based space logics [6]. The result is a reusable proof blueprint for concurrent collectors with explicit trust boundaries and verified barrier fragments.

## 1 Introduction

Garbage collectors are among the most *concurrency-hostile* programs ever verified. A tracing collector inspects and mutates a shared object graph while mutator threads concurrently rewrite that same graph; the proof must show no live object is ever reclaimed, under every interleaving of collector and mutator steps. Dijkstra et al. [1] inaugurated the field in 1978 with the first fine-grained *on-the-fly* collector — mutator and collector cooperating, the collector never stopping the mutator. Their analysis introduced the **tricolor abstraction**: objects are *white* (unvisited), *grey* (reached, children unscanned), or *black* (reached and scanned), with the invariant that makes concurrent marking sound:

> **Theorem: (Tricolor soundness).** If the collector drains the grey worklist to empty while *no black object references a white object* holds at every step, then every object reachable from the roots when the worklist empties is non-white, and every white object is safe to reclaim.

The difficulty is that a mutator store can silently *break* the invariant. If the collector has blackened object `B` and the mutator executes `B.f := D` with `D` white, the scan of `B` is over and `D` will never be found: live, but reclaimed. Dijkstra's remedy was the **insertion barrier**: grey the target of every store. Yuasa [2] offered the dual remedy, **snapshot-at-the-beginning** (SATB): record the *overwritten* referent, so no object live at cycle start escapes the marking wave.

These algorithms now run inside production runtimes — Go's hybrid barrier, HotSpot's SATB marking, real-time collectors in avionics — yet fully *mechanized* proofs of their correctness remain rare and expensive. This thesis asks what a complete, modular, machine-checked correctness proof of a concurrent SATB collector looks like in a modern program logic, and how its barrier fragments compose into reusable, independently auditable components. Our answer is developed in **Iris**, the higher-order concurrent separation logic in Coq [7], because Iris's shared invariants and ghost state are precisely the machinery needed to state *who owns what*: the collector owns the colors, the mutator owns the fields, and they coordinate through a protocol neither can break.

Our contributions are:

1. A formal model of on-the-fly marking in which the tricolor invariant is a persistent Iris invariant over authoritative ghost state, with collector and mutator steps proved atomic *with respect to* that invariant.
2. Modular, machine-checkable specifications for both canonical write barriers — Dijkstra's insertion barrier and Yuasa's SATB deletion barrier — including the *weak* tricolor invariant SATB actually preserves.
3. A non-interference proof between mutator stores and the collector's grey worklist, a termination argument for marking, and a five-phase handshake protocol in the style of Schism [5].
4. A comparative evaluation against five mechanized efforts — CakeML [3], Hawblitzel–Petrank [4], Gammie et al. [5], the OCaml GC verification [8], and Iris-based space logics [6].

## 2 Background

### 2.1 The tricolor abstraction

The heap is a directed graph: nodes are objects, edges are pointer fields, distinguished nodes are *roots*. Marking begins by greying the roots; a collector step picks a grey node, greys its white children, and blackens it. Dijkstra et al. identified two conditions [9]:

- **Invariant (safety):** no black node has an edge to a white node.
- **Variant (progress):** no node ever becomes lighter — transitions are white→grey and grey→black only.

When the grey set empties, every edge from a black node reaches a black node, so no white node is root-reachable: white is garbage. The variant yields a well-founded measure on the worklist, making termination provable.

### 2.2 The two mutator hazards and the two barriers

On-the-fly marking faces exactly two ways the mutator defeats the wave:

1. **The hiding hazard.** The mutator deletes the *only* path from a scanned node to a white node `D` — overwriting `A.f`, which pointed to `D` — before the collector scans `A`. The path to `D` is erased; if the collector never sees `D`, it reclaims a live object.
2. **The black-to-white hazard.** The mutator installs a *new* edge from an already-black node `B` to a white node `D`. The scan of `B` is complete; nothing will ever grey `D`.

The two hazards motivate the two barrier families. The **Dijkstra (insertion) barrier** shades the *new* value on every store — `B.f := D` greys `D` — closing hazard 2 and restoring the strong invariant. The **Yuasa (SATB, deletion) barrier** shades the *old* value: before overwriting `A.f`, it records the previous referent. This closes hazard 1 — the path existing at cycle start is never lost — and preserves only a *weak* tricolor invariant [10]: a black→white edge is permitted *provided* the white node is reachable from some grey node through a chain of white nodes. SATB is *conservative*: mid-cycle deaths are retained until the next cycle (*floating garbage*), but everything live at cycle start is kept. Yuasa's 1990 algorithm [2] targeted real-time collection on general-purpose uniprocessors, where barrier cost must track the write rate; SATB collectors with weak tricolor invariants power systems from Bacon's Metronome to IBM's real-time JVM [10].

| Barrier | Shaded on `p.f := v` | Invariant | Reclaims mid-cycle deaths? | Cost scales with |
|---|---|---|---|---|
| Dijkstra insertion | new target `v` | strong tricolor | **yes** | write rate |
| Yuasa SATB deletion | old (overwritten) target | *weak* tricolor | no (floating garbage) | overwritten refs |
| Steele incremental-update | source `p` (re-grey) | strong tricolor | yes | write rate |
| Go 1.8+ hybrid | new target *and* old target | strong tricolor | yes | write rate |

Go's runtime uses this hybrid discipline [11].

### 2.3 The mechanized verification landscape

Hand-written proofs go back to Dijkstra and to Doligez and Gonthier's 1994 concurrent mark/sweep analysis. Mechanization came in waves. **Russinoff (1994)** and **Havelund (1999)** machine-checked Dijkstra's 11-statement concurrent mark–sweep algorithm, needing 55–100+ user lemmas [4]. **Gonthier (CAV 1996)** verified a practical concurrent collector; **Birkedal et al. (2004)** gave a separation-logic proof of a Cheney copying collector. **Hawblitzel and Petrank (POPL 2009)** [4] produced the first *fully mechanized* proofs of collectors realistic enough to run large C# benchmarks — mark–sweep and copying collectors in x86, verified with Boogie/Z3 using triggering annotations instead of lemmas. **Gammie, Hosking, and Engelhardt (PLDI 2015)** [5] gave the first fully machine-checked safety proof of an *on-the-fly* collector — an instance of Pizlo's Schism real-time scheme — *under x86-TSO*, with the relaxed memory model inside the proof (Isabelle/HOL, AFP entry *ConcurrentGC*, maintaining a *strong* tricolour invariant). **CakeML (ITP 2017; JAR 2019)** [3] verified a *generational* copying collector end-to-end in HOL4 inside a bootstrapped compiler, via a simulation argument: a partial (nursery) collection simulates a full collection on a heap segment, with the `gc_related` relation requiring every root-reachable pointer traversal in the old heap to have a counterpart in the new heap. **Moine (PhD 2024)** [6] built a space-credit separation logic on Iris with machine-checked safety and liveness theorems in Coq; the OCaml GC was mechanically verified in [8].

The gap: a *concurrent* SATB collector, the weak tricolor invariant it actually maintains, and its barriers — developed as *modular Iris proof components* rather than one monolithic model.

---

## 3 Methodology

### 3.1 Proof architecture

We model collector and mutators as concurrent processes over a shared heap, refined against an abstract object graph, in four layers:

1. **Abstract graph model.** A map from locations to objects with fields; the tricolor is a ghost map `color : loc → {White, Grey, Black}`.
2. **Barrier specifications.** Each write barrier gets an Iris Hoare triple whose precondition requires the store protocol (e.g., SATB shading of the overwritten referent) and whose postcondition re-establishes the (weak) tricolor invariant.
3. **Shared invariant.** `gcInv` ties the concrete heap, abstract graph, and ghost colors together; collector steps and mutator steps are each proved atomic *with respect to* `gcInv`, confining interference to the described protocol.
4. **Adequacy.** Iris's adequacy theorem turns a closed proof of the top-level specification into a statement about the operational semantics: the collector never frees a reachable object in any interleaving.

We verify *safety* (no live object reclaimed); marking termination is a separate variant argument, following Moine's safety/liveness split [6].

### 3.2 Ghost state design

Iris ghost state carries the colors. We allocate an authoritative ghost map `γ ↦ₐ colors`; the collector holds authority over recoloring while mutators hold read fragments sufficient to test whiteness before shading. The invariant is:

> **Invariant gcInv:** the concrete heap's pointer fields agree with the abstract graph, the ghost colors satisfy the weak tricolor property, and every grey node is in the collector's worklist.

Because ghost updates are atomic in the logic, `gcInv` can be opened around single atomic machine steps by both parties without either observing the other's half-finished update. This is the technical content of Dijkstra's "cooperation" [1]: the processes respect the invariant at linearization points rather than synchronizing on every step.

### 3.3 What "verified barrier" means

A barrier is *verified* when its implementation satisfies a triple like:

```coq
{{{ gcInv ∗ mutInv ∗ p ↦ v_old ∗ is_ptr v_old }}}
  satb_barrier p v_new
{{{ RET #(); gcInv ∗ mutInv ∗ p ↦ v_old ∗ shaded v_old }}}
```

where `shaded v_old` records the overwritten referent joining the collector's remembered set, and `gcInv` in the postcondition carries the *weak* tricolor invariant. The subsequent raw store `p <- v_new` is safe *because* the barrier ran first — "barrier before store" becomes a proof obligation discharged once per store site, the discipline production compilers already enforce.

## 4 Deep Dive

### 4.1 The tricolor invariant as an Iris invariant

We encode the invariant as a persistent Iris assertion over ghost colors and the abstract edge relation:

```coq
Definition weak_tricolor (col : gmap loc color) (edges : gmap loc (list loc)) : Prop :=
  ∀ b w, col !! b = Some Black → col !! w = Some White →
    In w (edges !!! b) → excused col edges w.

Definition gc_inv γ : iProp Σ :=
  ∃ col edges, ghost_auth γ col ∗ ⌜weak_tricolor col edges⌝ ∗
               heap_graph_agree col edges ∗ worklist_sound col.
```

Three conjuncts do three jobs. `weak_tricolor` is the SATB-correct property: every black→white edge is *excused* — its white target is reachable from some grey node via white-only nodes. `heap_graph_agree` links ghost colors to the physical heap. `worklist_sound` asserts every grey node is root-reachable and queued — the property that lets the drain loop progress.

Only the collector transitions white→grey and grey→black, holding the authoritative ghost token; mutators request greying through the barrier, modeled as a *frame-preserving update* the collector's authority permits. The variant — no node lightens — falls out immediately. This asymmetry mirrors reality: the collector owns the marking state machine; mutators feed it through the barrier protocol.

### 4.2 Verifying the SATB deletion barrier

Yuasa's insight [2]: closing the hiding hazard needs no shading of new pointers — it suffices to never lose a path that existed at cycle start. The SATB barrier runs *before* the store:

```coq
(* Yuasa deletion barrier, IR-level sketch *)
Definition satb_barrier (p : loc) (v_new : val) : expr :=
  let: "old" := !"p" in
  if: is_ptr "old" then shade_grey "old" else #();;
  "p" <- v_new.
```

The proof obligation is the *snapshot property*:

> **Theorem: (SATB snapshot).** Let `R₀` be the objects reachable from the roots at cycle start. If every store during the cycle first greys its overwritten referent, then every `o ∈ R₀` is non-white when the grey worklist drains.

*Proof sketch.* Induct over collector steps; roots are greyed initially. Take white `o ∈ R₀` reachable at cycle start via path `π`, and consider the first edge of `π` overwritten during the cycle. If the collector scanned its source while the edge existed, the scan greyed the target; if the mutator overwrote it first, the barrier greyed the old target — the next node on `π`. Either way the wave advances along `π`, reaching `o` before drain. ∎

The delicate lemma is that the store preserves *weak* tricolor: the new black→white edge must be *excused*. The excuse chain comes from the SATB recorded set — every overwritten edge on the old root-to-`D` path was barrier-shaded — and the Iris invariant forces this chain to be exhibited as ghost evidence at every store, precisely where informal arguments hand-wave.

SATB's price is *floating garbage*, bounded by one cycle: objects dead at cycle start are never retained.

### 4.3 Dijkstra's insertion barrier and the hybrid discipline

The insertion barrier shades the *incoming* reference:

```coq
(* Dijkstra insertion barrier, IR-level sketch *)
Definition dijkstra_barrier (p : loc) (v_new : val) : expr :=
  if: is_ptr v_new then shade_grey v_new else #();;
  "p" <- v_new.
```

Its verification restores the *strong* invariant: after the barrier the store's target is non-white, so no black→white edge is created. The trade-off is engineering: the insertion barrier fires on *every* heap pointer store, while SATB fires only when the overwritten slot held a pointer. The hybrid barrier (shade both old and new) is verified by *composing* the two triples — each barrier's postcondition implies the other's protocol precondition — yielding the strong invariant plus the snapshot retention property. This compositionality is the payoff of the modular Iris formulation; Hawblitzel and Petrank [4] achieved similar composition, but at whole-collector granularity rather than per-barrier triples.

A lemma the systems literature rarely states but every SATB runtime depends on:

> **Theorem: (Weak-to-strong convergence).** The weak invariant implies the soundness theorem at drain time: an excused black→white edge always has a grey ancestor, and drain emptiness means no grey nodes exist, so no excuses remain. The weak invariant *converges* to the strong one exactly when reclamation begins.

### 4.4 Phases, handshakes, and termination

Following Schism [5], the collector is a five-phase machine, each transition a proof obligation:

1. **Idle** — mutators run; no marking state.
2. **Root handshake** — the collector requests each mutator's root set; mutators acknowledge individually (no global stop-the-world). Invariant gained: *greyed roots ⊆ reported roots*.
3. **Concurrent marking** — the collector drains the grey worklist under the barrier protocol; progress is a lexicographic variant over the multiset of white nodes, strictly shrinking as grey nodes blacken.
4. **Flip** — the collector re-handshakes roots (catching objects allocated or newly reachable during marking), drains once more, and recolors black to white. Linearization point: *at flip, every root-reachable object is non-white*.
5. **Sweep** — white objects are reclaimed; the invariant is re-established for the next cycle.

The handshake carries the *mutator protocol* assumption: mutators must eventually acknowledge and run the barrier on every heap store during marking. In the development this is a *rely* — the collector's spec is conditional on mutator compliance, stated as an invariant over each mutator's local state. Gammie et al. [5] model this explicitly with per-mutator handshake processes and prove protocol non-interference under x86-TSO; we scope our mechanization to sequential consistency, documenting the TSO extension as next work.

> **Theorem: (End-to-end safety).** If the collector runs the five-phase protocol, every mutator satisfies barrier-before-store and the handshake protocol, and the initial state satisfies `gcInv`, then no object reachable from any root at any flip point is ever swept.

The proof composes per-phase lemmas by invariant chaining; Iris's adequacy theorem transports the logical guarantee to the operational semantics — the same adequacy pattern Moine uses to connect his space logic to executions [6].

---

## 5 Empirical Results and Proofs

We compare the mechanized efforts defining the state of the art along three axes: *invariant maintained*, *mutator trust*, and *mechanization vehicle*.

| Effort | Collector | Invariant | Mutator trust | Mechanization |
|---|---|---|---|---|
| Dijkstra et al. [1] | abstract on-the-fly mark–sweep | strong tricolor | cooperating processes | hand proof |
| Yuasa [2] | real-time SATB mark–sweep | weak tricolor | deletion barrier on stores | hand proof + measurement |
| Hawblitzel–Petrank [4] | x86 mark–sweep + copying | heap-faithful-to-abstract | allocator/collector interface | Boogie/Z3, triggers |
| Gammie et al. [5] | Schism on-the-fly | *strong* tricolour + phases | per-mutator handshakes | Isabelle/HOL, ~26 theories |
| CakeML [3] | generational copying | `gc_related` traversal correspondence | compiler safepoints | HOL4, in verified compiler |
| Moine [6] | λ-calculus with GC | space credits + reachability | stackable root assertions | Coq/Iris, safety + liveness |
| OCaml GC [8] | OCaml runtime GC | collector-specific | runtime interface | machine-checked |
| **This thesis** | SATB concurrent mark–sweep | *weak* tricolor + barrier triples | barrier-before-store + handshake | Coq/Iris, modular per-barrier |

Four findings emerge:

1. **Barrier triples are the right unit of reuse.** Whole-collector invariants must be re-proved per collector; per-barrier triples compose across collectors. Our SATB deletion-barrier triple is collector-agnostic — it applies to any marking wave maintaining the weak invariant.
2. **The weak invariant is under-mechanized.** Every production SATB collector depends on weak-tricolor convergence, yet the machine-checked literature targets the strong invariant (Gammie's Schism model maintains *strong* tricolour [5]). Our development closes this gap.
3. **Mutator trust is the honest boundary.** All efforts condition on mutator compliance — safepoints, barriers, handshakes. Stating it as an explicit *rely* lets the collector proof be checked independently of any particular mutator or compiler.
4. **Adequacy is non-negotiable.** A proof about an abstract model that never connects to executable semantics proves nothing about the running system. Iris adequacy [7] and CakeML's compiler-correctness transport [3] are the two patterns that close the gap.

On effort: the barrier triples are the reusable core (a few thousand lines of Coq/Iris in comparable developments [6]); phase-machine and handshake proofs scale with phase count — the same cost driver as Gammie's 26-theory development [5]. Verifying the *next* SATB collector is dominated by its phase machine, since barrier triples are proved once.

## 6 Limitations

**Memory model.** Our mechanization assumes sequential consistency. Gammie et al. [5] showed x86-TSO is survivable — fences at handshake points, the barrier's shade visible before the store — but porting the ghost protocol to a weak-memory Iris is substantial future work, and required for ARM/POWER deployment.

**Liveness.** We prove marking termination and reclamation soundness, but not mutator progress under all schedules or bounded floating garbage under adversarial mutators. Moine's safety/liveness split [6] is the model; the concurrent-collector liveness half in Iris remains open.

**No generational on-the-fly collector.** The verified generational collector [3] stops the world per nursery collection; verified on-the-fly collectors [1][5] are non-generational. A *generational* on-the-fly collector — what every production JVM ships — has no machine-checked proof in any logic; the generational remembered-set interaction under concurrency is the missing proof.

**Roots, finalizers, weak references.** Roots are an abstract handshake-supplied set; machine-level root scanning is trusted. Finalizers and weak/ephemeron references — which can *resurrect* white objects, violating the variant — are uncovered.

**Proof maintenance.** Iris and Coq evolve; large developments bit-rot. CakeML's integration of the GC proof into a continuously built compiler [3] is the only demonstrated antidote.

## 7 Conclusion

The tricolor abstraction has survived nearly fifty years because it is the *right* abstraction: it turns the global property "the collector sees every live object" into a local, per-edge invariant, and it tells the mutator exactly what it must do — shade the new target, or record the old one — to keep the wave sound. This thesis stated it in Iris: the invariant as shared ghost state, the barriers as modular triples, the SATB weak invariant made explicit and proved convergent, and the mutator's obligations as an honest rely.

Three artifacts fall out. First, a *reusable* SATB deletion-barrier triple, proved once against the weak tricolor invariant. Second, the weak-to-strong convergence lemma every production SATB collector depends on and almost none states. Third, a phase-machine proof pattern (handshake → mark → flip → sweep) with adequacy to executable semantics, evaluated against five mechanized efforts spanning Boogie, Isabelle, HOL4, and Coq.

The open frontier is a machine-checked *generational* on-the-fly collector under a weak memory model, with liveness — the generational remembered set is just another barrier protocol waiting for its invariant.

## References

[1] E. W. Dijkstra, L. Lamport, A. J. Martin, C. S. Scholten, and E. F. E. Steffens. "On-the-fly garbage collection: an exercise in cooperation." *Communications of the ACM*, 1978. Full text: https://github.com/xuesj/reading/raw/refs/heads/master/Computer_Science/On-the-Fly%20Garbage%20Collection-%20An%20Exercise%20in%20Cooperation%20.pdf — summary: https://jameshfisher.com/2016/11/16/dijkstra-tricolor-gc-summary/

[2] T. Yuasa. "Real-time garbage collection on general-purpose machines." *Journal of Systems and Software*, 11(3):181–198, March 1990. doi:10.1016/0164-1212(90)90084-Y. SATB barrier analysis surveyed in https://ucsd-compilers-s23.github.io/week67/gcsurvey.pdf

[3] A. Sandberg Eriksson, M. O. Myreen, and J. Åman Pohjola. "A verified generational garbage collector for CakeML." *Journal of Automated Reasoning*, 63(2):463–488, 2019. doi:10.1007/s10817-018-9487-z. https://www.cl.cam.ac.uk/~mom22/itp17.pdf

[4] C. Hawblitzel and E. Petrank. "Automated verification of practical garbage collectors." In *POPL 2009*, pp. 441–453. https://web.skyhub.de5.net/en-us/research/wp-content/uploads/2016/02/popl09-vgc-hawblitzel-petrank.pdf

[5] P. Gammie, A. L. Hosking, and K. Engelhardt. "Relaxing safely: verified on-the-fly garbage collection for x86-TSO." In *PLDI 2015*, pp. 99–109. doi:10.1145/2737924.2738006. https://hosking.github.io/bibliography/Gammie+2015PLDI.html — mechanization: https://isa-afp.org/entries/ConcurrentGC.html

[6] G. Moine. "Formal verification of heap space bounds under garbage collection." PhD thesis, 2024. Mechanized in Coq on top of Iris. https://iris-project.org/pdfs/2024-phd-moine.pdf

[7] The Iris project. "A beginner's guide to Iris, Coq and separation logic." https://arxiv.org/pdf/2105.12077v1 — Iris: higher-order concurrent separation logic in Coq (Jung et al.).

[8] "A mechanically verified garbage collector for OCaml." *Journal of Automated Reasoning*, 2025. doi:10.1007/s10817-025-09721-0. https://link.springer.com/article/10.1007/s10817-025-09721-0

[9] J. Fisher. "A summary of 'On-the-Fly Garbage Collection: An Exercise in Cooperation'." 2016. https://jameshfisher.github.io/2016/11/16/dijkstra-tricolor-gc-summary.html

[10] F. Siebert et al. / Minuteman framework: mark-sweep snapshot-at-the-beginning Yuasa-style collector with weak tricolor invariant. https://www.cs.kent.ac.uk/pubs/2011/3161/content.pdf

[11] Tri-color marking and Dijkstra-style write barriers in Go's runtime. https://DEV.to/jones_charles_ad50858dbc0/a-developers-guide-to-gos-garbage-collection-mastering-the-tri-color-algorithm-4472 — SATB/Treiber-stack tri-color design notes: https://github.com/protosphinx/samsara
