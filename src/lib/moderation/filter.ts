export const blocklist: string[] = [
  "kill yourself",
  "die",
  "kys",
  "hate you",
  "threat",
  "bomb",
  "attack",
  "suicide",
  "slur1",
  "slur2",
];

export function moderateContent(text: string): boolean {
  // 1. Phone number pattern: matches 7 to 15 digits formatted with spaces, dashes, parentheses, or dots
  const phoneRegex =
    /(?:(?:\+?\d{1,4}[\s.-]*)?(?:\(\s*\d{1,4}\s*\)[\s.-]*)?)?(?:\d[\s.-]*){6,14}\d/;
  if (phoneRegex.test(text)) return false;

  // 2. Email pattern
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  if (emailRegex.test(text)) return false;

  // 3. URLs and links
  const urlRegex = /(https?:\/\/|www\.)[^\s/$.?#].[^\s]*/i;
  if (urlRegex.test(text)) return false;

  // 4. Configurable blocklist
  const lower = text.toLowerCase();
  for (const term of blocklist) {
    if (term.trim() && lower.includes(term.toLowerCase().trim())) {
      return false;
    }
  }

  return true;
}
