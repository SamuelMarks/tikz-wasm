/**
 * Maps TeX internal font names (TFM filenames) to Web CSS equivalents.
 *
 * This system bridges the gap between TeX's strict metric system and the
 * browser's CSS rendering. By mapping standard Computer Modern fonts to
 * a bundled Latin Modern WOFF2, we ensure that the SVG text aligns
 * reasonably well with the coordinates calculated by the DVI engine.
 *
 * @packageDocumentation
 */

/**
 * Represents CSS font styling attributes corresponding to a TeX font.
 */
export interface CssFontSpec {
  /**
   * CSS `font-family` value.
   */
  readonly family: string;

  /**
   * CSS `font-style` value (`'normal'`, `'italic'`, or `'oblique'`).
   */
  readonly style: string;

  /**
   * CSS `font-weight` value (e.g., `400` or `700`).
   */
  readonly weight: string | number;
}

const FALLBACK: CssFontSpec = {
  family: 'serif',
  style: 'normal',
  weight: 400
};

/**
 * The standard "Latin Modern" font family name used in our generated CSS.
 */
export const BUNDLED_FONT_FAMILY = 'TikZ-LatinModern';

/**
 * Mappings for standard 5pt..17pt TeX fonts to CSS properties.
 */
const FONT_MAP: Readonly<Record<string, CssFontSpec>> = {
  // Roman (Serif)
  cmr5: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
  cmr6: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
  cmr7: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
  cmr8: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
  cmr9: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
  cmr10: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
  cmr12: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
  cmr17: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },

  // Bold
  cmbx5: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
  cmbx6: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
  cmbx7: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
  cmbx8: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
  cmbx9: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
  cmbx10: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
  cmbx12: { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },

  // Italic
  cmti7: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmti8: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmti9: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmti10: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmti12: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },

  // Math Italic
  cmmi5: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmmi6: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmmi7: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmmi8: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmmi9: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmmi10: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
  cmmi12: { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },

  // Slanted
  cmsl8: { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },
  cmsl9: { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },
  cmsl10: { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },
  cmsl12: { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },

  // Sans Serif
  cmss8: { family: 'sans-serif', style: 'normal', weight: 400 },
  cmss9: { family: 'sans-serif', style: 'normal', weight: 400 },
  cmss10: { family: 'sans-serif', style: 'normal', weight: 400 },
  cmss12: { family: 'sans-serif', style: 'normal', weight: 400 },
  cmss17: { family: 'sans-serif', style: 'normal', weight: 400 },

  // Typewriter
  cmtt8: { family: 'monospace', style: 'normal', weight: 400 },
  cmtt9: { family: 'monospace', style: 'normal', weight: 400 },
  cmtt10: { family: 'monospace', style: 'normal', weight: 400 },
  cmtt12: { family: 'monospace', style: 'normal', weight: 400 },
};

/**
 * Resolves a TeX Font Name (e.g. `'cmr10'`) to a CSS Font Specification.
 *
 * @param texName - The name of the font as provided by the DVI `fnt_def` command.
 * @returns The resolved {@link CssFontSpec}.
 */
export function resolveFont(texName: string): CssFontSpec {
  const normalized = texName.toLowerCase();
  const mapped = FONT_MAP[normalized];

  if (mapped) {
    return mapped;
  }

  // Heuristic fallbacks for unknown sizes or variants
  if (normalized.startsWith('cmr')) return { ...FALLBACK, family: BUNDLED_FONT_FAMILY };
  if (normalized.startsWith('cmbx')) return { ...FALLBACK, family: BUNDLED_FONT_FAMILY, weight: 700 };
  if (normalized.startsWith('cmti') || normalized.startsWith('cmmi')) {
    return { ...FALLBACK, family: BUNDLED_FONT_FAMILY, style: 'italic' };
  }
  if (normalized.startsWith('cmsl')) return { ...FALLBACK, family: BUNDLED_FONT_FAMILY, style: 'oblique' };
  if (normalized.startsWith('cmss')) return { ...FALLBACK, family: 'sans-serif' };
  if (normalized.startsWith('cmtt')) return { ...FALLBACK, family: 'monospace' };

  return FALLBACK;
}

/**
 * Generates the SVG `<style>` block to embed a Base64-encoded WOFF2 font.
 *
 * @param base64Woff2 - The raw Base64 data of the font file (e.g., Latin Modern Roman).
 * @returns A string containing the `<style>` tag, or `''` if `base64Woff2` is empty/undefined.
 */
export function createFontStyle(base64Woff2: string | undefined): string {
  if (!base64Woff2) return '';

  return `<style>
@font-face {
  font-family: '${BUNDLED_FONT_FAMILY}';
  src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
  font-weight: normal;
  font-style: normal;
}
@font-face {
  font-family: '${BUNDLED_FONT_FAMILY}';
  src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
  font-weight: bold;
  font-style: normal;
}
@font-face {
  font-family: '${BUNDLED_FONT_FAMILY}';
  src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
  font-weight: normal;
  font-style: italic;
}
</style>`;
}
