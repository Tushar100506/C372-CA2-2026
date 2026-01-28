// models/productModel.js
// All database operations for "products"

const db = require('../db'); // shared MySQL connection

const Product = {
    /**
     * Get all products from the database.
     */
    getAll(callback) {
        const sql = 'SELECT * FROM products';
        db.query(sql, (err, results) => {
            if (err) return callback(err);
            callback(null, results);
        });
    },

    /**
     * Get a single product by its ID.
     */
    getById(id, callback) {
        const sql = 'SELECT * FROM products WHERE id = ?';
        db.query(sql, [id], (err, results) => {
            if (err) return callback(err);
            callback(null, results[0]); // return first row or undefined
        });
    },

    /**
     * Create a new product.
     */
    create(productData, callback) {
        const { productName, quantity, price, image } = productData;

        const sql = `
            INSERT INTO products (productName, quantity, price, image)
            VALUES (?, ?, ?, ?)
        `;

        db.query(sql, [productName, quantity, price, image], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },

    /**
     * Update an existing product by ID.
     */
    update(id, productData, callback) {
        const { productName, quantity, price, image } = productData;

        const sql = `
            UPDATE products
            SET productName = ?, quantity = ?, price = ?, image = ?
            WHERE id = ?
        `;

        db.query(sql, [productName, quantity, price, image, id], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },

    /**
     * Delete a product by ID.
     */
    delete(id, callback) {
        const sql = 'DELETE FROM products WHERE id = ?';
        db.query(sql, [id], (err, result) => {
            if (err) return callback(err);
            callback(null, result);
        });
    },

    /**
     * Reduce product quantity after purchase.
     * @param {number} productId - ID of the product
     * @param {number} quantityToReduce - Amount to reduce
     * @param {Function} callback - callback(err, result)
     */
    reduceQuantity(productId, quantityToReduce, callback) {
        console.log(`🔄 reduceQuantity: Reducing product ${productId} by ${quantityToReduce}`);
        const sql = `
            UPDATE products
            SET quantity = quantity - ?
            WHERE id = ? AND quantity >= ?
        `;

        db.query(sql, [quantityToReduce, productId, quantityToReduce], (err, result) => {
            if (err) {
                console.error(`❌ Database error reducing quantity for product ${productId}:`, err);
                return callback(err);
            }
            
            // Check if update was successful (if no rows affected, not enough stock)
            if (result.affectedRows === 0) {
                console.error(`⚠️  No rows affected for product ${productId} - possibly insufficient stock`);
                return callback(new Error('Insufficient stock for product ID: ' + productId));
            }
            
            console.log(`✅ Successfully updated product ${productId}, rows affected: ${result.affectedRows}`);
            callback(null, result);
        });
    }
};

module.exports = Product;