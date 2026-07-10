import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function extractArticle(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordSumUpVidz/1.0)' },
    redirect: 'follow',
  });

  if (!res.ok) {
    throw new Error(`Impossible de recuperer la page (HTTP ${res.status})`);
  }

  const html = await res.text();
  const dom = new JSDOM(html, { url });
  const article = new Readability(dom.window.document).parse();

  if (!article || !article.textContent?.trim()) {
    throw new Error("Impossible d'extraire le contenu de la page");
  }

  return { title: article.title || url, text: article.textContent };
}
