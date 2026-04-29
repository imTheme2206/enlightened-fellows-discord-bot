import type {
  MessageComponentInteraction,
  ModalSubmitInteraction,
} from "discord.js";
import {
  getRecentSearchHistory,
  saveSearchHistory,
} from "../../../services/db-service";
import { searchSets } from "../../../services/set-search";
import { buildComponents } from "../../../services/set-search/components/form";
import { buildSearchInput } from "../../../services/set-search/components/search-input";
import {
  buildEmbed,
  buildHistoryLabel,
  buildResultRows,
} from "../../../services/set-search/components/ui";
import {
  handleGogmaGroupPick,
  handleGogmaSetPick,
  handleGroupPick,
  handleHistoryPick,
  handleRemoveGroupPick,
  handleRemovePick,
  handleRemoveSetPick,
  handleSetPick,
  handleSlotPick,
  updateSession,
} from "../../../services/set-search/handler/form-handler";
import { getSkillMaxLevels } from "../../../services/set-search/interface";
import type { EmbedPaginationEntry } from "../../utils/embed-pagination";
import {
  DEFAULT_PAGINATION_TIMEOUT_MS,
  paginateEmbedEntries,
  registerEmbedPaginationCollector,
} from "../../utils/embed-pagination";
import { buildSearchResultEmbed } from "../../utils/search-result-embed";
import type { SavedSearch, SearchState } from "./state";
import { RESULTS_PER_PAGE, getSession, saveSession } from "./state";

async function runSearch(
  interaction: MessageComponentInteraction,
  state: SearchState,
): Promise<void> {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [buildEmbed(state).setDescription("Searching…")],
    components: [],
  });

  const searchInput = buildSearchInput(state);

  let results;
  try {
    results = searchSets(searchInput);
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Unknown error during search.";
    await interaction.editReply({
      embeds: [buildEmbed(state).setDescription(`Search failed: ${msg}`)],
      components: buildComponents(state),
    });
    return;
  }

  saveSearchHistory(
    interaction.user.id,
    buildHistoryLabel(state),
    JSON.stringify({
      skills: state.skills,
      setSkills: state.setSkills,
      groupSkills: state.groupSkills,
      gogmaSetSkill: state.gogmaSkills.setSkill,
      gogmaGroupSkill: state.gogmaSkills.groupSkill,
      rank: state.rank,
    } satisfies SavedSearch),
  );

  if (results.length === 0) {
    await interaction.editReply({
      embeds: [
        buildEmbed(state).setDescription(
          "No armor sets found. Adjust your search and try again:",
        ),
      ],
      components: buildComponents(state),
    });
    return;
  }

  const buttonIds = { prev: "search-set:prev", next: "search-set:next" };
  const entries: EmbedPaginationEntry[] = results.map((r, i) => ({
    embed: buildSearchResultEmbed(r, i + 1, results.length),
    attachments: [],
  }));
  const paginated = paginateEmbedEntries(entries, RESULTS_PER_PAGE);
  const totalPages = paginated.pages.length;

  const message = await interaction.followUp({
    embeds: paginated.pages[0].map((e) => e.embed),
    components: buildResultRows(0, totalPages, buttonIds),
    ephemeral: false,
  });

  // Restore the search UI so the user can keep refining without re-invoking /search-set
  await interaction.editReply({
    embeds: [buildEmbed(state)],
    components: buildComponents(state),
  });

  registerEmbedPaginationCollector(message, paginated, {
    buttonIds,
    timeoutMs: DEFAULT_PAGINATION_TIMEOUT_MS,
    commandUserId: interaction.user.id,
    buildComponents: (page, total, ids) => buildResultRows(page, total, ids),
  });
}

export async function handleComponent(
  interaction: MessageComponentInteraction,
): Promise<void> {
  // Pagination buttons are handled by the collector registered in runSearch
  if (
    interaction.customId === "search-set:prev" ||
    interaction.customId === "search-set:next"
  )
    return;

  // "Modify Search" lives on the non-ephemeral results message — open a fresh ephemeral UI
  if (interaction.customId === "search-set:btn-modify") {
    const state = getSession(interaction.user.id);
    if (
      !state.skills.length &&
      !state.setSkills.length &&
      !state.groupSkills.length
    ) {
      await interaction.reply({
        content: "Session expired — run /search-set again.",
        ephemeral: true,
      });
      return;
    }
    await interaction.reply({
      embeds: [buildEmbed({ ...state, step: "main" })],
      components: buildComponents({ ...state, step: "main" }),
      ephemeral: true,
    });
    return;
  }

  const state = getSession(interaction.user.id);
  const id = interaction.customId;

  if (id.startsWith("search-set:slot-") && id.endsWith("-pick")) {
    await handleSlotPick(state, interaction);
    return;
  }

  if (id === "search-set:btn-weapon") {
    await updateSession(interaction, { ...state, step: "weapon-skill" });
    return;
  }
  if (id === "search-set:btn-set-bonus") {
    await updateSession(interaction, { ...state, step: "set-skill" });
    return;
  }
  if (id === "search-set:btn-remove") {
    await updateSession(interaction, { ...state, step: "remove-skill" });
    return;
  }
  if (id === "search-set:btn-history") {
    const entries = getRecentSearchHistory(interaction.user.id);
    await updateSession(interaction, {
      ...state,
      step: "history",
      historyEntries: entries,
    });
    return;
  }
  if (id === "search-set:btn-cancel") {
    await updateSession(interaction, {
      ...state,
      step: "main",
      pendingSkills: null,
    });
    return;
  }
  if (id === "search-set:btn-clear-gogma") {
    await updateSession(interaction, {
      ...state,
      gogmaSkills: { setSkill: "", groupSkill: "" },
    });
    return;
  }

  if (id === "search-set:set-pick") {
    await handleSetPick(state, interaction);
    return;
  }
  if (id === "search-set:group-pick") {
    await handleGroupPick(state, interaction);
    return;
  }
  if (id === "search-set:gogma-set-pick") {
    await handleGogmaSetPick(state, interaction);
    return;
  }
  if (id === "search-set:gogma-group-pick") {
    await handleGogmaGroupPick(state, interaction);
    return;
  }
  if (id === "search-set:history-pick") {
    await handleHistoryPick(state, interaction);
    return;
  }
  if (id === "search-set:remove-pick") {
    await handleRemovePick(state, interaction);
    return;
  }
  if (id === "search-set:remove-set-pick") {
    await handleRemoveSetPick(state, interaction);
    return;
  }
  if (id === "search-set:remove-group-pick") {
    await handleRemoveGroupPick(state, interaction);
    return;
  }

  if (id === "search-set:btn-search") {
    await runSearch(interaction, state);
  }
}

export async function handleModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (interaction.customId !== "search-set:level-modal") return;

  const state = getSession(interaction.user.id);
  if (!state.pendingSkills || state.pendingSkills.length === 0) {
    await interaction.reply({
      content: "Session expired — run /search-set again.",
      ephemeral: true,
    });
    return;
  }

  const maxLevels = getSkillMaxLevels(state.pendingSkills.map((p) => p.name));
  const newEntries = state.pendingSkills
    .slice(0, 5)
    .map(({ name, slotSize }, i) => {
      const maxLevel = maxLevels.get(name) ?? 7;
      const raw = parseInt(
        interaction.fields.getTextInputValue(`level_${i}`),
        10,
      );
      const level = Math.min(maxLevel, Math.max(1, isNaN(raw) ? 1 : raw));
      return { name, level, slotSize };
    });

  const next: SearchState = {
    ...state,
    skills: [...state.skills, ...newEntries],
    step: "main",
    pendingSkills: null,
  };
  saveSession(interaction.user.id, next);

  if (interaction.isFromMessage()) {
    await interaction.update({
      embeds: [buildEmbed(next)],
      components: buildComponents(next),
    });
  } else {
    await interaction.reply({
      embeds: [buildEmbed(next)],
      components: buildComponents(next),
      ephemeral: true,
    });
  }
}
