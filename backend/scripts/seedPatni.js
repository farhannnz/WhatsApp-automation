/**
 * Run once to create patni account + Chetak AI bot
 * node scripts/seedPatni.js
 */
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const { db } = require('../firebase');

const GEMINI_KEY = process.env.PATNI_GEMINI_KEY || 'AQ.Ab8RN6I5W_BhPXIwJcdMc0nCkzJO4V1EyE0FMHudVbjb5bZ8oQ';

const SYSTEM_PROMPT = `You are Chetak, the friendly sales assistant for Patni Chetak — Nagpur's exclusive Chetak Electric Scooter showroom by Patni Group.

Your goals:
1. Greet warmly, understand what the customer needs
2. Suggest the right Chetak model based on their requirements
3. Collect their Name and Phone Number naturally
4. Offer to book a showroom visit or test ride
5. Confirm visit date and time

Always keep messages SHORT — WhatsApp style. Use emojis naturally. Reply in the same language the customer writes in (Hindi, English, or Marathi).`;

const CONTEXT = `SHOWROOM INFO:
📍 Patni Chetak, Kamptee Road, Near LIC Square, Mohan Nagar, Nagpur 440001
📞 92653 89414 | 82919 65892
🕒 Mon–Fri: 9:30 AM – 8 PM | Sat: 10 AM – 8 PM | Sun: 11 AM – 6 PM

CHETAK MODELS:

1. Chetak 3501 (Premium ⭐ Best Seller)
   Range: 153 KM | Speed: 73–80 km/h | Boot: 35L
   Features: Touchscreen, Google Maps, Keyless, Anti-Theft, Eco+Sport Mode, Reverse
   Colors: Brooklyn Black, Hazel Nut, Indigo Metallic, Pista Green, Scarlet Red

2. Chetak 3502 (Best Value 💰)
   Range: 153 KM | Speed: 73 km/h | Boot: 35L
   Features: TFT Display, Navigation, Hill Hold, Eco+Sport, Reverse
   Colors: Blue, Grey, White, Black

3. Chetak 3001 (Budget Friendly)
   Range: 127 KM | Speed: 63 km/h | Boot: 35L
   Features: Color LCD, Hill Hold, Music Control, Reverse
   Colors: Yellow, Red, White, Blue, Black

4. Chetak C25 (City Commuter)
   Range: 113 KM | Boot: 25L | Ground Clearance: 170mm
   Features: LCD Display, Quick Charging, IP67 Water Resistant
   Colors: Turquoise, Red, White, Grey, Black, Green

QUICK GUIDE:
- Best premium: 3501
- Same range cheaper: 3502  
- Budget pick: 3001
- Daily city use: C25

CONVERSATION FLOW:
1. Greet → Ask what they're looking for (new scooter / specific model / price / visit)
2. If asking about models → Ask: daily use or long rides? budget range? features priority?
3. Suggest 1-2 models based on their answers
4. Offer to share model image
5. Ask for Name + Phone to book visit/test ride
6. Confirm date and time for showroom visit
7. End with showroom address and contact

When you have Name, Phone, preferred model, and visit date/time → output:
[SAVE_LEAD:{"name":"...","phone":"...","model":"...","visitDate":"..."}]

To send a bike image → output: [SEND_IMAGE:imageId]
Available images: chetak_3501, chetak_3502, chetak_3001, chetak_c25

To connect to sales team → output: [HANDOVER:reason]`;

async function main() {
    // 1. Create user
    const username = 'patni';
    const password = 'patni@123';

    const existing = await db.collection('wbp_users').where('username', '==', username).limit(1).get();
    let userId;

    if (!existing.empty) {
        userId = existing.docs[0].id;
        console.log('ℹ️ User exists:', userId);
    } else {
        const hash = await bcrypt.hash(password, 10);
        const ref = await db.collection('wbp_users').add({
            username,
            displayName: 'Patni Chetak',
            passwordHash: hash,
            role: 'user',
            active: true,
            createdAt: new Date().toISOString()
        });
        userId = ref.id;
        console.log('✅ User created:', username, '| uid:', userId);
    }

    // 2. Create AI bot
    const existingBot = await db.collection('wbp_ai_bots').where('userId', '==', userId).limit(1).get();

    const botData = {
        userId,
        name: 'Patni Chetak Assistant',
        active: true,
        geminiApiKey: GEMINI_KEY,
        systemPrompt: SYSTEM_PROMPT,
        contextText: CONTEXT,
        leadFields: ['name', 'phone', 'model', 'visitDate'],
        sheetUrl: '',
        notifyNumber: '9265389414',
        images: [
            { id: 'chetak_3501', name: 'Chetak 3501', tags: '3501, premium, best seller, touchscreen', url: '', filename: '' },
            { id: 'chetak_3502', name: 'Chetak 3502', tags: '3502, best value, TFT, navigation', url: '', filename: '' },
            { id: 'chetak_3001', name: 'Chetak 3001', tags: '3001, budget, LCD, affordable', url: '', filename: '' },
            { id: 'chetak_c25', name: 'Chetak C25', tags: 'C25, city, commuter, compact', url: '', filename: '' }
        ],
        updatedAt: new Date().toISOString()
    };

    if (!existingBot.empty) {
        await db.collection('wbp_ai_bots').doc(existingBot.docs[0].id).update({ ...botData, createdAt: existingBot.docs[0].data().createdAt });
        console.log('✅ AI bot updated');
    } else {
        await db.collection('wbp_ai_bots').add({ ...botData, createdAt: new Date().toISOString() });
        console.log('✅ AI bot created');
    }

    console.log('\n🎉 Done!');
    console.log('   Username: patni');
    console.log('   Password: patni@123');
    console.log('\n⚠️  Add Gemini API key: set PATNI_GEMINI_KEY in .env or edit seedPatni.js directly');
    console.log('⚠️  Upload bike images via AI Bot editor for image sending to work');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });