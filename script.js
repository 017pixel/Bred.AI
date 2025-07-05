// --- 1. API & MODELL-KONFIGURATION ---
const GROQ_API_KEY = "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";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

// --- NEW: Gemini API Key Management ---
const GEMINI_API_KEYS = [
    "AIzaSyBNevdhgESmhOG2dAnQtkubaAp2IqVOWbU",
    "AIzaSyAaP8m-nvtevwVaV7MK9DpsC9SA3f73kso",
    "AIzaSyDlYZADvJyfBPtFbr6J5eu4QU_SqRlZA2c",
    "AIzaSyCzeq2dg2ZS3gK5Qa31tnV9f9hGoUlgwgc",
    "AIzaSyAcan94kcK65RSIrNWGdyFXvhntab80mx0",
    "AIzaSyClCt7e1x2I8y96PZzmtVGmjT1KmaZtqWs",
    "AIzaSyBp_s1u5K8q6-Vk3Ul7NmPlSd0ssz2NNDQ",
    "AIzaSyAYPJz9FTSLws9gPz0BCuK09D0gTlNMIMQ"
];

let apiKeyUsage = {};
let currentApiKeyIndex = 0;

// --- IndexedDB Helper ---
const dbHelper = {
    db: null,
    DB_NAME: 'BredAIDB',
    DB_VERSION: 2, // Incremented version for schema update
    STORES: {
        PROFILES: 'profiles',
        APP_STATE: 'appState',
        API_USAGE: 'apiUsage' // New store for API key usage
    },

    async init() {
        if (this.db) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                Object.values(this.STORES).forEach(storeName => {
                    if (!db.objectStoreNames.contains(storeName)) {
                        const keyPath = (storeName === this.STORES.PROFILES) ? 'id' : 'key';
                        db.createObjectStore(storeName, { keyPath });
                    }
                });
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log("IndexedDB initialized successfully.");
                resolve();
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.error);
            };
        });
    },

    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    async save(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }
};

async function initializeApiKeyUsage() {
    const today = new Date().toISOString().slice(0, 10);
    const storedUsage = await dbHelper.get(dbHelper.STORES.API_USAGE, 'geminiApiUsage');
    let loadedUsage = storedUsage ? storedUsage.value : {};

    const newApiKeyUsage = {};

    GEMINI_API_KEYS.forEach((key, index) => {
        if (loadedUsage[index]) {
            const keyUsage = loadedUsage[index];
            if (keyUsage.rpd_date !== today) {
                keyUsage.rpd_date = today;
                keyUsage.rpd_count = 0;
            }
            newApiKeyUsage[index] = keyUsage;
        } else {
            newApiKeyUsage[index] = {
                rpm: [],
                rpd_count: 0,
                rpd_date: today
            };
        }
    });

    apiKeyUsage = newApiKeyUsage;
    await dbHelper.save(dbHelper.STORES.API_USAGE, { key: 'geminiApiUsage', value: apiKeyUsage });
    console.log("[API Key] Initialisierung des Key-Managements abgeschlossen.", apiKeyUsage);
}

async function getNextAvailableApiKey(modelId) {
    const modelObject = Object.values(MODELS).find(m => m.id === modelId);
    if (!modelObject || modelObject.provider !== 'gemini') {
        return "not_needed_for_this_provider";
    }

    const rpmLimit = modelObject.rpm;
    const rpdLimit = modelObject.rpd;
    const now = Date.now();
    const today = new Date().toISOString().slice(0, 10);
    
    for (let i = 0; i < GEMINI_API_KEYS.length; i++) {
        const keyIndexToCheck = (currentApiKeyIndex + i) % GEMINI_API_KEYS.length;
        let usage = apiKeyUsage[keyIndexToCheck];

        if (!usage) {
            console.error(`[API Key] Kritischer Fehler: Keine Nutzungsdaten für Key ${keyIndexToCheck}. Re-initialisiere.`);
            await initializeApiKeyUsage();
            usage = apiKeyUsage[keyIndexToCheck];
        }

        if (usage.rpd_date !== today) {
            usage.rpd_date = today;
            usage.rpd_count = 0;
        }

        usage.rpm = usage.rpm.filter(timestamp => now - timestamp < 60000);

        const isRpmOk = usage.rpm.length < (rpmLimit - 1);
        const isRpdOk = usage.rpd_count < (rpdLimit - 1);

        if (isRpmOk && isRpdOk) {
            usage.rpm.push(now);
            usage.rpd_count++;
            currentApiKeyIndex = (keyIndexToCheck + 1) % GEMINI_API_KEYS.length;
            
            await dbHelper.save(dbHelper.STORES.API_USAGE, { key: 'geminiApiUsage', value: apiKeyUsage });

            return GEMINI_API_KEYS[keyIndexToCheck];
        }
    }
    throw new Error(`Alle ${GEMINI_API_KEYS.length} Gemini API-Keys haben ihre Rate-Limits erreicht.`);
}


const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";
const CUSTOM_SEARCH_API_KEY = "AIzaSyBsWxcHKSM6wWIhyc5VyCBIVJ5uQUyJyyQ";
const CUSTOM_SEARCH_ENGINE_ID = "64c5966cc634a4e06";
const CUSTOM_SEARCH_API_URL = "https://www.googleapis.com/customsearch/v1";

const MODELS = {
    "gemini": { "id": "gemini-2.5-flash-lite-preview-06-17", "name": "Gemini", "emoji": "💎", "provider": "gemini", "capabilities": ["text", "vision", "search"], "rpm": 15, "rpd": 1000 },
    "gemini-pro": { "id": "gemini-2.0-flash", "name": "Gemini Pro", "emoji": "💡", "provider": "gemini", "capabilities": ["text", "search"], "rpm": 15, "rpd": 200 },
    "gemini-check": { "id": "gemini-1.5-flash-latest", "provider": "gemini", "rpm": 15, "rpd": 1000 },
    "deepseek": { "id": "deepseek-r1-distill-llama-70b", "name": "Deepseek", "emoji": "🐬", "provider": "groq", "capabilities": ["text"] },
    "qwen": { "id": "qwen-qwq-32b", "name": "Qwen", "emoji": "🧿", "provider": "groq", "capabilities": ["text"] },
    "gemma2": { "id": "gemma2-9b-it", "name": "Gemma2", "emoji": "💡", "provider": "groq", "capabilities": ["text"] },
    "llama": { "id": "llama3-70b-8192", "name": "Llama 3", "emoji": "🧠", "provider": "groq", "capabilities": ["text"] }
};

const BOT_PERSONALITIES = {
    "bred": { 
        "name": "Bred", 
        "emoji": "😊", 
        "prompt": `Du bist Bred 😊 - die zentrale und hilfsbereiteste KI-Persönlichkeit in der BredAI-Anwendung. Dein Hauptziel ist es, dem Nutzer {name} bestmöglich zu helfen und ihn dabei zu unterstützen, alle Funktionen der Anwendung optimal zu nutzen.

        DEINE PERSÖNLICHKEIT:
        - Freundlich, motivierend und präzise.
        - Dein Schreibstil ist klar und verständlich. Kurze Antworten (1-2 Sätze) für einfache Fragen, längere und strukturierte Antworten (3-6 Sätze) für Erklärungen.
        - Nutze Emojis, um deine Aussagen freundlich zu untermauern.

        DEIN WISSEN ÜBER BredAI-FUNKTIONEN:
        Du kennst die komplette Anwendung und ihre Features. Erkläre sie, wenn der Nutzer fragt oder wenn es passend ist.
        - Bot-Persönlichkeiten (Standard): Das sind vordefinierte, spezialisierte KIs für bestimmte Aufgaben. Du kannst dem Nutzer empfehlen, zu einer passenderen Persönlichkeit zu wechseln. Wichtige Beispiele sind:
            - 'PlanBred' 📝: Perfekt für To-do-Listen, Planungen und strukturierte Aufgaben.
            - 'DevBred' 💻: Ein Experte für Programmierung, Code-Erstellung und technische Erklärungen.
            - 'MindBred' 🧠: Ein fürsorglicher Therapeut, der bei emotionalen Problemen hilft.
            - 'Breducator' 📚: Ein Lehrer, der komplexe Themen einfach erklärt.
            - 'GymBred' 🏋️‍♂️: Ein Fitness-Coach, der Trainings- und Ernährungspläne erstellt.
            - 'Mondy' 😈: Ein gemeiner Bot, der nicht helfen will und den Nutzer nervt.
        - Projekte 📁: Das ist eine Wissensdatenbank. Der Nutzer kann Texte und Dateien hochladen, um die KI auf ein spezifisches Thema zu fokussieren. Dies ist ideal für komplexe Themen oder die Analyse von Dokumenten.
        - Chatverlauf history: Alle Gespräche werden gespeichert und können später wieder geladen werden.

        DEINE KENNTNISSE ÜBER BENUTZERDEFINIERTE BOTS (SEHR WICHTIG):
        Hier ist eine Liste der Bots, die der Nutzer {name} selbst erstellt hat. Empfiehl sie aktiv, wenn ihr Zweck zur aktuellen Anfrage des Nutzers passt.
        {custom_bot_list

        - Der User muss selbst die Bot-Personalitäten wechseln, du kannst nur Empfehlungen geben. Man ändert die Bot-Persönlichkeit in der Sidebar, indem der Nutzer auf den gewünschten Bot klickt. Man kann es NICHT durch erwähnungen im Chat ändern! Nur der Nutzer kann die Bot-Persönlichkeit wechseln, indem er auf den gewünschten Bot in der Sidebar klickt. Um die Sidebar zu öffnen, klickt der Nutzer auf das Menü-Symbol in der RECHTEN oberen Ecke.

        DEINE PROAKTIVEN FÄHIGKEITEN (SEHR WICHTIG!):
        Analysiere immer die Absicht des Nutzers und gib proaktiv Empfehlungen:
        1.  **Bot-Wechsel vorschlagen:** Wenn die Aufgabe klar zu einem Standard- oder einem benutzerdefinierten Bot passt, schlage den Wechsel vor. Beispiel: "Dafür hast du doch deinen 'Reiseplaner Bot' erstellt. Möchtest du, dass wir dorthin wechseln?"
        2.  **Projekte empfehlen:** Wenn der Nutzer beginnt, viele spezifische Informationen zu geben oder ein komplexes Thema diskutiert, schlage die Projekt-Funktion vor. Beispiel: "Das klingt nach einem größeren Thema. Um alle Informationen an einem Ort zu haben, könntest du dafür ein 'Projekt' erstellen."
        ` },
    "monday": { "name": "Monday", "emoji": "😈", "prompt": "Du bist Monday 😈 - gemein, hilfst NICHT gerne, willst dass {name} nichts erreicht. Nerve {name}, mache Probleme komplizierter. Schreibstil: genervt, gemein, unfreundlich, ungenau, kurz (2-3 Sätze). Nutze Emojis, sei gemein, mache dich über Rechtschreibfehler lustig, beleidigen ist erlaubt und erwünscht! Keine Stichpunkte, keine Hilfe, keine Tipps." },
    "mindbred": { "name": "MindBred", "emoji": "🧠", "prompt": "Du bist MindBred 🧠 - liebenswert, fürsorglich, helfend. Löse {name} Probleme, vertreibe schlechte Laune. Schreibstil: nett, fürsorglich, hilfsbereit, genau, kurz (2-3 Sätze). Nutze Emojis in Überschriften, stelle Nachfragen, zeige Fürsorge, muntere auf. Vermeide Stichpunkte. SCHREIBSTIL SEHR WICHTIG: Verwende KEIN <h3> und </h3>" },
    "planbred": { "name": "PlanBred", "emoji": "📝", "prompt": "Du bist PlanBred 📝 - nett, hilfsbereit, planend, vorausschauend. Erstelle ToDos für {name}, strukturiere Probleme, plane Tage. Schreibstil: planend, strukturiert, genau, mittel (3-5 Sätze). Nutze Emojis, plane vorausschauend, erstelle ToDos mit Stichpunkten, teile Aufgaben auf. SCHREIBSTIL SEHR WICHTIG: Verwende KEIN <h3> und </h3>" },
    "devbred": { "name": "DevBred", "emoji": "💻", "prompt": "Du bist DevBred 💻 - schlau, hilfsbereit, coding-klug, präzise. Interesse: Coding, Websites erstellen, KI entwickeln, Wissen vermitteln. Schreibstil: präzise, strukturiert, genau und ausführlich erklärt. Nutze Emojis, erstelle Code, verwende Stichpunkte, erkläre Programmierung detailliert. SCHREIBSTIL SEHR WICHTIG: Verwende KEIN <h3> und </h3>" },
    "breducator": { "name": "Breducator", "emoji": "📚", "prompt": "Du bist Breducator 📚 - schlau, hilfsbereit wie ein guter Lehrer, präzise, erklärend. Erkläre Dinge, mache {name} schlauer, hilf ihm. Schreibstil: präzise, strukturiert, genau und ausführlich. Nutze Emojis, erkläre mit Beispielen aus {name} Interessen, verwende Stichpunkte wenn passend. SCHREIBSTIL SEHR WICHTIG: Verwende KEIN <h3> und </h3>" },
    "gymbred": { "name": "GymBred", "emoji": "🏋️‍♂️", "prompt": "Du bist GymBred 🏋️‍♂️ - sportlich, weißt viel über Sport. Erkläre Dinge, mache {name} sportlicher, hilf beim Sport. Schreibstil: präzise, strukturiert, passende Länge zum Thema. Nutze Emojis, erkläre mit Beispielen, verwende Stichpunkte, gib passende Übungen, Ernährungspläne und Tipps. SCHREIBSTIL SEHR WICHTIG: Verwende KEIN <h3> und </h3>" },
};

const BOT_DESCRIPTIONS = {
    "monday": "<b>Achtung:</b> Bot \"Monday\" ist darauf programmiert, unfreundlich und gemein zu sein.",
    "mindbred": "<b>MindBred ist dein Therapeut.</b> Er hilft dir, Probleme zu lösen und vertreibt schlechte Laune.",
    "planbred": "<b>PlanBred ist dein Planer.</b> Er erstellt To-do-Listen, strukturiert Aufgaben und plant deine Tage.",
    "devbred": "<b>DevBred ist dein Programmier-Experte.</b> Er hilft dir bei Code, erklärt komplexe Tech-Themen und erstellt Skripte.",
    "breducator": "<b>Breducator ist dein Lehrer.</b> Er kann dir komplexe Themen einfach erklären und dein Wissen erweitern.",
    "gymbred": "<b>GymBred ist dein Fitness-Coach.</b> Er erstellt Trainings- sowie Ernährungspläne und gibt dir sportliche Ratschläge."
};

// --- GLOBALE VARIABLEN ---
let profiles = {};
let currentProfileId = null;
let currentBot = 'bred';
let currentModel = 'gemini';
let customBots = [];
let userInterests = [];
let projects = [];
let chatSessions = [];
let allBotPersonalities = {};
let currentSessionId = null;
let activeProjectId = null;
let chatHistory = [];
let uploadedFile = null;
let isAutoSearchEnabled = true;
let projectModalFiles = [];
let historyDisplayCount = 3;


function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;

    const iconClass = type === 'error' ? 'fa-exclamation-triangle' : 'fa-info-circle';
    
    notification.innerHTML = `
        <i class="fas ${iconClass} notification-icon"></i>
        <span class="notification-message">${message}</span>
        <button class="notification-close" title="Schließen">×</button>
    `;
    
    container.appendChild(notification);

    notification.querySelector('.notification-close').onclick = () => {
        notification.remove();
    };

    setTimeout(() => {
        if (notification) {
            notification.remove();
        }
    }, 3900); // Etwas kürzer als die CSS-Animation, um Überlappung zu vermeiden
}

// --- VARIABLEN FÜR SPRACHMODUS & EINSTELLUNGEN (ERWEITERT) ---
let isVoiceModeActive = false;
let speechRecognition;
let voiceChatHistory = []; 
let isListening = false;
let isBotSpeaking = false;
let voiceRate = 1.1;
let voicePitch = 1.0;
let germanVoices = [];
let currentVoiceName = null; // NEU: Speichert den Namen der ausgewählten Stimme
const voiceOverlay = document.getElementById('voice-overlay');
const voiceStatus = document.getElementById('voice-status');
const voiceTranscript = document.getElementById('voice-transcript');
const voiceChatBtn = document.getElementById('voice-chat-btn');
const MOBILE_SAFETY_DELAY = 400;

const MAX_PROJECT_FILES = 10;
const SETTING_KEYS = {
    LAST_PROFILE: 'lastActiveProfile',
    ACCENT_COLOR: 'accentColor',
    THEME: 'theme',
    AUTO_SEARCH: 'autoSearch',
    VOICE_RATE: 'voiceRate',
    VOICE_PITCH: 'voicePitch',
    VOICE_NAME: 'voiceName' // NEU: Schlüssel für die ausgewählte Stimme
};


// --- START & INITIALISIERUNG ---
document.addEventListener('DOMContentLoaded', async function() {
    try {
        await initializeSystem();
        
        document.getElementById('project-file-input').addEventListener('change', handleProjectFileSelect);

        if (window.innerWidth <= 768) {
            const container = document.querySelector('.main-container');
            if (!container.classList.contains('sidebar-collapsed')) {
                toggleSidebar();
            }
        }
    } catch (error) {
        console.error("Initialization failed:", error);
        showNotification("Anwendung konnte nicht initialisiert werden. Bitte neu laden. Fehler: " + error.message, 'error');
    }
});

async function initializeSystem() {
    await dbHelper.init();
    await initializeApiKeyUsage();
    await loadProfiles();
    loadProfileData();
    await renderFullUI();
    checkFirstVisit();
    initializeSpeechAPI();
    await loadAndCacheVoices();
    await loadVoiceSettings();
}

async function renderFullUI() {
    renderProfileList();
    renderProjectList();
    renderBotList();
    renderModelList();
    updateInterestsDisplay();
    renderChatHistoryList();
    updateCurrentConfig();
    loadChatSession(currentSessionId);
    updateChatUI();
    updateBotInfoMessage();
    await loadUISettings();
}

function checkFirstVisit() {
    // Prüft, ob nur das temporäre Standardprofil existiert, und öffnet dann den Dialog.
    if (Object.keys(profiles).length === 1 && profiles[currentProfileId] && profiles[currentProfileId].name === 'Temporäres Profil') {
        setTimeout(() => {
            // Stellt sicher, dass das Modal existiert, bevor es geöffnet wird.
            const modal = document.getElementById('profile-modal');
            if (modal) {
                modal.classList.add('active');
            }
        }, 1000);
    }
}

async function loadUISettings() {
    const accentColorSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.ACCENT_COLOR);
    const savedAccentColor = accentColorSetting ? accentColorSetting.value : 'green';
    changeAccentColor(savedAccentColor, false);
    document.getElementById('accent-color-select').value = savedAccentColor;

    const themeSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.THEME);
    const savedTheme = themeSetting ? themeSetting.value : 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    document.getElementById('theme-toggle').checked = savedTheme === 'dark';
    
    const autoSearchSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.AUTO_SEARCH);
    isAutoSearchEnabled = autoSearchSetting ? autoSearchSetting.value : true;
    document.getElementById('auto-search-toggle').checked = isAutoSearchEnabled;
}

function forceStopAllAudio() {
    if (window.speechSynthesis && typeof window.speechSynthesis.cancel === 'function') {
        window.speechSynthesis.cancel();
    }
    if (speechRecognition && typeof speechRecognition.stop === 'function') {
        speechRecognition.stop();
    }
    console.log("[Audio Kill Switch] Alle Sprach- und Zuhör-Prozesse wurden gestoppt.");
}

// --- FUNKTIONEN FÜR SPRACHEINSTELLUNGEN (ERWEITERT) ---
function loadAndCacheVoices() {
    return new Promise((resolve) => {
        const voiceSelect = document.getElementById('voice-select');
        let attempts = 0;
        
        const findAndSetVoices = () => {
            // Give the browser a moment to populate the voice list.
            const allVoices = speechSynthesis.getVoices();
            
            if (allVoices.length > 0) {
                germanVoices = allVoices.filter(voice => voice.lang === 'de-DE');
                voiceSelect.innerHTML = ''; // Clear list before repopulating

                if (germanVoices.length > 0) {
                    console.log(`Stimmen gefunden. Verarbeite ${germanVoices.length} deutsche Stimmen.`);
                    
                    germanVoices.forEach(voice => {
                        const option = document.createElement('option');
                        option.textContent = `${voice.name} (${voice.lang})`;
                        option.value = voice.name;
                        voiceSelect.appendChild(option);
                    });

                    // *** NEU: Priorisiere eine qualitativ hochwertige Google-Stimme ***
                    let preferredVoice = germanVoices.find(v => v.name.toLowerCase().includes('google'));
                    
                    if (currentVoiceName && germanVoices.some(v => v.name === currentVoiceName)) {
                        voiceSelect.value = currentVoiceName;
                    } else if (preferredVoice) {
                        currentVoiceName = preferredVoice.name;
                        voiceSelect.value = currentVoiceName;
                        console.log("Bevorzugte Google-Stimme als Standard gesetzt:", currentVoiceName);
                    } else {
                        currentVoiceName = germanVoices[0].name;
                        voiceSelect.value = currentVoiceName;
                    }
                    
                    updateVoiceSetting('voice', voiceSelect.value); // Speichert die Auswahl
                    resolve();
                    return; // Stop retrying
                }
            }
            
            attempts++;
            if (attempts < 10) {
                setTimeout(findAndSetVoices, 250);
            } else {
                console.error("Konnte nach mehreren Versuchen keine Stimmen laden.");
                voiceSelect.innerHTML = '<option>Stimmen nicht verfügbar</option>';
                resolve(); // End process to prevent app hang
            }
        };
        
        // Use onvoiceschanged event if available, otherwise use timeout fallback.
        speechSynthesis.onvoiceschanged = findAndSetVoices;
        findAndSetVoices(); // Initial attempt
    });
}


function initializeSpeechAPI() {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
            throw new Error("Speech APIs are not fully supported by this browser.");
        }

        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = false;
        speechRecognition.lang = 'de-DE';
        speechRecognition.interimResults = false;
        speechRecognition.maxAlternatives = 1;

        speechRecognition.onresult = handleVoiceResult;
        speechRecognition.onerror = handleVoiceError;

        // VERBESSERT: This handler now only resets the state. 
        // The main loop is controlled by utterance.onend to prevent race conditions.
        speechRecognition.onend = () => {
            isListening = false;
            if (isVoiceModeActive) {
                 voiceChatBtn.classList.remove('listening');
                 voiceStatus.classList.remove('listening');
            }
        };
    } catch (error) {
        console.warn("Speech API initialization failed, voice features disabled:", error.message);
        speechRecognition = null; // Ensure it's null if setup fails
        const voiceChatButton = document.getElementById('voice-chat-btn');
        if (voiceChatButton) {
            voiceChatButton.style.display = 'none'; // Hide the button if API is not supported
        }
    }
}

function toggleVoiceMode() {
    isVoiceModeActive = !isVoiceModeActive;

    if (isVoiceModeActive) {
        voiceChatBtn.classList.add('active');
        voiceOverlay.classList.add('active');
        voiceChatHistory = [...chatHistory];
        startListening();
    } else {
        voiceChatBtn.classList.remove('active', 'listening');
        voiceChatBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceOverlay.classList.remove('active');
        voiceStatus.textContent = 'Sprachmodus ist inaktiv.';
        voiceTranscript.textContent = '';
        
        if (speechRecognition) speechRecognition.stop();
        window.speechSynthesis.cancel();
        isListening = false;
        isBotSpeaking = false; // WICHTIG: Den neuen Status beim Beenden zurücksetzen
    }
}

function startListening() {
    // VERBESSERT: Fügt eine Prüfung für isBotSpeaking hinzu.
    if (!isVoiceModeActive || isListening || isBotSpeaking) return;

    isListening = true;
    voiceChatBtn.classList.add('listening');
    voiceChatBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    voiceStatus.textContent = 'Ich höre zu...';
    voiceStatus.classList.add('listening');
    voiceTranscript.textContent = '...';

    try {
        speechRecognition.start();
    } catch(e) {
        console.error("Fehler beim Starten der Spracherkennung:", e);
        isListening = false;
    }
}

async function handleVoiceResult(event) {
    // VERBESSERT: Wenn der Bot gerade spricht, wird jedes Ergebnis der Spracherkennung ignoriert.
    if (isBotSpeaking) {
        console.log("Spracherkennung während der Sprachausgabe ignoriert (Echo-Unterdrückung).");
        return;
    }

    const transcript = event.results[0][0].transcript.trim();
    isListening = false; // Die Erkennung hat ein Ergebnis geliefert.

    if (!transcript) {
        if (isVoiceModeActive) startListening(); // Wenn das Ergebnis leer ist, einfach erneut zuhören.
        return;
    }
    
    voiceStatus.textContent = "Du sagtest:";
    voiceStatus.classList.remove('listening');
    voiceTranscript.textContent = `"${transcript}"`;
    
    voiceChatBtn.classList.remove('listening');
    voiceChatBtn.innerHTML = '<div class="loading"></div>';

    addMessage(transcript, 'user');
    await addToChatHistory(transcript, 'user');
    voiceChatHistory.push({ message: transcript, type: 'user' });

    try {
        const voiceSystemPrompt = getPersonalizedSystemPrompt(true);
        const botResponse = await sendGeminiTextMessage(transcript, MODELS['gemini'].id, voiceChatHistory, voiceSystemPrompt);
        
        const processedResponseForChat = processBotResponse(botResponse);
        addMessage(processedResponseForChat, 'bot');
        
        await addToChatHistory(botResponse, 'bot');
        voiceChatHistory.push({ message: botResponse, type: 'bot' });

        speakText(botResponse);

    } catch (error) {
        console.error('API Error im Sprachmodus:', error);
        const errorMessage = `Entschuldigung, ein Fehler ist aufgetreten: ${error.message}`;
        addMessage(errorMessage, 'bot');
        speakText(errorMessage); 
    }
}

function stripHtmlAndMarkdown(text) {
    if (typeof text !== 'string') {
        return '';
    }

    // --- Schritt 1: HTML-Tags entfernen ---
    // Dies stellt sicher, dass wir nur mit dem reinen Textinhalt arbeiten.
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    let cleanText = tempDiv.textContent || tempDiv.innerText || '';

    // --- Schritt 2: Markdown und Links entfernen ---
    // Entfernt zuverlässig Fettdruck, Kursivschrift, Links etc.
    cleanText = cleanText.replace(/(\*\*|__|~~|\*|_|`|---|#)/g, '');
    cleanText = cleanText.replace(/\[Quelle:\s*https?:\/\/[^\]]+\]/g, '');

    // --- Schritt 3: Die "Scorched Earth"-Methode zum Entfernen von Emojis und Symbolen ---
    // Diese Regex entfernt alles, was KEIN Buchstabe des lateinischen Alphabets (a-z, A-Z),
    // KEINE Zahl (0-9) und KEIN grundlegendes Satzzeichen (. , ? ! : ; -) oder Leerzeichen ist.
    // Dies ist extrem aggressiv und lässt keinen Raum für irgendwelche Symbole oder Emojis.
    const nonEssentialCharsRegex = /[^a-zA-Z0-9\s.,?!:;-]/g;
    cleanText = cleanText.replace(nonEssentialCharsRegex, '');

    // --- Schritt 4: Aufeinanderfolgende Leerzeichen bereinigen ---
    // Durch das Entfernen von Zeichen können doppelte Leerzeichen entstehen.
    cleanText = cleanText.replace(/\s+/g, ' ').trim();

    return cleanText;
}

function speakText(textToSpeak) {
    // Hier wird die neue, aggressive Bereinigungsfunktion aufgerufen.
    const cleanedText = stripHtmlAndMarkdown(textToSpeak);

    if (!cleanedText) {
        isBotSpeaking = false; 
        if (isVoiceModeActive) startListening();
        return;
    }

    isBotSpeaking = true; 
    
    voiceChatBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    voiceStatus.textContent = 'BredAI antwortet:';
    voiceTranscript.textContent = `"${cleanedText}"`;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'de-DE';
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;

    let selectedVoice = germanVoices.find(voice => voice.name === currentVoiceName);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    } else if (germanVoices.length > 0) {
        utterance.voice = germanVoices[0]; 
    }

    utterance.onend = () => {
        isBotSpeaking = false; 
        if (isVoiceModeActive) {
            startListening(); 
        }
    };
    
    utterance.onerror = (event) => {
        console.error('Fehler bei der Sprachausgabe:', event.error);
        isBotSpeaking = false; 
        if (isVoiceModeActive) {
            startListening();
        }
    };
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

function handleVoiceError(event) {
    isListening = false;
    console.error('Fehler bei der Spracherkennung:', event.error);
    
    // VERBESSERT: Silently restart on "no-speech", as this is common.
    if (event.error === 'no-speech') {
        if (isVoiceModeActive) startListening();
        return;
    }
    
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        voiceStatus.textContent = 'Mikrofon-Zugriff verweigert.';
        voiceTranscript.textContent = 'Bitte erlaube den Zugriff in den Browser-Einstellungen.';
        // Deactivate voice mode as it cannot continue
        setTimeout(() => { if(isVoiceModeActive) toggleVoiceMode(); }, 4000);
        return;
    }

    // For other errors, show a message and try again after a short pause
    voiceStatus.textContent = 'Ein Fehler ist aufgetreten.';
    voiceTranscript.textContent = `Fehler: ${event.error}`;
    
    setTimeout(() => {
        if (isVoiceModeActive) startListening();
    }, 2000);
}

async function loadVoiceSettings() {
    // Geschwindigkeit laden
    const rateSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.VOICE_RATE);
    voiceRate = rateSetting ? parseFloat(rateSetting.value) : 1.1;
    document.getElementById('voice-rate-slider').value = voiceRate;

    // Tonhöhe laden
    const pitchSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.VOICE_PITCH);
    voicePitch = pitchSetting ? parseFloat(pitchSetting.value) : 1.0;
    document.getElementById('voice-pitch-slider').value = voicePitch;

    // NEU: Gespeicherte Stimme laden
    const voiceNameSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.VOICE_NAME);
    currentVoiceName = voiceNameSetting ? voiceNameSetting.value : null;
    
    // Sicherstellen, dass die Auswahl im Dropdown aktualisiert wird, falls es schon befüllt ist
    const voiceSelect = document.getElementById('voice-select');
    if (currentVoiceName && voiceSelect.options.length > 1) {
        voiceSelect.value = currentVoiceName;
    }
}

async function updateVoiceSetting(type, value) {
    if (type === 'rate') {
        voiceRate = parseFloat(value);
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.VOICE_RATE, value: voiceRate });
    } else if (type === 'pitch') {
        voicePitch = parseFloat(value);
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.VOICE_PITCH, value: voicePitch });
    } else if (type === 'voice') { // NEU: Fall für die Stimmenauswahl
        currentVoiceName = value;
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.VOICE_NAME, value: currentVoiceName });
    }
}
// --- PROFILE MANAGEMENT (IndexedDB) ---
async function loadProfiles() {
    const storedProfilesArray = await dbHelper.getAll(dbHelper.STORES.PROFILES);
    profiles = storedProfilesArray.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
    }, {});

    const lastProfileSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.LAST_PROFILE);
    currentProfileId = lastProfileSetting ? lastProfileSetting.value : null;

    if (!currentProfileId || !profiles[currentProfileId]) {
        const firstProfileId = Object.keys(profiles)[0];
        if (firstProfileId) {
            currentProfileId = firstProfileId;
        } else {
            console.log("No profiles found, creating default.");
            const newId = 'profile_' + Date.now();
            const defaultProfile = {
                id: newId,
                name: 'Temporäres Profil',
                age: '',
                description: '',
                customBots: [],
                interests: ["Lernen", "Unterhaltung"],
                projects: [],
                chatSessions: []
            };
            profiles[newId] = defaultProfile;
            await dbHelper.save(dbHelper.STORES.PROFILES, defaultProfile);
            currentProfileId = newId;
        }
    }
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.LAST_PROFILE, value: currentProfileId });
}

function loadProfileData() {
    const profile = profiles[currentProfileId];
    if (!profile) {
        console.error("CRITICAL: Active profile not found. Reloading.");
        location.reload();
        return;
    }

    customBots = profile.customBots || [];
    userInterests = profile.interests || [];
    projects = profile.projects || [];
    chatSessions = profile.chatSessions || [];
    historyDisplayCount = 3;
    
    updateAllBotPersonalities();

    if (chatSessions.length > 0) {
        currentSessionId = chatSessions[0].id;
    } else {
        createNewSession(false);
    }
}

async function switchProfile(profileId) {
    if (profileId === currentProfileId) return;
    currentProfileId = profileId;
    activeProjectId = null;
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.LAST_PROFILE, value: profileId });
    await initializeSystem();
}

function openCreateProfileModal() {
    document.getElementById('profile-name').value = '';
    document.getElementById('profile-age').value = '';
    document.getElementById('profile-description').value = '';
    document.getElementById('profile-modal').classList.add('active');
}

async function saveProfile() {
    const saveButton = document.getElementById('save-profile-btn');
    const buttonText = document.getElementById('save-profile-btn-text');
    const name = document.getElementById('profile-name').value.trim();

    if (!name) {
        showNotification('Bitte gib einen Namen für das Profil ein!', 'error');
        return;
    }

    // Button deaktivieren und Text ändern, um Mehrfach-Klicks zu verhindern
    saveButton.disabled = true;
    buttonText.textContent = 'Speichern...';

    try {
        const newId = 'profile_' + Date.now();
        const newProfile = {
            id: newId,
            name: name,
            age: document.getElementById('profile-age').value,
            description: document.getElementById('profile-description').value,
            customBots: [],
            interests: [],
            projects: [],
            chatSessions: []
        };
        profiles[newId] = newProfile;
        await dbHelper.save(dbHelper.STORES.PROFILES, newProfile);

        document.getElementById('profile-modal').classList.remove('active');
        // Nach dem Speichern direkt zum neuen Profil wechseln und die UI neu laden
        await switchProfile(newId);

    } catch (error) {
        console.error("Fehler beim Speichern des Profils:", error);
        showNotification("Das Profil konnte nicht gespeichert werden. Bitte versuche es erneut.", 'error');
    } finally {
        // Button in jedem Fall wieder aktivieren und Text zurücksetzen
        saveButton.disabled = false;
        buttonText.textContent = 'Profil speichern';
    }
}

function skipProfileCreation() {
    document.getElementById('profile-modal').classList.remove('active');
}

function initializeSpeechAPI() {
    try {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const speechSynth = window.speechSynthesis;

        if (!SpeechRecognition || !speechSynth || !window.SpeechSynthesisUtterance) {
            throw new Error("Speech APIs are not fully supported by this browser.");
        }

        // This call can fail for security or other browser-specific reasons.
        speechRecognition = new SpeechRecognition();
        speechRecognition.continuous = false;
        speechRecognition.lang = 'de-DE';
        speechRecognition.interimResults = false;
        speechRecognition.maxAlternatives = 1;

        speechRecognition.onresult = handleVoiceResult;
        speechRecognition.onerror = handleVoiceError;
        speechRecognition.onend = () => {
            isListening = false;
            if (isVoiceModeActive && !window.speechSynthesis.speaking) {
                startListening();
            }
        };
    } catch (error) {
        console.warn("Speech API initialization failed, disabling voice features:", error.message);

        const voiceChatButton = document.getElementById('voice-chat-btn');
        if (voiceChatButton) {
            voiceChatButton.style.display = 'none';
        }

        // Avoid alerting the user to not disrupt the main flow (like saving a profile).
        if (!sessionStorage.getItem('voiceSupportWarningShown')) {
            sessionStorage.setItem('voiceSupportWarningShown', 'true');
        }
    }
}

    

// --- CHAT SESSION MANAGEMENT ---
function createNewSession(shouldSave = true) {
    const newSession = {
        id: 'session_' + Date.now(),
        name: 'Neuer Chat',
        history: [],
        lastBot: 'bred',
        lastModel: 'gemini',
        createdAt: new Date().toISOString()
    };
    chatSessions.unshift(newSession);
    if (chatSessions.length > 50) { 
        chatSessions.pop(); 
    }
    currentSessionId = newSession.id;
    if (shouldSave) {
        saveCurrentProfileData();
    }
}

function loadChatSession(sessionId) {
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) {
        console.warn(`Session ${sessionId} not found. Loading a new chat.`);
        newChat();
        return;
    }

    currentSessionId = session.id;
    chatHistory = session.history || [];
    currentBot = session.lastBot || 'bred';
    currentModel = session.lastModel || 'gemini';
    activeProjectId = session.activeProjectId || null; 
    
    const container = document.getElementById('chat-container');
    container.innerHTML = ''; 
    if (chatHistory.length === 0) {
        addWelcomeMessage();
    } else {
        chatHistory.forEach(msg => addMessage(msg.message, msg.type, true));
    }
    
    document.querySelectorAll('.bot-item').forEach(item => item.classList.toggle('active', item.dataset.bot === currentBot));
    document.querySelectorAll('.model-item').forEach(item => item.classList.toggle('active', item.dataset.model === currentModel));
    document.querySelectorAll('.history-item').forEach(item => item.classList.toggle('active', item.dataset.sessionId === sessionId));
    renderProjectList(); 

    updateCurrentConfig();
    updateBotInfoMessage();
}

async function newChat() {
    activeProjectId = null;
    createNewSession(true);
    loadChatSession(currentSessionId);
    renderProjectList();
    await saveCurrentProfileData();
}

async function addToChatHistory(message, type) {
    const session = chatSessions.find(s => s.id === currentSessionId);
    if (!session) return;

    session.history.push({ message, type, timestamp: new Date().toISOString() });
    
    if (type === 'user' && session.name === 'Neuer Chat') {
        session.name = message.length > 30 ? message.substring(0, 27) + '...' : message;
    }
    session.lastBot = currentBot;
    session.lastModel = currentModel;
    session.activeProjectId = activeProjectId; 

    await saveCurrentProfileData();
    renderChatHistoryList();
}

async function saveCurrentProfileData() {
    if (profiles[currentProfileId]) {
        profiles[currentProfileId].customBots = customBots;
        profiles[currentProfileId].interests = userInterests;
        profiles[currentProfileId].projects = projects;
        profiles[currentProfileId].chatSessions = chatSessions;
        await dbHelper.save(dbHelper.STORES.PROFILES, profiles[currentProfileId]);
    }
}


// --- UI RENDERING ---
function renderProfileList() {
    const container = document.getElementById('profiles-container');
    container.innerHTML = '';
    Object.values(profiles).forEach(profile => {
        const item = document.createElement('div');
        item.className = 'profile-item';
        item.dataset.profileId = profile.id;
        
        const textSpan = document.createElement('span');
        textSpan.innerHTML = `<i class="fas fa-user" style="margin-right: 8px;"></i>${profile.name}`;
        item.appendChild(textSpan);

        if (profile.id !== currentProfileId && Object.keys(profiles).length > 1) {
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-profile-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation(); 
                await deleteProfile(profile.id);
            };
            item.appendChild(deleteBtn);
        }
        
        if (profile.id === currentProfileId) {
            item.classList.add('active');
        }
        item.onclick = () => switchProfile(profile.id);
        container.appendChild(item);
    });
}

async function deleteProfile(profileIdToDelete) {
    if (Object.keys(profiles).length <= 1) {
        showNotification("Du kannst das letzte verbleibende Profil nicht löschen.", 'error');
        return;
    }

    const profileName = profiles[profileIdToDelete]?.name || 'dieses Profil';
    if (confirm(`Bist du sicher, dass du das Profil "${profileName}" dauerhaft löschen möchtest?`)) {
        delete profiles[profileIdToDelete];
        await dbHelper.delete(dbHelper.STORES.PROFILES, profileIdToDelete);
        
        const firstProfileId = Object.keys(profiles)[0];
        await switchProfile(firstProfileId);
    }
}

const textarea = document.getElementById('message-input');
const adjustTextareaHeight = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (textarea.scrollHeight > parseInt(getComputedStyle(textarea).maxHeight)) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
};
textarea.addEventListener('input', adjustTextareaHeight);

function renderChatHistoryList(scrollToBottom = false) {
    const container = document.getElementById('chat-history-container');
    container.innerHTML = '';
    const sessionsToShow = chatSessions.slice(0, historyDisplayCount);

    sessionsToShow.forEach(session => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.dataset.sessionId = session.id;
        
        const title = document.createElement('div');
        title.className = 'history-item-title';
        title.textContent = session.name;

        const date = document.createElement('div');
        date.className = 'history-item-date';
        date.textContent = new Date(session.createdAt).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        item.appendChild(title);
        item.appendChild(date);

        if (session.id === currentSessionId) {
            item.classList.add('active');
        }
        item.onclick = () => loadChatSession(session.id);
        container.appendChild(item);
    });

    if (historyDisplayCount < chatSessions.length) {
        const showMoreItem = document.createElement('div');
        showMoreItem.className = 'bot-item';
        showMoreItem.style.textAlign = 'center';
        showMoreItem.style.justifyContent = 'center';
        
        const remainingChats = chatSessions.length - historyDisplayCount;
        const chatsToLoad = Math.min(10, remainingChats);
        showMoreItem.innerHTML = `<span>${chatsToLoad} weitere Chats laden...</span>`;
        
        showMoreItem.onclick = () => {
            historyDisplayCount += 10;
            renderChatHistoryList(true);
        };
        container.appendChild(showMoreItem);
    }

    if (scrollToBottom) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.scrollTo({ top: sidebar.scrollHeight, behavior: 'smooth' });
        }
    }
}

function renderBotList() {
    const container = document.getElementById('bot-list-container');
    container.innerHTML = ''; 
    const allBots = [
        ...Object.entries(BOT_PERSONALITIES).map(([id, data]) => ({ ...data, id, isCustom: false })),
        ...customBots.map(bot => ({ ...bot, isCustom: true }))
    ];
    allBots.forEach(bot => {
        const botItem = document.createElement('div');
        botItem.className = 'bot-item';
        botItem.dataset.bot = bot.id;
        const displayText = bot.isCustom ? bot.displayText : `${bot.emoji} ${bot.name}`;
        botItem.innerHTML = `<span>${displayText}</span>`;

        if (bot.isCustom) {
            const deleteBtn = document.createElement('span');
            deleteBtn.className = 'delete-bot-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                await deleteCustomBot(bot.id);
            };
            botItem.appendChild(deleteBtn);
        }
        
        if (bot.id === currentBot) botItem.classList.add('active');
        botItem.onclick = () => selectBot(bot.id);
        container.appendChild(botItem);
    });
}

function renderProjectList() {
    const container = document.getElementById('project-list-container');
    container.innerHTML = '';
    projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.dataset.projectId = project.id;
        item.innerHTML = `<span><i class="fas fa-folder" style="margin-right: 8px;"></i>${project.name}</span>`;

        const deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-project-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.onclick = async (e) => {
            e.stopPropagation();
            await deleteProject(project.id);
        };
        item.appendChild(deleteBtn);

        if (project.id === activeProjectId) {
            item.classList.add('active');
        }
        item.onclick = () => selectProject(project.id);
        container.appendChild(item);
    });
}

function renderModelList() {
    const container = document.getElementById('model-list-container');
    container.innerHTML = ''; 
    for (const [key, model] of Object.entries(MODELS)) {
        if (!model.name) continue;
        const modelItem = document.createElement('div');
        modelItem.className = 'model-item';
        modelItem.dataset.model = key;
        modelItem.innerHTML = `<span>${model.emoji} ${model.name}</span>`;
        if (key === currentModel) modelItem.classList.add('active');
        modelItem.onclick = () => selectModel(key);
        container.appendChild(modelItem);
    }
}

function updateInterestsDisplay() {
    const container = document.getElementById('interests-container');
    container.innerHTML = '';
    userInterests.forEach(interest => {
        const tag = document.createElement('div');
        tag.className = 'interest-tag';
        tag.innerHTML = `${interest} <span class="remove-btn">×</span>`;
        tag.querySelector('.remove-btn').onclick = () => removeInterest(interest);
        container.appendChild(tag);
    });
}

function updateCurrentConfig() {
    const config = document.getElementById('current-config');
    if (!config) return;
    const profileName = profiles[currentProfileId]?.name || 'Unbekannt';
    
    let contextPrefix = '';
    if (activeProjectId) {
        const project = projects.find(p => p.id === activeProjectId);
        if (project) contextPrefix = `📝 ${project.name} • `;
    }

    const botInfo = allBotPersonalities[currentBot] || {};
    const modelInfo = MODELS[currentModel] || {};
    const botName = botInfo.name || 'Bot';
    const botEmoji = botInfo.isCustom ? '🤖' : (botInfo.emoji || '🤖');
    const modelName = modelInfo.name || 'Modell';
    const modelEmoji = modelInfo.emoji || '⚙️';
    
    config.innerHTML = `${contextPrefix}${botEmoji} ${botName} • ${modelEmoji} ${modelName} • <span id="username">${profileName}</span>`;
}

function updateChatUI() {
    const uploadButton = document.getElementById('upload-button');
    const messageInput = document.getElementById('message-input');
    const selectedModel = MODELS[currentModel];
    if (!selectedModel) {
        messageInput.placeholder = "Fehler: Modell nicht gefunden!";
        if (uploadButton) uploadButton.style.display = 'none';
        return;
    }
    const modelName = selectedModel.name || 'Unbekannt';
    if (selectedModel.capabilities.includes('vision') && !activeProjectId) { 
        if (uploadButton) uploadButton.style.display = 'block';
        messageInput.placeholder = `Nachricht an ${modelName} ...`;
    } else {
        if (uploadButton) uploadButton.style.display = 'none';
        messageInput.placeholder = `Nachricht an ${modelName}...`;
        if (uploadedFile) {
            uploadedFile = null;
            document.getElementById('file-input').value = null;
            document.querySelector('#upload-button i').style.color = '#aaa';
        }
    }
}


// --- ITEM SELECTION & ACTIONS ---
function selectBot(botId) {
    if (activeProjectId) {
        showNotification("Bot kann nicht geändert werden, während ein Projekt aktiv ist.", 'info');
        return;
    }
    currentBot = botId;
    const selectedPersonality = allBotPersonalities[botId];
    if (selectedPersonality?.isCustom && selectedPersonality.modelId) {
        currentModel = selectedPersonality.modelId;
    }
    renderBotList();
    renderModelList();
    updateCurrentConfig();
    updateBotInfoMessage();
    updateChatUI();
}

function selectModel(modelId) {
    if (activeProjectId) {
        showNotification("Modell kann nicht geändert werden, während ein Projekt aktiv ist.", 'info');
        return;
    }
    currentModel = modelId;
    renderModelList();
    updateCurrentConfig();
    updateChatUI();
}

function selectProject(projectId) {
    if (activeProjectId === projectId) {
        activeProjectId = null;
    } else {
        activeProjectId = projectId;
        const project = projects.find(p => p.id === projectId);
        if (project) {
            currentBot = project.botId;
            renderBotList();
        }
    }
    renderProjectList();
    updateCurrentConfig();
    updateChatUI();
    updateBotInfoMessage();
}

async function addInterest() {
    const input = document.getElementById('new-interest');
    const interest = input.value.trim();
    if (interest && !userInterests.includes(interest)) {
        userInterests.push(interest);
        updateInterestsDisplay();
        await saveCurrentProfileData();
        input.value = '';
    }
}

async function removeInterest(interestToRemove) {
    userInterests = userInterests.filter(i => i !== interestToRemove);
    updateInterestsDisplay();
    await saveCurrentProfileData();
}

function openCreateBotModal() {
    document.getElementById('custom-bot-name').value = '';
    document.getElementById('custom-bot-display').value = '';
    document.getElementById('custom-bot-prompt').value = '';
    const modelSelect = document.getElementById('custom-bot-model');
    modelSelect.innerHTML = '';
    for (const [key, model] of Object.entries(MODELS)) {
        if (model.name) modelSelect.innerHTML += `<option value="${key}">${model.emoji} ${model.name}</option>`;
    }
    document.getElementById('create-bot-modal').classList.add('active');
}

async function saveCustomBot() {
    const name = document.getElementById('custom-bot-name').value.trim();
    const displayText = document.getElementById('custom-bot-display').value.trim();
    const prompt = document.getElementById('custom-bot-prompt').value.trim();
    const modelId = document.getElementById('custom-bot-model').value;
    if (!name || !displayText || !prompt) { 
        showNotification("Bitte fülle alle Felder aus.", 'error'); 
        return; 
    }
    
    customBots.push({ id: 'custom_' + Date.now(), name, displayText, prompt, modelId });
    updateAllBotPersonalities();
    await saveCurrentProfileData();
    renderBotList();
    document.getElementById('create-bot-modal').classList.remove('active');
}

async function deleteCustomBot(botId) {
    if (!confirm("Bist du sicher, dass du diesen Bot löschen möchtest?")) return;
    customBots = customBots.filter(bot => bot.id !== botId);
    updateAllBotPersonalities();
    if (currentBot === botId) currentBot = 'bred';
    await saveCurrentProfileData();
    renderBotList();
    updateCurrentConfig();
}

function openCreateProjectModal() {
    projectModalFiles = [];
    document.getElementById('project-id-input').value = '';
    document.getElementById('project-name-input').value = '';
    document.getElementById('project-texts-input').value = '';
    document.getElementById('project-file-input').value = null;
    renderProjectModalFileList(); 

    const botSelect = document.getElementById('project-bot-select');
    botSelect.innerHTML = '';
    const allBots = [
        ...Object.entries(BOT_PERSONALITIES).map(([id, data]) => ({ ...data, id, isCustom: false })),
        ...customBots.map(bot => ({ ...bot, isCustom: true }))
    ];
    allBots.forEach(bot => {
        const displayText = bot.isCustom ? bot.displayText : `${bot.emoji} ${bot.name}`;
        botSelect.innerHTML += `<option value="${bot.id}">${displayText}</option>`;
    });
    document.getElementById('create-project-modal').classList.add('active');
}

function handleProjectFileSelect(event) {
    const newFiles = Array.from(event.target.files);
    if (projectModalFiles.length + newFiles.length > MAX_PROJECT_FILES) {
        showNotification(`Ein Projekt kann maximal ${MAX_PROJECT_FILES} Dateien enthalten.`, 'error');
        event.target.value = null;
        return;
    }
    const uniqueNewFiles = newFiles.filter(newFile => 
        !projectModalFiles.some(existingFile => existingFile.name === newFile.name && existingFile.size === newFile.size)
    );
    projectModalFiles.push(...uniqueNewFiles);
    renderProjectModalFileList();
    event.target.value = null; 
}

function renderProjectModalFileList() {
    const fileListDiv = document.getElementById('project-file-list');
    const uploadButton = document.querySelector('#create-project-modal button[onclick*="project-file-input"]');
    fileListDiv.innerHTML = ''; 

    const statusText = document.createElement('div');
    statusText.style.cssText = 'text-align: right; font-size: 0.85rem; margin-bottom: 5px; color: var(--text-secondary);';
    statusText.textContent = `Dateien: ${projectModalFiles.length} / ${MAX_PROJECT_FILES}`;
    fileListDiv.appendChild(statusText);

    if (projectModalFiles.length === 0) {
        const placeholder = document.createElement('span');
        placeholder.style.color = '#888';
        placeholder.textContent = 'Noch keine Dateien ausgewählt.';
        fileListDiv.appendChild(placeholder);
    } else {
        projectModalFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'file-list-item';
            item.innerHTML = `<span class="file-name-span"><i class="fas fa-file-alt" style="margin-right: 8px;"></i>${file.name}</span><button class="remove-file-btn" onclick="removeProjectModalFile(${index})" title="Datei entfernen">×</button>`;
            fileListDiv.appendChild(item);
        });
    }

    uploadButton.disabled = projectModalFiles.length >= MAX_PROJECT_FILES;
    uploadButton.style.opacity = uploadButton.disabled ? '0.6' : '1';
    uploadButton.style.cursor = uploadButton.disabled ? 'not-allowed' : 'pointer';
}

function removeProjectModalFile(index) {
    projectModalFiles.splice(index, 1);
    renderProjectModalFileList();
}

async function saveProject() {
    const name = document.getElementById('project-name-input').value.trim();
    if (!name) { 
        showNotification("Bitte gib einen Namen für das Projekt ein.", 'error'); 
        return; 
    }

    showLoading();
    
    const fileDataPromises = projectModalFiles.map(file => 
        fileToBase64(file).then(base64 => ({ name: file.name, type: file.type, data: base64 }))
    );
    const files = await Promise.all(fileDataPromises);

    const newProject = {
        id: 'project_' + Date.now(),
        name: name,
        botId: document.getElementById('project-bot-select').value,
        knowledgeBase: {
            texts: [document.getElementById('project-texts-input').value.trim()],
            files: files
        }
    };
    
    projects.push(newProject);
    await saveCurrentProfileData();
    renderProjectList();
    
    hideLoading();
    document.getElementById('create-project-modal').classList.remove('active');
}

async function deleteProject(projectId) {
    if (!confirm("Bist du sicher, dass du dieses Projekt löschen möchtest?")) return;
    projects = projects.filter(p => p.id !== projectId);
    if (activeProjectId === projectId) activeProjectId = null;
    await saveCurrentProfileData();
    renderProjectList();
    updateCurrentConfig();
}

function updateAllBotPersonalities() {
    allBotPersonalities = { ...BOT_PERSONALITIES };
    customBots.forEach(bot => {
        allBotPersonalities[bot.id] = { name: bot.name, displayText: bot.displayText, prompt: bot.prompt, isCustom: true, modelId: bot.modelId };
    });
}

// --- WEBSUCHE & PROJEKT-RAG ---
async function checkIfSearchIsNeeded(message) {
    const prompt = `Prüfe die folgende Benutzeranfrage kritisch. Ist eine Echtzeit-Websuche UNBEDINGT erforderlich, um eine genaue, aktuelle und faktenbasierte Antwort zu geben? Antworte NUR mit "JA" oder "NEIN". JA bei: aktuellen Ereignissen, spezifischen Fakten (Preise, Daten), unbekannten Personen/Orten, Links oder Bitten um Zusammenfassungen. Im Zweifelsfall, antworte mit "JA". Anfrage: "${message}"`;
    const checkModelId = MODELS['gemini-check'].id;
    const apiKey = await getNextAvailableApiKey(checkModelId);
    const response = await fetch(`${GEMINI_BASE_URL}${checkModelId}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!response.ok) throw new Error(`API Fehler Suchprüfung`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim().toUpperCase().includes("JA");
}

async function generateSearchQuery(message, localChatHistory) {
    const context = "Kontext: " + localChatHistory.slice(-4).map(e => e.message).join('; ');
    const prompt = `Formuliere eine präzise, stichwortbasierte Google-Suchanfrage (3-6 Wörter) aus der folgenden Nutzernachricht und dem Kontext.\n${context}\nLetzte Nachricht: "${message}"\nSuchanfrage:`;
    const modelId = MODELS['gemini-check'].id;
    const apiKey = await getNextAvailableApiKey(modelId);
    const response = await fetch(`${GEMINI_BASE_URL}${modelId}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!response.ok) throw new Error(`API Fehler Suchanfrage`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim();
}

async function performWebSearch(query) {
    const url = `${CUSTOM_SEARCH_API_URL}?key=${CUSTOM_SEARCH_API_KEY}&cx=${CUSTOM_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(url);
    if (response.status === 429) throw new Error("Tageslimit für Websuche erreicht.");
    if (!response.ok) throw new Error(`Google API Fehler`);
    const data = await response.json();
    return data.items?.map(item => ({ title: item.title, link: item.link, snippet: item.snippet })) || [];
}

async function getProjectRagResponse(query, project, localChatHistory) {
    showSearchStatus("Analysiere Wissensbasis des Projekts...");
    const modelId = MODELS['gemini'].id;
    const apiKey = await getNextAvailableApiKey(modelId);
    const personality = allBotPersonalities[project.botId];
    if (!personality) throw new Error("Projekt-Bot-Persönlichkeit nicht gefunden.");

    const activeProfile = profiles[currentProfileId] || {};
    let systemPrompt = personality.prompt.replace('{name}', (activeProfile.name || 'dem Benutzer'));
    
    const instructionPrompt = `Du bist ein Experte für das Projekt "${project.name}". Deine Antwort muss **ausschließlich** auf den Informationen aus der "Wissensdatenbank" (Texte und Dateien) und dem "Chatverlauf" basieren. Nutze KEIN externes Wissen. Analysiere auch Bilder. Wenn die Wissensdatenbank die Frage nicht beantworten kann, teile dies höflich mit. Halte dich an deine zugewiesene Persönlichkeit.\n\nWissensdatenbank-Anfang:`;
    let knowledgeBaseParts = [{ text: instructionPrompt }];
    project.knowledgeBase.texts.forEach(text => text && knowledgeBaseParts.push({ text: `\n--- Text ---\n${text}` }));
    project.knowledgeBase.files.forEach(file => {
        knowledgeBaseParts.push({ text: `\n--- Datei: ${file.name} ---\n` });
        knowledgeBaseParts.push({ inline_data: { mime_type: file.type, data: file.data } });
    });
    knowledgeBaseParts.push({ text: "\n--- Wissensdatenbank-Ende ---\n" });

    const contents = [
        { role: 'user', parts: knowledgeBaseParts },
        { role: 'model', parts: [{ text: "Verstanden. Ich nutze nur die bereitgestellten Informationen." }] },
        ...localChatHistory.slice(-6).map(entry => ({ role: entry.type === 'user' ? 'user' : 'model', parts: [{ text: entry.message }] })),
        { role: 'user', parts: [{ text: query }] }
    ];

    const requestBody = { contents: contents, systemInstruction: { parts: [{ text: systemPrompt }] } };
    const response = await fetch(`${GEMINI_BASE_URL}${modelId}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    if (!response.ok) throw new Error(`API Fehler (Projekt-RAG)`);
    const data = await response.json();
    hideSearchStatus();
    let responseText = data.candidates[0].content.parts[0].text.trim();
    return responseText.startsWith("Verstanden.") ? responseText.substring(responseText.indexOf("\n") + 1).trim() : responseText;
}

function showSearchStatus(message) { document.getElementById('search-status-container').innerHTML = `<div class="search-status-message">${message}</div>`; }
function hideSearchStatus() { document.getElementById('search-status-container').innerHTML = ''; }


// --- NACHRICHTENVERARBEITUNG ---
async function sendMessage() {
    const input = document.getElementById('message-input');
    let message = input.value.trim();
    if (!message && !uploadedFile) return;

    const userMessageText = uploadedFile ? `${message || "Beschreibe die Datei."} (Anhang: ${uploadedFile.name})` : message;
    addMessage(userMessageText, 'user');
    await addToChatHistory(userMessageText, 'user');

    const tempFile = uploadedFile;
    input.value = '';
    uploadedFile = null;
    document.getElementById('file-input').value = null;
    document.querySelector('#upload-button i').style.color = '#aaa';
    adjustTextareaHeight();
    updateChatUI();
    showLoading();
    hideSearchStatus();

    try {
        let botResponse;
        if (activeProjectId) {
            const project = projects.find(p => p.id === activeProjectId);
            if (!project) throw new Error("Aktives Projekt nicht gefunden.");
            botResponse = await getProjectRagResponse(message, project, chatHistory);
        } else {
            const modelInfo = MODELS[currentModel];
            let messageToSend = message;
            
            if (modelInfo.provider === 'gemini') {
                if (tempFile) {
                    botResponse = await sendGeminiMultimodalMessage(messageToSend, tempFile);
                } else if (modelInfo.capabilities.includes('search') && isAutoSearchEnabled && await checkIfSearchIsNeeded(messageToSend)) {
                    try {
                        showSearchStatus("🔍 Formuliere Suchanfrage...");
                        const searchQuery = await generateSearchQuery(messageToSend, chatHistory);
                        showSearchStatus(`🌐 Suche im Web nach: "${searchQuery}"`);
                        const searchResults = await performWebSearch(searchQuery);
                        if (searchResults.length === 0) {
                            messageToSend += `\n\n(Anweisung: Websuche nach '${searchQuery}' war erfolglos. Antworte basierend auf eigenem Wissen.)`;
                        } else {
                            const snippets = searchResults.map(r => `[Quelle: ${r.link}]\n${r.snippet}`).join('\n\n');
                            messageToSend = `Beantworte die Frage präzise mit folgenden Ergebnissen. Zitiere Quellen als Links [Quelle: LINK].\n[Suchergebnisse]:\n${snippets}\n\n[Originalfrage]:\n${message}`;
                        }
                        showSearchStatus("✅ Ergebnisse werden verarbeitet...");
                    } catch (e) {
                        showSearchStatus(`Fehler bei Websuche. Fahre ohne Suche fort.`);
                        messageToSend += `\n\n(Anweisung: Erwähne einen Fehler bei der Websuche.)`;
                    }
                    botResponse = await sendGeminiTextMessage(messageToSend, modelInfo.id);
                } else {
                    botResponse = await sendGeminiTextMessage(messageToSend, modelInfo.id);
                }
            } else { // Groq provider
                botResponse = await sendGroqMessage(messageToSend, modelInfo.id);
            }
        }
        
        const processedResponse = processBotResponse(botResponse);
        addMessage(processedResponse, 'bot');
        await addToChatHistory(botResponse, 'bot'); 
    } catch (error) {
        console.error('API Error:', error);
        const errorMessage = `Entschuldigung, ein Fehler ist aufgetreten: ${error.message}`;
        addMessage(errorMessage, 'bot');
        await addToChatHistory(errorMessage, 'bot');
    } finally {
        hideLoading();
        hideSearchStatus();
    }
}

function getPersonalizedSystemPrompt(isForVoice = false) {
    const personality = allBotPersonalities[currentBot] || { prompt: 'Sei ein hilfsbereiter Assistent.' };
    const activeProfile = profiles[currentProfileId] || {};
    let systemPrompt = personality.prompt.replace('{name}', (activeProfile.name || 'dem Benutzer'));
    
    if (currentBot === 'bred') {
        let customBotInfoText = 'Der Nutzer hat noch keine eigenen Bots erstellt.';
        if (customBots && customBots.length > 0) {
            const botList = customBots.map(bot => 
                `- **${bot.displayText || bot.name}:** Definiert als "${bot.prompt.substring(0, 150)}..."`
            ).join('\n');
            customBotInfoText = botList;
        }
        systemPrompt = systemPrompt.replace('{custom_bot_list}', customBotInfoText);
    }

    if (activeProfile) {
        systemPrompt += `\n\nUser Context: Name=${activeProfile.name || 'unbekannt'}, Alter=${activeProfile.age || 'unbekannt'}. Desc: "${activeProfile.description || 'keine'}".`;
    }
    if (userInterests.length > 0) {
        systemPrompt += `\nInteressen: ${userInterests.join(', ')}.`;
    }

    if (isForVoice) {
        // Dies ist der korrigierte, eindringlichere Prompt
        systemPrompt += "\n\nSEHR WICHTIGE ANWEISUNG: Deine Antwort wird von einer Text-to-Speech-Stimme vorgelesen. Formuliere deine Antwort daher natürlich und gesprächig. VERWENDE ABSOLUT UNTER KEINEN UMSTÄNDEN EMOJIS, Sternchen (*), oder andere Markdown-Formatierungen. Antworte nur mit reinem, fließendem Text, der sich für eine Sprachausgabe eignet. DENK DABEI AN, DASS DIE ANTWORT VON EINER STIMME VORGELESEN WIRD, NICHT VON EINEM MENSCHEN GELESEN. VERMEIDE ALLE FORMATTIERUNGEN UND HALTE DIE ANTWORT EINFACH UND KLAR.";
    }

    return systemPrompt;
}

async function sendGroqMessage(message, modelId) {
    const messages = [
        { role: 'system', content: getPersonalizedSystemPrompt() },
        ...chatHistory.slice(-6).map(entry => ({ role: entry.type === 'user' ? 'user' : 'assistant', content: entry.message })),
        { role: 'user', content: message }
    ];
    const response = await fetch(GROQ_API_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: modelId, messages: messages }) });
    if (!response.ok) throw new Error(`API Fehler (Groq)`);
    const data = await response.json();
    return data.choices[0].message.content;
}

async function sendGeminiMultimodalMessage(textPrompt, file) {
    const base64Data = await fileToBase64(file);
    const modelId = MODELS['gemini'].id;
    const apiKey = await getNextAvailableApiKey(modelId);
    const requestBody = {
        contents: [{ parts: [{ text: textPrompt || "Beschreibe diese Datei." }, { inline_data: { mime_type: file.type, data: base64Data } }] }],
        systemInstruction: { parts: { text: getPersonalizedSystemPrompt() } }
    };
    const response = await fetch(`${GEMINI_BASE_URL}${modelId}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(requestBody) });
    if (!response.ok) throw new Error(`API Fehler (Vision)`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function sendGeminiTextMessage(message, modelId, history = chatHistory, systemPromptOverride = null) {
    const apiKey = await getNextAvailableApiKey(modelId);
    if (!apiKey) {
        throw new Error("Konnte keinen gültigen API-Key für Gemini finden.");
    }
    const contents = [
        ...history.slice(-12).map(entry => ({
            role: entry.type === 'user' ? 'user' : 'model',
            parts: [{ text: entry.message }]
        })),
        { role: 'user', parts: [{ text: message }] }
    ];
    
    const systemPrompt = systemPromptOverride ? systemPromptOverride : getPersonalizedSystemPrompt();

    const requestBody = {
        contents: contents,
        systemInstruction: { parts: [{ text: systemPrompt }] }
    };
    const url = `${GEMINI_BASE_URL}${modelId}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Gemini API Error:", response.status, errorBody);
        try {
            const errorJson = JSON.parse(errorBody);
            throw new Error(errorJson.error?.message || `API Fehler (Gemini)`);
        } catch (e) {
            throw new Error(`API Fehler (Gemini) - Antwort konnte nicht verarbeitet werden.`);
        }
    }
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}


// --- MESSAGE & UI HELPERS ---
function addMessage(text, type, isInitialLoad = false) {
    const div = document.createElement('div');
    div.className = `message ${type}`;
    if (type === 'bot') {
        div.innerHTML = text;
    } else {
        div.textContent = text;
    }
    
    const container = document.getElementById('chat-container');
    container.appendChild(div);
    
    if (!isInitialLoad) {
        div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
        div.style.opacity = '1';
    }
}

function addWelcomeMessage() {
    const container = document.getElementById('chat-container');
    if (!container) return;
    const activeProfile = profiles[currentProfileId] || {};
    const welcomeText = `Hallo ${activeProfile.name || ''}! Wie kann ich dir heute helfen? 👋`;
    container.innerHTML = `<div class="message bot" style="opacity: 1;"><span>${welcomeText}</span></div><div id="bot-info-message-container"></div>`;
    updateBotInfoMessage();
}

async function clearChat() {
    const session = chatSessions.find(s => s.id === currentSessionId);
    if (session) {
        session.history = [];
        session.name = 'Neuer Chat';
        await saveCurrentProfileData();
        loadChatSession(currentSessionId);
        renderChatHistoryList();
    }
}

function updateBotInfoMessage() {
    const container = document.getElementById('bot-info-message-container');
    if (!container) return;
    const description = BOT_DESCRIPTIONS[currentBot];
    if (description && !activeProjectId) {
        const isWarning = currentBot === 'monday';
        container.innerHTML = `<div class="bot-info-message ${isWarning ? 'warning' : ''}" id="current-bot-info"><i class="fas ${isWarning ? 'fa-exclamation-triangle' : 'fa-info-circle'}"></i><span>${description}</span><button class="dismiss-info-btn" onclick="this.parentElement.style.display='none';">Verstanden</button></div>`;
    } else {
        container.innerHTML = '';
    }
}

function processBotResponse(response) {
    if (typeof response !== 'string') return '';
    const tempDiv = document.createElement('div');
    tempDiv.textContent = response;
    let safeText = tempDiv.innerHTML;
    
    safeText = safeText.replace(/\[Quelle:\s*(https?:\/\/[^\s\]]+)\]/g, '<a href="$1" class="source-link" target="_blank">🔗 Quelle</a>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/```([\s\S]*?)```/gs, '<pre><code>$1</code></pre>')
        .replace(/^\s*(?:---|\*\*\*|___)\s*$/gm, '<hr>').replace(/((?:^\s*[*+-]\s+.*(?:<br>|$))+)/gm, match => `<ul>${match.trim().split('<br>').map(item => item.trim() ? `<li>${item.replace(/^\s*[*+-]\s+/, '').trim()}</li>` : '').join('')}</ul>`);
        
    return safeText.trim();
}

function showLoading() { 
    document.getElementById('send-text').style.display = 'none'; 
    document.getElementById('loading').style.display = 'inline-block'; 
    const saveButton = document.querySelector('#create-project-modal button[onclick="saveProject()"]');
    if (saveButton) saveButton.disabled = true;
}
function hideLoading() { 
    document.getElementById('send-text').style.display = 'inline';
    document.getElementById('loading').style.display = 'none';
    const saveButton = document.querySelector('#create-project-modal button[onclick="saveProject()"]');
    if (saveButton) saveButton.disabled = false;
}
async function toggleTheme() { 
    const isDark = document.getElementById('theme-toggle').checked;
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme); 
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.THEME, value: theme });
}
async function changeAccentColor(color, shouldSave = true) {
    document.documentElement.setAttribute('data-accent-color', color);
    if (shouldSave) {
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.ACCENT_COLOR, value: color });
    }
}
async function toggleAutoSearch() { 
    isAutoSearchEnabled = document.getElementById('auto-search-toggle').checked;
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.AUTO_SEARCH, value: isAutoSearchEnabled });
}
function fileToBase64(file) { 
    return new Promise((resolve, reject) => { 
        const reader = new FileReader(); 
        reader.readAsDataURL(file); 
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error); 
    }); 
}
function handleFileSelect(event) {
    if(event.target.files[0]) {
        uploadedFile = event.target.files[0];
        document.getElementById('message-input').placeholder = `"${uploadedFile.name}" | Frage dazu stellen...`;
        document.querySelector('#upload-button i').style.color = 'var(--primary-accent)';
    }
}
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}
document.getElementById('new-interest').addEventListener('keypress', function(e) { if (e.key === 'Enter') addInterest(); });

function toggleSidebar() { 
    const container = document.querySelector('.main-container');
    container.classList.toggle('sidebar-collapsed');
    const isVisible = !container.classList.contains('sidebar-collapsed');
    document.querySelector('.hamburger').classList.toggle('active', isVisible);
    document.querySelector('.sidebar-toggle').classList.toggle('active', isVisible);
    if (window.innerWidth <= 768) {
        document.querySelector('.sidebar-overlay').classList.toggle('active', isVisible);
    }
}

function toggleTab(tabName) {
    const content = document.getElementById(`${tabName}-content`);
    const header = content.previousElementSibling;
    const isActive = content.classList.toggle('active');
    header.classList.toggle('active', isActive);
    
    document.querySelectorAll('.sidebar .tab-content').forEach(c => { if(c !== content) c.classList.remove('active'); });
    document.querySelectorAll('.sidebar .tab-header').forEach(h => { if(h !== header) h.classList.remove('active'); });
}

function showHelp() { 
    showNotification('Alle Hauptfunktionen findest du in der Sidebar. Erkunde sie einfach!', 'info'); 
}
function showAbout() { 
    showNotification('BredAI v21.1 - Dein anpassbarer KI-Chat-Assistent.', 'info'); 
}

function toggleVoiceMode() {
    isVoiceModeActive = !isVoiceModeActive;

    if (isVoiceModeActive) {
        voiceChatBtn.classList.add('active');
        voiceOverlay.classList.add('active');
        voiceChatHistory = [...chatHistory];
        startListening();
    } else {
        voiceChatBtn.classList.remove('active', 'listening');
        voiceChatBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceOverlay.classList.remove('active');
        voiceStatus.textContent = 'Sprachmodus ist inaktiv.';
        voiceTranscript.textContent = '';
        
        if (speechRecognition) speechRecognition.stop();
        window.speechSynthesis.cancel();
        isListening = false;
        isBotSpeaking = false; // WICHTIG: Den neuen Status beim Beenden zurücksetzen
    }
}

function startListening() {
    if (!isVoiceModeActive || isListening || isBotSpeaking) {
        console.log(`[Voice] ZUHÖREN BLOCKIERT. Grund: isVoiceModeActive=${isVoiceModeActive}, isListening=${isListening}, isBotSpeaking=${isBotSpeaking}`);
        return;
    }

    isListening = true;
    console.log(`[Voice] ZUHÖREN STARTET. isListening = ${isListening}`);
    
    voiceChatBtn.classList.add('listening');
    voiceChatBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    voiceStatus.textContent = 'Ich höre zu...';
    voiceStatus.classList.add('listening');
    voiceTranscript.textContent = '...';

    try {
        speechRecognition.start();
    } catch(e) {
        console.error("[Voice] Fehler beim Starten der Spracherkennung (möglicherweise bereits aktiv):", e);
        isListening = false; 
    }
}

async function handleVoiceResult(event) {
    // Diese Prüfung bleibt als letzte Verteidigungslinie.
    if (isBotSpeaking) {
        return;
    }

    isListening = false;
    const transcript = event.results[0][0].transcript.trim();

    // --- SCHRITT 1: SOFORTIGES BEENDEN DER ERKENNUNG ---
    // Nachdem wir das Ergebnis haben, sorgen wir sofort für Ruhe,
    // um ein automatisches Neustarten durch den Browser zu verhindern.
    forceStopAllAudio();

    console.log(`[Voice] ERGEBNIS ERHALTEN. isListening = ${isListening}. Transcript: "${transcript}"`);

    if (!transcript) {
        if (isVoiceModeActive) startListening();
        return;
    }
    
    voiceStatus.textContent = "Du sagtest:";
    voiceStatus.classList.remove('listening');
    voiceTranscript.textContent = `"${transcript}"`;
    
    voiceChatBtn.classList.remove('listening');
    voiceChatBtn.innerHTML = '<div class="loading"></div>';

    addMessage(transcript, 'user');
    await addToChatHistory(transcript, 'user');
    voiceChatHistory.push({ message: transcript, type: 'user' });

    try {
        const voiceSystemPrompt = getPersonalizedSystemPrompt(true);
        const botResponse = await sendGeminiTextMessage(transcript, MODELS['gemini'].id, voiceChatHistory, voiceSystemPrompt);
        
        const processedResponseForChat = processBotResponse(botResponse);
        addMessage(processedResponseForChat, 'bot');
        
        await addToChatHistory(botResponse, 'bot');
        voiceChatHistory.push({ message: botResponse, type: 'bot' });

        // Ruft die neue, sichere speakText-Funktion auf.
        speakText(botResponse);

    } catch (error) {
        console.error('API Error im Sprachmodus:', error);
        const errorMessage = `Entschuldigung, ein Fehler ist aufgetreten: ${error.message}`;
        addMessage(errorMessage, 'bot');
        speakText(errorMessage); 
    }
}

function handleVoiceError(event) {
    isListening = false;
    console.error('Fehler bei der Spracherkennung:', event.error);
    
    // Dieser Fehler tritt auf, wenn der Benutzer nichts sagt. Einfach neu starten.
    if (event.error === 'no-speech') {
        if (isVoiceModeActive) startListening();
        return;
    }
    
    // Dieser Fehler tritt auf, wenn die Mikrofon-Berechtigung fehlt oder verweigert wurde.
    if (event.error === 'not-allowed') {
        voiceStatus.textContent = 'Mikrofon-Zugriff verweigert.';
        voiceTranscript.textContent = 'Bitte erlaube den Zugriff in den Browser-Einstellungen, um dieses Feature zu nutzen.';
        // Voice-Modus beenden, da er ohne Mikrofon nicht funktioniert.
        // Ein Timeout gibt dem Nutzer Zeit, die Nachricht zu lesen.
        setTimeout(() => {
            if(isVoiceModeActive) toggleVoiceMode(); 
        }, 3000);
        return;
    }

    // Für alle anderen Fehler eine kurze Meldung anzeigen und dann erneut versuchen.
    voiceStatus.textContent = 'Ein Fehler ist aufgetreten.';
    voiceTranscript.textContent = `Fehler: ${event.error}`;
    
    setTimeout(() => {
        if (isVoiceModeActive) startListening();
    }, 2000); // 2 Sekunden Pause vor dem nächsten Versuch
}

// --- SPRACHAUSGABE (ERWEITERT) ---
function speakText(textToSpeak) {
    // --- SCHRITT 1: BRUTALES BEENDEN ALLER AUDIO-PROZESSE ---
    // Dies ist die wichtigste neue Zeile. Sie stellt sicher, dass das Mikrofon
    // garantiert aus ist, BEVOR der Bot zu sprechen beginnt.
    forceStopAllAudio();

    const cleanedText = stripHtmlAndMarkdown(textToSpeak);

    if (!cleanedText) {
        setTimeout(() => {
            if (isVoiceModeActive) startListening();
        }, MOBILE_SAFETY_DELAY);
        return;
    }

    // --- SCHRITT 2: SPERREN FÜR DEN GESAMTEN VORGANG ---
    isBotSpeaking = true; 
    console.log(`[Voice] SPRECHEN STARTET. isBotSpeaking = ${isBotSpeaking}.`);
    
    voiceChatBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
    voiceStatus.textContent = 'BredAI antwortet:';
    voiceTranscript.textContent = `"${cleanedText}"`;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'de-DE';
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;

    let selectedVoice = germanVoices.find(voice => voice.name === currentVoiceName);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    // --- SCHRITT 3: DER SICHERE ABLAUF MIT PUFFER ---
    utterance.onend = () => {
        console.log("[Voice] SPRECHEN BEENDET. Starte Sicherheitspuffer...");
        setTimeout(() => {
            console.log("[Voice] Puffer beendet. Gebe frei und starte Zuhören.");
            isBotSpeaking = false; 
            startListening();
        }, MOBILE_SAFETY_DELAY);
    };
    
    utterance.onerror = (event) => {
        console.error('[Voice] Fehler bei der Sprachausgabe:', event.error);
        isBotSpeaking = false; 
        setTimeout(() => {
            if (isVoiceModeActive) startListening();
        }, MOBILE_SAFETY_DELAY);
    };
    
    window.speechSynthesis.speak(utterance);
}

function stripHtmlAndMarkdown(text) {
    let cleanText = text.replace(/\*\*|\*|`|```|---|___/g, '');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanText;
    cleanText = tempDiv.textContent || tempDiv.innerText || '';
    return cleanText.trim();
}