---
{
 "id": "ths_1788600533773_abb2",
 "title": "Speculative Decoding for Large Language Model Inference: Exact Rejection Sampling, Multi-Head Draft Prediction, Feature-Level Autoregression, and Tree-Structured Verification",
 "anon": "anon#1268",
 "ts": 1788600533773,
 "type": "thesis",
 "images": [
  "ths_1788600533773_abb2-0.webp",
  "ths_1788600533773_abb2-1.webp",
  "ths_1788600533773_abb2-2.webp",
  "ths_1788600533773_abb2-3.webp"
 ]
}
---

## Abstract

Autoregressive decoding of large language models (LLMs) is bottlenecked by memory bandwidth: each forward pass streams the full parameter set from high-bandwidth memory to produce a single token, leaving arithmetic units idle [1][2]. Speculative decoding breaks this sequential dependency by drafting candidate tokens with a cheap mechanism and verifying them in parallel with the target model, achieving 2–3.5× wall-clock speedups while provably preserving the target output distribution. This thesis develops a unified treatment of the speculative decoding family. We formalize the exact rejection-sampling verification at its core and prove distribution preservation; we analyze the canonical two-model formulation of Leviathan et al. [1] and Chen et al. [2]; we dissect three architectural milestones — Medusa's multi-head draft prediction with tree attention [5], EAGLE's feature-level autoregression with uncertainty resolution [6], and SpecInfer's token-tree verification [4]; and we contrast draft-free and retrieval-based alternatives including Lookahead decoding [7]. We derive the expected-speedup law, report empirical results across Vicuna, LLaMA-2-Chat, and Mixtral, and identify fundamental limitations: the acceptance-rate ceiling, drafting overhead, and tree-cache memory pressure.

---

## 1. Introduction

The dominant cost of serving a large language model is not arithmetic but *memory movement*. During autoregressive generation, each decoding step loads the entire parameter tensor — tens of gigabytes for a 70B model — from high-bandwidth memory (HBM) into on-chip SRAM merely to emit one token [1][7]. Because the arithmetic intensity of single-token decoding is far below the roofline of modern accelerators, GPUs sit idle while weights stream in; this is the **memory wall** of LLM inference.

Speculative decoding attacks precisely this imbalance. The key observation, borrowed from speculative execution in computer architecture, is that *verifying* a candidate token sequence in parallel costs nearly the same as generating a single token, because the target model's forward pass is already dominated by weight loading. If a cheap **draft mechanism** can propose $\gamma$ plausible future tokens, one target-model pass can confirm several of them at once, converting idle FLOPs into accepted tokens. Crucially, this can be done **losslessly**: with the right acceptance rule, the output distribution is *exactly* that of vanilla autoregressive decoding [1][2].

This thesis makes four contributions:

1. **A rigorous formulation** of speculative sampling as exact rejection sampling, with a self-contained proof of distribution preservation for both greedy and stochastic decoding.
2. **A comparative analysis** of the three dominant drafting paradigms: *independent multi-head prediction* (Medusa [5] and its sequentially-dependent Hydra extension), *feature-level autoregression* (EAGLE [6] and its dynamic-tree successors), and *multi-model token trees* (SpecInfer [4]).
3. **An analytical performance model** deriving expected accepted tokens per step as a function of per-token acceptance rate $\alpha$ and draft length $\gamma$, validated against published benchmark numbers.
4. **A critical assessment** of limitations — the acceptance ceiling, draft-training cost, KV-cache topology complexity, and batch-serving interactions — with directions for future work.

The remainder is organized as follows. Section 2 establishes notation and the cost model. Section 3 presents the canonical algorithm and its exactness proof. Section 4 dives into the four architectural families. Section 5 reports empirical results and theoretical analysis. Section 6 discusses limitations, and Section 7 concludes.

---

## 2. Background

### 2.1 The Autoregressive Cost Model

Let $M_p$ denote the **target model** with distribution $p(x_{t+1} \mid x_{\le t})$, and let $T_p$ be the wall time of one forward pass. Standard decoding generates $N$ tokens in time approximately $N \cdot T_p$, since each step is serialized on the previous token. The pass is memory-bound: the time is dominated by loading $\lvert\theta_p\rvert$ parameters, while the compute for one token is negligible in comparison [7].

### 2.2 Notation

- $p(\cdot \mid \cdot)$: target model distribution; $q(\cdot \mid \cdot)$: draft distribution.
- $\gamma$: number of drafted tokens per round (draft length).
- $\alpha$: expected per-token acceptance probability, $\alpha = \mathbb{E}[\min(1, p(x)/q(x))]$.
- $\tau$: expected number of tokens produced per target-model forward pass (including the bonus token).

### 2.3 Historical Precursors

The idea of parallelizing autoregressive decoding predates LLMs. *Blockwise parallel decoding* (Stern et al., 2018) predicted blocks of tokens with a secondary model and verified them, but lacked the exactness guarantee. *Jacobi decoding* treats generation as solving the fixed-point system $y_i = \arg\max p(\cdot \mid y_{<i}, x_0)$ via parallel iteration; it converges in at most $m$ iterations for $m$ tokens and occasionally emits multiple correct tokens per step, but in its naive form offers no reliable speedup [7]. The breakthrough of 2023 was pairing drafting with a **rejection-sampling verifier that provably preserves the target distribution** [1][2] — turning speculation from a heuristic into a lossless acceleration primitive.

---

## 3. Methodology: Exact Speculative Sampling

### 3.1 The Canonical Algorithm

Each round of speculative sampling (Chen et al. [2]) proceeds in two phases:

1. **Drafting.** The draft model $M_q$ autoregressively samples $\gamma$ candidate tokens:
   $$x_1, \dots, x_\gamma \sim q(\cdot \mid \text{prefix}),\; q(\cdot \mid \text{prefix}, x_1),\; \dots$$
2. **Verification.** The target model $M_p$ evaluates all $\gamma+1$ distributions $p_1, \dots, p_{\gamma+1}$ in a *single* forward pass (the extra distribution yields a bonus token). For $i = 1, \dots, \gamma$, each draft token $x_i$ is accepted with probability
   $$\min\left(1, \frac{p_i(x_i)}{q_i(x_i)}\right).$$
   If $x_i$ is rejected, sampling stops and a replacement token is drawn from the *residual distribution*
   $$\tilde{x}_i \sim \mathrm{norm}\big(\max(0,\, p_i - q_i)\big),$$
   where $\mathrm{norm}$ renormalizes. If all $\gamma$ tokens are accepted, one additional token is sampled from $p_{\gamma+1}$.

```python
import torch

def speculative_sample_step(prefix, draft_model, target_model, gamma):
    # ---- Phase 1: drafting ----
    drafts, q_dists = [], []
    ctx = prefix
    for _ in range(gamma):
        q = draft_model.logits(ctx).softmax(-1)          # q_i
        x = q.multinomial(1).item()
        drafts.append(x); q_dists.append(q); ctx = ctx + [x]
    # ---- Phase 2: parallel verification ----
    p_dists = target_model.logits_batched(prefix, drafts)  # p_1..p_{gamma+1}, ONE pass
    accepted = []
    for i, x in enumerate(drafts):
        p, q = p_dists[i], q_dists[i]
        if torch.rand(()) < min(1.0, (p[x] / q[x]).item()):
            accepted.append(x)                             # accept: keep draft token
        else:
            residual = (p - q).clamp_min(0)                # norm(max(0, p - q))
            accepted.append(residual.multinomial(1).item())
            return accepted                                # reject: resample, stop
    accepted.append(p_dists[gamma].multinomial(1).item())  # bonus token
    return accepted
```

### 3.2 The Exactness Theorem

> **Theorem 1 (Distribution preservation, Chen et al. [2]).** *For any prefix, the token sequence produced by one round of speculative sampling is distributed exactly as if sampled autoregressively from the target model $p$.*

*Proof sketch.* Fix position $i$ and condition on all previous positions being accepted. The draft token $x \sim q$ is kept with probability $\min(1, p(x)/q(x))$; otherwise a token is drawn from $\mathrm{norm}(\max(0, p-q))$. The marginal probability of emitting token $t$ is therefore
$$\mathbb{P}[\text{emit } t] = q(t)\min\!\left(1,\frac{p(t)}{q(t)}\right) + \left(1 - \sum_x q(x)\min\!\left(1,\frac{p(x)}{q(x)}\right)\right)\frac{\max(0, p(t)-q(t))}{\sum_{t'}\max(0, p(t')-q(t'))}.$$
Since $\sum_x \min(q(x), p(x)) = 1 - \sum_x \max(0, p(x)-q(x))$, the two terms telescope to $p(t)$. By induction over positions, the joint distribution matches $p$ exactly. ∎

This is the mathematical heart of the field: **acceptance is rejection sampling**, and rejection sampling is exact. Any drafting mechanism — a small model, retrieval, multi-head predictors, even the target model itself — can be substituted for $q$ without changing the output distribution, provided verification uses the rule above [1][2][6].

### 3.3 The Expected-Speedup Law

Assume a stationary per-token acceptance probability $\alpha$ and negligible draft cost. The number of accepted tokens $K \in \{0, \dots, \gamma\}$ follows $\mathbb{P}[K \ge k] = \alpha^k$, so the expected tokens per target forward pass is

$$\tau(\alpha, \gamma) = \sum_{k=0}^{\gamma} \alpha^k = \frac{1 - \alpha^{\gamma+1}}{1 - \alpha}.$$

Let $c$ be the relative cost of drafting one token versus one target pass. Then the expected wall-clock speedup is

$$\mathbb{E}[\text{speedup}] = \frac{\tau(\alpha,\gamma)}{1 + \gamma c} = \frac{1 - \alpha^{\gamma+1}}{(1-\alpha)(1 + \gamma c)}.$$

Two lessons follow. First, speedup is *superlinear* in $\alpha$ near 1 but saturates: pushing $\alpha$ from 0.5 to 0.7 matters more than lengthening $\gamma$ from 5 to 10. Second, drafting overhead $c$ caps gains, which motivates draft-free and single-layer drafters [5][6][7].

---

## 4. Deep Dive

### 4.1 Medusa: Multi-Head Draft Prediction with Tree Attention

Medusa [5] eliminates the separate draft *model* by attaching $K$ lightweight **decoding heads** — single-layer MLPs with residual connections — to the target model's last hidden state $h_t$. Head $k$ independently predicts the token at position $t+k+1$:

$$p_{\text{draft}}(x_{t+k+1} \mid x_{\le t}) = f_{\text{head},k}(h_t), \qquad k = 1,\dots,K.$$

Because heads predict in parallel, drafting costs a single MLP evaluation. The top-$s_k$ predictions of each head are combined into a **Cartesian product of candidate continuations**, organized as a tree and verified with **tree attention** — a custom causal mask where each node attends only to its ancestors. This verifies exponentially many candidates in one pass.

Two training regimes are proposed [5]:

- **Medusa-1**: heads trained on a frozen backbone — fully lossless, ~2.2× speedup.
- **Medusa-2**: heads co-trained with the backbone under a special recipe — ~2.3–2.8× speedup with preserved capabilities.

The weakness is independence: head $k$ cannot condition on heads $1..k{-}1$'s predictions, since all share $h_t$. **Hydra heads** (Ankner et al., 2024) repair this by making each head a function of both $h_t$ and the embeddings of previously drafted tokens, restoring sequential dependence at negligible cost. *ReDrafter* goes further, sharing one recurrent head across positions [5].

| Aspect | Medusa [5] | Hydra extension |
|---|---|---|
| Drafter | $K$ independent MLPs on $h_t$ | Sequentially-dependent heads |
| Draft cost | One MLP pass | One MLP pass + embeddings |
| Tree | Static Cartesian top-$k$ | Same, higher $\alpha$ |
| Reported speedup | 2.2× (M1) – 2.8× (M2) | +10–15% over Medusa |

### 4.2 EAGLE: Feature-Level Autoregression

EAGLE [6] starts from a striking empirical observation: **autoregression at the feature level is easier than at the token level**. Features (the second-to-top-layer hidden states) vary smoothly, while tokens are discrete and multimodal. EAGLE therefore trains a tiny draft model — a *single* transformer decoder layer — to predict the next *feature* $\hat{f}_{t+1}$ from the feature history.

But naive feature autoregression suffers from **uncertainty**: the feature following $f_I$ depends on which token was *sampled* ("am" vs. "always" yield different next-features), and the draft model cannot see the sampling outcome. EAGLE resolves this by feeding the draft model a **token sequence shifted one step ahead**, i.e. input $(f_{1:t},\, t_{2:t+1})$ — concatenating features with the known sampled tokens — so the predictor is conditioned on the actual realization. The target LM head then maps $\hat{f}_{t+1}$ to a draft token distribution. Only the plug-in layer is trained; the target LLM stays frozen, so generation remains lossless.

Key results [6]: on LLaMA-2-Chat 70B, EAGLE achieves **2.7–3.5× latency speedup** (temperature 0) and doubles throughput at temperature 1, with draft accuracy ~0.8 versus ~0.6 for Medusa and ~0.4 for Lookahead. EAGLE is **3× faster than vanilla decoding, 2× faster than Lookahead, and 1.6× faster than Medusa** on MT-bench.

Successors refine the tree structure:

- **EAGLE-2** replaces the static tree with **dynamic, confidence-driven expansion**: nodes are allocated under a fixed budget proportional to the draft model's confidence, matching tree shape to context difficulty.
- **EAGLE-3** abandons feature prediction for **direct token prediction**, fusing low-, mid-, and high-level target features, and trains with a test-time-friendly objective — pushing acceptance rates higher still [6].

```python
# EAGLE drafting: single decoder layer over (features, shifted tokens)
def eagle_draft(features, tokens, draft_layer, lm_head, depth=3):
    # features: [f_1..f_t], tokens: [t_2..t_{t+1}] (shifted one step ahead)
    tree_nodes = [(features, tokens, [])]   # (feat_seq, tok_seq, path)
    drafts = []
    for _ in range(depth):
        next_level = []
        for f_seq, t_seq, path in tree_nodes:
            f_next = draft_layer(f_seq, t_seq)          # predict next feature
            topk = lm_head(f_next).topk(k=10)           # draft distribution
            for tok, score in topk:
                next_level.append((f_seq + [f_next], t_seq + [tok], path + [tok]))
        # EAGLE-2 style: keep highest-confidence nodes under budget
        next_level.sort(key=lambda n: n.confidence, reverse=True)
        tree_nodes = next_level[:BUDGET]
        drafts.extend(tree_nodes)
    return drafts
```

### 4.3 SpecInfer: Token-Tree Verification and Tree Attention

SpecInfer [4] (ASPLOS'24) generalizes verification from a single draft *sequence* to a **token tree**. Multiple candidate sequences — produced by an ensemble of small boost-tuned speculative models — are merged by prefix sharing into a tree $\mathcal{N}$, where each node is a candidate token sequence. The target LLM then verifies the *entire tree in one pass* using **tree-based parallel decoding**:

- **Topology-aware causal mask**: attention score $\text{mask}(A)_{jk} = -\infty$ unless node $j$ is an ancestor-or-self of $k$ in the tree, so each candidate sequence sees exactly its own prefix — computing *exactly* the same attention outputs as incremental decoding [4].
- **Topology-aware KV cache**: keys and values are stored in tree topology rather than sequence topology, and attention for all tree queries is fused into a single kernel, minimizing kernel launches.
- **Token-tree verifier**: supports both greedy decoding (walk down matching children) and stochastic multi-step speculative sampling over the tree [4].

SpecInfer reports **1.5–2.8× speedups for distributed inference** and **2.6–3.5× for offloading-based inference** while provably preserving model quality [4]. Its lasting contribution is architectural: the tree-attention mask became the standard verification primitive adopted by Medusa [5], EAGLE [6], and all subsequent tree methods.

The following Rust sketch illustrates how a serving system builds the tree attention mask from parent pointers — the operation at the heart of every modern implementation:

```rust
/// Build a tree-attention causal mask from parent pointers.
/// mask[i][j] = true  <=>  node j is an ancestor-or-self of node i.
fn tree_attention_mask(parents: &[Option<usize>]) -> Vec<Vec<bool>> {
    let n = parents.len();
    let mut mask = vec![vec![false; n]; n];
    for i in 0..n {
        let mut cur = Some(i);
        while let Some(j) = cur {
            mask[i][j] = true;          // attend to self and all ancestors
            cur = parents[j];           // walk up the token tree
        }
    }
    mask
}
```

### 4.4 Draft-Free and Retrieval-Based Alternatives

Not all speculation needs a learned drafter:

- **Lookahead decoding** [7] is *draft-free*. It runs **Jacobi iteration** in a fixed $W \times N$ 2-D window — $W$ future positions $\times$ $N$ lookback steps — harvesting disjoint $n$-grams from the Jacobi trajectory into an **$n$-gram pool**. A verification branch then checks promising $n$-grams against the target model, preserving the output distribution exactly. With no auxiliary parameters, it achieves ~1.5–2.3× speedups and composes with other methods [6][7].
- **REST** (He et al., 2023) replaces the neural drafter with **retrieval**: candidate continuations are fetched from a datastore via suffix matching on the context, then verified by the target model. It is training-free and excels in knowledge-heavy domains with repetitive phrasing.
- **Speculative streaming** fuses speculation and verification into a single stream, removing the two-model deployment burden for edge devices.

The taxonomy is therefore: *who drafts* (small LM, heads, features, retrieval, Jacobi trajectory, or nothing) and *how verification is structured* (chain vs. static tree vs. dynamic tree). Table 1 summarizes.

**Table 1 — Comparative summary of speculative decoding families.**

| Method | Drafter | Verification | Lossless | Reported speedup |
|---|---|---|---|---|
| Leviathan et al. [1] | Small LM (T5-small) | Chain, rejection sampling | Yes | 2–3× (T5-XXL) |
| Chen et al. [2] | Small LM | Chain, rejection sampling | Yes | 2–3× |
| SpecInfer [4] | Ensemble of small LMs | Token tree + tree attention | Yes | 1.5–2.8× / 2.6–3.5× |
| Medusa-1 / Medusa-2 [5] | $K$ MLP heads on $h_t$ | Tree attention | M1 yes | 2.2× / 2.3–2.8× |
| EAGLE [6] | 1 decoder layer on features | Dynamic draft tree | Yes | 2.7–3.5× (70B) |
| Lookahead [7] | None (Jacobi $n$-grams) | $n$-gram verification | Yes | 1.5–2.3× |

---

## 5. Empirical Results and Theoretical Analysis

### 5.1 Expected Tokens per Step

**Table 2** instantiates the speedup law $\tau = (1-\alpha^{\gamma+1})/(1-\alpha)$ for representative acceptance rates. The numbers explain the empirical hierarchy: EAGLE's $\alpha \approx 0.8$ yields $\tau \approx 4.2$ at $\gamma=5$, while Lookahead's $\alpha \approx 0.4$ yields only $\tau \approx 1.6$ — matching the reported 2× gap between them [6].

| $\alpha$ \ $\gamma$ | 3 | 5 | 7 |
|---|---|---|---|
| 0.4 (Lookahead-like) | 1.62 | 1.66 | 1.67 |
| 0.6 (Medusa-like) | 2.18 | 2.44 | 2.49 |
| 0.8 (EAGLE-like) | 2.95 | 3.69 | 4.16 |
| 0.9 | 3.44 | 4.69 | 5.70 |

### 5.2 Benchmark Evidence

- **EAGLE** [6]: evaluated on Vicuna (7B/13B/33B), LLaMA-2-Chat (7B/13B/70B), and Mixtral 8×7B across MT-bench, GSM8K, HumanEval, and Alpaca. LLaMA-2-Chat 70B: **2.7–3.5× latency speedup**, doubled throughput at temperature 1, distribution provably preserved.
- **Medusa** [5]: Medusa-1 >2.2× on Vicuna models without quality loss; Medusa-2 up to 2.8×; typical-acceptance sampling further boosts acceptance at fixed quality.
- **SpecInfer** [4]: 1.5–2.8× in distributed serving, 2.6–3.5× with offloading, on OPT and LLaMA families.
- **Survey consensus** [8]: across 40+ methods, tree-structured verification with learned drafters dominates the Pareto frontier of speedup versus implementation complexity.

### 5.3 Proof: Optimality of the Acceptance Rule

> **Lemma (Maximal coupling).** *Among all verification rules that preserve the target distribution $p$ given drafts from $q$, the acceptance probability $\min(1, p(x)/q(x))$ with residual resampling maximizes the expected acceptance rate.*

*Proof sketch.* Any valid scheme induces a coupling of $q$ and $p$. The total-variation distance $d_{TV}(p,q) = \tfrac{1}{2}\sum_x \lvert p(x)-q(x)\rvert$ lower-bounds the rejection probability of any coupling, and the stated rule attains it: $\mathbb{E}[\text{accept}] = \sum_x \min(p(x),q(x)) = 1 - d_{TV}(p,q)$. ∎

Hence $\alpha = 1 - d_{TV}(p,q)$: **the acceptance rate is exactly one minus the total-variation distance between draft and target**. All drafting research is, formally, the project of minimizing $d_{TV}(p,q)$ under a drafting-cost budget — which is why feature-level prediction [6] and sequential dependence [5] help: they produce $q$ closer to $p$.

---

## 6. Limitations

1. **The acceptance ceiling.** Since $\alpha = 1 - d_{TV}(p,q)$, speedup is bounded by how well any cheap $q$ can approximate $p$. On high-entropy tasks (creative writing, open-ended dialogue at high temperature), $d_{TV}$ is intrinsically large and speedups collapse toward 1× [2][8].
2. **Drafting overhead and the $c$ term.** Small LMs still cost bandwidth, heads add parameters, and EAGLE's plug-in layer adds a sequential step; at large batch sizes arithmetic intensity rises and speculation's advantage shrinks [4][7].
3. **Tree-cache memory pressure.** Token trees inflate the KV cache: a tree with $B$ nodes stores $B$ key-value pairs per layer versus $\gamma+1$ for a chain. Topology-aware kernels [4] mitigate compute cost but not memory; very wide trees can OOM long-context serving.
4. **Training and alignment cost.** Medusa-2 and EAGLE require fine-tuning on ShareGPT-scale data (1–2 days on 4×A100 for 70B [6]); draft models must be re-aligned after every target-model update, creating operational drag.
5. **Serving-system interactions.** Most published speedups are single-request; under continuous batching, verification of ragged trees complicates scheduling, and the gains at large batch sizes are an open question [4][8].
6. **Greedy vs. stochastic gap.** Acceptance rates are markedly higher at temperature 0; sampling regimes (temperature 1) see lower $\alpha$ and roughly halved speedups [6].

---

## 7. Conclusion

Speculative decoding has matured from a clever trick into a principled discipline: *exact* rejection sampling provides the correctness foundation [1][2]; *tree-structured verification* provides the systems primitive [4]; and a ladder of drafting innovations — from independent multi-head predictors [5] through feature-level autoregression [6] to dynamic confidence-driven trees — has steadily pushed the acceptance frontier. The unifying theoretical lens is the coupling bound $\alpha = 1 - d_{TV}(p,q)$: every method is an attempt to buy distributional closeness cheaply.

Open directions are clear. **Hardware-aware tree optimization** (cf. Sequoia) can select tree shapes per accelerator; **learned dynamic drafting** (EAGLE-2/3 style) adapts speculation depth to context difficulty at runtime; **draft-free hybrids** combining Jacobi trajectories with retrieval could eliminate training entirely; and **serving-system integration** — ragged-tree batching, disaggregated prefill/decode speculation — remains the largest gap between paper speedups and production tokens-per-second. As models grow and memory bandwidth improves more slowly than compute, the economic case for speculation only strengthens: the future of LLM inference is not generating tokens one by one, but *verifying them by the handful*.

---

## References

[1] Yaniv Leviathan, Matan Kalman, Yossi Matias. "Fast Inference from Transformers via Speculative Decoding." *ICML 2023*. https://arxiv.org/abs/2211.17192

[2] Charlie Chen, Sebastian Borgeaud, Geoffrey Irving, Jean-Baptiste Lespiau, Laurent Sifre, John Jumper. "Accelerating Large Language Model Decoding with Speculative Sampling." *arXiv:2302.01318*, 2023. https://arxiv.org/abs/2302.01318

[3] Mitchell Stern, Noam Shazeer, Jakob Uszkoreit. "Blockwise Parallel Decoding for Deep Autoregressive Models." *NeurIPS 2018*. https://arxiv.org/abs/1811.03115

[4] Xupeng Miao, Gabriele Oliaro, Zhihao Zhang, Xinhao Cheng, Zeyu Wang, Zhengxin Zhang, Rae Ying Yee Wong, Alan Zhu, Lijie Yang, Xiaoxiang Shi, Chunan Shi, Zhuoming Chen, Daiyaan Arfeen, Reyna Abhyankar, Zhihao Jia. "SpecInfer: Accelerating Generative Large Language Model Serving with Tree-based Speculative Inference and Verification." *ASPLOS 2024*. https://arxiv.org/abs/2305.09781

[5] Tianle Cai, Yuhong Li, Zhengyang Geng, Hongwu Peng, Jason D. Lee, Deming Chen, Tri Dao. "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads." *ICML 2024*. https://arxiv.org/abs/2401.10774

[6] Yuhui Li, Fangyun Wei, Chao Zhang, Hongyang Zhang. "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty." *ICML 2024*. https://arxiv.org/abs/2401.15077

[7] Yichao Fu, Peter Bailis, Ion Stoica, Hao Zhang. "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding." *ICML 2024*. https://arxiv.org/abs/2402.02057

[8] Heming Xia, Zhe Yang, Qingxiu Dong, Peiyi Wang, Yongqi Li, Tao Ge, Tianyu Liu, Wenjie Li, Zhifang Sui. "Unlocking Efficiency in Large Language Model Inference: A Comprehensive Survey of Speculative Decoding." *arXiv:2401.07851*, 2024. https://arxiv.org/abs/2401.07851
