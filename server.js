require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
// Add this near the top of server.js with your other requires
const crypto = require('crypto');

// NEW: Import HTTP and Socket.io
const http = require('http');
const { Server } = require('socket.io');

const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
// NEW: Wrap Express in an HTTP server
const server = http.createServer(app);
// NEW: Initialize Socket.io
const io = new Server(server, {
    cors: { origin: "*" } // Allows frontend to connect
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// NEW: Socket.io Connection Logic
io.on('connection', (socket) => {
    // When a user opens a live feed, they join a specific "room" for that session
    socket.on('joinSession', (sessionId) => {
        socket.join(sessionId);
    });
});

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
// --- 1. NEW QUESTION ROUTE ---
app.post('/api/questions', authenticateToken, profanityFilter, async (req, res) => {
    const user_id = req.user.user_id;
    const { session_id, content, tags } = req.body;

    try {
        const [sessionCheck] = await pool.execute('SELECT is_active FROM Sessions WHERE session_id = ?', [session_id]);
        if (sessionCheck.length === 0 || sessionCheck[0].is_active === 0) {
            return res.status(403).json({ error: 'This Q&A session is closed.' });
        }

        const [questionResult] = await pool.execute(
            `INSERT INTO Questions (user_id, session_id, content) VALUES (?, ?, ?)`,
            [user_id, session_id, content]
        );

        if (tags && tags.length > 0) {
            for (const tag of tags) {
                await pool.execute(`INSERT INTO Tags (question_id, tag_name) VALUES (?, ?)`, [questionResult.insertId, tag]);
            }
        }

        // NEW: Tell everyone in this session's room to instantly refresh!
        io.to(session_id).emit('updateFeed');
        res.status(201).json({ message: 'Question successfully submitted!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to save question.' });
    }
});

// ==========================================
// API ROUTE: Fetch All Questions (UPDATED WITH PIN SORTING)
// ==========================================
app.get('/api/questions/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const sortMode = req.query.sort || 'upvotes';

    // Pinned questions ALWAYS float to the absolute top, followed by the selected sort
    let orderClause = 'ORDER BY q.is_pinned DESC, upvotes DESC, q.timestamp DESC';
    if (sortMode === 'recent') {
        orderClause = 'ORDER BY q.is_pinned DESC, q.timestamp DESC';
    }

    try {
        const [questions] = await pool.execute(`
            SELECT 
                q.question_id, q.content, q.timestamp, q.status, q.is_pinned,
                GROUP_CONCAT(t.tag_name) AS tags,
                (SELECT COUNT(*) FROM Interactions i WHERE i.question_id = q.question_id AND i.interaction_type = 'Upvote') AS upvotes
            FROM Questions q
            LEFT JOIN Tags t ON q.question_id = t.question_id
            WHERE q.session_id = ? AND (q.status = 'Pending' OR q.status = 'Displayed')
            GROUP BY q.question_id
            ${orderClause}
        `, [sessionId]);

        res.status(200).json(questions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to retrieve questions.' });
    }
});

// ==========================================
// API ROUTE: Schedule a Future Session (SQL HOOKED UP)
// ==========================================
app.post('/api/sessions/schedule', authenticateToken, async (req, res) => {
    const { class_id, session_name, start_time, end_time, recurring_days } = req.body;

    try {
        const [authCheck] = await pool.execute(
            'SELECT * FROM Classes WHERE class_id = ? AND instructor_id = ?',
            [class_id, req.user.user_id]
        );

        if (authCheck.length === 0) return res.status(403).json({ error: 'Unauthorized.' });

        // SQL INSERTION READY!
        await pool.execute(
            'INSERT INTO Sessions (class_id, session_name, is_active, start_time, end_time, recurring_days) VALUES (?, ?, FALSE, ?, ?, ?)',
            [class_id, session_name, start_time, end_time, recurring_days]
        );

        res.status(201).json({ message: 'Session scheduled successfully!' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to schedule session.' });
    }
});



// --- 3. HELPER ROUTE FOR INSTRUCTOR ACTIONS (Answer, Pin, Live) ---
// Add this helper function above your instructor PATCH routes to prevent repeating code
async function broadcastUpdate(questionId) {
    const [qData] = await pool.execute('SELECT session_id FROM Questions WHERE question_id = ?', [questionId]);
    if (qData.length > 0) io.to(qData[0].session_id).emit('updateFeed');
}


// ==========================================
// API ROUTE: Mark Question as Answered
// ==========================================
app.patch('/api/questions/:questionId/answer', authenticateToken, async (req, res) => {
    await pool.execute(`UPDATE Questions SET status = 'Answered' WHERE question_id = ?`, [req.params.questionId]);
    await broadcastUpdate(req.params.questionId); // NEW
    res.status(200).json({ message: 'Question answered!' });
});


// ==========================================
// API ROUTE: Toggle "Answering Live"
// ==========================================
app.patch('/api/questions/:questionId/live', authenticateToken, async (req, res) => {
    await pool.execute(`UPDATE Questions SET status = ? WHERE question_id = ?`, [req.body.status, req.params.questionId]);
    await broadcastUpdate(req.params.questionId); // NEW
    res.status(200).json({ message: 'Live status updated!' });
});

// ==========================================
// API ROUTE: Toggle "Pin"
// ==========================================
app.patch('/api/questions/:questionId/pin', authenticateToken, async (req, res) => {
    await pool.execute(`UPDATE Questions SET is_pinned = NOT is_pinned WHERE question_id = ?`, [req.params.questionId]);
    await broadcastUpdate(req.params.questionId); // NEW
    res.status(200).json({ message: 'Pin toggled!' });
});


// ==========================================
// API ROUTE: Toggle Upvote (Add or Remove)
// ==========================================
app.post('/api/questions/:questionId/upvote', authenticateToken, async (req, res) => {
    const { questionId } = req.params;
    const user_id = req.user.user_id;

    try {
        // Fetch the session_id so we know which room to broadcast to
        const [qData] = await pool.execute('SELECT session_id FROM Questions WHERE question_id = ?', [questionId]);
        const sessionId = qData[0].session_id;

        const [existingUpvote] = await pool.execute(
            `SELECT * FROM Interactions WHERE question_id = ? AND user_id = ? AND interaction_type = 'Upvote'`,
            [questionId, user_id]
        );

        if (existingUpvote.length > 0) {
            await pool.execute(`DELETE FROM Interactions WHERE question_id = ? AND user_id = ? AND interaction_type = 'Upvote'`, [questionId, user_id]);
            io.to(sessionId).emit('updateFeed'); // NEW: Broadcast
            return res.status(200).json({ message: 'Upvote removed' });
        } else {
            await pool.execute(`INSERT INTO Interactions (question_id, user_id, interaction_type) VALUES (?, ?, 'Upvote')`, [questionId, user_id]);
            io.to(sessionId).emit('updateFeed'); // NEW: Broadcast
            return res.status(200).json({ message: 'Upvote added' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to process upvote.' });
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
        //console.log("Database user object:", user);

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
            role: user.role,
            user_id: user.user_id // Add this!
        });

    } catch (error) {
        console.error('❌ Login Error:', error); // THIS WILL SHOW THE REAL ERROR IN THE TERMINAL
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 1. Instructor creates a class (SECURE)
app.post('/api/create-class', authenticateToken, async (req, res) => {
    const { class_name } = req.body; // No longer taking instructor_id from body!
    const instructor_id = req.user.user_id; // Take it from the secure token
    const join_code = Math.random().toString(36).substring(2, 8).toUpperCase();

    try {
        await pool.execute(
            'INSERT INTO Classes (class_name, instructor_id, join_code) VALUES (?, ?, ?)',
            [class_name, instructor_id, join_code]
        );
        res.status(201).json({ message: 'Class created!', join_code });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error creating class.' });
    }
});

// 2. Student joins a class (SECURE + ENROLLMENT LOGIC)
app.post('/api/join-class', authenticateToken, async (req, res) => {
    const { join_code } = req.body;
    const user_id = req.user.user_id; // Take it from the secure token

    try {
        // Find the class first
        const [classes] = await pool.execute('SELECT class_id FROM Classes WHERE join_code = ?', [join_code]);
        if (classes.length === 0) return res.status(404).json({ error: 'Invalid code.' });

        const class_id = classes[0].class_id;

        // NOW: Actually insert into your Enrollments table
        await pool.execute('INSERT IGNORE INTO Enrollments (user_id, class_id) VALUES (?, ?)', [user_id, class_id]);

        res.status(200).json({ message: 'Joined class!', class_id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Database error joining class.' });
    }
});

// ==========================================
// API ROUTE: Fetch classes for the Instructor
// ==========================================
app.get('/api/my-classes', authenticateToken, async (req, res) => {
    try {
        const [classes] = await pool.execute(
            'SELECT * FROM Classes WHERE instructor_id = ? ORDER BY class_id DESC',
            [req.user.user_id]
        );
        res.status(200).json(classes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load classes' });
    }
});

// ==========================================
// API ROUTE: Fetch classes for the Student
// ==========================================
app.get('/api/enrolled-classes', authenticateToken, async (req, res) => {
    try {
        const [classes] = await pool.execute(`
            SELECT c.* FROM Classes c 
            JOIN Enrollments e ON c.class_id = e.class_id 
            WHERE e.user_id = ? ORDER BY c.class_id DESC
        `, [req.user.user_id]);
        res.status(200).json(classes);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to load enrolled classes' });
    }
});

// ==========================================
// API ROUTE: Start a Live Q&A Session
// ==========================================
app.post('/api/sessions/start', authenticateToken, async (req, res) => {
    const { class_id, session_name } = req.body;

    try {
        // 1. Verify the user is an instructor for this class (Security Check)
        const [authCheck] = await pool.execute(
            'SELECT * FROM Classes WHERE class_id = ? AND instructor_id = ?',
            [class_id, req.user.user_id]
        );

        if (authCheck.length === 0) {
            return res.status(403).json({ error: 'Unauthorized to start a session for this class.' });
        }

        // 2. Create the new active session
        const [result] = await pool.execute(
            'INSERT INTO Sessions (class_id, session_name, is_active) VALUES (?, ?, TRUE)',
            [class_id, session_name]
        );

        res.status(201).json({
            message: 'Session started!',
            session_id: result.insertId
        });

    } catch (error) {
        console.error('❌ Error starting session:', error);
        res.status(500).json({ error: 'Failed to start session.' });
    }
});

// ==========================================
// API ROUTE: End a Live Q&A Session
// ==========================================
app.patch('/api/sessions/:sessionId/end', authenticateToken, async (req, res) => {
    const { sessionId } = req.params;

    try {
        // Update the session to inactive and stamp the end time
        await pool.execute(
            'UPDATE Sessions SET is_active = FALSE, end_time = CURRENT_TIMESTAMP WHERE session_id = ?',
            [sessionId]
        );

        res.status(200).json({ message: 'Session closed successfully. No more questions can be asked.' });

    } catch (error) {
        console.error('❌ Error closing session:', error);
        res.status(500).json({ error: 'Failed to close session.' });
    }
});

// ==========================================
// API ROUTE: Get details for a specific class
// ==========================================
app.get('/api/classes/:classId', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM Classes WHERE class_id = ?', [req.params.classId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Class not found.' });
        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('❌ Error fetching class:', error);
        res.status(500).json({ error: 'Failed to retrieve class details.' });
    }
});

// ==========================================
// API ROUTE: Schedule a Future Session
// ==========================================
app.post('/api/sessions/schedule', authenticateToken, async (req, res) => {
    const { class_id, session_name, start_time } = req.body;

    try {
        // Verify ownership
        const [authCheck] = await pool.execute(
            'SELECT * FROM Classes WHERE class_id = ? AND instructor_id = ?',
            [class_id, req.user.user_id]
        );

        if (authCheck.length === 0) return res.status(403).json({ error: 'Unauthorized.' });

        // Insert as inactive initially, with a future start time
        await pool.execute(
            'INSERT INTO Sessions (class_id, session_name, is_active, start_time) VALUES (?, ?, FALSE, ?)',
            [class_id, session_name, start_time]
        );

        res.status(201).json({ message: 'Session scheduled successfully!' });

    } catch (error) {
        console.error('❌ Error scheduling session:', error);
        res.status(500).json({ error: 'Failed to schedule session.' });
    }
});

// ==========================================
// API ROUTE: Get Active Session for a Class
// ==========================================
app.get('/api/classes/:classId/active-session', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.execute(
            'SELECT session_id, session_name FROM Sessions WHERE class_id = ? AND is_active = TRUE ORDER BY start_time DESC LIMIT 1',
            [req.params.classId]
        );
        if (rows.length === 0) return res.status(200).json({ active: false });
        res.status(200).json({ active: true, session: rows[0] });
    } catch (error) {
        console.error('❌ Error fetching active session:', error);
        res.status(500).json({ error: 'Failed to retrieve active session.' });
    }
});

// ==========================================
// API ROUTE: Get Active Sessions for Instructor
// ==========================================
app.get('/api/instructor/active-sessions', authenticateToken, async (req, res) => {
    try {
        const [activeSessions] = await pool.execute(`
            SELECT s.session_id, s.session_name, s.class_id, c.class_name, c.join_code 
            FROM Sessions s
            JOIN Classes c ON s.class_id = c.class_id
            WHERE c.instructor_id = ? AND s.is_active = TRUE
            ORDER BY s.session_id DESC
        `, [req.user.user_id]);

        res.status(200).json(activeSessions);
    } catch (error) {
        console.error('❌ Error fetching active sessions:', error);
        res.status(500).json({ error: 'Failed to retrieve active sessions.' });
    }
});




// ==========================================
// API ROUTE: Request Password Reset
// ==========================================
app.post('/api/reset-password', async (req, res) => {
    const { email } = req.body;
    
    try {
        // 1. Generate a secure, random 64-character token
        const resetToken = crypto.randomBytes(32).toString('hex');
        
        // 2. Set expiration for 1 hour from now
        const expireDate = new Date(Date.now() + 3600000); 

        // 3. Save it to the database
        const [result] = await pool.execute(
            'UPDATE Users SET reset_token = ?, reset_expires = ? WHERE email = ?',
            [resetToken, expireDate, email]
        );

        if (result.affectedRows > 0) {
            // SIMULATED EMAIL - In production, use NodeMailer/Resend here
            console.log('\n=============================================');
            console.log('🚨 SIMULATED PASSWORD RESET EMAIL 🚨');
            console.log(`To: ${email}`);
            console.log(`Link: http://localhost:${PORT}/reset.html?token=${resetToken}`);
            console.log('=============================================\n');
        }

        // Security best practice: Always return success even if the email doesn't exist 
        // to prevent hackers from "guessing" which emails are registered.
        res.status(200).json({ message: 'If the email exists, a reset link has been sent.' });

    } catch (error) {
        console.error('❌ Error requesting password reset:', error);
        res.status(500).json({ error: 'Failed to process request.' });
    }
});

// ==========================================
// API ROUTE: Execute Password Reset
// ==========================================
app.post('/api/update-password', async (req, res) => {
    const { token, newPassword } = req.body;

    try {
        // 1. Find the user with this token, ensuring it hasn't expired
        const [users] = await pool.execute(
            'SELECT user_id FROM Users WHERE reset_token = ? AND reset_expires > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token.' });
        }

        // 2. Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // 3. Update the password and instantly wipe the token so it can't be used again
        await pool.execute(
            'UPDATE Users SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE user_id = ?',
            [hashedPassword, users[0].user_id]
        );

        res.status(200).json({ message: 'Password successfully updated! You can now log in.' });

    } catch (error) {
        console.error('❌ Error updating password:', error);
        res.status(500).json({ error: 'Failed to update password.' });
    }
});










// Start the server and listen on the port defined in our .env file (4000)
const PORT = process.env.PORT; //|| 4000;

server.listen(PORT, () => {
    console.log(`🚀 Server is officially listening on http://localhost:${PORT}`);
});