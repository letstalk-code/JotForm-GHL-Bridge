require('dotenv').config();
const axios = require('axios');

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const BRIDGE_URL = "https://jotform-ghl-bridge.onrender.com/webhook/jotform";

async function hardResetWebhooks() {
    try {
        const formsResponse = await axios.get('https://api.jotform.com/user/forms', {
            headers: { 'APIKEY': JOTFORM_API_KEY }
        });

        const forms = formsResponse.data.content;
        console.log(`Hard resetting ${forms.length} forms...`);

        for (const form of forms) {
            // Get current webhooks
            const webhooksResponse = await axios.get(`https://api.jotform.com/form/${form.id}/webhooks`, {
                headers: { 'APIKEY': JOTFORM_API_KEY }
            });

            const webhooks = webhooksResponse.data.content || {};

            // Delete EVERYTHING
            for (const [webhookId, url] of Object.entries(webhooks)) {
                await axios.delete(`https://api.jotform.com/form/${form.id}/webhooks/${webhookId}`, {
                    headers: { 'APIKEY': JOTFORM_API_KEY }
                });
            }
            console.log(`🧹 Wiped all webhooks from: ${form.title}`);

            // Add back ONLY the correct Bridge
            await axios.post(`https://api.jotform.com/form/${form.id}/webhooks`, `webhookURL=${encodeURIComponent(BRIDGE_URL)}`, {
                headers: {
                    'APIKEY': JOTFORM_API_KEY,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            console.log(`✅ Re-Bridged: ${form.title}`);
        }
        console.log('\n✨ JOTFORM CLEANUP COMPLETE. Only the Bridge remains!');
    } catch (error) {
        console.error('Hard Reset Error:', error.message);
    }
}

hardResetWebhooks();
