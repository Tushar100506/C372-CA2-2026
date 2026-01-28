// controllers/cartController.js
// Handles cart display and operations (add, update, remove, clear)

const Product = require('../models/productModel');
const Cart = require('../models/cartModel');

const cartController = {
    /**
     * Show cart page.
     * Loads cart from database if user is logged in.
     */
    showCart(req, res) {
        const user = req.session.user;
        
        // If user is not logged in, show empty cart
        if (!user) {
            return res.render('cart', {
                cart: [],
                total: 0,
                user: null,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        }

        // Load cart from database
        Cart.loadCart(user.id, (err, cartItems) => {
            if (err) {
                console.error('Error loading cart from database:', err);
                req.flash('error', 'Error loading your cart.');
                return res.render('cart', {
                    cart: [],
                    total: 0,
                    user,
                    messages: req.flash('success'),
                    errors: req.flash('error')
                });
            }

            // Also maintain session cart for this request
            req.session.cart = cartItems;

            // Calculate total
            const total = cartItems.reduce((sum, item) => {
                return sum + (item.price * item.quantity);
            }, 0);

            res.render('cart', {
                cart: cartItems,
                total: total,
                user,
                messages: req.flash('success'),
                errors: req.flash('error')
            });
        });
    },

    /**
     * Add a product to the cart by product ID.
     * Ensures users cannot exceed available stock.
     * Saves cart to database.
     */
    addToCart(req, res) {
        const user = req.session.user;
        const productId = parseInt(req.params.id);
        const quantityToAdd = Math.max(parseInt(req.body.quantity) || 1, 1);

        Product.getById(productId, (err, product) => {
            if (err) {
                console.error('Error fetching product for cart:', err);
                req.flash('error', 'Error adding product to cart.');
                return res.redirect('/shopping');
            }

            if (!product) {
                req.flash('error', 'Product not found.');
                return res.redirect('/shopping');
            }

            const availableStock = product.quantity; // stock from DB

            // Make sure cart exists in session
            if (!req.session.cart) {
                req.session.cart = [];
            }

            // Find if product already exists in cart
            const existingItem = req.session.cart.find(item => item.id === productId);

            // Current quantity in cart
            const currentQtyInCart = existingItem ? existingItem.quantity : 0;
            const requestedTotalQty = currentQtyInCart + quantityToAdd;

            // If requested quantity exceeds stock, cap or block
            if (requestedTotalQty > availableStock) {
                const maxAddable = Math.max(availableStock - currentQtyInCart, 0);

                if (maxAddable > 0) {
                    // Allow only the remaining quantity
                    if (existingItem) {
                        existingItem.quantity = availableStock;
                    } else {
                        req.session.cart.push({
                            id: product.id,
                            productName: product.productName,
                            price: product.price,
                            quantity: maxAddable,
                            image: product.image
                        });
                    }

                    req.flash(
                        'error',
                        `Only ${availableStock} unit(s) of ${product.productName} available. Your cart has been updated to the maximum allowed.`
                    );
                } else {
                    // No stock left to add
                    req.flash(
                        'error',
                        `You already have the maximum available quantity of ${product.productName} in your cart.`
                    );
                }

                // Save cart to database
                Cart.saveCart(user.id, req.session.cart, (err) => {
                    if (err) {
                        console.error('Error saving cart to database:', err);
                    }
                    return res.redirect('/cart');
                });
                return;
            }

            // Within stock → add/update normally
            if (existingItem) {
                existingItem.quantity = requestedTotalQty;
            } else {
                req.session.cart.push({
                    id: product.id,
                    productName: product.productName,
                    price: product.price,
                    quantity: quantityToAdd,
                    image: product.image
                });
            }

            // Save cart to database
            Cart.saveCart(user.id, req.session.cart, (err) => {
                if (err) {
                    console.error('Error saving cart to database:', err);
                    req.flash('error', 'Error saving cart. Please try again.');
                    return res.redirect('/cart');
                }

                req.flash('success', `${product.productName} added to cart.`);
                res.redirect('/cart');
            });
        });
    },

    /**
     * Update quantity of an item in the cart.
     * Also enforces stock limit.
     * Saves cart to database.
     */
    updateCartItem(req, res) {
        const user = req.session.user;
        const productId = parseInt(req.params.id);
        let newQuantity = parseInt(req.body.quantity);

        if (!req.session.cart) {
            req.flash('error', 'Your cart is empty.');
            return res.redirect('/cart');
        }

        const item = req.session.cart.find(p => p.id === productId);

        if (!item) {
            req.flash('error', 'Item not found in cart.');
            return res.redirect('/cart');
        }

        // If quantity <= 0, remove item
        if (!newQuantity || newQuantity <= 0) {
            req.session.cart = req.session.cart.filter(p => p.id !== productId);
            
            // Save to database
            Cart.saveCart(user.id, req.session.cart, (err) => {
                if (err) {
                    console.error('Error saving cart to database:', err);
                }
                req.flash('success', 'Item removed from cart.');
                return res.redirect('/cart');
            });
            return;
        }

        // Check stock with DB
        Product.getById(productId, (err, product) => {
            if (err) {
                console.error('Error fetching product for cart update:', err);
                req.flash('error', 'Error updating cart.');
                return res.redirect('/cart');
            }

            if (!product) {
                req.flash('error', 'Product not found.');
                return res.redirect('/cart');
            }

            const availableStock = product.quantity;

            if (newQuantity > availableStock) {
                // Clamp to max stock
                item.quantity = availableStock;
                
                // Save to database
                Cart.saveCart(user.id, req.session.cart, (err) => {
                    if (err) {
                        console.error('Error saving cart to database:', err);
                    }
                    req.flash(
                        'error',
                        `Only ${availableStock} unit(s) of ${product.productName} available. Quantity has been adjusted.`
                    );
                    return res.redirect('/cart');
                });
                return;
            }

            // Within stock → normal update
            item.quantity = newQuantity;
            
            // Save to database
            Cart.saveCart(user.id, req.session.cart, (err) => {
                if (err) {
                    console.error('Error saving cart to database:', err);
                    req.flash('error', 'Error saving cart. Please try again.');
                    return res.redirect('/cart');
                }
                req.flash('success', 'Cart updated successfully.');
                res.redirect('/cart');
            });
        });
    },

    /**
     * Remove a single item from the cart.
     * Saves cart to database.
     */
    removeCartItem(req, res) {
        const user = req.session.user;
        const productId = parseInt(req.params.id);

        if (!req.session.cart) {
            req.flash('error', 'Your cart is already empty.');
            return res.redirect('/cart');
        }

        const originalLength = req.session.cart.length;
        req.session.cart = req.session.cart.filter(p => p.id !== productId);

        if (req.session.cart.length < originalLength) {
            // Save to database
            Cart.saveCart(user.id, req.session.cart, (err) => {
                if (err) {
                    console.error('Error saving cart to database:', err);
                }
                req.flash('success', 'Item removed from cart.');
                return res.redirect('/cart');
            });
        } else {
            req.flash('error', 'Item not found in cart.');
            res.redirect('/cart');
        }
    },

    /**
     * Clear the whole cart.
     * Saves cleared cart to database.
     */
    clearCart(req, res) {
        const user = req.session.user;
        req.session.cart = [];
        
        // Clear from database
        Cart.clearCart(user.id, (err) => {
            if (err) {
                console.error('Error clearing cart from database:', err);
                req.flash('error', 'Error clearing cart. Please try again.');
                return res.redirect('/cart');
            }
            req.flash('success', 'Your cart has been cleared.');
            res.redirect('/cart');
        });
    }
};

module.exports = cartController;