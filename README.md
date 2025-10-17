# Anleitung zur Einrichtung und Verwendung des Live-Code-Sharing-Systems

Dieses Handbuch führt Sie durch die Einrichtung des MCP-Servers, der VS Code Extension und der Konfiguration von Google AI Studio zur Aktivierung der KI-gestützten Code-Analyse.

## Voraussetzungen

Stellen Sie sicher, dass die folgende Software auf Ihrem System installiert ist:

-   **Node.js und npm:** [Download von nodejs.org](https://nodejs.org/)
-   **Visual Studio Code:** [Download von code.visualstudio.com](https://code.visualstudio.com/)
-   **Yeoman und VS Code Extension Generator:**
    ```bash
    npm install -g yo @vscode/generator-code
    ```
-   **ngrok:** [Download von ngrok.com](https://ngrok.com/download) und folgen Sie den Anweisungen zur Installation und Authentifizierung.

---

## Schritt 1: Einrichtung des MCP-Servers

Der MCP-Server ist die Brücke zwischen Ihrer VS Code Extension und dem KI-Agenten.

1.  **Projektverzeichnis:**
    Die Dateien für den Server befinden sich im Verzeichnis `mcp-server`.

2.  **Abhängigkeiten installieren:**
    Öffnen Sie ein Terminal, navigieren Sie in das `mcp-server`-Verzeichnis und installieren Sie die notwendigen Node.js-Module:
    ```bash
    cd mcp-server
    npm install
    ```

3.  **Server starten:**
    Starten Sie den Server mit folgendem Befehl:
    ```bash
    node server.js
    ```
    Sie sollten Log-Nachrichten sehen, die bestätigen, dass der WebSocket-Server auf Port `4000` und der REST-Server auf Port `4001` lauscht. Lassen Sie dieses Terminalfenster geöffnet.

---

## Schritt 2: Öffentliche Freigabe des Servers mit ngrok

Damit der cloud-basierte Gemini-Agent Ihren lokal laufenden Server erreichen kann, müssen Sie ihn über das Internet zugänglich machen.

1.  **ngrok starten:**
    Öffnen Sie ein **neues, separates Terminalfenster** und führen Sie den folgenden Befehl aus. Er leitet den öffentlichen Verkehr an Ihren lokalen REST-API-Port (`4001`) weiter.
    ```bash
    ngrok http 4001
    ```

2.  **URL kopieren:**
    `ngrok` zeigt eine öffentliche "Forwarding"-URL an. Kopieren Sie die `https://`-URL (z.B. `https://random-subdomain.ngrok-free.app`). Diese URL wird in Schritt 4 benötigt. Lassen Sie auch dieses Terminalfenster während der gesamten Sitzung geöffnet.

---

## Schritt 3: Einrichtung der VS Code Extension

Die Extension erfasst Ihre Code-Änderungen und sendet sie an den MCP-Server.

1.  **Projektverzeichnis:**
    Die Dateien für die Extension befinden sich im Verzeichnis `live-code-sharing-extension`.

2.  **Abhängigkeiten installieren und kompilieren:**
    Öffnen Sie ein drittes Terminal, navigieren Sie in das `live-code-sharing-extension`-Verzeichnis, installieren Sie die Abhängigkeiten und kompilieren Sie den TypeScript-Code:
    ```bash
    cd live-code-sharing-extension
    npm install
    npm run compile
    ```

3.  **Extension starten:**
    -   Öffnen Sie das Verzeichnis `live-code-sharing-extension` in VS Code (`code .`).
    -   Drücken Sie `F5`, um die Extension in einem neuen "Extension Development Host"-Fenster zu starten. In diesem neuen Fenster wird die Extension aktiv sein.

---

## Schritt 4: Konfiguration des Tools in Google AI Studio

Nun definieren Sie die API Ihres Servers als ein "Tool", das Gemini verwenden kann.

1.  Gehen Sie zu [Google AI Studio](https://aistudio.google.com/) und starten Sie einen neuen Prompt.

2.  **Tool hinzufügen:** Suchen Sie die Option zum Hinzufügen von **Tools** und wählen Sie "API erstellen oder bearbeiten".

3.  **API-Schema definieren:** Fügen Sie eine OpenAPI 3.0 Spezifikation im YAML-Format ein.

    ```yaml
    # Fügen Sie dies unter "Tools" -> "API Schema" ein
    openapi: 3.0.0
    info:
      title: Live Code Sharing Server API
      version: 1.0.0
    servers:
      # ERSETZEN SIE DIESE URL DURCH IHRE NGROK-URL AUS SCHRITT 2!
      - url: https://IHRE-NGROK-SUBDOMAIN.ngrok-free.app
    paths:
      /files:
        get:
          summary: Get available files
          description: Ruft eine Liste aller Dateipfade ab, die aktuell auf dem Live-Code-Sharing-Server verfügbar sind.
          operationId: get_available_files
          responses:
            '200':
              description: A list of files
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      files:
                        type: array
                        items:
                          type: string
      /code/{filePath}:
        get:
          summary: Get file content
          description: Ruft den Inhalt einer bestimmten Datei vom Live-Code-Sharing-Server ab.
          operationId: get_file_content
          parameters:
            - name: filePath
              in: path
              required: true
              schema:
                type: string
              description: Der URL-kodierte Pfad der Datei.
          responses:
            '200':
              description: File content and metadata
              content:
                application/json:
                  schema:
                    type: object
    ```
    **Wichtig:** Ersetzen Sie die `url` im `servers`-Abschnitt durch Ihre kopierte `ngrok`-URL.

---

## Schritt 5: End-to-End Test-Workflow

1.  Öffnen Sie im **"Extension Development Host"-Fenster** von VS Code (das Fenster, das sich nach dem Drücken von F5 geöffnet hat) ein beliebiges Projekt und eine Datei.

2.  Beginnen Sie mit dem Schreiben oder Ändern von Code in dieser Datei.

3.  Beobachten Sie das Terminal, in dem Ihr **mcp-server** läuft. Sie sollten Log-Nachrichten wie `Code-Update für Datei empfangen:...` sehen.

4.  Gehen Sie zu Ihrem **Google AI Studio** Chat. Geben Sie einen Prompt ein, der das Tool verwenden sollte. Zum Beispiel:
    > "Ich arbeite an einem Projekt. Kannst du mir sagen, welche Dateien derzeit aktiv sind?"

5.  Gemini sollte antworten, dass es das Tool `get_available_files` aufruft. Im **ngrok**-Terminal sollten Sie eine `GET /files`-Anfrage sehen.

6.  Stellen Sie eine Folgefrage (passen Sie den Pfad an Ihre Datei an):
    > "Okay, bitte hole dir den Inhalt der Datei `[Ihr Dateipfad]` und gib mir Verbesserungsvorschläge."

7.  Gemini sollte nun das Tool `get_file_content` aufrufen. Beobachten Sie die ngrok- und Server-Logs erneut.

8.  Nachdem Gemini den Code analysiert hat, wird es einen Vorschlag generieren. **Kopieren Sie diesen Vorschlag.**

9.  Gehen Sie zurück zum **"Extension Development Host"-Fenster**. Öffnen Sie die Befehlspalette (`Cmd+Shift+P` oder `Ctrl+Shift+P`) und suchen Sie nach **"Live Code Sharing: Gemini Vorschlag manuell eingeben"**. Führen Sie den Befehl aus und fügen Sie den kopierten Vorschlag in das Eingabefeld ein. Der Code sollte in Ihrem Editor an der Cursor-Position erscheinen.

Herzlichen Glückwunsch! Sie haben das gesamte System erfolgreich eingerichtet und getestet.