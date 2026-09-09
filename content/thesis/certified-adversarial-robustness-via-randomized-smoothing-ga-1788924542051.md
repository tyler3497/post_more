---
id: ths_1788924542051_c9d3
title: "Certified Adversarial Robustness via Randomized Smoothing: Gaussian Noise Certificates, the Neyman–Pearson Tightness Theorem, and Certified Training with Noise-Augmented Distributions"
anon: anon#8052
ts: 1788924542051
tags: []
type: thesis
---
# Certified Adversarial Robustness via Randomized Smoothing: Gaussian Noise Certificates, the Neyman–Pearson Tightness Theorem, and Certified Training with Noise-Augmented Distributions

## Abstract

Randomized smoothing converts any base classifier into a *smoothed* classifier that predicts the class most likely under isotropic Gaussian noise, certifying an ℓ₂-ball around each input in which the prediction provably cannot change. This thesis develops the full theory and practice of the paradigm: from PixelDP's differential-privacy lineage to the tight certificate of Cohen, Rosenfeld, and Kolter, whose Neyman–Pearson analysis yields the optimal radius R = (σ/2)(Φ⁻¹(p_A) − Φ⁻¹(p_B)). We derive the certification machinery — Monte Carlo majority vote, abstention discipline, and exact Clopper–Pearson confidence bounds — and survey certified training regimes (Gaussian augmentation, SmoothAdv, MACER, SmoothMix, denoised smoothing) that optimize the smoothed vote rather than the base classifier. We benchmark reported certified-accuracy envelopes, compare against deterministic verifiers (IBP, CROWN), and delineate fundamental limits: the ℓ∞ curse of dimensionality, accuracy–robustness tradeoffs, and sample complexity. We close with the open frontier of adaptive, data-dependent smoothing distributions.

## 1 Introduction

Deep neural networks are spectacularly brittle. A perturbation δ with ‖δ‖_p small enough to be invisible can flip a high-capacity classifier's prediction with near-certainty — the adversarial example phenomenon. Early defenses were *empirical*: adversarial training, gradient masking, input transformations. Nearly all fell to adaptive attacks. The field therefore split into two regimes: *empirically* robust models, which resist known attack suites, and *certifiably* robust models, which carry a mathematical proof that no attack within a perturbation budget can succeed.

Certified robustness is the stronger claim and the harder engineering problem. Deterministic verifiers — interval bound propagation (IBP), CROWN, DeepPoly, branch-and-bound — propagate explicit bounds through network nonlinearities. They are rigorous but couple the certificate to the architecture, making them expensive, numerically delicate, and hard to scale to ImageNet.

**Randomized smoothing** treats the classifier as a black box. Given any base classifier f: ℝ^d → 𝒴, add noise ε ∼ 𝒩(0, σ²I) and define the smoothed classifier g as the most likely class under noise:

> **Definition 1 (Smoothed classifier).** g(x) := argmax_{c ∈ 𝒴} ℙ_{ε ∼ 𝒩(0,σ²I)}[f(x + ε) = c].

The noise scale σ trades robustness for accuracy. Because certification needs only *samples* from f, the method scales to arbitrary architectures — including pretrained ImageNet models — and produced the first nontrivial ImageNet ℓ₂ certificates [1][2].

**Outline.** §2 reviews threat models, the PixelDP lineage, and tightening analyses. §3 presents the methodology: the smoothed classifier, the tight radius theorem, and the Predict/Certify algorithms. §4 gives the technical core: the Neyman–Pearson tightness proof, certification practice, certified training regimes, and comparison with deterministic verification. §5 covers empirical results and proof sketches; §6 discusses limitations; §7 concludes.

---

## 2 Background

### 2.1 Threat models and metrics

A classifier f is *certifiably robust* at (x, y) under ℓ_p if f(x + δ) = y for all ‖δ‖_p ≤ r. The dominant threat models are the **ℓ₂ adversary** (Euclidean perturbations) and the **ℓ∞ adversary** (per-pixel bounded, "imperceptible" attacks). Gaussian smoothing natively certifies ℓ₂ balls; other noise distributions induce other geometries — Laplace for ℓ₁, uniform hypercube noise for weak ℓ∞ [1][6].

Two metrics structure evaluation:

- **Certified accuracy at radius r**: fraction of test points correctly classified *and* certified with radius ≥ r.
- **Average certified radius (ACR)**: mean certified radius over correctly classified points (misclassified count as 0). ACR is a stable single-number summary for comparing training methods [4].

### 2.2 From differential privacy: PixelDP

Noise-based certification began with Lécuyer et al.'s **PixelDP** (2019): a randomized scoring function that is (ε, δ)-differentially private in its input cannot change its expected output much under small perturbations [3]. Calibrated noise injected into network layers gave the first certifiably robust ImageNet classifier — but the DP analysis was loose: the certificate was far smaller than the model's actual robustness. Li et al. sharpened it with Rényi DP, yet a gap remained.

### 2.3 The tight Gaussian analysis

Cohen, Rosenfeld, and Kolter (ICML 2019) asked the sharp question: given *only* p_A = ℙ[f(x+ε) = c_A] and p_B = max_{c≠c_A} ℙ[f(x+ε) = c], what is the *largest* certifiable radius — over *all* base classifiers consistent with those numbers? [1]. Their Neyman–Pearson-lemma analysis gives a tight, closed-form answer:

> **Theorem (Tight ℓ₂ certificate, Cohen et al. 2019).** Let p_A ≥ p_B, p_A + p_B ≤ 1, and let g be the smoothed classifier with noise scale σ. If g(x) = c_A, then g(x + δ) = c_A for all δ with
>
> $$R = \frac{\sigma}{2}\left(\Phi^{-1}(p_A) - \Phi^{-1}(p_B)\right),$$
>
> where Φ⁻¹ is the inverse standard Gaussian CDF. This radius is *tight*: a base classifier attaining exactly these probabilities flips at radius R, so no certificate depending only on (p_A, p_B) can be larger [1].

Tightness means the analysis extracts *everything* the two probabilities imply — remaining conservatism comes from the base classifier, not the math.

### 2.4 The smoothing zoo

| Noise distribution | Certified geometry | Reference |
|---|---|---|
| Isotropic Gaussian 𝒩(0, σ²I) | ℓ₂ ball, tight radius | Cohen et al. 2019 [1] |
| Laplace | ℓ₁ ball | adapted analysis [6] |
| Uniform hypercube | ℓ∞ (weak) | early work |
| Discrete / Bernoulli | ℓ₀ / Hamming | Lee et al. 2019 [6] |
| Anisotropic Gaussian | Ellipsoidal sets | projected smoothing [6] |
| Two-distribution smoothing | Tightened ℓ₂ | Li et al. 2022 [6] |
| Top-k extension | Certified top-k, tight for Gaussian | Jia et al. 2020 [7] |

A landmark negative result: for ℓ_p with p > 2, randomized smoothing suffers a *curse of dimensionality* — certified radii shrink as O(d^{1/2 − 1/p}), rendering high-dimensional ℓ∞ certificates vacuous [6]. This is a property of the noise geometry, not of training, and motivates the separate deterministic-verification literature for ℓ∞.

---

## 3 Methodology

### 3.1 The smoothed classifier and the certificate

The methodology has three parts: (i) the smoothed classifier g; (ii) the tight radius formula; (iii) a Monte Carlo procedure estimating p_A, p_B with rigorous one-sided confidence bounds.

Since f is a deep network, true probabilities are intractable. Cohen et al. substitute bounds p_A ≤ p_A and p_B ≥ p_B holding with probability ≥ 1 − α, then plug them into the radius formula [1].

### 3.2 The Predict and Certify algorithms

**Predict** is cheap and conservative:

```python
def predict(f, x, sigma, n, alpha):
    """Return smoothed prediction, or ABSTAIN."""
    counts = sample_under_noise(f, x, sigma, n)   # n0 ~ 100 samples
    c_hat = argmax(counts)
    # one-sided binomial test: is c_hat truly the plurality class?
    if binom_test(counts[c_hat], n, 0.5, alternative='greater').pvalue > alpha:
        return "ABSTAIN"
    return c_hat
```

**Certify** spends a large budget (n ≈ 100,000) on a **Clopper–Pearson** exact one-sided lower bound for the winner's probability:

```python
def certify(f, x, sigma, n0, n, alpha):
    """Return (predicted class, certified radius) or ABSTAIN."""
    c_hat = predict(f, x, sigma, n0, alpha)
    if c_hat == "ABSTAIN":
        return "ABSTAIN", 0.0
    counts = sample_under_noise(f, x, sigma, n)
    pA_lower = clopper_pearson_lower(counts[c_hat], n, alpha)
    if pA_lower <= 0.5:
        return "ABSTAIN", 0.0
    radius = sigma * norm_ppf(pA_lower)   # conservative p_B = 1 - p_A form
    return c_hat, radius
```

Three design decisions matter:

1. **Abstention is a feature.** Certification is verification; forcing predictions on coin-flip votes would break the 1 − α guarantee. Abstention keeps it honest [1].
2. **The conservative radius form.** Estimating the runner-up p_B reliably is expensive on 1000-class ImageNet. The bound p_B ≤ 1 − p_A needs only the top-class count, trading a little radius for large statistical efficiency [1][4].
3. **n = 100,000 is the price of tightness.** The Clopper–Pearson bound converges as O(1/√n); tight ImageNet certificates cost ~10⁵ forward passes *per input* — the paradigm's central scalability bottleneck.

### 3.3 The robustness–accuracy tradeoff

The radius scales linearly in σ, but larger σ degrades the base classifier's accuracy under noise, shrinking p_A and hence Φ⁻¹(p_A). In practice σ ∈ {0.12, 0.25, 0.50, 1.00} (CIFAR-10) and {0.25, 0.50, 1.00} (ImageNet) trace the Pareto frontier; the optimal σ is task- and radius-dependent [1][2].

---

## 4 Deep Dive

### 4.1 The Neyman–Pearson machinery: why the certificate is tight

Fix x and a perturbation δ, and consider two distributions over noisy inputs: X ∼ 𝒩(x, σ²I) and Y ∼ 𝒩(x + δ, σ²I). The base classifier induces the event A = {f(X) = c_A} with ℙ(A) = p_A under X; under Y its probability is unknown. "How much can the smoothed prediction shift?" becomes "how much can a *fixed* event's probability change when the Gaussian's mean shifts by δ?"

The **Neyman–Pearson lemma** says that among all events with ℙ_X ≥ p_A, the one *minimizing* ℙ_Y is a likelihood-ratio test — here a half-space

$$S = \{z : \delta^\top (z - x) \le \beta\}, \qquad \mathbb{P}_X(S) = p_A.$$

The worst case for robustness is therefore a *linear* base classifier. Because this worst case is attainable, no analysis using only (p_A, p_B) can certify more — *tightness* [1].

For the half-space, ℙ_X(S) = Φ(β/σ) and ℙ_Y(S) = Φ((β − ‖δ‖₂)/σ). With β = σΦ⁻¹(p_A), requiring ℙ_Y(S) ≥ p_B gives

$$\Phi\!\left(\Phi^{-1}(p_A) - \frac{\|\delta\|_2}{\sigma}\right) \ge p_B
\;\Longrightarrow\;
\|\delta\|_2 \le \frac{\sigma}{2}\left(\Phi^{-1}(p_A) - \Phi^{-1}(p_B)\right),$$

i.e. the stated radius R = (σ/2)(Φ⁻¹(p_A) − Φ⁻¹(p_B)). An equivalent derivation computes the Lipschitz constant of the smoothed class-probability map (Salman et al.; Yang et al.): Gaussian convolution makes the probability vector σ⁻¹-Lipschitz, and the inverse-CDF gap converts probability margin into input-space margin [2].

> **Intuition.** Gaussian noise blurs the decision boundary into a smooth probability landscape. Neyman–Pearson shows the *sharpest* landscape consistent with the observed probabilities is a blurred half-space — with a closed-form, optimal robustness radius.

### 4.2 Certification in practice: abstention and sample complexity

Theory assumes exact probabilities; practice estimates them. Key subtleties:

1. **Two-stage testing.** Predict picks the candidate class with n₀ ≈ 100 samples; Certify spends n ≈ 10⁵ on the Clopper–Pearson bound for that class alone, with α split across stages [1].
2. **The runner-up problem.** The full formula needs an *upper* bound on p_B — statistically expensive on ImageNet. The conservative σ·Φ⁻¹(p_A) form avoids it at modest radius cost [1][4].
3. **Certificate variance.** The certified radius is a random variable of the Monte Carlo draw. With n = 100,000 and α = 0.001, estimation noise is small versus training-method differences — but certifying a full test set costs ~10⁹ forward passes, a supercomputer-scale undertaking [4].

**Top-k certification** (Jia et al. 2020) extends the tight analysis to guarantee the true label stays in the top-k within a radius — practically relevant for ImageNet top-5 evaluation [7].

### 4.3 Certified training: teaching the base classifier to be smoothable

The certificate depends on f only through p_A — its accuracy under noise. Training on clean data then smoothing is *mismatched*. Five regimes attack this directly:

- **Gaussian augmentation** (Cohen et al.): minimize 𝔼_{δ∼𝒩(0,σ²I)}[ℒ(F(x+δ), y)] — the default baseline [1].
- **Stability training** (Li et al.): regularize divergence between clean and noisy predictions [4].
- **SmoothAdv** (Salman et al. 2019): adversarial training *of the smoothed classifier*. The inner max over the hard-vote classifier is intractable, so SmoothAdv PGD-attacks the *soft-smoothed* classifier F̂ = 𝔼_δ[F(x+δ)] via Monte Carlo, then trains on those examples [4].
- **MACER** (Zhai et al. 2020): *attack-free* training. A differentiable surrogate of the certified radius, σ·Φ⁻¹(p̂_A), enters the loss directly — ℒ = ℒ_CE + λ·hinge(γ − R̂) — maximizing the radius without adversarial examples [5].
- **SmoothMix / Consistency** (Jeong & Shin 2020): calibrate smoothed confidence by mixing clean and perturbed samples and enforcing prediction consistency, widening the Φ⁻¹(p_A) − Φ⁻¹(p_B) margin [4].

Reported MNIST ACR comparisons (mean over 5 seeds [4]) show the hierarchy:

| Training method | ACR (σ=0.25) | ACR (σ=0.50) | ACR (σ=1.00) |
|---|---|---|---|
| Gaussian augmentation [1] | 0.911 | 1.558 | 1.618 |
| Stability training | 0.915 | 1.572 | 1.634 |
| MACER (attack-free) [5] | 0.920 | 1.590 | 1.595 |
| Consistency regularization | 0.928 | 1.655 | 1.738 |
| SmoothAdv | 0.932 | 1.687 | 1.779 |
| SmoothMix + one-step adversary | 0.933 | 1.693 | 1.817 |

The lesson is uniform: **the certificate is only as good as the base classifier under noise**, and objectives targeting the smoothed vote — adversarial examples (SmoothAdv), radius surrogates (MACER), confidence calibration (SmoothMix) — dominate naive augmentation.

### 4.4 Denoised smoothing: certifying pretrained classifiers

Can we certify an *off-the-shelf* pretrained classifier without retraining under noise? **Denoised smoothing** (Salman et al. 2020): prepend a learned denoiser 𝒟_θ and treat f := f_clf ∘ 𝒟_θ as the base classifier [2]. Noisy inputs are purified before the frozen classifier sees them, so ℙ[f(x+δ) = y] approaches clean accuracy whenever the denoiser performs. Certification decouples from training; diffusion-model reverse processes now serve as learned purifiers [4].

### 4.5 Randomized vs. deterministic certification

**Deterministic verifiers** (IBP, CROWN/DeepPoly, branch-and-bound) propagate *symbolic* bounds through the network, certifying the exact model rather than a noisy proxy:

| Aspect | Randomized smoothing | Deterministic (IBP/CROWN) |
|---|---|---|
| Model access | Black box (sampling) | White box (architecture + weights) |
| Threat geometry | ℓ₂ native; ℓ∞ cursed in high d | ℓ∞ native; ℓ₂ via norm inequalities |
| Scalability | ImageNet-scale, any architecture | Bound explosion in deep nets |
| Certificate cost | ~10⁵ forward passes / input | One bound propagation / input |
| Abstention | Yes (statistical) | No (exact, up to looseness) |

The families are complementary: smoothing wins on *scale and generality*, deterministic methods on *ℓ∞ geometry and exactness*. The ℓ∞ curse for Gaussian smoothing is a theorem about noise, not an engineering gap [6]. **Adaptive randomized smoothing** (2024) responds by making the smoothing distribution data- and defense-dependent, designing multi-step defenses with certified ℓ∞ balls via non-spherical noise [6].

---

## 5 Empirical Results and Proofs

### 5.1 Reported certified-accuracy envelopes

Cohen et al. (2019): **CIFAR-10**, σ = 0.25 → ≈61% certified accuracy at radius 0.5; **ImageNet**, σ = 0.25 → ≈49% certified top-1 at radius 0.5, σ = 0.50 → ≈43% at radius 1.0 — the first nontrivial ImageNet certificates [1][3]. SmoothAdv improves the envelope at every radius on both datasets; denoised smoothing brings *pretrained, non-robustly-trained* ImageNet models into the certified regime with competitive radii [2][4].

### 5.2 Proof sketch: Clopper–Pearson validity

> **Lemma (Exact one-sided coverage).** Let K ∼ Binomial(n, p) and p̲(k) := inf{p : ℙ_p(K ≥ k) > α}. Then ℙ_p(p̲(K) ≤ p) ≥ 1 − α for every p ∈ [0,1].

*Proof sketch.* The map p ↦ ℙ_p(K ≥ k) is continuous and strictly increasing (coupling argument), so p̲(k) is well-defined. Now {p̲(K) > p} ⊆ {ℙ_p(K ≥ K_obs) ≤ α}: if p̲(K_obs) > p then ℙ_p(K ≥ K_obs) ≤ α by definition of the infimum, and K ≥ K_obs is a tail event whose probability under p is at most α. ∎

Exactness — no CLT, no asymptotics — is why the 1 − α guarantee is a genuine finite-sample statement [1].

### 5.3 Proof sketch: tightness of the radius

> **Lemma (Worst-case base classifier).** Fix p_A ≥ p_B, p_A + p_B ≤ 1. Among measurable f with ℙ_{X∼𝒩(x,σ²I)}[f(X) = c_A] ≥ p_A and max_{c≠c_A} ℙ_X[f(X) = c] ≤ p_B, the minimum of ℙ_{Y∼𝒩(x+δ,σ²I)}[f(Y) = c_A] is attained by the half-space classifier f(z) = c_A ⟺ δᵀ(z − x) ≤ σΦ⁻¹(p_A).

*Proof sketch.* Neyman–Pearson for testing H₀: Z ∼ X vs. H₁: Z ∼ Y. The likelihood ratio dℙ_Y/dℙ_X(z) = exp((δᵀ(z−x) − ‖δ‖²/2)/σ²) is monotone in δᵀ(z − x); the most powerful level-(1−p_A) test rejects on a half-space, whose acceptance region minimizes ℙ_Y among sets of ℙ_X-measure ≥ p_A. Assigning c_A there saturates the constraints. ∎

Substituting the half-space probabilities and requiring ℙ_Y ≥ p_B yields the radius; attainability proves no (p_A, p_B)-based certificate can be larger — *tightness* [1].

---

## 6 Limitations

1. **Accuracy–robustness tradeoff.** Certifying large radii needs large σ, which destroys fine features; clean accuracy falls monotonically in σ. Certified training pushes the frontier outward but cannot escape it [1][4].
2. **ℓ∞ is cursed.** For p > 2, Gaussian radii decay with dimension; high-dimensional ℓ∞ certificates are vacuous. Deterministic verifiers remain the serious ℓ∞ option [6].
3. **Sample complexity.** Tight certificates need ~10⁵ samples per input; the radius itself is a Monte Carlo random variable [1].
4. **The 1 − α caveat.** With probability α the bound fails; safety-critical deployment must budget this across many inputs, which the basic procedure does not handle [1].
5. **Deployment approximations.** The certificate covers the exact smoothed classifier g; few-sample vote approximations used at serving time are not covered [4].
6. **Poisoning the guarantee.** Data poisoning can degrade the *certified radius itself* — an attack on the certificate, not just the prediction [8].
7. **Geometry mismatch.** Real corruptions (rotation, blur, weather) are not ℓ₂ balls; the certified geometry may not match the threat that matters [6].

---

## 7 Conclusion

Randomized smoothing reframes certified robustness as a question about *probability margins under noise* rather than network internals. The Cohen–Rosenfeld–Kolter tightness theorem, proved through the Neyman–Pearson lemma, shows R = (σ/2)(Φ⁻¹(p_A) − Φ⁻¹(p_B)) is the best certificate two class probabilities can ever imply — closing the analysis gap that made PixelDP's differential-privacy bounds loose. The Predict/Certify machinery with abstention and Clopper–Pearson bounds turns the theorem into a rigorous, black-box, ImageNet-scalable procedure, while certified training — SmoothAdv's smoothed adversarial examples, MACER's attack-free radius maximization, SmoothMix's confidence calibration, denoised smoothing's reuse of pretrained models — optimizes the one quantity the certificate depends on: accuracy under noise.

The frontier is now the *noise distribution itself*: adaptive and anisotropic smoothing, diffusion-based denoisers, multi-step certified defenses [6]. The deeper lesson endures: when exact verification cannot scale, *randomization plus hypothesis testing* can — and the Neyman–Pearson lemma tells us exactly how much robustness each drop of noise can buy.

---

## References

[1] J. M. Cohen, E. Rosenfeld, and J. Z. Kolter. "Certified Adversarial Robustness via Randomized Smoothing." *Proceedings of the 36th International Conference on Machine Learning* (ICML 2019), PMLR 97. arXiv:1902.02918. http://arxiv.org/pdf/1902.02918v2

[2] H. Salman, M. Sun, G. Yang, A. Kapoor, and J. Z. Kolter. "Denoised Smoothing: A Provable Defense for Pretrained Classifiers." arXiv:2003.01908, 2020. https://ar5iv.labs.arxiv.org/html/2003.01908

[3] M. Lécuyer, V. Atlidakis, R. Geambasu, D. Hsu, and S. Jana. "Certified Robustness to Adversarial Examples with Differential Privacy (PixelDP)." *IEEE Symposium on Security and Privacy* (SP 2019). (Differential-privacy-based randomized smoothing; first certified ImageNet classifier.)

[4] J. Jeong and J. Shin. "SmoothMix: Training Confidence-calibrated Smoothed Classifiers for Certified Robustness." arXiv:2111.09277, 2021. http://arxiv.org/pdf/2111.09277 (Surveys Gaussian augmentation, SmoothAdv, MACER, stability and consistency training with ACR comparisons.)

[5] R. Zhai et al. "MACER: Attack-free and Scalable Robust Training via Maximizing Certified Radius." *International Conference on Learning Representations* (ICLR 2020). arXiv:1912.09899. https://arxiv.org/pdf/1912.09899v1.pdf

[6] "Adaptive Randomized Smoothing: Certified Adversarial Robustness for Multi-Step Defences." arXiv:2406.10427, 2024. https://arxiv.org/pdf/2406.10427v3 (Adaptive, data-dependent smoothing distributions; surveys ℓ₁/ℓ₀/ℓ∞ extensions and the ℓ_p curse of dimensionality.)

[7] J. Jia, X. Cao, B. Wang, and N. Z. Gong. "Certified Robustness for Top-k Predictions against Adversarial Perturbations via Randomized Smoothing." *International Conference on Machine Learning* (ICML 2020). (Tight top-k Gaussian certificates; extends the Neyman–Pearson analysis.)

[8] "How Robust are Randomized Smoothing based Defenses to Data Poisoning?" arXiv:2012.01274. https://arxiv.org/pdf/2012.01274

[9] "Analyzing Accuracy Loss in Randomized Smoothing Defenses." arXiv:2003.01595. https://arxiv.org/pdf/2003.01595

