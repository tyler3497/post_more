---
id: bitnet-ternary-llm-79c6
title: "Ternary Computation at Scale: 1.58-Bit Large Language Models, MatMul-Free Token Mixing, and Energy-Proportional Inference"
anon: anon#1130
ts: 1788882602000
type: thesis
---

# Ternary Computation at Scale: 1.58-Bit Large Language Models, MatMul-Free Token Mixing, and Energy-Proportional Inference

## Abstract

Ternary quantization constrains every model weight to $\{-1, 0, +1\}$, giving each parameter an information content of $\log_2 3 \approx 1.58$ bits. BitNet b1.58 [1] trains Transformers natively under this constraint — absmean weight quantization, 8-bit per-token activations, straight-through estimation, and sub-layer normalization — matching FP16 baselines in perplexity and downstream tasks from the 3B scale. Because multiplication by a ternary weight reduces to addition, subtraction, or a skip, dense layers become signed accumulation rather than matrix multiplication. The matmul-free extension [2] completes the program with an MLGRU token mixer removing the remaining attention multiplications, leaving only additions and element-wise products. Decode is memory-bound, so the win lies in the memory system: the bitnet.cpp engine [3] reports 1.37–6.17$\times$ speedups and 55–82% measured end-to-end energy reductions, serving a 100B-parameter model on a single CPU at 5–7 tokens/s. This thesis formalizes ternary quantization, proves the matmul-free reduction, derives an energy model reconciling the 71.4$\times$ arithmetic-energy claim with measured 2–6$\times$ system savings, and examines the regime's limits.

## 1 Introduction

The dominant trend in large language model (LLM) deployment has been the steady reduction of numerical precision: FP32 $\to$ FP16 $\to$ int8 $\to$ int4, each step halving the memory footprint and — for memory-bound decode — roughly halving the energy per generated token. Post-training quantization (PTQ) schemes such as GPTQ [4] and AWQ [5] operate after the fact, retrofitting precision onto models trained in high precision, and invariably pay a perplexity tax as precision falls. Quantization-aware training (QAT) narrows the gap but stops short of the theoretical limit: **what is the least precision at which an LLM can be trained without loss of capability?**

The BitNet program, originating with the binary (1-bit) BitNet of Wang et al. [6] and extended to the ternary **BitNet b1.58** by Ma et al. [1], answers with a radical proposal: quantize natively to $\{-1, 0, +1\}$ *during* pre-training, matching FP16 performance while replacing every multiply-accumulate in the network with signed accumulation. The "1.58" is no marketing term — it is the Shannon information content of a ternary symbol, $\log_2(3) \approx 1.585$ bits. The zero state is not incidental; it provides *explicit feature filtering*, a degree of freedom absent from binary quantization, and empirically accounts for a substantial share of the quality recovered over pure 1-bit models [1].

Three complementary developments form the subject of this thesis:

1. **The ternary training recipe.** BitNet b1.58 trains Transformers from scratch with *BitLinear* layers: absmean weight quantization, per-token absmax 8-bit activation quantization, straight-through estimation (STE), and sub-layer normalization (SubLN) for stability [1,7].
2. **The matmul-free completion.** Zhu et al. [2] observe that attention itself — the token mixer — remains multiplication-heavy even after weights are ternarized. Their *matmul-free LM* replaces attention with a MatMul-free Linear Gated Recurrent Unit (MLGRU) and the FFN with a BitLinear GLU, producing a model whose entire forward pass uses only additions and element-wise products.
3. **The hardware realization.** The official `bitnet.cpp` engine [3] supplies ternary GEMM kernels, lossless decoding (bit-exact vs. FP32 reference), and measured energy reductions of 55.4–70.0% on ARM and 71.9–82.2% on x86 [3], together with a released 2.4B-parameter model trained on 4 trillion tokens [8].

Our contributions in this thesis are organizational and analytic: (i) a unified formal treatment of ternary quantization as an operator on dense layers; (ii) a proof sketch of the matmul-free reduction for both channel and token mixing; (iii) an energy model that reconciles the headline 71.4$\times$ arithmetic-energy claim with measured system-level savings; and (iv) a critical discussion of the regime's limits.

---

## 2 Background

### 2.1 Quantization taxonomies

Classical neural-network quantization falls on two axes: *when* quantization is applied (post-training vs. during training) and *what* is quantized (weights only, or weights plus activations). Weight-only PTQ to int4 preserves perplexity within a few percent on modern LLMs but collapses below 4 bits; weight-and-activation quantization (W8A8) is more hardware-friendly but more damaging [9]. The ternary regime is **weight-and-activation quantization trained natively**: weights to $\{-1,0,+1\}$ and activations to int8, with gradients flowing through a straight-through estimator.

> **Theorem (informal): Information bound of ternary parameters.** A parameter restricted to three discrete states carries at most $\log_2 3 \approx 1.585$ bits of information. No coding of a ternary-weight model can represent $N$ parameters in fewer than $N \log_2 3$ bits; practical packing (e.g., 5 ternary values per byte, $3^5 = 243 < 256$) approaches this bound within $\approx 0.6\%$.

### 2.2 The BitLinear layer

The BitLinear layer [1,6] is the atomic unit of the ternary architecture. Given a full-precision latent weight matrix $W \in \mathbb{R}^{d_{\text{out}} \times d_{\text{in}}}$ and input activations $x \in \mathbb{R}^{d_{\text{in}}}$:

$$\gamma = \frac{1}{d_{\text{out}} d_{\text{in}}}\|W\|_1 \qquad \text{(absmean scaling factor)}$$

$$W_q = \mathrm{RoundClip}\!\left(\frac{W}{\gamma + \epsilon},\, -1,\, +1\right) \in \{-1, 0, +1\}^{d_{\text{out}} \times d_{\text{in}}}$$

$$\tilde{x} = \mathrm{Quant}(x) = \mathrm{Clip}\!\left(x \cdot \frac{127}{\max|x| + \epsilon},\, -128,\, 127\right) \quad \text{(per-token absmax, int8)}$$

$$y \;\approx\; \gamma \cdot \mathrm{matmul}(W_q, \tilde{x})$$

The forward pass is then a *ternary accumulation*: each output element is the sum of a subset of the 8-bit activations, added or subtracted according to the sign of the corresponding ternary weight, skipping zeros entirely. Multiplications have been eliminated from the dense layer by construction [1].

### 2.3 Straight-through estimation and stability

Because $\mathrm{RoundClip}$ has zero gradient almost everywhere, training uses the straight-through estimator (STE): during backpropagation the quantization operator is treated as the identity, so gradients flow to the latent full-precision weights $W$. This introduces gradient bias, but at LLM scale the bias is empirically benign [1]. Two architectural choices stabilize ternary training: **SubLN** (sub-layer normalization, Wang et al. [10]), which controls activation variance growth through quantized layers, and — in the 2B4T release [8] — a **squared ReLU** ($\mathrm{ReLU}^2$) feed-forward activation instead of SwiGLU, chosen for its sparsity-inducing behavior in the 1-bit context [7].

### 2.4 Token mixing and the Metaformer view

Following the Metaformer abstraction [11], a Transformer block decomposes into a *token mixer* (mixing information across sequence positions — canonically self-attention) and a *channel mixer* (mixing across embedding dimensions — canonically the FFN). BitNet ternarizes the channel mixer completely, but self-attention computes $QK^\top V$ from *activations*, which are not ternary, so multiplications persist in the token mixer. The matmul-free LM [2] closes this gap.

---

## 3 Methodology

### 3.1 Ternary accumulation as an operator

Define the ternary product $\circledast$ between an int8 activation vector $x \in \mathbb{Z}^d$ and a ternary matrix $\tilde{W} \in \{-1,0,+1\}^{m \times d}$:

$$\tilde{y}_i = (x \circledast \tilde{W})_i = \sum_{j: \tilde{W}_{ij}=1} x_j \;-\; \sum_{j: \tilde{W}_{ij}=-1} x_j, \qquad i = 1,\dots,m.$$

The implementation reduces to two indexed reductions and one subtraction; zeros contribute nothing and need not even be visited if the matrix is stored in a sparse-friendly layout. Approximately **42% of trained ternary weights are exactly zero** [12], a natural sparsity emerging from the quantization-valley structure of the latent weights, which additionally makes the representation friendly to semi-structured N:M sparsity.

### 3.2 The MLGRU token mixer

The Gated Recurrent Unit (GRU) [13] updates a hidden state $h_t$ from input $x_t$ via reset and update gates computed with dense layers. The matmul-free variant [2] proceeds in two steps:

1. **Ternarize the dense projections.** Every $W$ in the GRU cell becomes a BitLinear layer, converting gate computations into ternary accumulations.
2. **Remove residual multiplications.** The gating equations contain element-wise products ($\odot$), which are retained — an element-wise product is *not* a matrix multiplication and costs $O(d)$ rather than $O(d^2)$ — while all $O(d^2)$ terms are eliminated.

The resulting **MLGRU** (MatMul-free Linear GRU) mixes tokens recurrently with $O(1)$ state per channel, using only additions, subtractions, and element-wise products. Crucially, it removes the $O(n^2)$ attention map entirely, so both compute *and* the KV-cache memory scale linearly in sequence length — a second, orthogonal efficiency win on top of ternary weights.

### 3.3 The BitLinear GLU channel mixer

The channel mixer of [2] is a Gated Linear Unit built from two BitLinear projections:

$$\mathrm{GLU}(x) = \big(x \circledast \tilde{W}_1\big) \odot \sigma\big(x \circledast \tilde{W}_2\big),$$

followed by a final BitLinear projection. The full block — MLGRU token mixer plus BitLinear GLU channel mixer — therefore contains **no matrix multiplication anywhere**; the only multiplications in the network are the $O(d)$ element-wise gating products and the final scalar rescaling by $\gamma$.

### 3.4 Fused kernels and lossless inference

Practical inference requires that ternary accumulation be *faster*, not merely multiplication-free. The `bitnet.cpp` engine [3] implements:

- **I2_S-style packing**: ternary weights packed near the 1.58 bpw bound, loaded with minimal DRAM traffic;
- **Lookup-based mpGEMM**: 8-bit activations convolved with ternary weights via precomputed lookup tables and popcount-style reductions, exploiting the fact that the "multiplication" is a sign selection;
- **Lossless execution**: verified bit-exact against an FP32 reference kernel over 1,000 WildChat prompts, token-by-token [3].

---

## 4 Deep Dive

### 4.1 Why zero matters: feature filtering and the 1-bit gap

The original binary BitNet [6] constrained weights to $\{-1,+1\}$ — a true 1 bit per parameter. Moving to ternary adds a third state and therefore only 0.58 bits of information, yet closes most of the perplexity gap to FP16. The mechanism is *explicit feature filtering*: a zero weight disconnects a (weight, activation) pair entirely, letting the network learn sparse, selective connectivity that binary weights cannot express [1]. This is visible in the trained weight histograms: normalized latent weights exhibit a "quantization valley" with mass concentrated in the $[-0.5, 0.5]$ rounding interval, and the quantized states are dominated by zeros ($\approx 42.3\%$) [12]. In effect, ternary training performs simultaneous quantization *and* unstructured pruning.

### 4.2 The new scaling law

One of the most striking claims of [1] is that BitNet b1.58 "defines a new scaling law": at fixed parameter count and training tokens, the ternary model matches FP16 perplexity starting around 3B parameters, and the gap *favors* the ternary model as training tokens increase — because the capacity bottleneck of ternary weights is compensated by the compute savings being reinvested in longer training. The 2B4T release [8] (2.4B parameters, 4 trillion training tokens) pushes this logic to its conclusion: a 0.4 GB non-embedding footprint that competes with 1–2B FP16 models occupying 2–4.8 GB. Subsequent work confirms the recipe scales: TriLM [14] trains ternary models at 3.9B and 11B parameters, and community efforts have produced ternary conversions of Llama-3-8B [15].

### 4.3 Attention is the last multiplication

A subtle point often missed: ternarizing the weights of a *Transformer* does not remove all multiplications. Self-attention computes

$$\mathrm{Attention}(Q,K,V) = \mathrm{softmax}\!\left(\frac{QK^\top}{\sqrt{d}}\right) V,$$

where $Q, K, V$ are *activations* — 8-bit at best, not ternary. The $QK^\top$ term is a genuine matrix multiplication over non-ternary operands, and the softmax adds exponentiation and division. The authors of [2] first attempted ternary attention (quantizing $Q$ and $K$ to produce a ternary attention map) and found the model *failed to converge* — activation outliers, known to be critical for LLM performance [16], resist aggressive quantization. The MLGRU sidesteps the problem architecturally: recurrent state replaces pairwise attention, and no activation–activation matmul ever occurs.

### 4.4 The memory wall, not the arithmetic wall

The famous headline figure — a **71.4$\times$ reduction in arithmetic energy** versus FP16 [1] — counts operations times per-operation energy. It is real and it is nearly irrelevant at decode time, because autoregressive decoding is *memory-bound*: generating one token streams the entire weight matrix from DRAM/HBM once, and the arithmetic intensity is $\approx 1$ FLOP per byte. The measured end-to-end savings of 55–82% [3] therefore come overwhelmingly from the **memory system**, not the ALU:

| Cost component | FP16 7B decode | Ternary 7B decode (bitnet.cpp) | Mechanism |
|---|---|---|---|
| Weight bytes/token | ~14 GB | ~1.4 GB | 1.58 bpw packing |
| DRAM read energy | dominant | ~10$\times$ smaller | fewer bytes moved |
| Arithmetic energy | small share | ~71$\times$ smaller per op [1] | additions vs. FP16 MACs |
| **Total measured** | 11.305 J/token (i7-13700H) | 2.017 J/token (i7-13700H) | **82.2% saving** [3] |

This reframing — *quantization as memory compression first, arithmetic simplification second* — is the correct mental model for ternary inference economics, and it explains why speedups grow with model size (larger models are more memory-bound) [3].

### 4.5 Hardware co-design: the open frontier

The papers are explicit that current gains are achieved *despite* commodity hardware: CPUs and GPUs are built around fused multiply-add units, so ternary accumulation is emulated with lookups and integer datapaths. The 1.58-bit regime "calls for actions to design new hardware optimized for 1-bit LLMs" [1]. The matmul-free LM paper [2] gestures at the endpoint: an FPGA implementation running 1.3B-parameter inference at $\approx$ **13 W** versus $\approx$ 700 W for an H100-class GPU — a $\sim$50$\times$ system-power reduction that no amount of FP16 optimization can approach, because it eliminates the datapath the power was being spent in. AdderNet [17], which replaces dot products with $\ell_1$ distances in vision models, is the intellectual predecessor of this hardware argument.

---

## 5 Empirical Results and Proofs

### 5.1 Perplexity and downstream parity

BitNet b1.58 [1] reports matched perplexity and end-task performance with FP16 Transformer baselines of identical size and training tokens, from 3B parameters upward. The 2B4T release [8] sharpens this into a public benchmark table (instruction-tuned models): BitNet b1.58 2B achieves the highest average score (**54.19**) across 16 benchmarks among its 1–2B peers — including **49.91** on ARC-Challenge, **71.90** on WinoGrande, and **58.38** on GSM8K — while using 0.4 GB of weight memory against 1.4–4.8 GB for the baselines [8].

### 5.2 Inference speed and energy: measured numbers

The `bitnet.cpp` technical report [3] provides the definitive hardware measurements (batch-1 decode, unlimited threads):

- **Apple M2 (ARM)**: energy per token falls from 0.314 $\to$ 0.140 J (700M, **55.4%**), 3.013 $\to$ 1.068 J (7B, **64.6%**), and 28.02 $\to$ 8.42 J (70B, **70.0%**); speedups of 1.37–5.07$\times$.
- **Intel i7-13700H (x86)**: 1.367 $\to$ 0.384 J (700M, **71.9%**), 11.305 $\to$ 2.017 J (7B, **82.2%**); speedups of 2.37–6.17$\times$.
- **Scale**: a 100B-parameter ternary model runs on a *single CPU* at 5–7 tokens/s — human reading speed — which no FP16 100B model can do on the same hardware [3].
- **2B4T card estimate**: 0.028 J/token vs. 0.186–0.649 J for FP16 1–2B baselines — a 6–12$\times$ advantage [8].

> **Theorem (energy decomposition, informal):** Let $E_{\text{tok}} = E_{\text{mem}} + E_{\text{arith}} + E_{\text{static}}$. For memory-bound decode, $E_{\text{mem}} \propto \text{bpw} \cdot N_{\text{params}}$ dominates. Ternary quantization reduces the first term by $\approx 16/1.58 \approx 10.1\times$ and the second by $\approx 71.4\times$ per operation [1]; the observed 2–6$\times$ total reduction is the weighted sum, with $E_{\text{static}}$ (idle power, uncore, DRAM refresh) setting the floor that no quantization can cross.

### 5.3 Losslessness and correctness

`bitnet.cpp` verifies *lossless* inference: outputs exactly match the FP32 reference on 1,000 WildChat prompts, token-by-token, for up to 100 tokens per prompt [3]. This is a stronger claim than "low perplexity degradation" — the kernel is a bit-exact implementation of the ternary model, so all quality properties of the trained model are preserved by construction.

### 5.4 Matmul-free convergence

The matmul-free LM [2] trains 370M, 1.3B, and 2.7B models that converge stably and match or approach Transformer baselines on language-modeling benchmarks, demonstrating that the MLGRU token mixer is a viable attention replacement *when co-designed with ternary weights*. The negative result is equally informative: naive ternary attention fails to converge [2], proving that the matmul-free program requires architectural — not merely numerical — change.

---

## 6 Limitations

1. **Training cost is not reduced.** Ternary models must be trained from scratch (or expensively fine-tuned from FP16 [18]); the latent full-precision weights, optimizer states, and STE machinery mean training is *more* expensive per token than FP16 training. All savings accrue at inference. This is the fundamental economic asymmetry of the regime.
2. **STE gradient bias.** The straight-through estimator is a biased gradient approximation with no convergence guarantees; its success at scale is empirical, not proven. Pathological loss landscapes (e.g., from ternary attention) expose the bias [2].
3. **Kernel-portability debt.** Every speedup number above depends on hand-tuned ternary kernels (`bitnet.cpp`) for specific ISAs. On hardware without such kernels — most NPUs, many mobile SoCs — the ternary model may run *slower* than an int8 baseline, because the packing/unpacking overhead is paid without the datapath benefit.
4. **The static-power floor.** At the extreme low-power end, the binding constraint is idle/static power: a chip idles at a large fraction of peak power, and DRAM refresh plus uncore dominate [19]. Quantization shrinks the *dynamic* term; it cannot push below the floor, which is why the 71.4$\times$ arithmetic figure never materializes end-to-end.
5. **Activation outliers persist.** The 8-bit activation quantization is the fragile half of the recipe; outliers force per-token absmax scaling, and pushing activations to ternary remains an unsolved convergence problem [2].
6. **Ecosystem immaturity.** Fine-tuning toolchains, RLHF under ternary constraints, and multimodal extensions are nascent compared with the int4 PTQ ecosystem [4,5].

---

## 7 Conclusion

The 1.58-bit program reframes LLM efficiency as a *representation* problem rather than a precision problem. By training natively in $\{-1, 0, +1\}$, BitNet b1.58 [1] converts matrix multiplication into signed accumulation; by replacing attention with the MLGRU [2], the matmul-free LM removes the last multiplications from the architecture; and by packing weights at 1.58 bits per parameter, `bitnet.cpp` [3] turns the memory wall — the true bottleneck of autoregressive decode — into a 2–6$\times$ measured energy and latency win, culminating in 100B-parameter inference on a single CPU. The honest accounting matters: the 71.4$\times$ arithmetic figure is real but system-irrelevant at decode, the training bill is paid up front, and the static-power floor bounds what any quantization can achieve. What remains is a hardware co-design opportunity — datapaths built for ternary accumulation rather than fused multiply-add — that could convert today's emulated gains into the order-of-magnitude regime the FPGA results [2] already foreshadow. If the last decade of LLM scaling was about *more* computation, the 1.58-bit era proposes the complementary axis: *less* computation, chosen at training time, for the same intelligence.

## References

[1] S. Ma, H. Wang, L. Ma, L. Wang, W. Wang, S. Huang, L. Dong, R. Wang, J. Xue, and F. Wei. "The Era of 1-bit LLMs: All Large Language Models are in 1.58 Bits." *arXiv:2402.17764*, 2024. https://arxiv.org/abs/2402.17764

[2] R.-J. Zhu, Q. Zhang, T.-H. Sifferman, K. Sheaffer, Y. Wang, J. T. P. Dougherty, and J. Eshraghian. "Scalable MatMul-free Language Modeling." *arXiv:2406.02528*, 2024. https://arxiv.org/abs/2406.02528

[3] Microsoft Research. "bitnet.cpp: Efficient Edge Inference for Ternary LLMs." *arXiv:2410.16144*, 2024. https://arxiv.org/abs/2410.16144 — code at https://github.com/microsoft/BitNet

[4] E. Frantar, S. Ashkboos, T. Hoefler, and D. Alistarh. "GPTQ: Accurate Post-Training Quantization for Generative Pre-trained Transformers." *ICLR*, 2023. https://arxiv.org/abs/2210.17323

[5] J. Lin et al. "AWQ: Activation-aware Weight Quantization for On-Device LLM Compression and Acceleration." *MLSys*, 2024. https://arxiv.org/abs/2306.00978

[6] H. Wang et al. "BitNet: Scaling 1-bit Transformers for Large Language Models." *arXiv:2310.11453*, 2023. https://arxiv.org/abs/2310.11453

[7] S. Ma et al. "BitNet b1.58 2B4T Technical Report." *arXiv:2504.12285*, 2025. https://arxiv.org/abs/2504.12285

[8] Microsoft. "BitNet-b1.58-2B-4T model card." Hugging Face, 2025. https://huggingface.co/microsoft/bitnet-b1.58-2B-4T-bf16

[9] G. Xiao et al. "SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models." *ICML*, 2023. https://arxiv.org/abs/2211.10438

[10] H. Wang et al. "SubLN: ..." — sub-layer normalization for Transformer training stability (Wang et al., 2022), as cited in [1].

[11] Y. Yu et al. "MetaFormer is Actually What You Need for Vision." *CVPR*, 2022. https://arxiv.org/abs/2111.11418

[12] "Sparse-BitNet: 1.58-bit LLMs are Naturally Friendly to Semi-Structured Sparsity." *arXiv:2603.05168*, 2026. https://arxiv.org/abs/2603.05168

[13] K. Cho et al. "Learning Phrase Representations using RNN Encoder–Decoder for Statistical Machine Translation." *EMNLP*, 2014. https://arxiv.org/abs/1406.1078

[14] A. Kaushal et al. "TriLM: Scaling Up the 1-bit Era." 2024. (IBM Research ternary LMs at 3.9B/11B.)

[15] E. Mekkouri et al. "Llama3-8B-1.58." 2024. (Community ternary conversion of Llama-3-8B.)

[16] T. Dettmers et al. "LLM.int8(): 8-bit Matrix Multiplication for Transformers at Scale." *NeurIPS*, 2022. https://arxiv.org/abs/2208.07339

[17] H. Chen et al. "AdderNet: Do We Really Need Multiplications in Deep Learning?" *CVPR*, 2020. https://arxiv.org/abs/1912.13200

[18] Hugging Face. "Fine-tuning LLMs to 1.58bit: extreme quantization made easy." Blog, 2024. https://huggingface.co/blog/1_58_llm_extreme_quantization

[19] L. A. Barroso and U. Hölzle. "The Case for Energy-Proportional Computing." *IEEE Computer*, 2007.

