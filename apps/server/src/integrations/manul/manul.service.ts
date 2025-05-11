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

  async contextCall(
    messages: {
      role: string;
      content: string;
      tool_calls?: any[];
      tool_call_id?: string;
    }[],
  ): Promise<ReadableStream<Uint8Array>> {
    try {
      console.log('ManulService: Calling Manul API with messages:', {
        messagesCount: messages?.length || 0,
        hasToolCalls: messages.some(
          (m) => m.tool_calls && m.tool_calls.length > 0,
        ),
      });

      const url = `${process.env.MANUL_AGENTS_URL}/context_call`;
      console.log('ManulService: Using URL:', url);

      const body = {
        messages: messages,
        stream: true,
      };

      // Log the payload for debugging
      console.log(
        'ManulService: Sending payload to server:',
        JSON.stringify(body),
      );

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      console.log('ManulService: Got response status:', response.status);
      console.log(
        'ManulService: Response headers:',
        Object.fromEntries(response.headers.entries()),
      );

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Manul request failed with status ${response.status}`;

        try {
          const errorJson = JSON.parse(errorText);
          errorMessage += `: ${errorJson.detail || errorJson.message || errorJson.error || errorText}`;
        } catch {
          errorMessage += `: ${errorText}`;
        }

        throw new ManulServiceError(errorMessage, response.status);
      }

      // Always return the stream
      console.log('ManulService: Returning stream');
      return response.body;
    } catch (error) {
      console.error('ManulService: Error:', error);
      if (error instanceof ManulServiceError) {
        throw error;
      }
      const typedError = error as ErrorWithMessage;
      throw new ManulServiceError(
        `Failed to process query with Manul service: ${typedError.message}`,
        typedError.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
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

    console.log('Suggest Response:', response);

    if (!response) {
      throw new ManulServiceError(
        `Invalid response format from Manul service at /suggest. Expected an object with a 'suggestions' array.`,
        HttpStatus.BAD_GATEWAY,
      );
    }
    return response;
  }
}
