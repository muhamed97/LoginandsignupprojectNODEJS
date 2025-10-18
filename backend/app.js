const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");
const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

// JWT Secret Key
const JWT_SECRET = "your_jwt_secret_key_change_in_production";

const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "nodejs-login", // Make sure this database exists
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to MySQL:", err);
    console.error("Please make sure MySQL is running and the database 'nodejs-login' exists");
    console.error("To fix this:");
    console.error("1. Start MySQL service: net start mysql");
    console.error("2. Create database: CREATE DATABASE nodejs-login;");
    console.error("3. Check your MySQL credentials in backend/app.js");
    return;
  }
  console.log("✅ Connected to MySQL database successfully");
  // Create users table if it doesn't exist
  const createTableQuery = `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    balance DECIMAL(10,2) DEFAULT 0.00
  )`;
  
  // Create transactions table for transaction history
  const createTransactionsTableQuery = `CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('deposit', 'withdraw') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`;
  
  db.query(createTableQuery, (err, result) => {
    if (err) {
      console.error("Error creating users table:", err);
    } else {
      console.log("Users table ready");
    }
  });
  
  db.query(createTransactionsTableQuery, (err, result) => {
    if (err) {
      console.error("Error creating transactions table:", err);
    } else {
      console.log("Transactions table ready");
    }
  });
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  console.log(`🔐 Auth attempt - Header: ${authHeader ? 'Present' : 'Missing'}, Token: ${token ? 'Present' : 'Missing'}`);

  if (!token) {
    console.log("❌ No token provided");
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log("❌ Token verification failed:", err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    console.log("✅ Token verified for user:", user.username);
    req.user = user;
    next();
  });
};

// API Routes

// Test database connection
app.get("/api/test", (req, res) => {
  console.log("🧪 Testing database connection...");
  db.query("SELECT 1 as test", (err, results) => {
    if (err) {
      console.error("❌ Database test failed:", err);
      return res.status(500).json({ error: "Database test failed", details: err.message });
    }
    console.log("✅ Database test successful");
    res.json({ success: true, message: "Database connection working", test: results[0] });
  });
});

// User Registration
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Please provide username and password." });
  }
  
  // Hash password
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: "Error hashing password." });
    
    // Store user
    db.query(
      "INSERT INTO users (username, password) VALUES (?, ?)",
      [username, hash],
      (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ error: "Username already exists." });
          }
          return res.status(500).json({ error: "Error registering user." });
        }
        res.json({ 
          success: true, 
          message: "Registration successful!",
          userId: result.insertId 
        });
      }
    );
  });
});

// User Login
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: "Please provide username and password." });
  }
  
  db.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    (err, results) => {
      if (err) return res.status(500).json({ error: "Error logging in." });
      if (results.length === 0)
        return res.status(401).json({ error: "Invalid username or password." });
      
      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
        if (err) return res.status(500).json({ error: "Error comparing passwords." });
        if (!isMatch) return res.status(401).json({ error: "Invalid username or password." });
        
        // Generate JWT token
        const token = jwt.sign(
          { id: user.id, username: user.username },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        
        res.json({
          success: true,
          token: token,
          user: {
            id: user.id,
            username: user.username,
            balance: user.balance
          }
        });
      });
    }
  );
});

// Get account balance and transactions
app.get("/api/account", authenticateToken, (req, res) => {
  const userId = req.user.id;
  console.log(`🔍 Fetching account data for user ID: ${userId}`);
  
  // Get user balance
  db.query(
    "SELECT balance FROM users WHERE id = ?",
    [userId],
    (err, results) => {
      if (err) {
        console.error("❌ Database error in account query:", err);
        console.error("❌ Error code:", err.code);
        console.error("❌ Error sqlState:", err.sqlState);
        console.error("❌ Error sqlMessage:", err.sqlMessage);
        return res.status(500).json({ error: "Database error", details: err.message, code: err.code });
      }
      
      if (results.length === 0) {
        console.error("❌ User not found with ID:", userId);
        return res.status(404).json({ error: "User not found" });
      }
      
      const balance = results[0].balance;
      console.log(`✅ User balance retrieved: $${balance}`);
      
      // Get transaction history
      db.query(
        "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
        [userId],
        (err, transactions) => {
          if (err) {
            console.error("❌ Database error in transactions query:", err);
            return res.status(500).json({ error: "Database error", details: err.message });
          }
          
          console.log(`✅ Retrieved ${transactions.length} transactions`);
          res.json({
            balance: balance,
            transactions: transactions
          });
        }
      );
    }
  );
});

// Deposit money
app.post("/api/deposit", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  
  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    
    // Get current balance
    db.query(
      "SELECT balance FROM users WHERE id = ? FOR UPDATE",
      [userId],
      (err, results) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ error: "Database error" });
          });
        }
        
        if (results.length === 0) {
          return db.rollback(() => {
            res.status(404).json({ error: "User not found" });
          });
        }
        
        const currentBalance = results[0].balance;
        const newBalance = currentBalance + amount;
        
        // Update balance
        db.query(
          "UPDATE users SET balance = ? WHERE id = ?",
          [newBalance, userId],
          (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({ error: "Database error" });
              });
            }
            
            // Record transaction
            db.query(
              "INSERT INTO transactions (user_id, type, amount, balance_after) VALUES (?, 'deposit', ?, ?)",
              [userId, amount, newBalance],
              (err) => {
                if (err) {
                  return db.rollback(() => {
                    res.status(500).json({ error: "Database error" });
                  });
                }
                
                // Commit transaction
                db.commit((err) => {
                  if (err) {
                    return db.rollback(() => {
                      res.status(500).json({ error: "Database error" });
                    });
                  }
                  
                  res.json({ 
                    success: true, 
                    newBalance: newBalance,
                    message: "Deposit successful" 
                  });
                });
              }
            );
          }
        );
      }
    );
  });
});

// Withdraw money
app.post("/api/withdraw", authenticateToken, (req, res) => {
  const userId = req.user.id;
  const { amount } = req.body;
  
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  
  // Start transaction
  db.beginTransaction((err) => {
    if (err) {
      return res.status(500).json({ error: "Database error" });
    }
    
    // Get current balance
    db.query(
      "SELECT balance FROM users WHERE id = ? FOR UPDATE",
      [userId],
      (err, results) => {
        if (err) {
          return db.rollback(() => {
            res.status(500).json({ error: "Database error" });
          });
        }
        
        if (results.length === 0) {
          return db.rollback(() => {
            res.status(404).json({ error: "User not found" });
          });
        }
        
        const currentBalance = results[0].balance;
        
        if (currentBalance < amount) {
          return db.rollback(() => {
            res.status(400).json({ error: "Insufficient funds" });
          });
        }
        
        const newBalance = currentBalance - amount;
        
        // Update balance
        db.query(
          "UPDATE users SET balance = ? WHERE id = ?",
          [newBalance, userId],
          (err) => {
            if (err) {
              return db.rollback(() => {
                res.status(500).json({ error: "Database error" });
              });
            }
            
            // Record transaction
            db.query(
              "INSERT INTO transactions (user_id, type, amount, balance_after) VALUES (?, 'withdraw', ?, ?)",
              [userId, amount, newBalance],
              (err) => {
                if (err) {
                  return db.rollback(() => {
                    res.status(500).json({ error: "Database error" });
                  });
                }
                
                // Commit transaction
                db.commit((err) => {
                  if (err) {
                    return db.rollback(() => {
                      res.status(500).json({ error: "Database error" });
                    });
                  }
                  
                  res.json({ 
                    success: true, 
                    newBalance: newBalance,
                    message: "Withdrawal successful" 
                  });
                });
              }
            );
          }
        );
      }
    );
  });
});

// Serve the main page
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

// Serve register page
app.get("/register", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

// Serve dashboard page
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Bank API server started on port ${PORT}`));
