import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface ErrorWithMessage {
  message: string;
  status?: number;
}

export interface Suggestion {
  text_to_replace: string;
  text_replacement: string;
  reason: string;
  text_before: string;
  text_after: string;
}

export interface SuggestDiffResponse {
  text: string;
  suggestions: Suggestion[];
}

export interface SuggestResponse {
  text: string;
  doc: any;
}

interface ChatCompletionResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

class ManulServiceError extends HttpException {
  constructor(
    message: string,
    status: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(message, status);
  }
}

@Injectable()
export class ManulService {
  private async makeManulRequest<T extends Record<string, any>, R = any>(
    endpoint: string,
    body: T,
  ): Promise<R> {
    try {
      const response = await fetch(
        `${process.env.MANUL_AGENTS_URL}${endpoint}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Manul request to ${endpoint} failed with status ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += `: ${errorJson.detail || errorJson.message || errorJson.error || errorText}`; // Check for 'detail' too
        } catch {
          errorMessage += `: ${errorText}`;
        }

        throw new ManulServiceError(errorMessage, response.status);
      }

      const data: R = await response.json(); // Return the full parsed data

      if (typeof data !== 'object' || data === null) {
        throw new ManulServiceError(
          `Invalid response format from Manul service at ${endpoint}. Expected an object.`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      return data;
    } catch (error) {
      console.error(`Manul API error at ${endpoint}:`, error);
      if (error instanceof ManulServiceError) {
        throw error;
      }
      const typedError = error as ErrorWithMessage;
      throw new ManulServiceError(
        `Failed to process query with Manul service at ${endpoint}: ${typedError.message}`,
        typedError.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async contextCall(context: string, task: string): Promise<string> {
    const response = await this.makeManulRequest<any, ChatCompletionResponse>(
      '/context_call',
      {
        input_variables: {
          context,
          task,
        },
        prompt_name: 'general_context',
      },
    );

    if (!response?.choices?.[0]?.message?.content) {
      throw new ManulServiceError(
        `Invalid response format from Manul service at /context_call. Expected choices[0].message.content`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return response.choices[0].message.content;
  }

  async suggestDiff(
    previousContent: string,
    currentContent: string,
    diff: string,
  ): Promise<SuggestDiffResponse> {
    const previous_content = previousContent;
    const current_content = currentContent;
    const response = await this.makeManulRequest<any, SuggestDiffResponse>(
      '/suggest_diff',
      {
        previous_content,
        current_content,
        diff,
        prompt_name: 'suggest_diff',
      },
    );

    if (
      !response ||
      typeof response !== 'object' ||
      !Array.isArray(response.suggestions)
    ) {
      throw new ManulServiceError(
        `Invalid response format from Manul service at /suggest_diff. Expected an object with a 'suggestions' array.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return response;
  }

  async suggest(
    parents: string,
    content: string,
    prompt: string,
  ): Promise<SuggestResponse> {
    const response = await this.makeManulRequest<any, SuggestResponse>(
      '/suggest',
      {
        input_variables: { 
          parents, 
          content,
          prompt,
        },
        prompt_name: 'suggest',
      },
    );

    console.log("Suggest Response:", response);

    if (
      !response
      // || typeof response !== 'object'
      // || !Array.isArray(response.doc)
    ) {
      throw new ManulServiceError(
        `Invalid response format from Manul service at /suggest. Expected an object with a 'suggestions' array.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return response;
  }
}
