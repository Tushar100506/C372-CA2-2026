// models/userModel.js
// All database operations related to the "users" table

const db = require('../db'); // use the shared MySQL connection

const User = {
    /**
     * Create a new user in the database.
     * @param {Object} userData - user fields from the registration form
     * @param {Function} callback - callback(err, result)
     */
    create(userData, callback) {
        const { username, email, password, address, contact, role } = userData;

        const sql = `
            INSERT INTO users (username, email, password, address, contact, role)
            VALUES (?, ?, SHA1(?), ?, ?, ?)
        `;

        db.query(
            sql,
            [username, email, password, address, contact, role],
            (err, result) => {
                if (err) return callback(err);
                callback(null, result);
            }
        );
    },

    /**
     * Find a user by email + password (used during login).
     * @param {string} email
     * @param {string} password - plain text; hashed in SQL using SHA1
     * @param {Function} callback - callback(err, rows)
     */
    findByEmailAndPassword(email, password, callback) {
        const sql = `
            SELECT * FROM users
            WHERE email = ? AND password = SHA1(?)
        `;

        db.query(sql, [email, password], (err, rows) => {
            if (err) return callback(err);
            callback(null, rows);
        });
    }
};

module.exports = User;  