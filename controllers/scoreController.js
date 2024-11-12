const Score = require('../models/Score');

const createScore = async (req, res) => {
  try {
    const score = new Score(req.body);
    await score.save();
    res.status(201).send(score);
  } catch (error) {
    res.status(400).send(error);
  }
};

const getScores = async (req, res) => {
  try {
    const scores = await Score.find().populate('player');
    res.status(200).send(scores);
  } catch (error) {
    res.status(400).send(error);
  }
};

module.exports = {
  createScore,
  getScores,
};