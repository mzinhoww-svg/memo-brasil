// The official JS packages currently ship no TypeScript declarations.
declare module "@validapay/tokenize/browser" {
  export function collectDevice(input: { publicId: string; environment: "sandbox" }): Promise<{ deviceId: string | null }>;
  export function tokenize(input: {
    publicId: string; environment: "sandbox";
    card: import("../features/billing/validapay-card").SandboxCard;
    customer: import("../features/billing/validapay-card").SandboxCustomer;
    authentication: { authenticationId: string; cardId: string };
  }): Promise<{ cardToken: string }>;
}
declare module "@validapay/3ds" {
  export function authenticate(input: {
    publicId: string; environment: "sandbox"; amount: number;
    card: import("../features/billing/validapay-card").SandboxCard;
    customer: import("../features/billing/validapay-card").SandboxCustomer;
    statementDescriptor: string;
  }): Promise<{ authenticationId: string; cardId: string } | null>;
}
