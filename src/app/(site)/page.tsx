import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { JsonLd } from '@/components/site/json-ld';
import { getScoringScheme } from '@/lib/scoring';
import { AUTHOR, SITE_NAME, SITE_URL, isPublished, pageMetadata } from '@/lib/site';
import type { SpeechTemplateId } from '@/lib/speech-config';

import coachReport from '../../../public/coach-report.png';

/*
 * Homepage: the one page built to rank.
 *
 * Every claim here describes the app as it is today. The marking schemes are
 * read from the same tables the coach scores with, so the page cannot drift
 * from the product. Links to the framework pages and the About page appear
 * only once those pages are in PAGES (src/lib/site.ts), so nothing here can
 * point a crawler at a 404.
 */
const TITLE = 'Aawaz Speaker Coach: Free AI Public Speaking Coach';
const DESCRIPTION =
  'Record a speech and get an honest score on structure, pace, pauses and filler words. Built for students practising debates, MUN and school speeches.';

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: '/' });

/* ── Content ─────────────────────────────────────────────────────── */

/** What each part of the report is, in the order the coach writes it. */
const REPORT_PARTS: { label: string; text: string }[] = [
  {
    label: 'Overall score',
    text: 'A mark out of 100, added up from the breakdown rather than produced on its own.',
  },
  {
    label: 'Mark breakdown',
    text: 'One line per criterion in the marking scheme, with marks earned out of marks available and a total that matches the score.',
  },
  {
    label: 'Filler words',
    text: 'Counted from the audio. A filler after a gap is weighted more heavily: it signals searching for the next word rather than a habit.',
  },
  {
    label: 'Speaking speed',
    text: 'Words per minute, and whether you sped up, slowed down or held steady. Most speeches sit best between 130 and 160.',
  },
  {
    label: 'Pauses',
    text: 'Measured from the word timings: whether you left gaps for a point to land, or ran sentences together.',
  },
  {
    label: 'Clarity and structure',
    text: 'A plain judgement on each, tied to the rubric you chose.',
  },
  {
    label: 'Honest feedback',
    text: 'Three to five direct sentences. Each criticism quotes what you said and shows the rewritten line.',
  },
  {
    label: 'Three specific fixes',
    text: 'Each names an established technique, such as the rule of three or a metronome drill, with instructions and repetitions.',
  },
];

/** Display labels are the page's own; the marking schemes come from the coach. */
const FRAMEWORKS: { id: SpeechTemplateId; label: string; summary: string }[] = [
  { id: 'general-public-speaking', label: 'General Public Speaking', summary: 'A structured prepared speech, judged on Ethos, Logos and Pathos.' },
  { id: 'debate', label: 'Debate Speech', summary: 'A competitive argument: stance, support, rebuttal and clash.' },
  { id: 'monroe-motivated-sequence', label: "Monroe's Motivated Sequence", summary: "A persuasive speech built on Monroe's five steps, from attention to action." },
  { id: 'formal-chiefguest', label: 'Formal Chief Guest', summary: 'A ceremonial address that balances warmth with protocol.' },
  { id: 'formal-organiser', label: 'Formal Organising Party', summary: "The organiser's speech: greeting, purpose, acknowledgements and handover." },
];

const STEPS: { title: string; text: string }[] = [
  {
    title: 'Pick a format',
    text: 'Choose the one you will give on the day. The rubric, marking scheme and feedback change with it.',
  },
  {
    title: 'Record',
    text: 'Press record and speak as you would in the room. One to five minutes gives the coach enough to measure pace and pausing.',
  },
  {
    title: 'Fix one thing and record again',
    text: 'Take the first fix, practise it, and record the same speech again. The coach keeps your previous reports, names a mistake that has come back, and says when something has improved.',
  },
];

/*
 * Written by Aawaz, in his own words. Leave these empty until he has: a
 * placeholder is rendered so the section can be designed around real space.
 */
const BUILDER_NOTE: string[] = [];
const BUILDER_CREDENTIALS: string[] = [];

const AUDIENCES: { title: string; text: string }[] = [
  {
    title: 'School debaters',
    text: 'The debate format marks stance, support, rebuttal and clash, and the pace measurement catches a rushed rebuttal the room would have missed.',
  },
  {
    title: 'MUN delegates',
    text: "Position speeches fit the General Public Speaking or Monroe's formats, and the feedback quotes your wording and shows a tighter line.",
  },
  {
    title: 'Assembly and chief guest speakers',
    text: 'Two formal formats judge protocol, register and sequencing, where generic advice stops applying.',
  },
  {
    title: 'College presenters',
    text: 'The structured format marks shape, evidence and delivery, so a presentation can be rehearsed as a speech before anyone hears it.',
  },
];

/** Answers describe the app as it is today, especially about recordings. */
const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: 'Is it free?',
    answer:
      'Yes. You can record and get a full report without an account. After a few reports a free account is needed, and it keeps your history across devices. Daily fair-use limits keep the service free.',
  },
  {
    question: 'Do I need to download anything?',
    answer: 'No. The coach runs in your web browser, so speech practice needs nothing installed. It asks for microphone permission and nothing else.',
  },
  {
    question: 'Does it work on my phone?',
    answer: 'Yes. Open the coach in Chrome or Safari on your phone and record there; the recorder and the report are laid out for a phone screen.',
  },
  {
    question: 'What happens to my recording?',
    answer:
      'The audio is captured in your browser, sent to a speech-to-text service for the transcript, and not kept by the coach. The optional delivery analysis sends the same recording to a second service that listens to how it was said; that is not stored either. The transcript, score and report are saved for comparison with your next attempt, tied to your browser if you have no account. Any report can be deleted from your history, and the Account tab can delete all of your data or the account.',
  },
  {
    question: 'Which speech formats does it score?',
    answer:
      "Five: General Public Speaking, Debate Speech, Monroe's Motivated Sequence, Formal Chief Guest and Formal Organising Party, each with its own rubric and marking scheme.",
  },
];

/* ── Helpers ─────────────────────────────────────────────────────── */

const DELIVERY_CRITERIA = new Set(['Pace & rhythm', 'Pausing', 'Fluency & filler']);

/** The scheme names use a dash, an ampersand and one American spelling; the page does not. */
function criterionName(name: string) {
  return name
    .replace(/\s+—\s+/g, ': ')
    .replace(/\s*&\s*/g, ' and ')
    .replace('Visualization', 'Visualisation');
}

function frameworkPath(id: SpeechTemplateId) {
  return `/frameworks/${id}`;
}

const PRIMARY_BUTTON =
  'inline-flex h-12 cursor-pointer items-center justify-center rounded-full bg-[linear-gradient(135deg,#a78bfa,#f9a8d4)] px-7 font-semibold text-[#06060b] shadow-[0_14px_36px_rgba(167,139,250,0.3)] transition duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a78bfa]';

const TEXT_LINK =
  'inline-flex h-12 cursor-pointer items-center gap-2 rounded-full px-2 font-semibold text-[#ddd6fe] underline decoration-[#a78bfa]/40 underline-offset-4 transition duration-200 hover:text-white hover:decoration-white/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#a78bfa]';

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#857ca2]">{children}</p>;
}

function SectionHeading({ eyebrow, children }: { eyebrow: string; children: React.ReactNode }) {
  return (
    <div>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 max-w-2xl font-serif text-3xl leading-[1.1] tracking-[-0.02em] text-balance text-white sm:text-4xl">
        {children}
      </h2>
    </div>
  );
}

/** One line of a mark sheet: the name, a dotted leader, and the figure. */
function MarkRow({ name, value, strong = false }: { name: string; value: string; strong?: boolean }) {
  return (
    <li className="flex items-baseline gap-3 py-2.5">
      <span className={strong ? 'font-semibold text-white' : 'text-[#e6e1f7]'}>{name}</span>
      <span aria-hidden className="mb-[0.3em] min-w-6 flex-1 border-b border-dotted border-white/25" />
      <span className={`font-mono text-sm tabular-nums ${strong ? 'text-white' : 'text-[#ddd6fe]'}`}>{value}</span>
    </li>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function HomePage() {
  const generalScheme = getScoringScheme('general-public-speaking');
  const frameworksLive = isPublished('/frameworks');
  const aboutLive = isPublished('/about');

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          // The in-app companion is called Aawax, so some people search that spelling.
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
          url: `${SITE_URL}/coach`,
          description: DESCRIPTION,
          featureList: [
            'Score out of 100 with a mark breakdown',
            'Filler word count measured from the audio',
            'Speaking speed in words per minute',
            'Pause measurement from word timings',
            'Feedback that quotes the speaker and shows the rewrite',
            'Three fixes naming established techniques',
            'Five speech formats, each with its own marking scheme',
          ],
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
          creator: {
            '@type': 'Person',
            name: AUTHOR.name,
            ...(aboutLive ? { url: AUTHOR.url } : {}),
          },
          // No aggregateRating: never add ratings that real users haven't given.
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

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section
        id="top"
        className="relative isolate grid gap-12 pb-16 pt-8 sm:pt-14 lg:grid-cols-[minmax(0,10fr)_minmax(0,11fr)] lg:items-start lg:gap-14 lg:pb-24"
      >
        {/* One ambient glow behind the hero, the same violet the coach uses.
            Isolated inside the section so it sits above the page backdrop. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-28 -z-10 h-[640px] bg-[radial-gradient(ellipse_70%_55%_at_50%_0%,rgba(167,139,250,0.18),transparent_70%)]"
        />

        <div className="lg:pt-6">
          <Eyebrow>Free AI public speaking coach</Eyebrow>
          <h1 className="mt-4 font-serif text-[2.75rem] leading-[1.04] tracking-[-0.035em] text-balance text-white sm:text-6xl lg:text-[3.6rem]">
            Practise your speech. Get an honest score in minutes.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-pretty text-[#cfc8e8]">
            Record yourself in the browser and the AI coach marks it out of 100 for structure, speaking speed,
            pauses, filler words and clarity, against the format you are going to give.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/coach" className={PRIMARY_BUTTON}>
              Start practising free
            </Link>
            {frameworksLive ? (
              <Link href="/frameworks" className={TEXT_LINK}>
                See the speech frameworks
                <ArrowIcon />
              </Link>
            ) : null}
          </div>
        </div>

        <figure className="min-w-0">
          <div className="rounded-[28px] border border-white/10 bg-[#0b0b12] p-2 shadow-[0_30px_80px_rgba(2,6,23,0.7),inset_0_1px_0_rgba(255,255,255,0.06)]">
            <Image
              src={coachReport}
              alt="The coach's report for a practice speech: a score of 68 out of 100 beside a short summary, then an analysis grid covering filler words, speaking speed, speed control, pauses, hesitation, clarity and structure."
              priority
              placeholder="blur"
              sizes="(min-width: 1024px) 520px, (min-width: 768px) 720px, 100vw"
              className="h-auto w-full rounded-[20px]"
            />
          </div>
          <figcaption className="mt-4 text-sm leading-6 text-pretty text-[#a79dc8]">
            A finished report, marked 68 out of 100. The mark breakdown, feedback and fixes follow the analysis
            shown here.
          </figcaption>
        </figure>
      </section>

      {/* ── The report ───────────────────────────────────────────── */}
      <section id="report" className="border-t border-white/10 py-16 sm:py-24">
        <SectionHeading eyebrow="The report">What one recording gives you</SectionHeading>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-[#cfc8e8]">
          Every recording returns the same report in the same order, so two attempts at one speech compare line by
          line. It is a marked script, not encouragement.
        </p>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-14">
          <dl className="divide-y divide-white/10 border-y border-white/10">
            {REPORT_PARTS.map((part) => (
              <div key={part.label} className="grid gap-1.5 py-5 sm:grid-cols-[190px_1fr] sm:gap-6">
                <dt className="font-mono text-[12px] uppercase tracking-[0.16em] text-[#ddd6fe] sm:pt-1">{part.label}</dt>
                <dd className="max-w-xl leading-7 text-pretty text-[#cfc8e8]">{part.text}</dd>
              </div>
            ))}
          </dl>

          <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:p-7 lg:sticky lg:top-6">
            <Eyebrow>Marking scheme</Eyebrow>
            <p className="mt-1 font-serif text-2xl text-white">General Public Speaking</p>
            <ol className="mt-4 divide-y divide-white/[0.07]">
              {generalScheme.criteria.map((criterion) => (
                <MarkRow key={criterion.name} name={criterionName(criterion.name)} value={String(criterion.weight)} />
              ))}
            </ol>
            <ul className="mt-2 border-t border-white/20">
              <MarkRow name="Total" value="100" strong />
            </ul>
            <p className="mt-4 text-sm leading-6 text-pretty text-[#a79dc8]">
              Pace, pausing and filler are measured from the word timings, so those marks mean the same in every
              format; the others change with the format.
            </p>
          </div>
        </div>

        <p className="mt-10 max-w-2xl leading-7 text-pretty text-[#cfc8e8]">
          If you ask for the deeper delivery read, a second report covers tone, emotion, conviction and emphasis
          heard in the audio, with drills to match.
        </p>
      </section>

      {/* ── Formats ──────────────────────────────────────────────── */}
      <section id="formats" className="border-t border-white/10 py-16 sm:py-24">
        <SectionHeading eyebrow="Five formats">Scored against a real structure</SectionHeading>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-[#cfc8e8]">
          Choose the format before you record. The coach marks against that format&apos;s rubric and weighting, so
          a debate speech is judged on its rebuttal and a chief guest speech on its protocol.
        </p>

        <ul className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {FRAMEWORKS.map(({ id, label, summary }) => {
            const scheme = getScoringScheme(id);
            const content = scheme.criteria.filter((criterion) => !DELIVERY_CRITERIA.has(criterion.name));
            const deliveryMarks = scheme.criteria
              .filter((criterion) => DELIVERY_CRITERIA.has(criterion.name))
              .reduce((sum, criterion) => sum + criterion.weight, 0);
            const live = isPublished(frameworkPath(id));

            const body = (
              <div className="flex flex-col gap-3 py-6 sm:flex-row sm:gap-8">
                <div className="shrink-0 sm:w-60">
                  <h3 className="font-serif text-2xl leading-tight text-balance text-white">{label}</h3>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="max-w-xl leading-7 text-pretty text-[#cfc8e8]">{summary}</p>
                  <ul className="mt-3 flex max-w-xl flex-wrap gap-x-5 gap-y-1 font-mono text-[12px] leading-6 tracking-[0.03em] text-[#a79dc8]">
                    {content.map((criterion) => (
                      <li key={criterion.name} className="whitespace-nowrap">
                        {criterionName(criterion.name)} <span className="text-[#ddd6fe]">{criterion.weight}</span>
                      </li>
                    ))}
                    <li className="whitespace-nowrap">
                      Delivery <span className="text-[#ddd6fe]">{deliveryMarks}</span>
                    </li>
                  </ul>
                </div>
                {live ? (
                  <span className="hidden shrink-0 self-center text-[#857ca2] transition group-hover:text-white sm:block">
                    <ArrowIcon />
                  </span>
                ) : null}
              </div>
            );

            return (
              <li key={id}>
                {live ? (
                  <Link
                    href={frameworkPath(id)}
                    className="group block cursor-pointer transition duration-200 hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a78bfa]"
                  >
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── How it works ─────────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-white/10 py-16 sm:py-24">
        <SectionHeading eyebrow="Three steps">How it works</SectionHeading>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t border-white/15 pt-5">
              <span className="font-serif text-4xl leading-none text-[#a78bfa]">{index + 1}</span>
              <h3 className="mt-4 text-lg font-semibold text-balance text-white">{step.title}</h3>
              <p className="mt-2 leading-7 text-pretty text-[#cfc8e8]">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Author ───────────────────────────────────────────────── */}
      <section id="author" className="border-t border-white/10 py-16 sm:py-24">
        <SectionHeading eyebrow="Author">Who built it</SectionHeading>
        <div className="mt-6 max-w-2xl">
          {BUILDER_NOTE.length ? (
            BUILDER_NOTE.map((paragraph) => (
              <p key={paragraph} className="mt-4 text-lg leading-8 text-pretty text-[#cfc8e8] first:mt-0">
                {paragraph}
              </p>
            ))
          ) : (
            <p className="rounded-[20px] border border-dashed border-[#a78bfa]/40 px-5 py-4 text-lg leading-8 text-[#a79dc8]">
              Three or four sentences from Aawaz, in his own words, go here.
            </p>
          )}
          {BUILDER_CREDENTIALS.length ? (
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[#ddd6fe]">
              {BUILDER_CREDENTIALS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[12px] uppercase tracking-[0.14em] text-[#857ca2]">
              <li>Credential one</li>
              <li>Credential two</li>
              <li>Credential three</li>
            </ul>
          )}
          {aboutLive ? (
            <Link href="/about" className={`${TEXT_LINK} mt-6 -ml-2`}>
              About {AUTHOR.name}
              <ArrowIcon />
            </Link>
          ) : null}
        </div>
      </section>

      {/* ── Audience ─────────────────────────────────────────────── */}
      <section id="audience" className="border-t border-white/10 py-16 sm:py-24">
        <SectionHeading eyebrow="Audience">Who it&apos;s for</SectionHeading>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-pretty text-[#cfc8e8]">
          Online public speaking practice for the speeches students are asked to give.
        </p>
        <ul className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {AUDIENCES.map((audience) => (
            <li key={audience.title} className="border-t border-white/15 pt-5">
              <h3 className="text-lg font-semibold text-balance text-white">{audience.title}</h3>
              <p className="mt-2 max-w-md leading-7 text-pretty text-[#cfc8e8]">{audience.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Questions ────────────────────────────────────────────── */}
      <section id="questions" className="border-t border-white/10 py-16 sm:py-24">
        <SectionHeading eyebrow="FAQ">Questions</SectionHeading>
        <div className="mt-10 divide-y divide-white/10 border-y border-white/10">
          {QUESTIONS.map(({ question, answer }) => (
            <div key={question} className="grid gap-2 py-6 lg:grid-cols-[300px_1fr] lg:gap-10">
              <h3 className="text-lg font-semibold text-balance text-white">{question}</h3>
              <p className="max-w-2xl leading-7 text-pretty text-[#cfc8e8]">{answer}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing ──────────────────────────────────────────────── */}
      <section className="pt-4 sm:pt-8">
        <div className="rounded-[28px] border border-[#a78bfa]/25 bg-[linear-gradient(135deg,rgba(167,139,250,0.10),rgba(249,168,212,0.06))] p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div>
            <p className="max-w-xl font-serif text-3xl leading-[1.1] tracking-[-0.02em] text-balance text-white sm:text-4xl">
              Record one speech and see where the marks go.
            </p>
            <p className="mt-3 max-w-xl leading-7 text-pretty text-[#cfc8e8]">
              The first report takes a few minutes and needs no account.
            </p>
          </div>
          <Link href="/coach" className={`${PRIMARY_BUTTON} mt-7 shrink-0 lg:mt-0`}>
            Start practising free
          </Link>
        </div>
      </section>
    </>
  );
}
