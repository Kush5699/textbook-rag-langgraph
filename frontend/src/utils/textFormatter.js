/**
 * Clean and format mathematical text and Claude-style Markdown.
 * Converts raw LaTeX tokens (\theta, \frac, \sqrt, \tan, etc.) into clean readable textbook math.
 */
export function formatMathematicalText(text) {
  if (!text || typeof text !== 'string') return text;

  let formatted = text;

  // 1. Remove raw LaTeX math brackets [ ... ] that wrap entire equations
  formatted = formatted.replace(/^\s*\[\s*([\s\S]*?)\s*\]\s*$/gm, '$1');

  // 2. Replace fractions: \frac{a}{b} -> (a) / (b)
  formatted = formatted.replace(/\\frac\s*\{([^}]+)\}\s*\{([^}]+)\}/g, '($1) / ($2)');

  // 3. Replace square roots: \sqrt{x} -> sqrt(x), \sqrt[3]{x} -> cbrt(x)
  formatted = formatted.replace(/\\sqrt\s*\{([^}]+)\}/g, 'sqrt($1)');
  formatted = formatted.replace(/\\sqrt\[(\d+)\]\s*\{([^}]+)\}/g, 'root($1, $2)');

  // 4. Replace Greek letters and mathematical symbols with standard Unicode
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
    '\\\\infty': '∞',
    '\\\\cdot': '·',
  };

  for (const [pattern, replacement] of Object.entries(greekMap)) {
    formatted = formatted.replace(new RegExp(pattern, 'g'), replacement);
  }

  // 5. Replace standard trig/math operators (\sin, \cos, \tan, etc.)
  formatted = formatted.replace(/\\(sin|cos|tan|csc|sec|cot|log|ln|lim|exp|deg)\b/g, '$1');

  // 6. Clean escaped symbols: \{ -> {, \} -> }, \left, \right
  formatted = formatted.replace(/\\left[\[\(\{]/g, '(')
                       .replace(/\\right[\]\)\}]/g, ')')
                       .replace(/\\\{/g, '{')
                       .replace(/\\\}/g, '}')
                       .replace(/\\,/g, ' ')
                       .replace(/\\;/g, ' ')
                       .replace(/\\!/g, '')
                       .replace(/\\quad/g, '   ');

  // 7. Clean exponents like ^\circ or ^{\circ}
  formatted = formatted.replace(/\^\{\s*°\s*\}/g, '°')
                       .replace(/\^\s*°/g, '°');

  return formatted;
}
