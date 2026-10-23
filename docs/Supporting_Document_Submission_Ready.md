# SolarReady Malaysia – Supporting Document

**Event**: SDP University Hackathon 2026 · Planet Track  
**Project**: SolarReady Malaysia — Verifiable Rooftop Solar & Township Aggregation Platform  

---

## 1. About this document

This single document replaces separate appendices. It explains how SolarReady works, which parts are verified, and which parts are assumptions that still need validation. We have tried to be clear about what is measured, what is modelled, and what is planned.

**Evidence status at submission:**

| Item | Status |
| :-- | :-- |
| **Working prototype** (upload, calibration, roof editor, panel packing, 3D twin, report, planner, economics sandbox) | Built and demonstrated in the demo video & online repository |
| **Backend automated tests** | **31 tests pass (100% pass rate)** (geometry, calibration, energy, economics, API) |
| **Interviews with installers, agents or homeowners** | **Field hypotheses derived from industry practice; formal pilot interviews planned** for the Top 10 mentoring phase (see Section 7) |
| **Cost, premium and sales-speed figures** | **Modelling assumptions and sensitivity hypotheses**, not final measured field data |
| **Pilot with real homes** | **Proposed implementation roadmap.** Formal collaboration with SDP and licensed contractors to be formalized upon selection |

---

## 2. Problem we address

Residential rooftop solar quotes in Malaysia are often prepared from unscaled satellite screenshots. This creates three critical industry risks:

- **Unreliable system size**: Without calibrated scale ($m/\text{pixel}$), the number of panels that physically fit is a guess, frequently causing on-site contractor disputes.
- **Hidden obstacles**: Water storage tanks, air-conditioning compressors, and plumbing vents reduce usable roof area and are routinely missed in initial sales proposals.
- **Unclear savings**: Homeowners find it hard to understand how Malaysian progressive tiered tariffs (TNB Tarif A) and Solar ATAP rules affect real financial return.

For a master developer such as **Sime Darby Property (SDP)**, the same verified data helps plan "Solar-Ready" homes at the architectural blueprint stage and evaluate township-level Virtual Power Plant (VPP) potential.

---

## 3. Method: Zero-Hallucination Roof Geometry & Physical Constraints

Panel positions are strictly computed using **Python Shapely 2D computational geometry**, never drawn or hallucinated by generative AI:

1. **Scale Calibration**: The user calibrates scale by drawing a known reference length on the image ($\text{metres\_per\_pixel} = \text{known metres} \div \text{pixels}$).
2. **Perimeter Setback (0.50 m)**: The roof polygon is shrunk inward by a **0.50 m edge setback**.  
   *Official Source*: Adheres to **Jabatan Bomba dan Penyelamat Malaysia (BOMBA) Fire Safety Guidelines for Rooftop Solar PV Installations (2020)** and **MS IEC 62446**, requiring minimum 500mm perimeter clearances for firefighter roof access and wind-uplift vortex mitigation.
3. **Obstacle Clearance Buffer (0.30 m)**: Each obstacle is enlarged outward by a **0.30 m clearance buffer** and subtracted from the usable area.  
   *Official Source*: Aligns with **MS 1837:2010 Code of Practice for Grid-Connected PV Systems** and SEDA technical guidance, ensuring technician maintenance walkways and preventing localized thermal dissipation hotspotting.
4. **Inter-Module Mid-Clamp Spacing (0.02 m / 20 mm)**:  
   *Official Source*: Standard commercial solar aluminum mid-clamp and racking specifications (e.g. Clenergy, Antai, Schletter standard 18mm–22mm mounting gap) to accommodate thermal expansion of silicon frames under $35^\circ\text{C}$ ambient temperatures.
5. **Standard Panel Dimensions (1.762 m × 1.134 m, 440W)**:  
   *Official Source*: Standard Tier-1 residential 54-cell/108-half-cell monocrystalline module specifications (e.g., **JinkoSolar Tiger Neo N-Type 54HL4R-V 440W** and **LONGi Hi-MO 6 Explorer 435–445W**, exact dimensions: $1762 \times 1134 \times 30\text{ mm}$).
6. **Strict Containment Rule**: Candidate panels (portrait or landscape) are placed on a tessellated grid. A panel is kept **only if the net usable area fully contains it** (`UsableArea.covers(Panel) == True`).

Automated backend unit tests verify that zero panels intersect the setback or obstacle buffers. The result is 100% collision-free in the computational model.

---

## 4. Method: Energy Yield & Microclimate Model

- **Solar Resource Baseline**: European Commission Joint Research Centre (**EC JRC PVGIS-SARAH2 / PVcalc API**) with a Peninsular Malaysia specific yield benchmark of **$1,385\text{ kWh / kWp / year}$** (benchmarked at City of Elmina coordinates: $3.185^\circ\text{ N}, 101.512^\circ\text{ E}$, optimal $10^\circ-15^\circ$ tilt). Confirmed against SEDA Malaysia historical irradiance atlases.
- **System Losses (Modelling Assumption: Total 14.0% Tropical Derate)**:

| Physical Loss Component | Assumed Value | Engineering Source / Justification |
| :-- | :-- | :-- |
| **Thermal Temperature Derate** | **6.5%** | Standard $-0.35\%/^\circ\text{C}$ Pmax coefficient above $25^\circ\text{C}$ STC; Malaysian rooftop cells operate at $55^\circ\text{C}-60^\circ\text{C}$. |
| **Tropical Soiling & Dust** | **3.0%** | Dust and airborne particulate accumulation between monsoon rains. |
| **Inverter Efficiency** | **2.5%** | Modern Tier-1 string inverters operating at peak European weighted efficiency (~97.5%). |
| **Wiring & Mismatch** | **2.0%** | DC/AC ohmic resistance and manufacturing batch tolerance. |
| **Total System Derate** | **14.0%** | Standard conservative engineering benchmark for equatorial Peninsular Malaysia. |

---

## 5. Method: Bill Saving & TNB Utility Tariff Model

The financial engine models Peninsular Malaysia’s **TNB Domestic Tariff Schedule (Tarif A - Kediaman)** across all 5 official progressive consumption blocks:
- Band 1 (1–200 kWh): 21.80 sen/kWh
- Band 2 (201–300 kWh): 33.40 sen/kWh
- Band 3 (301–600 kWh): 39.00 sen/kWh *(Residential Baseline)*
- Band 4 (601–900 kWh): 51.60 sen/kWh
- Band 5 (>900 kWh): 57.10 sen/kWh

The report separates two revenue mechanisms under the **Suruhanjaya Tenaga (Energy Commission) Solar ATAP / NEM 3.0** policy:
- **Self-consumed solar energy ($E_{\text{self}}$)**: Offsets retail electricity purchase at the household's highest marginal tariff band (up to 57.10 sen/kWh).
- **Exported surplus energy ($E_{\text{export}}$)**: Credited at the system marginal energy charge (approximately **27.03 sen/kWh** under Solar ATAP).

$$\text{Monthly Saving} = \left(E_{\text{self}} \times \text{Tariff}_{\text{marginal}}\right) + \left(E_{\text{export}} \times \text{Rate}_{\text{ATAP}}\right)$$

The interactive Daytime Self-Consumption Slider (20% to 100%) demonstrates how shifting daytime air-conditioning or EV charging yields up to +64% higher financial return per kWh.

---

## 6. Economics Sandbox & Township Portfolio View

- **First-Principles Sandbox (`/economics`)**: Deconstructs turnkey Capex down to raw silicon wafers (Module FOB price $0.116/W OPIS benchmark, inverter BOS, mounting structure, and customer acquisition cost CAC).
  - *Strategic Hypothesis*: Developing factory-fitted "Solar-Ready" homes during construction (Greenfield) achieves **CAC = RM 0/kWp** and avoids structural tile rework, lowering delivered LCOE to **~18.9 sen/kWh** (compared to **~30.4 sen/kWh** for aftermarket retrofits).
- **Township Portfolio (`/planner`)**: Aggregates simulated residential rooftops across a master-planned community (e.g., City of Elmina) into a multi-megawatt Virtual Power Plant (VPP) asset, ranked strictly by Delivered LCOE.
- **Carbon Avoidance Formula**:
  $$\text{Annual Avoided }\text{CO}_2 = \text{Annual Generation (MWh)} \times 0.758 \text{ tCO}_2/\text{MWh}$$
  *Official Source*: Based on the latest **Suruhanjaya Tenaga (Energy Commission) Peninsular Malaysia Grid Emission Factor** (~0.758 tCO₂/MWh).

---

## 7. Proposed Pilot & Validation Roadmap (City of Elmina)

*Note: This is a structured engineering proposal for the Top 10 mentoring and pilot phase.*

- **Phase 0: Mentoring Period (October – November 2026)**:
  - Formalize stakeholder interviews with SEDA-registered EPC contractors, licensed building inspectors, and Elmina residents.
  - Benchmark SolarReady automated packing against manual CAD installation drawings across 5 sample Elmina terrace layouts.
- **Phase 1: Digital Township Audit (Months 1 – 2)**:
  - Ingest orthorectified satellite imagery of **100 contiguous terrace units in Elmina Valley 3**.
  - Calibrate scale, map obstacles, and generate automated digital twin roof profiles.
- **Phase 2: Initial Pilot Installation (Months 3 – 4)**:
  - Install solar arrays on an initial cohort of **20 volunteer homes** using SolarReady CAD layout exports, in collaboration with SDP-approved EPC partners.
  - Audit physical roof installation to verify 100% zero-collision execution.
- **Phase 3: Interconnection & Measurement (Months 5 – 6)**:
  - Connect TNB bi-directional smart meters under NEM 3.0.
  - Audit actual monthly smart-meter inverter outputs against simulated PVGIS projections (target correlation $\ge 95\%$).

---

## 8. Value to Sime Darby Property (Core Strategic Hypotheses)

1. **Real Estate Sales Premium**: Solar-ready homes support Green Building Index (GBI) credentials, commanding a **3% to 5% price premium** and accelerating sales absorption velocity.
2. **25-Year Recurring Energy Revenue**: Aggregating 1,000 residential rooftops into a 5–8 MWp Virtual Power Plant allows SDP to wheel low-cost midday power via the **CREAM / TPA framework** to adjacent Sime Darby Industrial Parks and Elmina Lakeside Mall.
3. **Zero-CAC Manufacturing Moat**: Pre-fitting conduits and mounting hardware during building construction creates an insurmountable **~38% cost advantage** over third-party aftermarket installers.
4. **ESG & Institutional Financing**: Verified, auditable Scope 3 decarbonization metrics support preferential borrowing rates on **Sustainability-Linked Sukuk (Islamic Green Bonds)**.

---

## 9. Engineering Limitations & Boundary Conditions

- Results are sensitive to source satellite resolution and accurate user scale calibration.
- The software provides preliminary engineering feasibility and does not replace on-site structural load-bearing tests or endorsement by a registered Professional Engineer (PE).
- Shading from distant tall trees or neighboring multi-storey buildings is approximated via Three.js geometric sun-path simulations, but micro-shading requires on-site irradiance verification.
- Financial projections depend on prevailing TNB tariff regulatory periods (IBR RP3 / RP4) and SEDA quota allocations.

---

## 10. Official Regulatory & Academic References Cited

1. **PVGIS-SARAH2 Solar Database**: European Commission Joint Research Centre (EC JRC), *Photovoltaic Geographical Information System*.
2. **BOMBA Fire Safety Standards**: Jabatan Bomba dan Penyelamat Malaysia, *Fire Safety Guidelines for Rooftop Photovoltaic (PV) Installations (2020)*.
3. **Malaysian PV Code of Practice**: Standards Malaysia, *MS 1837:2010 — Code of Practice for Grid-Connected Photovoltaic (PV) Systems for Buildings*.
4. **TNB Tariff Schedule**: Tenaga Nasional Berhad, *Domestic Tariff A Schedule (Incentive-Based Regulation RP3)*.
5. **Solar ATAP Framework**: Suruhanjaya Tenaga (Energy Commission) & Sustainable Energy Development Authority (SEDA Malaysia), *Self-Consumption (SELCO) and Solar ATAP Regulatory Framework (2024)*.
6. **Peninsular Grid Emission Factor**: Suruhanjaya Tenaga Malaysia, *Grid Emission Factor for Peninsular Malaysia (0.758 tCO₂/MWh)*.
7. **Module Specifications**: JinkoSolar *Tiger Neo N-type 54HL4R-V Datasheet* & LONGi *Hi-MO 6 Explorer Datasheet* ($1762 \times 1134 \times 30\text{ mm}$).
8. **Automated Verification**: SolarReady Malaysia automated pytest suite (31/31 unit & integration tests passing).
