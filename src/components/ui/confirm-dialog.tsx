'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { CoachMascot } from '@/components/mascot';
import { Button } from '@/components/ui/button';

export type ConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  action: () => void | Promise<void>;
};

export function ConfirmDialog({
  request,
  busy,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {request ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
            onClick={busy ? undefined : onCancel}
            aria-label="Dismiss"
          />
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-label={request.title}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="fixed left-1/2 top-1/2 z-[71] w-[92vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-[26px] border border-white/10 bg-[#0d0c16]/95 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.75)] backdrop-blur-xl sm:p-6"
          >
            <div className="flex items-start gap-3">
              <CoachMascot mood={request.danger ? 'oops' : 'coach'} size={52} float={false} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl tracking-tight text-white">{request.title}</p>
                <p className="mt-1.5 text-sm leading-6 text-[#a79dc8]">{request.body}</p>
              </div>
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#857ca2] transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2.5">
              <Button variant="secondary" onClick={onCancel} disabled={busy} className="h-11 rounded-[16px] font-mono text-[11px] uppercase tracking-[0.16em]">
                Keep it
              </Button>
              <Button
                variant={request.danger ? 'danger' : 'primary'}
                onClick={onConfirm}
                disabled={busy}
                className="h-11 rounded-[16px] font-mono text-[11px] uppercase tracking-[0.16em]"
              >
                {busy ? 'Working…' : request.confirmLabel}
              </Button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
