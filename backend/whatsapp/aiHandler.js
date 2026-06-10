/**
 * AI Handler — Gemini powered WhatsApp bot
 * Uses function calling for lead save, image send, handover
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { db } = require('../firebase');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const CONV_COLLECTION = 'wbp_ai_conversations';
const MAX_HISTORY = 20; // messages to keep in context

// Google Sheets helper (same service account as btfService)
async function appendToSheet(sheetUrl, data) {
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) return;
    const sheetId = match[1];
    const keyFile = path.join(__dirname, '..', 'fake-1582b-firebase-adminsdk-fbsvc-878526e19e.json');
    if (!fs.existsSync(keyFile)) return;
    const auth = new google.auth.GoogleAuth({ keyFile, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const sheets = google.sheets({ version: 'v4', auth });
    const flat = {};
    for (const [k, v] of Object.entries(data)) {
        if (typeof v !== 'object') flat[k] = v;
    }
    const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId, range: 'A1:Z1'
    }).catch(() => ({ data: { values: [] } }));
    if (!existing.data.values?.length) {
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId, range: 'A1', valueInputOption: 'RAW',
            requestBody: { values: [Object.keys(flat)] }
        });
    }
    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId, range: 'A1',
        valueInputOption: 'USER_ENTERED', insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [Object.values(flat).map(String)] }
    });
}

async function handleAIMessage(userId, botConfig, message, client) {
    const contactId = message.from;
    const userMsg = message.body?.trim() || '';
    const genAI = new GoogleGenerativeAI(botConfig.geminiApiKey);

    // Load conversation history
    const convRef = db.collection(CONV_COLLECTION).doc(`${userId}_${contactId.replace(/[@:.]/g, '_')}`);
    const convDoc = await convRef.get();
    const convData = convDoc.exists ? convDoc.data() : { messages: [], leadData: {} };
    let history = convData.messages || [];
    let leadData = convData.leadData || {};

    // Build images context for system prompt
    const imagesContext = (botConfig.images || []).length > 0
        ? '\n\nAvailable product images you can send:\n' +
          botConfig.images.map(img => `- ${img.id}: ${img.name} (tags: ${img.tags})`).join('\n')
        : '';

    // System instruction
    const systemInstruction = `${botConfig.systemPrompt || 'You are a helpful WhatsApp assistant.'}

${botConfig.contextText ? `\nBusiness Context:\n${botConfig.contextText}` : ''}
${imagesContext}

IMPORTANT RULES:
- Keep replies SHORT and conversational (WhatsApp style)
- Collect lead information naturally during conversation
- When you have collected enough info (${(botConfig.leadFields || ['name', 'phone']).join(', ')}), call save_lead
- If user asks about a product and a relevant image exists, call send_image
- If user asks to speak to a human or is frustrated, call handover
- Reply in the same language the user writes in`;

    // Gemini function declarations
    const tools = [{
        functionDeclarations: [
            {
                name: 'save_lead',
                description: 'Save collected lead information to database and sheet',
                parameters: {
                    type: 'OBJECT',
                    properties: Object.fromEntries(
                        (botConfig.leadFields || ['name', 'phone']).map(f => [f, { type: 'STRING', description: `Customer's ${f}` }])
                    ),
                    required: []
                }
            },
            {
                name: 'send_image',
                description: 'Send a product image to the customer',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        imageId: { type: 'STRING', description: 'ID of the image to send' }
                    },
                    required: ['imageId']
                }
            },
            {
                name: 'handover',
                description: 'Escalate conversation to human agent',
                parameters: {
                    type: 'OBJECT',
                    properties: {
                        reason: { type: 'STRING', description: 'Reason for handover' }
                    },
                    required: ['reason']
                }
            }
        ]
    }];

    // Build chat history for Gemini (last MAX_HISTORY messages)
    const recentHistory = history.slice(-MAX_HISTORY).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
    }));

    try {
        const model = genAI.getGenerativeModel({
            model: 'gemini-2.0-flash',
            systemInstruction,
            tools
        });

        const chat = model.startChat({ history: recentHistory });

        // Handle incoming image from user (multimodal)
        let userContent;
        if (message.hasMedia && message.type === 'image') {
            try {
                const media = await message.downloadMedia();
                userContent = [
                    { text: userMsg || 'Image received' },
                    { inlineData: { mimeType: media.mimetype, data: media.data } }
                ];
            } catch {
                userContent = userMsg || '(image)';
            }
        } else {
            userContent = userMsg;
        }

        const result = await chat.sendMessage(userContent);
        const response = result.response;

        // Process function calls
        let textReply = '';
        const functionCalls = response.functionCalls() || [];

        for (const call of functionCalls) {
            if (call.name === 'save_lead') {
                leadData = { ...leadData, ...call.args, contactId, savedAt: new Date().toISOString() };
                // Save to Firestore
                await db.collection('wbp_leads').doc(`${userId}_${contactId.replace(/[@:.]/g, '_')}`).set({
                    userId, contactId, ...leadData, updatedAt: new Date().toISOString()
                }, { merge: true });
                // Save to Sheet if configured
                if (botConfig.sheetUrl) {
                    await appendToSheet(botConfig.sheetUrl, leadData).catch(e =>
                        console.error('AI Sheet save error:', e.message)
                    );
                }
                console.log(`✅ AI lead saved for ${contactId}:`, leadData);
            }

            if (call.name === 'send_image') {
                const img = (botConfig.images || []).find(i => i.id === call.args.imageId);
                if (img) {
                    try {
                        const { MessageMedia } = require('whatsapp-web.js');
                        const filePath = path.join(__dirname, '..', 'uploads', 'ai', img.filename);
                        if (fs.existsSync(filePath)) {
                            const media = MessageMedia.fromFilePath(filePath);
                            await client.sendMessage(contactId, media, { caption: img.name });
                            console.log(`📸 AI sent image: ${img.name}`);
                        }
                    } catch (e) {
                        console.error('Image send error:', e.message);
                    }
                }
            }

            if (call.name === 'handover') {
                const notifyNumber = botConfig.notifyNumber;
                if (notifyNumber) {
                    const waId = notifyNumber.replace(/\D/g, '') + '@c.us';
                    const alertMsg = `🤖 AI Bot Handover Request\n\nContact: ${contactId}\nReason: ${call.args.reason}\nLead: ${JSON.stringify(leadData, null, 2)}`;
                    await client.sendMessage(waId, alertMsg).catch(() => {});
                }
                console.log(`🤝 AI handover for ${contactId}: ${call.args.reason}`);
            }
        }

        // Get text response
        textReply = response.text();
        if (textReply) {
            await message.reply(textReply);
        }

        // Update conversation history
        history.push({ role: 'user', text: typeof userContent === 'string' ? userContent : (userMsg || '(image)') });
        history.push({ role: 'model', text: textReply });
        if (history.length > MAX_HISTORY * 2) history = history.slice(-MAX_HISTORY * 2);

        await convRef.set({ messages: history, leadData, updatedAt: Date.now() }, { merge: true });

    } catch (err) {
        console.error(`AI handler error for ${contactId}:`, err.message);
        await message.reply('Sorry, I encountered an error. Please try again.').catch(() => {});
    }
}

module.exports = { handleAIMessage };
