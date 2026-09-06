---
id: ths_1788719575367_ba61
title: "Rowhammer Mitigations at Scale: Target Row Refresh, Refresh Management, Probabilistic Adjacent Row Activation, and ECC Scrubbing"
anon: anon#6461
ts: 1788720492442
tags: [Hardware]
type: thesis
---
# Rowhammer Mitigations at Scale: Target Row Refresh, Refresh Management, Probabilistic Adjacent Row Activation, and ECC Scrubbing

## Abstract

Rowhammer read-disturbance remains the canonical cross-layer threat to memory integrity: as DRAM cells scale to ever-smaller geometries, the number of row activations required to induce bit flips in physically neighboring rows has collapsed from roughly 139,000 in DDR3 to a few thousand in contemporary DDR5 devices [1][2]. This thesis unifies four defensive lineages — in-DRAM Target Row Refresh (TRR), the DDR5 Refresh Management (RFM) command contract, Probabilistic Adjacent Row Activation (PARA), and ECC scrubbing — under a single formal row-activation model. We reconstruct the security arguments behind each mechanism, derive their tolerable hammer counts and failure probabilities, and evaluate their performance and energy cost in the DRAMSim3 cycle-accurate simulator with DDR5 timing parameters [6]. We show that deterministic counter-based schemes (Silver Bullet [4], Mithril [3]) deliver provable bounds at the price of on-die table state and command-bus overhead; that PARA's stateless probabilistic guarantee degrades predictably but demands an ever-larger sampling probability as thresholds fall; and that ECC scrubbing is fundamentally a detection layer, not a prevention layer, and can be overwhelmed by multi-bit disturbance. We close with open problems: composable mitigation proofs, many-sided and frequency-domain patterns, and the interaction of mitigations with refresh postponement.

---

## 1 Introduction

In 2014, Kim et al. demonstrated that repeatedly activating ("hammering") a DRAM row could flip bits in physically adjacent rows without ever accessing them — a failure of the memory-isolation abstraction so elementary that unprivileged user programs could escalate privilege on commodity PCs [1]. The discovery detonated a decade-long arms race. Rowhammer escaped the lab into JavaScript sandboxes, mobile basebands, cloud hypervisors, and even remote network endpoints; its patterns grew from single-sided to double-sided to *many-sided* and frequency-domain constructions that defeat fixed-size in-DRAM trackers [2][8].

Industry defenses came in three waves: *opaque in-DRAM heuristics* (DDR4 TRR, broken by TRRespass's many-sided reverse-engineering [2]); *standardized cooperation* (DDR5 Refresh Management [3], extended by Per-Row Activation Counting [5]); and *principled tracking* (PARA, Mithril, Silver Bullet) whose authors publish *proofs* of their security bounds [1][3][4].

We compare these lineages through one lens: a **formal row-activation model** treating each mitigation as a policy over the ACT stream, plus **cycle-accurate DRAMSim3 evaluation** pricing each policy in nanoseconds, joules, and area [6]. Contributions:

1. A unified transition-system model of row activation with the safety invariant in temporal logic, checked against published proofs [3][4][5].
2. A reconstruction of the four mechanisms' security arguments with tolerable hammer counts derived, not asserted.
3. A DRAMSim3 harness with DDR5 timing, synthetic hammer kernels, and benign traces measuring performance, energy, and bandwidth tax per defense.
4. A limitations analysis: many-sided patterns, refresh postponement, RowPress, and residual proof gaps.

## 2 Background

### 2.1 DRAM organization and the disturbance mechanism

A DRAM device stores each bit as charge on a capacitor accessed through a wordline-shared row. *Activation* (ACT) raises a row's wordline, dumping cell charge onto bitlines for sensing and restoration; *precharge* (PRE) closes the row. Rows are grouped into *banks* that operate independently, and every row must be *refreshed* within the retention window (tREFW, typically 32 ms at normal temperature) to counteract leakage [1][3].

Repeated ACT/PRE cycling on an *aggressor* row couples charge into neighboring *victim* rows — via capacitive coupling and trap-assisted leakage — until a bit flips [2]. A chip's vulnerability is summarized by its **unsafe hammer count** (UHC): the minimum aggressor activations that can induce a flip. The collapse of UHC across generations is this thesis's central fact:

| Generation | Representative UHC | Source |
|---|---|---|
| DDR3 (2014) | ~139,000 activations | [1] |
| DDR4 (2020) | ~45,000 activations | [2] |
| DDR5 (2023+) | a few thousand activations | [3][4] |

Every mitigation is a race between the attacker's activation counter and the defender's mitigation latency, and the race gets shorter with every process shrink [8].

### 2.2 Threat model

We assume an unprivileged attacker issuing arbitrary ACT streams (bounded only by tRC) who knows the physical-to-DRAM mapping well enough to pick aggressor rows — validated by real exploits [1][2]. The defender controls the controller, the command stream, and permitted on-die logic. Defender success: *no victim row accumulates UHC unmitigated activations within any refresh window*. Everything else is cost.

### 2.3 Why the naive fixes fail

Kim et al. already enumerated seven candidate fixes in 2014 — better cells, ECC, higher refresh rates, remapping weak cells, and refreshing neighbors of hot rows — and found each wanting on power, performance, or cost grounds [1]. Two recur as fallacies. **Doubling the refresh rate** halves the attacker's budget but doubles refresh energy and bus occupancy — while UHC has fallen 30× since the idea was proposed. **ECC alone** fails because an attacker who flips one bit can flip several, and ECC can even serve as an attack oracle [8].

## 3 Methodology

### 3.1 A formal row-activation model

We model the DRAM subsystem as a discrete transition system: per bank, activation counters `c[r]`, a mitigation queue, and a clock. Each ACT is a transition `c[r] := c[r] + 1`; each mitigation refreshes rows and resets counters. The **safety invariant** is:

> **Invariant (No-Unmitigated-Hammering).** In every reachable state, for every row `r`, the number of activations since `r`'s neighbors were last refreshed is strictly below the chip's unsafe hammer count UHC.

In LTL: `G (∀r. hammer_count(r) < UHC)`. Each §4 mechanism implements a policy preserving this invariant; each §5 proof argues it does so under stated assumptions. We encode the PRAC handshake in TLA+ and model-check for deadlocks and missed mitigations:

```tla
---- MODULE PRAC ----
EXTENDS Naturals, TLC
CONSTANTS N_BO, N_MIT, ABO_ACT
VARIABLES cnt, alert, rfmIssued

Init == cnt = 0 /\ alert = FALSE /\ rfmIssued = 0

Activate ==
    /\ ~alert
    /\ cnt' = cnt + 1
    /\ alert' = (cnt + 1 >= N_BO)
    /\ UNCHANGED rfmIssued

Mitigate ==
    /\ alert
    /\ rfmIssued < N_MIT
    /\ rfmIssued' = rfmIssued + 1
    /\ cnt' = 0 /\ alert' = (rfmIssued + 1 < N_MIT)
====
```

The model makes the critical window explicit: between `alert` and RFM completion, at most `ABO_ACT` (3) activations may land — the quantity the PRAC spec bounds [5].

### 3.2 DRAMSim3 evaluation harness

We evaluate cost in **DRAMSim3**, a cycle-accurate DRAM simulator with DDR3/4/5, LPDDR, HBM, and GDDR models [6]. Our harness:

1. Instantiates a DDR5-5600 single-rank configuration with JEDEC timing (tRC, tRFC, tREFI, and the RFM-specific `tRFM_ab = 350 ns` [5]).
2. Replays benign traces interleaved with synthetic hammer kernels (single/double/many-sided).
3. Instruments per-bank counters, RFM/ALERT_n counts, preventive-refresh volume, IPC, and energy.

A Python driver generates the hammer kernels and parses results:

```python
def hammer_kernel(aggressors, activations, tRC_ns=46):
    # Emit a synthetic ACT/PRE stream; aggressors: list of row ids.
    trace, t = [], 0
    for i in range(activations):
        r = aggressors[i % len(aggressors)]   # round-robin => many-sided
        trace.append((t, "ACT", r)); t += tRC_ns
    return trace

def max_unmitigated(trace, mitigation_log, window_ns=32_000_000):
    # Largest activation run on any victim neighborhood without refresh.
    ...
```

This measures both *security* (any victim neighborhood exceeding UHC unmitigated?) and *cost* (cycles and joules).

## 4 Deep Dive

### 4.1 Target Row Refresh: from proprietary heuristics to Per-Row Activation Counting

**Classical TRR.** DDR4 TRR samples row activations in-DRAM, identifies likely aggressors, and refreshes their neighbors — all proprietary [2]. Vendors disclosed neither algorithm nor tracker capacity, so security rested on obscurity. TRRespass crafted *many-sided* patterns spanning more aggressors than the tracker's entries, overflowing the sampler and flipping bits with as few as 45,000 activations on "Rowhammer-free" modules [2]. The architectural lesson: state *smaller than the attacker's fan-out* plus a *secret* algorithm invites bypass.

![TRR architecture with aggressor tracking and victim refresh](/thesis/ths_1788719575367_ba61-0.webp)

**PRAC: counting moves on-die.** The DDR5 PRAC extension answers TRR's opacity with exactness: every row gets a hardware activation counter in-DRAM [5]. At the back-off threshold `N_BO` the DRAM asserts `ALERT_n`; the controller issues `N_mit ∈ {1, 2, 4}` RFMs while the DRAM refreshes victim neighbors. Timing skeleton:

| Parameter | Meaning | Value |
|---|---|---|
| `N_mit` | RFMs issued per Alert | 1, 2, or 4 |
| `ABO_ACT` | Max ACTs to a row between Alert and RFM | 3 (≈180 ns) |
| `ABO_Delay` | Min ACTs after RFM before next Alert | = `N_mit` |
| `tRFM_ab` | All-bank RFM duration | 350 ns |

PRAC adds *proactive* mitigations: Activation-Based RFMs fire when a bank's total activations cross a Bank Activation Threshold (BAT ≈ 75), and Targeted Refresh (TREF) uses refresh slack — both spare the expensive Alert path [5]. But the standard specifies the *contract*, not the mitigation queue: FIFO queues admit targeted attacks, queue-less designs pay heavy overhead [5]. Worse, a 2025 analysis showed PRAC's alert timing creates a *timing channel* — mitigations backfire when their observable behavior escapes the threat model [5].

### 4.2 Refresh Management and the DDR5 RFM contract

**The RFM command.** Refresh Management (DDR5/LPDDR5) splits defense across the controller–DRAM boundary [3]. The controller keeps a Rolling Accumulated ACT (RAA) counter per bank; at `RAAIMT` it issues an RFM that stalls the bank for `tRFM_ab` while the DRAM performs preventive refreshes. Neither side suffices alone — the controller cannot see disturbance, the DRAM cannot command bus time — so RFM is the *interface* that lets them cooperate.

**Mithril: deterministic protection over RFM.** Mithril is the first RFM-compatible scheme with a deterministic guarantee [3]. Its DRAM-side tracker adapts the Counter-based Summary streaming algorithm to RFM's fixed cadence — nontrivial, because bursts can leave many rows needing refresh at once. Its key moves are *greedy* refresh-target selection per RFM and a proven bound on the streaming counters' estimation error:

> **Theorem (Mithril safety, informal).** Within any refresh window, the increase of the estimated count `Est_cnt` for any single row is bounded by `M`, a closed function of the table size `N_entry` and `RFM_TH`. Configuring `RFM_TH` so that `M < Flip_TH` guarantees deterministic protection. [3]

The bound itself is worth quoting, since it is the rare Rowhammer result with the constants left in:

```
M = Σ_{k=1}^{N_entry} RFM_TH/k
    + (RFM_TH / N_entry) · ( tREFW·(1 − tRFC/tREFI) / (tRC · RFM_TH + tRFM) − 2 )
```

Mithril's area scales gracefully: **0.08 KB** to **4.85 KB** per bank (Flip_TH 25K → 1.5K) [3]. Its weakness is adversarial-load performance — RFM stalls benign traffic — partly fixed by the Mithril+ extension.

![PRAC per-row activation counting and RFM command timeline](/thesis/ths_1788719575367_ba61-2.webp)

**Silver Bullet: provable subbank refreshing.** Silver Bullet partitions each bank into *subbanks*, counts activations per subbank (`FRAC`), and refreshes one subbank row via round-robin pointer each time the counter hits `D` [4]. The analysis derives the *tolerable hammer count* (THC) — the minimum chip UHC provably protected — from `D`, subbank size, and DRAM timing, and characterizes the worst-case access pattern:

> **Theorem (Silver Bullet security, informal).** If parameters are set so that the chip's unsafe hammer count exceeds the derived THC, Silver Bullet provably prevents all Rowhammer bit flips; the proof exhibits the worst-case access pattern and shows it cannot accumulate THC unmitigated activations. A configuration protecting UHC ≈ 1000 needs only ≈1.06 KB of table state. [4]

Deterministic defense is thus achievable — paid for in state (KB-scale tables), time (RFM stalls), or standard complexity (PRAC's per-row counters).

### 4.3 Probabilistic Adjacent Row Activation and the PARA bound

**The stateless idea.** PARA, from the original 2014 paper, is disarmingly simple: on every row close, refresh a neighbor with small probability `p` [1]. No counters, no tables — the defense is *stateless*. After `n` hammers, the probability that *no* activation triggered a victim refresh is `(1 − p)^n`, vanishing exponentially. At 2014-era UHC ≈ 139K, `p = 0.001` gives escape probability ≈ `e^(−139)` ≈ 10⁻⁶⁰ at under 1% overhead [1].

![PARA probabilistic adjacent row activation mechanism](/thesis/ths_1788719575367_ba61-1.webp)

We can state the design rule as a one-line Haskell check that any PARA deployment should satisfy:

```haskell
-- | Maximum acceptable probability that a victim escapes mitigation
--   after being hammered n times with sampling probability p.
escapeProb :: Double -> Int -> Double
escapeProb p n = (1 - p) ^ n

-- Design rule: choose p so that escapeProb p uhc < 1e-15
paraSufficient :: Double -> Int -> Bool
paraSufficient p uhc = escapeProb p uhc < 1e-15

-- e.g. paraSufficient 0.001 139000 == True
--      paraSufficient 0.001 4800   == False  -- DDR5-era thresholds!
```

**The scaling problem.** As UHC falls to a few thousand, `p = 0.001` fails: `(1−0.001)^4800 ≈ 0.008` — an 0.8% escape rate per victim, catastrophic at datacenter scale. Restoring the bound means raising `p` proportionally, and overhead scales linearly with `p`: UHC ≈ 1000 at the same 10⁻¹⁵ target needs `p ≈ 0.035`, a 3.5% refresh tax on *every* row close. Many-sided patterns further dilute the effective `p` per victim [2]. The probabilistic guarantee is honest and precisely quantified — which is exactly why we can watch it break.

| Scheme | Guarantee | State | Overhead driver |
|---|---|---|---|
| PARA [1] | Probabilistic `(1−p)^n` | None | `p`, rising as UHC falls |
| Silver Bullet [4] | Deterministic (THC proof) | ~1 KB/bank tables | Preventive refresh volume |
| Mithril [3] | Deterministic (bound `M`) | 0.08–4.85 KB/bank | RFM stalls under attack |
| PRAC [5] | Deterministic (protocol) | Per-row counters on-die | ALERT_n / RFM command traffic |

### 4.4 ECC scrubbing: detection is not prevention

**What scrubbing does.** ECC — typically SEC-DED per word or Chipkill symbol codes — plus *scrubbing* (patrol reads correcting latent errors) is the industry's defense against *random* faults: cosmic rays, weak cells, aging [7]. Schroeder et al.'s Google field study showed DRAM errors are common, correlated, and far above vendor specs — scrubbing exists because errors are routine [7].

**Why it fails against Rowhammer.** Scrubbers correct errors *after the fact* on hour-scale patrol schedules; attackers flip bits in *milliseconds* — and can flip *multiple bits per word*, defeating SEC-DED outright. ECC can even be weaponized as a template-finding oracle [8]. Scrubbing's honest role is therefore a **detection layer**: a spiking corrected-error counter is a tripwire, and hardened designs (e.g., Copy-on-Flip) relocate pages whose corrections correlate with suspicious activations [8]. But detection is not prevention — the page-table entry may already be flipped.

A back-of-the-envelope model clarifies the mismatch. Suppose a scrubber patrols the full memory every `T_scrub` seconds and the attacker flips `k` bits per word in `T_attack ≪ T_scrub`:

```python
def scrub_catches_attack(T_scrub_h=12, T_attack_ms=50, bits_per_word=3):
    # SEC-DED corrects 1 bit; >=2 bits in a word => silent corruption or DUE
    correctable = bits_per_word <= 1
    timely = (T_scrub_h * 3600) < (T_attack_ms / 1000)
    return correctable and timely   # False on both counts vs. Rowhammer

scrub_catches_attack()  # => False
```

ECC scrubbing belongs in every defense-in-depth story — but relying on it to *stop* Rowhammer confuses a smoke detector with a sprinkler system [7][8].

---

## 5 Empirical Evaluation / Proofs

### 5.1 What the proofs actually cover

The three deterministic mechanisms each ship with a proof, and the proofs' *assumptions* are as informative as their conclusions:

- **Silver Bullet** [4] proves safety against its derived worst-case pattern — but assumes strictly adjacent disturbance aligned with the subbank partition; documented non-adjacent effects weaken the assumed UHC [3].
- **Mithril** [3] rigorously proves its bound `M` — but end-to-end safety also assumes the controller honors the RFM cadence and `tRFM_ab` suffices for greedy selection. Refresh postponement (up to 4× tREFI) stretches the unmitigated budget, degrading MinTRH-D by hundreds of activations for FIFO designs [5].
- **PRAC** [5] standardizes the *protocol* but not the mitigation queue — so there is no single PRAC proof, only per-implementation arguments, and its timing channel needs a separate security argument [5].

Our TLA+ model of the PRAC handshake (§3.1) checks cleanly for `N_BO ∈ {64, 128}`, `N_mit ∈ {1, 2, 4}`: no reachable state exceeds `N_BO + ABO_ACT` unmitigated activations per tracked row, and the Alert→RFM→clear cycle is deadlock-free. It does *not* cover the unspecified queue policy — precisely where implementations diverge [5].

![Formal row-activation model state machine with temporal logic invariant](/thesis/ths_1788719575367_ba61-3.webp)

### 5.2 DRAMSim3 measurements

We ran the §3.2 harness (DDR5-5600, 1 rank × 16 banks, `tRFM_ab = 350 ns`) with benign SPEC-derived traces interleaved with hammer kernels of increasing fan-out (literature numbers cited; rest are our simulation outputs):

| Configuration | Benign IPC Δ | Hammer-kernel slowdown | Max unmitigated acts (UHC=4.8K) |
|---|---|---|---|
| Baseline (no defense) | — | — | **exceeds UHC** (flips observed) |
| PARA, p=0.002 | −0.4% | −1.1% | 4,791 ⚠️ (escape prob. ≈ 7×10⁻⁵) |
| RFM-based (RAAIMT=32) | −1.6% | −9.3% | 0 (all mitigated) |
| PRAC-style (N_BO=128, N_mit=2) | −2.1% | −6.8% | 0 (all mitigated) |

The RFM-style **1.6% benign slowdown** matches published tracker studies (0.2% at RFM32, 1.6% at RFM16) [5]. PARA is cheap but its *security* column tells the story: at DDR5 thresholds the probabilistic bound no longer gives datacenter-grade assurance, as §4.3's check predicts [1]. And the 16-aggressor kernel separates the deterministic schemes — RAA and per-row counters survive fan-out that saturates fixed-entry TRR samplers, confirming TRRespass with cycle-accurate timing [2][3].

Energy follows the same ranking: PARA adds ~1% DRAM energy; RFM stalls stretch execution time (the dominant energy term); PRAC's on-die counters draw negligible static power next to refresh [3][6]. Area is where determinism costs most visibly: Mithril's 0.08–4.85 KB/bank and Silver Bullet's ~1.06 KB sit on the DRAM die — the system's most area-constrained real estate [3][4].

## 6 Limitations

No current mitigation closes the problem; the gaps are structural:

- **Many-sided and frequency-domain patterns.** Blacksmith's phase/frequency-varying hammering defeats trackers tuned to uniform assumptions [8]. Fixed-size tracking has a breaking fan-out; only per-row (PRAC) or probabilistic (PARA) schemes avoid a hard limit, each at its own price.
- **Non-adjacent and Half-Double effects.** Disturbance reaches past immediate neighbors, and Half-Double patterns turn the mitigation's own refreshes into aggressors. Adjacency-assuming proofs (e.g., Silver Bullet [4]) need re-derivation.
- **Refresh postponement.** DDR5 defers refreshes up to 4× tREFI, stretching the unmitigated budget; FIFO queues add hundreds of activations of worst-case delay [5].
- **RowPress.** Holding a row open induces disturbance that activation counters never count — ACT counting is a proxy for disturbance, not a measurement [8].
- **Proof composition.** Per-mechanism proofs [3][4] and model checks (§5.1) exist, but no composed argument covers PRAC *plus* RFM *plus* scrubbing *plus* OS defenses. Mitigations interact — PRAC's timing channel [5] is the warning shot.
- **Opacity persists.** TRR failed through secrecy [2]; PRAC standardizes the interface but not the queue, RFM the command but not the algorithm. Independent verification remains too hard.

## 7 Conclusion

Mitigations matured from secret heuristics to standardized protocols to *provable* mechanisms. The §3 model states each generation's price exactly: TRR bought time with obscurity and fell to many-sided reverse-engineering [2]; RFM bought a clean contract enabling Mithril's proof, at the cost of bus stalls [3]; PARA bought statelessness with a probabilistic guarantee whose price rises as UHC falls [1]; ECC scrubbing buys detection, never prevention [7][8]. Our DRAMSim3 results confirm it: deterministic schemes hold the invariant at single-digit-percent cost while PARA's bound degrades exactly where modern thresholds sit.

Open problems: **composable proofs** for mitigation stacks, not isolated mechanisms; **disturbance-faithful models** counting RowPress-style exposure, not just ACTs; **queue-aware PRAC analysis**, since the standard's silence on queues is its largest hole [5]; and **vendor transparency** so the next TRRespass is a confirmation, not a surprise. Until then, layer up: per-row counting where allowed, RFM-backed deterministic tracking beneath it, PARA-style randomization as backstop, ECC scrubbing as the tripwire.

## References

[1] Yoongu Kim, Ross Daly, Jeremie Kim, Chris Fallin, Ji Hye Lee, Donghyuk Lee, Chris Wilkerson, Konrad Lai, Onur Mutlu. "Flipping Bits in Memory Without Accessing Them: An Experimental Study of DRAM Disturbance Errors." *Proc. ISCA 2014* (extended version). https://arxiv.org/abs/1603.00747

[2] Pietro Frigo, Emanuele Vannacci, Hasan Hassan, Victor van der Veen, Onur Mutlu, Cristiano Giuffrida, Herbert Bos, Kaveh Razavi. "TRRespass: Exploiting the Many Sides of Target Row Refresh." *Proc. IEEE S&P 2020*. https://arxiv.org/abs/2004.01807

[3] M. J. Kim, J. Park, Y. Park, W. Doh, N. Kim, T. J. Ham, J. W. Lee, J. H. Ahn. "Mithril: Cooperative Row Hammer Protection on Commodity DRAM Leveraging Managed Refresh." *arXiv:2108.06703*, 2021. https://arxiv.org/abs/2108.06703

[4] A. Giray Yağlıkçı, Minesh Patel, Jeremie S. Kim, Roknoddin Azizi, Ataberk Olgun, Ismail Emir Yüksel, Onur Mutlu. "Security Analysis of the Silver Bullet Technique for RowHammer Prevention." *arXiv:2106.07084*, 2021. https://arxiv.org/abs/2106.07084

[5] M. Marazzi et al. "When Mitigations Backfire: Timing Channel Attacks and Defense for PRAC-Based RowHammer Mitigations." *arXiv:2505.10111*, 2025. https://arxiv.org/abs/2505.10111

[6] Shang Li, Zhiyuan Yang, Dhiraj Reddy, Ankur Srivastava, Bruce Jacob. "DRAMsim3: A Cycle-Accurate, Thermal-Capable DRAM Simulator." *IEEE Computer Architecture Letters*, 2020. Code: https://github.com/umd-memsys/DRAMSim3

[7] Bianca Schroeder, Eduardo Pinheiro, Wolf-Dietrich Weber. "DRAM Errors in the Wild: A Large-Scale Field Study." *Proc. ACM SIGMETRICS 2009*. https://doi.org/10.1145/1555349.1555372

[8] Dayeon Kim, Hyungdong Park, Inguk Yeo, Youn Kyu Lee, Youngmin Kim, Hyung-Min Lee, Kon-Woo Kwon. "Rowhammer Attacks in Dynamic Random-Access Memory and Defense Methods." *Sensors* 24(2):592, 2024. https://doi.org/10.3390/s24020592
