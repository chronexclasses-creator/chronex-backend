const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ==========================================
// 1. MONGODB DATABASE CONNECTION (BULLETPROOF)
// ==========================================
// This handles both MONGODB_URI and MONGODB_URL safely
const dbConnectionLink = process.env.MONGODB_URI || process.env.MONGODB_URL;

if (dbConnectionLink) {
    mongoose.connect(dbConnectionLink)
        .then(() => console.log('Successfully connected to MongoDB Database!'))
        .catch(err => console.error('MongoDB Connection Error:', err));
} else {
    console.log('Warning: Neither MONGODB_URI nor MONGODB_URL is defined. Database connection skipped.');
}

// ==========================================
// 2. DATABASE SCHEMAS & MODELS
// ==========================================

// (A) Student Schema
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

// (B) Study Material Schema (For Admin Uploads)
const materialSchema = new mongoose.Schema({
    year: { type: String, required: true },
    className: { type: String, required: true },
    subject: { type: String, default: "Physics" },
    chapter: { type: String, required: true },
    lecture: { type: Number, required: true },
    details: { type: String, default: "" },
    link: { type: String, required: true }, // YouTube link
    pdfLink: { type: String, default: "" }, // Google Drive link
    timestamp: { type: Date, default: Date.now }
});
const Material = mongoose.model('Material', materialSchema);

// (C) Batch Access Code Schema (For Admin Generation)
const batchCodeSchema = new mongoose.Schema({
    code: { type: String, required: true, unique: true },
    className: { type: String, required: true },
    year: { type: String, required: true },
    isUsed: { type: Boolean, default: false },
    usedByEmail: { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
    usedAt: { type: Date, default: null }
});
const BatchCode = mongoose.model('BatchCode', batchCodeSchema);


// ==========================================
// 3. STUDENT REGISTRATION ROUTES
// ==========================================

// Check if student is already registered
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
        res.status(500).json({ error: "Server error while checking database." });
    }
});

// Register a new student
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
// 4. ADMIN CONTROL ROUTES (Upload & Generate)
// ==========================================

// Route to upload a new video/material to MongoDB
app.post('/api/admin/upload-material', async (req, res) => {
    try {
        const { year, className, chapter, lecture, details, link, pdfLink } = req.body;
        
        if (!year || !className || !chapter || !lecture || !link) {
            return res.status(400).json({ error: "Missing required fields for upload." });
        }

        const newMaterial = new Material({ year, className, chapter, lecture, details, link, pdfLink });
        await newMaterial.save();
        
        res.json({ message: "Material successfully saved to backend database!" });
    } catch (error) {
        res.status(500).json({ error: "Database error while saving material." });
    }
});

// Route to generate a new unique access code
app.post('/api/admin/generate-code', async (req, res) => {
    try {
        const { className, year, code } = req.body;

        if (!className || !year || !code) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        const newCode = new BatchCode({ code, className, year });
        await newCode.save();

        res.json({ message: "Access code successfully generated!" });
    } catch (error) {
        if(error.code === 11000) {
            return res.status(400).json({ error: "This code already exists." });
        }
        res.status(500).json({ error: "Database error while saving code." });
    }
});

// Route to fetch all generated codes (History)
app.get('/api/admin/codes-history', async (req, res) => {
    try {
        const codes = await BatchCode.find().sort({ createdAt: -1 }); // Sort newest first
        res.json(codes);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch code history." });
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

        const apiKey = process.env.GEMINI_API_KEY;
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
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
