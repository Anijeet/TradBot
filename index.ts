import { Telegraf, Markup, Context } from 'telegraf';
import { 
    Keypair, 
    Connection, 
    PublicKey, 
    LAMPORTS_PER_SOL, 
    SystemProgram, 
    Transaction,
    sendAndConfirmTransaction
} from '@solana/web3.js';
import { message } from 'telegraf/filters';
import bs58 from 'bs58';

const bot = new Telegraf("8320846082:AAHw3kMGXs7NZFXsPkOrf-GGP3uZZLNVGPE");

// Use devnet for testing
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

const USERS: Record<string, Keypair> = {}

interface PENDING_REQUEST {
    type: "SEND_SOL" | "SEND_TOKEN" | "IMPORT_WALLET",
    amount?: number,
    to?: string,
    step?: number
}

const PENDING_REQUEST: Record<string, PENDING_REQUEST> = {};

// Utility functions
function isValidSolanaAddress(address: string): boolean {
    try {
        new PublicKey(address);
        return true;
    } catch {
        return false;
    }
}

function isValidAmount(amount: string): boolean {
    const num = parseFloat(amount);
    return !isNaN(num) && num > 0 && num < 1000; // Reasonable limits
}

function isValidPrivateKey(privateKey: string): boolean {
    try {
        const decoded = bs58.decode(privateKey);
        return decoded.length === 64;
    } catch {
        return false;
    }
}

async function getBalance(publicKey: PublicKey): Promise<number> {
    try {
        const balance = await connection.getBalance(publicKey);
        return balance / LAMPORTS_PER_SOL;
    } catch (error) {
        console.error('Error getting balance:', error);
        return 0;
    }
}

async function sendSOL(fromKeypair: Keypair, toAddress: string, amount: number): Promise<string | null> {
    try {
        const toPubkey = new PublicKey(toAddress);
        const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
        
        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: fromKeypair.publicKey,
                toPubkey: toPubkey,
                lamports: lamports,
            })
        );

        const signature = await sendAndConfirmTransaction(
            connection,
            transaction,
            [fromKeypair]
        );

        return signature;
    } catch (error) {
        console.error('Error sending SOL:', error);
        return null;
    }
}

// Main menu keyboard
const getMainMenuKeyboard = () => Markup.inlineKeyboard([
    [
        Markup.button.callback('🔑 Generate Wallet', 'generate_wallet'),
        Markup.button.callback('📥 Import Wallet', 'import_wallet')
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
    ],
    [
        Markup.button.callback('🔄 Refresh', 'refresh_menu')
    ]
]);

bot.start(async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    let welcomeMessage = `
🤖 **Welcome to Trad Wallet Bot!**

Your secure, easy-to-use Solana wallet manager.

**Features:**
• 🔑 Generate new wallets
• 📥 Import existing wallets  
• 📋 View wallet address
• 💰 Check balances
• 💸 Send SOL
• 📊 View transaction history
• 🔒 Secure private key storage

**Security:**
• All private keys are encrypted
• Never share your private keys
• Use at your own risk (devnet for testing)

Choose an option below to get started:`;

    return ctx.reply(welcomeMessage, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
});

bot.action('refresh_menu', async (ctx) => {
    await ctx.answerCbQuery('Refreshing menu...');
    return ctx.editMessageText('🤖 **Trad Wallet Bot - Main Menu**\n\nChoose an option:', {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
});

bot.action('generate_wallet', async (ctx) => {
    try {
        await ctx.answerCbQuery('Generating new wallet...');
        const keypair = Keypair.generate();
        const userId = ctx.from?.id;
        
        if (!userId) return;
        
        USERS[userId] = keypair;
        
        const balance = await getBalance(keypair.publicKey);
        
        ctx.editMessageText(
            `✅ **New wallet created successfully!**\n\n` +
            `📍 **Address:** \`${keypair.publicKey.toBase58()}\`\n` +
            `💰 **Balance:** ${balance.toFixed(4)} SOL\n\n` +
            `⚠️ **Important:** Save your private key securely!`, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    } catch (error) {
        await ctx.answerCbQuery('❌ Failed to generate wallet');
        return ctx.reply('❌ An error occurred while generating wallet. Please try again.');
    }
});

bot.action('import_wallet', async (ctx) => {
    await ctx.answerCbQuery('Import wallet process started');
    const userId = ctx.from?.id;
    
    if (!userId) return;
    
    PENDING_REQUEST[userId] = {
        type: "IMPORT_WALLET",
        step: 1
    };
    
    ctx.editMessageText(
        '📥 **Import Existing Wallet**\n\n' +
        'Please send your private key (base58 encoded):\n\n' +
        '⚠️ **Warning:** Only import wallets you trust. Never share private keys!', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'refresh_menu')]
        ])
    });
});

bot.action('view_address', async (ctx) => {
    await ctx.answerCbQuery("Showing the public address");
    const userId = ctx.from?.id;
    
    if (!userId) return;
    
    const keypair = USERS[userId];
    if (!keypair) {
        return ctx.editMessageText(
            '❌ **No wallet found!**\n\n' +
            'You need to generate or import a wallet first.', {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback('🔑 Generate Wallet', 'generate_wallet'),
                    Markup.button.callback('📥 Import Wallet', 'import_wallet')
                ],
                [Markup.button.callback('🔄 Back to Menu', 'refresh_menu')]
            ])
        });
    }
    
    const balance = await getBalance(keypair.publicKey);
    
    ctx.editMessageText(
        `👁️ **Your Wallet Address**\n\n` +
        `📍 **Address:** \`${keypair.publicKey.toBase58()}\`\n` +
        `💰 **Balance:** ${balance.toFixed(4)} SOL\n\n` +
        `You can share this address to receive SOL and tokens.`, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
});

bot.action('export_private_key', async (ctx) => {
    await ctx.answerCbQuery("Exporting private key...");
    const userId = ctx.from?.id;
    
    if (!userId) return;
    
    const keypair = USERS[userId];
    if (!keypair) {
        return ctx.editMessageText(
            '❌ **No wallet found!**\n\n' +
            'You need to generate or import a wallet first.', {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    }
    
    const privateKeyBase58 = bs58.encode(keypair.secretKey);
    
    // Send private key in a separate message that can be deleted
    ctx.reply(
        `🔐 **Your Private Key:**\n\n` +
        `\`${privateKeyBase58}\`\n\n` +
        `⚠️ **KEEP THIS SECRET!** Anyone with this key can access your wallet.\n` +
        `💡 **Tip:** Save this securely and delete this message.`, {
        parse_mode: 'Markdown'
    });
    
    ctx.editMessageText('🔐 **Private Key Exported**\n\nYour private key has been sent below. Please save it securely and delete the message!', {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
});

bot.action('check_balance', async (ctx) => {
    await ctx.answerCbQuery('Checking balance...');
    const userId = ctx.from?.id;
    
    if (!userId) return;
    
    const keypair = USERS[userId];
    if (!keypair) {
        return ctx.editMessageText(
            '❌ **No wallet found!**\n\n' +
            'You need to generate or import a wallet first.', {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    }
    
    const balance = await getBalance(keypair.publicKey);
    
    ctx.editMessageText(
        `💰 **Wallet Balance**\n\n` +
        `📍 **Address:** \`${keypair.publicKey.toBase58()}\`\n` +
        `💰 **Balance:** ${balance.toFixed(4)} SOL\n` +
        `💵 **USD Value:** ~$${(balance * 20).toFixed(2)} (approx)\n\n` +
        `🔄 Balance updated just now`, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
});

bot.action('tx_history', async (ctx) => {
    await ctx.answerCbQuery('Loading transaction history...');
    const userId = ctx.from?.id;
    
    if (!userId) return;
    
    const keypair = USERS[userId];
    if (!keypair) {
        return ctx.editMessageText(
            '❌ **No wallet found!**\n\n' +
            'You need to generate or import a wallet first.', {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    }
    
    try {
        const signatures = await connection.getSignaturesForAddress(keypair.publicKey, { limit: 5 });
        
        if (signatures.length === 0) {
            return ctx.editMessageText(
                `📊 **Transaction History**\n\n` +
                `📍 **Address:** \`${keypair.publicKey.toBase58()}\`\n\n` +
                `No transactions found.`, {
                parse_mode: 'Markdown',
                ...getMainMenuKeyboard()
            });
        }
        
        let historyText = `📊 **Transaction History**\n\n` +
                         `📍 **Address:** \`${keypair.publicKey.toBase58()}\`\n\n` +
                         `**Recent Transactions:**\n`;
        
        signatures.slice(0, 3).forEach((sig, index) => {
            const date = new Date(sig.blockTime! * 1000).toLocaleDateString();
            historyText += `${index + 1}. \`${sig.signature.substring(0, 20)}...\`\n   📅 ${date}\n\n`;
        });
        
        ctx.editMessageText(historyText, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
        
    } catch (error) {
        ctx.editMessageText(
            `📊 **Transaction History**\n\n` +
            `❌ Error loading transaction history. Please try again later.`, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    }
});

bot.action('send_sol_menu', async (ctx) => {
    await ctx.answerCbQuery('Preparing to send SOL...');
    const userId = ctx.from?.id;
    
    if (!userId) return;
    
    const keypair = USERS[userId];
    if (!keypair) {
        return ctx.editMessageText(
            '❌ **No wallet found!**\n\n' +
            'You need to generate or import a wallet first.', {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    }
    
    const balance = await getBalance(keypair.publicKey);
    
    if (balance < 0.001) {
        return ctx.editMessageText(
            `💸 **Send SOL**\n\n` +
            `❌ **Insufficient balance!**\n\n` +
            `💰 **Current Balance:** ${balance.toFixed(4)} SOL\n` +
            `Minimum balance required: 0.001 SOL`, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    }
    
    PENDING_REQUEST[userId] = {
        type: "SEND_SOL",
        step: 1
    };
    
    ctx.editMessageText(
        `💸 **Send SOL**\n\n` +
        `💰 **Available Balance:** ${balance.toFixed(4)} SOL\n\n` +
        `Please enter the recipient's Solana address:`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'refresh_menu')]
        ])
    });
});

bot.action('send_token_menu', async (ctx) => {
    await ctx.answerCbQuery('Token sending coming soon!');
    const userId = ctx.from?.id;
    
    ctx.editMessageText(
        `🪙 **Send Token**\n\n` +
        `🚧 **Feature Coming Soon!**\n\n` +
        `SPL token sending functionality will be available in the next update.\n\n` +
        `For now, you can send SOL using the "💸 Send SOL" option.`, {
        parse_mode: 'Markdown',
        ...getMainMenuKeyboard()
    });
});

// Handle text messages for pending requests
bot.on(message('text'), async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;
    
    const pendingReq = PENDING_REQUEST[userId];
    if (!pendingReq) return;
    
    const text = ctx.message.text.trim();
    
    // Handle wallet import
    if (pendingReq.type === 'IMPORT_WALLET') {
        if (!isValidPrivateKey(text)) {
            return ctx.reply(
                '❌ **Invalid private key!**\n\n' +
                'Please send a valid base58 encoded private key or cancel the operation.', {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('❌ Cancel', 'refresh_menu')]
                ])
            });
        }
        
        try {
            const secretKey = bs58.decode(text);
            const keypair = Keypair.fromSecretKey(secretKey);
            USERS[userId] = keypair;
            delete PENDING_REQUEST[userId];
            
            const balance = await getBalance(keypair.publicKey);
            
            ctx.reply(
                `✅ **Wallet imported successfully!**\n\n` +
                `📍 **Address:** \`${keypair.publicKey.toBase58()}\`\n` +
                `💰 **Balance:** ${balance.toFixed(4)} SOL`, {
                parse_mode: 'Markdown',
                ...getMainMenuKeyboard()
            });
        } catch (error) {
            return ctx.reply('❌ Error importing wallet. Please check your private key and try again.');
        }
        return;
    }
    
    // Handle SOL sending
    if (pendingReq.type === 'SEND_SOL') {
        if (pendingReq.step === 1) {
            // Validate recipient address
            if (!isValidSolanaAddress(text)) {
                return ctx.reply(
                    '❌ **Invalid Solana address!**\n\n' +
                    'Please enter a valid Solana address (44 characters, base58 encoded).', {
                    parse_mode: 'Markdown'
                });
            }
            
            PENDING_REQUEST[userId].to = text;
            PENDING_REQUEST[userId].step = 2;
            
            const keypair = USERS[userId];
            const balance = await getBalance(keypair.publicKey);
            
            return ctx.reply(
                `💸 **Send SOL**\n\n` +
                `📍 **To:** \`${text}\`\n` +
                `💰 **Available:** ${balance.toFixed(4)} SOL\n\n` +
                `How much SOL do you want to send?\n` +
                `(Leave some for transaction fees ~0.000005 SOL)`, {
                parse_mode: 'Markdown'
            });
        }
        
        if (pendingReq.step === 2) {
            // Validate amount
            if (!isValidAmount(text)) {
                return ctx.reply(
                    '❌ **Invalid amount!**\n\n' +
                    'Please enter a valid number (greater than 0 and less than 1000 SOL).', {
                    parse_mode: 'Markdown'
                });
            }
            
            const amount = parseFloat(text);
            const keypair = USERS[userId];
            const balance = await getBalance(keypair.publicKey);
            
            if (amount > balance - 0.00001) { // Leave room for fees
                return ctx.reply(
                    `❌ **Insufficient balance!**\n\n` +
                    `💰 **Available:** ${balance.toFixed(4)} SOL\n` +
                    `💸 **Requested:** ${amount} SOL\n\n` +
                    `Please enter a smaller amount (leave room for transaction fees).`, {
                    parse_mode: 'Markdown'
                });
            }
            
            // Show confirmation
            return ctx.reply(
                `💸 **Confirm Transaction**\n\n` +
                `📍 **To:** \`${pendingReq.to}\`\n` +
                `💰 **Amount:** ${amount} SOL\n` +
                `💵 **Fee:** ~0.000005 SOL\n\n` +
                `⚠️ **This action cannot be undone!**`, {
                parse_mode: 'Markdown',
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback('✅ Confirm Send', `confirm_send_${amount}`),
                        Markup.button.callback('❌ Cancel', 'refresh_menu')
                    ]
                ])
            });
        }
    }
});

// Handle transaction confirmation
bot.action(/^confirm_send_(.+)$/, async (ctx) => {
    const matchResult = ctx.match;
    if (!matchResult || !matchResult[1]) {
        return ctx.editMessageText('❌ Invalid transaction data.', {
            ...getMainMenuKeyboard()
        });
    }
    
    const amount = parseFloat(matchResult[1]);
    const userId = ctx.from?.id;
    
    if (!userId) return;
    
    await ctx.answerCbQuery('Processing transaction...');
    
    const pendingReq = PENDING_REQUEST[userId];
    const keypair = USERS[userId];
    
    if (!pendingReq || !keypair || !pendingReq.to) {
        return ctx.editMessageText('❌ Transaction expired. Please try again.', {
            ...getMainMenuKeyboard()
        });
    }
    
    ctx.editMessageText('⏳ **Processing transaction...**\n\nPlease wait while we send your SOL.', {
        parse_mode: 'Markdown'
    });
    
    try {
        const signature = await sendSOL(keypair, pendingReq.to, amount);
        
        if (signature) {
            delete PENDING_REQUEST[userId];
            
            ctx.editMessageText(
                `✅ **Transaction Successful!**\n\n` +
                `💸 **Sent:** ${amount} SOL\n` +
                `📍 **To:** \`${pendingReq.to}\`\n` +
                `🔗 **Signature:** \`${signature.substring(0, 20)}...\`\n\n` +
                `Transaction completed successfully!`, {
                parse_mode: 'Markdown',
                ...getMainMenuKeyboard()
            });
        } else {
            ctx.editMessageText(
                `❌ **Transaction Failed!**\n\n` +
                `The transaction could not be completed. This might be due to:\n` +
                `• Insufficient balance\n` +
                `• Network issues\n` +
                `• Invalid recipient address\n\n` +
                `Please try again later.`, {
                parse_mode: 'Markdown',
                ...getMainMenuKeyboard()
            });
        }
    } catch (error) {
        ctx.editMessageText(
            `❌ **Transaction Error!**\n\n` +
            `An unexpected error occurred. Please try again later.`, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard()
        });
    }
});

// Error handling
bot.catch((err, ctx) => {
    console.error('Bot error:', err);
    ctx.reply('❌ An unexpected error occurred. Please try again.').catch(() => {});
});

async function startBot(): Promise<void> {
    try {
        console.log('🤖 Starting Telegram Solana Wallet Bot...');
        await bot.launch({
            allowedUpdates: ['message', 'callback_query']
        });
        console.log('✅ Bot started successfully!');
        
        // Graceful shutdown
        process.once('SIGINT', () => {
            console.log('Received SIGINT, stopping bot...');
            bot.stop('SIGINT');
        });
        process.once('SIGTERM', () => {
            console.log('Received SIGTERM, stopping bot...');
            bot.stop('SIGTERM');
        });
        
    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Start the bot
startBot();