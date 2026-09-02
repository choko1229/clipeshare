"use server";

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { errorRedirectUrl, rethrowRedirectError } from "@/lib/actions/error-message";
import { createContactMessage } from "@/lib/contact/create-contact-message";
import { getClientIpHash } from "@/lib/quick-share/ip-hash";

export async function submitContactMessage(formData: FormData) {
  const honeypot = formData.get("website");
  if (typeof honeypot === "string" && honeypot.trim().length > 0) {
    redirect("/contact?success=1");
  }

  try {
    const session = await getServerSession(authOptions);
    const ipHash = await getClientIpHash();

    await createContactMessage({
      category: (formData.get("category") as string) || "GENERAL",
      name: (formData.get("name") as string) || "",
      email: (formData.get("email") as string) || "",
      subject: (formData.get("subject") as string) || "",
      message: (formData.get("message") as string) || "",
      userId: session?.user?.id ?? null,
      ipHash,
    });
  } catch (error) {
    rethrowRedirectError(error);
    redirect(errorRedirectUrl("/contact", error));
  }

  redirect("/contact?success=1");
}
