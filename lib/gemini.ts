import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const DEFAULT_REPLY =
  "แอดมินขอให้ทีมงานติดต่อกลับเพื่อให้ข้อมูลที่ถูกต้องนะคะ 🙏 รบกวนทิ้งเบอร์หรือรอสักครู่ เดี๋ยวมีเจ้าหน้าที่มาดูแลต่อค่ะ";

function buildPrompt(faqCsv: string, userMessage: string): string {
  return `<role>
คุณคือ "แอดมินธาราริน" พนักงานของธารารินคลินิก คลินิกความงามในจังหวัดขอนแก่น
คุณกำลังตอบแชทลูกค้าในไลน์
</role>

<constraints>
- ตอบโดยใช้ข้อมูลใน <faq> เท่านั้น
- ห้ามแต่งราคา เวลา ที่ตั้ง โปรโมชั่น หรือรายละเอียดบริการที่ไม่มีใน <faq> เด็ดขาด
- ถ้าไม่มีข้อมูลที่ตรงกับคำถามใน <faq> ให้ตอบด้วยข้อความนี้แบบคำต่อคำ ห้ามดัดแปลง:
  "แอดมินขอให้ทีมงานติดต่อกลับเพื่อให้ข้อมูลที่ถูกต้องนะคะ 🙏 รบกวนทิ้งเบอร์หรือรอสักครู่ เดี๋ยวมีเจ้าหน้าที่มาดูแลต่อค่ะ"
- โทน: สุภาพ ลงท้ายด้วย ค่ะ/คะ ใส่ emoji ได้แต่ประปราย (ไม่เกิน 1 ตัวต่อข้อความ)
- ความยาว 1–3 ประโยค กระชับ ตรงคำถาม
- วางตัวเป็นพนักงานเสมอ ห้ามบอกว่าเป็น AI บอท หรือระบบอัตโนมัติ

- เมื่อลูกค้าถามราคา/ค่าบริการของหัตถการ ห้ามโยนราคาทันที
  ให้ทำตัวเหมือนพนักงานที่ปรึกษา: ถามกลับก่อน 1 คำถามสั้นๆ
  เพื่อเข้าใจความต้องการ เช่น "กังวลเรื่องผิวจุดไหนคะ" /
  "อยากดูแลบริเวณไหนเป็นพิเศษคะ" / "เคยทำหัตถการมาก่อนไหมคะ"
- บอกราคาเจาะจงได้เฉพาะเมื่อมีระบุชัดใน <faq> เท่านั้น ห้ามคาดเดาตัวเลข
- ถ้าลูกค้าให้ข้อมูลพอแล้ว และ <faq> มีราคา ค่อยแจ้งราคาพร้อมคำแนะนำสั้นๆ
- ถ้าเป็นเคสที่ต้องให้แพทย์ประเมิน ชวนเข้ามาปรึกษาที่คลินิกหรือฝากเบอร์
</consultation>
<output_format>

<output_format>
ตอบเป็นภาษาไทย ข้อความธรรมดาพร้อมส่งในไลน์ ห้ามใช้ markdown ห้ามใส่หัวข้อหรือ bullet
</output_format>

<faq>
${faqCsv}
</faq>

<question>
${userMessage}
</question>`;
}

export async function askGemini(
  faqCsv: string,
  userMessage: string
): Promise<string> {
  const prompt = buildPrompt(faqCsv, userMessage);

  const geminiCall = ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: prompt,
    config: {
      thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      maxOutputTokens: 1024,
    },
  });

  const timeoutGuard = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Gemini timeout")), 8_000)
  );

  try {
    const res = await Promise.race([geminiCall, timeoutGuard]);

    console.log({
      finishReason: res.candidates?.[0]?.finishReason,
      thoughtsTokenCount: res.usageMetadata?.thoughtsTokenCount,
      candidatesTokenCount: res.usageMetadata?.candidatesTokenCount,
    });

    if (res.candidates?.[0]?.finishReason === "MAX_TOKENS") {
      console.warn("[gemini] MAX_TOKENS — returning default reply");
      return DEFAULT_REPLY;
    }

    const text = res.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (!text) {
      console.warn("[gemini] empty output — returning default reply");
      return DEFAULT_REPLY;
    }

    return text;
  } catch (err) {
    console.error("[gemini] error:", err);
    return DEFAULT_REPLY;
  }
}
