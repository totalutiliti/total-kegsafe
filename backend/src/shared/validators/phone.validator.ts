import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    registerDecorator,
    ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ name: 'isE164Phone', async: false })
export class IsE164PhoneConstraint implements ValidatorConstraintInterface {
    validate(phone: string): boolean {
        if (!phone) return true; // Optional field
        return /^\+[1-9]\d{6,14}$/.test(phone);
    }

    defaultMessage(): string {
        return 'phone must be in E.164 format (e.g., +5511999999999)';
    }
}

export function IsE164Phone(validationOptions?: ValidationOptions) {
    return function (object: object, propertyName: string) {
        registerDecorator({
            target: object.constructor,
            propertyName,
            options: validationOptions,
            constraints: [],
            validator: IsE164PhoneConstraint,
        });
    };
}
