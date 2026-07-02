const request = require('supertest');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');

process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/lostandfound_test';
process.env.JWT_SECRET = 'test_jwt_secret_key_123';
process.env.PORT = '5099';

const { app } = require('../server');
const User = require('../models/User');
const Item = require('../models/Item');

let token;
let userId;
let itemId;

beforeAll(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await User.deleteMany({});
  await Item.deleteMany({});
});

afterAll(async () => {
  await User.deleteMany({});
  await Item.deleteMany({});
  await mongoose.connection.close();
});

describe('Health Check', () => {
  it('GET /api/health should return ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('Auth Routes', () => {
  it('POST /api/auth/signup should create a user', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Test User', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.name).toBe('Test User');
    expect(res.body.user.email).toBe('test@example.com');
    token = res.body.token;
    userId = res.body.user.id;
  });

  it('POST /api/auth/signup should reject duplicate email', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Dupe', email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already registered/i);
  });

  it('POST /api/auth/signup should require valid data', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: '', email: 'bad', password: '12' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login should authenticate user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('POST /api/auth/login should reject wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpass' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid credentials/i);
  });

  it('GET /api/auth/me should return current user', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('GET /api/auth/me should reject without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Items Routes', () => {
  it('GET /api/items/categories should return categories', async () => {
    const res = await request(app).get('/api/items/categories');
    expect(res.status).toBe(200);
    expect(res.body.categories).toContain('electronics');
    expect(res.body.categories).toContain('pets');
    expect(res.body.categories).toContain('documents');
    expect(res.body.categories).toContain('personal_belongings');
    expect(res.body.categories).toContain('keys');
    expect(res.body.categories).toContain('others');
  });

  it('POST /api/items should create a lost item with default status pending', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Lost Blue Backpack')
      .field('description', 'A navy blue backpack with laptop inside')
      .field('type', 'lost')
      .field('category', 'bags')
      .field('location', 'Central Park, NYC')
      .field('date', '2026-04-20T10:00:00.000Z')
      .field('contactEmail', 'test@example.com');
    expect(res.status).toBe(201);
    expect(res.body.item.title).toBe('Lost Blue Backpack');
    expect(res.body.item.status).toBe('pending');
    expect(res.body.item.type).toBe('lost');
    expect(res.body.item.category).toBe('bags');
    expect(res.body.item.contactEmail).toBe('test@example.com');
    expect(res.body.item.reportedBy.name).toBe('Test User');
    expect(res.body.item.reportedBy.email).toBe('test@example.com');
    itemId = res.body.item._id;
  });

  it('POST /api/items should use reporter email as default contact', async () => {
    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Found Keys')
      .field('description', 'Set of keys found near the fountain')
      .field('type', 'found')
      .field('category', 'keys')
      .field('location', 'Times Square')
      .field('date', '2026-04-19T10:00:00.000Z');
    expect(res.status).toBe(201);
    expect(res.body.item.contactEmail).toBe('test@example.com');
    expect(res.body.item.status).toBe('pending');
  });

  it('POST /api/items should reject without auth', async () => {
    const res = await request(app)
      .post('/api/items')
      .field('title', 'Test')
      .field('description', 'Test')
      .field('type', 'lost')
      .field('location', 'Here')
      .field('date', '2026-04-20T10:00:00.000Z')
      .field('contactEmail', 'a@b.com');
    expect(res.status).toBe(401);
  });

  it('POST /api/items with image upload', async () => {
    // Create a tiny test image
    const testImgPath = path.join(__dirname, 'test-image.jpg');
    const buf = Buffer.alloc(100, 0xFF);
    fs.writeFileSync(testImgPath, buf);

    const res = await request(app)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Found Wallet')
      .field('description', 'Brown leather wallet')
      .field('type', 'found')
      .field('category', 'wallets')
      .field('location', 'Bus Stop 42')
      .field('date', '2026-04-18T10:00:00.000Z')
      .field('contactEmail', 'test@example.com')
      .attach('image', testImgPath);

    // Clean up test image
    fs.unlinkSync(testImgPath);

    expect(res.status).toBe(201);
    expect(res.body.item.image).toMatch(/^\/uploads\//);
  });

  it('GET /api/items should return all items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/items should filter by type', async () => {
    const res = await request(app).get('/api/items?type=lost');
    expect(res.status).toBe(200);
    res.body.items.forEach(item => expect(item.type).toBe('lost'));
  });

  it('GET /api/items should filter by category', async () => {
    const res = await request(app).get('/api/items?category=bags');
    expect(res.status).toBe(200);
    res.body.items.forEach(item => expect(item.category).toBe('bags'));
  });

  it('GET /api/items should filter by status', async () => {
    const res = await request(app).get('/api/items?status=pending');
    expect(res.status).toBe(200);
    res.body.items.forEach(item => expect(item.status).toBe('pending'));
  });

  it('GET /api/items should search items', async () => {
    const res = await request(app).get('/api/items?search=backpack');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/items/my should return current user items', async () => {
    const res = await request(app)
      .get('/api/items/my')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(3);
  });

  it('PATCH /api/items/:id/status should update to recovered', async () => {
    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'recovered' });
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('recovered');
  });

  it('PATCH /api/items/:id/status should toggle back to pending', async () => {
    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'pending' });
    expect(res.status).toBe(200);
    expect(res.body.item.status).toBe('pending');
  });

  it('PATCH /api/items/:id/status should reject without auth', async () => {
    const res = await request(app)
      .patch(`/api/items/${itemId}/status`)
      .send({ status: 'recovered' });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/items/:id should delete item', async () => {
    const res = await request(app)
      .delete(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/deleted/i);
  });

  it('DELETE /api/items/:id should 404 for missing item', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/items/${fakeId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
