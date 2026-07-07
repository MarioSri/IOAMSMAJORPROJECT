export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  custom?: (value: unknown) => string | null;
}

export interface ValidationSchema {
  [key: string]: ValidationRule;
}

export interface ValidationErrors {
  [key: string]: string;
}

export function validateField(value: unknown, rules: ValidationRule): string | null {
  if (rules.required && (!value || (typeof value === 'string' && !value.trim()))) {
    return 'This field is required';
  }

  if (value && typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return `Minimum length is ${rules.minLength} characters`;
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      return `Maximum length is ${rules.maxLength} characters`;
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      return 'Invalid format';
    }
  }

  if (rules.custom) {
    return rules.custom(value);
  }

  return null;
}

export function validateForm(data: Record<string, unknown>, schema: ValidationSchema): ValidationErrors {
  const errors: ValidationErrors = {};

  Object.keys(schema).forEach(field => {
    const error = validateField(data[field], schema[field]);
    if (error) {
      errors[field] = error;
    }
  });

  return errors;
}

export const validationPatterns = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phone: /^[+]?[1-9][\d]{0,15}$/,
  hitamEmail: /^[^\s@]+@hitam\.org$/,
  employeeId: /^HITAM-[A-Z]{2,4}-\d{3,4}$/,
  documentId: /^DOC-\d{4}-\d{3,4}$/,
};

export const authValidationSchema: ValidationSchema = {
  email: {
    required: true,
    pattern: validationPatterns.hitamEmail,
    custom: (value) => {
      if (typeof value === 'string' && value && !validationPatterns.hitamEmail.test(value)) {
        return 'Please use your HITAM email address (@hitam.org)';
      }
      return null;
    }
  },
  password: {
    required: true,
    minLength: 8,
    custom: (value) => {
      if (typeof value === 'string' && value && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
      }
      return null;
    }
  }
};

export const documentValidationSchema: ValidationSchema = {
  title: {
    required: true,
    minLength: 5,
    maxLength: 200
  },
  description: {
    required: true,
    minLength: 10,
    maxLength: 1000
  },
  recipients: {
    required: true,
    custom: (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Please select at least one recipient';
      }
      return null;
    }
  },
  files: {
    required: true,
    custom: (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return 'Please upload at least one file';
      }

      const maxSize = 10 * 1024 * 1024; // 10MB
      const invalidFiles = (value as File[]).filter((file: File) => file.size > maxSize);
      if (invalidFiles.length > 0) {
        return 'Some files exceed the 10MB size limit';
      }

      return null;
    }
  }
};

export const profileValidationSchema: ValidationSchema = {
  name: {
    required: true,
    minLength: 2,
    maxLength: 100
  },
  email: {
    required: true,
    pattern: validationPatterns.hitamEmail
  },
  phone: {
    required: true,
    pattern: validationPatterns.phone
  },
  department: {
    required: true,
    minLength: 2
  }
};