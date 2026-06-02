const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');

// Google Sheets config
const SHEET_ID = '1PRSwurGgeagmxQFcBLzlXT7yCmRoKkaZXlKln9_ttY0';
const SHEET_TAB = 'Bot Leads';

const auth = new google.auth.GoogleAuth({
    keyFile: './fake-1582b-firebase-adminsdk-fbsvc-daa323e3c1.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function saveLeadToSheet(lead) {
    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const phone = lead.phone || extractPhone(lead.userId) || '';
        const row = [
            new Date().toLocaleString('en-IN'),
            lead.name || '',
            phone,
            lead.branch || '',
            lead.age || '',
            lead.gender || '',
            lead.goal || '',
            lead.fitnessLevel || '',
            lead.preferredTiming || '',
            lead.bookedSlot || '',
            lead.bookingStatus || '',
            lead.handoverRequested ? 'Yes' : 'No',
            lead.handoverReason || ''
        ];

        // Check if this phone already exists in sheet — update that row, else append
        const existing = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A:C`
        });

        const rows = existing.data.values || [];
        let existingRowIndex = -1;
        for (let i = 1; i < rows.length; i++) { // skip header row
            if (rows[i][2] === phone) { existingRowIndex = i + 1; break; } // +1 for 1-based index
        }

        if (existingRowIndex > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SHEET_ID,
                range: `${SHEET_TAB}!A${existingRowIndex}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [row] }
            });
        } else {
            await sheets.spreadsheets.values.append({
                spreadsheetId: SHEET_ID,
                range: `${SHEET_TAB}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [row] }
            });
        }

        console.log(`✅ Lead saved to sheet: ${lead.name || phone}`);
    } catch (err) {
        console.error('❌ Sheet save failed:', err.message);
    }
}

// Branch addresses
const BRANCHES = {
    '1': {
        name: 'BTF Chandigarh',
        address: 'SCO 1076-1077, Sector 22B, Sector 22, Chandigarh, 160022',
        phone: '+91 77195-60422'
    },
    '2': {
        name: 'BTF New Chandigarh',
        address: 'SCO 9 & 10, Clockton Street Market, PR-4 Road, Omaxe, New Chandigarh, Punjab',
        phone: '+91 77195-60422'
    }
};

const PORT = process.env.PORT || 3000;
const leadsDB = new Map();
const conversationState = new Map();
const followUpTimers = new Map();

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        protocolTimeout: 120000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run'
        ]
    }
});

client.on('qr', qr => {
    console.log('Scan this QR code to login:');
    qrcode.generate(qr, { small: true });
});

let botStartTime = null;

client.on('ready', () => {
    botStartTime = Date.now();
    console.log('✅ BTF WhatsApp Bot is ready!');
    loadLeadsFromFile();
    startReminderChecker();
});

client.on('message', async message => {
    if (message.from === 'status@broadcast') return;

    // Ignore group messages
    if (message.from.endsWith('@g.us')) return;

    // Ignore messages that came before bot started
    const msgTime = message.timestamp * 1000; // WhatsApp gives seconds, convert to ms
    if (botStartTime && msgTime < botStartTime) return;

    const userId = message.from;
    const msg = message.body.trim();

    await handleMessage(userId, msg, message);
});

// Main message handler
async function handleMessage(userId, msg, message) {
    const state = conversationState.get(userId) || { stage: 'initial' };
    const lead = leadsDB.get(userId) || {};
    const lower = msg.toLowerCase().trim();

    // Track last message time on every interaction
    updateLeadTracking(userId, state.stage);

    // Only start a NEW conversation if user sends a greeting
    // If they're already in a flow, continue regardless
    const isNewUser = state.stage === 'initial';
    if (isNewUser) {
        // Any message from new user triggers the bot
        // (greeting check removed)
    }

    // Handle YES to resume a dropped conversation
    if (lower === 'yes' && lead.reminderSent && state.stage === 'initial') {
        const resumeStage = lead.lastStage;
        if (resumeStage && resumeStage !== 'initial' && resumeStage !== 'completed') {
            conversationState.set(userId, { stage: resumeStage, branchKey: lead.branchKey, interest: lead.interest });
            await message.reply(`Welcome back! 🙌 Let's pick up where we left off...`);
            // Re-prompt the stage they were on
            await repromptStage(userId, resumeStage, message);
            return;
        }
    }

    // Global commands — work from any stage
    if (lower === 'reset' || lower === 'restart' || lower === 'menu') {
        conversationState.delete(userId);
        await handleInitialContact(userId, msg, message);
        return;
    }
    if (lower === 'help' || lower === 'start') {
        conversationState.set(userId, { stage: 'initial' });
        await handleInitialContact(userId, msg, message);
        return;
    }
    if (lower === 'address' || lower === 'location' || lower === 'where') {
        const branch = lead.branchKey ? BRANCHES[lead.branchKey] : null;
        if (branch) {
            await message.reply(`📍 *${branch.name}*\n\n${branch.address}\n\n⏰ Mon-Sat: 6 AM - 9 PM\n📞 ${branch.phone}`);
        } else {
            await message.reply(`📍 *BTF Locations*\n\n*1️⃣ BTF Chandigarh*\nSCO 1076-1077, Sector 22B, Sector 22, Chandigarh, 160022\n📞 +91 77195-60422\n\n*2️⃣ BTF New Chandigarh*\nSCO 9 & 10, Clockton Street Market\nPR-4 Road, Omaxe, New Chandigarh, Punjab\n📞 +91 77195-60422\n\n⏰ Both branches: Mon-Sat, 6 AM - 9 PM`);
        }
        return;
    }
    if (lower === 'team' || lower === 'staff' || lower === 'human') {
        await triggerHumanHandover(userId, 'User requested staff', message);
        return;
    }

    // Check for human handover triggers
    if (shouldHandoverToHuman(msg, lead)) {
        await triggerHumanHandover(userId, msg, message);
        return;
    }

    // Route based on conversation stage
    switch (state.stage) {
        case 'initial':
            await handleInitialContact(userId, msg, message);
            break;
        case 'selecting_branch':
            await handleBranchSelection(userId, msg, message);
            break;
        case 'awaiting_choice':
            await handleServiceChoice(userId, msg, message);
            break;
        case 'awaiting_yes':
            await handleAwaitingYes(userId, msg, message);
            break;
        case 'collecting_name':
            await collectName(userId, msg, message);
            break;
        case 'collecting_phone':
            await collectPhone(userId, msg, message);
            break;
        case 'collecting_age':
            await collectAge(userId, msg, message);
            break;
        case 'collecting_gender':
            await collectGender(userId, msg, message);
            break;
        case 'collecting_goals':
            await collectGoals(userId, msg, message);
            break;
        case 'collecting_fitness_level':
            await collectFitnessLevel(userId, msg, message);
            break;
        case 'collecting_timing':
            await collectTiming(userId, msg, message);
            break;
        case 'offering_trial':
            await handleTrialOffer(userId, msg, message);
            break;
        case 'booking_slot':
            await handleSlotBooking(userId, msg, message);
            break;
        default:
            await handleInitialContact(userId, msg, message);
    }
}

// Initial contact — ask branch first
async function handleInitialContact(userId, _msg, message) {
    await message.reply(`🥊 *Welcome to BTF - Box To Fit!*

Founded by Amit, a New Zealand-based athlete and professional boxer, BTF is where science meets strength.

*Please select your nearest BTF location:*

1️⃣ BTF Chandigarh
2️⃣ BTF New Chandigarh (Omaxe)

Reply with 1 or 2 👇`);

    conversationState.set(userId, { stage: 'selecting_branch', timestamp: Date.now() });
    scheduleFollowUp(userId, '1hour');
}

// Handle branch selection
async function handleBranchSelection(userId, msg, message) {
    const choice = msg.trim();

    if (!['1', '2'].includes(choice)) {
        await message.reply(`Please reply with *1* for Chandigarh or *2* for New Chandigarh.`);
        return;
    }

    const branch = BRANCHES[choice];
    const lead = leadsDB.get(userId) || {};
    lead.branch = branch.name;
    lead.branchKey = choice;
    lead.userId = userId;
    lead.phone = extractPhone(userId);
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    await message.reply(`✅ *${branch.name}* selected!

*What brings you here today?*

1️⃣ Weight Loss & Fat Burning
2️⃣ Boxing Training (Fitness/Competitive)
3️⃣ Strength & CrossFit
4️⃣ Book a FREE Trial Class
5️⃣ Membership Prices
6️⃣ Talk to Our Team

Reply with a number (1-6) 👇`);

    conversationState.set(userId, { stage: 'awaiting_choice', branchKey: choice, timestamp: Date.now() });
}

// Handle service choice
async function handleServiceChoice(userId, msg, message) {
    const choice = msg.trim();

    switch (choice) {
        case '1':
            await message.reply(`🔥 *Weight Loss & Fat Burning*

Our science-based approach combines:
✅ Boxing (burns 800+ calories/session)
✅ HIIT training
✅ Strength conditioning
✅ Personalized nutrition guidance

*"Sweat is your fat crying"* 💪

Ready to start? Let's book your FREE assessment!

Type *YES* to continue or *MENU* to go back.`);
            conversationState.set(userId, { ...conversationState.get(userId), stage: 'awaiting_yes', interest: 'weight_loss' });
            break;

        case '2':
            await message.reply(`🥊 *Boxing Training*

Choose your path:
A) Fitness Boxing (weight loss, cardio, technique)
B) Competitive Boxing (athlete training, sparring)

*"Life is like a boxing match. Defeat is declared not when you fall but when you refuse to stand again."*

Type *YES* to continue or *MENU* to go back.`);
            conversationState.set(userId, { ...conversationState.get(userId), stage: 'awaiting_yes', interest: 'boxing' });
            break;

        case '3':
            await message.reply(`💪 *Strength & CrossFit*

Build real functional strength with:
✅ Olympic lifts
✅ CrossFit WODs
✅ Powerlifting fundamentals
✅ Athletic conditioning

Perfect for all levels!

Type *YES* to book your trial or *MENU* to go back.`);
            conversationState.set(userId, { ...conversationState.get(userId), stage: 'awaiting_yes', interest: 'strength' });
            break;

        case '4':
        case 'trial':
            await message.reply(`🎯 *FREE Trial Class*

Experience BTF firsthand! Your trial includes:
✅ Fitness assessment
✅ Full class experience
✅ Technique coaching
✅ Personalized recommendations

🔥 *Excited to start your fitness journey with BTF!*

What's your name? 👇`);
            conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_name', interest: 'trial' });
            break;

        case '5':
            await message.reply(`💳 *BTF Membership Plans*

We offer flexible options to fit your lifestyle.

For detailed pricing and custom plans, our team will reach out to you personally.

But first — let's get you started with a *FREE Trial Class* so you can experience BTF yourself! 🥊

Type *YES* to book your free trial 👇`);
            conversationState.set(userId, { ...conversationState.get(userId), stage: 'awaiting_yes', interest: 'membership' });
            break;

        case '6':
        case 'connect':
            await triggerHumanHandover(userId, 'User requested to talk to team', message);
            break;

        default:
            await message.reply(`I didn't catch that. Please reply with a number 1-6, or type *MENU* for options.`);
    }
}

// Handle YES confirmation before collecting name
async function handleAwaitingYes(userId, msg, message) {
    const lower = msg.toLowerCase();
    if (lower === 'yes' || lower === 'y' || lower === 'haan' || lower === 'ha') {
        await message.reply(`🔥 *Excited to start your fitness journey with BTF!*

What's your name? 👇`);
        conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_name' });
    } else if (lower === 'menu') {
        await handleInitialContact(userId, msg, message);
    } else {
        await message.reply(`Type *YES* to continue or *MENU* to go back to options.`);
    }
}

// Collect name
async function collectName(userId, msg, message) {
    if (msg.toLowerCase() === 'menu') {
        await handleInitialContact(userId, msg, message);
        return;
    }

    const lead = leadsDB.get(userId) || {};
    lead.name = msg;
    lead.userId = userId;
    lead.timestamp = Date.now();
    leadsDB.set(userId, lead);

    await message.reply(`Awesome, ${msg}! 💪

Please share your *phone number* so we can reach you 📞`);

    conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_phone' });
}

// Collect phone
async function collectPhone(userId, msg, message) {
    const digits = msg.replace(/\D/g, '');
    let phone = '';

    if (digits.length === 10) {
        phone = '+91' + digits;
    } else if (digits.length === 12 && digits.startsWith('91')) {
        phone = '+' + digits;
    } else {
        await message.reply(`Please enter a valid 10-digit mobile number 👇`);
        return;
    }

    const lead = leadsDB.get(userId) || {};
    lead.phone = phone;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    await message.reply(`Got it! How old are you?`);

    conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_age' });
}

// Collect age
async function collectAge(userId, msg, message) {
    const age = parseInt(msg);

    if (isNaN(age) || age < 10 || age > 100) {
        await message.reply(`Please enter a valid age (10-100).`);
        return;
    }

    const lead = leadsDB.get(userId);
    lead.age = age;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    await message.reply(`Got it! What's your gender?

M - Male
F - Female
O - Other`);

    conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_gender' });
}

// Collect gender
async function collectGender(userId, msg, message) {
    const gender = msg.toUpperCase();

    if (!['M', 'F', 'O', 'MALE', 'FEMALE', 'OTHER'].includes(gender)) {
        await message.reply(`Please reply with M, F, or O.`);
        return;
    }

    const lead = leadsDB.get(userId);
    lead.gender = gender;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    await message.reply(`Perfect! What's your main fitness goal?

1️⃣ Lose weight / Fat loss
2️⃣ Build muscle / Strength
3️⃣ Learn boxing technique
4️⃣ Improve fitness / Stamina
5️⃣ Competitive boxing training
6️⃣ General health & wellness`);

    conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_goals' });
}

// Collect goals
async function collectGoals(userId, msg, message) {
    const goalMap = {
        '1': 'Weight Loss',
        '2': 'Build Muscle',
        '3': 'Boxing Technique',
        '4': 'Fitness/Stamina',
        '5': 'Competitive Boxing',
        '6': 'General Wellness'
    };

    const goal = goalMap[msg.trim()] || msg;

    const lead = leadsDB.get(userId);
    lead.goal = goal;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    await message.reply(`Awesome! What's your current fitness level?

1️⃣ Beginner (just starting out)
2️⃣ Intermediate (some experience)
3️⃣ Advanced (regular training)`);

    conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_fitness_level' });
}

// Collect fitness level
async function collectFitnessLevel(userId, msg, message) {
    const levelMap = {
        '1': 'Beginner',
        '2': 'Intermediate',
        '3': 'Advanced'
    };

    const level = levelMap[msg.trim()] || msg;

    const lead = leadsDB.get(userId);
    lead.fitnessLevel = level;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    await message.reply(`Great! When do you prefer to train?

1️⃣ Early Morning (6-9 AM)
2️⃣ Mid Morning (9-12 PM)
3️⃣ Afternoon (12-5 PM)
4️⃣ Evening (5-9 PM)
5️⃣ Flexible`);

    conversationState.set(userId, { ...conversationState.get(userId), stage: 'collecting_timing' });
}

// Collect timing preference
async function collectTiming(userId, msg, message) {
    const timingMap = {
        '1': 'Early Morning (6-9 AM)',
        '2': 'Mid Morning (9-12 PM)',
        '3': 'Afternoon (12-5 PM)',
        '4': 'Evening (5-9 PM)',
        '5': 'Flexible'
    };

    const timing = timingMap[msg.trim()] || msg;

    const lead = leadsDB.get(userId);
    lead.preferredTiming = timing;
    lead.qualified = true;
    leadsDB.set(userId, lead);
    saveLeadsToFile();
    saveLeadToSheet(lead);

    await message.reply(`Perfect, ${lead.name}! 🎯

Based on your profile:
👤 ${lead.age} years, ${lead.gender}
🎯 Goal: ${lead.goal}
💪 Level: ${lead.fitnessLevel}
⏰ Timing: ${timing}

*Let's get you started with a FREE trial session!*

Would you like to book your trial class?

Type *YES* to see available slots
Type *INFO* for more details about BTF`);

    conversationState.set(userId, { ...conversationState.get(userId), stage: 'offering_trial' });
}

// Generate available trial slots (only before 5 PM, trials not after 5 PM)
function generateAvailableSlots() {
    const now = new Date();
    const currentHour = now.getHours();

    const allSlots = ['7:00 AM', '9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM'];
    const slotHours = [7, 9, 11, 13, 15]; // 24-hour format

    let slotsText = '';

    // TODAY — only show slots that are still available (current time + 1 hour buffer, and before 5 PM)
    const todaySlots = allSlots.filter((slot, idx) => {
        const slotHour = slotHours[idx];
        return slotHour > currentHour && slotHour < 17; // before 5 PM
    });

    if (todaySlots.length > 0) {
        slotsText += `*Today (${now.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}):*\n`;
        todaySlots.forEach(slot => slotsText += `• ${slot}\n`);
        slotsText += '\n';
    }

    // TOMORROW
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    slotsText += `*Tomorrow (${tomorrow.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}):*\n`;
    allSlots.forEach(slot => slotsText += `• ${slot}\n`);
    slotsText += '\n';

    // DAY AFTER TOMORROW
    const dayAfter = new Date(now);
    dayAfter.setDate(dayAfter.getDate() + 2);
    slotsText += `*${dayAfter.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' })}:*\n`;
    allSlots.forEach(slot => slotsText += `• ${slot}\n`);

    return slotsText;
}

// Handle trial offer
async function handleTrialOffer(userId, msg, message) {
    const response = msg.toLowerCase();
    const lead = leadsDB.get(userId) || {};
    const branch = BRANCHES[lead.branchKey] || BRANCHES['2'];

    if (response.includes('yes') || response.includes('book')) {
        const slots = generateAvailableSlots();
        await message.reply(`🗓️ *Available Trial Slots*

⚠️ _Trial sessions are available till 5:00 PM only. Our gym gets quite busy after that!_

${slots}
Reply with your preferred date & time
Example: "Tomorrow 9 AM" or "Today 3 PM"`);

        conversationState.set(userId, { ...conversationState.get(userId), stage: 'booking_slot' });
    } else if (response.includes('info')) {
        await message.reply(`ℹ️ *About BTF - Box To Fit*

📍 *${branch.name}*
${branch.address}

⏰ *Timings:* Mon-Sat, 6 AM - 9 PM

🥊 *What We Offer:*
• Boxing (Fitness & Competitive)
• Strength Training & CrossFit
• HIIT & Fat Loss Programs
• Personal Training
• Nutrition Guidance

💪 *Why BTF?*
"Exercise is Medicine to the Body"
- International standards
- Expert coaching by Amit (NZ-based athlete)
- Science-based training
- Premium equipment

Ready to book? Type *YES* 🔥`);
    } else {
        await message.reply(`No worries! Take your time.

Type *YES* when ready to book
Type *MENU* to explore other options
Type *TEAM* to speak with our staff`);
    }
}

// Handle slot booking
async function handleSlotBooking(userId, msg, message) {
    const lead = leadsDB.get(userId);
    const branch = BRANCHES[lead.branchKey] || BRANCHES['2'];
    lead.bookedSlot = msg;
    lead.bookingStatus = 'confirmed';
    lead.convoComplete = true;
    leadsDB.set(userId, lead);
    saveLeadsToFile();
    saveLeadToSheet(lead);
    notifyAmit(lead, 'trial_booked');

    await message.reply(`✅ *Trial Class Confirmed!*

📅 ${msg}
📍 ${branch.address}

*What to bring:*
✅ Comfortable workout clothes
✅ Water bottle
✅ Towel
✅ Athletic shoes

*What to expect:*
• Fitness assessment (10 min)
• Warm-up & technique intro (15 min)
• Full class experience (30 min)
• Cool down & Q&A (5 min)

📞 Questions? Call: ${branch.phone}

*"Push harder than yesterday if you want a different tomorrow."* 💪

See you soon, ${lead.name}! 🥊`);

    conversationState.set(userId, { stage: 'completed' });
    clearFollowUp(userId);
}

// Human handover logic
function shouldHandoverToHuman(msg, lead) {
    const handoverKeywords = [
        'price', 'cost', 'payment', 'discount', 'offer',
        'athlete', 'professional', 'compete', 'competition',
        'complaint', 'issue', 'problem', 'manager',
        'bulk', 'corporate', 'group',
        'vip', 'premium', 'personal training'
    ];

    return handoverKeywords.some(keyword => msg.toLowerCase().includes(keyword));
}

async function triggerHumanHandover(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};
    lead.handoverRequested = true;
    lead.handoverReason = msg;
    lead.handoverTime = new Date().toISOString();
    lead.convoComplete = true;
    leadsDB.set(userId, lead);
    saveLeadsToFile();
    saveLeadToSheet(lead);

    // Log to file
    const log = `[${new Date().toLocaleString('en-IN')}] ${userId} | Name: ${lead.name || 'Unknown'} | Reason: ${msg}\n`;
    fs.appendFileSync('handovers.log', log);

    // Extract client's phone number
    const clientPhone = lead.phone || extractPhone(userId);

    // Build alert message for Amit (77195-60422)
    const alertMsg = `🚨 *New Lead Alert - BTF*

👤 *Name:* ${lead.name || 'Not provided'}
📞 *Phone:* ${clientPhone}
🏋️ *Branch:* ${lead.branch || 'Not selected'}
🎯 *Goal:* ${lead.goal || 'Not provided'}
💪 *Level:* ${lead.fitnessLevel || 'Not provided'}
⏰ *Timing:* ${lead.preferredTiming || 'Not provided'}
❓ *Reason:* ${msg}
🕐 *Time:* ${new Date().toLocaleString('en-IN')}`;

    // Send alert to Amit's number
    const amitNumber = '917719560422@c.us'; // 91 + number without +
    try {
        await client.sendMessage(amitNumber, alertMsg);
        console.log(`✅ Alert sent to Amit for lead: ${clientPhone}`);
    } catch (err) {
        console.error(`❌ Failed to send alert to Amit:`, err.message);
    }

    // Reply to client
    await message.reply(`🤝 *Our team will reach out to you shortly!*

📞 Or call us directly: +91 77195-60422
⏰ Mon - Sun: 24 Hours

We're here to help! 💪`);

    console.log(`🚨 HUMAN HANDOVER: ${userId} | ${lead.name || 'Unknown'} | ${msg}`);
}

// Notify Amit on WhatsApp
async function notifyAmit(lead, type) {
    const AMIT = '917719560422@c.us';
    const phone = lead.phone || extractPhone(lead.userId || lead.userId);
    const time = new Date().toLocaleString('en-IN');

    let msg = '';

    if (type === 'new_lead') {
        msg = `🎯 *New Lead Generated - BTF*

👤 *Name:* ${lead.name || '—'}
📞 *Phone:* ${phone}
🏋️ *Branch:* ${lead.branch || '—'}
🎯 *Goal:* ${lead.goal || '—'}
💪 *Level:* ${lead.fitnessLevel || '—'}
⏰ *Preferred Timing:* ${lead.preferredTiming || '—'}
👫 *Age/Gender:* ${lead.age || '—'} / ${lead.gender || '—'}
🕐 *Time:* ${time}`;
    } else if (type === 'trial_booked') {
        msg = `✅ *Trial Class Booked - BTF*

👤 *Name:* ${lead.name || '—'}
📞 *Phone:* ${phone}
🏋️ *Branch:* ${lead.branch || '—'}
📅 *Slot:* ${lead.bookedSlot || '—'}
🎯 *Goal:* ${lead.goal || '—'}
💪 *Level:* ${lead.fitnessLevel || '—'}
🕐 *Time:* ${time}`;
    }

    try {
        await client.sendMessage(AMIT, msg);
        console.log(`✅ Amit notified: ${type} | ${phone}`);
    } catch (err) {
        console.error(`❌ Failed to notify Amit:`, err.message);
    }
}
function extractPhone(userId) {
    if (!userId) return 'Unknown';
    // Standard format: 919876543210@c.us
    if (userId.endsWith('@c.us')) {
        const match = userId.match(/^(\d+)@/);
        return match ? '+' + match[1] : userId;
    }
    // Linked device format: @lid — no real number, return cleaned ID
    if (userId.endsWith('@lid')) {
        return `ID:${userId.replace('@lid', '')}`;
    }
    return userId;
}

// Follow-up system
// Follow-up system disabled — bot only responds, never initiates
function scheduleFollowUp(_userId, _type) { /* disabled */ }
function clearFollowUp(userId) {
    const timer = followUpTimers.get(userId);
    if (timer) { clearTimeout(timer); followUpTimers.delete(userId); }
}
function scheduleFollowUps() { /* disabled */ }

// ── Lead tracking ────────────────────────────────────────
function updateLeadTracking(userId, currentStage) {
    const lead = leadsDB.get(userId) || {};
    lead.lastMsgAt = Date.now();
    lead.lastStage = currentStage;
    if (!lead.convoComplete) lead.convoComplete = false;
    leadsDB.set(userId, lead);
}

// Re-prompt user at the stage they dropped off
async function repromptStage(userId, stage, message) {
    switch (stage) {
        case 'selecting_branch':
            await message.reply(`Which BTF location were you interested in?\n\n1️⃣ BTF Chandigarh\n2️⃣ BTF New Chandigarh (Omaxe)\n\nReply 1 or 2 👇`);
            break;
        case 'awaiting_choice':
            await message.reply(`What were you looking for?\n\n1️⃣ Weight Loss & Fat Burning\n2️⃣ Boxing Training\n3️⃣ Strength & CrossFit\n4️⃣ Book a FREE Trial Class\n5️⃣ Membership Prices\n6️⃣ Talk to Our Team\n\nReply 1-6 👇`);
            break;
        case 'awaiting_yes':
            await message.reply(`Ready to continue? Type *YES* to proceed 👇`);
            break;
        case 'collecting_name':
            await message.reply(`What's your name? 👇`);
            break;
        case 'collecting_phone':
            await message.reply(`Please share your phone number 📞`);
            break;
        case 'collecting_age':
            await message.reply(`How old are you? 👇`);
            break;
        case 'collecting_gender':
            await message.reply(`What's your gender?\n\nM - Male\nF - Female\nO - Other`);
            break;
        case 'collecting_goals':
            await message.reply(`What's your main fitness goal?\n\n1️⃣ Lose weight\n2️⃣ Build muscle\n3️⃣ Boxing technique\n4️⃣ Fitness/Stamina\n5️⃣ Competitive boxing\n6️⃣ General wellness`);
            break;
        case 'collecting_fitness_level':
            await message.reply(`What's your fitness level?\n\n1️⃣ Beginner\n2️⃣ Intermediate\n3️⃣ Advanced`);
            break;
        case 'collecting_timing':
            await message.reply(`When do you prefer to train?\n\n1️⃣ Early Morning (6-9 AM)\n2️⃣ Mid Morning (9-12 PM)\n3️⃣ Afternoon (12-5 PM)\n4️⃣ Evening (5-9 PM)\n5️⃣ Flexible`);
            break;
        case 'offering_trial':
            await message.reply(`Ready to book your FREE trial? Type *YES* to see available slots 👇`);
            break;
        case 'booking_slot':
            await message.reply(`Which slot works for you? Reply with date & time\nExample: "Tomorrow 9 AM"`);
            break;
        default:
            await handleInitialContact(userId, '', message);
    }
}

// ── Reminder checker ──────────────────────────────────────
const REMINDER_DAYS = {
    1: `Hey 👋\n\nJust checking in from BTF.\nYour future fit self is waiting… we just need the current version of you to reply 😄💪\n\nType *YES* to continue where you left off!`,
    3: `At this point we're not sure if:\nA) You got busy\nB) You joined another gym\nC) Or you're secretly waiting for Monday 😅\n\nEither way, BTF's here whenever you're ready to level up 🔥\n\nType *YES* to continue!`,
    7: `Quick reminder from BTF ✨\n\nGood health, confidence, strength, energy…\nthose things aren't expenses — they're investments.\n\nYour body will thank you later 💪\n\nType *YES* to pick up where you left off!`,
    30: `Hey 👋\n\nStill thinking about starting?\nNo pressure from us — just a reminder that BTF is always here to help you build a stronger, healthier lifestyle 🔥\n\nAnd who knows… this message might be the sign to finally begin 😉\n\nType *YES* to continue!`
};

function startReminderChecker() {
    // Check every 30 minutes
    setInterval(async () => {
        const now = Date.now();
        for (const [userId, lead] of leadsDB.entries()) {
            // Skip completed convos, handovers, or no lastMsgAt
            if (lead.convoComplete || !lead.lastMsgAt || !lead.lastStage) continue;
            if (lead.lastStage === 'initial' || lead.lastStage === 'completed') continue;

            const daysSince = (now - lead.lastMsgAt) / (1000 * 60 * 60 * 24);
            const remindersSent = lead.remindersSent || [];

            let dayKey = null;
            if (daysSince >= 30 && !remindersSent.includes(30)) dayKey = 30;
            else if (daysSince >= 7 && !remindersSent.includes(7)) dayKey = 7;
            else if (daysSince >= 3 && !remindersSent.includes(3)) dayKey = 3;
            else if (daysSince >= 1 && !remindersSent.includes(1)) dayKey = 1;

            if (!dayKey) continue;

            try {
                await client.sendMessage(userId, REMINDER_DAYS[dayKey]);
                lead.remindersSent = [...remindersSent, dayKey];
                lead.reminderSent = true;
                leadsDB.set(userId, lead);
                saveLeadsToFile();
                // Reset their convo state so YES can resume
                conversationState.set(userId, { stage: 'initial' });
                console.log(`📩 Reminder DAY ${dayKey} sent to ${userId}`);
            } catch (err) {
                console.error(`❌ Reminder failed for ${userId}:`, err.message);
            }
        }
    }, 30 * 60 * 1000); // every 30 minutes
}

// Persistence
function saveLeadsToFile() {
    const data = JSON.stringify(Array.from(leadsDB.entries()), null, 2);
    fs.writeFileSync('leads.json', data);
}

function loadLeadsFromFile() {
    try {
        if (fs.existsSync('leads.json')) {
            const data = fs.readFileSync('leads.json', 'utf8');
            const entries = JSON.parse(data);
            entries.forEach(([key, value]) => leadsDB.set(key, value));
            console.log(`✅ Loaded ${leadsDB.size} leads from database`);
        }
    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

// Initialize WhatsApp client
client.initialize();

// Express server for health checks
const app = express();

app.get('/', (_req, res) => {
    res.json({
        status: 'running',
        bot: 'BTF WhatsApp Automation',
        leads: leadsDB.size,
        uptime: process.uptime()
    });
});

app.get('/leads', (_req, res) => {
    const leads = Array.from(leadsDB.values());
    res.json({ total: leads.length, leads });
});

app.get('/stats', (_req, res) => {
    const leads = Array.from(leadsDB.values());
    const stats = {
        total: leads.length,
        qualified: leads.filter(l => l.qualified).length,
        booked: leads.filter(l => l.bookingStatus === 'confirmed').length,
        handovers: leads.filter(l => l.handoverRequested).length,
        byGoal: leads.reduce((acc, l) => {
            if (l.goal) acc[l.goal] = (acc[l.goal] || 0) + 1;
            return acc;
        }, {}),
        byLevel: leads.reduce((acc, l) => {
            if (l.fitnessLevel) acc[l.fitnessLevel] = (acc[l.fitnessLevel] || 0) + 1;
            return acc;
        }, {})
    };
    res.json(stats);
});

app.get('/handovers', (_req, res) => {
    try {
        const log = fs.existsSync('handovers.log') ? fs.readFileSync('handovers.log', 'utf8') : 'No handovers yet.';
        res.type('text').send(log);
    } catch {
        res.status(500).send('Error reading handovers log.');
    }
});

app.listen(PORT, () => {
    console.log(`🚀 BTF Bot server running on port ${PORT}`);
});