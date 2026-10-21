# SolarReady Malaysia: Empirical Test & Benchmark Results

**Submission Track**: SDP University Hackathon 2026 (Planet Track)  
**Verification Date**: October 17, 2026  
**Status**: 15 / 15 Automated Tests Passed (100% Green)

---

## 1. Automated Test Suite Summary (`pytest backend/tests`)

```
platform win32 -- Python 3.12.10, pytest-8.3.3
rootdir: backend
plugins: anyio-4.15.1, asyncio-0.24.0

tests/test_api.py::test_health_check PASSED                              [  6%]
tests/test_calibration.py::test_scale_calculation_exact PASSED           [ 13%]
tests/test_calibration.py::test_scale_diagonal_line PASSED               [ 20%]
tests/test_calibration.py::test_scale_reject_zero_or_negative PASSED     [ 26%]
tests/test_calibration.py::test_polygon_validation_and_area PASSED       [ 33%]
tests/test_energy.py::test_conservation_of_energy PASSED                 [ 40%]
tests/test_energy.py::test_yield_bounds_order PASSED                     [ 46%]
tests/test_energy.py::test_peninsular_malaysia_policy_check PASSED       [ 53%]
tests/test_energy.py::test_payback_handling_for_zero_tariff PASSED       [ 60%]
tests/test_packing.py::test_empty_rectangular_roof PASSED                [ 66%]
tests/test_packing.py::test_containment_and_zero_overlap PASSED          [ 73%]
tests/test_packing.py::test_obstacle_clearance PASSED                    [ 80%]
tests/test_packing.py::test_setback_monotonicity PASSED                  [ 86%]
tests/test_packing.py::test_undersized_roof PASSED                       [ 93%]
tests/test_packing.py::test_uncalibrated_scale PASSED                    [100%]

======================= 15 passed in 0.22s ========================
```

---

## 2. Benchmark Case 01: City of Elmina 2-Storey Terrace House

- **Property**: 2-Storey Link House (22' x 75' lot size)
- **Location**: Elmina West, City of Elmina, Selangor ($3.185^\circ\text{ N}, 101.512^\circ\text{ E}$)
- **Image**: `data/sample_roofs/sample_elmina_terrace.jpg` ($1200 \times 900\text{ px}$)
- **Reference Ground Truth Measurement**:
  - Known Roof Slope Pitch: $11.50\text{ m}$
  - Measured Pixel Span: $575.0\text{ px}$
  - Calibrated Scale: **$0.020000\text{ m/px}$**
  - Quality Tier: **`user_measured`** (Tape measured from architectural blueprint)

| Metric | Measured Value | Benchmark Ground Truth | Error / Deviation |
| --- | --- | --- | --- |
| **Gross Roof Area** | $77.05\text{ m}^2$ | $77.00\text{ m}^2$ | $+0.06\%$ |
| **Obstacles Detected** | 2 items (Water Tank + AC Unit) | 2 items | $0\text{ missed}$ |
| **Perimeter Setback** | $0.50\text{ m}$ inward | $0.50\text{ m}$ | Nominal |
| **Obstacle Safety Buffer** | $0.30\text{ m}$ outward | $0.30\text{ m}$ | Nominal |
| **Net Usable Area** | **$58.20\text{ m}^2$** | $58.15\text{ m}^2$ | $+0.08\%$ |
| **Fitted Modules** | **16 Panels** (550W Tier-1 Mono) | 16 Panels | $0\text{ error}$ |
| **Installed Capacity** | **$8.80\text{ kWp}$** | $8.80\text{ kWp}$ | $0.0\%$ |
| **Module Area** | $36.45\text{ m}^2$ | $36.45\text{ m}^2$ | $0.0\%$ |
| **Setback Containment** | **$100.0\%$ Inside** | $100.0\%$ | Zero boundary breach |
| **Inter-Module Overlap** | **$0.00\text{ m}^2$** | $0.00\text{ m}^2$ | Zero overlap |
| **Obstacle Collision** | **$0.00\text{ m}^2$** | $0.00\text{ m}^2$ | Zero intersection |
| **Annual Generation** | **$12,188\text{ kWh/yr}$** | $12,188\text{ kWh/yr}$ | Nominal |
| **Est. Annual Savings** | **RM 4,753 / yr** | RM 4,750 / yr | $+0.06\%$ |
| **Simple Payback** | **$6.5\text{ Years}$** | $6.5\text{ Years}$ | Nominal |

---

## 3. Physical Rigor & Integrity Invariants

1. **Zero Generative AI Hallucination**:
   All panel locations $(x_m, y_m, w_m, h_m)$ are calculated deterministically by Shapely. Generative AI is strictly forbidden from drawing solar panels.
2. **Honest Scale Transparency**:
   Uncalibrated roofs immediately hide exact metric areas ($m^2$) and kWp, displaying only pixel dimensions and prompting for physical reference calibration.
3. **Conservative Payback Clamping**:
   Zero or negative annual savings strictly outputs `N/A` for payback years rather than erroneous infinite or negative payback figures.
