// Muss ich noch beheben:  Anwendung konnte nicht initialisiert werden. Bitte neu laden. Fehler: document.getElementById(...) is null

/**
 * Hier habe ich meine Sammlung von Gemini API-Keys hinterlegt. Sie sind komplett kostenlos. Wenn du sie klauen willst, wirst du dir dadurch keine Vorteile verschaffen, hohl dir einfach einen eigenen auf aistudio.google.com.
 * Durch das Wechseln dieser Schlüssel umgehe ich die Rate-Limits (Anfragen pro Minute/Tag) der API,
 * was die Anwendung robuster macht.
 */
// ENTFERNT: Die hartcodierten API-Schlüssel wurden aus Sicherheitsgründen entfernt.
// const GEMINI_API_KEYS = [ ... ];

// API-Endpunkte und Konfigurationen
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const CUSTOM_SEARCH_API_KEY = "AIzaSyBsWxcHKSM6wWIhyc5VyCBIVJ5uQUyJyyQ"; // TODO!!!!!!! DAS AUCH NOCH FIXEN UND SELBER EINSETZBAR MACHEN!!!!
const CUSTOM_SEARCH_ENGINE_ID = "64c5966cc634a4e06";
const CUSTOM_SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1";

/**
 * In diesem Objekt habe ich die verfügbaren KI-Modelle konfiguriert.
 * Jedes Modell hat eine ID, einen Anzeigenamen, ein Emoji und Infos zu seinen Fähigkeiten
 * (z.B. "vision" für Bilderkennung) sowie die spezifischen Rate-Limits (RPM/RPD).
 */
const MODELS = {
    "gemini": { "id": "gemini-1.5-flash-latest", "name": "Gemini", "emoji": "💎", "provider": "gemini", "capabilities": ["text", "vision", "search"], "rpm": 15, "rpd": 1000 },
    "gemini-pro": { "id": "gemini-pro", "name": "Gemini Pro", "emoji": "💡", "provider": "gemini", "capabilities": ["text", "search"], "rpm": 10, "rpd": 200 },
    "gemini-check": { "id": "gemini-1.5-flash-latest", "provider": "gemini", "rpm": 15, "rpd": 1000 },
    // Cerebras Modelle
    "cerebras-llama-3.3-70b": { "id": "llama-3.3-70b", "name": "Llama 3.3 70B", "emoji": "🔥", "provider": "cerebras", "capabilities": ["text"], "rpm": 100, "rpd": 10000 },
    "cerebras-llama-3.1-8b": { "id": "llama-3.1-8b", "name": "Llama 3.1 8B", "emoji": "🔥", "provider": "cerebras", "capabilities": ["text"], "rpm": 100, "rpd": 10000 },
    // Nvidia NIM Modelle
    "nvidia-llama3-chatqa-70b": { "id": "nvidia/llama3-chatqa-1.5-70b", "name": "Llama 3 ChatQA 70B", "emoji": "🤖", "provider": "nvidia", "capabilities": ["text"], "rpm": 100, "rpd": 5000 },
    "nvidia-llama3-chatqa-8b": { "id": "nvidia/llama3-chatqa-1.5-8b", "name": "Llama 3 ChatQA 8B", "emoji": "🤖", "provider": "nvidia", "capabilities": ["text"], "rpm": 100, "rpd": 5000 },
    "nvidia-llama-3.1-70b": { "id": "meta/llama-3.1-70b-instruct", "name": "Llama 3.1 70B", "emoji": "🤖", "provider": "nvidia", "capabilities": ["text"], "rpm": 100, "rpd": 5000 },
    "nvidia-qwen2-72b": { "id": "qwen/qwen2-72b-instruct", "name": "Qwen 2 72B", "emoji": "🤖", "provider": "nvidia", "capabilities": ["text"], "rpm": 100, "rpd": 5000 }
};

/**
 * Diese Schlüssel habe ich definiert, um konsistente Bezeichnungen für die Speicherung
 * von Einstellungen in der IndexedDB zu gewährleisten. Das verhindert Tippfehler.
 */
const SETTING_KEYS = {
    LAST_PROFILE: 'lastActiveProfile',
    API_KEYS: 'userApiKeys',
    PROVIDER_API_KEYS: 'providerApiKeys',
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

// API-Key Management
let userApiKeys = []; // NEU: Wird aus der DB geladen
let providerApiKeys = { cerebras: '', nvidia: '' }; // API-Keys pro Provider
let apiKeyUsage = {};
let currentApiKeyIndex = 0;

// Profildaten
let profiles = {};
let currentProfileId = null;

// Aktuelle Chat-Konfiguration
let currentBot = 'bred';
let currentModel = 'gemini';
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
let speechRecognition;
let voiceChatHistory = [];
let isListening = false;
let isBotSpeaking = false;
let voiceRate = 1.1;
let voicePitch = 1.0;
let germanVoices = [];
let currentVoiceName = null;

// DOM-Elemente, die häufig verwendet werden
// REPARIERT: Elemente werden nur deklariert, nicht sofort zugewiesen.
let voiceInterruptBtn;
let voiceOverlay;
let voiceStatus;
let voiceTranscript;
let voiceChatBtn;
let textarea;

// Konstanten für die Anwendungslogik
const MOBILE_SAFETY_DELAY = 400;

const MAX_PROJECT_FILES = 10;
