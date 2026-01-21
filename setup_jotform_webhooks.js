require('dotenv').config();
const axios = require('axios');

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;
// This is your new dedicated Render bridge
const BRIDGE_URL = "https://jotform-ghl-bridge.onrender.com/webhook/jotform";

async function setupJotformWebhooks() {
    try {
        console.log('🔗 Connecting your 20+ JotForms to the New Bridge...');
        const formsResponse = await axios.get('https://api.jotform.com/user/forms', {
            headers: { 'APIKEY': JOTFORM_API_KEY }
        });

        const forms = formsResponse.data.content;
        console.log(`Found ${forms.length} forms.`);

        for (const form of forms) {
            try {
                // Check if already bridged
                const webhooksResponse = await axios.get(`https://api.jotform.com/form/${form.id}/webhooks`, {
                    headers: { 'APIKEY': JOTFORM_API_KEY }
                });

                const existingWebhooks = Object.values(webhooksResponse.data.content || {});
                if (existingWebhooks.includes(BRIDGE_URL)) {
                    console.log(`✅ ${form.title} is already connected.`);
                    continue;
                }

                // Add the new Bridge
                await axios.post(`https://api.jotform.com/form/${form.id}/webhooks`, `webhookURL=${encodeURIComponent(BRIDGE_URL)}`, {
                    headers: {
                        'APIKEY': JOTFORM_API_KEY,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });
                console.log(`🚀 Successfully Bridged: ${form.title}`);
            } catch (formErr) {
                console.error(`❌ Skip ${form.title}:`, formErr.message);
            }
        }
        console.log('\n✨ DONE! Every contract is now flowing through your new bridge.');
    } catch (error) {
        console.error('Setup Error:', error.message);
    }
}

setupJotformWebhooks();
