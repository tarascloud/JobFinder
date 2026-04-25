import type { Metadata } from "next";
import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
      <div className="mb-6 rounded-full bg-muted p-5">
        <FileQuestion
          className="h-12 w-12 text-muted-foreground"
          aria-hidden="true"
        />
      </div>
      <h1 className="text-4xl font-bold tracking-tight text-foreground">
        404
      </h1>
      <p className="mt-2 text-lg text-muted-foreground">
        Page not found
      </p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/">
          <Button variant="default">Go Home</Button>
        </Link>
        <Link href="/about">
          <Button variant="outline">About JobFinder</Button>
        </Link>
      </div>
    </div>
  );
}
