---
id: ths_20260821_bfl_krum_bulyan_flame_04
title: "Decentralized Federated Learning with Byzantine Robustness: Krum, Multi-Krum, Bulyan, Coordinate-Wise Median, FLAME Clustering, and Secure Aggregation Interplay"
anon: "anon#8623"
ts: 1787323089256
type: thesis
thesis: true
topic: "Decentralized Federated Learning with Byzantine Robustness: Krum, Multi-Krum, Bulyan, Median, FLAME, and Secure Aggregation Interplay"
word_count: 2635
images:
  - ths_20260821_bfl_krum_bulyan_flame_04-0.webp
  - ths_20260821_bfl_krum_bulyan_flame_04-1.webp
  - ths_20260821_bfl_krum_bulyan_flame_04-2.webp
  - ths_20260821_bfl_krum_bulyan_flame_04-3.webp
sources:
  - title: "Machine Learning with Adversaries: Byzantine Tolerant Gradient Descent (Krum) - Blanchard et al. NeurIPS 2017"
    url: https://proceedings.neurips.cc/paper/2017/file/f4b9ec30ad9f68f89b296397df84a562-Paper.pdf
  - title: "The Hidden Vulnerability of Distributed Learning in Byzantium (Bulyan) - El Mhamdi et al. ICML 2018"
    url: https://arxiv.org/abs/1802.07927
  - title: "FLAME: Taming Backdoors in Federated Learning - Nguyen et al. USENIX Security 2022"
    url: https://arxiv.org/abs/2101.02281v4
  - title: "Byzantine-Robust Distributed Learning: Towards Optimal Statistical Rates (Median) - Yin et al. ICML 2018"
    url: https://arxiv.org/abs/1803.01498
  - title: "Practical Secure Aggregation for Privacy-Preserving Machine Learning - Bonawitz et al. CCS 2017"
    url: https://arxiv.org/abs/1707.10159
  - title: "Byzantine Machine Learning: MultiKrum and an optimal notion of robustness - Allouah et al."
    url: https://arxiv.org/abs/2602.03899v1
  - title: "An Experimental Study of Byzantine-Robust Aggregation Schemes in Federated Learning"
    url: https://arxiv.org/abs/2302.07173
  - title: "Robust Federated Learning via Byzantine Filtering over Encrypted Updates"
    url: https://arxiv.org/abs/2602.05410v1
  - title: "ByzSFL: Achieving Byzantine-Robust Secure Federated Learning with Zero-Knowledge Proofs"
    url: https://arxiv.org/abs/2501.06953v1
---

# Decentralized Federated Learning with Byzantine Robustness: Krum, Multi-Krum, Bulyan, Coordinate-Wise Median, FLAME Clustering, and Secure Aggregation Interplay

## Abstract
Decentralized federated learning (FL) distributes training across mutually distrustful clients, exposing the aggregation layer to Byzantine and backdoor adversaries that inject arbitrary gradients. This thesis synthesizes provably Byzantine-resilient rules—Krum, Multi-Krum, Bulyan, coordinate-wise median, and geometric median—with clustering-based backdoor elimination via FLAME, and analyzes their fragile interplay with secure aggregation. We formalize (α,f)-Byzantine resilience, leeway bounds O(1/√d) in high dimension, and robustness coefficients κ★ for Multi-Krum, contrast non-IID failure modes, and reconstruct FLAME's three-stage pipeline of HDBSCAN clustering, adaptive clipping, and noise injection. We then dissect the tension between confidentiality-preserving masking (Bonawitz et al.) and robustness inspection, surveying homomorphic filtering, zero-knowledge proofs, and sharded aggregation. A unified taxonomy and empirical protocol are proposed, achieving principled trade-offs among utility, privacy, and resilience in adversarial federations.

---

## 1 Introduction

**Federated Learning (FL)** promises collaborative model improvement without centralizing raw data [7], yet its distributed trust model creates a fundamental vulnerability: *Byzantine clients* may behave arbitrarily, sending crafted updates that subvert convergence or implant backdoors [1][2][3]. While *Federated Averaging (FedAvg)* is optimal in benign regimes, a single malicious participant suffices to break averaging-based aggregation [1].

> **Theorem (Impossibility of Linear Aggregation):** No aggregation rule that outputs a linear combination of client updates with fixed coefficients can be Byzantine-resilient for f ≥ 1 [1]. Resilience requires *non-linear* selection, median, or clustering operations.

The literature has diverged into three defensive lineages:

* **Distance-based selection:** *Krum* [1] and its generalization *Multi-Krum* [1][6] select updates closest to their geometric neighborhood, bounding angular deviation from the true gradient.
* **High-dimensional hardening:** *Bulyan* [2] and coordinate-wise *median / trimmed mean* [4] narrow the attacker's *leeway* from Ω(√d) to O(1/√d) by iterating selection and per-dimension robust statistics.
* **Backdoor-specific clustering:** *FLAME* [3] eliminates trigger-embedded models via cosine-similarity HDBSCAN clustering, adaptive L₂ clipping, and calibrated DP-noise injection, preserving benign accuracy.

These advances collide with a fourth requirement: **secure aggregation** [7]. Bonawitz et al.'s masking protocol hides individual updates cryptographically, preventing the server from inspecting them — precisely what Krum, Bulyan, and FLAME need to do. Recent work attempts to reconcile robustness and confidentiality via *homomorphic filtering* [8], *zero-knowledge proof (ZKP) certified aggregation* [9], and *sharded secure aggregation* [10].

*Contributions of this thesis:*

- Unified formalism of (α,f)-Byzantine resilience, optimal robustness coefficient κ★, and high-dimensional leeway.
- Comparative analysis of Krum family, Bulyan, median, and FLAME under IID vs non-IID heterogeneity and adaptive attacks.
- Deep dive into secure-aggregation vs. inspection tension and emerging cryptographic mitigations.
- Empirical evaluation blueprint with attack taxonomy, metrics, and reproducible Python/Rust sketches.
- Limitations and open problems for decentralized, blockchain-audited, and asynchronous FL.

---

## 2 Background

### 2.1 Federated Optimization Model

Let n clients hold private datasets D_i, each computing stochastic gradient g_t^{(i)} ≈ ∇Q(w_t) where Q is global loss. In FedAvg, server updates:

$$w_{t+1} = w_t - \gamma_t \cdot \frac{1}{n} \sum_{i=1}^{n} g_t^{(i)}$$

With f Byzantine clients, g_t^{(j)} for j ∈ B is *arbitrary*, possibly adversarially dependent on honest gradients [1][2]. The threat model assumes f ≤ ⌈n/2⌉−1, often 2f+2 < n for Krum, 4f+3 ≤ n for Bulyan.

### 2.2 (α,f)-Byzantine Resilience

Blanchard et al. define [1]:

1.  ⟨E[F], ∇Q(w)⟩ ≥ (1−sin α)‖∇Q(w)‖² > 0 — output maintains positive alignment with true gradient.
2.  Moments E‖F‖ʳ bounded by honest gradient moments for r=2,3,4.

This guarantees SGD convergence despite f adversarial vectors. Variance condition required:

$$ \eta(n,f) \cdot \sqrt{d} \cdot \sigma < \|g\| $$

where η(n,f)= 2n−2f + O(f²(n−f)) / (n−2f−2) and σ² bounds gradient variance.

### 2.3 High-Dimensional Vulnerability

El Mhamdi et al. [2] showed *convergence ≠ security*. Even if aggregation converges, in d≫1 attacker can exploit loss non-convexity to force convergence to *low-accuracy* saddle with margin:

$$ \text{leeway}_{Krum} = \Omega(\sqrt{d}), \quad \text{leeway}_{Bulyan} = O(1/\sqrt{d}) $$

This motivates Bulyan's iterative refinement.

### 2.4 Secure Aggregation (Bonawitz et al., CCS 2017)

Bonawitz et al. [7] introduce pairwise-masked summation:

$$ y_i = x_i + \sum_{j<i} PRG(s_{i,j}) - \sum_{j>i} PRG(s_{i,j}) + PRG(b_i) $$

Server learns Σx_i only if ≥ t clients survive, preserving privacy against honest-but-curious server. Mask cancellation prevents individual inspection, conflicting with robust filtering.

---

## 3 Methodology

We adopt a *theoretical-systematic* methodology:

1.  **Literature reconstruction:** Re-derive Krum scoring, Multi-Krum averaging, Bulyan's two-phase loop, coordinate-wise median, and FLAME's pipeline from primary sources [1][2][3][4][7].
2.  **Formal comparison:** Tabulate breakdown point, time complexity O(n²d), resilience assumptions, leeway, and non-IID degradation.
3.  **Attack taxonomy:** Classify *untargeted* (gradient ascent, noise, A Little is Enough - ALIE, Inner Product Manipulation - IPM) vs *targeted backdoor* (model replacement, DBA distributed backdoor) [5][3].
4.  **Cryptographic interplay analysis:** Survey incompatibilities and three mitigation families [8][9][10].
5.  **Protocol synthesis:** Design evaluation harness measuring main-task accuracy, attack success rate (ASR), and robustness coefficient.

Implementation sketches use *Python* for robust aggregation simulation and *Rust* for masking efficiency.

```python
import numpy as np

def krum_score(grads, f):
    n = len(grads)
    k = n - f - 2
    scores = []
    for i, g in enumerate(grads):
        dists = sorted([np.linalg.norm(g - gj)**2 for j, gj in enumerate(grads) if j != i])
        scores.append(sum(dists[:k]))
    return np.argmin(scores)

def multi_krum(grads, f, m=None):
    n = len(grads)
    if m is None: m = n - f - 2
    scores = []
    for i, g in enumerate(grads):
        dists = sorted([np.linalg.norm(g - gj)**2 for j, gj in enumerate(grads) if j != i])
        scores.append(sum(dists[:n-f-2]))
    idx = np.argsort(scores)[:m]
    return np.mean([grads[i] for i in idx], axis=0)

def bulyan(grads, f):
    # Phase 1: Multi-Krum selection of n-2f
    # Phase 2: coordinate-wise trimmed median
    selected = []
    remaining = grads.copy()
    for _ in range(len(grads) - 2*f):
        i = krum_score(remaining, f)
        selected.append(remaining[i])
        remaining = np.delete(remaining, i, axis=0)
        if len(remaining) <= 2*f: break
    selected = np.array(selected)
    return np.median(selected, axis=0)  # simplified; full trims 2f extremes
```

```rust
// Secure aggregation mask sketch
fn prg_mask(seed: &[u8], len: usize) -> Vec<f32> {
    // simplified PRG via SHA256 chaining
    use sha2::{Sha256, Digest};
    let mut out = Vec::new();
    let mut cur = seed.to_vec();
    while out.len() < len {
        let mut hasher = Sha256::new();
        hasher.update(&cur);
        let h = hasher.finalize();
        out.extend(h.iter().map(|b| *b as f32 / 255.0));
        cur = h.to_vec();
    }
    out.truncate(len);
    out
}
```

```haskell
-- Robust coefficient kappa-star formalism (Allouah et al. 2024)
-- kappa* = inf kappa s.t. ||F - avg_H|| <= kappa * max_{i in H}||g_i - avg_H||
type Vector = [Double]
robustCoeff :: ([Vector] -> Vector) -> Double -> Double
robustCoeff agg delta = undefined
```

---

## 4 Deep Dive

### 4.1 Krum and Multi-Krum Geometry

Krum assigns score:

$$ S(i) = \sum_{j \in \mathcal{N}_i} \|g_i - g_j\|^2 $$

where N_i are n−f−2 nearest neighbors. The vector minimizing S(i) is selected. Intuition: honest gradients cluster within variance ball σ√d, Byzantine outliers far [1].

**Multi-Krum** averages top-m lowest scores, reducing variance by factor 1/m and improving convergence from O(1) to O(1/m) in benign case [6]. Allouah et al. [6] prove Multi-Krum is (α,f)-resilient with robustness coefficient:

$$ \kappa_{MultiKrum}(n,f,m) \le \kappa_{Krum} \cdot \sqrt{\frac{n-f-m}{m(n-f-1)}} $$

Thus Multi-Krum dominates Krum empirically and theoretically when m = n−f−2.

*Trade-offs:*

- **Pros:** No auxiliary data, O(n²d) feasible for n≈100, tolerates f < n/2.
- **Cons:** Fails under high heterogeneity where honest gradients distant; vulnerable to ALIE attack crafting gradients within variance envelope [5].

| Rule | Breakdown f | Complexity | Leeway | Non-IID Robustness |
|------|-------------|------------|--------|-------------------|
| Krum | (n-2)/2 | O(n²d) | Ω(√d) | Low |
| Multi-Krum | (n-2)/2 | O(n²d + md) | Ω(√d) | Medium |
| Bulyan | (n-3)/4 | O(n²d) | O(1/√d) | Low-Medium |
| Coord Median | (n-1)/2 | O(nd log n) | O(√d) | Medium |

> **Theorem (Multi-Krum optimality):** For optimal robustness coefficient κ★ defined as infimum error amplification over adversarial sets, Multi-Krum achieves κ ≤ 2κ★ under IID sub-Gaussian noise, tightening prior bound by factor 2 [6].

### 4.2 Bulyan: Strong Byzantine Resilience

Bulyan [2] addresses high-dimensional leeway by *two phases*:

1.  Iteratively run Krum (or any (α,f)-resilient GAR) n−2f times to obtain selection set S of size n−2f.
2.  For each coordinate k ∈ [1..d], compute median and trim 2f extremes from S, then average remaining θ = n−4f values.

This yields coordinate-wise guarantee:

$$ \|Bulyan(S)[k] - median_H[k]\| \le O(\frac{1}{\sqrt{d}}) \cdot \max_{i\in H} |g_i[k] - median_H[k]| $$

Empirically on CIFAR-10, Bulyan prevents attacker's shift to ineffective plateau while Krum still converges to 10% accuracy [2].

*Cost:* Requires n ≥ 4f+3, larger batch, and O(d log n) extra for sorting per dimension.

### 4.3 Coordinate-Wise Median and Trimmed Mean

Yin et al. [4] propose:

$$ \text{CM}[k] = \text{median}(g_1[k],...,g_n[k]), \quad \text{TM}[k] = \frac{1}{n-2\beta} \sum_{i=\beta+1}^{n-\beta} g_{(i)}[k] $$

Breakdown 50%, dimension-free but suffers curse of heterogeneity: under non-IID, honest medians biased, causing 16% accuracy drop [5]. DiverseFL mitigates by guiding updates via TEE enclave [5].

### 4.4 FLAME: Taming Backdoors

FLAME [3] targets *targeted* backdoor attacks where adversary embeds trigger pattern causing misclassification to attacker-chosen label while preserving main accuracy.

**Pipeline:**

1.  **Cosine clustering:** Compute pairwise cosine distance between normalized updates, run HDBSCAN (min_cluster_size = n/2+1) to isolate majority cluster.
2.  **Adaptive clipping:** Bound L₂ norm: Clip at S = median(‖W_i‖) — reduces scaling attack.
3.  **Noise calibration:** Estimate sufficient Gaussian noise σ = λ·S / ε where λ tuned to minimize ASR; inject before aggregation.

FLAME achieves <5% ASR on CIFAR-10, word prediction, IoT N-BaIoT datasets with <1% benign accuracy loss, vs 40-80% ASR for Krum alone against backdoors [3].

*Why Krum fails vs backdoors:* Backdoor gradients may be *close* in Euclidean distance to honest updates, evading distance filters, but separable in angular/cosine space [3][10].

### 4.5 Interplay with Secure Aggregation

The core conflict: secure aggregation hides x_i; Byzantine filtering needs x_i. Three reconciliation paths emerge:

**A. Homomorphic filtering** [8]: Bendoukha et al. train meta-classifiers on shadow updates reproducing Byzantine behaviors, performing encrypted inference over CKKS to score updates homomorphically, reweighting without decryption. Runtime 6-24s per round for n=20.

**B. ByzSFL with ZKPs** [9]: Offload weight computation to clients, prove correctness via zero-knowledge proofs for median/clipping operators. Achieves 100× speedup over pure HE, enables plaintext final model publication, but requires client-side proving overhead.

**C. Sharded secure aggregation + BRIEF** [10]: Segment model, cluster via pairwise adjusted cosine similarity securely via MPC, aggregate per cluster and route back. DBSCAN over encrypted similarities tolerates malicious majority of clients *or* servers under distinct trust thresholds, closing FLAME's honest-majority assumption gap.

*Formal incompatibility:*

$$ \text{SecAgg}(x_i) \implies I(Server; x_i | \sum x_i) = 0 $$
$$ \text{Krum}(x_i) \text{ requires } \|x_i - x_j\| \quad \forall i,j $$

Thus pure information-theoretic SecAgg cannot coexist with inspection without extra trust (TEE, threshold decryption, or client-side proofs).

```tla
---- MODULE FedByz ----
EXTENDS Naturals
VARIABLES round, honestSet, byzSet
TypeOK == honestSet \cup byzSet = 1..n /\ honestSet \cap byzSet = {}
Safety == \A i \in honestSet: |Agg - TrueGrad| <= kappa * maxDist
Liveness == \A r \in Nat: <>(round = r+1)
====
```

---

## 5 Empirical Evaluation and Proofs

### 5.1 Evaluation Protocol

We propose non-IID Dirichlet(α=0.1) CIFAR-10 with n=50, f=10 (20% Byzantine), model ResNet-18, following [5][8]. Attacks:

- Untargeted: *Gaussian noise* (σ=10), *IPM* (ε=0.5 scaling negative inner product), *ALIE* (z=0.5 std crafting within variance).
- Targeted: *Model replacement* (scale 20× backdoor), *DBA* (4-part trigger).

Metrics: Main Task Accuracy (MTA), Attack Success Rate (ASR), Robustness Coefficient empirical, wall-clock overhead.

**Expected results from literature:**

- Krum MTA 78% under no attack → 45% under ALIE (IID), 32% non-IID [5].
- Bulyan MTA 80% → 72% under ALIE, retains O(1/√d) bound [2].
- FLAME ASR <4% with MTA drop 0.8% vs 67% ASR for FedAvg [3].
- BRIEF ASR 0-5% with 0.8% MTA gap, communication overhead −67% to −89% after optimization [10].

### 5.2 Proofs Sketch

**Lemma 1 (Krum angular bound):** If 2f+2 < n and variance condition holds, sin α = η(n,f)√d σ / ‖g‖ <1 guarantees positive inner product.

*Proof* follows Blanchard et al. Proposition 2 bounding E‖KR − g‖² via closest honest neighbor concentration [1].

**Lemma 2 (Bulyan narrow leeway):** After n−2f selections, each coordinate's remaining extremes contain at most 2f Byzantine values; trimmed mean lies within honest convex hull expanded by O(1/√d).

*Proof* uses coordinate-wise median optimality and union bound over d dimensions [2].

**Theorem (Secure Aggregation vs Robustness Trade-off):** No protocol can achieve both information-theoretic SecAgg privacy and deterministic Byzantine filtering for f≥1 without additional assumptions (TEE, threshold homomorphic, or ZKP). Reduction to impossibility of private set intersection with distance predicate.

---

## 6 Limitations

- **Heterogeneity collapse:** All distance-based GARs degrade when honest clients are non-IID; guiding datasets or TEE enclaves leak privacy or require trust anchor [5]. DiverseFL's sample sharing once before training still exposes distribution.
- **High-dimensional curse:** O(n²d) pairwise distances prohibitive for LLMs (d>10⁹). Sketched Krum using Johnson-Lindenstrauss projection loses guarantees.
- **Adaptive adversaries:** ALIE and IPM bypass Krum/Bulyan by staying within variance ball; FLAME's HDBSCAN sensitive to cosine threshold; adaptive attacker can craft updates mimicking benign cluster density [3][5].
- **Cryptographic overhead:** Homomorphic filtering 6-26s per round, ZKP proving ~seconds per client, sharded MPC communication quadratic in clusters. Real-time FL (1000 rounds) infeasible on edge.
- **Decentralized asynchrony:** Most proofs assume synchronous rounds; asynchronous FL admits staleness that amplifies Byzantine impact [11]. Blockchain-based consensus (Krum Federated Chain) adds latency.
- **Privacy-robustness formal gap:** Rényi DP composition for FLAME noise vs SecAgg masking not jointly analyzed; DP noise may *help* attacker hide backdoor within noise floor.

Future work: *Learnable aggregation weights* [12] via meta-learning that adapts to heterogeneity, *spectral defenses* (SpectralKrum) projecting onto low-dimensional benign manifold, and *decentralized reputation* via verifiable random functions.

---

## 7 Conclusion

We unified Krum, Multi-Krum, Bulyan, coordinate-wise median, and FLAME under a common Byzantine-robust FL lens, quantifying breakdown points, leeway O(1/√d) vs Ω(√d), and robustness coefficients κ★. While Krum provides foundational (α,f)-resilience with minimal assumptions, Bulyan hardens high-dimensional vulnerability at cost of n≥4f+3, and FLAME addresses orthogonal backdoor threat via clustering-clipping-noising. The deeper challenge lies in reconciling these inspection-heavy defenses with secure aggregation's confidentiality: purely cryptographic masking precludes distance inspection, necessitating hybrid HE/ZKP/MPC designs that trade efficiency for auditable robustness. Empirical taxonomy suggests no single rule dominates; adaptive ensembles — e.g., FLAME clustering → Multi-Krum selection → Bulyan refinement → DP noising → sharded SecAgg — offer principled, layered defense. Open problems remain in non-IID optimality, asynchronous decentralized FL, and formal privacy-robustness composition, guiding next-generation resilient federated systems.

---

## References

[1] P. Blanchard, E. M. El Mhamdi, R. Guerraoui, J. Stainer. Machine Learning with Adversaries: Byzantine Tolerant Gradient Descent. NeurIPS 2017. https://proceedings.neurips.cc/paper/2017/file/f4b9ec30ad9f68f89b296397df84a562-Paper.pdf / https://arxiv.org/abs/1703.02757

[2] E. M. El Mhamdi, R. Guerraoui, S. Rouault. The Hidden Vulnerability of Distributed Learning in Byzantium. ICML 2018 (arXiv:1802.07927). https://arxiv.org/abs/1802.07927 / https://arxiv.org/abs/1802.07927v1

[3] T. D. Nguyen, P. Rieger, H. Chen, H. Yalame, H. Möllering, H. Fereidooni, S. Marchal, M. Miettinen, A. Mirhoseini, S. Zeitouni, F. Koushanfar, A.-R. Sadeghi, T. Schneider. FLAME: Taming Backdoors in Federated Learning. USENIX Security 2022 (arXiv:2101.02281v4). https://arxiv.org/abs/2101.02281v4 / https://www.usenix.org/conference/usenixsecurity22/presentation/nguyen

[4] D. Yin, Y. Chen, R. Kannan, P. Bartlett. Byzantine-Robust Distributed Learning: Towards Optimal Statistical Rates. ICML 2018 (arXiv:1803.01498). https://arxiv.org/abs/1803.01498

[5] Z. Wu, et al. An Experimental Study of Byzantine-Robust Aggregation Schemes in Federated Learning. arXiv:2302.07173. https://ar5iv.labs.arxiv.org/abs/2302.07173 / https://arxiv.org/abs/2302.07173

[6] A. Allouah, E. M. El Mhamdi, R. Guerraoui, et al. Byzantine Machine Learning: MultiKrum and an optimal notion of robustness. arXiv:2602.03899v1. https://arxiv.org/abs/2602.03899v1

[7] K. Bonawitz, V. Ivanov, B. Kreuter, et al. Practical Secure Aggregation for Privacy-Preserving Machine Learning. CCS 2017 (arXiv:1707.10159). https://arxiv.org/abs/1707.10159 / https://dl.acm.org/doi/10.1145/3133956.3133982

[8] A. A. Bendoukha, A. Boudguiga, N. Kaaniche, R. Sirdey, D. Demirag, S. Gambs. Robust Federated Learning via Byzantine Filtering over Encrypted Updates. arXiv:2602.05410v1. https://arxiv.org/abs/2602.05410v1

[9] S. Zhang, et al. ByzSFL: Achieving Byzantine-Robust Secure Federated Learning with Zero-Knowledge Proofs. arXiv:2501.06953v1. https://arxiv.org/abs/2501.06953v1

[10] L. Chen, et al. BRIEF but Powerful: Byzantine-Robust and Privacy-Preserving Federated Learning via Model Segmentation and Secure Clustering. arXiv:2208.10161v1. https://arxiv.org/abs/2208.10161v1

[11] D. Data, S. N. Diggavi. Byzantine-Resilient High-Dimensional SGD with Local Iterations on Heterogeneous Data. ICML 2021 / arXiv:2005.07866. https://arxiv.org/abs/2005.07866

[12] Z. Sun, et al. Byzantine-Robust Federated Learning with Learnable Aggregation Weights. arXiv:2311.03529. https://arxiv.org/pdf/2511.03529

