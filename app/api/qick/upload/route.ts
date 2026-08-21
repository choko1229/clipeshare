import { NextResponse } from "next/server";
import { actionErrorMessage } from "@/lib/actions/error-message";
import { createQuickShareFromFormData } from "@/lib/quick-share/create-quick-share";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const redirectUrl = await createQuickShareFromFormData(formData);
    return NextResponse.json({ redirectUrl });
  } catch (error) {
    return NextResponse.json({ error: actionErrorMessage(error) }, { status: 400 });
  }
}
