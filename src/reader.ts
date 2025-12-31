export class BinaryReader {
    private view: DataView;
    private buffer: Uint8Array;
    private pos: number = 0;

    constructor(data: Uint8Array) {
        this.buffer = data;
        this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    }

    get finished(): boolean {
        return this.pos >= this.buffer.length;
    }

    readByte(): number {
        return this.view.getUint8(this.pos++);
    }

    readSByte(): number {
        return this.view.getInt8(this.pos++);
    }

    readUInt16(): number {
        const v = this.view.getUint16(this.pos);
        this.pos += 2;
        return v;
    }

    readUInt32(): number {
        const v = this.view.getUint32(this.pos);
        this.pos += 4;
        return v;
    }

    // DVI variable integer reading (1 to 4 bytes)
    readInt(length: number): number {
        if (length === 0) return 0;
        let v = 0;
        // DVI usually big-endian, signed
        if (length === 1) v = this.view.getInt8(this.pos);
        else if (length === 2) v = this.view.getInt16(this.pos);
        else if (length === 3) {
            // 24-bit signed
            const b1 = this.readByte();
            const b2 = this.readByte();
            const b3 = this.readByte();
            v = (b1 << 16) | (b2 << 8) | b3;
            if (v & 0x800000) v -= 0x1000000;
            return v;
        }
        else if (length === 4) v = this.view.getInt32(this.pos);
        
        if (length !== 3) this.pos += length;
        return v;
    }

    // Read UInt for lengths
    readUInt(length: number): number {
        if (length === 1) return this.readByte();
        if (length === 2) return this.readUInt16();
        if (length === 4) return this.readUInt32();
        if (length === 3) {
            const b1 = this.readByte();
            const b2 = this.readByte();
            const b3 = this.readByte();
            return (b1 << 16) | (b2 << 8) | b3;
        }
        return 0;
    }

    readString(len: number): string {
        const slice = this.buffer.slice(this.pos, this.pos + len);
        this.pos += len;
        return new TextDecoder().decode(slice);
    }

    skip(n: number) {
        this.pos += n;
    }
}