const express = require('express');
const { body, validationResult } = require('express-validator');
const Item = require('../models/Item');
const { CATEGORIES } = require('../models/Item');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const User = require('../models/User');

const router = express.Router();

// GET /api/items/categories - get list of categories
router.get('/categories', (req, res) => {
  res.json({ categories: CATEGORIES });
});

// GET /api/items - fetch all items (public)
router.get('/', async (req, res) => {
  try {
    const { type, category, status, search } = req.query;
    const filter = {};

    if (type && ['lost', 'found'].includes(type)) filter.type = type;
    if (category && CATEGORIES.includes(category)) filter.category = category;
    if (status && ['pending', 'recovered'].includes(status)) filter.status = status;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
      ];
    }

    const items = await Item.find(filter)
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/items/my - get current user's items
router.get('/my', auth, async (req, res) => {
  try {
    const items = await Item.find({ reportedBy: req.user.id })
      .populate('reportedBy', 'name email')
      .sort({ createdAt: -1 });
    res.json({ items });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/items - report a new item (auth required, with optional image)
router.post(
  '/',
  auth,
  upload.single('image'),
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('description').trim().notEmpty().withMessage('Description is required'),
    body('type').isIn(['lost', 'found']).withMessage('Type must be lost or found'),
    body('location').trim().notEmpty().withMessage('Location is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      // Use reporter's email as default contact
      const user = await User.findById(req.user.id).select('email');
      const contactEmail = req.body.contactEmail || user.email;

      const itemData = {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category || 'others',
        type: req.body.type,
        location: req.body.location,
        date: req.body.date,
        contactEmail,
        contactPhone: req.body.contactPhone || '',
        status: 'pending',
        reportedBy: req.user.id,
      };

      if (req.file) {
        itemData.image = '/uploads/' + req.file.filename;
      }

      const item = await Item.create(itemData);
      const populated = await Item.findById(item._id).populate('reportedBy', 'name email');
      res.status(201).json({ item: populated });
    } catch (error) {
      console.error('Create item error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
);

// PATCH /api/items/:id/status - update item status (owner only)
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.reportedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const { status } = req.body;
    if (status && ['pending', 'recovered'].includes(status)) {
      item.status = status;
    } else {
      // toggle
      item.status = item.status === 'pending' ? 'recovered' : 'pending';
    }
    await item.save();

    const populated = await Item.findById(item._id).populate('reportedBy', 'name email');
    res.json({ item: populated });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// DELETE /api/items/:id - delete an item (owner only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.reportedBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    await Item.findByIdAndDelete(req.params.id);
    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
