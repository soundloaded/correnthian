import Link from 'next/link';
import type { Contract } from '@correnthian/contracts';
import { apiFetch } from '@/lib/api-server';
import { ApiState } from '@/components/feedback/api-state';
import { PageTitle } from '@/components/layout/page-title';
import { ReviewActions } from '@/components/actions/review-actions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtDateTime } from '@/lib/format';

type ReviewList = Contract<'GET /api/v1/compliance/reviews'>;
type ReviewRow = ReviewList[number];

export const metadata = { title: 'Reviews · Correnthian admin' };
export const dynamic = 'force-dynamic';

const SANCTIONS_TONE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  clean: 'default',
  hit: 'destructive',
};

export default async function ReviewsPage() {
  const result = await apiFetch<ReviewList>('/compliance/reviews');

  return (
    <>
      <header>
        <PageTitle title="Reviews">
          Verifications parked for a human decision, oldest first. Approving
          clears a latched sanctions hit; rejecting keeps it. Either way, say
          why &mdash; a decision without a reason never fires.
        </PageTitle>
      </header>

      <ApiState
        result={result}
        emptyTitle="Review queue is clear"
        emptyDescription="Nothing is parked. New flags from verification or screening appear here."
        emptyWhen={(d) => d.length === 0}
        render={(d) => (
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>KYC</TableHead>
                    <TableHead>Sanctions</TableHead>
                    <TableHead>Waiting since</TableHead>
                    <TableHead>Decision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.map((r: ReviewRow) => (
                    <TableRow key={r.userId}>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/users/${r.userId}`} className="font-medium underline">
                          {r.email}
                        </Link>
                        <span className="block font-mono text-xs text-muted-foreground">
                          {r.providerRef ?? r.provider}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={SANCTIONS_TONE[r.sanctionsResult ?? ''] ?? 'secondary'}>
                          {r.sanctionsResult ?? 'unscreened'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs">
                        {fmtDateTime(r.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <ReviewActions userId={r.userId} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      />
    </>
  );
}
