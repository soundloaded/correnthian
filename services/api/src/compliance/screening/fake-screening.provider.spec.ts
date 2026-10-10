import { describe, expect, it } from 'vitest';
import { FakeScreeningProvider } from './fake-screening.provider.js';

/**
 * The fake behind the ScreeningProvider port.
 *
 * Two properties the real adapters cannot give a test: scripted verdicts per
 * user, and a default that throws. The default matters more than it looks —
 * an unscripted fake that returned "clean" would make every gate test pass
 * while proving the gate lets an unexamined user through. Fail-closed is a
 * property of the fake too, not just of production.
 */
describe('FakeScreeningProvider', () => {
  it('throws when nothing was scripted for the user', async () => {
    const fake = new FakeScreeningProvider();
    await expect(fake.createInquiry('u1')).rejects.toThrow(/no scripted/i);
    await expect(fake.rescreen('u1')).rejects.toThrow(/no scripted/i);
  });

  it('returns one live inquiry per user rather than a new one per call', async () => {
    const fake = new FakeScreeningProvider();
    fake.scriptCreate('u1', { inquiryId: 'inq-1', sessionToken: 'sess-1' });
    const first = await fake.createInquiry('u1');
    const second = await fake.createInquiry('u1');
    expect(first.inquiryId).toBe('inq-1');
    expect(second.inquiryId).toBe('inq-1');
    expect(fake.calls.createInquiry).toHaveLength(2);
  });

  it('plays back scripted verdicts and screenings per user', async () => {
    const fake = new FakeScreeningProvider();
    fake.scriptCreate('u1', { inquiryId: 'inq-1', sessionToken: 'sess-1' });
    fake.scriptScreen('u1', 'clean');

    expect((await fake.createInquiry('u1')).sessionToken).toBe('sess-1');
    expect(await fake.rescreen('u1')).toMatchObject({ result: 'clean' });
    expect((await fake.rescreen('u1')).screenedAt).toBeInstanceOf(Date);
  });

  it('verifies nothing and parses nothing: the fake is not a signature oracle', () => {
    const fake = new FakeScreeningProvider();
    expect(fake.verifyWebhookSignature(Buffer.from('{}'), 'anything')).toBe(false);
    expect(() => fake.parseWebhookEvent({})).toThrow(/fake/i);
  });
});
