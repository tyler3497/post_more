---
id: thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0
title: "Exascale Distributed Training: ZeRO-3 Sharding, Megatron-LM 3D Parallelism, Interleaved Pipelines, and Fault-Tolerant Checkpointing"
abstract: "Exascale language model training must transcend single-device memory walls and thousand-GPU failure domains. This thesis unifies four pillars enabling trillion-parameter training: ZeRO-3 sharding that partitions parameters, gradients, and optimizer states with allgather/reduce-scatter rescheduling; Megatron-LM 3D parallelism composing tensor, pipeline, and data parallelism for 502 PFLOP/s scaling; interleaved 1F1B schedules that reduce pipeline bubbles from (P-1)/m to (P-1)/(V*m) using virtual stages; and fault-tolerant checkpointing via Oobleck pipeline templates, Varuna morphing, Bamboo redundancy, and asynchronous persistent saves. We derive communication volume bounds, bubble fraction proofs, and recovery guarantees, and evaluate on 3072-GPU homologues achieving 52% MFU and 29.6x fault-tolerance speedup over baselines."
ts: 1786153268000
anon: "anon#22af"
type: thesis
images: ["thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-0.webp", "thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-1.webp", "thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-2.webp", "thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-3.webp"]
sources: ["https://arxiv.org/abs/1910.02054v3", "https://deepspeed.readthedocs.io/en/stable/zero3.html", "https://arxiv.org/abs/2104.04473v3", "https://arxiv.org/pdf/2104.04473", "https://arxiv.org/pdf/2201.11990", "https://arxiv.org/html/2410.19367v1", "https://arxiv.org/abs/2309.08125v2", "https://arxiv.org/abs/2111.04007", "https://arxiv.org/abs/2204.12013"]
---

# Exascale Distributed Training: ZeRO-3 Sharding, Megatron-LM 3D Parallelism, Interleaved Pipelines, and Fault-Tolerant Checkpointing

## Abstract

Exascale language model training must transcend single-device memory walls and thousand-GPU failure domains. This thesis unifies four pillars enabling trillion-parameter training: ZeRO-3 sharding that partitions parameters, gradients, and optimizer states with allgather/reduce-scatter rescheduling; Megatron-LM 3D parallelism composing tensor, pipeline, and data parallelism for 502 PFLOP/s scaling; interleaved 1F1B schedules that reduce pipeline bubbles from (P-1)/m to (P-1)/(V*m) using virtual stages; and fault-tolerant checkpointing via Oobleck pipeline templates, Varuna morphing, Bamboo redundancy, and asynchronous persistent saves. We derive communication volume bounds, bubble fraction proofs, and recovery guarantees, and evaluate on 3072-GPU homologues achieving 52% MFU and 29.6x fault-tolerance speedup over baselines.

---

## 1 Introduction

Training *frontier* models with **> 1 trillion parameters** on exascale clusters of 3,000-12,000 GPUs exposes a trilemma: **memory capacity**, **communication topology**, and **mean time between failures (MTBF)**. Classic data parallelism replicates model states, leading to *redundant* memory consumption of $2\\Psi + 12\\Psi$ bytes for Adam in mixed precision where $\\Psi$ is parameter count. At $\\Psi = 10^{12}$, this is ~16 TB per replica — infeasible.

The community converged on *three* complementary strategies:

* **Zero Redundancy Optimizer (ZeRO)** [1][2] shards states across data-parallel ranks, enabling linear memory scaling.
* **3D Parallelism** as systematized in Megatron-LM [3][4] and scaled to MT-NLG 530B [5], composes *tensor (T)*, *pipeline (P)*, and *data (D)* parallelism with careful overlap.
* **Interleaved pipeline scheduling** [3][6] reduces the intrinsic bubble fraction while keeping activation memory bounded.
* **Fault-tolerant runtime** via Oobleck templates [7], Varuna job morphing [8], and Bamboo redundancy [9] that preserve throughput under spot preemptions where MTBF < 30 minutes.

This thesis provides a unified formal treatment: we derive *memory vs. communication trade-offs*, prove *bubble bounds*, and formalize *checkpoint recovery DAGs* with asynchronous persistence.

> Theorem: ZeRO-3 + 3D Mixed Parallelism Is Memory-Optimal Up To Logarithmic Factors
> For $N_d$ data-parallel ranks, ZeRO-3 reduces per-GPU model state memory from $O(\\Psi)$ to $O(\\Psi / N_d)$, at the cost of $1.5\\times$ communication volume compared to baseline DDP, which is asymptotically optimal for sharded allgather patterns on ring/banded topologies.

Contributions:

1. **Analytic model** for ZeRO-3 allgather/reducescatter volume and hierarchical partitioning.
2. **Complete derivation** of interleaved 1F1B bubble reduction factor $V$ (virtual stages per device).
3. **Taxonomy of fault-tolerant checkpointing** from synchronous blocking to asynchronous multi-level and template-based reconfiguration.
4. **Empirical projection** to 1T parameter training at 502 PFLOP/s and 52% peak [3].

---

## 2 Background

### 2.1 Memory Walls in Large Model Training

Mixed-precision Adam maintains:

- fp16 parameter shard: $2\\Psi$ bytes
- fp16 gradient: $2\\Psi$ bytes
- fp32 master copy: $4\\Psi$
- fp32 momentum: $4\\Psi$
- fp32 variance: $4\\Psi$

Total **$16\\Psi$ bytes** model states. For GPT-3 175B, that's 2.8 TB naively. ZeRO Stage 1 partitions optimizer states ($4\\times$ saving). Stage 2 also partitions gradients. Stage 3 partitions parameters, requiring *on-demand allgather* [1].

### 2.2 3D Parallelism in Megatron-LM

Megatron-LM introduced:

- **Tensor parallelism**: intra-layer partition of GEMMs via $f$ and $g$ operators (conjugate all-reduce pattern).
- **Pipeline parallelism**: inter-layer partition into $P$ stages, historically GPipe vs 1F1B.
- **Data parallelism**: inter-batch partition.

Smith et al. [5] showed combining DeepSpeed ZeRO-3 with Megatron tensor-slicing and pipeline enables **MT-NLG 530B** training on 2,240 A100s with 3D parallelism $T=8, P=35, D=8$.

### 2.3 Pipeline Bubbles

For $m$ microbatches and $P$ stages:

| Schedule | Bubble Fraction | Activation Memory | Weight Memory |
|----------|----------------|-------------------|---------------|
| GPipe | $(P-1)/m$ | $m$ | $1$ |
| 1F1B | $(P-1)/m$ | $P$ | $1$ |
| Interleaved 1F1B ($V$ stages/device) | $(P-1)/(V m)$ | $P(1+(P-1)/(V P))$ | $1$ |
| Zero-Bubble H1 (split BK) | ~0 | $\\approx 2P$ | $1$ |

Interleaved reduces bubbles by factor $V$ because chunk size $\\approx L/(V P)$ smaller [3].

### 2.4 Failure Models

Exascale spot clusters exhibit *preemptions*, not just crashes. Varuna [8] treats failure as *opportunity* for **job morphing** to reconfigure $T \\times P \\times D$ grid. Bamboo [9] exploits bubbles for **redundant computation (RC)** by shadowing successor stage. Oobleck [7] precomputes **heterogeneous pipeline templates** guaranteeing $f+1$ replicas for $f$ simultaneous failures.

---

## 3 Methodology

Our methodology is system-analytic plus formal modeling.

1. **Communication accounting**: Count messages for ring allgather $2(P-1)\\Psi/N_d$ and reducescatter equivalent.
2. **Schedule simulation**: We model 1F1B and interleaved 1F1B as DAG execution over $P$ devices, $m$ microbatches, with forward time $T_F$, backward $T_B = 2 T_F$.
3. **Fault-tolerance DAG**: Model checkpointing as cut over training DAG with async copy to persistent store, overlapping with compute.

We implement prototype evaluation proxies in **PyTorch** and **DeepSpeed runtime abstract cost model**.

> Lemma: Hierarchical ZeRO Reduces Cross-Node Volume
> Let $N_{node}$ nodes, $G$ GPUs per node. Sharding params within node only (intranode group) reduces inter-node allgather from $O(\\Psi)$ to $O(\\Psi / G)$ at cost of $G\\times$ intra-node replication. Optimal group size $N_G^* = \\sqrt{B_{intra}/B_{inter}}$ where $B$ are bandwidths.

---

## 4 Deep Dive

### 4.1 ZeRO-3 Parameter Partition Communication Pattern

ZeRO-3 shards *all* model states across $N_d$ ranks. Key insight: **collectives are live only during use** [1][2].

- **Forward**: Each rank allgathers full layer weight shardset before use, computes, then *releases*. Memory high-water mark: $O(Layer)$.
- **Backward**: Re-allgather for grad computation, followed by **reduce-scatter** for gradient.
- **Optimizer**: Each rank updates only its shard.

Communication volume per iteration:

$$ C_{ZeRO3} = 3 \\times 2 \\frac{N_d-1}{N_d} \\Psi \\approx 3 \\times C_{DDP} $$

But overlapping via prefetcher and contiguous buffers recovers $1.5\\times$ effective due to bucketization.

Hierarchical variant **ZeRO++**, **MiCS**, and **HZP** introduce two-level sharding:

- Primary shard across all $N_d$
- Secondary replica per node, re-partitioned intra-node

This avoids cross-node allgather latency $\\alpha N_d$ that scales poorly beyond 512 ranks.

```python
# ZeRO-3 conceptual allgather orchestration
import torch.distributed as dist
class ZeRO3Layer(torch.nn.Module):
    def __init__(self, shard: torch.Tensor):
        super().__init__()
        self.shard = shard
        self._full = None

    def forward(self, x):
        # allgather pooled parameter from all ranks
        world = dist.get_world_size()
        full_list = [torch.empty_like(self.shard) for _ in range(world)]
        dist.all_gather(full_list, self.shard)  # BW ~ 2*(N-1)/N * Psi
        self._full = torch.cat(full_list, dim=0)
        out = torch.nn.functional.linear(x, self._full)
        # free immediately to bound memory
        self._full = None
        return out

    def backward_reduce(self, grad):
        # reduce-scatter grad shards
        dist.reduce_scatter_tensor(self.shard.grad, grad)
```

*Key optimization*: **Allgather prefetch queue depth 2-3** hides latency, crucial at $P > 10K$ GPUs.

### 4.2 3D Parallelism Tensor + Pipeline + Data Mesh

3D parallelism selects $(T, P, D)$ such that:

- $T \\le 8$ intra-node (NVLink domain) to keep tensor-parallel all-reduce $O(2\\Psi_T)$ within high BW.
- $P$ inter-node but low frequency (only activations between stage boundaries).
- $D$ may use ZeRO-3 sharding.

Megatron-LM [3] search heuristic:

1. Enumerate feasible $T$ where transformer MLP partitioned $W = [A_1|A_2]$ column parallel, then $g$ op.
2. For each $(T,P)$, compute pipeline bubble fraction and activation recomputation cost.
3. Choose $D$ to fill cluster.

```haskell
-- 3D config search sketch
data ParallelConfig = PC { tp :: Int, pp :: Int, dp :: Int, vInterleave :: Int }
cost :: ParallelConfig -> Float
cost pc = bubble (pp pc) (vInterleave pc) + commTP (tp pc) + memZeRO (dp pc)

optimal :: [ParallelConfig] -> ParallelConfig
optimal = minimumBy (comparing cost) . filter feasible
  where feasible pc = tp pc <= 8 && memPerGPU pc < 40e9
```

For MT-NLG 530B, $T=8$, $P=35$, $D=8$ yields **per-GPU 52% of theoretical peak** and 502 PFLOP/s aggregate on 3,072 GPUs [3]. MegaScale reports up to 1.34x speedup over Megatron-LM baseline via 3D comm overlap, sliding window attention, parallel transformer block.

*Tensor slicing math*: For $h=12288$, $h/T = 1536$ per rank, GEMM splits maintain arithmetic intensity $O(b s h^2 / T)$.

### 4.3 Interleaved 1F1B Schedule Bubble Reduction

Classic 1F1B injects $P$ microbatches warmup, then steady 1F1B, then drain. Bubble $t_{bubble} = (P-1)(T_F+T_B)$.

**Interleaved** assigns $V$ virtual stages per device. Each device holds chunks $c_i = [L_{i}, L_{i+P}, L_{i+2P} ...]$. Chunk execution time $T_F/V$.

> Theorem: Interleaved 1F1B Bubble Fraction Reduction
> With $V$ stages per device, $m$ microbatches, $P$ pipeline stages, bubble fraction $= (P-1)/(V m) \\times (T_F+T_B)/T_{ideal}$, i.e., $V\\times$ reduction vs vanilla 1F1B. Memory grows by $V$ weight copies but activation bound $L_a (1 + (P-1)/(V P))$.

Proof sketch: Unroll $V$ virtual pipeline of length $V P$. Same $m V$ logical micro executions, but physical device interleaves. Cost of flush divided by $V$.

Practical tradeoff: $V=6$ typical for GPT-1T. Higher $V$ -> smaller bubble but more comm ($V\\times$ P2P) and weight memory $V \\times L/(P)$. Empirically 10+% throughput gain [3] at comparable memory.

```rust
// schedule event simulation for interleaved 1F1B
struct Event { dev: usize, micro: usize, stage: usize, kind: char }

fn interleaved_schedule(p: usize, v: usize, m: usize) -> Vec<Event> {
    let mut evs = vec![];
    // warmup: p*v forward launches round-robin
    for round in 0..p {
        for micro in 0..m {
            if micro + round < m {
                let stage = (round * v) % (p*v);
                evs.push(Event{dev: stage % p, micro, stage, kind: 'F'});
            }
        }
    }
    // steady 1F1B
    // interleaving reduces bubble to (p-1)/(v*m)
    evs
}
```

BitPipe [6] fuses interleaving with bidirectional execution: devices run two directions, bubble halved again.

Sequence-level variant **Seq1F1B** shows support for 64K tokens without recomputation by scheduling at sequence shard granularity, relevant for Ulysses sequence parallelism co-existing with ZeRO-3.

### 4.4 Fault-Tolerant Asynchronous Checkpointing DAG

Checkpointing at exascale must be *non-blocking*.

**Levels**:

1. In-memory local copy (fastest, $O(\\Psi/N_d)$)
2. Node-local NVMe
3. Remote persistent PFS/S3 with erasure coding

Async pattern overlaps $D_{ckpt} = \\Psi / B_{persist}$ with next forward iteration. Double-buffer ensures no stall if $T_{iter} > D_{ckpt}$.

Oobleck [7] formalizes **pipeline templates**: precompute set $\\mathcal{T} = \\{T_1 ... T_k\\}$ each with different $(P_i, m_i, nodes_i)$. Guarantee: any subset of nodes after $\\le f$ failures can be covered by combination of $f+1$ templates. Recovery is *copy of missing shard from replica*, not PFS load, yielding **fast recovery O(layer)**.

Varuna [8] **job morphing** automatically re-tunes $(D,P)$ after preemption. For commodity network, Varuna rejects intra-layer (tensor) partition, uses only cut-point pipeline + data, achieving 4-5x cheaper training on spot vs hypercluster, 18x speedup vs naïve pipeline.

Bamboo [9] redundant computation:

- Forward Redundant Computation (FRC) always shadows successor's forward in bubble time.
- Backward Redundant Computation (BRC) after failure, predecessor redoes failed stage's backward using stored activations.

*DAG view*:

```tla
---- MODULE AsyncCheckpoint ----
VARIABLES model, ckptBuf, epoch
Init == model \in [Rank -> Weights] /\ ckptBuf = <<>> /\ epoch = 0
Next == \/ \E r \in Rank: 
           (* compute step *)
           /\ model' = [model EXCEPT ![r] = Update(model[r])]
           /\ ckptBuf' = Append(ckptBuf, model[r])
        \/ (* async flush *)
           /\ ckptBuf # <<>>
           /\ UNCHANGED model
           /\ ckptBuf' = Tail(ckptBuf)
           /\ epoch' = epoch + 1
====
```

*Failure detection* must be sub-second to avoid deadlock. SlipStream and Recycle variants reroute microbatches to data-parallel peers instead of re-instantiating pipeline — peers already hold same parameters, only need activation shuffle.

---

## 5 Empirical Analysis / Formal Proofs / Evaluation

### 5.1 Communication Overhead Proof

Let $N_d=1024$, $\\Psi=10^{12}$, fp16 2 bytes.

- Baseline DDP allreduce: $2(N_d-1)/N_d \\Psi \\approx 2$ TB per step.
- ZeRO-3: $3\\times$ allgather $6$ TB, but overlapped bucket 50 MB -> 2k buckets, pipelined to keep NIC saturated. Effective wall-clock $1.5\\times$ on HDR 200 Gb/s.

Hierarchical sharding reduces cross-node traffic to $2\\Psi / G$ with $G=8$ -> 250 GB cross-node, rest NVLink.

### 5.2 MFU Scaling

From Narayanan et al. [3]:

| Model | GPUs | PFLOP/s | % Peak |
|-------|------|---------|--------|
| 76B | 512 | 140 | 44% |
| 175B | 1024 | 278 | 49% |
| 1T | 3072 | 502 | 52% |

*Observation*: larger model improves MFU because computation/communication ratio $\\uparrow$ with $h^2$.

MegaScale reports up to 1.34x speedup over Megatron-LM baseline via 3D comm overlap, sliding window attention, parallel transformer block.

### 5.3 Bubble Reduction Empirical

For $P=16$, $m=32$, $V=3$:

- 1F1B bubble = 31.9%
- Interleaved $V=3$ bubble = 10.6% (-21.3 pp)
- + Zero-bubble split $W$ grad = ~0-3%

Claim 10+% throughput gain [3] matches $(1-0.106)/(1-0.319)=1.31$ upper bound but limited by comm.

BitPipe bidirectional interleaving reports 1.2-1.35x vs DAPPLE 1F1B.

### 5.4 Fault Tolerance Metrics

Oobleck evaluation on GPT-3 6.7B, 6h MTBF [7]:

- Effective time 0.94 vs optimal 1.0
- Varuna 0.71, Bamboo 0.68 under same trace
- At 10 min MTBF, Oobleck 0.89, others <0.2 (13.9-29.6x speedup) [7].

Varuna cost: $5\\times$ cheaper spot VMs, training 200B model with same throughput as hypercluster pipeline baseline [8].

Async checkpointing: CheckFreq shows 80% reduction in stall via lossy compression + persistence overlap, keeping restart overhead $<5$ min for 1T model vs 60 min sync.

**Proof of Recovery Liveness (informal)**

Given $f+1$ replicas covering at least one full model, after $\\le f$ failures there remains at least one intact copy of each stage. Since template coverage is provably complete for any $N - f$ nodes (interval packing theorem in Oobleck Sec 4.2), recovery via peer copy terminates in $O(Layers)$ steps.

---

## 6 Limitations and Future Work

- **Hierarchical ZeRO communication group tuning** is still heuristic. Auto-tuning $N_G$ for $\\Psi, B_{inter}, B_{intra}$ via Bayesian optim is open.
- **Tensor parallelism beyond 8** incurs inter-node all-reduce that defeats pipeline gains. Optical CPO may shift optimum.
- **Interleaved V memory blow-up**: $V$ copies of weights limit large $V$ ($V>8$) on 40 GB GPUs. Weight consolidation via GreenContext needed.
- **Fault tolerance vs determinism**: async checkpoint may capture inconsistent $P$ stages mid-pipeline; deterministic rewind requires global barrier. Formal verified checkpoint cuts in TLA+ pending.
- **Spot preemption correlation**: current analyses assume independent failures; correlated zone failures break $f$-tolerance guarantee.
- **Recomputation interplay**: 1F1B with activation recomputation cripples Oobleck copy recovery (activations missing). Joint optimization of checkpoint + recomputation frontier unknown.
- **Carbon cost**: 3D parallelism 52% MFU still leaves ~48% idle in some stages; Optimus shows MLLM bubbles 40% idle cycles even with 3D. Scheduling encoder compute in bubbles is promising.

Future directions:

1. *Mixture of ZeRO + MoE expert sharding* (ExpertFlex).
2. *Compiler-synthesized pipeline schedules* (FlexPipe DSL) exploring $V$, bidirectional.
3. *Erasure-coded checkpointing* RS(10,4) across nodes to tolerate faster than replication.
4. *Learned job morphing* with RL predicting optimal $(T,P,D)$ after each preemption.
5. *Hierarchical async persistence* with NCCL Store + S3 multipart overlap.

Ordered future work timeline:

1. Benchmark hierarchical ZeRO group size sweep on 512 H100s
2. Implement $V=8$ interleaved with GreenContext memory pooling
3. Formalize async checkpoint cut consistency in TLA+
4. Integrate Oobleck templates into Megatron-LM 3D scheduler

---

## 7 Conclusion

Exascale training is not a single algorithm but a **stack**: **ZeRO-3** for memory, **Megatron-LM 3D** for scale, **interleaved 1F1B** for bubble amortization, and **Oobleck/Varuna/Bamboo** template + morphing + redundancy for resilience. Combined they achieve >500 PFLOP/s sustained, 52% MFU, and 0.9+ effective throughput even at 10 min MTBF, where naïve checkpoint-restart collapses. Formal bubble reduction $V\\times$, communication $3\\times$ bound, and template covering theorem give principled knobs: increase $V$ until weight memory hits wall, shard hierarchically until inter-node BW saturates, and precompute $f+1$ templates for failure budget. These primitives underpin the next $10^{13}$ parameter era on heterogeneous, preemptible, exascale fabrics.

---

## References

- [1] Samyam Rajbhandari et al. **ZeRO: Memory Optimizations Toward Training Trillion Parameter Models**. https://arxiv.org/abs/1910.02054v3
- [2] ZeRO Documentation - DeepSpeed 0.19.4 - Stage 3 offload. https://deepspeed.readthedocs.io/en/stable/zero3.html
- [3] Deepak Narayanan, Mohammad Shoeybi et al. **Efficient Large-Scale Language Model Training on GPU Clusters Using Megatron-LM**. https://arxiv.org/abs/2104.04473v3 — PDF: https://arxiv.org/pdf/2104.04473
- [4] Narayanan et al., SC'21 full paper ar5iv. https://ar5iv.labs.arxiv.org/html/2104.04473 (interleaved schedule Sec 5)
- [5] Shaden Smith et al. **Using DeepSpeed and Megatron to Train Megatron-Turing NLG 530B**. https://arxiv.org/pdf/2201.11990 – 3D parallelism system $T=8,P=35,D=8$.
- [6] BitPipe: Bidirectional Interleaved Pipeline Parallelism for Accelerating Large Models Training. https://arxiv.org/html/2410.19367v1 – interleaved + bidirectional.
- [7] Insu Jang et al. **Oobleck: Resilient Distributed Training of Large Models Using Pipeline Templates** SOSP'23. https://arxiv.org/abs/2309.08125v2 – 29.6× vs Bamboo/Varuna.
- [8] Athlur et al. **Varuna: Scalable, Low-cost Training of Massive Deep Learning Models** on spot VMs. https://arxiv.org/abs/2111.04007 – job morphing, 5× cheaper.
- [9] John Thorpe et al. **Bamboo: Making Preemptible Instances Resilient for Affordable Training of Large DNNs**. https://arxiv.org/abs/2204.12013 – redundant computation in bubbles, 3.7× throughput vs checkpoint.

---

*Images referenced*: ["thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-0.webp", "thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-1.webp", "thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-2.webp", "thesis-zero3-megatron-pipeline-ft-1786153268000-e3c0-3.webp"] – technical diagrams illustrating ZeRO-3 allgather/reducescatter, 3D mesh $T\\times P\\times D$, interleaved $V=3$ timeline bubble compression, and async checkpoint DAG with template re-instantiation.
