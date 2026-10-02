const axios = require('axios');
const FIREBASE_API_KEY = 'AIzaSyDJAJ1lLBAiSlP5T2XbLxe7Hjjje5U7nkw';

async function testLogin(email, password) {
  try {
    const res = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
      { email, password, returnSecureToken: true }
    );
    console.log(`[SUCCESS] ${email} with password "${password}"`);
    return true;
  } catch (err) {
    console.log(`[FAIL] ${email} with "${password}": ${err.response?.data?.error?.message}`);
    return false;
  }
}

async function run() {
  const passwordsToTest = ['Admin@12345', 'Admin@123', 'admin123', 'admin@123', 'Password@123', 'admin@civicconnect.com', 'CivicConnect@123', 'CivicAdmin@123', 'Sanjay@123', '12345678', '123456'];
  console.log('Testing Admin Passwords:');
  for (const p of passwordsToTest) {
    if (await testLogin('admin@civicconnect.com', p)) break;
  }

  console.log('\nTesting other accounts:');
  await testLogin('roads.dept@civicconnect.com', 'Dept@Roads123');
  await testLogin('water.dept@civicconnect.com', 'Dept@Water123');
  await testLogin('roads.eng1@civicconnect.com', 'Eng@Roads1234');
  await testLogin('water.eng1@civicconnect.com', 'Eng@Water1234');
  await testLogin('citizen.test@civicconnect.com', 'Citizen@12345');
}

run();
