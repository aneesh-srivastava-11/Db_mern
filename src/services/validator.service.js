const { z } = require('zod');

class ValidatorService {
    /**
     * Builds a Zod schema from a custom collection schema definition.
     * Supported formats:
     * - "string" / "number" / "boolean" / "date" / "any"
     * - ["string"] (array of strings, etc.)
     * - { nested: "string" } (nested objects)
     */
    buildZodSchema(schemaDef) {
        if (!schemaDef || typeof schemaDef !== 'object') {
            return z.any();
        }

        const shape = {};
        for (const [key, type] of Object.entries(schemaDef)) {
            shape[key] = this.parseType(type);
        }

        return z.object(shape).strict();
    }

    parseType(typeDef) {
        if (typeof typeDef === 'string') {
            const normalized = typeDef.trim().toLowerCase();
            switch (normalized) {
                case 'string':
                    return z.string({ required_error: 'Field is required' });
                case 'number':
                    return z.number({ required_error: 'Field is required', invalid_type_error: 'Must be a number' });
                case 'boolean':
                    return z.boolean({ required_error: 'Field is required', invalid_type_error: 'Must be a boolean' });
                case 'date':
                    return z.string().datetime({ message: 'Must be a valid ISO date-time string' }).or(z.date());
                case 'any':
                    return z.any();
                default:
                    throw new Error(`Unsupported schema field type: ${typeDef}`);
            }
        }

        if (Array.isArray(typeDef)) {
            if (typeDef.length > 0) {
                return z.array(this.parseType(typeDef[0]));
            }
            return z.array(z.any());
        }

        if (typeof typeDef === 'object' && typeDef !== null) {
            return this.buildZodSchema(typeDef);
        }

        return z.any();
    }

    /**
     * Validates data against a schema definition.
     * Throws ZodError if validation fails.
     */
    validate(schemaDef, data) {
        if (!schemaDef) return data;
        const schema = this.buildZodSchema(schemaDef);
        return schema.parse(data);
    }
}

module.exports = new ValidatorService();
