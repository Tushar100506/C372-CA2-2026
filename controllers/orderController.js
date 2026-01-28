// controllers/orderController.js
// Handles checkout, order history, and invoice display

const Order = require('../models/orderModel');
const Cart = require('../models/cartModel');
const Product = require('../models/productModel');

const orderController = {
    /**
     * Handle checkout:
     * - Validate cart not empty
     * - Verify sufficient stock for all items
     * - Create order & order_items in DB
     * - Update inventory
     * - Clear cart from session and database
     * - Redirect to invoice page for the new order
     */
    checkout(req, res) {
        const cart = req.session.cart || [];
        const user = req.session.user;

        if (!user) {
            req.flash('error', 'You must be logged in to checkout.');
            return res.redirect('/login');
        }

        if (!cart || cart.length === 0) {
            req.flash('error', 'Your cart is empty.');
            return res.redirect('/cart');
        }

        // Validate stock availability for all items BEFORE proceeding with order
        let validated = 0;
        let hasInsufficientStock = false;
        let insufficientProductName = '';

        cart.forEach(item => {
            Product.getById(item.id, (err, product) => {
                if (err || !product) {
                    hasInsufficientStock = true;
                    insufficientProductName = item.productName;
                }
                
                // Check if there's enough stock
                if (product && product.quantity < item.quantity) {
                    hasInsufficientStock = true;
                    insufficientProductName = product.productName;
                }

                validated++;

                // After checking all items, proceed if stock is sufficient
                if (validated === cart.length) {
                    if (hasInsufficientStock) {
                        req.flash('error', `Insufficient stock for "${insufficientProductName}". Please adjust your cart.`);
                        return res.redirect('/cart');
                    }

                    // Stock is sufficient, proceed with order
                    proceedWithCheckout();
                }
            });
        });

        // Proceed with order after stock validation
        const proceedWithCheckout = () => {
            const userId = user.id;

            Order.createOrderFromCart(userId, cart, (err, orderId) => {
                if (err) {
                    console.error('Error creating order from cart:', err);
                    req.flash('error', 'There was a problem placing your order: ' + err.message);
                    return res.redirect('/cart');
                }

                // Clear cart from session
                req.session.cart = [];

                // Clear cart from database
                Cart.clearCart(userId, (cartErr) => {
                    if (cartErr) {
                        console.error('Error clearing cart from database:', cartErr);
                        // Continue anyway - order was successful
                    }

                    req.flash('success', 'Order placed successfully!');
                    // Redirect to invoice page for this order
                    res.redirect('/orders/' + orderId);
                });
            });
        };
    },

    /**
     * Show order history for the logged-in user.
     */
    showOrderHistory(req, res) {
        const user = req.session.user;

        if (!user) {
            req.flash('error', 'You must be logged in to view your orders.');
            return res.redirect('/login');
        }

        Order.getOrdersByUser(user.id, (err, orders) => {
            if (err) {
                console.error('Error fetching orders:', err);
                req.flash('error', 'Unable to load your order history.');
                return res.redirect('/');
            }

            res.render('orders', {
                user,
                orders,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        });
    },

    /**
     * Show invoice (details) for a specific order.
     * Ensures the order belongs to the logged-in user.
     */
    showInvoice(req, res) {
        const user = req.session.user;

        if (!user) {
            req.flash('error', 'You must be logged in to view invoices.');
            return res.redirect('/login');
        }

        const orderId = parseInt(req.params.id);

        // First get the order header
        Order.getOrderByIdAndUser(orderId, user.id, (err, order) => {
            if (err) {
                console.error('Error fetching order:', err);
                req.flash('error', 'Unable to load invoice.');
                return res.redirect('/orders');
            }

            if (!order) {
                req.flash('error', 'Order not found.');
                return res.redirect('/orders');
            }

            // Then get the items
            Order.getOrderItems(orderId, (err2, items) => {
                if (err2) {
                    console.error('Error fetching order items:', err2);
                    req.flash('error', 'Unable to load invoice items.');
                    return res.redirect('/orders');
                }

                res.render('invoice', {
                    user,
                    order,
                    items,
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            });
        });
    }
};

module.exports = orderController;