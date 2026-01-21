require('dotenv').config();
const axios = require('axios');

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
const KEEP_URL = "https://jotform-ghl-bridge.onrender.com/webhook/jotform";

async function deepCleanup() {
    try {
        const formsResponse = await axios.get('https://api.jotform.com/user/forms', {
            headers: { 'APIKEY': JOTFORM_API_KEY }
        });

        const forms = formsResponse.data.content;
        console.log(`Deep cleaning ${forms.length} forms...`);

        for (const form of forms) {
            const webhooksResponse = await axios.get(`https://api.jotform.com/form/${form.id}/webhooks`, {
                headers: { 'APIKEY': JOTFORM_API_KEY }
            });

            const webhooks = webhooksResponse.data.content || {};
            let foundKeep = false;

            for (const [webhookId, url] of Object.entries(webhooks)) {
                if (url === KEEP_URL) {
                    foundKeep = true;
                } else {
                    // Delete anything that isn't our new bridge
                    await axios.delete(`https://api.jotform.com/form/${form.id}/webhooks/${webhookId}`, {
                        headers: { 'APIKEY': JOTFORM_API_KEY }
                    });
                    console.log(`🗑 Deleted old/wrong webhook from: ${form.title}`);
                }
            }

            // If we didn't find our new bridge, add it
            if (!foundKeep) {
                await axios.post(`https://api.jotform.com/form/${form.id}/webhooks`, `webhookURL=${encodeURIComponent(KEEP_URL)}`, {
                    headers: { 'APIKEY': JOTFORM_API_KEY, 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                console.log(`✅ Fixed Bridge for: ${form.title}`);
            }
        }
        console.log('\n✨ ALL FORMS ARE NOW ONLY CONNECTED TO THE NEW BRIDGE.');
    } catch (error) {
        console.error('Cleanup Error:', error.message);
    }
}

deepCleanup();
