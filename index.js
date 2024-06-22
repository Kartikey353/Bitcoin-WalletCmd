const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const bip39 = require('bip39');
const BIP32 = require('bip32');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const bip32 = BIP32.BIP32Factory(ecc);

const app = express();
const port = 5000;

app.use(bodyParser.json());

app.post('/importWallet', (req, res) => {
    const {mnemonic } = req.query;
    if (!mnemonic) {
        return res.status(400).send('Missing wallet  mnemonic');
    }
    const seed = bip39.mnemonicToSeedSync(mnemonic); 
    const network = bitcoin.networks.testnet; // Change to bitcoin.networks.bitcoin for Mainnet
    const root = bip32.fromSeed(seed, network);
    const path = "m/44'/1'/0'/0/0"; // Change according to your needs
    const addressNode = root.derivePath(path);
    const privateKey = addressNode.toWIF();
    const { address } = bitcoin.payments.p2pkh({ pubkey: addressNode.publicKey, network });
    res.send({
        message: `Wallet  imported successfully`,
        address,
        privateKey
    });
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
