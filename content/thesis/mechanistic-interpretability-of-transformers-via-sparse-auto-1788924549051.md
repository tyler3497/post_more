---
id: ths_1788924549051_a9b0
title: "Mechanistic Interpretability of Transformers via Sparse Autoencoders: k-Sparse Dictionary Learning, Circuit Discovery, and Steering-Vector Interventions"
anon: anon#4881
ts: 1788924549051
tags: []
type: thesis
---
# Mechanistic Interpretability of Transformers via Sparse Autoencoders: k-Sparse Dictionary Learning, Circuit Discovery, and Steering-Vector Interventions

## Abstract

Mechanistic interpretability seeks to reverse-engineer transformer language models into human-understandable algorithms by identifying the causal computational graph — the *circuits* — implemented in their weights. The central obstacle is **superposition**: models represent more features than they have dimensions, entangling concepts into polysemantic neurons [1]. This thesis develops the sparse autoencoder (SAE) program as a principled response. We formalize dictionary learning as the recovery of an overcomplete, sparsely-active feature basis from residual-stream activations; derive the k-sparse autoencoder objective and its variants (L1, TopK, Gated); characterize pathologies including **feature splitting** and **feature absorption**; and connect learned features to circuit analysis via indirect object identification, attribution patching, and sparse feature circuits [6][7]. We further analyze **steering-vector interventions** — clamping or injecting feature directions at inference time — as the causal validation of interpretability claims [4]. We evaluate reconstruction-fidelity versus interpretability trade-offs and argue that sparse dictionary learning, while incomplete, offers the strongest empirical foundation for scalable mechanistic understanding of frontier models.

---

## 1 Introduction

Large language models (LLMs) have become ubiquitous computational artifacts whose internal mechanisms remain poorly understood. A model with $10^{11}$ parameters reliably performs syntactic agreement, multi-hop reasoning, and stylistic mimicry, yet we cannot point to *where* or *how* these computations occur with the rigor we expect of engineered systems. **Mechanistic interpretability** is the research program that treats neural networks as reverse-engineering targets: its goal is to decompose a model's behavior into *features* (the variables the model computes with) and *circuits* (the directed causal graphs of features and weights implementing algorithms) [9].

The earliest circuits-style successes operated at the level of attention heads and neurons. Elhage et al. developed a mathematical framework decomposing attention heads into interpretable operations such as previous-token copying and induction — a two-head composite in which one head copies information from token $i-1$ forward and a second head attends to tokens preceded by the current token, yielding the characteristic pattern of in-context repetition [9]. Wang et al. subsequently reverse-engineered the full circuit for **indirect object identification** (IOI) in GPT-2 small, identifying name-mover heads, duplicate-token heads, S-inhibition heads, and previous-token heads, and validating the circuit via causal interventions [7]. These were genuine algorithmic explanations: complete, falsifiable, and predictive.

Yet neuron-level analysis collided with a structural obstacle. Individual neurons in trained models are overwhelmingly *polysemantic*: a single neuron activates for semantically unrelated concepts — curved edges and car wheels; Arabic script and Python keywords — defying any single human label. If neurons are the variables, the program stalls. The **superposition hypothesis** [1] offers a mechanism: when the number of useful features exceeds the available dimensions, networks learn to represent features as *directions* in activation space rather than as dedicated neurons, packing many approximately-orthogonal directions into fewer neurons by exploiting sparsity and the nonlinearity's ability to denoise interference. Polysemanticity is then not pathology but compression strategy.

This thesis is about the leading technology for *undoing* superposition: **sparse autoencoders** (SAEs). The idea is conceptually simple — train an overcomplete autoencoder with a sparsity constraint on the residual-stream or MLP activations of a target model, so that each activation is reconstructed as a sparse linear combination of learned dictionary directions — but its execution at frontier scale has produced the richest empirical window into LLM internals available today [2][3][4][5]. We organize the thesis as follows. Section 2 formalizes superposition, polysemanticity, and the circuits vocabulary. Section 3 derives the SAE objective, k-sparse variants, and training mechanics. Section 4 contains the deep dive: sparsity formulations, feature splitting and absorption, circuit discovery from features, and steering interventions. Section 5 reviews empirical results and evaluation methodology. Section 6 catalogs limitations honestly. Section 7 concludes with a research agenda.

---

## 2 Background

### 2.1 Transformers, residual streams, and linear representations

We consider decoder-only transformer language models. Let $x^{(l)}_t \in \mathbb{R}^{d}$ denote the residual-stream activation at layer $l$ and token position $t$. Each layer reads from and writes to this stream:

$$x^{(l+1)}_t = x^{(l)}_t + \mathrm{Attn}^{(l)}(x^{(l)})_t + \mathrm{MLP}^{(l)}(x^{(l)}_t + \mathrm{Attn}^{(l)}(x^{(l)})_t).$$

The residual stream functions as a shared communication bus: components add vector contributions that downstream components read via linear projections [9]. This *linear representation hypothesis* — that semantically meaningful quantities correspond to directions in activation space — is the working assumption of essentially all dictionary-learning interpretability. It is motivated by linear probing successes and by the geometry of the framework in [9], where head outputs compose additively through the OV and QK circuits.

### 2.2 The superposition hypothesis

Elhage et al. [1] formalized superposition using toy models: a single-layer ReLU network trained to reconstruct sparse input features with fewer hidden units than features. The network learns to assign each feature a direction in hidden space; features interfere, but because only few are active at once, the ReLU can suppress interference, and reconstruction succeeds despite $n_{\text{features}} \gg n_{\text{neurons}}$. Two consequences follow:

1. **Polysemanticity is optimal compression.** When features are sparse and their importance is unequal, the loss-optimal solution mixes multiple features per neuron rather than dedicating one neuron per feature.
2. **Privileged bases are rare.** Superposition breaks the correspondence between neurons and features; the interpretable basis is an arbitrary rotation of the neuron basis.

> **Theorem (informal, Elhage et al. [1]):** In a sparse-feature toy model with $m$ features and $n < m$ hidden dimensions, there exist parameter regimes in which the loss-optimal solution embeds all $m$ features as non-orthogonal directions in $\mathbb{R}^n$ with reconstruction error vanishing as feature sparsity increases. Neuron-aligned (one-feature-per-neuron) solutions are strictly suboptimal whenever $m > n$.

The practical upshot: we cannot read features off neurons; we must *solve an inverse problem* to recover the feature directions. Sparse autoencoders are a scalable algorithm for that inverse problem [2][3].

### 2.3 Circuits and causal validation

A *circuit* is a hypothesized subgraph of the model's computation — a set of components (heads, neurons, and now features) plus the edges between them — claimed to implement an algorithm producing some behavior. The gold standard for a circuit claim is **causal validation**: ablating or patching the circuit's components should reproduce the behavioral effect predicted by the hypothesis. Techniques include:

- **Ablation:** zeroing or mean-replacing a component's output and measuring the change in a behavioral metric (e.g., logit difference on IOI).
- **Activation patching / causal tracing:** running the model on a "clean" and a "corrupted" prompt and patching activations from one run into the other to localize causal mediators.
- **Attribution patching:** a linear approximation of activation patching using gradients, enabling edge-level attribution at scale without a forward pass per edge.

SAE features slot into this machinery as finer-grained nodes than neurons: *sparse feature circuits* combine SAEs with attribution patching to discover causal graphs over features rather than over neurons [6].

---

## 3 Methodology

### 3.1 The sparse autoencoder objective

Given a dataset of activations $\{x_i\}_{i=1}^N \subset \mathbb{R}^d$ sampled from a target model's residual stream (or MLP activations) over a text corpus, an SAE learns an encoder $f: \mathbb{R}^d \to \mathbb{R}^m$ and a decoder $g: \mathbb{R}^m \to \mathbb{R}^d$ with $m \gg d$ (overcomplete), minimizing

$$\mathcal{L}(x) = \lVert x - \hat{x} \rVert_2^2 + \lambda \lVert h \rVert_1, \qquad h = f(x) = \sigma(W_{\text{enc}} x + b_{\text{enc}}), \quad \hat{x} = W_{\text{dec}} h + b_{\text{dec}}.$$

The $\ell_1$ penalty induces sparsity in the latent code $h$; the reconstruction term pressures the dictionary $\{W_{\text{dec}}^{(j)}\}_{j=1}^m$ to span the data. Typical configurations expand the dictionary by a factor of $8$–$64$ over $d$ [3][5]. Training is performed on tens of billions of activation tokens for frontier models [4].

```python
import torch
import torch.nn as nn

class SparseAutoencoder(nn.Module):
    """Vanilla L1-penalized SAE on residual-stream activations."""
    def __init__(self, d_model: int, expansion: int = 8, l1_coef: float = 1e-3):
        super().__init__()
        d_hidden = d_model * expansion
        self.encoder = nn.Linear(d_model, d_hidden)
        self.decoder = nn.Linear(d_hidden, d_model, bias=False)
        self.l1_coef = l1_coef
        # Tie decoder column norms for stable feature directions
        with torch.no_grad():
            self.decoder.weight.div_(self.decoder.weight.norm(dim=0, keepdim=True))

    def forward(self, x):
        h = torch.relu(self.encoder(x))          # sparse latent code
        x_hat = self.decoder(h)                  # reconstruction
        recon = ((x - x_hat) ** 2).mean()
        sparsity = h.abs().sum(dim=-1).mean()
        return x_hat, recon + self.l1_coef * sparsity, h
```

### 3.2 k-sparse autoencoders and TopK variants

Makhzani and Frey [8] introduced the **k-sparse autoencoder**: instead of an $\ell_1$ penalty, sparsity is enforced *exactly* by keeping only the $k$ largest latent activations and zeroing the rest, backpropagating through the surviving units. This removes the shrinkage bias of $\ell_1$ (which systematically underestimates activation magnitudes) and gives direct control over the sparsity level.

> **Definition (k-sparse encoding):** Let $z = W_{\text{enc}} x + b_{\text{enc}}$. The k-sparse code is $h = \mathrm{TopK}(z)$, where $\mathrm{TopK}$ retains the $k$ largest entries and zeroes the remainder. The objective reduces to pure reconstruction: $\mathcal{L} = \lVert x - W_{\text{dec}} h \rVert_2^2$.

Modern LLM SAEs use **TopK** [5] and **Gated** architectures: the Gated SAE separates *detection* (which features are active) from *magnitude estimation*, using a gating branch $\sigma(W_{\text{gate}} x)$ and a magnitude branch $\mathrm{ReLU}(W_{\text{mag}} x)$, which substantially reduces the shrinkage bias that otherwise degrades reconstruction fidelity at fixed sparsity. JumpReLU variants learn a per-feature activation threshold, and BatchTopK enforces sparsity across a batch rather than per token, permitting naturally varying numbers of active features per token.

### 3.3 Training at scale and open ecosystems

Anthropic's program progressed from one-layer models (Bricken et al. [3], learning thousands of features with early evidence of monosemanticity) to Claude 3 Sonnet (Templeton et al. [4], tens of millions of features across layers, with demonstrations of feature steering and abstraction hierarchies). Google DeepMind's **Gemma Scope** [5] released open SAEs for every layer of Gemma 2 (2B and 9B), including 16K, 131K, and 1M-width dictionaries, establishing the standard open benchmark for SAE research. Open-source tooling (SAELens, TransformerLens) and interpretability platforms expose feature dashboards with maximally-activating examples and auto-generated explanations, enabling the broader community to replicate and extend these results.

---

## 4 Deep Dive

### 4.1 Sparsity formulations and the Pareto frontier

The choice of sparsity mechanism is not cosmetic: it determines the achievable trade-off between **reconstruction fidelity** (variance explained, or downstream cross-entropy when the reconstruction is spliced back into the model) and **sparsity** (mean $L_0$). The community evaluates SAEs on a Pareto frontier: for a given $L_0$, which architecture maximizes variance explained, and vice versa.

| Formulation | Sparsity control | Shrinkage bias | Notes |
|---|---|---|---|
| L1-penalized (ReLU) [2][3] | $\lambda$ coefficient | Severe | Original LLM formulation; dead latents common |
| k-sparse / TopK [5][8] | exact $k$ | Mild | Clean Pareto; requires aux-loss for dead latents |
| Gated SAE | $\lambda$ on gate | Minimal | Separate detection/magnitude paths |
| JumpReLU | learned threshold | Minimal | Per-feature adaptive threshold |
| BatchTopK | batch-level $k$ | Mild | Variable per-token sparsity |

Dead latents — dictionary directions that never activate — are handled by auxiliary losses (e.g., "ghost gradients" that route gradient signal to inactive units) or by resampling dead directions to high-error data points. A subtle failure mode is **norm imbalance**: features with large decoder norms can dominate reconstruction, so most implementations constrain decoder columns to unit norm and absorb scale into the encoder.

### 4.2 Feature splitting and feature absorption

Two related pathologies complicate the interpretation of SAE dictionaries as *the* feature set:

- **Feature splitting.** A single true feature may be represented by multiple dictionary directions that fire on sub-distributions of its occurrences (e.g., separate features for "the token *dog* at sentence start" versus "elsewhere"). Splitting increases with dictionary width: wider SAEs find finer-grained features [4][5]. This is arguably *desirable* granularity — but it means feature counts are not comparable across widths.
- **Feature absorption.** A broad, general feature (e.g., "starts with the letter S") may be absorbed into token-specific features when those tokens are predictable from context, so the general feature fails to fire where a human would expect it. Absorption is detected by probing: a linear probe for the general concept on the SAE code underperforms the probe on the raw activation, even though the union of token-specific features recovers the information.

The methodological consequence is that interpretability evaluation must be **behavioral, not taxonomic**: what matters is whether features support causal predictions and edits, not whether the feature inventory matches a philosopher's ontology.

### 4.3 From features to circuits: sparse feature circuits

Classical circuit analysis [7][9] operates on heads and neurons. But neurons are polysemantic, so neuron-level circuits inherit ambiguity. Marks et al. [6] introduced **sparse feature circuits**, which combine three ingredients:

1. Train SAEs on the relevant model locations (residual streams, attention outputs, MLP outputs).
2. Use **attribution patching** — a gradient-linearized approximation to activation patching — to score the causal contribution of each *feature* (and each edge between features) to a behavioral metric.
3. Threshold the resulting graph to obtain a human-inspectable causal subgraph over monosemantic features.

This yields circuits whose nodes are interpretable (unlike neurons) and whose edges are causally validated (unlike pure correlational probes). Applied to tasks like IOI and subject–verb agreement, feature circuits recover the known head-level circuits while resolving them into finer, semantically labeled components — e.g., decomposing a "name mover head" into distinct features for specific name tokens [6].

### 4.4 Steering vectors and activation interventions

Interpretability claims earn their keep through *control*. Given a feature direction $v_j$ (decoder column $j$), we can intervene at inference time:

- **Clamping:** fix feature $j$'s activation to a value $c$ during the forward pass, $h_j \leftarrow c$, and propagate the modified reconstruction $\hat{x} = W_{\text{dec}} h$ back into the model.
- **Steering / activation addition:** add $\alpha v_j$ directly to the residual stream at a chosen layer, in the spirit of Turner et al.'s activation addition and Zou et al.'s representation engineering.

```python
def steer_with_feature(model, sae, tokens, layer, feat_idx, alpha):
    """Clamp SAE feature `feat_idx` to `alpha` at `layer` during generation."""
    handle = None
    def hook(module, inputs, output):
        # output: residual stream activations [batch, seq, d_model]
        h = torch.relu(sae.encoder(output))
        h[..., feat_idx] = alpha            # clamp the feature
        return sae.decoder(h)              # splice reconstruction back
    handle = model.transformer.h[layer].register_forward_hook(hook)
    try:
        return model.generate(tokens)
    finally:
        handle.remove()
```

Templeton et al. [4] demonstrated steering on Claude 3 Sonnet: clamping a "Golden Gate Bridge" feature caused the model to obsessively reference the bridge; clamping a "brain sciences" feature shifted its persona toward neuroscience. Cunningham et al. [2] showed that ablating SAE features enables precise model editing — e.g., degrading pronoun prediction — with less collateral disruption than neuron ablation. Steering is thus both the **validation metric** for feature quality (a truly monosemantic feature should steer exactly its concept and nothing else) and the **application**: inference-time control without fine-tuning.

### 4.5 Evaluation: fidelity, interpretability, and causal efficacy

Three evaluation families are in active use:

1. **Reconstruction fidelity.** Variance explained $\,1 - \lVert x - \hat{x}\rVert^2 / \mathrm{Var}(x)$; more stringently, the increase in cross-entropy when $\hat{x}$ replaces $x$ in the model's forward pass. Frontier SAEs achieve near-lossless splicing at $L_0 \approx 50$–$100$ active features per token [4][5].
2. **Interpretability scoring.** Automated pipelines show a language model the top-activating contexts for a feature, ask it to write an explanation, then test whether the explanation predicts activations on held-out contexts. SAE features score substantially higher than neurons or alternative dictionary methods on this metric [2][3].
3. **Causal efficacy.** Does clamping/ablating the feature produce the predicted behavioral change, and *only* that change? Sparse feature circuits [6] and steering benchmarks operationalize this; it is the most demanding and least gameable criterion.

---

## 5 Empirical Results and Proofs

**Result 1 — SAEs recover monosemantic features from real LLMs.** Cunningham et al. [2] trained SAEs on a 1-layer and a larger transformer and showed, via automated interpretability scoring, that SAE latents are significantly more interpretable than individual neurons and than PCA/ICA baselines. Ablating pronoun-related features selectively impaired pronoun prediction — a causal, fine-grained edit impossible at neuron granularity.

**Result 2 — Scaling to frontier models preserves monosemanticity.** Templeton et al. [4] trained SAEs with up to 34 million features on Claude 3 Sonnet. Features included abstract concepts ("inner conflict", "code errors", "sycophantic praise"), multilingual and multimodal concepts, and unsafe-content detectors. Feature steering produced coherent, targeted behavioral shifts, and features exhibited abstraction hierarchies (e.g., a general "code defect" direction with specialized children) [4].

**Result 3 — Open replication at every layer.** Gemma Scope [5] released TopK and JumpReLU SAEs for all layers of Gemma 2 2B/9B, enabling independent verification. Community studies confirmed the core findings: feature interpretability exceeding neuron baselines, feature splitting increasing with width, and steering efficacy on open models.

**Result 4 — Feature-level circuits are causally valid.** Marks et al. [6] showed that sparse feature circuits recover human-verified circuits (IOI, greater-than, subject–verb agreement) and that ablating the discovered feature sets degrades task performance while ablating matched control features does not — establishing that the graphs are genuinely causal, not merely correlational.

**Result 5 — The superposition hypothesis is quantitatively supported.** Across studies, the number of interpretable features recovered scales with dictionary width far beyond $d_{\text{model}}$ without saturating: a $d=2304$ residual stream yields hundreds of thousands of distinct interpretable directions [4][5]. This is precisely what superposition predicts — the model computes with many more features than dimensions — and it falsifies the null hypothesis that the neuron basis is the natural computational basis.

> **Theorem (dictionary recovery, informal):** Under the generative model $x = \sum_{j \in S} a_j v_j + \epsilon$ with $|S| \le k \ll m$, incoherent dictionary $V = [v_1, \dots, v_m]$, and sparse coefficients $a$, the k-sparse autoencoder objective recovers $V$ up to sign and permutation in the limit of infinite data, provided the encoder's TopK support matches $S$ with high probability [8]. LLM activations violate the i.i.d. assumptions, so this guarantee is a *sanity check on the method*, not a certificate for any particular trained SAE.

---

## 6 Limitations

Honesty requires cataloging where the program falls short:

1. **Completeness is unproven.** We cannot verify that an SAE has found *all* features the model uses, or that its features correspond to the model's true computational variables rather than a convenient re-description. The "interpretability illusion" critique — that simplified proxies can mislead about the full model — applies with full force [6, related discussion].
2. **The reconstruction–interpretability gap.** Optimizing reconstruction plus sparsity does not explicitly optimize for human interpretability or causal efficacy. Some latents are uninterpretable; some interpretable-looking latents fail causal tests.
3. **Feature splitting and absorption** (§4.2) mean the dictionary is not a canonical inventory; conclusions drawn at one width may not transfer to another.
4. **Computational cost.** Training frontier-scale SAEs requires massive activation datasets and accelerator budgets comparable to a significant fraction of pretraining; inference-time splicing adds overhead.
5. **Correlational contamination.** Features are learned from observational activations; two features that always co-occur cannot be disentangled by any unsupervised method, limiting causal attributions.
6. **Evaluation circularity.** Automated interpretability scoring uses LLMs to judge features of LLMs, risking correlated blind spots; human evaluation does not scale to millions of features.

---

## 7 Conclusion

Sparse autoencoders have converted the superposition hypothesis from a theoretical diagnosis into an engineering discipline. The empirical record — from Cunningham et al.'s proof of concept [2], through Anthropic's monosemanticity scaling [3][4], to the open Gemma Scope ecosystem [5] and feature-level circuit discovery [6] — establishes three durable claims: (i) transformer activations decompose into sparse, substantially monosemantic feature directions far more numerous than the ambient dimension; (ii) these features support causal circuit analysis at finer granularity than heads or neurons; and (iii) feature directions are actionable, enabling steering-vector interventions that edit model behavior at inference time without retraining. The pathologies are real, but they are now *measurable* pathologies — progress of a qualitatively different kind than the field had before. If mechanistic interpretability is reverse-engineering, sparse dictionary learning is currently our best microscope: imperfect optics, but the first instrument that resolves the specimen at all.

---

## References

[1] N. Elhage, T. Henighan, N. Joseph, et al. "Toy Models of Superposition." *Transformer Circuits Thread*, 2022. https://transformer-circuits.pub/2022/toy_model/index.html

[2] H. Cunningham, A. Ewart, L. Riggs, R. Huben, and L. Sharkey. "Sparse Autoencoders Find Highly Interpretable Features in Language Models." *arXiv:2309.08600*, 2023. https://arxiv.org/abs/2309.08600

[3] T. Bricken, A. Templeton, J. Batson, et al. "Towards Monosemanticity: Decomposing Language Models With Dictionary Learning." *Transformer Circuits Thread*, Anthropic, 2023. https://transformer-circuits.pub/2023/monosemantic-features/index.html

[4] A. Templeton, T. Conerly, J. Marcus, et al. "Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet." *Transformer Circuits Thread*, Anthropic, 2024. https://transformer-circuits.pub/2024/scaling-monosemanticity/

[5] T. Lieberum, M. Rajamanoharan, A. Conmy, et al. "Gemma Scope: Open Sparse Autoencoders Everywhere All At Once." *arXiv:2408.05147*, 2024. https://arxiv.org/abs/2408.05147

[6] S. Marks, C. Rager, E. Michaud, Y. Belinkov, D. Bau, and A. Mueller. "Sparse Feature Circuits: Discovering and Editing Interpretable Causal Graphs in Language Models." *arXiv:2403.19647*, 2024. https://arxiv.org/abs/2403.19647

[7] K. Wang, A. Variengien, A. Conmy, B. Shlegeris, and J. Steinhardt. "Interpretability in the Wild: A Circuit for Indirect Object Identification in GPT-2 Small." *arXiv:2211.00593*, 2022. https://arxiv.org/abs/2211.00593

[8] A. Makhzani and B. Frey. "k-Sparse Autoencoders." *arXiv:1312.5663*, 2013. https://arxiv.org/abs/1312.5663

[9] N. Elhage, N. Nanda, C. Olsson, et al. "A Mathematical Framework for Transformer Circuits." *Transformer Circuits Thread*, 2021. https://transformer-circuits.pub/2021/framework/index.html

[10] A. Turner, et al. "Steering GPT-2-XL by Adding an Activation Vector." *Alignment Forum*, 2023. https://www.alignmentforum.org/posts/5spBue2z2tw4JuDCx/steering-gpt-2-xl-by-adding-an-activation-vector

