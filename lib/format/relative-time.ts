/** 「5分前」「3日前」形式(日本語)。未来の時刻は「たった今」扱い */
export function formatRelativeTimeJa(date: Date, now: Date = new Date()) {
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));

  if (diffSeconds < 60) {
    return "たった今";
  }

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return `${minutes}分前`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}時間前`;
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `${days}日前`;
  }

  return date.toLocaleDateString("ja-JP");
}
