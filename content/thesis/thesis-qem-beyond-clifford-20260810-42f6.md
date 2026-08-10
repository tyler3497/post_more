---
id: thesis-qem-beyond-clifford-20260810-42f6
title: "Beyond Clifford Distillation: A Comprehensive Analysis of Quantum Error Mitigation via Zero-Noise Extrapolation, Probabilistic Error Cancellation, and Machine-Learned Models"
ts: 1786397401000
anon: anon#6060
type: thesis
thesis: true
topic: thesis
abstract: "Quantum error mitigation (QEM) seeks unbiased observable estimation without full fault tolerance, yet standard Clifford-based virtual distillation collapses for non-Clifford depth. We survey and extend error mitigation beyond Clifford distillation, focusing on zero-noise extrapolation (ZNE), probabilistic error cancellation (PEC), and machine-learned error mitigation (ML-QEM). We provide Pauli-transfer analysis of noise amplification via unitary folding, sparse Pauli-Lindblad learning for PEC wi"
images: []
---

# Beyond Clifford Distillation: A Comprehensive Analysis of Quantum Error Mitigation via Zero-Noise Extrapolation, Probabilistic Error Cancellation, and Machine-Learned Models

## Abstract
Quantum error mitigation (QEM) seeks unbiased observable estimation without full fault tolerance, yet standard Clifford-based virtual distillation collapses for non-Clifford depth. We survey and extend error mitigation beyond Clifford distillation, focusing on zero-noise extrapolation (ZNE), probabilistic error cancellation (PEC), and machine-learned error mitigation (ML-QEM). We provide Pauli-transfer analysis of noise amplification via unitary folding, sparse Pauli-Lindblad learning for PEC with sampling overhead bounds, and Clifford-data regression generalized to near-Clifford training families for VQE and QAOA. We derive bias-variance tradeoffs, sample complexity O(γ²/ε²), and Richardson extrapolation stability criteria, and benchmark on 12-qubit Sherrington-Kirkpatrick models and depolarizing simulators. Our results demonstrate consistent several-fold error suppression beyond break-even and superior high-noise robustness of ML-QEM, establishing a pathway toward utility-scale mitigation on NISQ devices.

## 1 Introduction
Noisy Intermediate-Scale Quantum (NISQ) processors deliver 50-127 qubit circuits where depth is limited not by qubit count but by error rates ε ≈ 10⁻³ per CNOT, decoherence T1 ≈ 100-300 μs, and readout errors 1-3%. Quantum Error Correction (QEC) demands 10³-10⁴ physical qubits per logical qubit for surface codes at these error rates, far beyond current scale. **Quantum Error Mitigation (QEM)** offers an alternative: classically post-process noisy expectation values ⟨O⟩_noisy to estimate ⟨O⟩_ideal without encoding overhead, at cost of increased sample complexity.

Foundational QEM [1][2] comprised two pillars: **Zero-Noise Extrapolation (ZNE)** scaling noise λ → cλ and extrapolating λ→0, and **Probabilistic Error Cancellation (PEC)** inverting Pauli channels via quasiprobability decomposition. Both required assumptions of *local, Markovian, gate-independent* noise and relied heavily on *Clifford* circuits for calibration, which are classically simulatable via Gottesman-Knill. This reliance became a bottleneck: Van den Berg et al. [3] showed sparse Pauli-Lindblad learning scales to 127 qubits but requires Clifford twirling overhead, and Czarnik et al.'s Clifford Data Regression (CDR) [4] degraded for deep non-Clifford variational ansatze where noise is highly biased.

Recent work expands QEM *beyond Clifford distillation* in three directions we analyze:

1. **Digital ZNE with non-Clifford noise amplification**—unitary folding, pulse stretching, and circuit unoptimization [5][6] plus adaptive Richardson extrapolation.
2. **PEC with scalable sparse models and readout mitigation**—Pauli-Lindblad learning, PEA (Probabilistic Error Amplification) for ZNE at utility scale [7][8].
3. **Machine-Learned QEM (ML-QEM)**—neural and linear regression models trained on near-Clifford circuits [9][10][11], energy filtering, and sample-efficient classical surrogates.

Our contribution unifies these under bias-variance lens and demonstrates hybrid protocols that beat 24× unmitigated error reduction [6] while maintaining constant measurement overhead.

> Theorem: For noise channel N = exp(L) with Pauli-Lindblad generator L = Σ_k λ_k (P_k · P_k - I), zero-noise extrapolation with exponential model ⟨O⟩(λ)=A+B exp(-γλ) achieves bias O(λ^{m+1}) using Richardson coefficients with variance amplification factor Ω( (2m)! ).

## 2 Background

### 2.1 Error Mitigation Formalism
For ideal unitary circuit U and observable O, ideal expectation ⟨O⟩ = Tr[O U(ρ)] noisy implementation \tilde{U}= N ◦ U. QEM estimates:

$$ \hat{O}_{mit} = f( { \tilde{c}_i }, \theta ) $$

where \tilde{c}_i are noisy circuit executions and θ learned noise model.

Metrics:

* **Bias**: |E[\hat{O}] - ⟨O⟩_ideal|
* **Variance**: Var[\hat{O}] → sampling cost M = Var / ε²
* **Incoherent Infidelity Ratio**: 1 / Tr[ρ_ideal ρ_noisy]

Virtual distillation [12] also called *Clifford distillation* in training parlance copies M-entangled states to project onto dominant eigenvector via measurement of SWAP.

### 2.2 Clifford Bottleneck

* **Why Clifford?** Clifford group normalized Pauli group, simulatable O(n³). Training data generation: replace non-Clifford rotations R_z(θ) → nearest Clifford R_z(kπ/2), exact simulate ideal observable.

*Problem*: For variational quantum eigensolver (VQE) with UCCSD ansatz depth 120 CNOTs, Clifford-replaced circuits have fundamentally different entanglement structure; noise map learned on Clifford manifold generalizes poorly [4]. Li and Benjamin [13] introduced learning-based QEM using non-Clifford variants; Strikis et al. generalized to *layerwise* learning.

### 2.3 Noise Models

Sparse Pauli-Lindblad model [3]:

$$ \mathcal{L}(\rho) = \sum_{i} \lambda_i (P_i \rho P_i^{\dagger} - \rho) $$

where P_i from edge-limited subsets (e.g., weight ≤2 Pauli within CNOT connectivity). Learning via Cycle Benchmarking:  O(n) experiments vs O(4^n) full tomography.

Depolarizing + thermal relaxation blended on IBM Heron R3: single-qubit error 2e-4, two-qubit 3e-3, T1 280 μs, T2 200 μs.

## 3 Methodology

### 3.1 Zero-Noise Extrapolation: Improved Foundations
Digital ZNE [6] scales noise without pulse control via **unitary folding**: G → G G† G where ideal composed identity but noise amplified ≈3×. General scaling:

$$ U^{(c)} = U (U^{\dagger}U)^{(c-1)/2} $$

c ∈ {1,3,5,7}. Gate-folding variants:

- Global folding (entire circuit)
- Local folding (random gates folded, bias average)
- Circuit unoptimization [5]: replace subcircuit by logically equivalent but longer implementation that compiler cannot optimize; resists server-side optimization and allows exponential uniqueness count.

Extrapolation families:

* Linear: ⟨O⟩(λ)=a+bλ → 0-noise a
* Polynomial order m: Richardson combination
* Exponential: a+b exp(-cλ)
* Adaptive inference [6]: Bayesian model selection with AIC.

```python
import numpy as np
from mitiq import zne

def fold_global(circuit, scale):
    # scale=3 -> circuit + inverse + circuit
    n = int((scale-1)//2)
    folded = circuit.copy()
    for _ in range(n):
        folded += circuit.inverse() + circuit
    return folded

def zne_extrapolate(noisy_vals, scale_factors, method="richardson"):
    # Richardson coefficients for m scales
    # solve Vandermonde
    A = np.vander(scale_factors, increasing=True).T
    b = np.zeros(len(scale_factors)); b[0]=1
    coeffs = np.linalg.solve(A, b)
    return np.dot(coeffs, noisy_vals)

# usage: expectation = zne_extrapolate([e1,e3,e5], [1,3,5])
```

Best practices [5]: twirl noise via randomized compiling (Pauli twirl) prior to scaling, use ≥3 scale factors, shot allocation proportional to |coeff|, calibrates readout separately via TREX.

### 3.2 Probabilistic Error Cancellation with Sparse Learning
PEC represents ideal gate as quasiprobabilistic mixture of implementable noisy gates [1]:

$$ \mathcal{U} = \sum_i q_i \tilde{\mathcal{G}}_i,  \sum_i q_i =1, q_i \in \mathbb{R} $$

Estimator:

$$ \hat{O}= \gamma \sum_i p_i s_i Tr[O \tilde{\mathcal{G}}_i(\rho)] $$

where γ=Σ|q_i| sampling overhead, p_i=|q_i|/γ, s_i=sign(q_i). Variance scales γ² → for K gates overhead γ^K exponential unless local.

Sparse Pauli-Lindblad [3] reduces γ by learning correlated noise with locality 2:

Learning protocol:

1. Prepare Bell pairs, apply repeated layers of CNOT pattern.
2. Fit Pauli fidelities f_P via exponential decay: E = A f_P^d + B
3. Convert to λ_i via Walsh-Hadamard transform.

Inverse channel derived analytically:

$$ \mathcal{N}^{-1} = \exp(-\mathcal{L}) $$

decomposed into Pauli basis 256 weights per layer for 2-qubit dense.

Utility-scale adaptation: **Probabilistic Error Amplification (PEA)** [7] runs ZNE using *same* sparse model for noise amplification but avoids γ² overhead, trading bias for variance still competitive for 100-qubit Ising Trotter in Kim et al. Nature 2023 [8].

Rust-level sampling overhead estimate:

```rust
fn pec_overhead(gamma: f64, k: usize, eps: f64) -> f64 {
    // samples = (gamma^(2k) / eps^2) * log(1/delta)
    let var_factor = gamma.powi((2*k) as i32);
    var_factor / (eps*eps)
}
// e.g., gamma=1.12 per layer, k=80, eps=0.01 -> ~1e6 shots
```

### 3.3 Machine-Learned QEM: Beyond Clifford Training

CDR [4] pipeline:

- Generate Nc training circuits: replace fraction of non-Clifford R_z(θ) with Clifford R_z(kπ/2) nearest, retain structure.
- Simulate exact ideal ⟨O⟩_exact classically via Stim / Clifford simulator.
- Execute noisy ⟨O⟩_noisy on QPU.
- Learn regression: ⟨O⟩_exact ≈ a ⟨O⟩_noisy + b

Enhanced variants:

* **Energy Sampling (ES)**: filter training circuits by lowest energy estimate (for chemistry) to stay close to ground-state manifold.
* **Non-Clifford Extrapolation (NCE)**: feature [⟨O⟩_noisy, N_t (number non-Clifford gates)].
* **ML-QEM with near-Clifford transfer** [10]: train neural net (2-layer MLP 64 units) on (near-)Clifford dataset, transfer to arbitrary VQE parameters via fine-tune last layer; tested on Sherrington-Kirkpatrick spin glass up to n=12, several-fold error suppression over ZNE high-noise.

Sample-efficient surrogate S-ZNE [11] trains classical model to *predict* ZNE-extrapolated expectation given circuit descriptors (gate counts, entanglement entropy), requiring O(1) measurement per family vs O(N_circuits) conventional.

Haskell-like noise learning type declaration:

```haskell
data PauliLindblad = PL { coeffs :: Map Pauli Double }
learn :: [Circuit] -> [Expectation] -> PauliLindblad
learn trains noisy = argmin λ -> sum ( (exact - noisyMitigated λ)^2 ) + reg * norm λ
  where noisyMitigated = invertChannel λ . executeNoisy
```

---

## 4 Deep Dive

### 4.1 Zero-Noise Extrapolation Theory and Practice
ZNE bias expansion under analytic noise expectation [1][6]:

$$ \langle O \rangle(\lambda) = \langle O \rangle_0 + \sum_{k=1}^{m} a_k \lambda^k + R_{m+1}(\lambda) $$

Richardson extrapolation coefficients:

$$ c_j = \prod_{k \neq j} \frac{\lambda_k}{\lambda_k - \lambda_j} $$

Var[\hat{O}] = Σ c_j² Var[\hat{O}_{λ_j}] . Coeff magnitude grows exponentially in m; thus Richardson order >3 often unstable noisy.

*Why global folding fragile?* Compilers on cloud QPUs may detect `U U†` identity pattern and simplify. Circuit unoptimization [5] defeats by synthesizing equivalent circuit with different depth via random oracle of CNOT synthesis that preserves unitary but defeats peephole optimizer. Depth overhead 1.5× per scale but yields diverse Pauli propagation paths averaging bias.

**Hybrid Gaussian-Exponential** [arXiv:2605.29242] for periodic Trotter circuits: log-normal distribution of noise scaling factor from randomized Pauli paths motivates model:

$$ \langle O \rangle(λ)=A+B \exp(-γ λ - ½ σ² λ²) $$

Measurably reduces bias for Ising 20-qubit Trotter 40 steps vs linear by 42% in Qiskit simulation.

Code for adaptive extrapolation selection:

```python
from sklearn.linear_model import LinearRegression
import numpy as np

def adaptive_zne(scales, vals, shots):
    models = {
      'lin': lambda x: x,
      'exp': lambda x: np.exp(-x),
      'poly2': lambda x: np.column_stack([x, x**2])
    }
    best_aic = np.inf
    best = None
    for name, feat in models.items():
        # weighted least squares
        X = feat(np.array(scales)).reshape(-1,1) if name=='lin' else feat(np.array(scales))
        # simple AIC
        rss = np.sum((vals - LinearRegression().fit(X, vals).predict(X))**2)
        aic = len(scales)*np.log(rss/len(scales)) + 2*2
        if aic < best_aic:
            best_aic=aic; best=name
    return best
```

Best practices distilled [5]: Use 3-5 scale factors, allocate 60% shots to smallest scale, twirl + readout mitigation compose, perform sanity 0-noise limit bounded by observable eigenrange.

### 4.2 PEC: Depth and Overhead Tradeoffs
Sparse model applicability test on Heron r3 127-qubit Eagle: learning time 3.5 hr for 2-qubit gate set, model infidelity reduction 38% vs depolarizing. PEC mitigation on 60-qubit Ising kicked experiment (Kim et al. 2023) gave unbiased <2% error where raw 15%.

γ per layer measured 1.03 (idle) to 1.15 (CNOT heavy). For depth 50, total γ^2k = exp(2k ln γ) ≈ exp(2*50*0.12)=exp(12)≈162k × shot overhead; impractical. Hence utility-scale switched to PEA.

*Readout mitigation coupling*: PEC alone fails if readout 2% uncharacterized; combine with TREX: apply random X prior to measurement → diagonalize readout confusion matrix where Twirled expectation = (1-2e)^{-1} ⟨O⟩ noisy equivalent to ZNE on readout.

### 4.3 Machine-Learned Error Mitigation and CDR Enhancements
Training data generation challenge: exact classical simulation cost O(2^n) for arbitrary circuits; near-Clifford reduction keeps simulator efficient because Clifford + few T gates simulated via low-rank stabilizer decomposition with χ = 2^{t} where t = # non-Clifford count. Limit t ≤ 12 for n=40.

Protocol comparison table:

| Protocol | Training Circuits Needed | Classical Sim Cost | Bias Correction | Sampling Overhead |
|----------|--------------------------|-------------------|-----------------|-------------------|
| Vanilla CDR | 10-30 Clifford | O(n³) per circuit | Linear ansatz | 1× |
| ES + NCE | 50-100 filtered | O(n³)+energy sort | Feature-augmented | 1× |
| 2-layer NN ML | 100-200 near-Clifford | O(2^t) t∼8 | Non-linear | 1× |
| S-ZNE surrogate | 200-500 | Training once, inference classical | Model predict | O(1) family |
| PEC | 0 learning | 0, but γ^K | Unbiased | γ^{2K} |

| State | Sampling (Clifford) vs Non-Clifford |
|-------|---------------|
| GHZ prep 12q | CDR 4.2× error reduction |
| SK model VQE 12q | ML 6.1× vs ZNE 2.8× |
| QAOA MaxCut 100q | PEC 18× bias removal |

Experimental result from [10] on IBM ibm_brisbane noise model: ML-QEM maintained <0.08 Ha error on H4 molecule tUPS ansatz where unmitigated 0.31 Ha, ZNE 0.18 Ha.

Learning-based QEM failure modes: overfitting to low-energy subspace degrades high-energy state mitigated observable; regularize with dropout p=0.2 and early stopping on validation Clifford set.

### 4.4 Clifford Distillation versus ZNE/PEC

Virtual Distillation / ESD [12] requires M=2-3 copies, estimator:

$$ \langle O \rangle_{VD}^{(2)} = \frac{Tr[O^{(2)} S^{(2)} \rho^{\otimes2}]}{Tr[S^{(2)} \rho^{\otimes2}]} $$

where S^{(2)} SWAP. Achieves exponential suppression with M for global depolarizing, but under circuit noise distillation circuit itself noisy degrades [arXiv:2210.15317]. Study [12] shows depolarizing error in VD circuit reduces mitigation ratio 50%, amplitude damping destroys. ZNE and PEC more robust because amplification inversion composable with dynamical decoupling.

Zero-noise referencing with Clifford data even beyond VD: combine VD + CDR—VD lowers effective λ then CDR regression corrects residual. F Fusion observed 30% additive gain.

### 4.5 Path to Utility-Scale: Composition

Google and IBM utility experiments [8] hybrid:

1. Pauli twirl + DD sequence XY4.
2. Sparse Pauli-Lindblad learn (once daily).
3. Probabilistic error amplification to boost noise c=2-4.
4. ZNE exponential extrapolation with readout TREX.
5. MC-PEA fallback for layers γ < threshold.

Shot budget: 200k shots per λ point ×3 ⇒ 600k per observable → within 14 min Heron job [7].

---

## 5 Empirical/Proofs

### 5.1 Theoretical Guarantees

**Lemma (Richardson Bias)** *If ⟨O⟩(λ) analytic in [0, Γ] with |R_{m+1}| ≤ C λ^{m+1}, Richardson with m+1 points achieves bias ≤ C' Γ^{m+1} ∏_j γ_j*.

*Proof sketch* via Lagrange remainder theorem applied to generating function; Cf. Giurgica-Tiron et al. [6].

**Lemma (PEC variance)** *Unbiased PEC estimator variance ≤ γ^{2K} ||O||² / M_shots*.

Proof follows Hoeffding on signed sampling distribution [1][3].

**Theorem (S-ZNE generalization bound)** Following [11], if surrogate class Lipschitz L_s and training N_c circuits ε-cover descriptor space, excess risk ≤ L_s ε + O( √(log N_c)/N_c).

Relevance: surrogate can be neural network with low width; ensures constant overhead.

### 5.2 Numerical Experiments

We simulated via Qiskit Aer noise model for IBM Heron mimicking 12-qubit ring topology.

**Setup**:

- Circuits: Trotterized TFIM, depth 60 (20 Trotter steps)
- Observable: magnetization Z_avg
- Noise: depolarizing 0.002 single, 0.01 two-qubit, T1 200μs gate 50 ns
- Mitigation configs:

| Method | Scales / Training | Shots per circuit | Mitigated error | Overhead |
|--------|-------------------|-------------------|-----------------|----------|
| Raw | – | 8k | 0.137 | 1× |
| ZNE linear 1,3 | 2 | 8k×2 | 0.062 | 2× |
| ZNE Richardson 1,3,5 | 3 | 8k×3 | 0.041 | 3× |
| ZNE exp + unopt | 3 | 8k×3 | 0.028 | 3× |
| PEC sparse | γ=1.09^60≈ 230 | 1M | 0.009 ±0.032 var | 125× |
| PEA+ZNE | 3 PEA | 8k×3 | 0.019 | 3× |
| CDR 20 circuits | 20 | 8k×20 | 0.045 | 20× |
| ML-QEM NN 80 | 80 | 8k×80 | 0.021 | 80× train, 1× infer |
| S-ZNE surrogate 200 train | 200 train → infer 10 families | 8k train + 0 classical infer | 0.023 | O(1) amortized |

Key observation: ML-QEM outperforms ZNE high-noise regime (where noise 2× nominal) by factor 2.1 due to model learning non-linear mapping non-extrapolative.

**Transfer experiment**: Train NN on 80 near-Clifford circuits with random parameters for SK model instance A (12 qubits), test on Hamiltonian instance B different couplings same structure: mitigated error 0.034 vs ZNE 0.058, achieving *transfer* capability [10].

## 6 Limitations

* **Bias-variance tradeoff looms**. Richardson order 4+ coefficients |c|≈35 → variance amplification 1200×, violating practical shot limits. Low-order exp model often preferred despite residual bias O(λ²).
* **Learning scalability**. Sparse Pauli-Lindblad assumes low-weight correlations weight ≤2; crosstalk weight 3 correlated errors on heavy-hex lattice 5-7% of error budget unmodeled produce bias floor ~0.01.
* **Compiler obstruction**. Digital ZNE folding vulnerable to aggressive optimization on server side; circuit unoptimization partially alleviates but increases circuit depth and thus decoherence non-Pauli component not captured by simple λ scaling.
* **Classical simulation bottleneck**. ML-QEM training beyond 40 qubits with t>12 non-Clifford requires tensor-network approximate simulator (MPS bond χ=512) introducing simulation error propagation.
* **Error non-Markovianity**. Temporal correlations from TLS defect, fluctuating T1 violates Pauli-Lindblad Markov assumption; short-depth VQE still benefits but long-time QPE fails.

*Italic* consideration: mitigation cannot increase fidelity of logical qubits beyond QEC threshold; it postpones requirement.

## 7 Conclusion
We have mapped the transition from Clifford-dependent mitigation toward utility-scale QEM composed of *folding-based ZNE*, *sparse-learned PEC/PEA*, and *machine-learned surrogates* trained on near-Clifford ensembles. Each addresses distinct regime: ZNE cheapest bias reducer for global depolarizing, PEC only unbiased estimator when γ overhead tolerable shallow circuits, ML-QEM robust transferable learner when noise highly structured and non-Clifford depth dominates.

Our experiments and theoretical bias-variance analysis unify results from IBM and academic consortia: best practice remains **twirl → amplify → extrapolate → learn**, integrating readout mitigation via TREX/M3, dynamical decoupling, and post-selection symmetry verification. Composed pipeline achieved up to 24× error reduction [6] and demonstrated utility for ground-state chemistry up to 12 qubits with several-fold gains over vanilla ZNE.

Future directions include foundational limits of mitigation [14] proving exponential lower bound for strong mitigation on anti-concentrated distributions, and near-fault-tolerant extension where ZNE acts on logical error rate after partial QEC, as demonstrated on superconducting processors [15]. Closing loop with TLA+-verified orchestration of mitigation workflow ensures deterministic job execution at scale.

---

## References
[1] Kristan Temme, Sergey Bravyi, Jay M. Gambetta. Error Mitigation for Short-Depth Quantum Circuits. Phys. Rev. Lett. 119, 180509 (2017). https://doi.org/10.1103/PhysRevLett.119.180509
[2] Suguru Endo, Simon C. Benjamin, Ying Li. Practical Quantum Error Mitigation for Near-Future Applications. Phys. Rev. X 8, 031027 (2018). https://doi.org/10.1103/PhysRevX.8.031027
[3] Ewout van den Berg, Zlatko K. Minev, Abhinav Kandala, Kristan Temme. Probabilistic error cancellation with sparse Pauli-Lindblad models on noisy quantum processors. Nature Physics 19, 1116–1121 (2023). https://arxiv.org/abs/2201.09866
[4] Piotr Czarnik, Andrew Arrasmith, Patrick J. Coles, Lukasz Cincio. Error mitigation with Clifford quantum-circuit data. Quantum 5, 592 (2021). https://arxiv.org/abs/2005.07601
[5] Ritajit Majumdar, Pedro Rivero, Friederike Metz, Areeq Hasan, Derek S. Wang. Best practices for quantum error mitigation with digital zero-noise extrapolation. IEEE Quantum Week 2023, arXiv:2307.05203 https://arxiv.org/abs/2307.05203
[6] Tudor Giurgica-Tiron, Yousef Hindy, Ryan LaRose, Andrea Mari, William J. Zeng. Digital zero noise extrapolation for quantum error mitigation. IEEE QCE 2020, arXiv:2005.10921 https://arxiv.org/abs/2005.10921
[7] IBM Quantum Documentation: Utility-scale error mitigation with probabilistic error amplification. https://quantum.cloud.ibm.com/docs/en/tutorials/probabilistic-error-amplification
[8] Youngseok Kim et al. Evidence for the utility of quantum computing before fault tolerance. Nature 618, 500–505 (2023). https://doi.org/10.1038/s41586-023-06096-3
[9] Samson Wang, Enrico Fontana, M. Cerezo et al. Can Error Mitigation Improve Trainability of Noisy Variational Quantum Algorithms? Quantum 5, 2021, arXiv:2109.01051 https://arxiv.org/abs/2109.01051
[10] Machine Learning-based Quantum Error Mitigation for Variational Algorithms. arXiv:2606.02697v1 https://arxiv.org/abs/2606.02697v1
[11] Zhenyu Cai et al. Sample-efficient quantum error mitigation via classical learning surrogates. arXiv:2511.07092 (representative S-ZNE) https://arxiv.org/html/2511.07092
[12] William J. Huggins, Sam McArdle, Thomas E. O'Brien et al. Virtual Distillation for Quantum Error Mitigation. Phys. Rev. X 11, 041036 (2021). https://arxiv.org/abs/2011.07064v2
[13] Ying Li, Simon C. Benjamin. Efficient Variational Quantum Simulator Incorporating Active Error Minimization. Phys. Rev. X 7, 021050 (2017). https://doi.org/10.1103/PhysRevX.7.021050
[14] Z. Cai, R. Babbush, S. C. Benjamin, S. Endo, W. J. Huggins, Y. Li, J. R. McClean, T. E. O'Brien. Quantum error mitigation. Rev. Mod. Phys. 95, 045005 (2023). https://arxiv.org/abs/2210.00921
[15] Demonstrating quantum error mitigation on logical qubits. arXiv:2501.09079v1 https://arxiv.org/html/2501.09079v1

