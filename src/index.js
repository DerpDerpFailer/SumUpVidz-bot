import 'dotenv/config';
import { Client, Events, GatewayIntentBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { summarizeYoutubeUrl, summarizeText, isRetryableError } from './gemini.js';
import { extractArticle } from './extractor.js';
import { registerCommandsForGuild } from './commands.js';
import { getAllowedChannel, setAllowedChannel } from './config.js';

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

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Connecte en tant que ${readyClient.user.tag}`);

  for (const guild of readyClient.guilds.cache.values()) {
    registerCommandsForGuild(readyClient, guild.id).catch((err) =>
      console.error(`Impossible d'enregistrer la commande sur ${guild.name} :`, err),
    );
  }
});

client.on(Events.GuildCreate, (guild) => {
  registerCommandsForGuild(client, guild.id).catch((err) =>
    console.error(`Impossible d'enregistrer la commande sur ${guild.name} :`, err),
  );
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'sumup') return;

  if (interaction.options.getSubcommand() === 'channel') {
    const channel = interaction.options.getChannel('salon') ?? interaction.channel;
    await setAllowedChannel(interaction.guildId, channel.id);
    await interaction.reply({
      content: `Je ne repondrai plus qu'aux liens postes dans ${channel}.`,
      flags: MessageFlags.Ephemeral,
    });
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.guildId) return;

  const allowedChannelId = await getAllowedChannel(message.guildId);
  if (allowedChannelId && message.channelId !== allowedChannelId) return;

  const urls = message.content.match(URL_REGEX);
  if (!urls) return;

  for (const url of urls) {
    handleUrl(message, url).catch((err) => console.error(`Unexpected error for ${url}:`, err));
  }
});

const TYPING_REFRESH_MS = 8_000; // Discord's typing indicator lasts ~10s
const ORDINALS = { 2: '2nd', 3: '3rd' };

/** Keep the "is typing..." indicator alive until the returned stop() is called. */
function keepTyping(channel) {
  const send = () => channel.sendTyping().catch(() => {});
  send();
  const timer = setInterval(send, TYPING_REFRESH_MS);
  return () => clearInterval(timer);
}

async function handleUrl(message, url) {
  const isYoutube = YOUTUBE_REGEX.test(url);
  const stopTyping = keepTyping(message.channel);
  let statusMessage = null;

  // Single status message, edited on each retry, to avoid flooding the channel.
  const setStatus = async (content) => {
    try {
      if (statusMessage) await statusMessage.edit(content);
      else statusMessage = await message.reply({ content, allowedMentions: { repliedUser: false } });
    } catch (err) {
      console.error('Unable to post status message:', err);
    }
  };

  const onRetry = ({ attempt, maxAttempts, delayMs }) =>
    setStatus(
      `⏳ Gemini is overloaded, ${ORDINALS[attempt] ?? `${attempt}th`} try in ${delayMs / 1000}s ` +
        `(attempt ${attempt}/${maxAttempts})...`,
    );

  try {
    let summary;
    let sourceLabel;

    if (isYoutube) {
      summary = await summarizeYoutubeUrl(url, { onRetry });
      sourceLabel = 'Video YouTube';
    } else {
      const { title, text } = await extractArticle(url);
      summary = await summarizeText(title, text, { onRetry });
      sourceLabel = title;
    }

    const embed = new EmbedBuilder()
      .setColor(isYoutube ? 0xff0000 : 0x3498db)
      .setTitle(sourceLabel.slice(0, 256))
      .setURL(url)
      .setDescription(summary.slice(0, 4096))
      .setFooter({ text: 'Resume genere par Gemini' });

    await message.reply({ embeds: [embed] });
    await statusMessage?.delete().catch(() => {});
  } catch (err) {
    console.error(`Failed to summarize ${url}:`, err);
    const content =
      isRetryableError(err) && err.attempts > 1
        ? `❌ Gemini is still overloaded after ${err.attempts} tries. Please try again later.`
        : `❌ Sorry, I couldn't summarize ${url}.`;
    await setStatus(content);
  } finally {
    stopTyping();
  }
}

client.login(process.env.DISCORD_TOKEN);
