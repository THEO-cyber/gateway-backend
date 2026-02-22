const axios = require('axios');

async function testPerformance() {
  console.log('🚀 Testing backend performance...\n');
  
  const baseURL = 'http://localhost:5000';
  const tests = [
    { name: 'Health Check', url: '/health' },
    { name: 'Auth Login (should fail)', url: '/api/auth/login' },
    { name: 'Public Courses', url: '/api/courses/public' }
  ];
  
  for (const test of tests) {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${baseURL}${test.url}`, {
        timeout: 10000,
        headers: {
          'Authorization': 'Bearer test-token'
        }
      }).catch(err => {
        // Handle expected auth errors
        return { status: err.response?.status || 500, data: err.response?.data };
      });
      
      const duration = Date.now() - startTime;
      console.log(`✅ ${test.name}: ${duration}ms (Status: ${response.status})`);
      
      if (duration > 3000) {
        console.log(`   ⚠️  Slow response detected!`);
      }
      
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error.message}`);
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 Performance test completed');
}

testPerformance().catch(console.error);