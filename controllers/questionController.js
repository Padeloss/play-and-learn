const Question = require('../models/Question');

const createQuestion = async (req, res) => {
  try {
    const question = new Question(req.body);
    await question.save();
    res.status(201).send(question);
  } catch (error) {
    res.status(400).send(error);
  }
};

const getQuestions = async (req, res) => {
  try {
    const questions = await Question.find();
    res.status(200).send(questions);
  } catch (error) {
    res.status(400).send(error);
  }
};

module.exports = {
  createQuestion,
  getQuestions,
};