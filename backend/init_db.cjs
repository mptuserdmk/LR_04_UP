const { Client, Pool } = require('pg');

const dbConfig = {
  host: 'localhost',
  user: 'postgres',
  password: '123456',
  port: 5432,
};

async function initDB() {
  const rootClient = new Client({ ...dbConfig, database: 'postgres' });
  await rootClient.connect();

  const checkDb = await rootClient.query("SELECT 1 FROM pg_database WHERE datname = 'salon_db'");
  if (checkDb.rowCount === 0) {
    console.log('Creating database salon_db...');
    await rootClient.query('CREATE DATABASE salon_db');
  } else {
    console.log('Database salon_db already exists.');
  }
  await rootClient.end();

  const pool = new Pool({ ...dbConfig, database: 'salon_db' });

  console.log('Creating/updating tables...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS roles (
      id_role SERIAL PRIMARY KEY,
      title VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS discounts (
      id_discount SERIAL PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      percentage INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS users (
      id_user SERIAL PRIMARY KEY,
      second_name VARCHAR(50) NOT NULL,
      first_name VARCHAR(50) NOT NULL,
      middle_name VARCHAR(50),
      role_id INTEGER NOT NULL REFERENCES roles(id_role) ON DELETE RESTRICT,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      discount_id INTEGER REFERENCES discounts(id_discount) ON DELETE SET NULL,
      phone VARCHAR(50),
      address TEXT
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

    CREATE TABLE IF NOT EXISTS categories (
      id_category SERIAL PRIMARY KEY,
      title VARCHAR(50) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS services (
      id_service SERIAL PRIMARY KEY,
      title VARCHAR(100) NOT NULL,
      description TEXT,
      duration INTEGER NOT NULL DEFAULT 30,
      price NUMERIC(10, 2) NOT NULL DEFAULT 0,
      discount_id INTEGER REFERENCES discounts(id_discount) ON DELETE SET NULL,
      image_url TEXT
    );

    -- Ensure image_url exists if table was previously created without it
    ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url TEXT;

    CREATE TABLE IF NOT EXISTS services_categories (
      service_id INTEGER NOT NULL REFERENCES services(id_service) ON DELETE CASCADE,
      category_id INTEGER NOT NULL REFERENCES categories(id_category) ON DELETE CASCADE,
      PRIMARY KEY (service_id, category_id)
    );

    CREATE TABLE IF NOT EXISTS appointments (
      id_appointment SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
      master_id INTEGER NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
      appointment_date TIMESTAMP NOT NULL,
      note TEXT,
      address TEXT,
      is_completed BOOLEAN NOT NULL DEFAULT FALSE
    );

    ALTER TABLE appointments ADD COLUMN IF NOT EXISTS address TEXT;

    CREATE TABLE IF NOT EXISTS appointments_services (
      appointment_id INTEGER NOT NULL REFERENCES appointments(id_appointment) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id_service) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (appointment_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS carts (
      id_cart SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id_user) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS carts_items (
      cart_id INTEGER NOT NULL REFERENCES carts(id_cart) ON DELETE CASCADE,
      service_id INTEGER NOT NULL REFERENCES services(id_service) ON DELETE CASCADE,
      quantity INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (cart_id, service_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id_payment SERIAL PRIMARY KEY,
      appointment_id INTEGER NOT NULL REFERENCES appointments(id_appointment) ON DELETE CASCADE,
      payment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      total NUMERIC(10, 2) NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id_review SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id_user) ON DELETE CASCADE,
      service_id INTEGER REFERENCES services(id_service) ON DELETE SET NULL,
      rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      email VARCHAR(100) PRIMARY KEY,
      code VARCHAR(6) NOT NULL,
      expires_at TIMESTAMP NOT NULL
    );
  `);

  console.log('Seeding initial data...');

  // 1. Roles (1: Главный администратор, 2: Сотрудник (Менеджер), 3: Мастер, 4: Клиент)
  await pool.query(`
    INSERT INTO roles (id_role, title) VALUES
      (1, 'Главный администратор'),
      (2, 'Сотрудник (Менеджер)'),
      (3, 'Мастер'),
      (4, 'Клиент')
    ON CONFLICT (id_role) DO UPDATE SET title = EXCLUDED.title;
    SELECT setval('roles_id_role_seq', (SELECT MAX(id_role) FROM roles));
  `);

  // 2. Discounts
  await pool.query(`
    INSERT INTO discounts (id_discount, title, percentage) VALUES
      (1, 'Без скидки', 0),
      (2, 'Студенческая', 10),
      (3, 'Постоянный клиент', 15),
      (4, 'VIP Гость', 20),
      (5, 'Акция недели', 25)
    ON CONFLICT (id_discount) DO UPDATE SET title = EXCLUDED.title, percentage = EXCLUDED.percentage;
    SELECT setval('discounts_id_discount_seq', (SELECT MAX(id_discount) FROM discounts));
  `);

  // 3. Users: Admin, Staff, Master, Client
  await pool.query(`
    INSERT INTO users (id_user, second_name, first_name, middle_name, role_id, email, password, discount_id, phone, address) VALUES
      (1, 'Девлет', 'Максим', 'Керимович', 1, 'isip_m.k.devlet@gmail.com', 'admin123', 4, '+7 (999) 111-22-33', 'г. Москва, ул. Арбат, д. 10'),
      (2, 'Петров', 'Иван', 'Сергеевич', 4, 'ivan.petrov@mail.ru', '123456', 3, '+7 (999) 777-88-99', 'г. Москва, пр-т Мира, д. 24, кв. 15'),
      (3, 'Смирнова', 'Анна', 'Игоревна', 3, 'anna.master@salon.ru', '123456', 1, '+7 (999) 222-33-44', 'г. Москва, Салон красоты'),
      (4, 'Ковалева', 'Елена', 'Викторовна', 2, 'elena.staff@salon.ru', 'staff123', 2, '+7 (999) 555-44-33', 'г. Москва, ул. Тверская, д. 5'),
      (5, 'Соколов', 'Дмитрий', 'Алексеевич', 3, 'dmitry.barber@salon.ru', '123456', 1, '+7 (999) 444-55-66', 'г. Москва, Барбер-зал')
    ON CONFLICT (id_user) DO UPDATE SET
      second_name = EXCLUDED.second_name,
      first_name = EXCLUDED.first_name,
      middle_name = EXCLUDED.middle_name,
      role_id = EXCLUDED.role_id,
      email = EXCLUDED.email,
      password = EXCLUDED.password,
      discount_id = EXCLUDED.discount_id,
      phone = EXCLUDED.phone,
      address = EXCLUDED.address;
    SELECT setval('users_id_user_seq', (SELECT MAX(id_user) FROM users));
  `);

  // 4. Categories
  await pool.query(`
    INSERT INTO categories (id_category, title) VALUES
      (1, 'Стрижки и укладки'),
      (2, 'Борода и бритье'),
      (3, 'Окрашивание волос'),
      (4, 'Уход и спа-комплексы'),
      (5, 'Ногтевой сервис'),
      (6, 'Косметология и массаж')
    ON CONFLICT (id_category) DO UPDATE SET title = EXCLUDED.title;
    SELECT setval('categories_id_category_seq', (SELECT MAX(id_category) FROM categories));
  `);

  // 5. Services: At least 22 services with descriptions, duration, price, images
  const sampleServices = [
    {
      id: 1,
      title: 'Мужская модельная стрижка',
      description: 'Индивидуальный подбор формы, мытье головы с массажем, стрижка ножницами и машинкой, укладка стайлингом.',
      duration: 45,
      price: 1500.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80',
      category_id: 1
    },
    {
      id: 2,
      title: 'Женская модельная стрижка',
      description: 'Консультация топ-стилиста, бережное мытье, создание текстурной формы и финишная укладка феном.',
      duration: 60,
      price: 2500.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&auto=format&fit=crop&q=80',
      category_id: 1
    },
    {
      id: 3,
      title: 'Стрижка Fade (Фейд)',
      description: 'Идеальный плавный дымчатый переход от нуля с проработкой контуров опасной бритвой.',
      duration: 50,
      price: 1800.00,
      discount_id: 2,
      image_url: 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&auto=format&fit=crop&q=80',
      category_id: 1
    },
    {
      id: 4,
      title: 'Моделирование и стрижка бороды',
      description: 'Коррекция геометрии бороды и усов, распаривание с эфирными маслами, подбривание контуров.',
      duration: 40,
      price: 1300.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=600&auto=format&fit=crop&q=80',
      category_id: 2
    },
    {
      id: 5,
      title: 'Королевское бритье опасной бритвой',
      description: 'Традиционный ритуал: двойной горячий компресс, премиальная пена, бритье клинком и холодный компресс.',
      duration: 45,
      price: 1900.00,
      discount_id: 4,
      image_url: 'https://images.unsplash.com/photo-1512690459411-b9245aed614b?w=600&auto=format&fit=crop&q=80',
      category_id: 2
    },
    {
      id: 6,
      title: 'Камуфляж седины для бороды',
      description: 'Естественное тонирование седины специальным безаммиачным красителем за 15 минут.',
      duration: 25,
      price: 1100.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=600&auto=format&fit=crop&q=80',
      category_id: 2
    },
    {
      id: 7,
      title: 'Сложное окрашивание (Airtouch / Balayage)',
      description: 'Многомерное окрашивание с эффектом выгоревших прядей и плавным переходом от корней.',
      duration: 180,
      price: 7500.00,
      discount_id: 5,
      image_url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80',
      category_id: 3
    },
    {
      id: 8,
      title: 'Окрашивание волос в один тон',
      description: 'Насыщенный стойкий цвет, блеск и шелковистость с использованием итальянских красителей.',
      duration: 90,
      price: 3900.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1562322140-8baeececf3df?w=600&auto=format&fit=crop&q=80',
      category_id: 3
    },
    {
      id: 9,
      title: 'Тонирование и ламинирование волос',
      description: 'Придание волосам зеркального блеска, плотности и защита цвета от вымывания.',
      duration: 60,
      price: 2800.00,
      discount_id: 2,
      image_url: 'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?w=600&auto=format&fit=crop&q=80',
      category_id: 3
    },
    {
      id: 10,
      title: 'Глубокий спа-уход «Абсолютное счастье»',
      description: 'Многоступенчатая японская программа молекулярного восстановления поврежденной структуры волос.',
      duration: 75,
      price: 4500.00,
      discount_id: 3,
      image_url: 'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?w=600&auto=format&fit=crop&q=80',
      category_id: 4
    },
    {
      id: 11,
      title: 'Детокс и пилинг кожи головы',
      description: 'Глубокое очищение пор, нормализация себорегуляции, стимуляция роста волос и массаж.',
      duration: 40,
      price: 1800.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&auto=format&fit=crop&q=80',
      category_id: 4
    },
    {
      id: 12,
      title: 'Кератиновое выпрямление и термозащита',
      description: 'Идеальная гладкость, устранение пушистости и зеркальный блеск на срок до 5 месяцев.',
      duration: 120,
      price: 5200.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=600&auto=format&fit=crop&q=80',
      category_id: 4
    },
    {
      id: 13,
      title: 'Комплексный аппаратный маникюр',
      description: 'Чистая обработка кутикулы аппаратом, опил формы ногтей, нанесение питательного масла.',
      duration: 45,
      price: 1400.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=600&auto=format&fit=crop&q=80',
      category_id: 5
    },
    {
      id: 14,
      title: 'Маникюр с гель-лаком и выравниванием',
      description: 'Аппаратная техника, укрепление базой, идеальные блики и стойкое цветное покрытие под кутикулу.',
      duration: 80,
      price: 2300.00,
      discount_id: 2,
      image_url: 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&auto=format&fit=crop&q=80',
      category_id: 5
    },
    {
      id: 15,
      title: 'Smart-педикюр с обработкой стоп',
      description: 'Инновационная обработка стоп смарт-дисками с молекулярным маслом, гладкость шелка.',
      duration: 70,
      price: 2900.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=600&auto=format&fit=crop&q=80',
      category_id: 5
    },
    {
      id: 16,
      title: 'Мужской уходовый маникюр',
      description: 'Классическая гигиеническая обработка ногтей и кожи рук, полировка и массаж с кремом.',
      duration: 40,
      price: 1300.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=600&auto=format&fit=crop&q=80',
      category_id: 5
    },
    {
      id: 17,
      title: 'Ультразвуковая чистка лица',
      description: 'Атравматичное очищение пор, отшелушивание ороговевших клеток, сужение пор и маска.',
      duration: 60,
      price: 3200.00,
      discount_id: 2,
      image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&auto=format&fit=crop&q=80',
      category_id: 6
    },
    {
      id: 18,
      title: 'Скульптурный массаж лица и шеи',
      description: 'Глубокая проработка мимических мышц, лифтинг-эффект, снятие отечности и улучшение тонуса.',
      duration: 50,
      price: 2700.00,
      discount_id: 3,
      image_url: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&auto=format&fit=crop&q=80',
      category_id: 6
    },
    {
      id: 19,
      title: 'Черная маска-детокс Black Mask',
      description: 'Глубокое очищение Т-зоны от черных точек с распариванием лица и сужением пор.',
      duration: 30,
      price: 1200.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&auto=format&fit=crop&q=80',
      category_id: 6
    },
    {
      id: 20,
      title: 'Детская стрижка (до 12 лет)',
      description: 'Бережная и стильная стрижка в комфортной дружелюбной атмосфере с любимыми мультиками.',
      duration: 35,
      price: 1000.00,
      discount_id: 1,
      image_url: 'https://images.unsplash.com/photo-1595867818082-083862f3d630?w=600&auto=format&fit=crop&q=80',
      category_id: 1
    },
    {
      id: 21,
      title: 'Комплекс «Папа + Сын»',
      description: 'Одновременная стрижка для отца и ребенка у лучших барберов салона со скидкой.',
      duration: 60,
      price: 2200.00,
      discount_id: 4,
      image_url: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=600&auto=format&fit=crop&q=80',
      category_id: 1
    },
    {
      id: 22,
      title: 'Премиум комплекс «Полное преображение»',
      description: 'Стрижка + моделирование бороды + спа-уход за лицом + укладка премиум стайлингом.',
      duration: 90,
      price: 3600.00,
      discount_id: 5,
      image_url: 'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=600&auto=format&fit=crop&q=80',
      category_id: 1
    }
  ];

  for (const s of sampleServices) {
    await pool.query(`
      INSERT INTO services (id_service, title, description, duration, price, discount_id, image_url)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id_service) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        duration = EXCLUDED.duration,
        price = EXCLUDED.price,
        discount_id = EXCLUDED.discount_id,
        image_url = EXCLUDED.image_url;
    `, [s.id, s.title, s.description, s.duration, s.price, s.discount_id, s.image_url]);

    await pool.query(`
      INSERT INTO services_categories (service_id, category_id)
      VALUES ($1, $2)
      ON CONFLICT (service_id, category_id) DO NOTHING;
    `, [s.id, s.category_id]);
  }
  await pool.query("SELECT setval('services_id_service_seq', (SELECT MAX(id_service) FROM services));");

  // 6. Carts for users
  await pool.query(`
    INSERT INTO carts (id_cart, user_id) VALUES
      (1, 1),
      (2, 2),
      (3, 4)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT setval('carts_id_cart_seq', (SELECT COALESCE(MAX(id_cart), 1) FROM carts));
  `);

  // 7. Appointments with realistic future/past dates
  await pool.query(`
    INSERT INTO appointments (id_appointment, user_id, master_id, appointment_date, note, is_completed) VALUES
      (1, 2, 3, NOW() + interval '1 day 2 hours', 'Желательно мастер Анна, чай без сахара', false),
      (2, 2, 5, NOW() - interval '2 days', 'Регулярная модельная стрижка и борода', true),
      (3, 1, 3, NOW() + interval '3 days 4 hours', 'Тестовая VIP запись', false)
    ON CONFLICT (id_appointment) DO NOTHING;
    SELECT setval('appointments_id_appointment_seq', (SELECT COALESCE(MAX(id_appointment), 1) FROM appointments));
  `);

  // 8. Appointments Services
  await pool.query(`
    INSERT INTO appointments_services (appointment_id, service_id, quantity) VALUES
      (1, 1, 1),
      (1, 4, 1),
      (2, 1, 1),
      (2, 5, 1),
      (3, 22, 1)
    ON CONFLICT DO NOTHING;
  `);

  // 9. Payments
  await pool.query(`
    INSERT INTO payments (id_payment, appointment_id, payment_date, total) VALUES
      (1, 2, NOW() - interval '2 days', 3400.00)
    ON CONFLICT (id_payment) DO NOTHING;
    SELECT setval('payments_id_payment_seq', (SELECT COALESCE(MAX(id_payment), 1) FROM payments));
  `);

  // 10. Sample Reviews
  await pool.query(`
    INSERT INTO reviews (id_review, user_id, service_id, rating, comment, created_at) VALUES
      (1, 2, 1, 5, 'Отличная стрижка! Мастер Анна учла все пожелания и сделала идеальный фейд. Обязательно вернусь снова!', NOW() - interval '1 day'),
      (2, 2, 4, 5, 'Прекрасный спа-уход и моделирование бороды. Распаривание полотенцем с маслами — это отдельный кайф!', NOW() - interval '3 days'),
      (3, 1, 1, 5, 'Хожу на мужскую модельную стрижку регулярно. Сервис на высшем уровне, кофе отличный.', NOW() - interval '5 days'),
      (4, 2, 2, 4, 'Удлиненная стрижка получилась аккуратной, текстура волос сохранена, спасибо мастеру!', NOW() - interval '6 days'),
      (5, 1, 7, 5, 'Сложное окрашивание AirTouch выполнено безукоризненно! Плавный переход тона и блеск волос.', NOW() - interval '8 days'),
      (6, 2, 10, 5, 'SPA-уход для волос восстановил структуру после лета, эффект заметен сразу же.', NOW() - interval '10 days'),
      (7, 1, 22, 5, 'Полный VIP-комплекс — просто восторг. Два мастера работали синхронно, сэкономил кучу времени!', NOW() - interval '12 days')
    ON CONFLICT (id_review) DO NOTHING;
    SELECT setval('reviews_id_review_seq', (SELECT COALESCE(MAX(id_review), 7) FROM reviews));
  `);

  console.log('Database initialized and seeded with 22+ services and full data!');
  await pool.end();
}

initDB().catch(err => {
  console.error('Failed to init DB:', err);
  process.exit(1);
});
