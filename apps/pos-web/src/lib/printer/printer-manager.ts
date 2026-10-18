// Web USB thermal printer manager — USB class 7 (printers), 80mm ESC/POS

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface PrinterState {
  device: USBDevice;
  endpointOut: number;
  interfaceNumber: number;
}

let state: PrinterState | null = null;
let statusListeners: Array<(s: PrinterStatus) => void> = [];

function emit(s: PrinterStatus) {
  for (const fn of statusListeners) fn(s);
}

export function onStatusChange(fn: (s: PrinterStatus) => void): () => void {
  statusListeners.push(fn);
  return () => { statusListeners = statusListeners.filter((f) => f !== fn); };
}

export function getStatus(): PrinterStatus {
  return state ? 'connected' : 'disconnected';
}

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/** Prompt the user to select a USB printer and claim its interface. */
export async function connectPrinter(): Promise<void> {
  if (!isWebUsbSupported()) throw new Error('WebUSB not supported in this browser.');

  emit('connecting');
  try {
    const device = await navigator.usb.requestDevice({
      filters: [{ classCode: 7 }], // Printer class
    });
    await device.open();

    // Select configuration 1 if not already selected
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find the first bulk-OUT endpoint on any interface
    let interfaceNumber = -1;
    let endpointOut = -1;

    for (const iface of device.configuration!.interfaces) {
      for (const alt of iface.alternates) {
        for (const ep of alt.endpoints) {
          if (ep.type === 'bulk' && ep.direction === 'out') {
            interfaceNumber = iface.interfaceNumber;
            endpointOut = ep.endpointNumber;
            break;
          }
        }
        if (endpointOut !== -1) break;
      }
      if (endpointOut !== -1) break;
    }

    if (endpointOut === -1) throw new Error('No bulk-OUT endpoint found on printer.');

    await device.claimInterface(interfaceNumber);

    state = { device, endpointOut, interfaceNumber };
    emit('connected');
  } catch (err) {
    state = null;
    emit('disconnected');
    throw err;
  }
}

export async function disconnectPrinter(): Promise<void> {
  if (!state) return;
  try {
    await state.device.releaseInterface(state.interfaceNumber);
    await state.device.close();
  } finally {
    state = null;
    emit('disconnected');
  }
}

/** Send raw ESC/POS bytes to the printer in 64-byte chunks. */
export async function printData(data: Uint8Array): Promise<void> {
  if (!state) throw new Error('Printer not connected.');

  const CHUNK = 64;
  for (let offset = 0; offset < data.length; offset += CHUNK) {
    const chunk = data.slice(offset, offset + CHUNK);
    const result = await state.device.transferOut(state.endpointOut, chunk);
    if (result.status !== 'ok') {
      throw new Error(`USB transfer failed at offset ${offset}: ${result.status}`);
    }
  }
}
