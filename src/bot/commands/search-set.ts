import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  LabelBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import {
  getRecentSearchHistory,
  saveSearchHistory,
  type SearchHistoryRow,
} from "../../services/dbService";
import { searchSets } from "../../services/setSearch";
import type { SearchInput } from "../../services/setSearch/types";
import {
  getSkillMaxLevels,
  loadArmorSkills,
  loadGroupSkillOptions,
  loadSetSkillOptions,
} from "../services/search-set";
import type { EmbedPaginationEntry } from "../utils/embed-pagination";
import {
  buildPaginationComponents,
  DEFAULT_PAGINATION_TIMEOUT_MS,
  paginateEmbedEntries,
  registerEmbedPaginationCollector,
} from "../utils/embed-pagination";
import { buildSearchResultEmbed } from "../utils/searchResultEmbed";
import type { Command } from "./_types";

const MAX_SKILLS = 10;

const SESSION_TTL_MS = 10 * 60 * 1000;
const RESULTS_PER_PAGE = 3;

type Step = "main" | "weapon-skill" | "set-skill" | "history" | "remove-skill";

interface SkillEntry {
  name: string;
  level: number;
  slotSize: 1 | 2 | 3;
}

interface SavedSearch {
  skills: SkillEntry[];
  setSkills: string[];
  groupSkills: string[];
  gogmaSetSkill: string;
  gogmaGroupSkill: string;
  rank: "low" | "high" | "master";
}

interface PendingSkill {
  name: string;
  slotSize: 1 | 2 | 3;
}

interface SearchState {
  gogmaSkills: {
    setSKill: string;
    groupSkill: string;
  };
  skills: SkillEntry[];
  setSkills: string[];
  groupSkills: string[];
  rank: "low" | "high" | "master";
  step: Step;
  pendingSkills: PendingSkill[] | null;
  weaponSkillPage: number;
  slotPages: Partial<Record<1 | 2 | 3, number>>;
  historyEntries?: SearchHistoryRow[];
}

const sessions = new Map<string, SearchState>();

function getSession(userId: string): SearchState {
  return (
    sessions.get(userId) ?? {
      gogmaSkills: { groupSkill: "", setSKill: "" },
      skills: [],
      setSkills: [],
      groupSkills: [],
      rank: "high",
      step: "main",
      pendingSkills: null,
      weaponSkillPage: 0,
      slotPages: {},
    }
  );
}

function saveSession(userId: string, state: SearchState): void {
  sessions.set(userId, state);
  setTimeout(() => sessions.delete(userId), SESSION_TTL_MS);
}

function buildHistoryLabel(state: SearchState): string {
  const parts = [
    ...state.skills.map((s) => `${s.name} ${s.level}`),
    ...state.setSkills,
    ...state.groupSkills,
  ];
  const base = parts.length > 0 ? parts.join(", ") : "Empty search";
  const labeled = `[${state.rank.toUpperCase()}] ${base}`;
  return labeled.length > 100 ? labeled.slice(0, 97) + "…" : labeled;
}

// ─── UI builders ──────────────────────────────────────────────────────────────

function buildEmbed(state: SearchState): EmbedBuilder {
  const skillLines = state.skills.length
    ? state.skills
        .map((s) => `• [Slot ${s.slotSize}] ${s.name} Lv ${s.level}`)
        .join("\n")
    : "_None_";

  const setLines = state.setSkills.length
    ? state.setSkills.map((s) => `• ${s}`).join("\n")
    : "_None_";

  const weaponLines = `${state.gogmaSkills.groupSkill || "_None_"} + ${state.gogmaSkills.setSKill || "_None_"}`;

  const groupLines = state.groupSkills.length
    ? state.groupSkills.map((g) => `• ${g}`).join("\n")
    : "_None_";

  const descriptions: Record<Step, string> = {
    main: `Pick skills from the dropdowns below, then hit **Search**.`,
    "weapon-skill":
      "Pick the set and group skills your weapon already provides (counts as 1 level each toward your desired skills).",
    "set-skill":
      "Pick desired set bonuses and group skills. Hit **← Back** when done.",
    history: "Select a previous search to reload.",
    "remove-skill": "Pick a skill to remove.",
  };

  return new EmbedBuilder()
    .setTitle("Armor Set Search")
    .setColor(0x5865f2)
    .setDescription(descriptions[state.step])
    .addFields(
      { name: "Gogma Weapon Skills", value: weaponLines, inline: false },
      { name: "Skills", value: skillLines, inline: false },
      { name: "Set Bonuses", value: setLines, inline: true },
      { name: "Group Skills", value: groupLines, inline: true },
      {
        name: "Rank",
        value: state.rank.charAt(0).toUpperCase() + state.rank.slice(1),
        inline: true,
      },
    )
    .setFooter({ text: "Session expires in 10 min" });
}

type AnyRow = ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>;

function buildComponents(state: SearchState): AnyRow[] {
  const rows: AnyRow[] = [];

  if (state.step === "weapon-skill") {
    const setOptions = loadSetSkillOptions();
    const groupOptions = loadGroupSkillOptions();

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("search-set:gogma-set-pick")
          .setPlaceholder(
            state.gogmaSkills.setSKill
              ? `Set skill: ${state.gogmaSkills.setSKill}`
              : "Weapon's set skill contribution…",
          )
          .addOptions(
            setOptions.length
              ? setOptions
              : [{ label: "None available", value: "__none__" }],
          ),
      ),
    );

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("search-set:gogma-group-pick")
          .setPlaceholder(
            state.gogmaSkills.groupSkill
              ? `Group skill: ${state.gogmaSkills.groupSkill}`
              : "Weapon's group skill contribution…",
          )
          .addOptions(
            groupOptions.length
              ? groupOptions
              : [{ label: "None available", value: "__none__" }],
          ),
      ),
    );

    rows.push(cancelRow());
    return rows;
  }

  if (state.step === "set-skill") {
    const addedSetSkills = new Set(state.setSkills);
    const addedGroupSkills = new Set(state.groupSkills);

    const setOptions = loadSetSkillOptions().filter(
      (o) => !addedSetSkills.has(o.value),
    );
    const groupOptions = loadGroupSkillOptions().filter(
      (o) => !addedGroupSkills.has(o.value),
    );

    if (setOptions.length) {
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("search-set:set-pick")
            .setPlaceholder("Add a set bonus…")
            .addOptions(setOptions),
        ),
      );
    }

    if (groupOptions.length) {
      rows.push(
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder()
            .setCustomId("search-set:group-pick")
            .setPlaceholder("Add a group skill…")
            .addOptions(groupOptions),
        ),
      );
    }

    rows.push(cancelRow());
    return rows;
  }

  if (state.step === "history") {
    const entries = state.historyEntries ?? [];
    const options =
      entries.length > 0
        ? entries.map((e) => ({
            label: e.label,
            description: `Searched: ${e.searchedAt.slice(0, 16)}`,
            value: e.id,
          }))
        : [{ label: "No search history found", value: "__none__" }];

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("search-set:history-pick")
          .setPlaceholder("Load a previous search…")
          .addOptions(options),
      ),
    );
    rows.push(cancelRow());
    return rows;
  }

  if (state.step === "remove-skill") {
    const options = state.skills.map((s) => ({
      label: `[Slot ${s.slotSize}] ${s.name} Lv ${s.level}`,
      value: s.name,
    }));

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("search-set:remove-pick")
          .setPlaceholder("Choose a skill to remove…")
          .addOptions(options),
      ),
    );
    rows.push(cancelRow());
    return rows;
  }

  // ── Main step ──
  const skillCount = state.skills.length;
  const hasSkills = skillCount > 0;
  const atMax = skillCount >= MAX_SKILLS;
  const addedSkills = new Set(state.skills.map((s) => s.name));

  // const allWeaponOptions = loadWeaponSkills().filter(
  //   (s) => !addedSkills.has(s.value),
  // );
  // const weaponOptions = paginateOptions(
  //   allWeaponOptions,
  //   state.weaponSkillPage,
  // );

  // rows.push(
  //   new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  //     new StringSelectMenuBuilder()
  //       .setCustomId("search-set:slot-weapon-pick")
  //       .setPlaceholder("Add Weapon Slot skill…")
  //       .setDisabled(atMax)
  //       .addOptions(
  //         weaponOptions.length
  //           ? weaponOptions
  //           : [{ label: "All weapon skills added", value: "__none__" }],
  //       ),
  //   ),
  // );

  for (const slot of [1, 2, 3] as const) {
    const allOptions = loadArmorSkills(slot).filter(
      (s) => !addedSkills.has(s.value),
    );
    const displayOptions = allOptions.length
      ? allOptions
      : [{ label: `All slot ${slot} skills added`, value: "__none__" }];

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`search-set:slot-${slot}-pick`)
          .setPlaceholder(`Add Slot ${slot} skill…`)
          .setDisabled(atMax)
          .setMinValues(1)
          .setMaxValues(Math.min(5, displayOptions.length))
          .addOptions(displayOptions),
      ),
    );
  }

  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("search-set:btn-remove")
        .setLabel("Remove Skill")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(!hasSkills),
      new ButtonBuilder()
        .setCustomId("search-set:btn-history")
        .setLabel("History")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("search-set:btn-weapon")
        .setLabel("Weapon Skills")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("search-set:btn-set-bonus")
        .setLabel("Set/Group Bonus")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("search-set:btn-search")
        .setLabel("Search")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasSkills),
    ),
  );

  return rows;
}

function cancelRow(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("search-set:btn-cancel")
      .setLabel("← Back")
      .setStyle(ButtonStyle.Secondary),
  );
}

function buildResultRows(
  page: number,
  totalPages: number,
  buttonIds: { prev: string; next: string },
): ActionRowBuilder<ButtonBuilder>[] {
  const rows = buildPaginationComponents(page, totalPages, buttonIds);
  rows.push(
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("search-set:btn-modify")
        .setLabel("← Modify Search")
        .setStyle(ButtonStyle.Secondary),
    ),
  );
  return rows;
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("search-set")
  .setDescription("Search for armor sets that match your desired skills");

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const state: SearchState = {
    gogmaSkills: { groupSkill: "", setSKill: "" },
    skills: [],
    setSkills: [],
    groupSkills: [],
    rank: "high",
    step: "main",
    pendingSkills: null,
    weaponSkillPage: 0,
    slotPages: {},
  };
  saveSession(interaction.user.id, state);

  await interaction.reply({
    embeds: [buildEmbed(state)],
    components: buildComponents(state),
    ephemeral: true,
  });
}

// ─── Component handler ────────────────────────────────────────────────────────

export async function handleComponent(
  interaction: MessageComponentInteraction,
): Promise<void> {
  if (
    interaction.customId === "search-set:prev" ||
    interaction.customId === "search-set:next"
  )
    return;

  // "Modify Search" button lives on the non-ephemeral results message —
  // respond with a fresh ephemeral search UI rather than updating the results.
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

  const update = async (next: SearchState) => {
    saveSession(interaction.user.id, next);
    await interaction.update({
      embeds: [buildEmbed(next)],
      components: buildComponents(next),
    });
  };

  const id = interaction.customId;

  if (
    id.startsWith("search-set:slot-") &&
    id.endsWith("-pick") &&
    interaction.isStringSelectMenu()
  ) {
    const slotSize = parseInt(id.split("-")[2], 10) as 1 | 2 | 3;
    const values = interaction.values;

    // Navigation-only selection (single nav token, no real skills alongside)
    if (values.length === 1 && values[0] === "__prev__") {
      await update({
        ...state,
        slotPages: {
          ...state.slotPages,
          [slotSize]: Math.max(0, (state.slotPages[slotSize] ?? 0) - 1),
        },
      });
      return;
    }
    if (values.length === 1 && values[0] === "__next__") {
      await update({
        ...state,
        slotPages: {
          ...state.slotPages,
          [slotSize]: (state.slotPages[slotSize] ?? 0) + 1,
        },
      });
      return;
    }

    const skillNames = values;
    if (skillNames.length === 0) {
      await interaction.deferUpdate();
      return;
    }

    // Respect the overall skill cap
    const remaining = MAX_SKILLS - state.skills.length;
    const pending: PendingSkill[] = skillNames
      .slice(0, remaining)
      .map((name) => ({ name, slotSize }));

    saveSession(interaction.user.id, { ...state, pendingSkills: pending });
    const maxLevels = getSkillMaxLevels(pending.map((p) => p.name));
    await interaction.showModal(buildLevelModal(pending, maxLevels));
    return;
  }

  if (id === "search-set:btn-weapon") {
    await update({ ...state, step: "weapon-skill" });
    return;
  }

  if (id === "search-set:btn-set-bonus") {
    await update({ ...state, step: "set-skill" });
    return;
  }

  if (id === "search-set:btn-remove") {
    await update({ ...state, step: "remove-skill" });
    return;
  }

  if (id === "search-set:btn-history") {
    const entries = getRecentSearchHistory(interaction.user.id);
    await update({ ...state, step: "history", historyEntries: entries });
    return;
  }

  if (id === "search-set:btn-cancel") {
    await update({ ...state, step: "main", pendingSkills: null });
    return;
  }

  if (id === "search-set:set-pick" && interaction.isStringSelectMenu()) {
    await update({
      ...state,
      setSkills: [...state.setSkills, interaction.values[0]],
    });
    return;
  }

  if (id === "search-set:group-pick" && interaction.isStringSelectMenu()) {
    await update({
      ...state,
      groupSkills: [...state.groupSkills, interaction.values[0]],
    });
    return;
  }

  if (id === "search-set:gogma-set-pick" && interaction.isStringSelectMenu()) {
    const picked = interaction.values[0];
    await update({
      ...state,
      gogmaSkills: {
        ...state.gogmaSkills,
        setSKill: picked === "__none__" ? "" : picked,
      },
      step: "main",
    });
    return;
  }

  if (
    id === "search-set:gogma-group-pick" &&
    interaction.isStringSelectMenu()
  ) {
    const picked = interaction.values[0];
    await update({
      ...state,
      gogmaSkills: {
        ...state.gogmaSkills,
        groupSkill: picked === "__none__" ? "" : picked,
      },
      step: "main",
    });
    return;
  }

  if (id === "search-set:history-pick" && interaction.isStringSelectMenu()) {
    const picked = interaction.values[0];
    if (picked === "__none__") {
      await update({ ...state, step: "main", historyEntries: undefined });
      return;
    }
    const entry = state.historyEntries?.find((e) => e.id === picked);
    if (!entry) {
      await update({ ...state, step: "main", historyEntries: undefined });
      return;
    }
    const saved = JSON.parse(entry.data) as SavedSearch;
    await update({
      ...state,
      skills: saved.skills,
      setSkills: saved.setSkills,
      groupSkills: saved.groupSkills,
      gogmaSkills: {
        setSKill: saved.gogmaSetSkill,
        groupSkill: saved.gogmaGroupSkill,
      },
      rank: saved.rank,
      step: "main",
      historyEntries: undefined,
    });
    return;
  }

  if (id === "search-set:remove-pick" && interaction.isStringSelectMenu()) {
    await update({
      ...state,
      skills: state.skills.filter((s) => s.name !== interaction.values[0]),
      step: "main",
    });
    return;
  }

  if (id === "search-set:btn-search") {
    await runSearch(interaction, state);
  }
}

// ─── Level modal ─────────────────────────────────────────────────────────────

function buildLevelModal(
  pending: PendingSkill[],
  maxLevels: Map<string, number>,
): ModalBuilder {
  const builder = new ModalBuilder()
    .setCustomId("search-set:level-modal")
    .setTitle("Enter Skill Levels");

  for (let i = 0; i < Math.min(pending.length, 5); i++) {
    const { name } = pending[i];
    const maxLevel = maxLevels.get(name) ?? 7;
    const rawLabel = `${name} (max ${maxLevel})`;
    const label = rawLabel.length > 45 ? rawLabel.slice(0, 44) + "…" : rawLabel;

    const skillLevelInput = new TextInputBuilder()
      .setCustomId(`level_${i}`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`1–${maxLevel}`)
      .setRequired(true);

    const skillLabel = new LabelBuilder()
      .setLabel(label)
      .setTextInputComponent(skillLevelInput);

    builder.addLabelComponents(skillLabel);
    // builder.addComponents(
    //   new ActionRowBuilder<TextInputBuilder>().addComponents(
    //     new TextInputBuilder()
    //       .setCustomId(`level_${i}`)
    //       .setLabel(label)
    //       .setStyle(TextInputStyle.Short)
    //       .setMaxLength(2)
    //       .setPlaceholder(`1–${maxLevel}`)
    //       .setRequired(true),
    //   ),
    // );
  }

  return builder;
}

// ─── Modal handler (level input) ─────────────────────────────────────────────

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
  const newEntries: SkillEntry[] = state.pendingSkills
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

// ─── Search execution ─────────────────────────────────────────────────────────

async function runSearch(
  interaction: MessageComponentInteraction,
  state: SearchState,
): Promise<void> {
  await interaction.deferUpdate();
  await interaction.editReply({
    embeds: [buildEmbed(state).setDescription("Searching…")],
    components: [],
  });

  const skills: Record<string, number> = {};
  for (const s of state.skills) skills[s.name] = s.level;

  const slotFilters: Record<string, number> = {};
  for (const s of state.skills) {
    const key = String(s.slotSize);
    slotFilters[key] = (slotFilters[key] ?? 0) + 1;
  }

  const setSkills: Record<string, number> = {};
  for (const s of state.setSkills) {
    const remaining = 1 - (state.gogmaSkills.setSKill === s ? 1 : 0);
    if (remaining > 0) setSkills[s] = remaining;
  }

  const groupSkills: Record<string, number> = {};
  for (const g of state.groupSkills) {
    const remaining = 1 - (state.gogmaSkills.groupSkill === g ? 1 : 0);
    if (remaining > 0) groupSkills[g] = remaining;
  }

  const searchInput: SearchInput = {
    skills,
    slotFilters,
    ...(Object.keys(setSkills).length > 0 && { setSkills }),
    ...(Object.keys(groupSkills).length > 0 && { groupSkills }),
    rank: state.rank,
  };

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

  // Persist this search to history regardless of results
  saveSearchHistory(
    interaction.user.id,
    buildHistoryLabel(state),
    JSON.stringify({
      skills: state.skills,
      setSkills: state.setSkills,
      groupSkills: state.groupSkills,
      gogmaSetSkill: state.gogmaSkills.setSKill,
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

  // Restore the search UI in the original ephemeral message so the user can
  // keep refining without needing to re-invoke /search-set.
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

export default {
  data,
  execute,
  handleComponent,
  handleModal,
} satisfies Command;
