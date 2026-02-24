/**
 * Das dbHelper-Objekt habe ich als zentralen Helfer für alle Interaktionen mit der IndexedDB gemacht.
 * Es kapselt die Komplexität der Datenbank-API und stellt einfache Methoden wie init, get, save und delete bereit.
 * So muss ich nicht in meinem restlichen Code ständig die gleichen, komplizierten DB-Transaktionen schreiben.
 */
const dbHelper = {
    db: null,
    DB_NAME: 'BredAIDB',
    DB_VERSION: 2,
    STORES: {
        PROFILES: 'profiles',
        APP_STATE: 'appState',
        API_USAGE: 'apiUsage'
    },

    /**
     * Diese Funktion initialisiert die Datenbankverbindung.
     * Ich habe sie so gebaut, dass sie nur einmal ausgeführt wird.
     * `onupgradeneeded` sorgt dafür, dass die Tabellen (Object Stores) erstellt werden, falls sie noch nicht existieren.
     */
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

    /**
     * Mit dieser Methode hole ich einen einzelnen Datensatz aus einem Store anhand seines Schlüssels.
     */
    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },

    /**
     * Diese Methode liest alle Datensätze aus einem angegebenen Store aus.
     */
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    },
    
    /**
     * Hiermit speichere oder aktualisiere ich einen Datensatz.
     * `put` ist praktisch, weil es sowohl das Erstellen als auch das Überschreiben handhabt.
     */
    async save(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    },

    /**
     * Diese Funktion dient zum Löschen eines Datensatzes anhand seines Schlüssels.
     */
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

/**
 * NEU: Lädt die Provider-spezifischen API-Schlüssel aus der IndexedDB.
 */
async function loadProviderApiKeys() {
    const storedKeys = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.API_KEYS);
    if (storedKeys && storedKeys.value) {
        providerApiKeys = storedKeys.value;
        console.log("[Provider API Key] Geladen:", providerApiKeys);

        // Fülle die Input-Felder für alle Provider
        const geminiInput = document.getElementById('gemini-api-key');
        const groqInput = document.getElementById('groq-api-key');
        const cerebrasInput = document.getElementById('cerebras-api-key');
        const nvidiaInput = document.getElementById('nvidia-api-key');

        if (geminiInput && providerApiKeys.gemini) geminiInput.value = providerApiKeys.gemini;
        if (groqInput && providerApiKeys.groq) groqInput.value = providerApiKeys.groq;
        if (cerebrasInput && providerApiKeys.cerebras) cerebrasInput.value = providerApiKeys.cerebras;
        if (nvidiaInput && providerApiKeys.nvidia) nvidiaInput.value = providerApiKeys.nvidia;
    }
}

/**
 * NEU: Speichert die Provider-spezifischen API-Schlüssel in der IndexedDB.
 */
async function saveProviderApiKeys() {
    const geminiInput = document.getElementById('gemini-api-key');
    const groqInput = document.getElementById('groq-api-key');
    const cerebrasInput = document.getElementById('cerebras-api-key');
    const nvidiaInput = document.getElementById('nvidia-api-key');

    providerApiKeys = {
        gemini: geminiInput ? geminiInput.value.trim() : '',
        groq: groqInput ? groqInput.value.trim() : '',
        cerebras: cerebrasInput ? cerebrasInput.value.trim() : '',
        nvidia: nvidiaInput ? nvidiaInput.value.trim() : ''
    };

    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.API_KEYS, value: providerApiKeys });
    showNotification('API-Schlüssel gespeichert!', 'info');
    checkAndShowApiKeyWarning();
}

/**
 * NEU: Öffnet das Hilfe-Modal für die API-Schlüssel.
 */
function openApiKeyHelpModal() {
    const modal = document.getElementById('api-key-help-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Prüft, ob ein API-Key für den aktuellen Provider verfügbar ist
 */
function hasApiKeyForProvider(provider) {
    const key = providerApiKeys[provider];
    return key && key.length > 0;
}

/**
 * Gibt den API-Key für den aktuellen Provider zurück
 */
function getApiKeyForProvider(provider) {
    return providerApiKeys[provider] || '';
}

/**
 * NEU: Fallback-System - Wechselt zum nächsten verfügbaren Provider
 */
async function getNextAvailableProvider(failedProvider) {
    const currentIndex = PROVIDER_FALLBACK_ORDER.indexOf(failedProvider);

    for (let i = 1; i < PROVIDER_FALLBACK_ORDER.length; i++) {
        const nextProvider = PROVIDER_FALLBACK_ORDER[(currentIndex + i) % PROVIDER_FALLBACK_ORDER.length];
        if (hasApiKeyForProvider(nextProvider)) {
            return nextProvider;
        }
    }

    // Wenn kein Provider verfügbar ist, versuche Cerebras als letzten Ausweg
    if (hasApiKeyForProvider('cerebras')) {
        return 'cerebras';
    }

    return null;
}

/**
 * Aktiviert den Fallback-Modus und informiert den User
 */
function activateFallback(reason, fromModel) {
    isFallbackActive = true;
    fallbackReason = reason;
    originalModel = currentModel;
    currentModel = FALLBACK_MODEL;

    console.log(`[Fallback] Aktiviert: ${reason}, von ${fromModel} zu ${FALLBACK_MODEL}`);

    // Fallback-Info im Chat anzeigen
    showFallbackInfo(reason);
}

/**
 * Zeigt Fallback-Info im Chat an
 */
function showFallbackInfo(reason) {
    const chatContainer = document.getElementById('chat-container');
    if (!chatContainer) return;

    const fallbackInfo = document.createElement('div');
    fallbackInfo.className = 'fallback-info';
    fallbackInfo.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        <span>Automatischer Wechsel zu ${MODELS[FALLBACK_MODEL].name} wegen: ${reason}</span>
    `;

    chatContainer.appendChild(fallbackInfo);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Deaktiviert den Fallback-Modus
 */
function deactivateFallback() {
    if (originalModel && MODELS[originalModel]) {
        currentModel = originalModel;
        originalModel = null;
    }
    isFallbackActive = false;
    fallbackReason = '';

    // Fallback-Infos ausblenden
    const fallbackInfos = document.querySelectorAll('.fallback-info');
    fallbackInfos.forEach(info => info.remove());
}

/**
 * In dieser Funktion zerlege ich die große `BREDAI_KNOWLEDGE_BASE` in kleinere, durchsuchbare Abschnitte (Chunks).
 * Das ist die Vorbereitung für mein internes RAG-System (Retrieval-Augmented Generation).
 * So kann ich gezielt nur die relevantesten Teile der Wissensbasis an die KI senden, anstatt immer den gesamten Text.
 */
function preprocessKnowledgeBase() {
    const sections = BREDAI_KNOWLEDGE_BASE.split(/\n### |\n---/g).filter(Boolean);
    
    knowledgeChunks = sections.map((sectionContent, index) => {
        const lines = sectionContent.trim().split('\n');
        const title = lines[0].replace(/#/g, '').trim(); 
        return {
            id: `chunk_${index}`,
            title: title,
            content: sectionContent.trim()
        };
    }).filter(chunk => chunk.content.length > 50);

    console.log(`[RAG-System] Wissensbasis erfolgreich in ${knowledgeChunks.length} Abschnitte aufgeteilt.`);
}

/**
 * Diese Funktion durchsucht die vorbereiteten Wissens-Chunks.
 * Ich habe hier ein einfaches, aber effektives Scoring-System implementiert:
 * Treffer im Titel eines Chunks werden höher bewertet als Treffer im Inhalt.
 * Am Ende gebe ich die zwei relevantesten Chunks zurück.
 */
function retrieveRelevantKnowledge(query) {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    if (queryWords.length === 0) return [];

    const scoredChunks = knowledgeChunks.map(chunk => {
        let score = 0;
        const contentLower = chunk.content.toLowerCase();
        const titleLower = chunk.title.toLowerCase();

        queryWords.forEach(word => {
            if (contentLower.includes(word)) {
                score++;
            }
            if (titleLower.includes(word)) {
                score += 3;
            }
        });

        return { ...chunk, score };
    });

    const relevantChunks = scoredChunks
        .filter(chunk => chunk.score > 0)
        .sort((a, b) => b.score - a.score);
    
    return relevantChunks.slice(0, 2);
}

/**
 * Mit dieser Funktion zeige ich Toast-Benachrichtigungen an.
 * Ich habe sie so gestaltet, dass sie einen Typ (info/error) entgegennimmt,
 * das passende Icon anzeigt und sich nach ein paar Sekunden von selbst wieder ausblendet.
 */
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
    }, 3900);
}

/**
 * Dies ist die Haupt-Initialisierungsfunktion der gesamten Anwendung.
 * Ich rufe hier der Reihe nach alle wichtigen Start-Funktionen auf, von der DB-Initialisierung
 * über das Laden der Profile bis zum Rendern der kompletten Benutzeroberfläche.
 */
async function initializeSystem() {
    await dbHelper.init();
    await loadProviderApiKeys(); // Lade Provider-API-Keys
    preprocessKnowledgeBase();
    await loadProfiles();
    loadProfileData();
    await renderFullUI();
    checkFirstVisit();
    initializeSpeechAPI();
    await loadAndCacheVoices();
    await loadVoiceSettings();
    checkAndShowApiKeyWarning(); // Prüfe API-Keys am Ende
}

/**
 * Diese Funktion wird beim Start der Anwendung aufgerufen, nachdem der DOM vollständig geladen ist.
 * Ich habe hier einen try-catch-Block eingebaut, um eventuelle Fehler beim Start abzufangen
 * und dem Nutzer eine verständliche Fehlermeldung anzuzeigen.
 */
document.addEventListener('DOMContentLoaded', async function() {
    // REPARIERT: Alle Zuweisungen von DOM-Elementen und Event-Listenern sind jetzt sicher hier drin.
    // Zuerst werden die globalen Variablen, die für die UI wichtig sind, zugewiesen.
    voiceInterruptBtn = document.getElementById('voice-interrupt-button');
    voiceOverlay = document.getElementById('voice-overlay');
    voiceStatus = document.getElementById('voice-status');
    voiceTranscript = document.getElementById('voice-transcript');
    voiceChatBtn = document.getElementById('voice-chat-btn');
    textarea = document.getElementById('message-input');
    const newInterestInput = document.getElementById('new-interest');
    const projectFileInput = document.getElementById('project-file-input');

    // Dann werden Event-Listener nur hinzugefügt, wenn die Elemente auch wirklich existieren.
    if (textarea) {
        textarea.addEventListener('input', adjustTextareaHeight);
    }
    if (newInterestInput) {
        newInterestInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') addInterest(); });
    }
    if (projectFileInput) {
        projectFileInput.addEventListener('change', handleProjectFileSelect);
    }
    
    try {
        await initializeSystem();
        
        if (window.innerWidth <= 768) {
            const container = document.querySelector('.main-container');
            if (container && !container.classList.contains('sidebar-collapsed')) {
                toggleSidebar();
            }
        }
    } catch (error) {
        console.error("Initialization failed:", error);
        const errorMessage = error.message || "Unbekannter Initialisierungsfehler.";
        showNotification("Anwendung konnte nicht initialisiert werden. Bitte neu laden. Fehler: " + errorMessage, 'error');
    }

    // NEU: Service Worker für PWA registrieren
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./service-worker.js')
                .then(registration => {
                    console.log('PWA ServiceWorker: Registrierung erfolgreich. Scope:', registration.scope);
                })
                .catch(err => {
                    console.error('PWA ServiceWorker: Registrierung fehlgeschlagen:', err);
                });
        });
    }
});

/**
 * NEU: Prüft, ob API-Schlüssel vorhanden sind und zeigt ggf. eine permanente Warnung im Chat an.
 */
function checkAndShowApiKeyWarning() {
    const container = document.getElementById('chat-container');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.querySelector('.send-btn');

    if (!container || !messageInput || !sendBtn) return;

    const existingWarning = document.getElementById('api-key-warning');
    const modelInfo = MODELS[currentModel];
    const provider = modelInfo ? modelInfo.provider : 'gemini';

    // Prüfen ob mindestens EIN API-Key irgendeines Providers vorhanden ist
    const hasAnyKey = Object.values(providerApiKeys).some(key => key && key.length > 0);

    let hasRequiredKey = hasApiKeyForProvider(provider);
    let providerName = getProviderDisplayName(provider);
    let keyMissingMessage = `Für die Nutzung von ${providerName} ist ein API-Schlüssel erforderlich.`;

    if (!hasRequiredKey) {
        // Wenn der aktuelle Provider keinen Key hat, aber andere schon, wechsle automatisch
        const availableProvider = Object.keys(providerApiKeys).find(p => providerApiKeys[p] && providerApiKeys[p].length > 0);
        if (availableProvider) {
            const availableModel = Object.keys(MODELS).find(key => MODELS[key].provider === availableProvider);
            if (availableModel) {
                currentModel = availableModel;
                showNotification(`Wechsle zu ${MODELS[availableModel].name} (API-Key verfügbar)`, 'info');
                updateCurrentConfig();
                messageInput.disabled = false;
                sendBtn.disabled = false;
                updateChatUI();
                if (existingWarning) existingWarning.remove();
                return;
            }
        }
    }

    if (!hasRequiredKey) {
        if (!existingWarning || existingWarning.dataset.provider !== provider) {
            if (existingWarning) existingWarning.remove();
            container.innerHTML = `
                <div class="api-key-warning" id="api-key-warning" data-provider="${provider}">
                    <i class="fas fa-key"></i>
                    <h4>${providerName} API-Schlüssel fehlt</h4>
                    <p>${keyMissingMessage}</p>
                    <button onclick="toggleSidebar(); setTimeout(() => toggleTab('api-keys'), 350);">
                        <i class="fas fa-plus-circle"></i> Schlüssel jetzt hinzufügen
                    </button>
                </div>
            `;
        }
        messageInput.disabled = true;
        sendBtn.disabled = true;
        messageInput.placeholder = "Bitte zuerst API-Schlüssel hinzufügen...";
    } else {
        if (existingWarning) {
            loadChatSession(currentSessionId);
        }
        messageInput.disabled = false;
        sendBtn.disabled = false;
        updateChatUI();
    }
}

/**
 * Gibt den Anzeigenamen für einen Provider zurück
 */
function getProviderDisplayName(provider) {
    const names = {
        gemini: 'Google Gemini',
        groq: 'Groq',
        cerebras: 'Cerebras',
        nvidia: 'Nvidia NIM'
    };
    return names[provider] || provider;
}

/**
 * Diese Funktion ruft alle einzelnen Render-Funktionen auf, um die komplette
 * Benutzeroberfläche basierend auf den geladenen Daten zu zeichnen.
 */
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

/**
 * Hiermit prüfe ich, ob es der erste Besuch des Nutzers ist.
 * Wenn nur das temporäre Standardprofil existiert, öffne ich automatisch
 * das Modal zur Profilerstellung, um den Nutzer willkommen zu heißen.
 */
function checkFirstVisit() {
    if (Object.keys(profiles).length === 1 && profiles[currentProfileId] && profiles[currentProfileId].name === 'Temporäres Profil') {
        setTimeout(() => {
            const modal = document.getElementById('profile-modal');
            if (modal) {
                // Wir fügen ein Attribut hinzu, um zu wissen, dass dies der erste Start ist.
                modal.dataset.firstStart = "true";
                modal.classList.add('active');
            }
        }, 1000);
    }
}

/**
 * Diese Funktion lädt UI-spezifische Einstellungen wie das Farbschema und den Dark-Mode
 * aus der Datenbank und wendet sie direkt auf die Oberfläche an.
 */
async function loadUISettings() {
    const accentColorSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.ACCENT_COLOR);
    const savedAccentColor = accentColorSetting ? accentColorSetting.value : 'green';
    changeAccentColor(savedAccentColor, false);
    const accentSelect = document.getElementById('accent-color-select');
    if (accentSelect) accentSelect.value = savedAccentColor;

    const themeSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.THEME);
    const savedTheme = themeSetting ? themeSetting.value : 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) themeToggle.checked = savedTheme === 'dark';
    
    const autoSearchSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.AUTO_SEARCH);
    isAutoSearchEnabled = autoSearchSetting ? autoSearchSetting.value : true;
    const autoSearchToggle = document.getElementById('auto-search-toggle');
    if (autoSearchToggle) autoSearchToggle.checked = isAutoSearchEnabled;

    const tempSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.TEMPERATURE);
    temperature = tempSetting ? parseFloat(tempSetting.value) : 0.7;
    const tempSlider = document.getElementById('temperature-slider');
    if (tempSlider) tempSlider.value = temperature;
    const tempValue = document.getElementById('temperature-value');
    if (tempValue) tempValue.textContent = temperature;

    const topPSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.TOP_P);
    topP = topPSetting ? parseFloat(topPSetting.value) : 0.95;
    const topPSlider = document.getElementById('top-p-slider');
    if (topPSlider) topPSlider.value = topP;
    const topPValue = document.getElementById('top-p-value');
    if (topPValue) topPValue.textContent = topP;
}

/**
 * Hier richte ich die Speech Recognition API des Browsers ein.
 * Ich prüfe, ob die API überhaupt verfügbar ist, und konfiguriere sie für die deutsche Sprache.
 * Außerdem lege ich die Event-Handler fest, die auf Ergebnisse, Fehler oder das Ende der Erkennung reagieren.
 */
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

        speechRecognition.onend = () => {
            isListening = false;
            if (isVoiceModeActive && !isBotSpeaking && !isListening) {
                setTimeout(() => {
                    if (isVoiceModeActive && !isBotSpeaking && !isListening) {
                        console.log("Spracherkennung wird vom 'onend'-Event neu gestartet.");
                        startListening();
                    }
                }, 100);
            }
        };
    } catch (error) {
        console.warn("Speech API initialization failed, voice features disabled:", error.message);
        speechRecognition = null;
        const voiceChatButton = document.getElementById('voice-chat-btn');
        if (voiceChatButton) {
            voiceChatButton.style.display = 'none';
        }
    }
}

/**
 * Diese Funktion lädt die verfügbaren Stimmen des Browsers für die Sprachausgabe.
 * Da dies asynchron geschehen kann, habe ich eine Logik mit mehreren Versuchen eingebaut.
 * Ich priorisiere dabei qualitativ hochwertige deutsche Stimmen, insbesondere männliche, um eine angenehme Standardstimme zu haben.
 */
function loadAndCacheVoices() {
    return new Promise((resolve) => {
        const voiceSelect = document.getElementById('voice-select');
        // REPARIERT: Wenn das Element nicht existiert, brechen wir ab, um Fehler zu vermeiden.
        if (!voiceSelect) {
            console.error("Element 'voice-select' nicht gefunden. Sprachauswahl nicht möglich.");
            return resolve();
        }
        let attempts = 0;
        
        const findAndSetVoices = () => {
            const allVoices = speechSynthesis.getVoices();
            
            if (allVoices.length > 0) {
                germanVoices = allVoices.filter(voice => voice.lang === 'de-DE');
                voiceSelect.innerHTML = ''; 

                if (germanVoices.length > 0) {
                    germanVoices.forEach(voice => {
                        const option = document.createElement('option');
                        option.textContent = `${voice.name} (${voice.lang})`;
                        option.value = voice.name;
                        voiceSelect.appendChild(option);
                    });

                    let preferredVoice = germanVoices.find(v => v.name === 'Google Deutsch');
                    if (!preferredVoice) {
                        preferredVoice = germanVoices.find(v => v.name.toLowerCase().includes('stefan'));
                    }
                    if (!preferredVoice) {
                        preferredVoice = germanVoices.find(v => v.name.toLowerCase().includes('google'));
                    }

                    if (currentVoiceName && germanVoices.some(v => v.name === currentVoiceName)) {
                        voiceSelect.value = currentVoiceName;
                    } else if (preferredVoice) {
                        currentVoiceName = preferredVoice.name;
                        voiceSelect.value = currentVoiceName;
                        console.log("Bevorzugte männliche Stimme als Standard gesetzt:", currentVoiceName);
                    } else if (germanVoices.length > 0) {
                        currentVoiceName = germanVoices[0].name;
                        voiceSelect.value = currentVoiceName;
                    }
                    
                    updateVoiceSetting('voice', voiceSelect.value);
                    resolve();
                    return;
                }
            }
            
            attempts++;
            if (attempts < 10) {
                setTimeout(findAndSetVoices, 250);
            } else {
                console.error("Konnte nach mehreren Versuchen keine Stimmen laden.");
                voiceSelect.innerHTML = '<option>Stimmen nicht verfügbar</option>';
                resolve();
            }
        };
        
        speechSynthesis.onvoiceschanged = findAndSetVoices;
        findAndSetVoices();
    });
}

/**
 * Diese Funktion schaltet den Sprachmodus ein oder aus.
 * Ich sorge hier dafür, dass das Overlay angezeigt/versteckt wird,
 * die Spracherkennung gestartet/gestoppt wird und der Zustand korrekt verwaltet wird.
 */
function toggleVoiceMode() {
    if (!voiceChatBtn || !voiceOverlay) return;
    isVoiceModeActive = !isVoiceModeActive;

    if (isVoiceModeActive) {
        voiceChatBtn.classList.add('active');
        voiceOverlay.classList.add('active');
        voiceChatHistory = [...chatHistory];

        const botSelect = document.getElementById('voice-bot-select');
        if (botSelect) {
            botSelect.innerHTML = '';
            const allBots = [
                ...Object.entries(BOT_PERSONALITIES).map(([id, data]) => ({ ...data, id, isCustom: false })),
                ...customBots.map(bot => ({ ...bot, isCustom: true }))
            ];
            allBots.forEach(bot => {
                const displayText = bot.isCustom ? bot.displayText : `${bot.emoji} ${bot.name}`;
                const option = document.createElement('option');
                option.value = bot.id;
                option.textContent = displayText;
                botSelect.appendChild(option);
            });
            botSelect.value = currentBot;
        }

        startListening();
    } else {
        voiceChatBtn.classList.remove('active', 'listening');
        voiceChatBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceOverlay.classList.remove('active');
        if (voiceStatus) voiceStatus.textContent = 'Sprachmodus ist inaktiv.';
        if (voiceTranscript) voiceTranscript.textContent = '';
        
        if (speechRecognition) speechRecognition.stop();
        window.speechSynthesis.cancel();
        isListening = false;
        isBotSpeaking = false;
    }
}

/**
 * Hiermit reagiere ich auf die Bot-Auswahl im Sprachmodus-Overlay.
 * Ich wechsle den Bot, gebe dem Nutzer eine akustische Bestätigung
 * und sorge dafür, dass die Sprachausgabe und -erkennung sauber neu gestartet werden.
 */
function handleVoiceBotChange(botId) {
    if (activeProjectId) {
        showNotification("Bot kann nicht geändert werden, während ein Projekt aktiv ist.", 'info');
        const voiceBotSelect = document.getElementById('voice-bot-select');
        if (voiceBotSelect) voiceBotSelect.value = currentBot;
        return;
    }

    selectBot(botId);
    
    const botInfo = allBotPersonalities[botId] || {};
    const feedbackMessage = `Okay, ich habe zu ${botInfo.name} gewechselt.`;
    
    window.speechSynthesis.cancel();
    isBotSpeaking = false;
    if (speechRecognition) speechRecognition.stop();
    isListening = false;
    
    speakText(feedbackMessage);
}

/**
 * Startet den Zuhör-Vorgang der Spracherkennung.
 * Ich habe hier mehrfache Prüfungen eingebaut, um sicherzustellen,
 * dass die Erkennung nicht gestartet wird, wenn sie bereits läuft oder der Bot gerade spricht.
 */
function startListening() {
    if (!isVoiceModeActive || isListening || isBotSpeaking || !speechRecognition) return;

    isListening = true;
    if (voiceChatBtn) {
        voiceChatBtn.classList.add('listening');
        voiceChatBtn.innerHTML = '<i class="fas fa-microphone"></i>';
    }
    if (voiceStatus) {
        voiceStatus.textContent = 'Ich höre zu...';
        voiceStatus.classList.add('listening');
    }
    if (voiceTranscript) voiceTranscript.textContent = '...';

    try {
        speechRecognition.start();
    } catch(e) {
        console.error("Fehler beim Starten der Spracherkennung:", e);
        isListening = false;
    }
}

/**
 * Diese Funktion wird aufgerufen, wenn die Spracherkennung ein Ergebnis liefert.
 * Ich extrahiere den erkannten Text, füge ihn als Nutzernachricht hinzu,
 * sende ihn an die KI und lasse die Antwort anschließend vorlesen.
 */
async function handleVoiceResult(event) {
    if (isBotSpeaking) {
        console.log("Spracherkennung während der Sprachausgabe ignoriert.");
        return;
    }

    isListening = false;
    const transcript = event.results[0][0].transcript.trim();

    if (!transcript) {
        if (isVoiceModeActive) startListening();
        return;
    }

    if (voiceStatus) voiceStatus.textContent = "Verarbeite...";
    if (voiceTranscript) voiceTranscript.textContent = ''; 
    
    if (voiceChatBtn) {
        voiceChatBtn.classList.remove('listening');
        voiceChatBtn.innerHTML = '<div class="loading"></div>';
    }

    addMessage(transcript, 'user');
    
    const historyForAPI = [...voiceChatHistory];
    await addToChatHistory(transcript, 'user');
    voiceChatHistory.push({ message: transcript, type: 'user' });

    try {
        const voiceSystemPrompt = getPersonalizedSystemPrompt(true);
        const botResponse = await sendGeminiTextMessage(transcript, MODELS['gemini'].id, historyForAPI, voiceSystemPrompt);
        
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

/**
 * Diese Funktion nimmt einen Text entgegen und lässt ihn vom Browser vorlesen.
 * Ich habe hier Logik eingebaut, um den Text von HTML- und Markdown-Formatierungen zu reinigen.
 * Außerdem stelle ich sicher, dass während der Sprachausgabe die Spracherkennung pausiert ist
 * und danach automatisch wieder startet.
 */
function speakText(textToSpeak) {
    const cleanedText = stripHtmlAndMarkdown(textToSpeak);

    if (!cleanedText) {
        isBotSpeaking = false; 
        if (isVoiceModeActive) startListening();
        return;
    }

    if (speechRecognition) {
        speechRecognition.stop();
    }

    isBotSpeaking = true; 
    
    const botName = allBotPersonalities[currentBot]?.name || 'Bot';
    if(voiceInterruptBtn) {
        voiceInterruptBtn.innerHTML = `<i class="fas fa-hand-paper"></i> ${botName} unterbrechen`;
        voiceInterruptBtn.style.display = 'flex';
    }

    if (voiceStatus) voiceStatus.textContent = 'BredAI antwortet:';
    if (voiceTranscript) voiceTranscript.textContent = `"${cleanedText}"`;

    const utterance = new SpeechSynthesisUtterance(cleanedText);
    utterance.lang = 'de-DE';
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;

    let selectedVoice = germanVoices.find(voice => voice.name === currentVoiceName);
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }

    const cleanupAndRestart = () => {
        isBotSpeaking = false;
        if (voiceInterruptBtn) voiceInterruptBtn.style.display = 'none';
        if (isVoiceModeActive) {
            startListening(); 
        }
    };
    
    utterance.onend = cleanupAndRestart;
    
    utterance.onerror = (event) => {
        console.error('Fehler bei der Sprachausgabe:', event.error);
        cleanupAndRestart();
    };
    
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
}

/**
 * Hier fange ich Fehler der Spracherkennung ab.
 * Ich unterscheide zwischen harmlosen Fehlern wie "no-speech" (niemand hat gesprochen)
 * und kritischen wie "not-allowed" (Mikrofonzugriff verweigert) und gebe passendes Feedback.
 */
function handleVoiceError(event) {
    isListening = false;
    console.error('Fehler bei der Spracherkennung:', event.error);
    
    if (event.error === 'no-speech') {
        if (isVoiceModeActive) startListening();
        return;
    }
    
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        if (voiceStatus) voiceStatus.textContent = 'Mikrofon-Zugriff verweigert.';
        if (voiceTranscript) voiceTranscript.textContent = 'Bitte erlaube den Zugriff in den Browser-Einstellungen.';
        setTimeout(() => { if(isVoiceModeActive) toggleVoiceMode(); }, 4000);
        return;
    }

    if (voiceStatus) voiceStatus.textContent = 'Ein Fehler ist aufgetreten.';
    if (voiceTranscript) voiceTranscript.textContent = `Fehler: ${event.error}`;
    
    setTimeout(() => {
        if (isVoiceModeActive) startListening();
    }, 2000);
}

/**
 * Lädt die gespeicherten Einstellungen für die Sprachausgabe (Geschwindigkeit, Tonhöhe, Stimme)
 * aus der Datenbank und stellt die Regler und das Auswahlmenü entsprechend ein.
 */
async function loadVoiceSettings() {
    const rateSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.VOICE_RATE);
    voiceRate = rateSetting ? parseFloat(rateSetting.value) : 1.1;
    const rateSlider = document.getElementById('voice-rate-slider');
    if (rateSlider) rateSlider.value = voiceRate;

    const pitchSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.VOICE_PITCH);
    voicePitch = pitchSetting ? parseFloat(pitchSetting.value) : 1.0;
    const pitchSlider = document.getElementById('voice-pitch-slider');
    if (pitchSlider) pitchSlider.value = voicePitch;

    const voiceNameSetting = await dbHelper.get(dbHelper.STORES.APP_STATE, SETTING_KEYS.VOICE_NAME);
    currentVoiceName = voiceNameSetting ? voiceNameSetting.value : null;
    
    const voiceSelect = document.getElementById('voice-select');
    if (currentVoiceName && voiceSelect && voiceSelect.options.length > 1) {
        voiceSelect.value = currentVoiceName;
    }
}

/**
 * Diese Funktion wird aufgerufen, wenn der Nutzer einen der Regler oder das Stimmen-Menü ändert.
 * Ich aktualisiere die entsprechende globale Variable und speichere den neuen Wert sofort in der Datenbank.
 */
async function updateVoiceSetting(type, value) {
    if (type === 'rate') {
        voiceRate = parseFloat(value);
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.VOICE_RATE, value: voiceRate });
    } else if (type === 'pitch') {
        voicePitch = parseFloat(value);
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.VOICE_PITCH, value: voicePitch });
    } else if (type === 'voice') {
        currentVoiceName = value;
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.VOICE_NAME, value: currentVoiceName });
    }
}

/**
 * Lädt alle gespeicherten Profile aus der IndexedDB.
 * Ich habe hier eine Logik eingebaut, die das zuletzt aktive Profil wiederherstellt.
 * Falls kein Profil existiert, erstelle ich ein temporäres Standardprofil.
 */
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
                chatSessions: [],
                contextSummaries: [] // NEU
            };
            profiles[newId] = defaultProfile;
            await dbHelper.save(dbHelper.STORES.PROFILES, defaultProfile);
            currentProfileId = newId;
        }
    }
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.LAST_PROFILE, value: currentProfileId });
}

/**
 * Nachdem ein Profil geladen wurde, befülle ich mit dieser Funktion die globalen Variablen
 * (wie `customBots`, `userInterests`, etc.) mit den Daten des aktiven Profils.
 */
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

/**
 * Diese Funktion wechselt das aktive Profil. Das ist ein großer Schritt,
 * daher speichere ich die neue Profil-ID und initialisiere danach das gesamte System neu,
 * um sicherzustellen, dass alle Daten und die UI konsistent sind.
 */
async function switchProfile(profileId) {
    if (profileId === currentProfileId) return;
    currentProfileId = profileId;
    activeProjectId = null;
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.LAST_PROFILE, value: profileId });
    await initializeSystem();
}

/**
 * Öffnet das Modal zur Erstellung eines neuen Profils und leert die Eingabefelder.
 */
function openCreateProfileModal() {
    const profileName = document.getElementById('profile-name');
    if (profileName) profileName.value = '';
    const profileAge = document.getElementById('profile-age');
    if (profileAge) profileAge.value = '';
    const profileDescription = document.getElementById('profile-description');
    if (profileDescription) profileDescription.value = '';
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) profileModal.classList.add('active');
}

/**
 * Speichert ein neues Profil, das im Modal erstellt wurde.
 * Ich validiere, dass ein Name eingegeben wurde, speichere das neue Profil in der DB
 * und wechsle direkt zu diesem neuen Profil.
 */
async function saveProfile() {
    const saveButton = document.getElementById('save-profile-btn');
    const buttonText = document.getElementById('save-profile-btn-text');
    const nameInput = document.getElementById('profile-name');
    const name = nameInput ? nameInput.value.trim() : '';

    if (!name) {
        showNotification('Bitte gib einen Namen für das Profil ein!', 'error');
        return;
    }

    if (saveButton) saveButton.disabled = true;
    if (buttonText) buttonText.textContent = 'Speichern...';

    try {
        const newId = 'profile_' + Date.now();
        const ageInput = document.getElementById('profile-age');
        const descriptionInput = document.getElementById('profile-description');
        const newProfile = {
            id: newId,
            name: name,
            age: ageInput ? ageInput.value : '',
            description: descriptionInput ? descriptionInput.value : '',
            customBots: [],
            interests: [],
            projects: [],
            chatSessions: [],
            contextSummaries: [] // NEU
        };
        profiles[newId] = newProfile;
        await dbHelper.save(dbHelper.STORES.PROFILES, newProfile);

        const profileModal = document.getElementById('profile-modal');
        if (profileModal) {
            profileModal.classList.remove('active');
            if (profileModal.dataset.firstStart === "true") {
                delete profileModal.dataset.firstStart; // Attribut entfernen
                startTour();
            }
        }
        
        await switchProfile(newId);

    } catch (error) {
        console.error("Fehler beim Speichern des Profils:", error);
        showNotification("Das Profil konnte nicht gespeichert werden. Bitte versuche es erneut.", 'error');
    } finally {
        if (saveButton) saveButton.disabled = false;
        if (buttonText) buttonText.textContent = 'Profil speichern';
    }
}

/**
 * Diese Funktion schließt das Profil-Erstellungs-Modal, wenn der Nutzer auf "Ohne Profil fortfahren" klickt.
 */
function skipProfileCreation() {
    const profileModal = document.getElementById('profile-modal');
    if (profileModal) {
        profileModal.classList.remove('active');
        // NEU: Prüfen, ob die Tour gestartet werden soll
        if (profileModal.dataset.firstStart === "true") {
            delete profileModal.dataset.firstStart; // Attribut entfernen
            startTour();
        }
    }
}
    
/**
 * Erstellt eine neue, leere Chat-Sitzung.
 * Ich füge sie an den Anfang des `chatSessions`-Arrays und achte darauf,
 * dass die Gesamtanzahl der Sitzungen nicht zu groß wird (hier max. 50).
 */
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

/**
 * Lädt eine spezifische Chat-Sitzung aus dem Verlauf.
 * Ich setze hier alle relevanten globalen Variablen (currentBot, currentModel, etc.)
 * auf die Werte der geladenen Sitzung und rendere den Chat-Verlauf neu.
 */
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
    if (container) {
        container.innerHTML = ''; 
        if (chatHistory.length === 0) {
            addWelcomeMessage();
        } else {
            chatHistory.forEach(msg => addMessage(msg.message, msg.type, true));
        }
    }
    
    document.querySelectorAll('.bot-item').forEach(item => item.classList.toggle('active', item.dataset.bot === currentBot));
    document.querySelectorAll('.model-item').forEach(item => item.classList.toggle('active', item.dataset.model === currentModel));
    document.querySelectorAll('.history-item').forEach(item => item.classList.toggle('active', item.dataset.sessionId === sessionId));
    renderProjectList(); 

    updateCurrentConfig();
    updateBotInfoMessage();
    checkAndShowApiKeyWarning(); // Sicherstellen, dass die Warnung weg ist, wenn Keys da sind
}

/**
 * Startet einen komplett neuen Chat.
 * Ich setze hierfür das aktive Projekt zurück, erstelle eine neue Session
 * und speichere den aktuellen Zustand des Profils.
 */
async function newChat() {
    activeProjectId = null;
    createNewSession(true);
    loadChatSession(currentSessionId);
    renderProjectList();
    await saveCurrentProfileData();
}

/**
 * Prüft, ob ein Gespräch lang genug ist (10 Nachrichten) und fasst es dann
 * mithilfe einer KI in 5 Wörtern zusammen, um es dem Langzeitgedächtnis des Profils hinzuzufügen.
 */
async function summarizeConversationIfNeeded(session) {
    // Nur bei der 10. Nachricht auslösen und nur, wenn noch nicht zusammengefasst
    if (!session || session.history.length !== 10 || session.isSummarized) {
        return;
    }

    console.log(`[Kontext] Die Konversation ${session.id} hat 10 Nachrichten erreicht. Starte Zusammenfassung.`);

    try {
        const conversationText = session.history.map(h => `${h.type === 'user' ? 'User' : 'Bot'}: ${h.message}`).join('\n');
        const prompt = `Fasse das Kernthema der folgenden Konversation in maximal 10 prägnanten Wörtern zusammen. Konzentriere dich auf das Hauptziel oder das zentrale Thema des Nutzers. Beispiele: "Reise nach Japan planen", "Python-Skript für Datenanalyse debuggen", "Über psychologische Konzepte diskutieren", "Einen Fitnessplan erstellen".\n\nKonversation:\n"""\n${conversationText}\n"""\n\nZusammenfassung (max 10 Wörter):`;

        const modelId = MODELS['gemini-check'].id; // Ein schnelles Modell für interne Aufgaben
        const apiKey = await getNextAvailableApiKey(modelId);
        
        const response = await fetch(`${GEMINI_BASE_URL}${modelId}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!response.ok) {
            throw new Error(`API Fehler bei der Zusammenfassung`);
        }

        const data = await response.json();
        const summary = data.candidates[0].content.parts[0].text.trim().replace(/"/g, '');

        if (summary) {
            const profile = profiles[currentProfileId];
            if (!profile.contextSummaries) {
                profile.contextSummaries = [];
            }
            
            profile.contextSummaries.push(summary);

            // Langzeitgedächtnis auf die letzten 30 Einträge beschränken
            if (profile.contextSummaries.length > 30) {
                profile.contextSummaries.shift();
            }
            
            // Session als zusammengefasst markieren
            session.isSummarized = true;
            
            // Profil mit der neuen Zusammenfassung speichern
            await saveCurrentProfileData();
            console.log(`[Kontext] Zusammenfassung hinzugefügt: "${summary}"`);
        }
    } catch (error) {
        console.error("Fehler beim Zusammenfassen der Konversation:", error);
        // Wir wollen den Haupt-Thread nicht blockieren, also fangen wir den Fehler hier ab.
    }
}

/**
 * Fügt eine neue Nachricht zum Verlauf der aktuellen Chat-Sitzung hinzu.
 * Wenn es die erste Nutzernachricht in einem "Neuen Chat" ist, benenne ich die Sitzung
 * automatisch nach dem Anfang der Nachricht.
 */
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

    // NEU: Aufruf der Zusammenfassungsfunktion
    await summarizeConversationIfNeeded(session);

    await saveCurrentProfileData();
    renderChatHistoryList();
}

/**
 * Dies ist eine zentrale Speicherfunktion.
 * Immer wenn sich wichtige Daten des aktiven Profils ändern (z.B. neue Interessen, neuer Chat),
 * rufe ich diese Funktion auf, um das gesamte Profilobjekt in der IndexedDB zu aktualisieren.
 */
async function saveCurrentProfileData() {
    if (profiles[currentProfileId]) {
        profiles[currentProfileId].customBots = customBots;
        profiles[currentProfileId].interests = userInterests;
        profiles[currentProfileId].projects = projects;
        profiles[currentProfileId].chatSessions = chatSessions;
        await dbHelper.save(dbHelper.STORES.PROFILES, profiles[currentProfileId]);
    }
}

/**
 * Rendert die Liste der verfügbaren Benutzerprofile in der Sidebar.
 * Ich sorge dafür, dass das aktive Profil hervorgehoben wird und bei den anderen
 * ein Löschen-Button angezeigt wird (außer beim letzten verbleibenden Profil).
 */
function renderProfileList() {
    const container = document.getElementById('profiles-container');
    if (!container) return;
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

/**
 * Löscht ein Profil nach einer Sicherheitsabfrage.
 * Ich habe sichergestellt, dass das letzte Profil nicht gelöscht werden kann.
 * Nach dem Löschen wechsle ich automatisch zum ersten verbleibenden Profil.
 */
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

/**
 * Diese Funktion sorgt dafür, dass die Höhe des Texteingabefeldes dynamisch
 * mit dem Inhalt wächst, was eine bessere User Experience bietet.
 */
const adjustTextareaHeight = () => {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
    if (textarea.scrollHeight > parseInt(getComputedStyle(textarea).maxHeight)) {
        textarea.style.overflowY = 'auto';
    } else {
        textarea.style.overflowY = 'hidden';
    }
};

/**
 * Rendert die Liste der letzten Chat-Sitzungen in der Sidebar.
 * Ich habe eine "Mehr laden"-Funktion eingebaut, die weitere 10 Chats anzeigt,
 * um die Ladezeit bei sehr vielen Chats zu optimieren.
 */
function renderChatHistoryList(scrollToBottom = false) {
    const container = document.getElementById('chat-history-container');
    if (!container) return;
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

/**
 * Zeichnet die Liste aller verfügbaren Bots (Standard und benutzerdefiniert) in die Sidebar.
 * Bei den benutzerdefinierten Bots füge ich einen Löschen-Button hinzu.
 */
function renderBotList() {
    const container = document.getElementById('bot-list-container');
    if (!container) return;
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

/**
 * Stellt die Liste der erstellten Projekte in der Sidebar dar.
 * Das aktive Projekt wird visuell hervorgehoben.
 */
function renderProjectList() {
    const container = document.getElementById('project-list-container');
    if (!container) return;
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

/**
 * Rendert die Liste der verfügbaren KI-Modelle in der Sidebar.
 */
function renderModelList() {
    const container = document.getElementById('model-list-container');
    if (!container) return;
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

/**
 * Zeigt die Interessen des Nutzers als klickbare Tags in der Sidebar an.
 */
function updateInterestsDisplay() {
    const container = document.getElementById('interests-container');
    if (!container) return;
    container.innerHTML = '';
    userInterests.forEach(interest => {
        const tag = document.createElement('div');
        tag.className = 'interest-tag';
        tag.innerHTML = `${interest} <span class="remove-btn">×</span>`;
        tag.querySelector('.remove-btn').onclick = () => removeInterest(interest);
        container.appendChild(tag);
    });
}

/**
 * Aktualisiert die Konfigurationsanzeige oben im Chat-Fenster.
 * Hier zeige ich an, welches Projekt, welcher Bot, welches Modell und welches Profil gerade aktiv sind.
 */
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

/**
 * Passt die Chat-UI basierend auf den Fähigkeiten des aktuell ausgewählten Modells an.
 * Ich blende zum Beispiel den Datei-Upload-Button aus, wenn das Modell keine Bilder verarbeiten kann
 * oder wenn ein Projekt aktiv ist.
 */
function updateChatUI() {
    const uploadButton = document.getElementById('upload-button');
    const messageInput = document.getElementById('message-input');
    if (!messageInput) return; // Guard clause

    const selectedModel = MODELS[currentModel];
    if (!selectedModel) {
        messageInput.placeholder = "Fehler: Modell nicht gefunden!";
        if (uploadButton) uploadButton.style.display = 'none';
        return;
    }

    const modelName = selectedModel.name || 'Unbekannt';
    const uploadIcon = document.querySelector('#upload-button i');

    if (selectedModel.capabilities.includes('vision') && !activeProjectId) { 
        if (uploadButton) uploadButton.style.display = 'block';
        messageInput.placeholder = `Nachricht an ${modelName} ...`;
    } else {
        if (uploadButton) uploadButton.style.display = 'none';
        messageInput.placeholder = `Nachricht an ${modelName}...`;
        if (uploadedFile) {
            uploadedFile = null;
            const fileInput = document.getElementById('file-input');
            if (fileInput) fileInput.value = null;
            if (uploadIcon) uploadIcon.style.color = '#aaa';
        }
    }
}

/**
 * Diese Funktion habe ich für den Sprachmodus implementiert. Sie erlaubt es dem Nutzer,
 * die Sprachausgabe des Bots durch einen Klick zu unterbrechen und sofort wieder mit dem Zuhören zu beginnen.
 */
function interruptAndRestartListening() {
    if (!isVoiceModeActive) return;

    console.log("[Voice] Manuelle Unterbrechung durch Button.");
    window.speechSynthesis.cancel();
    
    isBotSpeaking = false;
    if (voiceInterruptBtn) voiceInterruptBtn.style.display = 'none';
    startListening();
}

/**
 * Wählt einen Bot aus. Ich habe eine Sperre eingebaut, die verhindert,
 * dass der Bot gewechselt wird, während ein Projekt aktiv ist, da Projekte an einen festen Bot gebunden sind.
 */
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

/**
 * Wählt ein KI-Modell aus. Auch hier verhindert eine Sperre den Wechsel, wenn ein Projekt aktiv ist.
 */
function selectModel(modelId) {
    if (activeProjectId) {
        showNotification("Modell kann nicht geändert werden, während ein Projekt aktiv ist.", 'info');
        return;
    }
    currentModel = modelId;
    renderModelList();
    updateCurrentConfig();
    updateChatUI();
    checkAndShowApiKeyWarning();
}

/**
 * Wählt ein Projekt aus oder deaktiviert es.
 * Wenn ein Projekt aktiviert wird, stelle ich automatisch den damit verknüpften Bot ein.
 * Wenn dasselbe Projekt erneut angeklickt wird, deaktiviere ich es.
 */
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

/**
 * Fügt ein neues Interesse zur Liste des Nutzers hinzu und speichert es.
 */
async function addInterest() {
    const input = document.getElementById('new-interest');
    if (!input) return;
    const interest = input.value.trim();
    if (interest && !userInterests.includes(interest)) {
        userInterests.push(interest);
        updateInterestsDisplay();
        await saveCurrentProfileData();
        input.value = '';
    }
}

/**
 * Entfernt ein Interesse aus der Liste des Nutzers und speichert die Änderung.
 */
async function removeInterest(interestToRemove) {
    userInterests = userInterests.filter(i => i !== interestToRemove);
    updateInterestsDisplay();
    await saveCurrentProfileData();
}

/**
 * Öffnet das Modal zur Erstellung eines eigenen Bots und befüllt das Modell-Auswahlmenü.
 */
function openCreateBotModal() {
    const botName = document.getElementById('custom-bot-name');
    if(botName) botName.value = '';
    const botDisplay = document.getElementById('custom-bot-display');
    if(botDisplay) botDisplay.value = '';
    const botPrompt = document.getElementById('custom-bot-prompt');
    if(botPrompt) botPrompt.value = '';
    
    const modelSelect = document.getElementById('custom-bot-model');
    if(modelSelect){
        modelSelect.innerHTML = '';
        for (const [key, model] of Object.entries(MODELS)) {
            if (model.name) modelSelect.innerHTML += `<option value="${key}">${model.emoji} ${model.name}</option>`;
        }
    }
    
    const modal = document.getElementById('create-bot-modal');
    if(modal) modal.classList.add('active');
}

/**
 * Speichert einen neu erstellten, benutzerdefinierten Bot.
 */
async function saveCustomBot() {
    const nameInput = document.getElementById('custom-bot-name');
    const displayInput = document.getElementById('custom-bot-display');
    const promptInput = document.getElementById('custom-bot-prompt');
    const modelSelect = document.getElementById('custom-bot-model');
    const tempSlider = document.getElementById('custom-bot-temperature-slider');
    const topPSlider = document.getElementById('custom-bot-top-p-slider');

    const name = nameInput ? nameInput.value.trim() : '';
    const displayText = displayInput ? displayInput.value.trim() : '';
    const prompt = promptInput ? promptInput.value.trim() : '';
    const modelId = modelSelect ? modelSelect.value : 'gemini';
    const botTemperature = tempSlider ? parseFloat(tempSlider.value) : 0.7;
    const botTopP = topPSlider ? parseFloat(topPSlider.value) : 0.95;

    if (!name || !displayText || !prompt) { 
        showNotification("Bitte fülle alle Felder aus.", 'error'); 
        return; 
    }
    
    customBots.push({ 
        id: 'custom_' + Date.now(), 
        name, 
        displayText, 
        prompt, 
        modelId,
        temperature: botTemperature,
        topP: botTopP
    });

    updateAllBotPersonalities();
    await saveCurrentProfileData();
    renderBotList();
    const modal = document.getElementById('create-bot-modal');
    if (modal) modal.classList.remove('active');
}

/**
 * Löscht einen benutzerdefinierten Bot nach einer Sicherheitsabfrage.
 */
async function deleteCustomBot(botId) {
    if (!confirm("Bist du sicher, dass du diesen Bot löschen möchtest?")) return;
    customBots = customBots.filter(bot => bot.id !== botId);
    updateAllBotPersonalities();
    if (currentBot === botId) currentBot = 'bred';
    await saveCurrentProfileData();
    renderBotList();
    updateCurrentConfig();
}

/**
 * Öffnet das Modal zum Erstellen eines neuen Projekts.
 */
function openCreateProjectModal() {
    projectModalFiles = [];
    const idInput = document.getElementById('project-id-input');
    if (idInput) idInput.value = '';
    const nameInput = document.getElementById('project-name-input');
    if (nameInput) nameInput.value = '';
    const textsInput = document.getElementById('project-texts-input');
    if (textsInput) textsInput.value = '';
    const fileInput = document.getElementById('project-file-input');
    if (fileInput) fileInput.value = null;
    
    renderProjectModalFileList(); 

    const botSelect = document.getElementById('project-bot-select');
    if(botSelect) {
        botSelect.innerHTML = '';
        const allBots = [
            ...Object.entries(BOT_PERSONALITIES).map(([id, data]) => ({ ...data, id, isCustom: false })),
            ...customBots.map(bot => ({ ...bot, isCustom: true }))
        ];
        allBots.forEach(bot => {
            const displayText = bot.isCustom ? bot.displayText : `${bot.emoji} ${bot.name}`;
            botSelect.innerHTML += `<option value="${bot.id}">${displayText}</option>`;
        });
    }
    
    const modal = document.getElementById('create-project-modal');
    if (modal) modal.classList.add('active');
}

/**
 * Verarbeitet die im Projekt-Modal ausgewählten Dateien.
 * Ich habe hier eine Prüfung eingebaut, um Duplikate zu vermeiden und das Limit für die Dateianzahl zu respektieren.
 */
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

/**
 * Rendert die Liste der zum Projekt hinzugefügten Dateien im Modal.
 */
function renderProjectModalFileList() {
    const fileListDiv = document.getElementById('project-file-list');
    if (!fileListDiv) return;
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

    if (uploadButton) {
        uploadButton.disabled = projectModalFiles.length >= MAX_PROJECT_FILES;
        uploadButton.style.opacity = uploadButton.disabled ? '0.6' : '1';
        uploadButton.style.cursor = uploadButton.disabled ? 'not-allowed' : 'pointer';
    }
}

/**
 * Entfernt eine Datei aus der temporären Liste im Projekt-Modal.
 */
function removeProjectModalFile(index) {
    projectModalFiles.splice(index, 1);
    renderProjectModalFileList();
}

/**
 * Speichert ein komplettes Projekt.
 * Ich konvertiere hier alle hinzugefügten Dateien in Base64-Strings,
 * damit sie direkt im Projektobjekt in der IndexedDB gespeichert werden können.
 */
async function saveProject() {
    const nameInput = document.getElementById('project-name-input');
    const name = nameInput ? nameInput.value.trim() : '';
    if (!name) { 
        showNotification("Bitte gib einen Namen für das Projekt ein.", 'error'); 
        return; 
    }

    showLoading();
    
    const fileDataPromises = projectModalFiles.map(file => 
        fileToBase64(file).then(base64 => ({ name: file.name, type: file.type, data: base64 }))
    );
    const files = await Promise.all(fileDataPromises);

    const botSelect = document.getElementById('project-bot-select');
    const textsInput = document.getElementById('project-texts-input');
    const newProject = {
        id: 'project_' + Date.now(),
        name: name,
        botId: botSelect ? botSelect.value : 'bred',
        knowledgeBase: {
            texts: [textsInput ? textsInput.value.trim() : ''],
            files: files
        }
    };
    
    projects.push(newProject);
    await saveCurrentProfileData();
    renderProjectList();
    
    hideLoading();
    const modal = document.getElementById('create-project-modal');
    if (modal) modal.classList.remove('active');
}

/**
 * Löscht ein Projekt nach einer Sicherheitsabfrage.
 */
async function deleteProject(projectId) {
    if (!confirm("Bist du sicher, dass du dieses Projekt löschen möchtest?")) return;
    projects = projects.filter(p => p.id !== projectId);
    if (activeProjectId === projectId) activeProjectId = null;
    await saveCurrentProfileData();
    renderProjectList();
    updateCurrentConfig();
}

/**
 * Aktualisiert das `allBotPersonalities`-Objekt, das eine kombinierte Sicht
 * auf Standard- und benutzerdefinierte Bots bietet. Das ist nützlich für den schnellen Zugriff.
 */
function updateAllBotPersonalities() {
    // Startet mit einer Kopie der Standard-Bots
    allBotPersonalities = { ...BOT_PERSONALITIES };

    // Geht jeden Custom Bot durch
    customBots.forEach(bot => {
        allBotPersonalities[bot.id] = { ...bot };
    });
}

/**
 * Diese Funktion entscheidet, ob für eine Nutzeranfrage eine Websuche notwendig ist.
 * Ich schicke hierfür eine Anfrage an ein schnelles KI-Modell und frage explizit,
 * ob eine Suche für eine aktuelle, faktenbasierte Antwort erforderlich ist.
 */
async function checkIfSearchIsNeeded(message) {
    const prompt = `Prüfe die folgende Benutzeranfrage kritisch. Ist eine Echtzeit-Websuche UNBEDINGT erforderlich, um eine genaue, aktuelle und faktenbasierte Antwort zu geben? Antworte NUR mit "JA" oder "NEIN". JA bei: aktuellen Ereignissen, spezifischen Fakten (Preise, Daten), unbekannten Personen/Orten, Links oder Bitten um Zusammenfassungen. Im Zweifelsfall, antworte mit "JA". Anfrage: "${message}"`;
    const checkModelId = MODELS['gemini-check'].id;
    const apiKey = await getNextAvailableApiKey(checkModelId);
    const response = await fetch(`${GEMINI_BASE_URL}${checkModelId}:generateContent?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
    if (!response.ok) throw new Error(`API Fehler Suchprüfung`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text.trim().toUpperCase().includes("JA");
}

/**
 * Generiert aus einer längeren Nutzeranfrage eine kurze, präzise Google-Suchanfrage.
 * Auch hierfür nutze ich eine kurze Anfrage an die KI.
 */
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

/**
 * Führt die eigentliche Websuche über die Google Custom Search API durch
 * und gibt die Ergebnisse in einem sauberen Format zurück.
 */
async function performWebSearch(query) {
    const url = `${CUSTOM_SEARCH_API_URL}?key=${CUSTOM_SEARCH_API_KEY}&cx=${CUSTOM_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=5`;
    const response = await fetch(url);
    if (response.status === 429) throw new Error("Tageslimit für Websuche erreicht.");
    if (!response.ok) throw new Error(`Google API Fehler`);
    const data = await response.json();
    return data.items?.map(item => ({ title: item.title, link: item.link, snippet: item.snippet })) || [];
}

/**
 * Dies ist die Kernfunktion für die Projekt-Chats (RAG).
 * Ich baue hier einen speziellen Prompt, der die KI anweist, ihre Antwort AUSSCHLIESSLICH
 * auf die im Projekt hinterlegten Texte und Dateien zu stützen.
 * Das gesamte Wissen des Projekts wird im selben API-Aufruf mitgeschickt.
 */
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

/**
 * Zeigt eine Statusmeldung für die Suche im Chat-Bereich an.
 */
function showSearchStatus(message) { 
    const container = document.getElementById('search-status-container');
    if (container) container.innerHTML = `<div class="search-status-message">${message}</div>`;
}

/**
 * Versteckt die Statusmeldung für die Suche.
 */
function hideSearchStatus() { 
    const container = document.getElementById('search-status-container');
    if (container) container.innerHTML = ''; 
}

/**
 * Dies ist die zentrale Funktion, die ausgelöst wird, wenn der Nutzer eine Nachricht sendet.
 * Ich habe hier die komplette Logik implementiert:
 * 1. Nachricht zur UI hinzufügen und im Verlauf speichern.
 * 2. Prüfen, ob ein Projekt aktiv ist (dann `getProjectRagResponse` aufrufen).
 * 3. Ansonsten: Prüfen, ob eine Websuche oder eine interne Wissenssuche nötig ist.
 * 4. Die Anfrage an die entsprechende Gemini-Funktion (Text oder Multimodal) senden.
 * 5. Die Antwort verarbeiten und im Chat anzeigen.
 * 6. Fehler abfangen und anzeigen.
 */
async function sendMessage() {
    const input = document.getElementById('message-input');
    if (!input) return;
    let message = input.value.trim();
    if (!message && !uploadedFile) return;

    const userMessageText = uploadedFile ? `${message || "Beschreibe die Datei."} (Anhang: ${uploadedFile.name})` : message;
    addMessage(userMessageText, 'user');

    const historyForAPI = [...chatHistory];
    await addToChatHistory(userMessageText, 'user');

    const tempFile = uploadedFile;
    input.value = '';
    uploadedFile = null;
    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = null;
    const uploadIcon = document.querySelector('#upload-button i');
    if (uploadIcon) uploadIcon.style.color = '#aaa';

    adjustTextareaHeight();
    updateChatUI();
    showLoading();
    hideSearchStatus();

    try {
        let botResponse;
        if (activeProjectId) {
            const project = projects.find(p => p.id === activeProjectId);
            if (!project) throw new Error("Aktives Projekt nicht gefunden.");
            botResponse = await getProjectRagResponse(message, project, historyForAPI);
        } else {
            const modelInfo = MODELS[currentModel];
            let messageToSend = message;

            const appKeywords = ['bredai', 'funktion', 'einstellen', 'sidebar', 'projekt', 'bot', 'wechseln', 'wie geht', 'kannst du', 'wo finde ich'];
            const isQueryAboutApp = appKeywords.some(key => messageToSend.toLowerCase().includes(key));

            let internalKnowledgeContext = "";
            if (isQueryAboutApp) {
                const relevantChunks = retrieveRelevantKnowledge(messageToSend);
                if (relevantChunks.length > 0) {
                    showSearchStatus("Suche in interner Wissensbasis...");
                    internalKnowledgeContext = "Beantworte die folgende Frage des Nutzers. Nutze dafür den beigefügten Kontext aus der internen Wissensbasis. Antworte natürlich in deinem Charakter und zitiere den Kontext nicht direkt.\n\n" +
                                            "--- KONTEXT AUS WISSENSBASIS ---\n" +
                                            relevantChunks.map(c => c.content).join("\n---\n") +
                                            "\n--- ENDE DES KONTEXTS ---\n\n" +
                                            "Frage des Nutzers: ";
                }
            }

            let finalMessageForApi = internalKnowledgeContext + messageToSend;

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
                            finalMessageForApi += `\n\n(Anweisung: Websuche nach '${searchQuery}' war erfolglos. Antworte basierend auf eigenem Wissen.)`;
                        } else {
                            const snippets = searchResults.map(r => `[Quelle: ${r.link}]\n${r.snippet}`).join('\n\n');
                            finalMessageForApi = `Beantworte die Frage präzise mit folgenden Ergebnissen. Zitiere Quellen als Links [Quelle: LINK].\n[Suchergebnisse]:\n${snippets}\n\n[Originalfrage]:\n${message}`;
                        }
                        showSearchStatus("✅ Ergebnisse werden verarbeitet...");
                    } catch (e) {
                        showSearchStatus(`Fehler bei Websuche. Fahre ohne Suche fort.`);
                        finalMessageForApi += `\n\n(Anweisung: Erwähne einen Fehler bei der Websuche.)`;
                    }
                    botResponse = await sendWithFallback(finalMessageForApi, modelInfo.id, historyForAPI);
                } else {
                    botResponse = await sendWithFallback(finalMessageForApi, modelInfo.id, historyForAPI);
                }
            } else {
                // Alle anderen Provider (Groq, Cerebras, Nvidia) verwenden sendWithFallback
                botResponse = await sendWithFallback(finalMessageForApi, modelInfo.id, historyForAPI);
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

/**
 * Diese sehr wichtige Funktion baut den finalen System-Prompt für die KI zusammen.
 * Ich starte mit dem Basis-Prompt des ausgewählten Bots und ersetze dann dynamisch
 * alle Platzhalter ({name}, {profile_interests}, etc.) mit den echten Daten des Nutzers.
 * Für den Sprachmodus füge ich eine spezielle, zusätzliche Anweisung hinzu, die die KI bittet, besonders kurz und gesprächig zu antworten.
 */
function getPersonalizedSystemPrompt(isForVoice = false) {
    const personality = allBotPersonalities[currentBot] || { prompt: 'Sei ein hilfsbereiter Assistent.' };
    const activeProfile = profiles[currentProfileId] || {};

    let systemPrompt = personality.prompt;

    systemPrompt = systemPrompt.replace(/{name}/g, (activeProfile.name || 'dem Benutzer'));
    systemPrompt = systemPrompt.replace(/{profile_name}/g, (activeProfile.name || 'unbekannt'));
    systemPrompt = systemPrompt.replace(/{profile_age}/g, (activeProfile.age || 'unbekannt'));
    systemPrompt = systemPrompt.replace(/{profile_description}/g, (activeProfile.description || 'keine'));
    
    const interestsText = userInterests.length > 0 ? userInterests.join(', ') : 'keine angegeben';
    systemPrompt = systemPrompt.replace(/{profile_interests}/g, interestsText);

    let customBotInfoText = 'Der Nutzer hat noch keine eigenen Bots erstellt.';
    if (customBots && customBots.length > 0) {
        const botList = customBots.map(bot => 
            `- **${bot.displayText || bot.name}:** Definiert als "${bot.prompt.substring(0, 150)}..."`
        ).join('\n');
        customBotInfoText = `Hier ist eine Liste der vom Nutzer erstellten Bots:\n${botList}`;
    }
    systemPrompt = systemPrompt.replace(/{custom_bot_list}/g, customBotInfoText);

    let projectInfoText = 'Der Nutzer hat noch keine Projekte erstellt.';
    if (projects && projects.length > 0) {
        const projectList = projects.map(p => `- **${p.name}**`).join('\n');
        projectInfoText = `Hier ist eine Liste der vom Nutzer erstellten Projekte:\n${projectList}`;
    }
    systemPrompt = systemPrompt.replace(/{project_list}/g, projectInfoText);
    
    // NEU: Langzeitgedächtnis einfügen
    const summaries = activeProfile.contextSummaries || [];
    let memoryContext = "Der Nutzer hatte bisher noch keine anderen relevanten Konversationen.";
    if (summaries.length > 0) {
        memoryContext = `Hier sind kurze Zusammenfassungen der letzten Konversationen des Nutzers. Nutze sie, um ein Langzeitgedächtnis über seine Interessen und Aktivitäten aufzubauen und so personalisierter zu antworten:\n- ${summaries.join('\n- ')}`;
    }
    systemPrompt = systemPrompt.replace(/{long_term_memory}/g, memoryContext);

    if (isForVoice) {
        systemPrompt += "\n\nSEHR WICHTIGE ANWEISUNG FÜR DEN SPRACHMODUS: Deine Antwort wird von einer Text-to-Speech-Engine vorgelesen. Formuliere deine Antwort daher **extrem kurz und gesprächig**, idealerweise nur **ein bis zwei Sätze**. VERWENDE ABSOLUT UNTER KEINEN UMSTÄNDEN EMOJIS, Sternchen (*), oder andere Markdown-Formatierungen. Antworte nur mit reinem, fließendem Text, der sich für eine Sprachausgabe eignet. Fasse dich kurz und komm direkt auf den Punkt, als wärst du in einem echten Gespräch.";
    }

    return systemPrompt;
}

/**
 * Sendet eine multimodale Anfrage (Text + Bild/Datei) an die Gemini API.
 */
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

/**
 * HAUPT-API-FUNKTION mit Timeout und Fallback
 * Sendet eine Anfrage an den aktuellen Provider und wechselt bei Fehler/Timeout automatisch
 */
async function sendWithFallback(message, modelId, history = chatHistory, systemPromptOverride = null) {
    const modelInfo = MODELS[modelId];
    if (!modelInfo) {
        throw new Error(`Modell ${modelId} nicht gefunden`);
    }

    const provider = modelInfo.provider;
    const startTime = Date.now();

    try {
        // API-Aufruf mit Timeout
        const result = await Promise.race([
            callProviderAPI(message, modelId, history, systemPromptOverride),
            createTimeoutPromise(API_TIMEOUT_MS)
        ]);

        return result;
    } catch (error) {
        const elapsed = Date.now() - startTime;
        const errorMessage = error.message.toLowerCase();

        // Prüfen ob Timeout oder API-Fehler
        const isTimeout = errorMessage.includes('timeout') || elapsed >= API_TIMEOUT_MS;
        const isRateLimit = errorMessage.includes('rate limit') || errorMessage.includes('quota') || response?.status === 429;

        console.log(`[API Error] Provider: ${provider}, Error: ${error.message}, Elapsed: ${elapsed}ms`);

        // Versuche Fallback
        const nextProvider = await getNextAvailableProvider(provider);

        if (nextProvider) {
            activateFallback(isTimeout ? 'Timeout (>30s)' : error.message, modelId);

            // Finde ein Modell des neuen Providers
            const fallbackModelKey = Object.keys(MODELS).find(key => MODELS[key].provider === nextProvider);
            if (fallbackModelKey) {
                currentModel = fallbackModelKey;
                showNotification(`Wechsle zu ${MODELS[fallbackModelKey].name} wegen: ${isTimeout ? 'Timeout' : 'Fehler'}`, 'info');
                return await callProviderAPI(message, MODELS[fallbackModelKey].id, history, systemPromptOverride);
            }
        }

        throw error;
    }
}

/**
 * Timeout-Promise für API-Aufrufe
 */
function createTimeoutPromise(timeoutMs) {
    return new Promise((_, reject) => {
        setTimeout(() => {
            reject(new Error('Timeout: API-Antwort dauerte zu lange'));
        }, timeoutMs);
    });
}

/**
 * Ruft die passende Provider-API auf
 */
async function callProviderAPI(message, modelId, history, systemPromptOverride) {
    const modelInfo = MODELS[modelId];
    const provider = modelInfo.provider;

    if (provider === 'gemini') {
        return await sendGeminiTextMessage(message, modelId, history, systemPromptOverride);
    } else if (provider === 'groq') {
        return await sendGroqMessage(message, modelId, history, systemPromptOverride);
    } else if (provider === 'cerebras') {
        return await sendCerebrasMessage(message, modelId, history, systemPromptOverride);
    } else if (provider === 'nvidia') {
        return await sendNvidiaMessage(message, modelId, history, systemPromptOverride);
    } else {
        throw new Error(`Unbekannter Provider: ${provider}`);
    }
}

/**
 * Sendet eine Anfrage an die Gemini API
 */
async function sendGeminiTextMessage(message, modelId, history = chatHistory, systemPromptOverride = null) {
    const apiKey = getApiKeyForProvider('gemini');
    if (!apiKey) {
        throw new Error("Kein Gemini API-Key konfiguriert.");
    }

    const contents = [
        ...history.slice(-15).map(entry => ({
            role: entry.type === 'user' ? 'user' : 'model',
            parts: [{ text: entry.message }]
        })),
        { role: 'user', parts: [{ text: message }] }
    ];

    const systemPrompt = systemPromptOverride ? systemPromptOverride : getPersonalizedSystemPrompt();
    const activeBot = allBotPersonalities[currentBot];
    const generationConfig = {
        temperature: activeBot && activeBot.temperature !== undefined ? activeBot.temperature : temperature,
        topP: activeBot && activeBot.topP !== undefined ? activeBot.topP : topP
    };

    const requestBody = {
        contents: contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: generationConfig
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
            throw new Error(errorJson.error?.message || `Gemini API Fehler`);
        } catch (e) {
            throw new Error(`Gemini API Fehler`);
        }
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

/**
 * Sendet eine Anfrage an die Groq API (OpenAI-kompatibel)
 */
async function sendGroqMessage(message, modelId, history = chatHistory, systemPromptOverride = null) {
    const apiKey = getApiKeyForProvider('groq');
    if (!apiKey) {
        throw new Error("Kein Groq API-Key konfiguriert.");
    }

    const modelInfo = MODELS[modelId];
    const systemPrompt = systemPromptOverride ? systemPromptOverride : getPersonalizedSystemPrompt();
    const activeBot = allBotPersonalities[currentBot];

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-15).map(entry => ({
            role: entry.type === 'user' ? 'user' : 'assistant',
            content: entry.message
        })),
        { role: 'user', content: message }
    ];

    const requestBody = {
        model: modelInfo.id,
        messages: messages,
        temperature: activeBot && activeBot.temperature !== undefined ? activeBot.temperature : temperature,
        max_tokens: 8192
    };

    const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Groq API Error:", response.status, errorBody);
        try {
            const errorJson = JSON.parse(errorBody);
            throw new Error(errorJson.error?.message || `Groq API Fehler`);
        } catch (e) {
            throw new Error(`Groq API Fehler`);
        }
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Sendet eine Anfrage an die Cerebras API (OpenAI-kompatibel)
 */
async function sendCerebrasMessage(message, modelId, history = chatHistory, systemPromptOverride = null) {
    const apiKey = getApiKeyForProvider('cerebras');
    if (!apiKey) {
        throw new Error("Kein Cerebras API-Key konfiguriert.");
    }

    const modelInfo = MODELS[modelId];
    const systemPrompt = systemPromptOverride ? systemPromptOverride : getPersonalizedSystemPrompt();
    const activeBot = allBotPersonalities[currentBot];

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-15).map(entry => ({
            role: entry.type === 'user' ? 'user' : 'assistant',
            content: entry.message
        })),
        { role: 'user', content: message }
    ];

    const requestBody = {
        model: modelInfo.id,
        messages: messages,
        temperature: activeBot && activeBot.temperature !== undefined ? activeBot.temperature : temperature,
        max_tokens: 8192
    };

    const response = await fetch(`${CEREBRAS_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Cerebras API Error:", response.status, errorBody);
        throw new Error(`Cerebras API Fehler: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Sendet eine Anfrage an die NVIDIA NIM API (OpenAI-kompatibel)
 */
async function sendNvidiaMessage(message, modelId, history = chatHistory, systemPromptOverride = null) {
    const apiKey = getApiKeyForProvider('nvidia');
    if (!apiKey) {
        throw new Error("Kein Nvidia API-Key konfiguriert.");
    }

    const modelInfo = MODELS[modelId];
    const systemPrompt = systemPromptOverride ? systemPromptOverride : getPersonalizedSystemPrompt();
    const activeBot = allBotPersonalities[currentBot];

    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-15).map(entry => ({
            role: entry.type === 'user' ? 'user' : 'assistant',
            content: entry.message
        })),
        { role: 'user', content: message }
    ];

    const requestBody = {
        model: modelInfo.id,
        messages: messages,
        temperature: activeBot && activeBot.temperature !== undefined ? activeBot.temperature : temperature,
        max_tokens: 4096
    };

    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.text();
        console.error("Nvidia API Error:", response.status, errorBody);
        throw new Error(`Nvidia API Fehler: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

/**
 * Fügt eine neue Nachrichtenblase zum Chat-Container hinzu.
 * Ich unterscheide hier, ob die Nachricht beim initialen Laden der Seite hinzugefügt wird
 * (ohne Animation) oder im laufenden Betrieb (mit Animation und Scroll).
 */
function addMessage(text, type, isInitialLoad = false) {
    const container = document.getElementById('chat-container');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `message ${type}`;
    if (type === 'bot') {
        div.innerHTML = text;
    } else {
        div.textContent = text;
    }
    
    container.appendChild(div);
    
    if (!isInitialLoad) {
        div.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
        div.style.opacity = '1';
    }
}

/**
 * Zeigt die Willkommensnachricht an, wenn ein neuer, leerer Chat geladen wird.
 */
function addWelcomeMessage() {
    const container = document.getElementById('chat-container');
    if (!container) return;
    const activeProfile = profiles[currentProfileId] || {};
    const welcomeText = `Hallo ${activeProfile.name || ''}! Wie kann ich dir heute helfen? 👋`;
    container.innerHTML = `<div class="message bot" style="opacity: 1;"><span>${welcomeText}</span></div><div id="bot-info-message-container"></div>`;
    updateBotInfoMessage();
}

/**
 * Leert den Verlauf der aktuellen Chat-Sitzung.
 */
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

/**
 * Zeigt die spezielle Info-Nachricht für bestimmte Bots (z.B. die Warnung für "Monday") an.
 */
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

/**
 * Diese Hilfsfunktion habe ich geschrieben, um Text von HTML- und Markdown-Formatierungen zu bereinigen.
 * Das ist besonders wichtig für die Sprachausgabe, damit der Bot nicht versucht, z.B. "**fett**" vorzulesen.
 */
function stripHtmlAndMarkdown(text) {
    if (typeof text !== 'string') {
        return '';
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    let cleanText = tempDiv.textContent || tempDiv.innerText || '';

    cleanText = cleanText.replace(/(\*\*|__|~~|\*|_|`|---|#)/g, '');
    cleanText = cleanText.replace(/\[Quelle:\s*https?:\/\/[^\]]+\]/g, '');

    const emojiAndSymbolRegex = /[^a-zA-Z0-9\s.,?!:;äöüÄÖÜß-]/g;
    cleanText = cleanText.replace(emojiAndSymbolRegex, '');

    cleanText = cleanText.replace(/\s\s+/g, ' ').trim();

    return cleanText;
}

/**
 * Verarbeitet die rohe Textantwort der KI und wandelt sie in formatiertes HTML um.
 * Ich ersetze hier Markdown-Syntax (wie `**fett**` oder `[Quelle:...]`) durch die entsprechenden HTML-Tags.
 */
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

/**
 * Zeigt die Ladeanimation im Senden-Button an.
 */
function showLoading() { 
    const sendText = document.getElementById('send-text');
    if (sendText) sendText.style.display = 'none'; 
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'inline-block'; 
    const saveButton = document.querySelector('#create-project-modal button[onclick="saveProject()"]');
    if (saveButton) saveButton.disabled = true;
}

/**
 * Versteckt die Ladeanimation im Senden-Button.
 */
function hideLoading() { 
    const sendText = document.getElementById('send-text');
    if (sendText) sendText.style.display = 'inline';
    const loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
    const saveButton = document.querySelector('#create-project-modal button[onclick="saveProject()"]');
    if (saveButton) saveButton.disabled = false;
}

/**
 * Schaltet zwischen dem hellen und dunklen Theme um und speichert die Auswahl.
 */
async function toggleTheme() { 
    const themeToggle = document.getElementById('theme-toggle');
    const isDark = themeToggle ? themeToggle.checked : false;
    const theme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme); 
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.THEME, value: theme });
}

/**
 * Ändert die Akzentfarbe der gesamten Anwendung und speichert die Auswahl.
 */
async function changeAccentColor(color, shouldSave = true) {
    document.documentElement.setAttribute('data-accent-color', color);
    if (shouldSave) {
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.ACCENT_COLOR, value: color });
    }
}

/**
 * Aktiviert oder deaktiviert die automatische Websuche und speichert die Einstellung.
 */
async function toggleAutoSearch() { 
    const autoSearchToggle = document.getElementById('auto-search-toggle');
    isAutoSearchEnabled = autoSearchToggle ? autoSearchToggle.checked : true;
    await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.AUTO_SEARCH, value: isAutoSearchEnabled });
}

/**
 * Eine Hilfsfunktion, die eine Datei in einen Base64-String umwandelt.
 * Das habe ich gebraucht, um Dateien in der IndexedDB und in API-Anfragen speichern zu können.
 */
function fileToBase64(file) { 
    return new Promise((resolve, reject) => { 
        const reader = new FileReader(); 
        reader.readAsDataURL(file); 
        reader.onload = () => resolve(reader.result.split(',')[1]); 
        reader.onerror = error => reject(error); 
    }); 
}

/**
 * Verarbeitet die Auswahl einer Datei über den Upload-Button im Chat.
 */
function handleFileSelect(event) {
    if(event.target.files[0]) {
        uploadedFile = event.target.files[0];
        const messageInput = document.getElementById('message-input');
        if (messageInput) messageInput.placeholder = `"${uploadedFile.name}" | Frage dazu stellen...`;
        const uploadIcon = document.querySelector('#upload-button i');
        if (uploadIcon) uploadIcon.style.color = 'var(--primary-accent)';
    }
}

/**
 * Sorgt dafür, dass eine Nachricht mit der Enter-Taste gesendet wird (ohne Shift).
 */
function handleKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

/**
 * Öffnet oder schließt die Sidebar und steuert das Overlay auf Mobilgeräten.
 */
function toggleSidebar() {
    // Verhindern, dass die Funktion zu schnell hintereinander aufgerufen wird
    if (window.isTogglingSidebar) return;
    window.isTogglingSidebar = true;

    const container = document.querySelector('.main-container');
    if (!container) {
        window.isTogglingSidebar = false;
        return;
    }

    container.classList.toggle('sidebar-collapsed');
    const isVisible = !container.classList.contains('sidebar-collapsed');

    const hamburger = document.querySelector('.hamburger');
    if (hamburger) hamburger.classList.toggle('active', isVisible);

    const sidebarToggle = document.querySelector('.sidebar-toggle');
    if (sidebarToggle) sidebarToggle.classList.toggle('active', isVisible);

    if (window.innerWidth <= 768) {
        const overlay = document.querySelector('.sidebar-overlay');
        if (overlay) overlay.classList.toggle('active', isVisible);
    }

    setTimeout(() => {
        window.isTogglingSidebar = false;
    }, 100);
}

/**
 * Steuert das Auf- und Zuklappen der einzelnen Tabs in der Sidebar.
 * Ich habe hier sichergestellt, dass immer nur ein Tab gleichzeitig geöffnet ist.
 */
function toggleTab(tabName) {
    const content = document.getElementById(`${tabName}-content`);
    if (!content) return;
    const header = content.previousElementSibling;
    const isActive = content.classList.toggle('active');
    if (header) header.classList.toggle('active', isActive);
    
    document.querySelectorAll('.sidebar .tab-content').forEach(c => { if(c !== content) c.classList.remove('active'); });
    document.querySelectorAll('.sidebar .tab-header').forEach(h => { if(h !== header) h.classList.remove('active'); });
}

/**
 * Startet die geführte Tour mit Intro.js.
 * Ich habe die Button-Texte angepasst, damit sie auf Deutsch sind.
 */
function startTour() {
    // Überprüfen, ob introJs eine Funktion ist, bevor sie aufgerufen wird.
    if (typeof introJs === 'function') {
        introJs().setOptions({
            nextLabel: 'Weiter →',
            prevLabel: '← Zurück',
            doneLabel: 'Fertig',
            showStepNumbers: false,
            exitOnOverlayClick: false
        }).start();
    } else {
        console.error("Intro.js ist nicht geladen. Tour kann nicht gestartet werden.");
    }
}

/**
 * Zeigt je nach Typ eine Info-Box für die KI-Einstellungen an.
 * Ich nutze hier die Standard `alert`-Funktion, da sie einfach und effektiv ist.
 */
function showInfo(type) {
    if (type === 'temp') {
        alert(
            'Kreativität (Temperatur)\n\n' +
            'Ein Wert zwischen 0.0 und 1.0.\n\n' +
            'Niedrigere Werte (z.B. 0.2) führen zu fokussierteren und vorhersehbareren Antworten. Gut für Fakten und Code.\n\n' +
            'Höhere Werte (z.B. 0.9) machen die KI kreativer und experimenteller. Gut für Brainstorming und Gedichte.'
        );
    } else if (type === 'topP') {
        alert(
            'Wortauswahl (Top-P)\n\n' +
            'Ein Wert zwischen 0.1 und 1.0.\n\n' +
            'Dieser Wert steuert die Vielfalt der Wortauswahl. Ein hoher Wert (z.B. 0.95) erlaubt der KI, aus einer größeren Menge wahrscheinlicher Wörter zu wählen, was zu interessanteren Antworten führt.\n\n' +
            'Ein niedriger Wert schränkt die Auswahl stark ein. Es wird empfohlen, nur einen der beiden Werte (Temperatur oder Top-P) zu ändern, nicht beide gleichzeitig.'
        );
    }
}

/**
 * Aktualisiert die globalen KI-Einstellungen, wenn ein Regler bewegt wird.
 * Die Funktion speichert den Wert auch direkt in der Datenbank.
 */
async function updateAISetting(type, value) {
    if (type === 'temperature') {
        temperature = parseFloat(value);
        const tempValue = document.getElementById('temperature-value');
        if (tempValue) tempValue.textContent = temperature;
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.TEMPERATURE, value: temperature });
    } else if (type === 'topP') {
        topP = parseFloat(value);
        const topPValue = document.getElementById('top-p-value');
        if (topPValue) topPValue.textContent = topP;
        await dbHelper.save(dbHelper.STORES.APP_STATE, { key: SETTING_KEYS.TOP_P, value: topP });
    }
}



/**
 * Zeigt eine einfache Hilfe-Benachrichtigung an.
 */
function showHelp() { 
    showNotification('Alle Hauptfunktionen findest du in der Sidebar. Wenn du nicht weiterkommst, kannst du auch ganz einfach im Chat-Interface Bred selber fragen, wie was funktioniert! Er wird es dir dann erklären!', 'info'); 
}

/**
 * Zeigt eine "Über"-Benachrichtigung mit der Versionsnummer an.
 */
function showAbout() { 
    showNotification('Bred.AI v28.2 - Dein anpassbarer KI-Chat-Assistent. Pro-Features, komplett kostenlos!', 'info'); 
}
