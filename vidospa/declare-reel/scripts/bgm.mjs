// Pull a music bed from the HeyGen catalog using the credentials the
// hyperframes CLI already stored (~/.heygen). Writes assets/audio/bgm.mp3.
import path from "node:path";
import os from "node:os";

const LIB = path.join(os.homedir(), ".claude/skills/media-use/audio/scripts/lib/heygen.mjs");
const { heygenCredential, searchSounds, downloadTo } = await import(LIB);

const ROOT = path.resolve(import.meta.dirname, "..");

const cred = heygenCredential();
if (!cred?.headers) {
  console.error("No usable HeyGen credential found. Run: npx hyperframes auth login");
  process.exit(1);
}

const QUERY = process.argv[2] || "inspiring cinematic documentary underscore hopeful build";
const results = await searchSounds(QUERY, "music", cred.headers, { limit: 8 });

if (!results?.length) {
  console.error(`No music results for: ${QUERY}`);
  process.exit(1);
}

console.log(`Results for "${QUERY}":`);
results.forEach((r, i) => {
  console.log(`  [${i}] ${r.name || r.title || "(untitled)"} — ${r.duration ?? "?"}s  score=${r.score ?? "-"}`);
});

const pick = results[Number(process.env.PICK ?? 0)];
const out = path.join(ROOT, "assets/audio/bgm.mp3");
await downloadTo(pick.audio_url, out);
console.log(`\nDownloaded → ${out}`);
console.log(`  name: ${pick.name || pick.title}`);
console.log(`  duration: ${pick.duration}s`);
