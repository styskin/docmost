/**
 * Utility functions for regular expressions
 */

/**
 * Create a RegExp object from a string pattern and flags
 * @param pattern - The regex pattern as a string
 * @param flags - The regex flags (default: 'g')
 * @returns A RegExp object
 */
export function createRegex(pattern: string, flags: string = "g"): RegExp {
  return new RegExp(pattern, flags);
}

/**
 * Parse a regex string in the format /pattern/flags into a RegExp object
 * @param regexStr - The regex string in the format /pattern/flags
 * @returns A RegExp object or null if the string is not a valid regex
 */
export function parseRegexString(regexStr: string): RegExp | null {
  const match = regexStr.match(/\/(.*)\/([gimuy]*)$/);
  if (!match) return null;

  const pattern = match[1];
  const flags = match[2] || "g";

  try {
    return new RegExp(pattern, flags);
  } catch (error) {
    console.error("Error parsing regex string:", error);
    return null;
  }
}

/**
 * Test if a regular expression matches a string
 * @param regex - The regular expression to test
 * @param text - The text to test against
 * @returns An array of matches if found, null otherwise
 */
export function testRegex(regex: RegExp, text: string): RegExpExecArray | null {
  return regex.exec(text);
}

/**
 * Match all occurrences of a regular expression in a string
 * @param regex - The regular expression to match
 * @param text - The text to match against
 * @returns An array of all matches
 */
export function matchAllRegex(regex: RegExp, text: string): RegExpExecArray[] {
  const matches: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;

  // Ensure the regex has the global flag
  const globalRegex = new RegExp(
    regex.source,
    regex.flags.includes("g") ? regex.flags : regex.flags + "g",
  );

  while ((match = globalRegex.exec(text)) !== null) {
    matches.push(match);
  }

  return matches;
}
