const fs = require("fs");
const Parser = require("rss-parser");

const parser = new Parser({
    customFields: {
        item: [
            ["media:content", "media"],
            ["content:encoded", "contentEncoded"]
        ]
    }
});

async function fetchFeed(url) {
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; animalrssbot/1.0; +github)"
        }
    });

    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }

    return await res.text();
}

function cleanImage(url) {
    if (!url) return null;

    url = url.replace(/&amp;/g, "&");

    if (url.includes("preview.redd.it")) {
        url = url.replace("preview.redd.it", "i.redd.it");
        url = url.split("?")[0];
    }

    return url;
}

function extractImage(item) {
    if (item.media?.$?.url) {
        return cleanImage(item.media.$.url);
    }

    const html = item.content || item.contentEncoded || "";
    const match = html.match(/<img[^>]+src="([^"]+)"/i);

    if (match) return cleanImage(match[1]);

    return null;
}

function escapeXml(str = "") {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function buildRSS(channelTitle, items) {
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
xmlns:media="http://search.yahoo.com/mrss/">
<channel>
<title>${escapeXml(channelTitle)}</title>
<link>https://github.com</link>
<description>${escapeXml(channelTitle)}</description>
`;

    for (const item of items) {
        xml += `
<item>
<title>${escapeXml(item.title)}</title>
<link>${escapeXml(item.link)}</link>
<description><![CDATA[
<img src="${item.image}" />
]]></description>
<media:content url="${escapeXml(item.image)}" medium="image" type="image/jpeg"/>
<media:thumbnail url="${escapeXml(item.image)}"/>
<enclosure url="${escapeXml(item.image)}" type="image/jpeg" length="0"/>
</item>
`;
    }

    xml += `
</channel>
</rss>`;

    return xml;
}

async function build(subreddit, outputFile) {
    const xmlText = await fetchFeed(
        `https://www.reddit.com/r/${subreddit}/.rss`
    );

    const feed = await parser.parseString(xmlText);
    const items = [];

    for (const item of feed.items) {
        const image = extractImage(item);
        if (!image) continue;

        items.push({
            title: item.title || "",
            link: item.link || "",
            image
        });
    }

    fs.mkdirSync("docs", { recursive: true });
    fs.writeFileSync(
        outputFile,
        buildRSS(`notitlerandom-${subreddit}`, items),
        "utf8"
    );
}

(async () => {
    await build("catpics", "docs/cats.xml");
    await build("dogpictures", "docs/dogs.xml");
})();
