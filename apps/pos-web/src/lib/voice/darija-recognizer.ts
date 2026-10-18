/**
 * Darija / Arabic voice input for POS.
 * Uses the Web Speech API with a constrained grammar (no free dictation).
 *
 * Supported commands:
 *   PRODUCT: add [qty] [product name]
 *     e.g. "زيد جوج كابتشينو"
 *          "add two cappuccino"
 *          "ajoute deux café"
 *   TABLE:   table [number]
 *     e.g. "طاولة أربعة"
 *   CLEAR:   clear / امسح / effacer
 *   PAY:     pay / ادفع / payer
 *   CANCEL:  cancel / إلغاء / annuler
 *
 * The recognizer runs in continuous mode and restarts itself when the browser
 * ends a session. Parsed commands go to onCommand; anything it cannot parse is
 * delivered as { type: 'unknown' } so the UI can show what was heard.
 */

export type VoiceCommand =
  | { type: 'add_product'; query: string; qty: number }
  | { type: 'table'; number: number }
  | { type: 'clear' }
  | { type: 'pay' }
  | { type: 'cancel' }
  | { type: 'unknown'; raw: string };

export interface RecognizerOptions {
  // Chrome has no fr-MA speech locale, so French uses fr-FR.
  lang:        'ar-MA' | 'fr-FR' | 'en-US';
  onCommand:   (cmd: VoiceCommand) => void;
  onListening: (active: boolean) => void;
  onError:     (code: string) => void;
}

// The DOM lib does not ship Web Speech types, so describe the parts we use.
interface SpeechAlternativeLike { transcript: string }
interface SpeechResultLike { isFinal: boolean; [index: number]: SpeechAlternativeLike | undefined }
interface SpeechEventLike { resultIndex: number; results: ArrayLike<SpeechResultLike | undefined> }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isVoiceSupported(): boolean {
  return getCtor() !== null;
}

// Strip Latin accents and Arabic diacritics, unify hamza / alef-maqsura forms.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLowerCase();
}

function normalizeDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function buildWordMap(entries: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [word, n] of Object.entries(entries)) out[normalize(word)] = n;
  return out;
}

// Number words in Darija / Arabic, French and English (merged: speakers mix languages).
const NUMBER_WORDS = buildWordMap({
  'واحد': 1, 'وحدة': 1, 'واحدة': 1,
  'جوج': 2, 'اثنين': 2, 'اثنان': 2,
  'تلاتة': 3, 'ثلاثة': 3,
  'ربعة': 4, 'أربعة': 4,
  'خمسة': 5, 'ستة': 6,
  'سبعة': 7, 'ثمانية': 8,
  'تسعة': 9, 'عشرة': 10,
  'un': 1, 'une': 1, 'deux': 2, 'trois': 3,
  'quatre': 4, 'cinq': 5, 'six': 6,
  'sept': 7, 'huit': 8, 'neuf': 9, 'dix': 10,
  'one': 1, 'two': 2, 'three': 3, 'four': 4,
  'five': 5, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
});

const CLEAR_RE  = /^(امسح|امسحي|effacer|clear|vider)/;
const PAY_RE    = /^(ادفع|دفع|payer|pay|regler|caisse)/;
const CANCEL_RE = /^(الغاء|الغي|annuler|cancel|stop)/;
const TABLE_RE  = /^(?:طاولة|طاولت|table|mesa)\s+(\S+)/;
const ADD_WORD_RE = /^(زيد|زيدي|عطيني|اضف|add|ajoute|ajouter|mets)$/;

function numberFrom(word: string): number {
  const mapped = NUMBER_WORDS[word];
  return mapped !== undefined ? mapped : parseInt(word, 10);
}

function parseCommand(transcript: string): VoiceCommand {
  const words = normalizeDigits(transcript.trim()).split(/\s+/).filter(Boolean);
  if (words.length === 0) return { type: 'unknown', raw: transcript };

  const norm = words.map(normalize);
  const text = norm.join(' ');

  if (CLEAR_RE.test(text)) return { type: 'clear' };
  if (PAY_RE.test(text)) return { type: 'pay' };
  if (CANCEL_RE.test(text)) return { type: 'cancel' };

  const tableMatch = TABLE_RE.exec(text);
  if (tableMatch) {
    const n = numberFrom(tableMatch[1] ?? '');
    return Number.isNaN(n) ? { type: 'unknown', raw: transcript } : { type: 'table', number: n };
  }

  let start = ADD_WORD_RE.test(norm[0] ?? '') ? 1 : 0;
  let qty = 1;
  const qtyWord = norm[start];
  if (qtyWord !== undefined) {
    const n = numberFrom(qtyWord);
    if (!Number.isNaN(n) && n > 0 && n <= 99) {
      qty = n;
      start += 1;
    }
  }

  // The query keeps the original spelling so it matches product names in the database.
  const query = words.slice(start).join(' ');
  if (query) return { type: 'add_product', query, qty };
  return { type: 'unknown', raw: transcript };
}

const ERROR_CODES: Record<string, string> = {
  'audio-capture':       'voice_no_mic',
  'not-allowed':         'voice_permission',
  'service-not-allowed': 'voice_permission',
  'network':             'voice_network',
};

// Errors after which restarting would only loop.
const FATAL_ERRORS = new Set([
  'audio-capture', 'not-allowed', 'service-not-allowed', 'network', 'language-not-supported',
]);

export class DarijaRecognizer {
  private rec: SpeechRecognitionLike | null = null;
  private wantActive = false;
  private readonly opts: RecognizerOptions;

  constructor(opts: RecognizerOptions) {
    this.opts = opts;
  }

  get isSupported(): boolean {
    return isVoiceSupported();
  }

  start(): void {
    if (!this.isSupported) {
      this.opts.onError('voice_not_supported');
      return;
    }
    if (this.wantActive) return;
    this.wantActive = true;
    this.begin();
  }

  stop(): void {
    this.wantActive = false;
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      try { rec.stop(); } catch { /* ignore */ }
    }
    this.opts.onListening(false);
  }

  private begin(): void {
    const Ctor = getCtor();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = this.opts.lang;
    rec.continuous = true;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => this.opts.onListening(true);

    rec.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result || !result.isFinal) continue;
        const alt = result[0];
        if (alt) this.opts.onCommand(parseCommand(alt.transcript));
      }
    };

    rec.onerror = (event) => {
      // Silence in continuous mode is normal; onend restarts the session.
      if (event.error === 'no-speech' || event.error === 'aborted') return;
      this.opts.onError(ERROR_CODES[event.error] ?? 'voice_error');
      if (FATAL_ERRORS.has(event.error)) this.wantActive = false;
    };

    rec.onend = () => {
      if (this.rec !== rec) return;
      if (this.wantActive) {
        setTimeout(() => {
          if (!this.wantActive || this.rec !== rec) return;
          try { rec.start(); } catch { /* already started */ }
        }, 250);
        return;
      }
      this.rec = null;
      this.opts.onListening(false);
    };

    this.rec = rec;
    try {
      rec.start();
    } catch {
      this.wantActive = false;
      this.rec = null;
      this.opts.onError('voice_error');
    }
  }
}
