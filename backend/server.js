require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');
const http = require('http');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const companyRoutes = require('./routes/companies');
const contactRoutes = require('./routes/contacts');
const dealRoutes = require('./routes/deals');
const pipelineRoutes = require('./routes/pipelines');
const activityRoutes = require('./routes/activities');
const productRoutes = require('./routes/products');
const dashboardRoutes = require('./routes/dashboard');
const automationRoutes = require('./routes/automations');
const aiRoutes = require('./routes/ai');
const customFieldRoutes = require('./routes/customFields');
const auditRoutes = require('./routes/audit');
const billingRoutes = require('./routes/billing');
const templateRoutes = require('./routes/templates');
const importExportRoutes = require('./routes/importExport');
const notificationRoutes = require('./routes/notifications');
const emailRoutes = require('./routes/email');
const whatsappRoutes = require('./routes/whatsapp');

// Scheduler & Automation
const scheduler = require('./utils/scheduler');
const automationEngine = require('./utils/automationEngine');

const app = express();
const server = http.createServer(app);

// Socket.io setup
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173',
].filter(Boolean);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
  },
});

// Make io accessible to routes
app.set('io', io);

// Security & Middleware
app.use(helmet());
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    message_ar: 'طلبات كثيرة جداً، يرجى المحاولة لاحقاً.',
  },
});
app.use('/api/', globalLimiter);

// Stricter rate limit for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: 'Too many login attempts, please try again later.',
    message_ar: 'محاولات تسجيل دخول كثيرة جداً، يرجى المحاولة لاحقاً.',
  },
});
app.use('/api/auth/login', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/deals', dealRoutes);
app.use('/api/pipelines', pipelineRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/products', productRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/custom-fields', customFieldRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/import-export', importExportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/whatsapp', whatsappRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CRM API is running', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`⚡ Client connected: ${socket.id}`);

  // Join user-specific room for targeted notifications
  socket.on('join', (userId) => {
    socket.join(`user:${userId}`);
    console.log(`User ${userId} joined their room`);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 CRM API Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Start the background scheduler (AI scans + automation triggers)
  scheduler.start(io);
});

module.exports = { app, server, io };
