/**
 * A minimal texmf.cnf configuration.
 * This tells Kpathsea where to look for fonts (.tfm) and macros (.tex).
 * 
 * We set up a simple structure:
 * /texmf/tex  -> for macros
 * /texmf/fonts -> for metrics
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
 * Standard path where the config file must reside for web2c.
 */
export const CNF_PATH = '/texmf/web2c/texmf.cnf';