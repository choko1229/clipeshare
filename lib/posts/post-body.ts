export function splitPostBody(input: string) {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const [firstLine = "", ...restLines] = normalized.split("\n");
  const title = firstLine.trim();
  const description = restLines.join("\n").trim();

  if (!title) {
    throw new Error("本文の1行目にタイトルを入力してください。");
  }

  if (title.length > 120) {
    throw new Error("タイトルは120文字以内にしてください。");
  }

  if (description.length > 4000) {
    throw new Error("説明文は4000文字以内にしてください。");
  }

  return {
    title,
    description,
  };
}

export function joinPostBody(title: string, description: string) {
  return description ? `${title}\n${description}` : title;
}
