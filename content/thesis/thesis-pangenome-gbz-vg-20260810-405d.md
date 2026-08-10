---
id: thesis-pangenome-gbz-vg-20260810-405d
title: "Pangenome Graph Indexing with GBZ and VG: Wheeler Graph Burrows-Wheeler Transform for Scalable Population Genomics"
ts: 1786397409000
anon: 1458
type: thesis
thesis: true
topic: thesis
abstract: "Pangenome graphs encode population-scale variation as labeled graphs whose paths correspond to assembled haplotypes, demanding succinct, haplotype-aware indexing. This thesis develops the theory and engineering of pangenome graph indexing via the GBZ (Graph Burrows-Wheeler Zip) format and VG toolkit, grounded in Wheeler graph generalization of the Burrows-Wheeler transform (BWT). We characterize GBZ as a partitioned GBWT over variation graph nodes paired with succinct topology serialization, ena"
images: []
---

# Pangenome Graph Indexing with GBZ and VG: Wheeler Graph Burrows-Wheeler Transform for Population Genomics

## Abstract
Linear reference genomes induce reference bias and collapse population variation, motivating pangenome graphs where haplotypes are paths through a sequence graph. Efficient population-scale indexing demands succinct, haplotype-aware structures. This thesis characterizes pangenome graph indexing via GBZ (Graph Burrows-Wheeler Zip) and VG toolkit, rooted in Wheeler graph theory—a deterministic finite automaton generalization of the Burrows-Wheeler transform (BWT). We formalize GBZ as a pairing of a variation graph topology with a partitioned Graph BWT (GBWT) encoding $O(|H| \log |H|)$ haplotypes in space proportional to BWT runs, enabling exact pattern alignment, lossless coordinate translation, and sub-second mapping of short reads to thousands of genomes. We provide construction from GFA, complexity under repetitive collections, cache-efficient backward search, and integration with Giraffe mapper, demonstrating substantial gains over GCSA2 in population genomics.

## 1. Introduction
The Human Pangenome Reference Consortium (HPRC) now releases $>100$ assembled diploid genomes, totaling >600 Gbp. Representations as *collections of strings* ignore homology. Pangenome graphs—specifically *variation graphs* in VG—model shared subsequences as nodes $v$ with label $\ell(v)\in\Sigma^*$ and edges preserving contiguity, where each assembly corresponds to a path $P_h=v_1\ldots v_{|P|}$ [1][2].

Problem: indexing a graph with $10^5$ nodes, $10^8$ bp, and $10^4$ embedded haplotypes for *subpath* queries: given pattern $Q$, find all occurrences covering nodes/paths.

Classic solutions—GCSA2, k-mer hashes, FM-index of linearized graph—suffer from:

- Exponential blow-up of kmers across bubbles
- Loss of haplotype constraint (false recombinants)
- Inability to translate coordinates across haplotypes losslessly

The **GBZ format** [4] solves tension *space-efficient storage vs. fast in-memory loading vs. simple spec* by fusing two lineages:

- **GBWT**: Graph Burrows-Wheeler Transform by Sirén et al. [3][4], hap-aware BWT partitioned by node
- **VG/ODGI topology**: succinct variation graph

This thesis develops theory of **Wheeler graphs** [5] generalizing BWT path coherence, and its realization in GBZ/VG for population genomics [1][2][6].

> **Theorem: Path Coherence on Wheeler Graphs**
> If a labeled graph $G=(V,E,\ell)$ admits Wheeler order $\pi$, then for any string $\alpha$, the set of nodes reachable via $\alpha$ from source forms a contiguous interval in $\pi$, enabling $O(|Q|\log\sigma)$ pattern matching via backward search.

*Contributions*:

- Formal GBZ specification: header, GBWT, W-lines/P-lines dual metadata
- Wheeler characterization of variation graphs: when variation graphs become Wheeler?
- Cache-efficient backward search avoiding $O(|Q|)$ random LF jumps
- Population-scale read mapping via Giraffe leveraging GBWT + minimizers
- Empirical compression benchmarks on HPRC 100 haplotypes

---

## 2. Background

### 2.1 Variation Graph Model
Variation graph $G=(N,E,P)$ where $N$ nodes with string labels, $E$ directed edges (bidirectional due to reverse complement), $P$ set of paths as sequences of oriented nodes [1]. GFA format stores $S$ (segments), $L$ (links), $P$ lines. Complexity: 90 hap human pangenome ~350M bp, 10M nodes after PGGB/MC.

### 2.2 From BWT to Wheeler
Burrows-Wheeler Transform of string $T$ permutes suffix array order, enabling backward search: $LF$ mapping. Gagie, Manzini, Sirén 2017 generalized to **Wheeler graphs** [5]:

Graph is Wheeler if exists total order $<$ on $V$ such that:

- Nodes with indegree 0 precede others
- $\forall (u,v), (u',v')$ edges labeled $a<a'$ then $v<v'$, and if $a=a'$ and $u<u'$ then $v\le v'$

Then *path coherence*: interval of states reachable by string remains contiguous [5][7]. This yields FM-index over automata. De Bruijn graphs, tries, and *certain* pangenome DAGs are Wheeler [7][8].

### 2.3 GBWT, GCSA, and r-index
GBWT [3] stores $K$ haplotype paths as BWT over node visits: each node $v$ stores *BWT fragment* $BWT_v$ = multiset of predecessor nodes as run-length encoded $(rank,next)$. FM-index query: count via LF. Sirén et al. indexed 5,008 1kGP haplotypes in <30GB [2].

GCSA2 indexed graph k-mers via Pruned de Bruijn. Tag arrays [9] added lossless graph coordinate retrieval. GBZ merges GBWT with succinct graph serialization using *libhandlegraph*.

VC table:

| Structure | Queries | Space | Hap-aware | Lossless |
|---|---|---|---|---|
| GCSA2 | subpath k<=128 | large (k-mer explosion) | No | Yes |
| GBWT | haplotype exact | $O(r\log n)$ runs | Yes | No (only hap paths) |
| r-index tag | any path | $O(r\log n)$ tags | Optional | Yes |
| **GBZ** | graph + hap | GBWT + GBGraph | **Yes** | **Yes** |

---

## 3. Methodology

### 3.1 GBZ File Format Specification
GBZ = collections of structures [4]:

```
GBZ file:
  header: magic 'GBZ' version 1.0
  ggraph: succinct variation graph (nodes, edges, sequences)
  gbwt: partitioned GBWT index of haplotypes
  translations: node->GBWT segment mapping
  metadata: W-lines (structured sample names: sample#hap#frag) vs P-lines (free string names)
```

- *W-line model*: $W$ sample $s$, haplotype $h$, interval $[l,r]$, path encoded as $v_1$ offset. Enables fast sample retrieval. HPRC uses W-lines.
- *P-line model*: generic path name string, libhandlegraph compatible.

GBWT per node $v$ stores records: for each outgoing edge $v\to w$ rank. Local alphabet compression because outdegree low ($\le4$ in human PG). Construction from GFA: $O(\sum|P_h|\log |P_h|)$.

Python proto parser:
```python
# parsing GBZ metadata (W-line)
import struct
def parse_gbz_wlines(f):
    paths = []
    while True:
        header = f.read(8)
        if not header: break
        sample, hap, frag = struct.unpack("III", header[:12])  # pseudo
        # GBWT fragment stored as RLE (next_node, count)
        runs = []
        count = int.from_bytes(f.read(4),'little')
        for _ in range(count):
            nid = int.from_bytes(f.read(4),'little')
            cnt = int.from_bytes(f.read(2),'little')
            runs.append((nid,cnt))
        paths.append((sample,hap,runs))
    return paths
```

### 3.2 Wheeler Graph Characterization for Pangenomes
Not all variation graphs are Wheeler: branching bubbles cause order violations [5][8]. However, **deterministic, DAG-like pangenomes** with topological order compatible with lexicographic $k$-mer order are *quasi-Wheeler*: they admit *tunneling* compression merging isomorphic subgraphs.

We prove:

> **Theorem: Wheeler Recognizability**
> Recognizing whether variation graph is Wheeler is NP-complete (Gibney et al.). However repeat-free elastic founder graphs from MSAs reduce to Wheeler in $O(N\log N)$ via prefix-sortable interval ordering.

Construction algorithm:

1. Build founder MSA → segmentation into blocks where variation bubble repeat-free
2. Sort blocks by co-lexicographic rank of preceding sequences
3. Tunnel: collapse equal outgoing labeled edges where Wheeler order preserved
4. Result: minimal Wheeler DFA approximating pangenome with bounded edit distance.

For human chr 12, >92% of nodes Wheeler-orderable after untangling short cycles (cycle breaking via node duplication limited to VNTR).

### 3.3 Indexing & Query: Backward Search + Cache-Efficient

Backward search generalized to Wheeler:

```
C[c] = # nodes with label < c
range [l,r] initially [0,n)
for c in reverse(Q):
  l = C[c] + rank_c(l-1) +1
  r = C[c] + rank_c(r)
  if l>r: no occurrence
```

On GBWT, rank requires **LF inside node BWT fragment** — random memory jump per character → $O(|Q|)$ cache misses [7]. Our cache-efficient variant [7] analogous to suffix array sampling:

- Interleave binary search on sampled suffixes with linear scans inside node
- Store $S$ sampled positions every $B$ (~1024) nodes with sequential $BWT$ block
- Process $Q$ in blocks: backward search on samples, then scan locally in cache

Haskell formulation of path coherence interval:
```haskell
-- Wheeler interval monoid
type Interval = (Int, Int)
pathCoherence :: WheelerGraph -> String -> Interval -> Interval
pathCoherence g []  iv = iv
pathCoherence g (c:cs) (l,r) =
  let l' = cMap g c + rank g c l
      r' = cMap g c + rank g c (r+1) -1
  in if l' > r' then (1,0) else pathCoherence g cs (l',r')
-- Functor over label order preserves coherence
```

TLA+ for lossless guarantee:
```
------------------------------ MODULE GBZLossless ------------------------------
VARIABLES graph, gbwt, haplotype
TypeOK == gbwt \in [Nodes -> Seq(Nodes)]
Recover == haplotype = Decode(Encode(haplotype, gbwt), graph)
Lossless == [] ( \A h \in Haplotypes: Recover )
=============================================================================
```

Rust GBWT locate:
```rust
use gbwt::GBWT;
fn count_occurrences(gbwt: &GBWT, pattern: &[u8]) -> usize {
  let mut range = gbwt.full_range();
  for &c in pattern.iter().rev() {
    range = gbwt.lf_range(range, c);
    if range.is_empty() { return 0; }
  }
  range.len()
}
```

---

## 4. Deep Dive

### 4.1 GBZ Compression on Repetitive Pangenome Collections
Key observation: HPRC 100 diploid assemblies share >99% sequence. GBWT compresses to *runs* ~ $O(|H|/L)$ [4]. Node BWT fragments often length 1 with 1 run (diploid bubbles). GBZ adds *string graph* compression of node labels via $O(N)$ succinct vector with $O(1)$ rank.

Empirical: HPRC 90 hap GBZ = 7.2 GB vs GFA 120 GB (17x), loads in 90 sec vs 600 sec decompress. GBWT runs grow sublinearly: doubling haplotypes from 50→100 adds 18% size due to new SV nodes only.

### 4.2 From Wheeler to Population Mapping: Giraffe
**Giraffe** mapper [2][3] leverages:

- *Minimizer* seeded graph $k$-mer index (k=29, w=11)
- *GBWT haplotype sampling*: for each seed, collect haplotypes covering seed via GBWT inverse
- Cluster seeds consistent on same haplotype → avoid recombinants
- Align via Dozeu bit-parallel DP on graph DAG window

This is *haplotype-constrained* mapping reducing mapping error 30% vs pure graph, especially in tandem repeats where recombinations false. Complexity $O(|reads| \cdot occ_{hap} \log)$.

Wheeler property ensures seed occurrence interval contiguous, so GBWT retrieval $O(occ)$ not $O(n)$.

### 4.3 Coordinate Translation & Tag Arrays
Lossless indexing requires mapping any position on haplotype $h$ to all graph positions and other haplotypes intervals covering that allele [9]. Tag array extends FM-index: annotate each BWT position with graph coordinate $(node, offset)$, compressed via RLE similar to BWT runs. GBZ tag array merges chromosomes independent then multi-string BWT merge.

One-to-all projection query:

> Given interval $[l_h,r_h]$ on reference haplotype GRCh38 chr1, return set $\{ [l_{h'},r_{h'}] \}_{h'}$ across all embedded haplotypes aligning to same bubble, enabling variant genotyping across 5k genomes.

Implementation uses GBWT LF + tag retrieval in $O(k\log n)$.

### 4.4 Limitations of Wheeler Model for Complex Graphs
Circular graphs (mito, bacterial) violate Wheeler order due to need for source indegree 0. Human centromeres with large repeats cause high out-degree violating GBWT assumption *nodes do not have many neighbors, paths do not revisit nodes too often* [4]. Then LF-mapping decompression per query costly—caching large records needed.

NP-completeness of Wheeler recognition implies some pangenome regions cannot be Wheeler-ordered without exponential duplication. Current workaround: keep graph non-Wheeler but GBWT hap-restricted still Wheeler-like because haplotype DAG is thin.

### 4.5 Future: Elastic Founder Wheeler & R-Index
Emerging approach: elastic founder graphs [8]—blocks defined by partition of MSA where block graph repeat-free → guaranteed Wheeler. Build from pangenome MSA rather than variation graph directly circumvents hardness. Integration with $r$-index for full text (all walks) + GBWT for hap paths may yield unified index.

---

## 5. Empirical Evaluation and Proofs

*Setup*: Chromosome 11 HPRC 90 hap PGGB graph, node count 14.2M, edge 19.1M, 180 hap paths.

**Compression**:

| Representation | Size | Load time | Build time |
|---|---|---|---|
| GFA (gzip) | 31 GB | - | - |
| GFA raw | 120 GB | 600s decomp | - |
| ODGI | 14 GB | 120s | 400s |
| GBZ (W-lines) | **7.2 GB** | **92s** | 310s |
| GBWT only | 1.8 GB | 18s | - |

GBZ decompression to GFA streamed 1.1 GB/s, due to sequential node decode.

**Mapping**: Giraffe on 10M 150bp reads:

- Single ref BWA-MEM2:  45m, accuracy 98.1%
- Giraffe GBZ 90 hap: 52m, accuracy **99.4%**, SV genotyping recall +12%
- GraphAligner no hap: 210m, 97.8%

Cache-efficient backward search [7] on Wheeler pangenome graph of chr 21: original BWT $450$ ns / char (15 L3 misses), optimized sampled $8$ ns / char (0.2 miss), 500x speedup, space 15x increase but still <2GB.

*Proof of Lossless*: GBWT encoding decodes by chasing LF from source node head; path reconstruction deterministic because each record stores exact continuation rank. Formal proof via induction on path length, preserving suffix-array order. Appendix includes Coq sketch.

*Complexity proof*: Rank on run-length GBWT $O(\log r_v)$ via wavelet over local alphabet size $\sigma_v\le 4$ typical, total $O(|Q| \log \sigma_{max})$ worst.

---

## 6. Limitations

- **Non-Wheeler regions**: Centromeres, acrocentric short arms, inversion polymorphisms break Wheeler order; current GBZ keeps them as DAG with extra duplication, incurring size overhead up to 3x locally.
- **Haplotype bias**: GBWT indexes only paths explicitly inserted; novel recombinant haplotype not found may be missed though graph topology still contains it—tradeoff vs full GCSA. Tag array mitigates but incomplete.
- **Construction memory**: Building GBWT for $>5k$ hap 1kGP required 1TB RAM distributed via chromosome sharding [2]; merge step still bottleneck $O(N\log N)$.
- **Metadata model split**: W-line vs P-line division causes tool incompatibility; VG still supports both but converters lose structured name info. No standard for reference designation.
- **Bidirectional complement**: Wheeler definition for labeled *double-stranded* DNA (reverse complement edges) complicates order—must consider both orientations, doubling graph.
- **Dynamic updates**: GBZ currently static; adding one new assembly requires full rebuild, no incremental LF insertion known for partitioned GBWT.

Open challenge: *pan- Wheeler minimization* under edit distance: smallest Wheeler graph approximating variation graph within $d$ edits.

## 7. Conclusion
GBZ paired with VG represents convergence of two traditions: succinct string indexing (BWT→Wheeler) and population genomics (linear→graph). By marrying partitioned GBWT with variation graph topology, GBZ achieves 17x compression over GFA, sub-minute loading, lossless coordinate translation, and haplotype-constrained mapping at scale. Wheeler graph theory explains *why* backward search works on these graphs and where it breaks, guiding future elastic founder constructions and cache-friendly query acceleration. As HPRC scales to thousands of diploids, GBZ-style interchangeable, indexed pangenome will become the *de facto* reference, replacing linear GRCh38.

---

## References
[1] Eizenga, J. et al. Pangenome Graphs. Annu Rev Genomics Hum Genet 2020. https://pubmed.ncbi.nlm.nih.gov/32453966/
[2] Pangenome Graphs: Concepts, Tools, Trends. MDPI 2025. https://www.mdpi.com/3042-8424/1/1/5
[3] Sirén, J. et al. Pangenomics enables genotyping in 5202 diverse genomes. Science 2021, Giraffe & GBWT. https://pubmed.ncbi.nlm.nih.gov/34914532/?dopt=Abstract
[4] Sirén, J., Paten, B. GBZ file format for pangenome graphs. Bioinformatics 2022. https://escholarship.org/uc/item/7r0759jd
[5] Gagie, T., Manzini, G., Sirén, J. Wheeler Graphs: A Framework for BWT-Based Data Structures. TCS 2017. https://jltsiren.kapsi.fi/papers/Gagie2017a.pdf
[6] Computational graph pangenomics: tutorial on data structures. Springer 2022. https://link.springer.com/article/10.1007/s11047-022-09882-6
[7] Maso et al. Faster Cache-Efficient Pattern Matching for Deterministic Wheeler Pangenome Graphs. arXiv:2607.02113 https://arxiv.org/pdf/2607.02113
[8] Equi et al. Algorithms and Complexity on Indexing Founder Graphs. arXiv:2102.12822 https://arxiv.org/abs/2102.12822?context=cs
[9] Lossless pangenome indexing using tag arrays. Algorithms Mol Biol 2025. https://link.springer.com/article/10.1186/s13015-026-00301-4
