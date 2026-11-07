'use client';

import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

/*
 * Privacy & terms, shown inside the coach only (never on the marketing site).
 *
 * Every statement here describes what the code actually does. When a data
 * flow changes (a new provider, a new saved field, a different retention
 * rule), update this text in the same change and bump LAST_UPDATED.
 *
 * Deliberately left out: model names, usage limits, rate limits and how the
 * security works. Users need to know what is collected, where it goes and
 * what they control, not the internals.
 */
export const PRIVACY_LAST_UPDATED = '8 November 2026';
export const PRIVACY_CONTACT = 'aawaz2k9@gmail.com';

type Provider = { name: string; role: string; gets: string; policy: string };

const PROVIDERS: Provider[] = [
  {
    name: 'Vercel',
    role: 'Runs the app.',
    gets: 'Every request passes through it, along with short technical logs (time, page, errors, IP address).',
    policy: 'https://vercel.com/legal/privacy-notice',
  },
  {
    name: 'Turso',
    role: 'Database.',
    gets: 'Your saved reports, scripts, account details and usage counters.',
    policy: 'https://turso.tech/privacy-policy',
  },
  {
    name: 'DeepInfra',
    role: 'AI for transcripts, feedback, insights, scripts and Aawax chat.',
    gets: 'Your recording, transcript, script topics, chat messages, and short summaries of your past reports.',
    policy: 'https://deepinfra.com/privacy',
  },
  {
    name: 'Google (Gemini)',
    role: 'Only when you ask for a deeper delivery report.',
    gets: 'That recording.',
    policy: 'https://aistudio.google.com/docs/terms',
  },
  {
    name: 'ElevenLabs',
    role: 'Only when you play an example voice.',
    gets: 'The script text to be read out.',
    policy: 'https://elevenlabs.io/privacy-policy',
  },
  {
    name: 'Google sign-in',
    role: 'Only if you choose to sign in with Google.',
    gets: 'Confirms who you are and shares your name, email and profile picture with us.',
    policy: 'https://policies.google.com/privacy',
  },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/8 pt-4">
      <h3 className="font-serif text-lg tracking-tight text-white">{title}</h3>
      <div className="mt-2 space-y-2 text-sm leading-6 text-[#c9c2e6]">{children}</div>
    </section>
  );
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 marker:text-[#857ca2]">
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}

const em = 'text-[#f2efff]';

export function PrivacyTermsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Focus goes back to whatever opened the notice when it closes.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    // Captured and stopped here: the tour and guided rehearsal also close on
    // Escape, and one key press should only close the notice on top.
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (opener?.isConnected) opener.focus();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[72] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-label="Close privacy and terms"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-terms-title"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed left-1/2 top-1/2 z-[73] flex max-h-[88dvh] w-[calc(100vw-32px)] max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[26px] border border-white/10 bg-[#0d0c16]/97 shadow-[0_30px_80px_rgba(2,6,23,0.75)] backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
              <div>
                <h2 id="privacy-terms-title" className="font-serif text-2xl tracking-tight text-white">Privacy &amp; terms</h2>
                <p className="mt-0.5 text-xs text-[#857ca2]">Last updated {PRIVACY_LAST_UPDATED}</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#a79dc8] transition hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="aawax-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
              <div className="rounded-[18px] border border-[#a78bfa]/25 bg-[#a78bfa]/8 p-4 text-sm leading-6 text-[#ddd6fe]">
                <p className="font-semibold text-white">The short version</p>
                <List items={[
                  'Your recordings go to AI services to be transcribed and marked. We don’t keep the audio.',
                  'Your transcripts, feedback, scores and scripts are saved so you can see your progress. You can delete them any time.',
                  'No ads, no tracking, and we never sell your data.',
                  'AI feedback can be wrong. Use it as practice help, not a final judgement.',
                  'The formats are proven methods, but improvement takes regular practice and isn’t instant.',
                  'Only record yourself, or people who said yes.',
                ]} />
              </div>

              <Section title="Who runs this">
                <p>
                  Aawaz Speaker Coach is a free, independent project run by Aawaz Niraula. In this notice,
                  “we” and “us” mean the people running it, and “you” means anyone using the coach. By using
                  the coach you agree to this notice. If you don’t agree, please don’t use it.
                </p>
              </Section>

              <Section title="What we collect">
                <List items={[
                  <><span className={em}>Recordings.</span> Sent to AI services when you ask for feedback. We don’t save them on our servers. Your browser keeps the latest one in memory so you can ask for a deeper report, until you close the tab or start over.</>,
                  <><span className={em}>Reports.</span> Transcript, feedback, scores, speaking stats, delivery reports, the date and the format you picked.</>,
                  <><span className={em}>Practice scripts.</span> The topic you type and the script that comes back.</>,
                  <><span className={em}>Aawax chat.</span> Your messages go to the AI with a short summary of your saved scores and feedback so answers fit you. We don’t save the chat. It disappears when you close the tab.</>,
                  <><span className={em}>Account.</span> Name, email, and your password in scrambled (hashed) form, never readable. With Google sign-in: your name, email, profile picture, Google account ID, and the sign-in tokens Google issues.</>,
                  <><span className={em}>Technical data.</span> IP address and browser type, used to keep you signed in, stop abuse and fix errors. Guests get a cookie so their saved work stays theirs.</>,
                  <><span className={em}>On your device only.</span> Your avatar, Aawax look, sound setting, guest-use count and whether you’ve seen the tour. These stay in your browser and never reach us.</>,
                ]} />
                <p>Please don’t put things like health details, passwords or other people’s private information into a speech or chat.</p>
              </Section>

              <Section title="Where it goes">
                <p>We use these services to run the coach. Each one gets only what its job needs.</p>
                <div className="grid gap-2">
                  {PROVIDERS.map((p) => (
                    <div key={p.name} className="rounded-[14px] border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
                      <p className="text-[#f2efff]">
                        <span className="font-semibold">{p.name}</span>
                        <span className="text-[#a79dc8]"> · {p.role}</span>
                      </p>
                      <p className="text-[13px] text-[#a79dc8]">Gets: {p.gets}</p>
                      <a href={p.policy} target="_blank" rel="noopener noreferrer" className="text-[12px] text-[#c4b5fd] underline underline-offset-2 hover:text-white">
                        Their privacy terms
                      </a>
                    </div>
                  ))}
                </div>
                <p>
                  These services may process data outside Nepal, including in the United States. They handle it
                  under their own terms. Depending on the plan, a service may keep data for a while or use it to
                  improve its products. We don’t control that, so check their terms if it matters to you.
                </p>
              </Section>

              <Section title="How long we keep it">
                <List items={[
                  'Reports and scripts: until you delete them or your account. We keep your 50 most recent of each and remove older ones automatically.',
                  'Account details: until you delete your account.',
                  'Sign-ins: end when you log out, or after 30 days without use.',
                  'Abuse-prevention counters (these can include your IP address or email): short-lived, and removed by regular automatic cleanup.',
                  'Guest data: the guest cookie lasts a year. Saved guest work stays until you delete it, or moves into your account when you sign up or sign in.',
                  'Hosting logs: kept for a short time by our host, then removed.',
                ]} />
              </Section>

              <Section title="Your choices">
                <List items={[
                  'Delete any single report or script from Speech History.',
                  'Account, then Delete Data: removes all your reports and scripts.',
                  'Account, then Delete Account: removes your account and everything in it. This can’t be undone.',
                  'For safety, deleting all data or your account needs a recent sign-in.',
                  <>For anything else (a copy of your data, fixing it, removing guest data, or a question), email <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#c4b5fd] underline underline-offset-2">{PRIVACY_CONTACT}</a>. We aim to reply within 30 days.</>,
                ]} />
              </Section>

              <Section title="Age">
                <p>
                  The coach isn’t meant for children under 13. If you’re under 18, use it with permission from a
                  parent or guardian. Schools or teachers who use it with students are responsible for getting any
                  permission their own rules require. If you think a child’s data is here without permission,
                  email us and we’ll delete it.
                </p>
              </Section>

              <Section title="About the AI feedback">
                <p>
                  Scores, feedback, insights, scripts and example voices are made by AI. They can be wrong, unfair or
                  incomplete, and the same speech can be marked a bit differently twice. They’re practice help only,
                  not professional, academic, medical, speech therapy or legal advice. Don’t rely on them for
                  important decisions, and a good score doesn’t promise a result in any competition, class or exam.
                </p>
              </Section>

              <Section title="Formats and results">
                <p>
                  The speech formats and the way speeches are marked are based on established public speaking
                  frameworks and technical measures, like structure, pace, pauses and filler words. They’re also
                  shaped by Aawaz’s own learning and experience as a speaker. The coach is designed to improve your
                  speaking in the speech types it offers, and these methods work for most people who use them.
                  They aren’t magic, though. Getting better takes regular practice, and the coach doesn’t promise
                  instant or guaranteed improvement.
                </p>
                <p>
                  Feedback is built around your own speech: your words, your timings and the format you picked.
                  It’s designed to point at specific moments and give you something concrete to work on. If you
                  ever get feedback that feels generic and doesn’t fit what you said, email{' '}
                  <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#c4b5fd] underline underline-offset-2">{PRIVACY_CONTACT}</a>{' '}
                  and we’ll look into it and fix it.
                </p>
                <p>
                  If you practise in the app every day for a month or more, follow the formats and feedback as
                  advised, and can show you gained nothing from it, email{' '}
                  <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#c4b5fd] underline underline-offset-2">{PRIVACY_CONTACT}</a>.
                  Aawaz will look at your practice and help you improve personally. Your Speech History is the record
                  we’ll look at, so practise signed in to an account and don’t delete it.
                </p>
              </Section>

              <Section title="Your responsibilities">
                <List items={[
                  'Only record yourself, or people who clearly agreed to be recorded.',
                  'You own what you say and write, and you’re responsible for it. You let us process it only to run the coach for you.',
                  'Don’t use the coach for anything illegal, hateful, harassing, sexual, or meant to harm or impersonate someone.',
                  'Check facts in generated scripts, and follow your school or competition rules on using AI. Don’t present a generated script as fully your own work where that isn’t allowed.',
                  'Example voices are AI. Don’t pass them off as a real person.',
                  'Keep your password private. You’re responsible for what happens on your account.',
                  'Don’t try to break, overload, copy, scrape or get around the limits of the coach.',
                ]} />
                <p>We can limit or remove access for anyone who breaks these rules.</p>
              </Section>

              <Section title="What we’re responsible for, and what we aren’t">
                <p className={em}>We will:</p>
                <List items={[
                  'use your data only to run the coach and keep it working and safe,',
                  'protect it with reasonable care,',
                  'never sell it or use it for ads,',
                  'delete it when you ask, as described above.',
                ]} />
                <p className={em}>We aren’t responsible for:</p>
                <List items={[
                  'mistakes in AI feedback, scores or scripts, or what you decide based on them,',
                  'how the services listed above handle data under their own terms,',
                  'content you record, write or share, including anything you share outside the app,',
                  'loss of saved work, downtime or changes to features. Keep your own copy of anything important,',
                  'access to your account from a device you left signed in or a password you shared.',
                ]} />
                <p>
                  The coach is free and provided “as is”, without any promise that it will always work, be accurate,
                  or suit a particular purpose. We may change, pause or stop it at any time. As far as the law allows,
                  we aren’t liable for indirect or resulting losses from using it. Nothing here takes away rights you
                  have by law that can’t be signed away.
                </p>
              </Section>

              <Section title="Changes and law">
                <p>
                  We may update this notice. The date at the top shows the latest version, and using the coach after a
                  change means you accept it. This notice is governed by the laws of Nepal.
                </p>
              </Section>

              <Section title="Contact">
                <p>
                  Questions, data requests or complaints: <a href={`mailto:${PRIVACY_CONTACT}`} className="text-[#c4b5fd] underline underline-offset-2">{PRIVACY_CONTACT}</a>
                </p>
              </Section>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
