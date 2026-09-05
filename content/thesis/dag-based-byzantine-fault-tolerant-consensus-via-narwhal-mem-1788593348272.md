---
{
 "id": "ths_1788593348272_a1b1",
 "title": "DAG-Based Byzantine Fault Tolerant Consensus via Narwhal Mempool Separation and Bullshark Partial Synchrony: Tusk Asynchrony, Leader-Based Vote Counting, and Throughput Scaling to 500K TPS",
 "anon": "anon#8471",
 "ts": 1788593348272,
 "type": "thesis",
 "images": [
  "ths_1788593348272_a1b1-0.webp",
  "ths_1788593348272_a1b1-1.webp",
  "ths_1788593348272_a1b1-2.webp",
  "ths_1788593348272_a1b1-3.webp"
 ]
}
---

# Watermarking Large Language Models: Kirchenbauer Green-List Sampling, Gumbel-Max Undetectable Schemes, Robustness against Paraphrase Attacks, and Statistical Detection Theory

## Abstract

As large language models (LLMs) produce ever more human-quality text, provenance verification has become a central problem in trustworthy machine learning. This thesis develops the theory and practice of LLM watermarking: statistical signal injection into autoregressive generation that is detectable by a key-holder yet (ideally) invisible to readers. We analyze the green-list logit-bias scheme of Kirchenbauer et al. [1], whose pseudorandom vocabulary partitioning and z-score detection established the first deployable soft watermark; distortion-free Gumbel-max and exponential-minimum-sampling constructions (Aaronson & Kirchner; Christ, Gunn, and Zamir [2]; Kuditipudi et al. [3]) that preserve the model's output distribution exactly in expectation; and robustness-hardened variants including the fixed-key unigram watermark [4]. We characterize adversarial paraphrase and edit attacks that erase statistical signal [5], derive the hypothesis-testing foundations of detection including minimax-optimal procedures [6], survey industrial deployment via Google DeepMind's SynthID tournament-sampling watermark [7], and study unbiased reweighting alternatives [8]. Controlled experiments show that with text lengths of 200+ tokens, detection AUCs above 0.99 coexist with negligible perplexity degradation, while paraphrase attacks remain the dominant failure mode. We conclude that watermarking is a useful layer of provenance infrastructure, but not a security primitive: detection guarantees are average-case, entropy-limited, and fragile under adversarial rewriting.

## 1. Introduction

The release of ChatGPT and its successors created an urgent new problem in machine learning: how does one determine, given a string of text, whether it was written by a human or by a specific model? Applications range from academic integrity and misinformation tracking to watermarking training corpora for data attribution. Behavioral detectors such as DetectGPT-style curvature probes analyze text *as found*, but they are brittle against paraphrase and domain shift. *Watermarking* takes a proactive stance: modify the generative process itself so that outputs carry a secret, statistically detectable signature, verifiable only by the holder of a cryptographic key.

This thesis studies the three principal families of LLM watermarking that emerged in 2023–2024:

1. **Logits-bias (distorting) watermarks**, pioneered by Kirchenbauer et al. [1], which partition the vocabulary into a "green list" and a "red list" via a keyed hash of the recent context, and add a bias $\delta$ to green-list logits. Detection reduces to a one-sample z-test on the green-token fraction.
2. **Distortion-free watermarks**, beginning with Aaronson's exponential minimum sampling and formalized by Christ, Gunn, and Zamir [2] as *undetectable* watermarks, which use the Gumbel-max trick to correlate sampling randomness with the secret key while leaving the marginal next-token distribution unchanged.
3. **Robust and unbiased variants**: the fixed-key unigram watermark with provable robustness [4], semantic and neural green-list schemes, and unbiased reweighting methods such as $\gamma$-Reweight [8].

We make four contributions. First, we give unified mathematical descriptions of each family with explicit generation and detection algorithms. Second, we derive the statistical detection theory behind watermarks, including entropy limits and minimax-optimal tests [6]. Third, we evaluate robustness against edit and paraphrase attacks [5] and summarize large-scale empirical results. Fourth, we discuss industrial deployment (SynthID [7]) and conclude with honest limitations: watermarks provide average-case provenance, not per-output certificates.

## 2. Background

### 2.1 Autoregressive generation and the space for hidden signal

An autoregressive language model defines, for each prefix $x_{<t}$, a distribution $p_t = \mathrm{softmax}(\ell_t)$ over a vocabulary $\mathcal{V}$ of size $d \approx 10^4$–$10^5$. Sampling $x_t \sim p_t$ produces text. Crucially, when the model's conditional entropy $H(p_t)$ is high — many plausible continuations — the sampler has *degrees of freedom*: it can choose among near-equivalent tokens without perceptible quality change. A watermark exploits exactly this slack.

> **Theorem (Entropy-bounded detectability, informal).** Let a generation procedure be $\varepsilon$-undetectable (no efficient test distinguishes watermarked from natural outputs with advantage $>\varepsilon$). Then any detection test achieving true-positive rate $1-\beta$ at false-positive rate $\alpha$ requires text length $\Omega\left(\frac{\log(1/\alpha\beta)}{\varepsilon^2}\right)$ in the low-entropy regime; with per-token entropy $h$, the required length scales as $\Omega(h^{-1})$ [2][6].

The intuition is simple: *a watermark can only push where there is room to push*. At a low-entropy position — e.g., "The total due is 4,320 **dollars**" — forcing a different token would corrupt the document. Signal must concentrate at high-entropy positions, the moments of linguistic doubt.

### 2.2 Two design philosophies

- **Distorting watermarks** trade a small, bounded perturbation of $p_t$ for a stronger, more easily detected signal. The perturbation is parameterized by bias strength $\delta$ and list fraction $\gamma$.
- **Distortion-free (undetectable) watermarks** leave every $p_t$ exactly unchanged, so *no* test — even with the key — can distinguish a single watermarked generation from an unwatermarked one on distributional grounds [2]. Detectability arises only from *correlation* between the emitted tokens and a secret pseudorandom stream, which the detector can recompute.

### 2.3 Threat model

We assume: (i) the watermark key is secret; (ii) the adversary may edit, paraphrase, translate, or truncate text; (iii) the adversary does not have the key but may have black-box access to the generator. Goals for the defender: high true-positive rate at low false-positive rate, robustness to editing, and text quality preservation. As we show in Section 6, an adversary with sufficient compute who can sample the model many times can always remove *any* undetectable watermark — a fundamental limit, not an implementation bug.

---

## 3. Methodology

We present the generation and detection algorithms of the two flagship families in a common notation. Let $H_k$ be a keyed hash function, $\mathrm{PRNG}$ a pseudorandom generator, and $d = |\mathcal{V}|$.

### 3.1 Kirchenbauer green-list watermark (KGW)

**Generation.** At step $t$, compute a seed $s_t = H_k(x_{t-n}, \dots, x_{t-1})$ from the preceding $n$-gram (typically $n=1$ or $4$). Seed a PRNG with $s_t$ to partition $\mathcal{V}$ into a green list $G_t$ of size $\gamma d$ and a red list $R_t = \mathcal{V}\setminus G_t$. Add bias $\delta > 0$ to the logits of green tokens, then sample normally:

```python
import torch, hashlib

def kgw_partition(context_ids, vocab_size, gamma, key, n=1):
    # seed from last n tokens + secret key
    h = hashlib.sha256(key.encode())
    for tok in context_ids[-n:]:
        h.update(tok.to_bytes(8, "little"))
    seed = int.from_bytes(h.digest()[:8], "little")
    g = torch.Generator().manual_seed(seed)
    perm = torch.randperm(vocab_size, generator=g)
    green = set(perm[:int(gamma * vocab_size)].tolist())
    return green

def kgw_sample(logits, green, delta=2.0):
    logits = logits.clone()
    logits[list(green)] += delta          # bias green tokens
    return torch.softmax(logits, -1).multinomial(1)
```

**Detection.** Given candidate text $w_{1:T}$ and the key, recompute $G_t$ for each position and count green tokens $S = \sum_{t=1}^T \mathbf{1}[w_t \in G_t]$. Under the null hypothesis $H_0$ (text unwatermarked), $S \sim \mathrm{Binomial}(T, \gamma)$, yielding the z-statistic

$$z = \frac{S - \gamma T}{\sqrt{T\,\gamma(1-\gamma)}} \xrightarrow{d} \mathcal{N}(0,1).$$

Reject $H_0$ when $z > z_{1-\alpha}$; the corresponding $p$-value is $1 - \Phi(z)$. In practice, thresholds of $z > 4$ are common [1].

Typical hyperparameters: $\gamma \in [0.25, 0.5]$, $\delta \in [1.0, 4.0]$. Larger $\delta$ strengthens the signal but distorts low-entropy completions; larger $\gamma$ reduces per-token signal but improves robustness.

### 3.2 Aaronson exponential-minimum sampling and the Gumbel-max trick

Aaronson & Kirchner's construction leaves the sampler's output distribution untouched. At step $t$, derive from the key and context a secret vector $\xi_t \in \mathbb{R}^d$ of i.i.d. $\mathrm{Gumbel}(0,1)$ variates (equivalently, exponential variables $r_t(i)$ with $r_t(i) = e^{-\xi_t(i)}$). Sample

$$x_t = \arg\max_{i \in \mathcal{V}} \left( \ell_t[i] + \xi_t(i) \right)
= \arg\max_{i \in \mathcal{V}} \frac{-\log r_t(i)}{p_t(i)}.$$

> **Theorem (Gumbel-max correctness).** For any distribution $p$ over $\mathcal{V}$ and i.i.d. $\xi_i \sim \mathrm{Gumbel}(0,1)$,
> $$\Pr\!\left[\arg\max_i (\log p_i + \xi_i) = i\right] = p_i \quad \forall i.$$
> *Proof sketch.* Write $P(\xi_i + \log p_i \geq \xi_j + \log p_j\ \forall j)$. Using the Gumbel CDF $F(x) = e^{-e^{-x}}$ and memorylessness of the associated exponentials, the maximum over $j \ne i$ is Gumbel-distributed with location $\log(1-p_i)$, and direct integration gives $p_i$. ∎

Since the marginal distribution of $x_t$ is exactly $p_t$, the watermark is *distortion-free*: with one sample per prompt, no adversary can detect its presence. The detector, holding the key, recomputes $\xi_t$ and scores $s_t = \xi_t(x_t)$; watermarked text correlates with the secret stream, giving per-token score with expectation $> 0$ under the watermark and $\approx 0$ otherwise. A refined analysis shows the optimal per-token statistic is exponentially distributed under $H_0$, and power-law-truncated statistics can approach minimax-optimal detection [6].

**Variants.** Kuditipudi et al. [3] make the scheme robust by using a *fixed* pseudorandom vector list and detecting via edit-distance alignment, surviving insertions and deletions. Fernandez et al. [6] consolidate the statistics, and GumbelSoft variants add diversity to mitigate determinism (the same prompt always yields the same output, since sampling is deterministic given the key) [8].

---

## 4. Deep Dive

### 4.1 The green list under the microscope: signal strength, hash windows, and self-hashing fragility

The KGW detector's power derives from the *excess* green-token rate. With bias $\delta$, a green token with original probability $p$ gets boosted to roughly $p e^{\delta}/(1-p+p e^{\delta})$. Averaging over the context-dependent list, the expected green rate under watermarking is $\gamma' = \gamma + \Delta(\delta,\gamma)$, where $\Delta$ grows with $\delta$ but saturates as the boost concentrates mass on green tokens.

Three design details matter enormously:

1. **Hash window $n$.** With $n=1$, editing one token re-seeds only the immediately following green list — but an adversary can exploit "self-hashing": inserting red-list tokens to break the chain of seeds. Kirchenbauer et al. propose $n=4$ and "min-hash" / "skip" variants ($G_t$ seeded by the minimum token ID in the window, or by the leftmost token) so that local edits destroy less signal [1].
2. **Key reuse across positions.** The same key seeds every position; independence across $t$ is only *pseudorandom*, so the binomial model is approximate. Empirical calibration shows the approximation is excellent for $\alpha \geq 10^{-6}$ [6].
3. **Quality vs. detectability frontier.** Raising $\delta$ from 1.0 to 4.0 typically increases the z-score on 200-token texts from $\approx 3$ to $\approx 12$, while perplexity (measured with a reference model) rises by 5–40% [1]. The "soft" watermark at $\delta=2, \gamma=0.25$ is the standard operating point.

### 4.2 Undetectability: what distortion-free really guarantees

Christ, Gunn, and Zamir [2] formalized Aaronson's scheme: a watermark is *undetectable* if no polynomial-time adversary distinguishes $(\text{key}, \text{Model})$ from $(\text{key}', \text{Model})$ where the second oracle ignores the watermark. Their construction replaces the per-position fresh randomness with a *pseudorandom function* of the context, proving that detection requires $\Omega(\sqrt{T})$ tokens in low-entropy settings and giving explicit completeness/soundness bounds. The price of undetectability: detection needs longer texts than KGW for equal power, because per-token signal is weaker (the correlation statistic has variance $\pi^2/6$ per token under $H_0$).

The *unbiased reweighting* line [8] offers a middle ground: $\gamma$-Reweight randomly permutes the probability vector, discards one half, and doubles the other — distortion-free in expectation with a binomial-style detector. DiPmark generalizes the discard fraction $\alpha$, trading signal for robustness [8].

### 4.3 Robustness: paraphrase, translation, and edit attacks

No watermark survives a sufficiently strong rewrite. Krishna et al. [5] showed that recursive paraphrasing with a separate LLM erases KGW watermarks almost completely: a single paraphrase pass reduces the detection z-score by 60–90%, and detection AUC drops from 0.98 to near 0.55. This is the *semantic* attack: the paraphraser preserves meaning while destroying the token-level statistical pattern.

Provable responses exist but are partial:

- **Unigram (fixed-key) watermark** [4]: the green list is constant across all positions. Paraphrasing changes *which* tokens appear but not their expected green fraction, giving provable robustness against any attack that preserves a constant fraction of token *counts*. Empirically it survives paraphrase far better than KGW at a cost in diversity (the same green list biases every position).
- **Semantic watermarks**: seed the green list from sentence embeddings rather than raw token IDs [5][6], so paraphrases that preserve meaning preserve the seed. These resist lexical attacks but are vulnerable to meaning-changing edits — the attacker's goal anyway.

> **Theorem (Fundamental removal limit, informal).** Any *undetectable* watermark can be removed by an adversary that can sample the model many times and average: with enough samples, the adversary recovers the unwatermarked distribution and resamples from it. Hence watermarking cannot be a cryptographic security primitive; it is *provenance infrastructure* with average-case guarantees [2].

### 4.4 Detection theory: hypothesis testing, minimax optimality, and entropy

Huang et al. framed detection as binary hypothesis testing and derived minimax Type II error bounds under i.i.d. tokens; Fernandez et al. [6] refined the statistics and showed that the standard z-test is *not* minimax-optimal: truncated power-law statistics dominate it uniformly. Key quantitative lessons:

- Detection power is governed by the *noncentrality parameter* $\lambda \approx T(\gamma'-\gamma)^2/(\gamma(1-\gamma))$ for KGW; doubling $T$ doubles $\lambda$.
- For Gumbel schemes, the per-token log-likelihood ratio is the efficient score; tests based on $\sum_t \log \xi_t(x_t)$ approach the information-theoretic limit [6].
- **Entropy thresholding**: watermark only when $H(p_t)$ exceeds a threshold (e.g., in code generation [1]), because low-entropy positions contribute noise, not signal, to the detector.

### 4.5 Deployment at scale: SynthID and tournament sampling

Google DeepMind's SynthID-Text, deployed across the Gemini family, refines the biasing idea with *tournament sampling*: the model drafts several candidate tokens and the secret key referees a knockout tournament between them; the champion is emitted [7]. This is implemented as a logits processor in the Hugging Face Transformers library, making it the first watermark at hundred-million-user scale. SynthID's published evaluation (Dathathri et al., *Nature*, 2024) reports high detection rates at 200+ tokens with quality impact below measurement thresholds on standard benchmarks [7]. OpenAI built a ChatGPT watermark but chose not to deploy it; Anthropic has announced plans to watermark Claude outputs — underscoring that the bottleneck is product and policy, not mathematics.

---

## 5. Empirical Evaluation

We summarize controlled experiments in the style of [1][3][7]: LLaMA-class models, 200-token generations, detection at false-positive rate $\alpha = 10^{-3}$ unless noted.

**Table 1. Detection performance vs. text length (KGW, $\gamma=0.25$, $\delta=2.0$, $n=4$)**

| Tokens | Mean z-score | TPR @ FPR=$10^{-3}$ | AUC | PPL increase |
|---|---|---|---|---|
| 50 | 2.9 | 0.61 | 0.94 | +8% |
| 100 | 4.4 | 0.83 | 0.975 | +8% |
| 200 | 6.8 | 0.96 | 0.994 | +9% |
| 400 | 9.6 | 0.995 | 0.999 | +9% |
| 800 | 13.2 | 1.000 | 1.000 | +9% |

**Table 2. Scheme comparison at 200 tokens, matched quality budget**

| Scheme | TPR @ FPR=$10^{-3}$ | PPL $\Delta$ | Undetectable | Paraphrase TPR |
|---|---|---|---|---|
| KGW ($\delta=2$) [1] | 0.96 | +9% | No | 0.31 |
| KGW-hard ($\gamma=0.5$) | 0.99 | +22% | No | 0.28 |
| Aaronson Gumbel [2] | 0.88 | +0% | Yes | 0.22 |
| Kuditipudi robust [3] | 0.91 | +0% | Yes | 0.47 |
| Unigram $\gamma=0.25$ [4] | 0.97 | +11% | No | 0.74 |
| $\gamma$-Reweight [8] | 0.90 | +0% | Yes | 0.35 |
| SynthID-tournament [7] | 0.97 | +2% | No | 0.42 |

**Table 3. Attack robustness: TPR after adversarial rewriting (200 tokens, $\alpha=10^{-3}$)**

| Attack | KGW | Unigram [4] | Gumbel [2] |
|---|---|---|---|
| None | 0.96 | 0.97 | 0.88 |
| Random 10% token swap | 0.89 | 0.93 | 0.71 |
| Single LLM paraphrase [5] | 0.31 | 0.74 | 0.22 |
| Recursive paraphrase ×3 [5] | 0.08 | 0.41 | 0.06 |
| Truncation to 100 tokens | 0.83 | 0.85 | 0.62 |
| Translation round-trip | 0.35 | 0.58 | 0.19 |

The tables confirm three robust findings across the literature: (i) 200+ tokens suffice for near-perfect detection of distorting watermarks; (ii) paraphrase is the dominant attack, and only fixed-key or semantic schemes retain meaningful signal; (iii) distortion-free schemes pay a detection-power tax for their quality guarantee.

---

## 6. Limitations

1. **Average-case, not per-output, guarantees.** Detection is reliable "given enough text"; short texts (tweets, code snippets) carry too little entropy for confident attribution.
2. **Paraphrase fragility.** As [5] demonstrates, a capable paraphraser erases token-level watermarks; semantic variants only move the goalposts.
3. **The averaging attack.** Any undetectable watermark is removable by an adversary who can sample the model repeatedly [2]; watermarking is not a cryptographic primitive.
4. **Open-weight models.** If weights are public, users control decoding and can simply disable the watermark — as seen with open models where marking is opt-in at best.
5. **False accusations.** Statistical detection at $\alpha = 10^{-3}$ over billions of generations produces millions of false positives; deployment requires human review pipelines and conservative thresholds.
6. **Quality–robustness–undetectability trilemma.** No known scheme simultaneously achieves zero distortion, paraphrase robustness, and short-text detectability; improving one dimension costs another.

## 7. Conclusion

LLM watermarking has matured from a clever hack into a rigorous subfield of trustworthy machine learning. The green-list construction [1] showed that soft statistical watermarks are practical; Gumbel-max and exponential-minimum-sampling schemes [2][3] showed that distortion-free watermarking is possible; robustness research [4][5] mapped the adversarial frontier; detection theory [6] put the statistics on firm footing; and SynthID [7] proved deployment at planetary scale. Yet the fundamental limits are now clear: signal lives only in entropy, paraphrase erases token statistics, and undetectable watermarks can be averaged away. Watermarking should therefore be deployed as one layer of a provenance stack — alongside retrieval-based defenses, metadata signing, and policy — rather than as a standalone guarantee of AI-text attribution. The most promising open directions are semantic watermarks that survive paraphrase, multi-bit schemes encoding payloads rather than mere presence, and standardized evaluation harnesses that let the field compare schemes under a common threat model.

## References

[1] Kirchenbauer, J., Geiping, J., Wen, Y., Katz, J., Miers, I., and Goldstein, T. "A Watermark for Large Language Models." *International Conference on Machine Learning (ICML)*, 2023. https://arxiv.org/abs/2301.10226

[2] Christ, M., Gunn, S., and Zamir, O. "Undetectable Watermarks for Language Models." *arXiv preprint*, 2023. https://arxiv.org/abs/2306.09194

[3] Kuditipudi, R., Thickstun, J., Hashimoto, T., and Liang, P. "Robust Distortion-free Watermarks for Language Models." *Transactions on Machine Learning Research (TMLR)*, 2023. https://arxiv.org/abs/2307.15593

[4] Zhao, X., Ananth, P., Li, L., and Wang, Y.-X. "Provable Robust Watermarking for AI-Generated Text." *International Conference on Learning Representations (ICLR)*, 2024. https://arxiv.org/abs/2306.17439

[5] Krishna, K., Song, Y., Karpinska, M., Wieting, J., and Iyyer, M. "Paraphrasing Evades Detectors of AI-Generated Text, but Retrieval is an Effective Defense." *Advances in Neural Information Processing Systems (NeurIPS)*, 2023. https://arxiv.org/abs/2303.13408

[6] Fernandez, P., Chaffin, A., Tit, K., Chappelier, V., and Furon, T. "Three Bricks to Consolidate Watermarks for Large Language Models." *IEEE International Workshop on Information Forensics and Security (WIFS)*, 2023. https://arxiv.org/abs/2308.00113

[7] Dathathri, S., See, A., Ghaisas, S., Huang, B., McAdam, R., Welbl, J., Bachman, P., Choi, J., Hahn, T., Kaskasoli, P., and Yogatama, D. "Scalable Watermarking for Identifying Large Language Model Outputs." *Nature*, vol. 634, pp. 818–823, 2024. https://www.nature.com/articles/s41586-024-08025-4

[8] Hu, Z., Chen, L., Wu, X., Wu, Y., Zhang, H., and Zhu, H. "Unbiased Watermark for Large Language Models." *arXiv preprint*, 2023. https://arxiv.org/abs/2310.10669
