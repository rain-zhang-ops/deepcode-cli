import React, { useMemo, useState } from "react";
import { Box, Text } from "ink";
import * as os from "os";
import * as path from "path";
import type { SkillInfo } from "../session";
import type { ResolvedDeepcodingSettings } from "../settings";
import {
  BUILTIN_SLASH_COMMANDS,
  buildSlashCommands,
  formatSlashCommandDescription
} from "./slashCommands";
import { ThemedGradient } from "./ThemedGradient";
import { t } from "../i18n";
import { getRecommendedCliToolsStatus } from "../tools/managed-tools";

type WelcomeScreenProps = {
  projectRoot: string;
  settings: ResolvedDeepcodingSettings;
  skills: SkillInfo[];
  version: string;
  width: number;
};

const TITLE_PANEL_WIDTH = 70;
const PANEL_CONTENT_HEIGHT = 8;

const SHORTCUT_TIPS: Array<{ label: string; descKey: string }> = [
  { label: "Enter", descKey: "welcome_shortcut_enter" },
  { label: "Shift+Enter", descKey: "welcome_shortcut_shift_enter" },
  { label: "Ctrl+V", descKey: "welcome_shortcut_ctrl_v" },
  { label: "Esc", descKey: "welcome_shortcut_esc" },
  { label: "/", descKey: "welcome_shortcut_slash" },
  { label: "Ctrl+D twice", descKey: "welcome_shortcut_ctrl_d" }
];

const RECOMMENDED_TIPS: Array<{ label: string; description: () => string }> = [
  {
    label: "rg + jq",
    description: () => {
      const status = getRecommendedCliToolsStatus();
      return status.rg && status.jq ? t("welcome_tip_rg_jq_ready") : t("welcome_tip_rg_jq");
    }
  }
];

export function WelcomeScreen({
  projectRoot,
  settings,
  skills,
  version,
  width
}: WelcomeScreenProps): React.ReactElement {
  const tips = useMemo(() => buildWelcomeTips(skills), [skills]);
  const [tipIndex] = useState(() => randomTipIndex(tips.length));
  const compact = width < TITLE_PANEL_WIDTH + 42;
  const cwd = formatHomeRelativePath(projectRoot);
  const tip = tips[Math.min(tipIndex, Math.max(0, tips.length - 1))] ?? tips[0];
  const panelWidth = compact ? undefined : Math.min(width, 72);

  return (
    <Box flexDirection="column" marginY={1}>
      <Box flexDirection="column" width={panelWidth}>
        <Box flexDirection='column' paddingX={1}>
          <Box
            flexDirection="column"
            justifyContent="center"
            paddingX={1}
          >
            <Box justifyContent="center" width={compact ? undefined : TITLE_PANEL_WIDTH}>
              <ThemedGradient>
                ██████╗ ███████╗███████╗██████╗      ██████╗ ██████╗ ██████╗ ███████╗
                ██╔══██╗██╔════╝██╔════╝██╔══██╗    ██╔════╝██╔═══██╗██╔══██╗██╔════╝
                ██║  ██║█████╗  █████╗  ██████╔╝    ██║     ██║   ██║██║  ██║█████╗
                ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝     ██║     ██║   ██║██║  ██║██╔══╝
                ██████╔╝███████╗███████╗██║         ╚██████╗╚██████╔╝██████╔╝███████╗
                ╚═════╝ ╚══════╝╚══════╝╚═╝          ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝
              </ThemedGradient>
            </Box>
          </Box>

          <Box
            borderStyle={"round"}
            borderColor={"#229ac3e6"}
            flexDirection="column"
            flexGrow={1}
            height={compact ? undefined : PANEL_CONTENT_HEIGHT}
            marginTop={compact ? 1 : 0}
            paddingX={1}
          >
            <Box flexGrow={1} marginBottom={compact ? 1 : 0}>
              <Text color={"#229ac3e6"}>{">"}_ Deep Code </Text>
              <Text color='gray'> (v{version || "unknown"})</Text>
            </Box>
            {!compact ? <Text> </Text> : null}
            <SettingRow label={t("welcome_label_model")} value={settings.model} />
            <SettingRow label={t("welcome_label_thinking")} value={String(settings.thinkingEnabled)} />
            <SettingRow label={t("welcome_label_effort")} value={settings.reasoningEffort} />
            <SettingRow label={t("welcome_label_cwd")} value={cwd} />
          </Box>
        </Box>
      </Box>

      {tip ? (
        <Box marginTop={1}>
          <Text dimColor>
            {t("welcome_tips_prefix")}{tip.label} - {tip.description}
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}

function SettingRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <Box flexDirection="row">
      <Box width={20}>
        <Text>{label}</Text>
      </Box>
      <Box flexGrow={1} justifyContent="flex-end">
        <Text>{value}</Text>
      </Box>
    </Box>
  );
}

export function formatHomeRelativePath(value: string, home = os.homedir()): string {
  const normalizedValue = path.resolve(value);
  const normalizedHome = path.resolve(home);
  const relative = path.relative(normalizedHome, normalizedValue);

  if (relative === "") {
    return "~";
  }
  if (!relative.startsWith("..") && !path.isAbsolute(relative)) {
    return `~${path.sep}${relative}`;
  }
  return normalizedValue;
}

export function buildWelcomeTips(skills: SkillInfo[]): Array<{ label: string; description: string }> {
  const slashTips = buildSlashCommands(skills)
    .filter((item) => item.kind !== "skill" || item.skill?.isLoaded)
    .map((item) => ({
      label: item.label,
      description: formatSlashCommandDescription(item.description)
    }));

  return [
    ...slashTips,
    ...SHORTCUT_TIPS
      .filter((tip) => !BUILTIN_SLASH_COMMANDS.some((command) => command.label === tip.label))
      .map((tip) => ({ label: tip.label, description: t(tip.descKey as Parameters<typeof t>[0]) })),
    ...RECOMMENDED_TIPS.map((tip) => ({ label: tip.label, description: tip.description() }))
  ];
}

function randomTipIndex(length: number): number {
  return length > 0 ? Math.floor(Math.random() * length) : 0;
}
