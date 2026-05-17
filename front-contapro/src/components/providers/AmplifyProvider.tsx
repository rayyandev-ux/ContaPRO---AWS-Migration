"use client";

import { Amplify } from "aws-amplify";
import { useEffect } from "react";

export default function AmplifyProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Solo inicializar si están las variables de entorno para no romper en dev
    if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID && process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID) {
      Amplify.configure({
        Auth: {
          Cognito: {
            userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
            userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
            signUpVerificationMethod: "code",
            loginWith: {
              email: true,
            },
          },
        },
      });
    }
  }, []);

  return <>{children}</>;
}