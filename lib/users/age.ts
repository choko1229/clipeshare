export const ADULT_AGE = 18;
export const AGE_RETRY_MONTHS = 1;

export function calculateAge(birthDate: Date, now = new Date()) {
  let age = now.getFullYear() - birthDate.getFullYear();
  const hasBirthdayPassed =
    now.getMonth() > birthDate.getMonth() || (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());

  if (!hasBirthdayPassed) {
    age -= 1;
  }

  return age;
}

export function isAdultBirthDate(birthDate: Date, now = new Date()) {
  return calculateAge(birthDate, now) >= ADULT_AGE;
}

export function canRetryAgeVerification(failedAt?: Date | null, now = new Date()) {
  if (!failedAt) {
    return true;
  }

  return now.getTime() >= nextAgeRetryAt(failedAt).getTime();
}

export function nextAgeRetryAt(failedAt: Date) {
  const next = new Date(failedAt);
  next.setMonth(next.getMonth() + AGE_RETRY_MONTHS);
  return next;
}

export function parseBirthDateInput(value: FormDataEntryValue | null) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("生年月日を入力してください。");
  }

  const birthDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(birthDate.getTime()) || birthDate > new Date()) {
    throw new Error("正しい生年月日を入力してください。");
  }

  return birthDate;
}
