/**
 * Verification script for the Places Catalog Loop.
 * 
 * Usage:
 * 1. Ensure .env.local has GOOGLE_MAPS_API_KEY and ANTHROPIC_API_KEY.
 * 2. Run with: npx tsx scripts/verify-catalog-loop.ts
 */

const tripId = 'f3264788-ced8-4b2d-9eca-0c380d155c8';
const baseUrl = 'http://localhost:3000';

async function verify() {
  console.log('🚀 Verification Guide for Places Catalog Loop');
  console.log('-------------------------------------------');
  console.log(`Trip ID: ${tripId}`);
  
  console.log('\n1. 🔑 GETTING YOUR ACCESS TOKEN:');
  console.log('   a. Open your app in the browser (localhost:3000) and log in.');
  console.log('   b. Open DevTools (F12 or Cmd+Option+I).');
  console.log('   c. Go to the "Application" tab -> "Cookies" -> "http://localhost:3000".');
  console.log('   d. Look for the cookie named "sb-access-token" (or similar from Supabase).');
  console.log('   e. Copy its Value.');

  console.log('\n2. 📡 TRIGGER THE LOOP:');
  console.log('   Run this command in your terminal (paste your token):');
  console.log(`\n   curl -X POST ${baseUrl}/api/trips/${tripId}/place-catalog \\`);
  console.log(`     -H "Content-Type: application/json" \\`);
  console.log(`     --cookie "sb-access-token=YOUR_COPIED_TOKEN_HERE"`);

  console.log('\n3. 📊 VERIFY IN DATABASE:');
  console.log('   Run these SQL queries in Supabase Studio to confirm success:');
  console.log(`\n   -- Check if trip now owns a destination:`);
  console.log(`   SELECT t.title, d.name as destination_name `);
  console.log(`   FROM trips t JOIN destinations d ON t.destination_id = d.id `);
  console.log(`   WHERE t.id = '${tripId}';`);
  
  console.log(`\n   -- Count discovered places for this trip's destination:`);
  console.log(`   SELECT count(*) `);
  console.log(`   FROM places `);
  console.log(`   WHERE destination_id = (SELECT destination_id FROM trips WHERE id = '${tripId}');`);
}

verify().catch(console.error);
