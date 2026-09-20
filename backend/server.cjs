const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const port = process.env.PORT || 3001;

// Setup mail transporter
let mailTransporter = null;
async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      mailTransporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('Using Ethereal Mailer for password reset. Test account:', testAccount.user);
    } catch (e) {
      console.warn('Fallback to jsonTransport for mailer:', e.message);
      mailTransporter = nodemailer.createTransport({
        jsonTransport: true,
      });
    }
  }
  return mailTransporter;
}

// Helper to check if appointment is paid or completed
async function isAppointmentPaidOrCompleted(appointmentId) {
  if (!appointmentId) return false;
  try {
    const payRes = await pool.query(
      `SELECT 1 FROM payments WHERE appointment_id = $1
       UNION
       SELECT 1 FROM appointments WHERE id_appointment = $1 AND is_completed = true`,
      [appointmentId]
    );
    return payRes.rowCount > 0;
  } catch (err) {
    console.error('Error checking payment status:', err);
    return false;
  }
}

// Middleware
app.use(cors());
app.use(express.json());

// Connection to PostgreSQL
const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || '123456',
  database: process.env.PG_DATABASE || 'salon_db',
  port: process.env.PG_PORT || 5432,
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Error connecting to PostgreSQL database:', err);
});

// Test endpoints
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!' });
});

app.get('/api/database', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() as current_time');
    res.json({
      message: 'Database connection successful!',
      current_time: result.rows[0].current_time
    });
  } catch (err) {
    console.error('Error executing query', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==========================================
// 1. ROLES
// ==========================================
app.get('/api/roles', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles ORDER BY id_role ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting roles:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/roles/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM roles WHERE id_role = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Роль не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting role by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/roles', async (req, res) => {
  const { title } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO roles (title) VALUES ($1) RETURNING *',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating role:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/roles/:id', async (req, res) => {
  const { title } = req.body;
  try {
    const result = await pool.query(
      'UPDATE roles SET title = $1 WHERE id_role = $2 RETURNING *',
      [title, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Роль не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating role:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/roles/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM roles WHERE id_role = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Роль не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting role:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. DISCOUNTS
// ==========================================
app.get('/api/discounts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM discounts ORDER BY id_discount ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting discounts:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/discounts/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM discounts WHERE id_discount = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Скидка не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting discount by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/discounts', async (req, res) => {
  const { title, percentage } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO discounts (title, percentage) VALUES ($1, $2) RETURNING *',
      [title, percentage]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating discount:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/discounts/:id', async (req, res) => {
  const { title, percentage } = req.body;
  try {
    const result = await pool.query(
      'UPDATE discounts SET title = $1, percentage = $2 WHERE id_discount = $3 RETURNING *',
      [title, percentage, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Скидка не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating discount:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/discounts/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM discounts WHERE id_discount = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Скидка не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting discount:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. USERS & AUTH
// ==========================================
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, r.title as role_title, d.title as discount_title, d.percentage as discount_percentage
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id_role
      LEFT JOIN discounts d ON u.discount_id = d.id_discount
      ORDER BY u.id_user ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting users:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, r.title as role_title, d.title as discount_title, d.percentage as discount_percentage
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id_role
      LEFT JOIN discounts d ON u.discount_id = d.id_discount
      WHERE u.id_user = $1
    `, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting user by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      `SELECT u.*, r.title as role_title, d.title as discount_title, d.percentage as discount_percentage
       FROM users u
       LEFT JOIN roles r ON u.role_id = r.id_role
       LEFT JOIN discounts d ON u.discount_id = d.id_discount
       WHERE LOWER(u.email) = LOWER($1) AND u.password = $2`,
      [email ? email.trim() : '', password]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error logging in user:', err);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
});

// Password recovery / reset endpoints
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Укажите email' });
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (userRes.rowCount === 0) {
      return res.status(404).json({ error: 'Пользователь с таким email не найден' });
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await pool.query(`
      INSERT INTO password_resets (email, code, expires_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at
    `, [email.trim().toLowerCase(), code, expiresAt]);

    try {
      const transporter = await getMailTransporter();
      const mailOptions = {
        from: process.env.SMTP_FROM || '"Салон красоты и услуг" <noreply@salon.local>',
        to: email.trim(),
        subject: 'Код для восстановления пароля',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff;">
            <h2 style="color: #4f46e5; margin-top: 0;">Сброс пароля</h2>
            <p style="color: #374151; font-size: 15px; line-height: 1.5;">Здравствуйте! Вы запросили код для сброса пароля в личном кабинете.</p>
            <div style="background-color: #f3f4f6; border-radius: 6px; padding: 16px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #111827;">${code}</span>
            </div>
            <p style="color: #6b7280; font-size: 13px; line-height: 1.4; margin-bottom: 0;">Код действителен в течение 15 минут. Если вы не отправляли запрос, проигнорируйте это сообщение.</p>
          </div>
        `,
        text: `Ваш код для восстановления пароля: ${code}. Код действителен 15 минут.`
      };
      const info = await transporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${email.trim()}:`, info.messageId);
      if (nodemailer.getTestMessageUrl && info) {
        console.log(`Ethereal Email Preview URL:`, nodemailer.getTestMessageUrl(info));
      }
    } catch (mailErr) {
      console.error('Error sending reset email:', mailErr);
    }

    res.json({
      success: true,
      message: 'Код подтверждения отправлен на вашу почту',
      email: email.trim()
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, code, new_password } = req.body;
  if (!email || !code || !new_password) {
    return res.status(400).json({ error: 'Все поля обязательны' });
  }
  if (new_password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен содержать минимум 4 символа' });
  }
  try {
    const resetRes = await pool.query(
      'SELECT * FROM password_resets WHERE LOWER(email) = LOWER($1) AND code = $2 AND expires_at > NOW()',
      [email.trim(), code.trim()]
    );
    if (resetRes.rowCount === 0) {
      return res.status(400).json({ error: 'Неверный или просроченный код подтверждения' });
    }
    await pool.query('UPDATE users SET password = $1 WHERE LOWER(email) = LOWER($2)', [new_password, email.trim()]);
    await pool.query('DELETE FROM password_resets WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    res.json({ success: true, message: 'Пароль успешно обновлен' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const { first_name, second_name, middle_name, email, password, phone, address } = req.body;

  if (!first_name || !second_name || !email || !password) {
    return res.status(400).json({ error: 'Пожалуйста, заполните обязательные поля (Имя, Фамилия, Email, Пароль)' });
  }

  if (password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не менее 4 символов' });
  }

  try {
    const existing = await pool.query('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
    if (existing.rowCount > 0) {
      return res.status(400).json({ error: 'Пользователь с таким email уже зарегистрирован' });
    }

    const insertRes = await pool.query(
      `INSERT INTO users (role_id, second_name, first_name, middle_name, email, password, discount_id, phone, address)
       VALUES (4, $1, $2, $3, $4, $5, 1, $6, $7)
       RETURNING *`,
      [second_name.trim(), first_name.trim(), middle_name ? middle_name.trim() : '', email.trim(), password, phone ? phone.trim() : '', address ? address.trim() : '']
    );

    const newUser = insertRes.rows[0];

    // Create empty cart for new user
    await pool.query('INSERT INTO carts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [newUser.id_user]);

    // Fetch full user details with role
    const fullUser = await pool.query(`
      SELECT u.*, r.title as role_title, d.title as discount_title, d.percentage as discount_percentage
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id_role
      LEFT JOIN discounts d ON u.discount_id = d.id_discount
      WHERE u.id_user = $1
    `, [newUser.id_user]);

    res.status(201).json(fullUser.rows[0]);
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: err.message || 'Ошибка регистрации' });
  }
});

app.put('/api/users/profile/:id', async (req, res) => {
  const { first_name, second_name, middle_name, email, phone, address } = req.body;
  try {
    const result = await pool.query(
      `UPDATE users
       SET first_name = COALESCE($1, first_name),
           second_name = COALESCE($2, second_name),
           middle_name = COALESCE($3, middle_name),
           email = COALESCE($4, email),
           phone = COALESCE($5, phone),
           address = COALESCE($6, address)
       WHERE id_user = $7
       RETURNING *`,
      [first_name, second_name, middle_name, email, phone, address, req.params.id]
    );

    if (result.rowCount === 0) return res.status(404).json({ error: 'Пользователь не найден' });

    const fullUser = await pool.query(`
      SELECT u.*, r.title as role_title, d.title as discount_title, d.percentage as discount_percentage
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id_role
      LEFT JOIN discounts d ON u.discount_id = d.id_discount
      WHERE u.id_user = $1
    `, [req.params.id]);

    res.json(fullUser.rows[0]);
  } catch (err) {
    console.error('Error updating user profile:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/change-password/:id', async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Укажите текущий и новый пароль' });
  }
  if (newPassword.length < 4) {
    return res.status(400).json({ error: 'Новый пароль должен быть от 4 символов' });
  }
  try {
    const userRes = await pool.query('SELECT * FROM users WHERE id_user = $1', [req.params.id]);
    if (userRes.rowCount === 0) return res.status(404).json({ error: 'Пользователь не найден' });

    const user = userRes.rows[0];
    if (user.password !== currentPassword) {
      return res.status(400).json({ error: 'Текущий пароль введен неверно' });
    }

    await pool.query('UPDATE users SET password = $1 WHERE id_user = $2', [newPassword, req.params.id]);
    res.json({ success: true, message: 'Пароль успешно изменен' });
  } catch (err) {
    console.error('Error changing password:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req, res) => {
  const { role_id, second_name, first_name, middle_name, email, password, discount_id, phone, address } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO users (role_id, second_name, first_name, middle_name, email, password, discount_id, phone, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [role_id || 4, second_name, first_name, middle_name || '', email, password, discount_id || 1, phone || '', address || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  const { role_id, second_name, first_name, middle_name, email, password, discount_id } = req.body;
  try {
    // Check if target user is Main Admin (role_id = 1) and role is being changed to non-admin
    const targetUser = await pool.query('SELECT * FROM users WHERE id_user = $1', [req.params.id]);
    if (targetUser.rowCount > 0 && targetUser.rows[0].role_id === 1 && parseInt(role_id, 10) !== 1) {
      // Check if there are other main admins
      const otherAdmins = await pool.query('SELECT COUNT(*) FROM users WHERE role_id = 1 AND id_user != $1', [req.params.id]);
      if (parseInt(otherAdmins.rows[0].count, 10) === 0) {
        return res.status(400).json({ error: 'Нельзя снять права с единственного Главного администратора' });
      }
    }

    const result = await pool.query(
      `UPDATE users
       SET role_id = $1, second_name = $2, first_name = $3, middle_name = $4,
           email = $5, password = $6, discount_id = $7
       WHERE id_user = $8 RETURNING *`,
      [role_id, second_name, first_name, middle_name || '', email, password, discount_id || 1, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    const targetUser = await pool.query('SELECT * FROM users WHERE id_user = $1', [req.params.id]);
    if (targetUser.rowCount > 0 && targetUser.rows[0].role_id === 1) {
      return res.status(400).json({ error: 'Запрещено удалять учетную запись Главного администратора' });
    }

    const result = await pool.query('DELETE FROM users WHERE id_user = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Пользователь не найден' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 4. CATEGORIES
// ==========================================
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id_category ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting categories:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE id_category = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Категория не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting category by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  const { title } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO categories (title) VALUES ($1) RETURNING *',
      [title]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  const { title } = req.body;
  try {
    const result = await pool.query(
      'UPDATE categories SET title = $1 WHERE id_category = $2 RETURNING *',
      [title, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Категория не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating category:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM services_categories WHERE category_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM categories WHERE id_category = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Категория не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting category:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 5. SERVICES
// ==========================================
app.get('/api/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services ORDER BY id_service ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting services:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/services/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services WHERE id_service = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Услуга не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting service by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services', async (req, res) => {
  const { title, description, duration, price, discount_id, image_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO services (title, description, duration, price, discount_id, image_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description || '', parseInt(duration, 10) || 30, parseFloat(price) || 0, discount_id || 1, image_url || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating service:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/services/:id', async (req, res) => {
  const { title, description, duration, price, discount_id, image_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE services
       SET title = $1, description = $2, duration = $3, price = $4, discount_id = $5, image_url = $6
       WHERE id_service = $7 RETURNING *`,
      [title, description || '', parseInt(duration, 10) || 30, parseFloat(price) || 0, discount_id || 1, image_url || null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Услуга не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating service:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/services/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM services_categories WHERE service_id = $1', [req.params.id]);
    await pool.query('DELETE FROM carts_items WHERE service_id = $1', [req.params.id]);
    await pool.query('DELETE FROM appointments_services WHERE service_id = $1', [req.params.id]);
    await pool.query('DELETE FROM reviews WHERE service_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM services WHERE id_service = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Услуга не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting service:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 6. SERVICES TO CATEGORIES
// ==========================================
app.get('/api/services_categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM services_categories');
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting services_categories:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services_categories', async (req, res) => {
  const { service_id, category_id } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO services_categories (service_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT (service_id, category_id) DO NOTHING
       RETURNING *`,
      [service_id, category_id]
    );
    res.status(201).json(result.rows[0] || { service_id, category_id });
  } catch (err) {
    console.error('Error creating service_category link:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/services_categories/:serviceId/:categoryId', async (req, res) => {
  const { service_id, category_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE services_categories
       SET service_id = $1, category_id = $2
       WHERE service_id = $3 AND category_id = $4 RETURNING *`,
      [service_id, category_id, req.params.serviceId, req.params.categoryId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Связь не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating service category link:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/services_categories/:serviceId/:categoryId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM services_categories WHERE service_id = $1 AND category_id = $2',
      [req.params.serviceId, req.params.categoryId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Связь не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting service category link:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 7. APPOINTMENTS
// ==========================================
app.get('/api/appointments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*,
             u.first_name as client_first_name, u.second_name as client_second_name, u.email as client_email,
             m.first_name as master_first_name, m.second_name as master_second_name, m.email as master_email,
             COALESCE((SELECT COUNT(*) > 0 FROM payments p WHERE p.appointment_id = a.id_appointment), false) as is_paid
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.id_user
      LEFT JOIN users m ON a.master_id = m.id_user
      ORDER BY a.appointment_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting appointments:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/appointments/user/:userId', async (req, res) => {
  try {
    const appointmentsResult = await pool.query(`
      SELECT a.*,
             m.first_name as master_first_name, m.second_name as master_second_name, m.email as master_email,
             COALESCE((SELECT COUNT(*) > 0 FROM payments p WHERE p.appointment_id = a.id_appointment), false) as is_paid
      FROM appointments a
      LEFT JOIN users m ON a.master_id = m.id_user
      WHERE a.user_id = $1
      ORDER BY a.appointment_date DESC
    `, [req.params.userId]);

    const appointments = appointmentsResult.rows;

    for (const app of appointments) {
      const itemsRes = await pool.query(`
        SELECT aps.service_id, aps.quantity, s.title, s.price, s.duration, s.image_url
        FROM appointments_services aps
        JOIN services s ON aps.service_id = s.id_service
        WHERE aps.appointment_id = $1
      `, [app.id_appointment]);

      app.services = itemsRes.rows;
      app.totalPrice = itemsRes.rows.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
    }

    res.json(appointments);
  } catch (err) {
    console.error('Error getting user appointments:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/appointments/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*,
             u.first_name as client_first_name, u.second_name as client_second_name, u.email as client_email,
             m.first_name as master_first_name, m.second_name as master_second_name,
             COALESCE((SELECT COUNT(*) > 0 FROM payments p WHERE p.appointment_id = a.id_appointment), false) as is_paid
      FROM appointments a
      LEFT JOIN users u ON a.user_id = u.id_user
      LEFT JOIN users m ON a.master_id = m.id_user
      WHERE a.id_appointment = $1
    `, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting appointment by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/appointments', async (req, res) => {
  const { user_id, master_id, appointment_date, note, address, is_completed } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO appointments (user_id, master_id, appointment_date, note, address, is_completed)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, master_id, appointment_date, note || '', address || '', is_completed || false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating appointment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/appointments/:id', async (req, res) => {
  const { user_id, master_id, appointment_date, note, address, is_completed } = req.body;
  try {
    const isPaid = await isAppointmentPaidOrCompleted(req.params.id);
    // If it is paid, check if changing client/master/date (which should be blocked)
    if (isPaid && !is_completed) {
      const currentApp = await pool.query('SELECT * FROM appointments WHERE id_appointment = $1', [req.params.id]);
      if (currentApp.rowCount > 0) {
        const c = currentApp.rows[0];
        // Allow updating completion status or note only, but reject altering paid user or master
        if (user_id && String(c.user_id) !== String(user_id)) {
          return res.status(403).json({ error: 'Запись уже оплачена. Изменение клиента невозможно.' });
        }
      }
    }

    const result = await pool.query(
      `UPDATE appointments
       SET user_id = $1, master_id = $2, appointment_date = $3, note = $4, address = $5, is_completed = $6
       WHERE id_appointment = $7 RETURNING *`,
      [user_id, master_id, appointment_date, note, address || '', is_completed, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating appointment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/appointments/:id', async (req, res) => {
  try {
    const isPaid = await isAppointmentPaidOrCompleted(req.params.id);
    if (isPaid) {
      return res.status(403).json({ error: 'Оплаченная запись не может быть удалена. Она сохраняется для финансовой отчетности.' });
    }
    await pool.query('DELETE FROM appointments_services WHERE appointment_id = $1', [req.params.id]);
    await pool.query('DELETE FROM payments WHERE appointment_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM appointments WHERE id_appointment = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting appointment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 8. APPOINTMENTS TO SERVICES
// ==========================================
app.get('/api/appointments_services', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT aps.*, s.title as service_title, s.price, s.duration,
             a.appointment_date, a.is_completed, u.first_name as client_first_name, u.second_name as client_second_name,
             COALESCE((SELECT COUNT(*) > 0 FROM payments p WHERE p.appointment_id = aps.appointment_id), false) as is_paid
      FROM appointments_services aps
      LEFT JOIN services s ON aps.service_id = s.id_service
      LEFT JOIN appointments a ON aps.appointment_id = a.id_appointment
      LEFT JOIN users u ON a.user_id = u.id_user
      ORDER BY aps.appointment_id DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting appointments_services:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/appointments_services', async (req, res) => {
  const { appointment_id, service_id, quantity } = req.body;
  try {
    const isPaid = await isAppointmentPaidOrCompleted(appointment_id);
    if (isPaid) {
      return res.status(403).json({ error: 'Заказ уже оплачен или завершен. Изменение состава услуг заблокировано.' });
    }

    const result = await pool.query(
      `INSERT INTO appointments_services (appointment_id, service_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (appointment_id, service_id)
       DO UPDATE SET quantity = EXCLUDED.quantity
       RETURNING *`,
      [appointment_id, service_id, quantity || 1]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating appointments_services:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/appointments_services/:appointmentId/:serviceId', async (req, res) => {
  const { quantity } = req.body;
  try {
    const isPaid = await isAppointmentPaidOrCompleted(req.params.appointmentId);
    if (isPaid) {
      return res.status(403).json({ error: 'Заказ уже оплачен или завершен. Изменение количества заблокировано.' });
    }

    const result = await pool.query(
      `UPDATE appointments_services
       SET quantity = $1
       WHERE appointment_id = $2 AND service_id = $3 RETURNING *`,
      [quantity || 1, req.params.appointmentId, req.params.serviceId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating appointments_services:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/appointments_services/:appointmentId/:serviceId', async (req, res) => {
  try {
    const isPaid = await isAppointmentPaidOrCompleted(req.params.appointmentId);
    if (isPaid) {
      return res.status(403).json({ error: 'Заказ уже оплачен или завершен. Удаление услуг заблокировано.' });
    }

    const result = await pool.query(
      'DELETE FROM appointments_services WHERE appointment_id = $1 AND service_id = $2',
      [req.params.appointmentId, req.params.serviceId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Запись не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting appointments_services:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/appointments_services/:id', async (req, res) => {
  try {
    const isPaid = await isAppointmentPaidOrCompleted(req.params.id);
    if (isPaid) {
      return res.status(403).json({ error: 'Заказ уже оплачен или завершен. Удаление услуг заблокировано.' });
    }

    const result = await pool.query(
      'DELETE FROM appointments_services WHERE appointment_id = $1',
      [req.params.id]
    );
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting appointments_services by appointment_id:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 9. CARTS & USER CART
// ==========================================
app.get('/api/carts', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, u.first_name, u.second_name, u.email
      FROM carts c
      LEFT JOIN users u ON c.user_id = u.id_user
      ORDER BY c.id_cart ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting carts:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/carts/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM carts WHERE id_cart = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Корзина не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting cart by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/carts/user/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    let cartResult = await pool.query('SELECT * FROM carts WHERE user_id = $1', [userId]);
    let cart = cartResult.rows[0];

    if (!cart) {
      const newCartResult = await pool.query(
        'INSERT INTO carts (user_id) VALUES ($1) RETURNING *',
        [userId]
      );
      cart = newCartResult.rows[0];
    }

    // Auto-clean any items for services that were deleted or don't exist anymore
    await pool.query(
      `DELETE FROM carts_items
       WHERE cart_id = $1 AND service_id NOT IN (SELECT id_service FROM services)`,
      [cart.id_cart]
    );

    const itemsResult = await pool.query(
      `SELECT
         ci.cart_id,
         ci.service_id,
         ci.quantity,
         s.title,
         s.description,
         s.duration,
         s.price,
         s.discount_id,
         s.image_url,
         d.percentage as discount_percentage,
         d.title as discount_title
       FROM carts_items ci
       JOIN services s ON ci.service_id = s.id_service
       LEFT JOIN discounts d ON s.discount_id = d.id_discount
       WHERE ci.cart_id = $1
       ORDER BY ci.service_id ASC`,
      [cart.id_cart]
    );

    res.json({
      cart,
      items: itemsResult.rows
    });
  } catch (err) {
    console.error('Error getting user cart:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/carts', async (req, res) => {
  const { user_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO carts (user_id) VALUES ($1) RETURNING *',
      [user_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating cart:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/carts/:id', async (req, res) => {
  const { user_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE carts SET user_id = $1 WHERE id_cart = $2 RETURNING *',
      [user_id, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Корзина не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/carts/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM carts_items WHERE cart_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM carts WHERE id_cart = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Корзина не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting cart:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 10. CARTS ITEMS
// ==========================================
app.get('/api/carts_items', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.*, s.title as service_title, s.price, u.first_name, u.second_name, u.email
      FROM carts_items ci
      LEFT JOIN services s ON ci.service_id = s.id_service
      LEFT JOIN carts c ON ci.cart_id = c.id_cart
      LEFT JOIN users u ON c.user_id = u.id_user
      ORDER BY ci.cart_id ASC, ci.service_id ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting carts_items:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/carts_items', async (req, res) => {
  const { cart_id, service_id, quantity } = req.body;
  const qty = parseInt(quantity, 10) || 1;
  try {
    const result = await pool.query(
      `INSERT INTO carts_items (cart_id, service_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, service_id)
       DO UPDATE SET quantity = carts_items.quantity + EXCLUDED.quantity
       RETURNING *`,
      [cart_id, service_id, qty]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding item to cart:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/carts_items/:cartId/:serviceId', async (req, res) => {
  const { quantity } = req.body;
  const qty = parseInt(quantity, 10);
  try {
    if (qty <= 0) {
      await pool.query(
        'DELETE FROM carts_items WHERE cart_id = $1 AND service_id = $2',
        [req.params.cartId, req.params.serviceId]
      );
      return res.json({ deleted: true });
    }

    const result = await pool.query(
      `UPDATE carts_items
       SET quantity = $1
       WHERE cart_id = $2 AND service_id = $3 RETURNING *`,
      [qty, req.params.cartId, req.params.serviceId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Позиция не найдена' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating item quantity:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/carts_items/:cartId/:serviceId', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM carts_items WHERE cart_id = $1 AND service_id = $2',
      [req.params.cartId, req.params.serviceId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Позиция не найдена' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting item from cart:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/carts/:cartId/items', async (req, res) => {
  try {
    await pool.query('DELETE FROM carts_items WHERE cart_id = $1', [req.params.cartId]);
    res.status(204).end();
  } catch (err) {
    console.error('Error clearing cart items:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/carts_items/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM carts_items WHERE cart_id = $1', [req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting cart items:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 11. PAYMENTS
// ==========================================
app.get('/api/payments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
             a.appointment_date,
             u.first_name as client_first_name, u.second_name as client_second_name, u.email as client_email,
             m.first_name as master_first_name, m.second_name as master_second_name
      FROM payments p
      LEFT JOIN appointments a ON p.appointment_id = a.id_appointment
      LEFT JOIN users u ON a.user_id = u.id_user
      LEFT JOIN users m ON a.master_id = m.id_user
      ORDER BY p.id_payment DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting payments:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/payments/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*,
             a.appointment_date,
             u.first_name as client_first_name, u.second_name as client_second_name
      FROM payments p
      LEFT JOIN appointments a ON p.appointment_id = a.id_appointment
      LEFT JOIN users u ON a.user_id = u.id_user
      WHERE p.id_payment = $1
    `, [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Платеж не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error getting payment by id:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', async (req, res) => {
  const { appointment_id, payment_date, total } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO payments (appointment_id, payment_date, total)
       VALUES ($1, $2, $3) RETURNING *`,
      [appointment_id, payment_date || new Date(), parseFloat(total) || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating payment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/payments/:id', async (req, res) => {
  const { appointment_id, payment_date, total } = req.body;
  try {
    const result = await pool.query(
      `UPDATE payments
       SET appointment_id = $1, payment_date = $2, total = $3
       WHERE id_payment = $4 RETURNING *`,
      [appointment_id, payment_date, parseFloat(total), req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Платеж не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating payment:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payments/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM payments WHERE id_payment = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Платеж не найден' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting payment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 12. REVIEWS (Anti-Spam Timer & Cooldown)
// ==========================================
app.get('/api/reviews', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*,
             u.first_name, u.second_name, u.email as user_email,
             s.title as service_title
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id_user
      LEFT JOIN services s ON r.service_id = s.id_service
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting reviews:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  const { user_id, service_id, rating, comment } = req.body;
  if (!user_id || !rating || !comment) {
    return res.status(400).json({ error: 'Оценка и комментарий обязательны' });
  }
  const ratingNum = parseInt(rating, 10);
  if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
  }
  try {
    // Check if user posted a review recently (3 minutes cooldown)
    const recent = await pool.query(
      `SELECT id_review, EXTRACT(EPOCH FROM (NOW() - created_at)) as elapsed
       FROM reviews
       WHERE user_id = $1 AND (NOW() - created_at) < interval '3 minutes'
       ORDER BY created_at DESC LIMIT 1`,
      [user_id]
    );
    if (recent.rowCount > 0) {
      const remaining = Math.ceil(180 - parseFloat(recent.rows[0].elapsed));
      return res.status(429).json({
        error: `Защита от спама: подождите ${remaining} сек. перед новым отзывом или отредактируйте существующий отзыв.`,
        remaining
      });
    }

    const result = await pool.query(
      `INSERT INTO reviews (user_id, service_id, rating, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, service_id || null, ratingNum, comment.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating review:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/reviews/:id', async (req, res) => {
  const { rating, comment, service_id } = req.body;
  try {
    const result = await pool.query(
      `UPDATE reviews
       SET rating = COALESCE($1, rating),
           comment = COALESCE($2, comment),
           service_id = COALESCE($3, service_id),
           updated_at = NOW()
       WHERE id_review = $4 RETURNING *`,
      [rating ? parseInt(rating, 10) : null, comment ? comment.trim() : null, service_id || null, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Отзыв не найден' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating review:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/reviews/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM reviews WHERE id_review = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Отзыв не найден' });
    res.status(204).end();
  } catch (err) {
    console.error('Error deleting review:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
