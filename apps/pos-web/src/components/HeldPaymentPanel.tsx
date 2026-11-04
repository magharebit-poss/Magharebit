'use client';

// Screen for a payment whose money was taken but whose sale was not saved. Shared by the card and Lana
// modals. Retry saving re-posts the held sale; cancel-and-void needs a manager PIN (audited by the
// server) and then shows the provider reference so the payment can be voided or refunded by hand.

import { formatPrice } from '../lib/cart';
import {
  saveErrorText,
  type ApprovalEvent,
  type ApprovalState,
} from '../lib/card-approval';
import ManagerPinModal from './ManagerPinModal';

export interface HeldPaymentLabels {
  unsavedTitle: string;
  unsavedBody: string;
  unsavedCloseWarning: string;
  retrySaving: string;
  cancelAndVoid: string;
  voidTitle: string;
  /** {ref} and {amount} placeholders. */
  voidBody: string;
  voidDone: string;
  saveErrorConflict: string;
  saveErrorInvalid: string;
  /** {n} = HTTP status. */
  saveErrorServer: string;
  saveErrorNetwork: string;
}

interface Props {
  state: ApprovalState;
  saving: boolean;
  labels: HeldPaymentLabels;
  /** "Code:" for a card approval, "Session:" for Lana. */
  referenceLabel: string;
  processingLabel: string;
  /** The audited action name, e.g. card_approval_void. */
  voidAction: string;
  voidNote: string;
  clientTxId: string;
  onRetry: () => void;
  dispatch: (e: ApprovalEvent) => void;
  /** Leaves the modal. The cart is untouched by this component. */
  onClose: () => void;
}

export default function HeldPaymentPanel({
  state,
  saving,
  labels,
  referenceLabel,
  processingLabel,
  voidAction,
  voidNote,
  clientTxId,
  onRetry,
  dispatch,
  onClose,
}: Props) {
  const approval = state.approval;
  if (!approval) return null;

  if (state.step === 'void_authorized') {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base font-bold text-[#0F172A] text-center">{labels.voidTitle}</p>
        <p className="text-sm text-[#0F172A] text-center">
          {labels.voidBody
            .replace('{ref}', approval.code)
            .replace('{amount}', formatPrice(approval.amountPiastres))}
        </p>
        <p className="text-2xl text-[#0F172A] text-center font-mono font-bold" dir="ltr">
          {approval.code}
        </p>
        <button
          onClick={() => { dispatch({ type: 'DONE' }); onClose(); }}
          className="w-full bg-[#1A5276] hover:bg-[#154360] text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {labels.voidDone}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-[#FFF8E1] border border-[#F0B429] p-3 text-center">
        <p className="text-base font-bold text-[#8A5A00]">{labels.unsavedTitle}</p>
        <p className="text-sm text-[#8A5A00] mt-1">{labels.unsavedBody}</p>
      </div>
      <p className="text-sm text-[#0F172A] text-center font-mono" dir="ltr">
        {referenceLabel} {approval.code}
      </p>
      {state.error && (
        <p
          role="alert"
          className="text-sm font-semibold text-[#D32F2F] bg-red-50 border border-red-200 rounded-lg p-3 text-center"
        >
          {saveErrorText(state.error, {
            conflict: labels.saveErrorConflict,
            invalid: labels.saveErrorInvalid,
            server: labels.saveErrorServer,
            network: labels.saveErrorNetwork,
          })}
        </p>
      )}
      <p className="text-xs text-[#64748B] text-center">{labels.unsavedCloseWarning}</p>
      <button
        onClick={onRetry}
        disabled={saving || state.step === 'pin'}
        className="w-full bg-[#1A5276] hover:bg-[#154360] disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
      >
        {saving ? processingLabel : labels.retrySaving}
      </button>
      <button
        onClick={() => dispatch({ type: 'REQUEST_CLOSE' })}
        disabled={saving || state.step === 'pin'}
        className="w-full py-2 text-sm font-medium text-[#D32F2F] hover:underline disabled:opacity-50"
      >
        {labels.cancelAndVoid}
      </button>

      {/* Manager PIN: the only way out without a saved sale. Audited by /auth/manager-override. */}
      {state.step === 'pin' && (
        <ManagerPinModal
          action={voidAction}
          referenceId={clientTxId}
          note={voidNote}
          onAuthorized={() => dispatch({ type: 'PIN_AUTHORIZED' })}
          onCancel={() => dispatch({ type: 'PIN_CANCELLED' })}
        />
      )}
    </div>
  );
}
