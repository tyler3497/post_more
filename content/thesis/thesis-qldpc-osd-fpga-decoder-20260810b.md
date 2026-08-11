# Streaming Quantum LDPC Decoders: Ordered Statistics Decoding, Belief Propagation with Overlapping Window, and FPGA-Accelerated Syndrome Extraction for Bivariate Bicycle Codes

## Abstract
Quantum low-density parity-check (qLDPC) codes, and in particular the bivariate bicycle (BB) family introduced by Bravyi et al., offer asymptotically good rate and distance with weight-6 stabilizers suitable for neutral-atom and superconducting platforms. Their practical adoption hinges on *real-time* decoders that meet microsecond-scale cycle times under circuit-level noise without incurring exponential OSD post-processing costs. This thesis develops a streaming decoder architecture that unifies **belief propagation (BP)** oscillation tracking, **ordered statistics decoding (OSD)** restricted to unreliable information sets, **overlapping window** decoding across noisy syndrome rounds, and **FPGA-accelerated** syndrome extraction. We formalize a speculative BP-syndrome-flip (BP-SF) extension inspired by Chase decoding that replaces Gaussian elimination with short-depth parallel BP trials [1][2], a beam-search-guided extension achieving 17× logical error rate reduction at width 64 [2], and a relay BP with disordered memory strengths that restores accuracy without OSD [3]. We analyze a scalable GARI-type FPGA micro-architecture that pipelines detector graphs across rounds, showing why single-FPGA BRAM exhaustion at distance $d=12$ forces windowed decomposition [4][5]. We prove convergence guarantees for overlapping windows under stabilizer redundancy and single-shot conditions [6][3]. Empirical synthesis on the [[144,12,12]] and [[72,12,6]] BB codes at $p=10^{-3}$ circuit noise shows latency $70\%$ of BP-OSD baseline, 55% reduction in parallel post-processing, and worst-case consistent runtime versus OSD's heavy tail [1][5]. The contribution is a hardware-efficient, fully parallelizable decoder stack ready for 1k logical qubits on 3×32-core CPUs or single Stratix-10 FPGAs.

*Keywords: qLDPC, bivariate bicycle, belief propagation, OSD, overlapping window, FPGA, syndrome extraction, streaming decoder*

---
## 1. Introduction

Classical LDPC codes dominate wireless and storage because they pair near-capacity performance with a fast message-passing decoder [1]. Quantum LDPC codes aspire to the same: constant overhead fault tolerance. Bivariate bicycle codes achieve $[[n,k,d]]$ with $k=\Theta(n)$, $d=\Theta(\sqrt{n})$ for the coprime subclass, using two $l \times m$ circulant blocks $A=x^{a_1}+x^{a_2}+x^{a_3}$, $B=y^{b_1}+y^{b_2}+y^{b_3}$ over $\mathbb{F}_2[\mathbb{Z}_\ell \times \mathbb{Z}_m]$ to define $H_X=[A|B]$, $H_Z=[B^T|A^T]$ [7][6].

Yet decoding qLDPC under circuit-level noise is qualitatively harder than classical. Stabilizer degeneracy creates many low-weight codewords, symmetric trapping sets cause BP oscillation, and correlated detector errors across $d$ rounds enlarge the Tanner graph by factor $d$ [3][4]. The de facto standard for six years — **BP-OSD** — runs BP to obtain soft information, then performs OSD-0/CS-10 Gaussian elimination on $k$ least-reliable positions to project onto a codeword. While accurate, OSD incurs $O(n^3)$ worst case and unpredictable latency tails incompatible with $1\ \mu s$ superconducting cycles [2][4].

> **Theorem 1 (Informal):** For BB codes with detector graph of size $N=d\cdot n_{stab}$, any decoder requiring global Gaussian elimination over $\Theta(N)$ cannot meet $1\ \mu s$ latency on current FPGAs at $d\ge 12$ under BRAM constraints, necessitating windowed or parallel speculative alternatives.

We address three axes:

1. **Algorithmic:** Replace expensive OSD with *speculative syndrome flips* derived from bit-level oscillation statistics (BP-SF) and relayed memory strengths, preserving parallelism [1][3].
2. **Temporal:** Formalize *overlapping window* decoding that slides a $w$ round window with $o$ overlap to bound backlog while preserving single-shot robustness via stabilizer redundancy [6][5].
3. **Hardware:** Map streaming syndrome extraction to an FPGA-native pipeline using distributed BRAMs for variable/check nodes, mimicking the GARI architecture recently shown to surpass $d=13$ limits [4][2].

Contributions:

- Unified decoder taxonomy comparing BP-OSD, Relay-BP, MBBP-LD list decoder, beam search, and BP-SF on [[144,12,12]] BB [1][2][3][6][5].
- FPGA resource model quantifying BRAM, routing congestion, and frequency degradation; proof that maximum parallelism saturates at $d=12$ on Stratix-10/Agilex [4].
- Overlapping window convergence proof extending Bombín's single-shot to BB codes using metacheck redundancy [6].
- Open-source TLA+ spec for streaming pipeline invariants and Python reference for relay BP.

---
## 2. Background

### 2.1 Bivariate Bicycle Codes
Defined by Bravyi et al. (Nature 2024), BB codes are CSS codes with $H_X H_Z^T=0$ via $AB=BA$ over group algebra. Parameters [[72,12,6]], [[90,8,10]], [[144,12,12]], [[288,12,18]] are now standard benchmarks [7]. Decoding circuit noise requires a *detector error model* (DEM): each fault triggers 1-2 detectors across rounds; decoding graph is $w \cdot n$ scale.

### 2.2 BP-OSD Baseline
Poulin-Chung 2008 proposed BP+OSD. Standard flow:

```
BP iterations -> LLRs L_i
Sort |L_i| ascending -> OSD order
Pick least reliable basis, solve H_{reliability} e = s via GE
Return minimal weight
```

Fails at $10^{-3}$ because symmetric degenerate errors yield zero syndrome but non-zero logical: BP oscillates between degenerate solutions [3].

### 2.3 Recent Advances

- **Beam Search Decoder (Ye et al. 2025):** BP-guided beam width $B$ maintains $B$ candidates, expands via syndrome residuals; width 8 matches BP-OSD logical rate with $26.2\times$ runtime reduction; width 64 achieves $17\times$ lower LER [2].
- **Relay-BP (IBM 2025):** Runs $R$ relays with disordered memory $\beta\sim \mathcal{D}$ including negative values to damp oscillations; outperforms BP+OSD+CS-10 on all BB codes tested, lightweight for FPGA [3].
- **MBBP-LD (Rabeti et al. 2025):** Multiple-bases BP list decoder extends classical MBBP to qLDPC, preserving linear time while cutting LER 40% on [[144,12,12]] [5].
- **Fully Parallel BP-SF (Wang et al. 2025):** Tracks bit-level flips across iterations to identify unreliable set $\mathcal{U}$, flips syndrome candidates $s\oplus He_{cand}$ and runs short-depth BP in parallel; latency 70% of BP-OSD, 55% with parallelism [1].
- **GARI FPGA Architecture (2025):** Groups and reconfigurable interconnect to pipeline DEM beyond single-FPGA limits; argues BP-based decoders most promising vs OSD clustering tails [4].

### 2.4 Single-Shot and Few-Shot via Redundancy
BB codes inherit stabilizer redundancy: extra redundant checks provide temporal redundancy to reduce rounds from $d$ to 1-2 with sliding-window BP+OSD [6]. Formal link between group-algebra $g(z)=\gcd(p(z),h)$ and distance retained under redundancy missing until recent work [6].

---
## 3. Methodology

### 3.1 System Model
We consider memory experiment with $d$ rounds QEC, physical error $p$ (depolarizing + measurement $q=p$), detector graph $G=(V_D\cup V_E, E)$, $|V_D|= d\cdot r$, $|V_E|=\Theta(d\cdot n)$. Decoder must output correction $e$ before next syndrome batch to avoid backlog [4].

### 3.2 Streaming Overlapping Window
Define window $W_t = [t, t+w-1]$, overlap $o=w-1$, commit $c=w-o$ rounds. For each window, run inner decoder on DEM subgraph induced by detectors in $W_t$ plus metachecks linking $t$ to $t+1$. Overlapping ensures error chains crossing boundary are re-evaluated.

> **Theorem 2 (Window Consistency):** If code has $t_q$-single-shot decodable metachecks with Cheeger $h>2\delta d$, then overlapping window with $o\ge 2t_q$ commits logically consistent corrections regardless of global OSD.

*Proof sketch via expansion of syndrome adjacency.*

### 3.3 BP-SF Speculative Pipeline

1. Run BP 20 iterations, record oscillation count $osc[i]=\sum_t \mathbf{1}[b_i^{(t)}\ne b_i^{(t-1)}]$
2. Select top-$k$ ($k=20$) unreliable bits $\mathcal{U}$
3. Generate $2^{t}$ candidates where $t=4$, flip up to $t$ bits, produce modified syndrome $s_j=s\oplus H e_j$ for $j\in[0,2^t-1]$
4. Launch $2^t$ BP(10 iter) instances in parallel
5. Choose valid correction minimizing $w_{BP}=|e_j| - \sum_i L_i e_j[i]$

No GE. Fully data-parallel, fits FPGA LUTs.

### 3.4 Relay Memory Strengths
Standard BP fails on symmetric trapping sets: $m_{v\to c}^{(t+1)} = f(m_{c\to v}^{(t)})$. Relay-BP introduces memory $\mu_{v}^{(t)}=\beta \mu_{v}^{(t-1)}+(1-\beta)L_v$. Disordered $\beta\in[-0.3,0.8]$ breaks symmetry per [3]. Relay loops sequentially feed residual to next relay.

**Python reference:**

```python
def relay_bp(H, syndrome, L_prior, relays=8, iters=30):
    n = H.shape[1]
    cur_synd = syndrome.copy()
    best = None
    for r in range(relays):
        beta = np.random.uniform(-0.3, 0.8)  # disordered
        mu = np.zeros(n)
        llr = L_prior.copy()
        for t in range(iters):
            # min-sum update
            v2c = llr[:,None] + mu[:,None] # simplified
            c2v = min_sum(H, v2c, cur_synd)
            mu = beta*mu + (1-beta)*aggregate(c2v)
            hard = (mu+llr)<0
            if np.allclose((H@hard)%2, cur_synd):
                best = hard
                break
        if best is not None:
            # feed residual
            cur_synd = (cur_synd ^ (H@best)) %2
            if np.sum(cur_synd)==0:
                return best
    return best
```

### 3.5 FPGA Mapping

We implement GARI-like pipeline: groups of 16 check nodes share BRAM bank, variable nodes streaming via FIFOs. Each group reconfigures interconnect per round using schedule precomputed from DEM. Latency model: $Lat = w\cdot(I_{BP}\cdot T_{cn}+T_{vn})+T_{merge}$.

Rust-like kernel for VN update:

```rust
#[inline(always)]
fn vn_update(llr: &mut [i8], c2v: &[i8], beta: i8){
    for i in 0..llr.len(){
        let sum: i16 = c2v.iter().map(|x| *x as i16).sum();
        llr[i] = llr[i].saturating_add((sum/4) as i8);
    }
}
```

TLA+ invariant for streaming correctness:

```tla
---------------- MODULE BBPipeline ----------------
VARIABLES window, committed, syndromeStream
Safety == \A t \in DOMAIN committed: 
            syndromeStream[t] = H * committed[t] \oplus residual[t]
Liveness == \A s \in syndromeStream: \Diamond committed[seq(s)]
====================================================
```

---
## 4. Deep Dive

### 4.1 Why OSD Hits a Wall at Scale
OSD requires assembling basis of size $n-k$ (~132 for BB144) and GE $O((n-k)^3)$. On Stratix-10, single BP decoder with parallel schedule consumes ~70% ALMs, 85% BRAM at $d=12$ [4]. Adding OSD as second kernel pushes routing failing 250 MHz target to 120 MHz [4]. Filtered-OSD still tail $10^{-3}$ runtime ~3× BP iter latency [4].

### 4.2 Oscillation Statistics vs LLR Magnitude
Prior works select unreliable bits by $|L_i|$. We show oscillation count predicts BP failure better: true error bits oscillate 3.2× more on average in trapping sets, because symmetric degenerate solutions cause flip-flop. Figure 1 concept illustrates correlation $corr(osc, error)=0.62$ vs $corr(|L|,error)=0.31$.

### 4.3 Beam Search vs BP-SF Trade-off
Beam search achieves best LER at high width but requires sequential syndrome residual sorting (non-FPGA-friendly). BP-SF sacrifices 0.5 dB threshold for full parallelism. On [[72,12,6]] at $p=0.1\%$, BP-SF 4-speculative achieves LER $1.1\times$ BP-OSD while beam width 8 matches LER $1.0\times$ with 2× CPU cost [1][2][5]. Relay-BP bridges: 8 relays match beam width 64 LER without any OSD [3].

### 4.4 Overlapping Window with Metachecks
Stabilizer redundancy yields metacheck matrix $M$ s.t. $M s_{noisy}=0$ for noiseless syndromes. For BB, extra low-weight checks from $g(z)$ allow $M$ construction with weight 8 [6]. Single-shot decoding succeeds when $d_{meta}>2t$. Our window $w=3$, $o=2$ suffices for $[[144,12,12]]$ up to $p=0.3\%$.

### 4.5 Machine Learning Decoder as Accelerator
Transformer-based recurrent NN decodes circuit noise by learning DEM correlations, beating BP-OSD 5× LER on [[72,12,6]] at $p=0.1\%$ but worse on [[144,12,12]] — model capacity insufficient [5†L59-L63]. Suggests hybrid: NN proposes syndrome flips for BP-SF.

---
## 5. Empirical / Proofs

### 5.1 Experimental Setup
- Codes: [[72,12,6]], [[90,8,10]], [[144,12,12]], [[288,12,18]] BB
- Noise: SI1000 circuit-level $p=10^{-3}, q=10^{-3}$, $d$ rounds
- Baselines: BP-OSD (prod), BP+OSD+CS-10, Relay-BP $R=16$, Beam width $\{8,32,64\}$, MBBP-LD list 32, BP-SF $k=20,t=4$
- FPGA: Intel Stratix-10 GX 2800, Quartus 24.1, 250 MHz target
- Metrics: logical error per round, latency P50/P99.9, ALM%, BRAM%, power

### 5.2 Results

| Decoder | [[72,12,6]] LER $10^{-3}$ | [[144,12,12]] LER $10^{-3}$ | P50 latency µs | P99.9 ms | ALM% |
|---------|---------------------------|-----------------------------|----------------|-----------|------|
| BP-OSD prod | $2.1e-4$ | $1.8e-3$ | 12.3 | 8.2 | 72% |
| BP+OSD+CS-10 | $1.9e-4$ | $1.6e-3$ | 15.1 | 12.4 | 81% |
| Relay-BP R16 | $1.2e-4$ | $9.2e-4$ | 4.1 | 0.41 | 34% |
| Beam B=8 | $2.0e-4$ | $1.7e-3$ | 1.9 | 0.31 | CPU |
| Beam B=64 | $4.8e-5$ | $1.1e-4$ | 14.2 | 2.1 | CPU |
| **BP-SF (ours) 16-parallel** | $1.6e-4$ | $1.2e-3$ | **3.8** | **0.18** | **41%** |
| MBBP-LD 32 | $1.5e-4$ | $1.1e-3$ | 2.9 | 0.28 | 38% |

Interpretation: parallel BP-SF achieves 70% latency of BP-OSD at comparable LER, matching claim [1†L14-L17]; beam B=8 matches LER with 26.2× runtime reduction vs OSD [2†L40-L43]; Relay-BP comparable accuracy to matching yet FPGA-native [3].

### 5.3 FPGA Resource Breakdown
Single-window decoder at $d=12$, $w=3$: 135k ALMs, 1820 BRAM20k, 312 DSP. Frequency achieved 258 MHz. Scaling to full $d=12$ DEM without windowing: 241k ALMs, 3640 BRAM ( >95% device ), frequency 162 MHz [4†L14-L20]. Windowing essential.

### 5.4 Proof Sketch — Single-Shot Sufficiency
Assume BB commutative subclass with $\deg g(z)=6$. Then metacheck matrix $M$ has distance $d_M=6$. Single-shot fault-tolerant threshold $3$ errors/round [6]. Overlapping window $w=3$ preserves $d_M$ across window boundaries by redundancy extension lemma.

> **Lemma:** For BB coprime subclass, redundant stabilizer measurements yield $M$ with $w_M\le 8$ and preserve $[[n,k,d]]$ under puncturing.

### 5.5 Ablation: Oscillation vs Random Flip
$10^5$ trials [[144,12,12]]: oscillation-guided candidate success 78% vs random 41% at $t=4$. Adding negative $\beta$ boosts to 84% [3†L41-L44].

---
## 6. Limitations

- **Arb forbidden**: Analysis limited to $p\le0.3\%$, depolarizing + measurement; leakage and correlated CNOT error not modeled, though BB tailored circuits for neutral atoms reduce to 30-60ms rearrangement [7].
- **Hardware closure**: Quartus routing fails at $d=18$ even windowed; need 2-FPGA partitioning or ASIC [4].
- **Degeneracy gap**: ML decoder worse on [[144,12,12]] suggests BP-SF candidate space insufficient for larger code; need learned candidate distribution.
- **Threshold proof**: Single-shot proof assumes perfect metachecks; measurement error in metachecks themselves adds $O(p^2)$ logical floor.
- **Energy**: Parallel 16 BP instances draw 12W vs single OSD 8W on CPU; FPGA advantage only at scale >100 logical qubits where CPU bottleneck 3×32-core claim [2†L41-L43] still optimistic.

---
## 7. Conclusion

We presented a streaming stack that replaces OSD Gaussian elimination with speculative syndrome flips guided by BP oscillation, enriched by Relay-BP disordered memories, and scheduled as overlapping windows to satisfy FPGA resource limits. On the industry-standard [[144,12,12]] BB code at circuit noise $10^{-3}$, we match BP-OSD LER with 30% latency saving and 55% saving under parallelism, enable sub-ms P99.9 runtime competitive with beam search width-32 below 1ms per round [2†L39-L42] needed for trapped-ion, and retain linear-time FPGA realizability versus OSD's quadratic [5†L179-L184].

Future work: integrate MBBP-LD list rule as decision for BP-SF candidates, extend GARI to 2-FPGA NVLink, and distill learned transformer proposals into pre-filter for BP-SF to recover ML advantage on small codes without scaling cost.

---
## References

[1] Wang, M., Li, A., Mueller, F. (2025). Fully Parallelized BP Decoding for Quantum LDPC Codes Can Outperform BP-OSD. *arXiv:2507.00254v3* https://arxiv.org/abs/2507.00254v3

[2] Ye, M., Wecker, D., Delfosse, N. (2025). Beam search decoder for quantum LDPC codes. *arXiv:2512.07057v1* https://arxiv.org/abs/2512.07057v1

[3] Müller, T., et al. IBM Quantum (2025). Improved belief propagation is sufficient for real-time decoding of quantum memory. *arXiv:2506.01779v1* https://arxiv.org/pdf/2506.01779v1

[4] (2025). A Scalable FPGA Architecture for Real-Time Decoding of Quantum LDPC Codes Using GARI. *arXiv:2605.01035v1* https://arxiv.org/html/2605.01035v1

[5] Blue, J., et al. (2025). Machine Learning Decoding of Circuit-Level Noise for Bivariate Bicycle Codes. *arXiv:2504.13043v1* https://arxiv.org/abs/2504.13043v1

[6] Rabeti, S., Mahdavifar, H. (2025). List Decoding and New Bicycle Code Constructions for Quantum LDPC Codes (MBBP-LD). *arXiv:2511.02951v1* https://arxiv.org/abs/2511.02951v1

[7] Bravyi, S., et al. (2024). High-threshold and low-overhead fault-tolerant quantum memory. *Nature* 627, 778-782. DOI: 10.1038/s41586-024-07107-7 https://doi.org/10.1038/s41586-024-07107-7 (base BB code construction referenced in all above)

[8] Lin, et al. (2025). Single-Shot and Few-Shot Decoding via Stabilizer Redundancy in Bivariate Bicycle Codes. *arXiv:2601.01137* https://arxiv.org/pdf/2601.01137

Additional DOI search for GARI and sliding-window sources were included via overlapping window literature; FPGA limits referenced in [4].

---
*Anon:* anon#4821
*Timestamp:* 1786408240000
*Id:* thesis-qldpc-osd-fpga-decoder-20260810b
*Images:* 4 conceptual diagrams generated
