// Generate the DECLARE narration via ElevenLabs (v3, audio tags).
// Reads ELEVENLABS_API_KEY from ../../.env — never hardcode the key.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV = path.resolve(ROOT, "../../.env");

const key = fs
  .readFileSync(ENV, "utf8")
  .split("\n")
  .find((l) => l.startsWith("ELEVENLABS_API_KEY="))
  ?.split("=")[1]
  ?.trim()
  ?.replace(/^["']|["']$/g, "");

if (!key) throw new Error("ELEVENLABS_API_KEY not found in .env");

const VOICE = "jfIS2w2yJi0grJZPyEsk";

// One request per scene so each clip's duration is known exactly for the timeline.
// Written to sound like a student talking, not a brand. No em-dashes, no
// "it's not X, it's Y" reversals, no rhetorical questions answered by the
// narrator. Short sentences, plain words, contractions.
// Written to sound like a student talking, not a brand. No em-dashes, no
// "it's not X, it's Y" reversals, no rhetorical questions answered by the
// narrator. Always "we", never "I". Short sentences, plain words, contractions.
const SCENES = [
  ["s1", "[curious] This is what people actually type into Google. [softly] And almost none of us know enough to answer it."],
  ["s2", "[serious] Fifty two percent of people say AI makes them nervous. Seventy nine percent think it's coming for their jobs. [drawn out] And fake videos went from half a million to eight MILLION in two years."],
  ["s3", "[thoughtful] In America, about sixty percent of high schools teach this stuff. [sighs] In Nepal, almost none of us get taught it at all. [firmly] That gap is the whole problem."],
  ["s4", "[warmly] So we started DECLARE. By students, for students."],
  ["s5", "[excited] We start with the simplest algorithms and build up to attention, what's running inside every chatbot you've used. [warmly] Then we teach them to explain it themselves."],
  ["s6", "[proudly] Nine schools so far. Over five hundred students. [emphatic] All of it free. The school pays nothing."],
  ["s7", "[sincere] Once you see how it works, it stops being scary. [encouraging] Share this. And if you want us at your school, send us a message. [warmly] Insights, for everyone."],
];

const outDir = path.join(ROOT, "assets/audio");
fs.mkdirSync(outDir, { recursive: true });

const ONLY = (process.env.ONLY||"").split(",").filter(Boolean);
for (const [id, text] of SCENES) {
  if (ONLY.length && !ONLY.includes(id)) continue;
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        model_id: "eleven_v3",
        voice_settings: { stability: 0.4, similarity_boost: 0.75, style: 0.35 },
      }),
    },
  );

  if (!res.ok) {
    console.error(`${id} FAILED ${res.status}: ${(await res.text()).slice(0, 300)}`);
    continue;
  }

  const out = path.join(outDir, `vo-${id}.mp3`);
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  console.log(`${id} -> ${out} (${fs.statSync(out).size} bytes)`);
}
