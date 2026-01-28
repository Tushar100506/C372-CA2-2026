// config/paypal.js
// PayPal Sandbox Configuration

// ⚠️ SECURITY NOTE: In production, store these in environment variables (.env file)
// Never hardcode credentials in your source code!

const paypalConfig = {
    mode: 'sandbox', // Use 'sandbox' for testing, 'live' for production
    client_id: 'AdQopERq3EUcOXLcZz4p4Ce6Cwc7m6xwSILLES725Q4Fd9fDakR8-sBP3F-NYPjPXiGkxbo9SNwUuYOa',
    client_secret: 'EBaX-6i-qPwow_2x6uhaYofx556bK4xucNFOqWw4nHBPXo3yT9K37XLE5248SnDNvHHgtQsewHyymz6e',
    
    // Test accounts
    test_buyer_email: 'sb-nny47c48554963@personal.example.com',
    test_buyer_password: 'tZU=G2vU'
};

module.exports = paypalConfig;
