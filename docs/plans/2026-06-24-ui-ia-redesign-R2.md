# UI/IA Redesign R2 — deferred A/B feature carry-overs

> Executes the spec's R2: fold every deferred A/B item into its R1 home. Each task
> ends green (lint+build+tests) and UI is verified by screenshot in an isolated
> headless browser. Commit per task. Spec: docs/specs/2026-06-24-ui-ia-redesign-design.md.

Order is least-risky → most-risky so the bulk ships and is verified before the two
architectural rewrites, which re-verify all dependents afterward.

- **R2-1 Shapes library** — add triangle, diamond, pentagon, hexagon, star, line, arrow
  to the Shapes flyout (engine addShape kinds + panel buttons).
- **R2-2 Image background** — set an uploaded image as the canvas background (Canvas▸Background).
- **R2-3 Rich text** — bold/italic/underline/strikethrough, text align, line-height,
  letter-spacing, and a text background fill, in the Text options panel.
- **R2-4 Clipboard image paste** — paste an image from the OS clipboard (paste event) onto the canvas.
- **R2-5 PDF export** — add PDF to the export formats (lazy-load jspdf).
- **R2-6 Snapping + guides** — snap moving objects to canvas edges/center + other object
  edges, with alignment guide lines; threshold zoom-aware; toggle in the top bar.
- **R2-7 Artboard / output size (pragmatic montage)** — a fixed artboard rect inside the
  canvas, content clipped to it; export at the artboard's pixel size; presets + custom W×H.
  This delivers exact output dimensions and the montage clipping benefit.
- **R2-8 Templates** — save the scene as JSON and re-load it (openImageEditor/engine API + demo).
- **R2-9 Diff-based history** — replace full-snapshot history with jsondiffpatch deltas
  (base + patches) for memory scalability; behavior identical, re-verified.

## Global constraints
No `any`/`@ts-ignore`/`!`. Verify via isolated screenshots, not DOM. Each task: lint
clean, lib+demo build, tests green, 0 prod vulns before commit. Re-verify R1 features
that an architectural task touches (load/crop/redact/export/bg/frame after R2-7/R2-9).

## Status — all complete (2026-06-24)

Every R2 task shipped, each as its own commit, gated green (lint + lib/demo build +
`170` unit tests) and verified in an isolated headless browser:

- **R2-1..R2-4** — shapes / image background / rich text / clipboard paste (carried over).
- **R2-5 PDF export** — lazy `jspdf`; Export menu shows PDF; produces a valid Blob.
- **R2-6 Snapping + guides** — edge/center snap to canvas + other objects; magenta guides
  on the overlay; zoom-aware threshold; magnet toggle in the top bar.
- **R2-7 Artboard** — presets + custom W×H; dimmed mask + dashed outline; raster/PDF export
  crops to the region at its **exact** pixel size (verified 1080×1920 / 1920×1080 / 800×600).
- **R2-8 Templates** — engine `exportScene()`/`loadScene()` (versioned, type-guarded);
  Image-menu Save/Load; full round-trip restores scene + artboard.
- **R2-9 Diff-based history** — `DeltaHistory` (jsondiffpatch base + deltas) replaces the
  full-snapshot stack; behavior identical, 12 dedicated unit tests.

Architectural re-verification (per the constraint above): after R2-7/R2-9, crop, redact
(pixelate), background, and frame were re-checked — including a crop→redact→undo×2→redo×2
round-trip through the new diff history — all reproduce exact visual state with no console
errors. 0 prod vulnerabilities (`jsondiffpatch`, `jspdf` added).
