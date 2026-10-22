/**
 * The email port — Wave 1 of the unblock.
 *
 * Delivery sits behind this interface so nothing that enqueues a
 * notification learns which vendor sent it. The user has no provider
 * contracted; the architecture must survive that changing, because an
 * adapter written against an imagined API gets rewritten against a real
 * contract — the same reasoning as `screening-provider.ts`.
 *
 * Two rules every implementation keeps:
 *
 *  - A message is rendered server-side from a template, never stored
 *    verbatim. Storing what was sent (rather than the template name plus
 *    its inputs) is how a templated notification becomes a place to keep
 *    user content — which is how secrets land in a table whose whole job
 *    is to be listed by an operator.
 *  - Absence of an answer is an error, never a success. A transport that
 *    cannot reach its provider throws `DeliveryUnavailableError`; it does
 *    not return a message id, because the dispatch job treats a message id
 *    as proof of delivery.
 */

/** What the transport needs to render and send one message. */
export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
}

/** What a successful send hands back. A message id is proof the provider
 *  accepted the message — and only that. It says nothing about delivery. */
export interface SentEmail {
  providerMsgId: string | null;
}

/** The provider could not be reached or refused. The dispatch job treats
 *  this as "unknown", which retries — it is never mapped to a delivery. */
export class DeliveryUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeliveryUnavailableError';
  }
}

/** The DI token. Same shape as `SCREENING_PROVIDER` and `JOBS`: the services
 *  take the token, not each implementation, so a new transport is one entry
 *  in the module factory. */
export const EMAIL_TRANSPORT = 'correnthian:email-transport';

/**
 * The port. `name` is what lands in the run detail, so an operator reading
 * the job's last run learns which transport the run used.
 */
export abstract class EmailTransport {
  abstract readonly name: string;
  /** Rendered already — see the module header. The transport sends, it
   *  never templates. */
  abstract send(message: OutgoingEmail): Promise<SentEmail>;
  /** Whether this transport can reach its provider right now. The dispatch
   *  job asks this before claiming a batch, because claiming rows the job
   *  cannot send leases work it will abandon. */
  abstract isAvailable(): Promise<boolean>;
}

/** A rendered message from a template name and its inputs. Templates live
 *  beside the transport, because the callers that enqueue know template
 *  names and nothing else — the rendering rules have one home. */
export interface RenderedNotification {
  subject: string;
  text: string;
}

/**
 * What every notification template renders.
 *
 * The platform tells people what it did, in plain text. No markup, no
 * tracked links, no layout — a templated email is a statement, and anything
 * richer is a surface that grows a credential or a tracker by accident.
 */
const TEMPLATE_SUBJECTS: Record<string, string> = {
  // The operator welcomed someone to the console before the invite existed.
  // The console wrote the row; this will be the transport that sends it.
  'operator.welcome': 'You now have access to the Correnthian operations console',
  // Magic links and password resets, built on this same transport (§BE-203).
  'auth.magic-link': 'Sign in to Correnthian',
  'auth.password-reset': 'Reset your Correnthian password',
  // Screening decisions, sent when a human decides.
  'kyc.approved': 'Your Correnthian verification is complete',
  'kyc.declined': 'Your Correnthian verification needs attention',
  'kyc.needs-review': 'Your Correnthian verification is under review',
};

/**
 * Render a template to the message the transport sends.
 *
 * Unknown templates throw. A notification with a template name nobody owns
 * is content nobody wrote, and sending it would be sending whatever the
 * payload happened to contain, formatted by a lying subject line.
 *
 * The inputs are deliberately narrow: a first name (or an email), and —
 * for the links — a single URL the caller built. The transport hands the
 * URL through verbatim; it does not construct it, because a transport that
 * knows the console's address knows the deployment.
 */
export function renderNotification(
  template: string,
  input: { name?: string; link?: string },
): RenderedNotification {
  const subject = TEMPLATE_SUBJECTS[template];
  if (!subject) {
    throw new Error(`Unknown notification template: ${template}`);
  }
  const name = input.name ?? 'there';

  switch (template) {
    case 'operator.welcome':
      return {
        subject,
        text:
          `Hello ${name},\n\n` +
          `You now have access to the Correnthian operations console.\n\n` +
          `Sign in with the account this message was sent to.\n`,
      };
    case 'auth.magic-link':
      return {
        subject,
        text:
          `Hello ${name},\n\n` +
          `Sign in with this link. It works once and expires in 15 minutes.\n\n` +
          `${input.link ?? ''}\n\n` +
          `If you did not ask for this, ignore it — no account will change.\n`,
      };
    case 'auth.password-reset':
      return {
        subject,
        text:
          `Hello ${name},\n\n` +
          `Reset your password with this link. It works once and expires in 60 minutes.\n\n` +
          `${input.link ?? ''}\n\n` +
          `If you did not ask for this, ignore it — your password is unchanged.\n`,
      };
    case 'kyc.approved':
      return {
        subject,
        text:
          `Hello ${name},\n\n` +
          `Your verification is complete. You can now use Correnthian's fiat services.\n`,
      };
    case 'kyc.declined':
    case 'kyc.needs-review':
      return {
        subject,
        text:
          `Hello ${name},\n\n` +
          `Your verification needs attention. Sign in to see what is required.\n`,
      };
    default:
      // Unreachable: the lookup above throws for unknown templates. The
      // switch exists so a new template is a new case, visibly.
      throw new Error(`Unknown notification template: ${template}`);
  }
}
