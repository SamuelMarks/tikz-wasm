/**
 * Standard DeVice Independent (DVI) format opcodes.
 *
 * @packageDocumentation
 */

/**
 * DVI Opcodes as defined in Donald Knuth's DVI specification.
 */
export const OP = {
  /** Typeset character 0 and move right. */
  SET_CHAR_0: 0,
  /** Typeset character 127 and move right. */
  SET_CHAR_127: 127,
  /** Typeset 1-byte unsigned character and move right. */
  SET1: 128,
  /** Typeset 2-byte unsigned character and move right. */
  SET2: 129,
  /** Typeset 3-byte unsigned character and move right. */
  SET3: 130,
  /** Typeset 4-byte signed character and move right. */
  SET4: 131,
  /** Typeset a solid black rule (height `a`, width `b`) and move right by `b`. */
  SET_RULE: 132,
  /** Typeset 1-byte unsigned character without moving `h`. */
  PUT1: 133,
  /** Typeset 2-byte unsigned character without moving `h`. */
  PUT2: 134,
  /** Typeset 3-byte unsigned character without moving `h`. */
  PUT3: 135,
  /** Typeset 4-byte signed character without moving `h`. */
  PUT4: 136,
  /** Typeset a solid black rule (height `a`, width `b`) without moving `h`. */
  PUT_RULE: 137,
  /** No operation. */
  NOP: 138,
  /** Beginning of page (`c0..c9` counters + previous `BOP` pointer). */
  BOP: 139,
  /** End of page. */
  EOP: 140,
  /** Push current `(h, v, w, x, y, z)` registers onto the stack. */
  PUSH: 141,
  /** Pop `(h, v, w, x, y, z)` registers from the stack. */
  POP: 142,
  /** Move right by 1-byte signed integer. */
  RIGHT1: 143,
  /** Move right by 2-byte signed integer. */
  RIGHT2: 144,
  /** Move right by 3-byte signed integer. */
  RIGHT3: 145,
  /** Move right by 4-byte signed integer. */
  RIGHT4: 146,
  /** Move right by current `w` register. */
  W0: 147,
  /** Set `w` to 1-byte signed integer and move right by `w`. */
  W1: 148,
  /** Set `w` to 2-byte signed integer and move right by `w`. */
  W2: 149,
  /** Set `w` to 3-byte signed integer and move right by `w`. */
  W3: 150,
  /** Set `w` to 4-byte signed integer and move right by `w`. */
  W4: 151,
  /** Move right by current `x` register. */
  X0: 152,
  /** Set `x` to 1-byte signed integer and move right by `x`. */
  X1: 153,
  /** Set `x` to 2-byte signed integer and move right by `x`. */
  X2: 154,
  /** Set `x` to 3-byte signed integer and move right by `x`. */
  X3: 155,
  /** Set `x` to 4-byte signed integer and move right by `x`. */
  X4: 156,
  /** Move down by 1-byte signed integer. */
  DOWN1: 157,
  /** Move down by 2-byte signed integer. */
  DOWN2: 158,
  /** Move down by 3-byte signed integer. */
  DOWN3: 159,
  /** Move down by 4-byte signed integer. */
  DOWN4: 160,
  /** Move down by current `y` register. */
  Y0: 161,
  /** Set `y` to 1-byte signed integer and move down by `y`. */
  Y1: 162,
  /** Set `y` to 2-byte signed integer and move down by `y`. */
  Y2: 163,
  /** Set `y` to 3-byte signed integer and move down by `y`. */
  Y3: 164,
  /** Set `y` to 4-byte signed integer and move down by `y`. */
  Y4: 165,
  /** Move down by current `z` register. */
  Z0: 166,
  /** Set `z` to 1-byte signed integer and move down by `z`. */
  Z1: 167,
  /** Set `z` to 2-byte signed integer and move down by `z`. */
  Z2: 168,
  /** Set `z` to 3-byte signed integer and move down by `z`. */
  Z3: 169,
  /** Set `z` to 4-byte signed integer and move down by `z`. */
  Z4: 170,
  /** Select font 0. */
  FNT_NUM_0: 171,
  /** Select font 63. */
  FNT_NUM_63: 234,
  /** Select font by 1-byte unsigned ID. */
  FNT1: 235,
  /** Select font by 2-byte unsigned ID. */
  FNT2: 236,
  /** Select font by 3-byte unsigned ID. */
  FNT3: 237,
  /** Select font by 4-byte signed ID. */
  FNT4: 238,
  /** Special string with 1-byte unsigned length. */
  XXX1: 239,
  /** Special string with 2-byte unsigned length. */
  XXX2: 240,
  /** Special string with 3-byte unsigned length. */
  XXX3: 241,
  /** Special string with 4-byte unsigned length. */
  XXX4: 242,
  /** Define font with 1-byte unsigned ID. */
  FNT_DEF1: 243,
  /** Define font with 2-byte unsigned ID. */
  FNT_DEF2: 244,
  /** Define font with 3-byte unsigned ID. */
  FNT_DEF3: 245,
  /** Define font with 4-byte signed ID. */
  FNT_DEF4: 246,
  /** Preamble opcode. */
  PRE: 247,
  /** Postamble opcode. */
  POST: 248,
  /** Post-postamble opcode. */
  POST_POST: 249
} as const;

/**
 * Union type of all standard DVI opcode byte values.
 */
export type DviOpcode = (typeof OP)[keyof typeof OP];
