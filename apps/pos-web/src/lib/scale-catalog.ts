// scale-catalog.ts — Reference catalog of supported weighing scales.
//
// Pure data file: no API calls, no backend dependency. This is the single
// source of truth for which scale models the POS supports, how they connect,
// and whether a real driver is implemented (vs. a stub awaiting protocol work).
//
// To add a new scale driver later, add an entry here with
// driverStatus: 'available', implement its driver in scale_terminal.rs, and
// register a dispatch arm in scale_connect. Nothing else changes.

export type ConnectionMethod = 'rs232' | 'usb_hid' | 'tcp_ip';

export type DriverStatus =
  | 'available'   // driver implemented
  | 'stub'        // interface only, no protocol yet
  | 'coming_soon'; // planned

export type ScaleCategory =
  | 'retail_counter' // butcher, grocery counter
  | 'produce'        // fruit/veg, open market
  | 'industrial'     // warehouse, bulk
  | 'compact'        // cafe, small retail
  | 'hanging'        // meat hooks, fish
  | 'pos_integrated'; // built-in POS scale

export interface ScaleModel {
  id: string;           // unique slug e.g. "dibal-d900"
  brand: string;        // "DIBAL"
  model: string;        // "D-900 / D-POS"
  category: ScaleCategory;
  connectionMethods: ConnectionMethod[];
  driverStatus: DriverStatus;
  maxWeightKg: number;
  resolution: number;   // grams e.g. 1, 2, 5
  baudRate?: number;    // for RS-232: 9600, 4800
  protocol?: string;    // "DIBAL continuous"
  notes?: string;
}

export const SCALE_CATALOG: ScaleModel[] = [
  // ── DIBAL (Spanish, widely used in Morocco) ──
  {
    id: 'dibal-d900',
    brand: 'DIBAL',
    model: 'D-900 Series',
    category: 'retail_counter',
    connectionMethods: ['rs232'],
    driverStatus: 'available',
    maxWeightKg: 15,
    resolution: 1,
    baudRate: 9600,
    protocol: 'DIBAL continuous output',
    notes: 'Most common in Moroccan supermarkets',
  },
  {
    id: 'dibal-d-pos',
    brand: 'DIBAL',
    model: 'D-POS',
    category: 'pos_integrated',
    connectionMethods: ['rs232'],
    driverStatus: 'available',
    maxWeightKg: 30,
    resolution: 1,
    baudRate: 9600,
    protocol: 'DIBAL continuous output',
    notes: 'RS-232 weight transfer to POS, up to 30kg',
  },
  {
    id: 'dibal-m-525',
    brand: 'DIBAL',
    model: 'M-525',
    category: 'produce',
    connectionMethods: ['rs232'],
    driverStatus: 'stub',
    maxWeightKg: 6,
    resolution: 1,
    baudRate: 9600,
  },

  // ── Brecknell ──
  {
    id: 'brecknell-b140',
    brand: 'Brecknell',
    model: 'B140 Series',
    category: 'retail_counter',
    connectionMethods: ['rs232'],
    driverStatus: 'available',
    maxWeightKg: 15,
    resolution: 2,
    baudRate: 9600,
    protocol: 'Brecknell continuous RS-232',
    notes: 'Common in African retail markets',
  },
  {
    id: 'brecknell-c3200',
    brand: 'Brecknell',
    model: 'C3200 Series',
    category: 'compact',
    connectionMethods: ['rs232', 'usb_hid'],
    driverStatus: 'stub',
    maxWeightKg: 5,
    resolution: 1,
    baudRate: 9600,
  },

  // ── CAS (Korean, common in Morocco) ──
  {
    id: 'cas-sw-1',
    brand: 'CAS',
    model: 'SW-1 Series',
    category: 'retail_counter',
    connectionMethods: ['rs232'],
    driverStatus: 'stub',
    maxWeightKg: 15,
    resolution: 2,
    baudRate: 9600,
    notes: 'Driver available on request',
  },
  {
    id: 'cas-er-jr',
    brand: 'CAS',
    model: 'ER-Jr',
    category: 'compact',
    connectionMethods: ['rs232'],
    driverStatus: 'stub',
    maxWeightKg: 30,
    resolution: 5,
    baudRate: 9600,
  },

  // ── Mettler Toledo ──
  {
    id: 'mettler-bba462',
    brand: 'Mettler Toledo',
    model: 'BBA462 / ICS4',
    category: 'retail_counter',
    connectionMethods: ['rs232', 'tcp_ip'],
    driverStatus: 'stub',
    maxWeightKg: 15,
    resolution: 1,
    baudRate: 9600,
    notes: 'MT-SICS protocol — driver on request',
  },

  // ── A&D Weighing ──
  {
    id: 'and-fx-i',
    brand: 'A&D',
    model: 'FX-i Series',
    category: 'compact',
    connectionMethods: ['rs232', 'usb_hid'],
    driverStatus: 'stub',
    maxWeightKg: 3,
    resolution: 1,
    baudRate: 9600,
  },

  // ── Ohaus ──
  {
    id: 'ohaus-ranger',
    brand: 'Ohaus',
    model: 'Ranger 3000',
    category: 'retail_counter',
    connectionMethods: ['rs232'],
    driverStatus: 'stub',
    maxWeightKg: 15,
    resolution: 2,
    baudRate: 9600,
  },

  // ── Adam Equipment ──
  {
    id: 'adam-cbx',
    brand: 'Adam Equipment',
    model: 'CBX Series',
    category: 'retail_counter',
    connectionMethods: ['rs232'],
    driverStatus: 'stub',
    maxWeightKg: 15,
    resolution: 2,
    baudRate: 9600,
  },

  // ── Generic RS-232 ──
  {
    id: 'generic-rs232',
    brand: 'Generic',
    model: 'RS-232 Scale (custom baud)',
    category: 'retail_counter',
    connectionMethods: ['rs232'],
    driverStatus: 'stub',
    maxWeightKg: 30,
    resolution: 1,
    notes: 'For scales not listed — manual protocol config',
  },
];

/** Scales with a real implemented driver. */
export const availableScales = (): ScaleModel[] =>
  SCALE_CATALOG.filter((s) => s.driverStatus === 'available');

/** All scales that connect over RS-232. */
export const rs232Scales = (): ScaleModel[] =>
  SCALE_CATALOG.filter((s) => s.connectionMethods.includes('rs232'));

/** Lookup a single model by its catalog id. */
export const scaleById = (id: string): ScaleModel | undefined =>
  SCALE_CATALOG.find((s) => s.id === id);
