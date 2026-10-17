/** Render text that may contain `backtick` spans as inline <code> elements. */
export default function InlineCode({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="px-1 py-0.5 rounded bg-slate-800 text-pink-300 font-mono text-[11px]">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
