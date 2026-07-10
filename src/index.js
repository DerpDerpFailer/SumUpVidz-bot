import 'dotenv/config';
import { Client, Events, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { summarizeYoutubeUrl, summarizeText } from './gemini.js';
import { extractArticle } from './extractor.js';

const ALLOWED_CHANNELS = (process.env.ALLOWED_CHANNEL_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)[\w-]+|youtu\.be\/[\w-]+)/i;
const URL_REGEX = /https?:\/\/[^\s<>]+/g;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Connecte en tant que ${readyClient.user.tag}`);
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;
  if (ALLOWED_CHANNELS.length && !ALLOWED_CHANNELS.includes(message.channelId)) return;

  const urls = message.content.match(URL_REGEX);
  if (!urls) return;

  for (const url of urls) {
    handleUrl(message, url).catch((err) => {
      console.error(`Erreur lors du resume de ${url} :`, err);
      message.reply(`Desole, je n'ai pas reussi a resumer ${url}.`).catch(() => {});
    });
  }
});

async function handleUrl(message, url) {
  const isYoutube = YOUTUBE_REGEX.test(url);

  await message.channel.sendTyping();

  let summary;
  let sourceLabel;

  if (isYoutube) {
    summary = await summarizeYoutubeUrl(url);
    sourceLabel = 'Video YouTube';
  } else {
    const { title, text } = await extractArticle(url);
    summary = await summarizeText(title, text);
    sourceLabel = title;
  }

  const embed = new EmbedBuilder()
    .setColor(isYoutube ? 0xff0000 : 0x3498db)
    .setTitle(sourceLabel.slice(0, 256))
    .setURL(url)
    .setDescription(summary.slice(0, 4096))
    .setFooter({ text: 'Resume genere par Gemini' });

  await message.reply({ embeds: [embed] });
}

client.login(process.env.DISCORD_TOKEN);
