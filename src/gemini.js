import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODEL = 'gemini-flash-latest';

const SUMMARY_INSTRUCTIONS =
  'Summarize this content in English, as concise and structured key points. ' +
  'Get straight to the point, no introductory fluff.';

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
    contents: `${SUMMARY_INSTRUCTIONS}\n\nTitle: ${title}\n\nContent:\n${truncated}`,
  });

  return response.text;
}
