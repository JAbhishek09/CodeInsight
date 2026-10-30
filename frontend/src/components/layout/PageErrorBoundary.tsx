import React from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { reloadingForNewBuild } from '@/lib/staleBuild';

interface State { error: Error | null }

/**
 * Catches a page that fails to load or render, so the app shell stays up
 * and the student gets a way out instead of a blank screen. Keyed by path in
 * AuthLayout, so moving to another page starts fresh.
 */
export default class PageErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[page] failed to load or render:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    if (reloadingForNewBuild) {
      return (
        <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the latest version of CodeInsight…
        </div>
      );
    }

    return (
      <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-xl border border-border bg-surface-1 px-6 py-12 text-center">
        <span className="flex size-11 items-center justify-center rounded-full bg-warning/15 text-warning">
          <TriangleAlert className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">This page couldn’t load</h1>
          <p className="text-sm text-muted-foreground">
            Check your connection and try again. If CodeInsight was just updated, reloading picks up the new version.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}><RefreshCw /> Reload</Button>
          <Button variant="outline" asChild><Link to="/home">Go home</Link></Button>
        </div>
      </div>
    );
  }
}
