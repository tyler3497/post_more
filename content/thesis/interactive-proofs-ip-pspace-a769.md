---
id: interactive-proofs-ip-pspace-a769
title: "Interactive Proofs and the Power of Randomization: IP = PSPACE, the Sum-Check Protocol, and Doubly-Efficient Proof Systems"
anon: anon#1431
ts: 1788931693000
type: thesis
---

# Interactive Proofs and the Power of Randomization: IP = PSPACE, the Sum-Check Protocol, and Doubly-Efficient Proof Systems

## Abstract

This thesis examines the interactive proof system model of Goldwasser, Micali, and Rackoff, and the two results that defined its modern form: the Lund–Fortnow–Karloff–Nisan *sum-check protocol* and Adi Shamir's theorem that **IP = PSPACE**. We develop the formalism of interactive proofs with completeness and soundness error, present the arithmetization technique that converts boolean formulas into multivariate polynomials over finite fields, and give a self-contained exposition of the sum-check protocol for verifying sums of polynomial evaluations over the hypercube. We then reconstruct the proof that the PSPACE-complete language TQBF admits an interactive proof, establishing **PSPACE ⊆ IP**, and combine it with the space-bounded simulation of interactive proofs to conclude **IP = PSPACE**. The second half of the thesis covers the GKR protocol for layered arithmetic circuits and the Goldwasser–Kalai–Rothblum paradigm of *doubly-efficient* interactive proofs, in which an honest prover runs in polynomial time and the verifier runs in near-linear time. We analyze the Fiat–Shamir heuristic for removing interaction, sketch the lineage from interactive proofs to modern SNARKs, and evaluate strengths, limitations, and open problems in delegated computation.

## 1 Introduction

The classical notion of a *proof* is a static object: a string of symbols that any reader can check, step by step, at leisure. The interactive proof system, introduced by Goldwasser, Micali, and Rackoff in 1985, shatters this picture [1]. A proof becomes a *conversation*: a computationally unbounded prover $P$ and a randomized polynomial-time verifier $V$ exchange messages over a polynomial number of rounds, after which $V$ either accepts or rejects. The verifier may err, but only with small probability — and the error can be driven exponentially small by repetition. Remarkably, this weakening of "proof" is not a concession at all: the set of languages admitting interactive proofs, denoted **IP**, turns out to equal **PSPACE**, the class of languages decidable in polynomial space.

> **Thesis statement.** Randomization and interaction, far from being mere conveniences, exactly capture polynomial-space computation. The algebraic techniques developed for this — *arithmetization* and the *sum-check protocol* — remain the workhorses of every practical verifiable-computation system in use today.

The path to **IP = PSPACE** runs through two papers. First, Lund, Fortnow, Karloff, and Nisan showed that every language in **co-NP** admits an interactive proof, via the sum-check protocol [2]. Their technique was so striking that within roughly two weeks, Shamir extended it to quantified boolean formulas and proved **IP = PSPACE** [3]. These results revealed that *polynomials over finite fields are excellent error-correcting codes*: a false claim about a sum over the hypercube can survive one round of the protocol only if the verifier's random challenge lands on a root of a nonzero univariate polynomial, an event of probability at most $\deg/|F|$ by the Schwartz–Zippel lemma.

This thesis is organized as follows. Section 2 formalizes interactive proofs, completeness, soundness, private versus public coins, and the complexity classes **IP** and **AM**. Section 3 develops arithmetization: the multilinear extension, the boolean-to-polynomial translation, and the Schwartz–Zippel lemma. Section 4 gives the deep technical treatment: the sum-check protocol with full soundness analysis; the arithmetization of quantified boolean formulas and Shamir's proof of **PSPACE ⊆ IP**; the reverse simulation **IP ⊆ PSPACE**; the GKR protocol for layered arithmetic circuits; and the Fiat–Shamir transform. Section 5 evaluates the paradigm empirically and theoretically: the GKR/Goldwasser–Kalai–Rothblum doubly-efficient protocols [4], the first practical implementations [5], and the lineage to modern SNARKs [6]. Section 6 discusses limitations and open problems; Section 7 concludes.

---

## 2 Background

### 2.1 The interactive proof model

An *interactive proof system* for a language $L \subseteq \{0,1\}^*$ is a pair $(P, V)$ of interactive Turing machines such that [1]:

1. **The prover** $P$ is computationally *unbounded* — it may use arbitrary time and space. Its messages are strategic; it will try to convince $V$ of the truth.
2. **The verifier** $V$ is a *probabilistic polynomial-time* machine with access to a random tape of length polynomial in the input size $n = |x|$.
3. On common input $x$, the two machines exchange at most $p(n)$ messages for some polynomial $p$, after which $V$ outputs **accept** or **reject**.

The system satisfies:

- **Completeness:** If $x \in L$, then $\Pr[\langle P, V\rangle(x) = \text{accept}] \geq 2/3$.
- **Soundness:** If $x \notin L$, then for *every* prover strategy $P^*$, $\Pr[\langle P^*, V\rangle(x) = \text{accept}] \leq 1/3$.

The constants $2/3$ and $1/3$ are arbitrary: sequential repetition reduces both errors exponentially. The class **IP** is the set of languages with an interactive proof system, and **IP**$[r]$ restricts to $r(n)$ rounds. Several immediate observations are worth recording:

| Fact | Statement |
|------|-----------|
| **NP** ⊆ **IP** | The prover sends the witness; the verifier checks deterministically. |
| **BPP** ⊆ **IP** | The verifier ignores the prover and decides on its own. |
| Error reduction | Repetition yields completeness $1 - 2^{-k}$ and soundness $2^{-k}$ for any polynomial $k$. |
| Graph non-isomorphism | The complement of graph isomorphism, not known to be in **NP**, admits a constant-round interactive proof. |

> **Remark.** The private coins of the verifier can be made public at the cost of two extra rounds (Goldwasser–Sipser), and Babai showed **AM**$[k]$ = **AM** for constant $k$, so for constant-round protocols public and private coins are essentially equivalent [1].

### 2.2 Complexity-theoretic context

**PSPACE** is the class of languages decidable by a deterministic Turing machine using space polynomial in the input length. The classical relationships known by 1990 were:

$$\mathbf{P} \subseteq \mathbf{NP} \subseteq \mathbf{PSPACE} \subseteq \mathbf{EXP}$$

with $\mathbf{P} \neq \mathbf{EXP}$ by the time hierarchy theorem, so at least one inclusion is strict — but which ones remain open to this day. The celebrated result of this thesis closes one particular gap by *relativizing differently*:

> **Theorem 1 (Shamir [3]).** $\mathbf{IP} = \mathbf{PSPACE}.$

Since **IP** was defined without reference to space at all — only to *interaction with randomness* — the equality says that the verifier's random coins and the prover's strategic messages together simulate arbitrary polynomial-space computation, and vice versa. This is one of the most famous examples of a theorem that *does not relativize*.

### 2.3 Algebraic preliminaries

All the protocols in this thesis operate over a finite field $\mathbb{F}$ with $|\mathbb{F}|$ much larger than any relevant degree. We need one lemma more than any other.

> **Lemma (Schwartz–Zippel).** Let $f : \mathbb{F}^n \to \mathbb{F}$ be a nonzero polynomial of total degree $d$. Then $\Pr_{r \leftarrow \mathbb{F}^n}[f(r) = 0] \leq d/|\mathbb{F}|$.

In particular, a nonzero *univariate* polynomial of degree $d$ has at most $d$ roots. This is the entire soundness story in one line: if a cheating prover sends a polynomial different from the true one, the verifier's random evaluation point catches the lie unless it hits one of at most $d$ roots.

The *multilinear extension* of a function $W : \{0,1\}^n \to \mathbb{F}$ is the unique polynomial $\tilde{W} : \mathbb{F}^n \to \mathbb{F}$ of degree at most $1$ in each variable agreeing with $W$ on the hypercube, given explicitly by

$$\tilde{W}(x_1,\ldots,x_n) = \sum_{b \in \{0,1\}^n} W(b) \prod_{i=1}^{n} \big(b_i x_i + (1-b_i)(1-x_i)\big).$$

Multilinear extensions have total degree at most $n$ and are the canonical bridge between boolean circuits and polynomials.

---

## 3 Methodology

Our methodology is *arithmetization*: we translate combinatorial claims (about boolean formulas, circuits, or quantified sentences) into algebraic claims (about polynomials over $\mathbb{F}$), and then exploit the rigidity of polynomials to verify them interactively with minimal communication. The pipeline has three stages:

1. **Encode.** Replace boolean connectives with polynomial operations over $\mathbb{F}$:
$$\neg a \;\mapsto\; 1 - a, \qquad a \wedge b \;\mapsto\; a \cdot b, \qquad a \vee b \;\mapsto\; a + b - a\cdot b.$$
   On $\{0,1\}$-valued inputs these agree exactly with the boolean operations. Existential and universal quantifiers become sums and products, respectively:
$$\exists x_i\, \psi \;\mapsto\; \sum_{x_i \in \{0,1\}} \tilde\psi, \qquad \forall x_i\, \psi \;\mapsto\; \prod_{x_i \in \{0,1\}} \tilde\psi.$$

2. **Reduce.** The claim "$\Psi$ is true" becomes a claim about the *value* of a large polynomial expression. The verifier cannot evaluate the expression directly (it has $2^n$ terms), so the prover engages in a protocol that strips the quantifiers one variable at a time, each round reducing a claim about $n-i+1$ free variables to a claim about $n-i$.

3. **Check.** After all variables are eliminated, the verifier holds a claim about a single polynomial evaluation, which it can check directly in polynomial time. Soundness follows inductively: if the original claim was false, then at each round the prover's message must disagree with the true polynomial, and the verifier's random challenge exposes the disagreement with probability at least $1 - d/|\mathbb{F}|$ per round by Schwartz–Zippel.

This method is *modular*: the sum-check protocol handles sums; a variant handles quantified formulas by "smoothing" the polynomial degree between rounds (Shamir's degree-reduction operators); and the GKR protocol iterates sum-check across the layers of an arithmetic circuit. The same core loop underlies every modern SNARK: commit to a polynomial, challenge it at a random point, recurse.

---

## 4 Deep Dive

### 4.1 The sum-check protocol

The sum-check protocol of Lund, Fortnow, Karloff, and Nisan [2] solves a canonical problem: given an $\ell$-variate polynomial $g : \mathbb{F}^\ell \to \mathbb{F}$ of degree at most $d$ per variable, the prover claims $H = \sum_{b \in \{0,1\}^\ell} g(b)$, and the verifier confirms it while evaluating $g$ at only *one* point.

**Protocol.** For $i = 1, \ldots, \ell$: the prover sends the univariate polynomial $g_i(X_i) = \sum_{b_{i+1},\ldots,b_\ell} g(r_1,\ldots,r_{i-1}, X_i, b_{i+1},\ldots,b_\ell)$ (degree $\leq d$). The verifier checks $g_i(0) + g_i(1) = H_{i-1}$ (with $H_0 = H$), draws random $r_i \in \mathbb{F}$, and sets $H_i = g_i(r_i)$. Finally it checks $H_\ell = g(r_1,\ldots,r_\ell)$ directly.

> **Theorem 2 (Sum-check [2]).** The protocol is complete. If the claimed $H$ is wrong, the verifier rejects with probability at least $1 - \ell d/|\mathbb{F}|$.

*Soundness idea.* A false claim forces some $g_i \neq \hat g_i$; their difference has degree $\leq d$, hence at most $d$ roots. Unless $r_i$ hits a root (probability $\leq d/|\mathbb{F}|$), the lie propagates. Induction gives survival probability $\leq \ell d/|\mathbb{F}|$; the final check catches survivors. The verifier never touches the $2^\ell$ summands except through the prover's compressed messages:

```python
def sumcheck_verify(g, claim, ell, d):
    H, r = claim, []
    for i in range(ell):
        g_i = receive_poly(degree_bound=d)          # prover's message
        assert g_i(0) + g_i(1) == H, "reject"        # consistency check
        r_i = random_field_element(); r.append(r_i)
        H = g_i(r_i); send(r_i)                      # random challenge
    assert g(*r) == H, "reject"                      # final direct check
    return True
```

### 4.2 Arithmetization of quantified boolean formulas

Shamir's breakthrough extends sum-check from sums to arbitrary *quantified* boolean formulas [3]. For $\Psi = Q_1 x_1 \cdots Q_n x_n\, \phi$ with $\phi$ in 3-CNF, define the arithmetized polynomial $A_\Psi$ over $\mathbb{F}$: literals become $x_i$ / $1-x_i$; $\wedge$ becomes multiplication, $\vee$ becomes $a+b-ab$; $\exists x_i$ becomes $\sum_{x_i \in \{0,1\}}$, $\forall x_i$ becomes $\prod_{x_i \in \{0,1\}}$. Then $\Psi$ is true iff $A_\Psi = 1$.

The obstacle: each universal quantifier *doubles* the degree, potentially reaching $2^n$. Shamir's fix is the *degree-reduction operator*

$$R_{x_i}[f] = (1 - x_i)\, f|_{x_i=0} + x_i\, f|_{x_i=1},$$

the linear interpolation through the two boolean values. It agrees with $f$ on $\{0,1\}$ in the $x_i$ coordinate while capping the degree in $x_i$ at $1$. Inserting $R_{x_i}$ before each quantifier keeps every intermediate polynomial's per-variable degree polynomial in $n$, while preserving all hypercube evaluations — the only ones that matter.

### 4.3 Shamir's theorem: PSPACE ⊆ IP

With degree reduction, the TQBF protocol mirrors sum-check with one generalized round per quantifier [3]: the prover sends the univariate polynomial in $x_1$; the verifier checks consistency, draws random $r_1 \in \mathbb{F}$, and continues with the reduced formula $\Psi|_{x_1=r_1}$. Products from $\forall$ quantifiers are handled by an auxiliary degree check. After $n$ rounds the verifier evaluates the variable-free arithmetized formula directly. A false claim forces a wrong univariate polynomial in some round, caught with probability $\geq 1 - \mathrm{poly}(n)/|\mathbb{F}|$ per round; superpolynomial $|\mathbb{F}|$ makes total error negligible.

> **Theorem 3 (Shamir [3]).** $\text{TQBF} \in \mathbf{IP}$; hence $\mathbf{PSPACE} \subseteq \mathbf{IP}$.

The converse is the easy direction:

> **Theorem 4.** $\mathbf{IP} \subseteq \mathbf{PSPACE}$.

*Sketch.* The optimal acceptance probability of a polynomial-round protocol is computed by a depth-first traversal of the game tree — maximizing at prover nodes, averaging at verifier nodes — using only polynomial space. Accept iff it exceeds $1/2$. ∎

Together: **IP = PSPACE**. Note the asymmetry — the hard direction required inventing an algebraic language; the easy direction is generic game-tree evaluation.

### 4.4 The GKR protocol for layered circuits

Goldwasser, Kalai, and Rothblum extended sum-check from a single sum to an entire arithmetic circuit [4]. For a layered circuit $C$ of depth $d$ and width $S = 2^s$, let $\tilde V_i$ be the multilinear extension of layer-$i$ gate values, and $\widetilde{\text{add}}_i, \widetilde{\text{mult}}_i$ those of the wiring predicates. Adjacent layers satisfy

$$\tilde V_i(z) = \sum_{\omega_1,\omega_2 \in \{0,1\}^s} \Big[ \widetilde{\text{add}}_i(z,\omega_1,\omega_2)(\tilde V_{i-1}(\omega_1)+\tilde V_{i-1}(\omega_2)) + \widetilde{\text{mult}}_i(z,\omega_1,\omega_2)\tilde V_{i-1}(\omega_1)\tilde V_{i-1}(\omega_2) \Big],$$

a hypercube sum of a low-degree polynomial — exactly what sum-check verifies. GKR iterates: reduce a claim about $\tilde V_i$ to claims about $\tilde V_{i-1}$ via sum-check, merge them with a random linear combination, and descend; at layer $0$ the verifier evaluates the input extension directly. Costs: communication $O(d \log S)$, verifier $O(n + d \log S)$, prover $O(S d)$ — the *doubly-efficient* regime.

### 4.5 The Fiat–Shamir heuristic: removing interaction

The Fiat–Shamir transform [7] compiles any public-coin interactive proof into a non-interactive argument in the random oracle model by replacing each verifier challenge with $r_i = H(\text{transcript so far})$ for a hash function $H$. The prover generates the whole proof offline; the verifier recomputes the challenges. Soundness becomes computational.

> **Caution.** Fiat–Shamir is a heuristic: Goldwasser and Kalai exhibited contrived protocols where it fails for *every* concrete hash function, though it is secure in the random oracle model and ubiquitous in practice — it is the step turning GKR-style proofs into deployed SNARKs [7].

---

## 5 Empirical Results and Proofs

### 5.1 The doubly-efficient paradigm

Goldwasser, Kalai, and Rothblum's "Delegating Computation: Interactive Proofs for Muggles" (STOC 2008) reframed the field [4]. Classical **IP = PSPACE** assumes an *unbounded* prover — useless for delegation, where the server is powerful but finite and the client wants to save work. Doubly-efficient proofs demand: an honest prover in $\text{poly}(S)$ time (ideally quasilinear in circuit size $S$), a verifier in $o(S)$ time (ideally $O(n \log S)$), and $\text{polylog}(S)$ communication. GKR meets these bounds for logspace-uniform circuits, and Thaler's refinements brought the prover's concrete cost to a small constant multiple of plain evaluation [6].

### 5.2 From interactive proofs to SNARKs

The lineage is unbroken: **sum-check** [2] gives the core sub-protocol; **GKR** [4] iterates it across circuit layers; **Fiat–Shamir** [7] removes interaction; **polynomial commitments** (e.g., KZG) make the final evaluation claims checkable without the full input. This is precisely the architecture of modern SNARKs — an interactive oracle proof descended from sum-check, compiled with a commitment scheme and Fiat–Shamir into a succinct non-interactive argument [6].

### 5.3 Soundness accounting

With $|\mathbb{F}| \approx 2^{128}$ (e.g., the BLS12-381 scalar field), the information-theoretic soundness errors below are under $2^{-100}$ for all practical sizes — negligible without repetition:

| Protocol | Claim | Soundness error | Communication | Verifier time |
|----------|-------|-----------------|---------------|---------------|
| Sum-check ($\ell$ vars, deg $d$) | $\sum_b g(b) = H$ | $\leq \ell d / \|\mathbb{F}\|$ | $O(\ell d)$ | $O(\ell d) + \mathrm{eval}(g)$ |
| Shamir TQBF ($n$ vars) | $\Psi$ true | $\leq \mathrm{poly}(n)/\|\mathbb{F}\|$ | $O(n\cdot\mathrm{poly}(n))$ | $\mathrm{poly}(n)$ |
| GKR (depth $d$, size $S$) | $C(x) = y$ | $\leq O(d \log S)/\|\mathbb{F}\|$ | $O(d \log S)$ | $O(n + d \log S)$ |

### 5.4 What the experiments showed

The 2011 implementation of Cormode, Thaler, and Mitzenmacher [5] was the landmark empirical validation: for circuits computing streaming statistics, the GKR prover ran within a small constant factor of plain evaluation — the first proof that a general-purpose interactive proof could be *implemented*, not merely analyzed. The verifier's work scaled near-linearly in the input plus polylogarithmically in the circuit size, confirming verification is strictly cheaper than re-execution; and the same line of work showed *sublinear-space* verifiers, who cannot even store the input, can audit outsourced streaming computations. These results catalyzed the verifiable-computation industry: every zk-rollup inherits its security argument from the sum-check soundness lemma of Section 4.1.

---

## 6 Limitations and Open Problems

**The unbounded prover.** Classical **IP** permits the honest prover to be arbitrarily powerful, which makes **IP = PSPACE** a statement about *expressive power* rather than *practical delegation*. Doubly-efficient protocols repair this, but only for restricted circuit classes (logspace-uniform, low-depth). *Open:* doubly-efficient interactive proofs with quasilinear provers for *arbitrary* polynomial-size circuits remain elusive without cryptographic assumptions.

**Non-relativization and barriers.** **IP = PSPACE** does not relativize: there exist oracles relative to which the equality fails. This was historically significant — it showed that the relativization barrier, once thought to block progress on **P** vs **NP**, could be circumvented by *algebraic* techniques. But the algebrization barrier of Aaronson and Wigderson shows that even arithmetization-based methods cannot resolve **P** vs **NP** alone. *Open:* identify the precise algebraic power needed to separate **P** from **NP**.

**Fiat–Shamir soundness.** The transform from interaction to non-interaction rests on the random oracle model, and Goldwasser–Kalai counterexamples show it can fail for contrived protocols [7]. While no practical attack exists against Fiat–Shamir applied to sum-check-based protocols over suitable fields, a *standard-model* proof of soundness for the transform as used in deployed SNARKs is a major open problem — one of the central questions in the foundations of succinct arguments.

**Quantum adversaries.** All soundness analyses here are classical. Quantum interactive proofs satisfy **QIP = PSPACE** as well, but the Fiat–Shamir transform's security against quantum attackers (in the quantum random oracle model) is only partially understood, and post-quantum polynomial commitments remain an active research area. *Open:* a fully post-quantum doubly-efficient proof system with transparent setup and quasilinear proving.

**Prover concreteness.** Even the best GKR implementations impose prover overhead of 10–100× over plain evaluation for general circuits, and memory consumption scales with circuit size. Special-purpose protocols (for matrix multiplication, streaming statistics, regular languages) do far better. *Open:* close the gap between special-purpose and general-purpose prover efficiency, or characterize which computations admit near-optimal provers.

**Zero knowledge.** This thesis treats *plain* interactive proofs. Adding zero knowledge (the prover reveals nothing beyond validity) is possible for all of **IP** under standard assumptions, and is essential for privacy applications — but it multiplies prover cost and complicates the protocol design. The interaction of zero knowledge with double efficiency is surveyed in [6].

---

## 7 Conclusion

The interactive proof model began as a philosophical provocation — *what if a proof is a conversation?* — and ended as the foundation of verifiable computation. The technical arc of this thesis is worth restating in full:

1. **Arithmetization** translates logic into algebra, replacing boolean connectives with polynomial operations and quantifiers with sums and products.
2. The **sum-check protocol** verifies hypercube sums with logarithmic communication, its soundness resting on the single most-used lemma in the field: a nonzero low-degree polynomial has few roots.
3. **Shamir's theorem** extends the technique past the degree barrier via degree-reduction operators, proving **TQBF ∈ IP** and hence **IP = PSPACE** — interaction plus randomness equals polynomial space.
4. The **GKR protocol** iterates sum-check across circuit layers, yielding *doubly-efficient* proofs with quasilinear provers and near-linear verifiers.
5. **Fiat–Shamir** and polynomial commitments compile these interactive proofs into the **SNARKs** that secure billions of dollars of computation today.

The deepest lesson is methodological. Complexity theory in the 1980s was dominated by combinatorial arguments about Turing machines; the **IP = PSPACE** breakthrough showed that *algebra* — polynomials, fields, random evaluation — could succeed where combinatorics stalled. That lesson has compounded for three decades: every efficient proof system in use today, from STARKs to zkEVMs, is an elaboration of the idea that low-degree polynomials are locally checkable, globally rigid objects. Randomization did not weaken the notion of proof. It revealed what proofs were capable of all along.

---

## References

[1] Shafi Goldwasser, Silvio Micali, and Charles Rackoff — The Knowledge Complexity of Interactive Proof-Systems, STOC 1985 / SIAM Journal on Computing 1989. https://en.wikipedia.org/wiki/Interactive_proof_system
[2] Carsten Lund, Lance Fortnow, Howard Karloff, and Noam Nisan — Algebraic Methods for Interactive Proof Systems, Journal of the ACM 39(4): 859–868, 1992. http://www.cs.cornell.edu/courses/cs6810/2009sp/scribe/lecture1516.pdf
[3] Adi Shamir — IP = PSPACE, Journal of the ACM 39(4): 869–877, 1992; step-by-step exposition of the proof. https://lsv.ens-paris-saclay.fr/~goubault/Complexite/shamir-step-by-step_compressed.pdf
[4] Shafi Goldwasser, Yael Tauman Kalai, and Guy N. Rothblum — Delegating Computation: Interactive Proofs for Muggles, STOC 2008. https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/2008-DelegatingComputation.pdf
[6] Justin Thaler — Proofs, Arguments, and Zero-Knowledge, Foundations and Trends in Privacy and Security, Now Publishers, 2022. http://people.cs.georgetown.edu/jthaler/ProofsArgsAndZK.html
[5] Graham Cormode, Michael Mitzenmacher, and Justin Thaler — Practical Verified Computation with Streaming Interactive Proofs, arXiv 2011. http://arxiv.org/abs/1105.2003v1
[7] Amos Fiat and Adi Shamir — How to Prove Yourself: Practical Solutions to Identification and Signature Problems, CRYPTO 1986 (Fiat–Shamir transform; on its limitations see Goldwasser–Kalai, FOCS 2003). https://iacr.org/archive/crypto2020/12171158/12171158.pdf
