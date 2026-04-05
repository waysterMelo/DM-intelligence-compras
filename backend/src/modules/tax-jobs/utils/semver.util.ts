/**
 * Semantic version comparison utilities for ENGINE_VERSION scope resolution.
 * Handles versions like "1.0.0", "1.2.10", etc.
 */

export interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  raw: string;
}

export class SemverUtil {
  /**
   * Parses a version string into its components.
   * Returns null if the string is not a valid semver.
   */
  static parse(version: string): SemverParts | null {
    if (!version || typeof version !== 'string') return null;

    const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) return null;

    return {
      major: parseInt(match[1], 10),
      minor: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
      raw: version.trim()
    };
  }

  /**
   * Compares two semantic versions.
   * Returns: -1 if a < b, 0 if a === b, 1 if a > b
   */
  static compare(a: string, b: string): number {
    const pa = this.parse(a);
    const pb = this.parse(b);

    if (!pa || !pb) {
      // Fall back to string comparison if parsing fails
      return a.localeCompare(b);
    }

    if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
    if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
    if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;

    return 0;
  }

  static lt(a: string, b: string): boolean { return this.compare(a, b) < 0; }
  static lte(a: string, b: string): boolean { return this.compare(a, b) <= 0; }
  static gt(a: string, b: string): boolean { return this.compare(a, b) > 0; }
  static gte(a: string, b: string): boolean { return this.compare(a, b) >= 0; }
  static eq(a: string, b: string): boolean { return this.compare(a, b) === 0; }

  /**
   * Checks if a version falls within a range [min, max].
   * If min is null, no lower bound. If max is null, no upper bound.
   */
  static inRange(version: string, min?: string | null, max?: string | null): boolean {
    if (min && this.lt(version, min)) return false;
    if (max && this.gt(version, max)) return false;
    return true;
  }

  /**
   * Filters an array of version strings to those within [min, max].
   */
  static filterRange(versions: string[], min?: string | null, max?: string | null): string[] {
    return versions.filter(v => this.inRange(v, min, max));
  }
}
