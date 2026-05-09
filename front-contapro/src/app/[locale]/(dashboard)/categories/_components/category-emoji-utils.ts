// Utility to split emoji and text
export function extractEmoji(text: string): { emoji: string; name: string } {
  if (!text) return { emoji: '📌', name: '' };
  
  // This regex matches emojis including combined ones
  const emojiRegex = /^([\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{200D}\u{FE0F}]+)\s*(.*)/u;
  
  const match = text.match(emojiRegex);
  
  if (match) {
    return {
      emoji: match[1],
      name: match[2] || ''
    };
  }
  
  // If no emoji found at the start, return a default one and the full text
  return {
    emoji: '📌', // default emoji
    name: text.trim()
  };
}

export function combineEmoji(emoji: string, name: string): string {
  return `${emoji} ${name}`.trim();
}

export const CATEGORY_COLORS = [
  "from-blue-500/20 to-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "from-emerald-500/20 to-teal-500/20 text-teal-400 border-teal-500/30",
  "from-rose-500/20 to-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "from-amber-500/20 to-orange-500/20 text-orange-400 border-orange-500/30",
  "from-fuchsia-500/20 to-pink-500/20 text-pink-400 border-pink-500/30",
  "from-violet-500/20 to-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30",
  "from-indigo-500/20 to-purple-500/20 text-purple-400 border-purple-500/30",
  "from-blue-500/20 to-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "from-sky-500/20 to-blue-500/20 text-sky-400 border-sky-500/30",
  "from-red-500/20 to-rose-500/20 text-rose-400 border-rose-500/30",
  "from-orange-500/20 to-red-500/20 text-red-400 border-red-500/30",
  "from-yellow-500/20 to-amber-500/20 text-yellow-400 border-yellow-500/30",
  "from-lime-500/20 to-yellow-500/20 text-lime-400 border-lime-500/30",
  "from-green-500/20 to-lime-500/20 text-green-400 border-green-500/30",
  "from-teal-500/20 to-green-500/20 text-teal-400 border-teal-500/30"
];

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function getCategoryVisuals(name: string | undefined | null) {
  if (!name) return { colorClass: CATEGORY_COLORS[0] };
  const hash = hashString(name);
  const colorClass = CATEGORY_COLORS[hash % CATEGORY_COLORS.length];
  return { colorClass };
}
