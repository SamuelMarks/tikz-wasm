/**
 * SVG document builder converting DVI coordinates (scaled points) and `dvisvgm` specials
 * into standalone, bounding-box-fitted SVG markup.
 *
 * @packageDocumentation
 */

import { createFontStyle, type CssFontSpec } from './font-map.js';

/**
 * Escapes special XML characters (`&`, `<`, `>`, `"`, `'`) in text nodes and attribute values.
 *
 * @param text - Raw unescaped string.
 * @returns XML-safe escaped string.
 */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Converts DVI operations and `dvisvgm` specials into an SVG document string.
 * Manages coordinate transformations (`sp` to `pt`) and bounding box calculation.
 */
export class SvgBuilder {
  /**
   * Accumulated SVG element markup strings.
   */
  private readonly buffer: string[] = [];

  /**
   * Optional Base64-encoded WOFF2 font to embed in the SVG `<style>` block.
   */
  private readonly fontBase64Woff2: string | undefined;

  /**
   * Minimum X coordinate in PostScript points (`pt`).
   */
  private minX: number = Infinity;

  /**
   * Minimum Y coordinate in PostScript points (`pt`).
   */
  private minY: number = Infinity;

  /**
   * Maximum X coordinate in PostScript points (`pt`).
   */
  private maxX: number = -Infinity;

  /**
   * Maximum Y coordinate in PostScript points (`pt`).
   */
  private maxY: number = -Infinity;

  /**
   * Creates a new {@link SvgBuilder}.
   *
   * @param fontBase64Woff2 - Optional Base64-encoded WOFF2 font data to embed.
   */
  constructor(fontBase64Woff2?: string) {
    this.fontBase64Woff2 = fontBase64Woff2;
  }

  /**
   * Converts Scaled Points (`sp`) to PostScript Points (`pt`).
   * `1 pt = 65536 sp`.
   *
   * @param sp - Coordinate or dimension in scaled points.
   * @returns Value in PostScript points.
   */
  private fixedToFloat(sp: number): number {
    return sp / 65536.0;
  }

  /**
   * Expands the bounding box to include the point `(x, y)` in points.
   *
   * @param x - Horizontal coordinate in points.
   * @param y - Vertical coordinate in points.
   */
  private updateBounds(x: number, y: number): void {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }

  /**
   * Adds a `<text>` element at the specified DVI coordinates.
   *
   * @param xSp - Horizontal coordinate in scaled points (`sp`).
   * @param ySp - Vertical baseline coordinate in scaled points (`sp`).
   * @param text - Text content to render.
   * @param fontFamilyOrSpec - Font family name or resolved {@link CssFontSpec}.
   * @param fontSize - Font size in points (`pt`).
   */
  addText(
    xSp: number,
    ySp: number,
    text: string,
    fontFamilyOrSpec: string | CssFontSpec,
    fontSize: number
  ): void {
    const x = this.fixedToFloat(xSp);
    const y = this.fixedToFloat(ySp);

    // Rudimentary bounds approximation for text (0.5em width per character)
    this.updateBounds(x, y);
    this.updateBounds(x + text.length * fontSize * 0.5, y - fontSize);

    const escaped = escapeXml(text);
    if (typeof fontFamilyOrSpec === 'string') {
      this.buffer.push(
        `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-family="${escapeXml(fontFamilyOrSpec)}" font-size="${fontSize}">${escaped}</text>`
      );
    } else {
      const styleAttrs =
        fontFamilyOrSpec.style !== 'normal' || fontFamilyOrSpec.weight !== 400
          ? ` font-style="${fontFamilyOrSpec.style}" font-weight="${fontFamilyOrSpec.weight}"`
          : '';
      this.buffer.push(
        `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-family="${escapeXml(fontFamilyOrSpec.family)}" font-size="${fontSize}"${styleAttrs}>${escaped}</text>`
      );
    }
  }

  /**
   * Adds a solid black `<rect>` corresponding to a DVI `SET_RULE` or `PUT_RULE` operation.
   * In DVI coordinates, a rule sits on baseline `(h, v)` and extends upward by `hSp` and right by `wSp`.
   *
   * @param xSp - Left coordinate in scaled points (`sp`).
   * @param ySp - Bottom baseline coordinate in scaled points (`sp`).
   * @param wSp - Rule width in scaled points (`sp`).
   * @param hSp - Rule height in scaled points (`sp`).
   */
  addRect(xSp: number, ySp: number, wSp: number, hSp: number): void {
    const x = this.fixedToFloat(xSp);
    const y = this.fixedToFloat(ySp);
    const w = this.fixedToFloat(wSp);
    const h = this.fixedToFloat(hSp);

    const svgY = y - h;

    this.updateBounds(x, svgY);
    this.updateBounds(x + w, svgY + h);

    this.buffer.push(
      `<rect x="${x.toFixed(3)}" y="${svgY.toFixed(3)}" width="${w.toFixed(3)}" height="${h.toFixed(3)}" fill="black"/>`
    );
  }

  /**
   * Injects a raw SVG fragment emitted by `dvisvgm:raw` or color specials,
   * wrapped in a `<g transform="translate(tx, ty)">` group positioned at the DVI cursor.
   *
   * @param svgFragment - Raw SVG markup fragment.
   * @param xSp - Horizontal DVI cursor position in scaled points (`sp`).
   * @param ySp - Vertical DVI cursor position in scaled points (`sp`).
   */
  addSpecialSVG(svgFragment: string, xSp: number, ySp: number): void {
    const tx = this.fixedToFloat(xSp);
    const ty = this.fixedToFloat(ySp);

    const pathMatch = svgFragment.match(/d="([^"]+)"/g);
    if (pathMatch) {
      let updatedFromPath = false;
      for (const dAttr of pathMatch) {
        const numbers = dAttr.match(/[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g);
        if (numbers) {
          for (const numStr of numbers) {
            const val = parseFloat(numStr);
            this.updateBounds(tx + val, ty + val);
            updatedFromPath = true;
          }
        }
      }
      if (!updatedFromPath) {
        this.updateBounds(tx, ty);
      }
    } else {
      this.updateBounds(tx, ty);
    }

    this.buffer.push(
      `<g transform="translate(${tx.toFixed(3)}, ${ty.toFixed(3)})">${svgFragment}</g>`
    );
  }

  /**
   * Assembles the final standalone `<svg>` document string with a padded `viewBox`.
   *
   * @returns Complete SVG document string.
   */
  getSVG(): string {
    const padding = 2; // pt

    if (this.minX === Infinity) {
      this.minX = 0;
      this.minY = 0;
      this.maxX = 100;
      this.maxY = 100;
    }

    const w = this.maxX - this.minX + padding * 2;
    const h = this.maxY - this.minY + padding * 2;
    const viewBoxX = this.minX - padding;
    const viewBoxY = this.minY - padding;

    const vb = `${viewBoxX.toFixed(2)} ${viewBoxY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;
    const styleBlock = createFontStyle(this.fontBase64Woff2);
    const nl = String.fromCharCode(10);
    const joined = this.buffer.join(nl);
    const body = styleBlock ? `${styleBlock}${nl}${joined}` : joined;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}pt" height="${h}pt">${nl}${body}${nl}</svg>`;
  }
}
