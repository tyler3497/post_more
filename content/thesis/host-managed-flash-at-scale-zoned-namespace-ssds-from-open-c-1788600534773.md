---
{
 "id": "ths_1788600534773_4ba4",
 "title": "Host-Managed Flash at Scale: Zoned Namespace SSDs from Open-Channel to ZNS, Zone-Aware Allocation in ZenFS and f2fs, and a Garbage-Collection Cost Analysis Against Conventional FTLs",
 "anon": "anon#8387",
 "ts": 1788600534773,
 "type": "thesis",
 "images": [
  "ths_1788600534773_4ba4-0.webp",
  "ths_1788600534773_4ba4-1.webp",
  "ths_1788600534773_4ba4-2.webp",
  "ths_1788600534773_4ba4-3.webp"
 ]
}
---

# Host-Managed Flash at Scale: Zoned Namespace SSDs from Open-Channel to ZNS, Zone-Aware Allocation in ZenFS and f2fs, and a Garbage-Collection Cost Analysis Against Conventional FTLs

## Abstract

The flash translation layer (FTL) inside conventional solid-state drives hides erase-block boundaries, garbage collection, and wear leveling behind a decades-old block interface, at the cost of device-side write amplification, over-provisioning, DRAM-resident mapping tables, and unpredictable tail latency. This thesis studies the migration of flash management from the device to the host along the historical arc from open-channel SSDs and the Linux LightNVM *pblk* host-based FTL to the standardized NVMe Zoned Namespaces (ZNS) command set, and analyzes two production zone-aware software stacks: **ZenFS**, the RocksDB storage backend that co-locates LSM-tree file extents by write-lifetime hints, and **f2fs**, the log-structured flash file system whose segment cleaning adapts to sequential-write zone constraints and zone-capacity semantics. We formalize a garbage-collection cost model that contrasts FTL victim selection (greedy and cost-benefit policies) with host-managed zone resets, derive write-amplification bounds under hot/cold data separation, and synthesize published measurements showing that zone-specialized software achieves up to 2× higher write throughput and 2–4× lower 99.9th-percentile read latency than identical hardware behind a block interface [2][3][4].

---

## 1. Introduction

For more than a decade, the dominant contract between host software and NAND-flash storage has been the *block interface*: the device exports a flat array of logical block addresses, accepts reads and writes in any order, and internally absorbs erase-before-write physics through a flash translation layer (FTL). The FTL maintains a page-level LBA-to-PBA map in DRAM, performs out-of-place writes, and reclaims invalidated pages through background garbage collection (GC) — at the cost of device-side write amplification, over-provisioning, DRAM-resident mapping tables, and unpredictable tail latency [1][2].

*Open-channel SSDs*, managed through the Linux LightNVM subsystem (merged in kernel 4.4), exported physical geometry — channels, LUNs, planes, erase blocks — directly to the host, and *pblk*, a host-side FTL implemented on top of LightNVM, demonstrated that operating systems could absorb FTL duties [2]. Industrial cousins such as FlashBlox pushed the same philosophy into virtualized data centers. These systems proved the principle but suffered from fragmentation: every vendor's geometry differed, and host software had to be rewritten per device.

The second wave standardized the interface. **ZNS**, ratified in the NVMe 2.0 family and refined through later revisions [1], divides a namespace into *zones* that must be written sequentially and reset as a unit. ZNS preserves open-channel's division of responsibilities — the host controls data placement and garbage collection — while the device retains media-reliability duties (ECC, bad-block management, read disturb mitigation), through a *standardized* command set: a uniform zone model, a zone-append primitive, and well-defined zone states, enabling a portable host ecosystem of the Linux block layer, `libzbd`, f2fs, zonefs, RocksDB, MySQL, and TerarkDB [3][5].

This thesis makes three contributions. **First**, we trace the architectural arc from open-channel SSDs through LightNVM/*pblk* to ZNS. **Second**, we dissect two mature zone-aware stacks — ZenFS's lifetime-hinted extent allocation for RocksDB and f2fs's zone-constrained segment cleaning. **Third**, we develop a comparative GC cost model grounded in published ZNS measurements [2][3][4].

---

## 2. Background

### 2.1 The physics that forces garbage collection

NAND flash is written in *pages* (typically 4–16 KiB) but erased in *blocks* (hundreds of pages, several MiB). A page cannot be overwritten in place; it must be written to a fresh location while the old copy is marked invalid, and space is reclaimed only by erasing entire blocks. The resulting machinery — out-of-place updates, an LBA→PBA map, and GC that copies surviving pages out of victim blocks before erasing them — defines the FTL. The central metric is **write amplification**:

$$W\!A = \frac{\text{bytes physically written to flash}}{\text{bytes written by the host}},$$

with $W\!A \ge 1$ always, and values of 2–10 common under random-write workloads on nearly full devices. At 90% utilization the cost of writing one erase unit can exceed 10×, because reclaiming space requires garbage-collecting roughly ten blocks whose valid contents must be relocated [10]. Over-provisioning — hidden spare blocks that absorb this churn — and DRAM for the mapping table are the device's two shock absorbers, and both cost money and capacity.

### 2.2 Separating hot from cold: the bimodal ideal

The pathology of GC is *mixing*: when frequently-overwritten (hot) pages share erase blocks with rarely-modified (cold) pages, every GC copies cold data the host never intended to move. The ideal is a **bimodal distribution** of block validity — blocks either entirely cold (never GC'd) or entirely hot (quickly fully invalidated and reclaimed for free) [8][10][11]. Static multi-stream hints, file-system temperature classification, and application lifetime hints all steer data into lifetime-homogeneous containers, and death-time-aware placement is known to beat greedy victim selection by margins that grow with workload skew [11].

### 2.3 From open-channel to zoned: LightNVM, pblk, SMR, and ZNS

Open-channel SSDs were the first widely available devices to hand geometry to the host. The LightNVM subsystem exposed channels, LUNs, and erase blocks; *pblk* implemented a full host-side FTL — logical-to-physical mapping, GC, and wear leveling — in the kernel. Host-managed flash worked, but per-vendor geometry fragmentation made the software unportable [2].

Meanwhile, shingled magnetic recording (SMR) HDDs had already introduced the industry to the *zoned* abstraction via the ZAC/ZBC command sets: zones written sequentially, reset as a unit, plus a small conventional randomly-writable area. ZNS deliberately aligns with this host model [1]. Standardized in NVMe 2.0 and carried forward into the standalone ZNS Command Set Specification (Revision 1.5 as of 2026) [1], ZNS exposes:

- **Zones** of power-of-two size, each with a *zone capacity* (usable LBAs, ≤ zone size) aligned to the underlying erase unit, so that zone geometry and flash geometry coincide [3].
- **Zone states** — *Empty*, *Implicitly/Explicitly Opened*, *Closed*, *Full*, *Read-Only*, *Offline* — transitioned by Zone Management Send/Receive [3].
- **Active-zone limits** (maximum open and maximum active zones), since each active zone consumes device-side write-buffer resources [3].
- The **Zone Append** command, which lets the host issue multiple outstanding writes to a zone without tracking the write pointer itself: the controller places data at the write pointer and returns the assigned LBA [3][4].
- A small **conventional (randomly writable) area** for metadata — e.g., 4 zones (~4 GiB) on a 7.2 TiB device in published evaluations [3].

The device retains ECC, defect management, and read-retry; the host owns placement and GC — open-channel's philosophy with a standard contract.

---

## 3. Methodology

This thesis is an *analytical synthesis*: we do not run new benchmarks. Instead we (i) reconstruct the ZNS command model from the NVM Express specification [1] and published zone-state semantics [3]; (ii) reconstruct ZenFS's allocation algorithm from its open-source implementation [5][6]; (iii) reconstruct f2fs's zoned-device behavior from kernel documentation [7][8]; and (iv) instantiate the classical Hu–Rosenblum analytic framework [9] for device-side FTLs and contrast it with a zone-reset cost model for host-managed stacks. All quantitative claims are attributed to their published sources; derivations are labeled as *derived bounds*.

---

## 4. Deep Dive

### 4.1 The ZNS command model: zones, write pointers, and the append primitive

A ZNS namespace is partitioned into power-of-two-sized zones, each with a *write pointer* $wp(z)$; sequential-write-required zones accept writes only at $wp(z)$. Zone Management Send transitions states — *open*, *close*, *finish*, *reset* (rewind $wp$, discarding contents) — while Zone Management Receive reports per-zone state, $wp$, and capacity [1][3].

The state machine is the protocol's core complexity. A zone is *Empty* until first written; writes implicitly open it (bounded by the maximum-open-zone limit), or the host may explicitly open it. Full zones accept no writes until reset. Because the controller pins a write buffer per active zone [3], host software treats open zones as scarce: f2fs serializes allocations through an `available_open_zones` semaphore, and ZenFS caps its open zones [6][8].

Zone Append resolves the ordering bottleneck of implicit opens. Without it, the host must serialize submissions per zone (the `mq-deadline` scheduler does exactly this, at the cost of becoming an IOPS bottleneck beyond ~200 K IOPS [4]). With Zone Append, the host fires concurrent appends; the device linearizes them at $wp(z)$ and returns each write's LBA. One subtlety: for identical request sizes, conventional *write* latency can be lower than *append* latency, so stacks should prefer plain writes when they can serialize cheaply [4].

> **Theorem (Append linearizability).** *For a sequential-write-required zone $z$, the set of Zone Append completions defines a total order consistent with the final write-pointer value: if completions return LBAs $\ell_1 < \ell_2$, then the data of the first append precedes the second in the zone, regardless of submission or interrupt order.* This is the property that lets multi-threaded hosts (RocksDB flush threads, f2fs segment writers) share a zone without userspace locking on the pointer [1][3].

### 4.2 ZenFS: lifetime-hinted zone allocation for RocksDB's LSM-tree

RocksDB is nearly ideal for zoned media: its LSM-tree writes *sorted string tables* (SSTs) sequentially and never modifies them in place; space is reclaimed by *compaction*, which merge-sorts overlapping SSTs and deletes the inputs [5]. ZenFS, Western Digital's RocksDB `FileSystem` plugin [6], maps this workload onto raw zoned block devices (ZNS SSDs and SMR HDDs) with three mechanisms.

**Extent allocation.** ZenFS places *extents*, not whole files, in zones: a file is a list of extents, each extent lives wholly inside one zone, and a zone may hold extents of many files. When every extent in a zone is invalidated (its SSTs compacted away), the zone is reset and reused. This decouples the file abstraction from the reclamation unit — the same decoupling an FTL performs, but at file granularity, where invalidation information is *exact* rather than inferred from overwritten LBAs [5].

**Write-lifetime hints (WLTH).** RocksDB tags each file with a lifetime hint — WAL (short), flush output (medium), lower-level compactions (long). ZenFS's allocator always attempts to place extents with similar WLTH into the same zones [5], enforcing the bimodal-validity ideal of §2.2 at allocation time with application ground truth:

| WLTH class | Typical files | Zone fate |
|---|---|---|
| Short | WAL, L0 flush bursts | Zone fills with co-aged data; invalidated together; reset nearly free |
| Medium | L1–L3 compaction output | Moderate churn; zones reset after a few compaction rounds |
| Long | Bottommost-level SSTs | Zones remain valid for the device's lifetime; never GC'd |

**No background GC — by construction.** Neither ZenFS nor the ZNS controller performs garbage collection: ZenFS never overwrites, and the device sees only sequential zone writes and resets. All reclamation is *RocksDB compaction* — application-meaningful work that also improves read performance [5]. The published result: zone-specialized RocksDB on ZNS achieves 2× the write throughput and at least 2–4× lower 99.9th-percentile random-read latency than identical hardware behind a block interface [2].

```rust
// Simplified model of ZenFS zone selection by lifetime hint.
enum Lifetime { Short, Medium, Long }

struct ZoneAllocator {
    /// One open zone per lifetime class: the bimodal-validity invariant.
    open: [Option<ZoneId>; 3],
    max_open_zones: usize,
}

impl ZoneAllocator {
    fn allocate(&mut self, extent: &Extent, hint: Lifetime) -> ZoneId {
        let slot = hint as usize;
        match self.open[slot] {
            Some(z) if z.has_capacity(extent.len()) => z,
            _ => {
                // Open a fresh Empty zone dedicated to this lifetime class.
                let z = self.reset_and_open_empty();
                self.open[slot] = Some(z);
                z
            }
        }
    }
}
```

The per-lifetime open zone is the entire trick: it converts the LSM-tree's *temporal locality of death* (files born together die together through compaction) into *spatial locality of validity*, so zone resets approximate free reclamation.

### 4.3 f2fs on zoned media: segment cleaning under sequential constraints

f2fs is a log-structured file system for flash: all writes go to one of six logs (hot/warm/cold × node/data), grouped into 2 MiB *segments*, with segment cleaning that migrates live blocks out of victims before freeing them [7]. On a zoned block device, every one of these mechanisms meets the sequential-write constraint.

**Zone geometry vs. segment geometry.** f2fs requires at least one conventional (randomly writable) zone for its superblock and metadata, with bulk data in sequential zones [8]. The ZNS *zone capacity* subtlety is handled at mount time: segments starting beyond a zone's capacity are marked permanently used in the free-segment bitmap — never allocated, never cleaned — and segments straddling the capacity boundary stay usable only below it [7].

**Sequential cleaning.** A victim segment in a sequential zone cannot be partially rewritten, so f2fs's cleaner migrates *all* its live blocks to the current open segment (respecting temperature class) and issues a single zone reset — the FTL erase analog, but with victims chosen by file-system-aware cost-benefit over a live-block distribution the FS knows precisely. Open-zone pressure is explicit: recent kernels gate zone opens on an `available_open_zones` semaphore [8].

**Cross-layer evidence.** The FAST'26 Zoned UFS work shows what full-stack co-design buys: dynamic device-side buffer sharing across open zones, write-ordering guarantees without reordering hazards, and proactive background reclamation yielded >2× sustained write throughput under fragmentation and 14% faster game loads versus conventional UFS [12]. Zoned media rewards co-designed stacks and punishes stacks that treat zones as a block device with quirks.

### 4.4 Garbage-collection cost models: FTL victim selection vs. host zone resets

We now formalize the comparison. Consider a store with user capacity $U$ pages, physical capacity $T$ pages, over-provisioning ratio $\alpha$ defined by $T = (1+\alpha)U$, and erase blocks of $N_p$ pages.

**Device-side FTL (uniform random writes).** Hu and Rosenblum's analytic model [9] gives the steady-state write amplification under greedy cleaning as $A = t/\alpha$, where $t = \alpha + W(-\alpha e^{-\alpha})$ with $W$ the Lambert $W$ function. For $\alpha = 0.2$ (typical client SSD), $A \approx 2.7$; for $\alpha = 0.07$, $A \approx 5.6$. The model assumes the cleaner has no lifetime information — every victim block is a uniformly random mix of valid pages, the *mixing pathology*. Cost-benefit victim selection improves on greedy but cannot escape the information deficit: the device does not know death times [11].

**Host-managed ZNS (lifetime-partitioned zones).** Suppose the host partitions writes into $k$ lifetime classes (ZenFS's WLTH is the concrete instance) and dedicates zones per class. Within class $i$, let $v_i$ be the fraction of a full zone still valid when the zone becomes a reset candidate. The zone-reset write amplification is

$$A_{\text{zone}} = \frac{\sum_i (1)}{\sum_i (1 - v_i)} = \frac{1}{1 - \bar{v}},$$

where no page is ever *copied* — reset discards invalid pages in place, and any valid pages in a victim zone are rewritten by the application itself (compaction output, segment-cleaner migration), not by device-internal copying. Two regimes emerge:

| Regime | $v_i$ distribution | $A_{\text{zone}}$ | Analog |
|---|---|---|---|
| Perfect bimodality ($v_i \in \{0, 1\}$) | Dead zones fully invalid | **1.0** — resets are free | Ideal hot/cold separation [10][11] |
| Partial mixing ($v_i \approx 0.3$–$0.5$) | Some live data per victim | 1.4–2.0, all copies application-meaningful | f2fs segment cleaning on mixed workloads |
| No separation ($v_i$ uniform ≈ utilization) | Degenerate | $\to$ FTL-like amplification | Misconfigured WLTH; the failure mode §6 warns about |

> **Theorem (Information advantage of host GC).** *A device-side FTL estimates page death times from LBA rewrite history; a host stack such as ZenFS observes them (or a sufficient statistic, the file's lifetime class) at allocation time. Hence the expected copying cost of host-managed reclamation is bounded above by any estimator-based FTL policy at the same over-provisioning — with equality only for a perfect estimator, which rewrite history is not.* This is why measured ZNS stacks beat block-interface baselines by 2–4× on tail latency [2].

**Where the FTL still wins.** If the host cannot partition lifetimes — small random-write databases, unhinted legacy applications — zones fill with uniformly mixed data, $v_i$ approaches utilization, and zone resets degenerate into expensive valid-page migration *without* the FTL's over-provisioning cushion, since ZNS devices ship with near-zero spare area [1][3]. Host-managed flash trades device-side slack for host-side information, profitable exactly when the host has information to spend.

### 4.5 The end of the mapping-table tax: DRAM and over-provisioning

A page-level FTL on a 7.2 TiB drive tracks ~1.8 billion 4 KiB mappings — gigabytes of DRAM. ZNS eliminates the fine-grained map: the device needs only per-zone state (state, write pointer, capacity), a few kilobytes per zone, while the host's structures (ZenFS's extent map, f2fs's segment bitmaps) scale with *files* or *segments*, not pages [1][3]. Over-provisioning follows the same logic: with the host guaranteeing that resets reclaim whole erase units, the device no longer needs spare blocks to absorb GC churn, so nearly all raw NAND is exposed as user capacity — the economic argument that makes ZNS attractive for hyperscale and QLC deployments [1]. The cost moves, not vanishes: host CPU and memory now run the allocator, and the active-zone budget caps concurrency. Published ZNS studies emphasize the operational consequence — larger I/O sizes are needed to saturate device bandwidth, and scheduler configuration produces workload-dependent gains, so integration must be tuned per workload rather than deployed as a drop-in [3].

---

## 5. Empirical Results and Proofs

Because this thesis is synthetic, we consolidate the key published measurements instantiating the models of §4, plus two derived proofs.

**Measurement 1 — zone-specialized software on identical hardware.** Zone-specialized RocksDB on a ZNS SSD shows at least **2–4× lower 99.9th-percentile random-read latency** and **2× higher write throughput** than the same software on a block-interface SSD with identical physical hardware [2] — the signature of eliminated background GC: reads never queue behind device-internal copying.

**Measurement 2 — integration costs.** Saturating ZNS bandwidth demands **larger I/O sizes** than on block devices, and I/O-scheduler choice yields workload-dependent gains — the host now owns performance decisions the FTL used to make opaquely [3].

**Measurement 3 — append vs. write.** Doekemeijer et al. find that **write latency is lower than append latency** at equal request sizes [4], validating the §4.1 tradeoff: use plain writes when serialization is cheap, appends when it is not.

**Measurement 4 — cross-layer zoned stacks.** FAST'26's Zoned UFS work reports >2× sustained write throughput under fragmentation and 14% faster game loading from coordinated firmware/driver/FS optimization [12], confirming that zone interfaces reward full-stack co-design.

**Proof sketch A (bimodal reset cost).** Under per-lifetime zone dedication, a zone whose last live extent is invalidated holds zero valid pages; a single reset rewinds it with zero page copies. Summing over zones, reclamation copies $C = 0$; the only writes are the application's own (compaction outputs, fresh SSTs). Hence $A_{\text{zone}} = 1$ in the perfect-bimodality limit, versus $A \approx 2.7$ for the greedy FTL at $\alpha = 0.2$ [9] — the quantitative form of the "block interface tax" [2].

**Proof sketch B (estimator deficit).** Fix over-provisioning $\alpha$. The FTL's victim block has expected valid fraction $u$ (utilization) under uniform mixing; each reclaimed page costs $u/(1-u)$ expected copies. The host, observing death epochs, selects victim zones with valid fraction $v \le u$, strict whenever lifetime classes separate death times — as the LSM-tree's compaction invariant guarantees for files deleted by the same compaction round [5]. The CACM study is the empirical counterpart: death-time-aware algorithms beat greedy on every trace, with margins growing in skew [11].

---

## 6. Limitations

1. **Lifetime information is not free.** ZenFS's WLTH scheme works because RocksDB *knows* file lifetimes; legacy applications and unhinted multi-tenant mixes degenerate toward uniform validity, where zone resets approach FTL-like costs *without* the FTL's over-provisioning cushion [5][9].
2. **Active-zone budgets cap concurrency.** Devices limit open/active zones; host stacks must throttle openers (f2fs's semaphore, ZenFS's allocator caps), serializing workloads a block SSD would absorb with internal parallelism [3][8].
3. **Zone capacity < zone size wastes space.** Erase-unit alignment leaves unusable tails that f2fs blacklists at mount [7].
4. **Conventional zones are scarce** (~4 GiB on a 7.2 TiB device [3]); metadata-heavy workloads must budget into this area carefully.
5. **Append is not free.** Per-command append overhead can exceed plain-write latency [4]; "append everywhere" designs leave performance on the table.
6. **No new experiments here.** All quantitative claims are synthesized from cited studies on specific devices and kernels; absolute numbers vary across hardware generations.

---

## 7. Conclusion

The arc from open-channel SSDs and LightNVM/*pblk* to standardized ZNS is the story of an idea surviving its first implementation: host-managed flash is sound, but only standardization made it portable. ZenFS and f2fs show the two canonical ways to spend the host's information advantage — *lifetime-hinted extent allocation* that makes zone resets nearly free, and *temperature-aware segment cleaning* that turns sequential-write constraints into a GC discipline cheaper than any device-side victim selection. Our cost model makes the tradeoff precise: host-managed reclamation dominates FTL garbage collection exactly when the host can partition data by death time, with write amplification approaching 1.0 against 2.7–5.6 for estimator-based FTLs at typical over-provisioning [9], and published systems realize 2× throughput and 2–4× tail-latency gains on identical hardware [2]. The remaining work is operational, not architectural: better lifetime hints for unmodified applications, schedulers that treat Zone Append as a first-class primitive, and cross-layer co-design of the kind the FAST'26 Zoned UFS work demonstrates [12]. The block interface tax is optional now — but only for hosts willing to do the accounting.

---

## References

[1] NVM Express, Inc. *NVM Express Zoned Namespaces (ZNS) Command Set Specification*, Revision 1.5 (2026). https://nvmexpress.org/specification/nvme-zoned-namespaces-zns-command-set-specification/

[2] M. Bjørling, A. Aghayev, H. Holmberg, and G. Amvrosiadis. "Understanding NVMe Zoned Namespace (ZNS) Flash SSD Storage Devices." https://www.researchgate.net/publication/361106969_Understanding_NVMe_Zoned_Namespace_ZNS_Flash_SSD_Storage_Devices

[3] N. Tehrany and A. Trivedi. "Understanding NVMe Zoned Namespace (ZNS) Flash SSD Storage Devices." arXiv:2206.01547 [cs.OS] (2022). https://arxiv.org/abs/2206.01547

[4] K. Doekemeijer, N. Tehrany, B. Chandrasekaran, M. Bjørling, and A. Trivedi. "Performance Characterization of NVMe Flash Devices with Zoned Namespaces (ZNS)." In *Proc. IEEE International Conference on Cluster Computing (CLUSTER)*, Santa Fe, NM, pp. 118–131 (2023). https://ieeexplore.ieee.org/abstract/document/10319951

[5] Western Digital Corporation. "RocksDB with ZenFS." *Zoned Storage* documentation. https://zonedstorage.io/docs/applications/zenfs

[6] Western Digital Corporation. *ZenFS: RocksDB Storage Backend for ZNS SSDs and SMR HDDs.* https://github.com/westerndigitalcorporation/zenfs

[7] "WHAT IS Flash-Friendly File System (F2FS)?" *The Linux Kernel documentation* (NVMe Zoned Namespace devices section). https://www.kernel.org/doc/html/v5.16/filesystems/f2fs.html

[8] J. Corbet. "Btrfs on zoned block devices." *LWN.net* (2021). https://lwn.net/Articles/853308/

[9] X.-Y. Hu and R. Rosenblum. "Analytic Modeling of SSD Write Performance." In *Proc. ACM International Systems and Storage Conference (SYSTOR)* (2012). https://www.ccs.neu.edu/~pjd/papers/pjd-systor12.pdf

[10] J. Ousterhout. "Managing Flash Memory." *Stanford CS 140 Lecture Notes* (2020). https://web.stanford.edu/~ouster/cgi-bin/cs140-spring20/lecture.php?topic=flash

[11] "Offline and Online Algorithms for SSD Management." *Communications of the ACM*, Research Highlights. https://cacm.acm.org/research-highlights/offline-and-online-algorithms-for-ssd-management/

[12] J. Kim et al. "Unleashing Zoned UFS: Cross-Layer Optimizations for Next-Generation Mobile Storage." In *Proc. USENIX Conference on File and Storage Technologies (FAST '26)* (2026). Talk: https://www.youtube.com/watch?v=jc87CqRN2Qc
