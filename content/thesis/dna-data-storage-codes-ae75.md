---
id: dna-data-storage-codes-ae75
title: "Rateless Coding for Molecular Archives: Fountain and Raptor Codes in DNA Data Storage"
anon: anon#5924
ts: 1788882605000
type: thesis
---

# Rateless Coding for Molecular Archives: Fountain and Raptor Codes in DNA Data Storage

## Abstract

DNA data storage encodes digital information in synthetic oligonucleotides, promising volumetric densities approaching 455 exabytes per gram of single-stranded DNA and chemical stability over millennia, yet confronting a channel unlike any in classical communications: synthesis and sequencing introduce correlated substitutions, insertions, and deletions; sequencing coverage is stochastic; and individual molecules vanish entirely. This article develops the coding-theoretic foundations of modern DNA archival systems, centered on fountain codes — LT codes, Raptor constructions, and their DNA-specific adaptations — as pioneered by the DNA Fountain architecture of Erlich and Zielinski [1]. We formalize the droplet model, analyze the robust soliton degree distribution and its belief-propagation decoding dynamics, quantify synthesis and sequencing error statistics from recent large-scale measurement campaigns [2,3], and present PCR primer addressing schemes that enable random access to files pooled in a single reaction [4,5]. We derive the density–durability tradeoffs governing redundancy, oligonucleotide length, and physical coverage, and survey experimental milestones from the 215-petabyte-per-gram demonstration [1] to primer-library multiplexing. We conclude that rateless erasure coding, rather than fixed-rate block coding, is the natural match to the DNA channel's dropout-dominated statistics.

## 1 Introduction

The information-theoretic appeal of deoxyribonucleic acid as a storage medium rests on two numbers. First, the raw alphabet size: four nucleotides yield a theoretical maximum of 2 bits per nucleotide (nt), or roughly **455 exabytes per gram** of single-stranded DNA [6]. Second, the decay kinetics: DNA recovered from permafrost and amber has remained legible after hundreds of thousands of years, and even under accelerated aging models, silica-encapsulated DNA exhibits negligible information loss over centuries [3]. No magnetic, optical, or solid-state medium offers anything comparable on either axis.

Yet writing to and reading from this medium is biochemistry, not electronics. Synthesis proceeds nucleotide by nucleotide with imperfect coupling; sequencing reads each molecule a random number of times, or never; amplification by polymerase chain reaction (PCR) distorts abundances exponentially. The resulting channel is a *compound* of erasures (whole oligonucleotides absent from the read set), substitutions, and — most perniciously — insertions and deletions that destroy synchronization. Early systems [6] attacked this with address-indexed blocks and brute-force physical redundancy, achieving only about half the practical capacity. The decisive advance was recognizing that the DNA storage channel is, at the level that matters for architecture, an **erasure channel with a noisy inner layer**: if each oligonucleotide carries an index and enough inner error protection, the outer problem reduces to recovering a file from a random subset of its encoded packets — precisely the setting for which *rateless* erasure codes were invented.

This article presents that argument in full. We trace the path from Luby's LT codes [7] and Shokrollahi's Raptor codes [8] through the DNA Fountain system [1] to contemporary primer-addressed random-access architectures, grounding every design choice in measured error statistics and proved decoding guarantees.

## 2 Background

### 2.1 The DNA storage pipeline

A canonical DNA storage workflow comprises six stages [9]:

1. **Encoding**: binary data are mapped to sequences over {A, C, G, T}, partitioned into payloads, and augmented with indices, error-correction redundancy, and primer-binding sites.
2. **Synthesis**: oligonucleotides (typically 150–300 nt; commercial high-fidelity synthesis caps near 200 nt) are produced, either column-based (phosphoramidite, low error) or array-based/photolithographic (massively parallel, higher error).
3. **Storage**: the pool is kept dry, cold, or encapsulated in silica; decay manifests as strand cleavage and base damage.
4. **Amplification** (optional): PCR copies the pool, enabling repeated readouts and selective retrieval.
5. **Sequencing**: Illumina (short reads, substitution-dominated errors ~0.1–1% per base) or nanopore (long reads, indel-dominated) platforms sample molecules with random coverage.
6. **Decoding**: reads are clustered by index, consensus sequences formed, and the outer code reconstructs the file.

The theoretical capacity of 2 bits/nt is reduced in practice by error-correction overhead, indices, and primers; the achievable ceiling under realistic error rates is widely quoted near **1.8 bits/nt** [10].

### 2.2 Fountain codes: LT and Raptor constructions

*Fountain codes* are rateless erasure codes: from *k* source symbols, the encoder can generate a potentially unlimited stream of encoded symbols, such that any subset of slightly more than *k* of them suffices for decoding with high probability.

**LT codes** (Luby, 2002) [7] generate each encoded symbol by sampling a degree *d* from a degree distribution Ω, choosing *d* source symbols uniformly at random, and XOR-ing them. Decoding proceeds by the *peeling* (belief-propagation) process on the bipartite graph: find a degree-1 encoded symbol, recover its neighbor, XOR it out of all connected symbols, and repeat. The key innovation is the **robust soliton distribution** μ, which guarantees that the decoding "ripple" of degree-1 symbols neither dies out nor explodes:

$$\mu(d) = \frac{\rho(d) + \tau(d)}{\beta}, \quad \rho(1) = \frac{1}{k},\ \rho(d) = \frac{1}{d(d-1)}\ (d \geq 2)$$

with τ concentrating mass near $k/R$ for $R = c\ln(k/\delta)\sqrt{k}$.

> **Theorem (Luby [7]):** For any $k$ and $\delta > 0$, LT codes with the robust soliton distribution recover all $k$ source symbols from $k + O(\sqrt{k}\ln^2(k/\delta))$ received symbols with probability at least $1 - \delta$, in $O(k \ln(k/\delta))$ average time.

**Raptor codes** (Shokrollahi, 2006) [8] concatenate a fixed-rate precode (typically LDPC) with a weakened LT code, achieving **linear** encoding and decoding time with overhead below 2%. RaptorQ (IETF RFC 6330) extends this to systematic encoding and up to 56,403 source symbols per block, with failure probability dropping by orders of magnitude per additional received symbol beyond *k* [11].

### 2.3 From packets to nucleotides

The DNA channel differs from the packet-erasure channel in three ways that shape every DNA fountain design: (i) symbols are *short* (a few hundred nucleotides, not kilobytes), so per-symbol overhead (seeds, indices) is proportionally large; (ii) the alphabet is quaternary with biochemical constraints (GC content, homopolymer runs, secondary structure); (iii) within-symbol errors are insertions and deletions, requiring an inner synchronization layer. The DNA Fountain architecture [1] resolves these by a two-level design: fountain-coded *droplets* at the outer level, each self-describing via a seed, with sequence-level screening enforcing biochemical constraints.

## 3 Methodology

### 3.1 Oligonucleotide anatomy

A storage oligonucleotide of total length *L* nt is partitioned as:

| Region | Typical length | Function |
|---|---|---|
| Forward primer | 18–25 nt | PCR amplification / file addressing |
| Seed / index | 16–32 nt | Droplet identifier, PRNG seed |
| Payload | 100–200 nt | Fountain-encoded data |
| Reverse primer | 18–25 nt | PCR amplification / file addressing |

Primers occupy both ends; for 200-nt molecules storing 1 GB of data, the primer fraction is approximately **6.5%** of all synthesized nucleotides [9]. Some schemes omit one primer or embed addressing in the payload to reclaim density [9].

### 3.2 Droplet generation

The file is divided into *k* segments of equal bit-length. Each droplet is generated as follows:

```python
import hashlib

def generate_droplet(segments: list[bytes], seed: int) -> bytes:
    """One DNA Fountain droplet: PRNG(seed) selects a subset, XOR them."""
    rng = random.Random(seed)
    d = sample_robust_soliton(rng, k=len(segments))   # degree
    chosen = rng.sample(range(len(segments)), d)       # neighbor set
    droplet = segments[chosen[0]]
    for i in chosen[1:]:
        droplet = bytes(a ^ b for a, b in zip(droplet, segments[i]))
    return droplet  # + seed packed alongside
```

The pair *(seed, droplet)* is then mapped to nucleotides. Erlich and Zielinski [1] used a rotating code — A=00, C=01, G=10, T=11 with a shift depending on the previous base — that simultaneously avoids homopolymers and balances GC content. Crucially, each candidate droplet is **screened**: droplets whose nucleotide sequence violates constraints (homopolymer runs ≥ 4, GC content outside 45–55%, excessive secondary structure) are discarded and a new seed drawn. Because the code is rateless, rejection costs nothing but encoder time.

### 3.3 Decoding pipeline

1. Sequence the pool; cluster reads by seed (exact or near-exact match).
2. Build consensus per droplet via majority vote across copies (inner error suppression).
3. Discard droplets failing constraint checks (they are treated as erasures).
4. Run the peeling decoder on the bipartite graph reconstructed from seeds.
5. Verify integrity (e.g., embedded checksum) and output the file.

### 3.4 Primer addressing for random access

All files' oligonucleotides are pooled in one tube. Each file is flanked by a unique primer pair; PCR with that pair amplifies only the target file's molecules, which are then sequenced [4,5]. Orthogonal primer libraries must satisfy stringent cross-hybridization constraints, and multiplexed retrieval (multiple files at once) remains error-prone [12].

## 4 Deep Dive

### 4.1 The robust soliton distribution and the decoding ripple

The ideal soliton distribution $\rho$ is designed so that, at each peeling step with $k'$ unrecovered symbols, the expected number of released degree-1 symbols is exactly one — a random walk that succeeds only with probability bounded away from zero. The robust soliton $\mu$ adds the spike $\tau$ to keep the ripple size near $R = c\ln(k/\delta)\sqrt{k}$, guaranteeing concentration. In DNA storage, $k$ is typically $10^3$–$10^5$ segments; with $k = 72{,}000$ droplets as in [1], the overhead $O(\sqrt{k}\ln^2(k/\delta))$ is a few percent — far below the cost of the biochemical constraints themselves.

A subtlety: the peeling decoder assumes *erasure-only* inputs. Every droplet that survives screening and consensus is therefore treated as either perfectly known or entirely absent. This is why the inner layer (clustering + majority vote + constraint verification) must convert substitution/indel noise into erasures — a design principle sometimes called *error-to-erasure conversion*.

### 4.2 Why Raptor precoding matters — and when it does not

Raptor codes add an outer LDPC precode so that the LT component need only recover a $(1-\epsilon)$ fraction of intermediate symbols; the precode cleans up the residual. This yields linear-time decoding and overhead under 2% [8]. For DNA storage at megabyte scales, however, the dominant costs are elsewhere: primer/index overhead per short oligonucleotide, screening rejection rates, and physical coverage. DNA Fountain [1] therefore used a plain LT-like construction with aggressive screening, accepting slightly higher overhead in exchange for simplicity and per-droplet self-description. At gigabyte scales and above, RaptorQ-style precoding becomes attractive: the precode absorbs the "error floor" of unrecovered segments without requiring additional sequencing coverage [11].

```rust
// Conceptual Raptor-style two-stage decode (pseudocode)
fn raptor_decode(received: &[Droplet], precode: &LdpcCode) -> Option<File> {
    let mut intermediate = lt_peel(received);      // recover ~99% of symbols
    let full = precode.decode(intermediate)?;       // LDPC cleans the rest
    Some(assemble(full))
}
```

### 4.3 Synthesis and sequencing error models

Recent large-scale quantification [2,3] has replaced folklore with measured per-nucleotide rates:

| Process | Substitutions | Insertions | Deletions | Notes |
|---|---|---|---|---|
| Commercial phosphoramidite synthesis | ~7.9 × 10⁻³ | <0.3 × 10⁻³ | ~6.7 × 10⁻³ | Deletions dominate; synthesis explains 92% of deletion variance [2] |
| Photolithographic synthesis | ~2.5 × 10⁻² | ~1.6 × 10⁻² | ~8.2 × 10⁻² | Only ~2% of reads fully error-free [3] |
| PCR amplification | dominant source | low | low | Explains 86% of substitution variance [2] |
| Illumina sequencing | ~10⁻³–10⁻² | negligible | negligible | Substitution-dominated |
| Strand decay (storage) | — | — | cleavage ~2.3 × 10⁻² breaks/nt (model) | Fragmentation, not point errors [3] |

Three modeling lessons emerge. **First**, errors are *not* independent: consecutive-error bursts occur more often than a binomial model predicts, though singletons still dominate (≈84–93% of events) [3]. **Second**, coverage is biased — well described by a lognormal distribution — so physical redundancy must be dimensioned for the tail, not the mean [3]. **Third**, synthesis technology dominates the error budget: moving from photolithographic to commercial column synthesis changes the regime from indel-dominated to substitution-dominated, which in turn determines whether the inner code must handle synchronization or merely Hamming errors. The HEDGES code [13] and de Bruijn-graph assembly [14] represent the two poles of inner-code philosophy: explicit indel-correcting convolutional coding versus multi-copy graph-based reconstruction.

### 4.4 Primer addressing: the random-access bottleneck

PCR-based random access [4,5] assigns each file a primer pair; the primers are the file's *address* in the molecular namespace. The engineering constraints are severe:

- **Orthogonality**: primers must not cross-hybridize with each other or with payload sequences. Yazdi et al. [4] addressed this with mutually uncorrelated address strings satisfying error-control running-digital-sum constraints, decoded via prefix-synchronized coding.
- **Multiplexing limits**: amplifying multiple files simultaneously with multiple primer pairs generates chimeric by-products and bias; current practice retrieves essentially one file per reaction [12].
- **Namespace exhaustion**: primer length is capped (~25 nt) to limit melting-temperature spread and density loss, bounding the address space. Multi-mode designs reuse primer combinations — e.g., (FP1, RP1) for file A, (FP1, RP2) for file B — to support batch retrieval [5].
- **Alternatives**: thermoresponsive microcapsules physically compartmentalize one file per capsule, enabling repeated multiplexed access without PCR competition [12]; DNA micro-disks and silica microspheres pursue similar physical addressing.

> **Theorem (addressing capacity sketch):** With primer length $\ell$ and a code of minimum Hamming distance $d$ over the quaternary alphabet, at most $A_4(\ell, d)$ mutually orthogonal addresses exist; for $\ell = 20$, $d = 8$, this bounds single-primer file counts near $4^{20}/V$ where $V$ is the Hamming-ball volume — large, but cross-hybridization thermodynamics, not combinatorics, is the practical limit.

### 4.5 Density versus durability: the central tradeoff

Density and durability pull in opposite directions along three axes:

1. **Physical coverage**: storing *c* copies of each oligonucleotide multiplies durability (surviving dropout, decay, and repeated PCR sampling — Erlich and Zielinski estimated $2.18 \times 10^{15}$ retrievals from one sample [1]) but divides information density by *c*.
2. **Logical redundancy**: fountain overhead $\epsilon$ (a few percent) plus inner-code redundancy buys robustness against the error rates of §4.3 at direct density cost.
3. **Encapsulation**: silica or salt-based preservation extends half-life by orders of magnitude [3] but adds mass and volume excluded from "petabytes per gram" headline figures.

The 215 PB/g demonstration [1] sits at the extreme-density end: minimal coverage, maximal screening, single Illumina tile of sequencing. Archival practice will trade a fraction of that density for coverage depth and encapsulation — a Pareto frontier, not a single number.

---

## 5 Empirical Results and Proofs

### 5.1 Experimental milestones

| System | Year | Scale | Density / efficiency | Key technique |
|---|---|---|---|---|
| Church et al. [6] | 2012 | 5.27 Mb | 1 bit/nt; 1.28 PB/g | Address-indexed blocks, 100× coverage |
| Erlich & Zielinski [1] | 2017 | 2.14 MB (OS, film, virus) | 1.6 bits/nt; **215 PB/g** | DNA Fountain (LT + screening), 72,000 oligos |
| Yazdi et al. [4] | 2015 | 17 KB | — | Rewritable, random-access, prefix-synchronized addresses |
| Organick et al. (primer multiplexing) [5] | 2018+ | 10s of MB | — | PCR random access, file-specific primers |
| DBGPS (Song et al.) [14] | 2022 | up to 1 GB (sim.) | — | de Bruijn assembly, 20× copies |
| Digital twin calibration [2] | 2023 | 40 datasets | — | Full error/bias model, dt4dds challenge suite |

The DNA Fountain result deserves emphasis: perfect retrieval of 2.14 MB from sequencing coverage equivalent to a *single tile* of an Illumina flow cell, at 1.6 bits/nt — roughly **89% of the 1.8 bits/nt practical ceiling** [1,10].

### 5.2 What the theory guarantees

> **Theorem (fountain overhead, after Luby [7]):** For $k$ segments and target failure probability $\delta$, $k + O(\sqrt{k}\ln^2(k/\delta))$ droplets suffice. For $k = 72{,}000$ and $\delta = 10^{-6}$, the overhead is under 5% — negligible beside the ~10–25% consumed by primers, seeds, and screening rejections.

> **Theorem (RaptorQ recovery [11]):** With $K$ source symbols, $K$ received symbols decode with probability 99%; $K+1$ with 99.99%; $K+2$ with 99.9999%. Each additional symbol buys two further nines — the practical reason Raptor-precoded designs need almost no coverage margin beyond the mean.

The screening step in [1] is theoretically significant: by rejecting droplets that violate biochemical constraints, the encoder *shapes* the transmitted distribution without touching the decoder — a free shaping gain purchased with ratelessness, impossible for fixed-rate codes.

### 5.3 Error-to-erasure conversion, quantified

With commercial synthesis error rates (~1.5 × 10⁻² combined per nt [2]) and 200-nt payloads, a given copy is error-free with probability roughly $(1 - 0.015)^{200} \approx 0.05$. At physical coverage $c = 10$, the probability that *no* clean copy exists is $0.95^{10} \approx 0.60$ — yet consensus across noisy copies recovers the droplet with high probability, and residual failures become erasures for the fountain decoder. This two-level structure is why fountain overhead stays in the single digits even though per-molecule raw error rates look catastrophic by electronic standards.

## 6 Limitations

1. **Write cost and latency**: synthesis remains dollars-per-megabyte and days-per-batch (the 72,000 oligos of [1] took two weeks via Twist Bioscience). DNA is write-once archival, not a hard drive.
2. **Read latency**: sequencing turnaround is hours; random access requires a PCR step before sequencing even begins.
3. **Multiplexed random access**: simultaneous multi-file PCR retrieval degrades rapidly [12]; physical compartmentalization is promising but immature.
4. **Short-molecule ceiling**: high-fidelity synthesis caps near 200 nt, so per-oligo overhead (primers + seed ≈ 25–30%) is structural, not incidental.
5. **No in-place rewrite**: editing requires selective amplification and re-synthesis (gBlock or overlap-extension PCR [4]); there is no molecular analogue of overwriting a sector.
6. **Error-model drift**: photolithographic and enzymatic synthesis have qualitatively different error profiles [3]; codes tuned for one regime underperform in the other, and the field still lacks a universal channel model.
7. **Density headlines vs. system density**: 215 PB/g [1] and 455 EB/g [6] exclude primers, packaging, encapsulation, and the sequencing instrument; end-to-end archival density is orders of magnitude lower.

## 7 Conclusion

Fountain codes are not merely a convenient choice for DNA storage — they are the *structurally correct* one. The DNA channel loses whole molecules unpredictably, corrupts survivors with indels, and delivers a random-sized sample of whatever was written; a rateless code that treats every decodable droplet as a useful packet and every failure as an erasure matches this channel's statistics exactly. The DNA Fountain demonstration [1] — 2.14 MB recovered perfectly at 215 PB/g and ~89% of practical capacity — proved the architecture; subsequent work has quantified the error models [2,3], hardened the inner indel-correction layer [13,14], and attacked the random-access bottleneck with primer libraries [4,5] and physical compartmentalization [12]. The remaining challenges are biochemical and economic — synthesis cost, multiplexed access, universal error models — not information-theoretic. The codes are ready; the chemistry is catching up.

## References

[1] Y. Erlich and D. Zielinski, "DNA Fountain enables a robust and efficient storage architecture," *Science*, vol. 355, no. 6328, pp. 950–954, 2017. https://pubmed.ncbi.nlm.nih.gov/28254941/

[2] L. Gimpel et al., "A digital twin for DNA data storage based on comprehensive quantification of errors and biases," *Nature Communications*, vol. 14, 2023. https://www.nature.com/articles/s41467-023-41729-1

[3] R. N. Grass, R. Heckel et al., "Challenges for error-correction coding in DNA data storage: photolithographic synthesis and DNA decay," *Digital Discovery*, vol. 3, pp. 2497–2508, 2024. https://www.biorxiv.org/content/10.1101/2024.07.04.602085v1.full.pdf

[4] S. M. H. T. Yazdi, Y. Yuan, J. Ma, H. Zhao, and O. Milenkovic, "A rewritable, random-access DNA-based storage system," *Scientific Reports*, vol. 5, 14138, 2015. https://www.nature.com/articles/srep14138

[5] "Multi-Mode Data Organization and File Retrieval Based on a Primer Library in Large-Scale Digital DNA Storage," *Engineering*, 2024. https://www.engineering.org.cn/engi/EN/10.1016/j.eng.2023.10.021

[6] G. M. Church, Y. Gao, and S. Kosuri, "Next-generation digital information storage in DNA," *Science*, vol. 337, no. 6102, p. 1628, 2012. https://arep.med.harvard.edu/pdf/Church_Science_12.pdf

[7] M. Luby, "LT codes," in *Proc. 43rd Annual IEEE Symp. on Foundations of Computer Science (FOCS)*, pp. 271–280, 2002. doi:10.1109/SFCS.2002.1181950

[8] A. Shokrollahi, "Raptor codes," *IEEE Trans. Information Theory*, vol. 52, no. 6, pp. 2551–2567, 2006. https://people.ece.ubc.ca/janm/Papers_RG/Shokrollahi_IT_June06.pdf

[9] "High-throughput DNA synthesis for data storage," *Chemical Society Reviews*, 2024. https://pubs.rsc.org/en/content/articlehtml/2024/cs/d3cs00469d

[10] "DNA could store all of the world's data in one room," *Science* News, 2017. https://www.science.org/content/article/dna-could-store-all-worlds-data-one-room

[11] M. Luby, A. Shokrollahi, M. Watson, T. Stockhammer, and L. Minder, "RaptorQ Forward Error Correction Scheme for Object Delivery," IETF RFC 6330, 2011. https://github.com/dicklesworthstone/raptorq_article/blob/HEAD/raptorq_fountain_codes_research.md

[12] "DNA storage in thermoresponsive microcapsules for repeated random multiplexed data access," *Nature Nanotechnology*, 2023 (news summary). https://www.nanowerk.com/nanotechnology-news2/newsid=62944.php

[13] W. H. Press et al., "HEDGES error-correcting code for DNA storage corrects indels and allows sequence constraints," *PNAS*, 2020. http://www.pnas.org/lookup/doi/10.1073/pnas.2004821117

[14] S. Song et al., "Robust data storage in DNA by de Bruijn graph-based de novo strand assembly," *Nature Communications*, vol. 13, 2022. https://www.nature.com/articles/s41467-022-33046-w

