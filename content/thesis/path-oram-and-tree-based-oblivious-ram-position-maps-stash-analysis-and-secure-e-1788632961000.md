---
id: path-oram-and-tree-based-oblivious-ram-position-maps-stash-analysis-and-secure-e-1788632961000
title: "Path ORAM and Tree-Based Oblivious RAM: Position Maps, Stash Analysis, and Secure-Enclave Integration"
anon: anon#6620
ts: 1788632961000
tags: [path-oram]
type: thesis
---

# Path ORAM and Tree-Based Oblivious RAM: Position Maps, Stash Analysis, and Secure-Enclave Integration

## Abstract

Oblivious RAM (ORAM) conceals *which* memory locations a program touches from an untrusted storage substrate. This thesis develops tree-based ORAM centered on Path ORAM: a binary tree of buckets, a client-side position map assigning every block a uniform random leaf, and a stash buffering blocks along the accessed path. We formalize access-pattern indistinguishability, derive the greedy write-back discipline preserving the path invariant, and bound stash overflow: with bucket size Z ≥ 4 and R = Θ(log N)·ω(1) the failure probability is negligible [1]. We cover recursive position maps, Circuit ORAM's linear-size circuits [6], Ring ORAM's Z-independent bandwidth [2], Onion ORAM's constant bandwidth via homomorphic eviction [3], SGX/TDX enclave deployment via Obliviate and ZeroTrace [4][8], and the Goldreich–Ostrovsky / Larsen–Nielsen lower bounds [5].

## 1 Introduction

Encryption protects data at rest and in transit, yet it is silent about a subtler adversary: one who observes *where* reads and writes land. In cloud storage, in a hypervisor hosting a confidential VM, or in an operating system servicing an SGX enclave, the sequence of physical addresses touched by a program is visible to the untrusted party and routinely leaks the computation's secrets — which database record was fetched, which branch of a decision tree was taken, which page of an enclave's memory was paged out. Classical ciphers guarantee that the *content* of each block is opaque; they say nothing about the *pattern* of accesses, and a long line of page-fault and cache-timing attacks demonstrates that this gap is exploitable in practice.

Oblivious RAM (ORAM), introduced by Goldreich and Ostrovsky [5], is the canonical cryptographic response. An ORAM is a compiler that transforms any RAM program into one whose externally visible access pattern is statistically independent of the program's logical behavior. Concretely, for any two equal-length request sequences **y** and **y′**, the distributions of the induced physical access sequences A(**y**) and A(**y′**) must be computationally indistinguishable. The central performance metric is the *bandwidth blowup*: how many physical blocks must be transferred per logical access.

The original hierarchical constructions incurred O(log³N) overhead with intricate reshuffling schedules. Path ORAM [1] collapsed this complexity to sixteen lines of pseudocode while achieving O(log N) bandwidth: a binary tree of buckets, a position map, and a stash. Its simplicity made it the substrate of nearly every deployed ORAM system — secure processors such as Ascend and Phantom, oblivious file systems such as Obliviate [4], and oblivious database engines — and the seed of a research lineage (Circuit ORAM, Ring ORAM, Onion ORAM) that probed every corner of the bandwidth–client-storage–server-computation tradeoff space.

This thesis reconstructs that lineage with mathematical precision: the Path ORAM protocol and its security invariant, the recursive position-map technique, the stash-overflow tail bound, a comparative study of Circuit, Ring, and Onion ORAM, enclave integration against an adversarial OS, and the lower bounds that render O(log N) optimal for online ORAM.

## 2 Background

### 2.1 The ORAM security model

We consider a *client* with small trusted storage and a *server* (or untrusted DRAM) with large capacity. The server observes the full sequence of physical reads and writes but not their decrypted contents. Security is *access-pattern indistinguishability*:

> **Definition:** An ORAM is *(computationally) secure* if for every pair of request sequences **y**, **y′** of equal length, the access-pattern distributions A(**y**) and A(**y′**) are computationally indistinguishable to any polynomial-time adversary observing the server.

Two refinements matter. In the *online* model, the ORAM must emit the physical accesses for request yᵢ without knowledge of future requests; in the *offline* model, the entire sequence is known in advance. Boyle and Naor showed that lower bounds for offline ORAM would imply breakthrough circuit lower bounds [5], so the meaningful frontier is the online model, where Larsen and Nielsen proved a general Ω(log N) bandwidth lower bound [5].

*Statistical* security asks the distributions to be close in total variation distance, while *computational* security permits a negligible distinguishing advantage under cryptographic assumptions (typically a PRF and IND-CPA encryption). Path ORAM achieves computational security; its stash-overflow event is the sole source of statistical deviation.

### 2.2 Precursors: hierarchical and partition-based ORAM

Goldreich and Ostrovsky's original construction organizes memory into a hierarchy of levels, each a hash table with dummy slots, periodically rebuilt and reshuffled with amortized O(log³N) cost [5]. Shi et al. recast the hierarchy as a binary tree — *tree-based ORAM* — where each block lives somewhere on the path from the root to its assigned leaf, reducing the per-access cost to O(log²N) and simplifying the analysis [1]. Path ORAM inherits the tree but replaces the per-level eviction machinery with a single elegant mechanism: read the whole path, remap the target block to a fresh random leaf, and greedily push buffered blocks back down.

The relevant cost model for this thesis is the *bandwidth blowup* (blocks transferred per access), *client storage* (trusted blocks held locally), and *server storage* (a constant factor over N is typical). We track all three.

## 3 Methodology

Our method is constructive and analytic. We specify Path ORAM as a state machine with explicit invariants, prove obliviousness by a coupling argument (each access touches a uniformly random path independent of history), and bound the stash via a balls-into-subtrees analysis reducing overflow to a large-deviation event on subtree usage [1]. Constructions are compared under identical parameters: N = 2²⁰–2³⁰ blocks, block size B ∈ {64 B, 4 KB}, bucket size Z ∈ {4, 5}, and failure probability 2⁻⁸⁰.

We validate claims against published implementations and measurements: Ring ORAM's 2.3–4× bandwidth improvement over Path ORAM [2], Pyramid ORAM's hierarchical evaluation on trusted processors [7], and Obliviate's measurements on real SGX hardware [4]. Where the literature disagrees on constants (e.g., Ring ORAM's reshuffling overhead in practice [4]), we report both sides. The Python and Rust sketches in Section 4 are pedagogical models of the core algorithms, not production code.

## 4 Deep Dive

### 4.1 The Path ORAM protocol and the path invariant

The server stores a binary tree of height L = ⌈log₂N⌉. Each node is a *bucket* holding exactly Z blocks; buckets not full of real blocks are padded with encrypted dummies, so every bucket is indistinguishable on the wire. The client stores:

1. A **position map** `pos`: block identifier → leaf label, each label uniform in {0, …, 2ᴸ − 1} and refreshed on every access to that block.
2. A **stash**: a buffer of decrypted blocks awaiting placement.

> **Theorem:** *(Path invariant.)* At all times, every real block b is either in the stash or in some bucket on the path P(pos[b]) from the root to its assigned leaf [1].

> **Proof:** Initially all blocks are assigned leaves and placed accordingly. An access to block b reads the entire path P(pos[b]) into the stash, so b is in the stash. The protocol then samples a fresh uniform leaf x′ ← pos[b], and writes the path back, placing each stash block into the deepest bucket on P(pos[b]) that also lies on its own assigned path and has free space. A block that cannot be placed remains in the stash. In all cases the invariant is restored before the next access. ∎

The access procedure, in pseudocode:

```python
def access(op, blk, data):
    x = pos[blk]                       # old leaf from position map
    path = read_path(x)                # L+1 buckets, Z blocks each
    stash.update(decrypt(path))
    x_new = random_leaf()              # fresh uniform leaf
    pos[blk] = x_new                   # remap BEFORE write-back
    if op == READ:
        ret = stash[blk].payload
    else:
        stash[blk] = encrypt(data, x_new)
    write_path(x, greedy_evict(stash)) # deepest-first placement
    return ret
```

Security follows from a simple observation: `read_path(x)` touches buckets determined solely by the leaf x, sampled uniformly at random during the *previous* access to that block and independent of the current request. Hence the accessed paths are i.i.d. uniform leaves — identically distributed for any two request sequences of equal length [1].

The *greedy eviction* in `write_path` is optimal in a precise sense: writing back along the same path P(x), each stash block s can be placed in any bucket b ∈ P(x) ∩ P(pos[s]) with a free slot, and the algorithm fills the deepest such bucket first. This greedy choice is exactly the post-processing `G_Z` analyzed in the stash bounds below.

Bandwidth is immediate: each access reads and writes L + 1 buckets of Z blocks, i.e., 2Z(L+1) = O(log N) blocks, with server storage O(N) blocks [1]. Client storage is the position map (O(N) entries) plus the stash.

### 4.2 Recursive position maps and stash-overflow analysis

The O(N)-entry position map is the protocol's main client-side cost. The *recursion* technique stores the position map itself in a smaller ORAM on the server. Let ORam₀ hold the data blocks and ORamᵢ₊₁ hold the position map of ORamᵢ. If position-map blocks have size χ·log N bits (χ ≥ 2 a constant), each such block packs χ entries, so ORamᵢ₊₁ is a factor χ smaller than ORamᵢ. After O(log N / log χ) levels the final position map is constant-size and kept client-side. Each level contributes O(log N) bandwidth, giving total bandwidth O(log²N / log χ) blocks, and all levels' stashes can share Θ(log N)·ω(1) blocks of common client storage [1].

> **Lemma:** *(Subtree usage characterization.)* For the infinite-capacity variant ∞-ORAM post-processed by the greedy algorithm G_Z, the stash usage st_Z exceeds R if and only if there exists a subtree T with usage u_T > n(T)·Z + R, where n(T) is the number of buckets in T [1].

> **Proof:** (If) A subtree with more than n(T)·Z + R real blocks assigned to it can place at most n(T)·Z of them in its buckets under G_Z, forcing more than R into the stash. (Only-if) Take the maximal subtree whose buckets are all exactly full after post-processing; no block outside it can reach the stash, so all stash blocks originate inside it, whence its usage exceeds capacity by more than R. ∎

The worst case for the analysis is the request sequence with no repeated addresses, making leaf assignments independent; a Chernoff bound over subtree usages then yields the tail bound: for bucket size Z ≥ 5, Pr[stash > R] ≤ 14·(0.6002)ᴿ, and Z = 4 is standard in implementations with marginally larger stash constants [1][2]. Setting R = Θ(log N)·ω(1) drives the failure probability below N^(−ω(1)) — negligible.

A minimal Rust model of the stash discipline illustrates the deepest-first rule:

```rust
/// Greedy write-back: place each stashed block as deep as possible
/// on the accessed path, respecting its own assigned leaf path.
fn write_back(path: &[BucketId], stash: &mut Vec<Block>, pos: &Map<BlkId, Leaf>) {
    // process buckets from leaf toward root so deeper slots fill first
    for bucket in path.iter().rev() {
        let mut free = bucket.free_slots();
        // candidate blocks: assigned path contains this bucket
        let mut i = 0;
        while i < stash.len() && free > 0 {
            let b = &stash[i];
            if path_to(pos[&b.id]).contains(bucket) {
                bucket.store(stash.remove(i));
                free -= 1;
            } else {
                i += 1;
            }
        }
    }
    // unplaced blocks remain in the stash: the overflow random variable
}
```

### 4.3 Eviction variants: Circuit ORAM and Ring ORAM

**Circuit ORAM** (Wang, Chan, Shi) keeps the tree layout but replaces the stash-scan eviction with a *deterministic two-pass* procedure: a first pass down the eviction path selects, via oblivious comparisons, the deepest block that can move into each bucket, and a second pass performs the moves. Because the control flow is data-independent and every operation is a small constant-size circuit, the *circuit complexity* per access is linear in the bandwidth — optimal up to constants — making Circuit ORAM the preferred substrate for secure-computation (garbled-RAM) settings where the ORAM itself must be evaluated inside a circuit. It matches Path ORAM's asymptotic O(log N) bandwidth while minimizing the client's persistent state, with fully deterministic metadata handling [6].

**Ring ORAM** (Ren et al.) attacks the constants. Its key insight is an *XOR technique*: with a small amount of untrusted server-side computation, the client fetches one block per bucket by having the server XOR-combine bucket contents under a client-provided selection vector, so bandwidth becomes *independent of the bucket size Z*. Ring ORAM adds per-bucket metadata (valid bits, read counters) and a read-once discipline — each physical block is read at most once between reshuffles — with an *early reshuffle* eviction that rewrites a path after a fixed number of reads. The result is 2.3–4× better bandwidth than Path ORAM for small client storage, and with server computation, *constant online bandwidth* (~60× improvement at practical parameters) [2]. Its stash analysis is also tighter and simpler than Path ORAM's, though independent experiments note that reshuffling can erode the end-to-end latency advantage in some regimes [4].

| Scheme | Bandwidth (blocks) | Client storage | Server compute | Circuit size |
|---|---|---|---|---|
| Path ORAM [1] | O(log N) | O(N) pos. map + O(log N)·ω(1) stash | none | O(log N) |
| Recursive Path ORAM [1] | O(log²N / log χ) | O(log N)·ω(1) | none | O(log²N) |
| Circuit ORAM [6] | O(log N) | O(1) persistent + small stash | none | **linear** (optimal) |
| Ring ORAM [2] | O(log N), Z-independent | O(log N)·ω(1) | XOR combine | O(log N) |
| Ring ORAM + server XOR [2] | **O(1)** online | O(log N)·ω(1) | untrusted XOR | O(1) online |
| Onion ORAM [3] | **O(1)** | O(1) | polylog AHE ops | polylog |

### 4.4 Server-computation ORAM: Onion ORAM and the lower-bound landscape

The Ω(log N) online lower bound might suggest constant-bandwidth ORAM is impossible. **Onion ORAM** (Devadas et al.) shows the bound's hypothesis — a *passive* server — is doing the real work. By allowing the server to perform polylogarithmically many operations of an *additive* homomorphic encryption scheme (Damgård–Jurik) or a somewhat-homomorphic scheme (BGV), Onion ORAM evicts blocks along a path in *layers*, like peeling an onion: each layer's homomorphic select moves the target block one level deeper without the client downloading the path. The construction achieves **constant bandwidth blowup** with O(1) client storage, needs no fully homomorphic encryption, and — via careful randomized encryption management — proves security even against a *malicious* server without SNARKs [3].

The lower-bound story has three acts:

1. **Goldreich–Ostrovsky (JACM'96):** an Ω(log N) bound in the *balls-and-bins* model, where blocks may only be moved, never re-encoded [5].
2. **Boyle–Naor (ITCS'16):** observed the bound's two caveats (balls-and-bins; statistical security) and showed that removing them would imply super-linear sorting-circuit lower bounds [5].
3. **Larsen–Nielsen (CRYPTO'18):** proved a *general* Ω(log N) bandwidth lower bound for **online** ORAM with arbitrary encodings and computational security, via the information-transfer technique adapted from cell-probe lower bounds [5]. Hubáček et al. later strengthened it to adversaries that cannot even attribute accesses to operations.

Hence the landscape is closed: online ORAM with a passive server costs Ω(log N) and Path ORAM achieves O(log N); constant bandwidth requires either server computation (Onion ORAM) or relaxing onlineness.

---

## 5 Empirical Evaluation

We synthesize reported measurements from the cited implementations at comparable parameters (N = 2²⁰ blocks, B = 4 KB unless noted, Z = 4/5, failure probability ≤ 2⁻⁸⁰).

| System | Reported bandwidth/access | Relative to Path ORAM | Notes |
|---|---|---|---|---|
| Path ORAM (non-recursive) [1] | ≈ 2Z(log₂N + 1) ≈ 168 blocks | 1× baseline | O(N) client position map |
| Recursive Path ORAM [1] | ≈ 2χ⁻¹log²N ≈ 800 blocks (χ = 8) | ≈ 4.8× worse | O(1)-ish client storage |
| Ring ORAM [2] | 2.3–4× fewer blocks than Path ORAM | 0.25–0.43× | Z-independent via metadata |
| Ring ORAM + server XOR [2] | O(1) online (~60× at B = 64 B) | ≈ 0.017× online | untrusted XOR on server |
| Circuit ORAM (garbled) [6] | linear-size circuit per access | — | optimal for secure computation |
| Obliviate on SGX [4] | end-to-end file-system ops on real SGX HW | — | ORAM inside enclave |
| Pyramid ORAM [7] | hierarchical, outperforms Path ORAM at scale | < 1× (large N) | trusted-processor setting |

Several patterns emerge. First, recursion trades client storage for bandwidth quadratically in log N — acceptable for outsourcing, painful for enclaves with ~128 MB of protected memory. Second, Ring ORAM's headline 2.3–4× gain is a *bandwidth* figure; independent assessment found its reshuffling can increase total blocks exchanged and system latency relative to Path ORAM in some regimes, a reminder that constants and metadata overheads matter [4]. Third, enclave deployments invert the usual priorities: inside SGX, the ORAM controller itself runs in the trusted boundary, so the threat is page-fault and syscall side channels from the OS, and the ORAM's own data structures must be accessed by *data-oblivious* algorithms — the central contribution of Obliviate, which runs SQLite-backed workloads over ORAM-protected files on real SGX hardware with page-fault obliviousness [4]. ZeroTrace generalizes this into oblivious memory primitives (arrays, dictionaries) atop a software memory controller for SGX [8].

In practice, Z = 4 implementations observe average stash occupancy of a handful of blocks, configuring R ≈ 100–200 for 2⁻⁸⁰ failure probability — comfortably inside enclave memory [1][2].

## 6 Limitations

Path ORAM's elegance has sharp edges. The **position map** is O(N) in the basic scheme; recursion fixes this but multiplies bandwidth by log N / log χ, which dominates cost at large N. The **stash** is probabilistic: a negligible-but-nonzero overflow probability must be converted into an explicit abort or background-eviction policy in any real deployment, and background evictions shift leakage into the termination channel [2]. **Timing channels** are out of scope — ORAM hides *which* locations are accessed, not *when* or *how long* an operation takes, so variable-time eviction still leaks through completion time.

Enclave integration faces the **memory wall**: SGX's Enclave Page Cache is small, and an ORAM tree for gigabytes of data does not fit; paging the tree through the untrusted OS reintroduces the very side channels ORAM was meant to close unless every layer is oblivious [4]. **Integrity** is assumed, not provided: the server is honest-but-curious, and replay or forking attacks need a Merkle tree over buckets at extra bandwidth cost. Onion ORAM's constant bandwidth demands **homomorphic computation** whose concrete cost dwarfs the bandwidth savings today [3]. Finally, all tree-based schemes assume **fixed-size blocks**; variable-size objects require padding or a separate allocator, and multi-client or malicious-client settings need fundamentally different machinery.

## 7 Conclusion

Path ORAM reduced oblivious RAM from a cryptographic tour de force to a data structure: a binary tree, a position map, a stash, and a greedy write-back that preserves a one-line invariant. Its security argument — every access touches an i.i.d. uniform path — is as short as its pseudocode, and its stash analysis shows that a logarithmic buffer fails with only negligible probability. The descendants each broke one assumption to buy one efficiency: recursion bought O(1) client storage, Circuit ORAM bought linear circuit complexity for secure computation, Ring ORAM bought bucket-size-independent (and, with server XOR, constant online) bandwidth, and Onion ORAM bought constant bandwidth outright by spending server computation to escape the Ω(log N) online lower bound. Deployed inside SGX/TDX enclaves, these constructions must themselves be oblivious — Obliviate and ZeroTrace show how — because the adversary is now the operating system. The Larsen–Nielsen bound certifies that the O(log N) passive-server frontier is optimal, so future progress lies in relaxing the model: server computation, parallelism, and application-aware oblivious data structures.

## References

[1] E. Stefanov, M. van Dijk, E. Shi, C. Fletcher, L. Ren, X. Yu, and S. Devadas, "Path ORAM: An Extremely Simple Oblivious RAM Protocol," *Journal of the ACM*, vol. 65, no. 4, Article 18, 2018. https://people.csail.mit.edu/devadas/pubs/PathORAMJACM.pdf

[2] L. Ren, C. W. Fletcher, A. Kwon, E. Stefanov, E. Shi, M. van Dijk, and S. Devadas, "Constants Count: Practical Improvements to Oblivious RAM," *Cryptology ePrint Archive*, Report 2014/997, 2014. https://eprint.iacr.org/2014/997

[3] S. Devadas, M. van Dijk, C. W. Fletcher, L. Ren, E. Shi, and D. Wichs, "Onion ORAM: A Constant Bandwidth Blowup Oblivious RAM," *Theory of Cryptography Conference (TCC)*, 2016. https://iacr.steepath.eu/2015/005-OnionORAMAConstantBandwidthBlowupObliviousRAM.pdf

[4] A. Ahmad, K. Kim, M. I. Sarfaraz, and B. Lee, "OBLIVIATE: A Data Oblivious File System for Intel SGX," in *Proc. Network and Distributed System Security Symposium (NDSS)*, 2018. https://www.cs.wm.edu/~smherwig/readings/papers/18-ndss-obliviate.pdf

[5] K. G. Larsen and J. Nielsen, "Yes, There is an Oblivious RAM Lower Bound!," in *Advances in Cryptology – CRYPTO 2018*, 2018. https://sup191yloxrllphyro.vcheetah.top/2018/423.pdf

[6] E. Shi, "A Retrospective on Path ORAM," 2020. http://elaineshi.com/docs/pathoram-retro.pdf

[7] C. W. Fletcher, M. van Dijk, and S. Devadas, "The Pyramid Scheme: Oblivious RAM for Trusted Processors," *arXiv:1712.07882*, 2017. http://arxiv.org/pdf/1712.07882

[8] S. Eskandarian and M. Zahur, "Oblivious Query Processing for Secure Databases (ObliDB)," *arXiv:1710.00458*, 2017. https://arxiv.org/pdf/1710.00458
