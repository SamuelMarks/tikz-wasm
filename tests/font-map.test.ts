/**
 * Unit tests for `src/font-map.ts` ({@link resolveFont}, {@link createFontStyle}, {@link BUNDLED_FONT_FAMILY}).
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { resolveFont, createFontStyle, BUNDLED_FONT_FAMILY } from '../src/font-map.js';

describe('Font Map', () => {
  it('should resolve exact FONT_MAP entries case-insensitively', () => {
    expect(resolveFont('cmr10')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'normal',
      weight: 400,
    });
    expect(resolveFont('CMBX12')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'normal',
      weight: 700,
    });
    expect(resolveFont('cmti10')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'italic',
      weight: 400,
    });
    expect(resolveFont('cmmi10')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'italic',
      weight: 400,
    });
    expect(resolveFont('cmsl10')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'oblique',
      weight: 400,
    });
    expect(resolveFont('cmss10')).toEqual({
      family: 'sans-serif',
      style: 'normal',
      weight: 400,
    });
    expect(resolveFont('cmtt10')).toEqual({
      family: 'monospace',
      style: 'normal',
      weight: 400,
    });
  });

  it('should apply prefix fallbacks for unmapped sizes and variants', () => {
    expect(resolveFont('cmr99')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'normal',
      weight: 400,
    });
    expect(resolveFont('cmbx99')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'normal',
      weight: 700,
    });
    expect(resolveFont('cmti99')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'italic',
      weight: 400,
    });
    expect(resolveFont('cmmi99')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'italic',
      weight: 400,
    });
    expect(resolveFont('cmsl99')).toEqual({
      family: BUNDLED_FONT_FAMILY,
      style: 'oblique',
      weight: 400,
    });
    expect(resolveFont('cmss99')).toEqual({
      family: 'sans-serif',
      style: 'normal',
      weight: 400,
    });
    expect(resolveFont('cmtt99')).toEqual({
      family: 'monospace',
      style: 'normal',
      weight: 400,
    });
  });

  it('should return generic serif fallback for completely unknown font names', () => {
    expect(resolveFont('pagk8r')).toEqual({
      family: 'serif',
      style: 'normal',
      weight: 400,
    });
  });

  it('should generate @font-face style block only when base64Woff2 is non-empty', () => {
    expect(createFontStyle(undefined)).toBe('');
    expect(createFontStyle('')).toBe('');

    const style = createFontStyle('AAAA');
    expect(style).toContain(`font-family: '${BUNDLED_FONT_FAMILY}'`);
    expect(style).toContain('url(data:font/woff2;base64,AAAA)');
  });
});
