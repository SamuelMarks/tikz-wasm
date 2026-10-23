/**
 * Hardening and edge-case tests for {@link SvgBuilder} and {@link DviParser}.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { SvgBuilder, escapeXml } from '../src/svg.js';
import { DviParser } from '../src/parser.js';
import { OP } from '../src/opcodes.js';

describe('SvgBuilder: Bounding Box & XML Escaping', () => {
  const sp = (v: number): number => v * 65536;

  it('should escape XML entities in escapeXml and addText', () => {
    expect(escapeXml("<a&\"b'>")).toBe('&lt;a&amp;&quot;b&apos;&gt;');

    const builder = new SvgBuilder('FAKE_WOFF2_BASE64');
    builder.addText(sp(10), sp(20), 'x < y & z > 0', 'cmr10', 10);
    const svg = builder.getSVG();

    expect(svg).toContain('x &lt; y &amp; z &gt; 0');
    expect(svg).toContain('@font-face');
    expect(svg).toContain('FAKE_WOFF2_BASE64');
  });

  it('should fallback to 0..100 bounding box when empty', () => {
    const builder = new SvgBuilder();
    const svg = builder.getSVG();
    expect(svg).toContain('viewBox="-2.00 -2.00 104.00 104.00"');
  });

  it('should auto-calculate viewBox based on rectangles', () => {
    const builder = new SvgBuilder();
    builder.addRect(sp(100), sp(100), sp(50), sp(50));
    const svg = builder.getSVG();
    expect(svg).toMatch(/viewBox="98\.00 48\.00 54\.00 54\.00"/);
  });

  it('should estimate bounds from special path data and handle paths without numbers', () => {
    const builder = new SvgBuilder();
    builder.addSpecialSVG('<path d="M 0 0 L 10 10" />', sp(0), sp(0));
    builder.addSpecialSVG('<path d="Z" />', sp(5), sp(5));
    const svg = builder.getSVG();
    expect(svg).toMatch(/viewBox="-2\.00 -2\.00 14\.00 14\.00"/);
  });

  it('should handle dvisvgm transforms', () => {
    const builder = new SvgBuilder();
    builder.addSpecialSVG('<path d="M 0 0" />', sp(50), sp(50));
    const svg = builder.getSVG();
    expect(svg).toContain('transform="translate(50.000, 50.000)"');
    expect(svg).toMatch(/viewBox="48\.00 48\.00 4\.00 4\.00"/);
  });
});

describe('DviParser: Robustness', () => {
  const enc = new TextEncoder();

  it('should throw on empty input', () => {
    expect(() => new DviParser(new Uint8Array([]))).toThrow('Empty DVI Output');
  });

  it('should correctly strip dvisvgm prefix and ignore unknown specials', () => {
    const str = 'dvisvgm:raw <rect/>';
    const unknown = 'papersize=100pt,100pt';
    const data = new Uint8Array([
      OP.BOP, ...new Array<number>(44).fill(0),
      OP.XXX1, str.length, ...enc.encode(str),
      OP.XXX1, unknown.length, ...enc.encode(unknown),
      OP.POST,
    ]);

    const parser = new DviParser(data);
    const svg = parser.parse();

    expect(svg).toContain('<g transform="translate(0.000, 0.000)"><rect/></g>');
    expect(svg).not.toContain('dvisvgm:raw');
    expect(svg).not.toContain('papersize');
  });

  it('should handle color push/pop for rgb, gray, and unknown/malformed color models', () => {
    const pushRgb = 'color push rgb 1 0 0';
    const pushGray = 'color push gray 0.5';
    const pushCmyk = 'color push cmyk 0 1 1 0';
    const pushMalformedRgb = 'color push rgb foo bar baz';
    const pushMalformedGray = 'color push gray notanumber';
    const pop = 'color pop';

    const data = new Uint8Array([
      OP.BOP, ...new Array<number>(44).fill(0),
      OP.XXX1, pushRgb.length, ...enc.encode(pushRgb),
      OP.XXX1, pop.length, ...enc.encode(pop),
      OP.XXX1, pushGray.length, ...enc.encode(pushGray),
      OP.XXX1, pop.length, ...enc.encode(pop),
      OP.XXX1, pushCmyk.length, ...enc.encode(pushCmyk),
      OP.XXX1, pop.length, ...enc.encode(pop),
      OP.XXX1, pushMalformedRgb.length, ...enc.encode(pushMalformedRgb),
      OP.XXX1, pop.length, ...enc.encode(pop),
      OP.XXX1, pushMalformedGray.length, ...enc.encode(pushMalformedGray),
      OP.XXX1, pop.length, ...enc.encode(pop),
      OP.POST,
    ]);

    const parser = new DviParser(data);
    const svg = parser.parse();

    expect(svg).toContain('fill="rgb(255,0,0)"');
    expect(svg).toContain('fill="rgb(128,128,128)"');
    expect(svg).toContain('fill="black"');
    expect(svg).toContain('</g>');
  });
});
