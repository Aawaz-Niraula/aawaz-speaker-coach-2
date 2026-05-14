const form = new FormData();
form.append("hello", "world");
const options = { method: "POST", body: form };

try {
  await fetch("http://localhost:9999", options);
} catch (e) {
  console.log("first fetch failed:", e.message);
}

try {
  await fetch("http://localhost:9999", options);
  console.log("second fetch succeeded?");
} catch (e) {
  console.log("second fetch thrown:", e.name, e.message);
}
