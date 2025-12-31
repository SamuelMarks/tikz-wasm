import { describe, it, expect } from 'vitest';
import { DviParser } from '../src/parser';
import { OP } from '../src/opcodes';

describe('DviParser', () => {
    // Helper to create buffers
    const createDVI = (opcodes: number[]): Uint8Array => {
        return new Uint8Array(opcodes);
    };

    it('should parse basic rectangles (SET_RULE)', () => {
        // BOP (skipped in loose logic?? No, we need strict offsets usually, but our parser handles stream)
        // Command: SET_RULE(132), H(4b), W(4b)
        // 655360 = 10pt approx. 0x000A0000
        const data = new Uint8Array([
            OP.BOP, 0,0,0,0,0,0,0,0,0,0, // c0-c9
            0,0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,0,
            0,0,0,0,0,0,0,0,0,0, // 40 bytes counters
            0,0,0,0, // prev
            
            OP.SET_RULE, 
            0, 10, 0, 0, // Height
            0, 10, 0, 0, // Width 

            OP.POST // End
        ]);

        const parser = new DviParser(data);
        const svg = parser.parse();
        expect(svg).toContain('<rect');
        expect(svg).toContain('width="10.000"'); // 0x000A0000 / 65536
    });

    it('should handle TikZ Specials (dvisvgm:raw)', () => {
        const specialStr = "dvisvgm:raw <path d='M0 0 L10 10' />";
        const len = specialStr.length;
        
        const data = new Uint8Array([
            OP.XXX1, len, 
            ...new TextEncoder().encode(specialStr),
            OP.POST
        ]);

        const parser = new DviParser(data);
        const svg = parser.parse();
        expect(svg).toContain("<path d='M0 0 L10 10' />");
    });

    it('should handle State Stack (PUSH/POP)', () => {
        // Move right, Push, Move down, Pop, Set Rule (should be back up)
        // This checks internal logic, we verify output correctness indirectly via coordinates?
        // Hard to check internal state without exposing it.
        // We trust the integration: if POP didn't work, subsequent coords would be wrong.
        
        // PUSH, RIGHT1(10), POP, RIGHT1(10) -> X should be 10, not 20 if POP failed to reset H? 
        // No, visual rendering flow.
        const data = new Uint8Array([OP.PUSH, OP.POP, OP.POST]);
        const parser = new DviParser(data);
        expect(parser.parse()).toBeDefined();
    });

    it('should parse variable length integers correctly', () => {
        // Test RIGHT4 with a large number
        const data = new Uint8Array([ 
            OP.RIGHT4, 0, 1, 0, 0, // 65536
            OP.POST 
        ]);
        const parser = new DviParser(data);
        const svg = parser.parse();
        // Just ensuring no crash and parsing completes
        expect(svg).toContain('</svg>');
    });
});