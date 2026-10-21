# Web UI / Layout Audit

Review date: 2026-10-20 (Asia/Kuala_Lumpur)

## Scope and outcome

**Overall: the core product flow is visually coherent and functional, but not yet release-ready for a customer-facing solar-decision product.** The biggest outstanding issue is not cosmetic: layout guidance communicates a 4 kW AC cap while visibly producing a 22.55 kWp, 41-module system.

### Checked in a running local build

| Surface | 1440 × 900 desktop | 375 × 812 phone |
| --- | --- | --- |
| Upload / landing | Pass | Pass — no horizontal overflow observed |
| Roof editor | Pass | Pass — canvas renders; controls are dense |
| Panel packing | Pass | Source and desktop layout reviewed |
| Feasibility report | Pass | Pass — cards collapse cleanly to one column |
| Township planner | Pass after API data loads | Pass — card stack is readable |
| Economics sandbox | Pass | Pass — long content remains readable |

Quality gates also passed in this review: `backend` tests (28 passed) and `frontend` production build.

## What works well

- The four-step progress model makes the single-roof workflow easy to understand on desktop and reduces correctly to icons on phone.
- The application has a consistent visual language: solar amber for actions, emerald for viable/verified states, navy workspace panels, rounded cards, and clear metric hierarchy.
- The report page gives the principal decision metrics prominence and does not break when shown at 375px.
- The planner’s filters, portfolio cards, and horizontal table wrapper are sensible for the amount of data shown.
- Loading states are present; the planner initially shows zero assets while loading, then renders the real portfolio without a browser error.

## Priority findings

### P1 — Capacity guidance conflicts with the actual proposed system

- **Observed:** `frontend/app/layout-sim/[id]/page.tsx` presents a `SEDA & TNB Guidelines 4kWac Cap` control and recommends a 550 W module because eight modules yield roughly 4.4 kWp. The same demo visibly shows **41 modules / 22.55 kWp** in the layout, report, and summary bar.
- **Why it matters:** this is a trust and decision-quality failure: the interface simultaneously signals compliance with a cap and displays a design that far exceeds it.
- **Recommendation:** make the cap a real constraint with an explicit DC/AC rule, or relabel it as informational. When exceeded, show a prominent status (for example: “22.55 kWp requires three-phase / commercial review”) and require the user to choose an inverter / service category before presenting savings or payback.

### P1 — Mobile users lose global navigation

- **Observed:** `frontend/components/Navbar.tsx:44` hides the only primary navigation (`hidden md:flex`) below the `md` breakpoint. At 375px, the brand and engine status remain but there is no menu or alternate route to the Planner/Economics pages.
- **Why it matters:** users cannot discover or return to the advanced tools from a phone.
- **Recommendation:** add an accessible compact menu button at mobile widths; include Single Roof Assessment, Township Portfolio, and Economics Sandbox. Use `aria-expanded`, `aria-controls`, and Escape-to-close behavior.

### P1 — Editor control buttons are not accessible enough

- **Observed:** the running accessibility tree exposes blank-name buttons for Undo, Redo, zoom in/out, reset and similar canvas controls. `frontend/components/CanvasEditor.tsx:445-499` uses icon-only buttons without `aria-label`; comparable controls occur in `PanelOverlay.tsx` and `Roof3DViewer.tsx`.
- **Why it matters:** screen-reader and keyboard users cannot identify or reliably operate essential geometry tools.
- **Recommendation:** give every icon-only button a descriptive accessible name and a native `title`; expose the selected tool with `aria-pressed` (or radio semantics) and put canvas instructions in a programmatically associated description.

### P1 — Scale-calibration modal lacks dialog semantics and focus management

- **Observed:** `frontend/components/ScaleModal.tsx:71-230` renders a fixed overlay without `role="dialog"`, `aria-modal`, labelled description, initial focus, focus trap, or Escape-close handling.
- **Why it matters:** keyboard focus can move behind the modal; assistive technologies are not told a blocking calibration task has opened.
- **Recommendation:** use an accessible dialog primitive or implement full dialog behavior. The modal should focus its heading/first field on open, retain focus until closed, restore focus to the invoker, and announce validation errors.

### P2 — Phone editor prioritises the canvas over task completion

- **Observed:** at 375px, the editor canvas occupies most of the initial viewport; calibration, face details, and the “Simulate Solar Panels on Roof” CTA are below the fold. The top tool bar is visually dense, with four wrapped tool labels and no obvious compact mode.
- **Why it matters:** first-time mobile users may not understand where to continue, especially after drawing a polygon.
- **Recommendation:** use a bottom action bar for the primary next step, collapse secondary tools into an overflow menu, and add a small status summary (“1 face selected · scale verified”) above the CTA. Keep the canvas, but limit its initial height so that the next action is visible.

### P2 — The interface uses system-meaningful emoji as controls

- **Observed:** `✨ AI HD Upscale`, `📍 5m Maps Bar`, and several status affordances use emoji in visible control labels.
- **Why it matters:** emoji rendering is platform-dependent and visually inconsistent with the Lucide icon set used elsewhere; it also weakens the otherwise professional technical-tool aesthetic.
- **Recommendation:** replace structural emoji with the corresponding Lucide/SVG icons (`Sparkles`, `MapPin`, `ImageUp`, etc.), reserving emoji only for non-essential decorative copy.

### P2 — Text density and low-contrast microcopy affect scanability

- **Observed:** multiple workspaces rely on 9–11px text (`Stepper.tsx`, editor instructions, side panels, financial assumptions). On the dark panels this text is often muted slate gray; it is technically visible but difficult to scan at normal zoom and on phone.
- **Recommendation:** set a 12px practical floor for interactive/supporting text, 14px for body copy, and raise contrast for essential labels/instructions. Move extended model explanations into collapsible “Why this estimate?” sections rather than retaining dense always-visible prose.

### P2 — “Real-ESRGAN AI” wording is still conditional, not confirmed

- **Observed:** the 4× enhancement option is titled `4× Ultra-HD (Real-ESRGAN AI)` while its own subtext says cloud Real-ESRGAN runs only if configured, otherwise local super-sampling is used.
- **Why it matters:** a user can infer that a generative model was used when the local fallback actually ran.
- **Recommendation:** name the control by outcome/scale (“4× Ultra HD”), then show the actual engine after completion from `model_name`.

## Improvements that would raise quality fastest

1. **Correct decision integrity first:** enforce or clearly contextualise the capacity / inverter constraint and remove fabricated image scale defaults (see `plans/acceptance-review.md`).
2. **Make mobile navigation and the editor CTA reachable:** add a small-screen menu and persistent next-step action.
3. **Close accessibility gaps:** accessible names for icon controls, proper modal behavior, visible keyboard focus, and selected-state semantics.
4. **Create a compact visual token layer:** standardise type sizes, icon sizes, interaction states, and dark-panel contrast instead of repeatedly using ad-hoc `text-[9px]` / `text-[10px]` styles.
5. **Add visual regression coverage:** capture the landing, editor, layout, report, planner, and economics pages at 1440px and 375px; include populated, loading, empty, and error states.

## Suggested release criteria

- No decision-card, badge, or compliance label contradicts the calculated system parameters.
- Every interactive control has a visible label or accessible name, keyboard focus treatment, and correct state semantics.
- At 375px, navigation and the workflow’s next action are always reachable without hunting through the page.
- The scale status is truthful: uncalibrated imagery cannot look “verified.”

