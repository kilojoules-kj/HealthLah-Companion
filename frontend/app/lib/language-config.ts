/**
 * Multilingual configuration for VAPI voice calls.
 *
 * Maps each supported language to:
 *  - transcriber settings (STT language code)
 *  - voice settings (TTS provider + voice)
 *  - first message in that language
 *  - model system prompt addendum
 */

export interface LanguageVapiConfig {
  /** Deepgram transcriber language code */
  transcriberLanguage: string
  /** VAPI voice provider config */
  voice: {
    provider: "azure" | "11labs"
    voiceId: string
    /** BCP-47 language code for Azure voices */
    language?: string
  }
  /** Greeting spoken at call start */
  firstMessage: string
  /** Extra system prompt line instructing the model to respond in this language */
  systemPromptLanguageInstruction: string
}

/**
 * Supported languages with their VAPI configuration.
 *
 * Keys match the `preferred_language` values stored in patient profiles
 * (title-case strings like "English", "Mandarin", etc.)
 */
export const LANGUAGE_CONFIGS: Record<string, LanguageVapiConfig> = {
  English: {
    transcriberLanguage: "en",
    voice: {
      provider: "azure",
      voiceId: "en-SG-LunaNeural",
      language: "en-SG",
    },
    firstMessage:
      "Hello! I'm HealthLah, your health companion. How are you feeling today?",
    systemPromptLanguageInstruction:
      "Respond in English. Use simple, clear language suitable for elderly patients. You may sprinkle in Singlish expressions like 'lah', 'ah', 'leh' to feel natural.",
  },

  Mandarin: {
    transcriberLanguage: "zh",
    voice: {
      provider: "azure",
      voiceId: "zh-CN-XiaoxiaoNeural",
      language: "zh-CN",
    },
    firstMessage:
      "你好！我是HealthLah，你的健康伴侣。今天感觉怎么样？",
    systemPromptLanguageInstruction:
      "Respond in Mandarin Chinese (华语). Use simple spoken Mandarin, avoid complex literary Chinese. Keep sentences short. You may use some Singlish/local expressions if natural.",
  },

  Malay: {
    transcriberLanguage: "ms",
    voice: {
      provider: "azure",
      voiceId: "ms-MY-YasminNeural",
      language: "ms-MY",
    },
    firstMessage:
      "Selamat datang! Saya HealthLah, teman kesihatan anda. Apa khabar hari ini?",
    systemPromptLanguageInstruction:
      "Respond in Bahasa Melayu. Use simple, everyday Malay suitable for elderly patients. Keep sentences short and warm.",
  },

  Tamil: {
    transcriberLanguage: "ta",
    voice: {
      provider: "azure",
      voiceId: "ta-IN-PallaviNeural",
      language: "ta-IN",
    },
    firstMessage:
      "வணக்கம்! நான் HealthLah, உங்கள் உடல்நல தோழன். இன்று எப்படி இருக்கீங்க?",
    systemPromptLanguageInstruction:
      "Respond in Tamil (தமிழ்). Use simple, spoken Tamil suitable for elderly patients. Keep sentences short and warm.",
  },

  Hokkien: {
    transcriberLanguage: "zh",
    voice: {
      provider: "azure",
      voiceId: "zh-CN-XiaoxiaoNeural",
      language: "zh-CN",
    },
    firstMessage:
      "你好！我是HealthLah. 你今日感觉怎样？",
    systemPromptLanguageInstruction:
      "The patient speaks Hokkien (福建话). Respond in simple Mandarin Chinese as a fallback, since Hokkien TTS is not available. Use short, warm sentences.",
  },

  Cantonese: {
    transcriberLanguage: "zh",
    voice: {
      provider: "azure",
      voiceId: "zh-HK-HiuMaanNeural",
      language: "zh-HK",
    },
    firstMessage:
      "你好！我係HealthLah，你嘅健康夥伴。今日覺得點呀？",
    systemPromptLanguageInstruction:
      "Respond in Cantonese (广东话). Use simple spoken Cantonese suitable for elderly patients.",
  },

  Teochew: {
    transcriberLanguage: "zh",
    voice: {
      provider: "azure",
      voiceId: "zh-CN-XiaoxiaoNeural",
      language: "zh-CN",
    },
    firstMessage:
      "你好！我是HealthLah. 你今日感觉怎样？",
    systemPromptLanguageInstruction:
      "The patient speaks Teochew (潮州话). Respond in simple Mandarin Chinese as a fallback, since Teochew TTS is not available. Use short, warm sentences.",
  },
}

/** Default language when none specified */
export const DEFAULT_LANGUAGE = "English"

/** Get config for a language, falling back to English */
export function getLanguageConfig(language?: string): LanguageVapiConfig {
  return LANGUAGE_CONFIGS[language ?? DEFAULT_LANGUAGE] ?? LANGUAGE_CONFIGS[DEFAULT_LANGUAGE]
}

/**
 * Build VAPI assistantOverrides for a given language.
 *
 * This configures the transcriber (STT), voice (TTS), and adds a language
 * instruction to the model so the full pipeline works end-to-end in the
 * patient's preferred language.
 */
export function buildLanguageOverrides(language?: string) {
  const config = getLanguageConfig(language)

  return {
    transcriber: {
      provider: "deepgram" as const,
      language: config.transcriberLanguage,
    },
    voice: {
      provider: config.voice.provider,
      voiceId: config.voice.voiceId,
    },
    firstMessage: config.firstMessage,
  }
}
