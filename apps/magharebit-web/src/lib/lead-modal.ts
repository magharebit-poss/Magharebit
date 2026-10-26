/** Opens the lead capture modal from anywhere in the browser (see LeadModalHost). */
export const LEAD_MODAL_EVENT = 'mgh:open-lead-modal';

export function openLeadModal(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LEAD_MODAL_EVENT));
}
