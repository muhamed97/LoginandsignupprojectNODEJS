const express = require('express');

module.exports = (db, JWT_SECRET, bcrypt, generateAccountNumber) => {
  const router = express.Router();

  // Register user
  router.post('/register', async (req, res) => {
    try {
      const { username, email, password, firstName, lastName, phone, address } = req.body;
      
      // Validation
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required',
          code: 'MISSING_FIELDS'
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'Password must be at least 6 characters long',
          code: 'WEAK_PASSWORD'
        });
      }

      // Check if user already exists
      const existingUser = await new Promise((resolve, reject) => {
        db.query(
          "SELECT id FROM users WHERE username = ? OR email = ?",
          [username, email],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      if (existingUser.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Username or email already exists',
          code: 'USER_EXISTS'
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);
      const accountNumber = generateAccountNumber();

      // Create user
      const result = await new Promise((resolve, reject) => {
        db.query(
          "INSERT INTO users (username, email, password, first_name, last_name, phone, address, account_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [username, email, hashedPassword, firstName, lastName, phone, address, accountNumber],
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: {
          userId: result.insertId,
          accountNumber: accountNumber
        }
      });

    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        success: false,
        error: 'Registration failed',
        code: 'REGISTRATION_ERROR'
      });
    }
  });

  // Login user
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      }

      // Find user
      const users = await new Promise((resolve, reject) => {
        db.query(
          "SELECT * FROM users WHERE username = ? AND is_active = TRUE",
          [username],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      if (users.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      const user = users[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          id: user.id, 
          username: user.username,
          accountNumber: user.account_number
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          token: token,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            accountNumber: user.account_number,
            firstName: user.first_name,
            lastName: user.last_name,
            balance: user.balance
          }
        }
      });

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Login failed',
        code: 'LOGIN_ERROR'
      });
    }
  });

  // Verify token
  router.get('/verify', (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
        code: 'NO_TOKEN'
      });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          error: 'Invalid token',
          code: 'INVALID_TOKEN'
        });
      }

      res.json({
        success: true,
        data: { user: decoded }
      });
    });
  });

  return router;
};

