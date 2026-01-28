const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Our own modules
const connection = require('./db');                   // shared DB connection
const authController = require('./controllers/authController'); // auth controller
const productController = require('./controllers/productController');
const cartController = require('./controllers/cartController');
const orderController = require('./controllers/orderController');
const paymentController = require('./controllers/paymentController');

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });


// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));
// enable JSON processing (for PayPal API calls)
app.use(express.json());

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    // Extra safety: in case this is ever called without checkAuthenticated
    if (!req.session.user) {
        req.flash('error', 'Please log in to view this resource');
        return res.redirect('/login');
    }

    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied. Admins only.');
        return res.redirect('/shopping');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/',  (req, res) => {
    res.render('index', {user: req.session.user} );
});
// Auth routes now handled by authController

app.get('/register', authController.showRegister);
app.post('/register', validateRegistration, authController.register);

app.get('/login', authController.showLogin);
app.post('/login', authController.login);

app.get('/logout', authController.logout);

// Product / Inventory routes (now using productController)
app.get('/shopping', checkAuthenticated, productController.showShopping);

app.get('/inventory', checkAuthenticated, checkAdmin, productController.showInventory);

app.get('/addProduct', checkAuthenticated, checkAdmin, productController.showAddProductForm);

app.post(
    '/addProduct',
    checkAuthenticated,
    checkAdmin,
    upload.single('image'),
    productController.addProduct
);

app.get(
    '/updateProduct/:id',
    checkAuthenticated,
    checkAdmin,
    productController.showUpdateProductForm
);

app.post(
    '/updateProduct/:id',
    checkAuthenticated,
    checkAdmin,
    upload.single('image'),
    productController.updateProduct
);

app.get(
    '/deleteProduct/:id',
    checkAuthenticated,
    checkAdmin,
    productController.deleteProduct
);

// Cart routes (now using cartController)
app.get('/cart', checkAuthenticated, cartController.showCart);
app.post('/add-to-cart/:id', checkAuthenticated, cartController.addToCart);
app.post('/cart/update/:id', checkAuthenticated, cartController.updateCartItem);
app.post('/cart/remove/:id', checkAuthenticated, cartController.removeCartItem);
app.post('/cart/clear', checkAuthenticated, cartController.clearCart);

// Order routes (checkout, history, invoice)
app.post('/checkout', checkAuthenticated, orderController.checkout);

app.get('/orders', checkAuthenticated, orderController.showOrderHistory);

app.get('/orders/:id', checkAuthenticated, orderController.showInvoice);

// PayPal API routes (MUST come before /product/:id route)
app.post('/api/orders', function(req, res) {
    console.log('POST /api/orders called');
    console.log('Session user:', req.session.user);
    try {
        paymentController.createOrder(req, res);
    } catch (err) {
        console.error('Route error:', err);
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders/:orderID/capture', function(req, res) {
    console.log('POST /api/orders/:orderID/capture called');
    console.log('Order ID:', req.params.orderID);
    try {
        paymentController.captureOrder(req, res);
    } catch (err) {
        console.error('Route error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Stripe payment API route
app.post('/api/stripe-payment', checkAuthenticated, function(req, res) {
    console.log('POST /api/stripe-payment called');
    console.log('User:', req.session.user);
    console.log('Body:', req.body);
    try {
        paymentController.processStripePayment(req, res);
    } catch (err) {
        console.error('Stripe payment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Generic product route (AFTER specific routes)
app.get('/product/:id', checkAuthenticated, (req, res) => {
  // Extract the product ID from the request parameters
  const productId = req.params.id;

  // Fetch data from MySQL based on the product ID
  connection.query('SELECT * FROM products WHERE id = ?', [productId], (error, results) => {
      if (error) throw error;

      // Check if any product with the given ID was found
      if (results.length > 0) {
          // Render HTML page with the product data
          res.render('product', { product: results[0], user: req.session.user  });
      } else {
          // If no product with the given ID was found, render a 404 page or handle it accordingly
          res.status(404).send('Product not found');
      }
  });
});

// Error handler
app.use(function(err, req, res, next) {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Server error', details: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
