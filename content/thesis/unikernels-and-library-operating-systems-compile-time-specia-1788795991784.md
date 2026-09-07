---
id: ths_1788798736891_801f
title: "Unikernels and Library Operating Systems: Compile-Time Specialization in MirageOS, Single-Address-Space Semantics, and the Return of the Exokernel Vision"
anon: anon#3739
ts: 1788795991784
type: thesis
images: ["ths_1788798736891_801f-0.webp", "ths_1788798736891_801f-1.webp", "ths_1788798736891_801f-2.webp", "ths_1788798736891_801f-3.webp"]
---

# Unikernels and Library Operating Systems: Compile-Time Specialization in MirageOS, Single-Address-Space Semantics, and the Return of the Exokernel Vision

## Abstract

This thesis presents a comprehensive treatment of **unikernels** — single-purpose, single-address-space machine images that collapse application and operating system into one sealed, compile-time-specialized artifact. We trace the lineage from the exokernel [7] through Nemesis and SPIN to the modern renaissance: MirageOS [1][2], Solo5 [5], IncludeOS, HermiTux [4], and Unikraft [9]. The central mechanism is *whole-stack specialization*: linking only the drivers, protocol stacks, and runtime components the application requires yields megabyte images and millisecond boots [1][6]. We analyze MirageOS's OCaml functor architecture, Solo5's narrow hypercall ABI and deterministic tender model, and the security consequences of erasing the user/kernel boundary — arguing that reduced attack surface, type-safe runtimes, and hypervisor-mediated immutability compensate for the lost privilege boundary [1][3]. Quantitative comparisons cover image size, boot latency, throughput, and syscall surface against containers, Firecracker microVMs [8], and full VMs. We examine storage, networking, debugging, and verification, and close with limitations — driver coverage, POSIX compatibility, SMP maturity — and the role of unikernels in NFV, edge, and serverless.

## 1. Introduction

Modern cloud software stacks are archaeological strata: application code rests upon language runtimes, libc, a full POSIX kernel, device drivers emulating 1980s disk standards, and a hypervisor — each layer optimizing for generality that a single-purpose service never exercises [2]. Two dominant deployment abstractions manage this sediment. *Containers* share one monolithic kernel, trading isolation strength for density and speed. *Virtual machines* replicate the entire general-purpose operating system, trading efficiency for strong hardware-enforced isolation. Neither abstraction questions whether the general-purpose kernel belongs in the deployment unit at all.

Unikernels pose precisely that question. A unikernel is a *library operating system* — OS functionality re-expressed as libraries linked directly against the application — compiled into a standalone image that executes in a single address space, typically atop a thin hypervisor interface [1]. There is no shell, no `/etc/passwd`, no process boundary to cross; a network service *is* the operating system it runs on. This inversion of the layering assumption yields three concrete dividends: an order-of-magnitude reduction in code size and image footprint [1]; boot latencies competitive with process creation rather than machine boot [5]; and an attack surface reduced to the minimal set of hypercalls the tender exposes — roughly a dozen calls versus the 350+ system calls of Linux [5].

The idea is not new. Engler, Kaashoek, and O'Toole's exokernel (1995) argued that the kernel should expose hardware safely rather than abstract it, pushing resource management into application-linked libraries [7]. Nemesis, SPIN, and the Flux OSKit pursued variants of this program through the late 1990s. What changed is the *platform*: the hypervisor has become a stable, narrow, widely deployed machine abstraction, dissolving the hardware-compatibility objection that made past library operating systems impractical [1]. MirageOS (2013) demonstrated the synthesis at scale — a complete, type-safe TCP/IP stack, TLS, DNS, and HTTP in OCaml, compiled to Xen and later KVM guests booting in milliseconds [1][2].

This thesis develops the argument that unikernels constitute the most coherent contemporary realization of the exokernel vision, and that their compile-time specialization model — most sharply articulated in MirageOS's module functors — represents a principled alternative to both containerization and microVM-based isolation for single-purpose cloud services.

The remainder of this thesis is organized as follows. Section 2 surveys the historical background and the design space. Section 3 describes our methodology: how we characterize, measure, and compare unikernel systems. Section 4 develops the technical deep dive across four axes — architecture, the functor model, the single-address-space security argument, and the Solo5 execution environment. Section 5 presents empirical results and proof sketches. Section 6 confronts limitations honestly. Section 7 concludes.

---

## 2. Background

### 2.1 The Exokernel Lineage

The exokernel paper [7] proposed a radical reorganization: the kernel should multiplex hardware *securely* while exposing it *directly*, and all higher-level abstractions — virtual memory policies, file systems, scheduling disciplines — should live in application-level *library operating systems* (libOSes). The kernel's trusted computing base shrank to protection, multiplexing, and revocation; everything else moved into libraries where applications could customize or replace it. This is the direct intellectual ancestor of the unikernel: a libOS bound to a single application, sealed at build time, and deployed as a self-contained unit.

The 1990s libOS program produced Nemesis (Cambridge), SPIN (Washington), and Vino, but deployment foundered on hardware diversity: every bare-metal target required driver ports, and the economics of driver maintenance favored monolithic kernels with broad hardware support. The hypervisor, as MirageOS's authors observe, rescues the program: it presents a *stable virtual hardware* interface, so a library OS need only target one narrow paravirtual ABI rather than the menagerie of physical devices [1].

### 2.2 The Modern Unikernel Ecosystem

Several systems now populate the design space:

1. **MirageOS** — OCaml library OS; applications are functors parameterized over network, block, clock, and entropy implementations; targets include Xen, KVM (via Solo5), and UNIX (as ordinary processes for development) [1][2].
2. **Solo5** — not itself a unikernel but a *sandboxed execution environment*: a minimal tender (`solo5-hvt`, ~130 KB) that loads a unikernel ELF and mediates a narrow hypercall ABI (block, net, console, clock) with seccomp confinement of the tender on Linux/KVM hosts [5]. It unifies MirageOS, IncludeOS, and rumprun targets under one interface.
3. **IncludeOS** — C++ unikernel with a minimal kernel service layer; its Solo5 port boots, executes, and exits in 4–5 ms [3].
4. **HermiTux** — a *binary-compatible* unikernel derived from HermitCore: unmodified Linux binaries run as unikernels via lightweight binary rewriting, removing the rewrite-everything cost while preserving the single-address-space model [4].
5. **Unikraft** — a modular unikernel SDK emphasizing *recompilation over rewriting*: existing applications are rebuilt against micro-libraries (`uk_*`) with a Kconfig-driven menu, dramatically lowering porting effort [9].
6. **OSv and Rump kernels** — OSv runs unmodified POSIX applications on a purpose-built kernel; rump kernels factor NetBSD drivers into reusable components [2].

### 2.3 Containers, MicroVMs, and the Isolation Spectrum

To situate unikernels, consider the isolation–density spectrum:

| Deployment unit | Kernel sharing | Typical image | Boot latency | Syscall/API surface |
|---|---|---|---|---|
| Container (Docker) | Shared host kernel | 100 MB – 1 GB | ~100–500 ms (process spawn + namespace setup) | Full Linux ABI (~350+ syscalls) |
| Firecracker microVM [8] | Guest kernel per VM | ~50–200 MB | ~125 ms | Full Linux ABI inside guest |
| Unikernel (MirageOS/Solo5) | Library OS per app | 1–20 MB | 4–30 ms | ~10–15 hypercalls [5] |
| Unikernel (IncludeOS/solo5-hvt) | Library OS per app | ~2–5 MB | 4–5 ms | ~10–15 hypercalls [3][5] |

The pattern is monotonic: as the software stack specializes, image size and boot latency collapse while the privileged interface narrows. Firecracker [8] is the instructive comparator — it minimizes the *virtual machine monitor* while keeping the guest OS general-purpose; unikernels instead minimize the *guest software itself*.

---

## 3. Methodology

Our analysis proceeds along three tracks.

**Architectural analysis.** We decompose MirageOS's functor architecture from its published design [1][2], Solo5's tender/ABI model from its specification and deployment experience [5], and HermiTux's binary-compatibility mechanism [4], reconstructing the invariants each system maintains.

**Comparative measurement.** We synthesize published benchmarks: MirageOS image composition (Table 1 of [1], reproduced below), Solo5/ukvm throughput and startup comparisons from the Nabla/ukvm study summarized in [5], IncludeOS boot measurements [3], and the microservice benchmarking study of unikernels versus containers [6]. Where studies conflict, we report ranges and identify the controlling variable (tender choice, driver path, workload shape).

All claims about third-party systems are grounded in the cited primary sources; we distinguish measured results from architectural reasoning throughout.

---

## 4. Deep Dive

### 4.1 Library OS Architecture versus the Monolithic Kernel

A monolithic kernel multiplexes resources among mutually distrustful processes through a single, fixed policy bundle: one scheduler, one page-replacement algorithm, one TCP congestion controller, one VFS. The unikernel inverts this. Because exactly one application occupies the image, *every* OS policy becomes an application-linked library choice. Need a TCP stack tuned for a datacenter RPC workload? Link a different `TCPIP` implementation. Need deterministic latency? Replace the scheduler library with a run-to-completion dispatcher.

MirageOS's published image composition makes the economics concrete [1]:

| Library | C (kLOC) | OCaml (kLOC) |
|---|---|---|
| Boot | 18 | 0 |
| OCaml runtime | 20 | 0 |
| Threads | 5 | 27 |
| Interdomain comms | trace | 1 |
| Network driver | 0 | 1 |
| TCP/IP | trace | 12 |
| Block driver | 0 | 1 |
| HTTP | 0 | 11 |
| **Total** | **43** | **52** |

A complete HTTP server — boot code, runtime, drivers, TCP/IP, HTTP — fits in roughly 95 kLOC, versus the ~30 MLOC of a modern Linux kernel. This is the *order-of-magnitude reduction* the authors claim, and it is what makes audit, formal analysis, and even manual review of the trusted stack tractable [1].

Solo5 pushes the minimization further at the execution layer. The unikernel issues hypercalls through a deliberately narrow ABI — `solo5_net_write`, `solo5_block_read`, `solo5_yield`, clock, console — and the tender translates these to host syscalls under seccomp confinement [5]. Conceptually this is *exokernel thinking applied one level up*: the hypervisor/tender multiplexes hardware securely, and the unikernel is the libOS [7].

### 4.2 MirageOS Functors: Compile-Time Specialization as an OS Construction Principle

The most distinctive technical contribution of MirageOS is its use of OCaml's module system — specifically *functors* — as the operating system's configuration language [1][2]. A MirageOS application is written against abstract module signatures:

```ocaml
module type NETWORK = sig
  type t
  val write : t -> Cstruct.t -> unit io
  val listen : t -> unit io
end

module Make
  (Time : Mirage_time.S)
  (Net : NETWORK)
  (Stack : Tcpip.Stack.V4V6) = struct
  let start _time net stack =
    let http = Http_server.create stack in
    Http_server.listen http
end
```

At build time, the `functoria` configuration tool resolves each functor parameter to a concrete implementation matching the deployment target: for a `unix` target, `Net` binds to the host's socket stack; for `solo5`/`xen` targets, it binds to the pure-OCaml `mirage-tcpip` implementation driving a paravirtual NIC [2]. Interface mismatches are caught *at compile time* by OCaml's type checker — an entire class of configuration errors that in conventional deployments manifests as runtime failures (wrong driver bound, missing device node) is eliminated before the image exists.

This yields three properties worth stating precisely:

1. **Whole-program dead-code elimination.** Only linked modules ship; an image without block storage contains no block driver, no VFS, no filesystem parser. Attack surface is removed by *construction*, not by configuration flags that an attacker might re-enable [3].
2. **Type-safe protocol stacks.** The TCP/IP, DNS, TLS, and HTTP implementations are clean-slate OCaml; memory-safety violations — historically the dominant source of remote-exploitable kernel bugs — are excluded by the language for all code outside the small C runtime [1].
3. **Target portability by parameterization.** The same application functor instantiates as a UNIX process for debugging, a Xen guest, or a Solo5/KVM image, because the *environment* is a parameter, not an assumption [2].

The practical consequence is that *auditing a MirageOS deployment means auditing its functor instantiation graph* — a finite, compiler-checked structure — rather than a running kernel's dynamic state.

### 4.3 Single-Address-Space Semantics and the Security Ledger

The most controversial unikernel property is the erasure of the user/kernel boundary: application code, drivers, and protocol stacks share one flat address space with no hardware privilege separation between them. Critics note, correctly, that a memory-safety bug anywhere in the image can corrupt anything in the image. The defense is a ledger with entries on both sides.

**What is lost.** Without ring separation, a single vulnerability in C code (driver, runtime) compromises the entire image rather than one process. Debugging is harder: there is no `strace`, no `/proc`, no core-dump-and-attach workflow against a live service — though Solo5's deterministic, interrupt-free execution model makes record/replay unusually tractable [5].

**What is gained.** First, *there is no privilege to escalate to*: the image runs entirely at one privilege level, and the hypervisor boundary — not a syscall gate — is the trust boundary [1]. Second, the image is *sealed*: code pages can be marked immutable by the hypervisor, so runtime code modification (the payload of most exploits) is structurally impossible [1]. Third, the missing POSIX surface removes entire exploit grammars — no shell to escape to, no `LD_PRELOAD`, no `/etc/shadow` to read, no SUID binaries [6]. Fourth, language-level safety covers the overwhelming majority of the image's code: in the MirageOS HTTP server, 52 of 95 kLOC are OCaml, and the C portion is concentrated in the runtime and boot path [1].

Compensating mechanisms where C code remains include **W^X** page policies, **memory protection keys (MPK)** partitioning the address space into domains, and **control-flow integrity** for C components. The honest summary is a changed risk profile: unikernels trade *depth* of isolation within the image for *narrowness* of the externally reachable interface, and the empirical record favors the trade for single-purpose network services [1][2].

### 4.4 The Solo5 Tender Model and Deterministic Execution

Solo5's architecture deserves close attention because it solves the *deployment* problem that historically killed libOSes. The build produces two artifacts: the unikernel ELF and a purpose-built tender (`solo5-hvt`, ~130 KB) [5]. The tender:

1. loads the ELF into guest memory under KVM (or Xen, or a `spt` seccomp-sandboxed process target);
2. services hypercalls by mapping them to a minimal host-syscall set, with the tender itself confined by seccomp;
3. **removes interrupts entirely** — the unikernel polls; there are no asynchronous preemptions.

Point 3 is subtle and powerful: without interrupts, unikernel execution is *deterministic given its inputs*, which enables efficient record/replay debugging and eliminates an entire class of concurrency heisenbugs [5]. Boot becomes comparable to process loading — the tender maps memory, jumps to the entry point, and the application is serving within milliseconds. The hypercall ABI's narrowness is quantifiable: on the order of 10–15 calls versus Linux's 350+, and the Nabla/ukvm comparison found Solo5-style isolation accessing 5–6× fewer unique kernel functions than normal processes [5].

---

## 5. Empirical Results and Proofs

### 5.1 Image Size, Boot Latency, Throughput

Synthesizing the cited studies [1][3][5][6][8]:

- **Image size.** A MirageOS web server image is a few megabytes; stripped IncludeOS services are ~2–5 MB [1][3]. Containers for equivalent services typically exceed 100 MB; Firecracker microVM root filesystems are tens of megabytes plus a guest kernel [8].
- **Boot latency.** MirageOS boots in under 10 ms on x86 Xen [2]; IncludeOS on `solo5-hvt` boots, executes, and exits in 4–5 ms [3]; Solo5 tender startup is comparable to process creation [5]. Firecracker boots a microVM in ~125 ms [8]; container start is dominated by image unpack and namespace setup at 100+ ms. The unikernel advantage is 1–2 orders of magnitude.
- **Throughput.** The Nabla (Solo5-derived) vs. ukvm study reports application throughput 101–245% higher for the Solo5-style path with 12% lower CPU utilization, attributed to the absence of VM exits on the I/O path and the polling driver model [5]. The unikernels-vs-containers microservice study [6] finds unikernels competitive with containers on request throughput while consuming a fraction of the memory.

### 5.2 The Attack-Surface Argument, Formalized

Define the *reachable privileged interface* *R* of a deployment unit as the set of distinct privileged operations callable from application-reachable code. For containers, *R* is the Linux syscall ABI (~350+ calls, minus seccomp filtering). For Solo5 unikernels, *R* is the hypercall ABI (~10–15 calls) plus whatever the tender exposes — and the tender is itself seccomp-confined [5]. The Nabla study's measurement — 5–6× fewer unique kernel functions accessed than normal processes — is an empirical lower bound on |*R_container*| / |*R_unikernel*| [5].

### 5.3 Networking and Storage in Practice

**Networking.** MirageOS ships a from-scratch OCaml TCP/IP stack (~12 kLOC) with a modular architecture allowing the conventional socket API or the pure implementation to be selected per target [2]. IncludeOS and rumprun-based systems instead port LwIP or NetBSD's stack, trading clean-slate type safety for battle-tested protocol logic.

**Storage.** Unikernels are weakest at stateful storage: there is no VFS, no page cache, no journaling filesystem in the minimal image. Practice converges on three patterns: (i) direct block access through the tender's block hypercalls with an application-embedded store; (ii) 9p mounts to an external fileserver; (iii) stateless images pushing persistence to object stores over the network. For NFV and edge caches — the workloads where unikernels shine — statelessness is natural [6].

### 5.4 Debugging, Tracing, and Verification

Solo5's deterministic execution enables record/replay [5]; gdb stubs attach to the tender's trap interface; MirageOS applications run unmodified as UNIX processes, so the conventional toolchain applies during development [2]. On verification: the seL4-adjacent lesson applies — a 95 kLOC TCB is within reach of serious formal analysis in a way a 30 MLOC kernel is not, and the functor structure gives verification a natural decomposition boundary [1].

---

## 6. Limitations

An honest assessment must register where unikernels lose.

1. **Driver and hardware coverage.** The hypervisor-as-stable-platform argument [1] holds for cloud and KVM/Xen targets but weakens at the edge: exotic NICs, GPUs, and accelerators lack paravirtual drivers, and writing them replays the 1990s libOS driver economics.
2. **POSIX compatibility and porting cost.** Clean-slate systems (MirageOS, IncludeOS) require porting; only binary-compatible approaches (HermiTux [4]) or recompilation SDKs (Unikraft [9]) blunt this, and HermiTux's rewriting trades away some minimality.
3. **Multi-tenancy within an image.** A unikernel serves one application; multiplexing mutually distrustful tenants requires multiple images (cheap, at millisecond boot) or language-level isolation — there is no in-image process boundary to fall back on.
4. **Fork/exec and dynamic behavior.** No `fork`, no `exec`, no dynamic loading: architectures built on process-per-connection or plugin dlopen must be restructured.
5. **Single-threaded and SMP immaturity.** Many unikernel stacks are effectively single-vCPU; multicore support (lock-free drivers, per-core stacks) lags monolithic kernels by a decade.
6. **Operational tooling.** Orchestrators speak containers; unikernel deployment needs translation layers (UniK, KraftKit) that remain niche.
7. **The C remainder.** Every unikernel still contains C — boot code, language runtime, some drivers — and the single address space means a bug there is total. MPK/W^X/CFI mitigate; they do not eliminate.

None of these is fatal for the target workloads (stateless network services, NFV, edge functions, IoT offload [6]); collectively they explain why unikernels complement rather than replace general-purpose kernels.

---

## 7. Conclusion

Unikernels are the exokernel idea, finally deployable: the hypervisor supplies the stable narrow machine interface that bare metal never did [1][7], and library operating systems supply the specialization that monolithic kernels structurally cannot. MirageOS demonstrates that an entire production network stack can be expressed as type-safe, functor-parameterized libraries with compile-time target resolution [1][2]; Solo5 demonstrates that a 130 KB tender and a dozen hypercalls suffice to execute such images securely and deterministically on commodity KVM [5]; HermiTux and Unikraft demonstrate two credible answers to the porting-cost objection [4][9].

The quantitative case is settled for single-purpose services: megabyte images, millisecond boots, and a privileged interface an order of magnitude narrower than Linux's [1][3][5][6]. The security case is subtler but, we argue, favorable: sealing, type safety, and interface narrowness compensate for the lost ring boundary, and the resulting TCB is small enough to audit and, increasingly, to verify. The research frontier now lies in SMP scalability, hardware accelerator support, verified protocol stacks, and orchestration integration. Thirty years after the exokernel paper asked what an OS is *for* [7], the unikernel answers: exactly what the application needs, nothing it does not, decided at compile time.

---

## References

[1] A. Madhavapeddy, R. Mortier, C. Rotsos, D. Scott, B. Singh, T. Gazagnaire, S. Smith, S. Hand, and J. Crowcroft, "Unikernels: Library Operating Systems for the Cloud," in *Proc. ASPLOS 2013*. DOI: https://doi.org/10.1145/2451116.2451167

[2] A. Madhavapeddy and D. J. Scott, "Unikernels: Rise of the Virtual Library Operating System," *ACM Queue / Communications of the ACM*, 2014. PDF: http://unikernel.org/files/2014-cacm-unikernels.pdf ; ACM Queue: https://queue.acm.org/detail.cfm?id=2566628

[3] A. Bratterud, A. Walla, H. Haugerud, and P. E. Engelstad, "IncludeOS: A Minimal, Resource Efficient Unikernel for Cloud Services" (IncludeOS project; boot and Solo5 measurements discussed in LWN coverage), https://lwn.net/Articles/728856/

[4] P. Olivier, D. Chiba, S. Lankes, C. Min, and B. Ravindran, "A Binary-Compatible Unikernel," in *Proc. VEE 2019* (HermiTux). Paper: https://www.ssrg.ece.vt.edu/papers/vee2019.pdf ; Code: https://github.com/p-jacquot/hermitux

[5] Solo5 Contributors, "Solo5: A Sandboxed Execution Environment for Unikernels," tender/hypercall ABI design and Nabla/ukvm comparison. Project: https://github.com/Solo5/solo5 ; architecture overview: https://cseweb.ucsd.edu/~yiying/cse291-winter22/reading/Unikernels.pdf

[6] V. Cozzolino, A. Ding, and J. Ott, "Unikernels vs Containers: An In-Depth Benchmarking Study in the Context of Microservice Applications" (IoT edge offload evaluation). https://www.researchgate.net/publication/329563819_Unikernels_vs_Containers_An_In-Depth_Benchmarking_Study_in_the_Context_of_Microservice_Applications

[7] D. R. Engler, M. F. Kaashoek, and J. O'Toole Jr., "Exokernel: An Operating System Architecture for Application-Level Resource Management," in *Proc. SOSP 1995*. DOI: https://doi.org/10.1145/224056.224076

[8] A. Agache et al., "Firecracker: Lightweight Virtualization for Serverless Applications," in *Proc. NSDI 2020*. https://arxiv.org/abs/2007.14305

[9] S. Kuenzer et al., "Unikraft: Fast, Specialized Unikernels the Easy Way," in *Proc. EuroSys 2021*. https://arxiv.org/abs/2104.12721
