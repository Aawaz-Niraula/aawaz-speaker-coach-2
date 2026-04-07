'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import * as Label from '@radix-ui/react-label';
import * as Select from '@radix-ui/react-select';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  ChevronDown,
  Copy,
  MessageCircleMore,
  Volume2,
  Menu,
  Mic,
  MicOff,
  RefreshCw,
  Sparkles,
  Trash2,
  Trophy,
  WandSparkles,
  X,
} from 'lucide-react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { toast, Toaster } from 'sonner';

import { Button } from '@/components/ui/button';
import { SPEECH_TEMPLATES, type SpeechTemplateId } from '@/lib/speech-config';
import { cn } from '@/lib/utils';

type Tab = 'coach' | 'speech' | 'history';
type NavItem = { id: Tab; label: string; icon: typeof Mic };
type SpeechHistoryItem = {
  id: string;
  created_at: string;
  template_label: string | null;
  overall_score: number | null;
  words_per_min: number | null;
  transcript: string;
  feedback: string;
};

const navItems: NavItem[] = [
  { id: 'coach', label: 'Speaking Coach', icon: Mic },
  { id: 'speech', label: 'Speech Practice', icon: WandSparkles },
  { id: 'history', label: 'Speech History', icon: Trophy },
];

function usePersistentUserId() {
  const [userId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'aawaz-user-id';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const nextId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `user-${Date.now()}`;
    window.localStorage.setItem(key, nextId);
    return nextId;
  });
  return userId;
}

function extractScore(text: string) {
  const match = text.match(/overall score[:\s-]*(\d+)\/100/i);
  return match ? Number(match[1]) : null;
}

function formatHistoryDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[24px] border border-white/10 bg-white/6 p-4 shadow-[0_20px_80px_rgba(2,6,23,0.45)] backdrop-blur-xl sm:rounded-[28px] sm:p-6">{children}</div>;
}

function Score({ text }: { text: string }) {
  const score = extractScore(text);
  if (score === null) return null;
  return (
    <div className="h-24 w-24">
      <CircularProgressbar value={score} text={`${score}`} styles={buildStyles({ textColor: '#f2efff', pathColor: '#a78bfa', trailColor: 'rgba(255,255,255,0.08)' })} />
    </div>
  );
}

function TemplatePicker({ value, onChange }: { value: SpeechTemplateId | null; onChange: (id: SpeechTemplateId | null) => void }) {
  const selected = SPEECH_TEMPLATES.find((item) => item.id === value) ?? null;
  return (
    <div className="grid gap-4">
      <Shell>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Speech Format</p>
        <Label.Root className="mb-2 block text-sm text-[#ddd6fe]">Evaluation rubric</Label.Root>
        <Select.Root value={value ?? 'general'} onValueChange={(next) => onChange(next === 'general' ? null : (next as SpeechTemplateId))}>
          <Select.Trigger className="flex h-14 w-full items-center justify-between rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-left text-sm text-[#f2efff] sm:rounded-[22px] sm:px-5">
            <Select.Value placeholder="General evaluation" />
            <Select.Icon><ChevronDown className="h-4 w-4 text-[#857ca2]" /></Select.Icon>
          </Select.Trigger>
          <Select.Portal>
              <Select.Content position="popper" className="z-50 max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b12]/95 p-2 text-[#f2efff]">
              <Select.Viewport className="grid gap-1">
                <Select.Item value="general" className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-sm outline-none hover:bg-white/10">
                  <Select.ItemText>General evaluation</Select.ItemText>
                  <Select.ItemIndicator><Check className="h-4 w-4 text-[#a78bfa]" /></Select.ItemIndicator>
                </Select.Item>
                {SPEECH_TEMPLATES.map((template) => (
                  <Select.Item key={template.id} value={template.id} className="flex cursor-pointer items-center justify-between rounded-2xl px-4 py-3 text-sm outline-none hover:bg-white/10">
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
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="relative overflow-hidden rounded-[24px] border border-white/10 sm:rounded-[28px]">
            <Button variant="secondary" size="icon" className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4" onClick={() => onChange(null)}>
              <X className="h-4 w-4" />
            </Button>
            <Image src={selected.src} alt={selected.label} width={900} height={600} className="h-auto w-full" />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default function Home() {
  const userId = usePersistentUserId();
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [history, setHistory] = useState<SpeechHistoryItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpeechTemplateId | null>(null);
  const [topic, setTopic] = useState('');
  const [speech, setSpeech] = useState('');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/evaluations/history?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        setHistory(data.history || []);
      } catch {
        toast.error('Could not load saved history.');
      }
    };
    void load();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [userId]);

  const averageScore = useMemo(() => {
    const scores = history.map((item) => item.overall_score).filter((score): score is number => typeof score === 'number');
    return scores.length ? `${Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)}/100` : 'N/A';
  }, [history]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const form = new FormData();
        form.append('file', blob, 'speech.webm');
        form.append('userId', userId);
        if (selectedTemplateId) form.append('templateId', selectedTemplateId);
        try {
          const res = await fetch('/api/transcribe-analyze', { method: 'POST', body: form });
          const data = await res.json();
          if (!res.ok || data.error) throw new Error(data.error || 'Failed to analyze speech.');
          setTranscript(data.transcript || '');
          setFeedback(data.feedback || '');
          setHistory(data.history || []);
          setSelectedSessionId(null);
          toast.success('Speech analyzed and saved.');
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to analyze speech.');
        } finally {
          setIsAnalyzing(false);
        }
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setTranscript('');
      setFeedback('');
      setSeconds(0);
      setIsRecording(true);
      setIsAnalyzing(false);
      timerRef.current = setInterval(() => setSeconds((current) => current + 1), 1000);
      toast.message('Recording started.');
    } catch {
      toast.error('Microphone access is required.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsAnalyzing(true);
  };

  const generateSpeech = async () => {
    if (!topic.trim()) {
      toast.error('Enter a topic first.');
      return;
    }
    setIsGenerating(true);
    setSpeech('');
    setError('');
    try {
      const res = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to generate.');
      setSpeech(data.speech);
      toast.success('Practice speech generated.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate.';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    try {
      const res = await fetch('/api/evaluations/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete session.');
      setHistory(data.history || []);
      setSelectedSessionId((current) => (current === sessionId ? null : current));
      toast.success('Speech session deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete session.');
    }
  };

  const selectedSession = history.find((item) => item.id === selectedSessionId) ?? null;

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied.`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}.`);
    }
  };

  const speakText = (value: string, label: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Text-to-speech is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(value);
    utterance.rate = 0.96;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    toast.success(`Reading ${label.toLowerCase()}.`);
  };

  const ActionBar = ({
    text,
    label,
    onRegenerate,
  }: {
    text: string;
    label: string;
    onRegenerate?: () => void;
  }) => (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copyText(text, label)} title={`Copy ${label}`}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => speakText(text, label)} title={`Read ${label}`}>
        <Volume2 className="h-4 w-4" />
      </Button>
      {onRegenerate ? (
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onRegenerate} title={`Regenerate ${label}`}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );

  const PopupIconButton = ({
    onClick,
    icon,
    label,
    className = '',
  }: {
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-white/5 text-[#ddd6fe] shadow-[0_0_18px_rgba(167,139,250,0.22)] backdrop-blur-sm transition hover:bg-white/10 hover:text-[#f2efff]',
        className,
      )}
      aria-label={label}
    >
      {icon}
    </button>
  );

  const PopupPanel = ({
    title,
    children,
    onClose,
    align = 'right',
  }: {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
    align?: 'left' | 'right';
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      className={cn(
        'absolute top-12 z-30 max-h-[60vh] w-[290px] overflow-y-auto rounded-[22px] border border-white/10 bg-[#0b0b12]/95 p-4 shadow-[0_18px_50px_rgba(2,6,23,0.6)] backdrop-blur-sm sm:w-[320px]',
        align === 'right' ? 'right-0' : 'left-0',
      )}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full border border-[#f87171]/30 bg-[#dc2626]/15 text-[#f87171] hover:bg-[#dc2626]/25"
        aria-label={`Close ${title}`}
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <p className="pr-8 font-mono text-[10px] uppercase tracking-[0.28em] text-[#ddd6fe]">{title}</p>
      <div className="mt-3 text-sm leading-6 text-[#f2efff]">{children}</div>
    </motion.div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.16),transparent_22%),radial-gradient(circle_at_top_right,rgba(249,168,212,0.16),transparent_28%),linear-gradient(180deg,#06060b_0%,#0b0b12_45%,#11111a_100%)] text-[#f2efff]">
      <Toaster position="top-right" richColors theme="dark" />
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        {sidebarOpen ? <button aria-label="Close menu overlay" className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden" onClick={() => setSidebarOpen(false)} /> : null}
        <aside className={cn('fixed inset-y-0 left-0 z-40 w-[84vw] max-w-72 border-r border-white/10 bg-[#0b0b12]/90 p-4 backdrop-blur-sm transition md:static md:w-72 md:max-w-none md:translate-x-0 md:p-5 lg:w-80', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(167,139,250,0.16),rgba(249,168,212,0.14))] p-5">
            <div className="font-serif text-4xl tracking-[-0.04em]">Aawaz</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#ddd6fe]">Speaker Coach</div>
          </div>
          <div className="mt-6 grid gap-2">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setActiveTab(id as Tab); setSidebarOpen(false); }} className={cn('flex items-center gap-3 rounded-[20px] px-4 py-4 text-left transition sm:rounded-[24px]', activeTab === id ? 'bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(249,168,212,0.12))]' : 'hover:bg-white/6')}>
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10 text-[#ddd6fe]"><Icon className="h-4 w-4" /></span>
                <span className="text-sm sm:text-base">{label}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-3 pb-14 pt-24 sm:px-4 md:px-6 md:pt-10 lg:px-8">
          <div className="mb-4 flex justify-center md:justify-start">
            <div className="rounded-full border border-[#a78bfa]/30 bg-white/5 px-4 py-2 shadow-[0_0_24px_rgba(167,139,250,0.25)] backdrop-blur-sm">
              <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#ddd6fe] sm:text-[11px]">
                made by aawaz
              </span>
            </div>
          </div>
          <div className="mb-5 flex items-center gap-3 sm:gap-4 md:hidden">
            <Button variant="secondary" size="icon" onClick={() => setSidebarOpen(true)}><Menu className="h-5 w-5" /></Button>
            <div className="flex min-w-0 items-center gap-2">
              <div className="relative shrink-0">
                <PopupIconButton onClick={() => { setCreatorOpen((current) => !current); setHelpOpen(false); }} icon={<MessageCircleMore className="h-4 w-4" />} label="Open creator message" />
                <AnimatePresence>
                  {creatorOpen ? (
                    <PopupPanel title="Message From The Creator" onClose={() => setCreatorOpen(false)} align="left">
                      <p>ello boyz and gurls speak your heart out but nabirsa hai AI can make mistakes and very big ones so kei problems aaye ma contact me directly hai! - aawaz</p>
                    </PopupPanel>
                  ) : null}
                </AnimatePresence>
              </div>
              <span className="min-w-0 truncate font-serif text-[1.7rem] tracking-[-0.04em] sm:text-3xl">Aawaz Speaker Coach</span>
              <div className="relative shrink-0">
                <PopupIconButton onClick={() => { setHelpOpen((current) => !current); setCreatorOpen(false); }} icon={<span className="text-sm font-bold">?</span>} label="Open app help" className="h-8 w-8" />
                <AnimatePresence>
                  {helpOpen ? (
                    <PopupPanel title="Quick Help" onClose={() => setHelpOpen(false)} align="right">
                      <div className="space-y-2">
                        <p>Use <span className="text-[#ddd6fe]">Speaking Coach</span> to record and get feedback.</p>
                        <p>Use <span className="text-[#ddd6fe]">Speech Practice</span> to generate a sample speech.</p>
                        <p>Use <span className="text-[#ddd6fe]">Speech History</span> to review saved sessions.</p>
                      </div>
                    </PopupPanel>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="grid gap-5">
              <div className="relative z-20">
              <Shell>
                <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">{activeTab}</p>
                <div className="mt-3 flex flex-wrap items-start gap-3">
                  <div className="relative hidden shrink-0 md:block">
                    <PopupIconButton onClick={() => { setCreatorOpen((current) => !current); setHelpOpen(false); }} icon={<MessageCircleMore className="h-4 w-4" />} label="Open creator message" />
                    <AnimatePresence>
                      {creatorOpen ? (
                        <PopupPanel title="Message From The Creator" onClose={() => setCreatorOpen(false)} align="left">
                          <p>ello boyz and gurls speak your heart out but nabirsa hai AI can make mistakes and very big ones so kei problems aaye ma contact me directly hai! - aawaz</p>
                        </PopupPanel>
                      ) : null}
                    </AnimatePresence>
                  </div>
                  <h1 className="max-w-4xl font-serif text-[clamp(2.1rem,6vw,5rem)] leading-[0.95] tracking-[-0.04em] sm:text-[clamp(2.4rem,6vw,5rem)]">
                    {activeTab === 'coach' && 'Speaking Coach'}
                    {activeTab === 'speech' && 'Speech Practice'}
                    {activeTab === 'history' && 'Speech History'}
                  </h1>
                  <div className="relative hidden shrink-0 md:block">
                    <PopupIconButton onClick={() => { setHelpOpen((current) => !current); setCreatorOpen(false); }} icon={<span className="text-sm font-bold">?</span>} label="Open app help" className="mt-1" />
                    <AnimatePresence>
                      {helpOpen ? (
                        <PopupPanel title="Quick Help" onClose={() => setHelpOpen(false)} align="right">
                          <div className="space-y-2">
                            <p>Use <span className="text-[#ddd6fe]">Speaking Coach</span> to record and get feedback.</p>
                            <p>Use <span className="text-[#ddd6fe]">Speech Practice</span> to generate a sample speech.</p>
                            <p>Use <span className="text-[#ddd6fe]">Speech History</span> to review saved sessions.</p>
                          </div>
                        </PopupPanel>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3"><div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2]">Templates</div><div className="mt-1 text-sm sm:text-base text-[#f2efff]">4 modes</div></div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3"><div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2]">History</div><div className="mt-1 text-sm sm:text-base text-[#f2efff]">{history.length} sessions</div></div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 sm:col-span-2 xl:col-span-1"><div className="font-mono text-[10px] uppercase tracking-[0.28em] text-[#857ca2]">Average</div><div className="mt-1 text-sm sm:text-base text-[#f2efff]">{averageScore}</div></div>
                </div>
              </Shell>
              </div>

              {activeTab === 'coach' && (
                <>
                  <TemplatePicker value={selectedTemplateId} onChange={setSelectedTemplateId} />
                  <Shell>
                    <div className="grid gap-6 lg:grid-cols-[1fr,auto] lg:items-center">
                      <div className="space-y-4">
                        <div className="rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-4 sm:rounded-[24px] sm:p-5">
                          <div className="flex flex-wrap gap-3">
                            <div className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3 text-sm">Status: {isAnalyzing ? 'Analyzing' : isRecording ? 'Recording' : 'Ready'}</div>
                            <div className="rounded-3xl border border-white/10 bg-white/6 px-4 py-3 text-sm">Timer: {seconds}s</div>
                          </div>
                        </div>
                        {isRecording && (
                          <div className="flex h-14 items-center gap-1 overflow-hidden rounded-[20px] border border-white/10 bg-white/6 px-3 sm:h-16 sm:rounded-[24px] sm:px-4">
                            {Array.from({ length: 30 }).map((_, index) => (
                              <motion.div key={index} animate={{ scaleY: [0.35, 1, 0.4] }} transition={{ duration: 0.7, repeat: Infinity, delay: index * 0.03 }} className={cn('w-1 rounded-full', index % 3 === 0 ? 'bg-[#f9a8d4]' : 'bg-[#a78bfa]')} style={{ height: 42 }} />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-center gap-4">
                        <motion.button whileTap={{ scale: 0.96 }} animate={isRecording ? { scale: [1, 1.05, 1] } : { scale: 1 }} transition={{ duration: 1.8, repeat: isRecording ? Infinity : 0 }} onClick={isRecording ? stopRecording : startRecording} disabled={isAnalyzing} className={cn('flex h-28 w-28 items-center justify-center rounded-full border text-[#f2efff] shadow-[0_24px_60px_rgba(2,6,23,0.45)] sm:h-32 sm:w-32 lg:h-36 lg:w-36', isRecording ? 'border-[#f87171]/30 bg-[linear-gradient(135deg,#dc2626,#f87171)]' : 'border-white/10 bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] text-[#06060b]')}>
                          {isAnalyzing ? <Sparkles className="h-10 w-10 animate-spin" /> : isRecording ? <MicOff className="h-10 w-10" /> : <Mic className="h-10 w-10" />}
                        </motion.button>
                        <div className="text-center font-mono text-[10px] uppercase tracking-[0.24em] text-[#857ca2] sm:text-[11px] sm:tracking-[0.3em]">{isAnalyzing ? 'Analyzing' : isRecording ? 'Tap to stop' : 'Tap to speak'}</div>
                      </div>
                    </div>
                  </Shell>
                  {transcript && <Shell><p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Transcript</p><p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 sm:leading-8 text-[#f2efff]">{transcript}</p><ActionBar text={transcript} label="Transcript" /></Shell>}
                  {feedback && <Shell><div className="grid gap-5 md:grid-cols-[auto,1fr]"><div className="mx-auto md:mx-0"><Score text={feedback} /></div><div><p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Coach Verdict</p><p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 sm:leading-8 text-[#f2efff]">{feedback}</p><ActionBar text={feedback} label="Feedback" /></div></div></Shell>}
                </>
              )}

              {activeTab === 'speech' && (
                <>
                  <Shell>
                    <Label.Root htmlFor="speech-topic" className="mb-2 block text-sm text-[#ddd6fe]">Speech topic</Label.Root>
                    <div className="grid gap-4 md:grid-cols-[1fr,auto]">
                      <input id="speech-topic" value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && generateSpeech()} placeholder="e.g. Leadership, climate change, discipline" className="h-14 min-w-0 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none placeholder:text-[#857ca2] sm:rounded-[22px] sm:px-5" />
                      <Button onClick={generateSpeech} disabled={isGenerating || !topic.trim()} className="h-14 w-full rounded-[18px] px-6 font-mono text-xs uppercase tracking-[0.22em] sm:rounded-[22px] md:w-auto md:tracking-[0.28em]">
                        <Sparkles className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
                        {isGenerating ? 'Writing...' : 'Generate'}
                      </Button>
                    </div>
                    {error ? <p className="mt-3 font-mono text-xs text-[#f87171]">{error}</p> : null}
                  </Shell>
                  {(speech || isGenerating) && (
                    <Shell>
                      <div className="mb-4 flex items-center justify-between">
                        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Sample Speech</p>
                        {!isGenerating && <Button variant="ghost" size="icon" onClick={generateSpeech}><RefreshCw className="h-4 w-4" /></Button>}
                      </div>
                      {isGenerating ? <div className="flex gap-2">{[0, 1, 2].map((i) => <motion.div key={i} animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.14 }} className="h-2 w-2 rounded-full bg-[#a78bfa]" />)}</div> : <><p className="whitespace-pre-wrap break-words text-[15px] leading-7 sm:leading-8 text-[#f2efff]">{speech}</p><ActionBar text={speech} label="Speech" onRegenerate={generateSpeech} /></>}
                    </Shell>
                  )}
                </>
              )}

              {activeTab === 'history' && (
                <>
                  <Shell>
                    <div className="grid gap-3">
                      {history.length ? history.map((item, index) => (
                        <motion.button key={item.id} whileHover={{ y: -2 }} onClick={() => setSelectedSessionId(selectedSessionId === item.id ? null : item.id)} className={cn('w-full rounded-[20px] border p-4 text-left sm:rounded-[24px] sm:p-5', selectedSessionId === item.id ? 'border-[#a78bfa]/40 bg-[linear-gradient(135deg,rgba(167,139,250,0.14),rgba(249,168,212,0.10))]' : 'border-white/10 bg-white/4')}>
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ddd6fe] sm:text-[11px] sm:tracking-[0.28em]">Session {history.length - index} | {formatHistoryDate(item.created_at)}</div>
                            <Button variant="danger" size="icon" className="h-8 w-8" onClick={(event) => { event.stopPropagation(); deleteSession(item.id); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                          <div className="break-words text-sm sm:text-base">{item.template_label ?? 'General Evaluation'}</div>
                          <div className="mt-1 break-words font-mono text-xs text-[#857ca2]">{item.overall_score ?? 'No'} / 100 {item.words_per_min ? `| ${item.words_per_min} wpm` : ''}</div>
                        </motion.button>
                      )) : <div className="rounded-[24px] border border-dashed border-white/20 bg-white/4 px-5 py-6 font-mono text-sm text-[#857ca2]">Saved speeches will appear here after the first evaluation.</div>}
                    </div>
                  </Shell>
                  {selectedSession && (
                    <>
                      <Shell><p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Transcript</p><p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 sm:leading-8 text-[#f2efff]">{selectedSession.transcript}</p><ActionBar text={selectedSession.transcript} label="Transcript" /></Shell>
                      <Shell><div className="grid gap-5 md:grid-cols-[auto,1fr]"><div className="mx-auto md:mx-0"><Score text={selectedSession.feedback} /></div><div><p className="mb-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">Coach Verdict</p><p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 sm:leading-8 text-[#f2efff]">{selectedSession.feedback}</p><ActionBar text={selectedSession.feedback} label="Feedback" /></div></div></Shell>
                    </>
                  )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
