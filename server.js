require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const BRIDGE_URL = "https://jotform-ghl-bridge.onrender.com/webhook/jotform";
const GHL_ROUTER_URL = process.env.GHL_ROUTER_URL;

/**
 * CORE LOGIC: Sync All Forms
 * Scans your account and ensures every form is connected to the bridge.
 */
async function syncAllForms() {
    try {
        console.log('🔄 [Auto-Sync] Scanning JotForm for new contracts...');
        const formsResponse = await axios.get('https://api.jotform.com/user/forms', {
            headers: { 'APIKEY': JOTFORM_API_KEY }
        });

        const forms = formsResponse.data.content;
        let addedCount = 0;

        for (const form of forms) {
            const webhooksResponse = await axios.get(`https://api.jotform.com/form/${form.id}/webhooks`, {
                headers: { 'APIKEY': JOTFORM_API_KEY }
            });

            const webhooks = Object.values(webhooksResponse.data.content || {});
            if (webhooks.includes(BRIDGE_URL)) continue;

            // Connect missing bridge
            await axios.post(`https://api.jotform.com/form/${form.id}/webhooks`, `webhookURL=${encodeURIComponent(BRIDGE_URL)}`, {
                headers: { 'APIKEY': JOTFORM_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            console.log(`🚀 Auto-Bridged: ${form.title}`);
            addedCount++;
        }

        if (addedCount > 0) console.log(`✨ Successfully added ${addedCount} new bridges.`);
    } catch (error) {
        console.error('❌ Auto-Sync Error:', error.message);
    }
}

// 🕒 Run sync every 10 minutes automatically
setInterval(syncAllForms, 10 * 60 * 1000);

// ⚡ Also run once immediately when the server starts
syncAllForms();

/**
 * WEBHOOK: The Translator Bridge
 */
app.post('/webhook/jotform', async (req, res) => {
    try {
        const data = req.body;
        console.log('📬 Received signature for:', data.formTitle || data.formID);

        // Translate to GHL Pretty Names
        const prettyData = {
            form_id: data.formID || "",
            form_title: data.formTitle || "",
            first_name: data.q15_bridesName?.first || (typeof data.q15_bridesName === 'string' ? data.q15_bridesName.split(' ')[0] : ""),
            last_name: data.q15_bridesName?.last || (typeof data.q15_bridesName === 'string' ? data.q15_bridesName.split(' ').slice(1).join(' ') : ""),
            email: data.q113_email || data.email114 || data.email || "",
            phone: data.q37_phoneNumber || "",
            brides_first_name: data.q15_bridesName?.first || "",
            brides_last_name: data.q15_bridesName?.last || "",
            grooms_first_name: data.q85_groomsName?.first || "",
            grooms_last_name: data.q85_groomsName?.last || "",
            event_date: (data.q117_weddingDate && data.q117_weddingDate.month) ? `${data.q117_weddingDate.month}/${data.q117_weddingDate.day}/${data.q117_weddingDate.year}` : "",
            venue_location: data.q88_weddingCeremony88 || "",
            reception_location: data.q89_weddingReception || ""
        };

        await axios.post(GHL_ROUTER_URL, prettyData);
        res.status(200).send({ status: "success" });
    } catch (error) {
        console.error('❌ Bridge Error:', error.message);
        res.status(500).send({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 JotForm Bridge is LIVE and Auto-Syncing.`);
});
