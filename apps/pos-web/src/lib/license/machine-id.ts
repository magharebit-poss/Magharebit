const STORAGE_KEY = 'mgh_machine_id';

async function generateMachineId(): Promise<string> {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#2E8B57';
      ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = '#F0B429';
      ctx.font = '14px Arial';
      ctx.fillText('MGH_DEVICE_FP', 10, 30);
    }
    const canvasData = canvas.toDataURL().slice(-80);

    const raw = [
      canvasData,
      String(screen.width),
      String(screen.height),
      String(screen.colorDepth),
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      String(navigator.hardwareConcurrency ?? 0),
      navigator.platform ?? '',
    ].join('|||');

    const encoded = new TextEncoder().encode(raw);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 40);
  } catch {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 40);
  }
}

export async function getMachineId(): Promise<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && stored.length === 40) return stored;
    const id = await generateMachineId();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return generateMachineId();
  }
}
