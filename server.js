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
                console.log(`🚀 Bridged: ${form.title}`);
            }
        }
    } catch (e) { console.error('Sync Error:', e.message); }
}
setInterval(syncAllForms, 10 * 60 * 1000);
syncAllForms();

/**
 * BRIDGE WEBHOOK
 */
app.post('/webhook/jotform', async (req, res) => {
    try {
        console.log('--- 📬 NEW SUBMISSION RECEIVED ---');
        console.log('RAW DATA:', JSON.stringify(req.body, null, 2));

        const data = req.body;

        // Use a more flexible name picker
        const getField = (keys) => {
            for (const key of keys) {
                if (data[key]) return data[key];
            }
            // Smart search: find any key that contains the string
            const foundKey = Object.keys(data).find(k => keys.some(search => k.toLowerCase().includes(search.toLowerCase())));
            return foundKey ? data[foundKey] : "";
        };

        const brideName = getField(['q15_bridesName', 'bridesName', 'name']);
        const groomName = getField(['q85_groomsName', 'groomsName']);
        const weddingDate = getField(['q117_weddingDate', 'weddingDate', 'eventDate']);

        const prettyData = {
            form_id: data.formID || "",
            form_title: data.formTitle || "",
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

        await axios.post(GHL_ROUTER_URL, prettyData);
        console.log('✅ FORWARDED TO GHL');
        res.status(200).send({ status: "success" });
    } catch (error) {
        console.error('❌ ERROR:', error.message);
        res.status(500).send({ error: error.message });
    }
});

app.listen(PORT, () => { console.log(`🚀 Bridge live on port ${PORT}`); });
