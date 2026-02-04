// Simple test script for chatbot endpoints
import axios from 'axios';

const BASE_URL = 'https://attendance-app-backend-jdny.onrender.com/api';
const TEST_STUDENT_ROLLNO = '22CS001'; // Replace with actual student roll number
const TEST_PASSWORD = 'password123'; // Replace with actual password

let authToken = '';

async function login() {
  try {
    console.log('🔐 Logging in as student...');
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: TEST_STUDENT_ROLLNO,
      password: TEST_PASSWORD,
      role: 'student'
    });
    
    if (response.data.success) {
      authToken = response.data.token;
      console.log('✅ Login successful');
      return true;
    }
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    return false;
  }
}

async function testChatbotStats() {
  try {
    console.log('\n📊 Testing chatbot stats endpoint...');
    const response = await axios.get(`${BASE_URL}/chatbot/stats`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ Stats retrieved:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Stats test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testAskQuestion() {
  try {
    console.log('\n💬 Testing ask question endpoint...');
    const response = await axios.post(
      `${BASE_URL}/chatbot/ask`,
      { question: 'What is my attendance percentage?' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    
    console.log('✅ Question answered:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Ask question failed:', error.response?.data || error.message);
    return false;
  }
}

async function testRateLimit() {
  try {
    console.log('\n⏱️  Testing rate limit (asking 2 questions quickly)...');
    
    // First question
    await axios.post(
      `${BASE_URL}/chatbot/ask`,
      { question: 'Test question 1' },
      { headers: { Authorization: `Bearer ${authToken}` } }
    );
    console.log('✅ First question sent');
    
    // Second question immediately (should be rate limited)
    try {
      await axios.post(
        `${BASE_URL}/chatbot/ask`,
        { question: 'Test question 2' },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      console.log('⚠️  Second question went through (rate limit may not be working)');
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('✅ Rate limit working:', error.response.data.message);
        return true;
      }
      throw error;
    }
  } catch (error) {
    console.error('❌ Rate limit test failed:', error.response?.data || error.message);
    return false;
  }
}

async function testHistory() {
  try {
    console.log('\n📜 Testing chatbot history endpoint...');
    const response = await axios.get(`${BASE_URL}/chatbot/history`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    console.log('✅ History retrieved:', {
      total: response.data.data.total,
      count: response.data.data.history.length
    });
    return true;
  } catch (error) {
    console.error('❌ History test failed:', error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('🚀 Starting Chatbot API Tests\n');
  console.log('=' .repeat(50));
  
  const loginSuccess = await login();
  if (!loginSuccess) {
    console.log('\n❌ Cannot proceed without authentication');
    return;
  }
  
  await testChatbotStats();
  await testAskQuestion();
  await testRateLimit();
  await testHistory();
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ All tests completed!');
  console.log('\n⚠️  Note: RAG service integration needs to be configured');
  console.log('Set RAG_SERVICE_URL and RAG_API_KEY in .env file');
}

runTests();
