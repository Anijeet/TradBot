import { Telegraf, Markup, Context } from 'telegraf';
import { Keypair } from '@solana/web3.js';

const bot = new Telegraf("8320846082:AAHw3kMGXs7NZFXsPkOrf-GGP3uZZLNVGPE");
const USERS : Record<string, Keypair> = {}

bot.start(async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    // const payload = ctx.startPayload;
    
    let welcomeMessage = `
🤖 **Welcome to Trad Wallet Bot!**

Your secure, easy-to-use Solana wallet manager.

**Features:**
• 🔑 Generate new wallets
• 📋 Import existing wallets
• 💰 Check balances
• 💸 Send SOL and SPL tokens
• 📊 View transaction history
• 🔒 Secure private key storage

**Security:**
• All private keys are encrypted
• Never share your private keys
• Use at your own risk (testnet recommended)

Choose an option below to get started:`;
    return ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [
                Markup.button.callback('🔑 Generate Wallet', 'generate_wallet'),
            ],
            [
                Markup.button.callback('👁️ View Address', 'view_address'),
                Markup.button.callback('🔐 Export Private Key', 'export_private_key')
            ],
            [
                Markup.button.callback('💰 Check Balance', 'check_balance'),
                Markup.button.callback('📊 Transaction History', 'tx_history')
            ],
            [
                Markup.button.callback('💸 Send SOL', 'send_sol_menu'),
                Markup.button.callback('🪙 Send Token', 'send_token_menu')
            ]
        ])
    });
});


async function startBot(): Promise<void> {
    try {
        await bot.launch({
            allowedUpdates: ['message', 'callback_query']
        });        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}



bot.action('generate_wallet', async (ctx) => {
    try {
        await ctx.answerCbQuery('Generating new wallet...');
        const keypair = Keypair.generate();
        const userId = ctx.from?.id;
        USERS[userId]=keypair;
        ctx.sendMessage(`New wallet created for you public key with ${keypair.publicKey}`, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('👁️ View Address', 'view_address'),
                    Markup.button.callback('🔐 Export Private Key', 'export_private_key')
                ],
                [
                    Markup.button.callback('💰 Check Balance', 'check_balance'),
                    Markup.button.callback('📊 Transaction History', 'tx_history')
                ],
                [
                    Markup.button.callback('💸 Send SOL', 'send_sol_menu'),
                    Markup.button.callback('🪙 Send Token', 'send_token_menu')
                ]
            ])
        });
    } catch (error) {
        await ctx.answerCbQuery('❌ Failed to generate wallet');
        return ctx.reply('❌ An error occurred. Please try again.');
    }
});

// Start the bot
startBot();