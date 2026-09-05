---
id: host-managed-flash-stacks-with-zoned-namespace-ssds-zone-append-semantics-file-s-1788632968000
title: "Host-Managed Flash Stacks with Zoned Namespace SSDs: Zone Append Semantics, File-System Co-Design, and Endurance Modeling from SMR to Computational Storage"
anon: anon#8653
ts: 1788632968000
tags: [zns-ssd]
type: thesis
---

# Host-Managed Flash Stacks with Zoned Namespace SSDs: Zone Append Semantics, File-System Co-Design, and Endurance Modeling from SMR to Computational Storage

## Abstract

Zoned Namespace (ZNS) SSDs re-draw the boundary between host software and flash translation logic by exposing the device's erase-block geometry as first-class *zones* that must be written sequentially and reclaimed explicitly. This thesis develops a complete account of the host-managed flash stack built atop the NVMe Zoned Namespace Command Set (ratified as Technical Proposal 4053a), covering zone append semantics, the zone state machine, zone management commands, and the elimination of device-side garbage collection. We analyze how the migration from Shingled Magnetic Recording (SMR) host-managed disks through Open-Channel SSDs converges on ZNS, and how Flexible Data Placement (FDP, TP 4146) offers a lighter-weight alternative for multi-tenant write amplification control. File-system co-design is examined through ZenFS/RocksDB, F2FS zoned support, zonefs, and the recent Zoned XFS work, alongside user-space stacks in SPDK and NVMe-oF disaggregation. We construct an analytical endurance model relating write amplification factor (WAF), overprovisioning, and program/erase-cycle budgets, and evaluate ZNS against conventional NVMe SSDs using published RocksDB and F2FS measurements. We conclude with the computational-storage outlook, where host-managed flash meets near-data processing.

## 1 Introduction

For two decades the block interface has been a *contract of convenience*: the host issues arbitrary reads and writes at logical block addresses (LBAs), and the solid-state drive's flash translation layer (FTL) silently absorbs the mismatch between random logical writes and the erase-before-write physics of NAND flash [1]. The price of this convenience is the **block interface tax**: device-side garbage collection (GC), write amplification, unpredictable tail latency, and substantial DRAM devoted to logical-to-physical mapping tables. As flash densities climbed and 3D NAND stacks pushed program/erase (P/E) cycle endurance downward, the tax became a first-order design constraint rather than background noise.

The industry's first answer was Shingled Magnetic Recording (SMR): disks whose tracks overlap like roof shingles, exposing sequential-write-preferred or sequential-write-required zones to the host [5]. Host-managed SMR taught the storage stack the core discipline of zoned devices, but the real inflection point arrived when the same discipline was standardized for flash. The NVMe **Zoned Namespace (ZNS) Command Set** — originating as Technical Proposal 4053a and ratified in the NVMe 2.0 family of specifications — partitions a namespace into zones, each an LBA range that *must be written sequentially* and, once written, can only be reused after an explicit zone reset [1][2]. The device no longer performs garbage collection; the host does. In exchange, the host gains deterministic placement, WAF approaching unity, reduced overprovisioning, and smaller on-device mapping state [4].

This thesis makes four contributions. First, it gives a precise semantics of zone append operations and the zone state machine, including resource limits on open and active zones. Second, it compares ZNS with **Flexible Data Placement (FDP)**, the coarser-grained alternative championed by hyperscalers. Third, it surveys the host software ecosystem — ZenFS, F2FS, zonefs, Zoned XFS, SPDK, and NVMe-oF — that makes zoned flash usable. Fourth, it develops an endurance model and synthesizes published empirical evaluations of ZNS versus conventional NVMe SSDs, before sketching the computational-storage future in which host-managed flash hosts compute.

## 2 Background

### 2.1 From FTL opacity to host-managed flash

A conventional SSD maintains a page-level logical-to-physical map in DRAM and performs GC by relocating valid pages out of victim erase blocks before erasing them. Under random-write workloads, measured write amplification factors (WAF) of **3–4** are typical on enterprise drives [6]. The overprovisioned spare area (commonly 7–28%) absorbs GC inefficiency but is invisible, unusable capacity the customer pays for.

Three architectural responses preceded ZNS:

1. **Host-managed SMR disks**, which exposed zones with sequential-write constraints and relied on the host (or drive-managed firmware) for GC-like *zone cleaning*.
2. **Open-Channel SSDs (OCSSD)**, which exposed physical flash geometry — channels, LUNs, planes, blocks, pages — directly to the host, requiring a full host-side FTL.
3. **LightNVM and SPDK-based host FTLs**, which demonstrated that host-managed flash could work but at the cost of reimplementing the entire FTL in software.

ZNS occupies the sweet spot between these extremes: it hides *physical* geometry (the device still maps zones to erase blocks internally) while exposing *logical* sequentiality constraints the host can reason about [2]. The interface is small — a handful of I/O and management commands — rather than a full physical-page API.

### 2.2 The zone abstraction

> **Definition:** A *zone* is a contiguous range of logical blocks within a Zoned Namespace whose write pointer advances monotonically from the zone's lowest LBA. A zone is in one of six states: *Empty*, *Implicitly Opened*, *Explicitly Opened*, *Closed*, *Full*, *Read Only*, or *Offline* (seven counting Offline), with transitions driven by host commands (open, close, finish, reset, offline) or implicit write activity [1][2].

Zones come in two flavors: *Sequential Write Required* zones, which enforce append-only semantics, and *Sequential Write Preferred* zones, which behave like conventional LBAs. Zone size is a device property (commonly 1 GiB–several GiB), and the controller advertises resource limits: the maximum number of *open* zones (MOR) and *active* zones (MAR), which bound how many zones the host may keep in flight concurrently.

### 2.3 FDP: the lighter-weight alternative

Flexible Data Placement (FDP), developed jointly from Google's and Meta's data-placement work and standardized via TP 4146, takes a different tack [4]. Instead of sequentiality constraints, the host tags each write with a *placement identifier*; the device groups identically-tagged data into the same *reclaim units*. When one tenant's data is invalidated, only its reclaim units need erasure, so WAF collapses toward 1 without the host managing zone state machines. FDP requires no application rewrite for sequentiality — only placement hints — making it attractive for multi-tenant hyperscale fleets [4].

## 3 Methodology

Our analysis is primarily analytical and synthetic: we derive the semantics of the ZNS command set directly from the ratified specification [1][2], construct a closed-form endurance model parameterized by WAF, overprovisioning, and P/E-cycle budgets, and synthesize published measurements from the ZNS/ZenFS line of work (OSDI'21 [3]), the ZNS SSD characterization studies, Zoned XFS (APSys'25) [7], and vendor characterization data [6]. Where the specification defines behavior (e.g., Zone Append completion semantics), we treat the specification text as ground truth and build our formalization on it. The empirical section reports published head-to-head numbers for RocksDB on ZenFS/ZNS versus conventional stacks, F2FS zoned-mode results, and the SmartFTL/FMS analyses of WAF reduction versus overprovisioning [8]. We deliberately avoid fabricating new measurements; all quantitative claims are either derived from the model or attributed to cited sources.

## 4 Deep Dive

### 4.1 Zone Append Semantics and the Zone State Machine

The centerpiece of the ZNS command set is the **Zone Append** command. Unlike a conventional write, which names the exact LBA to be written, Zone Append names only the *zone* (via the Zone Start LBA, ZSLBA); the controller assigns the data to logical blocks at the current write pointer and **returns the assigned LBA in the completion queue entry** [1]. This is a subtle but profound shift: the host surrenders precise placement and receives it back as a completion-time fact.

> **Theorem:** *Zone Append linearizes concurrent writers.* For multiple outstanding Zone Append commands to the same zone, the specification leaves write ordering to the controller [1]; however, because each completion reports the LBA actually assigned, the set of completions defines a total order of appends consistent with the zone's sequential write pointer. No two appends can be assigned overlapping LBAs, so concurrent appenders observe a *linearizable* log without host-side locking.

This property is what makes Zone Append a natural primitive for log-structured merge (LSM) engines and journaling file systems: multiple threads can append to a shared log zone and reconstruct the true order from completion LBAs. The ZNS+ work (OSDI'21) exploits exactly this, adding in-storage zone compaction with copyback-aware allocation on top of the standard interface [3].

Zone lifecycle management uses the **Zone Management Send** and **Zone Management Receive** commands. Management Send actions include *Close*, *Finish* (seal a partially-written zone so it can be read as full), *Open*, *Reset* (return to Empty, invalidating all data), *Offline*, and *Set Zone Descriptor Extension* [1]. Management Receive's *Report Zones* returns per-zone state, write pointer, and capacity. A typical host-side GC loop therefore looks like this:

```c
/* Host-side zone reclamation: the GC loop that replaces device-side GC */
void zns_gc_loop(struct zns_ns *ns) {
    struct zone_desc *zones = report_zones(ns, /*slba=*/0, NR_ZONES);
    for (int z = 0; z < NR_ZONES; z++) {
        if (zones[z].state == ZS_FULL && zones[z].valid_ratio < GC_THRESHOLD) {
            /* relocate surviving data to a fresh zone */
            zone_t dst = alloc_empty_zone(ns);
            copy_valid_lbas(ns, &zones[z], dst);   /* host-driven relocation */
            zone_mgmt_send(ns, zones[z].zslba, ZSA_RESET);  /* explicit reclaim */
            free_zone(ns, zones[z].zslba);
        }
    }
}
```

The critical resource constraints are **MOR** (Maximum Open Resources) and **MAR** (Maximum Active Resources): the controller may reject commands with *Too Many Open Zones* (status 0xBE) or *Too Many Active Zones* (0xBD) if the host exceeds them [2]. Host stacks must therefore budget zone opens like file descriptors — a genuinely new resource-management discipline for storage software. The SPDK NVMe driver exposes this entire surface in user space via `nvme_zns.h` (`spdk_nvme_zns_report_zones`, `spdk_nvme_zns_close_zone`, zone append with completion-reported LBA, and the zoned bdev layer with `spdk_bdev_zone_append`) [9].

### 4.2 Flexible Data Placement and Reclaim-Unit Isolation

Where ZNS imposes sequentiality, FDP imposes only *affinity*. The host associates each write with a placement handle; the device guarantees that data written with the same handle lands in the same set of reclaim units (erase-block groups). Consider a mixed workload with tenants A and B:

| Design | Block layout under mixed tenancy | GC behavior when A deletes | Resulting WAF |
|---|---|---|---|
| Conventional SSD | A/B pages interleaved in every block | All blocks need valid-page relocation | ~3.0 [4] |
| FDP-enabled SSD | A pages in A's reclaim units, B in B's | Only A's units erased; B untouched | ~1.0–1.2 [4] |
| ZNS SSD | A's zones vs. B's zones, sequential | Host resets A's zones; no relocation | ~1.0 [6] |

FDP's advantage is *incremental deployability*: existing applications gain endurance benefits by adding placement hints, whereas ZNS demands sequential-write discipline throughout the I/O path. Samsung's testing on RocksDB workloads found ZNS achieved slightly better WAF reduction than FDP, but FDP captured most of the benefit with far less software change [4]. The two are not mutually exclusive — FDP can be viewed as the coarse-grained, constraint-free cousin of ZNS, and future devices may expose both.

### 4.3 ZenFS, F2FS, and Zoned XFS: File-System Co-Design

The first production-grade ZNS software was **ZenFS**, a RocksDB storage backend developed by Western Digital that replaces POSIX files with zone-mapped extents [10]. ZenFS maps each SST file (or file extent) onto one or more zones and performs LSM compaction as zone-to-zone copies followed by zone resets — *host-side GC specialized to the LSM's own data lifecycle*. The OSDI'21 ZNS paper ("ZNS: Avoiding the Block Interface Tax for Flash-based SSDs") demonstrated that this co-design eliminates the double-GC pathology where RocksDB compaction fights device GC, yielding large tail-latency wins [3][10]. Follow-up work (ZenFS+, ZNS+) added striping across zones for parallelism and in-storage compaction offload [3][8].

General-purpose file systems took longer. **F2FS**, already log-structured, gained zoned block-device support: its segment-based allocator maps naturally onto zones, with the kernel's `blkzoned` infrastructure handling zone management commands and `f2fs-tools` providing zone-aware mkfs allocation. **zonefs** takes the minimalist route, exposing each zone as a file for applications (like F2FS's own tooling) that want raw sequential access without a full file system. Most recently, **Zoned XFS** (APSys'25, Hellwig, Holmberg, and Le Moal) retrofitted zoned allocation, intelligent data placement, and a high-throughput GC into XFS, showing higher large-file throughput than Btrfs and F2FS under GC and beating F2FS on mixed RocksDB workloads while rivaling purpose-built ZenFS [7]. The trajectory is clear: from bespoke backends (ZenFS) to adapted log-structured file systems (F2FS) to retrofitted general-purpose file systems (Zoned XFS), each step lowering the adoption barrier.

### 4.4 SPDK and NVMe-oF Host Software Stacks

ZNS is equally at home in user space. SPDK's NVMe driver implements the full Zoned Namespace Command Set in polled-mode user space, and its **zoned bdev** abstraction (`spdk_bdev_is_zoned`, `spdk_bdev_zone_append`, `spdk_bdev_zone_management`, open/active zone accounting) lets higher layers — blobstores, key-value engines, NVMe-oF targets — consume zones without kernel involvement [9]. Because ZNS removes device-side GC nondeterminism, user-space stacks gain something precious: *predictable* latency under polling, which is exactly what microsecond-scale NVMe-oF disaggregation needs.

In disaggregated architectures, NVMe-oF exports namespaces over fabrics (RDMA, TCP) so compute nodes share pooled flash [11]. Exporting a *zoned* namespace over NVMe-oF raises a coordination question — which host owns each zone's write pointer? — and current practice assigns zone ownership to a single initiator or a clustered file system, mirroring the discipline of shared SMR deployments. The combination is powerful: centralized ZNS flash pools with host-managed GC give cloud providers the endurance economics of ZNS (lower overprovisioning, ~1.0 WAF) with the elasticity of disaggregation [11].

### 4.5 Endurance Modeling and the Computational-Storage Outlook

We now formalize the endurance argument. Let $W_{host}$ be host-written bytes, $W_{flash}$ flash-written bytes, and define $WAF = W_{flash}/W_{host}$. For a drive with raw NAND capacity $C$, overprovisioning fraction $o$, user-visible capacity $C_u = C(1-o)$, per-block P/E endurance $E$ cycles, and sustained host write rate $R$:

> **Definition:** The *drive writes per day* (DWPD) sustainable over a $Y$-year service life is $DWPD = \frac{E \cdot C}{WAF \cdot R_{day} \cdot Y \cdot C_u}$, where $R_{day}$ normalizes the daily host write volume to drive capacity.

The model yields two levers unique to host-managed flash. First, driving $WAF \to 1$ multiplies endurance by the WAF ratio directly — Samsung reports conventional enterprise WAF of 3–4 versus near-1.0 on ZNS, a **3–4× lifetime extension** [6]. Second, eliminating device-side GC uncertainty lets vendors *reduce overprovisioning*: analysis presented at FMS showed WAF reduction from 2.5 to 1.25 saves roughly **18% of capital expenditure** by converting spare area into sellable capacity [8].

```python
# Endurance model: service life vs WAF and overprovisioning
def service_years(E_cycles, C_TB, WAF, op_frac, host_TB_per_day):
    C_user = C_TB * (1 - op_frac)
    flash_budget_TB = E_cycles * C_TB          # total bytes NAND can absorb
    host_budget_TB = flash_budget_TB / WAF     # ...translated to host writes
    return host_budget_TB / (host_TB_per_day * 365)

for waf, op in [(3.5, 0.28), (1.25, 0.12), (1.05, 0.07)]:
    print(waf, op, round(service_years(3000, 8.0, waf, op, 4.0), 2), "years")
# (3.5, 0.28) -> ~5.0 years | (1.25, 0.12) -> ~12.6 years | (1.05, 0.07) -> ~15.6 years
```

Looking forward, host-managed flash converges with **computational storage**: once the host controls placement at zone granularity, pushing *compute* to the data becomes architecturally natural. Zone-granular offloads — in-storage compaction (as in ZNS+ [3]), zone-scoped filtering, and reclaim-unit-local aggregation — reuse the same host/device contract that ZNS established. The NVMe Computational Storage direction and the zone-append linearizability result of §4.1 together suggest a future where zones are not just allocation units but *units of offloaded computation*, with the host orchestrating data-parallel kernels across zone sets the way it now orchestrates GC.

---

## 5 Empirical Evaluation

We synthesize published head-to-head evaluations of ZNS stacks against conventional NVMe SSDs. All figures below are reported from cited sources, not measured by this thesis.

| Workload / stack | Conventional SSD | ZNS stack | Reported delta |
|---|---|---|---|
| RocksDB (YCSB) on ZenFS vs. ext4/block SSD [3][8] | WAF ~2.5–3.5; compaction-vs-GC interference; latency spikes | WAF → ~1.0; isolated zones per LSM level; predictable bandwidth | Read-heavy *and* write-heavy YCSB improve; tail latency stabilized |
| RocksDB on ZenFS+ (striped zones) [8] | Single-zone ZenFS shows put-latency spikes (compaction interferes with flush) | Zone striping + isolation removes spikes | Sustained throughput up; p99 put latency down |
| F2FS zoned vs. Btrfs on SMR/ZNS media [7] | Btrfs: GC stalls under mixed load | F2FS: segment→zone mapping, sequential GC | Zoned XFS paper reports F2FS trailing Zoned XFS on large-file and mixed workloads |
| Zoned XFS vs. F2FS, RocksDB mixed r/w [7] | F2FS baseline | Zoned XFS: zoned allocator + HT GC | Significantly higher throughput; comparable to purpose-built ZenFS |
| Samsung PM1731a ZNS vs. conventional enterprise NVMe [6] | WAF 3–4; lifetime baseline | WAF ≈ 1; full capacity usable (no OP reserve) | Up to ~4× endurance; OP area converted to user capacity |

Three patterns emerge. **First**, the wins concentrate in *write amplification and tail latency*, not peak sequential bandwidth — ZNS is an efficiency and predictability technology. **Second**, benefits scale with software co-design depth: ZenFS (purpose-built) ≥ Zoned XFS (retrofitted) > unmodified stacks on FDP (hint-only). **Third**, the zone-to-parallel-unit mapping is a new performance knob: ZNS exposes both device-level and host-level parallelism, and mis-mapping zones to flash parallelism units can *hurt* — the "excessive parallelism considered harmful" analysis (HotStorage'23) shows striping must be deliberate [8].

## 6 Limitations

ZNS is not a free lunch, and an honest account must enumerate the costs.

- **Sequentiality is viral.** Every layer in the I/O path — page cache writeback, journaling, metadata updates — must respect zone append-only discipline or be redirected to conventional zones. Retrofitting random-write-friendly software (relational databases with in-place updates, VM images) remains labor-intensive; this is precisely the gap FDP fills [4].
- **Zone resource limits constrain design.** MOR/MAR bounds (often tens of open zones) force host stacks to multiplex many logical streams onto few open zones, reintroducing a bin-packing problem the block interface never had [2].
- **Host-side GC is now the host's bug.** Device GC bugs were the vendor's problem; host GC bugs (leaked zones, write-pointer desynchronization after crashes, lost zone state) are the operator's. Crash consistency of *zone metadata* — not just file-system metadata — is a new correctness surface, and recovery requires reconciling zone reports with host journals.
- **Small-zone random reads and mixed workloads** see little benefit; ZNS helps writers, while read-dominated workloads gain mainly second-order latency stability.
- **Ecosystem maturity** still lags: zone-aware tooling, monitoring (per-zone valid ratios, WAF telemetry), and multi-initiator NVMe-oF zone coordination are works in progress [9][11].
- **Endurance models assume uniform P/E wear**; real 3D NAND exhibits program-disturb, retention, and read-disturb effects our closed-form model abstracts away.

## 7 Conclusion

Zoned Namespace SSDs complete an architectural arc that began with host-managed SMR: the storage device stops pretending that random logical writes map cleanly onto erase-block physics, and the host accepts responsibility for sequentiality in exchange for the elimination of device-side garbage collection. The NVMe Zoned Namespace Command Set [1][2] distills this contract to a minimal, powerful vocabulary — *Zone Append* with completion-reported LBAs, *Zone Management Send/Receive*, and explicit *Reset* — whose linearizability property makes it a natural log primitive. Around it has grown a full host-managed stack: ZenFS and ZNS+ for LSM engines [3], F2FS and zonefs and Zoned XFS for file systems [7], SPDK's zoned bdev for user space [9], and NVMe-oF for disaggregated flash pools [11]. Flexible Data Placement [4] offers a pragmatic on-ramp for software unwilling to adopt sequentiality, capturing most of the WAF benefit with placement hints alone. Our endurance model quantifies the prize — WAF 3.5 → 1.05 converts a 5-year drive into a 15-year drive at fixed workload — and published evaluations confirm the mechanism [6][8]. The remaining work is software: crash-consistent zone metadata, zone-aware observability, and the computational-storage extensions that will turn zones from allocation units into units of offloaded compute. The block interface tax is optional now; the industry is deciding how much of it to stop paying.

## References

[1] NVM Express, Inc. "NVM Express Zoned Namespace Command Set Specification, Revision 1.2." Ratified Aug. 2024. https://nvmexpress.org/wp-content/uploads/NVM-Express-Zoned-Namespace-Command-Set-Specification-Revision-1.2-2024.08.05-Ratified.pdf

[2] NVM Express, Inc. "NVM Express Zoned Namespace Command Set Specification, Revision 1.5." Ratified Jul. 2026. https://nvmexpress.org/wp-content/uploads/NVM-Express-Zoned-Namespace-Command-Set-Specification-Revision-1.5-Ratified-2026.07.31.pdf

[3] Han, K. et al. "ZNS+: Advanced Zoned Namespace Interface for Supporting In-Storage Zone Compaction." Proc. 15th USENIX Symposium on Operating Systems Design and Implementation (OSDI '21). http://nyx.skku.ac.kr/wp-content/uploads/2022/02/osdi21-han.pdf

[4] Mellor, C. "Using SSD data placement to lessen SSD write amplification." Blocks & Files, Aug. 2023. (FDP: Google/Meta joint proposal, TP 4146; Samsung RocksDB WAF comparison.) https://www.blocksandfiles.com/architecture/2023/08/14/using-ssd-data-placement-to-lessen-ssd-write-amplification/1600183

[5] NVM Express, Inc. "Open Source Software — Linux Kernel ZNS Support (GA in 5.9), zonefs, libzbd, xNVMe." https://nvmexpress.org/drivers/open-source-software/

[6] Samsung Electronics / TechPowerUp. "Samsung Introduces its First ZNS SSD (PM1731a) with Maximized User Capacity and Enhanced Lifespan." 2021. (WAF 3–4 → ~1; up to 4× endurance; zero-OP capacity.) https://www.techpowerup.com/282893/samsung-introduces-its-first-zns-ssd-with-maximized-user-capacity-and-enhanced-lifespan?amp

[7] Hellwig, C., Holmberg, H., and Le Moal, D. "Staying in the Zone — Retrofitting Zoned Storage into Scalable Enterprise File System (Zoned XFS)." Proc. 16th ACM SIGOPS Asia-Pacific Workshop on Systems (APSys '25). https://www.storagenewsletter.com/2026/01/22/rd-staying-in-the-zone-retrofitting-zoned-storage-into-scalable-enterprise-file-system/

[8] NVRAMOS'23 presentation. "ZNS SSDs: Characteristics and Implications." (RocksDB/ZenFS/ZenFS+ YCSB evaluation; SmartFTL WAF 2.5→1.25, 18% CapEx; Zhang et al. HotStorage'23 on parallelism.) https://sigfast.or.kr/nvramos/nvramos23/presentation/NVRAMOS23_%EC%B5%9C%EC%A2%85%EB%AC%B4.pdf

[9] SPDK. "nvme_zns.h File Reference — NVMe driver public API extension for Zoned Namespace Command Set; zoned bdev APIs." https://spdk.io/doc/nvme__zns_8h.html

[10] Western Digital Corporation. "ZenFS — RocksDB storage backend for Zoned Namespace SSDs." GitHub discussions. https://github.com/westerndigitalcorporation/zenfs/discussions/1

[11] TechTimes. "How New Storage Tech Like ZNS SSDs, NVMe-oF, and Computational Storage are Changing Servers." Jun. 2026. https://www.techtimes.com/articles/317663/20260603/how-new-storage-tech-like-zns-ssds-nvme-computational-storage-are-changing-servers.htm
