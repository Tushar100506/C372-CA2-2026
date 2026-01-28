// models/orderModel.js
// All database operations for orders and order_items

const db = require('../db');
const Product = require('./productModel');

const Order = {
    /**
     * Create a new order from the user's cart.
     * 1. Insert into orders
     * 2. Insert each cart item into order_items
     * 3. Reduce product quantities from inventory
     *
     * @param {number} userId - ID of the logged-in user
     * @param {Array} cart - array of cart items from session
     * @param {Function} callback - callback(err, orderId)
     */
    createOrderFromCart(userId, cart, callback) {
        console.log('📋 createOrderFromCart called with userId:', userId, 'cart items:', cart.length);
        
        if (!cart || cart.length === 0) {
            return callback(new Error('Cart is empty.'));
        }

        const self = this; // Store reference to this for use in callbacks

        // Calculate order total
        const totalAmount = cart.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
        }, 0);

        console.log('💰 Order total calculated:', totalAmount);

        // Insert into orders table
        const orderSql = `
            INSERT INTO orders (userId, totalAmount)
            VALUES (?, ?)
        `;

        db.query(orderSql, [userId, totalAmount], (err, orderResult) => {
            if (err) {
                console.error('❌ Error inserting order:', err);
                return callback(err);
            }

            const orderId = orderResult.insertId;
            console.log('✅ Order inserted with ID:', orderId);

            // Insert each cart item into order_items
            const itemSql = `
                INSERT INTO order_items (orderId, productId, productName, quantity, price, lineTotal)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            let inserted = 0;
            let hasError = false;

            cart.forEach(item => {
                const lineTotal = item.price * item.quantity;

                db.query(
                    itemSql,
                    [orderId, item.id, item.productName, item.quantity, item.price, lineTotal],
                    (err2) => {
                        if (err2 && !hasError) {
                            console.error('❌ Error inserting order item:', err2);
                            hasError = true;
                            return callback(err2);
                        }

                        inserted++;
                        console.log(`✅ Order item inserted (${inserted}/${cart.length})`);

                        // When all items are inserted, update inventory
                        if (!hasError && inserted === cart.length) {
                            console.log('🔄 All order items inserted, now updating inventory...');
                            self.updateInventoryForOrder(cart, (inventoryErr) => {
                                if (inventoryErr) {
                                    console.error('❌ Error updating inventory:', inventoryErr);
                                    // Don't fail the order, just log the error
                                }
                                console.log('✅ Order creation complete, calling callback');
                                callback(null, orderId);
                            });
                        }
                    }
                );
            });
        });
    },

    /**
     * Update inventory for all items in an order.
     * Reduces the quantity of each product based on the cart items.
     *
     * @param {Array} cart - array of cart items
     * @param {Function} callback - callback(err)
     */
    updateInventoryForOrder(cart, callback) {
        console.log('🔍 updateInventoryForOrder called with cart items:', cart);
        let updated = 0;
        let hasError = false;

        cart.forEach(item => {
            console.log(`📦 Reducing quantity for product ID ${item.id}, quantity: ${item.quantity}`);
            Product.reduceQuantity(item.id, item.quantity, (err) => {
                if (err && !hasError) {
                    console.error('❌ Error reducing quantity:', err);
                    hasError = true;
                    return callback(err);
                }

                console.log(`✅ Successfully reduced quantity for product ID ${item.id}`);
                updated++;

                // When all products are updated, call callback
                if (!hasError && updated === cart.length) {
                    console.log('✅ All inventory updates completed successfully');
                    callback(null);
                }
            });
        });
    },

    /**
     * Get all orders for a specific user.
     */
    getOrdersByUser(userId, callback) {
        const sql = `
            SELECT id, orderDate, totalAmount
            FROM orders
            WHERE userId = ?
            ORDER BY orderDate DESC
        `;

        db.query(sql, [userId], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    },

    /**
     * Get one order (header) ensuring it belongs to this user.
     */
    getOrderByIdAndUser(orderId, userId, callback) {
        const sql = `
            SELECT id, userId, orderDate, totalAmount
            FROM orders
            WHERE id = ? AND userId = ?
        `;

        db.query(sql, [orderId, userId], (err, results) => {
            if (err) return callback(err);
            callback(null, results[0]); // might be undefined if not found
        });
    },

    /**
     * Get all items for a specific order.
     */
    getOrderItems(orderId, callback) {
        const sql = `
            SELECT productId, productName, quantity, price, lineTotal
            FROM order_items
            WHERE orderId = ?
        `;

        db.query(sql, [orderId], (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    },

    /**
     * Create a simple order without cart.
     * Used for Stripe and other direct payment methods.
     *
     * @param {number} userId - ID of the user
     * @param {number} totalAmount - Total amount of the order
     * @param {Function} callback - callback(err, orderId)
     */
    createOrder(userId, totalAmount, callback) {
        const orderSql = `
            INSERT INTO orders (userId, totalAmount)
            VALUES (?, ?)
        `;

        db.query(orderSql, [userId, totalAmount], (err, orderResult) => {
            if (err) {
                console.error('Error inserting order:', err);
                return callback(err);
            }

            const orderId = orderResult.insertId;
            console.log('Order inserted with ID:', orderId);
            callback(null, orderId);
        });
    },

    /**
     * Add an order item to an existing order.
     * Used for Stripe and other direct payment methods.
     *
     * @param {number} orderId - ID of the order
     * @param {number} productId - ID of the product
     * @param {string} productName - Name of the product
     * @param {number} quantity - Quantity ordered
     * @param {number} price - Price per unit
     * @param {Function} callback - callback(err)
     */
    addOrderItem(orderId, productId, productName, quantity, price, callback) {
        const lineTotal = quantity * price;
        const itemSql = `
            INSERT INTO order_items (orderId, productId, productName, quantity, price, lineTotal)
            VALUES (?, ?, ?, ?, ?, ?)
        `;

        db.query(itemSql, [orderId, productId, productName, quantity, price, lineTotal], (err) => {
            if (err) {
                console.error('Error inserting order item:', err);
                return callback(err);
            }

            console.log('Order item inserted');
            callback(null);
        });
    }
};

module.exports = Order;