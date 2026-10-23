/**
 * Unit tests for {@link DviParser}.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { DviParser } from '../src/parser.js';
import { OP } from '../src/opcodes.js';

describe('DviParser', () => {
  const enc = new TextEncoder();

  it('should parse basic rectangles (SET_RULE and PUT_RULE) and ignore non-positive dimensions', () => {
    const data = new Uint8Array([
      OP.PRE, 2, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 3, 65, 66, 67,
      OP.BOP, ...new Array<number>(44).fill(0),

      // SET_RULE with height 10pt (0x000A0000), width 10pt (0x000A0000) -> advances H by 10pt
      OP.SET_RULE, 0, 10, 0, 0, 0, 10, 0, 0,

      // PUT_RULE at H=10pt with height 5pt, width 5pt -> does not advance H
      OP.PUT_RULE, 0, 5, 0, 0, 0, 5, 0, 0,

      // Zero-height rule should not emit <rect>
      OP.PUT_RULE, 0, 0, 0, 0, 0, 5, 0, 0,

      OP.EOP,
      OP.POST,
    ]);

    const parser = new DviParser(data);
    const svg = parser.parse();
    expect(svg).toContain('<rect x="0.000" y="-10.000" width="10.000" height="10.000"');
    expect(svg).toContain('<rect x="10.000" y="-5.000" width="5.000" height="5.000"');
  });

  it('should handle TikZ Specials (dvisvgm:raw) across XXX1..XXX4', () => {
    const specialStr = "dvisvgm:raw <path d='M0 0 L10 10' />";
    const encoded = enc.encode(specialStr);
    const len = encoded.length;

    const data = new Uint8Array([
      OP.XXX1, len, ...encoded,
      OP.XXX2, 0, len, ...encoded,
      OP.XXX3, 0, 0, len, ...encoded,
      OP.XXX4, 0, 0, 0, len, ...encoded,
      OP.POST_POST,
    ]);

    const parser = new DviParser(data);
    const svg = parser.parse();
    expect(svg).toContain("<path d='M0 0 L10 10' />");
  });

  it('should save and restore coordinates using State Stack (PUSH/POP)', () => {
    // 1. Move right by 10pt (655360 = 0x0A0000 via RIGHT3)
    // 2. PUSH state (h=10pt, v=0pt)
    // 3. Move right by 20pt (0x140000 via RIGHT3) and down by 15pt (0x0F0000 via DOWN3)
    // 4. PUT_RULE at (30pt, 15pt)
    // 5. POP state -> restores (h=10pt, v=0pt)
    // 6. PUT_RULE at (10pt, 0pt)
    const data = new Uint8Array([
      OP.RIGHT3, 0x0a, 0x00, 0x00,
      OP.PUSH,
      OP.RIGHT3, 0x14, 0x00, 0x00,
      OP.DOWN3, 0x0f, 0x00, 0x00,
      OP.PUT_RULE, 0, 2, 0, 0, 0, 2, 0, 0,
      OP.POP,
      OP.PUT_RULE, 0, 4, 0, 0, 0, 4, 0, 0,
      OP.POST,
    ]);

    const parser = new DviParser(data);
    const svg = parser.parse();

    // First rule at (30, 15) with height 2 -> y = 13
    expect(svg).toContain('<rect x="30.000" y="13.000" width="2.000" height="2.000"');
    // Second rule after POP must be at restored (10, 0) with height 4 -> y = -4
    expect(svg).toContain('<rect x="10.000" y="-4.000" width="4.000" height="4.000"');
  });

  it('should accurately update coordinates for all variable-length movement opcodes (RIGHT, DOWN, W, X, Y, Z)', () => {
    const data = new Uint8Array([
      // RIGHT1(64), RIGHT2(256), RIGHT4(65536) -> total H = 65856 sp
      OP.RIGHT1, 64,
      OP.RIGHT2, 0x01, 0x00,
      OP.RIGHT4, 0x00, 0x01, 0x00, 0x00,

      // W1(100), W0(+100), W2(200), W3(300), W4(400) -> +1100 sp
      OP.W1, 100,
      OP.W0,
      OP.W2, 0x00, 200,
      OP.W3, 0x00, 0x01, 0x2c,
      OP.W4, 0x00, 0x00, 0x01, 0x90,

      // X1(50), X0(+50), X2(150), X3(250), X4(350) -> +850 sp
      OP.X1, 50,
      OP.X0,
      OP.X2, 0x00, 150,
      OP.X3, 0x00, 0x00, 250,
      OP.X4, 0x00, 0x00, 0x01, 0x5e,

      // DOWN1(32), DOWN2(128), DOWN4(65536) -> 65696 sp
      OP.DOWN1, 32,
      OP.DOWN2, 0x00, 128,
      OP.DOWN4, 0x00, 0x01, 0x00, 0x00,

      // Y1(10), Y0(+10), Y2(20), Y3(30), Y4(40) -> +110 sp
      OP.Y1, 10,
      OP.Y0,
      OP.Y2, 0x00, 20,
      OP.Y3, 0x00, 0x00, 30,
      OP.Y4, 0x00, 0x00, 0x00, 40,

      // Z1(5), Z0(+5), Z2(15), Z3(25), Z4(35) -> +85 sp
      OP.Z1, 5,
      OP.Z0,
      OP.Z2, 0x00, 15,
      OP.Z3, 0x00, 0x00, 25,
      OP.Z4, 0x00, 0x00, 0x00, 35,

      OP.NOP,
      OP.PUT_RULE, 0, 1, 0, 0, 0, 1, 0, 0,
    ]);

    // Total H = 65856 + 1100 + 850 = 67806 sp = 1.03463745 pt -> "1.035"
    // Total V = 65696 + 110 + 85 = 65891 sp = 1.00541687 pt; height = 1pt -> y = "0.005"
    const parser = new DviParser(data);
    const svg = parser.parse();
    expect(svg).toContain('<rect x="1.035" y="0.005" width="1.000" height="1.000"');
  });

  it('should parse FNT_DEF1..4, FNT_NUM_0..63, FNT1..4, and SET/PUT character opcodes', () => {
    const cmbx12Bytes = enc.encode('cmbx12');
    const cmr10Bytes = enc.encode('cmr10');
    const areaBytes = enc.encode('local/');

    const data = new Uint8Array([
      // Define font 1: cmbx12 with scale = 12pt (12 * 65536 = 0x000C0000) and area 'local/'
      OP.FNT_DEF1, 1,
      0, 0, 0, 0, // checksum
      0x00, 0x0c, 0x00, 0x00, // scale (12pt)
      0x00, 0x0c, 0x00, 0x00, // designSize
      areaBytes.length, cmbx12Bytes.length,
      ...areaBytes, ...cmbx12Bytes,

      // Define font 2 via FNT_DEF2 with scale = 0 (fallback size 10 and default charWidth)
      OP.FNT_DEF2, 0, 2,
      0, 0, 0, 0,
      0, 0, 0, 0, // scale 0
      0, 0, 0, 0,
      0, cmr10Bytes.length,
      ...cmr10Bytes,

      // Define font 3 via FNT_DEF3 and font 4 via FNT_DEF4
      OP.FNT_DEF3, 0, 0, 3,
      0, 0, 0, 0, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x00,
      0, cmr10Bytes.length, ...cmr10Bytes,

      OP.FNT_DEF4, 0, 0, 0, 4,
      0, 0, 0, 0, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x00,
      0, cmr10Bytes.length, ...cmr10Bytes,

      // Typeset 'A' (65) before any font is selected (fontId=0, undefined in fonts map -> fallback cmr10)
      65,

      // Select font 1 via FNT_NUM_0 + 1
      OP.FNT_NUM_0 + 1,
      66, // 'B'

      // Select font 2 via FNT1, font 3 via FNT2, font 4 via FNT3, font 1 via FNT4
      OP.FNT1, 2,
      OP.SET1, 67, // 'C'
      OP.FNT2, 0, 3,
      OP.SET2, 0, 68, // 'D'
      OP.FNT3, 0, 0, 4,
      OP.SET3, 0, 0, 69, // 'E'
      OP.FNT4, 0, 0, 0, 1,
      OP.SET4, 0, 0, 0, 70, // 'F'

      // PUT1..PUT4 (do not advance h)
      OP.PUT1, 71,
      OP.PUT2, 0, 72,
      OP.PUT3, 0, 0, 73,
      OP.PUT4, 0, 0, 0, 74,

      OP.POST,
    ]);

    const parser = new DviParser(data);
    const svg = parser.parse();
    expect(svg).toContain('font-family="cmr10" font-size="10">A</text>');
    expect(svg).toContain('font-family="TikZ-LatinModern" font-size="12" font-style="normal" font-weight="700">B</text>');
    expect(svg).toContain('>C</text>');
    expect(svg).toContain('>J</text>');
  });
});
