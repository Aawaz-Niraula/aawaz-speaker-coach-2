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
- Evaluate clarity, pacing, pauses, filler words, vocal energy, confidence, and audience control.`;

export const SPEECH_TEMPLATES: SpeechTemplate[] = [
  {
    id: 'formal-organiser',
    label: 'Formal - Organising Party',
    src: '/templates/formal-organiser.jpeg',
    rubricTitle: 'Formal event speech by the organiser',
    rubric: `Evaluate this as a formal speech delivered by the event organiser.
- Opening should greet respected guests and establish the event purpose quickly.
- The organiser should sound composed, respectful, and in control of logistics.
- The body should acknowledge people in a clean order and avoid rambling praise.
- Transitions should feel deliberate, not improvised.
- The closing should invite the next step or transition with authority.`,
  },
  {
    id: 'formal-chiefguest',
    label: 'Formal - Chief Guest',
    src: '/templates/formal-chiefguest.jpeg',
    rubricTitle: 'Formal speech introducing or addressing a chief guest',
    rubric: `Evaluate this as a formal chief-guest style speech.
- Opening should establish respect, occasion, and credibility immediately.
- The speaker must balance warmth with protocol and avoid sounding casual.
- The body should show clear sequencing: occasion, recognition, significance, and key message.
- Language should remain polished and precise rather than vague or repetitive.
- The ending should sound ceremonious and intentional.`,
  },
  {
    id: 'debate',
    label: 'Debate Speech',
    src: '/templates/debate.jpeg',
    rubricTitle: 'Debate speech',
    rubric: `Evaluate this as a debate speech.
- The claim must be stated early and unambiguously.
- Arguments should be logically separated and supported rather than emotionally sprayed around.
- Rebuttal quality matters: look for anticipation of counterarguments or direct refutation.
- Delivery should sound assertive, controlled, and strategically paced.
- The conclusion should restate the stance forcefully and close the case.`,
  },
  {
    id: 'general-public-speaking',
    label: 'General Public Speaking',
    src: '/templates/general.jpeg',
    rubricTitle: 'Structured public-speaking template',
    rubric: `Evaluate this using a structured public-speaking template.
- Opening should hook attention, establish topic, and preview direction.
- The middle should develop two or three clear ideas with examples or explanation.
- Delivery should sound conversational but intentional, not flat or rushed.
- The conclusion should summarize the takeaway and finish decisively.
- Judge whether the speech feels prepared, structured, and audience-aware.`,
  },
];

export function getSpeechTemplate(templateId?: string | null) {
  if (!templateId) {
    return null;
  }

  return SPEECH_TEMPLATES.find((template) => template.id === templateId) ?? null;
}
