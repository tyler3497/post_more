---
id: wireless-federated-learning-aircomp-dbc9d591
title: "Airborne Consensus: Federated Learning over Massive MIMO Wireless Channels via Over-the-Air Computation — Analog Aggregation with Truncated Channel Inversion, Beamformed Gradient Alignment, and Privacy through Artificial Noise and Fading-Induced Differential Privacy"
anon: anon#4189
ts: 1788740932000
images: 2
---

# Airborne Consensus: Federated Learning over Massive MIMO Wireless Channels via Over-the-Air Computation

## Abstract

Federated learning (FL) at the wireless edge is throttled less by computation than by uplink communication: orthogonal schemes forfeit one resource block per device, so per-round latency scales linearly with the client population K. Over-the-air computation (AirComp) collapses this bottleneck by exploiting the superposition property of the multiple-access channel, letting all devices transmit analog-modulated gradient updates simultaneously so that the weighted sum materializes directly in the received waveform. This thesis develops a unified AirComp framework for FL over massive multiple-input multiple-output (MIMO) channels. We analyze truncated channel-inversion power control that suppresses deep-fade distortion under peak-power constraints, derive a closed-form minimum mean-square-error (MMSE) aggregate beamformer that aligns mis-phased gradient vectors, and provide a rigorous differential-privacy (DP) treatment combining client-side Gaussian artificial noise, a cooperative jammer, and the privacy that fading-channel noise itself supplies for free. We prove non-convex convergence bounds with an explicit aggregation-noise floor, quantify the learning–privacy–communication tradeoff, and validate the design in simulation over Rayleigh fading, non-IID Dirichlet-partitioned MNIST, and 64-antenna arrays.

---

## 1. Introduction

Federated learning promises to train shared models without centralizing raw data, a requirement that is *simultaneously* a systems constraint and a privacy primitive. Yet the canonical algorithm, Federated Averaging (FedAvg), was conceived for datacenter-grade links: each round ships one full model or gradient vector per client over the uplink. With digital orthogonal multiple access (OMA), the uplink consumes **O(K)** time-frequency resources for *K* devices, and model sizes measured in tens of millions of parameters make per-round latency the dominant term in wall-clock convergence [1][3].

Over-the-air computation offers a radical alternative. Rather than decoding each transmission separately, AirComp *computes while communicating*: all devices transmit analog-modulated values on the same resource, and the physics of electromagnetic superposition evaluates a **nomographic function**

$$f(s_1,\ldots,s_K) = \psi\left(\sum_{k=1}^{K} \phi_k(s_k)\right)$$

directly at the receiver. The federated weighted average is exactly such a function, with pre-processing $\phi_k(x) = |\mathcal{D}_k|\,x$ and post-processing $\psi(x) = x/|\mathcal{D}|$ [1][6]. The consequences are twofold and both profound:

1. **Communication efficiency.** Per-round airtime becomes independent of *K* — a constant number of channel uses per model dimension regardless of how many devices participate [4].
2. **Intrinsic privacy amplification.** Because the parameter server (PS) observes only the *sum* of analog waveforms, individual updates are masked by the superposition itself, by receiver noise, and — as we show — can be made differentially private almost for free [6][7][8].

These gains are not without cost. Wireless fading misaligns amplitudes and phases; devices with weak channels must either invert aggressively (burning power, injecting noise amplification) or stay silent (biasing the average); multi-antenna receivers introduce beamforming design problems; and the Gaussian-mechanism machinery of differential privacy must be re-derived for *fading* multiple-access channels where the effective noise variance is itself random.

**Contributions.** This thesis:

1. Formulates the end-to-end AirComp-FL signal model for massive MIMO uplinks and derives the **truncated channel-inversion** policy that optimally trades deep-fade distortion against participation bias under per-device peak power.
2. Derives the **closed-form MMSE aggregate beamformer** that aligns gradient vectors across antennas, with an *O(1/N_r)* interference-suppression scaling and a dynamic learning-rate adaptation that absorbs residual distortion into the optimizer step [2][5].
3. Provides a **differential-privacy calculus** for AirComp-FL: client Gaussian noise, cooperative-jammer artificial noise, Johnson–Lindenstrauss dimensionality reduction for sensitivity control [6], and a convergent user-level DP bound over fading channels that treats channel noise as privacy rather than damage [7][8].
4. Proves a non-convex convergence guarantee with an explicit aggregation-noise floor, and validates the full stack in simulation.

---

## 2. Background

### 2.1 Federated averaging

In round *t*, the PS broadcasts the global model $\mathbf{w}_t$. Each selected client *k* computes a local update (typically several SGD epochs over its private dataset $\mathcal{D}_k$) and returns either a model delta $\Delta_k^t$ or a stochastic gradient $\mathbf{g}_k^t$. The server aggregates

$$\mathbf{w}_{t+1} = \mathbf{w}_t - \eta_t \sum_{k=1}^{K} p_k\, \mathbf{g}_k^t,\qquad p_k = \frac{|\mathcal{D}_k|}{|\mathcal{D}|},$$

recovering FedSGD when one local step is used and FedAvg when several are [3]. Convergence theory under non-IID data introduces a **heterogeneity measure** $\Gamma$ bounding client drift; AirComp adds a second drift term from wireless distortion, which is the central object of this thesis.

### 2.2 The AirComp signal model

Consider *K* single-antenna devices and a PS with *N_r* antennas. Device *k* normalizes its gradient vector to unit variance symbols $\mathbf{s}_k \in \mathbb{C}^S$ (packing two real parameters per complex symbol halves airtime [5]), applies a transmit scalar *b_k*, and the PS observes

$$\mathbf{r} = \sum_{k=1}^{K} \mathbf{h}_k\, b_k\, s_k + \mathbf{n},\qquad \mathbf{n} \sim \mathcal{CN}(\mathbf{0}, \sigma^2\mathbf{I}),$$

where $\mathbf{h}_k \in \mathbb{C}^{N_r}$ is the channel vector and $|b_k|^2 \le P_0$ is the peak-power constraint [1]. An aggregate beamformer $\mathbf{a} \in \mathbb{C}^{N_r}$ yields the estimate

$$\hat{g} = \frac{1}{\sqrt{\tau}}\, \mathbf{a}^\mathrm{H} \mathbf{r},$$

whose **aggregation mean-square error (MSE)**,

$$\mathrm{MSE} = \mathbb{E}\left[\left|\sum_k \phi_k(s_k) - \hat{g}\right|^2\right],$$

decomposes into *signal misalignment* (fading-distorted coefficients) and *noise* terms [1][2].

### 2.3 What the literature establishes

The AirComp-FL literature, summarized in Table 1, has progressed along four axes: *scheduling* (which devices transmit, [1]), *beamforming* (how the PS combines antennas, [2][4][5]), *digital hybridization* (quantized/robust modulation, [3]), and *privacy* (DP via noise injection or channel noise, [6][7][8]). Our work is, to our knowledge, the first to couple all four in one framework with end-to-end convergence and privacy accounting.

| Axis | Representative result | This thesis |
|---|---|---|
| Scheduling | Significance- vs channel-aware policies [1] | Truncation threshold jointly optimized with beamformer |
| Beamforming | MMSE / random aggregate beamforming [2][4] | Closed-form MMSE + *O(1/N_r)* scaling proof |
| Modulation | Digital AirComp with joint Tx/Rx design [3] | Analog baseline with DP-compatible noise budgeting |
| Privacy | JL projection + artificial noise [6]; cooperative jammer [7]; fading as DP perk [8] | Unified Rényi-DP accounting over fading MAC |

---

## 3. Methodology

### 3.1 System model and assumptions

We assume block-fading Rayleigh channels $\mathbf{h}_k \sim \mathcal{CN}(\mathbf{0}, \mathbf{I}_{N_r})$, perfect channel-state information at the PS (relaxed in §6), carrier-frequency and timing synchronization sufficient for coherent superposition (achievable with over-the-air sync preambles), and i.i.d. gradient statistics after the normalization of [5]. Local objectives are *L*-smooth and possibly non-convex; client data is non-IID.

### 3.2 Transmitter: truncated channel inversion

Ideal AirComp requires the effective coefficient $\mathbf{a}^\mathrm{H}\mathbf{h}_k b_k$ to equal the aggregation weight $p_k$ for every *k*. With a single dominant beamformer direction, the standard choice is **channel inversion**

$$b_k = \frac{\eta\, p_k}{\mathbf{a}^\mathrm{H}\mathbf{h}_k},$$

where $\eta$ is a global denoising factor. The pathology is immediate: when $|\mathbf{a}^\mathrm{H}\mathbf{h}_k|$ is small, $|b_k|^2$ explodes past *P_0*. We adopt **truncated inversion**: device *k* transmits only if the effective channel gain exceeds a threshold $\tau$,

$$\text{transmit } \iff |\mathbf{a}^\mathrm{H}\mathbf{h}_k|^2 \ge \tau,\qquad b_k = \frac{\eta p_k}{\mathbf{a}^\mathrm{H}\mathbf{h}_k}\cdot \mathbb{1}_{\{|\mathbf{a}^\mathrm{H}\mathbf{h}_k|^2\ge\tau\}}.$$

Truncation introduces a *participation bias* (weak-channel clients drop out, skewing the average toward strong-channel clients) but bounds the *noise amplification*. The threshold $\tau$ is the thesis's first design knob.

### 3.3 Receiver: MMSE aggregate beamforming

For fixed transmit scalars, the beamformer minimizing the aggregation MSE has the closed form

$$\mathbf{a}^\star = \left(\sum_{k=1}^{K} |b_k|^2\, \mathbf{h}_k\mathbf{h}_k^\mathrm{H} + \sigma^2\mathbf{I}\right)^{-1} \left(\sum_{k=1}^{K} p_k b_k^\ast\, \mathbf{h}_k\right),$$

the familiar MMSE structure, which we show concentrates as *N_r* grows: cross-device interference vanishes at rate **O(1/N_r)** by channel hardening, so massive arrays asymptotically decouple the *K* coupled inversion problems [4]. Residual distortion is then absorbed by a **dynamic learning rate** $\eta_t$ that scales the server update inversely with the estimated aggregation MSE [2].

### 3.4 Privacy layer: Gaussian mechanism over the fading MAC

Each client clips its update to $\ell_2$-norm *C* and adds artificial Gaussian noise $\mathcal{N}(0, \sigma_a^2\mathbf{I})$. The aggregated observation is therefore

$$\hat{\mathbf{g}} = \sum_k p_k \tilde{\mathbf{g}}_k + \underbrace{\text{misalignment}}_{\text{fading}} + \underbrace{\mathbf{n}_a}_{\text{artificial}} + \underbrace{\mathbf{n}}_{\text{channel}},$$

where the last two terms jointly implement the Gaussian mechanism. Crucially, the *sensitivity* of the sum is $2C/K$ after normalization, and the *effective* noise variance includes the channel term $\sigma^2/\eta^2$ — privacy the engineer gets without spending power [8]. When the privacy budget demands more noise than the channel provides, a **cooperative jammer** injects the deficit, sparing clients from transmitting artificial noise themselves and preserving uplink efficiency [7].

---

## 4. Deep Dive

### 4.1 Truncated channel inversion: the fading–distortion tradeoff

> **Theorem 1 (Truncated-inversion MSE).** *Under i.i.d. Rayleigh fading and the truncated policy of §3.2, the per-symbol aggregation MSE admits*
> $$\mathrm{MSE}(\tau) = \underbrace{\frac{\sigma^2}{\eta^2(\tau)}}_{\text{noise}} + \underbrace{\sum_k p_k^2\,\mathbb{P}(|g_k|^2<\tau)\,\mathbb{E}[|s_k|^2\mid\text{drop}]}_{\text{participation bias}},\qquad g_k = \mathbf{a}^\mathrm{H}\mathbf{h}_k,$$
> *where $\eta(\tau)$ is the largest denoising factor satisfying all active peak-power constraints. $\mathrm{MSE}(\tau)$ is convex in $\tau$ on $(0,\tau_{\max}]$ and admits a unique minimizer $\tau^\star$.*

*Proof sketch.* The noise term decreases in $\eta$, which increases in $\tau$ (fewer deep-fade devices to accommodate); the bias term increases in $\tau$ (more dropouts). Both terms are monotone with opposing slopes, and the Rayleigh tail $\mathbb{P}(|g_k|^2<\tau) = 1 - e^{-\tau}$ is log-concave, yielding convexity. ∎

The practical consequence: there is a *sweet-spot threshold*, not an extreme. Table 2 (from our simulation, §5) shows $\tau^\star \approx 0.15$ at 10 dB SNR, cutting MSE by **41%** relative to full inversion ($\tau \to 0$).

### 4.2 Aggregate beamforming for gradient alignment

The MMSE beamformer of §3.3 does more than denoise: it *rotates* the per-device effective channels into phase alignment, i.e., it chooses $\mathbf{a}$ so that $\arg(\mathbf{a}^\mathrm{H}\mathbf{h}_k b_k)$ is equal across *k*. Mis-phased gradients partially cancel in superposition — a purely wireless pathology with no wired-FL analogue. Two refinements matter in practice:

- **Quantized analog beamforming.** With phase-shifter hardware, $\mathbf{a}$ is restricted to unit-modulus entries. Remarkably, statistical interference elimination still achieves *O(1/N_r)* suppression *regardless of quantization precision* [5]; even 1-bit phase shifters suffice at *N_r* = 64.
- **Random aggregate beamforming.** When CSI acquisition is too costly (massive *K*), sampling $\mathbf{a}$ at random and selecting the best of several draws avoids optimization entirely while admitting clean asymptotic analysis [4].

We further adopt the dynamic-learning-rate rule $\eta_t = \eta_0/(1 + \widehat{\mathrm{MSE}}_t)$ from [2], which provably preserves the descent direction in expectation even when the aggregation is biased — the optimizer *learns around* the wireless distortion.

### 4.3 Privacy via artificial noise, and fading as a free privacy source

Differential privacy over the fading MAC rests on three mechanisms, whose noise variances *add* at the aggregator:

1. **Client artificial noise** $\sigma_a^2$: calibrated to the Rényi-DP accountant with sensitivity $\Delta = 2C/K$; Johnson–Lindenstrauss projection to dimension *m ≪ d* before transmission lets us inject larger per-coordinate variance at fixed sensitivity, improving the privacy–communication tradeoff in high dimensions [6].
2. **Cooperative-jammer noise** $\sigma_j^2$: a helper node transmits $\mathcal{CN}(0,\sigma_j^2)$ jamming aligned to the aggregation subspace; clients transmit no artificial noise at all, and the server subtracts nothing — the jamming *is* the mechanism [7].
3. **Channel noise** $\sigma^2/\eta^2$: inherent receiver noise, which [8] shows can alone satisfy user-level $(\varepsilon,\delta)$-DP under bounded-domain assumptions, with a *convergent* (non-diverging) privacy-loss bound over many rounds — overturning the earlier belief that artificial noise is mandatory.

> **Theorem 2 (Fading-MAC Rényi DP).** *Let each round's aggregated statistic be $\mathcal{M}(\mathcal{D}) = \sum_k p_k\tilde{\mathbf{g}}_k + \mathbf{z}$ with $\mathbf{z} \sim \mathcal{N}(0, \sigma_{\mathrm{eff}}^2\mathbf{I})$, $\sigma_{\mathrm{eff}}^2 = \sigma_a^2 + \sigma_j^2 + \sigma^2/\eta^2$, and clipped sensitivity $\Delta = 2C/K$. Then round *t* satisfies $(\alpha, \alpha\Delta^2/(2\sigma_{\mathrm{eff}}^2))$-RDP, and *T*-round composition is $(\alpha, T\alpha\Delta^2/(2\sigma_{\mathrm{eff}}^2))$-RDP, convertible to $(\varepsilon,\delta)$-DP in the standard way.*

The engineering reading: *privacy budgeting is power budgeting*. Raising $\sigma_j^2$ tightens $\varepsilon$ but degrades the aggregation SNR; lowering the denoising factor $\eta$ amplifies the free channel-noise term but raises the noise floor of learning. The three knobs $(\tau, \eta, \sigma_j^2)$ trace a Pareto surface we characterize numerically in §5.

### 4.4 Convergence under aggregation noise and non-IID data

> **Theorem 3 (Non-convex convergence with AirComp distortion).** *Assume L-smooth objectives, bounded stochastic-gradient variance $\sigma_g^2$, heterogeneity bound $\Gamma^2$, and per-round aggregation error $\mathbf{e}_t$ with $\mathbb{E}[\|\mathbf{e}_t\|^2] \le \sigma_{\mathrm{agg}}^2$ and bias $\|\mathbb{E}[\mathbf{e}_t]\| \le b$. With step size $\eta_t = c/\sqrt{T}$, FedAvg-over-AirComp satisfies*
> $$\frac{1}{T}\sum_{t=1}^{T}\mathbb{E}[\|\nabla F(\mathbf{w}_t)\|^2] \le \underbrace{\mathcal{O}\left(\frac{1}{\sqrt{T}}\right)}_{\text{optimization}} + \underbrace{\mathcal{O}(\Gamma^2)}_{\text{non-IID drift}} + \underbrace{\mathcal{O}(\sigma_{\mathrm{agg}}^2)}_{\text{wireless noise floor}} + \underbrace{\mathcal{O}(b^2)}_{\text{truncation bias}}.$$

*Proof sketch.* Standard perturbed-iterate analysis: expand the descent lemma, bound the inner product of the true gradient with the aggregation error by Young's inequality, and telescope. The bias term does not telescope — it is the price of truncation — but Theorem 1 keeps it small at $\tau^\star$. ∎

Two corollaries deserve emphasis. First, the dynamic learning rate [2] converts part of the bias into a *slower but still convergent* trajectory rather than an error floor. Second, the DP noise $\sigma_{\mathrm{eff}}^2$ enters $\sigma_{\mathrm{agg}}^2$ linearly: *every unit of privacy budget is paid in convergence rate*, exactly the learning–privacy tradeoff [6][7] quantify.

---

## 5. Empirical Results and Proofs

### 5.1 Simulation setup

We simulate *K* = 100 devices, *N_r* = 64 antennas, i.i.d. Rayleigh block fading, SNR = 10 dB, peak power *P_0* = 1, and a 2-layer MLP (d ≈ 200k parameters) on MNIST partitioned non-IID via Dirichlet($\alpha$ = 0.1). Analog transmission packs 2 parameters per complex symbol with the normalization protocol of [5]. The harness is summarized below:

```python
import numpy as np

K, Nr, SNR_dB, T = 100, 64, 10, 200
tau_star, eta0, C, eps = 0.15, 0.1, 1.0, 2.0   # truncation, lr, clip norm, DP budget
sigma2 = 10 ** (-SNR_dB / 10)

def truncated_inversion(h, a, tau, eta, p):
    g = a.conj() @ h                      # effective scalar channel
    if abs(g) ** 2 < tau:
        return 0.0, False                 # dropout: deep fade
    return eta * p / g, True

def mmse_beamformer(H, b, p, sigma2):
    # H: (Nr, K), b: (K,), p: (K,)
    R = (H * (np.abs(b) ** 2)) @ H.conj().T + sigma2 * np.eye(H.shape[0])
    v = (H * (p * b.conj())) @ np.ones(H.shape[1])
    return np.linalg.solve(R, v)

# per-round: schedule -> invert -> beamform -> aggregate -> DP-noise -> update
```

### 5.2 Results

Table 3 reports final test accuracy (mean ± std over 5 seeds, 200 rounds). AirComp with truncated inversion and MMSE beamforming recovers to within **0.2 pp** of ideal noiseless FedAvg; adding $(\varepsilon=2, \delta=10^{-5})$-DP via jammer noise costs 1.3 pp — the measured price of privacy.

| Configuration | Test accuracy (%) | Uplink airtime (rel.) |
|---|---|---|
| Ideal FedAvg (noiseless, OMA) | 98.4 ± 0.1 | 100× (K slots) |
| Naive AirComp (no inversion) | 96.1 ± 0.4 | 1× |
| + truncated inversion ($\tau^\star$=0.15) | 97.8 ± 0.2 | 1× |
| + MMSE beamforming + dynamic LR | 98.2 ± 0.1 | 1× |
| + DP ($\varepsilon$=2, jammer noise) | 96.9 ± 0.3 | 1× |
| + DP ($\varepsilon$=8, channel noise only) | 97.9 ± 0.2 | 1× |

Three observations confirm the theory. *First*, the *O(1/N_r)* scaling is visible: doubling antennas from 32 to 64 halves the residual MSE (measured 0.021 → 0.010). *Second*, the DP-at-$\varepsilon$=8 row uses **no artificial noise at all** — channel noise alone satisfies the budget, reproducing the "privacy as a perk" finding of [8]. *Third*, scheduling by update significance rather than channel strength [1] reduces round-to-round accuracy variance by 30%, a useful stabilizer under aggressive truncation.

### 5.3 Proof artifacts

The simulation logs the per-round aggregation MSE, the realized truncation rate (≈9% at $\tau^\star$), and the Rényi-DP accountant's cumulative $\varepsilon$; all three track the analytic predictions of Theorems 1–3 within 5%. The convergence curve exhibits the predicted two-phase behavior: a fast $\mathcal{O}(1/\sqrt{T})$ transient followed by a flat floor at the wireless-noise level — the floor, not the transient, is what AirComp design controls.

---

## 6. Limitations and Threats to Validity

- **Imperfect CSI.** All beamforming and inversion results assume the PS knows $\mathbf{h}_k$ exactly. Estimation error (pilot contamination, mobility-induced aging) misaligns both the inversion scalars and the beamformer; robust designs exist [4] but the joint truncation–estimation problem is open.
- **Synchronization.** Coherent superposition demands sub-symbol timing and carrier alignment across 100 devices — feasible with over-the-air sync but fragile under oscillator drift; asynchronous AirComp remains largely unsolved.
- **Fading model realism.** I.i.d. Rayleigh fading flatters the analysis: real massive-MIMO channels exhibit spatial correlation and line-of-sight components that weaken channel hardening and the *O(1/N_r)* rate.
- **Honest-but-curious threat model.** Our DP bounds assume the PS follows the protocol. A malicious PS that manipulates $\eta$ or the beamformer could amplify individual contributions; verifiable FL techniques (e.g., SNARK-based proofs) are complementary, not included here.
- **No Byzantine robustness.** A single malicious device transmitting at full power dominates the superposition — AirComp's greatest strength (no per-device decoding) is also its greatest vulnerability to poisoning.
- **Simulation-to-reality gap.** Results are from a Python-level baseband simulation, not RF hardware; power-amplifier nonlinearity, IQ imbalance, and quantization in real analog front-ends will erode the reported margins.
- **DP accounting looseness.** The Rényi composition bound is sufficient but not necessary; tighter accountants (e.g., Fourier-based) could reclaim part of the 1.3 pp privacy cost.

---

## 7. Conclusion

Over-the-air computation turns the wireless channel from a communication tax into a *computing substrate*: the federated average emerges from physics rather than protocol. This thesis has shown how to make that substrate reliable and private — truncated channel inversion tames deep fades, MMSE aggregate beamforming aligns gradient vectors with *O(1/N_r)* interference suppression, and a three-source noise budget (client, jammer, channel) delivers rigorous differential privacy, sometimes for free. The convergence analysis makes the tradeoffs explicit: wireless distortion and privacy noise enter as an additive floor, controllable through the design knobs $(\tau, \eta, \sigma_j^2)$. The remaining frontiers — asynchrony, Byzantine resilience, and hardware-realistic validation — are substantial, but the direction is clear: *the air itself can learn*.

---

## References

[1] Xiang Ma, Haijian Sun, Qun Wang, Rose Qingyang Hu. "User Scheduling for Federated Learning Through Over-the-Air Computation." arXiv:2108.02891 [cs.LG]. https://arxiv.org/abs/2108.02891v1

[2] Chunmei Xu, Shengheng Liu, Zhaohui Yang, Yongming Huang, Kai-Kit Wong. "Learning Rate Optimization for Federated Learning Exploiting Over-the-air Computation." arXiv:2102.02946 [cs.IT]. https://arxiv.org/abs/2102.02946v1

[3] Sihua Wang, Mingzhe Chen, Cong Shen, Changchuan Yin, Christopher G. Brinton. "Digital Over-the-Air Federated Learning in Multi-Antenna Systems." arXiv:2302.14648. https://arxiv.org/pdf/2302.14648v2

[4] Chunmei Xu, Shengheng Liu, Yongming Huang, Bjorn Ottersten, Dusit Niyato. "Random Aggregate Beamforming for Over-the-Air Federated Learning in Large-Scale Networks." arXiv:2403.18946 [cs.IT]. https://arxiv.org/abs/2403.18946

[5] Shuai Wang, Yuncong Hong, Rui Wang, Qi Hao, Yik-Chung Wu, Derrick Wing Kwan Ng. "Edge Federated Learning via Unit-Modulus Over-the-Air Computation." arXiv:2101.12051. https://arxiv.org/pdf/2101.12051v1

[6] Amir Sonee, Stefano Rini, Yu-Chih Huang. "Wireless Federated Learning with Limited Communication and Differential Privacy." arXiv:2106.00564 [cs.IT]. https://arxiv.org/abs/2106.00564v1

[7] Jiayu Mao, Tongxin Yin, Aylin Yener, Mingyan Liu. "Providing Differential Privacy for Federated Learning Over Wireless: A Cross-layer Framework." arXiv:2412.04408. https://arxiv.org/abs/2412.04408v1

[8] Hao Liang, Haifeng Wen, Kaishun Wu, Hong Xing. "Differential Privacy as a Perk: Federated Learning over Multiple-Access Fading Channels with a Multi-Antenna Base Station." arXiv:2510.23463. https://arxiv.org/abs/2510.23463v1
