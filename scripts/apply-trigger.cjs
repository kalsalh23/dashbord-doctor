
const fs = require('fs');
const sql = fs.readFileSync('supabase/staff-webpush-trigger.sql', 'utf8');
fs.writeFileSync('apply-trigger.query', sql);
