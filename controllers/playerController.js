const Player = require('../models/Player');

exports.createPlayer = async (req, res) => {
  try {
    const player = new Player(req.body);
    await player.save();
    res.status(201).send(player);
  } catch (error) {
    res.status(400).send(error);
  }
};

exports.getPlayers = async (req, res) => {
  try {
    const players = await Player.find();
    res.status(200).send(players);
  } catch (error) {
    res.status(400).send(error);
  }
};