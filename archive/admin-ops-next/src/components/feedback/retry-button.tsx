'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Server components cannot "retry" on their own — a refetch means re-running
 * the render on the server. This re-executes the route.
 */
export function RetryButton({ label = 'Retry' }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      <RefreshCw className={`size-4 ${pending ? 'animate-spin' : ''}`} aria-hidden />
      {pending ? 'Retrying' : label}
    </Button>
  );
}
