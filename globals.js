/**
 * Hier habe ich meine Sammlung von Gemini API-Keys hinterlegt. Sie sind komplett kostenlos. Wenn du sie klauen willst, wirst du dir dadurch keine Vorteile verschaffen, hohl dir einfach einen eigenen auf aistudio.google.com.
 * Durch das Wechseln dieser Schlüssel umgehe ich die Rate-Limits (Anfragen pro Minute/Tag) der API,
 * was die Anwendung robuster macht.
 */
// ENTFERNT: Die hartcodierten API-Schlüssel wurden aus Sicherheitsgründen entfernt.
// const GEMINI_API_KEYS = [ ... ];

/**
 * API-Endpunkte und Konfigurationen für alle Provider
 */
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const CUSTOM_SEARCH_API_KEY = "AIzaSyBsWxcHKSM6wWIhyc5VyCBIVJ5uQUyJyyQ";
const CUSTOM_SEARCH_ENGINE_ID = "64c5966cc634a4e06";
const CUSTOM_SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1";

/**
 * Verfügbare KI-Modelle aller Provider (Stand: Februar 2026)
 * Basierend auf den offiziellen API-Dokumentationen
 */
const MODELS = {
    // Google Gemini Modelle (neueste 3er und 2.5er Serie)
    "gemini-3-pro": {
        "id": "gemini-3-pro",
        "name": "Gemini 3 Pro",
        "emoji": "💎",
        "provider": "gemini",
        "capabilities": ["text", "vision", "search"],
        "rpm": 10,
        "rpd": 500,
        "description": "Googles stärkstes Modell (Preview)"
    },
    "gemini-3-flash": {
        "id": "gemini-3-flash",
        "name": "Gemini 3 Flash",
        "emoji": "⚡",
        "provider": "gemini",
        "capabilities": ["text", "vision", "search"],
        "rpm": 15,
        "rpd": 1000,
        "description": "Schnelles Multimodal-Modell (Preview)"
    },
    "gemini-2.5-pro": {
        "id": "gemini-2.5-pro",
        "name": "Gemini 2.5 Pro",
        "emoji": "🔷",
        "provider": "gemini",
        "capabilities": ["text", "vision", "search"],
        "rpm": 10,
        "rpd": 500,
        "description": "Starkes Modell für komplexe Aufgaben"
    },
    "gemini-2.5-flash": {
        "id": "gemini-2.5-flash",
        "name": "Gemini 2.5 Flash",
        "emoji": "⚡",
        "provider": "gemini",
        "capabilities": ["text", "vision", "search"],
        "rpm": 15,
        "rpd": 1000,
        "description": "Schnelles Modell für alltägliche Aufgaben"
    },
    "gemini-2.5-flash-lite": {
        "id": "gemini-2.5-flash-lite",
        "name": "Gemini 2.5 Flash Lite",
        "emoji": "🪶",
        "provider": "gemini",
        "capabilities": ["text", "search"],
        "rpm": 20,
        "rpd": 2000,
        "description": "Leichtes, schnelles Modell"
    },

    // Groq Modelle (ultraschnelle Inference)
    "groq-llama-3.3-70b": {
        "id": "llama-3.3-70b-versatile",
        "name": "Llama 3.3 70B",
        "emoji": "🚀",
        "provider": "groq",
        "capabilities": ["text"],
        "rpm": 30,
        "rpd": 14400,
        "description": "Meta's neuestes Modell auf Groq"
    },
    "groq-llama-3.1-8b": {
        "id": "llama-3.1-8b-instant",
        "name": "Llama 3.1 8B",
        "emoji": "⚡",
        "provider": "groq",
        "capabilities": ["text"],
        "rpm": 30,
        "rpd": 14400,
        "description": "Extrem schnelles kleines Modell"
    },
    "groq-llama-4-scout": {
        "id": "meta-llama/llama-4-scout-17b-16e-instruct",
        "name": "Llama 4 Scout",
        "emoji": "🔮",
        "provider": "groq",
        "capabilities": ["text"],
        "rpm": 30,
        "rpd": 14400,
        "description": "Meta's Llama 4 (Preview)"
    },
    "groq-qwen3": {
        "id": "qwen/qwen3-32b",
        "name": "Qwen 3 32B",
        "emoji": "🐉",
        "provider": "groq",
        "capabilities": ["text"],
        "rpm": 30,
        "rpd": 14400,
        "description": "Alibabas Qwen 3 (Preview)"
    },

    // Cerebras Modelle (Fallback-Provider - extrem schnell)
    "cerebras-llama-3.3-70b": {
        "id": "llama-3.3-70b",
        "name": "Llama 3.3 70B",
        "emoji": "🔥",
        "provider": "cerebras",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 50000,
        "description": "Schnelles Modell für Fallback"
    },
    "cerebras-llama-3.1-8b": {
        "id": "llama-3.1-8b",
        "name": "Llama 3.1 8B",
        "emoji": "⚡",
        "provider": "cerebras",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 50000,
        "description": "Ultraschnelles kleines Modell"
    },

    // NVIDIA NIM Modelle (viele Top-Modelle verfügbar)
    "nvidia-llama-3.3-70b": {
        "id": "meta/llama-3.3-70b-instruct",
        "name": "Llama 3.3 70B",
        "emoji": "🤖",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Meta's neuestes Open-Source-Modell"
    },
    "nvidia-deepseek-v3.2": {
        "id": "deepseek-ai/deepseek-v3.2",
        "name": "DeepSeek V3.2",
        "emoji": "🌟",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Chinesisches Top-Modell für Reasoning"
    },
    "nvidia-deepseek-r1": {
        "id": "deepseek-ai/deepseek-r1-distill-qwen-32b",
        "name": "DeepSeek R1",
        "emoji": "🧠",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Reasoning-Modell für komplexe Aufgaben"
    },
    "nvidia-qwen3-235b": {
        "id": "qwen/qwen3-235b-a22b",
        "name": "Qwen 3 235B",
        "emoji": "🐲",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Alibabas größtes Modell"
    },
    "nvidia-qwen3-coder": {
        "id": "qwen/qwen3-coder-480b-a35b-instruct",
        "name": "Qwen 3 Coder 480B",
        "emoji": "💻",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Spezialisiert auf Coding"
    },
    "nvidia-mistral-large": {
        "id": "mistralai/mistral-large",
        "name": "Mistral Large",
        "emoji": "🌫️",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Mistrals stärkstes Modell"
    },
    "nvidia-mixtral-8x22b": {
        "id": "mistralai/mixtral-8x22b-instruct",
        "name": "Mixtral 8x22B",
        "emoji": "🌀",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Moiré-Architektur von Mistral"
    }
};

/**
 * Provider-Reihenfolge für automatisches Fallback
 * Bei Error/Timeout wird zum nächsten Provider gewechselt
 */
const PROVIDER_FALLBACK_ORDER = ['gemini', 'groq', 'nvidia', 'cerebras'];

/**
 * Fallback-Modell (wird bei Fehlern verwendet)
 */
const FALLBACK_MODEL = 'cerebras-llama-3.3-70b';

/**
 * Timeout für API-Aufrufe in Millisekunden
 */
const API_TIMEOUT_MS = 30000; // 30 Sekunden

/**
 * Diese Schlüssel habe ich definiert, um konsistente Bezeichnungen für die Speicherung
 * von Einstellungen in der IndexedDB zu gewährleisten. Das verhindert Tippfehler.
 */
const SETTING_KEYS = {
    LAST_PROFILE: 'lastActiveProfile',
    API_KEYS: 'providerApiKeys', // NEU: Provider-basierte Keys
    ACCENT_COLOR: 'accentColor',
    THEME: 'theme',
    AUTO_SEARCH: 'autoSearch',
    VOICE_RATE: 'voiceRate',
    VOICE_PITCH: 'voicePitch',
    VOICE_NAME: 'voiceName',
    TEMPERATURE: 'temperature',
    TOP_P: 'topP'
};

// --- GLOBALE ZUSTANDS-VARIABLEN ---
// Diese Variablen speichern den aktuellen Zustand der Anwendung.

// API-Key Management (NEU: Ein Key pro Provider, kein Rotieren mehr)
let providerApiKeys = {
    gemini: '',
    groq: '',
    cerebras: '',
    nvidia: ''
};

// Fallback-Status
let isFallbackActive = false;
let fallbackReason = '';
let originalModel = null;

// Profildaten
let profiles = {};
let currentProfileId = null;

// Aktuelle Chat-Konfiguration
let currentBot = 'bred';
let currentModel = 'gemini-2.5-flash'; // Standard: Schnelles, stabiles Gemini
let activeProjectId = null;
let currentSessionId = null;

// Anwendungsdaten
let customBots = [];
let userInterests = [];
let projects = [];
let chatSessions = [];
let allBotPersonalities = {}; // Kombiniertes Objekt aus Standard- und Custom-Bots
let chatHistory = [];
let uploadedFile = null;
let isAutoSearchEnabled = true;
let projectModalFiles = [];
let historyDisplayCount = 3;
let knowledgeChunks = []; // Für das interne RAG-System

// Chat-Konfiguration
let temperature = 0.7;
let topP = 0.95;

// Sprachmodus
let isVoiceModeActive = false;
let speechRecognition = null;
let voiceChatHistory = [];
let isListening = false;
let isBotSpeaking = false;
let voiceRate = 1.1;
let voicePitch = 1.0;
let germanVoices = [];
let currentVoiceName = null;

// DOM-Elemente, die häufig verwendet werden
// WICHTIG: Diese werden erst in DOMContentLoaded zugewiesen!
let voiceInterruptBtn = null;
let voiceOverlay = null;
let voiceStatus = null;
let voiceTranscript = null;
let voiceChatBtn = null;
let textarea = null;

// Konstanten für die Anwendungslogik
const MOBILE_SAFETY_DELAY = 400;
const MAX_PROJECT_FILES = 10;
