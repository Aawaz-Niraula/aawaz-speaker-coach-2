'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Label from '@radix-ui/react-label';
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion';
import {
  AudioLines,
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
import { GuidedRehearsal, RehearsalReadyCard } from '@/components/guided-rehearsal';
import { CoachMascot, MascotHint } from '@/components/mascot';
import { AvatarCustomizer, ProfileAvatar } from '@/components/profile-avatar';
import { ProgressChart } from '@/components/progress-chart';
import { LiveWaveform, SkeletonLines, ThinkingDots } from '@/components/recorder-visuals';
import { FormatSelect, TemplatePicker } from '@/components/template-picker';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, type ConfirmRequest } from '@/components/ui/confirm-dialog';
import { Eyebrow, Shell } from '@/components/ui/shell';
import { authClient } from '@/lib/auth-client';
import {
  ACCOUNT_PASSWORD_MAX_LENGTH,
  ACCOUNT_PASSWORD_MIN_LENGTH,
  ACCOUNT_PASSWORD_REQUIREMENTS,
  isValidAccountEmail,
  isValidAccountPassword,
  normalizeAccountEmail,
} from '@/lib/account-validation';
import { formatClock, formatHistoryDate, scoreColor } from '@/lib/feedback';
import { requestJson } from '@/lib/request';
import type { RehearsalScript } from '@/lib/rehearsal';
import { sfx } from '@/lib/sound';
import { DEFAULT_ACCENT, EXAMPLE_ACCENTS, getAvailableAccents, type ExampleAccent } from '@/lib/elevenlabs';
import { DEFAULT_TEMPLATE_ID, getSpeechTemplate, type SpeechTemplateId } from '@/lib/speech-config';
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
  /** Delivery report, present only if the user ran a deep analysis. */
  deep_analysis?: string | null;
};
type GeneratedSpeechItem = {
  id: string;
  created_at: string;
  topic: string;
  template_id: string | null;
  template_label: string | null;
  word_count: number | null;
  speech: string;
};
type HistoryResponse = { history?: SpeechHistoryItem[] };
type AnalyzeResponse = HistoryResponse & { transcript?: string; feedback?: string; isGuest?: boolean; guestRemaining?: number | null };
type SpeechResponse = { speech?: string; speechId?: string; isGuest?: boolean; guestRemaining?: number | null };
type InsightsResponse = { insights?: string[]; weaknesses?: string[] };
type AccountProfile = { providerId: string; accountId: string };
type AuthStatus = { accountAuthEnabled: boolean; googleEnabled: boolean; message?: string };
type SpeechExampleVoice = 'female' | 'male';
type SpeechAudioState = { url: string; isLoading: boolean };
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

const ANALYZE_STAGES = [
  'Transcribing every word…',
  'Coach is listening closely…',
  'Scoring against the rubric…',
];

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
        // Sits in the scrolling mobile header, so no backdrop-filter.
        'flex h-9 w-9 items-center justify-center rounded-full border border-[#a78bfa]/30 bg-white/[0.07] text-[#ddd6fe] shadow-[0_0_18px_rgba(167,139,250,0.22)] transition hover:bg-white/10 hover:text-[#f2efff]',
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
  /* History has two views: recorded speeches you were scored on, and scripts
     written in Speech Practice. They are different enough to warrant a toggle
     rather than one mixed list. */
  const [historyView, setHistoryView] = useState<'evaluations' | 'scripts'>('evaluations');
  const [generatedSpeeches, setGeneratedSpeeches] = useState<GeneratedSpeechItem[]>([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  /* Deep analysis. The recording is held in browser memory only — nothing is
     stored server-side — so the button disappears on reload or a new take. */
  const [deepAnalysis, setDeepAnalysis] = useState<string | null>(null);
  const [isGoingDeeper, setIsGoingDeeper] = useState(false);
  const [canGoDeeper, setCanGoDeeper] = useState(false);
  const lastRecordingRef = useRef<{
    blob: Blob;
    sessionId: string | null;
    templateId: SpeechTemplateId | null;
  } | null>(null);
  const [deletingSessionIds, setDeletingSessionIds] = useState<Set<string>>(new Set());
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpeechTemplateId | null>(DEFAULT_TEMPLATE_ID);
  const [speechTemplateId, setSpeechTemplateId] = useState<SpeechTemplateId | null>(DEFAULT_TEMPLATE_ID);
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState(180);
  const [speech, setSpeech] = useState('');
  const [generatedSpeechId, setGeneratedSpeechId] = useState<string | null>(null);
  const [activeRehearsal, setActiveRehearsal] = useState<RehearsalScript | null>(null);
  const [rehearsalOpen, setRehearsalOpen] = useState(false);
  const [speechAudio, setSpeechAudio] = useState<SpeechAudioState>({ url: '', isLoading: false });
  const [exampleVoice, setExampleVoice] = useState<SpeechExampleVoice>('female');
  const [exampleAccent, setExampleAccent] = useState<ExampleAccent>(DEFAULT_ACCENT);
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
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedbackRef = useRef<HTMLDivElement | null>(null);
  const speechAudioRef = useRef(speechAudio);
  const speechAudioAbortRef = useRef<AbortController | null>(null);
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
      speechAudioAbortRef.current?.abort();
      if (speechAudioRef.current.url) URL.revokeObjectURL(speechAudioRef.current.url);
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
  const startRecording = async (source: 'coach' | 'rehearsal' = 'coach') => {
    if (!identityReady) {
      toast.error('Still warming up. Give it a second and try again.');
      return;
    }

    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      toast.error('Audio recording is not supported in this browser.');
      return;
    }

    if (source === 'coach') {
      setActiveRehearsal(null);
      setRehearsalOpen(false);
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

        if (blob.size < 3000) {
          toast.error('No audio detected. Please speak clearly and try again.');
          setIsAnalyzing(false);
          return;
        }

        const form = new FormData();
        form.append('file', blob, 'speech.webm');
        const recordingTemplateId = source === 'rehearsal' && activeRehearsal
          ? activeRehearsal.templateId
          : selectedTemplateId;
        if (recordingTemplateId) form.append('templateId', recordingTemplateId);
        if (source === 'rehearsal' && activeRehearsal) {
          form.append('rehearsalMode', 'guided-read');
          form.append('sourceSpeechId', activeRehearsal.speechId);
          form.append('referenceScript', activeRehearsal.script);
        }
        try {
          const data = await requestJson<AnalyzeResponse>('/api/transcribe-analyze', { method: 'POST', body: form }, 300000);
          setTranscript(data.transcript || '');
          setFeedback(data.feedback || '');
          setHistory(data.history || []);
          setSelectedSessionId(null);
          // Keep the recording in memory so "Go deeper" can re-read it for a
          // delivery report. It never touches the server unless the user asks,
          // and it is dropped as soon as they record again.
          lastRecordingRef.current = {
            blob,
            sessionId: data.history?.[0]?.id ?? null,
            templateId: recordingTemplateId,
          };
          setDeepAnalysis(null);
          setCanGoDeeper(true);
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
      // Release the previous take: its report is already saved, and holding
      // the audio for a speech the user has moved on from serves no purpose.
      lastRecordingRef.current = null;
      setDeepAnalysis(null);
      setCanGoDeeper(false);
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
    // The delivery report belongs to the speech being cleared, and the held
    // recording is what makes it re-runnable. Both go with it.
    setDeepAnalysis(null);
    setCanGoDeeper(false);
    lastRecordingRef.current = null;
    setSeconds(0);
    setSelectedTemplateId(DEFAULT_TEMPLATE_ID);
    setActiveRehearsal(null);
    setRehearsalOpen(false);
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

    const email = normalizeAccountEmail(authEmail);
    const password = authPassword;
    const name = authName.trim() || email.split('@')[0] || 'Aawaz User';

    if (!email || !password) {
      toast.error('Enter your email and password.');
      return;
    }

    if (!isValidAccountEmail(email)) {
      toast.error('Enter a valid email address.');
      return;
    }

    if (authMode === 'sign-up' && !isValidAccountPassword(password)) {
      toast.error(ACCOUNT_PASSWORD_REQUIREMENTS);
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
      setAuthEmail(email);
      setAuthPassword('');
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

  /* ── Deep analysis ─────────────────────────────────────────────── */
  const runDeepAnalysis = async () => {
    const recording = lastRecordingRef.current;
    if (!recording || isGoingDeeper) return;

    setIsGoingDeeper(true);
    const form = new FormData();
    form.append('file', recording.blob, 'speech.webm');
    if (recording.sessionId) form.append('sessionId', recording.sessionId);
    if (recording.templateId) form.append('templateId', recording.templateId);

    try {
      const data = await requestJson<{ deepAnalysis?: string; degraded?: boolean }>(
        '/api/deep-analysis',
        { method: 'POST', body: form },
        300000,
      );
      setDeepAnalysis(data.deepAnalysis || '');
      trackGuestUse(null);
      sfx.success();
      toast.success(
        data.degraded
          ? 'Delivery report ready, based on your timing data.'
          : 'Delivery report ready.',
      );
    } catch (err) {
      if (handleSpecialError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Could not run the deep analysis.');
    } finally {
      setIsGoingDeeper(false);
    }
  };

  /* ── Speech generation ─────────────────────────────────────────── */
  const clearSpeechAudio = () => {
    speechAudioAbortRef.current?.abort();
    speechAudioAbortRef.current = null;
    if (speechAudioRef.current.url) URL.revokeObjectURL(speechAudioRef.current.url);
    const clearedAudio = { url: '', isLoading: false };
    speechAudioRef.current = clearedAudio;
    setSpeechAudio(clearedAudio);
  };

  const startNewSpeech = () => {
    if (isGenerating) return;
    clearSpeechAudio();
    setSpeech('');
    setGeneratedSpeechId(null);
    setTopic('');
    setError('');
    sfx.select();
    window.requestAnimationFrame(() => document.getElementById('speech-topic')?.focus());
  };

  const generateSpeech = async () => {
    if (isGenerating) return;

    if (!topic.trim()) {
      toast.error('Enter a topic first.');
      return;
    }
    setIsGenerating(true);
    setSpeech('');
    setGeneratedSpeechId(null);
    clearSpeechAudio();
    setError('');
    try {
      const data = await requestJson<SpeechResponse>('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, wordCount, templateId: speechTemplateId }),
      }, 300000);
      setSpeech(data.speech || '');
      setGeneratedSpeechId(data.speechId || null);
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

  const launchGuidedRehearsal = ({
    speechId,
    rehearsalTopic,
    script,
    templateId,
  }: {
    speechId: string;
    rehearsalTopic: string;
    script: string;
    templateId?: string | null;
  }) => {
    const template = getSpeechTemplate(templateId);
    if (!template || !script.trim()) {
      toast.error('This script is not ready to rehearse.');
      return;
    }

    const rehearsal: RehearsalScript = {
      speechId,
      topic: rehearsalTopic || 'Practice speech',
      script,
      templateId: template.id,
      templateLabel: template.label,
    };

    setSelectedTemplateId(template.id);
    setActiveRehearsal(rehearsal);
    setRehearsalOpen(true);
    switchTab('coach');
    sfx.pop();
    toast.success(`${template.label} selected. Your rehearsal is ready.`);
  };

  const generateSpeechAudio = async () => {
    if (!speech.trim()) {
      toast.error('First generate a text script.');
      return;
    }

    // Guard against duplicate clicks.
    if (speechAudio.isLoading) return;

    const form = new FormData();
    form.append('text', speech);
    form.append('exampleVoice', exampleVoice);
    form.append('exampleAccent', exampleAccent);

    clearSpeechAudio();
    const loadingAudio = { url: '', isLoading: true };
    speechAudioRef.current = loadingAudio;
    setSpeechAudio(loadingAudio);

    const controller = new AbortController();
    speechAudioAbortRef.current = controller;
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
      if (speechAudioAbortRef.current !== controller) return;
      const url = URL.createObjectURL(blob);
      setSpeechAudio((current) => {
        if (current.url) URL.revokeObjectURL(current.url);
        return { url, isLoading: false };
      });
      trackGuestUse(null);
      sfx.pop();
      toast.success('Example speech ready.');
    } catch (err) {
      if (controller.signal.aborted && speechAudioAbortRef.current !== controller) return;
      if (handleSpecialError(err)) {
        setSpeechAudio((current) => ({ ...current, isLoading: false }));
        return;
      }
      const message =
        err instanceof DOMException && err.name === 'AbortError'
          ? 'Voice generation took too long. Please try again.'
          : err instanceof Error
            ? err.message
            : 'Could not generate speech audio.';
      toast.error(message);
      setSpeechAudio((current) => ({ ...current, isLoading: false }));
    } finally {
      window.clearTimeout(timeout);
      if (speechAudioAbortRef.current === controller) speechAudioAbortRef.current = null;
    }
  };

  /* ── History ───────────────────────────────────────────────────── */
  const loadGeneratedSpeeches = useCallback(async () => {
    setScriptsLoading(true);
    try {
      const data = await requestJson<{ speeches?: GeneratedSpeechItem[] }>('/api/generated-speeches', undefined, 300000);
      setGeneratedSpeeches(data.speeches || []);
    } catch {
      // Non-fatal: the evaluations view still works.
    } finally {
      setScriptsLoading(false);
    }
  }, []);

  const deleteGeneratedSpeechItem = async (speechId: string) => {
    if (deletingSessionIds.has(speechId)) return;
    setDeletingSessionIds((current) => new Set(current).add(speechId));

    try {
      const data = await requestJson<{ speeches?: GeneratedSpeechItem[] }>(
        '/api/generated-speeches',
        { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ speechId }) },
        300000,
      );
      setGeneratedSpeeches(data.speeches || []);
      if (selectedScriptId === speechId) setSelectedScriptId(null);
      toast.success('Script deleted.');
    } catch (err) {
      if (handleSpecialError(err)) return;
      toast.error(err instanceof Error ? err.message : 'Could not delete the script.');
    } finally {
      setDeletingSessionIds((current) => {
        const next = new Set(current);
        next.delete(speechId);
        return next;
      });
    }
  };

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
    <form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submitAuth();
      }}
    >
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
          aria-label="Your name"
          autoComplete="name"
          className="h-12 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/50"
        />
      ) : null}
      <input
        value={authEmail}
        onChange={(event) => setAuthEmail(event.target.value)}
        placeholder="Email"
        type="email"
        aria-label="Email"
        autoComplete="email"
        autoCapitalize="none"
        inputMode="email"
        spellCheck={false}
        required
        className="h-12 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/50"
      />
      <input
        value={authPassword}
        onChange={(event) => setAuthPassword(event.target.value)}
        placeholder="Password"
        type="password"
        aria-label="Password"
        autoComplete={authMode === 'sign-up' ? 'new-password' : 'current-password'}
        minLength={ACCOUNT_PASSWORD_MIN_LENGTH}
        maxLength={ACCOUNT_PASSWORD_MAX_LENGTH}
        required
        className="h-12 rounded-[18px] border border-white/12 bg-[#0b0b12]/60 px-4 text-sm text-[#f2efff] outline-none transition placeholder:text-[#857ca2] focus:border-[#a78bfa]/50"
      />
      {authMode === 'sign-up' ? (
        <p className="font-mono text-[11px] leading-5 text-[#857ca2]">{ACCOUNT_PASSWORD_REQUIREMENTS}</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Button type="submit" disabled={isAuthBusy} className="h-12 rounded-[18px] font-mono text-xs uppercase tracking-[0.22em]">
          {isAuthBusy ? 'Working…' : authMode === 'sign-up' ? 'Create' : 'Login'}
        </Button>
        <Button type="button" variant="secondary" onClick={signInWithGoogle} disabled={isAuthBusy} className="h-12 rounded-[18px] font-mono text-xs uppercase tracking-[0.18em]">
          Google
        </Button>
      </div>
    </form>
  );

  /* ── Account panel ─────────────────────────────────────────────── */
  const renderAccountPanel = () => {
    const createdAt = accountUser ? new Date(accountUser.createdAt) : null;
    const isNew = createdAt ? Date.now() - createdAt.getTime() < 120000 : false;
    const displayName = accountUser?.name || accountUser?.email?.split('@')[0] || 'Aawaz User';
    const loginMethod = accountProfile?.providerId === 'credential'
      ? 'Email'
      : accountProfile?.providerId || 'Email';
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
                { label: 'Login method', value: loginMethod },
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

  /* ── Speech audio actions (example voice) ──────────────────────── */
  const renderSpeechAudioActions = () => {
    const accentAvailability = getAvailableAccents();

    return (
      <div className="mb-5 grid gap-3">
        {/* Example voice */}
        <div className="rounded-[20px] border border-white/10 bg-[#0b0b12]/55 p-3.5 transition-colors hover:border-white/15 sm:rounded-[24px] sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#f2efff]">Example speech</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.14em] leading-relaxed text-[#857ca2]">Pick an accent and voice</p>
            </div>
            <div className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/5 p-1">
              {(['female', 'male'] as const).map((voice) => (
                <button
                  key={voice}
                  type="button"
                  onClick={() => {
                    if (speechAudio.isLoading || exampleVoice === voice) return;
                    if (speechAudioRef.current.url) {
                      URL.revokeObjectURL(speechAudioRef.current.url);
                    }
                    setExampleVoice(voice);
                    // The chosen accent may not have a voice in the new gender.
                    // Move to one that does rather than leaving a dead selection.
                    if (!accentAvailability[exampleAccent]?.[voice]) {
                      const fallback = EXAMPLE_ACCENTS.find((accent) => accentAvailability[accent]?.[voice]);
                      if (fallback) setExampleAccent(fallback);
                    }
                    setSpeechAudio({ url: '', isLoading: false });
                  }}
                  disabled={speechAudio.isLoading}
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
          {/* Accent picker. Accent is a property of the voice itself, so an
              accent with no voice recorded yet is disabled rather than
              silently falling back to a different one. */}
          <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-[14px] border border-white/8 bg-[#0b0b12]/45 p-1.5">
            {EXAMPLE_ACCENTS.map((accent) => {
              const availability = accentAvailability[accent];
              const ready = availability?.[exampleVoice] ?? false;
              const active = exampleAccent === accent;

              return (
                <button
                  key={accent}
                  type="button"
                  onClick={() => {
                    if (speechAudio.isLoading || active || !ready) return;
                    if (speechAudioRef.current.url) {
                      URL.revokeObjectURL(speechAudioRef.current.url);
                    }
                    setExampleAccent(accent);
                    setSpeechAudio({ url: '', isLoading: false });
                  }}
                  disabled={speechAudio.isLoading || !ready}
                  title={ready ? `${accent} accent` : `${accent} ${exampleVoice} voice is coming soon`}
                  className={cn(
                    'h-8 flex-1 rounded-[10px] px-2.5 font-mono text-[10px] uppercase tracking-[0.14em] transition',
                    active
                      ? 'bg-[#a78bfa]/25 text-[#f2efff] shadow-[0_0_14px_rgba(167,139,250,0.18)]'
                      : ready
                        ? 'text-[#857ca2] hover:bg-white/8 hover:text-[#f2efff]'
                        : 'cursor-not-allowed text-[#4b4560] line-through',
                    speechAudio.isLoading && 'pointer-events-none opacity-60',
                  )}
                  aria-pressed={active}
                >
                  {accent}
                </button>
              );
            })}
          </div>
          {speechAudio.url ? (
            <AudioPlayer src={speechAudio.url} downloadName={`aawaz-${exampleAccent}-${exampleVoice}-speech.mp3`} />
          ) : (
            <button
              type="button"
              onClick={() => generateSpeechAudio()}
              disabled={speechAudio.isLoading || isGenerating}
              className={cn(
                'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[16px] border border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(167,139,250,0.18),rgba(249,168,212,0.10))] px-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#f2efff] transition hover:border-[#a78bfa]/45 disabled:pointer-events-none disabled:opacity-60 sm:rounded-[18px]',
                speechAudio.isLoading && 'skeleton-shimmer',
              )}
            >
              <Volume2 className={cn('h-4 w-4 shrink-0', speechAudio.isLoading && 'animate-pulse')} />
              {speechAudio.isLoading ? 'Synthesizing…' : 'Hear example speech'}
            </button>
          )}
        </div>
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
                  Pick a rubric above, tap the mic, and give it everything. I&apos;ll be honest about what works and what doesn&apos;t.
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
              onClick={isRecording ? stopRecording : () => void startRecording('coach')}
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
    /* The document itself does not scroll — `<main>` does, at every width.
       Desktop already worked this way and has been smooth throughout; mobile
       scrolled the document, and that is the one difference that survives
       every other fix. Scrolling the document on a phone is what drives the
       URL bar, and a collapsing URL bar moves the visual viewport out from
       under everything anchored to it, which reads as the layout jumping.
       It also only ever happens on the views long enough to scroll, and mostly
       downward, because browsers retract the bar gradually on the way down
       and snap it back on the way up.

       With a fixed-height shell and an inner scroller the bar never moves, so
       there is nothing left to jump. The cost is that the URL bar now stays
       on screen instead of hiding as you read. */
    <div className="h-svh overflow-hidden text-[#f2efff]">
      <Toaster position="top-right" richColors theme="dark" />
      <div className="mx-auto flex h-full min-h-0 max-w-[1440px]" aria-hidden={rehearsalOpen || undefined}>
        {/* ── Desktop sidebar ─────────────────────────────── */}
        <aside className="hidden h-full w-72 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-white/8 p-5 md:flex lg:w-80">
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
        <main className="aawax-scroll h-full min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-28 pt-5 sm:px-4 md:px-6 md:pb-14 md:pt-8 lg:px-8">
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
                  {activeTab === 'coach' && (transcript || feedback || deepAnalysis || isRecording || isAnalyzing) ? (
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
                  {activeRehearsal ? (
                    <RehearsalReadyCard
                      rehearsal={activeRehearsal}
                      onOpen={() => setRehearsalOpen(true)}
                      onDismiss={() => {
                        setRehearsalOpen(false);
                        setActiveRehearsal(null);
                      }}
                      disabled={isAnalyzing}
                    />
                  ) : null}
                  <TemplatePicker value={selectedTemplateId} onChange={setSelectedTemplateId} disabled={isRecording || isAnalyzing || Boolean(activeRehearsal)} />
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

                  {/* Deep analysis. Only offered while the recording is still
                      in memory — it is never stored, so a reload retires it. */}
                  {feedback && canGoDeeper && !deepAnalysis ? (
                    <Shell>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <Eyebrow className="mb-2">Optional</Eyebrow>
                          <p className="font-serif text-lg tracking-tight text-white">How it sounded</p>
                          <p className="mt-1 max-w-lg text-sm leading-6 text-[#a79dc8]">
                            The report above read your words. This one listens to how you said them: your speed, your pauses, and how confident you sounded. Takes about half a minute.
                          </p>
                        </div>
                        <Button
                          onClick={runDeepAnalysis}
                          disabled={isGoingDeeper}
                          className={cn('h-12 shrink-0 rounded-[16px] px-5 font-mono text-[11px] uppercase tracking-[0.16em]', isGoingDeeper && 'skeleton-shimmer')}
                        >
                          <AudioLines className={cn('h-4 w-4', isGoingDeeper && 'animate-pulse')} />
                          {isGoingDeeper ? 'Listening…' : 'Deeper Analysis'}
                        </Button>
                      </div>
                    </Shell>
                  ) : null}

                  {deepAnalysis ? (
                    <FeedbackReport feedback={deepAnalysis} copyText={copyText} speakText={speakText} />
                  ) : null}
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
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <Eyebrow>Sample Speech</Eyebrow>
                        {!isGenerating ? (
                          <div className="flex shrink-0 items-center gap-2">
                            <Button
                              variant="secondary"
                              onClick={startNewSpeech}
                              className="h-11 rounded-[15px] px-3 font-mono text-[10px] uppercase tracking-[0.14em] sm:px-4"
                            >
                              <Plus className="h-4 w-4" />
                              New speech
                            </Button>
                            <Button variant="ghost" size="icon" onClick={generateSpeech} className="h-11 w-11" title="Regenerate speech" aria-label="Regenerate speech"><RefreshCw className="h-4 w-4" /></Button>
                          </div>
                        ) : null}
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
                          <div className="mb-4 rounded-[18px] border border-[#a78bfa]/22 bg-[linear-gradient(135deg,rgba(167,139,250,0.13),rgba(249,168,212,0.08))] p-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:p-4">
                            <div className="min-w-0">
                              <p className="font-serif text-lg tracking-tight text-white">Ready to say it out loud?</p>
                              <p className="mt-1 text-sm leading-6 text-[#a79dc8]">Open it in Coach with this same format and a line-following teleprompter.</p>
                            </div>
                            <Button
                              onClick={() => launchGuidedRehearsal({
                                speechId: generatedSpeechId || 'current-generated-speech',
                                rehearsalTopic: topic,
                                script: speech,
                                templateId: speechTemplateId,
                              })}
                              className="mt-3 h-11 w-full shrink-0 rounded-[15px] px-5 font-mono text-[11px] uppercase tracking-[0.16em] sm:mt-0 sm:w-auto"
                            >
                              <Mic className="h-4 w-4" />
                              Try this in Coach
                            </Button>
                          </div>
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
                  {/* Two kinds of history live here: speeches you recorded and
                      were scored on, and scripts you generated to practise. */}
                  <div className="mb-4 inline-flex rounded-full border border-white/10 bg-white/5 p-1">
                    {([
                      { id: 'evaluations' as const, label: 'Speech evaluation' },
                      { id: 'scripts' as const, label: 'Speech generation' },
                    ]).map((view) => (
                      <button
                        key={view.id}
                        type="button"
                        onClick={() => {
                          if (historyView === view.id) return;
                          sfx.select();
                          setHistoryView(view.id);
                          if (view.id === 'scripts' && !generatedSpeeches.length) void loadGeneratedSpeeches();
                        }}
                        className={cn(
                          'h-9 rounded-full px-4 font-mono text-[10px] uppercase tracking-[0.16em] transition',
                          historyView === view.id
                            ? 'bg-[#ddd6fe] text-[#06060b]'
                            : 'text-[#857ca2] hover:bg-white/10 hover:text-[#f2efff]',
                        )}
                        aria-pressed={historyView === view.id}
                      >
                        {view.label}
                      </button>
                    ))}
                  </div>

                  {historyView === 'scripts' ? (
                    <Shell>
                      {scriptsLoading ? (
                        <div className="grid gap-3">
                          {[0, 1, 2].map((i) => (
                            <div key={i} className="rounded-[20px] border border-white/8 p-4 sm:p-5">
                              <SkeletonLines lines={2} />
                            </div>
                          ))}
                        </div>
                      ) : generatedSpeeches.length ? (
                        <div className="grid gap-3">
                          {generatedSpeeches.map((item) => {
                            const isSelected = selectedScriptId === item.id;
                            const isDeleting = deletingSessionIds.has(item.id);
                            return (
                              <motion.div
                                key={item.id}
                                layout="position"
                                animate={{ opacity: isDeleting ? 0.4 : 1 }}
                                className={cn(
                                  'glass-edge rounded-[20px] border transition-colors sm:rounded-[24px]',
                                  isSelected
                                    ? 'border-[#a78bfa]/40 bg-[linear-gradient(135deg,rgba(167,139,250,0.12),rgba(249,168,212,0.08))]'
                                    : 'border-white/10 bg-white/4 hover:border-white/20',
                                )}
                              >
                                <div className="p-4 sm:p-5">
                                  <div className="mb-2 flex items-center justify-between gap-3">
                                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#857ca2]">
                                      {new Date(item.created_at.replace(' ', 'T') + 'Z').toLocaleString()}
                                    </p>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => deleteGeneratedSpeechItem(item.id)}
                                      disabled={isDeleting}
                                      className="h-8 w-8 rounded-full text-[#857ca2] hover:text-[#fca5a5]"
                                      aria-label="Delete script"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedScriptId(isSelected ? null : item.id)}
                                    disabled={isDeleting}
                                    className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
                                    aria-expanded={isSelected}
                                  >
                                    <div className="min-w-0 break-words text-sm sm:text-base">{item.topic}</div>
                                    <div className="flex shrink-0 items-center gap-2 font-mono text-xs text-[#857ca2]">
                                      {item.template_label ? <span className="hidden sm:inline">{item.template_label}</span> : null}
                                      {item.word_count ? <span>{item.word_count} words</span> : null}
                                      <ChevronDown className={cn('h-4 w-4 transition-transform duration-300', isSelected && 'rotate-180')} />
                                    </div>
                                  </button>
                                  <AnimatePresence initial={false}>
                                    {isSelected ? (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="overflow-hidden"
                                      >
                                        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-[#f2efff] sm:leading-8">
                                          {item.speech}
                                        </p>
                                        <Button
                                          onClick={() => launchGuidedRehearsal({
                                            speechId: item.id,
                                            rehearsalTopic: item.topic,
                                            script: item.speech,
                                            templateId: item.template_id,
                                          })}
                                          className="mt-4 h-11 w-full rounded-[15px] px-5 font-mono text-[11px] uppercase tracking-[0.16em] sm:w-auto"
                                        >
                                          <Mic className="h-4 w-4" />
                                          Try this in Coach
                                        </Button>
                                        <ActionBar text={item.speech} label="Speech" copyText={copyText} speakText={speakText} />
                                      </motion.div>
                                    ) : null}
                                  </AnimatePresence>
                                </div>
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                          <CoachMascot mood="idle" size={72} />
                          <p className="font-serif text-xl text-white">No scripts yet</p>
                          <p className="max-w-sm text-sm leading-6 text-[#a79dc8]">
                            Generate a practice speech in Speech Practice and it will be saved here.
                          </p>
                        </div>
                      )}
                    </Shell>
                  ) : (
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
                      {/* A delivery report is saved with the session, so it
                          survives long after the recording itself is gone. */}
                      {selectedSession.deep_analysis ? (
                        <FeedbackReport feedback={selectedSession.deep_analysis} copyText={copyText} speakText={speakText} />
                      ) : null}
                    </motion.div>
                  )}
                  </>
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

      {/* ── Mobile bottom nav ─────────────────────────────
          The blur lives in `.chrome-blur`, not in an inline style, so a media
          query can reach it. A fixed blurred bar over scrolling content makes
          the compositor re-sample its whole backdrop every scroll frame, so
          touch devices get an opaque tint instead. */}
      <nav
        className="gpu-layer chrome-blur fixed inset-x-0 bottom-0 z-40 border-t border-white/12 bg-[#0b0b14]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_-22px_55px_rgba(2,6,23,0.55)] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-hidden={rehearsalOpen || undefined}
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

      <GuidedRehearsal
        open={rehearsalOpen}
        rehearsal={activeRehearsal}
        isRecording={isRecording}
        seconds={seconds}
        maxSeconds={MAX_RECORDING_SECONDS}
        onStart={() => startRecording('rehearsal')}
        onStop={stopRecording}
        onClose={() => setRehearsalOpen(false)}
      />

      {!customizeOpen && !avatarCustomizeOpen && !authPromptOpen && !confirmRequest && !rehearsalOpen && activeTab !== 'aawax' ? (
        <AawaxCompanion
          activeTab={activeTab}
          onTabChange={switchTab}
          onOpenChat={() => switchTab('aawax')}
          flags={{
            isRecording,
            isAnalyzing,
            isGenerating,
            isVoiceBusy: speechAudio.isLoading,
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
