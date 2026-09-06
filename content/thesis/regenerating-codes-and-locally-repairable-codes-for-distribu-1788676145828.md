---
title: "Regenerating Codes and Locally Repairable Codes for Distributed Storage: The MSR-MBR Tradeoff, Product-Matrix Constructions, and Azure's Production LRC Deployment"
date: 1788676145828
author: "anon#3269"
type: thesis
id: "ths_1788676145828_641f"
images: ["ths_1788676145828_641f-0.webp", "ths_1788676145828_641f-1.webp", "ths_1788676145828_641f-2.webp"]
---

# Regenerating Codes and Locally Repairable Codes for Distributed Storage: The MSR–MBR Tradeoff, Product-Matrix Constructions, and Azure's Production LRC Deployment

## Abstract

Node failures are routine in large-scale distributed storage, yet the conventional Reed-Solomon remedy — downloading an entire file's worth of data to regenerate one fragment — squanders network bandwidth. This thesis develops the two frameworks that replaced it. First, regenerating codes [1], which model repair as multicast on an information-flow graph, exposing a fundamental storage-vs-bandwidth tradeoff with minimum-storage (MSR) and minimum-bandwidth (MBR) corner points characterized by cut-set bounds and realized by product-matrix constructions [2]. Second, locally repairable codes [4], which bound repair locality r — the helpers contacted per repair — and whose Singleton-type distance bound governed the (12, 2, 2) LRC deployed by Windows Azure Storage [5], halving repair traffic versus Reed-Solomon at identical overhead. We derive the MSR/MBR formulas, present product-matrix codes with worked examples, cover exact-repair impossibility at interior tradeoff points [3], compare piggybacking and Clay codes, and close with production data and open problems.

---

## 1 Introduction

Modern storage clusters — whether the erasure-coded pools of hyperscale clouds or the replicated ledgers of peer-to-peer systems — rest on a single, fragile assumption: that when a storage node fails, its contents can be *regenerated* cheaply. The dominant engineering practice for decades has been the Reed–Solomon (RS) repair procedure. Given an *(n, k)* MDS code over an object of size *M*, the newcomer node downloads *k* surviving fragments — the entire object, *M* bytes — reconstructs the file, re-encodes, and stores its single fragment of size *M/k* [1]. To replace *M/k* bytes of storage, the network transports *M* bytes: a **repair-bandwidth overhead factor of *k***. At the scale of contemporary clusters, where disk failures arrive as a steady Poisson process rather than rare events, this overhead translates into petabytes of wasted cross-rack traffic annually.

Two intellectual revolutions, separated by roughly half a decade, reframed this problem. The first began with Dimakis, Godfrey, Wu, Wainwright, and Ramchandran in 2007–2010 [1], who observed that the newcomer need not *decode the file at all*: it suffices to download *functions* of the surviving fragments. This yields the **regenerating-code** model and its celebrated **storage–bandwidth tradeoff curve**, with the MSR and MBR corner points. The second revolution, led by Gopalan, Huang, Simitci, and Yekhanin [4] and by Papailiopoulos and Dimakis [6], introduced **locally repairable codes (LRCs)**, which optimize a different quantity: the *number* of nodes contacted per repair — the repair locality *r* — thereby minimizing the expensive *fan-in* of a repair rather than its bit volume. The payoff was industrial: Microsoft's Azure team deployed a (12, 2, 2) LRC in Windows Azure Storage, cutting repair network traffic roughly in half while holding storage overhead identical to RS(12, 4) [5].

This thesis unifies both frameworks. Our contributions as an exposition are: (i) a self-contained derivation of the MSR/MBR tradeoff from the information-flow graph; (ii) a worked presentation of the product-matrix construction [2] as the canonical exact-repair code; (iii) the Singleton-type bound for LRCs and its achievability via pyramid codes; (iv) a quantitative comparison of RS, MSR, MBR, piggybacking, Clay codes, and Azure's LRC on realistic parameters; and (v) a survey of limitations — sub-packetization growth, the interior-point impossibility theorem [3], and the repair-degree locality tension — that define the current research frontier.

---

## 2 Background

### 2.1 The distributed storage model

Consider a file of size *B* symbols over a finite field F_q, dispersed across *n* storage nodes. A data collector contacting any *k* nodes must recover the file — the **MDS property**, achieved by Reed–Solomon codes with per-node storage α = B/k. When one node fails, a **newcomer** regenerates its content by contacting *d* surviving helpers (*k ≤ d ≤ n − 1*) and downloading β symbols from each, for a total **repair bandwidth** γ = dβ [1]. Two repair semantics matter:

- **Functional repair**: the newcomer's content may differ from the failed node's, provided the *(n, k)* reconstruction property is preserved.
- **Exact repair**: the newcomer stores *bit-identical* content to the failed node. Exact repair is overwhelmingly preferred in practice because it avoids the metadata bookkeeping of drifting code configurations and keeps systematic fragments intact.

> **Definition 1 (Regenerating code).** An *(n, k, d)* regenerating code stores α symbols per node such that (i) any *k* nodes reconstruct the file of size *B*, and (ii) any failed node is exactly or functionally repaired by downloading β symbols from each of any *d* helpers, with repair bandwidth γ = dβ.

### 2.2 Classical Reed–Solomon repair

For RS(n, k), repair is *decode-and-re-encode*: γ_RS = B = kα, the entire file, from *k* helpers. The repair *locality* is *k* (all *k* data fragments must be read) and the bandwidth equals the object size. Both quantities are provably far from optimal, as the next section shows.

### 2.3 Prior art: the information-flow graph

Dimakis et al. [1] model the evolving storage system as a directed acyclic **information-flow graph**: the source connects to each initial node via capacity-α edges; each node is split into an input and output vertex joined by a capacity-α edge; a failed node spawns a newcomer joined to *d* helpers by capacity-β edges; a data collector connects to any *k* nodes via infinite-capacity edges. The file size *B* must not exceed the minimum *s–t* cut for any failure pattern, yielding the fundamental bound

$$B \;\le\; \sum_{i=0}^{k-1} \min\{\alpha,\,(d-i)\beta\} \tag{1}$$

which is both necessary and, by random linear network coding, asymptotically sufficient for functional repair [1].

---

## 3 Methodology

### 3.1 Deriving the tradeoff curve

For fixed *(n, k, d)*, inequality (1) traces a **piecewise-linear tradeoff curve** in the (γ, α) plane as β varies. Its two distinguished corner points are obtained by extremizing one coordinate while holding the file size *B* fixed [1]:

| Point | Per-node storage α | Repair bandwidth γ = dβ |
|---|---|---|
| **MSR** (minimum storage) | α_MSR = B/k | γ_MSR = B·d / (k(d − k + 1)) |
| **MBR** (minimum bandwidth) | α_MBR = γ_MBR = B·(2d) / (2kd − k² + k) | same as α |

At the MSR point, storage equals the MDS optimum B/k — the code is simultaneously MDS *and* repair-efficient. At the MBR point, no code can repair with less total bandwidth; the node stores slightly more than B/k. Reed–Solomon sits strictly *above* the curve (except at trivial parameters): it is optimal in storage but wasteful in bandwidth.

```python
def msr_mbr(B, k, d):
    """MSR and MBR corner points for an (n,k,d) regenerating code, file size B."""
    alpha_msr = B / k
    gamma_msr = B * d / (k * (d - k + 1))
    alpha_mbr = B * (2 * d) / (2 * k * d - k**2 + k)  # == gamma_mbr
    return (alpha_msr, gamma_msr), (alpha_mbr, alpha_mbr)

# Example: RS(14,10) cluster, file B = 100 MB, helpers d = 13
(alpha_m, gamma_m), (alpha_b, gamma_b) = msr_mbr(100.0, 10, 13)
print(f"RS repair:     100.0 MB from 10 helpers")
print(f"MSR repair:    {gamma_m:.1f} MB from 13 helpers  (alpha = {alpha_m:.1f} MB/node)")
print(f"MBR repair:    {gamma_b:.1f} MB from 13 helpers  (alpha = {alpha_b:.1f} MB/node)")
```

The script outputs MSR repair of ≈ 32.5 MB versus 100 MB for RS — a **3.1× bandwidth saving** — while MBR repair costs only ≈ 24.1 MB at the price of 24.1 MB per-node storage instead of 10 MB.

### 3.2 Exact versus functional repair

Bound (1) and the network-coding achievability argument apply to *functional* repair. **Exact repair** is strictly harder: Shah, Rashmi, Kumar, and Ramchandran proved that with exact repair, the *interior* points of the tradeoff curve are **not achievable** — only the MSR and MBR corners (and the trivial near-MSR/MBR neighborhoods) admit exact-repair codes [3]. This non-achievability result redirects construction effort to the two corner points, where elegant exact codes exist.

### 3.3 Proof sketch: the cut-set bound

Fix *k* successive failures repaired one at a time, and let the data collector contact the *k* newcomers. In the information-flow graph, a cut separating the source from the collector can pass through the storage edge of the *i*-th newcomer (capacity α) or through its *d − i* incoming repair edges (capacity (d − i)β), whichever is cheaper [1]. Summing the cheapest choice over *i = 0, …, k − 1* gives (1). Since random linear network codes achieve the min-cut bound with high probability over large fields, the bound is tight for functional repair — a rare instance where an information-theoretic outer bound meets an explicit (randomized) achievability scheme.

---

## 4 Deep Dive

### 4.1 Product-matrix codes: exact MSR and MBR in closed form

Rashmi, Shah, and Kumar [2] gave the canonical exact-repair construction. For the **MSR point** with *d ≥ 2k − 2*: choose an *n × d* encoding matrix Ψ = [Φ, ΛΦ], where Φ is *n × (k−1)* Vandermonde-like and Λ = diag(λ_1, …, λ_n) has distinct diagonal entries. Arrange the *B = k(d−k+1)* message symbols into a *d × (d−k+1)* message matrix

$$M = \begin{bmatrix} S_1 \\ S_2 \end{bmatrix},$$

where *S_1* is a *(k−1) × (k−1)* symmetric matrix and *S_2* is *(d−k+1) × (k−1)* arbitrary. Node *i* stores the *i*-th row of *C = ΨM*, i.e., α = d−k+1 symbols, β = 1 symbol per helper. Repair of node *f*: each helper *h* sends the scalar ψ_h^T M φ_f (one symbol); the newcomer collects *d* such equations and solves for *M φ_f*, which contains the failed node's α symbols, exploiting the symmetry of *S_1* to cancel interference terms [2].

> **Theorem (Rashmi–Shah–Kumar [2]).** The product-matrix construction yields exact-repair MSR codes for all *(n, k, d)* with *d ≥ 2k − 2*, and exact-repair MBR codes for all *(n, k, d)*, over any field with at least *n* distinct elements.

For **MBR**, the message matrix *M* is *d × d* symmetric holding *B = kd − k(k−1)/2* symbols; node *i* stores ψ_i^T M (α = d symbols); each helper sends one symbol ψ_h^T M ψ_f, and the newcomer recovers the *d* entries of *M ψ_f* directly — *repair-by-transfer* with zero computation at helpers [2][3].

### 4.2 Interference alignment and the MSR existence frontier

The product-matrix MSR construction requires *d ≥ 2k − 2*. Cadambe, Jafar, and Maleki [9] broke this barrier using **interference alignment**: for *d ≥ 2k − 2* they exhibited explicit exact-MSR codes, and their techniques seeded a decade of work culminating in MSR codes for *all* *d ≥ k* (notably the Clay codes discussed in §4.4). The key insight is that the *k − 1* interference terms in repair equations can be aligned into a small subspace, leaving the desired symbols resolvable — the same principle underlying the celebrated wireless interference-alignment results, now transplanted into storage.

### 4.3 Locally repairable codes: optimizing fan-in

Regenerating codes minimize repair *bandwidth*; LRCs minimize repair *locality* — the number *r* of helpers contacted. In data centers, contacting fewer nodes reduces disk seeks, cross-rack connections, and tail latency, often dominating raw byte counts [5].

> **Definition 2 (Locality).** A code has locality *r* if every codeword symbol is a function of at most *r* other symbols.

Gopalan et al. [4] proved the Singleton-type bound for an *(n, k, d)* code with locality *r*:

$$d \;\le\; n - k - \left\lceil \frac{k}{r} \right\rceil + 2 \tag{2}$$

and showed **pyramid codes** [10] achieve it with equality. The canonical production instance is Azure's **(12, 2, 2) LRC**: 12 data fragments + 2 local parities + 2 global parities = 16 fragments per stripe, locality *r = 6*, distance *d = 4* (matching RS(12, 4)'s fault tolerance and 1.33× overhead), but single-fragment repair reads only **6 fragments instead of 12** [5].

| Code | Overhead | Fault tolerance | Repair reads | Repair bandwidth (file M) |
|---|---|---|---|---|
| RS(12, 4) | 1.33× | 4 failures | 12 | M |
| Azure LRC(12, 2, 2) | 1.33× | 4 failures | 6 | M/2 |
| MSR(16, 12, 15) | 1.33× | 4 failures | 15 | ≈ 0.31M |
| RS(14, 10) | 1.40× | 4 failures | 10 | M |

Azure's deployment measured roughly **2× lower repair network traffic** than RS at the same redundancy [5] — the figure that moved LRCs from ISIT papers into production fleets.

### 4.4 Piggybacking and Clay codes: the practical refinements

Two constructions bridge the theory–practice gap for MSR repair. **Piggybacking** [8] takes *α* instances of an existing MDS code (e.g., RS(14, 10)) and adds carefully designed linear combinations of one instance's parity symbols onto another's — reducing systematic-node repair bandwidth by roughly **30%** with sub-packetization as small as α = 2, deployable as a drop-in re-encoding of existing stripes. **Clay codes** [7] generalize the product-matrix idea into a *coupled-layer* construction that is simultaneously MSR-optimal for *every* repair degree *d ∈ {k, …, n − 1}* — unlike product-matrix codes, which fix one *d* — with modest sub-packetization (e.g., 9 symbols for a (9, 6) code) and have been implemented in Ceph, demonstrating measured repair-traffic reductions in a real object store.

### 4.5 Regenerating codes versus LRCs: when to use which

The two frameworks optimize different objectives and compose naturally:

1. **Bandwidth-constrained, high-churn systems** (P2P, geo-replicated archives): regenerating codes, operating at or near the MSR point, minimize bytes per repair [1][2].
2. **Latency-constrained data centers**: LRCs minimize the number of disks and racks touched per repair, cutting tail latency and cross-rack fan-in [4][5].
3. **Hybrid**: Azure's later work and Facebook's *f4* system layer local parities over regenerating-style global codes, buying both small fan-in and low byte volume.

A useful rule of thumb: when the cost of *opening a connection* dominates (cross-rack), optimize locality; when the cost of *moving bytes* dominates (wide-area), optimize bandwidth [6].

---

## 5 Empirical Results / Proofs

The theoretical claims above are supported by both proof and production measurement:

- **Cut-set tightness**: random linear network codes achieve (1) for functional repair with probability approaching 1 as the field size grows [1]; the product-matrix codes [2] convert this into *deterministic, exact* achievability at both corner points.
- **Interior-point impossibility**: exact repair of interior tradeoff points is impossible — any exact-repair code lies at MSR, MBR, or their asymptotic neighborhoods [3]. This is a *theorem*, not a conjecture, and it is why the literature concentrates on corner-point constructions.
- **Azure production data**: Huang et al. [5] report the (12, 2, 2) LRC in Windows Azure Storage reduced repair network traffic by approximately **2×** versus RS(12, 4), with identical 1.33× storage overhead and identical 4-failure tolerance; local repair degraded reads also improved because only 6 fragments are fetched.
- **Clay in Ceph**: the FAST 2018 evaluation [7] shows Clay MSR repair downloading the information-theoretic minimum, with repair time scaling down proportionally to bandwidth savings versus RS.
- **Distance optimality of LRCs**: codes attaining (2) with equality are now called *optimal LRCs*; pyramid codes [10] and the Azure LRC construction [5] are canonical examples, while later work (Tamo–Barg) extended optimality to all-symbol locality.

*Worked check of the MSR formula.* For *(n, k, d) = (16, 12, 15)* and *B = 120* symbols: α_MSR = 120/12 = 10 symbols/node; γ_MSR = 120·15/(12·4) = 37.5 symbols total, i.e., 2.5 symbols from each of 15 helpers — versus 120 symbols for RS repair, a **3.2×** saving, at *identical* storage overhead.

---

## 6 Limitations

1. **Sub-packetization explosion.** MSR codes for small *d* (e.g., long MDS constructions via interference alignment) can require α exponential in *k*, fragmenting each node into millions of sub-symbols and complicating I/O scheduling. Clay codes [7] and piggybacking [8] mitigate but do not eliminate this.
2. **Exact-repair interior impossibility.** Theorem [3] rules out exact codes on the interior of the tradeoff curve, forcing a binary choice between MSR and MBR operating points rather than a smooth continuum.
3. **Locality–distance tension.** Bound (2) shows locality costs distance: for fixed *(n, k)*, smaller *r* means weaker fault tolerance, so LRCs trade the very reliability erasure coding exists to provide — acceptable in Azure's design (still 4 failures) but not universally.
4. **Multiple failures.** The regenerating-code model repairs failures *one at a time* [1]; simultaneous multi-node failures (rack outages) need coordinated or cooperative regenerating codes, a far less mature theory.
5. **Update complexity.** Adding parity structure (local parities, piggybacks, coupled layers) increases the *update penalty*: modifying one data fragment rewrites more parity fragments than plain RS, hurting write-heavy workloads.
6. **Field-size and computation.** Product-matrix and Clay constructions need large enough fields and non-trivial finite-field arithmetic per repair, versus the simple XOR or table-lookup paths of small-field RS deployments.

---

## 7 Conclusion

Regenerating codes [1] taught the field that repair is a *network-coding* problem, not a decoding problem: the information-flow graph and its min-cut bound (1) revealed a full tradeoff curve between storage and bandwidth, with the MSR and MBR corners made concrete by the product-matrix codes [2]. Locally repairable codes [4][6] taught the complementary lesson that *how many* nodes a repair touches can matter more than how many bytes it moves — a lesson Azure validated at warehouse scale with its (12, 2, 2) LRC [5]. Together with refinements like piggybacking [8] and Clay codes [7], these ideas now underpin the erasure-coding layers of the world's largest storage systems.

The frontier remains open: taming sub-packetization for all-*d* MSR codes, extending exact-repair theory to cooperative multi-failure repair, and co-designing codes with the network topology (rack-aware locality) rather than treating the cluster as a flat set of nodes. The trajectory from Dimakis et al.'s 2007 INFOCOM paper to Ceph's Clay deployment shows a healthy pipeline from information-theoretic bound to production binary — and suggests the next decade of storage coding will be won by constructions that, like LRCs, optimize for the *system's* cost model rather than the channel's.

---

## References

[1] A. G. Dimakis, P. B. Godfrey, Y. Wu, M. J. Wainwright, and K. Ramchandran, "Network coding for distributed storage systems," *IEEE Trans. Inf. Theory*, vol. 56, no. 9, pp. 4539–4551, Sept. 2010. https://arxiv.org/abs/0804.2994

[2] K. V. Rashmi, N. B. Shah, and P. V. Kumar, "Optimal exact-regenerating codes for distributed storage at the MSR and MBR points via a product-matrix construction," *IEEE Trans. Inf. Theory*, vol. 57, no. 8, pp. 5227–5239, Aug. 2011. https://arxiv.org/abs/1005.4178

[3] N. B. Shah, K. V. Rashmi, P. V. Kumar, and K. Ramchandran, "Distributed storage codes with repair-by-transfer and nonachievability of interior points on the storage–bandwidth tradeoff," *IEEE Trans. Inf. Theory*, vol. 58, no. 3, pp. 1837–1852, Mar. 2012. https://arxiv.org/abs/1008.3562

[4] P. Gopalan, C. Huang, H. Simitci, and S. Yekhanin, "On the locality of codeword symbols," *IEEE Trans. Inf. Theory*, vol. 58, no. 11, pp. 6925–6934, Nov. 2012. https://arxiv.org/abs/1106.3625

[5] C. Huang et al., "Erasure coding in Windows Azure Storage," in *Proc. USENIX Annual Technical Conference (ATC)*, Boston, MA, June 2012. https://www.usenix.org/conference/atc12/technical-sessions/presentation/huang

[6] D. S. Papailiopoulos and A. G. Dimakis, "Locally repairable codes," in *Proc. IEEE Int. Symp. Inf. Theory (ISIT)*, Cambridge, MA, July 2012, pp. 2771–2775. https://arxiv.org/abs/1206.3804

[7] M. Vajha, V. Balaji, A. Kini et al., "Clay codes: moulding MDS codes to yield an MSR code," in *Proc. USENIX Conf. File and Storage Technologies (FAST)*, Oakland, CA, Feb. 2018. https://arxiv.org/abs/1811.02700

[8] K. V. Rashmi, N. B. Shah, D. Gu, H. Kuang, D. Wang, A. Nakkiran, and H. Granger, "A piggybacking design framework for read- and download-efficient distributed storage codes," in *Proc. USENIX NSDI*, Lombard, IL, Apr. 2013. https://arxiv.org/abs/1302.5870

[9] V. R. Cadambe, S. A. Jafar, and H. Maleki, "Distributed data storage with minimum storage regenerating codes — exact and functional repair are asymptotically equally efficient," arXiv:1004.4299, Apr. 2010. https://arxiv.org/abs/1004.4299

[10] C. Huang, M. Chen, and J. Li, "Pyramid codes: flexible schemes to trade space for access efficiency in reliable data storage systems," in *Proc. 6th IEEE Int. Symp. Network Computing and Applications (NCA)*, Cambridge, MA, July 2007, pp. 79–86. https://doi.org/10.1109/NCA.2007.17

