---
id: grokking-and-phase-transitions-in-neural-network-training-mechanistic-accounts-of-delayed-generalization-c9c0d60b
title: "Grokking and Phase Transitions in Neural Network Training: Mechanistic Accounts of Delayed Generalization"
anon: anon#1497
ts: 1788970003000
type: thesis
---

# Grokking and Phase Transitions in Neural Network Training: Mechanistic Accounts of Delayed Generalization

## Abstract

Delayed generalization — *grokking* — denotes the phenomenon in which an overparameterized neural network first memorizes its training data to perfect accuracy while validation performance remains at chance, and only thousands of optimization steps later undergoes a sharp transition to near-perfect test accuracy. First documented by Power et al. on small algorithmic datasets [1], grokking has become the canonical laboratory for studying how learning in neural networks resembles a *phase transition*: a discontinuous macroscopic change masking continuous microscopic dynamics. This thesis unifies four accounts of the phenomenon — mechanistic interpretability of the Fourier multiplication circuit [2], the slingshot mechanism of adaptive optimizers [3], effective theories of representation learning and their phase diagrams [4], and the skeptical program linking transition-like behavior to metric choice [5] — into a single framework. We derive why weight decay selects low-norm generalizing solutions, give a runnable PyTorch reproduction of grokking on modular addition, and argue that delayed generalization is best understood as the interplay of two timescales: fast memorization and slow circuit crystallization.

## 1 Introduction

The generalization behavior of overparameterized neural networks continues to resist the intuitions inherited from classical statistical learning theory. A model capable of fitting arbitrary label noise should, by classical wisdom, overfit catastrophically — yet neural networks routinely generalize from memorization. *Grokking* pushes this tension to its most extreme and most legible form: the network first overfits completely, generalizes not at all, and then, long after any reasonable practitioner would have stopped training, suddenly *understands* [1].

Concretely, the canonical experiment trains a small transformer on a fraction of the triples $(a, b, c)$ with $c = a + b \bmod p$, a prime modulus. After a few thousand steps, training accuracy reaches $100\%$ while validation accuracy remains at chance $\approx 1/p$. Training continues for tens or hundreds of thousands of additional steps — far past the point of overfitting — and validation accuracy then rises abruptly to near $100\%$. Nothing in the training loss obviously prefigures the transition; the network simply groks.

Grokking matters because it separates in *time* what is normally entangled in *data*: the capacity to fit the training set and the capacity to generalize. Where both are acquired simultaneously, it is impossible to determine which properties of the learned function cause generalization and which merely co-occur with it. Grokking hands us a temporal scalpel — as one recent study puts it, delayed generalization is "a causal probe" for identifying which geometric properties are functionally necessary for generalization and which are coincidental [6].

This thesis develops four complementary mechanistic accounts and synthesizes them:

1. **The mechanistic account.** Nanda et al. reverse-engineered the algorithm learned by small transformers on modular addition: a *Fourier multiplication circuit* converting addition into rotation on a circle, with training decomposing into memorization, circuit formation, and cleanup [2].
2. **The optimization account.** Thilak et al. identified the *slingshot mechanism*: cyclic phase transitions between stable and unstable training regimes that act as an implicit regularizer favoring the generalizing solution [3].
3. **The effective-theory account.** Liu et al. built a microscopic effective theory of representation learning and a macroscopic phase diagram with four regimes — comprehension, grokking, memorization, confusion — showing representation learning occurs only in a narrow "Goldilocks zone" [4].
4. **The skeptical account.** Schaeffer et al. remind us that apparently discontinuous phase transitions can be artifacts of *metric choice*: nonlinear, thresholded metrics convert smooth underlying progress into sudden jumps [5].

> **Thesis Statement.** Grokking is a *competition-driven phase transition*: a memorizing circuit and a generalizing circuit are learned on separated timescales; explicit or implicit regularization continuously suppresses the high-norm memorizer while the low-norm generalizer accumulates, producing a sudden macroscopic transition from continuous microscopic dynamics.

---

## 2 Background

### 2.1 The Discovery of Grokking

Power et al. (2022) introduced grokking while studying generalization on small algorithmically generated datasets [1], where the generating rule is known exactly and data efficiency, memorization, and speed of learning can be studied in fine detail. Their central findings:

- Networks trained on small fractions of algorithmic data exhibit a long plateau: training accuracy saturates at $\approx 100\%$ while validation accuracy lingers near chance.
- With continued optimization, validation accuracy transitions sharply from chance to near-perfect — *well past the point of overfitting*.
- Smaller datasets require *increasingly* many optimization steps for generalization: the grokking delay grows as the training fraction shrinks, suggesting a data-size-dependent phase boundary.
- The effect is highly sensitive to optimization hyperparameters: weight decay, learning rate, and initialization scale strongly modulate whether and when grokking occurs.

These observations established algorithmic datasets as a model system for theories of generalization — a "hydrogen atom" of deep learning, where the simplicity of the task makes the full mechanism legible.

### 2.2 Related Phenomena: Double Descent, Emergence, Phase Transitions

Grokking belongs to a family of non-monotonic, transition-like phenomena:

- **Double descent.** Test error as a function of model size decreases, increases, then *decreases again* past the interpolation threshold. Davies et al. explicitly connected grokking and double descent through a shared pattern-learning model [8].
- **Emergent abilities.** Wei et al. documented abilities in large language models that appear absent below a scale threshold and present above it, with sharp, unpredictable onsets [7]. The analogy to grokking is direct if one replaces *training steps* with *model scale*.
- **The mirage critique.** Schaeffer et al. argued that many emergent abilities are artifacts of discontinuous metrics: exact-match accuracy maps smooth improvements in per-token error rates into sharp transitions, whereas linear metrics (e.g., token edit distance) reveal smooth, predictable scaling [5]. Any thresholded readout of a continuous progress measure can look like a phase transition.

### 2.3 Modular Arithmetic as a Model System

The task $f(a,b) = a + b \bmod p$ over tokens in $\mathbb{Z}_p$ is the fruit fly of grokking research. The generalization target is crisp (implement the group operation, not interpolate), the minimal generalizing circuit is known analytically, the memorizing solution is a lookup table of size $O(p^2)$ — vastly more expensive than the $O(p)$ generalizing circuit — and the train/validation split can be tuned continuously.

| Task | Memorizing cost | Generalizing cost | Key circuit |
|---|---|---|---|
| $a+b \bmod p$ | $O(p^2)$ lookup | $O(p)$ Fourier basis | Trig-identity rotation |
| $a \times b \bmod p$ | $O(p^2)$ lookup | $O(p \log p)$ DFT | Discrete logarithm map |
| Sparse parity | dense subnetwork | sparse subnetwork | Subnetwork competition [9] |

---

## 3 Methodology

Our analysis rests on a reproducible experimental core: a one-hidden-layer ReLU MLP on modular addition modulo $p = 113$, trained with AdamW. This minimal setup reproduces grokking without transformers, confirming the phenomenon is governed by optimization and regularization rather than architecture [1, 10].

### 3.1 Reproducing Grokking in PyTorch

```python
import torch, torch.nn as nn, math, random

class GrokMLP(nn.Module):
    def __init__(self, p=113, hidden=512):
        super().__init__()
        self.p = p
        self.fc1 = nn.Linear(2 * p, hidden, bias=False)
        self.fc2 = nn.Linear(hidden, p, bias=False)
    def forward(self, a, b):
        x = torch.cat([nn.functional.one_hot(a, self.p),
                       nn.functional.one_hot(b, self.p)], dim=1).float()
        return self.fc2(torch.relu(self.fc1(x)))

def make_data(p=113, train_frac=0.3, seed=0):
    rng = random.Random(seed)
    pairs = [(a, b) for a in range(p) for b in range(p)]
    rng.shuffle(pairs)
    n = int(len(pairs) * train_frac)
    to_t = lambda ps: (torch.tensor([a for a, _ in ps]),
                       torch.tensor([b for _, b in ps]),
                       torch.tensor([(a + b) % p for a, b in ps]))
    return (*to_t(pairs[:n]), *to_t(pairs[n:]))

def train(p=113, steps=20000, lr=1e-3, wd=1.0, hidden=512):
    ta, tb, tc, va, vb, vc = make_data(p)
    model = GrokMLP(p, hidden)
    for m in model.modules():  # small init: keep memorizer from dominating
        if isinstance(m, nn.Linear):
            nn.init.normal_(m.weight, std=1.0 / math.sqrt(m.in_features))
    opt = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=wd)
    loss = nn.CrossEntropyLoss()
    for t in range(steps):
        opt.zero_grad(); loss(model(ta, tb), tc).backward(); opt.step()
        if t % 2000 == 0:
            with torch.no_grad():
                tr = (model(ta, tb).argmax(1) == tc).float().mean()
                va_ = (model(va, vb).argmax(1) == vc).float().mean()
            print(f"step {t:6d} | train {tr:.3f} | val {va_:.3f}")
    return model

# Typical run (wd=1.0): train->1.00 by ~2k steps; val stuck near 1/113
# until ~12-15k steps, then a sharp jump toward 1.00.
if __name__ == "__main__":
    train()
```

Hyperparameter guidance from the literature: weight decay in the range $10^{-2}$–$10^{-1}$ is the dominant control parameter, and initialization scale must be modest [1, 4].

### 3.2 Diagnostic Instrumentation: Progress Measures

To move from phenomenology to mechanism, we instrument three *progress measures* — continuous quantities tracking the hidden dynamics beneath the discontinuous accuracy curve [2]:

1. **Excluded loss.** Validation loss with the memorized component's contribution removed, isolating the generalizing circuit's growth before it dominates the output.
2. **Fourier localization of weights.** The fraction of embedding weight energy concentrated on a few frequencies $\omega_k = 2\pi k / p$; its rise marks circuit formation while accuracy is flat.
3. **Weight-norm trajectory.** The $\ell_2$ norm $\lVert w \rVert_2$; its slow decay under weight decay during the plateau is regularization visibly eroding the memorizing solution.

> **Methodological Principle.** *Never judge learning by accuracy alone.* Thresholded metrics are blind to sub-threshold progress. Progress measures convert the apparent discontinuity of grokking into continuous, analyzable curves — exactly the move Schaeffer et al. demand when they insist on linear readouts [5].

---

## 4 Deep Dive

### 4.1 The Fourier Multiplication Circuit: Reverse-Engineering the Generalizer

Nanda et al. fully reverse-engineered the algorithm learned by a one-layer transformer on modular addition [2]:

1. **Embeddings as sinusoids.** Each token $a$ is embedded as sinusoids, $W_{\text{emb}}[a]_k \propto \cos(\omega_k a + \phi_k)$, $\sin(\omega_k a + \phi_k)$ for a sparse set of key frequencies $\omega_k = 2\pi k/p$ — tokens arranged like numbers on a clock face [10].
2. **Phase addition.** The network forms products of sinusoids and applies $\cos(\alpha+\beta) = \cos\alpha\cos\beta - \sin\alpha\sin\beta$, so that $\omega_k a + \omega_k b = \omega_k(a+b)$ computes modular addition in the exponent.
3. **Readout by projection.** Logits for candidate $c$ are $\propto \sum_k \cos(\omega_k(a + b - c))$, peaking sharply at $c = a + b \bmod p$.

Gromov (2023) gave this analytic footing: cosine input weights satisfying the phase-sum constraint $\phi_{\text{out}} = \phi_a + \phi_b$ are *sufficient* for arbitrarily accurate modular addition, with an explicit circuit construction for quadratic activations extending empirically to ReLU [11]. Training then decomposes into three continuous phases [2]: **memorization** (rapid fitting with a high-norm, Fourier-delocalized solution), **circuit formation** (the Fourier-localized component grows steadily while accuracy stays flat), and **cleanup** (weight decay erodes the memorizer; logits flip; accuracy jumps).

> **Theorem (Informal; after [2, 11]).** *A one-hidden-layer network with $O(p)$ units and cosine-structured weights satisfying the phase-sum constraint computes $a+b \bmod p$ exactly, while any memorizing solution requires $\Omega(p^2)$ effective parameters. Under $\ell_2$ regularization, the generalizing circuit is the unique norm-minimal interpolator.*

### 4.2 The Slingshot Mechanism: Implicit Regularization from the Optimizer

Thilak et al. uncovered an optimization anomaly co-occurring with grokking when explicit regularization is absent [3]. Late in training, Adam exhibits the *slingshot effect*: a cycle beginning with a **norm-growth phase** (last-layer weight norm climbs) followed by a sudden instability — a sharp loss spike — and a **norm-plateau phase**. The mechanism: once training loss nears zero, gradients shrink toward numerical precision limits, Adam's second-moment estimates $v_t$ decay, and the effective step size $\eta/\sqrt{v_t+\epsilon}$ *balloons*, catapulting weights out of the sharp memorizing minimum into a region where $v_t$ re-accumulates and training restabilizes at lower norm. Each slingshot preferentially ejects the optimizer from high-norm, sharp minima (the memorizer) while leaving flatter, lower-norm basins (the generalizer) intact.

Empirically, without explicit regularization, grokking "almost exclusively happens at the onset of slingshots, and is absent without it" [3]. Nanda et al. qualified this: with weight decay present, grokking occurs without slingshots — the slingshot is *sufficient but not necessary*, one physical realization of the regularization pressure the generalizing circuit requires [2]. Notably, $\ell_1$ regularization *never* induces grokking [2]: the *form* of the inductive bias matters, not merely its strength.

### 4.3 Effective Theory and Phase Diagrams: The Goldilocks Zone

Liu et al. built a microscopic effective theory of representation learning predicting how structured-representation dynamics depend on training-set size, plus a macroscopic phase diagram with four regimes [4]:

1. **Comprehension.** Large data: generalization arrives as soon as the training set is fit. No delay.
2. **Grokking.** Intermediate data: memorization first, then delayed generalization. This phase sits *close to the memorization phase* in hyperparameter space — hence the long delay.
3. **Memorization.** Small data or weak regularization: fit without generalization.
4. **Confusion.** Excessive regularization: failure to fit even the training set.

Representation learning occurs only in a narrow **"Goldilocks zone"** (comprehension + grokking) between memorization and confusion — *"intelligence from starvation"*: resource limitation forces the discovery of efficient solutions [4]. In physics language, this is a first-order-like transition: memorizing and generalizing solutions coexist as competing minima, and the system jumps between them while microscopic dynamics (circuit amplification, norm decay) remain analytic — consistent with Nanda et al.'s continuous progress measures.

### 4.4 Are Phase Transitions a Mirage? The Metric-Choice Critique

Schaeffer et al. showed that many claimed *emergent abilities* of LLMs evaporate under linear metrics: exact-match accuracy is a discontinuous function of the continuous per-token error rate, so smooth improvement looks like a sharp jump, while token edit distance reveals the underlying smoothness [5]. Applied to grokking:

- **The critique bites the accuracy curve.** Validation accuracy on modular addition *is* thresholded, and the "sudden" jump partly reflects argmax nonlinearity.
- **But weight-space changes are real.** Fourier localization of embeddings, weight-norm collapse, the flip in which circuit dominates the logits — these are facts about parameters, not readout artifacts. No metric conjures a sinusoidal embedding matrix into existence.
- **The two programs agree on method.** Both demand continuous, fine-grained probes rather than thresholded curves. Schaeffer et al.'s positive program *is* Nanda et al.'s progress-measures methodology.

The honest synthesis: grokking exhibits a *genuine* transition in the learned function class (lookup table $\to$ Fourier circuit), but the *sharpness* of the observed transition is amplified by metric nonlinearity.

---

## 5 Empirical Results and Theoretical Guarantees

**Established regularities.** (i) The grokking delay grows as the training fraction shrinks [1], with Liu et al.'s effective theory predicting the functional form [4]. (ii) Weight decay is the dominant control parameter: grokking occurs only within a narrow band of regularization strengths [10]; transformers need AdamW with strong weight decay while MLPs grok with SGD, but matched-config delays are comparable (≈46k vs. ≈51k steps) [10]. (iii) Initialization scale alone can induce or suppress grokking, even on MNIST and IMDB — the phenomenon is not confined to algorithmic tasks [4]. (iv) Varma et al. framed the competition as *circuit efficiency*: the generalizing circuit is slower to learn but more parameter-efficient [12]; Merrill et al. gave the sparse-parity analogue — dense (memorizing) vs. sparse (generalizing) subnetworks, with grokking as the sparse subnetwork's delayed victory [9].

> **Theorem (Informal; after Merrill et al. [9]).** *In a two-layer network on sparse parity, a dense subnetwork memorizes in time $O(1)$ while a sparse subnetwork computing the parity needs $\Omega(\log n)$; generalization emerges at the later timescale — grokking as timescale separation.*

**Fragility.** Multi-seed studies show grokking is *conditional and fragile*: dramatic single-run narratives dissolve under seed control, and some small models never form the textbook Fourier circle [13]. The transition is a property of specific (hyperparameter, seed, architecture) triples, not of the task alone.

| Claim | Status |
|---|---|
| Fourier circuit computes modular addition | Proven constructively [11] |
| Trained transformers learn it | Mechanistically verified [2] |
| Memorization → formation → cleanup | Empirically established [2] |
| Slingshot as implicit regularizer | Empirically supported [3] |
| Four-phase Goldilocks diagram | Theory + experiment [4] |
| Sharpness partly metric artifact | Established [5] |
| Grokking universal to the task | **False** — seed/architecture fragile [13] |

---

## 6 Limitations

**1. The model-system gap.** Nearly everything known comes from algorithmic tasks with analytically known circuits. Whether delayed generalization in LLMs — where the generalizing circuit cannot be written down — obeys the same competition dynamics is an open extrapolation.

**2. Fragility undercuts prediction.** Grokking is exquisitely sensitive to initialization, hardware numerics, and hyperparameters [13]. A theory predicting a phase transition but not *which* seeds undergo it is descriptive rather than predictive.

**3. The efficiency account is incomplete.** "The generalizing circuit is more efficient" explains *which* solution wins but not the *timescale separation* — why the efficient circuit is so much slower to learn. Margin-maximization analyses of Fourier emergence [14] are recent and partial.

**4. Metric confounding is never fully exorcised.** Fourier localization is the right probe only because we already know the answer is Fourier; for tasks with unknown generalizing circuits, thresholded metrics may again deceive.

**5. Verification does not scale.** Full reverse-engineering (Fourier-space ablations, complete weight readouts) is feasible for one-layer toy models and infeasible where delayed generalization matters most.

---

## 7 Conclusion

Grokking began as a curiosity and has become the sharpest window into how networks trade memorization for understanding. The accounts surveyed here converge: **mechanistically**, the network replaces a high-norm lookup table with a low-norm Fourier circuit in three continuous phases [2, 11]; **optimizationally**, the replacement is driven by explicit weight decay or the implicit regularization of slingshot instability [3]; **macroscopically**, the dynamics trace a phase diagram whose narrow Goldilocks zone is the only region where representation learning occurs [4]; **methodologically**, the discontinuity must be decomposed with continuous progress measures lest metric nonlinearity manufacture phase transitions [5].

The practical moral is twofold. First, *instrument progress measures* so the generalizing circuit is visible before accuracy reveals it — and exploit it: amplifying slow gradient components (Grokfast) accelerates the transition up to 50× [15]. Second, *regularization performs representation learning*, not merely overfitting prevention: the norm penalty is the selection pressure picking the structured solution from the space of interpolators.

Open questions remain — a predictive theory of the grokking timescale, mechanistic accounts for non-algorithmic tasks, probes that do not presuppose the answer — but the trajectory is clear: from a puzzling plot in 2022 to a quantitative, multi-level science of delayed generalization. The network groks because, given enough time and the right pressure, efficiency wins.

---

## References

[1] A. Power, Y. Burda, H. Edwards, I. Babuschkin, V. Misra. "Grokking: Generalization Beyond Overfitting on Small Algorithmic Datasets." arXiv:2201.02177, 2022. https://arxiv.org/abs/2201.02177

[2] N. Nanda, L. Chan, T. Lieberum, J. Smith, J. Steinhardt. "Progress Measures for Grokking via Mechanistic Interpretability." ICLR 2023; arXiv:2301.05217. https://arxiv.org/abs/2301.05217

[3] V. Thilak, E. Littwin, S. Zhai, O. Saremi, R. Paiss, J. Susskind. "The Slingshot Mechanism: An Empirical Study of Adaptive Optimizers and the Grokking Phenomenon." arXiv:2206.04817, 2022. https://arxiv.org/abs/2206.04817

[4] Z. Liu, O. Kitouni, N. Nolte, E. Michaud, M. Tegmark, M. Williams. "Towards Understanding Grokking: An Effective Theory of Representation Learning." NeurIPS 2022; arXiv:2205.10343. https://arxiv.org/abs/2205.10343

[5] R. Schaeffer, B. Miranda, S. Koyejo. "Are Emergent Abilities of Large Language Models a Mirage?" NeurIPS 2023; arXiv:2304.15004. https://arxiv.org/abs/2304.15004

[6] "Flatness is Necessary, Neural Collapse is Not: Rethinking Generalization via Grokking." arXiv:2509.17738, 2025. https://arxiv.org/abs/2509.17738

[7] J. Wei et al. "Emergent Abilities of Large Language Models." TMLR 2022; arXiv:2206.07682. https://arxiv.org/abs/2206.07682

[8] G. Davies et al. "Grokking and double descent via a shared pattern-learning model." 2023.

[9] W. Merrill et al. "A Tale of Two Circuits: Grokking as Competition of Sparse and Dense Subnetworks." 2023.

[10] "A Systematic Empirical Study of Grokking: Depth, Architecture, Activation, and Regularization." arXiv:2603.25009, 2026. https://arxiv.org/abs/2603.25009

[11] A. Gromov. "Grokking Through the Lens of Variable Creation." 2023.

[12] V. Varma et al. "Explaining Grokking Through Circuit Efficiency." 2023.

[13] "Grokking Is Conditional and Fragile: A Fully-Tractable, Multi-Seed Study at 12K Parameters." arXiv:2607.05104, 2026. https://arxiv.org/abs/2607.05104

[14] Z. Li et al. "Fourier Circuits in One-Hidden-Layer MLPs via Margin Maximization." 2025.

[15] J. Lee et al. "Grokfast: Accelerated Grokking by Amplifying Slow Gradients." arXiv:2405.20233, 2024. https://arxiv.org/abs/2405.20233

[16] Grokking reproduction notebook (scienceetonnante/grokking fork). https://github.com/abf149/grokking

