'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronRight, Menu, Mic, MicOff, RefreshCw, Sparkles, X, Zap } from 'lucide-react';

import { SPEECH_TEMPLATES, type SpeechTemplateId } from '@/lib/speech-config';

type Tab = 'coach' | 'speech';

type SpeechHistoryItem = {
  id: string;
  template_label: string | null;
  overall_score: number | null;
  words_per_min: number | null;
  feedback: string;
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #05050e; color: #e5e7eb; overflow-x: hidden; }
  button, input { font-family: inherit; }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 22px rgba(124,58,237,0.28); }
    50% { box-shadow: 0 0 42px rgba(124,58,237,0.45); }
  }
  @keyframes record-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.35), 0 0 28px rgba(239,68,68,0.2); }
    50% { box-shadow: 0 0 0 20px rgba(239,68,68,0), 0 0 40px rgba(239,68,68,0.3); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes spin-icon {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes dot-bounce {
    0%, 100% { transform: translateY(0); opacity: 0.4; }
    50% { transform: translateY(-6px); opacity: 1; }
  }
`;

function createBrowserUserId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `user-${Date.now()}`;
}

function usePersistentUserId() {
  const [userId] = useState(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    const storageKey = 'aawaz-user-id';
    const existing = window.localStorage.getItem(storageKey);

    if (existing) {
      return existing;
    }

    const nextId = createBrowserUserId();
    window.localStorage.setItem(storageKey, nextId);
    return nextId;
  });

  return userId;
}

function useTypewriter(text: string, speed = 8) {
  void speed;
  return text;
}

function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at top left, rgba(124,58,237,0.18), transparent 34%), radial-gradient(circle at bottom right, rgba(236,72,153,0.12), transparent 32%), linear-gradient(180deg, #070712 0%, #04040b 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '56px 56px', opacity: 0.35 }} />
    </div>
  );
}

function GlassCard({ children, accent = '#7c3aed', style = {} }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
        border: `1px solid ${accent}2f`,
        borderLeft: `2px solid ${accent}`,
        borderRadius: 20,
        padding: '22px 24px',
        boxShadow: `0 10px 34px ${accent}12`,
        backdropFilter: 'blur(20px)',
        animation: 'fade-up 0.45s ease both',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: `0 0 10px ${color}` }} />
      <span style={{ color, fontSize: 11, letterSpacing: 3, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>{text}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}55, transparent)` }} />
    </div>
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 4, height: 42 }}>
      {Array.from({ length: 28 }).map((_, index) => (
        <div
          key={index}
          style={{
            width: 4,
            height: '100%',
            borderRadius: 99,
            background: active ? '#a78bfa' : '#27273a',
            transformOrigin: 'center',
            transform: active ? `scaleY(${0.2 + ((index % 6) + 1) / 6})` : 'scaleY(0.12)',
            transition: 'transform 0.2s ease',
          }}
        />
      ))}
    </div>
  );
}

function FeedbackDisplay({ text }: { text: string }) {
  const displayed = useTypewriter(text, 6);
  const scoreMatch = text.match(/overall score[:\s-]*(\d+)\/100/i);
  const score = scoreMatch ? Number(scoreMatch[1]) : null;

  return (
    <GlassCard accent="#f87171" style={{ marginTop: 12 }}>
      <SectionLabel text="Coach Verdict" color="#f87171" />
      {score !== null && <p style={{ color: '#fbbf24', fontSize: 14, fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>Overall score: {score}/100</p>}
      <p style={{ color: '#e5e7eb', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>{displayed}</p>
    </GlassCard>
  );
}

function TranscriptDisplay({ text }: { text: string }) {
  return (
    <GlassCard accent="#fbbf24" style={{ marginTop: 12 }}>
      <SectionLabel text="Transcript" color="#fbbf24" />
      <p style={{ color: '#e5e7eb', lineHeight: 1.85, fontSize: 14, fontFamily: "'DM Mono', monospace", whiteSpace: 'pre-wrap' }}>{text}</p>
    </GlassCard>
  );
}

function HistoryDisplay({ history }: { history: SpeechHistoryItem[] }) {
  if (!history.length) {
    return null;
  }

  return (
    <GlassCard accent="#34d399" style={{ marginTop: 12 }}>
      <SectionLabel text="Recent History" color="#34d399" />
      <div style={{ display: 'grid', gap: 12 }}>
        {history.slice(0, 4).map((item) => (
          <div key={item.id} style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(9,16,14,0.55)', border: '1px solid rgba(52,211,153,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ color: '#86efac', fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>
                {item.template_label ?? 'General Evaluation'}
              </span>
              <span style={{ color: '#9ca3af', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                {item.overall_score !== null ? `${item.overall_score}/100` : 'No score'}{item.words_per_min ? ` • ${item.words_per_min} wpm` : ''}
              </span>
            </div>
            <p style={{ color: '#d1d5db', lineHeight: 1.7, fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
              {item.feedback.replace(/\s+/g, ' ').slice(0, 180)}...
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

function MicButton({ isRecording, isAnalyzing, onClick, seconds }: { isRecording: boolean; isAnalyzing: boolean; onClick: () => void; seconds: number }) {
  const label = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <button
        onClick={onClick}
        disabled={isAnalyzing}
        style={{
          width: 126,
          height: 126,
          borderRadius: '50%',
          border: 'none',
          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
          color: '#f5f3ff',
          background: isRecording ? 'linear-gradient(135deg, #450a0a, #991b1b)' : 'linear-gradient(135deg, #2e1065, #6d28d9)',
          animation: isRecording ? 'record-pulse 2s ease-in-out infinite' : 'pulse-glow 3s ease-in-out infinite',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isAnalyzing ? <Sparkles style={{ width: 38, height: 38, animation: 'spin-icon 1.2s linear infinite' }} /> : isRecording ? <MicOff style={{ width: 38, height: 38 }} /> : <Mic style={{ width: 38, height: 38 }} />}
      </button>
      <div style={{ textAlign: 'center' }}>
        {isAnalyzing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: `dot-bounce 0.8s ${i * 0.2}s ease-in-out infinite` }} />)}
            <span style={{ fontSize: 11, letterSpacing: 3, color: '#a78bfa', fontFamily: "'DM Mono', monospace" }}>ANALYSING</span>
          </div>
        ) : isRecording ? (
          <>
            <div style={{ fontSize: 34, color: '#fca5a5', fontFamily: "'Cormorant Garamond', serif" }}>{label}</div>
            <div style={{ fontSize: 10, color: '#ef4444', letterSpacing: 3, fontFamily: "'DM Mono', monospace" }}>TAP TO STOP</div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: 3, fontFamily: "'DM Mono', monospace" }}>TAP TO SPEAK</div>
        )}
      </div>
    </div>
  );
}

function TemplateSelector({ selectedTemplateId, onChange }: { selectedTemplateId: SpeechTemplateId | null; onChange: (templateId: SpeechTemplateId | null) => void }) {
  const selectedTemplate = SPEECH_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null;

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {SPEECH_TEMPLATES.map((template) => (
          <button
            key={template.id}
            onClick={() => onChange(selectedTemplateId === template.id ? null : template.id)}
            style={{
              padding: '9px 16px',
              borderRadius: 999,
              border: `1px solid ${selectedTemplateId === template.id ? '#7c3aed' : 'rgba(124,58,237,0.2)'}`,
              background: selectedTemplateId === template.id ? 'linear-gradient(135deg, #4c1d95, #7c3aed)' : 'rgba(124,58,237,0.08)',
              color: selectedTemplateId === template.id ? '#ede9fe' : '#9ca3af',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: "'DM Mono', monospace",
            }}
          >
            {template.label}
          </button>
        ))}
      </div>

      <GlassCard accent={selectedTemplate ? '#7c3aed' : '#fbbf24'} style={{ marginBottom: 20 }}>
        <SectionLabel text={selectedTemplate ? 'Template Mode' : 'General Mode'} color={selectedTemplate ? '#a78bfa' : '#fbbf24'} />
        <p style={{ color: '#d1d5db', lineHeight: 1.8, fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
          {selectedTemplate
            ? `The next evaluation will use the "${selectedTemplate.label}" rubric.`
            : 'No template selected. The coach will evaluate generally using ELP flow and the 20% intro / 60% body / 20% conclusion rule.'}
        </p>
      </GlassCard>

      {selectedTemplate && (
        <div style={{ position: 'relative', marginBottom: 24, borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(124,58,237,0.25)' }}>
          <button onClick={() => onChange(null)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(5,5,14,0.78)', color: '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
          <Image src={selectedTemplate.src} alt={selectedTemplate.label} width={900} height={600} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      )}
    </>
  );
}

function Sidebar({ activeTab, setActiveTab, open, onClose }: { activeTab: Tab; setActiveTab: (tab: Tab) => void; open: boolean; onClose: () => void }) {
  const tabs = [
    { id: 'coach' as const, label: 'Speaking Coach', sub: 'Record & analyse', icon: '🎙' },
    { id: 'speech' as const, label: 'Speech Practice', sub: 'Generate & rehearse', icon: '✍' },
  ];

  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.6)' }} className="md:hidden" />}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          width: 280,
          padding: 18,
          background: 'rgba(8,8,18,0.96)',
          borderRight: '1px solid rgba(124,58,237,0.14)',
          backdropFilter: 'blur(24px)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s ease',
        }}
        className="md:translate-x-0 md:static md:h-screen"
      >
        <div style={{ padding: '12px 8px 28px', borderBottom: '1px solid rgba(124,58,237,0.12)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #4c1d95, #7c3aed)' }}>🎙</div>
            <div>
              <div style={{ fontSize: 24, letterSpacing: 3, fontFamily: "'Cormorant Garamond', serif", fontStyle: 'italic', background: 'linear-gradient(90deg, #c4b5fd, #f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AAWAZ</div>
              <div style={{ fontSize: 9, color: '#9ca3af', letterSpacing: 3, fontFamily: "'DM Mono', monospace" }}>SPEECH COACH</div>
            </div>
          </div>
        </div>

        <div style={{ paddingTop: 20 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                onClose();
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '16px 18px',
                marginBottom: 8,
                border: 'none',
                borderRadius: 16,
                cursor: 'pointer',
                color: activeTab === tab.id ? '#ede9fe' : '#9ca3af',
                background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(109,40,217,0.08))' : 'transparent',
              }}
            >
              <span style={{ fontSize: 20 }}>{tab.icon}</span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 15, fontFamily: "'Cormorant Garamond', serif" }}>{tab.label}</div>
                <div style={{ fontSize: 10, letterSpacing: 1, fontFamily: "'DM Mono', monospace" }}>{tab.sub}</div>
              </div>
              {activeTab === tab.id && <ChevronRight style={{ width: 14, height: 14, color: '#a78bfa' }} />}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          <GlassCard accent="#7c3aed">
            <SectionLabel text="Powered By" color="#a78bfa" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ddd6fe', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
              <Zap style={{ width: 12, height: 12, color: '#fbbf24' }} />
              GROQ × LLAMA 3.3
            </div>
          </GlassCard>
        </div>
      </aside>
    </>
  );
}

function useSpeechHistory(userId: string) {
  const [history, setHistory] = useState<SpeechHistoryItem[]>([]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const load = async () => {
      try {
        const res = await fetch(`/api/evaluations/history?userId=${encodeURIComponent(userId)}`);
        const data = await res.json();
        setHistory(data.history || []);
      } catch {
        setHistory([]);
      }
    };

    void load();
  }, [userId]);

  return [history, setHistory] as const;
}

function CoachTab() {
  const userId = usePersistentUserId();
  const [history, setHistory] = useSpeechHistory(userId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpeechTemplateId | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const form = new FormData();
        form.append('file', blob, 'speech.webm');
        form.append('userId', userId);
        if (selectedTemplateId) {
          form.append('templateId', selectedTemplateId);
        }
        const res = await fetch('/api/transcribe-analyze', { method: 'POST', body: form });
        const data = await res.json();
        setTranscript(data.transcript || '');
        setFeedback(data.feedback || '');
        setHistory(data.history || []);
        setIsAnalyzing(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setTranscript('');
      setFeedback('');
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => setSeconds((current) => current + 1), 1000);
    } catch {
      alert('Microphone access required');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsAnalyzing(true);
  };

  return (
    <div style={{ animation: 'fade-up 0.5s ease both' }}>
      <div style={{ marginBottom: 42 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, transparent, #7c3aed)' }} />
          <span style={{ fontSize: 10, color: '#a78bfa', letterSpacing: 4, fontFamily: "'DM Mono', monospace" }}>SPEAKING COACH</span>
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 5vw, 54px)', lineHeight: 1.08, fontWeight: 600, marginBottom: 12 }}>
          Brutally honest<br />
          <span style={{ fontStyle: 'italic', fontWeight: 400, background: 'linear-gradient(135deg, #c4b5fd, #f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>and now history-aware.</span>
        </h1>
        <p style={{ color: '#9ca3af', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>No fluff. Repeated mistakes get called out.</p>
      </div>

      <TemplateSelector selectedTemplateId={selectedTemplateId} onChange={setSelectedTemplateId} />

      {isRecording && (
        <GlassCard accent="#7c3aed" style={{ marginBottom: 20 }}>
          <Waveform active={true} />
        </GlassCard>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 28px' }}>
        <MicButton isRecording={isRecording} isAnalyzing={isAnalyzing} onClick={isRecording ? stopRecording : startRecording} seconds={seconds} />
      </div>

      {transcript && <TranscriptDisplay text={transcript} />}
      {feedback && <FeedbackDisplay text={feedback} />}
      <HistoryDisplay history={history} />
    </div>
  );
}

function SpeechTab() {
  const userId = usePersistentUserId();
  const [history, setHistory] = useSpeechHistory(userId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpeechTemplateId | null>(null);
  const [topic, setTopic] = useState('');
  const [speech, setSpeech] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(0);
  const speechDisplayed = useTypewriter(speech, 8);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const generateSpeech = async () => {
    if (!topic.trim()) {
      return;
    }

    setIsGenerating(true);
    setSpeech('');
    setError('');
    setTranscript('');
    setFeedback('');

    try {
      const res = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSpeech(data.speech);
      }
    } catch {
      setError('Failed to generate. Try again.');
    }

    setIsGenerating(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const form = new FormData();
        form.append('file', blob, 'speech.webm');
        form.append('userId', userId);
        if (selectedTemplateId) {
          form.append('templateId', selectedTemplateId);
        }
        const res = await fetch('/api/transcribe-analyze', { method: 'POST', body: form });
        const data = await res.json();
        setTranscript(data.transcript || '');
        setFeedback(data.feedback || '');
        setHistory(data.history || []);
        setIsAnalyzing(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setTranscript('');
      setFeedback('');
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => setSeconds((current) => current + 1), 1000);
    } catch {
      alert('Microphone access required');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    setIsAnalyzing(true);
  };

  return (
    <div style={{ animation: 'fade-up 0.5s ease both' }}>
      <div style={{ marginBottom: 42 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, transparent, #7c3aed)' }} />
          <span style={{ fontSize: 10, color: '#a78bfa', letterSpacing: 4, fontFamily: "'DM Mono', monospace" }}>SPEECH PRACTICE</span>
        </div>
        <h1 style={{ fontSize: 'clamp(36px, 5vw, 54px)', lineHeight: 1.08, fontWeight: 600, marginBottom: 12 }}>
          Generate.<br />
          <span style={{ fontStyle: 'italic', fontWeight: 400, background: 'linear-gradient(135deg, #c4b5fd, #f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Rehearse. Improve.</span>
        </h1>
        <p style={{ color: '#9ca3af', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>Template-aware evaluation works here too.</p>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
        <input
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          onKeyDown={(event) => event.key === 'Enter' && generateSpeech()}
          placeholder="e.g. Leadership, climate change, my role model..."
          style={{
            flex: 1,
            borderRadius: 14,
            border: '1px solid rgba(124,58,237,0.2)',
            background: 'rgba(124,58,237,0.06)',
            color: '#e5e7eb',
            padding: '14px 18px',
            fontSize: 14,
            fontFamily: "'DM Mono', monospace",
          }}
        />
        <button
          onClick={generateSpeech}
          disabled={isGenerating || !topic.trim()}
          style={{
            padding: '14px 18px',
            borderRadius: 14,
            border: 'none',
            background: isGenerating || !topic.trim() ? 'rgba(124,58,237,0.14)' : 'linear-gradient(135deg, #4c1d95, #7c3aed)',
            color: isGenerating || !topic.trim() ? '#6b7280' : '#ede9fe',
            cursor: isGenerating || !topic.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: "'DM Mono', monospace",
            fontSize: 12,
            letterSpacing: 2,
          }}
        >
          <Sparkles style={{ width: 15, height: 15, animation: isGenerating ? 'spin-icon 1.2s linear infinite' : 'none' }} />
          {isGenerating ? 'WRITING...' : 'GENERATE'}
        </button>
      </div>
      {error && <p style={{ color: '#f87171', fontSize: 12, fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>{error}</p>}

      <TemplateSelector selectedTemplateId={selectedTemplateId} onChange={setSelectedTemplateId} />

      {(speech || isGenerating) && (
        <GlassCard accent="#7c3aed" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <SectionLabel text={`Sample · ${topic || 'Speech'}`} color="#a78bfa" />
            {!isGenerating && (
              <button onClick={generateSpeech} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}>
                <RefreshCw style={{ width: 15, height: 15 }} />
              </button>
            )}
          </div>
          {isGenerating ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: `dot-bounce 0.8s ${i * 0.2}s ease-in-out infinite` }} />)}
            </div>
          ) : (
            <p style={{ color: '#d1d5db', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>{speechDisplayed}</p>
          )}
        </GlassCard>
      )}

      {speech && !isGenerating && (
        <>
          {isRecording && (
            <GlassCard accent="#7c3aed" style={{ marginBottom: 20 }}>
              <Waveform active={true} />
            </GlassCard>
          )}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0 28px' }}>
            <MicButton isRecording={isRecording} isAnalyzing={isAnalyzing} onClick={isRecording ? stopRecording : startRecording} seconds={seconds} />
          </div>
          {transcript && <TranscriptDisplay text={transcript} />}
          {feedback && <FeedbackDisplay text={feedback} />}
          <HistoryDisplay history={history} />
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', fontFamily: "'Cormorant Garamond', serif" }}>
      <style>{GLOBAL_CSS}</style>
      <Background />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 58, zIndex: 30, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', background: 'rgba(5,5,14,0.9)', borderBottom: '1px solid rgba(124,58,237,0.12)' }} className="md:hidden">
        <button onClick={() => setSidebarOpen(true)} style={{ border: '1px solid rgba(124,58,237,0.25)', background: 'rgba(124,58,237,0.12)', color: '#c4b5fd', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex' }}>
          <Menu style={{ width: 18, height: 18 }} />
        </button>
        <span style={{ fontSize: 20, letterSpacing: 2, fontStyle: 'italic', background: 'linear-gradient(90deg,#c4b5fd,#f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AAWAZ</span>
      </div>

      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '78px 24px 80px' }}>
          {activeTab === 'coach' ? <CoachTab /> : <SpeechTab />}
        </div>
      </main>
    </div>
  );
}
