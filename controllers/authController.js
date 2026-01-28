// controllers/authController.js
// Handles registration, login, logout logic

const User = require('../models/userModel');
const Cart = require('../models/cartModel');

const authController = {
    /**
     * Show registration page
     */
    showRegister(req, res) {
        // "messages" = error messages; "formData" = previous form input
        res.render('register', {
            messages: req.flash('error'),
            formData: req.flash('formData')[0]
        });
    },

    /**
     * Handle registration form submission.
     * Assumes validateRegistration middleware already ran.
     */
    register(req, res) {
        const { username, email, password, address, contact, role } = req.body;

        // Call model to insert user
        User.create({ username, email, password, address, contact, role }, (err, result) => {
            if (err) {
                console.error('Error registering user:', err);
                req.flash('error', 'An error occurred during registration.');
                req.flash('formData', req.body);
                return res.redirect('/register');
            }

            console.log('New user created:', result.insertId);
            req.flash('success', 'Registration successful! Please log in.');
            res.redirect('/login');
        });
    },

    /**
     * Show login page
     */
    showLogin(req, res) {
        res.render('login', {
            messages: req.flash('success'),  // success messages (e.g. after register)
            errors: req.flash('error')       // login errors
        });
    },

    /**
     * Handle login form submission
     */
    login(req, res) {
        const { email, password } = req.body;

        // Basic validation for empty fields
        if (!email || !password) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/login');
        }

        // Look up user in DB via model
        User.findByEmailAndPassword(email, password, (err, rows) => {
            if (err) {
                console.error('Error during login:', err);
                req.flash('error', 'An error occurred during login.');
                return res.redirect('/login');
            }

            if (rows.length > 0) {
                // Successful login
                req.session.user = rows[0];
                req.flash('success', 'Login successful!');

                // Load cart from database for this user
                Cart.loadCart(req.session.user.id, (err, cartItems) => {
                    if (err) {
                        console.error('Error loading cart:', err);
                        // Continue even if cart loading fails
                    } else {
                        req.session.cart = cartItems || [];
                    }

                    // Redirect based on role
                    if (req.session.user.role === 'user') {
                        return res.redirect('/shopping');
                    } else {
                        return res.redirect('/inventory');
                    }
                });
            } else {
                // Invalid credentials
                req.flash('error', 'Invalid email or password.');
                return res.redirect('/login');
            }
        });
    },

    /**
     * Logout and destroy the session
     * Save cart to database before logging out
     */
    logout(req, res) {
        const user = req.session.user;
        const cart = req.session.cart || [];

        // Save cart to database before destroying session
        if (user) {
            Cart.saveCart(user.id, cart, (err) => {
                if (err) {
                    console.error('Error saving cart before logout:', err);
                }
                // Destroy session regardless of save status
                req.session.destroy(() => {
                    res.redirect('/');
                });
            });
        } else {
            // No user logged in, just destroy session
            req.session.destroy(() => {
                res.redirect('/');
            });
        }
    }
};

module.exports = authController;