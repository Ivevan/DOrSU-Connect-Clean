/**
 * Simple multipart/form-data parser
 * Handles file uploads without external dependencies
 */

export function parseMultipartFormData(req, boundary) {
  return new Promise((resolve, reject) => {
    let body = Buffer.alloc(0);
    
    req.on('data', chunk => {
      body = Buffer.concat([body, chunk]);
      // Limit to 50MB
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('File too large (max 50MB)'));
      }
    });
    
    req.on('end', () => {
      try {
        const parts = [];
        const boundaryBuffer = Buffer.from(`--${boundary}`);
        const endBoundaryBuffer = Buffer.from(`--${boundary}--`);
        
        let start = 0;
        let boundaryIndex = body.indexOf(boundaryBuffer, start);
        
        while (boundaryIndex !== -1) {
          const nextBoundaryIndex = body.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
          
          if (nextBoundaryIndex === -1) {
            // Last part
            const partData = body.slice(boundaryIndex + boundaryBuffer.length);
            const endIndex = partData.indexOf(endBoundaryBuffer);
            if (endIndex !== -1) {
              const part = parsePart(partData.slice(0, endIndex));
              if (part) parts.push(part);
            }
            break;
          }
          
          const partData = body.slice(boundaryIndex + boundaryBuffer.length, nextBoundaryIndex);
          const part = parsePart(partData);
          if (part) parts.push(part);
          
          start = nextBoundaryIndex;
          boundaryIndex = body.indexOf(boundaryBuffer, start);
        }
        
        resolve(parts);
      } catch (error) {
        reject(error);
      }
    });
    
    req.on('error', reject);
  });
}

function parsePart(partBuffer) {
  // Find the header/body separator (CRLFCRLF or LFCRLF or CRCR)
  const separator = Buffer.from('\r\n\r\n');
  let separatorIndex = partBuffer.indexOf(separator);
  
  if (separatorIndex === -1) {
    const separator2 = Buffer.from('\n\n');
    separatorIndex = partBuffer.indexOf(separator2);
  }
  
  if (separatorIndex === -1) return null;
  
  const headerBuffer = partBuffer.slice(0, separatorIndex);
  const bodyBuffer = partBuffer.slice(separatorIndex + separator.length);
  
  // Parse headers
  const headers = {};
  const headerText = headerBuffer.toString('utf8');
  const headerLines = headerText.split(/\r?\n/);
  
  for (const line of headerLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    
    const key = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    headers[key] = value;
  }
  
  // Parse Content-Disposition
  const contentDisposition = headers['content-disposition'] || '';
  const nameMatch = contentDisposition.match(/name="([^"]+)"/);
  const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
  
  const name = nameMatch ? nameMatch[1] : null;
  const filename = filenameMatch ? filenameMatch[1] : null;
  
  if (!name) return null;
  
  return {
    name,
    filename,
    contentType: headers['content-type'] || 'application/octet-stream',
    data: bodyBuffer
  };
}

