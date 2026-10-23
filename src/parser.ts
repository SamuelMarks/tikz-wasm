/**
 * DeVice Independent (DVI) bytecode interpreter and `dvisvgm` special processor.
 *
 * @packageDocumentation
 */

import { BinaryReader } from './reader.js';
import { OP } from './opcodes.js';
import { Machine } from './machine.js';
import { SvgBuilder } from './svg.js';
import { TikzCompilationError } from './errors.js';
import { resolveFont } from './font-map.js';
import type { DviFont } from './types.js';

/**
 * Parses a binary DVI buffer into a standalone SVG string.
 */
export class DviParser {
  /**
   * Sequential big-endian binary reader over the DVI stream.
   */
  private readonly reader: BinaryReader;

  /**
   * DVI virtual register machine and stack.
   */
  private readonly machine: Machine;

  /**
   * SVG document builder accumulating output graphics.
   */
  private readonly builder: SvgBuilder;

  /**
   * Table of fonts defined via `FNT_DEF1..FNT_DEF4` opcodes, keyed by font ID.
   */
  private readonly fonts: Map<number, DviFont> = new Map();

  /**
   * Creates a new {@link DviParser} for the given binary DVI stream.
   *
   * @param data - Non-empty `Uint8Array` containing a DVI stream.
   * @param fontBase64Woff2 - Optional Base64 WOFF2 font to embed in the generated SVG.
   * @throws {@link TikzCompilationError} if `data` is empty.
   */
  constructor(data: Uint8Array, fontBase64Woff2?: string) {
    if (data.length === 0) {
      throw new TikzCompilationError('Empty DVI Output', ['Parser received 0 bytes']);
    }
    this.reader = new BinaryReader(data);
    this.machine = new Machine();
    this.builder = new SvgBuilder(fontBase64Woff2);
  }

  /**
   * Executes the DVI bytecode loop until `POST` or end-of-stream and returns the built SVG.
   *
   * @returns Standalone SVG string representation of the DVI document.
   */
  parse(): string {
    const r = this.reader;
    const m = this.machine;

    while (!r.finished) {
      const cmd = r.readByte();

      // 1. Fast-path ASCII characters (SET_CHAR_0 .. SET_CHAR_127)
      if (cmd <= OP.SET_CHAR_127) {
        this.renderCharacter(cmd, true);
        continue;
      }

      // 2. Fast-path Font Selection (FNT_NUM_0 .. FNT_NUM_63)
      if (cmd >= OP.FNT_NUM_0 && cmd <= OP.FNT_NUM_63) {
        m.state.fontId = cmd - OP.FNT_NUM_0;
        continue;
      }

      switch (cmd) {
        // --- Extended Character Typesetting ---
        case OP.SET1:
        case OP.SET2:
        case OP.SET3:
        case OP.SET4: {
          const len = cmd - OP.SET1 + 1;
          const charCode = len === 4 ? r.readInt(4) : r.readUInt(len);
          this.renderCharacter(charCode, true);
          break;
        }

        case OP.PUT1:
        case OP.PUT2:
        case OP.PUT3:
        case OP.PUT4: {
          const len = cmd - OP.PUT1 + 1;
          const charCode = len === 4 ? r.readInt(4) : r.readUInt(len);
          this.renderCharacter(charCode, false);
          break;
        }

        // --- Preamble / Postamble / Page Boundaries ---
        case OP.PRE: {
          r.readByte(); // version i
          r.readUInt32(); // num
          r.readUInt32(); // den
          r.readUInt32(); // mag
          const commentLen = r.readByte();
          r.skip(commentLen);
          break;
        }

        case OP.POST:
        case OP.POST_POST:
          return this.builder.getSVG();

        case OP.BOP:
          r.skip(4 * 10); // c0..c9 counters
          r.skip(4); // prev BOP pointer
          break;

        case OP.EOP:
          m.reset();
          break;

        // --- Stack Operations ---
        case OP.PUSH:
          m.push();
          break;
        case OP.POP:
          m.pop();
          break;

        // --- Horizontal Movement ---
        case OP.RIGHT1:
        case OP.RIGHT2:
        case OP.RIGHT3:
        case OP.RIGHT4: {
          const deltaR = r.readInt(cmd - OP.RIGHT1 + 1);
          m.state.h += deltaR;
          break;
        }

        case OP.W0:
          m.state.h += m.state.w;
          break;
        case OP.W1:
        case OP.W2:
        case OP.W3:
        case OP.W4:
          m.state.w = r.readInt(cmd - OP.W1 + 1);
          m.state.h += m.state.w;
          break;

        case OP.X0:
          m.state.h += m.state.x;
          break;
        case OP.X1:
        case OP.X2:
        case OP.X3:
        case OP.X4:
          m.state.x = r.readInt(cmd - OP.X1 + 1);
          m.state.h += m.state.x;
          break;

        // --- Vertical Movement ---
        case OP.DOWN1:
        case OP.DOWN2:
        case OP.DOWN3:
        case OP.DOWN4: {
          const deltaD = r.readInt(cmd - OP.DOWN1 + 1);
          m.state.v += deltaD;
          break;
        }

        case OP.Y0:
          m.state.v += m.state.y;
          break;
        case OP.Y1:
        case OP.Y2:
        case OP.Y3:
        case OP.Y4:
          m.state.y = r.readInt(cmd - OP.Y1 + 1);
          m.state.v += m.state.y;
          break;

        case OP.Z0:
          m.state.v += m.state.z;
          break;
        case OP.Z1:
        case OP.Z2:
        case OP.Z3:
        case OP.Z4:
          m.state.z = r.readInt(cmd - OP.Z1 + 1);
          m.state.v += m.state.z;
          break;

        // --- Drawing Rules ---
        case OP.PUT_RULE:
        case OP.SET_RULE: {
          const a = r.readInt(4); // height
          const b = r.readInt(4); // width
          if (a > 0 && b > 0) {
            this.builder.addRect(m.state.h, m.state.v, b, a);
          }
          if (cmd === OP.SET_RULE) {
            m.state.h += b;
          }
          break;
        }

        // --- Extended Font Selection ---
        case OP.FNT1:
        case OP.FNT2:
        case OP.FNT3:
        case OP.FNT4: {
          const len = cmd - OP.FNT1 + 1;
          m.state.fontId = len === 4 ? r.readInt(4) : r.readUInt(len);
          break;
        }

        // --- Specials ---
        case OP.XXX1:
        case OP.XXX2:
        case OP.XXX3:
        case OP.XXX4: {
          const kLen = r.readUInt(cmd - OP.XXX1 + 1);
          this.handleSpecial(r.readString(kLen));
          break;
        }

        // --- Font Definitions ---
        case OP.FNT_DEF1:
        case OP.FNT_DEF2:
        case OP.FNT_DEF3:
        case OP.FNT_DEF4: {
          const idLen = cmd - OP.FNT_DEF1 + 1;
          const fontId = idLen === 4 ? r.readInt(4) : r.readUInt(idLen);
          const checksum = r.readUInt32();
          const scale = r.readUInt32();
          const designSize = r.readUInt32();
          const areaLen = r.readByte();
          const nameLen = r.readByte();
          if (areaLen > 0) {
            r.skip(areaLen);
          }
          const name = r.readString(nameLen);
          this.fonts.set(fontId, { checksum, scale, designSize, area: areaLen, name });
          break;
        }

        case OP.NOP:
        default:
          break;
      }
    }
    return this.builder.getSVG();
  }

  /**
   * Renders a character glyph into the SVG builder and optionally advances horizontal coordinate `h`.
   *
   * @param charCode - Unicode/ASCII character code to typeset.
   * @param advance - Whether to advance `machine.state.h` by the character's width (`SET` vs `PUT`).
   */
  private renderCharacter(charCode: number, advance: boolean): void {
    const m = this.machine;
    const width = this.getCharWidth(charCode, m.state.fontId);
    const fontDef = this.fonts.get(m.state.fontId);

    if (fontDef) {
      const spec = resolveFont(fontDef.name);
      const fontSizePt = Math.round((fontDef.scale / 65536.0) * 100) / 100 || 10;
      this.builder.addText(m.state.h, m.state.v, String.fromCharCode(charCode), spec, fontSizePt);
    } else {
      this.builder.addText(m.state.h, m.state.v, String.fromCharCode(charCode), 'cmr10', 10);
    }

    if (advance) {
      m.state.h += width;
    }
  }

  /**
   * Processes a DVI `\special` string (`dvisvgm:raw`, `color push`, `color pop`).
   *
   * @param special - Raw special string read from `XXX1..XXX4`.
   */
  private handleSpecial(special: string): void {
    const DVISVGM_PREFIX = 'dvisvgm:raw ';

    if (special.startsWith(DVISVGM_PREFIX)) {
      const svgContent = special.substring(DVISVGM_PREFIX.length);
      this.builder.addSpecialSVG(svgContent, this.machine.state.h, this.machine.state.v);
    } else if (special.startsWith('color push')) {
      const color = this.parseColor(special);
      this.builder.addSpecialSVG(
        `<g fill="${color}" stroke="${color}">`,
        this.machine.state.h,
        this.machine.state.v
      );
    } else if (special.startsWith('color pop')) {
      this.builder.addSpecialSVG('</g>', this.machine.state.h, this.machine.state.v);
    }
  }

  /**
   * Parses a TeX color special (`color push rgb r g b` or `color push gray g`) into a CSS color string.
   *
   * @param special - Color special string.
   * @returns CSS `rgb(...)` string or `'black'` fallback.
   */
  private parseColor(special: string): string {
    const parts = special.trim().split(/\s+/);
    const model = parts[2];

    if (model === 'rgb' && parts.length >= 6) {
      const r = Math.round(Number(parts[3]) * 255);
      const g = Math.round(Number(parts[4]) * 255);
      const b = Math.round(Number(parts[5]) * 255);
      if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) {
        return `rgb(${r},${g},${b})`;
      }
    }
    if (model === 'gray' && parts.length >= 4) {
      const g = Math.round(Number(parts[3]) * 255);
      if (!Number.isNaN(g)) {
        return `rgb(${g},${g},${g})`;
      }
    }
    return 'black';
  }

  /**
   * Estimates the width of a character in scaled points (`sp`) for the given font.
   *
   * @param _charCode - Character code being typeset.
   * @param fontId - Active DVI font identifier.
   * @returns Estimated character advance width in scaled points (`sp`).
   */
  private getCharWidth(_charCode: number, fontId: number): number {
    const font = this.fonts.get(fontId);
    if (font && font.scale > 0) {
      return Math.round(font.scale * 0.5);
    }
    // Default ~4.58pt (300000 sp) for 10pt Computer Modern Roman
    return 300000;
  }
}
