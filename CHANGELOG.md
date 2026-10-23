# Changelog

All notable changes to `@ascentsparksoftware/angular-image-editor`.

> **21.x line.** This branch tracks `main` one Angular major behind; each entry below
> ships here with the same minor number (`22.2.0` → **`21.2.0`**, `22.1.0` → **`21.1.0`**)
> and is published under the `ng21` dist-tag. Behaviour and API are identical.

## 22.2.0 — 2026-10-23

Driven by the Phlebio operator-panel handoff: a logo of any size and aspect has to
be zoomed out, panned and cropped into a fixed slot, and the host needs the result
as a Blob — never a file in Downloads. Neither entry point could do it; the host
was swallowing the library's own download anchor with a capture-phase listener.

### Changed — `saved` no longer fires from a download (**behavioural change**)

`(saved)` means "the user committed, here is the result"; `(exported)` means "a
file was written". Export → Download used to emit **both**, so a host listening for
the result could not tell whether it had also just spammed the user's Downloads
folder. Download now emits `(exported)` only. A host that wants both listens to
both.

If you relied on `(saved)` firing from the Export menu, listen to `(exported)` — or
let the user press the new commit button, which is what `(saved)` is for.

### Added — a commit action in every chrome

The workspace and viewer top bars gain an accent **Apply** button next to Export. It
exports in the selected format, hands the Blob to `(saved)` and writes nothing —
the same path the dialog's **Save** always took.

- `commitLabel` — the button's text (`'Use this logo'`); `null` reads "Save" in the
  dialog and "Apply" elsewhere.
- `showDownload` — `false` removes "Download image" from the Export menu (the
  button then reads **Format** and only offers format / quality).
- `showCommit` — `false` hides the commit button in the workspace and viewer. The
  dialog always has one.
- Export is now a secondary (outlined) button so the top bar has one primary action.

### Added — `chrome`: layout independent of the tool set

`mode` used to decide the tool set, the chrome and the crop model all at once.
`chrome: 'dialog' | 'workspace' | 'viewer' | null` picks the chrome on its own;
`null` keeps today's mapping (`basic → dialog`, `viewer → viewer`, else
`workspace`), so existing callers are untouched. `defaultChromeFor(mode)` is
exported. Host sizing (the dialog card hugging 520px) now follows the chrome, not
the mode, so a dialog-chromed advanced editor does not stretch its scrim.

### Fixed — `initialAspect` drew no crop frame outside the dialog, and the chip lied

In the workspace, `initialAspect="1:1"` lit the 1:1 chip but never started a crop,
so operators exported an uncropped image while the UI asserted a constraint. The
workspace now opens in the Crop tool with its movable frame at that aspect. Where
nothing can enforce the aspect (a tool set without `crop`, the viewer) the chip
stays inactive — the UI never claims a constraint it is not applying.

### Added — `fitMode: 'contain'` for the fixed-frame crop (the headline fix)

The dialog crop is an avatar crop: `clampImageToCover` kept the frame 100 %
covered, so a 2282×832 wordmark in a square slot could only ever be centre-cropped.
`fitMode="contain"` lowers the zoom floor to the whole-image fit (the image starts
there, centred), keeps a looser pan clamp (a letterboxed image may float inside
the frame but never leave it; an overflowing axis still keeps the frame covered),
and composites the uncovered area at export. **`cover` stays the default**; avatar
crops are unchanged.

### Added — `exportBackground`, and JPEG never encodes transparency as black

Unpainted export pixels (a contain crop's letterbox, a rotated image's corners, a
transparent source) are filled with the Background tool's colour when one is set;
otherwise with the new `exportBackground` input; otherwise PNG / WebP stay
transparent and JPEG (and the PDF raster) are filled white instead of black. The
fill is applied for the duration of the export only — undo and templates never
see it. `EditorEngine.setExportBackground()` / `getExportBackground()` for
headless hosts.

### Fixed — one zoom floor per interaction

The viewport zoom clamped to 25–400 while the fixed-frame crop clamped to 100–400,
and the dialog slider's `min="100"` / `max="300"` matched neither. The engine now
exposes `zoomRange` for the current interaction (image zoom while the fixed frame
is active, viewport zoom otherwise); the slider's `min` / `max` and the clamp read
the same value, so the advertised minimum is always reachable. The ± buttons step
the image zoom while the fixed frame is active.

### Added — the dialog forwards every input, and traps focus

`AspImageEditorDialog.open()` accepted six inputs and hard-coded `mode: 'basic'` and
a 520px card. The config now takes every editor input under its own name (`mode`
defaults to `'basic'`), plus `width` / `maxWidth` / `height` for the card (a
workspace chrome defaults to `min(1100px, 100%)` × `min(720px, 100vh − 48px)`).
The overlay is `aria-label`led with the heading, Tab cycles inside it, and focus
returns to the opener on close. `resolveDialogInputs()` and
`DIALOG_FORWARDED_INPUTS` back a test that fails when a new input is not forwarded.

### Added — types and helpers

`AspChrome`, `AspFitMode`, `defaultChromeFor()`. Pure helpers `image-crop-fit.ts`
(cover / contain scale, zoom floor, pan correction) and `export-fill.ts` (fill
resolution) are unit-tested; the shared Playwright contract suite
(`e2e/handoff-contracts.spec.ts`) runs the same-named tests as the React sibling.

### Changed — dependencies

`npm audit` is clean again: Angular 22.2.3 across the board (SSR advisories in the
docs site), DOMPurify via jsPDF (critical, shipped tree), vite pinned ≥ 8.3.3 via
an override (build tooling).

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
