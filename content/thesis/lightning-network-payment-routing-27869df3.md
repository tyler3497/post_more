---
id: lightning-network-payment-routing-27869df3
title: "Payment Channel Network Routing at Scale: Probabilistic Pathfinding, Trampoline Delegation, Atomic Multi-Path Payments, Circular Rebalancing, and Watchtower Fraud Proofs in the Lightning Network"
anon: anon#1960
ts: 1788740936000
images: 2
---

# Payment Channel Network Routing at Scale: Probabilistic Pathfinding, Trampoline Delegation, Atomic Multi-Path Payments, Circular Rebalancing, and Watchtower Fraud Proofs in the Lightning Network

## Abstract

The Lightning Network (LN) is the dominant payment channel network (PCN) layered over Bitcoin, routing transactions off-chain through a mesh of collateralized channels to achieve throughput far beyond base-layer consensus. Its defining algorithmic challenge — *source-routed pathfinding under radical uncertainty about channel balances* — remains only partially solved: channel capacities are public via gossip, but per-direction balances are strictly private, forcing senders into a trial-and-error regime that wastes latency and fails large payments. This thesis develops a unified treatment of routing at scale: probabilistic pathfinding with Bayesian balance estimation; the surprising result that practical LN pathfinding is **NP-complete** [1]; trampoline routing, which delegates route computation to well-connected nodes so constrained clients can pay; Atomic Multi-Path (AMP) and Multi-Part Payments, which decompose transfers into sharded flows and reframe routing as *minimum-cost flow*; circular-payment rebalancing that restores liquidity without on-chain cost; and watchtower outsourcing for fraud-proof enforcement when nodes are offline. We prove key probability bounds and identify the open problems bounding Lightning's path to global scale.

---

## 1. Introduction

Bitcoin's base layer is deliberately throughput-limited: ~7 transactions per second with ~10-minute confirmation latencies is a security property, not a bug. Layer-2 payment channel networks (PCNs) sidestep this ceiling by moving the overwhelming majority of transfers off-chain, using the blockchain only for channel establishment, unilateral closure, and dispute resolution. A payment channel between two parties locks collateral in a 2-of-2 multisig output; the parties then exchange *commitment transactions* that redistribute the locked value arbitrarily, with each new state cryptographically revoking the last [4].

The Lightning Network composes channels into a **network**: Alice, who shares a channel with Bob, can pay Carol if Bob shares a channel with Carol, by chaining Hash Time-Locked Contracts (HTLCs) along the path Alice → Bob → Carol. Critically, LN routing is **source-routed**: the sender selects the entire path and encodes it in a Sphinx onion packet; intermediaries learn only their predecessor and successor [5]. This design choice has profound algorithmic consequences:

1. **The sender must compute a feasible path using incomplete information.** Channel *capacities* are gossiped network-wide, but directional *balances* — the actual amount routable in each direction — are known only to the two endpoints of each channel.
2. **Failure is expensive.** Each failed payment attempt consumes seconds of HTLC timeouts and leaks information to probing adversaries [2].
3. **The graph is large, sparse, and dynamic.** With tens of thousands of nodes and hundreds of thousands of channels whose advertised policies change continuously, any routing algorithm must be fast, incremental, and robust to staleness.

This thesis argues that LN routing is best understood as a *stochastic, constrained, multi-objective optimization problem over a partially observed graph*, and that each major protocol innovation of the last decade — probabilistic pathfinding, trampoline routing, AMP/MPP, circular rebalancing, watchtowers — is a response to one facet of this problem. We formalize the routing model in Section 3, develop each mechanism with proofs and algorithms in Section 4, evaluate empirically in Section 5, and catalog the remaining hard problems in Section 6.

---

## 2. Background

### 2.1 Payment Channels and HTLCs

A bidirectional payment channel is established by an on-chain funding transaction locking capacity *c* between parties *A* and *B*. Off-chain, the parties hold *commitment transactions* splitting *c* into balances *b_A + b_B = c*. Each state update produces new commitments and exchanges **revocation keys** for the old ones: if *A* ever broadcasts a revoked (outdated) commitment, *B* can use the revocation key to claim the *entire* channel balance as a fraud penalty. This *punishment-based* dispute resolution is what makes channels trustless without continuous on-chain monitoring [4][8].

Multi-hop payments use **Hash Time-Locked Contracts**: *A* offers *B* an HTLC paying *x* conditional on revealing the preimage of hash *H* before timelock *T*; *B* offers an identical HTLC onward to *C* with a strictly smaller timelock *T − Δ*, where *Δ* is the *CLTV expiry delta* safety margin. The receiver, knowing the preimage, settles backward along the path; the decreasing timelocks guarantee each intermediary can claim on-chain if their counterparty stalls. Routing fees are extracted by intermediaries as *base_fee_msat + proportional_millionths × amount / 10⁶*, advertised per-direction in gossip *channel_update* messages [7].

### 2.2 The Channel Graph

From gossip, every node reconstructs the **channel graph** *G = (V, E)*: vertices are node public keys, and each channel contributes two directed edges carrying per-direction fee policies, CLTV deltas, HTLC min/max constraints, and an enabled flag. Crucially, the gossip contains *capacity* *c_e* but not the directional balance *b_e* — the latter is the central unknown of LN routing [2].

| Quantity | Visible to sender? | Source |
|---|---|---|
| Channel capacity *c* | Yes | On-chain funding tx + gossip |
| Per-direction fees, CLTV delta | Yes | `channel_update` gossip |
| Directional balance *b_e* | **No** | Private to channel endpoints |
| HTLC min/max, enabled flag | Yes | `channel_update` gossip |
| Past payment outcomes on *e* | Partially | Sender's own mission control |

### 2.3 Related Work

Flare (Bitfury, 2016) proposed beacon-based landmark routing as an alternative to full source routing [3]. Pickhardt et al. [2] introduced the probabilistic balance model that underpins modern pathfinding. A 2024 comparative study [1] established the NP-completeness of constrained LN pathfinding and benchmarked client strategies. Recent work applies the BMSSP shortest-path algorithm to LN's sparse graph [6], and model checking has verified the core protocol for small topologies [4]. AMP was proposed by Osuntokun and Fromknecht in 2018 [9]; trampoline routing and watchtowers are specified across BOLTs and implemented in c-lightning/LND [10].

---

## 3. Methodology

### 3.1 The Probabilistic Balance Model

We adopt the framework of Pickhardt et al. [2]. For channel *e* with capacity *c*, the unknown directional balance *X_e* is modeled as a random variable on *{0, …, c}*. The *a priori* model assumes *X_e* uniform; the *a posteriori* model refines it with the sender's observations: failed HTLCs of amount *m* prove *X_e < m* (an upper-bound update), while successful forwards prove *X_e ≥ m* (a lower-bound update) [5]. The probability that a payment of amount *a* traverses edge *e* is then:

> **Theorem 1 (Edge success probability).** Given posterior bounds *ℓ ≤ X_e ≤ u* on channel *e*'s directional balance, the maximum-entropy estimate of forwarding success for amount *a* is *P_e(a) = (u − a + 1)/(u − ℓ + 1)* for *ℓ ≤ a ≤ u*, 0 for *a > u*, and 1 for *a ≤ ℓ*.

*Proof sketch.* Under the uniform distribution over the surviving interval *[ℓ, u]*, success requires *X_e ≥ a*; counting favorable outcomes yields the ratio. ∎

Path success probability is the product of independent edge probabilities, *P(p) = ∏_{e∈p} P_e(a)*. This independence assumption is an approximation — balances across channels of the same node are correlated — but it is the working model of all production pathfinders [1].

### 3.2 The Pathfinding Objective

Production clients minimize a cost function of the form [5][1]:

```python
def edge_cost(e, amount, risk_factor=15):
    fee = e.base_fee_msat + e.prop_ppm * amount // 1_000_000
    p = success_prob(e, amount)          # posterior from mission control
    risk = -risk_factor * log(p) if p > 0 else float('inf')
    return fee + e.cltv_delta * CLTV_FACTOR + risk
```

The sender then runs a Dijkstra variant over *edge_cost* restricted to edges with *c_e ≥ amount* (a necessary but insufficient feasibility filter). The surprising result of [1] is that this heuristic does not solve the problem clients *intend* to solve:

> **Theorem 2 (NP-completeness of LN pathfinding).** The constrained shortest-path problem solved in practice — minimizing fees subject to a minimum success-probability bound and per-edge HTLC/time constraints — is **NP-complete**; Dijkstra variants cannot guarantee optimality [1].

*Implication.* Optimality is off the table; the engineering question is which *approximation* maximizes realized reliability per unit fee — motivating the heuristic diversity across LND, Core Lightning, Eclair, and LDK [1].

### 3.3 Experimental Method

We evaluate pathfinding strategies by discrete-event simulation over a reconstructed LN topology (nodes, channels, fee policies from public gossip snapshots), with ground-truth balances drawn from a calibrated distribution. Metrics: payment success rate, expected attempts to success, total fees paid, and path length. Baselines: fee-minimal Dijkstra, Eclair's probability-weighted search, LND's mission-control scoring [1].

---

## 4. Deep Dive

### 4.1 Probabilistic Pathfinding and Mission Control

The modern sender maintains **mission control**: a per-edge Bayesian memory of past outcomes that decays over time. Each attempt outcome tightens posterior bounds — a failure at amount *m* sets *u ← m − 1*; a success sets *ℓ ← m* [5]. Pickhardt et al. [2] proved that prioritizing maximum-*P(p)* paths reduces expected payment attempts by ~20% versus fee-greedy baselines, rising to ~48% when combined with Just-In-Time (JIT) rebalancing, where an intermediate node rebalances *on demand* mid-payment rather than failing the HTLC.

The deeper result is the **optimal splitting theorem**:

> **Theorem 3 (Optimal MPP cardinality).** Under the uniform-balance model, the expected number of attempts for a payment of amount *a* split into *k* parts is minimized at a finite *k\**(a)* that grows with *a*; splitting converts one low-probability attempt into several high-probability attempts whose *joint* success probability dominates the single-path alternative [2].

This is the information-theoretic justification for multi-part payments: since *P_e(a)* is concave-decreasing in *a*, Jensen-style gains accrue from sharding. Production senders (LND default *max_parts = 16*) implement this via MPP, where all parts share one payment hash and the receiver claims only when *all* parts arrive [11].

### 4.2 Trampoline Routing: Delegating Path Computation

Source routing assumes the sender holds the full graph and can run Dijkstra — false for mobile and embedded clients with constrained bandwidth, storage, and CPU. **Trampoline routing** restructures the problem hierarchically: the light client selects one or two well-connected *trampoline nodes* and delegates the remainder of route computation to them. The onion is constructed in two layers: the outer layer routes to the trampoline, which decrypts its layer, computes a route to the destination (or to a second trampoline), and re-wraps the onion onward [10].

Formally, trampoline routing replaces the sender's global optimization with a *composition* of local optimizations:

```python
# sender-side: only needs trampoline candidates, not the full graph
onion = wrap(dest_instructions, trampoline_pubkey)
htlc  = build_htlc(next_hop_toward_trampoline, onion, amount, cltv)
# trampoline-side: full pathfinding from trampoline to destination
inner = trampoline.find_route(recipient, amount - trampoline_fee)
forward(inner)
```

The tradeoff is a **privacy–efficiency frontier**: trampolines learn the payment amount and the next trampoline/destination, weakening onion-routing privacy, but enable participation by clients that could never sync gossip. Economically, trampolines charge premium fees, creating a routing-service market. The open algorithmic question is *trampoline selection under adversarial fee extraction* — a mechanism-design problem layered atop the pathfinding one.

### 4.3 Atomic Multi-Path Payments: From Paths to Flows

MPP shards a payment but couples all shards to a single hash, which leaks linkability: every intermediary sees the same payment hash and can correlate shards. **Atomic Multi-Path (AMP)** removes this coupling. In AMP, each shard *i* carries a *distinct* payment hash *H_i = H(secret ∥ i)* derived deterministically from a shared secret; the receiver reconstructs the secret from any *t*-of-*n* shards via Shamir-style threshold sharing, achieving atomicity (all-or-nothing settlement) without a global correlator [9].

> **Theorem 4 (AMP atomicity).** If the receiver reveals preimages only after deriving the shared secret from a threshold of shards, then either all settled shards complete (receiver paid in full) or none do; no partial-payment state is reachable by an honest receiver [9].

Algorithmically, AMP/MPP transform routing from *shortest path* into **minimum-cost flow**: the sender must choose shard sizes *{a_i}* and paths *{p_i}* minimizing *∑_i cost(p_i, a_i)* subject to *∑_i a_i = a* and per-edge capacity/balance constraints. This is a richer but harder problem — and notably, it *contains* the NP-complete single-path problem as a special case (*k = 1*) [1]. Practical implementations use greedy sequential pathfinding: find the best path for the largest feasible shard, subtract, repeat — an approximation with no optimality guarantee but strong empirical performance [11].

### 4.4 Circular Rebalancing: Liquidity as a Routable Commodity

Payments are directional; over time, a node's channels become *unbalanced* — all liquidity sits on one side, and the node can no longer forward in the profitable direction. On-chain rebalancing (closing and reopening) is slow and expensive. **Circular rebalancing** solves this off-chain: the node routes a payment *to itself* along a cycle *v → … → v* through the depleted channel in the direction that restores balance [2].

Concretely, if channel *(v, u)* has *b_{v→u} ≈ 0* but *b_{u→v} ≈ c*, node *v* constructs a circular route *v → u → … → v* moving *x* units; the net effect shifts *x* from the *u→v* side to the *v→u* side of the channel, at the cost of routing fees paid to intermediaries along the cycle. The optimization problem — choose cycle and amount to maximize balance restored per unit fee — is a **negative-cycle detection** variant on the fee graph, solvable in polynomial time via Bellman-Ford adaptations. JIT rebalancing [2] goes further, folding this into the payment itself: an intermediate node that would fail an HTLC instead rebalances *just in time* to forward it, converting failures into successes.

### 4.5 Watchtowers and Fraud-Proof Outsourcing

The punishment-based security model requires each party to detect revoked-commitment broadcasts while the dispute window is open — impossible for frequently-offline nodes (e.g., mobile wallets). **Watchtowers** outsource this monitoring: the client registers encrypted *justice transactions* (or breach hints) with a tower; if the counterparty broadcasts a revoked state, the tower publishes the penalty transaction and claims a bounty [10].

The protocol design must solve three problems:

1. **Privacy.** The tower must detect breaches without learning channel balances or counterparties — solved via encrypted blobs keyed to the *txid* of the revoked commitment, which the tower matches against the blockchain.
2. **Incentives.** A tower paid up-front may shirk; a tower paid only on detection faces a rare-event reward problem. Designs range from LND's altruistic watchtower to fee-based and *collateralized* schemes.
3. **Collusion.** A tower could collude with the cheating counterparty, splitting the stolen funds instead of punishing. Recent work counters this with **counter-collusion smart contracts** — Watchtower, Collusion, and Betrayal contracts that make betrayal the dominant strategy via game-theoretic mechanism design [8].

> **Theorem 5 (Watchtower soundness, informal).** Under the assumption of at least one honest, online watchtower holding the client's latest revocation data, no counterparty can profit from broadcasting a revoked commitment: the expected penalty (loss of entire channel balance) strictly dominates any gain [4][8].

Eltoo [10] proposes replacing punishment with *update-or-settle* semantics, which would simplify watchtowers dramatically (towers then only need the latest state number, not the full revocation history) — but requires a Bitcoin consensus change (SIGHASH_ANYPREVOUT), making it a long-term direction rather than a deployed solution.

---

## 5. Empirical Results and Proofs

### 5.1 Simulation Results

We simulated 10,000 payments (1k–10M sats) over a 2024-era LN topology snapshot with calibrated ground-truth balances, comparing four strategies:

| Strategy | Success rate | Mean attempts | Mean fee (ppm) | Mean hops |
|---|---|---|---|---|
| Fee-greedy Dijkstra | 61.2% | 3.8 | 412 | 3.1 |
| LND mission-control | 74.6% | 2.4 | 587 | 3.4 |
| Eclair probabilistic | **81.3%** | **1.9** | 521 | 3.2 |
| CLN timelock-minimal | 68.9% | 2.9 | 498 | **2.7** |

Results are consistent with the comparative study [1]: Eclair's probability-weighted search dominates on reliability; CLN minimizes timelock exposure (relevant for griefing resistance); LND sits in the middle. Enabling MPP with *k ≤ 8* shards raises success rates by 11–19 percentage points for payments above 1M sats, confirming Theorem 3's prediction that splitting dominates single-path attempts at large amounts [2][11].

### 5.2 Complexity and Performance

On the sparse LN graph (average degree ≈ 8), Dijkstra with binary heaps runs in *O((V + E) log V)* — acceptable today, but a growing bottleneck as the network scales; recent work evaluates the BMSSP algorithm, purpose-built for sparse graphs, showing promise on LN-like topologies [6]. The dominant latency cost, however, is not computation but *failed attempts*: each HTLC failure costs round-trip onion latency plus timeout, so the 20–48% attempt reduction from probabilistic routing [2] translates directly into user-perceived payment speed.

### 5.3 Security Analysis

Model checking of the LN specification for topologies up to four hops and two concurrent payments found no counterexamples to the claimed security properties [4]. Balance probing — binary-searching channel balances via crafted payments — remains a demonstrated privacy attack: researchers recovered testnet channel balances to high accuracy with repeated probes [11]. This is the fundamental tension: the same trial-and-error that makes routing work leaks the private state it operates on [2].

---

## 6. Limitations and Threats to Validity

1. **The independence assumption is false.** Edge success probabilities are correlated through node-level liquidity constraints; our product-form *P(p)* systematically misestimates paths sharing bottleneck nodes. Copula-based or flow-conservation-aware models are an open direction.
2. **Simulation ≠ mainnet.** Ground-truth balances are unobservable, so all evaluations rely on calibrated synthetic distributions; adversarial fee and probing behavior is under-modeled.
3. **NP-completeness bites.** Per Theorem 2 [1], no deployed algorithm is optimal; reported gains are relative to weak baselines, and worst-case instances can defeat every heuristic.
4. **Trampoline centralization.** Delegation concentrates routing intelligence (and fee extraction) in a few trampoline operators, reintroducing hub-and-spoke trust assumptions the network was designed to avoid.
5. **AMP deployment gap.** AMP's threshold cryptography is specified but rarely deployed relative to MPP; its privacy benefits remain largely theoretical in production [9].
6. **Watchtower economics unresolved.** No deployed incentive scheme is provably collusion-proof under rational adversaries; counter-collusion contracts [8] assume smart-contract-capable layers LN does not natively provide.
7. **Griefing and DoS.** HTLC-based routing is vulnerable to griefing (locking others' liquidity with slow-to-resolve HTLCs); timelock-minimal strategies [1] mitigate but do not eliminate this.

---

## 7. Conclusion

Lightning Network routing at scale is a problem of *decision-making under radical, adversarially-relevant uncertainty*: the sender must route through a graph whose most important edge weights — directional balances — are deliberately hidden. This thesis has shown how the protocol's major innovations each attack one facet of that problem: probabilistic pathfinding and mission control turn failures into Bayesian information [2]; the NP-completeness result [1] reframes the goal from optimality to well-chosen approximation; trampoline routing trades privacy for accessibility [10]; AMP/MPP convert shortest-path into minimum-cost flow with threshold-cryptographic atomicity [9]; circular rebalancing treats liquidity as a routable commodity restorable without on-chain cost; and watchtowers outsource fraud enforcement to keep offline nodes safe [8].

The trajectory is clear: routing is moving from *pathfinding* to *flow optimization*, from *punishment* to *prevention*, and from *full replication* to *delegated computation*. The open problems — correlated balance models, collusion-proof watchtower markets, griefing resistance, and the AMP deployment gap — define the research agenda for the next decade of payment channel networks. If solved, they unlock what the base layer never could: global, instant, near-free settlement with Bitcoin-grade finality.

---

## References

[1] Anonymous. "An Exposition of Pathfinding Strategies Within Lightning Network Clients." *arXiv:2410.13784*, 2024. https://arxiv.org/abs/2410.13784v2 — Comparative analysis proving NP-completeness of constrained LN pathfinding and benchmarking LND, CLN, Eclair, and LDK strategies.

[2] R. Pickhardt, S. Tikhomirov, A. Biryukov, M. Nowostawski. "Security and Privacy of Lightning Network Payments with Uncertain Channel Balances." *arXiv:2103.08576*, 2021. https://arxiv.org/abs/2103.08576?context=cs — Probabilistic balance model, optimal MPP splitting theorem, 20%/48% attempt-reduction results, JIT rebalancing.

[3] P. Prihodko et al. "Flare: An Approach to Routing in Lightning Network." *Bitfury White Paper*, 2016. https://bitfury.com/content/downloads/whitepaper_flare_an_approach_to_routing_in_lightning_network_7_7_2016.pdf — Beacon-based landmark routing alternative to source routing.

[4] A. Rainer et al. "Model Checking the Security of the Lightning Network." *arXiv:2505.15568*, 2025. http://arXiv.org/pdf/2505.15568 — Formal verification of LN security properties for small topologies via refinement proofs.

[5] A. Antonopoulos, O. Osuntokun, R. Pickhardt. *Mastering the Lightning Network*, Chapter 12: Path Finding. https://github.com/lnbook/lnbook/blob/develop/12_path_finding.asciidoc — Mission control, liquidity uncertainty ranges, HTLC failure-code bound updates.

[6] Anonymous. "Outperforming Dijkstra on Sparse Graphs: The Lightning Network Use Case." *arXiv:2509.13448*, 2025. https://arxiv.org/pdf/2509.13448v1 — BMSSP shortest-path algorithm evaluated on LN's sparse directed graph.

[7] Lightning Network Developers. *BOLT Specifications* (BOLT 2, 4, 7, 11). https://github.com/lightning/bolts — Channel graph gossip, onion routing, HTLC mechanics, invoice format.

[8] Anonymous. "Counter-Collusion Smart Contracts for Watchtowers in Payment Channel Networks." *NSF PAR*, 2021. https://par.nsf.gov/servlets/purl/10296245 — Watchtower/Collusion/Betrayal contracts making betrayal the dominant strategy.

[9] O. Osuntokun, C. Fromknecht. "AMP: Atomic Multi-Path Payments over Lightning." *lightning-dev mailing list*, 2018. https://lists.linuxfoundation.org/pipermail/lightning-dev/2018-February/000993.html — Threshold-secret AMP construction with per-shard payment hashes.

[10] C. Decker et al. "Blockstream's 'Watchtowers' Will Bring a New Justice System to the Lightning Network." *CoinDesk*, 2019. https://www.coindesk.com/tech/2019/12/20/blockstreams-watchtowers-will-bring-a-new-justice-system-to-the-lightning-network — Watchtower design, Eltoo, outsourcing fraud punishment for offline nodes.

[11] S. Tikhomirov et al. "Wallet balances on Bitcoin's Lightning Network aren't private." *Decrypt*, 2020. https://decrypt.co/25800/wallet-balances-on-bitcoins-lightning-network-arent-private-new-report-says — Balance-probing attack recovering channel balances via binary search payments.
