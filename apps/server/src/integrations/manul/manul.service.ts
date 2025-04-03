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
  async callManulAgent(context: string, task: string): Promise<string> {
    try {
      const response = await fetch(`${process.env.MANUL_AGENTS_URL}/context_call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input_variables: {
            context,
            task
          },
          prompt_name: "general_context",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Manul service request failed with status ${response.status}`;
        
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
          'Invalid response format from Manul service. Expected response to contain choices[0].message.content',
          HttpStatus.BAD_GATEWAY
        );
      }

      return data.choices[0].message.content;
    } catch (error) {
      console.error('Manul API error:', error);
      if (error instanceof ManulServiceError) {
        throw error;
      }
      const typedError = error as ErrorWithMessage;
      throw new ManulServiceError(
        `Failed to process query with Manul service: ${typedError.message}`,
        typedError.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
} 