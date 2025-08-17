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
const CUSTOM_SEARCH_API_KEY = "AIzaSyBsWxcHKSM6wWIhyc5VyCBIVJ5uQUyJyyQ";
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
    "gemini-check": { "id": "gemini-1.5-flash-latest", "provider": "gemini", "rpm": 15, "rpd": 1000 }
};

/**
 * Diese Schlüssel habe ich definiert, um konsistente Bezeichnungen für die Speicherung
 * von Einstellungen in der IndexedDB zu gewährleisten. Das verhindert Tippfehler.
 */
const SETTING_KEYS = {
    LAST_PROFILE: 'lastActiveProfile',
    API_KEYS: 'userApiKeys', // NEU
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