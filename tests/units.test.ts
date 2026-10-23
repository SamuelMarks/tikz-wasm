/**
 * Unit tests for {@link BinaryReader}, {@link Machine}, {@link TikzCompilationError},
 * {@link TikzInitializationError}, {@link wrapInDocument}, and {@link getParentDirectories}.
 *
 * @packageDocumentation
 */

import { describe, it, expect } from 'vitest';
import { BinaryReader } from '../src/reader.js';
import { Machine } from '../src/machine.js';
import { TikzCompilationError, TikzInitializationError } from '../src/errors.js';
import { wrapInDocument } from '../src/template.js';
import { getParentDirectories } from '../src/path-utils.js';

describe('BinaryReader', () => {
  it('should read signed and unsigned integers of lengths 0..4', () => {
    const bytes = new Uint8Array([
      0x7f, // readByte -> 127
      0xff, // readSByte -> -1
      0x01, 0x02, // readUInt16 -> 258
      0x00, 0x00, 0x01, 0x00, // readUInt32 -> 256
      0xff, 0xfe, // readInt(2) -> -2
      0xff, 0xff, 0xfd, // readInt(3) -> -3 (negative 24-bit sign extension)
      0x00, 0x00, 0x05, // readInt(3) -> +5 (positive 24-bit)
      0xff, 0xff, 0xff, 0xfc, // readInt(4) -> -4
      0x0a, // readUInt(1) -> 10
      0x00, 0x0b, // readUInt(2) -> 11
      0x00, 0x00, 0x0c, // readUInt(3) -> 12
      0x00, 0x00, 0x00, 0x0d, // readUInt(4) -> 13
    ]);

    const reader = new BinaryReader(bytes);
    expect(reader.finished).toBe(false);
    expect(reader.readInt(0)).toBe(0);
    expect(reader.readByte()).toBe(127);
    expect(reader.readSByte()).toBe(-1);
    expect(reader.readUInt16()).toBe(258);
    expect(reader.readUInt32()).toBe(256);
    expect(reader.readInt(2)).toBe(-2);
    expect(reader.readInt(3)).toBe(-3);
    expect(reader.readInt(3)).toBe(5);
    expect(reader.readInt(4)).toBe(-4);
    expect(reader.readUInt(1)).toBe(10);
    expect(reader.readUInt(2)).toBe(11);
    expect(reader.readUInt(3)).toBe(12);
    expect(reader.readUInt(4)).toBe(13);
    expect(reader.finished).toBe(true);
  });

  it('should throw TikzCompilationError on invalid integer lengths or out-of-bounds reads', () => {
    const reader = new BinaryReader(new Uint8Array([1, 2]));
    expect(() => reader.readInt(5)).toThrow(TikzCompilationError);
    expect(() => reader.readUInt(0)).toThrow(TikzCompilationError);
    expect(() => reader.readUInt32()).toThrow(/Unexpected end of DVI stream/);
    expect(() => reader.skip(-1)).toThrow(/Unexpected end of DVI stream/);
  });
});

describe('Machine', () => {
  it('should push, pop, ignore pop on empty stack, and reset', () => {
    const m = new Machine();
    m.state.h = 42;
    m.push();
    m.state.h = 100;

    m.pop();
    expect(m.state.h).toBe(42);

    // Popping when stack is empty leaves state intact
    m.pop();
    expect(m.state.h).toBe(42);

    m.reset();
    expect(m.state.h).toBe(0);
  });
});

describe('Errors', () => {
  it('should construct TikzCompilationError and TikzInitializationError with proper prototypes', () => {
    const compErr = new TikzCompilationError('Failed', ['line 1']);
    expect(compErr).toBeInstanceOf(Error);
    expect(compErr).toBeInstanceOf(TikzCompilationError);
    expect(compErr.name).toBe('TikzCompilationError');
    expect(compErr.logs).toEqual(['line 1']);

    const initErr = new TikzInitializationError('Missing WASM');
    expect(initErr).toBeInstanceOf(Error);
    expect(initErr).toBeInstanceOf(TikzInitializationError);
    expect(initErr.name).toBe('TikzInitializationError');
    expect(initErr.message).toBe('Failed to initialize TikZ Engine: Missing WASM');
  });
});

describe('Template & Path Utils', () => {
  it('should preserve full documents starting with \documentclass or \input and wrap snippets', () => {
    const doc = String.raw`\documentclass{article}\begin{document}Hi\end{document}`;
    expect(wrapInDocument(doc)).toBe(doc);

    const inputDoc = String.raw`  \input tikz.tex`;
    expect(wrapInDocument(inputDoc)).toBe(inputDoc);

    const wrapped = wrapInDocument(String.raw`	ikz \draw (0,0) -- (1,1);`);
    expect(wrapped).toContain(String.raw`\documentclass[dvisvgm]{standalone}`);
  });

  it('should extract parent directory segments', () => {
    expect(getParentDirectories('/texmf/fonts/cmr10.tfm')).toEqual(['texmf', 'fonts']);
    expect(getParentDirectories('/root.tex')).toEqual([]);
    expect(getParentDirectories('')).toEqual([]);
  });
});
