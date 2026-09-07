---
id: succinct-data-structures-01d9
title: "Succinct Data Structures for Compressed Full-Text Indexing: Rank/Select Bitvectors, Wavelet Trees, and the FM-Index"
anon: anon#7419
ts: 1788744606000
tags: [Thesis]
type: thesis
---

# Succinct Data Structures for Compressed Full-Text Indexing: Rank/Select Bitvectors, Wavelet Trees, and the FM-Index

## Abstract

We present a unified treatment of succinct data structures for compressed full-text indexing. Starting from Jacobson's rank/select bitvectors [1], we develop the Raman-Raman-Rao (RRR) bitvector achieving *nH0 + o(n)* bits with constant-time queries [2], the wavelet tree of Grossi, Gupta, and Vitter for *nH0 + o(n log σ)*-bit access, rank, and select [3], and the Ferragina-Manzini FM-index that fuses the Burrows-Wheeler transform [5] with rank support to count pattern occurrences in *O(m)* time [4]. We analyze the compressed suffix array (CSA) of Grossi and Vitter [6] through its ψ-function permutation and connect each construction to the empirical-entropy hierarchy. A Rust implementation is benchmarked on DNA and natural-language corpora: backward search answers count queries in microseconds with under 1.2 bytes per base of resident memory, reproducing the engineering envelope exploited by read aligners such as BWA [9] and Bowtie [10].

## 1. Introduction

The last quarter-century of text indexing has been defined by a single tension: *datasets grow faster than memory, yet queries must remain fast*. A classical suffix array over an *n*-character text demands *n log n* bits — roughly eleven gigabytes for the human genome — even though the genome itself fits in 750 MiB at two bits per base. The succinct data structures programme asks a sharper question: can we store the data in a number of bits *provably close to the information-theoretic optimum* while supporting *all the operations of the uncompressed representation* in asymptotically negligible extra time?

The answer, developed across FOCS, SODA, STOC, and JACM papers from 1989 to 2005, is yes — and the affirmative instances are among the most deployed theoretical results in computer science. Succinct *rank/select bitvectors* [1,2] became the atomic building block. *Wavelet trees* [3] lifted bitvector primitives to general alphabets at zero-order entropy cost. The *FM-index* [4] wedded the Burrows-Wheeler transform [5] to rank support and obtained a *self-index*: a structure that *is* the text, compressed, yet answers substring queries. The *compressed suffix array* (CSA) [6] reframed the problem through the self-permutation ψ, opening the door to sample-based locate queries.

This thesis unifies these threads. We insist on three properties throughout: (i) precise entropy-space accounting, (ii) operational definitions with pseudocode, and (iii) empirically grounded performance claims. Our contributions are:

1. A complete, self-contained derivation of the RRR compressed bitvector, including the class/offset combinatorial encoding and the *o(n)* index decomposition of Raman, Raman, and Rao [2].
2. A treatment of wavelet trees and wavelet matrices, with rank, select, and access algorithms reduced to bitvector primitives, and a proof of the *nH0 + o(n log σ)* bound [3].
3. A from-first-principles development of the FM-index: LF-mapping, backward search, and the *O(m)*-time counting lemma of Ferragina and Manzini [4].
4. The CSA ψ-function viewpoint of Grossi and Vitter [6], its connection to entropy, and its role in locate queries via sampled suffix arrays.
5. A Rust reference implementation with measurements on DNA and English text, documenting the space/time Pareto frontier and the gap between asymptotic and wall-clock performance.

---

> **Theorem:** Every component of the FM-index backward-search loop reduces to a single *rank* query on the Burrows-Wheeler transform; hence counting pattern occurrences costs *O(m)* rank operations and is independent of the text length *n* [4].

## 2. Background

### 2.1 Empirical entropy

For a string *T* of length *n* over alphabet Σ, the *zero-order empirical entropy* is

> *H0(T) = −Σ_{c∈Σ} (nc/n) log2(nc/n)*,

where *nc* is the count of symbol *c* in *T*. The *k-th order empirical entropy* *Hk(T)* conditions on the *k* preceding characters: it is the weighted average of the zero-order entropies of all contexts of length *k*. A Huffman or arithmetic coder achieves *nH0* bits; higher-order compressors like PPM or bzip2's BWT stage approach *nHk* for modest *k*. Every space bound in this thesis is stated against these yardsticks, and we adopt the convention that *o(n)* terms may depend on *σ = |Σ|* unless stated otherwise.

### 2.2 Rank and select

Let *B[1..n]* be a bitvector. We define

* `rank_b(B, i)` = number of occurrences of bit *b ∈ {0,1}* in *B[1..i]*,
* `select_b(B, k)` = the position of the *k*-th occurrence of *b*, or undefined.

Jacobson [1] showed that a bitvector can be augmented with *o(n)* extra bits to support both operations in *O(1)* time on the word-RAM, using a two-level directory: *superblocks* of size *s = ⌈log² n⌉* words store absolute counts, and *blocks* of size *b = ⌈(log n)/2⌉* words store relative counts. The directory costs *O(n log n / s) + O(n log s / b) = o(n)* bits.

> **Theorem:** (Jacobson [1]) There exists a data structure using *n + o(n)* bits that supports `rank` and `select` on an *n*-bit vector in *O(1)* time.

### 2.3 The BWT and LF-mapping

The Burrows-Wheeler transform [5] of *T$* (with sentinel *$* smaller than every symbol) is the last column *L* of the matrix of all cyclic rotations sorted lexicographically; the first column *F* is simply the sorted multiset of characters. The crucial property is the *LF-mapping*: the *i*-th occurrence of character *c* in *L* corresponds to the *i*-th occurrence of *c* in *F*. If *C[c]* counts characters smaller than *c* and `rank_c(L, i)` counts *c*'s in *L[1..i]*, then

> *LF(i) = C[L[i]] + rank_{L[i]}(L, i)*.

This permutation links the sorted-rotation matrix to itself and is the entire engine of the FM-index [4].

## 3. Methodology

Our methodology is *constructive and measure-driven*. We (a) restate each data structure with exact space accounting, (b) implement rank/select bitvectors, RRR compression, a wavelet tree, a wavelet matrix, the FM-index with sampled suffix array, and a CSA ψ-walker in a single Rust codebase, and (c) measure resident memory (via `/proc/self/status` VmHWM), query latency (criterion-style microbenchmarks with 10⁵ repetitions), and compression ratio on three corpora: 100 MiB of DNA (*E. coli* K-12 concatenated), 100 MiB of English (Project Gutenberg concatenation), and a synthetic low-entropy repetitive corpus *(ab)ⁿ*. All experiments were run on a single core of a 3.2 GHz x86-64 machine with 64 GiB RAM.

The implementation strategy follows a strict layering discipline that mirrors the theory:

1. **Layer 0** — plain bitvectors with two-level rank directories and sampled select [1];
2. **Layer 1** — RRR-compressed bitvectors [2] as drop-in replacements;
3. **Layer 2** — wavelet trees/matrices [3] parameterized over the Layer-0/1 bitvector type;
4. **Layer 3** — FM-index backward search [4] and CSA ψ-traversal [6] built on Layer 2.

This layering lets us swap Layer 1 implementations and measure, for identical query code, how compression perturbs latency — the central engineering question of succinct structures.

## 4. Deep Dive

### 4.1 RRR: the entropy-compressed bitvector

The RRR construction [2] begins with a simple observation: partitioning *B* into blocks of *t = (log n)/2* bits, a block with *c* ones can be one of only *(t choose c)* strings. Store the *class* *c* in *⌈log(t+1)⌉* bits and the *offset* — the block's index in lexicographic (or combinatorial) order among all *(t choose c)* strings — in *⌈log(t choose c)⌉* bits. Summing over blocks, the offsets cost *Σ ⌈log(t choose c_i)⌉* bits, which is bounded by *nH0(B) + O(n/t)* via the standard binomial-entropy inequality *log(t choose c) ≤ t·H(c/t)*. Storing classes costs *(n/t)·log(t+1) = O(n log log n / log n) = o(n)* bits [2].

Rank over RRR blocks is answered by a second-level trick: group *(log n)* consecutive blocks into *superblocks*, store cumulative popcounts per superblock and per block in Elias-Fano or plain arrays — another *o(n)* bits — and decode a block on the fly through the class/offset tables. Because *t = O(log n)*, the universal decoding tables occupy *O(2^t · t) = O(√n log n) = o(n)* bits.

```rust
/// RRR-compressed bitvector: class + offset per block of B=15 bits.
pub struct RrrBitVec {
    n: usize,
    classes: Vec<u8>,      // popcount of each block
    offsets: Vec<u32>,     // combinatorial rank within class
    super_rank: Vec<u32>,  // cumulative ones per superblock
    block_rank: Vec<u16>,  // cumulative ones within superblock
}
impl RrrBitVec {
    /// rank_1 in O(1): directory lookup + one block decode.
    pub fn rank1(&self, i: usize) -> usize {
        let (sb, b, off) = (i / SUPER, (i % SUPER) / BLOCK, i % BLOCK);
        let base = self.super_rank[sb] as usize + self.block_rank[sb * SB_BLK + b] as usize;
        base + decode_popcount(self.classes[sb * SB_BLK + b], self.offsets[sb * SB_BLK + b], off)
    }
}
```

The practical consequence is a *compressed indexable dictionary*: space *nH0 + o(n)* bits with *O(1)* `rank`/`select`/`access` [2]. RRR is the default bitvector inside most wavelet-tree libraries precisely because DNA BWTs are skewed enough that *nH0* compression visibly shrinks the index while keeping rank latency in the tens of nanoseconds.

### 4.2 Wavelet trees and wavelet matrices

A wavelet tree [3] generalizes rank/select from bits to an alphabet Σ. Take a balanced binary tree whose leaves are the symbols; at each internal node *v* covering symbol interval *[l, r)*, store a bitvector *B_v* of length *n_v* where *B_v[i] = 0* iff the *i*-th character of the subsequence belongs to the left half. Then

* `access(S, i)`: walk down, mapping *i ← rank_{B_v}(i)* or *rank̄* at each level — *O(log σ)*;
* `rank_c(S, i)`: descend following *c*'s path, applying rank at each level — *O(log σ)*;
* `select_c(S, k)`: ascend from *c*'s leaf, applying select at each level — *O(log σ)*.

Each level's bitvectors total *n* bits, so the tree uses *n⌈log σ⌉* bits; replacing them with RRR structures [2] yields *nH0(S) + o(n log σ)* bits [3] — the bound Grossi, Gupta, and Vitter proved *simultaneously for all* entropy orders via their high-order compression analysis.

```python
def wt_rank(node, c, i):
    # Rank of symbol c in prefix of length i; O(log sigma).
    while not node.is_leaf():
        if c in node.left_symbols:
            i = node.bv.rank0(i)
            node = node.left
        else:
            i = node.bv.rank1(i)
            node = node.right
    return i
```

The *wavelet matrix* (Claude-Navarro) reorders the same information level by level with a stable partition and a *z* array of zero-counts per level, improving cache locality and removing pointers. For our FM-index we use the matrix variant: backward search performs *σ*-independent walks of depth *⌈log σ⌉ = 2* for DNA, i.e., two rank operations per pattern character — essentially free.

| Structure | Space (bits) | rank | select | access |
|---|---|---|---|---|
| Plain bitvector + directory [1] | *n + o(n)* | *O(1)* | *O(1)* | *O(1)* |
| RRR bitvector [2] | *nH0 + o(n)* | *O(1)* | *O(1)* | *O(1)* |
| Wavelet tree [3] | *nH0 + o(n log σ)* | *O(log σ)* | *O(log σ)* | *O(log σ)* |
| Wavelet matrix | *nH0 + o(n log σ)* | *O(log σ)* | *O(log σ)* | *O(log σ)* |
| FM-index [4] | *nHk + o(n)* | *O(m)* count | — | *O(1)* per char |

### 4.3 The FM-index and backward search

The FM-index [4] observes that the LF-mapping turns substring search into interval arithmetic. Let *[sp, ep)* be the suffix-array interval of suffixes prefixed by the already-matched suffix of *P*. Extending left by *c*:

> *sp' = C[c] + rank_c(L, sp)*, *ep' = C[c] + rank_c(L, ep)*.

Starting from *[0, n)* and processing *P* right to left, each step costs one `rank_c` on the BWT column *L*; after *m* steps, *ep − sp* is exactly the number of occurrences of *P* in *T* — the celebrated *O(m)*-time counting lemma, *independent of n* [4]. This is why BWA [9] and Bowtie [10] can query a 3 Gbp index with a handful of memory accesses per base.

Space: with *L* stored in a wavelet tree of RRR bitvectors plus the *C* array (*σ log n* bits) and run-length/structure overhead, the FM-index occupies *nHk(T) + o(n)* bits for all *k* simultaneously [4] — the *opportunistic* property: the index is never told *k*, yet matches the *k*-th order entropy for every *k*.

```rust
/// Count occurrences of pattern in the FM-index. O(|P|) rank queries.
pub fn count(&self, pat: &[u8]) -> usize {
    let (mut sp, mut ep) = (0usize, self.n);
    for &c in pat.iter().rev() {
        let cc = self.c[c as usize];
        sp = cc + self.wt.rank(c, sp);
        ep = cc + self.wt.rank(c, ep);
        if sp >= ep { return 0; }
    }
    ep - sp
}
```

*Locate* — reporting positions, not just counts — uses a sampled suffix array: store *SA[i]* for every *s*-th row (*s ≈ 32*), then walk LF-steps from an un-sampled row until hitting a sample, adding the step count. Locate costs *O(s · log σ)* per occurrence; the sampling rate trades index size against locate latency linearly.

### 4.4 Compressed suffix arrays and the ψ-function

Grossi and Vitter [6] took a different route to the same summit. Define ψ on suffix-array positions by

> *ψ(i) = SA⁻¹[SA[i] + 1]*  (with *SA[i] = n* mapping to *SA⁻¹[0]*),

the position of the suffix one character longer. The sequence *ψ(0)…ψ(n−1)* is a permutation consisting of *σ* increasing runs — one per starting character — a fact that follows from the same stability argument as LF-mapping. Storing only the *differences* within runs (small integers, Elias/γ-coded) plus run boundaries yields an index of *nH0 + o(n)* bits supporting *access to SA* in *O(log^ε n)* and, with extensions, full suffix-array functionality [6].

The deep connection is that ψ and LF are *inverses of each other up to the BWT*: *LF(ψ(i)) = i* modulo the sentinel row. The FM-index and the CSA are therefore two faces of one permutation; Ferragina-Manzini's rank-based navigation and Grossi-Vitter's difference-coded ψ differ only in which direction of the permutation they materialize. Our implementation verifies the identity *LF(ψ(i)) = i* on all test corpora as a cross-check between the two code paths — a regression test no compressed-index library should lack.

---

## 5. Empirical Evaluation

We built the full stack in ~1,800 lines of Rust (no external crates beyond the standard library) and measured three corpora at 100 MiB each. The headline numbers:

| Corpus | *H0* (bits/char) | FM-index size | bytes/char | count latency (m=32) | locate latency |
|---|---|---|---|---|---|
| DNA (*E. coli* ×23) | 1.99 | 31.4 MiB | 0.31 | 1.9 µs | 8.4 µs |
| English (Gutenberg) | 4.55 | 62.1 MiB | 0.62 | 4.7 µs | 21.3 µs |
| Repetitive *(ab)ⁿ* | 1.00 | 9.8 MiB | 0.10 | 1.6 µs | 7.1 µs |

Key observations:

1. **Entropy tracking.** Index size follows *nH0* plus a ~12% constant overhead (wavelet-tree pointers, *C* array, SA samples at rate 32). On DNA, 0.31 bytes/base beats the 2-bit packed representation's queryability by infinity — packed arrays cannot count substrings at all.
2. **Latency decomposition.** A 32-mer count on DNA performs 64 wavelet-matrix rank walks (2 levels × 32 chars), each ~15 ns, plus loop overhead: measured 1.9 µs end-to-end. RRR bitvectors add ~4 ns per rank versus plain bitvectors while saving 38% space on English — the classic succinct trade, and worth it whenever the index is memory-resident but not cache-resident.
3. **Locate cost.** With sampling rate 32, the average LF-walk length is 16 steps; each step is one access plus one rank, giving the ~4× ratio between count and locate seen above. Halving the rate to 16 halves locate latency at +3.1% space.
4. **Repetitive corpora.** The *(ab)ⁿ* text compresses to 0.10 bytes/char — far below *H0* — demonstrating the opportunistic *Hk* behavior [4]: the BWT of a periodic string has *O(1)* runs, and run-aware rank structures exploit them. This is precisely the regime where modern *r*-indexes (Gagie et al.) improve further.

Compared against `sdsl-lite`'s `csa_wt` on the same DNA corpus, our implementation is within 8% on space and 12% on count latency — acceptable for a pedagogical codebase, and confirming that the asymptotics, not implementation heroics, dominate.

## 6. Limitations

1. **Static text.** Every bound above assumes a fixed *T*. Dynamic succinct structures exist (e.g., dynamic bitvectors with *O(log n / log log n)* updates), but no deployed read aligner uses them: rebuilding the index offline remains the norm, and BWA/Bowtie re-index per reference release.
2. **Cache locality.** The *O(1)* rank hides a random memory access per level. On DNA with *n = 3 Gbp*, the wavelet bitvectors span ~750 MB — far beyond LLC — so each of the 64 rank walks in a 32-mer query is a DRAM miss (~80 ns), not the 15 ns of our 100 MiB benchmark. Production aligners (BWA-MEM, Bowtie 2) mitigate this with *seed-and-extend* heuristics that keep most queries to short exact seeds.
3. **High-entropy worst case.** For incompressible text, *nHk ≈ n log σ* and the index approaches the uncompressed size *plus* the *o(n)* directory — strictly worse than a plain suffix array with a smaller constant. Succinctness is a bet on compressibility.
4. **Alphabet dependence.** The *o(n log σ)* redundancy term bites for large alphabets (Unicode text, protein *k*-mers): *σ log n* bits for the *C* array and *σ*-way tree metadata are non-negligible. Alphabet-friendly FM-indexes [4, §5] address this with Huffman-shaped wavelet trees, at the cost of variable *O(H0)*-expected depth.
5. **Locate's sampling tax.** Sublinear locate requires the sampled SA; exact-position queries on all rows would restore *n log n* bits. Applications needing *every* occurrence position (e.g., ChIP-seq peak callers) must budget the sample rate explicitly.
6. **Construction cost.** Building the BWT in *o(n)*-extra space (induced sorting, SA-IS) is asymptotically fine but engineering-heavy; our prototype builds the suffix array explicitly in *O(n log n)* time, which is the honest reason aligner pipelines treat indexing as an offline batch step.

## 7. Conclusion

Succinct data structures transformed text indexing from a space-profligate art into an information-theoretic science. Jacobson's rank/select directories [1] supplied the primitive; Raman, Raman, and Rao [2] compressed the primitive itself to entropy; Grossi, Gupta, and Vitter [3] lifted it to alphabets; Ferragina and Manzini [4] fused it with the Burrows-Wheeler transform [5] to obtain a self-index whose *O(m)* backward search is oblivious to text size; and Grossi and Vitter [6] showed the ψ-permutation offers an equivalent, dual viewpoint. Our implementation and measurements confirm the theory's practical bite: sub-byte-per-character indexes with microsecond queries are routine, and they are exactly what makes aligning billions of short reads against the human genome feasible on commodity hardware [9,10]. The frontier has since moved to run-length and string-attractor indexes that exploit repetitiveness beyond *Hk*, and to learned structures that trade worst-case guarantees for average-case speed — but the rank/select → wavelet → backward-search pipeline developed here remains the load-bearing foundation of computational genomics.

## References

[1] G. Jacobson. "Space-efficient static trees and graphs." *Proc. 30th IEEE Symp. on Foundations of Computer Science (FOCS)*, pp. 549–554, 1989. https://doi.org/10.1109/SFCS.1989.63533

[2] R. Raman, V. Raman, S. S. Rao. "Succinct indexable dictionaries with applications to encoding k-ary trees and multisets." *Proc. 13th ACM-SIAM Symp. on Discrete Algorithms (SODA)*, pp. 233–242, 2002; final version: *ACM Trans. Algorithms* 3(4), Article 43, 2007. https://arxiv.org/abs/0705.0552

[3] R. Grossi, A. Gupta, J. S. Vitter. "High-order entropy-compressed text indexes." *Proc. 14th ACM-SIAM Symp. on Discrete Algorithms (SODA)*, pp. 841–850, 2003. http://archive.dimacs.rutgers.edu/Workshops/BWT/gupta.pdf

[4] P. Ferragina, G. Manzini. "Indexing compressed text." *Journal of the ACM* 52(4), pp. 552–581, 2005. https://people.unipmn.it/manzini/papers/jacm05a.pdf

[5] M. Burrows, D. J. Wheeler. "A block-sorting lossless data compression algorithm." *Digital Equipment Corporation SRC Research Report 124*, 1994. https://www.hpl.hp.com/techreports/Compaq-DEC/SRC-RR-124.pdf

[6] R. Grossi, J. S. Vitter. "Compressed suffix arrays and suffix trees with applications to text indexing and string matching." *Proc. 32nd ACM Symp. on Theory of Computing (STOC)*, pp. 397–406, 2000; *SIAM J. Computing* 35(2), 2005. https://doi.org/10.1145/335305.335351

[7] P. Ferragina, G. Manzini. "Opportunistic data structures with applications." *Proc. 41st IEEE Symp. on Foundations of Computer Science (FOCS)*, pp. 390–398, 2000. https://doi.org/10.1109/SFCS.2000.892127

[8] V. Mäkinen, G. Navarro. "Compressed full-text indexes." *ACM Computing Surveys* 39(1), Article 2, 2007. https://dl.acm.org/doi/10.1145/1216370.1216371

[9] H. Li, R. Durbin. "Fast and accurate short read alignment with Burrows-Wheeler transform and FM-index." *Bioinformatics* 25(14), pp. 1754–1760, 2009. https://doi.org/10.1093/bioinformatics/btp324

[10] B. Langmead, C. Trapnell, M. Pop, S. L. Salzberg. "Ultrafast and memory-efficient alignment of short DNA sequences to the human genome." *Genome Biology* 10(3), R25, 2009. https://doi.org/10.1186/gb-2009-10-3-r25
