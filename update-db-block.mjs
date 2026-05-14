import fs from 'fs';

let content = fs.readFileSync('src/app/api/transcribe-analyze/route.ts', 'utf-8');

const regex = /  const feedback = analysisData\.choices\?\.\[0\]\?\.message\?\.content \|\| 'No feedback from coach\.';[\s\S]*?  const updatedHistory = await listRecentSpeechSessions\(userId, 6\);/m;

const replacement = `  const feedback = analysisData.choices?.[0]?.message?.content || 'No feedback from coach.';
  const overallScore = extractOverallScore(feedback);

  const newSessionHeader = {
    id: randomUUID(),
    user_id: userId,
    template_id: template?.id ?? null,
    template_label: template?.label ?? null,
    rubric_mode: rubricMode,
    transcript,
    feedback,
    overall_score: overallScore,
    words_per_min: wordsPerMin || null,
    duration_seconds: duration || null,
    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };

  const updatedHistory = [newSessionHeader, ...previousHistory].slice(0, 6);

  after(async () => {
    try {
      await insertSpeechSession({
        id: newSessionHeader.id,
        user_id: newSessionHeader.user_id,
        template_id: newSessionHeader.template_id,
        template_label: newSessionHeader.template_label,
        rubric_mode: newSessionHeader.rubric_mode,
        transcript: newSessionHeader.transcript,
        feedback: newSessionHeader.feedback,
        overall_score: newSessionHeader.overall_score,
        words_per_min: newSessionHeader.words_per_min,
        duration_seconds: newSessionHeader.duration_seconds,
      });
    } catch (e) {
      console.error('Failed to insert speech session in background:', e);
    }

    try {
      const sampleToStore = voiceSample && voiceSample.size >= 3000 ? voiceSample : file;
      const sampleBytes = await sampleToStore.arrayBuffer();
      await upsertSpeechVoiceSample({
        userId,
        audioData: sampleBytes,
        mimeType: sampleToStore.type || 'audio/webm;codecs=opus',
        filename: sampleToStore.name || 'voice-sample.webm',
      });
    } catch (error) {
      console.error('Failed to prepare speech voice sample in background:', error);
    }
  });`;

fs.writeFileSync('src/app/api/transcribe-analyze/route.ts', content.replace(regex, replacement));
