const mongoose = require('mongoose');

const CATEGORIES = [
  'electronics',
  'pets',
  'documents',
  'personal_belongings',
  'keys',
  'clothing',
  'accessories',
  'bags',
  'wallets',
  'jewelry',
  'sports_equipment',
  'musical_instruments',
  'toys',
  'books',
  'others',
];

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
  },
  category: {
    type: String,
    enum: CATEGORIES,
    default: 'others',
  },
  type: {
    type: String,
    enum: ['lost', 'found'],
    required: [true, 'Type (lost/found) is required'],
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true,
  },
  date: {
    type: Date,
    required: [true, 'Date is required'],
  },
  contactEmail: {
    type: String,
    required: [true, 'Contact email is required'],
    trim: true,
  },
  contactPhone: {
    type: String,
    trim: true,
    default: '',
  },
  image: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending', 'recovered'],
    default: 'pending',
  },
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);
module.exports.CATEGORIES = CATEGORIES;
