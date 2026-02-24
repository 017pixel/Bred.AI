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
 * Jedes Modell hat: id, name, emoji, provider, capabilities, rpm, rpd
 */
const MODELS = {
    // Google Gemini Modelle (neueste 2.5 Serie)
    "gemini-2.5-pro": {
        "id": "gemini-2.5-pro-preview-03-25",
        "name": "Gemini 2.5 Pro",
        "emoji": "💎",
        "provider": "gemini",
        "capabilities": ["text", "vision", "search"],
        "rpm": 10,
        "rpd": 500,
        "description": "Googles stärkstes Modell für komplexe Aufgaben"
    },
    "gemini-2.5-flash": {
        "id": "gemini-2.5-flash-preview-03-25",
        "name": "Gemini 2.5 Flash",
        "emoji": "⚡",
        "provider": "gemini",
        "capabilities": ["text", "vision", "search"],
        "rpm": 15,
        "rpd": 1000,
        "description": "Schnelles Modell für alltägliche Aufgaben"
    },
    "gemini-2.0-flash": {
        "id": "gemini-2.0-flash",
        "name": "Gemini 2.0 Flash",
        "emoji": "🚀",
        "provider": "gemini",
        "capabilities": ["text", "vision", "search"],
        "rpm": 15,
        "rpd": 1000,
        "description": "Stabiles Flash-Modell"
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
    "groq-deepseek-r1": {
        "id": "deepseek-r1-distill-llama-70b",
        "name": "DeepSeek R1",
        "emoji": "🧠",
        "provider": "groq",
        "capabilities": ["text"],
        "rpm": 30,
        "rpd": 14400,
        "description": "Reasoning-Modell für komplexe Aufgaben"
    },

    // Cerebras Modelle (Fallback-Provider)
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

    // NVIDIA NIM Modelle
    "nvidia-llama-3.1-70b": {
        "id": "meta/llama-3.1-70b-instruct",
        "name": "Llama 3.1 70B",
        "emoji": "🤖",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Meta's starkes Open-Source-Modell"
    },
    "nvidia-deepseek-v3": {
        "id": "deepseek-ai/deepseek-v3",
        "name": "DeepSeek V3",
        "emoji": "🌟",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Chinesisches Top-Modell für Reasoning"
    },
    "nvidia-qwen-2.5-72b": {
        "id": "qwen/qwen2.5-72b-instruct",
        "name": "Qwen 2.5 72B",
        "emoji": "🐉",
        "provider": "nvidia",
        "capabilities": ["text"],
        "rpm": 100,
        "rpd": 5000,
        "description": "Alibabas starkes Modell"
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
let currentModel = 'gemini-2.5-flash'; // Standard auf neuestes Flash-Modell
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
