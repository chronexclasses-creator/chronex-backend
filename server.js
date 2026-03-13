const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 Environment Variables (Porobortite Render-e set korbo)
const MONGODB_URL = process.env.MONGODB_URI;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ==========================================
// 🗄️ 1. MONGODB DATABASE CONNECTION
// ==========================================
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => console.log('✅ MongoDB Database-er sathe successfully connect hoyeche!'))
        .catch(err => console.error('❌ MongoDB Connection Error:', err));
} else {
    console.log('⚠️ Warning: Database link nei. Ekhon database kaaj korbe na.');
}

// ==========================================
// 📂 2. DATABASE STRUCTURE (Student Data)
// ==========================================
// Tui jemon cheyechili: Year > Class > Batch > Student Details
const studentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Email ta unique hobe
    phone: { type: String, required: true },
    studentClass: { type: String, required: true }, // "11", "12", ba "Dropper"
    joinYear: { type: String, required: true }, // Jemon: "2024", "2025"
    batch: { type: String, default: "Not Assigned" }, // Pore update kora jabe
    registeredAt: { type: Date, default: Date.now }
});

const Student = mongoose.model('Student', studentSchema);

// ==========================================
// 📝 3. STUDENT REGISTRATION ROUTES
// ==========================================

// (A) Check kora je student aage theke ache kina (Purono student der jate form na ashe)
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
        res.status(500).json({ error: "Database checking error." });
    }
});

// (B) Notun student-er data save kora
app.post('/api/students/register', async (req, res) => {
    try {
        const { name, email, phone, studentClass, joinYear } = req.body;
        
        // Basic Check: Sob data diyeche kina
        if (!name || !email || !phone || !studentClass) {
            return res.status(400).json({ error: "Sob field mandatory!" });
        }

        const newStudent = new Student({
            name, email, phone, studentClass,
            joinYear: joinYear || new Date().getFullYear().toString()
        });

        await newStudent.save();
        res.json({ message: "✅ Registration Successful!", student: newStudent });

    } catch (error) {
        // Jodi aki email diye aabar keu chesta kore
        if(error.code === 11000) {
            return res.status(400).json({ error: "Ei email ta aage thekei registered ache." });
        }
        res.status(500).json({ error: "Student data save korte giye error hoyeche." });
    }
});

// ==========================================
// 🔍 4. ADMIN SEARCH ROUTE (Student khuje paoar jonno)
// ==========================================
// Nam ba Email diye search kora
app.get('/api/students/search', async (req, res) => {
    try {
        const searchQuery = req.query.q;
        if (!searchQuery) return res.status(400).json({ error: "Search query dite hobe." });

        const students = await Student.find({
            $or: [
                { name: { $regex: searchQuery, $options: 'i' } }, // 'i' mane boro/choto haat matter korbe na
                { email: { $regex: searchQuery, $options: 'i' } }
            ]
        });
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: "Search korte giye problem hoyeche." });
    }
});

// ==========================================
// 🤖 5. GEMINI AI ROUTE
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
        res.status(500).json({ error: "Backend AI fail koreche." });
    }
});

// ==========================================
// 🚀 SERVER START
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Master Backend is running perfectly on port ${PORT}`);
});
