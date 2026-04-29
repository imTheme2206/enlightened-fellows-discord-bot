import { EmbedBuilder } from "discord.js";
import type { SearchResult } from "../../services/set-search/types";

const SLOT_LABELS = ["Head", "Chest", "Arms", "Waist", "Legs", "Talisman"];

/**
 * Builds a Discord embed for a single armor set search result.
 *
 * @param result - The search result to render.
 * @param index - 1-based result index (for display).
 * @param total - Total number of results (for display).
 */
export const buildSearchResultEmbed = (
  result: SearchResult,
  index: number,
  total: number,
): EmbedBuilder => {
  const embed = new EmbedBuilder()
    .setTitle(`Set ${index} of ${total}`)
    .setColor(0x2b82d7);

  embed.addFields({
    name: "Armor",
    value: "",
    inline: false,
  });

  result.armorNames.map((name, i) =>
    embed.addFields({
      name: SLOT_LABELS[i] ?? `Slot ${i + 1}`,
      value: name,
      inline: true,
    }),
  );
  // Skills field: sorted descending by level
  const skillLines = Object.entries(result.skills)
    .filter(([, lv]) => lv > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([sk, lv]) => `${sk}: ${lv}`);

  if (Object.keys(result.setSkills).length > 0) {
    const setLines = Object.entries(result.setSkills)
      .filter(([, lv]) => lv > 0)
      .map(([sk, lv]) => `${sk} (${lv})`);
    skillLines.push(...setLines.map((l) => `[Set] ${l}`));
  }

  if (Object.keys(result.groupSkills).length > 0) {
    const groupLines = Object.entries(result.groupSkills)
      .filter(([, lv]) => lv > 0)
      .map(([sk, lv]) => `${sk} (${lv})`);
    skillLines.push(...groupLines.map((l) => `[Group] ${l}`));
  }

  embed.addFields({
    name: "Skills",
    value: skillLines.join("\n") || "None",
    inline: false,
  });

  // Decorations field
  embed.addFields({
    name: "Decorations",
    value: result.decoNames.length > 0 ? result.decoNames.join(", ") : "None",
    inline: false,
  });

  embed.addFields({ name: "\u200B", value: "\u200B" });

  // Free slots field
  const freq = {
    1: 0,
    2: 0,
    3: 0,
  };

  for (const val of result.freeSlots) {
    freq[val as keyof typeof freq] = (freq[val as keyof typeof freq] ?? 0) + 1;
  }

  Object.entries(freq).forEach(([key, val]) => {
    embed.addFields({
      name: `Free Slots (${key})`,
      value: `${val}`,
      inline: true,
    });
  });
  return embed;
};
