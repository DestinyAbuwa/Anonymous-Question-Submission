// server.js
const express = require('express');
const cors = require('cors');

// Import our secret variables (so we can use process.env.PORT)
require('dotenv').config();

// Initialize the Express app
const app = express();

// Middleware: Allows our frontend to communicate securely with this backend
app.use(cors());

// Middleware: Tells the server to automatically understand JSON data sent from the frontend
app.use(express.json());

// A simple test route to make sure the server is alive
app.get('/', (req, res) => {
    res.send('Anonymous Q&A Server is running!');
});

// Start the server and listen on the port defined in our .env file (3000)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is officially listening on http://localhost:${PORT}`);
});