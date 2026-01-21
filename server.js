require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/**
 * BRIDGE: JotForm to GHL (Subaccount 2)
 * Translates JotForm internal codes into "Pretty" fields for GHL.
 */
app.post('/webhook/jotform', async (req, res) => {
    try {
        const data = req.body;
        console.log('📬 [JotForm Bridge] Received signature for:', data.formTitle || data.formID);

        // Map JotForm structure to the "Pretty" names you set up in GHL
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

        // Forward to the GHL Webhook you created
        await axios.post(process.env.GHL_ROUTER_URL, prettyData);

        console.log('✅ Successfully forwarded to GHL Subaccount 2');
        res.status(200).send({ status: "success" });
    } catch (error) {
        console.error('❌ Bridge Error:', error.message);
        res.status(500).send({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 JotForm Bridge is running on port ${PORT}`);
});
