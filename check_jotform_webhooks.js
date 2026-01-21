require('dotenv').config();
const axios = require('axios');

const JOTFORM_API_KEY = process.env.JOTFORM_API_KEY;

async function checkWebhooks() {
    try {
        const formsResponse = await axios.get('https://api.jotform.com/user/forms', {
            headers: { 'APIKEY': JOTFORM_API_KEY }
        });

        const forms = formsResponse.data.content;
        console.log(`Checking ${forms.length} forms for webhooks...\n`);

        for (const form of forms) {
            const webhooksResponse = await axios.get(`https://api.jotform.com/form/${form.id}/webhooks`, {
                headers: { 'APIKEY': JOTFORM_API_KEY }
            });

            const webhooks = Object.values(webhooksResponse.data.content || {});
            console.log(`Form: "${form.title}" (ID: ${form.id})`);
            if (webhooks.length === 0) {
                console.log('   ❌ No webhooks found.');
            } else {
                webhooks.forEach(url => console.log(`   🔗 ${url}`));
            }
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

checkWebhooks();
