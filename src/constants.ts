/**
 * Kpathsea configuration constants and PGF driver setup for the TeX virtual file system.
 *
 * @packageDocumentation
 */

/**
 * A minimal `texmf.cnf` configuration string.
 * Tells Kpathsea where to locate fonts (`.tfm`) and macros (`.tex`) inside the Emscripten VFS:
 * - `/texmf/tex` for macros
 * - `/texmf/fonts` for font metrics
 */
export const MINIMAL_TEXMF_CNF = `
TEXMF = /texmf
TEXINPUTS = .;$TEXMF/tex//
TFMFONTS = .;$TEXMF/fonts//
% Prevent TeX from trying to spawn shell commands
openout_any = p
openin_any = a
parse_first_line = f
`;

/**
 * Standard virtual file system path where `texmf.cnf` must reside for Web2C/Kpathsea.
 */
export const CNF_PATH = '/texmf/web2c/texmf.cnf';

/**
 * TeX macro definition forcing PGF/TikZ to emit `dvisvgm:raw` specials compatible with {@link DviParser}.
 */
export const PGF_DRIVER_DEF = String.raw`\def\pgfsysdriver{pgfsys-dvisvgm.def}`;
