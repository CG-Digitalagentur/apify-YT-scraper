// Importiere Apify-SDK (für Input, Output, Dateien usw.)
const Apify = require('apify');

// Importiere die Bibliothek für YouTube-Transkripte
const { getTranscript } = require('youtube-transcript');

Apify.main(async () => {
    // Hole die Eingabe aus der Apify-UI (JSON mit videoUrl)
    const { videoUrl } = await Apify.getInput();
    if (!videoUrl) throw new Error('❌ Der Input videoUrl fehlt!');

    // Extrahiere die Video-ID aus verschiedenen möglichen YouTube-URLs
    const match = videoUrl.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (!match) throw new Error(`❌ Konnte keine gültige Video-ID in der URL finden: ${videoUrl}`);
    const videoId = match[1];

    // Versuche das Transkript abzurufen
    let transcriptItems;
    try {
        transcriptItems = await getTranscript(videoId, { lang: 'de' });
    } catch (err) {
        throw new Error(`❌ Fehler beim Abrufen des Transkripts: ${err.message}`);
    }

    if (!transcriptItems || transcriptItems.length === 0) {
        throw new Error('❌ Kein Transkript gefunden oder das Video enthält keins.');
    }

    // Erzeuge den reinen Text mit Leerzeichen dazwischen
    const fullText = transcriptItems.map(item => item.text).join(' ');

    // Versuche optional den Videotitel via oEmbed zu holen
    let title = '';
    try {
        const res = await Apify.utils.requestAsBrowser({
            url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
            json: true,
        });
        title = res.body.title || '';
    } catch (err) {
        // Falls die oEmbed-Anfrage fehlschlägt, einfach ignorieren
    }

    // Speichere alle Ergebnisse
    await Apify.setValue('transcript.json', transcriptItems, { contentType: 'application/json' });
    await Apify.setValue('transcript.txt', fullText, { contentType: 'text/plain' });

    // Ausgabe auch als Dataset-Item (z.B. für weitere Verarbeitung)
    await Apify.pushData({
        videoId,
        title,
        url: videoUrl,
        transcript: transcriptItems,
    });

    console.log('✅ Transkript erfolgreich verarbeitet und gespeichert!');
});
