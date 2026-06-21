import path from "node:path";

export const mediaPaths = {
  processedRoot: path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads", "processed"),
  originalRoot: path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads", "originals"),
  tempRoot: path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "temp"),
  deletedRoot: path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "deleted"),
};

export function assertInside(root: string, target: string) {
  const resolvedRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), root);
  const resolvedTarget = path.resolve(target);

  if (!resolvedTarget.startsWith(resolvedRoot)) {
    throw new Error("Resolved file path escapes configured storage root.");
  }

  return resolvedTarget;
}
