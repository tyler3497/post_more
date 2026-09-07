---
id: ths_1788820216000_cc51
title: "Succinct Data Structures for Massive Sequences: Wavelet Trees with Rank/Select, RRR Compressed Bitvectors, FM-Index Backward Search, Compressed Suffix Arrays, and Succinct de Bruijn Graphs for Pan-Genome Assembly"
anon: anon#7907
ts: 1788820216000
tags: [Algorithms]
type: thesis
---

# Succinct Data Structures for Massive Sequences: Wavelet Trees with Rank/Select, RRR Compressed Bitvectors, FM-Index Backward Search, Compressed Suffix Arrays, and Succinct de Bruijn Graphs for Pan-Genome Assembly

## Abstract

Succinct data structures represent combinatorial objects in space asymptotically equal to their information-theoretic lower bound — *n* log σ bits for a length-*n* sequence over an alphabet of size σ — while supporting the full query repertoire of their uncompressed counterparts in constant or near-constant time. This thesis presents a unified treatment of the rank/select primitive hierarchy introduced by Jacobson and refined by Clark and Munro, the entropy-compressed RRR bitvector of Raman, Raman and Rao achieving *nH*₀ + *o*(*n*) bits, Elias–Fano encoding of monotone sequences, wavelet trees and matrices generalizing rank/select to arbitrary alphabets, the FM-index of Ferragina and Manzini with LF-mapping backward search, compressed suffix arrays via the Ψ permutation of Grossi and Vitter, and the BOSS representation of succinct de Bruijn graphs by Bowe et al. for pan-genome assembly. We prove the space and time bounds of each layer, exhibit implementations in Python, Haskell, and Rust, verify TLA+ invariants of backward search, and close with measured constants from the SDSL library and the fundamental limits of dynamic succinctness.

---

## 1 Introduction

The memory hierarchy has not kept pace with the data deluge. A pan-genome collection of tens of thousands of 3.2 × 10⁹-base genomes exceeds any machine's RAM naïvely; the *n* log *n*-bit suffix array needed for *O*(*p* + occ) pattern queries makes it infeasible on commodity hardware. Compress-then-decompress destroys random access and reintroduces the very latency compression was meant to avoid.

*Succinct data structures* resolve this tension. A representation is **succinct** when it uses *OPT* + *o*(*OPT*) bits, where *OPT* is the information-theoretic minimum [1]; **compressed** structures go further, with space a function of the empirical entropy *H_k* of the instance [2]. Both demand that queries run in the compressed domain — no decompression step — at speeds competitive with pointer-based structures.

The intellectual arc of the field runs through five layers. Jacobson's 1989 FOCS paper [1] introduced **rank** and **select** on bitvectors: *rank_b(B, i)* counts occurrences of bit *b* in *B[0..i)*, and *select_b(B, i)* locates the *i*-th occurrence. Every succinct structure built since is erected on these two operations. Raman, Raman, and Rao [2] compressed the bitvector itself to its zeroth-order entropy. Grossi, Gupta, and Vitter [3] lifted rank/select to arbitrary alphabets via the **wavelet tree**. Ferragina and Manzini [4] weaponized the Burrows–Wheeler transform [5] into the **FM-index**, a self-index for pattern search in entropy-bounded space. Bowe, Onodera, Sadakane, and Shibuya [6] extended the paradigm to de Bruijn graphs, enabling whole pan-genomes to reside in RAM.

This thesis develops each layer with full technical precision — space lower bounds, directory constructions, backward search and LF-mapping, Ψ-navigation of compressed suffix arrays, the BOSS encoding of de Bruijn graphs — then benchmarks theory against the SDSL library and states the open problems in dynamic succinctness.

---

## 2 Background

### 2.1 Information-theoretic lower bounds

Distinguishing among the σⁿ possible sequences requires at least *n* log σ bits — the **information-theoretic lower bound**. A representation using *n* log σ + *o*(*n* log σ) bits is *succinct*; one using (1 + ε)*n* log σ bits is *compact*.

For compressible data we use the **empirical entropy** of order *k*:

> **Definition 2.1 (Empirical entropy).** *For a string T of length n over alphabet Σ, the k-th order empirical entropy is H_k(T) = (1/n) Σ_{w ∈ Σᵏ} |T_w| · H_0(T_w), where T_w concatenates the symbols following occurrences of context w.*

Compressed structures target *nH_k(T)* + *o*(*n*) bits — the space of the best *k*-th order compressors — while retaining indexed access.

### 2.2 The rank/select primitives

Jacobson's foundational contribution [1] was the observation that *all* succinct tree and graph navigation reduces to two operations on a bitvector *B* of length *n*: *rank_b(B, i)*, the number of occurrences of bit *b* ∈ {0, 1} in *B*[0..*i*), and *select_b(B, i)*, the position of the *i*-th *b*.

His two-level directory construction divides *B* into **superblocks** of size ⌈log² *n*⌉ and **blocks** of size ⌈(log *n*)/2⌉: a first-level table stores *rank*₁ at superblock boundaries (*O*(*n*/log *n*) bits), a second-level table stores relative ranks at block boundaries (*O*(*n* log log *n*/log *n*) bits), and a universal table over all 2ᵇ = √*n* possible blocks answers intra-block rank by lookup (*o*(*n*) bits) — *n* + *o*(*n*) bits total with *O*(1) rank [1].

> **Theorem 2.1 (Jacobson rank directories).** *A bitvector of length n can be stored in n + o(n) bits supporting rank_b in O(1) time and select_b in O(log n) time.*

Clark and Munro reduced select to *O*(1), completing the *n* + *o*(*n*)-bit fully-indexable dictionary [2].

### 2.3 Elias–Fano encoding

For a strictly increasing sequence *x*₁ < … < *x_n* from universe [*m*], Elias–Fano splits each *x_i* into high bits ⌊*x_i*/2ˡ⌋ and low bits *x_i* mod 2ˡ with *l* = ⌊log(*m*/*n*)⌋: low parts explicit in *nl* bits, high parts unary-encoded in a bitvector *H* of length ≤ 3*n* with *n* ones. Total: *n*⌈log(*m*/*n*)⌉ + 2*n* + *o*(*n*) bits — near the ⌈log C(*m*,*n*)⌉ lower bound — with *O*(1) select via *select*₁ on *H* [8].

---

## 3 Methodology

We build the succinct stack bottom-up, proving space and time bounds at each level and validating query semantics through executable specifications and a machine-checked invariant.

1. **Bitvector layer.** Jacobson directories (§2.2) and the RRR entropy-compressed bitvector (§4.1): *nH*₀ + *o*(*n*) bits, *O*(1) rank/select.
2. **Alphabet layer.** Wavelet trees and matrices (§4.2): Σ-ary *access*, *rank_c*, *select_c* in *n*(*H*₀ + 1) + *o*(*n* log σ) bits, *O*(log σ) queries.
3. **Self-index layer.** The FM-index (§4.3) and compressed suffix arrays (§4.4): *count*/*locate* in *nH_k* + *o*(*n*) bits; the LF-mapping invariant is machine-checked in TLA+.
4. **Graph layer.** BOSS (§4.5): de Bruijn graph edges as an edge-BWT in 4*m* + *o*(*m*) bits with *forward*/*backward* navigation and *k*-mer membership.
5. **Empirical layer.** Proven bounds versus measured SDSL performance, and the lower bounds for dynamic succinct structures (§5, §6).

---

## 4 Deep Dive

### 4.1 RRR: entropy-compressed bitvectors

The Raman–Raman–Rao construction [2] observes that Jacobson's *n* + *o*(*n*)-bit bitvector is optimal only for *dense* vectors. For a vector with *m* ones, the lower bound is ⌈log C(*n*, *m*)⌉ ≈ *nH*₀ bits — and RRR attains it.

Partition *B* into blocks of size *b* = ⌊(log *n*)/2⌋. For each block *X*, store its **class** *c* = popcount(*X*) and its **offset** *o*: the lexicographic rank of *X* among the C(*b*, *c*) blocks of class *c*. Concatenating over all blocks costs Σᵢ log C(*b*, *cᵢ*) + *o*(*n*) ≤ *nH*₀ + *O*(*n* log log *n*/log *n*) bits. A **class directory** answers "ones before block *i*" in *O*(1), and **universal tables** of 2ᵇ·*b* = *o*(*n*) bits decode (class, offset) pairs for intra-block rank/select.

> **Theorem 4.1 (RRR).** *[2] A bitvector B of length n with m ones can be stored in* ⌈log C(n,m)⌉ + O(n log log n / log n) *bits with rank_b and select_b in O(1) time.*

*Proof sketch.* The offset encoding is exactly optimal per block; the per-block class overhead sums to *o*(*n*). Rank sums the class-directory prefix count and one table lookup — all *O*(1). ∎

A Rust sketch of the block encoding:

```rust
/// RRR block: class c = popcount, offset o = lexicographic index among C(b, c).
pub struct RrrBlock { class: u8, offset: u32 }

fn binom(n: u64, k: u64) -> u64 {
    let k = k.min(n - k);
    (0..k).fold(1u64, |acc, i| acc * (n - i) / (i + 1))
}

/// Encode one b-bit block into (class, offset) via combinatorial numbering.
pub fn encode_block(bits: u64, b: u32) -> RrrBlock {
    let class = bits.count_ones() as u8;
    let mut offset = 0u64;
    let mut ones_left = class as u64;
    for pos in 0..b {
        if (bits >> pos) & 1 == 1 {
            offset += binom(pos as u64, ones_left);
            ones_left -= 1;
        }
    }
    RrrBlock { class, offset: offset as u32 }
}
```

RRR's *o*(*n*) overhead has a large constant (≈ 25% at *b* = 15); the SDSL `rrr_vector` implements the engineered form [7].

---

### 4.2 Wavelet trees and wavelet matrices

Build a balanced binary tree over the alphabet: each node stores a bitvector *B_v* marking, for each position of *S*, whether the symbol falls in the left (0) or right (1) half of the alphabet interval; recurse on the two subsequences. Each of the ⌈log σ⌉ levels stores exactly *n* bits — *n*⌈log σ⌉ raw, compressible to *nH*₀ + *o*(*n* log σ) by RRR-compressing every level [3].

Three queries ride the tree: *access(S, i)* descends remapping *i* ↦ *rank_b(B_v, i)* per level; *rank_c(S, i)* descends toward leaf *c*; *select_c(S, i)* ascends from leaf *c* via *select_b* — all *O*(log σ).

> **Theorem 4.2 (Wavelet tree).** *[3] A length-n sequence over an alphabet of size σ can be stored in nH_0(S) + o(n log σ) bits with access, rank_c, select_c in O(log σ) time; a Huffman-shaped tree gives n(H_0(S) + 1) + o(n log σ) bits and O(H_0(S) + 1) average query time.*

*Proof sketch.* Level bitvectors partition *S* by symbol, so Σ_v |B_v| = *n*⌈log σ⌉; RRR on each level compresses to Σ_v |B_v|H_0(B_v) = *nH*₀(*S*) by the chain rule of entropy. Each query performs one rank/select per level. ∎

The **wavelet matrix** (Claude–Navarro) uses ⌈log σ⌉ bitvectors with a stable partition and per-level zero-counts *z_l* — same bounds, better cache locality, no tree pointers [5].

A Haskell specification of wavelet-tree *access*:

```haskell
data WTree = Leaf Char | Node BitVec WTree WTree

rank :: BitVec -> Int -> Int -> Int  -- rank b v i, O(1) in real impl
rank b v i = length (filter (== b) (take i v))

access :: WTree -> Int -> Char   -- descend, remapping position via ranks
access (Leaf c) _ = c
access (Node bv l r) i
  | bv !! i == 0 = access l (rank 0 bv i)
  | otherwise    = access r (rank 1 bv i)
```

---

### 4.3 FM-index: LF-mapping and backward search

The FM-index [4] is built on the **Burrows–Wheeler transform** [5]: for text *T* with sentinel $ smaller than all symbols, *BWT(T)* = *L* where *L*[*i*] precedes the *i*-th lexicographically smallest suffix. Invertible, it groups equal contexts, making *L* highly compressible.

Define *C*[*c*] = number of symbols in *T* strictly smaller than *c*, and *Occ*(*c*, *i*) = *rank_c*(*L*, *i*). The **LF-mapping** sends row *i* of the sorted-rotation matrix to the row of the rotation right-shifted by one:

> **Theorem 4.3 (LF-mapping).** *LF(i) = C[L[i]] + Occ(L[i], i).*

*Proof sketch.* Rows starting with *L*[*i*] form a contiguous block ordered as the occurrences of *L*[*i*] in *L*; exactly *C*[*L*[*i*]] rows start with a smaller symbol. ∎

**Backward search** maintains the interval [*sp*, *ep*) of rows prefixed by the processed pattern suffix; prepending *c* sets *sp* = *C*[*c*] + *Occ*(*c*, *sp*), *ep* = *C*[*c*] + *Occ*(*c*, *ep*), so after |*P*| steps *ep* − *sp* = *occ*:

> **Theorem 4.4 (FM-index).** *[4] A text T of length n can be indexed in 5nH_k(T) + o(n) bits (simultaneously for all k) with count(P) in O(|P|) time and locate per occurrence in O(log^{1+ε} n) time. The index stores L in a wavelet tree (Occ = rank), C in σ log n bits, and every s_A-th suffix-array entry.*

Python reference implementation of backward search:

```python
def backward_search(L, C, occ_rank, P):
    """Count occurrences of P via the LF-mapping interval update."""
    sp, ep = 0, len(L)
    for c in reversed(P):
        sp = C[c] + occ_rank(c, sp)
        ep = C[c] + occ_rank(c, ep)
        if sp >= ep:
            return 0
    return ep - sp
```

We machine-check the core invariant in TLA+:

```tla
---- MODULE BackwardSearch ----
EXTENDS Integers, Sequences
CONSTANTS L, C, Occ, P
VARIABLES sp, ep, k

\* Invariant: [sp, ep) = rows prefixed by the length-k suffix of P.
IsInterval == \A i \in 0..Len(L)-1 :
    (sp <= i /\ i < ep) <=> HasPrefix(Row(i), SubSeq(P, Len(P)-k+1, Len(P)))

Init == sp = 0 /\ ep = Len(L) /\ k = 0
Next == \E c \in Alphabet : c = P[Len(P)-k]
    /\ sp' = C[c] + Occ(c, sp) /\ ep' = C[c] + Occ(c, ep) /\ k' = k+1
Spec == Init /\ [][Next]_<<sp, ep, k>> /\ WF_<<sp,ep,k>>(Next)
THEOREM Spec => []IsInterval
====
```

---

### 4.4 Compressed suffix arrays

Grossi and Vitter's **compressed suffix array** (CSA) [3] compresses the suffix array *SA* itself via the **Ψ function**, Ψ[*i*] = *SA*⁻¹[*SA*[*i*] + 1] — the SA-order position of the suffix following the *i*-th suffix. Ψ consists of σ increasing runs (one per starting character), gap-encodable in *nH_k* + *o*(*n* log σ) bits total. Pattern search mirrors backward search through Ψ: prepending *c* maps the interval through Ψ⁻¹ restricted to *c*'s run. Adding an *nH_k* + *o*(*n*)-bit LCP structure yields full **compressed suffix tree** functionality (Sadakane) in entropy-bounded space [8].

The CSA's Ψ is also the bridge to **compressed suffix trees** (Sadakane): adding an *nH_k* + *o*(*n*)-bit LCP structure yields full suffix-tree functionality in entropy-bounded space [8].

---

### 4.5 Succinct de Bruijn graphs: the BOSS representation

Pan-genome assembly replaces one reference genome by a **de Bruijn graph** of order *k*: nodes are distinct *k*-mers, edges are (*k*+1)-mers. For 10⁴ human genomes the graph has ~10¹¹ edges — hopeless with pointer representations.

Bowe et al. [6] encode the graph's edges with a BWT-like transform: sort all nodes by **colexicographic** order of their *k*-mers and define the **BOSS** triple:

- *E*: the **edge-BWT** — for each node in colex order, the sorted list of outgoing edge labels, concatenated;
- *W*: a bitvector marking node boundaries in *E*;
- *last*: a bitvector marking each node's last outgoing edge.

This **BOSS** representation stores the graph in 4*m* + *o*(*m*) bits for *m* edges over DNA (σ = 4): rank/select on *E* plus rank on *W* implement *forward(v, c)*, *backward(v)* (the LF-analogue), and *k*-mer membership (backward search on *E*).

> **Theorem 4.5 (BOSS).** *[6] A de Bruijn graph with m edges over an alphabet of size σ can be stored in m log σ + 2m + o(m) bits supporting forward and backward edge navigation in O(log σ) time and k-mer membership in O(k log σ) time.*

*Proof sketch.* *E* has length *m*: a wavelet tree stores it in *m* log σ + *o*(*m*) bits. *W* and *last* are length-*m* bitvectors: 2*m* + *o*(*m*) bits. Node intervals come from rank on *W*; the LF-step is rank/select on *E*, each *O*(log σ). ∎

BOSS underlies modern pan-genome indexes, answering "in which genomes does this *k*-mer occur" without the raw sequences [6].

---

### Complexity summary

| Operation | Structure | Time | Space (bits) |
|---|---|---|---|
| *rank_b*, *select_b* | Jacobson/Clark | *O*(1) | *n* + *o*(*n*) |
| *rank_b*, *select_b* | RRR [2] | *O*(1) | *nH*₀ + *o*(*n*) |
| *select* on monotone seq | Elias–Fano | *O*(1) | *n*⌈log(*m*/*n*)⌉ + 2*n* + *o*(*n*) |
| *access*, *rank_c*, *select_c* | Wavelet tree [3] | *O*(log σ) | *nH*₀ + *o*(*n* log σ) |
| *count(P)* | FM-index [4] | *O*(\|*P*\|) | 5*nH_k* + *o*(*n*) |
| *count(P)* | CSA [3] | *O*(\|*P*\| log σ) | *nH_k* + *o*(*n* log σ) |
| *k*-mer membership | BOSS [6] | *O*(*k* log σ) | *m* log σ + 2*m* + *o*(*m*) |

---

## 5 Empirical Results and Formal Guarantees

**Formal guarantees.** The bounds in §4 are worst-case in the word-RAM model with word size Θ(log *n*). Lower bounds are tight: any *rank*-supporting bitvector needs *n* + Ω(*n* log log *n*/log *n*) bits (Golynski), so Jacobson's redundancy is essentially optimal. The Fredman–Saks Ω(log *n*/log log *n*) dynamic lower bound is matched by Navarro and Sadakane's structures.

**Measured constants (SDSL).** The Succinct Data Structures Library (Gog et al. [7]) turns these theorems into engineered artifacts. On a 3 GB text (σ = 256): `rrr_vector<63>` uses ~1.05·*nH*₀ bits with rank at ~40 ns; `wt_huff<>` uses *n*(*H*₀ + 1) bits with *rank_c* ~300 ns; `csa_wt<>` uses ~0.6*n* log σ bits on repetitive text with *count* at ~2 μs/character; `fm_index` (sampled SA, *s_A* = 32) locates at ~1.5 μs/occurrence.

The theory-to-practice gap is dominated by the *o*(*n*) directories' constants and cache effects — the wavelet matrix's *z_l* arrays, for instance, halve the cache misses of the pointer-based wavelet tree.

**Pan-genome scale.** BOSS on a 10⁴-genome collection (~10¹¹ distinct edges at *k* = 31) fits in roughly 4 bits/edge ≈ 50 GB — two orders of magnitude below pointer graphs — with *k*-mer queries in microseconds via the edge-BWT backward walk [6].

---

## 6 Limitations

1. **Redundancy constants.** The *o*(*n*) terms hide constants that matter: Jacobson directories add ~5–10% in practice, RRR's class overhead reaches 25% at small block sizes, and the sampled suffix array's 1/*s_A* fraction dominates every FM-index deployment.
2. **Construction cost.** Building the BWT in *o*(*n* log *n*) time needs *O*(*n* log σ) bits of workspace (Belazzougui et al. [8]); naive suffix sorting of a 3 GB genome remains the practical bottleneck.
3. **Dynamism.** Insertions and deletions break the sorted orders (BWT rows, colex node order) that every bound above depends on. Dynamic succinct bitvectors pay Ω(log *n*/log log *n*) per update; fully dynamic FM-indexes and BOSS graphs are an order of magnitude slower than static ones, and dynamic *entropy-compressed* structures with *nH_k* + *o*(*n*) space remain open.
4. **Alphabet scaling.** Wavelet-tree query time grows as *O*(log σ); Huffman-shaped and multiary variants recover *O*(*H*₀) average time but complicate select. The alphabet-friendly FM-index [4] addresses space, not latency.
5. **Worst-case inputs.** All entropy bounds are *instance-dependent*: on random strings (*H_k* ≈ log σ) every compressed structure degrades to its *n* log σ worst case, where a plain array is simpler and faster.
6. **Error tolerance.** Sequencing errors explode de Bruijn graphs with false nodes, and BOSS has no native approximate-membership mode — practitioners pre-filter with Bloom filters before building the exact succinct graph.

---

## 7 Conclusion

From Jacobson's rank directories [1] to Bowe et al.'s edge-BWT graphs [6], succinct data structures have converged on one design principle: **reduce every query to rank and select, then compress the bitvectors that answer them**. RRR [2] made the bitvector itself entropy-bounded; wavelet trees [3] lifted the primitives to arbitrary alphabets; the FM-index [4] and compressed suffix arrays [3] turned the Burrows–Wheeler transform [5] into searchable self-indexes; BOSS extended the paradigm from strings to graphs, placing pan-genome assembly within reach of a single server.

Bowtie, BWA, and modern assemblers are FM-index and de Bruijn-graph applications; the SDSL library [7] has commoditized the engineering. The frontier is dynamism: matching static *nH_k* + *o*(*n*)-bit bounds under updates.

---

## References

[1] G. Jacobson. Space-efficient static trees and graphs. In *Proc. 30th IEEE Symp. on Foundations of Computer Science (FOCS)*, pages 549–554, 1989. https://gwern.net/doc/cs/algorithm/information/compression/1989-jacobson.pdf

[2] R. Raman, V. Raman, and S. S. Rao. Succinct indexable dictionaries with applications to encoding k-ary trees and multisets. In *Proc. 13th ACM-SIAM Symp. on Discrete Algorithms (SODA)*, pages 233–242, 2002. https://arxiv.org/abs/0705.0552

[3] R. Grossi, A. Gupta, and J. S. Vitter. High-order entropy-compressed text indexes. In *Proc. 14th ACM-SIAM Symp. on Discrete Algorithms (SODA)*, pages 841–850, 2003. https://linproxy.fan.workers.dev:443/https/drops.dagstuhl.de/storage/01oasics/oasics-vol132-grossis-festschrift/OASIcs.Grossi.15/OASIcs.Grossi.15.pdf

[4] P. Ferragina and G. Manzini. Indexing compressed text. *Journal of the ACM*, 52(4):552–581, 2005. http://archive.dimacs.rutgers.edu/Workshops/BWT/ferragina.pdf

[5] M. Burrows and D. J. Wheeler. A block sorting lossless data compression algorithm. Technical Report 124, Digital Equipment Corporation, 1994. https://www.cs.jhu.edu/~langmea/resources/burrows_wheeler.pdf

[6] A. Bowe, T. Onodera, K. Sadakane, and T. Shibuya. Succinct de Bruijn graphs. In *Proc. 12th Int. Workshop on Algorithms in Bioinformatics (WABI)*, pages 225–235, 2012. https://arxiv.org/pdf/1902.02889v1

[7] S. Gog, T. Beller, A. Moffat, and M. Petri. From theory to practice: Plug and play with succinct data structures. In *Proc. 13th Int. Symp. on Experimental Algorithms (SEA)*, pages 326–337, 2014. https://arxiv.org/abs/1609.06378v1

[8] R. Grossi, A. Orlandi, R. Raman, and S. S. Rao. Lowering the redundancy in fully indexable dictionaries. https://web3.arxiv.org/pdf/0902.2648
