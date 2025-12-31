import { BinaryReader } from './reader.js'; 
import { OP } from './opcodes.js'; 
import { Machine } from './machine.js'; 
import { SvgBuilder } from './svg.js'; 
import { TikzCompilationError } from './errors.js';

export class DviParser { 
    private reader: BinaryReader; 
    private machine: Machine; 
    private builder: SvgBuilder; 

    constructor(data: Uint8Array) { 
        if (!data || data.length === 0) {
            throw new TikzCompilationError("Empty DVI Output", ["Parser received 0 bytes"]);
        }
        this.reader = new BinaryReader(data); 
        this.machine = new Machine(); 
        this.builder = new SvgBuilder(); 
    } 

    parse(): string { 
        const r = this.reader; 
        const m = this.machine; 

        while (!r.finished) { 
            const cmd = r.readByte(); 

            if (cmd <= OP.SET_CHAR_127) { 
                // Char 0-127 (Basic ASCII text)
                const charCode = cmd;
                const width = this.getCharWidth(charCode, m.state.fontId); 
                
                // Only render text if width > 0 to avoid invisible markers messing up SVG
                this.builder.addText(m.state.h, m.state.v, String.fromCharCode(charCode), "cmr10", 10);
                m.state.h += width; 
                continue; 
            } 

            // Font Selection (0-63)
            if (cmd >= OP.FNT_NUM_0 && cmd <= OP.FNT_NUM_63) { 
                m.state.fontId = cmd - OP.FNT_NUM_0; 
                continue; 
            } 

            switch (cmd) { 
                // --- Preamble / Postamble ---
                case OP.PRE: 
                    r.readByte(); // version i
                    r.readUInt32(); // num
                    r.readUInt32(); // den
                    r.readUInt32(); // mag
                    const commentLen = r.readByte(); 
                    r.skip(commentLen); 
                    break; 
                
                case OP.POST: 
                    return this.builder.getSVG(); 
                
                case OP.BOP: 
                    r.skip(4 * 10); // c0..c9 counters
                    r.skip(4); // prev pointer
                    break; 
                
                case OP.EOP: 
                    m.state = { h: 0, v: 0, w: 0, x: 0, y: 0, z: 0, fontId: 0 }; // Reset stack? Usually stack is empty at EOP
                    break; 

                // --- Stack Operations ---
                case OP.PUSH: m.push(); break; 
                case OP.POP: m.pop(); break; 

                // --- Horizontal Movement ---
                case OP.RIGHT1: case OP.RIGHT4: 
                    const deltaR = r.readInt(cmd === OP.RIGHT1 ? 1 : 4); 
                    m.state.h += deltaR; break; 
                
                case OP.W0: m.state.h += m.state.w; break; 
                case OP.W1: 
                    m.state.w = r.readInt(cmd === OP.W1 ? 1 : 4); 
                    m.state.h += m.state.w; 
                    break; 
                case OP.X0: m.state.h += m.state.x; break;
                case OP.X1:
                    m.state.x = r.readInt(cmd === OP.X1 ? 1 : 4);
                    m.state.h += m.state.x;
                    break;

                // --- Vertical Movement ---
                case OP.DOWN1: case OP.DOWN4: 
                    const deltaD = r.readInt(cmd === OP.DOWN1 ? 1 : 4); 
                    m.state.v += deltaD; break; 
                
                case OP.Y0: m.state.v += m.state.y; break;
                case OP.Y1:
                    m.state.y = r.readInt(cmd === OP.Y1 ? 1 : 4);
                    m.state.v += m.state.y;
                    break;
                case OP.Z0: m.state.v += m.state.z; break;
                case OP.Z1:
                    m.state.z = r.readInt(cmd === OP.Z1 ? 1 : 4);
                    m.state.v += m.state.z;
                    break;

                // --- Drawing Rules ---
                case OP.PUT_RULE: 
                case OP.SET_RULE: 
                    const a = r.readInt(4); // height
                    const b = r.readInt(4); // width
                    if (a > 0 && b > 0) { 
                        // DVI coordinate V is the baseline. 
                        // The rule extends UP from V by height 'a'.
                        this.builder.addRect(m.state.h, m.state.v, b, a); 
                    } 
                    if (cmd === OP.SET_RULE) m.state.h += b; 
                    break; 

                // --- Specials ---
                case OP.XXX1: 
                    const k1 = r.readUInt(1); 
                    this.handleSpecial(r.readString(k1)); 
                    break; 
                case OP.XXX4: 
                    const k4 = r.readUInt(4); 
                    this.handleSpecial(r.readString(k4)); 
                    break; 
                
                // --- Font Definitions (Skipping) ---
                case OP.FNT_DEF1: 
                    const k = r.readInt(1); // Font ID
                    r.skip(12); // checksum(4), scale(4), design(4)
                    const areaLen = r.readByte();
                    const nameLen = r.readByte();
                    r.skip(areaLen + nameLen);
                    break; 

                // --- Variable Length Ops Handling ---
                // (Explicitly handling the rest of W/X/Y/Z 2-byte and 3-byte variants)
                default: 
                    if (cmd >= 149 && cmd <= 151) { // W2-W4
                        m.state.w = r.readInt(cmd - 147);
                        m.state.h += m.state.w;
                    } 
                    else if (cmd >= 154 && cmd <= 156) { // X2-X4
                        m.state.x = r.readInt(cmd - 152);
                        m.state.h += m.state.x;
                    }
                    else if (cmd >= 163 && cmd <= 165) { // Y2-Y4
                        m.state.y = r.readInt(cmd - 161);
                        m.state.v += m.state.y;
                    }
                    else if (cmd >= 168 && cmd <= 170) { // Z2-Z4
                        m.state.z = r.readInt(cmd - 166);
                        m.state.v += m.state.z;
                    }
                    else {
                        // Skip NOP(138) and others safely or warn
                    }
                    break; 
            } 
        } 
        return this.builder.getSVG(); 
    } 

    private handleSpecial(special: string) { 
        // 1. TikZ / dvisvgm specials
        const DVISVGM_PREFIX = "dvisvgm:raw ";
        
        if (special.startsWith(DVISVGM_PREFIX)) { 
            const svgContent = special.substring(DVISVGM_PREFIX.length); 
            this.builder.addSpecialSVG(svgContent, this.machine.state.h, this.machine.state.v); 
        } 
        // 2. Standard Color specials (color push rgb 0 0 0)
        else if (special.startsWith("color push")) { 
            const color = this.parseColor(special);
            this.builder.addSpecialSVG(`<g fill="${color}" stroke="${color}">`, this.machine.state.h, this.machine.state.v); 
        } 
        else if (special.startsWith("color pop")) { 
            // We just close the group
            this.builder.addSpecialSVG(`</g>`, this.machine.state.h, this.machine.state.v); 
        } 
    } 

    private parseColor(special: string): string { 
        // Example: "color push rgb 1 0.5 0"
        const parts = special.split(' ');
        const model = parts[2]; // 'rgb' or 'gray'
        
        if (model === 'rgb') {
            const r = Math.round(parseFloat(parts[3]) * 255);
            const g = Math.round(parseFloat(parts[4]) * 255);
            const b = Math.round(parseFloat(parts[5]) * 255);
            return `rgb(${r},${g},${b})`;
        }
        if (model === 'gray') {
            const g = Math.round(parseFloat(parts[3]) * 255);
            return `rgb(${g},${g},${g})`;
        }
        return "black"; 
    } 

    private getCharWidth(char: number, font: number): number { 
        // Stub: TFM reading usually happens here. 
        // For basic text spacing, we assume Computer Modern Roman 10pt approx width (~6pt)
        // 1pt = 65536 sp
        return 300000; 
    } 
}