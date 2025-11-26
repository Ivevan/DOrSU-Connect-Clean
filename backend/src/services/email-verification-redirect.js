/**
 * Email Verification Redirect Service
 * Handles email verification link redirects from Firebase
 */

/**
 * Generate HTML page that redirects to the app with verification code
 * @param {string} oobCode - The verification code from Firebase
 * @param {string} mode - The verification mode (optional)
 * @returns {string} HTML content
 */
export function generateVerificationRedirectPage(oobCode, mode) {
  // Build deep link URL with the verification code
  const deepLinkUrl = oobCode 
    ? `dorsuconnect://verify-email?oobCode=${encodeURIComponent(oobCode)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`
    : 'dorsuconnect://verify-email';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Email Verification - DOrSU Connect</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-align: center;
    }
    .container {
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }
    h1 {
      margin: 0 0 20px 0;
      font-size: 28px;
    }
    p {
      margin: 10px 0;
      font-size: 16px;
      line-height: 1.6;
    }
    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 20px auto;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .button {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 24px;
      background: white;
      color: #667eea;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📧 Verifying Your Email</h1>
    <div class="spinner"></div>
    <p>Opening DOrSU Connect app...</p>
    <p style="font-size: 14px; opacity: 0.8;">If the app doesn't open automatically, click the button below.</p>
    <a href="${deepLinkUrl}" class="button">Open DOrSU Connect</a>
  </div>
  <script>
    // Try to open the app immediately
    window.location.href = "${deepLinkUrl}";
    
    // Fallback: If still on page after 2 seconds, show manual button
    setTimeout(() => {
      const button = document.querySelector('.button');
      if (button) {
        button.style.display = 'inline-block';
      }
    }, 2000);
  </script>
</body>
</html>`;
}

/**
 * Handle email verification redirect request
 * @param {URL} urlObj - Parsed URL object with query parameters
 * @param {object} res - HTTP response object
 */
export function handleVerificationRedirect(urlObj, res) {
  const oobCode = urlObj.searchParams.get('oobCode') || urlObj.searchParams.get('actionCode');
  const mode = urlObj.searchParams.get('mode');
  
  const html = generateVerificationRedirectPage(oobCode, mode);
  
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

