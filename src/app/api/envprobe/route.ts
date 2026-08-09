export async function GET() {
  const names = Object.keys(process.env).filter((k) => /gemini/i.test(k));
  return Response.json({
    matchingNames: names,
    hasMixed: Boolean(process.env.Gemini_API_KEY),
    hasUpper: Boolean(process.env.GEMINI_API_KEY),
    deepinfra: Boolean(process.env.DEEPINFRA_API_KEY),
  });
}
export const runtime = 'nodejs';
