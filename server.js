require('dotenv').config();
const express = require('express');
const axios = require('axios');
const multer = require('multer');

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3001;

// Use standard parsers + Multer for Multipart
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const GHL_ROUTER_URL = process.env.GHL_ROUTER_URL;

/**
 * BRUTE FORCE EXTRACTOR
 * Scans every key in the JotForm data for keywords like 'first', 'last', 'month'.
 */
function extractMasterData(data) {
    const raw = data || {};

    const getVal = (search, sub) => {
        const foundKey = Object.keys(raw).find(k => {
            const lowK = k.toLowerCase();
            if (sub) return lowK.includes(search.toLowerCase()) && lowK.includes(`[${sub.toLowerCase()}]`);
            return lowK.includes(search.toLowerCase());
        });
        return foundKey ? raw[foundKey] : "";
    };

    // Constructing the Names
    const b_first = getVal('bridesName', 'first') || getVal('name', 'first') || "";
    const b_last = getVal('bridesName', 'last') || getVal('name', 'last') || "";
    const g_first = getVal('groomsName', 'first') || "";
    const g_last = getVal('groomsName', 'last') || "";

    // Constructing the Date
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
        console.log('--- 📬 NEW SUBMISSION RECEIVED ---');
        // Combine all possible data sources
        const combinedData = { ...req.body, ...req.query };
        const prettyData = extractMasterData(combinedData);

        console.log('✨ CLEANED DATA FOR GHL:', JSON.stringify(prettyData, null, 2));

        if (GHL_ROUTER_URL && prettyData.email) {
            await axios.post(GHL_ROUTER_URL, prettyData);
            console.log('✅ FORWARDED TO GHL SUCCESSFULLY');
        } else {
            console.log('⚠️ FAILED: No email detected in submission.');
        }
    } catch (e) {
        console.error('❌ ERROR:', e.message);
    }
});

app.listen(PORT, () => { console.log(`🚀 Bridge is Live.`); });
