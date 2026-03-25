export type SpeechTemplateId =
  | 'formal-organiser'
  | 'formal-chiefguest'
  | 'debate'
  | 'general-public-speaking';

export type SpeechTemplate = {
  id: SpeechTemplateId;
  label: string;
  src: string;
  rubricTitle: string;
  rubric: string;
};

export const GENERAL_RUBRIC = `Use a general public-speaking rubric when no template is selected.
Judge the speech using these rules:
- Structure should roughly follow ELP with 20% introduction, 60% body, 20% conclusion.
- The opening should establish purpose quickly instead of wandering.
- The body should stay organized around a few clear points with transitions.
- The ending should land cleanly instead of fading out.
- Evaluate clarity, pacing, pauses, filler words, vocal energy, confidence, and audience control.
- Be stricter than a normal coach. Penalize weak structure, vague language, poor transitions, empty intensity, and lazy phrasing hard.
- If the speaker sounds unprepared, disorganized, soft, repetitive, or technically sloppy, say so directly.
- Prioritize technical reality over encouragement. Do not reward effort when execution is weak.
- The feedback should focus on delivery mechanics, structure, control, and audience impact, not feelings.`;

export const SPEECH_TEMPLATES: SpeechTemplate[] = [
  {
    id: 'formal-organiser',
    label: 'Formal - Organising Party',
    src: '/templates/formal-organiser.jpeg',
    rubricTitle: 'Formal event speech by the organiser',
    rubric: `Evaluate this as a formal speech delivered by the event organiser.
- Judge it as an organiser speech only, not as generic public speaking.
- Opening must greet respected guests and establish the event purpose quickly. Penalize slow or casual openings.
- The organiser must sound composed, respectful, and in control of the room and sequence of events.
- The body must acknowledge people in a clean order and avoid rambling praise, repeated thanks, or informal filler.
- Transitions must feel deliberate, ceremonial, and operationally clear, not improvised.
- The closing must invite the next step, speaker, or stage transition with authority and protocol awareness.
- Penalize casual tone, weak protocol, messy sequencing, and any loss of formal control heavily.`,
  },
  {
    id: 'formal-chiefguest',
    label: 'Formal - Chief Guest',
    src: '/templates/formal-chiefguest.jpeg',
    rubricTitle: 'Formal speech introducing or addressing a chief guest',
    rubric: `Evaluate this as a formal chief-guest style speech.
- Judge it as a ceremonial chief-guest speech only, not as generic public speaking.
- Opening must establish respect, occasion, and credibility immediately. Penalize casual or weak openings.
- The speaker must balance warmth with protocol and must not sound like they are chatting informally.
- The body must show clear sequencing: occasion, recognition, significance, and key message.
- Language must stay polished, precise, and ceremonial rather than vague, repetitive, or flat.
- The ending must sound ceremonious, intentional, and worthy of the event.
- Penalize broken protocol, clumsy praise, weak dignity, and language that lowers the status of the occasion.`,
  },
  {
    id: 'debate',
    label: 'Debate Speech',
    src: '/templates/debate.jpeg',
    rubricTitle: 'Debate speech',
    rubric: `Evaluate this as a debate speech.
- Judge it as a competitive argument speech only, not as generic public speaking.
- The claim must be stated early and unambiguously. Penalize delayed stance or confusion immediately.
- Arguments must be logically separated, supported, and ranked rather than emotionally sprayed around.
- Rebuttal quality matters: look for anticipation of counterarguments, direct refutation, clash, and comparative weighing.
- Delivery must sound assertive, controlled, and strategically paced rather than dramatic without logic.
- The conclusion must restate the stance forcefully and close the case.
- Penalize weak logic, unsupported assertions, fuzzy wording, and poor argumentative structure heavily.`,
  },
  {
    id: 'general-public-speaking',
    label: 'General Public Speaking',
    src: '/templates/general.jpeg',
    rubricTitle: 'Structured public-speaking template',
    rubric: `Evaluate this using a structured public-speaking template.
- Judge it as a structured prepared speech, not a casual talk.
- Opening should hook attention, establish topic, and preview direction.
- The middle should develop two or three clear ideas with examples or explanation.
- Delivery should sound conversational but intentional, not flat, vague, or rushed.
- The conclusion should summarize the takeaway and finish decisively.
- Judge whether the speech feels prepared, structured, audience-aware, and intentionally organized.
- Penalize drifting structure, weak point development, generic examples, and endings that fade out.`,
  },
];

export function getSpeechTemplate(templateId?: string | null) {
  if (!templateId) {
    return null;
  }

  return SPEECH_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
