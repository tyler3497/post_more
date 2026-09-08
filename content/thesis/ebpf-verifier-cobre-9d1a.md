---
id: ebpf-verifier-cobre-9d1a
title: "Extended Berkeley Packet Filter and the Programmable Kernel: Verifier Soundness, JIT Compilation, and CO-RE Observability"
anon: anon#7392
ts: 1788886200000
type: thesis
---

# Extended Berkeley Packet Filter and the Programmable Kernel: Verifier Soundness, JIT Compilation, and CO-RE Observability

## Abstract

## 1 Introduction

Operating system kernels face a perennial tension: they must be *extensible* to accommodate new hardware, protocols, and policies, yet *extension* is precisely the operation most likely to compromise the kernel's integrity. Historically, extensibility meant loadable kernel modules — arbitrary native code running at the highest privilege level, with no safety net beyond the programmer's discipline. The extended Berkeley Packet Filter represents a decisive break from this model: it defines a small, constrained instruction set architecture together with a rigorous admission procedure, such that untrusted programs can execute in kernel context with machine-checked safety guarantees [1].

The significance of eBPF is difficult to overstate. What began in 2014 as an extension of the classic BPF packet filter (itself dating to 1992) into a general-purpose 64-bit register VM has become the substrate for software-defined networking (Cilium, Katran), kernel-level observability (BCC, bpftrace), runtime security enforcement, and even CPU scheduling policy. This thesis examines the three technical pillars that jointly deliver this capability:

1. **The verifier** (`kernel/bpf/verifier.c`), a ~25,000-line symbolic executor that statically proves every admitted program terminates, accesses only permitted memory, and respects type discipline [2].
2. **The JIT compilers**, per-architecture translators that convert verified bytecode to native instructions with security hardening, including constant blinding and speculation barriers [1][5].
3. **CO-RE (Compile Once – Run Everywhere)**, a portability framework built on BTF type information and compiler-emitted relocations that frees programs from dependence on exact kernel structure layouts [3].

Our contributions are: (i) a formal characterization of the verifier as an abstract interpreter; (ii) an analysis of the termination argument via bounded-loop unrolling and state pruning; (iii) a treatment of JIT hardening trade-offs; (iv) a correctness argument for CO-RE relocation resolution; and (v) a critical survey of formal verification efforts, identifying the *language-verifier gap* as the outstanding research problem [4].

## 2 Background

### From cBPF to eBPF

Classic BPF (cBPF) was a minimal accumulator-based VM with two 32-bit registers, designed for one purpose: deciding which packets to capture. Extended BPF, merged in Linux 3.18, generalizes this into a RISC-like 64-bit ISA: eleven 64-bit registers (`R0`–`R10`), where `R10` is a read-only frame pointer into a 512-byte private stack, a calling convention with `R1`–`R5` as argument registers and `R6`–`R9` callee-saved, and roughly one hundred opcodes covering ALU, jumps, loads, stores, and calls [2].

eBPF programs cannot run standalone. They attach to *hooks* — kernel or hardware events — and communicate with user space exclusively through *maps*, shared key-value data structures managed by the kernel. Program types define the hook and the contract:

| Program type | Attachment point | Typical use |
|---|---|---|
| `BPF_PROG_TYPE_XDP` | NIC driver receive path | DDoS mitigation, load balancing |
| `BPF_PROG_TYPE_SCHED_CLS` / `SCHED_ACT` | Traffic control layer | QoS, traffic shaping |
| `BPF_PROG_TYPE_KPROBE` / `TRACEPOINT` | Kernel functions / static tracepoints | Observability, profiling |
| `BPF_PROG_TYPE_LSM` | Linux Security Module hooks | Runtime security policy |
| `BPF_PROG_TYPE_SOCKET_FILTER` | Socket layer | Legacy packet filtering |
| `BPF_PROG_TYPE_STRUCT_OPS` | Kernel operation structures | TCP congestion control, scheduling |

Interaction with the kernel beyond the context pointer happens through *helper functions* — a whitelisted, per-program-type API (`bpf_map_lookup_elem`, `bpf_probe_read_kernel`, `bpf_ktime_get_ns`, and several hundred more). The verifier checks each helper call against its declared prototype, resetting caller-saved registers and assigning the return type afterward [2].

### The safety problem

Running untrusted code in the kernel demands unusually strong guarantees: *memory safety*, *type safety*, *termination* (no infinite loops, no spinlock deadlock), and *information-flow control* (unprivileged programs must not leak kernel addresses). Linux answers with defense in depth: static verification before admission, JIT hardening at translation time, and privilege-tiered restrictions [1].

## 3 Methodology

This thesis proceeds by *analytical reconstruction*:

1. **Formal modeling.** We reconstruct the verifier as an abstract interpreter in the Cousot–Cousot tradition, identifying its abstract domain, transfer functions, and pruning operators from kernel documentation and published surveys [1][2][7].
2. **Literature synthesis.** We compare primary sources on verification (PREVAIL [7], the eBPF runtime survey [1]), JIT correctness [1], Spectre defenses [5], two-stage toolchains [6], CO-RE [3], and language-based alternatives [4][8].
3. **Critical evaluation.** For each pillar we state a precise soundness claim, examine the evidence, and identify where the argument is incomplete — following the survey's observation that no comprehensive formal investigation of the verifier's soundness exists [1].

---

## 4 Deep Dive

### 4.1 The Verifier as an Abstract Interpreter

The kernel documentation describes verification as a two-step process [2]. **Step one** validates the control-flow graph: the program must be a directed acyclic graph for unprivileged loaders (loops are rejected outright), contain no unreachable instructions, and respect jump bounds. **Step two** performs symbolic execution: starting from the first instruction, the verifier descends every feasible path, simulating each instruction's effect on an abstract machine state consisting of register types, value ranges, and stack slot contents.

The abstract state is best understood as a *product domain*. The **type domain** tracks, per register, one of a lattice of pointer kinds:

| Abstract type | Meaning |
|---|---|
| `SCALAR_VALUE` | Ordinary integer; may carry range/tnum bounds |
| `PTR_TO_CTX` | Pointer to the program context |
| `PTR_TO_MAP_VALUE` | Pointer into a map value, with known bounds |
| `PTR_TO_STACK` | Pointer into the 512-byte BPF stack |
| `PTR_TO_PACKET` / `PTR_TO_PACKET_END` | Packet data with `data`/`data_end` bounds |
| `PTR_TO_MEM` | Bounded kernel memory (with size) |
| `NOT_INIT` | Unreadable; any read is a verification error |

The **value domain** tracks what is known about scalar contents: 64-bit interval bounds (`umin`/`umax`, `smin`/`smax`) plus a *tristate number* (tnum) representation — a pair of value/mask bitvectors expressing known-0, known-1, and unknown bits. Vishwanathan et al. formally specified this numerical domain with soundness and optimality proofs, a portion of which has since been adopted into the kernel itself [1].

Each instruction has an abstract transfer function. Consider the canonical examples from the kernel documentation [2]:

```c
/* R1 holds PTR_TO_CTX at entry; copying preserves the type */
r2 = r1;            /* R2 := PTR_TO_CTX */
/* adding two pointers is meaningless -> scalar */
r2 = r1 + r1;       /* R2 := SCALAR_VALUE */
/* pointer arithmetic leaks addresses: rejected in "secure" mode */
/* reading a never-written register: rejected */
r0 = r2; exit;      /* ERROR: R2 is NOT_INIT */
```

Helper calls reset `R1`–`R5` to unreadable and assign `R0` the helper's declared return type, while callee-saved `R6`–`R9` survive — the calling convention is enforced statically [2].

> **Theorem (Verifier soundness, informal).** *If the verifier accepts a program P, then every execution of P terminates, accesses only memory within proven bounds, and never confuses pointer and scalar values.*

This is the claim the entire ecosystem rests on — and, crucially, it has never been proven for the production verifier as a whole. The survey literature is explicit: *"There has been no comprehensive formal investigation of the verifier and whether its safety guarantees are sound. This remains an open research problem"* [1]. Partial results exist — the tnum domain proofs, Bhat et al.'s automated verification of the range-analysis C code against a correctness specification, and Nelson et al.'s Serval-based frameworks [1] — but the ~25,000-line symbolic executor remains, in the formal sense, trusted rather than verified.

PREVAIL (Gershuni et al., PLDI 2019) offers the closest thing to a verified alternative: an abstract-interpretation verifier built on the Crab framework, with a cleanly specified abstract domain (pointer tags × numerical values × stack footprint) and a machine-checked-style soundness argument [7]:

> **Theorem (PREVAIL soundness [7]).** *If P is verified to be safe then P is safe to execute.*

PREVAIL's evaluation showed that simple numerical domains (intervals) are too imprecise for real eBPF code while relational domains (octagons, polyhedra) are prohibitively expensive — the practical sweet spot is a carefully tuned product of cheap domains [7]. This tension between precision and cost recurs everywhere in the verifier's design.

### 4.2 Bounded Loops, State Pruning, and the Complexity Envelope

Termination is the verifier's hardest obligation. Until Linux 5.3, the answer was draconian: *no back-edges at all* for the general case, enforced by the DAG check. Since 5.3, the verifier supports **bounded loops** in two flavors [1]:

1. **Statically bounded loops**, where the verifier can determine the iteration bound. These are handled by *unrolling*: the symbolic executor explores every iteration until the bound is exhausted or the instruction-complexity limit is reached. Because unrolling never stops early relative to the true bound, no precision is lost.
2. **Unbounded loops**, supported only through disciplined iterator helpers (`bpf_iter` families: init / next / destroy). The verifier trusts the helper contract — `next` eventually returns a terminating indicator — and therefore need not prove termination itself. The challenge shifts to *precision*: the state after an unknown number of iterations must be summarized soundly.

The mechanism for controlling path explosion is **state pruning**. As the verifier explores, it records abstract states at program points; when it revisits an instruction with a state that is *subsumed* by a previously recorded one — i.e., the current state carries no more information than what was already proven safe — exploration of that path stops. Early designs stored pruning state around every jump (roughly every four instructions, mostly wasted); modern kernels checkpoint approximately every ten instructions regardless of branching, a heuristic found empirically superior [1].

Pruning is where soundness is most fragile: an *over-aggressive* prune marks unsafe paths safe, while an *over-conservative* one explodes verification time — and the literature documents precision-loss bugs at pruning boundaries [1]. The complexity envelope is further bounded by hard limits: at most one million instructions explored during analysis, caps on nested branches, bpf-to-bpf call depth, verifier states per instruction, and maps per program [1]. A Python sketch captures the algorithm's skeleton:

```python
def verify(prog):
    cfg = build_cfg(prog)
    assert is_dag_or_bounded(cfg), "unbounded loop rejected"
    worklist = [(0, initial_state())]          # (insn, abstract state)
    seen = {}                                   # insn -> list of states
    explored = 0
    while worklist:
        insn, st = worklist.pop()
        if any(subsumes(s, st) for s in seen.get(insn, [])):
            continue                            # state pruning
        seen.setdefault(insn, []).append(st)
        for succ, st2 in transfer(prog[insn], st):
            check_safety(prog[insn], st2)       # may raise -> reject
            worklist.append((succ, st2))
        explored += 1
        assert explored < 1_000_000, "complexity limit"
    return ACCEPT
```

The `subsumes` relation is the crux: it must be a *safe* approximation and a *useful* one. Every verifier CVE of the last decade can be read as a failure of this relation on some corner of the product domain.

### 4.3 JIT Compilation: From Bytecode to Native Code

A verified program is not yet executable: eBPF bytecode must be translated to native machine code (or interpreted). Linux ships a portable C interpreter and per-architecture JIT backends (x86-64, arm64, riscv, powerpc, s390, mips, sparc, …), with the JIT enabled via `bpf_jit_enable` [1]. The JIT is a straightforward template-based translator with prologue/epilogue emission, but its security posture is anything but straightforward.

**Constant blinding.** JIT-compiled immediates are attractive targets for JIT-spraying attacks, in which an attacker crafts bytecode whose immediate operands decode into malicious native instructions. When hardening is requested, the JIT XORs every immediate with a random per-load constant, materializes it through a dedicated internal register (`rAX` on x86-64), and XORs again before use — so the immediate bytes visible in the final image reveal nothing about the program's constants [1].

**Spectre defenses.** Because eBPF programs share an address space with the kernel, speculative execution can leak data across the trust boundary. VeriFence (2024) analyzed the verifier's Spectre-STL mitigations and found barrier insertion precise but unevenly distributed: application-class programs required barriers on 2.2% of instructions versus 1.0% overall, with real overhead dominated by barrier *placement* relative to hot paths [5].

**JIT correctness.** A subtle hazard: the verifier proves safety of the *bytecode*, but the kernel executes the *JIT output*. Any semantic divergence voids the proof. Nelson et al. addressed this with Jitterbug, constructing a formal JIT correctness specification with automated proofs [1]. The lesson generalizes: *every translation stage* needs its own correctness argument.

### 4.4 CO-RE and BTF: Portable Observability

Observability programs are inherently *introspective*: a tracer that walks `task->real_parent->tgid` hard-codes byte offsets into `task_struct`. But kernel structures change between releases — fields move, are renamed, or disappear. Before CO-RE, this meant shipping one compiled object per kernel version or compiling on the target host (the BCC model: slow, toolchain-dependent, fragile) [3].

CO-RE (Compile Once – Run Everywhere) solves this with three cooperating mechanisms [3]:

1. **`vmlinux.h`** — a header generated from the kernel's own BTF (BPF Type Format) data via `bpftool btf dump`, giving Clang accurate type information without kernel headers.
2. **Compiler relocations** — Clang emits relocation records describing *what* is accessed ("field `tgid` of `struct task_struct`") rather than *where* (byte offset 0x4B8). The ELF object carries BTF metadata plus these relocations.
3. **libbpf at load time** — the loader reads the *running* kernel's BTF from `/sys/kernel/btf/vmlinux`, resolves each relocation against the actual layout, and patches the bytecode *before* it reaches the verifier.

```c
struct task_struct *task = (struct task_struct *)bpf_get_current_task();
/* One CO-RE relocation per field access; patched at load time. */
pid_t ppid = BPF_CORE_READ(task, real_parent, tgid);
```

The macro family (`BPF_CORE_READ`, `BPF_CORE_READ_INTO`, `bpf_core_field_exists`, `bpf_core_enum_value_exists`, …) covers field reads, existence checks for graceful degradation, and enum value queries [3]. The relocation kinds form a small algebra:

| Relocation kind | Records | Resolved against |
|---|---|---|
| Field byte offset | struct + field name | Target BTF layout |
| Field existence | struct + field name | Target BTF presence |
| Type size | type name | Target BTF size |
| Enum value | enumerator name | Target BTF value |
| Function prototype | function signature | Target BTF / kfunc availability |

> **Lemma (CO-RE relocation correctness).** *If libbpf resolves every relocation in program P against the BTF of the running kernel K, and each resolution succeeds, then every field access in P refers to the same logical field on K as on the build kernel.*

The proof is by construction: relocations name fields, not offsets, and BTF is authoritative for K's layout. The interesting failure mode is *partial* success — a field that exists on the build kernel but not on K — which is why existence-check relocations and fallback paths are first-class [3]. Note the ordering constraint: patching happens *before* verification, so the verifier always reasons about concrete offsets; CO-RE adds no burden to the soundness argument of §4.1.

### 4.5 The Programmable Kernel in Practice

Taken together, the three pillars enable a remarkable property: *untrusted, portable, near-native-speed code executing in kernel context*. The verifier supplies the safety proof, the JIT supplies the speed, and CO-RE supplies the portability. Production systems compose them routinely — a Cilium network-policy program is compiled once, relocated by libbpf for the node's kernel, verified path-by-path, JIT-compiled with constant blinding, and attached at XDP, processing millions of packets per second without a context switch.

This composition also concentrates risk. The verifier is the single gatekeeper; its bugs are kernel vulnerabilities by definition. The response from the research community has been twofold: *verify the verifier's components* (tnum proofs, range-analysis verification, Jitterbug [1]) and *build better verifiers* (PREVAIL [7], the two-stage separation-logic toolchain VEP [6]).

VEP (Wu et al., NSDI 2025) is particularly instructive: it splits verification into a specification stage, where helper functions and kernel resources are described with separation-logic assertions over a symbolic heap, and a checking stage that validates resource acquisition/release discipline (e.g., every acquired reference is released on all paths) [6]. This directly addresses one of the production verifier's weakest areas — the ad-hoc, per-helper safety logic scattered through `verifier.c` — by making helper contracts explicit and machine-checkable.

---

## 5 Empirical Evaluation and Proofs

We now consolidate the quantitative and formal evidence.

**Verification precision vs. cost.** PREVAIL's evaluation across 111 real-world benchmarks established the domain trade-off empirically: interval domains alone produced false positives on production code, while octagon/polyhedra domains were too slow for the verifier's latency budget; the deployed-style product domain hits the usable middle [7]. The kernel verifier's own evolution tells the same story from the other side: bounded-loop support (5.3+) and refined pruning heuristics steadily expanded the set of *acceptable* programs, but each relaxation of the analysis demanded new soundness arguments — and several shipped bugs show those arguments were occasionally wrong [1].

**Spectre mitigation overhead.** VeriFence's measurement study found barrier density highly program-dependent (2.2% of instructions for application-class objects vs. 1.0% overall) and showed that naive barrier counting misestimates real overhead, which is dominated by barrier *placement* relative to hot paths [5]. The implication for verifier design: speculative-safety analysis cannot be a bolt-on; it interacts with every optimization in §4.2.

**Formal artifacts.** The strongest available guarantees today are component-level:

- *tnum abstract domain*: soundness and optimality proofs, partially upstreamed [1];
- *range analysis*: automated verification of the C implementation against a specification of correctness invariants [1];
- *JITs*: Serval/Jitterbug correctness specifications with automated proofs [1];
- *PREVAIL*: a clean-slate verifier with a stated and argued soundness theorem [7];
- *VEP*: separation-logic specifications for helper resource discipline [6].

> **Theorem (Composition gap).** *Component-level proofs for the tnum domain, range analysis, and JIT translation do not compose into an end-to-end soundness proof for the production verifier, because the pruning fixpoint, helper-call logic, and speculative-path analysis remain unverified and their interfaces are specified only informally [1].*

This is not a counsel of despair but a research agenda: the interfaces between verified components are precisely where the next decade of eBPF verification work must focus.

**Programmability evidence.** Jia et al. document the *language-verifier gap*: safe, idiomatic programs are routinely rejected because the verifier's expectations diverge from the language's safety contract, forcing workarounds — splitting programs to dodge complexity limits, hand-tuning LLVM output, refactoring data flow to avoid precision loss [4]. KEN's synthesis experiments add a data point from the opposite direction: even machine-generated eBPF programs required verifier-aware feedback loops [9].

## 6 Limitations

**No end-to-end soundness proof.** As established in §5, the production verifier's global soundness is an article of faith supported by fuzzing (notably syzbot/syzkaller), code review, and component proofs — not by a comprehensive formal argument [1]. Every past verifier CVE is evidence that this faith has been misplaced before.

**CO-RE's preconditions.** CO-RE requires BTF-enabled kernels (`CONFIG_DEBUG_INFO_BTF=y`) and a libbpf-based loader; it cannot rescue programs from *semantic* kernel changes (a field whose meaning changed, not just its offset), and existence-check fallbacks add their own complexity [3].

**Unprivileged eBPF remains gated.** Despite sandboxing proposals, unprivileged programs face the strictest verifier mode (no pointer arithmetic, bounded instruction counts), and several interfaces are root-only [1][5].

**Spectre is a moving target.** Transient-execution defenses track the state of CPU vulnerability research; each new speculation primitive potentially reopens the analysis [5].

## 7 Conclusion

eBPF's success rests on an unusual engineering bet: that static verification of untrusted machine code can be made simultaneously *sound enough* to protect the kernel, *precise enough* to admit real programs, and *fast enough* to run at load time. A decade of production experience suggests the bet is paying off — but the costs are clear. The verifier is the most complex and security-critical component, yet the least formally understood [1]. The JIT must be hardened against code-reuse and speculative attacks, with unevenly distributed overheads [5]. CO-RE solves portability for *layout* while leaving *semantic* drift to the programmer [3].

The research frontier is well-defined: close the language-verifier gap (better verifiers like PREVAIL [7] and VEP [6], or language-based designs like Rex [4][8]); compose component proofs into an end-to-end soundness argument; and extend principled safety to the unprivileged surface. Until then, the programmable kernel remains an extraordinarily useful machine whose most important safety property is still, formally speaking, a conjecture.

## References

[1] "The eBPF Runtime in the Linux Kernel," arXiv:2410.00026, 2024. https://arxiv.org/html/2410.00026v2

[2] "eBPF verifier — The Linux Kernel documentation." https://docs.kernel.org/bpf/verifier.html

[3] "BPF CO-RE (Compile Once – Run Everywhere) — eBPF Docs." https://docs.ebpf.io/concepts/core/

[4] Jinghao Jia et al., "Safe and usable kernel extensions with Rex," arXiv:2502.18832, 2025. https://arxiv.org/abs/2502.18832v2

[5] "VeriFence: Lightweight and Precise Spectre Defenses for Untrusted Linux Kernel Extensions," arXiv:2405.00078, 2024. http://arXiv.org/pdf/2405.00078

[6] Xiwei Wu et al., "Two-stage Verification Toolchain" (VEP), NSDI 2025. https://www.usenix.org/system/files/nsdi25-wu-xiwei.pdf

[7] Elazar Gershuni et al., "Simple and Precise Static Analysis of Untrusted Linux Kernel Extensions" (PREVAIL), PLDI 2019. https://dl.acm.org/doi/pdf/10.1145/3314221.3314590

[8] "Safe and usable kernel extensions with Rex — full paper (Rex project)." https://github.com/rex-rs/rex/raw/a011c10a371175cdd2e71d78e7522e595be6111a/docs/rex-paper.pdf

[9] "KEN: Kernel Extensions using Natural Language," arXiv:2312.05531, 2023. https://arxiv.org/html/2312.05531v1

[10] PREVAIL — open-source abstract-interpretation eBPF verifier. https://github.com/vbpf/prevail

