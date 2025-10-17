// --- Abhängigkeiten importieren ---
const WebSocket = require('ws');
const express = require('express');
const bodyParser = require('body-parser');
require('dotenv').config(); // Lädt Umgebungsvariablen aus der .env-Datei

// --- Konfiguration ---
// Lade die Ports aus der .env-Datei. Falls sie nicht definiert sind, werden Standardwerte verwendet.
const wssPort = process.env.MCP_SERVER_WS_PORT || 4000;
const restPort = process.env.MCP_SERVER_REST_PORT || 4001;

// --- In-Memory-Speicher ---
// Hier wird der jeweils letzte Code-Zustand für jeden Dateipfad gespeichert.
// Die Map hat die Struktur: Map<filePath, { content: string, cursorOffset: number, timestamp: Date }>
const codeState = new Map();

// --- Express App initialisieren ---
const app = express();
app.use(bodyParser.json()); // Middleware, um JSON-Request-Bodies zu parsen

// =================================================================
// --- WebSocket Server für die Echtzeit-Kommunikation mit der VS Code Extension ---
// =================================================================
const wss = new WebSocket.Server({ port: wssPort });

// Log-Nachricht beim Start des WebSocket-Servers
console.log(`MCP-Server (WebSocket) lauscht auf ws://localhost:${wssPort}`);

// Event-Listener für neue Verbindungen
wss.on('connection', ws => {
  console.log('Ein neuer Client (VS Code Extension) hat sich verbunden.');

  // Event-Listener für eingehende Nachrichten vom Client
  ws.on('message', message => {
    try {
      // Wandle die Nachricht (Buffer) in einen String um und parse sie als JSON
      const event = JSON.parse(message.toString());

      // Verarbeite nur 'didChange'-Events, die alle notwendigen Daten enthalten
      if (event.event === 'didChange' && event.filePath && typeof event.content !== 'undefined') {
        console.log(`Code-Update für Datei empfangen: ${event.filePath}`);

        // Speichere oder aktualisiere den Zustand für diesen Dateipfad in der Map
        codeState.set(event.filePath, {
          content: event.content,
          cursorOffset: event.cursorOffset || 0, // Fallback auf 0, falls nicht vorhanden
          timestamp: new Date() // Zeitstempel der letzten Änderung
        });

        // (Optional) Sende eine Bestätigung zurück an die Extension
        ws.send(JSON.stringify({ status: 'received', filePath: event.filePath }));
      }
    } catch (error) {
      console.error('Fehler beim Parsen der WebSocket-Nachricht:', error);
      // Sende eine Fehlermeldung an den Client, falls ein Fehler auftritt
      ws.send(JSON.stringify({ error: "Serverfehler bei der Verarbeitung der Nachricht." }));
    }
  });

  // Event-Listener für das Schließen der Verbindung
  ws.on('close', () => {
    console.log('Die Verbindung zum Client (VS Code Extension) wurde getrennt.');
  });

  // Event-Listener für Verbindungsfehler
  ws.on('error', error => {
    console.error('Ein WebSocket-Fehler ist aufgetreten:', error);
  });
});

// =================================================================
// --- REST-API Server für den Abruf der Daten durch den KI-Agenten (z.B. Gemini) ---
// =================================================================

// --- API Endpunkte ---

// 1. Endpunkt zur Überprüfung des Server-Status (Health Check)
app.get('/health', (req, res) => {
  // Gibt eine einfache "Alles OK"-Nachricht mit Status 200 zurück
  res.status(200).send('MCP Server ist fehlerfrei und bereit für den Einsatz.');
});

// 2. Endpunkt, um eine Liste aller aktuell bekannten Dateipfade abzurufen
app.get('/files', (req, res) => {
  // Gibt ein JSON-Objekt zurück, das ein Array aller Schlüssel (Dateipfade) aus der codeState-Map enthält
  res.json({
    files: Array.from(codeState.keys())
  });
});

// 3. Endpunkt, um den Code-Zustand einer bestimmten Datei abzurufen
app.get('/code/:filePath', (req, res) => {
  try {
    // Der Dateipfad in der URL ist URL-kodiert (z.B. src%2Findex.ts). Hier wird er dekodiert.
    const requestedFilePath = decodeURIComponent(req.params.filePath);
    const fileData = codeState.get(requestedFilePath);

    // Wenn Daten für den angeforderten Dateipfad gefunden wurden...
    if (fileData) {
      // ...sende die Daten als JSON zurück.
      res.json({
        filePath: requestedFilePath,
        content: fileData.content,
        cursorOffset: fileData.cursorOffset,
        timestamp: fileData.timestamp.toISOString() // Zeitstempel im ISO-Format für einfache Verarbeitung
      });
    } else {
      // ...andernfalls sende einen 404-Status mit einer Fehlermeldung.
      res.status(404).json({ error: 'Datei nicht gefunden oder es wurde noch kein Code für diesen Pfad empfangen.' });
    }
  } catch (error) {
    // Falls beim Dekodieren oder Verarbeiten ein Fehler auftritt
    res.status(500).json({ error: 'Ein interner Serverfehler ist aufgetreten.' });
  }
});

// --- REST-API Server starten ---
app.listen(restPort, () => {
  console.log(`MCP-Server (REST-API) lauscht auf http://localhost:${restPort}`);
  console.log('Verfügbare Endpunkte für das KI-Tool:');
  console.log(`  GET /health`);
  console.log(`  GET /files`);
  console.log(`  GET /code/:filePath (Beispiel: /code/src%2Findex.ts)`);
});