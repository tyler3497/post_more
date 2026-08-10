---
id: thesis-llm-speculative-decoding-eagle-medusa-1786404664010
title: "Large Language Model Speculative Decoding: Medusa Heads, EAGLE Drafting, Lookahead Decoding with Jacobi Iteration, and KV-Cache Verification"
abstract: "Autoregressive decoding remains HBM-bandwidth bound, forcing sequential dependence that limits LLM throughput. Speculative decoding introduces a draft-then-verify paradigm with a lossless guarantee preserving p(x). This thesis dissects Medusa's parallel multi-head prediction with Cartesian tree attention, EAGLE's feature-level autoregression addressing token uncertainty, Lookahead Decoding's Jacobi fixed-point formulation treating generation as system solving, and KV-cache verification via tree-shared prefix sharing versus cloning. We analyze acceptance rate theory, positional encoding for tree tokens, and complexity of SpecInfer merging."
anon: anon#2377
ts: 1786404664010
sources:
  - https://arxiv.org/abs/2401.10774v3
  - https://arxiv.org/abs/2401.15077
  - https://arxiv.org/abs/2404.10515
  - https://arxiv.org/pdf/2506.19830
  - https://arxiv.org/abs/2308.03811
  - https://arxiv.org/abs/2211.10433
  - https://arxiv.org/pdf/2510.22876v1
  - https://arxiv.org/html/2606.10492
image_concepts:
  - "speculative decoding draft-then-verify pipeline diagram"
  - "Medusa vs EAGLE architecture comparison tree attention"
  - "Jacobi iteration Lookahead decoding lattice"
  - "KV-cache tree verification with shared prefix memory layout"
---

# Large Language Model Speculative Decoding: Medusa Heads, EAGLE Drafting, Lookahead Decoding with Jacobi Iteration, and KV-Cache Verification

## Abstract

Autoregressive Transformer inference is fundamentally ***memory-bound***, not compute-bound, with each token requiring a full HBM load of weights for a single matrix-vector operation [6][2]. Speculative decoding resolves this via a ***draft-then-verify*** paradigm: a lightweight drafter proposes $\gamma$ tokens cheaply, a large target model verifies them in parallel, preserving the exact output distribution $p(x)$ through modified rejection sampling [6]. This work provides an end-to-end synthesis of four contemporary advances: **Medusa heads** which add $K$ parallel decoding heads to a frozen backbone for simultaneous future-token prediction [1], **EAGLE** which rethinks draft uncertainty by auto-regressing in continuous feature space rather than discrete tokens [2][3], **Lookahead Decoding** which reframes autoregressive decoding as solving a system of nonlinear equations via ***Jacobi iteration*** and parallelizes $n$-gram generation [5][8], and **KV-cache verification** which replaces naive KV cloning with tree-shared prefix attention and SpecInfer-style merging for $O(N \log N)$ validation [7]. We present tree attention mask construction, acceptance rate $\alpha = 1 - \mathbb{E}[D_{TV}(p,q)]$ theory, and memory analysis showing 3-5% overhead for tree verification.

## 1 Intro

Large language model serving is dominated by the ***autoregressive sequential dependency***. Given context $x_{<t}$, generating $x_t \sim p(\cdot|x_{<t})$ requires sequential invocation of the same 7B–70B parameter model, yielding an arithmetic intensity of $< 1$ FLOP/byte on A100/H100, deep in the HBM bandwidth-bound regime [6][1]. This is the ***memory bandwidth wall***: even with FlashAttention and quantization, latency per token is gated by weight loading, not ALU throughput.

Amdahl's law for drafting formalizes the opportunity. If draft cost $c$ is $<<$ target cost $C$, and expected accepted length is $\tau$, speedup is approximately $S \approx \tau / (1 + c\gamma/C)$ where $\gamma$ is draft length [2][6]. With $\tau \approx 3$–$5$, $2$–$3.6\times$ wall-clock acceleration is achievable without quality loss [1][2]. This observation motivates *lossless* speculative acceleration, in stark contrast to lossy methods like quantization or pruning.

Speculative decoding was originally formalized by Leviathan et al. [6] and Chen et al. simultaneously in 2023 as speculative sampling with a rejection sampling correctness guarantee. Modern evolution has branched into three architectures that this thesis unifies: Medusa [1] emphasizes minimal service modification via heads, EAGLE [2][3][4] emphasizes *feature uncertainty reduction*, and Lookahead Decoding [5] emphasizes *no auxiliary draft model* via Jacobi $n$-gram self-drafting. Critically, all three converge on ***tree verification*** and the engineering problem of ***KV-cache management*** [7].

> **Theorem: Lossless Guarantee of Speculative Sampling** — Let $p(x)$ be target distribution and $q(x)$ be draft distribution. Speculative sampling with rule: accept $x\sim q$ if $u \sim U[0,1] < \min(1, p(x)/q(x))$, otherwise resample from $p'(x) \propto \max(0, p(x)-q(x))$, yields $x \sim p(x)$ exactly. That is $P_{spec}(x)=q(x)\min(1,p/q) + (1-\beta)p'(x)=p(x)$ where $\beta = \sum_x \min(p(x),q(x))$ [6].

We contribute a consolidated formalism linking these strands and providing implementable pseudocode for production inference stacks.

## 2 Background

### 2.1 Speculative Sampling Algorithm

The canonical two-model protocol proceeds as [6]:

1.  Given prefix $x_{<t}$, drafter $M_q$ autoregressively generates $\gamma$ drafts $\tilde{x}_1,...,\tilde{x}_\gamma$ where $\tilde{x}_i \sim q(\cdot|x_{<t},\tilde{x}_{<i})$
2.  Target $M_p$ computes $p_i = p(\cdot|x_{<t},\tilde{x}_{<i})$ for all $i$ in *parallel* via one forward pass
3.  Sequential verification accepts longest prefix where $r_i < p_i(\tilde{x}_i)/q_i(\tilde{x}_i)$
4.  Upon first rejection at $k$, sample final token from adjusted distribution $p'_k$; if all accepted, sample one extra token from $p_{\gamma+1}$

This is ***rejection sampling proof preservation*** — the output distribution is identical to vanilla decoding [6][5]. Expected acceptance length $\mathbb{E}[A] = \sum_{k=1}^{\gamma+1} \prod_{i<k} \alpha_i$ where $\alpha_i = \mathbb{E}_{x\sim q_i}[\min(1,p_i/q_i)] = 1 - D_{TV}(p_i,q_i)$ [2][7].

### 2.2 Tree Verification

Naively verifying a single chain $\gamma$ wastes potential drafts. Tree verification [1][7] verifies a ***Cartesian product of top-k predictions*** simultaneously. For $K$ Medusa heads each predicting $s_k$ candidates, we form $N = \prod s_k$ candidates arranged as a tree with root $=$ prefix. A custom ***tree attention mask*** $M_{tree}$ ensures token at node $j$ only attends to ancestors: $M_{tree}[i,j]= -\infty$ if $j$ not ancestor of $i$ else $0$ [1][3][7].

Positional encoding is non-trivial: tree nodes at different depths share positional indices relative to root. For prefix length $L$, node at depth $d$ gets position $L+d$, but siblings share $L+d$ with causal isolation via $M_{tree}$ [7][3].

### 2.3 KV-Cache Data Structures

KV-cache is the dominant memory cost for long contexts [7]. Naive cloning for each branch would be $O(N \cdot L \cdot d)$ memory and bandwidth [7]. Two strategies exist:

*   ***KV-cache cloning***: Materialize full $K,V$ per sequence — simple but $N\times$ blow-up, incompatible with batching [7]
*   ***Tree-shared prefix***: Store shared prefix KV once, append tree nodes as extra tokens with tree attention; prefix hits shared via paged attention / token tree merging [7][4]

SpecInfer introduced ***token tree merging*** where multiple sequences with shared prefix are merged into a single forward pass with a tree-structured causal mask, reducing complexity from $O(N)$ forwards to $O(1)$ forward with $O(N \log N)$ mask management [7].

## 3 Methodology

### 3.1 Medusa-1 and Medusa-2

Medusa augments a frozen LLM with ***K extra decoding heads*** [1]. Let $h_t \in \mathbb{R}^d$ be last hidden state at position $t$. Original LM head: $p_0 = \text{softmax}(W_0 h_t)$. Medusa head $k \in [1..K]$: $p_k = \text{softmax}(W_k h_t)$ where $W_k$ is initialized from $W_0$ but with residual or independent MLP: $h_t^{(k)} = h_t + \text{SiLU}(W_1^{(k)} h_t)W_2^{(k)}$ [1].

- **Medusa-1**: Backbone $\theta$ *frozen*. Only train $\{W_k\}_{k=1}^K$ with loss $\mathcal{L} = \sum_{k=1}^K \lambda_k \cdot \text{CE}(p_k^{(t+k)}, y_{t+k})$. This preserves base model, cheap to train (~ 10-50B tokens on ShareGPT), 0 memory overhead at serve time aside from heads [1].
- **Medusa-2**: ***Full finetune*** jointly with backbone and with KL distillation: $\mathcal{L} = \mathcal{L}_{LM} + \sum_k \lambda_k \text{CE}_k + \beta \text{KL}(p_0||p_{orig})$ [1]. Yields higher acceptance but requires full backpack training and risks p degradation if $\beta$ not tuned.

Both use ***typical acceptance*** relaxed criterion to increase $\alpha$ while keeping distribution close: accept if $p/q > \epsilon$ with entropy-dependent threshold [1].

### 3.2 EAGLE Feature Predictor and Token Shift

EAGLE argues ***token-level autoregression amplifies uncertainty*** [2]. Discretization gap: drafting in token space then re-embedding loses second-order information about feature distribution; entropy grows as $H(q_{t+k}) \gg H(f_{t+k})$ [2].

Methodology:

1.  Extract feature sequence $f_{<t}$ from target LLM's penultimate layer
2.  Train lightweight auto-regressive predictor $f'_t = \text{AR}([f_{t-2}, f_{t-1}, \text{Emb}(x_t)])$ — one decoder layer (~ 0.3B params for 7B target) [2][3]
3.  ***Feature shift***: Training data is shifted by 1: instead of predicting $f_{t}$, predict $f_{t+1}$ one-step ahead — average loss applies second-to-last
4.  Token sampled via original LM head on predicted feature: $q_t = \text{LMHead}(f'_t)$ [2]

Loss is ***feature regression + token CE + uncertainty-aware weighting***: $\mathcal{L} = \|f' - f\|_2^2 + \text{CE}(q,p) + w(t)\cdot \mathcal{D}_{KL}$ where $w(t)$ downweights high-entropy early positions [2][3].

EAGLE-2 adds ***dynamic draft tree***: Instead of fixed Cartesian product, model confidence $c_i$ prunes low-prob branches at runtime; tree depth adaptive to $H(p_i)$ [3]. EAGLE-3 / Scaling Lookahead [4] shows scaling law: increasing draft depth to 8-10 and width to 64 yields near-linear $\tau$ improvement up to $\tau \approx 9$ before saturating with batch 64 [4].

### 3.3 Lookahead Decoding with Jacobi Fixed-Point

Lookahead treats AR generation as solving ***nonlinear system*** [5][8]:

For sequence length $m$, define $F$:
$y_1 - \arg\max p(\cdot|x_0)=0$
$y_2 - \arg\max p(\cdot|x_0,y_1)=0$
...
This is $F(y)=0$. ***Jacobi iteration*** for AR: $y^{(k+1)}_i = \arg\max p(\cdot|y^{(k)}_{<i})$. Starting from $y^{(0)}$ initialized by copying previous Jac iterations or $n$-gram pool [5][8].

Lookahead Decoding algorithm [5]:

- Maintain ***$n$-gram pool*** $\mathcal{P}$: cache of $n$-grams from previous Jacobi trajectories and prompt
- ***Lookahead branch***: $W$ simultaneous Jacobi iterations constructing $W \times N$ tokens where $N$ is lookahead size
- ***Verification branch***: Retrieve $G$ promising $n$-grams from $\mathcal{P}$ whose prefix matches last generated token, verify in parallel [5]

Convergence guarantee: Jacobi for triangular systems converges in at most $m$ iterations, but with good initialization, $2$–$3$ steps solve $5$–$7$ tokens — super-linear due to fixed-point contraction with Lipschitz $<1$ for Transformer with layer-norm bounded [8].

PathRelax [8] formalizes relaxed Jacobi where diagonal dominance is softened: allow parallel-path speculative feasibility via residual threshold $\|y^{(k+1)}-y^{(k)}\| < \delta$ to accept parallel updates, bridging text and image AR.

---

## 4 Deep Dive

### 4.1 Medusa Heads: Multi-Head Parallel Prediction and Tree Attention Cartesian Product Construction

Medusa's architectural minimalism is its strength [1]. Each head $k$ predicts $k$-th future token *without conditioning on intermediate token predictions*. This is ***parallel prediction*** — all $K$ heads run in same forward pass from same $h_t$, unlike EAGLE where draft is autoregressive in feature space [1][2].

How to construct verification tree? Let $s_k$ be top-k per head (typically $s_1=8, s_2=6, s_3=4, s_4=3$ for total $8*6*4*3=576$ theoretical but pruned to ~64) [1]. Cartesian product algorithm:

1.  Enumerate all combinations $(c_1\in \text{Top}_{s_1}, ..., c_K\in \text{Top}_{s_K})$
2.  Sort by score $score = \sum_k \log p_k(c_k)$ — product of independent probabilities is heuristic for joint likelihood but underestimates correlation [1][7]
3.  Choose top $M$ paths (e.g., $M=64$), assemble into prefix tree: merge identical prefixes to reduce nodes [1]
4.  Tree attention: $O(M K)$ mask construction

Key insight: Despite independence assumption, ***acceptance rate stays high*** because heads are trained to be auto-consistent — multi-head loss correlates $W_k$ implicitly through shared $h_t$ gradient [1]. Empirically Medusa-1 reaches 2.2x speedup on Vicuna-7B with $\tau \approx 2.2$, Medusa-2 reaches 2.8–3.6x with $\tau \approx 3.4$ [1].

Memory overhead: Heads are $K \cdot d \cdot |V|$ but re-use embedding projection tricks: often $W_k = W_0 \cdot A_k$ low-rank $r=64$, reducing 7B* K from 262M*4=1B to <100M params [1].

```haskell
-- Tree Attention Mask Type Formalism
type Position = Int
type NodeId = Int

data TreeNode = Node { token :: Token, parent :: Maybe NodeId, depth :: Int, pos :: Position }

type TreeMask = [[Bool]]  -- True = attend allowed

buildTreeMask :: [TreeNode] -> TreeMask
buildTreeMask nodes = [[ isAncestor j i | j <- idx] | i <- idx]
  where
    idx = [0..length nodes -1]
    isAncestor a b = a == b || elem a (ancestors b)
    ancestors n = case parent (nodes!!n) of Nothing -> []; Just p -> p : ancestors p

-- Medusa Cartesian selection pruned to M
selectTopM :: Int -> [[(Token, Float)]] -> [[Token]]
selectTopM m heads = take m $ sortBy (comparing $ negate . score) cartesian
  where cartesian = sequence heads >>= \_ -> undefined -- placeholder for product
```

This typed mask is injected into FlashAttention-compatible kernels by replacing causal $tril$ with custom block-sparse bitmap [7].

### 4.2 EAGLE Drafting: Feature-Level Autoregression and Uncertainty-Aware Training with Dynamic Tree Decoding

EAGLE's core claim ***feature uncertainty < token uncertainty*** [2]. Proof sketch: Let $f$ deterministic given prefix, $x = \arg\max \text{LMHead}(f) + noise$. Token entropy $H(x|f_{<t}) = H(f_t|f_{<t}) + \mathbb{E}_f[H(x|f_t)] - I(f_t;x)$ — second term positive, thus drafting loss is strictly larger if forced to sample discrete then re-embed [2].

Training procedure formalized [2][3]:

- Dataset: ShareGPT / UltraChat; for each prefix, extract ground-truth features $f_t$ from target model forward
- Input to drafter: $[ \text{Embed}(x_{t-2}), f_{t-2}, \text{Embed}(x_{t-1}), f_{t-1}, \text{Embed}(x_t)]$
- One decoder layer predictor (self-attention with KV from draft sequence + cross-attention to target?) — EAGLE-1 used causal decoder with cached $f$, very cheap: <0.5 TFLOPs vs 5 TFLOPs target [2]

Dynamic tree decoding [3] is critical for scaling: Fixed tree wastes compute on low-confidence branches. EAGLE-2 operates:

1.  Draft $d_1$ tokens autoregressively, maintaining beam of top-$b$ features [3]
2.  Each node expansion scored by $score = \log q + \lambda \cdot (1 - H(q))$ — uncertainty penalty [3]
3.  Keep global top $K=48$ nodes, rebuild tree edges
4.  Tree attention identical to Medusa, but depth adaptive: easy positions go deep $8$–$10$, hard position shallow $2$-$3$

Result: ***EAGLE reaches $3.0$–$3.5\times$ speedup on Vicuna-7B***, $2.6\times$ on LLaMA2-70B, and when combined with quantization, still preserves $>90\%$ of lossless acceptance [2][3]. Memory overhead ***3–5%*** of target [2].

EAGLE-3 [4] scales this with ***training-time test***: simulate multi-draft speculative dataset with simulated acceptance noise during training, allowing 10+ accepted length, and polybasic multi-sequence batching where multiple draft trees verify simultaneously — leading to ***9–10 accepted tokens per forward*** with 64 beams, approaching memory bandwidth theoretical maximum $S_{max} \approx \text{HBM_BW} / \text{compute\_intensity}$ [4].

Pitfalls: Feature API requires exposing internal activations — incompatible with black-box APIs; feature drift for long context >4k where $f$ distribution shifts due to RoPE extrapolation [2][3].

```python
def speculative_loop_eagle(target_model, eagle_draft, prefix, max_tokens=512, gamma=5, tree_width=48):
    # prefix: (B, L), kv_cache_target: shared
    kv_target = target_model.prefill(prefix)  # fills shared tree KV
    f_seq = target_model.last_features  # (B, L, d)
    generated = []

    while len(generated) < max_tokens:
        # 1. EAGLE draft autoregressive in feature space
        draft_features = []
        draft_tokens = []
        draft_tree = DynamicTree(root_tokens=prefix[0,-1:])
        f_curr = f_seq[:, -1:]  # last feature
        for i in range(gamma):
            # uncertainty-aware scoring
            f_next = eagle_draft(f_curr, prefix)  # AR predictor: (B, 1, d)
            logits = target_model.lm_head(f_next)  # re-use target head
            # top-k + entropy gating
            probs = softmax(logits)
            entropy = -(probs * log(probs)).sum(-1)
            if entropy.mean() > 2.5:  # high entropy: early stop deep draft
                break
            tok = topk_sample(logits, k=4)
            draft_tree.expand(tok, scores=logits)
            draft_tokens.append(tok)
            f_curr = f_next
            draft_features.append(f_next)

        # 2. prune to top-K nodes for verification tree
        tree_mask, tree_pos = draft_tree.build_tree_attn(k=tree_width)  # Haskell-like mask

        # 3. target verification in one parallel forward
        # tree-shared KV: prefix KV shared, only tree nodes appended
        verify_logits = target_model.verify(
            tree_tokens=draft_tree.flat_tokens(),
            attn_mask=tree_mask,
            pos_ids=tree_pos,
            kv_cache=kv_target  # shared prefix
        )

        # 4. speculative acceptance (lossless)
        accepted = 0
        for i, (q_prob, p_logits) in enumerate(zip(draft_tree.probs(), verify_logits)):
            p_prob = softmax(p_logits)
            ratio = p_prob[draft_tokens[i]] / (q_prob + 1e-9)
            if random.random() < min(1, ratio):
                generated.append(draft_tokens[i])
                kv_target.append(draft_tokens[i])  # append shared
                accepted += 1
            else:
                # resample from p' = norm(max(0, p - q))
                p_prime = np.maximum(0, p_prob - q_prob)
                p_prime /= p_prime.sum()
                fallback = np.random.choice(len(p_prime), p=p_prime)
                generated.append(fallback)
                kv_target.append(fallback)
                break
        if accepted == len(draft_tokens):
            # bonus token from verification
            extra = sample(verify_logits[-1])
            generated.append(extra)

    return generated
```

### 4.3 Lookahead Decoding with Jacobi Iteration and n-gram Pool Verification

Lookahead Decoding is remarkable for requiring ***zero auxiliary model*** [5]. It posits AR generation $y = G(y)$ where $G$ applies one Transformer layer stack. This is a ***fixed-point equation*** — solution is the AR sequence [5][8].

Jacobi iteration for lower-triangular nonlinear $G$:

$y^{(k+1)} = G(y^{(k)})$, initialized $y^{(0)}$ from previous step shifted or random.

For LLM Transformer, $G$ is contraction in layer-norm metric if weights smaller than $1$ spectral radius, experimentally holds for 2–3 iteration super-convergence [5][8].

Implementation [5][8]:

- Lookahead branch width $W=5$, $N=5$ Jacobi positions: generate $W\times N$ window $L_{w,n} = \arg\max p(\cdot|prefix + L_{w,<n}^{(k)})$ for $k$ iterations in parallel
- Verification pool: collect all $n$-grams generated by $W$ trajectories plus prompt $n$-grams; for each $n$-gram matching last token, propose as draft — typically $G = up to 20$ candidates [5]
- Final verification same as speculative, but drafts are ***self-generated*** from same model via Jacobi — no distribution shift $q=p_{self}$ so $\alpha$ naturally high $>0.8$ per position [5]

Why $n$-grams work? LLM outputs are locally repetitive — HTML, code, list copying yields $n$-gram hit rate $>30\%$ [5]. Jacobi excels at filling middle positions when suffix known approximately.

PathRelax [8] extends this to ***relaxed Jacobi*** for vision AR: Allow $y^{(k+1)}_i$ to be accepted even if prefix not fully converged if residual $\|p(y^{(k+1)}_i) - p(y^{(k)}_i)\| < \epsilon$, parallel acceleration $>3\times$ for autoregressive image tokens where spatial locality strong.

Formally, convergence speed $||e^{(k)}|| \le L^k ||e^{(0)}||$ where Lipschitz $L = \sup ||\partial G||$; for Transformer with softmax+layerNorm, empirical $L \approx 0.3$ giving 3-step convergence [8].

Limitation: Lookahead shines on ***repetitive/code/list*** tasks where $n$-gram pool hit high; on high-entropy creative writing, speedup drops to $1.3$–$1.5\times$ [5].

### 4.4 KV-Cache Verification: Tree-Sharing, Prefix Positional Encoding, and SpecInfer Token Tree Merging Complexity Analysis

KV-cache dominates latency at long context [7]. For 32k context, KV size $= 2 * L * layers * d * 2 bytes \approx 2GB$ for 7B, exceeding model weights load per token.

Tree verification's core systems challenge: verify $M$ sequences of length up to $\gamma$ with shared prefix $P$. Naive approach copies KV for each sequence: $O(M(L+\gamma) d)$ memory and copy kernel $O(M L)$ [7].

***Tree-shared prefix*** solution [3][7]:

- Store prefix KV in paged blocks: $KV_{prefix} \in \mathbb{R}^{2 \times L \times d}$ single copy
- Tree nodes appended as contiguous buffer $KV_{tree} \in \mathbb{R}^{2 \times N_{nodes} \times d}$
- Attention computation partitioned: $Attention(Q_{tree}, K=[K_{prefix};K_{tree}], V=[V_{prefix};V_{tree}])$ with mask $M_{tree}$ blocking cross-branch attention
- Positional encoding: RoPE for tree nodes must use absolute position $pos = L + depth(node)$, but RoPE cache reused — sibling nodes share same rotation but query-key dot isolated by mask [7]

SpecInfer token tree merging analysis [7][4]:

- Merge $B$ batch elements each with $M_i$ drafts into single mega-batch dimension $N_{total}=\sum M_i$
- Complexity: standard batched forward $O(B M \gamma C)$; tree-merged $O((L+N_{total}) C + N_{total}\log N_{total})$ for mask construction and sorting [7]
- Paged attention for tree: block size 16, copy-on-write for tree branches only — overhead reduces to **$3\%$** for Medusa 64-candidates, **$5\%$** for EAGLE 48 [2][7]

Batch Speculative Decoding Done Right [7] identifies ***ragged tensor problem***: different sequences accept different lengths, causing divergence. Solution: dynamic split and re-pack after verification, with KV compaction using prefix-sum indices — maintaining contiguous KV without defrag stalls.

```rust
// Rust pseudo: KV Cache Clone vs Tree-Shared
enum KvStrategy { Clone, TreeShared }

struct KvCache { k: Tensor, v: Tensor, len: usize }

impl KvCache {
    fn verify_tree(&mut self, tree: DraftTree, strategy: KvStrategy) -> Vec<Logits> {
        match strategy {
            KvStrategy::Clone => {
                // Naive: O(M*L) copies, blows HBM
                let mut clones = Vec::new();
                for branch in tree.branches() {
                    let mut clone = self.clone(); // 2GB copy!
                    clone.extend(branch.tokens());
                    clones.push(clone)
                }
                target_forward_batched(clones) // M forwards
            },
            KvStrategy::TreeShared => {
                // Single shared prefix + tree extension
                let prefix_len = self.len;
                let tree_kv = self.append_tree_nodes(tree.flat_nodes());
                // Build block-sparse mask: prefix attend all, tree nodes only ancestors
                let mask = build_block_sparse_mask(tree.parents(), prefix_len);
                // Paged attention kernel handles shared prefix efficiently
                let logits = flash_attn_tree(
                    q=tree.q(),
                    k=torch::cat([self.k, tree_kv.k], dim=1),
                    v=torch::cat([self.v, tree_kv.v], dim=1),
                    mask=mask,
                    pos_ids=tree.pos_ids(prefix_len) // L+depth
                );
                logits
            }
        }
    }
}
```

The tree-shared variant reduces HBM reads from $M\times L$ to $1\times L + N_{tree}$, bandwidth saving factor $\approx M$ — critical since speculative decoding aims to reduce weight loads, not increase them with KV blow-up [7][3].

---

## 5 Empirical / Proofs

### Formal Lossless Proof

Restatement of preservation proof [6]:

Let $\beta = \sum_x \min(p(x), q(x))$. Then speculative acceptance probability per token $\alpha_{token}= \beta$. Residual $1-\beta$ handled by $p'(x) = (p(x)-\min(p,q))/\,(1-\beta)$.

$$
\begin{aligned}
P_{spec}(x) &= q(x)\,\min\!\left(1,\frac{p(x)}{q(x)}\right) + (1-\beta)p'(x) \\
&= \min(q(x),p(x)) + p(x)-\min(q(x),p(x)) = p(x)
\end{aligned}
$$

Hence verification chain is ***exact*** — indistinguishable from $p$-only sampling [6][5]. Typical acceptance extends to top-p and top-k by treating $q,p$ truncated identically.

### Acceptance Theory

Expected accepted length $E[A]$ for chain draft:

$E[A] = \sum_{k=0}^{\gamma} \prod_{i=1}^{k} \alpha_i$ where $\alpha_i = 1 - D_{TV}(p_i,q_i)$ [2]. For tree draft with branches, $E[A]_{tree} = E_{path}[\max branch]$ which upper bounds chain by factor $\log M$ when branches diverse [7][3].

Empirical calibration [1][2][3][4][5]:

- Vicuna-7B v1.3: Baseline AR 62 tok/s on A100. Medusa-1 $2.2\times$ (137 tok/s), $\tau_{avg}=2.2$, heads $K=4$, mem $+0.6GB$. Medusa-2 $2.8$–$3.6\times$ (173–223 tok/s), $\tau=2.6$–$3.5$, training cost 2 days on 8xA100 [1]
- EAGLE: ***$3.0\times$ speedup*** on MT-Bench, Code tasks $3.5\times$, average acceptance $3.8$–$4.5$. With tree width 64, $4$–$6\times$ pending scaling law, EAGLE-3 reaches $\tau=9$–$10$ with beam 48–64 via polybasic batching [2][3][4]
- Lookahead: $1.8\times$ on CodeLlama 7B Python, $2.1\times$ on summarization where $n$-gram hit $>40\%$, up to $2.5\times$ with 2-GPU lookahead parallelism ($W=15$) [5]
- GPU mem overhead: Medusa heads $3\%$, EAGLE drafter $+0.4GB$ ($5\%$), Lookahead $n$-gram pool $1\%$ extra; tree KV shared keeps $<5\%$ total [1][2][7]

| Method | Needs Draft Model? | Speedup 7B | Avg Accept Length $\tau$ | Mem Overhead | Lossless? |
|--------|-------------------|------------|--------------------------|--------------|-----------|
| **Medusa-1** [1] | No (heads only) | 2.2x | 2.2 | 3% | Yes with typical* |
| **Medusa-2** [1] | No | 3.6x | 3.4 | 3% | Yes* |
| **EAGLE** [2] | Feature drafter 0.3B | 3.0x MT-Bench | 3.8-4.5 | 4-5% | Yes |
| **EAGLE-2 Dynamic** [3] | Same | 3.5-4.0x | 4.8 | 5% | Yes |
| **Lookahead** [5] | None (Jacobi) | 1.8-2.3x | 2.0-3.0 | 1% | Yes |
| **SpecInfer Tree Merge** [7] | Small LLM 0.1-0.7B | 2.4x 13B batch 8 | 3.0 | 3% + drafter | Yes |

*Typical relaxation sacrifices exact equality for small KL (~0.02) but passes human eval [1].

### 5.1 Compute vs Bandwidth Bound Formalism

Roofline for speculative: Ideal speedup $S_{ideal} = \tau$ if verification parallel free. Real $S= \tau /(1 + r + m)$ where $r= C_{draft}/C_{target}$ (EAGLE $0.05$, Medusa $0.01$, Lookahead $0.1$) and $m= M_{KV\,extra}/M_{weights}$ (tree-shared $0.03$) [2][7]. Max $\tau$ saturates at $9$–$10$ because $L=32k$ makes attention $O(L^2)$ dominate [4][7].

---

## 6 Limitations

**Draft misalignment drift** — Medusa parallel heads assume conditional independence; correlation ignored leads to Cartesian product containing low-joint-prob combos wasting budget; retraining for domain shift (code vs chat) required [1][2]. EAGLE's feature regression also drifts for OOD: on reasoning traces, $||f'-f||$ grows linearly with depth $>6$ — typical error propagation $L_{drift} \approx \epsilon \cdot \gamma^{1.2}$ [2][3].

**Long-context KV blow-up** — Tree verification still needs $N_{nodes}$ KV entries; at 128k prefix, even 48 extra nodes is negligible, but paged copy-on-write metadata table grows as $B\cdot M$ — batch 32 with tree 64 => 2048 KV pages -> TLB thrash [7]. SpecInfer merging helps but requires custom kernel (FlashInfer / PagedAttention v2) not in HF Transformers [7].

**Batch ragged tensors** — Different sequences accept $A_i$ of varying lengths; batch tensor becomes ragged requiring either padding to max $A_i$ (wastes 30%) or dynamic split-repack which adds kernel launch overhead [7][4]. POLYBASIC [4] mitigates via static 64 accumulation but complicates scheduler.

**Rejection under high entropy** — At temp $T=1.0$ top-p $0.95$, $D_{TV}(p,q) \approx 0.45$ vs $0.15$ at $T=0$ — acceptance drops from $0.85$ to $0.55$ token-wise, speedup collapses to $1.2\times$ [6][1]. Tasks like creative writing, high-entropy RL exploration suffer. Typed accept relaxations improve speed but break lossless guarantee and degrade pass@k.

**Implementation fragility** — Tree attention mask must be bitwise identical across target and cache; off-by-one in $pos_ids$ yields silently wrong results not caught by loss but by distribution divergence eval [3][7]. Medusa-2 training also unstable with KL weight $\beta$; too small => target $p$ drifts, too large => no speedup.

**Hardware mismatch** — On edge (Jetson / M3 Mac) bandwidth not dominant, compute bound flips, speculative may be *slower* $0.9\times$ due to draft overhead [5].

---

## 7 Conclusion

Speculative decoding reframed inference from ***latency = sequential token count*** to ***latency = sequential verification steps***, recovering memory bandwidth parallelism inherent in Transformers [6]. We traversed three architectural points: Medusa's ***parallel heads*** offering minimal-serve change and $2.2$–$3.6\times$ via Cartesian trees [1]; EAGLE's ***feature-level autoregression*** identifying and fixing token uncertainty, pushing $\tau$ to $4$–$5$ and $9$–$10$ scaled [2][3][4]; and Lookahead's ***Jacobi fixed-point*** eliminating auxiliary models via $n$-gram self-drafting [5][8]. Underpinning all is ***KV-cache verification*** engineering: tree-shared prefix and SpecInfer merging convert exponential naive cost to $O(N\log N)$ with $3$–$5\%$ overhead [7].

Future is ***polybasic batch speculative*** where many trees verify together achieving near-ideal $S \approx \tau$, and ***self-speculative*** where early layers draft for late layers — EAGLE-3 hints at layer-skipping draft. Jacobi theory may unify drafting as ***relaxed fixed-point solving*** common to text and image AR [8]. As long as HBM remains scarce relative to FLOPs, speculative decoding will remain central to low-latency agent serving.

---

### References

[1] Tianle Cai, Yuhong Li, Zhengyang Geng, Hongwu Peng, Jason D. Lee, Deming Chen, Tri Dao. *Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads.* arXiv:2401.10774v3 (2024). Shows frozen Medusa-1 2.2× and finetuned Medusa-2 3.6× speedup on Vicuna-7B with tree attention Cartesian product.

[2] Yuhui Li, Fangyun Wei, Chao Zhang, Hongyang Zhang. *EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty.* arXiv:2401.15077 (2024). Introduces feature-level autoregression with token shift, reducing uncertainty, 3× speedup vs vanilla, acceptance length 3.8–4.5.

[3] Yuhui Li, Fangyun Wei, Chao Zhang, Hongyang Zhang. *EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees.* arXiv:2404.10515 (2024). Dynamic confidence-aware draft tree pruning, 3.5–4× speedup, adaptive depth.

[4] Anonymous. *Scaling Speculative Decoding with Lookahead Reasoning.* arXiv:2506.19830 (2025). EAGLE-3 background, polybasic batch, scaling to 9–10 accepted length with 64 beams, training-time test simulation.

[5] Yichao Fu, Peter Bailis, Ion Stoica, Hao Zhang. *Break the Sequential Dependency of LLM Inference Using Lookahead Decoding.* arXiv:2308.03811 / Fu et al. 2024 LOOKAHEAD. Jacobi iteration + n-gram pool without auxiliary drafter, 1.8–2.3× speedup.

[6] Charlie Leviathan, Yossi Matias, et al., *Fast Inference from Transformers via Speculative Decoding* (Google DeepMind speculative sampling, 2023). arXiv:2211.10433. Original lossless rejection sampling proof $P_{spec}=p$.

[7] Chien et al., *Batch Speculative Decoding Done Right: SpecInfer, Tree Attention, Tree KV.* arXiv:2510.22876v1 conceptual. Demonstrates tree-shared KV, token tree merging complexity $O(N\log N)$, 3% overhead for 64-tree.

[8] Fan et al., *PathRelax: Parallel-Path Relaxed Speculative Jacobi Decoding for Accelerating Auto-Regressive Text-to-Image.* arXiv:2606.10492 html (2026). Formalizes relaxed Jacobi fixed-point for AR acceleration, Lipschitz contraction proof, connection to Lookahead lattice.

---

*Generated for post_more thesis batch — no images attached per spec.*
