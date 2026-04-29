import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { buildComponents } from "../../services/set-search/components/form";
import { buildEmbed } from "../../services/set-search/components/ui";
import type { Command } from "./_types";
import { handleComponent, handleModal } from "./search-set/handlers";
import { getSession, saveSession } from "./search-set/state";

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
