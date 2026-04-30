import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from "discord.js";
import { MONSTER_LIST } from "mh-wilds-event-scraper";
import { Command } from "./_types";

const apexMonsters = [
  "Arkveld",
  "Rey Dau",
  "Nu Udra",
  "Uth Duna",
  "Jin Dahaad",
  "Gore Magala",
  "Mizutsune",
  "Zho Shia",
];

export const data = new SlashCommandBuilder()
  .setName("hzv")
  .setDescription("Return Meta Build Guide Reddit Link")
  .addStringOption((option) =>
    option
      .setName("monster")
      .setDescription("Select monster")
      .setRequired(true)
      .setAutocomplete(true),
  );

export async function handleAutocomplete(
  interaction: AutocompleteInteraction,
): Promise<void> {
  const focusedValue = interaction.options.getFocused();
  if (!focusedValue) {
    await interaction.respond(
      MONSTER_LIST.slice(0, 25).map((monster) => ({
        name: monster,
        value: monster,
      })),
    );
    return;
  }

  const filteredMonsters = MONSTER_LIST.filter((monster) =>
    monster.toLowerCase().startsWith(focusedValue.toLowerCase()),
  );

  await interaction.respond(
    filteredMonsters.map((monster) => ({ name: monster, value: monster })),
  );
}
export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const monster = interaction.options.getString("monster", true);

  const HZVImagePath = `./assets/hitzone-value/${monster.split(" ").join("_")}_HZV.png`;

  await interaction.reply({
    files: [HZVImagePath],
  });
}

export default { data, execute, handleAutocomplete } satisfies Command;
