/** Display names for the language slugs LeetCode / Codeforces submissions carry. */
export const LANGUAGE_LABELS: Record<string, string> = {
  cpp: 'C++',
  c: 'C',
  java: 'Java',
  python3: 'Python 3',
  python: 'Python',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  golang: 'Go',
  rust: 'Rust',
  kotlin: 'Kotlin',
};

export function languageLabel(slug: string): string {
  return LANGUAGE_LABELS[slug] || slug;
}
