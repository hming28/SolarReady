# Additional File 3: Technical Algorithms, Physical Derates & TNB Tariff Whitepaper

**Platform**: SolarReady Malaysia Core Engine  
**Focus**: Physics-Grounded Computational Geometry, Microclimate Modeling & Utility Tariff Economics  
**Academic & Engineering Integrity**: Zero Generative AI Hallucination  

---

## 1. Zero-Hallucination 2D Computational Geometry (Shapely Engine)

Standard generative AI models (such as computer vision diffusion or unconstrained pixel generators) hallucinate solar arrays by "painting" rectangles onto satellite textures. In engineering reality, this leads to fatal structural violations: panels overlapping vents, extending beyond roof eaves into gutter gutters, or intersecting high-wind boundary zones.

SolarReady enforces strict mathematical containment using the **Python Shapely (v2.0.6)** computational geometry engine:

```
[Raw User Satellite Image]
          │
          ▼
[Scale Calibration: metres_per_pixel = reference_m / reference_px]
          │
          ▼
[Roof Polygon: P_roof]  ─── Inward Buffer (-0.50m) ───► [Usable Boundary: P_usable]
          │
[Obstacles: O_i]        ─── Outward Buffer (+0.30m) ──► [Restricted Zones: R_i]
          │
          ▼
[Net Allowed Geometry: G_net = P_usable \ ⋃ R_i]
          │
          ▼
[Grid Tessellation: Array of Candidate Panels (1.762m × 1.134m)]
          │
          ▼
[Mathematical Assertion: G_net.contains(Panel_j) == True]
          │
          ▼
[Final Verifiable Panel Set — 100% Collision-Free]
```

### Exact Geometric Constraints Applied:
1. **Perimeter Setback ($d_{\text{setback}} = 0.50\text{ m}$)**:
   $$P_{\text{usable}} = P_{\text{roof}} \ominus d_{\text{setback}}$$
   *Rationale*: Prevents edge wind vortex uplift and guarantees unobstructed stormwater flow into eave gutters under torrential monsoon rains.
2. **Obstacle Exclusion Buffer ($d_{\text{buffer}} = 0.30\text{ m}$)**:
   $$R_i = O_i \oplus d_{\text{buffer}}$$
   *Rationale*: Ensures physical clearance for technician maintenance access and eliminates local thermal microclimates caused by AC condenser exhaust vents.
3. **Module Inter-Clamp Spacing ($g = 0.02\text{ m}$)**:
   *Rationale*: Accommodates anodized aluminum mid-clamps and thermal expansion tolerances of monocrystalline silicon frames under $35^\circ\text{C}$ ambient temperatures.

---

## 2. Solar Resource & Tropical Derating Physics (PVGIS v6)

Rather than assuming arbitrary flat sunshine hours, SolarReady interfaces with the **European Commission Joint Research Centre (EC JRC) PVGIS v6 API** and cross-references Malaysian Sustainable Energy Development Authority (**SEDA**) empirical benchmarks:

- **Baseline Specific Yield**: $1,385\text{ kWh / kWp / year}$ (Peninsular Malaysia median).
- **Optimal Rooftop Tilt**: $10.0^\circ$ pitch facing south (matches typical Malaysian terrace architecture and facilitates self-cleaning during rain).

### Empirical Derating Factor Breakdown (Total 14.0% System Loss):

| Physical Loss Component | Loss Value | Engineering Justification |
| :--- | :--- | :--- |
| **Thermal Temperature Derate** | **6.5%** | Standard $-0.35\%/^\circ\text{C}$ Pmax coefficient above $25^\circ\text{C}$ STC; rooftop solar cells in Malaysia regularly operate at $55^\circ\text{C}-60^\circ\text{C}$. |
| **Tropical Soiling & Atmospheric Dust** | **3.0%** | Particulate accumulation between dry periods, mitigated by tropical downpours. |
| **Inverter Conversion Efficiency** | **2.5%** | Modern Tier-1 string inverters operating at peak European efficiency (~97.5%). |
| **DC/AC Wiring & Mismatch Loss** | **2.0%** | Cable resistance and manufacturing batch voltage variance. |
| **Total System Derating ($\eta_{\text{sys}}$)** | **14.0%** | Conservatively accounts for tropical reality without over-promising energy yields. |

---

## 3. Malaysian Domestic Tariff (TNB Tarif A) & Solar ATAP Mechanics

Under the Malaysian energy framework, residential electricity is billed by **Tenaga Nasional Berhad (TNB)** under a strict 5-tier progressive block tariff:

| Consumption Tier | Monthly kWh Range | Tariff Rate (sen / kWh) |
| :--- | :--- | :--- |
| **Band 1** | First 200 kWh | 21.80 |
| **Band 2** | Next 100 kWh (201 - 300) | 33.40 |
| **Band 3** | Next 300 kWh (301 - 600) | **39.00** *(Baseline)* |
| **Band 4** | Next 300 kWh (601 - 900) | 51.60 |
| **Band 5** | Above 900 kWh | **57.10** |

### The Critical Solar ATAP Rate Differential:
Under the **Solar ATAP / NEM 3.0** policy, daytime self-consumption is vastly more valuable than grid export:
1. **Self-Consumption ($E_{\text{self}}$)**: Offsets retail purchase at the highest marginal tariff band (up to **57.10 sen/kWh**).
2. **Surplus Grid Export ($E_{\text{export}}$)**: Credits only the system marginal energy charge (approximately **27.03 sen/kWh**).

$$\text{Monthly Savings} = \left(E_{\text{self}} \times \text{Tariff}_{\text{marginal}}\right) + \left(E_{\text{export}} \times \text{Rate}_{\text{ATAP}}\right)$$

By providing an interactive **Daytime Self-Consumption Slider (20% – 100%)**, SolarReady allows homeowners to see how shifting EV charging or daytime air conditioning maximizes their investment return.

---

## 4. Software Verification & Test Suite Proof

The backend includes a comprehensive automated test suite verifying geometry containment, collision avoidance, and financial boundary conditions:

```
============================= test session starts =============================
platform win32 -- Python 3.12.10, pytest-8.3.3
rootdir: backend
collected 31 items

tests\test_api.py .....                                                  [ 16%]
tests\test_calibration.py .........                                      [ 45%]
tests\test_economics.py ...                                              [ 54%]
tests\test_energy.py ....                                                [ 67%]
tests\test_gemini_vision.py .                                            [ 70%]
tests\test_packing.py .......                                            [ 93%]
tests\test_user_image_pipeline.py .                                      [ 96%]
tests\test_vision_sam2.py .                                              [100%]

================== 31 passed, 1 warning in 63.60s (0:01:03) ===================
```

- **Inward Setback Test**: Verifies that no panel coordinate lies within 0.50m of the boundary.
- **Obstacle Buffer Test**: Verifies that panel rectangles maintain $\ge 0.30\text{m}$ clearance from water tanks and AC units.
- **Energy Conservation Test**: Enforces $E_{\text{self}} + E_{\text{export}} = E_{\text{total}}$.
- **Financial Bound Test**: Clamps payback periods and prevents negative bill reduction anomalies.
