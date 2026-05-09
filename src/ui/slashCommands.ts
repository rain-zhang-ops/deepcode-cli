import type { SkillInfo } from "../session";
import { t } from "../i18n";

export type SlashCommandKind = "skill" | "skills" | "goal" | "compact" | "diff" | "copy" | "clear" | "context" | "init" | "new" | "resume" | "exit" | "model" | "thinking" | "effort" | "cwd" | "skill-new" | "mcp-add" | "key" | "settings" | "mode" | "todos";

export type SlashCommandItem = {
  kind: SlashCommandKind;
  name: string;
  label: string;
  description: string;
  skill?: SkillInfo;
};

export const BUILTIN_SLASH_COMMANDS: SlashCommandItem[] = [
  {
    kind: "skills",
    name: "skills",
    label: "/skills",
    description: t("slash_skills")
  },
  {
    kind: "goal",
    name: "goal",
    label: "/goal",
    description: t("slash_goal")
  },
  {
    kind: "compact",
    name: "compact",
    label: "/compact",
    description: t("slash_compact")
  },
  {
    kind: "diff",
    name: "diff",
    label: "/diff",
    description: t("slash_diff")
  },
  {
    kind: "copy",
    name: "copy",
    label: "/copy",
    description: t("slash_copy")
  },
  {
    kind: "clear",
    name: "clear",
    label: "/clear",
    description: t("slash_clear")
  },
  {
    kind: "context",
    name: "context",
    label: "/context",
    description: t("slash_context")
  },
  {
    kind: "init",
    name: "init",
    label: "/init",
    description: t("slash_init")
  },
  {
    kind: "new",
    name: "new",
    label: "/new",
    description: t("slash_new")
  },
  {
    kind: "resume",
    name: "resume",
    label: "/resume",
    description: t("slash_resume")
  },
  {
    kind: "exit",
    name: "exit",
    label: "/exit",
    description: t("slash_exit")
  },
  {
    kind: "model",
    name: "model",
    label: "/model",
    description: t("slash_model")
  },
  {
    kind: "thinking",
    name: "thinking",
    label: "/thinking",
    description: t("slash_thinking")
  },
  {
    kind: "effort",
    name: "effort",
    label: "/effort",
    description: t("slash_effort")
  },
  {
    kind: "cwd",
    name: "cwd",
    label: "/cwd",
    description: t("slash_cwd")
  },
  {
    kind: "skill-new",
    name: "skill",
    label: "/skill",
    description: t("slash_skill")
  },
  {
    kind: "mcp-add",
    name: "mcp",
    label: "/mcp",
    description: t("slash_mcp")
  },
  {
    kind: "key",
    name: "key",
    label: "/key",
    description: t("slash_key")
  },
  {
    kind: "settings",
    name: "settings",
    label: "/settings",
    description: t("slash_settings")
  },
  {
    kind: "mode",
    name: "mode",
    label: "/mode",
    description: t("slash_mode")
  },
  {
    kind: "todos",
    name: "todos",
    label: "/todos",
    description: t("slash_todos")
  }
];

export function buildSlashCommands(skills: SkillInfo[]): SlashCommandItem[] {
  const skillItems: SlashCommandItem[] = skills.map((skill) => ({
    kind: "skill",
    name: skill.name,
    label: `/${skill.name}`,
    description: skill.description || t("slash_no_desc"),
    skill
  }));
  // Keep built-in operational commands visible first when menu is truncated.
  return [...BUILTIN_SLASH_COMMANDS, ...skillItems];
}

export function filterSlashCommands(
  items: SlashCommandItem[],
  token: string
): SlashCommandItem[] {
  if (!token.startsWith("/")) {
    return [];
  }
  const query = token.slice(1).toLowerCase();
  if (!query) {
    return items;
  }
  return items.filter((item) => item.name.toLowerCase().includes(query));
}

export function findExactSlashCommand(
  items: SlashCommandItem[],
  token: string
): SlashCommandItem | null {
  if (!token.startsWith("/")) {
    return null;
  }
  const query = token.slice(1);
  const matches = items.filter((item) => item.name === query);
  return matches.find((item) => item.kind !== "skill") ?? matches[0] ?? null;
}

export function formatSlashCommandDescription(description: string): string {
  return (description || t("slash_no_desc")).trim().replace(/\s+/g, " ");
}

export function formatSlashCommandLabel(item: SlashCommandItem): string {
  return item.kind === "skill" && item.skill?.isLoaded ? `${item.label} ✓` : item.label;
}
