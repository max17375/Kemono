const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost:27017/test';
const mongo = require('mongo-lazy-connect')(mongoUrl, { useUnifiedTopology: true });
const db = {
  posts: mongo.collection('posts'),
  lookup: mongo.collection('lookup')
};

module.exports = db;