// Import our secret variables (so we can use process.env.PORT)
require('dotenv').config();

const jwt = require('jsonwebtoken');

// We need a secret key to sign our badges. In production, this goes in your .env file!
const JWT_SECRET = process.env.JWT_SECRET; //|| 'super-secret-class-qa-key';

// server.js
const express = require('express');
const cors = require('cors');

// Import our database connection pool
const pool = require('./config/db');

const bcrypt = require('bcrypt');


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
// MIDDLEWARE: JWT Security Guard
// ==========================================
const authenticateToken = (req, res, next) => {
    // 1. Look for the badge in the headers
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Format is "Bearer <token>"

    if (!token) return res.status(401).json({ error: 'Access denied. Please log in.' });

    // 2. Verify the badge is real and hasn't expired
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });

        // 3. Attach the user's data (like their user_id) to the request!
        req.user = user;
        next(); // Let them pass
    });
};

// ==========================================
// API ROUTE: Submit a New Question (FIXED)
// ==========================================
// Notice we added 'authenticateToken' right before 'profanityFilter'
app.post('/api/questions', authenticateToken, profanityFilter, async (req, res) => {
    // Look! We don't grab user_id from req.body anymore! We grab it from the secure badge.
    const user_id = req.user.user_id;
    const { session_id, content, tags } = req.body;

    // ... the rest of your database insertion code stays exactly the same!

    try {
        const [questionResult] = await pool.execute(
            `INSERT INTO Questions (user_id, session_id, content) VALUES (?, ?, ?)`,
            [user_id, session_id, content]
        );

        const newQuestionId = questionResult.insertId;

        // Loop through the array of tags and save every single one!
        if (tags && tags.length > 0) {
            for (const tag of tags) {
                await pool.execute(
                    `INSERT INTO Tags (question_id, tag_name) VALUES (?, ?)`,
                    [newQuestionId, tag]
                );
            }
        }

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
            WHERE q.session_id = ? AND q.status = 'Pending'
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
app.post('/api/questions/:questionId/upvote', authenticateToken, async (req, res) => {
    const { questionId } = req.params;
    const user_id = req.user.user_id; // Securely pulled from the badge!

    // ... the rest of the upvote logic stays exactly the same!

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

// ==========================================
// API ROUTE: Mark Question as Answered
// ==========================================
app.patch('/api/questions/:questionId/answer', async (req, res) => {
    const { questionId } = req.params;
    try {
        // Change the status from 'Pending' to 'Answered'
        await pool.execute(`UPDATE Questions SET status = 'Answered' WHERE question_id = ?`, [questionId]);
        res.status(200).json({ message: 'Question marked as answered!' });
    } catch (error) {
        console.error('❌ Error updating status:', error);
        res.status(500).json({ error: 'Failed to update question status.' });
    }
});

// ==========================================
// API ROUTE: User Registration (WITH AUTO-LOGIN)
// ==========================================
app.post('/api/register', async (req, res) => {
    const { email, password, role } = req.body;
    const finalRole = role || 'Student';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.execute(
            `INSERT INTO Users (email, password_hash, role) VALUES (?, ?, ?)`,
            [email, hashedPassword, finalRole]
        );

        // NEW: Generate the ID badge immediately!
        const token = jwt.sign(
            { user_id: result.insertId, role: finalRole, email: email },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Send the badge back just like the login route does
        res.status(201).json({
            message: 'Account created securely!',
            token: token,
            role: finalRole
        });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email already exists. Please log in.' });
        }
        console.error('❌ Error registering user:', error);
        res.status(500).json({ error: 'Failed to register user.' });
    }
});


// ==========================================
// API ROUTE: User Login
// ==========================================
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // 1. Get the user
        const [rows] = await pool.execute('SELECT * FROM Users WHERE email = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ error: 'User not found.' });
        }

        const user = rows[0];

        // 2. Debug: Check if role actually exists in the DB response
        console.log("Database user object:", user); 

        // 3. Verify Password
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match) {
            return res.status(401).json({ error: 'Invalid password.' });
        }

        // 4. Generate Token (Ensure JWT_SECRET is loaded from .env)
        const token = jwt.sign(
            { user_id: user.user_id, role: user.role, email: user.email },
            process.env.JWT_SECRET, // Make sure this isn't undefined!
            { expiresIn: '24h' }
        );

        // 5. Send Response
        res.status(200).json({ 
            message: 'Login successful!',
            token: token,
            role: user.role // Verify this is actually sending the data
        });

    } catch (error) {
        console.error('❌ Login Error:', error); // THIS WILL SHOW THE REAL ERROR IN THE TERMINAL
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// Start the server and listen on the port defined in our .env file (4000)
const PORT = process.env.PORT; //|| 4000;

app.listen(PORT, () => {
    console.log(`🚀 Server is officially listening on http://localhost:${PORT}`);
});