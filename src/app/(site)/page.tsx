import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { GlassSurface } from '@/components/site/glass-surface';
import stageImage from '../../../public/images/rehearsal-stage.webp';
import notesImage from '../../../public/images/rehearsal-notes.webp';
import { ArrowRight, ArrowUpRight, Award, Gauge, Globe, ListChecks, MessageSquare, Plus, Presentation, RefreshCw } from 'lucide-react';

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

function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`site-container ${className}`}>{children}</div>;
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

      <section className="home-hero" aria-labelledby="hero-title">
        <div className="hero-art" aria-hidden="true">
          <Image src={stageImage} alt="" fill sizes="100vw" preload placeholder="blur" />
        </div>
        <Container className="hero-layout">
          <div className="hero-copy">
            <h1 id="hero-title" className="site-headline hero-title">
              Practise your <span>speech.</span>
            </h1>
            <p className="hero-description">
              Your free AI public speaking coach. Get an honest score in minutes,
              with feedback on structure, pace, pauses and filler words.
            </p>
            <div className="hero-actions">
              <Link href="/coach" className="site-button glass-control"><GlassSurface />
                Start practising free <ArrowUpRight size={19} aria-hidden="true" />
              </Link>
              <Link href="#report" className="site-text-link glass-control"><GlassSurface />
                See the feedback <ArrowRight size={17} aria-hidden="true" />
              </Link>
            </div>
            <p className="hero-note">No account needed. Just a speech to practise.</p>
          </div>
          <div className="hero-demo">
            <MarkingDemo />
          </div>
        </Container>
      </section>

      <section id="report" className="home-report home-light" aria-labelledby="report-title">
        <Container className="report-layout">
          <div className="report-intro">
            <h2 id="report-title" className="site-headline section-title">
              Every recording<br className="desktop-break" /> comes back <span>marked.</span>
            </h2>
            <p className="section-description">
              The same report in the same order every time, so two attempts at one speech can be read side by side.
            </p>
          </div>
          <div className="report-preview"><PhoneScroll /></div>
          <ol className="report-steps">
            {WHAT_HAPPENS.map((item) => (
              <li key={item.title} className="report-step">
                <div className="report-step-heading">
                  <span className="report-step-icon" aria-hidden="true">{item.icon}</span>
                  <h3>{item.title}</h3>
                </div>
                <p>{item.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section id="audience" className="home-audience home-dark" aria-labelledby="audience-title">
        <Container className="audience-layout">
          <div className="audience-intro">
            <h2 id="audience-title" className="site-headline section-title">
              Built for the speeches students in Nepal are <span>actually asked to give.</span>
            </h2>
            <Link href="#formats" className="site-text-link glass-control"><GlassSurface />
              Find your speech format <ArrowRight size={18} aria-hidden="true" />
            </Link>
            <figure className="practice-image">
              <Image src={notesImage} alt="Speech cue cards, a pencil and a microphone ready for rehearsal." sizes="(max-width: 760px) 90vw, 42vw" placeholder="blur" />
            </figure>
          </div>
          <ul className="audience-list">
            {AUDIENCES.map((audience) => (
              <li key={audience.title} className="audience-item">
                <span className="audience-icon" aria-hidden="true">{audience.icon}</span>
                <div>
                  <h3 className="site-headline">{audience.title}</h3>
                  <p>{audience.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section id="formats" className="home-formats home-light" aria-labelledby="formats-title">
        <Container>
          <div className="formats-intro">
            <h2 id="formats-title" className="site-headline section-title">
              Scored against a <span>real structure.</span>
            </h2>
            <p className="section-description">
              A debate speech is judged on its rebuttal and a chief guest speech on its protocol.
            </p>
          </div>
          <div className="format-list">
            {FORMATS.map(({ id, label, summary }, index) => (
              <details key={id} name="speech-formats" className="format-option" open={index === 0}>
                <summary>
                  <h3 className="site-headline">{label}</h3>
                  <span className="disclosure-icon glass-control"><GlassSurface /><Plus size={22} aria-hidden="true" /></span>
                </summary>
                <div className="format-content">
                  <p>{summary}</p>
                  <div className="format-actions">
                    <Link href={`/coach?template=${id}`} className="site-text-link glass-control"><GlassSurface />
                      Practise this format <ArrowUpRight size={18} aria-hidden="true" />
                    </Link>
                    {isPublished(`/frameworks/${id}`) && (
                      <Link href={`/frameworks/${id}`} className="site-text-link glass-control"><GlassSurface />Read the framework <ArrowRight size={17} aria-hidden="true" /></Link>
                    )}
                  </div>
                </div>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section id="questions" className="home-questions home-dark" aria-labelledby="questions-title">
        <Container className="questions-layout">
          <div>
            <h2 id="questions-title" className="site-headline section-title">
              Questions about <span>practising online.</span>
            </h2>
            <p className="section-description">
              What the coach does with your recording, what it costs and what it can mark.
            </p>
          </div>
          <div className="question-list">
            {QUESTIONS.map(({ question, answer }, index) => (
              <details key={question} className="question" name="homepage-questions" open={index === 0}>
                <summary>
                  <h3>{question}</h3>
                  <span className="question-toggle glass-control"><GlassSurface /><Plus size={19} className="question-plus" aria-hidden="true" /></span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <section className="home-close home-light" aria-labelledby="close-title">
        <Container className="close-layout">
          <h2 id="close-title" className="site-headline">
            Record one speech.<br /><span>See where the marks go.</span>
          </h2>
          <div className="close-action">
            <p>The first report takes a few minutes and needs no account.</p>
            <Link href="/coach" className="site-button site-button-dark glass-control"><GlassSurface />
              Start practising free <ArrowUpRight size={19} aria-hidden="true" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
