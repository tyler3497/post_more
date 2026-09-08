---
id: ths_1788877759022_a887
title: "CHERI Hardware Capabilities for Memory Safety: Capability Monotonicity, the Morello Evaluation, and Compartmentalized Software Architecture"
anon: anon#2141
ts: 1788877759022
tags: [Thesis]
type: thesis
---

# CHERI Hardware Capabilities for Memory Safety: Capability Monotonicity, the Morello Evaluation, and Compartmentalized Software Architecture

## Abstract

Capability Hardware Enhanced RISC Instructions (CHERI) reframes memory safety as a problem solvable in the microarchitecture: pointers become *capabilities* — unforgeable, tagged tokens carrying base, bounds, permissions, and an object type — such that every dereference is bounds-checked, permission-checked, and tag-verified in hardware. The linchpin of the design is **capability monotonicity**: no instruction can amplify the rights of the capabilities it consumes; it can only copy, narrow, or derive. This essay develops the full argument for CHERI as a principled memory-safety architecture. We trace the 128-bit CHERI Concentrate compressed-capability encoding and its floating-point-style bounds compression, formalize monotonicity as an instruction-set invariant verified in the Morello-Cerise Isabelle/HOL proof, and dissect the Arm Morello prototype — a Neoverse-class 2.5 GHz SoC on TSMC N7 — whose evaluation reports roughly 0–5% overhead for the pure-capability ABI on most workloads. Finally, we show how sealed capabilities and object types yield low-cost software compartmentalization via in-address-space domain crossing, survey the CompartOS and CheriRTOS designs, and examine the limitations: hybrid-pointer ABI friction, temporal safety requiring software revocation (Cornucopia), tag-bit memory cost, and the residual risks demonstrated by recent bypass analyses of CheriBSD and Morello Linux compartmentalization.

![128-bit CHERI capability format with compressed bounds fields](/thesis/ths_1788877759022_a887-0.webp)

## 1 Introduction

Memory-safety vulnerabilities remain the dominant defect class in systems software. Microsoft's Security Response Center has attributed roughly two-thirds of its security bulletins over the past decade to memory-unsafety defects [5], a proportion echoed across the industry. Decades of software mitigation — stack canaries, address-space layout randomization, control-flow integrity, hardware shadow stacks — have raised the cost of exploitation without eliminating the underlying defect class, because each mechanism protects one *manifestation* of unsafety rather than the *invariant* that references must be valid.

The CHERI project, a collaboration between the University of Cambridge, SRI International, and Arm Research under DARPA CRASH and MRC funding [6], takes the opposite approach: it revises the architectural meaning of a pointer. In CHERI, a pointer is a **hardware capability** — an unforgeable token of authority [1] — stored either in a capability register file or in tagged memory, carrying an address plus metadata (bounds, permissions, object type) whose integrity is protected by an out-of-band tag bit. Every memory access through a capability is checked against its bounds and permissions by the processor, and *capability monotonicity* guarantees that ordinary instructions can only attenuate authority, never amplify it.

This thesis presents a unified treatment of that design across three dimensions:

1. **The capability encoding and its monotonicity invariant** — how the 128-bit CHERI Concentrate format compresses bounds with a floating-point-style representation while preserving precise security semantics, and how monotonicity is stated and machine-checked.
2. **The Morello evaluation** — what the Arm Morello prototype, the first high-performance silicon implementation of CHERI semantics, reveals about the true cost of hardware capability enforcement in the pure-capability ABI.
3. **Compartmentalized software architecture** — how sealed capabilities generalize the design from *memory safety within a program* to *least-privilege decomposition between mutually distrusting components*, and what the performance and security record of that decomposition looks like.

We conclude that CHERI's combination of a tiny, checkable invariant (monotonicity), a deployable encoding (Concentrate), and real silicon (Morello) constitutes the strongest existing evidence that memory safety can be moved from best-effort software discipline into architectural guarantee — while identifying precisely where the guarantee currently ends.

## 2 Background

### 2.1 The memory-safety crisis and the failure of probabilistic defense

Memory unsafety in C and C++ arises from a single root cause: the language conflates *integers* with *references*. An address is a number, and numbers can be forged, incremented past their allocation, or retyped arbitrarily. Software defenses intervene at various points — bounds-checking compilers (e.g., SoftBound), sanitizers (AddressSanitizer), and probabilistic mitigations (ASLR) — but none alter the invariant. As the Cambridge CHERI FAQ observes, many memory-based attacks rely on corrupting pointers or lengths; tags provide strong pointer-integrity guarantees that are difficult to implement efficiently without hardware support [6].

### 2.2 From Dennis and Van Horn to CHERI

Hardware capabilities are not new. The concept traces to Dennis and Van Horn (1966), the CAP computer, and later the Intel iAPX 432. Those systems failed commercially, largely because capabilities replaced virtual memory wholesale and imposed coarse, whole-system redesigns. CHERI's distinguishing insight is the **hybrid capability-system architecture**: traditional paged virtual memory coexists with fine-grained capability protection *within* each address space, permitting incremental adoption [1]. Capabilities are *fat pointers* — wide values carrying metadata — rather than a replacement for addresses. The ISA exposes capability registers (`c0`–`c31`), a program-counter capability (`pcc`), a default-data capability (`ddc`), tagged memory, and a small set of capability-manipulation instructions (`CSetBounds`, `CAndPerm`, `CSeal`, `CUnseal`, `CCall`, `CReturn`, and friends).

### 2.3 Tagged memory and unforgeability

A capability's integrity rests on a **tag bit**: one bit of metadata per capability-sized, capability-aligned word of physical memory, maintained with cache lines and obeying normal cache-coherency rules [6]. The tag is set only when a capability is stored through a capability-aware store; any partial or data overwrite clears it. This gives *provenance validity*: a capability with its tag set could only have been produced by a legitimate chain of capability-manipulating instructions. On Morello this costs one bit per 16 bytes of data — a <1% memory overhead [5][6].

### 2.4 The CHERI-128 encoding and CHERI Concentrate

Early CHERI prototypes used 256-bit capabilities. Woodruff et al.'s **CHERI Concentrate** (IEEE TC, 2019) compressed the format to 128 bits plus tag using a floating-point-inspired encoding: bounds are stored as compressed base/top fields `B` and `T` with a 6-bit exponent `E` (whose bottom two bits are ignored in current revisions), exploiting redundancy between the pointer address and its bounds since a pointer typically lies within or near its allocation [2][4]. Key properties of the scheme:

- **Out-of-bounds representability**: the representable region is at least twice the dereferenceable region, so pointers may transiently leave their bounds (as C semantics require) while remaining encodable [2].
- **Fast pointer arithmetic**: an approximate representability check during pointer addition uses only the compressed format, adding no load-to-use delay [2].
- **HOL4 machine-checked proof** of decode and pointer-modify operations [2].
- **Measured effect**: 50–75% reduction in L2 misses for many compiled C benchmarks versus the 256-bit format [2].

In the current ISA (Version 8), the fields are named `B`, `T`, and `a` (address/cursor), with a 24-bit object type (`otype`) for sealed capabilities [1].

### 2.5 Permissions, sealing, and object types

Capabilities carry permission bits (load, store, execute, system-register access, sealing authority, and others). **Sealing** renders a capability immutable and non-dereferenceable, binding it to an *object type* (`otype`) taken from a sealing capability. A sealed capability can only be unsealed by the matching key — or atomically unsealed-and-invoked via `CCall` with an otype-matched sealed code/data pair. Sealing is the primitive on which compartmentalization is built [7].

## 3 Methodology

This thesis is a synthesis of primary architectural sources: the CHERI ISA specification (Version 8, UCAM-CL-TR-951) [1], the CHERI Concentrate paper [2], the Morello-Cerise encapsulation proof [3], the CompartOS design (arXiv:2206.02852) [4], the Hot Chips Morello disclosure [5], the Cambridge CHERI FAQ [6], the CheriRTOS capability model [7], and the ANU security analysis of CheriBSD and Morello Linux compartmentalization [8], together with the Morello AAPCS64 pure-capability procedure-call standard [9].

Our method is architectural analysis rather than new measurement:

1. **Invariant extraction** — we state capability monotonicity precisely and trace how each ISA operation preserves it, following the formal treatment in [1][3].
2. **Encoding analysis** — we explain the Concentrate compression and its precision/alignment trade-offs, drawing on [2].
3. **Evaluation synthesis** — we consolidate reported Morello performance figures (overhead bands, tag cost, compartment-crossing improvements) from [5] and related disclosures.
4. **Compartmentalization design patterns** — we reconstruct the domain-crossing trampoline and captable model from CompartOS [4] and CheriRTOS [7], and confront them with the bypass analysis in [8].

Where figures report numbers, they are the published values, cited; where we reason about guarantees, we distinguish what is machine-checked ([3]'s Isabelle/HOL proof) from what is empirical.

---

## 4 Deep Dive

### 4.1 Capability monotonicity: the invariant everything rests on

> **Theorem (Capability monotonicity, informal):** No CHERI instruction, given a set of input capabilities, can produce an output capability whose authority exceeds the union of the authorities of its inputs. Authority may be *attenuated* — bounds narrowed, permissions cleared — but never *amplified*.

More formally, following the Morello procedure-call standard's terminology, a capability value *CV2* is *derived* from *CV1* when it is a copy of *CV1* with optionally removed permissions and/or narrowed bounds [9]. Monotonicity is the claim that every architectural derivation is of this form (with the single controlled exception of domain transition, discussed in §4.4).

The ISA enforces this structurally. Consider the core manipulation instructions [1]:

| Instruction | Effect | Monotonicity argument |
|---|---|---|
| `CSetBounds(cd, cs, length)` | Sets bounds of `cd` to `[addr(cs), addr(cs)+length)` | Bounds can only *shrink* relative to `cs`; setting larger bounds traps |
| `CSetBoundsExact` | Exact variant; traps if bounds not precisely representable | Prevents silent bound *widening* via compression rounding |
| `CAndPerm(cd, cs, mask)` | Clears permission bits per mask | Permissions only clearable |
| `CSeal(cd, cs, key)` | Seals `cs` with otype from `key` | Requires `Permit_Seal` on `key`; sealed cap is strictly less usable |
| `CUnseal(cd, cs, key)` | Unseals with matching key | Requires `Permit_Unseal` on `key` and otype match — authority comes from the key |
| `CBuildCap` / `CCopyType` | Construct capabilities | Only from existing capabilities or privileged roots |

The tag discipline closes the loop: any attempt to forge a capability in memory (writing bytes that merely *look like* a capability) clears the tag, so the forged value can never be dereferenced or used as a sealing key [6].

### 4.2 Morello-Cerise: machine-checked strong encapsulation

A central question for any architectural security feature is whether the ISA specification itself guarantees the intended properties — because if the specification is flawed, every conforming implementation is exploitable, and late discovery may require impractically large hardware changes [3]. Morello-Cerise addresses this for the Arm Morello capability architecture: it proves **strong encapsulation** for a realistic compartmentalization model in Isabelle/HOL, against the Sail formalization of the Morello ISA from which emulators and documentation are auto-generated [3].

The proof's structure is instructive:

1. **Model**: compartments as closed graphs of capabilities; a compartment's state includes its reachable capabilities.
2. **Invariant**: monotonicity of all ordinary instructions (the "no amplification" lemma).
3. **Domain transition**: the *only* non-monotone step is the controlled transition (sealed-pair invocation), whose effects are characterized exactly.
4. **Result**: a compartment cannot access, forge, or amplify authority over memory outside its reachable set, and cannot observe other compartments' private state except through explicit shared capabilities.

### 4.3 The 128-bit capability format in detail

The Morello capability is 129 bits: 128 bits of value plus one tag bit. The compressed fields (following ISA v8 terminology [1]):

- **`a`** (64 bits): the address/cursor — the actual pointer value used for dereference.
- **`B`, `T`** (compressed): bounds fields encoding base and top relative to `a` with exponent `E`.
- **`E`** (6 bits, bottom 2 ignored): exponent controlling precision; larger objects get coarser bounds granularity.
- **Permissions** (~18 bits): load, store, execute, and capability-management rights.
- **`otype`** (24 bits): object type when sealed; reserved otherwise.
- **Flags**: sealed bit and others.

![CHERI capability monotonicity derivation tree](/thesis/ths_1788877759022_a887-1.webp)

The compression is *lossy by design*: bounds for large, poorly aligned objects round outward, and the allocator must pad. When sealed, only the top 8 bits of `B` and `T` survive, imposing stricter alignment [1] — a deliberate trade keeping precision where most vulnerabilities live.

### 4.4 Sealed capabilities and the domain-crossing trampoline

Compartmentalization in CHERI decomposes a program into **protection domains** within a single address space. The mechanism, as realized in CompartOS [4] and CheriRTOS [7], works as follows:

1. **Sealed entry points**: each compartment exposes its API as sealed code/data capability pairs with a private `otype`.
2. **Trampoline**: a small read-only trampoline performs domain switches — storing the caller's context, installing the callee's *captable* (capability table) and compartment ID, then jumping via the interface capability [4].
3. **CCall semantics**: invoking a sealed pair with a matching key atomically unseals and transfers control; the hardware (or trusted trampoline) guarantees the callee receives *only* the capabilities explicitly passed plus its own.
4. **Return**: the trampoline restores the caller's context, captable, and ID [4].

The compartment switch cost is a few capability-register moves plus a jump — orders of magnitude cheaper than MMU-based IPC, which prior work measured at up to 300× the cost of an ordinary call in Firefox compartmentalization studies [3], with CHERI prototypes showing ~90% reductions in IPC overhead [5].

### 4.5 The Morello silicon evaluation

Arm's Morello is a Neoverse-class out-of-order core at 2.5 GHz in TSMC N7 (~110 mm²), the first high-performance silicon implementation of CHERI-style capabilities [5]. Key evaluation findings reported:

- **Pure-capability ABI overhead**: generally 0–5%, with some pointer-dense workloads higher — the cost of 128-bit pointer loads/stores, bounds checks on every load/store/branch (decompressed in parallel with address generation), and tag-bit transport through the memory hierarchy [5].
- **Tag storage**: 1 bit per 16 bytes of data, carried on existing bus signals to avoid protocol churn [5].
- **Compartmentalization**: fine-grained in-address-space isolation with dramatically lower domain-crossing cost than MMU techniques [5].
- **Mitigation coverage**: retrospective analysis suggests ~2/3 of memory-safety vulnerabilities mitigated, consistent with Microsoft's independent 42-page security analysis of the CHERI ISA [5].

![Compartmentalization architecture with domain-crossing trampoline](/thesis/ths_1788877759022_a887-2.webp)

---

## 5 Empirical Results and Proofs

### 5.1 What is proved

| Artifact | Method | Claim |
|---|---|---|
| CHERI Concentrate decode/pointer-modify | HOL4 machine-checked proof | Decode and pointer arithmetic are correct w.r.t. the abstract capability model [2] |
| Morello-Cerise encapsulation | Isabelle/HOL over Sail ISA spec | Compartments cannot amplify or escape their reachable capability set [3] |
| CHERI ISA refinement | L3/Sail auto-generated emulators | Hardware (Bluespec/FPGA) tested against generated emulators; software stack (FreeBSD, Clang/LLVM, OpenSSH, PostgreSQL, nginx) runs above them [1] |

### 5.2 What is measured

- **CHERI Concentrate**: 50–75% fewer L2 misses than 256-bit capabilities on compiled C benchmarks; zero added load-to-use delay [2].
- **Morello**: 0–5% overhead for pure-capability code on most workloads; pointer-heavy workloads worse [5].
- **Cornucopia** (temporal safety via sweeping revocation): with a second thread/core, geometric-mean overhead ~1.9% (worst 8.9%) on CHERI-adapted SPEC CPU2006 — demonstrating that *temporal* safety, which CHERI hardware does not provide directly, is achievable at low cost in software [6].
- **Compartment switching**: ~90% reduction in IPC overhead versus MMU-based approaches in early FPGA benchmarks [5]; CompartOS demonstrates the trampoline model on embedded RTOS targets [4].

![Morello pure-capability ABI performance overhead](/thesis/ths_1788877759022_a887-3.webp)

### 5.3 What the numbers mean

The performance story has a clear moral: spatial safety via capabilities is *cheap* once the encoding is right (Concentrate's compression and parallel decompression), while temporal safety and compartmentalization policy remain software problems with bounded, measurable costs. The 0–5% Morello figure places hardware memory safety in the same cost bracket as the mitigations it would replace — but deterministic and secret-free.

## 6 Limitations

**Temporal safety is not architectural.** CHERI provides strong *spatial* safety; use-after-free requires software revocation — sweeping memory to invalidate capabilities to freed objects. Cornucopia shows this can be done at ~1.9% geomean with a spare core, but it is not free, not always on, and pause times run 10–20% of a single-threaded sweep [6]. Capabilities deliberately do not solve this in hardware.

**The hybrid ABI is a migration tax.** Pure-capability code requires recompilation and minor source changes; the hybrid ABI (capabilities alongside integer pointers) eases migration but reintroduces exactly the confused-deputy hazards the architecture exists to remove, wherever raw pointers persist. Real codebases are large; the CheriBSD and Linux ports are multi-year efforts.

**Compartmentalization is not a panacea — and it has been bypassed.** The ANU security analysis of CheriBSD and Morello Linux details four ways to bypass compartmentalization in practice, concluding that while memory-corruption attacks are mitigated, the compartmentalization mechanisms are less effective at containing malicious code, and that simple bugs can still allow escape [8]. The lesson: CHERI raises the bar from "exploit a buffer overflow" to "find a logic bug in the compartmentalization policy or its trusted code" — a genuine improvement, but the trusted computing base of the trampoline, linker, and loader is now the security-critical code, and it must be audited as such.

**Compression imposes allocator constraints.** Bounds rounding means allocators must pad and align; "spatial safety" for large objects degrades to non-aliasing guarantees rather than trapping precision [6]. Sealed capabilities demand even stricter alignment [1].

**Tag-bit and pointer-size costs are real.** Doubling pointer size stresses caches and memory bandwidth for pointer-dense workloads — the workloads where Morello's overhead exceeds the 0–5% band [5].

## 7 Conclusion

CHERI's thesis is that memory safety is an *architectural* problem with an architectural solution: make pointers unforgeable, bound every dereference, and enforce monotonicity so authority can only shrink. The evidence assembled here — the Concentrate encoding with its machine-checked decode, the Morello-Cerise encapsulation proof over the actual Sail specification, and the Morello silicon evaluation at 0–5% overhead — is the strongest case yet that this thesis is not merely true in principle but *deployable in practice*.

The compartmentalization story is the deeper payoff. Memory safety protects a program from its own bugs; compartmentalization protects a system from its compromised components. CHERI unifies both under one primitive — the sealed capability — and one invariant — monotonicity — with domain-crossing costs low enough to make fine-grained decomposition practical rather than aspirational.

The honest boundary of the claim is equally clear: temporal safety remains software's job, the hybrid ABI is a long migration, compartmentalization policy can still be wrong, and the proofs cover the architecture, not its side channels. CHERI does not end the security arms race. It moves the front line from probabilistic mitigation of symptoms to deterministic enforcement of authority — and that is a move worth making.

---

## References

[1] R. N. M. Watson et al., "Capability Hardware Enhanced RISC Instructions: CHERI Instruction-Set Architecture (Version 8)," University of Cambridge Computer Laboratory Technical Report UCAM-CL-TR-951. [https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-951.pdf](https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-951.pdf)

[2] J. Woodruff et al., "CHERI Concentrate: Practical Compressed Capabilities," *IEEE Transactions on Computers*, vol. 68, no. 10, pp. 1455–1469, Oct. 2019. doi:10.1109/TC.2019.2914037. [https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/2019tc-cheri-concentrate.pdf](https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/2019tc-cheri-concentrate.pdf)

[3] K. Memarian et al., "Morello-Cerise: A Proof of Strong Encapsulation for the Arm Morello Capability Hardware Architecture," PLDI 2025 (camera-ready). [https://www.cl.cam.ac.uk/~pes20/pldi25-paper646-camera-ready.pdf](https://www.cl.cam.ac.uk/~pes20/pldi25-paper646-camera-ready.pdf)

[4] H. Xia et al., "CompartOS: CHERI Compartmentalization for Embedded Systems," arXiv:2206.02852. [http://arXIV.org/pdf/2206.02852](http://arXIV.org/pdf/2206.02852)

[5] Arm / Cadence, "HOT CHIPS: Arm's Morello," *Breakfast Bytes* (Morello prototype disclosure: 2.5 GHz Neoverse-class SoC, TSMC N7, pure-capability ABI overhead 0–5%). [https://community.cadence.com/cadence_blogs_8/b/breakfast-bytes/posts/hot-chips-arm-s-morello](https://community.cadence.com/cadence_blogs_8/b/breakfast-bytes/posts/hot-chips-arm-s-morello)

[6] University of Cambridge, "CHERI Frequently Asked Questions (FAQ)." [https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/cheri-faq.html](https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/cheri-faq.html)

[7] R. N. M. Watson et al., "CheriRTOS: A Capability Model for Embedded Devices," ICCD 2018. [http://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/201810-iccd2018-cheri-rtos.pdf](http://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/201810-iccd2018-cheri-rtos.pdf)

[8] ANU Open Research Repository, "A Security Analysis of CheriBSD and Morello Linux." [https://openresearch-repository.anu.edu.au/entities/publication/d9479edf-b360-4e31-9259-d7a5c2071bd7](https://openresearch-repository.anu.edu.au/entities/publication/d9479edf-b360-4e31-9259-d7a5c2071bd7)

[9] Arm Limited, "Morello Supplement to the Procedure Call Standard for the Arm 64-bit Architecture (AArch64)" (AAPCS64-morello). [https://github.com/ARM-software/abi-aa/releases/download/2020Q4/aapcs64-morello.pdf](https://github.com/ARM-software/abi-aa/releases/download/2020Q4/aapcs64-morello.pdf)
