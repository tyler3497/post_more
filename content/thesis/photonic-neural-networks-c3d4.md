---
id: photonic-neural-networks-c3d4
title: "Photonic Neural Networks: Mach–Zehnder Interferometer Meshes, Coherent Optical Matrix Multiplication, and In-Situ Training of Programmable Photonic Accelerators"
anon: anon#5521
ts: 1788748161000
tags: [photonic-neural-networks]
type: thesis
---

# Photonic Neural Networks: Mach–Zehnder Interferometer Meshes, Coherent Optical Matrix Multiplication, and In-Situ Training of Programmable Photonic Accelerators

## Abstract

Coherent nanophotonic circuits have emerged as a compelling substrate for neural-network computation, performing the dense matrix–vector multiplications at the heart of deep learning at the propagation speed of light and with energy costs projected to be orders of magnitude below those of electronic accelerators [1]. This thesis develops the theory and practice of photonic neural networks (PNNs) built from programmable Mach–Zehnder interferometer (MZI) meshes. We review the universal unitary decompositions of Reck *et al.* and the depth-optimal rectangular meshes of Clements *et al.*, show how singular value decomposition maps arbitrary real weight matrices onto cascaded MZI arrays with an intervening diagonal attenuation stage, analyze coherent optical matrix multiplication together with photodetection-based nonlinearities, and derive the photonic analogue of backpropagation via adjoint variable methods that enables *in-situ* training using only intensity measurements inside the device [3]. We survey experimental milestones — from the 56-MZI vowel-recognition processor of Shen *et al.* to the commercial Envise accelerator of Lightmatter [6][7] — quantify the energy-per-MAC scaling law, and identify the precision, noise, and scalability bottlenecks that presently limit photonic accelerators.

## 1 Introduction

The dominant cost of modern deep learning is dense linear algebra. Electronic accelerators — GPUs, TPUs, systolic arrays — pay for each multiply–accumulate (MAC) in the picojoule range while shuttling data across memory hierarchies designed for von Neumann architectures [1]. As models grow, the energy and latency budgets of inference have become first-order constraints on deployment.

Optics offers a qualitatively different trade. A linear optical transformation on $N$ modes is performed *passively*: once a programmable photonic circuit is configured, an input vector encoded in the amplitudes and phases of coherent light propagates through and emerges as the matrix–vector product, with compute time set only by the time of flight — tens of picoseconds across a millimeter-scale chip — and energy spent principally on generating the light and reading the result, not on the $O(N^2)$ multiplications themselves [1][4]. The interference of coherent beams performs the arithmetic; the physics is the processor.

This thesis is organized around three pillars of the coherent photonic neural network:

1. **Programmable unitary synthesis.** How meshes of $2\times 2$ Mach–Zehnder interferometers implement arbitrary unitary — and, via singular value decomposition, arbitrary real — matrices, and how the rectangular Clements decomposition halves the optical depth of the classical Reck triangle [2].
2. **The optical neuron.** How modulation, coherent weighting, and photodetection combine into a complete neural-network layer, including the subtle question of where the nonlinearity lives.
3. **In-situ training.** How the adjoint variable method yields a photonic backpropagation algorithm whose gradients are measurable as optical intensities inside the chip, permitting training without an external digital twin [3].

We ground the theory in the experimental record, quantify the energy scaling, and confront the limitations — phase noise, thermal crosstalk, limited precision, and the stubborn difficulty of deep all-optical networks — that define the research frontier [5].

## 2 Background

### 2.1 From optical computing to coherent nanophotonics

Ideas for computing with light are half a century old, but early optical computers foundered on the superiority of electronics for digital logic and on the difficulty of cascadable optical nonlinearity. The deep-learning era reframed the problem: neural networks need fast, efficient, repeated matrix multiplication, a workload for which analog coherent optics is naturally suited [1][4]. Silicon photonics — low-loss waveguides, couplers, and modulators in CMOS-compatible processes — turned the tabletop interferometer into an integrable, programmable component.

### 2.2 The Mach–Zehnder interferometer as a $2\times 2$ unitary gate

The workhorse of coherent photonic processors is the programmable Mach–Zehnder interferometer: two 50:50 directional couplers with a tunable phase shifter $\theta$ on one internal arm and an external phase shifter $\phi$ on one output arm. Up to global phase, its transfer matrix is the general $SU(2)$ rotation

$$T(\theta, \phi) = \begin{pmatrix} e^{i\phi}\sin(\theta/2) & \cos(\theta/2) \\ e^{i\phi}\cos(\theta/2) & -\sin(\theta/2) \end{pmatrix},$$

so that by tuning two phases — thermally via micro-heaters or electro-optically — a single MZI implements any $2\times 2$ unitary mixing of two optical modes. The central mathematical question for an $N$-mode mesh is which layouts are *universal*, i.e., capable of realizing *every* $N\times N$ unitary matrix.

### 2.3 Universal decompositions: Reck and Clements

Reck *et al.* (1994) gave the first constructive universality result: any $N\times N$ unitary factorizes into a triangular mesh of $N(N-1)/2$ beam splitters by successive nulling of matrix elements, analogous to QR decomposition with Givens rotations [2]. The triangular layout has highly nonuniform optical depth, however — some paths traverse $O(1)$ devices, others $O(N)$ — making it fragile to unavoidable per-component loss.

Clements *et al.* (2016) rearranged the same devices into a *rectangular* mesh in which every path traverses nearly the same number of devices [2]: **half the footprint** of the Reck design, **uniform minimal optical depth** (hence far better loss robustness), and a nulling-based compiler mapping any target unitary to phase settings in $O(N^3)$ classical preprocessing. The Clements mesh is the standard fabric of coherent photonic matrix processors today.

### 2.4 The nonlinear problem

Linear optics alone cannot implement a neural network: universal approximation requires a nonlinearity between layers. Coherent photonic designs obtain it via **photodetection** ($z \mapsto |z|^2$, the physically natural modulus-squared nonlinearity used by Shen *et al.* [1]), **saturable absorbers** with sigmoidal transmission curves, or **optoelectronic loops** in which detected signals drive modulators — fast and flexible, but reintroducing conversion costs [5].

## 3 Methodology

Our methodology is threefold: analytic derivation, numerical compilation, and synthesis of the experimental literature.

**Analytic.** We derive the MZI transfer matrix from coupled-mode theory, prove universality of the rectangular mesh by the nulling construction, and derive the adjoint-variable gradient for in-situ training from first principles, following Hughes *et al.* [3].

**Numerical.** We implement the SVD-to-mesh compilation pipeline in Python/NumPy: given a real weight matrix $W$, compute $W = U\Sigma V^\dagger$, decompose the unitaries $U, V^\dagger$ into Clements-mesh phase settings, and map the singular values in $\Sigma$ onto a diagonal attenuation stage. The reference implementation is given in §4.1 and serves as the executable specification of the programming model.

**Empirical.** We anchor every scaling claim to published devices and measurements — the 56-MZI vowel recognizer [1], the adjoint training simulations [3], and the Lightmatter Envise product line [6][7] — and we verify all cited sources against their canonical arXiv, DOI, and publisher records.

> **Methodological note.** "Energy per MAC" means the marginal optical energy per multiply–accumulate at fixed laser wall-plug efficiency, excluding the one-time cost of programming the mesh — the correct figure of merit for inference, where weights are stationary [1].

---

## 4 Deep Dive

### 4.1 MZI meshes and SVD-based unitary synthesis

The key structural insight of Shen *et al.* [1] is that an arbitrary real $m \times n$ weight matrix admits the singular value decomposition $W = U\Sigma V^\dagger$, where $U$ and $V$ are unitary and $\Sigma$ is diagonal with nonneg entries. Each factor maps onto photonic hardware:

| Factor | Mathematical object | Photonic implementation |
|---|---|---|
| $V^\dagger$ | $n\times n$ unitary | Clements MZI mesh, $n(n-1)/2$ MZIs |
| $\Sigma$ | diagonal, $\sigma_i \ge 0$ | Mach–Zehnder attenuators or amplifiers per mode |
| $U$ | $m\times m$ unitary | Clements MZI mesh, $m(m-1)/2$ MZIs |

The full linear layer is therefore a cascade: inputs enter the $V^\dagger$ mesh, pass through the diagonal stage, and exit through the $U$ mesh. For a square $N\times N$ layer this needs $N(N-1)$ MZIs plus $N$ diagonal elements.

> **Theorem 1 (Universal unitary synthesis).** *For every $N\times N$ unitary matrix $U$ there exist phase settings $\{\theta_k, \phi_k\}_{k=1}^{N(N-1)/2}$ of a rectangular Clements mesh of $2\times 2$ MZI gates such that the mesh transfer matrix equals $U$ exactly (in the lossless idealization). Moreover, the settings can be found by a nulling algorithm in $O(N^3)$ arithmetic operations.*

*Proof sketch.* Proceed as in Clements *et al.* [2]: multiply $U$ on the right by successive $T_{mn}^{-1}(\theta,\phi)$ factors, each chosen to null one targeted matrix element, working in the order dictated by the rectangular layout. Because each $2\times 2$ block is itself universal for $SU(2)$, the nulling angles always exist; after nulling all subdiagonal elements the remaining matrix is diagonal unitary, absorbed into output phases. The rectangular ordering guarantees each nulling step acts on a pair of modes adjacent in the current mesh column, hence realizable. ∎

The following reference code implements the compilation pipeline end to end:

```python
import numpy as np

def mzi_unitary(theta: float, phi: float) -> np.ndarray:
    """Transfer matrix of one programmable MZI (2x2 unitary gate)."""
    s, c = np.sin(theta / 2.0), np.cos(theta / 2.0)
    return np.array([[np.exp(1j * phi) * s, c],
                     [np.exp(1j * phi) * c, -s]], dtype=complex)

def nulling_angles(a: complex, b: complex):
    """Angles (theta, phi) zeroing the lower element of [a, b]^T."""
    r = np.hypot(abs(a), abs(b))
    theta = 2.0 * np.arctan2(abs(b), abs(a)) if r > 0 else 0.0
    phi = np.angle(a) - np.angle(b)
    return theta, phi

def compile_clements(U: np.ndarray):
    """Nulling-based compilation of a unitary onto a rectangular MZI mesh.
    Returns list of (mode_pair, theta, phi) programming instructions."""
    N = U.shape[0]
    W = U.copy()
    program = []
    for col in range(N - 1):
        for row in range(col, N - 1):
            m = N - 1 - (row - col)
            theta, phi = nulling_angles(W[m - 1, col], W[m, col])
            T = np.eye(N, dtype=complex)
            T[m-1:m+1, m-1:m+1] = mzi_unitary(theta, phi).conj().T
            W = T @ W
            program.append(((m - 1, m), theta, phi))
    return program

def program_linear_layer(Wgt: np.ndarray):
    """Compile a real weight matrix onto V^dag / Sigma / U photonic stages."""
    U, s, Vh = np.linalg.svd(Wgt)
    return {
        "V_stage": compile_clements(Vh),          # right unitary mesh
        "Sigma": np.clip(s, 0.0, 1.0),            # diagonal attenuators
        "U_stage": compile_clements(U),           # left unitary mesh
    }
```

Three observations matter for practice. First, compilation is *offline and one-time*: the $O(N^3)$ classical cost is paid once per weight matrix, while inference then runs at optical speed [1]. Second, singular values exceeding unity require optical gain; practical designs normalize weights so $\sigma_{\max} \le 1$ and recover scale electronically. Third, the diagonal stage is where *non-unitary* behavior enters — attenuation breaks the energy conservation of the unitary meshes and is the principal insertion loss the Clements layout minimizes [2].

### 4.2 Coherent optical matrix multiplication and the neuron

A complete coherent optical neuron layer operates in four stages: **encoding** (input vector impressed on $N$ coherent carriers by modulators), **weighting** (beams traverse the $V^\dagger$–$\Sigma$–$U$ cascade, emerging as $\mathbf{z} = W\mathbf{x}$ by passive interference — the $O(N^2)$ MACs computed in $\sim$50–100 ps of time of flight), **nonlinearity** (photodetectors yield $|z_i|^2$, or an electro-optic loop applies $f(\cdot)$), and **fan-out** to the next layer's modulators.

The elegance of the scheme is also its subtlety: the complex-valued optical field means the network natively computes over $\mathbb{C}$, and the modulus-squared detection is the physically natural nonlinearity [1][5]. Complex-valued networks encode information in both phase and magnitude, and on-chip coherent detection — itself implementable with additional MZI stages — preserves this structure through the layer stack [4].

### 4.3 In-situ training: the adjoint-variable backpropagation

Offline training — computing weights on a GPU and downloading phase settings — suffers a fatal flaw: fabrication imperfections, thermal drift, and crosstalk mean the physical chip never exactly implements the simulated matrix, and the resulting *reality gap* degrades accuracy [3][5]. Hughes *et al.* resolved this with a photonic analogue of backpropagation derived from adjoint variable methods [3].

Consider a photonic network with tunable phase parameters $\boldsymbol{\eta}$ and a loss $L$ depending on output intensities. The adjoint method introduces an *adjoint field* — physically, light injected *backwards* through the network from the output ports, with amplitudes proportional to the error signal $\partial L/\partial \mathbf{z}$. Interference between the forward field and the adjoint field inside each MZI directly encodes the gradient:

> **Theorem 2 (Photonic adjoint gradient).** *Let $\mathbf{e}_f$ be the forward-propagating field and $\mathbf{e}_a$ the adjoint field obtained by injecting the output error backwards through the reciprocal photonic network. Then the gradient of the loss with respect to the phase shift $\eta_k$ of any phase shifter is proportional to $\operatorname{Im}\!\left[e_{a,k}^*\, e_{f,k}\right]$ at that shifter's location — a quantity obtainable from intensity measurements within the device.*

In practice the protocol is [3]:

1. **Forward pass:** inject the training input, measure output intensities, compute the error electronically.
2. **Adjoint pass:** inject the error signal backwards into the output ports.
3. **Gradient readout:** tap intensities at each phase shifter (via low-loss monitor taps); the gradient follows from the interference term of Theorem 2.
4. **Update:** adjust phase-shifter voltages by gradient descent, entirely closing the loop on hardware.

The crucial consequence is *self-calibration*: because gradients are measured on the physical device rather than a model of it, training automatically compensates for static fabrication errors, thermal crosstalk, and drift — the network learns the chip it actually inhabits, not the chip the designer intended [3][5]. This moves photonic neural networks from the "program and pray" regime of offline compilation to genuine online learning.

### 4.4 Energy and scaling: photonic versus electronic MACs

The energy argument for photonics rests on a scaling asymmetry. In an electronic systolic array, each MAC dissipates energy in transistor switching and data movement, roughly $1$–$10$ pJ per MAC. In a coherent photonic mesh, the $O(N^2)$ interference operations dissipate *no* dynamic energy — the budget is dominated by wall-plug laser power (amortized over operations), modulator/detector energy per vector, and the static power of thermal phase shifters holding the weights [1][6].

Hence the celebrated scaling law: **energy per MAC falls as $1/N$** (up to the static overhead), because $N^2$ MACs are performed per $O(N)$ modulator/detector operations. Shen *et al.* projected "in principle … less than one thousandth" the energy per operation of electronic chips [1]; commercial embodiments make the trend concrete:

| Platform | Compute fabric | Reported efficiency | Notes |
|---|---|---|---|
| GPU (A100-class) | Electronic systolic/SIMT | $\sim$1–5 pJ/MAC | Includes HBM data movement |
| Google TPU | Electronic systolic array | $\sim$1 pJ/MAC | 8-bit integer |
| Shen *et al.* demo [1] | 56-MZI coherent mesh | Projected $\ll$ 1 pJ/MAC | 4$\times$4 vowel recognition, 76.7% blind-test accuracy |
| Lightmatter Envise [6][7] | 256$\times$256 photonic units $\times$16 chips | $\approx$240 inferences/s/W (ResNet-50, system level) | Dual-die: 12-nm ASIC + silicon photonics |
| Ideal large-$N$ mesh | Clements cascade + WDM | Projected fJ/MAC regime | $1/N$ scaling with mesh dimension |

Latency tells an equally striking story: the photonic multiply completes in the time of flight — $\sim 10^{-10}$ s, independent of $N$ — versus $\sim$10 ns for an electronic systolic array, a two-order-of-magnitude advantage Lightmatter quantifies as roughly $42\times$ end-to-end inference latency improvement [7].

### 4.5 Precision, noise, and the analog ceiling

Real meshes are analog, and analog computing pays a precision tax [5]:

- **Phase-encoding noise.** Thermal phase shifters drift; a milliradian of phase error per MZI compounds across $O(N)$ depth. Thermo-optic crosstalk between neighboring heaters correlates these errors.
- **Detection noise.** Shot noise and thermal noise at the photodetectors bound the effective number of bits; demonstrated coherent PNNs operate at roughly 4–8 bits of effective precision, versus 8–16 bits for digital accelerators.
- **Loss and dynamic range.** Each MZI contributes insertion loss ($\sim$0.1–0.5 dB); across depth $2N$ the signal attenuates exponentially, compressing dynamic range and ultimately limiting mesh size.
- **Footprint.** A single MZI with its heaters occupies hundreds of square micrometers; a $256\times 256$ mesh is already a centimeter-scale chip. Scaling past $\sim$1000 neurons per layer in pure MZI technology is widely regarded as impractical without 3D integration or alternative resonators [5].

These constraints explain the field's central compromise: photonics wins on energy and latency for *inference* with stationary weights, where programming is rare and precision demands are modest, while training and high-precision workloads remain electronic for now. Error-aware training — injecting measured noise models into the offline optimization, or better, the self-calibrating in-situ training of §4.3 — is the standard mitigation [3][5].

---

## 5 Empirical Results and Proofs

We now collect the theoretical guarantees and the experimental record side by side.

**Universality (proved).** Theorem 1 establishes that the Clements rectangular mesh realizes *every* $N\times N$ unitary with $N(N-1)/2$ MZIs at minimal uniform optical depth [2]. Combined with SVD, this yields exact realization of every real $N\times N$ weight matrix (up to the diagonal attenuation stage), making the coherent MZI architecture *expressively complete* for linear layers.

**Adjoint gradient (proved).** Theorem 2 shows that exact loss gradients with respect to all phase parameters are obtainable from in-device intensity measurements, with no digital model of the chip required [3]. Hughes *et al.* validated the construction by training a numerically simulated photonic network on a classification task, demonstrating convergence behavior matching ideal backpropagation while automatically absorbing simulated fabrication disorder.

**Experimental milestones.**

- *Shen et al., Nature Photonics 2017* [1]: a 56-MZI programmable nanophotonic processor implementing a 4$\times$4 optical neural network; 76.7% blind-test accuracy on four-vowel recognition — the founding demonstration of learned computation on a coherent MZI mesh.
- *Clements et al., Optica 2016* [2]: the rectangular universal interferometer with half the Reck footprint and measured loss robustness — the mesh geometry underlying all subsequent coherent processors.
- *Hughes et al., Optica 2018* [3]: the in-situ backpropagation protocol, validated in simulation, establishing the training path that closes the reality gap.
- *Lightmatter Envise* [6][7]: the industrial realization — 16 photonic chips per blade, each with 256$\times$256 photonic arithmetic units, $\sim$1.2M ResNet-50 inferences/s per blade, with a PyTorch/TensorFlow software stack (Idiom).

**Scaling law (derived).** For an $N\times N$ mesh with per-vector modulator energy $E_{mod}$ and detector energy $E_{det}$, the amortized energy per MAC is $(E_{mod} + E_{det})/N + E_{static}/N^2$ — asymptotically $O(1/N)$, the fundamental origin of the photonic efficiency advantage at large $N$ [1][6].

---

## 6 Limitations

Honesty about limitations is what separates a research program from a marketing pitch. The principal ones:

1. **The nonlinearity bottleneck.** No consensus all-optical nonlinearity is simultaneously fast, low-loss, cascadable, and expressive. Photodetection ($|z|^2$) is elegant but fixed; saturable absorbers are slow; optoelectronic loops reintroduce conversion overhead. Deep *all-optical* networks remain a laboratory curiosity [5].
2. **Precision ceiling.** 4–8 effective bits suffice for many inference workloads but exclude training-to-convergence. Phase noise, thermal crosstalk, and drift are physics, not engineering oversights, and they compound with depth.
3. **Size and loss.** MZI footprints and per-device insertion loss jointly cap practical mesh dimensions; the $O(N^2)$ device count means area grows as fast as expressivity.
4. **Programming bandwidth.** Thermal phase shifters switch in microseconds — six orders of magnitude slower than the optical compute itself. Weights must be quasi-static, which suits inference but rules out per-token dynamic weighting unless fast electro-optic or phase-change materials mature.
5. **The reality gap.** Without in-situ methods, the mismatch between compiled unitary and physical device degrades accuracy; in-situ training solves this in principle [3] but needs monitor taps and backward-injection hardware that add loss and complexity.
6. **Software and economics.** A photonic accelerator is only as useful as its compiler stack and cost per rack; silicon photonics remains a specialty process, and its ecosystem lags decades behind CUDA.

None of these is a no-go theorem — each is an active research front — but together they explain why photonics is winning *incrementally*, absorbing linear algebra at the latency frontier, rather than displacing digital accelerators wholesale [4][5].

## 7 Conclusion

Photonic neural networks rest on three interlocking results: the Clements rectangular mesh gives a depth-optimal, loss-robust universal unitary fabric [2]; singular value decomposition compiles arbitrary weight matrices onto that fabric with $O(N^2)$ devices [1]; and the adjoint variable method turns the physical chip into its own backpropagation engine, with gradients readable as light intensities [3]. Around this core, a scaling law — energy per MAC falling as $1/N$, latency fixed at the time of flight — drives both the research program and the commercial products now reaching data centers [6][7]. The likely future is heterogeneous: electronic control planes orchestrating photonic linear-algebra engines, trained in situ on the very disorder of their own fabrication.

## References

[1] Y. Shen, N. C. Harris, S. Skirlo, M. Prabhu, T. Baehr-Jones, M. Hochberg, X. Sun, S. Zhao, H. Larochelle, D. Englund, and M. Soljačić, "Deep learning with coherent nanophotonic circuits," *Nature Photonics*, vol. 11, pp. 441–446, 2017. DOI: 10.1038/nphoton.2017.93. Preprint: https://arxiv.org/abs/1610.02365

[2] W. R. Clements, P. C. Humphreys, B. J. Metcalf, W. S. Kolthammer, and I. A. Walmsley, "An optimal design for universal multiport interferometers," *Optica*, vol. 3, no. 12, pp. 1460–1465, 2016. DOI: 10.1364/OPTICA.3.001460. Preprint: https://arxiv.org/abs/1603.08788v1

[3] T. W. Hughes, M. Minkov, Y. Shi, and S. Fan, "Training of photonic neural networks through in situ backpropagation," *Optica*, vol. 5, no. 8, pp. 864–871, 2018. DOI: 10.1364/OPTICA.5.000864. Preprint: https://arxiv.org/abs/1805.09943

[4] "Photonic matrix multiplication lights up photonic accelerator and beyond," *Light: Science & Applications*, vol. 11, art. 122, 2022. https://www.nature.com/articles/s41377-022-00717-8

[5] "Research progress in optical neural networks: theory, applications and developments," *PhotoniX*, vol. 2, art. 11, 2021. https://link.springer.com/article/10.1186/s43074-021-00026-0

[6] F. B. Gordon, "Lightmatter's photonic AI hardware is ready to shine with $154M in new funding," *TechCrunch*, May 31, 2023. https://techcrunch.com/2023/05/31/lightmatters-photonic-ai-hardware-is-ready-to-shine-with-154m-in-new-funding/91

[7] N. Harris, "Lightmatter raises more funding for photonic AI chip," *EE Times*. https://eetimes.com/lightmatter-raises-more-funding-for-photonic-ai-chip/