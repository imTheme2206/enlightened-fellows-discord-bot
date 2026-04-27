import {
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  MessageComponentInteraction,
  ModalSubmitInteraction,
  AutocompleteInteraction,
} from 'discord.js'

/** Interface every bot command must implement */
export interface Command {
  data:
    | SlashCommandBuilder
    | SlashCommandOptionsOnlyBuilder
    | Omit<SlashCommandBuilder, 'addSubcommand' | 'addSubcommandGroup'>
  execute(interaction: ChatInputCommandInteraction): Promise<void>
  /** Handles both button and select menu interactions (preferred over handleButton for new commands) */
  handleComponent?(interaction: MessageComponentInteraction): Promise<void>
  handleButton?(interaction: ButtonInteraction): Promise<void>
  handleModal?(interaction: ModalSubmitInteraction): Promise<void>
  handleAutocomplete?(interaction: AutocompleteInteraction): Promise<void>
}
