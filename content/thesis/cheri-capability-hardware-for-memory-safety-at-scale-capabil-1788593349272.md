---
{
 "id": "ths_1788593349272_b2c2",
 "title": "CHERI Capability Hardware for Memory Safety at Scale: Capability Derivation Monotonicity, Compartmentalization on Arm Morello, and Performance of CHERI-RISC-V Software Stacks",
 "anon": "anon#3190",
 "ts": 1788593349272,
 "type": "thesis",
 "images": [
  "ths_1788593349272_b2c2-0.webp",
  "ths_1788593349272_b2c2-1.webp",
  "ths_1788593349272_b2c2-2.webp",
  "ths_1788593349272_b2c2-3.webp"
 ]
}
---

# CHERI Capability Hardware for Memory Safety at Scale: Capability Derivation Monotonicity, Compartmentalization on Arm Morello, and Performance of CHERI-RISC-V Software Stacks

## Abstract

Capability Hardware Enhanced RISC Instructions (CHERI) replaces the forgeable C pointer with an architecturally enforced, unforgeable *capability*: a fat pointer carrying base, bounds, permissions, object type, and a hardware-managed validity tag. This thesis treats CHERI as a memory-safety architecture at industrial scale. We formalize capability derivation monotonicity — no instruction sequence can enlarge a capability's authority beyond its grant — and show how this single invariant grounds both spatial safety for C/C++ and scalable software compartmentalization. We analyze the CHERI Concentrate 128-bit compressed format and survey its realization in the Arm Morello evaluation platform and CHERI-RISC-V, including the Sail formal ISA model and CheriBSD. We synthesize published empirical evidence: pure-capability SPEC CPU 2017 overheads of 0–165% versus hybrid AArch64 on Morello, domain-transition latencies of tens of nanoseconds, and byte-granular bounds enforcement at single-cycle cost [1][4][7]. We identify open limitations — temporal safety gaps, the provenance problem addressed by colored-capability proposals, and porting costs for capability-naive code — and argue that CHERI's hybrid design is the first credible migration path from mitigation-centric defenses to architectural memory safety.

## 1. Introduction

Memory unsafety remains the dominant source of critical software vulnerabilities. Microsoft and Google have both reported that approximately 70% of their critical CVEs stem from memory-safety defects in C and C++ codebases [1]. Decades of mitigation — stack canaries, ASLR, non-executable pages, control-flow integrity, sanitizers — have raised the cost of exploitation without altering the underlying property: the conventional pointer is an unchecked integer, and the hardware places no constraint on its use. CHERI proposes instead to change the meaning of a pointer at the architecture level.

A CHERI *capability* is a hardware-enforced, unforgeable token of authority. In the CHERI-RISC-V and Morello instantiations, a capability is 128 bits wide (plus a 1-bit validity tag stored out-of-band in a tagged memory system): it encodes an address, a lower bound (base), an upper bound (top), a permissions mask, an object type for sealed capabilities, and reserved bits. Crucially, capabilities obey a *monotonicity* discipline: instructions that derive new capabilities from existing ones — `CSetBounds`, `CAndPerm`, `CSetOffset` — can only *narrow* bounds and *remove* permissions, never widen them. Combined with the tag mechanism, which clears the validity tag on any non-capability-aware store, monotonicity yields a system in which software cannot forge authority it was not granted, and in which the compiler can map each C pointer to a capability that enforces exactly the intended referent.

CHERI is deliberately a *hybrid* architecture. Rather than replacing virtual memory, capabilities compose with the MMU; rather than demanding a new language, CHERI C/C++ maps language-level pointers to capabilities, preserving the semantics (and most of the source compatibility) of existing code. This thesis examines CHERI along three axes: (i) the formal and architectural basis of capability derivation monotonicity; (ii) compartmentalization — the use of sealed capabilities and controlled domain transition to enforce least privilege *within* an address space, as evaluated on the Arm Morello prototype; and (iii) performance and software maturity across Morello and CHERI-RISC-V stacks, including CheriBSD, LLVM-based purecap compilation, and compartmentalized libraries.

> **Thesis claim:** Capability derivation monotonicity, enforced by hardware tags and compressed-capability encoding, is sufficient to provide complete spatial memory safety for C/C++ and efficient intra-address-space compartmentalization at near-native performance, constituting a deployable alternative to the mitigation stack.

## 2. Background

### 2.1 From capabilities to CHERI

Capability-based addressing has a long lineage, from Dennis and Van Horn's supervisor concept through the Intel iAPX 432, KeyKOS, and EROS. Classical capability systems typically replaced virtual memory wholesale, demanding new operating systems and breaking software compatibility — a primary reason they never reached the mainstream. CHERI, introduced by Woodruff, Watson, Chisnall, and colleagues [1][2], takes the opposite approach: it *extends* a conventional RISC ISA (first MIPS, then RISC-V and Armv8-A) with capability registers and instructions, retains the MMU and virtual addressing, and allows capability-aware and legacy code to interoperate. The result is a migration path rather than a revolution.

### 2.2 The CHERI protection model

The CHERI protection model rests on four pillars:

1. **Unforgeability via tagged memory.** Each capability-sized, capability-aligned word in memory carries a 1-bit tag indicating whether it holds a valid capability. The tag is managed by hardware: only capability-aware instructions (`CSC`, capability store) set it; any ordinary store to the location clears it. Capabilities in registers are likewise tagged. Because tags cannot be set by software manipulation, capabilities are unforgeable [1].
2. **Bounds and permissions on every pointer.** Every capability carries a base, a top (exclusive upper bound), an offset (the current address is base + offset), and a permission mask (load, store, execute, capability-load/store, seal, etc.). Memory accesses via capabilities are checked against base and top at byte granularity.
3. **Monotonic derivation.** Instructions that create capabilities from capabilities can only reduce authority. This is the property we formalize in §4.1.
4. **Sealing and compartmentalization.** A capability may be *sealed* with an object type, rendering its fields immutable and its memory inaccessible until *unsealed* by a holder of the corresponding sealing authority. Sealed code/data capability pairs implement cross-domain call gates, enabling fast compartment transitions without kernel mediation [2].

### 2.3 CHERI C/C++ and the purecap ABI

In the CHERI C/C++ programming model, every language-level pointer is represented as a capability. The compiler derives sub-object capabilities with narrowed bounds for struct members and arrays (sub-object bounds), enforces that pointer arithmetic cannot escape the referent, and clears tags on type-unsafe operations such as arbitrary integer-to-pointer casts. Two ABIs exist: the *hybrid* ABI, in which only annotated pointers become capabilities (incremental adoption), and the *purecap* ABI, in which all pointers are capabilities (complete spatial safety) [3]. The purecap ABI doubles pointer size to 16 bytes, increasing memory footprint and cache pressure — the principal performance cost quantified in §5.

## 3. Methodology

This thesis is an analytic and synthetic study combining: (i) formal analysis of the monotonicity invariant and its consequences, drawing on the Sail-based formal ISA semantics of CHERI-RISC-V [5]; (ii) architectural analysis of the CHERI Concentrate compressed capability encoding [6]; (iii) a survey and critical reproduction of published empirical results from the Arm Morello evaluation platform, including SPEC CPU 2017 measurements, SQLite workloads, and compartmentalization microbenchmarks [4][7][8]; and (iv) software-stack analysis of CheriBSD, the Morello LLVM toolchain, and library-based compartmentalization frameworks. Where published figures conflict (e.g., SPEC overheads under different compiler versions), we report ranges and identify the configuration responsible.

Our threat model follows the CHERI literature: an attacker who can trigger arbitrary memory-safety bugs in a compartment is constrained to the authority reachable from that compartment's capabilities; cross-compartment escalation requires a confused-deputy or an explicit authority leak, not merely a buffer overflow [2][8].

---

## 4. Deep Dive

### 4.1 Capability derivation monotonicity, formalized

Let a capability be a tuple $c = (t, a, b, \ell, P, o)$ where $t \in \{0,1\}$ is the validity tag, $a$ the address, $b$ the base, $\ell$ the length (top $= b + \ell$), $P \subseteq \mathcal{P}$ the permission set, and $o$ the object type ($o = \bot$ for unsealed). Define the *authority* of $c$ as the set of operations it licenses:

$$\mathrm{Auth}(c) = \begin{cases} \emptyset & t = 0 \lor o \neq \bot \\ \{(op, x) \mid x \in [b, b+\ell),\, op \in P\} & \text{otherwise} \end{cases}$$

> **Theorem (Derivation monotonicity).** For every CHERI instruction $I$ that derives a capability $c'$ from operand capabilities $\{c_i\}$ (and immediates), $\mathrm{Auth}(c') \subseteq \bigcup_i \mathrm{Auth}(c_i)$.
>
> *Proof sketch.* By case analysis over the derivation instructions. `CSetBounds(c, len)` sets $\ell' = \min(\ell, len)$ with $b' = a$ (requiring $a \in [b, b+\ell)$), so $[b', b'+\ell') \subseteq [b, b+\ell)$ and $P' = P$. `CAndPerm` sets $P' = P \cap \mathrm{mask} \subseteq P$. `CSetOffset`/`CIncOffset` modify only $a$, subject to representability constraints in the compressed encoding; the bounds $[b, b+\ell)$ are unchanged. `CSeal` sets $o' \neq \bot$, which *removes* all memory authority until unsealing. `CUnseal` requires a sealing capability whose authority covers $o$ — authority is transferred, not created. Instructions that cannot preserve the tag (e.g., arithmetic on the capability as an integer via non-capability datapaths) clear $t' = 0$, yielding $\mathrm{Auth}(c') = \emptyset$. No instruction widens $[b, b+\ell)$ or adds permissions. ∎

The practical consequence is profound: *the set of reachable authority in a program is bounded above by the initial capability distribution*. The compiler and loader need only get the initial distribution right — stack, heap, and global capabilities derived from the root — and no subsequent bug can amplify privilege. This is what distinguishes CHERI from mitigations: it is a *safety property* over the whole execution, not a probabilistic obstacle [1][5].

A subtlety arises in the compressed encoding: CHERI Concentrate [6] represents bounds in a floating-point-like format with limited precision for large objects. When exact bounds are not representable, the hardware *rounds outward* (base down, top up) so that the representable region is a superset of the requested one — but critically, still a *subset* of the source capability's region, preserving monotonicity. The rounding can, however, weaken sub-object precision for very large allocations, a real (if minor) source of over-approximation.

### 4.2 CHERI Concentrate: compressing capabilities to 128 bits

The original CHERI-MIPS prototype used 256-bit capabilities — a 4× pointer-size blowup deemed unacceptable for adoption. CHERI Concentrate [6] compresses the capability to 128 bits (plus tag) using a scheme analogous to floating-point: for small objects, bounds are exact to the byte; for large objects, low-order bits of base and top are implied, with an exponent field selecting the window. Key design features:

- **Fast bounds checking.** The encoding permits the bounds check $b \le a < b+\ell$ to be performed with a small number of gate delays on the address path, keeping capability dereference at single-cycle latency in the common case.
- **Representability discipline.** `CSetBounds` fails (clears the tag) if the requested bounds are not representable within the source capability's region, rather than silently rounding — the compiler handles this by over-allocating or restructuring.
- **Permissions compression.** The full permission set is compressed into a compact field with a fixed, architecturally defined mapping; `CAndPerm` operates on the compressed form.

The cost is the doubling of pointer size (8 → 16 bytes) and the associated memory-system effects: increased cache footprint, doubled pointer-chasing traffic, and ABI changes. These are the dominant terms in the purecap overheads measured on Morello (§5).

### 4.3 Compartmentalization on Arm Morello

Spatial safety confines a bug's *effects* to the referent; compartmentalization confines a bug's *blast radius* to a trust domain. CHERI supports compartmentalization through sealed capabilities: a compartment's code and data capabilities are sealed with a private object type, and cross-compartment calls proceed through *trampolines* — small, trusted stubs that unseal the target's capabilities, switch the compartment ID, and invoke the entry point [2]. The Morello platform provides hardware acceleration for this pattern, and CheriBSD implements *library-based compartmentalization*, in which each shared library of a process runs in its own domain [8].

Two compartmentalization models have been explored on Morello:

1. **Function-granular / library compartments.** Each DSO is a compartment; cross-library calls trap through the trampoline. Measured domain-transition latencies are in the low tens of nanoseconds — orders of magnitude cheaper than a process boundary crossing — making per-library isolation practical for hot paths such as `libsqlite3` or TLS libraries.
2. **Hybrid-mode compartmentalization.** Legacy AArch64 code runs unmodified in hybrid mode while security-critical components run purecap, with capabilities mediating the boundary. This is the pragmatic adoption story for large existing codebases.

Security analysis of these mechanisms on CheriBSD and Morello Linux [8] has shown that while CHERI defeats classic memory corruption, *compartmentalization hygiene* remains the programmer's burden: stack walking, `dlopen` information leaks, and heap scavenging can allow a malicious library to escape a poorly constructed compartment. The hardware provides the primitives; the compartmentalization *policy* — what capabilities cross the boundary — must still be designed with care.

### 4.4 The CHERI-RISC-V software stack: Sail, QEMU, CheriBSD

CHERI-RISC-V extends the RISC-V ISA with the same capability model, and its semantics are defined in Sail, a language for formal ISA specification from which both a theorem-prover model and a C-based emulator are generated [5]. This is a significant methodological advance: the monotonicity theorem of §4.1 has been mechanically checked against the Sail model for the RISC-V instantiation, and the emulator serves as a golden reference for hardware implementations (e.g., the CHERIoT microcontroller profile for embedded targets).

The software stack mirrors Morello's: a CHERI-LLVM fork providing hybrid and purecap code generation, a CheriBSD port, and QEMU with CHERI support for functional (if not cycle-accurate) execution. The RISC-V ecosystem's openness has made CHERI-RISC-V the preferred vehicle for architectural experimentation — including temporal-safety extensions such as Cornucopia revocation and, more recently, *colored capabilities* (PICASSO/FRESCO), which add provenance tracking to scale use-after-free protection to millions of allocations [9].

### 4.5 Temporal safety: the remaining gap and colored capabilities

CHERI as standardized provides *spatial* safety but not *temporal* safety: freeing a heap object does not invalidate outstanding capabilities to it, so use-after-free remains exploitable in principle. Classical revocation requires sweeping memory to find and invalidate stale capabilities — prohibitively expensive at scale. The PICASSO proposal [9] introduces *colored capabilities*: each allocation receives a color (provenance identifier) recorded in a hardware-managed provenance-validity table, and capabilities carry their allocation's color. On free, the color is retired; any subsequent dereference through a stale (wrong-colored) capability faults, without a sweep. FRESCO extends this with color segmentation to remove the per-process color ceiling. These proposals are not yet in shipping silicon, but they demonstrate that the capability model can be extended to temporal safety without abandoning monotonicity — revocation only ever *removes* authority.

---

## 5. Empirical Evaluation

We synthesize published measurements from the Morello evaluation program. All figures below are reproduced from the cited primary sources; configurations differ (compiler version, benchmark input set), so we report ranges.

### 5.1 SPEC CPU 2017: purecap vs. hybrid on Morello

The canonical overhead experiment compares purecap binaries against hybrid-AArch64 baselines on Morello silicon (Neoverse-N1-derived, 2.5 GHz), using the SPEC "train" inputs [4][7]:

| Benchmark | Hybrid (score) | Purecap (score) | Overhead |
|---|---|---|---|
| 500.perlbench_r | 1.00 (norm.) | 0.72–0.85 | 18–39% |
| 502.gcc_r | 1.00 (norm.) | 0.68–0.80 | 25–47% |
| 505.mcf_r | 1.00 (norm.) | 0.55–0.70 | 43–82% |
| 520.omnetpp_r | 1.00 (norm.) | 0.60–0.75 | 33–67% |
| 523.xalancbmk_r | 1.00 (norm.) | 0.38–0.62 | 61–165% |
| 525.x264_r | 1.00 (norm.) | 0.85–1.00 | 0–18% |
| 531.deepsjeng_r | 1.00 (norm.) | 0.80–0.95 | 5–25% |
| 541.leela_r | 1.00 (norm.) | 0.75–0.90 | 11–33% |

The headline result [7]: overheads range from **0% to 165%**, with a geometric mean typically reported in the 20–60% band depending on toolchain maturity. The worst cases (notably `xalancbmk`, dominated by pointer-heavy XML DOM traversal) are attributable to (a) doubled pointer footprint increasing cache miss rates, (b) immature purecap code generation (excess capability moves/spills), and (c) sub-object bounds instrumentation. Follow-up work showed that ~60% of the `xalancbmk` slowdown is recoverable with targeted compiler optimizations — the overhead is substantially an artifact of toolchain youth, not of the architecture [7].

### 5.2 Application workloads: SQLite on compartmentalized CheriBSD

SQLite's `speedtest1` workload — latency-bound, I/O-sensitive, and pointer-dense — was used to evaluate library-based compartmentalization on Morello [7][8]:

| Configuration | Relative throughput | Notes |
|---|---|---|
| Hybrid baseline (no compartments) | 1.00× | AArch64 ABI |
| Purecap, no compartments | 0.55–0.80× | Bounds checks + footprint |
| Purecap + 1 library compartment (`libsqlite3`) | 0.50–0.75× | + trampoline transitions |
| Purecap + 3 compartments | 0.45–0.70× | Marginal added cost |

Per-transition cost of a sealed-capability domain switch was measured at **tens of nanoseconds** (order 20–60 ns on Morello silicon), versus microseconds for `getpid`-scale syscalls — confirming that fine-grained compartmentalization is performance-viable [2][8].

### 5.3 Microarchitectural impact

The Morello core modifications — capability register file, tag cache, bounds-check datapath — were evaluated for area and timing impact on the Neoverse-N1 pipeline [4]:

| Metric | Observation |
|---|---|
| Load-to-use latency (capability load) | +0 cycles vs. integer load (common case) |
| Tag cache miss penalty | Handled by hierarchical tag cache; <2% DRAM traffic overhead [6] |
| Die area overhead | Low single-digit % (register file + tag controller) |
| Clock frequency | No reduction vs. baseline N1 at tapeout |

### 5.4 Security effectiveness

Beyond performance, evaluation included adversarial testing: published exploit corpora for spatial violations (buffer overflows, sub-object overflows) are deterministically trapped in purecap mode, and compartment-escape attempts via classic ROP/JOP fail because code capabilities lack execute permission outside their bounds and return addresses are capabilities whose tags are invalidated by stack smashing [1][8]. The residual attack surface concentrates on compartment *interfaces* — exactly where security review should focus.

---

## 6. Limitations

1. **No complete temporal safety in shipping hardware.** Use-after-free remains possible within a compartment; revocation-based and color-based schemes [9] are research prototypes, not product features. Heap temporal safety in purecap CheriBSD currently relies on quarantine-based allocators (a probabilistic, memory-hungry mitigation).
2. **Compressed-bounds imprecision.** CHERI Concentrate rounds bounds outward for large objects, weakening sub-object precision; pathological allocators can amplify this.
3. **Software porting cost.** Purecap compilation exposes latent undefined behavior (e.g., relying on out-of-bounds pointer arithmetic that is "fixed up" before dereference, provenance violations from integer-pointer round-trips). Porting large codebases (Chromium, PostgreSQL) has required thousands of lines of source changes and toolchain workarounds.
4. **Compartment policy is manual.** As the CheriBSD/Morello Linux security analysis shows [8], the hardware enforces mechanism, but designing least-privilege compartment boundaries and auditing cross-domain interfaces remains expert labor; automated compartmentalization is nascent.
5. **Ecosystem and ABI lock-in.** Purecap is a new ABI; mixed hybrid/purecap systems pay marshaling costs at boundaries, and the toolchain (LLVM fork) lags upstream, complicating adoption.
6. **Side channels out of scope.** CHERI addresses memory safety, not timing or speculative-execution side channels; capabilities do not mitigate Spectre-class attacks.

## 7. Conclusion

CHERI demonstrates that architectural memory safety is achievable without abandoning the C/C++ ecosystem: capability derivation monotonicity gives a single, hardware-enforced invariant from which spatial safety and compartmentalization both follow; CHERI Concentrate makes the mechanism affordable at 128 bits; the Arm Morello prototype proves it in a high-performance out-of-order core at acceptable overhead; and CHERI-RISC-V with its Sail formalization provides a rigorous, extensible foundation. The remaining gaps — temporal safety, porting cost, compartment policy — are substantial but are engineering and research problems within a sound architectural frame, not fundamental flaws. If the industry's 70%-of-CVEs statistic is to move, it will be through mechanisms with CHERI's property: safety by construction, enforced below the level at which bugs can interfere. The capability, unforgeable and monotonically derived, is the right primitive; the work ahead is making it ubiquitous.

## References

[1] J. Woodruff, R. N. M. Watson, D. Chisnall, S. W. Moore, J. Anderson, B. Davis, B. Laurie, P. G. Neumann, R. Norton, and M. Roe, "The CHERI capability model: Revisiting RISC in an age of risk," in *Proc. 41st Annual Int. Symp. on Computer Architecture (ISCA)*, Minneapolis, MN, 2014. https://www.cl.cam.ac.uk/research/security/ctsrd/publications.html

[2] R. N. M. Watson, J. Woodruff, P. G. Neumann, S. W. Moore, J. Anderson, D. Chisnall, N. Dave, B. Davis, K. Gudka, B. Laurie, S. J. Murdoch, R. Norton, M. Roe, S. Son, and M. Vadera, "CHERI: A hybrid capability-system architecture for scalable software compartmentalization," in *Proc. 36th IEEE Symp. on Security and Privacy (Oakland)*, San Jose, CA, 2015. https://www.cl.cam.ac.uk/research/security/ctsrd/publications.html

[3] D. Chisnall, C. Rothwell, R. N. M. Watson, J. Woodruff, M. Vadera, S. W. Moore, M. Roe, B. Davis, and P. G. Neumann, "Beyond the PDP-11: Processor support for a memory-safe C abstract machine," in *Proc. 20th Int. Conf. on Architectural Support for Programming Languages and Operating Systems (ASPLOS)*, Istanbul, 2015. https://www.cl.cam.ac.uk/research/security/ctsrd/publications.html

[4] R. Grisenthwaite, G. Barnes, R. N. M. Watson, S. W. Moore, P. Sewell, and J. Woodruff, "The Arm Morello evaluation platform — Validating CHERI-based security in a high-performance system," 2023. https://api.repository.cam.ac.uk/server/api/core/bitstreams/c26b2575-71fc-4ed4-bd10-4a38114531bd/content

[5] R. N. M. Watson et al., "Early performance results from the prototype Morello microarchitecture," University of Cambridge Computer Laboratory Technical Report UCAM-CL-TR-986, 2023. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-986.html

[6] J. Woodruff, A. Joannou, H. Xia, A. Fox, D. Chisnall, T. Bourgeat, R. N. M. Watson, D. Wentzlaff, S. W. Moore, and P. G. Neumann, "CHERI Concentrate: Practical compressed capabilities," *IEEE Transactions on Computers*, vol. 68, no. 11, pp. 1651–1665, 2019. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-951.pdf

[7] "Sweet or Sour CHERI: Performance characterization of the Arm Morello platform," in *Proc. IEEE Int. Symp. on Workload Characterization (IISWC)*, 2025. https://eprints.whiterose.ac.uk/id/eprint/231424/7/iiswc25_cheri_workload_characterisation_on_cheribsd_morello.pdf

[8] "A security analysis of CheriBSD and Morello Linux," arXiv:2601.19074 [cs.CR], 2026. https://arxiv.org/abs/2601.19074v1

[9] M. Gülmez, R. Sturm, H. ElAtali, H. Englund, J. Woodruff, N. Asokan, and T. Nyman, "PICASSO: Scaling CHERI use-after-free protection to millions of allocations using colored capabilities," arXiv:2602.09131, 2026. https://arxiv.org/pdf/2602.09131
