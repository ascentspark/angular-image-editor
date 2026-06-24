# Design: Editor UI/IA redesign + color/font/compositing fixes

**Date:** 2026-06-24
**Status:** approved (pending spec review)

## Problem

Tools were placed by category, not by how they're used. Specific defects:
- **Layers** was a transient toolbar *mode*; it needs to be a persistent companion
  panel used in tandem with group/align/fill/etc., with its own show/hide.
- Object-ops (group/align/duplicate/delete/opacity) were buried under a "Select"
  tool, so you couldn't use them while on Text/Draw/etc.
- The toolbar had ~14 loose slots with no grouping; related tools should share a
  slot via a Photoshop-style flyout "changer".
- Color pickers offered only 2–3 preset swatches — **no custom color** anywhere
  (fill, draw/scribble, text, background, frame).
- Fonts were a small fixed list — need broad **web/Google fonts**.
- **Highlighter and Redact composite incorrectly** against underlying layers.

## Principle

- **Tools = modes** → left toolbar (grouped, flyout slots).
- **Actions ≠ modes** → top bar (undo/redo, zoom, fit, history, image, export).
- **Layers + object-ops = a persistent companion panel** (right column, bottom),
  available regardless of the active tool.

## 1. Left toolbar — flyout groups

Eight slots. A slot shows its active sub-tool and a corner ▸ opens a flyout to
switch within the group. Selecting a slot sets the active tool + Options panel.

| Slot | Flyout members | Notes |
|---|---|---|
| Select | move / multi-select | pointer mode; clicking selects |
| Crop & Rotate | *(merged single tool)* | aspect presets (+custom ratios), rotate, flip, straighten |
| Color | *(Adjust ⟷ Filters tabs in panel)* | default landing tool |
| Draw | Pen · Highlighter · Eraser | brush variants |
| Shapes | Rectangle · Ellipse · Line · Arrow · (+more later) | last-used shows on slot |
| Text | — | |
| Redact | *(Blur/Pixelate/Solid in panel)* | |
| Canvas | Frame · Background | |

Merges: Crop+Rotate→one transform tool; Adjust+Filters→**Color** (two tabs).
Default active tool = **Color → Adjust**. `mode`/`tools`/`disabledTools` still
resolve which slots/sub-tools appear; flyout grouping is presentation over the
resolved set.

## 2. Right column — persistent panels

- **Options** (top): contextual to the active tool only. No object-ops here.
- **Layers** (bottom, always present, collapsible, own show/hide): object z-stack,
  top first. Per row: name, **visibility**, **lock** (selectable=false → clicks
  pass through), **opacity** (slider on the selected row), drag/▲▼ reorder,
  click-to-select. A **mini action bar** (Group · Ungroup · Align ▸ · Duplicate ·
  Delete) operates on the current selection — usable with any active tool. Base
  image = protected "Background" (no delete).

`showHistory` is replaced/augmented: Layers is the persistent panel; History
moves to a top-bar popover (below).

## 3. Top bar — actions

undo · redo │ zoom −/%/+ · fit │ **History** (popover button) │ Image (picker) │
Export. History is no longer a docked panel.

## 4. Color — presets + custom picker (everywhere)

A reusable **color field**: the 2–3 brand/preset swatches **plus a custom-color
control** (native `<input type="color">` styled as a swatch; opens the OS picker).
Used for: draw/scribble color, shape stroke, shape **fill**, text color, arrow,
frame color, background color. Selecting custom updates the active object live
(via the existing `styleActiveObject`) and the default for new objects.

## 5. Fonts — web/Google fonts

- Expand `DEFAULT_FONTS` to a broader curated set of popular Google families.
- Add a **custom font entry**: a text field in the Text panel where any Google
  font family name can be typed; `ensureFontLoaded(family)` already injects the
  Google Fonts stylesheet on demand and awaits the CSS Font Loading API, so an
  arbitrary family loads and applies. Hosts can still override the whole list via
  the `fonts` input.

## 6. Highlighter & Redact — correct compositing

**Highlighter:** must read as a translucent highlight over underlying content,
not an opaque colored line. Brush = `PencilBrush` with the chosen color at low
alpha (~0.35) and a wider default width; strokes sit above content but let it
show through. (Distinct from Pen, which is opaque.)

**Redact:** must obscure the **composited content beneath the region** (base
image + any annotations/layers under it), not just the base image.
- The user defines a rectangular region (drag on canvas; default rect with
  resize as a fallback). On commit, sample the *rendered* pixels under that
  region from the canvas, apply the chosen effect, and lay an **opaque patch**
  in that exact region:
  - **Solid** → opaque rectangle (already correct).
  - **Pixelate** → sample region → Fabric `Pixelate` → place as image patch.
  - **Blur** → sample region → Fabric `Blur` → place as image patch.
- Because the patch is baked from the composite at commit time, it correctly
  hides everything underneath and is independent of later edits (redaction is
  final by intent). The previous approach (cloning only the base image + clip)
  is replaced.

## Affected components / architecture

- `tool-rail` → renders **flyout groups** from a `TOOLBAR_GROUPS` model (slot →
  sub-tools); tracks per-slot active sub-tool + flyout open state.
- `options-panel` → Color tool with **Adjust|Filters tabs**; merged **Crop &
  Rotate** panel; Draw/Shapes/Text/Redact/Canvas panels; embeds the new color
  field + custom font entry; **object-ops removed** (moved to Layers).
- new `color-field` component (presets + custom picker), reused across panels.
- `layers-panel` → becomes the persistent right-column panel with the object-ops
  mini action bar + per-row opacity/lock/visibility.
- `history-list` → rendered inside a **top-bar popover** instead of the column.
- `image-editor` (container) → flyout state, persistent Layers wiring, History
  popover, opacity handler, custom-color/font handlers; default tool = Color.
- `editor-engine` → highlighter translucent brush; redact-by-composite-sampling;
  `setOpacity(value)` for the active selection / a layer id.

## Where the deferred A/B items land (future phases)

More shapes → Shapes flyout · Image background → Canvas▸Background · Opacity →
Layers/selection · Rich text (underline/spacing/bg) → Text panel · PDF → Export
formats · OS-clipboard image paste → clipboard · Snapping guides → drag behavior
(+ overflow toggle) · Templates → Image menu · Canvas resize → Canvas tool.

## Phasing

- **R1 — IA restructure** (this spec's §1–§6): toolbar flyout groups, Color/Crop
  merges, persistent Layers with object-ops + opacity, History popover, custom
  color field everywhere, expanded/custom fonts, highlighter + redact compositing
  fix. No net-new feature surface beyond these — just correct homes + the three
  fixes the user called out.
- **R2+ — features**: fold in the remaining deferred A/B items into the homes
  above, one batch per plan.

## Verification

Per the project's visual-truth rule: each tool/panel verified by clicking through
the demo in an isolated headless browser + screenshot, not DOM assertions. Pure
logic (toolbar-group resolution, redact region math, opacity) unit-tested.
Highlighter translucency, redact-over-annotation, and custom color/font changes
each eyeballed on a composited scene. axe clean; lint clean; build green.
