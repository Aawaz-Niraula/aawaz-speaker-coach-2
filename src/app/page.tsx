'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronRight, Menu, Mic, MicOff, RefreshCw, Sparkles, Trash2, X, Zap } from 'lucide-react';

import { SPEECH_TEMPLATES, type SpeechTemplateId } from '@/lib/speech-config';

type Tab = 'coach' | 'speech' | 'history';

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
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background:
      radial-gradient(circle at top, rgba(139, 92, 246, 0.16), transparent 22%),
      radial-gradient(circle at 82% 14%, rgba(244, 114, 182, 0.10), transparent 18%),
      linear-gradient(180deg, #06060b 0%, #0b0b12 48%, #11111a 100%);
    color: #f5f1e8;
    overflow-x: hidden;
  }
  button, input, select { font-family: inherit; }
  @keyframes record-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(181, 88, 71, 0.18); }
    50% { box-shadow: 0 0 0 18px rgba(181, 88, 71, 0); }
  }
  @keyframes dot-bounce {
    0%,100% { transform: translateY(0); opacity: 0.38; }
    50% { transform: translateY(-5px); opacity: 1; }
  }
  @keyframes gentle-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  @keyframes popover-in {
    from { opacity: 0; transform: scale(0.92) translateY(-6px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }
`;

const palette = {
  paper: 'rgba(14, 14, 20, 0.80)',
  line: 'rgba(167, 139, 250, 0.12)',
  lineStrong: 'rgba(196, 181, 253, 0.24)',
  text: '#f2efff',
  muted: '#a59dbd',
  soft: '#857ca2',
  accent: '#a78bfa',
  accentSoft: '#f9a8d4',
  warning: '#fbbf24',
  danger: '#f87171',
};

function usePersistentUserId() {
  const [userId] = useState(() => {
    if (typeof window === 'undefined') return '';
    const key = 'aawaz-user-id';
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const nextId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `user-${Date.now()}`;
    window.localStorage.setItem(key, nextId);
    return nextId;
  });
  return userId;
}

function Background() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 18% 16%, rgba(124, 58, 237, 0.22), transparent 18%), radial-gradient(circle at 82% 12%, rgba(244, 114, 182, 0.12), transparent 16%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(124, 58, 237, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124, 58, 237, 0.05) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.8), transparent 82%)',
        }}
      />
    </div>
  );
}

function Surface({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: palette.paper,
        border: `1px solid ${palette.line}`,
        borderRadius: 28,
        padding: '24px',
        boxShadow: '0 18px 60px rgba(0, 0, 0, 0.30)',
        backdropFilter: 'blur(18px)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: palette.accent }} />
      <span
        style={{
          color: palette.soft,
          fontSize: 11,
          letterSpacing: 3,
          fontFamily: "'JetBrains Mono', monospace",
          textTransform: 'uppercase',
        }}
      >
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${palette.lineStrong}, transparent)` }} />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        minWidth: 112,
        padding: '12px 14px',
        borderRadius: 18,
        border: `1px solid ${palette.line}`,
        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.10), rgba(255, 255, 255, 0.02))',
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color: palette.soft, fontFamily: "'JetBrains Mono', monospace", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, color: palette.text, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

const HOW_TO_TIPS = [
  'Tap the mic in this tab to record your speech and receive specialised AI coaching feedback.',
  'Browse the Speech Format dropdown and select a template (e.g. Debate, MUN, Impromptu) for rubric-aware evaluations.',
  'Head to the Speech Practice tab on the left to generate a short sample speech on any topic to practise with.',
  'Visit the Speech History tab to replay your transcripts and feedback, and track your improvement over time.',
  'Happy speaking — use the coach as guidance, not gospel!',
];

function InfoPopover() {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="How to use Aawaz"
        style={{
          width: 26,
          height: 26,
          borderRadius: '50%',
          border: `1.5px solid ${palette.lineStrong}`,
          background: 'rgba(167, 139, 250, 0.12)',
          color: palette.accent,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          flexShrink: 0,
          transition: 'background 0.2s, border-color 0.2s',
        }}
      >
        ?
      </button>

      {/* Popover */}
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            left: 0,
            zIndex: 200,
            width: 'min(380px, 90vw)',
            borderRadius: 22,
            border: `1px solid ${palette.lineStrong}`,
            background: 'rgba(12, 10, 22, 0.97)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(167,139,250,0.08)',
            animation: 'popover-in 0.22s cubic-bezier(0.22,1,0.36,1) both',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 18px 12px',
              borderBottom: `1px solid ${palette.line}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: palette.accent }} />
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: 3,
                  color: palette.soft,
                  fontFamily: "'JetBrains Mono', monospace",
                  textTransform: 'uppercase',
                }}
              >
                How to use
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                border: `1px solid rgba(248,113,113,0.30)`,
                background: 'rgba(248,113,113,0.10)',
                color: palette.danger,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <X style={{ width: 13, height: 13 }} />
            </button>
          </div>

          {/* Tips list */}
          <ol style={{ padding: '14px 18px 18px', display: 'grid', gap: 10, listStyle: 'none' }}>
            {HOW_TO_TIPS.map((tip, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    background: i === HOW_TO_TIPS.length - 1
                      ? 'linear-gradient(135deg, rgba(249,168,212,0.22), rgba(167,139,250,0.14))'
                      : 'linear-gradient(135deg, rgba(124,58,237,0.28), rgba(167,139,250,0.16))',
                    border: `1px solid ${i === HOW_TO_TIPS.length - 1 ? 'rgba(249,168,212,0.22)' : palette.line}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: i === HOW_TO_TIPS.length - 1 ? palette.accentSoft : palette.accent,
                    fontWeight: 700,
                    marginTop: 1,
                  }}
                >
                  {i === HOW_TO_TIPS.length - 1 ? '★' : i + 1}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: i === HOW_TO_TIPS.length - 1 ? palette.accentSoft : palette.text,
                    lineHeight: 1.7,
                    fontStyle: i === HOW_TO_TIPS.length - 1 ? 'italic' : 'normal',
                  }}
                >
                  {tip}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function MadeByBadge() {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        padding: '5px 12px 5px 8px',
        borderRadius: 999,
        border: `1px solid rgba(167, 139, 250, 0.28)`,
        background: 'linear-gradient(90deg, rgba(124,58,237,0.18), rgba(244,114,182,0.10))',
        backdropFilter: 'blur(8px)',
      }}
    >
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #312e81, #7c3aed)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 8,
          color: '#f5f3ff',
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        A
      </span>
      <span
        style={{
          fontSize: 11,
          fontFamily: "'JetBrains Mono', monospace",
          letterSpacing: 2,
          textTransform: 'uppercase',
          background: 'linear-gradient(90deg, #a78bfa, #f9a8d4)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          fontWeight: 700,
        }}
      >
        made by aawaz
      </span>
    </div>
  );
}

function FeedbackDisplay({ text }: { text: string }) {
  const scoreMatch = text.match(/overall score[:\s-]*(\d+)\/100/i);

  return (
    <Surface>
      <SectionLabel text="Coach Verdict" />
      {scoreMatch ? (
        <div style={{ marginBottom: 16 }}>
          <StatPill label="Overall Score" value={`${scoreMatch[1]}/100`} />
        </div>
      ) : null}
      <p style={{ color: palette.text, lineHeight: 1.9, whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>{text}</p>
    </Surface>
  );
}

function TranscriptDisplay({ text }: { text: string }) {
  return (
    <Surface>
      <SectionLabel text="Transcript" />
      <p style={{ color: palette.text, lineHeight: 1.9, whiteSpace: 'pre-wrap', fontSize: 14, fontFamily: "'JetBrains Mono', monospace" }}>{text}</p>
    </Surface>
  );
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
      <Surface>
        <SectionLabel text="Speech Format" />
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <select
            value={selectedTemplateId ?? ''}
            onChange={(event) => onChange((event.target.value || null) as SpeechTemplateId | null)}
            style={{
              width: '100%',
              borderRadius: 18,
              border: `1px solid ${palette.lineStrong}`,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(255,255,255,0.03))',
              color: palette.text,
              padding: '16px 48px 16px 18px',
              fontSize: 14,
              fontFamily: "'Manrope', sans-serif",
              colorScheme: 'dark',
              appearance: 'none',
              WebkitAppearance: 'none',
              MozAppearance: 'none',
              outline: 'none',
            }}
          >
            <option value="" style={{ background: '#120f24', color: '#f2efff' }}>
              General evaluation
            </option>
            {SPEECH_TEMPLATES.map((template) => (
              <option
                key={template.id}
                value={template.id}
                style={{ background: '#120f24', color: '#f2efff' }}
              >
                {template.label}
              </option>
            ))}
          </select>
          <div style={{ position: 'absolute', right: 18, top: '50%', transform: 'translateY(-50%)', color: palette.soft, pointerEvents: 'none', fontSize: 16 }}>
            ▾
          </div>
        </div>
        <p style={{ color: palette.muted, lineHeight: 1.8, fontSize: 14, maxWidth: 760 }}>
          {selectedTemplate ? `Active rubric: ${selectedTemplate.label}.` : 'No template selected. General evaluation uses ELP and the 20% intro / 60% body / 20% conclusion rule.'}
        </p>
      </Surface>

      {selectedTemplate ? (
        <div style={{ position: 'relative', marginTop: 14, borderRadius: 28, overflow: 'hidden', border: `1px solid ${palette.line}`, boxShadow: '0 16px 50px rgba(66, 53, 35, 0.08)' }}>
          <button
            onClick={() => onChange(null)}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              zIndex: 2,
              width: 38,
              height: 38,
              borderRadius: '50%',
              border: `1px solid ${palette.line}`,
              background: 'rgba(12,12,14,0.82)',
              color: palette.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
          <Image src={selectedTemplate.src} alt={selectedTemplate.label} width={900} height={600} style={{ width: '100%', height: 'auto', display: 'block' }} />
        </div>
      ) : null}
    </>
  );
}

function SessionBrowser({
  history,
  selectedSessionId,
  onSelect,
  onDelete,
}: {
  history: SpeechHistoryItem[];
  selectedSessionId: string | null;
  onSelect: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Surface>
      <SectionLabel text="Speech History" />
      <div style={{ display: 'grid', gap: 10 }}>
        {history.length ? history.map((item, index) => {
          const active = item.id === selectedSessionId;
          return (
            <button
              key={item.id}
              onClick={() => onSelect(active ? null : item.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                borderRadius: 22,
                border: `1px solid ${active ? palette.lineStrong : palette.line}`,
                background: active ? 'linear-gradient(135deg, rgba(124,58,237,0.20), rgba(244,114,182,0.08))' : 'rgba(255,255,255,0.02)',
                padding: '16px 18px',
                cursor: 'pointer',
                color: palette.text,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ color: active ? palette.accent : palette.soft, fontSize: 11, letterSpacing: 2, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>
                    Session {history.length - index}
                  </span>
                  <span style={{ color: palette.soft, fontSize: 11, fontFamily: "'JetBrains Mono', monospace" }}>
                    {formatHistoryDate(item.created_at)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDelete(item.id);
                  }}
                  style={{
                    border: `1px solid ${palette.line}`,
                    background: 'rgba(248, 113, 113, 0.08)',
                    color: palette.danger,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                  aria-label="Delete speech session"
                  title="Delete speech session"
                >
                  <Trash2 style={{ width: 14, height: 14 }} />
                </button>
              </div>
              <p style={{ color: palette.text, fontSize: 14, marginBottom: 6, fontWeight: 600 }}>{item.template_label ?? 'General Evaluation'}</p>
              <p style={{ color: palette.muted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {item.overall_score !== null ? `${item.overall_score}/100` : 'No score'}{item.words_per_min ? ` | ${item.words_per_min} wpm` : ''}
              </p>
            </button>
          );
        }) : (
          <div style={{ borderRadius: 22, border: `1px dashed ${palette.lineStrong}`, padding: '20px 18px', color: palette.muted, fontSize: 13, lineHeight: 1.8, fontFamily: "'JetBrains Mono', monospace", background: 'rgba(255,255,255,0.02)' }}>
            Saved speeches will appear here after the first evaluation.
          </div>
        )}
      </div>
    </Surface>
  );
}

function SessionPreview({ session }: { session: SpeechHistoryItem | null }) {
  if (!session) return null;
  return <div style={{ display: 'grid', gap: 14 }}><TranscriptDisplay text={session.transcript} /><FeedbackDisplay text={session.feedback} /></div>;
}

function MicButton({ isRecording, isAnalyzing, onClick, seconds }: { isRecording: boolean; isAnalyzing: boolean; onClick: () => void; seconds: number }) {
  const label = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <button
        onClick={onClick}
        disabled={isAnalyzing}
        style={{
          width: 132,
          height: 132,
          borderRadius: '50%',
          border: `1px solid ${isRecording ? 'rgba(176, 86, 61, 0.28)' : palette.lineStrong}`,
          cursor: isAnalyzing ? 'not-allowed' : 'pointer',
          color: '#fffdf8',
          background: isRecording ? 'linear-gradient(135deg, #7f1d1d, #b91c1c)' : 'linear-gradient(135deg, #1b103b, #5b21b6)',
          animation: isRecording ? 'record-pulse 2s ease-in-out infinite' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 20px 45px rgba(0, 0, 0, 0.34)',
        }}
      >
        {isAnalyzing ? <Sparkles style={{ width: 38, height: 38, animation: 'gentle-spin 1.2s linear infinite' }} /> : isRecording ? <MicOff style={{ width: 38, height: 38 }} /> : <Mic style={{ width: 38, height: 38 }} />}
      </button>
      <div style={{ textAlign: 'center' }}>
        {isAnalyzing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: palette.accent, animation: `dot-bounce 0.8s ${i * 0.2}s ease-in-out infinite` }} />)}
            <span style={{ fontSize: 11, letterSpacing: 3, color: palette.soft, fontFamily: "'JetBrains Mono', monospace" }}>ANALYSING</span>
          </div>
        ) : isRecording ? (
          <>
            <div style={{ fontSize: 34, color: palette.danger, fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 10, color: palette.soft, letterSpacing: 3, fontFamily: "'JetBrains Mono', monospace" }}>TAP TO STOP</div>
          </>
        ) : (
          <div style={{ fontSize: 11, color: palette.soft, letterSpacing: 3, fontFamily: "'JetBrains Mono', monospace" }}>TAP TO SPEAK</div>
        )}
      </div>
    </div>
  );
}

function Hero({ eyebrow, title, description, stats }: { eyebrow: string; title: string; description: string; stats: Array<{ label: string; value: string }> }) {
  return (
    <Surface style={{ padding: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ width: 34, height: 1, background: palette.lineStrong }} />
        <span style={{ fontSize: 11, color: palette.soft, letterSpacing: 3, fontFamily: "'JetBrains Mono', monospace" }}>{eyebrow}</span>
      </div>

      {/* Title row with info button */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 8, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 'clamp(40px, 5vw, 68px)', lineHeight: 0.95, fontWeight: 400, fontFamily: "'Instrument Serif', serif", letterSpacing: '-0.03em' }}>
          {title}
        </h1>
        <div style={{ paddingTop: 10 }}>
          <InfoPopover />
        </div>
      </div>

      {/* Made by badge */}
      <MadeByBadge />

      <p style={{ maxWidth: 720, color: palette.muted, fontSize: 15, lineHeight: 1.85, marginBottom: 22, marginTop: 16 }}>{description}</p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {stats.map((stat) => <StatPill key={stat.label} label={stat.label} value={stat.value} />)}
      </div>
    </Surface>
  );
}

function Sidebar({ activeTab, setActiveTab, open, onClose }: { activeTab: Tab; setActiveTab: (tab: Tab) => void; open: boolean; onClose: () => void }) {
  const tabs = [
    { id: 'coach' as const, label: 'Speaking Coach', sub: 'Record and review' },
    { id: 'speech' as const, label: 'Speech Practice', sub: 'Generate only' },
    { id: 'history' as const, label: 'Speech History', sub: 'Previous sessions' },
  ];

  return (
    <>
      {open ? <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.48)' }} className="md:hidden" /> : null}
      <aside
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
          width: 292,
          padding: 18,
          background: 'rgba(10, 10, 12, 0.90)',
          borderRight: `1px solid ${palette.line}`,
          backdropFilter: 'blur(24px)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform .3s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
        className="md:translate-x-0 md:static md:h-screen"
      >
        <div style={{ padding: '8px 8px 24px', borderBottom: `1px solid ${palette.line}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #312e81, #7c3aed)', color: '#f5f3ff', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 1, boxShadow: '0 12px 32px rgba(124,58,237,0.30)' }}>A</div>
            <div>
              <div style={{ fontSize: 28, fontFamily: "'Instrument Serif', serif", color: palette.text, lineHeight: 1 }}>Aawaz</div>
              <div style={{ fontSize: 10, color: palette.soft, letterSpacing: 3, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>Speaker Coach</div>
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
                border: `1px solid ${activeTab === tab.id ? palette.lineStrong : 'transparent'}`,
                borderRadius: 22,
                cursor: 'pointer',
                color: palette.text,
                background: activeTab === tab.id ? 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(244,114,182,0.06))' : 'transparent',
              }}
            >
              <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: activeTab === tab.id ? 'linear-gradient(135deg, #312e81, #7c3aed)' : 'rgba(124,58,237,0.10)', color: activeTab === tab.id ? '#f5f3ff' : palette.soft, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
                {tab.label[0]}
              </span>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 16, fontWeight: 600 }}>{tab.label}</div>
                <div style={{ fontSize: 10, letterSpacing: 1.5, color: palette.soft, fontFamily: "'JetBrains Mono', monospace", textTransform: 'uppercase' }}>{tab.sub}</div>
              </div>
              {activeTab === tab.id ? <ChevronRight style={{ width: 15, height: 15, color: palette.accent }} /> : null}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'auto', paddingTop: 18 }}>
          <Surface style={{ padding: '18px' }}>
            <SectionLabel text="Powered By" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: palette.muted, fontSize: 12, fontFamily: "'JetBrains Mono', monospace" }}>
              <Zap style={{ width: 12, height: 12, color: palette.warning }} />
              GROQ x LLAMA 3.3
            </div>
          </Surface>
        </div>
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

function CoachTab({
  userId,
  setHistory,
  setSelectedSessionId,
}: {
  userId: string;
  setHistory: React.Dispatch<React.SetStateAction<SpeechHistoryItem[]>>;
  setSelectedSessionId: (id: string | null) => void;
}) {
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
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
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
    <div style={{ display: 'grid', gap: 18 }}>
      <Hero
        eyebrow="Speaking Coach"
        title="Speaking Coach"
        description="Record your speech, receive technical feedback, and revisit earlier sessions when you need to compare progress. AI can make mistakes, so use the coach as guidance rather than absolute truth."
        stats={[
          { label: 'Modes', value: '4 templates' },
          { label: 'History', value: 'Saved sessions' },
          { label: 'Review', value: 'AI analysis' },
        ]}
      />
      <TemplateSelector selectedTemplateId={selectedTemplateId} onChange={setSelectedTemplateId} />
      <Surface>
        <SectionLabel text="Live Evaluation" />
        {isRecording ? (
          <div style={{ marginBottom: 24, padding: '18px 0', borderRadius: 22, background: 'rgba(124, 58, 237, 0.08)', border: `1px solid ${palette.line}` }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 5, height: 50 }}>
              {Array.from({ length: 30 }).map((_, index) => (
                <div
                  key={index}
                  style={{
                    width: 4,
                    height: '100%',
                    borderRadius: 99,
                    background: index % 3 === 0 ? palette.accent : '#c4b5fd',
                    transformOrigin: 'center',
                    transform: `scaleY(${0.26 + ((index % 7) + 1) / 8})`,
                    opacity: 0.85,
                  }}
                />
              ))}
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <MicButton isRecording={isRecording} isAnalyzing={isAnalyzing} onClick={isRecording ? stopRecording : startRecording} seconds={seconds} />
        </div>
      </Surface>
      {transcript ? <TranscriptDisplay text={transcript} /> : null}
      {feedback ? <FeedbackDisplay text={feedback} /> : null}
    </div>
  );
}

function HistoryTab({
  history,
  selectedSessionId,
  setSelectedSessionId,
  onDelete,
}: {
  history: SpeechHistoryItem[];
  selectedSessionId: string | null;
  setSelectedSessionId: (id: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const selectedSession = history.find((item) => item.id === selectedSessionId) ?? null;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Hero
        eyebrow="Speech History"
        title="Speech History"
        description="Open any saved session to review the transcript and coaching feedback."
        stats={[
          { label: 'Saved', value: String(history.length) },
          { label: 'Access', value: 'Sidebar tab' },
          { label: 'Review', value: 'Transcript + feedback' },
        ]}
      />
      <SessionBrowser
        history={history}
        selectedSessionId={selectedSessionId}
        onSelect={setSelectedSessionId}
        onDelete={onDelete}
      />
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
      const res = await fetch('/api/generate-speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else setSpeech(data.speech);
    } catch {
      setError('Failed to generate. Try again.');
    }
    setIsGenerating(false);
  };

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Hero
        eyebrow="Speech Practice"
        title="Speech Practice"
        description="Generate sample speeches on any topic, then refine your delivery in the coaching tab."
        stats={[
          { label: 'Length', value: '60-90 sec' },
          { label: 'Style', value: 'Spoken tone' },
          { label: 'Output', value: 'Practice draft' },
        ]}
      />
      <Surface>
        <SectionLabel text="Generate Topic Speech" />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && generateSpeech()}
            placeholder="e.g. Leadership, climate change, discipline"
            style={{
              flex: 1,
              minWidth: 240,
              borderRadius: 18,
              border: `1px solid ${palette.lineStrong}`,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(255,255,255,0.03))',
              color: palette.text,
              padding: '16px 18px',
              fontSize: 14,
              fontFamily: "'Manrope', sans-serif",
              outline: 'none',
            }}
          />
          <button
            onClick={generateSpeech}
            disabled={isGenerating || !topic.trim()}
            style={{
              padding: '16px 20px',
              borderRadius: 18,
              border: 'none',
              background: isGenerating || !topic.trim() ? 'rgba(124,58,237,0.18)' : 'linear-gradient(135deg, #1b103b, #5b21b6)',
              color: isGenerating || !topic.trim() ? '#8b8378' : '#f8f3eb',
              cursor: isGenerating || !topic.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 12,
              letterSpacing: 2,
            }}
          >
            <Sparkles style={{ width: 15, height: 15, animation: isGenerating ? 'gentle-spin 1.2s linear infinite' : 'none' }} />
            {isGenerating ? 'WRITING...' : 'GENERATE'}
          </button>
        </div>
        {error ? <p style={{ color: palette.danger, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", marginTop: 12 }}>{error}</p> : null}
      </Surface>

      {speech || isGenerating ? (
        <Surface>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 }}>
            <SectionLabel text={`Sample Speech${topic ? ` | ${topic}` : ''}`} />
            {!isGenerating ? (
              <button onClick={generateSpeech} style={{ background: 'none', border: 'none', color: palette.soft, cursor: 'pointer', display: 'flex' }}>
                <RefreshCw style={{ width: 15, height: 15 }} />
              </button>
            ) : null}
          </div>
          {isGenerating ? (
            <div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map((i) => <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: palette.accent, animation: `dot-bounce 0.8s ${i * 0.2}s ease-in-out infinite` }} />)}
            </div>
          ) : (
            <p style={{ color: palette.text, lineHeight: 1.95, whiteSpace: 'pre-wrap', fontSize: 15, maxWidth: 760 }}>{speech}</p>
          )}
        </Surface>
      ) : null}
    </div>
  );
}

export default function Home() {
  const userId = usePersistentUserId();
  const { history, setHistory, selectedSessionId, setSelectedSessionId } = useSpeechHistory(userId);
  const [activeTab, setActiveTab] = useState<Tab>('coach');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const deleteSession = async (sessionId: string) => {
    const confirmed = window.confirm('Delete this saved speech session?');
    if (!confirmed) return;

    try {
      const res = await fetch('/api/evaluations/history', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, sessionId }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error || 'Failed to delete session.');
        return;
      }

      setHistory(data.history || []);
      setSelectedSessionId((current) => (current === sessionId ? null : current));
    } catch {
      alert('Failed to delete session.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', fontFamily: "'Manrope', sans-serif" }}>
      <style>{GLOBAL_CSS}</style>
      <Background />
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: 66,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '0 18px',
          background: 'rgba(10, 10, 12, 0.92)',
          borderBottom: `1px solid ${palette.line}`,
          backdropFilter: 'blur(18px)',
        }}
        className="md:hidden"
      >
        <button onClick={() => setSidebarOpen(true)} style={{ border: `1px solid ${palette.lineStrong}`, background: 'rgba(255,255,255,0.03)', color: palette.text, borderRadius: 12, padding: '8px 10px', cursor: 'pointer', display: 'flex' }}>
          <Menu style={{ width: 18, height: 18 }} />
        </button>
        <span style={{ fontSize: 28, color: palette.text, fontFamily: "'Instrument Serif', serif", lineHeight: 1 }}>
          Aawaz Speaker Coach
        </span>
      </div>
      <main style={{ flex: 1, position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '88px 20px 72px' }}>
          {activeTab === 'coach' ? (
            <CoachTab
              userId={userId}
              setHistory={setHistory}
              setSelectedSessionId={setSelectedSessionId}
            />
          ) : activeTab === 'speech' ? (
            <SpeechTab />
          ) : (
            <HistoryTab
              history={history}
              selectedSessionId={selectedSessionId}
              setSelectedSessionId={setSelectedSessionId}
              onDelete={deleteSession}
            />
          )}
        </div>
      </main>
    </div>
  );
}
