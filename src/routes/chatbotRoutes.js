import express from 'express';
import { askChatbot, getChatbotStats, getChatbotHistory } from '../controllers/chatbotController.js';
import verifyToken from '../middlewares/authMiddleware.js';

const router = express.Router();

// All chatbot routes require authentication
router.use(verifyToken);

// Ask chatbot a question
router.post('/ask', askChatbot);

// Get chatbot usage statistics
router.get('/stats', getChatbotStats);

// Get chatbot conversation history
router.get('/history', getChatbotHistory);

export default router;
