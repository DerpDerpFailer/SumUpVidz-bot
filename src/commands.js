import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  REST,
  Routes,
} from 'discord.js';

export const sumupCommand = new SlashCommandBuilder()
  .setName('sumup')
  .setDescription('Configuration du bot de resume')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addSubcommand((sub) =>
    sub
      .setName('channel')
      .setDescription('Restreint le bot a un seul salon (par defaut : le salon courant)')
      .addChannelOption((opt) =>
        opt
          .setName('salon')
          .setDescription('Salon dans lequel le bot doit repondre')
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
