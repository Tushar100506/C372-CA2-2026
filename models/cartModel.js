// models/cartModel.js
// All database operations for shopping cart

const db = require('../db');

const Cart = {
    /**
     * Save cart items for a user to the database.
     * Clears existing cart and inserts new items.
     *
     * @param {number} userId - ID of the user
     * @param {Array} cartItems - array of cart items
     * @param {Function} callback - callback(err)
     */
    saveCart(userId, cartItems, callback) {
        // First, clear existing cart for this user
        const deleteSql = 'DELETE FROM cart_items WHERE userId = ?';

        db.query(deleteSql, [userId], (err) => {
            if (err) return callback(err);

            // If cart is empty, we're done
            if (!cartItems || cartItems.length === 0) {
                return callback(null);
            }

            // Insert new cart items
            const insertSql = `
                INSERT INTO cart_items (userId, productId, productName, quantity, price, image)
                VALUES (?, ?, ?, ?, ?, ?)
            `;

            let inserted = 0;
            let hasError = false;

            cartItems.forEach(item => {
                db.query(
                    insertSql,
                    [userId, item.id, item.productName, item.quantity, item.price, item.image],
                    (err2) => {
                        if (err2 && !hasError) {
                            hasError = true;
                            return callback(err2);
                        }

                        inserted++;

                        // When all items are inserted, call callback
                        if (!hasError && inserted === cartItems.length) {
                            callback(null);
                        }
                    }
                );
            });
        });
    },

    /**
     * Load cart items for a user from the database.
     *
     * @param {number} userId - ID of the user
     * @param {Function} callback - callback(err, cartItems)
     */
    loadCart(userId, callback) {
        const sql = `
            SELECT productId as id, productName, quantity, price, image
            FROM cart_items
            WHERE userId = ?
            ORDER BY id
        `;

        db.query(sql, [userId], (err, results) => {
            if (err) return callback(err);
            callback(null, results || []);
        });
    },

    /**
     * Clear all cart items for a user.
     *
     * @param {number} userId - ID of the user
     * @param {Function} callback - callback(err)
     */
    clearCart(userId, callback) {
        const sql = 'DELETE FROM cart_items WHERE userId = ?';

        db.query(sql, [userId], (err) => {
            if (err) return callback(err);
            callback(null);
        });
    }
};

module.exports = Cart;
