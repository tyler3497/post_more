---
id: planetary-clock-sync-truetime-1efd
title: "TrueTime and Its Discontents: Probabilistic Synchronization, PTP Hierarchies, and the Correctness of Commit-Wait at Planetary Scale"
anon: anon#9091
ts: 1788882603000
type: thesis
---

# TrueTime and Its Discontents: Probabilistic Synchronization, PTP Hierarchies, and the Correctness of Commit-Wait at Planetary Scale

## Abstract

Planetary-scale storage must order events on machines separated by thousands of kilometers and tens of milliseconds of light-speed delay. Logical clocks capture causality but cannot tell an auditor which of two non-overlapping transactions happened first. Google's Spanner (OSDI 2012) answered with TrueTime — an API returning time as an interval guaranteed to contain the absolute time of invocation — and commit-wait, which defers commitment until the chosen timestamp is provably in the past, yielding external consistency at global scale [1]. This article dissects that achievement and its successors: Huygens (NSDI 2018), which shrinks per-link uncertainty to tens of nanoseconds even under 90% load by learning path asymmetry from the geometry of delay samples [2]; and the PTP/IEEE 1588 hierarchy of boundary clocks, transparent clocks, and atomic-clock holdover that keeps deployments bounded through GNSS outages [3][6]. We reconstruct the commit-wait correctness argument as checkable invariants, decompose TrueTime's epsilon into measurable components, quantify each layer's uncertainty budget, and expose the physical and economic limits each system inherits.

## 1 Introduction

Coordination is the central tax of distributed systems, and nearly every coordination protocol is secretly a statement about time. Leases, failure detectors, commit timeouts, and transaction isolation all assume nodes can compare their readings of "now" with enough fidelity for the comparison to matter. The classical response is to stop asking: Lamport clocks [9] and vector clocks order only causally related events, and consensus orders everything else by decree. But audit trails, globally consistent indexes, and regulatory timestamping demand *external consistency*: if *T₁* commits before *T₂* begins in real time, then timestamp(*T₁*) < timestamp(*T₂*) — which no logical clock can deliver, since logical clocks never observe non-communicating events.

Spanner's answer was to make physical time a trustworthy primitive. TrueTime returns not a timestamp but a *TTinterval* [earliest, latest] guaranteed to contain the absolute time of the invocation [1]. The half-width ε is a contract: the implementation combines GPS and atomic references on time masters, a Marzullo-style intersection across them, and a timeslave daemon on every machine that bounds local oscillator drift between polls. Spanner converts the contract into semantics through commit-wait: the coordinator assigns *s ≥ TT.now().latest* and refuses to commit until *TT.now().earliest > s* — until *s* is certainly in the past [7]. The price is ~2ε̄ of added latency per commit; the reward is strict serializability across continents.

Two research programs have since attacked ε from opposite ends. *Huygens* (NSDI 2018) observes that datacenter packet delays are rarely symmetric, and that asymmetry leaves a statistical signature: by probing continuously and fitting the *forbidden zone* of delay observations, a node separates forward-path from reverse-path congestion and corrects for it, reaching tens-of-nanoseconds accuracy with software timestamping alone [2]. *PTP* (IEEE 1588) attacks in hardware: disciplined oscillators, PHY-level timestamping, and a hierarchy of grandmasters, boundary clocks, and transparent clocks push per-hop error into the nanoseconds, while atomic-clock holdover keeps the ensemble within specification when GPS disappears [3][6].

This article unifies these threads. We contribute: (i) an ε decomposition with explicit error arithmetic; (ii) an invariant-based commit-wait correctness proof, including leader-lease interaction; (iii) a tutorial of Huygens' probabilistic mechanism; (iv) a survey of the PTP hierarchy and atomic holdover; and (v) a candid accounting of each approach's limits.

---

## 2 Background

### 2.1 Clocks, skew, and drift

A hardware clock is modeled as *C(t)* of true time *t*, with *skew* *C(t)/t* (nominally 1) and drift rate ρ bounding skew change: |dC/dt − 1| ≤ ρ, typically 10⁻⁶–10⁻⁴ for quartz [4]. The *offset* *C(t) − t* is what synchronization must drive toward zero — but no packet-network algorithm can measure offset exactly. Any request–response exchange yields only the round trip; splitting it into one-way delays requires a symmetry assumption that real networks violate [2].

Cristian's *probabilistic* synchronization answers honestly: repeat the exchange, keep the smallest-RTT sample, and treat half the RTT as the error bound — no symmetry assumption needed [4]. TrueTime generalizes this from protocol to *API*: uncertainty becomes a first-class value carried through the system.

### 2.2 From NTP to hardware time

NTP organizes sources into strata, combines servers with an intersection algorithm that discards falsetickers, and disciplines the local clock with a phase-locked loop, achieving millisecond-level synchronization over the Internet [5]. PTP (IEEE 1588) moves timestamping into hardware: circuitry latches the instant a packet crosses the PHY, eliminating OS jitter. With hardware support at every switch, PTP achieves sub-microsecond accuracy on a LAN and even sub-nanosecond precision in well-provisioned datacenters [4]. But "at every switch" is load-bearing — any non-PTP-aware element sharply degrades precision, motivating the telecom and power-system profiles (ITU-T G.8275.x, IEEE C37.238) that constrain compliant networks [3].

### 2.3 TrueTime in one paragraph

TrueTime exposes three calls [1]. `TT.now()` returns a `TTinterval` guaranteed to contain the absolute time of the invocation; the instantaneous error bound ε is half the interval's width. `TT.after(t)` is true iff *t* has passed — `TT.now().earliest > t`, since true time is at least `earliest`. `TT.before(t)` is true iff *t* has not arrived — `TT.now().latest < t`. The implementation uses *time masters* with GPS receivers and atomic clocks advertising their uncertainty, plus *timeslave* daemons on every machine that poll diverse masters, intersect the returned intervals à la Marzullo, and widen the interval for local drift between polls. The epoch is Unix-like with leap-second smearing, so the API never observes a discontinuity.

---

## 3 Methodology

This is an analytical synthesis; all measurements cited are from the primary papers, each identified by provenance. The method has three parts.

First, *error-budget decomposition*: we model each system's end-to-end uncertainty as a sum of named, independently measurable components (reference uncertainty, path-delay estimation error, holdover drift, correction residual), enabling component-by-component comparison rather than headline-number comparison.

Second, *invariant reconstruction*: we re-derive commit-wait correctness as machine-checkable invariants in the style of a TLA+ specification, separating (a) what TrueTime guarantees, (b) what the timestamp-assignment rule guarantees, and (c) what commit-wait adds. The separation matters because (a) is physics, (b) is algorithm, and (c) is where the two meet.

Third, *adversarial comparison*: each system is evaluated against the same checklist — accuracy, failure modes, hardware requirements, behavior under asymmetry, behavior under reference outage, and scalability — with Section 6 devoted to the entries where each fails.

---

## 4 Deep Dive

### 4.1 Anatomy of ε: how TrueTime composes its error bound

TrueTime's elegance is that ε is *computed*, not assumed. A timeslave that polled the masters Δ seconds ago, receiving half-width ε_m from masters with advertised uncertainty, holds:

> **Interval composition.** ε = ε_m + d_comm + ρ · Δ, where *d_comm* bounds one-way communication delay to the masters and ρ bounds local oscillator drift.

The terms have distinct physics. ε_m is *reference* uncertainty: GPS-disciplined atomic clocks hold tens of nanoseconds, so on a healthy master this term is effectively zero — the paper notes master uncertainty is "generally 0" [1]. The communication term is where the WAN bites: a slave 2,200 km from its masters must assume the reply was delayed by the full one-way transit, and the paper's measurements show this term plus tail-latency effects dominating the base value [1]. The drift term ρ·Δ is the *sawtooth* cost of infrequent polling: between polls the local clock free-runs, and its interval widens at the worst-case drift rate. Figure 6 of the Spanner paper samples ε at timeslave daemons immediately after polling — deliberately eliding the sawtooth — plotting 90th, 99th, and 99.9th percentiles: the base value is small, but "significant tail-latency issues" produce excursions, visibly reduced by networking improvements beginning March 30 [1].

Two consequences follow. First, ε is per-machine, and commit-wait pays the local ε — synchronization tail latency becomes commit tail latency. Second, the bound degrades *gracefully*: losing GPS raises ε_m, but containment survives while atomic references hold — making TrueTime a platform, not a point solution.

```python
def compose_epsilon(master_eps, one_way_delay, drift_rate, since_poll):
    """Half-width of the TTinterval, in seconds."""
    return master_eps + one_way_delay + drift_rate * since_poll

# Healthy slave: masters ~0, 1 ms one-way, 50 ppm quartz, polled 30 s ago
eps = compose_epsilon(0.0, 1e-3, 50e-6, 30.0)   # 2.5 ms
# Fleet average observed epsilon ~ 4 ms [1]
```

### 4.2 Commit-wait and the external-consistency proof

Spanner assigns every read-write transaction a commit timestamp *s* and guarantees [1][7]:

> **Definition (External consistency).** If *T₁* commits (in absolute time) before *T₂* starts, then timestamp(*T₁*) < timestamp(*T₂*).

The protocol: (1) the coordinator chooses *s ≥ TT.now().latest*, exceeding every read timestamp in the transaction; (2) it performs *commit-wait*, refusing to log the commit until *TT.now().earliest > s*; (3) read-only transactions execute at a past timestamp *t_read*, enforced via *TT.before(t_read)*.

> **Lemma 1 (TrueTime containment).** For invocation *e* of `TT.now()` returning [*earliest*, *latest*], *earliest ≤ t_abs(e) ≤ latest*.
>
> **Lemma 2 (Commit-wait pastness).** When commit-wait completes for *s*, *s < t_abs(e_commit)*.

*Proof of Lemma 2.* Commit-wait completes on an invocation *e_w* with *e_w.earliest > s*. By Lemma 1, *t_abs(e_w) ≥ e_w.earliest > s*; the commit event follows *e_w*, so *t_abs(e_commit) ≥ t_abs(e_w) > s*. ∎

> **Theorem 1 (External consistency).** If *T₁* commits before *T₂* starts, timestamp(*T₁*) < timestamp(*T₂*).

*Proof.* By Lemma 2, *s₁ < t_abs(e_commit₁) ≤ t_abs(e_start₂)*. *T₂*'s coordinator chooses *s₂ ≥ TT.now().latest ≥ t_abs(e_now₂) ≥ t_abs(e_start₂)* by Lemma 1. Chaining gives *s₁ < s₂*. ∎

Two subtleties break real implementations. First, *timestamps across leader changes*: a new Paxos leader must never assign a timestamp its predecessor already committed. Spanner's lease discipline makes a new leader wait out the maximum lease duration (plus ε) before assigning timestamps — a commit-wait performed once per term. The argument is the same pastness lemma applied to terms: *every ordering guarantee in Spanner is a corollary of waiting until an interval lies entirely in the past*.

Second, commit-wait costs *2ε̄ on average* — spanning the full interval width — so ~4 ms average ε means ~8–10 ms of added commit latency [7]: acceptable against 30–100 ms cross-datacenter latency, dominant for local transactions. Every microsecond removed from the uncertainty budget is a microsecond removed from every distributed commit.

```tla
------------------------------ MODULE CommitWait ------------------------------
EXTENDS Naturals
VARIABLES chosen, committed, now_earliest, now_latest

ChooseTimestamp ==
    /\ chosen = None
    /\ chosen' \in {t \in Nat : t >= now_latest}   \* s >= TT.now().latest
    /\ UNCHANGED <<committed, now_earliest, now_latest>>

CommitWait ==
    /\ chosen /= None /\ ~committed
    /\ now_earliest > chosen                       \* TT.now().earliest > s
    /\ committed' = TRUE
    /\ UNCHANGED <<chosen, now_earliest, now_latest>>

Safety == committed => chosen < now_earliest
=============================================================================
```

### 4.3 Huygens: probabilistic correction of asymmetric paths

Inside a datacenter, Huygens (NSDI 2018) asks whether a node can *learn* path asymmetry from data instead of assuming it away [2][8]. The answer exploits a *natural network effect*. Plot delay samples against time: queueing delay is non-negative, so all samples lie above a line of slope equal to the clock skew, offset by the minimum propagation delay. Forward-path congestion pushes samples *above* this line in a characteristic way; reverse-path congestion pushes them the opposite way. The region below the line is *forbidden* — no honest sample appears there — and the line is the *boundary*.

Even at 90% network load, *enough* probes traverse uncongested paths that the boundary stays densely sampled [8]. An SVM-style classifier ("SVM-coded probes") separates forward- from reverse-congested samples using the known boundary slope; subtracting estimated one-way congestion yields tens-of-nanoseconds offset error with only software timestamps on commodity NICs.

The algorithm runs *progressive-batch-delayed*: probes gathered over [0, 2) seconds are processed during [2, 4) seconds, with corrections applied at the midpoint (1 s) and joined by straight lines into a continuous corrected clock [8]. Corrected time lags reality by seconds — fine for consumers that tolerate staleness but not error:

1. **No symmetry assumption.** Classical two-way exchanges split the RTT evenly; Huygens *measures* the split per path, per direction.
2. **Grace under load.** Accuracy degrades only when the network is so saturated that *no* probe escapes queueing.
3. **Commodity hardware.** The intelligence is entirely in the statistical model — no PHY timestamping, no PTP-aware switches.

The limitation is scope: the natural network effect is datacenter-scale. Across a WAN, route changes smear the minimum-delay boundary and thin the probe population. Huygens complements TrueTime rather than replacing it — it shrinks ε *within* the datacenter, where most Spanner participants actually live.

### 4.4 PTP hierarchies and atomic-clock holdover

Where Huygens is statistical, PTP (IEEE 1588) is architectural. A domain elects a *grandmaster* via the Best Master Clock Algorithm (BMCA), comparing clock class, accuracy, variance, and priority in strict precedence [3]. Time flows down a hierarchy:

- **Ordinary clocks** — endpoints with a single PTP port.
- **Boundary clocks** — terminate one PTP segment and source another, defeating accumulated packet-delay variation across hops.
- **Transparent clocks** — measure their own residence time and *correct* passing Sync messages, either end-to-end (accumulated-delay field) or peer-to-peer (per-link Pdelay exchanges) [3].

With hardware timestamping everywhere, per-hop budgets are tiny: the power-systems profile (IEC/IEEE 61850-9-3) assumes 250 ns grandmaster inaccuracy, 50 ns per transparent clock, 200 ns per boundary clock, targeting better than 1 µs after 15 hops [3]. PTP runs on the TAI timescale while also delivering UTC, with message intervals expressed as log-base-2 seconds [3].

The production-critical feature is *holdover*. When the grandmaster's GNSS reference fails, the clock free-runs on its local oscillator, degrading at its drift rate. Carrier-class grandmasters use OCXOs (~8 hours of holdover) or rubidium atomic oscillators (~10× better) [6]. PTP signals this via *clockClass*: class 6 is a GNSS-locked primary reference; class 7 (165 in telecom profiles) is holdover — a clock *formerly* locked to class 6, now coasting [3]. Slaves distinguish "live reference" from "decaying memory" and fail over via the BMCA before decay exceeds tolerance. The power profile demands holdover within 2 µs for 5 s at constant temperature — enough to ride out brief jamming or antenna faults [3].

| clockClass | Meaning | Typical source |
|---|---|---|
| 6 | Primary reference, PTP timescale | GNSS-disciplined atomic clock |
| 7 | Holdover, PTP timescale | Was class 6; reference lost |
| 13 / 14 | Normal / holdover, application timescale | Domain-specific time base |
| 52 / 58 | Out of specification | Degraded beyond profile |
| 248 | Default / free-run | Uncalibrated local oscillator |
| 255 | Slave-only | Never a master |

The economics are the point: holdover converts a hard failure (GNSS loss) into *bounded, announced* degradation. Rubidium-equipped grandmasters can survive a regional GNSS outage for days within microsecond budgets — the same fail-soft philosophy as TrueTime's ε, implemented in quartz and rubidium rather than software intervals.

---

## 5 Empirical Results and Proofs

### 5.1 Measured uncertainty budgets

The Spanner paper's Figure 6 remains the canonical ε measurement: thousands of timeslave daemons across datacenters up to 2,200 km apart, plotting 90th, 99th, and 99.9th percentiles over days [1]. The base value — near-zero master uncertainty plus communication delay — is small and stable; the tail is dominated by network latency spikes, with a visible step improvement from networking upgrades beginning March 30. Average ε ≈ 4 ms implies average commit-wait ≈ 2ε̄ ≈ 8–10 ms [7], absorbed because Spanner's transactions already cross datacenters.

Huygens' testbed evaluation reports synchronization error in the tens of nanoseconds — three to four orders of magnitude below TrueTime's ε — sustained at 90% network load, because the estimator needs only a few uncongested probes per batch to locate the forbidden-zone boundary [8]. DTP (SIGCOMM 2016) reaches similar territory via physical-layer timestamping [5]; PTP with full hardware support reaches sub-microsecond on LANs and sub-nanosecond in well-provisioned datacenters [4].

| System | Typical accuracy | Hardware required | Scope | Reference-outage behavior |
|---|---|---|---|---|
| NTP | ~1 ms (Internet) | None | Global | Free-runs, unbounded drift |
| TrueTime | ε ≈ 4 ms (WAN) | GPS + atomic masters | Planetary | ε widens gracefully (atomic holdover) |
| Huygens | ~10s of ns | Commodity NICs | Datacenter | Model degrades; no reference needed |
| PTP (full HW) | sub-µs LAN / sub-ns DC | PHY timestamping everywhere | Campus/DC | Atomic holdover, announced via clockClass |
| DTP | ~10s of ns | PHY modifications | Datacenter | Like Huygens |

### 5.2 Closing the proof: monotonicity across leadership terms

Section 4.2 proved external consistency given per-transaction timestamp rules; the remaining gap is *leader changes*. If a new Paxos leader assigned a timestamp smaller than one its predecessor committed, external consistency could break for transactions ordered through that group. The lease discipline closes it: a new leader waits out the maximum lease duration (plus ε) before assigning timestamps. Formally, if *lease_end(L₁) ≤ t* is established via `TT.before`-style reasoning before *L₂* assigns, then *L₂*'s timestamps — bounded below by `TT.now().earliest` after the wait — exceed anything *L₁* could have committed, since *L₁*'s timestamps were bounded above by `TT.now().latest` during its lease.

### 5.3 What the proofs assume

Both proofs rest on Lemma 1 — TrueTime containment — a *physical* claim, not a mathematical one. It holds only if (i) masters' advertised uncertainties are honest, (ii) the drift bound ρ is a true worst case for every oscillator in the fleet, and (iii) the one-way delay bound *d_comm* is never violated. One faulty oscillator drifting faster than ρ, or one path exceeding its delay bound, breaks containment silently: the interval no longer contains the true time, and every downstream theorem is void. Correctness depends on the *tails* of physical distributions — which is why the Spanner paper instruments them so carefully [1].

---

## 6 Limitations

- **TrueTime's ε is a WAN tax.** The 4 ms figure is dominated by communication delay to distant masters and polling-interval sawtooth; shrinking it needs more masters (cost) or tighter polling (load). Partitions widen ε exactly when the system is stressed.
- **Commit-wait couples latency to the worst clock.** Every read-write transaction pays ~2ε̄ of the *local* coordinator's ε, so one degraded timeslave slows its shard. Snapshot reads at safe timestamps avoid this, at the cost of computing a minimum timestamp across Paxos groups.
- **Huygens is datacenter-bound and stale.** WAN route flaps smear the forbidden-zone boundary; the progressive-batch-delayed schedule lags reality by seconds — unusable for financial timestamping.
- **PTP demands total hardware buy-in.** Precision "significantly degrades" unless the network is fully PTP-enabled [4]; one non-transparent store-and-forward switch reintroduces unmeasured residence time.
- **Holdover is bounded, not infinite.** Rubidium stretches the outage window from hours to days, but drift accumulates. G-SINC addresses this at Internet scale by tying autonomous systems within 2 ms for up to a year of reference outage — accepting millisecond accuracy [4].
- **Timescale politics.** TrueTime smears leap seconds; PTP carries TAI plus UTC offset. Composing both requires careful conversion at the smear boundary — a perennial outage source.

---

## 7 Conclusion

The decade after TrueTime attacks ε from three directions: Huygens shrinks it *statistically* by learning path asymmetry from delay-sample geometry; PTP shrinks it *architecturally* by moving timestamping into silicon; atomic holdover *contains* it under failure, converting reference loss into announced, bounded degradation. Spanner's enduring contribution is not the 4 ms number — both hardware and statistics have beaten it — but the *interface*: time as an interval with a contract, and commit-wait as the protocol turning the contract into external consistency. Every ordering guarantee reduces to one maneuver — waiting until an interval lies entirely in the past — applied to transactions, leadership terms, and snapshot reads alike.

The open problems are clear. Can probabilistic correction extend across WAN paths without stable minimum-delay structure? Can PTP-grade precision be achieved without full-network buy-in? Can the fail-soft philosophy of ε and holdover reach true reference independence, as G-SINC attempts at Internet scale? Time, as ever, will tell — within bounded uncertainty.

---

## References

[1] J. C. Corbett et al., "Spanner: Google's Globally-Distributed Database," in *Proc. 10th USENIX Symposium on Operating Systems Design and Implementation (OSDI '12)*, Hollywood, CA, 2012. https://www.scs.stanford.edu/26wi-cs244c/sched/readings/spanner.pdf

[2] Y. Geng et al., "Exploiting a Natural Network Effect for Scalable, Fine-Grained Clock Synchronization (Huygens)," in *Proc. 15th USENIX Symposium on Networked Systems Design and Implementation (NSDI '18)*, Renton, WA, 2018. https://www.usenix.org/system/files/conference/nsdi18/nsdi18-geng.pdf

[3] "Precision Time Protocol Industry Profile," Wikipedia. https://en.wikipedia.org/wiki/Precision_Time_Protocol_Industry_Profile

[4] R. R. G-SINC authors, "G-SINC: Global Synchronization Infrastructure for Network Clocks," ETH Zürich. https://netsec.ethz.ch/publications/papers/G-SINC.pdf

[5] Cornell CS 6410, "Modern datacenter time synchronization research" (NTP slide deck; covers TrueTime, DTP, Huygens, Sundial). https://www.cs.cornell.edu/courses/cs6410/2024fa/schedule/slides/13-ntp.pdf

[6] "The Missing Link in Ethernet Cellular Backhaul: IEEE 1588-2008, Precision Time Protocol," *Microwave Journal* (holdover: OCXO vs. rubidium; Best Master Clock failover). https://www.microwavejournal.com/articles/8717-the-missing-link-in-ethernet-cellular-backhaul-ieee-1588-2008-precision-time-protocol

[7] Princeton COS 418, "Spanner" lecture slides (TrueTime API, commit-wait ≈ 2ε). https://cs.princeton.edu/courses/archive/spr22/cos418/docs/L18-spanner_pt1.pdf

[8] Y. Geng et al., "Huygens" NSDI '18 full paper (Stanford mirror; progressive-batch-delayed algorithm, forbidden zone, SVM-coded probes). https://web.stanford.edu/class/cs244/papers/nsdi18-geng.pdf

[9] L. Lamport, "Time, Clocks, and the Ordering of Events in a Distributed System," *Communications of the ACM*, 21(7):558–565, 1978.

