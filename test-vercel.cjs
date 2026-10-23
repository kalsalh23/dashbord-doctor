const bcrypt = require('bcryptjs');
const https = require('https');

https.get('https://dashbord-doctor.vercel.app/seed-data.json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const d = JSON.parse(data);
    const randaUser = (d.users || []).find(u => u.email === 'rnda@gmail.com');
    
    if (!randaUser) {
      console.log('ERROR: rnda@gmail.com not found in deployed seed');
      return;
    }
    
    console.log('User email:', randaUser.email);
    console.log('Password hash:', randaUser.password_hash.slice(0, 40) + '...');
    
    const match = bcrypt.compareSync('rnda@2026', randaUser.password_hash);
    console.log('\nPassword rnda@2026 matches:', match);
    
    if (match) {
      console.log('\n=== LOGIN WILL WORK ===');
      console.log('Email: rnda@gmail.com');
      console.log('Password: rnda@2026');
      console.log('Clinic: عيادة الدكتورة رندة مصطفى الشيخ علي');
      console.log('Specialty: غدد وسكري (endocrine)');
    } else {
      console.log('\n=== LOGIN WILL FAIL - password mismatch ===');
    }
  });
}).on('error', e => console.error('Error:', e.message));