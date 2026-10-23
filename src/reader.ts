/**
 * Big-endian binary stream reader for parsing DeVice Independent (DVI) byte buffers.
 *
 * @packageDocumentation
 */

import { TikzCompilationError } from './errors.js';

const SHARED_TEXT_DECODER = new TextDecoder();

/**
 * Sequential big-endian binary reader over a `Uint8Array` buffer with bounds checking.
 */
export class BinaryReader {
  /**
   * Underlying `DataView` for big-endian integer extraction.
   */
  private readonly view: DataView;

  /**
   * Raw byte slice backing the reader.
   */
  private readonly buffer: Uint8Array;

  /**
   * Current 0-based read cursor offset in bytes.
   */
  private pos: number = 0;

  /**
   * Creates a new {@link BinaryReader} over the provided byte buffer.
   *
   * @param data - Raw DVI binary buffer.
   */
  constructor(data: Uint8Array) {
    this.buffer = data;
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  }

  /**
   * Indicates whether the cursor has reached or passed the end of the buffer.
   */
  get finished(): boolean {
    return this.pos >= this.buffer.length;
  }

  /**
   * Verifies that at least `bytes` remain in the buffer from the current position.
   *
   * @param bytes - Number of bytes required.
   * @throws {@link TikzCompilationError} if `bytes` is negative or exceeds remaining length.
   */
  private ensureAvailable(bytes: number): void {
    if (bytes < 0 || this.pos + bytes > this.buffer.length) {
      throw new TikzCompilationError(
        `Unexpected end of DVI stream at offset ${this.pos} (requested ${bytes} bytes, available ${this.buffer.length - this.pos})`,
        ['Corrupt or truncated DVI stream']
      );
    }
  }

  /**
   * Reads an unsigned 8-bit integer and advances the cursor by 1 byte.
   *
   * @returns The unsigned byte value (`0..255`).
   */
  readByte(): number {
    this.ensureAvailable(1);
    const v = this.view.getUint8(this.pos);
    this.pos += 1;
    return v;
  }

  /**
   * Reads a signed 8-bit integer and advances the cursor by 1 byte.
   *
   * @returns The signed byte value (`-128..127`).
   */
  readSByte(): number {
    this.ensureAvailable(1);
    const v = this.view.getInt8(this.pos);
    this.pos += 1;
    return v;
  }

  /**
   * Reads a big-endian unsigned 16-bit integer and advances the cursor by 2 bytes.
   *
   * @returns The unsigned 16-bit integer value (`0..65535`).
   */
  readUInt16(): number {
    this.ensureAvailable(2);
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }

  /**
   * Reads a big-endian unsigned 32-bit integer and advances the cursor by 4 bytes.
   *
   * @returns The unsigned 32-bit integer value.
   */
  readUInt32(): number {
    this.ensureAvailable(4);
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }

  /**
   * Reads a big-endian signed integer of `length` bytes (`0..4`) as defined by the DVI standard.
   *
   * @param length - Number of bytes to read (`0`, `1`, `2`, `3`, or `4`).
   * @returns The decoded signed integer value.
   * @throws {@link TikzCompilationError} if `length` is not in `0..4` or buffer underflows.
   */
  readInt(length: number): number {
    switch (length) {
      case 0:
        return 0;
      case 1:
        return this.readSByte();
      case 2: {
        this.ensureAvailable(2);
        const v = this.view.getInt16(this.pos);
        this.pos += 2;
        return v;
      }
      case 3: {
        const b1 = this.readByte();
        const b2 = this.readByte();
        const b3 = this.readByte();
        const v = (b1 << 16) | (b2 << 8) | b3;
        return (v & 0x800000) !== 0 ? v - 0x1000000 : v;
      }
      case 4: {
        this.ensureAvailable(4);
        const v = this.view.getInt32(this.pos);
        this.pos += 4;
        return v;
      }
      default:
        throw new TikzCompilationError(
          `Invalid DVI signed integer byte length: ${length}`,
          ['DVI integer length must be 0, 1, 2, 3, or 4']
        );
    }
  }

  /**
   * Reads a big-endian unsigned integer of `length` bytes (`1..4`).
   *
   * @param length - Number of bytes to read (`1`, `2`, `3`, or `4`).
   * @returns The decoded unsigned integer value.
   * @throws {@link TikzCompilationError} if `length` is not in `1..4` or buffer underflows.
   */
  readUInt(length: number): number {
    switch (length) {
      case 1:
        return this.readByte();
      case 2:
        return this.readUInt16();
      case 3: {
        const b1 = this.readByte();
        const b2 = this.readByte();
        const b3 = this.readByte();
        return (b1 << 16) | (b2 << 8) | b3;
      }
      case 4:
        return this.readUInt32();
      default:
        throw new TikzCompilationError(
          `Invalid DVI unsigned integer byte length: ${length}`,
          ['DVI unsigned integer length must be 1, 2, 3, or 4']
        );
    }
  }

  /**
   * Reads a UTF-8 string of `len` bytes and advances the cursor by `len`.
   *
   * @param len - Number of bytes to decode.
   * @returns The decoded UTF-8 string.
   */
  readString(len: number): string {
    this.ensureAvailable(len);
    const slice = this.buffer.subarray(this.pos, this.pos + len);
    this.pos += len;
    return SHARED_TEXT_DECODER.decode(slice);
  }

  /**
   * Advances the cursor by `n` bytes after verifying bounds.
   *
   * @param n - Number of bytes to skip.
   */
  skip(n: number): void {
    this.ensureAvailable(n);
    this.pos += n;
  }
}
