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
 * FEATURE: /resync
 * Visit this in your browser to automatically connect all new JotForms!
 */
app.get('/resync', async (req, res) => {
    try {
        console.log('🔄 Manual Sync Triggered: Checking for un-bridged forms...');
        const formsResponse = await axios.get('https://api.jotform.com/user/forms', {
            headers: { 'APIKEY': JOTFORM_API_KEY }
        });

        const forms = formsResponse.data.content;
        let addedCount = 0;
        let alreadyBridged = 0;

        for (const form of forms) {
            const webhooksResponse = await axios.get(`https://api.jotform.com/form/${form.id}/webhooks`, {
                headers: { 'APIKEY': JOTFORM_API_KEY }
            });

            const webhooks = Object.values(webhooksResponse.data.content || {});
            if (webhooks.includes(BRIDGE_URL)) {
                alreadyBridged++;
                continue;
            }

            // Not bridged? Add it!
            await axios.post(`https://api.jotform.com/form/${form.id}/webhooks`, `webhookURL=${encodeURIComponent(BRIDGE_URL)}`, {
                headers: { 'APIKEY': JOTFORM_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            addedCount++;
        }

        res.send(`<h1>✨ JotForm Bridge Sync Complete</h1>
                  <p>Check your terminal logs for details.</p>
                  <ul>
                    <li><b>Newly Bridged:</b> ${addedCount} forms</li>
                    <li><b>Already Connected:</b> ${alreadyBridged} forms</li>
                  </ul>
                  <p>You can now close this tab. All contracts are live!</p>`);
    } catch (error) {
        res.status(500).send(`<h1>❌ Sync Failed</h1><p>${error.message}</p>`);
    }
});

/**
 * BRIDGE: JotForm to GHL
 */
app.post('/webhook/jotform', async (req, res) => {
    try {
        const data = req.body;
        console.log('📬 [JotForm Bridge] Received signature for:', data.formTitle || data.formID);

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
        console.log('✅ Success: Sent to GHL.');
        res.status(200).send({ status: "success" });
    } catch (error) {
        console.error('❌ Bridge Error:', error.message);
        res.status(500).send({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 JotForm Bridge Live on port ${PORT}`);
});
