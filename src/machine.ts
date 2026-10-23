/**
 * DVI virtual machine state and coordinate stack management.
 *
 * @packageDocumentation
 */

import type { MachineState } from './types.js';

/**
 * Maintains the coordinate and spacing registers (`h`, `v`, `w`, `x`, `y`, `z`, `fontId`)
 * and the register stack for a DVI interpreter.
 */
export class Machine {
  /**
   * LIFO stack of saved machine register states (`PUSH` / `POP`).
   */
  private stack: MachineState[] = [];

  /**
   * Active register state of the DVI cursor and font selection.
   */
  public state: MachineState;

  /**
   * Initializes a new DVI state machine with zeroed registers.
   */
  constructor() {
    this.state = this.initialState();
  }

  /**
   * Creates a clean initial register state with all coordinates and font IDs set to `0`.
   *
   * @returns A zeroed {@link MachineState} object.
   */
  private initialState(): MachineState {
    return { h: 0, v: 0, w: 0, x: 0, y: 0, z: 0, fontId: 0 };
  }

  /**
   * Resets the current registers to zero and clears the coordinate stack.
   */
  reset(): void {
    this.stack = [];
    this.state = this.initialState();
  }

  /**
   * Pushes a shallow clone of the current {@link Machine.state} onto the stack.
   */
  push(): void {
    this.stack.push({ ...this.state });
  }

  /**
   * Pops the most recently saved {@link MachineState} from the stack and restores it.
   * If the stack is empty, the current state remains unchanged.
   */
  pop(): void {
    const s = this.stack.pop();
    if (s) {
      this.state = s;
    }
  }
}
