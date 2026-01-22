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
 * MASTER EXTRACTOR V4
 * This version specifically handles JotForm's 'rawRequest' field.
 */
function extractMasterData(incoming) {
    let data = incoming || {};

    // 1. CRITICAL: Unpack JotForm's nested rawRequest if it exists
    if (data.rawRequest) {
        try {
            data = JSON.parse(data.rawRequest);
            console.log('📦 Unpacked real JotForm data.');
        } catch (e) {
            console.log('⚠️ Could not parse rawRequest, using body as-is.');
        }
    }

    const getVal = (search, sub) => {
        // Search inside the unpacked data
        const keys = Object.keys(data);

        // Match bracket notation or nested object
        const foundKey = keys.find(k => k.toLowerCase().includes(search.toLowerCase()));
        if (!foundKey) return "";

        if (sub) {
            // Check for [first] in the key name
            const bracketKey = keys.find(k => k.toLowerCase().includes(search.toLowerCase()) && k.toLowerCase().includes(`[${sub.toLowerCase()}]`));
            if (bracketKey) return data[bracketKey];

            // Check for nested object { name: { first: "" } }
            if (typeof data[foundKey] === 'object' && data[foundKey] !== null) {
                return data[foundKey][sub] || "";
            }
        }
        return data[foundKey];
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
        form_title: data.formTitle || data.form_title || "Wedding Contract",
        first_name: b_first || "New",
        last_name: b_last || "Bride",
        email: getVal('email') || "",
        phone: getVal('phoneNumber') || getVal('phone') || "",
        brides_first_name: b_first,
        brides_last_name: b_last,
        grooms_first_name: g_first,
        grooms_last_name: g_last,
        wedding_date: weddingDate,
        event_date: weddingDate,
        venue_location: getVal('weddingCeremony') || getVal('venue') || "",
        reception_location: getVal('weddingReception') || getVal('reception') || ""
    };
}

app.post('/webhook/jotform', upload.any(), async (req, res) => {
    res.status(200).send({ status: "ok" });
    try {
        const cleaned = extractMasterData({ ...req.body, ...req.query });
        console.log('✨ CLEANED DATA:', JSON.stringify(cleaned, null, 2));

        if (GHL_ROUTER_URL && cleaned.email) {
            await axios.post(GHL_ROUTER_URL, cleaned);
            console.log('✅ FORWARDED TO GHL');
        }
    } catch (e) {
        console.error('❌ ERROR:', e.message);
    }
});

app.listen(PORT, () => { console.log(`🚀 Bridge V4 Live`); });
