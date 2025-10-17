// --- Abhängigkeiten importieren ---
import * as vscode from 'vscode';
import WebSocket from 'ws'; // Importiert die WebSocket-Client-Implementierung

// --- Globale Variablen ---
let ws: WebSocket | null = null; // Hält die WebSocket-Instanz
let debounceTimer: NodeJS.Timeout | null = null; // Timer für das Debouncing
const DEBOUNCE_DELAY = 250; // Verzögerung in Millisekunden für das Debouncing
const RECONNECT_INTERVAL = 5000; // Intervall für Wiederverbindungsversuche in Millisekunden

/**
 * Stellt die WebSocket-Verbindung zum MCP-Server her.
 * Implementiert eine einfache Wiederverbindungslogik.
 */
function connectWebSocket() {
    // Schließe eine eventuell bestehende Verbindung, bevor eine neue aufgebaut wird.
    if (ws && ws.readyState !== WebSocket.CLOSED) {
        ws.close();
    }

    // Erstellt eine neue WebSocket-Instanz, die auf den MCP-Server zeigt.
    // Die URL muss exakt mit dem Port aus der .env-Datei des Servers übereinstimmen.
    ws = new WebSocket('ws://localhost:4000');

    // --- Event-Listener für die WebSocket-Verbindung ---

    // Wird ausgelöst, wenn die Verbindung erfolgreich hergestellt wurde.
    ws.on('open', () => {
        console.log('Erfolgreich mit dem MCP-Server verbunden.');
        // Zeigt eine temporäre Nachricht in der VS Code Statusleiste an.
        vscode.window.setStatusBarMessage('Live Code Sharing: Verbunden', 3000);
    });

    // Wird ausgelöst, wenn die Verbindung geschlossen wird.
    ws.on('close', () => {
        console.log(`Verbindung zum MCP-Server getrennt. Versuche erneute Verbindung in ${RECONNECT_INTERVAL / 1000} Sekunden...`);
        ws = null; // Setzt die WebSocket-Instanz zurück.
        // Startet einen Timer, um die Wiederverbindung zu versuchen.
        setTimeout(connectWebSocket, RECONNECT_INTERVAL);
    });

    // Wird bei einem Verbindungsfehler ausgelöst.
    ws.on('error', (error) => {
        console.error('WebSocket-Fehler:', error.message);
        // Das 'close'-Event wird automatisch nach einem Fehler ausgelöst,
        // was die Wiederverbindungslogik anstößt.
    });

    // (Optional) Listener für Nachrichten vom Server.
    ws.on('message', (message) => {
        console.log(`Nachricht vom Server erhalten: ${message.toString()}`);
    });
}

/**
 * Die `activate`-Funktion wird aufgerufen, wenn die Extension zum ersten Mal aktiviert wird.
 * @param context Der Extension-Kontext, in dem Disposables registriert werden können.
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('Die "live-code-sharing-extension" ist jetzt aktiv!');

    // Starte den ersten Versuch, die WebSocket-Verbindung herzustellen.
    connectWebSocket();

    // --- Event-Listener für Code-Änderungen ---

    // Registriere einen Listener, der bei jeder Textänderung in einem beliebigen Dokument im Workspace ausgelöst wird.
    const changeDocumentDisposable = vscode.workspace.onDidChangeTextDocument(event => {
        // Sende nur Daten, wenn die WebSocket-Verbindung aktiv und geöffnet ist.
        if (!ws || ws.readyState !== WebSocket.OPEN) {
            console.log('WebSocket nicht verbunden. Überspringe das Senden von Daten.');
            return;
        }

        // Debouncing: Verhindert, dass bei jedem einzelnen Tastenanschlag eine Nachricht gesendet wird.
        // Der Timer wird bei jeder neuen Änderung zurückgesetzt.
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }

        // Starte einen neuen Timer. Die Logik wird erst ausgeführt, wenn seit der letzten Änderung 250ms vergangen sind.
        debounceTimer = setTimeout(() => {
            const document = event.document;
            const editor = vscode.window.activeTextEditor;

            // Stelle sicher, dass ein aktiver Editor vorhanden ist und das geänderte Dokument dem im Editor entspricht.
            if (editor && editor.document === document) {
                // Erstelle das JSON-Payload-Objekt für den Server.
                const payload = {
                    event: 'didChange',
                    filePath: document.uri.fsPath, // Der absolute Dateipfad
                    content: document.getText(), // Der gesamte Inhalt der Datei
                    cursorOffset: editor.document.offsetAt(editor.selection.active) // Die aktuelle Cursor-Position als Offset
                };

                console.log(`Sende Update für: ${payload.filePath}`);
                // Sende das Payload als JSON-String an den Server.
                ws?.send(JSON.stringify(payload));
            }
        }, DEBOUNCE_DELAY);
    });

    // --- Befehl zum Einfügen von KI-Vorschlägen ---

    // Registriere den Befehl, der in der package.json definiert wurde.
    const enterSuggestionDisposable = vscode.commands.registerCommand('liveCodeSharing.enterGeminiSuggestion', async () => {
        // Zeige ein Eingabefeld in VS Code an.
        const suggestion = await vscode.window.showInputBox({
            prompt: 'Fügen Sie den Vorschlag von Gemini hier ein',
            placeHolder: 'z.B. console.log("Hello, World!");',
            title: 'Gemini-Vorschlag einfügen'
        });

        // Wenn der Benutzer Text eingegeben hat...
        if (suggestion) {
            const editor = vscode.window.activeTextEditor;
            // ...und ein aktiver Editor existiert...
            if (editor) {
                // ...füge den Text an der aktuellen Cursor-Position ein.
                editor.edit(editBuilder => {
                    editBuilder.insert(editor.selection.active, suggestion);
                });
            } else {
                // Zeige eine Fehlermeldung, falls kein Editor offen ist.
                vscode.window.showErrorMessage('Kein aktiver Texteditor gefunden, um den Vorschlag einzufügen.');
            }
        }
    });

    // Füge die Disposables (Listener und Befehl) zum Kontext hinzu.
    // Sie werden automatisch bereinigt, wenn die Extension deaktiviert wird.
    context.subscriptions.push(changeDocumentDisposable, enterSuggestionDisposable);
}

/**
 * Die `deactivate`-Funktion wird aufgerufen, wenn die Extension deaktiviert wird.
 */
export function deactivate() {
    // Schließe die WebSocket-Verbindung sauber, wenn die Extension beendet wird.
    if (ws) {
        ws.close();
    }
    console.log('Die "live-code-sharing-extension" wurde deaktiviert.');
}