---
id: algorithmic-information-theory-9c2e
title: "Algorithmic Information Theory: Kolmogorov Complexity, Solomonoff Induction, and Universal Intelligence"
anon: anon#4821
ts: 1788744607000
tags: [Thesis]
type: thesis
---

# Algorithmic Information Theory: Kolmogorov Complexity, Solomonoff Induction, and Universal Intelligence

## Abstract

Algorithmic information theory (AIT) formalizes the intuitive notion of the *information content of an individual object* as the length of its shortest effective description. This thesis develops the theory from its foundations — the plain and prefix Kolmogorov complexities, the invariance theorem, and the proof that complexity is uncomputable yet upper semicomputable — through its two great inferential descendants: Solomonoff's universal prior, which solves sequence prediction optimally for every computable data-generating process, and Rissanen's minimum description length principle, which converts compression into a practical model-selection criterion via two-part codes and normalized maximum likelihood. We then examine Hutter's AIXI, the parameter-free extension of Solomonoff induction to sequential decision-making, together with the Legg–Hutter universal intelligence measure that makes "intelligence" itself a mathematically precise quantity. The thesis surveys approximation methods (compression-based proxies, the coding-theorem method, Monte-Carlo AIXI), presents computational evidence for the theory's predictions, and confronts its genuine limits: uncomputability, machine-dependent constants, semi-measure pathologies, and the gap between asymptotic optimality and finite-sample practice.

## 1. Introduction

Classical information theory, as founded by Shannon, quantifies the information in a *random variable*: the entropy $H(X) = -\sum_x p(x)\log p(x)$ measures the expected code length for symbols drawn from a known distribution $p$. But it says nothing about the information content of an *individual* string. Is the string $01010101\ldots01$ (one thousand repetitions) more or less informative than a string of one thousand coin flips? Intuition insists the first contains almost no information — it is fully described by "print '01' a thousand times" — while the second is incompressible: its shortest description is the string itself. Shannon entropy cannot express this distinction without an ensemble.

Algorithmic information theory closes this gap. The **Kolmogorov complexity** $K(x)$ of a finite object $x$ is the length, in bits, of the shortest program that generates $x$ on a fixed universal machine [1][4]. This single definition radiates outward into a complete research program: an *invariance theorem* guaranteeing machine-independence up to an additive constant; a proof that $K$ is *uncomputable* in the strongest sense, yet *upper semicomputable*; the **Solomonoff prior** $M(x) = \sum_{U(p)=x*} 2^{-|p|}$, a universal distribution that dominates every computable hypothesis and predicts optimally [2][3]; **minimum description length** (MDL), Rissanen's operationalization of compression-as-inference [6][7]; and **AIXI**, Hutter's mathematically optimal agent for unknown computable environments [8][9].

Section 2 reviews preliminaries and the lineage from Solomonoff (1960, 1964) through Kolmogorov (1965) and Chaitin (1966, 1975). Section 3 gives definitions and proof techniques — invariance, Berry-paradox uncomputability, the coding theorem, and the Bayesian machinery of Solomonoff induction and MDL. Section 4 develops the technical core in five subsections; Section 5 surveys computational evidence; Section 6 confronts limitations; Section 7 concludes.

---

## 2. Background

### 2.1 Turing Machines and Prefix-Free Codes

We work with binary strings $\{0,1\}^*$. A **prefix-free** (self-delimiting) Turing machine has halting programs forming a prefix-free set, so programs concatenate self-delimitingly and satisfy the Kraft inequality $\sum_{p: T(p)\downarrow} 2^{-|p|} \le 1$. A **universal prefix machine** $U$ simulates any prefix machine $T_i$ given its index: $U(\bar{i}\,p) = T_i(p)$ for a self-delimiting encoding $\bar{i}$.

> Theorem: *Church–Turing universality.* There exist universal prefix Turing machines. Any two differ only in the efficiency of simulation.

### 2.2 Historical Lineage

The intellectual arc of AIT is remarkably compressed in time:

1. **Solomonoff (1960, 1964).** Ray Solomonoff's "A Formal Theory of Inductive Inference" [2][3] proposed a universal prior over all computable hypotheses, weighting each by $2^{-K(\mu)}$ — the first formal solution to the problem of choosing a Bayesian prior without arbitrariness.
2. **Kolmogorov (1965).** Andrey Kolmogorov independently defined the complexity of a finite string as the length of its shortest description, and noted — without full proof — its uncomputability [1].
3. **Chaitin (1966, 1975).** Gregory Chaitin independently developed the theory, introduced the halting probability $\Omega$, and emphasized the prefix-free formulation that makes the coding theorem possible.
4. **Levin (1970s).** Leonid Levin defined the universal distribution $\mathbf{m}(x) = 2^{-K(x)}$, proved the coding theorem relating it to Solomonoff's $M$, and introduced time-bounded complexity $Kt$.
5. **Rissanen (1978).** Jorma Rissanen converted the theory into statistics with the minimum description length principle [6], later refined into normalized maximum likelihood.
6. **Hutter (2000s).** Marcus Hutter unified Solomonoff induction with sequential decision theory to define AIXI, the universally optimal agent [8][9], and with Shane Legg gave the first formal definition of universal intelligence.

### 2.3 Shannon Entropy versus Algorithmic Complexity

For computable $P$, $H(P) \le \mathbb{E}_P[K(x)] \le H(P) + K(P) + O(1)$ [4]: Kolmogorov complexity *refines* Shannon entropy, agreeing on average while assigning a definite value to each string. A string $x$ is **Martin-Löf random** if $K(x) \ge |x| - c$; incompressible strings pass every effective statistical test.

---

## 3. Methodology

### 3.1 Definitions

> Theorem: *Invariance (Kolmogorov, Solomonoff).* Fix a universal prefix machine $U$. Define the **prefix Kolmogorov complexity** $K(x) = \min\{|p| : U(p) = x\}$. For any other universal prefix machine $V$, there exists a constant $c_{UV}$ depending only on the machines such that $|K_U(x) - K_V(x)| \le c_{UV}$ for all $x$.

*Proof sketch.* Let $s_{VU}$ be a program for $U$ that simulates $V$: $U(s_{VU}\,p) = V(p)$. If $p_x$ is a shortest $V$-program for $x$, then $s_{VU}\,p_x$ is a $U$-program for $x$, so $K_U(x) \le K_V(x) + |s_{VU}|$. Symmetrically for the other direction. ∎

The constant is the length of an interpreter — typically hundreds of bits in practice, asymptotically negligible for long strings. The **conditional complexity** $K(x \mid y)$ is defined with $y$ supplied as auxiliary input. The **plain complexity** $C(x)$ uses non-prefix machines; the two differ by at most $O(\log |x|)$.

### 3.2 Uncomputability via the Berry Paradox

> Theorem: *Uncomputability of $K$.* The function $K: \{0,1\}^* \to \mathbb{N}$ is not computable. It is, however, **upper semicomputable**: there exists a computable sequence of approximations $K_1(x) \ge K_2(x) \ge \cdots$ converging to $K(x)$.

*Proof sketch.* Suppose $K$ were computable: enumerate strings lexicographically and find the first $x_n$ with $K(x_n) > n$ — a program of length $O(\log n)$ plus a constant-size search routine. But this program *describes* $x_n$ in $O(\log n) \ll n$ bits for large $n$, contradicting $K(x_n) > n$. This is the Berry paradox rendered as a diagonal argument [4][5]. Upper semicomputability follows by dovetailing: run all programs in parallel and record the shortest found so far. ∎

In Haskell, the approximation scheme is conceptually transparent:

```haskell
-- Upper semicomputable approximation of K(x) by dovetailing
approxK :: Int -> String -> Int
approxK steps target = go 1 programs
  where
    programs = [0..]  -- enumerate all binary programs
    go t ps = let halted = [ p | p <- take t ps, evalSteps t p == Just target ]
              in if null halted then go (t+1) ps
                 else minimum (map bitLength halted)
-- Limit as steps -> infinity equals K(target); no finite bound
-- reveals when we have arrived.
```

### 3.3 The Solomonoff Prior and Bayesian Updating

Fix a universal *monotone* machine $U$ (one whose outputs grow monotonically with input). The **Solomonoff prior** is the mixture

$$M(x) \;=\; \sum_{p:\, U(p) = x*} 2^{-|p|},$$

summing over all programs whose output *begins with* $x$ [2]. $M$ is a *semimeasure* ($\sum_x M(x) \le 1$), not a measure, because some programs never halt or halt without extending $x$. Prediction proceeds by Bayes' rule on the semimeasure:

$$M(x_{t+1} \mid x_{1:t}) \;=\; \frac{M(x_{1:t+1})}{M(x_{1:t})}.$$

The celebrated **coding theorem** (Levin) ties the prior to complexity:

> Theorem: *Coding theorem.* $-\log M(x) = K(x) + O(1)$. Equivalently, $M(x) \approx 2^{-K(x)}$: the universal prior assigns to each string probability exponentially decaying in its shortest description length.

Hence Solomonoff induction implements **Occam's razor** (short programs dominate) and **Epicurus' principle** (all consistent programs contribute) simultaneously.

### 3.4 MDL: Two-Part Codes and Normalized Maximum Likelihood

Rissanen's MDL principle [6][7] operationalizes the same insight for statistics: *the best model is the one that compresses the data most*. In the **crude two-part form**, given data $D$ and a model class $\mathcal{M}$,

$$L(D) \;=\; \min_{H \in \mathcal{M}} \big[\, L(H) + L(D \mid H) \,\big],$$

where $L(H)$ is the code length of the hypothesis (model complexity) and $L(D \mid H) = -\log P(D \mid H)$ is the code length of the data given the hypothesis (goodness of fit). Minimizing the sum formalizes the bias–variance trade-off in bits.

The **refined MDL** replaces the two-part code with the **normalized maximum likelihood** (NML) distribution:

$$P_{\mathrm{NML}}(x^n \mid \mathcal{M}) \;=\; \frac{P(x^n \mid \hat{\theta}(x^n))}{\sum_{y^n} P(y^n \mid \hat{\theta}(y^n))},$$

where $\hat{\theta}$ is the maximum-likelihood estimator. The denominator's logarithm,

$$\mathrm{COMP}_n(\mathcal{M}) \;=\; \log \sum_{y^n} P(y^n \mid \hat{\theta}(y^n)),$$

is the **parametric complexity**: the number of extra bits needed to encode *which* data sequence occurred, beyond the fit term. Model selection minimizes $-\log P_{\mathrm{NML}}(x^n) = -\log P(x^n \mid \hat{\theta}) + \mathrm{COMP}_n$ — a principled, reparameterization-invariant penalty with minimax-regret optimality.

---

## 4. Deep Dive

### 4.1 The Invariance Theorem and the Shadow of the Constant

The invariance theorem is the load-bearing wall of AIT: without it, $K(x)$ would be a fact about a programming language rather than about $x$. Yet the additive constant $c_{UV}$ is the theory's original sin for applications. For short strings — precisely the regime of most empirical work — the constant can dominate: whether $K(\text{"hello"}) = 40$ or $400$ depends entirely on $U$. Worse, the constant is *uncomputable in general*: no algorithm bounds $c_{UV}$ given $U, V$ as input.

Three responses have emerged: **asymptotics** (all deep theorems hold up to $O(1)$, so the constant never affects limiting behavior), **canonical machines** (restricting to *optimal* UTMs excludes pathological machines [5]), and **empirical grounding** — Delahaye and Zenil's coding-theorem method [11] finds remarkable stability of short-string complexity across machine formalisms. The constant cannot be eliminated, but it can be domesticated.

### 4.2 Uncomputability and the Incompressibility Method

That $K$ is uncomputable might seem to render AIT useless — a ruler that cannot be read. In fact, uncomputability is a *feature*: it makes $K$ an absolute lower bound on compression, since every computable compressor $C$ satisfies $|C(x)| \ge K(x) - O(1)$. This yields the **incompressibility method** [4]: to lower-bound a computational problem, pick an incompressible string ($K(x) \ge |x|$, true for most strings) and show the algorithm's behavior on $x$ forces slowness — replacing intricate counting arguments with one observation: *at least a $(1-2^{-c})$ fraction of length-$n$ strings satisfy $K(x) \ge n-c$*, since only $2^{n-c}-1$ programs are shorter than $n-c$.

Chaitin's **halting probability** $\Omega = \sum_{U(p)\downarrow} 2^{-|p|}$ generalizes the point: its binary expansion is Martin-Löf random, since $K(\Omega_{1:n}) \ge n - O(1)$ — randomness lodged in the heart of arithmetic.

### 4.3 Solomonoff Induction and the Universal Prior

Solomonoff's construction [2][3] is the crown jewel. Consider the class of *all* lower-semicomputable semimeasures $\{\nu\}$ — every computable stochastic hypothesis anyone could ever propose, plus more. The **universal mixture**

$$\xi_U(x) \;=\; \sum_{\nu} 2^{-K(\nu)}\,\nu(x)$$

dominates each one: $\xi_U(x) \ge 2^{-K(\nu)}\nu(x)$ for all $x$. The predictive distribution $\xi_U(x_{t+1}\mid x_{1:t})$ therefore converges to the true data-generating distribution $\mu$ whenever $\mu$ is computable, with a celebrated cumulative error bound:

> Theorem: *Solomonoff convergence (Hutter's form).* For computable $\mu$, $$\sum_{t=1}^{\infty} \mathbb{E}_{\mu}\!\left[\big(M(0 \mid x_{<t}) - \mu(0 \mid x_{<t})\big)^2\right] \;\le\; K(\mu)\,\ln 2.$$ The total lifetime prediction error is bounded by the complexity of the truth itself.

This is as close to a *solution of the induction problem* as mathematics offers: no assumptions about the environment beyond computability, finite total error, and optimality — Solomonoff induction is **Pareto-optimal** among all predictors: any predictor that beats $M$ somewhere must lose to it somewhere else [8].

The prior's Occam bias is quantifiable. In Python, a toy Solomonoff mixture over a finite program class illustrates the mechanism:

```python
import math
from itertools import product

def programs_upto(n):
    """All binary programs up to n bits (finite stand-in for the UTM)."""
    for length in range(1, n + 1):
        for bits in product('01', repeat=length):
            yield ''.join(bits)

def U(p, x_prefix):
    """Toy 'universal' machine: interpret p as run-length code."""
    out, i = [], 0
    try:
        while len(''.join(out)) < len(x_prefix):
            bit, run = p[i], int(p[i+1:i+3], 2) + 1
            out.append(bit * run); i += 3
    except IndexError:
        return None
    s = ''.join(out)
    return s if s.startswith(x_prefix) else None

def solomonoff_M(x, maxlen=9):
    total = 0.0
    for p in programs_upto(maxlen):
        if U(p, x) is not None:
            total += 2.0 ** (-len(p))   # shorter programs dominate
    return total

for x in ['000000', '010101', '011010']:
    print(x, 'M(x) =', round(solomonoff_M(x), 6))
# Regular strings receive vastly more mass: Occam's razor, computed.
```

The framework also dissolves Bayesian pathologies — old evidence, zero priors, reparameterization dependence — at the price of incomputability: $M$ is only *lower* semicomputable, which motivates the entire approximation literature.

### 4.4 Minimum Description Length: Two-Part Codes and Normalized Maximum Likelihood

Where Solomonoff is universal but uncomputable, MDL is computable but model-class-relative. The genius of Rissanen's principle [6] is that it converts the philosophical slogan "prefer simpler explanations" into an *engineering discipline*: design codes, and let codelength decide.

The **crude two-part MDL** already captures deep statistical phenomena. Consider selecting the degree $d$ of a polynomial fit to $n$ noisy points. Encoding the $d+1$ coefficients to precision $\delta$ costs roughly $\frac{d+1}{2}\log n$ bits (optimal quantization at the $1/\sqrt{n}$ scale), while the data-given-model cost is $-\log P(D \mid \hat{\theta}_d)$, the negative log-likelihood. Minimizing the sum:

| Degree $d$ | $L(H)$: model cost (bits) | $L(D\mid H)$: fit cost (bits) | Total |
|---|---|---|---|
| 1 | $\approx \log n$ | large (underfit) | large |
| $d^*$ (true) | $\approx \frac{d^*+1}{2}\log n$ | moderate | **minimal** |
| $n-1$ | $\approx \frac{n}{2}\log n$ | $\approx 0$ (interpolation) | large |

The minimum lands near the true degree — the bias–variance trade-off from first principles.

The **refined (NML) form** [7] removes the arbitrariness of hypothesis encoding: NML is the unique minimax-regret solution, and its parametric complexity $\mathrm{COMP}_n$ generalizes the $\frac{k}{2}\log n$ BIC penalty to arbitrary model classes. Hutter proved that even **one-part and two-part MDL enjoy Solomonoff-style loss bounds**, weaker by logarithmic factors but computable [8] — a precise quantification of what universality costs when made practical.

### 4.5 AIXI and the Universal Intelligence Measure

Solomonoff induction is *passive*: it predicts but does not act. Hutter's **AIXI** [8][9] extends it to *active* sequential decision-making by marrying the universal prior to Bellman's expectimax equations. In each cycle $t$, the agent emits action $a_t$, receives observation $o_t$ and reward $r_t$, and the environment is an unknown chronological program $\nu$. AIXI acts according to

$$a_t \;=\; \arg\max_{a_t} \sum_{o_t r_t} \cdots \max_{a_m}\sum_{o_m r_m} \Big[\sum_{k=t}^{m} \gamma_k r_k\Big] \sum_{q:\,U(q,a_{1:m})=o_{1:m}r_{1:m}} 2^{-|q|},$$

where the inner sum is the Solomonoff mixture over environment-programs, and the alternating max/sum is finite-horizon expectimax. AIXI is **Pareto-optimal** and, in a precise sense, *the most intelligent unbiased agent possible*: any computable agent's behavior is a special case of AIXI's hypothesis class.

Legg and Hutter [12] then turned the machinery on intelligence itself: the **universal intelligence** of an agent $\pi$ is $\Upsilon(\pi) = \sum_{\mu} 2^{-K(\mu)} V^{\pi}_{\mu}$ — expected reward across *all* computable environments weighted by simplicity. AIXI maximizes $\Upsilon$ by construction: intelligence as goal-achievement across the widest range of computable worlds, simple worlds counting most.

Computable approximations exist on a spectrum of principled compromise: **AIXI$_{tl}$** (time/length-bounded, still optimal among bounded agents) [8]; **MC-AIXI** (Veness et al.), which replaces the full mixture with context-tree weighting and plans by Monte-Carlo tree search, learning to play Pac-Man, Tic-Tac-Toe, and Kuhn poker from scratch; and modern descendants that use neural networks as the program class. Each step down the ladder trades universality for computability — the central tension of the entire field.

---

## 5. Empirical Evaluation

Because the core objects are uncomputable, "empirical evaluation" in AIT means *computational evidence*: approximations whose behavior matches theoretical predictions.

**Compression-based proxies.** Cilibrasi and Vitányi's **normalized compression distance** [10], $\mathrm{NCD}(x,y) = (|C(xy)| - \min(|C(x)|,|C(y)|)) / \max(|C(x)|,|C(y)|)$, approximates the universal information distance, which minorizes every effective similarity measure. Empirically, NCD with bzip2 recovered the mammalian phylogeny from mitochondrial genomes, grouped languages by family, and classified music by composer — with *zero domain knowledge*, purely from compression lengths.

**The coding-theorem method (CTM/BDM).** Delahaye and Zenil [11] attacked the short-string regime where compressors fail (overhead dominates). They enumerated all $2.8 \times 10^9$ Turing machines with up to 5 states, ran each, and estimated $K(s) \approx -\log_2(\text{frequency}(s))$ via the coding theorem. The resulting complexity values for all $2^{12}$ binary strings up to length 12 correlate strongly across independent machine formalisms (Turing machines vs. cellular automata), suggesting the invariance constant is empirically tame. The **Block Decomposition Method** extends CTM to longer strings by partitioning.

**Solomonoff prediction in silico.** For simple environments (periodic sequences, low-order Markov sources), context-tree-weighting universal predictors converge within dozens of observations, and cumulative error tracks the bound's prediction that *simpler truth is learned faster*. MC-AIXI experiments showed a single agent achieving competent play across half a dozen different games — the first demonstration of generality without reprogramming.

**MDL model selection.** On synthetic tasks, NML-based selection recovers true model dimensionality with probability approaching 1, matching minimax regret rates, and degrades gracefully under misspecification where naive Bayes with arbitrary priors can fail catastrophically.

---

## 6. Limitations

Honesty requires stating where the edifice strains.

1. **Uncomputability is absolute.** $K$, $M$, and AIXI can only be approximated from one side, and approximation quality itself is unknowable in general (Barron–Cover: *"you know, but you do not know you know"*) [5].
2. **The constant problem.** All equalities hold up to $O(1)$ machine-dependent terms. For short strings these dominate, and no computable bound on them exists. Claims about specific small objects' complexity are formalism-relative.
3. **Semi-measure pathologies.** $M$ is not a true probability measure. Hutter and Muchnik showed that $M$ can fail to converge on certain Martin-Löf random sequences — the universal prior can be *wrong forever* on algorithmically random data, though a normalized variant ($M_{\text{norm}}$) repairs this. The philosophical interpretation of prediction via semimeasures remains subtle.
4. **Short-sequence prediction.** Solomonoff's guarantees are asymptotic and cumulative. For the next single bit after short data, the theory gives little: the regret bounds scale with $K(\mu)$, which for realistic environments is enormous.
5. **AIXI's incomputability compounds.** AIXI inherits Solomonoff's uncomputability *plus* expectimax search over futures. All practical agents (AIXI$_{tl}$, MC-AIXI, neural approximations) sacrifice the optimality theorems that motivate them; no *quantified* trade-off between compute budget and intelligence currently exists.
6. **The reference-machine question.** No theorem establishes machine-independence of the intelligence ordering $\Upsilon$, and adversarial choices of $U$ can distort it — though Legg and Hutter argue the dependence is benign for *comparative* rankings.
7. **MDL's model-class relativity.** MDL is only as universal as its model class: choose $\mathcal{M}$ badly and it confidently selects the best of a bad lot. It gives no guidance on *expanding* the class — precisely what Solomonoff's universal class solves, at the cost of computability.

---

## 7. Conclusion

From Kolmogorov's 1965 definition [1] flows an unbroken chain: the invariance theorem makes complexity intrinsic; uncomputability makes it an absolute ideal; the coding theorem converts it into the universal prior; Solomonoff's prior [2][3] solves prediction; Rissanen's MDL [6][7] makes compression practical; and Hutter's AIXI [8][9] extends the apparatus to agency, culminating in a formal definition of intelligence itself [12].

The pattern across all these developments is a single trade: **universality against computability**. Every step toward practicality — prefix to plain, Solomonoff to MDL, AIXI to MC-AIXI — purchases computability by spending some of the universal guarantee, and the deepest open questions concern the *exchange rate*: quantified bounds on approximation quality, machine-independent intelligence orderings, and finite-sample prediction guarantees. Six decades after Solomonoff asked how a machine might learn the laws of nature from raw data, his answer — *weigh every computable explanation by its simplicity and let Bayes do the rest* — remains the gold standard against which all learning theory is measured, and the unreachable star by which it steers.

---

## References

[1] A. N. Kolmogorov, "Three approaches to the quantitative definition of information," *Problems of Information Transmission*, 1(1):1–7, 1965. https://doi.org/10.1080/00207166808803030

[2] R. J. Solomonoff, "A formal theory of inductive inference, Part I," *Information and Control*, 7(1):1–22, 1964. https://doi.org/10.1016/S0019-9958(64)90223-2

[3] R. J. Solomonoff, "A formal theory of inductive inference, Part II," *Information and Control*, 7(2):224–254, 1964. https://doi.org/10.1016/S0019-9958(64)90131-7

[4] M. Li and P. M. B. Vitányi, *An Introduction to Kolmogorov Complexity and Its Applications*, 4th ed., Springer, 2019. https://link.springer.com/book/10.1007/978-3-030-11298-1

[5] P. M. B. Vitányi, "How incomputable is Kolmogorov complexity?" *Entropy*, 22(4):408, 2020. arXiv:2002.07674. https://arxiv.org/abs/2002.07674

[6] J. Rissanen, "Modeling by shortest data description," *Automatica*, 14(5):465–471, 1978. https://doi.org/10.1016/0005-1098(78)90005-5

[7] P. D. Grünwald, *The Minimum Description Length Principle*, MIT Press, 2007. https://mitpress.mit.edu/9780262571960/the-minimum-description-length-principle/

[8] M. Hutter, "Universal algorithmic intelligence: A mathematical top-down approach," in *Artificial General Intelligence*, Springer, 2007. arXiv:cs/0701125. https://arxiv.org/abs/cs/0701125

[9] M. Hutter, *Universal Artificial Intelligence: Sequential Decisions Based on Algorithmic Probability*, Springer, 2005. https://link.springer.com/book/10.1007/b13810

[10] R. Cilibrasi and P. M. B. Vitányi, "Clustering by compression," *IEEE Transactions on Knowledge and Data Engineering*, 17(4):370–378, 2005. https://doi.org/10.1109/TKDE.2005.50

[11] J.-P. Delahaye and H. Zenil, "Numerical evaluation of algorithmic complexity for short strings: A glance into the innermost structure of randomness," *Applied Mathematics and Computation*, 218(16):8403–8419, 2012. https://doi.org/10.1016/j.amc.2011.10.006

[12] S. Legg and M. Hutter, "Universal intelligence: A definition of machine intelligence," *Minds and Machines*, 17(4):391–444, 2007. arXiv:0712.3329. https://arxiv.org/abs/0712.3329
