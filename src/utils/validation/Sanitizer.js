/**
 * Sanitizer Utility Class
 * 
 * Provides input sanitization functions to prevent XSS, SQL injection,
 * and other security vulnerabilities.
 */

export class Sanitizer {
  /**
   * Remove script tags and their content from input
   * @param {string} input - Input string to sanitize
   * @returns {string} - Sanitized string
   */
  static removeScriptTags(input) {
    if (!input || typeof input !== 'string') return input;
    
    // Remove <script> tags and their content
    let sanitized = input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove inline event handlers (onclick, onerror, etc.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '');
    
    // Remove javascript: protocol
    sanitized = sanitized.replace(/javascript:/gi, '');
    
    return sanitized;
  }

  /**
   * Escape SQL special characters to prevent SQL injection
   * @param {string} input - Input string to escape
   * @returns {string} - Escaped string
   */
  static escapeSql(input) {
    if (!input || typeof input !== 'string') return input;
    
    // Escape single quotes
    let escaped = input.replace(/'/g, "''");
    
    // Escape backslashes
    escaped = escaped.replace(/\\/g, '\\\\');
    
    // Remove or escape SQL comment markers
    escaped = escaped.replace(/--/g, '');
    escaped = escaped.replace(/\/\*/g, '');
    escaped = escaped.replace(/\*\//g, '');
    
    // Remove semicolons (prevent multiple statements)
    escaped = escaped.replace(/;/g, '');
    
    return escaped;
  }

  /**
   * Escape HTML special characters to prevent XSS
   * @param {string} input - Input string to escape
   * @returns {string} - HTML-escaped string
   */
  static escapeHtml(input) {
    if (!input || typeof input !== 'string') return input;
    
    const htmlEscapeMap = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;'
    };
    
    return input.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char]);
  }

  /**
   * Normalize whitespace (remove extra spaces, tabs, newlines)
   * @param {string} input - Input string to normalize
   * @returns {string} - Normalized string
   */
  static normalizeWhitespace(input) {
    if (!input || typeof input !== 'string') return input;
    
    // Replace multiple whitespace characters with single space
    let normalized = input.replace(/\s+/g, ' ');
    
    // Trim leading and trailing whitespace
    normalized = normalized.trim();
    
    return normalized;
  }

  /**
   * Remove special characters, keeping only allowed ones
   * @param {string} input - Input string to clean
   * @param {string[]} [allowed=[]] - Array of allowed special characters
   * @returns {string} - Cleaned string
   */
  static removeSpecialChars(input, allowed = []) {
    if (!input || typeof input !== 'string') return input;
    
    // Build regex pattern for allowed characters
    // Default: alphanumeric, Chinese characters, and explicitly allowed chars
    const allowedChars = allowed.map(char => 
      char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    ).join('');
    
    const pattern = new RegExp(`[^a-zA-Z0-9\u4e00-\u9fa5${allowedChars}]`, 'g');
    
    return input.replace(pattern, '');
  }

  /**
   * Remove null bytes and control characters
   * @param {string} input - Input string to clean
   * @returns {string} - Cleaned string
   */
  static removeControlChars(input) {
    if (!input || typeof input !== 'string') return input;
    
    // Remove null bytes
    let cleaned = input.replace(/\0/g, '');
    
    // Remove other control characters (except newline, tab, carriage return)
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    
    return cleaned;
  }

  /**
   * Sanitize filename to prevent directory traversal
   * @param {string} filename - Filename to sanitize
   * @returns {string} - Safe filename
   */
  static sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return '';
    
    // Remove path separators
    let safe = filename.replace(/[/\\]/g, '');
    
    // Remove parent directory references
    safe = safe.replace(/\.\./g, '');
    
    // Remove leading dots
    safe = safe.replace(/^\.+/, '');
    
    // Keep only safe characters
    safe = safe.replace(/[^a-zA-Z0-9._-]/g, '_');
    
    // Limit length
    if (safe.length > 255) {
      safe = safe.substring(0, 255);
    }
    
    return safe || 'unnamed';
  }

  /**
   * Sanitize URL to prevent XSS via data: or javascript: protocols
   * @param {string} url - URL to sanitize
   * @returns {string} - Safe URL or empty string if dangerous
   */
  static sanitizeUrl(url) {
    if (!url || typeof url !== 'string') return '';
    
    const trimmed = url.trim().toLowerCase();
    
    // Block dangerous protocols
    const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
    for (const protocol of dangerousProtocols) {
      if (trimmed.startsWith(protocol)) {
        return '';
      }
    }
    
    // Allow only http, https, and relative URLs
    if (trimmed.startsWith('http://') || 
        trimmed.startsWith('https://') || 
        trimmed.startsWith('/') ||
        trimmed.startsWith('./') ||
        trimmed.startsWith('../')) {
      return url.trim();
    }
    
    // If no protocol, assume relative URL
    if (!trimmed.includes(':')) {
      return url.trim();
    }
    
    return '';
  }

  /**
   * Sanitize user input for display (combines multiple sanitization methods)
   * @param {string} input - Input string to sanitize
   * @param {Object} [options={}] - Sanitization options
   * @param {boolean} [options.allowHtml=false] - Allow HTML tags
   * @param {boolean} [options.normalizeSpace=true] - Normalize whitespace
   * @param {string[]} [options.allowedChars=[]] - Allowed special characters
   * @returns {string} - Sanitized string
   */
  static sanitizeInput(input, options = {}) {
    if (!input || typeof input !== 'string') return input;
    
    const {
      allowHtml = false,
      normalizeSpace = true,
      allowedChars = []
    } = options;
    
    let sanitized = input;
    
    // Always remove script tags
    sanitized = this.removeScriptTags(sanitized);
    
    // Remove control characters
    sanitized = this.removeControlChars(sanitized);
    
    // Escape HTML if not allowed
    if (!allowHtml) {
      sanitized = this.escapeHtml(sanitized);
    }
    
    // Normalize whitespace if requested
    if (normalizeSpace) {
      sanitized = this.normalizeWhitespace(sanitized);
    }
    
    return sanitized;
  }

  /**
   * Sanitize amount input (for financial transactions)
   * @param {string|number} amount - Amount to sanitize
   * @returns {string} - Sanitized amount string
   */
  static sanitizeAmount(amount) {
    if (amount === null || amount === undefined) return '';
    
    // Convert to string and remove non-numeric characters except decimal point
    let sanitized = String(amount).replace(/[^\d.]/g, '');
    
    // Ensure only one decimal point
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
    
    // Remove leading zeros (except for 0.xx)
    sanitized = sanitized.replace(/^0+(?=\d)/, '');
    
    return sanitized;
  }

  /**
   * Sanitize user ID input
   * @param {string} userId - User ID to sanitize
   * @returns {string} - Sanitized user ID
   */
  static sanitizeUserId(userId) {
    if (!userId || typeof userId !== 'string') return '';
    
    // Remove whitespace
    let sanitized = userId.trim();
    
    // For UUID format, keep only valid characters
    sanitized = sanitized.replace(/[^a-zA-Z0-9-]/g, '');
    
    return sanitized;
  }

  /**
   * Sanitize search query
   * @param {string} query - Search query to sanitize
   * @returns {string} - Sanitized query
   */
  static sanitizeSearchQuery(query) {
    if (!query || typeof query !== 'string') return '';
    
    let sanitized = query;
    
    // Remove SQL injection patterns
    sanitized = this.escapeSql(sanitized);
    
    // Remove script tags
    sanitized = this.removeScriptTags(sanitized);
    
    // Normalize whitespace
    sanitized = this.normalizeWhitespace(sanitized);
    
    // Limit length
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }
    
    return sanitized;
  }
}
