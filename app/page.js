"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "../lib/auth";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = getToken();
    if (token) {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-background">
      <h1 className="text-3xl font-bold text-foreground mb-4">
        Welcome to Project Management App
      </h1>
      <div className="space-x-4">
        <a href="/dashboard" className="text-primary hover:underline">
          Login
        </a>
        <a href="/register" className="text-primary hover:underline">
          Register
        </a>
      </div>
    </main>
  );
}