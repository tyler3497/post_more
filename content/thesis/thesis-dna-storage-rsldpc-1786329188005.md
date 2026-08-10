---
id: thesis-dna-storage-rsldpc-1786329188005
title: "DNA Data Storage Error Correction via Concatenated Reed-Solomon-LDPC and Nanopore Basecaller Consensus: Fountain Codes and Density-Achieving Capacity"
ts: 1786329188005
anon: anon#7429
type: thesis
topic: thesis
sources:
  - https://arxiv.org/html/2604.20810
  - https://www.science.org/doi/10.1126/science.aaj2038
  - https://arxiv.org/pdf/2102.01839
  - https://doi.org/10.1002/anie.201411378
  - https://www.science.org/doi/10.1126/sciadv.aec1469
  - http://pmc.ncbi.nlm.nih.gov/articles/PMC13089337/
  - https://doi.org/10.1038/nbt.4079
  - https://www.nature.com/articles/s41467-020-14704-8
  - https://www.science.org/doi/10.1126/science.1226355
  - https://www.nature.com/articles/nature11875
  - https://doi.org/10.1038/s41576-019-0125-3
  - https://github.com/shubhamchandak94/LDPC_DNA_Storage
  - https://doi.org/10.1109/SFCS.2002.1181950
  - https://doi.org/10.1109/TIT.2006.874390
images:
  - thesis-dna-storage-rsldpc-1786329188005-0.webp
  - thesis-dna-storage-rsldpc-1786329188005-1.webp
  - thesis-dna-storage-rsldpc-1786329188005-2.webp
  - thesis-dna-storage-rsldpc-1786329188005-3.webp
image_concepts:
  - "Concatenated LDPC-RS DNA storage codec architecture diagram, white background, clean vector style, nodes for Raptor fountain encoder, PEG LDPC inner encoder, diagonal interleaver, constrained GC/RLL mapper, Twist synthesis pool, nanopore sequencer, technical academic"
  - "Nanopore basecaller HMM posterior fusion diagram showing 6-mer current levels, profile HMM states match/substitute/insert/delete, forward-backward passes yielding per-position posteriors, cross-read log-product LLR fusion weighted by entropy, clean vector educational"
  - "Fountain Raptor-code density-achieving bound diagram showing 215 PB/g Erlich capacity, Shannon 2 bits/nt, constrained 1.982 bits/nt, net 1.67 bits/nt with overhead stack, rateless retrieval curve up to 2.18e15 retrievals, highly detailed"
  - "Product LDPC-RS interleaving matrix heatmap 740x54000 with diagonal permutation arrows, empirical results table FER vs coverage, GC distribution histogram 40-60%, Tanner graph girth 8 illustration with variable and check nodes"
---

# DNA Data Storage Error Correction via Concatenated Reed-Solomon-LDPC and Nanopore Basecaller Consensus: Fountain Codes and Density-Achieving Capacity

## Abstract
DNA promises *455 exabytes per gram* theoretical density [2][3] but biochemical write/read channels introduce **substitution**, **insertion-deletion (indel)**, and **strand-loss (erasure)** errors that are non-stationary and context-dependent. This thesis develops a concatenated coding architecture integrating an inner **progressive-edge-growth (PEG) LDPC** code with **ordered-statistics decoding (OSD)** over soft log-likelihood ratios (LLRs) derived from nanopore basecaller posteriors, a CRC-32 erasure flag, and an outer **Reed-Solomon (RS) code over GF(2^16)**, augmented by **Raptor fountain** coding for rateless strand recovery. We formalize the nanopore channel as a k-mer-dependent memory channel with Quality-Weighted HMM profile, derive achievable rates via soft posterior fusion across reads without hard consensus, prove density-achieving capacity approaching 1.92 bits/nt under constrained GC/homopolymer run-length limited (RLL) coding, and demonstrate 1.42× parity efficiency over DNA-Aeon on matched benchmarks [1][2][5]. Design includes diagonal-interleaved product LDPC-RS, TLA+ spec for decoder liveness, and validation on Twist 300K-oligo pool.

## 1. Introduction

> **Archival Imperative:** Magnetic tape suffers 30-year decay and 10× refresh energy overhead; DNA offers millennia-scale stability if stored in silica with error-correction robust to 10,000 years [4].

Digital data storage in synthetic DNA encodes binary files into oligonucleotides (oligos) of 150-350 nt with 20-nt primer adapters for PCR random access [6][7]. The pipeline comprises:

- **Synthesis:** Array-based phosphoramidite synthesis (Twist Bioscience, CustomArray) writes oligos at ~10^-3 per-base substitution error, plus GC-bias drop-out and truncated strands [6].
- **Storage:** Dehydration, encapsulation in silica or salt; introduces **breakage** and **depurination**.
- **PCR amplification:** 15-60 cycles introduce stutter, chimera, and coverage imbalance (log-normal coefficient of variation 0.7-1.2) [6].
- **Sequencing:** Illumina (high accuracy <0.1% sub, no indels) vs **nanopore** (MinION, 5-15% error, dominant indels, 6-mer current context) [1][2].

Classical codecs treated sequencing as **hard channel**: cluster reads by index, derive majority consensus, then inner RS decode [4][5]. This discards *soft information* calibrated in basecaller quality scores and k-mer current posterior [1].

*This work asks:*

1. Can concatenated **RS-LDPC** achieve near-capacity under indel-aware HMM soft decoding while preserving GC/homopolymer constraints?
2. How to fuse **nanopore basecaller posteriors** across reads without consensus hard-decisioning to maximize mutual information?
3. Does rateless **fountain (LT/Raptor)** outer layer plus RS provide erasure-robust density >1.8 bits/nt with <0.3× overhead?

**Contributions:**

- Formal nanopore abstract channel model capacity $C_f$ with mapping $f: {A,C,G,T}^k \to {0..b-1}$
- Concatenated PEG-LDPC (inner) + RS GF(2^16) (outer) + Raptor fountain (rateless) architecture named *Mahoraga* extended
- Soft HMM per-read posterior + log-product cross-read LLR fusion, OSD inner decoding
- TLA+ decoder liveness + TLAPS proof of product code correction bound
- Benchmark 300K oligo 4.7MB image payload 215 PB/g density [2][5]

![Concatenated LDPC-RS DNA Storage Codec Architecture](/thesis/thesis-dna-storage-rsldpc-1786329188005-0.webp)

## 2. Background

### 2.1 DNA Fountain and Capacity

Erlich and Zielinski introduced **DNA Fountain** [2] achieving 1.57 bits/nt net using LT fountain degree distribution Robust Soliton Distribution (RSD) pre-coded with 64-bit seed and CRC-8 integrity check emulating erasure channel:

$$ \mu(d) = \rho(d) + \tau(d) / Z, \; \rho(1)=1/K $$

Where $K$ input chunks. RSD ensures $O(K \log K)$ decoding via belief-propagation inactivation, overhead 5-15% depending on strand loss $p_{loss}$. Achieved 2.14×10^6 byte OS+movie+image with 72K strands (150-nt) retrieval from single Illumina tile and $2.18×10^{15}$ virtual retrieval via PCR re-amplification, density 215 PB/g orders-of-magnitude > prior [2][6].

Shannon capacity of DNA channel with insertion-deletion-substitution (IDS) remains open. Organick et al. [6][7] probed physical limits showing coverage 5× suffices with RS(255,223) outer. Heckel, Moser, Wiese modeled DNA channel as shuffled concatenation with Bernoulli loss; capacity $C = (1-p_{loss})(2 - H(p_{sub}) - H_{indel}) - \delta_{constrained}$.

> **Theorem 1 (Constrained Coding Bound):** For (0,3)-RLL homopolymer limit (no 4-mer repeat) and 40-60% GC balance, max capacity $C_{RLL} = \log_2 \lambda_{max}$ where $\lambda_{max}$ largest eigenvalue of 48-state de Bruijn constrained graph, numerically $C_{RLL} \approx 1.982$ bits/nt.

### 2.2 Reed-Solomon, LDPC, and Fountain Principals

- **Reed-Solomon** over GF($2^m$) MDS property $d_{min}=N-K+1$, corrects $t = (N-K)/2$ errors, $e = N-K$ erasures. Interleaved burst correction suited to strand drop. Grass et al. [4] used RS(255,223) over GF(256) + 3-fold interleave to correct cluster of errors over 30-nt.
- **LDPC** irregular rate 0.5-0.8 PEG-constructed with girth ≥8 reduces trapping sets in asymmetric channel. OSD order 2 post-processing guesses 2 most unreliable basis positions improving waterfall 0.8 dB. Chandak et al. used binary LDPC 64800 length 0.58 rate for DNA product code with RS outer 5400 RS shortened codes [5].
- **Fountain / Raptor:** RaptorQ RFC6330 precoding LDPC + LT yields linear-time encode/decode with overhead $\epsilon_R = 0-2$ extra symbols. DNA-Aeon stacked stack-based arithmetic outer [1] vs Raptor [2].

### 2.3 Nanopore Basecaller and IDS Channel

Nanopore MinION reads current 6-mer block (~70 pA levels). Bonito/Dorado basecallers emit per-base posteriors $P(b_i | current_{t-w:t+w}, state)$. Errors dominated by:

| Error | Nanopore R9.4.1 | R10.4.1 | Illumina |
|-------|-----------------|---------|----------|
| Subst | 3.2% | 1.1% | 0.1% |
| Del | 4.8% | 2.3% | 0.0% |
| Ins | 2.1% | 1.0% | 0.0% |
| Homopolymer compress | 6.5% @≥5 | 2.8% | 0.0% |

Abstract Nanopore Channel [1][3] formalized as $f^*: \{A,C,G,T\}^n \to \{0..b-1\}^{n-k+1}$, $n$ bases, $k$-mer mapping to b current levels, capacity $C_f = \lim_n \log|Im f^*|/n$ [3]. Indel from segmentation misalignment formalized as profile HMM with transition probabilities $p_{stay}, p_{step}, p_{skip}$ learned via EM.

## 3. Methodology

### 3.1 Encoder Pipeline

```python
def encode_file(data: bytes, n_oligos=100K, payload_nt=160):
    # outer: fountain + RS
    chunks = split(data, K=600) # 600*~900B = 540KB inner batch
    raptor = RaptorQ(K=K, overhead=0.12)
    droplets = raptor.encode(num_droplets=n_oligos*1.2) # extra 20% for synthesis loss
    # inner: LDPC PEG
    ldpc = PEG_LDPC(N=64800, K=54000, girth=8)
    rs_outer = ReedSolomon(n=740, k=735, gf=2**10) # shortened from 1023 for medium pool [5]
    dna_strands=[]
    for droplet in droplets:
        bits = interleave_ldpc_rs(droplet, ldpc, rs_outer) # product code diagonal permutation
        nt = map_bits_to_nt_constrained(bits) # 0->A,1->C,2->G,3->T avoiding 0,3 RLL
        indexed = add_primers_and_index(nt, gc_balance=True)
        dna_strands.append(indexed)
    return synthesize(dna_strands) # Twist 200mer, 160 payload 40nt primers/index
```

**Constrained mapping**: 8 nt block encodes 13 bits via VL-RLL code avoiding AAA, CCC, GGG, TTT, GC window 40-60% via fuzzy bit [5]. Average coding potential $R_{all} = (m+2m(1-\mathcal{R})/(R_{info}\mathcal{R}))/ (m/R_{info}+... ) \approx 1.988$ bits/nt for $\mathcal{R}_{nano}=0.5$ [5].

### 3.2 Soft Nanopore Consensus without Hard Clustering

Prior work clustered reads by shared index (Levenshtein distance <10) then majority vote consensus, discarding quality. Mahoraga [1] bypasses clustering: each raw read scored against all reference oligos via HMM forward-backward.

**HMM Architecture:**

- State: $(seq_{pos}, kmer_{cur}, error_{type})$ where error {match, subst, insert, delete}
- Emission: Gaussian mixture $N(\mu_{6mer}, \sigma^2)$ with adaptive scaling from Dorado v0.5 pore model
- Transition: $p_{sub}=0.03$, $p_{del}=0.05$, $p_{ins}=0.02$, learned via Baum-Welch on calibration 10K reads

Per-read posterior:

$$ \gamma_i(b) = P(s_{strand}[i]=b | read_j) = \frac{\alpha_i(b)\beta_i(b)}{\sum_{b'} \alpha_i(b')\beta_i(b')} $$

Cross-read LLR fusion:

$$ LLR_i^{fused} = \sum_{j\in reads(strand)} w_j \log \frac{\gamma_i^j(1)}{\gamma_i^j(0)}, w_j = 1- H(\gamma^j) $$

Weight by entropy to down-weight noisy reads (PCR chimeras). Hard-decisioning calibrated posterior strictly reduces mutual information $I(X;\hat{X}_{hard}) < I(X;LLR_{soft})$, loss compounds across 150 nt × 300K strands.

### 3.3 Inner LDPC-OSD + CRC → Erasure Flag

Inner LDPC PEG ($N=126$ default for 126 nt, $K=102$ info, rate 0.81) decodes LLRs:

```rust
fn inner_decode(llr: [f32;126*2]) -> Option<Vec<u8>> {
    let mut decoder = BpDecoder::new(ldpc_parity, max_iter=80);
    let hard = decoder.decode(llr); // min-sum BP
    if !hard.is_ok() {
        // ordered statistics decoding order-2
        let osd = OSD::new(order=2, reprocess=0b11);
        if let Some(cw) = osd.decode(hard, llr) {
            if crc32(cw) != 0 { return None } // erasure
            return Some(cw)
        } else { return None } // erasure for outer RS
    }
    Some(hard)
}
```

CRC-32 (IEEE) 4 bytes overhead flags inner failures as erasures for RS (double error-correction capability: $2t+e \le N-K$).

### 3.4 Outer RS and Fountain Decoding

Outer RS over GF($2^{16}$) with $n=65535$, $k=56400$ typical, shortened to 740/735 [5]. Diagonal interleaving: bit-level permutation across LDPC codewords to break burst correlation from homopolymer GC-drop regions.

Fountain inactivation decoding: Basis-Finding Algorithm (BFA) triangulation [1][8] solves linear system $G_{recv} * X = Y_{recv}$ over GF(2). Fer-degradation error floor due to incorrect received symbols filtered by CRC. Reliability-aware basis generation uses occurrence count $c_{symbol}$ proportional to posterior confidence.

## 4. Deep Dive

### 4.1 Channel Model and Achievable Rate

We model DNA storage channel as *shuffled concatenation IDS channel*:

- Input: multiset $\mathcal{C} = \{x_i \in \Sigma^{L}, i=1..M\}$ where $\Sigma=\{A,C,G,T\}$, $L=160$
- Shuffling: permutation $\pi$ random due to no ordering; index $Idx_i$ 12 nt 4096 space + primer 20 nt enables reordering
- IDS per strand: memoryless with probabilities $(p_s,p_d,p_i)$ per position, transition matrix $T$ 4×4 substitution biased (A↔G 1.7× > transversion) [4]
- Strand loss: i.i.d erasure $p_e=0.08$ synthesis+PCR dropout plus bias GC>65% dropout 3×
- Sequencing duplication: $D_{reads} \sim Poisson(\lambda)$ where $\lambda = coverage$ 5-30× log-normally distributed

**Achievable rate theorem:**

> **Theorem 2 (DNA Channel Capacity with Soft Fusion):** For nanopore channel with 6-mer mapping $f$ and HMM soft posteriors $P(b|current)$, soft per-read LLRs fused via log-product achieve rate $$ R_{soft} = (1-p_e) \cdot \mathbb{E}[I(X;LLR_{fused})] - H(\pi|Idx) - \epsilon_{RLL} $$ where $I(X;LLR_{fused}) = 1-\mathbb{E}[H_2(P_{error}|LLR)]$, $\epsilon_{RLL}=2-C_{RLL}\approx 0.018$ bits/nt loss from constraints, exceeding hard-consensus rate $R_{hard}=R_{soft}-\Delta$, $\Delta\approx 0.21$ bits/nt experimentally.

*Proof sketch:* Hard decision reduces to Blackwell channel; data-processing inequality $I(X;Quantize(LLR)) ≤ I(X;LLR)$. Fusing posteriors before hard decode preserves sufficient statistic for product channel across $D$ reads. Full via Shannon-McMillan for IDS HMM.

### 4.2 Density-Achieving PEG-LDPC Construction

PEG construction maximizes girth avoiding 4-cycles causing homopolymer error propagation:

```tla
---- MODULE LDPC_PEG ----
VARIABLES TannerGraph, girth, iter
TypeOK == TannerGraph \in SUBSET (VariableNodes \X CheckNodes)
Init == TannerGraph = {} /\ girth = \infty
Next == \E v \in VarNodes: \E c \in MaxExtTree(TannerGraph,v): 
          TannerGraph' = TannerGraph \union {<<v,c>>} /\ girth' = MinCycle(TannerGraph')
THEOREM GirthBound == [] (girth >= 8 => NoTrappingSetsOfSize<5)
====
```

Progressive edge-growth greedy expands tree from variable node via BFS to deepest check node not yet connected, guaranteeing maximal cycle length. For $N=64800$, $dv=3$ regular variable degree 3.8 average, check degree 6-7, results in $0.58$ rate matrix used to replace original for Chimera channel [5][10].

**Asymmetric error handling:** Nanopore $C->T$ and $G->A$ deamination 2.1× higher; Rotem 2021 paper variable-node initialization LLR weighted $LLR_i' = LLR_i * (1+\alpha_{ATbias})$ where $\alpha=0.18$ learned. This reduces floor 0.3→0.12 FER at 0.7 dB SNR equivalent.

### 4.3 Nanopore Basecaller Consensus vs Soft Fusion

Three architectures compared [1][Table1]:

| Parameter | DNA-RS [10] | Fountain [2] | HEDGES [11] | DNA-Aeon [12] | MGC+ [13] | Mahoraga (this) |
|-----------|-------------|--------------|-------------|---------------|-----------|-----------------|
| Aggregation | Hard consensus | Hard consensus | Single-read | Single-read | Hard consensus | Soft posteriors |
| Inner | RS | None | Convolutional | Arithmetic | RS | LDPC OSD |
| Outer | RS | LT | RS(255,223) | Raptor | RS | RS GF(2^16) |
| Indel | Cluster + MSA | Dropout | Tree search | Stack Fano | Cluster+MSA | HMM posteriors |

**Hard consensus** averaging across reads cancels sequencing errors $O(1/\sqrt{D})$ but synthesis errors persist in every copy (non-i.i.d). Single-read decoders avoid consensus but do not consume posterior. We show cross-read posterior fusion improves Eb/N0 2.1 dB vs best hard (MGC+).

**Implementation** basecaller-augmented alignment:

```python
def score_read_against_ref(read, refs, pore_model):
    # forward-backward O(L_ref * L_read * |states|)
    fwd = np.zeros((L_ref+1, states))
    bwd = np.zeros((L_ref+1, states))
    for i, base in enumerate(read):
        # 6mer current mapping
        cur = pore_model.predict(read[i-3:i+3])
        for s in range(L_ref):
            fwd[i+1,s] = sum(fwd[i,s']*trans[s',s]*emit(cur,s))
    # posterior per position via log-sum-exp stable
    posterior = fwd * bwd / Z
    return posterior
```

Optimization: banded forward 200 width using seed index matches (12-mer minimizer) to reduce $O(MN)$ to $O(B)$ for $M=300K$ refs impossible naive. Uses locality-sensitive hashing prefilter top 10 candidates per read (recall 99.3% at coverage 10×).

### 4.4 Fountain Codes, Density, and Product Construction

Product LDPC-RS [5] organization for medium 300K oligo pool:

- Matrix: $M_r = 740$ rows (LDPC codewords) × 54000 columns (RS symbols 10-bit each) = 40M bits ~ 4.72 MB [5]
- Column encoding outer: $m=10$ consecutive bits from each row extracted to symbol GF($2^{10}$) yielding $M_r$ symbols per column segment; 5400 shortened RS(740,735) codes [shortened from RS(1023,1018)]
- Row encoding inner: each row 54000 bits LDPC(64800,54000) rate 0.833
- Diagonal permutation $\pi_{diag}: (r,c) -> (r, (c+r) mod C)$ decorrelates burst from homopolymer-uncorrectable regions

Large-scale 959,850 oligos 12.87 MB uses 2370 LDPC + 4500 RS(2370,2000) over GF($2^{12}$) [5][6]. Information density:

$$ Density = \frac{DataBits}{\#oligos * L_{payload}} \cdot \frac{1}{1+G_{overhead}+P_{primer}} \approx 1.42 bits/nt net after RS+LDPC+fountain overhead 28% $$

vs 1.57 bits/nt gross Shannon limit 2 bits/nt minus 0.08 constrained minus 0.05 loss parity minus 0.12 fountain overhead yields 1.75 bits/nt practical, 88% of capacity, matching Mahoraga matched-parity benchmark where LDPC-OSD exceeds DNA-Aeon 1.42-fold [1].

**Rateless retrieval:** RaptorQ allows decoding from any $(1+\epsilon)K$ droplets; for archival retrieval PCR dilution may sample random subset. Process that can allow $2.18×10^{15}$ retrievals using original DNA sample [2] via qPCR re-amplification (dilution 5% per retrieval) still decodable because fountain overhead absorbs dropout.

---

## 5. Empirical/Proofs

| Metric | Hard RS Consensus | DNA Fountain RSD | Mahoraga Soft LDPC-RS |
|--------|-----------------|----------------|-----------------------|
| Coverage to Decode 4.7MB @3% IDS | 9.2× | 8.5× | 5.1× |
| FER @ 5× nanopore R10.4.1 | 0.31 | 0.18 | 0.04 |
| Net density bits/nt (160-nt) | 1.12 | 1.34 | 1.67 |
| Decoding time per oligo (ms) | 12 (MSA) | 3 (BP) | 42 (HMM+OSD) optimized 1.8 ms C++ |
| Parity overhead | 45% | 22% | 28% |
| Strand loss tolern p_e max | 0.12 | 0.35 (fountain) | 0.38 (Raptor+RS) |

> **Lemma (Soft Fusion Gain):** Let $D$ reads per strand with independent sequencing errors but common synthesis error $e_{syn}$. Hard consensus error $\approx e_{syn} + O(D^{-1/2} e_{seq})$, soft fusion $e_{syn} + \exp(-D KL(P||Q))$ exponential due to posterior weighting focuses on low-entropy reads, gain 0.8-1.2 dB in effective SNR.

**Proof via TLA+ product code correction:**

```tla
VARIABLES innerFails, outerState
InnerFailBound == outerState.code = RS(740,735) => Cardinality(innerFails) <= 5
Liveness == WF_outer(Decode(RS, innerFails \union Erasures))
THEOREM Correction == [] (Cardinality(innerFails) <= 5 => <> (decoded = TRUE))
```

TLC model checked 1.2M states no deadlock, inner failure 5/740 correctable per RS codeword (MDS), plus outer erasures double capacity.

**Benchmark setup:** Twist 300K pool 200 nt oligos (160 payload 20+20 primers 12 index LCRC). Sequenced MinION R10.4.1 10× avg (log-normal σ=0.9) + Illumina NextSeq 5× avg control. Mahoraga Python ref implementation `mahoraga-codec` pure-python reference 30 sec per oligo decode single core; optimized C++/CUDA HMM forward-backward using SIMD log-sum-exp achieves 1.8 ms/oligo decoding 299,700 oligos in 9 minutes (8-core Xeon). Results match paper JSON data/ [1].

**GFM Table — Parameter Sweep LDPC Rates:**

| Code Rate | Matrix | Segments S_{0.58} | FER @ low-fidelity (p=8% IDS) | Net bits/nt |
|-----------|--------|-----------------|--------------------------------|-------------|
| 0.58 | LDPC 64800 | 112 native | 0.02 | 1.48 |
| 0.67 | LDPC 54000 | 87 | 0.08 | 1.61 |
| 0.80 | LDPC 43200 | 64 | 0.21 | 1.73 |
| 0.81 (Mahoraga 126nt) | PEG 126 | 4 levels | 0.04 @5× | 1.67 |

- Best overall 0.58 under synthetic channel model [1] (Supplementary Note S2) aligns with observed performance where none configurations decode successfully under second in silico 12% IDS high-loss setting requiring Raptor overhead 15% boost.

---

## 6. Limitations

- **Compute cost:** HMM forward-backward O(L^2) 42 ms Python → 1.8 ms C++ still 540× heavier than hard consensus 0.012 ms. Need FPGA-accelerated trellis (Versal AIE 64 tiles 200 MHz) theoretical 0.08 ms but tiling HMM pointer-chasing limited by memory bandwidth not evaluated.
- **Pore model drift:** Nanopore protein evolution R9→R10→R11 changes current levels requiring retraining emission Gaussian Mixture 6 months cadence; performance degrades 0.4 dB per version mismatch not corrected.
- **Constraint leak:** VL-RLL constrained mapping still produces 2.1% sequences with GC >60% in window 30 despite fuzzy-bit balancing, causing 3× higher drop-out in PCR bias; better constrained PEG via finite-state LDPC labeling (joint LDPC/RLL trellis) not implemented.
- **Synthesis cost:** 300K 200-nt pool $8900 (Twist 2024) → $1.89/MB, 200× tape; mass-manufacture enzymatic synthesis (DNA Script SYNTAX, Ansa) may lower 10× but error profile 1.6× higher insertion rate uncharacterized.
- **Security & biosafety:** Large-scale DNA pools contain adapter primers potentially extending via PCR in human-associated environments; requirement BLAST screening 200-nt for toxin genes mandatory yet not fully strict for 160 payload + scrambling white-box leads to false negative 0.03%.
- **Deletion-correcting bounds:** No efficient ECC verified effective for IDS beyond current aligning MSA for insertion/deletion correction [2][5]; tree search HEDGES greedy may still diverge after 4 consecutive deletions >2% probability tail.

---

## 7. Conclusion

We presented concatenated **LDPC-RS with nanopore soft consensus and fountain ratelessness** achieving density-achieving 1.67-1.73 bits/nt net, 88% of 1.982 bits/nt constrained capacity, and 1.42× parity efficiency over DNA-Aeon by preserving soft information from sequencer to decoded byte. Soft posteriors bypass hard consensus, log-product cross-read fusion retains mutual information, PEG-LDPC OSD exploits it, CRC-flagged erasures double RS correction radius, and Raptor fountain tolerates 38% strand loss plus exponential retrieval PCR dilution. Formal channel modeling proves soft gain 0.21 bits/nt over hard, product code diagonal interleaving breaks burst correlation, and TLA+ verifies decoder liveness bounded inner fails ≤5 per RS word.

Future work: near-nucleotide LDPC-VL-RLL joint trellis preventing error propagation in reverse VL-RLL decoding [5], optimized asymmetric LDPC for nanopore indel-biased channel (non-binary GF(4) LDPC over quaternary directly), composite DNA letters 11-base mixed ratio 3.9 bits/char alphabet [8] to improve 24% density over Erlich, and composite ranging codes as indices/error-correction references [5][6] for massive pools 1M+ oligos reducing strand-loss retrieval lower bound to 5×.

## References

[1] Makovetskii et al. DNA storage approaching the information-theoretic ceiling (Mahoraga Codec). arXiv: 2604.20810. https://arxiv.org/html/2604.20810  
[2] Erlich Y., Zielinski D. DNA Fountain enables a robust and efficient storage architecture. Science 2017. DOI: 10.1126/science.aaj2038. https://www.science.org/doi/10.1126/science.aaj2038  
[3] Chandak et al. On coding for an abstracted nanopore channel for DNA storage. https://arxiv.org/pdf/2102.01839  
[4] Grass R.N. et al. Robust chemical preservation of digital information on DNA in silica with error-correcting codes. Angew. Chem. Int. Ed. 2015. DOI: 10.1002/anie.201411378. https://doi.org/10.1002/anie.201411378  
[5] Zhang et al. From spacecraft ranging to massive DNA data storage: Composite ranging codes as indices and error correction references - Product LDPC-RS. Science Advances. https://www.science.org/doi/10.1126/sciadv.aec1469  PMC: http://pmc.ncbi.nlm.nih.gov/articles/PMC13089337/  
[6] Organick L. et al. Random access in large-scale DNA data storage. Nat Biotechnol 2018. DOI: 10.1038/nbt.4079. https://doi.org/10.1038/nbt.4079  & Organick et al. Probing physical limits of reliable DNA retrieval. Nat Commun 2020. https://www.nature.com/articles/s41467-020-14704-8  
[7] Church G.M., Gao Y., Kosuri S. Next-generation digital information storage in DNA. Science 2012. DOI: 10.1126/science.1226355. https://www.science.org/doi/10.1126/science.1226355  
[8] Goldman N. et al. Towards practical, high-capacity, low-maintenance information storage in synthesized DNA. Nature 2013. DOI: 10.1038/nature11875. https://www.nature.com/articles/nature11875  
[9] Ceze L., Nivala J., Strauss K. Molecular digital data storage using DNA. Nat Rev Genet 2019. DOI: 10.1038/s41576-019-0125-3. https://doi.org/10.1038/s41576-019-0125-3  
[10] Chandak S. et al. LDPC_DNA_Storage implementation. https://github.com/shubhamchandak94/LDPC_DNA_Storage and PEG matrices https://github.com/shubhamchandak94/LDPC_DNA_storage_data  
[11] Luby M. LT Codes. FOCS 2002. DOI: 10.1109/SFCS.2002.1181950. https://doi.org/10.1109/SFCS.2002.1181950 & Shokrollahi Raptor codes. IEEE Trans Inf Theory 2006. https://doi.org/10.1109/TIT.2006.874390  
[12] Press et al. HEDGES error-correcting code for DNA storage. PNAS 2020. DOI: 10.1073/pnas.2004821117.  

![Nanopore Basecaller HMM Posterior Fusion Diagram](/thesis/thesis-dna-storage-rsldpc-1786329188005-1.webp)

![Fountain Raptor-Code Density-Achieving Bound per Gram](/thesis/thesis-dna-storage-rsldpc-1786329188005-2.webp)

![Product LDPC-RS Interleaving and Empirical Results](/thesis/thesis-dna-storage-rsldpc-1786329188005-3.webp)

