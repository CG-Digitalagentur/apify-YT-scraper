const Apify = require('apify');
const getTranscript = require('youtube-transcript');
const cheerio = require('cheerio');

Apify.main(async () => {
    const { videoUrl } = await Apify.getInput();
    if (!videoUrl) throw new Error('❌ videoUrl fehlt im Input.');

    const isChannel = videoUrl.includes('youtube.com/@') || videoUrl.includes('/channel/');

    let videoLinks = [];

    if (isChannel) {
        console.log('🔎 Kanal erkannt – lade Videos…');

        const response = await Apify.utils.requestAsBrowser({
            url: videoUrl + '/videos',
        });

        const $ = cheerio.load(response.body);

        const videoIds = new Set();
        $('a#video-title').each((_, el) => {
            const href = $(el).attr('href');
            const match = href && href.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
            if (match) videoIds.add(match[1]);
        });

        videoLinks = [...videoIds].map(id => `https://www.youtube.com/watch?v=${id}`);
        console.log(`📹 Gefundene Videos: ${videoLinks.length}`);
    } else {
        console.log('▶️ Einzelnes Video erkannt.');
        videoLinks = [videoUrl];
    }

    for (const link of videoLinks) {
        const match = link.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (!match) {
            console.warn(`⚠️ Ungültiger Link übersprungen: ${link}`);
            continue;
        }

        const videoId = match[1];

        let transcript;
        try {
            transcript = await getTranscript(videoId, { lang: 'de' });
        } catch (err) {
            console.warn(`⚠️ Kein Transkript für ${link}: ${err.message}`);
            continue;
        }

        const text = transcript.map(item => item.text).join(' ');

        let title = '';
        let channel = '';
        try {
            const res = await Apify.utils.requestAsBrowser({
                url: `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
                json: true,
            });
            title = res.body.title;
            channel = res.body.author_name;
        } catch (e) {}

        const data = {
            channel,
            title,
            videoUrl: link,
            transcript: text,
        };

        await Apify.pushData(data);

        // Wenn es nur ein Video ist, speichere auch als Datei
        if (videoLinks.length === 1) {
            await Apify.setValue('transcript.json', transcript, { contentType: 'application/json' });
            await Apify.setValue('transcript.txt', text, { contentType: 'text/plain' });
        }

        console.log(`✅ Fertig: ${title}`);
    }

    console.log('🎉 Alle Videos verarbeitet!');
});
