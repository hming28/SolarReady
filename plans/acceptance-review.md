# Worker Delivery Acceptance Review

Review time: 2026-10-20 (Asia/Kuala_Lumpur)

## Verdict

**Runtime acceptance passed; release acceptance remains conditional.** The backend now imports and its automated suite passes. However, the image-enhancement feature still leaves several persisted coordinate-derived values stale after an upscale, and the editor still fabricates a default scale for arbitrary imagery. Those correctness issues should be resolved before using estimates for customer-facing decisions.

## Re-verification — 2026-10-20

- `backend\\.venv\\Scripts\\python.exe -c "from app.main import app"` — passed.
- `backend\\.venv\\Scripts\\python.exe -m pytest backend\\tests -q` — **28 passed, 1 warning** (8.40s).
- `frontend\\npm run build` — passed (Next.js 14.2.35).
- The P0 missing-`Optional` import and the P1 nested-enhancement-response assertion are both fixed in the current source.
- The remaining findings below were rechecked against the current source, not carried forward merely from the previous review.

## Evidence collected

- Reviewed `plans/feedback-log.md` and `plans/latest.diff` against the staged source tree.
- Re-executed the frontend production build and complete backend suite in the project's declared virtual environment.
- The original review's import failure is retained below as a closed finding; it no longer describes the current worktree.

## Blocking defects

### Closed P0 — Backend fails at import time

- **Location:** `backend/app/routers/assessments.py:125`
- **Resolution verified:** `from typing import Optional, List, Dict, Any` is now present and `app.main` imports successfully.
- **Verification:** all 28 backend tests pass in the project virtual environment.

### P1 — Existing image-coordinate data is corrupted/stale after enhancement

- **Location:** `backend/app/services/super_res_service.py:188-207`
- **Evidence:** the implementation rescales roof polygons and obstacle polygons, but does not rescale `geometry.scale.reference_px`; it also retains cached `roof_area_px2`, `faces_metrics`, and `assessment.layout.panels[*].{x_px,y_px,w_px,h_px}` from the pre-upscale image.
- **Impact:** a displayed calibration line no longer aligns with the image. Any saved panel overlay and pixel-derived measurement can be drawn at the wrong location or report an inconsistent value after the image refresh. This contradicts the UI claim that physical values remain invariant.
- **Required fix:** use one `scale_x`/`scale_y` transform for every persisted pixel-coordinate field. Recompute cached geometry metrics, and either rescale valid pixel layout projections or invalidate the layout and require re-optimisation. Add regression tests with non-empty polygons, obstacles, calibration reference points, and layout projections.

### Closed P1 — Backend enhancement test asserted the wrong response contract

- **Location:** `backend/tests/test_api.py:35-37`
- **Resolution verified:** `backend/tests/test_api.py` now asserts `data["assessment"]["id"]` and checks `new_resolution`.
- **Remaining test gap:** add negative input coverage and coordinate-invariance coverage described in the open P1 finding.

## Significant correctness and UX issues

### P1 — Default "Google Maps 5m" calibration fabricates a measurement

- **Locations:** `frontend/app/editor/[id]/page.tsx:36-45`, `frontend/app/editor/[id]/page.tsx:99-113`, `frontend/app/editor/[id]/page.tsx:492-495`
- **Evidence:** every new or uncalibrated image receives `0.1000 m/px`, `5.0m`, and `approx_map_measure`; the quick action additionally assumes a 50px scale bar without observing an actual line in the uploaded image.
- **Impact:** the red uncalibrated warning disappears, but roof area, panel capacity, and financial estimates can be materially wrong for any image whose pixel scale is not 10px/m. `approx_map_measure` should still be derived from a selected/drawn reference line, not silently assigned.
- **Required fix:** retain `uncalibrated` until the user draws/selects a measured reference, or gate all downstream metric calculations behind an explicit estimate acknowledgement. Do not overwrite an existing unknown scale merely to suppress a warning.

### P2 — Request validation does not match the advertised API

- **Location:** `backend/app/schemas.py:243-245`
- **Evidence:** `scale` accepts 3 even though the endpoint and UI describe only 2× or 4×; `method` is an unrestricted string despite the contract naming only `auto`, `replicate`, and `local`.
- **Impact:** callers can get undocumented results (for example, a 3× local resize or an arbitrary method silently behaving as local).
- **Required fix:** make `scale` a literal/enum of `2 | 4`, and make `method` a literal/enum of the three supported choices. Mirror the constraint in TypeScript.

### P2 — UI overpromises the active enhancement engine

- **Location:** `frontend/components/CanvasEditor.tsx:400-417`; `frontend/app/editor/[id]/page.tsx:295-301`
- **Evidence:** the 4× option labels the operation `Real-ESRGAN AI` / `Deep Learning`, while the default configuration documented in `feedback-log.md` has no Replicate token and therefore uses a Lanczos-based fallback. The API is called with `method: "auto"` for both options.
- **Impact:** users can reasonably believe a generative AI model ran when it did not.
- **Required fix:** label choices by requested scale, show the actual `model_name` only after completion, and reserve Real-ESRGAN wording for a confirmed cloud execution.

## Acceptance checklist for the next worker pass

1. Fix the missing `Optional` import and verify `from app.main import app` succeeds in the declared dependency environment.
2. Correct the enhancement test response assertion and add coordinate-invariance regression coverage.
3. Implement complete pixel-coordinate migration or explicit layout invalidation during upscale.
4. Remove fabricated default calibration; require an actual scale reference or an explicit acknowledged estimate.
5. Tighten request schemas to the supported scale and method values.
6. Re-run `pytest backend/tests -q`, `npm run build`, and a manual 2×/4× editor flow with saved geometry, an obstacle, calibration reference, and a layout.

