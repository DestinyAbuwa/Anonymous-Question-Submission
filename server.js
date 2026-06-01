// server.js
const express = require('express');
const cors = require('cors');

// Import our database connection pool
const pool = require('./config/db');


// Import our secret variables (so we can use process.env.PORT)
require('dotenv').config();

// Initialize the Express app
const app = express();

// Middleware: Allows our frontend to communicate securely with this backend
app.use(cors());

// Middleware: Tells the server to automatically understand JSON data sent from the frontend
app.use(express.json());


// Middleware: Serve static files (HTML, CSS, JS) from the 'public' folder
app.use(express.static('public'));

// ==========================================
// MIDDLEWARE: Advanced Profanity Filter
// ==========================================
const Filter = require('bad-words');

// Initialize the filter (it comes pre-loaded with thousands of words and leetspeak catchers)
const textFilter = new Filter();

// You can still add your own custom words to its massive dictionary!
textFilter.addWords('heck', 'darn', 'shoot'); 

const profanityFilter = (req, res, next) => {
    const { content } = req.body;

    // The .isProfane() method automatically checks for bad words, misspellings, and special characters
    if (textFilter.isProfane(content)) {
        return res.status(400).json({ error: 'Please keep questions professional and appropriate.' });
    }

    next();
};

// ==========================================
// API ROUTE: Submit a New Question
// ==========================================
app.post('/api/questions', profanityFilter, async (req, res) => {
    // 1. Unpack the data sent from the frontend script.js
    const { user_id, session_id, content, tag_name } = req.body;

    try {
        // 2. Insert the main question into the Questions table
        const [questionResult] = await pool.execute(
            `INSERT INTO Questions (user_id, session_id, content) VALUES (?, ?, ?)`,
            [user_id, session_id, content]
        );

        // 3. Grab the auto-generated ID of the question we just inserted
        const newQuestionId = questionResult.insertId;

        // 4. If the student selected a tag, insert it into the Tags table 
        // linked to the question ID we just generated!
        if (tag_name !== 'None') {
            await pool.execute(
                `INSERT INTO Tags (question_id, tag_name) VALUES (?, ?)`,
                [newQuestionId, tag_name]
            );
        }

        // 5. Send a success message back to the frontend
        res.status(201).json({ message: 'Question successfully submitted!' });

    } catch (error) {
        console.error('❌ Error saving question:', error);
        res.status(500).json({ error: 'Failed to save question to the database.' });
    }
});

// ==========================================
// API ROUTE: Fetch All Questions for a Session
// ==========================================
app.get('/api/questions/:sessionId', async (req, res) => {
    // Grab the session ID from the URL (e.g., /api/questions/1)
    const { sessionId } = req.params;

    try {
        // Query the database: Get the question details AND the tag name (if one exists)
        // We order by timestamp DESC so the newest questions appear at the top!
        const [questions] = await pool.execute(`
            SELECT q.question_id, q.content, q.timestamp, q.status, t.tag_name 
            FROM Questions q
            LEFT JOIN Tags t ON q.question_id = t.question_id
            WHERE q.session_id = ?
            ORDER BY q.timestamp DESC
        `, [sessionId]);

        // Send the array of questions back to the frontend
        res.status(200).json(questions);

    } catch (error) {
        console.error('❌ Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to retrieve questions from the database.' });
    }
});



// Start the server and listen on the port defined in our .env file (3000)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server is officially listening on http://localhost:${PORT}`);
});