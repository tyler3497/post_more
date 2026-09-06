---
title: "Diffusion Models for De Novo Protein Design: RFdiffusion, SE(3) Equivariance, and Sequence–Structure Co-Design with ProteinMPNN"
id: ths_1788654545517_6145
anon: anon#4P2T
ts: 1788654545517
type: thesis
images: ["ths_1788654545517_6145-0.webp", "ths_1788654545517_6145-1.webp", "ths_1788654545517_6145-2.webp", "ths_1788654545517_6145-3.webp"]
---

# Diffusion Models for De Novo Protein Design: RFdiffusion, SE(3) Equivariance, and Sequence–Structure Co-Design with ProteinMPNN

## Abstract

Denoising diffusion models have emerged as the dominant paradigm for *de novo* protein design, displacing physics-based search in a matter of months. This thesis develops the theory and practice of generative protein design on the special Euclidean group **SE(3)**, culminating in RFdiffusion, a model that fine-tunes the RoseTTAFold structure-prediction network as a denoising process over protein backbone frames [1]. We formalize forward and reverse diffusion on *SO(3) × R³*, characterize the invariant point attention mechanism inherited from AlphaFold2 [3], and prove the equivariance constraints that guarantee global rigid-motion invariance of the learned distribution. We then examine sequence–structure co-design with ProteinMPNN, an autoregressive inverse-folding network that achieves 52.4% sequence recovery on native backbones [2], and the orthogonal experimental-validation pipeline — ProteinMPNN sequence design followed by AlphaFold2 self-consistency filtering — that converts *in silico* samples into wet-lab success rates near 20% across binder, scaffold, and symmetric-assembly tasks [1]. Comparative analysis against hallucination-style activation maximization and from-scratch SE(3) diffusion (FrameDiff) [4] shows that pretraining on structure prediction is the decisive inductive bias. We close with limitations in conditional controllability, physical fidelity, and all-atom extension.

## 1. Introduction

Protein design is the inverse of protein folding: given a desired function, geometry, or symmetry, synthesize an amino acid sequence that folds into a structure realizing it. For five decades the field proceeded through physically motivated energy functions — Rosetta's score terms, fragment assembly, rotamer packing — with experimental success rates in the low single digits for ambitious tasks such as *de novo* binder design [2]. The arrival of AlphaFold2 [3] collapsed the structure-prediction side of the problem to near-atomic accuracy and, critically, supplied a reusable architectural substrate: the *invariant point attention* (IPA) module, the recycling scheme, and the SE(3)-equivariant frame representation that would become the generative engine itself.

Denoising diffusion probabilistic models (DDPMs), which had conquered image synthesis, appeared to transfer poorly to proteins at first: the backbone manifold is not Euclidean, the sequence–structure map is many-to-one and discontinuous, and physical plausibility is a far stricter constraint than visual plausibility. Watson *et al.* [1] broke this impasse by fine-tuning the RoseTTAFold prediction network on structure-denoising objectives, obtaining RFdiffusion, a generative model of backbones achieving order-of-magnitude improvements in experimental success: binder-design hit rates rose from below 0.5% with Rosetta pipelines to approximately 19% across five targets, and motif-scaffolding benchmarks improved from 15/25 to 23/25 solved problems relative to hallucination methods [1]. A cryo-EM structure of the designed binder HA_20 at 2.9 Å resolution matched the design model to 0.63 Å backbone RMSD, confirming that the generated geometry is physically realizable rather than merely plausible-looking [1].

This thesis is organized as follows. Section 2 reviews the background: protein backbone geometry as *SE(3)^N* frames, the AlphaFold2 IPA architecture, and inverse folding. Section 3 develops the diffusion methodology on *SE(3)*, including the forward noising process on *SO(3)* via the isotropic Gaussian, the equivariant denoiser, self-conditioning, and the auxiliary MSE loss that preserves inter-timestep continuity. Section 4 is the deep dive: (4.1) frame-based representations and IPA, (4.2) the mathematics of SE(3) equivariance, (4.3) ProteinMPNN and sequence–structure co-design, and (4.4) the binder-design and motif-scaffolding application stacks. Section 5 reports empirical results — experimental validation rates, comparison against hallucination and FrameDiff — and states the invariance guarantees. Section 6 enumerates limitations; Section 7 concludes.

## 2. Background

### 2.1 Protein backbones as rigid-body frames

A protein backbone of *N* residues can be represented economically. The heavy atoms *N–Cα–C–O* of each residue are rigidly connected by covalent bonds, so residue *i* is well approximated by a *frame*:

> **Definition 1 (Residue frame).** A residue frame is an element *Tᵢ = (Rᵢ, tᵢ) ∈ SE(3)*, where *Rᵢ ∈ SO(3)* is a rotation and *tᵢ ∈ R³* a translation, defined by placing the *Cα* at *tᵢ* and orienting idealized *N*, *Cα*, *C* coordinates via *Rᵢ*. The full backbone is *T = (T₁, …, T_N) ∈ SE(3)^N* [4].

This representation is the lingua franca of both AlphaFold2 [3] and RFdiffusion [1]: it reduces 4*N* atomic coordinates to *N* rigid bodies, captures bond-length and bond-angle constraints exactly, and makes the symmetries of the problem — rigid motions in *R³* — manifest.

### 2.2 Invariant point attention

AlphaFold2's structure module predicts frames by updating them with *invariant point attention* (IPA) [3]. IPA computes attention scores from scalar node and pair features (which are SE(3)-invariant) and uses the *attention to aggregate vector-valued* information expressed in each residue's local frame, guaranteeing that updates to frames are *equivariant* under global rotations and translations. RFdiffusion reuses this entire module wholesale: fine-tuning begins from RoseTTAFold's trained IPA weights, which is why the model can denoise with so little generative-specific training [1].

### 2.3 Inverse folding

Designing a backbone is only half the problem; a *sequence* must fold into it. ProteinMPNN [2] solves inverse folding with a message-passing encoder over backbone graphs and an autoregressive decoder with random masking. It achieves **52.4%** sequence recovery on native backbones versus 32.9% for Rosetta, expresses 73/96 designs solubly in *E. coli*, and — most remarkably — *rescues previously failed* Rosetta and AlphaFold designs of monomers, cyclic oligomers, and nanoparticles [2]. The design loop is therefore:

1. Sample backbone *T ~ p_θ(T | conditioning)* via diffusion.
2. Sample sequences *s ~ ProteinMPNN(s | T)*.
3. Validate by folding *s* with AlphaFold2/RoseTTAFold and computing the *self-consistency RMSD* (scRMSD) between the design and the prediction; keep designs with scRMSD < 2 Å [1].

### 2.4 Hallucination methods

Before diffusion, the state of the art for constrained design was *hallucination*: gradient ascent on the sequence (relaxed to logits) to maximize the predicted structure's confidence (pLDDT) under a frozen trRosetta or AlphaFold network, often with a motif-RMSD penalty [1]. Hallucination is powerful but brittle — it optimizes a surrogate (network confidence), requires careful restraint scheduling, and solves only 15/25 motif-scaffolding benchmarks [1]. Diffusion replaces optimization with *sampling from a learned distribution*, which is both more diverse and more robust.

---

## 3. Methodology

### 3.1 Forward diffusion on SE(3)^N

RFdiffusion and FrameDiff define a noising process independently on rotations and translations. For translations, standard Gaussian diffusion applies:

```
q(t_t | t_0) = N(t_0, σ_t² I)        # R³ diffusion, variance schedule σ_t
```

For rotations, the forward process diffuses on *SO(3)* via the *isotropic Gaussian* IGSO(3):

```python
# Forward noising of a residue frame at diffusion time t
R_noised = R_0 @ exp_map(uniform_axis() * sigma_t * randn())  # IGSO(3) perturbation
t_noised = t_0 + sigma_t * randn(3)                           # Euclidean perturbation
```

where `exp_map` is the Lie-algebra exponential *so(3) → SO(3)*. At *t = T* the distribution is approximately uniform over *SO(3)* and a broad Gaussian over *R³*: structureless noise [4].

### 3.2 The equivariant denoiser

The reverse process learns *p_θ(T_{t−1} | T_t)*. Rather than predicting the score directly, the network predicts the clean frames *T̂_0 = f_θ(T_t, t)* and the reverse step is computed analytically from the forward kernels. The denoiser *f_θ* is the fine-tuned RoseTTAFold (RFdiffusion) or a purpose-built IPA transformer (FrameDiff), and it must satisfy:

> **Theorem: Equivariant denoising implies invariant generation.** Let *f_θ* be SE(3)-equivariant, i.e. *f_θ(g · T_t, t) = g · f_θ(T_t, t)* for all rigid motions *g ∈ SE(3)*, and let the prior *p(T_T)* be SE(3)-invariant. Then every marginal *p_θ(T_t)* of the reverse chain is SE(3)-invariant; the model assigns equal density to rigidly transformed backbones and cannot memorize absolute coordinates.

This constraint is load-bearing: without it, the model could exploit the arbitrary global frame of the training PDBs and generate structures that are coordinate-system artifacts.

### 3.3 Training objective

Two terms dominate training. First, the frame loss between predicted and true clean frames:

```haskell
-- pseudo-Haskell: frame denoising loss
frameLoss :: SE3 -> SE3 -> Double
frameLoss pred true = rotLoss (rot pred) (rot true) + transLoss (trans pred) (trans true)
  where rotLoss   r1 r2 = frobeniusNorm (r1 - r2)          -- chordal distance on SO(3)
        transLoss t1 t2 = 0.5 * squaredNorm (t1 - t2)     -- MSE on translations
```

Second, an auxiliary *mean-squared error* on coordinates that is deliberately *not* invariant to the global frame — the authors note this non-invariance promotes continuity between consecutive denoising timesteps, preventing the trajectory from jumping between equivalent global placements [1]. Distogram and masked-language losses inherited from RoseTTAFold regularize further.

### 3.4 Self-conditioning

Inspired by AlphaFold's recycling, RFdiffusion conditions each denoising step on the model's own previous prediction of the clean structure *T̂_0^{(t+1)}*, concatenated to the input features with 50% dropout during training [1]. Ablations in [1] identify self-conditioning and the MSE auxiliary loss as the two decisive ingredients for *in silico* success rates; removing either collapses designability.

### 3.5 Conditioning and scaffolding

Generation is conditioned by *masking*: residues belonging to a functional motif (an enzyme active site, a metal-binding site, a binding hotspot) are held fixed or only lightly noised, while scaffold residues diffuse freely [1]. Symmetry conditioning (cyclic, dihedral, icosahedral) is imposed by replicating the asymmetric unit under the group action during denoising. Binder design conditions on the target protein's fixed frame with a hotspot mask on the interface [1].

```tla+
---- MODULE RFdiffusionStep ----
EXTENDS Naturals, Reals
VARIABLES frames, t, motifMask
ReverseStep ==
    /\ t > 0
    /\ frames' = Denoise(frames, SelfCondition(frames), t)
    /\ frames' = ConstrainMotif(frames', motifMask)   \* motif atoms re-anchored
    /\ t' = t - 1
====
```

---

## 4. Deep Dive

### 4.1 Frame-based diffusion versus atom-based diffusion

Diffusing raw atomic coordinates in *R^{3·4N}* is possible — Chroma and early protein diffusion attempts did exactly this — but it wastes capacity relearning covalent geometry. Frames hard-code the stiff degrees of freedom (bond lengths, angles) and leave only the soft ones (dihedrals, relative orientations) to the model. The comparison is stark:

| Approach | State space | Learns covalent geometry? | Needs pretrained net? | Designability |
|---|---|---|---|---|
| Atom diffusion (early Chroma-style) | *R^{12N}* | yes (wasteful) | no | moderate |
| FrameDiff [4] | *SE(3)^N* | no (built in) | no | good (≤500 aa) |
| RFdiffusion [1] | *SE(3)^N* | no (built in) | yes (RoseTTAFold) | excellent |

### 4.2 The mathematics of SE(3) equivariance

FrameDiff [4] supplies the principled foundation that RFdiffusion uses implicitly. A diffusion on *SE(3)^N* is *invariant* if *q(g·T_t | g·T_0) = q(T_t | T_0)* for all *g ∈ SE(3)*; the IGSO(3) × Gaussian forward process satisfies this by construction because both kernels depend only on relative transformations. The learned *score* *∇ log p_t* must then be *equivariant*, which IPA architectures guarantee by construction: attention weights are computed from invariant scalars, and vector updates are performed in local frames [3][4].

A subtle consequence: the model has no notion of "up." Generated proteins are uniformly distributed over global orientations — exactly as physics demands, since energy is rotation-invariant. Any leakage of absolute-frame information (e.g., via the non-invariant MSE auxiliary loss) is tolerated only because it is restricted to *inter-timestep continuity*, not the stationary distribution [1].

```rust
// SE(3) frame: rotation as quaternion, translation as vector
struct Frame { q: [f64; 4], t: [f64; 3] }

fn apply_rigid(g: &Frame, f: &Frame) -> Frame {
    // g · f: equivariant composition; network outputs must commute with this op
    Frame { q: quat_mul(&g.q, &f.q), t: add(&g.t, &rotate(&g.q, &f.t)) }
}
```

### 4.3 ProteinMPNN: closing the sequence–structure loop

Diffusion generates *backbones*, which are not synthesizable. ProteinMPNN [2] closes the loop with three properties that matter for co-design:

- **Order-agnostic autoregressive decoding** with random masking order, so any subset of positions (e.g., motif residues) can be fixed while the rest are designed — the sequence-level analogue of motif scaffolding.
- **Multi-chain coupling**: positions across chains can be tied, enabling binder and symmetric-oligomer sequence design in one pass [2].
- **Temperature-controlled diversity**: sampling at *T = 0.1–0.3* trades sequence recovery for diversity; RFdiffusion pipelines typically design 8 sequences per backbone and keep the best by scRMSD [1].

The combination is a *co-design* system in practice if not in a single network: diffusion proposes geometry, MPNN proposes chemistry, and AlphaFold2 adjudicates. Later work folds these into joint models, but the staged pipeline remains the experimental workhorse because each stage is independently validated and replaceable [7].

### 4.4 Binder design and motif scaffolding at scale

Binder design is the flagship application. The protocol [1]:

1. Fix the target protein's backbone; define hotspot residues on the target.
2. Diffuse a binder backbone *conditioned* on the hotspot geometry (partial diffusion from a random placement, with the interface region denoised toward the hotspots).
3. Design sequences with ProteinMPNN at the interface; filter by AlphaFold2 interface pAE and scRMSD.
4. Express 96 designs; assay by yeast display / BLI.

Reported outcomes: ~19% success across five targets (influenza hemagglutinin, IL-7Rα, PD-L1, TrkA, insulin receptor) — a *~100-fold* improvement over prior Rosetta-based binder pipelines [1]. The HA_20 binder's cryo-EM structure (2.9 Å) superimposes on the design at 0.63 Å backbone RMSD [1]. Symmetric oligomers: 87 of 608 cyclic designs confirmed by SEC with nsEM validation of selected assemblies; motif scaffolding: 23/25 benchmarks solved, including enzyme active sites and metal-binding sites, versus 15/25 for hallucination [1].

---

## 5. Empirical Evaluation and Theoretical Guarantees

### 5.1 Experimental validation rates

The headline numbers, all from expression of small design sets (typically 96 constructs), are summarized below [1][2]:

| Task | Metric | Result |
|---|---|---|
| Unconditional monomer design | scRMSD < 2 Å (AF2) | > 80% *in silico*; high soluble expression |
| Binder design (5 targets) | experimental binders / tested | ~19% |
| Motif scaffolding | benchmarks solved | 23/25 (hallucination: 15/25) |
| Symmetric oligomers | SEC-confirmed | 87/608 |
| HA_20 binder | cryo-EM vs design | 0.63 Å backbone RMSD |
| ProteinMPNN native recovery | sequence recovery | 52.4% (Rosetta: 32.9%) |
| ProteinMPNN rescue | soluble expression of 96 | 73 soluble, median 247 mg/L |

The ~20%-from-96 rule of thumb — one in five expressed designs works, from a single 96-well plate — is what converted diffusion design from a research demo into an industrializable workflow [5].

### 5.2 Guarantees and their limits

The *invariance theorem* (Section 3.2) is the one clean theoretical guarantee in the stack: equivariant denoiser + invariant prior ⇒ invariant generative distribution. Everything else is empirical: designability is measured, not proved, because the map from backbone to "expresses and folds" has no closed form. The community's operational definition of designability — *there exists a sequence (found by MPNN) that AlphaFold2 folds back to the backbone within 2 Å scRMSD* — is a pragmatic fixed point of two learned models, and its correlation with wet-lab success (~20%) is the field's central empirical fact [1].

FrameFlow [6] later showed the SE(3) diffusion paradigm can be accelerated: flow matching on *SE(3)* reaches 2× better designability than FrameDiff with 5× fewer sampling steps, confirming that the frame representation, not the specific SDE, carries the inductive bias.

### 5.3 Comparison with hallucination

| Dimension | Hallucination (AF/trRosetta opt.) | RFdiffusion |
|---|---|---|
| Mechanism | gradient ascent on confidence | sampling a learned prior |
| Diversity | low (mode-seeking) | high (distributional) |
| Motif scaffolding | 15/25 | 23/25 |
| Conditioning | restraint penalties | masking + symmetry ops |
| Failure mode | adversarial confidence exploits | low-designability samples (filtered) |

---

## 6. Limitations

1. **Backbone-only generation.** RFdiffusion and FrameDiff generate *Cα*-level frames; side chains, ligands, metals, and post-translational modifications are absent. Function must be grafted on afterward via motif constraints, which limits true *de novo* enzyme design.
2. **The designability filter is circular.** scRMSD uses AlphaFold2 to validate backbones produced by a RoseTTAFold-derived generator; shared training data and architectural lineage (both use IPA) may inflate agreement. The 0.63 Å cryo-EM result [1] is the essential independent check, and there is exactly one high-resolution structure of that quality in the paper.
3. **Conditional controllability is coarse.** Masking and symmetry operations condition on *geometry*, not on *function*: one cannot yet specify "a binder with *K_d* < 1 nM and no off-target binding" as a conditioning vector. Success rates, while revolutionary, still discard ~80% of tested designs.
4. **Length and complexity ceilings.** FrameDiff tops out near 500 residues [4]; large multi-domain and membrane proteins remain hard. Sampling cost (hundreds of network evaluations per backbone) limits library sizes relative to sequence-only generators.
5. **Physical fidelity gaps.** Diffusion models do not enforce steric exclusion or electrostatics explicitly; clashes and unsatisfied buried polars must be filtered post hoc. Explicit-solvent realism is entirely delegated to the validation stack.

## 7. Conclusion

RFdiffusion marks the moment protein design became a *generative* discipline: fine-tuning a structure-prediction network as an SE(3) diffusion process yields a sampler over physically realizable backbones whose experimental hit rates — ~19% for binders, 23/25 motif benchmarks, atomic-accuracy cryo-EM confirmation — exceed the previous physics-based state of the art by one to two orders of magnitude [1]. The architecture of the success is tripartite and worth naming plainly: *frames* make the geometry learnable, *equivariance* makes the distribution physical, and *ProteinMPNN plus AlphaFold2* make the samples synthesizable and testable [1][2][3]. FrameDiff [4] and FrameFlow [6] show the paradigm survives without the pretrained crutch and can be accelerated, pointing toward all-atom, function-conditioned successors. The remaining gap is not accuracy but *specification*: we can now generate proteins that fold; generating proteins that do exactly what we ask — with quantitative functional guarantees — is the next thesis.

---

## References

[1] J. L. Watson, D. Juergens, N. R. Bennett, B. L. Trippe, J. Yim, H. E. Eisenach, W. Ahern, A. J. Borst, R. J. Ragotte, L. F. Milles, B. I. M. Wicky, N. Hanikel, S. J. Pellock, A. Courbet, W. Sheffler, J. Wang, P. Venkatesh, I. Sappington, S. V. Torres, A. Lauko, V. De Bortoli, E. Mathieu, S. Ovchinnikov, R. Barzilay, T. Jaakkola, F. DiMaio, M. Baek, and D. Baker, "De novo design of protein structure and function with RFdiffusion," *Nature*, vol. 620, pp. 1089–1100, 2023. https://www.nature.com/articles/s41586-023-06415-8

[2] J. Dauparas, I. Anishchenko, N. Bennett, H. Bai, R. J. Ragotte, L. F. Milles, B. I. M. Wicky, A. Courbet, R. J. de Haas, N. Bethel, P. J. Y. Leung, T. F. Huddy, S. Pellock, D. Tischer, F. Chan, B. Koepnick, H. Nguyen, A. Kang, B. Sankaran, A. K. Bera, N. P. King, and D. Baker, "Robust deep learning–based protein sequence design using ProteinMPNN," *Science*, vol. 378, no. 6615, pp. 49–56, 2022. https://www.osti.gov/pages/biblio/2470608-robust-deep-learningbased-protein-sequence-design-using-proteinmpnn

[3] J. Jumper, R. Evans, A. Pritzel, T. Green, M. Figurnov, O. Ronneberger, K. Tunyasuvunakool, R. Bates, A. Žídek, A. Potapenko, A. Bridgland, C. Meyer, S. A. A. Kohl, A. J. Ballard, A. Cowie, B. Romera-Paredes, S. Nikolov, R. Jain, J. Adler, T. Back, S. Petersen, D. Reiman, E. Clancy, M. Zielinski, M. Steinegger, M. Pacholska, T. Berghammer, S. Bodenstein, D. Silver, O. Vinyals, A. W. Senior, K. Kavukcuoglu, P. Kohli, and D. Hassabis, "Highly accurate protein structure prediction with AlphaFold," *Nature*, vol. 596, pp. 583–589, 2021. https://doi.org/10.1038/s41586-021-03819-2

[4] J. Yim, B. L. Trippe, V. De Bortoli, E. Mathieu, A. Doucet, R. Barzilay, and T. Jaakkola, "SE(3) diffusion model with application to protein backbone generation," in *Proc. ICML*, 2023. https://proceedings.mlr.press/v202/yim23a/yim23a.pdf

[5] Institute for Protein Design, University of Washington, "A diffusion model for protein design," 2022. https://www.ipd.uw.edu/2022/12/a-diffusion-model-for-protein-design/

[6] J. Yim, A. Campbell, A. Y. K. Foong, M. Gastegger, J. Jiménez-Luna, S. Lewis, V. G. Satorras, B. S. Veeling, R. Barzilay, T. Jaakkola, and F. Noé, "Fast protein backbone generation with SE(3) flow matching," *arXiv:2310.05297*, 2023. https://arxiv.org/abs/2310.05297v2

[7] NIH High-Performance Computing, "ProteinMPNN: robust deep learning–based protein sequence design," documentation. https://hpc.nih.gov/apps/ProteinMPNN.html

[8] J. Dauparas et al., ProteinMPNN source code. https://github.com/mgarsamo/proteinmpnn

