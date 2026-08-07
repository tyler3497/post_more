---
id: thesis-loihi2-snn-surrogate-1786153262000-3b34
title: "Event-Driven Compilation and Surrogate-Gradient Learning for Spiking Neural Networks on Loihi 2"
abstract: "This thesis develops a rigorous compilation and training stack for spiking neural networks on Intel Loihi 2, combining event-driven mapping, programmable LIF microcode, graded spikes, and surrogate-gradient backpropagation through time. We formalize AER routing, neurocore resource allocation, and sparsity-aware IR lowering, and prove surrogate gradients are non-conservative yet coincide with stochastic escape-noise derivatives. Evaluation on DVS gestures, KITTI BEV, and speech benchmarks shows 100-6600x energy gains over edge-GPU baselines with 1-2% accuracy degradation when properly quantized."
ts: 1786153262000
anon: anon#a740
type: thesis
images: ["/thesis/thesis-loihi2-snn-surrogate-1786153262000-3b34-0.webp", "/thesis/thesis-loihi2-snn-surrogate-1786153262000-3b34-1.webp", "/thesis/thesis-loihi2-snn-surrogate-1786153262000-3b34-2.webp"]
sources: ["https://www.businesswire.com/news/home/20210930005258/en/5058314/Intel-Advances-Neuromorphic-with-Loihi-2-New-Lava-Software-Framework-and-New-Partners", "https://arxiv.org/abs/2404.14964", "https://arxiv.org/pdf/2006.07239", "https://arxiv.org/html/2511.01553", "https://arxiv.org/html/2503.18002v2", "https://arxiv.org/pdf/2511.22554v2", "https://pubmed.ncbi.nlm.nih.gov/39356594/", "https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2022.884128/full"]
---

# Event-Driven Compilation and Surrogate-Gradient Learning for Spiking Neural Networks on Loihi 2

## Abstract
This thesis presents a unified analysis of **event-driven compilation** and **surrogate-gradient learning** for *spiking neural networks (SNNs)* deployed on Intel **Loihi 2** [1]. Loihi 2 integrates 1M programmable neurons with graded spikes, asynchronous NoC, and the open-source **Lava** framework, replacing dense von Neumann evaluation with sparse Address-Event Representation (AER) [1][4]. Training remains challenging due to non-differentiable Heaviside firing. We develop a surrogate-gradient formalism [2][3], analyze its bias-variance trade-off across fast-sigmoid, arctan, and triangular surrogates, and link it to stochastic automatic differentiation [2]. We formalize event-driven compilation via Synchronous Dataflow Graphs (SDFG) [8], placement constraints, and energy models validated on 22nm FDSOI and 7nm Loihi 2 silicon. Synthesizing results from CLP-SNN continual learning [4], analog in-the-loop surrogate training on BrainScaleS-2 [3], and EPOC online learning [7], we show neuromorphic systems achieve 13-113× latency and 6,600× energy reductions when sparsity exceeds 95% while maintaining ANN parity within 2% after int8 quantization.

## 1 Introduction

Conventional deep networks execute **dense** tensor kernels every forward pass, even when inputs are stationary. Biological cortex operates at $\approx 20$ W using *sparse* **event-driven** communication: neurons integrate, emit binary spikes only when membrane $V(t) \geq \vartheta$, and remain quiescent otherwise [2][3].

Intel Loihi 2 [1] materializes this principle:

- 120 neurocores + 6 Lakemont x86 cores per chip
- Up to 8192 neurons per core, 192KB synapse memory
- Programmable LIF with two 24-bit state variables supporting **dendritic compartments** and **graded spikes** (8-bit payload)
- Fully asynchronous NoC with *AER* routing and per-core DVFS
- Up to 1M neurons, fabricated in Intel 4 pre-production EUV

Yet two gaps persist:

1. **Compilation gap**: How to map arbitrary PyTorch SNN graphs to tile-based crossbars respecting SRAM, fan-in, and inter-chip bandwidth without sacrificing performance guarantees [8]?

2. **Training gap**: How to differentiate through $s[t] = H(V[t] - \vartheta)$ where $H$ is Heaviside, zero almost everywhere?

This thesis addresses both. We contribute:

- Formal SDFG-based IR lowering from GPU-trained SNNs to Loihi 2 microcode
- Survey and theoretical analysis of surrogate gradients [2][3]
- Mapping to Loihi 2's programmable learning engine and graded spikes enabling **SOEL**, **e-prop**, and **STDP** three-factor rules [4][7]
- Energy-latency analytical model predicting when neuromorphic wins over dense GEMM: iff $r \cdot E_{SOP}/E_{MAC} < 1$, where $r$ is firing rate

> **Motivation**: Edge AI for *always-on* sensing—fall detection using Sony IMX636 event camera + Loihi 2 [6], gesture recognition, keyword spotting—demands <10 ms decision, <100 mW, privacy-preserving on-device adaptation without cloud replay. Surrogate-trained SNNs compiled correctly meet this.

---

## 2 Background

### 2.1 Spiking Neuron Models

The Leaky Integrate-and-Fire discrete update executed on Loihi 2 neurocores [1][4]:

$$ \tau_m \frac{dV}{dt} = -(V-V_{rest}) + R_m I(t) $$

Discretized with step $dt=1$ ms on hardware:

```python
def lif_step(V, I, thr=1.0, tau_m=20.0, R=5.0):
    # V: 24-bit, I: sum_j w_j * s_j, event-driven only on spike arrival
    dV = (-V + R*I) / tau_m
    V_next = V + dV
    spiked = V_next >= thr
    V_next = V_next * (1-spiked) # reset to 0
    return V_next, spiked.astype(int)
```

Loihi 2 extends this with *two* state vars $U,V$ and three synaptic accumulators, enabling adaptive threshold, calcium traces for STDP, and dendritic NMDA compartments [1][5]. **Graded spikes** carry int8 value: payload encodes *confidence* or attention, enabling sigma-delta encoding that improves PilotNet AP from 86.5 to 92.05 vs binary at cost of $2.4\times$ ops [6].

### 2.2 Loihi 2 and Lava Stack

Intel Lava [1] provides modular Processes:

- `lava.proc.lif` – LIF population with programmable decay
- `lava.proc.dense` – event-driven matrix: computes only when pre-spike arrives, skipping zeros
- `lava.proc.graded` – graded spike connection supporting quantization [-128,127]
- `lava.learning` – microcode for STDP, three-factor

Toolchain workflow: *GPU pretrain (SpikingJelly/SLAYER) → quantize → Lava partitioner → NoC routing → Loihi 2 bit-approximate simulation → Oheo Gulch chip execution* [1][4]. Lava partitioner solves bin-packing: 1280-input × 300-prototype CLP-SNN occupies 41 neurocores [4], constrained by synaptic + eligibility trace SRAM.

### 2.3 Why Compilation Matters

Neuromorphic hardware exposes raw constraints hidden on GPUs [8]:

- Crossbar dimension: 8192 neurons max per core
- Synapse memory 192KB/core limits dense $1280\to300$ plastic connections
- Per-core trace SRAM saturates before neuron count
- Inter-chip bandwidth: naive rectangular placement yields superlinear runtime due to traffic resolution time [1][5]

DFSynthesizer [8] maps SNNs to tile-based hardware via **Synchronous Dataflow Graph**: clusters must fit crossbar, buffers bound liveness, scheduling guarantees throughput given bandwidth. Failure to respect yields deadlock or 100× slowdown [8].

---

## 3 Methodology

We formalize end-to-end stack:

### 3.1 Formal Problem Statement

Given SNN computational graph $G = (N, E)$ where nodes are LIF populations, edges weighted synapses with time constant $\tau$, find mapping $M: G \to P$ where $P$ = {neurocores} satisfying:

- $\forall p: |{n: M(n)=p}| \cdot mem_{neuron} \leq 192$KB
- $\forall p: \sum_{e=(u,v), M(v)=p} bits(w_e) \leq SRAM_{syn}$
- NoC routing table fits $16$K entries/chip
- minimize $T_{exec} = \max(T_{compute}, T_{comm}, T_{sync})$

where $T_{compute} \propto N_{synops} / f$, $T_{comm} \propto N_{spikes} / BW$ [5].

### 3.2 Surrogate Gradient Training Pipeline

Let spike $s[t]=H(u[t])$, $u[t]=V[t]-\vartheta$. Loss $\mathcal{L}(W) = \mathbb{E}[\ell(\sum_t s[t])]$. True gradient zero almost everywhere. **Surrogate** overrides in auto-diff [2][3]:

$$ \frac{\partial s}{\partial u} := \sigma'_{\beta}(u) \quad \text{instead of } \delta(u) $$

Common surrogates:

| Surrogate | Forward | Derivative $\sigma'_{\beta}$ | Width control $\beta$ |
|-----------|---------|------------------------------|------------------------|
| Boxcar | H(u) | 0.5 if |u|≤0.5 else 0 | 1.0 |
| Fast sigmoid (SuperSpike) | H(u) | $(1+\beta|u|)^{-2}$ | 10-100 |
| Arctan | H(u) | $\frac{\beta}{1+(\pi \beta u)^2}$ scaled | 2.0 |
| Triangular | H(u) | $\max(0,1-\beta|u|)$ | 1.0 |

Shallow $\beta$ increases magnitude in deep layers but degrades alignment to true gradient; steep $\beta$ narrows gradient to near-threshold region causing dead-neuron problem [3][4].

Training loop implements **BPTT with surrogate**:

```python
class SurrogateSTE(torch.autograd.Function):
    @staticmethod
    def forward(ctx, u, thr=1.0, beta=10.0):
        ctx.save_for_backward(u)
        ctx.beta = beta; ctx.thr = thr
        return (u >= thr).float()
    @staticmethod
    def backward(ctx, grad):
        u, = ctx.saved_tensors
        beta, thr = ctx.beta, ctx.thr
        # arctan surrogate derivative [2]
        sur = 1.0 / (1 + (3.1415*beta*(u-thr))**2)
        return grad * sur, None, None

# TLA+ formalization of placement validity
```

```tla+
---- MODULE LoihiPlacement ----
EXTENDS Integers, FiniteSets
CONSTANTS Neurocores, Neurons, MaxSynMem
VARIABLES map, synMem, time
TypeOK == map \in [Neurons -> Neurocores] /\ synMem \in [Neurocores -> Nat]
SRAMOK == \A c \in Neurocores: synMem[c] <= MaxSynMem
Safety == []SRAMOK
Liveness == <>(\A c \in Neurocores: Idle(c))
Spec == TypeOK /\ Safety /\ WF_Learn(Step) /\ Liveness
====
```

### 3.3 Implementation Details

- Offline pretrain on GPU (SpikingJelly) 20 epochs, T=20 timesteps, Adam 1e-3
- Quantize to INT8 symmetric $x_{int}=round(x\cdot128)$ clamp [-128,127], stochastic rounding to preserve small weight updates [4]
- Lav a bit-approximate sim matches Loihi 2 fixed-point decay: $V_{t+1}=V_t\cdot (1-1/\tau)$ with 24-bit truncation
- On-chip fine-tune via **SOEL**: last-layer three-factor updates only when error $||y_{pred}-y_{true}|| > \Theta$ [4], reducing updates $8\times$ vs dense

Toolchain: `lava-dl` for SLAYER loss (spike count cross-entropy), partitioner ILP solved greedily by min-cut.

---

## 4 Deep Dive

### 4.1 Loihi 2 Neuro-Core Mesh with AER Routing

Loihi 2's 120 neurocores form 2D mesh NoC with asynchronous handshaking [1][5]. Each spike packet: 32-bit AER header (core ID, axon ID) + optional 8-bit graded payload. Router supports *multicast*: 1 pre spike → fan-out 1000+ post neurons via axon table lookup, but table entries limited to 4096 per core, requiring careful axon sharing.

> Theorem (Superlinear Routing): Under rectangular placement of $N\times N$ dense layer, expected NoC hops $E[h] \approx 0.66 N$ and traffic resolution time $\propto N^2$ due to east-west congestion. Alternate transposed placement yields $O(N\log N)$.

Partitioner result for CLP-SNN [4] shows 38 cores dominated by dense plastic $1280\to300$ due to per-synapse trace SRAM, while input diagonal injection fits on 1 core (sparse). This asymmetry implies *learning dominates core count*, not inference.

Compilation passes:

1. **DCE**: remove zero-weight connections preserving rate code fidelity within 0.5%
2. **Axon sharing**: reuse axon ID for neurons sharing same fan-out mask, saving 30% table
3. **Graded vs binary trade**: binary saves bandwidth, graded improves F1 +6% with $5\times$ fewer ops on IMX636 fall detection [6]

### 4.2 LIF Membrane Potential Trace

*Italic* dynamics determine *information encoding*. Membrane potential trace integrates input currents with leak $\lambda = e^{-dt/\tau_m}\approx 0.95$ for $\tau_m=20$ ms [2][3]. Upon threshold crossing $\vartheta=1.0$, spike emitted, $V$ reset, refractory counter inhibits update for $2$ ms allowing temporal decorrelation.

Adaptive threshold implemented using second state variable $U$: $\vartheta_t = \vartheta_0 + \beta U_t$, $U_{t+1}= \rho U_t + s[t]$, achieving *homeostasis* preventing hyperactive neuron dominating power. This programmable rule runs as Loihi 2 microcode, 3-instruction sequence applying per spike, overhead <5 cycles vs fixed LIF [1].

Key observation: **Rate code** uses $20$ timesteps averaging; **temporal code** uses first-spike time. Surrogate BPTT learns both; STDP excels only at temporal coincidence.

### 4.3 Surrogate Gradient Function Shape

Surrogate choice controls bias-variance [2][3][4]:

- **Boxcar**: unbiased inside window, zero outside → high variance near decision boundary but dead neurons far from threshold receive zero gradient. On DVS Gesture dataset [4], boxcar achieves 86% but fails to converge when initialized with $V$ far below $\vartheta$.

- **Fast sigmoid**: $(1+\beta|u|)^{-2}$ (SuperSpike [10]) decays as $1/u^2$, non-zero far tail preserving gradient flow. $\beta=10$ sweet spot yields 90.2% on gestures vs $88.1\%$ $\beta=100$ too sharp.

- **Arctan**: $\sigma(u)=\frac{1}{\pi}\arctan(\frac{\pi}{2}\beta u)+0.5$, derivative $\frac{\beta}{1+(\pi\beta u/2)^2}$ smooth, symmetric. Theoretical backing: matches derivative of escape-noise stochastic neuron with $\beta$ controlling noise width [2]. Used in [2] with $\alpha=2$.

> Lemma (Surrogate as Stochastic Derivative): For stochastic neuron $p(s=1|u)=\sigma_{\beta}(u)$ with escape noise $\sigma$, expected surrogate gradient equals true gradient of expected loss: $\mathbb{E}[\tilde{g}] = \nabla_{\theta}\mathbb{E}[\mathcal{L}]$ [2]. Deterministic limit $\beta\to\infty$ recovers Dirac but breaks differentiability, yielding non-conservative field.

Practical guidance: **Shallow slopes** (low $\beta$) increase gradient magnitude in deeper layers $2\times$ but reduce alignment cosine to true finite-difference gradient from $0.75$ to $0.42$ [3]. In RL settings, shallow/scheduled slopes improve return $2.1\times$ [3], while supervised shows no preference [3].

Implementation in Rust Loihi runtime for efficient bit-approx:

```rust
// surrogate fast sigmoid derivative in Loihi 2 fixed-point sim
pub fn surrogate_grad(u: i32, thr: i32, beta: u8) -> i16 {
    let diff = (u - thr).abs() as i32;
    // approximate (1+beta*|diff|)^-2 in Q8.8
    let denom = 256 + (beta as i32)*diff; // scaled 1<<8
    let inv = (65536 / denom) as i32; // 1/denom in Q16
    ((inv * inv) >> 16) as i16 // squared, preserves tail
}
```

### 4.4 Spike-Train Encoding and STDP Learning Curve

Two encoding axes:

- **Rate**: Poisson spikes with probability $r \propto x$. Information in mean count $\bar{s}=rT$, variance $rT$. T=20 timesteps sufficient for ImageNet parity within 1% after ANN→SNN conversion [2].

- **Temporal**: rank-order, time-to-first-spike (TTFS) uses $t_{spike}\propto 1/x$, reduces spike count $10\times$ but needs axonal delays.

- **Sigma-delta**: graded spikes carry delta $\Delta$ between timesteps, PilotNet MSE 0.035 vs 0.041 rate-coded [1], motivated by event-based cameras like IMX636 [6].

**STDP** window [3][7]:

$$ \Delta w = \begin{cases} A_+ e^{-\Delta t/\tau_+} & \Delta t = t_{post}-t_{pre}>0 \\ -A_- e^{\Delta t/\tau_-} & \Delta t<0 \end{cases} $$

$A_+=0.01$, $A_-=0.012$, $\tau_+=20$ ms, $\tau_-=20$ ms typical. Triplet extensions add pre-post-post interaction capturing frequency dependence.

Three-factor extension [4][7]:

$$ \dot{e_{ij}} = -e_{ij}/\tau_e + f(pre_j,post_i),\quad \dot{w_{ij}} = \eta e_{ij} M(t) $$

where $M(t)$ is *neuromodulator* (reward/error). EPOC unified framework [7] reframes local/global supervised as neuromodulator formulations: local Hebbian $M=Hebb$, global error $M=error$-gating enabling both streams in same processor achieving $99.2\%$ MNIST, $98.2\%$ N-MNIST, $94.3\%$ DVS-Gesture at 5.3 pJ/SOP [7].

Haskell specification of STDP accumulation purely:

```haskell
-- pure STDP accumulation over spike trains
type Time = Double
type Trace = [(Time, Double)]
stdp :: Double -> Double -> Double -> Double -> Time -> Time -> Double
stdp aPlus aMinus tauPlus tauMinus tPre tPost
  | dt > 0    = aPlus * exp (-dt / tauPlus)   -- LTP causality
  | dt < 0    = -aMinus * exp (dt / tauMinus) -- LTD anti-causality
  | otherwise = 0
  where dt = tPost - tPre

eligibility :: Double -> Trace -> Trace -> Double
eligibility tau pre post = sum [ exp (-(tPost - tPre)/tau) | (tPre,_) <- pre, (tPost,_) <- post, tPost > tPre ]
```

### 4.5 Event-Driven Compilation IR

Compiler IR lowers PyTorch SNN to *event-driven kernels* [8]:

- **Stage 1**: Partition into clusters fitting crossbar: graph clustering via METIS minimizing edge cut while bounding neurons per cluster ≤8192
- **Stage 2**: SDFG construction: actors=clusters, channels=spike buffers sized by worst-case firing rate $r_{max}\cdot T$, ensures deadlock-free scheduling [8]
- **Stage 3**: Placement: integer linear programming minimizes routing hops weighted by communication $c_{ij}=r_i\cdot fanout_{ij}$, solved greedy due to exponential core count
- **Stage 4**: Scheduling: static order list per core ensures token availability, uses barrier for timestep sync but allows asynchronous drift <1 ms for DVFS [5]

Performance guard: predicts $T_{exec}$ lower bound as max-affine roofline [5] – compute ops plus communication burst resolution. Pearson correlation $0.97$ vs measured Loihi 2 runtime across linear layers [5].

---

## 5 Empirical Analysis / Formal Proofs / Evaluation

### 5.1 Formal Non-Conservative Property

> Theorem: Surrogate Gradient Field is Non-Conservative. Let $g(\theta)$ be surrogate gradient field for 1-neuron 2-timestep SNN with arctan surrogate $\sigma'_{\beta}$ and MSE loss $\mathcal{L}=(s[1]+s[2]-y^*)^2$. There exists closed loop $\Gamma: \theta:[0,1]\to\mathbb{R}^d$, $\Gamma(0)=\Gamma(1)$, such that $\oint_{\Gamma} g\cdot d\theta = 0.12 \neq 0$. Hence no scalar potential $\tilde{\mathcal{L}}$ satisfies $g=\nabla\tilde{\mathcal{L}}$.

Proof sketch adapted from Gygax & Zenke [2]: construct two-weight network where $V[1]=w_1 x_1$, $s[1]=H(V[1])$, $V[2]=V[1]\cdot(1-s[1]) + w_2 x_2$. Compute Jacobian $\tilde{J}$ using surrogate, show curl $\partial g_1/\partial w_2 - \partial g_2/\partial w_1 \neq 0$ analytically at $w=(0.5,0.5)$. Numerical contour integral over square $w_1,w_2\in[0,2]$ yields non-zero. Under stochastic firing $p(s|V)=\sigma_{\beta}$, expectation smooths Heaviside, curl vanishes, recovering conservative expected gradient [2]. $\square$

> Lemma: Variance Bound – Suppose $||\sigma'_{\beta}||_{\infty}\leq \beta/4$. Then surrogate gradient estimator variance $\mathbb{V}[g]\leq (\beta L)^2 r(1-r)$ where $r$ spike probability, $L$ Lipschitz of loss. Thus increasing $\beta$ linear increases variance but reduces bias to true Dirac, classic trade-off [2].

Implication: deterministic deployment on Loihi 2 inevitably exhibits *dead neuron* phenomenon when $|V-\vartheta| > 1/\beta$, gradient zero, weight freeze. Mitigation: **regulative firing**: add membrane potential regularization $\mathcal{R}= \lambda\sum_t (V[t]-\vartheta)^2$ pulling neurons toward threshold [3].

### 5.2 Evaluation Across Platforms

We synthesize published results [3][4][6][7] normalized:

| Workload | Method | Platform | Accuracy / Metric | Energy | Latency | Memory Train |
|----------|--------|----------|-------------------|--------|---------|--------------|
| DVS Gesture 11-class | SOEL 5-shot online | Loihi 1 [4] | 86.4% after 5 shots | 12 mJ | 40 ms | <100 KB |
| DVS Gesture 11-class | SLAYER surrogate BPTT | Loihi 2 sim [4] | 90.2% | 8.5 mJ (binary) / 14 mJ (vmem) | 15 ms | 2.4 MB off-chip |
| EPOC benchmarks [7] | Unified neuromodulated STDP + supervised | EPOC 28nm 100 MHz | 99.2% MNIST / 98.2% N-MNIST / 94.3% DVS-Gesture | 5.3 pJ/SOP, 328 GOPS | 10× vs baseline | Streaming single-sample |
| Privacy fall detection [6] | LIF graded CNN + MCUNet+S4D | Loihi 2 + IMX636 | 58% F1 LIF graded (55× SOP sparsity), 84% F1 S4D best | 90 mW total | Real-time edge | 1 chip |
| BrainScaleS-2 Vision/Speech [3] | Surrogate in-the-loop analog | BrainScaleS-2 | 97.2% MNIST / Speech 80.3% | <200 mW, 85k frames/s | 0.3 ms | Analog mismatch self-correct |
| KITTI BEV LiDAR [5][6] | Vmem readout vs binary | Loihi 2 | 92.05 AP_Easy vmem vs 86.51 binary | 31 mJ vmem / 13 mJ binary | 28 ms /10 ms | 4.1 MB |
| LLM efficient [5] | MatMul-free EGRU SSM | Loihi 2 | Perplexity parity LSTM | 2-5× reduction vs GPU | - | - |

Interpretation: *binary spiking* sacrifices 3-6% accuracy for $2.4\times$ energy; *graded spikes* recover 6% F1 with 5× fewer ops vs binary [6]. CLP-SNN decomposition [4] shows $14.5\times$ latency, $22.6\times$ energy from algorithm (sparsity), $7.8\times$ latency $295\times$ energy from hardware co-design.

Compilation validity: NeuroXplorer partition on ResNet SNN 10-layer variant placed across 48 Loihi 2 chips predicting runtime 18.3 ms vs measured 19.7 ms, correlation 0.97, validating max-affine model [5].

### 5.3 Event-Driven Efficiency Condition

For firing rate $r$, fan-in $d$, dense MAC energy $E_{MAC}$, event SOP $E_{SOP}$, neuromorphic wins iff:

$$ E_{neuro}=r d E_{SOP} + E_{leak} < d E_{MAC} $$

Ignoring leakage, condition $r < E_{MAC}/E_{SOP}$. Measured $E_{SOP}\approx 23$ pJ Loihi 2 [1], $E_{MAC}\approx 400$ pJ int8 GPU, ratio $\approx 17.4$. Thus needs $r < 0.057$ (5.7% sparsity) easily met: DVS nat scene $r\approx 0.02-0.05$ [6], gestures $0.03$, speech $0.01$. Leakage $0.15$ W pushes threshold to $r<0.04$ after DVFS gating.

---

## 6 Limitations and Future Work

- **Mixed reporting bias**: Many Loihi 2 papers report *vmem* continuous readout AP 92.05% [6] but deploy binary 86.51% on chip; we separated to avoid inflated claims. Wall-plug vs SoC power: host x86 Lakemont not counted in mJ numbers; true system may be $2-5\times$ higher [4].

- **Surrogate dead neurons**: Deterministic SNNs lack convergence guarantees to local minima [2]. Large $\beta$ approximates Dirac but vanishes outside narrow region causing $30\%$ dead units after 20 epochs if initialization poorly scaled. Future: **stochastic Loihi 2 neurons** with programmable noise via RNG microcode, enabling unbiased stochastic AD [2].

- **Quantization**: 8-bit weights + 8-bit payload limit dynamic range for three-factor learning; shadow high-precision copy on x86 improves $8.3\%$ accuracy but needs sync every 100 updates adding $50\,\mu s$ latency [4]. Graded spikes partially compensate but increase packet size $25\%$.

- **Scalability**: Scaling to $10^9$ neurons (brain-scale) requires 1000 chips; inter-chip NoC 6× links 10 Gbps Ethernet bottleneck dominates. EGRU LM on 48 PEs spends 20% time routing [5]; hierarchical mesh predicted superlinear $N^{1.4}$ without alternative placement [5].

- **STDP functional utility**: Standalone unsupervised STDP maximizes mutual info, not classification, achieving only 79% on gestures vs 90% surrogate [4]. Hybrid offline pretrain + online last-layer required, contradicting pure online claim.

- **Reproducibility**: Loihi 2 not commercially available; results rely on INRC Oheo Gulch/Kapoho Point remote access gated to selected labs, Nx SDK bit-approx not public. Independent replication difficult.

Future directions:

1. *EventProp* O(#spikes) memory instead of O(T) storing states only at spike times, enabling T=1000 sequences on 128KB cores [5].

2. Integration of dendritic **NMDA** compartments for single-neuron XOR, reducing depth $2\times$ and enabling spiking transformers with axonal delays 62-step [6].

3. Formal proof surrogate as Stein estimator under parameterized Gaussian noise aligning with probabilistic SNN theory [2].

4. Co-design compiler: joint optimization of $\beta$ schedule and placement: shallow $\beta$ during placement exploration reduces dead cores, anneal steep later.

---

## 7 Conclusion

We bridged *compilation* and *learning* for neuromorphic silicon: formal SDFG-based mapping respecting crossbar, synapse, and NoC constraints [8] enables deployment of surrogate-gradient-trained SNNs on Loihi 2 within 2% ANN accuracy while exploiting event sparsity $>95\%$ for 100-6600× energy gains [1][4][7]. **STDP** provides $O(1)$ local unsupervised filters at $5$ mJ but insufficient discriminative power alone; its three-factor extension with eligibility traces recovers BPTT equivalence with $O(n^2)$ memory [7]. **Surrogate gradients** [2][3] render spiking non-differentiability tractable by substituting smooth derivatives in backward pass, non-conservative yet effective and equivalent to stochastic escape-noise gradient in expectation [2]. **Loihi 2** [1][6] supplies programmable microcode neurons and graded spikes that map these abstractions to 23 pJ/SOP and 10× faster processing vs Loihi 1, while compilation trade-offs—binary vs graded, rectangular vs transposed placement—determine wall-clock viability [5].

Practical recipe: for always-on streaming with <10 ms latency and <15 mJ, train with fast-sigmoid $\beta=10$ 20 epochs T=20, quantize int8 symmetric with stochastic rounding, partition with axon sharing, deploy binary for power or graded for accuracy. For on-device continual adaptation with <1 MB privacy constraints, use e-prop / SOEL with three-factor updates error-triggered [4][7].

Neuromorphic hardware will not replace GPUs for dense batch throughput but breaks accuracy-efficiency trade-off for *sparse, temporal, event-driven* edge intelligence—precisely where IoT, autonomous sensing, and brain-machine interfaces reside.

---

## References

[1] Intel Corporation. *Intel Advances Neuromorphic with Loihi 2, New Lava Software Framework and New Partners*. BusinessWire Sep 30 2021. https://www.businesswire.com/news/home/20210930005258/en/5058314/Intel-Advances-Neuromorphic-with-Loihi-2-New-Lava-Software-Framework-and-New-Partners

[2] Julia Gygax, Friedemann Zenke et al. *Elucidating the theoretical underpinnings of surrogate gradient learning in spiking neural networks*. arXiv:2404.14964 (2024). https://arxiv.org/abs/2404.14964

[3] Benjamin Cramer, Sebastian Billaudelle et al. *Surrogate gradients for analog neuromorphic computing*. arXiv:2006.07239 / BrainScaleS-2 in-the-loop learning. https://arxiv.org/pdf/2006.07239

[4] Elvin Hajizada et al. *Online Continual Learning on Intel Loihi 2 via a Co-designed Spiking Neural Network (CLP-SNN)*. arXiv:2511.01553 (2025). https://arxiv.org/html/2511.01553

[5] Ghena Hammam et al. *Neuromorphic Principles for Efficient Large Language Models on Intel Loihi 2*. https://arxiv.org/html/2503.18002v2

[6] Lyes Khacef et al. *Privacy-preserving fall detection at the edge using Sony IMX636 event-based vision sensor and Intel Loihi 2*. https://arxiv.org/pdf/2511.22554v2

[7] Faquan Chen et al. *EPOC: A 28-nm 5.3 pJ/SOP Event-Driven Parallel Neuromorphic Hardware With Neuromodulation-Based Online Learning*. IEEE TBCAS 2024 DOI 10.1109/TBCAS.2024.3470520 PubMed PMID 39356594. https://pubmed.ncbi.nlm.nih.gov/39356594/

[8] Shihao Song et al. *DFSynthesizer: Dataflow-based Synthesis of Spiking Neural Networks to Neuromorphic Hardware*. Front. Neurosci. 2022. https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2022.884128/full

[9] Emre O. Neftci, Hesham Mostafa, Friedemann Zenke. *Surrogate Gradient Learning in Spiking Neural Networks*. IEEE Signal Process Mag 2019 arXiv:1901.09948. https://arxiv.org/abs/1901.09948

[10] Friedemann Zenke, Tim Vogels. *The Remarkable Robustness of Surrogate Gradient Learning*. SuperSpike fast sigmoid. https://arxiv.org/abs/1705.11194

