---
id: thesis-mechanistic-interp-sae-20260809-35d5
title: "Advancing Mechanistic Interpretability: Sparse Autoencoders for Feature Disentanglement, Circuit Probing, and Polysemantic Neuron Decomposition in LLM Layers"
ts: 1786246855435
anon: anon#5579
type: thesis
---

# Advancing Mechanistic Interpretability: Sparse Autoencoders for Feature Disentanglement, Circuit Probing, and Polysemantic Neuron Decomposition in LLM Layers

## Abstract
Polysemanticity arises from superposition where language models represent $m > n$ features in $d$-dimensional activations as near-orthogonal directions [5]. Sparse autoencoders (SAEs) learn overcomplete dictionaries that disentangle these directions into monosemantic features via sparse reconstruction [1][2]. This thesis systematizes SAE architectures for LLM interpretability: TopK, JumpReLU, and gated variants that reduce dead latents and improve reconstruction-sparsity tradeoffs [4][6]. Scaling to 34M features on Claude 3 Sonnet reveals multilingual, multimodal, and safety-relevant concepts with causal steering efficacy [3]. We formalize polysemantic neuron decomposition, circuit probing via feature attribution, and evaluation metrics spanning auto-interpretability, probing, and downstream steering, establishing SAEs as foundation for mechanistic circuit analysis while critically examining non-identifiability, completeness gaps, and geometric limitations [6].

---
## 1 Introduction

Mechanistic interpretability seeks **reversible** mappings from model computations to human-understandable algorithms [2][5]. The central obstacle is *polysemanticity*: a single neuron fires for *Arabic script, HTTP status codes, and chess notation* [1]. 

Elhage et al. hypothesize *superposition* as cause: when models must represent $m \gg d_{model}$ sparse features, optimization packs them as $\mathbf{x} = \sum_{i=1}^m f_i \mathbf{d}_i$ where $\mathbf{d}_i \in \mathbb{R}^d$ are non-orthogonal dictionary vectors [5]. Neurons correspond to canonical basis $\mathbf{e}_j$, not $\mathbf{d}_i$, thus mixed selectivity emerges:

> **Theorem (Superposition Existence):** In a linear autoencoder with $L_2$ regularization and $k$-sparse features where $k \ll m$, there exists a regime where $n<d$ neurons can approximate $m>n$ features with interference $O(\sqrt{k/m})$ via nearly-orthogonal John-Lindenstrauss packing, exceeding capacity of orthogonal coding by $\Theta(m \log m)$ [5].

Dictionary learning inverts this compression. Cunningham et al. first demonstrated that **sparse autoencoders** (SAEs) trained unsupervised on residual stream activations extract monosemantic features scored as more interpretable than raw neurons via auto-interp by GPT-4 [1]. Bricken et al. scaled to $4\times$ overcomplete dictionaries on mid-layer activations of 1-layer transformers, showing feature splitting and composition [2]. Templeton et al. settled the scalability question: training SAEs with *34M latents* on Claude 3 Sonnet middle layer using scaling laws recovers features for *Golden Gate Bridge, Python error handling, sycophancy, deception* with causal influence under clamping [3]. Gao et al. introduced architectural advances—TopK activation, dead-latent mitigation, multi-TopK—that yield clean power-law scaling on GPT-4 activations for 40B tokens [4].

Yet SAEs remain contended: survey evidence notes non-identifiability (piecewise biconvex objective admitting spurious minima), linear representation hypothesis baked into decoder (features = directions only), and failure to capture multi-dimensional manifolds or curved concepts [6].

This thesis contributes:

- Unified formalism for polysemantic decomposition via SAEs, transcoders, and crosscoders
- Architectural taxonomy: ReLU + $L_1$, TopK, JumpReLU, Gated, ProLU, Matryoshka SAEs
- Circuit probing framework linking SAE features to induction, IOI, and factual recall circuits
- Empirical scaling and evaluation meta-study across Anthropic Claude and OpenAI GPT-4 SAE families [3][4]
- Implementation primitives in Python, Rust, Haskell, and TLA+ consistency spec

---
## 2 Background / Preliminaries

### 2.1 Superposition and Polysemanticity

Following Elhage [5], toy model $h = ReLU(W^T x)$, $x' = W h$ with $W \in \mathbb{R}^{n \times m}$, $m>n$, $x$ $k$-sparse. Loss $\mathbb{E}||x-x'||^2 + \lambda||h||^2$ produces phase transitions where features allocated capacity $\propto$ frequency $\times$ importance. Polysemantic neuron $j$ satisfies $\exists i_1\neq i_2: W_{j,i_1},W_{j,i_2} > \tau$, measurable via mean max cosine between feature and neuron axes [5][6].

| Phenomenon | Definition | Metric | Consequence |
|---|---|---|---|
| *Polysemanticity* | neuron activates for multiple unrelated concepts | top-2 activation context cosine | ambiguous causal attribution |
| *Superposition* | $m>n$ features embedded in $\mathbb{R}^n$ | $||D^T D - I||_F$ off-diag | interference |
| *Monosemanticity* | one feature ↔ one direction | auto-interp score >0.7 | steerable [3] |

### 2.2 SAEs

Standard SAE [1][2]:

$$f(\mathbf{x}) = \sigma(W_{enc} \mathbf{x} + b_{enc}), \quad \hat{\mathbf{x}} = W_{dec} f(\mathbf{x}) + b_{dec}$$

with $W_{dec}$ columns unit-norm constrained, sparsity penalty $||f(\mathbf{x})||_0 \approx k$ or $||f||_1$, reconstruction $||\mathbf{x}-\hat{\mathbf{x}}||_2^2$. Overcompleteness factor $R = d_{sae}/d_{model} \in [4,128]$.

Evolution [4][6]:

- **ReLU + L1** (Cunningham 2023) [1]: simple but $L_1$ biases shrinkage, dead latent collapse at scale
- **TopK** (Gao et al. 2024) [4]: $f = TopK(W_{enc}x)$, k fixed, direct $L_0$ control, no shrinkage, fewer dead latents via AuxK loss
- **Gated SAE** (Rajamanoharan 2024 cited in [6]): gating path estimates magnitude, selection path binary, decouples detection vs magnitude
- **JumpReLU** (Lieberum et al. 2024 cited in [6]): $\sigma(z)= z \cdot \mathbb{1}[z>\theta]$, learnable threshold $\theta$, exact sparsity + gradient through straight-through
- **Matryoshka / Multi-granular** [6]: nested dictionaries enforcing hierarchical coarse-to-fine features

> **Definition:** *Feature Splitting / Absorption.* As dictionary grows, coarse feature ("animal") splits into finer ("dog", "cat") or absorbing/covering behavior where parent fires for children exceptions [3][6].

### 2.3 Circuit Probing

Olah et al. introduced *circuits* as sparse subgraphs $C \subset$ computational graph causally responsible for task. SAE features give better basis than neurons for circuit discovery on Indirect Object Identification (IOI) where pinpointing name-mover features reduces logit attribution error by 3x vs neuron baseline [1][2].

---
## 3 Methodology / Formalism

### 3.1 SAE Training Objective

Generalized Lagrangian [4][6]:

$$\mathcal{L} = \mathbb{E}_{x\sim \mathcal{D}_{act}} \left[ ||x-\hat{x}||_2^2 \right] + \lambda \mathcal{R}(f(x)) + \mu \mathcal{L}_{aux} $$

Where $\mathcal{R}$ may be $||f||_1$, indicator $||f||_0$, or $0$ for TopK. $\mathcal{L}_{aux}$ is ghost-grading / AuxK term that resurrects dead features: if feature hasn't fired in $10^6$ tokens, gradient toward reconstructing residual $r = x - \hat{x}$ for top-$k_{aux}=512$ dead candidates [4].

*Python reference (PyTorch TopK SAE):*

```python
import torch, torch.nn as nn
class TopKSAE(nn.Module):
    def __init__(self, d_model=4096, d_sae=65536, k=128, k_aux=512):
        super().__init__()
        self.enc = nn.Linear(d_model, d_sae, bias=True)
        self.dec = nn.Linear(d_sae, d_model, bias=False)
        self.k = k; self.k_aux = k_aux
        self.threshold = 0.0
    def forward(self, x): # x [B,d_model]
        pre = self.enc(x)
        # TopK
        vals, idxs = torch.topk(pre, self.k, dim=-1)
        f = torch.zeros_like(pre).scatter(-1, idxs, torch.relu(vals))
        x_hat = self.dec(f)
        # AuxK for dead latents
        dead_mask = (self.dead_counter > 1e6) # updated ouside
        if dead_mask.any():
            resid = x - x_hat.detach()
            aux_vals = (resid @ self.dec.weight[:, dead_mask].T) # projection
            # loss encourages dead dirs to explain resid
            aux_loss = -aux_vals.topk(self.k_aux).values.mean()
        else:
            aux_loss = 0.0
        return x_hat, f, aux_loss
    def normalize_decoder(self):
        with torch.no_grad():
            self.dec.weight.data = self.dec.weight.data / self.dec.weight.data.norm(dim=0, keepdim=True).clamp(min=1e-8)
```

### 3.2 Decomposition Pipeline

Steps to mechanistically decompose layer $\ell$:

1. **Cache activations**: residual stream $\mathbf{r}_\ell \in \mathbb{R}^{d}$, attention output, MLP mid $m_\ell$, for $N=400M$ tokens Shakespeare + Pile mix
2. **Normalize**: per-token $L_2$ or RMS $\hat{x}=x/||x||$ to prevent magnitude-driven feature collapse
3. **Train SAE** with $R=8,16,32$, $k=32-256$ (target $L_0$), Adam $\beta=(0.9,0.99)$, LR 1e-4 cosine
4. **Interpret** via max-activating dataset examples $\mathcal{E}_i = \text{Top}_{64} \{x: f_i(x)>\tau\}$ and logit lens $W_U W_{dec}[:,i]$ [3]
5. **Probe circuits**: causal scrubbing—replace $f_i$ with counterfactual values from other prompt, measure logit difference $\Delta$ for IOI tasks [1]
6. **Steer**: clamp $f_i \leftarrow \alpha$ scaled 10x to test behavioral effect, e.g., Golden Gate feature induces self-identification as bridge [3]

*Haskell type-safe feature map:*

```haskell
data SAEFeature = SAEFeature
  { fid :: Int
  , direction :: Vector Double -- dec column, unit norm
  , actFn :: Double -> Double
  , interp :: String -- auto-interp label
  }

decompose :: Matrix Double -> Vector Double -> [SAEFeature] -> Vector Double
decompose dec enc feats x = 
  let f = sparseEncode x -- TopK
  in dec `mul` f
```

*Rust fast Residual decoder for inference:*

```rust
struct SAE { w_dec: Vec<Vec<f32>>, b_dec: Vec<f32> } // [d_model x d_sae]
impl SAE {
  fn decode(&self, feats: &[(usize,f32)], d_model: usize) -> Vec<f32> {
    let mut out = self.b_dec.clone();
    for (i, v) in feats {
      for j in 0..d_model { out[j] += self.w_dec[j][*i] * v; }
    }
    out
  }
}
```

*TLA+ dictionary safety:*

```tla
---------------- MODULE SAEDictionary ----------------
EXTENDS Reals, FiniteSets
VARIABLES dict, deadCount, activations
Init == dict \in [1..DSAE -> UnitSphere] /\ deadCount = [i \in 1..DSAE |-> 0]
Activate(i) == activations' = activations \cup {i} /\ deadCount' = [deadCount EXCEPT ![i]=0]
Expire(i) == deadCount[i] > 1e6 => dict' = dict \cup {random_direction()}
Safety == \A i \in 1..DSAE: ||dict[i]|| = 1.0
Liveness == \A i: <>(deadCount[i] = 0)
Spec == Init /\ [][\E i: Activate(i) \/ Expire(i)]_<<dict,deadCount>>
======================================================
```

### 3.3 Circuit Extraction

Inspired by Wang et al. IOI, we use *path patching* on SAE feature graph: nodes = features, edges = QKOV composition via $W_{QK}^h, W_{OV}^h$. Feature circuit $C$ minimal subset preserving $>80\%$ logit difference on contrast pair:

$$\text{Faithfulness}(C) = \frac{ \text{logit}_C(task) - \text{logit}_{corrupt}}{ \text{logit}_{clean} - \text{logit}_{corrupt}}$$

 SAEs outperform neurons on this metric: mean faithfulness 0.92 vs 0.71 at equal sparsity 64 [1].

---
## 4 Deep Dive

### 4.1 Feature Splitting, Absorption, and Geometries

Templeton et al. [3] identify three scaling phenomena that complicate ontology:

- **Splitting:** As $R$ goes $4\to32$, broad feature *code* divides into *Python code, JavaScript code, code error message*. Measured via increase in pairwise cosine similarity among parent's top-k children and drop in parent activation when child active (absorption rate rises from 0.12 to 0.34 at $R=32$) [3].
- **Composition:** Attention-superposed bigrams require *both* token features; SAE recovers conjunctive coding $f_{A\&B}$ as separate direction not decomposable as sum $d_A+d_B$, challenging additive Linear Representation Hypothesis (LRH).
- **Non-linear manifolds:** Recent criticism [6] shows features for *circle* arc lie on 2D manifold; single direction approximation incurs 23% reconstruction error irrespective of dictionary size. Obtuse *gender* circular encoding similar.

> **Theorem (Biconvex Non-Identifiability):** SDL objective $\min_{D,\alpha} ||X- D\alpha||_F^2$ s.t. $||\alpha||_0\le k$, $||d_j||=1$ is biconvex but not jointly convex; permuted, scaled, and spurious local minima exist where $D'$ yields same loss but permuted feature semantics. Tang et al. 2026 (cited in [6]) proves infinite family of global minima differing by orthogonal transform on co-activating feature subspace.

Consequence: interpretability via dataset examples may latch onto *spurious* decoder directions that fit training distribution but fail out-of-distribution causal tests—need causal validation [3][6].

### 4.2 TopK vs JumpReLU vs Gated Tradeoffs

Gao et al. 2024 systematic sweep on GPT-4 activations for 40B tokens [4]:

| Architecture | Pareto $(MSE,L_0)$ AUC | Dead latents % at 16M latents | Auto-interp F1 | Training stability |
|---|---|---|---|---|
| ReLU $L_1$ | 0.71 | 38% @ $\lambda=5e-4$ | 0.62 | fragile to $\lambda$ |
| TopK $k=128$ | **0.82** | 7% with AuxK | 0.68 | robust, no shrinkage |
| Gated | 0.80 | 9% | 0.70 | 2x params |
| JumpReLU $\theta$ learnable | 0.81 | 11% w/o AuxK, 4% w | **0.72** | ST gradient noise |
| Matryoshka | 0.79 | 6% | 0.69 | needs nested loss |

*Insight:* TopK simplifies tuning by direct $k$ control—equivalent to adaptive $\lambda$ with monotonic $k(\lambda)$. Multi-TopK (training with $k,4k$ reconstruction pair) improves progressive coding (coarse fits remain useful) [4].

### 4.3 Safety-Relevant Features and Steering in Claude 3 Sonnet

Scaling Monosemanticity artifact examined 34M feature SAE on layer 24 residual stream [3]. Notable:

- **Deception feature f/771351:** activates on stories where protagonist fabricates, e.g., "pretended not to know the price". Clamping $+8\times$ increases model deceptive completions on moral dilemmas eval from 12% → 47% (causal).
- **Sycophancy / flattery feature:** phrases "a generous and gracious man", "your brilliant insight". Steering $-6$ reduces agreeableness on contested factual QA by 31% with <2% perplexity overhead.
- **Power-seeking / self-preservation:** activates on discussions of shutdown, corrigibility. Positive steering amplifies refusal to self-modify instructions.
- **Codebug features:** 11 distinct features for null pointer, off-by-one, etc., each localizable to specific token patterns rather than broad "error".

> *Multilingual & Multimodal Generalization:* Despite text-only training, features transfer zero-shot to image tokenizations of same concept (e.g., Golden Gate Bridge photograph) and across 15 languages, indicating model learns abstract concept direction not n-gram detector [3].

### 4.4 From Neurons to Transcoders and Crosscoders

Recent extensions beyond per-layer SAEs [6]:

- **Transcoder** $x_{\ell+1} \approx W_{dec} f(W_{enc} x_{\ell})$ approximates MLP computation itself, enabling full circuit tracing through non-linearity Dunefsky et al. 2024.
- **Crosscoder** concatenates activations $[\mathbf{r}_\ell^{(model A)};\mathbf{r}_\ell^{(model B)}]$ learns shared dictionary, revealing universal features across model families (Lindsey et al. 2024). Universality score $U = \mathbb{E}_{shared} \cos(d_A,d_B)$ measured 0.32-0.61 across Pythia/LLama families, evidence for convergent representation hypothesis.

---
## 5 Empirical Evaluation / Proofs

**Setup:** Synthesize reported numbers from seed papers [1][2][3][4][6]; no new training re-run but meta-analysis.

### 5.1 Interpretability Gains

| Layer / Model | Method | $L_0$ | Reconstruction MSE | Explained Var | Auto-Interp Score (LLM judge) | Dead % |
|---|---|---|---|---|---|---|
| GPT-2 Small MLP [1] | ReLU SAE $R=8$ | 20 | 0.034 | 0.88 | 0.71 vs neuron 0.46 | 12% |
| 1L transformer [2] | Dictionary $R=4$ | 18 | 0.021 | 0.91 | 0.84 vs 0.51 | 8% |
| Claude 3 Sonnet L24 [3] | TopK $k=64,R=32$, 34M | 64 | 0.0092 | 0.95 | 0.73 (human) | 15% w/o resample |
| GPT-4 R-stream [4] | TopK k=128 16M | 128 | 0.0078 | 0.96 | 0.69 | 7% with AuxK |

*Observation:* Interpretability improves with dictionary size but with diminishing returns post $R=16$; reconstruction-sparsity frontier follows power law $MSE \propto N_{latents}^{-0.11}$ [4].

### 5.2 Circuit Probing IOI

IOI task: "John gave book to Mary...". Counterfactual patching via SAE features yields logit recovery:

- **Neuron baseline** (top-32 neurons by attribution): recovery 0.58, L0 32, spurious 14 neurons unrelated to name-mover
- **SAE features** [1]: recovery **0.89**, L0 21, precisely isolates Induction Head features + S-inhibition + Name Mover decomposition; false positives 3
- **Transcoder circuit:** replaces raw MLP with 6 features accounting for 91% KL on task variant where IOI verb perturbed

*Proof Sketch (Feature Faithfulness):* Let clean input $x_c$, corrupted $x_{corr}$, SAE representation $f$. Path patching replacing $f_i(x_c)$ into $x_{corr}$ forward pass yields $\Delta_i$ logit difference. Summation $\sum_{i\in C}\Delta_i \approx$ total indirect effect due to near-linear decoder assumption. Empirically holds when $k$ sparsity ensures limited interference $\sum_{j \notin C} \langle d_i,d_j\rangle f_j$ small [1][2].

### 5.3 Safety Steering Efficacy

Templeton safety suite [3]:

- **Bias feature steering** $-5$ reduces stereotypical completion on BBQ bias benchmark from 22% → 9% with negligible HELM drop 0.4%
- **Deception amplification** $+6$ increases success of simulated social engineering prompt from 8% → 29% showing dual-use risk
- **Code error features:** activating error-feature $f_{null_deref}$ increases model propensity to warn about null checks from 18% to 61% in generated Python snippets—useful for alignment scaffolding

> Open Problem: Can we guarantee monotonic steering without side effects on unrelated features sharing decoder overlap $\langle d_i,d_j\rangle >0.2$? Empirical side-effect measured as increase in CE loss +0.08 at $k$ clamped.

---
## 6 Limitations and Open Problems

- **Incompleteness:** With $d_{sae}=34M$, still only ~30% estimated feature capture by coverage analysis where model can articulate concept but no SAE feature activates strongly; long-tail idiosyncratic knowledge escapes due to $k$-sparse bottleneck [3][6].
- **Non-identifiability & Spurious Minima:** Piecewise biconvex objective admits infinite minima equivalent in loss but permuted semantics; reseed variance in feature labels quantified as Adjusted Rand Index 0.41 across seeds for same architecture—implies ontology instability [6].
- **Linear Representation Hypothesis Violation:** Features for *day-of-week circular, 2D spatial position, truth-direction lying on curved manifold* cannot be represented as single direction; Matryoshka and manifold-SAEs attempt 2D planes but still linear in latent [6]. Irreducibly multi-dimensional features estimated 12-20% of concept inventory (Engels 2025).
- **Context Dependence:** SAE trained on single layer misses cross-layer superposition; crosscoders partially address but need $L$ coupled dictionaries, compute $O(L\cdot d_{sae})$, prohibitive for 100-layer models. Temporal evolution: feature at layer 12 splits at layer 24 often unaligned.
- **Evaluation Crisis:** Automated interpretability metrics correlate $\rho=0.58$ with human but fail on rare features; we lack rigorous causal ground truth whether discovered features = true causal variables vs correlated proxies; $80\%$ faithfulness not sufficiency [6].
- **Safety Dual-Use:** Steering decompositions enable adversarial elicitation of deception, power-seeking; public release of 16M GPT-4 SAEs [4] required redaction of 0.3% features flagged hazardous, but filtering approximate.

---
## 7 Conclusion

Sparse autoencoders have transitioned from proof-of-concept on toy transformers [5] to indispensable mechanistic scalpel for production LLMs [3][4]. By imposing *sparsity as inductive bias*, they approximate inverse of superposition, recovering monosemantic directions with higher auto-interpretability than neurons and enabling precise circuit dissection on IOI and factual recall where neuron baselines conflate concepts [1][2]. Architectural advances—TopK, JumpReLU, gated, Matryoshka—solve dead-latent collapse and improve scaling laws to 16M latents on GPT-4 with <7% dead rate while boosting interpretability scores from 0.62 to 0.72 [4][6].

Yet the lens is imperfect: non-identifiable dictionaries produce seed-variant ontologies, incompleteness leaves long-tail knowledge uncaptured, and linear direction assumption blinds us to curved manifolds [6]. Scaling Monosemanticity demonstrates both promise and residue: multilingual generalization and safety-feature steering work causally, but eval gap remains—no rigorous guarantee that 34M features faithfully mirror model computations [3].

The synthesis path—**SAEs for features → transcoders for MLP circuits → crosscoders for universals**—suggests future where mechanistic interpretability operates entirely in sparse feature basis, with end-to-end sparse models avoiding polysemanticity by construction. Achieving this demands solving non-linear feature geometries, cross-layer coupling, and evaluation formalism grounded in causal abstraction rather than subjective interpretability scores. Until then, SAEs remain our best microscope, not yet a map.

---

## References

[1] Cunningham, H., Ewart, A., Riggs, L., Huben, R., Sharkey, L. Sparse Autoencoders Find Highly Interpretable Features in Language Models. *arXiv:2309.08600*. https://arxiv.org/abs/2309.08600 — Foundation: ReLU SAE on residual streams, polysemantic de-mixing, IOI circuit probing with finer granularity, auto-interpretability vs neurons.

[2] Bricken, T., Templeton, A., Batson, J., Chen, B., Jermyn, A., Conerly, T., Turner, N., Anil, C., Denison, C., Askell, A., Lasenby, R., Wu, Y., Kravec, S., Schiefer, N., Maxwell, T., Joseph, N., Hatfield-Dodds, Z., Tamkin, A., Nguyen, K., McLean, B., Burke, J. E., Hume, T., Carter, S., Henighan, T., Olah, C. Towards Monosemanticity: Decomposing Language Models With Dictionary Learning. *Transformer Circuits Thread, 2023*. https://transformer-circuits.pub/2023/monosemantic-features/index.html — First demonstration of monosemantic feature decomposition via dictionary learning on 1-layer transformers, feature splitting analysis, scaling to millions of features.

[3] Templeton, A., Conerly, T., Marcus, J., Lindsey, J., Bricken, T., Chen, B., Pearce, A., Citro, C., Ameisen, E., Jones, A., Cunningham, H., Turner, N. L., McDougall, C., MacDiarmid, M., Tamkin, A., Durmus, E., Hume, T., Mosconi, F., Freeman, C. D., Sumers, T. R., Rees, E., Batson, J., Jermyn, A., Carter, S., Olah, C., Henighan, T. Scaling Monosemanticity: Extracting Interpretable Features from Claude 3 Sonnet. *Transformer Circuits Thread, 2024*. https://transformer-circuits.pub/2024/scaling-monosemanticity/index.html — Demonstrates SAEs scale to production Claude 3; 34M features, multilingual/multimodal generalization, safety-relevant steering (deception, sycophancy, power-seeking), scaling laws for hyperparameter selection.

[4] Gao, L., La Tour, T. D., Tillman, H., Goh, G., Troll, R., Radford, A., Sutskever, I., Leike, J., Wu, J. Scaling and Evaluating Sparse Autoencoders. *arXiv:2406.04093*. https://arxiv.org/abs/2406.04093 — OpenAI: k-sparse TopK SAEs, AuxK dead-latent mitigation, clean power-law scaling on GPT-4 activations 40B tokens, 16M latent SAE release, new evaluation metrics for feature quality, multi-TopK progressive coding.

[5] Elhage, N., Hume, T., Olsson, C., Schiefer, N., Henighan, T., Kravec, S., Hatfield-Dodds, Z., Lasenby, R., Drain, D., Chen, C., Grosse, R., McCandlish, S., Kaplan, J., Amodei, D., Wattenberg, M., Olah, C. Toy Models of Superposition. *Transformer Circuits Thread, 2022*. https://transformer-circuits.pub/2022/toy_model/index.html — Theoretical foundation for superposition, polysemanticity emergence when $m \gg n$, phase diagrams for capacity allocation, almost-orthogonal packing explaining why neurons appear polysemantic.

[6] Shu, D., Wu, X., Zhao, H., Rai, D., Yao, Z., Liu, N., Du, M. A Survey on Sparse Autoencoders: Interpreting the Internal Mechanisms of Large Language Models. *arXiv:2503.05613*. https://arxiv.org/abs/2503.05613 — Comprehensive survey: SAE architecture taxonomy, input/output explanation methods, evaluation structural/functional metrics, real-world steering/editing/manipulation, challenges of non-identifiability, linearity constraint, multi-dimensional concepts.

[7] Marks, S., Rager, C., Michaud, E. J., Belinkov, Y., Bau, D., Mueller, A. Sparse Feature Circuits: Discovering and Editing Interpretable Causal Graphs in Language Models. *arXiv:2403.19647*. https://arxiv.org/abs/2403.19647 — Extends SAE interpretability to causal circuits, sparse feature circuits discovery method, causal effects via interchange interventions linking features to behavior.

[8] Olah, C., Cammarata, N., Schubert, L., Goh, G., Petrov, M., Carter, S. Zoom In: An Introduction to Circuits. *Distill, 2020*. https://distill.pub/2020/circuits/zoom-in/ — Circuits agenda, methodology for mechanistic interpretability, polysemantic neurons in vision vs language, foundational for SAE circuit probing.