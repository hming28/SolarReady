# Comparative Technical Analysis: Google Solar API vs. SolarReady Malaysia

**Track**: SDP University Hackathon 2026 (Planet Track)  
**Objective**: Clear, honest evaluation of how SolarReady Malaysia differs from and extends beyond Google Solar API.

---

## 1. Feature & Capability Matrix

| Dimension | Google Solar API | SolarReady Malaysia (SDP Engine) | Strategic Implication |
| --- | --- | --- | --- |
| **Geographic Coverage in Malaysia** | Extremely limited / Unavailable in suburban master-planned developments (e.g. City of Elmina, Denai Alam, Bandar Bukit Raja). | **100% Coverage**: Operates on any user-provided drone photo, satellite screenshot, or CAD blueprint. | Allows SDP to evaluate newly launched phases before Google satellites update. |
| **Structural Mounting Cost Modeling** | **Zero / None**: Treats all roof faces as homogeneous geometric surfaces. | **Granular Structural Classification**: Identifies clay tiles, flat concrete, metal profiles, and **Solar-Ready pre-embedded rails**. | Mounting structure cost varies by 400% (RM 95 to RM 850/kWp); Google Solar completely ignores this cost driver. |
| **Generative Hallucination Risk** | Closed black-box surface reconstruction. | **100% Deterministic Shapely Geometry**: Strict inward setbacks, outward obstacle clearance buffers, zero panel overlap. | Produces physically installable layouts compliant with SEDA safety guidelines. |
| **Malaysian Utility & Policy Logic** | Generic US / European net metering assumptions. | **Native TNB & CREAM Engine**: Models TNB Domestic Tariff Schedule (A1–A5), NEM 3.0 Rakyat, and 9 sen/kWh TPA grid wheeling fees. | Delivers authentic LCOE figures matching Malaysian energy market reality. |
| **Developer Vertical Integration** | B2C retrospective tool (for existing houses only). | **Dual-Scenario Engine**: Evaluates Brownfield Retrofit vs. Greenfield Factory-Fit Solar-Ready design. | Built specifically for property developers (SDP) to standardize roofs before construction. |
| **Scale Transparency** | Opaque satellite resolution. | **Explicit Scale Quality Tiers**: `user_measured`, `approx_map_measure`, `uncalibrated`. | Preserves academic and engineering integrity by withholding metric areas if uncalibrated. |

---

## 2. Why Google Solar API Fails Developer-Scale Aggregation in Malaysia

1. **Resolution Latency in Growing Townships**:
   New township developments like Elmina West and Elmina Green are expanding rapidly. Satellite aerial passes by commercial providers often lag behind construction by 12 to 24 months. Google Solar cannot assess a phase that is currently on the architect's drawing board or newly handed over.
2. **The "BOS Blindspot"**:
   Google Solar focuses on solar irradiance potential (kWh/m²). But as proven by first-principles economics, solar irradiance across Peninsular Malaysia is universally high (>1,350 kWh/kWp). The factor that dictates whether an installation is profitable or loss-making is **structural mounting complexity and electrical conduit routing** — dimensions that Google Solar does not evaluate.
3. **Absence of Wholesale Delivery (LCOE) Economics**:
   Google Solar calculates bill offset for a single electric meter. It does not calculate Levelized Cost of Delivered Energy (LCOE) under third-party grid wheeling (CREAM / CRESS), nor does it calculate the allowable roof rental margin for township developers.

---

## 3. How SolarReady Malaysia Leverages Open Infrastructure

Rather than attempting to train a multi-million-dollar vision model from scratch:
1. We utilize open EU Commission **PVGIS API v6** and NASA POWER for solar radiation physics.
2. We employ deterministic **2D computational geometry (Shapely)** for collision-free panel packing.
3. We focus our domain innovation where value actually concentrates: **developer vertical integration, structural cost compression, and township virtual power plant aggregation**.
