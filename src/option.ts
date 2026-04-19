/**
 * Option/Maybe type for eliminating null checks in field monster access.
 * 
 * This type provides a functional alternative to null/undefined checks,
 * making code more expressive and reducing repetitive null-checking boilerplate.
 * 
 * Example usage:
 * ```typescript
 * // Before
 * const fc = this.state[owner].field.monsters[zone];
 * if(!fc) return;
 * if(fc.hasAttacked) return;
 * 
 * // After
 * const result = this.getMonsterAt(owner, zone);
 * if (result.isNone()) return;
 * const fc = result.value;
 * if(fc.hasAttacked) return;
 * ```
 */

export type Option<T> = Some<T> | None;

/**
 * Represents a present value.
 */
export class Some<T> {
  constructor(public readonly value: T) {}
  
  isSome(): this is Some<T> {
    return true;
  }
  
  isNone(): this is None {
    return false;
  }
  
  map<U>(fn: (v: T) => U): Option<U> {
    return new Some(fn(this.value));
  }
  
  andThen<U>(fn: (v: T) => Option<U>): Option<U> {
    return fn(this.value);
  }
  
  filter(predicate: (v: T) => boolean): Option<T> {
    return predicate(this.value) ? this : new None();
  }
}

/**
 * Represents an absent value (replaces null).
 */
export class None {
  isSome(): this is Some<any> {
    return false;
  }
  
  isNone(): this is None {
    return true;
  }
  
  map<U>(_fn: (v: any) => U): None {
    return this;
  }
  
  andThen<U>(_fn: (v: any) => Option<U>): None {
    return this;
  }
  
  filter(_predicate: (v: any) => boolean): None {
    return this;
  }
}

/**
 * Helper to convert a nullable value to Option.
 * ```typescript
 * const fc = this.state[owner].field.monsters[zone];
 * const optFC = Option.fromNullable(fc);
 * ```
 */
export const Option = {
  some: <T>(value: T): Some<T> => new Some(value),
  none: <T>(): None => new None(),
  fromNullable: <T>(value: T | null | undefined): Option<T> => 
    value == null ? new None() : new Some(value),
};
