import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';

@ValidatorConstraint({ name: 'isLatitude', async: false })
export class IsLatitudeConstraint implements ValidatorConstraintInterface {
  validate(value: number): boolean {
    return typeof value === 'number' && value >= -90 && value <= 90;
  }

  defaultMessage(): string {
    return 'latitude must be between -90 and 90';
  }
}

@ValidatorConstraint({ name: 'isLongitude', async: false })
export class IsLongitudeConstraint implements ValidatorConstraintInterface {
  validate(value: number): boolean {
    return typeof value === 'number' && value >= -180 && value <= 180;
  }

  defaultMessage(): string {
    return 'longitude must be between -180 and 180';
  }
}

export function IsLatitude(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsLatitudeConstraint,
    });
  };
}

export function IsLongitude(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsLongitudeConstraint,
    });
  };
}
