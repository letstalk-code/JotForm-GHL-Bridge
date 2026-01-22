require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer');

const app = express();
const upload = multer();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const BRIDGE_URL = "https://jotform-ghl-bridge.onrender.com/webhook/jotform";
const GHL_ROUTER_URL = process.env.GHL_ROUTER_URL;

/**
 * NEW: POWERFUL FIELD EXTRACTOR
 * This handles [first], [last], [month] and even deep-nested JotForm data.
 */
function extractJotformData(body) {
    const data = body || {};

    // Helper to find a value by searching keys for a specific string (e.g. 'bridesName')
    const findValue = (search, subkey = null) => {
        const fullSearch = subkey ? `${search}[${subkey}]` : search;

        // 1. Try exact match
        if (data[fullSearch]) return data[fullSearch];

        // 2. Try partial match on the key (handles qID prefixes)
        const foundKey = Object.keys(data).find(k => {
            const lowerK = k.toLowerCase();
            const lowerSearch = search.toLowerCase();
            if (subkey) {
                return lowerK.includes(lowerSearch) && lowerK.includes(`[${subkey.toLowerCase()}]`);
            }
            return lowerK.includes(lowerSearch);
        });

        return foundKey ? data[foundKey] : "";
    };

    // Construct Name components
    const b_first = findValue('bridesName', 'first') || findValue('name', 'first') || "";
    const b_last = findValue('bridesName', 'last') || findValue('name', 'last') || "";
    const g_first = findValue('groomsName', 'first') || "";
    const g_last = findValue('groomsName', 'last') || "";

    // Construct Date component (MM/DD/YYYY)
    const d_month = findValue('weddingDate', 'month') || findValue('eventDate', 'month') || "";
    const d_day = findValue('weddingDate', 'day') || findValue('eventDate', 'day') || "";
    const d_year = findValue('weddingDate', 'year') || findValue('eventDate', 'year') || "";
    const formattedDate = (d_month && d_day && d_year) ? `${d_month}/${d_day}/${d_year}` : "";

    return {
        form_id: data.formID || "",
        form_title: data.formTitle || "",
        first_name: b_first,
        last_name: b_last,
        email: findValue('email') || "",
        phone: findValue('phoneNumber') || findValue('phone') || "",
        brides_first_name: b_first,
        brides_last_name: b_last,
        grooms_first_name: g_first,
        grooms_last_name: g_last,
        event_date: formattedDate,
        venue_location: findValue('weddingCeremony') || findValue('ceremony') || findValue('venue') || "",
        reception_location: findValue('weddingReception') || findValue('reception') || ""
    };
}

/**
 * WEBHOOK: The Master Bridge
 */
app.post('/webhook/jotform', upload.any(), async (req, res) => {
    res.status(200).send({ status: "received" });

    try {
        console.log('--- 📬 NEW SUBMISSION RECEIVED ---');

        const rawData = req.body || {};
        const prettyData = extractJotformData(rawData);

        console.log('✨ TRANSLATED DATA FOR GHL:', JSON.stringify(prettyData, null, 2));

        if (GHL_ROUTER_URL && prettyData.email) {
            await axios.post(GHL_ROUTER_URL, prettyData);
            console.log(`✅ SUCCESS: [${prettyData.form_title}] sent to GHL for ${prettyData.first_name}`);
        } else {
            console.log('⚠️ DATA INCOMPLETE: Still missing Email or Router URL.');
            console.log('DEBUG: RAW KEYS RECEIVED:', Object.keys(rawData).join(', '));
        }
    } catch (error) {
        console.error('❌ BRIDGE PROCESSING ERROR:', error.message);
    }
});

app.listen(PORT, () => { console.log(`🚀 Master Bridge V2 Live on port ${PORT}`); });
