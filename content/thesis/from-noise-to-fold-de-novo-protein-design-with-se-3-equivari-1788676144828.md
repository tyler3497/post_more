---
title: "From Noise to Fold: De Novo Protein Design with SE(3)-Equivariant Diffusion Models \u2014 RFdiffusion, Chroma, and the Diffusion\u2013Design\u2013Validate Paradigm"
date: 1788676144828
author: "anon#7012"
type: thesis
id: "ths_1788676144828_4e60"
images: ["ths_1788676144828_4e60-0.webp", "ths_1788676144828_4e60-1.webp", "ths_1788676144828_4e60-2.webp"]
---

# From Noise to Fold: De Novo Protein Design with SE(3)-Equivariant Diffusion Models — RFdiffusion, Chroma, and the Diffusion–Design–Validate Paradigm

## Abstract

De novo protein design has been transformed by SE(3)-equivariant diffusion models that sample protein backbones directly on the manifold of rigid-body residue frames. This thesis examines RFdiffusion (Watson et al., Nature 2023), which fine-tunes the RoseTTAFold structure-prediction network on a denoising task to generate backbones unconditionally or under motif, binder, and symmetry constraints, and Chroma (Ingraham et al., Nature 2023), a joint sequence–structure diffusion model with diffusion-aware decoders and programmable conditioning. We formalize the diffusion–design–validate pipeline — diffusion sampling, ProteinMPNN sequence design, AlphaFold2 self-consistency filtering — and review the empirical record: 19% experimental binder-design hit rates (roughly 100-fold over Rosetta), 23 of 25 motif-scaffolding benchmarks solved, 87 SEC-confirmed symmetric oligomers, and a 2.9 Å cryo-EM structure matching its design at 0.63 Å backbone RMSD. We discuss limitations — polar interfaces, implicit ligands, length ceilings — and the trajectory toward all-atom generative design.

## 1. Introduction

The *de novo* design of proteins — amino-acid sequences that fold into pre-specified three-dimensional structures and execute prescribed biochemical functions — has long been the central ambition of computational biology. Unlike structure *prediction*, which maps sequence to structure, design inverts the arrow: it asks for a sequence whose energy landscape funnels reliably into a target fold. For decades this inversion was attacked with physics-based energy functions and heuristic search, most notably in the Rosetta suite, whose fragment-assembly and Monte-Carlo refinement pipelines produced celebrated early successes such as the Top7 fold [9]. Yet these methods were brittle: they generalized poorly across fold space, failed on most non-trivial binder-design tasks, and required enormous human expertise to coax into working.

The arrival of deep-learning structure prediction — AlphaFold2 [6] and RoseTTAFold [7] — inverted the landscape a second time. If a network can evaluate, with high confidence, whether a sequence folds into a structure, then a network can also be *trained to generate* structures worth folding. Denoising diffusion probabilistic models, which had revolutionized image and audio generation, were the natural generative substrate, but protein backbones live not in pixel grids but in the curved manifold of **SE(3) rigid-body frames**, where naive Euclidean diffusion destroys the stereochemistry that makes a protein a protein.

This thesis examines how that geometric challenge was solved. In 2023, Watson et al. introduced **RFdiffusion**, fine-tuning the RoseTTAFold structure-prediction network on a denoising task to generate backbones for monomer, binder, oligomer, and motif-scaffolding design [1]. In parallel, Ingraham et al. introduced **Chroma**, a unified diffusion framework that jointly models sequence and structure, enabling programmable protein design under rich conditioning [2]. Together with **ProteinMPNN** [3], the sequence-design network that closes the design loop, these models define the modern *diffusion–design–validate* pipeline: sample a backbone with diffusion, design a sequence with ProteinMPNN, validate self-consistency with AlphaFold2 or ESMFold, and only then commit to the laboratory. The experimental results are striking: RFdiffusion achieved a 19% experimental success rate in de novo binder design across five therapeutic targets — roughly a **100-fold improvement** over previous Rosetta-based methods — and a cryo-EM structure of a designed influenza-hemagglutinin binder matched its computational model at 0.63 Å backbone RMSD [1].


## 2. Background

### 2.1 The Rosetta era and its limits

Classical protein design treated the problem as energy minimization over sequence and conformational space, searching Rosetta's composite energy function with simulated annealing and fragment assembly. The approach worked for small, idealized folds but suffered from three fundamental limitations. First, the energy function was an imperfect approximation of the true folding free energy, so designs optimized for Rosetta's energy often failed to fold *in vitro*. Second, the search was local: fragment libraries biased sampling toward known structural motifs, limiting novelty. Third, and most damning for applications, the experimental success rate for *de novo* binder design hovered near **0.1–1%**, requiring enormous libraries and heroic screening efforts to find a single hit [1].

### 2.2 Structure prediction as a design oracle

The 2021 release of AlphaFold2 [6] and the three-track RoseTTAFold network [7] changed the economics of design overnight. These networks, trained on the Protein Data Bank, predict structure from sequence with median backbone accuracies approaching experimental resolution for well-represented folds. Crucially, they are *differentiable*: their confidence metrics — predicted local distance difference test (**pLDDT**), predicted template modeling score (**pTM**), and predicted aligned error (**PAE**) — can be used as *in silico* filters that predict experimental success far better than any energy function. Dauparas et al. demonstrated that sequences designed by the graph neural network **ProteinMPNN** were predicted by AlphaFold2 to fold into their target backbones with dramatically higher confidence than Rosetta-designed sequences, and confirmed experimentally that ProteinMPNN designs expressed at higher yields and with greater thermostability [3]. The field converged on a validation cascade — generate a backbone, design sequences with ProteinMPNN, predict each with single-sequence AlphaFold2, retain only designs with pLDDT > 85–90, Cα RMSD < 2 Å, and pTM > 0.8 — and this compute-before-synthesis discipline is what made diffusion-based design economically viable.

### 2.3 Diffusion models: a primer

Denoising diffusion probabilistic models define a *forward* process that progressively corrupts data with Gaussian noise and learn a *reverse* process that reconstructs the data. Formally, given data $\mathbf{x}_0 \sim p_{\text{data}}$, the forward process

$$q(\mathbf{x}_t \mid \mathbf{x}_{t-1}) = \mathcal{N}\!\left(\mathbf{x}_t; \sqrt{1-\beta_t}\,\mathbf{x}_{t-1},\, \beta_t \mathbf{I}\right)$$

adds noise per a schedule $\beta_t$ until $\mathbf{x}_T$ is approximately isotropic Gaussian. A network $\epsilon_\theta(\mathbf{x}_t, t)$ learns the *score* $\nabla_{\mathbf{x}_t} \log p_t(\mathbf{x}_t)$, and sampling iterates the discretized reverse SDE from noise back to $\mathbf{x}_0$ [4]. The framework is attractive for proteins because it converts the hard problem of *sampling a distribution over folds* into the tractable problem of *denoising*, a task at which structure-prediction networks already excel.

> **Theorem (Score-based reversal):** For a forward diffusion defined by $d\mathbf{x} = f(\mathbf{x},t)\,dt + g(t)\,d\mathbf{w}$, the reverse-time SDE $d\mathbf{x} = \big[f(\mathbf{x},t) - g(t)^2 \nabla_{\mathbf{x}}\log p_t(\mathbf{x})\big]dt + g(t)\,d\bar{\mathbf{w}}$ generates samples from $p_0$ when initialized from $p_T$, provided the score $\nabla_{\mathbf{x}}\log p_t$ is known [5].

The catch for proteins is the domain: backbones are not vectors in $\mathbb{R}^n$ but collections of oriented residue frames in **SE(3)**, and isotropic Gaussian noise on raw coordinates produces steric clashes and broken chains. Both RFdiffusion and Chroma solve this with manifold-aware diffusion, as we now describe.

---

## 3. Methodology

### 3.1 The frame representation

A protein backbone of length $N$ is represented as $N$ rigid-body frames $T_i = (R_i, \mathbf{t}_i) \in \mathrm{SE}(3)$, one per residue, where $R_i \in \mathrm{SO}(3)$ is the orientation of an idealized local coordinate system built from the N–Cα–C atoms and $\mathbf{t}_i \in \mathbb{R}^3$ is the Cα position. This representation is *complete*: idealized bond geometry lets the full backbone be reconstructed from frames alone. Diffusion is then defined *intrinsically* on the manifold:

- **Translations** diffuse in $\mathbb{R}^3$ with ordinary Gaussian noise.
- **Rotations** diffuse on $\mathrm{SO}(3)$ via the isotropic Gaussian distribution on the rotation group, parameterized by the exponential map of $\mathfrak{so}(3)$.

Both operations respect the group structure, so noisy intermediates remain valid frame collections — no broken chains by construction. The network's job is to predict, at each noise level $t$, the clean frames $T_0$ (or equivalently the score), from which the reverse step is computed. This frame-based SE(3) diffusion was developed jointly by Trippe, Yim, and colleagues and is the geometric core shared, with variations, by RFdiffusion, Chroma, and FrameDiff [1,2].

### 3.2 RFdiffusion: fine-tuning a predictor into a generator

RFdiffusion's central insight: a structure-prediction network *already knows* the distribution of protein backbones, having been trained to map noisy, incomplete information to clean structures. Watson et al. fine-tuned **RoseTTAFold** — a three-track network processing 1D sequence, 2D distance/orientation, and 3D coordinate information — on a *denoising* task: given frames corrupted by the forward SE(3) diffusion process at time $t$, predict the clean frames [1]. The RoseTTAFold weights provide a strong structural prior, and the SE(3)-equivariant denoising head learns the score of the backbone distribution.

Training used redundancy-clustered PDB structures with ~200 reverse steps at inference. Conditioning is implemented through the input features:

| Conditioning mode | Input specification | Output |
|---|---|---|
| Unconditional monomer | Chain length $N$ | Novel $N$-residue backbone |
| Motif scaffolding | Fixed motif frames + mask | Scaffold around the motif |
| Binder design | Target structure + hotspot residues | Binder backbone at interface |
| Symmetric oligomer | Symmetry group ($C_n$, $D_n$, $T$, $O$, $I$) | Symmetric assembly |
| Partial diffusion | Starting backbone + $t_{\text{partial}}$ | Diversified variant |

Crucially, RFdiffusion generates **backbones only** (poly-glycine placeholders); ProteinMPNN assigns sequences, decoupling the geometric problem of fold space from the combinatorial problem of sequence space.

### 3.3 Chroma: joint sequence–structure diffusion

Chroma, developed by Ingraham et al. at Generate Biomedicines, takes a different architectural path: it models sequence and structure *jointly* with a shared graph neural network backbone [2]. Its backbone diffusion operates on Cα coordinates with polymer-physics-informed anisotropic noise, while its sequence and side-chain decoders are *diffusion-aware* — trained across all diffusion times $t \in [0,1]$, not just clean structures. This yields a tunable robustness knob: exact design at $t = 0$ versus robust design at $t \approx 0.5$, where the sequence is optimized to fold into a *neighborhood* of the target backbone rather than the backbone exactly. On 50,000 unconditional backbones, robust design substantially improved one-shot refolding as judged by AlphaFold and ESMFold, with only Ångström-scale relaxation of the target [2].

Chroma's conditioner networks additionally inject natural-language and functional annotations, symmetry operators, and shape constraints — a first step toward *specification-driven* protein design, though text-to-protein fidelity remains an active frontier.

### 3.4 The validation cascade in detail

A diffusion sample is a hypothesis, not a result. The community-standard pipeline, codified in the RFdiffusion repository [8], is:

```python
# Canonical diffusion -> design -> validate pipeline
backbones = rfdiffusion.sample(n=1000, contigs="70-100", hotspots=target_hotspots)
sequences = proteinmpnn.design(backbones, num_seqs_per_backbone=8, temperature=0.1)
for seq in sequences:
    pred = alphafold2.predict(seq, use_msa=False)          # single-sequence
    sc_rmsd = rmsd(pred.ca_coords, design.ca_coords)
    if pred.mean_plddt > 90 and sc_rmsd < 2.0 and pred.ptm > 0.8:
        candidates.append(seq)                              # order for synthesis
# Binder-specific: AF2 with target templating, require pAE_interaction < 10
```

For binders, the filtering is stricter: AlphaFold2 is run on the binder–target complex with an initial-guess protocol, and designs with predicted aligned error across the interface (**pAE_interaction**) above 10 Å are discarded — the Baker lab reports that designs failing this filter are "not worth ordering" [8]. This cascade typically retains 1–20% of samples computationally, and of those, a substantial fraction validate experimentally — the inversion of the Rosetta-era economics.

---

## 4. Deep Dive

### 4.1 Diffusion on the SE(3) manifold: why Euclidean noise fails

Consider the naive approach: add isotropic Gaussian noise to Cα coordinates and learn to denoise. The problem is that the *data manifold* — the set of coordinate vectors realizable as protein backbones — has measure zero in $\mathbb{R}^{3N}$ and is highly curved: bond lengths, bond angles, and Ramachandran preferences carve a thin, twisted submanifold. Euclidean diffusion immediately leaves this manifold, and the network must waste capacity learning basic stereochemistry rather than fold-level structure. Worse, the score $\nabla \log p_t$ in ambient space points partly *off* the manifold, so reverse sampling accumulates geometric errors that manifest as chain breaks.

The frame representation solves this by construction: translations diffuse by Brownian motion on $\mathbb{R}^3$, rotations by Brownian motion on $\mathrm{SO}(3)$, so the learned score is a vector field on $\mathrm{SE}(3)^N$ and every reverse step lands on the manifold. Bond geometry is then *exact* by idealization, and the network's full capacity is devoted to *fold space itself* [1].

### 4.2 Inside RFdiffusion: architecture and training

RFdiffusion inherits RoseTTAFold's three tracks: the 1D track processes per-residue features (here dominated by the diffusion time embedding and positional encodings, since sequence is absent), the 2D track processes pair features, and the 3D track operates on the frames via SE(3)-equivariant attention. The denoising head predicts the clean frames $\hat{T}_0$ directly, and the training loss combines frame-aligned point error (FAPE)-style terms on Cα positions and orientations with auxiliary losses on distograms and backbone torsions. Fine-tuning rather than training from scratch matters enormously: RoseTTAFold's weights encode a prior over *all of known fold space*, so RFdiffusion generalizes to topologies absent from its fine-tuning set and produces genuinely novel folds — designs with TM-scores below 0.5 to any PDB entry are routine [1].

Inference runs the reverse process for 50–200 steps with **self-conditioning** (feeding the previous $\hat{T}_0$ prediction back as input). **Partial diffusion** — initializing from a noised native backbone at $t_{\text{partial}} < T$ — enables controlled diversification for affinity maturation and scaffold hopping.

### 4.3 Chroma's joint model and programmable conditioning

Chroma's thesis is that sequence and structure should never have been separated. Its backbone network and its sequence/side-chain decoders share a common graph neural network trunk, and because the decoders are trained across all diffusion times, a single model performs backbone generation, inverse folding, and side-chain packing as special cases of one denoising objective. The practical payoff is the *robustness dial*: designing at $t = 0.5$ asks ProteinMPNN-like decoders to find sequences compatible with an *ensemble* of nearby backbones, which empirically rescues designs that would fail exact refolding — a form of learned tolerance to the model's own backbone errors [2].

Chroma's conditioners deserve emphasis. Beyond the geometric conditioning shared with RFdiffusion (motifs, symmetry, binders), Chroma accepts functional and textual conditioning: subcellular localization, molecular function annotations, and natural-language prompts are encoded and injected into the diffusion trajectory. This is a first step toward *specification-driven* design, though text-to-protein fidelity remains an active frontier.

### 4.4 ProteinMPNN and the self-consistency filter

ProteinMPNN (Dauparas et al., *Science* 2022) is a message-passing network that autoregressively decodes sequences conditioned on backbone geometry, trained with noise augmentation for robustness to diffusion backbones' imperfections [3]. Its 52.4% native sequence recovery (vs. 32.9% for Rosetta) understates its value: design quality is measured by *foldability*, and ProteinMPNN sequences are predicted by AlphaFold2 to adopt their targets with far higher confidence than Rosetta-designed ones. Experimentally, ProteinMPNN designs of myoglobin variants expressed solubly and showed increased thermostability relative to native myoglobin, with 8 of 60 designs passing stringent self-consistency filters (pLDDT > 85, Cα RMSD < 1.0 Å) where the native sequence itself scored pLDDT 50.6 [3].

The self-consistency filter can be formalized as the statistical backbone of the paradigm:

> **Designability criterion:** A backbone $B$ is *designable* if there exists a sequence $s$ with $\text{pLDDT}(\text{AF2}(s)) > 90$, $\text{RMSD}(\text{AF2}(s), B) < 2\,\text{Å}$, and $\text{pTM}(\text{AF2}(s)) > 0.8$, where AF2 denotes single-sequence AlphaFold2 prediction.

Diffusion models are, in this precise sense, *samplers of designable backbones*: RFdiffusion's unconditional samples pass these filters at rates far exceeding any previous generative method, which is why the downstream experimental hit rates are high.

### 4.5 Motif scaffolding and de novo binder design

Motif scaffolding is the flagship *conditional* application. Given a functional motif — a constellation of residues in a fixed geometry, such as an enzyme active site or a binding epitope — the task is to generate a protein scaffold that holds the motif rigidly while folding stably on its own. RFdiffusion solves 23 of 25 diverse scaffolding benchmark problems, versus 15 for the previous best method (hallucination-based design) [1]. The mechanism is elegant: motif frames are clamped throughout the reverse diffusion (their noise is zeroed), and the scaffold diffuses *around* them, with the network's learned prior filling in compatible structure.

Binder design extends this to protein–protein interfaces: conditioned on a target and interface *hotspot* residues, RFdiffusion generates a shape-complementary binder backbone (poly-glycine), ProteinMPNN–FastRelax assigns sequence, and AF2 complex prediction with pAE_interaction < 10 filters. Across five targets — SARS-CoV-2 spike RBD, influenza hemagglutinin, IL-7Rα, PD-L1, and TrkA — the experimental success rate was **19%**, approximately 100-fold better than prior Rosetta-plus-docking pipelines, with the improvement attributed roughly equally to better backbones (~10×) and better AF2 filtering (~10×) [1]. Designed interfaces are *novel*: they do not recapitulate known binding modes from the PDB, confirming genuine generation rather than memorization.

---

## 5. Empirical Results

### 5.1 Unconditional generation and structural novelty

RFdiffusion samples 60–600-residue monomers across all major fold classes with state-of-the-art self-consistency (pLDDT > 90, sub-2 Å RMSD), and most designs have TM-score < 0.6 to the nearest PDB entry — genuinely new folds [1]. Chroma's 50,000-backbone set shows comparable designability, with robust design ($t = 0.5$) improving refolding across length and novelty strata [2].

### 5.2 Symmetric oligomers

Symmetry-constrained diffusion produced cyclic ($C_2$–$C_6$), dihedral, tetrahedral, octahedral, and icosahedral assemblies. Of 608 experimentally tested symmetric designs, **87 were confirmed** by size-exclusion chromatography to assemble as designed, with negative-stain EM validating the intended architectures — including ring-like $C_6$ assemblies visualized directly [1]. This remains one of the strongest demonstrations that diffusion models internalize *global* geometric constraints, not just local backbone statistics.

### 5.3 Scaffolding benchmarks and enzyme design

Beyond the 23/25 scaffolding benchmark, RFdiffusion scaffolded enzyme active sites and metal-binding sites, with hundreds of designs experimentally characterized. **RFdiffusion2** operates directly from atomic-level active-site geometries — no pre-indexed backbone positions — solving all 41 benchmark cases (versus 16 for v1) and yielding functional retroaldolase and hydrolase designs from under 96 sequences per reaction [10]. A striking application: scaffolding the p53 helix that binds MDM2 produced a binder roughly **1,000-fold tighter** than the natural peptide it was designed to outcompete [10].

### 5.4 Binder design and cryo-EM validation

The headline experimental result is the HA_20 binder against influenza hemagglutinin: a 2.9 Å cryo-EM structure of the designed complex shows **0.63 Å backbone RMSD** to the computational model — atomic-level agreement between a purely *in silico* design and physical reality [1]. The paradigm extends to antibodies: fine-tuned RFdiffusion designed VHH and scFv antibodies against influenza HA, *C. difficile* toxin B, and a peptide–MHC complex, with cryo-EM confirming correct folds and poses — including atomically accurate conformations of all six CDR loops for one TcdB scFv — and OrthoRep maturation reaching single-digit nanomolar affinity [11].

| Task | Metric | RFdiffusion result | Prior best |
|---|---|---|---|
| Binder design (5 targets) | Experimental hit rate | 19% | ~0.1–0.2% (Rosetta) |
| Motif scaffolding | Benchmark problems solved | 23/25 | 15/25 (hallucination) |
| Symmetric oligomers | SEC-confirmed | 87/608 | — |
| Cryo-EM validation (HA_20) | Backbone RMSD to design | 0.63 Å | — |
| RFdiffusion2 active sites | Benchmark solved | 41/41 | 16/41 (RFdiffusion v1) |

---

## 6. Limitations

Honest accounting: **polar interfaces remain hard** — all five RFdiffusion binder targets present non-polar interfaces, and polar epitopes show markedly lower hit rates. **Ligands are modeled implicitly**, limiting true enzyme design. **Length is capped** at roughly 60–600 residues; membrane proteins remain out of reach. **Atomic-level validation is thin**: the 0.63 Å cryo-EM result is a *single* structure; most designs are confirmed only by SEC, BLI, or nsEM. **Absolute hit rates remain modest** — the pipeline is a screening paradigm (thousands of designs distilled to dozens of tests), not a one-shot oracle. Finally, the self-consistency filter inherits AlphaFold2's biases, potentially penalizing novel-but-foldable topologies.

## 7. Conclusion

In three years, protein design has moved from energy-function heuristics with sub-percent hit rates to diffusion-based generative models with double-digit experimental success and atomic-level validation. RFdiffusion [1] showed that a structure-prediction network, fine-tuned to denoise, becomes a universal backbone generator; Chroma [2] showed that sequence and structure can be co-designed in one diffusion framework; ProteinMPNN [3] and the AlphaFold2 self-consistency cascade turned sampling into engineering. The 100-fold binder-design improvement and 0.63 Å cryo-EM validation mark a phase transition in what is computationally designable. The trajectory points toward **all-atom diffusion** — side chains, ligands, and nucleic acids diffused alongside backbones — and toward tighter experimental coupling, where each design–build–test cycle refines the generative prior. The remaining gap between specification and function — polar interfaces, dynamics, *in vivo* behavior — defines the coming decade's research program.

---

## References

[1] Watson, J. L. et al. De novo design of protein structure and function with RFdiffusion. *Nature* **620**, 1089–1100 (2023). https://doi.org/10.1038/s41586-023-06415-8

[2] Ingraham, J. B. et al. Illuminating protein space with a programmable generative model. *Nature* **623**, 1070–1078 (2023). https://doi.org/10.1038/s41586-023-06728-8

[3] Dauparas, J. et al. Robust deep learning–based protein sequence design using ProteinMPNN. *Science* **378**, 49–56 (2022). https://www.science.org/doi/10.1126/science.add2187

[4] Ho, J., Jain, A. & Abbeel, P. Denoising diffusion probabilistic models. *Adv. Neural Inf. Process. Syst.* **33**, 6840–6851 (2020). https://arxiv.org/abs/2006.11239

[5] Song, Y. et al. Score-based generative modeling through stochastic differential equations. *ICLR* (2021). https://arxiv.org/abs/2011.13456

[6] Jumper, J. et al. Highly accurate protein structure prediction with AlphaFold. *Nature* **596**, 583–589 (2021). https://doi.org/10.1038/s41586-021-03819-2

[7] Baek, M. et al. Accurate prediction of protein structures and interactions using a three-track neural network. *Science* **373**, 871–876 (2021). https://doi.org/10.1126/science.abj8754

[8] RosettaCommons. RFdiffusion source code and binder-design protocols. https://github.com/RosettaCommons/RFdiffusion

[9] Kuhlman, B. et al. Design of a novel globular protein fold with atomic-level accuracy. *Science* **302**, 1364–1368 (2003). https://doi.org/10.1126/science.1089427

[10] Watson, J. L. et al. Expanding protein function with RFdiffusion2: active-site scaffolding from atomic-level specifications. *Technology Networks* summary of preprint (2025). https://www.technologynetworks.com/tn/articles/generative-ai-for-protein-design-how-rfdiffusion-proteinmpnn-and-diffusion-models-are-engineering-414657

[11] Bennett, N. R. et al. Atomically accurate de novo design of antibodies with RFdiffusion. *bioRxiv* (2024). https://pmc.ncbi.nlm.nih.gov/articles/PMC10983868/

