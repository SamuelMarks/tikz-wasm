/**
 * Maps TeX internal font names (TFM filenames) to Web CSS equivalents.
 *
 * This system bridges the gap between TeX's strict metric system and the
 * browser's CSS rendering. By mapping standard Computer Modern fonts to
 * a bundled Latin Modern WOFF2, we ensure that the SVG text aligns
 * reasonably well with the coordinates calculated by the DVI engine.
 */

export interface CssFontSpec {
    family: string;
    style: string;
    weight: string | number;
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
 * Mappings for standard 10pt/12pt TeX fonts to CSS properties.
 * We map most Computer Modern variants to our single bundled Latin Modern Roman
 * for simplicity in this minimal distribution.
 */
const FONT_MAP: Record<string, CssFontSpec> = {
    // Roman (Serif)
    'cmr5': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
    'cmr6': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
    'cmr7': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
    'cmr8': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
    'cmr9': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
    'cmr10': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
    'cmr12': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },
    'cmr17': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 400 },

    // Bold
    'cmbx5': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
    'cmbx6': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
    'cmbx7': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
    'cmbx8': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
    'cmbx9': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
    'cmbx10': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },
    'cmbx12': { family: BUNDLED_FONT_FAMILY, style: 'normal', weight: 700 },

    // Italic
    'cmti7': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmti8': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmti9': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmti10': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmti12': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },

    // Text Italic (often mapped to italic)
    'cmmi5': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmmi6': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmmi7': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmmi8': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmmi9': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmmi10': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },
    'cmmi12': { family: BUNDLED_FONT_FAMILY, style: 'italic', weight: 400 },

    // Slanted
    'cmsl8': { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },
    'cmsl9': { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },
    'cmsl10': { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },
    'cmsl12': { family: BUNDLED_FONT_FAMILY, style: 'oblique', weight: 400 },

    // Sans Serif (Fallback to system sans if we don't bundle LM Sans)
    'cmss8': { family: 'sans-serif', style: 'normal', weight: 400 },
    'cmss9': { family: 'sans-serif', style: 'normal', weight: 400 },
    'cmss10': { family: 'sans-serif', style: 'normal', weight: 400 },
    'cmss12': { family: 'sans-serif', style: 'normal', weight: 400 },
    'cmss17': { family: 'sans-serif', style: 'normal', weight: 400 },

    // Typewriter (Fallback to system monospace)
    'cmtt8': { family: 'monospace', style: 'normal', weight: 400 },
    'cmtt9': { family: 'monospace', style: 'normal', weight: 400 },
    'cmtt10': { family: 'monospace', style: 'normal', weight: 400 },
    'cmtt12': { family: 'monospace', style: 'normal', weight: 400 },
};

/**
 * Resolves a TeX Font Name (e.g. 'cmr10') to a CSS Specification.
 * @param texName The name of the font as provided by the DVI fnt_def command.
 */
export function resolveFont(texName: string): CssFontSpec {
    const normalized = texName.toLowerCase();

    if (normalized in FONT_MAP) {
        return FONT_MAP[normalized];
    }

    // Heuristic fallbacks for unknown sizes or variants
    if (normalized.startsWith('cmr')) return { ...FALLBACK, family: BUNDLED_FONT_FAMILY };
    if (normalized.startsWith('cmbx')) return { ...FALLBACK, family: BUNDLED_FONT_FAMILY, weight: 700 };
    if (normalized.startsWith('cmti')) return { ...FALLBACK, family: BUNDLED_FONT_FAMILY, style: 'italic' };
    if (normalized.startsWith('cmss')) return { ...FALLBACK, family: 'sans-serif' };
    if (normalized.startsWith('cmtt')) return { ...FALLBACK, family: 'monospace' };

    return FALLBACK;
}

/**
 * Generates the SVG <style> block to embed the font.
 *
 * @param base64Woff2 The raw base64 data of the font file (e.g., Latin Modern Roman).
 * @returns A string containing the <style> tag.
 */
export function createFontStyle(base64Woff2: string | undefined): string {
    if (!base64Woff2) return '';

    return `
    <style>
      @font-face {
        font-family: '${BUNDLED_FONT_FAMILY}';
        src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
        font-weight: normal;
        font-style: normal;
      }
      /* Mapping Bold manually if using a single file */
      @font-face {
        font-family: '${BUNDLED_FONT_FAMILY}';
        src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
        font-weight: bold;
        font-style: normal;
      }
      /* Mapping Italic manually if using a single file */
      @font-face {
        font-family: '${BUNDLED_FONT_FAMILY}';
        src: url(data:font/woff2;base64,${base64Woff2}) format('woff2');
        font-weight: normal;
        font-style: italic;
      }
    </style>
  `;
}