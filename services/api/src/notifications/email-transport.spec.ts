import { describe, expect, it } from 'vitest';
import { renderNotification } from './email-transport.js';

/**
 * The port's template contract. Rendering lives in one place so every caller
 * that enqueues a name and a link gets the same message, and the transport
 * never has to know what a "magic link" says.
 */
describe('email templates', () => {
  it('renders the magic link with the caller-built URL', () => {
    const out = renderNotification('auth.magic-link', {
      name: 'Ada',
      link: 'https://web.example/magic?token=abc',
    });
    expect(out.subject).toContain('Sign in');
    expect(out.text).toContain('Ada');
    expect(out.text).toContain('https://web.example/magic?token=abc');
    expect(out.text).toContain('15 minutes');
  });

  it('renders the password reset with its longer window', () => {
    const out = renderNotification('auth.password-reset', {
      name: 'Ada',
      link: 'https://web.example/reset?token=abc',
    });
    expect(out.text).toContain('60 minutes');
  });

  it('falls back to a greeting when the name is absent', () => {
    const out = renderNotification('kyc.approved', {});
    expect(out.text).toContain('there');
  });

  it('refuses an unknown template rather than sending arbitrary content', () => {
    expect(() => renderNotification('billing.invoice', {})).toThrow(
      'Unknown notification template',
    );
  });
});
