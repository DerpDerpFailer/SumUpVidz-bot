import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  REST,
  Routes,
} from 'discord.js';

export const sumupCommand = new SlashCommandBuilder()
  .setName('sumup')
  .setDescription('Summary bot settings')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('Restrict the bot to a single channel (defaults to the current one)')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Channel the bot should reply in')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(false),
      ),
  );

export async function registerCommandsForGuild(client, guildId) {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
    body: [sumupCommand.toJSON()],
  });
}
