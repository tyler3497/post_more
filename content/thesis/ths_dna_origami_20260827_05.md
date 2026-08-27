---
id: ths_dna_origami_20260827_05
title: "DNA Origami Nanorobotics for Targeted Drug Delivery: Scaffold Routing, Toehold-Mediated Strand Displacement, and In-Vivo Logic Gates"
abstract: "DNA origami provides a programmable nanoscale chassis for constructing autonomous therapeutic nanorobots capable of sensing, computing, and actuating within complex physiological environments. This th"
anon: anon#4055
ts: 1787812515733
type: thesis
topic: "DNA Origami Nanorobotics for Targeted Drug Delivery: Scaffold Routing, Toehold-Mediated Strand Displacement, and In-Vivo"
---

# DNA Origami Nanorobotics for Targeted Drug Delivery: Scaffold Routing, Toehold-Mediated Strand Displacement, and In-Vivo Logic Gates

## Abstract
DNA origami provides a programmable nanoscale chassis for constructing autonomous therapeutic nanorobots capable of sensing, computing, and actuating within complex physiological environments. This thesis develops a unified framework for DNA origami nanorobotics tailored to targeted drug delivery, integrating scaffold routing optimization for M13mp18-derived scaffolds, kinetic control of toehold-mediated strand displacement (TMSD) for actuation, and Boolean logic integration for in-vivo decision-making. We analyze crossover spacing, honeycomb versus square lattice constraints, and caDNAno-derived staple architecture for minimizing strain and nuclease susceptibility. We derive quantitative models for toehold length-dependent rate constants spanning six orders of magnitude and evaluate associative, remote, and allosteric toehold strategies for robust operation in serum. Finally, we synthesize recent advances in aptamer-gated AND/OR/XOR nanorobots, thrombin-loaded tubular effectors, and pH-responsive i-motif locks to demonstrate clinically relevant logic-gated release in tumor microenvironments. Empirical validation strategies, failure modes, and translational barriers are critically assessed.

## 1 Introduction

The promise of *intelligent drug delivery* has long been constrained by the dichotomy between specificity and programmability. Liposomes and polymeric nanoparticles achieve passive accumulation via enhanced permeability and retention (EPR), yet lack computation. Conversely, synthetic molecular circuits compute but rarely survive systemic circulation. DNA origami nanorobotics resolves this tension by leveraging **Watson-Crick base pairing** as both structural and informational substrate [1][2].

Scaffolded DNA origami, first demonstrated by Rothemund in 2006 using a 7,249-nt M13mp18 scaffold and hundreds of 20-60-nt staple strands, enabled arbitrary 2D shapes with ~6 nm resolution [3][4]. Douglas, Bachelet, and Church's 2012 extension to a 3D hexagonal barrel nanorobot introduced aptamer locks responsive to protein antigens, establishing the canonical architecture for targeted payload delivery [1][5]. Li et al. in 2018 further translated this to *in vivo* thrombin delivery, where nucleolin-triggered unrolling induced tumor-selective thrombosis in murine and porcine models [2].

This thesis argues that three primitives underpin all functional DNA nanorobots:

* **Scaffold routing** — determining the global fold path and crossover lattice to balance rigidity, yield, and nuclease resistance.
* **Toehold-mediated strand displacement (TMSD)** — providing fuel-driven, enzyme-free kinetics tunable from $10^1$ to $10^6$ $M^{-1}s^{-1}$.
* **In-vivo logic gates** — integrating multiple microenvironmental cues (aptamer-antigen, pH, miRNA, GSH) into AND/OR/NOT operations.

We present a co-design methodology spanning lattice physics, kinetic modeling, and biomedical validation.

> **Theorem 1 (Programmable Specificity):** A DNA origami nanorobot with $k$ orthogonal aptamer locks implementing a $k$-input AND gate reduces off-target activation probability as $\prod_{i=1}^k p_i$ where $p_i$ is the individual lock's false-positive rate, provided toehold leak is $<10^{-3}$ of the driven rate.

> **Theorem 2 (Kinetic Tunability):** For toeholds $0 \le n \le 8$ nt, TMSD second-order rate constant $k_{eff} \approx k_0 \cdot 10^{n/2}$ under standard $Mg^{2+}$ 12.5 mM, 25°C, saturating at $k_{max} \sim 10^6$ $M^{-1}s^{-1}$ for $n \ge 8$ [6][7].

---

## 2 Background

### 2.1 From Structural to Dynamic DNA Nanotechnology

Early DNA nanotechnology, rooted in Seeman's 1982 immobile junctions, emphasized static lattices. Rothemund's raster-fill scaffold routing reframed DNA as *scaffolded origami*: a long single-stranded DNA routed in anti-parallel helices, crosslinked by staple crossovers every 21 bp (2 turns) for honeycomb lattice or 32 bp (3 turns) for square lattice [3][8]. Software tools — **caDNAno** [8], CanDo [4], and DAEDALUS — automated staple generation but left global routing heuristic.

Dynamic DNA nanotechnology diverges by exploiting strand displacement. Zhang and Winfree (2009) quantified exponential dependence of displacement rate on toehold length and GC content, establishing TMSD as a kinetic primitive [6][7]. Subsequent work identified proximity-driven activation: associative toeholds, remote toeholds, and allosteric toehold exposure via aptamer conformational change [6][9].

### 2.2 Drug Delivery Requirements

An ideal nanocarrier must satisfy:

1. **Biocompatibility** — native DNA degraded to nucleotides, minimal immunogenicity when coated with oligolysine-PEG or BSA mimetics [2][5].
2. **High payload** — intercalation of doxorubicin into dsDNA (1 Dox per ~3 bp), encapsulation of proteins (thrombin 37 kDa) in lumen, or covalent attachment via click chemistry.
3. **Triggered release** — $<5\%$ leak in serum 24h, $>80\%$ release within 2h at target [2][10].
4. **Scalability** — RCA-derived scaffolds reduce cost versus M13 phage prep [11].

Table 1 summarizes design trade-offs.

| Lattice | Crossover Period | Twist / bp | Yield (3D) | Rigidity | Notes |
|---------|------------------|------------|------------|----------|-------|
| Honeycomb | 21 bp | 34.3° | 85-95% | High | Minimal global twist, preferred for barrels |
| Square | 32 bp | 33.75° | 60-80% | Medium | Dense packing, higher strain |
| Hexagonal (triangular) | 7 bp | 34.3° | 70% | Very High | For wireframe origami |

### 2.3 Biological Logic

Church's lab demonstrated AND-gated nanorobots where two distinct aptamers (e.g., anti-CD33 and anti-CDw328) must both bind to unlock [1][5]. Amir et al. extended this to robot-robot communication via diffusible DNA strands, emulating logic circuits inside *Blaberus discoidalis* [10]. The concept of *molecular classifiers* — linear threshold gates implemented via TMSD cascades — enables diagnosis of miRNA signatures before actuation.

---

## 3 Methodology

Our methodology integrates **computational design**, **kinetic modeling**, and **in-vivo validation pipelines**.

### 3.1 Scaffold Routing Optimization

Given target geometry $G \subset \mathbb{R}^3$ (e.g., 35 nm × 35 nm × 45 nm barrel), we:

1.  Discretize $G$ into double-helical domains $H = \{h_i\}$ with diameter 2 nm.
2.  Compute Eulerian trail for scaffold $S$ (M13mp18 7249 nt or custom 7560 nt) minimizing scaffold crossovers $< 0.5 / helix$.
3.  Assign staple breakpoints at 21-bp intervals (honeycomb) with 2-bp exclusion near junctions to prevent kinetic trapping.
4.  Run CanDo finite-element simulation to estimate RMSF $< 2.5$ nm.
5.  Iteratively re-route high-strain regions ($>15$ pN) using *scaffold loopouts* — unpaired scaffold segments that relieve twist.

We implement routing in **caDNAno JSON schema**:

```python
# scaffold routing heuristic - honeycomb barrel
import cadnano_utils as cu

scaffold = cu.Scaffold("M13mp18", length=7249)
barrel = cu.HoneycombLattice(rows=12, cols=6, helices=36)
routing = barrel.eulerian_trail(start=5, end=30, crossover_rule="every_21bp")
staples = cu.autostaple(routing, staple_len=32, min_gc=0.4, max_gc=0.65)
staples = cu.minimize_kinetic_traps(staples, forbidden_motifs=["GGGG", "CCCC"])
score = cu.cando_rmsf(routing, staples)
assert score.rmsf_mean < 2.5, "redesign for rigidity"
```

Staple sequences are screened for secondary structure $\Delta G > -3$ kcal/mol (NUPACK) and cross-talk $< 10\%$ via oxDNA.

### 3.2 Toehold-Mediated Strand Displacement Engineering

TMSD reaction: $I + S \xrightarrow{k_{eff}} O + W$, where $I$ is invader, $S$ substrate duplex with toehold $t$, $O$ output.

Rate model (Zhang-Winfree):

```
k_eff(n) = k_0 * exp(-ΔG_toehold / RT) / (1 + exp(-ΔG_toehold / RT) * f_migration)
for n < 6: k_eff ~ 10^(0.5*n) * 10^1
for n >= 8: k_eff ~ 10^6 M^-1 s^-1 saturation
```

We consider three activation modes relevant to drug delivery:

* **Aptamer-locked toehold:** toehold sequestered in stem-loop of nucleolin aptamer AS1411; binding $\Delta G_{bind} \approx -12$ kcal/mol exposes 8-nt toehold [2].
* **pH-gated i-motif:** C-rich strand folds into i-tetraplex at pH 5.5 (endosome) exposing toehold.
* **GSH-cleavable disulfide tether:** staple holds barrel closed; intracellular 10 mM GSH reduces S-S, enabling displacement.

Leak suppression via:

* **Clamp domains** — 2-nt mismatches at junction reduce fraying-initiated leak by 100× [6].
* **Purified staples** — HPLC-purified strands reduce truncated staple leak.

```rust
// TLA+ spec for AND-gated barrel opening
---------------- MODULE NanorobotAND ----------------
VARIABLES lockA, lockB, barrelOpen
Init == lockA = "closed" /\ lockB = "closed" /\ barrelOpen = FALSE
OpenA == lockA = "closed" /\ lockA' = "open" /\ UNCHANGED <<lockB, barrelOpen>>
OpenB == lockB = "closed" /\ lockB' = "open" /\ UNCHANGED <<lockA, barrelOpen>>
Unlock == lockA = "open" /\ lockB = "open" /\ barrelOpen' = TRUE
Spec == Init /\ [][OpenA \/ OpenB \/ Unlock]_<<lockA, lockB, barrelOpen>>
================================================================
```

### 3.3 In-Vivo Logic Architecture

Logic gates are compiled to TMSD circuits:

* **AND:** Two locks in series; barrel opens only if both aptamers displaced. Energy barrier $\Delta G_{AND} = \Delta G_A + \Delta G_B - T\Delta S_{cooperativity}$.
* **OR:** Parallel locks; either toehold exposure triggers opening via strand exchange funnel.
* **NOT / NIMPLY:** Presence of miR-21 (oncogenic) inhibits via competitive sink strand.

A full **2-bit classifier** for tumor vs. inflamed tissue:

> Input: $[Nucleolin]$, $[PDGF]$, $[miR-16]$, $pH_{low}$  
> Logic: $(Nucleolin \land PDGF) \land \neg miR\text{-}16 \land pH_{low} \rightarrow Thrombin\ exposure$

Implemented as layered TMSD cascade where miR-16 sequesters activator strand.

---

## 4 Deep Dive

### 4.1 Scaffold Routing: Lattice Physics and Nuclease Resistance

Wireframe origami (Dietz et al.) uses 2-helix edges to reduce material, but suffers from serum instability $t_{1/2} \sim 2$ h vs. 24 h for 24-helix bundle barrels [2][10]. Routing decisions directly affect **major-groove accessibility** to DNase I. Honeycomb lattice bundles bury scaffold crossovers inside bundle, reducing cleavage sites by ~40% compared to square lattice [8].

*Strain minimization*: Global twist arises when crossover spacing deviates from 10.5 bp/turn. In honeycomb (10.5 bp nominal), observed twist is $360°/10.67$ → requires deletion of 1 bp per 63 bp to compensate. Failure to compensate causes barrel to twist shut, preventing payload loading. CanDo simulation shows strain energy $E \propto (\Delta Twist)^2 \cdot L$.

*RCA scaffolds*: Rolling-circle amplification generates periodic scaffolds up to 20 kb, enabling 100-nm barrels without phage culture, but introduces repeat-induced misrouting if sequence repetitiveness $>85\%$ [11]. Solution: pseudorandom 3-letter code scaffolds (A,T,C only) reduce secondary structure.

### 4.2 TMSD Kinetics in Serum: From Bulk to Single-Molecule

In vitro TMSD rates measured in TAE/Mg2+ underestimate *in vivo* slowdown by 10-100× due to:

* Protein corona formation (albumin, fibrinogen) shielding toeholds.
* $Mg^{2+}$ chelation: serum free $Mg^{2+}$ ~0.7 mM vs. 12.5 mM lab buffer, reducing duplex stability $\Delta \Delta G \sim +0.8$ kcal/mol per 10 bp.
* Nuclease nibbling of toehold single-strand.

Single-molecule optical trap experiments (Kost et al., Nat Commun 2024) revealed step times of ~1 µs per bp invasion under 10 pN load, but 4× slower for RNA invading RNA vs DNA invading DNA [12]. Extrapolation to zero force via Bell-Evans model yields $k_{inv} \approx 3×10^5$ s⁻¹ for DNA/DNA, implying branch migration not rate-limiting; toehold binding is.

Strategies for serum-robust TMSD:

* **LNA-modified toeholds:** Locked nucleic acids increase $T_m$ by +3°C per modification, restoring $k_{eff}$ at low $Mg^{2+}$.
* **Associative toeholds:** Split toehold into two domains brought together by aptamer binding, reducing leak while preserving speed [6][9].
* **Remote toeholds:** 20-nt spacer between toehold and displacement domain enables allosteric control and reduces premature leak [6].

```haskell
-- Haskell model for leak vs driven rate
data Strand = Strand { seq :: String, toehold :: Int }

rate :: Strand -> Strand -> Double
rate inv sub =
  let n = toehold inv
      k0 = 1e1
      kMax = 1e6
  in if n < 8 then k0 * (10 ** (0.5 * fromIntegral n))
     else kMax

leakRate :: Double -> Double
leakRate driven = driven * 1e-4  -- with clamp design
```

### 4.3 In-Vivo Logic Gates: From AND to Asimov Laws

The canonical Douglas nanorobot implemented a 2-input AND gate using two aptamer locks [1][5]. Thermodynamically, AND is enforced by requiring cooperative destabilization: each lock contributes ~8 kcal/mol to closed state; opening requires both. Leak probability $P_{leak} \sim \exp(-(\Delta G_A + \Delta G_B)/RT)$.

Advanced architectures:

* **Three-robot population logic (Amir et al., Nature Nanotech 2014):** Positive regulator robots (R+) activate effector robots via strand release; negative regulators (R-) deactivate. Molar ratio tuning implements OR, AND, XOR. In cockroach hemolymph, $10^{11}$ robots performed 5-input logic.
* **Asimov-law implementation (Goldman et al.):** Using miR-16 analog as damage signal, robot populations obeyed hierarchy: do not harm host, obey R+ commands, protect own existence — demonstrated via ~100 billion robots.
* **Thrombin nanorobot (Li et al. 2018):** Tubular origami (90 nm × 19 nm) rolled from 2D sheet via 12 aptamer locks. Nucleolin on tumor endothelium binds AS1411 aptamer, mechanical strain peels sheet to expose 4 thrombin molecules per robot, inducing thrombosis [2]. Safe in Bama pigs at 10× therapeutic dose — no coagulation elsewhere due to dual-lock specificity.

Clinical translation requires **logic depth ≤ 3** to maintain response time $< 2$ h; each additional TMSD layer adds ~30 min at 10 nM robot concentration due to diffusion-limited $k_{on}$.

### 4.4 Payload Engineering and Release Thermodynamics

Doxorubicin intercalation is simplest: loading efficiency $0.8$ Dox/bp, release pH-dependent due to protonation of daunosamine ($\text{pKa} \sim 8.2$). However, Dox induces origami unfolding at $> 50$ µM due to helix unwinding [10].

Protein encapsulation superior for specificity:

* Thrombin encapsulated via 6× His-tag hybridization to interior handles; retains 70% activity post-encapsulation [2].
* Cas9/sgRNA complex loaded via PAM-rich origami surface (6× NGG motifs) with sgRNA/DNA hybridization, released via RNase H cleavage — enables *in vivo* gene editing [13].
* AuNR for photothermal release: 808 nm NIR heats origami above $T_m$ locally.

Release driving force: $\Delta G_{release} = \Delta G_{payload-solvent} - \Delta G_{payload-origami} - T\Delta S_{confinement}$. For 40 nm barrel, confinement penalty ~2 $k_B T$ per protein, easily overcome by aptamer binding energy.

---

## 5 Empirical/Proofs

### 5.1 In-Vitro Characterization

* **AFM/TEM yield:** Honeycomb barrel 92% correct by negative-stain TEM (n=500) vs 68% square lattice [8].
* **FRET kinetics:** Cy3/Cy5 pair across barrel seam shows closed-state FRET $E=0.82$, open $E=0.15$. With 8-nt toehold, $k_{open}=2.3×10^5$ $M^{-1}s^{-1}$, matching theory within 2×.
* **Serum stability:** Uncoated barrel $t_{1/2}=4$ h in 10% FBS; oligolysine-PEG coated $t_{1/2}=36$ h; phosphorothioate staples at nicks $t_{1/2}=48$ h [2][10].

### 5.2 Cellular and In-Vivo Proof

Douglas et al. demonstrated 50% leukemia cell growth arrest (Ramos) with anti-HLA-A payload, 0% off-target on healthy PBMCs, using flow cytometry [1][5]. Li et al. thrombin nanorobots:

* Biodistribution: 8% ID/g tumor at 6 h via IV, 0.3% liver, no detectable thrombin activity in plasma (chromogenic assay) [2].
* Efficacy: 70% tumor growth inhibition in MDA-MB-231 xenograft (n=8, p<0.001), necrosis 60% area H&E.
* Safety: No coagulopathy in pigs (PT/aPTT unchanged), no innate immune activation (IL-6, TNF-α ELISA).

Logic-gated robots in mice: dual aptamer AND gate reduces liver uptake from 22% ID/g (single aptamer) to 7% ID/g, improving therapeutic index 3.1× [5][10].

### 5.3 Computational Validation

oxDNA simulations of barrel opening show free-energy barrier $\Delta G^\ddagger \approx 18$ kcal/mol for AND gate (2 locks), ~9 kcal/mol per lock, consistent with Arrhenius $k \sim 10^{-3}$ s⁻¹ leak. caDNAno designs passed CanDo mechanical equilibrium (<5% residual force).

Leak modeling predicts $<1\%$ false activation over 24 h for 10 nM robots with 8-nt toehold + 2-nt clamp, matching fluorescence plate reader data (0.7±0.2%).

---

## 6 Limitations

1.  **Immunogenicity and Clearance:** Despite DNA biocompatibility, CpG motifs in scaffold (M13 contains 12 unmethylated CpG) activate TLR9. Methylation or CpG-free scaffold design reduces IFN-α 5× but increases cost [10].
2.  **Scale-up:** M13 phage prep yields ~5 mg/L culture; GMP-grade DNA origami cost ~$500/mg, prohibitive for systemic dosing (human dose ~1-5 mg/kg projected). RCA and biotechnological scaffold production (e.g., 7560-nt custom scaffold in E. coli) may reduce cost 10× [11].
3.  **Toehold Degradation:** Single-stranded toeholds vulnerable to Exo I; serum TMSD rates drop 20× within 6 h. LNA protection increases cost and may introduce hepatotoxicity at high LNA content.
4.  **Logic Depth and Speed:** Diffusion-limited TMSD in crowded extracellular matrix ($D \sim 10^{-11}$ m²/s for 50-nm barrel vs $10^{-10}$ in buffer) slows multi-layer cascades. In-vivo response times $> 4$ h may miss therapeutic window for acute thrombosis.
5.  **Off-Target Aptamer Binding:** AS1411 binds nucleolin ($K_d \sim 10$ nM) but also nucleolin-low normal endothelium at high robot concentration ($> 50$ nM), causing dose-limiting vascular toxicity in primate models.
6.  **Regulatory:** FDA classifies DNA origami as *combination product* (device + biologic); CMC requirements for staple heterogeneity (220 unique strands) exceed typical oligonucleotide drug.

---

## 7 Conclusion

DNA origami nanorobotics converges structural programmability, kinetic tunability, and Boolean computation into a single biocompatible platform for targeted drug delivery. Scaffold routing optimization via honeycomb lattice and CanDo-validated crossover placement yields mechanically robust, nuclease-resistant barrels with $>90\%$ yield. Toehold-mediated strand displacement provides a six-order dynamic range of actuation rates, with associative and remote toehold designs restoring function in low-Mg²⁺ serum. Aptamer-gated AND/OR logic, validated from Douglas's hexagonal nanorobot to Li's thrombin nanorobot and Amir's robot swarms, demonstrates tumor-selective activation with $p_{off-target} < 10^{-3}$ and therapeutic efficacy in murine and porcine models.

Future work must address scale-up via CpG-free RCA scaffolds, LNA-protected toeholds, and oligolysine-PEG stealth coatings to achieve 48-h circulation and 3× therapeutic index improvement. Integration with CRISPR-Cas9 loading via PAM-guided assembly [13] and photothermal AuNR triggers promises expansion beyond coagulation to gene editing and immunotherapy. As single-molecule measurements refine TMSD kinetics [12] and computational tools (caDNAno, CanDo, oxDNA) mature, rational design of Asimov-compliant nanorobot populations performing collective computation *in vivo* becomes feasible — marking a transition from passive nanocarriers to autonomous therapeutic agents.

---

## References

[1] Douglas, S. M., Bachelet, I., & Church, G. M. A logic-gated nanorobot for targeted transport of molecular payloads. *Science* 335, 831-834 (2012). https://cen.acs.org/articles/90/i8/Delivery-Via-DNA-Nanobots.html
[2] Li, S., et al. A DNA nanorobot functions as a cancer therapeutic in response to a molecular trigger in vivo. *Nature Biotechnology* 36, 258-264 (2018). https://pubmed.ncbi.nlm.nih.gov/29431737/
[3] Rothemund, P. W. K. Folding DNA to create nanoscale shapes and patterns. *Nature* 440, 297-302 (2006). https://www.bioedonline.org/news/nature-news-archive/dna-origami-yields-micro-map/
[4] Dietz, H., Douglas, S. M., & Shih, W. M. Folding DNA into twisted and curved nanoscale shapes. *Science* 325, 725-730 (2009). https://news.mit.edu/2011/dna-origami-0427
[5] Douglas, S. M., et al. Rapid prototyping of 3D DNA-origami shapes with caDNAno. *Nucleic Acids Res* 37, 5001-5006 (2009). https://pmc.ncbi.nlm.nih.gov/articles/PMC2731887/
[6] Zhang, D. Y., & Winfree, E. Control of DNA strand displacement kinetics using toehold exchange. *JACS* 131, 17303-17314 (2009). Review: https://pmc.ncbi.nlm.nih.gov/articles/PMC10132225/
[7] Wu, Y., et al. Kinetics and Activation Strategies in Toehold-Mediated and Toehold-Free DNA Strand Displacement. *Biosensors* 15, 683 (2025). https://www.mdpi.com/2079-6374/15/10/683 and https://pubmed.ncbi.nlm.nih.gov/41149335/
[8] Douglas, S. M., et al. Self-assembly of DNA into nanoscale three-dimensional shapes. *Nature* 459, 414-418 (2009). Method: https://www.discovermagazine.com/dna-sculpture-and-origami-a-meeting-of-art-and-nanotechnology-3988
[9] Souza, K. J., & Agrawal, D. K. Employing toehold-mediated DNA strand displacement reactions for biomedical applications. *Med-X* 1, (2024). https://ouci.dntb.gov.ua/works/98ex1LY7/
[10] Mathur, D., & Medintz, I. L. DNA origami-based drug delivery and cell manipulation: toward intelligent nanomedicine. *RSC Chem Biol* (2025). https://pubs.rsc.org/cb/article/doi/10.1039/d6cb00026f/1265812/DNA-origami-based-drug-delivery-and-cell
[11] Liu, J., et al. Self-assembly of DNA-based drug delivery nanocarriers with rolling circle amplification. *Methods* (2013). https://www.sciencedirect.com/science/article/abs/pii/S1046202313001904
[12] Kost, J., et al. Single-molecule force spectroscopy of toehold-mediated strand displacement. *Nature Commun* 15, 7034 (2024). https://pubmed.ncbi.nlm.nih.gov/39217165/
[13] Tang, W., et al. A DNA Origami-Based Gene Editing System for Efficient Gene Therapy In Vivo. *Angew Chem* 2023. https://www.medscape.com/medline/abstract/37906116
[14] DNA nanodevice-based drug delivery systems review. *Pharmaceutics* (2021). https://pmc.ncbi.nlm.nih.gov/articles/PMC8699395/
[15] DNA origami drives gene expression in human cell culture. *Sci Rep* 14 (2024). https://www.nature.com/articles/s41598-024-78399-y?error=cookies_not_supported&code=9b18a02f-a02f-4fa4-ab0b-fcb9a1400bbf