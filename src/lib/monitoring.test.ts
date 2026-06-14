/* ============================================================
   monitoring.scrubEvent — proves the beforeSend ALLOWLIST keeps only the
   error type/message/stack-frame locations (+ our error_id tag) and DROPS
   everything that could carry client data (request URL, user, contexts,
   extra, breadcrumbs, server name, the top-level message, frame locals).
   ============================================================ */
import { describe, expect, it } from 'vitest';
import type { ErrorEvent } from '@sentry/react';
import { scrubEvent } from './monitoring';

describe('scrubEvent', () => {
  it('keeps only error type/message/stack + the error_id tag', () => {
    const event = {
      type: undefined,
      event_id: 'abc123',
      timestamp: 1718000000,
      level: 'error',
      message: 'DROP ME — could contain a client name',
      request: { url: 'https://app/clients/acme', headers: { cookie: 'session=secret' } },
      user: { email: 'jane@client.com', id: 'u-1', ip_address: '1.2.3.4' },
      contexts: { state: { intakeNotes: 'CUI-adjacent free text' } },
      extra: { secret: 'value' },
      breadcrumbs: [{ message: 'navigated to /clients/acme' }],
      server_name: 'host-name',
      tags: { error_id: 'E1234567', other: 'drop-me' },
      exception: {
        values: [
          {
            type: 'TypeError',
            value: 'x is not a function',
            mechanism: { handled: false, type: 'generic' },
            stacktrace: {
              frames: [
                {
                  filename: 'app.js',
                  function: 'doThing',
                  lineno: 10,
                  colno: 2,
                  in_app: true,
                  // these MUST be stripped — local vars + source context can leak data
                  vars: { email: 'jane@client.com' },
                  context_line: 'const x = clientSecret',
                  pre_context: ['line above'],
                },
              ],
            },
          },
        ],
      },
    } as unknown as ErrorEvent;

    const scrubbed = scrubEvent(event) as unknown as Record<string, unknown>;
    const values = (scrubbed.exception as { values: Record<string, unknown>[] }).values;
    const frame = (values[0].stacktrace as { frames: Record<string, unknown>[] }).frames[0];

    // kept
    expect(scrubbed.event_id).toBe('abc123');
    expect(scrubbed.level).toBe('error');
    expect(values[0].type).toBe('TypeError');
    expect(values[0].value).toBe('x is not a function');
    expect(frame).toEqual({ filename: 'app.js', function: 'doThing', lineno: 10, colno: 2, in_app: true });
    expect(scrubbed.tags).toEqual({ error_id: 'E1234567' });

    // dropped — anything that can carry client / user data
    expect(scrubbed.message).toBeUndefined();
    expect(scrubbed.request).toBeUndefined();
    expect(scrubbed.user).toBeUndefined();
    expect(scrubbed.contexts).toBeUndefined();
    expect(scrubbed.extra).toBeUndefined();
    expect(scrubbed.breadcrumbs).toBeUndefined();
    expect(scrubbed.server_name).toBeUndefined();
    expect(frame.vars).toBeUndefined();
    expect(frame.context_line).toBeUndefined();
    expect(frame.pre_context).toBeUndefined();
  });

  it('drops the tags object entirely when there is no error_id', () => {
    const scrubbed = scrubEvent({ type: undefined, tags: { foo: 'bar' } } as unknown as ErrorEvent);
    expect(scrubbed.tags).toBeUndefined();
  });

  it('handles an event with no exception', () => {
    const scrubbed = scrubEvent({ type: undefined, event_id: 'x' } as unknown as ErrorEvent);
    expect(scrubbed.exception).toBeUndefined();
    expect(scrubbed.event_id).toBe('x');
  });
});
