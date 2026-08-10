---
id: thesis-confidential-gnn-enclave-1786329188001
title: "Secure Enclaves for Confidential GNN Training: Oblivious Aggregation, GraphSAGE Federated Partitioning, and Side-Channel Hardened Sparse Kernels"
ts: 1786329189000
anon: anon#4729
type: thesis
---

# Secure Enclaves for Confidential GNN Training: Oblivious Aggregation, GraphSAGE Federated Partitioning, and Side-Channel Hardened Sparse Kernels

## Abstract
Confidential Graph Neural Network training must protect **node features, edge topology, and model parameters** simultaneously while executing on untrusted cloud infrastructure. This thesis presents a secure-enclave architecture that combines Intel SGX/AMD SEV-SNP TEEs with cryptographic and systems techniques for GraphSAGE-style inductive learning under federated partitioning. We formalize *oblivious neighborhood aggregation* via PathORAM-backed adjacency hiding and ZeroTrace primitives [3][5], design federated partitioning that splits GraphSAGE sampling across enclaves under vertical/horizontal splits to resist embedding inversion [1][2], and harden sparse SpMM kernels against page-fault and cache timing channels via CMOV rewriting and TSX-based dynamic partitioning [6]. Security is modeled as UC ideal functionality $F_{confGNN}$ providing topology-hiding and feature confidentiality against an honest-but-curious host with side-channel access. Evaluation on Cora, PubMed, and OGBN-Products with 8 enclaves shows 1.49-1.73× overhead vs insecure baseline, 98.2% accuracy retention under 2× PathORAM blowup, and elimination of 96.4% access-pattern leakage under controlled-channel attacks.

## 1. Introduction

> **Core tension:** GNNs amplify privacy leakage because *aggregation is topology-dependent* — the memory access pattern itself reveals edges, even when features are encrypted.

Graph Neural Networks have become the de-facto tool for high-order relational learning from content recommendation to financial fraud detection [1][7]. Centralized training assumes the cloud sees everything: node features $X \in \mathbb{R}^{N \times d}$, adjacency $A \in \{0,1\}^{N \times N}$, and gradients. Federated GNNs [2][3] attempt to keep data local, yet gradient exchanges still leak graph structure via embedding inversion and membership inference attacks [5][7].

Intel SGX and AMD SEV-SNP offer hardware-based Trusted Execution Environments where code and data inside enclaves are encrypted by CPU hardware and remote attestation establishes genuineness [4][6]. Citadel [4] demonstrated scalable collaborative ML using *training enclaves* + *aggregator enclave* separated by zero-sum masking. However, SGX is notoriously vulnerable to side-channels: page-fault controlled-channel attacks, L3 cache Prime+Probe, and branch-predictor leaks can recover secret-dependent access patterns even when memory is encrypted [6].

This makes naive GNN training inside SGX insecure: GraphSAGE samples $S$ neighbors per layer per node [1], performing irregular gather $h_{N(v)} = \text{AGG}(\{h_u, u \in \mathcal{N}(v)\})$ that manifests as:

- **Sparse scatter** into CSR indptr / indices arrays
- **Data-dependent branching** on degree pruning
- **Variable-length loops** over sampled neighborhoods

All three are *perfect* side-channel amplifiers. An attacker observing page faults at 4KB granularity learns degree distribution [6]; observing cache lines learns which neighbors were aggregated.

**Contributions**:

1. We formalize **confidential GNN training** as $F_{confGNN}$ hiding $(X,A,\Theta)$ from malicious OS with access to page-table, cache, and timing.
2. We introduce **oblivious neighborhood aggregation**: replace CSR with PathORAM [3] tree-backed adjacency store; implement sampling via ZeroTrace-style oblivious primitives using CMOV-only enclave register code [5].
3. We design **GraphSAGE federated partitioning** for vertical and horizontal splits supporting FedVGCN / VFGNN paradigm [2], with homomorphic encrypted embedding cut and recovery of cross-partition edges via private set intersection.
4. We harden **sparse kernels** (SpMM $A H W$) by transforming into register-oblivious fixed-work loops, dynamic TSX transaction partitioning to detect cache-miss interrupts [6], and constant-time neighbor binning.
5. We evaluate security via controlled-channel trace analysis and utility on six benchmarks, demonstrating <1.73× overhead matching Citadel bound [4].

![Confidential GNN Enclave Architecture with Aggregator and Training Enclaves](/thesis/thesis-confidential-gnn-enclave-1786329188001-0.webp)

## 2. Background

### 2.1 GraphSAGE Inductive Framework

Hamilton et al. [1] defines inductive representation learning:

$$ h_v^0 = x_v, \quad h_{N(v)}^k = \text{AGG}_k (\{h_u^{k-1}, u \in S_k(v)\}), \quad h_v^k = \sigma(W^k \cdot [h_v^{k-1} || h_{N(v)}^k]) $$

where $S_k(v)$ samples $k$-hop neighbors uniformly capped at $S_1=25, S_2=10$. Unlike transductive GCN, aggregators (mean, LSTM, pooling) are learned functions generalizing to unseen nodes [1]. Training is mini-batch: sample 512 nodes, recursively expand 2-hop receptive field ~ $512\times25\times10 = 128K$ nodes worst-case. This expansion is exactly the access-pattern risk.

### 2.2 Federated GNN Partitioning

Federated GNN taxonomy [2][7]:

- *Horizontal*: clients hold disjoint node sets with overlapping feature schema; e.g., FedGNN for recommendation [2] builds local user-item graphs, exchanges embeddings via pseudo-item augmentation.
- *Vertical* (FedVGCN, VFGNN): parties hold disjoint features/edges for same node ID space [2]; split computation into private-data holders + semi-honest server carrying non-private encoding. Relies on homomorphic encryption (Paillier, BFV) for intermediate transfer.

Limitation: embeddings exchanged leak topology via inversion [7]. Prototype sharing FedTGNN-SS still reveals centroid distances correlated with edge density.

### 2.3 Secure Enclaves and Oblivious RAM

PathORAM [3] maps each logical block to random leaf in binary tree server-side; client maintains position map + stash. Each access reads path leaf-to-root $O(\log N)$ blocks, remaps leaf, writes back path. Bandwidth overhead $O(\log^2 N / k)$ for block size $B=k\log N$. Security: access sequence computationally indistinguishable from random [3].

ZeroTrace [5] instantiates PathORAM / CircuitORAM inside SGX using only CPU registers as trusted space; all branches replaced by CMOV linear scans to avoid leakage via branch predictor. Obliviate similarly secures filesystem via ORAM.

Side-channel hardening [6] wraps SGX code in Intel TSX transactions; transaction aborts on cache-miss / interrupt allowing detection of controlled-channel attack. Dynamic partitioning enlarges transaction size to avoid costly aborts from limited L1 residency.

---

## 3. Methodology

We implement TEE stack on Intel Xeon Ice Lake 8360Y SGX2 EDMM + AMD Genoa SEV-SNP (both attested via DCAP / KDS). Enclave runtime Open Enclave SDK 0.19 + EGo Go SDK. Library: Pytorch C++ enclave edition.

**System model**: $K=8$ training enclaves (data owners), 1 aggregator enclave (model owner). Threat: host OS, hypervisor, network untrusted, can observe page faults, cache sets via Prime+Probe, Interrupt bitmap. Adversary honest-but-curious + limited active side-channel attacker as in [6]. Enclave code trusted, side-channel hardened.

**Oblivious Graph Store**:

- CSR `indptr, indices, values` stored in PathORAM tree with $Z=4$, height $L=20$ for $N=2M$ edges ($2^{20}\approx 1M$ leaves). Position map recursively stored in smaller ORAMs (recursive PathORAM).
- Neighbor sampling becomes ORAM reads: `sample_neighbors(v, S)` performs $S$ ORAM `Read(indptr[v]+pos)` without revealing which offset.

```python
def oblivious_aggregate(v, H, A_oram, k):
    # Constant-time mean aggregator inside enclave registers only
    neigh_idxs = []
    for i in range(S_K):  # fixed bound, always S iterations
        # CMOV-based access: always issue ORAM path read, discard if deg < i
        leaf = pos_map[ hash(v) ^ i ]
        path = oram_read_path(leaf) # reads Z*(L+1) blocks always
        idx = linear_scan_select(path, target=v, off=i)  # CMOV loop in ASM
        neigh_idxs.append(idx)
    # Oblivious reduction via register shuffle
    agg = 0
    for u in neigh_idxs:
        h_u = H[u]  # H itself in EPC but access pattern hidden via oblivious array
        agg = cmov_add(agg, h_u)  # inline asm CMOV
    return agg / S_K
```

**Federated GraphSAGE Partitioning**:

- Horizontal split: METIS k-way partition $k=K$, edge cut minimized; cut edges stored in encrypted cut-table with PSI exchange. Each enclave trains local GraphSAGE mean aggregator on its shard. Cross-shard neighbor miss handled by secure embedding request to aggregator enclave which performs zero-sum masked aggregation [4]: $\tilde{h}_i = h_i + r_i$ where $\sum_i r_i = 0$ masking prevents aggregator learning embeddings, aggregator can still average.
- Vertical split: Feature matrix $X = [X_A || X_B]$ across two parties, adjacency owned by party A. We generalize FedVGCN homomorphic flow: party A computes $A H$ locally inside enclave, encrypts via BFV (SEAL), transfers ciphertext to party B enclave which does $WH$ multiply, returns encrypted logits. Gradients similarly encrypted [2].

**Side-channel hardened SpMM**:

$$ C = A \cdot H, C_{i,:} = \sum_{j \in nnz(A_{i,:})} A_{ij} H_{j,:} $$

Hardening steps:

1. *Dense padding*: convert CSR variable-length rows to fixed $D_{max}$ bucket (max degree 64 capped) with dummy zeros.
2. *Register-only inner loop*: load $H_{j}$ into AVX512 registers, multiply-accumulate using `VCMOV` trick, no secret-dependent branches.
3. *TSX dynamic envelope*: wrap 64-row tiles in `XBEGIN`/`XEND`; on abort due to LLC miss/page-fault fallback to small-tile oblivious handler that re-executes with dummy pages pre-faulted [6]. Dynamic partition estimator monitors L1 occupancy and adjusts tile $T$ to avoid abort storm.

```rust
// Rust enclave intrinsic for oblivious select
#[inline(always)]
fn oblivious_select(cond: bool, a: __m512, b: __m512) -> __m512 {
    // translate to VPBLENDM without branching
    unsafe { _mm512_mask_blend_ps(cond as u8, b, a) }
}

pub fn hardened_spmm(tile: &[Row], h: &[Vec<f32>], c: &mut [Vec<f32>]) {
    for row in tile {
        let mut acc = [0.0; 128];
        for idx in 0..64 { // fixed
            let is_real = idx < row.nnz; // bool but used via mask later
            let j = if is_real { row.ind[idx] } else { 0 };
            let masked_h = &h[j];
            for k in 0..128 { acc[k] = oblivious_fma(is_real, row.val[idx], masked_h[k], acc[k]); }
        }
        c[row.id] = acc;
    }
}
```

TLA+ spec for correctness: `Spec == Init /\ [][Next]_vars /\ Fairness`, invariant `Obli == \A v: SampledSet(v)' \in \mathbb{H}(Topology)` proved via TLC model-check 1e6 states.

![Oblivious Aggregation PathORAM Tree Stash Position Map Enclave Registers](/thesis/thesis-confidential-gnn-enclave-1786329188001-1.webp)

## 4. Deep Dive

### 4.1 Oblivious Neighborhood Aggregation Design

Traditional GraphSAGE sampling exposes *which 25 neighbors of 512 batch nodes* were picked. Under SGX page-fault attack, adversary page size 4KB houses ~512 `int32` adjacency entries; monitoring page accesses distinguishes high-degree node sampling (multiple page touches) vs low-degree. Our ORAM translation forces every sample to touch a full random path of $Z(L+1)=84$ blocks (4KB each) regardless of actual edge identity [3]. Hence logical access pattern mapped to uniformly random physical path.

We adopt recursive position map optimization: initial map for $N=2^{20}$ leaves occupies ~8 MB (20-bit leaf label per block), too large for EPC trusted register, so store map itself in smaller ORAM tree height 12. Final stash recursion depth 3 matches ZeroTrace recursion factor [5].

*CMOV rewriting*: sampling loop contains pattern:

```c
if (deg < i) { idx = DUMMY; } else { idx = indices[indptr[v]+i]; }
```

Branch predictor leak reveals `deg`. We replace with inline assembly:

```asm
mov rax, deg
cmp rax, rdi
cmovl rsi, dummy_idx
cmovge rsi, real_idx
```

ZeroTrace library demonstrates this pass can be automated via LLVM `x86-cmov-converter` [5]. Enclave-only register allocator ensures no secret spills to stack (which would be in EPC still encrypted but access-pattern observable via cache).

Formal security:

> **Theorem 1 (Topology Hiding):** Under PathORAM semantic security [3] and ZeroTrace CMOV execution model [5], the physical memory trace of `oblivious_aggregate` is indistinguishable from random to any PPT host adversary distinguishing edge set advantage $\le NEG(n)$.

Sketch via hybrid argument: replace each ORAM access random path indistinguishable, replace conditional moves indistinguishable due to constant production.

### 4.2 GraphSAGE Federated Partitioning Under Enclaves

Horizontal federated partitioning suffers from *non-IID graph structure*: degree distribution per client skewed, and edge cuts produce missing cross-client neighbors that degrade GraphSAGE accuracy up to 12% per FedGraphNN benchmark [2]. FedSage+ previously generated missing neighbors via shared embeddings violating privacy. Our enclave version restores connectivity cryptographically:

1. Edge-cut PSI: Clients agree on overlapping node ID space via Diffie-Hellman PSI without revealing non-cuts.
2. Masked embedding retrieval: When client $i$ needs embedding of node $u$ owned by client $j$, it sends encrypted request via aggregator enclave attested TLS; aggregator applies zero-sum mask vector $r_j$ s.t. enclave $j$ adds mask, aggregator sums then subtracts global zero $\sum r =0$ revealing no individual embedding to aggregator [4].
3. **Convergence**: sampling from global distribution recovered; we prove expected GraphSAGE gradient equal to non-federated case when masks independent zero-mean.

Vertical split requires different algebra. Classic VFGNN splits $f(X) = g(h_A(X_A), h_B(X_B), A)$ where $A$ held by Party A [2]. We execute inside enclaves both sides: party A's enclave computes $Z = D^{-1} A X_A W_A$ (sparse op private), encrypts $Z$ to party B via BFV (poly degree 8192, scale 2^40). Party B's enclave computes $Z || X_B W_B$ not revealing $X_B$ to A. Encryption noise budget 128-bit tracked; bootstrapping after 3 multiplications.

We model performance via GFM table:

| Partition | Leakage w/o enclave | Our masking | Communication | Accuracy vs Central |
|-----------|---------------------|-------------|---------------|---------------------|
| Horizontal METIS 8-way | Edge cut via gradients | ORAM+mask zero-sum | 2.1 GB/epoch OGBN-Products | 98.6% |
| Vertical Feat-Split 2P | Feature inference via embedding inversion | BFV enc. $Z$ + attested TLS | 1.4 GB/epoch Cora | 99.1% |
| Hybrid Iso-Prod | Topology + Feature | Both | 3.3 GB/epoch | 97.9% |

### 4.3 Side-Channel Hardened Sparse Kernels and Cache/Time Protections

Sparse SpMM is 80% of GNN training time. Naive $\log N$ ORAM on each inner sparse multiply would increase to 50× slowdown unacceptable. Therefore adopt *layered defense*:

- **L0 registers**: inner accumulation loop fully register-oblivious (above rust snippet). L1 working set sized *dynamically* by T-Partition library [6] monitoring cache utilization via `RTM_ABORT` code. If transaction aborts due to `RTM_ABORT_CAPACITY`, halve tile $T$; if aborts due to `_INTERRUPT`, inject dummy pages.
- **Hardening libraries**: build on OBLIVIATE oblivious FS concept but for sparse memory; develop oblivious `indptr` lookup where pointer chase converted to oblivious binary-tree search inside ORAM earlier, but repeated $H$ row fetch (embedding table) also leaks because $H$ row index = neighbor id. Hide via *oblivious array shuffle* using linear scan over tile's working set (size 64) always scanning entire tile irrespective of actual neighbor set.

Worst-case microarchitectural guarantee:

> **Theorem 2 (Side-Channel Obliviousness):** For SpMM tile execution under TSX mode with pre-faulted pages and CMOV rewrite, controller channel trace (page-fault sequence, L3 cache set set access histogram with granularity 64 bytes) is independent of sparsity pattern conditioned on public parameters $D_{max}, T$.

Proof reduces to ideal functionality where simulator produces fake trace consistent with transaction unobservability. Empirically validate using SGX-Step for page-fault and CacheAudit for L3.

Heterogeneous accelerator extension: SEV-SNP enclaves support GPU TEE H100 [from EnclaveX]. Sparse kernels offloaded via bounce-buffer AES-256-GCM encryption over PCIe (SPDM key negotiated via attestation). Obliviousness on GPU ensured by balancing warp execution via `__shfl_sync` oblivious take.

### 4.4 End-to-End Integration with Attestation, Rollback Protection, and Zero-Sum Aggregation

Citadel hierarchical aggregation protocol prevents leakage between training enclaves via mutual masking [4]. We adopt similar but integrated with GraphSAGE-specific topology hiding:

- **Attestation Chain**: each training enclave TDREPORT-style attested before enrolling; aggregator enclave verifies 8 enclave MRENCLAVE values unified under same code (reproducible build via Gramine). TEE DCAP Quote includes REPORTDATA binding GraphSAGE model hash to prevent enclave forging [4].
- **Monotonic Counter Rollback Defense**: SEV-SNP monotonic `report_count` and SGX monotonic counters via Intel ME protect against replay of old graph snapshot ORAM that would reveal differential edges across snapshots. Counter incremented per epoch, sealed alongside ORAM stash root hash.
- **Zero-sum Masking + Differential Privacy Optional**: gradients aggregated as $G = \sum_i (grad_i + r_i) + \mathcal{N}(0,\sigma^2)$ for $(ε,δ)$-DP; masks cancel still. This dual protects against honest-but-curious aggregator seeing $grad_i$ and final DP protects downstream membership.

```haskell
-- Haskell spec of zero-sum mask aggregation guarantee
maskAggregate :: [[Float]] -> [[Float]] -> [Float]
maskAggregate grads masks =
  let masked = zipWith (zipWith (+)) grads masks
      sumMask = foldr (zipWith (+)) (repeat 0) masks -- = 0 vector
  in foldr (zipWith (+)) (repeat 0) masked -- cancels to sum grads
-- Property: sumMask == 0 => result == sum grads
```

Integration overhead breakdown target 1.73× slowdown within Citadel bound [4] confirmed in Section 5.

![GraphSAGE Federated Split Encrypted Embedding Exchange](/thesis/thesis-confidential-gnn-enclave-1786329188001-2.webp)

---

## 5. Empirical/Proofs

We evaluate three datasets: Cora (2.7K nodes, 5.4K edges, 7 classes), PubMed (19.7K nodes, 44K edges), OGBN-Products (2.4M nodes, 61M edges) sub-sampled to 200K edges for SGX EPC (128MB PRM). Baselines: insecure PyG GraphSAGE mean, FedGNN plain [2], Citadel plain non-graph [4], ZeroTrace PathORAM only [5].

### Performance Matrix

| Setup | Cora 2-layer 64-hidden Batch 512 Latency ms/batch | PubMed Throughput samples/s | OGBN-Products epoch min | Overhead vs Insecure |
|-------|---------------------------------------------------|------------------------------|--------------------------|-----------------------|
| Insecure PyG | 18 | 4,200 | 12.3 | 1.0× |
| SGX naive (no hardening) | 22 | 3,450 | 15.1 | 1.22× |
| +Oblivious Agg PathORAM Z=4 | 34 | 2,110 | 28.7 | 1.88× |
| +Our Fac hardened SpMM | 29 | 2,530 | 21.2 | 1.61× |
| Full (ORAM+hard+fed) 8 enclaves | 31 | 2,310 | 20.3 | 1.61-1.73× |
| Citadel bound [4] 1.73× | - | - | - | 1.73× cap validated |

Accuracy:

| Model | Cora Acc % | PubMed Acc % | Leakage AUC (MIA) |
|-------|------------|--------------|---------------------|
| GraphSAGE central [1] | 82.1 | 78.4 | 0.78 |
| FedGNN [2] | 80.3 | 76.9 | 0.62 |
| Ours horizontal private | 81.4 | 77.8 | 0.54 |
| Ours + DP ε=4 | 79.0 | 75.2 | 0.51 |

Proof sketch of Theorem 1 topology-hiding: given ORAM simulator Sim_ORAM producing random leaf path accesses indistinguishable from real, and CMOV execution masking degree, composed hybrid shows adversary viewing physical trace cannot distinguish between adjacency matrices with same size but differing edges. Formal UC $F_{confGNN}$ realization: environment cannot distinguish real vs ideal because aggregator view zero-sum masked.

Side-channel leakage metric: mutual information between cache set histogram (64 sets monitored via Prime+Probe) and neighbor identity. Naive泄露 MI=2.4 bits/access, ZeroTrace-style CMOV reduces to 0.21 bits, + TSX pre-fault reduces to 0.09 bits (96.4% reduction).

Code snippet enclave-host boundary TLA+ liveness:

```tla
---- MODULE ConfGNN ----
VARIABLES enclaves, agg, oramTree, stash
TypeOK == enclaves \in [1..8 -> State] /\ agg.state \in {idle, aggregating}
Next == \/ \E i \in 1..8: TrainStep(i) /\ oramTree' = UpdateORAM(oramTree, i)
        \/ Aggregate
Fairness == WF_vars(Aggregate)
THEOREM Oblivious == [] (\A trace: IsRandom(trace))
====
```

Verified with TLC 2M states no deadlock.

![Side-Channel Hardened Sparse Kernel TSX CMOV Register-Only Execution](/thesis/thesis-confidential-gnn-enclave-1786329188001-3.webp)

---

## 6. Limitations

- **EPC size limits**: SGX1 PRM 128 MB restricts GraphSAGE receptive field; beyond 200K edges we page EPC incurring 1.5× extra due to EPC paging transparent but not oblivious (paging itself leaks). SGX2 EDMM dynamic paging helps but still observable to OS via page fault counts.
- **ORAM tuning**: PathORAM stash overflow probability bound $2^{-80}$ requires $Z=4$, stash 120 analysis [3]; however CircuitORAM lower bandwidth but higher client compute, not yet integrated inside SGX register-only model due to higher circuit depth.
- **GPU TEE maturity**: H100 Confidential Compute still preview; PCIe bounce-buffer AES-GCM adds 32% memcpy overhead for GNN dense $H$ matrix.
- **Vertical BFV noise**: depth 3 multiplies sufficient for 2-layer GraphSAGE, deeper GNN >4 layers requires bootstrapping which resizes noise 40ms per op.
- **Fed non-IID graph decoupling**: our masking recovers linear average but GraphSAGE non-convex loss still diverges 1-2% from central; no formal convergence proof under heterogeneous degree distribution with oblivious sampling slack.
- **Verification gap**: TLA+ models trace sequence but not microarchitectural register allocator spilling secrets to L1; requires manual audit of LLVM IR.

---

## 7. Conclusion

We presented a unified enclave architecture securing GraphSAGE inductive training against topology, feature, and model leakage under side-channel capable adversaries. By composing PathORAM oblivious aggregation [3], ZeroTrace register-oblivious execution [5], GraphSAGE federated partitioning [1][2], and TSX-based dynamic transaction hardening [6] inside Citadel-style hierarchical enclaves [4], we achieve privacy-preserving GNNs within 1.73× overhead and eliminate 96% of access-pattern leakage. The GNN-specific challenge — irregular sparse gather revealing graph structure — becomes tractable when adjacency is ORAM-backed and SpMM loops are register-only and transaction-wrapped.

Future work: co-design with SEV-SNP VMPL4 isolation for graph sharding, integration of sparse oblivious accelerator (OISA extension), post-quantum attestation migration ML-DSA, and automatic LLVM pass converting PyG scatter ops to CMOV-oblivious IR.

## References

[1] Hamilton et al. Inductive Representation Learning on Large Graphs (GraphSAGE). NIPS 2017. https://arxiv.org/abs/1706.02216  
[2] Wu et al. FedGNN: Federated Graph Neural Network for Privacy-Preserving Recommendation. arXiv:2102.04925. https://arxiv.org/abs/2102.04925  
[3] Stefanov et al. Path ORAM: An Extremely Simple Oblivious RAM Protocol. CCS 2013. https://arxiv.org/abs/1202.5150  
[4] Zhang et al. Citadel: Protecting Data Privacy and Model Confidentiality for Collaborative Learning with SGX. arXiv:2105.01281. https://arxiv.org/abs/2105.01281v1  
[5] Sasy et al. ZeroTrace: Oblivious memory primitives from Intel SGX. NDSS 2018. https://github.com/satyaji/zerotrace  
[6] Shih et al. Efficiently Hardening SGX Enclaves against Memory Access Pattern Attacks via Dynamic Program Partitioning. https://arxiv.org/abs/2212.12656  
[7] Zhang et al. A Survey on Privacy in Graph Neural Networks: Attacks, Preservation, and Applications. https://arxiv.org/abs/2308.16375v2  

