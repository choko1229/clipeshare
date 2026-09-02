import { z } from "zod";
import { prisma } from "@/lib/db/prisma";

const contactCategorySchema = z.enum(["GENERAL", "COPYRIGHT", "PRIVACY", "BUG", "OTHER"]);

const contactMessageSchema = z.object({
  category: contactCategorySchema,
  name: z.string().trim().min(1, "お名前を入力してください。").max(100),
  email: z.string().trim().min(1, "メールアドレスを入力してください。").email("メールアドレスの形式が正しくありません。").max(200),
  subject: z.string().trim().min(1, "件名を入力してください。").max(200),
  message: z.string().trim().min(1, "本文を入力してください。").max(5000),
});

const rateLimitWindowMs = 60 * 60 * 1000;
const rateLimitMaxPerWindow = 5;

type CreateContactMessageInput = {
  category: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  userId: string | null;
  ipHash: string | null;
};

export async function createContactMessage(input: CreateContactMessageInput) {
  const parsed = contactMessageSchema.parse({
    category: input.category,
    name: input.name,
    email: input.email,
    subject: input.subject,
    message: input.message,
  });

  if (input.ipHash) {
    const recentCount = await prisma.contactMessage.count({
      where: {
        ipHash: input.ipHash,
        createdAt: {
          gte: new Date(Date.now() - rateLimitWindowMs),
        },
      },
    });

    if (recentCount >= rateLimitMaxPerWindow) {
      throw new Error("送信回数が上限に達しました。しばらく時間をおいて再度お試しください。");
    }
  }

  await prisma.contactMessage.create({
    data: {
      category: parsed.category,
      name: parsed.name,
      email: parsed.email,
      subject: parsed.subject,
      message: parsed.message,
      userId: input.userId,
      ipHash: input.ipHash,
    },
  });
}
