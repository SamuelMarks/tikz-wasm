import { describe, it, expect, vi } from 'vitest';
import { SvgBuilder } from '../src/svg';
import { DviParser } from '../src/parser';
import { OP } from '../src/opcodes';

describe('SvgBuilder: Bounding Box', () => {
  it('should auto-calculate viewBox based on rectangles', () => {
    const builder = new SvgBuilder();
    // Rect at DVI coord (100pt, 100pt) with dim (50pt, 50pt)
    // SP = val * 65536
    const sp = (v: number) => v * 65536;
    
    builder.addRect(sp(100), sp(100), sp(50), sp(50));
    
    // DVI Rule: sits at (100, 100). Height 50 goes UP. 
    // SVG Y = 100 - 50 = 50.
    // SVG Rect: x=100, y=50, w=50, h=50.
    // Bounds: X[100, 150], Y[50, 100].
    
    const svg = builder.getSVG();
    
    // Expect viewBox "98.00 48.00 54.00 54.00" (Padding 2)
    expect(svg).toMatch(/viewBox="98\.00 48\.00 54\.00 54\.00"/);
  });

  it('should estimate bounds from special path data', () => {
    const builder = new SvgBuilder();
    const sp = (v: number) => v * 65536;
    
    // Anchor at 0,0. Path draws line to 10,10.
    const path = '<path d="M 0 0 L 10 10" />';
    builder.addSpecialSVG(path, sp(0), sp(0));
    
    const svg = builder.getSVG();
    
    // Bounds should include 0,0 and 10,10.
    // Padded viewBox: -2 -2 14 14
    expect(svg).toMatch(/viewBox="-2\.00 -2\.00 14\.00 14\.00"/);
  });

  it('should handle dvisvgm transforms', () => {
    const builder = new SvgBuilder();
    const sp = (v: number) => v * 65536;
    
    // DVI position at (50, 50)
    builder.addSpecialSVG('<path d="M 0 0" />', sp(50), sp(50));
    const svg = builder.getSVG();
    
    // Should verify transform group exists
    expect(svg).toContain('transform="translate(50.000, 50.000)"');
    // Bounds should start around 50
    expect(svg).toMatch(/viewBox="48\.00 48\.00 4\.00 4\.00"/);
  });
});

describe('DviParser: Robustness', () => {
  const enc = new TextEncoder();
  
  it('should throw on empty input', () => {
    expect(() => new DviParser(new Uint8Array([]))).toThrow();
  });

  it('should correctly strip dvisvgm prefix', () => {
    // Construct DVI: BOP, XXX1 (len), "dvisvgm:raw <rect/>", POST
    const str = "dvisvgm:raw <rect/>";
    const data = new Uint8Array([
      OP.BOP, ...new Array(44).fill(0),
      OP.XXX1, str.length, ...enc.encode(str),
      OP.POST
    ]);
    
    const parser = new DviParser(data);
    const svg = parser.parse();
    
    expect(svg).toContain('<g transform="translate(0.000, 0.000)"><rect/></g>');
    expect(svg).not.toContain('dvisvgm:raw');
  });

  it('should handle color push/pop', () => {
    const push = "color push rgb 1 0 0";
    const pop = "color pop";
    
    const data = new Uint8Array([
      OP.BOP, ...new Array(44).fill(0),
      OP.XXX1, push.length, ...enc.encode(push),
      OP.XXX1, pop.length, ...enc.encode(pop),
      OP.POST
    ]);

    const parser = new DviParser(data);
    const svg = parser.parse();
    
    expect(svg).toContain('fill="rgb(255,0,0)"');
    expect(svg).toContain('</g>');
  });

  it('should parse grayscale color', () => {
    // Manually testing the parseColor logic via private access flow
    const push = "color push gray 0.5";
    const data = new Uint8Array([
      OP.BOP, ...new Array(44).fill(0),
      OP.XXX1, push.length, ...enc.encode(push),
      OP.POST
    ]);
    const parser = new DviParser(data);
    const svg = parser.parse();
    expect(svg).toContain('fill="rgb(128,128,128)"');
  });
});