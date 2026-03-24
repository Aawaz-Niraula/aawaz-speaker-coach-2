'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronRight, Menu, Mic, MicOff, RefreshCw, Sparkles, X, Zap } from 'lucide-react';

import { SPEECH_TEMPLATES, type SpeechTemplateId } from '@/lib/speech-config';

type Tab = 'coach' | 'speech';

type SpeechHistoryItem = {
  id: string;
  created_at: string;
  template_label: string | null;
  overall_score: number | null;
  words_per_min: number | null;
  transcript: string;
  feedback: string;
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #05050e; color: #edf2ff; overflow-x: hidden; }
  button, input, select { font-family: inherit; }
  @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 24px rgba(124,58,237,.22); } 50% { box-shadow: 0 0 44px rgba(124,58,237,.38); } }
  @keyframes record-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,.35); } 50% { box-shadow: 0 0 0 20px rgba(239,68,68,0); } }
  @keyframes dot-bounce { 0%,100% { transform: translateY(0); opacity: .35; } 50% { transform: translateY(-6px); opacity: 1; } }
`;

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

function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, #060611 0%, #030308 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 20% 10%, rgba(168,85,247,.22), transparent 24%), radial-gradient(circle at 84% 16%, rgba(244,114,182,.12), transparent 22%)' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(124,58,237,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,.05) 1px, transparent 1px)', backgroundSize: '58px 58px', opacity: .25 }} />
    </div>
  );
}

function GlassCard({ children, accent = '#7c3aed', style = {} }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) {
  return <div style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.045), rgba(255,255,255,.018))', border: `1px solid ${accent}30`, borderLeft: `2px solid ${accent}`, borderRadius: 22, padding: '20px 22px', boxShadow: `0 10px 30px ${accent}10`, backdropFilter: 'blur(20px)', ...style }}>{children}</div>;
}

function SectionLabel({ text, color }: { text: string; color: string }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} /><span style={{ color, fontSize: 11, letterSpacing: 3, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>{text}</span><div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${color}55, transparent)` }} /></div>;
}

function FeedbackDisplay({ text }: { text: string }) {
  const scoreMatch = text.match(/overall score[:\s-]*(\d+)\/100/i);
  return <GlassCard accent="#f87171"><SectionLabel text="Coach Verdict" color="#f87171" />{scoreMatch && <p style={{ color: '#fbbf24', fontSize: 14, fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>Overall score: {scoreMatch[1]}/100</p>}<p style={{ color: '#edf2ff', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>{text}</p></GlassCard>;
}

function TranscriptDisplay({ text }: { text: string }) {
  return <GlassCard accent="#fbbf24"><SectionLabel text="Transcript" color="#fbbf24" /><p style={{ color: '#edf2ff', lineHeight: 1.85, whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>{text}</p></GlassCard>;
}

function formatHistoryDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function TemplateSelector({ selectedTemplateId, onChange }: { selectedTemplateId: SpeechTemplateId | null; onChange: (id: SpeechTemplateId | null) => void }) {
  const selectedTemplate = SPEECH_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? null;

  return (
    <>
      <GlassCard accent="#7c3aed">
        <SectionLabel text="Speech Format" color="#a78bfa" />
        <select
          value={selectedTemplateId ?? ''}
          onChange={(event) => onChange((event.target.value || null) as SpeechTemplateId | null)}
          style={{
            width: '100%',
            borderRadius: 14,
            border: '1px solid rgba(124,58,237,.2)',
            background: 'rgba(124,58,237,.08)',
            color: '#edf2ff',
            padding: '14px 16px',
            fontSize: 13,
            fontFamily: "'DM Mono', monospace",
            marginBottom: 12,
          }}
        >
          <option value="">General evaluation</option>
          {SPEECH_TEMPLATES.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        <p style={{ color: '#94a3b8', lineHeight: 1.8, fontSize: 13, fontFamily: "'DM Mono', monospace" }}>
          {selectedTemplate ? `Active rubric: ${selectedTemplate.label}.` : 'No template selected. General evaluation uses ELP and the 20% intro / 60% body / 20% conclusion rule.'}
        </p>
      </GlassCard>

      {selectedTemplate && (
        <div style={{ position: 'relative', marginTop: 14, borderRadius: 22, overflow: 'hidden', border: '1px solid rgba(124,58,237,.22)' }}>
          <button onClick={() => onChange(null)} style={{ position: 'absolute', top: 12, right: 12, zIndex: 2, width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,.12)', background: 'rgba(5,5,14,.78)', color: '#d1d5db', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X style={{ width: 16, height: 16 }} /></button>
          <Image src={selectedTemplate.src} alt={selectedTemplate.label} width={900} height={600} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      )}
    </>
  );
}

function SessionBrowser({ history, selectedSessionId, onSelect }: { history: SpeechHistoryItem[]; selectedSessionId: string | null; onSelect: (id: string) => void }) {
  return <GlassCard accent="#34d399"><SectionLabel text="Speech History" color="#34d399" /><div style={{ display: 'grid', gap: 10 }}>{history.length ? history.map((item, index) => { const active = item.id === selectedSessionId; return <button key={item.id} onClick={() => onSelect(item.id)} style={{ width: '100%', textAlign: 'left', borderRadius: 18, border: `1px solid ${active ? 'rgba(52,211,153,.35)' : 'rgba(148,163,184,.12)'}`, background: active ? 'linear-gradient(135deg, rgba(16,185,129,.14), rgba(124,58,237,.08))' : 'rgba(8,13,18,.52)', padding: '14px 15px', cursor: 'pointer', color: '#e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}><span style={{ color: active ? '#86efac' : '#cbd5e1', fontSize: 11, letterSpacing: 2, fontFamily: "'DM Mono', monospace", textTransform: 'uppercase' }}>Session {history.length - index}</span><span style={{ color: '#94a3b8', fontSize: 11, fontFamily: "'DM Mono', monospace" }}>{formatHistoryDate(item.created_at)}</span></div><p style={{ color: '#d8def7', fontSize: 13, marginBottom: 6 }}>{item.template_label ?? 'General Evaluation'}</p><p style={{ color: '#94a3b8', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{item.overall_score !== null ? `${item.overall_score}/100` : 'No score'}{item.words_per_min ? ` | ${item.words_per_min} wpm` : ''}</p></button>; }) : <div style={{ borderRadius: 18, border: '1px dashed rgba(52,211,153,.2)', padding: '18px 16px', color: '#94a3b8', fontSize: 12, lineHeight: 1.7, fontFamily: "'DM Mono', monospace" }}>Saved speeches will appear here after the first evaluation.</div>}</div></GlassCard>;
}

function SessionPreview({ session }: { session: SpeechHistoryItem | null }) {
  if (!session) return null;
  return <div style={{ display: 'grid', gap: 12 }}><TranscriptDisplay text={session.transcript} /><FeedbackDisplay text={session.feedback} /></div>;
}

function MicButton({ isRecording, isAnalyzing, onClick, seconds }: { isRecording: boolean; isAnalyzing: boolean; onClick: () => void; seconds: number }) {
  const label = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}><button onClick={onClick} disabled={isAnalyzing} style={{ width: 132, height: 132, borderRadius: '50%', border: '1px solid rgba(255,255,255,.08)', cursor: isAnalyzing ? 'not-allowed' : 'pointer', color: '#f5f3ff', background: isRecording ? 'linear-gradient(135deg, #4a0d0d, #991b1b)' : 'linear-gradient(135deg, #21104a, #6d28d9, #8b5cf6)', animation: isRecording ? 'record-pulse 2s ease-in-out infinite' : 'pulse-glow 3s ease-in-out infinite', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{isAnalyzing ? <Sparkles style={{ width: 38, height: 38, animation: 'spin-icon 1.2s linear infinite' }} /> : isRecording ? <MicOff style={{ width: 38, height: 38 }} /> : <Mic style={{ width: 38, height: 38 }} />}</button><div style={{ textAlign: 'center' }}>{isAnalyzing ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#c4b5fd', animation: `dot-bounce 0.8s ${i * 0.2}s ease-in-out infinite` }} />)}<span style={{ fontSize: 11, letterSpacing: 3, color: '#c4b5fd', fontFamily: "'DM Mono', monospace" }}>ANALYSING</span></div> : isRecording ? <><div style={{ fontSize: 34, color: '#fecaca' }}>{label}</div><div style={{ fontSize: 10, color: '#f87171', letterSpacing: 3, fontFamily: "'DM Mono', monospace" }}>TAP TO STOP</div></> : <div style={{ fontSize: 11, color: '#a5b4fc', letterSpacing: 3, fontFamily: "'DM Mono', monospace" }}>TAP TO SPEAK</div>}</div></div>;
}

function Hero({ eyebrow, description }: { eyebrow: string; description: string }) {
  return <div style={{ marginBottom: 28 }}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}><div style={{ width: 38, height: 1, background: 'linear-gradient(90deg, transparent, #8b5cf6)' }} /><span style={{ fontSize: 10, color: '#c4b5fd', letterSpacing: 4, fontFamily: "'DM Mono', monospace" }}>{eyebrow}</span></div><h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.04, fontWeight: 600, marginBottom: 12 }}>Aawaz Speaker Coach</h1><p style={{ maxWidth: 640, color: '#9ba4c7', fontSize: 14, lineHeight: 1.8, fontFamily: "'DM Mono', monospace" }}>{description}</p></div>;
}

function Sidebar({ activeTab, setActiveTab, open, onClose }: { activeTab: Tab; setActiveTab: (tab: Tab) => void; open: boolean; onClose: () => void }) {
  const tabs = [{ id: 'coach' as const, label: 'Speaking Coach', sub: 'Record and review' }, { id: 'speech' as const, label: 'Speech Practice', sub: 'Generate only' }];
  return (
    <>
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,.65)' }} className="md:hidden" />}
      <aside style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, width: 280, padding: 18, background: 'rgba(8,8,18,.94)', borderRight: '1px solid rgba(124,58,237,.14)', backdropFilter: 'blur(24px)', transform: open ? 'translateX(0)' : 'translateX(-100%)', transition: 'transform .3s ease' }} className="md:translate-x-0 md:static md:h-screen">
        <div style={{ padding: '10px 8px 26px', borderBottom: '1px solid rgba(124,58,237,.12)' }}><div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><div style={{ width: 44, height: 44, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #4c1d95, #7c3aed)', color: '#f5f3ff', fontFamily: "'DM Mono', monospace" }}>A</div><div><div style={{ fontSize: 24, letterSpacing: 2.5, fontFamily: "'Cormorant Garamond', serif", background: 'linear-gradient(90deg, #c4b5fd, #f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>AAWAZ</div><div style={{ fontSize: 10, color: '#9ca3af', letterSpacing: 3, fontFamily: "'DM Mono', monospace" }}>SPEAKER COACH</div></div></div></div>
        <div style={{ paddingTop: 20 }}>{tabs.map((tab) => <button key={tab.id} onClick={() => { setActiveTab(tab.id); onClose(); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '16px 18px', marginBottom: 8, border: 'none', borderRadius: 18, cursor: 'pointer', color: activeTab === tab.id ? '#ede9fe' : '#9ca3af', background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(124,58,237,.25), rgba(109,40,217,.08))' : 'transparent' }}><span style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(124,58,237,.12)', fontSize: 12, fontFamily: "'DM Mono', monospace" }}>{tab.label[0]}</span><div style={{ flex: 1, textAlign: 'left' }}><div style={{ fontSize: 16 }}>{tab.label}</div><div style={{ fontSize: 10, letterSpacing: 1, fontFamily: "'DM Mono', monospace" }}>{tab.sub}</div></div>{activeTab === tab.id && <ChevronRight style={{ width: 14, height: 14, color: '#c4b5fd' }} />}</button>)}</div>
        <div style={{ marginTop: 'auto', paddingTop: 18 }}><GlassCard accent="#7c3aed"><SectionLabel text="Powered By" color="#a78bfa" /><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ddd6fe', fontSize: 12, fontFamily: "'DM Mono', monospace" }}><Zap style={{ width: 12, height: 12, color: '#fbbf24' }} />GROQ x LLAMA 3.3</div></GlassCard></div>
      </aside>
    </>
  );
}

function useSpeechHistory(userId: string) {
  const [history, setHistory] = useState<SpeechHistoryItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!userId) return;
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
  return { history, setHistory, selectedSessionId, setSelectedSessionId };
}

function CoachTab() {
  const userId = usePersistentUserId();
  const { history, setHistory, selectedSessionId, setSelectedSessionId } = useSpeechHistory(userId);
  const [selectedTemplateId, setSelectedTemplateId] = useState<SpeechTemplateId | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [feedback, setFeedback] = useState('');
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedSession = history.find((item) => item.id === selectedSessionId) ?? null;

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        const blob = new Blob(chunksRef.current, { type: 'audio/webm;codecs=opus' });
        const form = new FormData();
        form.append('file', blob, 'speech.webm');
        form.append('userId', userId);
        if (selectedTemplateId) form.append('templateId', selectedTemplateId);
        const res = await fetch('/api/transcribe-analyze', { method: 'POST', body: form });
        const data = await res.json();
        setTranscript(data.transcript || '');
        setFeedback(data.feedback || '');
        setHistory(data.history || []);
        setSelectedSessionId(null);
        setIsAnalyzing(false);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setTranscript('');
      setFeedback('');
      setSeconds(0);
      setIsRecording(true);
      timerRef.current = setInterval(() => setSeconds((current) => current + 1), 1000);
    } catch { alert('Microphone access required'); }
  };

  const stopRecording = () => { mediaRecorderRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); setIsRecording(false); setIsAnalyzing(true); };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Hero eyebrow="SPEAKING COACH" description="Record, get direct technical feedback, and open older speeches from the history list only when you need them." />
      <TemplateSelector selectedTemplateId={selectedTemplateId} onChange={setSelectedTemplateId} />
      <GlassCard accent="#7c3aed"><SectionLabel text="Live Evaluation" color="#a78bfa" />{isRecording && <div style={{ marginBottom: 20, padding: '16px 0', borderRadius: 18, background: 'rgba(124,58,237,.07)', border: '1px solid rgba(124,58,237,.14)' }}><div style={{ display: 'flex', justifyContent: 'center', gap: 4, height: 48 }}>{Array.from({ length: 30 }).map((_, index) => <div key={index} style={{ width: 4, height: '100%', borderRadius: 99, background: `hsl(${265 + index * 2}, 86%, 74%)`, transformOrigin: 'center', transform: `scaleY(${0.25 + ((index % 7) + 1) / 8})` }} />)}</div></div>}<div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}><MicButton isRecording={isRecording} isAnalyzing={isAnalyzing} onClick={isRecording ? stopRecording : startRecording} seconds={seconds} /></div></GlassCard>
      {transcript && <TranscriptDisplay text={transcript} />}
      {feedback && <FeedbackDisplay text={feedback} />}
      <SessionBrowser history={history} selectedSessionId={selectedSessionId} onSelect={setSelectedSessionId} />
      <SessionPreview session={selectedSession} />
    </div>
  );
}

function SpeechTab() {
  const [topic, setTopic] = useState('');
  const [speech, setSpeech] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  const generateSpeech = async () => {
    if (!topic.trim()) return;
    setIsGenerating(true);
    setSpeech('');
    setError('');
    try {
      const res = await fetch('/api/generate-speech', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic }) });
      const data = await res.json();
      if (data.error) setError(data.error); else setSpeech(data.speech);
    } catch { setError('Failed to generate. Try again.'); }
    setIsGenerating(false);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Hero eyebrow="SPEECH PRACTICE" description="Generate sample speeches only. This tab is now focused on writing, without the speech-evaluation controls mixed into it." />
      <GlassCard accent="#7c3aed">
        <SectionLabel text="Generate Topic Speech" color="#a78bfa" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && generateSpeech()} placeholder="e.g. Leadership, climate change, my role model..." style={{ flex: 1, minWidth: 240, borderRadius: 16, border: '1px solid rgba(124,58,237,.20)', background: 'rgba(124,58,237,.06)', color: '#edf2ff', padding: '15px 18px', fontSize: 14, fontFamily: "'DM Mono', monospace" }} />
          <button onClick={generateSpeech} disabled={isGenerating || !topic.trim()} style={{ padding: '15px 18px', borderRadius: 16, border: 'none', background: isGenerating || !topic.trim() ? 'rgba(124,58,237,.14)' : 'linear-gradient(135deg, #4c1d95, #7c3aed)', color: isGenerating || !topic.trim() ? '#6b7280' : '#ede9fe', cursor: isGenerating || !topic.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: 2 }}><Sparkles style={{ width: 15, height: 15, animation: isGenerating ? 'spin-icon 1.2s linear infinite' : 'none' }} />{isGenerating ? 'WRITING...' : 'GENERATE'}</button>
        </div>
        {error && <p style={{ color: '#f87171', fontSize: 12, fontFamily: "'DM Mono', monospace", marginTop: 12 }}>{error}</p>}
      </GlassCard>

      {(speech || isGenerating) && <GlassCard accent="#7c3aed"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}><SectionLabel text={`Sample Speech${topic ? ` | ${topic}` : ''}`} color="#a78bfa" />{!isGenerating && <button onClick={generateSpeech} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer' }}><RefreshCw style={{ width: 15, height: 15 }} /></button>}</div>{isGenerating ? <div style={{ display: 'flex', gap: 6 }}>{[0, 1, 2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#c4b5fd', animation: `dot-bounce 0.8s ${i * 0.2}s ease-in-out infinite` }} />)}</div> : <p style={{ color: '#d8def7', lineHeight: 1.9, whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: "'DM Mono', monospace" }}>{speech}</p>}</GlassCard>}
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
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 60, zIndex: 30, display: 'flex', alignItems: 'center', gap: 14, padding: '0 18px', background: 'rgba(5,5,14,.92)', borderBottom: '1px solid rgba(124,58,237,.12)' }} className="md:hidden"><button onClick={() => setSidebarOpen(true)} style={{ border: '1px solid rgba(124,58,237,.25)', background: 'rgba(124,58,237,.12)', color: '#c4b5fd', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', display: 'flex' }}><Menu style={{ width: 18, height: 18 }} /></button><span style={{ fontSize: 20, letterSpacing: 1.2, background: 'linear-gradient(90deg,#c4b5fd,#f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Aawaz Speaker Coach</span></div>
      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}><div style={{ maxWidth: 760, margin: '0 auto', padding: '82px 20px 72px' }}>{activeTab === 'coach' ? <CoachTab /> : <SpeechTab />}</div></main>
    </div>
  );
}
