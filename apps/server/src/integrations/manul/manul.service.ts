import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

interface ErrorWithMessage {
  message: string;
  status?: number;
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
}
