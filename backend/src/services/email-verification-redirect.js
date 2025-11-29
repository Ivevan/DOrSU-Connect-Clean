/**
 * Email Verification Redirect Service
 * Handles email verification link redirects from Firebase
 */

/**
 * Generate HTML page that redirects to the app with verification code
 * @param {string} oobCode - The verification code from Firebase
 * @param {string} mode - The verification mode (optional)
 * @param {string} origin - The origin URL (for web redirects)
 * @returns {string} HTML content
 */
export function generateVerificationRedirectPage(oobCode, mode, origin = 'http://localhost:8081') {
  // Build deep link URL with the verification code
  const deepLinkUrl = oobCode 
    ? `dorsuconnect://verify-email?oobCode=${encodeURIComponent(oobCode)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`
    : 'dorsuconnect://verify-email';
  
  // For web, redirect to the app URL with the verification parameters
  // This allows the web app to handle the verification directly
  const webAppUrl = oobCode
    ? `${origin}/verify-email?oobCode=${encodeURIComponent(oobCode)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}`
    : `${origin}/verify-email`;
  
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
    // Detect platform
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isAndroid = /android/i.test(userAgent);
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isMobile = isAndroid || isIOS;
    const isWeb = !isMobile && (window.location.protocol === 'http:' || window.location.protocol === 'https:');
    
    console.log('Platform detection:', { isAndroid, isIOS, isMobile, isWeb, userAgent });
    
    if (isWeb) {
      // On web (desktop browser), redirect to the app URL with verification parameters
      console.log('🌐 Web detected, redirecting to app URL...');
      console.log('🌐 Redirect URL:', "${webAppUrl}");
      // Use replace to avoid adding to history
      window.location.replace("${webAppUrl}");
    } else if (isAndroid) {
      // On Android, try to open the app with custom scheme
      console.log('🤖 Android detected, trying custom scheme...');
      
      // Try to open the app
      window.location.href = "${deepLinkUrl}";
      
      // Fallback: If app doesn't open, show manual button after a delay
      let appOpened = false;
      const checkAppOpened = setTimeout(() => {
        if (!appOpened && document.visibilityState === 'visible') {
          console.log('⚠️ App may not have opened, showing manual button');
          const button = document.querySelector('.button');
          if (button) {
            button.style.display = 'inline-block';
          }
        }
      }, 2000);
      
      // Detect if page becomes hidden (app opened)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          appOpened = true;
          clearTimeout(checkAppOpened);
        }
      });
      
      // Also try intent:// URL for Android as fallback
      setTimeout(() => {
        if (!appOpened && document.visibilityState === 'visible') {
          ${oobCode ? `const intentUrl = 'intent://verify-email?oobCode=${encodeURIComponent(oobCode)}${mode ? `&mode=${encodeURIComponent(mode)}` : ''}#Intent;scheme=dorsuconnect;package=com.dorsuconnect.app;end';` : `const intentUrl = 'intent://verify-email#Intent;scheme=dorsuconnect;package=com.dorsuconnect.app;end';`}
          try {
            window.location.href = intentUrl;
          } catch (e) {
            console.log('Intent URL failed, showing manual button');
          }
        }
      }, 1500);
    } else if (isIOS) {
      // On iOS, try to open the app with custom scheme
      console.log('🍎 iOS detected, trying custom scheme...');
      window.location.href = "${deepLinkUrl}";
      
      // Fallback: If still on page after 2 seconds, show manual button
      setTimeout(() => {
        const button = document.querySelector('.button');
        if (button) {
          button.style.display = 'inline-block';
        }
      }, 2000);
    } else {
      // Unknown platform, try custom scheme first, then web
      console.log('❓ Unknown platform, trying custom scheme then web...');
      window.location.href = "${deepLinkUrl}";
      
      setTimeout(() => {
        if (document.visibilityState === 'visible') {
          window.location.href = "${webAppUrl}";
        }
      }, 2000);
    }
  </script>
</body>
</html>`;
}

/**
 * Handle email verification redirect request
 * @param {URL} urlObj - Parsed URL object with query parameters
 * @param {object} res - HTTP response object
 * @param {string} origin - The origin URL (for web redirects)
 */
export function handleVerificationRedirect(urlObj, res, origin = 'http://localhost:8081') {
  const oobCode = urlObj.searchParams.get('oobCode') || urlObj.searchParams.get('actionCode');
  const mode = urlObj.searchParams.get('mode');
  
  const html = generateVerificationRedirectPage(oobCode, mode, origin);
  
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

