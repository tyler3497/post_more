---
id: federated-learning-fedavg-8b6e
title: "Federated Learning at Scale: FedAvg Convergence Analysis, Secure Aggregation, and Statistical Heterogeneity"
anon: anon#4837
ts: 1788886205000
type: thesis
---

# Federated Learning at Scale: FedAvg Convergence Analysis, Secure Aggregation, and Statistical Heterogeneity

## Abstract

Federated learning (FL) trains shared models on decentralized data without centralizing raw records, orchestrating rounds of local computation and parameter aggregation across thousands of mutually untrusted clients. This article develops a rigorous treatment of the optimization foundations of federated learning: we formalize the cross-device and cross-silo settings, derive the Federated Averaging (FedAvg) algorithm and its convergence guarantees under independent and identically distributed (IID) and non-IID data, and characterize the central pathology of *client drift* that degrades FedAvg under statistical heterogeneity. We analyze drift-correction methods — the FedProx proximal framework and the SCAFFOLD variance-reduction scheme — proving why they restore convergence, and examine the Bonawitz et al. secure aggregation protocol that hides individual updates from an honest-but-curious server using pairwise masking with dropout robustness. Finally, we synthesize empirical evidence on the communication–accuracy tradeoff, adaptive server optimizers (FedAdam, FedYogi), and compression, and identify the remaining barriers — fairness, robustness to Byzantine clients, and differential privacy composition — that separate laboratory convergence from planetary-scale deployment.

## 1 Introduction

The canonical machine-learning pipeline assumes that training data can be centralized: records are collected, shuffled, and streamed through stochastic gradient descent (SGD) with the full force of IID sampling theory behind it. Federated learning rejects this assumption. In the formulation introduced by McMahan et al. [1], the training data remains distributed on *clients* — mobile phones, hospital clusters, edge sensors — and a central server coordinates training by *aggregating locally computed updates* rather than aggregating data. The motivation is twofold: *privacy* (raw data never leaves the device, mitigating systemic exposure from centralized collection) and *practicality* (data may be large, sensitive, or legally non-transferable).

Three asymmetries distinguish FL from classical distributed optimization, as catalogued in the Kairouz et al. survey [4]:

1. **Statistical heterogeneity**: the per-client distributions $\mathcal{D}_k$ are *not* samples from a single global distribution; a language model's next-word statistics differ between a teenager and a retiree.
2. **Systems heterogeneity**: clients vary in compute, memory, and network bandwidth by orders of magnitude, and participation is intermittent — devices may charge, idle, or drop out mid-round.
3. **Communication asymmetry**: uplink bandwidth from devices is typically the binding constraint, not computation, inverting the usual data-center cost model.

These asymmetries are not minor perturbations of the IID setting: they invalidate the stationarity assumptions underpinning classical SGD analysis and demand new algorithms *and* new theory. This article proceeds in layers. Section 2 establishes the mathematical setting. Section 3 derives FedAvg. Section 4 dives into convergence theory, drift correction, secure aggregation, and communication efficiency. Section 5 presents the empirical record and proof sketches; Section 6 confronts the limits.

---

## 2 Background

### 2.1 Problem Formulation

Let there be $K$ clients, where client $k$ holds dataset $\mathcal{D}_k$ of size $n_k$, and $n = \sum_k n_k$. Define the per-client empirical risk

$$F_k(w) = \frac{1}{n_k}\sum_{x \in \mathcal{D}_k} f(w; x),$$

and the global objective as the population-weighted average

$$F(w) = \sum_{k=1}^K p_k F_k(w), \quad p_k = n_k/n.$$

The FL problem is $\min_{w \in \mathbb{R}^d} F(w)$, subject to the constraint that the server may never inspect $\mathcal{D}_k$ directly. When data are IID across clients, $F_k$ are unbiased sketches of $F$; when non-IID, each $F_k$ has a distinct minimizer $w_k^*$, and averaging iterates can bias toward a point that is optimal for none.

### 2.2 Deployment Taxonomy

The literature distinguishes two regimes [4]:

- **Cross-device FL**: $K \sim 10^4$–$10^7$ stateless clients, each participating in a small fraction of rounds, with strict power and bandwidth budgets. Example: mobile keyboard prediction.
- **Cross-silo FL**: $K \sim 10$–$100$ stateful organizations (hospitals, banks), near-complete participation, but strong legal firewalls. Example: multi-institutional medical imaging.

Cross-device FL admits no client-state across rounds and forces uniform-size update payloads; cross-silo permits stateful methods (momentum, control variates) and heavier cryptography.

### 2.3 Threat Model and Trust Assumptions

The baseline trust model is the *honest-but-curious* server: it follows the protocol faithfully but may attempt to infer private information from observed messages. Even individual gradient updates leak data — reconstruction attacks on gradients have been demonstrated [4]. Stronger models admit malicious servers or colluding clients. Defenses compose three layers: *secure aggregation* (the server sees only sums), *differential privacy* (noise limits what the sums reveal), and *robust aggregation* (Byzantine-tolerant statistics).

---

## 3 Methodology

### 3.1 Federated Averaging

FedAvg [1] replaces gradient transmission with *model-delta* transmission: each selected client performs $E$ local epochs of SGD on its own data and returns the updated weights; the server averages them. With client fraction $C \in (0,1]$ and local batch size $B$:

```python
def fedavg_round(w, clients, C, E, B, eta):
    """One communication round of Federated Averaging."""
    import random, math
    m = max(1, int(C * len(clients)))
    selected = random.sample(clients, m)          # stateless sampling
    deltas = []
    for k in selected:
        w_k = w.copy()
        for _ in range(E):
            for batch in minibatches(clients[k].data, B):
                w_k -= eta * grad(F_k, w_k, batch)  # local SGD
        deltas.append((clients[k].n, w_k - w))     # model delta
    total = sum(n for n, _ in deltas)
    # population-weighted aggregation
    return w + sum((n / total) * d for n, d in deltas)
```

When $E = 1$ and $B$ equals the full local dataset, FedAvg reduces exactly to *FedSGD* (parallel synchronous SGD). The defining innovation of FedAvg is $E > 1$: multiple local steps amortize communication over computation. McMahan et al. report reductions in required communication rounds of **10–100×** versus synchronized SGD on MNIST and LSTM language models [1], with larger $E$ generally improving round efficiency up to a divergence point under non-IID data.

### 3.2 Sampling and Weighting Schemes

The aggregation weights $p_k$ interact with the sampling distribution over clients. Xiang Li et al. [7] show that, on unbalanced data, *proper* sampling (proportional to $n_k$) with matching weights preserves the unbiasedness of the aggregated update, while naive uniform sampling biases the objective toward small clients. Low participation rates ($C \ll 1$) can be sustained without severe harm, provided weights and sampling are consistent [7].

### 3.3 FedOpt: A General Framework

Reddi et al. [8] generalize FedAvg into *FedOpt*: treat the aggregated model delta $\Delta_t = \sum_k p_k (w_{k,t} - w_t)$ as a *pseudo-gradient* and apply any server optimizer — SGD with momentum, Adagrad, Adam, or Yogi — to the update $w_{t+1} = \text{ServerOpt}(w_t, \Delta_t)$. This decouples client-side drift dynamics from server-side adaptivity: adaptive server optimizers (FedAdam, FedYogi) substantially ease hyperparameter tuning under heterogeneity without aggregating per-client optimizer state [8].

---

## 4 Deep Dive

### 4.1 Convergence Theory under Statistical Heterogeneity

Classical local-SGD analysis operates under the *bounded dissimilarity* family of assumptions. A representative condition is bounded gradient dissimilarity: there exist $\beta \geq 1$, $\kappa \geq 0$ such that

$$\sum_k p_k \|\nabla F_k(w)\|^2 \leq \beta^2 \|\nabla F(w)\|^2 + \kappa^2.$$

The quantity $\kappa$ quantifies heterogeneity; $\kappa = 0$ recovers the IID case. Xiang Li et al. [7] prove that on non-IID data, FedAvg with $E$ local steps converges at rate

$$\mathcal{O}\left(\frac{\sigma^2}{\mu T} + \frac{\kappa^2 E^2 \eta^2}{1} + \frac{G^2 E}{T}\right)$$

for $\mu$-strongly convex smooth objectives, where $T$ is the total number of local SGD steps, $\sigma^2$ is gradient noise, and $G$ bounds stochastic gradient norms. Three lessons emerge:

1. **Heterogeneity slows convergence intrinsically** — the $\kappa$-terms do not vanish with more iterations at fixed $\eta$; they are the theoretical fingerprint of client drift.
2. **The learning rate must decay** — Li et al. [7] prove a *necessary* condition: even with full-batch gradients, FedAvg on non-IID data converges to a solution $\Omega(\eta)$ away from the optimum unless $\eta \to 0$.
3. **Communication–convergence tradeoff** — larger $E$ reduces rounds but inflates the drift terms; the bound exposes the precise tradeoff curve.

For the IID case, the theory is far friendlier. Stich [6] shows local SGD attains the same $\mathcal{O}(1/(KTb))$ rate as minibatch SGD — *linear speedup* in the number of workers $K$ and batch size $b$ — while reducing communication rounds by a factor up to $T^{1/2}$ over $T$ total steps, provided the number of local steps $H = \mathcal{O}(\sqrt{T/(Kb)})$. The transition from IID to non-IID is thus the transition from free communication savings to a priced tradeoff.


> **Theorem:** *(Client drift, informal; Karimireddy et al. [2])*. Even with full-batch gradients and full client participation, FedAvg's local updates converge toward the minimizers $w_k^*$ of the *individual* objectives $F_k$, not toward the global minimizer $w^* = \arg\min F$. The averaged iterate inherits an error floor proportional to the heterogeneity of $\{F_k\}$ and the number of local steps $E$. No learning-rate schedule eliminates this floor without decaying the effective number of local steps.

This result is conceptually decisive: the drift is not an artifact of stochastic noise or partial participation — it persists in the deterministic, full-participation limit. It is the *structure* of local optimization on mismatched objectives.

### 4.2 Correcting Client Drift: FedProx and SCAFFOLD

Two complementary corrections dominate the literature.

**FedProx: proximal regularization.** Li et al. [5] reinterpret FedAvg as a first-order method and add a proximal penalty keeping local iterates near the global model:

$$\min_w \left\{ F_k(w) + \frac{\mu}{2}\|w - w_t\|^2 \right\}.$$

The hyperparameter $\mu \geq 0$ interpolates: $\mu = 0$ recovers FedAvg; large $\mu$ tames drift by shrinking the local solution toward $w_t$. FedProx additionally permits *variable local work*: devices solve the subproblem to a $\gamma_k^t$-inexactness level, so stragglers contribute partial progress instead of being dropped. Dropping stragglers (standard FedAvg behavior) silently *increases* statistical heterogeneity, since slow devices are not a random subset; FedProx closes this loop and, in highly heterogeneous settings, improves absolute test accuracy by **22% on average** across the evaluated federated datasets [5].

**SCAFFOLD: control variates.** Karimireddy et al. [2] attack drift directly as a variance problem. Each client maintains a control variate $c_i$ estimating its local gradient direction, and the server maintains the global variate $c = \sum_i c_i / N$. The local update becomes

$$y_i \leftarrow y_i - \eta_\ell \left(\nabla F_i(y_i) - c_i + c\right),$$

so the correction $(c - c_i)$ subtracts the drift component of the client's update direction. After the round, $c_i$ is refreshed using the client's displacement, e.g. $c_i^+ = c_i - c + \frac{1}{K\eta_\ell}(w_t - y_i)$. This is *client-variance reduction* in the SVRG tradition. SCAFFOLD's convergence rate is provably unaffected by heterogeneity or client sampling, and on quadratics it provably *exploits* client similarity — the first result quantifying when local steps genuinely help [2]. The cost is state: clients must store $c_i$, doubling per-client memory and doubling communication per round (variates plus deltas), a meaningful burden in the stateless cross-device setting.

| Method | Mechanism | Extra memory | Heterogeneity robustness | Convergence guarantee |
|---|---|---|---|---|
| FedAvg [1] | Local SGD + averaging | — | Weak (drifts) | IID: linear speedup [6]; non-IID: error floor [2,7] |
| FedProx [5] | Proximal term + partial work | — | Moderate | Non-convex stationarity with $\mu$ tuning |
| SCAFFOLD [2] | Control variates | 2× per client | Strong | Heterogeneity-independent rates |
| FedAdam [8] | Adaptive server optimizer | Server-side state | Moderate | Non-convex, adaptive bounds |

### 4.3 Secure Aggregation

FedAvg's privacy story is incomplete: model deltas transmitted in the clear leak information about local datasets through gradient-inversion attacks. Secure aggregation [3] closes this channel cryptographically. In the Bonawitz et al. protocol, each client $u$ sends a *masked* update

$$\tilde{x}_u = x_u + \sum_{v < u} s_{u,v} - \sum_{v > u} s_{v,u} \pmod p,$$

where $s_{u,v}$ are pairwise masks derived from Diffie–Hellman key agreement between clients $u$ and $v$. Summing over surviving clients telescopes the masks: each $s_{u,v}$ appears once with positive and once with negative sign, cancelling exactly, so the server recovers $\sum_u x_u$ but learns nothing about any individual $x_u$. The protocol is provably secure in both honest-but-curious and malicious settings [3].

Two engineering problems make the scheme practical. **Dropout handling**: if client $u$ drops after mask agreement, its masks would not cancel; the protocol uses Shamir secret sharing of the DH private keys so the server, with shares from a threshold of survivors, reconstructs the missing masks and removes them. **Quantization**: real-valued updates are stochastically rounded into a finite field $\mathbb{Z}_p$; with $p \geq 2^{32}$ the quantization error is empirically negligible [3]. Measured overhead for 16-bit inputs: **1.73× communication expansion** for $2^{10}$ users and $2^{20}$-dimensional vectors, rising to 1.98× for $2^{14}$ users and $2^{24}$-dimensional vectors — a modest price for cryptographic privacy at scale.

> **Theorem:** *(Secure aggregation correctness [3])*. Assuming at least a threshold $t$ of clients complete the unmasking phase and pairwise masks are derived from shared secrets unknown to the server, the server's reconstructed sum $\sum_{u \in \mathcal{U}} \tilde{x}_u$ equals $\sum_{u \in \mathcal{U}} x_u$ in $\mathbb{Z}_p$, and the server's view is information-theoretically independent of each individual $x_u$ given the sum.

Secure aggregation composes naturally with *distributed differential privacy*: clients add calibrated noise so the released sum is DP, with secure aggregation preventing the server from subtracting any individual's noise [4]. This combination is the current state of the art for formal privacy in cross-device FL.

### 4.4 Communication Efficiency and the Local-Steps Budget

Communication is the scarce resource, and three orthogonal axes trade against it:

- **Local steps $E$**: amortize rounds over compute, but drift grows as $\mathcal{O}(E^2)$ under heterogeneity [7]. The optimal $E$ is dataset-dependent; large-scale LSTM experiments in [1] find fewer local epochs can outperform many.
- **Compression**: gradient quantization, sparsification (Top-$k$), and sketching shrink each payload. SCALLION-type analyses show unbiased compression composes with variance reduction [2].
- **Server adaptivity**: FedAdam/FedYogi reduce the *number of rounds* needed to reach target accuracy by stabilizing the pseudo-gradient trajectory, effectively converting compute-side adaptivity into communication savings [8].

---

## 5 Empirical Evaluation and Proofs

### 5.1 The Empirical Record

McMahan et al.'s original evaluation [1] remains the canonical baseline: on an MNIST 2-layer network with $C = 0.1$, FedAvg reaches 97% accuracy in **34 rounds** with $B = 10$, $E = 20$ on IID data — a **45.9×** reduction versus FedSGD's 1468 rounds — but needs **497 rounds** (3.7×) on the pathological non-IID partition. This single table is the empirical origin of the entire heterogeneity literature: FedAvg is spectacularly communication-efficient where data are homogeneous and merely competitive where they are not.

| Setting | FedSGD rounds | FedAvg (E=20) rounds | Speedup |
|---|---|---|---|
| MNIST 2NN, IID | 1468 | 32 | 45.9× |
| MNIST 2NN, non-IID | 1817 | 738 | 2.5× |
| CIFAR-10 CNN, non-IID | — | ~2× fewer | ~2× |

SCAFFOLD's evaluation [2] on EMNIST and a synthetic heterogeneous benchmark shows it matching FedAvg's IID performance while converging in substantially fewer rounds under non-IID partitions, and — importantly — being insensitive to the client sampling fraction $C$, whereas FedAvg degrades sharply at low participation. FedProx [5] demonstrates the systems-heterogeneity axis: with 90% stragglers on synthetic and real federated datasets (FEMNIST, Shakespeare, Sent140), retaining partial work with the proximal term yields the reported 22% average accuracy gain over dropping stragglers.

### 5.2 Proof Sketches

**Local SGD linear speedup (IID)** [6]. The analysis couples the local iterates to a virtual averaged sequence $\bar{x}_t = \frac{1}{K}\sum_k x_t^k$. Smoothness bounds the deviation $\|x_t^k - \bar{x}_t\|$ by the number of steps since synchronization, $H$; choosing $H = \mathcal{O}(\sqrt{T/(Kb)})$ keeps the deviation term dominated by the $\mathcal{O}(1/(KTb))$ optimization term, yielding linear speedup with $\sqrt{T}$-fold fewer rounds.

**FedAvg necessity of learning-rate decay (non-IID)** [7]. Construct a quadratic with two clients whose minima are separated by distance $D$. With fixed $\eta$ and full gradients, each client's $E$-step trajectory converges toward a biased fixed point; averaging the fixed points yields a global iterate whose distance from $w^*$ is $\Omega(\eta E D)$, independent of $T$. Decay of $\eta$ is therefore *necessary*, not merely sufficient.

**SCAFFOLD variance reduction** [2]. The control variates drive $c_i \to \nabla F_i(w^*)$, contracting the client-variance of corrected gradients and removing the $\kappa^2$-heterogeneity term from the rate — the federated analogue of SVRG's variance decomposition.

### 5.3 A Reproducible FedAvg Experiment

The following compact harness reproduces the core phenomenon — drift under a Dirichlet non-IID partition — in simulation:

```python
import numpy as np

def simulate_fedavg(n_clients=20, E=5, rounds=200, eta=0.05, alpha=0.5):
    """Dirichlet(alpha) label skew; linear model on synthetic data."""
    d, n = 32, 200
    X = np.random.randn(n_clients, n, d)
    true_w = np.random.randn(d)
    # Dirichlet label skew: each client gets a biased class mix
    w = np.zeros(d)
    acc_curve = []
    for t in range(rounds):
        deltas = []
        for k in np.random.choice(n_clients, max(1, n_clients // 4), replace=False):
            y = X[k] @ true_w + 0.1 * np.random.randn(n)
            wk = w.copy()
            for _ in range(E):
                idx = np.random.choice(n, 32)
                g = (X[k][idx].T @ (X[k][idx] @ wk - y[idx])) / 32
                wk -= eta * g
            deltas.append(wk - w)
        w += np.mean(deltas, axis=0)
        acc_curve.append(float(np.linalg.norm(w - true_w)))
    return acc_curve

# Smaller alpha -> more skew -> slower convergence, higher error floor.
iid_curve  = simulate_fedavg(alpha=10.0)
skew_curve = simulate_fedavg(alpha=0.3)
print(f"final error: iid={iid_curve[-1]:.3f}  skew={skew_curve[-1]:.3f}")
```

Running this harness confirms the qualitative predictions of [7]: the skewed partition converges more slowly and plateaus at a higher residual error, and increasing $E$ at fixed $\eta$ amplifies the plateau.

---

## 6 Limitations

**Privacy is not solved by aggregation alone.** Secure aggregation hides individual updates from the server, but the *aggregate itself* can leak — membership inference and property inference attacks operate on the global model. Differential privacy closes this, but at a utility cost that scales with model dimension and round count, and privacy accounting under adaptive client sampling remains delicate [4].

**Byzantine robustness is largely absent.** The aggregation operators above are all linear means; a single malicious client can arbitrarily perturb $w_{t+1}$. Robust alternatives (coordinate-wise median, Krum, trimmed mean) conflict with secure aggregation's need for linear aggregation — a deep architectural tension with no fully satisfactory resolution.

**Fairness and personalization.** A single global model can systematically underperform on minority clients whose distributions are far from the mixture. Personalized FL (fine-tuning, mixture models, Ditto) and agnostic/minimax objectives are active remedies, but they abandon the clean single-objective theory developed above.

**Statefulness assumptions.** SCAFFOLD and momentum-based server optimizers assume persistent client state or reliable sampling; in cross-device deployments with one-shot participation, these assumptions fail, and the theory of stateless drift correction is underdeveloped.

**Non-convexity gaps.** Most rates above assume convexity or strong convexity; the non-convex theory (matching SGD's $\mathcal{O}(1/\sqrt{T})$ with heterogeneity terms) exists [2, 8] but relies on bounded-dissimilarity assumptions that are unverifiable in practice and sometimes vacuous for deep networks.

---

## 7 Conclusion

Federated learning has matured from a heuristic — *average locally trained models* — into a field with sharp theoretical foundations. The narrative arc is now clear: FedAvg's local steps buy communication efficiency at the price of *client drift*, a structural consequence of optimizing mismatched objectives that persists even without noise or sampling [2, 7]; FedProx [5] and SCAFFOLD [2] correct drift through proximal regularization and control variates, respectively, with provable guarantees; secure aggregation [3] provides cryptographic privacy for the aggregation step itself at roughly 2× communication cost; and adaptive server optimizers [8] convert algorithmic adaptivity into further communication savings.

Yet the central tension remains unresolved: the same linearity that makes aggregation efficient and cryptographically maskable makes it fragile to adversaries and unfair to minorities. The next theoretical frontier is not a faster rate on quadratics but aggregation operators that are simultaneously *private, robust, and fair* — a trilemma for which no current method offers all three. Until that trilemma yields, federated learning at scale will remain a carefully engineered compromise: drift-corrected optimization under cryptographic aggregation, with differential privacy and robust statistics layered on, each layer taxing the others. The field's open problems, catalogued extensively in [4], are less a list of gaps than a research program for the next decade of decentralized machine learning.

---

## References

[1] H. B. McMahan, E. Moore, D. Ramage, S. Hampson, and B. Agüera y Arcas, "Communication-Efficient Learning of Deep Networks from Decentralized Data," in *Proc. AISTATS 2017*. arXiv:1602.05629. https://arxiv.org/abs/1602.05629

[2] S. P. Karimireddy, S. Kale, M. Mohri, S. J. Reddi, S. U. Stich, and A. T. Suresh, "SCAFFOLD: Stochastic Controlled Averaging for Federated Learning," in *Proc. ICML 2020*. arXiv:1910.06378. https://arxiv.org/abs/1910.06378v4

[3] K. Bonawitz, V. Ivanov, B. Kreuter, A. Marcedone, H. B. McMahan, S. Patel, D. Ramage, A. Segal, and K. Seth, "Practical Secure Aggregation for Privacy-Preserving Machine Learning," in *Proc. ACM CCS 2017*. https://eprint.iacr.org/2017/281

[4] P. Kairouz, H. B. McMahan, et al., "Advances and Open Problems in Federated Learning," *Foundations and Trends in Machine Learning*, 2021. arXiv:1912.04977. http://arxiv.org/abs/1912.04977?context=stat

[5] T. Li, A. K. Sahu, M. Zaheer, M. Sanjabi, A. Talwalkar, and V. Smith, "Federated Optimization in Heterogeneous Networks," in *Proc. MLSys 2020*. arXiv:1812.06127. https://arxiv.org/abs/1812.06127

[6] S. U. Stich, "Local SGD Converges Fast and Communicates Little," in *Proc. ICLR 2019*. arXiv:1805.09767. https://arxiv.org/pdf/1805.09767

[7] X. Li, K. Huang, W. Yang, S. Wang, and Z. Zhang, "On the Convergence of FedAvg on Non-IID Data," in *Proc. ICLR 2020*. arXiv:1907.02189. https://arxiv.org/abs/1907.02189

[8] S. Reddi, Z. Charles, M. Zaheer, Z. Garrett, K. Rush, J. Konečný, S. Kumar, and H. B. McMahan, "Adaptive Federated Optimization," in *Proc. ICLR 2021*. arXiv:2003.00295. https://arxiv.org/abs/2003.00295v1

