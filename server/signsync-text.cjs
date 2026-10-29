// Subtitle parsing/extraction reused from DefnoJae/SeaSubs source.ts.
function parseVtt(input) {
    if (!/^\uFEFF?WEBVTT(?:\s|$)/.test(input))
        return [];
    const cues = [];
    const stamp = (s) => s.split(":").reduce((n, p) => n * 60 + Number(p), 0);
    for (const block of input.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
        if (/^(WEBVTT|NOTE|STYLE|REGION)(?:\s|$)/.test(block))
            continue;
        const lines = block.split("\n");
        const i = lines.findIndex(l => l.includes("-->"));
        if (i < 0)
            continue;
        const m = lines[i].match(/^((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2,}:)?\d{2}:\d{2}\.\d{3})(?:\s.*)?$/);
        if (!m)
            continue;
        const start = stamp(m[1]), end = stamp(m[2]);
        const text = lines.slice(i + 1).join("\n").trim();
        if (end > start && text && end - start <= 180)
            cues.push({ start, end, text, block });
    }
    return cues;
}
function parseTextCues(content) {
    const vtt = parseVtt(content);
    if (vtt.length)
        return vtt;
    const normalized = content.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
    return parseVtt("WEBVTT\n\n" + normalized.replace(/^\uFEFF/, "")).map(cue => ({ ...cue, block: cue.block.replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, "$1,$2") }));
}
function timingCues(content, includeDrawings = false) {
    const vtt = parseTextCues(content);
    if (vtt.length)
        return vtt.map((c, i) => ({ ...c, line: i }));
    const out = [];
    let events = false, format = [];
    content.replace(/^\uFEFF/, "").split(/\r?\n/).forEach((line, index) => {
        if (/^\[/.test(line)) {
            events = /^\[Events\]/i.test(line);
            return;
        }
        if (!events)
            return;
        if (/^Format:/i.test(line)) {
            format = line.slice(line.indexOf(":") + 1).split(",").map(s => s.trim().toLowerCase());
            return;
        }
        if (!/^Dialogue:/i.test(line) || !format.length)
            return;
        const fields = splitAssFields(line.slice(line.indexOf(":") + 1), format.length);
        const startIndex = format.indexOf("start"), endIndex = format.indexOf("end"), textIndex = format.indexOf("text");
        if (startIndex < 0 || endIndex < 0 || textIndex < 0)
            return;
        const stamp = (s) => s.trim().split(":").reduce((n, v) => n * 60 + Number(v), 0);
        const start = stamp(fields[startIndex]), end = stamp(fields[endIndex]);
        if (Number.isFinite(start) && end > start && (includeDrawings || !/\\p[1-9]/.test(fields[textIndex])))
            out.push({ start, end, text: stripAssTags(fields[textIndex]), line: index, fields, startIndex, endIndex });
    });
    return out;
}
function splitAssFields(payload, count) {
    const out = [];
    let start = 0;
    for (let i = 0; i < count - 1; i++) {
        const p = payload.indexOf(",", start);
        if (p < 0) {
            out.push(payload.slice(start));
            while (out.length < count)
                out.push("");
            return out;
        }
        out.push(payload.slice(start, p));
        start = p + 1;
    }
    out.push(payload.slice(start));
    return out;
}
function stripAssTags(text) {
    return text
        .replace(/\{[^}]*\}/g, "")
        .replace(/\\N|\\n/g, " ")
        .replace(/\\h/g, " ")
        .trim();
}
function looksLikeSignsOrSongs(style, name, effect, text) {
    const meta = (style + " " + name + " " + effect).toLowerCase();
    if (/signs?|songs?|lyrics?|karaoke|opening|ending|\bop\b|\bed\b|insert|typeset|screen|title|note/.test(meta))
        return true;
    if (/\\k(?:f|o)?\d+/i.test(text))
        return true;
    // Some releases use a generic style for on-screen text but position/typeset it heavily.
    const plain = stripAssTags(text);
    const positioned = /\\(?:pos|move)\s*\(/i.test(text);
    const typeset = /\\(?:fn|fs|bord|shad|frx|fry|frz|fax|fay|c&H|1c&H|3c&H)/i.test(text);
    if (positioned && typeset && plain.length > 0 && plain.length <= 100)
        return true;
    return false;
}
function deriveSignsSongsAss(input) {
    const normalized = input.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    let inEvents = false;
    let eventFormat = [];
    let kept = 0;
    const output = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (/^\[Events\]$/i.test(trimmed)) {
            inEvents = true;
            output.push(line);
            continue;
        }
        if (/^\[[^\]]+\]$/.test(trimmed) && !/^\[Events\]$/i.test(trimmed)) {
            inEvents = false;
            output.push(line);
            continue;
        }
        if (!inEvents) {
            output.push(line);
            continue;
        }
        if (/^Format\s*:/i.test(trimmed)) {
            eventFormat = trimmed.slice(trimmed.indexOf(":") + 1).split(",").map(x => x.trim().toLowerCase());
            output.push(line);
            continue;
        }
        if (/^Comment\s*:/i.test(trimmed))
            continue;
        if (!/^Dialogue\s*:/i.test(trimmed)) {
            output.push(line);
            continue;
        }
        const colon = line.indexOf(":");
        const kind = line.slice(0, colon + 1);
        const payload = line.slice(colon + 1);
        const format = eventFormat.length ? eventFormat : ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
        const fields = splitAssFields(payload, format.length);
        const get = (key) => {
            const i = format.indexOf(key);
            return i >= 0 ? String(fields[i] || "") : "";
        };
        if (looksLikeSignsOrSongs(get("style"), get("name"), get("effect"), get("text"))) {
            output.push(kind + fields.join(","));
            kept++;
        }
    }
    return { content: output.join("\r\n"), count: kept };
}
module.exports = { timingCues, deriveSignsSongsAss };
