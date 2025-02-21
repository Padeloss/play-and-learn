const fs = require('fs');
const path = require('path');

const lessonsPath = path.join(__dirname, '../lessons');
const scoresFile = path.join(__dirname, '../scores.json');

const getQuestions = async (req, res) => {
    try {
        const { subject, difficulty } = req.params;
        const filePath = path.join(lessonsPath, subject, `${difficulty}.json`);
        console.log("Trying to read file at:", filePath);

        
        if (!fs.existsSync(filePath)) {
            return res.status(404).send({ error: 'File not found' });
        }
        
        const data = fs.readFileSync(filePath);
        const questions = JSON.parse(data);
        res.status(200).send(questions);
    } catch (error) {
        res.status(500).send({ error: 'Server error' });
    }
};

const updateScore = (req, res) => {
    try {
        const { player, score } = req.body;
        let scores = {};
        
        if (fs.existsSync(scoresFile)) {
            const data = fs.readFileSync(scoresFile);
            scores = JSON.parse(data);
        }
        
        scores[player] = (scores[player] || 0) + score;
        fs.writeFileSync(scoresFile, JSON.stringify(scores, null, 2));
        
        res.status(200).send({ message: 'Score updated', scores });
    } catch (error) {
        res.status(500).send({ error: 'Server error' });
    }
};

module.exports = { getQuestions, updateScore };
