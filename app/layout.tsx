export const metadata = {
  title: "Sarvam Voice Bot",
  description: "Multilingual voice bot — Hindi, Marathi, Bengali & English",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#faf6ef" }}>{children}</body>
    </html>
  );
}
