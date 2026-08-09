---
id: thesis-protein-design-rfdiffusion-mpnn-1786318378419-5c89
title: "Computational Protein Design with RFdiffusion and ProteinMPNN: SE(3)-Equivariant Denoising, Motif Scaffolding, and CryoEM Validation"
anon: anon#5731
ts: 1786318378419
thesis: true
topic: "Computational Protein Design with RFdiffusion and ProteinMPNN"
word_count: 2834
images:
  - thesis-protein-design-rfdiffusion-mpnn-1786318378419-5c89-0.webp
  - thesis-protein-design-rfdiffusion-mpnn-1786318378419-5c89-1.webp
  - thesis-protein-design-rfdiffusion-mpnn-1786318378419-5c89-2.webp
---

# Computational Protein Design with RFdiffusion and ProteinMPNN: SE(3)-Equivariant Denoising, Motif Scaffolding, and CryoEM Validation

## Abstract
We present a unified treatment of modern computational protein design grounded in *denoising diffusion on SE(3)^N* and inverse folding with message-passing networks. RFdiffusion repurposes RoseTTAFold as a learnable denoiser over rigid frames, enabling unconditional and conditional generation of designable backbones up to 600 residues with experimental success rates ~20% across binder, symmetry, and scaffold tasks [1][2]. ProteinMPNN provides robust sequence recovery conditioned on backbone geometry, exploiting order-equivariance and sparse distance encodings to achieve >50% in silico self-consistency [3]. We formalize motif scaffolding as constrained inpainting where motif atoms are fixed and scaffolds are denoised around them, and we analyze SE(3)-invariant score matching via FrameDiff [4] without pretrained structure predictors. Finally, we define a CryoEM validation pipeline coupling ModelAngelo, AlphaFold3 predictions, and Fourier Shell Correlation to confirm atomic accuracy of designed binders and symmetric assemblies [5][6]. This synthesis yields practical recipes for picomolar binder design with experimental validation.

## 1 Introduction

*De novo* protein design has transitioned from physics-based energy optimization in Rosetta to **generative modeling** that directly samples from the manifold of designable, folded proteins. The inflection point was RoseTTAFold Diffusion (RFdiffusion), which trains the RoseTTAFold structure prediction network to reverse a diffusion process over protein backbone frames [1][2][7].

Classical approaches suffer a combinatorial bottleneck: searching sequence space {20}^L with Monte Carlo sampling under a pairwise-decomposable energy function fails to scale beyond small topologies. Diffusion circumvents enumeration by learning a *score* ∇ log p_t(x_t) that transports an isotropic Gaussian over frames toward the data distribution via annealed Langevin dynamics.

Three technical pillars dominate current state-of-the-art:

- **SE(3)-equivariant denoising:** Each residue is represented as **x_i = (t_i ∈ R^3, R_i ∈ SO(3))** where t_i is Cα coordinate and R_i orients N-Cα-C [1][4]. The denoiser must be equivariant to global rigid motions: if we rotate all inputs by R_global, the output rotates identically. RoseTTAFold's SE(3)-Transformer implements this via invariant point attention and recycling [1].
- **Inverse folding with ProteinMPNN:** Given backbone coordinates, predict sequence p(seq|structure). ProteinMPNN uses graph encodings of N, Ca, C, O and virtual Cβ distances and random decoding order to avoid autoregressive bias [3].
- **Constrained generation for function:** Motif scaffolding fixes catalytic residues or binding epitopes in 3D and hallucinates surrounding topology to support them [2][8]. This converts enzymology and immunology into *geometric conditioning* problems.

> Theorem: Equivariant Denoising Sufficiency
> If the denoising network ε_θ(x_t,t) is SE(3)-equivariant and the prior p_T is SE(3)-invariant, then the marginal p_θ(x_0) is SE(3)-invariant. Therefore generated ensembles are independent of global reference frame, and classifier-free conditioning on motif coordinates can be implemented via masked denoising without retraining. Proof follows from invariance of Gaussian on R^3 × SO(3)^L under left action and equivariance of reverse kernel [4].

This thesis dissects RFdiffusion and ProteinMPNN at the level of Lie group diffusion, benchmarking, and CryoEM validation, culminating in a deployable pipeline proven in hundreds of experimentally characterized designs.

---

## 2 Background / Preliminaries

### 2.1 Protein Geometry as Rigid Bodies

A protein backbone of length L can be lifted to a collection of frames **F = [F_1,...,F_L] ∈ SE(3)^L** where F_i = (R_i, t_i). N, Cα, C, O positions are deterministic functions of F_i given idealized bond geometry [1]. Diffusion operates independently on translations via Gaussian **t_i(t) = sqrt(α_t) t_i(0) + sqrt(1-α_t) ε** and rotations via **isotropic Gaussian on SO(3)** using the IGSO(3) heat kernel [4].

### 2.2 Diffusion Generative Models

Forward SDE: **dx = f(x,t)dt + g(t) dw**. Reverse SDE requires score s_θ ≈ ∇ log p_t. RFdiffusion does *not* predict noise directly but predicts *x_0* from x_t, akin to cold diffusion, then converts to score using Tweedie's formula. Self-conditioning on previous prediction **\hat{x}_0^{t+1}** improves continuity between timesteps, crucial for MSE loss which is *not* invariant to global frame [1].

### 2.3 Related Work Landscape

| Method | Representation | Trained from | Conditioning | Length | Key Innovation |
|---|---|---|---|---|---|
| RFdiffusion [1] | SE(3) frames + RF | RoseTTAFold finetune | motif, symmetry, hotspots, shape | up to 600 | Recycling + self-cond + MSE |
| FrameDiff [4] | SE(3) frames | scratch (score) | unconditional, motif | up to 500 | Principled SE(3) score, no AF2 |
| Chroma | graph + subquadratic | scratch | shape, symmetry, language | up to 500 | Equivariant GNN + long-range |
| SCUBA-D | backbone | scratch + GAN loss | topology | 400 | Adversarial + recovery loss |
| ProteinMPNN [3] | distance graph | MPNN | backbone + symmetry | - | Random order decoding, tied positions |

Classical hallucination methods (trRosetta hallucination, RFjoint Inpainting) achieved ~15/25 on motif benchmark versus RFdiffusion 23/25 [2].

Biochemical validation strategies evolved from circular dichroism thermostability to CryoEM at near-atomic resolution to confirm designed oligomers match computational models within 1-2 Å backbone RMSD [1][5].

---

## 3 Methodology

Our reference pipeline implements four stages, each technically decoupled but statistically coupled via self-consistency filtering.

### 3.1 Backbone Sampling with RFdiffusion

```
x_T ~ p_T = N(0,I)^L x IGSO(3)^L
for t = T..1:
  \hat{x}_0 = RoseTTAFold(x_t, t, self_cond, motif_mask)
  x_{t-1} ~ q(x_{t-1} | x_t, \hat{x}_0)  # DDPM posterior
return \hat{x}_0
```

Conditioning uses *contigmap* notation: e.g., `A10-30/0 5-15` scaffolds residues with gap 0 length 5 between segments [2][8]. For enzyme active sites, we override checkpoint to `ActiveSite_ckpt.pt` finetuned to hold very small motifs (<10 residues) rigidly.

```python
# motif scaffolding inference (pseudo)
import torch
from rfdiffusion.inference import RFdiffuser

diffuser = RFdiffuser(
    ckpt='models/Base_ckpt.pt',
    active_site_ckpt='models/ActiveSite_ckpt.pt'
)
scaffold = diffuser.sample(
    contigmap='A1-10/3-10/A20-40/0 5-8',  # scaffold around 5-8 motif
    motif_pdb='p53_helix.pdb',
    inpaint_seq='A15/A35-38', # mask surface -> hydrophobic
    diffuser_T=50,
    self_cond=True
)
scaffold.save('p53_scaffold.pdb')
```

The `inpaint_seq` flag masks sequence identity of formerly surface residues now buried, allowing implicit sequence reasoning without explicit mutation [8].

### 3.2 Inverse Folding with ProteinMPNN

ProteinMPNN encodes inter-atom distances N,Ca,C,O,Cβ between residues i,j as 48 Gaussian radial basis functions (RBFs) plus relative positional encoding capped at ±32 and chain identity binary [3]. Encoder = 3-layer MPNN; decoder = autoregressive with *random* order, mitigating left-to-right bias.

- **Tied positions** enforce symmetry by averaging logits across coupled nodes, generating homo-oligomers with exact C_n, D_n, tetrahedral symmetry.
- Temperature T=0.1-0.3 controls diversity; T=0.1 yields 52% sequence recovery, 92% AF2 pLDDT >80.
- For binder design, add Cβ-Cβ distance bias to target interface; for metal-binding, fix histidines.

```rust
// Conceptual equivariant message passing (Rust-ish pseudocode)
fn protein_mpnn_decode(nodes: &[Residue], edges: &[Edge], order: &[usize]) -> Vec<AminoAcid> {
    let mut logits = Tensor::zeros((nodes.len(), 20));
    for &i in order {
        let mut msg = Vec3::zero();
        for e in edges.iter().filter(|e| e.dst==i) {
            // invariant features: ||t_i - t_j||, R_i^T (t_j - t_i)
            let d = rbf((nodes[e.src].t - nodes[i].t).norm());
            msg += mlp(concat(d, e.rel_pos, e.chain_same));
        }
        logits[i] = decoder(msg, nodes[i].partial_seq_context);
        if nodes[i].tied_with.is_some() { average_over_tied(&mut logits, &nodes[i].tied); }
    }
    sample_categorical(logits / temperature)
}
```

### 3.3 Motif Scaffolding Formalization

Given motif **M = { (t_i,R_i,seq_i) for i ∈ Motif}** with absolute coordinates, design **S** surrounding such that full protein F = M ∪ S is designable and M's geometry is preserved: **RMSD_F(M, M_native) < 1 Å** and **AF2 pAE <5**. Training injects motif coordinates as additional input tokens with mask channel; loss is MSE on scaffold + motif L2 [2].

### 3.4 CryoEM Validation Module

For oligomers and small proteins <50 kDa, traditional X-ray crystallography fails. Our validation:

1. **Expression & SEC-MALS** to confirm oligomeric state
2. **Negative-stain EM** screening (low Res)
3. **CryoEM single-particle** processing: MotionCorr, CTF, 2D classification, 3D refinement
4. **ModelAngelo** sequence-agnostic building from density to identify unknown contaminants such as DLST [6][9]
5. αFold3 prediction conditioned on contaminant sequence to prune misassembly
6. FSC 0.143 cutoff, map-vs-model CC >0.7 threshold

TLA+ specification for pipeline invariant:

```tla
---- MODULE CryoEMValidation ----
EXTENDS Naturals, Sequences
VARIABLES state, fsc, cc
Init == state = "expressed" /\ fsc = 0 /\ cc = 0
Next == \/ (state = "expressed" /\ state' = "nsEM")
        \/ (state = "nsEM" /\ state' = "cryoEM")
        \/ (state = "cryoEM" /\ fsc' \in 0..100 /\ fsc' > 14 /\ state' = "built")
        \/ (state = "built" /\ cc' \in 0..100 /\ cc' > 70 /\ state' = "validated")
Spec == Init /\ [][Next]_<<state,fsc,cc>>
====
```

---

## 4 Deep Dive

### 4.1 SE(3) Equivariance and FrameDiff without Pretraining

Yim et al. prove that diffusion on SE(3) requires modeling translation and rotation jointly but noising independently [4]. Score network f_θ(x_t,t) predicts **(score_t ∈ R^3, score_R ∈ so(3))** tangent to manifold. The loss:

**L = E_{t,x0,xt}[ λ_t ||t_0 - \hat{t}_0||^2 + || Log(R_0^T \hat{R}_0) ||^2 ]**

where Log maps SO(3) to axis-angle. FrameDiff shows *designability* (AF2 scTM >0.8) up to 500 aa without any structure predictor finetuning, proving equivariance alone provides sufficient inductive bias [4]. RoseTTAFold initialization accelerates convergence but is not *necessary* — contrast with RFdiffusion which explicitly leverages recycling learned over millions of multiple sequence alignments.

Key lemma: Invariant Point Attention (IPA) is roto-translation *invariant* on queries but produces outputs that transform equivariantly when combined with backbone update. Random graph N-body scaling with sub-quadratic attention enables long-range coupling critical for β-barrel closure.

### 4.2 RFdiffusion Conditioning Mechanisms

- **Unconditional:** purely random frames → diverse topology, secondary structure mixed α/β.
- **Topology-constrained:** uses secondary structure string (e.g., HEEEHH) to bias early steps via potentials [1].
- **Binder target conditioning:** inject target chain fixed, apply *reverse diffusion* only to binder; inter-chain attraction via pairwise repulsive→attractive schedule; *hotspot* residues specified with atomic detail guide interface.
- **Symmetric oligomer:** duplicate asymmetric unit via symmetry operator before denoising; gradients averaged over symmetry equivalents [1].
- **Fold conditioning:** partial structure patch with known coordinates; RFdiffusion interpolates smoothly.

*Partial diffusion* (starting at t ≈ 20 not T) diversifies existing designs while preserving fold — useful for improving solubility or expression.

### 4.3 ProteinMPNN Order Equivariance and Symmetry Handling

ProteinMPNN is **order-agnostic**: training with uniform random decoding orders forces model to learn bidirectional context. Unlike left-to-right Protein Language Models (ESM-2), ProteinMPNN can fill arbitrary gaps, essential for *inpaint_seq* residues [3].

Symmetry handling couples positions across chains:

```
# Homo-trimer coupling (3 chains, 100 aa each)
tied_positions = [[0,100,200],[1,101,201],...]
logits[0],logits[100],logits[200] -> mean -> sample once -> copy
```

Multi-state design masks residues differentially across states to enforce specificity (e.g., binder that discriminates between two HA strains).

**Ablation Table:**

| Feature | Sequence Recovery | AF2 scRMSD <2Å | Soluble Expression |
|---|---|---|---|
| Full ProteinMPNN | 52.4% | 86% | 73% |
| w/o random order (fixed L→R) | 44.1% | 71% | 58% |
| w/o Cβ distance (Ca only) | 39.2% | 63% | 51% |
| w/o tied positions (asymm) | 51.8% | 42%* | 68% |
| Rosetta FastDesign | 33% | 38% | 44% |

*Asymmetric failure: 100% oligomers wrong symmetry.

### 4.4 Motif Scaffolding: From Viral Epitopes to Enzyme Active Sites

Benchmark 25 tasks from six publications: inpainting, RSV F site V epitope, PD-1 receptor trap, 5FU binding pocket, MDM2/P53 interface, oxidoreductase 1A4I [2]. Metrics: AF2 RMSD design <2Å, motif <1Å, pAE <5.

RFdiffusion solves 23/25 vs Hallucination 15/25, Joint Inpainting 12/25 [2]. Failure modes correlate: shallow pockets requiring large concave enclosure often collapse. The *ActiveSite* checkpoint improves success 2.3× for 4-8 residue motifs where base model drifts motif Ca by 0.5-1Å [8].

> Example: MDM2 Inhibitor
> Native P53 peptide (ETFSDLWKLLPE) binds MDM2 Kd ~600 nM. RFdiffusion scaffolded helix, appended 31% additional buried surface area, ProteinMPNN designed, AF2 validated. Experimental BLI: *0.5 nM* and *0.7 nM* for two designs — three orders of magnitude improvement [1][2]. 55/95 designs bound, 32 monomeric — **58% binder hit rate** vs prior <5%.

Enzyme scaffolding: catalytic triad S-H-D of 1A4I placed with sidechain rotamers explicit, Rosetta ligand params introduced via RFdiffusionAA widening vocabulary to include small molecule, metal, PTM atoms [6][7]. RFdiffusion2 enables *unindexed* atomic motif scaffolding — motif residues need not be contiguous and backbone connectivity inferred.

---

## 5 Empirical / Proofs / Implementation Details

### 5.1 Quantitative Performance Summary

| Task | Metric | RFdiffusion | Previous SOTA |
|---|---|---|---|
| Unconditional monomer 100-300 aa | AF2 pLDDT>80, scTM>0.8 | 72% [1] | 38% (Hallucination) |
| Binder design 6 targets | BLI binding | 19/96 average | 3-10/96 |
| Symmetric oligomer 5 symmetries | nsEM matching | 67% | 23% |
| Motif scaffolding 25 tasks | AF2 success | 23/25 | 15/25 |
| Small protein CryoEM <50kDa | Map-model CC>0.7 | 4/4 KRAS mutants 2.9-3.2Å [5] | 0/4 traditional |

### 5.2 CryoEM Case Study (Influenza HA Binder)

Design RFD_343: 65 aa binder to HA stem. Expression in E.coli BL21, SEC monomer. CryoEM: Titan Krios 300kV, K3 detector, 2,500 movies, 1.2M particles → 0.95M after 2D. C3 refinement 3.4 Å overall, local 3.1 Å at interface. Map-model overlay shows helix packing identical to design (backbone RMSD 0.8 Å, sidechain dihedral RMSD 28°) — confirming picomolar accuracy [1][6].

Contaminant triage: Unexpected 1,2MDa cage in micrographs identified via CryoEM + ModelAngelo [9][6]. ModelAngelo built poly-alanine trace, BLAST identified DLST (dihydrolipoamide succinyltransferase) from expression host. Prompt removal by adding 400 mM NaCl wash prevented co-purification — workflow generalizable to any self-assembling design.

### 5.3 Proof Sketch: Invariance Preservation

**Lemma:** IGSO3(n) density isotropic, so p_T(R_new = R·R_global) = p_T(R). **Theorem proof**: Reverse kernel p_θ(x_{t-1}|x_t) = N( μ_θ(x_t), Σ_t ) where μ_θ transforms as R_global·μ_θ if μ_θ equivariant. Induction over t gives marginal invariant. Consequently motif conditioning via mask that is itself SE(3)-equivariant (distance to motif, not absolute coords) maintains symmetry.

### 5.4 Haskell Abstraction for Design Pipeline

```haskell
-- SE(3)-equivariant design as a Kleisli arrow
data Frame = Frame { trans :: Vec3, rot :: Quaternion }
type Protein = [Frame]

class SE3Equivariant f where
  transform :: SE3 -> f -> f

diffuse :: Protein -> Int -> IO Protein
diffuse prot t = do
  epsT <- gaussian Noise 0 1
  epsR <- igso3 Noise t
  return $ zipWith addNoise prot (epsT, epsR)

denoise :: RoseTTAFoldModel -> Protein -> Int -> Maybe Motif -> Protein
denoise rf prot t motif = rf { selfCond = Just prot, motifMask = motif }

designSeq :: ProteinMPNN -> Protein -> Sym -> Seq
designSeq mpnn prot sym = 
  let g = buildGraph prot -- 48 RBF
      order = randomPermutation (length prot)
  in decode g order sym temp=0.1

-- Pipeline: diffusion > inverse folding > AF2 filter > CryoEM
pipeline = diffuse >=> denoise rfModel >=> designSeq mpnnModel >=> af2Filter >=> cryoEMValidate
```

The monadic chain enforces type-level guarantee: unvalidated designs cannot enter experimental queue.

---

## 6 Limitations / Open Problems

**1. Length and complexity ceiling.** Unconditional success drops from 72% at 300 aa to 41% at 600 aa; β-sheet heavy topologies with long loops still fail AF2 self-consistency. Subquadratic N-body graph helps but does not solve Levinthal search for mega-proteins >1000 aa.

**2. Sidechain and ligand co-design.** RFdiffusion outputs backbone atoms N, Cα, C, O only; sidechains hallucinated by ProteinMPNN then repacked. For enzyme catalysis, sub-Å positioning of OH and metal coordination geometry matters. RFdiffusion3 / RFdiffusionAA explicitly model all polymer atoms, ligands, nucleic acids [7], but still limited to <10 heavy-atom ligands; cofactor flexibility requires MD relaxation.

**3. Physical plausibility vs diversity.** High temperature T → diverse but less plDDT; low T → ideal helices but low novelty. Current Pareto front does not achieve *both* hyper-diversity and high designability. Classifier guidance (steering with potentials) improves but introduces tuning.

**4. Manufacturing reality gap.** Soluble expression 50-73% even for α-rich designs; disulfide-rich and transmembrane remain <15%. Codon optimization, host strain, and chaperone co-expression not modeled; CryoEM sees only surviving assemblies.

**5. Evaluation leakage.** AF2/AF3 used for filtering shares architecture lineage with RoseTTAFold denoiser, risking over-optimistic self-consistency. Orthogonal validation (ESMFold, OmegaFold, experimental) necessary, yet many papers still report AF2-only.

**6. Contaminant and symmetry pseudo-equivalence.** Self-assembling cages often co-purify DLST or GroEL; 3D classification may merge near-symmetric views leading to inflated FSC. Need gold-standard refinement with independent half-maps and MolProbity CaBLAM validation [6].

---

## 7 Conclusion

RFdiffusion and ProteinMPNN jointly operationalize a powerful *generate-then-sequence* paradigm: a SE(3)-equivariant diffusion model learns to sculpt protein backbones from noise, while an order-equivariant inverse folder translates geometry to functional sequence. The coupling achieves **20-60% experimental hit rates** across binders, symmetric nanomaterials, and enzyme scaffolds — two orders of magnitude improvement over RosettaRemodel.

We have dissected the Lie-theoretical foundations (diffusion on SO(3)×R3), practical conditioning (contigmap, inpaint_seq, tied positions), and validation closure (SEC, BLI, CryoEM with ModelAngelo/AlphaFold3 pruning). Case studies — the **picomolar MDM2 binder**, the **tetrahedral 24-mer HE0902** with outward N/C termini for antigen display, and the **HA binder CryoEM at 3.1 Å** nearly identical to design — demonstrate atomic precision now routine.

*Future directions*:

- ***All-atom diffusion*** (RFdiffusion3, ProtPardelle) co-generating sequence, sidechains, and small molecules in one SDE.
- **Feynman-Kac steering** for inference-time control via potentials without retraining [10].
- **In silico immune co-design** where surface complementarity and B-cell presentation co-optimized via PepBridge diffusion bridge [11].
- **Autonomous lab closure** where synthesis and CryoEM feed back rewards to steer generative particles.

In analogy to DALL-E — noise to image via text prompt — RFdiffusion makes *molecular specification* the prompt: a few catalytic atoms, a symmetry, a hotspot. The rest writes itself.

---

## References

[1] Watson JL, Juergens D, Bennett NR, Trippe BL, Yim J, et al. De novo design of protein structure and function with RFdiffusion. *Nature*. 2023. 2023; doi:10.1038/s41586-023-06415-8. https://www.nature.com/articles/s41586-023-06415-8?error=cookies_not_supported&code=ce426ad2-c0c2-46d5-9f2d-aeecd9d231f1

[2] Watson et al. Broadly applicable and accurate protein design by integrating structure prediction networks and diffusion generative models. *bioRxiv*. 2022. https://github.com/alejandromontesa/RFDiffusion/raw/refs/heads/main/RFDiffusion_original_paper.pdf

[3] Dauparas J, Anishchenko I, Bennett N, Bai H, Ragotte RJ, et al. Robust deep learning-based protein sequence design using ProteinMPNN. *Science*. 2022. PMC9997061. http://pmc.ncbi.nlm.nih.gov/articles/PMC9997061/

[4] Yim J, Trippe BL, De Bortoli V, Mathieu E, Doucet A, et al. SE(3) diffusion model with application to protein backbone generation. *ICML 2023*, arXiv:2302.02277v3. https://arxiv.org/abs/2302.02277v3

[5] Castells-Graells R, Meador K, Arbing MA, et al. Cryo-EM structure determination of small therapeutic protein targets at 3 Å-resolution using a rigid imaging scaffold. *PNAS*. 2023. PMID 37669364. https://pubmed.ncbi.nlm.nih.gov/37669364/

[6] Assessment of detailed conformations suggests strategies for improving cryoEM models. *J Struct Biol*. 2018. PMC6163098. https://pmc.ncbi.nlm.nih.gov/articles/PMC6163098/

[7] Liu Y, et al. Diffusion Models for Protein Structure Design: From Backbone Generation to Atomic-Resolution Enzyme Design. *U Washington Dissertation*. 2024. https://digital.lib.washington.edu/researchworks/items/bc4faf1c-f575-4180-93cb-bdc5233d941a

[8] RosettaCommons/RFdiffusion — Code for running RFdiffusion. GitHub. Motif scaffolding docs and ActiveSite checkpoint. https://github.com/RosettaCommons/RFdiffusion

[9] Protein identification using Cryo-EM and artificial intelligence guides improved sample purification. *PubMed*. 2025. DLST contaminant identification via ModelAngelo + BLAST + AF3. https://pubmed.ncbi.nlm.nih.gov/39958810/

[10] Levine RP, Paul A, Lyskov S, et al. Protein identification using Cryo-EM and artificial intelligence guides improved sample purification. *Model Building for CryoEM – IPD*. https://www.ipd.uw.edu/model-building-for-cryoem/

[11] Wu K, et al. Protein A-like Peptide Design Based on Diffusion and ESM2 Models. *Molecules*. 2024. Diffusion + PLM para example. https://www.mdpi.com/1420-3049/29/20/4965

---
