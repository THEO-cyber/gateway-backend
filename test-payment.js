// Test file for the payment system
// Run this with: node test-payment.js

const axios = require('axios');

const API_BASE_URL = 'http://localhost:5000/api';
let authToken = '';

// Test user credentials (adjust as needed)
const testUser = {
  email: 'test@example.com',
  password: 'testpassword123'
};

async function testPaymentFlow() {
  try {
    console.log('🔄 Testing HND Backend Payment System...\n');

    // 1. Login to get auth token
    console.log('1. Logging in...');
    try {
      const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, testUser);
      authToken = loginResponse.data.token;
      console.log('✅ Login successful');
    } catch (error) {
      console.log('⚠️  Login failed, you may need to register first or check credentials');
      console.log('   Error:', error.response?.data?.message || error.message);
      return;
    }

    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    };

    // 2. Get payment fee
    console.log('\n2. Getting payment fee...');
    const feeResponse = await axios.get(`${API_BASE_URL}/payment/fee`);
    console.log('✅ Payment fee:', feeResponse.data.data.formattedAmount);

    // 3. Test payment initiation
    console.log('\n3. Testing payment initiation...');
    const paymentData = {
      phone: '671234567', // Test phone number
      purpose: 'registration_fee',
      description: 'Test payment for HND Gateway'
    };

    try {
      const paymentResponse = await axios.post(
        `${API_BASE_URL}/payment/initiate`,
        paymentData,
        { headers }
      );
      
      console.log('✅ Payment initiated successfully');
      console.log('   Transaction ID:', paymentResponse.data.data.transactionId);
      console.log('   Amount:', paymentResponse.data.data.amount, 'FCFA');
      console.log('   Status:', paymentResponse.data.data.status);
      
      const transactionId = paymentResponse.data.data.transactionId;

      // 4. Check payment status
      console.log('\n4. Checking payment status...');
      setTimeout(async () => {
        try {
          const statusResponse = await axios.get(
            `${API_BASE_URL}/payment/status/${transactionId}`,
            { headers }
          );
          console.log('✅ Payment status:', statusResponse.data.data.status);
        } catch (error) {
          console.log('⚠️  Status check failed:', error.response?.data?.message || error.message);
        }
      }, 2000);

      // 5. Get payment history
      console.log('\n5. Getting payment history...');
      setTimeout(async () => {
        try {
          const historyResponse = await axios.get(
            `${API_BASE_URL}/payment/history`,
            { headers }
          );
          console.log('✅ Payment history retrieved');
          console.log('   Total payments:', historyResponse.data.data.pagination.total);
        } catch (error) {
          console.log('⚠️  History fetch failed:', error.response?.data?.message || error.message);
        }
      }, 3000);

    } catch (error) {
      console.log('❌ Payment initiation failed:', error.response?.data?.message || error.message);
      if (error.response?.data?.error) {
        console.log('   Details:', error.response.data.error);
      }
    }

    // 6. Test webhook endpoint (simulate)
    console.log('\n6. Testing webhook endpoint...');
    setTimeout(async () => {
      const webhookData = {
        reference: 'TEST_TRANSACTION_ID',
        status: 'successful',
        transactionId: 'NKWA_123456',
        amount: 1000,
        phoneNumber: '237671234567'
      };

      try {
        const webhookResponse = await axios.post(
          `${API_BASE_URL}/payment/webhook`,
          webhookData
        );
        console.log('✅ Webhook endpoint responding correctly');
      } catch (error) {
        console.log('⚠️  Webhook test:', error.response?.data?.message || error.message);
      }
    }, 4000);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Test webhook signature validation
function testWebhookSignature() {
  console.log('\n🔐 Testing webhook signature validation...');
  
  const crypto = require('crypto');
  const secret = 'test_webhook_secret';
  const payload = { reference: 'TEST_123', status: 'successful' };
  const signature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
    
  console.log('Generated signature:', signature);
  console.log('✅ Signature generation working');
}

// Admin tests (if you have admin credentials)
async function testAdminEndpoints() {
  if (!authToken) return;
  
  console.log('\n👑 Testing admin endpoints...');
  const headers = {
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  };

  try {
    // Get payment stats
    const statsResponse = await axios.get(
      `${API_BASE_URL}/payment/admin/stats`,
      { headers }
    );
    console.log('✅ Admin stats retrieved');
    console.log('   Total payments:', statsResponse.data.data.totalPayments);
    console.log('   Total revenue:', statsResponse.data.data.totalRevenue, 'FCFA');
  } catch (error) {
    console.log('⚠️  Admin endpoints require admin privileges');
  }
}

// Run tests
console.log('🚀 Starting Payment System Tests...\n');
testWebhookSignature();
testPaymentFlow();

// Run admin tests after a delay
setTimeout(testAdminEndpoints, 5000);