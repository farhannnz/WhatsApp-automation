const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// session save ke liye
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', qr => {
    console.log('Scan this QR:');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('✅ Bot is ready!');
});

client.on('message', message => {
    const msg = message.body.toLowerCase();

    if (msg === 'hi') {
        message.reply('Welcome to Gym 💪\n1. Fees\n2. Location');
    } 
    else if (msg === '1') {
        message.reply('Fees: ₹1500/month');
    } 
    else if (msg === '2') {
        message.reply('Nagpur ABC Chowk 📍');
    }
});

client.initialize();