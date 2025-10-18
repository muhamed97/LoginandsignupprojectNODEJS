const express = require('express');

module.exports = (db, authenticateToken, generateTransactionId) => {
  const router = express.Router();

  // Deposit money
  router.post('/deposit', authenticateToken, async (req, res) => {
    const connection = await new Promise((resolve, reject) => {
      db.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    try {
      await new Promise((resolve, reject) => {
        connection.beginTransaction((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const userId = req.user.id;
      const { amount, description } = req.body;

      if (!amount || amount <= 0) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid amount',
          code: 'INVALID_AMOUNT'
        });
      }

      // Get current balance
      const user = await new Promise((resolve, reject) => {
        connection.query(
          "SELECT balance FROM users WHERE id = ? FOR UPDATE",
          [userId],
          (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          }
        );
      });

      if (!user) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const currentBalance = parseFloat(user.balance);
      const newBalance = currentBalance + parseFloat(amount);
      const transactionId = generateTransactionId();

      // Update balance
      await new Promise((resolve, reject) => {
        connection.query(
          "UPDATE users SET balance = ? WHERE id = ?",
          [newBalance, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Record transaction
      await new Promise((resolve, reject) => {
        connection.query(
          "INSERT INTO transactions (user_id, transaction_id, type, amount, balance_after, description) VALUES (?, ?, 'deposit', ?, ?, ?)",
          [userId, transactionId, amount, newBalance, description || 'Deposit'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        connection.commit((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        success: true,
        message: 'Deposit successful',
        data: {
          transactionId: transactionId,
          newBalance: newBalance,
          amount: amount
        }
      });

    } catch (error) {
      await new Promise((resolve) => {
        connection.rollback(() => resolve());
      });
      console.error('Deposit error:', error);
      res.status(500).json({
        success: false,
        error: 'Deposit failed',
        code: 'DEPOSIT_ERROR'
      });
    } finally {
      connection.release();
    }
  });

  // Withdraw money
  router.post('/withdraw', authenticateToken, async (req, res) => {
    const connection = await new Promise((resolve, reject) => {
      db.getConnection((err, conn) => {
        if (err) reject(err);
        else resolve(conn);
      });
    });

    try {
      await new Promise((resolve, reject) => {
        connection.beginTransaction((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const userId = req.user.id;
      const { amount, description } = req.body;

      if (!amount || amount <= 0) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        return res.status(400).json({
          success: false,
          error: 'Invalid amount',
          code: 'INVALID_AMOUNT'
        });
      }

      // Get current balance
      const user = await new Promise((resolve, reject) => {
        connection.query(
          "SELECT balance FROM users WHERE id = ? FOR UPDATE",
          [userId],
          (err, results) => {
            if (err) reject(err);
            else resolve(results[0]);
          }
        );
      });

      if (!user) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        return res.status(404).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      const currentBalance = parseFloat(user.balance);
      const withdrawAmount = parseFloat(amount);

      if (currentBalance < withdrawAmount) {
        await new Promise((resolve) => {
          connection.rollback(() => resolve());
        });
        return res.status(400).json({
          success: false,
          error: 'Insufficient funds',
          code: 'INSUFFICIENT_FUNDS'
        });
      }

      const newBalance = currentBalance - withdrawAmount;
      const transactionId = generateTransactionId();

      // Update balance
      await new Promise((resolve, reject) => {
        connection.query(
          "UPDATE users SET balance = ? WHERE id = ?",
          [newBalance, userId],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Record transaction
      await new Promise((resolve, reject) => {
        connection.query(
          "INSERT INTO transactions (user_id, transaction_id, type, amount, balance_after, description) VALUES (?, ?, 'withdraw', ?, ?, ?)",
          [userId, transactionId, withdrawAmount, newBalance, description || 'Withdrawal'],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await new Promise((resolve, reject) => {
        connection.commit((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      res.json({
        success: true,
        message: 'Withdrawal successful',
        data: {
          transactionId: transactionId,
          newBalance: newBalance,
          amount: withdrawAmount
        }
      });

    } catch (error) {
      await new Promise((resolve) => {
        connection.rollback(() => resolve());
      });
      console.error('Withdraw error:', error);
      res.status(500).json({
        success: false,
        error: 'Withdrawal failed',
        code: 'WITHDRAW_ERROR'
      });
    } finally {
      connection.release();
    }
  });

  // Get transaction history
  router.get('/history', authenticateToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20, type } = req.query;
      const offset = (page - 1) * limit;

      let query = "SELECT * FROM transactions WHERE user_id = ?";
      let params = [userId];

      if (type) {
        query += " AND type = ?";
        params.push(type);
      }

      query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
      params.push(parseInt(limit), parseInt(offset));

      const transactions = await new Promise((resolve, reject) => {
        db.query(query, params, (err, results) => {
          if (err) reject(err);
          else resolve(results);
        });
      });

      // Get total count
      let countQuery = "SELECT COUNT(*) as total FROM transactions WHERE user_id = ?";
      let countParams = [userId];

      if (type) {
        countQuery += " AND type = ?";
        countParams.push(type);
      }

      const countResult = await new Promise((resolve, reject) => {
        db.query(countQuery, countParams, (err, results) => {
          if (err) reject(err);
          else resolve(results[0]);
        });
      });

      res.json({
        success: true,
        data: {
          transactions: transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            pages: Math.ceil(countResult.total / limit)
          }
        }
      });

    } catch (error) {
      console.error('Transaction history error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch transaction history',
        code: 'HISTORY_ERROR'
      });
    }
  });

  return router;
};

