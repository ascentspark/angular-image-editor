import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AspImageEditor, type AspTool } from '@ascentsparksoftware/angular-image-editor';

import { DocExample, type ExampleSource } from '../../shared/doc-example';
import { DocPage, type PageSection } from '../../shared/doc-page';

interface ToolDemo {
  anchor: string;
  title: string;
  description: string;
  tools: AspTool[];
}

@Component({
  selector: 'demo-editing-tools',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocPage, DocExample, AspImageEditor],
  template: `
    <demo-doc-page
      heading="Editing tools"
      lead="Every editing tool, each shown with its rail isolated via the tools input. Load an image with the Image button, then try the tool. In your app you typically keep the full rail for a mode."
      [sections]="sections"
    >
      @for (t of demos; track t.anchor) {
        <demo-example
          [anchor]="t.anchor"
          [title]="t.title"
          [description]="t.description"
          [sources]="sourceFor(t)"
        >
          @defer (on viewport) {
            <asp-image-editor mode="advanced" [tools]="t.tools" height="480px" />
          } @placeholder {
            <div class="ed-skel">Loading editor…</div>
          }
        </demo-example>
      }
    </demo-doc-page>
  `,
})
export class EditingTools {
  protected readonly demos: ToolDemo[] = [
    {
      anchor: 'crop',
      title: 'Crop',
      description:
        'An interactive, non-destructive crop frame — drag the handles and reposition it (rule-of-thirds, dimmed surroundings), pick an aspect, then Apply. It sets the output region that drives export; in basic mode you position the frame to choose which part of an off-ratio image is kept.',
      tools: ['crop', 'rotate'],
    },
    {
      anchor: 'adjust-filters',
      title: 'Adjust & filters',
      description:
        'Fine-tune brightness, contrast, saturation, vibrance, hue and blur, or apply filter looks (B&W, sepia, invert, sharpen, tint). Sliders preview live and commit on release.',
      tools: ['adjust', 'filters'],
    },
    {
      anchor: 'draw',
      title: 'Draw',
      description:
        'Freehand pen, a genuinely translucent highlighter, and an eraser — each with color and thickness controls. The highlighter composites correctly over everything beneath it.',
      tools: ['pen', 'highlighter', 'eraser'],
    },
    {
      anchor: 'text',
      title: 'Text & web fonts',
      description:
        'Click to drop an editable text box. Choose from a curated Google-font list or search any Google font by name; bold/italic/underline, alignment, color and size are all live.',
      tools: ['text'],
    },
    {
      anchor: 'shapes',
      title: 'Shapes',
      description:
        'Rectangle (sharp through any corner radius up to a pill), ellipse, triangle, polygon, star, line and arrow. Stroke, fill and the corner radius reflect from the selected shape.',
      tools: ['shapes'],
    },
    {
      anchor: 'redact',
      title: 'Redact',
      description:
        'Freehand redaction that bakes the composited pixels under the region — solid, blur or pixelate — concealing everything beneath, not just the base image. Click to place, then Apply.',
      tools: ['redact'],
    },
    {
      anchor: 'magic-wand',
      title: 'Magic wand',
      description:
        'Click a flat color region to erase it to transparency, with a tolerance slider. Pure flood-fill — no dependencies, works everywhere.',
      tools: ['magicwand'],
    },
    {
      anchor: 'ai',
      title: 'AI background tools',
      description:
        'Remove background and Cut out subject run an ONNX model in the browser — no image data leaves the page, no API key. They lazy-load the optional @imgly/background-removal dependency and show a progress bar while the model fetches.',
      tools: ['removebg', 'selectsubject'],
    },
    {
      anchor: 'background-frames',
      title: 'Background & frames',
      description:
        'Set a background color or gradient (it composites under transparent areas) and add a frame — none, mat, line, inset, hook or bead — with a frame color.',
      tools: ['background', 'frame'],
    },
  ];

  protected readonly sections: PageSection[] = this.demos.map((d) => ({
    id: d.anchor,
    label: d.title,
  }));

  protected sourceFor(t: ToolDemo): ExampleSource[] {
    const list = `[${t.tools.map((x) => `'${x}'`).join(', ')}]`;
    return [
      {
        label: 'HTML',
        lang: 'html',
        code: `<asp-image-editor mode="advanced" [tools]="${list}" height="480px" />`,
      },
    ];
  }
}
