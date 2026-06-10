/**
 * Flow Executor
 * Runs a user's chatflow when a WhatsApp message arrives.
 *
 * Node types:
 *  - trigger     : entry point (keyword / any / regex)
 *  - message     : send a text message
 *  - options     : show numbered choices, wait for reply
 *  - collect     : ask a question, save answer to a field
 *  - condition   : branch based on collected data value
 *  - handover    : notify a number, pause bot for this contact
 *  - end         : mark conversation complete
 */

const { db } = require('../firebase');
const axios = require('axios');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

// Append a row to a Google Sheet using service account (same as index.js approach)
async function appendToSheet(sheetUrl, data) {
    // Extract sheet ID from URL
    const match = sheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) { console.error('Invalid sheet URL'); return; }
    const sheetId = match[1];

    // Find service account key file
    const keyFile = process.env.GOOGLE_KEY_FILE ||
        path.join(__dirname, '..', 'fake-1582b-firebase-adminsdk-fbsvc-878526e19e.json');

    if (!fs.existsSync(keyFile)) {
        console.warn('⚠️ Google service account key not found:', keyFile);
        return;
    }

    const auth = new google.auth.GoogleAuth({
        keyFile,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Flatten — skip nested objects
    const flat = {};
    for (const [k, v] of Object.entries(data)) {
        if (typeof v !== 'object') flat[k] = v;
    }

    // Check if header row exists
    const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'A1:Z1'
    }).catch(() => ({ data: { values: [] } }));

    if (!existing.data.values || existing.data.values.length === 0) {
        // Write headers first
        await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: 'A1',
            valueInputOption: 'RAW',
            requestBody: { values: [Object.keys(flat)] }
        });
    }

    // Append data row
    await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'A1',
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: [Object.values(flat).map(String)] }
    });

    console.log('✅ Sheet row appended');
}

// In-memory conversation state: Map<userId_contactId, stateObj>
const convState = new Map();

function stateKey(userId, contactId) {
    return `${userId}::${contactId}`;
}

function getState(userId, contactId) {
    return convState.get(stateKey(userId, contactId)) || null;
}

function setState(userId, contactId, state) {
    convState.set(stateKey(userId, contactId), state);
}

function clearState(userId, contactId) {
    convState.delete(stateKey(userId, contactId));
}

// Find node by id
function findNode(flow, nodeId) {
    return flow.nodes.find(n => n.id === nodeId) || null;
}

// Find edges going out from a node
function outEdges(flow, nodeId) {
    return flow.edges.filter(e => e.source === nodeId);
}

// Get next node after a node (for linear nodes with one output)
function nextNode(flow, nodeId, handle = null) {
    const edges = outEdges(flow, nodeId);
    if (handle) {
        const edge = edges.find(e => e.sourceHandle === handle);
        return edge ? findNode(flow, edge.target) : null;
    }
    return edges.length > 0 ? findNode(flow, edges[0].target) : null;
}

// Find trigger nodes that match an incoming message
function findMatchingTrigger(flow, msg) {
    const triggers = flow.nodes.filter(n => n.type === 'trigger');
    for (const t of triggers) {
        const { matchType, keyword } = t.data || {};
        if (matchType === 'any') return t;
        if (matchType === 'keyword' && keyword) {
            if (msg.toLowerCase().includes(keyword.toLowerCase())) return t;
        }
        if (matchType === 'regex' && keyword) {
            try {
                if (new RegExp(keyword, 'i').test(msg)) return t;
            } catch { }
        }
        if (matchType === 'exact' && keyword) {
            if (msg.toLowerCase().trim() === keyword.toLowerCase().trim()) return t;
        }
    }
    return null;
}

async function saveLead(userId, contactId, data, sheetUrl) {
    const phone = contactId.replace('@c.us', '').replace('@lid', '');
    const key = `${userId}_${phone}`;
    console.log(`💾 Saving lead: ${phone} | fields: ${Object.keys(data).join(', ')}`);
    try {
        await db.collection('wbp_leads').doc(key).set({
            userId, contactId, phone, ...data,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        console.log(`✅ Lead saved: ${phone}`);
        if (sheetUrl) {
            await appendToSheet(sheetUrl, { phone, ...data }).catch(e =>
                console.error('Sheet append error:', e.message)
            );
        }
    } catch (err) {
        console.error('❌ Lead save error:', err.message);
    }
}

async function executeNode(userId, flow, node, message, client, contactData) {
    if (!node) return;

    const contactId = message.from;
    const { type, data } = node;
    const sheetUrl = flow.sheetUrl || null;

    switch (type) {
        case 'trigger': {
            // Move to next node after trigger
            const next = nextNode(flow, node.id);
            if (next) await executeNode(userId, flow, next, message, client, contactData);
            break;
        }

        case 'image': {
            const caption = (data.caption || '').replace(/\{\{(\w+)\}\}/g, (_, key) => contactData[key] || '');
            if (data.filename) {
                try {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const filePath = require('path').join(__dirname, '..', 'uploads', data.filename);
                    const media = MessageMedia.fromFilePath(filePath);
                    await client.sendMessage(contactId, media, { caption });
                } catch (e) {
                    console.error('Image send failed:', e.message);
                    if (caption) await message.reply(caption);
                }
            }
            const next = nextNode(flow, node.id);
            if (next) await executeNode(userId, flow, next, message, client, contactData);
            break;
        }

        case 'message': {
            const text = (data.text || '').replace(/\{\{(\w+)\}\}/g, (_, key) => contactData[key] || '');
            if (data.filename) {
                try {
                    const { MessageMedia } = require('whatsapp-web.js');
                    const filePath = require('path').join(__dirname, '..', 'uploads', data.filename);
                    const media = MessageMedia.fromFilePath(filePath);
                    await client.sendMessage(contactId, media, { caption: text });
                } catch (e) {
                    console.error('Image in message failed:', e.message);
                    if (text) await message.reply(text);
                }
            } else {
                await message.reply(text);
            }
            const next = nextNode(flow, node.id);
            if (next) await executeNode(userId, flow, next, message, client, contactData);
            break;
        }

        case 'options': {
            const opts = (data.options || []).filter(o => o && o.label);
            const inputType = data.inputType || 'text';

            if (!opts.length) {
                await message.reply('No options configured for this step.');
                break;
            }

            // Send text fallback — only show "Reply with a number" for text type
            let text = `*${data.question || 'Please choose:'}*\n\n`;
            opts.forEach((opt, i) => { text += `${i + 1}️⃣ ${opt.label}\n`; });
            if (inputType === 'text') text += `\n_Reply with a number_`;
            await message.reply(text);

            // Also try to send list/buttons as interactive (bonus — may or may not work)
            if (inputType === 'list' && opts.length > 0) {
                try {
                    const result = await client.pupPage.evaluate(async ({ to, title, btnText, sections }) => {
                        if (!window.WPP?.isReady) return 'wpp_not_ready';
                        await WPP.chat.sendListMessage(to, {
                            buttonText: btnText,
                            description: title,
                            sections
                        });
                        return 'ok';
                    }, {
                        to: contactId,
                        title: data.question || 'Please choose:',
                        btnText: data.listButtonText || 'View Options',
                        sections: [{ title: 'Options', rows: opts.filter(o => o?.label).slice(0, 10).map((o, i) => ({ rowId: `opt_${i}`, title: o.label })) }]
                    });
                    if (result === 'ok') console.log('✅ List sent via WPP');
                    else console.log('ℹ️ WPP not ready, using text fallback');
                } catch (e) {
                    console.log('ℹ️ List failed:', e.message);
                }
            }

            if (inputType === 'buttons' && opts.length <= 3) {
                try {
                    const result = await client.pupPage.evaluate(async ({ to, title, buttons }) => {
                        if (!window.WPP?.isReady) return 'wpp_not_ready';
                        // WPP uses templateButtons for button messages
                        await WPP.chat.sendTextMessage(to, title, {
                            templateButtons: buttons.map((b, i) => ({
                                index: i + 1,
                                quickReplyButton: { displayText: b.displayText, id: b.id }
                            }))
                        });
                        return 'ok';
                    }, {
                        to: contactId,
                        title: data.question || 'Please choose:',
                        buttons: opts.slice(0, 3).map((o, i) => ({ id: `btn_${i}`, displayText: o.label }))
                    });
                    if (result === 'ok') console.log('✅ Buttons sent via WPP');
                    else console.log('ℹ️ WPP not ready for buttons');
                } catch (e) {
                    console.log('ℹ️ Buttons failed:', e.message);
                }
            }

            setState(userId, contactId, {
                nodeId: node.id,
                waitingFor: 'option',
                inputType,
                flowId: flow.id,
                contactData
            });
            break;
        }

        case 'collect': {
            const question = (data.question || 'Please enter:').replace(/\{\{(\w+)\}\}/g, (_, key) => contactData[key] || '');
            await message.reply(question);
            setState(userId, contactId, {
                nodeId: node.id,
                waitingFor: 'collect',
                field: data.field,
                flowId: flow.id,
                contactData
            });
            break;
        }

        case 'condition': {
            const { field, operator, value } = data;
            const actual = (contactData[field] || '').toString().toLowerCase();
            const expected = (value || '').toLowerCase();
            let matched = false;
            if (operator === 'equals') matched = actual === expected;
            else if (operator === 'contains') matched = actual.includes(expected);
            else if (operator === 'not_equals') matched = actual !== expected;

            const handle = matched ? 'true' : 'false';
            const next = nextNode(flow, node.id, handle);
            if (next) await executeNode(userId, flow, next, message, client, contactData);
            break;
        }

        case 'handover': {
            const notifyNumber = data.notifyNumber;
            const notifyMsg = (data.notifyMessage || `New lead from ${contactId}:\n${JSON.stringify(contactData, null, 2)}`).replace(/\{\{(\w+)\}\}/g, (_, key) => contactData[key] || '');
            const replyText = (data.replyText || '').replace(/\{\{(\w+)\}\}/g, (_, key) => contactData[key] || '');
            if (notifyNumber) {
                const waId = notifyNumber.replace(/\D/g, '') + '@c.us';
                try { await client.sendMessage(waId, notifyMsg); } catch { }
            }
            if (replyText) await message.reply(replyText);
            setState(userId, contactId, { handedOver: true, flowId: flow.id, contactData });
            await saveLead(userId, contactId, { ...contactData, handedOver: true }, sheetUrl);
            if (flow.btfConfig) {
                const btf = require('./btfService');
                btf.markCompleted(contactId);
                await btf.saveToSheet(contactId, { ...contactData, handedOver: true, lastStage: 'completed' });
                await btf.notifyAmit(userId, contactId, contactData);
            }
            break;
        }

        case 'save_data': {
            await saveLead(userId, contactId, contactData, sheetUrl);
            if (flow.btfConfig) {
                const btf = require('./btfService');
                btf.updateLeadData(contactId, contactData);
                await btf.saveToSheet(contactId, { ...contactData, lastStage: 'save_data' });
            }
            const next = nextNode(flow, node.id);
            if (next) await executeNode(userId, flow, next, message, client, contactData);
            break;
        }

        case 'end': {
            if (data.text) await message.reply(data.text);
            await saveLead(userId, contactId, { ...contactData, completed: true }, sheetUrl);
            if (flow.btfConfig) {
                const btf = require('./btfService');
                btf.markCompleted(contactId);
                await btf.saveToSheet(contactId, { ...contactData, completed: true, lastStage: 'completed' });
            }
            clearState(userId, contactId);
            break;
        }

        default:
            break;
    }
}

async function handleMessage(userId, flow, message, client) {
    const contactId = message.from;
    const msg = message.body.trim();
    const state = getState(userId, contactId);

    // BTF-specific handling
    if (flow.btfConfig) {
        const btf = require('./btfService');

        // Start reminder checker once
        btf.startReminderChecker(userId);

        // ".." toggles pause
        if (msg === '..') {
            btf.togglePause(contactId);
            return;
        }

        // Bot paused for this contact
        if (btf.isPaused(contactId)) return;

        // Price keywords auto-reply
        if (btf.isPriceQuery(msg)) {
            await message.reply('Our programs are customized based on your goals, experience level, and coaching requirements.\n\nAt BTF, we focus on results, structure, and real progression rather than just selling memberships. 💪\n\nOur team will share all details when they reach out to you!');
            return;
        }

        // Track activity
        btf.trackActivity(contactId, state?.nodeId || 'initial');
    }

    // If handed over, bot is silent
    if (state && state.handedOver) return;

    // If waiting for a reply (options or collect)
    if (state && state.waitingFor) {
        const node = findNode(flow, state.nodeId);
        if (!node) { clearState(userId, contactId); return; }

        let contactData = { ...state.contactData };

        if (state.waitingFor === 'collect') {
            contactData[state.field] = msg;
            await saveLead(userId, contactId, contactData, flow.sheetUrl);

            // BTF: update sheet + schedule trial reminders if timing just collected
            if (flow.btfConfig) {
                const btf = require('./btfService');
                btf.updateLeadData(contactId, contactData);
                await btf.saveToSheet(contactId, { ...contactData, lastStage: state.field });
                if (state.field === 'timing') {
                    btf.scheduleTrialReminders(userId, contactId, msg);
                }
            }

            clearState(userId, contactId);
            const next = nextNode(flow, node.id);
            if (next) {
                await executeNode(userId, flow, next, message, client, contactData);
            }
            return;
        }

        if (state.waitingFor === 'option') {
            const opts = node.data.options || [];
            const inputType = state.inputType || 'text';
            let idx = -1;

            if (inputType === 'list') {
                // List response: selectedRowId like "opt_0", or match by label
                const rowId = message.selectedRowId || msg;
                const match = String(rowId).match(/opt_(\d+)/);
                if (match) idx = parseInt(match[1]);
                if (idx === -1) idx = opts.findIndex(o => o.label.toLowerCase() === msg.toLowerCase());
            } else if (inputType === 'buttons') {
                // Button response body matches option label
                idx = opts.findIndex(o => o.label.toLowerCase() === msg.toLowerCase());
                if (idx === -1) idx = parseInt(msg) - 1;
            } else {
                idx = parseInt(msg) - 1;
            }

            if (idx < 0 || idx >= opts.length) {
                await message.reply(`Please choose a valid option (1-${opts.length}).`);
                return;
            }

            const chosen = opts[idx];
            if (node.data.saveField) contactData[node.data.saveField] = chosen.label;
            await saveLead(userId, contactId, contactData, flow.sheetUrl);
            clearState(userId, contactId);
            const next = nextNode(flow, node.id, `option_${idx}`);
            if (next) await executeNode(userId, flow, next, message, client, contactData);
            return;
        }
    }

    // New message — find matching trigger
    const trigger = findMatchingTrigger(flow, msg);
    if (!trigger) return; // no matching trigger, bot stays silent

    // Extract real phone — @lid is linked device format, get number from _serialized
    let phone = contactId.replace('@c.us', '').replace('@lid', '');
    if (message._data?.notifyName) { } // notifyName is display name, not number
    // Use the raw number part only
    const phoneMatch = contactId.match(/^(\d+)@/);
    if (phoneMatch) phone = phoneMatch[1];

    const contactData = { phone, startedAt: new Date().toISOString(), flowId: flow.id, flowName: flow.name || '' };
    await saveLead(userId, contactId, contactData, flow.sheetUrl);
    await executeNode(userId, flow, trigger, message, client, contactData);
}

module.exports = { handleMessage };
