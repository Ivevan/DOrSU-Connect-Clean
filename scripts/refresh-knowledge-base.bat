@echo off
echo ============================================
echo  DOrSU Knowledge Base Refresh
echo ============================================
echo.
echo This will refresh the knowledge base with:
echo   - Improved keyword extraction
echo   - Natural language formatting
echo   - Enhanced metadata preservation
echo   - Better acronym handling
echo.
echo Make sure the backend server is running!
echo.
pause

curl -X POST http://localhost:3000/api/refresh-knowledge -H "Content-Type: application/json"

echo.
echo.
echo ============================================
echo Done! Check the output above for results.
echo ============================================
echo.
pause

