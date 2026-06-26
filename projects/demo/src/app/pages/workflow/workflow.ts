import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AspImageEditor } from '@ascentsparksoftware/angular-image-editor';

import { DocExample, type ExampleSource } from '../../shared/doc-example';
import { DocPage, type PageSection } from '../../shared/doc-page';

@Component({
  selector: 'demo-workflow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPage, DocExample, AspImageEditor],
  template: `
    <demo-doc-page
      heading="Canvas & workflow"
      lead="Everything around the pixels: a layer stack, measurement guides, a fixed output artboard, re-editable templates, robust import, and keyboard shortcuts."
      [sections]="sections"
    >
      <demo-example
        anchor="layers"
        title="Layers"
        description="A persistent layers panel: drag to reorder z-order, lock, show/hide, set opacity, rename inline, and group/ungroup, align, duplicate or delete the selection. Available regardless of the active tool."
        [sources]="fullSource"
      >
        @defer (on viewport) {
          <asp-image-editor mode="full" height="520px" />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
      </demo-example>

      <demo-example
        anchor="guides"
        title="Rulers, guides & snapping"
        description="Toggle rulers, drag guides off them, and the magnet enables edge/center snapping with alignment guides while you move objects. Guides are draggable, snap targets, and part of undo/redo."
        [sources]="fullSource"
      >
        @defer (on viewport) {
          <asp-image-editor mode="full" height="520px" />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
      </demo-example>

      <demo-example
        anchor="artboard"
        title="Artboard & output size"
        description="Pick an output-size preset or a custom W×H. Content outside the artboard is dimmed and excluded from export, which renders at exactly the artboard's pixel dimensions."
        [sources]="fullSource"
      >
        @defer (on viewport) {
          <asp-image-editor mode="full" height="520px" />
        } @placeholder {
          <div class="ed-skel">Loading editor…</div>
        }
      </demo-example>

      <demo-example
        anchor="templates"
        title="Templates (save / load)"
        description="The Image menu's Save / Load round-trips the whole scene as JSON via the engine's exportScene / loadScene, so a layout is re-editable later."
        [sources]="templateSource"
      >
        <p class="prose">
          For headless control, call the engine directly — see
          <a href="/reference#engine">Headless engine</a>.
        </p>
      </demo-example>

      <demo-example
        anchor="import"
        title="Import — large images & HEIC"
        description="Imports are decoded with createImageBitmap: EXIF orientation is applied, very large JPEGs are downscaled, and HEIC/HEIF is converted via the optional heic2any decoder."
      >
        <p class="prose">
          An undecodable or oversized file surfaces a transient error toast and an
          <code>(errorOccurred)</code> event instead of silently doing nothing.
        </p>
        <p class="note">
          HEIC/HEIF import needs the optional <code>heic2any</code> dependency. Without it, those
          files report a clear error; every other format works unaffected.
        </p>
      </demo-example>

      <demo-example
        anchor="keyboard"
        title="Keyboard shortcuts"
        description='Active while the pointer is over the editor and you are not typing in a field. Disable with [keyboardEnabled]="false".'
      >
        <table class="api-table">
          <thead>
            <tr>
              <th>Keys</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>Ctrl/Cmd + Z</code></td>
              <td>Undo</td>
            </tr>
            <tr>
              <td><code>Ctrl/Cmd + Shift + Z</code> / <code>Ctrl + Y</code></td>
              <td>Redo</td>
            </tr>
            <tr>
              <td><code>Delete / Backspace</code></td>
              <td>Remove selection</td>
            </tr>
            <tr>
              <td><code>Ctrl/Cmd + C / V / D</code></td>
              <td>Copy / paste / duplicate</td>
            </tr>
            <tr>
              <td><code>Ctrl/Cmd + A</code></td>
              <td>Select all</td>
            </tr>
            <tr>
              <td><code>Esc</code></td>
              <td>Deselect (or cancel the basic modal)</td>
            </tr>
            <tr>
              <td><code>Space</code> (hold)</td>
              <td>Pan</td>
            </tr>
          </tbody>
        </table>
      </demo-example>
    </demo-doc-page>
  `,
})
export class Workflow {
  protected readonly sections: PageSection[] = [
    { id: 'layers', label: 'Layers' },
    { id: 'guides', label: 'Guides & snapping' },
    { id: 'artboard', label: 'Artboard' },
    { id: 'templates', label: 'Templates' },
    { id: 'import', label: 'Import' },
    { id: 'keyboard', label: 'Keyboard' },
  ];

  protected readonly fullSource: ExampleSource[] = [
    { label: 'HTML', lang: 'html', code: `<asp-image-editor mode="full" height="520px" />` },
  ];

  protected readonly templateSource: ExampleSource[] = [
    {
      label: 'TS',
      lang: 'ts',
      code: `// Headless save / load of a re-editable scene
const json = engine.exportScene();
// ...later
await engine.loadScene(json);`,
    },
  ];
}
