/**
 * Validator Utility Class
 * 
 * Provides centralized validation logic with reusable rules for form inputs.
 * Supports both individual field validation and schema-based object validation.
 */

/**
 * Validation rule interface
 * @typedef {Object} ValidationRule
 * @property {Function} validate - Validation function that returns boolean
 * @property {string} message - Error message to display on validation failure
 * @property {'error'|'warning'} [severity] - Severity level of validation failure
 */

/**
 * Validation result interface
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {Array<{field: string, message: string, severity: string}>} errors - Array of validation errors
 */

export class Validator {
  /**
   * Required field validation
   * @param {string} [message='此字段为必填项'] - Custom error message
   * @returns {ValidationRule}
   */
  static required(message = '此字段为必填项') {
    return {
      validate: (value) => {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Minimum length validation
   * @param {number} length - Minimum required length
   * @param {string} [message] - Custom error message
   * @returns {ValidationRule}
   */
  static minLength(length, message) {
    return {
      validate: (value) => {
        if (!value) return true; // Skip if empty (use required() for that)
        return String(value).length >= length;
      },
      message: message || `最少需要${length}个字符`,
      severity: 'error'
    };
  }

  /**
   * Maximum length validation
   * @param {number} length - Maximum allowed length
   * @param {string} [message] - Custom error message
   * @returns {ValidationRule}
   */
  static maxLength(length, message) {
    return {
      validate: (value) => {
        if (!value) return true;
        return String(value).length <= length;
      },
      message: message || `最多允许${length}个字符`,
      severity: 'error'
    };
  }

  /**
   * Pattern matching validation
   * @param {RegExp} regex - Regular expression pattern
   * @param {string} [message='格式不正确'] - Custom error message
   * @returns {ValidationRule}
   */
  static pattern(regex, message = '格式不正确') {
    return {
      validate: (value) => {
        if (!value) return true;
        return regex.test(String(value));
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Numeric validation (integers and decimals)
   * @param {string} [message='请输入有效的数字'] - Custom error message
   * @returns {ValidationRule}
   */
  static numeric(message = '请输入有效的数字') {
    return {
      validate: (value) => {
        if (!value && value !== 0) return true;
        return !isNaN(Number(value)) && isFinite(Number(value));
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Positive number validation (> 0)
   * @param {string} [message='必须是大于0的数字'] - Custom error message
   * @returns {ValidationRule}
   */
  static positiveNumber(message = '必须是大于0的数字') {
    return {
      validate: (value) => {
        if (!value && value !== 0) return true;
        const num = Number(value);
        return !isNaN(num) && isFinite(num) && num > 0;
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Non-negative number validation (>= 0)
   * @param {string} [message='必须是非负数'] - Custom error message
   * @returns {ValidationRule}
   */
  static nonNegative(message = '必须是非负数') {
    return {
      validate: (value) => {
        if (!value && value !== 0) return true;
        const num = Number(value);
        return !isNaN(num) && isFinite(num) && num >= 0;
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Decimal places validation
   * @param {number} places - Maximum decimal places allowed
   * @param {string} [message] - Custom error message
   * @returns {ValidationRule}
   */
  static decimal(places, message) {
    return {
      validate: (value) => {
        if (!value && value !== 0) return true;
        const str = String(value);
        const decimalIndex = str.indexOf('.');
        if (decimalIndex === -1) return true;
        const decimalPlaces = str.length - decimalIndex - 1;
        return decimalPlaces <= places;
      },
      message: message || `最多允许${places}位小数`,
      severity: 'error'
    };
  }

  /**
   * Range validation (min <= value <= max)
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @param {string} [message] - Custom error message
   * @returns {ValidationRule}
   */
  static range(min, max, message) {
    return {
      validate: (value) => {
        if (!value && value !== 0) return true;
        const num = Number(value);
        return !isNaN(num) && num >= min && num <= max;
      },
      message: message || `值必须在${min}到${max}之间`,
      severity: 'error'
    };
  }

  /**
   * UUID validation (v4 format)
   * @param {string} [message='无效的UUID格式'] - Custom error message
   * @returns {ValidationRule}
   */
  static uuid(message = '无效的UUID格式') {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return {
      validate: (value) => {
        if (!value) return true;
        return uuidRegex.test(String(value));
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Username validation (alphanumeric, underscore, hyphen, 3-20 chars)
   * @param {string} [message='用户名格式不正确'] - Custom error message
   * @returns {ValidationRule}
   */
  static username(message = '用户名格式不正确（3-20个字符，仅限字母、数字、下划线、连字符）') {
    const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
    return {
      validate: (value) => {
        if (!value) return true;
        return usernameRegex.test(String(value));
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Transaction password validation (6 digits)
   * @param {string} [message='交易密码必须是6位数字'] - Custom error message
   * @returns {ValidationRule}
   */
  static transactionPassword(message = '交易密码必须是6位数字') {
    const passwordRegex = /^\d{6}$/;
    return {
      validate: (value) => {
        if (!value) return true;
        return passwordRegex.test(String(value));
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Email validation
   * @param {string} [message='邮箱格式不正确'] - Custom error message
   * @returns {ValidationRule}
   */
  static email(message = '邮箱格式不正确') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      validate: (value) => {
        if (!value) return true;
        return emailRegex.test(String(value));
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Phone number validation (Chinese mobile)
   * @param {string} [message='手机号格式不正确'] - Custom error message
   * @returns {ValidationRule}
   */
  static phone(message = '手机号格式不正确') {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return {
      validate: (value) => {
        if (!value) return true;
        return phoneRegex.test(String(value).replace(/\s/g, ''));
      },
      message,
      severity: 'error'
    };
  }

  /**
   * URL validation
   * @param {string} [message='URL格式不正确'] - Custom error message
   * @returns {ValidationRule}
   */
  static url(message = 'URL格式不正确') {
    return {
      validate: (value) => {
        if (!value) return true;
        try {
          new URL(String(value));
          return true;
        } catch {
          return false;
        }
      },
      message,
      severity: 'error'
    };
  }

  /**
   * Custom validation function
   * @param {Function} fn - Custom validation function
   * @param {string} message - Error message
   * @returns {ValidationRule}
   */
  static custom(fn, message) {
    return {
      validate: fn,
      message,
      severity: 'error'
    };
  }

  /**
   * Validate a single value against multiple rules
   * @param {any} value - Value to validate
   * @param {ValidationRule[]} rules - Array of validation rules
   * @returns {ValidationResult}
   */
  static validate(value, rules) {
    const errors = [];

    for (const rule of rules) {
      if (!rule.validate(value)) {
        errors.push({
          field: 'value',
          message: rule.message,
          severity: rule.severity || 'error'
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate an object against a schema
   * @param {Object} obj - Object to validate
   * @param {Object.<string, ValidationRule[]>} schema - Validation schema
   * @returns {ValidationResult}
   */
  static validateObject(obj, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = obj[field];
      
      for (const rule of rules) {
        if (!rule.validate(value)) {
          errors.push({
            field,
            message: rule.message,
            severity: rule.severity || 'error'
          });
          // Stop at first error per field
          break;
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate multiple fields and return errors grouped by field
   * @param {Object} obj - Object to validate
   * @param {Object.<string, ValidationRule[]>} schema - Validation schema
   * @returns {Object.<string, string>} - Errors grouped by field name
   */
  static validateFields(obj, schema) {
    const result = this.validateObject(obj, schema);
    const fieldErrors = {};

    for (const error of result.errors) {
      if (!fieldErrors[error.field]) {
        fieldErrors[error.field] = error.message;
      }
    }

    return fieldErrors;
  }
}
