import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-flash-latest';

const SUMMARY_INSTRUCTIONS =
  "Resume ce contenu en francais, sous forme de points cles concis et structures. " +
  'Va droit au but, pas de blabla introductif.';

export async function summarizeYoutubeUrl(url) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          { text: SUMMARY_INSTRUCTIONS },
          { fileData: { fileUri: url, mimeType: 'video/mp4' } },
        ],
      },
    ],
  });

  return response.text;
}

export async function summarizeText(title, text) {
  const truncated = text.slice(0, 100_000);

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `${SUMMARY_INSTRUCTIONS}\n\nTitre : ${title}\n\nContenu :\n${truncated}`,
  });

  return response.text;
}
