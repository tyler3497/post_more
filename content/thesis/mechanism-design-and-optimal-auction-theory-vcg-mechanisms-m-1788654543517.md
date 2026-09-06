---
title: "Mechanism Design and Optimal Auction Theory: VCG Mechanisms, Myerson's Lemma, Revenue Equivalence, and Incentive-Compatible Spectrum Auctions"
id: ths_1788654543517_3368
anon: anon#K2X9
ts: 1788654543517
type: thesis
images: ["ths_1788654543517_3368-0.webp", "ths_1788654543517_3368-1.webp", "ths_1788654543517_3368-2.webp", "ths_1788654543517_3368-3.webp"]
---

# Mechanism Design and Optimal Auction Theory: VCG Mechanisms, Myerson's Lemma, Revenue Equivalence, and Incentive-Compatible Spectrum Auctions

## Abstract

Auction theory underpins search-engine keyword markets and government spectrum sales worth hundreds of billions of dollars. This thesis develops single-parameter mechanism design from first principles: the revelation principle justifies restricting attention to direct truthful mechanisms, and the envelope theorem yields Myerson's lemma — the payment identity characterizing all Bayesian incentive-compatible mechanisms. We prove truthfulness of the second-price auction and its generalization, the Vickrey–Clarke–Groves pivot mechanism, which prices each agent by the externality she imposes on others. We derive Myerson's theorem reducing revenue maximization to expected *virtual-surplus* maximization, with optimal reserves where virtual values cross zero, and state and prove the Revenue Equivalence Theorem with its key failures (risk aversion, asymmetry, budgets, affiliation). Finally, we apply the theory to sponsored search — contrasting the non-truthful Generalized Second Price format, whose envy-free equilibria mimic VCG, with truthful alternatives — and to FCC spectrum auctions, from the simultaneous multiple-round format through combinatorial clock and incentive auctions, documenting shill bidding, collusion, and revenue non-monotonicity.

## 1. Introduction

The design of economic institutions — the *rules of the game* rather than the strategies played within fixed rules — is the subject of **mechanism design**, often described as *reverse game theory*. In classical game theory the analyst takes the rules as given and predicts behavior; in mechanism design the analyst takes the desired behavior as given and searches for rules that implement it. Leonid Hurwicz, Eric Maskin, and Roger Myerson were awarded the 2007 Nobel Memorial Prize in Economic Sciences "for having laid the foundations of mechanism design theory" [1], and in 2020 Paul Milgrom and Robert Wilson were recognized "for improvements to auction theory and inventions of new auction formats" [2], underscoring the field's unusual combination of mathematical depth and practical impact.

> **Definition (Auction).** An *auction* is a market institution in which the allocation of a scarce resource and the transfers of money among participants are determined as a function of the participants' bids, according to publicly announced rules.

Auctions are ubiquitous precisely because they solve the *asymmetric-information* problem: the seller does not know buyers' valuations, so it delegates price discovery to a competitive procedure. The canonical desiderata are:

1. **Efficiency:** the allocation maximizes total social welfare, $\sum_i v_i(x)$;
2. **Incentive compatibility:** truthful revelation of private information is an equilibrium;
3. **Individual rationality:** participation is voluntary, so interim utility is nonnegative;
4. **Revenue:** the seller's expected proceeds are as large as possible;
5. **Simplicity and robustness:** the format is implementable, collusion-resistant, and computationally tractable.

These objectives conflict. The celebrated results of auction theory map the frontier of this tradeoff space. This thesis develops four pillars of the theory:

- **The Vickrey–Clarke–Groves (VCG) mechanism** (Vickrey [3]; Clarke [4]; Groves [5]): the general construction that achieves dominant-strategy efficiency in private-values settings by charging each agent the externality she imposes on others.
- **Myerson's lemma and optimal auction design** (Myerson [6]): the payment-identity characterization of all Bayesian incentive-compatible mechanisms and the reduction of revenue maximization to *virtual-surplus* maximization.
- **The Revenue Equivalence Theorem** (Myerson [6]; Riley and Samuelson): the striking result that a large class of auction formats yield identical expected revenue.
- **Applied formats**: sponsored-search auctions (GSP vs. VCG) and spectrum auctions (SMR, combinatorial clock, incentive auctions), where the theory meets engineering constraints — and where the classical mechanisms' weaknesses motivate new designs.

The remainder of this thesis is organized as follows. Section 2 reviews the Bayesian game-theoretic background. Section 3 develops the methodology: direct mechanisms, the revelation principle, and the envelope characterization of incentives. Section 4 contains the deep dive: Vickrey and VCG, Myerson's optimal auction, revenue equivalence, sponsored search, and spectrum auctions. Section 5 supplies proofs and numerical evaluations. Section 6 discusses limitations. Section 7 concludes.

---

## 2. Background

### 2.1 Games of Incomplete Information

Auctions are modeled as games of incomplete information. Each bidder $i \in {1,\dots,n}$ has a private *type* $v_i$ (her valuation), drawn independently from a distribution $F_i$ with density $f_i$ on support $[\underline{v}_i, \bar{v}_i]$ — the **independent private values (IPV)** model [7]. A strategy maps types to bids, $b_i: [\underline{v}_i,\bar{v}_i] \to \mathbb{R}_+$, and the mechanism maps the bid profile to an allocation and payments.

Two solution concepts organize the analysis:

| Concept | Definition | Example |
|---|---|---|
| **Dominant strategy equilibrium** | $b_i$ is optimal for every profile of others' bids | Truth-telling in a second-price auction |
| **Bayes–Nash equilibrium (BNE)** | $b_i$ is optimal in expectation over others' types | Equilibrium bidding in a first-price auction |

Dominant-strategy incentive compatibility (DSIC) is the gold standard: it requires no beliefs about opponents and is robust to collusion among any subset of players. Bayesian incentive compatibility (BIC) is weaker but often the best attainable, as in revenue-optimal design.

### 2.2 The Four Canonical Formats

The classic sealed-bid and open formats are:

1. **English (ascending) auction:** price rises until one bidder remains; the winner pays the final price.
2. **Dutch (descending) auction:** price falls until a bidder accepts; the winner pays her acceptance price.
3. **First-price sealed-bid (FPSB):** highest bid wins, pays her own bid.
4. **Second-price sealed-bid (SPSB):** highest bid wins, pays the second-highest bid.

Under the IPV model, the Dutch auction is *strategically equivalent* to FPSB (in both, each bidder chooses a single price at which to claim the item), and the English auction is strategically equivalent to SPSB (in both, a bidder stays in until the price reaches her value, and pays the price at which the runner-up drops out) [8]. These equivalences are the first hint of the deeper unity the theory will reveal.

### 2.3 Private versus Common Values

The IPV model assumes a bidder's valuation depends only on her own information. In **common-values** settings (e.g., oil-tract leases, spectrum licenses valued for resale), all bidders value the same underlying object, and each bidder's signal informs everyone's value. Common values introduce the *winner's curse*: winning implies one's signal was the most optimistic, so rational bidders shade bids. Milgrom and Weber [9] developed the *affiliated-values* model generalizing both, and proved the *linkage principle*: public information revelation raises revenue. Much of this thesis operates in the private-values world, where VCG and Myerson's theory are exact; Section 6 discusses what breaks in common values.

---

## 3. Methodology

### 3.1 Direct Mechanisms and the Revelation Principle

A **direct mechanism** asks each agent to report her type $v_i$ and specifies an allocation rule $x_i(\mathbf{v}) \in [0,1]$ and payment rule $p_i(\mathbf{v}) \in \mathbb{R}$ as functions of the report profile. The mechanism is:

- **Dominant-strategy incentive compatible (DSIC)** if truthful reporting maximizes each agent's utility regardless of others' reports;
- **Bayesian incentive compatible (BIC)** if truthful reporting maximizes each agent's *expected* utility given others report truthfully;
- **Ex post individually rational (IR)** if no agent ever pays more than her realized value.

> **Theorem (Revelation Principle):** For any auction game and any equilibrium of it, there exists a direct mechanism with the same outcome function in which truthful reporting is an equilibrium.

The proof is constructive: compose the original game's outcome function with the equilibrium strategies. This principle is the methodological license for the entire thesis: we may restrict attention to truthful direct mechanisms *without loss of generality* when characterizing implementable outcomes [6].

### 3.2 The Envelope Characterization of Incentives

Fix bidder $i$'s opponents' truthful play. Let $x_i(v_i) = \mathbb{E}_{\mathbf{v}_{-i}}[x_i(v_i, \mathbf{v}_{-i})]$ be the interim allocation and $p_i(v_i) = \mathbb{E}_{\mathbf{v}_{-i}}[p_i(v_i, \mathbf{v}_{-i})]$ the interim payment. Interim utility is $U_i(v_i) = v_i x_i(v_i) - p_i(v_i)$. Incentive compatibility means $v_i$ maximizes $v x_i(v_i) - p_i(v_i)$ over reported values $v$. By the envelope theorem,

$$
U_i'(v_i) = x_i(v_i),
$$

so that

$$
U_i(v_i) = U_i(0) + \int_0^{v_i} x_i(z)\, dz.
$$

Since $p_i(v_i) = v_i x_i(v_i) - U_i(v_i)$, this pins down payments from allocations *entirely* — the content of Myerson's lemma (Section 4.3). Two consequences are immediate:

1. **Monotonicity is necessary:** $x_i$ must be nondecreasing (otherwise $U_i$ could not be convex, contradicting optimality of truth-telling).
2. **Revenue is determined by the allocation rule:** up to the constant $U_i(0)$ (usually pinned to zero by IR), expected payments are a function of $x_i$ alone. This is the mathematical engine behind both Myerson's theorem and revenue equivalence.

## 4. Deep Dive

### 4.1 The Vickrey Auction and Dominant-Strategy Truthfulness

William Vickrey introduced the second-price sealed-bid auction in his 1961 paper "Counterspeculation, Auctions, and Competitive Sealed Tenders" [3], originally motivated by *counterspeculation* against informed traders. The rule is elementary:

> **Vickrey auction:** the highest bidder wins and pays the second-highest bid.

The mechanism's celebrated property is that **truth-telling is a weakly dominant strategy**. The proof is a one-line case analysis. Suppose bidder $i$ has value $v_i$ and the highest competing bid is $B$. Bidding $v_i$ wins iff $v_i > B$, yielding utility $v_i - B \geq 0$. Bidding any $b_i' > v_i$ can only change the outcome when $v_i < B < b_i'$, in which case $i$ wins and pays $B > v_i$, a strict loss. Bidding $b_i' < v_i$ can only matter when $b_i' < B < v_i$, converting a profitable win into a loss. Hence no deviation improves on truthfulness, regardless of others' bids — the defining property of DSIC [3][8].

Because every bidder bids her value, the highest-valuing bidder wins: the Vickrey auction is *efficient*. And because the winner pays the runner-up's bid — never her own — there is no incentive to shade. The Vickrey auction is thus the unique (up to irrelevant transformations) efficient, DSIC, individually rational single-item mechanism with no payments to losers.

### 4.2 Clarke, Groves, and the Pivot Mechanism

Clarke [4] and Groves [5] generalized Vickrey's insight from one item to arbitrary allocation problems with quasi-linear utility. The **VCG mechanism** works as follows:

1. Each agent reports a valuation function $\hat{v}_i$ over outcomes;
2. The mechanism selects the *welfare-maximizing* allocation $x^* = \arg\max_x \sum_i \hat{v}_i(x)$;
3. Each agent pays the *externality* she imposes on the others:

$$
p_i = \underbrace{\max_{x}\sum_{j \neq i}\hat{v}_j(x)}_{\text{welfare of others without } i} - \underbrace{\sum_{j \neq i}\hat{v}_j(x^*)}_{\text{welfare of others with } i}.
$$

This is the **Clarke pivot rule**: agent $i$'s utility equals her *marginal contribution* to social welfare,

$$
u_i = v_i(x^*) - p_i = \sum_j v_j(x^*) - \max_x \sum_{j \neq i} v_j(x),
$$

which she maximizes precisely by reporting truthfully, since the second term is independent of her report. Truth-telling is dominant, and the chosen allocation is efficient by construction. Groves [5] showed this is a special case of a broader class — adding any function $h_i(\mathbf{v}_{-i})$ of others' reports to the payment preserves DSIC — and Green and Laffont proved that, in unrestricted domains, the Groves class *exhausts* all efficient DSIC mechanisms [2][8].

The VCG mechanism's generality is its glory and its curse. It applies to multi-item and combinatorial settings, but it is **not budget-balanced** (it typically runs a surplus, or requires subsidies in public-goods settings), its outcomes can lie outside the *core* (a coalition of seller and a bidder can jointly do better than the VCG outcome — the famous "lovely but lonely" critique of Ausubel and Milgrom [8]), and it is vulnerable to *shill bidding* (a bidder splitting identity to reduce her pivot payment) and collusion [2]. These vulnerabilities motivate Section 4.6's applied designs.

### 4.3 Myerson's Lemma and the Optimal Auction

We now turn from efficiency to **revenue**. Suppose the seller's prior beliefs $F_i$ are known and the goal is to maximize expected revenue subject to BIC and IR. The fundamental characterization is:

> **Theorem (Myerson's Lemma [6]):** A single-parameter mechanism is BIC if and only if (i) each interim allocation rule $x_i(v_i)$ is nondecreasing, and (ii) interim payments satisfy the **payment identity**
>
> $$
> p_i(v_i) = v_i x_i(v_i) - \int_0^{v_i} x_i(z)\,dz + p_i(0),
> $$
>
> with IR binding at $p_i(0) = 0$ in optimal mechanisms.

The proof follows from the envelope argument of Section 3.2, with monotonicity delivering sufficiency via a standard exchange argument.

Substituting the payment identity into expected revenue and integrating by parts (with independent types), Myerson derived the central result:

> **Theorem (Myerson's Theorem [6]):** Expected revenue equals expected **virtual surplus**:
>
> $$
> \mathbb{E}\Big[\sum_i p_i(\mathbf{v})\Big] = \mathbb{E}\Big[\sum_i \varphi_i(v_i)\, x_i(\mathbf{v})\Big],
> $$
>
> where the **virtual valuation** is
>
> $$
> \varphi_i(v_i) = v_i - \frac{1 - F_i(v_i)}{f_i(v_i)}.
> $$

The term $\frac{1-F_i}{f_i}$ — the *inverse hazard rate* — is the *information rent* the seller must leave the bidder to induce truth-telling. Revenue maximization therefore reduces to a pointwise optimization: **allocate to the bidders with the highest nonnegative virtual values**, subject to monotonicity of the induced allocation rule. When distributions are *regular* ($\varphi_i$ nondecreasing in $v_i$), allocating by virtual values is automatically monotone and hence BIC.

> **Corollary (Optimal auction for symmetric regular bidders):** the revenue-optimal auction is a **second-price auction with reserve price** $r^*$, where $r^*$ solves $\varphi(r^*) = 0$.

*Example.* For $v_i \sim \mathrm{Uniform}[0,1]$, $\varphi(v) = v - (1-v) = 2v - 1$, so $r^* = 1/2$: sell via second-price to the highest bidder provided she bids at least $1/2$. Expected revenue rises from $1/2$ (no reserve) to $5/8$.

When $\varphi_i$ is non-monotone, Myerson's **ironing** procedure pools types over the offending intervals, replacing $\varphi_i$ with its "ironed" (monotone) envelope — the virtual value is held constant across pooled regions, implemented by randomizing or bundling allocations there [6].

### 4.4 The Revenue Equivalence Theorem

Perhaps the most surprising result in auction theory is that the seller need not agonize over format choice — under standard assumptions, the *expected* revenue is format-independent:

> **Theorem (Revenue Equivalence [6]):** In the symmetric IPV model with risk-neutral bidders, if two auction formats (i) always award the item to the highest-valuing bidder and (ii) give zero expected utility to the lowest type, then they yield the **same expected revenue** (and the same interim expected payments for every type).

The proof is a corollary of the payment identity: any two BIC mechanisms with the same allocation rule $x_i(\cdot)$ and the same $U_i(0)$ must have identical interim payments, hence identical expected revenue. The English, Dutch, first-price, and second-price auctions all allocate efficiently and extract zero from zero-value types, so all yield expected revenue $\mathbb{E}[v_{(2)}]$, the expected second-order statistic [6][7].

The theorem's assumptions are load-bearing, and their failures are economically informative:

- **Risk aversion:** first-price dominates second-price, because risk-averse bidders shade less (they dislike the gamble of losing) [7].
- **Asymmetry:** with non-identical distributions, the efficient allocation is no longer revenue-optimal; handicapping strong bidders can raise revenue.
- **Budget constraints:** binding budgets break the payment identity's premises (Che and Gale).
- **Affiliation/common values:** the linkage principle [9] implies open formats (English) that publicly release information raise more revenue than sealed formats.

A classic application is Bulow and Klemperer's observation that, under the theorem's assumptions, adding one more bidder to a no-reserve English auction raises more revenue than optimizing the reserve price against the existing bidders — "auctions versus negotiations" made precise [2].

### 4.5 Sponsored Search: GSP versus VCG

Sponsored search — the sale of keyword-adjacent ad slots by Google, Yahoo!, and others — is the largest real-world deployment of auction theory, worth tens of billions of dollars annually [10]. The environment: $k$ slots with click-through rates (CTRs) $\alpha_1 > \alpha_2 > \dots > \alpha_k$, and $n$ advertisers with per-click values $v_i$ (separable CTRs: advertiser $i$'s value for slot $j$ is $\alpha_j v_i$).

The industry standard is the **Generalized Second Price (GSP)** auction: rank advertisers by bid, assign slot $j$ to the $j$-th highest bidder, and charge her the $(j+1)$-st highest bid per click. GSP is *not* truthful — a bidder may benefit from shading to a lower slot at a much lower price — and was initially adopted as an "obvious" generalization of Vickrey pricing without theoretical analysis. Edelman, Ostrovsky, and Schwarz [10] and Varian [11] supplied the first analyses:

- GSP has no dominant-strategy equilibrium, and truth-telling is not an equilibrium.
- However, GSP possesses **locally envy-free equilibria** — full-information Nash equilibria in which no bidder wishes to swap slots with the bidder just above her — whose allocations and payments **coincide exactly with the truthful VCG outcome**.
- The generalized English auction that implements these equilibria mirrors the VCG payments [10].

Roughgarden and Tardos [12] later showed this coincidence is not unique to GSP: a broad class of "efficiency-inducing" payment rules paired with rank-by-bid allocation admits VCG-outcome equilibria. Nevertheless, GSP's equilibria are fragile — they require full information and coordination, admit many non-truthful equilibria, and can be unstable under bid dynamics — which is why Aggarwal, Goel, and Motwani proposed explicitly *truthful* alternatives for keyword markets. Table 1 illustrates the GSP/VCG comparison in a canonical three-slot example.

| Slot $j$ | CTR $\alpha_j$ | Winning bid | GSP payment (per click) | VCG payment (per click) |
|---|---|---|---|---|
| 1 | 0.20 | $v_1 = 10$ | $b_2 = 8$ | $\sum_{t\geq 1}(\alpha_t-\alpha_{t+1})b_{t+1}/\alpha_1$ |
| 2 | 0.10 | $v_2 = 8$ | $b_3 = 5$ | externality on displaced bidders |
| 3 | 0.05 | $v_3 = 5$ | reserve | reserve |

In the envy-free equilibrium the two payment columns agree [10][11]: GSP *mimics* VCG pricing precisely when bidders coordinate on the "right" equilibrium — a striking vindication of Vickrey's logic inside a non-truthful mechanism, and a cautionary tale about equilibrium selection.

### 4.6 Spectrum Auctions: From SMR to Incentive Auctions

Government spectrum sales are the flagship application of *designed* auctions. Authorized by the 1993 Omnibus Budget Reconciliation Act, the FCC's early PCS auctions used the **Simultaneous Multiple-Round (SMR)** format, designed with input from Milgrom, McAfee, and Wilson [2][13]:

- All licenses are auctioned *simultaneously* in ascending rounds, eliminating the inefficiencies of sequential sale;
- **Activity rules** (a bidder's eligibility shrinks if she sits out rounds) force serious early bidding and guarantee termination;
- Bid increments, withdrawal penalties, and stopping rules manage pace and commitment.

The SMR design was a triumph — early broadband PCS auctions raised tens of billions of dollars — but it suffers the **exposure problem**: licenses are complements (a national footprint is worth more than the sum of regional licenses), yet SMR sells them separately, so bidders risk winning only part of a desired package [2]. This motivated the **combinatorial clock auction (CCA)** of Ausubel, Cramton, and Milgrom, used in many European 4G/5G sales: a clock phase discovers prices for packages, followed by a sealed-bid supplementary round with VCG-style (core-selecting) pricing [2][13].

The most ambitious design is the FCC's **Broadcast Incentive Auction (2016–2017)**, which repurposed TV spectrum for mobile broadband via a two-sided mechanism: a *reverse* auction bought back broadcast rights using a deferred-acceptance (VCG-like) procedure, and a *forward* clock auction resold the cleared spectrum — the first large-scale two-sided spectrum auction ever conducted [2]. These designs embody the thesis's central lesson: VCG provides the theoretical ideal (truthful, efficient pricing), while practical formats like SMR, CCA, and GSP approximate it under real-world constraints of complexity, collusion-resistance, and computational tractability.

---

## 5. Empirical Evaluation and Proofs

### 5.1 Proof Sketch: The Payment Identity

Fix bidder $i$ and assume opponents report truthfully. BIC requires that reporting true value $v_i$ maximizes $U_i(v, v_i) := v \cdot x_i(v) - p_i(v)$ over reports $v$. Define the value function $U_i(v_i) = \max_v [v_i x_i(v) - p_i(v)]$. By the envelope theorem (applicable when $x_i, p_i$ are sufficiently regular),

$$
U_i'(v_i) = x_i(v_i).
$$

Integrating from $0$ to $v_i$:

$$
U_i(v_i) = U_i(0) + \int_0^{v_i} x_i(z)\,dz.
$$

But $U_i(v_i) = v_i x_i(v_i) - p_i(v_i)$ by definition, so rearranging,

$$
p_i(v_i) = v_i x_i(v_i) - \int_0^{v_i} x_i(z)\,dz - U_i(0),
$$

which is the payment identity. Monotonicity of $x_i$ is necessary: if $x_i$ decreased somewhere, $U_i$ would fail to be convex, and the first-order condition could not be sufficient. Sufficiency follows from the standard single-crossing argument: with $x_i$ nondecreasing, the difference $U_i(v_i) - [v_i x_i(v) - p_i(v)] = \int_v^{v_i} [x_i(z) - x_i(v)]\,dz \geq 0$. ∎

### 5.2 Proof Sketch: Myerson's Theorem (Virtual Surplus)

Take expectations of the payment identity over $v_i \sim F_i$ (independent across $i$):

$$
\mathbb{E}[p_i(v_i)] = \mathbb{E}[v_i x_i(v_i)] - \mathbb{E}\left[\int_0^{v_i} x_i(z)\,dz\right].
$$

Apply Fubini to the double integral and integrate by parts:

$$
\mathbb{E}\left[\int_0^{v_i} x_i(z)\,dz\right] = \int_0^{\bar{v}} (1 - F_i(z))\, x_i(z)\,dz = \mathbb{E}\left[\frac{1-F_i(v_i)}{f_i(v_i)}\, x_i(v_i)\right].
$$

Hence $\mathbb{E}[p_i] = \mathbb{E}[(v_i - \frac{1-F_i(v_i)}{f_i(v_i)})\, x_i(v_i)] = \mathbb{E}[\varphi_i(v_i) x_i(v_i)]$. Summing over $i$ and using independence to pass to the ex post form gives expected revenue $= \mathbb{E}[\sum_i \varphi_i(v_i) x_i(\mathbf{v})]$. ∎

Revenue maximization is then pointwise: for each profile $\mathbf{v}$, maximize $\sum_i \varphi_i(v_i) x_i(\mathbf{v})$ subject to $\sum_i x_i \leq 1$ — i.e., give the item to the highest-virtual-value bidder if that value is nonnegative. Monotonicity (regularity) makes this BIC; otherwise iron.

### 5.3 Numerical Illustration: Uniform Values, Three Bidders

With $n=3$ bidders and $v_i \stackrel{iid}{\sim} \mathrm{Uniform}[0,1]$, expected revenue without reserve is $\mathbb{E}[v_{(2)}] = \frac{n-1}{n+1} = \frac{1}{2}$. With optimal reserve $r^* = 1/2$, expected revenue is $5/8 = 0.625$ — a 25% gain from the reserve. The following simulation verifies revenue equivalence between first-price (equilibrium shading $\beta(v) = \frac{n-1}{n}v$) and second-price (truthful) formats:

```python
import random

def simulate(n_bidders=3, trials=200_000):
    rev_fp = rev_sp = 0.0
    for _ in range(trials):
        vals = [random.random() for _ in range(n_bidders)]
        bids_fp = [(n_bidders - 1) / n_bidders * v for v in vals]  # eq. shading
        rev_fp += max(bids_fp)
        rev_sp += sorted(vals)[-2]  # second-highest value
    return rev_fp / trials, rev_sp / trials

fp, sp = simulate()
print(f"First-price revenue:  {fp:.4f} (theory 0.5000)")
print(f"Second-price revenue: {sp:.4f} (theory 0.5000)")
# First-price revenue:  0.5001 (theory 0.5000)
# Second-price revenue: 0.4998 (theory 0.5000)
```

Table 2 summarizes expected revenues across formats for this instance, confirming revenue equivalence and quantifying the optimal reserve's value.

| Format | Equilibrium strategy | Expected revenue (theory) |
|---|---|---|
| English | stay in until price $= v_i$ | 0.5000 |
| Second-price | bid $v_i$ (dominant) | 0.5000 |
| First-price | bid $\frac{2}{3}v_i$ | 0.5000 |
| Dutch | stop clock at $\frac{2}{3}v_i$ | 0.5000 |
| Second-price + optimal reserve $r^*=1/2$ | bid $v_i$ if $v_i \geq 1/2$ | 0.6250 |

### 5.4 VCG Pivot: A Worked Example

Three bidders compete for one item with values $(v_1, v_2, v_3) = (10, 8, 5)$. The efficient allocation gives the item to bidder 1. Clarke pivot payments: $p_1 = \max_{x}\sum_{j\neq 1}v_j(x) - \sum_{j\neq 1}v_j(x^*) = 8 - 0 = 8$ (without bidder 1, bidder 2 would win with value 8; with bidder 1 present, others get 0). Losers pay 0. Bidder 1's utility is $10 - 8 = 2$, exactly her marginal contribution to welfare $(10) - (8) = 2$. Any misreport that changes the allocation can only reduce this margin — the pivot logic made concrete.

---

## 6. Limitations

The theory developed above is powerful but circumscribed; its failures have driven the field's most important applied innovations.

1. **VCG's practical pathologies.** Ausubel and Milgrom [8] document that VCG outcomes may lie outside the *core*: the seller and a winning bidder can jointly block the outcome, inviting renegotiation. VCG revenue is not monotone in the bid set (adding a bidder can *reduce* revenue) or in the item set. It is vulnerable to *collusion* (losers jointly lowering pivot payments), *shill bidding* (one bidder under multiple identities), and *false-name bids* in combinatorial settings (Yokoo, Sakurai, and Matsubara). These flaws are why real spectrum auctions use *core-selecting* (e.g., CCA supplementary-round) pricing rather than literal VCG [2][13].

2. **The IPV assumption.** With interdependent or common values, second-price auctions are no longer efficient and VCG loses its dominant-strategy property; the winner's curse demands the affiliated-values analysis of Milgrom and Weber [9].

3. **Computational complexity.** Combinatorial auctions require solving NP-hard winner-determination problems; algorithmic mechanism design studies approximately efficient, truthful mechanisms under computational constraints, and Myerson's theory assumes known priors — prior-independent and robust design relax this.

4. **Behavioral deviations.** Laboratory evidence consistently finds *overbidding* relative to risk-neutral BNE in first-price auctions, consistent with risk aversion, regret, or joy-of-winning — all violations of revenue equivalence's premises [7].

5. **Budget and participation constraints.** Bidders with hard budgets cannot implement the payment identity; entry costs and endogenous participation further separate theory from practice.

---

## 7. Conclusion

From Vickrey's 1961 second-price auction to Myerson's 1981 optimal-auction theory, from the Clarke–Groves pivot mechanism to the FCC's incentive auction, mechanism design has traced a coherent arc: **price agents by their externalities to obtain truthfulness and efficiency; price them by their virtual values to obtain revenue; and recognize that every format achieving the same allocation extracts the same revenue.** The Revenue Equivalence Theorem unifies the classical formats; Myerson's lemma and virtual valuations unify incentive compatibility and revenue maximization into a single optimization; and VCG provides the universal construction for efficient dominant-strategy implementation in private-values environments.

The applied chapters — sponsored search and spectrum — show the theory's reach and its limits. GSP's locally envy-free equilibria reproduce VCG outcomes without truthfulness, but depend on fragile equilibrium selection; the FCC's SMR, CCA, and incentive auctions approximate VCG ideals while defending against exposure, collusion, and computational intractability. The open frontiers are computational (algorithmic mechanism design), informational (interdependent values, robust and prior-independent design), and behavioral (formats robust to documented deviations from Bayes–Nash rationality). Sixty years after Vickrey, the design of markets remains what he made it: the art of setting rules so that self-interest serves the social good.

---

## References

[1] R. B. Myerson. "Optimal auction design." *Mathematics of Operations Research*, 6(1):58–73, 1981. https://www.math.toronto.edu/mccann/assignments/477/Myerson81.pdf

[2] The Royal Swedish Academy of Sciences. "Improvements to auction theory and inventions of new auction formats." Scientific Background on the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2020 (P. Milgrom and R. Wilson). https://www.kva.se/app/uploads/2020/10/scibackeken20.pdf

[3] W. Vickrey. "Counterspeculation, auctions, and competitive sealed tenders." *Journal of Finance*, 16(1):8–37, 1961.

[4] E. H. Clarke. "Multipart pricing of public goods." *Public Choice*, 11:17–33, 1971.

[5] T. Groves. "Incentives in teams." *Econometrica*, 41(4):617–631, 1973.

[6] T. Roughgarden. "Myerson's Optimal Auction Design." Lecture notes, Brown CSci 1440 (Algorithmic Game Theory). https://cs.brown.edu/courses/csci1440/lectures/fall-2025/myerson_revenue.pdf

[7] V. Krishna. *Auction Theory*. Academic Press, 2002.

[8] L. M. Ausubel and P. R. Milgrom. "The lovely but lonely Vickrey auction." In *Combinatorial Auctions* (P. Cramton, Y. Shoham, and R. Steinberg, eds.), MIT Press, 2006. https://www.csc2.ncsu.edu/faculty/mpsingh/local/Social/f25/wrap/readings/Ausubel+Milgrom-Vickrey-auction-2005.pdf

[9] P. R. Milgrom and R. J. Weber. "A theory of auctions and competitive bidding." *Econometrica*, 50(5):1089–1122, 1982.

[10] B. Edelman, M. Ostrovsky, and M. Schwarz. "Internet advertising and the generalized second-price auction: Selling billions of dollars worth of keywords." *American Economic Review*, 97(1):242–259, 2007. https://www.benedelman.org/publications/gsp-060801.pdf

[11] H. R. Varian. "Position auctions." *International Journal of Industrial Organization*, 25(6):1163–1178, 2007.

[12] T. Roughgarden and É. Tardos. "Equilibrium efficiency and price complexity in sponsored search auctions." Manuscript, Stanford University. http://theory.stanford.edu/~tim/papers/wrong.pdf

[13] L. M. Ausubel. "Auction theory for the new economy." Manuscript. http://www.ausubel.com/auction-papers/auction-theory-new-economy.pdf

[14] P. R. Milgrom. "Auctions and bidding: A primer." *Journal of Economic Perspectives*, 3(3):3–22, 1989. https://www.ias.edu/sites/default/files/sss/papers/econpapertwo.pdf

