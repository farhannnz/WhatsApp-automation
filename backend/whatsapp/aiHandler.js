/**
 * AI Handler — Gemini powered WhatsApp bot
 * Same approach as gemnieg.html — v1beta + gemini-2.5-flash
 */

const axios = require('axios');
const { db } = require('../firebase');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const CONV_COLLECTION = 'wbp_ai_conversations';
const MAX_HISTORY = 10;
const MODEL = 'gemini-3.1-flash-lite';

async function appendToSheet(sheetUrl, data) {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return;
    const sheetId = match[1];
    const keyFile = path.join(__dirname, '..', 'fake-1582b-firebase-adminsdk-fbsvc-878526e19e.json');
    if (!fs.existsSync(keyFile)) return;
    const auth = new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const flat = {};
    for (const [k, v] of Object.entries(data)) { if (typeof v !== 'object') flat[k] = v; }
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'A1:Z1' }).catch(() => ({ data: { values: [] } }));
    if (!existing.data.values?.length) {
        await sheets.spreadsheets.values.update({ spreadsheetId: sheetId, range: 'A1', valueInputOption: 'RAW', requestBody: { values: [Object.keys(flat)] } });
    }
    await sheets.spreadsheets.values.append({ spreadsheetId: sheetId, range: 'A1', valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS', requestBody: { values: [Object.values(flat).map(String)] } });
}

// Same as gemnieg.html — just POST to v1beta with contents array
async function callGemini(apiKey, contents) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    const response = await axios.post(url, { contents }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000
    });
    const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('No response from Gemini');
    return text;
}

async function handleAIMessage(userId, botConfig, message, client) {
    const contactId = message.from;
    const userMsg = message.body?.trim() || '';

    const convRef = db.collection(CONV_COLLECTION).doc(`${userId}_${contactId.replace(/[@:.]/g, '_')}`);
    const convDoc = await convRef.get();
    let history = convDoc.exists ? (convDoc.data().messages || []) : [];
    let leadData = convDoc.exists ? (convDoc.data().leadData || {}) : {};

    const imagesCtx = (botConfig.images || []).length > 0
        ? '\nAvailable images:\n' + botConfig.images.map(i => `- ${i.id}: ${i.name} (${i.tags})`).join('\n')
        : '';

    const systemMsg = `${botConfig.systemPrompt || 'You are a helpful WhatsApp assistant.'}
${botConfig.contextText ? '\nContext:\n' + botConfig.contextText : ''}${imagesCtx}

Rules:
- Keep replies short (WhatsApp style)
- Naturally collect: ${(botConfig.leadFields || ['name', 'phone']).join(', ')}
- When collected, output exactly: [SAVE_LEAD:{"name":"...","phone":"..."}]
- To send image: [SEND_IMAGE:imageId]
- To escalate: [HANDOVER:reason]
- Reply in user's language`;

    // Build contents like gemnieg.html — inject system as first turn
    const contents = [
        { role: 'user', parts: [{ text: `[SYSTEM]\n${systemMsg}` }] },
        { role: 'model', parts: [{ text: 'Understood.' }] }
    ];

    // Add history
    for (const m of history.slice(-MAX_HISTORY)) {
        contents.push({ role: m.role === 'model' ? 'model' : 'user', parts: [{ text: m.text }] });
    }

    // Add current message
    contents.push({ role: 'user', parts: [{ text: userMsg || '(message)' }] });

    try {
        const rawText = await callGemini(botConfig.geminiApiKey, contents);
        let textReply = rawText;

        // [SAVE_LEAD:{...}]
        const saveMatch = rawText.match(/\[SAVE_LEAD:(.*?)\]/s);
        if (saveMatch) {
            try {
                const fields = JSON.parse(saveMatch[1]);
                leadData = { ...leadData, ...fields, contactId, savedAt: new Date().toISOString() };
                await db.collection('wbp_leads').doc(`${userId}_${contactId.replace(/[@:.]/g, '_')}`).set(
                    { userId, contactId, ...leadData, updatedAt: new Date().toISOString() }, { merge: true }
                );
                if (botConfig.sheetUrl) await appendToSheet(botConfig.sheetUrl, leadData).catch(e => console.error('Sheet error:', e.message));
                console.log(`✅ AI lead saved:`, leadData);
            } catch (e) { console.error('Save lead parse error:', e.message); }
            textReply = textReply.replace(/\[SAVE_LEAD:.*?\]/s, '').trim();
        }

        // [SEND_IMAGE:id]
        const imgMatch = rawText.match(/\[SEND_IMAGE:([^\]]+)\]/);
        if (imgMatch) {
            const img = (botConfig.images || []).find(i => i.id === imgMatch[1].trim());
            if (img) {
                try {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const filePath = path.join(__dirname, '..', 'uploads', 'ai', img.filename);
                    if (fs.existsSync(filePath)) {
                        await client.sendMessage(contactId, MessageMedia.fromFilePath(filePath), { caption: img.name });
                        console.log(`📸 AI sent image: ${img.name}`);
                    }
                } catch (e) { console.error('Image send error:', e.message); }
            }
            textReply = textReply.replace(/\[SEND_IMAGE:[^\]]+\]/g, '').trim();
        }

        // [HANDOVER:reason]
        const handoverMatch = rawText.match(/\[HANDOVER:([^\]]+)\]/);
        if (handoverMatch && botConfig.notifyNumber) {
            const waId = botConfig.notifyNumber.replace(/\D/g, '') + '@c.us';
            await client.sendMessage(waId, `🤖 AI Handover\nContact: ${contactId}\nReason: ${handoverMatch[1]}\nLead: ${JSON.stringify(leadData)}`).catch(() => {});
            textReply = textReply.replace(/\[HANDOVER:[^\]]+\]/g, '').trim();
        }

        if (textReply) await message.reply(textReply);

        history.push({ role: 'user', text: userMsg || '(message)' });
        history.push({ role: 'model', text: rawText });
        if (history.length > MAX_HISTORY * 2) history = history.slice(-MAX_HISTORY * 2);
        await convRef.set({ messages: history, leadData, updatedAt: Date.now() }, { merge: true });

        console.log(`🤖 AI replied to ${contactId}`);

    } catch (err) {
        const errMsg = err.response?.data?.error?.message || err.message;
        console.error(`AI handler error for ${contactId}:`, errMsg);
        if (errMsg && errMsg.includes('quota')) {
            await message.reply('🙏 Hum abhi bahut busy hain, thodi der baad try karein.').catch(() => {});
        } else {
            await message.reply('Sorry, something went wrong. Please try again.').catch(() => {});
        }
    }
}

module.exports = { handleAIMessage };
