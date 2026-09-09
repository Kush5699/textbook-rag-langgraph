/**
 * Clean and format mathematical text and Claude-style Markdown.
 * Converts raw LaTeX tokens (\text, \theta, \frac, \sqrt, \tan, powers, etc.) into clean readable textbook math equations.
 */
export function formatMathematicalText(text) {
  if (!text || typeof text !== 'string') return text;

  let formatted = text;

  // 1. Remove LaTeX math wrappers: \\[ ... \\], \\( ... \\), $$ ... $$
  formatted = formatted.replace(/\\\[([\s\S]*?)\\\]/g, '$1');
  formatted = formatted.replace(/\\\(([\s\S]*?)\\\)/g, '$1');
  formatted = formatted.replace(/\$\$([\s\S]*?)\$\$/g, '$1');

  // 2. Remove standalone square brackets wrapping whole equation lines:
  // e.g. [ \text{Sector area} = (θ) / (360) × π × r^{2} ] -> Sector area = (θ) / (360) × π × r²
  // Leaves markdown links [text](url) unaffected
  formatted = formatted.replace(/(^|\r?\n)[ \t]*\[[ \t]*([^[\]\r\n]*(?:=|<|>|×|÷|\/|\+|-|\*|sqrt|sin|cos|tan|cosec|sec|cot)[^[\]\r\n]*)[ \t]*\][ \t]*(?=\r?\n|$)/g, '$1$2');

  // 3. Remove LaTeX text wrappers: \text{...}, \mathrm{...}, \mathbf{...}, \textbf{...}
  formatted = formatted.replace(/\\(?:text|mathrm|mathbf|mathit|textbf|textrm|operatorname)\{([^}]+)\}/g, '$1');

  // 4. Replace fractions: \frac{a}{b} -> (a) / (b)
  formatted = formatted.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '($1) / ($2)');

  // 5. Replace square roots: \sqrt{x} -> sqrt(x), \sqrt[3]{x} -> cbrt(x)
  formatted = formatted.replace(/\\sqrt\s*\{([^}]+)\}/g, 'sqrt($1)');
  formatted = formatted.replace(/\\sqrt\[(\d+)\]\s*\{([^}]+)\}/g, 'root($1, $2)');

  // 6. Replace Greek letters and mathematical symbols with standard Unicode
  const greekMap = {
    '\\\\theta': 'θ',
    '\\\\alpha': 'α',
    '\\\\beta': 'β',
    '\\\\gamma': 'γ',
    '\\\\delta': 'δ',
    '\\\\lambda': 'λ',
    '\\\\pi': 'π',
    '\\\\sigma': 'σ',
    '\\\\omega': 'ω',
    '\\\\phi': 'φ',
    '\\\\Delta': 'Δ',
    '\\\\Sigma': 'Σ',
    '\\\\pm': '±',
    '\\\\mp': '∓',
    '\\\\times': '×',
    '\\\\div': '÷',
    '\\\\leq': '<=',
    '\\\\le': '<=',
    '\\\\geq': '>=',
    '\\\\ge': '>=',
    '\\\\neq': '!=',
    '\\\\ne': '!=',
    '\\\\approx': '≈',
    '\\\\circ': '°',
    '\\\\degree': '°',
    '\\\\infty': '∞',
    '\\\\cdot': '·',
  };

  for (const [pattern, replacement] of Object.entries(greekMap)) {
    formatted = formatted.replace(new RegExp(pattern, 'g'), replacement);
  }

  // 7. Replace standard trig/math operators (\sin, \cos, \tan, etc.)
  formatted = formatted.replace(/\\(sin|cos|tan|csc|sec|cot|cosec|log|ln|lim|exp|deg)\b/g, '$1');

  // 8. Clean escaped symbols: \{ -> {, \} -> }, \left, \right
  formatted = formatted.replace(/\\left[\[\(\{]/g, '(')
                       .replace(/\\right[\]\)\}]/g, ')')
                       .replace(/\\\{/g, '{')
                       .replace(/\\\}/g, '}')
                       .replace(/\\,/g, ' ')
                       .replace(/\\;/g, ' ')
                       .replace(/\\!/g, '')
                       .replace(/\\quad/g, '   ')
                       .replace(/\\qquad/g, '      ');

  // 9. Clean superscripts / powers into clean Unicode exponents (², ³, etc.)
  const superscripts = {
    '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
    '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
    '+': '⁺', '-': '⁻', 'n': 'ⁿ'
  };

  formatted = formatted.replace(/\^\{\s*°\s*\}/g, '°');
  formatted = formatted.replace(/\^\s*°/g, '°');
  formatted = formatted.replace(/\^\{([0-9n+-]+)\}/g, (_, p1) => {
    return p1.split('').map(c => superscripts[c] || c).join('');
  });
  formatted = formatted.replace(/([a-zA-Z\)])\^([0-9n])/g, (_, base, p1) => {
    return base + (superscripts[p1] || p1);
  });
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '^($1)');

  // 10. Clean any remaining stray backslashes before words
  formatted = formatted.replace(/\\([a-zA-Z]+)/g, '$1');

  return formatted;
}

