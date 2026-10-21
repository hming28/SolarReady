# SolarReady Malaysia: Technical, Solar, and Financial Assumptions

This document outlines all physical, electrical, irradiance, and financial assumptions utilized throughout the **SolarReady Malaysia** platform for the **SDP University Hackathon 2026 (Planet Track)**.

---

## 1. Solar Resource & Irradiance Assumptions

- **Primary Source**: European Commission Joint Research Centre (EC JRC) **PVGIS API v6** (`PVcalc` endpoint).
- **Secondary / Fallback Baseline**: Sustainable Energy Development Authority (**SEDA Malaysia**) and historical PVGIS baseline for Peninsular Malaysia.
- **Geographic Reference (Demo)**: City of Elmina (Elmina West), Shah Alam, Selangor ($3.185^\circ\text{ N}, 101.512^\circ\text{ E}$).
- **Specific Yield Baseline**:
  - Conservative: $1,280 \text{ kWh/kWp/year}$
  - Base / Median: $1,385 \text{ kWh/kWp/year}$
  - Optimistic: $1,460 \text{ kWh/kWp/year}$
- **Optimal Rooftop Tilt**: $10.0^\circ$ pitch facing south (optimal for equatorial Malaysia latitude to facilitate natural rainwater self-cleaning).

---

## 2. System Loss & Derating Factors (Total 14.0%)

| Factor | Value | Rationale |
| --- | --- | --- |
| **Inverter Efficiency** | 97.5% | Modern Tier-1 string / micro-inverters. |
| **Thermal Derate** | ~6.5% | Standard $-0.35\%/^\circ\text{C}$ temperature coefficient under tropical ambient conditions ($30-35^\circ\text{C}$). |
| **Tropical Soiling & Dust** | 3.0% | Dust, pollen, and airborne particles between monsoon rains. |
| **DC/AC Wiring & Mismatch** | 2.0% | Resistance losses in cabling and module manufacturing tolerance. |
| **Total System Derate** | **14.0%** | Standard conservative industry benchmark for Peninsular Malaysia. |

---

## 3. Financial & TNB Tariff Assumptions

- **Electricity Utility**: Tenaga Nasional Berhad (TNB) Peninsular Malaysia.
- **Domestic Tariff Schedule (Tarif A - Kediaman)**:
  - Band 1 (1–200 kWh): RM 0.218 / kWh
  - Band 2 (201–300 kWh): RM 0.334 / kWh
  - Band 3 (301–600 kWh): **RM 0.390 / kWh** *(Applied as default residential baseline)*
  - Band 4 (601–900 kWh): RM 0.516 / kWh
  - Band 5 (>900 kWh): RM 0.571 / kWh
- **Export Credit Mechanism**: Net Energy Metering (NEM 3.0 Rakyat) / Solar ATAP 1:1 bill offset rate up to quota limit.
- **Self-Consumption Ratio**: Default 60.0% (user-configurable from 20% to 100% via interactive slider).
- **Turnkey Installation Cost Benchmark**: RM 3,500 / kWp (user-configurable from RM 3,000 to RM 4,500 / kWp), encompassing Tier-1 PV modules, grid-tied inverter, mounting rails, wiring, surge protection, and SEDA submission fees.
- **Payback Formula**:
  $$\text{Annual Savings} = (E_{\text{self}} \times \text{Tariff}) + (E_{\text{export}} \times \text{Export Rate})$$
  $$\text{Simple Payback (Years)} = \frac{\text{System Cost}}{\text{Annual Savings}}$$
  *(If annual savings $\le 0$, payback is marked as N/A).*

---

## 4. Geometric & Physical Rooftop Constraints

- **Scale Calibration Requirement**:
  $$\text{metres\_per\_pixel} = \frac{\text{Known Ground Length (m)}}{\text{Pixel Distance (px)}}$$
  *(Metric areas are strictly withheld if scale tier is `uncalibrated`).*
- **Roof Perimeter Setback**: Minimum 0.50m (inward buffer) for gutter clearance and wind-uplift safety.
- **Obstacle Clearance Buffer**: Minimum 0.30m (outward buffer) around rooftop water tanks, AC compressors, and vents.
- **Module Physical Gap**: 0.02m (20mm) between adjacent panels for mid-clamps and thermal expansion.
- **Zero Hallucination Rule**: Panels are placed strictly using Shapely 2D computational geometry containment assertions (`UsableArea.covers(Panel)` and `ObstacleArea.intersects(Panel) == False`). No generative AI hallucination.
