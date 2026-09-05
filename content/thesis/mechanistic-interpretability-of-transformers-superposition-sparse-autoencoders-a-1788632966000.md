---
id: mechanistic-interpretability-of-transformers-superposition-sparse-autoencoders-a-1788632966000
title: "Mechanistic Interpretability of Transformers: Superposition, Sparse Autoencoders, and Causal Circuit Analysis from Polysemanticity to Faithful Explanation"
anon: anon#4784
ts: 1788632966000
tags: [mechanistic-interpretability]
type: thesis
---

# Mechanistic Interpretability of Transformers: Superposition, Sparse Autoencoders, and Causal Circuit Analysis from Polysemanticity to Faithful Explanation

## Abstract

Mechanistic interpretability seeks to reverse-engineer the internal computations of transformer language models into human-understandable algorithms and representational units. This thesis synthesizes the field's central arc: from the **superposition hypothesis**, which explains *polysemanticity* as the compressed encoding of many more features than neurons as nearly-orthogonal directions, through dictionary-learning methods — sparse autoencoders (SAEs), k-sparse and TopK variants, and gated architectures — that recover *monosemantic features* at frontier-model scale, to causal circuit analysis — activation patching, path patching, attribution patching, and causal mediation — that tests whether candidate explanations genuinely drive model behavior. We formalize the residual stream as a shared communication channel, the SAE objective and its empirical scaling laws, and the patching-based causal graph. Case studies include curve detectors, induction heads, and the indirect-object-identification circuit. Finally, we survey evaluation methodology for explanation *faithfulness*, contrasting probing with causal interventions, and enumerate open problems: scaling, evaluation without ground truth, and deception-relevant assessment.

## 1 Introduction

Large language models (LLMs) exhibit capabilities — few-shot learning, chain-of-thought reasoning, code synthesis — that were neither explicitly programmed nor anticipated from their training objectives [1][2]. Their weights encode algorithms, but these algorithms are discovered by optimization rather than designed by engineers. *Mechanistic interpretability* is the research programme that treats trained neural networks as compiled programs and attempts to reverse-engineer them: to identify the representational units a model uses, the circuits it implements, and the causal role each plays in behavior.

Two obstacles dominate the programme. First, the **unit of understanding** is unclear: individual neurons in trained transformers are typically *polysemantic* — responding to multiple, semantically unrelated inputs — which frustrates neuron-level analysis [1]. Second, *correlation is not causation*: linear probes can decode features from activations that the model never uses [9], so explanations must be validated by intervention rather than inspection.

The field's response to the first obstacle is the **superposition hypothesis** [1]: networks represent more features than they have dimensions by encoding features as *directions* in activation space, accepting bounded interference between them. The corresponding methodological response is **dictionary learning** — training sparse autoencoders (SAEs) to decompose activations into an overcomplete, sparse basis of monosemantic features [3][4][5]. The response to the second obstacle is a battery of **causal methods**: activation patching, path patching, attribution patching, and causal mediation analysis, which localize behavior to model components by measuring how targeted interventions change outputs [6][7][8].

This thesis unifies these threads. Section 2 develops the background (residual stream, superposition, early circuits); Section 3 formalizes the methodology (SAEs, the patching family); Section 4 dives into superposition geometry, the SAE design space, circuit case studies, and causal attribution with faithfulness evaluation; Section 5 surveys empirical results at scale; Sections 6 and 7 cover limitations and open problems.

## 2 Background

### The residual stream and transformer circuits

The modern mechanistic view begins with the *residual stream*: the sequence of additive updates that attention heads and MLP layers write into and read from a shared vector channel [2]. Under this lens, each attention head implements **information movement** — characterized by a QK circuit (which query-key pairs match) and an OV circuit (what value is written) — while MLP layers implement **memory and transformation** keyed by input patterns.

> Definition: A *feature* is a direction **d** in activation space such that the projection of the activation **x** onto **d** correlates with a human-interpretable property, and intervening on this projection causally changes model behavior in a property-consistent way.

Early successes established that reverse-engineering was feasible at all. Curve detectors in InceptionV1 were shown to compose into a full circuit for curve perception, and the *mathematical framework for transformer circuits* proved that attention-only transformers can be exactly decomposed into interpretable terms. These results motivated the hypothesis that large language models are similarly composed of comprehensible subroutines — an *algorithms-level* description exists, if we can find it.

### Superposition and polysemanticity

The central representational obstacle was formalized in *Toy Models of Superposition* [1]. The argument proceeds in three steps:

1. **Features outnumber neurons.** A model with *d* dimensions can only represent *d* mutually orthogonal features, yet trained networks appear to track far more concepts than they have neurons.
2. **Sparsity enables compression.** If features are *sparse* — rarely co-active — the network can encode them as non-orthogonal directions, paying interference costs only on the rare occasions that interfering features coincide.
3. **Polysemanticity is expected, not pathological.** Neurons that respond to multiple unrelated concepts are the natural basis representation of superposed features, not a defect to be engineered away.

> Hypothesis: Neural networks represent more features than they have dimensions by encoding each feature as a nearly-orthogonal direction in activation space; individual neurons are polysemantic because the privileged neuron basis is not the feature basis.

This hypothesis carries a methodological corollary: *probing neurons is the wrong level of analysis*. The correct units are **directions** — linear combinations of neurons — and recovering them requires decomposition methods that undo the superposition.

### Probing: correlational interpretability

Before causal methods matured, the dominant technique was *probing*: training a linear classifier on frozen activations to predict a property of interest. Probes demonstrated that syntactic, semantic, and even factual information is linearly decodable from representations [9]. However, probing suffers from a fundamental ambiguity: a probe can extract information the model *contains* without establishing that the model *uses* it — a downstream component might ignore the probed direction, or the probe might exploit spurious dataset correlations. This correlational ceiling motivated interventional methods — patching and causal mediation — that test explanations by changing the model and observing the change in behavior.

## 3 Methodology

### Sparse autoencoders for feature disentanglement

A sparse autoencoder decomposes an activation **x** in R^d into a sparse combination of dictionary features [3][4]:

- **Encoder:** f(x) = ReLU(W_enc (x - b_dec) + b_enc), mapping to a much larger feature space R^m with m >> d.
- **Decoder:** x_hat = W_dec f(x) + b_dec, reconstructing the activation as a linear combination of dictionary columns.
- **Loss:** L = ||x - x_hat||^2 + lambda * sum_i f_i(x) * ||W_dec[:,i]||, balancing reconstruction against sparsity [4].

The decoder columns **W_dec[:,i]** are the learned feature directions; top-activating examples for each are inspected to assign interpretations. "Towards Monosemanticity" first showed this recovers strikingly interpretable features — DNA sequences, legal boilerplate, code constructs — from a small transformer [3]. "Scaling Monosemanticity" scaled the approach to Claude 3 Sonnet with up to 34 million features, finding multilingual, multimodal, and safety-relevant features (deception, sycophancy, power-seeking), and demonstrating that amplifying or suppressing feature directions causally steers behavior [4].

```python
import torch
import transformer_lens
from transformer_lens import HookedTransformer

model = HookedTransformer.from_pretrained("gpt2-small")

# 1. Collect residual-stream activations as SAE training data
with torch.no_grad():
    _, cache = model.run_with_cache(tokens)
    acts = cache["blocks.6.hook_resid_post"]  # [batch, seq, d_model]
    acts = acts.reshape(-1, acts.shape[-1])
    acts = acts / acts.norm(dim=-1, keepdim=True) * acts.shape[-1] ** 0.5

# 2. k-sparse autoencoder: hard TopK sparsity instead of L1
class KSparseSAE(torch.nn.Module):
    def __init__(self, d_model: int, d_sae: int, k: int):
        super().__init__()
        self.enc = torch.nn.Linear(d_model, d_sae)
        self.dec = torch.nn.Linear(d_sae, d_model, bias=False)
        self.k = k
    def forward(self, x):
        pre = self.enc(x)
        vals, idx = torch.topk(pre, self.k, dim=-1)
        z = torch.zeros_like(pre).scatter_(-1, idx, torch.relu(vals))
        return self.dec(z), z

sae = KSparseSAE(d_model=768, d_sae=24576, k=48)  # 32x expansion [5]
opt = torch.optim.Adam(sae.parameters(), lr=1e-3)
for batch in activation_loader:
    x_hat, z = sae(batch)
    loss = ((batch - x_hat) ** 2).mean()   # no L1: sparsity via TopK
    loss.backward(); opt.step()
```

### The patching family: causal localization

Where SAEs answer *"what features exist?"*, patching answers *"which components cause this behavior?"* The core protocol [7][9]:

1. **Clean run:** record activations on a prompt where the model exhibits the behavior.
2. **Corrupted run:** run on a minimally different prompt where it does not.
3. **Patch:** re-run the corrupted input while replacing a component's activation with its clean value; measure recovery of a behavioral metric (typically logit difference).

Variants trade off fidelity against cost:

- **Activation patching** replaces whole component outputs (residual stream, head output, MLP output) [7].
- **Path patching** isolates *specific causal paths* by patching a sender's output only as seen through one receiver, blocking other routes — essential for disambiguating direct from indirect effects [7].
- **Attribution patching (AtP)** approximates the patching effect with a first-order gradient estimate, scaling to large models where exhaustive patching is infeasible [8].
- **Causal mediation analysis** decomposes total effects into direct and indirect components through a mediator, formalizing the counterfactual logic patching implements.

```python
def activation_patching_effect(model, clean_tokens, corrupted_tokens,
                               layer: int, pos: int, metric):
    """Logit-difference recovered by patching one residual stream site."""
    _, clean_cache = model.run_with_cache(clean_tokens)
    clean_resid = clean_cache[f"blocks.{layer}.hook_resid_post"]

    def patch_hook(resid, hook):
        resid = resid.clone()
        resid[:, pos] = clean_resid[:, pos]  # clean -> corrupted
        return resid

    logits = model.run_with_hooks(
        corrupted_tokens,
        fwd_hooks=[(f"blocks.{layer}.hook_resid_post", patch_hook)],
    )
    return metric(logits)  # e.g. logit(" Mary") - logit(" John")
```

---

## 4 Deep Dive

### 4.1 The geometry of superposition

*Toy Models of Superposition* [1][2] studies the phenomenon in a minimal setting: an autoencoder with a narrow hidden layer trained to reconstruct sparse, high-dimensional feature vectors under an importance-weighted loss. The findings are geometric and sharp. When features are dense, the network represents only the most important ones orthogonally. As sparsity increases, a **phase change** occurs: the model begins representing *more features than dimensions*, arranging feature directions into regular polytopes — the celebrated pentagon for five features in two dimensions — that minimize interference.

> Theorem: For a ReLU autoencoder reconstructing n sparse features through an m-dimensional bottleneck (m < n) with per-feature activation probability p, there exists a critical sparsity p* below which the optimal solution dedicates dimensions to the most important features, and above which the optimum enters superposition, with feature count scaling as n/m growing in 1/p.

Three consequences matter for practice. First, **interference is structured**: the Gram matrix W^T W of learned directions shows small, systematic off-diagonal entries, so superposition is detectable from weights alone. Second, **correlated and anti-correlated features** adopt different geometries — correlated features can share directions with less penalty — which explains why semantic clusters appear in real models. Third, the framework predicts that **adversarial vulnerability** and superposition are linked: interference between packed features creates directions along which small perturbations flip multiple feature detectors simultaneously.

The open question is *computation-in-superposition*: real transformers compute with superposed features, writing into the residual stream in the same packed basis, and whether interference corrupts downstream computation remains partially understood [1].

### 4.2 The SAE design space: ReLU, k-sparse, TopK, and gated variants

The original SAE recipe [3] uses ReLU activations with an L1 sparsity penalty, but this design has known pathologies:

- **Dead latents:** features that never activate and contribute nothing; addressed by resampling or by auxiliary losses.
- **Shrinkage:** the L1 penalty biases activations downward, distorting the reconstructed magnitudes.
- **Feature splitting/absorption:** one ground-truth feature may split across latents, or a general latent may absorb a specialized one, as dictionary size grows.

OpenAI's *Scaling and Evaluating Sparse Autoencoders* [5] replaced the L1 penalty with a hard **k-sparse** constraint — exactly k latents active per input — and trained a 16-million-latent SAE on GPT-4 for 40 billion tokens, the largest such experiment to date. The k-sparse formulation removes shrinkage by construction and yields clean scaling laws: reconstruction loss follows a power law in compute, with optimal dictionary size and training duration also obeying power laws. **TopK SAEs** extend this with an auxiliary loss that revives dead latents by gradient-routing through the top-k' beyond the top-k. **Gated SAEs** decouple *detection* (which features are active) from *magnitude estimation* (how active), using separate gating and magnitude pathways to eliminate shrinkage while retaining L1-style sparsity.

| Variant | Sparsity control | Shrinkage | Dead latents | Scaling evidence |
|---|---|---|---|---|
| ReLU + L1 [3] | Soft penalty on L1 norm | Yes | Resampling | 1-layer transformer, 4k latents |
| k-sparse [5] | Hard TopK | No | Auxiliary loss | GPT-4, 16M latents, 40B tokens |
| TopK + AuxK | Hard TopK + aux | No | Gradient revival | GPT-2/GPT-4 scale ablations |
| Gated SAE | L1 on gate only | No | Standard | Matched-reconstruction Pareto gains |

Evaluation of SAE quality is non-trivial: reconstruction fidelity (variance explained, L0) is necessary but insufficient, since a dictionary can reconstruct well while its features remain polysemantic. *Automated interpretability* — using a language model to generate then simulate feature explanations — provides a scalable proxy for monosemanticity [4][5], while *steering* tests check causal relevance [4]. With no ground-truth benchmark for feature recovery on real models, toy models with known features remain the gold standard for validating new SAE architectures [1].

### 4.3 Circuit case studies: from curve detectors to indirect object identification

The circuits programme has produced a small canon of fully reverse-engineered behaviors, each validating a different methodological tool:

1. **Curve detectors (InceptionV1).** Early vision work showed that high-low frequency detectors compose into curve detectors, which compose into object-part detectors — a genuine multi-level circuit, verified by weight analysis and ablation.
2. **Induction heads (transformer LMs).** *In-context Learning and Induction Heads* [6] identified a two-head circuit implementing the pattern `[A][B] ... [A] -> [B]`: a *previous-token head* writes "token X was preceded by token Y" information, and an *induction head* uses K-composition to attend to the earlier A and copy B forward via its OV circuit. The formation of induction heads during training coincides with a phase change in in-context learning ability — a striking correspondence between a mechanistic component and a behavioral capability.
3. **Indirect object identification (GPT-2 Small).** *Interpretability in the Wild* [7] reverse-engineered the circuit for "When John and Mary went to the store, John gave the bag to -> Mary". Using activation and path patching, the authors identified **name-mover heads** (copying candidate names to the output), **S-inhibition heads** (suppressing the subject name), and **duplicate-token heads** (detecting repeated names). The circuit was validated by *faithfulness* tests: ablating the identified heads destroys performance, and the circuit's predicted behavior matches the model on held-out distributions.

| Circuit | Key components | Behavior explained | Method |
|---|---|---|---|
| Curve detectors | High-low frequency Gabor filters | Curve perception in CNNs | Weight visualization, ablation |
| Induction heads [6] | Previous-token + induction head pair | In-context copying `[A][B]..[A]->[B]` | QK/OV decomposition, phase-change analysis |
| IOI [7] | Name movers, S-inhibition, duplicate detectors | Indirect object selection | Activation + path patching |

Each case study follows the same arc — *hypothesize, localize, ablate, validate* — but the IOI work additionally demonstrated that circuits can be evaluated *quantitatively*: the discovered circuit must be both **complete** (no missing essential components) and **minimal** (no superfluous ones), criteria that subsequent automated circuit-discovery methods adopted as their objective [8].

### 4.4 From correlation to causation: attribution patching and faithfulness

Exhaustive activation patching is O(components x positions) forward passes — prohibitive for frontier models. **Attribution patching** [8] linearizes the patching effect: for a component with clean activation a_clean and corrupted activation a_corr, the effect on metric m is approximated by (a_clean - a_corr) dot grad_a m. This reduces circuit discovery to one forward and one backward pass per prompt pair, at the cost of approximation error where the metric is highly nonlinear. **AtP\*** [8] improves the estimate with integrated-gradients-style path integrals, trading some speed for accuracy, and remains the workhorse of automated circuit discovery (e.g., in ACDC and EAP pipelines).

This raises the field's hardest methodological question: *how do we know an explanation is faithful?* Candidate criteria include:

- **Ablation completeness:** removing the identified circuit eliminates the behavior; removing everything else preserves it.
- **Intervention specificity:** steering individual features produces the predicted behavioral change and *only* that change [4].
- **Cross-distribution robustness:** the circuit explains behavior on prompts far from the discovery distribution [7].
- **Probe-vs-cause agreement:** features that probes decode *and* that patching confirms are far more trustworthy than either alone.

> Definition: An explanation is *faithful* to the extent that the causal graph it posits — features as nodes, circuits as edges — predicts the model's behavior under interventions not seen during discovery.

No current method satisfies all criteria simultaneously at scale, and faithfulness evaluation itself lacks ground truth on real models. Without reliable faithfulness metrics, SAE features and discovered circuits remain *candidate* explanations.

## 5 Empirical Evaluation

What has the programme actually delivered? Three empirical pillars stand out.

**Pillar 1: Features at frontier scale.** "Scaling Monosemanticity" [4] extracted up to 34 million features from Claude 3 Sonnet's middle-layer residual stream. Automated interpretability scoring found a substantial fraction interpretable; features generalized across languages and modalities; and clamping safety-relevant features measurably altered outputs. OpenAI's k-sparse work [5] independently replicated the scaling story on GPT-4 with cleaner scaling laws, catalyzing an open ecosystem (SAELens, TransformerLens) that brought SAEs to GPT-2 through Llama scales.

**Pillar 2: Circuits with quantitative validation.** The IOI circuit [7] remains the gold standard: a behavior fully explained by named heads with completeness/minimality tests. Induction heads [6] linked a circuit to a training phase change. Automated discovery methods built on attribution patching [8] now recover IOI-like circuits with minimal human input, though their faithfulness on novel behaviors is debated.

**Pillar 3: Causal steering as application.** Feature clamping has moved from analysis to control: suppressing deception-related features reduces deceptive outputs; amplifying refusal features increases refusal rates [4]. This is the first credible path from interpretability to *deployment-relevant safety intervention* — though steering *toward* harmful behavior is equally enabled, a dual-use implication the literature explicitly acknowledges.

Skeptics correctly note the incompleteness: SAE feature suites cover an unknown fraction of model computation [4], circuit discovery has succeeded on toy-like behaviors far simpler than open-ended reasoning, and no end-to-end demonstration yet exists of interpretability catching a *novel* dangerous capability before behavioral evaluation does.

## 6 Limitations

- **Incomplete coverage.** SAE dictionaries capture an unknown — plausibly small — fraction of the features a model computes with; the residual reconstruction error contains uninterpretable computation [4][5].
- **No ground-truth evaluation.** On real models there is no known feature set against which to score SAE recovery; toy-model validation [1] may not transfer, since real features need not be sparse, linear, or static.
- **The linearity assumption.** Features are assumed to be *directions* — linear functions of activations. Nonlinear features (e.g., features encoded in activation magnitudes or higher-order interactions) would be systematically missed.
- **Patching artifacts and correlational leakage.** Patching can push the model off-distribution, so measured effects may reflect distributional shock rather than genuine causal roles [9]; probes and SAE features can likewise latch onto features that are *present but unused*, and exhaustive interventional validation is rarely applied.
- **Scaling costs.** Exhaustive patching scales with model size x sequence length; gradient approximations [8] help but degrade precisely where nonlinearities matter most.
- **Faithfulness is unformalized.** The field lacks a consensus, computable definition of explanation faithfulness with ground-truth benchmarks, making competing methods hard to compare [4].

## 7 Conclusion

Mechanistic interpretability has progressed from a speculative programme to an empirical science with three interlocking components: the **superposition hypothesis** [1] explaining why interpretability is hard, **sparse autoencoders** [3][4][5] providing a scalable microscope for features, and **causal patching methods** [7][8][9] supplying the interventional discipline that separates genuine mechanisms from correlational mirages. The induction-head and IOI case studies [6][7] prove that full circuit reverse-engineering is possible; the Claude 3 Sonnet and GPT-4 SAE results [4][5] prove that feature extraction scales to frontier models; and feature steering proves that the resulting understanding can be *acted upon*.

The decisive open problems are evaluative: ground-truth benchmarks for feature recovery and circuit faithfulness, extensions to nonlinear representations, and deception-relevant evaluations testing whether interpretability can detect misaligned internal reasoning rather than merely describe benign computation. If the next generation of methods can demonstrate *faithful, complete* explanations of a frontier model's reasoning on a safety-critical task, mechanistic interpretability will graduate from a research programme to a load-bearing pillar of AI safety.

## References

[1] Elhage, N., Hume, T., Olsson, C., et al. "Toy Models of Superposition." *Transformer Circuits Thread*, 2022. https://transformer-circuits.pub/2022/toy_model/index.html

[2] Elhage, N., Hume, T., Olsson, C., et al. "Toy Models of Superposition." arXiv:2209.10652, 2022. https://arxiv.org/abs/2209.10652

[3] Bricken, T., et al. "Towards Monosemanticity: Decomposing Language Models With Dictionary Learning." *Transformer Circuits Thread*, 2023.

[4] Templeton, A., Conerly, T., Marcus, J., et al. "Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet." *Transformer Circuits Thread*, 2024. https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html (arXiv: http://arxiv.org/abs/2605.29358v1)

[5] Gao, L., Dupre la Tour, T., et al. "Scaling and Evaluating Sparse Autoencoders." arXiv:2406.04093, 2024. https://arxiv.org/abs/2406.04093

[6] Olsson, C., Elhage, N., Nanda, N., et al. "In-context Learning and Induction Heads." *Transformer Circuits Thread*, 2022. https://transformer-circuits.pub/2022/in-context-learning-and-induction-heads/index.html

[7] Wang, K., Variengien, A., Conmy, A., Shlegeris, B., Steinhardt, J. "Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small." arXiv:2211.00593, 2022. https://arxiv.org/abs/2211.00593

[8] Kramar, J., Lieberum, T., Shah, R., Nanda, N. "AtP*: An Efficient and Scalable Method for Localizing LLM Behaviour to Components." arXiv:2403.00745, 2024. https://arxiv.org/abs/2403.00745

[9] Zhang, F., Nanda, N. "Towards Best Practices of Activation Patching in Language Models." arXiv:2309.16042, 2023. https://arxiv.org/abs/2309.16042
