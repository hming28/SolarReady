"""
SolarReady Malaysia - User Image Full Pipeline Integration Test
Tests end-to-end processing of user-uploaded satellite/aerial roof image:
1. Upload & EXIF sanitization
2. Scale calibration via known reference measurement
3. Roof boundary polygon & obstacle buffering
4. Geometric panel packing (zero hallucination Shapely algorithm)
5. Solar energy generation (PVGIS / Peninsular baseline)
6. Delivered LCOE, Greenfield vs. Brownfield comparison, and CREAM wheeling economics
"""

from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from app.main import app

USER_IMAGE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "sample_roofs" / "user_test_roof.png"


def test_user_image_full_lifecycle():
    client = TestClient(app)
    assert USER_IMAGE_PATH.exists(), f"User test image not found at {USER_IMAGE_PATH}"

    # 1. Create Assessment
    create_payload = {
        "location": {
            "text": "Elmina Green Phase 1, City of Elmina, 40160 Shah Alam, Selangor",
            "lat": 3.1850,
            "lon": 101.5120,
        },
        "house_type": "2-Storey Linked Home (20' x 70')",
        "consent": {
            "image_use": True,
            "timestamp": "2026-10-17T10:00:00Z",
        },
        "is_demo": False,
    }
    create_res = client.post("/api/assessments", json=create_payload)
    assert create_res.status_code in (200, 201), create_res.text
    assessment_data = create_res.json()
    assessment_id = assessment_data["id"]
    assert assessment_id is not None

    # 2. Upload User Image & Verify EXIF Sanitization and Dimensions
    with open(USER_IMAGE_PATH, "rb") as f:
        file_bytes = f.read()

    upload_res = client.post(
        f"/api/assessments/{assessment_id}/image",
        files={"file": ("user_test_roof.png", file_bytes, "image/png")},
    )
    assert upload_res.status_code == 200, upload_res.text
    img_data = upload_res.json()
    assert img_data["image"]["width_px"] == 870
    assert img_data["image"]["height_px"] == 930
    assert img_data["image"]["sha256"] is not None

    # Verify working copy can be retrieved
    file_res = client.get(f"/api/assessments/{assessment_id}/image/file")
    assert file_res.status_code == 200
    assert file_res.headers["content-type"] == "image/jpeg"

    # 3. Request AI Vision Segment Draft Proposal
    vision_res = client.post(f"/api/vision/segment?assessment_id={assessment_id}")
    assert vision_res.status_code == 200
    vision_data = vision_res.json()
    assert len(vision_data["polygons_px"]) >= 1
    assert vision_data["confidence"] > 0.50

    # 4. Calibrate Scale (User draws a known line along the roof pitch/ridge: 320 px = 7.5 meters)
    calibrate_payload = {
        "reference_px": [[230.0, 180.0], [550.0, 180.0]],
        "reference_m": 7.5,
    }
    cal_res = client.post("/api/geometry/calibrate", json=calibrate_payload)
    assert cal_res.status_code == 200, cal_res.text
    cal_data = cal_res.json()
    expected_m_per_px = 7.5 / 320.0
    assert pytest.approx(cal_data["metres_per_pixel"], rel=1e-3) == expected_m_per_px
    m_per_px = cal_data["metres_per_pixel"]

    # 5. Save Roof Polygon & Obstacles (PUT /api/assessments/{id}/geometry)
    roof_poly_px = [
        [220.0, 180.0],
        [540.0, 190.0],
        [510.0, 680.0],
        [200.0, 660.0],
    ]
    obstacle_px = [
        [320.0, 360.0],
        [370.0, 360.0],
        [370.0, 410.0],
        [320.0, 410.0],
    ]
    geom_payload = {
        "roof_polygons_px": [roof_poly_px],
        "obstacles": [
            {
                "id": "obs-vent-01",
                "polygon_px": obstacle_px,
                "type": "vent",
                "buffer_m": 0.3,
                "user_verified": True,
            }
        ],
        "scale": {
            "method": "known_line",
            "metres_per_pixel": m_per_px,
            "reference_px": calibrate_payload["reference_px"],
            "reference_m": 7.5,
            "quality_tier": "user_measured",
            "notes": "Verified against developer architectural floor plan (eaves width 7.5m)",
        },
    }
    geom_res = client.put(f"/api/assessments/{assessment_id}/geometry", json=geom_payload)
    assert geom_res.status_code == 200, geom_res.text
    updated_assessment = geom_res.json()
    assert updated_assessment["geometry"]["roof_area_m2"] > 50.0
    assert updated_assessment["geometry"]["roof_area_px2"] > 80000.0
    roof_geometry = updated_assessment["geometry"]

    # 6. Geometric Panel Packing (Strict Shapely 2D packing with setbacks and obstacle buffer)
    layout_req = {
        "geometry": roof_geometry,
        "panel_spec": {
            "name": "Standard Residential 440W",
            "width_m": 1.134,
            "length_m": 1.762,
            "power_w": 440.0,
        },
        "params": {
            "setback_m": 0.5,
            "row_spacing_m": 0.05,
            "col_spacing_m": 0.05,
            "orientation": "portrait",
        },
    }
    pack_res = client.post("/api/layouts/optimize", json=layout_req)
    assert pack_res.status_code == 200, pack_res.text
    layout_data = pack_res.json()
    assert layout_data["panel_count"] >= 10, f"Expected >= 10 panels, got {layout_data['panel_count']}"
    assert layout_data["capacity_kwp"] >= 4.0, f"Expected >= 4.0 kWp, got {layout_data['capacity_kwp']}"
    assert layout_data["module_area_m2"] > 0
    assert len(layout_data["panels"]) == layout_data["panel_count"]

    # 7. Energy Yield & Financial Estimate
    energy_req = {
        "capacity_kwp": layout_data["capacity_kwp"],
        "lat": 3.1850,
        "lon": 101.5120,
        "self_use_pct": 60.0,
        "tariff_rm_per_kwh": 0.509,
        "export_rate_rm_per_kwh": 0.39,
        "cost_per_kwp_rm": 3500.0,
    }
    energy_res = client.post("/api/energy/estimate", json=energy_req)
    assert energy_res.status_code == 200, energy_res.text
    energy_data = energy_res.json()
    assert energy_data["annual_generation_kwh"]["base"] > 0
    assert energy_data["finance"]["annual_savings_rm"]["base"] > 0
    assert energy_data["finance"]["payback_years"]["base"] > 0
    assert energy_data["policy_status"] == "verified_peninsular"

    # 8. First-Principles LCOE & Delivered Cost Calculation (CREAM 9 sen wheeling fee)
    lcoe_req = {
        "module_fob_usd_per_w": 0.116,
        "usd_to_myr": 4.30,
        "structure_type": "standard_pitched_tile",
        "wacc": 0.08,
        "system_size_kwp": layout_data["capacity_kwp"],
        "specific_yield_kwh": 1385.0,
        "wheeling_charge_sen": 9.0,
    }
    lcoe_res = client.post("/api/economics/lcoe", json=lcoe_req)
    assert lcoe_res.status_code == 200, lcoe_res.text
    lcoe_data = lcoe_res.json()
    assert lcoe_data["delivered_lcoe_sen"] == pytest.approx(
        lcoe_data["generation_lcoe_sen"] + 9.0, abs=0.01
    )
    assert lcoe_data["capex_breakdown"]["idiot_index"] > 5.0  # Confirms the 6x-8x Idiot Index
    assert lcoe_data["viable_lease"] is True
    assert lcoe_data["typical_homeowner_monthly_rent_rm"] > 0

    # 9. Greenfield vs. Brownfield Township Advantage
    scenario_res = client.get(f"/api/economics/scenarios?system_size_kwp={layout_data['capacity_kwp']}")
    assert scenario_res.status_code == 200, scenario_res.text
    scenarios = scenario_res.json()
    assert "brownfield_retrofit" in scenarios
    assert "greenfield_solar_ready" in scenarios
    bf = scenarios["brownfield_retrofit"]
    gf = scenarios["greenfield_solar_ready"]
    # Greenfield pre-embedded rails & zero CAC should provide substantial savings
    assert gf["capex_rm_per_kwp"] < bf["capex_rm_per_kwp"]
    assert gf["structure_cost_rm_per_kwp"] < bf["structure_cost_rm_per_kwp"]
    assert gf["delivered_lcoe_sen"] < bf["delivered_lcoe_sen"]
    savings_rm = (bf['capex_rm_per_kwp'] - gf['capex_rm_per_kwp']) * layout_data['capacity_kwp']
    print(
        f"\nSUCCESS! Test on user image produced {layout_data['panel_count']} panels "
        f"({layout_data['capacity_kwp']} kWp), Delivered LCOE: {lcoe_data['delivered_lcoe_sen']:.1f} sen/kWh, "
        f"Greenfield Savings: RM {savings_rm:,.0f}"
    )
