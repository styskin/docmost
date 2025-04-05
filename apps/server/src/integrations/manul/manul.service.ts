import { HttpException, HttpStatus } from '@nestjs/common';

interface ErrorWithMessage {
  message: string;
  status?: number;
}

class ManulServiceError extends HttpException {
  constructor(message: string, status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR) {
    super(message, status);
  }
}

export class ManulService {
  private async makeManulRequest<T extends Record<string, any>>(endpoint: string, body: T): Promise<string> {
    try {
      const response = await fetch(`${process.env.MANUL_AGENTS_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Manul request to ${endpoint} failed with status ${response.status}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += `: ${errorJson.message || errorJson.error || errorText}`;
        } catch {
          errorMessage += `: ${errorText}`;
        }

        throw new ManulServiceError(errorMessage, response.status);
      }

      const data = await response.json();
      
      if (!data?.choices?.[0]?.message?.content) {
        throw new ManulServiceError(
          `Invalid response format from Manul service at ${endpoint}. Expected response to contain choices[0].message.content`,
          HttpStatus.BAD_GATEWAY
        );
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error(`Manul API error at ${endpoint}:`, error);
      if (error instanceof ManulServiceError) {
        throw error;
      }
      const typedError = error as ErrorWithMessage;
      throw new ManulServiceError(
        `Failed to process query with Manul service at ${endpoint}: ${typedError.message}`,
        typedError.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async contextCall(context: string, task: string): Promise<string> {
    return this.makeManulRequest('/context_call', {
      input_variables: {
        context,
        task
      },
      prompt_name: "general_context",
    });
  }

  async criticizeDiff(previousContent: string, currentContent: string, diff: string): Promise<string> {
    const previous_content = previousContent;
    const current_content = currentContent;
    return this.makeManulRequest('/criticize_diff', {
      previous_content,
      current_content,
      diff,
      prompt_name: "criticize_diff",
    });
  }
} 