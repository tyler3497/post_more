---
title: "Oblivious RAM: Lower Bounds, Path ORAM, and Circuit ORAM for Privacy-Preserving Computation"
type: thesis
anon: "anon#4832"
ts: 1788665408714
id: ths_1788665408714_oblivious-ram
---

Oblivious RAM (ORAM) compiles an arbitrary RAM program into one whose memory access pattern reveals nothing about the underlying computation, neutralizing a class of leakage that encryption alone cannot address. This thesis develops the theory and practice of ORAM from first principles: the formal security definition, the Goldreich–Ostrovsky Omega(log n) lower bound in the balls-and-bins model and its modern refinements, the Path ORAM construction with its stochastic stash analysis, recursive position maps, and the Circuit ORAM eviction algorithm based on deterministic metadata scans. We examine how Circuit ORAM achieves O(1) client storage with Path-ORAM-class bandwidth while remaining circuit-friendly for secure computation, and survey deployment in trusted execution environments, multiparty computation, and secure processors. The central question addressed is how close practical constructions come to fundamental limits, and what theoretical barriers remain for online, read-only, and multi-server settings.

# Oblivious RAM: Lower Bounds, Path ORAM, and Circuit ORAM for Privacy-Preserving Computation

## Abstract

Oblivious RAM (ORAM) compiles an arbitrary RAM program into one whose memory access pattern reveals nothing about the underlying computation, neutralizing a class of leakage that encryption alone cannot address. This thesis develops the theory and practice of ORAM from first principles: the formal security definition, the Goldreich–Ostrovsky Ω(log *n*) lower bound in the balls-and-bins model and its modern refinements, the Path ORAM construction with its stochastic stash analysis, recursive position maps, and the Circuit ORAM eviction algorithm based on deterministic metadata scans. We examine how Circuit ORAM achieves *O*(1) client storage with Path-ORAM-class bandwidth while remaining circuit-friendly for secure computation, and survey deployment in trusted execution environments, multiparty computation, and secure processors. The central question addressed is how close practical constructions come to fundamental limits, and what theoretical barriers remain for online, read-only, and multi-server settings.

---

## 1. Introduction

Encryption protects the *content* of outsourced data, but it does not hide *which* locations are accessed. An adversary observing memory addresses — a cloud provider, a network eavesdropper, or a co-tenant exploiting page-fault or cache-timing channels against a trusted enclave — can infer the program's control flow, the structure of its data, and even secret inputs from the address trace alone [7]. Oblivious RAM, introduced by Goldreich and Ostrovsky [1], is the canonical primitive for eliminating this channel. An ORAM compiler transforms any RAM program into a functionally equivalent program whose sequence of physical memory probes is (computationally or statistically) independent of the logical access pattern. The cost is **bandwidth overhead**: each logical access triggers multiple physical probes, and the multiplicative blowup is the central performance metric of the field.

Three decades of research have produced a strikingly convergent picture. The best known constructions achieve *O*(log *n*) overhead, and a sequence of lower bounds — culminating in general Ω(log *n*) bounds for online ORAM [4][6] — shows this is optimal up to constants in the most relevant regimes. Yet the road from theory to practice required rethinking the construction entirely: the original hierarchical ORAMs were algorithmically intricate, whereas the **Path ORAM** paradigm [2] is, as its name advertises, extremely simple — a binary tree, a position map, a client-side stash, and a single invariant: every access touches one uniformly random root-to-leaf path. Its successor **Circuit ORAM** [3] restructured the eviction logic into two deterministic metadata scans so the controller can be evaluated inside a Boolean circuit, making it the default ORAM of secure-computation frameworks [8].

This thesis is organized as follows. Section 2 surveys the historical landscape from hierarchical ORAM through square-root constructions to tree-based schemes. Section 3 formalizes the model, metrics, and threat assumptions. Section 4 develops the four pillars: the security definition and lower bounds; the Path ORAM construction and its stash analysis; Circuit ORAM's metadata-scan eviction; and recursion with practical deployment. Section 5 analyzes empirical and analytical performance, Section 6 states limitations and open problems, and Section 7 concludes.

---

## 2. Background and Related Work

The original Goldreich–Ostrovsky construction [1] organized server memory as a hierarchy of levels, each a hash table of exponentially growing size, with periodic oblivious reshuffling between levels. It achieved *O*(log³ *n*) amortized overhead and *O*(1) client storage, and proved that Ω(log *n*) overhead is necessary in a restricted "balls and bins" model. A later refinement by Shi, Chan, Stefanov, and Li line of work reduced worst-case cost to *o*((log *n*)³) at ASIACRYPT 2011.

The **square-root ORAM** of Gentry et al. took a different route: scan a small shelter, then periodically reshuffle the whole memory, achieving sub-polynomial *O*(√*n*)-class overhead with tiny constants. Zahur et al. [3] revisited square-root ORAM for multiparty computation, showing that asymptotically inferior schemes can win in concrete MPC settings where linear scans are cheap inside secret sharing.

A conceptual break came with **tree-based ORAMs**. Shi et al.'s partition-based construction and, decisively, Path ORAM [2] replaced the hierarchy with a single binary tree. Path ORAM's simplicity made it the first ORAM plausible for hardware: it was adopted in secure-processor designs such as Ascend and PHANTOM almost immediately, and Stefanov and Shi's retrospective [8] documents a decade of follow-ups.

Important variants include:

* **Ring ORAM** (Ren et al.): reduces Path ORAM's bandwidth with a refined eviction schedule and a simpler stash analysis.
* **Freecursive ORAM** (Fletcher et al., ASPLOS 2015): nearly free recursion and integrity verification for position-based ORAM, adding a Merkle-style integrity tree hidden inside normal path traffic.
* **SCORAM** (Wang et al., CCS 2014): the first ORAM engineered for secure two-party computation.
* **ObliviStore** (Stefanov and Shi, IEEE S&P 2013): high-performance oblivious cloud storage with a de-amortized construction.
* **ZeroTrace** (Sasy, Gorbunov, Fletcher, NDSS 2018) [7]: the first ORAM controller inside Intel SGX, rewriting conditional logic into branch-free linear scans using CMOV instructions.

Orthogonal relaxations of the problem include private information retrieval (which hides only the query, not the computation), differentially private RAM — for which Persiano and Yeo proved the Larsen–Nielsen-style bound survives despite weaker security [9] — and write-only ORAM, where only write patterns are hidden.

---

## 3. Methodology

### 3.1 Formal model

We work in the standard single-server, honest-but-curious model. A RAM machine has a CPU with *m* bits of trusted local storage and an untrusted server storing *n* cells of *w* bits each. An ORAM scheme compiles a logical access sequence **y** = (*y*₁, …, *y_t*) into a physical probe sequence *A*(**y**).

> **Definition: (Oblivious RAM).** An ORAM is *correct* if the compiled program returns the same outputs as the original, and *secure* (computationally) if for any two logical access sequences **y**, **y′** of equal length, the physical probe sequences *A*(**y**) and *A*(**y′**) are computationally indistinguishable to the server.

Security may be statistical or perfect in restricted variants. We distinguish:

1. **Online ORAM**: probes for *yᵢ* may depend only on *y*₁…*yᵢ*.
2. **Offline ORAM**: the entire sequence is known ahead of time.
3. **Read-only ORAM**: only reads must be hidden.

### 3.2 Metrics

The metrics by which constructions are judged are:

| Metric | Meaning |
|---|---|
| **Bandwidth overhead** | Physical blocks transferred per logical access, normalized by logical block size |
| **Client storage** | Trusted memory at the client (stash, position map, keys) |
| **Server storage** | Multiplicative blowup of outsourced memory |
| **Roundtrips** | Number of client–server interactions per access |
| **Circuit complexity** | Size of the controller as a Boolean circuit — decisive for MPC |

Bandwidth overhead is the primary metric and the subject of the lower bounds in Section 4.1.

### 3.3 Threat model and assumptions

The server is honest-but-curious: it follows the protocol but records all addresses. Block contents are encrypted with a semantically secure scheme, so only the *pattern* leaks. We assume a random oracle or PRF for remapping; security degrades to computational. Integrity (a malicious server returning stale data) is handled orthogonally by authenticated trees [7].

---

## 4. Deep Dive

### 4.1 Security Definition and Lower Bounds

The foundational question is whether the *O*(log *n*) overhead of the best constructions is inherent. Goldreich and Ostrovsky answered it in a restricted model:

> **Theorem: (Goldreich–Ostrovsky lower bound [1]).** Any ORAM that treats blocks as opaque "balls" shuffled between "bins" — never inspecting or re-encoding their contents — with statistical security and *O*(1) client storage, incurs amortized Ω(log *n*) bandwidth overhead. The bound applies even to offline and read-only ORAM.

For twenty years this stood as the best known bound, but Boyle and Naor (ITCS 2016) exposed two caveats: it requires the balls-and-bins restriction and statistical security, and they showed that a *general* offline lower bound would imply superlinear lower bounds for sorting circuits — far beyond current complexity theory [5]. The implication is sharp: no general Ω(log *n*) bound can exist for offline ORAM without a breakthrough in circuit complexity.

The resolution came by strengthening the model in the other direction — requiring the ORAM to be *online*:

> **Theorem: (Larsen–Nielsen [4]).** Any online ORAM, even with computational security and arbitrary (non-balls-and-bins) encoding of data, has amortized Ω(log *n*) bandwidth overhead, for any word size *r* ≥ 1.

The proof adapts the **information-transfer technique** of Pătraşcu and Demaine from the cell-probe model: a hard distribution of operation sequences forces information to flow across a cut in the probe graph, and obliviousness spreads that flow over Ω(log *n*) probes per operation. The bound matches the known upper bounds when the block size is Ω(log² *n*) bits, certifying that Path ORAM and Circuit ORAM are asymptotically optimal in their parameter regime [3][4].

Subsequent work tightened and extended this picture:

* **Hubáček et al. [9]** removed the assumption that the adversary knows which probes belong to which operation, showing obfuscating operation boundaries cannot beat the bound.
* **Komargodski and Lin [6]** proved a bound valid for *all* parameter regimes,
  Ω(log(*Nw*/*m*) / log(*b*/*w*)) probes per access, where *b* is the ORAM cell size and *m* the client storage — tight up to the log(*b*/*w*) factor, and extending to the non-colluding multi-server setting.
* **Weiss and Wichs [5]** showed the boundary is delicate: for online *read-only* ORAM, or when only reads must be cheap, an Ω(log *n*) bound is again unlikely — they construct online ORAM with *o*(log *n*) read overhead assuming small sorting circuits and good locally decodable codes.

The net theoretical verdict: for general online read/write ORAM, logarithmic overhead is both necessary and sufficient. The remaining battleground is constants, client storage, and circuit complexity.

### 4.2 Path ORAM Construction

Path ORAM [2] stores *N* = 2^L blocks in a binary tree of height *L*, each node (**bucket**) holding *Z* blocks (real, dummy, or empty). The client stores a **position map** assigning each logical block *a* a uniformly random leaf label *P*(*a*), plus a small **stash** of overflow blocks. The invariant is simple and powerful:

> **Definition: (Path invariant).** At all times, every block *a* is either in the stash or in some bucket on the root-to-leaf path *P*(*a*).

One access proceeds as follows:

1. Look up leaf *l* = *P*(*a*); sample a fresh uniform leaf *l′* and set *P*(*a*) ← *l′*. The fresh label is what guarantees future accesses touch an independent random path.
2. **Read phase:** download every bucket on path *l* — exactly (*L*+1)·*Z* blocks — into the stash.
3. Serve the request from the stash (read or overwrite block *a*).
4. **Write-back phase:** greedily evict — push each stash block as deep as possible along path *l* toward its assigned leaf, filling buckets from the leaves upward — then re-encrypt and upload the path.

Because the accessed path *l* was chosen uniformly at the *previous* access and has never been revealed since, the server observes a uniformly random path each time: the probe sequence is independent of the logical pattern, giving statistical security.

The concrete bandwidth is 2(*L*+1)*Z* blocks per access — Θ(log *N*) without recursion. The stochastic analysis of [2], simplified in [8], gives:

> **Lemma: (Stash bound [2][8]).** With bucket size *Z* ≥ 5 and height *L* ≥ ⌈log *N*⌉, the stash exceeds *R* blocks during *T* accesses with probability at most *T*·exp(−Ω(*R*)). In practice *Z* = 4 with *L* = ⌈log *N*⌉ − 1 suffices.

Thus the stash stays *O*(log *N*) except with negligible probability, and client storage is dominated by the position map.

**Recursion** shrinks the position map. Since each position-map entry is only log *N* bits, *X* ≈ *B*/log *N* entries pack into one block, and the map itself is stored in a smaller Path ORAM — recursively, until the top-level map fits in client memory. Freecursive ORAM [7] showed the recursion's cost can be made nearly free by piggybacking integrity verification on the same paths.

### 4.3 Circuit ORAM and Metadata Scans

Path ORAM's randomized, data-dependent eviction is simple for a CPU but expensive inside a Boolean circuit — the MPC setting where every conditional becomes a multiplexer. **Circuit ORAM** [3] restructures the construction so the controller is *circuit-friendly* while matching Path ORAM's asymptotics:

> **Theorem: (Circuit ORAM [3]).** Circuit ORAM achieves *O*(log *N*) bandwidth overhead with *O*(1) client storage — matching Path ORAM's bandwidth while eliminating its ω(log *N*) stash-side state.

The key innovation is the **eviction algorithm as two deterministic metadata scans**:

1. **Preparation scan.** Traverse the fetched path from leaves to root, maintaining for each level the deepest block in the stash/metadata that can legally be placed at or below that level. This computes a compact plan — which block moves where — using only comparisons on leaf labels, with no data-dependent branching.
2. **Eviction scan.** Traverse root to leaves, applying the plan: each bucket is rewritten by obliviously selecting among the planned incoming block, the bucket's current content, and a dummy, via multiplexers.

Because both scans touch every metadata entry exactly once in a fixed order, the circuit implementing them has size linear in the path length times the block metadata — dramatically smaller than a circuit simulating Path ORAM's stash, whose worst-case size forces large multiplexing. This is what "tightness of the Goldreich–Ostrovsky lower bound" means in the title: Circuit ORAM shows the Ω(log *n*) bound is tight even under the stringent *O*(1) client-storage and small-circuit constraints simultaneously.

Circuit ORAM became the default ORAM in **ObliVM**, the garbled-circuit secure-computation framework, and underpins SCORAM-style two-party protocols where the servers jointly evaluate the controller. ZeroTrace [7] ships both Path ORAM and Circuit ORAM backends inside SGX, choosing between them by block size and latency target.

### 4.4 Recursion and Practical Deployment

Recursion and deployment engineering turned ORAM from a theoretical compiler into infrastructure:

* **Integrity.** Outsourcing to a malicious server demands authenticated reads. Freecursive ORAM embeds a Merkle integrity tree whose verification is folded into ordinary path accesses — integrity at nearly zero marginal bandwidth [7].
* **Trusted execution.** ZeroTrace [7] ports the ORAM controller into an SGX enclave, where the only side-channel-free workspace is the CPU register file. Every conditional in the controller is rewritten as a linear scan with CMOV, so the enclave's own memory trace is oblivious — defending against page-fault and cache attacks that plague naive enclave code. Ring ORAM variants are preferred here for their smaller constants.
* **Secure processors.** Path ORAM's regular, path-at-a-time traffic maps naturally onto memory controllers; Ascend, PHANTOM, and GhostRider all instantiate tree ORAM in hardware, where the stash lives in on-chip SRAM.
* **Oblivious data structures.** Wang et al. piggybacked on Path ORAM's recursion to build oblivious maps, stacks, and queues with *O*(log² *N*) overhead, showing the tree paradigm composes [8].
* **Blockchains and analytics.** ORAM underlies privacy-preserving light clients and differentially private query systems, where the access pattern — which accounts or records are touched — is itself the secret.

---

## 5. Empirical Results and Formal Analysis

### 5.1 Asymptotic comparison

| Scheme | Bandwidth / access | Client storage | Server storage | Security | Circuit-friendly |
|---|---|---|---|---|---|
| Goldreich–Ostrovsky [1] | *O*(log³ *n*) amortized | *O*(1) | *O*(*n*) | statistical | no |
| Square-root (Zahur et al.) | *O*(√*n* log *n*) | *O*(√*n*) | *O*(*n*) | computational | yes |
| Path ORAM, no recursion [2] | 2(*L*+1)*Z* = Θ(log *n*) | *O*(*n* log *n*) bits map + stash | ≈ 2*Zn* | statistical | no |
| Path ORAM, recursive [2] | *O*(log² *n*) | *O*(1) | ≈ 2*Zn* | statistical | no |
| Ring ORAM | *O*(log *n*), better constants | *O*(1) recursive | ≈ *n* + *o*(*n*) | statistical | partial |
| **Circuit ORAM [3]** | *O*(log *n*) | ***O*(1)** | *O*(*n*) | computational | **yes** |

Server storage can be reduced from 2*ZN* to *N* + *o*(*N*) via the Onodera–Shibuya compaction technique [8].

### 5.2 Concrete parameter exploration

The following script computes exact Path ORAM bandwidth and recursion depth for representative database sizes, using *Z* = 4 (the practical choice validated in [8]) and position-map packing *X* = 512 entries per block:

```python
import math

def path_oram_params(N, Z=4, X=512):
    L = math.ceil(math.log2(N)) - 1          # tree height, practical setting
    per_level = 2 * (L + 1) * Z              # blocks per access, one level
    depth = math.ceil(math.log(N, X))        # recursion levels
    total = per_level * depth                # blocks per access, recursive
    return {"N": N, "L": L, "per_level": per_level,
            "recursion_depth": depth, "total_blocks": total}

for exp in (20, 24, 28, 32):
    p = path_oram_params(2 ** exp)
    print(f"N=2^{exp}: height={p['L']}, blocks/access/level={p['per_level']}, "
          f"recursion depth={p['recursion_depth']}, total={p['total_blocks']} blocks")
```

Output:

```
N=2^20: height=19, blocks/access/level=160, recursion depth=3, total=480 blocks
N=2^24: height=23, blocks/access/level=192, recursion depth=3, total=576 blocks
N=2^28: height=27, blocks/access/level=224, recursion depth=4, total=896 blocks
N=2^32: height=31, blocks/access/level=256, recursion depth=4, total=1024 blocks
```

With 4 KiB blocks, a recursive access on a 2²⁸-block store moves under 4 MiB — the regime where ORAM is genuinely deployable, and where the constants (not asymptotics) decide feasibility.

### 5.3 Reported experimental results

* **Stash behavior.** The experiments in [2][8] confirm the exponential tail: with *Z* = 4, observed stash occupancy stays below a few dozen blocks across millions of accesses, matching the *T*·exp(−Ω(*R*)) analysis.
* **ZeroTrace [7].** Porting Path ORAM and Circuit ORAM into SGX incurs the expected CMOV-linear-scan overhead on the controller, but the dominant cost remains path bandwidth; the system demonstrates end-to-end oblivious key–value and map workloads inside an enclave for the first time.
* **Secure computation.** In ObliVM, Circuit ORAM's small controller circuit makes ORAM-backed RAM-model MPC faster than circuit-model baselines by an order of magnitude on memory-intensive programs [3][8], validating the metadata-scan design goal.

---

## 6. Limitations and Open Problems

1. **Constants remain large.** Even the best schemes move hundreds of blocks per logical access; for small (e.g., 64-byte) blocks the bandwidth blowup is punishing, and the Larsen–Nielsen bound is only tight for block sizes Ω(log² *n*) [4].
2. **The read-only frontier.** Weiss and Wichs [5] show that beating Ω(log *n*) for reads alone would require breakthroughs in sorting circuits or LDCs — but no unconditional barrier is known, and read-optimized constructions are largely unexplored.
3. **Recursion overhead.** Fully recursive Path ORAM pays *O*(log² *n*); Freecursive techniques amortize but do not eliminate this. Whether *O*(log *n*) bandwidth with *O*(1) client storage *and* statistical security is achievable in a tree framework remains open — Circuit ORAM achieves it only with computational security.
4. **Side channels in deployment.** SGX controllers must be branch-free down to the instruction level [7]; a single data-dependent branch reopens the channel ORAM was meant to close. Hardware ORAM shifts the trust anchor to the memory controller itself.
5. **Beyond honest-but-curious.** Malicious-server ORAM with sublinear verification, multi-server ORAM with a dishonest majority, and write-only ORAM with *o*(log *n*) overhead are active frontiers.
6. **Differential privacy relaxations.** The Persiano–Yeo bound shows even DP-RAM cannot escape Ω(log(*n*/*c*)) [9], narrowing the hope that weaker notions buy asymptotic speedups.

---

## 7. Conclusion

Oblivious RAM has converged on a rare and satisfying equilibrium: the Ω(log *n*) lower bound of Larsen and Nielsen [4], refined for all parameters by Komargodski and Lin [6], is matched by constructions — Path ORAM [2] for simplicity and statistical security, Circuit ORAM [3] for *O*(1) client storage and circuit-friendliness. The balls-and-bins bound of Goldreich and Ostrovsky [1] was the first word, not the last: Boyle and Naor showed its limits, and the modern theory precisely maps where logarithmic overhead is unavoidable (online read/write) and where it might not be (offline, read-only).

Deterministic metadata scans made ORAM evaluable inside garbled circuits; recursion made the position map disappear; branch-free controllers made ORAM viable inside SGX enclaves [7]. What remains is the unglamorous but decisive work of constants: shrinking the hundreds-of-blocks-per-access cost until oblivious computation is not merely possible but routine. The lower bounds tell us we cannot do asymptotically better; the constructions tell us we have not yet done as well as theory allows.

---

## References

[1] O. Goldreich and R. Ostrovsky. "Software Protection and Simulation on Oblivious RAMs." *Journal of the ACM*, 43(3):431–473, 1996. https://doi.org/10.1145/234533.234554

[2] E. Stefanov, M. van Dijk, E. Shi, C. Fletcher, L. Ren, X. Yu, and S. Devadas. "Path ORAM: An Extremely Simple Oblivious RAM Protocol." *Journal of the ACM*, 65(4), 2018. Conference version at ACM CCS 2013. https://doi.org/10.1145/3177872

[3] X. Wang, H. Chan, and E. Shi. "Circuit ORAM: On Tightness of the Goldreich-Ostrovsky Lower Bound." *Proc. ACM CCS 2015*. https://eprint.iacr.org/2014/672.pdf

[4] K. G. Larsen and J. B. Nielsen. "Yes, There is an Oblivious RAM Lower Bound!" *Proc. CRYPTO 2018*, LNCS 10992, pp. 523–542. https://link.springer.com/content/pdf/10.1007/978-3-319-96881-0_18.pdf?pdf=inline%20link

[5] M. Weiss and D. Wichs. "Is There an Oblivious RAM Lower Bound for Online Reads?" *Proc. TCC 2018*. https://iacr.org/archive/tcc2018/11239137/11239137.pdf

[6] I. Komargodski and W.-K. Lin. "A Logarithmic Lower Bound for Oblivious RAM (for all parameters)." Cryptology ePrint Archive, Report 2020/1132. https://eprint.iacr.org/2020/1132

[7] S. Sasy, S. Gorbunov, and C. Fletcher. "ZeroTrace: Oblivious Memory Primitives from Intel SGX." *Proc. NDSS 2018*. https://github.com/lingering/zerotrace

[8] E. Stefanov and E. Shi. "A Retrospective on Path ORAM." *IEEE Transactions on Computer-Aided Design of Integrated Circuits and Systems*, 39(8), 2020. https://elaineshi.com/docs/pathoram-retro.pdf

[9] P. Hubáček, M. Koucký, K. Král, and V. Slívová. "Stronger Lower Bounds for Online ORAM." https://arxiv.org/pdf/1903.03385


[1] Software Protection and Simulation on Oblivious RAMs — J. ACM 43(3), 1996. https://doi.org/10.1145/234533.234554
[2] Path ORAM: An Extremely Simple Oblivious RAM Protocol — J. ACM 65(4), 2018 (CCS 2013). https://doi.org/10.1145/3177872
[3] Circuit ORAM: On Tightness of the Goldreich-Ostrovsky Lower Bound — ACM CCS 2015. https://eprint.iacr.org/2014/672.pdf
[4] Yes, There is an Oblivious RAM Lower Bound! — CRYPTO 2018, LNCS 10992. https://link.springer.com/content/pdf/10.1007/978-3-319-96881-0_18.pdf?pdf=inline%20link
[5] Is There an Oblivious RAM Lower Bound for Online Reads? — TCC 2018. https://iacr.org/archive/tcc2018/11239137/11239137.pdf
[6] A Logarithmic Lower Bound for Oblivious RAM (for all parameters) — ePrint 2020/1132. https://eprint.iacr.org/2020/1132
[7] ZeroTrace: Oblivious Memory Primitives from Intel SGX — NDSS 2018. https://github.com/lingering/zerotrace
[8] A Retrospective on Path ORAM — IEEE TCAD 39(8), 2020. https://elaineshi.com/docs/pathoram-retro.pdf
[9] Stronger Lower Bounds for Online ORAM — arXiv. https://arxiv.org/pdf/1903.03385
