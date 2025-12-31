import type { MachineState } from './types.js';

export class Machine {
    private stack: MachineState[] = [];
    public state: MachineState;

    constructor() {
        this.state = this.initialState();
    }

    private initialState(): MachineState {
        return { h: 0, v: 0, w: 0, x: 0, y: 0, z: 0, fontId: 0 };
    }

    push() {
        // Clone current state
        this.stack.push({ ...this.state });
    }

    pop() {
        const s = this.stack.pop();
        if (s) {
            this.state = s;
        }
    }
}