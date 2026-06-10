'use client';

import { useState } from 'react';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ImageIcon, ScrollText, X } from 'lucide-react';

import { CoachMascot } from '@/components/mascot';
import { Button } from '@/components/ui/button';
import { Eyebrow, Shell } from '@/components/ui/shell';
import { sfx } from '@/lib/sound';
import { SPEECH_TEMPLATES, type SpeechTemplate, type SpeechTemplateId } from '@/lib/speech-config';

/** Full-screen popup showing the hand-designed Canva format image for a rubric. */
function FormatViewer({ template, onClose }: { template: SpeechTemplate; onClose: () => void }) {
  const [failed, setFailed] = useState(false);

  return (
    <>
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-md"
        onClick={onClose}
        aria-label="Close format preview"
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={`${template.label} format`}
        initial={{ opacity: 0, scale: 0.94, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="fixed left-1/2 top-1/2 z-[61] flex max-h-[90vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[24px] border border-white/12 bg-[#0d0c16]/97 shadow-[0_30px_90px_rgba(2,6,23,0.85)] backdrop-blur-xl sm:rounded-[28px]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#a78bfa]/15 text-[#a78bfa]">
              <ImageIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-serif text-base tracking-tight text-white sm:text-lg">{template.label}</p>
              <p className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-[#857ca2]">Designed by aawaz for his dear learners</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#857ca2] transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="overflow-y-auto p-3 sm:p-4">
          {failed ? (
            <div className="flex flex-col items-center gap-3 rounded-[18px] border border-dashed border-white/15 bg-white/4 px-6 py-12 text-center">
              <CoachMascot mood="oops" size={72} />
              <p className="text-sm text-[#cfc8e8]">This format image isn&apos;t available yet.</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#857ca2]">Expected at {template.src}</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={template.src}
              alt={`${template.label} speech format`}
              className="w-full rounded-[16px] border border-white/8"
              onError={() => setFailed(true)}
            />
          )}
        </div>
      </motion.div>
    </>
  );
}

export function TemplatePicker({
  value,
  onChange,
  disabled = false,
}: {
  value: SpeechTemplateId | null;
  onChange: (id: SpeechTemplateId | null) => void;
  disabled?: boolean;
}) {
  const selected = SPEECH_TEMPLATES.find((item) => item.id === value) ?? null;
  const [formatOpen, setFormatOpen] = useState(false);

  return (
    <div className="grid gap-4">
      <Shell>
        <Eyebrow className="mb-3">Speech Format</Eyebrow>
        <Label.Root className="mb-2 block text-sm text-[#ddd6fe]">Evaluation rubric</Label.Root>
        <Select.Root
          value={value ?? 'general'}
          onValueChange={(next) => onChange(next === 'general' ? null : (next as SpeechTemplateId))}
          disabled={disabled}
        >
          <Select.Trigger className="flex h-14 w-full items-center justify-between rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-left text-sm text-[#f2efff] transition hover:border-[#a78bfa]/40 disabled:opacity-50 sm:rounded-[22px] sm:px-5">
            <Select.Value placeholder="General evaluation" />
            <Select.Icon><ChevronDown className="h-4 w-4 text-[#857ca2]" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
            <Select.Content position="popper" className="z-50 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#0d0c16]/95 p-2 text-[#f2efff] shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
              <Select.Viewport className="grid gap-1">
                <Select.Item value="general" className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-sm outline-none hover:bg-white/10 data-[highlighted]:bg-white/10">
                  <Select.ItemText>General evaluation</Select.ItemText>
                  <Select.ItemIndicator><Check className="h-4 w-4 text-[#a78bfa]" /></Select.ItemIndicator>
                </Select.Item>
                {SPEECH_TEMPLATES.map((template) => (
                  <Select.Item key={template.id} value={template.id} className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-sm outline-none hover:bg-white/10 data-[highlighted]:bg-white/10">
                    <Select.ItemText>{template.label}</Select.ItemText>
                    <Select.ItemIndicator><Check className="h-4 w-4 text-[#a78bfa]" /></Select.ItemIndicator>
                  </Select.Item>
                ))}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>
      </Shell>
      <AnimatePresence>
        {selected ? (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="relative overflow-hidden rounded-[24px] border border-[#a78bfa]/20 bg-[linear-gradient(135deg,rgba(167,139,250,0.08),rgba(249,168,212,0.05))] p-4 backdrop-blur-xl sm:rounded-[28px] sm:p-6"
          >
            <Button variant="secondary" size="icon" className="absolute right-3 top-3 z-10 h-8 w-8 sm:right-4 sm:top-4" onClick={() => onChange(null)} aria-label="Clear template">
              <X className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2.5 pr-10">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#a78bfa]/15 text-[#a78bfa]">
                <ScrollText className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-serif text-lg tracking-tight text-white">{selected.label}</p>
                <p className="truncate font-mono text-[10px] uppercase tracking-[0.18em] text-[#857ca2]">{selected.rubricTitle}</p>
              </div>
            </div>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {selected.hints.map((rule, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06 }}
                  className="flex items-start gap-2.5 rounded-[14px] border border-white/8 bg-[#0b0b12]/45 px-3 py-2.5 text-[13px] leading-relaxed text-[#e6e1f7]"
                >
                  <span className="mt-1.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-[#f9a8d4]"></span>
                  {rule}
                </motion.li>
              ))}
            </ul>
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2.5">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#857ca2]">The coach judges strictly against this rubric — no mercy mode.</p>
              <button
                type="button"
                onClick={() => {
                  sfx.pop();
                  setFormatOpen(true);
                }}
                className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ddd6fe] transition hover:border-[#a78bfa]/55 hover:bg-[#a78bfa]/20 hover:text-white"
              >
                <ImageIcon className="h-3.5 w-3.5 transition-transform group-hover:scale-110" />
                View format
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      <AnimatePresence>
        {formatOpen && selected ? <FormatViewer template={selected} onClose={() => setFormatOpen(false)} /> : null}
      </AnimatePresence>
    </div>
  );
}
