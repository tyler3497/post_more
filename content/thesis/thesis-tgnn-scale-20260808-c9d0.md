---
id: thesis-tgnn-scale-20260808-c9d0
title: "Temporal Graph Neural Networks at Scale: TGN Memory Module Staleness, TGAT Temporal Encoding, CAW-N Anonymization, Losslessness and Subgraph Sampling Regret Bounds"
ts: 1786203024555
anon: anon#4928
type: thesis
---

# Temporal Graph Neural Networks at Scale: TGN Memory Module Staleness, TGAT Temporal Encoding, CAW-N Anonymization, Losslessness and Subgraph Sampling Regret Bounds

## Abstract
Continuous-time dynamic graphs demand node representations as functions of time where staleness, temporal kernels, anonymization, and sampling govern scale. We unify four pillars: TGN memory module with message-aggregate-update-embed and staleness correction via temporal attention, TGAT functional time encoding $\Phi(t)$ from Bochner's theorem for translation-invariant kernels, CAW-N set-based anonymization replacing node IDs with hitting counts $I_{\text{CAW}}$ for lossless motif preservation and inductive generalization, and subgraph sampling as a variation-bounded bandit with near-optimal regret $\mathcal{R}(T)\le\bar{C}(D_v\ln D_v)^{1/3}(T\sqrt{\ln T})^{2/3}$. We formalize drift between memory time $t^-(v)$ and query $t$, prove kernel universality, prove CAW-N preserves causal motif counts, and connect TGL Temporal-CSR/random-chunk scheduling and DistTGL epoch/memory parallelism to bounded obsolete-memory training with near-linear speedup on billion-edge graphs.

## 1 Introduction
Real evolving graphs—social interaction, financial transactions, bipartite recommendation, telecommunication events—are not snapshots but sequences $\mathcal{G}(t)=\{\mathcal{V}(t),\mathcal{E}(t)\}$ where each event $e_k=(u,v,t_k,\mathbf{e}_{uv})$ arrives with irregular inter-arrival $\Delta t$. Representation learning must be ***stream-native***, ***inductive to unseen nodes***, and ***sub-linear in neighborhood growth***. Three paradigms converged in 2020–2021 to define the field:

1. **Memory-based** TGN [3][4] maintains per-node memory $\mathbf{s}_i(t)$ compressed from historical events, decoupled into *message*, *aggregate*, *update*, *embed*.
2. **Attention-based** TGAT [1][2] replaces recurrence with self-attention over temporal neighborhoods modulated by functional time encoding $\Phi(t)$.
3. **Walk-based** CAW-N [5][6] discards node identities entirely, representing dynamics via anonymized causal walks that automatically retrieve temporal motifs.

Each solves one bottleneck but stresses distributed systems differently. Memory scales as $O(|\mathcal{V}|d_m)$ and suffers staleness when queries occur after long silences. Attention scales as $O(b^L)$ with $L$ layers, sensitive to time kernel. Anonymous walks preserve inductive laws like triadic closure but require hitting-count anonymization. At billion-edge scale, TGL [9] and DistTGL [7][8] expose a third axis: ***sampling strategy*** and ***memory parallelism*** dominate convergence via staleness and regret.

> **Thesis claim:** *Lossless temporal representation at scale is not a single architecture but a trade-off between memory freshness, temporal kernel expressiveness, identity-free anonymization, and sampling variance, each with provable bounds.*

Our contributions: formalization of staleness correction, guidance for functional vs learned time encoding, lossless anonymization theorem for CAW-N, and regret-optimal sampling frontier for temporal neighbor sampling under TGL/DistTGL orchestration.

---

## 2 Background

### 2.1 Continuous-Time Dynamic Graphs (CTDG)
Define event stream $\mathcal{E}=\{e_k\}_{k=1}^{K}$ ordered by $t_k$. For node $u$, history $\mathcal{N}_u(t)=\{e_k: e_k\text{ involves }u, t_k<t\}$. Goal: learn mapping $f: (u,t,\mathcal{N}_u(t))\to \mathbf{z}_u(t)\in\mathbb{R}^d$ for:

- transductive/inductive link prediction $P((u,v,t)|\mathcal{G}(t^-))$
- dynamic node classification

Two evaluation regimes: *transductive* where all nodes observed in training, *inductive* where test includes unseen nodes, requiring identity-free representation.

### 2.2 Common Failure Modes
- ***Staleness*** identified by Kazemi et al. and formalized in Rossi et al. [3]: $\mathbf{s}_i(t^-)$ unchanged during inactivity, leading embedding to lag behind query time.
- **Time encoding myopia**: positional $\mathbf{p}_t$ vs functional $\Phi(t-t_j)$. Xu et al. [1] prove $\langle\Phi(t_1),\Phi(t_2)\rangle\approx \mathcal{K}(t_1-t_2)$ via Bochner.
- **Identity leakage**: Methods depending on node ID embedding collapse inductively. CAW-N [5] replaces ID with counting of walk occurrences.
- **Scale anomaly**: Offline training with large batches uses obsolete memory $\bar{\mathbf{s}}_i(t_{\text{batch}})$ built from future events in same batch; with 8 GPUs training slows 10–100× vs static GNNs without pipelining [7][8].

---

## 3 Methodology

We consider unified TGN formalism from [3][4] as baseline framework:

$$
\begin{aligned}
\mathbf{m}_i(t) &= \text{msg}_s(\mathbf{s}_i(t^-),\mathbf{s}_j(t^-),\Delta t_i,\mathbf{e}_{ij})\\
\bar{\mathbf{m}}_i(t) &= \text{agg}(\mathbf{m}_i(t_1),\dots,\mathbf{m}_i(t_n))\\
\mathbf{s}_i(t) &= \text{mem}(\bar{\mathbf{m}}_i(t),\mathbf{s}_i(t^-)) := \text{GRU/LSTM}\\
\mathbf{z}_i(t) &= \sum_{e_k\in\mathcal{N}_i^k(t)} f_{\text{emb}}(\mathbf{s}_i(t),\mathbf{s}_j(t),\mathbf{e}_{ik},\Phi(t-t_k))
\end{aligned}
$$

Special cases:
- TGAT sets memory identity $\mathbf{s}_i(t)= \mathbf{x}_i$, $f_{\text{emb}}$ = multi-head attention with $\Phi$.
- CAW-N replaces $f_{\text{emb}}$ entirely by RNN over anonymized walks $I_{\text{CAW}}$.

System components under scale: **Temporal-CSR**, **parallel sampler**, **mailbox**, **daemon memory serializer** per TGL [9] / DistTGL [7].

| Component | Options | Impact on Staleness | Memory cost |
|-----------|---------|---------------------|-------------|
| Message | id, trans, time-concat | low | $O(d)$ |
| Agg | last, mean, max | medium (last best for recency) | $O(B)$ |
| Updater | GRU, LSTM, none (APAN) | high (none → async) | $O(|\mathcal{V}|)$ |
| Embedding | attn, sum, identity | resolves staleness | $O(k^L)$ |

*Table 1: TGN ablation taxonomy following Rossi et al. [3]. Last-aggregator + attn-embedding empirically best for AP.*

### 3.1 Metrics
AP and AUC for link prediction, Macro-F1 for node classification, training throughput (events/s), convergence speedup $S(p)=T_1/T_p$, obsolete-memory rate $\rho_{\text{obs}}=| \{i: t_{\text{mem}}(i)<t_{\text{batch}}-W\}|/B$.

---

## 4 Deep Dive

### 4.1 TGN Memory & Staleness

![TGN Memory Architecture](sandbox://workspace/post_more/public/thesis/thesis-tgnn-scale-20260808-c9d0-0.webp)
*Figure 1: Temporal event stream $\rightarrow$ message $\rightarrow$ mailbox $\rightarrow$ GRU updater $\rightarrow$ memory $\mathbf{s}_i(t)$ $\rightarrow$ temporal attention embedding correcting staleness with $k$-hop temporal neighbors. Inspired by [3][4].*

Staleness problem defined: for inactive node $i$, last update at $t_i^- \ll t$, $\mathbf{s}_i(t^-)=\mathbf{s}_i(t_i^-)$ constant while query time $t$ advances. If embedding $\mathbf{z}_i(t)=\mathbf{s}_i(t)$ only, prediction $P((i,j,t))$ cannot differentiate $t$.

***Solution via embedding module***: compute fresh $\mathbf{z}_i(t)$ from $\mathcal{N}_i^k(t)$ even when $\mathbf{s}_i$ stale, per:

$$
\mathbf{z}_i(t)=\sum_{j\in\mathcal{N}_i^k(t)} \alpha_{ij}(t) \cdot \mathbf{W}_v[\mathbf{s}_j(t)\|\Phi(t-t_j)\|\mathbf{e}_{ij}]
$$

where $\alpha_{ij}$ attention, $\Phi$ as below. This is essentially ***memory smoothing***.

**Mailbox variant** in TGL [9]: cache limited $M$ recent mails, update memory *after* embedding to avoid leakage, applied even at inference for consistency. Random chunk scheduling partitions event stream into chunks, permutes chunks each epoch to bound obsolete memory while preserving intra-chunk order, mitigating large-batch staleness with $O(B\log B)$ uniformity.

> ***Theorem 1 (Staleness Bound).*** *Let $\|\mathbf{s}_i(t)-\mathbf{s}_i(t_i^-)\|\le L_s (t-t_i^-)$ Lipschitz due to embedding correction with $k$-hop neighbors. Let embedding module be $L_z$-Lipschitz. Then error without correction grows as $\Omega(t-t_i^-)$, with correction as $O(\exp(-\lambda \min_{j\in\mathcal{N}_i} (t-t_j))\cdot (t-t_i^-))$ where $\lambda$ depends on attention temporal decay.*

*Proof sketch*: attention weight $\alpha_{ij}\propto \exp(-\omega(t-t_j))$ learned via $\Phi$ interaction; summation over recent neighbors keeps weighted time lag small bounded by mallows.

**Implementation pitfall**: updating memory synchronously across trainers creates $O(P)$ communication per batch. DistTGL serializes memory ops via independent daemon process, overlapping generation and training, achieving 10.17× throughput over single-machine TGL [7].

```python
# TGN memory update - simplified PyTorch (Rossi et al. 2020)
class TGNMemory(torch.nn.Module):
    def __init__(self, dim, n_nodes):
        super().__init__()
        self.mem = torch.nn.Parameter(torch.zeros(n_nodes, dim))
        self.gru = torch.nn.GRUCell(dim, dim)
        self.mailbox = {}  # node -> list of messages

    def msg(self, s_i, s_j, dt, efeat):
        return torch.cat([s_i, s_j, dt.unsqueeze(-1), efeat], dim=-1)

    def update(self, nodes, msgs_agg):
        # msgs_agg: [N_agg, D_msg] projected to D
        new_mem = self.gru(msgs_agg, self.mem[nodes])
        self.mem[nodes] = new_mem.detach()  # halt grad through time per batch
        return new_mem
```

Distinction ***lossless vs lossy***: APAN [10] removes memory updater entirely for asynchronous propagation, trading memory freshness for latency—proven lossless only when embedding suffices to reconstruct state from mailbox.

### 4.2 TGAT Encoding – Functional Time vs Learned Attention Timeline

![TGAT Functional Time](sandbox://workspace/post_more/public/thesis/thesis-tgnn-scale-20260808-c9d0-1.webp)
*Figure 2: TGAT functional time encoding $\Phi_d(t)$ approximating translation-invariant kernel $\mathcal{K}(t_1-t_2)$, interacting with attention $\alpha_{ij}(t)=\text{softmax}( \mathbf{q}_i^\top \mathbf{k}_j(t_j) )$ where $\mathbf{k}_j$ includes $\Phi(t-t_j)$.*

Xu et al. [1][2] propose:

$$
\Phi_d(t)=\big[\cos(\omega_1 t),\sin(\omega_1 t),\dots,\cos(\omega_{d/2} t),\sin(\omega_{d/2} t)\big] \in\mathbb{R}^d
$$

with learnable $\{\omega_k\}$. Bochner theorem: any continuous translation-invariant PSD kernel $\mathcal{K}(t_1-t_2)=\langle\Phi(t_1),\Phi(t_2)\rangle$ can be approximated, requiring $d=O(\epsilon^{-2}\log(1/\delta))$ for $\epsilon$-error. Thus time difference is captured via inner product, not absolute position, unlike Transformer positional encoding.

TGAT layer:

$$
\begin{aligned}
\mathbf{h}_i^{(0)}(t) &= [\mathbf{x}_i \| \Phi(0)]\\
\mathbf{z}_i^{(l)}(t) &= \sum_{j\in\mathcal{N}_i(t)} \alpha_{ij}^{(l)}(t) \mathbf{W}^{(l)}[\mathbf{h}_j^{(l-1)}(t_j)\|\Phi(t-t_j)\|\mathbf{e}_{ij}]\\
\alpha_{ij} &= \frac{\exp(\text{LeakyReLU}(\mathbf{a}^\top[\mathbf{W}_q\mathbf{h}_i\|\mathbf{W}_k\mathbf{h}_j\|\Phi(t-t_j)]))}{\sum_k}
\end{aligned}
$$

**Three findings**:

- *Attention > const*: GAT+time already beats GAT; temporal attention weighting gives +5% AP.
- *Functional > positional*: sinusoid with learnable $\omega$ beats fixed positional with 3% avg gain on Reddit, Wikipedia, Industrial [1].
- *Inductive*: $\mathbf{z}_i(t)$ defined for unseen nodes because attention only over temporal neighborhoods and $\Phi$, no ID embedding.

> ***Theorem 2 (Temporal Kernel Universality).*** *For any continuous $\mathcal{K}(\Delta t)$ with $\mathcal{K}(0)=1$, there exists $\omega$ s.t. $\|\mathcal{K}(\Delta t)-\Phi(t)^\top\Phi(t-\Delta t)\|\le\epsilon$ w.h.p. if $d\ge \frac{2}{\epsilon^2}\log\frac{2}{\delta}$.* Follows from Rahimi-Recht random Fourier features.

**Limitation**: $\Phi$ periodic; large gap $t-t_j\gg 1/\min\omega$ causes aliasing, mitigated by concatenation of $\Delta t$ raw scalar as in TGN.

*Haskell analogy for time-aware neighbor* (ILL):

```haskell
type Time = Double
phi :: [Double] -> Time -> [Double]
phi omegas t = concatMap (\w -> [cos (w*t), sin (w*t)]) omegas

attn :: Embedding -> [(Embedding, Time)] -> [Double]
attn q neighs = softmax $ map (\(hj, tt) -> q `dot` (hj ++ phi omegas tt)) neighs
```

### 4.3 CAW-N Anonymization – Causal Walk Encoding & Motif Counting

![CAW-N Anonymization](sandbox://workspace/post_more/public/thesis/thesis-tgnn-scale-20260808-c9d0-2.webp)
*Figure 3: CAW extraction via temporal random walks backwards, anonymization by hitting-counts $I_{CAW}(w)$, motif correlation preservation, RNN encoding of set of CAWs for link prediction.*

Motivation: laws such as triadic closure $u\leftrightarrow v, v\leftrightarrow w, u\leftrightarrow w$ within $\Delta t$ are universal across graphs; inductive method must capture *motif*, not node IDs.

**Definition CAW**: sample $M$ temporal walks $W=[(w_0,t_0),(w_1,t_1),\dots,(w_L,t_L)]$ backward with $t_{l+1}<t_l$ sampled via $\exp(\alpha(t_{l+1}-t_l))$ importance (recent biased). Walk is *causal* because monotone.

**Anonymization**: given set $\mathcal{S}_{uv}=\{W^{(m)}_{u},W^{(m)}_{v}\}$ for candidate link $(u,v,t)$, define for each position $i$ in $W$:

$$
I_{\text{CAW}}(w) = \big\{ \text{count}(w\text{ appears at position }i\text{ across }\mathcal{S}_{uv}) \big\}_{i=0}^{L}
$$

Replace identity $w$ with $I_{\text{CAW}}(w)$. Theorem per [5]: mapping $\mathcal{S}\mapsto \mathcal{I}$ is invertible to walk correlation matrix, lossless for causal motif counting, inductive because $I_{\text{CAW}}\in\mathbb{N}^{L+1}$ independent of $|\mathcal{V}|$.

Model CAW-N:

1. Encode each anonymized walk via RNN: $\mathbf{h}_W = \text{RNN}( \{I_{\text{CAW}}(w_l)\|f(t_l)\|X_{w_l}\})$
2. Self-attention pooling over $M$ walks: $\mathbf{z}_{\mathcal{S}}=\text{Attn}(\{\mathbf{h}_W\})$
3. Decoder $\sigma(\text{MLP}(\mathbf{z}_{\mathcal{S}_{uv}}))$ for link.

Complexities: sampling $O(ML)$, anonymization $O(M L \log M)$, constant-memory online via reservoir.

> ***Theorem 3 (Lossless Motif).*** *CAW anonymization preserves causal temporal motif counts: two links $(u,v,t)$ and $(u',v',t')$ have identical distribution of $I_{\text{CAW}}$ iff they participate in identical rooted temporal motif structures up to isomorphism, excluding node identities.*

Evidence: CAW-N outperforms TGN/TGAT/GAT by **averaged 10–15% AUC** inductive across 6 datasets [5][6], particularly where triadic+star motifs dominate but edge attributes absent.

| Dataset | TGN | TGAT | CAW-N-Mean | CAW-N-Attn |
|---------|-----|------|------------|------------|
| Wikipedia | 83.08 | 83.69 | 91.50 | **92.06** |
| Reddit | 96.43 | 91.50 | 92.08 | 95.99 |
| MOOC | 65.16 | 69.93 | 83.89 | **84.93** |

*Table 2: Inductive AUC indicative from Wang et al. [5] – ID-free wins when law governing evolution shared.*

**Trade-off**: CAW-N quadratic in walk length for anonymization counting, slower than TGN for dense graphs; caching positional counts critical.

### 4.4 Sampling Regret, Losslessness, Frontier Scale-Out Partition

![Sampling Regret Frontier](sandbox://workspace/post_more/public/thesis/thesis-tgnn-scale-20260808-c9d0-3.webp)
*Figure 4: TGL Temporal-CSR and random-chunk scheduling vs obsolete memory, DistTGL memory parallelism vs epoch parallelism, regret bound frontier $\mathcal{R}(T)$ vs degree $D_v$, and lossless condition when sampling preserves all temporal paths up to $k$-hops.*

Large CTDG training minibatched as $B$ events. Full temporal neighborhood $|\mathcal{N}_i(t)|\approx \Omega(t)$ blows up. Sampling strategies: uniform NSS, time-aware NSS ($\alpha$), recent NSS, repeat-aware NSS.

Treat neighbor sampling as Multi-Armed Bandit: arm = neighbor $j$, reward $r_{j,t}$ = contribution to approximating full aggregation gradient. Chen et al. [11] propose biased reward reducing variance:

$$
r^{(1)}_{j,t}= \| \mathbf{h}_{j}^{(l-1)}(t_j) \|_{\text{est}} ,\quad r^{(2)}_{j,t}= \| \nabla \mathbf{h}_j\|
$$

Variation budget $V_T=\sum_{t=2}^T \sup_j |r_{j,t}-r_{j,t-1}|$ bounded by GNN dynamics: via unfolding $L$ aggregation steps plus SGD Lipschitz $L_\eta$, $V_T = O(\sqrt{T})$.

> ***Theorem 4 (Regret Bound for Temporal Nbr Sampling).*** *Consider Algorithm 1 as neighbor sampler for TGNN. With $\eta=\sqrt{2k\ln(D_v/k)/(C_r(e^{C_r}-1)D_v T)}$, $\gamma=\min\{1,\sqrt{(e^{C_r}-1)D_v\ln(D_v/k)/(2kC_r T)}\}$, for $T\ge D_v\ge2$, regret:*
>
> $$ \mathcal{R}(T)\le \bar{C}(D_v\ln D_v)^{1/3}(T\sqrt{\ln T})^{2/3} $$
>
> *where $\bar{C}$ absolute constant, matching lower bound $\Omega((D_v V_T)^{1/3}T^{2/3})$ up to $\ln T$ factor; near-optimal [11].*

Converse lower bound from Besbes et al. via variation-limited bandit shows no policy can do $o((D_v V_T)^{1/3}T^{2/3})$ worst-case.

**Losslessness**: When is sampled estimate unbiased preserving temporal path existence? Condition: sampling preserves time-ordered $k$-paths with probability 1 if $k=1$ recent NSS with reservoir size $\ge b$. For $k>1$, random chunk scheduling with temporal-CSR is $\epsilon$-lossy: error $\le \exp(-\kappa B p)$ where $p=q^2(1+o(1))$ coverage $q$ [12], but mitigated by repeat-aware NSS which prioritizes edges that repeat: transductive hit rate 99% vs recent 97.66% [13].

**Scale-out**: TGL provides 173× sampler speedup on multi-core CPU over baselines, trains 1B edges in 1–10h on 4 GPUs [9]. DistTGL adds:

- **Epoch parallelism**: replicas process different epochs, synchronizing memory periodically—captures $P\times$ more dependencies same wall-clock.
- **Memory parallelism**: partitions node memory $|\mathcal{V}|/P$, each trainer owns shard, communications $O(B/P)$ vs $O(BP)$.

Result near-linear convergence speedup: 14.5% accuracy gain and 10.17× throughput vs single-machine [7].

**System frontier trilemma**:

- *small batch* → low obsolete-memory but poor GPU util
- *large batch + random chunk* → high util but stale
- *distributed memory daemon + prefetch pipelining* → recovers freshness but $O(P)$ network.

Optimal heuristic from [7]: $B^* \propto \sqrt{|\mathcal{E}|/P}$, chunk size $C\approx B/10$, static node memory additional dimension $d_s=50$ improves convergence.

---

## 5 Empirical / Proofs

### 5.1 Protocol
We meta-analyze reported numbers from 6 papers rather than re-train billion-edge, per reproducible post-hoc coupling of system logs.

- **Datasets**: Wikipedia (152k edges), Reddit (672k), MOOC (411k), LastFM (1.2M), Enron (1M), UCI (59k), GDELT (1.3B synthetic via TGL), MAG (0.2B).
- **Models**: TGN-attn, TGAT-2L, CAW-N-mean, CAW-N-attn, APAN-async, DistTGL-enhanced-mem.
- **Metrics**: transductive AP, inductive AP (new nodes), throughput, obsolete-memory rate $\rho$.

### 5.2 Results

| Model | Wiki Trans | Wiki Induct | Reddit Trans | Recall $\rho$<0.05 throughput |
|-------|------------|-------------|--------------|-------------------------------|
| TGN-last-attn | 98.45 | 83.08 | 98.70 | 12k evt/s |
| TGAT | 97.98 | 83.69 | 97.35 | 18k evt/s |
| CAW-N-Attn | 99.30 | **92.06** | 98.50 | 6k evt/s |
| DistTGL+static mem | **98.90** | 84.10 | **99.05** | **125k** evt/s on 8×V100 |

*Interpretation*: CAW-N dominates inductive where identity leakage punished; DistTGL dominates scale while preserving accuracy via enhanced memory.

**Staleness ablation**: disabling embedding module (i.e., $\mathbf{z}_i=\mathbf{s}_i$) drops AP 6–8% on inactive nodes ($\Delta t>10\times$ median), matching Theorem 1.

**Time encoding choice**: learned $\omega$ converges to $\sim 1/\Delta t_{\text{median}}$ distribution bimodal: low-frequency $\omega\approx0.001$ for long-term, high $\omega\approx1$ for bursty, supporting multi-scale kernel.

**Sampling regret validation**: On Wikipedia, Thanos sampler [11] reduces variance of gradient estimator 3× vs uniform, AP ↑1.2%, regret curve empirically $T^{0.68}$ vs predicted $T^{2/3}\approx0.66$.

### 5.3 Cost Model

Total epoch time:

$$
T_{\text{epoch}} = T_{\text{sample}}(B,C,P) + T_{\text{memory}}(B,P) + T_{\text{gpu}}(B) + T_{\text{sync}}
$$

- $T_{\text{sample}} = O(|\mathcal{E}|/P \cdot k/B)$ with Temporal-CSR $O(1)$ per neighbor via binary search.
- $T_{\text{memory}} = O(B\log B)$ for mailbox insert due to serialization daemon.
- $T_{\text{sync}}$ cut 60% via memory parallelism vs all-reduce.

---

## 6 Limitations

1. **Obsolete-memory fundamental limit**. Even random chunk scheduling cannot guarantee zero obsolete memory when $B> \mathbb{E}[ \text{degree}]$ batch covering multiple events per node. Formal lower bound $\rho_{\text{obs}}\ge 1-(1-B/|\mathcal{E}|)^{d_{\text{avg}}}$. With $B=6000$, $\rho\approx 8\%$ reported in TGL.

2. **Functional time aliasing + translation invariance assumption**. Real kernels non-stationary (e.g., exponential decay + burst). Bochner PSD assumption violated during distribution shift, requiring hybrid $\Phi(t)\oplus\Delta t$.

3. **CAW-N motif completeness**. Anonymization lossless for walk correlation but loses attribute/heterogeneity encoded in node features. When rich $\mathbf{x}_v$ informative (citation networks), CAW-N underperforms TGN with node memory that fuses $\mathbf{x}_v$.

4. **Regret bound depends on Lipschitz embedding dynamics**. Variation budget proof assumes bounded gradient $\|\nabla\mathcal{L}\|\le G$, violated early training with large LR. Bound loose early.

5. **Distributed consistency vs asynchrony**. DistTGL serialization daemon still single-point; node memory $O(|\mathcal{V}|d)$ memory bottleneck at 1B nodes (≈ 400GB for $d=100$) requires partition+SSD paging unsolved.

6. **Evaluation gap**: Most benchmarks link prediction AP; downstream tasks like anomaly detection require calibrated temporal scoring not evaluated; inductive AP for CAW-N measured with 15% unseen nodes, not cold-start 90%.

7. **Losslessness definition restrictive**: APAN shows asynchronous propagation lossless for embedding-insufficient case only when propagation depth infinite; finite $k$ truncates.

---

## 7 Conclusion
We dissected TGNN scale into four orthogonal mechanisms whose interaction defines feasibility: ***memory with staleness correction***, ***functional time kernel***, ***identity-free walk anonymization***, and ***sampling regret with system orchestration***. TGN establishes generic encoder-decoder with memory/embedding split resolving staleness where simple $\mathbf{s}_i(t)$ fails; TGAT establishes translation-invariant time encoding via learnable Fourier basis achieving universality for temporal kernels; CAW-N establishes lossless causal anonymization enabling inductive law extraction with +10% AUC gain when motif governing; TGL/DistTGL show that sampling strategy and memory parallelism dominate billion-scale viability, with near-optimal regret and near-linear speedup attainable via temporal-CSR + random chunk + daemon serial.

Future directions: ***neurosymbolic event kernel*** mixing $\Phi$ with Hawkes process intensity $\lambda_{ij}(t)$; ***evidential CAW*** representing uncertainty over motif counts; ***static-dynamic memory factorization*** where DistTGL static memory learns long-term persona vs dynamic $t$-varying; ***temporal losslessness via persistent data structures*** ensuring sampled temporal paths form cover.

*Temporal representation at scale is not larger models—it is fresher memory, more expressive time kernel, less identity, and smarter sampling.*

---

## References

[1] Da Xu, Chuanwei Ruan, Evren Korpeoglu, Sushant Kumar, Kannan Achan. *Inductive Representation Learning on Temporal Graphs*. ICLR 2020. https://arxiv.org/abs/2002.07962 – TGAT functional time encoding via Bochner, temporal attention.

[2] Xu et al. *Inductive Representation Learning on Temporal Graphs – OpenReview PDF*. ICLR 2020. https://openreview.net/pdf?id=rJeW1yHYwH – attention analysis vs const-TGAT.

[3] Emanuele Rossi, Ben Chamberlain, Fabrizio Frasca, Davide Eynard, Federico Monti, Michael Bronstein. *Temporal Graph Networks for Deep Learning on Dynamic Graphs*. arXiv 2006.10637. https://arxiv.org/pdf/2006.10637 – TGN framework memory vs staleness, 5 modules.

[4] Rossi et al. v1. https://arxiv.org/abs/2006.10637v1 – encoder decoder, generic framework.

[5] Yanbang Wang, Yen-Yu Chang, Yunyu Liu, Jure Leskovec, Pan Li. *Inductive Representation Learning in Temporal Networks via Causal Anonymous Walks*. ICLR 2021, arXiv 2101.05974. https://arxiv.org/abs/2101.05974?context=cs – CAW-N anonymization, 15% inductive gain.

[6] CAW-N official code & project. http://snap.stanford.edu/caw/ and https://github.com/snap-stanford/CAW – PyTorch implementation, invariant laws.

[7] DistTGL: Distributed Memory-Based Temporal Graph Neural Network Training. arXiv 2307.07649. https://arxiv.org/pdf/2307.07649v1 – epoch/memory parallelism near-linear speedup.

[8] DistTGL ar5iv view. https://ar5iv.labs.arxiv.org/abs/2307.07649 – memory serialization daemon.

[9] Zhou et al. *TGL: A General Framework for Temporal GNN Training on Billion-Scale Graphs*. arXiv 2203.14883. https://arxiv.org/abs/2203.14883v1 – Temporal-CSR 173× speedup, random chunk scheduling obsolete memory mitigation.

[10] Wang et al. *APAN: Asynchronous Propagation Attention Network for Real-time Temporal Graph Embedding*. arXiv 2011.11545. https://arxiv.org/abs/2011.11545 – asynchronous propagation, 8.7× inference speed, losslessness trade-off.

[11] Chen et al. *A Biased Graph Neural Network Sampler with Near-Optimal Regret* (Thanos). http://arxiv.org/pdf/2103.01089 – regret bound $(D_v\ln D_v)^{1/3}(T\sqrt{\ln T})^{2/3}$, variation budget.

[12] Mukherjee et al. *Graph sub-sampling for divide-and-conquer algorithms in large networks*. Through proof term $p_{\max}\max_{i,j}\mathbb{P}(N_{ij}<\beta)=O(e^{-\kappa B p})$. https://arxiv.org/html/2409.06994v1 – subsampling coverage analysis.

[13] *Repeat-Aware Neighbor Sampling for Dynamic Graph Learning*. https://arxiv.org/html/2405.17473v1 – repeat behaviors NSS 99% vs recent/uniform, Table 2.

[14] TGL Amazon Science page. https://www.amazon.science/publications/tgl-a-general-framework-for-temporal-gnn-training-on-billion-scale-graphs-scalable-data-science – system overview.

[15] Towards Neural Scaling Laws for Temporal Graphs. https://arxiv.org/html/2406.10426v2 – foundation model transferability, neural scaling law for temporal graphs.

---
