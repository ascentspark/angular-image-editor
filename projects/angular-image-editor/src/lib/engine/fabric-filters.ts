/**
 * Instantiate Fabric.js filter objects from the editor's adjustment/look state.
 *
 * This is the single place that knows the concrete Fabric filter classes; the
 * rest of the engine works in our normalized terms. Adjustment params come from
 * the pure {@link activeAdjustments} mapping; "looks" are parameter-less effects.
 */

import type * as Fabric from 'fabric';

import { activeAdjustments } from './filter-map';
import type { FabricModule } from './fabric-loader';
import type { AspFilter } from '../types/editor.types';

type FabricFilter = Fabric.filters.BaseFilter<string>;

/** Parameter-less "look" filters that are toggled on/off. */
export const LOOK_FILTERS: readonly AspFilter[] = ['grayscale', 'sepia', 'invert', 'sharpen'];

const SHARPEN_MATRIX = [0, -1, 0, -1, 5, -1, 0, -1, 0];

/**
 * Build the ordered Fabric filter chain for the current state: active
 * adjustments first (so looks compose on top of tonal corrections), then looks.
 */
export function buildFabricFilters(
  fabric: FabricModule,
  adjustments: Readonly<Record<string, number>>,
  looks: ReadonlySet<AspFilter>,
): FabricFilter[] {
  const f = fabric.filters;
  const chain: FabricFilter[] = [];

  for (const { key, param } of activeAdjustments(adjustments)) {
    switch (key) {
      case 'brightness':
        chain.push(new f.Brightness({ brightness: param }));
        break;
      case 'contrast':
        chain.push(new f.Contrast({ contrast: param }));
        break;
      case 'saturation':
        chain.push(new f.Saturation({ saturation: param }));
        break;
      case 'vibrance':
        chain.push(new f.Vibrance({ vibrance: param }));
        break;
      case 'hue':
        chain.push(new f.HueRotation({ rotation: param }));
        break;
      case 'blur':
        chain.push(new f.Blur({ blur: param }));
        break;
      case 'pixelate':
        chain.push(new f.Pixelate({ blocksize: Math.max(1, Math.round(param)) }));
        break;
      case 'noise':
        chain.push(new f.Noise({ noise: Math.round(param) }));
        break;
      case 'gamma':
        chain.push(new f.Gamma({ gamma: [param, param, param] }));
        break;
      default:
        break;
    }
  }

  for (const look of looks) {
    switch (look) {
      case 'grayscale':
        chain.push(new f.Grayscale());
        break;
      case 'sepia':
        chain.push(new f.Sepia());
        break;
      case 'invert':
        chain.push(new f.Invert());
        break;
      case 'sharpen':
        chain.push(new f.Convolute({ matrix: SHARPEN_MATRIX }));
        break;
      default:
        break;
    }
  }

  return chain;
}
