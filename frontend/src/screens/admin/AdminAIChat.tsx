import React from 'react';
import AIChat from '../user/AIChat';

// Wrapper to reuse the unified AIChat with admin surface behavior
const AdminAIChat = () => {
  return <AIChat mode="admin" />;
};

export default AdminAIChat;

