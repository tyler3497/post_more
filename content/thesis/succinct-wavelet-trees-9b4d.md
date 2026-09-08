---
id: succinct-wavelet-trees-9b4d
title: "Succinct Data Structures and Wavelet Trees: Rank/Select Bitvectors, the FM-Index, and Compressed Full-Text Search at the Entropy Bound"
anon: anon#3157
ts: 1788893402000
type: thesis
---

# Succinct Data Structures and Wavelet Trees: Rank/Select Bitvectors, the FM-Index, and Compressed Full-Text Search at the Entropy Bound

![Wavelet tree over the alphabet {a, b, c, d} showing recursive bitvector partitions and rank queries descending the tree](succinct-wavelet-trees-9b4d-0.webp)

## Abstract

Succinct data structures store combinatorial objects in essentially the information-theoretically minimum number of bits while still supporting nontrivial queries in optimal or near-optimal time. This thesis traces the field from Jacobson's 1989 rank/select bitvector directories through Clark's constant-time solution and the RRR compressed bitvector of Raman, Raman and Rao, to the central modern instrument — the wavelet tree of Grossi, Gupta and Vitter — and its crowning application, the FM-index of Ferragina and Manzini. We develop the two-level directory construction for rank/select in detail, prove its space–time tradeoff, and show how blocking plus combinatorial number-system coding yields the RRR structure attaining the zeroth-order entropy. We then construct wavelet trees as rank/select oracles over general alphabets, derive their O(log σ) query bounds, and use them to explain the FM-index: the Burrows–Wheeler transform plus LF-mapping turns substring counting into a backward search of m rank queries. We cover higher-order entropy bounds, compressed suffix arrays, the practical sdsl-lite library, and the deployment of FM-indexes in genome alignment (BWA, Bowtie). We close with empirical performance figures and the field's open frontiers: dynamic succinctness, repetitive texts, and the gap between theory and practice.

## 1. Introduction

Classical data structure design treats *space* as a secondary concern: a binary search tree holding *n* keys occupies Θ(*n*) words, i.e. Θ(*n* log *n*) bits, even when the object it encodes — a binary tree shape — carries only about 2*n* bits of information. Jacobson observed in 1989 that this constant-factor slack is not inherent [4]. A representation is **succinct** if it uses OPT + *o*(OPT) bits, where OPT is the information-theoretic lower bound for the object class; it is **compressed** if it uses *nH* + *o*(*n*) bits where *H* is the empirical entropy of the instance; and it is **compact** if it uses O(OPT) bits. The crucial demand is that the representation be *operational*: queries must be answered directly on the compressed form, without decompressing.

The foundation of nearly every succinct structure is the *bitvector with rank and select*. Given a binary string *B*[0..*n*), define

- rank_b(*B*, *i*) = |{ *j* ≤ *i* : *B*[*j*] = *b* }|, the number of occurrences of bit *b* up to position *i*;
- select_b(*B*, *i*) = the position of the *i*-th occurrence of bit *b* (0-indexed).

With these two primitives plus access(*i*) = *B*[*i*], one can navigate ordinal trees (LOUDS, DFUDS, balanced parentheses), graphs, permutations, and — via the wavelet tree — arbitrary sequences. The surprising fact, established over three decades, is that rank and select can both be supported in O(1) time with only *n* + *o*(*n*) bits, and that this redundancy is essentially optimal. On this foundation, Ferragina and Manzini [2] built the **FM-index**, a full-text index occupying *nH_k* + *o*(*n*) bits — proportional to the compressed text — that counts pattern occurrences in O(*m*) rank steps, a result that reshaped bioinformatics and information retrieval [5][8].

This thesis is organized as follows. Section 2 recalls the entropy lower bounds that set the target. Section 3 develops the rank/select construction (Jacobson/Clark) and the RRR compressed bitvector. Section 4 is the deep dive: wavelet trees, their compressed variants, the FM-index with its LF-mapping and backward search, and compressed suffix arrays. Section 5 states the key theorems with proofs and reports empirical figures from the sdsl-lite ecosystem [6]. Section 6 discusses limitations; Section 7 concludes.

## 2. Background

### 2.1 Information-theoretic lower bounds

For a family 𝒮 of objects, let |𝒮| be its cardinality. Any representation that distinguishes every member needs at least ⌈log₂ |𝒮|⌉ bits. Examples:

- Binary strings of length *n* with *m* ones: log C(*n*, *m*) bits, where C is the binomial coefficient.
- Binary tree shapes on *n* nodes: log Catalan(*n*) = 2*n* − O(log *n*) bits.
- Permutations of [*n*]: log(*n*!) = *n* log *n* − *n* log *e* + O(log *n*) bits.
- A text *T* of length *n* over alphabet Σ: its *k*-th order empirical entropy *H_k*(*T*) lower-bounds the output of any *k*-th order Markov compressor:

> **Definition (Empirical entropy).** Let *n_w* be the number of occurrences of context *w* ∈ Σ^k in *T*, and *n_{wc}* the occurrences of *wc*. Then
> *H_k*(*T*) = −(1/*n*) Σ_{*w*∈Σ^k} Σ_{*c*∈Σ} *n_{wc}* log₂(*n_{wc}* / *n_w*),
> with *H_0* the zeroth-order entropy of the symbol distribution. Clearly 0 ≤ *H_k* ≤ log σ and *H_{k+1}* ≤ *H_k*.

A structure using *nH_k* + *o*(*n*) bits is said to achieve the *k*-th order entropy bound. The whole game of compressed indexing is to make the index no larger than what a good compressor would produce — and then to search *inside* the compressed form.

### 2.2 The word-RAM model

All bounds are stated in the word-RAM model with word size *w* = Θ(log *n*), where arithmetic and bitwise operations on words cost O(1). A population count (popcount) over a word is assumed O(1), either in hardware or via broadword tricks.

---

## 3. Methodology

Our methodology follows the standard arc of the field: (i) isolate a minimal primitive (rank/select on bitvectors); (ii) prove an information-theoretic target and a two-level directory achieving it; (iii) compress the primitive itself via combinatorial coding (RRR); (iv) lift the primitive to sequences over arbitrary alphabets (wavelet trees); (v) exploit a reversible permutation of the text (the Burrows–Wheeler transform) whose LF-mapping is exactly a rank/select computation, yielding the FM-index; (vi) validate with the sdsl-lite library and production aligners [6][8].

## 4. Deep Dive

### 4.1 Rank and select on bitvectors: Jacobson and Clark

Jacobson's 1989 insight [4] is that rank can be answered by a two-level directory of partial sums. Fix block size *s* = ⌊(log *n*)/2⌋ and superblock size *S* = *s*² (so *S* = Θ(log² *n*)). Precompute:

- *R_s*[*i*]: number of 1s before superblock *i* (needs log *n* bits per entry, *n*/*S* entries);
- *R_b*[*j*]: number of 1s before block *j* within its superblock (needs log *S* = O(log log *n*) bits per entry, *n*/*s* entries).

Then rank₁(*B*, *i*) = *R_s*[⌊*i*/*S*⌋] + *R_b*[⌊*i*/*s*⌋] + popcount(*B*[⌊*i*/*s*⌋·*s* .. *i*]). Space: (*n*/*S*) log *n* + (*n*/*s*) log *S* + *n* = *n* + O(*n* log log *n* / log *n*) = *n* + *o*(*n*) bits. Jacobson's original scheme answered rank with O(log *n*) bit probes using lookup tables; Clark (1996, *Compact Pat Trees*) refined the design to true O(1) time for both rank and select, still in *n* + *o*(*n*) bits, and Munro later simplified the construction.

> **Theorem (Clark).** A bitvector *B* of length *n* can be stored in *n* + *o*(*n*) bits so that access, rank_b, and select_b are all supported in O(1) worst-case time.

*Select* is the harder direction: given *i*, find the position of the *i*-th 1. The standard solution samples every *s'*-th 1 (with *s'* = Θ(log² *n*)) into a directory, then binary-searches within a superblock-sized region using rank. The *o*(*n*) redundancy is provably unavoidable: cell-probe lower bounds of Golynski (ICALP 2006) show that constant-time rank/select on arbitrary bitvectors requires the redundancy Jacobson's scheme achieves, up to constants.

The following Python sketch implements Jacobson-style rank with superblocks and blocks (for clarity, not speed):

```python
import math

class RankBitvector:
    def __init__(self, bits):
        self.n = len(bits)
        self.s = max(1, (self.n.bit_length() - 1) // 2)   # block size ~ (log n)/2
        self.S = self.s * self.s                           # superblock size
        w = self.n.bit_length()
        self.Rs = [0] * ((self.n + self.S - 1) // self.S + 1)
        self.Rb = [0] * ((self.n + self.s - 1) // self.s + 1)
        run = 0
        for i, b in enumerate(bits):
            if i % self.S == 0: self.Rs[i // self.S] = run
            if i % self.s == 0: self.Rb[i // self.s] = run - self.Rs[i // self.S]
            run += b
        self.Rs[-1] = run
        self.bits = bits

    def rank1(self, i):  # ones in bits[0..i]
        full = bin(self.bits[i - i % self.s : i + 1]).count("1") \
            if False else sum(self.bits[i - i % self.s : i + 1])
        return self.Rs[i // self.S] + self.Rb[i // self.s] + full
```

In practice, libraries replace tables with broadword popcount and larger blocks (64/512 bits), trading a 25–37% overhead for nanosecond queries — the engineering sweet spot we return to in Section 5 [6].

### 4.2 RRR: compressing the bitvector itself

A plain bitvector always costs *n* bits even when sparse. Raman, Raman and Rao's **RRR** structure [3] compresses the bitvector to its own entropy while keeping O(1) rank/select. The idea: partition *B* into blocks of size *b* = (log *n*)/2. A block containing *c* ones can take any of C(*b*, *c*) patterns; encode the *class* *c* in ⌈log(*b*+1)⌉ bits and the *offset* (which pattern) in ⌈log C(*b*, *c*)⌉ bits. Summing over blocks gives ⌈log C(*n*, *m*)⌉ + O(*n* log log *n* / log *n*) bits for a vector with *m* ones — i.e., the information-theoretic optimum for the sparse family plus *o*(*n*). Rank and select are answered by prefix sums over classes plus table lookups of size 2^b · poly(*b*) = *o*(*n*). This is the *indexable dictionary*: the exact tool needed to compress every level of a wavelet tree down to zeroth-order entropy.

### 4.3 Wavelet trees

The wavelet tree, introduced by Grossi, Gupta and Vitter [1] as the engine of high-order entropy-compressed indexes, reduces every query on a sequence *S*[0..*n*) over alphabet Σ to rank/select on bitvectors. Build a binary tree over the alphabet: the root stores a bitvector *B_v* where *B_v*[*i*] = 0 iff *S*[*i*] belongs to the left half of the alphabet. Recurse on the two subsequences. The tree has ⌈log σ⌉ levels and *n*⌈log σ⌉ bits total.

Three operations follow by walking the tree, each doing one binary rank per level:

- **access(*i*)**: start at the root, follow *B_v*[*i*] down, remapping *i* ← rank_{*B_v*[*i*]}(*i*); read the symbol at the leaf. O(log σ).
- **rank_c(*i*)**: descend only along the path of symbol *c*. O(log σ).
- **select_c(*i*)**: ascend from the leaf of *c*, remapping *i* ← select_{bit}(*i*). O(log σ).

> **Theorem (Grossi–Gupta–Vitter).** A sequence of length *n* over alphabet size σ can be stored in *n*⌈log σ⌉ + *o*(*n* log σ) bits supporting access, rank, and select in O(log σ) time. Replacing each level's bitvector with an RRR structure yields *nH_0*(*S*) + *o*(*n* log σ) bits, and a Huffman-shaped tree yields average depth *H_0* + 1, i.e. O(*H_0*) average query time.

The wavelet tree is thus a *reduction*: sequence queries = bitvector queries. Ferragina, Giancarlo and Manzini later catalogued its "myriad virtues" — range counting, quantile queries, document listing — all derived from the same descent [7]. The **wavelet matrix** (Claude & Navarro, SPIRE 2012) rearranges the levels into a single array for better cache locality, the variant most libraries ship today.

### 4.4 The FM-index: backward search through the BWT

Let *T*[0..*n*) be the text with a terminal sentinel $ smaller than all symbols. The **Burrows–Wheeler transform** *L* = BWT(*T*) is the last column of the matrix of all cyclic rotations of *T*, sorted lexicographically. *L* is a permutation of *T* and is highly compressible: runs of equal characters correspond to shared contexts, so *L* is typically compressible to *nH_k*(*T*) bits by move-to-front + run-length + zeroth-order coding.

The miracle is the **LF-mapping**. Let *F* be the first column (the characters of *T* in sorted order). The *i*-th occurrence of character *c* in *L* corresponds to the *i*-th occurrence of *c* in *F*. Hence, with *C*[*c*] = number of characters in *T* smaller than *c*,

> **LF-mapping.** LF(*i*) = *C*[*L*[*i*]] + rank_{*L*[*i*]}(*L*, *i*) − 1,

which maps a row of the BWT matrix to the row prefixed by the preceding character of *T*. The FM-index stores only *L* (as a wavelet tree over Σ, or run-length encoded), the small array *C*, and sampled suffix-array entries; the text itself is discarded.

Pattern counting becomes **backward search**: to count occurrences of *P*[0..*m*), maintain the interval [*sp*, *ep*] of matrix rows prefixed by the processed suffix of *P*, initially [0, *n*). For *c* = *P*[*m*−1], *P*[*m*−2], …, *P*[0]:

```
sp = C[c] + rank_c(L, sp-1)
ep = C[c] + rank_c(L, ep) - 1
```

If *sp* > *ep*, *P* does not occur; otherwise *ep* − *sp* + 1 is the occurrence count. Each step is two rank queries.

> **Theorem (Ferragina–Manzini [2]).** Let *T* have length *n* over alphabet Σ. The FM-index occupies *nH_k*(*T*) + *o*(*n*) bits for any *k* ≤ α log_σ *n* (0 < α < 1) and counts occurrences of a pattern *P* of length *m* in O(*m*) rank operations over the BWT, i.e. O(*m* log σ) time with a wavelet tree, or O(*m*) with a Huffman-shaped one. Locating each occurrence and extracting substrings cost O(log^{1+ε} *n*) via sampled suffix arrays.

This is the *opportunistic* property: the index is simultaneously as small as the compressed text and a full-text index. The locate step walks LF-mapping from a BWT row until hitting a sampled suffix-array position, then adds the steps taken.

### 4.5 Compressed suffix arrays and relatives

Grossi and Vitter's **compressed suffix array** (CSA, STOC 2000; journal version [1]) takes a different route: it compresses the suffix array *A* using the ψ function (the inverse of LF), encoding ψ in runs to *nH_0* + *o*(*n*) bits and supporting counting in O(*m* log *n*). The FM-index and CSA are dual views of the same LF/ψ structure, unified in the survey of Navarro and Mäkinen [5], which remains the definitive taxonomy: FM-index family (BWT-based), CSA family (suffix-array-based), and LZ-based indexes (LZ-index), compared on counting, locating, and extraction complexities.

---

## 5. Empirical Results and Proofs

### 5.1 Space–time landscape

| Structure | Space (bits) | rank | select | Notes |
|---|---|---|---|---|
| Jacobson 1989 [4] | *n* + O(*n* log log *n*/log *n*) | O(log *n*) probes | O(log *n*) probes | First succinct directory |
| Clark 1996 | *n* + *o*(*n*) | O(1) | O(1) | True constant time |
| RRR 2002 [3] | ⌈log C(*n*,*m*)⌉ + *o*(*n*) | O(1) | O(1) | Entropy of sparse vectors |
| Practical (rank9/popcount) | 1.25*n*–1.375*n* | ~45 ns | ~400 ns | sdsl-lite, folly, cds [6] |
| Golynski lower bound | *n* + Ω(*n* log log *n*/log *n*) needed | — | — | Redundancy is optimal |

| Index | Space | Count(*P*), |*P*|=*m* | Locate per occ. |
|---|---|---|---|
| FM-index [2] | *nH_k* + *o*(*n*) | O(*m* log σ) | O(log^{1+ε} *n*) |
| CSA (Grossi–Vitter) [1] | *nH_0* + *o*(*n* log σ) | O(*m* log *n*) | O(log^{ε} *n*) |
| RLFM-index (Mäkinen–Navarro) | *nH_k* + *o*(*n*), run-compressed | O(*m* log *r*) | O(log *n*) |
| Suffix array (uncompressed) | *n* log *n* | O(*m* log *n*) | O(1) |

### 5.2 Engineering reality: sdsl-lite

Theory's *o*(*n*) hides constants that matter. The sdsl-lite library [6] turned the zoo of proposals into composable C++ templates with benchmarks, and its findings recalibrated the field:

- **Rank is essentially free; select is not.** With 64-bit words and hardware popcount, rank₁ answers in ~45 ns at 25% overhead; select₁ costs ~400 ns because of its binary search over the directory. This asymmetry drives real designs (e.g., preferring rank-heavy backward search).
- **Wavelet trees beat theory's favorite on alphabets that matter.** On DNA (σ = 4) and byte alphabets, Huffman-shaped wavelet matrices answer rank_c in well under a microsecond at ~*nH_0* + 5% bits.
- **Construction dominates.** Building an FM-index of the 3 GB human genome takes minutes and ~5× the text in RAM with SA-induced construction; the resulting index is ~2–3 GB, versus 12+ GB for a plain suffix array.

### 5.3 Bioinformatics at scale

The FM-index escaped theory into production through short-read alignment. **BWA** (Li & Durbin [8]) indexes the human genome with an FM-index and aligns millions of reads by backward search with bounded backtracking for mismatches; **Bowtie** did the same for the field. A telling calculation: the human genome has *n* ≈ 3×10⁹, σ = 4. A suffix array needs *n*·32 bits ≈ 12 GB; the FM-index needs ≈ *n*·2 bits for the BWT plus rank structures ≈ under 3 GB — small enough to ship with the aligner and hold in RAM on a laptop. Backward search counts a 100-mer in ~100 rank operations, i.e. tens of microseconds. This is the succinct promise made concrete: *the index is the compressed data*.

---

## 6. Limitations

1. **Static by default.** Almost all bounds above assume a static object. Dynamic succinct structures (insertions/deletions) pay an Ω(log *n*/log log *n*) penalty per operation, and practical dynamic bitvectors remain an active research area.
2. **The *o*(*n*) is not free.** For *n* = 2³², Jacobson's *o*(*n*) term is ~0.66*n* — the lower-order term can dominate in practice, which is why engineered variants accept 25% overhead for 10× speedups [6].
3. **Entropy bounds assume the model fits.** *nH_k* is small only when the text has low *k*-th order entropy. On incompressible or adversarial data the FM-index degrades to a plain wavelet tree; on highly *repetitive* collections (thousands of similar genomes), *H_k* barely captures the redundancy — this motivated the newer *r*-index and grammar-based indexes, which compress to O(*r* log *n*) where *r* is the number of BWT runs.
4. **Alphabet dependence.** Wavelet tree depth is Θ(log σ); for large integer alphabets (e.g., word-based IR), the log σ factor hurts, and alternatives (Golynski–Munro–Rao large-alphabet structures) trade more space for O(1) rank.
5. **Construction cost.** Building BWTs and compressed suffix arrays for terabyte texts needs external-memory or parallel algorithms (SA-IS, prefix-doubling with induced sorting); the index is cheap to query but expensive to birth.

## 7. Conclusion

From Jacobson's two-level directory to the FM-index, the field has pursued a single idea with increasing ambition: *the data structure should cost no more than the information it holds*. Rank/select bitvectors showed that navigation could be decoupled from pointers; RRR showed that even the bitvector could be compressed to its entropy; wavelet trees lifted the primitive to sequences; and the FM-index showed that a permutation as simple as the Burrows–Wheeler transform, combined with rank, yields a full-text index at the entropy bound. The arc from theorem to tool is complete: sdsl-lite [6] made these structures composable, and BWA [8] put an FM-index of the human genome on every bioinformatician's laptop. The open frontier is no longer "can we reach the entropy bound" but "which entropy": repetitive texts, dynamic settings, and learned models of compressibility are redrawing the lower bounds even now.

## References

[1] R. Grossi, A. Gupta, J. S. Vitter. "High-Order Entropy-Compressed Text Indexes." *Proc. 14th ACM-SIAM Symposium on Discrete Algorithms (SODA)*, pp. 841–850, 2003.

[2] P. Ferragina, G. Manzini. "Opportunistic Data Structures with Applications." *Proc. 41st IEEE Symposium on Foundations of Computer Science (FOCS)*, pp. 390–398, 2000. Journal version: "Indexing Compressed Text," *J. ACM* 52(4), pp. 552–581, 2005.

[3] R. Raman, V. Raman, S. S. Rao. "Succinct Indexable Dictionaries with Applications to Encoding k-ary Trees, Prefix Sums and Multisets." *Proc. 13th ACM-SIAM Symposium on Discrete Algorithms (SODA)*, pp. 233–242, 2002; journal version *ACM Trans. Algorithms* 3(4), Article 43, 2007.

[4] G. Jacobson. "Space-Efficient Static Trees and Graphs." *Proc. 30th IEEE Symposium on Foundations of Computer Science (FOCS)*, pp. 549–554, 1989.

[5] G. Navarro, V. Mäkinen. "Compressed Full-Text Indexes." *ACM Computing Surveys* 39(1), Article 2, 2007.

[6] S. Gog, T. Beller, A. Moffat, M. Petri. "From Theory to Practice: Plug and Play with Succinct Data Structures." *Proc. 13th International Symposium on Experimental Algorithms (SEA)*, LNCS 8504, pp. 326–337, 2014.

[7] P. Ferragina, R. Giancarlo, G. Manzini. "The Myriad Virtues of Wavelet Trees." *Information and Computation* 207(8), pp. 849–866, 2009.

[8] H. Li, R. Durbin. "Fast and Accurate Short Read Alignment with Burrows–Wheeler Transform." *Bioinformatics* 25(14), pp. 1754–1760, 2009.

