// Generate the DECLARE music bed with ElevenLabs Eleven Music.
// A composition plan whose section durations line up with the video's beats,
// so the build peaks on the logo reveal instead of drifting against it.
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

// Shared palette. Serene but mysterious: air and space, never dread, never
// tropical, never triumphant-corporate.
const CORE = [
  "consistent full volume throughout",
  "cinematic underscore",
  "mysterious",
  "serene",
  "atmospheric",
  "warm analog synth pads",
  "soft sub bass",
  "gentle pulsing arpeggio",
  "wide reverb",
  "instrumental",
];
const AVOID = [
  "vocals",
  "singing",
  "spoken word",
  "narration",
  "whispering",
  "human voice",
  "vocal samples",
  "lyrics",
  "choir",
  "dread",
  "horror",
  "menacing",
  "aggressive drums",
  "distorted",
  "tropical",
  "beach",
  "ukulele",
  "steel drums",
  "corporate stock music",
  "triumphant fanfare",
  "brass stabs",
];

// Section durations sum to 71,500 ms, matching the composition exactly.
//
// WARNING: `text` is treated as LYRICS and WILL be sung. Never put mood or
// stage direction there. Use a bare [Section] marker and describe the sound
// in positive_styles instead.
const plan = {
  chunks: [
    {
      // 0.0 - 7.1  search bar typing, questions with no answers
      text: "[Intro]",
      duration_ms: 7100,
      positive_styles: [...CORE, "strong opening hook", "prominent pulsing bassline", "clear rhythmic arpeggio", "immediate presence", "confident groove", "full bodied"],
      negative_styles: [...AVOID, "fade in", "silence", "sparse", "quiet", "ambient wash", "slow start"],
      context_adherence: "medium",
    },
    {
      // 7.1 - 21.6  the fear statistics
      text: "[Build 1]",
      duration_ms: 14500,
      positive_styles: [...CORE, "slow build", "subtle tension", "steady heartbeat pulse", "present", "full mix"],
      negative_styles: [...AVOID, "loud", "chaotic"],
      context_adherence: "high",
    },
    {
      // 21.6 - 34.0  the education gap, rising to the turn
      text: "[Build 2]",
      duration_ms: 12400,
      positive_styles: [...CORE, "rising", "anticipation", "layered arpeggio", "swelling pads", "forward motion"],
      negative_styles: [...AVOID, "resolution", "climax"],
      context_adherence: "high",
    },
    {
      // 34.0 - 39.6  THE LOGO REVEAL. the mystery resolves, light floods in
      text: "[Drop]",
      duration_ms: 5600,
      positive_styles: [
        ...CORE,
        "uplifting resolution",
        "warm major chord",
        "bright shimmering release",
        "hopeful",
        "spacious",
      ],
      negative_styles: [...AVOID, "tense", "minor key", "dark"],
      context_adherence: "high",
    },
    {
      // 39.6 - 52.9  curriculum ladder + photo montage
      text: "[Main]",
      duration_ms: 13300,
      positive_styles: [...CORE, "steady momentum", "light rhythmic pulse", "optimistic", "flowing", "bright"],
      negative_styles: [...AVOID, "heavy", "brooding"],
      context_adherence: "high",
    },
    {
      // 52.9 - 61.0  the proof: 9 schools, 500+ students
      text: "[Lift]",
      negative_styles: [...AVOID, "bombastic", "epic orchestral"],
      duration_ms: 8100,
      positive_styles: [...CORE, "warm", "sincere", "gently proud", "melodic"],
      context_adherence: "high",
    },
    {
      // 61.0 - 71.5  end card, holds then fades
      text: "[Outro]",
      duration_ms: 10500,
      positive_styles: [...CORE, "resolving", "calm", "sustained pad", "open ending", "fading"],
      negative_styles: [...AVOID, "abrupt", "build"],
      context_adherence: "medium",
    },
  ],
};

const total = plan.chunks.reduce((n, c) => n + c.duration_ms, 0);
console.log(`Composition plan: ${plan.chunks.length} sections, ${(total / 1000).toFixed(1)}s total`);
plan.chunks.forEach((c, i) => {
  const start = plan.chunks.slice(0, i).reduce((n, x) => n + x.duration_ms, 0);
  console.log(`  ${(start / 1000).toFixed(1).padStart(5)}s  ${c.text.match(/\[(.+?)\]/)[1]}`);
});

const res = await fetch("https://api.elevenlabs.io/v1/music", {
  method: "POST",
  headers: { "xi-api-key": key, "Content-Type": "application/json" },
  body: JSON.stringify({
    composition_plan: plan,
    model_id: "music_v2",
    output_format: "mp3_44100_128",
  }),
});

if (!res.ok) {
  console.error(`FAILED ${res.status}: ${(await res.text()).slice(0, 600)}`);
  process.exit(1);
}

const out = path.join(ROOT, "assets/audio/bgm.mp3");
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log(`\nWrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
