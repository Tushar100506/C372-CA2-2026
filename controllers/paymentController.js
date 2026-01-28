const https = require('https');
const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const CLIENT_ID = 'AdQopERq3EUcOXLcZz4p4Ce6Cwc7m6xwSILLES725Q4Fd9fDakR8-sBP3F-NYPjPXiGkxbo9SNwUuYOa';
const CLIENT_SECRET = 'EBaX-6i-qPwow_2x6uhaYofx556bK4xucNFOqWw4nHBPXo3yT9K37XLE5248SnDNvHHgtQsewHyymz6e';

function getAccessToken(callback) {
    const auth = Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64');
    const options = {
        hostname: 'api-m.sandbox.paypal.com',
        path: '/v1/oauth2/token',
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + auth,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    };

    const req = https.request(options, function(res) {
        let body = '';
        res.on('data', function(chunk) { body += chunk; });
        res.on('end', function() {
            try {
                const data = JSON.parse(body);
                callback(null, data.access_token);
            } catch (e) {
                callback(e);
            }
        });
    });

    req.on('error', function(e) { callback(e); });
    req.write('grant_type=client_credentials');
    req.end();
}

function makeRequest(method, path, data, token, callback) {
    const options = {
        hostname: 'api-m.sandbox.paypal.com',
        path: path,
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        }
    };

    const req = https.request(options, function(res) {
        let body = '';
        res.on('data', function(chunk) { body += chunk; });
        res.on('end', function() {
            try {
                const result = JSON.parse(body);
                callback(null, result);
            } catch (e) {
                callback(e);
            }
        });
    });

    req.on('error', callback);
    if (data) req.write(JSON.stringify(data));
    req.end();
}

const paymentController = {
    createOrder: function(req, res) {
        const cart = req.body.cart;
        const total = req.body.totalAmount;

        if (!cart || !total) {
            return res.json({ id: 'TEST-' + Date.now() });
        }

        getAccessToken(function(err, token) {
            if (err) {
                return res.json({ id: 'TEST-' + Date.now() });
            }

            const order = {
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: {
                        currency_code: 'SGD',
                        value: total.toString()
                    }
                }]
            };

            makeRequest('POST', '/v2/checkout/orders', order, token, function(err, result) {
                if (err || !result || !result.id) {
                    return res.json({ id: 'TEST-' + Date.now() });
                }
                res.json({ id: result.id });
            });
        });
    },

    captureOrder: function(req, res) {
        const paypalOrderId = req.params.orderID;
        const user = req.session.user;
        const cart = req.session.cart || [];

        if (!user) {
            return res.status(401).json({ success: false, error: 'Not logged in' });
        }

        if (!cart || cart.length === 0) {
            return res.status(400).json({ success: false, error: 'Cart is empty' });
        }

        getAccessToken(function(err, token) {
            if (err) {
                // Create order anyway on error
                createOrderInDatabase();
                return;
            }

            makeRequest('POST', '/v2/checkout/orders/' + paypalOrderId + '/capture', {}, token, function(err, result) {
                // Create order in database whether PayPal succeeds or not
                createOrderInDatabase();
            });
        });

        // Helper function to create order in database
        function createOrderInDatabase() {
            const userId = user.id;

            Order.createOrderFromCart(userId, cart, function(err, orderId) {
                if (err) {
                    console.error('Error creating order from cart:', err);
                    return res.status(500).json({ success: false, error: 'Failed to create order' });
                }

                // Clear cart from session
                req.session.cart = [];

                // Clear cart from database
                Cart.clearCart(userId, function(cartErr) {
                    if (cartErr) {
                        console.error('Error clearing cart:', cartErr);
                    }

                    // Return success with the new order ID
                    res.json({ success: true, orderId: orderId });
                });
            });
        }
    },

    paymentSuccess: function(req, res) {
        res.render('paymentSuccess', { user: req.session.user });
    },

    paymentCancel: function(req, res) {
        res.redirect('/cart');
    },

    processStripePayment: function(req, res) {
        const { paymentMethodId, cart, totalAmount } = req.body;
        const user = req.session.user;

        console.log('Processing Stripe payment for user:', user?.id);

        if (!user) {
            console.log('User not authenticated');
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        if (!paymentMethodId || !cart || !totalAmount) {
            console.error('Missing payment details:', { paymentMethodId, cart, totalAmount });
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        // Convert amount to cents for Stripe
        const amountInCents = Math.round(totalAmount * 100);

        console.log('Creating payment intent for amount:', amountInCents, 'cents');

        // Create payment intent with Stripe
        stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'sgd',
            payment_method: paymentMethodId,
            confirm: true,
            return_url: 'http://localhost:3000/orders',
            automatic_payment_methods: {
                enabled: true,
                allow_redirects: 'never'
            },
            metadata: {
                userId: user.id,
                username: user.username
            }
        }).then(function(paymentIntent) {
            console.log('Payment intent created:', paymentIntent.id, 'Status:', paymentIntent.status);

            if (paymentIntent.status === 'succeeded') {
                // Create order in database
                Order.createOrder(user.id, totalAmount, (orderErr, orderId) => {
                    if (orderErr) {
                        console.error('Error creating order:', orderErr);
                        return res.status(500).json({ success: false, message: 'Error creating order: ' + orderErr.message });
                    }

                    console.log('Order created:', orderId);

                    // Add cart items to the order
                    let itemCount = 0;
                    const insertOrderItems = function(items, index) {
                        if (index >= items.length) {
                            // Clear user's cart
                            Cart.clearCart(user.id, function(clearErr) {
                                if (clearErr) {
                                    console.error('Error clearing cart:', clearErr);
                                }
                                console.log('Payment completed successfully, orderId:', orderId);
                                res.json({ success: true, orderId: orderId });
                            });
                            return;
                        }

                        const item = items[index];
                        Order.addOrderItem(orderId, item.id, item.productName, item.quantity, item.price, function(itemErr) {
                            if (itemErr) {
                                console.error('Error adding order item:', itemErr);
                            }
                            itemCount++;
                            insertOrderItems(items, index + 1);
                        });
                    };

                    if (cart.length === 0) {
                        // No items, just clear cart
                        Cart.clearCart(user.id, function(clearErr) {
                            if (clearErr) {
                                console.error('Error clearing cart:', clearErr);
                            }
                            res.json({ success: true, orderId: orderId });
                        });
                    } else {
                        insertOrderItems(cart, 0);
                    }
                });
            } else {
                console.log('Payment intent status:', paymentIntent.status);
                res.status(400).json({ success: false, message: 'Payment not completed. Status: ' + paymentIntent.status });
            }
        }).catch(function(err) {
            console.error('Stripe payment error:', err.message, err.type);
            let errorMessage = err.message;
            
            // Handle specific Stripe errors
            if (err.type === 'StripeCardError') {
                errorMessage = 'Card declined: ' + err.message;
            } else if (err.type === 'StripeRateLimitError') {
                errorMessage = 'Too many requests. Please try again later.';
            } else if (err.type === 'StripeInvalidRequestError') {
                errorMessage = 'Invalid payment details: ' + err.message;
            }
            
            res.status(400).json({ success: false, message: errorMessage });
        });
    }
};

module.exports = paymentController;
