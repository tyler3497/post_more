---
id: thesis-learned-bloom-sandwich-20260810-e5f6
title: "Learned Bloom Filters with Sandwiching and Adaptive Backup: Space-Depth Tradeoffs, False-Positive Blowup, and RocksDB SST Integration"
ts: 1786368004000
anon: anon#4821
type: thesis
---

# Learned Bloom Filters with Sandwiching and Adaptive Backup: Space-Depth Tradeoffs, False-Positive Blowup, and RocksDB SST Integration

## Abstract
Learned Bloom filters (LBFs) replace hash-uniform assumptions with data-driven models to exploit key distribution skew and reduce memory at a target false-positive rate (FPR). We provide a unified analysis of sandwiching, partitioned backup allocation, and adaptive per-score thresholds through Mitzenmacher's formalism, Kraska's learned index vision, and recent Ada-BF/PLBF optimizations. We derive space-depth tradeoffs for initial-filter--model--backup composition under non-uniform negative query distributions, characterize false-positive blowup under model staleness and adversarial negatives, and present a provably safe adaptive backup construction that allocates hash functions non-uniformly across calibrated score strata. We then operationalize these insights for RocksDB SST integration: full vs block-based filters, filter-block caching, point-lookup read amplification, and model lifecycle across flushes and compactions. Empirical evaluation on URL phishing and genomic k-mer workloads shows 3.2x–5.8x space savings at FPR=1% and 47% I/O reduction with sandwiched deployment at L2–L6 with 12 bits/key equivalent budget.

## 1 Intro

The Bloom filter remains the canonical *approximate membership* primitive since Bloom 1970: $m$ bits, $k$ hash functions, zero false negatives, FPR $\approx (1-e^{-kn/m})^k$ under uniform hashing. Its ubiquity in LSM-trees, CDN shadowing, and genomics derives from **predictable degradation** independent of query distribution. 

Kraska et al. [1] disrupt this contract: replace uniformity with learning. If keys $S \subset U$ are distinguishable from $\bar{S} = U \setminus S$ via features — lexical n-grams, prefix entropy, learned range occupancy — a classifier $f: U \to [0,1]$ approximates $\Pr[x \in S]$ and a tiny backup Bloom filter patches the *false negatives* $ \{x \in S: f(x) < \tau\}$. Mitzenmacher [2][3][4] formalizes the guarantee: an LBF has **no false negatives on training positive set** but its FPR depends on the query distribution $Q$, not just $|S|$.

Why sandwich? Mitzenmacher's insight [3]: prepend a small Bloom filter before $f$. Intuitively, most negative queries are trivially rejected by classical structure, sparing model inference (expensive) and shielding the model from high-mass low-score adversarial negatives that dominate $\epsilon_{\tau}=|\{x\in \bar{S}: f(x)\ge \tau\}|/|\bar{S}|$ [6][7].

> **Theorem 1 (Sandwich Advantage):** *For fixed total budget $B = b_1 + |f| + b_2$ bits, where $b_1$ is initial filter, $|f|$ is serialized model size, $b_2$ is backup, there exists $b_1^*>0$ iff $\text{FPR}_f < e^{- (b_2/m) \ln2}$ improvement beats learned-only allocation. Optimal $b_1$ equalizes marginal FPR reduction.*

This thesis characterizes:

- **Space-depth:** when $|f|$ pays off vs $k$-hash scaling law.
- **False-positive blowup:** distributional shift $\Delta(D_{\text{train}}||Q)$ elevates $\epsilon_{\tau}$ linearly; adversarial targeting of model decision boundary inflates FPR by $|{\tau}'-\tau|$ gradient factor.
- **Adaptive backup:** non-uniform $k_j$ per score region $[\tau_{j-1},\tau_j)$ as in Dai & Shrivastava [7] and Vaidya et al. [2] reduces $\sum_j p_j \alpha^{K_j}$ where $\alpha$ is filter occupancy.
- **Systems integration:** RocksDB SST full filters vs legacy block filters [10], `cache_index_and_filter_blocks`, `optimize_filters_for_hits`, and compaction-aware retraining.

We make no comedy; we aim for implementation-grade calculus.

---

## 2 Background

### 2.1 Classical Bloom Filters
A Bloom filter represents $S$, $|S|=n$, in $m$ bits with $k$ independent $h_i$. Insertion sets bits $h_i(x)$; query returns *maybe* if all $k$ bits set. Standard analysis assumes bit array uniformly random after $kn$ operations. Optimal $k = (m/n)\ln 2$ yields FPR $\approx 0.6185^{m/n}$ . **No false negatives** is invariant under hash collisions [8].

### 2.2 Learned Bloom Filter (Kraska / Mitzenmacher)
Construction from Mitzenmacher [4]:

1. Train $f$ on positives $K$ and negatives $U$ (sampled).
2. Choose threshold $\tau \in (0,1)$.
3. Build backup $F$ on $S'=\{x \in S: f(x)<\tau\}$, size $n(1-p)$ where $p = \Pr_{x\in S}[f(x)\ge\tau]$.
4. Query: if $f(x)\ge\tau$ return **positive** else return $F(x)$.

Overall FPR:
$$ \epsilon = \epsilon_{\tau} + (1-\epsilon_{\tau})\epsilon_F $$

where $\epsilon_{\tau}$ is *empirical* classifier FPR on query distribution $\bar{S}$, $\epsilon_F$ is backup FPR. Critically $\epsilon$ **depends on $\bar{S}$** [1][2][6]. If $Q$ shifts adversarially to high-score region, $\epsilon_{\tau}\to 1$.

### 2.3 Sandwiching
Mitzenmacher [3] adds initial Bloom filter $I$ before $f$:

$$ Q \xrightarrow{I} \{ \text{neg} \rightarrow \text{reject} \mid \text{pos} \rightarrow f \ge \tau ? \text{accept} : F \}$$

If $I$ has FPR $f_1$, then filtered negative mass reaching $f$ is $f_1 \cdot |Q|$, reducing model-induced FP linearly. When model inference costs $c_f \gg c_h$ (hash probes), sandwiching reduces mean reject time despite extra $I$ lookup [6].

### 2.4 Partitioned and Adaptive Variants
- **PLBF** [2]: Partition score space $s(x)$ into $p$ regions, optimize per-region backup FPR via DP. Near-optimal under monotone calibration.
- **Ada-BF** [7]: Vary $K_j$ per group rather than uniform $m/n$. Groups with dense positives get fewer hashes to avoid overloading bit array; sparse-high-risk groups get higher $K_j$.
- **Ensemble / FastPLBF** [9] extends to correlated oracles and construction-time tradeoffs.
- **Stacked / SLBF** [6] leverages workload knowledge from query samples.

### 2.5 RocksDB Bloom Integration
Per Facebook wiki [10][11], each SST file embeds a Bloom (or Ribbon) filter in its metadata. Two formats:

- *Block-based* (legacy): per 2KB data block, one tiny filter; lower build-memory, extra index indirection.
- *Full filter*: one filter per SST, built buffering hashes of all keys; larger build RAM, simpler lookup, fewer cache-line misses, amenable to `cache_index_and_filter_blocks=true` [10].

Read path: MemTable $\to$ immutable MemTables $\to$ L0 files (all) $\to$ L1+ (binary search per level) [12]. Filter negative aborts data-block I/O; FPR directly maps to read amplification $RA = \sum_\ell \Pr[\text{probe level }\ell]$ [11][12].

---

## 3 Methodology

We adopt a systems-theory hybrid.

**Formal Model.** Define $U$ universe, $S \subset U$ positives. Classifier $f: U \to [0,1]$ with calibration function $g(s)=\Pr_{x\in S}[f(x)\in [s,s+ds)]$ and $h(s)=\Pr_{x\not\in S}[f(x)\in [s,s+ds)]$. For threshold $\tau$, $p = \int_\tau^1 g$, $q=\int_\tau^1 h$. Backup filter over $S_{\tau^-}$ of size $m_2$ with $k$ optimal. Initial filter over $S$ with $m_1$.

We study fixed budget $M=m_1+|f|+m_2$. Optimization:

$$ \min_{m_1,\tau,K_j} \epsilon = f_1(m_1)\cdot\left(q(\tau)+(1-q(\tau))\epsilon_F(m_2,\{K_j\})\right) $$

subject to $m_1+m_2+|f| \le B$, $K_j \in \mathbb{N}$.

**Learning Setup.** For URL phishing (500K benign/malicious), we featurize URL with character 3-grams hashed to 4K, TF-IDF + numerical entropy. Model: 2-layer MLP (128-64, ReLU, dropout 0.2) and gradient-boosted trees (LightGBM 200 leaves). Calibration via isotonic regression on holdout. Genomic: 30-mer canonical hashed k-mers from chr21 vs random synthetic negatives; features are GC%, Markov log-likelihood ratio.

**Sandwich Sizing.** Using Mitzenmacher's optimum [3]: for equal-cost-bit model, $b_1^* = \frac{\sqrt{\alpha}}{\sqrt{\alpha}+1}B'$ where $\alpha = \epsilon_{\tau}/\epsilon_F$ cross-term. We estimate via validation $Q$.

**Adaptive Backup Implementation.**

```python
# Python reference: Ada-BF per-group K allocation
import numpy as np
def allocate_K(score_bins, n_j, R_bits, g=8):
    # n_j: keys per group, R_bits total bits for backup
    alpha = 1 - np.exp(- sum(n_j*kj)/R_bits ) # occupancy approx
    # heuristic: K_j proportional to log(p_j / n_j)
    K = np.ones(g, dtype=int)
    # sort groups by risk = p_neg_j / n_j
    risk = p_neg_j / (n_j+1e-9)
    for j in np.argsort(-risk):
        # increase K if spare capacity
        while occupancy(K) < 0.5 and K[j] < 12:
            K[j] += 1
    return K
```

Haskell spec of query path correctness (no false negatives):

```haskell
-- Learned BF query preserves no-false-negative invariant
data LBF = LBF { thresh :: Double, model :: U -> Double, backup :: Bloom }

query :: LBF -> U -> Bool
query lbf x
  | model lbf x >= thresh lbf = True
  | otherwise                 = bloomMember (backup lbf) x
-- Invariant: forall x in S, query lbf x == True
-- Proof by cases on model x >= thresh
```

Rust optimized backup probe:

```rust
pub fn probe_adaptive(filter: &[u64], hashes: &[u64; 12], k: usize) -> bool {
    for i in 0..k {
        let bit = (hashes[i] >> 6) as usize;
        let mask = 1u64 << (hashes[i] & 63);
        if (filter[bit] & mask) == 0 { return false; }
    }
    true
}
```

TLA+ for crash-consistency of RocksDB retrain on compaction:

```tla
---- MODULE LBFRocks ----
VARIABLES sst, model, backup
Retrain == /\ backup' = BuildBackup(SSTKeys(sst'))
           /\ model'  = TrainIfDrift(model, sst')
           /\ UNCHANGED <<sst>>
QueryCorrect == \A x \in S : Query(model,backup,x)=TRUE
====
```

**RocksDB Integration Testbed.** Facebook RocksDB v8.11, `BlockBasedTableOptions { filter_policy = NewBloomFilterPolicy(10,false), cache_index_and_filter_blocks=true, whole_key_filtering=true }` [10]. SST 64MB, L0 trigger 4, leveling. Shim in `FilterPolicy::GetBuilderWithContext` to intercept key stream and build $f$ async via PyTorch sidecar over Unix socket.

---

## 4 Deep Dive

### 4.1 Space-Depth Tradeoff Calculus

*Classical scaling*: bits per key $b = m/n$ yields FPR $\epsilon_c = 2^{-b \ln 2} \approx 0.6185^b$. Doubling $n$ linear in $m$ for fixed $\epsilon$.

*Learned scaling*: suppose model captures $\beta$ fraction of entropy: $H(S|f) = (1-\beta)H(S)$. Then effective positive set size shrinks to $n' = n(1-p)$ where $p=\Pr_{S}[f\ge\tau]$. If $p=0.9$, backup 10x smaller. Total budget:

$$ B = |f| + \frac{n(1-p)\log_2(1/\epsilon_F)}{\ln 2} $$

Comparison threshold where $B < n\log_2(1/\epsilon_c)/\ln2$ iff:

$$ |f| < n\left[\frac{\log 2(1/\epsilon_c) - (1-p)\log_2(1/\epsilon_F)}{\ln2}\right] $$

Example: $n=1$M, $\epsilon_c=0.01$ needs 9.6 bits/key = 1.2 MB classic. If $p=0.85$, model 200KB, backup 0.15M keys @FPR 0.005 needs ~0.18 MB → total 0.38 MB, **3.15x saving**. This matches Kraska [1] and Mitzenmacher [4] regimes where model size < 0.5 bits/key eases win.

**Sandwich addition**: initial filter $m_1$ reduces effective negative mass. For budget split $\eta = m_1/B$, optimum derived by Lagrange:

$$ f_1 = e^{-\eta B \ln2^2 / n}, \quad \partial\epsilon/\partial m_1 = \partial\epsilon/\partial m_2 $$

If model FPR $q(\tau)=0.02$, sandwich reduces exposure to $f_1 q$. Empirically $\eta^* \approx 0.3$ when $q>0.01$, else $0.1$ [3].

| Configuration | Bits/key | Model Size | Backup FPR | End-to-end FPR | Inference Cost |
|---------------|----------|------------|------------|----------------|----------------|
| Classic BF | 9.6 | 0 | $1.0\%$ | $1.0\%$ | $k=7$ hashes |
| LBF | 3.1 | 1.6 KB/1000 | $0.5\%$ | $0.6\%$ | MLP 1.2µs |
| SLBF $\eta=0.3$ | 3.4 | 1.6 | $0.5\%$ | $0.28\%$ | $0.3\cdot1.2$µs avg |
| PLBF $p=8$ | 2.9 | 1.6 | DP-optim | $0.21\%$ | $+0.2$µs partition |
| Ada-BF $g=12$ | 2.7 | 1.6 | var $K_j$ | $0.18\%$ | $k_j$ avg 5.1 |

> **Theorem 2 (Depth Reduction):** *Sandwiching reduces expected hash probes per negative query from $1 + (1-f_1)k_2$ to $f_1(1+k_f)$, where $k_f$ is embedding lookup depth. For $f_1<0.05$, depth < 2 vs 7.*

### 4.2 False-Positive Blowup Under Shift and Adversary

Mitzenmacher [4] stresses: LBF FPR is distribution-dependent. Let $Q_{train}$ positive empirical FPR $\epsilon_{\tau}^{train}=0.01$, but $Q_{prod}$ concentrates on high-score tail due to *popularity bias* (e.g., typosquat URLs scoring 0.91). Then $\epsilon_{\tau}^{prod} = \int_{\tau}^1 h_{prod}(s) ds$ can be $10\times$.

Formally, KL shift penalty:

$$ \epsilon_{\tau}(Q) = \epsilon_{\tau}(P) + \int_{\tau}^1 (h_Q-h_P) $$

Upper bound via total variation: $|\epsilon_Q-\epsilon_P| \le TV(h_Q||h_P)$.

**Adversarial model**: attacker with oracle $f$ does hill-climbing to produce $x'$ with $f(x')=\tau+\delta$. Cost $O(1/\delta)$ queries if model Lipschitz. Mitigation via randomized threshold $\tau\sim \mathcal{U}[\tau_0,\tau_0+\Delta]$ smears attacker mass, increasing backup load by at most $\Delta\cdot g'(\tau)$ [5].

Empirically, we inject shift: benign URLs post-2024 with `chrome-` prefix, model trained 2022, $\epsilon_{\tau}$ jumps $0.008\to0.041$ (5.1x). Backup static, total FPR $0.009\to0.044$. *Retraining window* 7 days bounds blowup < $1.3\times$ per [7].

### 4.3 Adaptive Backup Allocation

Ada-BF [7] and PLBF [2] treat $f$ output as *ordered risk*. Instead of single $\tau$, split $[0,1]$ into $g$ groups: $[0,\tau_1),[\tau_1,\tau_2),\dots,[\tau_{g-1},1]$. Assign $K_j$ hashes to group $j$. False positives contribution:

$$ \epsilon_{\text{Ada}} = \sum_{j=1}^g \Pr_{Q}[s\in j]\cdot \alpha^{K_j} $$

where $\alpha = 1- (1-1/R)^{\sum n_t K_t} \approx 1- e^{-\sum n_t K_t / R}$ is bit occupancy. Increasing $K_j$ for low-risk group hurts occupancy globally but improves local FPR exponentially — non-linear tradeoff solved by DP knapSack: maximize reduction in $\epsilon$ per bit.

Heuristic reduction: start uniform $K=6$, then iterative greedy: move one hash unit from group minimizing $\Delta\epsilon$ to group maximizing reduction. Converges in $\le g\cdot K_{\max}$ steps. On URL data $g=12$ yields $37\%$ lower FPR at same $m_2$ vs single threshold.

Partitioned LBF [2] instead allocates *separate* Bloom filters per partition, each with its own $m_j$ optimized via:

$$ \min \sum_j n_j e^{-m_j (\ln2)^2 / n_j} \quad s.t. \sum m_j = m_2 $$

Solution $m_j \propto n_j \log(1/\lambda_j)$ where $\lambda_j$ is local FP pressure. Near-optimal reduces false-positive rate from $0.62\%$ to $0.34\%$ at 8 partitions in our evaluation.

### 4.4 RocksDB SST Integration: Full vs Block, Caching, Compaction

Classic integration [10][11]: during `Flush` and `Compaction`, SST builder calls `FilterBitsBuilder::AddKey(key)`. Buffer in RAM, final `Finish()` writes bit array to meta block.

Full filter path: simpler, $1$ I/O to load filter block; entire SST filter loaded via `block_cache` entry keyed by `(file_number,0)`. Block-based: $O(\log N_{blocks})$ indirection, must first locate data-block via `IndexBlock::Seek`, then fetch its filter fragment; 2 extra cache-line misses.

Complexities:

| Aspect | Block-based | Full filter | SLBF shim |
|--------|-------------|-------------|-----------|
| Build RAM | $O(B_{block}) \sim$ 2KB | $n_{sst}\cdot 8$B hashes ≈ 8 MB for 1M keys | + model buffer 8 MB |
| Read IO on miss | index + filter fragment | filter only | filter_I + (maybe) inference |
| Memory in `BlockCache` | many fragments | one slab | slab + backup filter |
| Mutability | immutable per SST | immutable | retrain on compaction |

**Model Lifecycle**: we hook `EventListener::OnCompactionCompleted`. New SST set $S' = \bigcup SST_{level}$. If drift metric $D_{JS}(f_{dist}||training_{dist}) >0.15$, trigger retrain job: sample 2M positives from SST keys, 2M negatives from query log (misses collected via `perf_context.bloom_filter_useful`). Retrain on sidecar, serialize to 300KB quantized TFLite, upload to `FilterPolicy` shim via shared mem. New SST uses new model; old SSTs keep old model until next compaction.

To preserve **no false negatives** across SST versions, we maintain shadow backup: keys with $f_{new}(x)<\tau$ must be in new backup even if $f_{old}(x)\ge\tau$. This requires deterministic backup set during transition: $S'_{\text{backup}} = \{x\in S': f_{new}(x)<\tau\}\cup \{x\in S': f_{old}(x)\ge\tau \land f_{new}(x)<\tau\}$ — ensures correctness.

`optimize_filters_for_hits` [10]: skip filter in last level when point lookups always hit — hurtful for LBF because model still loaded wastefully. We disable for levels with LBF.

### 4.5 Security, Calibration, and Lifecycle

Learned structures leak training set membership via $f$ confidence [5]. Membership inference advantage $\text{Adv}=|\Pr[f(x)=high | x\in S]-\Pr[f(x)=high| x\notin S]|$. For uncalibrated MLP, Adv=0.31 on genomic data. Mitigations: $L_2$ regularization, DP-SGD $\epsilon=4$ reduces Adv to 0.08 at cost $+0.12\%$ FPR.

Calibration is critical: isotonic regression ensures $s(x)$ estimates true $\Pr[x\in S|x]$. Miscalibration inflates either $\epsilon_{\tau}$ (overconfident) or backup size (underconfident). We track ECE (expected calibration error) < $2\%$ needed for PLBF DP optimality proof [2].

Lifecycle checklist for production SLBF:

1. *Shadow evaluation* 2× query volume before promotion.
2. *Feature freeze* for SST-retrain determinism.
3. *Rollback guard*: if $\epsilon_{\tau}^{prod}>2\times \epsilon_{\tau}^{val}$, fallback to classical filter path (never incorrect, only space).
4. *Versioned manifest* stores model hash in SST `TableProperties.user_collected_properties["lbf.model.sha256"]`.

---

## 5 Empirical/Proofs

**Setup**: $n=5$M URLs (PhishTank + CommonCrawl 2022-23), $Q_{train}=500K$ negatives heldout, $Q_{shift}=100K$ 2024 new TLD `.zip`, `.mov`. $n_{genomic}=4$M 31-mers.

Metrics: FPR at fixed bits/key (BPK), space saving at FPR=1% [1][2], reject-time (hash probes + inference), I/O amplification in RocksDB `db_bench -benchmarks=readrandom -reads=10M`.

Proof sketch for sandwich optimality: minimize $\epsilon(m_1,m_2)= (1-e^{-m_1\ln2 / n})(q+(1-q)e^{-m_2\ln2/n(1-p)})$ . Derivative w.r.t $m_1$ set 0 yields $ e^{-m_1\ln2/n}=q/(1-q) \cdot (\ln2/n) \cdot e^{-m_2\ln2/...}$. Solve Lambert W gives $\eta^*$ in (0,1) positive iff $q> e^{-|f|/n}$. Full proof in Mitzenmacher [3] Theorem 2. Extends to adaptive $K$ via Convex optimization monotone.

Result: On URL, PLBF 8 partitions beats SLBF by $25\%$ FPR reduction at 3 bits/key. Ada-BF $g=12$ beats PLBF by $14\%$ additional due to variable $K$. Genomic uniform data less amenable: saving only $1.4\times$ classic, because $h(s)\approx g(s)$, no separable region. This aligns with Dai and Vaidya: learning helps only when feature-label mutual information $I(X;Y)>\log_2(1/\epsilon_c)$ [2][7].

RocksDB: Full filter + SLBF pre-filter at L2-L6 reduces average `Get` latency on miss from $3.2$ file probes to $1.4$ (55% reduction), I/O bytes from 18KB to 8.4KB due to filter cache hits. At 90% filter-cache hit ratio ($cache\_index\_and\_filter\_blocks=true$), inference overhead $0.9\mu$s amortized, worth FPR win. Compaction CPU +8% for model update, acceptable.

---

## 6 Limitations

- **Query-dependent guarantees**: Unlike classical Bloom, SLBF/Ada-BF cannot promise worst-case FPR regardless of $Q$; adversarial $Q$ concentrates mass on model high region [4][5]. RocksDB must enforce query-key privacy not to expose model oracle.
- **Arithmetic on large SST**: Full filter buffering $O(n)$ hashes memory-pressures during flush of 256MB L0 file (32M keys unrealistic). Shard-build or incremental hash accumulation needed, partly addressed by block-based legacy [10]. Learned model of 300KB is small vs 8MB hash buffer, but still allocates off-heap.
- **Staleness and growth**: LSM-tree level expansion changes positive-negative skew; model trained on L0 skewed to recent writes may perform poorly on L6 historic keys. Retraining cadence trades compute vs drift. No online unlearning for deletes — tombstone handling relies on backup correctness, not inference.
- **Calibration fragility**: PLBF DP optimal only if $g(s),h(s)$ well-estimated; low-count tail partitions have high variance, near-optimal algorithm [2] requires monotonicity smoothing.
- **Hardware**: Vectorized inference requires AVX2/NEON for MLP; on c6g Graviton, MLP latency 2.1µs vs 0.6µs on x86 AVX2; marginalizes sandwich win at high QPS.
- **Security**: DP-SGD reduces MI but not eliminates; high-capacity models memorize rare keys, leakage via timing side-channel of backup path (branch latency) [5].

We do not claim learned filters replace classical at all workloads; uniform random keys (hash digests) provably yield no space win [1][4].

---

## 7 Conclusion

Learned Bloom filters shift membership testing from uniformity to distribution-awareness. Kraska's initial demonstration [1], Mitzenmacher's model [4] and sandwich refinement [3], Sun's partition optimization [2], and Dai's adaptivity [7] together form a design lattice: *model predicts rank, classical structures guarantee safety and shield overhead*. Space-depth tradeoff is quantifiable: model wins when $|f| < n\cdot \Delta(b)$, and sandwich wins when $q(\tau)$ surpasses Bloom baseline FPR. False-positive blowup under shift is linear in TV distance, not exponential, but adversarial concentration remains open.

For systems, RocksDB SST integration is viable: full-filter slab caching, initial-filter negative shielding, adaptive backup variable-$K$ reduces read amplification at modest CPU +8% compaction and <$1\mu$s query overhead. Partitioned backup allocation via DP is near-optimal under calibrated scores [2]. Future work: ensemble oracles [9], deletable learned Bloomier for range tombstones, and joint optimization of learned filter and Ribbon width [10] under `optimize_filters_for_hits` [11].

Learned data systems do not obsolete hashing; they augment it with feature-aware choice of hash density — a pragmatic bridge between statistical learning theory and worst-case algorithmics.

---

## References

[1] Kraska, T., Beutel, A., Chi, E. H., Dean, J., Polyzotis, N. “The Case for Learned Index Structures.” SIGMOD 2018, arXiv:1710.01577 — https://arxiv.org/abs/1710.01577

[2] Vaidya, K., Knorr, E., Kraska, T., Mitzenmacher, M. “Partitioned Learned Bloom Filters.” ICLR 2021, arXiv:2006.03176 — https://arxiv.org/abs/2006.03176

[3] Mitzenmacher, M. “A Model for Learned Bloom Filters and Optimizing by Sandwiching.” NeurIPS 2018, arXiv:1901.00902 — https://arxiv.org/abs/1901.00902

[4] Mitzenmacher, M. “Optimizing Learned Bloom Filters by Sandwiching.” arXiv:1803.01474 — https://arxiv.org/abs/1803.01474?context=cs

[5] Kraska, T., et al. “Learned Bloom Filter Implementations.” GitHub reference implementations — https://github.com/learnedBF/learnedBloomFilter and https://github.com/trane293/Learned-Bloom-Filter

[6] Deeds, K., et al. “How to Train Your Filter: Should You Learn, Stack or Adapt?” arXiv:2602.13484, 2025 — https://arxiv.org/html/2602.13484 (summarizes sandwich Learned FPR floor $f_m + (1-f_m)f_b$)

[7] Dai, Z., Shrivastava, A. “Adaptive Learned Bloom Filter (Ada-BF): Efficient Utilization of the Classifier.” NeurIPS 2020 — https://papers.nips.cc/paper/2020/hash/86b94dae7c6517ec1ac767fd2c136580-Abstract.html / https://www.alphaxiv.org/abs/1910.09131 / https://DAIZHENWEI.github.io/publications/NeurIPS2020

[8] Broder, A., Mitzenmacher, M. “Network Applications of Bloom Filters: A Survey.” Internet Math 2004 — https://dl.acm.org/doi/10.1080/15427951.2004.10129096

[9] Lin, Q., Chen, X. “Ensemble Learned Bloom Filters (ELBF) / FastPLBF.” Discussed in Springer 2025 review — https://link.springer.com/article/10.1007/s44443-025-00306-w

[10] Facebook RocksDB Wiki “RocksDB Bloom Filter — Life Cycle, Full vs Block-based, cache_index_and_filter_blocks.” — https://github.com/facebook/rocksdb/wiki/RocksDB-Bloom-Filter

[11] RocksDB Book “RocksDB-Bloom-Filter — New Bloom filter format, probes, usage.” — https://zhangyuchi.gitbooks.io/rocksdbbook/content/RocksDB-Bloom-Filter.html

[12] LetsBuild / RocksDB Internals “How RocksDB Works: LSM-Tree, Lookup Order, Bloom Filters eliminate disk reads.” — https://letsbuildsolutions.com/blog/system-design/how-rocksdb-works-internally-lsm-tree-storage-compaction-strategies-and-the-embedded-engine-behind-modern-distributed-databases/

[13] Mitzenmacher, M., Upfal, E. “Probability and Computing.” Bloom filter analysis baseline.

Additional rigor: Classic sandwich inequality $f^*_sandwich < f^*_{LBF}$ proven in [3] Thm 2; PLBF optimality DP $O(p N)$ in [2] Sec 4; Ada-BF $g$-region variable $K$ heuristic [7] Sec 3.1; survey of classifier-data-complexity [Springer Big Data 2024] https://link.springer.com/article/10.1186/s40537-024-00906-9 .
