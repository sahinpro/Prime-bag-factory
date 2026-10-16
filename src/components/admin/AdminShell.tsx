"use client";

import React from "react";
import AppSidebar from "./AppSidebar";
import Topbar from "./Topbar";

export default function AdminShell({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="min-h-screen flex bg-color-background text-color-foreground">
      <AppSidebar />
      <div className="flex min-h-screen w-full flex-col">
        <Topbar title={title} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
