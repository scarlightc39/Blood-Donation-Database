const express = require('express');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'db_frontend.html'));
});

// Create MySQL connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '04@pril2004',
  database: 'blood_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Insert donor with manual bd_ID increment
app.post('/insert-donor', async (req, res) => {
  const { bd_name, bd_age, bd_sex, bd_Bgroup, bd_reg_date, reco_ID, city_ID } = req.body;
  if (!bd_name || !bd_age || !bd_sex || !bd_Bgroup || !bd_reg_date || !reco_ID || !city_ID) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Determine next bd_ID
    const [maxRows] = await pool.query('SELECT MAX(bd_ID) AS maxId FROM blood_donor');
    const nextId = (maxRows[0].maxId || 0) + 1;
    console.log('Next bd_ID:', nextId);

    // Perform insert
    await pool.query(
      `INSERT INTO blood_donor 
        (bd_ID, bd_name, bd_age, bd_sex, bd_Bgroup, bd_reg_date, reco_ID, city_ID) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [nextId, bd_name, bd_age, bd_sex, bd_Bgroup, bd_reg_date, reco_ID, city_ID]
    );

    res.json({ message: `Donor inserted with ID ${nextId}` });
  } catch (err) {
    console.error('Insert Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Show all donors
app.get('/show-all-donors', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM blood_donor');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Available blood groups
app.get('/available-blood-groups', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT bd_Bgroup AS blood_group, COUNT(*) AS count FROM blood_donor GROUP BY bd_Bgroup'
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Blood requests
app.get('/blood-requests', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM hospital_requirement');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Donors by city
app.get('/donors-by-city', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.city_name, COUNT(d.bd_ID) AS donor_count
       FROM blood_donor d
       JOIN city c ON d.city_ID = c.city_ID
       GROUP BY c.city_name`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Search donor by name or ID
app.get('/search-donor', async (req, res) => {
  const term = req.query.term;
  try {
    const [rows] = await pool.query(
      `SELECT * FROM blood_donor WHERE bd_name LIKE ? OR bd_ID = ?`,
      [`%${term}%`, isNaN(term) ? 0 : parseInt(term)]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Filter donors by blood group
app.get('/filter-donors', async (req, res) => {
  const { blood_group } = req.query;
  try {
    const [rows] = await pool.query(
      'SELECT * FROM blood_donor WHERE bd_Bgroup = ?',
      [blood_group]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Generic SQL query endpoint
app.post('/api/query', async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'No query provided' });
  try {
    const [rows, fields] = await pool.query(query);
    const columns = fields.map(f => f.name);
    const dataRows = rows.map(r => columns.map(c => r[c]));
    res.json({ columns, rows: dataRows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
