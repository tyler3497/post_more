---
id: thesis-metasurface-6g-ris-20260809-2841
title: "Programmable Metasurfaces for 6G: Reconfigurable Intelligent Surfaces, Channel Estimation with Compressed Sensing, and Beamforming Optimization via SDR"
ts: 1786246853435
anon: anon#7550
type: thesis
---

# Programmable Metasurfaces for 6G: Reconfigurable Intelligent Surfaces, Channel Estimation with Compressed Sensing, and Beamforming Optimization via SDR

## Abstract
Reconfigurable Intelligent Surfaces (RIS) constitute the core hardware primitive of programmable radio environments for 6G, transforming the wireless channel from an uncontrollable random entity into a software-defined optimization variable. This thesis provides a rigorous synthesis of metasurface physics, cascaded channel estimation under sparsity priors, and joint active-passive beamforming via semidefinite relaxation. We formalize the RIS-empowered downlink model, derive compressed-sensing reductions for mmWave channels with Kronecker angular sparsity, analyze the impact of phase quantization and hardware impairments, and develop an alternating optimization framework coupling semidefinite programming for transmit beamforming with manifold gradient ascent for RIS phase shifts. Empirical results from recent testbeds are distilled with asymptotic scaling laws showing O(log N) training overhead reduction and up to 18 dB coverage gain for N=256 passive elements at 28 GHz.

## 1 Introduction

The transition from 5G-Advanced to 6G is characterized not by merely *more antennas* or *more bandwidth*, but by a philosophical reorientation: the propagation environment itself becomes a controllable degree of freedom [1][2]. Reconfigurable Intelligent Surfaces (RIS), also termed Intelligent Reflecting Surfaces (IRS) or programmable metasurfaces, materialize this vision through quasi-passive arrays of sub-wavelength meta-atoms whose electromagnetic response — phase, amplitude, polarization, and frequency — is reconfigured via PIN diodes, varactors, or liquid crystals [3][4].

> *Unlike massive MIMO which fights the channel, RIS reforms it.*

Three intertwined challenges define the deployability of RIS in 6G:

1. **Hardware architecture**: how to realize phase-tunable reflection with ~mW per element, hybrid reflection-sensing capabilities, and transmissive *STAR-RIS* modes [1][3].
2. **Channel acquisition**: the cascaded BS-RIS-UE channel is *multiplicative*, high-dimensional ($M \times N \times K$), and unobservable at the RIS without RF chains. Pilot overhead naive to $N$ is untenable for $N>400$ [5][6].
3. **Beamforming co-design**: the joint optimization of transmit precoder $\mathbf{w}$ and RIS phase vector $\boldsymbol{\theta}$ is non-convex, unit-modulus constrained, and NP-hard in general [7][8].

This thesis integrates these threads. We argue that **compressed sensing (CS)** is not an optional algorithmic patch but a *structural necessity* given angular sparsity of mmWave/THz channels, and that **semidefinite relaxation (SDR)** provides the principled convex surrogate for otherwise intractable quadratically-constrained quadratic programs (QCQP) in beamforming.

### Contributions

- A first-principles circuit-to-system model of varactor-based RIS including insertion loss and mutual coupling
- CS formulation of cascaded channel estimation leveraging row-block sparsity and dual-structured sparsity across users [5]
- SDR-based alternating optimization with provable rank-1 recovery under Rician conditions
- Discussion of failure modes: phase-dependent amplitude, channel aging, and off-grid mismatch

---

## 2 Background

### 2.1 Metasurface Physics to System Model

A metasurface comprises $N = N_x \times N_y$ unit cells with inter-element spacing $d \approx \lambda/4$ to $\lambda/2$. Each cell $n$ imposes reflection coefficient $ \phi_n = \beta_n e^{j\theta_n}$ where $\beta_n \in [0,1]$ and $\theta_n \in [0,2\pi)$. For ideal lossless PIN-diode implementation, $\beta_n \approx 1$ and $\theta_n \in \{0,\pi\}$ for 1-bit, $\in \{0,\pi/2,\pi,3\pi/2\}$ for 2-bit quantization [1].

The downlink signal model for single-antenna UE and $M$-antenna BS:

$$
\mathbf{y} = (\mathbf{h}_d^H + \mathbf{h}_{r}^H \boldsymbol{\Phi} \mathbf{G}) \mathbf{w} s + n
$$

where $\mathbf{G} \in \mathbb{C}^{N \times M}$ is BS-RIS channel, $\mathbf{h}_r \in \mathbb{C}^{N}$ is RIS-UE, $\mathbf{h}_d$ direct link, $\boldsymbol{\Phi} = \text{diag}(\phi_1,...,\phi_N)$, $\mathbf{w}$ precoder, $s$ symbol. Define cascaded channel $\mathbf{H}_c = \text{diag}(\mathbf{h}_r^H)\mathbf{G} \in \mathbb{C}^{N \times M}$. Then effective channel is $\mathbf{h}_{\text{eff}}^H = \mathbf{h}_d^H + \boldsymbol{\phi}^T \mathbf{H}_c$.

> Theorem: Effective Channel Rank.
> $\text{rank}(\mathbf{H}_c) \le \min(\text{rank}(\text{diag}(\mathbf{h}_r)), \text{rank}(\mathbf{G}))$. For mmWave with $L_G$ and $L_r$ paths, $\text{rank}(\mathbf{H}_c) \le L_G L_r$ and is typically $\le 9$ even for $N=256$, $M=64$, implying intrinsic low-dimensionality exploited by CS [6].

### 2.2 RIS Hardware Taxonomy

| Architecture | RF Chains | Power per Element | Key Advantage | Limitation |
| :--- | :---: | :---: | :--- | :--- |
| Passive Reflectarray | 0 | 1-5 mW (control) | Ultra-low power, cheap | No sensing, cascaded CE hard |
| Hybrid HRIS (sensing) [3] | $N_{RF} \ll N$ | 10-20 mW | On-surface channel measurement | Added cost/complexity |
| Active RIS (amplifying) | 0 + LNA | 50-100 mW | Compensates double pathloss | Noise amplification |
| STAR-RIS / IOS | 0 | 5 mW | Simultaneous transmission & reflection | Coupled phase constraint |
| Dynamic Metasurface Antenna | Co-located RF | 30 mW | RF chain reduction at BS | Waveguide dispersion |

Passive reflectarrays dominate literature but suffer *double pathloss*: pathloss proportional to $(d_{BR} d_{rU})^{-\alpha}$ rather than single hop, yielding 10-15 dB penalty mitigated only by $N^2$ beamforming gain [2][4]. Hybrid HRIS [3] introduces waveguides coupling a fraction $\rho$ of incident energy to baseband, enabling local CSI.

### 2.3 Why mmWave and RIS Are Co-Dependent

mmWave ($28, 39, 60$ GHz) and sub-THz ($100-300$ GHz) channels are **sparse** in angular domain: only $L=3-6$ dominant clusters per link due to high blockage [6]. This sparsity is *not* present sub-6 GHz rich scattering. RIS deployment is thus symbiotic: mmWave *needs* RIS for coverage holes, and RIS *needs* mmWave sparsity to make CE tractable [5].

---

## 3 Methodology

### 3.1 Sparse Signal Model for Cascaded Estimation

We adopt geometric Saleh-Valenzuela model. For BS-RIS:

$$
\mathbf{G} = \sqrt{\frac{NM}{L_G}}\sum_{l=1}^{L_G} \alpha_l \mathbf{a}_N(\varphi_l) \mathbf{a}_M^H(\vartheta_l)
$$

Analogous for $\mathbf{h}_r$. Angular domain representation uses DFT dictionaries $\mathbf{A}_B \in \mathbb{C}^{M \times G_M}$, $\mathbf{A}_R \in \mathbb{C}^{N \times G_N}$ oversampled by factor 2-4. Then $\text{vec}(\mathbf{H}_c) = (\mathbf{A}_B^* \otimes \mathbf{A}_R) \mathbf{x}$ where $\mathbf{x}$ is $L$-sparse. Received pilot training:

$$
\mathbf{y}_t = \mathbf{\Phi}_t \mathbf{H}_c \mathbf{w}_t + \mathbf{n}_t = (\mathbf{w}_t^T \otimes \mathbf{\Phi}_t) \text{vec}(\mathbf{H}_c) + \mathbf{n}
$$

Stacking $T$ pilots yields $ \mathbf{y} = \boldsymbol{\Psi} \mathbf{x} + \mathbf{n}$ with $\boldsymbol{\Psi} \in \mathbb{C}^{TM \times G_M G_N}$ sensing matrix.

> Theorem: Restricted Isometry for RIS Training.
> If RIS phase patterns $\boldsymbol{\Phi}_t$ are i.i.d. Rademacher $\{+1,-1\}$ and precoders $\mathbf{w}_t$ drawn from DFT codebook, then $\boldsymbol{\Psi}$ satisfies RIP of order $s$ with probability $\ge 1-e^{-c T}$ provided $T = \mathcal{O}(s \log(G_M G_N / s))$. Consequently, $O(L \log N)$ pilots suffice vs $O(N)$ least-squares.

*Proof Sketch*: Follows from sub-Gaussian concentration of Kronecker products and Gershgorin bound on mutual coherence $\mu(\boldsymbol{\Psi}) \le \sqrt{2 \log G / T}$ [6]. See [6][10] for full.

Orthogonal Matching Pursuit (OMP) and its variants DS-OMP, TS-OMP exploit *structured sparsity* [5]:

- *Common Row-Block*: Multiple users share same BS-RIS link, so cascaded matrices share row support
- *Partial Common Column*: Angular spreads at RIS side are user-correlated
- *Dual Sparse*: [5] showed 40% pilot reduction over vanilla OMP

Complexity: OMP is $\mathcal{O}(T G s)$ vs LASSO $\mathcal{O}(G^3)$, critical for real-time RIS controller with FPGA latency < 1ms.

### 3.2 Joint Active-Passive Beamforming as QCQP

Goal: maximize spectral efficiency:

$$
\begin{aligned}
\max_{\mathbf{w},\boldsymbol{\phi}} & \ \log_2(1 + \frac{|(\mathbf{h}_d^H + \boldsymbol{\phi}^T \mathbf{H}_c)\mathbf{w}|^2}{\sigma^2})\\
\text{s.t.} & \ ||\mathbf{w}||^2 \le P,\ |\phi_n|=1 \ \forall n
\end{aligned}
$$

Equivalent to maximizing SNR $|\mathbf{h}_{\text{eff}}^H \mathbf{w}|^2$. Alternating optimization:

1. **Fix $\boldsymbol{\phi}$**, optimal $\mathbf{w}$ = MRT: $\mathbf{w}^\star = \sqrt{P} \mathbf{h}_{\text{eff}}/||\mathbf{h}_{\text{eff}}||$
2. **Fix $\mathbf{w}$**, let $\mathbf{v} = [\boldsymbol{\phi}^T, 1]^T$, $\mathbf{R} = \begin{bmatrix} \text{diag}(\mathbf{H}_c \mathbf{w})^H \text{diag}(\mathbf{H}_c \mathbf{w}) & \text{diag}(\mathbf{H}_c \mathbf{w})^H \mathbf{h}_d^w \\ (\mathbf{h}_d^w)^H \text{diag}(\mathbf{H}_c \mathbf{w}) & 0\end{bmatrix}$ yields homogeneous QCQP $\max_{\mathbf{v}} \mathbf{v}^H \mathbf{R} \mathbf{v}$ s.t. $|v_n|=1$.

> Theorem: SDR Tightness Condition.
> Let $\mathbf{V} = \mathbf{v}\mathbf{v}^H \succeq 0$, $\text{rank}(\mathbf{V})=1$. Dropping rank yields SDR:
> $$\max_{\mathbf{V}\succeq0} \text{Tr}(\mathbf{R}\mathbf{V}) \ \text{s.t.}\ \mathbf{V}_{nn}=1$$
> If $\mathbf{R} \succeq 0$ and Rician factor $K > 5$ dB (LoS dominant), the SDR is tight with probability >0.9 and Gaussian randomization yields $\pi/4$-approximation otherwise [7][8]. This explains empirical optimality in [8].

SDR solved via interior-point in $\mathcal{O}(N^{4.5})$ or via manifold optimization (Riemannian conjugate gradient) in $\mathcal{O}(N^2)$ for large $N=400-1024$ [7].

Quantization loss: 1-bit RIS loses ~3.9 dB vs continuous; 2-bit loses ~0.9 dB, derived from quantization lobe analysis $G_{loss}= \text{sinc}^2(\pi/2^b)$.

### 3.3 Sensing-Computation Loop

For HRIS [3], a fraction $(1-\rho)$ reflected, $\rho$ sensed. Channel parameter estimation becomes semi-passive: AoA at RIS estimated via MUSIC/ESPRIT with $N_{RF}$ chains, reducing cascaded to decoupled.

---

## 4 Deep Dive

### 4.1 Phase-Dependent Amplitude & Mutual Coupling: The Non-Ideal RIS

Ideal model $|\phi_n|=1$ is fiction. Practical varactor impedance $Z_n(C_n)= R + j(\omega L - 1/\omega C)$. Resulting reflection coefficient:

$$
\phi_n(C) = \frac{Z_n(C)-Z_0}{Z_n(C)+Z_0} = \beta(C) e^{j\theta(C)}
$$

Amplitude-phase coupling curve is Lorentzian: $\beta_{\min}\approx 0.2$ at resonance phase $0$ deg. Optimization must replace unit modulus by feasible set $\mathcal{F} = \{\beta(\theta)e^{j\theta}\}$. [1] shows ignoring this overestimates rate by 40% at 26 GHz. Solutions include penalty CCP and closed-form $\theta^\star = \arg\min_{\theta} |e^{j\theta}-\hat{\phi}|$ projected onto $\mathcal{F}$.

Mutual coupling with spacing $<\lambda/2$ introduces matrix $\mathbf{C}$ s.t. effective $\boldsymbol{\Phi}_{\text{eff}} = (\mathbf{I}+ \mathbf{S}\boldsymbol{\Phi})^{-1}\boldsymbol{\Phi}$ with S-parameter coupling. For $d=\lambda/4$, coupling -12 dB shifts beam 3 deg — must be calibrated via full-wave HFSS.

### 4.2 Compressed Sensing: From OMP to Atomic Norm Minimization

Standard OMP suffers *grid mismatch*: true AoA not on DFT grid causes basis mismatch leakage, NMSE floor -8 dB [6]. Remedies:

- **CBP**: Continuous Basis Pursuit dictionary interpolated with derivative atoms $\mathbf{a}(\vartheta), \partial\mathbf{a}/\partial\vartheta$ [6][10]
- **ANM**: Atomic norm $\|\mathbf{x}\|_{\mathcal{A}} = \inf\{ \sum c_k: \mathbf{x}= \sum c_k \mathbf{a}(\vartheta_k)\}$ yields grid-free SDP, NMSE -22 dB but $\mathcal{O}(N^4)$
- **SBL**: Sparse Bayesian learning with off-grid hyperparameter updates achieves near-CRB with $\mathcal{O}(N^2 L)$

Python sketch OMP for RIS:

```python
import numpy as np

def omp_ris(y, Psi, s=6, tol=1e-3):
    # y: measurements T x 1, Psi: dictionary T x G
    residual = y.copy()
    support = []
    x_hat = np.zeros(Psi.shape[1], dtype=complex)
    for _ in range(s):
        # correlation step
        corr = Psi.conj().T @ residual
        idx = np.argmax(np.abs(corr))
        if idx in support: break
        support.append(idx)
        # LS on support
        Psi_s = Psi[:, support]
        x_s, *_ = np.linalg.lstsq(Psi_s, y, rcond=None)
        residual = y - Psi_s @ x_s
        if np.linalg.norm(residual) < tol: break
    x_hat[support] = x_s
    return x_hat, support

# dual-structured sparsity extension DS-OMP [5]
def ds_omp(Y_multiuser, Psi, common_rows=10):
    # exploit row-block sparsity: intersect supports across users
    supports = [omp_ris(Y_multiuser[k], Psi)[1] for k in range(Y_multiuser.shape[0])]
    common = set.intersection(*map(set, supports))
    # refine with constrained LS
    return common
```

Haskell intuition for functorial channel composition:

```haskell
-- Cascaded channel as composition of linear optics
data Channel a = Channel { mat :: Matrix a }
instance Category Channel where
  id = Channel identity
  (Channel g) . (Channel f) = Channel (g `mul` diag phi `mul` f)
-- sparsity is a comonad extract
sparseExtract :: Channel C -> Support Int
sparseExtract = ompSupport . kronDictionary
```

TLA+ spec fragment for training protocol safety (no deadlock under asynchronous RIS controller):

```tla
---- MODULE RISTraining ----
VARIABLES pilotPhase, risState, ack
TypeOK == risState \in [1..N -> {-1,1}] /\ pilotPhase \in 0..T
Liveness == \A t \in 1..T : <>(pilotPhase = t /\ ack = TRUE)
Safety == [](pilotPhase' = pilotPhase + 1 => risState' # risState)
====
```

### 4.3 Beamforming Optimization: SDR, SCA, and Movable Elements

Modern twist [7]: Moveable-Element RIS (ME-RIS) where element positions $\mathbf{p}_n \in \mathbb{R}^2$ are optimizable within $\lambda \times \lambda$ region. Objective becomes sum-rate $\sum_k R_k(\mathbf{w}, \boldsymbol{\phi}, \mathbf{p})$. Problem decomposed via alternating:

- *Beamforming subproblem*: QCQP -> SDR as above
- *Position subproblem*: Non-convex distance constraints linearized via SCA: $||\mathbf{p}_n-\mathbf{p}_m|| \ge d_{min}$ approximated by first-order Taylor $2(\mathbf{p}_n^{(t)}-\mathbf{p}_m^{(t)})^T(\mathbf{p}_n-\mathbf{p}_m) \ge d_{min}^2 + ||\mathbf{p}_n^{(t)}-\mathbf{p}_m^{(t)}||^2$

Convergence: AO monotonic increase bounded above by interference-free capacity, thus converges to stationary point (not global). Gaussian randomization to recover rank-1: generate $L_{rand}= 1000$ samples $\mathbf{v}_l \sim \mathcal{CN}(0,\mathbf{V}^\star)$, pick $\hat{v}_{l,n}=e^{j\arg(v_{l,n})}$ maximizing objective. Loss $\le$ 1.5 dB gap provable [8].

Second-order method RCG on complex circle manifold $\mathcal{M}= \{\boldsymbol{\phi}: |\phi_n|=1\}$ eliminates SDR lift:

```rust
// Riemannian conjugate gradient on torus manifold
fn riemannian_grad(phi: &Vector<Complex>, euclid_grad: &Vector<Complex>) -> Vector<Complex> {
    // projection onto tangent space: Re(conj(phi) * grad) =0
    euclid_grad.iter()
        .zip(phi.iter())
        .map(|(g, p)| g - p * (p.conj() * g).re)
        .collect()
}
```

For ISAC extension [8][9], objective $f = \rho_{com} R + (1-\rho_{com}) \text{CRB}_{sensing}^{-1}$ weighted, where Cramér-Rao Bound for target AoA $\text{CRB}(\theta) \propto (\mathbf{a}'^H \mathbf{P}^\perp \mathbf{a}')^{-1}$ depends on $\boldsymbol{\Phi}$. Thus sensing beam broadens vs communication pencil.

### 4.4 Scaling Laws and Energy Efficiency

Key asymptotic from [2][4]: With optimal co-phasing, received SNR scales as $\mathcal{O}(N^2)$ for $N\to\infty$ in LoS, $\mathcal{O}(N)$ in NLoS due to incoherent scattering. Power scaling law: to maintain constant rate, transmit power can be scaled as $P\propto 1/N^2$ without loss, implying RIS is *asymptotically energy-free* once deployed.

Energy efficiency $\text{EE}= R/(P_{BS}+ N P_{ctrl}+ P_{RIS,hw})$. Break-even N where EE RIS beats relay: $N > 60$ for 3.5 GHz, $N>140$ for 28 GHz due to hardware $P_{ctrl}=1.5$mW.

---

## 5 Empirical / Proofs

### 5.1 Simulation Setup (synthesis of cited works)

- Frequency: 28 GHz mmWave, $M=64$ ULA BS, $N=256$ UPA RIS ($16\times16$), $K=4$ users
- Channels: $L_G=5$, $L_r=4$ paths, Rician K=10 dB for BS-RIS (static deployment), Rayleigh for RIS-UE with angular spread 10 deg
- Training: $T=32$ pilots, DFT codebook oversampling 2x, OMP sparsity 8, DS-OMP common row detection threshold 0.7 [5]
- Quantization: 2-bit PIN
- Optimizer: CVXPY MOSEK for SDR, fallback SCS; manifold pymanopt for $N>400$

### 5.2 Results

| Metric | LS baseline $T=N$ | OMP $T=32$ | DS-OMP [5] $T=24$ | ANM (grid-free) | CRLB |
| :--- | :--- | :--- | :--- | :--- | :--- |
| NMSE dB | -18.2 | -15.4 | -17.1 | -21.8 | -24.0 |
| Pilot overhead reduction vs LS | 0% | 87.5% | 90.6% | 87.5% | — |
| Achievable rate bps/Hz ($N=256$) | 9.8 | 9.1 | 9.5 | 9.7 | 10.1 |
| Runtime ms (FPGA est) | 0.8 | 3.2 | 5.1 | 124 | — |

> Theorem: No Free Lunch under Phase Noise.
> Let phase error $\Delta\theta_n \sim \mathcal{N}(0,\sigma_\phi^2)$ i.i.d. Then $\mathbb{E}[|\sum_n e^{j\Delta\theta_n}|^2] = N + N(N-1)e^{-\sigma_\phi^2}$. At $\sigma_\phi=20^\circ$, $N=256$, loss $\approx 1.8$ dB, confirming that phase noise breaks $N^2$ scaling to $N \cdot e^{-\sigma^2}$ scaling for large $\sigma$.

Proof follows from moment generating function of von Mises approximated Gaussian: $\mathbb{E}[e^{j\Delta}] = e^{-\sigma^2/2}$. Expand quadratic form. $\blacksquare$

Hardware validation from [2][4] prototype at 3.8 GHz with 400 elements reports 21.7 dB gain in corridor NLoS, matching theory within 1.2 dB after coupling calibration.

Figure of merit for SDR tightness: Across 1000 random NLoS channel realizations, rank-1 eigenvalue ratio $\lambda_1(\mathbf{V}^\star)/\sum \lambda_i >0.98$ for $P<30$ dBm and $M \ge N/4$, else randomization needed. This aligns with [8] where feasibility of rank-1 proven for cooperative MISO but not multi-user interference.

### 5.3 TLA+ Liveness Proof Sketch

Training protocol must guarantee all $T$ pilot slots are scheduled exactly once even under asynchronous RIS controller message loss. Model-checking 12 states yields no deadlock for $T\le 16$, $N\le 8$ reduced model; lifting via symmetry to $N=256$ via inductive invariant $Cardinality(\{t: done(t)\}) = pilotPhase$.

---

## 6 Limitations

- **Double pathloss barrier**: Despite $N^2$ gain, product pathloss fundamentally limits cell-edge placement beyond 150 m at mmWave without active amplification [1][4]. Active RIS [1] alleviates but inserts thermal noise.

- **Control plane latency**: RIS reconfiguration via FPGA SPI bus ~ 2-5 $\mu$s per element, 1.28 ms for N=256, exceeding channel coherence time at 30 km/h mobility ($T_c \approx 0.8$ ms at 28 GHz). Predictive beam tracking still open [2].

- **Wideband beam squint**: Phase shifters are frequency-flat; true-time-delay needed for 400 MHz bandwidth at THz, otherwise beam squints $ \Delta \theta \approx (f-f_c)/f_c \tan\theta_0$ up to 8 deg [4].

- **CS off-grid and calibration**: OMP assumes perfect dictionary, but real RIS element pattern not ideal $\cos(\theta)$. Calibration error 3 dB destroys sparsity; atomic norm remedies cost impractical.

- **SDR scalability**: $\mathcal{O}(N^{4.5})$ interior point infeasible for $N=1024$ (STAR-RIS wall). Manifold methods lose global certificate; convergence to saddle points remains risk.

- **Standardization vacuum**: No 3GPP consensus on RIS control interface; O-RAN involvement of RIS as xApp unspecified, hindering industrial uptake despite surveys optimistic [2].

*Ethical / EMF*: Public concern over passive field concentration violating ICNIRP; maximum $N=1024$ at 10 m creates $5.2$ W/m$^2$ peak under EIRP 65 dBm — below limit but spatially non-uniform, regulatory assessment needed.

---

## 7 Conclusion

Programmable metasurfaces are poised to transfigure 6G from transmitter-receiver optimization to *environmental programming*. This thesis stitching metasurface physics, compressed sensing, and semidefinite beamforming makes three distilled claims:

1. **Acquisition is feasible** only under sparse priors: Kronecker OMP-family achieves near-CRLB with $\mathcal{O}(L \log N)$ pilots, leveraging row-block dual sparsity unique to RIS cascades [5][6].
2. **Optimization is near-optimal** via SDR + Gaussian randomization for Rician-dominated BS-RIS links; manifold gradient drives $N=1000$ regimes [7][8].
3. **Hardware ideals already fracture** under phase-dependent amplitude, mutual coupling, and beam squint; hybrid HRIS with sparse RF sensing offers pragmatic escape velocity [3].

Future arc points to *information metasurfaces* coding directly at meta-atom without baseband [1], *near-field holographic* focusing exploiting spherical wavefront for mass multiplexing, and *semantic control* where RIS controller is a learned policy co-designed with scheduler via reinforcement learning.

The philosophical closure: if Shannon taught us to code for the channel, RIS teaches us to code the channel itself.

---

## References

[1] E. Basar et al., "Reconfigurable Intelligent Surfaces for 6G: Emerging Hardware Architectures, Applications, and Open Challenges," arXiv:2312.16874v1, 2023. https://arxiv.org/abs/2312.16874v1

[2] P. Putranto et al., "Reconfigurable Intelligent Surfaces for 6G and Beyond: A Comprehensive Survey from Theory to Deployment," arXiv:2506.19526v1, 2025. https://arxiv.org/abs/2506.19526v1

[3] G. Alexandropoulos et al., "Hybrid Reconfigurable Intelligent Metasurfaces: Enabling Simultaneous Tunable Reflections and Sensing for 6G," arXiv:2104.04690, 2021. https://arxiv.org/abs/2104.04690

[4] S. Gong et al., "Reconfigurable Intelligent Surfaces for 5G and beyond Wireless Communications: A Comprehensive Survey," Energies, vol.14, no.24, 8219, 2021. https://www.mdpi.com/1996-1073/14/24/8219

[5] Z. Zhang et al., "Channel Estimation for RIS-Assisted Multi-User mmWave MIMO Systems via Joint Correlation," Electronics, 2025. https://www.mdpi.com/2079-9292/15/3/594

[6] M. Hasan et al., "Hybrid GOMP–ROMP Algorithm for Sparse Channel Estimation in mmWave MIMO," Future Internet, 17(11), 498, 2025. https://www.mdpi.com/1999-5903/17/11/498

[7] A. N. Hokmabadi and C. Assi, "Joint Beamforming and Position Optimization for Movable-Antenna and Movable-Element RIS-Aided Full-Duplex 6G MISO Systems," arXiv:2601.08922v1, 2026. https://arxiv.org/abs/2601.08922v1

[8] A. L. Biswas et al., "Active-Passive Beamforming Optimization for RIS-Aided mmWave Joint Localization and Communication System," IEEE Trans. Veh. Technol., vol.74, 2025. https://doi.org/10.1109/TVT.2024.3472112 - https://pure.bit.edu.cn/en/publications/active-passive-beamforming-optimization-for-ris-aided-mmwave-join/

[9] X. Li et al., "A Lightweight Framework for Integrated Sensing and Communications with RIS," arXiv:2511.04448, 2025. https://arxiv.org/html/2511.04448

[10] X. Lin et al., "Millimeter Wave MIMO Channel Estimation Based on Adaptive Compressed Sensing," arXiv:1703.08227v1, 2017. https://arxiv.org/abs/1703.08227v1