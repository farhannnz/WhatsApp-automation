const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');

// qrcode-terminal only needed in standalone mode
let qrcode = null;
try { qrcode = require('qrcode-terminal'); } catch { }

const SHEET_ID = '1PRSwurGgeagmxQFcBLzlXT7yCmRoKkaZXlKln9_ttY0';
const SHEET_TAB = 'Bot Leads';
const AMIT = '917719560422@c.us';
const PORT = process.env.PORT || 3000;

const BRANCHES = {
    '1': { name: 'BTF Chandigarh', address: 'SCO 1076-1077, Sector 22B, Chandigarh', phone: '+91 77195-60422' },
    '2': { name: 'BTF New Chandigarh', address: 'SCO 9 & 10, Clockton Street Market, PR-4 Road, Omaxe, New Chandigarh', phone: '+91 77195-60422' }
};
const GOALS = { '1': 'Fat Loss', '2': 'Fitness & Endurance', '3': 'Learn Boxing', '4': 'Strength & Conditioning', '5': 'Hyrox Training' };
const LEVELS = { '1': 'Beginner', '2': 'Intermediate', '3': 'Advanced' };
const SERVICES = { '1': 'Boxing + Fitness', '2': 'Strength + Fitness', '3': 'Trial Session', '4': 'Membership Details', '5': 'Speak to Team' };
const GENDERS = { '1': 'Male', '2': 'Female', '3': 'Other', 'm': 'Male', 'f': 'Female', 'o': 'Other', 'male': 'Male', 'female': 'Female', 'other': 'Other' };
const PRICE_KEYWORDS = ['price', 'prices', 'pricing', 'cost', 'costs', 'fee', 'fees', 'charge', 'charges', 'payment', 'pay', 'money', 'discount', 'offer', 'cheap', 'expensive', 'rate', 'rates', 'how much', 'kitna', 'kitne', 'paisa', 'paise', 'rupee', 'rupees'];

const auth = new google.auth.GoogleAuth({
    keyFile: './backend/fake-1582b-firebase-adminsdk-fbsvc-878526e19e.json',
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

async function saveLeadToSheet(lead) {
    try {
        const sheets = google.sheets({ version: 'v4', auth });
        const phone = lead.phone || '';
        const row = [
            new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            lead.name || '',
            phone,
            lead.branch || '',
            lead.service || '',
            lead.goal || '',
            lead.fitnessLevel || '',
            lead.gender || '',
            lead.timing || '',
            lead.handoverRequested ? 'Yes' : 'No',
            lead.handoverReason || '',
            lead.lastStage || '',
            lead.userId || ''
        ];

        const existing = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A:M` });
        const rows = existing.data.values || [];
        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][12] === lead.userId) { rowIndex = i + 1; break; }
        }

        if (rowIndex > 0) {
            await sheets.spreadsheets.values.update({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A${rowIndex}`, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
        } else {
            await sheets.spreadsheets.values.append({ spreadsheetId: SHEET_ID, range: `${SHEET_TAB}!A1`, valueInputOption: 'USER_ENTERED', requestBody: { values: [row] } });
        }
        console.log('✅ Sheet saved: ' + (lead.name || phone));
    } catch (err) {
        console.error('❌ Sheet save failed:', err.message);
    }
}

const leadsDB = new Map();
const conversationState = new Map();
const pausedChats = new Set();
let botStartTime = null;

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        executablePath: '/usr/bin/chromium-browser',
        protocolTimeout: 300000,
        timeout: 120000,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-default-apps',
            '--disable-sync',
            '--disable-translate',
            '--hide-scrollbars',
            '--metrics-recording-only',
            '--mute-audio',
            '--safebrowsing-disable-auto-update'
        ]
    }
});

client.on('qr', qr => { console.log('Scan QR:'); if (qrcode) qrcode.generate(qr, { small: true }); });

client.on('ready', () => {
    botStartTime = Date.now();
    console.log('✅ BTF Bot ready!');
    loadLeadsFromFile();
    startReminderChecker();
});

client.on('message', async message => {
    if (message.from === 'status@broadcast') return;
    if (message.from.endsWith('@g.us')) return;
    if (message.from.endsWith('@newsletter')) return;
    const msgTime = message.timestamp * 1000;
    if (botStartTime && msgTime < botStartTime) return;

    const userId = message.from;
    const msg = message.body.trim();

    if (msg === '..') {
        if (pausedChats.has(userId)) { pausedChats.delete(userId); console.log('▶️ Resumed: ' + userId); }
        else { pausedChats.add(userId); console.log('⏸️ Paused: ' + userId); }
        return;
    }
    if (pausedChats.has(userId)) return;

    await handleMessage(userId, msg, message);
});

async function handleMessage(userId, msg, message) {
    const state = conversationState.get(userId) || { stage: 'initial' };
    const lead = leadsDB.get(userId) || {};
    const lower = msg.toLowerCase().trim();

    // Handle pause/resume
    if (msg === '..') {
        if (pausedChats.has(userId)) { pausedChats.delete(userId); console.log('▶️ Resumed: ' + userId); }
        else { pausedChats.add(userId); console.log('⏸️ Paused: ' + userId); }
        return;
    }
    if (pausedChats.has(userId)) return;

    lead.lastMsgAt = Date.now();
    lead.lastStage = state.stage;
    lead.userId = lead.userId || userId;
    lead.phone = lead.phone || extractPhone(userId);
    leadsDB.set(userId, lead);

    if (['reset', 'restart', 'menu', 'start', 'hi', 'hello', 'hey', 'hii', 'helo', 'helo'].includes(lower)) {
        conversationState.delete(userId);
        return askBranch(userId, message);
    }

    if (PRICE_KEYWORDS.some(k => lower.includes(k))) {
        await message.reply('Our programs are customized based on your goals, experience level, and coaching requirements.\n\nAt BTF, we focus on results, structure, and real progression rather than just selling memberships. 💪\n\nOur team will share all details when they reach out to you!');
        return;
    }

    if (lower === 'yes' && lead.reminderSent && state.stage === 'initial') {
        const resume = lead.lastStage;
        if (resume && !['initial', 'completed'].includes(resume)) {
            conversationState.set(userId, { stage: resume, branchKey: lead.branchKey });
            await message.reply('Welcome back! 🙌 Let\'s continue...');
            return repromptStage(userId, resume, message);
        }
    }

    switch (state.stage) {
        case 'initial': return askBranch(userId, message);
        case 'selecting_branch': return handleBranch(userId, msg, message);
        case 'selecting_service': return handleService(userId, msg, message);
        case 'collecting_goal': return handleGoal(userId, msg, message);
        case 'collecting_level': return handleLevel(userId, msg, message);
        case 'collecting_gender': return handleGender(userId, msg, message);
        case 'collecting_phone': return handlePhone(userId, msg, message);
        case 'collecting_timing': return handleTiming(userId, msg, message);
        case 'collecting_contact': return handleTiming(userId, msg, message);
        default: return askBranch(userId, message);
    }
}

async function askBranch(userId, message) {
    await message.reply(`👋 *Welcome to BTF – Box To Fit* 🔥

Please select your nearest branch:

1️⃣ *BTF Chandigarh*
📍 SCO 1076-1077, Sector 22B, Chandigarh - 160022

2️⃣ *BTF New Chandigarh (Omaxe)*
📍 SCO 9 & 10, Clockton Street Market, PR-4 Road, Omaxe, New Chandigarh - 140901

Reply with 1 or 2 👇`);
    conversationState.set(userId, { stage: 'selecting_branch' });
}

async function handleBranch(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};
    if (!['1', '2'].includes(msg.trim())) {
        return message.reply('Please reply with *1* for Chandigarh or *2* for New Chandigarh.');
    }
    lead.branch = BRANCHES[msg.trim()].name;
    lead.branchKey = msg.trim();
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    await message.reply('✅ *' + lead.branch + '* selected!\n\n👋 *Welcome to BTF – Box To Fit* 🔥\n\nPlease choose an option:\n\n1️⃣ Boxing + Fitness\n2️⃣ Strength + Fitness\n3️⃣ Book a Trial Session\n4️⃣ Membership Details\n5️⃣ Speak to Team\n\nReply with a number 👇');
    conversationState.set(userId, { stage: 'selecting_service', branchKey: msg.trim() });
}

async function handleService(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};
    const choice = msg.trim();
    if (choice === '5') return triggerHandover(userId, 'User requested to speak to team', message);
    if (!SERVICES[choice]) return message.reply('Please reply with a number 1–5.');

    lead.service = SERVICES[choice];
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    if (choice === '4') {
        await message.reply('Our programs are customized based on your goals, experience level, and coaching requirements.\n\nAt BTF, we focus on results, structure, and real progression rather than just selling memberships. 💪\n\nShare your details and our team will reach out with the best plan!\n\nWhat is your main goal?\n\n1️⃣ Fat Loss\n2️⃣ Fitness & Endurance\n3️⃣ Learn Boxing\n4️⃣ Strength & Conditioning\n5️⃣ Hyrox Training');
    } else {
        await message.reply('What is your main goal?\n\n1️⃣ Fat Loss\n2️⃣ Fitness & Endurance\n3️⃣ Learn Boxing\n4️⃣ Strength & Conditioning\n5️⃣ Hyrox Training');
    }
    conversationState.set(userId, { stage: 'collecting_goal', branchKey: lead.branchKey });
}

async function handleGoal(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};
    const goal = GOALS[msg.trim()];
    if (!goal) return message.reply('Please reply with a number 1–5.');
    lead.goal = goal;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);
    await message.reply('What is your current training level?\n\n1️⃣ Beginner\n2️⃣ Intermediate\n3️⃣ Advanced');
    conversationState.set(userId, { stage: 'collecting_level', branchKey: lead.branchKey });
}

async function handleLevel(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};
    const level = LEVELS[msg.trim()];
    if (!level) return message.reply('Please reply with 1, 2, or 3.');
    lead.fitnessLevel = level;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);
    await message.reply('What is your gender?\n\n1️⃣ Male\n2️⃣ Female\n3️⃣ Other');
    conversationState.set(userId, { stage: 'collecting_gender', branchKey: lead.branchKey });
}

async function handleGender(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};
    const gender = GENDERS[msg.trim().toLowerCase()];
    if (!gender) return message.reply('Please reply with 1 (Male), 2 (Female), or 3 (Other).');
    lead.gender = gender;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);
    await message.reply('Perfect 👊\n\nPlease share your *phone number* so our team can reach you 📞');
    conversationState.set(userId, { stage: 'collecting_phone', branchKey: lead.branchKey });
}

async function handlePhone(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};
    const digits = msg.replace(/\D/g, '');
    let phone = '';
    if (digits.length === 10) phone = '+91' + digits;
    else if (digits.length === 12 && digits.startsWith('91')) phone = '+' + digits;
    else return message.reply('Please enter a valid 10-digit mobile number 👇');

    lead.phone = phone;
    leadsDB.set(userId, lead);
    saveLeadToSheet(lead);

    // Schedule 5-min fallback alert to Amit if user doesn't reply
    const timer = setTimeout(async () => {
        const currentLead = leadsDB.get(userId) || {};
        if (!currentLead.convoComplete) {
            currentLead.convoComplete = true;
            leadsDB.set(userId, currentLead);
            saveLeadsToFile();
            saveLeadToSheet(currentLead);
            notifyAmit(currentLead);
            console.log('⏰ 5-min fallback alert sent for: ' + userId);
        }
    }, 5 * 60 * 1000);
    // Store timer so we can cancel if they do reply
    if (!global.phoneTimers) global.phoneTimers = new Map();
    global.phoneTimers.set(userId, timer);

    const slots = generateSlots();
    await message.reply('🗓️ *Available Trial Slots*\n\n⚠️ _Trials available till 5 PM only — gym gets busy after that!_\n\n' + slots + '\nYou can also type your preferred date & time freely.\nExample: _Tomorrow 9 AM_ or _19 May, 4 PM_');
    conversationState.set(userId, { stage: 'collecting_timing', branchKey: lead.branchKey });
}

function generateSlots() {
    // IST time
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const currentHour = now.getHours() + now.getMinutes() / 60;

    // Slots: 3-hour chunks, trials not after 5 PM, not 6-8 PM
    const slots = [
        { label: '6:00 AM – 9:00 AM', start: 6 },
        { label: '9:00 AM – 12:00 PM', start: 9 },
        { label: '12:00 PM – 3:00 PM', start: 12 },
        { label: '3:00 PM – 5:00 PM', start: 15 }
        // 6-8 PM excluded, after 5 PM no trials
    ];

    const fmt = (d) => d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
    const fmtShort = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });

    let text = '';

    // Helper: get available slots for a day (pass offset 0=today, 1=tomorrow etc)
    function getDaySlots(dayOffset) {
        const d = new Date(now);
        d.setDate(d.getDate() + dayOffset);
        const isSunday = d.getDay() === 0;
        if (isSunday) return null; // gym closed

        const availableSlots = dayOffset === 0
            ? slots.filter(s => s.start > currentHour) // today: only future slots
            : slots; // other days: all slots

        return { date: d, slots: availableSlots };
    }

    // Show today + next 2 open days (skip Sundays)
    let shown = 0;
    let offset = 0;
    while (shown < 3 && offset < 10) {
        const day = getDaySlots(offset);
        if (day && day.slots.length > 0) {
            const label = offset === 0 ? 'Today (' + fmtShort(day.date) + ')' : offset === 1 ? 'Tomorrow (' + fmtShort(day.date) + ')' : fmt(day.date);
            text += '*' + label + ':*\n';
            day.slots.forEach(s => { text += '• ' + s.label + '\n'; });
            text += '\n';
            shown++;
        }
        offset++;
    }

    return text;
}

// ── Parse user timing text into a Date object (IST) ─────────
function parseTrialDateTime(text) {
    try {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const lower = text.toLowerCase().trim();

        // Extract hour from text e.g. "9 AM", "4 PM", "9:00 AM"
        const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
        if (!timeMatch) return null;

        let hour = parseInt(timeMatch[1]);
        const min = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3];
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;

        // Determine the date
        let date = new Date(now);
        if (lower.includes('tomorrow')) {
            date.setDate(date.getDate() + 1);
        } else {
            // Try to match "19 may", "may 19" etc
            const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
            for (let i = 0; i < months.length; i++) {
                if (lower.includes(months[i])) {
                    const dayMatch = lower.match(/(\d{1,2})\s*(?:st|nd|rd|th)?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*(\d{1,2})/);
                    if (dayMatch) {
                        const day = parseInt(dayMatch[1] || dayMatch[2]);
                        date.setMonth(i);
                        date.setDate(day);
                        // If date already passed this year, set next year
                        if (date < now) date.setFullYear(date.getFullYear() + 1);
                    }
                    break;
                }
            }
        }

        date.setHours(hour, min, 0, 0);
        return date;
    } catch (e) {
        return null;
    }
}

function scheduleTrialReminders(userId, trialDate) {
    if (!trialDate || isNaN(trialDate.getTime())) return;

    const now = Date.now();
    const trialTime = trialDate.getTime();

    // Reminder 1: 1 day before
    const oneDayBefore = trialTime - 24 * 60 * 60 * 1000;
    // Reminder 2: 2 hours before
    const twoHoursBefore = trialTime - 2 * 60 * 60 * 1000;

    if (!global.trialTimers) global.trialTimers = new Map();

    const timers = [];

    if (oneDayBefore > now) {
        const t1 = setTimeout(async () => {
            const lead = leadsDB.get(userId) || {};
            try {
                await client.sendMessage(userId,
                    '⏰ *Reminder from BTF!*\n\nYour trial session is *tomorrow* at ' + trialDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' 🥊\n\n📍 ' + (lead.branch || 'BTF') + '\n\nSee you there! 💪');
                console.log('📩 Day-before reminder sent to ' + userId);
            } catch (e) { console.error('Reminder 1 failed:', e.message); }
        }, oneDayBefore - now);
        timers.push(t1);
    }

    if (twoHoursBefore > now) {
        const t2 = setTimeout(async () => {
            const lead = leadsDB.get(userId) || {};
            try {
                await client.sendMessage(userId,
                    '🔔 *BTF Reminder!*\n\nYour trial session starts in *2 hours* at ' + trialDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' }) + ' 🥊\n\n📍 ' + (lead.branch || 'BTF') + '\n\nGet ready! 🔥');
                console.log('📩 2-hour reminder sent to ' + userId);
            } catch (e) { console.error('Reminder 2 failed:', e.message); }
        }, twoHoursBefore - now);
        timers.push(t2);
    }

    if (timers.length > 0) {
        global.trialTimers.set(userId, timers);
        console.log('⏰ Trial reminders scheduled for ' + userId + ' at ' + trialDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    }
}

async function handleTiming(userId, msg, message) {
    const lead = leadsDB.get(userId) || {};

    // Cancel 5-min fallback timer
    if (global.phoneTimers && global.phoneTimers.has(userId)) {
        clearTimeout(global.phoneTimers.get(userId));
        global.phoneTimers.delete(userId);
    }

    // Accept any input as timing
    lead.timing = msg.trim();
    lead.convoComplete = true;

    // Parse and schedule trial reminders
    const trialDate = parseTrialDateTime(msg.trim());
    if (trialDate) {
        lead.trialDateTime = trialDate.toISOString();
        scheduleTrialReminders(userId, trialDate);
    }

    leadsDB.set(userId, lead);
    saveLeadsToFile();
    saveLeadToSheet(lead);
    notifyAmit(lead);

    await message.reply('✅ *You\'re all set!*\n\nOur team will reach out to you shortly on *' + lead.phone + '* 📞\n\n📍 *' + lead.branch + '*\n\n_"The only bad workout is the one that didn\'t happen."_ 💪\n\nSee you at BTF! 🥊');
    conversationState.set(userId, { stage: 'completed' });
}

async function triggerHandover(userId, reason, message) {
    const lead = leadsDB.get(userId) || {};
    lead.handoverRequested = true;
    lead.handoverReason = reason;
    lead.convoComplete = true;
    leadsDB.set(userId, lead);
    saveLeadsToFile();
    saveLeadToSheet(lead);

    const log = '[' + new Date().toLocaleString('en-IN') + '] ' + userId + ' | ' + (lead.name || 'Unknown') + ' | ' + reason + '\n';
    fs.appendFileSync('handovers.log', log);

    const alert = '🚨 *BTF Lead - Team Request*\n\n👤 Name: ' + (lead.name || 'Not provided') + '\n📞 Phone: ' + (lead.phone || extractPhone(userId)) + '\n🏋️ Branch: ' + (lead.branch || '-') + '\n🎯 Goal: ' + (lead.goal || '-') + '\n💪 Level: ' + (lead.fitnessLevel || '-') + '\n❓ Reason: ' + reason + '\n🕐 ' + new Date().toLocaleString('en-IN');
    try { await client.sendMessage(AMIT, alert); } catch (e) { console.error('Amit alert failed:', e.message); }

    await message.reply('🤝 Our team will reach out to you shortly!\n\n📞 Or call directly: +91 77195-60422\n⏰ Mon–Sun: 9 AM – 9 PM');
    conversationState.set(userId, { stage: 'completed' });
}

async function notifyAmit(lead) {
    const msg = '✅ *New BTF Lead*\n\n👤 Name: ' + (lead.name || 'Not provided') + '\n📞 Phone: ' + (lead.phone || '-') + '\n🏋️ Branch: ' + (lead.branch || '-') + '\n🎯 Service: ' + (lead.service || '-') + '\n🏆 Goal: ' + (lead.goal || '-') + '\n💪 Level: ' + (lead.fitnessLevel || '-') + '\n👫 Gender: ' + (lead.gender || '-') + '\n⏰ Timing: ' + (lead.timing || '-') + '\n🕐 ' + new Date().toLocaleString('en-IN');
    try { await client.sendMessage(AMIT, msg); console.log('✅ Amit notified: ' + lead.phone); }
    catch (e) { console.error('Amit notify failed:', e.message); }
}

async function repromptStage(userId, stage, message) {
    switch (stage) {
        case 'selecting_branch': return message.reply('Please select branch:\n\n1️⃣ BTF Chandigarh\n2️⃣ BTF New Chandigarh');
        case 'selecting_service': return message.reply('Please choose:\n\n1️⃣ Boxing + Fitness\n2️⃣ Strength + Fitness\n3️⃣ Book a Trial Session\n4️⃣ Membership Details\n5️⃣ Speak to Team');
        case 'collecting_goal': return message.reply('What is your main goal?\n\n1️⃣ Fat Loss\n2️⃣ Fitness & Endurance\n3️⃣ Learn Boxing\n4️⃣ Strength & Conditioning\n5️⃣ Hyrox Training');
        case 'collecting_level': return message.reply('Your training level?\n\n1️⃣ Beginner\n2️⃣ Intermediate\n3️⃣ Advanced');
        case 'collecting_gender': return message.reply('Your gender?\n\n1️⃣ Male\n2️⃣ Female\n3️⃣ Other');
        case 'collecting_phone': return message.reply('Please share your phone number 📞');
        case 'collecting_timing': return message.reply('When do you prefer to train?\n\n1️⃣ Early Morning (6–9 AM)\n2️⃣ Mid Morning (9–12 PM)\n3️⃣ Afternoon (12–5 PM)\n4️⃣ Evening (5–9 PM)\n5️⃣ Flexible');
        default: return askBranch(userId, message);
    }
}

const REMINDER_DAYS = {
    1: 'Hey 👋\n\nJust checking in from BTF.\nYour future fit self is waiting… we just need the current version of you to reply 😄💪\n\nType *YES* to continue where you left off!',
    3: 'At this point we\'re not sure if:\nA) You got busy\nB) You joined another gym\nC) Or you\'re secretly waiting for Monday 😅\n\nEither way, BTF\'s here whenever you\'re ready to level up 🔥\n\nType *YES* to continue!',
    7: 'Quick reminder from BTF ✨\n\nGood health, confidence, strength, energy…\nthose things aren\'t expenses — they\'re investments.\n\nYour body will thank you later 💪\n\nType *YES* to pick up where you left off!',
    30: 'Hey 👋\n\nStill thinking about starting?\nNo pressure — BTF is always here to help you build a stronger, healthier lifestyle 🔥\n\nType *YES* to continue!'
};

function startReminderChecker() {
    setInterval(async () => {
        const now = Date.now();
        for (const [userId, lead] of leadsDB.entries()) {
            if (lead.convoComplete || !lead.lastMsgAt || !lead.lastStage) continue;
            if (['initial', 'completed'].includes(lead.lastStage)) continue;
            if (lead.lastMsgAt < botStartTime) continue;
            const daysSince = (now - lead.lastMsgAt) / (1000 * 60 * 60 * 24);
            const sent = lead.remindersSent || [];
            let dayKey = null;
            if (daysSince >= 30 && !sent.includes(30)) dayKey = 30;
            else if (daysSince >= 7 && !sent.includes(7)) dayKey = 7;
            else if (daysSince >= 3 && !sent.includes(3)) dayKey = 3;
            else if (daysSince >= 1 && !sent.includes(1)) dayKey = 1;
            if (!dayKey) continue;
            try {
                await client.sendMessage(userId, REMINDER_DAYS[dayKey]);
                lead.remindersSent = [...sent, dayKey];
                lead.reminderSent = true;
                leadsDB.set(userId, lead);
                saveLeadsToFile();
                conversationState.set(userId, { stage: 'initial' });
                console.log('📩 Reminder day ' + dayKey + ' sent to ' + userId);
            } catch (e) { console.error('❌ Reminder failed ' + userId + ':', e.message); }
        }
    }, 30 * 60 * 1000);
}

function extractPhone(userId) {
    if (!userId) return 'Unknown';
    if (userId.endsWith('@c.us')) {
        const match = userId.match(/^(\d+)@/);
        return match ? '+' + match[1] : userId;
    }
    if (userId.endsWith('@lid')) return 'ID:' + userId.replace('@lid', '');
    return userId;
}

function saveLeadsToFile() {
    fs.writeFileSync('leads.json', JSON.stringify(Array.from(leadsDB.entries()), null, 2));
}

function loadLeadsFromFile() {
    try {
        if (fs.existsSync('leads.json')) {
            const entries = JSON.parse(fs.readFileSync('leads.json', 'utf8'));
            entries.forEach(([k, v]) => leadsDB.set(k, v));
            console.log('✅ Loaded ' + leadsDB.size + ' leads');
        }
    } catch (e) { console.error('Load leads error:', e); }
}

// Only run standalone mode if this file is executed directly
if (require.main === module) {
    client.initialize();
    const app = express();
    app.use(express.json());
    app.get('/', (_req, res) => res.json({ status: 'running', leads: leadsDB.size, uptime: process.uptime() }));
    app.get('/leads', (_req, res) => res.json({ total: leadsDB.size, leads: Array.from(leadsDB.values()) }));
    app.listen(PORT, () => console.log('🚀 Server on port ' + PORT));
}

// Export for use inside backend — pass the wa client from manager
function initBTFBot(waClient) {
    loadLeadsFromFile();
    startReminderChecker();
    // Override the client reference so all sends use backend's client
    Object.assign(client, waClient);
    botStartTime = Date.now();
    console.log('✅ BTF Bot initialized via backend client');
}

module.exports = { handleMessage, initBTFBot, leadsDB, conversationState, pausedChats };
