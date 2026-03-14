import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: Request) {
  try {
    const { prompt, whatIKnow, whereStuck, myHypothesis, differenceFromLast, aiAnswer, mySummary3lines, firstStepToReproduce } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Return 200 with an indication that the feature is disabled so the frontend can handle it gracefully.
      return NextResponse.json({ disabled: true, message: "Gemini API key is not configured." }, { status: 200 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // The logic to extract 4 fields: golden_prompt, outcome, tips, user_memo
    const systemInstruction = `あなたは超優秀なエンジニアリングマネージャー兼AI活用アドバイザーです。
ユーザーが「自分の前提」「つまずき」「仮説」「前回からの差分」「AIの回答」「3行サマリー」「最初の一手」を入力したログが送信されます。
このログを分析し、以下の4つの要素を抽出し、指定されたJSONフォーマットのみを出力してください。

1. "golden_prompt": ユーザーが次回以降、同じような問題に直面したときに、AIから最高品質の回答を引き出せる「再利用可能なプロンプトの型」。
2. "outcome": 今回の相談を通じて、ユーザーが最終的に得た「具体的な成果や気付き」を1〜2文で。
3. "tips": AI（LLM）との対話において、今回ユーザーが無意識に使っていた良い聞き方、または今後役立つ「AI使いこなしのコツ」。
4. "user_memo": 今回のログ全体から読み取れる、ユーザー自身の思考の癖や傾向についての客観的なメモ。`;

    const userPromptText = `
【ユーザー入力ログ】
前提: ${whatIKnow}
つまずき: ${whereStuck}
仮説: ${myHypothesis}
前回からの差分: ${differenceFromLast}

【AIの回答】
${aiAnswer}

【ユーザー自身のまとめ】
3行サマリー: ${mySummary3lines}
最初の一手: ${firstStepToReproduce}

【追加要望】
${prompt || "特になし"}
    `.trim();

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: userPromptText,
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: "OBJECT",
          properties: {
            golden_prompt: { type: "STRING" },
            outcome: { type: "STRING" },
            tips: { type: "STRING" },
            user_memo: { type: "STRING" }
          },
          required: ["golden_prompt", "outcome", "tips", "user_memo"]
        }
      }
    });

    // Safeguard response.text access
    let text = "";
    const res = response as any;
    if (res && res.response && typeof res.response.text === 'function') {
      text = res.response.text();
    } else if (res && typeof res.text === 'function') {
      text = res.text();
    } else if (res && res.text) {
      text = res.text;
    }

    if (!text) {
      throw new Error("Empty or invalid response from AI");
    }
    const result = JSON.parse(text);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to process AI request" }, { status: 500 });
  }
}
