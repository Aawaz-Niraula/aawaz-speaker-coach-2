import type { Metadata } from 'next';
import Link from 'next/link';
import { Award, Gauge, Globe, ListChecks, MessageSquare, Presentation, RefreshCw } from 'lucide-react';

import { JsonLd } from '@/components/site/json-ld';
import { MarkingDemo } from '@/components/site/marking-demo';
import { PhoneScroll } from '@/components/site/phone-scroll';
import { AUTHOR, SITE_NAME, SITE_URL, isPublished, pageMetadata } from '@/lib/site';
import type { SpeechTemplateId } from '@/lib/speech-config';

/*
 * Homepage.
 *
 * It owns the commercial cluster and nothing else: the per format rubrics and
 * weightings live on the framework pages, which own the informational queries,
 * so the two never compete for one term.
 *
 * Three rules hold the copy down. No label above a heading, no hyphens, and no
 * runs of clipped sentences. Every section carries one heading and the fewest
 * words that still say something true.
 */
const TITLE = 'Aawaz Speaker Coach: Free AI Public Speaking Coach';
const DESCRIPTION =
  'Record a speech and get an honest score on structure, pace, pauses and filler words. Built for students practising debates, MUN and school speeches.';

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: '/' });

/* ── Content ─────────────────────────────────────────────────────── */

const WHAT_HAPPENS: { title: string; text: string; icon: React.ReactNode }[] = [
  {
    title: 'Choose the format',
    icon: <ListChecks className="h-5 w-5" />,
    text: 'The coach marks against that format’s own rubric rather than one generic checklist.',
  },
  {
    title: 'Record and get marked',
    icon: <Gauge className="h-5 w-5" />,
    text: 'A score out of 100 built criterion by criterion, with your filler words, speed and pauses measured from the audio.',
  },
  {
    title: 'Fix one thing and go again',
    icon: <RefreshCw className="h-5 w-5" />,
    text: 'Your previous reports are kept, so the coach says when a mistake has come back and when one is gone.',
  },
];

const FORMATS: { id: SpeechTemplateId; label: string; summary: string }[] = [
  { id: 'general-public-speaking', label: 'General Public Speaking', summary: 'A prepared speech judged on Ethos, Logos and Pathos.' },
  { id: 'debate', label: 'Debate Speech', summary: 'A competitive argument marked on stance, support, rebuttal and clash.' },
  { id: 'monroe-motivated-sequence', label: "Monroe's Motivated Sequence", summary: 'A persuasive speech running the five steps from attention through to action.' },
  { id: 'formal-chiefguest', label: 'Formal Chief Guest', summary: 'A ceremonial address balancing warmth with protocol.' },
  { id: 'formal-organiser', label: 'Formal Organising Party', summary: 'The organiser speech covering greeting, purpose, acknowledgements and handover.' },
];

/*
 * Written by Aawaz, in his own words. While these are empty the section is
 * skipped rather than rendered with placeholder text.
 */
const AUTHOR_NOTE: string[] = [];
const AUTHOR_CREDENTIALS: string[] = [];

const AUDIENCES: { title: string; text: string; icon: React.ReactNode }[] = [
  {
    title: 'School debaters',
    icon: <MessageSquare className="h-5 w-5" />,
    text: 'Stance, support, rebuttal and clash are all marked, and the pace measurement catches a rushed rebuttal the room would have missed.',
  },
  {
    title: 'MUN delegates',
    icon: <Globe className="h-5 w-5" />,
    text: 'Position speeches fit the general or Monroe formats, and the feedback quotes your wording and shows a tighter line.',
  },
  {
    title: 'Assembly and chief guest speakers',
    icon: <Award className="h-5 w-5" />,
    text: 'Two ceremonial formats judge protocol, register and sequencing, where general advice stops applying.',
  },
  {
    title: 'College presenters',
    icon: <Presentation className="h-5 w-5" />,
    text: 'Shape, evidence and delivery are all marked, so a presentation can be rehearsed before anyone hears it.',
  },
];

const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: 'Is it free?',
    answer:
      'Yes. You can record and get a full report without an account, and a free account after that keeps your history across devices. Daily limits are what let the service stay free.',
  },
  {
    question: 'Do I need to download anything?',
    answer: 'No, the coach runs in your browser and asks for microphone permission and nothing else.',
  },
  {
    question: 'Does it work on my phone?',
    answer: 'Yes, and the recorder and the report are both laid out for a phone screen.',
  },
  {
    question: 'What happens to my recording?',
    answer:
      'Your audio goes to a transcription service and is never kept by the coach. What is saved is the transcript, the score and the report, so your next attempt can be compared with it, and you can delete any report or all of your data from the Account tab.',
  },
  {
    question: 'Does it work for Nepali school and college speeches?',
    answer:
      'Yes. The two ceremonial formats follow the protocol used at Nepali school functions, and the debate and Monroe formats match the school and college circuit. Everything is marked in English.',
  },
  {
    question: 'Which speech formats does it score?',
    answer:
      'Five, each with its own rubric and marking scheme: General Public Speaking, Debate Speech, Monroe’s Motivated Sequence, Formal Chief Guest and Formal Organising Party.',
  },
];

/* ── Helpers ─────────────────────────────────────────────────────── */

const CTA =
  'liquid-glass inline-flex h-12 cursor-pointer items-center justify-center rounded-full px-7 font-semibold text-[#06060b] transition duration-200 hover:brightness-[1.06] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a78bfa]';

function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-5 ${className}`}>{children}</div>;
}

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function HomePage() {
  const aboutLive = isPublished('/about');

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          alternateName: ['Aawax Speaker Coach', 'Speaker Coach'],
          url: SITE_URL,
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: SITE_NAME,
          applicationCategory: 'EducationalApplication',
          operatingSystem: 'Web browser',
          url: SITE_URL,
          installUrl: `${SITE_URL}/coach`,
          inLanguage: 'en-GB',
          isAccessibleForFree: true,
          description: DESCRIPTION,
          featureList: [
            'Score out of 100 with a mark breakdown',
            'Filler word count measured from the audio',
            'Speaking speed in words per minute',
            'Pause measurement from word timings',
            'Feedback that quotes the speaker and shows the rewrite',
            'Five speech formats, each with its own marking scheme',
          ],
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          areaServed: { '@type': 'Country', name: 'Nepal' },
          audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
          creator: { '@type': 'Person', name: AUTHOR.name, ...(aboutLive ? { url: AUTHOR.url } : {}) },
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: QUESTIONS.map(({ question, answer }) => ({
            '@type': 'Question',
            name: question,
            acceptedAnswer: { '@type': 'Answer', text: answer },
          })),
        }}
      />

      {/* ═══ Hero ══════════════════════════════════════════════════
          One object, not two competing ones. The headline and the live
          marking share a single card built like the report the coach hands
          back, so the eye lands on the card and then reads across it. */}
      <section className="relative isolate pb-16 pt-4 sm:pt-8 lg:pb-24">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[760px] bg-[radial-gradient(ellipse_46%_52%_at_50%_0%,rgba(146,110,240,0.26),transparent_70%)]"
        />
        <Container>
          <div className="overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(155deg,rgba(38,30,68,0.78)_0%,rgba(13,12,22,0.86)_46%,rgba(8,8,14,0.9)_100%)] shadow-[0_30px_90px_rgba(2,6,23,0.7),inset_0_1px_0_rgba(255,255,255,0.09)] sm:rounded-[28px] sm:shadow-[0_50px_130px_rgba(2,6,23,0.8),inset_0_1px_0_rgba(255,255,255,0.09)]">
            <div className="grid gap-9 p-6 sm:gap-10 sm:p-9 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.84fr)] lg:items-start lg:gap-14 lg:p-12">
              <div>
                <h1 className="max-w-[16ch] font-serif text-[2.7rem] leading-[1.03] tracking-[-0.04em] text-pretty text-white sm:text-[3.5rem] lg:text-[3.8rem]">
                  Practise your speech. Get an honest score in minutes.
                </h1>
                <p className="mt-6 max-w-md text-lg leading-8 text-pretty text-[#cfc8e8]">
                  A free AI public speaking coach that marks your speech against the format you are giving,
                  then shows you the lines to change.
                </p>
                <Link href="/coach" className={`${CTA} mt-8`}>
                  Start practising free
                </Link>
              </div>

              <div className="min-w-0">
                <MarkingDemo />
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ The report ════════════════════════════════════════════
          The phone carries the proof, so the words beside it can stay
          short. Three cards, layered the way the app layers its own. */}
      <section id="report" className="relative overflow-hidden bg-[linear-gradient(180deg,#08080f,#0b0a14_55%,#08080f)] py-20 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-1/4 h-[620px] w-[720px] bg-[radial-gradient(ellipse_at_center,rgba(146,110,240,0.2),transparent_68%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-52 bottom-0 h-[520px] w-[640px] bg-[radial-gradient(ellipse_at_center,rgba(224,85,155,0.12),transparent_70%)]"
        />
        <Container className="relative">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
            <PhoneScroll />

            <div>
              <h2 className="font-serif text-3xl leading-[1.08] tracking-[-0.02em] text-balance text-white sm:text-[2.7rem]">
                Every recording comes back{' '}
                <span className="bg-[linear-gradient(100deg,#c4b0ff,#f9a8d4)] grad-text">
                  marked
                </span>
              </h2>
              <p className="mt-5 max-w-lg text-lg leading-8 text-pretty text-[#cfc8e8]">
                The same report in the same order every time, so two attempts at one speech can be read side by
                side.
              </p>

              <ul className="mt-10 grid gap-3">
                {WHAT_HAPPENS.map((item) => (
                  <li
                    key={item.title}
                    className="rounded-[24px] border border-white/[0.09] bg-[linear-gradient(135deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#a78bfa]/15 text-[#a78bfa]">
                        {item.icon}
                      </span>
                      <h3 className="font-semibold text-white">{item.title}</h3>
                    </div>
                    <p className="mt-2.5 max-w-[62ch] leading-7 text-pretty text-[#a79dc8]">{item.text}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ Who it's for ══════════════════════════════════════════
          The first light band. Dark, light, dark gives the scroll a rhythm
          that variations on one dark section never could. */}
      <section id="audience" className="bg-[linear-gradient(180deg,#f8f6fd,#efebf9)] py-20 text-[#574d75] sm:py-24">
        <Container>
          <h2 className="max-w-3xl font-serif text-3xl leading-[1.1] tracking-[-0.02em] text-balance text-[#1a1430] sm:text-[2.7rem]">
            Built for the speeches students in Nepal are{' '}
            <span className="bg-[linear-gradient(100deg,#7c5cde,#cf3f88)] grad-text">
              actually asked to give
            </span>
          </h2>

          <ul className="mt-12 grid items-start gap-4 sm:grid-cols-2">
            {AUDIENCES.map((audience) => (
              <li
                key={audience.title}
                className="rounded-[24px] border border-[#7c5cde]/12 bg-[linear-gradient(160deg,#ffffff,#fdfbff)] p-6 shadow-[0_1px_2px_rgba(88,60,180,0.06),0_14px_36px_rgba(88,60,180,0.10)] sm:p-7"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-[linear-gradient(135deg,rgba(124,92,222,0.16),rgba(249,168,212,0.14))] text-[#6b46c8]">
                  {audience.icon}
                </span>
                <h3 className="mt-5 text-lg font-semibold text-balance text-[#1a1430]">{audience.title}</h3>
                <p className="mt-2 leading-7 text-pretty text-[#574d75]">{audience.text}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* ═══ Formats ═══════════════════════════════════════════════
          Second light band, same ground, a different shape: a five row
          table against the grid above it. */}
      <section id="formats" className="border-t border-[#7c5cde]/10 bg-[linear-gradient(180deg,#e9e5f6,#f2eff9)] py-20 text-[#574d75] sm:py-24">
        <Container>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="max-w-xl font-serif text-3xl leading-[1.1] tracking-[-0.02em] text-balance text-[#1a1430] sm:text-[2.7rem]">
              Scored against a{' '}
              <span className="bg-[linear-gradient(100deg,#7c5cde,#cf3f88)] grad-text">
                real structure
              </span>
            </h2>
            <p className="max-w-xs leading-7 text-pretty text-[#574d75]">
              A debate speech is judged on its rebuttal and a chief guest speech on its protocol.
            </p>
          </div>

          <ul className="mt-12 grid gap-px overflow-hidden rounded-[24px] border border-[#7c5cde]/12 bg-[#7c5cde]/14 shadow-[0_1px_2px_rgba(88,60,180,0.05),0_18px_44px_rgba(88,60,180,0.11)]">
            {FORMATS.map(({ id, label, summary }) => {
              const live = isPublished(`/frameworks/${id}`);
              const row = (
                <div className="flex flex-col gap-1.5 bg-white px-6 py-6 transition-colors duration-200 group-hover:bg-[#faf8ff] sm:flex-row sm:items-start sm:gap-8 sm:px-8">
                  <h3 className="min-w-0 shrink-0 font-serif text-xl text-[#1a1430] sm:w-80 sm:text-2xl">{label}</h3>
                  <p className="min-w-0 flex-1 leading-7 text-pretty text-[#574d75] sm:max-w-xl">{summary}</p>
                  {live ? (
                    <span className="hidden shrink-0 self-center text-[#8478a8] transition-colors group-hover:text-[#1a1430] sm:block">
                      <Arrow />
                    </span>
                  ) : null}
                </div>
              );

              return (
                <li key={id}>
                  {live ? (
                    <Link
                      href={`/frameworks/${id}`}
                      className="group block cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7c5cde]"
                    >
                      {row}
                    </Link>
                  ) : (
                    <div>{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* ═══ Author ════════════════════════════════════════════════ */}
      {AUTHOR_NOTE.length ? (
        <section id="author" className="bg-[#08080f] py-20 sm:py-24">
          <Container>
            <h2 className="font-serif text-3xl leading-[1.1] tracking-[-0.02em] text-white sm:text-4xl">Who built it</h2>
            <div className="mt-6 max-w-2xl">
              {AUTHOR_NOTE.map((paragraph) => (
                <p key={paragraph} className="mt-4 text-lg leading-8 text-pretty text-[#cfc8e8] first:mt-0">
                  {paragraph}
                </p>
              ))}
              {AUTHOR_CREDENTIALS.length ? (
                <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-[0.14em] text-[#ddd6fe]">
                  {AUTHOR_CREDENTIALS.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* ═══ Questions ═════════════════════════════════════════════ */}
      <section id="questions" className="relative overflow-hidden bg-[linear-gradient(180deg,#08080f,#0a0a13)] py-20 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-44 top-0 h-[540px] w-[680px] bg-[radial-gradient(ellipse_at_center,rgba(124,92,222,0.16),transparent_70%)]"
        />
        <Container className="relative">
          <h2 className="font-serif text-3xl leading-[1.1] tracking-[-0.02em] text-balance text-white sm:text-[2.7rem]">
            Questions about{' '}
            <span className="bg-[linear-gradient(100deg,#c4b0ff,#f9a8d4)] grad-text">
              practising online
            </span>
          </h2>
          <p className="mt-4 max-w-lg text-lg leading-8 text-pretty text-[#cfc8e8]">
            What the coach does with your recording, what it costs and what it can mark.
          </p>
          <div className="mt-10 grid gap-px overflow-hidden rounded-[24px] border border-white/10 bg-white/[0.08]">
            {QUESTIONS.map(({ question, answer }) => (
              <div key={question} className="grid gap-2 bg-[#0a0a12] p-6 lg:grid-cols-[300px_1fr] lg:gap-12 lg:p-7">
                <h3 className="font-semibold text-balance text-white">{question}</h3>
                <p className="max-w-[58ch] leading-7 text-pretty text-[#a79dc8]">{answer}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ Close ═════════════════════════════════════════════════ */}
      <section className="bg-[#0a0a13] pb-16 pt-10 sm:pt-16">
        <Container>
          <div className="relative overflow-hidden rounded-[28px] border border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(124,92,222,0.24),rgba(249,168,212,0.12))] p-10 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.09)] sm:p-16">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 -top-24 h-64 bg-[radial-gradient(ellipse_45%_60%_at_50%_0%,rgba(249,168,212,0.28),transparent_70%)]"
            />
            <h2 className="relative mx-auto max-w-xl font-serif text-3xl leading-[1.08] tracking-[-0.02em] text-balance text-white sm:text-[2.7rem]">
              Record one speech and see{' '}
              <span className="bg-[linear-gradient(100deg,#e9dcff,#ffd3e8)] grad-text">
                where the marks go
              </span>
            </h2>
            <p className="relative mx-auto mt-4 max-w-xs text-lg text-pretty text-[#e7e2f8]">
              The first report takes a few minutes and needs no account.
            </p>
            <Link href="/coach" className={`${CTA} relative mt-8`}>
              Start practising free
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
