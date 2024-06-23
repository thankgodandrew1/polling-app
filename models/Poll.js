const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true,
  },
  options: {
    type: [String],
    required: true,
  },
  votes: {
    type: [Number],
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // voters: {
  //   type: [mongoose.Schema.Types.ObjectId],
  //   ref: 'User',
  //   default: [],
  // },
});

module.exports = mongoose.model('Poll', pollSchema);
