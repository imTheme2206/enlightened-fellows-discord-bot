import { MessageComponentInteraction } from "discord.js";
import {
  MAX_SKILLS,
  PendingSkill,
  SavedSearch,
  saveSession,
  SearchState,
} from "../../../bot/commands/search-set/state";
import { buildComponents } from "../components/form";
import { buildLevelModal } from "../components/modal";
import { buildEmbed } from "../components/ui";
import { getSkillMaxLevels } from "../interface";

export const updateSession = async (
  interaction: MessageComponentInteraction,
  next: SearchState,
): Promise<void> => {
  saveSession(interaction.user.id, next);
  await interaction.update({
    embeds: [buildEmbed(next)],
    components: buildComponents(next),
  });
};

export const handleSlotPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  const id = interaction.customId;
  const slotSize = parseInt(id.split("-")[2], 10) as 1 | 2 | 3;
  const values = interaction.values;

  if (values.length === 1 && values[0] === "__prev__") {
    await updateSession(interaction, {
      ...state,
      slotPages: {
        ...state.slotPages,
        [slotSize]: Math.max(0, (state.slotPages[slotSize] ?? 0) - 1),
      },
    });
    return;
  }
  if (values.length === 1 && values[0] === "__next__") {
    await updateSession(interaction, {
      ...state,
      slotPages: {
        ...state.slotPages,
        [slotSize]: (state.slotPages[slotSize] ?? 0) + 1,
      },
    });
    return;
  }

  if (values.length === 0) {
    await interaction.deferUpdate();
    return;
  }

  const remaining = MAX_SKILLS - state.skills.length;
  const pending: PendingSkill[] = values
    .slice(0, remaining)
    .map((name) => ({ name, slotSize }));

  saveSession(interaction.user.id, { ...state, pendingSkills: pending });
  const maxLevels = getSkillMaxLevels(pending.map((p) => p.name));
  await interaction.showModal(buildLevelModal(pending, maxLevels));
};

export const handleSetPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  await updateSession(interaction, {
    ...state,
    setSkills: [...state.setSkills, interaction.values[0]],
  });
};

export const handleGroupPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  await updateSession(interaction, {
    ...state,
    groupSkills: [...state.groupSkills, interaction.values[0]],
  });
};

export const handleGogmaSetPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  const picked = interaction.values[0];
  await updateSession(interaction, {
    ...state,
    gogmaSkills: {
      ...state.gogmaSkills,
      setSkill: picked === "__none__" ? "" : picked,
    },
  });
};

export const handleGogmaGroupPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  const picked = interaction.values[0];
  await updateSession(interaction, {
    ...state,
    gogmaSkills: {
      ...state.gogmaSkills,
      groupSkill: picked === "__none__" ? "" : picked,
    },
    step: "main",
  });
};

export const handleHistoryPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  const picked = interaction.values[0];
  if (picked === "__none__") {
    await updateSession(interaction, {
      ...state,
      step: "main",
      historyEntries: undefined,
    });
    return;
  }
  const entry = state.historyEntries?.find((e) => e.id === picked);
  if (!entry) {
    await updateSession(interaction, {
      ...state,
      step: "main",
      historyEntries: undefined,
    });
    return;
  }
  const saved = JSON.parse(entry.data) as SavedSearch;
  await updateSession(interaction, {
    ...state,
    skills: saved.skills,
    setSkills: saved.setSkills,
    groupSkills: saved.groupSkills,
    gogmaSkills: {
      setSkill: saved.gogmaSetSkill,
      groupSkill: saved.gogmaGroupSkill,
    },
    rank: saved.rank,
    step: "main",
    historyEntries: undefined,
  });
};

export const handleRemovePick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  await updateSession(interaction, {
    ...state,
    skills: state.skills.filter((s) => s.name !== interaction.values[0]),
    step: "main",
  });
};

export const handleRemoveSetPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  await updateSession(interaction, {
    ...state,
    setSkills: state.setSkills.filter((s) => s !== interaction.values[0]),
  });
};

export const handleRemoveGroupPick = async (
  state: SearchState,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  if (!interaction.isStringSelectMenu()) return;
  await updateSession(interaction, {
    ...state,
    groupSkills: state.groupSkills.filter((g) => g !== interaction.values[0]),
  });
};
