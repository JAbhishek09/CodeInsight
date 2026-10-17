import { Fragment, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import VerdictBadge from '@/components/VerdictBadge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import CodeBlock from './CodeBlock';
import { cn } from '@/lib/utils';
import { dateTime, relativeTime } from '@/lib/format';
import { languageLabel } from '@/lib/languages';
import type { Submission } from '@/types/problem';

/** Every submission, newest first; rows with code expand to show it. */
export default function SubmissionsTab({ submissions }: { submissions: Submission[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (submissions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-6 py-12 text-center text-sm text-muted-foreground">
        No submissions recorded for this problem yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-1">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-12 pl-4">#</TableHead>
            <TableHead>Result</TableHead>
            <TableHead className="hidden sm:table-cell">Language</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="w-24 pr-4 text-right">Code</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {submissions.map((sub, idx) => {
            const hasCode = !!sub.code?.trim();
            const isOpen = openId === sub._id;
            return (
              <Fragment key={sub._id}>
                <TableRow className={cn(isOpen && 'border-b-0 bg-surface-2')}>
                  <TableCell className="pl-4 tabular-nums text-subtle">{submissions.length - idx}</TableCell>
                  <TableCell><VerdictBadge verdict={sub.verdict} /></TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{languageLabel(sub.language)}</TableCell>
                  <TableCell className="text-muted-foreground" title={dateTime(sub.submittedAt)}>
                    {relativeTime(sub.submittedAt)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {hasCode ? (
                      <button
                        type="button"
                        onClick={() => setOpenId(isOpen ? null : sub._id)}
                        aria-expanded={isOpen}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        {isOpen ? 'Hide' : 'View'}
                        <ChevronDown className={cn('size-3.5 transition-transform', isOpen && 'rotate-180')} />
                      </button>
                    ) : (
                      <span className="text-xs text-subtle">—</span>
                    )}
                  </TableCell>
                </TableRow>
                {isOpen && hasCode && (
                  <TableRow className="bg-surface-2 hover:bg-surface-2">
                    <TableCell colSpan={5} className="px-4 pb-4 pt-0 whitespace-normal">
                      {/* w-0 + min-w-full: the code scrolls inside its box instead of widening the table */}
                      <div className="w-0 min-w-full">
                        <CodeBlock code={sub.code!} language={sub.language} maxHeight="max-h-96" />
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
