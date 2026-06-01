// config/db.js

// ==========================================
// 1. IMPORTING REQUIRED TOOLS
// ==========================================

// 'mysql2/promise' allows us to use modern async/await syntax instead of older, messy callbacks.
// This will make writing our actual SQL queries much cleaner later on.
const mysql = require('mysql2/promise');

// 'dotenv' finds our hidden .env file, reads the secret passwords inside, 
// and temporarily loads them into the server's memory (process.env) so they are kept safe.
require('dotenv').config();


// ==========================================
// 2. CREATING THE CONNECTION POOL
// ==========================================

// A "pool" creates a set of reusable connections rather than opening and closing a new one every time.
// This prevents the server from crashing if multiple students submit questions at the exact same second.
const pool = mysql.createPool({
    host: process.env.DB_HOST,         // e.g., 'localhost' (where the database lives)
    user: process.env.DB_USER,         // e.g., 'root' (your MySQL username)
    password: process.env.DB_PASSWORD, // The secret password pulled safely from .env
    database: process.env.DB_NAME,     // e.g., 'anonymous_qa_db' (the specific database we want to use)
    
    // Pool Management Rules:
    waitForConnections: true, // If all connections are busy, make new requests wait in line instead of failing
    connectionLimit: 10,      // Maximum number of connections open at once (like having 10 cashiers at a store)
    queueLimit: 0             // How many requests can wait in line? (0 means unlimited)
});


// ==========================================
// 3. TESTING THE CONNECTION ON STARTUP
// ==========================================

// When we start the server, we immediately try to borrow one connection just to test it.
// This way, if our password is wrong, it fails immediately rather than failing when a student tries to use it.
pool.getConnection()
    .then(connection => {
        // If successful, print a green success message to our VS Code terminal
        console.log('✅ MySQL Database Successfully Connected!');
        
        // CRITICAL: Always release the connection back to the pool so other users can use it!
        // If you forget this, the connection stays "busy" forever (a memory leak).
        connection.release();
    })
    .catch(err => {
        // If it fails (e.g., wrong password or MySQL Workbench is closed), print the exact error
        console.error('❌ Database Connection Failed:', err.message);
    });


// ==========================================
// 4. EXPORT THE ENGINE
// ==========================================

// This packages up our entire setup so we can easily import it into our main server file.
module.exports = pool;