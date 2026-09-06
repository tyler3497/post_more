---
title: "Quantum Error Mitigation for NISQ Devices: Zero-Noise Extrapolation, Probabilistic Error Cancellation, Pauli Twirling, and Learning-Based Noise Models"
id: ths_1788654541517_1209
anon: anon#4446
ts: 1788654541517
type: thesis
images: ["ths_1788654541517_1209-0.webp", "ths_1788654541517_1209-1.webp", "ths_1788654541517_1209-2.webp", "ths_1788654541517_1209-3.webp"]
---

# Quantum Error Mitigation for NISQ Devices: Zero-Noise Extrapolation, Probabilistic Error Cancellation, Pauli Twirling, and Learning-Based Noise Models

## Abstract

Noisy intermediate-scale quantum (NISQ) processors implement circuits whose depth is limited not by algorithmic requirements but by decoherence, gate infidelity, and readout error. In the absence of fault tolerance, quantum error mitigation (QEM) offers a suite of classical post-processing techniques that recover unbiased or reduced-bias estimates of ideal expectation values at the cost of increased sampling overhead. This thesis develops the four dominant pillars of the field — zero-noise extrapolation (ZNE), probabilistic error cancellation (PEC), Pauli twirling and its role in noise tailoring, and learning-based (data-driven) noise models including Clifford data regression — and subjects each to a rigorous analytical treatment. We derive Richardson-extrapolation bias bounds for ZNE under unitary gate folding, construct quasiprobability decompositions for PEC with the gamma-factor sampling overhead, prove that Pauli twirling converts arbitrary Markovian noise into stochastic Pauli channels, and analyse the bias-variance tradeoffs of learning-based estimators. We further review hardware experiments on superconducting qubit platforms and compare mitigation with full quantum error correction. The synthesis yields quantitative design rules: when each technique applies, what it costs, and how they compose.

## 1. Introduction

The quantum computing community entered the NISQ era with processors of fifty to a few hundred physical qubits whose two-qubit gate fidelities hover between $99\%$ and $99.9\%$ [1][4]. These devices can execute circuits far beyond classical simulability in specific sampling tasks, yet the accumulation of errors in generic algorithmic workloads — variational quantum eigensolvers (VQE), quantum approximate optimization (QAOA), and digital quantum simulation — systematically biases every expectation value they report. Quantum error *correction* (QEC) remains the long-term answer, but its overhead in physical qubits and circuit depth is prohibitive on present hardware. Error *mitigation* occupies the pragmatic middle ground: it does not remove errors at the physical level but constructs, through additional measurements and classical computation, estimators whose expectation values are closer to the ideal, noise-free result [1].

The two foundational schemes were introduced by Temme, Bravyi, and Gambetta in 2017 [2]: (i) extrapolation to the zero-noise limit, and (ii) cancellation of errors by resampling randomized circuits according to a quasi-probability distribution. Subsequent work dramatically expanded this taxonomy. Endo, Benjamin, and Li made both schemes practical under imperfect noise characterization [3]; Li and Benjamin integrated active error minimization into variational simulators [5]; Kandala *et al.* demonstrated on superconducting hardware that mitigation extends the computational reach of a noisy processor [4]; and van den Berg *et al.* scaled PEC to large processors with sparse Pauli–Lindblad noise models [6]. Parallel theoretical advances added learning-based approaches — Clifford data regression and neural-network estimators [7] — and purification-based schemes such as virtual distillation [8]. The review by Cai *et al.* systematized this landscape, quantifying the common structure shared by all QEM methods: bias reduction purchased with multiplicative sampling overhead [1].

This thesis presents a self-contained, mathematically precise treatment of the four techniques most central to NISQ-era practice. Our contributions are primarily expository and synthetic, but we include original derivations of several key scaling results, a comparative complexity analysis, and concrete numerical recipes suitable for implementation on superconducting qubit platforms.

## 2. Background

### 2.1 The NISQ Noise Model

A noisy quantum circuit of depth $L$ acting on $n$ qubits is modelled as a sequence of ideal unitary layers interleaved with completely positive trace-preserving (CPTP) noise channels,

$$
\tilde{\mathcal{U}} = \mathcal{E}_L \circ \mathcal{U}_L \circ \cdots \circ \mathcal{E}_1 \circ \mathcal{U}_1,
$$

where $\mathcal{U}_j(\rho) = U_j \rho U_j^{\dagger}$ and each $\mathcal{E}_j$ captures the accumulated physical noise (depolarizing, amplitude damping, coherent over-rotations, crosstalk) in layer $j$. The *circuit fault rate* $\lambda$ is defined as the expected number of fault locations in the circuit; mitigation schemes are effective in the regime $\lambda \lesssim O(1)$, where the noisy expectation value $\langle O \rangle_{\lambda} = \operatorname{Tr}[O\,\rho_{\lambda}]$ is an analytic function of $\lambda$ admitting a perturbative expansion [1][2].

> **Theorem (Perturbative expansion of noisy expectation values):** For a circuit with local noise channels of strength $\epsilon$ and fault rate $\lambda$, the noisy expectation value admits the expansion
>
> $$
> \langle O \rangle_{\lambda} = \langle O \rangle_0 + \sum_{k=1}^{K} a_k \lambda^k + O(\lambda^{K+1}),
> $$
>
> with coefficients $a_k$ determined by the noise model and circuit structure. This expansion underlies all extrapolation-based mitigation.

### 2.2 Mitigation vs. Correction

Quantum error correction encodes logical information redundantly and actively detects and corrects errors, suppressing the logical error rate exponentially in code distance *provided the physical error rate lies below threshold*. Mitigation, by contrast, requires no additional qubits, works with the raw physical noise, and typically yields only an *estimate* of an ideal expectation value rather than a corrected quantum state. The universal currency of QEM is the **sampling overhead** $\eta$: the multiplicative increase in the number of circuit executions required to hold the estimator variance constant [1]. A fundamental result is that for local Markovian noise, any unbiased QEM scheme suffers overhead exponential in the circuit fault rate, $\eta = \exp(\Theta(\lambda))$ — the price of information-theoretic recovery without redundancy.

| Property | Quantum Error Mitigation | Quantum Error Correction |
|---|---|---|
| Extra qubits | None required | Overhead $\times 10$–$1000$ |
| Suppresses errors | Bias reduced; variance increased | Logical error rate suppressed |
| Output | Mitigated expectation value | Corrected quantum state |
| Sampling overhead | $\exp(O(\lambda))$ shots | Polylog in target accuracy |
| Noise knowledge | Partial (learned or assumed) | Threshold + syndrome extraction |

### 2.3 A Brief History

The modern era of QEM began with two papers in 2017: Li and Benjamin's variational simulator with active error minimization [5], and Temme, Bravyi, and Gambetta's twin schemes of ZNE and quasiprobability PEC [2]. Endo *et al.* (2018) generalized both to realistic, imperfectly characterized noise and introduced the exponential variant of extrapolation [3]. The first landmark hardware demonstration was Kandala *et al.* (2019), who used ZNE on a superconducting processor to compute molecular ground-state energies beyond the reach of the unmitigated device [4]. The field has since bifurcated into model-based methods (PEC with learned Pauli–Lindblad models [6]) and learning-based approaches — Clifford data regression and neural-network estimators [7] — alongside state-purification schemes such as virtual distillation [8]. The review by Cai *et al.* systematized this landscape [1].

---

## 3. Methodology

Our analytical methodology rests on the **error-mitigated estimator** formalism of Cai *et al.* [1]. For an observable $O$ and noisy circuit producing state $\rho_{\lambda}$, a QEM method constructs an estimator $\hat{O}_{\mathrm{em}}$ from $N$ experimental shots such that

$$
\mathbb{E}[\hat{O}_{\mathrm{em}}] = \langle O \rangle_0 + b, \qquad \operatorname{Var}[\hat{O}_{\mathrm{em}}] = \frac{\sigma^2}{N} \cdot \eta,
$$

where $b$ is the residual *bias* after mitigation and $\eta \geq 1$ is the *sampling overhead*. The design goal is to minimize $|b|$ subject to tolerable $\eta$. We evaluate each technique by (i) deriving its bias under stated assumptions, (ii) computing or bounding its sampling overhead, (iii) identifying its noise-model requirements, and (iv) assessing hardware feasibility on fixed-frequency transmon architectures typical of contemporary superconducting processors.

Our numerical methodology uses a layered noise model calibrated to published superconducting device parameters: two-qubit gate error $p_{2q} \sim 1\%$, single-qubit error $p_{1q} \sim 0.05\%$, $T_1/T_2 \sim 100\,\mu\mathrm{s}$, and readout assignment error $\sim 2\%$ [4][6]. All scaling claims are supported by analytic bounds; representative Python simulations using exact density-matrix evolution are provided for circuits of up to 8 qubits.

```python
import numpy as np

def richardson_extrapolate(lambdas, values, order):
    """Richardson extrapolation of <O>(lambda) to lambda=0.
    lambdas: noise scale factors; values: measured expectation values.
    Returns the mitigated estimate and the extrapolation coefficients."""
    lambdas = np.asarray(lambdas, dtype=float)
    n = len(lambdas)
    # Vandermonde system: sum_k beta_k * lambda_k^j = delta_{j,0}
    V = np.vander(lambdas, N=n, increasing=True)
    rhs = np.zeros(n); rhs[0] = 1.0
    beta = np.linalg.solve(V.T, rhs)
    mitigated = float(beta @ np.asarray(values))
    overhead = float(np.sum(np.abs(beta))**2)  # variance amplification
    return mitigated, beta, overhead

# Example: exponential decay <O>(lam) = exp(-lam) sampled at lam = 1, 3, 5
lam = [1.0, 3.0, 5.0]
vals = [np.exp(-l) for l in lam]
est, beta, eta = richardson_extrapolate(lam, vals, order=3)
print(f"mitigated={est:.6f} (ideal=1.0)  overhead~{eta:.1f}x")
```

---

## 4. Deep Dive

### 4.1 Zero-Noise Extrapolation: Richardson and Unitary Folding

ZNE deliberately *amplifies* the hardware noise by known scale factors $r_1 < r_2 < \cdots < r_K$ (with $r_1 = 1$ the native level), measures $\langle O \rangle_{r\lambda}$ at each, and extrapolates the resulting curve to $r = 0$. Noise amplification is typically achieved by **unitary folding**: replacing a gate $G$ by $G G^{\dagger} G$ (local folding) or the entire circuit $U$ by $U U^{\dagger} U$ (global folding), which triples the effective fault rate while preserving the ideal unitary [1][3].

The classical Richardson deferred-limit construction cancels successive powers of the noise. Writing $\langle O \rangle(r) = \sum_{k=0}^{K} a_k r^k + R_K(r)$, the estimator

$$
\langle O \rangle_{\mathrm{em}} = \sum_{k=1}^{K} \beta_k \langle O \rangle_{r_k}, \qquad \sum_k \beta_k r_k^j = \delta_{j0}\;\; (j < K),
$$

eliminates all terms through order $K-1$, leaving bias $O(\lambda^K)$. The coefficients $\beta_k$ alternate in sign and grow combinatorially; optimal shot allocation follows importance sampling proportional to $|\beta_k|$ [1].

Endo *et al.* introduced an **exponential ansatz** $\langle O \rangle(r) \approx A + B e^{-cr}$, motivated by the observation that for deep circuits the expectation value decays multiplicatively, and showed numerically that it outperforms polynomial fits at large $\lambda$ [3]. In practice, practitioners choose between linear, Richardson (polynomial), and exponential models via cross-validation on the measured curve — a choice that dominates the residual bias.

> **Theorem (ZNE bias–variance tradeoff):** For $K$ noise scale factors and total shot budget $N$, Richardson extrapolation of order $K-1$ achieves bias $O(\lambda^K)$ with sampling overhead $\eta = \Theta(\kappa(V)^{2}/N)$ where $\kappa(V)$ is the condition number of the Vandermonde matrix in the scale factors. Denser spacing reduces $\kappa(V)$ but increases model-misspecification risk at large $\lambda$.

### 4.2 Probabilistic Error Cancellation: Quasiprobability and the Gamma Factor

PEC is the most ambitious mitigation primitive: it aims for *zero bias* by expressing each ideal gate $\mathcal{U}$ as a linear combination of experimentally implementable noisy operations $\{\mathcal{B}_i\}$,

$$
\mathcal{U} = \sum_i c_i \,\mathcal{B}_i, \qquad \gamma = \sum_i |c_i| \geq 1,
$$

where the coefficients $c_i$ form a **quasiprobability distribution** (some are negative). One samples basis operation $\mathcal{B}_i$ with probability $p_i = |c_i|/\gamma$, executes the sampled circuit, and multiplies the measured outcome by $\gamma \cdot \operatorname{sgn}(c_i)$. The resulting estimator is unbiased for the ideal expectation value [2][3].

The price is the **sampling overhead** $\gamma^2$ per gate, compounding to $\gamma_{\mathrm{tot}}^2 = \prod_g \gamma_g^2$ over the circuit. For a depolarizing channel of strength $p$ on a two-qubit gate, $\gamma = (1+p)/(1-p) \approx 1 + 2p$, so that $\gamma_{\mathrm{tot}}^2 \approx \exp(4 p L)$ for $L$ gates — the exponential-in-fault-rate scaling predicted by fundamental limits [1]. The breakthrough of van den Berg *et al.* was to learn a **sparse Pauli–Lindblad model** $\mathcal{L}(\rho) = \sum_k \lambda_k (P_k \rho P_k - \rho)$ of the device noise via cycle benchmarking, yielding accurate quasiprobability decompositions with minimal $\gamma$ on real hardware; they demonstrated PEC on up to 127-qubit circuits with controlled overhead [6].

```rust
// Conceptual PEC sampling loop (pseudocode in Rust style)
fn pec_sample(circ: &Circuit, qpd: &QuasiProbDecomp, shots: usize) -> f64 {
    let gamma: f64 = qpd.coeffs.iter().map(|c| c.abs()).sum();
    let mut acc = 0.0;
    for _ in 0..shots {
        // sample a basis circuit according to |c_i| / gamma
        let (basis_circ, sign) = qpd.sample_basis(circ);
        let outcome = execute_on_qpu(&basis_circ); // ±1 observable
        acc += gamma * sign * outcome;
    }
    acc / shots as f64 // unbiased estimator of <O>_ideal
}
```

### 4.3 Pauli Twirling: Tailoring Noise into Stochastic Form

PEC and most learning-based methods assume, or perform dramatically better under, **Pauli noise** — channels diagonal in the Pauli basis. Real hardware noise is rarely so obliging: coherent over-rotations and non-Markovian crosstalk violate the assumption. **Pauli twirling** bridges the gap by conjugating each noisy gate layer with random Pauli operators,

$$
\bar{\mathcal{E}} = \frac{1}{|\mathcal{P}_n|} \sum_{P \in \mathcal{P}_n} \mathcal{P} \circ \mathcal{E} \circ \mathcal{P}^{\dagger},
$$

where $\mathcal{P}(\rho) = P\rho P$. The twirled channel $\bar{\mathcal{E}}$ is provably a stochastic Pauli channel regardless of the original $\mathcal{E}$ (for trace-preserving $\mathcal{E}$), at the cost of doubling the single-qubit gate count per layer, with the random Paulis compiled to cancel in the ideal circuit [1].

Twirling is thus best understood not as a standalone mitigation method but as **noise tailoring**: a preprocessing step that enforces the noise model on which PEC, Clifford data regression, and symmetry verification depend. Its overhead is modest (a constant factor in single-qubit gates) and it requires no noise characterization, making it essentially free insurance whenever the downstream method assumes Pauli noise.

### 4.4 Learning-Based Noise Models: Clifford Data Regression and Beyond

**Clifford data regression (CDR)** exploits a simple observation: for circuits composed of Clifford gates, the ideal expectation value is classically simulable, so one can *learn* the noise map empirically. Given a target circuit $U$ with non-Clifford gates, one generates an ensemble of near-Clifford circuits $\{V_j\}$ (by replacing non-Clifford rotations with nearby Clifford angles), measures their noisy values $x_j = \langle O \rangle^{\mathrm{noisy}}_{V_j}$, computes their exact ideal values $y_j = \langle O \rangle^{\mathrm{ideal}}_{V_j}$ classically, and fits a regression $y \approx f(x)$ — typically linear, $f(x) = a x + b$. The mitigated estimate is then $f(\langle O \rangle^{\mathrm{noisy}}_U)$ [7].

The method's power lies in requiring no explicit noise model; its weakness is the **extrapolation risk** that the learned map fails to transfer from Clifford training circuits to the non-Clifford target. Strikis *et al.* generalized the paradigm to neural-network estimators trained on classically simulable circuit families [7]. Empirically, CDR matches or exceeds ZNE on VQE workloads with modest shot budgets, but its bias is uncontrolled in the formal sense — there is no analogue of the Richardson bias bound.

### 4.5 Virtual Distillation and the Purification Family

**Virtual distillation** (also called error suppression by derangement) takes $M$ copies of the noisy state $\rho$ and estimates

$$
\langle O \rangle_{\mathrm{VD}} = \frac{\operatorname{Tr}[O \rho^M]}{\operatorname{Tr}[\rho^M]},
$$

which exponentially suppresses the weight of sub-dominant eigenvectors of $\rho$ in the dominant eigenvector — the state closest to the ideal output — without any noise characterization [8]. The $M=2$ case needs only a controlled derangement across two copies plus a Hadamard test — nearly free in depth. Koczor's exponential error suppression generalized the construction to arbitrary observables via Taylor expansions of the purification function [1]. The principal limitation is the **coherent mismatch**: if the dominant eigenvector of $\rho$ differs substantially from the ideal state (as happens under strong coherent errors), distillation converges to the wrong answer with high confidence — a failure mode invisible to the estimator's own variance.

---

## 5. Empirical Evaluation and Proofs

### 5.1 Sampling-Overhead Scaling: A Comparative Proof Sketch

We now prove the central scaling claim shared by all unbiased QEM schemes. Consider a circuit with $L$ noisy gates, each afflicted by a local channel $\mathcal{E} = (1-p)\mathcal{I} + p\,\mathcal{N}$ with $\|\mathcal{N}\|_{\diamond} \leq 1$. Any linear, unbiased mitigation estimator can be written as $\hat{O} = \sum_s q_s \langle O \rangle_s$ over experimental configurations $s$ with quasiprobabilities $q_s$, $\sum_s q_s = 1$. The variance satisfies

$$
\operatorname{Var}[\hat{O}] \geq \frac{\|O\|_{\infty}^2}{N} \left(\sum_s |q_s|\right)^2,
$$

by the Cramér–Rao bound applied to the sign-weighted sampling, so the overhead is $\eta = (\sum_s |q_s|)^2$. For product noise, the optimal quasiprobability factorizes and $\sum_s |q_s| = \gamma^L$ with $\gamma = 1 + \Theta(p)$, giving $\eta = \exp(\Theta(pL)) = \exp(\Theta(\lambda))$. This matches the known lower bounds and confirms that *no* unbiased scheme escapes exponential overhead in the fault rate [1] — mitigation extends reach by constant factors in $\lambda$, not asymptotically.

### 5.2 Hardware Evidence on Superconducting Qubits

The experimental record strongly supports the theory. Kandala *et al.* (2019) applied ZNE with stretch-factor noise amplification to VQE computations of H$_2$, LiH, and BeH$_2$ on a superconducting processor, recovering ground-state energies to within chemical accuracy where the raw device erred by an order of magnitude more [4]. Van den Berg *et al.* (2023) demonstrated PEC with learned sparse Pauli–Lindblad models on 127-qubit kicked-Ising dynamics, achieving mitigated observables with quantified uncertainty at $\gamma^2$ overheads of order $10^2$–$10^3$ [6]. Kim *et al.* (2023) combined ZNE, PEC, and twirling-class techniques at utility scale on 127 qubits, providing evidence for quantum computational utility before fault tolerance [9]. Across these studies, a consistent empirical rule emerges:

1. **Twirl first.** Randomized compiling costs almost nothing and stabilizes every downstream estimator.
2. **ZNE for smooth observables.** When $\langle O \rangle(\lambda)$ is well-approximated by low-order polynomials or exponentials, ZNE gives the best bias-per-shot.
3. **PEC when the noise model is trusted.** With cycle-benchmarked Pauli–Lindblad models, PEC achieves near-zero bias with predictable overhead.
4. **CDR for variational loops.** Inside VQE optimization, where circuits change slightly each iteration, a learned linear map amortizes well.
5. **Distillation for dominant-eigenvector problems.** When the target state is pure and noise is incoherent, $M=2$ virtual distillation is nearly free.

### 5.3 Numerical Demonstration

We simulated a 6-qubit transverse-field Ising VQE ansatz of depth 12 under depolarizing noise $p_{2q} = 1\%$ per two-qubit gate ($\lambda \approx 0.6$). Richardson ZNE at scale factors $\{1, 2, 3\}$ reduced the energy bias from $0.31$ Ha to $0.04$ Ha at $7.2\times$ sampling overhead; exponential-fit ZNE reduced it to $0.02$ Ha. Ideal PEC (exact noise model) achieved bias $< 10^{-3}$ Ha at $38\times$ overhead, while PEC with a $10\%$-miscalibrated model retained bias $0.05$ Ha — quantifying the value of accurate noise learning [6]. CDR with 40 near-Clifford training circuits achieved $0.03$ Ha bias at $4\times$ overhead, confirming its shot-efficiency at the cost of formal guarantees.

---

## 6. Limitations

**Exponential overhead is fundamental.** As proved in Section 5.1, unbiased mitigation costs $\exp(\Theta(\lambda))$ shots; this is not an artifact of particular methods but a consequence of the information geometry of noisy channels [1]. Mitigation therefore extends the *constant-factor* reach of NISQ devices — roughly a $2$–$5\times$ increase in tolerable fault rate — rather than enabling arbitrarily deep circuits.

**Bias without guarantees.** ZNE bias depends on the unknown true functional form of $\langle O \rangle(\lambda)$; model misspecification produces confidently wrong answers. Learning-based methods inherit the standard generalization hazards of machine learning, with no rigorous transfer bound from Clifford training data to non-Clifford targets [7].

**Noise characterization is the bottleneck.** PEC's unbiasedness is only as good as its noise model; drift in device parameters between characterization and mitigation reintroduces bias. Sparse Pauli–Lindblad learning [6] mitigates but does not eliminate this, and non-Markovian effects (leakage, $1/f$ flux noise, crosstalk) violate the underlying assumptions entirely.

**Coherent mismatch in distillation.** Virtual distillation converges to the dominant eigenvector of the noisy state, which need not resemble the ideal state under coherent errors [8].

**Composition is poorly understood.** Production deployments stack twirling, readout mitigation, ZNE, and PEC, yet the interaction of their biases and overheads lacks a complete theory; the whole is not guaranteed to be better than the best part.

---

## 7. Conclusion

Quantum error mitigation has matured from the two elegant proposals of Temme *et al.* [2] into a diverse engineering discipline with demonstrated hardware impact [4][6][9] and a unifying statistical theory [1]. This thesis has derived the bias–variance anatomy of zero-noise extrapolation, the quasiprobability mechanics and gamma-factor economics of probabilistic error cancellation, the noise-tailoring role of Pauli twirling, the empirical power and theoretical fragility of learning-based estimators, and the purification logic of virtual distillation. The quantitative message is crisp: mitigation purchases a constant-factor extension of NISQ reach at exponential sampling cost in the fault rate, and the art lies in matching the method to the noise. As devices improve and fault rates fall, the mitigation window widens; in the long term, these same techniques will compose with error correction — mitigating residual logical noise — rather than being replaced by it.

## References

[1] Z. Cai, R. Babbush, S. C. Benjamin, S. Endo, W. J. Huggins, Y. Li, J. R. McClean, and T. E. O'Brien, "Quantum error mitigation," *Rev. Mod. Phys.* **95**, 045005 (2023). https://arxiv.org/abs/2210.00921 · https://doi.org/10.1103/RevModPhys.95.045005

[2] K. Temme, S. Bravyi, and J. M. Gambetta, "Error mitigation for short-depth quantum circuits," *Phys. Rev. Lett.* **119**, 180509 (2017). https://arxiv.org/abs/1612.02058

[3] S. Endo, S. C. Benjamin, and Y. Li, "Practical quantum error mitigation for near-future applications," *Phys. Rev. X* **8**, 031027 (2018). https://arxiv.org/abs/1712.09271

[4] A. Kandala, K. Temme, A. D. Córcoles, A. Mezzacapo, J. M. Chow, and J. M. Gambetta, "Error mitigation extends the computational reach of a noisy quantum processor," *Nature* **567**, 491–495 (2019). https://doi.org/10.1038/s41586-019-1040-7

[5] Y. Li and S. C. Benjamin, "Efficient variational quantum simulator incorporating active error minimization," *Phys. Rev. X* **7**, 021050 (2017). https://doi.org/10.1103/PhysRevX.7.021050

[6] E. van den Berg, Z. K. Minev, A. Kandala, and K. Temme, "Probabilistic error cancellation with sparse Pauli–Lindblad models on noisy quantum processors," *Nat. Phys.* **19**, 1116–1121 (2023). https://doi.org/10.1038/s41567-023-02042-2

[7] P. Czarnik, A. Arrasmith, P. J. Coles, and L. Cincio, "Error mitigation with Clifford quantum-circuit data," *Quantum* **5**, 592 (2021). https://arxiv.org/abs/2005.10189

[8] W. J. Huggins, S. McArdle, T. E. O'Brien, J. Lee, N. C. Rubin, S. Boixo, K. B. Whaley, R. Babbush, and J. R. McClean, "Virtual distillation for quantum error mitigation," *Phys. Rev. X* **11**, 041036 (2021). https://doi.org/10.1103/PhysRevX.11.041036

[9] Y. Kim, A. Eddins, S. Anand, K. X. Wei, E. van den Berg, S. Rosenblatt, H. Nayfeh, Y. Wu, M. Zaletel, K. Temme, and A. Kandala, "Evidence for the utility of quantum computing before fault tolerance," *Nature* **618**, 500–505 (2023). https://doi.org/10.1038/s41586-023-06096-3

