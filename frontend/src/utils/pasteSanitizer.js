export function sanitizePaste(text) {
  // Strip CID glyph corruptions often found in poorly extracted PDFs (e.g., (cid:10))
  let sanitized = text.replace(/\(cid:\d+\)/g, '');
  
  // Replace zero-width spaces and other invisible characters that might cause issues
  sanitized = sanitized.replace(/[\u200B-\u200D\uFEFF]/g, '');
  
  // Normalize newlines to standard \n
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Remove trailing whitespace on each line
  sanitized = sanitized.replace(/[ \t]+$/gm, '');
  
  return sanitized.trim();
}
