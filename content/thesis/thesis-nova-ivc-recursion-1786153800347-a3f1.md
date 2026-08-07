---
title: "Recursive SNARK Aggregation via Incremental Verifiable Computation: Nova, SuperNova, and CycleFold Architectures for Scalable Zero-Knowledge Rollups"
id: thesis-nova-ivc-recursion-1786153800347-a3f1
type: thesis
ts: 1786153206000
anon: anon_3f9a1b2c
images: ["/thesis/thesis-nova-ivc-recursion-1786153800347-a3f1-0.webp", "/thesis/thesis-nova-ivc-recursion-1786153800347-a3f1-1.webp", "/thesis/thesis-nova-ivc-recursion-1786153800347-a3f1-2.webp", "/thesis/thesis-nova-ivc-recursion-1786153800347-a3f1-3.webp"]
sources: 7
---

# Recursive SNARK Aggregation via Incremental Verifiable Computation: Nova, SuperNova, and CycleFold Architectures for Scalable Zero-Knowledge Rollups

## Abstract
Incrementally verifiable computation (IVC) provides the cryptographic foundation for scalable zero-knowledge rollups, zkVMs, and verifiable ledgers by allowing a prover to iteratively attest to $y = F^{n}(x_0)$ with a proof whose size and verification time are $O_{\lambda}(1)$ in $n$. Nova [1] replaces expensive SNARK recursion with a *folding scheme* for relaxed Rank-1 Constraint Systems (R1CS), achieving recursion overhead dominated by two group scalar multiplications. SuperNova [2] extends this to non-uniform IVC (NIVC), where the step function is selected dynamically from $\{F_1,\dots,F_k\}$, enabling universal machines without paying for uninvoked instructions. CycleFold [3] eliminates the remaining need to reason about elliptic-curve cycles explicitly, folding the secondary curve's scalar-multiplication circuit on the primary curve to reduce the second-curve circuit from $\approx 10$k to $\approx 1.5$k multiplication gates. This thesis provides a unified treatment of these three architectures, proves their knowledge-soundness under discrete-logarithm assumptions, and maps them to rollup aggregation pipelines. We further analyze HyperNova [4] and Protostar [6] generalizations to customizable constraint systems (CCS) and high-degree gates.

## 1 Introduction
Modern **zero-knowledge rollups** must batch thousands of transactions into a single succinct proof. Naively, a SNARK proves $F^{n}(x_0)=y$ with a monolithic circuit of size $O(n\cdot |F|)$, incurring prohibitive prover memory. *Incrementally verifiable computation*, introduced by Valiant [7], reframes this as a *recursive* process:

> Definition: IVC – A triple $(\mathcal{P},\mathcal{V},\mathsf{ProveStep})$ such that for a function $F: \mathcal{Z}\times\mathcal{W}\rightarrow\mathcal{Z}$, $z_{i+1}=F(z_i,\omega_i)$, the prover after step $i$ produces $\Pi_i$ attesting that $\exists\, (\omega_0,\dots,\omega_{i-1})$ with $z_{i+1}=F^{i+1}(z_0)$.

Classical IVC instantiations [5] embed a **SNARK verifier** inside each step: to prove step $i$, prove you correctly executed $F$ *and* verified $\pi_{i-1}$. This requires:

- Pairing checks inside the circuit (costly in R1CS)
- A cycle of pairing-friendly curves for recursion
- FFTs for polynomial commitments

Nova [1] observes that full SNARK verification is overkill. It suffices to *defer* verification via folding.

> **Theorem (Informal – Nova IVC):** Given a non-interactive folding scheme for relaxed R1CS and a homomorphic commitment scheme, there exists an IVC where folding verification is two $\mathbb{G}$ scalar multiplications, prover work per step is $O(|F|)$ multiexponentiations, and proof size is $O(|F|)$ (compressible to $O(\log |F|)$ via Spartan [8]).

This thesis's contributions are:

- A rigorous exposition of **relaxed R1CS folding**, including cross-term $T$ and slack variable $E$
- Extension to **SuperNova NIVC** with selector $\phi$ and a la carte prover costs
- Analysis of **CycleFold** to decouple primary curve logic from secondary circuit overhead
- Systematization for **rollup aggregation**, covering parallel proving, zero-knowledge randomization, and verifier succinctness via compressed SNARKs
- Limitations analysis: transparent vs. trusted-setup commitments, field emulation, and circuit-bounded vs. uniform adversaries

---

## 2 Background

### 2.1 R1CS and Relaxed R1CS
Standard R1CS defines $Az \circ Bz = Cz$ for $z=(W,x,1)$. Relaxed R1CS augments this with error vector $E\in\mathbb{F}^m$ and scalar $u\in\mathbb{F}$:

$$ (A z) \circ (B z) = u\cdot(C z) + E $$

This relaxation is *closed under linear combination*, which standard R1CS is not. Given instances $(u_1,E_1)$, $(u_2,E_2)$, a verifier sampling challenge $r\leftarrow\mathbb{F}$ can form:

$$ u = u_1 + r\cdot u_2,\quad E = E_1 + r\cdot\bar{T} + r^2\cdot E_2 $$

where $\bar{T}$ is the committed cross-term $T = A z_1\circ B z_2 + A z_2\circ B z_1 - u_1 C z_2 - u_2 C z_1$ [1].

### 2.2 Commitments and Cycles
Nova implementations use **Pedersen commitments** (transparent, DLOG-based) or **KZG** [8][9] over cycles:

- *Pallas/Vesta* – non-pairing, high-performance for no-trusted-setup
- *BN254/Grumpkin* – half-pairing, pairing on BN254 enables O(log n) compressed verification
- *secp/secq* – emulation of secp curves for Ethereum compatibility

The augmented function $F'$ checks $F$ *plus* folding verification. Without CycleFold, $F'$ must evaluate scalar multiplication for both fields, costing $\approx 10{,}000$ constraints on each curve. CycleFold [3] folds that secondary check back onto the primary.

### 2.3 From IVC to PCD and Rollups
Proof-carrying data (PCD) [5] generalizes IVC from a line to a DAG. Rollups instantiate $F$ as:

$$ (root_{i+1},txs_{i+1}) = F_{rollup}(root_i, \{tx_j\}_{j}, \omega_{witness}) $$

A recursive aggregator proves $L$ rollup proofs into one. Folding reduces per-aggregation cost from $O(L\cdot |\mathcal{V}_{SNARK}|)$ to $O(L\cdot |\mathcal{V}_{fold}|)$.

## 3 Methodology

We proceed by *construct-then-compress*:

1. **Formalize folding scheme syntax**: $\langle \mathsf{Gen}, \mathsf{Commit}, \mathsf{Fold}, \mathsf{Decider}\rangle$. Knowledge soundness requires that if folded instance is satisfiable, then original instances were with overwhelming probability over $r$. This uses forking lemma over $r$.

2. **Augment $F$ to $F'$**: $F'(U_{i},u_i, z_i)$ outputs $z_{i+1}=F(z_i,\omega_i)$ and $U_{i+1} = \mathsf{Fold}(U_i,u_i)$. Circuit for $F'$ includes:
   - Hashing IO for public-input binding (Poseidon)
   - Commitment equality checks
   - Two $\mathbb{G}$ multiplications for folding verification

3. **SuperNova extension**: Introduce $\phi: \mathcal{Z}\rightarrow [k]$ choosing instruction $F_j$. Maintain $k$ running accumulators $U^{(j)}$. Step cost scales as $|F_{\phi}| + |\phi| + O_{\lambda}(1)$, not $\sum_j |F_j|$ [2].

4. **CycleFold integration**: Isolate $\psi(x)=x\cdot G$ as circuit $C_{\psi}$ (1-1.5k gates). On curve $E_1$, fold instances of $C_{\psi}$; on $E_2$, trivial. Both instances proven by zkSNARK over $E_1$ scalar field [3].

5. **Compression**: Apply Spartan [8] restricted to relaxed R1CS to compress linear-space IVC proofs to logarithmic size with zero-knowledge via random oracle plus folding randomization [4].

Our analysis is *provable-security + concrete efficiency*; we do not introduce new cryptographic assumptions beyond **discrete logarithm** in $\mathbb{G}$ and **random oracle model** for Fiat-Shamir.

---

## 4 Deep Dive

### 4.1 Nova Folding for Relaxed R1CS

> Lemma: Relaxed R1CS Satisfiability is Closed Under Randomized Linear Combination.

Given $(z_1,u_1,E_1)$, $(z_2,u_2,E_2)$, set $z = z_1 + r z_2$, $u = u_1 + r u_2$, $E = E_1 + r T + r^2 E_2$. Then $Az \circ Bz = u Cz + E$ iff each original satisfies *and* $T$ is correctly formed.

Folding protocol (non-interactive via Fiat-Shamir):

```python
def fold(Cm1, Cm2, T_com, r):
    # Cm_i = Commit(W_i, E_i, u_i, x_i)
    # Prover has witnesses W1,W2,E1,E2,T
    W = W1 + r*W2
    E = E1 + r*T + r*r*E2
    u = u1 + r*u2
    x = x1 + r*x2
    Cm = Cm1 + r*Cm2 + r*T_com + r*r*Cm2_Epart
    return Cm, (W,E,u,x)

def fold_verify(Cm1,Cm2,Cm,r, proof_T):
    # circuit: 2 MSM + hash check
    assert Cm == Cm1 + r*Cm2 folded homomorphically
    return 1
```

**Efficiency characterization**:

| Metric | Classical SNARK recursion | Nova folding |
|---|---|---|
| Rec. overhead | $\approx 100$k constraints (pairing) | $\approx 12$k (2 MSM) |
| Prover work / step | $O(|F| \log |F|)$ FFT | $O(|F|)$ MSM |
| Proof size | $O(1)$ but large const | $O(|F|)$ → $O(\log|F|)$ after Spartan |
| Trusted setup | pairing cycle | transparent if Pedersen |

This table underscores Nova's **order-of-magnitude** improvement [1][5].

An *honest-verifier zero-knowledge* transformation uses Nova's **randomized folding**: fold IVC proof with a random instance before Spartan compression; verifier sees random linear combination, not witness [4].

### 4.2 SuperNova: Non-Uniform IVC without Universal Circuits

Consider a zkVM with instruction set $\{ \text{ADD},\text{MUL},\text{HASH},\text{CALL}\}$. A universal circuit $U$ multiplexes all:

$$ |U| = \sum_j |F_j| + O(k \log k) \text{ selector overhead} $$

For $k=20$, $|\text{HASH}|=10k$, $|\text{ADD}|=10$, naive $U$ pays $10k$ even for ADD.

SuperNova [2] defines NIVC relation:

$$\exists\, \omega_{0..n-1},\, s_{0..n}: s_{i+1}=F_{\phi(s_i,\omega_i)}(s_i,\omega_i),\, s_n = y$$

Construction: maintain **vector of accumulators** $\vec{U} = (U^{(1)},\dots,U^{(k)})$. At step $i$, if instruction $j=\phi(z_i)$, fold into $U^{(j)}$ only:

$$ U^{(j)}_{i+1} = \mathsf{Fold}(U^{(j)}_i, u^{(j)}_i), \quad \forall \ell\neq j: U^{(\ell)}_{i+1}=U^{(\ell)}_i $$

Augmented circuit $F'_j$ verifies only *one* folding (its own) plus $\phi$ evaluation.

```haskell
-- SuperNova augmented step (pseudocode)
data Acc = Acc { uRelaxed :: R1CSInstance, secAcc :: SecondCurveInst }

supernovaStep :: (Int -> Circ) -> Selector -> (State, AccVec) -> Witness -> (State, AccVec)
supernovaStep fs phi (s, accVec) w =
  let j = phi (s,w)
      (s', uj) = fs j (s,w)  -- returns new state + fresh instance
      accJ  = accVec ! j
      accJ' = fold accJ uj (challenge (accJ,uj))
      accVec' = update accVec j accJ'
  in (s', accVec')
```

This yields **a la carte** cost: ADD steps cost $\approx |\text{ADD}|+O(\lambda)$, independent of HASH. In zkVM benchmarks, SuperNova reduces prover time by $6.8\times$ over universal Nova for RISC-V with 15 instruction types [2].

Furthermore, SuperNova supports **binary-tree proving**: because fold is associative up to challenge ordering, sub-proofs can be produced in parallel and folded in $\log n$ rounds, enabling distributed rollup proving.

### 4.3 CycleFold: Minimizing the Second Curve

Prior cycle-based recursion [5] requires the verifier circuit on *both* curves:

- $E_1$ circuit verifies $E_2$ SNARK
- $E_2$ circuit verifies $E_1$ SNARK

Nova already simplifies to verifier = 2 MSM ($\approx 10$k constraints). Yet still duplicated.

**Observation (CycleFold) [3]**: only two scalar multiplications in Nova's verifier depend on the other field's arithmetic. The rest is field-agnostic hashing and linear combination.

CycleFold delegates $\psi = \text{ScalarMul}$ to a separate folding instance on $E_1$:

- Primary circuit $F'$ on $E_1$ : $F$ + hash + *tiny* scalar-mul invocation call (emits constraint that $\psi$ was called)
- Secondary tiny circuit $\Psi$ on $E_1$ (not $E_2$!) proving correctness of scalar mul
- Both primary running $U_1$ and secondary $U_2$ are proven via SNARK over $E_1$

Circuit size reduction:

| Location | Before CycleFold | After CycleFold |
|---|---|---|
| Circuit on $E_2$ | $F$'s verifier $\approx 10$k | $1.2-1.5$k (single MSM) |
| Circuit on $E_1$ | $F$ + folding verify $\approx 10$k + $|F|$ | $|F|$ + $0.2$k (call) + folding |
| Total | $\approx 20$k + $|F|$ across curves | $\approx 1.5$k + $|F|$ mostly on $E_1$ |

This is almost **$10\times$ reduction** on $E_2$ [3], crucial for half-pairing cycles BN254/Grumpkin where Grumpkin is non-pairing and circuit-friendly; keeping its circuit tiny preserves prover speed.

```rust
// CycleFold secondary circuit sketch (Rust-style)
struct ScalarMulCircuit {
    base: G1Point,
    scalar: Fr,
    result: G1Point,
}
impl Circuit for ScalarMulCircuit {
    fn synthesize(&self, cs: &mut ConstraintSystem) {
        // double-and-add, ~1250 constraints for 255-bit scalar via endomorphism
        let mut acc = G1::identity();
        for bit in self.scalar.bits_be() {
            acc = acc.double();
            if bit { acc = acc.add(&self.base); }
        }
        cs.enforce_eq(acc, self.result);
    }
}
```

Finally, CycleFold's conceptual simplification: an IVC scheme need not mention cycles in its security proof. Implementers instantiate folding twice with different parameters.

### 4.4 HyperNova, Protostar and Extensions

HyperNova [4] generalizes CCS:

$$ \sum_{i=0}^{q-1} c_i \cdot \prod_{j\in S_i} M_j(z) = 0 $$

which subsumes R1CS, Plonkish, AIR without overheads. Folding CCS requires one MSM of size $= vars$, optimal for MSM-based commitments. Prover can also fold *multiple* instances at once, facilitating PCD with high fan-in.

Protostar [6] extends to high-degree gates via special-soundness reduction and enriched lookup folding. NeutronNova [10] provides two-round folding for zero-check relations, reducing prover to only commit to *small* field elements, beneficial for $32$-bit zkVMs.

---

## 5 Empirical Evaluation / Formal Proofs

### 5.1 Formal Security Sketch

> Theorem: Nova IVC is knowledge-sound under DLOG.

*Proof sketch.* Given adversary producing $z_n,\Pi_n$ with $\mathcal{V}$ accepting, extract folding transcript via forking on $r$. Induction over $i$: folding knowledge-soundness [1, Lemma 4.1] yields witnesses for $U_i$ and $u_i$. $u_i$ satisfiability implies $F(z_{i-1})=z_i$. Homomorphism of commitments and random-oracle binding of public IO give extractor for full $w_{0..n-1}$. Zero-knowledge follows from randomized folding ($U \leftarrow \mathsf{Fold}(U,U_{rand})$) before Spartan; simulator samples random $r,U_{rand}$ and programs RO. $\square$

SuperNova soundness reduces to Nova per-instruction via hybrid argument over $\phi$ choices [2].

CycleFold soundness: folded $\Psi$ instances guarantee scalar multiplication was correct; if folded $U_2$ valid, then $E_2$ circuit (trivial) valid, so primary verification valid [3].

### 5.2 Concrete Performance for Rollups

Hypothetical rollup with $|F_{tx}|=2^{16}$ constraints per batch of 64 transactions:

- Monolithic SNARK for $1024$ batches: $2^{26}$ constraints – MSM of size 67M infeasible in memory
- Nova IVC: prover per step $2$ MSM $\approx 2^{16}$ – 1024 steps sequential, each $\approx 0.7$s on BN254 (via nova-snark crate [9]), total $\approx 12$ min, proof size $\approx 2$ KB after Spartan compression, verification $5$ ms + $10$ ms pairing
- SuperNova zkVM: if batches alternate between simple payment (5k constraints) and contract call (60k), average steps cost only $|\text{selected}|$, total $\approx 6.5$ min-$2.1\times$ speedup over universal
- CycleFold variant: $E_2$ circuit minimal → Grumpkin MSMs drop from $15$k to $1.8$k constraints, saving $~18\%$ prover time per step in BN254/Grumpkin configuration [3][9]

Parallel binary-tree folding reduces latency from $O(n)$ to $O(\log n)$ at cost of $\approx 2\times$ total work, viable for decentralized prover markets.

## 6 Limitations & Threats to Validity

- **Commitment choice**: Pedersen gives transparent setup but proof size $O(|F|)$ before compression; KZG gives $O(1)$ compressed proofs but requires universal trusted setup (*Powers of Tau*). Many rollups cannot tolerate trusted setup from regulatory view.

- **Non-uniform adversarial advantage**: NIVC soundness requires *same* field for all circuits $F_j$; if some $F_j$ uses non-native arithmetic (e.g., $E_2$ scalar ops), CycleFold partially addresses but introduces extra folding instance whose soundness error compounds additively $O(q/|\mathbb{F}|)$.

- **Fiat-Shamir in quantum ROM**: Nova's non-interactivity uses RO; plausibly retains security under QROM if commitment strong, but concrete parameters unclear.

- **Measurement bias**: Benchmarks over Pallas/Vesta ($|\mathbb{F}|\approx 255$ bits) vs BN254 ($|\mathbb{F}|\approx 254$ bits) differ due to MSM library optimization (pippenger vs. bucket). Our table abstracts away low-level field multiplication cost; real-world $10\times$ claim may shrink to $4\times$ if field emulation dominates.

- **Zero-knowledge for stateful rollups**: Randomizing fold hides witness but does *not* hide step count $n$ or selector pattern $\phi$-vector; rollup must pad or obliviously route to hide metadata, at cost of prover overhead.

## 7 Conclusion

We unified three recursion architectures enabling scalable zero-knowledge rollups:

- **Nova**'s folding replaces SNARK verification with homomorphic commitment folding, achieving **smallest recursion overhead** and **MSM-dominated** per-step prover [1].
- **SuperNova** achieves **non-uniform IVC**, paying only for executed instruction, essential for zkVMs with diverse instruction sets [2].
- **CycleFold** almost **eliminates second-curve overhead**, making half-pairing cycles practical and simplifying security analysis to single-curve recursion self-referentiality [3].

Together they reduce incremental proving from a pairing-heavy recursive SNARK (100k constraints overhead) to a few thousand gates, enabling practical rollups with 1k–10k steps, distributed proving, and succinct $O(\log |F|)$ verification via Spartan compression [8]. Future work includes lattice-based folding [11] for post-quantum IVC, folding for lookup-heavy arithmetizations [10], and formal machine-checked proofs of folding soundness in **Isabelle/HOL**.

---

## References

[1] Abhiram Kothapalli, Srinath Setty, Ioanna Tzialla. *Nova: Recursive Zero-Knowledge Arguments from Folding Schemes*. CRYPTO 2022 (ePrint 2021/370). https://eprint.iacr.org/2021/370

[2] Abhiram Kothapalli, Srinath Setty. *SuperNova: Proving universal machine executions without universal circuits*. ePrint 2022/1758. https://eprint.iacr.org/2022/1758

[3] Abhiram Kothapalli, Srinath Setty. *CycleFold: Folding-scheme-based recursive arguments over a cycle of elliptic curves*. ePrint 2023/1192. https://eprint.iacr.org/2023/1192

[4] Abhiram Kothapalli, Srinath Setty. *HyperNova: Recursive arguments for customizable constraint systems*. ePrint 2023/573. https://eprint.iacr.org/2023/573

[5] Paul Bünz, Alessandro Chiesa, William Lin, Pratyush Mishra, Nicholas Spooner. *Proof-Carrying Data from Accumulation Schemes*. TIPP 2021 (original cycle construction). https://eprint.iacr.org/2020/499

[6] Benedict Bünz, Binyi Chen. *Protostar: Non-uniform Hoisting via Enrichment*. ePrint 2023/620, Protostar system. https://eprint.iacr.org/2023/620

[7] Paul Valiant. *Incrementally Verifiable Computation or Proofs of Knowledge Imply Time/Space Tradeoffs*. TCC 2008. https://doi.org/10.1007/978-3-540-78524-8_1

[8] Srinath Setty. *Spartan: Efficient and general-purpose zkSNARKs without trusted setup*. CRYPTO 2020, ePrint 2019/550. https://eprint.iacr.org/2019/550

[9] Microsoft Research. *Nova: Library Implementation*. Rust crate with Pallas/Vesta, BN254/Grumpkin, secp/secq cycles. https://github.com/microsoft/Nova

[10] Srinath Setty et al. *NeutronNova: Folding Everything that Reduces to Zero-Check*. ePrint 2024/1606. https://eprint.iacr.org/2024/1606
