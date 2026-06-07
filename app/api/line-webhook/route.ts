import { NextRequest, NextResponse } from "next/server";
import { validateSignature, messagingApi } from "@line/bot-sdk";
import { getFaq } from "@/lib/sheet";
import { askGemini } from "@/lib/gemini";

export const runtime = "nodejs";
export const maxDuration = 15;

const DEFAULT_REPLY =
  "ขออภัยค่ะ ส่วนนี้แอดมินขอให้ทีมงานติดต่อกลับเพื่อให้ข้อมูลที่ถูกต้องนะคะ 🙏 รบกวนทิ้งเบอร์หรือรอสักครู่ เดี๋ยวมีเจ้าหน้าที่มาดูแลต่อค่ะ";

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
});

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const isValid = validateSignature(
    rawBody,
    process.env.LINE_CHANNEL_SECRET!,
    signature
  );

  if (!isValid) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = JSON.parse(rawBody);
  const events: unknown[] = body.events ?? [];

  for (const event of events) {
    const e = event as Record<string, unknown>;
    if (e.type !== "message") continue;

    const message = e.message as Record<string, unknown> | undefined;
    if (!message || message.type !== "text") continue;

    const userText = message.text as string;
    const replyToken = e.replyToken as string;

    let replyText = DEFAULT_REPLY;

    try {
      const faqCsv = await getFaq();
      replyText = await askGemini(faqCsv, userText);
    } catch (err) {
      console.error("[webhook] pipeline error:", err);
    }

    try {
      await client.replyMessage({
        replyToken,
        messages: [{ type: "text", text: replyText }],
      });
    } catch (err) {
      console.error("[webhook] reply failed:", err);
    }
  }

  return new NextResponse("OK", { status: 200 });
}
