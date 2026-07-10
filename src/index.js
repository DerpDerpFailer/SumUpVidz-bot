import 'dotenv/config';
import { Client, Events, GatewayIntentBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { summarizeYoutubeUrl, summarizeText } from './gemini.js';
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
