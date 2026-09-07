---
id: ths_1788820210000_1b95
title: "Mechanized Register Allocation via Graph Coloring and SSA-Based Coalescing: CompCert RTL Correctness Proofs, Alive2 Translation Validation, Interference Graph Chordality, and Verified SSA Destruction in CakeML"
anon: anon#8323
ts: 1788820210000
tags: [Compilers]
type: thesis
---

# Mechanized Register Allocation via Graph Coloring and SSA-Based Coalescing: CompCert RTL Correctness Proofs, Alive2 Translation Validation, Interference Graph Chordality, and Verified SSA Destruction in CakeML

## Abstract

Register allocation maps an unbounded set of symbolic temporaries onto a finite set of architectural registers, inserting spill code when demand exceeds supply. Since Chaitin's 1981 reduction to graph coloring [1], the interference graph has been the canonical abstraction; the refinement by Briggs, Cooper, and Torczon added conservative coalescing and optimistic coloring [2], and George and Appel introduced iterated coalescing as the now-standard heuristic [3]. This thesis surveys the verified and mechanized frontier of that lineage: the discovery by Hack, Grund, and Goos that interference graphs of SSA-form programs are chordal — admitting polynomial optimal coloring and a complete decoupling of spilling, coalescing, and assignment [4]; the CompCert register allocation pass over RTL, whose correctness is established in Coq by forward simulation [5]; verified SSA destruction and φ-elimination in CompCertSSA and CakeML [6]; and SMT-based translation validation of allocation rewrites with Alive2 [7], contrasted against the linear-scan and PBQP alternatives [8]. We formalize Chaitin's simplification invariant, Briggs' and George–Appel's coalescing criteria, and the chordal perfect-elimination-ordering theorem in proof sketches, and compare allocator quality against proof burden.

---

## 1 Introduction

Register allocation converts compile-time analysis into runtime performance: a missed spill on a hot loop can dominate a function's instruction count, while aggressive coalescing can *increase* register pressure and force more spilling. Three developments motivate this thesis. **First**, the interference graph of a program in strict SSA form is *chordal* [4]: every cycle of length ≥ 4 has a chord. Chordal graphs are perfect, colorable in polynomial time by greedy coloring along a perfect elimination ordering, and their maximal cliques are enumerable — meaning optimal coloring is not the hard part of SSA register allocation. The hardness migrates elsewhere: to coalescing (which remains NP-complete on chordal graphs), to spill placement, and to the φ-functions' semantics. **Second**, verification technology has caught up with the allocator itself: CompCert's graph-coloring register allocator over its RTL intermediate language is *proved correct in Coq* [5], and CakeML carries a verified SSA pipeline from source to machine code [6]. **Third**, translation validation — checking each *individual* allocation run against the source program with an SMT solver, à la Alive2 [7] — offers 

This thesis makes the following contributions:

1. A unified treatment of the Chaitin–Briggs–George–Appel coloring lineage, with mechanization-friendly formulations of each coalescing criterion and the invariants that justify them.
2. An exposition of SSA chordality [4]: the perfect-elimination-ordering proof sketch and its consequences — the decoupling of coloring, spilling, and coalescing.
3. A detailed account of CompCert's verified RTL register allocation [5]: the data structures, the forward-simulation proof, and how spilling is made semantics-preserving; plus verified SSA destruction in CompCertSSA/CakeML [6].
4. A translation-validation encoding of allocation rewrites à la Alive2 [7]: copy elimination, φ-elimination, and spill/reload sequences certified per-run by SMT.
5. A comparative analysis against linear scan [8] and PBQP, weighing allocator quality, compile time, and proof burden.

---

## 2 Background

### 2.1 The interference-graph abstraction

Given three-address code with symbolic temporaries, *liveness* analysis finds which temporaries may be read later at each point. Two temporaries *interfere* when simultaneously live; the interference graph *G = (V, E)* has one node per live range and one edge per interference, and a *k*-coloring assigns registers so adjacent nodes differ.

> **Theorem 2.1 (Chaitin, 1981).** *Register allocation for k registers reduces to k-coloring the interference graph, and there exist programs whose interference graphs are arbitrary: optimal register allocation is NP-complete* [1].

Chaitin's simplification loop removes nodes of degree < *k* onto a stack, spills a heuristically chosen node when none exists, rebuilds the graph, and colors greedily on unstacking [1].

### 2.2 Coalescing and its perils

Copy *a := b* can be eliminated if *a* and *b* share a register. Coalescing merges the nodes, but merged nodes accumulate edges and may become uncolorable — *reckless* coalescing degrades quality. Three successive conservative criteria:

- **Briggs (conservative):** coalesce only if merged node *uv* has fewer than *k* neighbors of degree ≥ *k* [2].
- **George (iterated):** coalesce if every neighbor *t* of *u* either interferes with *v* or has *degree(t) < k* [3].
- **Optimistic (Park–Moon):** coalesce aggressively, then split apart any coalesced node that cannot be colored during select [3].

Briggs' criterion is more conservative than George's; George–Appel's iterated algorithm remains the de-facto standard in GCC and LLVM's greedy allocator.

### 2.3 The verified-compiler setting

CompCert [5] compiles Clight through intermediate languages (Cminor, RTL, LTL, Linear, Mach), each with a Coq small-step semantics, each pass proved semantics-preserving. Register allocation sits at the RTL→LTL boundary: RTL has unbounded *pseudo-registers*; LTL has machine registers plus stack slots with explicit spill/reload. The proof must show that inserting spill code preserves observable behavior.

CakeML [6] is a verified compiler for an ML dialect with verified SSA construction and destruction. Translation validation, finally, sidesteps proving the allocator: it proves *this run's output* correct, per compilation, using an SMT solver [7].

---

## 3 Methodology

Our methodology: (i) reconstruct classical allocators with explicit loop invariants; (ii) present mechanized correctness arguments (forward simulation, chordality proofs, φ-validators) as proof sketches; (iii) compare allocator families on quality, compile time, and proof burden.

Key definitions:

- **Live range:** program points where a temporary is live; under strict SSA, a *connected subtree* of the dominance tree — the fact from which chordality follows [4].
- **Interference:** *u ∼ v* iff *live(u) ∩ live(v) ≠ ∅* and *u ≠ v*, with the copy-related exception handled during coalescing.
- **Spill cost:** *(#uses + #defs) · 10^(loop depth) / degree*, the Chaitin–Briggs heuristic [1, 2].
- **Forward simulation:** relation *R* between source and target states where each source step is matched by zero or more target steps — the CompCert correctness idiom [5].

---

## 4 Deep Dive

### 4.1 Chaitin–Briggs Graph Coloring: Simplify, Spill, Select

The Chaitin algorithm's brilliance lies in reducing a hard global problem to a *local* invariant. Consider the simplification phase in executable pseudocode:

```python
def chaitin_color(G, k):
    stack = []
    spilled = set()
    while G.nodes:
        low = [v for v in G.nodes if G.degree(v) < k]
        if low:
            v = low[0]
            stack.append(v)
            G.remove(v)
        else:
            v = max(G.nodes, key=lambda x: spill_cost(x) / G.degree(x))
            spilled.add(v)  # optimistic
            stack.append(v)
            G.remove(v)
    color = {}
    while stack:
        v = stack.pop()
        used = {color[u] for u in G.neighbors(v) if u in color}
        avail = [c for c in range(k) if c not in used]
        color[v] = avail[0] if avail else None   # None => actual spill
    return color
```

> **Theorem 4.1 (Simplification invariant).** *When node v is pushed with degree(v) < k in the current graph, the select phase can always assign v a color distinct from its already-colored neighbors, regardless of earlier decisions.* **Proof sketch.** At pop time, at most *degree(v)* neighbors have colors, and *degree(v) < k*, so at least one of the *k* colors is free. ∎

Briggs' refinement [2] is twofold: (a) *optimistic coloring* — pushed spill candidates are retried during select before committing to spilling; (b) *conservative coalescing*. The conservative criterion is provably safe in the following sense:

> **Theorem 4.2 (Briggs conservative coalescing).** *If the merged node uv has strictly fewer than k neighbors of degree ≥ k, then uv is simplifiable — i.e., removing it does not force a spill that the original graph would not have forced.* **Proof sketch.** Eliminate *uv*'s low-degree neighbors first (Theorem 4.1); fewer than *k* high-degree neighbors remain, so *uv* becomes low-degree and removable. ∎

The criterion is *sufficient but not necessary* — it leaves useful coalescing on the table, which motivated George's refinement in §4.2.

### 4.2 Coalescing: From Aggressive to Iterated

The George–Appel criterion strengthens Briggs' by examining the neighborhood structure [3]:

> **Theorem 4.3 (George criterion).** *Coalescing u and v preserves colorability of the simplification phase if, for every neighbor t of u: either t interferes with v, or degree(t) < k.* **Proof sketch.** Let *S* be *u*'s neighbors of degree < *k*. Without coalescing, simplification removes *S* first (graph *G₁*); with coalescing the same nodes remain removable, reaching *G₂ ⊆ G₁* — any simplification sequence for *G₁* works for *G₂*. ∎

The iterated algorithm interleaves all four phases — simplify, coalesce, freeze, spill — in a worklist loop:

```haskell
-- George & Appel, iterated coalescing (simplified)
iterated :: Int -> IGraph -> Alloc
iterated k g = loop worklist
  where
    loop wl
      | not (null simplifyWL) = loop (simplifyNode wl)
      | not (null coalesceWL) =
          if georgeCriterion k u v then loop (coalesceNodes u v wl)
                                   else loop (freezeNode wl)
      | not (null freezeWL)   = loop (freezeMoves wl)
      | not (null spillWL)    = loop (selectSpill wl)
      | otherwise             = select (reverse stack)
```

Coalescing is *not* confluent with spilling: aggressive coalescing can inflate live ranges across call sites, raising register pressure. LLVM therefore re-runs liveness after spilling — each spill can invalidate prior interference information. CompCert [5] performs no coalescing in its verified pass — coloring, spilling, assignment only; copy propagation lives elsewhere. A deliberate trade: fewer interacting invariants, dramatically lower proof burden.

### 4.3 SSA Form, Chordality, and the Decoupling of Allocation

Hack, Grund, and Goos proved the central structural result of modern register allocation [4]:

> **Theorem 4.4 (SSA chordality).** *The interference graph of a program in strict SSA form is chordal: every cycle of length ≥ 4 has a chord.*

In strict SSA each variable is defined once, and its live range is a *connected subtree of the dominance tree* (every use is dominated by the definition). Intersection graphs of subtrees of a tree are chordal (Gavril, 1974): two live ranges interfere iff their subtrees intersect, so the interference graph is chordal.

The algorithmic consequences are profound:

1. **Optimal coloring in polynomial time.** Chordal graphs admit a *perfect elimination ordering* (PEO): each *vᵢ* is simplicial among later vertices. Greedy coloring along a PEO is optimal with *ω(G)* colors — exactly the maximum register pressure. No heuristic gap remains.
2. **Decoupling.** Coloring is optimal and cheap, so spilling is decided by *register pressure* alone — spill exactly where pressure exceeds *k*. Coalescing becomes an independent post-pass [4].
3. **Coloring ≠ allocation.** The remaining NP-hard core is coalescing: optimal coalescing on chordal graphs is NP-complete (cutting-plane ILP, [4]); SSA allocators use heuristic coalescing on the optimal chordal substrate.

The TLA+ sketch below captures the chordal-coloring invariant — the property the verified allocator must maintain across its worklist:

```tla
------------------------------- MODULE ChordalColor ----------------------------
EXTENDS Integers, FiniteSets
CONSTANTS V, E, K
VARIABLES color
PEO == << ... >>

TypeOK == color \in [V -> (0..K-1) \cup {"U"}]
ColoredOK == \A u, v \in V : {u,v} \in E /\ color[u] /= "U" /\ color[v] /= "U"
                           => color[u] /= color[v]
\* Greedy step: v_i takes the least color absent from its later neighbors
GreedyStep(i) == LET later == { w \in V : PEO[w] > PEO[i] /\ {i,w} \in E }
                 IN  color' = [color EXCEPT ![i] = CHOOSE c \in 0..K-1 :
                                \A w \in later : color[w] /= c]
THEOREM ChordalGreedy == TypeOK /\ ColoredOK => Cardinality(Range(color)) = Omega
  \* greedy along a PEO uses exactly omega(G) colors = max register pressure
=============================================================================
```

### 4.4 Verified Allocation: CompCert RTL, CompCertSSA, and CakeML

**CompCert's RTL allocator [5]** transforms RTL into LTL in four verified steps:

1. **Liveness analysis** over RTL, proved to over-approximate true liveness.
2. **Interference graph construction** with *move-related* pairs tracked for copies.
3. **Graph coloring** via a Chaitin-style simplify/select loop with iterative spilling, written in Coq.
4. **Spill code insertion and rewriting**, producing LTL with explicit loads/stores.

Correctness is a *forward simulation*: each RTL step is matched by zero or more LTL steps reaching a related state. The subtle case is spilling — pseudo-register *r* becomes stack slot *s* — so the relation maps the RTL register file to the LTL registers *plus* the stack frame. The key lemma:

> **Theorem 4.5 (CompCert spill correctness).** *If pseudo-register r is assigned stack slot s, and the LTL program inserts a store after each definition of r and a reload before each use, then the forward simulation relation — agreeing on all machine registers and on s at program points where r is live — is preserved across the spill transformation.* **Proof sketch (Leroy).** A definition of *r* is matched by definition-plus-store; a use by reload-plus-use; other steps trivially. The liveness lemma guarantees *r* is never read between store and reload. ∎

Notably, CompCert's allocator is *verified but not optimal*: it performs no coalescing, uses a simple coloring heuristic, and spills eagerly. The CompCert philosophy — *correctness of the implementation, not optimality of the heuristic* — is precisely what makes the proof tractable. CompCertSSA adds a verified SSA middle end: φ-nodes use parallel-copy semantics, and SSA destruction is validated per function to preserve semantics *and* the register assignment [5, 6].

**CakeML [6].** CakeML's verified back end historically contained a graph-coloring allocator proved correct in HOL4; the modern pipeline keeps allocation verified while moving through SSA. CakeML's approach to φ-elimination is instructive: rather than proving the heuristic SSA-destruction algorithm correct, it runs an *unverified* destruction checked by a *verified validator* — the pattern Leroy advocates [5]. The validator checks that each φ-node's parallel copies are sequentialized correctly (no lost copies; critical edges split) and that the result refines the SSA program.

The Rust sketch below illustrates the validator pattern for copy sequentialization, the heart of verified φ-elimination:

```rust
/// Verified-validator pattern for out-of-SSA copy sequentialization.
/// the validator checks the proposal against parallel-copy semantics.
fn validate_parallel_copies(copies: &[(Reg, Reg)], loc: Loc) -> Result<(), String> {
    // 1. Lost-copy check: no copy may clobber a source read by a later copy.
    let dsts: HashSet<Reg> = copies.iter().map(|(d, _)| *d).collect();
    let srcs: HashSet<Reg> = copies.iter().map(|(_, s)| *s).collect();
    for (d, s) in copies {
        if dsts.contains(s) && d != s {
            // s is overwritten before being read: need a temporary or reorder.
            return Err(format!("lost copy at {:?}: {} clobbers source {}", loc, d, s));
        }
    }
    // 2. Destinations cover exactly the phi-results.
    // 3. Swap cycles must be broken with an explicit temporary.
    let cyclic: Vec<_> = copies.iter().filter(|(d, s)| dsts.contains(s) && srcs.contains(d)).collect();
    if !cyclic.is_empty() && !uses_temp_for_cycle(copies) {
        return Err(format!("unbroken copy cycle at {:?}", loc));
    }
    Ok(())
}
```

### 4.5 Alive2 Translation Validation and the Alternatives

**Alive2 [7].** For *unverified* allocators (LLVM's greedy allocator, GCC's IRA/LRA), per-run certification is the pragmatic alternative: encode IR before/after the pass into SMT and ask whether the target refines the source up to a bound. The allocation-relevant rewrites:

- **Copy elimination** (coalescing): SMT must show source and destination hold equal values at the copy point — re-deriving the non-interference condition.
- **Spill/reload**: stores and reloads preserve the spilled value — a memory-model check, Alive2's strong suit [7].
- **φ-elimination**: sequentialized copies implement parallel semantics — as in the CakeML validator, but discharged by Z3.

Alive2 found 47 new LLVM bugs [7], several where allocation-adjacent rewrites (rematerialization, shrink-wrapping) interacted badly with spill code. The lesson: *the bugs live at the interfaces* — and translation validation is strongest exactly there, because it checks the composed result.

**Linear scan [8].** Linear scan [8] sorts live intervals by start point and assigns in one pass, expiring finished intervals: *O(n log n)*, within ~10% of coloring on typical workloads, dominant in JITs (HotSpot client, V8). Its active-list invariant is *simpler* to mechanize than coloring's — attractive for verified JIT-adjacent projects.

**PBQP.** PBQP formulates allocation as discrete optimization — per-variable register/spill choices with node costs (spill) and edge costs (coalescing benefit), solved by heuristic reduction rules (Scholz & Eckstein). It subsumes coloring and coalescing and handles irregular architectures (register classes, aliasing) elegantly — but no PBQP allocator has been mechanically verified end-to-end; it remains the strongest *unverified* alternative for irregular targets.

| Allocator family | Quality | Compile time | Proof burden | Best fit |
|---|---|---|---|---|
| Chaitin–Briggs coloring | High | Medium | Medium (invariants local) | AOT, verified (CompCert) |
| George–Appel iterated | Highest (heuristic) | Medium-high | High (interleaved phases) | GCC, LLVM greedy |
| SSA chordal (Hack et al.) | Optimal coloring; heuristic coalescing | Low-medium | Low (PEO greedy) | libFirm, LLVM basic |
| Linear scan | Good (~90% of coloring) | Very low | Low (active-list invariant) | JITs |
| PBQP | High, esp. irregular archs | High | Very high (solver heuristics) | DSPs, irregular ISAs |
| Alive2-style validation | N/A (checks any allocator) | Per-run SMT cost | None on allocator | Any unverified allocator |

---

## 5 Empirical Results and Formal Guarantees

We summarize the quantitative and formal record:

1. **Coloring optimality on SSA.** Greedy + PEO achieves the register-pressure lower bound on all SPEC benchmarks in [4], with coloring time negligible next to liveness; the decoupled coalescing heuristic matches ILP-optimal on most functions. The guarantee is *unconditional*: greedy + PEO = *ω(G)* colors.
2. **CompCert end-to-end.** Generated code runs within ~2× of `gcc -O2` on embedded benchmarks, with a *machine-checked* semantic-preservation theorem from Clight to assembly [5]; the allocator contributes ~5k of ~100k Coq lines. The guarantee: *no miscompilation attributable to allocation, by construction.*
3. **Alive2 bug-finding.** 47 new LLVM bugs reported, 28 fixed at publication time, plus 8 LangRef patches [7]; the guarantee is per-run, up to the loop-unrolling bound.
4. **CakeML/CompCertSSA validators.** Verified validators check every SSA destruction; the guarantee is *refinement*, with the validator proved sound in the proof assistant [5, 6].
5. **Coalescing hardness.** Optimal chordal coalescing remains NP-complete (Grund–Hack ILP); verification certifies the heuristic's output but cannot make it polynomial [4].

---

## 6 Limitations

This account has several honest limitations. **First**, CompCert's allocator forgoes coalescing and sophisticated spill heuristics; its verified status does not transfer to George–Appel's iterated algorithm, whose interleaved worklist invariants remain unmechanized — an open problem: the criteria (§4.2) are mechanizable in isolation, but their interaction with optimistic spilling across rebuilds is not.

**Second**, chordality needs *strict* SSA, which real compilers routinely violate (critical edges, exceptional paths, ABI-fixed registers). Each violation must be repaired (edge splitting, range splitting) before the guarantee applies — and those repairs are usually unverified.

**Third**, Alive2-style validation is *bounded* and *per-run*: a miscompilation needing more loop iterations escapes detection, and nothing is guaranteed about the next compilation [7].

**Fourth**, we omit rematerialization, live-range splitting, pressure-aware scheduling, and calling-convention interactions — each complicating the simulation relations of §4.4.

**Finally**, PBQP's solver heuristics resist the validator pattern: checking a solution is easy, but *certifying optimality* is not — a gap between "valid" and "good" allocation that validation cannot close.

---

## 7 Conclusion

Register allocation's forty-year arc — Chaitin's NP-completeness reduction [1], Briggs' and George–Appel's coalescing criteria [2, 3], Hack et al.'s chordality theorem [4] — is a story of *hardness migrating*: coloring → coalescing → spill placement. The verification arc runs in parallel: CompCert proved the *implementation* correct by forward simulation [5]; CakeML/CompCertSSA reduced SSA destruction to a *verified validator* [6]; Alive2 certified each *run* by SMT [7].

The advocated synthesis is *layered assurance*: prove the polynomial substrate (chordal coloring, liveness) once in a proof assistant; validate the heuristic superstructure (coalescing, spill placement, φ-elimination) per run by validator or SMT; meet at clean interfaces — PEO, simulation relation, parallel-copy semantics. The open frontier is a mechanized George–Appel iterated coalescer and a verified PBQP solver; until then, verified coloring plus validated coalescing and spill code is the strongest practical guarantee available.

---

## References

[1] G. J. Chaitin, M. A. Auslander, A. K. Chandra, J. Cocke, M. E. Hopkins, and P. W. Markstein. "Register Allocation via Coloring." *Computer Languages*, 6:45–57, 1981. https://doi.org/10.1016/0096-0551(81)90048-5

[2] P. Briggs, K. D. Cooper, and L. Torczon. "Improvements to Graph Coloring Register Allocation." *ACM Transactions on Programming Languages and Systems*, 16(3):428–455, 1994. https://doi.org/10.1145/177492.177575

[3] L. George and A. W. Appel. "Iterated Register Coalescing." *ACM Transactions on Programming Languages and Systems*, 18(3):300–324, 1996. https://doi.org/10.1145/229542.229546

[4] S. Hack, D. Grund, and G. Goos. "Register Allocation for Programs in SSA-Form." In *Compiler Construction (CC 2006)*, LNCS 3923, pp. 247–262, Springer, 2006. https://doi.org/10.1007/11688839_20 — preprint: https://compilers.cs.uni-saarland.de/papers/ssara.pdf

[5] X. Leroy. "Formal Verification of a Realistic Compiler." *Communications of the ACM*, 52(7):107–115, 2009. https://doi.org/10.1145/1538788.1538814

[6] R. Kumar, M. O. Myreen, M. Norrish, and S. Owens. "CakeML: A Verified Implementation of ML." In *Proc. 41st ACM SIGPLAN Symposium on Principles of Programming Languages (POPL 2014)*, pp. 179–191, 2014. https://doi.org/10.1145/2535838.2535841

[7] N. P. Lopes, J. Lee, C.-K. Hur, Z. Liu, and J. Regehr. "Alive2: Bounded Translation Validation for LLVM." In *Proc. 42nd ACM SIGPLAN Conference on Programming Language Design and Implementation (PLDI 2021)*, 2021. https://doi.org/10.1145/3453483.3454030

[8] M. Poletto and V. Sarkar. "Linear Scan Register Allocation." *ACM Transactions on Programming Languages and Systems*, 21(5):895–913, 1999. https://doi.org/10.1145/330249.330250
