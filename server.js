const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// IMPORTANT: Environment Variables
// (This was missing in your previous error)
// ==========================================
const MONGODB_URI = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ==========================================
// 1. MONGODB DATABASE CONNECTION
// ==========================================
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('Successfully connected to MongoDB Database!'))
        .catch(err => console.error('MongoDB Connection Error:', err));
} else {
    console.log('Warning: MONGODB_URI is not defined. Database connection skipped.');
}

// ==========================================
// 2. DATABASE SCHEMA (Student Data Structure)
// ==========================================
const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    studentClass: { type: String, required: true }, 
    joinYear: { type: String, required: true },
    batch: { type: String, default: "Not Assigned" },
    registeredAt: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

// ==========================================
// 3. STUDENT REGISTRATION ROUTES
// ==========================================

// (A) Check if student is already registered
app.get('/api/students/check/:email', async (req, res) => {
    try {
        const studentEmail = req.params.email;
        const existingStudent = await Student.findOne({ email: studentEmail });
        
        if (existingStudent) {
            return res.json({ isRegistered: true, student: existingStudent });
        } else {
            return res.json({ isRegistered: false });
        }
    } catch (error) {
        res.status(500).json({ error: "Server error while checking student in database." });
    }
});

// (B) Register a new student
app.post('/api/students/register', async (req, res) => {
    try {
        const { name, email, phone, studentClass, joinYear } = req.body;
        
        if (!name || !email || !phone || !studentClass) {
            return res.status(400).json({ error: "All fields are mandatory!" });
        }

        const newStudent = new Student({
            name, email, phone, studentClass,
            joinYear: joinYear || new Date().getFullYear().toString()
        });

        await newStudent.save();
        res.json({ message: "Registration Successful!", student: newStudent });

    } catch (error) {
        if(error.code === 11000) {
            return res.status(400).json({ error: "This email is already registered." });
        }
        res.status(500).json({ error: "Failed to save student data." });
    }
});

// ==========================================
// 4. ADMIN SEARCH ROUTE
// ==========================================
// Search student by Name or Email
app.get('/api/students/search', async (req, res) => {
    try {
        const searchQuery = req.query.q;
        if (!searchQuery) return res.status(400).json({ error: "Search query is required." });

        const students = await Student.find({
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } }, 
                { email: { $regex: searchQuery, $options: 'i' } }
            ]
        });
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: "Error occurred while searching." });
    }
});

// ==========================================
// 5. GEMINI AI ROUTE
// ==========================================
app.post('/api/chat', async (req, res) => {
    try {
        const userMessage = req.body.message;
        if (!userMessage) return res.status(400).json({ error: "Message is required!" });

        const systemInstruction = "You are a friendly and helpful Physics teacher AI for Chronex Classes. Keep answers short, clear, and easy to understand for class 11 & 12 students. Use formatting like bold, lists, and LaTeX equations where needed. If they ask in Bengali, reply in clear Bengali.";

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: userMessage }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] }
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || "Google API Error");
        res.json(data);

    } catch (error) {
        console.error("AI Error:", error.message);
        res.status(500).json({ error: "Backend AI failed to process the request." });
    }
});

// ==========================================
// 6. SERVER START
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Master Backend is running perfectly on port ${PORT}`);
});
