import { prisma } from "@/lib/db/prisma";

type ModerationRuleRecord = {
  id: string;
  type: string;
  pattern: string;
  action: string;
};

export type ModerationMatch = {
  ruleId: string;
  type: string;
  action: string;
  pattern: string;
};

export type ModerationResult = {
  blocked: ModerationMatch[];
  reportable: ModerationMatch[];
};

function normalize(value: string) {
  return value.toLocaleLowerCase().normalize("NFKC");
}

function isRegexRule(type: string) {
  const normalizedType = normalize(type);
  return normalizedType === "blocked_pattern" || normalizedType === "pattern" || normalizedType === "regex";
}

function matchesRule(text: string, rule: ModerationRuleRecord) {
  const pattern = rule.pattern.trim();

  if (!pattern) {
    return false;
  }

  if (isRegexRule(rule.type)) {
    try {
      return new RegExp(pattern, "i").test(text);
    } catch {
      return false;
    }
  }

  return normalize(text).includes(normalize(pattern));
}

export async function checkModerationRules(text: string): Promise<ModerationResult> {
  const rules = await prisma.moderationRule.findMany({
    where: {
      isActive: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const matches = rules
    .filter((rule) => matchesRule(text, rule))
    .map((rule) => ({
      ruleId: rule.id,
      type: rule.type,
      action: rule.action,
      pattern: rule.pattern,
    }));

  return {
    blocked: matches.filter((match) => normalize(match.action) === "block"),
    reportable: matches.filter((match) => normalize(match.action) === "report"),
  };
}

export async function assertNotBlockedByModerationRules(text: string) {
  const result = await checkModerationRules(text);

  if (result.blocked.length === 0) {
    return result;
  }

  throw new Error("投稿内容がモデレーションルールに一致したため送信できません。");
}

export function moderationReportDetail(matches: ModerationMatch[]) {
  return matches.map((match) => `${match.type}:${match.pattern}`).join("\n").slice(0, 1000);
}
