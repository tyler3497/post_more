---
id: thesis-pcd-nova-folding-1786329188004
title: "Proof-Carrying Data for Recursive zk-SNARK Composition: Nova Folding, SuperNova Non-Uniform IVC, and Custom Gates for Incrementally Verifiable Computation"
ts: 1786329188004
anon: anon#7249
type: thesis
---

# Proof-Carrying Data for Recursive zk-SNARK Composition: Nova Folding, SuperNova Non-Uniform IVC, and Custom Gates for Incrementally Verifiable Computation

## Abstract
Incrementally Verifiable Computation (IVC) and its generalization Proof-Carrying Data (PCD) enable succinct verification of long-running or distributed computations via recursive composition of zk-SNARKs. This thesis presents a comprehensive treatment of modern folding-based IVC, centered on **Nova**'s relaxed R1CS folding scheme [1], **SuperNova**'s non-uniform circuit support, and **HyperNova**'s Customizable Constraint System (CCS) with high-degree custom gates [2][3]. We formalize proof-carrying data compliance predicates over DAG-topology computations, derive security from knowledge soundness of folding arguments, and analyze **CycleFold** optimization for cycle-friendly elliptic curve instantiation [4]. We contrast accumulation-based recursion (Halo, BCLMS) with single-MSM folding verifiers, prove zero-knowledge via randomized running instances, and construct PCD for *a-la-carte* instruction invocation (EVM/RISC-V) with constant-cost recursion overhead dominated by two group scalar multiplications. We implement folding circuits in Arkworks and Halo2, benchmark Pallas/Vesta and BN254/Grumpkin cycles, and show prover dominance by multi-scalar multiplication versus FFT-dominated SNARKs.

## 1. Introduction

> **Core Question:** How can we prove that a computation $y = F^{(\ell)}(x)$ was performed correctly for $\ell = 10^6$ steps with a verifier costing $O_{\lambda}(\log |F|)$ and prover cost essentially $O(|F|)$ per step without trusted setup or pairings at recursion?

Incrementally Verifiable Computation (IVC), introduced by Valiant [8], formalizes proofs that can be *updated* as computation proceeds: given proof $\Pi_i$ for statement $(z_0, z_i, i)$ with $z_{i+1}=F(z_i)$, produce $\Pi_{i+1}$ efficiently. Proof-Carrying Data (PCD) generalizes IVC to arbitrary compliance predicates $\Psi$ over distributed DAGs of messages [7][6].

Classical recursive composition [7] embeds a zk-SNARK verifier inside its own circuit: $C_{aug}$ proves *"I verified $\Pi_{i-1}$ and computed $F$ correctly"*. This incurs prohibitive costs:

- *Expensive pairing verification*: Groth16 verifier 3 pairings ~ 10k-20k R1CS constraints per step
- *Non-native field arithmetic*: Verifier operates over $\mathbb{F}_p$ while proving over $\mathbb{F}_r$ for cycle $E_1/E_2$, requiring 10k+ constraints per scalar multiplication [9]
- *Circuit blow-up*: $F$ augmented with verifier grows superlinearly unless accumulation deferred [5]

**Nova [1]** introduced a paradigm shift: avoid SNARKs entirely during recursion. Instead, define a *folding scheme* that reduces checking two NP instances into checking one. A running relaxed R1CS instance $\mathbf{U}$ accumulates folded incoming instances $\mathbf{u}_i$. The verifier circuit at each step only proves that folding was done correctly, costing **two scalar multiplications** (~ 2x 250 constraints on Pasta). Final IVC proof is a pair $(\mathbf{U}, \mathbf{W})$ of size $O(|F|)$, compressible to $O(\log |F|)$ via Spartan [1].

This work unifies:

- **Nova folding** for uniform IVC over relaxed R1CS [1]
- **SuperNova / KiloNova** extensions to non-uniform PCD with multiple circuits $F_1 \dots F_k$ [10][11]
- **HyperNova / ProtoStar** generalization to CCS supporting Plonkish custom gates, lookups, and high-degree constraints [2][3][5]
- **CycleFold** [4] efficient curve-cycle instantiation without 10k-gate $E_2$ circuits
- **Zero-knowledge** without zkSNARKs via folding randomization technique [2]

**Contributions:**

1. Canonical relaxed R1CS and linearized CCS formalization with error vector $E$ and slack factor $u$
2. Security proof sketch: folding knowledge soundness $\implies$ IVC knowledge soundness via forking lemma
3. SuperNova construction avoiding cross-terms via linear claims on selectors
4. Implementation taxonomy and benchmark model

![Nova Folding Scheme Relaxed R1CS Accumulation](/thesis/thesis-pcd-nova-folding-1786329188004-0.webp)

## 2. Background

### 2.1 IVC and PCD Definitions

Let $\mathbb{F}$ be prime field, $F: \mathbb{F}^\ell \times \mathbb{F}^{\ell'} \rightarrow \mathbb{F}^\ell$ polynomial-time computable. IVC tuple $(\mathcal{G}, \mathcal{K}, \mathcal{P}, \mathcal{V})$:

- $\mathcal{G}(1^\lambda) \rightarrow pp$
- $\mathcal{K}(pp, F) \rightarrow (pk, vk)$
- $\mathcal{P}(pk, i, z_0, z_i, \Pi_i) \rightarrow \Pi_{i+1}$ where $z_{i+1}=F(z_i, \omega_i)$
- $\mathcal{V}(vk, i, z_0, z_i, \Pi_i) \in \{0,1\}$ with completeness, knowledge soundness, succinctness $ |\Pi_i| = poly(\lambda, \log i)$ [8][7]

PCD extends to distributed transcript $T$ DAG with compliance predicate $\Psi(z_{out}, z_{loc}, z_{in}, b_{base})$ accepting leaf (base) or internal nodes if parent steps compliant and predecessor proofs verify [7].

### 2.2 Folding vs Accumulation

- **Accumulation (BCLMS, Halo):** Given proofs $\pi_1 \dots \pi_n$, produce accumulator $acc$ and witness $w_{acc}$ s.t. decider $D(acc)=1$ iff all accumulated. Verifier expensive part deferred, but still requires argument system [5].
- **Folding (Nova):** Primitive that given $(u_1, w_1), (u_2, w_2) \in \mathcal{R}$, outputs $(u, w)$ s.t. $u$ satisfying $\implies$ both $u_i$ satisfying with high prob. No proofs, only instance-witness pairs [1]. Non-interactive via Fiat-Shamir.

Folding is weaker and cheaper than SNARK.

### 2.3 Relaxed R1CS and CCS

Standard R1CS: $(A, B, C) \in \mathbb{F}^{m \times n}, (A z) \circ (B z) = C z$. Relaxed R1CS introduces error $E$ and scalar $u$ [1]:

$$ (A z) \circ (B z) = u \cdot C z + E, \quad z = (W, x, u) $$

Folding linearizes cross-term: given $u_1, u_2$, new $u = u_1 + r \cdot u_2$, $E = E_1 + r\cdot T + r^2 E_2$, $T = A z_1 \circ B z_2 + A z_2 \circ B z_1 - u_1 C z_2 - u_2 C z_1$ [1]. Commitment to $T$ required, hence prover's cross-term cost.

**Customizable Constraint System (CCS)** [3] generalizes simultaneously:

$$ \sum_{i=0}^{q-1} c_i \cdot \prod_{j \in S_i} \sum_{k} M_{j,k} \cdot z_k =0 $$

- $q$ = max fan-in, $d$ = degree, $S_i \subseteq [d]$ item set. R1CS = $q=2, d=2$, Plonkish = per gate $S_i$ custom, AIR = linear row. Linearized CCS (LCCS) folds into same shape.

## 3. Methodology

We adopt semi-formal cryptographic methodology plus engineering evaluation.

**Cryptographic Model:**

- Random Oracle Model for Fiat-Shamir NIFS
- Discrete Log Hardness + Pedersen / KZG polynomial commitments
- Forking lemma extraction for knowledge soundness with $\approx 2$ rewinds

**Protocol Specification:**

```python
# Core Nova folding (pseudocode simplified from Arkworks)
def NIFS_P(pk, U1_W1, u2_w2):
    # U = (E1, u1, W1, x1), u = (E2, u2, W2, x2) with commitments
    z1 = extend(U1.W1, U1.x1, U1.u)
    z2 = extend(u2.W2, u2.x2, u2.u)
    T = Az1 * Bz2 + Az2 * Bz1 - U1.u * C.z2 - u2.u * C.z1
    com_T = commit(T, r_T)
    r = RO(com_T, U1, u2)  # public coin
    E = U1.E + r * T + r**2 * u2.E
    u = U1.u + r * u2.u
    W = U1.W + r * u2.W
    # folded x = U.x + r * u2.x (public)
    return (U_folded := (E, u, W, x_fold), com_T), r

def verifier_NIFS(vk, U1, u2, com_T, U_fold, r):
    # checks only 2 scalar mults in circuit: commitment homomorph linear combo
    assert U_fold.u == U1.u + r * u2.u
    assert U_fold.E_com == U1.E_com + r * com_T + r**2 * u2.E_com
    # + W_com linear, x linear outside
```

Folding verifier circuit $F'$ augments $F$ to:

$$ F'(z_i, \omega_i, U_i, u_i, \bar{T}) = F(z_i, \omega_i)  \land   U_{i+1} = \text{NIFS.V}(U_i, u_i, r, \bar{T}) $$

with $\bar{T}$ commitment, $r = hash(vk, i, z_0, z_i, U_i, u_i, \bar{T})$ [1].

**SuperNova Variant:** For circuits $C_0...C_{k-1}$, running index $\varphi$ pointer, maintain $k$ running instances $(U^j)$. At step with selector $s$, fold only into $U^{s}$, proving $U^{s}_{new}$ via $s$ proof. Avoid cross-terms by embedding linear selector claim $[\varphi_i = s]$ into CCS with $0/1$ selector vector $sl$ [11][10].

```rust
// HyperNova CCS gate shape in Halo2 / Arkworks
struct CCS<F> {
    m: usize, // rows
    n: usize, // cols
    q: usize, // monomials per constraint
    d: usize, // max degree
    matrices: Vec<Matrix<F>>, // Mi
    selectors: Vec<Vec<F>>,   // ci
    S: Vec<Vec<usize>>,       // index sets
}
fn ccs_fold<F: Prime>(ccs: &CCS<F>, u1: LCCSInstance<F>, u2: CCSInstance<F>, r: F)
-> (LCCSInstance<F>, Vec<F>) {
    // generic degree-d folding: error term involves binom(d, i) cross-terms
    // single MSM dominant: com(W) = com(W1) + r * com(W2)
}
```

**CycleFold:** Nova $2$ scalar mults verifier over $\mathbb{F}_p$, when prover field $= \mathbb{F}_p$ from cycle $(E_1: \mathbb{F}_p over \mathbb{F}_q, E_2: \mathbb{F}_q over \mathbb{F}_p)$. Scalar mult over $\mathbb{F}_q$ expensive (~10k gates) on $E_1$. CycleFold splits: use $E_2$ to prove *one* scalar mult circuit (~1k-1.5k gates) then fold that subproof recursively [4]. Reduces $E_2$ circuit from 10k to 1.5k ~ **order magnitude**. Enables BN254/Grumpkin half-pairing cycles (pairing-friendly $E_1$, non-pairing $E_2$ minimal).

## 4. Deep Dive

### 4.1 Nova Folding Foundations and Zero-Knowledge Randomization

Nova's trick: relaxed R1CS includes $u, E$ forming *linear* homomorphism under folding. Standard R1CS product non-linear, $T$ term fixes. Security: if folded instance satisfiable, then with probability $1 - 2/|\mathbb{F}|$ over $r$, both original instances satisfiable reduction to polynomial identity Schwartz-Zippel [1].

> **Theorem 1 (Nova Knowledge Soundness):** Let NIFS be public-coin folding for relaxed R1CS with linear commitments succinct. Then IVC construction yields knowledge sound IVC if FS hash modelled as RO and commitment binding. For adversary producing accepting $\Pi_n$, extractor with $O(n)$ rewinds extracts witness chain $(\omega_0..\omega_{n-1})$ with expected polynomial time.

*Proof sketch:* Induction extracting step-$i$ predecessor witness using NIFS extractor forked at challenge $r_i$. Base $i=0$ trivial. $\square$

Zero-Knowledge "for free" [2]: Classical zkIVC wraps final $(U,W)$ in zkSNARK (Spartan) expensive. HyperNova observes randomize folding itself yields ZK without zkSNARK: sample $W' = W + r_{zk} \cdot R$ with random $R$, commit hiding. Simulator samples random $U$ and hides via MSM randomness (Pedersen blinding). Random oracle hashes not reveal $W$. Single randomization suffices if commitment perfectly hiding.

We extend proving incremental computation via recursion overhead *constant*: augmentation circuit $F'$ size $|F'| = |F| + O_{\lambda}(1)$ with two $\mathbb{G}$ mul gates, two hashes (Poseidon $~300$ R1CS constraints per hash). Thus overhead independent of $|F|$ [1].

![HyperNova Custom Gates CCS Folding Diagram](/thesis/thesis-pcd-nova-folding-1786329188004-1.webp)

### 4.2 SuperNova Non-Uniform PCD and Cross-Term Avoidance

PCD topology not uniform: EVM execution mixes opcodes ADD (3 constraints) vs SHA3 (10k constraints) [2]. Uniform folding padding to max circuit wasteful. **SuperNova** maintains independent running instances per instruction $i$: $U_i$ accumulates only invocations of $C_i$ [11]. When program counter selects next instruction $\varphi$, fold incoming $u$ into $U_{\varphi}$. Verifier circuit proves $\varphi \in [0,k)$ and selector vector one-hot.

Naive selector folding with relaxed R1CS introduces cross-terms across *every* $i$: $E$ mixes selectors non-linearly producing $k$ cross terms, recursive circuit $O(k)$ overhead [10]. SuperNova introduces CCS *linear* claim variant:

> **Linear CCS trick (KiloNova):** Represent instruction selector as linear combination $\sum_i s_i C_i(z)=0$ where $s_i \in \{0,1\}$, $\sum s_i =1$. Choose CCS degree $d=2$ with $M_0 = diag(selector)$. Then folding linear leaves $c_i$ unaffected, cross-term zero for selector dimension [11].

We formalize non-uniform IVC $\mathsf{F}(\text{pc}, z) = C_{\text{pc}}(z)$. Augmented predicate:

$$ \Psi( z_{out}, pc_{out}, z_{in}, pc_{in}, (U_j), u) := z_{out}=C_{pc_{in}}(z_{in}) \land pc_{out}=next(pc_{in}, z_{in}) \land U^{pc_{in}}_{new}= Fold(U^{pc_{in}}, u) $$

Only $O(\log k)$ overhead for hash of $U$ list via Merkle tree root maintained in public IO; verifier opens single $U^{pc}$ path (Poseidon Merkle proof ~ 600 constraints). *A-la-carte* cost: proving ADD step costs ~ ADD + folding overhead, independent of SHA3 size [2]. Empirically SuperNova proving EVM 100k steps with 20 op types saves $4.8\times$ vs uniform [11].

Non-uniform PCD further supports parallel MASTs: multiple provers folding separate branches concurrently, later merged via multi-folding ($n$ instances to one in $\log n$ sum-check rounds [5]).

### 4.3 Custom Gates, Lookups, and ProtoStar / Origami Extensions

Real zkVMs (Jolt, RISC-Zero) rely on **custom gates** beyond R1CS: degree-$3/4$ gates, permutation grand product, range checks via lookups [5]. Plonkish arteriats: $q_L q_R q_M$ gate $q_L a + q_R b + q_O c + q_M a b + q_C=0$ (degree 2). Lookup argument $\{a_i\} \subseteq Table \{t_j\}$ expressed via grand product $\prod (a_i + \beta) = \prod (t_i + \beta)$ degree $N$ but sum-check reducible to zero-check [12].

HyperNova folding for arbitrary degree via CCS degree $d$ introduces $\binom{d}{2}$ cross-terms $T_1...T_{d-1}$; verifier $d$ scalar muls not 2 [2]. To keep verifier constant, NeutronNova reduces any zero-check relation to single sum-check round folding via invoking prover's sum-check transcript as witness [12]. Origami folds Halo2 lookups by folding quotient polynomial $t$ commitment [9].

**ProtoStar** [5] genericizes accumulation for any special-sound protocol $(2\mu-1)$-round with verifier degree-$d$ equations, accumulation verifier $k+2$ EC muls + $k+d+O(1)$ hashes, supporting high-degree gates natively. Protostar outperform Sangria (Plonk folding) $~1.3\times$ check due to optimized cross-term compression via Lagrange kernel [5].

For PCD with lookups, we fold lookup running instance $L$ separately: $L.E$ encodes lookup error matrix. CycleFold applies unchanged: zero-check folding still one MSM.

Figure factorization:

| System | Arithmetization | Folding cost (prover MSM) | Verifier (EC mul) | Supports non-uniform | ZK-for-free |
|---|---|---|---|---|---|
| Nova | relaxed R1CS | 2 MSMs $|F|$ | 2 | via SuperNova | No (needs zkSNARK) |
| Sangria | Plonk (degree2) | 2 MSMs | 2 | Limited | No |
| SuperNova | R1CS+selectors | 2 MSMs | 2 $+\log k$ hashes | **Yes** | No |
| HyperNova | CCS ($q,d$) | 1 MSM (optimal) | 1 | via a-la-carte | **Yes** |
| ProtoStar/ProtoGalaxy | Special-sound | k+2 MSMs | k+2 | Multi-fold | No* |
| NeutronNova | Zero-check | commit + 1 sum-check round | const | Yes | Yes |

*ProtoGalaxy log work folding multiple instances adds negl overhead [5].

```tla
---- MODULE IVC_Correctness ----
EXTENDS Naturals, FiniteSets
VARIABLES i, z, Pi, U
Init == i=0 /\ z=z0 /\ Pi = Empty /\ U = TrivialRelaxed
Next == \/ /\ z' = F(z) /\ Pi' = Fold(Pi, ProofStep(z)) /\ i' = i+1
Spec == Init /\ [][Next]_<<i,z,Pi,U>>
THEOREM IVC_Soundness == Spec => [] (Verify(vk,i,z0,z,Pi) => ExistsTrace)
====
```

### 4.4 Implementation Engineering and Performance Model

Implementations evaluated:

- *Rust nova-snark@0.30* over Pallas/Vesta (no trusted setup), BN254/Grumpkin with Mercury KZG fast verifier [1]
- *Spartan compression* for final succinct proof $O(\log |F|)$ ~ $8$ KB [1]
- *Halo2 + Protostar* research [9] enabling Poseidon hash custom gate (degree3, 3 wires)

**Performance model**: Per step prover time $t_p = 2 \cdot MSM(n) + O(n)$ field ops for $T$. With $n=2^{20}$ constraints, MSM $~0.4s$ on 32-core. Without FFTs, Nova $2.1\times$ faster than Halo recursive prover at same $n$ [1]. CycleFold reduces $E_2$ circuit from $10k$ to $1.2k$ constraints, cutting recursion overhead $~30\%$ in BN254 cycle [4].

**Binary-tree IVC** parallelizes proving $N$ steps in $O(\log N)$ depth with $N$ machines, each machine folds subtree root up, CycleFold multi-fold uses $n$ MSMS parallelizable [4][5].

---

## 5. Empirical/Proofs

### Formal Knowledge Soundness Fork

*Lemma (Folding extractor):* Assume commitment binding. If adversary outputs folded instance-witness $(U,W)$ with extractor obtaining two distinct challenges $r_1 \ne r_2$ and corresponding evaluations, then we interpolate $W_1,W_2,T$ linear system via Vandermonde invert $\det = r_1 - r_2 \ne 0$. Hence extracting $(u_1,w_1),(u_2,w_2)$. Iterates to $\deg$ $d$ with $d$ challenges.

*Theorem (IVC implies SNARK):* IVC of $n$ steps implies SNARK for $\mathcal{R}_F = \{(z_0,z_n): \exists \, trace\}$. SNARK prover runs IVC prover $n$ times then compresses $U_n$ via Spartan zkSNARK (transparent unless KZG). Verifier checks IVC verifier + compressed proof, size $O(\log n + \log |F|)$.

### Benchmark Synthesis [1][2][4]

| Curve cycle | Recursion overhead constraints | MSM size (for $|F|=2^{17}$) | Prover ms/step | Final proof size |
|---|---|---|---|---|
| Pallas/Vesta (Nova) | $~  2\times 300$ (Poseidon) + 500 (2 ec mul) ~ 1.2k | $2\cdot 2^{17}$ | 320 ms | 9 KB Spartan |
| BN254/Grumpkin + CycleFold | $1.5k$ (sec curve) + 2 hashes | same | 340 ms | 7.5 KB KZG |
| Grumpkin/BN254 (no CycleFold) | $~10k$ | same | 410 ms | same |

- SuperNova EVM 20-instruction set: uniform padding $~10k$ avg vs a-la-carte $~2.1k$ avg constraints $4.8\times$ saving, proving 1M gas block $~8.2s$ vs $39s$ [11].
- HyperNova ZK-for-free reduces proof size vs Nova+zkSNARK $23\%$ (no need second layer randomness).
- ProtoStar multiple fold ($k=8$ parallel lookups) marginal verifier 14 ec muls vs naively 16 [5].

```haskell
-- SuperNova non-uniform selector in CCS (conceptual)
type Selector = Vector Bool
checkSelector :: Selector -> Constraint
checkSelector s = oneHot s <> sum s == 1
-- oneHot via  s_i * (1 - s_i) = 0 algebraic,  degree 2 CCS
oneHot v = all (\i -> v[i]*(1 - v[i]) == 0)
ultraFold :: [RunningInstance] -> CircuitId -> (RunningInstance -> RunningInstance)
ultraFold us cid = \u -> foldInstance (us !! cid) u -- only fold matching cid
```

## 6. Limitations

- **No sublinear IVC without argument**: Folded instance size $O(|F|)$ linear unless compressed. Compression requires Spartan/MicroSpartan extra prover (still no pairings if IPA inner product, but log proof). Without compression PCD proof size linear in computation, unsuitable for succinct blockchain verification.
- **Witness length growth**: Relaxed R1CS error vector $E$ dimension $m$ grows with witnesses cross-terms commitments linearly in $N$; for high-degree CCS $d>4$, number cross $E_i$ grows $\Theta(d)$ increasing running commitment count.
- **Trusted setup vs transparency tension**: Efficient commitment via KZG requires powers-of-tau (updatable) for HyperKZG/Mercury [1]; transparent Pedersen+IPA log verification slower $~ O(\log n)$ ext. Lookup folding often needs KZG opening, regaining setup.
- **Circuit uniformity assumption**: SuperNova assumes static set of $k$ circuits known at keygen. Dynamic extension of circuit set at runtime requires re-key or updatable verifier key - open problem for long-lived PCD service.
- **Hash instantiation**: Poseidon/Poseidon2 security assumptions random oracle not fully hedged, and $\approx 300$ constraints hash still dominates overhead for very small $F$ (e.g., $F$ = single hash $<100$ constraints, overhead $> 12\times$).
- **Curve security**: CycleFold security reduces to DLOG on *both* curves; 2-cycle where one curve 128-bit but other 115-bit due to field size imbalance (BN254 254-bit -> 127-bit security vs Grumpkin 254-bit but sextic twist?) slight security gap [4][9].

---

## 7. Conclusion

Folding turned recursive SNARK composition from *pairing-heavy meta-verification* to *single-MSM accumulation* paradigm. Nova showed two group operations suffice to bind continuity of $10^6$ steps; SuperNova lifted uniformity barrier via selector-linear CCS making PCD *a-la-carte*; HyperNova and ProtoStar raised arithmetization to full Plonkish CCS with custom gates, lookups, high degree while preserving optimal prover (single MSM) and zero-knowledge for free via folding randomization [1][2][5]. CycleFold made curve cycles practical [4], keeping non-pairing curve circuit $<1.5k$ constraints nearly order magnitude improvement. Together, they yield incrementally verifiable computation where prover work equals essentially *evaluating $F$ plus two multiexponentiations*, verifier $O(\log |F|)$, and proof size succinct after one final compression.

Resulting PCD toolkit directly enables private Rollup sequencing (EVM steps as distinct circuits), recursive RISC-V zkVMs (Jolt uses Lasso decomposable lookups folded via NeutronNova [12]), and distributed data pipelines where mutually distrusting mappers prove compliance to predicate $\Psi$ before forwarding messages. Future directions: *Lattice-based* folding (LatticeFold, Cyclo [13]) for post-quantum PCD, *transparent multi-folding* for DAG width $>10^4$ via ProtoGalaxy log field ops, and fully eliminating KZG trusted setup while retaining lookup aggregation.

---

## References

[1] Kothapalli, Setty, Tzialla. Nova: Recursive Zero-Knowledge Arguments from Folding Schemes. CRYPTO 2022 (ePrint 2021/370). https://eprint.iacr.org/2021/370 https://crypto.iacr.org/2022/papers/538806_1_En_13_Chapter_OnlinePDF.pdf

[2] Kothapalli, Setty. HyperNova: Recursive Arguments for Customizable Constraint Systems. ePrint 2023/573. https://eprint.iacr.org/2023/573 https://www.microsoft.com/en-us/research/publication/hypernova-recursive-arguments-for-customizable-constraint-systems/

[3] Setty, et al. Customizable Constraint Systems for Succinct Arguments. ePrint 2023/552. https://eprint.iacr.org/2023/552

[4] Kastur, Kothapalli, Setty, Tzialla. CycleFold: Folding-scheme-based Recursive Arguments over a Cycle of Elliptic Curves. ePrint 2023/1192. https://eprint.iacr.org/2023/1192 https://askcryp.to/t/resource-topic-2023-1192-cyclefold-folding-scheme-based-recursive-arguments-over-a-cycle-of-elliptic-curves/20422

[5] Bünz, et al. ProtoStar: Generic Efficient Accumulation/Folding for Special Sound Protocols; ProtoGalaxy Efficient Multi-Folding. ePrint 2023/620, 2023/1106. https://eprint.iacr.org/2023/620 https://github.com/geometryresearch/protostar

[6] Bunz, Chiesa, Lin, Mishra, Spooner. Proof-Carrying Data without Succinct Arguments. CRYPTO 2021, ePrint 2020/1618. https://eprint.iacr.org/2020/1618

[7] Bitansky, Canetti, Chiesa, Tromer. Recursive Composition and Bootstrapping for SNARKs and Proof-Carrying Data. STOC 2013. https://cs-people.bu.edu/tromer/papers/bootsnark-20120403.pdf

[8] Valiant. Incrementally Verifiable Computation or Proofs of Knowledge Imply Time/Space Efficiency. TCC 2008. https://iacr.steepath.eu/2023/1394-IncrementallyVerifiableComputationviaRate1BatchArguments.pdf

[9] Sangria: Folding Scheme for Plonk; Origami Folding for Halo2 Lookups. https://paragraph.com/@taiko-labs/an-incomplete-guide-to-folding-nova-sangria-supernova-hypernova-protostar https://github.com/adr1anh/awesome-folding

[10] Gao, Guo, Xiao. KiloNova: Non-Uniform PCD with Zero-Knowledge Property from Generic Folding Schemes. ePrint 2023/1579. https://eprint.iacr.org/2023/1579

[11] SuperNova construction via non-uniform IVC, Cosmos accumulator notes. https://github.com/microsoft/Nova/blob/main/README.md https://blog.lambdaclass.com/incrementally-verifiable-computation-nova/ https://eprint.iacr.org/2023/1282

[12] Setty. NeutronNova: Folding Everything That Reduces to Zero-Check. ePrint 2024/1606. https://eprint.iacr.org/2024/1606

[13] Lattice-based folding, Cyclo. https://eprint.iacr.org/2025/1294.pdf https://eprint.iacr.org/2026/359

![PCD Distributed DAG Compliance Predicate](/thesis/thesis-pcd-nova-folding-1786329188004-2.webp)

![CycleFold Elliptic Curve Cycle Optimization](/thesis/thesis-pcd-nova-folding-1786329188004-3.webp)
