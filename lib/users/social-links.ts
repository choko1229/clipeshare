export type SocialLinkType = "discord" | "x" | "youtube" | "misskey" | "instagram" | "steam" | "website" | "other";

export function inferSocialLinkType(url: string): SocialLinkType {
  const hostname = safeHostname(url);

  if (!hostname) {
    return "other";
  }

  if (hostname === "x.com" || hostname === "twitter.com" || hostname.endsWith(".x.com") || hostname.endsWith(".twitter.com")) {
    return "x";
  }

  if (hostname === "discord.gg" || hostname === "discord.com" || hostname.endsWith(".discord.com")) {
    return "discord";
  }

  if (hostname === "youtube.com" || hostname === "youtu.be" || hostname.endsWith(".youtube.com")) {
    return "youtube";
  }

  if (hostname === "instagram.com" || hostname.endsWith(".instagram.com")) {
    return "instagram";
  }

  if (hostname === "steamcommunity.com" || hostname === "store.steampowered.com" || hostname.endsWith(".steamcommunity.com")) {
    return "steam";
  }

  if (hostname.includes("misskey") || hostname.endsWith(".social") || hostname.endsWith(".io")) {
    return "misskey";
  }

  return "website";
}

export function socialLinkTypeLabel(type: string) {
  switch (type) {
    case "x":
      return "X";
    case "discord":
      return "Discord";
    case "youtube":
      return "YouTube";
    case "misskey":
      return "Misskey";
    case "instagram":
      return "Instagram";
    case "steam":
      return "Steam";
    case "website":
      return "Website";
    default:
      return "Other";
  }
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
