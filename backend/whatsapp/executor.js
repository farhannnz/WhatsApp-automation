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

const { db, rtdb } = require('../firebase');

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

async function saveLead(userId, contactId, data) {
    const phone = contactId.replace('@c.us', '');
    const key = `${userId}_${phone}`;
    console.log(`💾 Saving lead: ${phone} | fields: ${Object.keys(data).join(', ')}`);
    try {
        await db.collection('wbp_leads').doc(key).set({
            userId,
            contactId,
            phone,
            ...data,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        await rtdb.ref(`wbp_leads/${userId}/${phone.replace(/\+/g, '')}`).set({
            ...data, phone, updatedAt: Date.now()
        });
        console.log(`✅ Lead saved: ${phone}`);
    } catch (err) {
        console.error('❌ Lead save error:', err.message);
    }
}

async function executeNode(userId, flow, node, message, client, contactData) {
    if (!node) return;

    const contactId = message.from;
    const { type, data } = node;

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
            const notifyMsg = data.notifyMessage || `New lead from ${contactId}:\n${JSON.stringify(contactData, null, 2)}`;
            if (notifyNumber) {
                const waId = notifyNumber.replace(/\D/g, '') + '@c.us';
                try { await client.sendMessage(waId, notifyMsg); } catch { }
            }
            if (data.replyText) await message.reply(data.replyText);
            // Mark as handed over — bot stops responding to this contact
            setState(userId, contactId, { handedOver: true, flowId: flow.id, contactData });
            await saveLead(userId, contactId, { ...contactData, handedOver: true });
            break;
        }

        case 'save_data': {
            // Explicit save node — saves all collected data to Firebase
            await saveLead(userId, contactId, contactData);
            const next = nextNode(flow, node.id);
            if (next) await executeNode(userId, flow, next, message, client, contactData);
            break;
        }

        case 'end': {
            if (data.text) await message.reply(data.text);
            await saveLead(userId, contactId, { ...contactData, completed: true });
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

    // If handed over, bot is silent
    if (state && state.handedOver) return;

    // If waiting for a reply (options or collect)
    if (state && state.waitingFor) {
        const node = findNode(flow, state.nodeId);
        if (!node) { clearState(userId, contactId); return; }

        let contactData = { ...state.contactData };

        if (state.waitingFor === 'collect') {
            // Save the collected value
            contactData[state.field] = msg;
            // Auto-save to Firebase on every collect
            await saveLead(userId, contactId, contactData);
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
            await saveLead(userId, contactId, contactData);
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
    await saveLead(userId, contactId, contactData);
    await executeNode(userId, flow, trigger, message, client, contactData);
}

module.exports = { handleMessage };
