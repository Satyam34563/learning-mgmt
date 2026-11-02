import mongoose from 'mongoose';
import { config } from './config.js';
import { createApp } from './app.js';

await mongoose.connect(config.mongoUri);
console.log('Connected to MongoDB');

createApp().listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});
