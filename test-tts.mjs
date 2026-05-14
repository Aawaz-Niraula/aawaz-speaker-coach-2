import fetch from "node-fetch";
const API_KEY = "NO_KEY_JUST_WANT_ERROR_FORMAT";
const res = await fetch("https://api.deepinfra.com/v1/openai/audio/speech", {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "XiaomiMiMo/MiMo-V2.5-tts",
    input: "Hello world"
  })
});
console.log(res.status, await res.text());
