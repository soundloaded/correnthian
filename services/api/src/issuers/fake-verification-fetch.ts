/**
 * The scripted stand-in behind the proof-URL port.
 *
 * Fail-closed by construction, like every other fake in this repository: a
 * URL that was not explicitly scripted does not answer. A test that forgot
 * to script its proof URL gets a failed check — "unreachable" — rather
 * than a passed one, which is the only safe direction for a check whose
 * whole job is to be sceptical.
 *
 * It exists because a verification that fetches cannot be tested against
 * the real internet. A suite that reached out to a custodian's page would
 * be asserting that the internet works, not that the workflow does.
 */
export class FakeVerificationFetch {
  private readonly answering = new Set<string>();

  /** The URLs that answer, with the status they answer with. */
  private readonly statuses = new Map<string, number>();

  /** Script a URL as reachable. */
  live(url: string, status = 200): this {
    this.answering.add(url);
    this.statuses.set(url, status);
    return this;
  }

  /** Script a URL as reachable but answering with an error status. */
  erroring(url: string, status: number): this {
    this.answering.add(url);
    this.statuses.set(url, status);
    return this;
  }

  /** Every URL this fake was asked about, in order. */
  readonly asked: string[] = [];

  readonly fetch = async (url: string): Promise<{ ok: boolean; status: number }> => {
    this.asked.push(url);
    const status = this.statuses.get(url) ?? 200;
    if (!this.answering.has(url)) {
      // Not scripted: the page does not answer. Reported as unreachable
      // rather than as a 404, because a test asked about a URL it never
      // told this fake about — that is a dead link, not a wrong status.
      return { ok: false, status: 404 };
    }
    return { ok: status >= 200 && status < 300, status };
  };
}
