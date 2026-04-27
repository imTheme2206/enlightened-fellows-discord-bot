import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import type { Command } from "./_types";
import { buildComponents } from "./search-set/_components";
import { handleComponent, handleModal } from "./search-set/_handlers";
import { getSession, saveSession } from "./search-set/_state";
import { buildEmbed } from "./search-set/_ui";

export const data = new SlashCommandBuilder()
  .setName("search-set")
  .setDescription("Search for armor sets that match your desired skills");

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const state = getSession(interaction.user.id);
  const fresh = {
    ...state,
    skills: [],
    setSkills: [],
    groupSkills: [],
    gogmaSkills: { setSkill: "", groupSkill: "" },
    rank: "high" as const,
    step: "main" as const,
    pendingSkills: null,
    weaponSkillPage: 0,
    slotPages: {},
  };
  saveSession(interaction.user.id, fresh);

  await interaction.reply({
    embeds: [buildEmbed(fresh)],
    components: buildComponents(fresh),
    ephemeral: true,
  });
}

export { handleComponent, handleModal };

export default {
  data,
  execute,
  handleComponent,
  handleModal,
} satisfies Command;
