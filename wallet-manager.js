const fs = require('fs');
const axios = require('axios');
const bip39 = require('bip39');
const bitcoin = require('bitcoinjs-lib');
const BIP32 = require('bip32');
const ecc = require('tiny-secp256k1');
const bip32 = BIP32.BIP32Factory(ecc);
require('dotenv').config();

const STORAGE_DIR = './wallets/';

if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR);
}

function getWalletPath(walletName) {
    return `${STORAGE_DIR}${walletName}.json`;
}

function createWallet(walletName) {
    const mnemonic = bip39.generateMnemonic();
    const walletData = {
        walletName,
        mnemonic,
    };

    fs.writeFileSync(getWalletPath(walletName), JSON.stringify(walletData, null, 2));
    console.log(`Created wallet: ${walletName}`);
}

function importWallet(walletName, mnemonic) {
    const walletData = {
        walletName,
        mnemonic,
    }; 
    const seed = bip39.mnemonicToSeedSync(mnemonic); 
    const networks = bitcoin.networks.testnet;
    const root = bip32.fromSeed(seed,networks);
    const path = "m/44'/1'/0'/0/0"; 
    const addressNode = root.derivePath(path);  
    const privateKey = addressNode.toWIF();
    const { address } = bitcoin.payments.p2pkh({ pubkey: addressNode.publicKey, networks });
    console.log(address);
    fs.writeFileSync(getWalletPath(walletName), JSON.stringify(walletData, null, 2));

    console.log(`Imported wallet: ${walletName}`);
}

function listWallets() {
    const walletFiles = fs.readdirSync(STORAGE_DIR);
    console.log('Wallets:');
    walletFiles.forEach((walletFile) => {
        const walletName = walletFile.replace('.json', '');
        console.log(walletName);
    });
}

async function getBitcoinBalance(walletName) {
    const walletPath = getWalletPath(walletName);
    if (!fs.existsSync(walletPath)) {
        console.log(`Wallet ${walletName} not found.`);
        return;
    }

    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));

    // Check if the wallet data contains an 'address' field
    if (!walletData.address) {
        console.log(`Wallet ${walletName} does not have a valid address.`);
        return;
    }

    const address = walletData.address;
    const response = await axios.get(`https://api.blockcypher.com/v1/btc/main/addrs/${address}/balance?token=${process.env.BLOCKCYPHER_API_KEY}`);
    const balance = response.data.balance;

    console.log(`Bitcoin balance for wallet ${walletName}: ${balance} satoshis`);
}


async function listBitcoinTransactions(walletName) {
    const walletPath = getWalletPath(walletName);
    if (!fs.existsSync(walletPath)) {
        console.log(`Wallet ${walletName} not found.`);
        return;
    }

    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));

    // Check if the wallet data contains an 'address' field
    if (!walletData.address) {
        console.log(`Wallet ${walletName} does not have a valid address.`);
        return;
    }

    const address = walletData.address;
    const response = await axios.get(`https://api.blockcypher.com/v1/btc/main/addrs/${address}?token=${process.env.BLOCKCYPHER_API_KEY}`);

    const transactions = response.data.txrefs;
    if (transactions === undefined) {
        console.log(`Bitcoin transactions for wallet ${walletName}: 0`);
    } else {
        // Create a file path to store the transactions
        const transactionsFilePath = `${STORAGE_DIR}${walletName}_transactions.json`;

        // Check if the old transactions file exists and delete it
        if (fs.existsSync(transactionsFilePath)) {
            fs.unlinkSync(transactionsFilePath);
        }

        // Write the new transactions data to the file
        fs.writeFileSync(transactionsFilePath, JSON.stringify(transactions, null, 2));

        console.log(`Bitcoin transactions for wallet ${walletName}:`);
        transactions.forEach((transaction) => {
            console.log(`Transaction ID: ${transaction.tx_hash}`);
            console.log(`Confirmations: ${transaction.confirmations}`);
            console.log(`Value: ${transaction.value} satoshis`);
            console.log('---');
        });

        console.log(`New transactions data stored in ${walletName}_transactions.json`);
    }
}



async function generateUnusedBitcoinAddress(walletName) {
    const walletPath = getWalletPath(walletName);
    if (!fs.existsSync(walletPath)) {
        console.log(`Wallet ${walletName} not found.`);
        return;
    }

    const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
    const mnemonic = walletData.mnemonic;
    const seed = bip39.mnemonicToSeedSync(mnemonic);
    // const root = bitcoin.HDNode.fromSeedBuffer(seed, bitcoin.networks.bitcoin);
    const root = bip32.fromSeed(seed, bitcoin.networks.bitcoin)
    let index = 0;
    let address;
    do {
        const child = root.derivePath(`m/44'/1'/0'/0/${index}`);
        const privateKey = child.privateKey;
        const chainCode = Buffer.from(child.chainCode, 'hex'); // Assuming chainCode is provided as a hexadecimal string
        const network = bitcoin.networks.bitcoin;
        const keyPair = bip32.fromPrivateKey(privateKey, chainCode, network)
        const address2 = bitcoin.payments.p2pkh({ pubkey: keyPair.publicKey });
        address = address2.address;
        index++;
    } while (await isAddressUsed(address));

    console.log(`Unused Bitcoin address for wallet ${walletName}: ${address}`);
    walletData.address = address;
    fs.writeFileSync(walletPath, JSON.stringify(walletData, null, 2));
}

async function isAddressUsed(address) {
    await axios.get(`https://api.blockcypher.com/v1/btc/test3/addrs/${address}?token=${process.env.BLOCKCYPHER_API_KEY}`).then((response) => {
        let res = JSON.stringify(response.data);
        return response.txrefs.length > 0
    }).catch((error) => {
        return error;
    });;
}

// Command-line interface
const args = process.argv.slice(2);
const command = args[0];
const walletName = args[1];
const mnemonic = args[2];

if (command === 'create') {
    createWallet(walletName);
} else if (command === 'import') {
    importWallet(walletName, mnemonic);
} else if (command === 'list') {
    listWallets();
} else if (command === 'balance') {
    getBitcoinBalance(walletName);
} else if (command === 'transactions') {
    listBitcoinTransactions(walletName);
} else if (command === 'generate-address') {
    generateUnusedBitcoinAddress(walletName);
} else {
    console.log('Invalid command.');
}
