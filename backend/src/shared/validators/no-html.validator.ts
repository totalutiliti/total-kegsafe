import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ async: false })
export class NoHtmlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (typeof value !== 'string') return true;
    return !/<[^>]*>/.test(value);
  }

  defaultMessage(): string {
    return 'O campo $property não pode conter tags HTML';
  }
}

/**
 * Rejeita strings que contenham tags HTML (ex: <script>, <img>, <div>).
 * Usado como defense-in-depth contra Stored XSS.
 */
export function NoHtml(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: NoHtmlConstraint,
    });
  };
}
