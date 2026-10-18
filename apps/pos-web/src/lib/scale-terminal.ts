// scale-terminal.ts — TypeScript bridge to the Tauri scale_terminal Rust module.
// In browser dev mode (no Tauri), all functions return browser-friendly stubs
// so the scale UX can be developed and tested without a physical scale.
// In Tauri (desktop) mode, calls are forwarded to the Rust implementation via
// invoke(). The isTauri() guard means this file is safe to import in Next.js
// server-side contexts — the Tauri-specific paths never execute there.

import { invoke } from '@tauri-apps/api/core';

/** Returns true when running inside a Tauri window (desktop app). */
const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ── Request / Response types (mirror the Rust structs in scale_terminal.rs) ──

export interface ScaleConfig {
  scaleId: string;
  port: string;
  baudRate: number;
  timeoutMs: number;
}

export interface WeightReading {
  grams: number;
  stable: boolean;
  raw: string;
  scaleId: string;
  readAt: string;
}

export type ScaleResponse =
  | { status: 'Connected'; scale_id: string; port: string }
  | { status: 'Disconnected' }
  | {
      status: 'Reading';
      grams: number;
      stable: boolean;
      raw: string;
      scale_id: string;
      read_at: string;
    }
  | { status: 'Error'; message: string }
  | { status: 'Unstable'; grams: number };

// ── Bridge functions ─────────────────────────────────────────────────────────

/**
 * Connects to the scale on the configured serial port.
 *
 * In browser dev mode: simulates an 800 ms connect and returns Connected.
 * In Tauri mode: forwards to scale_terminal::scale_connect, which opens the
 * serial port and stores the handle in module state.
 */
export async function scaleConnect(config: ScaleConfig): Promise<ScaleResponse> {
  if (!isTauri()) {
    await new Promise<void>((r) => setTimeout(r, 800));
    return { status: 'Connected', scale_id: config.scaleId, port: config.port };
  }
  return invoke<ScaleResponse>('scale_connect', { config });
}

/**
 * Reads the current weight from the connected scale.
 *
 * In browser dev mode: returns a simulated stable 1250 g reading so the
 * weight-to-cart flow can be tested end-to-end without hardware.
 * In Tauri mode: forwards to scale_terminal::scale_read_weight.
 */
export async function scaleReadWeight(scaleId: string): Promise<ScaleResponse> {
  if (!isTauri()) {
    await new Promise<void>((r) => setTimeout(r, 300));
    return {
      status: 'Reading',
      grams: 1250,
      stable: true,
      raw: 'BROWSER-DEV',
      scale_id: scaleId,
      read_at: new Date().toISOString(),
    };
  }
  return invoke<ScaleResponse>('scale_read_weight', { scaleId });
}

/**
 * Closes the serial port connection.
 *
 * In browser dev mode: no-op (no port to close).
 * In Tauri mode: forwards to scale_terminal::scale_disconnect.
 */
export async function scaleDisconnect(scaleId: string): Promise<void> {
  if (!isTauri()) return;
  return invoke<void>('scale_disconnect', { scaleId });
}

/**
 * Checks whether the scale is connected and responsive.
 *
 * In browser dev mode: always returns false (no scale in browser).
 * In Tauri mode: forwards to scale_terminal::scale_status.
 */
export async function scaleStatus(scaleId: string): Promise<boolean> {
  if (!isTauri()) return false;
  return invoke<boolean>('scale_status', { scaleId });
}
