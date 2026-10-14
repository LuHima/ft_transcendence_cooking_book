import { Injectable } from '@nestjs/common';

const PRODUCTION_VALUES = new Set(['true', '1']);
const NON_PRODUCTION_VALUES = new Set(['false', '0']);

@Injectable()
export class ProductionConfig {
  private readonly production: boolean;

  constructor() {
    const value = process.env.PRODUCTION_FLAG?.trim().toLowerCase();

    if (value === undefined || value === '') {
      this.production = false;
    } else if (PRODUCTION_VALUES.has(value)) {
      this.production = true;
    } else if (NON_PRODUCTION_VALUES.has(value)) {
      this.production = false;
    } else {
      throw new Error('PRODUCTION_FLAG must be one of: true, 1, false, or 0');
    }
  }

  isProduction(): boolean {
    return this.production;
  }
}
