// controllers/productController.js
// Handles product listing, inventory, and product CRUD

const Product = require('../models/productModel');

const productController = {
    /**
     * Show shopping page for normal users.
     */
    showShopping(req, res) {
        Product.getAll((err, products) => {
            if (err) {
                console.error('Error fetching products for shopping:', err);
                req.flash('error', 'Unable to load products at the moment.');
                return res.redirect('/');
            }

            res.render('shopping', {
                products,
                user: req.session.user
            });
        });
    },

    /**
     * Show inventory page for admin.
     */
    showInventory(req, res) {
        Product.getAll((err, products) => {
            if (err) {
                console.error('Error fetching inventory:', err);
                req.flash('error', 'Unable to load inventory at the moment.');
                return res.redirect('/');
            }

            res.render('inventory', {
                products,
                user: req.session.user
            });
        });
    },

    /**
     * Show form to add a new product.
     */
    showAddProductForm(req, res) {
        res.render('addProduct', {
            user: req.session.user,
            errors: req.flash('error'),
            messages: req.flash('success')
        });
    },

    /**
     * Handle add product form submission.
     * Assumes multer already handled file upload (req.file).
     */
    addProduct(req, res) {
        const { productName, quantity, price } = req.body;
        const image = req.file ? req.file.filename : null;

        // Basic validation
        if (!productName || !quantity || !price) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/addProduct');
        }

        const productData = {
            productName,
            quantity: parseInt(quantity),
            price: parseFloat(price),
            image
        };

        Product.create(productData, (err, result) => {
            if (err) {
                console.error('Error adding product:', err);
                req.flash('error', 'Error adding product.');
                return res.redirect('/addProduct');
            }

            req.flash('success', 'Product added successfully.');
            res.redirect('/inventory');
        });
    },

    /**
     * Show form to update an existing product.
     */
    showUpdateProductForm(req, res) {
        const productId = parseInt(req.params.id);

        Product.getById(productId, (err, product) => {
            if (err) {
                console.error('Error fetching product:', err);
                req.flash('error', 'Error loading product details.');
                return res.redirect('/inventory');
            }

            if (!product) {
                req.flash('error', 'Product not found.');
                return res.redirect('/inventory');
            }

            res.render('updateProduct', {
                product,
                user: req.session.user,
                errors: req.flash('error'),
                messages: req.flash('success')
            });
        });
    },

    /**
     * Handle update product form submission.
     * Assumes multer already handled file upload (req.file).
     */
    updateProduct(req, res) {
        const productId = parseInt(req.params.id);
        const { productName, quantity, price, existingImage } = req.body;

        // Use new uploaded image if present, else keep existing image
        const image = req.file ? req.file.filename : existingImage;

        if (!productName || !quantity || !price) {
            req.flash('error', 'All fields are required.');
            return res.redirect('/updateProduct/' + productId);
        }

        const productData = {
            productName,
            quantity: parseInt(quantity),
            price: parseFloat(price),
            image
        };

        Product.update(productId, productData, (err, result) => {
            if (err) {
                console.error('Error updating product:', err);
                req.flash('error', 'Error updating product.');
                return res.redirect('/updateProduct/' + productId);
            }

            req.flash('success', 'Product updated successfully.');
            res.redirect('/inventory');
        });
    },

    /**
     * Delete a product (admin only).
     */
    deleteProduct(req, res) {
        const productId = parseInt(req.params.id);

        Product.delete(productId, (err, result) => {
            if (err) {
                console.error('Error deleting product:', err);
                req.flash('error', 'Error deleting product.');
                return res.redirect('/inventory');
            }

            req.flash('success', 'Product deleted successfully.');
            res.redirect('/inventory');
        });
    }
};

module.exports = productController;