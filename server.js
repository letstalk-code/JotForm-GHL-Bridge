require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const multer = require('multer'); // Added to handle Multipart Form Data

const app = express();
const upload = multer(); // For handling multipart/form-data
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const BRIDGE_URL = "https://jotform-ghl-bridge.onrender.com/webhook/jotform";
const GHL_ROUTER_URL = process.env.GHL_ROUTER_URL;

/**
 * AUTO-SYNC: Ensures all forms are connected
 */
async function syncAllForms() {
    try {
        const formsResponse = await axios.get('https://api.jotform.com/user/forms', {
            headers: { 'APIKEY': JOTFORM_API_KEY }
        });
        const forms = formsResponse.data.content;
        for (const form of forms) {
            const webhooksResponse = await axios.get(`https://api.jotform.com/form/${form.id}/webhooks`, {
                headers: { 'APIKEY': JOTFORM_API_KEY }
            });
            const webhooks = Object.values(webhooksResponse.data.content || {});
            if (!webhooks.includes(BRIDGE_URL)) {
                await axios.post(`https://api.jotform.com/form/${form.id}/webhooks`, `webhookURL=${encodeURIComponent(BRIDGE_URL)}`, {
                    headers: { 'APIKEY': JOTFORM_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
                });
            }
        }
    } catch (e) { /* silent sync */ }
}
setInterval(syncAllForms, 15 * 60 * 1000);

/**
 * BRIDGE WEBHOOK - Updated to handle all formats
 */
app.post('/webhook/jotform', upload.any(), async (req, res) => {
    // Respond to JotForm immediately
    res.status(200).send({ status: "received" });

    try {
        console.log('--- 📬 NEW SUBMISSION RECEIVED ---');
        console.log('Content-Type:', req.headers['content-type']);

        // Check body and files (multipart)
        let submission = req.body || {};

        // If JotForm sends a JSON string inside a field
        if (submission.rawRequest) {
            try {
                submission = JSON.parse(submission.rawRequest);
            } catch (e) { }
        }

        console.log('SUBMISSION DATA:', JSON.stringify(submission, null, 2));

        const getField = (keys) => {
            for (const key of keys) {
                if (submission[key]) return submission[key];
            }
            const foundKey = Object.keys(submission).find(k => keys.some(search => k.toLowerCase().includes(search.toLowerCase())));
            return foundKey ? submission[foundKey] : "";
        };

        const brideName = getField(['q15_bridesName', 'bridesName', 'name']) || {};
        const groomName = getField(['q85_groomsName', 'groomsName']) || {};
        const weddingDate = getField(['q117_weddingDate', 'weddingDate', 'eventDate']) || {};

        const prettyData = {
            form_id: submission.formID || submission.form_id || "",
            form_title: submission.formTitle || submission.form_title || "",
            first_name: brideName.first || (typeof brideName === 'string' ? brideName.split(' ')[0] : ""),
            last_name: brideName.last || (typeof brideName === 'string' ? brideName.split(' ').slice(1).join(' ') : ""),
            email: getField(['q113_email', 'email', 'email114']),
            phone: getField(['q37_phoneNumber', 'phone', 'mobile']),
            brides_first_name: brideName.first || "",
            brides_last_name: brideName.last || "",
            grooms_first_name: groomName.first || "",
            grooms_last_name: groomName.last || "",
            event_date: weddingDate.month ? `${weddingDate.month}/${weddingDate.day}/${weddingDate.year}` : (typeof weddingDate === 'string' ? weddingDate : ""),
            venue_location: getField(['q88_weddingCeremony88', 'venue', 'ceremony']),
            reception_location: getField(['q89_weddingReception', 'reception'])
        };

        console.log('✨ CLEANED DATA:', JSON.stringify(prettyData, null, 2));

        if (GHL_ROUTER_URL && prettyData.email) {
            await axios.post(GHL_ROUTER_URL, prettyData);
            console.log('✅ FORWARDED TO GHL');
        } else if (!prettyData.email) {
            console.log('⚠️ SKIPPED: No email found in submission.');
        }
    } catch (error) {
        console.error('❌ BRIDGE ERROR:', error.message);
    }
});

app.listen(PORT, () => { console.log(`🚀 Resilient Bridge live on port ${PORT}`); });
