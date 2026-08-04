# Changelog

All notable changes to `@ascentsparksoftware/angular-image-editor`.

## 22.1.0 — 2026-08-04

### Fixed — cropped exports were silently downsampled to screen resolution

**Every consumer that cropped a photo got a screen-sized export.** The crop region
lives in scene coordinates, and the base image is scaled down to fit the canvas on
screen, so a committed crop rasterised at whatever size the host's dialog happened
to be. A 2400×2400 photo cropped 1:1 in a 640px modal exported at ~230×230. Nothing
in the UI or the API said the resolution had been thrown away, and the loss is
permanent once the blob is stored.

Cropped exports now carry the source image's real pixels. If you crop, expect
larger blobs than before — that is the fix. Use `exportTarget` (below) if you want
a specific, smaller size.

Reported by the Hiero CMS team, who hit it as "fuzzy avatars".

### Fixed — exports were wrong while the canvas was zoomed or panned

Fabric treats the crop rectangle handed to `toDataURL()` as viewport-space, so a
zoomed or panned canvas sampled the wrong area at the wrong scale. The engine now
renders the export at an identity viewport, as the redaction sampler already did.

### Added — `exportTarget`, and real dimensions on aspect options

```ts
// An exact pixel size for every crop in this editor
<asp-image-editor [exportTarget]="{ width: 1000, height: 1000 }" />

// …or per aspect option — the selected chip's dimensions win while it is selected
aspectRatios = [aspectOption(1200, 630, 'Social'), aspectOption(1000, 1000, 'Avatar')];
```

- `AspExportTarget` — new exported type.
- `AspAspectOption` gains optional `width`/`height`; `aspectOption(w, h, label)` now
  keeps them instead of collapsing to `{ label, ratio }`. Additive; hand-built
  `{ label, ratio }` options keep working.
- `EditorEngine.setExportTarget()` / `getExportTarget()` for headless hosts.
- Exports are capped at the source's real resolution (never upscaled) and at a
  4096×4096 bitmap so low-end devices can allocate them.

### Added — custom aspect chips in `basic` mode

`aspectRatios` was documented as "shown after the presets" but the basic (profile
photo) layout only rendered the built-in presets, so a host could not offer a
CMS-sized target in the very mode the export bug hit hardest.

### Changed

- `outputSize()` now reports the delivered export size rather than the crop region
  in scene units, so the PDF page size matches the image it contains.
- CI runs a Playwright suite against the demo's hidden `/e2e` harness; export
  resolution is asserted on decoded blobs, since it cannot be verified in jsdom.

### Known issue (unchanged)

`svg` export still serialises the whole canvas and ignores the crop region. Tracked
separately.
