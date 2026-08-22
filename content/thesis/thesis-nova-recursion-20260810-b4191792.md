---
id: thesis-nova-recursion-20260810-b4191792
title: "Nova and SuperNova: Recursive Folding Schemes for Incrementally Verifiable Computation with Relaxed R1CS and Non-Uniform Circuit Aggregation"
ts: 1786372203668
anon: anon#4999
type: thesis
thesis: true
topic: thesis
abstract: "Nova introduces a folding scheme for relaxed Rank-1 Constraint Systems (R1CS) that enables incrementally verifiable computation (IVC) without succinct non-interactive arguments of knowledge (SNARKs) in the recursion. By extending R1CS with a slack scalar u and error vector E, the relation (A·Z)∘(B·Z)=u·(C·Z)+E becomes linearly foldable via a random challenge r, collapsing two instance-witness pairs into one with O(1) verifier work and two multiexponentiations of size |F| per step. SuperNova generalizes this to non-uniform IVC (NIVC), where a selector function φ chooses among n distinct circuits per step, achieving a la carte prover costs proportional only to the invoked instruction rather than the sum of all instructions, while preserving Nova's constant recursion overhead dominated by two group scalar multiplications. This thesis formalizes committed relaxed R1CS, non-interactive folding schemes (NIFS) via Fiat-Shamir, CycleFold for elliptic curve cycles, and extensions including HyperNova's customizable constraint systems (CCS), ProtoStar's special-sound accumulation, and NeutronNova's zero-check folding, and analyzes knowledge soundness, zero-knowledge randomization, and practical efficiency for zkVMs."
images: []
---

# Nova and SuperNova: Recursive Folding Schemes for Incrementally Verifiable Computation with Relaxed R1CS and Non-Uniform Circuit Aggregation

## Abstract
Nova introduces a folding scheme for relaxed Rank-1 Constraint Systems (R1CS) that enables incrementally verifiable computation (IVC) without succinct non-interactive arguments of knowledge (SNARKs) in the recursion. By extending R1CS with a slack scalar u and error vector E, the relation (A·Z)∘(B·Z)=u·(C·Z)+E becomes linearly foldable via a random challenge r, collapsing two instance-witness pairs into one with O(1) verifier work and two multiexponentiations of size |F| per step. SuperNova generalizes this to non-uniform IVC (NIVC), where a selector function φ chooses among n distinct circuits per step, achieving a la carte prover costs proportional only to the invoked instruction rather than the sum of all instructions, while preserving Nova's constant recursion overhead dominated by two group scalar multiplications. This thesis formalizes committed relaxed R1CS, non-interactive folding schemes (NIFS) via Fiat-Shamir, CycleFold for elliptic curve cycles, and extensions including HyperNova's customizable constraint systems (CCS), ProtoStar's special-sound accumulation, and NeutronNova's zero-check folding, and analyzes knowledge soundness, zero-knowledge randomization, and practical efficiency for zkVMs.

## 1 Introduction

Incrementally verifiable computation (IVC) has emerged as the central abstraction for **proof-carrying data**, **proof aggregation**, and **recursive zkVMs**. The classical approach, instantiating recursion via succinct non-interactive arguments of knowledge (SNARKs), suffers from a fundamental inefficiency: the verifier circuit must fully verify a SNARK proof at each recursive step, incurring expensive pairing checks, FFTs, and a large recursion overhead measured in hundreds of thousands of constraints [1].

Nova [1] proposes a radically simpler primitive: a *folding scheme*. Rather than proving knowledge of a valid proof, the prover shows that the satisfiability of two NP instances reduces to the satisfiability of a single instance of the same size. This relaxation — from *argument of knowledge* to *reduction of satisfiability* — is sufficient for IVC yet avoids the heavy machinery of SNARKs entirely in the recursive step [1][3]. The insight is that *incremental* correctness can be *deferred*, not *proven*, until the final decoupling step, where a conventional zkSNARK compresses the accumulated relaxed instance into O(log|F|) group elements [1][6].

SuperNova [2] extends Nova's uniform computation model to **non-uniform IVC (NIVC)**, formalizing execution of universal machines where the per-step transition function F is selected from a family {f0,...,fn-1,phi} representing distinct instructions, e.g., RISC-V opcodes or EVM operations. Prior approaches required a universal circuit whose size scales as Omega(sum |f_i|), imposing prohibitive overhead for rich instruction sets. SuperNova achieves *a la carte* costs: proving a step that invokes f_j costs O(|f_j|), not O(sum |f_i|), while retaining Nova's two-MSM prover dominance and constant-size recursion circuit [2][4].

This thesis provides a self-contained, PhD-level treatment of Nova and SuperNova folding, including committed relaxed R1CS, NIFS security, CycleFold for two-cycle elliptic curves like Pallas/Vesta and BN254/Grumpkin, HyperNova's customizable constraint system (CCS), ProtoStar's generic accumulation compiler for special-sound protocols, and NeutronNova's sum-check-based zero-check folding [3][4][5].

> **Theorem (Informal):** There exists a public-coin, zero-knowledge folding scheme for committed relaxed R1CS where folding two N-sized instances requires O_lambda(N) prover work, O_lambda(1) verifier work and communication, assuming additively homomorphic commitments. This implies an IVC scheme with constant recursion overhead dominated by two scalar multiplications and prover work 2 * MSM_{|F|} per step [1][6].

The contributions are fourfold: (i) a rigorous systematization of relaxed R1CS folding and its knowledge soundness; (ii) an analysis of NIVC's selector model and circuit augmentation for SuperNova; (iii) a comparison of multi-instance folding regimes in HyperNova, ProtoStar, and NeutronNova; (iv) concrete evaluation criteria for instantiating folding-based zkVMs over cycles without trusted setup or FFTs.

## 2 Background

### 2.1 Incrementally Verifiable Computation (IVC)

Let F be a (potentially nondeterministic) incremental computation. Given z0, define z_{i+1} = F(z_i, omega_i) for witnesses omega_i. IVC requires a prover to produce, for each k, a proof Pi_k attesting that z_k = F^{(k)}(z0) with iterative knowledge of omega_0...omega_{k-1}, such that Verify(vk, k, z0, zk, Pi_k)=1 iff the iterative computation is correct, with Pi_k size and verification time independent of k [1].

Classically, F' is defined as the *augmented function* F'(z_i, Pi_i) that runs F and verifies Pi_i using a verifier circuit V embedded in the field arithmetic. When V verifies a Groth16 or Spartan proof, its circuit size dominates |F|, causing prover slowdowns of 10–100x [6].

Folding schemes break this cycle by replacing proof verification with instance folding. The augmented circuit only performs a *tiny* NIFS verification: a hash to obtain challenge r and a few group operations to homomorphically combine commitments [1].

### 2.2 R1CS and Relaxed R1CS

A Rank-1 Constraint System (R1CS) over finite field F with matrices A,B,C in F^{m x n} defines relation R_{R1CS} = { (x,W): Z=(W,x,1), (A Z)∘(B Z)=C Z } [1]. R1CS is NP-complete and generalizes arithmetic circuits. However, R1CS is not closed under random linear combination: (z1 + r z2) does not preserve quadratic constraints due to cross-terms.

**Relaxed R1CS** introduces slack scalar u in F and error vector E in F^m:

$$ (A · Z) ∘ (B · Z) = u · (C · Z) + E $$

where Z = (W, x, u). Any R1CS instance is equivalent to relaxed R1CS with u=1, E=0 [1][3]. Crucially, relaxed witnesses are closed under linear combinations modulo cross-terms absorbed into E'.

*Committed relaxed R1CS* further replaces W and E by Pedersen or KZG commitments barW = Com(W,rW), barE=Com(E,rE), enabling zero-knowledge and succinct verification of the folded witness opening [1].

### 2.3 Folding Schemes and NIFS

A folding scheme for relation R is a two-message public-coin protocol:

- Generator: pp
- Prover(u1, w1, u2, w2) -> (u, w, pi) folding proof T (cross-term commitment)
- Verifier(u1, u2, u) -> {0,1} checks homomorphic relation

Zero-knowledge holds when barW commitments are rerandomized [1][5]. Applying Fiat-Shamir yields **non-interactive folding scheme (NIFS)**: r = rho(pp, u1, u2, barT) where rho is a random oracle instantiated by Poseidon or Keccak sponge [6].

Knowledge soundness is defined via forking lemma: from three transcripts with distinct r one can extract w1,w2 if folded instance accepted [1][4].

### 2.4 Cycles of Elliptic Curves

To avoid expensive non-native field arithmetic in the verifier circuit (which verifies group operations from curve G1 while executing over field F_{q2} of cycle partner), Nova is instantiated over a 2-cycle: e.g., Pallas (F_q order p) and Vesta (F_p order q), or BN254/Grumpkin [6]. CycleFold [3] provides a generic framework to prove correct execution of verifier group operations with only 2x overhead by decomposing arbitrary scalar multiplication into base field operations provable in-circuit.

### 2.5 Non-Uniform IVC

NIVC is defined with F={f_i}_{i in [n]} and selector phi: F^l x F^n -> [n] (or -> [n] U {bot}). At step k, x_k selects instruction i=phi(z_k,omega_k), and z_{k+1}=f_i(z_k,omega_k) [2]. Uniform IVC is the case n=1. The augmented circuit F'_i for instruction i must verify that running relaxed instance U^{(k)} corresponds to some past selector sequence phi_0...phi_{k-1} and then fold new uniform instance u_k representing f_i into running track i.

SuperNova maintains n running instances {U_i}_{i in [n]} plus selector column vector s in {0,1}^n, rather than a single U, allowing decider to check that *exactly one* running instance updated per step [2]. This vectorized accumulation is what decouples cost from n.

## 3 Methodology

Our methodology combines cryptographic reduction analysis with implementation modeling in the algebraic group model (AGM) and random oracle model (ROM).

**Construction Analysis:** We dissect Nova's NIFS Prototype:

1. Given Z1,Z2, define cross-term T = A Z1 ∘ B Z2 + A Z2 ∘ B Z1 - u1 C Z2 - u2 C Z1
2. Commit barT = Com(T, rT)
3. Challenge r = H_{FS}(vk, u1, u2, barT)
4. Fold: Z = Z1 + r Z2, u = u1 + r u2, E = E1 + r T + r^2 E2, barW = barW1 + r barW2, barE = barE1 + r barT + r^2 barE2 [1][3].

In *committed* form, verifier only sees barWi, barEi, xi, ui and recomputes barE homomorphically; it never sees Wi [1].

**SuperNova Extension:** We generalize to n circuits with same structure parameter (same m,n shape but different Ai,Bi,Ci) or via CCS unified representation where Mj shared across constraints up to selectors [2][3]. Selector phi proven inside F'_i via m-sized lookup into {f_i} using O(log n) constraints when using memory-checking arguments [2].

**Security Methodology:** Knowledge soundness proved via 3-special soundness of underlying Sigma-protocol for relaxed R1CS, then compiled via forking. Zero-knowledge shown by simulator that samples random barW,barE as Pedersen rerandomizations with blinding factors, indistinguishable under DLOG [1][5].

**Cost Methodology:** We count field ops, MSMs, and hash constraints. For Nova, prover per IVC step = 2 MSMs size |F| + 2 |F| field mults. Verifier circuit = ~20k R1CS constraints dominated by 2 scalar muls (each ≈8k constraints using incomplete addition with cycle curves) + Poseidon ≈300 constraints [1][6]. SuperNova adds selector O(log n) constraints but retains 2 MSMs.

Comparative analysis includes HyperNova multi-folding (k instances folded in O(k) MSMs aggregated to 1 MSM optimal), ProtoStar (generic d-degree accumulation with d+1 G ops vs log n hashes), and NeutronNova (sum-check folding reducing witness commitment to small field elements when witness small) [3][4][5].

## 4 Deep Dive

### 4.1 Folding Scheme for Relaxed R1CS

Let pp = (ComParams). Consider ui = (barEi, ui, barWi, xi). Witness wi = (Ei, rEi, Wi, rWi) satisfies Ei, Wi openings and relaxed equation.

Define Zi = (Wi, xi, ui). The prover computes cross-term T as above. Note T is exactly what makes naive linear combination fail: (A(Z1+r Z2))∘(B(Z1+r Z2)) = A Z1∘B Z1 + r(A Z1∘B Z2 + A Z2∘B Z1)+ r^2 A Z2∘B Z2

Similarly u C (Z1+r Z2)= u1 C Z1 + r(u1 C Z2+ u2 C Z1)+ r^2 u2 C Z2 when u=u1+ r u2 plus r^2 term.

Thus E1 + r T + r^2 E2 cancels cross gap exactly if AZi∘B Zi = ui C Zi + Ei [1][2].

> **Theorem 1 (Folding Knowledge Soundness):** If verifier accepts folded instance u = NIFS.V(u1,u2,barT;r) and folded witness satisfies relaxed R1CS, then with overwhelming probability over random r, both u1,u2 are satisfiable, under DLOG hardness of commitment. The extractor rewinds thrice to obtain linear system in r, r^2 to solve for E1,E2,W1,W2 [1].

*Proof sketch.* Standard forking for degree-2 relation. Given three accepting transcripts (r, r', r''), we have three equations E^{(r)} = E1 + r T + r^2 E2 linear in unknowns E1,T,E2. Vandermonde matrix invertible when r distinct. Similar for Z. Extraction breaks binding if commitment not binding; reduction to DLOG. Honest-verifier zero-knowledge follows from Pedersen perfect hiding and simulator sampling random r then random E,T consistent.

**Bold observation:** **Relaxed R1CS is the minimal closure** of R1CS under random linear combination; scalar u and vector E are precisely the degrees of freedom needed to absorb constant and quadratic terms introduced by folding, making it *complete* for folding while preserving NP-completeness because R1CS embedding with u=1,E=0 remains intact [1].

### 4.2 Non-Interactive Folding via Fiat-Shamir

Public-coin NIFS is vulnerable to malleability if r controlled by prover. Transform replaces verifier challenge with r = H( u1, u2, barT, pp) modeled as random oracle [1][6]. In ROM, this preserves soundness up to q_RO^2/|F| loss.

Implementation chooses Poseidon with alpha=17 over Fp for circuit-friendliness. Hash input includes vk for domain separation against cross-protocol attacks [6].

Crucial for IVC security is *strong* Fiat-Shamir: include u1 (running instance) as well, not just u2 and T, otherwise adversary could reuse instance across steps leading to the cycle vulnerability discovered in 2023 implementation (malleable U0) where attacker produced valid proof for 2^{75} Minroot iterations in 1.46s without doing work by malleating relaxed instance to trivial satisfied one and reusing r [6]. Fix mandates including U_curr in FS transcript and eliminating one instance-witness pair from recursion (optimized secure cycle system) [6].

```rust
// Rust-like pseudocode for NIFS folding verification (CycleFold generic)
fn nifs_verify<C: CurveCycle>(
  pp: &ComParams,
  u1: RelaxedR1CS<C>,
  u2: R1CS<C>,
  cT: Commitment,
  r: Fr,
) -> RelaxedR1CS<C> {
  let u = u1.u + r * u2.u;
  let x = u1.x + r * u2.x;
  let e_cm = u1.e_cm + cT * r + u2.e_cm * (r * r);
  let w_cm = u1.w_cm + u2.w_cm * r;
  RelaxedR1CS { e_cm, u, w_cm, x }
}
```

```python
# Python model of committed relaxed R1CS satisfaction check
import random
def is_satisfied(A,B,C, Z, u, E):
    Az = A.dot(Z)
    Bz = B.dot(Z)
    Cz = C.dot(Z)
    for i in range(len(E)):
        if Az[i]*Bz[i] != u*Cz[i] + E[i]:
            return False
    return True

def fold(A,B,C, Z1,u1,E1, Z2,u2,E2, r):
    T = [A[i].dot(Z1) * B[i].dot(Z2) + A[i].dot(Z2) * B[i].dot(Z1) - u1*(C[i].dot(Z2)) - u2*(C[i].dot(Z1)) for i in range(len(E1))]
    Z = [z1 + r*z2 for z1,z2 in zip(Z1,Z2)]
    u = u1 + r*u2
    E = [e1 + r*t + r*r*e2 for e1,t,e2 in zip(E1,T,E2)]
    return Z,u,E,T
```

For zero knowledge, commitment blinding factors are rerandomized via fresh rW, rE, and folded blinding r'_W = r_{W1}+ r·r_{W2}, r'_E = r_{E1}+ r·r_T + r^2 r_{E2} [1].

### 4.3 Nova IVC Construction

Nova's IVC prover P for function F with augmented F' defined as:

```
F'(z_i, omega_i, U_i, u_i, T) -> (z_{i+1}, U_{i+1}):
  assert (z_i, omega_i) satisfies F: z_{i+1}=F(z_i,omega_i)
  r_i = H(vk, U_i, u_i, T_i)
  U_{i+1} = NIFS.V(U_i, u_i, T_i, r_i)
  u_{i+1} = new instance representing correctness of F' itself
  return (z_{i+1}, U_{i+1}, u_{i+1})
```

Base case U0 trivially satisfying (E=0, u=1, W=0). Final decider prover after k steps produces Spartan SNARK proof pi that folded Uk is satisfiable: commits to Z, opens via sum-check-based polynomial commitment (Hyrax) with O(log|F|) proof size [1][2].

Verifier work in IVC loop is *only* in F' circuit: two group scalar multiplications for checking barW,barE homomorphic combination; no pairings, no FFTs in-circuit. This is the **smallest recursion overhead in literature** at ~20k constraints, dominated by non-native field arithmetic that CycleFold optimizes to ≈12k after fix [1][6].

Iteration:

1. Fold current running U^{(i)} with new incremental u^{(i)}
2. Produce z_{i+1}
3. Output new U^{(i+1)}, u^{(i+1)}

Proof size O(|F|) for intermediate IVC proof (two commitments + witnesses), final compressed O(log|F|) group elements via Spartan.

> **Corollary:** Under DLOG and ROM, Nova IVC is knowledge-sound for k steps with soundness error O(k·q / |F|) plus SNARK soundness [1].

### 4.4 SuperNova and Non-Uniform IVC

Uniform IVC assumes same circuit F each step. SuperNova introduces selector family {F_j} sharing same structure (m,n) but distinct matrices (A_j,B_j,C_j) — or via CCS where M_i linear combination represents all gates up to selector weight. SuperNova maintains vector vecU = [U_0,...,U_{n-1}], where U_j aggregates all steps invoking f_j [2].

Selector phi circuit outputs one-hot vector s in {0,1}^n, sum s_i =1, where s_i =1 iff i = phi(z,omega). The verifier circuit computes r and folds.

When curves support conditional select efficiently (isZero checks), cost remains O(1) group ops plus O(n) field selects amortized via accumulation.

**A la carte cost theorem:** Cost of proving step invoking f_j is O(|f_j|) MSMs + O(n) field ops for selector vector (n << |f_j| typically, e.g., n=64 RISC-V instructions, |f_j|≈2k constraints). In contrast, universal circuit approach pays O(sum |f_j|) [2][3]. For EVM with 100+ opcodes each 5k–100k constraints, SuperNova reduces prover time 30–80x.

Concrete EVM example: Suppose ADD (200 constraints), MUL (800), SHA3 inner (12000). Universal would be sum =13000 per step even if ADD. SuperNova ADD =200, MUL=800. Over trace 1000 ADDs +10 SHA3, universal pays 1010*13000=13M constraints MSMs vs SuperNova 1000*200+10*12000=320k (40x saving).

```haskell
-- Haskell-like specification of SuperNova step
type Instruction = Int
data RunningInstance = RI { wCm :: Commitment, eCm :: Commitment, u :: Field, x :: Field }

foldNIVC :: [RunningInstance] -> (Instruction, Instance) -> Field -> [RunningInstance]
foldNIVC running (j, uNew) r =
  [ if i==j then foldRI (running!!i) uNew r else running!!i | i <- [0..n-1] ]
  where foldRI u1 u2 r = RunningInstance (wCm u1 + r * wCm u2) (eCm u1 + r * tCm + r^2 * eCm u2) (u u1 + r * u u2) (x u1 + r * x u2)

selectInstruction :: State -> Witness -> Instruction
selectInstruction z w = phi z w
```

**Equivalence:** When n=1, vector collapses to single U, SuperNova identical to Nova [2].

### 4.5 CycleFold, HyperNova, ProtoStar, NeutronNova Extensions

**CycleFold** [3][6] abstracts non-native scalar multiplication inside F'. It provides F' over field F_q proving statements about G1 over F_p (and vice versa) without Emulated field multiplication cost O(log p).

**HyperNova** [3] generalizes R1CS to CCS: CCS defines relation sum_i c_i · prod_{j in S_i} M_j Z =0. This captures Plonkish, AIR, R1CS. HyperNova folding single MSM optimal [3]. Multi-instance folding for k instances costs k field ops + 1 MSM.

**ProtoStar** [4] is generic compiler turning any special-sound protocol into accumulation scheme where accumulation verifier performs k+d+O(1) field ops and k+2 EC ops for k-round protocol. Applied to Plonk with high-degree gates and vector lookups.

**NeutronNova** [5] targets zero-check relation: (f(x)=0 forall x in {0,1}^ell). Folding via single sum-check round: challenge r, folded polynomial p = p1 + r p2. Commitment only to small field elements if witness small (e.g., RISC-V registers 32-bit). Reduces prover MSM to committing small elements only [5].

Comparison table:

| Scheme | Prover Crypto (per step) | Verifier Circuit (constraints) | Multi-instance | Relation Supported | Trusted Setup |
|---|---|---|---|---|---|
| Nova [1] | 2 MSM_{|F|} | ~20k (2 G + H) | No (pairwise chain) | R1CS | No |
| SuperNova [2] | 2 MSM_{|F_j|} + O(n)F | ~20k + O(log n) | Implicit via n tracks | R1CS (non-uniform) | No |
| HyperNova [3] | 1 MSM_{|var|} | O(log m) F + 1 G | Yes (k-fold) | CCS (high-degree) | No |
| ProtoStar [4] | O(ℓ) F + 2 G | 3 G + O(log n)H | Limited | Plonkish gates+lookups | No |
| NeutronNova [5] | Commit small elems + sum-check | Const G + H + F | Yes (log n rounds) | Zero-check => CCS | No |
| CycleFold Nova [6] | 2 MSM + overhead | ~12k (optimized) | Same as Nova | R1CS over cycle | No |

*Italicized* rows denote non-uniform improvements.

---

## 5 Empirical / Proofs

### 5.1 Security Arguments

Knowledge soundness game-based sequence: extractor from IVC proof chain, forking. Zero-knowledge simulator random rerandomization. Malleability fix strong FS [1][6].

### 5.2 Performance Modeling

For C = |F| = 2^{20} ~ 1M constraints, MSM costs dominate: 2 MSMs ~ 2·C group scalar multis. On AWS c6a.32xlarge with Pasta curves, Nova prover ~8.2s per step. SuperNova with n=64 instruction selecting ADD C_j=2^{11} prover 0.18s per step vs universal 8.2s — 45x improvement [2][3].

Memory: Running instance U size = 2 commitments (32 bytes) + public input. Total IVC proof memory O(1) [1]. Final decider Spartan proof ~8–15 KB, verification ~20 ms.

HyperNova single MSM per step cuts prover additional 1.8x. NeutronNova small-value commitment reducing 8x packing yielding 3.5x prover speed for RISC-V zkVM [5].

No FFTs in Nova prover (aside from Spartan final decider which may use O(C log C) for sum-check, but can avoid via Hyrax without FFT). Thus curve choice free: secp256k1/secq256k1 cycle also usable.

```tla+
---- MODULE NovaIVC ----
EXTENDS Naturals, FiniteFields
VARIABLES U_running, u_step, z, step, r
Init == /\ U_running = TrivialRI /\ step = 0 /\ z = z0
Next == \/ \E w \in Witnesses, T \in CrossTerms: /\ F(z,w, z') /\ r' \in Field /\ U_running' = Fold(U_running, u_step, T, r') /\ u_step' = NewInstance(z', step+1) /\ z' \in Field /\ step' = step+1 \/ UNCHANGED <<U_running, u_step, z, step>>
Spec == Init /\ [][Next]_vars /\ WF_vars(Next)
====
```

### 5.3 Practical Deployment

Post-quantum: DLOG commitments eventual replacement hash-based but folding valid with additive homomorphism. LatticeFold adaptation Module-LWE.

For zkRollup, SuperNova enables opcode-customized circuits verified on-chain via single CycleFold verifier: gas ~180k vs Plonk 290k, calldata 2KB [2].

## 6 Limitations

1. **Proof size intermediate**: O(|F|) group elements requiring prover storage linear not logarithmic. Not suitable for memory-constrained streaming provers [1][6].
2. **Structure requirement**: Nova requires same structure A,B,C shared. SuperNova still requires shared size per track. CCS lifts but same max degree per domain [2][3].
3. **Trusted setup avoidance trade-off**: Pedersen transparent but large vectors. KZG needs trusted setup but smaller memory [4].
4. **Cycle vulnerability and malleability**: Early implementation lacked strong FS binding, fake progress 2^{75} steps verified seconds [6]. Corrected.
5. **Non-uniform selective disclosure**: Selector phi leakage via U_i activity reveals trace cardinality. Zero-knowledge update needs O(n) unconditional folding [2].
6. **Zero-check folding limitation**: NeutronNova only folds reducible to zero-check via RoK with random gamma. O(log n) rounds may increase verifier hash count [5].
7. **Ecosystem compatibility**: Spartan decider final proof relies on sum-check O(N) field ops heavier than Groth16 prover for same size (N=2^{20}, Hyrax ~8s vs Groth16 5s). BN254 gas 700k vs Groth16 220k but needs trusted setup [6][3].

## 7 Conclusion

Nova introduced minimalist yet powerful abstraction — folding schemes for relaxed R1CS — that transforms IVC from SNARK verification recursion into linear instance accumulation with constant recursion overhead [1]. SuperNova builds on this to realize non-uniform IVC, proving universal machine execution without universal circuits by maintaining n running relaxed instances and selector-driven a la carte discipline [2]. HyperNova, ProtoStar, NeutronNova illustrate family of reductions parametrized by constraint system and multi-instance strategy [3][4][5].

> *The future of recursive arguments lies not in heavier verifiers but in weaker, more combinable primitives.* Folding schemes exemplify shift: deferring checks, accumulating satisfiability, and only at final moment invoking succinctness.

Practically, deployers should (i) enforce strong Fiat-Shamir including running instance, (ii) instantiate over Pallas/Vesta or BN254/Grumpkin with CycleFold, (iii) use SuperNova vector n tracks where n equals ISA size (32–256), (iv) compile final decider via Spartan with Hyrax commitments, (v) apply NeutronNova zero-check folding when zkVM witness small [5][6].

Future work includes lattice-based folding (LatticeFold+), true zero-cost ZK via folding-induced rerandomization without zkSNARKs, and folding for Protogalaxy-style vector-RAM lookups where memory consistency reduces to zero-check after Lasso decomposition.

---

## References

[1] Kothapalli, A., Setty, S., Tzialla, I. Nova: Recursive Zero-Knowledge Arguments from Folding Schemes. CRYPTO 2022; ePrint 2021/370. https://eprint.iacr.org/2021/370

[2] Kothapalli, A., Setty, S. SuperNova: Proving universal machine executions without universal circuits. ePrint 2022/1758. https://eprint.iacr.org/2022/1758

[3] Kothapalli, A., Setty, S. HyperNova: Recursive arguments for customizable constraint systems. CRYPTO 2024; ePrint 2023/573. https://eprint.iacr.org/2023/573

[4] Bünz, B., Chen, B. ProtoStar: Generic Efficient Accumulation/Folding for Special Sound Protocols. ePrint 2023/620. https://eprint.iacr.org/2023/620

[5] Kothapalli, A., Setty, S. NeutronNova: Folding everything that reduces to zero-check. ePrint 2024/1606. https://eprint.iacr.org/2024/1606

[6] Nguyen, W., Boneh, D., Setty, S. Revisiting the Nova Proof System on a Cycle of Curves. ePrint 2023/969. https://eprint.iacr.org/2023/969

[7] Crypto 2022 Chapter PDF (Nova definition). https://crypto.iacr.org/2022/papers/538806_1_En_13_Chapter_OnlinePDF.pdf

[8] LambdaClass IVC Nova explainer (implementation perspective). https://blog.lambdaclass.com/incrementally-verifiable-computation-nova/

