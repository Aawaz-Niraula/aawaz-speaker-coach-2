'use client';

import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, ScrollText, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Eyebrow, Shell } from '@/components/ui/shell';
import { SPEECH_TEMPLATES, type SpeechTemplateId } from '@/lib/speech-config';

/** Extracts the first few rule bullets from a rubric for a quick preview. */
function rubricHighlights(rubric: string, count = 4) {
  return rubric
    .split('\n')
    .map((line) => line.replace(/^[-•]\s*/, '').trim())
    .filter((line, index) => index > 0 && line.length > 0)
    .slice(0, count);
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
              {rubricHighlights(selected.rubric).map((rule, i) => (
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
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#857ca2]">The coach judges strictly against this rubric — no mercy mode.</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
