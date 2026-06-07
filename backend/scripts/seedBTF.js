/**
 * Run once to create boxtofit account + BTF flow
 * node scripts/seedBTF.js
 */
require('dotenv').config({ path: '../.env' });
const bcrypt = require('bcryptjs');
const { db } = require('../firebase');

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1PRSwurGgeagmxQFcBLzlXT7yCmRoKkaZXlKln9_ttY0/edit';

const BTF_FLOW = {
    nodes: [
        {
            id: 'trigger_1',
            type: 'trigger',
            position: { x: 300, y: 50 },
            data: { matchType: 'any', keyword: '', label: 'Trigger' }
        },
        {
            id: 'msg_welcome',
            type: 'message',
            position: { x: 300, y: 160 },
            data: {
                label: 'Welcome',
                text: `👋 *Welcome to BTF – Box To Fit* 🔥

Please select your nearest branch:

1️⃣ *BTF Chandigarh*
📍 SCO 1076-1077, Sector 22B, Chandigarh - 160022

2️⃣ *BTF New Chandigarh (Omaxe)*
📍 SCO 9 & 10, Clockton Street Market, PR-4 Road, Omaxe, New Chandigarh - 140901`
            }
        },
        {
            id: 'collect_branch',
            type: 'collect',
            position: { x: 300, y: 310 },
            data: { question: 'Reply with *1* for Chandigarh or *2* for New Chandigarh 👇', field: 'branch', label: 'Branch' }
        },
        {
            id: 'msg_service',
            type: 'message',
            position: { x: 300, y: 460 },
            data: {
                label: 'Select Service',
                text: `Please choose an option:

1️⃣ Boxing + Fitness
2️⃣ Strength + Fitness
3️⃣ Book a Trial Session
4️⃣ Membership Details
5️⃣ Speak to Team

Reply with a number 👇`
            }
        },
        {
            id: 'collect_service',
            type: 'collect',
            position: { x: 300, y: 610 },
            data: { question: 'Reply with 1–5 👇', field: 'service', label: 'Service' }
        },
        {
            id: 'msg_goal',
            type: 'message',
            position: { x: 300, y: 760 },
            data: {
                label: 'Goal',
                text: `What is your main goal?

1️⃣ Fat Loss
2️⃣ Fitness & Endurance
3️⃣ Learn Boxing
4️⃣ Strength & Conditioning
5️⃣ Hyrox Training`
            }
        },
        {
            id: 'collect_goal',
            type: 'collect',
            position: { x: 300, y: 910 },
            data: { question: 'Reply with 1–5 👇', field: 'goal', label: 'Goal' }
        },
        {
            id: 'msg_level',
            type: 'message',
            position: { x: 300, y: 1060 },
            data: {
                label: 'Fitness Level',
                text: `What is your current training level?

1️⃣ Beginner
2️⃣ Intermediate
3️⃣ Advanced`
            }
        },
        {
            id: 'collect_level',
            type: 'collect',
            position: { x: 300, y: 1210 },
            data: { question: 'Reply with 1, 2, or 3 👇', field: 'fitnessLevel', label: 'Level' }
        },
        {
            id: 'msg_gender',
            type: 'message',
            position: { x: 300, y: 1360 },
            data: {
                label: 'Gender',
                text: `What is your gender?

1️⃣ Male
2️⃣ Female
3️⃣ Other`
            }
        },
        {
            id: 'collect_gender',
            type: 'collect',
            position: { x: 300, y: 1510 },
            data: { question: 'Reply with 1, 2, or 3 👇', field: 'gender', label: 'Gender' }
        },
        {
            id: 'msg_phone',
            type: 'message',
            position: { x: 300, y: 1660 },
            data: { label: 'Phone', text: 'Perfect 👊\n\nPlease share your *phone number* so our team can reach you 📞' }
        },
        {
            id: 'collect_phone',
            type: 'collect',
            position: { x: 300, y: 1810 },
            data: { question: 'Your 10-digit mobile number 👇', field: 'phone', label: 'Phone' }
        },
        {
            id: 'save_1',
            type: 'save_data',
            position: { x: 300, y: 1960 },
            data: { label: 'Save Data' }
        },
        {
            id: 'msg_timing',
            type: 'message',
            position: { x: 300, y: 2060 },
            data: {
                label: 'Timing',
                text: `🗓️ *Available Trial Slots*

⚠️ _Trials available till 5 PM only — gym gets busy after that!_

*Today:*
• 6:00 AM – 9:00 AM
• 9:00 AM – 12:00 PM
• 12:00 PM – 3:00 PM
• 3:00 PM – 5:00 PM

You can also type your preferred date & time freely.
Example: _Tomorrow 9 AM_ or _19 May, 4 PM_`
            }
        },
        {
            id: 'collect_timing',
            type: 'collect',
            position: { x: 300, y: 2210 },
            data: { question: 'Reply with your preferred slot 👇', field: 'timing', label: 'Timing' }
        },
        {
            id: 'handover_1',
            type: 'handover',
            position: { x: 300, y: 2360 },
            data: {
                label: 'Notify Team',
                notifyNumber: '917719560422',
                notifyMessage: `✅ *New BTF Lead*

👤 Name: {{name}}
📞 Phone: {{phone}}
🏋️ Branch: {{branch}}
🎯 Service: {{service}}
🏆 Goal: {{goal}}
💪 Level: {{fitnessLevel}}
👫 Gender: {{gender}}
⏰ Timing: {{timing}}`,
                replyText: `✅ *You're all set!*

Our team will reach out to you shortly on *{{phone}}* 📞

📍 *{{branch}}*

_"The only bad workout is the one that didn't happen."_ 💪

See you at BTF! 🥊`
            }
        },
        {
            id: 'end_1',
            type: 'end',
            position: { x: 300, y: 2510 },
            data: { label: 'End', text: '' }
        }
    ],
    edges: [
        { id: 'e1', source: 'trigger_1', target: 'msg_welcome', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e2', source: 'msg_welcome', target: 'collect_branch', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e3', source: 'collect_branch', target: 'msg_service', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e4', source: 'msg_service', target: 'collect_service', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e5', source: 'collect_service', target: 'msg_goal', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e6', source: 'msg_goal', target: 'collect_goal', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e7', source: 'collect_goal', target: 'msg_level', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e8', source: 'msg_level', target: 'collect_level', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e9', source: 'collect_level', target: 'msg_gender', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e10', source: 'msg_gender', target: 'collect_gender', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e11', source: 'collect_gender', target: 'msg_phone', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e12', source: 'msg_phone', target: 'collect_phone', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e13', source: 'collect_phone', target: 'save_1', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e14', source: 'save_1', target: 'msg_timing', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e15', source: 'msg_timing', target: 'collect_timing', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e16', source: 'collect_timing', target: 'handover_1', animated: true, style: { stroke: '#6366f1' } },
        { id: 'e17', source: 'handover_1', target: 'end_1', animated: true, style: { stroke: '#6366f1' } }
    ]
};

async function main() {
    // 1. Create user
    const username = 'boxtofit';
    const password = 'btf1234';

    const existing = await db.collection('wbp_users')
        .where('username', '==', username).limit(1).get();

    let userId;
    if (!existing.empty) {
        userId = existing.docs[0].id;
        console.log('ℹ️ User already exists, using existing uid:', userId);
    } else {
        const hash = await bcrypt.hash(password, 10);
        const userRef = await db.collection('wbp_users').add({
            username,
            displayName: 'Box To Fit',
            passwordHash: hash,
            role: 'user',
            active: true,
            createdAt: new Date().toISOString()
        });
        userId = userRef.id;
        console.log('✅ User created:', username, '| uid:', userId);
    }

    // 2. Create flow
    const existingFlow = await db.collection('wbp_flows')
        .where('userId', '==', userId).limit(1).get();

    if (!existingFlow.empty) {
        console.log('ℹ️ Flow already exists for this user. Updating...');
        await db.collection('wbp_flows').doc(existingFlow.docs[0].id).update({
            ...BTF_FLOW,
            sheetUrl: SHEET_URL,
            btfConfig: true,
            active: true,
            updatedAt: new Date().toISOString()
        });
        console.log('✅ Flow updated');
    } else {
        await db.collection('wbp_flows').add({
            userId,
            name: 'BTF Main Flow',
            ...BTF_FLOW,
            sheetUrl: SHEET_URL,
            btfConfig: true,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        console.log('✅ BTF flow created and activated');
    }

    console.log('\n🎉 Done!');
    console.log('   Username: boxtofit');
    console.log('   Password: btf1234');
    console.log('   Sheet:   ', SHEET_URL);
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
