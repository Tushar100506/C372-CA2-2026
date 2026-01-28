// db.js
// Central place for MySQL connection
require('dotenv').config();
const mysql = require('mysql2');

// Create a single shared connection for the whole app
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,              // same as your current app.js
    database: process.env.DB_NAME
});

// Connect and log status
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Export the connection so models and app.js can use it
module.exports = connection;