import { Injectable } from '@nestjs/common';

/**
 * The clock, as a dependency rather than as `new Date()`.
 *
 * Every decision a scheduled job makes is a comparison against time: is this
 * quote past its `expiresAt`, is this price older than the staleness window,
 * has this job's interval elapsed. If those comparisons reach for the wall
 * clock directly, the only way to test them is to sleep — and a suite that
 * sleeps is a suite that goes red on a loaded CI box for reasons that have
 * nothing to do with the code under test.
 *
 * So the clock is injected. A deployment gets `SystemClock`; a test gets a
 * clock it moves by hand and can assert against exactly.
 */
export interface Clock {
  now(): Date;
}

/**
 * The token Nest resolves.
 *
 * A string rather than the interface, because an interface is erased at
 * compile time and there is nothing left to use as a key.
 */
export const CLOCK = 'correnthian:clock';

@Injectable()
export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}
