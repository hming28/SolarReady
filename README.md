# SolarReady Malaysia ☀️🇲🇾

> **SDP University Hackathon 2026 — Planet Track**  
> Verifiable, physics-grounded rooftop solar feasibility and financial estimation tailored for Malaysian residential communities (Demonstrating on Sime Darby Property: City of Elmina, Selangor).

---

## Key Principles & Academic Integrity

1. **No Google Solar API**: Does not rely on proprietary or unavailable external rooftop APIs.
2. **Physics-Grounded Geometric Packing**: Solar panels are placed using 2D computational geometry algorithms (Shapely). Zero generative AI hallucination.
3. **Transparent Scale Calibration**: Without calibrated scale ($m/\text{px}$), exact areas ($m^2$) and kWp are strictly hidden.
4. **Transparent Quality Tiers**:
   - `user_measured`: Measured on-site with tape or verified architectural drawings.
   - `approx_map_measure`: Approximate measurement via satellite ruler.
   - `uncalibrated`: Raw pixel units only.
5. **Malaysian TNB Tariff & Solar ATAP Logic**: Realistic Peninsular Malaysia TNB domestic tariff tiers and SEDA solar irradiance benchmarks ($1,280 - 1,460\text{ kWh/kWp/year}$).
6. **Honest Labeling**: All synthetic demonstration data is explicitly watermarked with `Demo Data`.

---

## System Architecture

```
solarready/
├── frontend/                  # Next.js 14+ App Router, TypeScript, Tailwind CSS, Konva
│   ├── app/
│   │   ├── page.tsx           # Step 1: Upload, Property info, EXIF privacy consent
│   │   ├── editor/[id]/       # Step 2: React-Konva roof & obstacle editor + calibration
│   │   ├── layout-sim/[id]/   # Step 3: Constrained panel simulation (Realistic & CAD modes)
│   │   ├── report/[id]/       # Step 4: Solar generation (PVGIS v6) & TNB financial ROI
│   │   └── planner/           # Step 5: SDP Township Planner portfolio (P1)
│   └── components/            # CanvasEditor, ScaleModal, PanelOverlay, FinancialCard, Stepper
│
├── backend/                   # FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI entry point, CORS, routers
│   │   ├── schemas.py         # Pydantic v2 data contracts (_px vs _m unit safety)
│   │   ├── routers/           # assessments, geometry, layout, energy, vision, portfolio
│   │   └── services/          # packing (Shapely), energy_service (PVGIS v6), image_service
│   └── tests/                 # 15 automated pytest tests (containment, collision, finance)
│
├── data/
│   ├── sample_roofs/          # Curated test images with ground-truth metadata
│   └── storage/               # Local JSON assessment storage & working copies
└── docs/
    ├── license_ledger.md      # Open-source license inventory
    ├── assumptions.md         # Full TNB tariff & irradiance derate models
    └── test_results.md        # Empirical test results for hackathon judging
```

---

## Quick Start Guide

### 1. Start the Backend API (FastAPI)

```bash
cd backend

# Activate virtual environment
.venv\Scripts\activate   # Windows

# Run FastAPI server on port 8000
uvicorn app.main:app --port 8000 --reload
```
API status can be verified at: `http://localhost:8000/health`  
Interactive Swagger docs: `http://localhost:8000/docs`

### 2. Start the Frontend (Next.js)

```bash
cd frontend

# Run Next.js development server on port 3000
npm run dev
```
Open `http://localhost:3000` in your browser.

---

## Running the Automated Test Suite

```bash
cd backend
.venv\Scripts\python -m pytest tests -v
```

All 15 unit tests verify:
- Inward perimeter setback enforcement
- Zero panel overlap and obstacle buffer clearance
- Monotonic setback reduction
- Scale ratio and area calculation accuracy
- Energy conservation ($E_{\text{self}} + E_{\text{export}} = E_{\text{total}}$)
- Clamped payback handling for zero or negative revenue
