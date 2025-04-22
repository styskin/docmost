import { testRegex, matchAllRegex, createRegex, parseRegexString } from './regex.utils';

describe('Regex Utils', () => {
  describe('createRegex', () => {
    it('should create a RegExp object with default flags', () => {
      const pattern = 'test';
      const regex = createRegex(pattern);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe(pattern);
      expect(regex.flags).toBe('g');
    });

    it('should create a RegExp object with custom flags', () => {
      const pattern = 'test';
      const flags = 'gi';
      const regex = createRegex(pattern, flags);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe(pattern);
      expect(regex.flags).toBe(flags);
    });

    it('should create a RegExp object from a complex pattern', () => {
      const pattern = '(An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals\\.)';
      const regex = createRegex(pattern);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex.source).toBe(pattern);
    });
  });

  describe('parseRegexString', () => {
    it('should parse a regex string in /pattern/flags format', () => {
      const regexStr = '/test/g';
      const regex = parseRegexString(regexStr);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.source).toBe('test');
      expect(regex?.flags).toBe('g');
    });

    it('should parse a regex string with multiple flags', () => {
      const regexStr = '/test/gi';
      const regex = parseRegexString(regexStr);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.source).toBe('test');
      expect(regex?.flags).toBe('gi');
    });

    it('should default to g flag if no flags provided', () => {
      const regexStr = '/test/';
      const regex = parseRegexString(regexStr);
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.source).toBe('test');
      expect(regex?.flags).toBe('g');
    });

    it('should return null for invalid regex strings', () => {
      const regexStr = 'test';
      const regex = parseRegexString(regexStr);
      expect(regex).toBeNull();
    });
  });

  describe('testRegex', () => {
    it('should match a simple pattern', () => {
      const regex = /hello/;
      const text = 'hello world';
      const result = testRegex(regex, text);
      expect(result).not.toBeNull();
      expect(result[0]).toBe('hello');
    });

    it('should return null for non-matching pattern', () => {
      const regex = /xyz/;
      const text = 'hello world';
      const result = testRegex(regex, text);
      expect(result).toBeNull();
    });

    it('should match the AI agent definition', () => {
      const regex = /(An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals\.)/g;
      const docText = "An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals. Essentially, it's an AI that can operate autonomously, making decisions and performing tasks to fulfill predetermined objectives. Here's a more detailed breakdown:Autonomy:AI agents are designed to act independently, making decisions and taking actions without constant human intervention. Goal-oriented:They are programmed to pursue specific goals, which can range from simple tasks to complex problem-solving. Data Interaction:AI agents interact with their environment, collecting data and using it to inform their decision-making processes. Learning and Adaptation:Some AI agents can learn and adapt over time, improving their performance based on experience and new information. Applications:AI agents are used in various fields, including customer service, software development, security, and automation.";
      
      const result = testRegex(regex, docText);
      expect(result).not.toBeNull();
      expect(result[0]).toBe('An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals.');
    });
  });

  describe('matchAllRegex', () => {
    it('should match all occurrences of a pattern', () => {
      const regex = /test/g;
      const text = 'test 1 test 2 test 3';
      const results = matchAllRegex(regex, text);
      expect(results.length).toBe(3);
      expect(results[0][0]).toBe('test');
      expect(results[1][0]).toBe('test');
      expect(results[2][0]).toBe('test');
    });

    it('should return empty array for non-matching pattern', () => {
      const regex = /xyz/g;
      const text = 'hello world';
      const results = matchAllRegex(regex, text);
      expect(results.length).toBe(0);
    });

    it('should add the global flag if missing', () => {
      const regex = /test/;
      const text = 'test 1 test 2 test 3';
      const results = matchAllRegex(regex, text);
      expect(results.length).toBe(3);
    });

    it('should match the AI agent definition with global flag', () => {

      const patternText = "(AI agents are used in various fields, including customer service, software development, security, and automation.)";
      const regex = new RegExp(patternText, "g");
      
      // const regex = /(AI agents are used in various fields, including customer service, software development, security, and automation\.)/g;
      const docText = "An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals. Essentially, it's an AI that can operate autonomously, making decisions and performing tasks to fulfill predetermined objectives. Here's a more detailed breakdown:Autonomy:AI agents are designed to act independently, making decisions and taking actions without constant human intervention. Goal-oriented:They are programmed to pursue specific goals, which can range from simple tasks to complex problem-solving. Data Interaction:AI agents interact with their environment, collecting data and using it to inform their decision-making processes. Learning and Adaptation:Some AI agents can learn and adapt over time, improving their performance based on experience and new information. Applications:AI agents are used in various fields, including customer service, software development, security, and automation.";
      const results = matchAllRegex(regex, docText);
      console.log(results);
      expect(results.length).toBe(1);
      expect(results[0][0]).toBe('AI agents are used in various fields, including customer service, software development, security, and automation.');
    });
  });

  describe('Specific test case from original query', () => {
    it('should match the AI agent definition using the exact pattern from the query', () => {
      const regexStr = "/(An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals\\.)/g";
      const regex = parseRegexString(regexStr);
      expect(regex).not.toBeNull();
      
      const docText = "An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals. Essentially, it's an AI that can operate autonomously, making decisions and performing tasks to fulfill predetermined objectives. Here's a more detailed breakdown:Autonomy:AI agents are designed to act independently, making decisions and taking actions without constant human intervention. Goal-oriented:They are programmed to pursue specific goals, which can range from simple tasks to complex problem-solving. Data Interaction:AI agents interact with their environment, collecting data and using it to inform their decision-making processes. Learning and Adaptation:Some AI agents can learn and adapt over time, improving their performance based on experience and new information. Applications:AI agents are used in various fields, including customer service, software development, security, and automation.";
      
      const results = matchAllRegex(regex, docText);
      
      expect(results.length).toBe(1);
      expect(results[0][0]).toBe('An AI agent is a software system that uses artificial intelligence to interact with its environment, gather information, and take actions to achieve specific goals.');
    });
  });
}); 