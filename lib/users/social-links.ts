export type SocialLinkType = "discord" | "x" | "youtube" | "misskey" | "instagram" | "steam" | "twitch" | "github" | "vrc" | "website" | "other";

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

  if (hostname === "twitch.tv" || hostname.endsWith(".twitch.tv")) {
    return "twitch";
  }

  if (hostname === "github.com" || hostname.endsWith(".github.com")) {
    return "github";
  }

  if (hostname === "vrchat.com" || hostname.endsWith(".vrchat.com") || hostname === "vrc.group") {
    return "vrc";
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
    case "twitch":
      return "Twitch";
    case "github":
      return "GitHub";
    case "vrc":
      return "VRChat";
    case "steam":
      return "Steam";
    case "website":
      return "Website";
    default:
      return "Other";
  }
}

export function socialUsernameUrl(type: "instagram" | "twitch" | "x" | "youtube", username: string) {
  const normalized = username.trim().replace(/^@/, "");

  if (!normalized) {
    return null;
  }

  switch (type) {
    case "x":
      return `https://x.com/${normalized}`;
    case "youtube":
      return normalized.startsWith("@") ? `https://www.youtube.com/${normalized}` : `https://www.youtube.com/@${normalized}`;
    case "twitch":
      return `https://www.twitch.tv/${normalized}`;
    case "instagram":
      return `https://www.instagram.com/${normalized}`;
  }
}

function safeHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}
