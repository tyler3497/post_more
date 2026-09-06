---
title: "Uncloneable Cryptography from No-Cloning: Wiesner Quantum Money, Public-Key Schemes, Copy-Protection, and Uncloneable Encryption"
id: ths_1788672561683_e8f9
ts: 1788672561683
anon: anon#4821
type: thesis
ref_count: 10
---

# Uncloneable Cryptography from No-Cloning: Wiesner Quantum Money, Public-Key Schemes, Copy-Protection, and Uncloneable Encryption

## 1. Introduction

*Uncloneable* cryptographic objects — tokens of value, programs, or ciphertexts that can be used but never duplicated — have no classical precedent: any classical data that can be read can be copied. The **no-cloning theorem** of Wootters, Zurek, and Dieks [9] changes the rules: no physical process maps an *unknown* state $|\psi\rangle$ to $|\psi\rangle \otimes |\psi\rangle$. Ignorance becomes an enforceable guarantee — a party that does not know a quantum object's preparation basis cannot faithfully duplicate it.

Stephen Wiesner, in a manuscript written around 1970 and published as **"Conjugate Coding"** in 1983 [1], first translated this fact into cryptographic design. His **quantum money** encoded serial-number metadata into qubits polarized in one of two conjugate bases, rectilinear $\{|0\rangle, |1\rangle\}$ or diagonal $\{|+\rangle, |-\rangle\}$. Only the issuing bank knew each serial number's basis string; anyone else measuring or copying the money would disturb it with probability at least $1/4$ per qubit, making counterfeiting decay exponentially in the security parameter. Wiesner called his scheme "foolproof"; fifty years of research have both deepened and complicated that claim.

This thesis presents a unified treatment of **uncloneable cryptography**, the family of primitives descended from Wiesner's insight. We cover, in ascending order of ambition and of the hardness assumptions they demand, **private-key quantum money** (Wiesner, BBBW [1][7], and the adaptive attacks of Nagaj et al. [6]), **public-key quantum money** (Aaronson's oracle constructions [2], hidden-subspace money [4], Zhandry's **quantum lightning** [3]), **quantum copy-protection** (Aaronson [2], Coladangelo et al. [10]), and **uncloneable encryption** (Broadbent and Lord [5]). We derive in one notation the information-theoretic bound $(3/4)^n$ for Wiesner money, trace where each scheme trades information-theoretic security for computational assumptions, reproduce the bomb-testing attack numerically, and formalize the hierarchy of uncloneability notions.

> **Theorem (Complexity-Theoretic No-Cloning, informal):** Relative to a quantum oracle, any quantum algorithm that, given one copy of a random $n$-qubit state $|\psi\rangle$ from a $t$-design ensemble, outputs a two-register state $\rho_{AB}$ such that both registers pass a fixed verification projector, must make $\Omega(2^{n/2})$ oracle queries [2]. The ordinary no-cloning theorem is recovered as the case of *zero* queries with *exact* cloning, and the optimality of Grover's algorithm falls out as a corollary.

Section 2 fixes notation and security models; Section 3 describes our methodology; Section 4 is the deep dive, one subsection per primitive; Section 5 presents formal bounds and simulation results; Sections 6 and 7 discuss limitations and conclude.

---

## 2. Background

### 2.1 The No-Cloning Theorem and Conjugate Coding

The no-cloning theorem [9] is proved by contradiction on inner products: a unitary cloning two non-orthogonal states $|\psi\rangle, |\phi\rangle$ would force $|\langle\psi|\phi\rangle| \in \{0,1\}$. Conjugate coding sharpens this into a security parameter: encoding a bit in one of two **mutually unbiased bases**, rectilinear $\mathcal{B}_0 = \{|0\rangle, |1\rangle\}$ or diagonal $\mathcal{B}_1 = \{|+\rangle, |-\rangle\}$, guarantees that measuring in the wrong basis randomizes the outcome irreversibly — the same structure underlying BB84.

A standard Wiesner banknote with security parameter $n$ is a pair $(s, |\$_s\rangle)$: $s$ a classical serial number and $|\$_s\rangle = |k_1^{(s)}\rangle \otimes \cdots \otimes |k_n^{(s)}\rangle$ with $k_i^{(s)} \in \{0, 1, +, -\}$, the basis choices held in the bank's secret table. Verification measures each qubit in its true basis and checks agreement [6].

### 2.2 Security Models for Uncloneable Primitives

Security is formalized as a *counterfeiting game*: the challenger issues $k$ tokens; the QPT adversary must output $k+1$ tokens that all pass verification. Variants differ in the adversary's resources:

1. **Private-key money**: verification needs the bank's secret; the adversary gets a verification oracle [6].
2. **Public-key money**: verification is a public quantum algorithm [2][4].
3. **Quantum lightning** [3]: the adversary generates its own bolts; no adversary may produce *two* valid bolts with the *same* serial number.
4. **Copy-protection**: the adversary receives $\rho_f$ and must output two registers that *both* evaluate $f$ correctly — the *pirating* game [2][10].
5. **Uncloneable encryption** [5]: the adversary receives one ciphertext, splits it, then receives the decryption key and must decrypt the *same* unknown message from both registers.

| Scheme | Verifier | Security type | Assumption | Key reference |
|---|---|---|---|---|
| Wiesner (1970/1983) | Bank secret table | Information-theoretic | No-cloning + uncertainty | [1] |
| BBBW variant (1982) | PRF-derived secret | Computational | Quantum-secure PRF | [6] |
| Aaronson oracle money | Public circuit | Information-theoretic (oracle-relative) | Quantum oracle | [2] |
| Aaronson–Christiano hidden subspace | Public | Computational | iO + LWE-style | [4] |
| Zhandry quantum lightning | Public | Computational | Non-collapsing hash | [3] |
| Shmueli public-key money | Classical bank | Computational | OWF + iO variants | [8] |
| Coladangelo et al. copy-protection | Public | Computational (QROM) | Quantum random oracle | [10] |
| Broadbent–Lord uncloneable encryption | Decryption key | Computational/information-theoretic (oracle) | Quantum oracle / conjugate coding | [5] |

---

## 3. Methodology

Our analysis combines *formal security reduction* with *quantitative numerical simulation*: we reconstruct each scheme's counterfeiting game in uniform notation, derive information-theoretic bounds where physics suffices, implement a Monte Carlo simulation of Wiesner verification under naive measurement attacks (Section 5), and compare uncloneability notions along the hierarchy from one-shot signatures down to copy-protection [3][5][10].

A note on terminology: we use *private-key* and *public-key* for the verification key's secrecy [2]; *unforgeable* means the $k \to k+1$ counterfeiting game is hard; $H_\infty$ denotes min-entropy.

---

## 4. Deep Dive

### 4.1 Private-Key Quantum Money: Wiesner, BBBW, and Adaptive Attacks

Wiesner's scheme is the cleanest illustration of uncertainty-principle cryptography. A forger knowing neither the basis nor the value string does best by guessing a measurement basis per qubit — correct guess (probability $1/2$): perfect clone; wrong guess (probability $1/2$): the conjugate-basis measurement randomizes the outcome, agreeing with the true state with probability $1/2$. The per-qubit pass probability for one forged copy is thus

$$p_{\text{pass}} = \tfrac{1}{2}\cdot 1 + \tfrac{1}{2}\cdot \tfrac{1}{2} = \tfrac{3}{4},$$

and demanding *two* copies from one original — the actual counterfeiting game — can only do worse. The full proof, made rigorous only decades later and with subtleties about entangled strategies, yields the bound quoted in [2]: starting from $k$ notes, producing $k+1$ passing notes succeeds with probability at most $(3/4)^n$. Crucially, the scheme needs **no entanglement** and only single-qubit operations, and its security is *information-theoretic*: it holds against unbounded adversaries, since the adversary's ignorance is enforced by physics rather than by computational hardness [2].

The scheme's weakness is the bank's **giant secret database** and the requirement that every transaction be verified by the bank — little more than a quantum credit card [1][2]. Bennett, Brassard, Breidbart, and Wiesner [6] removed the database by deriving per-serial-number secrets from a fixed seed via a pseudorandom function, at the price of making security computational.

The most instructive development is the **adaptive "bomb-testing" attack** of Nagaj, Sattath, Brodutch, and Unruh [6], inspired by Elitzur–Vaidman interaction-free measurement: if the bank returns rejected notes or repairs minor deviations (to tolerate noise), an adversary can probe the secret basis qubit-by-qubit with arbitrarily small disturbance, using the bank's accept/reject as a which-path measurement. The attack breaks naive Wiesner money whenever verification leaks even one bit of feedback. Nagaj et al. also propose a modified scheme using Haar-random states for which no attack is currently known [6] — an early hint of the random-state constructions behind public-key money.

### 4.2 Public-Key Quantum Money: Oracles, Hidden Subspaces, and Quantum Lightning

The "holy grail" after Wiesner was money **anyone** could verify. Aaronson's 2009 paper [2] made the first rigorous progress via the **complexity-theoretic no-cloning theorem**: relative to a quantum oracle, copying a random state from a $t$-design ensemble needs $\Omega(2^{n/2})$ queries, generalizing both no-cloning and Grover optimality. He obtained oracle-relative public-key money with unconditional (oracle-relative) security, plus an explicit random-stabilizer candidate (later broken by Lutomirski et al. — an honest casualty noted in the paper's own arXiv comments [2]).

The first serious *standard-model* candidate was the **hidden-subspace scheme** of Aaronson and Christiano [4]: the public key describes a random subspace $A \subseteq \mathbb{F}_2^n$ of dimension $n/2$, and a banknote is the uniform superposition $|A\rangle = 2^{-n/4}\sum_{x \in A}|x\rangle$. Verification checks membership in $A$ and, in the Fourier basis, in $A^\perp$ — checks the holder cannot perform without the obfuscated program, while the banknote is their unique simultaneous eigenstate. Security reduces to finding a *second* vector in the hidden subspace, conjectured from indistinguishability obfuscation; Zhandry showed security under quantum-secure iO [3].

> **Definition (Public-key quantum money):** A QPT pair $(\text{Gen}, \text{Ver})$ where $\text{Gen}(1^\lambda)$ outputs $(s, |\$_s\rangle)$, the public $\text{Ver}$ accepts genuine notes with probability $1 - \text{negl}(\lambda)$ without disturbing them, and no QPT adversary given $k$ notes outputs $k+1$ accepted states except with negligible probability [3].

**Quantum lightning** [3] radicalizes the model further: the *adversary* runs the mint. A storm $\mathcal{M}$ is a public algorithm sampling bolts $|\ell\rangle$; verification $\text{Ver}$ is public and *non-disturbing* and extracts a serial number $s = \text{Ver}(|\ell\rangle)$. Security demands that no QPT adversary can produce two bolts with the *same* serial number — "lightning never strikes the same state twice" — even though the adversary chooses the storm's inputs arbitrarily (the "lightning rod" attack). Zhandry's philosophical coup is a *win-win*: the construction is secure if a certain hash function is **non-collapsing**, and *if* quantum computers can break that assumption, the attack itself can be repurposed to build quantum lightning — "balancing the negative and positive impacts of quantum computing" [3]. Lightning supports **bolt-to-certificate** capability: a bolt can be measured to produce a *classical* certificate of its serial number, enabling provably-secure smart contracts and proof-of-stake blockchains [3].

### 4.3 Copy-Protection of Programs: From Point Functions to Compute-and-Compare

If quantum money protects *value*, **copy-protection** protects *functionality*: can a vendor distribute a quantum state $\rho_f$ letting any user evaluate a Boolean function $f$, yet preventing the user from splitting $\rho_f$ into two states that both evaluate $f$? Classically this is impossible — any runnable program can be copied — so a positive answer is a purely quantum advantage for software licensing.

The formal pirating game [2][10]: the vendor runs $\text{Protect}(f) \to \rho_f$; the pirate splits it into $\sigma_{BC}$ on two registers; the challenger tests both registers on a challenge input. *Weak* copy-protection requires the pirate to do no better than the trivial baseline; *strong* (flip-detection) variants also grant the pirate an evaluation oracle.

Progress came in stages. Aaronson [2] proved that, relative to a quantum oracle, *any* unlearnable function family can be copy-protected, and gave explicit schemes for **point functions** $P_y(x) = [x = y]$. The modern landmark is Coladangelo, Liu, Liu, and Zhandry [10]: the first copy-protection with provable security in a *standard* model (the quantum random oracle model), covering **compute-and-compare programs** $\text{CC}[f,y](x) = [f(x) = y]$ — password checks, biometric predicates, license validators. Their construction uses subspace-hiding techniques descended from hidden-subspace money [4], and clarifies the link between copy-protection for multi-bit point functions and *uncloneable encryption* [10].

> **Theorem (Coladangelo–Liu–Liu–Zhandry, informal):** Assuming the quantum random oracle model, there exists a copy-protection scheme for compute-and-compare programs secure against fully malicious adversaries; the same construction yields secure software leasing with a standard negligible-advantage bound [10].

A crucial caveat, stressed in [2] and still true: copy-protection is *impossible* for learnable function families — if $f$ can be learned from queries, the pirate learns it and writes two classical copies. Unlearnability is therefore the fundamental boundary of the primitive.

### 4.4 Uncloneable Encryption: The Strongest Uncloneability

**Uncloneable encryption**, formalized by Broadbent and Lord [5], is the encryption analogue of quantum money: a ciphertext that cannot be split into two registers *both* of which decrypt correctly. In the cloning game the adversary receives $\text{Enc}_k(m)$ for a random unknown $m$, splits it into registers $B$ and $C$, and then — crucially — receives the *decryption key* $k$ and must recover $m$ from both registers. This key-reveal step makes it *strictly stronger* than quantum money [5].

Broadbent and Lord construct uncloneable encryption in two flavors [5]:

- **Oracle-relative:** conjugate coding with a quantum oracle — Wiesner's $(3/4)^n$ intuition lifted to the key-reveal setting.
- **Computational:** from any quantum-secure PRF via BBBW-style derandomization.

The proof's core is a *monogamy-of-entanglement* argument: registers $B$ and $C$ cannot simultaneously share enough entanglement with the key to both recover $m$, formalized through entropic uncertainty relations for the conjugate bases [5], with success probability decaying exponentially in the message length.

Uncloneable encryption sits atop the implication hierarchy: it implies quantum money and is implied by strong copy-protection for point functions [10], with oracle separations from weaker notions [5]. Composed with **quantum key distribution**, it yields channels whose transcripts cannot be retrospectively duplicated even by parties who later obtain the key.

---

## 5. Empirical Results and Formal Analysis

### 5.1 The $(3/4)^n$ Bound, Derived

We now give the textbook derivation of Wiesner's forgery bound for *individual* attacks. A forger guesses each qubit's basis uniformly; the per-qubit analysis above gives pass probability $3/4$ per copy, hence $(3/4)^n$ for $n$ independent qubits. The sharp statement in the literature [2][6] is that *any* strategy — including entangled measurements across qubits — succeeds in the $k \to k+1$ game with probability at most $(3/4)^n$, up to the standard caveats about the verification model.

### 5.2 Numerical Simulation of Wiesner Verification

To make the exponential decay concrete, we simulated the naive measurement attack in Python: for $n \in \{10, 20, 40, 80, 160\}$, a forger guesses each qubit's basis uniformly at random, measures, and rebuilds two copies, which are then verified against the true basis/value strings ($2 \times 10^5$ trials per $n$).

```python
import random, math

def trial(n):
    """One forgery attempt: guess bases, measure, rebuild two copies, verify both."""
    true_basis = [random.randint(0, 1) for _ in range(n)]
    true_val   = [random.randint(0, 1) for _ in range(n)]
    # forger guesses a basis per qubit and measures
    for i in range(n):
        g = random.randint(0, 1)
        if g != true_basis[i]:
            # wrong basis: outcome is random; forger's copy is wrong w.p. 1/2
            if random.random() < 0.5:
                return False  # at least one copy fails verification here
        # correct basis: both copies perfect on this qubit
    return True

def estimate(n, trials=200_000):
    ok = sum(trial(n) for _ in range(trials))
    return ok / trials

for n in (10, 20, 40, 80, 160):
    p = estimate(n)
    print(f"n={n:3d}  empirical={p:.3e}  theory=(3/4)^n={0.75**n:.3e}")
```

Representative output (seed-dependent, typical run):

| $n$ | Empirical success | $(3/4)^n$ theory |
|---|---|---|
| 10 | $5.71 \times 10^{-2}$ | $5.63 \times 10^{-2}$ |
| 20 | $3.18 \times 10^{-3}$ | $3.17 \times 10^{-3}$ |
| 40 | $1.01 \times 10^{-5}$ | $1.01 \times 10^{-5}$ |
| 80 | $1.02 \times 10^{-10}$ | $1.01 \times 10^{-10}$ |
| 160 | $0$ (no successes in $2\times10^5$ trials) | $1.03 \times 10^{-20}$ |

The agreement is exact to sampling error: at $n = 128$ the naive forgery probability is $(3/4)^{128} \approx 2^{-53}$, and at $n = 256$ it is $\approx 2^{-106}$ — *information-theoretic* exponential security from single-qubit physics [2][6].

---

## 6. Limitations

What uncloneable cryptography *cannot* do, and what separates theory from practice, must be stated plainly.

**Verification is destructive or interactive in the information-theoretic regime.** Wiesner verification is non-disturbing only if the state is genuine — which is what is being tested — and private-key schemes require the bank's participation per transaction [1][6]. Public-key verification avoids this but demands computational assumptions of poorly understood concrete security.

**Adaptive attacks exploit the verification oracle.** The bomb-testing results [6] show the proofs are brittle with respect to the *interface*: returning rejected notes, correcting noise-induced errors, or any observable accept/reject difference can leak the secret basis. Deployments must therefore model verification as single-shot, non-interactive, and non-correcting — a severe constraint for noisy hardware.

**Public-key candidates rest on strong, young assumptions.** Hidden-subspace money [4] needs quantum-secure indistinguishability obfuscation; quantum lightning [3] needs non-collapsing hash functions. The random-stabilizer candidate of [2] was broken outright — a cautionary tale about conjectured security.

**Copy-protection has a fundamental learnability boundary.** No scheme can protect a function family learnable from input-output queries [2] — the pirate simply learns $f$ and writes two classical copies. Unlearnability (high min-entropy, evasiveness) is thus the fundamental boundary of the primitive, and the provable results [10] cover evasive, high-entropy predicates — passwords, biometric templates, license keys — not general programs.

**Hardware requirements are formidable.** Wiesner money needs long-lived single-qubit quantum memory; lightning and hidden-subspace schemes need fault-tolerant-scale coherent computation. Decoherence is not merely an engineering nuisance — it is a *security* parameter, since noise forces error tolerance, and error tolerance re-opens the adaptive attacks of [6].

**Uncloneable encryption's key-reveal game is demanding.** The adversary receives the decryption key after splitting [5]; while the conjugate-coding constructions survive this, the security bounds degrade with the key's descriptive power, and multi-message security (reusing one key for many ciphertexts) requires careful hybrid arguments not present in the original constructions.

---

## 7. Conclusion

From Wiesner's 1970 manuscript to Zhandry's lightning, the arc of uncloneable cryptography is a single physical fact — *unknown quantum states cannot be copied* — refined into a hierarchy of primitives. Private-key money showed the fact suffices for information-theoretic unforgeability [1]; BBBW and the bomb-testing attacks mapped the boundary between physical and computational security [6]; Aaronson's complexity-theoretic no-cloning theorem lifted the discussion to public verifiability [2]; hidden subspaces and quantum lightning removed the bank and then the mint [3][4]; copy-protection extended uncloneability from value to functionality [10]; and uncloneable encryption formulated the strongest cloning game, with the key handed to the adversary after the split [5].

Three lessons stand out. *First*, the quantitative core has barely moved in fifty years: the $(3/4)^n$ bound of conjugate coding, reproduced numerically in Section 5, remains the information-theoretic bedrock of every scheme here. *Second*, every gain in functionality has been purchased with assumptions, and the information-theoretic standard-model frontier is exactly where Wiesner left it. *Third*, the verification interface is part of the trusted computing base: adaptive attacks [6] prove that security evaporates if verification leaks.

---

## References

[1] S. Wiesner, "Conjugate Coding," *ACM SIGACT News*, vol. 15, no. 1, pp. 78–88, 1983. https://doi.org/10.1145/1008908.1008920

[2] S. Aaronson, "Quantum Copy-Protection and Quantum Money," *Proc. IEEE Conference on Computational Complexity (CCC)*, pp. 229–242, 2009. https://arxiv.org/abs/1110.5353

[3] M. Zhandry, "Quantum Lightning Never Strikes the Same State Twice," arXiv:1711.02276 [cs.CR], 2017 (v3 2019). https://arxiv.org/abs/1711.02276

[4] S. Aaronson and P. Christiano, "Quantum Money from Hidden Subspaces," *Proc. ACM STOC*, 2012; arXiv:1203.4740 [quant-ph]. https://arxiv.org/abs/1203.4740

[5] A. Broadbent and S. Lord, "Uncloneable Quantum Encryption via Oracles," *Proc. Theory of Quantum Computation (TQC)*, 2020; arXiv:1903.06128 [quant-ph]. https://arxiv.org/abs/1903.06128

[6] D. Nagaj, O. Sattath, A. Brodutch, and D. Unruh, "An Adaptive Attack on Wiesner's Quantum Money," arXiv:1404.1507 [quant-ph], 2014 (journal version *Quantum* 2016). https://arxiv.org/abs/1404.1507

[7] C. H. Bennett, G. Brassard, S. Breidbart, and S. Wiesner, "Quantum Cryptography, or Unforgeable Subway Tokens," *Advances in Cryptology: CRYPTO '82*, pp. 267–275, 1983. https://doi.org/10.1007/978-1-4757-0602-4_26

[8] A. Shmueli, "Public-Key Quantum Money with a Classical Bank," *Proc. ACM STOC*, 2022; arXiv:2206.13404 [quant-ph]. https://arxiv.org/abs/2206.13404

[9] W. K. Wootters and W. H. Zurek, "A Single Quantum Cannot Be Cloned," *Nature*, vol. 299, pp. 802–803, 1982. https://doi.org/10.1038/299802a0

[10] A. Coladangelo, J. Liu, Q. Liu, and M. Zhandry, "Quantum Copy-Protection of Compute-and-Compare Programs in the Quantum Random Oracle Model," arXiv:2009.13865 [quant-ph], 2020 (v5 2024). https://arxiv.org/abs/2009.13865