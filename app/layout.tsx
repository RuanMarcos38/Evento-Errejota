import type { Metadata } from "next";
import "./globals.css";
import "./premium.css";
import { AuthGate } from "./auth-gate";

export const metadata: Metadata = {
  title: "Errejota Eventos | Central de Lotação",
  description: "Operação de eventos, reservas, CRM e campanhas em um único painel.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
