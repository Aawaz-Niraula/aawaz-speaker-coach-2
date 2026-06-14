'use client';

import { Dispatch, FormEvent, SetStateAction, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Loader2, Send, Sparkles } from 'lucide-react';

import { CoachMascot, type MascotMood } from '@/components/mascot';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/lib/request';
import { sfx } from '@/lib/sound';
import { cn } from '@/lib/utils';

export type AawaxChatMessage = { role: 'assistant' | 'user'; content: string };

type AawaxChatResponse = { answer: string };

const SUGGESTIONS = [
  'How am I doing overall?',
  'What should I work on next?',
  'Which rubric is my weakest?',
  'Give me a quick tip to sound confident',
];

export const AAWAX_CHAT_GREETING: AawaxChatMessage = {
  role: 'assistant',
  content:
    "Hi, I'm Aawax. Ask me anything about your speaking — your scores, weak spots, what to practice next, or how anything in the app works. I remember your past sessions, so I can keep it personal.",
};

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-[#c4b5fd]"
          animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

export type AawaxChatPageProps = {
  messages: AawaxChatMessage[];
  setMessages: Dispatch<SetStateAction<AawaxChatMessage[]>>;
  contextTab: string;
  onBack: () => void;
};

export function AawaxChatPage({ messages, setMessages, contextTab, onBack }: AawaxChatPageProps) {
  const reduceMotion = useReducedMotion();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const showSuggestions = messages.length <= 1 && !loading;

  const mascotMood = useMemo<MascotMood>(() => {
    if (loading) return 'think';
    const last = messages[messages.length - 1];
    if (last?.role === 'assistant' && messages.length > 1) return 'coach';
    return 'idle';
  }, [loading, messages]);

  useEffect(() => {
    const node = endRef.current;
    if (!node) return;
    node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'end' });
  }, [messages, loading, reduceMotion]);

  const send = async (raw: string) => {
    const message = raw.trim();
    if (!message || loading) return;

    setInput('');
    setLoading(true);
    sfx.tap();
    const nextHistory = [...messages, { role: 'user' as const, content: message }];
    setMessages(nextHistory);

    try {
      const data = await requestJson<AawaxChatResponse>(
        '/api/aawax-chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message,
            tab: contextTab,
            history: nextHistory.slice(-10).map((m) => ({ role: m.role, content: m.content })),
          }),
        },
        75000,
      );

      setMessages((current) => [...current, { role: 'assistant', content: data.answer }]);
      sfx.success();
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Aawax could not answer right now. Please try again.',
        },
      ]);
      sfx.oops();
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <div className="flex h-[calc(100dvh-12rem)] min-h-[24rem] flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#0b0a13]/70 shadow-[0_30px_90px_rgba(2,6,23,0.6)] backdrop-blur-xl md:h-[calc(100dvh-7rem)]">
      {/* Header */}
      <div className="relative flex items-center gap-3 border-b border-white/10 px-4 py-3.5 sm:px-5">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(221,214,254,0.5),transparent)]" />
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#a79dc8] transition hover:bg-white/10 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="shrink-0">
          <CoachMascot mood={mascotMood} size={42} float={false} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-xl leading-none tracking-tight text-white">Ask Aawax</p>
          <p className="mt-1 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#857ca2]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4ade80]" />
            Knows your speaking history
          </p>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="aawax-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5"
      >
        {messages.map((message, index) => (
          <motion.div
            key={`${message.role}-${index}`}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
          >
            <div
              className={cn(
                'max-w-[85%] whitespace-pre-wrap rounded-2xl border px-3.5 py-2.5 text-sm leading-6 sm:max-w-[78%]',
                message.role === 'user'
                  ? 'rounded-br-md border-[#a78bfa]/25 bg-[#a78bfa]/14 text-[#f2efff]'
                  : 'rounded-bl-md border-white/10 bg-white/[0.055] text-[#d9d2ef]',
              )}
            >
              {message.content}
            </div>
          </motion.div>
        ))}

        {loading ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.055] px-3.5 py-3 text-[#a79dc8]">
              <TypingDots />
            </div>
          </div>
        ) : null}

        {showSuggestions ? (
          <div className="space-y-2 pt-1">
            <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[#857ca2]">
              <Sparkles className="h-3 w-3" /> Try asking
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-[#cfc8e8] transition hover:border-[#a78bfa]/40 hover:bg-white/[0.08] hover:text-white"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-white/10 px-3 py-3 sm:px-4"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask Aawax anything…"
          className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/45 focus:bg-white/[0.08]"
          maxLength={900}
          autoComplete="off"
        />
        <Button
          type="submit"
          disabled={loading || input.trim().length < 2}
          size="icon"
          className="h-12 w-12 shrink-0 rounded-2xl"
          aria-label="Send"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
