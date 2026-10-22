import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const STEP_MS = 3200; // captions are a sentence or two; give time to read

/**
 * Steps through precomputed frames. Paused until the student presses Play;
 * ← / → step while the player has focus. The caption is announced politely
 * to screen readers, so the walkthrough works without the visual.
 */
export default function Player<F extends { caption: string }>({ frames, render, label }: {
  frames: F[];
  render: (frame: F, index: number) => React.ReactNode;
  label: string;
}) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const lastIndex = frames.length - 1;

  useEffect(() => {
    if (!playing) return;
    if (i >= lastIndex) { setPlaying(false); return; }
    const t = setTimeout(() => setI((n) => Math.min(n + 1, lastIndex)), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, i, lastIndex]);

  const go = (n: number) => { setPlaying(false); setI(Math.max(0, Math.min(lastIndex, n))); };
  const toggle = () => {
    if (playing) { setPlaying(false); return; }
    if (i >= lastIndex) setI(0);
    setPlaying(true);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
  };

  return (
    <div role="region" aria-label={label} onKeyDown={onKey} className="space-y-4">
      <div className="flex min-h-56 items-center justify-center overflow-x-auto rounded-lg bg-background/40 px-1 py-6 [--cell:1.85rem] [--gap:0.25rem] sm:px-3 sm:[--cell:2.6rem] sm:[--gap:0.4rem] lg:[--cell:3.1rem] lg:[--gap:0.5rem]">
        {render(frames[i], i)}
      </div>

      <p aria-live="polite" className="min-h-[3.75rem] text-sm leading-relaxed text-foreground">
        <span className="mr-2 text-xs font-semibold tabular-nums text-muted-foreground">{i + 1}/{frames.length}</span>
        {frames[i].caption}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" onClick={() => go(0)} disabled={i === 0} aria-label="Back to the start"><RotateCcw /></Button>
          <Button variant="outline" size="icon-sm" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step" aria-keyshortcuts="ArrowLeft"><ChevronLeft /></Button>
          <Button size="sm" onClick={toggle} className="min-w-24" aria-label={playing ? 'Pause' : i >= lastIndex ? 'Play again' : 'Play'}>
            {playing ? <><Pause /> Pause</> : <><Play /> {i >= lastIndex ? 'Replay' : i === 0 ? 'Play' : 'Resume'}</>}
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => go(i + 1)} disabled={i >= lastIndex} aria-label="Next step" aria-keyshortcuts="ArrowRight"><ChevronRight /></Button>
        </div>
        <ol className="flex w-full min-w-0 gap-1 sm:w-auto sm:flex-1" aria-label="Steps">
          {frames.map((_, n) => (
            <li key={n} className="flex-1">
              <button type="button" onClick={() => go(n)} aria-label={`Step ${n + 1}`} aria-current={n === i ? 'step' : undefined}
                className="group flex h-6 w-full items-center">
                <span className={cn('h-1.5 w-full rounded-full transition-colors',
                  n === i ? 'bg-[var(--pc)]' : n < i ? 'bg-[color-mix(in_oklab,var(--pc)_45%,transparent)]' : 'bg-surface-3 group-hover:bg-border-strong')} />
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
