require('dotenv').config();
const express = require('express');
const axios = require('axios');
const multer = require('multer');

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const GHL_ROUTER_URL = process.env.GHL_ROUTER_URL;

/**
 * SMART EXTRACTOR V3
 * Handles both "bracket" keys q15[first] and "object" keys { q15: { first: "" } }
 */
function extractMasterData(raw) {
    const getVal = (search, sub) => {
        // 1. Look for bracket notation: q15_bridesName[first]
        const bracketKey = Object.keys(raw).find(k =>
            k.toLowerCase().includes(search.toLowerCase()) && k.toLowerCase().includes(`[${sub.toLowerCase()}]`)
        );
        if (bracketKey) return raw[bracketKey];

        // 2. Look for object notation: q15_bridesName: { first: "..." }
        const objectKey = Object.keys(raw).find(k => k.toLowerCase().includes(search.toLowerCase()));
        if (objectKey && typeof raw[objectKey] === 'object' && raw[objectKey] !== null) {
            return raw[objectKey][sub] || "";
        }

        // 3. String Fallback (for single fields like email/phone)
        if (!sub && objectKey) return raw[objectKey];
        return "";
    };

    const b_first = getVal('bridesName', 'first') || getVal('name', 'first') || "";
    const b_last = getVal('bridesName', 'last') || getVal('name', 'last') || "";
    const g_first = getVal('groomsName', 'first') || "";
    const g_last = getVal('groomsName', 'last') || "";

    const m = getVal('weddingDate', 'month') || getVal('eventDate', 'month') || "";
    const d = getVal('weddingDate', 'day') || getVal('eventDate', 'day') || "";
    const y = getVal('weddingDate', 'year') || getVal('eventDate', 'year') || "";
    const weddingDate = (m && d && y) ? `${m}/${d}/${y}` : "";

    return {
        form_title: raw.formTitle || "Signed Contract",
        first_name: b_first || "New",
        last_name: b_last || "Bride",
        email: getVal('email') || "",
        phone: getVal('phoneNumber') || getVal('phone') || "",
        brides_first_name: b_first,
        brides_last_name: b_last,
        grooms_first_name: g_first,
        grooms_last_name: g_last,
        event_date: weddingDate,
        venue_location: getVal('weddingCeremony') || getVal('venue') || "",
        reception_location: getVal('weddingReception') || getVal('reception') || ""
    };
}

app.post('/webhook/jotform', upload.any(), async (req, res) => {
    res.status(200).send({ status: "ok" });
    try {
        console.log('--- 📬 NEW SUBMISSION ---');
        const prettyData = extractMasterData({ ...req.body, ...req.query });
        console.log('✨ SENDING TO GHL:', JSON.stringify(prettyData, null, 2));

        if (GHL_ROUTER_URL && prettyData.email) {
            await axios.post(GHL_ROUTER_URL, prettyData);
            console.log('✅ SUCCESS');
        }
    } catch (e) { console.error('❌ ERROR:', e.message); }
});

app.listen(PORT, () => { console.log(`🚀 Bridge V3 Live`); });
