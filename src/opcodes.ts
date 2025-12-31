/**
 * DVI Opcodes as defined in the standard.
 */
export const OP = {
    SET_CHAR_0: 0,
    SET_CHAR_127: 127,
    SET1: 128,
    SET_RULE: 132,
    PUT1: 133,
    PUT_RULE: 137,
    NOP: 138,
    BOP: 139,
    EOP: 140,
    PUSH: 141,
    POP: 142,
    RIGHT1: 143,
    RIGHT4: 146,
    W0: 147,
    W1: 148,
    X0: 152,
    X1: 153,
    DOWN1: 157,
    DOWN4: 160,
    Y0: 161,
    Y1: 162,
    Z0: 166,
    Z1: 167,
    FNT_NUM_0: 171,
    FNT_NUM_63: 234,
    FNT1: 235,
    XXX1: 239, // Special string (short)
    XXX4: 242, // Special string (long)
    FNT_DEF1: 243,
    PRE: 247,
    POST: 248,
    POST_POST: 249
} as const;