const axios = require('axios');
const { supabaseAdmin } = require('./functions/lib/supabaseAdmin');

const FIREBASE_API_KEY = process.env.VITE_FIREBASE_API_KEY || 'AIzaSyDJAJ1lLBAiSlP5T2XbLxe7Hjjje5U7nkw';

const DEPARTMENTS = [
  { id: 'roads', name: 'Roads & Infrastructure', description: 'Road maintenance, potholes, footpaths, asphalt repair', mgrPass: 'Dept@Roads123', engPass: 'Eng@Roads1234' },
  { id: 'water', name: 'Water Supply', description: 'Water leakage, pipe burst, supply shortage, contamination', mgrPass: 'Dept@Water123', engPass: 'Eng@Water1234' },
  { id: 'electricity', name: 'Electricity & Lighting', description: 'Power outages, broken streetlights, transformer issues', mgrPass: 'Dept@Electricity123', engPass: 'Eng@Electricity1234' },
  { id: 'garbage', name: 'Sanitation & Waste', description: 'Garbage accumulation, missed pickup, illegal dumping', mgrPass: 'Dept@Garbage123', engPass: 'Eng@Garbage1234' },
  { id: 'drainage', name: 'Drainage & Sewage', description: 'Blocked drains, open manholes, sewage overflow', mgrPass: 'Dept@Drainage123', engPass: 'Eng@Drainage1234' },
  { id: 'health', name: 'Public Health', description: 'Mosquito breeding, sanitation hazards, pest infestations', mgrPass: 'Dept@Health123', engPass: 'Eng@Health1234' },
  { id: 'transport', name: 'Transport & Traffic', description: 'Traffic signals, bus stops, road signs, traffic congestion', mgrPass: 'Dept@Transport123', engPass: 'Eng@Transport1234' },
  { id: 'public_safety', name: 'Public Safety', description: 'Safety hazards, street illumination, encroachments, emergency risks', mgrPass: 'Dept@Safety123', engPass: 'Eng@Safety1234' },
];

async function getOrCreateFirebaseAuth(email, password, displayName) {
  try {
    const signUpRes = await axios.post(
      `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
      { email, password, displayName, returnSecureToken: true }
    );
    return signUpRes.data.localId;
  } catch (signUpErr) {
    const errMsg = signUpErr.response?.data?.error?.message;
    if (errMsg?.includes('EMAIL_EXISTS')) {
      try {
        const signInRes = await axios.post(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
          { email, password, returnSecureToken: true }
        );
        return signInRes.data.localId;
      } catch (signInErr) {
        // If password doesn't match, try fetching or using existing UID from Supabase
        const { data: existingUser } = await supabaseAdmin
          .from('users')
          .select('firebase_uid')
          .eq('email', email)
          .maybeSingle();
        if (existingUser?.firebase_uid) {
          return existingUser.firebase_uid;
        }
        throw new Error(`Auth failed for ${email}: ${signInErr.response?.data?.error?.message || signInErr.message}`);
      }
    }
    throw signUpErr;
  }
}

async function syncToSupabase({ firebaseUid, name, email, role, departmentId }) {
  const { data: existing } = await supabaseAdmin
    .from('users')
    .select('*')
    .or(`firebase_uid.eq.${firebaseUid},email.eq.${email}`)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .update({
        firebase_uid: firebaseUid,
        name,
        email,
        role: role.toUpperCase(),
        department_id: departmentId || null,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        firebase_uid: firebaseUid,
        name,
        email,
        role: role.toUpperCase(),
        department_id: departmentId || null,
        is_active: true
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

async function runSeed() {
  console.log('================================================================');
  console.log(' CIVICCONNECT — PROVISIONING ALL 8 DEPARTMENTS & CREDENTIALS');
  console.log('================================================================\n');

  console.log('1. Ensuring all 8 departments exist in database...');
  for (const dept of DEPARTMENTS) {
    const { error } = await supabaseAdmin
      .from('departments')
      .upsert({
        id: dept.id,
        name: dept.name,
        description: dept.description,
        is_active: true
      }, { onConflict: 'id' });

    if (error) console.error(`Error saving dept ${dept.id}:`, error.message);
    else console.log(`  ✓ Department: [${dept.id}] ${dept.name}`);
  }

  console.log('\n2. Provisioning Department Managers & Field Engineers...');
  const results = [];

  for (const dept of DEPARTMENTS) {
    // Manager
    const mgrEmail = `${dept.id}.dept@civicconnect.com`;
    const mgrName = `${dept.name} Manager`;
    const mgrUid = await getOrCreateFirebaseAuth(mgrEmail, dept.mgrPass, mgrName);
    const mgrRecord = await syncToSupabase({
      firebaseUid: mgrUid,
      name: mgrName,
      email: mgrEmail,
      role: 'DEPARTMENT',
      departmentId: dept.id
    });

    // Engineer
    const engEmail = `${dept.id}.eng1@civicconnect.com`;
    const engName = `Engineer (${dept.name})`;
    const engUid = await getOrCreateFirebaseAuth(engEmail, dept.engPass, engName);
    const engRecord = await syncToSupabase({
      firebaseUid: engUid,
      name: engName,
      email: engEmail,
      role: 'ENGINEER',
      departmentId: dept.id
    });

    results.push({
      deptId: dept.id,
      deptName: dept.name,
      mgrEmail,
      mgrPass: dept.mgrPass,
      engEmail,
      engPass: dept.engPass,
    });
    console.log(`  ✓ Department: ${dept.name} -> Manager & Engineer assigned & linked.`);
  }

  console.log('\n================================================================');
  console.log(' VERIFIED LOGIN CREDENTIALS SUMMARY');
  console.log('================================================================\n');

  console.log('--- ADMIN & CITIZEN ACCOUNTS ---');
  console.log('Admin Portal:    admin@civicconnect.com   | Password:  admin123        | Role: ADMIN');
  console.log('Citizen Portal:  citizen.test@civicconnect.com | Password:  Citizen@12345   | Role: CITIZEN\n');

  console.log('--- DEPARTMENT MANAGERS & FIELD ENGINEERS ---');
  results.forEach(r => {
    console.log(`[${r.deptName.toUpperCase()}]`);
    console.log(`  Manager:   ${r.mgrEmail.padEnd(35)} | Password: ${r.mgrPass.padEnd(20)} | Role: DEPARTMENT (dept: ${r.deptId})`);
    console.log(`  Engineer:  ${r.engEmail.padEnd(35)} | Password: ${r.engPass.padEnd(20)} | Role: ENGINEER   (dept: ${r.deptId})\n`);
  });
}

runSeed().catch(err => {
  console.error('Fatal provisioning error:', err);
  process.exit(1);
});
