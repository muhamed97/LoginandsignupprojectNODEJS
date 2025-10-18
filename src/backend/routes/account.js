const express = require('express');

module.exports = (db, authenticateToken, generateTransactionId) => {
  const router = express.Router();

  // Get account information
  router.get('/info', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;

      const user = await new Promise((resolve, reject) => {
        db.query(
          "SELECT id, username, email, account_number, first_name, last_name, phone, balance, created_at FROM users WHERE id = ?",
          [userId],
          (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          }
        );
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({
        success: true,
        data: { user }
      });

    } catch (error) {
      console.error('Get account info error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch account information',
        code: 'ACCOUNT_INFO_ERROR'
      });
    }
  });

  // Get account balance and recent transactions
  router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;

      // Get user balance
      const user = await new Promise((resolve, reject) => {
        db.query(
          "SELECT balance, account_number FROM users WHERE id = ?",
          [userId],
          (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          }
        );
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Get recent transactions
      const transactions = await new Promise((resolve, reject) => {
        db.query(
          "SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 10",
          [userId],
          (err, results) => {
            if (err) reject(err);
            else resolve(results);
          }
        );
      });

      res.json({
        success: true,
        data: {
          balance: user.balance,
          accountNumber: user.account_number,
          transactions: transactions
        }
      });

    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data',
        code: 'DASHBOARD_ERROR'
      });
    }
  });

  // Update account information
  router.put('/update', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const { firstName, lastName, email, phone, address } = req.body;

      const updateFields = [];
      const values = [];

      if (firstName) {
        updateFields.push('first_name = ?');
        values.push(firstName);
      }
      if (lastName) {
        updateFields.push('last_name = ?');
        values.push(lastName);
      }
      if (email) {
        updateFields.push('email = ?');
        values.push(email);
      }
      if (phone) {
        updateFields.push('phone = ?');
        values.push(phone);
      }
      if (address) {
        updateFields.push('address = ?');
        values.push(address);
      }

      if (updateFields.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No fields to update',
          code: 'NO_FIELDS'
        });
      }

      values.push(userId);

      await new Promise((resolve, reject) => {
        db.query(
          `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
          values,
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        );
      });

      res.json({
        success: true,
        message: 'Account updated successfully'
      });

    } catch (error) {
      console.error('Update account error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update account',
        code: 'UPDATE_ERROR'
      });
    }
  });

  return router;
};

