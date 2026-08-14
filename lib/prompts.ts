import { assertValidPromptPair } from "./conditions";
import { languages, type LanguageCode } from "./languages";
import type { Condition, TaskType } from "./schemas";

const nativeInstructions: Record<Exclude<LanguageCode, "en">, string> = {
  hi: "आप नैतिक निर्णय पर एक शोध अध्ययन में भाग ले रहे हैं। परिदृश्य को ध्यान से पढ़ें। अपने तर्क पर हिन्दी में विचार करें और केवल हिन्दी में उत्तर दें।",
  bn: "আপনি নৈতিক বিচার নিয়ে একটি গবেষণা অধ্যয়নে অংশ নিচ্ছেন। পরিস্থিতিটি মনোযোগ দিয়ে পড়ুন। বাংলায় আপনার যুক্তি ভাবুন এবং শুধু বাংলায় উত্তর দিন।",
  ta: "நீங்கள் அறநெறி தீர்ப்புகள் குறித்த ஆய்வு ஒன்றில் பங்கேற்கிறீர்கள். சூழ்நிலையை கவனமாக வாசிக்கவும். உங்கள் காரணத்தை தமிழில் சிந்தித்து தமிழில் மட்டும் பதிலளிக்கவும்.",
  es: "Estás participando en un estudio de investigación sobre el juicio moral. Lee el escenario con atención. Piensa tu razonamiento en español y responde solo en español.",
  ja: "あなたは道徳判断に関する研究に参加しています。シナリオを注意深く読んでください。日本語で理由を考え、日本語のみで回答してください。",
  ar: "أنت تشارك في دراسة بحثية حول الحكم الأخلاقي. اقرأ السيناريو بعناية. فكّر في حجتك باللغة العربية وأجب باللغة العربية فقط."
};

export function getSystemPrompt(inputLang: LanguageCode, reasoningLang: LanguageCode): string {
  assertValidPromptPair(inputLang, reasoningLang);

  if (inputLang === "en") {
    return "You are participating in a research study on moral judgment. Read the scenario carefully and think through your reasoning in English. Respond in English only.";
  }

  if (reasoningLang === "en") {
    return `The scenario below is written in ${languages[inputLang].name}. Read it carefully, but think through your reasoning in English and respond in English only.`;
  }

  return nativeInstructions[inputLang];
}

export function allSystemPrompts() {
  return [
    { inputLang: "en" as const, reasoningLang: "en" as const, prompt: getSystemPrompt("en", "en") },
    ...(["hi", "bn", "ta", "es", "ja", "ar"] as const).flatMap((lang) => [
      { inputLang: lang, reasoningLang: "en" as const, prompt: getSystemPrompt(lang, "en") },
      { inputLang: lang, reasoningLang: lang, prompt: getSystemPrompt(lang, lang) }
    ])
  ];
}

const ratingInstructions: Record<LanguageCode, string> = {
  en: "Give a single integer blameworthiness rating from 1 to 7, where 1 means not blameworthy at all and 7 means extremely blameworthy. Respond with only the number and no other text.",
  hi: "1 से 7 तक केवल एक पूर्णांक दोषारोपण रेटिंग दें, जहाँ 1 का अर्थ बिल्कुल दोषी नहीं और 7 का अर्थ अत्यंत दोषी है। केवल संख्या लिखें, कोई अन्य पाठ नहीं।",
  bn: "১ থেকে ৭ পর্যন্ত একটি মাত্র পূর্ণসংখ্যা দোষযোগ্যতার রেটিং দিন, যেখানে ১ মানে একেবারেই দোষযোগ্য নয় এবং ৭ মানে অত্যন্ত দোষযোগ্য। শুধু সংখ্যাটি লিখুন, অন্য কোনো লেখা নয়।",
  ta: "1 முதல் 7 வரை ஒரு முழு எண் குற்றப்பொறுப்பு மதிப்பீட்டை மட்டும் அளிக்கவும்; 1 என்பது குற்றப்பொறுப்பு இல்லை என்பதையும் 7 என்பது மிகவும் குற்றப்பொறுப்பு என்பதையும் குறிக்கும். எண்ணை மட்டும் எழுதவும்.",
  es: "Da una única calificación entera de culpabilidad del 1 al 7, donde 1 significa nada culpable y 7 extremadamente culpable. Responde solo con el número y ningún otro texto.",
  ja: "非難に値する度合いを1から7までの整数で1つだけ答えてください。1はまったく非難に値しない、7は非常に非難に値することを意味します。数字だけを回答してください。",
  ar: "أعط تقييما واحدا صحيحا لمدى اللوم من 1 إلى 7، حيث يعني 1 أنه لا يستحق اللوم إطلاقا و7 أنه يستحق اللوم بشدة. أجب بالرقم فقط دون أي نص آخر."
};

const qualitativeInstructions: Record<LanguageCode, string> = {
  en: "In 2-3 sentences, explain why the action is morally right or wrong.",
  hi: "2-3 वाक्यों में समझाएँ कि यह कार्य नैतिक रूप से सही या गलत क्यों है।",
  bn: "২-৩টি বাক্যে ব্যাখ্যা করুন কাজটি নৈতিকভাবে সঠিক না ভুল কেন।",
  ta: "2-3 வாக்கியங்களில் இந்த செயல் அறநெறி ரீதியாக சரியா தவறா என்பதை விளக்கவும்.",
  es: "En 2-3 oraciones, explica por qué la acción es moralmente correcta o incorrecta.",
  ja: "2〜3文で、その行為が道徳的に正しいか間違っているかを説明してください。",
  ar: "في جملتين إلى ثلاث جمل، اشرح لماذا يكون الفعل صحيحا أو خاطئا أخلاقيا."
};

export function buildUserPrompt(scenarioText: string, reasoningLang: LanguageCode, taskType: TaskType) {
  const instruction = taskType === "rating" ? ratingInstructions[reasoningLang] : qualitativeInstructions[reasoningLang];
  return `${scenarioText}\n\n${instruction}`;
}

export function buildMessages(condition: Condition, scenarioText: string, taskType: TaskType) {
  return [
    { role: "system" as const, content: getSystemPrompt(condition.inputLang, condition.reasoningLang) },
    { role: "user" as const, content: buildUserPrompt(scenarioText, condition.reasoningLang, taskType) }
  ];
}
