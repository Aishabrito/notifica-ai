import { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export const AuthCard = ({ title, subtitle, children, footer }: AuthCardProps) => (
  <div className="min-h-screen flex items-center justify-center p-6 text-[#f5f2eb]">
    <div className="max-w-md w-full bg-[#111] border border-white/10 p-10 rounded-4xl shadow-2xl">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
        <p className="text-gray-500 text-sm mt-2">{subtitle}</p>
      </div>
      {children}
      {footer && <div className="mt-8 text-center text-sm text-gray-500">{footer}</div>}
    </div>
  </div>
);