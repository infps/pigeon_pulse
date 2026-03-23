declare module '@paypal/checkout-server-sdk' {
  namespace core {
    class SandboxEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class LiveEnvironment {
      constructor(clientId: string, clientSecret: string);
    }
    class PayPalHttpClient {
      constructor(environment: SandboxEnvironment | LiveEnvironment);
      execute<T>(request: unknown): Promise<{ result: T; statusCode: number }>;
    }
  }
  namespace orders {
    class OrdersCreateRequest {
      requestBody(body: unknown): void;
      prefer(preference: string): void;
    }
    class OrdersCaptureRequest {
      constructor(orderId: string);
      requestBody(body: unknown): void;
    }
    class OrdersGetRequest {
      constructor(orderId: string);
    }
  }
  namespace notifications {
    class WebhookVerifySignatureRequest {
      constructor(body: unknown);
    }
  }
  const paypal: {
    core: typeof core;
    orders: typeof orders;
    notifications: typeof notifications;
  };
  export default paypal;
}
