import "./globals.css";

export const metadata = {
  title: "Frequency",
  description: "Meet someone new.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
