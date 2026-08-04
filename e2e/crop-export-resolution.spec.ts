import { expect, test, type Page } from '@playwright/test';

/**
 * Regression coverage for the crop export resolution defect (Hiero CMS, 2026-07-29):
 * a crop committed in a small dialog used to export at the on-screen size of the
 * crop frame, silently discarding the source photo's real pixels.
 *
 * The `/e2e` harness generates a grid image of a requested source size, hosts the
 * editor in a fixed-width shell, and reports the decoded pixel size and sharpness
 * of the saved blob.
 */

/** Open the basic (profile-photo) flow over a generated source image. */
async function openBasicCrop(
  page: Page,
  opts: { source: number; shell: number; target?: string; chip?: string; format?: string },
): Promise<void> {
  const query = new URLSearchParams({
    mode: 'basic',
    aspect: '1:1',
    source: String(opts.source),
    shell: String(opts.shell),
    ...(opts.target ? { target: opts.target } : {}),
    ...(opts.chip ? { chip: opts.chip } : {}),
    ...(opts.format ? { format: opts.format } : {}),
  });
  await page.goto(`/e2e?${query.toString()}`);
  await expect(page.getByTestId('stat-loaded')).not.toHaveText('0');
}

async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('stat-saved')).not.toHaveText('-');
  await expect(page.getByTestId('stat-saved-size')).not.toHaveText('-');
}

function savedSize(page: Page) {
  return page.getByTestId('stat-saved-size');
}

async function savedDimensions(page: Page): Promise<{ width: number; height: number }> {
  const [w, h] = ((await savedSize(page).textContent()) ?? '').split('x').map(Number);
  return { width: w, height: h };
}

test.describe('cropped export resolution', () => {
  test('exports at the requested target size, not the size of the on-screen crop', async ({
    page,
  }) => {
    await openBasicCrop(page, { source: 2400, shell: 640, target: '1000x1000' });
    await save(page);
    await expect(savedSize(page)).toHaveText('1000x1000');
  });

  test('exports at source resolution when no target is requested', async ({ page }) => {
    await openBasicCrop(page, { source: 2400, shell: 640 });
    await save(page);
    const { width, height } = await savedDimensions(page);
    // The 1:1 frame covers ~84% of a 640px shell, so the pre-fix export was
    // ~230px. It must now recover the source pixels under the region instead.
    expect(width).toBeGreaterThan(1200);
    expect(width).toBeLessThanOrEqual(2400);
    expect(height).toBe(width);
  });

  test('never upscales a source that has fewer pixels than the target', async ({ page }) => {
    await openBasicCrop(page, { source: 300, shell: 640, target: '1000x1000' });
    await save(page);
    const { width } = await savedDimensions(page);
    expect(width).toBeLessThanOrEqual(300);
  });

  test('carries true source detail, not an upscaled screen-sized raster', async ({ page }) => {
    await openBasicCrop(page, { source: 2400, shell: 640, target: '1000x1000' });
    await save(page);
    // The fixture's 1px gridlines survive a true source-pixel export; upscaling
    // a ~230px raster to 1000px blurs them and collapses this score.
    const sharpness = Number(await page.getByTestId('stat-saved-sharpness').textContent());
    expect(sharpness).toBeGreaterThan(4);
  });

  test('a custom aspect chip carrying dimensions sets the export size', async ({ page }) => {
    await openBasicCrop(page, { source: 2400, shell: 640, chip: '800x800' });
    await page.getByRole('button', { name: '800×800' }).click();
    await save(page);
    await expect(savedSize(page)).toHaveText('800x800');
  });

  for (const format of ['jpeg', 'webp'] as const) {
    test(`${format} honours the export target like png does`, async ({ page }) => {
      await openBasicCrop(page, { source: 2400, shell: 640, target: '1000x1000', format });
      await save(page);
      await expect(page.getByTestId('stat-saved')).toContainText(`image/${format}`);
      await expect(savedSize(page)).toHaveText('1000x1000');
    });
  }

  test('the pdf page is sized from the delivered export, not the on-screen crop', async ({
    page,
  }) => {
    await openBasicCrop(page, { source: 2400, shell: 640, target: '1000x1000', format: 'pdf' });
    await save(page);
    // jsPDF's `px` unit writes the MediaBox in points at 96dpi, so a 1000px
    // export is a 1333pt page. Pre-fix this was the ~230px crop → ~307pt.
    const expected = Math.round((1000 * 96) / 72);
    await expect(savedSize(page)).toHaveText(`${expected}x${expected}`);
  });

  test('a rotated crop still exports at the target size with real detail', async ({ page }) => {
    await openBasicCrop(page, { source: 2400, shell: 640, target: '1000x1000' });
    await page.getByTitle('Rotate right').click();
    await save(page);
    await expect(savedSize(page)).toHaveText('1000x1000');
    const sharpness = Number(await page.getByTestId('stat-saved-sharpness').textContent());
    expect(sharpness).toBeGreaterThan(4);
  });

  test('export size is independent of the canvas size on screen', async ({ page }) => {
    await openBasicCrop(page, { source: 2400, shell: 420, target: '1000x1000' });
    await save(page);
    await expect(savedSize(page)).toHaveText('1000x1000');
  });

  /** Advanced mode: crop 1:1, optionally zoom the canvas, then Export → Download. */
  async function cropAndExport(page: Page, opts: { zoomClicks: number }): Promise<void> {
    await page.goto('/e2e?mode=advanced&source=2400&shell=1200&target=1000x1000');
    await expect(page.getByTestId('stat-loaded')).not.toHaveText('0');

    await page.locator('.asp-rail__tool', { hasText: 'Crop & rotate' }).click();
    await page.getByRole('button', { name: '1:1', exact: true }).click();
    await page.getByRole('button', { name: 'Apply crop' }).click();
    for (let i = 0; i < opts.zoomClicks; i += 1) {
      await page.getByRole('button', { name: 'Zoom in' }).click();
    }

    await page.getByRole('button', { name: 'Export' }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download image' }).click();
    await download;
    await expect(page.getByTestId('stat-exported-size')).not.toHaveText('-');
  }

  test('exports the same region at the same size whatever the canvas zoom is', async ({ page }) => {
    await cropAndExport(page, { zoomClicks: 0 });
    await expect(page.getByTestId('stat-exported-size')).toHaveText('1000x1000');
    const flat = Number(await page.getByTestId('stat-exported-sharpness').textContent());

    // Fabric treats the crop rect as viewport-space, so a zoomed canvas would
    // sample a different area at a different scale unless the engine neutralises
    // the viewport first. Same size AND same detail proves it did.
    await cropAndExport(page, { zoomClicks: 3 });
    await expect(page.getByTestId('stat-exported-size')).toHaveText('1000x1000');
    const zoomed = Number(await page.getByTestId('stat-exported-sharpness').textContent());

    expect(flat).toBeGreaterThan(0);
    expect(Math.abs(zoomed - flat)).toBeLessThan(flat * 0.05);
  });
});
