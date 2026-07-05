"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth/active-user";
import { prisma } from "@/lib/db/prisma";
import { canRetryAgeVerification, isAdultBirthDate, parseBirthDateInput } from "@/lib/users/age";

export async function verifyAge(formData: FormData) {
  const user = await requireActiveUser();
  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      birthDate: true,
      ageVerificationFailedAt: true,
    },
  });

  if (!current) {
    redirect("/login");
  }

  if (current.birthDate) {
    redirect("/settings/age?status=locked");
  }

  if (!canRetryAgeVerification(current.ageVerificationFailedAt)) {
    redirect("/settings/age?status=retry_later");
  }

  const birthDate = parseBirthDateInput(formData.get("birthDate"));
  const isAdult = isAdultBirthDate(birthDate);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      birthDate,
      ageVerifiedAt: isAdult ? new Date() : null,
      ageVerificationFailedAt: isAdult ? null : new Date(),
    },
  });

  revalidatePath("/settings/age");
  revalidatePath("/settings/profile");

  if (!isAdult) {
    redirect("/settings/age?status=underage");
  }

  redirect("/settings/age?status=verified");
}
