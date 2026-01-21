const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

const db = new sqlite3.Database('./collegehelp.db', (err) => {
    if (err) { return console.error(err.message); }
    console.log('Connected to the CollegeHelp SQLite database.');
});

// Database schema setup (no changes)
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS departments (id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE)`);
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, user_type TEXT NOT NULL, department_id INTEGER, FOREIGN KEY (department_id) REFERENCES departments (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY, category TEXT, question TEXT, answer TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL, department_id INTEGER NOT NULL, assigned_staff_id INTEGER, question_text TEXT NOT NULL, answer_text TEXT, status TEXT NOT NULL, urgency TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES users (id), FOREIGN KEY (department_id) REFERENCES departments (id))`);
    db.run(`CREATE TABLE IF NOT EXISTS knowledge_base (id INTEGER PRIMARY KEY, topic TEXT NOT NULL, content TEXT NOT NULL, last_updated_by INTEGER, FOREIGN KEY (last_updated_by) REFERENCES users (id))`);
});

// --- API ENDPOINTS ---

// **UPDATED** FAQ Endpoint (includes resolved tickets)
app.get('/api/faqs', (req, res) => {
    const faqsSql = "SELECT category, question, answer FROM faqs";
    const ticketsSql = `
        SELECT t.question_text as question, t.answer_text as answer, d.name as category 
        FROM tickets t
        JOIN departments d ON t.department_id = d.id
        WHERE t.status = 'resolved' AND t.answer_text IS NOT NULL`;

    db.all(faqsSql, [], (err, faqs) => {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        db.all(ticketsSql, [], (err, resolvedTickets) => {
            if (err) { res.status(500).json({ "error": err.message }); return; }
            const combinedData = [...faqs, ...resolvedTickets];
            res.json({ "message": "success", "data": combinedData });
        });
    });
});

// **NEW** TICKET Endpoints for Staff Dashboard
app.get('/api/tickets/department/:id', (req, res) => {
    const { status } = req.query; // e.g., ?status=new
    const sql = `SELECT t.*, u.username as student_username FROM tickets t JOIN users u ON t.student_id = u.id WHERE t.department_id = ? AND t.status = ? ORDER BY t.updated_at DESC`;
    db.all(sql, [req.params.id, status], (err, rows) => {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "data": rows });
    });
});

app.get('/api/tickets/staff/:id', (req, res) => {
    const sql = `SELECT t.*, u.username as student_username FROM tickets t JOIN users u ON t.student_id = u.id WHERE t.assigned_staff_id = ? AND t.status = 'in_progress' ORDER BY t.updated_at DESC`;
    db.all(sql, [req.params.id], (err, rows) => {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "data": rows });
    });
});

app.put('/api/tickets/:id/assign', (req, res) => {
    const { staffId } = req.body;
    const sql = `UPDATE tickets SET assigned_staff_id = ?, status = 'in_progress', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [staffId, req.params.id], function(err) {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "changes": this.changes });
    });
});

app.put('/api/tickets/:id/resolve', (req, res) => {
    const { answer } = req.body;
    const sql = `UPDATE tickets SET answer_text = ?, status = 'resolved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
    db.run(sql, [answer, req.params.id], function(err) {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "changes": this.changes });
    });
});

// Endpoint for Student's "My Tickets"
// Endpoint for Student's "My Tickets"
app.get('/api/tickets/student/:id', (req, res) => {
    const studentId = req.params.id;
    
    // THIS IS THE CORRECTED SQL QUERY:
    // It now fetches all tickets for the student that are NOT 'closed'.
    const sql = "SELECT * FROM tickets WHERE student_id = ? AND status != 'closed' ORDER BY updated_at DESC";
    
    db.all(sql, [studentId], (err, rows) => {
        if (err) { 
            res.status(500).json({ "error": err.message }); 
            return; 
        }
        res.json({ "data": rows });
    });
});

// KNOWLEDGE BASE Endpoints
app.get('/api/kb', (req, res) => {
    const sql = "SELECT * FROM knowledge_base ORDER BY topic";
    db.all(sql, [], (err, rows) => {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "data": rows });
    });
});
app.post('/api/kb', (req, res) => {
    const { topic, content, staff_id } = req.body;
    const sql = `INSERT INTO knowledge_base (topic, content, last_updated_by) VALUES (?, ?, ?)`;
    db.run(sql, [topic, content, staff_id], function(err) {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "id": this.lastID });
    });
});
app.put('/api/kb/:id', (req, res) => {
    const { topic, content, staff_id } = req.body;
    const sql = `UPDATE knowledge_base SET topic = ?, content = ?, last_updated_by = ? WHERE id = ?`;
    db.run(sql, [topic, content, staff_id, req.params.id], function(err) {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "changes": this.changes });
    });
});
app.delete('/api/kb/:id', (req, res) => {
    const sql = 'DELETE FROM knowledge_base WHERE id = ?';
    db.run(sql, req.params.id, function(err) {
        if (err) { res.status(500).json({ "error": err.message }); return; }
        res.json({ "deleted": this.changes });
    });
});

// AI CHATBOT Endpoint
// --- AI CHATBOT ENDPOINT (CORRECTED) ---
app.post('/api/ask', async (req, res) => {
    const { question, userId } = req.body;
    if (!question || !userId) {
        return res.status(400).json({ error: 'Question and userId are required.' });
    }

    try {
        // Step 1: Get knowledge base context from the database
        const kbRows = await new Promise((resolve, reject) => {
            db.all("SELECT topic, content FROM knowledge_base", [], (err, rows) => (err ? reject(err) : resolve(rows)));
        });
        const context = kbRows.map(row => `Topic: ${row.topic}\nContent: ${row.content}`).join('\n\n---\n\n');

        // Step 2: Construct the INITIAL prompt to try and answer the question
        const initialPrompt = `
            You are "CollegeHelp," an AI assistant. Answer the student's question based ONLY on the provided information from the college's knowledge base or greet peoples.
            If the answer is not in the provided information, you MUST respond with the exact phrase: "I do not have enough information to answer that question."

            --- KNOWLEDGE BASE START ---
            ${context}
            --- KNOWLEDGE BASE END ---

            Student's Question: "${question}"
        `;

        // Step 3: Call the Gemini API
        const result = await model.generateContent(initialPrompt);
        const response = await result.response;
        let text = response.text();

        // Step 4: If the AI can't answer, classify the question to find the right department
        if (text.includes("I do not have enough information")) {
            
            // --- NEW TWO-STEP LOGIC STARTS HERE ---
            
            // 4a. Get the list of departments from our database
            const departments = await new Promise((resolve, reject) => {
                db.all("SELECT id, name FROM departments", [], (err, rows) => (err ? reject(err) : resolve(rows)));
            });

            const departmentList = departments.map(d => `- ${d.name}`).join('\n');

            // 4b. Create a new, specialized "classification" prompt
            const classificationPrompt = `
                You are a request router for a college. Your job is to classify a student's question into one of the following departments. 
                Respond with ONLY the single most relevant department name from the list and nothing else.

                Available Departments:
                1.admission
                2.finance
                3.campus life
                4.academics
                5.it support

                Student's Question: "${question}"

                Department:
            `;

            // 4c. Call the Gemini API a second time for classification
            const classificationResult = await model.generateContent(classificationPrompt);
            const classificationResponse = await classificationResult.response;
            const departmentName = classificationResponse.text().trim();

            // 4d. Find the ID of the department the AI chose
            const targetDepartment = departments.find(d => d.name.toLowerCase() === departmentName.toLowerCase());
            const departmentId = targetDepartment ? targetDepartment.id : 4; // Default to 'Academics' if something goes wrong

            // 4e. Create the ticket with the dynamically found department ID
            text = `I'm sorry, I couldn't find a confident answer. I have created a ticket and routed it to the **${departmentName}** department for you.`;
            const ticketSql = `INSERT INTO tickets (student_id, department_id, question_text, status, urgency) VALUES (?, ?, ?, ?, ?)`;
            await new Promise((resolve, reject) => {
                db.run(ticketSql, [userId, departmentId, question, 'new', 'medium'], (err) => (err ? reject(err) : resolve()));
            });
        }
        
        // Step 5: Send the final response
        res.json({ answer: text });

    } catch (error) {
        console.error("Error in /api/ask endpoint:", error);
        res.status(500).json({ error: "Failed to process the AI request." });
    }
});

// USER AUTH Endpoints
app.post('/register', (req, res) => {
    const { username, password, user_type } = req.body;
    const sql = 'INSERT INTO users (username, password, user_type) VALUES (?, ?, ?)';
    db.run(sql, [username, password, user_type], function (err) {
        if (err) { return res.status(500).json({ "error": err.message }); }
        res.status(201).json({ message: 'User registered successfully!', userId: this.lastID });
    });
});
app.post('/login', (req, res) => {
    const { username, password, user_type } = req.body;
    const sql = 'SELECT * FROM users WHERE username = ? AND password = ? AND user_type = ?';
    db.get(sql, [username, password, user_type], (err, row) => {
        if (err) { return res.status(500).json({ "error": err.message }); }
        if (row) { res.status(200).json({ message: 'Login successful!', user: row }); } 
        else { res.status(401).json({ message: 'Invalid username, password, or user type.' }); }
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});