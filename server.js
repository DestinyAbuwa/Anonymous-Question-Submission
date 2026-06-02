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

        // 4. Loop through the array of tags and save every single one!
        if (tags && tags.length > 0) {
            for (const tag of tags) {
                await pool.execute(
                    `INSERT INTO Tags (question_id, tag_name) VALUES (?, ?)`,
                    [newQuestionId, tag]
                );
            }
        }

        // 5. Send a success message back to the frontend
        res.status(201).json({ message: 'Question successfully submitted!' });

    } catch (error) {
        console.error('❌ Error saving question:', error);
        res.status(500).json({ error: 'Failed to save question to the database.' });
    }
});

// ==========================================
// API ROUTE: Fetch All Questions + Upvotes
// ==========================================
app.get('/api/questions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;

    try {
        // UPGRADE: We added a subquery to count the 'Upvote' rows in the Interactions table!
        // We also changed ORDER BY so the most upvoted questions float to the top of the feed.
        const [questions] = await pool.execute(`
            SELECT 
                q.question_id, q.content, q.timestamp, q.status, 
                GROUP_CONCAT(t.tag_name) AS tags,
                (SELECT COUNT(*) FROM Interactions i WHERE i.question_id = q.question_id AND i.interaction_type = 'Upvote') AS upvotes
            FROM Questions q
            LEFT JOIN Tags t ON q.question_id = t.question_id
            WHERE q.session_id = ?
            GROUP BY q.question_id
            ORDER BY upvotes DESC, q.timestamp DESC
        `, [sessionId]);

        res.status(200).json(questions);

    } catch (error) {
        console.error('❌ Error fetching questions:', error);
        res.status(500).json({ error: 'Failed to retrieve questions from the database.' });
    }
});

// ==========================================
// API ROUTE: Toggle Upvote (Add or Remove)
// ==========================================
app.post('/api/questions/:questionId/upvote', async (req, res) => {
    const { questionId } = req.params;
    const { user_id } = req.body;

    try {
        // 1. Check if the student has already upvoted this specific question
        const [existingUpvote] = await pool.execute(
            `SELECT * FROM Interactions WHERE question_id = ? AND user_id = ? AND interaction_type = 'Upvote'`,
            [questionId, user_id]
        );

        if (existingUpvote.length > 0) {
            // 2. The upvote exists! So we delete it (Remove Upvote)
            await pool.execute(
                `DELETE FROM Interactions WHERE question_id = ? AND user_id = ? AND interaction_type = 'Upvote'`,
                [questionId, user_id]
            );
            return res.status(200).json({ message: 'Upvote removed' });
        } else {
            // 3. The upvote does NOT exist! So we insert it (Add Upvote)
            await pool.execute(
                `INSERT INTO Interactions (question_id, user_id, interaction_type) VALUES (?, ?, 'Upvote')`,
                [questionId, user_id]
            );
            return res.status(200).json({ message: 'Upvote added' });
        }
    } catch (error) {
        console.error('❌ Error toggling upvote:', error);
        res.status(500).json({ error: 'Failed to process upvote.' });
    }
});

// Start the server and listen on the port defined in our .env file (3000)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server is officially listening on http://localhost:${PORT}`);
});