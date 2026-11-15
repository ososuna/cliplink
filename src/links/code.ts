const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const length = 7;

export function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  // 62 doesn't divide 256, so `byte % 62` slightly favours the first 8 characters. Irrelevant for Codes.
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}
