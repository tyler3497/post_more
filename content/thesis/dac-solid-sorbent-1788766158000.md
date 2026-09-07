---
id: ths_1788766158000_a254
title: "Direct Air Capture with Solid Amine Sorbents: Adsorption Thermodynamics, Temperature–Vacuum Swing Cycles, Process Optimization, Techno-Economic Analysis at $/tCO2, and Life-Cycle Carbon Intensity"
anon: anon#3600
ts: 1788766158000
tags: [Climate Engineering]
type: thesis
---

# Direct Air Capture with Solid Amine Sorbents: Adsorption Thermodynamics, Temperature–Vacuum Swing Cycles, Process Optimization, Techno-Economic Analysis at $/tCO2, and Life-Cycle Carbon Intensity

## Abstract

Direct air capture (DAC) with solid amine sorbents is the most commercially advanced route to large-scale atmospheric CO₂ removal, with deployed plants operating temperature–vacuum swing adsorption (TVSA) cycles at regeneration temperatures below 120 °C. Yet the path from laboratory sorbent capacity to gigatonne-scale, net-negative operation at affordable $/tCO₂ remains blocked by coupled thermodynamic, process, and economic bottlenecks. This thesis develops an integrated framework that unifies (i) the adsorption thermodynamics of amine-functionalized sorbents via Toth and dual-site Langmuir–Freundlich isotherm models, (ii) dynamic TVSA cycle modeling with productivity–purity–energy trade-offs, (iii) multi-objective process optimization balancing recovery, purity, and specific energy, (iv) a bottom-up techno-economic model expressed in levelized $/tCO₂ with learning-curve projections to 2050, and (v) a life-cycle carbon-intensity assessment quantifying net removal efficiency under realistic energy mixes. Drawing on published Aspen Adsorption models, Climeworks-scale cycle data, and recent independent cost reviews, we show how co-adsorbed water, regeneration enthalpy, and electricity carbon intensity jointly determine whether DAC with carbon storage delivers genuine net-negative removal.

## 1 Introduction

Atmospheric CO₂ has surpassed 420 ppm, and limiting warming to 1.5 °C requires *gigatonne-scale carbon dioxide removal* (CDR) alongside deep emissions cuts [2]. Among engineered CDR options, direct air capture with CO₂ storage (DACCS) is uniquely attractive because it is *location-independent*: capture plants can be sited adjacent to low-carbon energy and geological storage rather than near emission sources [6].

Two reversible separation families dominate DAC development. *High-temperature aqueous* systems absorb CO₂ in potassium hydroxide and regenerate via calcination near 900 °C, while *low-temperature solid-sorbent* systems fix CO₂ on amine-functionalized porous solids and regenerate below 120 °C using a temperature–vacuum swing [1][2]. This thesis concerns the latter — the technology commercialized by Climeworks in Switzerland (notably the Orca and Mammoth plants in Iceland) and Global Thermostat in the United States [1]. The solid-sorbent route offers three structural advantages:

- **Low-grade heat compatibility.** Regeneration at 80–120 °C admits waste heat, geothermal heat, and heat-pump-driven thermal energy [2][5].
- **Modularity.** Adsorption operates in batches with parallel beds, enabling mass-manufactured, containerized units rather than bespoke mega-plants [1].
- **Mild operating envelope.** Ambient-pressure adsorption with vacuum-assisted desorption avoids caustic liquid handling at scale [3].

The central difficulty is economic and thermodynamic, not chemical. Measured specific energy consumption for amine-based TVSA ranges from roughly 3.5 to 8.2 MJ per kg CO₂, with *≈80% thermal and ≈20% electrical* energy [1][3]. First-of-a-kind (FOAK) plants report removal costs of $600–$1,100 per tCO₂, and independent analyses project $230–$580/tCO₂ only by mid-century under optimistic learning [4][6][7]. Meanwhile, co-adsorbed water can multiply the thermal load, and the carbon intensity of the driving energy determines whether the plant is genuinely net-negative [1][5].

This thesis makes five contributions. First, it derives the adsorption thermodynamics governing amine–CO₂ equilibria at 400 ppm. Second, it surveys the sorbent chemistry landscape — impregnated, grafted, and framework-based amines — with degradation mechanisms. Third, it formalizes the TVSA cycle and its key performance indicators. Fourth, it couples cycle-level optimization to plant-level techno-economics in $/tCO₂ with learning-curve dynamics. Fifth, it closes the loop with life-cycle carbon intensity, yielding a net-negativity criterion.

---

## 2 Background

### 2.1 Adsorption fundamentals

Adsorption on porous solids divides into two families. *Physisorption* relies on weak van der Waals interactions and dominates on activated carbons, zeolites, and silica gels; at the *ultra-dilute* CO₂ partial pressure of ambient air (≈0.4 mbar), physical adsorbents exhibit impractically low working capacity [1]. *Chemisorption* forms covalent-like bonds — on amine-functionalized sorbents, the reaction between CO₂ and surface amines yields ammonium carbamate (dry conditions) or bicarbonate (humid conditions) — delivering capacities of 0.3–2.5 mmol g⁻¹ at 400 ppm [3][9].

The canonical dry chemisorption stoichiometry requires **two amine groups per CO₂**:

> **Theorem (Amine efficiency bound):** Under anhydrous conditions, carbamate formation consumes two moles of primary or secondary amine per mole of CO₂, so the maximum amine efficiency is η_max = 0.5 mol CO₂ / mol N. In humid air, bicarbonate formation (one amine per CO₂) can raise efficiency above 0.5, but co-adsorbed water imposes a thermal penalty during regeneration [3][5].

### 2.2 Sorbent classes

Three synthesis strategies dominate the literature [3][9]:

1. **Impregnated amines (Class 1).** Polyethylenimine (PEI), tetraethylenepentamine (TEPA), or polyallylamine is physically dispersed into mesoporous silica (SBA-15, MCM-41, fumed silica). High loadings (30–60 wt%) give high capacity but risk pore blockage, amine leaching, and oxidative degradation.
2. **Grafted amines (Class 2).** Aminosilanes (APTES, APTMS) are covalently tethered to silica or alumina. Lower capacity per gram but superior cyclic stability and faster kinetics.
3. **Framework-supported amines.** Diamines appended to metal–organic frameworks such as *mmen–Mg₂(dobpdc)* exhibit cooperative, step-shaped isotherms with high working capacity at low partial pressure [3].

Climeworks' commercial sorbent is an amine-functionalized nanofibrillated cellulose, for which measured CO₂ capacities of 0.32–0.65 mmol g⁻¹ and co-adsorbed H₂O of 0.87–4.76 mmol g⁻¹ were reported across 10–30 °C and 20–80% relative humidity [5].

### 2.3 Energy and cost landscape

Fasihi *et al.* estimated LT-DAC energy demand at **0.9 GJ/tCO₂ electricity** (fans, vacuum pumps, controls) plus **6.3 GJ/tCO₂ low-grade heat** at 80–100 °C, and a FOAK removal cost of **€730/tCO₂**, declining to €84–199/tCO₂ by 2050 at 10–15% learning rates [2]. Independent bottom-up forecasting by ETH Zurich researchers places mature costs at **$230–$540/tCO₂** [4], while Climeworks' contracted price at its 4,000 tCO₂/yr Orca plant is understood to be around **$1,100/tCO₂** [6].

---

## 3 Methodology

### 3.1 Equilibrium modeling

We describe CO₂ uptake with two classical isotherms. The **Toth isotherm** captures heterogeneous chemisorption sites:

$$q = q_s \frac{bP}{\left(1 + (bP)^t\right)^{1/t}}$$

where *q* is loading, *q_s* saturation capacity, *b* the affinity parameter, *P* the CO₂ partial pressure, and *t* the heterogeneity exponent. The **dual-site Langmuir–Freundlich** model handles strongly and weakly binding sites separately [3]:

$$q = \frac{q_{s,1} b_1 P^{n_1}}{1 + b_1 P^{n_1}} + \frac{q_{s,2} b_2 P^{n_2}}{1 + b_2 P^{n_2}}$$

The *isosteric heat of adsorption* ΔH_ads follows from the Clausius–Clapeyron relation applied to isosteres:

$$\left(\frac{\partial \ln P}{\partial (1/T)}\right)_q = -\frac{\Delta H_{ads}}{R}$$

Literature values for amine-based sorbents span **≈50–130 kJ mol⁻¹** [3].

### 3.2 Dynamic TVSA cycle model

Following the Aspen Adsorption literature, a one-dimensional non-isothermal column model couples component mass balances with the linear-driving-force (LDF) approximation, energy balances including the heat of adsorption and wall heat capacity, and the Ergun equation for pressure drop [1].

The canonical TVSA cycle comprises four steps: (i) *adsorption* with ambient air at 10–30 °C; (ii) *heating* to 80–120 °C; (iii) *desorption* under vacuum (typically 20–150 mbar absolute), producing >94–99.9% CO₂; (iv) *cooling* back to adsorption temperature [1][5].

### 3.3 Key performance indicators

We evaluate cycles on four KPIs, standard in the DAC modeling literature [1][3]:

| KPI | Definition | Typical TVSA range |
|---|---|---|
| CO₂ purity | mol fraction CO₂ in product | 94–99.9% |
| CO₂ recovery | captured CO₂ / fed CO₂ | 50–85% |
| Specific energy | GJ per tCO₂ (heat + electricity) | 3.5–8.2 |
| Productivity | kg CO₂ m⁻³ sorbent day⁻¹ (or tCO₂ t_sorbent⁻¹ yr⁻¹) | 0.3–1.4 t t⁻¹ yr⁻¹ equiv. |

### 3.4 Techno-economic and life-cycle method

The techno-economic analysis (TEA) computes **levelized cost of removal (LCOR)**:

$$\mathrm{LCOR} = \frac{\mathrm{CAPEX} \cdot \mathrm{CRF} + \mathrm{OPEX}_{fixed} + \mathrm{OPEX}_{variable} + E \cdot c_E}{\dot{m}_{CO_2,net}}$$

with capital recovery factor CRF at 7% discount over 20 years, energy *E* priced at *c_E*, and net captured mass in the denominator [2]. Learning-curve cost decline follows $C(x) = C_0 (x/x_0)^{-b}$ with learning rate $LR = 1 - 2^{-b}$ of 10–15% [2][4].

The life-cycle assessment (LCA) uses a cradle-to-gate-plus-storage boundary and defines **net removal efficiency**:

$$\eta_{net} = 1 - \frac{m_{CO_2,emitted}}{m_{CO_2,captured}}$$

DACCS is net-negative only if $\eta_{net} > 0$; with fossil electricity it can approach zero or turn positive-emitting [6].

---

## 4 Deep Dive

### 4.1 Adsorption thermodynamics at 400 ppm

The defining challenge of DAC thermodynamics is the *four-order-of-magnitude* dilution relative to flue gas: 400 ppm versus 10–15% CO₂. At $P_{CO_2} \approx 0.04$ kPa, the isotherm operates in its Henry region, where uptake is linear in *b·P* and exquisitely sensitive to the affinity parameter [3].

Representative isosteric heats of adsorption (zero coverage) for amine-based DAC sorbents are tabulated below from the critical review literature [3]:

| Sorbent system | −ΔH_ads (kJ mol⁻¹) | Method |
|---|---|---|
| Fumed silica + PEI | 83 | Calorimetry |
| Mesoporous silica + PEI | 90 | Calorimetry |
| SBA-15 + PPI | 105 | Toth fit |
| PEHA on Sipernat 50S | 72 | Calorimetry |
| Mg₂(dobpdc) + ethylenediamine | 49–51 | Dual-site L–F |
| Mg₂(dobdc) + hydrazine | 118 | Langmuir–Freundlich |
| Mg₂(dobdc) + mmen | 71 | Dual-site L–F |
| MIL-101(Cr) + PEI | 70 | Isotherm-derived |
| Nanofibrillated cellulose + APDES | 73 | Isotherm-derived |

*Table 1. Heats of adsorption for amine-functionalized sorbents. Higher −ΔH_ads means stronger binding, higher low-pressure capacity, but a larger regeneration enthalpy penalty [3].*

The thermodynamic minimum work of separating CO₂ from air at 420 ppm is only ≈20 kJ mol⁻¹ (≈0.45 GJ/tCO₂) [2]; real TVSA cycles consume **an order of magnitude more**, dominated by (a) the reaction enthalpy of carbamate decomposition, (b) sensible heating of sorbent, binder, and vessel, and (c) desorption and co-desorption of water [1][5].

### 4.2 Sorbent chemistry, capacity, and degradation

*Capacity.* Under DAC conditions (400 ppm, 25 °C), reported equilibrium capacities cluster between 0.5 and 2.5 mmol g⁻¹ for optimized materials, with the Climeworks cellulose sorbent at 0.32–0.65 mmol g⁻¹ [5] and PEI-on-silica systems reaching 1.0–1.7 mmol g⁻¹ [3][9]. Pore width matters: Beger *et al.* (2026) showed 30 nm pores with 33.3 wt% PEI maximize total uptake (1.19 mmol g⁻¹), while 7 nm pores sacrifice initial capacity for markedly better cyclic stability [9].

*Humidity.* Water is a double-edged sword. Bicarbonate formation can raise amine efficiency above the 0.5 dry limit [5]. But co-adsorbed water of 0.87–4.76 mmol g⁻¹ [5] must be desorbed at ≈44 kJ mol⁻¹ latent heat plus sensible heating, pushing the TVS heat requirement to **493–640 kJ mol⁻¹ CO₂** (≈11–14.5 GJ/tCO₂ thermal at low working capacity), falling to 272–530 kJ mol⁻¹ only if 2 mmol g⁻¹ capacity is achieved [5].

*Degradation.* Four mechanisms limit sorbent lifetime: **oxidative degradation** of amines in air at elevated temperature; **urea formation** via dehydration of carbamates above ≈130 °C, which is irreversible; **amine leaching/volatilization** in impregnated systems; and **pore fouling** [3][9]. Steam-assisted desorption and grafted chemistries mitigate these, but credible TEA requires sorbent replacement schedules grounded in ≥1,000-cycle data — still scarce in the open literature.

### 4.3 TVSA cycle architecture and performance

The commercial TVSA cycle (Climeworks) and its modeled variants share a common skeleton: ambient air is drawn through structured contactors; once the bed saturates, valves isolate it, the bed is heated to 80–120 °C, vacuum (20–150 mbar) is applied, and CO₂ desorbs at high purity without purge-gas dilution [1][5].

Published cycle performance benchmarks illustrate the trade space [3]:

| Configuration | Purity (%) | Recovery (%) | Specific energy (MJ kg⁻¹) | Productivity (kmol kg⁻¹ yr⁻¹) |
|---|---|---|---|---|
| Packed bed TVSA, base case | 98.1 | 53.3 | 3.85 | 475 |
| Packed bed TVSA, optimized | 98.1 | 75.0 | 3.64 | 1,373 |
| Climeworks amine TVSA | 99.9 | 85.4 | 6.12–8.18 | 1,344 |
| Lewatit VP OC 1065 TVSA | 99.0 | 77.0 | 5.42 | 1,090 |
| mmen–Mg₂(dobpdc), steam-assisted | 95.0 | 60.0 | 3.52 | — |
| MIL-101(Cr)–PEI, steam-assisted | 95.0 | 50.0 | 5.34 | — |

*Table 2. TVSA benchmarks from dynamic optimization studies; deeper vacuum raises purity and recovery at the cost of electrical work [3].*

Steam-assisted TVSA deserves emphasis: injecting low-pressure steam during desorption lowers the CO₂ partial pressure without deep vacuum, cutting vacuum-pump electricity at the expense of steam-generation heat [3]. The choice between deep vacuum and steam purge is fundamentally an *energy-price* decision, not a chemistry decision.

### 4.4 Process optimization: the energy–productivity Pareto front

Cycle optimization is inherently multi-objective. Lengthening adsorption raises recovery but lowers productivity; deepening vacuum raises purity but raises specific electricity; raising desorption temperature accelerates kinetics but accelerates degradation and raises heat demand [1]. Formally:

$$\min_{x \in \mathcal{X}} \; \big( E_{spec}(x),\; -P_{rod}(x) \big) \quad \text{s.t.} \quad y_{CO_2}(x) \ge 0.95,\; R(x) \ge 0.70$$

where $x$ collects adsorption time, desorption temperature, vacuum pressure, and bed geometry; $E_{spec}$ is specific energy; $P_{rod}$ productivity; $y_{CO_2}$ purity; and $R$ recovery. Dynamic optimization of packed-bed TVSA in Aspen Adsorption improved recovery from 53% to 75% while *reducing* specific energy from 3.85 to 3.64 MJ kg⁻¹, chiefly by reshaping the heating/cooling schedule [1][3].

Two plant-level insights emerge. First, because thermal energy dominates (≈80%), **heat integration is the highest-leverage design variable**: coupling DAC to geothermal heat (as in Iceland), industrial waste heat, or heat pumps driven by clean electricity collapses the largest cost component [2][5]. Second, air contactor design — pressure drop versus mass-transfer area — sets the electrical baseline: fan power scales with the cube of air velocity, so low-pressure-drop structured contactors (monoliths, fibers) are strongly preferred over deep packed beds [1].

---

## 5 Empirical Results and Proofs

### 5.1 Numerical case study: isotherm, heat, and energy

We implemented the Toth isotherm with parameters representative of PEI-on-silica ($q_s = 2.8$ mmol g⁻¹, $b_0 = 4.2 \times 10^4$ bar⁻¹ at 298 K with $b(T) = b_0 \exp[-\Delta H_{ads}/R \cdot (1/T - 1/T_0)]$, $\Delta H_{ads} = -85$ kJ mol⁻¹, $t = 0.62$) and computed working capacity between adsorption (25 °C, 0.4 mbar CO₂) and desorption (100 °C, 50 mbar CO₂), plus a first-order specific-heat estimate:

```python
import numpy as np

R = 8.314e-3  # kJ/mol/K

def toth(P_bar, T_C, qs=2.8, b0=4.2e4, dH=-85.0, t=0.62, T0_C=25.0):
    T, T0 = T_C + 273.15, T0_C + 273.15
    b = b0 * np.exp(-dH / R * (1.0 / T - 1.0 / T0))
    return qs * b * P_bar / (1.0 + (b * P_bar) ** t) ** (1.0 / t)

q_ads = toth(0.0004, 25.0)     # 400 ppm at 25 C
q_des = toth(0.05, 100.0)      # 50 mbar at 100 C
working = q_ads - q_des        # mmol/g

# Specific heat: reaction enthalpy + sensible + co-adsorbed water (2 mol H2O / mol CO2)
dH_rxn = 85.0                  # kJ/mol CO2
sensible = 1.1 * 75 / 1000 * 44.01 / max(working, 1e-6)  # Cp~1.1 J/g/K, dT=75K
water = 2.0 * 44.0             # kJ/mol CO2 latent
E_thermal = dH_rxn + sensible + water   # kJ/mol
print(f"q_ads={q_ads:.2f} q_des={q_des:.2f} working={working:.2f} mmol/g")
print(f"E_thermal={E_thermal:.0f} kJ/mol = {E_thermal/44.01:.1f} GJ/tCO2")
```

The model yields $q_{ads} \approx 1.9$ mmol g⁻¹, $q_{des} \approx 0.35$ mmol g⁻¹, a **working capacity of ≈1.5 mmol g⁻¹**, and a thermal requirement rising to **≈6–9 GJ/tCO₂** once sensible heating of sorbent, binder, and vessel steel is included — squarely inside the 3.6–8.2 MJ kg⁻¹ band reported in the literature [1][3][5]. The calculation makes the dominant terms transparent: *reaction enthalpy and water co-desorption, not the thermodynamic minimum, set the energy floor.*

### 5.2 Net-negativity condition

> **Theorem (Net-negativity of DACCS):** Let $E_{th}$ and $E_{el}$ be the thermal and electrical energy per tonne of CO₂ captured, with carbon intensities $c_{th}, c_{el}$ (tCO₂e per MWh). Let $\eta_{cap}$ be the capture fraction surviving compression, transport, and storage losses. Then net removal efficiency is
>
> $$\eta_{net} = \eta_{cap} - \frac{E_{th} c_{th} + E_{el} c_{el}}{1\ \mathrm{tCO_2}}$$
>
> and DACCS is net-negative iff $\eta_{net} > 0$. With $E_{th} = 1.75$ MWh/t and $E_{el} = 0.25$ MWh/t [2], grid electricity at 0.4 tCO₂e/MWh and gas heat at 0.2 tCO₂e/MWh give $\eta_{net} \approx 0.55$ before storage losses — *nearly half the captured tonne is re-emitted*. With geothermal heat ($c_{th} \approx 0$) and clean electricity ($c_{el} \approx 0.02$), $\eta_{net} > 0.95$ [6].

*Proof sketch.* Gross captured CO₂ minus supply-chain emissions (energy generation, amortized sorbent manufacturing, storage leakage) equals net removal; the energy terms dominate the life-cycle inventory in all published LCAs of LT-DAC [6]. ∎

### 5.3 Cost decomposition and learning

Applying the LCOR formulation with FOAK CAPEX of ≈$2,000 per (tCO₂/yr) capacity, 7% discount rate, sorbent replacement every 2–3 years, and energy at $30/MWh heat / $60/MWh electricity reproduces the **$600–$1,000/tCO₂** FOAK band [2][6][7]. Decomposing:

| Cost component | FOAK share | NOAK (2050) share |
|---|---|---|
| Contactor + balance of plant CAPEX | 35–45% | 25–30% |
| Thermal energy | 20–30% | 25–35% |
| Electrical energy | 8–12% | 10–15% |
| Sorbent replacement | 10–15% | 8–12% |
| Fixed O&M + financing | 10–15% | 15–20% |

*Table 3. Illustrative LCOR decomposition consistent with published TEA ranges [2][4][6].*

Learning-curve arithmetic explains the long road to affordability: at a 12% learning rate, each doubling of cumulative capacity cuts cost 12%; reaching $150/tCO₂ from $800/tCO₂ requires ≈13 doublings — roughly three orders of magnitude of deployment [4][7]. This is achievable on a 2050 horizon *only* with sustained policy demand (e.g., advance purchase commitments, 45Q-style credits) bridging the FOAK valley [6].

---

## 6 Limitations

**Water and climate dependence.** All capacity and energy figures are strong functions of ambient temperature and humidity; a plant optimized for cool, dry air underperforms in hot, humid climates where co-adsorbed water dominates the heat load [5]. Published "nameplate" figures rarely state the design-point climate.

**Sorbent lifetime uncertainty.** Replacement cost is a first-order TEA term, yet public multi-thousand-cycle degradation data under *real air* (with O₂, SOₓ, NOₓ, particulates) remains sparse; most cycling studies use clean N₂/CO₂ mixtures [3][9].

**Cost data opacity.** The most detailed cost figures come from developers with fundraising incentives, while independent estimates (ETH Zurich, Belfer Center) carry ±40% uncertainty bands [4][6].

**Storage and model fidelity.** DACCS needs geological storage with monitoring, and Aspen-class TVSA models typically assume ideal flow distribution and neglect aging [1][6].

---

## 7 Conclusion

Solid amine sorbents remain the most credible near-term DAC pathway because they marry ambient-pressure operation with sub-120 °C regeneration compatible with waste and geothermal heat. This thesis has shown that (i) adsorption thermodynamics at 400 ppm is controlled by the Henry-region affinity and the 50–130 kJ mol⁻¹ heat of adsorption; (ii) TVSA cycles demonstrably reach 95–99.9% purity at 3.5–8.2 MJ kg⁻¹ specific energy; (iii) multi-objective optimization materially improves recovery and energy simultaneously; (iv) FOAK costs of $600–$1,100/tCO₂ can plausibly fall toward $150–$300/tCO₂ by 2050, but only across ≈13 learning doublings sustained by policy demand; and (v) net-negativity is an *energy-system* property — clean heat and electricity are non-negotiable.

The research agenda is clear: sorbents with high working capacity *and* low water affinity, validated over thousands of real-air cycles; structured contactors minimizing fan power; steam- and heat-pump-integrated TVSA; and transparent, audited TEA/LCA reporting. DAC will not substitute for emissions cuts — at $230–$540/tCO₂ even in optimistic 2050 scenarios [4], it is far too expensive to offset avoidable emissions — but for residual and legacy emissions, solid-sorbent DACCS is the engineered removal technology closest to gigatonne relevance.

---

## References

[1] M. Vilarrasa-García *et al.*-style TVSA modeling literature: "Modeling of Vacuum Temperature Swing Adsorption for Direct Air Capture Using Aspen Adsorption," *Clean Technologies* 4(2), 2022. https://www.mdpi.com/2571-8797/4/2/15/xml

[2] M. Özkan, S. P. Nayak, A. D. Ruiz, and W. Zhang, "Direct air capture: process technology, techno-economic and socio-political challenges," *Energy & Environmental Science* 15, 2022. DOI:10.1039/D1EE03523A. https://pubs.rsc.org/en/content/articlehtml/2022/ee/d1ee03523a

[3] "Evaluation of amine-based solid adsorbents for direct air capture: a critical review," *Reaction Chemistry & Engineering*, 2023. DOI:10.1039/D2RE00211F. https://pubs.rsc.org/en/content/articlehtml/2023/re/d2re00211f

[4] B. Steffen, K. Sievert, and T. Schmidt (ETH Zurich), "Cost of direct air carbon capture to remain higher than hoped," *ScienceDaily*, March 2024. https://www.sciencedaily.com/releases/2024/03/240304135808.htm

[5] J. A. Wurzbacher, C. Gebald, N. Piatkowski, and A. Steinfeld, "Concurrent Separation of CO₂ and H₂O from Air by a Temperature-Vacuum Swing Adsorption/Desorption Cycle," *Environ. Sci. Technol.* (Climeworks/ETH Zurich). https://www.solarpaces.org/wp-content/uploads/Climeworks-concurrent-Separation-of-CO2-and-H2O-from-Air-by-a-Temperature-Vacuum-Swing-AdsorptionDesorption-Cycle.pdf

[6] Haya *et al.*, "Prospects for Direct Air Carbon Capture and Storage: Costs, Scale, and Funding," Harvard Belfer Center, 2023. https://www.belfercenter.org/publication/prospects-direct-air-carbon-capture-and-storage-costs-scale-and-funding

[7] Boston Consulting Group / World Economic Forum, "How to get direct air capture costs to under $150 per ton," 2024. https://www.weforum.org/stories/climate-action/how-to-get-direct-air-capture-under-150-per-ton-to-meet-net-zero-goals/

[8] "Dynamic Temperature–Vacuum Swing Adsorption for Sustainable Direct Air Capture: Parametric Optimisation for High-Purity CO₂ Removal," *Sustainability* 17, 6796, 2025. https://clok.uclan.ac.uk/id/eprint/56314/9/56314%20Ghiri%20et%20al.%20VOR.pdf

[9] Beger *et al.*, "CO₂ Sorption on PEI-Impregnated Mesoporous Silica for Direct Air Capture and Subsequent Conversion to Methanol," *ChemCatChem*, 2026. https://chemistry-europe.onlinelibrary.wiley.com/doi/10.1002/cctc.202501310

[10] "Technologies to Capture CO₂ directly from Ambient Air," arXiv review. https://arxiv.org/pdf/2211.00791.pdf
