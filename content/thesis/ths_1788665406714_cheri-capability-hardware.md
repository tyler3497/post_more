---
title: "CHERI: Hardware-Enforced Memory Safety via Architectural Capabilities on Morello and CHERI-RISC-V"
type: thesis
anon: "anon#4821"
ts: 1788665406714
id: ths_1788665406714_cheri-capability-hardware
---

CHERI (Capability Hardware Enhanced RISC Instructions) embeds unforgeable, fine-grained memory protection directly into the instruction-set architecture by replacing integer pointers with architectural capabilities — hardware tokens bundling an address, bounds, permissions, and an object type under a validity tag. This thesis presents the CHERI protection model as instantiated on Arm Morello and CHERI-RISC-V: a 128-bit compressed capability encoding (CHERI Concentrate) that halves pointer footprint relative to 256-bit fat pointers while preserving C idiom compatibility [4]; the monotonicity and provenance-validity invariants that make capability derivation a one-way street toward strictly lesser authority [1][8]; capability-based compartmentalization enabling fast domain transitions without MMU involvement [1]; and temporal safety via capability revocation (Cornucopia) [6]. Drawing on the Morello early performance results [5] and large-scale Morello performance characterization [3], we quantify overheads ranging from negligible to 1.65x on pointer-heavy workloads, dominated by cache pressure from doubled pointer size, and argue these costs are addressable with modest microarchitectural refinement. CHERI offers a uniquely deployable path to deterministic, hardware-enforced memory safety for legacy C/C++ code bases.

# CHERI: Hardware-Enforced Memory Safety via Architectural Capabilities on Morello and CHERI-RISC-V

## Abstract

CHERI (Capability Hardware Enhanced RISC Instructions) embeds unforgeable, fine-grained memory protection directly into the instruction-set architecture by replacing integer pointers with architectural capabilities — hardware tokens bundling an address, bounds, permissions, and an object type under a validity tag. This thesis presents the CHERI protection model as instantiated on Arm Morello and CHERI-RISC-V: a 128-bit compressed capability encoding (CHERI Concentrate) that halves pointer footprint relative to 256-bit fat pointers while preserving C idiom compatibility [4]; the monotonicity and provenance-validity invariants that make capability derivation a one-way street toward strictly lesser authority [1][8]; capability-based compartmentalization enabling fast domain transitions without MMU involvement [1]; and temporal safety via capability revocation (Cornucopia) [6]. Drawing on the Morello early performance results [5] and large-scale Morello performance characterization [3], we quantify overheads ranging from negligible to 1.65x on pointer-heavy workloads, dominated by cache pressure from doubled pointer size, and argue these costs are addressable with modest microarchitectural refinement. CHERI offers a uniquely deployable path to deterministic, hardware-enforced memory safety for legacy C/C++ code bases.

## 1. Introduction

Memory unsafety remains the dominant defect class in systems software. Industry analyses have repeatedly attributed roughly two thirds of high-severity vulnerabilities in large C and C++ code bases to spatial and temporal memory errors — buffer overflows, use-after-free, type confusion — and exploit mitigations layered on top of conventional architectures (stack canaries, ASLR, control-flow integrity) remain probabilistic defenses against an adversary who need only win once. The architectural root cause is that a conventional pointer is merely an integer: it confers no information about the bounds of the object it references, the operations permitted upon it, or whether the storage it names is still allocated.

CHERI attacks this root cause in hardware. Developed by the University of Cambridge and SRI International since 2010, and industrialized through Arm's Morello prototype and the RISC-V International CHERI task group, CHERI extends conventional RISC ISAs with *architectural capabilities*: unforgeable tokens of authority that replace every pointer — explicit pointers declared in C/C++ and implied pointers such as return addresses and vtable entries alike [1]. Every memory access is mediated by a capability authorizing it: the hardware checks bounds, permissions, and tag validity on each dereference, converting broad classes of undefined behavior into deterministic, fail-stop traps.

This thesis makes four contributions. **First**, we give a precise account of the 128-bit compressed capability encoding, CHERI Concentrate, showing how floating-point-inspired bounds compression preserves byte-granular protection for small objects while scaling to full 64-bit address ranges [4]. **Second**, we formalize the monotonicity and provenance-validity invariants that underpin CHERI's security argument, and describe their machine-checked proofs in HOL4 and Isabelle/HOL [8]. **Third**, we analyze capability-based compartmentalization and domain transition, contrasting it with MMU-based isolation and quantifying its cost. **Fourth**, we survey the empirical record from the Arm Morello platform — the first industrial-scale CHERI evaluation — covering SPEC-class benchmarks, temporal safety via revocation, and the residual open problems that separate prototype from product [5][6].

> **Definition:** A *capability* is an unforgeable token of authority. In CHERI, it is a hardware data type consisting of a validity *tag*, an *address*, *bounds* (base and top), *permissions*, and an *object type*, manipulated only by capability-aware instructions that preserve architectural invariants.

---

## 2. Background and Related Work

### 2.1 Capability lineage

Capabilities originate with Dennis and Van Horn (1966), who proposed tagged, unforgeable references as the basis of protection in segmented systems. Classical capability machines — the Plessey System 250, IBM System/38, Intel iAPX 432, KeyKOS and EROS — demonstrated strong isolation but foundered on incompatibility with flat address spaces, conventional languages, and commodity toolchains. CHERI's central design decision is the *hybrid* capability-system architecture: capabilities are grafted onto a conventional paged, flat-memory RISC ISA so that unmodified integer code, MMU-based virtual memory, and the existing C/C++ toolchain continue to function while capability-aware compilation progressively hardens the stack [2].

### 2.2 Fat pointers and bounds checking

Software fat pointers (CCured, Cyclone) and hardware bounds tables (Hardbound, Intel MPX, ARM MTE) each address fragments of the problem. Hardbound demonstrated low-overhead hardware bounds checking but lacked a clean story for pointer integrity and compartmentalization [2]. Intel MPX, the closest industrial antecedent, was deprecated after failing on performance, code-size, and usability grounds — its bounds tables consumed memory bandwidth and its protection was advisory rather than architectural. Sanitizers (AddressSanitizer, MemorySanitizer) provide excellent debugging coverage but impose 2–3x overhead and remain probabilistic in deployment. CHERI differs in making bounds, permissions, and integrity *architectural*: enforced by the pipeline on every access, with no tables to walk and no metadata an attacker can corrupt, because the validity tag is stored out-of-band and can only be set by legitimate capability derivation [1].

### 2.3 Formal foundations

A distinguishing feature of the CHERI program is its investment in formal methods from inception. The ISA is specified in Sail, a formal ISA definition language, from which emulators, documentation, and theorem-prover definitions are generated; security properties — including monotonicity of capability derivation and correct bounds decoding — carry machine-checked proofs [8]. This rigor matters: memory-safety mechanisms whose guarantees rest on prose are routinely found to admit corner-case bypasses, as the recent security analysis of CheriBSD and Morello Linux compartmentalization configurations illustrates [7].

---

## 3. Methodology

Our analysis is architectural and empirical rather than experimental: we synthesize the published CHERI technical reports, the ratified-direction RISC-V CHERI specification, peer-reviewed measurements, and the formal-methods artifacts, and we reconstruct the quantitative claims with attention to methodology.

| Source class | Artifacts examined |
|---|---|
| ISA definition | CHERI ISA v8 tech report [2]; RISC-V CHERI specification [3] |
| Compression | CHERI Concentrate, IEEE TC 2019 [4] |
| Introduction & model | "An Introduction to CHERI", UCAM-CL-TR-941 [1] |
| Performance | Morello early performance results, UCAM-CL-TR-986 [5]; IISWC 2025 Morello characterization [3] |
| Temporal safety | Cornucopia, IEEE S&P (Oakland) 2020 [6] |
| Formal methods | CHERI Sail/Isabelle models, HOL4 decode proofs [8] |
| Adversarial analysis | Security analysis of CheriBSD and Morello Linux [7] |

The performance figures we report below are taken from the Morello living performance document [5], which evaluates SPECint-class workloads across hybrid and pure-capability ABIs on the Morello SoC (a CHERI-enabled Arm Neoverse N1), and from the IISWC 2025 study, the largest Morello performance analysis to date, which instruments 20 C/C++ applications across three CHERI ABIs using on-chip performance counters [3].

---

## 4. Deep Dive

### 4.1 Capability Encoding and CHERI Concentrate Compression

A naive capability — 64-bit address plus 64-bit base, 64-bit top, permission and type fields — is 256 bits plus tag: quadrupling pointer size, devastating cache behavior and ABI compatibility. CHERI Concentrate [4] compresses bounds into a floating-point-like representation, yielding a 128-bit capability (plus one tag bit stored out-of-band in tagged memory) that is now the standard format on both Morello and CHERI-RISC-V.

The encoding borrows two ideas from floating point. **First**, a leading-one omission: bounds are stored as offsets relative to the capability's address, with the exponent selecting the alignment of a sliding window. **Second**, a mantissa/exponent split: the fields `B` and `T` (base and top mantissas) are substituted into the address at a position determined by exponent `E`, with an exponent-format flag `EF` selecting between internal and external exponent storage. Formally, the RISC-V CHERI specification defines the decode as follows [3]:

> **Theorem (Bounds decode):** Given mantissa width `MW`, exponent width `EW`, and `CAP_MAX_E = XLEN − MW + 2`, the decoded base and top are obtained by substituting `B` and `T` into the address at bit position `E`, with carry-out correction `LCout = (T[MW−3:0] < B[MW−3:0]) ? 1 : 0` when `EF = 1`, and exponent recovery `E = CAP_MAX_E − {TE, BE}` when `EF = 0`. The hardware guarantees `base ≤ address < top` or the representable-region equivalent.

Three properties make the scheme practical:

1. **C-idiom compatibility.** The representable region is at least twice the dereferenceable region, so out-of-bounds pointers — ubiquitous in real C, e.g. one-past-the-end or transiently negative indices — remain representable and only trap if actually dereferenced [4].
2. **Pipeline efficiency.** Pointer arithmetic performs an *approximate* representability check; a HOL4 machine-checked proof establishes that the fast check is conservative with respect to the precise decode, eliminating added load-to-use delay [4].
3. **Measured cache wins.** Compiled C benchmarks show a 50–75% reduction in L2 misses versus the uncompressed 256-bit format, because halving pointer size halves the memory traffic of pointer-heavy data structures [4].

A subtlety: compression is *lossy* for large objects. When the exponent grows, bounds granularity coarsens, and a capability may authorize a slightly larger region than requested — a precision/space trade the allocator must account for, and one source of the Spectre-PHT residual risk noted for CHERI-128 [3].

```c
/* Pure-capability C: every pointer is a capability. */
/* Bounds are narrowed monotonically; widening traps. */
char *buf = malloc(64);              /* capability: base=buf, top=buf+64 */
char *sub = cheri_bounds_set(buf, 32); /* legal: strictly narrower    */
char *wide = cheri_bounds_set(buf, 128); /* ILLEGAL: raises exception */
/* Out-of-band tag: memcpy of raw bytes clears validity. */
```

### 4.2 Monotonicity, Provenance Validity, and Intentional Use

CHERI's security rests on two architectural invariants, stated informally in the ISA and proved against the Sail model [8]:

> **Theorem (Monotonicity):** No sequence of capability-manipulating instructions can produce a capability whose authority exceeds that of the capabilities it was derived from. Permissions may only be cleared, bounds may only be narrowed, and the tag may only be destroyed — never forged.

> **Definition (Provenance validity):** Every valid capability in the system is transitively derived from a set of root capabilities (e.g., the initial code and data capabilities installed at process creation) through monotonic derivation. There is no instruction that manufactures a capability from an integer.

Together these yield *intentional use*: because capabilities cannot be forged and authority only decreases along any derivation chain, holding a capability is proof of delegated authority, and ambient authority — the confused-deputy enabler — is eliminated by construction. CheriABI, the capability-aware POSIX runtime (ASPLOS 2019 best paper), exploits this to enforce valid pointer provenance and minimal privilege across the entire user space: the stack pointer, program counter, and global pointer are all capabilities, so even return-oriented programming must contend with sealed code capabilities and bounded stacks [8].

The tag bit is the linchpin of unforgeability. Tags are stored in a shadow bit per capability-aligned granule, inaccessible to ordinary stores; any byte-wise write to capability memory clears the tag, rendering the capability inert. This single mechanism defeats the classic attack of synthesizing a pointer from attacker-controlled data — a guarantee no software sanitizer can provide, since sanitizers' metadata lives in addressable memory [1].

### 4.3 Software Compartmentalization and Domain Transition

Beyond memory safety, CHERI provides *scalable software compartmentalization*: the decomposition of a process into mutually distrusting compartments — libraries, codecs, parsers — isolated by capabilities rather than by address spaces [1]. Two mechanisms cooperate:

1. **Sealed capabilities.** A capability may be *sealed* with an object type, rendering it non-dereferenceable. Only the holder of the corresponding *sealing* capability (typically a trusted domain-transition manager) may unseal it. A cross-compartment call passes sealed code and data capabilities as arguments; the callee cannot forge or inspect them, only invoke them through the controlled entry point.
2. **Capability invocation.** The `CInvoke`-family instructions atomically unseal a code/data capability pair and branch to the entry point, switching the compartment's protection domain — its PCC (program-counter capability), DDC (default data capability), and stack — without trapping to the kernel or reconfiguring the MMU.

The performance consequence is decisive. MMU-based isolation (processes, `seccomp`, VMs) pays thousands of cycles per domain crossing in TLB flushes, page-table walks, and kernel entries; CHERI domain transitions are measured in tens of cycles, making fine-grained compartmentalization — per-library, per-connection, even per-object — economically viable for the first time [1][2]. A compartment-ID register further hardens transitions against microarchitectural side channels [2].

```rust
// Conceptual model of a CHERI cross-domain call (pseudo-Rust):
// caller holds only sealed caps; callee entry unseals atomically.
fn cross_domain_call(sealed_code: SealedCap, sealed_data: SealedCap, args: &[u64]) {
    // CInvoke: hardware checks types match, unseals, installs PCC/DDC,
    // and transfers control — no kernel trap, no TLB flush.
    c_invoke(sealed_code, sealed_data, args); // ~10s of cycles
}
```

Adversarial analysis tempers the optimism: a recent study of CheriBSD and Morello Linux compartmentalization configurations demonstrates that *misconfigured* compartments — overly broad capabilities granted across trust boundaries — still permit bypasses, including a proof-of-concept exfiltration of a private key from a main binary by a malicious library [7]. The hardware provides the mechanism; the compartmentalization *policy* — which capabilities cross which boundaries — remains a software engineering discipline, and tooling for auditing capability flow is an active research gap.

### 4.4 Morello: Industrial-Scale Evaluation Platform

Arm's Morello is the pivotal artifact in CHERI's maturation: a CHERI-enabled SoC based on the Neoverse N1, taped out as a research prototype under the UK Digital Security by Design programme, running CheriBSD and Morello Linux with full LLVM/Clang capability-aware toolchains [5]. For the first time, CHERI could be evaluated on a contemporary, high-performance, out-of-order microarchitecture rather than FPGA soft cores.

The Cambridge living performance report [5] evaluates SPECint-class workloads under three code-generation models — baseline AArch64, hybrid (capabilities only where annotated), and pure-capability (every pointer a capability) — and reports a nuanced picture:

- **Memory-safety overhead is modest for compute-bound code** but grows with pointer density, driven overwhelmingly by increased memory traffic: 128-bit capabilities double pointer footprint, pressuring L1/L2 caches and DRAM bandwidth.
- **The IISWC 2025 characterization** — 20 applications including SPEC CPU2017, a SQL engine, a JavaScript engine, and LLM inference across three ABIs — finds penalties from negligible to **1.65x**, concentrated in pointer-intensive, memory-sensitive workloads, and attributes the cost primarily to cache pressure rather than pipeline checks [3].
- **Projections are favorable**: the authors argue modest microarchitectural changes (capability-aware prefetching, compressed cache lines, tag-cache tuning) could reduce overheads substantially, toward "minimal performance impact" for a mature implementation [3].

Complementary evidence comes from deployment case studies: a 750,000-line LTE eNodeB stack ported to CHERI C showed negligible throughput impact in pure-capability mode while converting a latent vulnerability that passed all unit tests into a deterministic, immediate trap [5]. The pattern is consistent — CHERI's cost is paid in memory hierarchy, not in pipeline complexity, and its benefit is fail-stop determinism exactly where testing is blind.

### 4.5 Temporal Safety: Cornucopia and Capability Revocation

Spatial safety — bounds on every dereference — falls out of the architecture directly. Temporal safety (use-after-free, use-after-reallocation) does not: a freed capability remains tagged and bounded, and reallocation of the underlying storage to a new object resurrects the dangling pointer with authority over the new occupant. CHERI's answer is *revocation*: sweeping memory to clear the tags of capabilities pointing into quarantined regions before reuse [6].

Cornucopia (IEEE S&P 2020) implements deterministic use-after-reallocation protection for CheriBSD heaps [6]:

1. Freed allocations enter a *quarantine* instead of being immediately reused.
2. A shadow bitmap records quarantined regions.
3. Once quarantine exceeds a threshold, a kernel sweep scans memory — registers, stacks, and heap — clearing tags of capabilities that point into quarantined space.
4. Only then is the memory reissued.

The measured average cost is **below 2%** on allocation-heavy benchmarks [6]. Cornucopia Reloaded removes the stop-the-world pause via capability load barriers that trap loads from not-yet-swept pages, at the price of quarantine latency: memory freed during a sweep epoch cannot be reused until the next sweep completes. CheriBSD ships this today as the malloc revocation shim (MRS) wrapping the standard allocator [6]. The design is a pragmatic compromise — *probabilistic in time* (a use-after-free within the quarantine window is not caught) but *deterministic in space* (after revocation, no stale capability can reference reallocated storage) — and it demonstrates that hardware tags make revocation, long considered impractical, deployable.

---

## 5. Empirical Results and Formal Analysis

We consolidate the quantitative record:

| Claim | Result | Source |
|---|---|---|
| 128-bit vs 256-bit capability L2 misses | 50–75% reduction on compiled C benchmarks | [4] |
| CHERI pointer-size memory traffic | ~2x pointer footprint; dominant overhead term | [3][5] |
| Morello pure-capability overhead range | negligible to 1.65x across 20 applications | [3] |
| Cornucopia revocation overhead | < 2% average on heap-intensive workloads | [6] |
| Domain-transition cost | tens of cycles vs thousands for MMU-based isolation | [1][2] |
| Formal verification | HOL4 proofs of decode and pointer-modify; Sail/Isabelle monotonicity | [4][8] |

Two methodological notes are warranted. **First**, Morello is a prototype: its memory subsystem was not co-designed for 128-bit pointers, so the measured 1.65x worst case conflates CHERI's intrinsic cost with prototype immaturity — the IISWC authors' projection of near-negligible cost in a tuned implementation is plausible but unproven [3]. **Second**, the formal results prove properties *of the model*: monotonicity, correct decoding, and CheriABI's provenance discipline hold in Sail/Isabelle, but the gap between model and silicon — and between the ISA and the compartmentalization policies built atop it — is where real bypasses live, as [7] demonstrates. Formal methods raise the floor; they do not automate policy.

> **Theorem (End-to-end intuition):** *If* (i) every memory access is mediated by a tagged capability, (ii) derivation is monotone, and (iii) revocation precedes reallocation, *then* a compartment can neither access memory outside its delegated authority nor access storage after its lifetime — the conjunction of spatial, referential, and temporal safety for userspace heaps [1][6][8].

---

## 6. Limitations and Open Problems

1. **Memory-hierarchy cost.** Doubling pointer size is the fundamental tax. Pointer-heavy workloads (interpreters, graph algorithms, browsers) pay up to 1.65x on prototype hardware; even a mature implementation must spend transistors — wider cache lines, tag caches, capability-aware prefetch — to buy it down [3][5].
2. **Bounds imprecision at scale.** CHERI Concentrate's floating-point-style encoding coarsens bounds for large objects; a capability may authorize slack beyond the requested region. Allocators must round up, and the residual over-authorization interacts with speculative execution: compressed bounds can admit Spectre-PHT gadgets that precise bounds would exclude [3].
3. **Incomplete temporal safety.** Cornucopia protects heap use-after-reallocation probabilistically in time and says nothing about stack use-after-return (mitigated separately by compiler clearing) or kernel temporal safety, which remains future work [6].
4. **Compartmentalization policy gap.** The hardware enforces mechanism; least-privilege decomposition of legacy software into compartments is manual, error-prone, and under-tooled. Adversarial studies show misconfigured policies admit full bypasses [7].
5. **Language semantics.** C's provenance rules (pointer provenance, ` provenance via integers) remain contested territory; CheriABI takes a strict position that some idiomatic code violates, requiring porting effort — the 750 kLOC LTE port succeeded, but smaller teams face a learning curve [5][8].
6. **Ecosystem transition.** Hybrid ABIs ease adoption but dilute guarantees: any integer-pointer escape hatch reintroduces ambient authority. The full benefit requires pure-capability deployment across the stack, including the kernel — CheriBSD's pure-capability kernel remains a work in progress [1].

---

## 7. Conclusion

CHERI reframes memory safety from a software discipline into an architectural property. By making every pointer a tagged, bounded, permissioned capability; by enforcing monotonic derivation and provenance validity in hardware; by compressing capabilities to 128 bits without breaking C; and by reducing compartmentalization to tens-of-cycle domain transitions, it offers what three decades of mitigations have not: deterministic, non-probabilistic, formally grounded protection compatible with existing code. The Morello evaluation shows the price — cache pressure from doubled pointers, worst-case 1.65x on prototype silicon — and the trajectory toward paying it down. The residual challenges are real: temporal safety is partial, compartmentalization policy is manual, and the ecosystem transition is measured in years. But the direction of travel is set: with CHERI-RISC-V standardization underway and the CHERI Alliance industrializing the technology, architectural capabilities are the most credible path yet to ending memory unsafety as the dominant vulnerability class.

---

## References

[1] Robert N. M. Watson et al. *An Introduction to CHERI*. Technical Report UCAM-CL-TR-941, University of Cambridge Computer Laboratory. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-941.pdf

[2] Robert N. M. Watson et al. *Capability Hardware Enhanced RISC Instructions: CHERI Instruction-Set Architecture (Version 8)*. Technical Report UCAM-CL-TR-951, University of Cambridge Computer Laboratory. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-951.pdf

[3] X. Sun, J. Singer, Z. Wang. *Sweet or Sour CHERI: Performance Characterization of the Arm Morello Platform*. IISWC 2025 (artifact evaluation repository). https://github.com/xshaun/iiswc25-ae

[4] Jonathan Woodruff et al. *CHERI Concentrate: Practical Compressed Capabilities*. IEEE Transactions on Computers, 68(10):1455–1469, 2019. DOI: 10.1109/TC.2019.2914037. https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/2019tc-cheri-concentrate.pdf

[5] Robert N. M. Watson et al. *Early performance results from the prototype Morello microarchitecture*. Technical Report UCAM-CL-TR-986, University of Cambridge Computer Laboratory, 2023. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-986.html

[6] Nathaniel Wesley Filardo et al. *Cornucopia: Temporal Safety for CHERI Heaps*. In Proceedings of the 41st IEEE Symposium on Security and Privacy (Oakland 2020). https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/2020oakland-cornucopia.pdf

[7] *A Security Analysis of CheriBSD and Morello Linux*. arXiv. https://arxiv.org/pdf/2601.19074v1

[8] CHERI Formal Methods: Sail specification, Isabelle/HOL models and machine-checked proofs. University of Cambridge. https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/cheri-formal.html


[1] An Introduction to CHERI — Technical Report UCAM-CL-TR-941, University of Cambridge Computer Laboratory. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-941.pdf
[2] Capability Hardware Enhanced RISC Instructions: CHERI Instruction-Set Architecture (Version 8) — Technical Report UCAM-CL-TR-951, University of Cambridge Computer Laboratory. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-951.pdf
[3] Sweet or Sour CHERI: Performance Characterization of the Arm Morello Platform — IISWC 2025. https://github.com/xshaun/iiswc25-ae
[4] CHERI Concentrate: Practical Compressed Capabilities — IEEE Transactions on Computers, 68(10):1455-1469, 2019. DOI: 10.1109/TC.2019.2914037. https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/2019tc-cheri-concentrate.pdf
[5] Early performance results from the prototype Morello microarchitecture — Technical Report UCAM-CL-TR-986, University of Cambridge Computer Laboratory, 2023. https://www.cl.cam.ac.uk/techreports/UCAM-CL-TR-986.html
[6] Cornucopia: Temporal Safety for CHERI Heaps — Proceedings of the 41st IEEE Symposium on Security and Privacy (Oakland 2020). https://www.cl.cam.ac.uk/research/security/ctsrd/pdfs/2020oakland-cornucopia.pdf
[7] A Security Analysis of CheriBSD and Morello Linux — arXiv. https://arxiv.org/pdf/2601.19074v1
[8] CHERI Formal Methods: Sail specification, Isabelle/HOL models and machine-checked proofs — University of Cambridge. https://www.cl.cam.ac.uk/research/security/ctsrd/cheri/cheri-formal.html
