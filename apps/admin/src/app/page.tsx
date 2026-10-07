import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

/**
 * `/` has no content of its own; it sends the operator to the console.
 * The dashboard layout owns the session guard, so an unauthenticated visit
 * falls through to /login from there. Landing on a bare 404 instead made the
 * whole console look unbuilt.
 */
export default async function Home() {
  const session = await getSession();
  redirect(session ? '/dashboard' : '/login');
}
