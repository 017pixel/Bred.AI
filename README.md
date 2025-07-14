# 🤖 BredAI – Mein persönlicher KI-Chat-Assistent

Ich bin Schüler und beschäftige mich seit über zwei Jahren intensiv mit KI-Entwicklung und Ethik. **BredAI** ist mein bisher größtes Projekt – ein persönlicher KI-Assistent, komplett im Browser umgesetzt.  
Da ich keinen eigenen Server finanzieren kann, nutze ich bewusst **kostenlose APIs direkt im Frontend**. Das ist zwar eine Herausforderung, aber auch eine funktionable Lösung.

## 🧠 Funktionen im Überblick

### 🔍 KI-Integration
- **Gemini API** für Text- und Bildunterhaltungen eingabe und Text Ausgabe 
- **Google Custom Search API** für aktuelle Web-Suchergebnisse  
- **Langzeitgedächtnis** durch automatische Konversationszusammenfassungen  
- **RAG-System** (Retrieval-Augmented Generation) mit eigener Wissensbasis  

### 👤 Nutzerorientierte Funktionen
- Mehrere **Profile** mit persönlichen Einstellungen  
- Auswahl zwischen **vordefinierten** oder **eigenen Bot-Persönlichkeiten**  
- **Projekt-Chats**, jeder mit eigenem Wissen und Kontext  
- **Sprachmodus**: erkennt gesprochene Sprache und antwortet mit Sprachausgabe  
- **Interessen-Tracking** für individuell passende Antworten  

### ⚙️ Technische Umsetzung
- **IndexedDB** für lokale Datenspeicherung – kein Server nötig  
- **Web Speech API** für Spracheingabe und -ausgabe  
- **Responsive Design** für alle Bildschirmgrößen  
- **Modulare Struktur** mit klar getrennten Funktionen  

## 🧩 Funktionsweise im Detail

### 📦 1. Datenverwaltung
Die Datenverwaltung speichert alle Nutzerdaten lokal im Browser mit **IndexedDB**. Sie ermöglicht das Erstellen, Abrufen, Aktualisieren und Löschen von Profilen, App-Zuständen und API-Nutzungsdaten, ohne dass ein Server benötigt wird.

### 🔑 2. API-Key-Management
Das System verwaltet mehrere API-Schlüssel, um die begrenzten Tageslimits kostenloser APIs zu umgehen. Es wählt automatisch den nächsten verfügbaren Schlüssel und setzt die Limits täglich zurück, um eine reibungslose Nutzung zu gewährleisten.

### 📚 3. Wissensbasis
Die Wissensbasis teilt Inhalte in durchsuchbare Abschnitte auf und findet relevante Informationen für Nutzeranfragen. So liefert das System präzise und kontextbezogene Antworten basierend auf gespeichertem Wissen.

### 🗣️ 4. Sprachfunktionen
Die Sprachfunktionen ermöglichen Spracheingabe auf Deutsch und Sprachausgabe mit anpassbarer Stimme und Tonhöhe. Nutzer können den Sprachmodus ein- oder ausschalten, um mit dem Assistenten per Stimme zu interagieren.

### 📁 5. Projektbasiertes RAG
Das RAG-System erstellt Antworten ausschließlich mit Wissen aus spezifischen Projekten. Jeder Projekt-Chat hat seinen eigenen Kontext, sodass die Antworten gezielt und relevant bleiben.

### 🧾 6. KI-Konfiguration
Die KI passt ihre Antworten dynamisch an den Nutzer, das gewählte Bot-Profil, das Projekt und die Sprache an. Dies sorgt für personalisierte und kontextgerechte Interaktionen, sowohl im Text- als auch im Sprachmodus.

## 🛠️ Herausforderungen & Lösungen

### Kein Server
- Verwendung von **IndexedDB** für dauerhafte Datenspeicherung  
- Sämtliche Logik läuft komplett im **Frontend**  
- APIs werden direkt vom Browser aus angesprochen  

### Begrenzte API-Nutzung
- **Key-Rotation-System** für mehrere API-Schlüssel  
- Automatisches Zurücksetzen der Tageslimits  
- Fehlertoleranter Code, der auch bei Problemen stabil bleibt  

### Komplexe KI-Nutzung
- **Dynamische Prompts**, je nach Kontext und Nutzer  
- **Gedächtnisfunktion**, die Inhalte über längere Zeit berücksichtigt  
- Verarbeitet sowohl Text als auch Bilder  

## 🌱 Ethik & Verantwortung

Da ich mich viel mit KI-Ethik beschäftige, habe ich besonders auf folgende Punkte geachtet:  
- **Transparenz**: Der Nutzer sieht jederzeit, welches Modell aktiv ist  
- **Datensparsamkeit**: Nur unbedingt nötige Informationen werden gespeichert  
- **Nutzerkontrolle**: Daten und Profile lassen sich jederzeit löschen  
- **Offene Kommunikation**: Technische Grenzen sind bewusst sichtbar und erklärt  

## 💬 Persönliches Fazit

Dieses Projekt ist das Ergebnis von zwei Jahren Lernen, Experimentieren und Weiterentwickeln.  
Ich habe insgesamt **3 Monate** daran gearbeitet und bin echt stolz auf das Resultat – aber da geht noch mehr!  
Wenn mir neue Ideen kommen, baue ich sie definitiv ein.  

Jede Funktion wurde mit Kreativität, Neugier und Motivation entwickelt.  
Nicht mit teurem Server, sondern mit **Kreativität und Spaß**.  
Ich hoffe, dass dir **BredAI** genauso viel bringt wie mir beim Bauen! 💚
