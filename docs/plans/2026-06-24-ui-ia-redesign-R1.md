# UI/IA Redesign R1 — Implementation Plan

> Execute inline, task by task. Each task ends green (lint + build + relevant tests)
> and, for UI tasks, is verified in an isolated headless browser with a screenshot
> (visual truth, not DOM). Commit per task.

**Goal:** Restructure the editor UI by usage — flyout toolbar (modes), persistent
Layers+object-ops panel, Color/Crop merges, History popover — and fix custom color,
web fonts, and highlighter/redact compositing.

**Architecture:** Tools=modes (left toolbar, flyout groups). Actions=top bar. Layers +
object-ops = persistent right-column companion (always available). New reusable
color-field. Engine gains opacity + translucent highlighter + redact-by-composite.

**Tech Stack:** Angular 22 standalone/signals/OnPush, Fabric.js v7, Vitest, Playwright.

## Global Constraints
- No `any`/`@ts-ignore`/non-null `!`. OnPush, signals, zoneless-safe.
- Verify UI by screenshot in an ISOLATED headless browser (own user-data-dir); never
  touch the shared Playwright-MCP browser. Pure logic unit-tested.
- Every task: lint clean, lib+demo build, tests green before commit.
- Spec: `docs/specs/2026-06-24-ui-ia-redesign-design.md`.

---

## File structure (created / modified)

- Create `lib/ui/controls/color-field.ts(+html/css)` — presets + custom picker.
- Modify `lib/engine/editor-engine.ts` — `setOpacity`, translucent highlighter, redact-by-composite.
- Create `lib/registry/toolbar-groups.ts` — slot→sub-tool grouping model + resolver.
- Modify `lib/ui/rail/tool-rail.*` — render flyout groups.
- Modify `lib/ui/options-panel/*` — Color tabs, merged Crop&Rotate, color-field, custom font, drop object-ops.
- Modify `lib/ui/layers/layer-list.*` — object-ops mini bar + per-row opacity; persistent placement.
- Modify `lib/ui/image-editor/*` — container wiring, History popover, redact marquee+apply, default tool.
- Modify `lib/ui/image-editor/fonts.ts` — expanded list + custom-font support.

---

## Task 1 — Reusable color field (presets + custom picker)
**Files:** Create `lib/ui/controls/color-field.ts/.html/.css`.
**Produces:** `AspColorField` — inputs `colors: readonly string[]`, `value: string`; output `colorChange = output<string>()`. Renders preset swatches (active ring on match) + a native `<input type="color">` swatch whose change emits the chosen hex.
- Build: presets loop + custom `<input type=color>`; emit on swatch click and on input change.
- Verify: used in panels (Task 5); standalone unit test asserts colorChange emits on input.
- Commit.

## Task 2 — Engine: opacity + highlighter translucency + redact-by-composite
**Files:** Modify `editor-engine.ts`.
**Produces:**
- `setOpacity(value: number, commit = true): boolean` — sets `opacity` (0–1) on the active object(s); returns false if none.
- highlighter path in `setFreeDraw`: when the tool is highlighter, brush color = rgba(color, 0.35), width ×2, so strokes are translucent over content.
- `addRedaction(mode)` reworked: sample the composited pixels under the target rect via `canvas.toCanvasElement(multiplier, [rect])` (or region crop), build a `FabricImage` from that, apply `Pixelate`/`Blur` for those modes (solid = opaque rect), tag `aspRole:'redaction'`, place at the rect. Bakes the composite so it hides ALL underlying layers.
- Verify: visual (Task 9 redact flow). Pure region-math helper unit-tested.
- Commit.

## Task 3 — Toolbar group model + resolver
**Files:** Create `lib/registry/toolbar-groups.ts`; spec `toolbar-groups.spec.ts`.
**Produces:** `TOOLBAR_GROUPS: readonly ToolGroup[]` where `ToolGroup = { id; label; icon; members: AspTool[] }` (Select, Crop&Rotate→['crop'], Color→['adjust'], Draw→['pen','highlighter','eraser'], Shapes→['shapes','arrow','line'], Text→['text'], Redact→['redact'], Canvas→['frame','background']). `resolveGroups(tools: AspTool[]): ResolvedGroup[]` keeps only groups whose members intersect the resolved tool set, preserving member order. Unit-test resolution truth tables.
- Note: 'rotate'/'flip'/'straighten' fold into the Crop&Rotate tool's panel; 'layers'/'select'/object-ops are NOT toolbar groups.
- Commit.

## Task 4 — Tool rail → flyout groups
**Files:** Modify `tool-rail.ts/.html/.css`.
**Consumes:** resolveGroups output; `activeTool`.
**Produces:** rail renders one button per group (icon+label of the group's active/representative member); a ▸ corner opens a flyout listing members to pick; emits `toolSelect(AspTool)`. Tracks per-group last-selected sub-tool.
- Verify: screenshot rail with a flyout open.
- Commit.

## Task 5 — Options panel restructure
**Files:** Modify `options-panel.ts/.html/.css`.
- Color tool: a panel with **Adjust | Filters** segmented tabs (adjust sliders / filter grid).
- Crop&Rotate: aspect presets (+custom) AND rotate/flip/straighten in one panel.
- Replace every color swatch row with `AspColorField` (draw/shapes/text/redact/frame). Shapes panel adds a **fill** color field.
- Text: custom-font entry (Task 8).
- Remove object-ops (`object` kind) — moved to Layers (Task 6).
- Verify: screenshots of Color tabs, merged Crop&Rotate, shape fill picker.
- Commit.

## Task 6 — Persistent Layers panel + object-ops + opacity
**Files:** Modify `layer-list.ts/.html/.css`; container.
- Layers panel becomes persistent in the right column (always shown, collapsible with its own toggle), not gated behind a 'layers' tool.
- Add a mini action bar: Group · Ungroup · Align ▸ · Duplicate · Delete (act on selection).
- Per selected row: opacity slider → `setOpacity`. Keep visibility/lock/reorder.
- Verify: screenshot layers with action bar + opacity on a multi-object scene; lock passes clicks through.
- Commit.

## Task 7 — History → top-bar popover
**Files:** container `image-editor.*`.
- Move history into a top-bar **History** button + popover (reuse `history-list`); remove it from the right column.
- Verify: screenshot history popover open.
- Commit.

## Task 8 — Fonts: expanded list + custom Google font entry
**Files:** `fonts.ts`; options-panel text section; container.
- Expand `DEFAULT_FONTS` (~20 popular Google families). Add a text input "Add Google font" → `ensureFontLoaded(name)` then apply + append to the available list.
- Verify: type a font name, text re-renders in it.
- Commit.

## Task 9 — Container wiring + redact marquee + default tool
**Files:** container `image-editor.ts/.html`.
- Wire flyout group selection, persistent layers, history popover, opacity, custom color/font handlers. Default active tool = Color (adjust).
- Redact: place a draggable/resizable marquee rect on the canvas; an **Apply** button bakes the composite under its current bounds via the Task-2 engine path; default-rect + resize is the interaction.
- Verify: full redact-over-annotation flow; highlighter translucency over content; custom color on fill/draw/text.
- Commit.

## Task 10 — Full visual QA + gate
- Screenshot every tool/panel, light+dark, desktop+mobile, in the isolated browser; eyeball against intent.
- axe clean; lint; lib+demo build; 0 prod vulns; npm pack valid.
- Honesty check per tool. Commit any fixes. Update README for the new IA.

---

## Self-review
- Spec coverage: §1 toolbar→T3/T4; §2 panels→T5/T6/T7; §3 top bar→T7; §4 color→T1/T5; §5 fonts→T8; §6 highlighter/redact→T2/T9. ✓
- Object-ops relocation: removed in T5, added in T6. ✓
- Names consistent: `AspColorField.colorChange`, `setOpacity`, `resolveGroups`, `TOOLBAR_GROUPS`. ✓
- R2 (deferred A/B features) is out of scope for this plan.
