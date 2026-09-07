---
id: gnss-precise-positioning-spoofing-a7f3
title: "GNSS Signal Architecture and Precise Positioning: From BOC Modulation and Trilateration to RTK, PPP, and Anti-Spoofing Authentication"
anon: anon#7314
ts: 1788744611000
tags: [Thesis]
type: thesis
---

# GNSS Signal Architecture and Precise Positioning: From BOC Modulation and Trilateration to RTK, PPP, and Anti-Spoofing Authentication

## Abstract

Global Navigation Satellite Systems (GNSS) deliver metre-level navigation worldwide and centimetre-level positioning when differential and precise techniques are applied. This thesis develops the full technical stack of modern GNSS, beginning with the signal structure of GPS L1/L2/L5 and Galileo E1/E5: carriers derived from the 10.23 MHz fundamental clock, spread-spectrum modulation with Gold and Weil pseudorandom codes, the 50 bps navigation message, and Binary Offset Carrier (BOC) modulation enabling spectral separation of civil and military services. We derive the pseudorange observation equation and show why four satellites are required once receiver clock bias is admitted as an unknown. We then contrast real-time kinematic (RTK) positioning via double-differenced carrier phase and LAMBDA ambiguity resolution with precise point positioning (PPP), which achieves global centimetre accuracy using precise orbit and clock products at the cost of convergence time. Finally, we analyse spoofing and jamming threats to unauthenticated civil signals — including the 2013 superyacht demonstration by Humphreys and collaborators — and evaluate countermeasures: Galileo's OSNMA data authentication based on the TESLA protocol, and the Chimera spreading-code authentication proposal for GPS L1C.

## 1. Introduction

The Global Positioning System (GPS), conceived in the 1970s and declared fully operational in 1995, remains the archetype of satellite radionavigation. Together with the Russian GLONASS, European Galileo, and Chinese BeiDou systems, it forms a multi-constellation Global Navigation Satellite System (GNSS) ecosystem that underpins aviation, surveying, precision agriculture, telecommunications timing, and financial transaction ordering [1]. The elegance of GNSS lies in an asymmetry: satellites carry atomic clocks stable to parts in $10^{-13}$, while receivers — mass-market devices costing dollars — contain inexpensive quartz oscillators with parts-per-million stability. Almost every design decision in GNSS signal structure, from spread-spectrum modulation to the navigation message, exists to bridge this asymmetry.

This thesis presents a unified treatment of three layers of the GNSS problem. *First*, the physical layer: how navigation signals are constructed as composites of carrier, spreading code, and data, and how Binary Offset Carrier (BOC) modulation creates sharper correlation peaks and spectral isolation. *Second*, the estimation layer: how receivers convert code-phase and carrier-phase observables into position estimates, culminating in centimetre-accurate RTK and PPP techniques. *Third*, the security layer: why the civilian signal's openness makes it an attack surface, and how signal authentication schemes aim to close that surface without breaking backwards compatibility.

The treatment is self-contained but dense, aimed at readers with graduate-level fluency in signal processing, estimation theory, and wireless communications. Equations are given in standard geodetic notation: $\rho$ for geometric range, $dt_r$ and $dt^s$ for receiver and satellite clock errors, $I$ and $T$ for ionospheric and tropospheric delays.

## 2. Background

### 2.1 The three segments

Every GNSS is described as three segments. The **space segment** of GPS comprises nominally 31 satellites in six orbital planes at $\sim$20,200 km altitude with 11 h 58 min periods, guaranteeing at least four-fold global coverage. The **control segment** tracks the constellation, uploads ephemeris and clock predictions, and maintains system time. The **user segment** is unbounded: billions of receivers that passively listen, computing position from one-way ranging without transmitting anything [1].

### 2.2 Spread-spectrum ranging

GNSS signals are direct-sequence spread-spectrum (DSSS) signals. A low-rate navigation data stream $D(t)$ at 50 bps is modulo-2 added to a high-rate pseudorandom noise (PRN) code $C(t)$ and used to BPSK-modulate the carrier:

$$s(t) = \sqrt{2P}\,D(t)C(t)\cos(2\pi f_c t + \phi)$$

The PRN code spreads the signal over several megahertz (processing gain $\approx 30$ dB against interference) and furnishes the ranging observable: correlating against a local replica measures code phase — the transmission delay — to $\approx 3$ m for the 1.023 Mcps C/A code.

Key GPS civil signal parameters are summarised in Table 1.

| Signal | Carrier (MHz) | Code | Chipping rate | Period | Data rate |
|---|---|---|---|---|---|
| L1 C/A | 1575.42 | Gold (G1/G2) | 1.023 Mcps | 1 ms | 50 bps |
| L1 P(Y) | 1575.42 | Product code | 10.23 Mcps | 1 week | 50 bps |
| L2C | 1227.60 | CM/CL (LFSR) | 511.5 kcps / 511.5 kcps | 20 ms / 1.5 s | 25/50 bps |
| L5 I/Q | 1176.45 | Neumann–Hoffman | 10.23 Mcps | 1 ms | 50/100 bps |
| L1C | 1575.42 | Weil (data+pilot) | 1.023 Mcps | 10 ms | 50 bps |

All carriers are coherent multiples of the fundamental clock $f_0 = 10.23$ MHz: $f_{L1} = 154\,f_0$, $f_{L2} = 120\,f_0$, $f_{L5} = 115\,f_0$ [1], enabling dual-frequency ionospheric correction since ionospheric group delay scales as $1/f^2$.

### 2.3 The navigation message

The GPS legacy navigation (LNAV) message is transmitted at 50 bps in a 1500-bit frame of five 300-bit subframes, repeating every 30 s; the full almanac requires 12.5 minutes. Subframe 1 carries the satellite clock correction polynomials and health; subframes 2–3 carry the ephemeris (Keplerian elements plus harmonic corrections); subframes 4–5 carry the almanac, ionospheric model coefficients, and UTC parameters [1]. Galileo's I/NAV message on E1B delivers comparable content but, crucially, reserves 40 bits per page — the "Reserved 1" field — that now carry authentication data [2].

## 3. Methodology

This thesis follows an analytic–empirical methodology. The signal layer is developed from first principles: the autocorrelation properties of Gold and Weil codes, the power spectral density of BOC-modulated signals, and the Cramér–Rao bound on delay estimation as a function of the Gabor bandwidth. The estimation layer is developed through the linearised observation equations and their stochastic models, with the LAMBDA method treated as an instance of integer least-squares. The security layer is developed through the adversarial model of a coherent spoofer, the TESLA delayed-disclosure protocol, and the spreading-code authentication (SCA) construction of Chimera. Empirical claims are drawn from published field trials and open-source processing chains (RTKLIB) rather than new data collection [5][6].

> **Theorem:** *Processing gain.* A DSSS receiver correlating over a PRN code of length $L$ chips achieves a despreading gain of $10\log_{10}(L)$ dB relative to the pre-correlation noise floor, so that signals received at $-160$ dBW (well below thermal noise in 2 MHz) are detectable after correlation.

The receiver pipeline proceeds in three stages:

1. **Acquisition** — a two-dimensional search over code phase and Doppler frequency maximises the correlation statistic; coherent integration is limited by the 20 ms data-bit transitions on L1 C/A (and by the secondary codes on modernised signals).
2. **Tracking** — a delay-locked loop (DLL) tracks code phase while a phase-locked loop (PLL) or frequency-locked loop tracks carrier phase; the PLL bandwidth trades dynamic performance against thermal noise.
3. **Navigation** — decoded ephemerides and clock corrections are combined with code and carrier observables in a weighted least-squares or Kalman-filter estimator to produce position, velocity, and time (PVT).

## 4. Deep Dive

### 4.1 BOC modulation and Galileo signal design

Binary Offset Carrier modulation multiplies the spreading code by a square-wave subcarrier at frequency $f_s = m \times 1.023$ MHz, denoted BOC$(m,n)$ where $f_c = n \times 1.023$ MHz is the code rate. The subcarrier splits the signal spectrum into two main lobes centred at $\pm f_s$ from the carrier, producing a sharper autocorrelation main peak (for the sine-phased BOC) than BPSK-R at the same code rate — and therefore superior multipath rejection and thermal-noise tracking performance.

Galileo's E1 Open Service signal employs **CBOC(6,1,1/11)**: a composite of BOC(1,1) and BOC(6,1) components weighted $10/11$ and $1/11$ in power, interoperable with GPS L1C's MBOC/TMBOC construction [2]. Galileo E5 uses **AltBOC(15,10)**, an alternate-BOC modulation that treats the E5a and E5b sidebands as a single wideband signal with an effective bandwidth exceeding 50 MHz, yielding the sharpest correlation peak of any civil GNSS signal and millimetre-level code noise in benign conditions. GPS modernisation followed a parallel path: the M-code uses BOC(10,5) for spectral separation from C/A, and L1C combines a BOC(1,1) pilot/data pair with time-multiplexed BOC(6,1) segments [7].

A subtlety of BOC is *correlation ambiguity*: the autocorrelation function exhibits multiple peaks, so a receiver that acquires a side peak incurs a half-subcarrier-cycle bias. Modern receivers resolve this with bump-jumping or subcarrier-aided tracking.

### 4.2 Trilateration with receiver clock bias

The code pseudorange to satellite $s$ is modelled as:

$$P^s = \rho^s + c\,(dt_r - dt^s) + I^s + T^s + \varepsilon^s, \qquad \rho^s = \lVert \mathbf{x}^s - \mathbf{x}_r \rVert$$

where $\mathbf{x}^s$ is the satellite position from the ephemeris, $\mathbf{x}_r$ the unknown receiver position, $dt_r$ the receiver clock bias (typically milliseconds, i.e., hundreds of kilometres of equivalent range), $dt^s$ the satellite clock correction broadcast in subframe 1, $I^s$ and $T^s$ the ionospheric and tropospheric delays, and $\varepsilon^s$ the lumped noise. The carrier-phase observable adds the integer ambiguity:

$$\Phi^s = \rho^s + c\,(dt_r - dt^s) - I^s + T^s + \lambda N^s + \eta^s$$

Note the sign reversal of the ionosphere: it *delays* code (group delay) but *advances* carrier phase (phase advance) — a dispersive signature exploited by dual-frequency combinations.

Because $dt_r$ is unknown and common to all satellites, the position solution has four unknowns $(x, y, z, dt_r)$ and requires at least four simultaneous pseudoranges. Geometrically, each pseudorange defines not a sphere but a *thickened spherical shell* whose radius is uncertain by $c\,dt_r$; the common bias shifts all shells consistently, and the intersection of four shells fixes the receiver point and the bias jointly. The linearised least-squares update is:

$$\Delta\mathbf{x} = (\mathbf{H}^T \mathbf{W} \mathbf{H})^{-1}\mathbf{H}^T \mathbf{W}\,\Delta\mathbf{P},$$

where $\mathbf{H}$ is the geometry matrix of line-of-sight unit vectors augmented with a column of ones. The covariance $(\mathbf{H}^T\mathbf{W}\mathbf{H})^{-1}$ yields the dilution of precision (DOP) metrics: GDOP, PDOP, HDOP, VDOP, and TDOP [1].

### 4.3 RTK: double-differencing and integer ambiguity resolution

Carrier-phase positioning achieves millimetre-level observable noise ($\lambda_{L1} \approx 19$ cm, phase noise $\sim$1% of a cycle), but each measurement is biased by an unknown integer number of cycles $N^s$. Real-time kinematic (RTK) positioning resolves these integers by differencing between a *base* receiver at a known location and a *rover*.

Form the single difference between receivers $r$ and $b$ for satellite $s$, then difference again between satellites $s$ and $t$ with a reference satellite $t$. The double-differenced carrier-phase observable is:

$$\nabla\Delta\Phi^{st}_{rb} = \nabla\Delta\rho^{st}_{rb} - \nabla\Delta I^{st}_{rb} + \nabla\Delta T^{st}_{rb} + \lambda\,\nabla\Delta N^{st}_{rb} + \nabla\Delta\eta^{st}_{rb}$$

The first difference cancels the satellite clock $dt^s$; the second cancels the receiver clocks $dt_r, dt_b$. For short baselines ($<10$ km), the differential ionospheric and tropospheric terms are negligible, leaving a clean integer estimation problem [4]. The float solution is obtained by weighted least squares or a Kalman filter; the integer vector is then fixed by the **LAMBDA method** (Least-squares AMBiguity Decorrelation Adjustment), which applies a $Z$-transformation to decorrelate the ambiguities before an efficient discrete search, followed by validation (ratio test) [5]. Once fixed, the baseline is known to centimetre accuracy in real time — provided a data link (e.g., NTRIP/RTCM) delivers base observations to the rover with sub-second latency.

The open-source **RTKLIB** package (Takasu and Yasuda) implements this entire chain — single, DGPS, kinematic/static RTK, and PPP modes across GPS, GLONASS, Galileo, BeiDou, and QZSS — and remains the reference implementation against which commercial engines are benchmarked [5][6].

### 4.4 PPP: global precision without a base station

Precise point positioning (PPP), introduced by Zumberge et al. (1997), achieves centimetre accuracy with a *single* receiver by replacing the base station with precise satellite orbit and clock products (e.g., IGS final products, accurate to $\sim$2.5 cm and $\sim$75 ps respectively) and estimating the remaining errors — tropospheric zenith delay, receiver clock, and float ambiguities — as states in a Kalman filter [3].

PPP's strength is globality: no local infrastructure is needed. Its weakness is **convergence**: because ambiguities are estimated as real-valued states rather than fixed integers, the filter typically requires 20–30 minutes to converge to centimetre accuracy, and any cycle slip or constellation change restarts the clock. **PPP-RTK** (also called PPP-AR) closes this gap by broadcasting state-space representation (SSR) corrections — satellite clocks, biases, and ionospheric/tropospheric models from a reference network — enabling integer ambiguity resolution at the user and convergence in seconds to minutes [3]. Recent vessel trials with PPP-RTK corrections demonstrated real-time decimetre-to-centimetre navigation for autonomous inland waterway navigation [8].

| Technique | Infrastructure | Accuracy | Convergence | Integer fixing |
|---|---|---|---|---|
| SPP (single point) | None | 1–3 m | Instant | No |
| DGNSS / SBAS | Reference / GEO | 0.5–1 m | Seconds | No |
| RTK | Base + data link | 1–2 cm | Seconds (fixed) | Yes (LAMBDA) |
| PPP | Precise products | 2–5 cm | 20–30 min | No (float) |
| PPP-RTK / PPP-AR | SSR corrections | 2–5 cm | Seconds–minutes | Yes |

### 4.5 Spoofing, meaconing, and signal authentication

Civil GNSS signals are *unauthenticated by design*: the spreading codes are public, the navigation message is predictable, and the signal structure is documented in interface specifications. A spoofer that synthesises a self-consistent ensemble of satellite signals can therefore capture a receiver's tracking loops — first aligning code phase and Doppler with the authentic signals, then gradually "dragging" the victim's computed position (the *drag-off* attack) [9].

The canonical demonstration remains the 2013 superyacht experiment by Humphreys, Bhatti, and Pesyna (UT Austin) with Psiaki and O'Hanlon (Cornell): from a briefcase-sized device on the upper deck of the *White Rose of Drachs*, a faint ensemble of counterfeit civil GPS signals overpowered the authentic ones about 30 miles off the Italian coast, and subtle course manipulations tricked the vessel onto a parallel track hundreds of metres from its intended line while the bridge displays showed a straight course — with no alarms raised [9][10]. Meaconing (rebroadcast of recorded authentic signals) and jamming (denial by noise) complete the threat triad.

Defences operate at three levels. *Receiver-autonomous* methods exploit physical invariants: received power monitoring, clock-bias consistency checks, angle-of-arrival diversity with multi-antenna arrays (a spoofer's signals arrive from one direction), and inertial cross-checks [10]. *Navigation message authentication (NMA)* cryptographically signs the data — but NMA cannot protect a receiver that never decodes the data, and a spoofer can simply relay signed messages (the *replay* problem). *Spreading-code authentication (SCA)* is stronger: unpredictable chips embedded in the spreading sequence cannot be generated in advance by the spoofer.

Two deployed or proposed schemes embody these ideas:

- **Galileo OSNMA** digitally signs the E1B I/NAV message using the 40 reserved bits per page, split into an 8-bit HKROOT section (headers and the Digital Signature Message) and a 32-bit MACK section (MACs and delayed keys). It implements the **TESLA** (Timed Efficient Stream Loss-tolerant Authentication) protocol: keys belong to a one-way hash chain, MACs are transmitted first, and the key that verifies them is disclosed only after a delay — so a spoofer cannot forge a MAC for a message it has not yet seen the key for. A single TESLA chain serves all satellites, allowing cross-authentication of other constellations [2].
- **Chimera**, developed by AFRL with Logan Scott and Joanna Hinks, proposes SCA for the GPS L1C signal by inserting unpredictable *markers* into the spreading code at secret intervals. Humphreys' 2013 analysis had already concluded that SCA is strictly superior to NMA for civil anti-spoofing, and Chimera's design exploits the fact that the L1C signal definition was not yet frozen, allowing authentication to be introduced without violating a legacy interface specification [7].

> **Theorem:** *Delayed disclosure.* In TESLA, if the key $K_i$ authenticating epoch $i$ is disclosed only after all receivers have committed to their received messages of epoch $i$ (loosely synchronised clocks), then no adversary lacking $K_i$ at transmission time can produce a valid MAC except with negligible probability — reducing spoofing to the strictly harder problem of real-time signal synthesis with unpredictable chips.

---

## 5. Empirical Evaluation

We synthesise representative performance figures reported across the cited literature rather than presenting new measurements.

**Signal and tracking.** The CBOC(6,1,1/11) E1 signal achieves code-tracking noise below 10 cm ($1\sigma$) at 45 dB-Hz with a 12 MHz front-end, roughly a factor of two better than L1 C/A; AltBOC(15,10) on E5 improves this further to a few centimetres, at the cost of $\sim$50 MHz analogue bandwidth [2].

**RTK performance.** Short-baseline RTK with LAMBDA fixing achieves horizontal RMS errors of 1–2 cm with time-to-first-fix of seconds under open sky; long baselines ($>50$ km) require ionosphere-weighted models and exhibit fix times of minutes, with residual double-differenced ionospheric delay the dominant error [4]. RTKLIB's `rnx2rtkp` in kinematic mode reproduces these figures on public IGS station pairs, confirming the open-source chain as a valid experimental baseline [6].

**PPP convergence.** Using IGS final products, dual-frequency ionosphere-free PPP converges to 10 cm horizontal accuracy in $\sim$20 minutes; PPP-AR with SSR corrections achieves centimetre accuracy within 1–2 minutes and supported autonomous lock entry in the reported vessel campaign [3][8].

**Spoofing and detection.** In the superyacht trial, the spoofer — roughly \$2,000 of software-defined radio hardware — captured the victim receiver without triggering any receiver alarm, displacing the vessel by hundreds of metres; the Cornell two-antenna detector flagged the attack before the vessel was 20 m off course in the repeat experiment, via carrier-phase differencing between antennas that is inconsistent with a single direction of arrival [9][10]. OSNMA, in public observation since 2021, authenticates navigation data within $\sim$2 minutes of cold start at the cost of 40 bits per I/NAV page and a loose time-synchronisation requirement of a few seconds [2].

```python
# Double-differenced carrier-phase residual (illustrative, short baseline)
import numpy as np

def dd_carrier_phase(phi_r, phi_b, ref_idx):
    """phi_r, phi_b: carrier-phase (cycles) at rover/base, shape (n_sat,).
    Returns double-differenced observables w.r.t. reference satellite."""
    sd = phi_r - phi_b            # satellite clock cancels
    dd = sd - sd[ref_idx]         # receiver clocks cancel
    return np.delete(dd, ref_idx) # n_sat - 1 independent DDs

# LAMBDA-style integer rounding (decorrelation omitted for brevity)
float_amb = np.array([3.02, -1.97, 5.01])
fixed_amb = np.round(float_amb)   # -> [3, -2, 5]; validate via ratio test
```

---

## 6. Limitations

Several limitations bound the claims above. *First*, BOC's multipath advantage assumes adequate front-end bandwidth; narrowband ($\leq 4$ MHz) mass-market receivers see little benefit from CBOC's high-frequency components and remain multipath-limited in urban canyons. *Second*, RTK's centimetre accuracy is contingent on continuous carrier-phase tracking: cycle slips from foliage, bridges, or ionospheric scintillation force re-convergence, and the ratio-test validation admits a small but nonzero wrong-fixing probability ($\sim 10^{-3}$ per epoch in harsh conditions) that can go undetected for seconds [4]. *Third*, PPP convergence remains fundamentally limited by the observability of the float ambiguities; even PPP-RTK requires a reference network dense enough ($\sim$50–70 km spacing) to model the ionosphere, which does not exist in oceanic or polar regions. *Fourth*, OSNMA authenticates only the navigation *data*, not the ranging *code*: a sophisticated spoofer that relays authentic signals with modified delays (meaconing with delay control) can still shift position while passing data authentication — which is precisely the gap Chimera's spreading-code authentication is designed to close, at the cost of modifying the signal-in-space [2][7]. *Fifth*, all cryptographic schemes assume secure key management and loosely synchronised receiver clocks; a receiver with an untrusted clock can be defeated by a spoofer that also falsifies time.

## 7. Conclusion

GNSS is a triumph of layered engineering: spread-spectrum signals designed in the 1970s still deliver metre accuracy to billions of devices, BOC modulation and wideband Galileo signals push code precision toward the millimetre regime, double-differenced carrier phase with LAMBDA integer fixing delivers real-time centimetre positioning wherever a base station or network exists, and PPP extends that precision globally at the price of convergence time. The same openness that made GNSS ubiquitous, however, makes it spoofable — as the superyacht demonstration proved beyond theoretical doubt. The field is converging on defence in depth: receiver-autonomous consistency checks for immediate deployment, OSNMA/TESLA data authentication as the first cryptographic layer (already transmitting on Galileo E1), and spreading-code authentication in the Chimera mould as the long-term answer for safety-critical users.

## References

[1] E. D. Kaplan and C. J. Hegarty (eds.), *Understanding GPS/GNSS: Principles and Applications*, 3rd ed., Artech House, 2017. (Review: The Aeronautical Journal, Cambridge University Press.) https://www.cambridge.org/core/journals/aeronautical-journal/article/understanding-gpsgnss-principles-and-applications-third-editionedited-by-e-d-kaplan-and-c-j-hegarty-artech-house-16-sussex-street-london-sw1v-4rw-uk-2017-xxi-993pp-illustrated-155-isbn-9781630810580/4DFA107598E2D614B3BD20003D35B95B

[2] European Space Agency, "Galileo Open Service Navigation Message Authentication," Navipedia. https://gssc.esa.int/navipedia/index.php?title=Galileo_Open_Service_Navigation_Message_Authentication&direction=prev&oldid=15659

[3] P. J. G. Teunissen and A. Khodabandeh, "PPP–RTK functional models formulated with undifferenced and uncombined GNSS observations," *Satellite Navigation*, 2022. https://link.springer.com/article/10.1186/s43020-022-00064-4

[4] "Long-Baseline Real-Time Kinematic Positioning: Utilizing Kalman Filtering and Partial Ambiguity Resolution with Dual-Frequency Signals from BDS, GPS, and Galileo," *Aerospace*, vol. 11, no. 12, 970, 2024. https://www.mdpi.com/2226-4310/11/12/970

[5] T. Takasu and A. Yasuda, "Development of the low-cost RTK-GPS receiver with an open source program package RTKLIB," 2009. https://www.semanticscholar.org/paper/Development-of-the-low-cost-RTK-GPS-receiver-with-Takasu-Yasuda/22a2003edb2c8962b8c96975029810c62c66389b

[6] T. Takasu, "RTKLIB: An Open Source Program Package for GNSS Positioning," GitHub. https://github.com/tomojitakasu/RTKLIB

[7] "New Chimera Signal Enhancement Could Spoof-Proof GPS Receivers," *Inside GNSS*. https://insidegnss.com/new-chimera-signal-enhancement-could-spoof-proof-gps-receivers/

[8] "From RTK to PPP-RTK: towards real-time kinematic precise point positioning to support autonomous driving of inland waterway vessels," *GPS Solutions*, Springer, 2023. https://link.springer.com/article/10.1007/s10291-023-01428-2

[9] Cornell Chronicle, "Cruising high seas, engineers detect fake GPS signals," 2014 (Humphreys/Bhatti/Pesyna superyacht spoofing demonstration; Psiaki/O'Hanlon detection). https://news.cornell.edu/stories/2014/07/cruising-high-seas-engineers-detect-fake-gps-signals

[10] "Spoofer and Detector: Battle of the Titans at Sea," *GPS World* (two-antenna spoofing detection aboard the White Rose of Drachs). https://gpsworld.com/spoofer-and-detector-battle-of-the-titans-at-sea/
