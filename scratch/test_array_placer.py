import json
from shapely.geometry import Polygon, box
from app.services.storage import storage_service
from app.schemas import PanelSpec

# Test placing Gemini recommended arrays directly onto assessment roof facets
assessment = storage_service.get_assessment("sr-7e9baa9611")
polys_px = assessment.geometry.roof_polygons_px

# Let's see what facets exist
print(f"Total facets: {len(polys_px)}")

# Standard 550W panel specs: 2.27m x 1.13m
# If scale m_per_px is ~0.017:
all_pts = [p for poly in polys_px for p in poly]
xs = [p[0] for p in all_pts]
ys = [p[1] for p in all_pts]
bbox_span = max(max(xs) - min(xs), max(ys) - min(ys), 120.0)
m_per_px = round(14.0 / bbox_span, 4)
print(f"m_per_px: {m_per_px}")

panel_w_px = round(1.13 / m_per_px, 1)
panel_h_px = round(2.27 / m_per_px, 1)
print(f"Panel portrait: w={panel_w_px}px, h={panel_h_px}px")
print(f"Panel landscape: w={panel_h_px}px, h={panel_w_px}px")

# Function to center an R x C array block inside a facet polygon
def place_centered_array(poly_pts, rows, cols, orientation="landscape", gap_px=2):
    pw = panel_h_px if orientation == "landscape" else panel_w_px
    ph = panel_w_px if orientation == "landscape" else panel_h_px
    
    total_w = cols * pw + (cols - 1) * gap_px
    total_h = rows * ph + (rows - 1) * gap_px
    
    poly = Polygon(poly_pts)
    poly_cx = poly.centroid.x
    poly_cy = poly.centroid.y
    
    start_x = poly_cx - (total_w / 2.0)
    start_y = poly_cy - (total_h / 2.0)
    
    panels = []
    for r in range(rows):
        for c in range(cols):
            px = round(start_x + c * (pw + gap_px), 1)
            py = round(start_y + r * (ph + gap_px), 1)
            panels.append({"x": px, "y": py, "w": pw, "h": ph})
    return panels

# Test on Facet 0 (Plane 1): 1 row x 5 cols landscape
p0 = place_centered_array(polys_px[0], rows=1, cols=5, orientation="landscape")
print(f"Plane 1 (1x5 landscape): {len(p0)} panels generated")

# Test on Facet 4 (Plane 5): 2 rows x 3 cols portrait
p4 = place_centered_array(polys_px[4], rows=2, cols=3, orientation="portrait")
print(f"Plane 5 (2x3 portrait): {len(p4)} panels generated")

# Test on Facet 6 (Plane 7): 3 rows x 1 col portrait
p6 = place_centered_array(polys_px[6], rows=3, cols=1, orientation="portrait")
print(f"Plane 7 (3x1 portrait): {len(p6)} panels generated")
