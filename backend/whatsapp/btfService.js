/**
 * BTF-specific features — exact port of index.js logic
 * Activated only when flow.btfConfig === true
 *
 * Features:
 * - ".." pauses/resumes bot for a contact
 * - Price keywords auto-reply
 * - Google Sheet upsert (Bot Leads tab, same as index.js)
 * - Notify Amit on lead completion
 * - Trial reminders (1 day before, 2 hours before)
 * - Follow-up reminders (1/3/7/30 days for incomplete convos)
 */

const { google } = require('googleapis');
const path = require('path');

const AMIT = '917719560422@c.us';
const SHEET_ID = '1PRSwurGgeagmxQFcBLzlXT7yCmRoKkaZXlKln9_ttY0';
const SHEET_TAB = 'Bot Leads';

const PRICE_KEYWORDS = [
    'price', 'prices', 'pricing', 'cost', 'costs', 'fee', 'fees',
    'charge', 'charges', 'payment', 'pay', 'money', 'discount',
    'offer', 'cheap', 'expensive', 'rate', 'rates', 'how much',
    'kitna', 'kitne', 'paisa', 'paise', 'rupee', 'rupees'
];

const REMINDER_MSGS = {
    1: `Hey 👋\n\nJust checking in from BTF.\nYour future fit self is waiting… we just need the current version of you to reply 😄💪\n\nType *hi* to continue where you left off!`,
    3: `At this point we're not sure if:\nA) You got busy\nB) You joined another gym\nC) Or you're secretly waiting for Monday 😅\n\nEither way, BTF's here whenever you're ready to level up 🔥\n\nType *hi* to continue!`,
    7: `Quick reminder from BTF ✨\n\nGood health, confidence, strength, energy…\nthose things aren't expenses — they're investments.\n\nYour body will thank you later 💪\n\nType *hi* to pick up where you left off!`,
    30: `Hey 👋\n\nStill thinking about starting?\nNo pressure — BTF is always here when you're ready 🔥\n\nType *hi* to continue!`
};

// In-memory state
const pausedChats = new Set();   // contactIds where bot is paused
const leadState = new Map();     // contactId -> lead tracking data
let reminderInterval = null;
let _userId = null;              // bottofit's userId (set on first use)

function getAuth() {
    const keyFile = path.join(__dirname, '..', 'fake-1582b-firebase-adminsdk-fbsvc-878526e19e.json');
    return new google.auth.GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
}

// ── Sheet: upsert row by contactId (column M = userId/contactId) ──
async function saveToSheet(contactId, contactData) {
    try {
        const sheets = google.sheets({ version: 'v4', auth: getAuth() });
        const row = [
            new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
            contactData.name || '',
            contactData.phone || '',
            contactData.branch || '',
            contactData.service || '',
            contactData.goal || '',
            contactData.fitnessLevel || '',
            contactData.gender || '',
            contactData.timing || '',
            contactData.handedOver ? 'Yes' : 'No',
            contactData.handoverReason || '',
            contactData.lastStage || '',
            contactId
        ];

        // Check if row exists for this contactId (col M = index 12)
        const existing = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A:M`
        }).catch(() => ({ data: { values: [] } }));

        const rows = existing.data.values || [];
        let rowIndex = -1;
        for (let i = 1; i < rows.length; i++) {
            if (rows[i][12] === contactId) { rowIndex = i + 1; break; }
        }

        if (rowIndex > 0) {
            await sheets.spreadsheets.values.update({
                spreadsheetId: SHEET_ID,
                range: `${SHEET_TAB}!A${rowIndex}`,
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
        console.log('✅ BTF Sheet saved:', contactData.phone || contactId);
    } catch (err) {
        console.error('❌ BTF Sheet save failed:', err.message);
    }
}

// ── Amit notify ──────────────────────────────────────────────────
async function notifyAmit(userId, contactId, contactData) {
    try {
        const { sendMessage } = require('./manager');
        const msg =
            `✅ *New BTF Lead*\n\n` +
            `📞 Phone: ${contactData.phone || '-'}\n` +
            `🏋️ Branch: ${contactData.branch || '-'}\n` +
            `🎯 Service: ${contactData.service || '-'}\n` +
            `🏆 Goal: ${contactData.goal || '-'}\n` +
            `💪 Level: ${contactData.fitnessLevel || '-'}\n` +
            `👫 Gender: ${contactData.gender || '-'}\n` +
            `⏰ Timing: ${contactData.timing || '-'}\n` +
            `🕐 ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`;
        await sendMessage(userId, AMIT, msg);
        console.log('✅ Amit notified:', contactData.phone);
    } catch (e) {
        console.error('❌ Amit notify failed:', e.message);
    }
}

// ── Trial reminders ──────────────────────────────────────────────
function parseTrialDateTime(text) {
    try {
        const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const lower = text.toLowerCase().trim();
        const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
        if (!timeMatch) return null;

        let hour = parseInt(timeMatch[1]);
        const min = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        const ampm = timeMatch[3];
        if (ampm === 'pm' && hour !== 12) hour += 12;
        if (ampm === 'am' && hour === 12) hour = 0;

        let date = new Date(now);
        if (lower.includes('tomorrow')) {
            date.setDate(date.getDate() + 1);
        } else {
            const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
            for (let i = 0; i < months.length; i++) {
                if (lower.includes(months[i])) {
                    const dayMatch = lower.match(/(\d{1,2})\s*(?:st|nd|rd|th)?/);
                    if (dayMatch) {
                        date.setMonth(i);
                        date.setDate(parseInt(dayMatch[1]));
                        if (date < now) date.setFullYear(date.getFullYear() + 1);
                    }
                    break;
                }
            }
        }
        date.setHours(hour, min, 0, 0);
        return date;
    } catch { return null; }
}

function scheduleTrialReminders(userId, contactId, timingText) {
    const trialDate = parseTrialDateTime(timingText);
    if (!trialDate || isNaN(trialDate.getTime())) return;

    const now = Date.now();
    const trialTime = trialDate.getTime();
    const branch = leadState.get(contactId)?.branch || 'BTF';
    const timeStr = trialDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });

    const send = async (msg) => {
        try {
            const { sendMessage } = require('./manager');
            await sendMessage(userId, contactId, msg);
        } catch (e) { console.error('Trial reminder failed:', e.message); }
    };

    // 1 day before
    const oneDayBefore = trialTime - 24 * 60 * 60 * 1000;
    if (oneDayBefore > now) {
        setTimeout(() => send(
            `⏰ *Reminder from BTF!*\n\nYour trial session is *tomorrow* at ${timeStr} 🥊\n\n📍 ${branch}\n\nSee you there! 💪`
        ), oneDayBefore - now);
    }

    // 2 hours before
    const twoHoursBefore = trialTime - 2 * 60 * 60 * 1000;
    if (twoHoursBefore > now) {
        setTimeout(() => send(
            `🔔 *BTF Reminder!*\n\nYour trial session starts in *2 hours* at ${timeStr} 🥊\n\n📍 ${branch}\n\nGet ready! 🔥`
        ), twoHoursBefore - now);
    }

    console.log(`⏰ Trial reminders scheduled for ${contactId} at ${trialDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
}

// ── Activity tracking ─────────────────────────────────────────────
function trackActivity(contactId, stage, completed = false) {
    const existing = leadState.get(contactId) || { remindersSent: [] };
    leadState.set(contactId, {
        ...existing,
        lastMsgAt: Date.now(),
        lastStage: stage,
        completed: completed || existing.completed
    });
}

function markCompleted(contactId) {
    const existing = leadState.get(contactId) || { remindersSent: [] };
    leadState.set(contactId, { ...existing, completed: true });
}

function updateLeadData(contactId, data) {
    const existing = leadState.get(contactId) || { remindersSent: [] };
    leadState.set(contactId, { ...existing, ...data });
}

// ── Follow-up reminder checker (every 30 min) ─────────────────────
function startReminderChecker(userId) {
    _userId = userId;
    if (reminderInterval) return;

    console.log('⏰ BTF follow-up reminder checker started');
    reminderInterval = setInterval(async () => {
        const now = Date.now();
        for (const [contactId, state] of leadState.entries()) {
            if (state.completed) continue;
            if (!state.lastMsgAt || !state.lastStage) continue;
            if (['initial', 'completed'].includes(state.lastStage)) continue;

            const daysSince = (now - state.lastMsgAt) / (1000 * 60 * 60 * 24);
            const sent = state.remindersSent || [];

            let dayKey = null;
            if (daysSince >= 30 && !sent.includes(30)) dayKey = 30;
            else if (daysSince >= 7 && !sent.includes(7)) dayKey = 7;
            else if (daysSince >= 3 && !sent.includes(3)) dayKey = 3;
            else if (daysSince >= 1 && !sent.includes(1)) dayKey = 1;

            if (!dayKey) continue;

            try {
                const { sendMessage } = require('./manager');
                await sendMessage(userId, contactId, REMINDER_MSGS[dayKey]);
                state.remindersSent = [...sent, dayKey];
                leadState.set(contactId, state);
                console.log(`📩 BTF follow-up day-${dayKey} sent to ${contactId}`);
            } catch (e) {
                console.error(`❌ Follow-up failed ${contactId}:`, e.message);
            }
        }
    }, 30 * 60 * 1000);
}

// ── isPaused / togglePause ────────────────────────────────────────
function isPaused(contactId) { return pausedChats.has(contactId); }
function togglePause(contactId) {
    if (pausedChats.has(contactId)) {
        pausedChats.delete(contactId);
        console.log('▶️ BTF resumed:', contactId);
        return false; // now unpaused
    } else {
        pausedChats.add(contactId);
        console.log('⏸️ BTF paused:', contactId);
        return true; // now paused
    }
}

// ── Price keyword check ───────────────────────────────────────────
function isPriceQuery(msg) {
    const lower = msg.toLowerCase();
    return PRICE_KEYWORDS.some(k => lower.includes(k));
}

module.exports = {
    saveToSheet,
    notifyAmit,
    scheduleTrialReminders,
    trackActivity,
    markCompleted,
    updateLeadData,
    startReminderChecker,
    isPaused,
    togglePause,
    isPriceQuery
};
