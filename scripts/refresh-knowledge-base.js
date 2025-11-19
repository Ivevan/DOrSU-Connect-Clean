/**
 * Refresh Knowledge Base Script
 * 
 * This script triggers a manual refresh of the knowledge base,
 * which will re-parse dorsu_data.json with the improved logic
 * and regenerate all chunks with better structure.
 */

const API_URL = 'http://localhost:3000/api/refresh-knowledge';

async function refreshKnowledgeBase() {
  console.log('🔄 Starting knowledge base refresh...\n');
  console.log('This will:');
  console.log('  ✅ Re-parse dorsu_data.json with improved logic');
  console.log('  ✅ Extract acronyms (2+ chars) and preserve them');
  console.log('  ✅ Convert to natural language format');
  console.log('  ✅ Preserve metadata (acronym, head, email, etc.)');
  console.log('  ✅ Regenerate embeddings');
  console.log('  ✅ Update MongoDB with new chunks\n');
  
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ SUCCESS! Knowledge base refreshed successfully!\n');
      console.log('📊 Results:');
      console.log(`  - Old chunks removed: ${result.data.oldChunksRemoved}`);
      console.log(`  - New chunks added: ${result.data.newChunksAdded}`);
      console.log(`  - Total chunks: ${result.data.totalChunks}`);
      console.log(`  - Timestamp: ${result.data.timestamp}\n`);
      
      console.log('🧪 Now test these queries:');
      console.log('  1. "who is the head of OSPAT?"');
      console.log('  2. "OSPAT head"');
      console.log('  3. "head of IRO"');
      console.log('  4. "list all offices"\n');
      
      return true;
    } else {
      console.error('❌ Refresh failed:', result.message);
      return false;
    }
  } catch (error) {
    console.error('❌ Error refreshing knowledge base:', error.message);
    console.error('\n⚠️  Make sure the backend server is running on port 3000');
    return false;
  }
}

// Run the refresh
refreshKnowledgeBase();

