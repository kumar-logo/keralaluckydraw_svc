const MASK = '***';

const ZERO_WIDTH_RE = new RegExp('[\\u200B-\\u200D\\uFEFF]', 'g');

const LINK_RE =
  /((https?:\/\/|www\.)\S+|\b[a-z0-9-]+(\.[a-z0-9-]+)*\.(com|net|org|in|io|xyz|co|link|me|info|biz|app|site|online|club|vip|win|bet|top|live|gg|tg|ru|de|us|uk|whatsapp|telegram)\b\S*)/gi;

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface ChatFilterConfig {
  blockLinks: boolean;
  badWords: string[];
}

export const parseBadWords = (raw: string | null | undefined): string[] =>
  String(raw ?? '')
    .split(/[\n,]/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

export const filterChatContent = (
  raw: string,
  cfg: ChatFilterConfig,
): string => {
  let text = raw.replace(ZERO_WIDTH_RE, '').replace(/\s+/g, ' ').trim();
  if (cfg.blockLinks) {
    text = text.replace(LINK_RE, MASK);
  }
  for (const word of cfg.badWords) {
    if (!word) continue;
    const re = new RegExp(escapeRegExp(word), 'gi');
    text = text.replace(re, MASK);
  }
  return text.trim();
};
