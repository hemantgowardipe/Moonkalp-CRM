import "./globals.css";

export const metadata = {
  title: "Moonkalp CRM",
  description: "Client, deliverables, and billing management for your agency.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
