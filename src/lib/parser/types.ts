/**
 * Lead data extracted from an email
 */
export interface LeadData {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    source: LeadSource;
    rawData?: Record<string, string>; // Additional extracted fields
}

/**
 * Known lead sources
 */
export type LeadSource =
    | "zillow"
    | "realtor"
    | "facebook"
    | "generic"
    | "unknown";

/**
 * Parser function signature
 * Returns LeadData if the parser matches, null otherwise
 */
export type LeadParser = (
    text: string,
    subject: string
) => LeadData | null;

/**
 * Validation result for parsed data
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}
