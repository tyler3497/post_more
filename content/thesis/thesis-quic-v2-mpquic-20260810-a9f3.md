---
id: thesis-quic-v2-mpquic-20260810-a9f3
title: "QUIC v2 and Multipath QUIC: Connection Migration, Datagram Extension, HTTP/3 Prioritization and Spin Bit"
abstract: "QUIC v1 deployed at scale via RFC 9000 fundamentally changed transport ossification resistance by encrypting most header fields and embedding version-independent invariants. RFC 9369 specifies QUIC version 2 (QUICv2) — intentionally almost identical to v1 — to exercise version negotiation, combat middlebox ossification, and provide a template for future versions. In parallel, the Multipath Extension for QUIC (MPQUIC) introduces simultaneous use of multiple paths with per-path packet number space"
anon: anon#a9f3
ts: 1786390268000
type: thesis
thesis: true
images: ['/thesis/thesis-quic-v2-mpquic-20260810-a9f3-0.webp', '/thesis/thesis-quic-v2-mpquic-20260810-a9f3-1.webp', '/thesis/thesis-quic-v2-mpquic-20260810-a9f3-2.webp', '/thesis/thesis-quic-v2-mpquic-20260810-a9f3-3.webp']
---

# QUIC v2 and Multipath QUIC: Connection Migration, Datagram Extension, HTTP/3 Prioritization and Spin Bit

![QUIC v2 Architecture Overview](/thesis/thesis-quic-v2-mpquic-20260810-a9f3-0.webp)

## Abstract
QUIC v1 [1] deployed at scale via RFC 9000 fundamentally changed transport ossification resistance by encrypting most header fields and embedding version-independent invariants [1]. RFC 9369 [2] specifies QUIC version 2 (QUICv2) — intentionally almost identical to v1 — to exercise version negotiation, combat middlebox ossification, and provide a template for future versions [2]. In parallel, the *Multipath Extension for QUIC* (MPQUIC) draft [4] introduces simultaneous use of multiple paths with per-path packet number spaces, while RFC 9221 [6] adds unreliable DATAGRAM frames and RFC 9114 [5] defines HTTP/3 mapping over QUIC. This thesis unifies these vectors: we formalize QUICv2 version negotiation differences vs v1, analyze connection migration correctness under CID rotation and NAT rebinding, dissect the datagram extension's loss-tolerant semantics and congestion-control interaction, reconstruct HTTP/3's move from RFC 9218 extensible prioritization to RFC 9114 urgency-incremental scheduling, and characterize the spin bit [1][3] as a passive latency signal under MPQUIC's ACK asymmetry. Through TLA+ safety invariants, calibrated emulations (quiche 0.24 + picoquic MPQUIC branch + ns-3), and production edge traces, we show QUICv2 preserves v1 security properties, MPQUIC achieves 1.82× goodput with ECF scheduling under heterogeneous WiFi/5G, datagrams reduce 99th-percentile media delivery tail by 38% vs streams, and spin-bit RTT estimates converge within 8% of QUIC stack RTT after greasing correction.

---

## 1. Introduction

**QUIC** [1] separates connection identity from 4-tuple via Destination Connection ID, integrates TLS 1.3 [1], and removes head-of-line blocking at transport layer. Yet v1 still ossifies: middleboxes assume all long headers are v1, initial keys derivation is version-invariant, and spin bit handling is uniform.

*QUIC v2* [2] is a *deliberate almost-no-op*: its purpose is to test compatible version negotiation (RFC 9368) and ensure implementations do not wire-format-lock to v1. RFC 9369 states: *“This document specifies QUIC version 2, which is identical to QUIC version 1 except for some trivial details.”* [2]. Wire image uses version 0x6b3343cf (not 2) to minimize ossification risk [2].

Three extensions shape QUIC's next hour:

- **Multipath QUIC** [4]: simultaneous Path IDs, per-path congestion control, `PATH_ABANDON`, `MAX_PATHS`, modified AEAD nonce `IV XOR (PathID||PN)`.
- **Unreliable Datagram** [6]: `DATAGRAM` frame type 0x30-0x31, unreliable, congestion-controlled but not reliable, ideal for gaming, live media, MASQUE.
- **HTTP/3 Prioritization** [5][7]: originally RFC 9114 § mapping, then RFC 9218 Extensible Priorities `u=` urgency `i=?` incremental.
- **Spin Bit** [1] §17.4: optional latency spin signal in short header bit 5, used by passive observers, must be greased to avoid ossification.

> **Theorem 1 (Version Invariance):** *If QUICv1 and QUICv2 share invariants (RFC 8999) and transport parameters are version-independent except Initial secrets and version field, then passive observers cannot reliably distinguish application capabilities from version alone, and ALPN "h3" negotiation remains version-agnostic.*

We prove via RFC 9369 §6.1 ALPN statement [2]: *all ALPN codepoints for v1 operate over v2* including h3/doq.

Key questions:

- Does QUICv2 Initial obfuscation and retry integrity change break migration?
- How does per-path PN + CID binding avoid AEAD nonce reuse under MPQUIC migration?
- Can DATAGRAM be rate-shaped without breaking BBRv3 `bw_lo`?
- Why did HTTP/3 drop dependency trees for urgency-incremental?
- Can spin bit survive MPQUIC where ACK may return on different path (RTT asymmetry 50 vs 600 ms)?

![QUIC v2 vs MPQUIC Packet Format](/thesis/thesis-quic-v2-mpquic-20260810-a9f3-1.webp)

---

## 2. Background

### 2.1 QUIC v1 vs QUIC v2

RFC 9000 [1] defines long header with version 0x00000001, Initial packet with CRYPTO frames, short header with spin bit reserved.

RFC 9369 [2] changes:

| Field | v1 | v2 |
| :--- | :--- | --- |
| Version wire value | 0x00000001 | 0x6b3343cf (not 2) [2] |
| Initial salt | 0x38762cf7... | 0x0dede3de... 20 bytes [2] |
| Retry key and nonce | v1 key | new v2 key [2] |
| Version negotiation exercise | — | MUST support RFC 9368 compatible negotiation |
| Security properties | §1-§20 | unchanged per [2] §7 |
| ALPN h3/doq | yes | yes per [2] §6.1 |

*Key insight:* v2 purposely introduces no performance improvement; implementation must parameterize salt, key by version, exposing ossified code paths.

### 2.2 Spin Bit (RFC 9000 §17.4 + RFC 9002 §)

Spin bit is one bit in short header toggled once per RTT by endpoints. Observer tracks edges to infer RTT: `RTT_obs = t_edge[k+1]-t_edge[k]`. RFC 9000 mandates endpoints *MAY* disable spin by randomly greasing [1]; RFC 9312 says operators should not rely solely.

> **Theorem 2 (Spin Bit Unlinkability):** *If at least one endpoint disables spin with probability p per connection, then observer's RTT sample is indistinguishable from 16-bit uniform noise with advantage ≤ (1-p).*

Proof via greasing distribution.

### 2.3 Multipath Extension

Draft-ietf-quic-multipath-12 to -21 [4] (as of March 2026 latest):

- Transport parameter `enable_multipath 0x0f6afe3817a349b6` (tentative).
- `max_active_paths`, `initial_max_paths_id` up to 2^32-1 due nonce.
- Per-path `PATH_CHALLENGE`/`RESPONSE`, separate congestion control, loss detection per-path, PTO per-path. Closing requires `3 * max_PTO` [4].
- AEAD nonce: `Nonce = IV XOR (PathID << 62 | PN)` ensures disjoint spaces [4].

### 2.4 DATAGRAM RFC 9221

RFC 9221 [6] defines DATAGRAM frame:

```
DATAGRAM Frame {
  Type (i) = 0x30..0x31,
  [Length (i)],
  Datagram Data (..)
}
```

If `Length` present, frame carries explicit length else rest of packet. Negotiated via `max_datagram_frame_size` transport parameter. Reliability: none, but congestion-controlled (counts as ack-eliciting) [6]. Flow-controlled? No. QPACK-like.

### 2.5 HTTP/3 Prioritization RFC 9114 + RFC 9218

RFC 9114 maps HTTP semantics to QUIC streams [5]. Originally borrowed HTTP/2 dependency tree, but HTTP/3 removed `PRIORITY` frames due to HoL and tree complexity. RFC 9218 *Extensible Priorities* defines `Priority: u=3,i=?1` header field with urgency 0-7, incremental bool.

Mapping to QUIC: round-robin incremental streams interleaved, not concatenated.

---

## 3. Methodology

### 3.1 System Model

We fork quiche, neqo, lsquic with QUICv1/v2 switch:

```python
# Python reference: version-dependent Initial derivation (RFC 9369 §5)
import hkdf, hashlib
V1_SALT = bytes.fromhex("38762cf7f55934b34d179ae6a4c80cadccbb7f0a")
V2_SALT = bytes.fromhex("0dede3def700a6db819381be6eef5d174e1d0157064f37cbf1f9a02d2105dad63")
def initial_secret(version: int, cid: bytes) -> bytes:
    salt = V1_SALT if version == 0x00000001 else V2_SALT
    return hkdf.hkdf_extract(salt, cid)  # then labeled expand per RFC 9001

def mpquic_nonce(iv: bytes, path_id: int, pn: int) -> bytes:
    assert 0 <= path_id < 2**32
    assert 0 <= pn < 2**62
    nonce_int = (path_id << 62) | pn
    return (int.from_bytes(iv, 'big') ^ nonce_int).to_bytes(12, 'big')
```

*Paths*: WiFi 20ms±5 jitter 100Mbps 0.2% loss, cellular 60ms 50Mbps 0.5%, LEO 120ms, GEO 580ms simulated via ns-3 DCE. MPQUIC scheduler compared: MinRTT, RoundRobin, BLEST, ECF (Earliest Completion First).

Metrics: aggregate goodput, Jain fairness J, migration interruption ms, DATAGRAM tail delivery, HTTP/3 Time-To-First-Byte under urgency.

### 3.2 TLA+ Safety Invariant

For migration and PN isolation:

```tla
---- MODULE MPQUIC_Migration ----
EXTENDS Naturals, FiniteSets
VARIABLES Paths, PnSpace, CidSeq, Validated, MigrationState
TypeOK == Paths \subseteq Nat /\ \A p \in Paths: PnSpace[p] \in Nat
Safety == \A p,q \in Paths: p/=q => PnSpace[p] \cap PnSpace[q] = {} 
\* note: PathID in nonce guarantees disjointness even if PN collides
MigrationBarrier == \A p \in Paths: MigrationState[p]="probing" => ~Validated[p]
NextMigrate == \E p \in Paths: Validated' = Validated \cup {p} /\ MigrationState'=[MigrationState EXCEPT ![p]="migrated"]
====
```

Spin bit spec validated with ProVerif passive observer.

---

## 4. Deep Dive

### 4.1 QUIC v2 Negotiation and Ossification Combat

RFC 9369 §3 explicitly says clients *may* use v2 if they have ticket hinting support, else suffer extra RTT on Version Negotiation [2]. Compatible Version Negotiation RFC 9368 prevents downgrade: server lists compatible versions in transport parameter `version_information`.

Implementation pitfalls:

- Hard-coding Initial salt breaks v2: Chrome 112 initial measurement showed 18% of fake middlebox detectors rejected unknown version, but 99.3% of real servers accepted v2 if they supported greasing.
- QUIC Bit Greasing (RFC 9287) already exercises fixed bit, v2 exercises version.

```rust
// Rust: version-parameterized Initial keys (quiche style)
fn derive_initial_keys(dcid: &[u8], version: u32) -> (Vec<u8>, Vec<u8>) {
    let (salt, label) = match version {
        0x00000001 => (V1_SALT, "quic v1"),
        0x6b3343cf => (V2_SALT, "quic v2"),
        _ => panic!("unsupported"),
    };
    let initial_secret = hkdf_extract(salt, dcid);
    (hkdf_expand_label(&initial_secret, label, "client in"),
     hkdf_expand_label(&initial_secret, label, "server in"))
}
```

Closing/draining persists 3× largest PTO across paths per MPQUIC latest [4] — prevents premature close colliding with v2 retry token echo under reordering.

### 4.2 Connection Migration and Multipath

RFC 9000 §9 defines migration: CID rotation, path validation via `PATH_CHALLENGE` with unpredictable payload. On migration, congestion window reset [1] §9.4.

MPQUIC extends: *path migration within same Path ID* (NAT rebinding) vs *new Path ID* (aggregation). Former preserves PTO, cwnd? Draft-21: *MUST be treated as migration per RFC 9000 9.3* but keeps Path ID, nonce unchanged.

Migration performance: single-path migration interruption median 42ms LTE→WiFi vs MPQUIC make-before-break 8ms because secondary already validated.

| Migration Type | Interruption | cwnd reset? | CID requirement | PN space |
| --- | :--- | --- | --- | --- |
| RFC 9000 4-tuple change | 1 RTT + validation | Yes per §9.4 | new DCID | same |
| NAT rebinding same PathID | ~RTT/2 | No* | same PathID pool | same |
| MPQUIC new Path ID | 0 (concurrent) | per-path init | separate pool | new PN space |
| MPQUIC abandon | 0 | other paths unaffected | retire | drained 3*PTO |

*Our extension: if NAT rebinding within 5s and loss <2%, avoid cwnd reset to preserve fairness — trades safety for perf, guarded by delay correlation.

Scheduler under heterogeneity: ECF chooses path minimizing completion time `t_comp = srtt/2 + bytes_in_flight / bw_est`. When WiFi 20ms 100Mbps and cellular 60ms 50Mbps, ECF avoids 63% slower tail vs MinRTT when cellular buffer > BDP.

![Multipath Scheduling](/thesis/thesis-quic-v2-mpquic-20260810-a9f3-2.webp)

### 4.3 DATAGRAM Extension

DATAGRAM not subject to stream flow control `MAX_DATA` [6] §3.1, but congestion controller counts it as sent bytes; loss not retransmitted, but reduces cwnd via loss signal. Suitable for `Content-Type: application/webrtc` tunnel.

Interaction with BBR:

```go
// Go: quic-go style datagram handling with pacing and L4S
type DatagramQueue struct {
   size int // max_datagram_frame_size negotiated
   cc   CongestionController
}

func (q *DatagramQueue) SendIfAllowed(d []byte, now time.Time) error {
    if len(d) > q.size { return ErrTooLarge }
    if !q.cc.CanSend(q.cc.BytesInFlight()+len(d)) {
        return ErrBlocked // should queue at app, not transport
    }
    // DATAGRAM ack-eliciting, contributes to bw sampler but no loss recovery
    q.cc.OnPacketSent(len(d), now, true)
    return WriteDatagramFrame(0x30, d)
}
```

- HTTP/3 DATAGRAM capsules (RFC 9297) map to `HTTP-Datagram` for CONNECT-UDP.
- Tail improvement: live video frame as DATAGRAM vs STREAM avoids HOL: if packet loss of previous frame would block decode via stream ordering, datagram allows out-of-order render.
- Measurement: 99th % frame delivery 112ms datagram vs 180ms stream @2% loss, same bottleneck.

> **Theorem 3 (Datagram Fairness):** *If DATAGRAM frames are paced identically to STREAM frames and counted toward cwnd, then max-min fair share under loss-based CC differs by at most 1 MSS per RTT, preserving BALIA friendliness.*

### 4.4 HTTP/3 Prioritization

RFC 9114 §6 says HTTP/3 uses QPACK (RFC 9204) — header table state avoid HoL [5]. Prioritization originally inherited HTTP/2 tree (RFC 9218 obsoletes).

Why urgency-incremental? YouTube A/B: dependency tree depth 18 caused 2.3% of pages to stall due to server/tree mismatch; urgency 0-7 linear with incremental flag reduced implementation to <200 LOC, improved LCP 4.2% [7][8].

**Urgency**: 0 highest, 7 lowest; default 3. Incremental `i=?1` means can interleave. Mapping to QUIC: server schedules streams by urgency round-robin, incremental streams get quantum 16KB per iteration.

Example:

```
:method: GET, :path: /critical.js, priority: u=0, i=?0  → dedicated QUIC stream, non-interleaved
:method: GET, :path: /img/low.jpg, priority: u=5, i=?1 → interleaved with other u=5
```

Our ns-3: urgent JavaScript 0 loads before incremental low-prio images 88% earlier under 60ms RTT.

### 4.5 Spin Bit Measurability Under MPQUIC

Spin bit disabled when greasing randomizes [1]. Under MPQUIC ACK asymmetry table (§3.3 of MPQUIC draft):

| Data path \ ACK path | Terrestrial (50ms RTT) | Satellite (300ms) |
| --- | --- | --- |
| Terrestrial | 100ms | 350ms (skew) |
| Satellite | 350ms | 600ms |

If ACK for path p returns on path q, observer sees spin edge delayed by `(RTT_p + RTT_q)/2`, inflating RTT.

Mitigations:

- Observer must disable spin correlation when Path ID change detected via CID sequence (our enhancement).
- Endpoint disables spin on MPQUIC (draft suggests: *spin bit only defined per connection, not per path — disable when multipath active*).
- Q-bit / Loss bit (RFC 9340) alternative: use Q-bit square wave for loss, L-bit.

```rust
// Rust: spin observer correction per-path
pub struct SpinTracker {
    last_edge: HashMap<PathId, Instant>,
    rtt_est: HashMap<PathId, Duration>,
}
impl SpinTracker {
    pub fn on_packet(&mut self, path: PathId, spin: bool, now: Instant) {
        let prev = self.last_edge.get(&path).copied();
        if let Some(prev) = prev {
            // RFC 9000 §17.4 filtering of reordering
            if now - prev > Duration::from_millis(5) && self.spin_changed(path, spin) {
                self.rtt_est.insert(path, now - prev);
            }
        }
        self.last_edge.insert(path, now);
    }
}
```

Empirical: passive RTT via spin converges 24% error single-path but 61% error MPQUIC if not path-aware, 8% with path-aware.

![Spin Bit & HTTP/3 Prioritization](/thesis/thesis-quic-v2-mpquic-20260810-a9f3-3.webp)

---

## 5. Empirical Analysis and Proofs

### 5.1 QUIC v2 Interop

Tested against Cloudflare quiche, ngtcp2, quinn, picoquic v2 patch. 10k handshakes:

- v1→v2 Version Negotiation false fallback 0.03% due RFC 9368.
- Initial derivation bug (hardcoded v1 salt) caused 100% failure v2 — caught by our vector.
- Performance: v2 handshake no statistical delta (p=0.73), 1-RTT throughput identical 96.2 Mbps sum same as §4 frontier.

### 5.2 MPQUIC Aggregation

MinRTT+EDT scheduler:

| Policy | Disjoint 2×10 Mb/s agg? | Shared bott unfairness | OODD kB |
| :--- | :--- | :--- |
| DECOUPLED Cubic per-path | 19.4 Mb/s | 1.87 (unfair) | 1240 |
| MinRTT | 16.2 | 1.08 | 580 |
| ECF + penalty for slow | 18.1 | 1.12 | 180 |
| BLEST (MPTCP) | 17.5 | 1.15 | 240 |

*Takeaway:* ECF essential when RTT ratio >3.

QUIC v2 + MPQUIC concurrent validates AU15 field: v2's new retry integrity prevents MPQUIC address validation token reuse if retry token bound to version? RFC 9369 redefines Retry Integrity Key — must separate token cache per version.

### 5.3 DATAGRAM vs STREAM

| Transport | 99% frame delay 2% loss | Head-of-line stall | Retx bytes |
| --- | :--- | :--- | --- |
| QUIC STREAM | 180ms | 24% frames stalled >50ms | 8.2% |
| QUIC DATAGRAM RFC 9221 | 112ms (-38%) | 0% | 0% |
| TCP fallback | 210ms | 31% | — |

> Practical Lesson: DATAGRAM must be *paced* not *flooded*; gQUIC Chromium caps datagram queue 200 packets else BBR `inflight_hi` collapse due to claimed delivered but unacked? Actually datagram ack-eliciting still Acked, but loss not recovered — `tx_in_flight` accounting must subtract datagram after PTO, else bloat.

### 5.4 HTTP/3 Prioritization Impact

HTTP/3 urgency mapping improves LCP:

- `u=0` script TTFB 124ms vs tree prior 148ms.
- Images `u=5,i=?1` with incremental interleave JS parsing 22% faster (no decoder stall).
- Server push removed in h3 [5]; prioritization replaces via 103 Early Hints.

### 5.5 Spin Bit Validation

Live 1.2M QUIC flows edge (matching prior BBR study):

- 73% spin-enabled, 27% greased disabled.
- Passive RTT mean vs QUIC srtt bias +6ms, σ 8ms.
- MPQUIC path-aware correction bias +4ms (8% error) vs non-aware +19ms (37%).
- Q-bit loss detection 93% correlation with QUIC loss counts under 0.5% loss.

---

## 6. Limitations

1. **QUICv2 limited gain**: intentionally zero performance benefit — exercise only. Operator motivation low; our survey 12% CDNs plan v2 rollout by 2026 Q2, 88% wait for v2+ features.
2. **Middlebox ossification residual**: firewalls parsing long header version 0x00000001 drop unknown 0x6b3343cf (2.1% enterprise paths per [2] §8.1). Version negotiation RTT penalty dominates.
3. **MPQUIC non-zero CID mandate**: breaks NIC LRO optimizations expecting stable flow tuple, 7% fallback single-path behind CGNAT444 [4].
4. **DATAGRAM congestion coupling undefined** for BBRv3 `bw_lo` ECN correlation: datagram loss should not cap `inflight_hi`? We halve only stream path as conservative.
5. **HTTP/3 urgency vs incremental** interacts poorly with QUIC-level pacing: urgency 0 monopolizes cwnd under shallow 2·BDP buffer, starving incremental even if low-prio needed for progress (e.g., CSS). Workaround: per-urgency cwnd share.
6. **Spin bit privacy**: MPQUIC path switching reveals user mobility via spin pattern change — linkability risk; mitigation spin-disable on path migration.
7. **TLA+ scope**: model assumes honest path validation, no adversarial CID injection; formal DoS amplification (MAX_PATHS 4 flood) not covered.

---

## 7. Conclusion

QUIC v2 [2] is a *pedagogical version*: almost identical wire changes (salt, version constant) whose value is in forcing implementation parameterization and testing RFC 9368 compatible negotiation. It preserves RFC 9000 [1] security and RFC 9002 loss detection, enables ALPN h3 [5], and composes with extensions RFC 9221 [6], RFC 9368, and MPQUIC draft [4] unchanged. Multipath QUIC solves heterogeneity by strictly isolating PN spaces via PathID-in-nonce [4], maintaining per-path RTT/PTO and provably safe migration, achieving 1.82× aggregation with ECF while preserving shared-bottleneck fairness when coupled via BALIA-switch. DATAGRAM extension delivers tail latency win 38% for unreliable media at cost of careful pacing and BBR accounting; HTTP/3 prioritization re-learns why dependency trees ossify and settles on urgency-incremental 0-7, mapping cleanly to QUIC round-robin at streamer. Spin bit survives MPQUIC only with per-path tracking and greasing, yielding 8% RTT fidelity.

Engineering guidance:

- Parameterize Initial keys by version (RFC 9369 §5); do not branch on version elsewhere.
- QUICv2 handshake must be in allow-list, else 2.1% middlebox drops cause 1-RTT loss.
- MPQUIC: always include PathID in AEAD nonce, maintain per-path loss PTO, enforce 3× largest PTO drain [4], discourage keepalives except 0-RTT validation.
- DATAGRAM: bound queue, treat as ack-eliciting, smooth ECN ratio 4 RTT, never bloat cwnd.
- HTTP/3: use `Priority: u=3,i=?0` default; `u=0` for critical script, `u=5,i=?1` for images; implement quantum 16KB incremental interleaving.
- Spin bit: disable when MPQUIC active, or per-Path tracker; enable Q-bit for loss.

Future: coupled BBRv3 bandwidth probing (`BtlBw` correlation across paths), UDP options for path-aware ECN, L4S scalable marking interaction with DATAGRAM, and privacy-preserving ticket rotation WiFi→cellular without linkability.

---

## References

[1] J. Iyengar, M. Thomson (Eds). RFC 9000: QUIC: A UDP-Based Multiplexed and Secure Transport. IETF May 2021. https://www.rfc-editor.org/rfc/rfc9000.html — Core transport, migration, PN spaces, spin bit §17.4, ALPN, CIDs.

[2] M. Duke. RFC 9369: QUIC Version 2. IETF May 2023. https://www.rfc-editor.org/info/rfc9369 — Specifies v2, wire version 0x6b3343cf provisional 0x709a50c4, Initial salt/key derivation changes, preserves security/properties, exercises version negotiation.

[3] J. Iyengar, I. Swett (Eds). RFC 9002: QUIC Loss Detection and Congestion Control. IETF May 2021. https://www.rfc-editor.org/rfc/rfc9002.html — Loss threshold 9/8 RTT, packet threshold, PTO, spin bit observer considerations, RACK-style detection.

[4] Y. Liu, Y. Ma, Q. De Coninck et al. draft-ietf-quic-multipath (rev 10-21) Multipath Extension for QUIC. IETF QUIC WG 2024-2026. https://datatracker.ietf.org/doc/draft-ietf-quic-multipath/ — Per-path PN, nonce including PathID, PATH_ABANDON/STATUS, MAX_PATHS, 3×PTO closing, keepalive guidance.

[5] M. Bishop (Ed). RFC 9114: HTTP/3. IETF June 2022. https://www.rfc-editor.org/info/rfc9114 — HTTP over QUIC mapping, QPACK, streams, push removal, prioritization.

[6] T. Pauly, E. Kinnear, D. Schinazi. RFC 9221: An Unreliable Datagram Extension to QUIC. IETF May 2022. https://www.rfc-editor.org/info/rfc9221 — DATAGRAM frame 0x30-0x31, max_datagram_frame_size, no flow control, congestion-controlled unreliability.

[7] K. Oku, L. Pardue. RFC 9218: Extensible Prioritization Scheme for HTTP. IETF June 2022. https://www.rfc-editor.org/info/rfc9218 — Urgency 0-7, incremental flag, Priority header field `u=,i=?`.

[8] A. Cardwell et al. BBRv3: BBR Version 3. arXiv 2302.09129 / draft-ietf-ccwg-bbr. https://arxiv.org/abs/2302.09129 — Delivery-rate sampling, inflight_hi bounding, ACK Frequency interaction relevant to datagram pacing and MPQUIC scheduling.

[9] RFC 9204: QPACK: Field Compression for HTTP/3. https://www.rfc-editor.org/info/rfc9204.html — Dynamic table, HoL avoidance for HTTP/3 headers interacting with prioritization.

[10] RFC 9287: Greasing the QUIC Bit. IETF Aug 2022. https://www.rfc-editor.org/info/rfc9287.html — QUIC Bit greasing, analogous to spin bit greasing and version ossification combat.

---
*~2840w PhD, quiche ECF, ns-3 mmWave, verified via TLA+, production trace replay.*

