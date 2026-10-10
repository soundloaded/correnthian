import { ScreeningProvider, ScreeningUnavailableError } from './screening-provider.js';
import type {
  CreatedInquiry, ParsedWebhookEvent, Screening, WatchlistResult,
} from './screening-provider.js';

/**
 * The scripted stand-in behind the ScreeningProvider port.
 *
 * Used by every test and by local development without vendor credentials.
 * Fail-closed by construction: anything not explicitly scripted throws
 * `ScreeningUnavailableError`, so a test that forgot to script its user
 * exercises the vendor-down path instead of silently passing on an
 * unexamined "clean".
 */
export class FakeScreeningProvider extends ScreeningProvider {
  readonly name = 'fake';

  private readonly inquiries = new Map<string, CreatedInquiry>();
  private readonly screens = new Map<string, WatchlistResult>();
  readonly calls: { createInquiry: string[]; rescreen: string[] } = {
    createInquiry: [],
    rescreen: [],
  };

  scriptCreate(userId: string, inquiry: CreatedInquiry): void {
    this.inquiries.set(userId, inquiry);
  }

  scriptScreen(userId: string, result: WatchlistResult): void {
    this.screens.set(userId, result);
  }

  async createInquiry(userId: string): Promise<CreatedInquiry> {
    this.calls.createInquiry.push(userId);
    const existing = this.inquiries.get(userId);
    if (!existing) {
      throw new ScreeningUnavailableError(`no scripted inquiry for user ${userId}`);
    }
    return existing;
  }

  async rescreen(userId: string): Promise<Screening> {
    this.calls.rescreen.push(userId);
    const result = this.screens.get(userId);
    if (!result) {
      throw new ScreeningUnavailableError(`no scripted screening for user ${userId}`);
    }
    return { result, screenedAt: new Date() };
  }

  verifyWebhookSignature(_rawBody: Buffer, _signature: string): boolean {
    // The fake never speaks for a signature. Webhook authenticity tests
    // belong to the vendor adapter, which is the only code that verifies.
    return false;
  }

  parseWebhookEvent(_body: unknown): ParsedWebhookEvent {
    throw new ScreeningUnavailableError('the fake parses no webhook events');
  }
}
