import { nanoid } from "nanoid";

const customStreamKeyPattern = /^[a-zA-Z0-9_-]{6,32}$/;

export function generateStreamKey() {
  return nanoid(24);
}

export function generateViewToken() {
  return nanoid(16);
}

export function isValidCustomStreamKey(value: string) {
  return customStreamKeyPattern.test(value);
}
