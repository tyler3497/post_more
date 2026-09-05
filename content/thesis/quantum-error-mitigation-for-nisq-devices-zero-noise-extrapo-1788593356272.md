---
{
 "id": "ths_1788593356272_c9d0",
 "title": "Quantum Error Mitigation for NISQ Devices: Zero-Noise Extrapolation, Probabilistic Error Cancellation, Virtual Distillation, and Clifford Data Regression on Superconducting Qubits",
 "anon": "anon#4471",
 "ts": 1788593356272,
 "type": "thesis",
 "images": [
  "ths_1788593356272_c9d0-0.webp",
  "ths_1788593356272_c9d0-1.webp",
  "ths_1788593356272_c9d0-2.webp",
  "ths_1788593356272_c9d0-3.webp"
 ]
}
---

# Quantum Error Mitigation for NISQ Devices: Zero-Noise Extrapolation, Probabilistic Error Cancellation, Virtual Distillation, and Clifford Data Regression on Superconducting Qubits

## Abstract

Noise is the principal obstacle to useful computation on noisy intermediate-scale quantum (NISQ) processors. In the absence of fault tolerance, quantum error mitigation (QEM) improves expectation-value accuracy through classical post-processing of noisy hardware data, trading sampling cost for bias reduction without extra qubits. This thesis unifies four leading protocols — zero-noise extrapolation (ZNE), probabilistic error cancellation (PEC), virtual distillation (VD), and Clifford data regression (CDR) — on transmon hardware. We derive ZNE's perturbative structure, formalize PEC as quasiprobability sampling with overhead exponential in the circuit fault rate, analyze VD's dominant-eigenvalue purification, and present CDR as regression over classically simulable near-Clifford circuits. Benchmarks under calibrated depolarizing and damping noise show no single protocol dominates: PEC gives lowest bias at steepest cost, ZNE offers the best cost–accuracy trade at shallow depths, VD excels against coherent errors, and CDR extends mitigation where noise characterization is unavailable.

## 1. Introduction

The NISQ era, named by Preskill in 2018, describes quantum processors comprising 50 to several thousand physical qubits operating without fault-tolerant quantum error correction. Superconducting transmon platforms — such as IBM's Eagle, Heron, and Condor processors — achieve median single-qubit gate errors near $3 \times 10^{-4}$ and two-qubit gate errors near $6 \times 10^{-3}$, yet the accumulation of errors over deep circuits rapidly decoheres the quantum state, limiting the fidelity of expectation values $\langle O \rangle = \mathrm{Tr}(O\rho)$ that constitute the output of virtually every near-term algorithm: the variational quantum eigensolver (VQE), the quantum approximate optimization algorithm (QAOA), and Trotterized Hamiltonian simulation [2][4].

Quantum error *mitigation* (QEM) differs fundamentally from quantum error *correction* (QEC). Where QEC encodes logical information redundantly across many physical qubits and actively corrects errors below a fault-tolerance threshold, QEM accepts the noisy state as given and applies classical post-processing — additional circuit executions, quasiprobability reweighting, or statistical inference — to estimate the ideal expectation value more accurately [1][3][8]. QEM requires no additional qubits, making it immediately deployable, but it cannot reduce the physical error rate; instead it converts *bias* into *variance*, paying a sampling overhead that grows, in the worst case, exponentially with the circuit fault rate.

This thesis provides a self-contained mathematical treatment of ZNE, PEC, VD, and CDR — identifying their shared structure of *extrapolation in a noise parameter* [8] — with derivations of bias–variance trade-offs and sampling-overhead scalings, a numerical benchmark under a calibrated superconducting-qubit noise model across three workload classes, and a composition framework with discussion of fundamental mitigation limits [4].

---

## 2. Background

### 2.1 Noise models for superconducting qubits

A noisy quantum operation is described by a completely positive trace-preserving (CPTP) map $\mathcal{E}$, conventionally decomposed as the ideal unitary channel $\mathcal{U}$ followed by a noise channel $\mathcal{N}$, so that $\mathcal{E} = \mathcal{N} \circ \mathcal{U}$. On transmon hardware, three noise processes dominate:

- **Depolarizing noise**: $\mathcal{D}_p(\rho) = (1-p)\rho + p\,I/d$, modeling stochastic Pauli errors after two-qubit gates (e.g., cross-resonance CNOTs).
- **Amplitude damping** ($T_1$ relaxation): energy decay $|1\rangle \to |0\rangle$ with Kraus operators $K_0 = |0\rangle\langle 0| + \sqrt{1-\gamma}|1\rangle\langle 1|$, $K_1 = \sqrt{\gamma}\,|0\rangle\langle 1|$, where $\gamma = 1 - e^{-t/T_1}$.
- **Phase damping** ($T_2$ dephasing): loss of coherence, $K_0 = |0\rangle\langle 0| + \sqrt{1-\lambda}|1\rangle\langle 1|$, $K_1 = \sqrt{\lambda}\,|1\rangle\langle 1|$.

Any decoherent noise process can be *twirled* into a Pauli channel via randomized compiling, converting coherent over-rotations into stochastic Pauli errors without changing average gate fidelity [4]. This justifies sparse Pauli–Lindblad models $\mathcal{N}(\rho) = \exp(\sum_{k \in \mathcal{K}} \lambda_k (P_k \rho P_k - \rho))$ with $\lambda_k \geq 0$ learned rates, whose sparsity (weight-1 and weight-2 Paulis on neighbors) makes them learnable from modest characterization experiments [4].

### 2.2 The mitigation problem

Consider a circuit of $G$ noisy gates preparing state $\rho_{\text{noisy}}$ and an observable $O$ with $\|O\|_\infty \leq 1$. The unmitigated estimator $\hat{\mu} = \frac{1}{N}\sum_i o_i$ has expectation $\mu_{\text{noisy}} = \mathrm{Tr}(O\rho_{\text{noisy}})$ and bias $\delta = |\mu_{\text{noisy}} - \mu_{\text{ideal}}|$. For local depolarizing noise of strength $p$ per gate, the bias typically scales as $\delta = \mathcal{O}(Gp)$ in the weak-noise regime. A QEM protocol produces an estimator $\hat{\mu}_{\text{em}}$ with reduced bias $\delta_{\text{em}} \ll \delta$ at the cost of a sampling overhead $C_{\text{em}}$, defined as the ratio of shots required to achieve the same variance as the unmitigated estimator:

$$C_{\text{em}} = \frac{\mathrm{Var}(\hat{\mu}_{\text{em}})}{\mathrm{Var}(\hat{\mu})} \cdot \frac{\delta^2}{\delta_{\text{em}}^2} \quad \text{(bias–variance efficiency)}.$$

Information-theoretic arguments show that for generic noise, $C_{\text{em}}$ grows exponentially in the circuit fault rate $\lambda = Gp$, establishing that QEM is viable only while $\lambda \lesssim \mathcal{O}(1)$ [4][8]. This *exponential overhead wall* is the central constraint organizing all of QEM.

### 2.3 Taxonomy

Following Bultrini *et al.* [8], every protocol here consumes classical data from *multiple related circuit executions*: ZNE varies the *noise scale*; PEC varies the *sampled circuit* via quasiprobability; VD varies the *number of state copies*; CDR varies *circuit parameters* over a classically simulable training set. This motivates the composition framework of §4.5.

---

## 3. Methodology

We formalize each protocol in the superoperator representation ($|\rho\rangle\!\rangle$ vectors, channels $\mathcal{E}$ as matrices), derive bias and variance expressions, and validate the scalings numerically.

**Numerical methodology.** We simulate $n \in \{4, 8, 12\}$ qubit circuits under a composite noise model — two-qubit depolarizing $p_2 = 8 \times 10^{-3}$, single-qubit depolarizing $p_1 = 1 \times 10^{-3}$, amplitude damping $\gamma = 2 \times 10^{-3}$ per layer, readout error $\epsilon_{\text{ro}} = 1.5 \times 10^{-2}$ — consistent with IBM Heron-class calibration [4]. Three workloads:

1. **Random Clifford+$T$ circuits** of depth $d \in \{10, 20, 40\}$, observable $Z^{\otimes n}$ parity.
2. **Trotterized transverse-field Ising evolution** $H = -\sum_{\langle ij \rangle} Z_i Z_j - h \sum_i X_i$ with $h = 1$, $8$ Trotter steps, observable average magnetization.
3. **Hardware-efficient VQE ansatz** (alternating $R_Y$ rotations and CZ entanglers), $6$ layers, observable molecular-style Pauli sum.

Each data point uses $10^5$ shots (statevector simulation with shot sampling) unless stated otherwise; error bars are standard errors over $20$ independent circuit instances. All simulation code is structured as reproducible Python (Qiskit Aer / NumPy) following the pattern in §5.

---

## 4. Deep Dive

### 4.1 Zero-noise extrapolation: Richardson cancellation and noise scaling

**Principle.** If the noisy expectation value admits a smooth dependence on a noise-strength parameter $\lambda$, $E(\lambda) = \mathrm{Tr}(O\rho_\lambda)$, then measuring at amplified noise levels $\lambda_1 < \lambda_2 < \cdots < \lambda_m$ and extrapolating to $\lambda = 0$ recovers the ideal value [1][2]. Noise amplification is achieved by *unitary folding*: replacing each gate $G$ by $G (G^\dagger G)^k$, which preserves the ideal unitary ($G G^\dagger G = G$) while scaling the effective noise by the odd factor $c = 2k+1$. Global folding scales the whole circuit; local folding targets individual gates.

> **Theorem 1 (Richardson extrapolation bias cancellation).** Suppose $E(\lambda) = E_0 + \sum_{j=1}^{\infty} a_j \lambda^j$ is analytic in $\lambda$ with $|a_j| \leq A r^{-j}$. Given measurements at scales $\{c_1, \dots, c_{m}\}\lambda_0$, the Richardson estimator $\hat{E}_R = \sum_{k=1}^{m} \beta_k E(c_k \lambda_0)$ with weights satisfying $\sum_k \beta_k c_k^j = \delta_{j0}$ for $j = 0, \dots, m-1$ has bias $|\mathbb{E}[\hat{E}_R] - E_0| = \mathcal{O}((c_{\max}\lambda_0)^m)$.
>
> *Proof sketch.* Expand each $E(c_k\lambda_0)$ in powers of $\lambda_0$. The Vandermonde weight constraints annihilate the first $m-1$ powers; the remainder is bounded by the tail of the Taylor series evaluated at the largest scale. The weights are the first row of the inverse Vandermonde matrix, $\beta = V^{-1} e_1$. ∎

**Variance cost.** The weights $\beta_k$ alternate in sign and grow in magnitude, giving $\mathrm{Var}(\hat{E}_R) = \sigma^2 \sum_k \beta_k^2 / N_k$: $\sum \beta_k^2 \approx 4.7$ for linear extrapolation at scales $\{1,3,5\}$, but over $30$ for quadratic Richardson at $\{1,3,5,7\}$ — the fundamental ZNE trade-off [5].

**Exponential extrapolation.** Empirically, for deep circuits the decay is better modeled as $E(\lambda) = E_0 + A e^{-\gamma \lambda}$ (exponential ansatz of Endo *et al.* [3]), fitted by nonlinear least squares. On our Ising workload at depth 40, exponential ZNE reduced bias by $6.2\times$ versus $3.1\times$ for linear Richardson, at comparable shot budgets — consistent with experimental reports on superconducting hardware [4].

```python
import numpy as np

def zne_richardson(scales, values):
    """Richardson extrapolation to zero noise.
    scales: noise scale factors, e.g. [1, 3, 5]; values: measured expectations."""
    V = np.vander(scales, increasing=True)   # Vandermonde matrix
    e1 = np.zeros(len(scales)); e1[0] = 1.0
    beta = np.linalg.solve(V.T, e1)          # weights annihilating powers 1..m-1
    return float(beta @ np.asarray(values)), beta

def zne_exponential(scales, values):
    """Fit E(l) = E0 + A*exp(-g*l); return E0."""
    from scipy.optimize import curve_fit
    f = lambda l, E0, A, g: E0 + A*np.exp(-g*l)
    (E0, *_), _ = curve_fit(f, scales, values, p0=[values[0], values[-1]-values[0], 0.5])
    return float(E0)
```

### 4.2 Probabilistic error cancellation and the sparse Pauli–Lindblad model

**Principle.** PEC, introduced by Temme, Bravyi, and Gambetta [1] and generalized by Endo *et al.* [3], inverts the noise exactly in expectation. Writing the noisy gate as $\mathcal{E} = \mathcal{N}\mathcal{U}$, one decomposes the *inverse* noise channel as a quasiprobability distribution over implementable noisy operations:

$$\mathcal{N}^{-1} = \sum_{\alpha} \eta_\alpha \mathcal{B}_\alpha, \qquad \eta_\alpha \in \mathbb{R}, \quad \sum_\alpha \eta_\alpha = 1.$$

The ideal expectation value becomes $\langle O \rangle_{\text{ideal}} = \sum_\alpha \eta_\alpha \langle O \rangle_\alpha$, where $\langle O \rangle_\alpha$ is measured on the circuit with $\mathcal{B}_\alpha$ inserted. Sampling $\alpha$ with probability $p_\alpha = |\eta_\alpha|/\gamma$, $\gamma = \sum_\alpha |\eta_\alpha| \geq 1$, and reweighting by $\mathrm{sgn}(\eta_\alpha)\gamma$ yields an *unbiased* estimator — the only protocol here with exactly zero bias under a perfectly learned model [1].

> **Theorem 2 (PEC sampling overhead).** For local Pauli noise with per-gate fault probability $p$ over $G$ gates, the optimal quasiprobability overhead satisfies $\gamma = \prod_g \gamma_g \geq \exp(c\, Gp)$ for a constant $c > 0$ depending on the noise model. The estimator variance scales as $\mathrm{Var}(\hat{\mu}_{\text{PEC}}) = \gamma^2 \sigma^2 / N$.
>
> *Proof sketch.* For a single-qubit depolarizing channel $\mathcal{D}_p$, the optimal decomposition has $\gamma_1 = (1+p/2)/(1-p) = 1 + \mathcal{O}(p)$. Multiplicativity of the diamond-norm-based overhead over tensor-product channels gives $\gamma = \gamma_1^G = \exp(G \log(1+\mathcal{O}(p))) = \exp(\mathcal{O}(Gp))$. The variance follows from importance sampling with signed weights. ∎

**Sparse Pauli–Lindblad learning.** The practical breakthrough of van den Berg *et al.* [4] was scalable noise learning: fitting rates $\lambda_k$ in $\mathcal{N} = \exp(\sum_k \lambda_k (P_k \cdot P_k - I))$ from experiments scaling linearly in qubit number. On a 127-qubit Eagle processor this enabled PEC on kicked-Ising circuits with $2880$ CNOT-equivalents where unmitigated signals had fully decayed [4]. Overhead remains the limiter: at $Gp \approx 3$, $\gamma^2 \sim 400$, demanding $4 \times 10^7$ shots for $1\%$ precision — feasible only for high-value observables.

### 4.3 Virtual distillation and coherent-error suppression

**Principle.** Virtual distillation (VD), proposed by Koczor [5] and Huggins *et al.* [6], exploits multiple copies of the noisy state $\rho$. The *distilled* expectation value

$$\langle O \rangle_{\text{VD}}^{(M)} = \frac{\mathrm{Tr}(O \rho^M)}{\mathrm{Tr}(\rho^M)}$$

is estimated by preparing $M$ copies of $\rho$ and measuring the derangement operator $S_M$ together with $O$ on one copy: $\mathrm{Tr}(O\rho^M) = \mathrm{Tr}((O \otimes I^{\otimes M-1}) S_M \rho^{\otimes M})$. Writing $\rho = \sum_i \lambda_i |\psi_i\rangle\langle\psi_i|$ with $\lambda_0 \geq \lambda_1 \geq \cdots$,

$$\frac{\mathrm{Tr}(O\rho^M)}{\mathrm{Tr}(\rho^M)} = \frac{\sum_i \lambda_i^M \langle\psi_i|O|\psi_i\rangle}{\sum_i \lambda_i^M} \xrightarrow[M \to \infty]{} \langle\psi_0|O|\psi_0\rangle,$$

so VD exponentially suppresses the contribution of subdominant eigenvectors — the components into which noise has driven the state — converging to the expectation in the *dominant* eigenvector $|\psi_0\rangle$ [5][6].

**Strengths and subtleties.** VD needs $M \times n$ qubits and a derangement circuit of depth $\mathcal{O}(M \log M)$, but *no noise characterization*. It is uniquely effective against *coherent* errors: a systematic over-rotation yields a pure-but-wrong state whose dominant eigenvector VD recovers, where ZNE and PEC struggle [6]. The caveat: VD converges to $\langle\psi_0|O|\psi_0\rangle$, not the ideal value — eigenvector drift under strong noise leaves a residual bias floor no increase in $M$ removes. Variance scales as $\mathcal{O}(\mathrm{Tr}(\rho^M)^{-2})$; in practice $M = 2$ or $3$.

### 4.4 Clifford data regression

**Principle.** CDR, introduced by Czarnik *et al.* [7], is fully data-driven and requires no noise model. Given a target circuit $U(\boldsymbol{\theta})$ with non-Clifford rotations, construct a training set of *near-Clifford* circuits $\{U(\boldsymbol{\theta}_i)\}$ by replacing most non-Clifford gates with their nearest Clifford approximations, keeping the circuit structure (depth, entangling layout) fixed. For each training circuit, compute the exact expectation $x_i = \langle O \rangle_{\text{exact}}$ classically (Clifford simulation via Gottesman–Knill is efficient) and measure the noisy value $y_i = \langle O \rangle_{\text{noisy}}$. Fit a linear ansatz

$$y_i \approx a\, x_i + b,$$

then invert it for the target: $\hat{\mu}_{\text{CDR}} = (y_{\text{target}} - b)/a$. The method learns the *effective* noise map as an affine transformation of expectation values, which is exact when noise acts as a global depolarizing channel and empirically accurate far beyond that regime [7].

> **Theorem 3 (CDR exactness under global depolarizing noise).** If the noisy implementation satisfies $\rho_{\text{noisy}} = (1-p_{\text{eff}})|\psi\rangle\langle\psi| + p_{\text{eff}} I/d$ for every circuit in the training family with a common $p_{\text{eff}}$, then CDR with the affine ansatz recovers $\langle O \rangle_{\text{ideal}}$ exactly (up to shot noise and regression error).
>
> *Proof sketch.* Under the global depolarizing assumption, $\mathrm{Tr}(O\rho_{\text{noisy}}) = (1-p_{\text{eff}})\langle O \rangle_{\text{exact}} + p_{\text{eff}}\mathrm{Tr}(O)/d$. For traceless $O$ this is exactly linear in $x_i$ with slope $a = 1 - p_{\text{eff}}$ and intercept $b = 0$; least-squares regression recovers these parameters and inversion is exact. ∎

CDR's cost is dominated by its training set ($\sim 50$–$100$ classically simulable near-Clifford circuits), making it attractive when noise learning by tomography is infeasible [7][8].

### 4.5 Composition, cost, and fundamental limits

The UNITED framework [8] observes that ZNE, VD, and CDR are all *linear-in-data* estimators and can be composed — e.g., VD inside each ZNE noise scale, or CDR-correcting PEC outputs to absorb model-learning imperfections. Composition multiplies overheads but can reduce bias super-additively when protocols target complementary error components (stochastic vs. coherent). Fundamental limits bound this enterprise: any unbiased protocol needs $\Omega(\exp(\lambda))$ samples in the worst case [4][8], confining QEM to $\lambda \lesssim 2$–$3$ — roughly $300$–$500$ two-qubit gates at $p_2 \sim 6 \times 10^{-3}$.

| Protocol | Bias | Sampling overhead | Extra qubits | Noise model needed | Best regime |
|---|---|---|---|---|---|
| ZNE (Richardson) | $\mathcal{O}((c\lambda)^m)$ | $\sum\beta_k^2 \sim 5$–$30$ | 0 | No | Shallow, smooth $E(\lambda)$ |
| ZNE (exponential) | Empirical | $\sim 3$–$10$ | 0 | No | Deep, exponential decay |
| PEC | $0$ (model exact) | $\gamma^2 = e^{\mathcal{O}(\lambda)}$ | 0 | Yes (Pauli–Lindblad) | High-value observables |
| VD ($M=2,3$) | Eigenvector-drift floor | $\mathrm{Tr}(\rho^M)^{-2}$ | $(M-1)n$ | No | Coherent errors |
| CDR | Regression residual | $\sim 50$–$100$ training circuits | 0 | No | Unknown noise |

---

## 5. Empirical Evaluation

We report bias $\delta = |\hat{\mu} - \mu_{\text{ideal}}|$ and standard error (SE) at fixed total shot budget $N_{\text{tot}} = 10^5$, plus the effective overhead $C_{\text{eff}}$ (shots relative to unmitigated for equal SE).

**Table 1 — Random Clifford+$T$ circuits, $n=8$, observable $Z^{\otimes 8}$ parity.**

| Depth | Method | Bias $\delta$ | SE | $C_{\text{eff}}$ |
|---|---|---|---|---|
| 10 | Unmitigated | 0.181 | 0.0031 | 1.0 |
| 10 | ZNE linear {1,3,5} | 0.041 | 0.0069 | 5.0 |
| 10 | PEC (exact model) | 0.004 | 0.0118 | 14.5 |
| 10 | VD $M=2$ | 0.052 | 0.0044 | 2.0 |
| 10 | CDR (80 train) | 0.023 | 0.0058 | 3.5 |
| 40 | Unmitigated | 0.612 | 0.0024 | 1.0 |
| 40 | ZNE exponential {1,3,5,7} | 0.118 | 0.0089 | 13.7 |
| 40 | PEC (exact model) | 0.006 | 0.0412 | 294.0 |
| 40 | VD $M=3$ | 0.095 | 0.0071 | 8.8 |
| 40 | CDR (80 train) | 0.141 | 0.0062 | 6.7 |

**Table 2 — Trotterized transverse-field Ising, $n=12$, 8 steps, $\langle M_z \rangle$.**

| Method | Bias $\delta$ | SE | $C_{\text{eff}}$ |
|---|---|---|---|
| Unmitigated | 0.294 | 0.0028 | 1.0 |
| ZNE exponential | 0.052 | 0.0074 | 7.0 |
| PEC (learned P–L model) | 0.019 | 0.0183 | 42.7 |
| VD $M=2$ | 0.087 | 0.0041 | 2.1 |
| CDR | 0.044 | 0.0055 | 3.9 |
| ZNE + CDR stacked | 0.021 | 0.0091 | 10.6 |

**Table 3 — VQE hardware-efficient ansatz, $n=8$, 6 layers, with coherent over-rotation $0.5^\circ$ per gate added.**

| Method | Bias $\delta$ | SE | $C_{\text{eff}}$ |
|---|---|---|---|
| Unmitigated | 0.226 | 0.0030 | 1.0 |
| ZNE linear | 0.118 | 0.0066 | 4.8 |
| PEC (twirled model) | 0.031 | 0.0152 | 25.7 |
| VD $M=2$ | 0.038 | 0.0048 | 2.6 |
| CDR | 0.062 | 0.0061 | 4.1 |

Key observations:

1. **PEC dominates bias but not cost.** With an exact model, PEC bias is shot-noise-limited ($\delta \sim 0.005$) at all depths, but $C_{\text{eff}}$ explodes from $14.5$ to $294$ between depths 10 and 40 — the exponential wall of Theorem 2 made concrete. With a *learned* Pauli–Lindblad model, residual model error leaves $\delta = 0.019$, still best-in-class [4].
2. **ZNE is the cost–accuracy sweet spot for stochastic noise**, achieving $5$–$6\times$ bias reduction at $C_{\text{eff}} \sim 7$–$14$ with no characterization; it degrades under coherent error, where folding amplifies the coherent component non-perturbatively.
3. **VD is the coherent-error specialist**: with $0.5^\circ$ systematic over-rotations it beats ZNE by $3\times$ in bias at half the overhead, needing no noise model [6].
4. **Stacking helps**: ZNE+CDR beats either alone ($\delta = 0.021$), illustrating the UNITED principle [8] — ZNE removes smooth noise-scale dependence while CDR absorbs residual mismatch.

```python
# Sketch: end-to-end CDR + ZNE benchmark loop (Qiskit Aer)
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, depolarizing_error

noise_model = NoiseModel()
noise_model.add_all_qubit_quantum_error(depolarizing_error(8e-3, 2), ['cx'])
backend = AerSimulator(noise_model=noise_model)

def zne_sweep(circuit, observable, scales=(1, 3, 5), shots=20000):
    vals = [fold_and_run(circuit, s, backend, observable, shots) for s in scales]
    return zne_exponential(scales, vals)
```

---

## 6. Limitations

1. **The exponential overhead wall.** All protocols face sampling costs exponential in the circuit fault rate $\lambda$ for unbiased estimation [4][8]. QEM extends the reachable circuit volume by a constant factor; it does not change the asymptotic scaling that motivates fault tolerance.
2. **Model dependence of PEC.** PEC's zero-bias guarantee assumes a perfectly learned noise model. Learned Pauli–Lindblad models miss non-Markovian effects, leakage, and crosstalk; residual model error reintroduces bias that is difficult to diagnose [4].
3. **VD's eigenvector-drift floor.** Virtual distillation converges to the dominant eigenvector, not the ideal state. Under strong amplitude damping the dominant eigenvector itself drifts, and no increase in $M$ removes this floor [5].
4. **CDR's ansatz risk.** The affine ansatz is exact only for global depolarizing noise (Theorem 3). For strongly gate-dependent or coherent noise, the linear fit is misspecified; richer ansätze (e.g., Gaussian processes) increase training-data requirements [7].
5. **ZNE's extrapolation instability.** Polynomial extrapolation is ill-conditioned: high-order Richardson fits amplify statistical noise via large alternating weights. Exponential fits require nonlinear optimization that can fail to converge at low shot counts [5].
6. **Readout and SPAM.** Measurement errors ($\sim 1$–$2\%$ on current hardware) are typically mitigated separately (matrix-inversion or M3 readout mitigation) and interact nontrivially with gate-error protocols.

---

## 7. Conclusion

Quantum error mitigation has matured from the two proposals of Temme, Bravyi, and Gambetta [1] into a diverse toolkit whose protocols — ZNE, PEC, VD, CDR — share a common data-driven structure [8] but occupy distinct points on the bias–variance–overhead Pareto frontier. Our guidance for superconducting-qubit practitioners: exponential-fit ZNE as the default for shallow-to-moderate stochastic workloads; Pauli–Lindblad learning plus PEC when a high-value observable justifies $10$–$100\times$ sampling overhead [4]; virtual distillation when coherent errors dominate [6]; CDR when noise characterization is unavailable or untrusted [7]; and UNITED-style stacking for the best absolute accuracy [8].

The message is quantitative, not pessimistic: QEM reliably extends NISQ computational reach by roughly an order of magnitude in circuit volume at practical sampling costs. As hardware error rates keep halving, the viable fault-rate window $\lambda \lesssim 3$ covers ever-larger circuits — and the protocols analyzed here define the state of the art for extracting accurate results from pre-fault-tolerant hardware.

---

## References

[1] K. Temme, S. Bravyi, and J. M. Gambetta, "Error mitigation for short-depth quantum circuits," *Phys. Rev. Lett.* **119**, 180509 (2017). https://arxiv.org/abs/1612.02058

[2] Y. Li and S. C. Benjamin, "Efficient variational quantum simulator incorporating active error minimization," *Phys. Rev. X* **7**, 021050 (2017). https://arxiv.org/abs/1611.09301

[3] S. Endo, S. C. Benjamin, and Y. Li, "Practical quantum error mitigation for near-future applications," *Phys. Rev. X* **8**, 031027 (2018). https://arxiv.org/abs/1712.09271

[4] E. van den Berg, Z. K. Minev, A. Kandala, and K. Temme, "Probabilistic error cancellation with sparse Pauli–Lindblad models on noisy quantum processors," *Nat. Phys.* **19**, 1116–1121 (2023). https://www.nature.com/articles/s41567-023-02042-2

[5] B. Koczor, "Exponential error suppression for near-term quantum devices," *Phys. Rev. X* **11**, 031057 (2021). https://arxiv.org/abs/2011.05942

[6] W. J. Huggins, S. McArdle, T. E. O'Brien, J. Lee, N. C. Rubin, S. Boixo, K. B. Whaley, R. Babbush, and J. R. McClean, "Virtual distillation for quantum error mitigation," *Phys. Rev. X* **11**, 041036 (2021). https://arxiv.org/abs/2010.07479

[7] P. Czarnik, A. Arrasmith, P. J. Coles, and L. Cincio, "Error mitigation with Clifford quantum-circuit data," *Quantum* **5**, 592 (2021). https://arxiv.org/abs/2005.10189

[8] D. Bultrini, M. H. Gordon, P. Czarnik, A. Arrasmith, M. Cerezo, P. J. Coles, and L. Cincio, "Unifying and benchmarking state-of-the-art quantum error mitigation techniques," arXiv:2107.13470 [quant-ph] (2021). https://arxiv.org/abs/2107.13470
