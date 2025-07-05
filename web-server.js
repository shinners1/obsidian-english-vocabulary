const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/vocabulary', (req, res) => {
    const vocabPath = path.join(__dirname, 'data', 'vocabulary.json');
    if (fs.existsSync(vocabPath)) {
        const data = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));
        res.json(data);
    } else {
        res.json({ words: [] });
    }
});

app.post('/api/vocabulary', (req, res) => {
    const vocabPath = path.join(__dirname, 'data', 'vocabulary.json');
    const data = req.body;
    
    if (!fs.existsSync(path.dirname(vocabPath))) {
        fs.mkdirSync(path.dirname(vocabPath), { recursive: true });
    }
    
    fs.writeFileSync(vocabPath, JSON.stringify(data, null, 2));
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Obsidian Vocabulary Web Server running on port ${PORT}`);
});