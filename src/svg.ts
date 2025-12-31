/**
 * Converts DVI logic to SVG strings.
 * Manages the SVG definitions, coordinate transformations (SP to PT), 
 * and bounding box calculations to generate a clean "standalone" SVG.
 */
export class SvgBuilder {
  private buffer: string[] = [];
  
  // Bounding Box (in Points)
  private minX: number = Infinity;
  private minY: number = Infinity;
  private maxX: number = -Infinity;
  private maxY: number = -Infinity;

  /**
   * Converts Scaled Points (SP) to PostScript Points (PT).
   * 1 pt = 65536 sp
   */
  private fixedToFloat(sp: number): number {
    return sp / 65536.0;
  }

  private updateBounds(x: number, y: number) {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }

  /**
   * Adds a basic text element (fallback for standard DVI text).
   * Note: In TikZ DVI paths, text is often embedded in specials or 
   * requires font mapping which is minimal here.
   */
  addText(xSp: number, ySp: number, text: string, fontFamily: string, fontSize: number) {
    const x = this.fixedToFloat(xSp);
    const y = this.fixedToFloat(ySp);
    
    // Rudimentary bounds approximation for text (assuming 0.5em width per char approx)
    this.updateBounds(x, y);
    this.updateBounds(x + (text.length * fontSize * 0.5), y - fontSize);

    this.buffer.push(
      `<text x="${x.toFixed(3)}" y="${y.toFixed(3)}" font-family="${fontFamily}" font-size="${fontSize}">${text}</text>`
    );
  }

  /**
   * Adds a rectangle (DVI Rule).
   * DVI Coordinates: Origin is top-left (usually). Y increases DOWN.
   * However, `set_rule` puts a rule at (H,V) extending UP by `height` and RIGHT by `width`.
   * So SVG Y = V_dvi - height_rule.
   */
  addRect(xSp: number, ySp: number, wSp: number, hSp: number) {
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
   * Injects raw SVG fragment from specials (e.g., dvisvgm output).
   * Wraps the content in a <g transform="..."> to place it correctly 
   * relative to the DVI cursor position.
   * 
   * Also attempts to parse basic path numbers to update the bounding box.
   */
  addSpecialSVG(svgFragment: string, xSp: number, ySp: number) {
    const tx = this.fixedToFloat(xSp);
    const ty = this.fixedToFloat(ySp);

    // Heuristically extract numbers from key attributes (d, x, y) to update bounds
    // This isn't a perfect SVG parser (too heavy), but 'Good Enough' for auto-fit viewBox.
    // We search for numbers inside d="..." attributes.
    const pathMatch = svgFragment.match(/d="([^"]+)"/g);
    if (pathMatch) {
      for (const dAttr of pathMatch) {
        // Extract all float-like numbers
        const numbers = dAttr.match(/[+-]?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
        if (numbers) {
          for (const numStr of numbers) {
            const val = parseFloat(numStr);
            if (!isNaN(val)) {
              // Since paths are typically relative to the group transform:
              // We blindly checking X vs Y is impossible without a parser state machine.
              // Strategy: Assume *every* number could be an X or a Y coordinate 
              // and expand bounds conservatively.
              // This might Expand bounds more than needed (e.g. rotation degrees), 
              // but ensures nothing is clipped.
              this.updateBounds(tx + val, ty + val); 
            }
          }
        }
      }
    } else {
      // If no paths, just register the anchor point
      this.updateBounds(tx, ty);
    }

    this.buffer.push(
      `<g transform="translate(${tx.toFixed(3)}, ${ty.toFixed(3)})">${svgFragment}</g>`
    );
  }

  getSVG(): string {
    const padding = 2; // pt
    
    // Fallback if empty
    if (this.minX === Infinity) {
      this.minX = 0; this.minY = 0; this.maxX = 100; this.maxY = 100;
    }

    const w = this.maxX - this.minX + (padding * 2);
    const h = this.maxY - this.minY + (padding * 2);
    const viewBoxX = this.minX - padding;
    const viewBoxY = this.minY - padding;

    // We use a fixed precision for clean output
    const vb = `${viewBoxX.toFixed(2)} ${viewBoxY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${w}pt" height="${h}pt">\n${this.buffer.join('\n')}\n</svg>`;
  }
}