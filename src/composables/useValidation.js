/**
 * useValidation Composable
 * 
 * Provides reactive form validation with real-time feedback.
 * Integrates with the Validator utility class for rule-based validation.
 */

import { ref, computed, watch } from 'vue';
import { Validator } from '../utils/validation/Validator.js';

/**
 * Create a validation composable for form data
 * @param {import('vue').Ref<Object>} formData - Reactive form data object
 * @param {Object.<string, Array>} schema - Validation schema (field -> rules mapping)
 * @param {Object} [options={}] - Validation options
 * @param {boolean} [options.validateOnChange=false] - Validate fields on change
 * @param {boolean} [options.validateOnBlur=true] - Validate fields on blur
 * @returns {Object} Validation composable
 */
export function useValidation(formData, schema, options = {}) {
  const {
    validateOnChange = false,
    validateOnBlur = true
  } = options;

  // Reactive error state for each field
  const errors = ref({});
  
  // Track which fields have been touched (for blur validation)
  const touchedFields = ref(new Set());
  
  // Track which fields are currently being validated
  const validatingFields = ref(new Set());

  /**
   * Computed property: is the entire form valid?
   */
  const isValid = computed(() => {
    return Object.keys(errors.value).length === 0;
  });

  /**
   * Computed property: does the form have any errors?
   */
  const hasErrors = computed(() => {
    return Object.keys(errors.value).length > 0;
  });

  /**
   * Validate a single field
   * @param {string} field - Field name to validate
   * @returns {boolean} - Whether the field is valid
   */
  function validate(field) {
    if (!schema[field]) {
      console.warn(`No validation rules defined for field: ${field}`);
      return true;
    }

    validatingFields.value.add(field);

    const value = formData.value[field];
    const rules = schema[field];
    
    // Run validation
    const result = Validator.validate(value, rules);
    
    // Update errors
    if (result.isValid) {
      // Remove error if validation passed
      const newErrors = { ...errors.value };
      delete newErrors[field];
      errors.value = newErrors;
    } else {
      // Set error message (first error only)
      errors.value = {
        ...errors.value,
        [field]: result.errors[0].message
      };
    }

    validatingFields.value.delete(field);
    
    return result.isValid;
  }

  /**
   * Validate all fields in the form
   * @returns {boolean} - Whether all fields are valid
   */
  function validateAll() {
    const result = Validator.validateObject(formData.value, schema);
    
    // Convert errors array to object keyed by field name
    const errorMap = {};
    for (const error of result.errors) {
      if (!errorMap[error.field]) {
        errorMap[error.field] = error.message;
      }
    }
    
    errors.value = errorMap;
    
    return result.isValid;
  }

  /**
   * Clear errors for a specific field or all fields
   * @param {string} [field] - Field name to clear (omit to clear all)
   */
  function clearErrors(field) {
    if (field) {
      const newErrors = { ...errors.value };
      delete newErrors[field];
      errors.value = newErrors;
    } else {
      errors.value = {};
    }
  }

  /**
   * Set a custom error for a field
   * @param {string} field - Field name
   * @param {string} message - Error message
   */
  function setError(field, message) {
    errors.value = {
      ...errors.value,
      [field]: message
    };
  }

  /**
   * Mark a field as touched (for blur validation)
   * @param {string} field - Field name
   */
  function touch(field) {
    touchedFields.value.add(field);
    
    if (validateOnBlur) {
      validate(field);
    }
  }

  /**
   * Check if a field has been touched
   * @param {string} field - Field name
   * @returns {boolean}
   */
  function isTouched(field) {
    return touchedFields.value.has(field);
  }

  /**
   * Check if a field is currently being validated
   * @param {string} field - Field name
   * @returns {boolean}
   */
  function isValidating(field) {
    return validatingFields.value.has(field);
  }

  /**
   * Reset validation state (clear errors and touched fields)
   */
  function reset() {
    errors.value = {};
    touchedFields.value.clear();
    validatingFields.value.clear();
  }

  /**
   * Get error message for a field
   * @param {string} field - Field name
   * @returns {string|undefined} - Error message or undefined
   */
  function getError(field) {
    return errors.value[field];
  }

  /**
   * Check if a field has an error
   * @param {string} field - Field name
   * @returns {boolean}
   */
  function hasError(field) {
    return !!errors.value[field];
  }

  // Watch for changes if validateOnChange is enabled
  if (validateOnChange) {
    watch(
      formData,
      (newData, oldData) => {
        // Validate only changed fields that have been touched
        for (const field of Object.keys(schema)) {
          if (touchedFields.value.has(field) && newData[field] !== oldData?.[field]) {
            validate(field);
          }
        }
      },
      { deep: true }
    );
  }

  return {
    // State
    errors,
    isValid,
    hasErrors,
    
    // Methods
    validate,
    validateAll,
    clearErrors,
    setError,
    touch,
    isTouched,
    isValidating,
    reset,
    getError,
    hasError
  };
}

/**
 * Create a simple validation composable for a single field
 * @param {import('vue').Ref} fieldValue - Reactive field value
 * @param {Array} rules - Validation rules
 * @param {Object} [options={}] - Validation options
 * @returns {Object} Field validation composable
 */
export function useFieldValidation(fieldValue, rules, options = {}) {
  const {
    validateOnChange = false
  } = options;

  const error = ref('');
  const touched = ref(false);
  const validating = ref(false);

  const isValid = computed(() => !error.value);
  const hasError = computed(() => !!error.value);

  function validate() {
    validating.value = true;
    
    const result = Validator.validate(fieldValue.value, rules);
    
    if (result.isValid) {
      error.value = '';
    } else {
      error.value = result.errors[0].message;
    }
    
    validating.value = false;
    
    return result.isValid;
  }

  function clearError() {
    error.value = '';
  }

  function setError(message) {
    error.value = message;
  }

  function touch() {
    touched.value = true;
    validate();
  }

  function reset() {
    error.value = '';
    touched.value = false;
    validating.value = false;
  }

  // Watch for changes if validateOnChange is enabled
  if (validateOnChange) {
    watch(fieldValue, () => {
      if (touched.value) {
        validate();
      }
    });
  }

  return {
    error,
    isValid,
    hasError,
    touched,
    validating,
    validate,
    clearError,
    setError,
    touch,
    reset
  };
}
