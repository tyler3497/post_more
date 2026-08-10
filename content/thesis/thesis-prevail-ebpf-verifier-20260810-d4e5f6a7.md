---
id: thesis-prevail-ebpf-verifier-20260810-d4e5f6a7
title: "PREVAIL: A Formal Abstract Interpretation Framework for eBPF Verification with Precise Memory Domain Tracking, Control-Flow Graph Pruning, and Interval-OCT Concurrency Safety"
ts: 1786372206668
anon: anon#3403
type: thesis
thesis: true
topic: prevail ebpf verifier
abstract: "The Linux eBPF verifier validates untrusted bytecode via path-sensitive abstract interpretation but suffers exponential state explosion and unsound interval refinements. PREVAIL re-architects verification as a polynomial-time abstract interpreter with configurable numeric domains (Interval, Zone, Octagon, Polyhedra), region-partitioned memory alias tracking, and aggressive CFG dead-code pruning. We formalize its lattice hierarchy, Galois connections, and widening-fixed-point engine, and prove so"
images: ['/thesis/thesis-prevail-ebpf-verifier-20260810-d4e5f6a7-0.webp', '/thesis/thesis-prevail-ebpf-verifier-20260810-d4e5f6a7-1.webp', '/thesis/thesis-prevail-ebpf-verifier-20260810-d4e5f6a7-2.webp', '/thesis/thesis-prevail-ebpf-verifier-20260810-d4e5f6a7-3.webp']
---

# PREVAIL: A Formal Abstract Interpretation Framework for eBPF Verification with Precise Memory Domain Tracking, Control-Flow Graph Pruning, and Interval-OCT Concurrency Safety

## Abstract
The Linux kernel eBPF verifier validates untrusted bytecode via path-sensitive abstract interpretation but suffers from exponential state explosion and unsound interval refinements. PREVAIL introduces a polynomial-time alternative grounded in classical abstract interpretation with configurable numeric domains, precise memory region abstraction, and aggressive control-flow graph pruning. We present its lattice-theoretic foundations, fixed-point engine, and safety proofs for memory isolation, resource leak freedom, and concurrency-safe map access. Evaluation on 1,200+ real-world programs shows equivalence to the kernel verifier with 2–4× lower verification time and soundness over tnum and interval domains.

## 1 Introduction

Extended BPF (eBPF) enables safe execution of untrusted code inside the Linux kernel for networking, tracing, and security [2][3]. Every program must be statically proven safe by an in-kernel verifier that simulates all feasible paths, tracking register types, stack bounds, and map state. While effective, the kernel verifier is **exponential in pathological cases**, uses ad-hoc abstract operators without formal soundness proofs, and has been the source of *over 40 CVEs* between 2017–2023 due to latent unsoundness in value tracking [2][6].

PREVAIL (Polynomial-Runtime eBPF Verifier using an Abstract Interpretation Layer) re-architects verification as a proper abstract interpreter [1][5]. Originally published at PLDI 2019 by Gershuni et al. [6], PREVAIL achieves:

1.  **Polynomial runtime** via widening-accelerated fixed-point over CFG in stratified order.
2.  **Pluggable abstract domains** — Interval, Zone, Octagon, Polyhedra — selectable by precision/cost tradeoff.
3.  **Formal memory model** that partitions eBPF accessible memory into disjoint regions.

This thesis formalizes PREVAIL's abstract interpretation framework, detailing its memory domain, CFG reconstruction, numeric domain hierarchy, and map concurrency reasoning.

> Theorem: PREVAIL's abstract semantics over-approximates the concrete collecting semantics of eBPF ISA; if abstract verification succeeds, no concrete execution violates memory safety.

## 2 Background (eBPF ISA, Linux verifier challenges, abstract interpretation lattices)

### 2.1 eBPF ISA

eBPF ISA is a 64-bit RISC ISA with 11 registers `R0–R10`, where `R10` is a read-only frame pointer to a 512-byte stack. Instructions are 64-bit wide: 8-bit opcode, 4-bit dst/src, 16-bit offset, 32-bit immediate [7][2]. Classes include `LD/ST`, `ALU/ALU64`, `JMP`, `CALL` helper.

Memory access is restricted: direct stack access `R10 + off`, map value via `map_lookup`, packet/context via `PTR_TO_CTX` with runtime bounds checks. Uninitialized read, out-of-bounds write, or pointer leak must be rejected [4][5].

### 2.2 Linux Verifier Challenges

The Linux verifier performs two phases [4][2]:

- **Phase 1 DAG check:** depth-first search to disallow unbounded loops (until 5.3 introduced bounded loops up to 1M instructions [2]).
- **Phase 2 simulation:** abstract interpretation over 5 numeric domains: `u64`, `u32`, `s64`, `s32`, `tnum` (tri-state bitvector: each bit ∈ {0,1,unknown}) [3][5].

Problems documented in CVE analysis and verified sandboxing studies [6]:

- *State explosion:* path enumeration up to 2^N branches without pruning.
- *Unsound refinements:* non-modular interaction between `tnum` and interval via shared refinement operator ρ; abstract operators unsound in isolation [8].
- *No formal spec:* abstraction `α` and concretization `γ` never formalized, delaying proofs [3].

### 2.3 Abstract Interpretation Lattices

Abstract interpretation approximates concrete semantics `C = (℘(Σ), ⊆)` by abstract lattice `A = (A, ⊑, ⊔, ⊓, ⊥, ⊤)` with Galois connection `℘(Σ) ⇄ A` :

- `α : ℘(Σ) → A`, `γ : A → ℘(Σ)` with `α(S) ⊑ a ⇔ S ⊆ γ(a)`
- Widening `∇` ensures finite convergence of `lfp F`

Numeric domains hierarchy for eBPF [5][6]:

| Domain | Constraints | Complexity | Relational? |
| :--- | :--- | :--- | :--- |
| Parity | x mod 2 = c | O(n) | No |
| Interval | ±x ≤ c | O(n) | No |
| Zone | x_i - x_j ≤ c | O(n²) | Yes |
| Octagon | ±x_i ± x_j ≤ c | O(n²) | Yes |
| Polyhedra | Σ a_i x_i ≤ c | Exponential | Yes |

PREVAIL selects Zone-split normal form (Zonecrab) by default, optionally Octagon via Elina, achieving precision equal to kernel verifier on Cilium and Linux selftests with polynomial cost [1][6].

---

## 3 Methodology (PREVAIL architecture, abstract domains, fixed-point)

PREVAIL pipeline [1][5]:

1.  **ELF loader:** extracts `.text` from `bpf_object`, decodes to internal IR.
2.  **CFG reconstruction:** resolves jump targets, splits basic blocks, detects calls `CALL imm`, eliminates dead code, topological sort.
3.  **Abstract pass:** forward analysis with worklist, computing invariants `Inv : Label → AbsState`.
4.  **Safety check:** at each `LD/ST`, assert offset ∈ bounds and alignment valid in memory domain.

### 3.1 Abstract State

```c
typedef struct abstract_state {
  reg_state regs[11]; // type ∈ {UNINIT, SCALAR, PTR_TO_STACK, PTR_TO_MAP_VALUE, PTR_TO_CTX...}
  stack_state stack[512];
  num_domain *num; // interval/zone/octagon abstraction over 32 vars
  mem_region *regions; // map id → region id
  lock_state spinlock; // held ∈ {NONE, ONE}
} absor_t;
```

`num_domain` uses Crab library interface: Crab-Zone sparse DBM representation, Elina Octagon [5]. Join `⊔` is componentwise: register type join, numeric domain join, memory join via disjoint union.

### 3.2 Fixed-Point Engine

```rust
fn analyze(cfg: &Cfg, dom: &dyn NumericalDomain) -> Result<Invariants, Abort> {
    let mut inv = Invariants::new(cfg);
    let mut worklist = VecDeque::from([cfg.entry()]);
    while let Some(bb) = worklist.pop_front() {
        let pre = inv.join_preds(bb);
        let post = transfer(bb, &pre, dom)?; // abstract semantics
        if !inv[bb].leq(&post) {
            let widened = inv[bb].widen(&post); // ∇ after 2 iterations
            inv[bb] = widened;
            for succ in cfg.succ(bb) { worklist.push_back(succ); }
        }
    }
    Ok(inv)
}
```

Transfer function `S♯ : Stmt → (A → A)` soundness:

> Theorem: For all concrete states `c ∈ γ(a)`, if `c → c'` via stmt `s`, then `c' ∈ γ(S♯(s)(a))`.

Implemented via abstract operators for `ADD64`, `SUB`, `AND`, `LSH`, etc., evaluated in interval + tnum product with *sound reduction* `ρ1, ρ2` [3]. PREVAIL's Coq proof for tnum [7][8] shows earlier Linux operators violated this; patched operators now upstreamed.

### 3.3 Tooling Integration

CLI: `prevail sample.o 2/1` returns `1,0.009812,4132` pass/fail, time, RSS [1]. Flags `--dot cfg.dot` exports CFG, `-v` dumps invariants per PC.

---

## 4 Deep Dive

### 4.1 Memory Domain and Alias Tracking

eBPF memory is *region-partitioned*: stack, packet, map values, context. PREVAIL defines region map `R : Ptr → ℘(RegionId)` :

- `R(R10)` = `{Stack}` always
- `R(R1)` initial = `{Ctx}`
- On `map_lookup(map, key) → R0`, `R(R0)` = `{MapValue(map)}` if non-null else `{Null}`

Alias analysis uses *offset abstraction*: pointer = base + offset where offset is tracked as interval `[l,u]` plus tnum mask `value & mask`. Memory safety requires:

```python
def check_mem_access(ptr_reg, access_size, region_bounds):
    offset_interval = ptr_reg.offset.interval  # [l, u]
    for l in range(offset_interval.lb, offset_interval.ub+1):
        if not region_bounds.contains(l, l+access_size-1):
            return VerificationFailure(f"potential OOB {l}")
    if access_size % ptr_reg.align != 0:
        return VerificationFailure("unaligned")
    return OK
```

Stack slot liveness tracks *precision* of uninitialized reads: each 8-byte slot marked `DEFINED` or `UNINIT` with byte granularity. Previous kernel bugs leaked stack via uninitialized `bpf_stack` reuse; PREVAIL proves no `UNINIT` flows to helper arg or map.

TLA+ spec for memory isolation:

```tla
---- MODULE EBPFMemory ----
VARIABLES regs, mem
IsSafeRead(r) == regs[r].type \in {PTR_TO_STACK, PTR_TO_MAP, PTR_TO_CTX}
               /\ regs[r].offset \in Bounds(regs[r].region)
TypeInvariant == \A r \in 0..10 : regs[r].type /= UNINIT => IsSafeRead(r)
====
```

### 4.2 CFG Reconstruction and Dead Code Pruning

Linux verifier's Phase 1 performs modified DFS that marks instructions unreachable if not visited. PREVAIL improves this by:

- **Function partition:** detect `CALL -imm` targets statically; split sequence into functions `func0, func1...` [6]
- **Backedge detection:** using `insn_stack` and `insn_status` arrays, reject irreducible loops unless bounded by constant ≤ 1M unroll bound (5.2+ semantics).
- **Dead-code elimination:** after CFG build, prune blocks not post-dominated by `exit`, reducing abstract state count by *14-31%* in Cilium L4LB [6].

Example transformation:

```c
// before
0: r3 += 1
1: if r0 < r1 goto +1
2: call +5      // func1 @ 8
3: goto L2
4: r4 += 2      // dead if never jumped?
5: r4 += r3
6: r0 = r4
7: exit
8: r2 += r3 ... // func1

// after partition + prune
func0: {bb0: 0-1, bb1: 2, bb2:3->6}
func1: {bb3: 8..}
edge: bb0 -> bb1, bb2
```

This prevents PREVAIL from analyzing Linux-specific inline assembly workarounds that embed invalid jumps (observed in Cilium `bpf_lxc.o` when compiled with `-mcpu=v3`) [6].

### 4.3 Interval and Octagon Domains for Register Bounds

Interval domain `Interval ::= [l,u]` with `l,u ∈ ℤ ∪ {−∞, +∞}` models `u64` arithmetic via modular wrap for ALU64 semantics. Transfer for `ADD`:

```
[l1,u1] + [l2,u2] = [l1+l2 mod 2^64, u1+u2 mod 2^64] ⊔ wrapping handled via tnum
```

Octagon domain `Oct ::= ±x_i ± x_j ≤ c` preserves correlation critical for packet bounds checks:

```c
// Typical XDP pattern:
r2 = *(u32*)(r1 + data);
r3 = *(u32*)(r1 + data_end);
r4 = r3 - r2;
if r4 < 14 goto drop;
r5 = r1 + 14; // must prove r5 ≤ data_end
```

- Interval alone loses `r3 - r2 ≥ 0` relation after branch, fails to prove `r2+14 ≤ r3`.
- Octagon retains `r2 - r3 ≤ -14` inferred from `JSGE` guard, allowing `r5` proof [5][6].

Benchmark PLDI 2019 Fig 9-10: *Interval*: 0.01s, 4MB; *Zonecrab*: 0.03s, 12MB; *Octelina*: 0.12s, 85MB; *Polyelina*: >10s timeout on 7/20 samples. Thus Zone is sweet spot [1].

> Theorem: Reduced product of Interval × Tnum with sound refinement ρ is sound; intermediate unsound operators without ρ closure break Theorem; PREVAIL patches enforce closure.

### 4.4 Safety Properties: Memory Access, Resource Leak, Information Flow

PREVAIL checks four properties encoded as abstract guards:

- **Memory Safety:** for each `LDX/STX`, `ptr + off ∈ [region.base, region.base+size-sizeof(access)]` and `off mod align = 0`. Proven via interval containment as above [4].

- **Resource (Spinlock) Leak:** `spinlock_state ∈ {UNLOCKED, LOCKED(region)}` lattice of height 2. Transfer:

    1. `bpf_spin_lock(R)`: requires UNLOCKED, `R` = `PTR_TO_MAP_VALUE` containing `bpf_spin_lock` at offset 0; new = LOCKED(R)
    2. `bpf_spin_unlock(R)`: requires LOCKED(R)
    3. At exit, requires UNLOCKED else fail: avoids deadlock as Linux checklist `R held only once` [2][6].

- **Information Leak:** prohibits `PTR_TO_MAP_VALUE` → `SCALAR` conversion via `R1+R1` trick, or `R0 = R1 & kernel_addr` leak path. Type lattice join: `PTR ⊔ PTR = SCALAR` unless same base → ensures pointer arithmetic that could leak kernel address becomes unreadable scalar only if arithmetic valid but non-leak.

- **Termination:** ensures no backedge without decreasing rank function (interval bounded loop counter) — implements kernel's bounded loop verification 5.3+ where loop count provably ≤ `2^32`.

### 4.5 Concurrency and BPF MAP Reasoning

Maps are shared state between eBPF progs and userspace via `BPF_MAP_CREATE`, `BPF_MAP_LOOKUP/UPDATE/DELETE` [6][7].

Concurrency challenges [7][8]:

- `BPF_MAP_TYPE_HASH` *non-LRU* map requires explicit deletion else entry leak; size bound enforced at creation time; `BPF_F_NO_PREALLOC` flag yields unbounded memory if oversized — verifier must enforce max_entries checked statically.

- `bpf_spin_lock` inside map value protects *that value only*; cannot protect entire map. Abstract domain models lock per map value region:

| Map Type | Prealloc | Concurrency Primitive | Verifier Obligation |
| :--- | :--- | :--- | :--- |
| ARRAY | yes | per-CPU or spinlock | bounds check key < max_entries |
| HASH | optional | XADD, spinlock | key struct safe |
| PERCPU_HASH | yes | no cross-CPU sync | this-cpu only |
| LRU_HASH | yes | eviction unsound | assume leak possible |
| RINGBUF | reserved | single-writer | reserve/submit pairing |

For map `HASH_OF_MAPS`, PREVAIL tracks *nested region hierarchy*:

```python
# Python pseudo for concurrency-safe map update effects
def abstract_map_update(map_fd, key_abs, val_abs, flags):
    if map_fd.type == BPF_MAP_TYPE_HASH_OF_MAPS:
        inner_map_v = key_abs.inner_map_id
        # Must prove inner_map created by same prog, else infoflow leak
        assert val_abs.region != CTX
        # If flags has BPF_F_LOCK, enforce lock held
        if flags & BPF_F_LOCK:
            assert current_lock.held_for(map_fd.value_region)
    return ok
```

Atomic `BPF_XADD *(u32*)(R1+off) += R2` allowed only if offset proven inside map value and lock-free; hardware sync still costs performance but avoids sleep.

Finally, `TAIL_CALL` via `BPF_MAP_TYPE_PROG_ARRAY` preserves verifier state: all `R6-R9` callee-saved, `R0` reset; PREVAIL function summary ensures map `prog_array` type checked recursively to avoid infinite tail-call chain (kernel limit 33 chained tail calls).

---

## 5 Empirical Evaluation / Proofs

Evaluation reproduced from PLDI 2019 [1][6] and verifier-of-verifier CAV 2023 [3]:

1.  **Precision:** On upstream Linux tests `tools/testing/selftests/bpf` (782 progs) + Cilium `bpf_lxc`, `bpf_netdev` (112 progs), PREVAIL acceptance rate:
    - Interval domain: 745/782 (95.2%)
    - Zonecrab (default): 778/782 (99.5%), matches kernel verifier `778/782` (same 4 rejections due to *precise* stricter alignment checks, not false negatives).
    - Octagon: 780/782 (slight improvement) costing 4× memory.

2.  **Performance:** On Cilium L4LB sample (`~18k insn` after loop unroll bound 16), Linux verifier 1.7s in-kernel, PREVAIL Zonecrab 0.21s user-space, Prevail-rust 0.18s [1][6]. Avoids exponential blow-up seen in `complexity1` test where kernel verifier 12.3s vs PREVAIL 0.04s.

3.  **Soundness Proof Mechanization:**

    - Coq formalization extends Linux eBPF operational semantics [7] with `tnum` model: `γ(tnum) = {v | (v & ~mask) == value}`. Operation-level lemmas prove `ADD/SUB/AND/OR` abstract operators over-approximate concrete set [8]. This discovered latent unsoundness in kernel `scalar_min_max_or` where `s32` interval refinement bypassed `u32` constraints pre-5.9.
    - Verification condition generation: SMACK/SeaHorn-style C→LLVM-IR→BV theory [3]; queries solved via Z3 bitvector. Checks 16 kernel versions 4.14–5.19; proves 5.19 range tracking sound (after patches), finds 9 bugs in older kernels.

> Theorem: PREVAIL with Zone domain is sound and complete w.r.t. Linux verifier acceptance on loop-free programs without `PTR_TO_PACKET` overlapping packet rewrite edge case.

*Proof Sketch:* Induction over fixed-point iteration: base ⊥ = unsafe? No; each transfer sound per Theorem 3.2; join sound by lattice over-approximation; widening finite because intervals of form `[-∞,∞]` eventually stabilizes after 2 iterations due to limited eBPF arithmetic. Failure preservation: if concrete execution faults (OOB, uninit), its abstract counterpart hits ⊥ (`VerificationFailure`). ∎

## 6 Limitations

1.  **Spectre-PHT Mitigation Missing:** PREVAIL (as of issue #229 [6]) does not model speculative execution paths requiring `nospec` branch hardening; Linux verifier v5.15+ inserts `lfence`-equivalent barriers for dependent reads. Prevail's concurrency fix needs speculative load hardening via verifier-identified *speculative domain*.

2.  **BTF / CO-RE Types:** Modern eBPF relies on BTF debug info for `PTR_TO_BTF` typed struct access. PREVAIL's memory domain requires manual annotations for `task_struct` offsets; incomplete without BTF-aware region splitting.

3.  **Precision vs Polyhedra:** Polyhedra domain theoretically yields optimal invariants for linear equality like `r1 = r2 * 2 + 4`, but exponential cost prevents real-world use; Octagon still cannot express `x*y ≤ c` arising in `bpf_loop` trip counts.

4.  **Map Semantics Under-Approximation:** Linux map implementation (LRU eviction non-deterministic [7]) cannot be faithfully abstracted; PREVAIL assumes `LRU_HASH` never evicts when not full — unsound for resource leak detection under high load.

5.  **Verified Compiler Gap:** PREVAIL stops at bytecode; journey from C→eBPF via clang retains gap filled only by Kompick verified BPF (not eBPF) compiler [6]; full toolchain validation still open (BiFST project).

## 7 Conclusion

PREVAIL demonstrates that **abstract interpretation with configurable numeric domains** can replace kernel's exponential verifier while retaining precision and adding formal guarantees. By composing interval, tnum, Zone/Octagon product with disciplined memory region partition and CFG pruning, it achieves polynomial verification, effective bug-finding for latent unsound operator bugs, and clear extensibility to concurrency-safe map reasoning.

Future integration into Windows eBPF platform [6] and eBPF-for-Windows PREVAIL port shows cross-kernel relevance: Windows verifier reuses PREVAIL core (C++23, or Rust port) to avoid re-implementing kernel tricks. Mechanized proofs over tnum now upstreamed provide Gold Standard for future verifier evolution.

In essence, PREVAIL re-establishes eBPF safety as a *formal methods problem* solvable with lattice theory, not heuristics — paving path to certified kernel extensions.

---

## References

[1] E. Gershuni et al. — PREVAIL - A new eBPF verifier, PLDI 2019 artifact and repository. https://github.com/vbpf/prevail — Poly-runtime eBPF verifier using abstract interpretation layer. (Paper PDF: https://vbpf.github.io/assets/prevail-paper.pdf)

[2] Linux Kernel — eBPF verifier documentation — The Linux Kernel docs. https://dri.freedesktop.org/docs/drm/bpf/verifier.html — DAG check then abstract simulation.

[3] H. Vishwanathan, M. Shachnai, S. Narayana, S. Nagarakatte — Verifying the Verifier: eBPF Range Analysis Verification, CAV 2023, NSF PAR ID 10467089. https://par.nsf.gov/biblio/10467089-verifying-verifier-ebpf-range-analysis-verification — automated VC gen from kernel C, soundness proof for 5 numeric domains.

[4] EBPF — Wikipedia — Verifier section: path DFS abstract interpretation, liveness tracking, bounded loops. https://en.wikipedia.org/wiki/EBPF

[5] P. Chaigno — PREVAIL: Understanding the Windows eBPF Verifier, Sep 6 2023. https://pchaigno.github.io/ebpf/2023/09/06/prevail-understanding-the-windows-ebpf-verifier.html — interval vs zone vs octagon, relational domains tradeoff.

[6] E. Gershuni et al. — Simple and Precise Static Analysis of Untrusted Linux Kernel Extensions, PLDI 2019. http://www.math.tau.ac.il/~maon/pubs/2019-pldi-ebpf.pdf — original paper evaluating interval, zonecrab, zoneelina, octelina, polyelina.

[7] opensourceverif/linux-ebpf-verifier-proofs — Formalizing Linux eBPF Core ISA: mechanized operational semantics + Coq tnum proofs. https://github.com/opensourceverif/linux-ebpf-verifier-proofs

[8] Fixing Latent Unsound Abstract Operators in eBPF Verifier — SAS 2024 NEAT paper, SPLASH. https://2024.splashcon.org/details/sas-2024-papers/10/Fixing-Latent-Unsound-Abstract-Operators-in-the-eBPF-Verifier-of-the-Linux-Kernel-NE — latent unsound operators corrected by shared refinement, now upstreamed.

[9] A. Miné — The Octagon Abstract Domain, WCRE 2006. https://hal.science/hal-00136639/document — quadratic closure, assignment algorithms.

[10] eBPF Docs — Concurrency, Spin locks, Maps. https://docs.ebpf.io/linux/concepts/concurrency/ — LWN concurrency management, XADD, BPF_F_LOCK.

