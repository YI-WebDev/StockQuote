export function generateQuoteNumber(): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(3)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
    .slice(0, 4);
  return `EST-${datePart}-${randomPart}`;
}
