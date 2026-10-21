"""
Tests for API endpoints (/health, assessment creation, etc.)
"""


def test_health_check(client):
    """Verify /health returns 200 OK and expected structure."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "SolarReady Malaysia API"
    assert "version" in data
    assert "timestamp" in data


def test_create_and_get_assessment(client):
    """Verify assessment creation and retrieval via API."""
    res = client.post("/api/assessments", json={
        "location": {"text": "Elmina, Shah Alam", "lat": 3.18, "lon": 101.51},
        "house_type": "Terrace",
        "consent": {"image_use": True, "timestamp": "2026-10-17T00:00:00Z"},
        "is_demo": True,
    })
    assert res.status_code == 201
    data = res.json()
    assert "id" in data
    assessment_id = data["id"]
    assert data["house_type"] == "Terrace"

    # Retrieve
    get_res = client.get(f"/api/assessments/{assessment_id}")
    assert get_res.status_code == 200
    assert get_res.json()["id"] == assessment_id


def test_update_geometry_endpoint(client):
    """Verify geometry update and area computation via API."""
    res = client.post("/api/assessments", json={
        "location": {"text": "Elmina", "lat": 3.18, "lon": 101.51},
        "house_type": "Terrace",
        "consent": {"image_use": True, "timestamp": "2026-10-17T00:00:00Z"},
        "is_demo": True,
    })
    assessment_id = res.json()["id"]

    geom_payload = {
        "roof_polygons_px": [[[0.0, 0.0], [100.0, 0.0], [100.0, 100.0], [0.0, 100.0]]],
        "obstacles": [],
        "scale": {
            "method": "known_line",
            "metres_per_pixel": 0.1,
            "quality_tier": "user_measured"
        }
    }
    put_res = client.put(f"/api/assessments/{assessment_id}/geometry", json=geom_payload)
    assert put_res.status_code == 200
    updated = put_res.json()
    assert updated["geometry"]["roof_area_px2"] == 10000.0
    assert updated["geometry"]["roof_area_m2"] == 100.0


def test_crop_image_endpoint(client):
    """Verify in-editor crop slices image and preserves scale metres_per_pixel."""
    from pathlib import Path

    res = client.post("/api/assessments", json={
        "location": {"text": "Elmina", "lat": 3.18, "lon": 101.51},
        "house_type": "Terrace",
        "consent": {"image_use": True, "timestamp": "2026-10-17T00:00:00Z"},
        "is_demo": True,
    })
    assessment_id = res.json()["id"]

    # Upload test image
    img_path = Path(__file__).resolve().parent.parent.parent / "data" / "sample_roofs" / "sample_elmina_terrace.jpg"
    with open(img_path, "rb") as f:
        client.post(f"/api/assessments/{assessment_id}/image", files={"file": ("roof.jpg", f.read(), "image/jpeg")})

    # Set initial calibrated scale
    client.put(f"/api/assessments/{assessment_id}/geometry", json={
        "roof_polygons_px": [[[100.0, 100.0], [200.0, 100.0], [200.0, 200.0], [100.0, 200.0]]],
        "scale": {
            "method": "known_line",
            "metres_per_pixel": 0.0500,
            "reference_m": 5.0,
            "quality_tier": "user_measured"
        }
    })

    # Crop to a 200x150 sub-box
    crop_res = client.post(f"/api/assessments/{assessment_id}/crop", json={
        "box_px": [50.0, 50.0, 250.0, 200.0]
    })
    assert crop_res.status_code == 200
    data = crop_res.json()

    assert data["image"]["width_px"] == 200
    assert data["image"]["height_px"] == 150
    # SCALE INVARIANCE: metres_per_pixel remains 0.0500!
    assert data["geometry"]["scale"]["metres_per_pixel"] == 0.0500
    # Polygon point (100, 100) shifted by (-50, -50) => (50, 50)
    assert data["geometry"]["roof_polygons_px"][0][0] == [50.0, 50.0]


def test_rotate_image_endpoint(client):
    """Verify image rotation levels rooftop, transforms vertices, and preserves scale."""
    from pathlib import Path

    res = client.post("/api/assessments", json={
        "location": {"text": "Setia Alam", "lat": 3.10, "lon": 101.45},
        "house_type": "Terrace",
        "consent": {"image_use": True, "timestamp": "2026-10-17T00:00:00Z"},
        "is_demo": True,
    })
    assessment_id = res.json()["id"]

    # Upload test image
    img_path = Path(__file__).resolve().parent.parent.parent / "data" / "sample_roofs" / "sample_elmina_terrace.jpg"
    with open(img_path, "rb") as f:
        client.post(f"/api/assessments/{assessment_id}/image", files={"file": ("roof.jpg", f.read(), "image/jpeg")})

    # Set initial calibrated scale and polygon
    client.put(f"/api/assessments/{assessment_id}/geometry", json={
        "roof_polygons_px": [[[100.0, 100.0], [300.0, 100.0], [300.0, 250.0], [100.0, 250.0]]],
        "scale": {
            "method": "known_line",
            "metres_per_pixel": 0.0500,
            "reference_m": 10.0,
            "quality_tier": "user_measured"
        }
    })

    # Rotate clockwise by 28 degrees
    rot_res = client.post(f"/api/assessments/{assessment_id}/rotate", json={
        "angle_deg": 28.0
    })
    assert rot_res.status_code == 200
    data = rot_res.json()

    # Verify cumulative canvas rotation recorded
    assert data["geometry"]["canvas_rotation_deg"] == 28.0
    # SCALE INVARIANCE: metres_per_pixel remains 0.0500
    assert data["geometry"]["scale"]["metres_per_pixel"] == 0.0500
    # Polygon was transformed
    assert len(data["geometry"]["roof_polygons_px"][0]) == 4

    # Test analyze-roof with canvas_rotation_deg compensates azimuth
    analyze_res = client.post("/api/geometry/analyze-roof", json={
        "roof_polygons_px": [[[100.0, 100.0], [300.0, 100.0], [300.0, 250.0], [100.0, 250.0]]],
        "metres_per_pixel": 0.0500,
        "tilt_deg": 15.0,
        "canvas_rotation_deg": 28.0,
    })
    assert analyze_res.status_code == 200
    az_data = analyze_res.json()
    assert len(az_data["faces"]) == 1
    # Azimuth without rotation is 0.0 (North), with canvas_rotation_deg 28.0: (0 - 28 + 360) = 332.0 (NNW)
    assert az_data["faces"][0]["azimuth_deg"] == 332.0



