'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Label from '@radix-ui/react-label';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  BarChart3,
  ChevronDown,
  Copy,
  LogOut,
  MessageCircleMore,
  Mic,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  TrendingUp,
  Trophy,
  User,
  Volume2,
  WandSparkles,
  X,
} from 'lucide-react';
import { toast, Toaster } from 'sonner';

import { AawaxChatPage, AAWAX_CHAT_GREETING, type AawaxChatMessage } from '@/components/aawax-chat-page';
import { AawaxCompanion } from '@/components/aawax-companion';
import { AawaxCustomizer } from '@/components/aawax-customizer';
import { AudioPlayer } from '@/components/audio-player';
import { FeedbackReport, CollapsibleSection } from '@/components/feedback-report';
import { CoachMascot, MascotHint } from '@/components/mascot';
import { AvatarCustomizer, ProfileAvatar } from '@/components/profile-avatar';
import { ProgressChart } from '@/components/progress-chart';
import { LiveWaveform, SkeletonLines, ThinkingDots } from '@/components/recorder-visuals';
import { FormatSelect, TemplatePicker } from '@/components/template-picker';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ui/confirm-dialog';
import { Eyebrow, Shell } from '@/components/ui/shell';
import { authClient } from '@/lib/auth-client';
import { formatClock, formatHistoryDate, scoreColor } from '@/lib/feedback';
import { requestJson } from '@/lib/request';
import { sfx } from '@/lib/sound';
import { type SpeechTemplateId } from '@/lib/speech-config';
import { cn } from '@/lib/utils';

/* ── Types ───────────────────────────────────────────────────────── */
type Tab = 'coach' | 'speech' | 'history' | 'progress' | 'account' | 'aawax';
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
type HistoryResponse = { history?: SpeechHistoryItem[] };
type AnalyzeResponse = HistoryResponse & { transcript?: string; feedback?: string; voiceSampleSaved?: boolean; isGuest?: boolean; guestRemaining?: number | null };
type SpeechResponse = { speech?: string; isGuest?: boolean; guestRemaining?: number | null };
type InsightsResponse = { insights?: string[]; weaknesses?: string[] };
type AccountProfile = { providerId: string; accountId: string };
type AuthStatus = { accountAuthEnabled: boolean; googleEnabled: boolean; message?: string };
type SpeechAudioMode = 'example' | 'clone';
type SpeechExampleVoice = 'female' | 'male';
type SpeechAudioState = {
  example: { url: string; isLoading: boolean };
  clone: { url: string; isLoading: boolean };
};
type MicPermission = 'unknown' | 'granted' | 'denied' | 'prompt';

/* ── Constants ───────────────────────────────────────────────────── */
const navItems: NavItem[] = [
  { id: 'coach', label: 'Speaking Coach', icon: Mic },
  { id: 'speech', label: 'Speech Practice', icon: WandSparkles },
  { id: 'history', label: 'Speech History', icon: Trophy },
  { id: 'progress', label: 'Progress', icon: TrendingUp },
  { id: 'account', label: 'Account', icon: User },
];

const TAB_META: Record<Tab, { title: string; subtitle: string }> = {
  coach: { title: 'Speaking Coach', subtitle: 'Record a speech and get honest feedback on it.' },
  speech: { title: 'Speech Practice', subtitle: 'Generate a practice speech and hear it read out loud.' },
  history: { title: 'Speech History', subtitle: 'All of your past speeches and reports in one place.' },
  progress: { title: 'Progress', subtitle: 'See how your scores have been improving over time.' },
  account: { title: 'Account', subtitle: 'Sign in to keep your progress safe across devices.' },
  aawax: { title: 'Ask Aawax', subtitle: 'Your AI speaking companion, here to help.' },
};

/** Left-to-right order of screens — drives the direction of the 3D slide. */
const TAB_ORDER: Tab[] = ['coach', 'speech', 'history', 'progress', 'account', 'aawax'];

const MAX_RECORDING_SECONDS = 300;
const VOICE_SAMPLE_SECONDS = 15;

const ANALYZE_STAGES = [
  'Transcribing every word…',
  'Coach is listening closely…',
  'Scoring against the rubric…',
];

function isValidAccountPassword(password: string) {
  return password.length > 5 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

function audioBufferToMonoWav(audioBuffer: AudioBuffer) {
  const { length, numberOfChannels, sampleRate } = audioBuffer;
  const pcm = new Float32Array(length);

  for (let channel = 0; channel < numberOfChannels; channel += 1) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < length; i += 1) {
      pcm[i] += channelData[i] / numberOfChannels;
    }
  }

  const bytesPerSample = 2;
  const dataSize = length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    const sample = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

async function encodeVoiceSampleAsWav(blob: Blob) {
  const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return blob;

  const context = new AudioContextCtor();
  try {
    const audioBuffer = await context.decodeAudioData(await blob.arrayBuffer());
    return new Blob([audioBufferToMonoWav(audioBuffer)], { type: 'audio/wav' });
  } finally {
    await context.close().catch(() => null);
  }
}

/* ── Small stable components ─────────────────────────────────────── */
function ActionBar({
  text,
  label,
  onRegenerate,
  copyText,
  speakText,
}: {
  text: string;
  label: string;
  onRegenerate?: () => void;
  copyText: (v: string, l: string) => void;
  speakText: (v: string, l: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => copyText(text, label)} title={`Copy ${label.toLowerCase()}`}>
        <Copy className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={() => speakText(text, label)} title={`Read ${label.toLowerCase()} aloud`}>
        <Volume2 className="h-4 w-4" />
      </Button>
      {onRegenerate ? (
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" onClick={onRegenerate} title={`Regenerate ${label.toLowerCase()}`}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );
}

function PopupIconButton({
  onClick,
  icon,
  label,
  className = '',
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
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
}

function PopupPanel({
  title,
  children,
  onClose,
  align = 'right',
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  align?: 'left' | 'right';
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.97 }}
      className={cn(
        'absolute top-12 z-30 max-h-[60vh] w-[290px] overflow-y-auto rounded-[22px] border border-white/10 bg-[#0d0c16]/95 p-4 shadow-[0_18px_50px_rgba(2,6,23,0.6)] backdrop-blur-xl sm:w-[320px]',
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
}

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-[#857ca2]">No score</span>;
  }
  const color = scoreColor(score);
  return (
    <span
      className="rounded-full border px-2.5 py-1 font-mono text-[11px] font-semibold tabular-nums"
      style={{ color, borderColor: `${color}40`, backgroundColor: `${color}14` }}
    >
      {score} / 100
    </span>
  );
}

/* ── Main page ───────────────────────────────────────────────────── */
export default function Home() {
  const { data: session, isPending: isSessionPending, refetch: refetchSession } = authClient.useSession();
  const accountUser = session?.user ?? null;
  const reduceMotion = useReducedMotion();

  const [identityReady, setIdentityReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [helpOpen, setHelpOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [avatarCustomizeOpen, setAvatarCustomizeOpen] = useState(false);
  const [aawaxMessages, setAawaxMessages] = useState<AawaxChatMessage[]>([AAWAX_CHAT_GREETING]);
  const [tabDirection, setTabDirection] = useState(1);
  const lastNonAawaxTab = useRef<Tab>('coach');
  const activeTabRef = useRef<Tab>('coach');

  const switchTab = useCallback((tab: Tab) => {
    const currentTab = activeTabRef.current;
    if (tab === currentTab) return;
    if (currentTab !== 'aawax') lastNonAawaxTab.current = currentTab;
    sfx.tick();
    // Slide toward the requested screen based on its position in the nav order.
    setTabDirection(TAB_ORDER.indexOf(tab) >= TAB_ORDER.indexOf(currentTab) ? 1 : -1);
    setActiveTab(tab);
  }, []);

  const openCustomizer = () => {
    sfx.pop();
    setCustomizeOpen(true);
  };
  const [history, setHistory] = useState<SpeechHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [deletingSessionIds, setDeletingSessionIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpeechTemplateId | null>(null);
  const [speechTemplateId, setSpeechTemplateId] = useState<SpeechTemplateId | null>(null);
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState(180);
  const [speech, setSpeech] = useState('');
  const [speechAudio, setSpeechAudio] = useState<SpeechAudioState>({
    example: { url: '', isLoading: false },
    clone: { url: '', isLoading: false },
  });
  const [exampleVoice, setExampleVoice] = useState<SpeechExampleVoice>('female');
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [micPermission, setMicPermission] = useState<MicPermission>('unknown');
  const [recordingStream, setRecordingStream] = useState<MediaStream | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [weaknesses, setWeaknesses] = useState<string[]>([]);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [authMode, setAuthMode] = useState<'sign-in' | 'sign-up'>('sign-up');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);
  const [guestUses, setGuestUses] = useState(0);
  const [authGreetingMode, setAuthGreetingMode] = useState<'sign-in' | 'sign-up' | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [voiceSampleMenuOpen, setVoiceSampleMenuOpen] = useState(false);
  const [voiceSamplePanelOpen, setVoiceSamplePanelOpen] = useState(false);
  const [isVoiceSampleRecording, setIsVoiceSampleRecording] = useState(false);
  const [isVoiceSampleSaving, setIsVoiceSampleSaving] = useState(false);
  const [isVoiceSampleResetting, setIsVoiceSampleResetting] = useState(false);
  const [voiceSampleSeconds, setVoiceSampleSeconds] = useState(0);
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceSampleRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceSampleStreamRef = useRef<MediaStream | null>(null);
  const voiceSampleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const speechAudioRef = useRef(speechAudio);
  const claimedForRef = useRef<string | null>(null);

  /* ── Identity bootstrap (server-issued guest cookie) ───────────── */
  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      try {
        await fetch('/api/account/session', { cache: 'no-store' });
      } catch (err) {
        console.error('Identity bootstrap failed:', err);
      }
      if (!cancelled) setIdentityReady(true);
    };

    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [accountUser?.id]);

  /* ── History load ──────────────────────────────────────────────── */
  useEffect(() => {
    if (!identityReady) return;
    let cancelled = false;

    const load = async () => {
      setHistoryLoading(true);
      try {
        const data = await requestJson<HistoryResponse>('/api/evaluations/history', undefined, 300000);
        if (!cancelled) setHistory(data.history || []);
      } catch (err) {
        console.error('Could not load saved history:', err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [identityReady, accountUser?.id]);

  /* ── URL params (auth redirects) ───────────────────────────────── */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const err = params.get('error');
      const mode = params.get('auth') === 'sign-in' ? 'sign-in' : params.get('auth') === 'sign-up' ? 'sign-up' : null;
      if (err) toast.error(`Authentication error: ${err}`);
      if (mode) setAuthGreetingMode(mode);
      if (err || mode) window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    speechAudioRef.current = speechAudio;
  }, [speechAudio]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  /* ── Auth status ───────────────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    const loadAuthStatus = async () => {
      try {
        const data = await requestJson<AuthStatus>('/api/account/auth-status', undefined, 300000);
        if (!cancelled) setAuthStatus(data);
      } catch (err) {
        console.error('Could not load auth status:', err);
        if (!cancelled) setAuthStatus({ accountAuthEnabled: false, googleEnabled: false });
      }
    };

    void loadAuthStatus();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ── Guest usage counter ───────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = Number(window.localStorage.getItem('aawaz-guest-uses') || '0');
    if (Number.isFinite(stored)) setGuestUses(stored);
  }, []);

  /* ── Claim guest data after sign-in ────────────────────────────── */
  useEffect(() => {
    if (!accountUser?.id || claimedForRef.current === accountUser.id) return;
    claimedForRef.current = accountUser.id;

    let cancelled = false;
    const claim = async () => {
      try {
        // Server merges the guest identity from its own signed cookie.
        await requestJson<{ ok?: boolean }>('/api/account/claim-guest', { method: 'POST' }, 300000);

        if (cancelled) return;
        window.localStorage.removeItem('aawaz-user-id'); // legacy key cleanup
        window.localStorage.setItem('aawaz-guest-uses', '0');
        setGuestUses(0);
        const data = await requestJson<HistoryResponse>('/api/evaluations/history', undefined, 300000);
        if (!cancelled) setHistory(data.history || []);
      } catch {
        if (!cancelled) toast.error('Signed in, but guest history could not be attached.');
      }
    };

    void claim();
    return () => {
      cancelled = true;
    };
  }, [accountUser?.id]);

  /* ── Account profile ───────────────────────────────────────────── */
  useEffect(() => {
    if (!accountUser?.id) {
      setAccountProfile(null);
      return;
    }

    let cancelled = false;
    const loadProfile = async () => {
      try {
        const data = await requestJson<{ account?: AccountProfile }>('/api/account/profile', undefined, 300000);
        if (!cancelled) setAccountProfile(data.account ?? null);
      } catch (err) {
        console.error('Could not load account profile:', err);
        if (!cancelled) setAccountProfile(null);
      }
    };

    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [accountUser?.id]);

  /* ── Mic permission tracking ───────────────────────────────────── */
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;

    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        setMicPermission(result.state as MicPermission);
        result.onchange = () => setMicPermission(result.state as MicPermission);
      })
      .catch(() => null);

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  /* ── Analyzing stage rotation ──────────────────────────────────── */
  useEffect(() => {
    if (!isAnalyzing) {
      setAnalyzeStage(0);
      return;
    }
    const interval = setInterval(() => {
      setAnalyzeStage((stage) => Math.min(stage + 1, ANALYZE_STAGES.length - 1));
    }, 7000);
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  /* ── Unmount cleanup ───────────────────────────────────────────── */
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (voiceSampleTimerRef.current) clearInterval(voiceSampleTimerRef.current);
      const recorder = voiceSampleRecorderRef.current;
      voiceSampleRecorderRef.current = null;
      if (recorder?.state === 'recording' || recorder?.state === 'paused') {
        recorder.stop();
      }
      voiceSampleStreamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(speechAudioRef.current).forEach((item) => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
    };
  }, []);

  /* ── Auto-scroll to feedback ───────────────────────────────────── */
  useEffect(() => {
    if (feedback && feedbackRef.current) {
      const timeout = setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [feedback]);

  /* ── Guest gating ──────────────────────────────────────────────── */
  const trackGuestUse = (remaining?: number | null) => {
    if (accountUser) return;

    const used = typeof remaining === 'number' ? Math.max(0, 3 - remaining) : guestUses + 1;
    setGuestUses(used);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('aawaz-guest-uses', String(used));
    }

    if (used >= 2) {
      setAuthMode('sign-up');
      setAuthPromptOpen(true);
    }
  };

  const handleSpecialError = (err: unknown) => {
    if (err instanceof Error && err.name === 'AuthRequiredError') {
      setAuthMode('sign-up');
      setAuthPromptOpen(true);
      toast.error(err.message);
      return true;
    }

    if (err instanceof Error && err.name === 'IdentityRequiredError') {
      void fetch('/api/account/session', { cache: 'no-store' }).catch(() => null);
      toast.error('Session refreshed — please try that again.');
      return true;
    }

    return false;
  };

  /* ── Recording ─────────────────────────────────────────────────── */
  const startRecording = async () => {
    if (!identityReady) {
      toast.error('Still warming up. Give it a second and try again.');
      return;
    }

    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Audio recording is not supported in this browser.');
      return;
    }

    try {
      if (timerRef.current) clearInterval(timerRef.current);
      const activeRecorder = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (activeRecorder?.state === 'recording' || activeRecorder?.state === 'paused') {
        activeRecorder.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaStreamRef.current = stream;
      setRecordingStream(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        if (mediaRecorderRef.current !== recorder) {
          return;
        }

        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecordingStream(null);
        const audioType = recorder.mimeType || chunks[0]?.type || 'audio/webm;codecs=opus';
        const blob = new Blob(chunks, { type: audioType });
        // recorder.start(1000) emits ~1 chunk per second, so the first
        // VOICE_SAMPLE_SECONDS chunks ≈ the first 15 seconds of audio.
        const sampleBlob = new Blob(chunks.slice(0, VOICE_SAMPLE_SECONDS), { type: audioType });

        if (blob.size < 3000) {
          toast.error('No audio detected. Please speak clearly and try again.');
          setIsAnalyzing(false);
          return;
        }

        const form = new FormData();
        form.append('file', blob, 'speech.webm');
        if (sampleBlob.size >= 3000) {
          const voiceSampleBlob = await encodeVoiceSampleAsWav(sampleBlob).catch(() => sampleBlob);
          const voiceSampleName = voiceSampleBlob.type === 'audio/wav' ? 'voice-sample.wav' : 'voice-sample.webm';
          form.append('voiceSample', voiceSampleBlob, voiceSampleName);
        }
        if (selectedTemplateId) form.append('templateId', selectedTemplateId);
        try {
          const data = await requestJson<AnalyzeResponse>('/api/transcribe-analyze', { method: 'POST', body: form }, 300000);
          setTranscript(data.transcript || '');
          setFeedback(data.feedback || '');
          setHistory(data.history || []);
          setSelectedSessionId(null);
          if (data.voiceSampleSaved === false) {
            toast.error('Analysis completed, but the voice sample could not be stored for cloning.');
          }
          trackGuestUse(data.guestRemaining);
          toast.success('Report ready. Scroll for the verdict.');
        } catch (err) {
          if (handleSpecialError(err)) return;
          toast.error(err instanceof Error ? err.message : 'Failed to analyze speech.');
        } finally {
          setIsAnalyzing(false);
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setTranscript('');
      setFeedback('');
      setSeconds(0);
      setIsRecording(true);
      setIsAnalyzing(false);
      timerRef.current = setInterval(() => {
        setSeconds((current) => {
          const next = current + 1;
          if (next >= MAX_RECORDING_SECONDS) {
            window.setTimeout(() => stopRecording(), 0);
          }
          return next;
        });
      }, 1000);
      sfx.recordStart();
      toast.message('Recording. The room is yours.');
    } catch {
      setMicPermission('denied');
      sfx.oops();
      toast.error('Microphone access is required.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'recording') return;

    mediaRecorderRef.current.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setIsRecording(false);
    setIsAnalyzing(true);
    sfx.recordStop();
  };

  const resetSpeechRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder?.state === 'recording' || recorder?.state === 'paused') {
      recorder.stop();
    }

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setRecordingStream(null);
    setTranscript('');
    setFeedback('');
    setSeconds(0);
    setSelectedTemplateId(null);
    setIsRecording(false);
    setIsAnalyzing(false);
    toast.success('Fresh slate. Ready when you are.');
  };

  /* ── Auth ──────────────────────────────────────────────────────── */
  const getAuthStatus = async () => {
    try {
      const data = await requestJson<AuthStatus>('/api/account/auth-status', { cache: 'no-store' }, 300000);
      setAuthStatus(data);
      return data;
    } catch (err) {
      console.error('Could not load auth status:', err);
      const fallback = {
        accountAuthEnabled: false,
        googleEnabled: false,
        message: 'Account sign-in is not available because auth configuration could not be checked.',
      };
      setAuthStatus(fallback);
      return fallback;
    }
  };

  const submitAuth = async () => {
    if (isAuthBusy) return;

    const status = authStatus ?? await getAuthStatus();
    if (!status.accountAuthEnabled) {
      toast.error(status.message || 'Account sign-up needs Better Auth and Turso environment variables configured.');
      return;
    }

    const email = authEmail.trim();
    const password = authPassword;
    const name = authName.trim() || email.split('@')[0] || 'Aawaz User';

    if (!email || !password) {
      toast.error('Enter your email and password.');
      return;
    }

    if (authMode === 'sign-up' && !isValidAccountPassword(password)) {
      toast.error('Password must be longer than 5 characters and include letters and numbers.');
      return;
    }

    setIsAuthBusy(true);
    try {
      const result = authMode === 'sign-up'
        ? await authClient.signUp.email({ email, password, name })
        : await authClient.signIn.email({ email, password, rememberMe: true });

      if (result.error) {
        throw new Error(result.error.message || 'Authentication failed.');
      }

      await refetchSession();
      setAuthGreetingMode(authMode);
      setAuthPromptOpen(false);
      toast.success(authMode === 'sign-up' ? 'Account created. Welcome to the stage.' : 'Signed in. Welcome back.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setIsAuthBusy(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isAuthBusy) return;

    const status = await getAuthStatus();
    if (!status.accountAuthEnabled) {
      toast.error(status.message || 'Google sign-in needs Better Auth and Turso environment variables configured.');
      return;
    }
    if (!status.googleEnabled) {
      toast.error(status.message || 'Google sign-in needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET configured.');
      return;
    }

    setIsAuthBusy(true);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('auth', authMode);
      url.searchParams.delete('error');
      const result = await authClient.signIn.social({
        provider: 'google',
        callbackURL: url.toString(),
        errorCallbackURL: window.location.href,
        disableRedirect: true,
      });
      if (result.error) {
        const message = result.error.message || result.error.statusText || 'Google sign-in failed.';
        throw new Error(message === 'Google sign-in failed.'
          ? 'Google sign-in could not start. Check Better Auth, Turso, and Google OAuth environment variables.'
          : message);
      }
      if (result.data?.url) {
        window.location.assign(result.data.url);
        return;
      }
      throw new Error('Google sign-in did not return a redirect URL.');
    } catch (err) {
      setIsAuthBusy(false);
      toast.error(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const signOut = async () => {
    setIsAuthBusy(true);
    try {
      await authClient.signOut();
      claimedForRef.current = null;
      await refetchSession();
      setHistory([]);
      setSelectedSessionId(null);
      setAuthGreetingMode(null);
      setAccountProfile(null);
      toast.success('Signed out.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not sign out.');
    } finally {
      setIsAuthBusy(false);
    }
  };

  /* ── Speech generation ─────────────────────────────────────────── */
  const generateSpeech = async () => {
    if (isGenerating) return;

    if (!topic.trim()) {
      toast.error('Enter a topic first.');
      return;
    }
    setIsGenerating(true);
    setSpeech('');
    Object.values(speechAudioRef.current).forEach((item) => {
      if (item.url) URL.revokeObjectURL(item.url);
    });
    setSpeechAudio({
      example: { url: '', isLoading: false },
      clone: { url: '', isLoading: false },
    });
    setError('');
    try {
      const data = await requestJson<SpeechResponse>('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, wordCount, templateId: speechTemplateId }),
      }, 300000);
      setSpeech(data.speech || '');
      trackGuestUse(data.guestRemaining);
      sfx.success();
      toast.success('Script ready. Make it yours.');
    } catch (err) {
      if (handleSpecialError(err)) {
        setError(err instanceof Error ? err.message : 'Create an account to continue.');
        return;
      }
      const message = err instanceof Error ? err.message : 'Failed to generate.';
      setError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateSpeechAudio = async (mode: SpeechAudioMode) => {
    if (!speech.trim()) {
      toast.error('First generate a text script.');
      return;
    }

    // Guard against duplicate clicks and racing with sample changes.
    if (speechAudio[mode].isLoading || isVoiceSampleRecording || isVoiceSampleSaving || isVoiceSampleResetting) return;

    const form = new FormData();
    form.append('mode', mode);
    form.append('text', speech);
    if (mode === 'example') form.append('exampleVoice', exampleVoice);

    if (speechAudioRef.current[mode].url) {
      URL.revokeObjectURL(speechAudioRef.current[mode].url);
    }

    setSpeechAudio((current) => ({
      ...current,
      [mode]: { url: '', isLoading: true },
    }));

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 300000);

    try {
      const res = await fetch('/api/generate-speech-audio', {
        method: 'POST',
        body: form,
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.authRequired) {
          const authError = new Error(typeof data.error === 'string' ? data.error : 'Create an account to continue.');
          authError.name = 'AuthRequiredError';
          throw authError;
        }
        if (data.identityRequired) {
          const idError = new Error(typeof data.error === 'string' ? data.error : 'Session expired.');
          idError.name = 'IdentityRequiredError';
          throw idError;
        }
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not generate speech audio.');
      }

      const blob = await res.blob();
      if (!blob.size) throw new Error('The voice model returned an empty audio file.');
      const url = URL.createObjectURL(blob);
      setSpeechAudio((current) => {
        if (current[mode].url) URL.revokeObjectURL(current[mode].url);
        return {
          ...current,
          [mode]: { url, isLoading: false },
        };
      });
      trackGuestUse(null);
      sfx.pop();
      toast.success(mode === 'clone' ? "That's you, polished." : 'Example speech ready.');
    } catch (err) {
      if (handleSpecialError(err)) {
        setSpeechAudio((current) => ({
          ...current,
          [mode]: { ...current[mode], isLoading: false },
        }));
        return;
      }
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Voice generation took too long. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Could not generate speech audio.';
      toast.error(message);
      setSpeechAudio((current) => ({
        ...current,
        [mode]: { ...current[mode], isLoading: false },
      }));
    } finally {
      window.clearTimeout(timeout);
    }
  };

  /* ── Voice sample lifecycle ────────────────────────────────────── */
  const resetVoiceSample = async () => {
    setIsVoiceSampleResetting(true);
    // Drop any audio generated with the old voice so it can't be reused.
    if (speechAudioRef.current.clone.url) {
      URL.revokeObjectURL(speechAudioRef.current.clone.url);
    }
    setSpeechAudio((current) => ({
      ...current,
      clone: { url: '', isLoading: false },
    }));

    try {
      const res = await fetch('/api/account/voice-sample', { method: 'DELETE' });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not delete the saved voice sample.');
      }

      setVoiceSamplePanelOpen(true);
      setVoiceSampleSeconds(0);
      toast.message('Old sample cleared. Ready for the new you.');
    } catch (err) {
      if (handleSpecialError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Could not reset the voice sample.');
    } finally {
      setIsVoiceSampleResetting(false);
    }
  };

  const openVoiceSampleRecorder = () => {
    setVoiceSampleMenuOpen(false);
    if (isVoiceSampleResetting || isVoiceSampleRecording || isVoiceSampleSaving || speechAudio.clone.isLoading) return;

    if (!identityReady) {
      toast.error('Still warming up. Give it a second and try again.');
      return;
    }

    if (isRecording || isAnalyzing) {
      toast.error('Finish the current speech recording first.');
      return;
    }

    setConfirmRequest({
      title: 'Replace voice sample?',
      body: 'Your previous sample will be deleted before the new recording starts. Own-voice audio will use the new sample from then on.',
      confirmLabel: 'Replace it',
      danger: true,
      action: resetVoiceSample,
    });
  };

  const saveVoiceSampleBlob = async (blob: Blob) => {
    if (blob.size < 3000) {
      setIsVoiceSampleSaving(false);
      toast.error('No audio detected. Please speak clearly and try again.');
      return;
    }

    setIsVoiceSampleSaving(true);
    const voiceSampleBlob = await encodeVoiceSampleAsWav(blob).catch(() => blob);
    const voiceSampleName = voiceSampleBlob.type === 'audio/wav' ? 'voice-sample.wav' : 'voice-sample.webm';
    const form = new FormData();
    form.append('voiceSample', voiceSampleBlob, voiceSampleName);

    try {
      const res = await fetch('/api/account/voice-sample', {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.error === 'string' ? data.error : 'Could not save the new voice sample.');
      }

      setVoiceSamplePanelOpen(false);
      setVoiceSampleSeconds(0);
      sfx.success();
      toast.success('New voice sample locked in.');
    } catch (err) {
      if (handleSpecialError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Could not save the new voice sample.');
    } finally {
      setIsVoiceSampleSaving(false);
    }
  };

  const stopVoiceSampleRecording = () => {
    if (voiceSampleRecorderRef.current?.state !== 'recording') return;

    voiceSampleRecorderRef.current.stop();
    if (voiceSampleTimerRef.current) clearInterval(voiceSampleTimerRef.current);
    voiceSampleTimerRef.current = null;
    setIsVoiceSampleRecording(false);
    setIsVoiceSampleSaving(true);
  };

  const startVoiceSampleRecording = async () => {
    if (isVoiceSampleRecording || isVoiceSampleSaving) return;

    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Audio recording is not supported in this browser.');
      return;
    }

    try {
      if (voiceSampleTimerRef.current) clearInterval(voiceSampleTimerRef.current);
      const activeRecorder = voiceSampleRecorderRef.current;
      voiceSampleRecorderRef.current = null;
      if (activeRecorder?.state === 'recording' || activeRecorder?.state === 'paused') {
        activeRecorder.stop();
      }
      voiceSampleStreamRef.current?.getTracks().forEach((track) => track.stop());

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission('granted');
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      voiceSampleStreamRef.current = stream;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (voiceSampleRecorderRef.current !== recorder) {
          return;
        }

        voiceSampleStreamRef.current?.getTracks().forEach((track) => track.stop());
        voiceSampleStreamRef.current = null;
        voiceSampleRecorderRef.current = null;
        const audioType = recorder.mimeType || chunks[0]?.type || 'audio/webm;codecs=opus';
        const blob = new Blob(chunks, { type: audioType });
        void saveVoiceSampleBlob(blob);
      };

      recorder.start(1000);
      voiceSampleRecorderRef.current = recorder;
      setVoiceSampleSeconds(0);
      setIsVoiceSampleRecording(true);
      setIsVoiceSampleSaving(false);
      voiceSampleTimerRef.current = setInterval(() => {
        setVoiceSampleSeconds((current) => {
          const next = current + 1;
          if (next >= VOICE_SAMPLE_SECONDS) {
            window.setTimeout(() => stopVoiceSampleRecording(), 0);
          }
          return Math.min(next, VOICE_SAMPLE_SECONDS);
        });
      }, 1000);
      toast.message('Recording your voice. Speak naturally.');
    } catch {
      setMicPermission('denied');
      toast.error('Microphone access is required.');
    }
  };

  const cancelVoiceSampleRecorder = () => {
    if (voiceSampleTimerRef.current) clearInterval(voiceSampleTimerRef.current);
    voiceSampleTimerRef.current = null;

    const recorder = voiceSampleRecorderRef.current;
    voiceSampleRecorderRef.current = null;
    if (recorder?.state === 'recording' || recorder?.state === 'paused') {
      recorder.stop();
    }

    voiceSampleStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceSampleStreamRef.current = null;
    setIsVoiceSampleRecording(false);
    setIsVoiceSampleSaving(false);
    setVoiceSampleSeconds(0);
    setVoiceSamplePanelOpen(false);
  };

  /* ── History ───────────────────────────────────────────────────── */
  const deleteSession = async (sessionId: string) => {
    if (deletingSessionIds.has(sessionId)) return;
    setDeletingSessionIds((current) => new Set(current).add(sessionId));

    try {
      const data = await requestJson<HistoryResponse>('/api/evaluations/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }, 300000);
      setHistory(data.history || []);
      setSelectedSessionId((current) => (current === sessionId ? null : current));
      toast.success('Session removed.');
    } catch (err) {
      if (!handleSpecialError(err)) {
        toast.error(err instanceof Error ? err.message : 'Failed to delete session.');
      }
    } finally {
      setDeletingSessionIds((current) => {
        const next = new Set(current);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const selectedSession = history.find((item) => item.id === selectedSessionId) ?? null;

  /* ── Insights ──────────────────────────────────────────────────── */
  const fetchInsights = async () => {
    if (isLoadingInsights) return;
    setIsLoadingInsights(true);
    setInsights([]);
    setWeaknesses([]);
    try {
      const data = await requestJson<InsightsResponse>('/api/generate-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }, 300000);
      setInsights(data.insights || []);
      setWeaknesses(data.weaknesses || []);
      trackGuestUse(null);
      sfx.success();
      toast.success('Insights ready.');
    } catch (err) {
      if (!handleSpecialError(err)) {
        toast.error(err instanceof Error ? err.message : 'Failed to generate insights.');
      }
    } finally {
      setIsLoadingInsights(false);
    }
  };

  /* ── Utilities ─────────────────────────────────────────────────── */
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

  const runConfirm = async () => {
    if (!confirmRequest || confirmBusy) return;
    setConfirmBusy(true);
    try {
      await confirmRequest.action();
      setConfirmRequest(null);
    } finally {
      setConfirmBusy(false);
    }
  };

  /* ── Auth controls (shared between Account tab and modal) ──────── */
  const authControls = (
    <div className="grid gap-4">
      <div className="inline-flex w-full rounded-full border border-white/10 bg-white/5 p-1">
        {(['sign-up', 'sign-in'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setAuthMode(mode)}
            className={cn(
              'h-10 flex-1 rounded-full font-mono text-[10px] uppercase tracking-[0.22em] transition',
              authMode === mode ? 'bg-[#ddd6fe] text-[#06060b]' : 'text-[#857ca2] hover:bg-white/10 hover:text-[#f2efff]',
            )}
            aria-pressed={authMode === mode}
          >
            {mode === 'sign-up' ? 'Create account' : 'Login'}
          </button>
        ))}
      </div>

      {authMode === 'sign-up' ? (
        <input
          value={authName}
          onChange={(event) => setAuthName(event.target.value)}
          placeholder="Your name"
          className="h-12 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/50"
        />
      ) : null}
      <input
        value={authEmail}
        onChange={(event) => setAuthEmail(event.target.value)}
        placeholder="Email"
        type="email"
        className="h-12 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/50"
      />
      <input
        value={authPassword}
        onChange={(event) => setAuthPassword(event.target.value)}
        placeholder="Password"
        type="password"
        className="h-12 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/50"
      />
      {authMode === 'sign-up' ? (
        <p className="font-mono text-[11px] leading-5 text-[#857ca2]">Password must be longer than 5 characters and include letters and numbers.</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button onClick={submitAuth} disabled={isAuthBusy} className="h-12 rounded-[18px] font-mono text-xs uppercase tracking-[0.22em]">
          {isAuthBusy ? 'Working…' : authMode === 'sign-up' ? 'Create' : 'Login'}
        </Button>
        <Button type="button" variant="secondary" onClick={signInWithGoogle} disabled={isAuthBusy} className="h-12 rounded-[18px] font-mono text-xs uppercase tracking-[0.18em]">
          Google
        </Button>
      </div>
    </div>
  );

  /* ── Account panel ─────────────────────────────────────────────── */
  const renderAccountPanel = () => {
    const createdAt = accountUser ? new Date(accountUser.createdAt) : null;
    const isNew = createdAt ? Date.now() - createdAt.getTime() < 120000 : false;
    const displayName = accountUser?.name || accountUser?.email?.split('@')[0] || 'Aawaz User';
    const greeting = authGreetingMode === 'sign-up' || (!authGreetingMode && isNew)
      ? `Welcome ${displayName}`
      : `Welcome back ${displayName}`;
    const createdDate = createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Unavailable';

    return (
      <Shell>
        {isSessionPending ? (
          <ThinkingDots />
        ) : accountUser ? (
          <div className="grid gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <motion.button
                type="button"
                onClick={() => {
                  sfx.pop();
                  setAvatarCustomizeOpen(true);
                }}
                whileTap={{ scale: 0.94 }}
                className="group relative h-20 w-20 shrink-0 cursor-pointer rounded-full shadow-[0_16px_40px_rgba(2,6,23,0.35)] outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#a78bfa]/60"
                aria-label="Customise your avatar"
                title="Customise your avatar"
              >
                <ProfileAvatar size={80} />
                <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-white/15 bg-[#0d0c16] text-[#ddd6fe] shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition group-hover:bg-[#1a1626]">
                  <Palette className="h-3.5 w-3.5" />
                </span>
              </motion.button>
              <div className="min-w-0">
                <p className="break-words font-serif text-2xl tracking-tight text-white sm:text-3xl">{greeting}</p>
                <p className="mt-1 break-all text-sm text-[#ddd6fe]">{accountUser.email}</p>
                <button
                  type="button"
                  onClick={() => {
                    sfx.pop();
                    setAvatarCustomizeOpen(true);
                  }}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#a78bfa]/30 bg-[#a78bfa]/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ddd6fe] transition hover:border-[#a78bfa]/55 hover:bg-[#a78bfa]/20 hover:text-white"
                >
                  <Palette className="h-3 w-3" />
                  Customise avatar
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'User name', value: displayName },
                { label: 'User email', value: accountUser.email },
                { label: 'Account created', value: createdDate },
                { label: 'Login method', value: accountProfile?.providerId || 'email' },
              ].map((item) => (
                <div key={item.label} className="rounded-[18px] border border-white/10 bg-white/4 p-4">
                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#857ca2]">{item.label}</div>
                  <div className="mt-1 break-words text-sm capitalize text-[#f2efff]">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
              <Button variant="secondary" onClick={signOut} disabled={isAuthBusy} className="h-11 rounded-[16px] font-mono text-xs uppercase tracking-[0.1em]">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmRequest({
                  title: 'Delete all data?',
                  body: 'All saved speeches and voice samples will be permanently deleted. This cannot be undone.',
                  confirmLabel: 'Delete data',
                  danger: true,
                  action: async () => {
                    try {
                      await requestJson('/api/account/delete-data', { method: 'DELETE' });
                      setHistory([]);
                      toast.success('Account data deleted.');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to delete data.');
                    }
                  },
                })}
                className="h-11 rounded-[16px] font-mono text-xs uppercase tracking-[0.1em]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Data
              </Button>
              <Button
                variant="danger"
                onClick={() => setConfirmRequest({
                  title: 'Delete your account?',
                  body: 'This logs you out and permanently deletes your account and all data. There is no way back.',
                  confirmLabel: 'Delete account',
                  danger: true,
                  action: async () => {
                    try {
                      await requestJson('/api/account/delete-account', { method: 'DELETE' });
                      await authClient.signOut().catch(() => null);
                      claimedForRef.current = null;
                      await refetchSession();
                      setAccountProfile(null);
                      setAuthGreetingMode(null);
                      setHistory([]);
                      setSelectedSessionId(null);
                      toast.success('Account deleted.');
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to delete account.');
                    }
                  },
                })}
                className="h-11 rounded-[16px] font-mono text-xs uppercase tracking-[0.1em]"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Account
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5">
            <MascotHint mood="coach" title="Save your progress">
              Try Aawaz freely first. After a few AI actions, create an account to keep your speech history, insights, and voice sample.
            </MascotHint>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#ddd6fe]">Guest uses: {Math.min(guestUses, 3)} / 3</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#f9a8d4)] transition-all duration-500"
                  style={{ width: `${Math.min(100, (Math.min(guestUses, 3) / 3) * 100)}%` }}
                />
              </div>
            </div>
            {authControls}
          </div>
        )}
      </Shell>
    );
  };

  /* ── Speech audio actions (example + own-voice) ────────────────── */
  const renderSpeechAudioActions = () => {
    const voiceBusy = isVoiceSampleRecording || isVoiceSampleSaving || isVoiceSampleResetting;

    return (
      <div className="mb-5 grid gap-3 lg:grid-cols-2">
        {/* Example voice */}
        <div className="rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-3.5 transition-colors hover:border-white/15 sm:rounded-[24px] sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f2efff]">Example speech</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] leading-relaxed text-[#857ca2]">Polished public-speaking voice</p>
            </div>
            <div className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/5 p-1">
              {(['female', 'male'] as const).map((voice) => (
                <button
                  key={voice}
                  type="button"
                  onClick={() => {
                    if (speechAudio.example.isLoading || exampleVoice === voice) return;
                    if (speechAudioRef.current.example.url) {
                      URL.revokeObjectURL(speechAudioRef.current.example.url);
                    }
                    setExampleVoice(voice);
                    setSpeechAudio((current) => ({
                      ...current,
                      example: { url: '', isLoading: false },
                    }));
                  }}
                  disabled={speechAudio.example.isLoading}
                  className={cn(
                    'h-8 rounded-full px-3 font-mono text-[10px] uppercase tracking-[0.16em] transition disabled:pointer-events-none disabled:opacity-60',
                    exampleVoice === voice
                      ? 'bg-[#ddd6fe] text-[#06060b]'
                      : 'text-[#857ca2] hover:bg-white/10 hover:text-[#f2efff]',
                  )}
                  aria-pressed={exampleVoice === voice}
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>
          {speechAudio.example.url ? (
            <AudioPlayer src={speechAudio.example.url} downloadName={`aawaz-example-${exampleVoice}-speech.opus`} />
          ) : (
            <button
              type="button"
              onClick={() => generateSpeechAudio('example')}
              disabled={speechAudio.example.isLoading || isGenerating}
              className={cn(
                'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(249,168,212,0.10))] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#f2efff] transition hover:border-[#a78bfa]/45 disabled:pointer-events-none disabled:opacity-60 sm:rounded-[18px]',
                speechAudio.example.isLoading && 'skeleton-shimmer',
              )}
            >
              <Volume2 className={cn('h-4 w-4 shrink-0', speechAudio.example.isLoading && 'animate-pulse')} />
              {speechAudio.example.isLoading ? 'Synthesizing…' : 'Hear example speech'}
            </button>
          )}
        </div>

        {/* Own voice */}
        <div className="rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-3.5 transition-colors hover:border-white/15 sm:rounded-[24px] sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f2efff]">Your own voice</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] leading-relaxed text-[#857ca2]">Uses your saved 15s sample</p>
            </div>
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setVoiceSampleMenuOpen((open) => !open)}
                disabled={speechAudio.clone.isLoading || isGenerating || voiceBusy}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#ddd6fe] transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Voice sample options"
                aria-expanded={voiceSampleMenuOpen}
              >
                <ChevronDown className={cn('h-4 w-4 transition', voiceSampleMenuOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {voiceSampleMenuOpen ? (
                  <button
                    type="button"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setVoiceSampleMenuOpen(false)}
                    aria-label="Close voice sample options"
                    tabIndex={-1}
                  />
                ) : null}
                {voiceSampleMenuOpen ? (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.97 }}
                    className="absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded-[16px] border border-white/10 bg-[#15131f] p-1 shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
                  >
                    <button
                      type="button"
                      onClick={openVoiceSampleRecorder}
                      disabled={isVoiceSampleResetting}
                      className="flex w-full items-center gap-2 rounded-[13px] px-3 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-[#f2efff] transition hover:bg-white/8"
                    >
                      <Mic className="h-4 w-4 text-[#ddd6fe]" />
                      {isVoiceSampleResetting ? 'Deleting old sample…' : 'Record new sample'}
                    </button>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
          {speechAudio.clone.url ? (
            <AudioPlayer src={speechAudio.clone.url} downloadName="aawaz-your-voice-speech.opus" />
          ) : (
            <button
              type="button"
              onClick={() => generateSpeechAudio('clone')}
              disabled={speechAudio.clone.isLoading || isGenerating || voiceBusy}
              className={cn(
                'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-[#f9a8d4]/25 bg-[linear-gradient(135deg,rgba(249,168,212,0.16),rgba(167,139,250,0.10))] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#f2efff] transition hover:border-[#f9a8d4]/45 disabled:pointer-events-none disabled:opacity-60 sm:rounded-[18px]',
                speechAudio.clone.isLoading && 'skeleton-shimmer',
              )}
            >
              <Mic className={cn('h-4 w-4 shrink-0', speechAudio.clone.isLoading && 'animate-pulse')} />
              {speechAudio.clone.isLoading ? 'Cloning your voice…' : 'Hear it in your voice'}
            </button>
          )}
        </div>

        {/* Voice sample recorder panel */}
        <AnimatePresence>
          {voiceSamplePanelOpen ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="rounded-[20px] border border-[#a78bfa]/25 bg-[#0b0b12]/65 p-4 sm:rounded-[24px] sm:p-5 lg:col-span-2"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <MascotHint mood="sing" title="New voice sample" size={56} className="min-w-0">
                  Read anything aloud for 15 seconds — naturally, like you&apos;re talking to a friend. I&apos;ll learn your voice from it.
                </MascotHint>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex h-11 min-w-16 items-center justify-center rounded-[16px] border border-white/10 bg-white/5 font-mono text-sm tabular-nums text-[#f2efff]">
                    {voiceSampleSeconds}s
                  </div>
                  <Button
                    type="button"
                    variant={isVoiceSampleRecording ? 'danger' : 'secondary'}
                    onClick={isVoiceSampleRecording ? stopVoiceSampleRecording : startVoiceSampleRecording}
                    disabled={isVoiceSampleSaving}
                    className="h-11 rounded-[16px] px-4 font-mono text-[10px] uppercase tracking-[0.16em]"
                  >
                    {isVoiceSampleRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    {isVoiceSampleSaving ? 'Saving…' : isVoiceSampleRecording ? 'Stop' : 'Record'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={cancelVoiceSampleRecorder}
                    disabled={isVoiceSampleSaving}
                    className="h-11 w-11 rounded-[16px]"
                    aria-label="Close voice sample recorder"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#a78bfa,#f9a8d4)] transition-all duration-700"
                  style={{ width: `${Math.min(100, (voiceSampleSeconds / VOICE_SAMPLE_SECONDS) * 100)}%` }}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  };

  /* ── Recorder card ─────────────────────────────────────────────── */
  const recordProgress = Math.min(1, seconds / MAX_RECORDING_SECONDS);
  const RING_R = 56;
  const RING_C = 2 * Math.PI * RING_R;

  const renderRecorderCard = () => (
    <Shell>
      <div className="grid gap-6 lg:grid-cols-[1fr,auto] lg:items-center">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
              isRecording
                ? 'border-[#f87171]/30 bg-[#dc2626]/10 text-[#fca5a5]'
                : isAnalyzing
                  ? 'border-[#a78bfa]/30 bg-[#a78bfa]/10 text-[#ddd6fe]'
                  : 'border-white/10 bg-white/6 text-[#cfc8e8]',
            )}>
              <span className={cn(
                'block h-2 w-2 rounded-full',
                isRecording ? 'animate-pulse bg-[#f87171]' : isAnalyzing ? 'animate-pulse bg-[#a78bfa]' : 'bg-[#4ade80]',
              )} />
              {isAnalyzing ? 'Analyzing' : isRecording ? 'Recording' : 'Ready'}
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2 font-mono text-sm tabular-nums text-[#f2efff]">
              {formatClock(seconds)}
              <span className="text-[#857ca2]">/ {formatClock(MAX_RECORDING_SECONDS)}</span>
            </div>
          </div>

          {micPermission === 'denied' && !isRecording ? (
            <div className="rounded-[18px] border border-[#facc15]/25 bg-[#facc15]/8 px-4 py-3 text-sm leading-6 text-[#fde68a]">
              Your microphone is blocked. Allow mic access in the browser&apos;s site settings, then try again.
            </div>
          ) : null}

          <AnimatePresence mode="wait">
            {isRecording ? (
              <motion.div
                key="waveform"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="h-16 rounded-[20px] border border-white/10 bg-white/6 px-3 py-2 sm:h-20 sm:rounded-[24px]">
                  <LiveWaveform stream={recordingStream} />
                </div>
              </motion.div>
            ) : !isAnalyzing && !feedback ? (
              <motion.div key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <MascotHint mood="idle" size={58}>
                  Pick a rubric above, tap the mic, and give it everything. I&apos;ll be brutally honest — that&apos;s the job.
                </MascotHint>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <div className="scene-3d flex flex-col items-center gap-3">
          <div className="relative grid h-28 w-28 place-items-center sm:h-32 sm:w-32">
            {/* Breathing glow halo — the hero's light source */}
            <div
              aria-hidden
              className={cn(
                'mic-glow pointer-events-none absolute h-[160%] w-[160%] rounded-full blur-2xl',
                isRecording
                  ? 'bg-[radial-gradient(circle,rgba(248,113,113,0.6),transparent_66%)]'
                  : 'bg-[radial-gradient(circle,rgba(167,139,250,0.5),rgba(249,168,212,0.3)_45%,transparent_72%)]',
              )}
            />
            {isRecording ? (
              <>
                <span className="pulse-ring absolute inset-0 rounded-full border-2 border-[#f87171]/50" />
                <span className="pulse-ring absolute inset-0 rounded-full border-2 border-[#f87171]/30" style={{ animationDelay: '0.6s' }} />
              </>
            ) : null}

            {/* Progress / timer ring with gradient stroke + glow */}
            <svg viewBox="0 0 124 124" className="pointer-events-none absolute h-[calc(100%+18px)] w-[calc(100%+18px)]">
              <defs>
                <linearGradient id="micRingIdle" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#c4b5fd" />
                  <stop offset="100%" stopColor="#f9a8d4" />
                </linearGradient>
                <linearGradient id="micRingRec" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="100%" stopColor="#fb7185" />
                </linearGradient>
              </defs>
              <circle cx="62" cy="62" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
              {isRecording || seconds > 0 ? (
                <circle
                  cx="62"
                  cy="62"
                  r={RING_R}
                  fill="none"
                  stroke={isRecording ? 'url(#micRingRec)' : 'url(#micRingIdle)'}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={RING_C}
                  strokeDashoffset={RING_C * (1 - recordProgress)}
                  transform="rotate(-90 62 62)"
                  className="transition-[stroke-dashoffset] duration-1000 ease-linear"
                  style={{ filter: 'drop-shadow(0 0 6px rgba(167,139,250,0.55))' }}
                />
              ) : null}
            </svg>

            {/* The hero button — layered depth + physical 3D press */}
            <motion.button
              whileTap={{ scale: 0.9, rotateX: reduceMotion ? 0 : 12 }}
              whileHover={!isRecording && !isAnalyzing ? { y: reduceMotion ? 0 : -3, scale: 1.03 } : undefined}
              animate={isRecording && !reduceMotion ? { scale: [1, 1.045, 1] } : { scale: 1 }}
              transition={isRecording ? { duration: 1.8, repeat: Infinity } : { type: 'spring', stiffness: 320, damping: 18 }}
              style={{ transformPerspective: 700 }}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isAnalyzing}
              className={cn(
                'relative flex h-full w-full items-center justify-center rounded-full border transition-shadow disabled:opacity-60',
                isRecording
                  ? 'border-[#f87171]/40 bg-[linear-gradient(135deg,#dc2626,#f87171)] text-[#fff5f5] shadow-[0_18px_50px_rgba(220,38,38,0.5),inset_0_2px_4px_rgba(255,255,255,0.25),inset_0_-7px_15px_rgba(0,0,0,0.35)]'
                  : 'border-white/15 bg-[linear-gradient(140deg,#c4b5fd_0%,#a78bfa_42%,#f9a8d4_100%)] text-[#06060b] shadow-[0_22px_55px_rgba(167,139,250,0.42),inset_0_2px_5px_rgba(255,255,255,0.55),inset_0_-8px_16px_rgba(124,92,222,0.45)] hover:shadow-[0_28px_72px_rgba(167,139,250,0.55),inset_0_2px_5px_rgba(255,255,255,0.6),inset_0_-8px_16px_rgba(124,92,222,0.5)]',
              )}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {/* glossy top reflection */}
              <span aria-hidden className="pointer-events-none absolute inset-x-3 top-2 h-1/3 rounded-full bg-[linear-gradient(180deg,rgba(255,255,255,0.5),transparent)] opacity-70" />
              {isAnalyzing ? <Sparkles className="relative h-10 w-10 animate-spin" /> : isRecording ? <Square className="relative h-9 w-9" /> : <Mic className="relative h-10 w-10" />}
            </motion.button>
          </div>
          <div className="text-center font-mono text-[10px] uppercase tracking-[0.24em] text-[#857ca2] sm:text-[11px]">
            {isAnalyzing ? 'Hold tight' : isRecording ? 'Tap to stop' : 'Tap to speak'}
          </div>
        </div>
      </div>
    </Shell>
  );

  /* ── Render ────────────────────────────────────────────────────── */
  const tabMeta = TAB_META[activeTab];

  /* Horizontal slide with subtle perspective/depth between screens.
     Softened to a plain crossfade when the user prefers reduced motion. */
  const tabVariants: Variants = {
    enter: (dir: number) =>
      reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * 56, rotateY: dir * -7, z: -80 },
    center: reduceMotion
      ? { opacity: 1, transition: { duration: 0.2 } }
      : { opacity: 1, x: 0, rotateY: 0, z: 0, transition: { type: 'spring', stiffness: 280, damping: 30, mass: 0.85 } },
    exit: (dir: number) =>
      reduceMotion
        ? { opacity: 0, transition: { duration: 0.15 } }
        : { opacity: 0, x: dir * -56, rotateY: dir * 7, z: -80, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
  };

  const helpContent = (
    <div className="space-y-2">
      <p>Use <span className="text-[#ddd6fe]">Speaking Coach</span> to record and get feedback.</p>
      <p>Use <span className="text-[#ddd6fe]">Speech Practice</span> to generate a sample speech.</p>
      <p>Use <span className="text-[#ddd6fe]">Speech History</span> to review saved sessions.</p>
      <p>Use <span className="text-[#ddd6fe]">Progress</span> to track your improvement over time.</p>
      <p>Use <span className="text-[#ddd6fe]">Account</span> to save your work across devices.</p>
    </div>
  );

  const creatorContent = (
    <p>ello boyz and gurls speak your heart out but nabirsa hai AI can make mistakes and very big ones so kei problems aaye ma contact me directly hai! - aawaz</p>
  );

  return (
    <div className="min-h-screen overflow-x-hidden text-[#f2efff]">
      <Toaster position="top-right" richColors theme="dark" />
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        {/* ── Desktop sidebar ─────────────────────────────── */}
        <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/8 p-5 md:flex lg:w-80">
          <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(135deg,rgba(167,139,250,0.14),rgba(249,168,212,0.12))] p-4">
            <CoachMascot mood="idle" size={52} float={false} interactive className="shrink-0" />
            <div className="min-w-0">
              <div className="font-serif text-3xl leading-none tracking-[-0.04em]">Aawaz</div>
              <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.28em] text-[#ddd6fe]">Speaker Coach</div>
            </div>
          </div>

          <nav className="mt-6 grid gap-1.5">
            {navItems.map(({ id, label, icon: Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  onClick={() => switchTab(id)}
                  className={cn(
                    'relative flex items-center gap-3 rounded-[18px] px-4 py-3.5 text-left transition',
                    active ? 'text-white' : 'text-[#a79dc8] hover:bg-white/5 hover:text-[#f2efff]',
                  )}
                >
                  {active ? (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-[18px] border border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(167,139,250,0.16),rgba(249,168,212,0.10))]"
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  ) : null}
                  <span className={cn(
                    'relative flex h-9 w-9 items-center justify-center rounded-xl transition',
                    active ? 'bg-white/12 text-[#ddd6fe]' : 'bg-white/6 text-[#857ca2]',
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="relative text-sm font-medium">{label}</span>
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={openCustomizer}
            className="group mt-2 flex items-center gap-3 rounded-[18px] px-4 py-3.5 text-left text-[#a79dc8] transition hover:bg-white/5 hover:text-[#f2efff]"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-[#857ca2] transition group-hover:text-[#ddd6fe]">
              <Palette className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 block h-2 w-2 rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)]" />
            </span>
            <span className="text-sm font-medium">
              Customise <span className="bg-[linear-gradient(90deg,#a78bfa,#f9a8d4)] bg-clip-text text-transparent">Aawax</span>
            </span>
          </button>

          <div className="mt-auto rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
            {accountUser ? (
              <div className="flex items-center gap-2.5">
                <span className="block h-2 w-2 shrink-0 rounded-full bg-[#4ade80]" />
                <span className="truncate text-xs text-[#cfc8e8]">{accountUser.name || accountUser.email}</span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#857ca2]">Guest mode</span>
                <span className="font-mono text-[10px] text-[#ddd6fe]">{Math.min(guestUses, 3)}/3 uses</span>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main column ─────────────────────────────────── */}
        <main className="min-w-0 flex-1 px-3 pb-28 pt-5 sm:px-4 md:px-6 md:pb-14 md:pt-8 lg:px-8">
          {/* Mobile brand bar */}
          <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <CoachMascot mood="idle" size={38} float={false} interactive className="shrink-0" />
              <span className="truncate font-serif text-2xl tracking-[-0.04em]">Aawaz</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <PopupIconButton onClick={openCustomizer} icon={<Palette className="h-4 w-4" />} label="Customise Aawax" />
              <div className="relative">
                <PopupIconButton onClick={() => { setCreatorOpen((c) => !c); setHelpOpen(false); }} icon={<MessageCircleMore className="h-4 w-4" />} label="Open creator message" />
                <AnimatePresence>
                  {creatorOpen ? <PopupPanel title="Message From The Creator" onClose={() => setCreatorOpen(false)}>{creatorContent}</PopupPanel> : null}
                </AnimatePresence>
              </div>
              <div className="relative">
                <PopupIconButton onClick={() => { setHelpOpen((c) => !c); setCreatorOpen(false); }} icon={<span className="text-sm font-bold">?</span>} label="Open app help" />
                <AnimatePresence>
                  {helpOpen ? <PopupPanel title="Quick Help" onClose={() => setHelpOpen(false)}>{helpContent}</PopupPanel> : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait" custom={tabDirection}>
            <motion.div
              key={activeTab}
              custom={tabDirection}
              variants={tabVariants}
              initial="enter"
              animate="center"
              exit="exit"
              style={{ transformPerspective: 1200 }}
              className="grid gap-4 sm:gap-5"
            >
              {/* ── Header ──────────────────────────────── */}
              {activeTab !== 'aawax' ? (
              <div className="relative z-20 flex items-end justify-between gap-4 px-1 pt-1">
                <div className="min-w-0">
                  <Eyebrow>{activeTab}</Eyebrow>
                  <h1 className="mt-1.5 font-serif text-[clamp(2rem,4.5vw,3.2rem)] leading-[1] tracking-[-0.035em] text-white">{tabMeta.title}</h1>
                  <p className="mt-1.5 text-sm text-[#857ca2]">{tabMeta.subtitle}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2 pb-1">
                  <div className="relative hidden md:block">
                    <PopupIconButton onClick={() => { setCreatorOpen((c) => !c); setHelpOpen(false); }} icon={<MessageCircleMore className="h-4 w-4" />} label="Open creator message" />
                    <AnimatePresence>
                      {creatorOpen ? <PopupPanel title="Message From The Creator" onClose={() => setCreatorOpen(false)}>{creatorContent}</PopupPanel> : null}
                    </AnimatePresence>
                  </div>
                  <div className="relative hidden md:block">
                    <PopupIconButton onClick={() => { setHelpOpen((c) => !c); setCreatorOpen(false); }} icon={<span className="text-sm font-bold">?</span>} label="Open app help" />
                    <AnimatePresence>
                      {helpOpen ? <PopupPanel title="Quick Help" onClose={() => setHelpOpen(false)}>{helpContent}</PopupPanel> : null}
                    </AnimatePresence>
                  </div>
                  {activeTab === 'coach' && (transcript || feedback || isRecording || isAnalyzing) ? (
                    <button
                      type="button"
                      onClick={resetSpeechRecording}
                      className="flex items-center gap-2 rounded-full border border-[#a78bfa]/30 bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(249,168,212,0.12))] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#ddd6fe] shadow-[0_0_16px_rgba(167,139,250,0.18)] transition hover:bg-white/10"
                      aria-label="New speech"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      New speech
                    </button>
                  ) : null}
                </div>
              </div>
              ) : null}

              {/* ── Aawax chat tab ──────────────────────── */}
              {activeTab === 'aawax' && (
                <AawaxChatPage
                  messages={aawaxMessages}
                  setMessages={setAawaxMessages}
                  contextTab={lastNonAawaxTab.current}
                  onBack={() => switchTab(lastNonAawaxTab.current)}
                />
              )}

              {/* ── Coach tab ───────────────────────────── */}
              {activeTab === 'coach' && (
                <>
                  <TemplatePicker value={selectedTemplateId} onChange={setSelectedTemplateId} disabled={isRecording || isAnalyzing} />
                  {renderRecorderCard()}

                  <AnimatePresence>
                    {isAnalyzing ? (
                      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                        <Shell tone="accent">
                          <div className="flex items-center gap-4">
                            <CoachMascot mood="think" size={72} className="shrink-0" />
                            <div className="min-w-0 flex-1">
                              <AnimatePresence mode="wait">
                                <motion.p
                                  key={analyzeStage}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -6 }}
                                  className="font-serif text-lg tracking-tight text-white sm:text-xl"
                                >
                                  {ANALYZE_STAGES[analyzeStage]}
                                </motion.p>
                              </AnimatePresence>
                              <SkeletonLines lines={3} className="mt-4" />
                            </div>
                          </div>
                        </Shell>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {transcript && (
                    <CollapsibleSection title="Transcript" defaultOpen={!feedback}>
                      <p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-[#f2efff] sm:leading-8">{transcript}</p>
                      <ActionBar text={transcript} label="Transcript" copyText={copyText} speakText={speakText} />
                    </CollapsibleSection>
                  )}
                  {feedback && <div ref={feedbackRef}><FeedbackReport feedback={feedback} copyText={copyText} speakText={speakText} celebrate /></div>}
                </>
              )}

              {/* ── Speech tab ──────────────────────────── */}
              {activeTab === 'speech' && (
                <>
                  <Shell>
                    <Label.Root htmlFor="speech-topic" className="mb-2 block text-sm text-[#ddd6fe]">Speech topic</Label.Root>
                    <div className="grid gap-4 lg:grid-cols-[1fr,auto,auto]">
                      <input
                        id="speech-topic"
                        value={topic}
                        onChange={(event) => setTopic(event.target.value)}
                        onKeyDown={(event) => event.key === 'Enter' && generateSpeech()}
                        placeholder="e.g. Leadership, climate change, discipline"
                        className="h-14 min-w-0 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/50 sm:rounded-[22px] sm:px-5"
                      />
                      <div className="flex h-14 items-center justify-between gap-3 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-3 text-[#f2efff] sm:rounded-[22px] lg:w-[260px]">
                        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#ddd6fe]">Words</span>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => setWordCount((current) => Math.max(80, current - 25))} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#ddd6fe] transition hover:bg-white/10" aria-label="Decrease word count">-</button>
                          <input
                            aria-label="Speech word count"
                            value={wordCount}
                            onChange={(event) => {
                              const next = Number(event.target.value);
                              if (Number.isNaN(next)) return;
                              setWordCount(Math.min(500, Math.max(80, next)));
                            }}
                            className="h-8 w-14 rounded-full border border-[#a78bfa]/30 bg-white/5 text-center font-mono text-sm text-[#f2efff] outline-none focus:border-[#a78bfa]/70"
                            inputMode="numeric"
                          />
                          <button type="button" onClick={() => setWordCount((current) => Math.min(500, current + 25))} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[#ddd6fe] transition hover:bg-white/10" aria-label="Increase word count">+</button>
                        </div>
                      </div>
                      <Button onClick={generateSpeech} disabled={isGenerating || !topic.trim()} className="h-14 w-full rounded-[18px] px-6 font-mono text-xs uppercase tracking-[0.22em] sm:rounded-[22px] md:w-auto">
                        <Sparkles className={cn('h-4 w-4', isGenerating && 'animate-spin')} />
                        {isGenerating ? 'Writing…' : 'Generate'}
                      </Button>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,340px)_1fr] sm:items-center">
                      <FormatSelect value={speechTemplateId} onChange={setSpeechTemplateId} disabled={isGenerating} />
                      <p className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] leading-relaxed text-[#857ca2]">
                        {speechTemplateId ? 'The script will follow this format\u2019s structure.' : 'Pick a format and the script will follow its rubric.'}
                      </p>
                    </div>
                    {error ? <p className="mt-3 font-mono text-xs text-[#f87171]">{error}</p> : null}
                  </Shell>

                  {!speech && !isGenerating ? (
                    <Shell>
                      <MascotHint mood="coach" size={60}>
                        Give me a topic and I&apos;ll draft a speech worth practicing. Then hear it in a pro voice — or in yours.
                      </MascotHint>
                    </Shell>
                  ) : null}

                  {(speech || isGenerating) && (
                    <Shell>
                      <div className="mb-4 flex items-center justify-between">
                        <Eyebrow>Sample Speech</Eyebrow>
                        {!isGenerating && <Button variant="ghost" size="icon" onClick={generateSpeech} title="Regenerate speech"><RefreshCw className="h-4 w-4" /></Button>}
                      </div>
                      {isGenerating ? (
                        <div className="flex items-start gap-4">
                          <CoachMascot mood="think" size={62} className="shrink-0" />
                          <div className="min-w-0 flex-1 pt-2">
                            <p className="mb-4 font-serif text-lg tracking-tight text-white">Drafting something worth saying…</p>
                            <SkeletonLines lines={5} />
                          </div>
                        </div>
                      ) : (
                        <>
                          {renderSpeechAudioActions()}
                          <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-[#f2efff] sm:leading-8">{speech}</p>
                          <ActionBar text={speech} label="Speech" onRegenerate={generateSpeech} copyText={copyText} speakText={speakText} />
                        </>
                      )}
                    </Shell>
                  )}
                </>
              )}

              {/* ── History tab ─────────────────────────── */}
              {activeTab === 'history' && (
                <>
                  <Shell>
                    {historyLoading ? (
                      <div className="grid gap-3">
                        {[0, 1, 2].map((i) => (
                          <div key={i} className="rounded-[20px] border border-white/8 p-4 sm:p-5">
                            <SkeletonLines lines={2} />
                          </div>
                        ))}
                      </div>
                    ) : history.length ? (
                      <div className="grid gap-3">
                        {history.map((item, index) => {
                          const isSelected = selectedSessionId === item.id;
                          const isDeleting = deletingSessionIds.has(item.id);
                          return (
                            <motion.div
                              key={item.id}
                              layout="position"
                              initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.98 }}
                              animate={{ opacity: isDeleting ? 0.4 : 1, y: 0, scale: 1 }}
                              transition={{ delay: index * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
                              whileHover={reduceMotion || isDeleting ? undefined : { y: -3 }}
                              className={cn(
                                'glass-edge rounded-[20px] border transition-colors sm:rounded-[24px]',
                                isSelected
                                  ? 'border-[#a78bfa]/40 bg-[linear-gradient(135deg,rgba(167,139,250,0.12),rgba(249,168,212,0.08))] shadow-[0_10px_30px_rgba(167,139,250,0.18)]'
                                  : 'border-white/10 bg-white/4 hover:border-white/20 hover:shadow-[0_12px_30px_rgba(2,6,23,0.4)]',
                              )}
                            >
                              <div className="p-4 sm:p-5">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                                  <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#ddd6fe] sm:text-[11px]">
                                    Session {history.length - index} · {formatHistoryDate(item.created_at)}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ScoreBadge score={item.overall_score} />
                                    <Button
                                      variant="danger"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={isDeleting}
                                      aria-label="Delete session"
                                      onClick={() => {
                                        setConfirmRequest({
                                          title: 'Delete this session?',
                                          body: 'The transcript and coach report for this speech will be gone for good.',
                                          confirmLabel: 'Delete',
                                          danger: true,
                                          action: () => deleteSession(item.id),
                                        });
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setSelectedSessionId(isSelected ? null : item.id)}
                                  disabled={isDeleting}
                                  className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                                  aria-expanded={isSelected}
                                >
                                  <div className="break-words text-sm sm:text-base">{item.template_label ?? 'General Evaluation'}</div>
                                  <div className="flex items-center gap-2 font-mono text-xs text-[#857ca2]">
                                    {item.words_per_min ? <span>{item.words_per_min} wpm</span> : null}
                                    <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', isSelected && 'rotate-180')} />
                                  </div>
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <CoachMascot mood="idle" size={76} />
                        <p className="font-serif text-xl tracking-tight text-white">No speeches yet</p>
                        <p className="max-w-xs text-sm leading-6 text-[#857ca2]">Your stage is waiting. Record your first speech in the Speaking Coach and it will show up here.</p>
                        <Button onClick={() => setActiveTab('coach')} className="mt-2 h-11 rounded-[16px] px-5 font-mono text-xs uppercase tracking-[0.18em]">
                          <Mic className="h-4 w-4" />
                          Record a speech
                        </Button>
                      </div>
                    )}
                  </Shell>
                  {selectedSession && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 sm:gap-5">
                      <CollapsibleSection title="Transcript" defaultOpen={false}>
                        <p className="whitespace-pre-wrap break-words font-mono text-sm leading-7 text-[#f2efff] sm:leading-8">{selectedSession.transcript}</p>
                        <ActionBar text={selectedSession.transcript} label="Transcript" copyText={copyText} speakText={speakText} />
                      </CollapsibleSection>
                      <FeedbackReport feedback={selectedSession.feedback} copyText={copyText} speakText={speakText} />
                    </motion.div>
                  )}
                </>
              )}

              {/* ── Progress tab ────────────────────────── */}
              {activeTab === 'progress' && (
                <>
                  <Shell>
                    <Eyebrow className="mb-4">Score Trend</Eyebrow>
                    <ProgressChart history={history} />
                  </Shell>
                  <Shell>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <Eyebrow>AI Insights</Eyebrow>
                      <Button onClick={fetchInsights} disabled={isLoadingInsights || history.length === 0} className="h-11 rounded-[18px] px-5 font-mono text-xs uppercase tracking-[0.18em] sm:rounded-[22px]">
                        <BarChart3 className={cn('h-4 w-4', isLoadingInsights && 'animate-spin')} />
                        {isLoadingInsights ? 'Analyzing…' : 'View Insights'}
                      </Button>
                    </div>
                    {isLoadingInsights && (
                      <div className="mt-5 flex items-center gap-4">
                        <CoachMascot mood="think" size={54} className="shrink-0" />
                        <SkeletonLines lines={3} className="flex-1" />
                      </div>
                    )}
                    {insights.length > 0 && !isLoadingInsights && (
                      <div className="mt-5 space-y-3">
                        {insights.map((insight, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: i * 0.07, type: 'spring', stiffness: 260, damping: 26 }}
                            whileHover={reduceMotion ? undefined : { y: -3 }}
                            className="glass-edge rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-4 transition-shadow hover:shadow-[0_12px_30px_rgba(2,6,23,0.4)] sm:rounded-[24px] sm:p-5"
                          >
                            <p className="break-words text-sm leading-6 text-[#f2efff]">{insight}</p>
                            <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => copyText(insight, 'Insight')} title="Copy insight"><Copy className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => speakText(insight, 'Insight')} title="Read insight"><Volume2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </Shell>
                  {weaknesses.length > 0 && !isLoadingInsights && (
                    <Shell tone="danger">
                      <Eyebrow className="mb-4">Weaknesses</Eyebrow>
                      <div className="space-y-3">
                        {weaknesses.map((weakness, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: reduceMotion ? 0 : 16, scale: reduceMotion ? 1 : 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: i * 0.07, type: 'spring', stiffness: 260, damping: 26 }}
                            whileHover={reduceMotion ? undefined : { y: -3 }}
                            className="glass-edge rounded-[20px] border border-[#f87171]/15 bg-[#dc2626]/5 p-4 transition-shadow hover:shadow-[0_12px_30px_rgba(220,38,38,0.18)] sm:rounded-[24px] sm:p-5"
                          >
                            <p className="break-words text-sm leading-6 text-[#f2efff]">{weakness}</p>
                            <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => copyText(weakness, 'Weakness')} title="Copy weakness"><Copy className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => speakText(weakness, 'Weakness')} title="Read weakness"><Volume2 className="h-3.5 w-3.5" /></Button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </Shell>
                  )}
                </>
              )}

              {/* ── Account tab ─────────────────────────── */}
              {activeTab === 'account' && renderAccountPanel()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────── */}
      <nav
        className="gpu-layer fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-[#0b0b14]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_-22px_55px_rgba(2,6,23,0.55)] backdrop-blur-2xl md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)', backdropFilter: 'blur(24px) saturate(140%)', WebkitBackdropFilter: 'blur(24px) saturate(140%)' }}
      >
        <div className="mx-auto flex max-w-md items-stretch justify-around px-1 py-1.5">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            const shortLabel = id === 'coach' ? 'Coach' : id === 'speech' ? 'Practice' : id === 'history' ? 'History' : id === 'progress' ? 'Progress' : 'Account';
            return (
              <button
                key={id}
                onClick={() => switchTab(id)}
                className="group relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[#a78bfa]/60"
                aria-label={label}
                aria-current={active ? 'page' : undefined}
              >
                {active ? (
                  <motion.span
                    layoutId="mobile-nav-active"
                    className="absolute inset-x-1 inset-y-0.5 rounded-2xl border border-[#a78bfa]/30 bg-[linear-gradient(135deg,rgba(167,139,250,0.24),rgba(249,168,212,0.14))] shadow-[0_6px_20px_rgba(167,139,250,0.28),inset_0_1px_0_rgba(255,255,255,0.14)]"
                    transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  />
                ) : null}
                <motion.span
                  className="relative"
                  animate={{ y: active && !reduceMotion ? -2 : 0, scale: active ? 1.1 : 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 24 }}
                >
                  <Icon className={cn('h-5 w-5 transition-colors', active ? 'text-[#ddd6fe] drop-shadow-[0_2px_6px_rgba(167,139,250,0.5)]' : 'text-[#6f6691] group-hover:text-[#a79dc8]')} />
                </motion.span>
                <span className={cn('relative font-mono text-[8.5px] uppercase tracking-[0.1em] transition-colors', active ? 'text-[#ddd6fe]' : 'text-[#6f6691] group-hover:text-[#a79dc8]')}>{shortLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* ── Auth prompt modal ───────────────────────────── */}
      <AnimatePresence>
        {authPromptOpen && !accountUser ? (
          <>
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setAuthPromptOpen(false)}
              aria-label="Close account prompt"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[24px] border border-white/10 bg-[#0d0c16]/95 p-5 shadow-[0_30px_80px_rgba(2,6,23,0.7)] backdrop-blur-xl sm:rounded-[28px] sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <CoachMascot mood="cheer" size={56} float={false} className="shrink-0" />
                  <div>
                    <p className="font-serif text-2xl text-white">Keep your progress</p>
                    <p className="mt-1 text-sm leading-6 text-[#857ca2]">Your speeches, scores, and voice sample — saved and waiting for you.</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setAuthPromptOpen(false)} aria-label="Close">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {authControls}
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

      <AawaxCustomizer open={customizeOpen} onClose={() => setCustomizeOpen(false)} />
      <AvatarCustomizer open={avatarCustomizeOpen} onClose={() => setAvatarCustomizeOpen(false)} />

      {!customizeOpen && !avatarCustomizeOpen && !authPromptOpen && !confirmRequest && activeTab !== 'aawax' ? (
        <AawaxCompanion
          activeTab={activeTab}
          onTabChange={switchTab}
          onOpenChat={() => switchTab('aawax')}
          flags={{
            isRecording,
            isAnalyzing,
            isGenerating,
            isVoiceBusy: isVoiceSampleRecording || isVoiceSampleSaving || isVoiceSampleResetting || speechAudio.clone.isLoading || speechAudio.example.isLoading,
            hasFeedback: Boolean(feedback),
            hasHistory: history.length > 0,
            hasSpeech: Boolean(speech),
          }}
        />
      ) : null}

      <ConfirmDialog
        request={confirmRequest}
        busy={confirmBusy}
        onCancel={() => setConfirmRequest(null)}
        onConfirm={runConfirm}
      />
    </div>
  );
}
