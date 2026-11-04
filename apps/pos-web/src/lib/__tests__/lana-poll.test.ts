import { describe, expect, it } from 'vitest';
import {
  POLL_FAILURE_LIMIT,
  canGenerateNewQr,
  interpretPoll,
  reduceCancel,
  type LanaScreen,
  type PollReading,
  type PollStep,
} from '../lana-poll';
import { TRANSLATIONS } from '../i18n';

const FAIL: PollReading = { ok: false };
const PENDING: PollReading = { ok: true, status: 'pending' };

/** Feed a sequence of readings through interpretPoll the way the modal does. */
function run(readings: PollReading[]): PollStep[] {
  let failures = 0;
  return readings.map((r) => {
    const step = interpretPoll(failures, r);
    failures = step.failures;
    return step;
  });
}

describe('status polling after a QR is on screen', () => {
  it('the limit is 3 consecutive failures', () => {
    expect(POLL_FAILURE_LIMIT).toBe(3);
  });

  it('1 and 2 failures change nothing; the 3rd says "unknown", not "expired" and not "error"', () => {
    const steps = run([FAIL, FAIL, FAIL]);
    expect(steps.map((s) => s.screen)).toEqual(['unchanged', 'unchanged', 'unknown']);
  });

  it('polling goes on after the 3rd failure: further failures stay unknown, they never become something else', () => {
    const steps = run([FAIL, FAIL, FAIL, FAIL, FAIL, FAIL]);
    expect(steps.slice(2).map((s) => s.screen)).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
  });

  it('one good "pending" answer brings the QR screen back and resets the count', () => {
    const steps = run([FAIL, FAIL, FAIL, PENDING, FAIL, FAIL]);
    expect(steps[3]).toEqual({ screen: 'waiting', failures: 0 });
    expect(steps[4]!.screen).toBe('unchanged'); // a fresh count: 1 failure is not "unknown"
    expect(steps[5]!.screen).toBe('unchanged');
  });

  it('a payment that arrives while the status was unknown is still detected', () => {
    const steps = run([FAIL, FAIL, FAIL, FAIL, { ok: true, status: 'paid' }]);
    expect(steps[2]!.screen).toBe('unknown');
    expect(steps[4]!.screen).toBe('paid');
  });

  it('only the server can say "expired"; failures never do', () => {
    expect(interpretPoll(0, { ok: true, status: 'expired' }).screen).toBe('expired');
    for (let n = 0; n < 20; n++) expect(interpretPoll(n, FAIL).screen).not.toBe('expired');
  });

  it('an unrecognised status is treated as still waiting', () => {
    expect(interpretPoll(2, { ok: true, status: 'something-new' }).screen).toBe('waiting');
  });
});

describe('a new QR code is only offered when no earlier one could still be paid', () => {
  const ALL: LanaScreen[] = ['IDLE', 'GENERATING', 'QR_DISPLAY', 'STATUS_UNKNOWN', 'PAID', 'PAID_UNSAVED', 'SUCCESS', 'EXPIRED', 'ERROR'];

  it('never on the unknown-status screen, whatever else is true', () => {
    expect(canGenerateNewQr('STATUS_UNKNOWN', true)).toBe(false);
    expect(canGenerateNewQr('STATUS_UNKNOWN', false)).toBe(false);
  });

  it('never while a QR is showing, while paid, or while a paid sale is unsaved', () => {
    for (const s of ['GENERATING', 'QR_DISPLAY', 'PAID', 'PAID_UNSAVED', 'SUCCESS'] as const) {
      expect(canGenerateNewQr(s, true), s).toBe(false);
      expect(canGenerateNewQr(s, false), s).toBe(false);
    }
  });

  it('yes at the start and after the server confirmed expiry', () => {
    expect(canGenerateNewQr('IDLE', false)).toBe(true);
    expect(canGenerateNewQr('EXPIRED', true)).toBe(true);
  });

  it('after an error only if no session exists (an initiate that produced no QR)', () => {
    expect(canGenerateNewQr('ERROR', false)).toBe(true);
    expect(canGenerateNewQr('ERROR', true)).toBe(false);
  });

  it('exactly three screens can ever offer it', () => {
    expect(ALL.filter((s) => canGenerateNewQr(s, false))).toEqual(['IDLE', 'EXPIRED', 'ERROR']);
  });
});

describe('cancelling while the status is unknown needs a manager PIN', () => {
  it('asking only opens the PIN prompt', () => {
    expect(reduceCancel('none', 'REQUEST')).toBe('pin');
  });

  it('DONE and AUTHORIZED cannot skip the PIN step', () => {
    expect(reduceCancel('none', 'DONE')).toBe('none');
    expect(reduceCancel('none', 'AUTHORIZED')).toBe('none');
    expect(reduceCancel('pin', 'DONE')).toBe('pin');
    expect(reduceCancel('pin', 'REQUEST')).toBe('pin');
  });

  it('a cancelled or wrong PIN goes back to the status screen, nothing is closed', () => {
    expect(reduceCancel('pin', 'CANCELLED')).toBe('none');
  });

  it('only an accepted PIN then DONE leaves', () => {
    let step = reduceCancel('none', 'REQUEST');
    step = reduceCancel(step, 'AUTHORIZED');
    expect(step).toBe('authorized');
    expect(reduceCancel(step, 'REQUEST')).toBe('authorized');
    expect(reduceCancel(step, 'DONE')).toBe('closed');
  });
});

describe('the unknown-status wording', () => {
  const keys = [
    'unknownTitle', 'unknownBody', 'checkStatus', 'unknownStillUnreachable',
    'cancelWithPin', 'unknownVoidTitle', 'unknownVoidBody',
  ] as const;
  const clearCart = /clear the cart|empty the cart|start a new sale|videz le panier|vider le panier|nouvelle vente|تفريغ السلة|ابدأ عملية جديدة/i;

  it('exists in ar, fr and en, and never tells the cashier to clear the cart', () => {
    for (const lang of ['ar', 'fr', 'en'] as const) {
      for (const k of keys) {
        const text = TRANSLATIONS[lang].lana[k];
        expect(text, `${lang}.lana.${k}`).toBeTruthy();
        expect(clearCart.test(text), `${lang}.lana.${k}: "${text}"`).toBe(false);
      }
    }
  });

  it('the main message tells the cashier not to generate a new QR code', () => {
    expect(TRANSLATIONS.en.lana.unknownBody).toMatch(/do not generate a new QR/i);
    expect(TRANSLATIONS.fr.lana.unknownBody).toMatch(/ne générez pas de nouveau QR/i);
    expect(TRANSLATIONS.ar.lana.unknownBody).toContain('لا تنشئ رمز QR جديداً');
  });

  it('the void instructions carry the {ref} and {amount} placeholders', () => {
    for (const lang of ['ar', 'fr', 'en'] as const) {
      expect(TRANSLATIONS[lang].lana.unknownVoidBody).toContain('{ref}');
      expect(TRANSLATIONS[lang].lana.unknownVoidBody).toContain('{amount}');
    }
  });
});
