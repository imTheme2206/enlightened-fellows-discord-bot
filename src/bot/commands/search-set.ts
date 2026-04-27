import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageComponentInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import { presets } from "../../data/search-presets";
import { searchSets } from "../../services/setSearch";
import type { SearchInput } from "../../services/setSearch/types";
import {
  loadArmorSkills,
  loadGroupSkillOptions,
  loadSetSkillOptions,
  loadWeaponSkills,
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

const MAX_SKILLS = 5;
const PAGE_SIZE = 23;

function paginateOptions(
  options: { label: string; value: string }[],
  page: number,
): { label: string; value: string }[] {
  const slice = options.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  if (page > 0) slice.unshift({ label: "◀ Previous page", value: "__prev__" });
  if ((page + 1) * PAGE_SIZE < options.length)
    slice.push({ label: "▶ Next page", value: "__next__" });
  return slice;
}
const SESSION_TTL_MS = 10 * 60 * 1000;
const RESULTS_PER_PAGE = 3;

type Step =
  | "main"
  | "weapon-skill"
  | "set-skill"
  | "select-preset"
  | "remove-skill";

interface SkillEntry {
  name: string;
  level: number;
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
  pendingSlotSize: 1 | 2 | 3 | null;
  pendingSkillName: string | null;
  weaponSkillPage: number;
  slotPages: Partial<Record<1 | 2 | 3, number>>;
}

const sessions = new Map<string, SearchState>();

function getSession(userId: string): SearchState {
  return (
    sessions.get(userId) ?? {
      gogmaSkills: {
        groupSkill: "",
        setSKill: "",
      },
      skills: [],
      setSkills: [],
      groupSkills: [],
      rank: "high",
      step: "main",
      pendingSlotSize: null,
      pendingSkillName: null,
      weaponSkillPage: 0,
      slotPages: {},
    }
  );
}

function saveSession(userId: string, state: SearchState): void {
  sessions.set(userId, state);
  setTimeout(() => sessions.delete(userId), SESSION_TTL_MS);
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
    "select-preset": "Pick a preset to load.",
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
          .addOptions(setOptions),
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
          .addOptions(groupOptions),
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

  if (state.step === "select-preset") {
    const options = presets.map((p) => ({
      label: p.name,
      description: `${p.rank.charAt(0).toUpperCase() + p.rank.slice(1)} — ${p.skills.map((s) => `${s.name} ${s.level}`).join(", ")}`,
      value: p.name,
    }));

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId("search-set:preset-pick")
          .setPlaceholder("Choose a preset…")
          .addOptions(
            options.length
              ? options
              : [{ label: "No presets defined", value: "__none__" }],
          ),
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

  // rows.push(
  //   new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
  //     new StringSelectMenuBuilder()
  //       .setCustomId("search-set:rank-pick")
  //       .setPlaceholder("Rank filter…")
  //       .addOptions([
  //         { label: "Low Rank", value: "low", default: state.rank === "low" },
  //         { label: "High Rank", value: "high", default: state.rank === "high" },
  //         {
  //           label: "Master Rank",
  //           value: "master",
  //           default: state.rank === "master",
  //         },
  //       ]),
  //   ),
  // );
  //
  //
  //
  const allWeaponOptions = loadWeaponSkills().filter(
    (s) => !addedSkills.has(s.value),
  );
  const weaponOptions = paginateOptions(
    allWeaponOptions,
    state.weaponSkillPage,
  );

  rows.push(
    new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("search-set:slot-weapon-pick")
        .setPlaceholder("Add Weapon Slot skill…")
        .setDisabled(atMax)
        .addOptions(
          weaponOptions.length
            ? weaponOptions
            : [{ label: "All weapon skills added", value: "__none__" }],
        ),
    ),
  );

  for (const slot of [1, 2, 3] as const) {
    const page = state.slotPages[slot] ?? 0;
    const allOptions = loadArmorSkills(slot).filter(
      (s) => !addedSkills.has(s.value),
    );
    const options = paginateOptions(allOptions, page);

    rows.push(
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`search-set:slot-${slot}-pick`)
          .setPlaceholder(`Add Slot ${slot} skill…`)
          .setDisabled(atMax)
          .addOptions(
            options.length
              ? options
              : [{ label: `All slot ${slot} skills added`, value: "__none__" }],
          ),
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
        .setCustomId("search-set:btn-preset")
        .setLabel("Load Preset")
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

// ─── Command ──────────────────────────────────────────────────────────────────

export const data = new SlashCommandBuilder()
  .setName("search-set")
  .setDescription("Search for armor sets that match your desired skills");

export async function execute(
  interaction: ChatInputCommandInteraction,
): Promise<void> {
  const state: SearchState = {
    gogmaSkills: {
      groupSkill: "",
      setSKill: "",
    },
    skills: [],
    setSkills: [],
    groupSkills: [],
    rank: "high",
    step: "main",
    pendingSlotSize: null,
    pendingSkillName: null,
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

  const state = getSession(interaction.user.id);

  const update = async (next: SearchState) => {
    saveSession(interaction.user.id, next);
    await interaction.update({
      embeds: [buildEmbed(next)],
      components: buildComponents(next),
    });
  };

  const id = interaction.customId;

  if (id === "search-set:rank-pick" && interaction.isStringSelectMenu()) {
    await update({
      ...state,
      rank: interaction.values[0] as SearchState["rank"],
    });
    return;
  }

  if (
    id === "search-set:slot-weapon-pick" &&
    interaction.isStringSelectMenu()
  ) {
    const picked = interaction.values[0];
    if (picked === "__none__") return;
    if (picked === "__prev__") {
      await update({
        ...state,
        weaponSkillPage: Math.max(0, state.weaponSkillPage - 1),
      });
      return;
    }
    if (picked === "__next__") {
      await update({ ...state, weaponSkillPage: state.weaponSkillPage + 1 });
      return;
    }
    saveSession(interaction.user.id, {
      ...state,
      pendingSlotSize: 1,
      pendingSkillName: picked,
    });
    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("search-set:level-modal")
        .setTitle(`Level for ${picked}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("level")
              .setLabel("Enter level")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(2)
              .setPlaceholder("e.g. 5")
              .setRequired(true),
          ),
        ),
    );
    return;
  }

  if (
    id.startsWith("search-set:slot-") &&
    id.endsWith("-pick") &&
    interaction.isStringSelectMenu()
  ) {
    const slotSize = parseInt(id.split("-")[2], 10) as 1 | 2 | 3;
    const picked = interaction.values[0];
    if (picked === "__none__") return;
    if (picked === "__prev__") {
      await update({
        ...state,
        slotPages: {
          ...state.slotPages,
          [slotSize]: Math.max(0, (state.slotPages[slotSize] ?? 0) - 1),
        },
      });
      return;
    }
    if (picked === "__next__") {
      await update({
        ...state,
        slotPages: {
          ...state.slotPages,
          [slotSize]: (state.slotPages[slotSize] ?? 0) + 1,
        },
      });
      return;
    }

    saveSession(interaction.user.id, {
      ...state,
      pendingSlotSize: slotSize,
      pendingSkillName: picked,
    });

    await interaction.showModal(
      new ModalBuilder()
        .setCustomId("search-set:level-modal")
        .setTitle(`Level for ${picked}`)
        .addComponents(
          new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder()
              .setCustomId("level")
              .setLabel("Enter level")
              .setStyle(TextInputStyle.Short)
              .setMaxLength(2)
              .setPlaceholder("e.g. 5")
              .setRequired(true),
          ),
        ),
    );
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

  if (id === "search-set:btn-preset") {
    await update({ ...state, step: "select-preset" });
    return;
  }

  if (id === "search-set:btn-cancel") {
    await update({
      ...state,
      step: "main",
      pendingSlotSize: null,
      pendingSkillName: null,
    });
    return;
  }

  // Set bonus selected (stays on set-skill step)
  if (id === "search-set:set-pick" && interaction.isStringSelectMenu()) {
    const picked = interaction.values[0];
    await update({ ...state, setSkills: [...state.setSkills, picked] });
    return;
  }

  // Group skill selected (stays on group-skill step)
  if (id === "search-set:group-pick" && interaction.isStringSelectMenu()) {
    const picked = interaction.values[0];
    await update({ ...state, groupSkills: [...state.groupSkills, picked] });
    return;
  }

  // Gogma weapon set skill contribution
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

  // Gogma weapon group skill contribution
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

  // Preset selected
  if (id === "search-set:preset-pick" && interaction.isStringSelectMenu()) {
    const picked = interaction.values[0];
    if (picked === "__none__") {
      await update({ ...state, step: "main" });
      return;
    }
    const preset = presets.find((p) => p.name === picked);
    if (!preset) {
      await update({ ...state, step: "main" });
      return;
    }

    await update({
      ...state,
      skills: preset.skills.slice(0, MAX_SKILLS) as SkillEntry[],
      rank: preset.rank as "low" | "high" | "master",
      step: "main",
    });
    return;
  }

  // Remove skill selected
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

// ─── Modal handler (level input) ─────────────────────────────────────────────

export async function handleModal(
  interaction: ModalSubmitInteraction,
): Promise<void> {
  if (interaction.customId !== "search-set:level-modal") return;

  const state = getSession(interaction.user.id);
  if (!state.pendingSkillName || !state.pendingSlotSize) {
    await interaction.reply({
      content: "Session expired — run /search-set again.",
      ephemeral: true,
    });
    return;
  }

  const level = Math.max(
    1,
    parseInt(interaction.fields.getTextInputValue("level"), 10) || 1,
  );
  const entry: SkillEntry = {
    name: state.pendingSkillName,
    level,
    slotSize: state.pendingSlotSize,
  };
  const next: SearchState = {
    ...state,
    skills: [...state.skills, entry],
    step: "main",
    pendingSkillName: null,
  };

  saveSession(interaction.user.id, next);
  await interaction.update({
    embeds: [buildEmbed(next)],
    components: buildComponents(next),
  });
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

  // Require 1 extra free slot per skill per slot size after deco placement
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
      embeds: [],
      components: [],
      content: `Search failed: ${msg}`,
    });
    return;
  }

  sessions.delete(interaction.user.id);

  if (results.length === 0) {
    await interaction.editReply({
      embeds: [],
      components: [],
      content: "No armor sets found for those skills.",
    });
    return;
  }

  const entries: EmbedPaginationEntry[] = results.map((r, i) => ({
    embed: buildSearchResultEmbed(r, i + 1, results.length),
    attachments: [],
  }));

  const paginated = paginateEmbedEntries(entries, RESULTS_PER_PAGE);
  const totalPages = paginated.pages.length;
  const buttonIds = { prev: "search-set:prev", next: "search-set:next" };
  const components = buildPaginationComponents(0, totalPages, buttonIds);

  const message = await interaction.followUp({
    embeds: paginated.pages[0].map((e) => e.embed),
    components,
    ephemeral: false,
  });

  registerEmbedPaginationCollector(message, paginated, {
    buttonIds,
    timeoutMs: DEFAULT_PAGINATION_TIMEOUT_MS,
    commandUserId: interaction.user.id,
  });
}

export default {
  data,
  execute,
  handleComponent,
  handleModal,
} satisfies Command;
