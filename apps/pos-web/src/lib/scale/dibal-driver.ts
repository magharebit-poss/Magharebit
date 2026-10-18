/**
 * DIBAL D-900 / D-POS serial protocol driver.
 * Baud: 9600, Data: 8, Parity: None, Stop: 1
 * Output format (continuous):
 *   "ST,GS,+00.350kg\r\n"  — stable, gross weight
 *   "US,GS,+00.350kg\r\n"  — unstable
 *   "ST,NT,+00.350kg\r\n"  — stable, net (after tare)
 *   "ST,GS,+00.000kg\r\n"  — zero / empty
 */

export interface ScaleReading {
  weight: number;   // in kg, always positive
  stable: boolean;
  net: boolean;     // true = tare applied
  zero: boolean;    // true = weight is 0.000
  raw: string;
}

export function parseDibalFrame(
  line: string
): ScaleReading | null {
  // Normalize: trim whitespace and CR/LF
  const s = line.trim();
  // Expected: "ST,GS,+00.350kg" or "US,NT,-00.000kg"
  const match = s.match(
    /^(ST|US),(GS|NT),([+-]\d+\.\d+)kg$/i
  );
  if (!match) return null;

  const stable  = match[1].toUpperCase() === 'ST';
  const net     = match[2].toUpperCase() === 'NT';
  const weight  = Math.abs(parseFloat(match[3]));
  const zero    = weight < 0.001;

  return { weight, stable, net, zero, raw: s };
}

// Brecknell B140 uses same format at 4800 baud
export const SCALE_PROFILES = {
  'dibal-d900': {
    label:    'Dibal D-900 / D-POS',
    baudRate: 9600,
    dataBits: 8 as const,
    parity:   'none' as const,
    stopBits: 1 as const,
  },
  'brecknell-b140': {
    label:    'Brecknell B140',
    baudRate: 4800,
    dataBits: 8 as const,
    parity:   'none' as const,
    stopBits: 1 as const,
  },
} as const;

export type ScaleProfileKey = keyof typeof SCALE_PROFILES;
