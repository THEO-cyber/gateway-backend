require('dotenv').config();
const axios = require('axios');

console.log('🔍 Debugging Current Server Configuration...\n');

console.log('📋 Environment Variables:');
console.log('NKWAPAY_BASE_URL:', process.env.NKWAPAY_BASE_URL);
console.log('NKWAPAY_API_KEY:', process.env.NKWAPAY_API_KEY ? process.env.NKWAPAY_API_KEY.substring(0, 5) + '...' : 'NOT SET');
console.log('PAYMENT_FEE:', process.env.PAYMENT_FEE);

const baseUrl = process.env.NKWAPAY_BASE_URL || 'https://api.pay.staging.mynkwa.com';
const apiKey = process.env.NKWAPAY_API_KEY;

console.log('\n🌐 Effective Configuration:');
console.log('Using Base URL:', baseUrl);
console.log('API Key Status:', apiKey ? 'SET' : 'NOT SET');

// Test the API call exactly as the service would make it
async function testCurrentConfig() {
    console.log('\n🧪 Testing Current Configuration...');
    
    const testData = {
        amount: 1000,
        phoneNumber: '237671234567',
        reference: `DEBUG_${Date.now()}`,
        description: 'Debug test for current config'
    };
    
    try {
        const response = await axios.post(`${baseUrl}/collect`, testData, {
            headers: {
                'X-API-KEY': apiKey,
                'Content-Type': 'application/json'
            },
            timeout: 10000
        });
        
        console.log('✅ SUCCESS! API call worked');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.log('❌ FAILED! Same error as in your logs');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
            
            if (error.response.status === 401) {
                console.log('\n🔧 401 Unauthorized - Possible Issues:');
                console.log('1. API Key might be expired or deactivated');
                console.log('2. Wrong authentication header format');
                console.log('3. API key might be for different environment');
                console.log('4. Rate limiting or account issues');
            }
        } else {
            console.log('Error:', error.message);
        }
    }
}

testCurrentConfig();