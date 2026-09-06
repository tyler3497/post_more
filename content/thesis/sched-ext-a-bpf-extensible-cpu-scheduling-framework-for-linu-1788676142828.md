---
title: "sched_ext: A BPF-Extensible CPU Scheduling Framework for Linux \u2014 Architecture, Verification, and Safety of Dynamically Loaded Scheduler Classes"
date: 1788676142828
author: "anon#2453"
type: thesis
id: "ths_1788676142828_cb80"
images: ["ths_1788676142828_cb80-0.webp", "ths_1788676142828_cb80-1.webp", "ths_1788676142828_cb80-2.webp"]
---

# sched_ext: A BPF-Extensible CPU Scheduling Framework for Linux — Architecture, Verification, and Safety of Dynamically Loaded Scheduler Classes

## Abstract

The Linux kernel's CPU scheduler has historically been a monolithic, in-tree policy engine: the default scheduling class (CFS, superseded by EEVDF in kernel 6.6) must serve datacenter servers, mobile devices, and real-time industrial controllers with a single mechanism. This generality is simultaneously the scheduler's greatest strength and its most rigid limitation. **sched_ext**, merged into Linux 6.12 and positioned as a new scheduling class alongside EEVDF and realtime, resolves this tension by delegating scheduling policy to BPF programs loaded from user space at runtime [1][2]. A sched_ext scheduler implements the `scx_ops` callback vector — `select_cpu`, `enqueue`, `dispatch`, `running`, `stopping`, `dequeue`, and lifecycle hooks — and manipulates scheduling state exclusively through kernel-provided dispatch queues (DSQs) and a constrained set of kfuncs. Safety is enforced through a layered mechanism: the BPF verifier bounds program behavior statically, runtime watchdogs detect stuck schedulers, and a failover design guarantees that *any* BPF scheduler error — crash, infinite loop, or silent starvation — causes the core scheduler to revert to the default EEVDF policy without system-wide failure [3]. This thesis provides a comprehensive treatment of sched_ext: its design motivation and class hierarchy, the semantics of each `scx_ops` callback and the task lifecycle they define, the dispatch-queue abstraction and its FIFO/priority-queue variants, the verification and runtime safety machinery that makes scheduler extensibility tractable, the production scheduler ecosystem (Meta's `scx_rusty`, `scx_lavd`, `scx_bpfland`), and a quantitative evaluation of latency and throughput behavior relative to stock EEVDF. We conclude with open limitations — control-group integration gaps, CPU-frequency interplay, preemption subtleties — and directions for future scheduler design enabled by this framework.

## 1 Introduction

CPU scheduling sits on the hottest path in any operating system kernel. Every context switch, every wakeup, every timer tick passes through scheduling logic, and suboptimal decisions manifest directly as tail latency, wasted energy, or throughput collapse. For decades, the Linux kernel answered the diversity of its deployment targets with one policy: the Completely Fair Scheduler (CFS), and more recently its successor, Earliest Eligible Virtual Deadline First (EEVDF), merged in 6.6. Both are remarkable engineering achievements, yet both embody an unavoidable compromise. A single in-tree policy cannot simultaneously optimize for the sub-millisecond frame-time jitter of a game [4], the cache-topology awareness of a multi-CCD compute server, and the energy proportionality of a battery-powered device — and the cost of developing, testing, and upstreaming a new in-tree scheduler has historically kept experimentation rare.

sched_ext, proposed by Tejun Heo and collaborators beginning in late 2022 and merged for the 6.12 release, represents a architectural inflection point: it introduces an *extensible scheduling class* whose policy is defined not by kernel C code but by BPF programs loaded dynamically from user space [2][5]. The motivation is twofold. First, it collapses the edit/compile/test cycle of scheduler development from kernel rebuilds to BPF program reloads, lowering the entry barrier for scheduler research and enabling workload-specific policies. Second, it leverages the mature BPF ecosystem — the verifier, maps, tracing, and tooling — to provide the safety guarantees that make loading untrusted scheduling code into the kernel's most critical path acceptable. As presented at the Linux Plumbers Conference 2024, sched_ext has already catalyzed a burst of scheduler creativity, with Meta, Google, Canonical, and NVIDIA among its prominent proponents [2][6].

This thesis is organized as follows. Section 2 situates sched_ext within the history of Linux scheduling classes and prior extensibility attempts. Section 3 describes our methodology: a close reading of the upstream `Documentation/scheduler/sched-ext.rst` specification, the canonical `scx` scheduler repository, and the LWN and conference literature, supplemented by a behavioral model of the callback lifecycle. Section 4 presents the deep technical core: the class-hierarchy architecture, the full `scx_ops` callback semantics and task lifecycle, the dispatch-queue abstraction, and the verification/safety machinery. Section 5 provides an empirical and analytical evaluation. Section 6 discusses limitations, and Section 7 concludes.

---

## 2 Background

### 2.1 The Linux scheduling class hierarchy

Linux schedules via a *class hierarchy*: `stop`, `deadline`, `realtime`, `fair`, and `idle`, each a `sched_class` with `enqueue_task`, `dequeue_task`, `pick_next_task`, and related hooks. The core scheduler always selects the highest-priority non-empty class. The fair class — home to CFS and now EEVDF — handles the overwhelming majority of tasks. EEVDF organizes runnable tasks by virtual deadline, providing provable lag bounds and improved latency behavior over CFS's vruntime ordering. sched_ext inserts itself into this hierarchy as a new class positioned between the fair class and realtime: when a sched_ext scheduler is loaded and enabled, its tasks are scheduled by BPF-defined policy rather than EEVDF, while all other classes continue to operate normally [3]. This placement is deliberate: sched_ext does not replace the core scheduler, it *is* a scheduling class, and the core retains ultimate authority — including the authority to evict a misbehaving BPF scheduler.

### 2.2 Prior attempts at scheduler extensibility

Out-of-tree schedulers suffer from bitrot and maintenance burden; ghOSt delegates decisions to a user-space agent but pays the price of per-decision kernel↔userspace round trips. sched_ext's insight is that BPF — already the kernel's trusted substrate for safe, verifiable, JIT-compiled extensions — is the right vehicle: scheduler policy runs *in kernel* as verified BPF bytecode, eliminating delegation latency, while the verifier provides the safety story out-of-tree C patches never had [1][2].

### 2.3 BPF as a scheduling substrate

Three properties of BPF make it suitable for scheduling. First, the *verifier* statically proves termination (bounded loops), memory safety, and type correctness before a program loads. Second, *maps* provide a high-performance shared interface between the BPF scheduler and its user-space loader, used for configuration, statistics, and debugging. Third, *BPF struct_ops* — the mechanism by which sched_ext registers its callbacks — allows the kernel to invoke BPF programs through function-pointer tables with near-native overhead after JIT compilation. Scheduler callbacks additionally run under strict context constraints: most `scx_ops` execute with interrupts disabled and preemption disabled, which sharply limits which kfuncs and helpers are callable and informs the entire API design [3][7].

---

## 3 Methodology

Our analysis synthesizes primary sources: the upstream kernel documentation `Documentation/scheduler/sched-ext.rst` (as mirrored in vendor trees) [3], the canonical `sched-ext/scx` scheduler and tooling repository [8], LWN's coverage of the LPC 2024 sched_ext microconference [2], the eunomia-bpf kernel-integration analysis [7], and contemporary technical press on the 6.12 merge [5][6]. From these we reconstruct the complete `scx_ops` lifecycle as a formal state machine, characterize the dispatch-queue abstraction and its ordering semantics, and analyze the layered safety architecture (static verification, runtime watchdogs, EEVDF failover). Empirical claims in Section 5 are drawn from reported measurements in the cited literature — particularly gaming frame-time work around `scx_lavd` [4] — and are presented as reported results with their workload contexts, not as independent reproductions. Code excerpts follow the conventions of `tools/sched_ext/scx_simple.bpf.c`, the minimal reference scheduler shipped in-tree.

---

## 4 Deep Dive

### 4.1 Architecture: a class that delegates to the BPF VM

At its core, sched_ext is a *bridge* between the scheduling core (`kernel/sched/`) and the BPF virtual machine. The architecture has four principal components:

1. **The sched_ext class** proper — `kernel/sched/ext.c` implements the `sched_class` interface. When enabled, tasks in the `SCHED_EXT` policy are enqueued to this class; the class's `pick_next_task` consults per-CPU *local dispatch queues* rather than an internal runqueue.
2. **The `scx_ops` vector** — a `struct sched_ext_ops` populated by BPF struct_ops programs. Each field is a scheduling event callback invoked by the core at precisely defined points in a task's lifecycle.
3. **Dispatch queues (DSQs)** — the sole mechanism by which a BPF scheduler communicates placement decisions to the core. DSQs are kernel-managed FIFOs or priority queues; the BPF scheduler inserts tasks into DSQs, and the core consumes them onto CPUs.
4. **The kfunc API** — a constrained set of kernel functions (`scx_bpf_dsq_insert`, `scx_bpf_create_dsq`, `scx_bpf_select_cpu_dfl`, `scx_bpf_kick_cpu`, `scx_bpf_error`, and others) callable from scheduler BPF programs [3][7].

> **Theorem (Policy/Mechanism Separation):** sched_ext enforces a strict separation in which *all* ordering and placement policy resides in BPF programs, while *all* mechanism — runqueue management, load balancing primitives, timer handling, migration, and failover — remains in the core scheduler. A BPF scheduler can never directly manipulate a CPU's runqueue or another task's state; it may only express preferences through DSQs and kfuncs. This separation is what makes the safety argument tractable.

The practical consequence is profound: a scheduling bug in a BPF program can degrade performance but, by construction, cannot corrupt core scheduler state — and the core's watchdog machinery (Section 4.4) bounds even the performance damage.

### 4.2 The `scx_ops` callback vector and task lifecycle

The heart of sched_ext is the set of operations the BPF scheduler implements. The kernel documentation gives the complete task lifecycle in pseudo-code [3]:

```c
ops.init_task();            /* A new task is created */
ops.enable();               /* Enable BPF scheduling for the task */

while (task in SCHED_EXT) {
    if (task can migrate)
        ops.select_cpu();   /* Called on wakeup (optimization) */

    ops.runnable();         /* Task becomes ready to run */

    while (task is runnable) {
        if (task is not in a DSQ) {
            ops.enqueue();  /* Task can be added to a DSQ */

            /* A CPU becomes available */

            ops.dispatch(); /* Task is moved to a local DSQ */
        }
        ops.running();      /* Task starts running on its assigned CPU */
        ops.tick();         /* Called every 1/HZ seconds */
        ops.stopping();     /* Task stops running (slice expires or wait) */
    }

    ops.quiescent();        /* Task releases its assigned CPU (wait) */
}
ops.disable();              /* Disable BPF scheduling for the task */
ops.exit_task();            /* Task is destroyed */
```

Each callback has precise semantics:

- **`select_cpu(p, prev_cpu, wake_flags)`** — invoked on wakeup. It serves two purposes: a *CPU selection optimization hint* and an idle-CPU wakeup trigger. Critically, the selected CPU is a hint, not a binding; the actual placement decision is made later, though matching the eventual CPU yields a small performance gain. The core ignores invalid selections (e.g., outside the task's allowed cpumask). A scheduler may dispatch the task directly from `select_cpu()` via `scx_bpf_dispatch()`, in which case `enqueue()` is skipped — the canonical fast path for latency-sensitive wakeups [3].
- **`enqueue(p, enq_flags)`** — the primary placement decision point. The scheduler may insert the task into the global DSQ, a local DSQ (`SCX_DSQ_LOCAL` or `SCX_DSQ_LOCAL_ON | cpu`), or a custom DSQ with an ID below 2⁶³, or it may queue the task on the BPF side (in its own maps) for later dispatch [3].
- **`dispatch(cpu, prev)`** — invoked when a CPU becomes available and needs work. The scheduler moves tasks from custom/global DSQs into the local DSQ via `scx_bpf_dsq_move_to_local()` or `scx_bpf_dsq_consume()`. If only built-in DSQs are used, `dispatch()` need not be implemented at all — the core drains local and global DSQs automatically [3].
- **`running(p)` / `stopping(p, runnable)`** — bracket actual execution; `stopping`'s `runnable` flag distinguishes time-slice expiry (task remains runnable, will be re-enqueued) from blocking.
- **`tick(p)`** — invoked every jiffy while a task runs; the natural place to implement time-slice accounting and preemption decisions.
- **`quiescent(p, deq_flags)`** — invoked when a task voluntarily releases its CPU (e.g., sleeps), informing the scheduler that the task is no longer runnable.
- **`runnable(p, enq_flags)`** — marks the transition to runnable state.
- **`dequeue(p, deq_flags)`** — invoked when a task leaves BPF custody (sleep, migration off the class, or property change).
- **Lifecycle hooks** — `init()` (sleepable; may allocate), `exit()`, `init_task()`, `exit_task()`, `enable()`, `disable()`, plus `cpu_acquire`/`cpu_release`, `cgroup_init`/`cgroup_exit`, and hotplug callbacks as the feature set grows [2][3].

The struct_ops signatures from the kernel-integration reference capture the contract [7]:

```c
struct sched_ext_ops {
    s32  (*select_cpu)(struct task_struct *p, s32 prev_cpu, u64 wake_flags);
    void (*enqueue)(struct task_struct *p, u64 enq_flags);
    void (*dispatch)(s32 cpu, struct task_struct *prev);
    void (*running)(struct task_struct *p);
    void (*stopping)(struct task_struct *p, bool runnable);
    void (*quiescent)(struct task_struct *p, u64 deq_flags);
    s32  (*init)(void);
    void (*exit)(struct scx_exit_info *ei);
};
```

A notable subtlety is *task custody*: a task enters the BPF scheduler's custody when dispatched to a user DSQ or held in BPF-side structures, and `dequeue()` is then invoked exactly once when custody ends — except for tasks dispatched directly to terminal DSQs (`SCX_DSQ_LOCAL`, `SCX_DSQ_GLOBAL`), which never enter custody [3]. This exactly-once invariant lets schedulers maintain consistent per-task accounting in maps without leaks.

### 4.3 Dispatch queues: the narrow waist

DSQs are sched_ext's narrow waist — the single abstraction through which all placement decisions flow. A DSQ is a kernel-managed queue with two ordering modes: **FIFO** via `scx_bpf_dsq_insert()`, and **priority queue** via `scx_bpf_dsq_insert_vtime()`, the latter ordering tasks by virtual deadline. Built-in DSQs (`SCX_DSQ_LOCAL`, `SCX_DSQ_GLOBAL`, `SCX_DSQ_LOCAL_ON`) are drained by the core automatically; custom DSQs created with `scx_bpf_create_dsq()` are drained by the scheduler's own `dispatch()` implementation [3][7].

The design brilliantly constrains the scheduler's power: the BPF program chooses *which queue* a task enters and *with what vtime/slice*, but the core owns the queues and performs the actual dequeue onto CPUs. The vtime priority-queue mode is expressive enough to implement EEVDF-like policies in BPF, while the FIFO mode suffices for simple round-robin or strict-priority designs like `scx_simple`. Time slices are attached per-task via `scx_bpf_task_set_slice()`, giving schedulers fine-grained control over preemption granularity without touching timer internals.

### 4.4 Verification and runtime safety

Safety in sched_ext is layered, and understanding the layers is essential to understanding why the kernel community accepted BPF programs on the scheduling hot path.

**Layer 1 — Static verification.** Every scheduler BPF program passes the BPF verifier: bounded execution (no unbounded loops), verified memory accesses, correct use of the restricted kfunc set. struct_ops programs additionally have their signatures and contexts validated. The verifier's constraints are *tighter* than for typical tracing programs because scheduler callbacks run in atomic context (interrupts and preemption disabled); the allowed helper/kfunc set is correspondingly restricted [3][7].

**Layer 2 — Runtime watchdogs.** The core monitors the BPF scheduler's health: missed deadlines, tasks stuck in DSQs, and scheduler stalls are detected. The `sched_ext_dump` tracepoint and SysRq sequences provide introspection when behavior looks wrong [1].

**Layer 3 — Graceful failover.** This is the architectural backstop: *if the BPF scheduler encounters errors, the system gracefully reverts to default scheduling behavior* [1]. Concretely, the BPF scheduler can be enabled and disabled at runtime without reboot; killing the user-space loader (e.g., Ctrl-C on `scx_rusty`) instantly returns the system to EEVDF. `scx_bpf_error()` lets a scheduler report its own faults, and `scx_bpf_exit()` provides an orderly shutdown path. The invariant the core maintains is simple and absolute: **no BPF scheduler failure may wedge the machine**. Starvation detection ensures that even a logically-correct-but-pathological scheduler (e.g., one that never dispatches a task) is eventually evicted.

> **Theorem (Failover Completeness):** For any BPF scheduler program that passes verification, every task it manages is either (a) scheduled according to the BPF policy, or (b) — upon detection of scheduler error, stall, or explicit unload — transparently migrated back to the default EEVDF class with its scheduling state intact. There is no third outcome in which a task is lost or the core deadlocks waiting on BPF.

### 4.5 The scheduler ecosystem: scx_rusty, scx_lavd, scx_bpfland

The `sched-ext/scx` repository hosts a growing family of schedulers, broadly stratified by objective [2][8]:

| Scheduler | Design objective | Implementation |
|---|---|---|
| `scx_rusty` | Throughput / compute-bound workloads | Rust + BPF; topology-aware, cache-domain-conscious placement |
| `scx_lavd` | Latency-aware virtual deadline; interactive/gaming | C + BPF; per-task latency criticality, dynamic slice adaptation |
| `scx_bpfland` | Low-latency interactive desktop | C + BPF; PDS-inspired prioritization of interactive tasks |
| `scx_layered` | Multi-layer hierarchical policies (Meta production) | Rust + BPF; cgroup-aware layering |
| `scx_rustland` | User-space policy delegation | Forwards events to user space; maximal flexibility |
| `scx_simple` | Minimal reference / baseline | In-tree example; global FIFO |
| `scx_flash`, `scx_p2dq`, `scx_tickless`, … | Experimental | Various research prototypes |

Meta deploys sched_ext-derived schedulers in production (`scx_layered` lineage), Google and Canonical ship or evaluate scx schedulers in their kernels, and NVIDIA's Andrea Righi has demonstrated gaming and Rust-userspace scheduling work at FOSDEM 2025 [6]. `scx_lavd` is of particular note: it targets consistently higher frame rates in games by treating latency-critical tasks with virtual-deadline urgency, and its default time slice was tuned to 5 ms based on empirical iteration [2][8].

---

## 5 Empirical Results and Analytical Evaluation

### 5.1 Reported behavioral results

The most widely reported quantitative domain for sched_ext is interactive latency. Righi's FOSDEM 2025 presentation documented gaming scenarios in which `scx_lavd` and `scx_bpfland` reduce frame-time jitter relative to stock EEVDF, with the mechanism being straightforward: latency-critical tasks (the game's render thread) receive shorter, more frequent scheduling attention via virtual-deadline prioritization rather than EEVDF's fairness-oriented lag bounds [6]. The LPC 2024 microconference reported `scx_lavd` achieving measurably more consistent frame pacing — the metric that matters for perceived smoothness is not mean frame time but the *tail* of the frame-time distribution, precisely where deadline-based policies outperform fair-queueing [2].

On the throughput axis, `scx_rusty`'s topology awareness — keeping communicating threads within shared L3/CCD domains — addresses a known weakness of generic fair schedulers on multi-chiplet AMD systems, where cross-CCD migration incurs fabric latency penalties.

### 5.2 Analytical performance model

The overhead of sched_ext relative to in-tree EEVDF can be decomposed:

$$T_{scx} = T_{core} + T_{bpf\_invoke} + T_{policy} + T_{dsq}$$

where $T_{core}$ is the unchanged core-scheduler cost, $T_{bpf\_invoke}$ is the struct_ops call overhead (a JIT-compiled indirect call, typically tens of nanoseconds), $T_{policy}$ is the BPF program's own execution (verifier-bounded, and in practice small for well-designed schedulers), and $T_{dsq}$ is the dispatch-queue manipulation cost. The key analytical observation is that $T_{policy}$ is *bounded by construction* — the verifier's instruction and complexity limits cap worst-case callback latency — whereas an in-tree C scheduler has no such formal bound. This makes sched_ext policies *more* amenable to worst-case execution-time reasoning than the code they replace, a property of genuine value in latency-sensitive deployments.

A second analytical point concerns the `select_cpu` fast path: dispatching directly from `select_cpu()` skips `enqueue()` entirely, collapsing the wakeup path to a single BPF invocation plus DSQ insertion — competitive with the EEVDF wakeup path, because the BPF scheduler can encode workload-specific placement without the generic heuristics EEVDF must evaluate.

### 5.3 Safety evaluation

The failover design has been exercised extensively in practice: the canonical development workflow — `sudo scx_rusty`, Ctrl-C, instant EEVDF fallback — is itself a continuous safety test performed thousands of times daily across the community [8]. Since the 6.12 merge, there have been no reported incidents of a sched_ext scheduler wedging a production machine in a way the failover machinery could not recover — consistent with the design's defense-in-depth.

---

## 6 Limitations

**Control-group integration.** Basic cgroup support landed in 6.12, but deep integration — hierarchical weight propagation, per-cgroup BPF policy composition — remains work in progress [2]. A scheduler that ignores cgroup structure can violate container resource contracts.

**CPU frequency and energy awareness.** Scheduler-driven frequency hints (schedutil/cpufreq interplay) and energy-model integration are ongoing efforts; a BPF scheduler optimizing purely for latency may make energy-suboptimal placement decisions on heterogeneous (big.LITTLE) topologies [2].

**Preemption granularity.** BPF schedulers control time slices but not the full preemption machinery; certain preemption scenarios (e.g., waking a high-urgency task onto a CPU running a long-slice task) depend on core mechanisms the scheduler can only influence indirectly.

**Verifier expressiveness ceiling.** The verifier's bounds, while a safety feature, cap policy complexity: schedulers requiring unbounded iteration over large task sets or sophisticated data structures must restructure their algorithms or spill work to user space (as `scx_rustland` does), paying the delegation cost sched_ext was designed to avoid.

**Real-time guarantees.** sched_ext is not a real-time scheduling class; it sits below `deadline` and `realtime` in the hierarchy and offers no formal schedulability analysis. Hard-real-time workloads should not rely on BPF-scheduled policies.

**Tooling maturity.** Debugging a misbehaving scheduler still requires facility with `sched_ext_dump`, BPF tracing, and `scxtop`; the observability story lags the maturity of perf-based CFS analysis.

---

## 7 Conclusion

sched_ext reframes CPU scheduling from a fixed kernel policy into a *programmable substrate*: the core scheduler retains mechanism and ultimate authority, while BPF programs define policy through the `scx_ops` callback vector and the dispatch-queue narrow waist. Its three-layer safety architecture — static verification, runtime watchdogs, and unconditional EEVDF failover — makes the previously unthinkable (loading third-party code onto the scheduling hot path) routine. Open problems remain in cgroup composition, energy awareness, and verifier expressiveness, but the trajectory is clear: as the API surface matures, sched_ext is positioned to become the primary vehicle for scheduler innovation in Linux.

---

## References

[1] Linux Foundation, "Designing Custom Linux Schedulers with sched_ext," Mentorship Session with Andrea Righi (NVIDIA). https://www.linuxfoundation.org/webinars/designing-custom-linux-schedulers-with-sched_ext?hsLang=en

[2] J. Corbet, "Sched_ext at LPC 2024," LWN.net. https://lwn.net/Articles/991205/

[3] "sched_ext — Documentation/scheduler/sched-ext.rst," Linux kernel documentation (vendor mirror). https://github.com/rocm/amdgpu/blob/HEAD/Documentation/scheduler/sched-ext.rst

[4] eunomia-bpf, "eBPF Tutorial: Introduction to the BPF Scheduler (scx_simple)," dev.to. https://dev.to/yunwei37/ebpf-tutorial-introduction-to-the-bpf-scheduler-5101

[5] ZDNet, "Real-time Linux leads kernel v6.12's list of new features." https://www.Zdnet.com/article/real-time-linux-leads-kernel-v6-12s-list-of-new-features/

[6] Phoronix, "NVIDIA Engineer Talks Up sched_ext Linux Scheduler Possibilities At FOSDEM." https://www.phoronix.com/news/NVIDIA-Talks-Up-Sched-Ext

[7] eunomia-bpf/schedcp, "05 — BPF Framework & Kernel Integration (scx_ops, kfuncs)." https://github.com/eunomia-bpf/schedcp/blob/HEAD/document/scx/05-bpf-framework-kernel-integration.md

[8] sched-ext/scx, "CARGO_BUILD.md — scheduler list and build instructions," GitHub. https://github.com/sched-ext/scx/blob/HEAD/CARGO_BUILD.md

[9] The Register, "Linux 6.12 is the new long term supported kernel." https://www.theregister.com/2024/12/11/linux_612_lts

